// Pushes the full menu to Reelo (replaces theirs). Run after any price/menu change:
//   REELO_BASE_URL=... REELO_VENDOR_ID=... REELO_MERCHANT_ID=... REELO_CUSTOMER_KEY=... node tools/reelo-push-menu.mjs [--dry]
import { ITEMS, CATS } from "../functions/_lib/menu.js";
import { reelo, reeloMissing } from "../functions/_lib/reelo.js";
const dry = process.argv.includes("--dry");
const miss = reeloMissing(process.env);
if (dry) { console.log(JSON.stringify(ITEMS.filter(i => i.available).slice(0, 3).map(i => ({ id: i.sku, name: i.name, category_id: i.cat, category: CATS[i.cat], price: (i.priceMinor / 100).toFixed(4) })), null, 1)); console.log("items:", ITEMS.filter(i => i.available).length, miss.length ? "(missing: " + miss.join(", ") + ")" : ""); process.exit(0); }
if (miss.length) { console.error("Missing:", miss.join(", ")); process.exit(1); }
const nolog = { prepare: () => ({ bind: () => ({ run: async () => ({}) }) }) };   // no DB when run from a terminal
const r = await reelo({ ...process.env, DB: nolog }).pushMenu();
console.log(r.ok ? "Menu pushed: " + r.count + " items" : "FAILED " + r.status + " " + r.message, r.correlationId ? "correlationId " + r.correlationId : "");
process.exit(r.ok ? 0 : 1);
