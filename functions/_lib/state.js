import { ev } from "./util.js";
// Online (PayU):   CREATED > PAYMENT_PENDING > PAID > SENT_TO_KITCHEN > CONFIRMED > READY > COMPLETED
// Pay at pickup:   CREATED > SENT_TO_KITCHEN > CONFIRMED > READY > COMPLETED  (or NO_SHOW)
// Failures:        PAYMENT_FAILED, EXPIRED, HANDOFF_FAILED, REFUND_NEEDED, CANCELLED
export const NEXT = {
  CREATED: ["PAYMENT_PENDING", "SENT_TO_KITCHEN", "CANCELLED"],
  PAYMENT_PENDING: ["PAID", "PAYMENT_FAILED", "EXPIRED", "REFUND_NEEDED", "CANCELLED"],
  PAID: ["SENT_TO_KITCHEN", "HANDOFF_FAILED", "REFUND_NEEDED"],
  SENT_TO_KITCHEN: ["CONFIRMED", "READY", "CANCELLED", "HANDOFF_FAILED", "NO_SHOW", "COMPLETED", "REFUND_NEEDED"],
  CONFIRMED: ["READY", "CANCELLED", "NO_SHOW", "COMPLETED", "REFUND_NEEDED"],
  READY: ["COMPLETED", "NO_SHOW", "REFUND_NEEDED"],
  HANDOFF_FAILED: ["SENT_TO_KITCHEN", "REFUND_NEEDED"],
  PAYMENT_FAILED: ["REFUND_NEEDED"], EXPIRED: ["REFUND_NEEDED"],
  COMPLETED: [], NO_SHOW: [], CANCELLED: [], REFUND_NEEDED: [],
};
// Compare-and-set: moves the order only if it is still in one of the `from` states. Returns true once, false if someone else already moved it.
export async function cas(db, id, from, to, ts, meta) {
  from = [].concat(from);
  for (const s of from) if (!(NEXT[s] || []).includes(to)) throw new Error("illegal transition " + s + " > " + to);
  const r = await db.prepare("UPDATE orders SET state=?, updated_at=? WHERE id=? AND state IN (" + from.map(() => "?").join(",") + ")").bind(to, ts, id, ...from).run();
  const ok = (r.meta && r.meta.changes) === 1;
  if (ok) await ev(db, id, "state", { to, ...(meta || {}) }, ts);
  return ok;
}
export const OPEN_COD = ["CREATED", "SENT_TO_KITCHEN", "CONFIRMED", "READY"];
// Friendly stage for the customer page. Never says "paid" unless the server verified it.
export function stage(o) {
  const s = o.state;
  if (s === "PAYMENT_PENDING" || s === "CREATED") return "waiting_payment";
  if (s === "PAYMENT_FAILED") return "payment_failed";
  if (s === "EXPIRED") return "expired";
  if (s === "REFUND_NEEDED") return "refund";
  if (s === "CANCELLED" || s === "NO_SHOW") return "cancelled";
  if (s === "COMPLETED") return "done";
  if (s === "READY") return "ready";
  if (s === "CONFIRMED") return "confirmed";
  if (s === "PAID" || s === "SENT_TO_KITCHEN" || s === "HANDOFF_FAILED") return o.pay_method === "cod" ? "placed_cod" : "placed_paid";
  return "waiting_payment";
}
