import { json } from "../../_lib/util.js";
import { boardCookie } from "../../_lib/board.js";
export async function onRequestPost({ request }) { return json({ ok: true }, 200, { "set-cookie": boardCookie("", request, 0) }); }
