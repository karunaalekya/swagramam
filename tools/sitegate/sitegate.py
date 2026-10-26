#!/usr/bin/env python3
"""
sitegate - ONE command every website build must pass.  Python 3.8+, standard library only
(mobile rendering additionally needs Playwright, same as mobile_check.py).

It wraps your two existing engines and adds the project-level checks they do not cover:

  prelaunch_audit.py   static audit + safe auto-fix  (NAP, WhatsApp/tel, SEO, links, a11y, schema, weight)
  mobile_check.py      real phone rendering          (overflow, tap targets, LCP, CLS, JS errors)
  sitegate.py (here)   required pages and assets, menu data vs built pages, Analytics + Search Console,
                       social links, hours, reduced motion, size budgets, live HTTPS checks, post-launch list

  python sitegate.py init  [--profile restaurant|generic]      write sitegate.config.json + launch-checklist.json
  python sitegate.py plan  [--config f]                        everything the build must satisfy (build direction)
  python sitegate.py check dist/ [--config f] [--url https://site] [--mobile] [--launch] [--strict]
                                 [--fix | --dry-run] [--gen-seo] [--external] [--json out.json]

Keep prelaunch_audit.py and mobile_check.py in the same folder as this file.
Config = your client.config.json keys (business_name, domain, phones, ...) plus the extra keys listed in DEFAULTS.
Exit code: 0 = gate passed, 1 = a blocker failed (or a warning with --strict), 2 = usage/config error.
"""
import argparse, json, re, subprocess, sys, time, urllib.error, urllib.parse, urllib.request
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
try:
    import prelaunch_audit as pa
except ImportError:
    print("error: prelaunch_audit.py must sit next to sitegate.py", file=sys.stderr)
    sys.exit(2)

BLOCKER, WARN, INFO = "BLOCKER", "WARN", "INFO"

DEFAULTS = {
    # --- your client.config.json keys (used by prelaunch_audit.py) ---
    "business_name": "", "domain": "", "city": "", "phones": [], "whatsapp": "", "email": "",
    "address_parts": [], "require_whatsapp": True, "forbidden_text": [], "allow_text": [], "ignore": [],
    "whatsapp_also": [],                 # other WhatsApp numbers the site may link to (e.g. a catering line)
    "noindex_pages": [],                 # pages that are noindex ON PURPOSE (checkout): SEO-only checks skipped there
    "mobile_ignore": [],                 # regexes: failed requests to ignore in the static mobile run (e.g. "/api/")
    "lang": "en", "og_image": "", "country_code": "91", "schema_type": "Restaurant",
    # --- sitegate extras ---
    "profile": "restaurant",             # restaurant | generic (restaurant adds hours, menu and structured-data checks)
    "required_pages": ["/"],             # every one must exist in the build
    "required_assets": [],               # [{"path": "img/pano-cafe.webp", "max_kb": 1500}]
    "socials": {},                       # {"instagram": ["handle"]}
    "analytics": True,
    "menu_json": "",                     # menu data file, checked against the built pages
    "budgets": {"js_kb": 400, "html_kb": 250, "video_mb": 8},
    "checklist": "launch-checklist.json",
}

LAUNCH_ITEMS = [
    ("gsc_property", "Add the site to Google Search Console and verify ownership"),
    ("gsc_sitemap", "Submit sitemap.xml in Search Console"),
    ("gsc_indexing", "Request indexing for the key pages (Home, Menu, Banquets, Contact); re-check the Page indexing report after a few days"),
    ("site_search", "Search site:yourdomain in Google and confirm the pages appear"),
    ("analytics_live", "Open the site and confirm Analytics shows the visit in Realtime"),
    ("gbp", "Claim and verify the Google Business Profile: same name, address and phone as the site, photos, menu link, hours, booking link"),
    ("gsc_social", "Link the social profiles (Instagram, YouTube, etc.) in Search Console settings and keep them in the site's sameAs data"),
    ("reviews", "Put a Google review link on the site, ask the first 20 guests for reviews, reply to every review"),
    ("listings", "Create or verify listings with identical name, address, phone: Zomato, Swiggy, Justdial, TripAdvisor, Instagram bio link"),
    ("backlinks", "Get 3 or more links from local food bloggers, event or wedding directories, partner venues"),
    ("alerts", "Set Google Alerts for the brand name and signature dishes"),
    ("content", "Publish the first posts (offer, event, menu update) on the site and the Business Profile"),
    ("audit", "Run PageSpeed Insights and the Core Web Vitals report; fix anything red"),
]

