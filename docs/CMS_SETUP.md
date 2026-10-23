# Swagramam CMS (Sanity): setup and how the build works

**Status: step 1a (dishes, categories) DONE, step 1b (contact, address, map, hours) DONE, step 2 (home page "What's new" announcements) DONE. Sections "Step 1b" and "Step 2" are at the end.** Photos, sold-out badge and reviews are next (see "Next").

## What was built (step 1a: dishes and categories)
| File | Job |
|---|---|
| `cms/` | The Sanity Studio the client edits in (Dish and Category forms, with checks) |
| `tools/cms-seed.mjs` | One time: turns today's 86 dishes and 9 categories into Sanity documents (`cms/seed/seed.ndjson`) |
| `tools/cms-build.mjs` | Every deploy: fetches from Sanity, checks everything, then writes the generated files |
| `tools/cms-lib.mjs` | Shared rules: generators, validation, id lock |
| `tools/cms-ids.lock.json` | Each dish keeps its number and code for ever (rename, hide, delete never change them) |
| `tools/test/cms.test.mjs` | 9 tests. Run: `node --test tools/test/cms.test.mjs` |

One build writes four things from the same data, so they cannot disagree:
`order-data.js` (order popup), `functions/_lib/menu-data.js` (server price list, also read by `reelo-push-menu.mjs` and `make-wa-catalogue.mjs`), and in `menu.html` the menu data, the no-JavaScript list and the schema.org (Google) menu block.

Tested: with Sanity data equal to today's site, all three files regenerate **byte for byte** (menu-data.js differs only in its first comment line).

