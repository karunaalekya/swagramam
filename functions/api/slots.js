import { json, fail, nowMs } from "../_lib/util.js";
import { flags } from "../_lib/flags.js";
import { listSlots, slotLoad, ist } from "../_lib/slots.js";
export async function onRequestGet({ env, request }) {
  const f = flags(env), t = nowMs(env), date = new URL(request.url).searchParams.get("date") || ist(t).date;
  const slots = listSlots(date, t, f); if (!slots.length && !/^\d{4}-\d{2}-\d{2}$/.test(date)) return fail("date", "Bad date.");
  const load = await slotLoad(env.DB, date);
  return json({ ok: true, date, today: ist(t).date, days: f.days, slots: slots.map(s => ({ ...s, full: (load[s.time] || 0) >= f.slotCap })) });
}