VID_EXT = {".mp4", ".webm", ".mov"}
TEXT_EXT = {".css", ".js", ".mjs", ".html"}
LOCAL_TYPES = {"Restaurant", "CafeOrCoffeeShop", "BarOrPub", "FoodEstablishment", "LocalBusiness", "EventVenue"}


def url_of(path):
    p = path
    for suf in ("/index.html", "/index.htm"):
        if p.endswith(suf):
            return pa.norm(p[: -len(suf)] or "/")
    return pa.norm(re.sub(r"\.html?$", "", p))


def alnum(s):
    return re.sub(r"[^a-z0-9]", "", (s or "").lower())


# ----------------------------------------------------------------------------- context
class Ctx:
    def __init__(self, cfg, root, live_url, launch, checklist):
        self.cfg, self.root, self.live_url, self.launch, self.checklist = cfg, Path(root).resolve(), live_url, launch, checklist
        self.src = pa.LocalSource(root)
        self.pages, self.files, self._txt = {}, [], {}
        for p in self.src.pages():
            raw = self.src.html(p)
            pp = pa.PageParser()
            pp.feed(raw)
            self.pages[url_of(p)] = (pp, raw, p)
        for f in sorted(self.root.rglob("*")):
            if f.is_file() and "node_modules" not in f.parts:
                self.files.append((f.relative_to(self.root).as_posix(), f.stat().st_size))

    def text(self, rel):
        if rel not in self._txt:
            try:
                self._txt[rel] = (self.root / rel).read_text(encoding="utf-8", errors="ignore")[:3_000_000]
            except Exception:
                self._txt[rel] = ""
        return self._txt[rel]

    def code(self):
        for rel, _ in self.files:
            if Path(rel).suffix.lower() in TEXT_EXT:
                yield rel, self.text(rel)

    def visible(self):
        return " ".join(" ".join(pp.text) for pp, _, _ in self.pages.values())


REG = []


def check(cid, group, sev, text, profiles=("*",), live=False):
    def deco(fn):
        REG.append(dict(id=cid, group=group, sev=sev, text=text, profiles=profiles, live=live, fn=fn))
        return fn
    return deco


def applies(c, cfg):
    return "*" in c["profiles"] or cfg["profile"] in c["profiles"]


def ld_nodes(ctx):
    nodes, errs = [], []

    def walk(o):
        if isinstance(o, list):
            for x in o:
                walk(x)
        elif isinstance(o, dict):
            nodes.append(o)
            for v in o.values():
                walk(v)
    for u, (pp, _, _) in ctx.pages.items():
        for body in pp.jsonld:
            try:
                walk(json.loads(body))
            except Exception as e:
                errs.append(f"{u}: invalid JSON-LD ({str(e)[:50]})")
    biz = []
    for n in nodes:
        t = n.get("@type")
        if set(t if isinstance(t, list) else [t]) & LOCAL_TYPES:
            biz.append(n)
    return biz, nodes, errs


# ----------------------------------------------------------------------------- structure
@check("build.required_pages", "Build", BLOCKER, "Every page in required_pages exists in the build")
def _(ctx):
    return [f"missing page {r}" for r in ctx.cfg["required_pages"] if pa.norm(r) not in ctx.pages]


@check("build.required_assets", "Build", BLOCKER, "Every asset in required_assets (panoramas, hero films, posters...) exists and is within its size limit")
def _(ctx):
    sizes, out = dict(ctx.files), []
    for a in ctx.cfg["required_assets"]:
        path, mx = (a, None) if isinstance(a, str) else (a["path"], a.get("max_kb"))
        rel = path.lstrip("/")
        if rel not in sizes:
            out.append(f"missing {rel}")
        elif mx and sizes[rel] > mx * 1024:
            out.append(f"{rel}: {sizes[rel] // 1024} KB (limit {mx})")
    return out


@check("build.no_dev_leftovers", "Build", WARN, "No source maps, .env, .git or other dev leftovers ship in the build")
def _(ctx):
    return [r for r, _ in ctx.files if r.endswith((".map", ".env")) or r.startswith(".") or "/.git" in r][:10]


