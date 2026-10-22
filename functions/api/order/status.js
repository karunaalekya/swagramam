import { json, fail } from "../../_lib/util.js";
import { orderStatus } from "../../_lib/orders.js";
export async function onRequestGet({ env, request }) {
  const id = new URL(request.url).searchParams.get("id") || ""; if (!/^SW[A-Z2-9]{8}$/.test(id)) return fail("id", "Order not found.", 404);
  const s = await orderStatus(env, id); return s ? json({ ok: true, ...s }) : fail("id", "Order not found.", 404);
}
