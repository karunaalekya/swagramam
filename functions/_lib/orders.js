import { flags, problem } from "./flags.js";
import { ev, nowMs, rid, cleanText, validEmail } from "./util.js";
import { methods } from "./quote.js";
import { priceOrder } from "./pricing.js";
import { reserveStmts, commitOrder, releaseOrder } from "./redeem.js";
import { checkSlot, slotLoad } from "./slots.js";
import { cas, OPEN_COD, stage } from "./state.js";
import { readToken } from "./otp.js";
import { loyalty } from "./loyalty.js";
import { buildRequest, verifyPayment, creds, responseHash } from "./payu.js";
import { minorFromAmount } from "./money.js";
export const WORDING = "2026-10-22-v1";
export async function phoneInfo(env, phone) {
  const c = await env.DB.prepare("SELECT member,points,noshows,name FROM customers WHERE phone=?").bind(phone).first();
  const o = await env.DB.prepare("SELECT COUNT(*) n FROM orders WHERE phone=? AND pay_method='cod' AND state IN ('" + OPEN_COD.join("','") + "')").bind(phone).first();
  return { member: !!(c && c.member), points: c ? c.points : 0, noshows: c ? c.noshows : 0, openCod: o ? o.n : 0, name: c && c.name };
}
// Full server-side checkout. The browser sends only SKUs, quantities, slot and the payment method it wants.
export async function startCheckout(env, b, origin) {
  const f = flags(env), t = nowMs(env), bad = (error, message, status = 400, extra = {}) => ({ ok: false, status, error, message, ...extra });
  const pr = problem(env); if (!f.live || pr) return bad("not_live", "Online ordering is not open. Please order on WhatsApp.", 503);
  const tok = await readToken(env, b.token, "checkout"); if (!tok) return bad("bad_token", "Please verify your mobile number again.", 401);
  const name = cleanText(b.name, 60), email = cleanText(b.email, 120), note = cleanText(b.note, 200);
  if (!name) return bad("name", "Please enter your name.");
  if (email && !validEmail(email)) return bad("email", "That email address does not look right.");
  if (!(b.consent && b.consent.terms === true)) return bad("consent", "Please accept the terms to place your order.");
  const slot = b.slot || {}, sc = checkSlot(slot.date, slot.time, t, f); if (!sc.ok) return bad("slot", sc.reason);
  const load = await slotLoad(env.DB, slot.date); if ((load[slot.time] || 0) >= f.slotCap) return bad("slot_full", "That pickup time is full. Please choose another time.", 409);
  const pi0 = await phoneInfo(env, tok.p);
  const q = await priceOrder(env, b, f, sc.meal, { phone: tok.p, member: pi0.member }); if (!q.ok) return bad(q.error, q.message);
  if (q.offerError) return bad(q.offerError.error, q.offerError.message, 409);
  if (q.conflicts.length) return bad("meal_conflict", q.conflicts[0].reason + " Choose another time or remove it.", 409, { conflicts: q.conflicts });
  const method = b.method === "cod" ? "cod" : b.method === "payu" ? "payu" : null; if (!method) return bad("method", "Choose how to pay.");
  const pi = pi0, m = methods(q.totalMinor, f, pi);
  if (!m.methods.includes(method)) return bad("method_not_allowed", method === "cod" ? "Pay at pickup is not available for this order. Please pay online." : "That payment method is not available.", 403, { codReason: m.codReason });
  const id = "SW" + rid(8), state0 = "CREATED";
  const notes = new Map((Array.isArray(b.lines) ? b.lines : []).filter(l => l && l.note).map(l => [l.sku, cleanText(l.note, 80)])), hasRd = !!(q._rd.coupon || q._rd.freebie || q._rd.points);
  const stmts = [
    env.DB.prepare("INSERT INTO customers(phone,name,email,created_at,updated_at) VALUES(?,?,?,?,?) ON CONFLICT(phone) DO UPDATE SET name=?, email=COALESCE(NULLIF(?,''),email), updated_at=?").bind(tok.p, name, email || null, t, t, name, email, t),
    env.DB.prepare("INSERT INTO orders(id,phone,name,email,state,pay_method,slot_date,slot_time,meal,note,subtotal_minor,tax_minor,total_minor,gst_bp,gst_assumed,points_to_earn,token_nonce,created_at,updated_at,tip_minor,discount_minor,coupon_code,redeem_points,redeem_ref,loyalty_status) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)")
      .bind(id, tok.p, name, email || null, state0, method, slot.date, slot.time, sc.meal, note || null, q.subtotalMinor, q.taxMinor, q.totalMinor, f.gstBp, q.gstAssumed ? 1 : 0, (pi.member || b.join === true) ? q.pointsToEarn : 0, tok.n, t, t, q.tipMinor, q.discountMinor, q.redeem.coupon ? q.redeem.coupon.code : null, q.redeem.points ? q.redeem.points.points : 0, (q._rd.coupon || q._rd.freebie || {}).code || null, hasRd ? "reserved" : null),
    ...q.lines.map(l => env.DB.prepare("INSERT INTO order_items(order_id,sku,name,qty,unit_minor,line_minor,note) VALUES(?,?,?,?,?,?,?)").bind(id, l.sku, l.name, l.qty, l.unitMinor, l.lineMinor, notes.get(l.sku) || null)),
    ...(q.freebie ? [env.DB.prepare("INSERT INTO order_items(order_id,sku,name,qty,unit_minor,line_minor,note) VALUES(?,?,?,?,?,?,?)").bind(id, q.freebie.sku, q.freebie.name + " (free)", 1, 0, 0, null)] : []),
    ...reserveStmts(env.DB, id, tok.p, q._rd, t),
    env.DB.prepare("INSERT INTO consents(phone,order_id,kind,granted,wording_version,ts) VALUES(?,?,?,?,?,?)").bind(tok.p, id, "terms", 1, WORDING, t),
    env.DB.prepare("INSERT INTO consents(phone,order_id,kind,granted,wording_version,ts) VALUES(?,?,?,?,?,?)").bind(tok.p, id, "marketing", b.consent.marketing === true ? 1 : 0, WORDING, t),
  ];
  try { await env.DB.batch(stmts); } catch (e) { if (/redemptions/i.test(String(e.message))) return bad("offer_used", "That offer was already used. Please remove it and try again.", 409); if (/token_nonce|UNIQUE/i.test(String(e.message))) return bad("token_used", "That verification was already used. Please verify again.", 409); throw e; }
  if (b.join === true && !pi.member) { await loyalty(env).enrol(tok.p, name); await ev(env.DB, id, "join", null, t); }
  await ev(env.DB, id, "created", { method, total: q.totalMinor }, t);
  const order = { id, name, email, phone: tok.p, total_minor: q.totalMinor };
  if (method === "cod") {
    await cas(env.DB, id, "CREATED", "SENT_TO_KITCHEN", t, { via: "cod" }); await commitOrder(env.DB, id, t);
    await env.DB.prepare("INSERT INTO handoffs(order_id,channel,status,attempts,ts) VALUES(?,?,?,0,?)").bind(id, "order-board", "queued", t).run();
    return { ok: true, orderId: id, method, totalMinor: q.totalMinor };
  }
  await cas(env.DB, id, "CREATED", "PAYMENT_PENDING", t);
  return { ok: true, orderId: id, method, totalMinor: q.totalMinor, redirect: await buildRequest(env, order, origin) };
}
// Used by both /api/payu/callback and /api/payu/webhook. Safe to run twice for the same payment.
export async function processPayment(env, p) {
  const t = nowMs(env), id = String(p.txnid || ""); const log = (kind, d) => ev(env.DB, id || null, kind, d, t);
  const o = id ? await env.DB.prepare("SELECT * FROM orders WHERE id=?").bind(id).first() : null;
  if (!o || o.pay_method !== "payu") { await log("pay_unknown_order", { txnid: id }); return { ok: false, reason: "unknown_order" }; }
  const c = creds(env);
  if (!p.hash || (await responseHash(p, c.key, c.salt)) !== String(p.hash).toLowerCase()) { await log("pay_bad_hash", { status: p.status }); return { ok: false, reason: "bad_hash", id }; }
  const v = await verifyPayment(env, id);
  if (!v.found) { await log("pay_verify_missing", null); return { ok: false, reason: "not_verified", id }; }
  const paid = v.status === "success";
  if (!paid) {   // failed, cancelled, pending
    if (v.status === "pending") return { ok: true, id, state: o.state };
    await env.DB.prepare("INSERT INTO payments(order_id,provider,txnid,status,amount_minor,mihpayid,ts) VALUES(?,?,?,?,?,?,?)").bind(id, "site", id, v.status || "failure", v.amountMinor, v.mihpayid || null, t).run();
    if (await cas(env.DB, id, "PAYMENT_PENDING", "PAYMENT_FAILED", t, { gateway: v.status })) await releaseOrder(env.DB, id, t);
    return { ok: true, id };
  }
  // paid at the gateway: amount must equal the server total
  if (v.amountMinor !== o.total_minor) {
    await env.DB.prepare("UPDATE orders SET flag='AMOUNT_MISMATCH' WHERE id=?").bind(id).run();
    await cas(env.DB, id, ["PAYMENT_PENDING", "EXPIRED", "PAYMENT_FAILED"], "REFUND_NEEDED", t, { expected: o.total_minor, got: v.amountMinor });
    await log("alert", { what: "amount mismatch, no handoff", expected: o.total_minor, got: v.amountMinor });
    return { ok: false, reason: "amount_mismatch", id };
  }
  const first = await cas(env.DB, id, "PAYMENT_PENDING", "PAID", t, { mihpayid: v.mihpayid });
  if (first) {
    await commitOrder(env.DB, id, t);
    await env.DB.prepare("INSERT INTO payments(order_id,provider,txnid,status,amount_minor,mihpayid,ts) VALUES(?,?,?,?,?,?,?)").bind(id, "site", id, "success", v.amountMinor, v.mihpayid || null, t).run();
    await env.DB.prepare("INSERT INTO handoffs(order_id,channel,status,attempts,ts) VALUES(?,?,?,0,?)").bind(id, "order-board", "queued", t).run();
    await cas(env.DB, id, "PAID", "SENT_TO_KITCHEN", t);   // online orders reach the kitchen only after verified PAID
  } else if (o.state === "EXPIRED" || o.state === "PAYMENT_FAILED") {   // paid after we gave up: money taken, no order
    await cas(env.DB, id, [o.state], "REFUND_NEEDED", t, { late_payment: true }); await log("alert", { what: "late payment, refund needed" });
  }
  return { ok: true, id, duplicate: !first };
}
// Order status for the customer page. Unpaid PayU orders expire here (lazy, no cron in v1).
export async function orderStatus(env, id) {
  const f = flags(env), t = nowMs(env);
  let o = await env.DB.prepare("SELECT * FROM orders WHERE id=?").bind(id).first(); if (!o) return null;
  if (o.state === "PAYMENT_PENDING" && t - o.created_at > f.unpaidMin * 60000) { await cas(env.DB, id, "PAYMENT_PENDING", "EXPIRED", t, { reason: "unpaid_timeout" }); await releaseOrder(env.DB, id, t); o = await env.DB.prepare("SELECT * FROM orders WHERE id=?").bind(id).first(); }
  const it = await env.DB.prepare("SELECT name,qty,line_minor,note FROM order_items WHERE order_id=? ORDER BY id").bind(id).all();
  return { id: o.id, state: o.state, stage: stage(o), method: o.pay_method, slot: { date: o.slot_date, time: o.slot_time, meal: o.meal }, subtotalMinor: o.subtotal_minor, taxMinor: o.tax_minor, tipMinor: o.tip_minor, discountMinor: o.discount_minor, couponCode: o.coupon_code, totalMinor: o.total_minor, pointsToEarn: o.points_to_earn, gstAssumed: !!o.gst_assumed, items: it.results || [], createdAt: o.created_at };
}
