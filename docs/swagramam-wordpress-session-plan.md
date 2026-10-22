# Swagramam: Static Site to WordPress Custom Theme
Session-wise conversion plan (6 sessions + 1 add-on). **Base: `swagramam-website-v87.zip`** (v86 + UPI payment for Take away).
Backups: the v86 zip stays untouched. Keep v87 as the new static backup.

## What v87 already includes (done, do not redo)
- UPI payment step on Take away: order total + QR with amount, "Pay with UPI app" button on phones, UPI ID copy, shop QR fallback, "I have paid, send order on WhatsApp", "Pay at pickup instead". WhatsApp message carries "Payment: UPI, awaiting confirmation" and asks for the transaction ID or screenshot. Details and limits: `UPI-PAYMENT.md`.
- Bug fix in `order.js`: guest +/-, cart-line +/-, Clear, Done and "Open WhatsApp again" were dead in v86.
- `order.js` reads `window.SX_ASSETS` as the prefix for `assets/...` paths (empty on the static site).
- Changed files vs v86: `order.js`, `site.css` (block appended at the end), `*.html` (cache versions only), new `assets/upi-qr.webp`.
- Versions: `site.css?v=102`, `order.js?v=79`, `fx.js?v=78`, `order-data.js?v=76`.

## Rules for every session
1. Upload the **latest zip** and **HANDOFF.md** at the start.
2. Do **only that session's goal**. Do not start the next one.
3. End by giving a **new zip** and an **updated HANDOFF.md**.
4. Keep `site.css`, `fx.js`, `order.js`, `order-data.js` and all images **unchanged** from v87. Only HTML becomes PHP. Exceptions are written in the session (Session 3 and 4 settings output only feed the existing `CONFIG` blocks).
5. Keep the static zips (v86, v87) as backup. Never overwrite them.
6. After sessions 2, 4 and 6: install the theme on a staging WordPress (LocalWP or a staging subdomain) and report what breaks.

## Start prompt (paste at the beginning of each session)
> Continue the Swagramam WordPress custom theme conversion. Read HANDOFF.md first. Do only Session N from the plan. Keep CSS, JS and images unchanged. When done, give me the new zip and an updated HANDOFF.md. Be terse.

---

## Session 1: Theme skeleton
**Goal:** the home page renders from a WordPress theme, identical to v87.
- Create `swagramam-theme/` with `style.css` (theme header), `functions.php`, `header.php`, `footer.php`, `front-page.php`, `index.php`.
- `functions.php`: enqueue `site.css`, `fx.js`, `order.js`, `order-data.js`, fonts (self-hosted woff2) with the cache-bust version. Do not minify or combine.
- Print `window.SX_ASSETS = "<?php echo get_template_directory_uri(); ?>/";` **before** `order.js` (it prefixes the dish photos and `assets/upi-qr.webp`).
- Move `index.html` into `front-page.php`, keeping the intro, hero, all sections and scripts as they are.
- Replace relative `assets/...` paths in the markup with `get_template_directory_uri()`.
- Take baseline screenshots of v87 (desktop 1440 and phone 390) into `/qa/baseline/`, including the Take away payment screen.

**Done when:** home page markup matches v87, no PHP errors, paths resolve.

## Session 2: Inner pages
**Goal:** full site works as a theme.
- Page templates: About, Menu, Catering, Privacy, Terms (`page-about.php` and so on).
- Shared header and footer on all pages; nav links use WordPress URLs.
- Order popup, cart, **UPI payment step**, WhatsApp hand-off, page transitions and music button still work.
- Update `HANDOFF.md` with the template names and what to create as WordPress pages.

**Done when:** all 6 pages render and link to each other. **You test on staging** (add a dish, Take away, check QR and amount, "I have paid" opens WhatsApp).

