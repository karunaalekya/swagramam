# Swagramam WhatsApp setup (do this once, 10 minutes)

The website already sends chats, Take away orders and Dine-in reservations to **+91 76598 58999** with the message ready to send.
Use the free **WhatsApp Business app** on that number so replies and greetings work from the restaurant side too.

## 1. Greeting message (Business tools > Greeting message > send to everyone)
Namaste! 🙏 Welcome to Swagramam, Vijayawada.
Please tell us your *name* and how we can help:
1. Take away order  2. Table reservation  3. Menu / timings

## 2. Away message (Business tools > Away message > outside business hours)
Thank you for messaging Swagramam 🙏 We are closed right now.
Lunch 12:00 to 4:30 pm (Mon till 4:00 pm) · Dinner 7:00 to 11:30 pm, every day.
We will reply as soon as we open.

## 3. Quick replies (Business tools > Quick replies)
/confirm  Your order is confirmed ✅ Thank you for choosing Swagramam! Please show this chat at the counter.
/table    Your table is reserved ✅ Please arrive 10 minutes early. We look forward to welcoming you!
/timings  Lunch 12:00 to 4:30 pm (Mon till 4:00 pm) · Dinner 7:00 to 11:30 pm, every day.
/location Mogalrajapuram, Sidhartha Nagar, Labbipet, Vijayawada 520010
/ready    Your take away order is ready for pickup 🥡
/txn      Please send your UPI transaction ID or a screenshot of the payment so we can confirm your order 🙏
/paid     Payment received ✅ Your order is confirmed. Thank you for choosing Swagramam!

## 4. Labels
Create labels: New order, Awaiting payment, Confirmed, Ready, Reservation.
Take away orders paid by UPI arrive with "Payment: UPI, awaiting confirmation". Check the Pine Labs / bank app, then send /paid or /confirm. See UPI-PAYMENT.md.

## Two-way automation later (optional)
The website can only open WhatsApp with a ready message; the customer presses Send, and you reply in WhatsApp.
Automatic replies and order tracking from the website need the WhatsApp Business Cloud API (or a plugin on WordPress that uses it).
That is a separate setup with Meta approval; ask before enabling.
