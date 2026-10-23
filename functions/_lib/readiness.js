// What is still missing before each stage can run for real. Presence only, never values. Used by /api/admin/selfcheck and tools/preflight.mjs.
import { flags } from "./flags.js";
import { parseOffers } from "./offers.js";
export function readiness(env) {
  const f = flags(env), has = n => !!env[n], miss = (...ns) => ns.filter(n => !has(n)), item = (ok, missing, note) => ({ ok, missing, note: note || null });
  const infra = miss("DB", "KV", "TOKEN_SECRET", "ADMIN_KEY");
  const payu = f.payment === "payu" ? miss("PAYU_KEY", "PAYU_SALT") : ["PAYMENT_PROVIDER=payu"];
  const msg = f.otp === "msg91" ? miss("MSG91_AUTHKEY", "MSG91_TEMPLATE_ID") : ["OTP_PROVIDER=msg91"];
  const reelo = f.loyalty === "reelo" ? miss("REELO_BASE_URL", "REELO_VENDOR_ID", "REELO_MERCHANT_ID", "REELO_CUSTOMER_KEY") : ["LOYALTY_PROVIDER=reelo"];
  const O = parseOffers(env);
  const live = [];
  if (!f.prod) live.push("ENV=production"); if (!f.live) live.push("ONLINE_ORDER_LIVE=on"); if (f.payment !== "payu") live.push("PAYMENT_PROVIDER=payu"); if (f.otp !== "msg91") live.push("OTP_PROVIDER=msg91");
  if (env.PAYU_ENV !== "live") live.push("PAYU_ENV=live"); if (!f.gstConfirmed) live.push("GST_CONFIRMED=true (after owner and accountant confirm)"); if (!f.codLive) live.push("COD_LIVE=on (only if pay at pickup is wanted)");
  if (f.loyalty === "mock") live.push("LOYALTY_PROVIDER=reelo (or accept that offers are mock)"); if (O.error) live.push(O.error);
  return { infra: item(!infra.length, infra), payu: item(!payu.length, payu, "Phase 3 and 5"), msg91: item(!msg.length, msg, "Phase 3"), reelo: item(!reelo.length, reelo, "Phase 2"), offersConfig: item(!O.error, O.error ? ["OFFERS_JSON"] : [], env.OFFERS_JSON ? "custom offers in use" : "default mock offers in use"), goLiveBlockers: live };
}