## One-time setup (owner or developer)
1. Create the project: https://www.sanity.io/manage > Create project (dataset `production`, private). Note the **Project ID**.
2. In `cms/sanity.cli.js` and `cms/sanity.config.js` replace `YOUR_PROJECT_ID`.
3. `cd cms && npm install`
4. Load today's menu: `npx sanity login` then `npx sanity dataset import seed/seed.ndjson production`
   (add `--replace` only to reset to today's menu).
5. Test the Studio: `npm run dev` (opens http://localhost:3333). Deploy it for the client: `npx sanity deploy` (gives a hosted link, then invite the client under Manage > Members).
6. Read token: Manage > API > Tokens > Add token, role **Viewer**. Never put it in the repo.
7. Cloudflare Pages > swagramam > Settings:
   - Build command: `node tools/cms-build.mjs`  (output directory stays `/`)
   - Variables (Production and Preview): `SANITY_PROJECT_ID`, `SANITY_DATASET=production`, `SANITY_READ_TOKEN` (as a secret)
   - Settings > Builds > Deploy hooks > Add hook, copy the URL.
8. Sanity > Manage > API > Webhooks > Create: URL = the deploy hook, trigger on create, update, delete, filter `_type in ["dish","category","siteSettings","announcement"]`, projection empty. Now Publish in the Studio rebuilds the site (about 1 to 2 minutes).

## Safety rules the build enforces (nothing is written if any fails)
- Sanity down, empty, or answering with the wrong shape: build stops, live site keeps the old deployment.
- Price must be whole rupees above 0 (single price or every size option); name not empty; category exists; veg/non-veg and lunch/dinner set; size options need 2 or more.
- Every category shown at lunch or dinner must have at least one dish for that meal.
- Dish code (`dishId`) and size option code can never change: the build stops if one does. Orders, carts and Reelo use these.
- Hidden dish: removed from the site. Sold out dish: stays in the server list as unavailable.
- Run locally any time: `SANITY_PROJECT_ID=xxx SANITY_READ_TOKEN=xxx node tools/cms-build.mjs --check` (shows what would change, writes nothing).

## Known limits right now (next steps)
1. **Sold out** is enforced by the server (cannot be ordered) but the menu page and order popup do not show a "Sold out" badge yet. Needs a small change to `order.js` and the menu script.
2. **Photos** are not connected yet (build step 4). Dishes keep their current photo files.
3. **Contact, Address, Hours**: not generated yet. They are hand-written in many files (see the audit in CMS_Editable_Fields_Swagramam.md), so this is the next piece.
4. The ID lock file is updated by the build on Cloudflare but not saved back to git. New dishes still get stable numbers; once in a while run the build locally and commit `tools/cms-ids.lock.json`.
5. `priceRange` ("Rs 400 to 1,600") in the Google data and the home page dish names are still hand-written.
6. Not run against a real Sanity project or Cloudflare yet; all tests use a copy of the data.

## Step 1b: contact, address, map and opening hours
One Studio form, **Contact, address and hours** (a single document, cannot be duplicated). On Publish the site rebuilds and these are updated everywhere at once:
| Field | Where it lands |
|---|---|
| Main phone / WhatsApp, second phone | every page: call links, WhatsApp links, visible numbers, Google data (`telephone`), `checkout.js` |
| Order email | every page and `functions/_lib/payu.js` |
| Address line, short area, city, PIN | footers, header, checkout, Google data (`streetAddress`, `addressLocality`, `postalCode`) |
| Google Maps search text | every map link and the home page map embed |
| Latitude, longitude | Google data (`geo`) |
| Lunch, Monday lunch, dinner times | visible text on every page, Google `openingHoursSpecification`, the Open now / Closes at badge (`fx.js`), the order popup (`order.js`) and the **server** pickup slots (`functions/_lib/slots.js`), so browser and server always agree |

Setup: the seed file already contains this document with today's values. Re-run step 4 of the one-time setup (`sanity dataset import seed/seed.ndjson production`, without `--replace` it will not overwrite existing documents) or just open Studio and press Publish once. Until the document is published the build leaves all hand-written values alone.

Rules the build enforces (nothing is written if any fails): phones are 10 digits starting 6 to 9; email valid; no `< > " & \\` in text; times are HH:MM, lunch closes after it opens, dinner opens after lunch closes; if the address or map text changes, latitude and longitude must change too. When the map text changes the old Google place id (`ftid`) is removed so the link cannot point to the old place.

Tested (`node --test tools/test/cms-settings.test.mjs`, 7 tests): with today's values every file is byte for byte identical; with different values no old phone, email, address, PIN, map id or time is left anywhere.

Not covered on purpose (still hand-written):
- The FSSAI registered address line in privacy and terms (legal text).
- The word "Vijayawada" inside descriptive sentences and page titles, and the Facebook/Instagram links.
- Sitemap, `seo/` files, `tools/wa-links.mjs` and docs (they are not part of the live pages).
- Opening-hours sentences written in a new style someone adds later: the build will not touch them. The test fails if an old time is left in the known places, so rerun it after adding text.
- Public holidays and one-off closures.

## Step 2: "What's new at Swagramam" announcements (home page)
Studio list **What's new (home page)**. Each card: title, text, small label, icon (gift, cutlery, calendar), optional link and link text, optional **Hide after** date, **Order** (10 shows first), and **Hide without deleting**. On Publish the site rebuilds the cards in `index.html`; the swipe dots and the hide-after script stay as they are.
| Rule | Why |
|---|---|
| Title up to 60, text up to 160, label up to 30 characters; no `< > " \` | cards stay one shape on phones |
| Link must be a page (`menu.html`, `menu.html#menu`), a section (`#rewards`) or `https://...` | no `javascript:` or plain `http:` links |
| Hide-after must be a real date | the browser hides the card after that day, no rebuild needed |
| Up to 6 cards (keep 3 to 4) | it is a swipe strip |
| No announcement documents yet | the hand-written cards stay untouched |
Today's three cards are in the seed file (`announcement.1` to `.3`). Import with step 4 above (without `--replace`, existing documents are not overwritten). Check any time: `SANITY_PROJECT_ID=xxx SANITY_READ_TOKEN=xxx node tools/cms-build.mjs --check`.
Tested (`node --test tools/test/cms-news.test.mjs`, 9 tests): today's cards regenerate the home page byte for byte; add, reorder, remove; escaping; bad content refused; works together with step 1b in the same file.

## Next (not built)
1. Sold-out badge on the menu page and order popup (the server already refuses sold-out dishes).
2. Photos from Sanity (step 4 of the plan). Needs the real dish photos first.
3. Reviews carousel, signature dishes row, rewards tiers, social links and `priceRange` (still hand-written).
4. Run once against a real Sanity project and Cloudflare Pages (nothing here has touched either).
5. Commit `tools/cms-ids.lock.json` after the first real build.
