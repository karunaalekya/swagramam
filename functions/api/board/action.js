import { json, fail, readJson } from "../../_lib/util.js";
import { boardUser, boardEnabled, boardHeaderOk, boardAction } from "../../_lib/board.js";
// POST /api/board/action {id, action: accept|ready|collected|noshow|reject, reason}. Staff only; needs header x-board: 1.
export async function onRequestPost({ env, request }) {
  if (!boardEnabled(env)) return fail("off", "The order board is not switched on.", 404);
  if (!(await boardUser(env, request))) return fail("login", "Please enter the PIN.", 401);
  if (!boardHeaderOk(request)) return fail("header", "Refused.", 403);
  const r = await boardAction(env, await readJson(request) || {});
  return r.ok ? json(r) : fail(r.error, r.message, r.status, r.state ? { state: r.state } : {});
}
