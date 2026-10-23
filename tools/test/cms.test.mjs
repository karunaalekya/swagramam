// Run: node --test tools/test/cms.test.mjs
import test from "node:test"; import assert from "node:assert/strict"; import fs from "node:fs";
import { baselineModel, toSanityDocs, read, genOrderData, genServerMenu, applyMenuPage } from "../cms-lib.mjs";
import { buildFiles } from "../cms-build.mjs";

const rawFromBaseline = () => { const d = toSanityDocs(baselineModel()).map(x => ({ ...x, _createdAt: "2026-01-01T00:00:00Z" }));
  return { categories: d.filter(x => x._type === "category"), dishes: d.filter(x => x._type === "dish") }; };
const body = t => t.split("\n").slice(1).join("\n");

test("unchanged Sanity data rebuilds the current site exactly (86 dishes)", () => {
  const { model, files } = buildFiles(rawFromBaseline());
  assert.equal(model.dishes.length, 86);
  assert.equal(files["order-data.js"], read("order-data.js"));
  assert.equal(files["menu.html"], read("menu.html"));
  assert.equal(body(files["functions/_lib/menu-data.js"]), body(read("functions/_lib/menu-data.js")));
});
test("menu page, order popup and server list agree on every price", () => {
  const { model } = buildFiles(rawFromBaseline());
  const srv = genServerMenu(model).split("export const ITEMS = ")[1]; const items = JSON.parse(srv.replace(/;\s*$/, ""));
  const total = model.dishes.reduce((n, d) => n + (d.options ? d.options.length : 1), 0); assert.equal(items.length, total);
  for (const d of model.dishes) (d.options || [{ price: d.price, key: "" }]).forEach(o => {
    const it = items.find(i => i.sku === d.id + (d.options ? "-" + o.key : "")); assert.equal(it.priceMinor, o.price * 100); });
});
test("price change flows to all three outputs", () => {
  const raw = rawFromBaseline(); raw.dishes.find(d => d.name === "Dal Makhani").price = 349;
  const { files } = buildFiles(raw);
  assert.match(files["order-data.js"], /"Dal Makhani","c":"mn","t":"v","m":"ld","p":349/);
  assert.match(files["functions/_lib/menu-data.js"], /"sku":"dal-makhani"[^}]*"priceMinor":34900/);
  assert.match(files["menu.html"], /Dal Makhani - ₹349/);
});
test("renaming a dish keeps its code and number (cart, orders, Reelo stay valid)", () => {
  const raw = rawFromBaseline(); raw.dishes.find(d => d.name === "Dal Makhani").name = "Dal Makhani Special";
  const { files } = buildFiles(raw);
  assert.match(files["functions/_lib/menu-data.js"], /"sku":"dal-makhani","k":"33\|","name":"Dal Makhani Special"/);
});
test("changing a dish code stops the build", () => {
  const raw = rawFromBaseline(); raw.dishes.find(d => d.name === "Dal Makhani").dishId = "dal-makhani-new";
  assert.throws(() => buildFiles(raw), /code changed/i);
});
test("reordering does not change item numbers; a new dish gets the next free number", () => {
  const raw = rawFromBaseline(); raw.dishes.find(d => d.name === "Dal Makhani").order = 1;
  raw.dishes.push({ _id: "drafts-free-x", _createdAt: "2026-10-23T00:00:00Z", dishId: "new-dish", name: "New Dish", category: { _ref: "cat.ds" }, diet: "v", meal: "ld", price: 120, order: 5000 });
  const { files } = buildFiles(raw);
  assert.match(files["functions/_lib/menu-data.js"], /"sku":"dal-makhani","k":"33\|"/);
  assert.match(files["functions/_lib/menu-data.js"], /"sku":"new-dish","k":"86\|"/);
});
test("hidden dish disappears everywhere; sold out stays but is not available", () => {
  const raw = rawFromBaseline(); raw.dishes.find(d => d.name === "Goli Soda").hidden = true; raw.dishes.find(d => d.name === "Butter Milk").soldOut = true;
  const { files } = buildFiles(raw);
  assert.doesNotMatch(files["order-data.js"], /Goli Soda/); assert.doesNotMatch(files["menu.html"], /Goli Soda/);
  assert.match(files["functions/_lib/menu-data.js"], /"sku":"butter-milk"[^}]*"available":false/);
});
test("bad content is refused, nothing is generated", () => {
  const bad = fn => { const r = rawFromBaseline(); fn(r); assert.throws(() => buildFiles(r)); };
  bad(r => (r.dishes[0].price = 0));                                   // price above 0
  bad(r => (r.dishes[0].price = 99.5));                                // whole rupees
  bad(r => (r.dishes[1].name = "  "));                                 // empty name
  bad(r => (r.dishes[2].category = { _ref: "cat.zz" }));               // unknown category
  bad(r => (r.dishes[3].meal = undefined));                            // missing field
  bad(r => (r.dishes.find(d => d.options).options.length = 1));        // one size option
  bad(r => r.categories.forEach(c => (c.showDinner = false)));         // no dinner category
  bad(r => (r.dishes = []));                                           // empty Sanity
  assert.throws(() => buildFiles({}), /missing/);                      // Sanity returned nothing usable
});
test("a category with no dish for that meal cannot be shown", () => {
  const r = rawFromBaseline(); r.categories.find(c => c.code === "bh").showDinner = true; r.categories.find(c => c.code === "bh").orderDinner = 9;
  assert.throws(() => buildFiles(r), /no dish for it/);
});
