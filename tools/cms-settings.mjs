// Step 1b: contact, address, map and hours from Sanity into the site files.
// Idea: the site today holds the real values. We list every place they are written, and swap them in one pass.
// With today's values the output equals the input byte for byte (tested).
import fs from "node:fs";
import { ROOT, read } from "./cms-lib.mjs";

export const BASELINE = {
  phone: "7659858999", phone2: "9849982052", email: "orders@swagramam.in",
  street: "Mogalrajapuram, Sidhartha Nagar, Labbipet", areaShort: "Mogalrajapuram, Labbipet", city: "Vijayawada", postal: "520010",
  mapsQuery: "Swagramam, Mogalrajapuram, Sidhartha Nagar, Labbipet, Vijayawada, Andhra Pradesh 520010", latitude: 16.50556, longitude: 80.64444,
  lunchOpen: "12:00", lunchClose: "16:30", mondayLunchClose: "16:00", dinnerOpen: "19:00", dinnerClose: "23:30",
};
export const SETTINGS_FIELDS = Object.keys(BASELINE);
export const SETTINGS_PROJECTION = "{" + SETTINGS_FIELDS.join(",") + "}";
export const SETTINGS_QUERY = `*[_type=="siteSettings" && _id=="siteSettings"][0]${SETTINGS_PROJECTION}`;