## Session 3: Menu as data
**Goal:** the owner edits dishes in the dashboard.
- Custom post type `dish` plus a `course` taxonomy.
- Fields: name, price, course, veg or non-veg, photo, options, "out of stock", sort order.
- Import script for the 86 dishes from `menu.html` and `order-data.js`.
- WordPress prints the same JSON the menu and order scripts already read (`mn-data`, `order-data`). Script code stays untouched.
- The payment amount comes from the cart total, so a price edited in WordPress changes the QR amount automatically.

**Done when:** the menu looks the same as v87 and editing a price in WordPress changes the menu and the Take away total.

## Session 4: Editable settings
**Goal:** no code edits needed for the owner.
- One "Swagramam Settings" page: WhatsApp number, lunch and dinner hours, address, phones, orders email, FSSAI, GSTIN, Instagram and Facebook links, Analytics ID, rewards tiers.
- **UPI box:** UPI ID, payee name (as registered, now `RR FRESH FOODS`), merchant code (`5812`), terminal ref (`STQ5137823`), payment note, shop QR image upload, "Pay at pickup instead" on/off, **payment step on/off** (off = `upi:null`).
- Editable lists: reviews, announcements, signature dishes.
- Settings are output into the existing `CONFIG` blocks (`order.js` incl. `CONFIG.upi`, `fx.js`).

**Done when:** changing the WhatsApp number, hours or UPI ID in WordPress changes them everywhere. **You test on staging.**

## Session 5: SEO, speed, security
**Goal:** launch-ready.
- Page titles and descriptions per page (Telugu + English), Restaurant and Menu schema, canonical URLs, sitemap, social preview images.
- Cache and compression rules; confirm the cache plugin does not break the intro, animations or the payment screen (QR is drawn by JavaScript; do not cache or minify it away).
- Cookie bar controlling Analytics; privacy and terms pages linked. **Add a short payment and refund line to Terms** (client or lawyer approves wording).
- Spam protection on forms; hide the WordPress version; disable file editing; backup plan.

**Done when:** no console errors; schema validates; checklist in `HANDOFF.md` ticked.

## Session 6: QA and handover
**Goal:** the same look as v87 on phones and desktop.
- Screenshot every page at 390 and 1440 and compare to baseline; fix differences.
- Check intro, music, hero, map card, order popup, cart, **Take away payment screen**, WhatsApp message and rewards.
- Write `HOW-TO-EDIT.md` (one page for the owner, include "check the payment before cooking") and `INSTALL.md` (theme install, pages to create, settings to fill).
- Final zip.

**Done when:** no visible differences from v87. **You test on a real iPhone and Android**, including one real UPI payment (see `UPI-PAYMENT.md`).

## Session 7 (add-on, after launch): Payment
- **Option A (done in v87, ported in Sessions 1 to 4):** UPI QR / pay link on the Take away screen, order sent to WhatsApp as "awaiting confirmation". Limits: the site cannot verify payment; staff check the bank or Pine Labs app first.
- Option B (still open): PayU integration through a small plugin or backend (Merchant Key and Salt stay on the server). This is the only way to get automatic "Paid" status and to stop unpaid orders.

---

## HANDOFF.md template (create in Session 1, update at the end of every session)
```
# HANDOFF
Project: Swagramam WordPress theme   Base: v87 static zip
Last session done: N
## Done
- ...
## Next session: N+1 (goal)
- ...
## Files changed this session
- ...
## Known bugs / things to test on staging
- ...
## Decisions
- Custom theme, no page builder. CSS/JS/images unchanged from v87.
- UPI payment: static merchant QR with amount prefilled, WhatsApp order, staff verify payment.
```

## Risks
- A free session can run out mid-step. Keep steps small and update `HANDOFF.md` often.
- The chat cannot fully run WordPress, so staging checks by you are required.
- Cache plugins that minify or combine scripts can break the intro, animations and the payment screen.
- Real iPhone and Android checks are still needed before launch, including one real UPI payment: some merchant UPI IDs reject a prefilled amount, in which case the shop-QR fallback becomes the main method.
- A customer can tap "I have paid" without paying. Staff must see the money before preparing the order.
