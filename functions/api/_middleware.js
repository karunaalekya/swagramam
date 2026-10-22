import { json } from "../_lib/util.js";
export async function onRequest(ctx) {
  try {
    const res = await ctx.next();
    const h = new Headers(res.headers);
    h.set("X-Robots-Tag", "noindex, nofollow"); h.set("X-Content-Type-Options", "nosniff"); h.set("Referrer-Policy", "same-origin");
    if (!h.has("cache-control")) h.set("cache-control", "no-store");
    return new Response(res.body, { status: res.status, headers: h });
  } catch (e) {
    try { console.error("api error", e && e.stack || e); } catch {}
    return json({ ok: false, error: "server", message: "Something went wrong. Please try again." }, 500);
  }
}
