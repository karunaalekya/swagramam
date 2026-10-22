// Reelo calls this on our server when the merchant is onboarded (their sample: POST {base}/v1/pos/integrations/{Vendor_Id}/verify {merchant_id}).
// Exact path and response for a website integration are unconfirmed (question 2 to Reelo), so both routes below answer in their sample shape.
import { reeloMissing } from "./reelo.js";
import { safeEq } from "./util.js";
const J = (o, s) => new Response(JSON.stringify(o), { status: s, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", "x-robots-tag": "noindex" } });
export async function verifyMerchant(env, request, vendorFromPath) {
  let b = null; try { b = JSON.parse((await request.text()).slice(0, 4000)); } catch {}
  const miss = ["REELO_VENDOR_ID", "REELO_MERCHANT_ID", "REELO_CUSTOMER_KEY"].filter(k => !env[k]);
  if (miss.length) return J({ status: false, message: "Integration not configured" }, 503);
  if (vendorFromPath && !safeEq(vendorFromPath, env.REELO_VENDOR_ID)) return J({ status: false, message: "Unknown vendor" }, 404);
  if (!b || !b.merchant_id || !safeEq(String(b.merchant_id), env.REELO_MERCHANT_ID)) return J({ status: false, message: "Merchant not recognised" }, 404);
  return J({ status: true, message: "Merchant verified", data: { merchant_id: env.REELO_MERCHANT_ID, customer_key: env.REELO_CUSTOMER_KEY } }, 200);
}
