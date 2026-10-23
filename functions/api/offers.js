import { json, fail, readJson, nowMs } from "../_lib/util.js";
import { flags } from "../_lib/flags.js";
import { readToken } from "../_lib/otp.js";
import { phoneInfo } from "../_lib/orders.js";
import { priceOrder } from "../_lib/pricing.js";
import { loyalty } from "../_lib/loyalty.js";
import { listOffers } from "../_lib/offers.js";
// POST {token, lines, join?}: coupons and free dishes for this mobile, each marked eligible or not with a reason.
export async function onRequestPost({ env, request }) {
  const b = await readJson(request); if (!b) return fail("body", "Bad request.");
  const t = await readToken(env, b.token, "checkout"); if (!t) return fail("bad_token", "Please verify your mobile number again.", 401);
  if (loyalty(env).name !== "mock") return json({ ok: true, coupons: [], freebies: [], instoreOnly: true });
  const info = await phoneInfo(env, t.p), q = await priceOrder(env, { lines: b.lines }, flags(env), null, null); if (!q.ok) return fail(q.error, q.message);
  return json({ ok: true, ...(await listOffers(env, t.p, info.member || b.join === true, q.subtotalMinor, nowMs(env))), instoreOnly: false });
}