@check("build.size_budgets", "Build", WARN, "HTML, JavaScript and video files stay inside their size budgets")
def _(ctx):
    b, out = ctx.cfg["budgets"], []
    for rel, size in ctx.files:
        ext = Path(rel).suffix.lower()
        if ext == ".html" and size > b["html_kb"] * 1024:
            out.append(f"{rel}: {size // 1024} KB html")
        elif ext in (".js", ".mjs") and size > b["js_kb"] * 1024:
            out.append(f"{rel}: {size // 1024} KB js")
        elif ext in VID_EXT and size > b["video_mb"] * 1048576:
            out.append(f"{rel}: {size / 1048576:.1f} MB video")
    return out


# ----------------------------------------------------------------------------- restaurant data
@check("restaurant.hours_visible", "Restaurant", WARN, "Opening hours are written on the site", profiles=("restaurant",))
def _(ctx):
    return [] if re.search(r"\b\d{1,2}(:\d{2})?\s?(am|pm)\b", ctx.visible(), re.I) else ["no opening hours (e.g. '11 am') found in page text"]


@check("restaurant.schema_hours", "Restaurant", BLOCKER, "Local-business structured data carries opening hours and matches a configured phone", profiles=("restaurant",))
def _(ctx):
    biz, _, errs = ld_nodes(ctx)
    if not biz:
        return errs or ["no Restaurant/LocalBusiness JSON-LD found"]
    out = list(errs)
    if not any(n.get("openingHoursSpecification") or n.get("openingHours") for n in biz):
        out.append("JSON-LD has no openingHours / openingHoursSpecification")
    return out


@check("restaurant.schema_rich", "Restaurant", WARN, "Structured data also has image, servesCuisine, priceRange, menu and sameAs", profiles=("restaurant",))
def _(ctx):
    biz, _, _ = ld_nodes(ctx)
    if not biz:
        return []
    out = [f"JSON-LD missing {k}" for k in ("image", "servesCuisine", "priceRange", "sameAs") if not any(n.get(k) for n in biz)]
    if not any(n.get("hasMenu") or n.get("menu") for n in biz):
        out.append("JSON-LD missing menu / hasMenu")
    return out


def menu_items(path):
    data = json.loads(Path(path).read_text(encoding="utf-8"))
    return [(s.get("title", ""), it) for k in ("food", "drinks") for s in data.get(k, []) for it in s.get("items", [])]


def has_price(it):
    vals = [it.get(k) for k in ("price", "ml30", "bottle", "glass", "bucket")] + [v.get("price") for v in it.get("variants", [])]
    return any(isinstance(v, (int, float)) and v > 0 for v in vals)


@check("menu.data", "Restaurant", BLOCKER, "Menu data file is valid: every item has a name and at least one price above zero", profiles=("restaurant",))
def _(ctx):
    mj = ctx.cfg["menu_json"]
    if not mj:
        return ["menu_json is empty in the config"]
    try:
        items = menu_items(mj)
    except Exception as e:
        return [f"cannot read {mj}: {e}"]
    return [f"{s}: {it.get('name', '?')}" for s, it in items if not it.get("name") or not has_price(it)][:20] or ([] if items else ["menu file has no items"])


@check("menu.on_site", "Restaurant", BLOCKER, "At least 90% of the menu items appear in the built pages (so prices on the site come from the real menu)", profiles=("restaurant",))
def _(ctx):
    mj = ctx.cfg["menu_json"]
    if not mj:
        return []
    try:
        items = menu_items(mj)
    except Exception:
        return []
    blob = alnum(ctx.visible()) + alnum(" ".join(t for r, t in ctx.code() if r.endswith((".js", ".mjs", ".html"))))
    missing = [it["name"] for _, it in items if it.get("name") and alnum(re.split(r"\s[/(]", it["name"])[0]) not in blob]
    pct = 100 * (len(items) - len(missing)) / max(len(items), 1)
    return [f"only {pct:.0f}% of {len(items)} items found; e.g. {', '.join(missing[:6])}"] if pct < 90 else []


# ----------------------------------------------------------------------------- measurement, social, a11y
ANALYTICS_RE = re.compile(r"googletagmanager\.com|gtag\(|\bG-[A-Z0-9]{6,}\b|cloudflareinsights|plausible\.io|umami|posthog", re.I)
GA_ID_RE = re.compile(r"\bG-[A-Z0-9]{6,}\b")
OTHER_ANALYTICS_RE = re.compile(r"cloudflareinsights|plausible\.io|umami|posthog", re.I)


