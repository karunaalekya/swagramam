#!/usr/bin/env python3
"""
mobile_check.py - real phone-sized rendering check (Chromium via Playwright).

  pip install playwright && python -m playwright install chromium     # once

  python mobile_check.py ./site                         # static folder (served locally)
  python mobile_check.py --url https://site.com --crawl 10
  python mobile_check.py ./site --widths 360,390 --no-throttle

Loads every page as a phone (touch, 2x DPR, mobile UA), on slow-4G + 4x CPU throttle by default, and reports:
  sideways scroll, tap targets under 44px, text under 12px, phone inputs under 16px (iOS zoom-on-focus),
  call/WhatsApp button not visible without scrolling, broken images, JS errors, 4xx/5xx requests,
  LCP / CLS / transfer size. Full-page screenshots are saved to ./mobile_shots/ for a quick eyeball.
Exit code 1 on any FAIL.
"""
import argparse, functools, gzip, http.server, io, os, re, sys, threading, urllib.parse
from collections import defaultdict
from pathlib import Path

UA = ("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 "
      "(KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1")

INIT_JS = """
window.__lcp = 0; window.__cls = 0;
try { new PerformanceObserver(l => { for (const e of l.getEntries()) window.__lcp = e.startTime; })
      .observe({type: 'largest-contentful-paint', buffered: true}); } catch (e) {}
try { new PerformanceObserver(l => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__cls += e.value; })
      .observe({type: 'layout-shift', buffered: true}); } catch (e) {}
"""

AUDIT_JS = """
() => {
  const vw = window.innerWidth, vh = window.innerHeight, de = document.documentElement;
  const vis = el => { const r = el.getBoundingClientRect(), s = getComputedStyle(el);
    return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none' && parseFloat(s.opacity) > 0; };
  const sel = el => { let s = el.tagName.toLowerCase();
    if (el.id) s += '#' + el.id;
    else if (typeof el.className === 'string' && el.className.trim()) s += '.' + el.className.trim().split(/\\s+/).slice(0, 2).join('.');
    return s; };
  const clipped = el => { for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
      const ox = getComputedStyle(p).overflowX;
      if (['hidden', 'auto', 'scroll', 'clip'].includes(ox) && p.getBoundingClientRect().right <= vw + 1) return true; }
    return false; };
  const over = [];
  if (de.scrollWidth > vw + 1) {
    document.querySelectorAll('body *').forEach(el => { if (!vis(el) || clipped(el)) return;
      const r = el.getBoundingClientRect(); if (r.right > vw + 1) over.push({s: sel(el), right: Math.round(r.right)}); });
    over.sort((a, b) => b.right - a.right);
  }
  const tap = [];
  document.querySelectorAll('a[href],button,input:not([type=hidden]),select,textarea,summary,[role=button]').forEach(el => {
    if (!vis(el)) return; const r = el.getBoundingClientRect();
    if (r.width >= 44 && r.height >= 44) return;
    const s = getComputedStyle(el);
    if (el.tagName === 'A' && s.display === 'inline' && el.closest('p,li,span')) return;
    tap.push({s: sel(el), w: Math.round(r.width), h: Math.round(r.height),
              t: (el.innerText || el.value || el.getAttribute('aria-label') || '').trim().slice(0, 22)}); });
  const small = [];
  document.querySelectorAll('body *').forEach(el => { if (!vis(el)) return;
    if (![...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim().length > 2)) return;
    const fs = parseFloat(getComputedStyle(el).fontSize);
    if (fs < 12) small.push({s: sel(el), fs: fs, t: el.textContent.trim().slice(0, 22)}); });
  const smallInputs = [...document.querySelectorAll('input:not([type=hidden]):not([type=checkbox]):not([type=radio]):not([type=submit]):not([type=button]),select,textarea')]
    .filter(vis).filter(el => parseFloat(getComputedStyle(el).fontSize) < 16).map(el => sel(el) + ' ' + getComputedStyle(el).fontSize);
  const ctaSel = 'a[href^="tel:"],a[href*="wa.me"],a[href*="whatsapp.com"]';
  const ctaAll = [...document.querySelectorAll(ctaSel)];
  const ctaFold = ctaAll.filter(vis).filter(el => { const r = el.getBoundingClientRect(); return r.top < vh && r.bottom > 0; }).length;
  const broken = [...document.images].filter(i => i.complete && i.naturalWidth === 0 && i.getAttribute('src') && vis(i)).map(i => i.getAttribute('src'));
  const nav = performance.getEntriesByType('navigation')[0];
  return {vw, scrollW: de.scrollWidth, over: over.slice(0, 4), tap: tap, small: small.slice(0, 5), smallCount: small.length,
          smallInputs, ctaAny: ctaAll.length, ctaFold, broken, lcp: window.__lcp, cls: window.__cls,
          load: nav ? Math.round(nav.loadEventEnd) : 0};
}
"""


