// 30-day signed session cookie (HttpOnly, SameSite=Lax, Secure on https). Lets a returning customer skip the OTP.
import { signToken, readToken } from "./otp.js";
export const COOKIE = "sx_sess", MAXAGE = 30 * 86400;
export const sessCookie = (v, req, age = MAXAGE) => COOKIE + "=" + v + "; Path=/; Max-Age=" + age + "; HttpOnly; SameSite=Lax" + (new URL(req.url).protocol === "https:" ? "; Secure" : "");
export function getCookie(req, n) { const m = (req.headers.get("cookie") || "").match(new RegExp("(?:^|; )" + n + "=([^;]*)")); return m ? m[1] : null; }
export const newSession = (env, phone) => signToken(env, phone, "session", MAXAGE * 1000);
export async function sessionPhone(env, req) { const o = await readToken(env, getCookie(req, COOKIE), "session"); return o ? o.p : null; }
