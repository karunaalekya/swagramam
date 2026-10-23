# Swagramam Online Ordering: FINAL MODIFIED PLAN v2 (phase-wise)
Date: 22 Oct 2026. Updated 23 Oct 2026: Phase 1 done, Phase 2 mock done; see docs/PENDING_STATUS.md. Replaces the "3-session path" in Master Plan section 13. Older plan file stays for reference (sections 3, 4, 6 still hold).
Reference pattern: the Biryanis checkout (pickup banner, guest or sign-in, tip, coupon and freebies, payment summary). Copy the flow, not their design, code or text.

## A. Honest baseline (verified 22 Oct 2026 from swagramam-v96-final.zip)
| Area | State |
|---|---|
| API (menu, quote, slots, OTP, checkout/start, status, lookup, PayU callback/webhook) | Written. 38 tests pass on a SQLite stand-in. Never run on real Cloudflare. |
| PayU code (hash, verify) | Written. No keys. Never called. |
| MSG91 OTP code | Written. No key, no DLT template. Never called. |
| Reelo adapter (lookup, bill, retry) | Written. No base URL or credentials. Never called. |
| Checkout page | Basic. Pickup, cart, OTP, payment method. |
| Tip, coupon, freebies, points redemption, guest or sign-in screen | NOT BUILT. `loyalty.commit()` is a stub. |
| Order Board, counter flow, owner alerts | NOT BUILT. |
| Cloudflare D1, KV, bindings, secrets | NOT DONE. In production the site falls back to the WhatsApp/UPI popup. |

## B. Rules for every session (keeps work safe if a session dies)
1. Start by reading STATUS.md, then this file. Work on ONE phase only.
2. After each task: run `node --no-warnings --test tools/test/*.test.mjs`, update STATUS.md, then zip the repo and deliver it. Never end a turn with undelivered work.
3. Name zips `swagramam-v97-phaseN-partX.zip`. Include a patch list (changed files) in HANDOFF.md.
4. Money is integer paise. The server decides every price, tip, discount, tax and total. The browser never sends amounts.
5. Mock stays default. `ENV=production` refuses mock. Never ship secrets in the repo.
6. Anything unverified is written under "NOT tested" in STATUS.md. No claims of "done" without a test or a real call.

## C. Money model for the new checkout (Phase 1 and 2 must follow this)
Order of calculation (matches the Biryanis screen: 291 + tip 14.55 + tax 14.56 = 320.11):
1. `subtotal` = sum of dish lines.
2. `discount` = coupon + freebie + points redemption (server validated, never below 0, never above subtotal).
3. `taxable` = subtotal - discount. `GST` = 5% of taxable, half-up (owner and accountant to confirm D3).
4. `tip` = chosen % of subtotal (5, 10, 15) or a custom amount. Not taxed. 100% to staff. Tip is part of the PayU amount.
5. `total` = taxable + GST + tip.
6. Points earned = 1 point per Rs 1 of taxable amount (confirm with Reelo rules). No points on tip or tax.
New DB columns on `orders`: `tip_minor`, `discount_minor`, `coupon_code`, `redeem_points`, `redeem_ref`, `loyalty_status`. New table `redemptions(order_id, kind, ref, amount_minor, state reserved|committed|released, ts)`.
Pay-at-pickup limit (Rs 1000) compares against the total including tip.

## D. Phases

### Phase 0: Infrastructure in the CLIENT'S real Cloudflare account (owner clicks, about 20 min)
Goal: `/api/health` is live on a Preview URL with mock providers, while Production stays on the WhatsApp/UPI flow. Done once, in the real account, so nothing is repeated later.
Owner tasks (full text in CLOUDFLARE-SETUP.md):
1. D1: create `swagramam-orders`, run all of `db/schema.sql` in the Console (or `npx wrangler d1 execute swagramam-orders --remote --file=db/schema.sql`).
2. KV: create namespace `swagramam-kv`.
3. Bindings (Settings > Bindings): D1 as `DB`, KV as `KV`, on BOTH Production and Preview.
4. Variables and secrets: `TOKEN_SECRET` (40+ random chars, `openssl rand -hex 32`) and `ADMIN_KEY` on both. Production only: `ONLINE_ORDER_LIVE=off`. Leave `ENV` empty.
5. Deploy a non-main branch to get a Preview URL.
Safety rule: mock payment and the on-screen test OTP must never be reachable by real customers. Production stays `ONLINE_ORDER_LIVE=off` until Phase 5.
Accept: Preview `/api/health` shows live true; Production `/api/health` shows live false and its Take away button still uses WhatsApp/UPI; a mock order on Preview creates a row in D1.
Account hygiene for later phases: open MSG91, PayU and Reelo accounts in the client's name; paste keys only into Cloudflare secrets (never in chat, repo or zip); `PAYU_ENV=test` until Phase 5.
Deliver: owner pastes `/api/health` for Preview and Production into the next session.