def serve(folder):
    # Text files are gzipped like a real host (Cloudflare, Netlify...), so page weight is not overstated.
    class Q(http.server.SimpleHTTPRequestHandler):
        def log_message(self, *a, **k): pass
        def send_head(self):
            p = self.translate_path(self.path)
            if os.path.isdir(p): p = os.path.join(p, "index.html")
            if os.path.isfile(p) and p.endswith((".html", ".htm", ".css", ".js", ".mjs", ".svg", ".json")) and "gzip" in self.headers.get("Accept-Encoding", ""):
                body = gzip.compress(open(p, "rb").read(), 6)
                self.send_response(200); self.send_header("Content-Type", self.guess_type(p))
                self.send_header("Content-Encoding", "gzip"); self.send_header("Content-Length", str(len(body))); self.end_headers()
                return io.BytesIO(body)
            return super().send_head()
    srv = http.server.ThreadingHTTPServer(("127.0.0.1", 0), functools.partial(Q, directory=str(folder)))
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    return srv, f"http://127.0.0.1:{srv.server_address[1]}"


def local_pages(folder):
    out = []
    for dp, dn, fn in os.walk(folder):
        dn[:] = [d for d in dn if not d.startswith(".") and d not in ("node_modules", "vendor")]
        for f in fn:
            if f.lower().endswith((".html", ".htm")) and "404" not in f:
                rel = (Path(dp) / f).relative_to(folder).as_posix()
                out.append("/" if rel == "index.html" else "/" + rel)
    return sorted(out)


def crawl(browser, base, limit):
    ctx = browser.new_context(viewport={"width": 390, "height": 844})
    pg = ctx.new_page(); seen, queue, out = set(), ["/"], []
    host = urllib.parse.urlparse(base).netloc.replace("www.", "")
    while queue and len(out) < limit:
        p = queue.pop(0)
        if p in seen: continue
        seen.add(p)
        try:
            r = pg.goto(base + p, wait_until="domcontentloaded", timeout=30000)
        except Exception:
            continue
        if not r or r.status >= 400: continue
        out.append(p)
        for href in pg.eval_on_selector_all("a[href]", "els => els.map(e => e.href)"):
            u = urllib.parse.urlparse(href)
            if u.netloc.replace("www.", "") == host and not re.search(r"\.(pdf|jpe?g|png|webp|gif|svg|zip)$", u.path, re.I):
                queue.append(u.path or "/")
    ctx.close()
    return out


