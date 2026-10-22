import { json, safeEq } from "../../_lib/util.js";
import { warnings, flags } from "../../_lib/flags.js";
// Owner check after adding keys: GET /api/admin/selfcheck with header x-admin-key = ADMIN_KEY. Shows which settings are present. Never prints a value.
export async function onRequestGet({ env, request }) {
  const k = request.headers.get("x-admin-key") || "";
  if (!env.ADMIN_KEY || !safeEq(k, env.ADMIN_KEY)) return new Response("Not found", { status: 404 });
  const f = flags(env), has = n => !!env[n];
  return json({ ok: true, env: f.prod ? "production" : "staging", providers: { payment: f.payment, otp: f.otp, loyalty: f.loyalty },
    present: { TOKEN_SECRET: has("TOKEN_SECRET"), PAYU_KEY: has("PAYU_KEY"), PAYU_SALT: has("PAYU_SALT"), PAYU_ENV: env.PAYU_ENV || null,
      MSG91_AUTHKEY: has("MSG91_AUTHKEY"), MSG91_TEMPLATE_ID: has("MSG91_TEMPLATE_ID"),
      REELO_BASE_URL: has("REELO_BASE_URL"), REELO_VENDOR_ID: has("REELO_VENDOR_ID"), REELO_MERCHANT_ID: has("REELO_MERCHANT_ID"), REELO_CUSTOMER_KEY: has("REELO_CUSTOMER_KEY"), REELO_CAPTURE: env.REELO_CAPTURE || "off",
      DB: has("DB"), KV: has("KV") }, warnings: warnings(env) });
}