const PLAIN = /^[^<>"&\\]+$/, TIME = /^([01]\d|2[0-3]):[0-5]\d$/, PHONE = /^[6-9]\d{9}$/;
const mins = t => { const [h, m] = t.split(":").map(Number); return h * 60 + m; };

export function validateSettings(s) {
  const bad = [], need = k => { if (s[k] === undefined || s[k] === null || s[k] === "") { bad.push(`${k} is empty`); return false; } return true; };
  for (const k of SETTINGS_FIELDS) need(k);
  if (bad.length) return bad;
  for (const k of ["phone", "phone2"]) if (!PHONE.test(s[k])) bad.push(`${k} must be 10 digits starting 6 to 9`);
  if (!/^[^\s@<>"&\\]+@[^\s@<>"&\\]+\.[A-Za-z]{2,}$/.test(s.email)) bad.push("email is not valid");
  for (const k of ["street", "areaShort", "city"]) if (!PLAIN.test(s[k]) || s[k].length > 80) bad.push(`${k} has a forbidden character or is too long`);
  if (!/^\d{6}$/.test(s.postal)) bad.push("postal must be 6 digits");
  if (!/^[A-Za-z0-9 ,.\-()#\/]+$/.test(s.mapsQuery)) bad.push("mapsQuery may only use letters, numbers, comma, space");
  if (!(Math.abs(s.latitude) <= 90) || !(Math.abs(s.longitude) <= 180)) bad.push("latitude or longitude out of range");
  for (const k of ["lunchOpen", "lunchClose", "mondayLunchClose", "dinnerOpen", "dinnerClose"]) if (!TIME.test(s[k])) bad.push(`${k} must be HH:MM`);
  if (bad.length) return bad;
  if (!(mins(s.lunchOpen) < mins(s.lunchClose) && mins(s.lunchOpen) < mins(s.mondayLunchClose))) bad.push("lunch must close after it opens");
  if (!(mins(s.dinnerOpen) < mins(s.dinnerClose))) bad.push("dinner must close after it opens");
  if (!(mins(s.lunchClose) < mins(s.dinnerOpen) && mins(s.mondayLunchClose) < mins(s.dinnerOpen))) bad.push("dinner must open after lunch closes");
  const addr = ["street", "city", "postal", "mapsQuery"].some(k => s[k] !== BASELINE[k]);
  if (addr && s.latitude === BASELINE.latitude && s.longitude === BASELINE.longitude) bad.push("address changed: also change latitude and longitude (Google data would point to the old place)");
  return bad;
}

// "12:00" -> {n:"12", nm:"12:00", ap:"pm"}; n drops :00 for the short style
const tf = t => { const [h, m] = t.split(":").map(Number), h12 = h % 12 || 12, mm = String(m).padStart(2, "0"); return { n: m ? `${h12}:${mm}` : String(h12), nm: `${h12}:${mm}`, ap: h < 12 ? "am" : "pm" }; };
const rng = (a, b, sep, long) => { const x = tf(a), y = tf(b), xs = long ? x.nm : x.n, ys = long ? y.nm : y.n; return x.ap === y.ap ? `${xs}${sep}${ys} ${y.ap}` : `${xs} ${x.ap}${sep}${ys} ${y.ap}`; };
const one = (t, long) => { const x = tf(t); return `${long ? x.nm : x.n} ${x.ap}`; };
const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const q = s => s.trim().replace(/ +/g, "+");

export function swapTable(s) {
  const B = BASELINE, spl = p => p.slice(0, 5) + " " + p.slice(5), full = x => `${x.street}, ${x.city} ${x.postal}`;
  const jl = (a, b) => `"opens":"${a}","closes":"${b}"`;
  return [
    [`Swagramam, ${B.street}, ${B.city} ${B.postal}`, `Swagramam, ${full(s)}`],
    [`${B.street}, ${B.city} ${B.postal}`, full(s)],
    [`Mogalrajapuram, Sidhartha Nagar, ${B.city} ${B.postal}`, s.street === B.street ? `Mogalrajapuram, Sidhartha Nagar, ${s.city} ${s.postal}` : full(s)],
    [B.street, s.street], [B.areaShort, s.areaShort], [`${B.city} ${B.postal}`, `${s.city} ${s.postal}`],
    [q(B.mapsQuery), q(s.mapsQuery)],
    [`"postalCode":"${B.postal}"`, `"postalCode":"${s.postal}"`], [`"addressLocality":"${B.city}"`, `"addressLocality":"${s.city}"`],
    [`"latitude":${B.latitude}`, `"latitude":${s.latitude}`], [`"longitude":${B.longitude}`, `"longitude":${s.longitude}`],
    [B.phone, s.phone], [spl(B.phone), spl(s.phone)], [B.phone2, s.phone2], [spl(B.phone2), spl(s.phone2)], [B.email, s.email],
    [jl(B.lunchOpen, B.mondayLunchClose), jl(s.lunchOpen, s.mondayLunchClose)], [jl(B.lunchOpen, B.lunchClose), jl(s.lunchOpen, s.lunchClose)], [jl(B.dinnerOpen, B.dinnerClose), jl(s.dinnerOpen, s.dinnerClose)],
    ["12–4:30 pm", rng(s.lunchOpen, s.lunchClose, "–")], ["12&ndash;4:30 pm", rng(s.lunchOpen, s.lunchClose, "&ndash;")], ["12:00 to 4:30 pm", rng(s.lunchOpen, s.lunchClose, " to ", true)],
    ["12 &ndash; 4:30 pm", rng(s.lunchOpen, s.lunchClose, " &ndash; ")], ["7 &ndash; 11:30 pm", rng(s.dinnerOpen, s.dinnerClose, " &ndash; ")],
    ["7–11:30 pm", rng(s.dinnerOpen, s.dinnerClose, "–")], ["7&ndash;11:30 pm", rng(s.dinnerOpen, s.dinnerClose, "&ndash;")], ["7:00 to 11:30 pm", rng(s.dinnerOpen, s.dinnerClose, " to ", true)],
    ["Mon till 4 pm", "Mon till " + one(s.mondayLunchClose)], ["Mon till 4:00 pm", "Mon till " + one(s.mondayLunchClose, true)],
  ].filter(([a, b]) => a !== b);
}

export function applySettings(text, s) {
  const tbl = swapTable(s), map = new Map(tbl);
  if (tbl.length) { const re = new RegExp(tbl.map(([a]) => esc(a)).sort((x, y) => y.length - x.length).join("|"), "g"); text = text.replace(re, m => map.get(m)); }
  const [lo, lc, mc, dopen, dc] = [s.lunchOpen, s.lunchClose, s.mondayLunchClose, s.dinnerOpen, s.dinnerClose].map(mins);
  text = text.replace(/\[\d+,(d|dow)===1\?\d+:\d+\],\[\d+,\d+\]/g, (_, v) => `[${lo},${v}===1?${mc}:${lc}],[${dopen},${dc}]`);          // fx.js, order.js
  text = text.replace(/\[\["l", \d+, dow === 1 \? \d+ : \d+\], \["d", \d+, \d+\]\]/g, `[["l", ${lo}, dow === 1 ? ${mc} : ${lc}], ["d", ${dopen}, ${dc}]]`); // functions/_lib/slots.js
  if (s.mapsQuery !== BASELINE.mapsQuery) text = text.replace(/(&amp;|&)ftid=[^"'\s&)<]*/g, "");   // old place id would point to the old place
  return text;
}

export function settingsFiles() {
  const root = fs.readdirSync(ROOT).filter(f => f.endsWith(".html"));
  return [...root, "fx.js", "order.js", "checkout.js", "functions/_lib/slots.js", "functions/_lib/payu.js"].filter(p => fs.existsSync(new URL(p, ROOT)));
}

// files: map of already generated files (menu.html). Adds every other file that changes.
export function applySettingsToFiles(files, s) {
  for (const p of settingsFiles()) { const cur = files[p] ?? read(p), out = applySettings(cur, s); if (p in files || out !== cur) files[p] = out; }
  return files;
}
