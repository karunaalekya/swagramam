import { json, fail, readJson, nowMs, normPhone } from "../_lib/util.js";
import { flags } from "../_lib/flags.js";
import { quote, methods } from "../_lib/quote.js";
import { checkSlot } from "../_lib/slots.js";
import { readToken } from "../_lib/otp.js";
import { phoneInfo } from "../_lib/orders.js";
// POST {lines:[{sku,qty}], slot:{date,time}?, token?}. Re-prices from the server menu.
export async function onRequestPost({ env, request }) {
  const b = await readJson(request); if (!b) return fail("body", "Bad request.");
  const f = flags(env); let meal = null, slotMsg = null;
  if (b.slot && b.slot.date && b.slot.time) { const s = checkSlot(b.slot.date, b.slot.time, nowMs(env), f); if (s.ok) meal = s.meal; else slotMsg = s.reason; }
  const q = quote(b.lines, f, meal); if (!q.ok) return fail(q.error, q.message, 400, { sku: q.sku });
  let info = null; if (b.token) { const t = await readToken(env, b.token, "checkout"); if (t) info = await phoneInfo(env, t.p); }
  const m = methods(q.totalMinor, f, info);
  return json({ ok: true, ...q, slotMessage: slotMsg, methods: m.methods, codReason: m.codReason, codAllowed: m.methods.includes("cod"), member: info ? info.member : null });
}
