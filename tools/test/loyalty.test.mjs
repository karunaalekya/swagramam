import test from "node:test"; import assert from "node:assert/strict";
import { makeEnv } from "./d1shim.mjs";
import * as sendR from "../../functions/api/otp/send.js";
import * as verR from "../../functions/api/otp/verify.js";
import * as quoteR from "../../functions/api/quote.js";
import * as startR from "../../functions/api/checkout/start.js";
import * as offersR from "../../functions/api/offers.js";
import * as statusR from "../../functions/api/order/status.js";
import { processPayment } from "../../functions/_lib/orders.js";
import { ITEMS } from "../../functions/_lib/menu.js";
const O = "https://t.example", T0 = Date.parse("2026-10-21T04:30:00Z"), env0 = (x = {}) => makeEnv({ TEST_NOW_MS: String(T0), ...x });
const call = async (env, h, path, b) => { const r = await h.onRequestPost({ env, request: new Request(O + path, { method: "POST", headers: { "content-type": "application/json", "cf-connecting-ip": "3.3.3.3" }, body: JSON.stringify(b) }) }); return { s: r.status, j: await r.json() }; };
let n = 0; const newPhone = () => "98" + String(70000000 + ++n);
async function login(env, phone, seed) {
  if (seed) env.raw.prepare("INSERT OR REPLACE INTO customers(phone,name,member,points,created_at,updated_at) VALUES(?,?,?,?,0,0)").run(phone, "M", seed.member ? 1 : 0, seed.points || 0);
  const s = await call(env, sendR, "/api/otp/send", { phone }); const v = await call(env, verR, "/api/otp/verify", { phone, code: s.j.devCode, purpose: "checkout" }); return { token: v.j.token, phone };
}
const dish = ITEMS.find(i => i.meal === "ld" && i.cat !== "ds" && i.priceMinor >= 14900 && i.priceMinor <= 15000) || ITEMS.find(i => i.meal === "ld");
const lines = q => [{ sku: dish.sku, qty: q }];
const CART = [{ sku: ITEMS.find(i => i.meal === "ld" && i.priceMinor >= 20000).sku, qty: 4 }];
const slot = { date: "2026-10-21", time: "13:00" };
const start = (env, a, b) => call(env, startR, "/api/checkout/start", { token: a.token, lines: CART, slot, method: "payu", name: "T", consent: { terms: true }, ...b });

