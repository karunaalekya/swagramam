import { phoneInfo } from "./orders.js";
import { flags } from "./flags.js";
import { loyalty } from "./loyalty.js";
// Same shape the OTP verify returns. Reelo slow or down => points null ("Balance updating"); never blocks.
export async function memberInfo(env, phone) {
  const info = await phoneInfo(env, phone);
  if (flags(env).loyalty === "reelo") { try { const l = await loyalty(env).lookup(phone); info.points = l.points; if (l.exists && l.points != null) info.member = info.member || l.member; } catch { info.points = null; } }
  return { member: info.member, name: info.name || null, points: info.member ? info.points : null, noshows: info.noshows, openCod: info.openCod };
}
