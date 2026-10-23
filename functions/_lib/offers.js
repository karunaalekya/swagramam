// Offer catalogue and rules. MOCK defaults below; the owner can replace them WITHOUT code by setting the OFFERS_JSON variable (see docs/CREDENTIALS_CHECKLIST.md).
// Same interface a Reelo provider will implement: pointsInfo, listOffers, validate. All money is integer paise. Everything is decided on the server.
import { ITEMS } from "./menu.js";
import { usedRefs, reservedPoints } from "./redeem.js";
const sweet = ITEMS.find(i => i.cat === "ds" && i.meal === "ld" && i.available);
// expires: last valid day (IST, YYYY-MM-DD). Missing = no expiry.
export const COUPONS = [
  { code: "SWAG10", title: "10% off", desc: "10% off, up to Rs 100, on orders of Rs 300 or more.", pct: 10, maxMinor: 10000, minMinor: 30000 },
  { code: "FLAT50", title: "Rs 50 off", desc: "Rs 50 off on orders of Rs 400 or more.", flatMinor: 5000, minMinor: 40000 },
  { code: "BIGEAT25", title: "25% off big orders", desc: "25% off, up to Rs 200, on orders of Rs 800 or more.", pct: 25, maxMinor: 20000, minMinor: 80000 },
  { code: "DIWALI20", title: "Diwali 20% off", desc: "20% off, up to Rs 150, on orders of Rs 500 or more.", pct: 20, maxMinor: 15000, minMinor: 50000, expires: "2026-10-20" },
  { code: "CLUB15", title: "Village Club 15% off", desc: "Members only. 15% off, up to Rs 120, on orders of Rs 250 or more.", pct: 15, maxMinor: 12000, minMinor: 25000, member: true },
];
export const FREEBIES = sweet ? [{ code: "FREESWEET", title: "Free dessert", desc: "A free " + sweet.name + " on orders of Rs 500 or more.", sku: sweet.sku, name: sweet.name, valueMinor: sweet.priceMinor, minMinor: 50000 }] : [];
export const POINTS = { valueMinor: 5, min: 200, step: 20, capPct: 50 };   // 1 point = Rs 0.05, at least 200, steps of 20, at most half the bill
/* OFFERS_JSON (optional, one line): {"coupons":[{"code":"WELCOME","title":"..","desc":"..","pct":10,"maxMinor":10000,"minMinor":30000,"member":false,"expires":"2026-12-31"}],
   "freebies":[{"code":"FREEGULAB","title":"..","desc":"..","sku":"<menu sku>","minMinor":50000}], "points":{"valueMinor":5,"min":200,"step":20,"capPct":50}}
   A coupon has either pct+maxMinor or flatMinor. Any part left out keeps the default. A bad value is ignored and shown in /api/admin/selfcheck. */
