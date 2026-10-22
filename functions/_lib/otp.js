import { flags } from "./flags.js";
import { hmac, safeEq, rid, b64u, unb64u, nowMs } from "./util.js";
import { msg91Send } from "./msg91.js";
const secret = env => env.TOKEN_SECRET || (env.ENV === "production" ? null : "dev-only-secret");
const code6 = () => String(crypto.getRandomValues(new Uint32Array(1))[0] % 1000000).padStart(6, "0");
const TTL = 300000, RESEND = 30000, MAX_TRIES = 5, PER_PHONE_HR = 5, PER_IP_HR = 15, TOKEN_TTL = 30 * 60000;
async function kget(env, k) { const v = await env.KV.get(k); return v ? JSON.parse(v) : null; }
const kput = (env, k, o, ttl) => env.KV.put(k, JSON.stringify(o), { expirationTtl: Math.max(60, ttl) });
// purpose: "checkout" | "lookup" | "join"
export async function sendOtp(env, phone, ip) {
  const f = flags(env), t = nowMs(env), hr = Math.floor(t / 3600000);
  if (f.otp !== "mock" && f.otp !== "msg91") return { ok: false, status: 500, error: "otp_provider", message: "OTP is not set up." };
  if (f.otp === "mock" && f.prod) return { ok: false, status: 503, error: "otp_mock_blocked", message: "SMS OTP is not available." };
  const cur = await kget(env, "otp:" + phone);
  if (cur && t - cur.last < RESEND) return { ok: false, status: 429, error: "resend_wait", message: "Please wait 30 seconds before asking for a new code.", waitMs: RESEND - (t - cur.last) };
  const pc = (await kget(env, "otpc:" + phone + ":" + hr)) || { n: 0 }, ic = (await kget(env, "otpi:" + ip + ":" + hr)) || { n: 0 };
  if (pc.n >= PER_PHONE_HR || ic.n >= PER_IP_HR) return { ok: false, status: 429, error: "rate_limited", message: "Too many codes requested. Please try again later." };
  const code = code6();
  await kput(env, "otp:" + phone, { h: await hmac(secret(env), phone + ":" + code), exp: t + TTL, tries: 0, last: t }, 600);
  await kput(env, "otpc:" + phone + ":" + hr, { n: pc.n + 1 }, 3700); await kput(env, "otpi:" + ip + ":" + hr, { n: ic.n + 1 }, 3700);
  if (f.otp === "msg91") {   // real SMS: the code never leaves the server except inside the SMS
    const r = await msg91Send(env, phone, code, TTL / 60000);
    if (!r.ok) { await env.KV.delete("otp:" + phone); try { console.error("msg91", r.error, r.detail); } catch {} return { ok: false, status: 502, error: "sms_failed", message: "We could not send the SMS. Please try again in a minute, or order on WhatsApp." }; }
    return { ok: true };
  }
  return { ok: true, devCode: code, mock: true };   // devCode only exists on mock, never in production (blocked above)
}
export async function signToken(env, phone, purpose) {
  const p = b64u(JSON.stringify({ p: phone, u: purpose, e: nowMs(env) + TOKEN_TTL, n: rid(12) }));
  return p + "." + (await hmac(secret(env), p));
}
export async function readToken(env, tok, purpose) {
  const [p, s] = String(tok || "").split("."); if (!p || !s || !secret(env)) return null;
  if (!safeEq(await hmac(secret(env), p), s)) return null;
  let o; try { o = JSON.parse(unb64u(p)); } catch { return null; }
  if (o.u !== purpose || o.e < nowMs(env)) return null; return o;
}
export async function verifyOtp(env, phone, code, purpose) {
  const t = nowMs(env), cur = await kget(env, "otp:" + phone);
  if (!cur) return { ok: false, status: 400, error: "no_code", message: "Ask for a new code." };
  if (t > cur.exp) { await env.KV.delete("otp:" + phone); return { ok: false, status: 400, error: "expired", message: "That code has expired. Ask for a new one." }; }
  if (cur.tries >= MAX_TRIES) return { ok: false, status: 429, error: "too_many_tries", message: "Too many wrong tries. Ask for a new code." };
  const good = safeEq(await hmac(secret(env), phone + ":" + String(code || "")), cur.h);
  if (!good) { cur.tries++; await kput(env, "otp:" + phone, cur, Math.ceil((cur.exp - t) / 1000) + 60); return { ok: false, status: 400, error: "wrong_code", message: "That code is not right.", triesLeft: MAX_TRIES - cur.tries }; }
  await env.KV.delete("otp:" + phone);   // single use
  return { ok: true, token: await signToken(env, phone, purpose) };
}