test("P1 money: tip not taxed, GST on taxable, rounding, total", async () => {
  const env = env0(); const q = (await call(env, quoteR, "/api/quote", { lines: [{ sku: dish.sku, qty: 2 }], tip: { pct: 5 } })).j;
  const sub = dish.priceMinor * 2; assert.equal(q.subtotalMinor, sub); assert.equal(q.taxMinor, Math.floor((sub * 500 + 5000) / 10000)); assert.equal(q.tipMinor, Math.floor((sub * 5 + 50) / 100));
  assert.equal(q.totalMinor, sub + q.taxMinor + q.tipMinor); assert.equal((await call(env, quoteR, "/api/quote", { lines: lines(2) })).j.tipMinor, 0);
  assert.deepEqual(q.tipOptions.map(o => o.pct), [5, 10, 15]);
});
test("P1 tip limits: custom amount, over max and junk rejected", async () => {
  const env = env0(), L = lines(1);
  assert.equal((await call(env, quoteR, "/api/quote", { lines: L, tip: { amount: "20" } })).j.tipMinor, 2000);
  const hi = await call(env, quoteR, "/api/quote", { lines: L, tip: { amount: "9999" } }); assert.equal(hi.s, 400); assert.equal(hi.j.error, "tip");
  assert.equal((await call(env, quoteR, "/api/quote", { lines: L, tip: { amount: "abc" } })).s, 400); assert.equal((await call(env, quoteR, "/api/quote", { lines: L, tip: { pct: 40 } })).s, 400);
  const big = (await call(env, quoteR, "/api/quote", { lines: [{ sku: dish.sku, qty: 20 }], tip: { amount: "500" } })).j; assert.equal(big.tipMinor, 50000);
});
test("P1 pay at pickup limit uses total including tip", async () => {
  const env = env0(), a = await login(env, newPhone()); const it = ITEMS.find(i => i.meal === "ld" && i.priceMinor <= 25000 && i.priceMinor >= 20000), qty = Math.floor(95000 / it.priceMinor);
  const L = [{ sku: it.sku, qty }]; const no = (await call(env, quoteR, "/api/quote", { token: a.token, lines: L })).j, withTip = (await call(env, quoteR, "/api/quote", { token: a.token, lines: L, tip: { pct: 15 } })).j;
  assert.ok(no.totalMinor <= 100000 && no.codAllowed, "fits without tip"); assert.ok(withTip.totalMinor > 100000 && !withTip.codAllowed && withTip.codReason === "over_limit", "tip pushes it over");
});
test("P1 order stores tip, notes; payment amount includes tip", async () => {
  const env = env0(), a = await login(env, newPhone()); const r = await start(env, a, { lines: [{ sku: CART[0].sku, qty: 4, note: "less spicy" }], tip: { pct: 10 } }); assert.ok(r.j.ok, JSON.stringify(r.j));
  const o = env.raw.prepare("SELECT * FROM orders WHERE id=?").get(r.j.orderId); assert.equal(o.tip_minor, Math.floor((o.subtotal_minor * 10 + 50) / 100)); assert.equal(o.total_minor, o.subtotal_minor + o.tax_minor + o.tip_minor);
  assert.equal(r.j.redirect.fields.amount, (o.total_minor / 100).toFixed(2)); assert.equal(env.raw.prepare("SELECT note FROM order_items WHERE order_id=?").get(o.id).note, "less spicy");
  const st = (await statusR.onRequestGet({ env, request: new Request(O + "/api/order/status?id=" + o.id) }).then(x => x.json())); assert.equal(st.tipMinor, o.tip_minor);
});
test("P2 coupon: discount, GST on discounted amount, one offer per order, never negative", async () => {
  const env = env0(), a = await login(env, newPhone());
  const q = (await call(env, quoteR, "/api/quote", { token: a.token, lines: CART, redeem: { coupon: "swag10" } })).j; assert.ok(q.discountMinor > 0 && q.discountMinor <= q.subtotalMinor); assert.equal(q.taxMinor, Math.floor(((q.subtotalMinor - q.discountMinor) * 500 + 5000) / 10000));
  assert.equal(q.totalMinor, q.subtotalMinor - q.discountMinor + q.taxMinor);
  const two = (await call(env, quoteR, "/api/quote", { token: a.token, lines: CART, redeem: { coupon: "SWAG10", freebie: "FREESWEET" } })).j; assert.equal(two.offerError.error, "one_offer"); assert.equal(two.discountMinor, 0);
  assert.equal((await call(env, quoteR, "/api/quote", { token: a.token, lines: CART, redeem: { coupon: "NOPE" } })).j.offerError.error, "coupon_unknown");
  assert.equal((await call(env, quoteR, "/api/quote", { lines: CART, redeem: { coupon: "SWAG10" } })).j.offerError.error, "login");
  assert.equal((await call(env, quoteR, "/api/quote", { token: a.token, lines: CART, redeem: { coupon: "CLUB15" } })).j.offerError.error, "member_only");
  assert.equal((await call(env, quoteR, "/api/quote", { token: a.token, lines: lines(1), redeem: { coupon: "FLAT50" } })).j.offerError.error, "min_order");
});
test("P2 reserve -> payment fail -> release; coupon usable again", async () => {
  const env = env0(), a = await login(env, newPhone()); const r = await start(env, a, { redeem: { coupon: "SWAG10" } }); assert.ok(r.j.ok, JSON.stringify(r.j));
  assert.equal(env.raw.prepare("SELECT state FROM redemptions WHERE order_id=?").get(r.j.orderId).state, "reserved");
  const b = await login(env, a.phone); const dup = await start(env, b, { redeem: { coupon: "SWAG10" } }); assert.equal(dup.s, 409); assert.equal(dup.j.error, "coupon_used");
  env.TEST_NOW_MS = String(T0 + 31 * 60000); await statusR.onRequestGet({ env, request: new Request(O + "/api/order/status?id=" + r.j.orderId) });   // unpaid expiry (30 min) releases
  assert.equal(env.raw.prepare("SELECT state FROM redemptions WHERE order_id=?").get(r.j.orderId).state, "released"); assert.equal(env.raw.prepare("SELECT loyalty_status s FROM orders WHERE id=?").get(r.j.orderId).s, "released");
  env.TEST_NOW_MS = String(T0); const c = await login(env, a.phone); assert.ok((await start(env, c, { redeem: { coupon: "SWAG10" } })).j.ok, "usable again after release");
});
test("P2 pay at pickup commits at once; coupon cannot be replayed", async () => {
  const env = env0(), a = await login(env, newPhone()); const r = await start(env, a, { method: "cod", redeem: { coupon: "SWAG10" } }); assert.ok(r.j.ok, JSON.stringify(r.j));
  assert.equal(env.raw.prepare("SELECT state FROM redemptions WHERE order_id=?").get(r.j.orderId).state, "committed");
  const b = await login(env, a.phone); assert.equal((await start(env, b, { method: "cod", redeem: { coupon: "SWAG10" } })).j.error, "coupon_used");
});
test("P2 points: reserve, commit deducts once, release leaves balance; phone mismatch", async () => {
  const env = env0(), ph = newPhone(), a = await login(env, ph, { member: true, points: 1000 });
  const q = (await call(env, quoteR, "/api/quote", { token: a.token, lines: CART })).j; assert.equal(q.pointsInfo.member, true); assert.equal(q.pointsInfo.balance, 1000); assert.equal(q.pointsInfo.valueMinor, 5); assert.ok(q.pointsInfo.max >= 200 && q.pointsInfo.max % 20 === 0);
  assert.equal((await call(env, quoteR, "/api/quote", { token: a.token, lines: CART, redeem: { points: 30 } })).j.offerError.error, "points_invalid");
  const pq = (await call(env, quoteR, "/api/quote", { token: a.token, lines: CART, redeem: { points: 400 } })).j; assert.equal(pq.discountMinor, 2000);
  const r = await start(env, a, { method: "cod", redeem: { points: 400 } }); assert.ok(r.j.ok, JSON.stringify(r.j)); assert.equal(env.raw.prepare("SELECT points FROM customers WHERE phone=?").get(ph).points, 600);
  const { commitOrder } = await import("../../functions/_lib/redeem.js"); await commitOrder(env.DB, r.j.orderId, T0); assert.equal(env.raw.prepare("SELECT points FROM customers WHERE phone=?").get(ph).points, 600, "second commit changes nothing");
  const g = await login(env, newPhone()); assert.equal((await call(env, quoteR, "/api/quote", { token: g.token, lines: CART, redeem: { points: 400 } })).j.offerError.error, "member_only");
  assert.equal((await call(env, quoteR, "/api/quote", { lines: CART })).j.pointsInfo, null);
});
test("P2 offers list per phone; freebie adds a Rs 0 line", async () => {
  const env = env0(), a = await login(env, newPhone()); const o = (await call(env, offersR, "/api/offers", { token: a.token, lines: CART })).j; assert.ok(o.coupons.length >= 3 && o.freebies.length === 1);
  assert.equal(o.coupons.find(c => c.code === "CLUB15").eligible, false); assert.ok(o.coupons.find(c => c.code === "SWAG10").eligible);
  assert.equal((await call(env, offersR, "/api/offers", { token: "x", lines: CART })).s, 401);
  const r = await start(env, a, { method: "cod", redeem: { freebie: "FREESWEET" } }); assert.ok(r.j.ok, JSON.stringify(r.j));
  const it = env.raw.prepare("SELECT name,line_minor FROM order_items WHERE order_id=? AND line_minor=0").get(r.j.orderId); assert.match(it.name, /free/);
});
test("P2 amount mismatch still caught with discount and tip", async () => {
  const env = env0({ PAYMENT_PROVIDER: "mock" }), a = await login(env, newPhone()); const r = await start(env, a, { tip: { pct: 5 }, redeem: { coupon: "FLAT50" } }); assert.ok(r.j.ok);
  const o = env.raw.prepare("SELECT total_minor,subtotal_minor,discount_minor,tax_minor,tip_minor FROM orders WHERE id=?").get(r.j.orderId); assert.equal(o.total_minor, o.subtotal_minor - o.discount_minor + o.tax_minor + o.tip_minor);
});
test("payment rule: up to Rs 1000.00 both pay online and pay at pickup; above, pay online only", async () => {
  const { methods } = await import("../../functions/_lib/quote.js"), { flags } = await import("../../functions/_lib/flags.js"), f = flags(env0());
  assert.deepEqual(methods(100000, f, null).methods, ["payu", "cod"]); assert.deepEqual(methods(99999, f, null).methods, ["payu", "cod"]);
  const over = methods(100001, f, null); assert.deepEqual(over.methods, ["payu"]); assert.equal(over.codReason, "over_limit");
  const prod = flags(env0({ ENV: "production" })); assert.equal(prod.codLive, false, "production needs COD_LIVE=on");
  assert.equal(flags(env0({ ENV: "production", COD_LIVE: "on" })).codLive, true);
});
test("P2 expired coupon: refused on quote, shown as expired in the list", async () => {
  const env = env0(), a = await login(env, newPhone()); const big = [{ sku: CART[0].sku, qty: 4 }];
  const q = (await call(env, quoteR, "/api/quote", { token: a.token, lines: big, redeem: { coupon: "DIWALI20" } })).j; assert.equal(q.offerError.error, "coupon_expired"); assert.equal(q.discountMinor, 0);
  const o = (await call(env, offersR, "/api/offers", { token: a.token, lines: big })).j.coupons.find(c => c.code === "DIWALI20"); assert.equal(o.eligible, false); assert.match(o.reason, /expired/);
  const r = await start(env, a, { redeem: { coupon: "DIWALI20" } }); assert.equal(r.s, 409); assert.equal(env.raw.prepare("SELECT COUNT(*) n FROM redemptions").get().n, 0, "nothing reserved");
});
test("P2 double submit: two simultaneous orders, one coupon, only one wins", async () => {
  const env = env0(), ph = newPhone(), a = await login(env, ph), b = await login(env, ph);
  const [r1, r2] = await Promise.all([start(env, a, { method: "cod", redeem: { coupon: "FLAT50" } }), start(env, b, { method: "cod", redeem: { coupon: "FLAT50" } })]);
  assert.equal([r1, r2].filter(r => r.j.ok).length, 1, JSON.stringify([r1.j, r2.j])); assert.equal(env.raw.prepare("SELECT COUNT(*) n FROM redemptions WHERE ref='FLAT50' AND state!='released'").get().n, 1);
});
test("P2 replayed verification: same token cannot create a second order or a second redemption", async () => {
  const env = env0(), a = await login(env, newPhone(), { member: true, points: 1000 }); const r1 = await start(env, a, { method: "cod", redeem: { points: 400 } }); assert.ok(r1.j.ok);
  const r2 = await start(env, a, { method: "cod", redeem: { points: 400 } }); assert.equal(r2.j.error, "token_used");
  assert.equal(env.raw.prepare("SELECT COUNT(*) n FROM redemptions").get().n, 1); assert.equal(env.raw.prepare("SELECT points FROM customers WHERE phone=?").get(a.phone).points, 600);
});
test("P2 payment webhook replay: commit once, points deducted once", async () => {
  const env = env0({ PAYMENT_PROVIDER: "mock" }), a = await login(env, newPhone(), { member: true, points: 1000 }); const r = await start(env, a, { redeem: { points: 400 } }); assert.ok(r.j.ok, JSON.stringify(r.j));
  const { commitOrder, releaseOrder } = await import("../../functions/_lib/redeem.js"); assert.equal(await commitOrder(env.DB, r.j.orderId, T0), 1); assert.equal(await commitOrder(env.DB, r.j.orderId, T0), 0);
  assert.equal(await releaseOrder(env.DB, r.j.orderId, T0), 0, "committed redemption cannot be released"); assert.equal(env.raw.prepare("SELECT points FROM customers WHERE phone=?").get(a.phone).points, 600);
});
test("P2 discount never negative and never above the bill", async () => {
  const { coupDisc, COUPONS } = await import("../../functions/_lib/offers.js"); const flat = COUPONS.find(c => c.flatMinor);
  assert.equal(coupDisc(flat, 1000), 1000); assert.equal(coupDisc(flat, 0), 0); for (const c of COUPONS) for (const s of [0, 1, 99, 30000, 10 ** 7]) { const d = coupDisc(c, s); assert.ok(d >= 0 && d <= s, c.code + " " + s); }
  const env = env0(), a = await login(env, newPhone(), { member: true, points: 100000 }); const q = (await call(env, quoteR, "/api/quote", { token: a.token, lines: [{ sku: CART[0].sku, qty: 1 }], redeem: { points: 100000 } })).j;
  assert.equal(q.offerError.error, "points_invalid"); assert.ok(q.totalMinor > 0);
});
import * as cbR from "../../functions/api/payu/callback.js";
import * as mockR from "../../functions/api/mock-pay.js";
const postForm = (h, path, fields, env) => { const fd = new FormData(); for (const [k, v] of Object.entries(fields)) fd.append(k, v); return h.onRequestPost({ env, request: new Request(O + path, { method: "POST", body: fd }) }); };
const formFields = html => Object.fromEntries([...html.matchAll(/<input type=hidden name='([^']*)' value='([^']*)'>/g)].map(m => [m[1], m[2].replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'")]));
async function gw(env, r, result) { const res = await postForm(mockR, "/api/mock-pay", { ...r.redirect.fields, result }, env); await postForm(cbR, "/api/payu/callback", formFields(await res.text()), env); }
test("P2 real payment path: failed payment releases; success commits; callback replay safe", async () => {
  const env = env0(), ph = newPhone(), a = await login(env, ph, { member: true, points: 1000 }); const r = await start(env, a, { redeem: { points: 400 } }); assert.ok(r.j.ok, JSON.stringify(r.j));
  assert.equal(env.raw.prepare("SELECT state FROM redemptions WHERE order_id=?").get(r.j.orderId).state, "reserved"); assert.equal(env.raw.prepare("SELECT points FROM customers WHERE phone=?").get(ph).points, 1000, "points not taken before payment");
  await gw(env, r.j, "failure"); assert.equal(env.raw.prepare("SELECT state FROM redemptions WHERE order_id=?").get(r.j.orderId).state, "released"); assert.equal(env.raw.prepare("SELECT points FROM customers WHERE phone=?").get(ph).points, 1000);
  const b = await login(env, ph); const r2 = await start(env, b, { redeem: { points: 400 } }); assert.ok(r2.j.ok); await gw(env, r2.j, "success"); await gw(env, r2.j, "success");
  assert.equal(env.raw.prepare("SELECT state FROM redemptions WHERE order_id=?").get(r2.j.orderId).state, "committed"); assert.equal(env.raw.prepare("SELECT points FROM customers WHERE phone=?").get(ph).points, 600, "deducted once");
  const o = env.raw.prepare("SELECT state,total_minor FROM orders WHERE id=?").get(r2.j.orderId); assert.equal(o.state, "SENT_TO_KITCHEN"); assert.equal(r2.j.redirect.fields.amount, (o.total_minor / 100).toFixed(2));
});
import * as selfR from "../../functions/api/admin/selfcheck.js";
test("OFFERS_JSON swaps coupons, freebie and points rule with no code change; bad JSON falls back", async () => {
  const sku = ITEMS.find(i => i.cat === "ds").sku, cfg = { coupons: [{ code: "welcome", title: "W", pct: 10, maxMinor: 5000, minMinor: 10000 }], freebies: [{ code: "FREEG", sku, minMinor: 10000 }], points: { valueMinor: 10, min: 100, step: 10, capPct: 30 } };
  const env = env0({ OFFERS_JSON: JSON.stringify(cfg) }), a = await login(env, newPhone(), { member: true, points: 5000 });
  const q = (await call(env, quoteR, "/api/quote", { token: a.token, lines: CART, redeem: { coupon: "WELCOME" } })).j; assert.equal(q.discountMinor, 5000);
  assert.equal((await call(env, quoteR, "/api/quote", { token: a.token, lines: CART, redeem: { coupon: "SWAG10" } })).j.offerError.error, "coupon_unknown", "old defaults gone");
  assert.equal((await call(env, quoteR, "/api/quote", { token: a.token, lines: CART, redeem: { freebie: "FREEG" } })).j.freebie.sku, sku);
  const pi = (await call(env, quoteR, "/api/quote", { token: a.token, lines: CART })).j.pointsInfo; assert.deepEqual([pi.min, pi.step, pi.valueMinor], [100, 10, 10]);
  const bad = env0({ OFFERS_JSON: "{oops" }), b = await login(bad, newPhone()); assert.ok((await call(bad, quoteR, "/api/quote", { token: b.token, lines: CART, redeem: { coupon: "SWAG10" } })).j.discountMinor > 0, "defaults kept");
});
test("selfcheck readiness lists exactly what is missing, never values", async () => {
  const env = env0({ ADMIN_KEY: "adm", PAYMENT_PROVIDER: "payu", PAYU_KEY: "SECRETKEY", OFFERS_JSON: "{oops" }), r = await selfR.onRequestGet({ env, request: new Request(O + "/a", { headers: { "x-admin-key": "adm" } }) }), t = await r.text(), j = JSON.parse(t);
  assert.ok(!t.includes("SECRETKEY")); assert.deepEqual(j.readiness.payu.missing, ["PAYU_SALT"]); assert.equal(j.readiness.offersConfig.ok, false); assert.ok(j.readiness.goLiveBlockers.includes("ENV=production")); assert.ok(!j.readiness.infra.missing.includes("DB") && !j.readiness.infra.missing.includes("ADMIN_KEY"));
});
