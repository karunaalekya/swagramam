// Slots in IST. Lunch 12:00-16:30 (Mon 16:00), dinner 19:00-23:30. Last slot starts one slot length before close.
const IST = 330 * 60000;
export function ist(ms) { const d = new Date(ms + IST); const p = n => String(n).padStart(2, "0");
  return { date: d.getUTCFullYear() + "-" + p(d.getUTCMonth() + 1) + "-" + p(d.getUTCDate()), min: d.getUTCHours() * 60 + d.getUTCMinutes(), dow: d.getUTCDay() }; }
export const dowOf = date => new Date(date + "T00:00:00Z").getUTCDay();
export const windows = dow => [["l", 720, dow === 1 ? 960 : 990], ["d", 1140, 1410]];
const hh = m => String(Math.floor(m / 60)).padStart(2, "0") + ":" + String(m % 60).padStart(2, "0");
export const toMin = t => { const m = /^(\d{2}):(\d{2})$/.exec(t || ""); return m ? +m[1] * 60 + +m[2] : null; };
export function validDate(date, ms, f) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date || "")) return false;
  const t = ist(ms); const a = Date.parse(t.date + "T00:00:00Z"), b = Date.parse(date + "T00:00:00Z");
  if (isNaN(b)) return false; const d = Math.round((b - a) / 86400000); return d >= 0 && d < f.days;
}
export function listSlots(date, ms, f) {
  const t = ist(ms), out = []; if (!validDate(date, ms, f)) return out;
  const minStart = date === t.date ? Math.ceil((t.min + f.prepMin) / f.slotMin) * f.slotMin : 0;
  for (const [meal, open, close] of windows(dowOf(date)))
    for (let m = open; m <= close - f.slotMin; m += f.slotMin) if (m >= minStart) out.push({ time: hh(m), meal });
  return out;
}
// returns {ok, meal} or {ok:false, reason}
export function checkSlot(date, time, ms, f) {
  if (!validDate(date, ms, f)) return { ok: false, reason: "That date is not available for take away." };
  const s = listSlots(date, ms, f).find(x => x.time === time);
  return s ? { ok: true, meal: s.meal } : { ok: false, reason: "That pickup time is not available. Please choose another time." };
}
export const DEAD = ["EXPIRED", "PAYMENT_FAILED", "CANCELLED", "NO_SHOW"];
export async function slotLoad(db, date) {
  const q = "SELECT slot_time t, COUNT(*) c FROM orders WHERE slot_date=? AND state NOT IN ('" + DEAD.join("','") + "') GROUP BY slot_time";
  const r = await db.prepare(q).bind(date).all(); const m = {}; (r.results || []).forEach(x => (m[x.t] = x.c)); return m;
}
