import { json, fail, readJson } from "../../_lib/util.js";
import { startCheckout } from "../../_lib/orders.js";
export async function onRequestPost({ env, request }) {
  const b = await readJson(request); if (!b) return fail("body", "Bad request.");
  const r = await startCheckout(env, b, new URL(request.url).origin);
  if (!r.ok) return fail(r.error, r.message, r.status, { conflicts: r.conflicts, codReason: r.codReason });
  return json(r);
}
