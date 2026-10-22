# Swagramam: ORDERING + PAYU + LOYALTY MASTER PLAN (single source of truth)

Version 1.2, 22 Oct 2026 (v1.1 added sections 13 to 15; v1.2 records Session 1 as built). Covers ONLY the ordering track: online pickup orders, PayU, pay at pickup, loyalty pages, Reelo. Modelled on `RR_Durbar_FINAL_Master_Plan.md` (Phases 4 to 10). The website track (cleanup, Cloudflare Pages + Sanity migration, SEO, go-live) is a separate plan and is no longer a prerequisite for v1 (see the v1.1 note). If anything conflicts with live code, live code wins; fix this file.


> **v1.1 note (read first).** The long path in sections 4 and 5 (Astro + Sanity migration first, about 18 sessions) is kept for reference. The **active path is section 13: 3 sessions on the current static site**, Cloudflare Pages Functions + D1, with mock PayU, mock OTP and mock Reelo. Real PayU and Reelo keys are switched on later by flags (section 15), with no rebuild. The Rewards page and the header Rewards link are already built (site v94).

---

## 0. Session rules (every session)

1. Read this whole file. Say which ONE task ID you will do next. Do nothing before that.
2. Ask the owner for files you need. Never assume you have them.
3. One task at a time. After each task: tick the box, add one line to section 11, update the Checkpoint.
4. No secrets in this file or in chat (PayU key and salt, MSG91 key, Reelo key, Sanity token, HMAC secrets). Write "owner has it". Deploys use a hidden token prompt.
5. Big task: give the plan in 3 to 5 lines first. Do not do work that was not asked for.
6. Every deliverable = complete files + change list + "what I did not touch".
7. Owner style: short simple English, one question at a time, one command per code block. Mobile first.
8. If an input has not arrived, use the default in section 9, mark it "default used" in the log. Do not stall.
9. Diagnose from evidence (command output). Label guesses as guesses.
10. Never `git add -A`; add files by explicit path.

---

## 1. Scope and where things stand

**In scope:** pickup (takeaway) orders from the one outlet at Labbipet; guest or member checkout with mobile OTP; payment by PayU or pay at pickup; loyalty (rewards pages, points shown at checkout, Reelo); kitchen handoff; alerts.

**Out of scope:** delivery (no delivery address step), dine-in table ordering, coupons and freebies (v1), tips (v1 default off), online points redemption (v1, see D6), site cleanup and CMS migration (other plan).

**Prerequisites from the website track (must exist on staging before Phase O3):**
- Site on Cloudflare Pages with menu content in Sanity.
- Sanity `dish` documents include these fields (add to the schema now): `sku` (stable code, never changes), `priceMinor` (integer paise), `taxRate` (percent), `available` (bool), `servedAt` (lunch / dinner / both), `days` (optional, for special-day dishes), `veg` (bool), `courseCode`.
- Sanity `hours` document: lunch window, dinner window, Monday exception.
- `siteSettings`: legal name, GSTIN, FSSAI, phones, email, address.

**Current state (from the live home page):**
- Site is static, ordering buttons only open WhatsApp (`wa.me`) with prefilled text. No payment, no accounts.
- Rewards section is display-only: Rs 1 = 1 point; Silver (500 pts: 1 free drink; 1000: Rs 75 off), Gold (2000: Rs 150 off; 3000: 1 free Thali or Dessert), Village Elite (5000: Rs 500 off). Terms on the page: points issued on subtotal before tax and charges; points cannot be redeemed on the same day as the purchase; rewards redeemable in-store only; merchant has final say.
- Menu: 8 courses. Lunch only: Bhojanam (Thali). Dinner only: Combos.
- Which POS the outlet uses: UNKNOWN (D1). This decides the kitchen handoff and how Reelo connects.

---

## 2. Decisions (send to owner as ONE message, task O0.2)