def main():
    ap = argparse.ArgumentParser(description="Real phone-sized rendering check")
    ap.add_argument("folder", nargs="?"); ap.add_argument("--url"); ap.add_argument("--crawl", type=int, default=10)
    ap.add_argument("--widths", default="360,390"); ap.add_argument("--no-throttle", action="store_true")
    ap.add_argument("--shots", default="mobile_shots"); ap.add_argument("--no-shots", action="store_true")
    ap.add_argument("--ignore", action="append", default=[], help="regex: failed requests to ignore (e.g. /api/ when the API is not served)")
    args = ap.parse_args()
    if not args.folder and not args.url: ap.print_help(); return 2
    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        print("Run once:  pip install playwright && python -m playwright install chromium"); return 2

    srv = None
    if args.url: base = args.url.rstrip("/")
    else:
        folder = Path(args.folder).resolve()
        if not folder.is_dir(): print("Folder not found"); return 2
        srv, base = serve(folder)
    findings, rows = [], []
    with sync_playwright() as p:
        browser = p.chromium.launch()
        pages = crawl(browser, base, args.crawl) if args.url else local_pages(Path(args.folder).resolve())
        widths = [int(w) for w in args.widths.split(",")]
        shots = Path(args.shots)
        if not args.no_shots: shots.mkdir(exist_ok=True)
        for w in widths:
            ctx = browser.new_context(viewport={"width": w, "height": 740 if w < 380 else 844}, device_scale_factor=2,
                                      is_mobile=True, has_touch=True, user_agent=UA)
            for path in pages:
                label = f"{path} @{w}px"
                add = lambda sev, code, msg: findings.append((sev, code, label, msg))
                pg = ctx.new_page(); pg.add_init_script(INIT_JS)
                errs, bad, size = [], [], [0]
                cdp = ctx.new_cdp_session(pg); cdp.send("Network.enable")
                if not args.no_throttle:
                    cdp.send("Network.emulateNetworkConditions", {"offline": False, "latency": 150,
                             "downloadThroughput": 1_600_000 / 8, "uploadThroughput": 750_000 / 8})
                    cdp.send("Emulation.setCPUThrottlingRate", {"rate": 4})
                cdp.on("Network.loadingFinished", lambda e: size.__setitem__(0, size[0] + e.get("encodedDataLength", 0)))
                pg.on("console", lambda m: errs.append(m.text) if m.type == "error" and not m.text.startswith("Failed to load resource") else None)
                pg.on("pageerror", lambda e: errs.append(str(e)))
                pg.on("response", lambda r: bad.append((r.status, r.url)) if r.status >= 400 else None)
                try:
                    pg.goto(base + path, wait_until="load", timeout=90000); pg.wait_for_timeout(1500)
                except Exception as e:
                    add("FAIL", "LOAD_FAILED", f"Page did not load: {str(e)[:80]}"); pg.close(); continue
                d = pg.evaluate(AUDIT_JS)
                if not args.no_shots:
                    pg.screenshot(path=str(shots / ((re.sub(r"[^\w]+", "_", path).strip("_") or "home") + f"_{w}.png")), full_page=True)
                kb = size[0] / 1024
                if d["scrollW"] > w + 1:
                    off = ", ".join(f"{o['s']} (right edge {o['right']}px)" for o in d["over"][:3]) or "unknown element"
                    add("FAIL", "SIDEWAYS_SCROLL", f"Page is {d['scrollW']}px wide on a {w}px phone. Culprits: {off}")
                if d["tap"]:
                    ex = "; ".join(f"{t['s']} '{t['t']}' {t['w']}x{t['h']}" for t in d["tap"][:4])
                    add("WARN", "TAP_TARGET", f"{len(d['tap'])} touch target(s) under 44x44px: {ex}")
                if d["smallCount"]:
                    ex = "; ".join(f"{t['s']} {t['fs']:.0f}px '{t['t']}'" for t in d["small"][:3])
                    add("WARN", "SMALL_TEXT", f"{d['smallCount']} text element(s) under 12px: {ex}")
                if d["smallInputs"]:
                    add("WARN", "INPUT_ZOOM", f"Form field font < 16px makes iPhones zoom in on focus: {', '.join(d['smallInputs'][:3])}")
                if d["ctaAny"] == 0: add("WARN", "NO_CTA", "No tel:/WhatsApp link on this page")
                elif d["ctaFold"] == 0: add("WARN", "CTA_BELOW_FOLD", "Call/WhatsApp button not visible without scrolling - add one to the header or a sticky bar")
                if d["broken"]: add("FAIL", "BROKEN_IMAGE", f"{len(d['broken'])} image(s) failed to render: {', '.join(d['broken'][:3])}")
                if errs: add("FAIL", "JS_ERROR", f"{len(errs)} JS error(s): {errs[0][:90]}")
                bad = [(st, u) for st, u in bad if not any(re.search(rx, u) for rx in args.ignore)]
                for st, u in bad[:5]: add("FAIL", "BAD_REQUEST", f"{st}: {u[:90]}")
                lcp, cls = d["lcp"], d["cls"]
                if lcp > 4000: add("FAIL", "LCP_SLOW", f"LCP {lcp/1000:.1f}s (poor, target < 2.5s)")
                elif lcp > 2500: add("WARN", "LCP_SLOW", f"LCP {lcp/1000:.1f}s (needs work, target < 2.5s)")
                if cls > 0.25: add("FAIL", "LAYOUT_SHIFT", f"CLS {cls:.2f} (poor, target < 0.1) - set image width/height, reserve space")
                elif cls > 0.1: add("WARN", "LAYOUT_SHIFT", f"CLS {cls:.2f} (target < 0.1)")
                if kb > 3000: add("FAIL", "HEAVY_PAGE", f"{kb/1024:.1f} MB transferred")
                elif kb > 2000: add("WARN", "HEAVY_PAGE", f"{kb/1024:.1f} MB transferred (aim < 1.5 MB)")
                rows.append((label, lcp, cls, kb, "YES" if d["scrollW"] > w + 1 else "no", len(d["tap"])))
                pg.close()
            ctx.close()
        browser.close()
    if srv: srv.shutdown()

    fails = sum(1 for f in findings if f[0] == "FAIL"); warns = sum(1 for f in findings if f[0] == "WARN")
    print("\nMOBILE VERDICT: " + ("FIX FIRST - %d blocker(s), %d warning(s)" % (fails, warns) if fails
                                  else "SHIPPABLE - %d warning(s)" % warns if warns else "CLEAN"))
    print("(slow-4G + 4x CPU throttle)" if not args.no_throttle else "(no throttling)")
    print(f"\n{'page @ width':<34}{'LCP':>7}{'CLS':>7}{'KB':>7}  sideways  small-taps")
    for label, lcp, cls, kb, ov, tp in rows:
        print(f"{label:<34}{lcp/1000:>6.1f}s{cls:>7.2f}{kb:>7.0f}  {ov:<9} {tp}")
    groups = defaultdict(list)
    for sev, code, label, msg in findings: groups[(sev, code)].append((label, msg))
    order = {"FAIL": 0, "WARN": 1}
    print("\n" + "=" * 60)
    for (sev, code) in sorted(groups, key=lambda k: (order[k[0]], k[1])):
        print(f"[{sev}] {code} - {len(groups[(sev, code)])} hit(s)")
        for label, msg in groups[(sev, code)][:6]: print(f"    {label}: {msg}")
    print("=" * 60)
    if not args.no_shots: print(f"Screenshots: {args.shots}/")
    return 1 if fails else 0


if __name__ == "__main__":
    sys.exit(main())
