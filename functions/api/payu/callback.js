import { processPayment } from "../../_lib/orders.js";
// PayU (or the mock gateway) posts the customer's browser here. We never trust it alone: hash check, then server-side verify, then amount check.
export async function onRequestPost({ env, request }) {
  let p = {}; try { const fd = await request.formData(); for (const [k, v] of fd.entries()) p[k] = String(v); } catch {}
  const r = await processPayment(env, p);
  const id = r.id || p.txnid || "";
  return Response.redirect(new URL("/checkout.html?o=" + encodeURIComponent(id), request.url).toString(), 303);
}
