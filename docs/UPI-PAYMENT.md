# Swagramam: UPI payment for Take away (v87)

## How it works for the customer
1. Adds dishes, taps **Take away**, fills name, mobile, date and time, taps **Continue to pay by UPI**.
2. Sees the **order total** and a **UPI QR with the amount already filled in**.
   - On a phone: a **Pay with UPI app** button opens GPay / PhonePe / Paytm (iPhone shows GPay, PhonePe and Paytm buttons).
   - On a laptop: scan the QR with any UPI app.
   - UPI ID with a Copy button, and the shop's printed QR as a fallback ("QR not scanning?").
3. Pays in the UPI app and comes back.
4. Taps **I have paid, send order on WhatsApp**.
5. WhatsApp opens to +91 76598 58999 with the order ready. The customer presses **Send**.
6. Restaurant checks the bank / Pine Labs app, then replies "Order confirmed ✅".

"Pay at pickup instead" (small link) sends the order with "Payment: pay at pickup", so a customer without UPI is never blocked.
Dine-in reservations are unchanged (no payment step).

## WhatsApp message the restaurant receives
```
*Take away order*
Name / Mobile / Take away date / time
*Selected dishes*  1. ... x 2 = ₹298 ...
Estimated total: ₹447

*Payment*
Payment: UPI, awaiting confirmation
Amount paid: ₹447
Paid to: pinelabs.stq5137823@pineaxis
Please reply with your UPI transaction ID or attach the payment screenshot.
```

## Tell the client (limits)
- The website **cannot see** whether money arrived. A customer can tap "I have paid" without paying. **Staff must check the bank / Pine Labs app before preparing the order.**
- The message asks for the UPI transaction ID or a screenshot to make checking quick.
- The site **cannot mark an order "Paid"** automatically. Only PayU or a similar gateway can do that (see Session 7, Option B).
- Match the **amount** and the **time** of the payment to the order. Anything unmatched: ask the customer on WhatsApp.

## Staff routine (add to WhatsApp Business quick replies, see WHATSAPP-SETUP.md)
1. New message with "Payment: UPI, awaiting confirmation": open the Pine Labs / bank app and look for the amount.
2. Found: reply `/confirm` (and label **Confirmed**). Not found: reply `/txn` and wait.
3. Do not start cooking until the money is seen.

## Where the settings are
`site/order.js`, top of the file, `CONFIG.upi`:
| Key | Value now | Meaning |
|---|---|---|
| `id` | `pinelabs.stq5137823@pineaxis` | UPI ID (from the printed QR) |
| `name` | `RR FRESH FOODS` | Payee name registered with Pine Labs. Customers see this in their UPI app |
| `mc`, `tr` | `5812`, `STQ5137823` | Merchant category and terminal reference, copied from the printed QR |
| `img` | `assets/upi-qr.webp` | The printed shop QR (fallback) |
| `counter` | `true` | Show or hide "Pay at pickup instead" |
Set `upi:null` to switch the whole payment step off (Take away then goes straight to WhatsApp, as in v86).

## Must test before launch (needs a real phone and a real payment)
The QR and links were checked in a test browser (QR decodes to the exact UPI link, amounts match). A real UPI app could not be tested here.
1. Put one dish (or temporarily a ₹1 item) in the cart, choose Take away, and pay with GPay, PhonePe and Paytm on Android, and on an iPhone.
2. Confirm: the app opens with **the amount prefilled** and the payee **RR FRESH FOODS**; the payment reaches the Pine Labs account.
3. If an app refuses the prefilled amount (some merchant UPI IDs only allow the printed static QR), set in `order.js`: remove `tr` and `mc` first; if it still fails, tell us. The fallback "Use the shop QR" then becomes the main method (the customer types the amount shown on screen).
4. Check the privacy / terms pages: add a short payment and refund line (client or lawyer to approve). Neither page mentions payments yet.

## Files changed in v87
`site/order.js` (payment step, QR generator, one bug fix), `site/site.css` (new block at the end), `site/*.html` (cache versions `site.css?v=102`, `order.js?v=79`), `site/assets/upi-qr.webp` (new).
