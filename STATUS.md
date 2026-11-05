# Swagramam: project status (site v96, 22 Oct 2026)

Read this first in a new Codespace session. Then HANDOFF.md (version-by-version change log, v88 to v96) and docs/Swagramam_Ordering_Master_Plan.md (single source of truth for ordering; sections 5, 11, 13, 14, 15).

## Already done
**Website (static, Cloudflare Pages)**
- Pages: Home, About, Menu, Rewards (v94), Catering, Privacy, Terms, plus checkout.html (noindex).
- Chat buttons (WhatsApp + Instagram) with live open/closed panel (v88); wordmark + sunrise page transitions (v89).
- Phone layout: nav strip, header icons for Book / Call / Directions, phone landing and intro (v91, v92, v93).
- Intro shortened (~13 s), stats count-up, next-step bands on inner pages (v92).
- Audit passed on 6 pages at 1440 and 390 px (v90, v92).

**Ordering (Session 1, v95, on mock providers)**
- API in `functions/api/`: health, menu, quote, slots, otp/send, otp/verify, checkout/start, order/status, order/lookup, payu/callback, payu/webhook, mock-pay.
- Server decides prices, GST (5%, assumed, half-up), slots, the Rs 1000 payment rule and the open-order cap (2). Money in integer paise.
- D1 schema `db/schema.sql`; state machine; consent records; unpaid-order expiry (30 min); no-show check; pay-at-pickup order creation.
- Order popup goes to checkout.html only when /api/health says live; otherwise the old WhatsApp/UPI flow runs.
- `ENV=production` refuses mock payment and mock SMS.

**Switch-on code (v96)**
- MSG91 SMS (`OTP_PROVIDER=msg91`), Reelo loyalty (`LOYALTY_PROVIDER=reelo`, `REELO_CAPTURE` off by default), Reelo/POS verify endpoints, admin selfcheck, config warnings, `tools/reelo-push-menu.mjs`.
- PayU code was already in v95: needs keys only.
- WhatsApp Business + SEO pack: `WHATSAPP-BUSINESS-SEO-PACK.md`, `tools/make-wa-catalogue.mjs`, `tools/wa-links.mjs`, `tools/apply-seo.mjs`.
- Live-domain SEO: canonicals and JSON-LD on swagramam.in, robots.txt, sitemap.xml, noindex only on checkout.

**Tests (38 pass in this package)**: `node --no-warnings --test tools/test/*.test.mjs`. Browser check: `node --no-warnings tools/dev-server.mjs 8787` then `python3 tools/test/e2e.py`.

## NOT done / not tested
- Never run on real Cloudflare D1/KV (tests use a SQLite stand-in). Follow CLOUDFLARE-SETUP.md.
- Not tested: real MSG91 SMS, real Reelo calls (production base URL not in their docs), real PayU, a real phone, Safari, Firefox, a real UPI payment.
- `make-wa-catalogue.mjs` and `apply-seo.mjs` not run against the real menu and HTML.
- Session 2 (still to build): Order Board, counter flow (mark paid, no-show), owner alerts, loyalty pages online (`rewards-online` panel says "Opening soon"), refund/cancellation page drafts.
- Session 3: switch on real keys, harden, go live.
- Karnataka card on the cuisine map needs 3 real photos (Ghee Dosa, Military Veg Biryani, Nagarjuna Chilli Chicken).
- Legal pages still hide the chat buttons.

## Waiting on owner
MSG91 key + DLT template id, Reelo base URL / vendor id / merchant id / customer key, PayU key + salt, GST basis, POS name, final domain confirmation (.in used in v96; older files said .com), Google Business Profile link, real photos, the "Britisher la Mushroom" dish name, and whether titles should keep "Multi Cuisine" (intro sign says "South Indian Kitchen").

## Resume prompt
"Continue Swagramam from STATUS.md, HANDOFF.md and docs/Swagramam_Ordering_Master_Plan.md. Next: Session 2 (Order Board, counter flow, alerts, loyalty pages)."


## v97 plan update (22 Oct 2026)
FINAL phase-wise plan: docs/Swagramam_Ordering_Plan_v2_FINAL.md (replaces the 3-session path). Verified baseline: backend code exists on mock; tip, coupon, freebies, points redemption, guest/sign-in screen, Order Board NOT built; Cloudflare D1/KV never set up.
Resume prompt: "Continue Swagramam. Read STATUS.md and docs/Swagramam_Ordering_Plan_v2_FINAL.md. Phase 0 is done in the client Cloudflare account (health outputs pasted). Do Phase 1 only (checkout rebuild, tip, discount fields). Deliver a zip after each task."


