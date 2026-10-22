import { json, fail, readJson } from "../../_lib/util.js";
import { readToken } from "../../_lib/otp.js";
import { orderStatus } from "../../_lib/orders.js";
export async function onRequestPost({ env, request }) {
  const b = await readJson(request), t = await readToken(env, b && b.token, "lookup"); if (!t) return fail("bad_token", "Please verify your mobile number again.", 401);
  const r = await env.DB.prepare("SELECT id FROM orders WHERE phone=? ORDER BY created_at DESC LIMIT 10").bind(t.p).all();
  const out = []; for (const x of r.results || []) out.push(await orderStatus(env, x.id));
  return json({ ok: true, orders: out });
}
