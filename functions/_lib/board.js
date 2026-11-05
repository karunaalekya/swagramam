// Order Board (Phase 4): what the restaurant sees and does with online orders.
// Login: one staff PIN (secret BOARD_PIN, 6+ digits). Session: signed HttpOnly cookie, 12 hours, SameSite=Strict.
// Every action is a compare-and-set on the order state (two phones at the counter cannot both win) and writes an events row.
import { nowMs, ev, safeEq, cleanText } from "./util.js";
import { signToken, readToken } from "./otp.js";
import { cas } from "./state.js";
import { loyalty } from "./loyalty.js";

export const BCOOKIE = "sx_board", BAGE = 12 * 3600;
const PIN_TRIES = 5, PIN_WINDOW = 15 * 60000;
export const boardCookie = (v, req, age = BAGE) => BCOOKIE + "=" + v + "; Path=/; Max-Age=" + age + "; HttpOnly; SameSite=Strict" + (new URL(req.url).protocol === "https:" ? "; Secure" : "");
const cookie = (req, n) => { const m = (req.headers.get("cookie") || "").match(new RegExp("(?:^|; )" + n + "=([^;]*)")); return m ? m[1] : null; };
export const boardEnabled = env => /^\d{6,12}$/.test(String(env.BOARD_PIN || ""));
export async function boardUser(env, req) { if (!boardEnabled(env)) return null; return readToken(env, cookie(req, BCOOKIE), "board"); }
// Cross-site forms cannot set custom headers, so state-changing calls must carry x-board: 1.
export const boardHeaderOk = req => req.headers.get("x-board") === "1";

export async function boardLogin(env, pin, ip) {
  if (!boardEnabled(env)) return { ok: false, status: 404, error: "off", message: "The order board is not switched on." };
  const t = nowMs(env), win = Math.floor(t / PIN_WINDOW), k = "boardpin:" + (ip || "x") + ":" + win;
  const n = +((await env.KV.get(k)) || 0);
  if (n >= PIN_TRIES) return { ok: false, status: 429, error: "locked", message: "Too many wrong PINs. Wait 15 minutes and try again." };
  if (!safeEq(String(pin || ""), String(env.BOARD_PIN))) { await env.KV.put(k, String(n + 1), { expirationTtl: 1000 }); return { ok: false, status: 401, error: "pin", message: "That PIN is not right." }; }
  return { ok: true, token: await signToken(env, "board", "board", BAGE * 1000) };
}

// India date (YYYY-MM-DD) for a unix ms time.
export const istDate = ms => new Date(ms + 330 * 60000).toISOString().slice(0, 10);
// Orders the kitchen should see: paid online, or pay at pickup. Unpaid online orders never reach the board.
const HIDDEN = ["CREATED", "PAYMENT_PENDING", "PAYMENT_FAILED", "EXPIRED"];
export const COLUMN = { SENT_TO_KITCHEN: "new", HANDOFF_FAILED: "new", CONFIRMED: "preparing", READY: "ready", COMPLETED: "done", NO_SHOW: "done", CANCELLED: "done", REFUND_NEEDED: "done", PAID: "new" };

export async function boardList(env, date) {
  const t = nowMs(env); date = /^\d{4}-\d{2}-\d{2}$/.test(date || "") ? date : istDate(t);
  const rows = (await env.DB.prepare("SELECT * FROM orders WHERE slot_date=? AND state NOT IN (" + HIDDEN.map(() => "?").join(",") + ") ORDER BY slot_time, created_at").bind(date, ...HIDDEN).all()).results || [];
  const items = rows.length ? (await env.DB.prepare("SELECT order_id,name,qty,note FROM order_items WHERE order_id IN (" + rows.map(() => "?").join(",") + ") ORDER BY id").bind(...rows.map(r => r.id)).all()).results || [] : [];
  const pay = rows.length ? (await env.DB.prepare("SELECT order_id FROM payments WHERE provider='counter' AND status='success' AND order_id IN (" + rows.map(() => "?").join(",") + ")").bind(...rows.map(r => r.id)).all()).results || [] : [];
  const paidAtCounter = new Set(pay.map(p => p.order_id));
  const out = rows.map(o => ({ id: o.id, state: o.state, column: COLUMN[o.state] || "done", method: o.pay_method, paid: o.pay_method === "payu" ? true : paidAtCounter.has(o.id),
    name: o.name, phone: o.phone, slot: { date: o.slot_date, time: o.slot_time, meal: o.meal }, note: o.note, totalMinor: o.total_minor, tipMinor: o.tip_minor || 0,
    discountMinor: o.discount_minor || 0, couponCode: o.coupon_code, flag: o.flag, createdAt: o.created_at, updatedAt: o.updated_at,
    items: items.filter(i => i.order_id === o.id).map(i => ({ name: i.name, qty: i.qty, note: i.note })) }));
  const sum = { orders: 0, onlineMinor: 0, counterDueMinor: 0, counterTakenMinor: 0, tipsMinor: 0, noShows: 0, cancelled: 0 };
  for (const o of out) {
    if (o.state === "NO_SHOW") { sum.noShows++; continue; }
    if (o.state === "CANCELLED" || o.state === "REFUND_NEEDED") { sum.cancelled++; continue; }
    sum.orders++; sum.tipsMinor += o.tipMinor;
    if (o.method === "payu") sum.onlineMinor += o.totalMinor; else if (o.paid) sum.counterTakenMinor += o.totalMinor; else sum.counterDueMinor += o.totalMinor;
  }
  return { ok: true, date, serverTime: t, orders: out, summary: sum };
}

