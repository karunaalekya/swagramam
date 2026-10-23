// Build step: Sanity -> site files. Nothing is written unless every check passes.
//   node tools/cms-build.mjs                 fetch from Sanity (needs SANITY_PROJECT_ID, SANITY_DATASET, optional SANITY_READ_TOKEN)
//   node tools/cms-build.mjs --from=raw.json use a saved copy instead (tests, offline)
//   node tools/cms-build.mjs --check         build in memory, report what would change, write nothing
// Step 2 also writes the "What's new" cards in index.html when announcement documents exist.
// Writes: order-data.js, functions/_lib/menu-data.js, the menu block of menu.html, and (if the Sanity settings document exists) phones, email, address, map, hours in every page, fx.js, order.js, checkout.js, slots.js.
import fs from "node:fs";
import { applySettingsToFiles, validateSettings, SETTINGS_QUERY } from "./cms-settings.mjs";
import { NEWS_QUERY, validateNews, applyNews } from "./cms-news.mjs";
import { ROOT, read, applyIdLock, modelFromSanity, validate, genOrderData, genServerMenu, applyMenuPage } from "./cms-lib.mjs";

export const QUERY = `{
  "categories": *[_type=="category"]{_id,code,nameEn,nameTe,icon,order,showLunch,showDinner,orderLunch,orderDinner},
  "dishes": *[_type=="dish"]{_id,_createdAt,dishId,num,name,dinnerName,subtitle,subtitleDinner,category,diet,meal,price,options,photoKey,tag,soldOut,hidden,order},
  "settings": ${SETTINGS_QUERY},
  "news": ${NEWS_QUERY}
}`;

export async function fetchRaw(env = process.env) {
  const { SANITY_PROJECT_ID: p, SANITY_DATASET: ds = "production", SANITY_READ_TOKEN: t } = env;
  if (!p) throw new Error("SANITY_PROJECT_ID is not set");
  const url = `https://${p}.api.sanity.io/v2024-01-01/data/query/${ds}?perspective=published&query=${encodeURIComponent(QUERY)}`;
  const r = await fetch(url, { headers: t ? { Authorization: "Bearer " + t } : {} });
  if (!r.ok) throw new Error("Sanity answered " + r.status + " " + (await r.text()).slice(0, 200));
  const j = await r.json(); if (!j.result) throw new Error("Sanity returned no result"); return j.result;
}

export function buildFiles(raw) {
  if (!raw || !raw.categories || !raw.dishes) throw new Error("Sanity data is missing categories or dishes");
  if (!raw.categories.length || !raw.dishes.length) throw new Error("Sanity has no categories or no dishes (empty dataset)");
  const lock = JSON.parse(read("tools/cms-ids.lock.json"));
  const nextLock = applyIdLock(raw, lock);          // fixes dish numbers, refuses changed dish ids
  const model = modelFromSanity(raw); const bad = validate(model);
  if (bad.length) throw new Error("Invalid content, nothing was written:\n- " + bad.join("\n- "));
  const files = {
    "tools/cms-ids.lock.json": JSON.stringify(nextLock, null, 1) + "\n",
    "order-data.js": genOrderData(model),
    "functions/_lib/menu-data.js": genServerMenu(model),
    "menu.html": applyMenuPage(read("menu.html"), model) };
  // Step 1b: contact, address, hours. No settings document yet (null) = site keeps its hand-written values.
  if (raw.settings) { const sb = validateSettings(raw.settings); if (sb.length) throw new Error("Invalid contact/address/hours, nothing was written:\n- " + sb.join("\n- ")); applySettingsToFiles(files, raw.settings); }
  // Step 2: announcements. No announcement documents yet (empty or missing) = the hand-written home page block stays.
  if (Array.isArray(raw.news) && raw.news.length) { const nb = validateNews(raw.news); if (nb.length) throw new Error("Invalid announcements, nothing was written:\n- " + nb.join("\n- ")); files["index.html"] = applyNews(files["index.html"] ?? read("index.html"), raw.news); }
  return { model, files };
}

if (import.meta.url === new URL(process.argv[1], "file:").href) {
  const arg = n => (process.argv.find(a => a.startsWith("--" + n + "=")) || "").split("=")[1];
  try {
    const raw = arg("from") ? JSON.parse(fs.readFileSync(arg("from"), "utf8")) : await fetchRaw();
    const { model, files } = buildFiles(raw); let changed = 0;
    for (const [p, text] of Object.entries(files)) {
      const same = read(p) === text; if (!same) changed++;
      console.log((same ? "same     " : "CHANGED  ") + p);
      if (!same && !process.argv.includes("--check")) fs.writeFileSync(new URL(p, ROOT), text);
    }
    console.log(`dishes: ${model.dishes.length}, categories: ${model.cats.length}, files changed: ${changed}`);
  } catch (e) { console.error("BUILD STOPPED. Live site keeps its old content.\n" + e.message); process.exit(1); }
}
