// Adds Open Graph / Twitter tags and Restaurant JSON-LD to the site pages. Safe to run again (replaces its own block).
//   SITE_URL=https://www.example.com node tools/apply-seo.mjs [--dry] [dir]
// Existing og:* tags are left alone (only the JSON-LD block is added then).
import fs from "node:fs"; import path from "node:path";
const dry = process.argv.includes("--dry"), dir = process.argv.slice(2).find(a => !a.startsWith("--")) || ".";
const site = (process.env.SITE_URL || "").replace(/\/+$/, "");
if (!/^https:\/\/[^/]+$/.test(site)) { console.error("Set SITE_URL to the final domain, e.g. SITE_URL=https://www.example.com (client has not confirmed .com or .in)"); process.exit(1); }
const B = "<!-- seo:v96 -->", E = "<!-- /seo:v96 -->";
const PAGES = { "index.html": "", "about.html": "about.html", "menu.html": "menu.html", "catering.html": "catering.html", "contact.html": "contact.html", "rewards.html": "rewards.html" };
const hours = (days, o1, c1, o2, c2) => [{ "@type": "OpeningHoursSpecification", dayOfWeek: days, opens: o1, closes: c1 }, { "@type": "OpeningHoursSpecification", dayOfWeek: days, opens: o2, closes: c2 }];
export const jsonld = () => ({ "@context": "https://schema.org", "@type": "Restaurant", name: "Swagramam", legalName: "RR FRESH FOODS", url: site + "/", telephone: "+917659858999", email: "orders@swagramam.in",
  servesCuisine: "South Indian", priceRange: undefined, hasMenu: site + "/menu.html", acceptsReservations: true,
  address: { "@type": "PostalAddress", streetAddress: "Mogalrajapuram, Sidhartha Nagar, Labbipet", addressLocality: "Vijayawada", addressRegion: "Andhra Pradesh", postalCode: "520010", addressCountry: "IN" },
  openingHoursSpecification: [...hours(["Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"], "12:00", "16:30", "19:00", "23:30"), ...hours(["Monday"], "12:00", "16:00", "19:00", "23:30")],
  contactPoint: [{ "@type": "ContactPoint", telephone: "+917659858999", contactType: "reservations" }, { "@type": "ContactPoint", telephone: "+919849982052", contactType: "catering" }] });
const esc = s => String(s).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
export function patch(html, page) {
  const url = site + "/" + page, get = re => { const m = html.match(re); return m ? m[1] : ""; };
  const title = get(/<title>([^<]*)<\/title>/i), desc = get(/<meta\s+name=["']description["']\s+content=["']([^"']*)["']/i);
  html = html.replace(new RegExp(B + "[\\s\\S]*?" + E + "\\s*", "g"), "");
  const hasOg = /property=["']og:title["']/i.test(html);
  let b = B + "\n";
  if (!hasOg) b += [["property", "og:type", "restaurant.restaurant"], ["property", "og:site_name", "Swagramam"], ["property", "og:title", title], ["property", "og:description", desc], ["property", "og:url", url], ["property", "og:locale", "en_IN"], ["name", "twitter:card", "summary_large_image"]].filter(x => x[2]).map(([a, k, v]) => `<meta ${a}="${k}" content="${esc(v)}">`).join("\n") + "\n";
  if (!/rel=["']canonical["']/i.test(html)) b += `<link rel="canonical" href="${url}">\n`;
  if (page === "" || page === "index.html" || page === "contact.html") b += `<script type="application/ld+json">${JSON.stringify(jsonld()).replace(/</g, "\\u003c")}</script>\n`;
  b += E + "\n";
  return html.includes("</head>") ? html.replace("</head>", b + "</head>") : html;
}
if (import.meta.url === "file://" + process.argv[1]) for (const [f, page] of Object.entries(PAGES)) {
  const p = path.join(dir, f); if (!fs.existsSync(p)) { console.log("skip (missing)", f); continue; }
  const out = patch(fs.readFileSync(p, "utf8"), page || ""); if (!dry) fs.writeFileSync(p, out); console.log(dry ? "would patch" : "patched", f);
}
