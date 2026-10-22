# Swagramam: what YOU do after the WordPress conversion

Simple rule: Claude builds the theme. You test it on a staging site and go live.

## Each session (6 sessions in total)
1. Upload the latest zip and HANDOFF.md to Claude.
2. Paste the start prompt from `swagramam-wordpress-session-plan.md`.
3. Claude gives you a new zip and a new HANDOFF.md. Save both.
4. Test the new zip on a staging WordPress (LocalWP or a staging subdomain).
5. Something broken? Send Claude a screenshot and the error text. Then start the next session.

## When all 6 sessions are done: go-live steps
1. **Hosting and domain:** WordPress hosting with PHP 8+ and SSL. Tell Claude the real domain so `swagramam.com` can be replaced everywhere.
2. **Backup:** keep the static zips (v86, v87, v89) safe. Never delete them.
3. **Install:** Appearance > Themes > Add New > Upload the theme zip > Activate. Steps are in `INSTALL.md`.
4. **Create pages:** Home, About, Menu, Catering, Privacy, Terms. Set Home as the front page (Settings > Reading).
5. **Import the dishes:** run the dish import from Session 3. Check 86 dishes and all photos show.
6. **Fill "Swagramam Settings":** WhatsApp number, hours, address, phones, FSSAI, GSTIN, Instagram, UPI ID, Analytics.
7. **Plugins:** only a cache plugin, a security plugin and a backup plugin. Turn OFF "minify" and "combine JS" in the cache plugin (they break the intro and the payment screen).
8. **Test on a real iPhone and a real Android phone:**
   - Intro, music, page transitions, hero, menu photos.
   - Instagram and WhatsApp buttons and the chat panel.
   - Add a dish, Take away, UPI QR with the right amount.
   - **One real UPI payment** (a small amount) and check it reaches the Pine Labs account.
   - WhatsApp order message arrives. Reservation message arrives.
9. **Client approval:** the client (or a lawyer) approves the Privacy and Terms text, including the payment and refund line.
10. **Go live:** point the domain to the host, check SSL, test once more.
11. **After going live:**
    - Submit `sitemap.xml` in Google Search Console.
    - Link the website in the Google Business Profile and Instagram bio.
    - Set up WhatsApp Business using `WHATSAPP-SETUP.md`.
    - Give the owner `HOW-TO-EDIT.md`.

## Staff rule (tell the restaurant)
- The website cannot see if money arrived.
- **Check the Pine Labs / bank app before cooking a Take away order.**
- Then reply `/confirm` or `/paid` in WhatsApp.

## Later (optional)
- Automatic "Paid" status needs PayU or a similar gateway (Session 7, Option B). Ask Claude when you want it.
- Automatic WhatsApp replies need the WhatsApp Business Cloud API (Meta approval).

---

# How to do the install: Laptop first (LocalWP), then Hostinger

Plan: test everything on your laptop (free), then repeat the same steps on Hostinger for the live site.

## A. On your laptop with LocalWP (test copy)
1. Install **LocalWP** (free, localwp.com).
2. Create a site named `swagramam`. Choose PHP 8 or newer. Set an admin user and password.
3. Click **WP Admin** inside Local. This is your local WordPress dashboard.
4. **Appearance > Themes > Add New > Upload Theme.** Choose the theme zip from Claude. Click **Activate**.
5. **Pages > Add New.** Create Home, About, Menu, Catering, Privacy, Terms. Pick the matching template for each (HANDOFF.md lists them).
6. **Settings > Reading.** Choose "A static page", set Home as the front page.
7. **Import dishes.** Use the import step Claude gives in Session 3. Check 86 dishes and photos show.
8. **Swagramam Settings** (left menu): fill WhatsApp, hours, address, FSSAI, GSTIN, Instagram, UPI ID.
9. Test on the laptop. Real phone and real UPI payment are tested later on the live site.

## B. On Hostinger (live site)
1. Buy a **WordPress hosting plan** and a **domain** on Hostinger. Choose WordPress during setup. Hostinger installs it for you.
2. hPanel > **Websites > Manage > WordPress > WP Admin**. This is your live dashboard.
3. Switch on **maintenance / coming soon mode** so visitors do not see it half-built.
4. Repeat A4 to A8 here (upload the theme, create the pages, front page, import dishes, settings).
   - Theme zip too big to upload? hPanel > **File Manager** > `public_html/wp-content/themes` > upload and extract.
5. hPanel > **SSL**: make sure it is active. Force HTTPS.
6. Hostinger's **LiteSpeed Cache** plugin: turn OFF "minify JS", "combine JS" and "combine CSS".
7. Domain bought elsewhere? Point its nameservers to Hostinger.
8. Do the real phone tests (one real UPI payment).
9. Switch off maintenance mode. You are live.

## Which one first?
Do **A first**. It is free, safe, and mistakes cost nothing. Do **B** when A works.
Do not use a migration plugin. Repeating the steps is simpler and cleaner.