const int = v => Number.isInteger(v) && v >= 0;
export function parseOffers(env) {
  const out = { coupons: COUPONS, freebies: FREEBIES, points: POINTS, error: null }, raw = env && env.OFFERS_JSON; if (!raw) return out;
  try {
    const j = JSON.parse(raw);
    if (Array.isArray(j.coupons)) out.coupons = j.coupons.map(c => {
      if (!c || !/^[A-Z0-9]{3,24}$/.test(String(c.code || "").toUpperCase()) || !int(c.minMinor) || !(int(c.flatMinor) || (int(c.pct) && c.pct <= 100 && int(c.maxMinor)))) throw new Error("coupon " + (c && c.code));
      return { code: String(c.code).toUpperCase(), title: String(c.title || c.code), desc: String(c.desc || ""), pct: c.pct, maxMinor: c.maxMinor, flatMinor: c.flatMinor, minMinor: c.minMinor, member: !!c.member, expires: c.expires && /^\d{4}-\d{2}-\d{2}$/.test(c.expires) ? c.expires : undefined };
    });
    if (Array.isArray(j.freebies)) out.freebies = j.freebies.map(f => {
      const it = ITEMS.find(i => i.sku === (f && f.sku)); if (!it || !/^[A-Z0-9]{3,24}$/.test(String(f.code || "").toUpperCase()) || !int(f.minMinor)) throw new Error("freebie " + (f && f.code));
      return { code: String(f.code).toUpperCase(), title: String(f.title || "Free " + it.name), desc: String(f.desc || "A free " + it.name), sku: it.sku, name: it.name, valueMinor: it.priceMinor, minMinor: f.minMinor, member: !!f.member, expires: f.expires };
    });
    if (j.points) { const p = { ...POINTS, ...j.points }; if (![p.valueMinor, p.min, p.step].every(v => Number.isInteger(v) && v > 0) || !(p.capPct > 0 && p.capPct <= 100)) throw new Error("points"); out.points = p; }
  } catch (e) { return { coupons: COUPONS, freebies: FREEBIES, points: POINTS, error: "OFFERS_JSON invalid (" + e.message + "); using defaults" }; }
  return out;
}
const rs = m => "Rs " + (m / 100);
const find = (list, code) => list.find(x => x.code === String(code || "").trim().toUpperCase());
export const coupDisc = (c, sub) => Math.max(0, Math.min(sub, c.flatMinor != null ? c.flatMinor : Math.min(c.maxMinor, Math.floor(sub * c.pct / 100))));
const istDay = ms => new Date(ms + 19800000).toISOString().slice(0, 10);
function check(o, sub, member, used, now) {
  if (o.expires && istDay(now) > o.expires) return "This offer has expired.";
  if (o.member && !member) return "Only for Village Club members.";
  if (sub < o.minMinor) return "Add " + rs(o.minMinor - sub) + " more to use this.";
  if (used.has(o.code)) return "You have already used this offer.";
  return null;
}
export async function pointsInfo(env, phone, member, sub) {
  const P = parseOffers(env).points, base = { min: P.min, step: P.step, valueMinor: P.valueMinor };
  if (!member) return { member: false, balance: 0, max: 0, ...base };
  const c = await env.DB.prepare("SELECT points FROM customers WHERE phone=?").bind(phone).first();
  const balance = Math.max(0, (c ? c.points : 0) - await reservedPoints(env.DB, phone));
  const cap = Math.floor(sub * P.capPct / 100 / P.valueMinor), max = Math.floor(Math.min(balance, cap) / P.step) * P.step;
  return { member: true, balance, max: max >= P.min ? max : 0, ...base };
}
export async function listOffers(env, phone, member, sub, now) {
  const O = parseOffers(env), used = await usedRefs(env.DB, phone);
  const row = (o, extra) => { const reason = check(o, sub, member, used, now); return { code: o.code, title: o.title, desc: o.desc, eligible: !reason, reason, ...(reason ? {} : extra(o)) }; };
  return { coupons: O.coupons.map(o => row(o, x => ({ discountMinor: coupDisc(x, sub) }))), freebies: O.freebies.map(o => row(o, () => ({ discountMinor: 0 }))) };
}
// choice: {coupon?, freebie?, points?}. Returns {ok, discountMinor, coupon?, freebie?, points?} or {ok:false, error, message}
export async function validate(env, phone, member, sub, choice, now) {
  const no = (error, message) => ({ ok: false, error, message }), O = parseOffers(env), used = await usedRefs(env.DB, phone);
  if (choice.coupon) {
    const o = find(O.coupons, choice.coupon); if (!o) return no("coupon_unknown", "That coupon code is not valid.");
    const why = check(o, sub, member, used, now); if (why) return no(/expired/.test(why) ? "coupon_expired" : o.member && !member ? "member_only" : used.has(o.code) ? "coupon_used" : "min_order", why);
    const d = coupDisc(o, sub); return { ok: true, discountMinor: d, coupon: { code: o.code, discountMinor: d } };
  }
  if (choice.freebie) {
    const o = find(O.freebies, choice.freebie); if (!o) return no("freebie_unknown", "That free dish is not available.");
    const why = check(o, sub, member, used, now); if (why) return no(/expired/.test(why) ? "coupon_expired" : used.has(o.code) ? "freebie_used" : "min_order", why);
    return { ok: true, discountMinor: 0, freebie: { code: o.code, title: o.title, sku: o.sku, name: o.name, valueMinor: o.valueMinor } };
  }
  if (choice.points) {
    const p = Number(choice.points), pi = await pointsInfo(env, phone, member, sub);
    if (!member) return no("member_only", "Points are for Village Club members.");
    if (!Number.isInteger(p) || p < pi.min || p > pi.max || p % pi.step) return no("points_invalid", pi.max ? "Choose between " + pi.min + " and " + pi.max + " points." : "Points cannot be used on this order.");
    return { ok: true, discountMinor: p * pi.valueMinor, points: { points: p, discountMinor: p * pi.valueMinor } };
  }
  return { ok: true, discountMinor: 0 };
}
