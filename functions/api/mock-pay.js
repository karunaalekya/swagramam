import { flags } from "../_lib/flags.js";
import { MOCK, responseHash, requestHash } from "../_lib/payu.js";
import { nowMs } from "../_lib/util.js";
import { minorFromAmount } from "../_lib/money.js";
const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const page = (b, script = "") => new Response("<!doctype html><meta charset=utf-8><meta name=robots content=noindex><meta name=viewport content='width=device-width,initial-scale=1'><title>Test payment</title><style>body{font:16px system-ui;background:#F8F4E8;margin:0;display:grid;place-items:center;min-height:100vh}main{background:#fff;border:2px dashed #DFA92E;border-radius:16px;padding:24px;max-width:380px;margin:16px}button{display:block;width:100%;margin:8px 0;padding:14px;border-radius:999px;border:0;font:700 16px system-ui;cursor:pointer}.s{background:#174A32;color:#fff}.f{background:#8B5635;color:#fff}.c{background:#eee}</style><main>" + b + "</main>" + script, { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } });
const off = env => { const f = flags(env); return f.prod || f.payment !== "mock"; };
export async function onRequestGet({ env }) { return off(env) ? new Response("Not found", { status: 404 }) : page("<p><b>TEST PAYMENT (mock gateway)</b></p><p>Start from the checkout page.</p>"); }
// Mock gateway: stands in for PayU on demo and staging only. No money moves. Behaves like PayU: takes the hashed request, shows a pay page,
// records what it "charged", then posts a hashed response to surl, exactly as PayU does.
export async function onRequestPost({ env, request }) {
  if (off(env)) return new Response("Not found", { status: 404 });
  const fd = await request.formData(), p = {}; for (const [k, v] of fd.entries()) p[k] = String(v);
  if (p.hash !== (await requestHash(p, MOCK.key, MOCK.salt)) || p.key !== MOCK.key) return new Response("Bad request hash", { status: 400 });
  const result = ["success", "failure", "cancel"].includes(p.result) ? p.result : null;
  if (!result) {
    const hid = Object.entries(p).map(([k, v]) => "<input type=hidden name='" + esc(k) + "' value='" + esc(v) + "'>").join("");
    const btn = (r, c, t) => "<form method=post action=/api/mock-pay>" + hid + "<input type=hidden name=result value=" + r + "><button class=" + c + ">" + t + "</button></form>";
    return page("<p><b>TEST PAYMENT (mock gateway)</b><br>No money moves.</p><p>Order <b>" + esc(p.txnid) + "</b><br>Amount <b>Rs " + esc(p.amount) + "</b></p>" + btn("success", "s", "Pay (success)") + btn("failure", "f", "Fail the payment") + btn("cancel", "c", "Cancel and go back"));
  }
  const status = result === "success" ? "success" : "failure", t = nowMs(env), mih = "MOCK" + t;
  const charged = p.amt_override && /^\d+$/.test(p.amt_override) ? +p.amt_override : minorFromAmount(p.amount);   // amt_override exists only for the tamper test
  await env.DB.prepare("INSERT INTO payments(order_id,provider,txnid,status,amount_minor,mihpayid,ts) VALUES(?,?,?,?,?,?,?)").bind(p.txnid, "mock-gateway", p.txnid, status, charged, mih, t).run();
  const back = { key: MOCK.key, txnid: p.txnid, amount: p.amount, productinfo: p.productinfo, firstname: p.firstname, email: p.email, status, mihpayid: mih, unmappedstatus: result };
  back.hash = await responseHash(back, MOCK.key, MOCK.salt);
  const hid = Object.entries(back).map(([k, v]) => "<input type=hidden name='" + esc(k) + "' value='" + esc(v) + "'>").join("");
  return page("<p>Returning to Swagramam...</p><form id=f method=post action='/api/payu/callback'>" + hid + "<button class=s>Continue</button></form>", "<script>document.getElementById('f').submit()</script>");
}
