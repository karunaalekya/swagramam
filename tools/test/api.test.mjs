import test from "node:test"; import assert from "node:assert/strict";
import { makeEnv } from "./d1shim.mjs";
import * as menuR from "../../functions/api/menu.js";
import * as quoteR from "../../functions/api/quote.js";
import * as slotsR from "../../functions/api/slots.js";
import * as sendR from "../../functions/api/otp/send.js";
import * as verR from "../../functions/api/otp/verify.js";
import * as startR from "../../functions/api/checkout/start.js";
import * as statR from "../../functions/api/order/status.js";
import * as lookR from "../../functions/api/order/lookup.js";
import * as cbR from "../../functions/api/payu/callback.js";
import * as whR from "../../functions/api/payu/webhook.js";
import * as mockR from "../../functions/api/mock-pay.js";
import * as healthR from "../../functions/api/health.js";
import { gstMinor, minorFromAmount } from "../../functions/_lib/money.js";
import { requestHash, responseHash, MOCK } from "../../functions/_lib/payu.js";
import { ITEMS } from "../../functions/_lib/menu.js";

const O = "https://t.example";
// Wed 2026-10-21 10:00 IST = 04:30 UTC
const T0 = Date.parse("2026-10-21T04:30:00Z");
const post = (h, path, body) => h.onRequestPost({ env: body.__env, request: new Request(O + path, { method: "POST", headers: { "content-type": "application/json", "cf-connecting-ip": body.__ip || "1.1.1.1" }, body: JSON.stringify(body.__b) }) });
const call = async (env, h, path, b, ip) => { const r = await post(h, path, { __env: env, __b: b, __ip: ip }); return { s: r.status, j: await r.json() }; };
const get = async (env, h, path) => { const r = await h.onRequestGet({ env, request: new Request(O + path) }); return { s: r.status, j: await r.json() }; };
const env0 = (x = {}) => makeEnv({ TEST_NOW_MS: String(T0), ...x });
const sku = n => ITEMS.find(i => i.name === n).sku;
const price = n => ITEMS.find(i => i.name === n).priceMinor;
let ph = 6000000000; const newPhone = () => String(++ph);
async function login(env, phone = newPhone(), purpose = "checkout") {
  const s = await call(env, sendR, "/api/otp/send", { phone }); assert.ok(s.j.ok && s.j.devCode, "send ok");
  const v = await call(env, verR, "/api/otp/verify", { phone, code: s.j.devCode, purpose }); assert.ok(v.j.ok, "verify ok"); return { phone, token: v.j.token, v: v.j };
}
const thali = () => ({ sku: sku("Swagramam Aritaku Bhojanam"), qty: 1 });           // lunch only, Rs 299
const soup = () => ({ sku: sku("Munakkaada Vadiyalu Charu"), qty: 1 });             // lunch+dinner, Rs 149
const combo = ITEMS.find(i => i.meal === "d");                                       // dinner only
const lunchSlot = { date: "2026-10-21", time: "13:00" }, dinnerSlot = { date: "2026-10-21", time: "20:00" };
const body = (token, lines, over = {}) => ({ token, lines, slot: lunchSlot, method: "cod", name: "Test Guest", consent: { terms: true, marketing: false }, ...over });
const bigLines = (totalAtLeast) => { const it = ITEMS.filter(i => i.meal === "ld").sort((a, b) => b.priceMinor - a.priceMinor)[0]; return [{ sku: it.sku, qty: Math.ceil(totalAtLeast / it.priceMinor) }]; };
function postForm(h, path, fields, env) { const fd = new FormData(); for (const [k, v] of Object.entries(fields)) fd.append(k, v); return h.onRequestPost({ env, request: new Request(O + path, { method: "POST", body: fd }) }); }
const formFields = html => Object.fromEntries([...html.matchAll(/<input type=hidden name='([^']*)' value='([^']*)'>/g)].map(m => [m[1], m[2].replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'")]));

test("money: GST half-up and amount parsing", () => {
  assert.equal(gstMinor(29900, 500), 1495); assert.equal(gstMinor(10010, 500), 501); assert.equal(gstMinor(10030, 500), 502); // 501.5 -> 502
  assert.equal(minorFromAmount("1000.00"), 100000); assert.equal(minorFromAmount("1000.5"), 100050); assert.equal(minorFromAmount("abc"), null);
});
test("payu hash formulas (request and reverse)", async () => {
  const p = { txnid: "T1", amount: "10.00", productinfo: "P", firstname: "A", email: "a@b.c" };
  const { createHash } = await import("node:crypto"); const sha = s => createHash("sha512").update(s).digest("hex");
  assert.equal(await requestHash(p, "K", "S"), sha("K|T1|10.00|P|A|a@b.c|||||||||||S"));
  assert.equal(await responseHash({ ...p, status: "success" }, "K", "S"), sha("S|success|||||||||||a@b.c|A|P|10.00|T1|K"));
  assert.equal(await responseHash({ ...p, status: "success", udf1: "x", additionalCharges: "1.00" }, "K", "S"), sha("1.00|S|success||||||||||x|a@b.c|A|P|10.00|T1|K"));
});
test("menu: 99 skus, unique, server prices", () => { assert.equal(ITEMS.length, 99); assert.equal(new Set(ITEMS.map(i => i.sku)).size, 99); });
test("menu and health endpoints", async () => {
  const env = env0(); const m = await get(env, menuR, "/api/menu"); assert.ok(m.j.live); assert.equal(m.j.items.length, 99); assert.equal(m.j.gstAssumed, true);
  const h = await get(env, healthR, "/api/health"); assert.ok(h.j.live);
  const off = env0({ ONLINE_ORDER_LIVE: "false" }); assert.equal((await get(off, healthR, "/api/health")).j.live, false);
});
test("production refuses mock OTP and mock gateway", async () => {
  const env = env0({ ENV: "production", TOKEN_SECRET: "x" }); assert.equal((await get(env, healthR, "/api/health")).j.live, false);
  const s = await call(env, sendR, "/api/otp/send", { phone: "9000000001" }); assert.equal(s.s, 503);
  assert.equal((await mockR.onRequestGet({ env })).status, 404);
});
test("slots: half-hour windows (default), Monday lunch end, prep time, today filter, SLOT_MIN override", async () => {
  const env = env0(); const d = await get(env, slotsR, "/api/slots?date=2026-10-21"); const times = d.j.slots.map(s => s.time); assert.equal(d.j.slotMin, 30);
  assert.equal(times[0], "12:00"); assert.ok(times.includes("16:00") && !times.includes("16:15") && !times.includes("16:30")); assert.ok(times.includes("19:00") && times.includes("23:00") && !times.includes("23:30"));
  assert.ok(times.every(x => x.endsWith(":00") || x.endsWith(":30")), "only half-hour starts");
  const mon = await get(env, slotsR, "/api/slots?date=2026-10-26"); const mt = mon.j.slots.map(s => s.time); assert.ok(mt.includes("15:30") && !mt.includes("16:00"));   // Monday lunch ends 16:00: last window 3:30-4:00
  const late = makeEnv({ TEST_NOW_MS: String(Date.parse("2026-10-21T07:50:00Z")) }); // 13:20 IST -> 13:45 with 25 min prep -> next half hour 14:00
  const l = (await get(late, slotsR, "/api/slots?date=2026-10-21")).j.slots.map(s => s.time); assert.equal(l[0], "14:00");
  assert.equal((await get(env, slotsR, "/api/slots?date=2026-10-20")).j.slots.length, 0); assert.equal((await get(env, slotsR, "/api/slots?date=2026-11-05")).j.slots.length, 0);
  const q15 = env0({ SLOT_MIN: "15" }); assert.ok((await get(q15, slotsR, "/api/slots?date=2026-10-21")).j.slots.some(s => s.time === "12:15"), "SLOT_MIN=15 still works");
});
test("quote: server prices, GST, points, tampering ignored", async () => {
  const env = env0(); const q = await call(env, quoteR, "/api/quote", { lines: [thali(), { ...soup(), qty: 2, priceMinor: 1 }], slot: lunchSlot });
  assert.equal(q.j.subtotalMinor, 29900 + 2 * 14900); assert.equal(q.j.taxMinor, gstMinor(q.j.subtotalMinor, 500)); assert.equal(q.j.totalMinor, q.j.subtotalMinor + q.j.taxMinor); assert.equal(q.j.pointsToEarn, 597);
  assert.equal((await call(env, quoteR, "/api/quote", { lines: [{ sku: "nope", qty: 1 }] })).j.error, "unknown_item");
  assert.equal((await call(env, quoteR, "/api/quote", { lines: [{ sku: soup().sku, qty: 0 }] })).j.error, "bad_qty");
});
test("RULE: Rs 1000.00 offers both; Rs 1000.01 offers PayU only", async () => {
  const env = env0(); const it = ITEMS.find(i => i.meal === "ld" && i.priceMinor === 14900);   // find basket that totals exactly 100000
  // search a basket whose total (incl GST) is exactly 100000 and one above
  let exact = null, above = null;
  for (const a of ITEMS.filter(i => i.meal === "ld")) for (let n = 1; n <= 20 && !(exact && above); n++) {
    const sub = a.priceMinor * n, tot = sub + gstMinor(sub, 500); if (tot === 100000) exact = [{ sku: a.sku, qty: n }]; if (tot > 100000 && tot < 106000 && !above) above = [{ sku: a.sku, qty: n }];
  }
  if (!exact) { // build exact by two-item search
    outer: for (const a of ITEMS.filter(i => i.meal === "ld")) for (const b of ITEMS.filter(i => i.meal === "ld")) for (let n = 1; n < 6; n++) for (let m = 1; m < 6; m++) { const sub = a.priceMinor * n + b.priceMinor * m; if (sub + gstMinor(sub, 500) === 100000) { exact = [{ sku: a.sku, qty: n }, { sku: b.sku, qty: m }]; break outer; } }
  }
  if (exact) { const q = await call(env, quoteR, "/api/quote", { lines: exact }); assert.equal(q.j.totalMinor, 100000); assert.deepEqual(q.j.methods, ["payu", "cod"]); }
  // boundary via custom limit flag so the test is exact regardless of menu prices
  const L = (limit) => env0({ COD_MAX_TOTAL_MINOR: String(limit) }); const line = [soup()]; const tot = 14900 + gstMinor(14900, 500);
  assert.deepEqual((await call(L(tot), quoteR, "/api/quote", { lines: line })).j.methods, ["payu", "cod"]);        // total == limit: both
  assert.deepEqual((await call(L(tot - 1), quoteR, "/api/quote", { lines: line })).j.methods, ["payu"]);          // total == limit + 1 paisa: PayU only
  const big = await call(env, quoteR, "/api/quote", { lines: bigLines(120000) }); assert.ok(big.j.totalMinor > 100000); assert.deepEqual(big.j.methods, ["payu"]); assert.equal(big.j.codReason, "over_limit");
});
test("RULE: forced pay-at-pickup above Rs 1000 is rejected by the server", async () => {
  const env = env0(); const a = await login(env); const r = await call(env, startR, "/api/checkout/start", body(a.token, bigLines(120000), { method: "cod" }));
  assert.equal(r.s, 403); assert.equal(r.j.error, "method_not_allowed"); assert.equal(env.raw.prepare("SELECT COUNT(*) n FROM orders").get().n, 0);
});
test("lunch-only and dinner-only items are blocked on the wrong slot", async () => {
  const env = env0(); const a = await login(env);
  let r = await call(env, startR, "/api/checkout/start", body(a.token, [thali()], { slot: dinnerSlot })); assert.equal(r.j.error, "meal_conflict"); assert.match(r.j.message, /lunch only/);
  const b = await login(env); r = await call(env, startR, "/api/checkout/start", body(b.token, [{ sku: combo.sku, qty: 1 }], { slot: lunchSlot })); assert.equal(r.j.error, "meal_conflict"); assert.match(r.j.message, /dinner only/);
  const q = await call(env, quoteR, "/api/quote", { lines: [thali()], slot: dinnerSlot }); assert.equal(q.j.conflicts.length, 1);
  const c = await login(env); r = await call(env, startR, "/api/checkout/start", body(c.token, [thali(), soup()], { slot: lunchSlot })); assert.ok(r.j.ok);
});
test("OTP: wrong, expired, resend, rate limit, single use", async () => {
  const env = env0(); const phone = newPhone(); let s = await call(env, sendR, "/api/otp/send", { phone }); const code = s.j.devCode;
  assert.equal((await call(env, sendR, "/api/otp/send", { phone })).j.error, "resend_wait");                                       // 30 s resend
  const wrong = await call(env, verR, "/api/otp/verify", { phone, code: code === "000000" ? "111111" : "000000" }); assert.equal(wrong.j.error, "wrong_code"); assert.equal(wrong.j.triesLeft, 2);
  assert.ok((await call(env, verR, "/api/otp/verify", { phone, code })).j.ok);                                                      // right code still works after a wrong try
  assert.equal((await call(env, verR, "/api/otp/verify", { phone, code })).j.error, "no_code");                                    // single use
  const p2 = newPhone(); s = await call(env, sendR, "/api/otp/send", { phone: p2 }); env.TEST_NOW_MS = String(T0 + 6 * 60000);
  assert.equal((await call(env, verR, "/api/otp/verify", { phone: p2, code: s.j.devCode })).j.error, "expired"); env.TEST_NOW_MS = String(T0);
  const p3 = newPhone(); s = await call(env, sendR, "/api/otp/send", { phone: p3 }); let last; for (let i = 0; i < 3; i++) last = await call(env, verR, "/api/otp/verify", { phone: p3, code: "999999" === s.j.devCode ? "888888" : "999999" });
  assert.equal((await call(env, verR, "/api/otp/verify", { phone: p3, code: s.j.devCode })).j.error, "too_many_tries");              // 3 tries then locked
  const p4 = newPhone(); const e2 = env0(); let n = 0; for (let i = 0; i < 7; i++) { e2.TEST_NOW_MS = String(T0 + i * 31000); const r = await call(e2, sendR, "/api/otp/send", { phone: p4 }); if (r.j.error === "rate_limited") n++; } assert.equal(n, 4);   // 3 per phone per hour
  assert.equal((await call(env, sendR, "/api/otp/send", { phone: "12345" })).j.error, "phone");
});
test("token: tampered, wrong purpose, reused", async () => {
  const env = env0(); const a = await login(env); const lines = [soup()];
  assert.equal((await call(env, startR, "/api/checkout/start", body(a.token + "x", lines))).j.error, "bad_token");
  const lk = await login(env, newPhone(), "lookup"); assert.equal((await call(env, startR, "/api/checkout/start", body(lk.token, lines))).j.error, "bad_token");   // lookup token cannot place orders
  const r1 = await call(env, startR, "/api/checkout/start", body(a.token, lines)); assert.ok(r1.j.ok);
  assert.equal((await call(env, startR, "/api/checkout/start", body(a.token, lines))).j.error, "token_used");
});
test("pay at pickup: order created, goes to kitchen unpaid, consent saved, open cap, no-show rule", async () => {
  const env = env0(); const phone = newPhone(); const mk = async () => { const a = await login(env, phone); return call(env, startR, "/api/checkout/start", body(a.token, [soup()], { consent: { terms: true, marketing: true } })); };
  const r = await mk(); assert.ok(r.j.ok && r.j.method === "cod"); const st = await get(env, statR, "/api/order/status?id=" + r.j.orderId); assert.equal(st.j.state, "SENT_TO_KITCHEN"); assert.equal(st.j.stage, "placed_cod");
  assert.equal(env.raw.prepare("SELECT COUNT(*) n FROM handoffs WHERE order_id=?").get(r.j.orderId).n, 1);
  assert.deepEqual(env.raw.prepare("SELECT kind,granted,wording_version FROM consents WHERE order_id=? ORDER BY id").all(r.j.orderId).map(x => x.kind + x.granted), ["terms1", "marketing1"]);
  assert.ok((await mk()).j.ok); const third = await mk(); assert.equal(third.j.error, "method_not_allowed"); assert.equal(third.j.codReason, "open_cap");       // 2 open pay-at-pickup orders per phone
  const p2 = newPhone(); env.raw.prepare("INSERT INTO customers(phone,noshows,created_at,updated_at) VALUES(?,2,0,0)").run(p2);
  const a = await login(env, p2); const ns = await call(env, startR, "/api/checkout/start", body(a.token, [soup()])); assert.equal(ns.j.codReason, "noshows");
});
test("consent and input validation", async () => {
  const env = env0(); const a = await login(env);
  assert.equal((await call(env, startR, "/api/checkout/start", body(a.token, [soup()], { consent: { terms: false } }))).j.error, "consent");
  assert.equal((await call(env, startR, "/api/checkout/start", body(a.token, [soup()], { name: " " }))).j.error, "name");
  assert.equal((await call(env, startR, "/api/checkout/start", body(a.token, [soup()], { email: "bad" }))).j.error, "email");
  assert.equal((await call(env, startR, "/api/checkout/start", body(a.token, [soup()], { slot: { date: "2026-10-21", time: "10:00" } }))).j.error, "slot");
  assert.equal((await call(env, startR, "/api/checkout/start", body(a.token, [soup()], { method: "upi" }))).j.error, "method");
  assert.equal(env.raw.prepare("SELECT COUNT(*) n FROM orders").get().n, 0);
});
test("slot cap: 8 per slot", async () => {
  const env = env0(); let last; for (let i = 0; i < 9; i++) { const a = await login(env); last = await call(env, startR, "/api/checkout/start", body(a.token, [soup()], { slot: { date: "2026-10-21", time: "14:00" }, method: "payu" })); if (i < 8) assert.ok(last.j.ok, "order " + i); }
  assert.equal(last.j.error, "slot_full"); const s = await get(env, slotsR, "/api/slots?date=2026-10-21"); assert.equal(s.j.slots.find(x => x.time === "14:00").full, true);
});
async function payuOrder(env, opts = {}) {
  const a = await login(env); const r = await call(env, startR, "/api/checkout/start", body(a.token, opts.lines || [soup()], { method: "payu", join: opts.join }));
  assert.ok(r.j.ok, JSON.stringify(r.j)); assert.equal(r.j.redirect.url, O + "/api/mock-pay"); return { ...r.j, phone: a.phone, token: a.token };
}
async function gateway(env, r, result, extra = {}) {   // browser -> mock gateway -> back to callback fields
  let res = await postForm(mockR, "/api/mock-pay", r.redirect.fields, env); assert.equal(res.status, 200); assert.match(await res.text(), /TEST PAYMENT/);
  res = await postForm(mockR, "/api/mock-pay", { ...r.redirect.fields, result, ...extra }, env); const back = formFields(await res.text()); return back;
}
test("PayU mock: success -> PAID -> SENT_TO_KITCHEN, order appears in D1, items saved", async () => {
  const env = env0(); const r = await payuOrder(env, { lines: [thali(), soup()], join: true });
  assert.equal((await get(env, statR, "/api/order/status?id=" + r.orderId)).j.stage, "waiting_payment");
  const back = await gateway(env, r, "success"); const cb = await postForm(cbR, "/api/payu/callback", back, env); assert.equal(cb.status, 303); assert.match(cb.headers.get("location"), /checkout\.html\?o=SW/);
  const st = await get(env, statR, "/api/order/status?id=" + r.orderId); assert.equal(st.j.state, "SENT_TO_KITCHEN"); assert.equal(st.j.stage, "placed_paid"); assert.equal(st.j.items.length, 2);
  const row = env.raw.prepare("SELECT * FROM orders WHERE id=?").get(r.orderId); assert.equal(row.total_minor, r.totalMinor); assert.equal(env.raw.prepare("SELECT member FROM customers WHERE phone=?").get(r.phone).member, 1);
  assert.equal(env.raw.prepare("SELECT COUNT(*) n FROM handoffs WHERE order_id=?").get(r.orderId).n, 1);
  assert.equal(row.points_to_earn, Math.floor(row.subtotal_minor / 100));   // member (joined at checkout) earns; counted from subtotal before tax
});
test("PayU mock: duplicate callback and webhook change state once, one handoff", async () => {
  const env = env0(); const r = await payuOrder(env); const back = await gateway(env, r, "success");
  await postForm(cbR, "/api/payu/callback", back, env); await postForm(cbR, "/api/payu/callback", back, env);
  const w = await postForm(whR, "/api/payu/webhook", back, env); assert.equal((await w.json()).ok, true);
  assert.equal(env.raw.prepare("SELECT COUNT(*) n FROM handoffs WHERE order_id=?").get(r.orderId).n, 1);
  assert.equal(env.raw.prepare("SELECT COUNT(*) n FROM events WHERE order_id=? AND kind='state' AND data LIKE '%PAID%'").get(r.orderId).n, 1);
  assert.equal(env.raw.prepare("SELECT COUNT(*) n FROM payments WHERE order_id=? AND provider='site'").get(r.orderId).n, 1);
});
test("PayU mock: failure and cancel -> PAYMENT_FAILED, no kitchen", async () => {
  for (const res of ["failure", "cancel"]) { const env = env0(); const r = await payuOrder(env); const back = await gateway(env, r, res); await postForm(cbR, "/api/payu/callback", back, env);
    const st = await get(env, statR, "/api/order/status?id=" + r.orderId); assert.equal(st.j.state, "PAYMENT_FAILED"); assert.equal(env.raw.prepare("SELECT COUNT(*) n FROM handoffs WHERE order_id=?").get(r.orderId).n, 0); }
});
test("PayU: wrong hash rejected, order stays pending (never shows paid)", async () => {
  const env = env0(); const r = await payuOrder(env); const back = await gateway(env, r, "success"); back.hash = back.hash.replace(/.$/, c => (c === "a" ? "b" : "a"));
  await postForm(cbR, "/api/payu/callback", back, env); assert.equal((await get(env, statR, "/api/order/status?id=" + r.orderId)).j.state, "PAYMENT_PENDING");
  const forged = { ...back, hash: "" }; await postForm(cbR, "/api/payu/callback", forged, env); assert.equal((await get(env, statR, "/api/order/status?id=" + r.orderId)).j.stage, "waiting_payment");
});
test("PayU: forged callback with no gateway record is not accepted (server-side verify)", async () => {
  const env = env0(); const r = await payuOrder(env); const f = r.redirect.fields; const fake = { key: MOCK.key, txnid: f.txnid, amount: f.amount, productinfo: f.productinfo, firstname: f.firstname, email: f.email, status: "success", mihpayid: "X" };
  fake.hash = await responseHash(fake, MOCK.key, MOCK.salt);   // valid hash, but the gateway never charged
  await postForm(cbR, "/api/payu/callback", fake, env); assert.equal((await get(env, statR, "/api/order/status?id=" + r.orderId)).j.state, "PAYMENT_PENDING");
});
test("PayU: amount tampering -> REFUND_NEEDED, flagged, no handoff", async () => {
  const env = env0(); const r = await payuOrder(env); const back = await gateway(env, r, "success", { amt_override: "100" });   // gateway charged Rs 1.00
  await postForm(cbR, "/api/payu/callback", back, env); const st = await get(env, statR, "/api/order/status?id=" + r.orderId);
  assert.equal(st.j.state, "REFUND_NEEDED"); assert.equal(env.raw.prepare("SELECT flag FROM orders WHERE id=?").get(r.orderId).flag, "AMOUNT_MISMATCH"); assert.equal(env.raw.prepare("SELECT COUNT(*) n FROM handoffs WHERE order_id=?").get(r.orderId).n, 0);
  assert.ok(env.raw.prepare("SELECT COUNT(*) n FROM events WHERE order_id=? AND kind='alert'").get(r.orderId).n >= 1);
});
test("PayU: unpaid orders expire after 30 minutes; late payment goes to REFUND_NEEDED", async () => {
  const env = env0(); const r = await payuOrder(env); env.TEST_NOW_MS = String(T0 + 31 * 60000);
  assert.equal((await get(env, statR, "/api/order/status?id=" + r.orderId)).j.state, "EXPIRED"); assert.equal((await get(env, statR, "/api/order/status?id=" + r.orderId)).j.stage, "expired");
  const back = await gateway(env, r, "success"); await postForm(cbR, "/api/payu/callback", back, env); assert.equal((await get(env, statR, "/api/order/status?id=" + r.orderId)).j.state, "REFUND_NEEDED");
});
test("order lookup by phone + OTP only returns that phone's orders", async () => {
  const env = env0(); const a = await login(env); await call(env, startR, "/api/checkout/start", body(a.token, [soup()])); const b = await login(env); await call(env, startR, "/api/checkout/start", body(b.token, [soup()]));
  const lk = await login(env, a.phone, "lookup"); const r = await call(env, lookR, "/api/order/lookup", { token: lk.token }); assert.equal(r.j.orders.length, 1); assert.equal((await call(env, lookR, "/api/order/lookup", { token: a.token })).s, 401);
  assert.equal((await get(env, statR, "/api/order/status?id=BAD")).s, 404);
});
test("state machine rejects illegal moves and a second mover loses", async () => {
  const { cas } = await import("../../functions/_lib/state.js"); const env = env0(); const a = await login(env); const r = await call(env, startR, "/api/checkout/start", body(a.token, [soup()], { method: "payu" }));
  await assert.rejects(() => cas(env.DB, r.j.orderId, "PAYMENT_PENDING", "COMPLETED", 1)); assert.equal(await cas(env.DB, r.j.orderId, "PAYMENT_PENDING", "PAYMENT_FAILED", 1), true); assert.equal(await cas(env.DB, r.j.orderId, "PAYMENT_PENDING", "PAYMENT_FAILED", 1), false);
});
test("loyalty mock: earn credits once only", async () => {
  const { loyalty } = await import("../../functions/_lib/loyalty.js"); const env = env0(); const L = loyalty(env); await L.enrol("9111111111", "A");
  assert.equal((await L.earn("9111111111", "SWX", 100, "pos")).duplicate, undefined); assert.equal((await L.earn("9111111111", "SWX", 100, "api")).duplicate, true); assert.equal(await L.balance("9111111111"), 100);
});
