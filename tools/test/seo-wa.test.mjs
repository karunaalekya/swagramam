// node --no-warnings --test tools/test/seo-wa.test.mjs
import test from "node:test"; import assert from "node:assert/strict";
process.env.SITE_URL = "https://example.test";
const { patch, jsonld } = await import("../apply-seo.mjs");
const { link, PLACEMENTS } = await import("../wa-links.mjs");
const page = '<html><head><title>Swagramam Menu</title><meta name="description" content="Our menu"></head><body></body></html>';
test("patch adds og + canonical, is idempotent", () => {
  const a = patch(page, "menu.html"), b = patch(a, "menu.html");
  assert.equal(a, b); assert.match(a, /og:title" content="Swagramam Menu"/); assert.match(a, /canonical" href="https:\/\/example.test\/menu.html"/); assert.doesNotMatch(a, /ld\+json/);
});
test("existing og tags are not duplicated; home gets JSON-LD", () => {
  const withOg = page.replace("</head>", '<meta property="og:title" content="X"></head>'), a = patch(withOg, "");
  assert.equal((a.match(/og:title/g) || []).length, 1); assert.match(a, /ld\+json/);
});
test("JSON-LD facts", () => {
  const j = jsonld(); assert.equal(j.address.postalCode, "520010"); assert.equal(j.telephone, "+917659858999");
  const mon = j.openingHoursSpecification.filter(h => h.dayOfWeek.includes("Monday")); assert.equal(mon[0].closes, "16:00"); assert.equal(mon[1].closes, "23:30");
  assert.doesNotMatch(JSON.stringify(j), /aggregateRating|review/i);
});
test("wa links encode and use the right number", () => { for (const t of Object.values(PLACEMENTS)) { const l = link(t); assert.ok(l.startsWith("https://wa.me/917659858999?text=")); assert.equal(decodeURIComponent(l.split("text=")[1]), t); } });