## v97 Phase 1 + Phase 2 (mock) built, 23 Oct 2026
Delivered in swagramam-v97-phase1.zip. Phase 0 (real Cloudflare D1/KV) still needs the owner; nothing here has touched real Cloudflare.
**Built:** checkout rebuilt to the Biryanis pattern (pickup banner + Change, sign in/guest, 6-box OTP with 30 s resend, cart with +/-, notes, delete, tip 5/10/15/Other with 5% preselected and removable, coupon and freebie panels, points slider, payment summary with GST tooltip). Server: `functions/_lib/pricing.js` (one money path: discount -> GST on taxable -> tip untaxed -> total), `offers.js` (mock coupons SWAG10, FLAT50, BIGEAT25, CLUB15, free dessert, points 1 pt = Rs 0.05, min 200, step 20, max 50% of bill), `redeem.js` (reserve -> commit on payment or pay-at-pickup -> release on failure or 30 min expiry), `api/offers.js`. Quote and checkout/start accept `tip` and `redeem`; browser never sends amounts. Pay-at-pickup limit uses total including tip. PayU amount includes tip.
**Migrations (owner runs after schema.sql, in order):** `db/migrations/002_tip_discount.sql` (run once), `003_redemptions.sql`.
**Tests:** 48 unit tests pass (`node --no-warnings --test tools/test/*.test.mjs`), 55 browser checks pass at 390 and 1280 (`SEED_MEMBER=9876500022:1000 node --no-warnings tools/dev-server.mjs 8787`, then `python3 tools/test/e2e.py`).
**NOT tested:** real Cloudflare D1 (migration 002 ALTER TABLE on real D1), real Reelo (provider has no coupon list/reserve/release; with LOYALTY_PROVIDER=reelo the panels say "redeemed at the restaurant"), real PayU/MSG91, real phone, Safari, Firefox. Mock offer rules and point value are placeholders until Reelo answers (plan Phase 2 questions). Reelo bill capture (`reelo.js`) still sends discount 0 and net = total incl. tip; fix when Reelo confirms the format. GST 5% still assumed (D3).
**Next:** Phase 0 by owner, then Phase 3 (real OTP, PayU test) or Phase 2 Reelo adapter after answers.

v97 final check (23 Oct 2026): font-weight pass in checkout.css (cache v3), payment-rule test added (49 unit tests, 55 browser checks pass). Production needs COD_LIVE=on for pay at pickup.

## v97 Phase 2 (mock side complete), 23 Oct 2026
Added: coupon expiry (mock DIWALI20 expired, for tests), Reelo bill now sends discount and leaves the tip out of net (UNCONFIRMED, Reelo question 6), tests for expired coupon, simultaneous double submit, replayed token, webhook replay, discount clamps, and full payment fail/success paths (55 unit tests). Email text and answers tracker: docs/Phase2_Reelo_Email_and_Open_Answers.md.
BLOCKED on Reelo (owner): real offers, reserve/release, sandbox test. Placeholder offer rules stay until then.

23 Oct 2026 final: tip card and summary restyled to the Biryanis screenshots (tip amount and GST amount shown). Pending list: docs/PENDING_STATUS.md. 55 unit tests, 57 browser checks pass.

23 Oct 2026 credential-ready pass: OFFERS_JSON, readiness report, tools/preflight.mjs, CREDENTIALS_CHECKLIST, .dev.vars.example, security headers. 57 unit tests pass.

## v97 + CMS steps 1a, 1b, 2 merged (23 Oct 2026)
Merged into this package: `cms/` (Sanity Studio), `tools/cms-*.mjs`, `docs/CMS_SETUP.md`. 1a dishes and categories, 1b contact/address/map/hours, 2 home page "What's new" announcements. 82 unit tests pass (`node --no-warnings --test tools/test/*.test.mjs`). With today's content every generated file equals the current file byte for byte. NOT run against a real Sanity project or Cloudflare. Next: sold-out badge, photos, reviews/signature/rewards fields. Setup: docs/CMS_SETUP.md.

