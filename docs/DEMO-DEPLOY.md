# Cloudflare demo: simple steps

Use the demo zip (`swagramam-demo-cloudflare.zip`). Not the full website zip.

1. Unzip it. You get one folder of files (index.html, assets, etc.).
2. Cloudflare dashboard > **Workers & Pages** > **Create** > **Pages** > **Upload assets**.
3. Name the project `swagramam-demo`. Drag in the unzipped folder. Click **Deploy**.
4. You get a link like `swagramam-demo.pages.dev`. Open it on your phone and check once.
5. Send the link to the client. Collect all changes in ONE list.
6. New version from Claude? Pages > your project > **Create deployment** > upload the new folder.

## What the demo copy has
- Hidden from Google (noindex tag, robots.txt, X-Robots-Tag header).
- No sitemap, no dev files.
- Payment step is still ON so the client can approve it. Tell the client: **do not pay, do not press Send in WhatsApp.** The UPI QR and the WhatsApp number are the real ones.
- To switch payment off in the demo: in `order.js` change `upi:{` to `upi:null,` (Claude can do it).

## Final site (later)
Use the full website zip, not the demo. The demo has noindex and must never go live on the real domain.
