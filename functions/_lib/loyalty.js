// Loyalty adapter. Interface: lookup, enrol, balance, earn, commit, release. Mock provider lives in D1.
// Reelo provider: reelo.js (same interface, plus bill, reserveRedemption, revert, saleReturn, pushMenu).
import { flags } from "./flags.js";
import { nowMs } from "./util.js";
import { reelo } from "./reelo.js";
export function loyalty(env) {
  const f = flags(env);
  if (f.loyalty === "reelo") return reelo(env);
  const db = env.DB;
  return {
    name: "mock",
    async lookup(phone) { const r = await db.prepare("SELECT phone,name,member,points,noshows FROM customers WHERE phone=?").bind(phone).first(); return r ? { exists: true, member: !!r.member, name: r.name, points: r.points, noshows: r.noshows } : { exists: false, member: false, points: 0, noshows: 0 }; },
    async enrol(phone, name) { const t = nowMs(env);
      await db.prepare("INSERT INTO customers(phone,name,member,created_at,updated_at) VALUES(?,?,1,?,?) ON CONFLICT(phone) DO UPDATE SET member=1, name=COALESCE(NULLIF(?,''),name), updated_at=?").bind(phone, name || null, t, t, name || "", t).run(); return { ok: true }; },
    async balance(phone) { const r = await this.lookup(phone); return r.points; },
    // earn: credited once per order, by one path only (unique order_id+type). path = "api" | "pos".
    async earn(phone, orderId, points, path) { const t = nowMs(env);
      try { await db.prepare("INSERT INTO loyalty_events(phone,order_id,type,points,path,ts) VALUES(?,?,?,?,?,?)").bind(phone, orderId, "earn", points, path, t).run(); }
      catch (e) { return { ok: true, duplicate: true }; }
      await db.prepare("UPDATE customers SET points=points+?, updated_at=? WHERE phone=?").bind(points, t, phone).run();
      await db.prepare("UPDATE orders SET points_credit_path=? WHERE id=? AND points_credit_path IS NULL").bind(path, orderId).run(); return { ok: true }; },
    async commit() { return { ok: true, note: "redemption is in-store only in v1 (D6)" }; },
    async release() { return { ok: true }; },
  };
}
