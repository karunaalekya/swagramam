// Builds the WhatsApp Business catalogue CSV from the same menu data the site and checkout use.
//   node tools/make-wa-catalogue.mjs > whatsapp-catalogue.csv
//   python3 tools/wa-catalogue-images.py whatsapp-catalogue.csv wa-photos     (JPG photos named as in the CSV)
// Description: the dish's own menu-page text when it has one; otherwise only facts (category, veg or not, lunch/dinner, place). Nothing invented.
// WhatsApp needs a photo for every item: rows with an empty image_file_name are listed at the end as "needs a photo".
import { ITEMS, CATS } from "../functions/_lib/menu-data.js";
import { loadMenuPage } from "./cms-lib.mjs";

const D = loadMenuPage();
const q = v => '"' + String(v == null ? "" : v).replace(/"/g, '""') + '"';
const slug = s => String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const pick = v => (v && typeof v === "object" ? (v.l !== undefined ? v.l : v.d) : v || "");
const VEG = { v: "Veg", n: "Non-veg", e: "Egg" };
const MEAL = { l: "Lunch only", d: "Dinner only", ld: "Lunch and dinner", dl: "Lunch and dinner" };

function describe(it, page, opt) {
  const own = page && pick(page.s);
  const facts = [CATS[it.cat] || it.cat, VEG[it.veg] || "", MEAL[it.meal] || ""].filter(Boolean).join(" · ");
  const base = own ? own.replace(/\s+/g, " ").trim().replace(/\.?$/, ".") + " " + facts + "." : facts + ". Swagramam, Labbipet, Vijayawada.";
  return (opt ? opt + " portion. " : "") + base;
}

const order = Object.keys(CATS || {});
const rows = ITEMS.filter(i => i.available).sort((a, b) => (order.indexOf(a.cat) - order.indexOf(b.cat)) || a.name.localeCompare(b.name));
console.log(["category", "name", "short_description", "price_inr", "veg", "served", "image_file_name", "source_photo", "sku"].join(","));
const noPhoto = [];
for (const it of rows) {
  const [idx, oi] = String(it.k || "").split("|");
  const page = D.items[+idx];
  const opt = page && page.o && oi !== "" && page.o[+oi] ? page.o[+oi][0] : "";
  const photo = page && page.i ? `assets/dishes/${page.i}.webp` : "";
  if (!photo) noPhoto.push(it.name);
  console.log([CATS[it.cat] || it.cat, it.name, describe(it, page, opt), (it.priceMinor / 100).toFixed(2), VEG[it.veg] || "", MEAL[it.meal] || "",
    photo ? "swagramam-" + slug(it.name) + "-vijayawada.jpg" : "", photo, it.sku].map(q).join(","));
}
console.error(`items: ${rows.length}; with a photo: ${rows.length - noPhoto.length}; needs a photo before WhatsApp accepts it: ${noPhoto.length}`);
