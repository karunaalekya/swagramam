// Writes tools/sitegate/menu.json (the shape sitegate's menu checks expect) from the server price list.
// Run from the repo root: node tools/sitegate/make-menu.mjs   (menu.json is generated, not committed)
import fs from "node:fs";
import { CATS, ITEMS } from "../../functions/_lib/menu-data.js";
const by = {};
for (const i of ITEMS) (by[i.cat] ??= []).push({ name: i.name, price: i.priceMinor / 100 });
const out = { food: Object.entries(by).map(([c, items]) => ({ title: CATS[c] || c, items })), drinks: [] };
fs.writeFileSync(new URL("./menu.json", import.meta.url), JSON.stringify(out, null, 1));
console.log(`menu.json: ${ITEMS.length} items in ${out.food.length} sections`);
