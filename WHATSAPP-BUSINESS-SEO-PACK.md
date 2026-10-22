# Swagramam: WhatsApp Business + local SEO pack (v96)

Filled from the "WhatsApp Business SEO Optimization" playbook (sections 1 to 10). Only confirmed facts are used (master plan section 3). Anything unknown is marked **NEEDS INPUT**. Nothing here invents ratings, reviews, awards or prices.

## Inputs used
| Field | Value |
|---|---|
| Name | Swagramam (legal: RR FRESH FOODS) |
| Category | Restaurant |
| Address | Mogalrajapuram, Sidhartha Nagar, Labbipet, Vijayawada, Andhra Pradesh 520010 |
| Phone / WhatsApp | +91 76598 58999 (catering +91 98499 82052) |
| Email | orders@swagramam.in |
| Website | **NEEDS INPUT**: .com or .in (master plan section 14). Use the one the client owns, same on WhatsApp, Google and the site. |
| Hours | Lunch 12:00 to 16:30 (Monday lunch to 16:00). Dinner 19:00 to 23:30, every day. |
| Google Business Profile link | **NEEDS INPUT** |
| Competitors | **NEEDS INPUT** (optional) |

NAP rule: Name, Address, Phone must be written identically on WhatsApp, Google Business Profile (GBP) and the site footer. Use "Swagramam" as the display name everywhere; the legal name RR FRESH FOODS only where the GST certificate must match (Meta verification).

---

