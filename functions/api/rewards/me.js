import { json } from "../../_lib/util.js";
import { signToken } from "../../_lib/otp.js";
import { sessionPhone } from "../../_lib/session.js";
import { memberInfo } from "../../_lib/memberinfo.js";
// Returning customer: valid session cookie => fresh 30-minute checkout token + balance, no OTP. Only ever the cookie's own phone.
export async function onRequestGet({ env, request }) {
  const phone = await sessionPhone(env, request); if (!phone) return json({ ok: false, error: "no_session", message: "Please verify your mobile number." });
  return json({ ok: true, phone, token: await signToken(env, phone, "checkout"), ...(await memberInfo(env, phone)) });
}
