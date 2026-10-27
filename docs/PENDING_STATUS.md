# Swagramam ordering: status and pending (23 Oct 2026)

| Phase | Status |
|---|---|
| 0 Cloudflare in client account | NOT DONE (owner). D1, KV, bindings, secrets, Preview deploy, health output |
| 1 Checkout rebuild (mock) | DONE and tested. Tip card and summary now follow the Biryanis screenshots (chips 5/10/15/Other, 5% preselected with X, tip amount and GST amount lines, points earning row) |
| 2 Loyalty redemption | MOCK DONE (coupon, freebie, points, reserve/commit/release, expiry, 55 unit tests). Reelo part BLOCKED on answers |
| 3 Real OTP and PayU test | NOT STARTED. Needs MSG91 key and DLT template, PayU test key and salt |
| 4 Order Board, counter flow, alerts | BUILT on mock 27 Oct (board.html, staff PIN). Automatic SMS and owner alerts wait for DLT / WhatsApp API |
| 5 Go live and harden | NOT STARTED |

## Payment rule (built, tested)
Total up to Rs 1000.00 incl. GST and tip: Pay online (PayU) and Pay at pickup. Above: PayU only. In production set COD_LIVE=on or pickup stays hidden.

## Pending for the owner
1. Phase 0 in Cloudflare (CLOUDFLARE-SETUP.md), then run db/migrations 002 and 003 after schema.sql. Paste /api/health for Preview and Production.
2. Send the Reelo email (docs/Phase2_Reelo_Email_and_Open_Answers.md) and paste the answers.
3. Start MSG91 DLT OTP template now (slowest item). Open MSG91, PayU, Reelo accounts in the client's name.
4. Decide: GST rate and basis (D3), offers stacking (D6), tip limit (30% or Rs 500), real coupons and points value, owner alert phone and board login, refund and cancellation wording, final prices and menu, domain (.in or .com), real photos, "Britisher la Mushroom" name, "Multi Cuisine" vs "South Indian Kitchen".

## Pending for Claude (next sessions)
- Phase 2: Reelo offers provider or post-payment fallback; sandbox test. Reelo bill capture format (discount, tip excluded) is a guess until confirmed.
- Phase 3: real MSG91 and PayU test run, hash, webhook and callback checks, OTP limits.
- Phase 4: Order Board, accept/reject, ready SMS, no-show rule, sound alert, owner alerts, 80 mm ticket.
- Phase 5: go-live checklist, rate limits, security headers, logging, D1 backup, rollback switch, Safari/Firefox/real phones, Rs 10 live payment and refund.

## Not tested anywhere yet
Real Cloudflare D1/KV (incl. ALTER TABLE migration 002), real PayU, MSG91, Reelo, real phones, Safari, Firefox, screen reader.

## Credential-ready work (23 Oct 2026)
Built so that client credentials are a swap, not a rebuild:
- docs/CREDENTIALS_CHECKLIST.md: for each item the client gives (Cloudflare, MSG91, PayU test/live, Reelo, offers, GST, launch) the exact variables, redeploy step and test.
- tools/preflight.mjs: read-only go-live check (`node tools/preflight.mjs https://DOMAIN ADMIN_KEY [--expect=live]`). Sends no SMS, creates no order.
- /api/admin/selfcheck now returns `readiness` (missing items per stage, go-live blockers). Presence only, never values.
- OFFERS_JSON variable: real coupons, free dish and points rule set in Cloudflare with no code change; bad JSON falls back to defaults and is flagged.
- .dev.vars.example lists every variable by phase.
- _headers: security headers added (nosniff, frame, referrer, permissions). Verify on Cloudflare with preflight.
Still needs code once info arrives: Reelo offers provider (their answers), Phase 4 board and alerts, Phase 5 hardening items (rate limits, logging, D1 backup).