| ID | Decision | Default if no answer |
|---|---|---|
| D1 | **Which POS does Swagramam use?** (Petpooja, Rista, DotPe, other, none). Does it have an order-push API? | Treat as "no POS API": orders go to the Order Board (section 4) and staff punch them into the POS. |
| D2 | **Payment rule. RESOLVED by owner 22 Oct:** total payable including taxes of Rs 1000.00 or less: PayU or pay at pickup. Above Rs 1000.00: PayU only. | Done. Server enforces it (section 6). |
| D3 | **Menu price basis.** Are menu prices before or after GST? GST rate? Any packing charge? | Prices before GST, GST 5% on subtotal, no packing charge. Label "assumed" on staging; owner and CA confirm before launch. |
| D4 | **Pay-at-pickup abuse rules.** Open-order cap and no-show policy. | Max 2 open pay-at-pickup orders per phone. After 2 no-shows a phone becomes PayU-only (owner can switch off). |
| D5 | **Loyalty provider path.** Reelo's website-order API access is unconfirmed (it connects mainly through the POS). | Adapter with mock provider. v1 default: points credited when staff settles the bill at the POS with the customer's phone number, no double credit (section 6). Real API only after docs arrive. |
| D6 | **Online redemption.** Current terms say in-store only and no same-day redemption. | v1: earn online, redeem in-store only (matches terms). Online redemption only after the owner approves new terms. |
| D7 | **Guest points.** Does a guest earn points? | Members earn. Guests see "you would have earned N points, join to earn". Joining after the order is possible within the confirmation page (phone already verified). |
| D8 | **Email at sign-up.** Compulsory? PayU may need an email. | Optional. If PayU needs one for guests, collect it at the payment step. |
| D9 | **Tip, coupon, freebies** (shown in the reference checkout). | None in v1. |
| D10 | **Slots.** Minimum prep time, slot length, per-slot order cap. | 25 min prep, 15 min slots, max 8 orders per slot (label assumed). |
| D11 | **Unpaid timeout** for PayU orders. | 30 minutes. |
| D12 | **DLT.** Is there a DLT-registered entity and sender ID for Swagramam's legal entity? GSTIN differs from RR Durbar, so assume a separate registration. | Run on mock OTP until DLT is approved. |

---

## 3. Fixed business facts (change only with owner approval)

- Legal: RR FRESH FOODS (trade name SWAGRAMAM). GSTIN 37ABMFR0466Q2ZC. FSSAI 20126132000904.
- Address: Mogalrajapuram, Sidhartha Nagar, Labbipet, Vijayawada, Andhra Pradesh 520010.
- Phone +91 76598 58999 (also WhatsApp). Catering +91 98499 82052. Email orders@swagramam.in (domain mismatch with swagramam.com, to be settled in the website track).
- Hours: lunch 12:00 to 16:30 (Monday till 16:00); dinner 19:00 to 23:30, every day.
- Rewards numbers: section 1. They must match Reelo's real rules (unconfirmed) and the terms text.
- No claims or numbers on the site that are not confirmed.

---

## 4. Architecture

- **Site:** Astro static on Cloudflare Pages (website track). Checkout pages are noindex.
- **API:** one Cloudflare Worker `swagramam-api` (separate repo, forked from `rr-durbar-api`). D1 for orders, customers, consent, payments, events. KV only for OTP and short caches. Workers Rate Limiting binding + Turnstile at launch. Cron trigger for expiry and retries.
- **Menu and prices:** read from Sanity (GROQ, CDN API) by the Worker, cached in KV for 60 s. The browser's prices are never trusted. Money is stored as integer paise.
- **OTP:** MSG91 with DLT template. **Payment:** PayU (hosted checkout, server-side hash, verify-payment API). **Loyalty:** adapter (mock or Reelo).
- **Kitchen handoff (default, D1):** Order Board at `/staff/orders`, protected by Cloudflare Access, with a sound alert, Accept / Ready / Collected buttons and a print view. Owner alert by email on every order and every failure (WhatsApp alert once the Meta API is live). If the POS has an order API, add a POS adapter behind the same interface.
- **Sanity webhook** rebuilds the site; prices and availability for orders come from the Worker, not the rebuilt pages, so a price change applies at once.

**Reuse from RR Durbar (do not rewrite):** OTP send/verify (HMAC-hashed, single use, constant-time), D1 schema, order state machine with compare-and-set, PayU hash/callback/webhook handling, test suites. Remove: Rista client, UPI code, outlet-by-name logic. Replace Rista with Sanity as the price source and the Order Board as the handoff.

---

## 5. Phases and tasks (tick when done, then log in section 11)

### Phase O0: Inputs and long-lead (day 1)
- [ ] **O0.1** Start long-lead items: PayU merchant account (business KYC, GST, bank; test keys first); DLT and MSG91 (D12); Reelo plan, docs and POS check (D1, D5); Meta WhatsApp Business verification needs (legal name, address and website must match the GST certificate; privacy and terms pages live).
- [ ] **O0.2** Send D1 to D12 and the section 9 inputs as ONE message with defaults.
- [ ] **O0.3** Fork `rr-durbar-api` to `swagramam-api`; strip Rista and UPI; get the 38 reused tests passing.

