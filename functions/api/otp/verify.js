import { json, fail, readJson, normPhone } from "../../_lib/util.js";
import { verifyOtp } from "../../_lib/otp.js";
import { phoneInfo } from "../../_lib/orders.js";
import { flags } from "../../_lib/flags.js";
import { loyalty } from "../../_lib/loyalty.js";
export async function onRequestPost({ env, request }) {
  const b = await readJson(request), phone = normPhone(b && b.phone); if (!phone) return fail("phone", "Please enter a valid 10-digit mobile number.");
  const purpose = b.purpose === "lookup" ? "lookup" : "checkout";
  const r = await verifyOtp(env, phone, b.code, purpose); if (!r.ok) return fail(r.error, r.message, r.status, { triesLeft: r.triesLeft });
  const info = await phoneInfo(env, phone);
  if (flags(env).loyalty === "reelo") { try { const l = await loyalty(env).lookup(phone); info.points = l.points; if (l.exists && l.points != null) info.member = info.member || l.member; } catch { info.points = null; } }
  return json({ ok: true, token: r.token, member: info.member, name: info.name || null, points: info.member ? info.points : null, noshows: info.noshows, openCod: info.openCod });
}
