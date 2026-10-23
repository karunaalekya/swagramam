#!/usr/bin/env node
// Go-live preflight. Read-only: only GET requests, sends no SMS, creates no order.
// Usage: node tools/preflight.mjs https://YOUR-DOMAIN [ADMIN_KEY] [--expect=preview|live]
//   preview (default): real providers allowed in test mode.   live: also requires production flags, PayU live, GST confirmed.
const [base, key] = process.argv.slice(2).filter(a => !a.startsWith("--")), expect = (process.argv.find(a => a.startsWith("--expect=")) || "--expect=preview").split("=")[1];
if (!base) { console.log("Usage: node tools/preflight.mjs https://YOUR-DOMAIN [ADMIN_KEY] [--expect=preview|live]"); process.exit(2); }
let bad = 0; const out = (ok, msg, hint) => { console.log((ok ? "PASS " : "FAIL ") + msg + (!ok && hint ? "\n     fix: " + hint : "")); if (!ok) bad++; };
const get = async (p, h) => { try { const r = await fetch(base.replace(/\/$/, "") + p, { headers: h }); let j = null, t = ""; try { t = await r.text(); j = JSON.parse(t); } catch {} return { s: r.status, j, h: r.headers, t }; } catch (e) { return { s: 0, j: null, h: new Headers(), t: String(e) }; } };
const h = await get("/api/health"); out(h.s === 200, "health endpoint reachable", "deploy the Pages project; check the domain");
if (h.j) { out(h.j.live === true, "health says live (DB and KV bound, schema run)", "Phase 0: bindings DB and KV, run db/schema.sql then migrations 002 and 003");
  if (expect === "live") out(!h.j.mock, "no mock providers behind the site", "set PAYMENT_PROVIDER=payu, OTP_PROVIDER=msg91 and ENV=production"); }
const m = await get("/api/menu"); if (m.j) { out(m.j.items && m.j.items.length > 0, "menu served (" + (m.j.items || []).length + " items)"); out(m.j.tip && m.j.tip.defaultPct === 5, "tip defaults present"); if (expect === "live") out(m.j.gstAssumed === false, "GST confirmed by owner", "set GST_CONFIRMED=true"); out(m.j.codMaxMinor === 100000 || m.j.codMaxMinor > 0, "pay at pickup limit " + (m.j.codMaxMinor / 100) + " rupees"); }
const hd = await get("/checkout.html"); out(hd.s === 200, "checkout page served"); for (const k of ["x-content-type-options", "x-frame-options", "referrer-policy"]) out(!!hd.h.get(k), "security header " + k, "add it in the _headers file");
if (key) {
  const s = await get("/api/admin/selfcheck", { "x-admin-key": key }); out(s.s === 200, "selfcheck reachable with ADMIN_KEY", "set ADMIN_KEY secret and pass the same value here");
  if (s.j && s.j.readiness) { const r = s.j.readiness; for (const k of ["infra", "payu", "msg91", "reelo", "offersConfig"]) { const needed = k === "reelo" ? false : (expect === "live" || k === "infra" || k === "offersConfig"); const ok = r[k].ok; if (needed || ok) out(ok, "readiness " + k + (r[k].note ? " (" + r[k].note + ")" : ""), "missing: " + r[k].missing.join(", ")); else console.log("SKIP readiness " + k + " not needed yet, missing: " + r[k].missing.join(", ")); }
    for (const w of s.j.warnings || []) console.log("WARN " + w);
    if (expect === "live") { out(r.goLiveBlockers.filter(x => !/COD_LIVE|LOYALTY_PROVIDER/.test(x)).length === 0, "no go-live blockers", r.goLiveBlockers.join("; ")); } else if (r.goLiveBlockers.length) console.log("INFO still to do before live: " + r.goLiveBlockers.join("; ")); }
} else console.log("SKIP selfcheck (pass ADMIN_KEY as second argument for the full readiness report)");
console.log(bad ? "\nNOT READY: " + bad + " check(s) failed" : "\nREADY for " + expect); process.exit(bad ? 1 : 0);