### Phase O1: Foundation
- [ ] **O1.1** Staging and production Workers, D1, KV, Turnstile, secrets via hidden prompt.
- [x] **O1.2** Flags: `ONLINE_ORDER_LIVE`, `COD_LIVE`, `COD_MAX_TOTAL_MINOR=100000`, `PAYMENT_PROVIDER=payu|mock`, `LOYALTY_PROVIDER=mock|reelo`, `OTP_PROVIDER=msg91|mock`. *(done, `functions/_lib/flags.js`; production refuses mock)*
- [x] **O1.3** D1 schema and migrations: orders, order_items, customers, consents, payments, handoffs, loyalty_events, events (audit). *(done in `db/schema.sql`; run on real D1 pending, see `CLOUDFLARE-SETUP.md`)*
- [x] **O1.4** State machine (section 6) with unit tests. *(done, `state.js`, tested)*

### Phase O2: Menu, quote, slots
- [x] **O2.1** `GET /api/menu`: dishes from Sanity (available only), with `servedAt`. *(done, `/api/menu`, from `order-data.js`, 99 SKUs)*
- [x] **O2.2** `POST /api/quote`: re-prices from Sanity, rejects unavailable or unknown SKUs, applies GST per D3, returns subtotal, tax, total in paise, `codAllowed`, `pointsToEarn`. Rounding: GST half-up to the paisa. *(done, `/api/quote`)*
- [x] **O2.3** `GET /api/slots`: slots inside hours (lunch and dinner windows, Monday exception), minimum prep, per-slot cap. A lunch-only item cannot be ordered for a dinner slot, and a dinner-only item not for lunch; the cart tells the customer which item blocks the slot. *(done, `/api/slots`, 15 min slots, 25 min prep, 8 per slot)*
- [ ] **O2.4** Check quote totals against the POS bill for 5 real baskets (rounding and GST must match what the counter prints).

### Phase O3: Identity
- [ ] **O3.1** `POST /api/otp/send`, `/api/otp/verify` (MSG91, Turnstile on, limits: 5 sends per phone per hour, 15 per IP per hour, 5 tries, 30 s resend). *(mock OTP done with limits; MSG91 in Session 3)*
- [ ] **O3.2** Guest (mobile compulsory; name and email optional) or Sign in / Join (mobile and name; email per D8). Existing loyalty phone is signed in by OTP; new phone is enrolled. *(guest and join done; join uses the mock loyalty provider)*
- [x] **O3.3** Consent records with timestamp and wording version: terms (required), marketing messages (separate, unticked). *(done)*
- [x] **O3.4** Open-order cap in D1 (not KV). Token nonce recorded. *(done, open-order cap and nonce in D1)*

### Phase O4: Checkout pages (noindex, mobile first)
- [x] **O4.1** Build the screens in section 7 on staging with mock providers. *(done on mock: `checkout.html`)*
- [ ] **O4.2** Clear messages when PayU, Reelo, SMS or the POS is down. Never show a paid-looking state without server verification.
- [ ] **O4.3** Prices only in menu, cart and checkout as approved.

