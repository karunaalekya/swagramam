// Order Board (Phase 4). Run: node --no-warnings --test tools/test/board.test.mjs
import test from "node:test"; import assert from "node:assert/strict";
import { makeEnv } from "./d1shim.mjs";
import * as sendR from "../../functions/api/otp/send.js";
import * as verR from "../../functions/api/otp/verify.js";
import * as startR from "../../functions/api/checkout/start.js";
import * as statR from "../../functions/api/order/status.js";
import * as cbR from "../../functions/api/payu/callback.js";
import * as mockR from "../../functions/api/mock-pay.js";
import * as loginR from "../../functions/api/board/login.js";
import * as ordersR from "../../functions/api/board/orders.js";
import * as actR from "../../functions/api/board/action.js";
import { ITEMS } from "../../functions/_lib/menu.js";

const O = "https://t.example", T0 = Date.parse("2026-10-21T04:30:00Z");   // Wed 10:00 IST
const PIN = "246810";
const env0 = (x = {}) => makeEnv({ TEST_NOW_MS: String(T0), BOARD_PIN: PIN, ...x });
const req = (path, method, body, headers = {}) => new Request(O + path, { method, headers: { "content-type": "application/json", "cf-connecting-ip": "9.9.9.9", ...headers }, body: body ? JSON.stringify(body) : undefined });
const call = async (env, h, path, b, ip = "1.1.1.1") => { const r = await h.onRequestPost({ env, request: req(path, "POST", b, { "cf-connecting-ip": ip }) }); return { s: r.status, j: await r.json(), h: r.headers }; };
const sku = n => ITEMS.find(i => i.name === n).sku;
let ph = 7000000000; const newPhone = () => String(++ph);
async function token(env, phone = newPhone()) { const s = await call(env, sendR, "/api/otp/send", { phone }); const v = await call(env, verR, "/api/otp/verify", { phone, code: s.j.devCode }); return { phone, token: v.j.token }; }
const body = (tok, over = {}) => ({ token: tok, lines: [{ sku: sku("Munakkaada Vadiyalu Charu"), qty: 1 }], slot: { date: "2026-10-21", time: "13:00" }, method: "cod", name: "Asha", consent: { terms: true, marketing: false }, ...over });
async function codOrder(env, over = {}) { const a = await token(env); const r = await call(env, startR, "/api/checkout/start", body(a.token, over)); assert.ok(r.j.ok, JSON.stringify(r.j)); return { id: r.j.orderId, phone: a.phone }; }
function postForm(h, path, fields, env) { const fd = new FormData(); for (const [k, v] of Object.entries(fields)) fd.append(k, v); return h.onRequestPost({ env, request: new Request(O + path, { method: "POST", body: fd }) }); }
const formFields = html => Object.fromEntries([...html.matchAll(/<input type=hidden name='([^']*)' value='([^']*)'>/g)].map(m => [m[1], m[2].replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'")]));
async function paidOrder(env, result = "success") {
  const a = await token(env); const r = await call(env, startR, "/api/checkout/start", body(a.token, { method: "payu" })); assert.ok(r.j.ok);
  const res = await postForm(mockR, "/api/mock-pay", { ...r.j.redirect.fields, result }, env); await postForm(cbR, "/api/payu/callback", formFields(await res.text()), env);
  return { id: r.j.orderId, phone: a.phone };
}
async function staff(env) { const r = await call(env, loginR, "/api/board/login", { pin: PIN }); assert.equal(r.s, 200); return r.h.get("set-cookie").split(";")[0]; }
const list = async (env, cookie, q = "") => { const r = await ordersR.onRequestGet({ env, request: req("/api/board/orders" + q, "GET", null, cookie ? { cookie } : {}) }); return { s: r.status, j: await r.json() }; };
const act = async (env, cookie, b, hdr = true) => { const r = await actR.onRequestPost({ env, request: req("/api/board/action", "POST", b, { cookie, ...(hdr ? { "x-board": "1" } : {}) }) }); return { s: r.status, j: await r.json() }; };
const state = async (env, id) => (await env.DB.prepare("SELECT state FROM orders WHERE id=?").bind(id).first()).state;

test("board is off without a PIN, and needs the PIN", async () => {
  const off = makeEnv({ TEST_NOW_MS: String(T0) });
  assert.equal((await list(off)).s, 404); assert.equal((await call(off, loginR, "/api/board/login", { pin: "123456" })).s, 404);
  const env = env0(); assert.equal((await list(env)).s, 401);
  assert.equal((await call(env, loginR, "/api/board/login", { pin: "000000" })).s, 401);
  const c = await staff(env); assert.equal((await list(env, c)).s, 200);
  assert.equal((await list(env, "sx_board=forged.token")).s, 401);
});
test("5 wrong PINs lock that IP for 15 minutes; the cookie is HttpOnly and SameSite=Strict", async () => {
  const env = env0();
  for (let i = 0; i < 5; i++) assert.equal((await call(env, loginR, "/api/board/login", { pin: "111111" }, "5.5.5.5")).s, 401);
  assert.equal((await call(env, loginR, "/api/board/login", { pin: PIN }, "5.5.5.5")).s, 429);
  const ok = await call(env, loginR, "/api/board/login", { pin: PIN }, "6.6.6.6"); assert.match(ok.h.get("set-cookie"), /HttpOnly; SameSite=Strict/);
});
test("unpaid online orders never reach the board; paid ones and pay-at-pickup do", async () => {
  const env = env0(), c = await staff(env);
  const cod = await codOrder(env), paid = await paidOrder(env);
  const a = await token(env); const unpaid = await call(env, startR, "/api/checkout/start", body(a.token, { method: "payu" }));
  const ids = (await list(env, c)).j.orders.map(o => o.id);
  assert.ok(ids.includes(cod.id) && ids.includes(paid.id)); assert.ok(!ids.includes(unpaid.j.orderId));
  const o = (await list(env, c)).j.orders.find(x => x.id === cod.id); assert.equal(o.column, "new"); assert.equal(o.items[0].name, "Munakkaada Vadiyalu Charu"); assert.equal(o.paid, false);
});
test("accept -> ready -> collected: customer page follows, counter payment recorded, points credited once", async () => {
  const env = env0(), c = await staff(env);
  const a = await token(env); const r = await call(env, startR, "/api/checkout/start", body(a.token, { join: true })); const id = r.j.orderId;
  assert.equal((await act(env, c, { id, action: "accept" })).j.state, "CONFIRMED");
  const rd = await act(env, c, { id, action: "ready" }); assert.equal(rd.j.state, "READY"); assert.match(rd.j.waLink, /^https:\/\/wa\.me\/91\d{10}\?text=.*ready/);
  const st = await statR.onRequestGet({ env, request: new Request(O + "/api/order/status?id=" + id) }); assert.equal((await st.json()).stage, "ready");
  const col = await act(env, c, { id, action: "collected" }); assert.equal(col.j.state, "COMPLETED"); assert.ok(col.j.points > 0);
  const pay = await env.DB.prepare("SELECT * FROM payments WHERE order_id=? AND provider='counter'").bind(id).first(); assert.equal(pay.status, "success");
  const pts = (await env.DB.prepare("SELECT points FROM customers WHERE phone=?").bind(a.phone).first()).points; assert.equal(pts, col.j.points);
  const again = await act(env, c, { id, action: "collected" }); assert.equal(again.s, 409); assert.equal(again.j.state, "COMPLETED");
  assert.equal((await env.DB.prepare("SELECT points FROM customers WHERE phone=?").bind(a.phone).first()).points, pts, "points not credited twice");
  const sum = (await list(env, c)).j.summary; assert.ok(sum.counterTakenMinor > 0 && sum.counterDueMinor === 0);
});
test("two phones at the counter: only one action wins", async () => {
  const env = env0(), c = await staff(env), o = await codOrder(env);
  const [x, y] = await Promise.all([act(env, c, { id: o.id, action: "accept" }), act(env, c, { id: o.id, action: "accept" })]);
  assert.deepEqual([x.s, y.s].sort(), [200, 409]);
});
test("no-show counts against pay at pickup (2 turn it off)", async () => {
  const env = env0(), c = await staff(env), o = await codOrder(env);
  assert.equal((await act(env, c, { id: o.id, action: "noshow" })).j.state, "NO_SHOW");
  assert.equal((await env.DB.prepare("SELECT noshows FROM customers WHERE phone=?").bind(o.phone).first()).noshows, 1);
});
test("reject: pay at pickup is cancelled; paid online goes to refund needed with an alert", async () => {
  const env = env0(), c = await staff(env), cod = await codOrder(env), paid = await paidOrder(env);
  assert.equal((await act(env, c, { id: cod.id, action: "reject" })).s, 400, "reason required");
  assert.equal((await act(env, c, { id: cod.id, action: "reject", reason: "Item not available" })).j.state, "CANCELLED");
  assert.equal((await act(env, c, { id: paid.id, action: "reject", reason: "Kitchen too busy" })).j.state, "REFUND_NEEDED");
  const al = await env.DB.prepare("SELECT data FROM events WHERE order_id=? AND kind='alert'").bind(paid.id).first(); assert.match(al.data, /refund/);
});
test("actions need the x-board header (no cross-site posts) and a valid order", async () => {
  const env = env0(), c = await staff(env), o = await codOrder(env);
  assert.equal((await act(env, c, { id: o.id, action: "accept" }, false)).s, 403);
  assert.equal(await state(env, o.id), "SENT_TO_KITCHEN");
  assert.equal((await act(env, c, { id: "SWNOTREAL", action: "accept" })).s, 404);
  assert.equal((await act(env, c, { id: o.id, action: "explode" })).s, 400);
});
test("a list for another day and the day summary", async () => {
  const env = env0(), c = await staff(env); await codOrder(env); await codOrder(env, { slot: { date: "2026-10-22", time: "13:00" } });
  const today = (await list(env, c)).j, tom = (await list(env, c, "?date=2026-10-22")).j;
  assert.equal(today.date, "2026-10-21"); assert.equal(today.orders.length, 1); assert.equal(tom.orders.length, 1);
  assert.equal(today.summary.orders, 1); assert.ok(today.summary.counterDueMinor > 0);
});
