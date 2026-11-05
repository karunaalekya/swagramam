import { json, fail, readJson } from "../../_lib/util.js";
import { boardLogin, boardCookie } from "../../_lib/board.js";
// POST /api/board/login {pin}. Sets the board session cookie. 5 wrong PINs per 15 minutes per IP.
export async function onRequestPost({ env, request }) {
  const b = await readJson(request) || {};
  const r = await boardLogin(env, b.pin, request.headers.get("cf-connecting-ip") || "");
  if (!r.ok) return fail(r.error, r.message, r.status);
  return json({ ok: true }, 200, { "set-cookie": boardCookie(r.token, request) });
}
