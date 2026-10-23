// Step 2: "What's new at Swagramam" announcements from Sanity into the home page (index.html, <ul id="nwg">).
// Same rule as 1a/1b: with today's content the output equals the current file byte for byte (tested).
// No announcement documents in Sanity yet = the hand-written block stays untouched.
import { read } from "./cms-lib.mjs";

export const ICONS = {
  gift: "M3 11h18v10H3zM2 7h20v4H2zM12 7v14M12 7S10 2 7.5 3.5 8 7 12 7zm0 0s2-5 4.5-3.5S16 7 12 7z",
  cutlery: "M6 3v7a2 2 0 0 0 4 0V3M8 3v18M17 3c-2 2-3 5-3 8h3v10",
  calendar: "M4 6h16v14H4zM4 10h16M8 3v4M16 3v4",
};
export const NEWS_QUERY = `*[_type=="announcement" && hidden!=true]|order(order asc){_id,icon,tag,title,text,linkLabel,linkUrl,expire,order}`;
const OPEN = '<ul class="nwg" id="nwg">\n', MARK = "<!-- EDIT ME: newest first, keep 3-4. Optional data-expire=\"YYYY-MM-DD\" on an li hides it after that date. -->\n", CLOSE = '</ul><div class="nwd" id="nwd"';
const esc = s => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const tagOut = s => esc(s).replace(/ · /g, " &middot; ");           // "New · Oct 2026" -> New &middot; Oct 2026
const tagIn = s => s.replace(/ &middot; /g, " · ");
const un = s => s.replace(/&quot;/g, '"').replace(/&gt;/g, ">").replace(/&lt;/g, "<").replace(/&amp;/g, "&");
const iconKey = d => Object.keys(ICONS).find(k => ICONS[k] === d);

export function genNews(items) {
  return items.map(n => `<li class="nwc rv"${n.expire ? ` data-expire="${n.expire}"` : ""}><span class="nwi" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="${ICONS[n.icon]}"/></svg></span><div class="nwb"><span class="nwt">${tagOut(n.tag)}</span><h3>${esc(n.title)}</h3><p>${esc(n.text)}</p></div>${n.linkUrl ? `<a href="${n.linkUrl}">${esc(n.linkLabel)} &rarr;</a>` : ""}</li>\n`).join("");
}
function block(html) {
  const a = html.indexOf(OPEN), b = html.indexOf(CLOSE);
  if (a < 0 || b < a) throw new Error("announcements block not found in index.html");
  const s = html.indexOf(MARK, a); if (s < 0 || s > b) throw new Error("announcements EDIT ME marker not found");
  return { start: s + MARK.length, end: b };
}
export function baselineNews(html = read("index.html")) {
  const { start, end } = block(html), out = [];
  for (const m of html.slice(start, end).matchAll(/<li class="nwc rv"(?: data-expire="([\d-]+)")?><span class="nwi" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="([^"]+)"\/><\/svg><\/span><div class="nwb"><span class="nwt">(.*?)<\/span><h3>(.*?)<\/h3><p>(.*?)<\/p><\/div>(?:<a href="([^"]+)">(.*?) &rarr;<\/a>)?<\/li>\n/g))
    out.push({ icon: iconKey(m[2]), tag: tagIn(un(m[3])), title: un(m[4]), text: un(m[5]), linkUrl: m[6], linkLabel: m[7] && un(m[7]), expire: m[1] });
  return out.map((n, i) => { Object.keys(n).forEach(k => n[k] === undefined && delete n[k]); return { ...n, order: (i + 1) * 10 }; });
}
export function validateNews(items) {
  const bad = [], E = m => bad.push(m);
  if (!Array.isArray(items)) return ["announcements are not a list"];
  if (items.length > 6) E("at most 6 announcements (the row is a swipe strip: keep 3 to 4)");
  items.forEach((n, i) => { const w = `announcement ${i + 1} (${n.title || "no title"})`;
    if (!ICONS[n.icon]) E(w + ": pick an icon");
    for (const [k, max] of [["tag", 30], ["title", 60], ["text", 160]]) if (!n[k] || !String(n[k]).trim()) E(`${w}: ${k} is empty`); else if (n[k].length > max) E(`${w}: ${k} is longer than ${max} characters`);
    if (n.linkUrl) { if (!/^(https:\/\/[^\s"<>]+|[a-z0-9\-/.]*\.html(#[a-z0-9-]+)?|#[a-z0-9-]+)$/.test(n.linkUrl)) E(w + ": link must be a page like menu.html, an #section, or https://..."); if (!n.linkLabel || !n.linkLabel.trim()) E(w + ": link text is empty"); else if (n.linkLabel.length > 24) E(w + ": link text is longer than 24 characters"); }
    else if (n.linkLabel) E(w + ": link text without a link");
    if (n.expire && (!/^\d{4}-\d{2}-\d{2}$/.test(n.expire) || isNaN(Date.parse(n.expire)) || new Date(n.expire).toISOString().slice(0, 10) !== n.expire)) E(w + ": hide-after date must be a real date YYYY-MM-DD"); });
  return bad;
}
export function applyNews(html, items) { const { start, end } = block(html); return html.slice(0, start) + genNews(items) + html.slice(end); }
