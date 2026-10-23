# Phase 2: Reelo email (send as one message) and open answers

## Email text (from the restaurant owner or BJNEXUS.AI to Reelo support)
Subject: Swagramam, Vijayawada: integration questions for website ordering (coupons, freebies, points)

Hello Reelo team,

We are connecting the Swagramam take away website to Reelo. Bill capture and customer lookup are built to your POS docs. To finish redemption at checkout we need answers to these:

1. What are the production base URL and the credentials (vendor id, merchant id, customer key)? Is the sandbox URL the same host?
2. Is there an API that lists a customer's available coupons and freebies by mobile number? (Our current lookup returns coupons inside the loyalty lookup. Is that the full list, and does it include free dishes?)
3. Is there an API to validate or apply a coupon to a bill before payment, returning the discount amount?
4. Can a redemption be reserved and then released if payment fails? We found no release call in the docs. If none exists, can a redemption be committed only after payment, and is that call idempotent (safe to retry with the same transaction id)?
5. What is the points redemption rule: rupee value per point, minimum points, maximum per bill, and does redemption need an OTP?
6. When we send the bill with a coupon or points redemption, does Reelo return or expect the discount amount? Should gross_amount be before discount and net_amount after? Should a customer tip be left out of the bill?
7. Can you give us a sandbox account and sample coupons, freebies and points for testing?

Thank you.

## Open answers tracker
| # | Question | Answer | Date | Affects |
|---|---|---|---|---|
| 1 | Base URL, credentials, sandbox | | | reelo.js config |
| 2 | List coupons and freebies | | | listOffers |
| 3 | Validate or apply coupon, discount amount | | | validate |
| 4 | Reserve and release, or idempotent commit after payment | | | reserve/commit/release, fallback |
| 5 | Points rule (value, minimum, cap, OTP) | | | offers.js constants |
| 6 | Discount and tip in bill capture | | | reelo.js bill() |
| 7 | Sandbox account | | | sandbox test |

## Owner decisions still open
- D6: can a coupon and points or a freebie be combined on one order? Today: one offer per order (`offersStack:false`).
- D3: GST rate and basis (5% on the amount after discount is assumed).
- Tip limit: Other up to 30% of the item total or Rs 500, whichever is lower (assumed).
- Real coupon list, points value and minimum (the mock values in `functions/_lib/offers.js` are placeholders).

## What changes when Reelo answers
- All mock rules live in `functions/_lib/offers.js` behind three functions (pointsInfo, listOffers, validate). A `reelo` version of those three plugs in; the ledger (`redeem.js`), pricing and tests stay.
- If Reelo cannot reserve or release: redeem in Reelo only after payment success, with retry on the same transaction id and an owner alert on failure. The local ledger already blocks double use meanwhile.
