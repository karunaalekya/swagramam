import { BY_SKU } from "./menu.js";
import { gstMinor, pointsFor } from "./money.js";
const MEAL_TXT = { l: "lunch only", d: "dinner only" };
// lines: [{sku, qty}] -> priced from the server menu. The browser's prices are never used.
export function quote(lines, f, meal) {
  if (!Array.isArray(lines) || !lines.length) return { ok: false, error: "empty", message: "Your cart is empty." };
  if (lines.length > 60) return { ok: false, error: "too_many", message: "Too many items." };
  const merged = new Map();
  for (const l of lines) {
    const q = Number(l && l.qty); const it = BY_SKU.get(l && l.sku);
    if (!it || !it.available) return { ok: false, error: "unknown_item", message: "One dish is not available any more.", sku: l && l.sku };
    if (!Number.isInteger(q) || q < 1 || q > 20) return { ok: false, error: "bad_qty", message: "Quantity must be 1 to 20." };
    merged.set(it.sku, Math.min(20, (merged.get(it.sku) || 0) + q));
  }
  const out = []; let sub = 0; const conflicts = [];
  for (const [sku, qty] of merged) {
    const it = BY_SKU.get(sku), line = it.priceMinor * qty; sub += line;
    out.push({ sku, name: it.name, qty, unitMinor: it.priceMinor, lineMinor: line });
    if (meal && it.meal !== "ld" && it.meal !== meal) conflicts.push({ sku, name: it.name, reason: it.name + " is served for " + MEAL_TXT[it.meal] + "." });
  }
  const tax = gstMinor(sub, f.gstBp);
  return { ok: true, lines: out, subtotalMinor: sub, taxMinor: tax, totalMinor: sub + tax, gstPct: f.gstBp / 100, gstAssumed: !f.gstConfirmed, pointsToEarn: pointsFor(sub), conflicts };
}
// Server decides the payment rule. total <= Rs 1000.00: payu or cod. Above: payu only.
export function methods(totalMinor, f, phoneInfo) {
  const m = ["payu"]; let codReason = null;
  if (!f.codLive) codReason = "off";
  else if (totalMinor > f.codMaxMinor) codReason = "over_limit";
  else if (phoneInfo && phoneInfo.noshows >= f.noShowLimit) codReason = "noshows";
  else if (phoneInfo && phoneInfo.openCod >= f.openCodCap) codReason = "open_cap";
  if (!codReason) m.push("cod");
  return { methods: m, codReason };
}
