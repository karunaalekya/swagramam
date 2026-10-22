// PayU hosted checkout (hash formulas checked against docs.payu.in on 22 Oct 2026).
// Request hash:  sha512(key|txnid|amount|productinfo|firstname|email|udf1|udf2|udf3|udf4|udf5||||||SALT)
// Response hash: sha512([additionalCharges|]SALT|status||||||udf5|udf4|udf3|udf2|udf1|email|firstname|productinfo|amount|txnid|key)
import { flags } from "./flags.js";
import { sha512, nowMs } from "./util.js";
import { rupees, minorFromAmount } from "./money.js";
export const MOCK = { key: "mockkey", salt: "mocksalt" };
export function creds(env) { const f = flags(env); return f.payment === "payu" ? { key: env.PAYU_KEY, salt: env.PAYU_SALT } : MOCK; }
const udfs = p => [1, 2, 3, 4, 5].map(i => p["udf" + i] || "");
export const requestHash = (p, key, salt) => sha512([key, p.txnid, p.amount, p.productinfo, p.firstname, p.email, ...udfs(p)].join("|") + "||||||" + salt);
export function responseHash(p, key, salt) {
  const u = udfs(p).reverse();
  const core = [salt, p.status, "", "", "", "", "", ...u, p.email, p.firstname, p.productinfo, p.amount, p.txnid, key].join("|");
  return sha512((p.additionalCharges ? p.additionalCharges + "|" : "") + core);
}
const URLS = { test: "https://test.payu.in/_payment", live: "https://secure.payu.in/_payment" };
const VERIFY = { test: "https://test.payu.in/merchant/postservice?form=2", live: "https://info.payu.in/merchant/postservice.php?form=2" };
export async function buildRequest(env, order, origin) {
  const f = flags(env), c = creds(env);
  const p = { key: c.key, txnid: order.id, amount: rupees(order.total_minor), productinfo: "Swagramam take away " + order.id,
    firstname: (order.name || "Guest").slice(0, 40), email: order.email || "orders@swagramam.in", phone: order.phone,
    surl: origin + "/api/payu/callback", furl: origin + "/api/payu/callback" };
  p.hash = await requestHash(p, c.key, c.salt);
  const url = f.payment === "payu" ? URLS[env.PAYU_ENV === "live" ? "live" : "test"] : origin + "/api/mock-pay";
  return { url, method: "POST", fields: p };
}
// Server-side confirmation. Never trust the browser callback alone. Returns {found, status, amountMinor, mihpayid}.
export async function verifyPayment(env, txnid) {
  const f = flags(env);
  if (f.payment !== "payu") {   // mock gateway: what the mock gateway recorded for this txn
    const r = await env.DB.prepare("SELECT status, amount_minor, mihpayid FROM payments WHERE txnid=? AND provider='mock-gateway' ORDER BY id DESC LIMIT 1").bind(txnid).first();
    return r ? { found: true, status: r.status, amountMinor: r.amount_minor, mihpayid: r.mihpayid } : { found: false };
  }
  const c = creds(env), cmd = "verify_payment", hash = await sha512([c.key, cmd, txnid, c.salt].join("|"));
  const res = await fetch(VERIFY[env.PAYU_ENV === "live" ? "live" : "test"], { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ key: c.key, command: cmd, var1: txnid, hash }) });
  let j; try { j = await res.json(); } catch { return { found: false }; }
  const d = j && j.transaction_details && j.transaction_details[txnid];
  if (!d) return { found: false };
  return { found: true, status: String(d.status || "").toLowerCase(), amountMinor: minorFromAmount(d.amt || d.amount), mihpayid: d.mihpayid };
}
