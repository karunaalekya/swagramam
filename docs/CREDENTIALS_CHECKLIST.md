# Credential swap checklist: what to set when the client gives each item
Rule: paste values only into Cloudflare > Pages project > Settings > Variables and Secrets (Production AND Preview). Never in chat, the repo or a zip. After any change: Deployments > Retry, then run the preflight.

Check any time (read-only, sends no SMS, creates no order):
`node tools/preflight.mjs https://YOUR-DOMAIN YOUR_ADMIN_KEY` (use `--expect=live` before launch)
The same report is at `/api/admin/selfcheck` with header `x-admin-key`. It lists what is missing, never values.

| When the client gives | Set these | Then | Test |
|---|---|---|---|
| Cloudflare access (Phase 0) | bindings `DB`, `KV`; secrets `TOKEN_SECRET` (openssl rand -hex 32), `ADMIN_KEY`; `ONLINE_ORDER_LIVE=off` on Production | run db/schema.sql, then migrations 002, 003 | preflight shows infra PASS; Preview /api/health live true |
| MSG91 authkey and DLT template id | `OTP_PROVIDER=msg91`, `MSG91_AUTHKEY`, `MSG91_TEMPLATE_ID` (optional `MSG91_OTP_VAR`) | redeploy | real OTP on a real phone in under 30 s |
| PayU test key and salt | `PAYMENT_PROVIDER=payu`, `PAYU_ENV=test`, `PAYU_KEY`, `PAYU_SALT` | in PayU dashboard set success and failure URL `https://DOMAIN/api/payu/callback`, webhook `https://DOMAIN/api/payu/webhook` | PayU test card and UPI; order turns paid on the server |
| Reelo base URL and ids | `LOYALTY_PROVIDER=reelo`, `REELO_BASE_URL`, `REELO_VENDOR_ID`, `REELO_MERCHANT_ID`, `REELO_CUSTOMER_KEY` (keep `REELO_CAPTURE=off` until the double-credit decision) | `node tools/reelo-push-menu.mjs --dry` then without --dry | lookup shows points; coupon panels need the Reelo offers provider (needs their answers) |
| Final coupons, freebie, points value | `OFFERS_JSON` (one line, format in functions/_lib/offers.js) | redeploy | quote with each code; selfcheck offersConfig PASS |
| GST confirmed | `GST_CONFIRMED=true` (and `GST_BP` if not 500) | redeploy | menu shows gstAssumed false |
| PayU live key and salt | replace `PAYU_KEY`, `PAYU_SALT`, set `PAYU_ENV=live` | redeploy | one real Rs 10 payment and refund |
| Launch day | `ENV=production`, `ONLINE_ORDER_LIVE=on`, `COD_LIVE=on` (if pay at pickup wanted) | redeploy | `preflight --expect=live` says READY |
| Rollback | `ONLINE_ORDER_LIVE=off` | redeploy | site goes back to the WhatsApp/UPI flow |

OFFERS_JSON example (one line in Cloudflare):
{"coupons":[{"code":"WELCOME10","title":"10% off","desc":"10% off up to Rs 100 on Rs 300+","pct":10,"maxMinor":10000,"minMinor":30000}],"points":{"valueMinor":5,"min":200,"step":20,"capPct":50}}