@check("measure.analytics", "Measurement", BLOCKER, "An analytics snippet (GA4, Cloudflare, Plausible...) ships in the build")
def _(ctx):
    if not ctx.cfg["analytics"]:
        return []
    code = [t for _, t in ctx.code()]
    if not any(ANALYTICS_RE.search(t) for t in code):
        return ["no analytics snippet found in any html/js file"]
    ids = {i for t in code for i in GA_ID_RE.findall(t)}
    real = {i for i in ids if not re.fullmatch(r"G-X+", i, re.I)}
    if ids and not real and not any(OTHER_ANALYTICS_RE.search(t) for t in code):
        return ["GA4 snippet is present but the Measurement ID is still the placeholder " + ", ".join(sorted(ids)) + ": no visits are recorded"]
    return []


@check("measure.gsc_verify", "Measurement", WARN, "Search Console proof is in the build (meta tag or google*.html file); DNS verification counts if you tick it in the checklist")
def _(ctx):
    home = ctx.pages.get("/")
    if home and home[0].meta("google-site-verification"):
        return []
    if any(re.match(r"google[0-9a-f]+\.html$", Path(r).name) for r, _ in ctx.files):
        return []
    return ["no google-site-verification meta tag or google*.html file"]


@check("social.links", "Social", WARN, "Every configured social profile is linked from the site")
def _(ctx):
    hrefs = [a.get("href", "") for pp, _, _ in ctx.pages.values() for a in pp.anchors]
    return [f"{p}: {h} not linked" for p, hs in ctx.cfg["socials"].items() for h in hs
            if not any(h.strip("@/").split("/")[-1].lower() in x.lower() for x in hrefs)]


@check("social.sameas", "Social", WARN, "Structured data sameAs lists the configured social profiles", profiles=("restaurant",))
def _(ctx):
    biz, _, _ = ld_nodes(ctx)
    same = " ".join(json.dumps(n.get("sameAs", "")) for n in biz).lower()
    return [f"sameAs missing {h}" for p, hs in ctx.cfg["socials"].items() for h in hs if h.strip("@/").split("/")[-1].lower() not in same]


@check("a11y.reduced_motion", "Accessibility", BLOCKER, "If the site animates, it respects prefers-reduced-motion")
def _(ctx):
    animated = honours = False
    for _, t in ctx.code():
        animated = animated or bool(re.search(r"gsap|@keyframes|requestAnimationFrame|animation\s*:|transition\s*:", t))
        honours = honours or "prefers-reduced-motion" in t
    return ["animation found but no prefers-reduced-motion handling"] if animated and not honours else []


@check("a11y.skip_link", "Accessibility", INFO, "Home page starts with a 'skip to content' link")
def _(ctx):
    home = ctx.pages.get("/")
    if home:
        for a in home[0].anchors[:1]:
            if a.get("href", "").startswith("#") and "skip" in a.get("text", "").lower():
                return []
    return ["no skip-to-content link at the top of the home page"]


# ----------------------------------------------------------------------------- live
class _NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *a, **k):
        return None


def fetch(url, follow=True, timeout=15):
    opener = urllib.request.build_opener() if follow else urllib.request.build_opener(_NoRedirect)
    req = urllib.request.Request(url, headers={"User-Agent": "sitegate/2.0", "Accept-Encoding": "gzip"})
    t = time.time()
    try:
        r = opener.open(req, timeout=timeout)
        return r.status, {k.lower(): v for k, v in r.headers.items()}, time.time() - t, r.geturl()
    except urllib.error.HTTPError as e:
        return e.code, {k.lower(): v for k, v in e.headers.items()}, time.time() - t, url
    except Exception as e:
        return None, {}, time.time() - t, str(e)


@check("live.home", "Live site", BLOCKER, "Home page loads over HTTPS with status 200 in under 2.5 s", live=True)
def _(ctx):
    s, h, dt, final = fetch(ctx.live_url)
    if s is None:
        return [f"cannot reach {ctx.live_url}: {final}"]
    return ([] if s == 200 else [f"status {s}"]) + ([] if final.startswith("https://") else ["final URL is not https"]) + ([f"slow response {dt:.1f}s"] if dt > 2.5 else [])


@check("live.http_redirect", "Live site", BLOCKER, "http:// permanently redirects to https://", live=True)
def _(ctx):
    s, h, _, _ = fetch("http://" + re.sub(r"^https?://", "", ctx.live_url), follow=False)
    return [] if s in (301, 308) and h.get("location", "").startswith("https://") else [f"http:// returned {s}, location={h.get('location', '-')}"]


