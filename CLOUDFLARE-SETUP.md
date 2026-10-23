# Cloudflare setup for online take away ordering (about 20 minutes, one time)

Do this on the Pages project that already serves the demo (the one connected to your GitHub repo).
Until you finish, the site keeps working exactly as before: the Take away button uses the WhatsApp/UPI flow.

## 1. Create the database (D1)
1. Cloudflare dashboard > **Storage & Databases** > **D1 SQL database** > **Create database**. Name: `swagramam-orders`.
2. Open it > **Console** tab. Open `db/schema.sql` from the repo, copy everything, paste into the console, press **Execute**.
   (If the console refuses the long paste, run it in the Codespace instead: `npx wrangler d1 execute swagramam-orders --remote --file=db/schema.sql`)

## 2. Create the key-value store (KV)
1. **Storage & Databases** > **KV** > **Create a namespace**. Name: `swagramam-kv`.

## 3. Connect both to the Pages project
1. **Workers & Pages** > your Pages project > **Settings** > **Bindings** > **Add**.
2. **D1 database**: variable name `DB` (capital letters), pick `swagramam-orders`.
3. **KV namespace**: variable name `KV`, pick `swagramam-kv`.
4. Add the binding to **Production** and to **Preview** if you use preview links.

## 4. Variables (Settings > Variables and Secrets)
| Name | Value | When |
|---|---|---|
| `TOKEN_SECRET` | any long random text (40+ characters) | Now. Required on the real site. Keep it secret. |
| `ENV` | leave empty for the demo. Set `production` on the real domain only. | Later |

Demo needs nothing else. Everything defaults to mock (test) mode: mock payment page, mock SMS code, mock loyalty.

## 5. Deploy and check
1. Push the repo (or **Deployments > Retry deployment**).
2. Open `https://YOUR-DEMO.pages.dev/api/health`. You should see `"live":true`.
3. Open the menu page, tap **Take away**, add a dish. The button now says **Continue to checkout**.
4. On the checkout page the test SMS code is shown on screen (demo only). Pay with the **mock gateway** page. No money moves.

If `/api/health` says `"live":false`: the `DB` or `KV` binding is missing or misspelt (step 3), or the schema was not run (step 1).

## Switching on real services (no rebuild). v96: code for all three is in place; add keys, set the flag, redeploy.
Add secrets under Settings > Variables and Secrets. Then open `/api/admin/selfcheck` with header `x-admin-key: <ADMIN_KEY>` (shows which settings are present, never values).

| Item | Variables |
|---|---|
| Admin check | `ADMIN_KEY` (secret, any long text) |
| PayU test | `PAYMENT_PROVIDER=payu`, `PAYU_ENV=test`, `PAYU_KEY`, `PAYU_SALT` (secrets). In the PayU dashboard set success and failure URL to `https://YOUR-DOMAIN/api/payu/callback`, webhook to `https://YOUR-DOMAIN/api/payu/webhook`. |
| PayU live | replace the two secrets, `PAYU_ENV=live` |
| SMS OTP (MSG91 + DLT) | `OTP_PROVIDER=msg91`, `MSG91_AUTHKEY` (secret), `MSG91_TEMPLATE_ID` (DLT-approved OTP template). Optional `MSG91_OTP_VAR` (template variable name, default `OTP`). Template must carry the 6-digit code variable. |
| Reelo | `LOYALTY_PROVIDER=reelo`, `REELO_BASE_URL`, `REELO_VENDOR_ID`, `REELO_MERCHANT_ID`, `REELO_CUSTOMER_KEY` (all from Reelo). |
| Reelo: send website bills | `REELO_CAPTURE=on` ONLY after the double-credit decision (POS must not also send the same order). Default off. |
| Reelo menu | run `node tools/reelo-push-menu.mjs` with the four REELO_ values in the terminal (add `--dry` to preview). Re-run after any menu change. |
| Reelo onboarding | Reelo calls `POST https://YOUR-DOMAIN/v1/pos/integrations/<vendor_id>/verify` (also `/api/reelo/verify`). It answers with `merchant_id` and `customer_key`. Confirm the exact path with Reelo. |
| GST confirmed | `GST_CONFIRMED=true` |
| Pay at pickup off | `COD_LIVE=false` |
| Close online ordering | `ONLINE_ORDER_LIVE=false` |
| Production | `ENV=production` and `ONLINE_ORDER_LIVE=true` (production is closed until both are set) |

**Safety rules built in:** `ENV=production` refuses mock payment and mock SMS. A wrong or missing MSG91 key blocks ordering (health shows not live). A wrong Reelo setting never blocks ordering: checkout does not call Reelo; points are sent after the order completes.

## Payment rule (server-enforced)
Total up to Rs 1000.00 (including GST and tip): Pay online (PayU) and Pay at pickup both offered. Above Rs 1000.00: Pay online only. Limit = `COD_MAX_TOTAL_MINOR` (default 100000). On the real site (`ENV=production`) Pay at pickup is OFF until you set `COD_LIVE=on`.
