import { json, fail } from "../../_lib/util.js";
import { boardUser, boardEnabled, boardList, REJECT_REASONS } from "../../_lib/board.js";
// GET /api/board/orders?date=YYYY-MM-DD (default: today in India). Staff only.
export async function onRequestGet({ env, request }) {
  if (!boardEnabled(env)) return fail("off", "The order board is not switched on.", 404);
  if (!(await boardUser(env, request))) return fail("login", "Please enter the PIN.", 401);
  const r = await boardList(env, new URL(request.url).searchParams.get("date"));
  return json({ ...r, reasons: REJECT_REASONS });
}