// Give back points and offers on an order that will not happen (pay at pickup rejected). Paid online orders go to REFUND_NEEDED instead: the owner refunds in PayU.
async function giveBack(db, orderId, t) {
  const rows = (await db.prepare("SELECT id,phone,kind,points FROM redemptions WHERE order_id=? AND state='committed'").bind(orderId).all()).results || [];
  for (const r of rows) {
    const u = await db.prepare("UPDATE redemptions SET state='released', ts=? WHERE id=? AND state='committed'").bind(t, r.id).run();
    if (u.meta.changes === 1 && r.kind === "points") await db.prepare("UPDATE customers SET points=points+?, updated_at=? WHERE phone=?").bind(r.points, t, r.phone).run();
  }
  if (rows.length) await db.prepare("UPDATE orders SET loyalty_status='released' WHERE id=?").bind(orderId).run();
}

const REJECT_REASONS = ["Item not available", "Kitchen too busy", "Closing early", "Customer asked to cancel", "Other"];
export const READY_TEXT = o => `Hi ${o.name || ""}, your Swagramam take away order ${o.id} is ready for pickup at Labbipet. Please show this number at the counter.`.replace(/\s+/g, " ");

export async function boardAction(env, b) {
  const t = nowMs(env), db = env.DB, id = String(b.id || ""), act = String(b.action || ""), bad = (m, s = 409) => ({ ok: false, status: s, error: "action", message: m });
  if (!/^SW[A-Z2-9]{8}$/.test(id)) return bad("Order not found.", 404);
  const o = await db.prepare("SELECT * FROM orders WHERE id=?").bind(id).first(); if (!o) return bad("Order not found.", 404);
  const moved = (from, to, meta) => cas(db, id, from, to, t, { by: "board", ...(meta || {}) });
  let ok = false, extra = {};
  if (act === "accept") ok = await moved(["SENT_TO_KITCHEN"], "CONFIRMED");
  else if (act === "ready") {
    ok = await moved(["SENT_TO_KITCHEN", "CONFIRMED"], "READY");
    if (ok) { await db.prepare("INSERT INTO handoffs(order_id,channel,status,attempts,ts) VALUES(?,?,?,0,?)").bind(id, "customer-ready", "queued", t).run();
      extra.waLink = "https://wa.me/91" + o.phone + "?text=" + encodeURIComponent(READY_TEXT(o)); }   // staff can tap to send; automatic SMS needs a DLT template (Phase 3)
  }
  else if (act === "collected") {
    ok = await moved(["SENT_TO_KITCHEN", "CONFIRMED", "READY"], "COMPLETED", { paidAtCounter: o.pay_method === "cod" });
    if (ok && o.pay_method === "cod") await db.prepare("INSERT INTO payments(order_id,provider,txnid,status,amount_minor,ts) VALUES(?,?,?,?,?,?)").bind(id, "counter", id, "success", o.total_minor, t).run();
    if (ok && o.points_to_earn > 0) { const r = await loyalty(env).earn(o.phone, id, o.points_to_earn, "api"); extra.points = r && r.ok && !r.skipped ? o.points_to_earn : 0; }
  }
  else if (act === "noshow") {
    ok = await moved(["SENT_TO_KITCHEN", "CONFIRMED", "READY"], "NO_SHOW");
    if (ok && o.pay_method === "cod") await db.prepare("UPDATE customers SET noshows=noshows+1, updated_at=? WHERE phone=?").bind(t, o.phone).run();   // 2 no-shows turn off pay at pickup for this number
  }
  else if (act === "reject") {
    const reason = cleanText(b.reason, 80); if (!reason) return bad("Choose a reason.", 400);
    if (o.pay_method === "payu") { ok = await moved(["SENT_TO_KITCHEN", "CONFIRMED"], "REFUND_NEEDED", { reason }); if (ok) await ev(db, id, "alert", { what: "rejected after online payment: refund in PayU", reason }, t); }
    else { ok = await moved(["SENT_TO_KITCHEN", "CONFIRMED"], "CANCELLED", { reason }); if (ok) await giveBack(db, id, t); }
    if (ok) await db.prepare("INSERT INTO handoffs(order_id,channel,status,attempts,ts) VALUES(?,?,?,0,?)").bind(id, "customer-cancelled", "queued", t).run();
  }
  else return bad("Unknown action.", 400);
  if (!ok) { const now = await db.prepare("SELECT state FROM orders WHERE id=?").bind(id).first(); return { ok: false, status: 409, error: "stale", message: "This order was already updated (now " + (now && now.state) + "). The list will refresh.", state: now && now.state }; }
  const now = await db.prepare("SELECT state FROM orders WHERE id=?").bind(id).first();
  return { ok: true, id, state: now.state, ...extra };
}
export { REJECT_REASONS };
