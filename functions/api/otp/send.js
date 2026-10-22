import { json, fail, readJson, normPhone } from "../../_lib/util.js";
import { sendOtp } from "../../_lib/otp.js";
export async function onRequestPost({ env, request }) {
  const b = await readJson(request), phone = normPhone(b && b.phone); if (!phone) return fail("phone", "Please enter a valid 10-digit mobile number.");
  const ip = request.headers.get("cf-connecting-ip") || "local";
  const r = await sendOtp(env, phone, ip); if (!r.ok) return fail(r.error, r.message, r.status, { waitMs: r.waitMs });
  return json({ ok: true, ...(r.devCode ? { devCode: r.devCode, mock: true } : {}) });
}