## v105 site gate (sitegate kit) pass, 26 Oct 2026
Kit added in `tools/sitegate/` (config `sitegate.config.json`, runner `run.sh`). Run: `bash tools/sitegate/run.sh --mobile` (needs Python 3 + Playwright). It checks a copy of what Pages serves (repo minus .git and functions/).
**Fixed:** phone home page LCP 9.6 s -> about 3.5 s on slow 4G + 4x CPU (preload of the phone intro painting; that painting re-encoded 213 KB -> 133 KB, no visible change; 11 Rewards-section images lazy); phone form fields 16 px so iPhones do not zoom on focus (catering page 9 px taller on phones, nothing else moved); Rewards skip link pointed at a missing id; checkout meta description; new `404.html` (Pages serves it with a real 404 status for unknown URLs); `.gitignore` now blocks `.dev.vars` (local secrets) and tool output. Cache: site.css?v=128.
**Kit changes (also sent to the owner):** `noindex_pages` (checkout is noindex on purpose, SEO-only checks skipped there), `whatsapp_also` (catering WhatsApp line), placeholder GA4 id now FAILS (before it passed), mobile check gzips like Cloudflare and can ignore `/api/` in static runs.
**Gate now:** 2 blockers left, both need the owner or are measurement limits:
1. `measure.analytics`: GA4 id is still `G-XXXXXXXXXX` in all 7 pages, so no visits are recorded. Owner: send the GA4 Measurement ID, or turn on Cloudflare Web Analytics for the Pages project.
2. `static.page_weight` (home ~6 MB): static upper bound that adds every full-size image file. Real phone load measured by the mobile check: about 2.85 MB, LCP about 3.5 s, no blocker (borderline: one run read 3,008 KB against a 3,000 KB limit).
**Warnings left (not changed on purpose):** Search Console tag (owner: verification code); header icons 33 px tap targets (design); heading jumps h2->h4 home, h1->h3 rewards tiers; text under 12 px in the intro art; CLS 0.15 at 360 px in some runs (floating buttons settle); home still loads the 4 hidden landing-slider photos (~450 KB) and below-the-fold backgrounds at start.
**Public files:** Pages output dir is `/`, so `docs/`, `tools/`, `db/`, `cms/`, `*.md`, `.dev.vars.example` are downloadable on the live site. No secrets in them. Fix later by moving the site into its own output folder (Pages setting + build step).
**NOT tested:** real Cloudflare (404 status, headers), real phones, Safari, Firefox. e2e.py is clock dependent: after about 4 pm IST run the dev server with `TEST_NOW_MS` set to a morning time (57/57 pass that way).

## v106 Phase 4 Order Board + WhatsApp catalogue (27 Oct 2026, mock providers)
**Order Board** `board.html` (noindex, not in sitemap, robots Disallow): staff PIN login (secret `BOARD_PIN`, 6 to 12 digits; 5 wrong PINs lock that IP for 15 min; 12 h HttpOnly SameSite=Strict cookie), lists New / Preparing / Ready / Done for a day (prev/next day), polls every 10 s, beeps and vibrates on a new order (tap "turn on sound" once per shift), Accept, Reject with reason, Ready for pickup (gives a WhatsApp "order ready" link to the customer), Collected (pay at pickup: confirms the amount and records a counter payment), No-show (counts toward the 2 no-show rule), 80 mm ticket print, LATE flag, day totals (to collect, taken at counter, paid online, tips, no-shows). Phone: tabs; tablet and desktop (1000 px+): 4 columns.
Rules: unpaid online orders never reach the board; every action is a compare-and-set (two phones cannot both act); a rejected paid order goes to REFUND_NEEDED with an owner alert event; a rejected pay-at-pickup order is CANCELLED and its points or coupon are given back; points are credited once, when the order is collected (mock loyalty, or Reelo with REELO_CAPTURE=on).
API: `/api/board/login`, `/logout`, `/orders?date=`, `/action` (needs header x-board: 1). Staff guide: docs/ORDER_BOARD_STAFF_GUIDE.md.
**WhatsApp catalogue:** `node tools/make-wa-catalogue.mjs > whatsapp-catalogue.csv` then `python3 tools/wa-catalogue-images.py whatsapp-catalogue.csv wa-photos` (square 1024 px JPGs). 99 items; descriptions = the menu's own text plus facts (category, veg, lunch/dinner), nothing invented; 23 items have a photo, **76 need a real photo** before WhatsApp accepts them.
**Tests:** 92 unit tests (9 new board), board browser test 29/29 at 390 and 1280 (`TEST_NOW_MS=<morning> BOARD_PIN=246810 node --no-warnings tools/dev-server.mjs 8787`, then `python3 tools/test/board-e2e.py`), checkout e2e 57/57.
**NOT built / NOT tested:** automatic SMS "order ready" and owner SMS/WhatsApp alerts (need a DLT template or WhatsApp API: staff tap the WhatsApp link for now; alerts are written as events and handoff rows); daily summary message; real Cloudflare D1; a real counter phone or tablet; real thermal printer.

## v107 pickup time dropdown (27 Oct 2026, owner request)
Pickup time is now ONE dropdown of half-hour windows ("12:00 – 12:30 pm"), Lunch and Dinner groups, full windows disabled. No time chips. Server default `SLOT_MIN` is now 30 (set `SLOT_MIN=15` to go back); `/api/slots` returns `slotMin`. Cache checkout.js?v=10, checkout.css?v=11. Tests: 92 unit, checkout e2e 63/63.