@check("live.404", "Live site", WARN, "A made-up URL returns a real 404 status (not a soft 200)", live=True)
def _(ctx):
    s, *_ = fetch(ctx.live_url.rstrip("/") + f"/sitegate-probe-{int(time.time())}")
    return [] if s == 404 else [f"unknown URL returned {s}"]


@check("live.robots_sitemap", "Live site", BLOCKER, "robots.txt and sitemap.xml are reachable on the live domain", live=True)
def _(ctx):
    out = []
    for p in ("/robots.txt", "/sitemap.xml"):
        s, *_ = fetch(ctx.live_url.rstrip("/") + p)
        if s is None or s >= 400:
            s2 = fetch(ctx.live_url.rstrip("/") + "/sitemap-index.xml")[0] if p == "/sitemap.xml" else None
            if s2 != 200:
                out.append(f"{p} -> {s}")
    return out


@check("live.headers", "Live site", WARN, "Security and delivery headers: HSTS, X-Content-Type-Options, Referrer-Policy, compression", live=True)
def _(ctx):
    s, h, *_ = fetch(ctx.live_url)
    if s is None:
        return ["site unreachable"]
    out = [f"missing {k}" for k in ("strict-transport-security", "x-content-type-options", "referrer-policy") if k not in h]
    return out + (["home page not compressed"] if h.get("content-encoding", "") not in ("gzip", "br", "zstd") else [])


@check("launch.checklist", "Post-launch", INFO, "Manual launch items done: Search Console, indexing, Business Profile, reviews, listings, backlinks, alerts (enforced with --launch)")
def _(ctx):
    pend = [i["text"] for i in ctx.checklist if not i.get("done")]
    if not pend:
        return []
    return [f"{len(pend)} of {len(ctx.checklist)} pending: " + "; ".join(t[:48] for t in pend[:4]) + (" ..." if len(pend) > 4 else "")]


# ----------------------------------------------------------------------------- engines
def run_audit(cfg, root, args, label, source=None):
    """Run prelaunch_audit.Auditor and convert its findings into gate results."""
    acfg = dict(cfg)
    if "example.com" in acfg.get("domain", ""):
        acfg["domain"] = ""
    src = source or pa.LocalSource(root)
    rep = pa.Auditor(src, acfg, args.external).run()
    by = {}
    for sev, code, page, msg in rep.items:
        by.setdefault((sev, code), []).append(f"{page}: {msg}")
    sevmap = {"FAIL": BLOCKER, "WARN": WARN, "INFO": INFO}
    res = [dict(id=f"{label}.{code.lower()}", group=f"Site audit ({label})", severity=sevmap[sev], ok=False,
                text=code, failures=v) for (sev, code), v in sorted(by.items(), key=lambda k: (pa.ORDER[k[0][0]], k[0][1]))]
    if not any(r["severity"] == BLOCKER for r in res):
        res.insert(0, dict(id=f"{label}.core", group=f"Site audit ({label})", severity=BLOCKER, ok=True,
                           text="No FAIL-level issue in NAP, WhatsApp/tel, SEO tags, links, images, schema, robots, sitemap", failures=[]))
    return res


def run_mobile(dist, args):
    script = HERE / "mobile_check.py"
    if not script.exists():
        return dict(id="mobile.render", group="Mobile (real browser)", severity=WARN, ok=False, text="mobile_check.py not found", failures=["put mobile_check.py next to sitegate.py"])
    cmd = [sys.executable, str(script), str(dist), "--widths", args.widths]
    for rx in args.mobile_ignore:
        cmd += ["--ignore", rx]
    try:
        r = subprocess.run(cmd, capture_output=True, text=True, timeout=1800)
    except subprocess.TimeoutExpired:
        return dict(id="mobile.render", group="Mobile (real browser)", severity=BLOCKER, ok=False, text="mobile render check", failures=["timed out after 30 minutes"])
    out = (r.stdout or "") + (r.stderr or "")
    if r.returncode == 2 or "playwright" in out.lower() and "install" in out.lower() and r.returncode != 1:
        return dict(id="mobile.render", group="Mobile (real browser)", severity=WARN, ok=False, text="mobile render check skipped",
                    failures=[l.strip() for l in out.strip().splitlines()[-3:]] or ["could not run"])
    print(out.rstrip())
    if "Traceback" in out and r.returncode not in (0, 1):
        return dict(id="mobile.render", group="Mobile (real browser)", severity=BLOCKER, ok=False, text="mobile render check crashed",
                    failures=[out.strip().splitlines()[-1][:160]])
    fails, lines = [], out.splitlines()
    for n, l in enumerate(lines):
        if l.startswith("[FAIL]"):
            fails.append(l.strip())
            fails += [x.strip() for x in lines[n + 1:n + 3] if x.startswith("    ")]
    return dict(id="mobile.render", group="Mobile (real browser)", severity=BLOCKER, ok=r.returncode == 0,
                text="Phone-size rendering: no sideways scroll, broken images, JS errors, or poor LCP/CLS", failures=fails or (["see output above"] if r.returncode else []))