## 1. WhatsApp Business profile (copy into Business tools > Business profile)
- **Business name:** Swagramam (must match the Meta verification documents' trade name)
- **Category:** Restaurant
- **Description, short (141 characters):**
  `Village-style South Indian kitchen in Labbipet, Vijayawada. Thali lunch, dinner combos, take away and catering. Order or reserve on WhatsApp.`
- **Description, long (about 330 characters):**
  `Swagramam is a village-style South Indian kitchen at Mogalrajapuram, Sidhartha Nagar, Labbipet, Vijayawada. Lunch (Bhojanam thali) 12:00-16:30, dinner 19:00-23:30. Order take away, reserve a table, or plan an event with our catering team, all on WhatsApp. Join Village Club Rewards: Rs 1 = 1 point.`
- **Address:** Mogalrajapuram, Sidhartha Nagar, Labbipet, Vijayawada, Andhra Pradesh 520010
- **Website:** NEEDS INPUT (see above)
- **Email:** orders@swagramam.in
- **Hours:** Mon: 12:00-16:00 and 19:00-23:30. Tue to Sun: 12:00-16:30 and 19:00-23:30.
- **Coverage area:** Labbipet, Governorpet, Benz Circle, MG Road, Patamata, Bhavanipuram, Vijayawada. (Pickup only, so "coverage" means where customers come from. Remove any area the owner does not want named.)
- **Profile photo:** the logo on a plain background, square, no text other than the logo.
- **Cover photo:** a real photo of the restaurant front or the thali (client to supply; the AI-drawn crops are not used).

## 2. Username options (check availability inside WhatsApp; none is claimed available)
| # | Username | Type | Signal |
|---|---|---|---|
| 1 | swagramam | brand | name |
| 2 | swagramam.in | brand | name (only if the .in domain is the real one) |
| 3 | swagramamfoods | brand | name |
| 4 | swagramam.vijayawada | location | name + city |
| 5 | swagramam.labbipet | location | name + area |
| 6 | swagramamvja | location | short city code (less readable, use last) |
| 7 | swagramamthali | brand + service | thali |
| 8 | swagramamkitchen | brand + service | kitchen |
| 9 | southindiankitchen.swagramam | keyword | cuisine |
| 10 | swagramam.catering | brand + service | catering |

**Best:** `swagramam`. **Alternatives:** `swagramam.vijayawada`, `swagramamkitchen`, `swagramam.labbipet`. Avoid numbers and extra keywords. A custom web URL needs a Meta Business subscription (not bought by us).

## 3 and 4. Catalogue
Do not type 99 items by hand. Run in the repo:
`node tools/make-wa-catalogue.mjs > whatsapp-catalogue.csv`
It reads the same menu data the checkout uses (prices cannot drift) and writes: category, name, short description (under 60 characters), price in rupees, veg flag, suggested image file name. Prices are menu prices as the site stores them (GST basis still unconfirmed, D3; add the "plus GST" note only after the client confirms).

**Category order (most commercial first, set the first as the default view):**
1. Bhojanam (Thali), lunch only
2. Combos, dinner only
3. Then the remaining courses in the order they appear on the menu page.
Show "Lunch only 12:00-16:30" in the description of thali items and "Dinner only" for combos, so people do not ask for them at the wrong time.

Image file names: `swagramam-<dish-name>-vijayawada.jpg`. Real photos only; three Karnataka dishes still have none.

## 5. Local SEO and GBP sync
- Make the GBP description say the same core as the WhatsApp description (not word for word).
- GBP categories: primary "South Indian restaurant"; secondary "Restaurant", "Caterer". Choose only what GBP offers and the client agrees with.
- GBP "Message" button / website field: the click-to-chat link in section 8.
- Add menu link, hours (with the Monday exception) and the phone exactly as in the table above.
- 5 "near me" phrases to work into GBP posts and the FAQ: south indian restaurant near Labbipet; thali near Benz Circle Vijayawada; village style restaurant Vijayawada; take away food near Labbipet; catering services in Vijayawada.
- Competitor gaps: not done, no names supplied.
- Telugu: one Telugu line in the description is worth adding if the client approves the wording. Not added here, so no wrong translation goes live.

## 6. Keywords by intent (use inside description, catalogue text, FAQ, GBP posts; do not stuff)
- **Transactional:** order thali online Vijayawada, take away biryani Labbipet, book table south indian restaurant Vijayawada, catering booking Vijayawada, dinner combo order Vijayawada, lunch thali take away, whatsapp food order Vijayawada, party order south indian food Vijayawada, reserve table Labbipet, pickup order restaurant Vijayawada.
- **Commercial:** best south indian restaurant Vijayawada, thali restaurant Vijayawada, village style restaurant Vijayawada, family restaurant Labbipet, restaurants with catering Vijayawada, veg and non veg restaurant Labbipet, restaurant menu with prices Vijayawada, dinner restaurant open late Vijayawada, authentic andhra meals Vijayawada, biryani restaurant Labbipet.
- **Local:** restaurant Labbipet, restaurant Mogalrajapuram, restaurant Sidhartha Nagar, restaurant near Benz Circle, restaurant near Governorpet, restaurant near MG Road Vijayawada, restaurant Patamata, restaurant Bhavanipuram, restaurant near me Vijayawada, Vijayawada food Labbipet.
- **Informational:** what is in a south indian thali, swagramam timings, swagramam menu, does swagramam take away, swagramam catering contact, is swagramam open on Monday, swagramam location, swagramam rewards, how to join village club rewards, swagramam phone number.
- **Voice:** "where can I get a thali near Labbipet", "which restaurant is open for dinner near me in Vijayawada", "south indian restaurant with take away near me", "who does catering in Vijayawada", "what time does Swagramam open".
Use: description and catalogue = transactional + local; FAQ and Quick Replies = informational + voice; GBP posts = commercial.

## 7. Conversion copy
- **Greeting message:**
  `Welcome to Swagramam, Labbipet, Vijayawada! Reply 1 for Take away, 2 to Reserve a table, 3 for Timings and location, 4 for Catering.`
- **Away message (outside hours, or when closed):**
  `Thank you for messaging Swagramam. We are closed now. Lunch 12:00-16:30 (Mon till 16:00), dinner 19:00-23:30. Leave your message and we will reply when we open.`
- **5 Quick Replies (shortcut, text):**
  1. `/hours` : Lunch 12:00-16:30 (Monday till 16:00). Dinner 19:00-23:30, every day.
  2. `/location` : Mogalrajapuram, Sidhartha Nagar, Labbipet, Vijayawada 520010. Call +91 76598 58999.
  3. `/takeaway` : Please send the dishes, quantity and pickup time. Thali is lunch only, combos are dinner only. We will confirm your order.
  4. `/reserve` : Please send your name, date, time and number of people. We will confirm your table.
  5. `/catering` : For events please share date, place and number of guests, or call +91 98499 82052.
- **Best CTA:** "Order take away or reserve a table" (the two WhatsApp buttons already on the site).
- **5 FAQs (also usable as GBP Q&A):**
  1. *What are your timings?* Lunch 12:00-16:30 (Monday till 16:00), dinner 19:00-23:30, every day.
  2. *Is take away available?* Yes. Order on WhatsApp, and pick up at the restaurant. We do not deliver.
  3. *Do you have a thali?* Yes, the Bhojanam thali is served at lunch only. Dinner has combos.
  4. *Do you do catering?* Yes. Call +91 98499 82052 or message us the date and guest count.
  5. *Do you have a rewards programme?* Yes, Village Club Rewards: Rs 1 = 1 point on the bill before tax. Rewards are redeemed in the restaurant.
  (Add "Can I pay online?" only after online ordering is switched on: PayU, or pay at pickup for totals up to Rs 1000.)
- **5 objections and replies:** "Is it veg?" We have veg and non-veg dishes; tell us your choice. "Is there a delivery?" Not now, pickup and dine-in. "Can I change my order?" Message us before the pickup time. "Is the price final?" Taxes are added at billing; the exact amount is confirmed on your order. "Do I need to reserve?" Not required; it is safer at dinner and on weekends.

## 8. Click-to-WhatsApp links
Base: `https://wa.me/917659858999?text=<text>` (text URL-encoded). wa.me does not accept UTM tags, so each placement gets its own opening text, which doubles as the tracker.
| Placement | Prefilled text |
|---|---|
| Website button | `Hi Swagramam, I would like to order take away.` |
| Google Business Profile | `Hi Swagramam, I found you on Google. I would like to reserve a table.` |
| Instagram bio | `Hi Swagramam, I came from Instagram.` |
| Email signature / Google Maps description | `Hi Swagramam, I would like to know more.` |
Generate encoded links with `node tools/wa-links.mjs`. Test each link on a real phone.

## 9. Reviews
- **Review request (send once, only to a customer who just ordered or dined and wrote to us; never bulk):**
  `Thank you for choosing Swagramam! If you enjoyed your meal, a short Google review helps us a lot: <GBP review link>`
- **Reply to a positive review:** `Thank you, we are happy you enjoyed it. See you again at Swagramam, Labbipet!`
- Rating and review count are ranking signals, but they must be real. Nothing is quoted on the site until the client has real ones.

## 10. Final copy-paste block
```
BUSINESS PROFILE
Business Name: Swagramam
WhatsApp Username: swagramam (check availability)
Category: Restaurant
Description (short): Village-style South Indian kitchen in Labbipet, Vijayawada. Thali lunch, dinner combos, take away and catering. Order or reserve on WhatsApp.
Description (long): see section 1
Address: Mogalrajapuram, Sidhartha Nagar, Labbipet, Vijayawada, Andhra Pradesh 520010
Website: NEEDS INPUT
Email: orders@swagramam.in
Hours: Mon 12:00-16:00, 19:00-23:30; Tue-Sun 12:00-16:30, 19:00-23:30
Coverage Area: Labbipet and nearby Vijayawada areas (owner to confirm)
Click-to-WhatsApp Link: https://wa.me/917659858999?text=Hi%20Swagramam%2C%20I%20would%20like%20to%20order%20take%20away.
```
Catalogue, Quick Replies, FAQs and keywords: sections 3 to 7 above.

## Meta business verification checklist (master plan O8.6)
- Legal name RR FRESH FOODS, address and GSTIN 37ABMFR0466Q2ZC match the GST certificate.
- Website live on the final domain with working Privacy and Terms pages (Refund and Cancellation to follow).
- Website, WhatsApp and GBP show the same name, address and phone.
- Business email on the same domain as the website if possible (orders@swagramam.in means the domain choice matters).

## Monthly tracking (first week of each month)
| Signal | Where | If low |
|---|---|---|
| Profile views and chats started | WhatsApp Business app, Insights | Test a new description first line or CTA |
| Catalogue item views | WhatsApp Catalogue insights | Reorder categories; refresh top photo |
| Searches that found the business | GBP Insights | Add those phrases to FAQ and posts |
| NAP match | Site, GBP, WhatsApp | Fix the odd one out now |
| Review count and rating | GBP | Use the review request more |
| Chats per placement | Count the opening texts in section 8 | Move or reword the weak link |

## Rules
Do not send unsolicited broadcasts. Marketing messages only to people who ticked marketing consent. No claim about awards, ratings, certifications, offers or prices that the owner has not confirmed.

## Pre-publish checklist
- [ ] Domain chosen and the same everywhere
- [ ] Username checked in WhatsApp
- [ ] GBP link supplied and descriptions aligned
- [ ] Catalogue CSV reviewed by the owner (prices, veg flags, real photos)
- [ ] Hours include the Monday exception
- [ ] All wa.me links opened on a real phone
- [ ] Quick Replies and FAQs read by the owner
- [ ] No invented reviews, ratings or claims
