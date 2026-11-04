// Writes slide 1's hero text into <div id="hx"> in index.html so the hero has its real height at first paint
// (no layout shift while the slider script waits for site.css). Run after editing ST[0] or the hxHTML template:
//   node tools/sync-hero.mjs          (rewrites index.html)    node tools/sync-hero.mjs --check   (exit 1 if stale)
import fs from 'node:fs';
const f = new URL('../index.html', import.meta.url);
let h = fs.readFileSync(f, 'utf8');
const grab = (start, end) => { const i = h.indexOf(start); if (i < 0) throw new Error('missing ' + start); const j = h.indexOf(end, i); return h.slice(i, j + end.length); };
const line = (start) => { const i = h.indexOf(start); if (i < 0) throw new Error('missing ' + start); return h.slice(i, h.indexOf('\n', i) + 1); };
const pre = h.slice(h.indexOf('const vr=(p,s)=>'), h.indexOf('\n', h.indexOf('const TG=')) + 1);
const ST = line('const ST=[');
const HH = grab('const hh=()=>', '};\n');
const HX = grab('const hxHTML=k=>', '};\n');
const html = new Function('window', `${pre}${ST}${HH}${HX}return hxHTML(0)`)({});
const re = /<div class="hx" id="hx"[^>]*>[\s\S]*?<\/div>(?=<\/div>\n<div class="hbm">)/;
if (!re.test(h)) throw new Error('hx container not found');
const next = h.replace(re, `<div class="hx" id="hx" data-ssr="1">${html}</div>`);
if (process.argv.includes('--check')) { if (next !== h) { console.error('index.html hero text is stale: run node tools/sync-hero.mjs'); process.exit(1); } console.log('hero text in sync'); }
else { fs.writeFileSync(f, next); console.log('hero text written,', html.length, 'bytes'); }