### Phase O5: PayU
- [ ] **O5.1** `POST /api/checkout/start`: needs OTP token, re-quotes server side, enforces the payment rule, creates the order, returns PayU fields (hash built server side; field order from PayU's current docs, not memory). *(done on mock gateway; real PayU hash verified against docs, tested; live test in Session 3)*
- [x] **O5.2** `/api/payu/callback` and `/api/payu/webhook`: verify hash, call PayU verify-payment, check amount equals server total, change state once only. *(done on mock gateway; real PayU in Session 3)*
- [x] **O5.3** Expiry job for unpaid orders (D11). *(done, lazy expiry on status read; Session 2 re-checks)*
- [ ] **O5.4** Tests: success, failure, cancel, closed tab, duplicate callback and webhook, wrong hash, amount tampering, a forced pay-at-pickup request above Rs 1000. *(done on mock: all cases in `tools/test/api.test.mjs`; repeat on PayU test keys in Session 3)*
- [ ] **O5.5** Refund path: v1 refunds are made in the PayU dashboard; order goes to REFUND_NEEDED and the owner is alerted. Auto-refund later.

### Phase O6: Pay at pickup
- [ ] **O6.1** Server rule: pay at pickup only if total in paise is 100000 or less, OTP verified, cap and no-show checks pass, `COD_LIVE` on. *(rule and cap built in Session 1; Session 2 finishes counter flow)*
- [ ] **O6.2** Order goes to the kitchen unpaid; confirmation shows "Pay at pickup, Rs X". Staff mark Collected and paid at the counter.
- [ ] **O6.3** No-show handling per D4.

### Phase O7: Kitchen handoff
- [ ] **O7.1** Order Board with Cloudflare Access, sound, Accept / Ready / Collected, print view, order and pickup-time display.
- [ ] **O7.2** Alerts: owner email on every order, every PayU failure and every handoff failure.
- [ ] **O7.3** Retry with backoff; after the limit: HANDOFF_FAILED, and REFUND_NEEDED if already paid.
- [ ] **O7.4** If D1 shows the POS has an order API, add the POS adapter behind the same interface.
- [ ] **O7.5** Staffed test at the counter with real printing.

### Phase O8: Loyalty pages and Reelo
- [ ] **O8.1** Adapter interface: `lookup, enrol, balance, earn, reserveRedemption, commit, release`. Mock provider first.
- [ ] **O8.2** Loyalty pages (section 8) built from Sanity `rewards` content.
- [ ] **O8.3** Rewards panel in checkout: points balance (member), points this order will earn, Join prompt (guest).
- [ ] **O8.4** Reelo provider after docs arrive. If Reelo has no usable website API, keep the POS route (D5) and show points after counter settlement.
- [ ] **O8.5** Match site rewards copy and terms to Reelo's real rules and to online ordering (privacy, consent text, expiry).
- [ ] **O8.6** Meta WhatsApp Business verification (live site, privacy, terms, details matching GST certificate).

### Phase O9: Hardening and go-live
- [ ] **O9.1** Turnstile, rate limits, uptime and error alerts, no secrets in git history.
- [ ] **O9.2** Privacy, terms, refund and cancellation pages approved (DPDP consent standard, rules effective 13 May 2027).
- [ ] **O9.3** Full test checklist (section 10).
- [ ] **O9.4** Soft launch: `ONLINE_ORDER_LIVE` on for 3 to 5 real orders with owner watching, then open to all. Rollback = flag off (site falls back to the WhatsApp buttons).

Rough effort: O0 1, O1 1, O2 2, O3 2, O4 3, O5 2, O6 1, O7 2, O8 2, O9 2, about 18 sessions. Elapsed time depends on PayU KYC, DLT and Reelo replies.

**Critical path:** DLT then O3; PayU KYC then live O5; Reelo docs then O8.4. Everything else runs on mocks.

---

## 6. Rules (never break)

**Payment method rule (server decides, browser never trusted):**
- Payable total = subtotal + GST + any charges, after any discount, in paise.
- `total <= 100000` (Rs 1000.00 exactly): allow `payu` or `cod`.
- `total > 100000`: allow `payu` only. Short note on screen explains why.
- Re-checked at `/api/checkout/start` against the server quote. A forced `cod` request above the limit is rejected.

**Money:** paise integers only. Confirmed PayU amount must equal the server order total, else flag and do not hand off. Transaction ID = order ID. Callback and webhook may both arrive: change state once (compare-and-set in D1). Payment ok but handoff fails: retry, then REFUND_NEEDED and alert. Never show a paid-looking order if PayU is down. Online orders reach the kitchen only after verified PAID. Pay-at-pickup orders (total Rs 1000 or less only) reach the kitchen unpaid, by owner decision.

**States (online):** CREATED, PAYMENT_PENDING, PAID, SENT_TO_KITCHEN, CONFIRMED, READY, COMPLETED. Failures: PAYMENT_FAILED, EXPIRED, HANDOFF_FAILED, REFUND_NEEDED, CANCELLED.
**States (pay at pickup):** CREATED, SENT_TO_KITCHEN, CONFIRMED, READY, COMPLETED, or NO_SHOW.

**Points (no double credit):**
- Rate and base from the site terms: Rs 1 = 1 point on subtotal before tax and charges. Match to Reelo's real rules (D5).
- Credited once only, by one path: the website API (when it exists and is certified) or the POS bill with the customer's phone. Never both. Order record stores `points_credit_path`.
- Online orders: credited after verified PAID (API path) or after counter settlement (POS path). Pay at pickup: after counter settlement.
- Redemption stays in-store (D6).

**Consent:** terms accepted (required) and marketing consent (separate, unticked), each with timestamp and wording version. The order confirmation is not a GST invoice; the counter bill is (confirm with CA).

---

## 7. Checkout screen order (pattern from the Biryanis reference; no copying of their design, code or text)

1. Pickup time and outlet (Today / later, shows slot rules; lunch-only and dinner-only item conflicts shown here).
2. Cart: items, quantities, order note, server-quoted amount.
3. Guest or Sign in / Join (both ask the mobile number).
4. Mobile number, then OTP (6 digits, resend, wrong-code message). Name; email optional (D8).
5. Rewards panel: balance (member), points this order earns, Join prompt (guest).
6. Payment summary: item total, GST, total (no tip, coupon or freebies in v1), "points earning" line.
7. Consent: terms checkbox (required), marketing checkbox (separate, unticked).
8. Payment choice: Rs 1000 or less shows PayU and Pay at pickup; above shows PayU only with a note.
9. PayU redirect, or direct confirmation for pay at pickup.
10. Return page polling `/api/order/status`.
11. Confirmed (order number, pickup time, amount, points), or failed with retry.
12. Order lookup (phone + OTP).

---

## 8. Loyalty pages (all noindex except the public rewards page)

- `/rewards/` public and indexable: how it works (Rs 1 = 1 point), tiers and perks, terms, how to join. Content from Sanity `rewards`; the current home-page section is extracted, nothing removed.
- `/rewards/join/`: phone, name, OTP, consent. Enrols in Reelo or the mock.
- `/rewards/my-points/`: phone + OTP, then balance and tier. Built only when the provider can look up balances (D5).
- Footer and header links, and the home-page rewards section links to `/rewards/`.
- Terms text updated before launch for online orders: remove or change "in-store only" and "not on the same day" only if the owner approves (D6).

---

## 9. Inputs from client (send once, with defaults)

| Input | Blocks | Default |
|---|---|---|
| POS name and whether it has an order API (D1) | O7, O8 | Order Board, no POS API |
| PayU merchant key and salt (test, then live); callback URLs allowed; fees | O5 | Mock provider |
| DLT status and MSG91 account (D12) | O3 | Mock OTP |
| Reelo plan, API docs, rules (first-order reward, expiry, guest points) | O8 | Mock provider, copy unchanged |
| Menu price basis, GST rate, packing charge (D3) | O2 | Section 2 default, marked assumed |
| Prep time, slot length, per-slot cap (D10) | O2 | Section 2 default |
| No-show and open-order rules (D4) | O6 | Section 2 default |
| Online redemption allowed? (D6) | O8 | In-store only |
| Email compulsory? (D8) | O3 | Optional |
| Who receives alerts (email, WhatsApp) | O7 | orders@swagramam.in |
| Staff who use the Order Board | O7 | Owner email only |
| Privacy, terms, refund text approved | O9 | Keep hidden |

---

## 10. Test checklist (before go-live)

**Payment rule:** Rs 1000.00 offers both options; Rs 1000.01 offers PayU only; a forced pay-at-pickup above Rs 1000 is rejected by the server; changing the cart after choosing a method re-checks.
**Ordering:** guest with phone only; sign-up with OTP; wrong, expired and resent OTP; open-order cap; no-show rule; lunch-only item blocked on dinner slot and the reverse; Monday lunch ends 16:00; unavailable dish rejected; price changed in Sanity applies to the next quote.
**PayU:** success, failure, cancel, closed tab, duplicate callback and webhook, wrong hash, amount tampering, handoff down then retry, expiry.
**Kitchen:** order appears on the board with sound, print works, Accept / Ready / Collected, alerts reach the owner.
**Loyalty:** points to earn match the rule; points credited once only; guest sees the Join prompt; no double credit between site and POS.
**Site:** checkout pages noindex; no secrets in the bundle; Lighthouse and axe on mobile; one real small order, then a refund.

---

## 11. Checkpoint and change log

**Checkpoint (always current):**
- Last task done: **Session 1 of section 13 built (site v95)**: checkout page + API on mock providers, 25 API tests and 36 browser checks pass on a local test server (SQLite stand-in for D1). NOT yet run on real Cloudflare D1/KV, not tested on a real phone, PayU hash not yet tried with real test keys.
- Next task: owner runs `CLOUDFLARE-SETUP.md` (about 20 min) and tests the demo on a phone. Then Session 2 of section 13 (kitchen board, pay at pickup counter flow, loyalty pages, alerts).
- Waiting on (does not block Session 2): PayU test keys, Reelo docs, DLT, POS name, GST basis.

**Change log (newest at bottom):**
- 22 Oct 2026: v1.0 created from the RR Durbar master plan, the Swagramam home page (hours, rewards, terms, legal facts) and the owner's decisions: PayU final; Rs 1000 or less (total including taxes) PayU or pay at pickup, above PayU only; loyalty pages and Reelo. No code changed.
- 22 Oct 2026: v1.1. Added sections 13 to 15 (3-session path, issue status, key switch-on). Rewards page and header link built (site v94). Active path changed to the lean static-site path; Astro + Sanity migration is no longer a prerequisite for v1.

- 22 Oct 2026: Session 1 built (site v95). Added `functions/` (API), `db/schema.sql`, `checkout.html/js/css`, `tools/` (menu builder, tests, dev server), `CLOUDFLARE-SETUP.md`. Take away in the order popup goes to checkout when `/api/health` says live, else keeps the WhatsApp/UPI flow. Pay-at-pickup creation, open-order cap and no-show check were pulled forward from Session 2 because they were small; Session 2 still owns the counter flow, board, alerts, loyalty pages.

---

## 12. Resume prompt (paste at the start of any new session)

> Read Swagramam_Ordering_Master_Plan.md fully. Project: Swagramam online pickup ordering on Cloudflare (Pages + Worker `swagramam-api`, D1, KV, Sanity as the price source), MSG91 OTP, PayU (online orders reach the kitchen only after verified payment; pay at pickup only when the total including taxes is Rs 1000 or less), loyalty behind an adapter (Reelo), Order Board for kitchen handoff unless the POS has an API. Follow section 0. Tell me which single task ID you will do next and wait. After each task update the ticks and section 11. Never print secrets.

---

## 13. The 3-session build path (ACTIVE)

**Why 3 sessions is possible:** the site stays static (no Astro or Sanity migration for v1). The API lives in the same GitHub repo as Cloudflare Pages Functions (`/functions/api/*`) with D1 and KV, so `git push` deploys both. Menu and prices come from the existing `order-data.js` (86 dishes, one source). PayU, OTP and Reelo run as **mock providers** until real keys arrive. Every session ends with a zip, a test report and an updated `HANDOFF.md`.

**What 3 sessions do NOT include:** Reelo's real API (unknown until their docs arrive), DLT registration, PayU KYC, Meta WhatsApp verification, Astro + Sanity migration, delivery, tips, coupons, online redemption. If a session overruns, the overflow goes to one buffer session (S4). Do not squeeze it.

**Rules for all 3 sessions**
1. Start by pasting the resume prompt (end of this section) and the latest zip + `HANDOFF.md`.
2. One session = one goal. Claude names the tasks first, then builds. Nothing outside the list.
3. Mock mode is the default everywhere. Production refuses the mock OTP and the mock gateway (flag guard), so a mock can never go live by accident.
4. Money is integer paise. The server decides the payment rule. The browser is never trusted.
5. No secrets in chat or git. Keys go into Cloudflare dashboard variables.
6. Each session ends with: zip, change list, "what I did not touch", test results, `HANDOFF.md`.

### Session 1: Checkout and API on mock (covers O1, O2, O3, O4, O5 on mock)
**Goal:** a customer can build a take away basket, pick a slot, verify a mock OTP, choose payment (PayU or pay at pickup by the Rs 1000 rule), pay on a mock gateway, and see a confirmed order. Nothing is live.
**Claude builds**
- `functions/api/`: `menu`, `quote`, `slots`, `otp/send`, `otp/verify`, `checkout/start`, `order/status`, `order/lookup`, `payu/callback`, `payu/webhook`, `mock-pay` (success, failure, cancel buttons).
- `functions/_lib/`: money (paise, GST half-up), quote, slots (lunch 12:00 to 16:30, Monday 16:00, dinner 19:00 to 23:30; Thali lunch only, Combos dinner only), order state machine with compare-and-set, PayU hash and verify code (field order checked against PayU's current docs), flags, loyalty adapter interface (mock).
- `db/schema.sql`: orders, order_items, customers, consents, payments, handoffs, loyalty_events, events.
- `tools/make-menu-json`: builds the server menu from `order-data.js`.
- `checkout.html` (noindex), mobile first: the screens of section 7. The "Take away" button in the order popup goes here. Dine-in and reserve stay on WhatsApp.
- Rewards panel in checkout: points this order earns (mock), Join prompt for guests.
**You do (about 20 minutes, Claude gives the clicks):** create one D1 database and one KV namespace in Cloudflare, bind them to the Pages project, add the flag variables.
**Gate (all must pass):** Rs 1000.00 offers both options; Rs 1000.01 offers PayU only; a forced pay-at-pickup request above Rs 1000 is rejected by the server; lunch-only and dinner-only blocking; wrong, expired and resent mock OTP; amount tampering rejected; duplicate callback changes state once; the order appears in D1.


**Session 1 result (22 Oct 2026, tested on a local SQLite stand-in, not on Cloudflare yet):**
- PASS Rs 1000.00 offers both options; Rs 1000.01 offers PayU only (tested at the exact boundary).
- PASS forced pay-at-pickup above Rs 1000 rejected by the server; no order row is created.
- PASS lunch-only and dinner-only blocking (quote, checkout and browser).
- PASS wrong, expired, resent, single-use OTP; 5 tries then locked; 5 sends per phone per hour.
- PASS amount tampering goes to REFUND_NEEDED with an alert, no kitchen handoff.
- PASS duplicate callback + webhook change state once (one PAID event, one handoff, one payment row).
- PASS wrong hash and forged callback never show paid; unpaid orders expire at 30 min; late payment goes to REFUND_NEEDED.
- PASS PayU request and response hash formulas checked against docs.payu.in and unit tested.
- NOT DONE in Session 1 (still ahead): order lookup page is built but untested on a phone; real D1/KV run; real PayU test run (Session 3).

### Session 2: Kitchen, pay at pickup, loyalty, alerts (covers O6, O7, O8 on mock)
**Goal:** staff can see and handle orders, pay at pickup works with its rules, and the loyalty pages work on the mock provider.
**Claude builds**
- Order Board `/staff/orders`: sound alert, Accept / Ready / Collected, print view, protected by Cloudflare Access (Claude gives the clicks).
- Pay at pickup: total of Rs 1000 or less only, OTP verified, open-order cap and no-show rule (D4), staff mark paid at the counter.
- Unpaid PayU orders expire after 30 minutes (checked when the board or status is read, no cron needed in v1).
- Owner alerts on every order and every failure: email provider behind an interface (mock logs to the Order Board until a key arrives).
- Refund path: `REFUND_NEEDED` state plus an alert; the refund itself is done in the PayU dashboard.
- Loyalty: provider interface (`lookup, enrol, balance, earn, commit, release`) with a mock provider in D1; a Reelo provider file with the same interface and TODO notes; online join and my points on `rewards.html` behind the `rewards-online` flag; points credited once (`points_credit_path` stored); site copy keeps "redeem in-store" (D6).
- Updated Privacy, Terms and a Refund and Cancellation page draft (owner approves wording).
**You do:** test the Order Board on the kitchen phone or tablet; tell Claude the answers to D1, D3, D10 if you have them.
**Gate:** order shows on the board with sound; print works; no double credit; pay-at-pickup cap and no-show rules; expiry works; alerts logged.

### Session 3: Switch on real keys and harden (covers O5 live, O8.4, O9)
**Goal:** PayU test mode works end to end, hardening is done, and the site is ready to go live the day the owner approves.
**Claude does (with the keys you bring)**
- PayU test keys into Cloudflare variables, `PAYMENT_PROVIDER=payu`; real redirect, callback, webhook and verify-payment; amount and hash tests; failure and cancel tests. Live keys later = the same steps.
- OTP: MSG91 provider with the DLT template if approved. If DLT is not ready, production does NOT use the mock OTP: either wait, or launch with phone-only guests protected by Turnstile and rate limits (owner decides).
- Reelo provider filled in only if their docs show a usable website API; otherwise keep the POS route (D5) and show points after counter settlement.
- Hardening: Turnstile, rate limits, security headers, `noindex` on checkout, no secrets in the bundle or git, uptime alert.
- Run the full test checklist (section 10). Soft launch plan: `ONLINE_ORDER_LIVE` on for 3 to 5 real orders with the owner watching. Rollback = flag off (buttons fall back to WhatsApp).
**You bring:** PayU test key and salt (then live), MSG91 and DLT status, Reelo docs or the POS answer, email alert key and address.
**Gate:** one real small order paid on PayU test, one refund noted, every item of section 10 ticked or marked "waiting on owner".

### Between sessions (your checklist)
- After each session: unzip into the Codespace repo, `git add` the listed paths, commit, push, test the demo link on a real phone, and send Claude screenshots of anything wrong.
- Chase the long-lead items now: PayU KYC, DLT, Reelo docs, POS name, GST basis.

### Resume prompt for the 3-session path (paste at the start of each session)
> Read Swagramam_Ordering_Master_Plan.md fully (v1.1), especially sections 13 to 15, and HANDOFF.md. Project: Swagramam take away ordering on the current static site, Cloudflare Pages Functions + D1 + KV, mock providers until keys arrive (PayU, OTP, Reelo), Order Board for kitchen. Payment rule: total including taxes of Rs 1000.00 or less offers PayU or pay at pickup; above that, PayU only, enforced on the server. Today is Session N. Tell me the task list for this session in 5 lines, then build it. Follow section 0 and the section 13 rules. Never print secrets. End with the zip, change list, "what I did not touch", test results and an updated HANDOFF.md.

---

## 14. Issue status (are the plan's issues sorted?)

"Default used" means the plan's default is applied so building is not blocked. It is not a confirmed fact.

| Issue | Status | Applied now | Still needs from owner |
|---|---|---|---|
| D1 POS unknown | Default used | Order Board handoff | POS name; does it have an order API |
| D2 Payment rule | **Resolved** | Server rule: total <= Rs 1000.00 PayU or pay at pickup, above PayU only | Nothing |
| D3 Price basis and GST | Default used (assumed: prices before GST, 5% GST) | Marked "assumed" | **Must confirm before launch**, it changes every total |
| D4 Pay-at-pickup abuse | Default used | 2 open orders per phone, 2 no-shows then PayU only | Approve |
| D5 Reelo | **Not resolved** | Mock provider, same interface | Reelo plan and API docs, or the POS route |
| D6 Online redemption | Default used | Earn online, redeem in-store only (matches site terms) | New terms only if redemption online is wanted |
| D7 Guest points | Default used | Guests see "you would have earned N points" | Approve |
| D8 Email at sign-up | Default used | Optional | Does PayU require it for guests |
| D9 Tip, coupon, freebies | Resolved for v1 | None | Nothing |
| D10 Slots | Default used | 25 min prep, 15 min slots, 8 orders per slot | Kitchen confirms |
| D11 Unpaid timeout | Default used | 30 minutes | Approve |
| D12 DLT | **Not resolved** | Mock OTP on demo and staging only | DLT status, MSG91 |
| Plan assumed Astro + Sanity first | Changed | Not needed for v1; menu from `order-data.js` | Later, separate plan |
| About 18 sessions | Changed | 3 sessions with mock-first (section 13) | A buffer session may be needed |
| Rewards terms conflict (in-store only, not same day) | Handled by D6 | Site text unchanged | Owner decision if online redemption wanted |
| Domain `.com` vs `.in` | Open | Not touched | Which domain the client owns |
| Dish name "Britisher La Mushroom" | Open | Not touched | Confirm the full name |

**Blockers before real go-live (not before building):** D3, D5, D12 and the PayU live keys.

---

## 15. When the keys arrive (switch on, no rebuild)

| Item arrives | You do | Flag or variable |
|---|---|---|
| PayU test key and salt | Add in Cloudflare Pages > Settings > Variables (secrets). Add the callback URL in the PayU dashboard. | `PAYMENT_PROVIDER=payu`, `PAYU_KEY`, `PAYU_SALT`, `PAYU_ENV=test` |
| PayU live key and salt | Replace the two secrets | `PAYU_ENV=live` |
| MSG91 key and DLT template | Add secrets | `OTP_PROVIDER=msg91` |
| Reelo docs or key | Give to Claude, then add the key | `LOYALTY_PROVIDER=reelo` |
| Email alert key | Add secret | `ALERT_PROVIDER=email` |
| Owner approves go-live | Turn on | `ONLINE_ORDER_LIVE=true` (off = WhatsApp buttons) |
| Pay at pickup allowed | Turn on | `COD_LIVE=true`, `COD_MAX_TOTAL_MINOR=100000` |