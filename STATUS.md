# Swagramam: project status (site v96, 22 Oct 2026)

Read this first in a new Codespace session. Then HANDOFF.md (version-by-version change log, v88 to v96) and docs/Swagramam_Ordering_Master_Plan.md (single source of truth for ordering; sections 5, 11, 13, 14, 15).

## Already done
**Website (static, Cloudflare Pages)**
- Pages: Home, About, Menu, Rewards (v94), Catering, Privacy, Terms, plus checkout.html (noindex).
- Chat buttons (WhatsApp + Instagram) with live open/closed panel (v88); wordmark + sunrise page transitions (v89).
- Phone layout: nav strip, header icons for Book / Call / Directions, phone landing and intro (v91, v92, v93).
- Intro shortened (~13 s), stats count-up, next-step bands on inner pages (v92).
- Audit passed on 6 pages at 1440 and 390 px (v90, v92).

**Ordering (Session 1, v95, on mock providers)**
- API in `functions/api/`: health, menu, quote, slots, otp/send, otp/verify, checkout/start, order/status, order/lookup, payu/callback, payu/webhook, mock-pay.
- Server decides prices, GST (5%, assumed, half-up), slots, the Rs 1000 payment rule and the open-order cap (2). Money in integer paise.
- D1 schema `db/schema.sql`; state machine; consent records; unpaid-order expiry (30 min); no-show check; pay-at-pickup order creation.
- Order popup goes to checkout.html only when /api/health says live; otherwise the old WhatsApp/UPI flow runs.
- `ENV=production` refuses mock payment and mock SMS.

**Switch-on code (v96)**
- MSG91 SMS (`OTP_PROVIDER=msg91`), Reelo loyalty (`LOYALTY_PROVIDER=reelo`, `REELO_CAPTURE` off by default), Reelo/POS verify endpoints, admin selfcheck, config warnings, `tools/reelo-push-menu.mjs`.
- PayU code was already in v95: needs keys only.
- WhatsApp Business + SEO pack: `WHATSAPP-BUSINESS-SEO-PACK.md`, `tools/make-wa-catalogue.mjs`, `tools/wa-links.mjs`, `tools/apply-seo.mjs`.
- Live-domain SEO: canonicals and JSON-LD on swagramam.in, robots.txt, sitemap.xml, noindex only on checkout.

**Tests (38 pass in this package)**: `node --no-warnings --test tools/test/*.test.mjs`. Browser check: `node --no-warnings tools/dev-server.mjs 8787` then `python3 tools/test/e2e.py`.

## NOT done / not tested
- Never run on real Cloudflare D1/KV (tests use a SQLite stand-in). Follow CLOUDFLARE-SETUP.md.
- Not tested: real MSG91 SMS, real Reelo calls (production base URL not in their docs), real PayU, a real phone, Safari, Firefox, a real UPI payment.
- `make-wa-catalogue.mjs` and `apply-seo.mjs` not run against the real menu and HTML.
- Session 2 (still to build): Order Board, counter flow (mark paid, no-show), owner alerts, loyalty pages online (`rewards-online` panel says "Opening soon"), refund/cancellation page drafts.
- Session 3: switch on real keys, harden, go live.
- Karnataka card on the cuisine map needs 3 real photos (Ghee Dosa, Military Veg Biryani, Nagarjuna Chilli Chicken).
- Legal pages still hide the chat buttons.

## Waiting on owner
MSG91 key + DLT template id, Reelo base URL / vendor id / merchant id / customer key, PayU key + salt, GST basis, POS name, final domain confirmation (.in used in v96; older files said .com), Google Business Profile link, real photos, the "Britisher la Mushroom" dish name, and whether titles should keep "Multi Cuisine" (intro sign says "South Indian Kitchen").

## Resume prompt
"Continue Swagramam from STATUS.md, HANDOFF.md and docs/Swagramam_Ordering_Master_Plan.md. Next: Session 2 (Order Board, counter flow, alerts, loyalty pages)."
