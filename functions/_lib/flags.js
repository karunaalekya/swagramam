// Feature flags and provider switches. Mock is the default everywhere except production.
const on = (v, d) => (v == null || v === "" ? d : /^(1|true|on|yes)$/i.test(String(v)));
export function flags(env) {
  const prod = (env.ENV || "staging") === "production";
  return {
    prod,
    live: on(env.ONLINE_ORDER_LIVE, !prod),            // off = site falls back to WhatsApp buttons
    codLive: on(env.COD_LIVE, !prod),                  // pay at pickup switch
    codMaxMinor: +(env.COD_MAX_TOTAL_MINOR || 100000),  // Rs 1000.00, total including taxes
    payment: String(env.PAYMENT_PROVIDER || "mock").toLowerCase(),   // mock | payu
    otp: String(env.OTP_PROVIDER || "mock").toLowerCase(),           // mock | msg91
    loyalty: String(env.LOYALTY_PROVIDER || "mock").toLowerCase(),   // mock | reelo
    gstConfirmed: on(env.GST_CONFIRMED, false),
    gstBp: +(env.GST_BP || 500),                        // 500 = 5.00%
    prepMin: +(env.PREP_MIN || 25), slotMin: +(env.SLOT_MIN || 30), slotCap: +(env.SLOT_CAP || 8), days: +(env.ORDER_DAYS || 7),
    unpaidMin: +(env.UNPAID_TIMEOUT_MIN || 30), openCodCap: +(env.COD_OPEN_CAP || 2), noShowLimit: +(env.NOSHOW_LIMIT || 2),
  };
}
// Production refuses mock OTP and mock gateway, so a mock can never go live by accident.
export function problem(env) {
  const f = flags(env);
  if (f.prod && f.payment === "mock") return "PAYMENT_PROVIDER is mock in production";
  if (f.prod && f.otp === "mock") return "OTP_PROVIDER is mock in production";
  if (f.prod && !env.TOKEN_SECRET) return "TOKEN_SECRET is missing";
  if (f.payment === "payu" && !(env.PAYU_KEY && env.PAYU_SALT)) return "PAYU_KEY / PAYU_SALT missing";
  if (f.otp === "msg91" && !(env.MSG91_AUTHKEY && env.MSG91_TEMPLATE_ID)) return "MSG91_AUTHKEY / MSG91_TEMPLATE_ID missing";
  return null;
}
// Non-blocking config notes (shown in selfcheck and, off production, in /api/health). Ordering never stops because loyalty is misconfigured.
export function warnings(env) {
  const f = flags(env), w = [];
  if (f.payment === "payu") { if (!["test", "live"].includes(String(env.PAYU_ENV || "test"))) w.push("PAYU_ENV must be test or live"); if (f.prod && env.PAYU_ENV !== "live") w.push("production is using PayU test mode"); }
  if (f.otp === "msg91") for (const k of ["MSG91_AUTHKEY", "MSG91_TEMPLATE_ID"]) if (!env[k]) w.push(k + " missing");
  if (f.loyalty === "reelo") { for (const k of ["REELO_BASE_URL", "REELO_VENDOR_ID", "REELO_MERCHANT_ID", "REELO_CUSTOMER_KEY"]) if (!env[k]) w.push(k + " missing"); if (!/^(1|true|on|yes)$/i.test(String(env.REELO_CAPTURE || ""))) w.push("REELO_CAPTURE is off: website bills are not sent to Reelo (POS path)"); }
  if (f.prod && f.loyalty === "mock") w.push("loyalty is mock in production");
  return w;
}
export const ready = env => { const f = flags(env); return f.live && !problem(env); };
