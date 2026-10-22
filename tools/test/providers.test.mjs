import test from "node:test"; import assert from "node:assert/strict";
import { makeEnv } from "./d1shim.mjs";
import * as sendR from "../../functions/api/otp/send.js";
import * as verR from "../../functions/api/otp/verify.js";
import * as startR from "../../functions/api/checkout/start.js";
import * as healthR from "../../functions/api/health.js";
import * as selfR from "../../functions/api/admin/selfcheck.js";
import * as vend from "../../functions/v1/pos/integrations/[vendor]/verify.js";
import * as vend2 from "../../functions/api/reelo/verify.js";
import { loyalty } from "../../functions/_lib/loyalty.js";
import { ITEMS } from "../../functions/_lib/menu.js";
const O = "https://t.example", T0 = Date.parse("2026-10-21T04:30:00Z");
const REELO = { REELO_BASE_URL: "https://reelo.test", REELO_VENDOR_ID: "VEN-1", REELO_MERCHANT_ID: "MER-1", REELO_CUSTOMER_KEY: "CK-1", REELO_RETRY_MS: "1,1", LOYALTY_PROVIDER: "reelo" };
const env0 = (x = {}) => makeEnv({ TEST_NOW_MS: String(T0), ...x });
const J = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { "content-type": "application/json" } });
const real = globalThis.fetch; let calls = [];
const mockFetch = fn => { calls = []; globalThis.fetch = async (u, o) => { calls.push({ u: String(u), o, body: o && o.body ? JSON.parse(o.body) : null }); return fn(String(u), o, calls.length); }; };
test.afterEach(() => { globalThis.fetch = real; });
const post = (h, path, b, env, ip = "2.2.2.2") => h.onRequestPost({ env, request: new Request(O + path, { method: "POST", headers: { "content-type": "application/json", "cf-connecting-ip": ip }, body: JSON.stringify(b) }) }).then(async r => ({ s: r.status, j: await r.json() }));
async function mkOrder(env, phone = "9111111111") {
  env.OTP_PROVIDER = "mock"; const s = await post(sendR, "/api/otp/send", { phone }, env), v = await post(verR, "/api/otp/verify", { phone, code: s.j.devCode, purpose: "checkout" }, env);
  const it = ITEMS.find(i => i.meal === "ld");
  const r = await post(startR, "/api/checkout/start", { token: v.j.token, lines: [{ sku: it.sku, qty: 2 }], slot: { date: "2026-10-21", time: "13:00" }, method: "cod", name: "Test Guest", consent: { terms: true } }, env); assert.ok(r.j.ok, JSON.stringify(r.j)); return { id: r.j.orderId, phone, it };
}

