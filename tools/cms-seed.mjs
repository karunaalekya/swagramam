// One-time: turns today's menu (order-data.js + menu.html + menu-data.js) into Sanity documents.
// Run: node tools/cms-seed.mjs   -> writes cms/seed/seed.ndjson
// Import: cd cms && npx sanity dataset import seed/seed.ndjson production --replace
import fs from "node:fs";
import { baselineModel, toSanityDocs, validate } from "./cms-lib.mjs";
import { BASELINE } from "./cms-settings.mjs";
import { baselineNews } from "./cms-news.mjs";
const model = baselineModel(); const bad = validate(model);
if (bad.length) { console.error("Current menu fails its own checks:\n- " + bad.join("\n- ")); process.exit(1); }
const docs = toSanityDocs(model);
docs.push({ _id: "siteSettings", _type: "siteSettings", ...BASELINE });                                   // step 1b
baselineNews().forEach((n, i) => docs.push({ _id: "announcement." + (i + 1), _type: "announcement", ...n })); // step 2
fs.mkdirSync(new URL("../cms/seed/", import.meta.url), { recursive: true });
fs.writeFileSync(new URL("../cms/seed/seed.ndjson", import.meta.url), docs.map(d => JSON.stringify(d)).join("\n") + "\n");
const lock = {}; model.dishes.forEach(d => (lock["dish." + d.num] = { num: d.num, id: d.id }));
fs.writeFileSync(new URL("./cms-ids.lock.json", import.meta.url), JSON.stringify(lock, null, 1) + "\n");
console.log("categories:", model.cats.length, "dishes:", model.dishes.length, "documents:", docs.length);
