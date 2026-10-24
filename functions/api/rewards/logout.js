import { json } from "../../_lib/util.js";
import { sessCookie } from "../../_lib/session.js";
export async function onRequestPost({ request }) { return json({ ok: true }, 200, { "set-cookie": sessCookie("", request, 0) }); }