### Phase 1: Checkout rebuild to the Biryanis pattern (mock providers) 
Goal: the screens in your three screenshots, working end to end on mock.
Build:
1. Ordering info card: Today or chosen day, pickup time, "Pickup from: Swagramam, Labbipet" with address and a CHANGE button.
2. Identity card: "Sign in to enjoy rewards, or continue as guest". Two buttons: Sign in / Join and Continue as guest.
3. Guest form: name, phone (10 digit India), email, consent box 1 (loyalty terms, required for members), consent box 2 (SMS alerts, optional, unticked). NEXT then OTP (6 boxes, Resend with 30 s timer, then Continue to Payment).
4. Right column: cart lines with +/-, delete, add item note, Add more items, order instructions box.
5. Tip card: 5%, 10%, 15%, Other. Default 5% preselected and clearly removable (tap X). Text: 100% goes to the team.
6. Redeem Rewards and Promos card: Apply Coupon (opens panel, code field, list of coupons for this phone) and Redeem Freebies (panel). Buttons work on mock data in this phase.
7. Payment Summary: Item total, Discount, Tax and charges (info tooltip with GST rate), Tip, points earning, Total including all taxes.
8. Mobile first (390 px), keyboard and screen reader labels, empty and error states.
Backend: add tip, discount fields to `/api/quote` and `/api/checkout/start`; schema migration `db/migrations/002_tip_discount.sql`; server clamps tip (0 to 30% or Rs 500 for Other, confirm).
Tests: extend api.test.mjs (tip math, rounding, total equals 291+14.55+14.56 style case, tip excluded from GST, COD limit uses total) and e2e.py at 390 and 1280.
Accept: all tests pass; screenshots at 390 and 1280 match the pattern; mock order completes with tip.
Deliver: zip `swagramam-v97-phase1.zip` + 2 screenshots.

### Phase 2: Loyalty redemption (coupons, freebies, points)
Goal: members can apply a coupon, redeem a freebie or points at checkout, safely.
Blocker (owner): ask Reelo in writing, one email. Questions: (1) production base URL and credentials; (2) is there an API to list a customer's coupons and freebies; (3) validate or apply a coupon on a bill; (4) reserve then release a redemption if payment fails (code notes say no release call exists); (5) points redemption rule and value (Rs per point, minimum, cap); (6) does bill capture with a coupon return the discount amount; (7) sandbox account for testing.
Build (no Reelo needed):
1. Provider interface: `listOffers(phone)`, `validate(phone, code, cart)`, `reserve(order)`, `commit(order)`, `release(order)`.
2. Mock provider in D1 with sample coupons (percent, flat, free dish) and points.
3. Server validation on every quote. Redemption is reserved when the order is created, committed on payment success, released on payment failure or unpaid expiry (30 min).
4. One discount type per order unless owner says stack (decision D6).
5. UI wired: coupon list, apply, remove, freebie list, points toggle with slider.
Build (after Reelo answers): `reelo.js` implements the same interface. If Reelo cannot reserve or release, fall back to: redeem only after payment success, with idempotent retry and an owner alert on failure.
Tests: reserve then payment fail then release; double submit; expired coupon; phone mismatch; replayed order id; discount never negative.
Accept: mock end to end passes; Reelo sandbox end to end passes (or the fallback is signed off by owner).
Deliver: zip + Reelo question email text + list of open answers.