test("msg91: sends our code, hides it from the response, fails cleanly", async () => {
  const env = env0({ OTP_PROVIDER: "msg91", MSG91_AUTHKEY: "AK", MSG91_TEMPLATE_ID: "TPL" });
  mockFetch(() => J({ type: "success", request_id: "r1" }));
  const s = await post(sendR, "/api/otp/send", { phone: "9222222222" }, env); assert.ok(s.j.ok); assert.equal(s.j.devCode, undefined);
  const c = calls[0]; assert.match(c.u, /^https:\/\/control\.msg91\.com\/api\/v5\/otp\?/); assert.ok(c.u.includes("mobile=919222222222") && c.u.includes("template_id=TPL")); assert.equal(c.o.headers.authkey, "AK");
  const code = new URL(c.u).searchParams.get("otp"); assert.match(code, /^\d{6}$/);
  const v = await post(verR, "/api/otp/verify", { phone: "9222222222", code, purpose: "checkout" }, env); assert.ok(v.j.ok && v.j.token);
  mockFetch(() => J({ type: "error", message: "DLT" }, 400));   // gateway rejects: no stuck resend lock, clear message
  const f = await post(sendR, "/api/otp/send", { phone: "9333333333" }, env); assert.equal(f.s, 502); assert.equal(f.j.error, "sms_failed");
  mockFetch(() => J({ type: "success" })); assert.ok((await post(sendR, "/api/otp/send", { phone: "9333333333" }, env)).j.ok);
});
test("msg91 production: works with prod flags, no devCode ever", async () => {
  const env = env0({ ENV: "production", ONLINE_ORDER_LIVE: "true", TOKEN_SECRET: "x", OTP_PROVIDER: "msg91", PAYMENT_PROVIDER: "payu", PAYU_KEY: "k", PAYU_SALT: "s", MSG91_AUTHKEY: "AK", MSG91_TEMPLATE_ID: "T" });
  assert.equal((await healthR.onRequestGet({ env }).then(r => r.json())).live, true);
  mockFetch(() => J({ type: "success" })); const s = await post(sendR, "/api/otp/send", { phone: "9444444444" }, env); assert.ok(s.j.ok); assert.equal(s.j.devCode, undefined);
  const miss = env0({ ENV: "production", ONLINE_ORDER_LIVE: "true", TOKEN_SECRET: "x", OTP_PROVIDER: "msg91", PAYMENT_PROVIDER: "payu", PAYU_KEY: "k", PAYU_SALT: "s" }); assert.equal((await healthR.onRequestGet({ env: miss }).then(r => r.json())).live, false);
});
test("reelo earn: capture off by default (POS path, no double credit)", async () => {
  const env = env0(REELO); const o = await mkOrder(env); mockFetch(() => J({}));
  const r = await loyalty(env).earn(o.phone, o.id, 5, "api"); assert.equal(r.skipped, "reelo_capture_off"); assert.equal(calls.length, 0);
});
test("reelo earn: bill shape, idempotent, retries, already-exists", async () => {
  const env = env0({ ...REELO, REELO_CAPTURE: "on" }); const o = await mkOrder(env);
  mockFetch((u, _o, n) => n === 1 ? J({ status_code: 500, message: "Unable to process the request" }, 500) : J({ status_code: 200, correlationId: "cid-9", response: { message: "ok" } }));
  const r = await loyalty(env).earn(o.phone, o.id, 5, "api"); assert.ok(r.ok, JSON.stringify(r)); assert.equal(calls.length, 2, "one retry after 500");
  const b = calls[1].body, t = b.transaction; assert.equal(calls[1].u, "https://reelo.test/v1/pos/integrations/VEN-1/bill/customer");
  assert.equal(b.customer.mobile, "91" + o.phone); assert.equal(b.merchant_id, "MER-1"); assert.equal(b.customer_key, "CK-1");
  assert.equal(t.id, o.id); assert.equal(t.order_from, "own_website"); assert.equal(t.type, "take_away"); assert.equal(t.items[0].id, o.it.sku); assert.equal(t.items[0].quantity, 2);
  const sub = o.it.priceMinor * 2 / 100; assert.equal(t.gross_amount, sub); assert.equal(t.net_amount, +(sub * 1.05).toFixed(2)); assert.match(t.order_time, /^2026-10-21 13:00:00$/);
  assert.equal((await loyalty(env).earn(o.phone, o.id, 5, "api")).duplicate, true); assert.equal(calls.length, 2, "second earn sends nothing");
  const ev = env.raw.prepare("SELECT data FROM events WHERE kind='reelo_call'").all(); assert.ok(ev.some(e => e.data.includes("cid-9")), "correlationId logged");
  const o2 = await mkOrder(env, "9555555555"); mockFetch(() => J({ status_code: 400, message: "Transaction already exists" }, 400));
  const d = await loyalty(env).earn(o2.phone, o2.id, 5, "api"); assert.ok(d.ok && d.duplicate);
  const o3 = await mkOrder(env, "9666666666"); mockFetch(() => J({ status_code: 503, message: "x" }, 503));
  const bad = await loyalty(env).earn(o3.phone, o3.id, 5, "api"); assert.equal(bad.ok, false); assert.equal(calls.length, 3, "3 attempts max");
  mockFetch(() => J({ status_code: 200 })); assert.ok((await loyalty(env).earn(o3.phone, o3.id, 5, "api")).ok, "failed earn can be retried later");
});
test("reelo lookup: 10 digits, not-found is normal, errors do not throw", async () => {
  const env = env0(REELO); mockFetch(() => J({ status_code: 200, response: { loyalty_points: 120, allow_redemption_today: true, coupons: [{ coupon_code: "C1" }] } }));
  const a = await loyalty(env).lookup("9777777777"); assert.equal(a.points, 120); assert.equal(a.coupons.length, 1); assert.equal(calls[0].body.customer_mobile, "9777777777");
  mockFetch(() => J({ status_code: 400, response: { message: "Customer not found" } }, 400)); const b = await loyalty(env).lookup("9777777778"); assert.equal(b.points, 0); assert.equal(b.error, undefined);
  mockFetch(() => { throw new Error("down"); }); const c = await loyalty(env).lookup("9777777779"); assert.equal(c.points, null); assert.ok(c.error);
  mockFetch(() => J({ status_code: 200, response: { loyalty_points: 40 } })); const v = await post(verR, "/api/otp/verify", { phone: "9888888888", code: "x" }, env); assert.equal(v.s, 400);
});
test("reelo enrol is local only; redemption and menu calls shaped right", async () => {
  const env = env0(REELO); mockFetch(() => J({ status_code: 200, response: {} })); const l = loyalty(env);
  assert.ok((await l.enrol("9101010101", "Ravi")).ok); assert.equal(calls.length, 0);
  await l.reserveRedemption("9101010101", { couponCode: "C1" }); assert.ok(calls[0].u.endsWith("/points/authenticate")); assert.equal(calls[0].body.coupon_code, "C1");
  await l.commit("9101010101", { couponCode: "C1", otp: "4191" }); assert.ok(calls[1].u.endsWith("/redeem/coupon")); assert.equal(calls[1].body.otp, "4191");
  const m = await l.pushMenu(); assert.equal(m.count, 99); const it = calls[2].body.items; assert.equal(it.length, 99); assert.match(it[0].price, /^\d+\.0000$/); assert.equal(new Set(it.map(x => x.id)).size, 99);
  assert.equal((await l.release()).unsupported, true);
});
test("reelo missing config: clear error, no crash", async () => {
  const env = env0({ LOYALTY_PROVIDER: "reelo" }); mockFetch(() => J({})); const r = await loyalty(env).lookup("9202020202"); assert.ok(r.error); assert.equal(calls.length, 0);
});
test("verify endpoint (Reelo onboarding): sample shape, secrets checked", async () => {
  const env = env0(REELO), req = (b) => new Request(O + "/x", { method: "POST", body: JSON.stringify(b) });
  const ok = await vend.onRequestPost({ env, request: req({ merchant_id: "MER-1" }), params: { vendor: "VEN-1" } }); const j = await ok.json();
  assert.equal(ok.status, 200); assert.deepEqual(j, { status: true, message: "Merchant verified", data: { merchant_id: "MER-1", customer_key: "CK-1" } });
  assert.equal((await vend.onRequestPost({ env, request: req({ merchant_id: "MER-1" }), params: { vendor: "WRONG" } })).status, 404);
  assert.equal((await vend2.onRequestPost({ env, request: req({ merchant_id: "nope" }) })).status, 404);
  assert.equal((await vend2.onRequestPost({ env: env0({}), request: req({ merchant_id: "MER-1" }) })).status, 503);
});
test("selfcheck: needs ADMIN_KEY, shows presence only", async () => {
  const env = env0({ ...REELO, ADMIN_KEY: "adm", PAYMENT_PROVIDER: "payu", PAYU_KEY: "KEYSECRET", PAYU_SALT: "s" });
  assert.equal((await selfR.onRequestGet({ env, request: new Request(O + "/a") })).status, 404);
  const r = await selfR.onRequestGet({ env, request: new Request(O + "/a", { headers: { "x-admin-key": "adm" } }) }), t = await r.text();
  assert.ok(!t.includes("KEYSECRET") && !t.includes("CK-1")); const j = JSON.parse(t); assert.equal(j.present.PAYU_KEY, true); assert.ok(j.warnings.some(w => /REELO_CAPTURE/.test(w)));
});
