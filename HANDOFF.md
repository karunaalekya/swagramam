# HANDOFF
Project: Swagramam   Base: v87 static zip -> v88 (chat widget)
## v88 changes
- Floating Instagram + WhatsApp buttons rebuilt (green/gold, glow, pulse rings, online dot, label pill). Visible during the intro now; Instagram also shows on phones.
- WhatsApp panel rebuilt: live open/closed status (IST), quick actions: Take away order and Reserve a table (open the existing order popup via SXOrder.open), Timings and location (inline + directions), Catering (link + call), name/mobile, Start chat on WhatsApp.
- Files changed: site/*.html (fab markup, cache v: site.css?v=103, fx.js?v=79), site/site.css (block appended at end), site/fx.js (panel block at end).
## Tested (headless Chromium, 1440 and 390): icons visible, panel opens, name validation, Take away opens order popup, no JS errors.
## To test on a real phone: WhatsApp hand-off message, Take away -> UPI flow from the panel.
## Not done
- Legal pages (privacy/terms) still hide the buttons (existing rule).
- Real payment test (see UPI-PAYMENT.md). Session 1 of WordPress plan not started.

## v89 (title + page transitions)
- Header wordmark "Swagramam" (gold shimmer, letter-by-letter blur-in, tagline + drawn underline). Desktop >=1340px and phones; hidden 1001-1339px (would touch nav). Waits for the intro on first home visit.
- Page transitions: cross-page View Transitions "sunrise reveal" (old page recedes, new page opens as a circle rising from bottom centre over a gold/green gradient; header and chat buttons stay fixed). Firefox / older Safari: fade-out/fade-in fallback in fx.js. Internal pages prefetched (not on file://). Respects reduced motion.
- Cache: site.css?v=104, fx.js?v=80. Files: site/*.html (wordmark markup), site.css, fx.js (appended blocks).
- Tested in Chromium; real Safari/Firefox/phone not tested.

## v90 (final check before Cloudflare demo)
- Audit (Chromium 1440 + 390, all 6 pages): no JS errors, no 404s, no broken images, no horizontal scroll, no missing files, all anchors valid.
- Flows tested: Take away -> UPI QR -> I have paid -> WhatsApp message; Dine-in -> WhatsApp message.
- Fix: Dine-in message no longer says "Dishes: to be decided at the restaurant" when dishes were chosen (order.js?v=80).
- New: demo/ copy (noindex, no sitemap, no dev files, payment still ON) -> swagramam-demo-cloudflare.zip. DEMO-DEPLOY.md has the steps.
- Not tested: real phones, Safari, Firefox, a real UPI payment.

## v91 (phone layout)
- Phones (<=1000px): 3-line menu removed. Home / About / Menu / Catering / Contact now show as a strip under the header (always visible, active page gold). Inner pages get 46px extra top margin to clear it.
- Phone landing (<=700px): dish photo on its own block (about half the screen), gold line under it, title/description/buttons below on solid green. Nothing overlaps the photo. Arrows sit on the photo, progress bars right under it.
- Intro screen on phones: chat icons sit at the bottom (above the cookie banner if shown) and glide up when the intro ends. Instagram button always has Instagram colours.
- Cache: site.css?v=110. All CSS in the block "v91 MOBILE" at the end of site.css.
- Tested in Chromium at 390 and 360: no overflow, no JS errors. Not tested on real phones.

## v92
- Phones: Book / Call / Directions moved from the bottom bar into the header (3 round icons, top right). Bottom bar removed on phones. Book icon opens the order popup.
- Chat buttons: WhatsApp on top, Instagram below. Instagram has its own pulsing glow. Panel opens above both.
- Intro: caption block shrunk and lifted into the sky so it no longer covers the building sign; Telugu line hidden on short laptop screens. Timeline shortened: --t-wl 5.4s -> 2s, --t-cta 16.4s -> 9.6s (intro ends about 13s after load instead of about 22s). To restore, change `#sx{--t-wl:2s;--t-cta:9.6s}` at the end of site.css.
- Stats: count-up with easing, glow while counting, pop when done, underline draws in; 86 shows as 86+.
- Cuisine map: Karnataka card no longer shows the AI-drawn crop (no real photos exist for Ghee Dosa, Military Veg Biryani, Nagarjuna Chilli Chicken). NEEDED: 3 real photos from the restaurant, then add them to PH.karnataka in index.html (same pattern as the other states).
- New next-step bands before the footer on About, Menu, Catering, Privacy, Terms (Order take away / Reserve a table / View menu / Plan an event).
- Cache: site.css?v=114, fx.js?v=81. Audit passed (6 pages x 2 sizes: no errors, no overflow).

## v93
- Intro hanging sign now reads "SOUTH INDIAN KITCHEN / VILLAGE DINING · VIJAYAWADA" (HTML text in .sxmb, index.html). Page titles/meta/schema still say "Multi Cuisine" (not changed; ask client).
- Phone intro: empty beige top/bottom replaced with a blurred copy of the scene (assets/4734bbe90a.webp) and a feathered art band (CSS at end of site.css, "v93").
- Intro bug fixes: "View Menu" opens menu.html#menu; "Book a Table" scrolls to #cta.
- Counters checked: 86 dishes and 9 courses match order-data.js.
- Cache: site.css?v=116.
- Ordering plan (Swagramam_Ordering_Master_Plan.md: PayU, pay at pickup, loyalty, Reelo) is a separate track, NOT started.

## v94
- New page `rewards.html` (Village Club Rewards): the rewards section from home, plus "How to join" (WhatsApp) and an "Online join and my points" panel marked "Opening soon" (data-feature="rewards-online", wired in ordering Session 2). Listed in sitemap.xml.
- Header and footer nav on all pages now include "Rewards". On phones the strip is Home / About / Menu / Rewards / Catering (Contact is hidden on phones because the header icons already give Call and Directions).
- Home rewards section links to the Rewards page.
- Desktop wordmark: shows at 1400px and up (tagline only at 1540px and up) so it never touches the 6-link nav.
- Cache: site.css?v=119.
- Ordering plan: Swagramam_Ordering_Master_Plan.md v1.1 in this zip (3-session path, issue status, key switch-on list). Not started: Session 1 is next.

## v95 (ordering Session 1: checkout + API on mock providers)
- New: `functions/` (Cloudflare Pages Functions API), `db/schema.sql` (D1), `checkout.html/.js/.css` (noindex), `tools/` (menu builder, tests, local dev server), `CLOUDFLARE-SETUP.md` (owner clicks, ~20 min).
- API: /api/health, menu, quote, slots, otp/send, otp/verify, checkout/start, order/status, order/lookup, payu/callback, payu/webhook, mock-pay. Prices, GST (5%, half-up, assumed), slots, the Rs 1000 payment rule and the open-order cap are all decided on the server. Money is integer paise.
- Order popup: Take away goes to checkout.html only when /api/health says live. Otherwise the old WhatsApp/UPI flow runs unchanged. (order.js?v=81)
- Mock mode is the default. `ENV=production` refuses the mock gateway and mock SMS. Flags and switch-on list: master plan section 15 and CLOUDFLARE-SETUP.md.
- Menu server data is generated: `node tools/make-menu-json.mjs` after any change to order-data.js (99 SKUs from 86 dishes; options become separate SKUs).
- Tests: `node --no-warnings --test tools/test/api.test.mjs` (25 pass). Browser: `node --no-warnings tools/dev-server.mjs 8787` then `python3 tools/test/e2e.py` (36 checks pass at 390 and 1280 px).
- NOT tested: real Cloudflare D1/KV (tests use a SQLite stand-in), a real phone, real PayU, real SMS.
- Pulled forward from Session 2 (small): pay-at-pickup order creation, open-order cap (2), no-show check, 30 min unpaid expiry on status read.
- Session 2 still to do: Order Board, counter flow (mark paid, no-show), owner alerts, loyalty pages online (`rewards-online` panel on rewards.html is still "Opening soon"), refund/cancellation page drafts.
- Open: GST basis (D3), POS name (D1), DLT (D12), Reelo docs (D5), domain .com vs .in, "Britisher la Mushroom" name, page titles still say "Multi Cuisine".

## v96 (patch over v95: MSG91, Reelo, PayU switch-on + WhatsApp/SEO pack)
Unzip over the v95 repo, `git add` the listed paths by name, push.
- Phase 1 (switch-on code): `_lib/msg91.js` + `otp.js` (OTP_PROVIDER=msg91), `_lib/reelo.js` + `loyalty.js` (LOYALTY_PROVIDER=reelo; REELO_CAPTURE=on to send website bills, default off so the POS is the only sender), `_lib/verify-merchant.js` + `api/reelo/verify.js` + `v1/pos/integrations/[vendor]/verify.js`, `_lib/flags.js` (warnings), `api/health.js`, `api/otp/verify.js`, `api/admin/selfcheck.js` (header x-admin-key, shows which settings exist, never values), `tools/reelo-push-menu.mjs`, `tools/test/providers.test.mjs`, CLOUDFLARE-SETUP.md. PayU was already in v95: add PAYU_KEY, PAYU_SALT, PAYMENT_PROVIDER=payu, PAYU_ENV=test.
- Phase 2 (WhatsApp Business + SEO): `WHATSAPP-BUSINESS-SEO-PACK.md` (profile, username options, keywords by intent, quick replies, FAQs, greeting/away, links, reviews, Meta verification, tracking), `tools/make-wa-catalogue.mjs` (CSV from the menu data), `tools/wa-links.mjs`, `tools/apply-seo.mjs` (OG tags, canonical, Restaurant JSON-LD; idempotent; needs SITE_URL), `tools/test/seo-wa.test.mjs` (4 pass).
- Run: `SITE_URL=https://<final-domain> node tools/apply-seo.mjs --dry` then without --dry; `node tools/make-wa-catalogue.mjs > whatsapp-catalogue.csv`.
- Tested here: seo-wa tests (4 pass), catalogue script on a stub menu. NOT run here: providers.test.mjs and the full API suite (they need the v95 files, not in this patch zip). Run `node --no-warnings --test tools/test/*.test.mjs` in the Codespace first.
- NOT tested: real MSG91 SMS, real Reelo calls (production base URL is not in their docs), real PayU, catalogue script against the real menu.js (assumes item fields sku, name, cat, priceMinor, available, veg, servedAt), apply-seo against the real HTML.
- Waiting on owner: MSG91 key + DLT template id, Reelo base URL / vendor id / merchant id / customer key, PayU key + salt, final domain (.com or .in), GBP link, real photos.
