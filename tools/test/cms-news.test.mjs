// Run: node --test tools/test/cms-news.test.mjs
import test from "node:test"; import assert from "node:assert/strict";
import { baselineNews, validateNews, applyNews, genNews, ICONS } from "../cms-news.mjs";
import { baselineModel, toSanityDocs, read } from "../cms-lib.mjs";
import { BASELINE } from "../cms-settings.mjs";
import { buildFiles } from "../cms-build.mjs";

const html = read("index.html");
const raw = () => { const d = toSanityDocs(baselineModel()).map(x => ({ ...x, _createdAt: "2026-01-01T00:00:00Z" })); return { categories: d.filter(x => x._type === "category"), dishes: d.filter(x => x._type === "dish") }; };
const ok = o => ({ icon: "gift", tag: "New · Nov 2026", title: "Diwali thali", text: "A festive thali for the week.", linkUrl: "menu.html#menu", linkLabel: "See menu", order: 5, ...o });

test("today's three cards: read back and regenerate the home page byte for byte", () => {
  const b = baselineNews(html); assert.equal(b.length, 3); assert.deepEqual(validateNews(b), []);
  assert.equal(applyNews(html, b), html);
});
test("add, reorder and remove cards", () => {
  const b = baselineNews(html), out = applyNews(html, [ok(), b[2]]);
  assert.equal((out.match(/class="nwc rv"/g) || []).length, 2);
  assert.ok(out.includes("<h3>Diwali thali</h3>") && out.includes('New &middot; Nov 2026') && out.includes('href="menu.html#menu">See menu &rarr;'));
  assert.ok(out.indexOf("Diwali thali") < out.indexOf("Catering for celebrations") && !out.includes("Village Club is open"));
  assert.ok(out.includes('<ul class="nwg" id="nwg">') && out.includes('<div class="nwd" id="nwd"'));   // the script and dots stay
});
test("hide-after date becomes data-expire; no link means no link", () => {
  const out = genNews([ok({ expire: "2026-11-20" }), ok({ linkUrl: undefined, linkLabel: undefined })]);
  assert.ok(out.includes('<li class="nwc rv" data-expire="2026-11-20">')); assert.equal((out.match(/<a href/g) || []).length, 1);
});
test("text is escaped, so an editor cannot break the page", () => {
  const out = genNews([ok({ title: "Tea & snacks", text: "Rs 99 <b>only</b>" })]);
  assert.ok(out.includes("Tea &amp; snacks") && out.includes("&lt;b&gt;") && !out.includes("<b>only"));
});
test("bad content is refused with a plain message", () => {
  const v = o => validateNews([ok(o)]).join("|");
  assert.match(v({ icon: "star" }), /pick an icon/); assert.match(v({ title: "" }), /title is empty/);
  assert.match(v({ title: "x".repeat(61) }), /longer than 60/); assert.match(v({ text: "x".repeat(161) }), /longer than 160/);
  assert.match(v({ linkUrl: "javascript:alert(1)" }), /link must be/); assert.match(v({ linkUrl: "http://insecure.example" }), /link must be/);
  assert.match(v({ linkLabel: "" }), /link text is empty/); assert.match(v({ expire: "2026-02-31" }), /real date/);
  assert.match(validateNews(Array.from({ length: 7 }, () => ok())).join("|"), /at most 6/);
  assert.deepEqual(Object.keys(ICONS), ["gift", "cutlery", "calendar"]);
});
test("build: no announcements in Sanity keeps the hand-written block", () => {
  for (const news of [undefined, []]) assert.ok(!("index.html" in buildFiles({ ...raw(), news }).files));
});
test("build: announcements and contact settings both land in index.html", () => {
  const f = buildFiles({ ...raw(), settings: { ...BASELINE, phone: "9000011111" }, news: [ok()] }).files["index.html"];
  assert.ok(f.includes("<h3>Diwali thali</h3>") && f.includes("9000011111") && !f.includes("7659858999") && !f.includes("Village Club is open"));
});
test("build: one bad announcement stops everything", () => {
  assert.throws(() => buildFiles({ ...raw(), news: [ok({ title: "" })] }), /Invalid announcements, nothing was written/);
});
test("the expiry script still hides a past-date card in the browser", () => {
  const out = applyNews(html, [ok({ expire: "2020-01-01" })]); assert.ok(out.includes("e&&e<now") && out.includes('data-expire="2020-01-01"'));
});