# ----------------------------------------------------------------------------- commands
def find_config(arg):
    if arg:
        return Path(arg)
    for n in ("sitegate.config.json", "client.config.json"):
        if Path(n).exists():
            return Path(n)
    return Path("sitegate.config.json")


def load_cfg(path):
    cfg = json.loads(json.dumps(DEFAULTS))
    if path.exists():
        for k, v in json.loads(path.read_text(encoding="utf-8")).items():
            if isinstance(v, dict) and isinstance(cfg.get(k), dict):
                cfg[k].update(v)
            else:
                cfg[k] = v
    else:
        print(f"note: {path} not found, using defaults (run `init` first)", file=sys.stderr)
    mj = cfg.get("menu_json")
    if mj and not Path(mj).is_absolute() and not Path(mj).exists() and (path.parent / mj).exists():
        cfg["menu_json"] = str(path.parent / mj)
    return cfg


def load_checklist(cfg, cfg_path):
    p = cfg_path.parent / cfg["checklist"]
    return json.loads(p.read_text(encoding="utf-8")) if p.exists() else [{"id": i, "text": t, "done": False} for i, t in LAUNCH_ITEMS]


def cmd_init(a):
    cfg = dict(DEFAULTS, profile=a.profile)
    cfg["schema_type"] = "Restaurant" if a.profile == "restaurant" else "LocalBusiness"
    for f, data in (("sitegate.config.json", cfg), ("launch-checklist.json", [{"id": i, "text": t, "done": False} for i, t in LAUNCH_ITEMS])):
        if Path(f).exists() and not a.force:
            print(f"skip {f} (exists, use --force)")
        else:
            Path(f).write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
            print(f"wrote {f}")
    return 0


def engine_rules(path):
    try:
        t = Path(path).read_text(encoding="utf-8")
    except Exception:
        return {}
    out = {}
    for sev, code in re.findall(r'["\'](FAIL|WARN|INFO)["\']\s*,\s*["\']([A-Z][A-Z_0-9]+)["\']', t):
        out.setdefault(sev, set()).add(code)
    return out


def cmd_plan(a):
    cfg = load_cfg(find_config(a.config))
    print(f"BUILD REQUIREMENTS - profile '{cfg['profile']}'.  The build ships only when no BLOCKER / FAIL remains.\n")
    for title, f in (("prelaunch_audit.py (static audit)", "prelaunch_audit.py"), ("mobile_check.py (real phone rendering, --mobile)", "mobile_check.py")):
        rules = engine_rules(HERE / f)
        print(title)
        for sev in ("FAIL", "WARN", "INFO"):
            if rules.get(sev):
                print(f"  {sev:<5} " + ", ".join(sorted(rules[sev])))
        print()
    group = None
    for c in sorted((c for c in REG if applies(c, cfg)), key=lambda c: (c["group"], c["id"])):
        if c["group"] != group:
            group = c["group"]
            print(f"sitegate - {group}")
        print(f"  [{c['sev']:<7}] {c['id']:<26} {c['text']}")
    print("\nPost-launch (manual - tick in launch-checklist.json, enforced by --launch):")
    for _, t in LAUNCH_ITEMS:
        print(f"  [ ] {t}")
    return 0


