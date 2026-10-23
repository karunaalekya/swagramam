// Run: node --test tools/test/cms-settings.test.mjs
import test from "node:test"; import assert from "node:assert/strict";
import { BASELINE, validateSettings, applySettings, applySettingsToFiles, settingsFiles } from "../cms-settings.mjs";
import { read, baselineModel, toSanityDocs } from "../cms-lib.mjs";
import { buildFiles } from "../cms-build.mjs";

const NEW = { ...BASELINE, phone: "9000011111", phone2: "9000022222", email: "hello@example.in", street: "Plot 5, MG Road", areaShort: "MG Road", city: "Guntur", postal: "522001",
  mapsQuery: "Example Place, MG Road, Guntur 522001", latitude: 16.3, longitude: 80.45, lunchOpen: "11:30", lunchClose: "15:00", mondayLunchClose: "14:30", dinnerOpen: "18:30", dinnerClose: "22:00" };
const all = () => Object.fromEntries(settingsFiles().map(p => [p, read(p)]));

test("today's values change nothing, byte for byte, in every file", () => {
  assert.deepEqual(validateSettings(BASELINE), []);
  for (const [p, t] of Object.entries(all())) assert.equal(applySettings(t, BASELINE), t, p);
  assert.deepEqual(applySettingsToFiles({}, BASELINE), {});
});
test("every file we touch is found (pages, fx, order, checkout, server slots)", () => {
  const f = settingsFiles(); for (const p of ["index.html", "menu.html", "catering.html", "fx.js", "order.js", "checkout.js", "functions/_lib/slots.js"]) assert.ok(f.includes(p), p);
});
test("new values replace every old one", () => {
  const out = applySettingsToFiles({}, NEW), left = [];
  for (const p of settingsFiles()) { const t = out[p] ?? read(p);
    for (const old of ["7659858999", "76598 58999", "9849982052", "98499 82052", "orders@swagramam.in", "Sidhartha", "Mogalrajapuram", "16.50556", "80.64444", "ftid=", "Mon till 4 pm", "Mon till 4:00 pm", "12–4:30", "12&ndash;4:30", "11:30 pm", "12 &ndash; 4:30"]) if (t.includes(old)) left.push(p + " still has " + old);
    if (/(?<!Andhra Pradesh )520010/.test(t)) left.push(p + " still has the old PIN"); }   // the FSSAI registered address (legal, separate) is left alone on purpose
  assert.deepEqual(left, []);
  assert.match(out["index.html"], /"telephone":"\+919000011111"/);
  assert.match(out["index.html"], /"streetAddress":"Plot 5, MG Road"/);
  assert.match(out["index.html"], /"latitude":16\.3,/);
  assert.ok(out["index.html"].includes('"opens":"11:30","closes":"14:30"') && out["index.html"].includes('"opens":"11:30","closes":"15:00"') && out["index.html"].includes('"opens":"18:30","closes":"22:00"'));
  assert.ok(out["index.html"].includes("Lunch 11:30 am&ndash;3 pm") || out["index.html"].includes("Lunch 11:30 am–3 pm"));
  assert.ok(out["index.html"].includes("Mon till 2:30 pm"));
});
test("browser and server use the same opening minutes", () => {
  const out = applySettingsToFiles({}, NEW), get = t => t.match(/\d+,(?:d|dow)===1\?\d+:\d+\],\[\d+,\d+/g);
  assert.equal(out["fx.js"].includes("[690,d===1?870:900],[1110,1320]"), true);
  assert.equal(out["order.js"].includes("[690,dow===1?870:900],[1110,1320]"), true);
  assert.equal(out["functions/_lib/slots.js"].includes('[["l", 690, dow === 1 ? 870 : 900], ["d", 1110, 1320]]'), true);
});
test("map link: new search text, old place id removed", () => {
  const out = applySettingsToFiles({}, NEW);
  assert.ok(out["about.html"].includes("maps?q=Example,+Place,+MG+Road,+Guntur+522001") || out["about.html"].includes("maps?q=Example+Place,+MG+Road,+Guntur+522001"));
  assert.ok(!/ftid=/.test(out["about.html"]) && !/ftid=/.test(out["index.html"]));
});
test("bad settings are refused with a clear reason", () => {
  const bad = o => validateSettings({ ...BASELINE, ...o }).join(" | ");
  assert.match(bad({ phone: "12345" }), /phone/); assert.match(bad({ email: "x" }), /email/);
  assert.match(bad({ street: 'a"b' }), /street/); assert.match(bad({ lunchClose: "25:00" }), /lunchClose/);
  assert.match(bad({ lunchClose: "11:00" }), /lunch must close/); assert.match(bad({ dinnerOpen: "16:00" }), /dinner must open/);
  assert.match(bad({ street: "New Road, X" }), /latitude/); assert.match(bad({ city: "" }), /city is empty/);
});
test("build: no settings document = unchanged; with one = written; bad one = build stops", () => {
  const d = toSanityDocs(baselineModel()).map(x => ({ ...x, _createdAt: "2026-01-01T00:00:00Z" }));
  const raw = { categories: d.filter(x => x._type === "category"), dishes: d.filter(x => x._type === "dish") };
  assert.deepEqual(Object.keys(buildFiles({ ...raw, settings: null }).files).sort(), ["functions/_lib/menu-data.js", "menu.html", "order-data.js", "tools/cms-ids.lock.json"]);
  assert.deepEqual(Object.keys(buildFiles({ ...raw, settings: BASELINE }).files).sort(), ["functions/_lib/menu-data.js", "menu.html", "order-data.js", "tools/cms-ids.lock.json"]);
  const f = buildFiles({ ...raw, settings: NEW }).files; assert.ok(f["index.html"].includes("9000011111") && f["menu.html"].includes("9000011111") && f["menu.html"].includes("86") === true);
  assert.throws(() => buildFiles({ ...raw, settings: { ...NEW, phone: "1" } }), /nothing was written/);
});
