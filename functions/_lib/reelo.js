// Reelo provider (same interface as the mock in loyalty.js). Built from Reelo's POS API reference (capture-dev docs, 22 Oct 2026).
// Secrets/vars: REELO_BASE_URL, REELO_VENDOR_ID, REELO_MERCHANT_ID, REELO_CUSTOMER_KEY (all from Reelo; production URL is NOT in their docs).
// REELO_CAPTURE=on  -> the website sends its own bills to Reelo (order_from=own_website). Default off = the POS is the only sender (no double credit, D1/D5).
// Reelo has no enrol call (a member exists after the first captured bill) and no coupon release call, so enrol is local consent only and redemption stays in-store (D6).
import { nowMs, ev } from "./util.js";
import { ITEMS, CATS, BY_SKU } from "./menu.js";
const RETRY_STATUS = new Set([408, 500, 503]);
export const reeloMissing = env => ["REELO_BASE_URL", "REELO_VENDOR_ID", "REELO_MERCHANT_ID", "REELO_CUSTOMER_KEY"].filter(k => !env[k]);
const rs = m => Math.round(m) / 100;                    // paise -> rupees (number)
const price4 = m => (m / 100).toFixed(4);               // "200.0000"
const mob91 = p => "91" + p;
function istStamp(ms) { const d = new Date(ms + 330 * 60000), z = n => String(n).padStart(2, "0"); return d.getUTCFullYear() + "-" + z(d.getUTCMonth() + 1) + "-" + z(d.getUTCDate()) + " " + z(d.getUTCHours()) + ":" + z(d.getUTCMinutes()) + ":" + z(d.getUTCSeconds()); }
const sleep = ms => new Promise(r => setTimeout(r, ms));
// Reelo error shapes differ: {status_code,response:{message}}, {status_code,message}, {error}, {response:{points_value}}.
export function reeloMessage(j) { if (!j) return ""; return String((j.response && (j.response.message || j.response.points_value)) || j.message || j.error || ""); }
export function reelo(env) {
  const base = String(env.REELO_BASE_URL || "").replace(/\/+$/, ""), url = path => base + "/v1/pos/integrations/" + env.REELO_VENDOR_ID + path;
  const ids = () => ({ customer_key: env.REELO_CUSTOMER_KEY, merchant_id: env.REELO_MERCHANT_ID });
  const waits = (env.REELO_RETRY_MS ? String(env.REELO_RETRY_MS).split(",").map(Number) : [2000, 4000]);
  // One call with backoff on 408/500/503/network (2s, 4s, max 3 attempts). correlationId is logged on every call.
  async function call(method, path, body, orderId, extraHeaders) {
    const miss = reeloMissing(env); if (miss.length) return { ok: false, status: 0, error: "reelo_config", message: "missing " + miss.join(",") };
    let last;
    for (let a = 0; a <= waits.length; a++) {
      let res, j = null;
      try { res = await fetch(url(path), { method, headers: { "content-type": "application/json", ...(extraHeaders || {}) }, body: JSON.stringify(body) }); try { j = await res.json(); } catch {} }
      catch (e) { last = { ok: false, status: 0, error: "network", message: String(e && e.message || e).slice(0, 100) }; if (a < waits.length) { await sleep(waits[a]); continue; } break; }
      const code = (j && j.status_code) || res.status, cid = (j && (j.correlationId || (j.response && j.response.correlationId))) || res.headers.get("x-correlation-id") || null;
      try { await ev(env.DB, orderId || null, "reelo_call", { path, http: res.status, code, correlationId: cid, attempt: a + 1 }, nowMs(env)); } catch {}
      last = { ok: code >= 200 && code < 300 && !(j && j.error), status: code, message: reeloMessage(j), data: j, correlationId: cid };
      if (last.ok || !(RETRY_STATUS.has(res.status) || RETRY_STATUS.has(code)) || a === waits.length) break;
      await sleep(waits[a]);
    }
    return last;
  }
  const db = env.DB;
  return {
    name: "reelo",
    // Balance and coupons. "Customer not found" is normal for someone who has never had a captured bill.
    async lookup(phone) {
      const loc = await db.prepare("SELECT member,name,noshows FROM customers WHERE phone=?").bind(phone).first();
      const r = await call("POST", "/rewards/customer", { ...ids(), customer_mobile: phone });
      if (!r.ok) {
        if (r.status === 400 && /not found/i.test(r.message)) return { exists: !!loc, member: !!(loc && loc.member), name: loc && loc.name, points: 0, noshows: loc ? loc.noshows : 0, coupons: [] };
        return { exists: !!loc, member: !!(loc && loc.member), points: null, noshows: loc ? loc.noshows : 0, coupons: [], error: r.error || ("reelo_" + r.status) };
      }
      const d = (r.data && (r.data.response || r.data.data)) || r.data || {};
      return { exists: true, member: true, name: loc && loc.name, points: Number(d.loyalty_points || 0), allowRedemptionToday: d.allow_redemption_today !== false, minBillForRedemption: d.min_bill_for_redemption || 0, redeemablePoints: d.total_redeemable_points || 0, coupons: Array.isArray(d.coupons) ? d.coupons : [], noshows: loc ? loc.noshows : 0 };
    },
    // No Reelo enrol endpoint: record consent and membership locally. Reelo creates the member on the first captured bill.
    async enrol(phone, name) { const t = nowMs(env);
      await db.prepare("INSERT INTO customers(phone,name,member,created_at,updated_at) VALUES(?,?,1,?,?) ON CONFLICT(phone) DO UPDATE SET member=1, name=COALESCE(NULLIF(?,''),name), updated_at=?").bind(phone, name || null, t, t, name || "", t).run();
      return { ok: true, note: "member appears in Reelo after the first captured bill" }; },
    async balance(phone) { const r = await this.lookup(phone); return r.points; },
    // Build Reelo's bill from our own order (server data only). Rupees, mobile with 91, order_from=own_website, id = our order id.
    async bill(orderId) {
      const o = await db.prepare("SELECT * FROM orders WHERE id=?").bind(orderId).first(); if (!o) return null;
      const it = (await db.prepare("SELECT sku,name,qty,unit_minor,line_minor FROM order_items WHERE order_id=? ORDER BY id").bind(orderId).all()).results || [];
      const cust = await db.prepare("SELECT name,email FROM customers WHERE phone=?").bind(o.phone).first();
      const gst = o.tax_minor ? [{ name: "GST", percentage: o.gst_bp / 100, amount: rs(o.tax_minor) }] : [];
      return { ...ids(), customer: { mobile: mob91(o.phone), name: (cust && cust.name) || o.name || "", email: (cust && cust.email) || o.email || "" },
        transaction: { id: o.id, number: o.id, type: "take_away", payment_type: o.pay_method === "payu" ? "Online" : "Cash", order_from: "own_website",
          order_time: istStamp(o.slot_date && o.slot_time ? Date.parse(o.slot_date + "T" + o.slot_time + ":00+05:30") : o.created_at),
          gross_amount: rs(o.subtotal_minor), net_amount: rs(o.total_minor - (o.tip_minor || 0)), amount: rs(o.total_minor - (o.tip_minor || 0)), discount: rs(o.discount_minor || 0),   // tip is staff money, not sale revenue; UNCONFIRMED with Reelo (open question 6)
          charges: [], taxes: gst,
          items: it.map(x => { const m = BY_SKU.get(x.sku); return { id: x.sku, name: x.name, rate: rs(x.unit_minor), quantity: x.qty, subtotal: rs(x.line_minor), category: m ? CATS[m.cat] || "" : "", addon: [] }; }) } };
    },
    // earn: send the bill once. Skipped unless REELO_CAPTURE=on. "Transaction already exists" counts as done (idempotent on transaction.id).
    async earn(phone, orderId, points, path) { const t = nowMs(env);
      if (!/^(1|true|on|yes)$/i.test(String(env.REELO_CAPTURE || ""))) return { ok: true, skipped: "reelo_capture_off" };
      try { await db.prepare("INSERT INTO loyalty_events(phone,order_id,type,points,path,ts) VALUES(?,?,?,?,?,?)").bind(phone, orderId, "earn", points || 0, path || "api", t).run(); }
      catch (e) { return { ok: true, duplicate: true }; }
      const b = await this.bill(orderId); if (!b) { await db.prepare("DELETE FROM loyalty_events WHERE order_id=? AND type='earn'").bind(orderId).run(); return { ok: false, error: "no_order" }; }
      const r = await call("POST", "/bill/customer", b, orderId);
      if (r.ok || /already exists/i.test(r.message)) { await db.prepare("UPDATE orders SET points_credit_path=? WHERE id=? AND points_credit_path IS NULL").bind(path || "api", orderId).run(); return { ok: true, duplicate: !r.ok, correlationId: r.correlationId }; }
      await db.prepare("DELETE FROM loyalty_events WHERE order_id=? AND type='earn'").bind(orderId).run();   // let a later retry send it again
      return { ok: false, error: r.error || "reelo_" + r.status, message: r.message, correlationId: r.correlationId };
    },
    // Redemption (not wired to the site in v1; the methods are ready). Reelo sends its own 4-digit OTP.
    async reserveRedemption(phone, { couponCode, points }) { return call("POST", "/points/authenticate", { ...ids(), customer_mobile: phone, ...(couponCode ? { coupon_code: couponCode } : { points }) }); },
    async commit(phone, { couponCode, points, otp }) { return couponCode ? call("POST", "/redeem/coupon", { ...ids(), customer_mobile: phone, coupon_code: couponCode, otp }) : call("POST", "/redeem/points", { ...ids(), customer_mobile: phone, points, otp }); },
    async release() { return { ok: false, unsupported: true, note: "Reelo has no release call; a redeemed coupon is consumed" }; },
    // Refund paths for REFUND_NEEDED orders.
    async revert(orderId) { return call("POST", "/revert-points", { ...ids(), transaction_id: orderId }, orderId); },
    async saleReturn(orderId, refundId, refundType = "card") {
      const b = await this.bill(orderId); if (!b) return { ok: false, error: "no_order" }; const x = b.transaction;
      return call("POST", "/sale-return", { merchant_id: env.REELO_MERCHANT_ID, customer_mobile: b.customer.mobile.slice(2), transaction: { id: refundId, number: refundId, reference_transaction_id: orderId, refund_type: refundType, order_type: "sale_return", order_from: "own_website", gross_amount: x.gross_amount, net_amount: x.net_amount, amount: x.amount, items: [], charges: [], taxes: x.taxes, order_time: istStamp(nowMs(env)) } }, orderId); },
    // Full menu replace. Stable ids = our SKUs. price is a 4-decimal string.
    async pushMenu() {
      const items = ITEMS.filter(i => i.available).map(i => ({ id: i.sku, name: i.name, category_id: i.cat, category: CATS[i.cat] || "", price: price4(i.priceMinor) }));
      const r = await call("POST", "/menu", { ...ids(), items }); return { ...r, count: items.length };
    },
  };
}
