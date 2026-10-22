// Builds a CSV for the WhatsApp catalogue from the same menu data the checkout uses.
//   node tools/make-wa-catalogue.mjs > whatsapp-catalogue.csv
import { ITEMS, CATS } from "../functions/_lib/menu.js";
const q = v => '"' + String(v == null ? "" : v).replace(/"/g, '""') + '"';
const slug = s => String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const when = i => (i.servedAt === "lunch" ? " Lunch only." : i.servedAt === "dinner" ? " Dinner only." : "");
const short = i => { const t = (i.name + (i.veg === true ? " (veg)" : i.veg === false ? " (non-veg)" : "") + "." + when(i)).trim(); return t.length <= 60 ? t : t.slice(0, 59) + "…"; };
const order = Object.keys(CATS || {});
const rows = ITEMS.filter(i => i.available).sort((a, b) => (order.indexOf(String(a.cat)) - order.indexOf(String(b.cat))) || a.name.localeCompare(b.name));
console.log(["category", "name", "short_description", "price_inr", "veg", "image_file_name", "sku"].join(","));
for (const i of rows) console.log([CATS[i.cat] || i.cat, i.name, short(i), (i.priceMinor / 100).toFixed(2), i.veg === true ? "yes" : i.veg === false ? "no" : "", "swagramam-" + slug(i.name) + "-vijayawada.jpg", i.sku].map(q).join(","));
console.error("items:", rows.length, "(check the category order against the menu page; thali first, combos second)");
