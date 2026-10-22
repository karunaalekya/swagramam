// Small helpers shared by all API routes.
export const json = (o, s = 200, h = {}) => new Response(JSON.stringify(o), { status: s, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...h } });
export const fail = (code, message, s = 400, extra = {}) => json({ ok: false, error: code, message, ...extra }, s);
export async function readJson(req) { try { const t = await req.text(); if (t.length > 20000) return null; return JSON.parse(t); } catch { return null; } }
export const nowMs = env => (env.ENV !== "production" && env.TEST_NOW_MS ? +env.TEST_NOW_MS : Date.now());
const enc = new TextEncoder();
const hex = buf => [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, "0")).join("");
export const sha512 = async s => hex(await crypto.subtle.digest("SHA-512", enc.encode(s)));
export async function hmac(secret, msg) {
  const k = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return hex(await crypto.subtle.sign("HMAC", k, enc.encode(msg)));
}
export function safeEq(a, b) { a = String(a); b = String(b); if (a.length !== b.length) return false; let d = 0; for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i); return d === 0; }
const A32 = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export function rid(n = 10) { const b = crypto.getRandomValues(new Uint8Array(n)); let s = ""; for (const x of b) s += A32[x % 32]; return s; }
export const b64u = s => btoa(unescape(encodeURIComponent(s))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
export const unb64u = s => decodeURIComponent(escape(atob(s.replace(/-/g, "+").replace(/_/g, "/"))));
export function normPhone(p) { p = String(p || "").replace(/[\s\-()]/g, "").replace(/^(\+?91|0)(?=\d{10}$)/, ""); return /^[6-9]\d{9}$/.test(p) ? p : null; }
export const cleanText = (s, n) => String(s == null ? "" : s).replace(/[\u0000-\u001f\u007f<>]/g, " ").replace(/\s+/g, " ").trim().slice(0, n);
export const validEmail = e => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) && e.length <= 120;
export const ev = (db, orderId, kind, data, ts) => db.prepare("INSERT INTO events(order_id,kind,data,ts) VALUES(?,?,?,?)").bind(orderId || null, kind, data == null ? null : JSON.stringify(data), ts).run();
