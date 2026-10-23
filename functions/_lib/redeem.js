// Redemption ledger (coupon, freebie, points) in D1. Lifecycle: reserve (order created) -> commit (paid / pay-at-pickup placed) | release (payment failed, expired).
// Works the same for any loyalty provider: the ledger is local; the provider only supplies offers and rules.
export const reserveStmts = (db, orderId, phone, rd, t) => {
  const out = [], ins = (kind, ref, points, amt) => db.prepare("INSERT INTO redemptions(order_id,phone,kind,ref,points,amount_minor,state,ts) VALUES(?,?,?,?,?,?,'reserved',?)").bind(orderId, phone, kind, ref, points, amt, t);
  if (rd.coupon) out.push(ins("coupon", rd.coupon.code, 0, rd.coupon.discountMinor));
  if (rd.freebie) out.push(ins("freebie", rd.freebie.code, 0, rd.freebie.valueMinor));
  if (rd.points) out.push(ins("points", null, rd.points.points, rd.points.discountMinor));
  return out;
};
export async function commitOrder(db, orderId, t) {
  const rows = (await db.prepare("SELECT id,phone,kind,points FROM redemptions WHERE order_id=? AND state='reserved'").bind(orderId).all()).results || [];
  for (const r of rows) {
    const u = await db.prepare("UPDATE redemptions SET state='committed', ts=? WHERE id=? AND state='reserved'").bind(t, r.id).run();
    if (u.meta.changes === 1 && r.kind === "points") await db.prepare("UPDATE customers SET points=MAX(0,points-?), updated_at=? WHERE phone=?").bind(r.points, t, r.phone).run();
  }
  if (rows.length) await db.prepare("UPDATE orders SET loyalty_status='committed' WHERE id=?").bind(orderId).run();
  return rows.length;
}
export async function releaseOrder(db, orderId, t) {
  const u = await db.prepare("UPDATE redemptions SET state='released', ts=? WHERE order_id=? AND state='reserved'").bind(t, orderId).run();
  if (u.meta.changes) await db.prepare("UPDATE orders SET loyalty_status='released' WHERE id=?").bind(orderId).run();
  return u.meta.changes;
}
export async function usedRefs(db, phone) {
  const r = (await db.prepare("SELECT ref FROM redemptions WHERE phone=? AND kind IN ('coupon','freebie') AND state IN ('reserved','committed')").bind(phone).all()).results || [];
  return new Set(r.map(x => x.ref));
}
export async function reservedPoints(db, phone) {
  const r = await db.prepare("SELECT COALESCE(SUM(points),0) n FROM redemptions WHERE phone=? AND kind='points' AND state='reserved'").bind(phone).first(); return r ? r.n : 0;
}