### Phase 3: Real OTP and real PayU (test mode)
Goal: real SMS and a real PayU test payment.
Owner: MSG91 account, sender id, DLT-approved OTP template (can take days, start in Phase 0), authkey. PayU merchant key and salt (test first), success and failure URLs allowed.
Claude: set `OTP_PROVIDER=msg91`, `PAYMENT_PROVIDER=payu`, `PAYU_ENV=test`; verify hash with PayU test cards and UPI; check webhook and callback idempotency, amount mismatch rejection, tip included in amount; OTP rate limits and lockout; error messages for DLT rejection.
Accept: real OTP arrives on a real phone in under 30 s; a PayU test payment marks the order paid on the server, not just in the browser; failed and cancelled payments leave the order unpaid and release redemptions.
Deliver: zip + test log (order ids, timestamps, screenshots).

### Phase 4: Kitchen side: Order Board, counter flow, owner alerts
Goal: the restaurant actually sees and handles orders.
Build: password protected `/board` page (live list: new, accepted, preparing, ready, collected, no-show); accept and reject with reason; ready button sends customer SMS or WhatsApp; mark pay-at-pickup as paid; no-show counter (existing rule: 2 no-shows blocks pay-at-pickup); sound and push alert for new order; WhatsApp or SMS alert to owner number; daily summary; print ticket view (80 mm).
Tests: state machine transitions, auth, alert retry.
Accept: owner places 3 test orders and handles each from the board on a phone.
Deliver: zip + 1 page staff guide.

### Phase 5: Go live and harden
Checklist: confirm GST (D3), refund and cancellation policy pages, terms and privacy updated for SMS and loyalty consent, PayU live keys, `PAYU_ENV=live`, `ENV=production`, `ONLINE_ORDER_LIVE=on`, rate limiting on OTP and quote, CORS and security headers, error logging, backup export of D1, rollback switch (`ONLINE_ORDER_LIVE=off` returns to WhatsApp flow instantly), Safari, Firefox and a real Android and iPhone test, one real Rs 10 live payment and refund, staff trained.
Accept: all items ticked and a real order handled start to finish. Soft launch to a few customers for 2 days before announcing.

## E. Owner inputs (send as one message)
| Id | Needed | By phase |
|---|---|---|
| O1 | Confirm brand and domain (Swagramam, .in or .com). Screenshots are from a Hyderabad site: confirm only the pattern is wanted | 0 |
| O2 | Cloudflare setup done and health output pasted | 0 |
| O3 | MSG91 authkey, sender id, DLT OTP template id (start DLT now, it is the slowest item) | 3 |
| O4 | PayU test key and salt, later live key and salt | 3, 5 |
| O5 | Reelo: base URL, vendor id, merchant id, customer key, sandbox, answers to the 7 questions in Phase 2 | 2 |
| O6 | GST rate and basis (5% assumed), tip limits, can discounts stack | 1, 2 |
| O7 | Owner phone for alerts, board login choice | 4 |
| O8 | Refund and cancellation wording, final prices and menu | 5 |
| O9 | Real photos, "Britisher la Mushroom" dish name, "Multi Cuisine" vs "South Indian Kitchen" | any |

## F. Risks
1. Reelo may not support coupon reserve or release or any redemption API: mitigated by the Phase 2 fallback.
2. DLT approval delays OTP: start in Phase 0.
3. Tip and discount rounding mismatches with PayU amount: single money module, tests on every case.
4. Session cut-offs: rule B2, deliver a zip after every task.
5. Never run on real D1: Phase 0 exists to find this early.

## G. Resume prompts (paste at the start of each session)
- Phase 1: "Continue Swagramam. Read STATUS.md and docs/Swagramam_Ordering_Plan_v2_FINAL.md. Do Phase 1 only (checkout rebuild, tip, discount fields). Deliver a zip after each task."
- Phase 2: "... Do Phase 2 only (loyalty redemption, mock provider first). Reelo answers: <paste>."
- Phase 3: "... Do Phase 3 only (MSG91 and PayU test). Keys are set as Cloudflare secrets."
- Phase 4: "... Do Phase 4 only (Order Board, counter flow, alerts)."
- Phase 5: "... Do Phase 5 only (go-live checklist)."

## H. Progress tracker (tick and date)
- [ ] Phase 0   - [x] Phase 1 (23 Oct 2026, mock)   - [~] Phase 2 (mock complete 23 Oct 2026, Reelo pending)   - [ ] Phase 3   - [ ] Phase 4   - [ ] Phase 5
