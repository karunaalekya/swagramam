import { json, fail, readJson, normPhone } from "../../_lib/util.js";
import { verifyOtp } from "../../_lib/otp.js";
import { memberInfo } from "../../_lib/memberinfo.js";
import { newSession, sessCookie } from "../../_lib/session.js";
export async function onRequestPost({ env, request }) {
  const b = await readJson(request), phone = normPhone(b && b.phone); if (!phone) return fail("phone", "Please enter a valid 10-digit mobile number.");
  const purpose = b.purpose === "lookup" ? "lookup" : "checkout";
  const r = await verifyOtp(env, phone, b.code, purpose); if (!r.ok) return fail(r.error, r.message, r.status, { triesLeft: r.triesLeft });
  const info = await memberInfo(env, phone);
  const h = purpose === "checkout" ? { "set-cookie": sessCookie(await newSession(env, phone), request) } : {};
  return json({ ok: true, token: r.token, ...info }, 200, h);
}
