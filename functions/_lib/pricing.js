// One place that prices an order: dish lines -> discount -> GST on the taxable amount -> tip (not taxed) -> total. Integer paise. The browser sends choices, never amounts.
import { quote } from "./quote.js";
import { gstMinor, pointsFor, minorFromAmount } from "./money.js";
import { loyalty } from "./loyalty.js";
import * as offers from "./offers.js";
import { nowMs } from "./util.js";
export const TIP_OPTIONS = [5, 10, 15], TIP_DEFAULT = 5, TIP_MAX_PCT = 30, TIP_MAX_MINOR = 50000;
const pctOf = (m, p) => Math.floor((m * p + 50) / 100);   // half-up
export function tipFor(sub, tip) {
  const max = Math.min(pctOf(sub, TIP_MAX_PCT), TIP_MAX_MINOR), opts = TIP_OPTIONS.map(pct => ({ pct, minor: pctOf(sub, pct) }));
  const base = { tipOptions: opts, tipMax: { minor: max } };
  if (!tip) return { ok: true, tipMinor: 0, ...base };
  if (tip.pct != null) { const p = Number(tip.pct); if (!TIP_OPTIONS.includes(p)) return { ok: false, error: "tip", message: "Please choose 5%, 10%, 15% or Other." }; return { ok: true, tipMinor: Math.min(pctOf(sub, p), max), ...base }; }
  if (tip.amount != null && String(tip.amount).trim() !== "") {
    const m = minorFromAmount(tip.amount); if (m == null) return { ok: false, error: "tip", message: "Enter the tip as a number of rupees." };
    if (m > max) return { ok: false, error: "tip", message: "Tip can be up to Rs " + (max / 100) + " on this order." };
    return { ok: true, tipMinor: m, ...base };
  }
  return { ok: true, tipMinor: 0, ...base };
}
// who: {phone, member} when the mobile is verified, else null.
export async function priceOrder(env, b, f, meal, who) {
  const q = quote(b.lines, f, meal); if (!q.ok) return q;
  const sub = q.subtotalMinor, L = loyalty(env), choice = b.redeem || {}, canRedeem = L.name === "mock";
  const n = ["coupon", "freebie", "points"].filter(k => choice[k]).length;
  let rd = {}, offerError = null;
  const member = !!(who && (who.member || b.join === true));
  const pointsInfo = who && canRedeem ? await offers.pointsInfo(env, who.phone, member, sub) : null;
  if (n) {
    if (n > 1) offerError = { error: "one_offer", message: "Only one offer can be used on an order." };
    else if (!who) offerError = { error: "login", message: "Verify your mobile number to use offers." };
    else if (!canRedeem) offerError = { error: "offers_off", message: "Rewards are redeemed at the restaurant for now." };
    else { const v = await offers.validate(env, who.phone, member, sub, choice, nowMs(env)); if (v.ok) rd = v; else offerError = { error: v.error, message: v.message }; }
  }
  const discount = Math.max(0, Math.min(sub, rd.discountMinor || 0)), taxable = sub - discount, tax = gstMinor(taxable, f.gstBp);
  const t = tipFor(sub, b.tip); if (!t.ok) return t;
  return { ...q, discountMinor: discount, taxableMinor: taxable, taxMinor: tax, tipMinor: t.tipMinor, totalMinor: taxable + tax + t.tipMinor, tipOptions: t.tipOptions, tipMax: t.tipMax,
    pointsToEarn: pointsFor(taxable), redeem: { coupon: rd.coupon || null, points: rd.points || null }, freebie: rd.freebie || null, offerError, pointsInfo, _rd: rd };
}