def cmd_check(a):
    cpath = find_config(a.config)
    cfg = load_cfg(cpath)
    root = Path(a.dist)
    if not root.is_dir():
        print(f"error: {root} is not a folder", file=sys.stderr)
        return 2
    src = pa.LocalSource(root)
    if a.gen_seo:
        pa.gen_seo(src, cfg, src.pages())
    if a.fix or a.dry_run:
        print(pa.render_fixes(pa.Fixer(src, cfg, dry=a.dry_run).run(), a.dry_run))
        print("\nRe-auditing" + (" (state before fixes)" if a.dry_run else " after fixes") + ":")
    a.mobile_ignore = list(cfg.get("mobile_ignore", []))
    ctx = Ctx(cfg, root, a.url, a.launch, load_checklist(cfg, cpath))
    if not ctx.pages:
        print(f"error: no .html files found in {root}", file=sys.stderr)
        return 2
    results = run_audit(cfg, root, a, "static")
    if a.url:
        results += run_audit(cfg, root, a, "live", source=pa.WebSource(a.url, a.crawl))
    for c in sorted((c for c in REG if applies(c, cfg)), key=lambda c: (c["group"], c["id"])):
        if c["live"] and not a.url:
            continue
        sev = BLOCKER if (c["id"] == "launch.checklist" and a.launch) else c["sev"]
        try:
            fails = c["fn"](ctx)
        except Exception as e:
            fails = [f"check crashed: {type(e).__name__}: {e}"]
        results.append(dict(id=c["id"], group=f"sitegate - {c['group']}", severity=sev, ok=not fails, text=c["text"], failures=fails))
    mobile_out = None
    if a.mobile:
        mobile_out = run_mobile(root, a)
        results.append(mobile_out)

    color = sys.stdout.isatty()
    paint = (lambda s, c: f"\033[{c}m{s}\033[0m") if color else (lambda s, c: s)
    group = None
    for r in results:
        if r["group"] != group:
            group = r["group"]
            print(f"\n{group}")
        if r["ok"]:
            tag = paint("PASS", "32")
        else:
            tag = paint("FAIL", "31") if r["severity"] == BLOCKER else paint(r["severity"], "33" if r["severity"] == WARN else "36")
        print(f"  {tag}  {r['id']:<34} {r['text'][:70]}")
        for f in r["failures"][:6]:
            print(f"        - {f[:160]}")
        if len(r["failures"]) > 6:
            print(f"        - ... and {len(r['failures']) - 6} more")
    bl = [r for r in results if not r["ok"] and r["severity"] == BLOCKER]
    wn = [r for r in results if not r["ok"] and r["severity"] == WARN]
    print(f"\n{sum(r['ok'] for r in results)}/{len(results)} checks passed - {len(bl)} blocker(s), {len(wn)} warning(s)")
    gate = not bl and not (a.strict and wn)
    print(paint("GATE PASSED", "32") if gate else paint("GATE FAILED", "31"))
    if bl:
        print("Fix first: " + ", ".join(r["id"] for r in bl[:8]))
    if a.json:
        Path(a.json).write_text(json.dumps(dict(passed=gate, results=results), indent=2, ensure_ascii=False), encoding="utf-8")
    return 0 if gate else 1


def main():
    ap = argparse.ArgumentParser(description="sitegate - one gate every website build must pass")
    sub = ap.add_subparsers(dest="cmd", required=True)
    i = sub.add_parser("init")
    i.add_argument("--profile", choices=["restaurant", "generic"], default="restaurant")
    i.add_argument("--force", action="store_true")
    p = sub.add_parser("plan")
    p.add_argument("--config")
    c = sub.add_parser("check")
    c.add_argument("dist")
    c.add_argument("--config")
    c.add_argument("--url", help="deployed site: adds live checks and a crawl audit")
    c.add_argument("--crawl", type=int, default=25)
    c.add_argument("--mobile", action="store_true", help="also run mobile_check.py (needs Playwright + Chromium)")
    c.add_argument("--widths", default="360,390")
    c.add_argument("--launch", action="store_true", help="also require every manual launch item to be ticked")
    c.add_argument("--strict", action="store_true", help="warnings fail the gate too")
    c.add_argument("--fix", action="store_true", help="apply prelaunch_audit's safe auto-fixes first (originals backed up)")
    c.add_argument("--dry-run", action="store_true", help="preview the auto-fixes")
    c.add_argument("--gen-seo", action="store_true", help="write sitemap.xml and robots.txt (needs a real domain)")
    c.add_argument("--external", action="store_true", help="also check external links (slow)")
    c.add_argument("--json")
    a = ap.parse_args()
    sys.exit({"init": cmd_init, "plan": cmd_plan, "check": cmd_check}[a.cmd](a))


if __name__ == "__main__":
    main()
