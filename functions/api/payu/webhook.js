import { processPayment } from "../../_lib/orders.js";
import { json } from "../../_lib/util.js";
// Server-to-server notification. Same processing as the callback; safe if both arrive.
export async function onRequestPost({ env, request }) {
  let p = {}; const ct = request.headers.get("content-type") || "";
  try { if (ct.includes("json")) p = await request.json(); else { const fd = await request.formData(); for (const [k, v] of fd.entries()) p[k] = String(v); } } catch {}
  const r = await processPayment(env, p);
  return json({ ok: r.ok, reason: r.reason }, 200);
}
