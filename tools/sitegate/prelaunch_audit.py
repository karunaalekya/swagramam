#!/usr/bin/env python3
"""
prelaunch_audit.py - one-command pre-launch audit for client websites.

  python prelaunch_audit.py ./site                         # static folder
  python prelaunch_audit.py ./site --config client.json    # + NAP / WhatsApp / domain checks
  python prelaunch_audit.py --url https://example.com --crawl 30 --config client.json
  python prelaunch_audit.py --init-config                  # write client.json template
  python prelaunch_audit.py ./site --config client.json --gen-seo   # create robots.txt + sitemap.xml
  python prelaunch_audit.py ./site --config client.json --dry-run   # preview safe auto-fixes
  python prelaunch_audit.py ./site --config client.json --fix       # apply them (originals backed up
                                                                    # to ./.audit-backup/<timestamp>/), then re-audit
--fix only does mechanical, safe edits (lang/viewport/charset, canonical, OG tags, favicon link, JSON-LD from
config, https for resources, font-display, rel=noopener, wa.me number/text formatting, sitemap/robots).
It never invents content (titles, descriptions, alt text, copy) - those stay in the report for you.

Exit code 1 if any FAIL (or any WARN with --strict) -> works in git hooks / CI.
Python 3.8+, standard library only.
"""
import argparse, datetime, json, os, re, shutil, sys
import html as htmllib
import urllib.request, urllib.error, urllib.parse
from collections import Counter, defaultdict
from html.parser import HTMLParser
from pathlib import Path

UA = {"User-Agent": "Mozilla/5.0 (prelaunch-audit)"}
SKIP_DIRS = {"node_modules", ".git", "vendor", "__pycache__", ".next", "dist-tmp"}
BUSINESS_TYPES = {
    "LocalBusiness", "Restaurant", "CafeOrCoffeeShop", "BarOrPub", "FoodEstablishment", "Store",
    "ProfessionalService", "Organization", "Dentist", "MedicalBusiness", "HealthAndBeautyBusiness",
    "HomeAndConstructionBusiness", "LodgingBusiness", "AutomotiveBusiness", "FinancialService",
    "EntertainmentBusiness", "SportsActivityLocation", "Physician", "BeautySalon", "Bakery",
}
PLACEHOLDERS = [
    r"lorem ipsum", r"\bTODO\b", r"\bFIXME\b", r"your (business|company|brand|restaurant) name",
    r"example\.(com|org)", r"\bx{3,}\b", r"\[(NUMBER|BUSINESS|ADDRESS|PHONE|EMAIL|NAME)[^\]]*\]",
    r"YOUR_[A-Z_]{3,}", r"\b123[- ]?456[- ]?7890\b", r"insert (text|image|logo) here",
    r"heading goes here", r"dummy text", r"sample text", r"placeholder text", r"NEEDS INPUT",
]
MOBILE_CODES = {"NO_VIEWPORT", "VIEWPORT_WIDTH", "ZOOM_BLOCKED", "INPUT_TYPE", "FIXED_WIDTH", "SMALL_FONT",
                "NO_MEDIA_QUERIES", "PAGE_WEIGHT", "NO_TEL_LINK", "IMG_HEAVY", "FONT_DISPLAY", "WA_MISSING",
                "WA_LINK_FORMAT", "WA_NUMBER_MISMATCH", "TEL_INVALID", "TEL_MISMATCH", "IMG_BROKEN", "BROKEN_LINK"}
GENERIC_IMG =re.compile(r"^(img[_-]?\d+|dsc[_-]?\d+|image\d*|untitled|screenshot|whatsapp[ _-]?image|copy of|pxl_|photo\d*)(?=[\W_]|$)", re.I)
IN_PHONE = re.compile(r"(?<!\d)(?:\+?91[\s-]?)?[6-9]\d{4}[\s-]?\d{5}(?!\d)")


def digits(s): return re.sub(r"\D", "", s or "")
def last10(s): return digits(s)[-10:]


def norm(path):
    p = path.split("?")[0].split("#")[0]
    if p.endswith("index.html"): p = p[: -len("index.html")]
    p = p.rstrip("/")
    return p or "/"


# ----------------------------------------------------------------------------- parser
class PageParser(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.lang = None; self.title = ""; self.metas = []; self.links = []; self.headings = []
        self.imgs = []; self.anchors = []; self.scripts = []; self.forms = []; self.controls = []
        self.iframes = []; self.ids = Counter(); self.text = []; self.jsonld = []
        self.charset = False; self.labels_for = set(); self.buttons = []
        self._in_title = False; self._h = None; self._a = None; self._btn = None
        self._script = None; self._skip = 0; self._label = 0; self.in_head = False
        self._in_style = False; self.style_text = ""

    def handle_starttag(self, tag, attrs):
        a = {k: (v if v is not None else "") for k, v in attrs}
        if "id" in a: self.ids[a["id"]] += 1
        if tag == "html": self.lang = a.get("lang")
        elif tag == "head": self.in_head = True
        elif tag == "body": self.in_head = False
        elif tag == "title": self._in_title = True
        elif tag == "meta":
            self.metas.append(a)
            if "charset" in a or a.get("http-equiv", "").lower() == "content-type": self.charset = True
        elif tag == "link": self.links.append(dict(a, _head=self.in_head))
        elif re.fullmatch(r"h[1-6]", tag): self._h = [int(tag[1]), ""]
        elif tag == "img":
            self.imgs.append(a)
            if self._a is not None: self._a["text"] += " " + a.get("alt", "")
            if self._btn is not None: self._btn["text"] += " " + a.get("alt", "")
        elif tag == "a":
            self._a = dict(a, text=""); self.anchors.append(self._a)
        elif tag == "button":
            self._btn = dict(a, text=""); self.buttons.append(self._btn)
        elif tag == "script":
            self._script = dict(a, body="", _head=self.in_head); self.scripts.append(self._script)
        elif tag == "style": self._skip += 1; self._in_style = True
        elif tag == "form": self.forms.append(a)
        elif tag in ("input", "select", "textarea"):
            self.controls.append(dict(a, _tag=tag, _in_label=self._label > 0))
        elif tag == "label":
            self._label += 1
            if a.get("for"): self.labels_for.add(a["for"])
        elif tag == "iframe": self.iframes.append(a)

    def handle_endtag(self, tag):
        if tag == "title": self._in_title = False
        elif tag == "head": self.in_head = False
        elif re.fullmatch(r"h[1-6]", tag) and self._h:
            self.headings.append(tuple(self._h)); self._h = None
        elif tag == "a": self._a = None
        elif tag == "button": self._btn = None
        elif tag == "script":
            if self._script and "ld+json" in self._script.get("type", ""):
                self.jsonld.append(self._script["body"])
            self._script = None
        elif tag == "style": self._skip = max(0, self._skip - 1); self._in_style = False
        elif tag == "label": self._label = max(0, self._label - 1)

    def handle_data(self, d):
        if self._in_title: self.title += d
        if self._script is not None: self._script["body"] += d; return
        if self._skip:
            if self._in_style: self.style_text += d
            return
        self.text.append(d)
        if self._a is not None: self._a["text"] += d
        if self._btn is not None: self._btn["text"] += d
        if self._h is not None: self._h[1] += d

    def meta(self, key):
        for m in self.metas:
            if m.get("name", "").lower() == key or m.get("property", "").lower() == key:
                return m.get("content", "")
        return None

    def link_rel(self, rel):
        return [l for l in self.links if rel in l.get("rel", "").lower().split()]


# ----------------------------------------------------------------------------- sources
class LocalSource:
    kind = "local"

    def __init__(self, root):
        self.root = Path(root).resolve()

    def _resolve(self, path):
        path = urllib.parse.unquote(path.split("?")[0].split("#")[0]) or "/"
        cands = [path + "index.html"] if path.endswith("/") else [path, path + ".html", path + "/index.html"]
        for c in cands:
            rel = c.lstrip("/")
            p = self.root / rel
            if rel and p.is_file():
                cur, ok = self.root, True
                for part in Path(rel).parts:
                    if part not in os.listdir(cur): ok = False; break
                    cur = cur / part
                return p, ok, "/" + rel
        return None, True, None

    def info(self, path):
        p, ok, key = self._resolve(path)
        if p is None: return {"status": 404}
        return {"status": 200, "size": p.stat().st_size, "case_ok": ok, "key": key}

    def html(self, path):
        p, _, _ = self._resolve(path)
        return p.read_text("utf-8", errors="replace") if p else ""

    def read_text(self, path):
        return self.html(path) if self.info(path)["status"] == 200 else None

    def pages(self):
        out = []
        for dp, dn, fn in os.walk(self.root):
            dn[:] = [d for d in dn if d not in SKIP_DIRS and not d.startswith(".")]
            for f in fn:
                if f.lower().endswith((".html", ".htm")):
                    out.append("/" + (Path(dp) / f).relative_to(self.root).as_posix())
        return sorted(out)

    def host(self): return None


class WebSource:
    kind = "web"

    def __init__(self, base, crawl):
        self.base = base.rstrip("/")
        self.crawl = crawl
        self._info = {}; self._html = {}

    def _open(self, path, method):
        req = urllib.request.Request(self.base + path, method=method, headers=UA)
        try:
            with urllib.request.urlopen(req, timeout=20) as r:
                body = r.read() if method == "GET" else b""
                return r.status, dict(r.headers), body
        except urllib.error.HTTPError as e:
            return e.code, dict(e.headers or {}), b""
        except Exception:
            return 0, {}, b""

    def info(self, path):
        path = path.split("#")[0] or "/"
        if path in self._info: return self._info[path]
        st, h, _ = self._open(path, "HEAD")
        if st in (0, 403, 405, 501):
            st, h, body = self._open(path, "GET")
            if body and "content-length" not in {k.lower() for k in h}:
                h["Content-Length"] = str(len(body))
        size = int({k.lower(): v for k, v in h.items()}.get("content-length", 0) or 0)
        self._info[path] = {"status": st, "size": size, "case_ok": True, "key": path}
        return self._info[path]

    def html(self, path):
        path = path.split("#")[0] or "/"
        if path not in self._html:
            st, h, body = self._open(path, "GET")
            self._html[path] = body.decode("utf-8", errors="replace") if st == 200 else ""
        return self._html[path]

    def read_text(self, path):
        st, h, body = self._open(path, "GET")
        return body.decode("utf-8", errors="replace") if st == 200 else None

    def pages(self):
        seen, queue, out = set(), ["/"], []
        while queue and len(out) < self.crawl:
            p = queue.pop(0)
            if norm(p) in seen: continue
            seen.add(norm(p))
            h = self.html(p)
            if not h: continue
            out.append(p)
            pp = PageParser(); pp.feed(h)
            for a in pp.anchors:
                href = a.get("href", "")
                u = urllib.parse.urljoin("http://__s__" + p, href)
                pu = urllib.parse.urlparse(u)
                if pu.netloc == "__s__" and pu.scheme == "http" and not re.search(r"\.(pdf|jpe?g|png|webp|zip|svg|gif)$", pu.path, re.I):
                    queue.append(pu.path + ("?" + pu.query if pu.query else ""))
        return out

    def host(self): return urllib.parse.urlparse(self.base).netloc


# ----------------------------------------------------------------------------- report
class Report:
    def __init__(self, ignore):
        self.items = []; self.ignore = set(ignore)

    def add(self, sev, code, page, msg):
        if code not in self.ignore: self.items.append((sev, code, page, msg))

    def count(self, sev): return sum(1 for i in self.items if i[0] == sev)


# ----------------------------------------------------------------------------- audit
class Auditor:
    def __init__(self, src, cfg, external=False):
        self.src, self.cfg, self.external = src, cfg, external
        self.rep = Report(cfg.get("ignore", []))
        self.parsed = {}; self.linked = set(); self.cfg_phones = set()
        for p in cfg.get("phones", []) + ([cfg["whatsapp"]] if cfg.get("whatsapp") else []):
            if last10(p): self.cfg_phones.add(last10(p))
        d = cfg.get("domain", "")
        self.cfg_host = urllib.parse.urlparse(d).netloc.replace("www.", "") if d else (src.host() or "").replace("www.", "")
        self.wa_seen = False; self.tel_seen = False
        # pages that are noindex ON PURPOSE (checkout, account, order status): SEO-only checks are skipped there
        self.app_pages = {norm(p) for p in cfg.get("noindex_pages", [])}
        self.wa_ok = {last10(n) for n in [cfg.get("whatsapp", "")] + list(cfg.get("whatsapp_also", [])) if last10(n)}
        self.weight = Counter(); self.css_seen = set(); self.has_media = False; self.css_found = False; self.framework = False

    def add(self, *a): self.rep.add(*a)

    def check_css(self, label, css):
        a = lambda sev, code, msg: self.add(sev, code, label, msg)
        if not css.strip(): return
        self.css_found = True
        if re.search(r"@(media|container)\b", css): self.has_media = True
        css_nc = re.sub(r"/\*.*?\*/", "", css, flags=re.S)
        wide = [m for m in re.findall(r"(?:^|[;{\s])((?:min-)?width)\s*:\s*(\d{3,4})px\s*[;}]", css_nc) if int(m[1]) >= 480]
        if wide:
            a("WARN", "FIXED_WIDTH", "Fixed pixel width >= 480px (overflows phones unless inside a media query): "
              + ", ".join(f"{k}:{v}px" for k, v in wide[:4]))
        small = [float(x) for x in re.findall(r"font-size\s*:\s*(\d+(?:\.\d+)?)px", css_nc) if float(x) < 12]
        if small: a("WARN", "SMALL_FONT", f"{len(small)} font-size value(s) under 12px (unreadable on phones): {sorted(set(small))[:4]}")
        if re.search(r"(?<![\w-])width\s*:\s*100vw", css_nc): a("INFO", "VW_OVERFLOW", "width:100vw causes sideways scroll when a scrollbar exists - prefer 100%")

    def internal(self, page, href):
        u = urllib.parse.urljoin("http://__s__" + page, href)
        pu = urllib.parse.urlparse(u)
        if pu.scheme not in ("http", "https"): return None
        if pu.netloc == "__s__" or (self.cfg_host and pu.netloc.replace("www.", "") == self.cfg_host):
            return pu.path + ("?" + pu.query if pu.query else ""), pu.fragment
        return None

    def get_parsed(self, path):
        info = self.src.info(path)
        key = info.get("key", path)
        if key not in self.parsed:
            h = self.src.html(path); pp = PageParser(); pp.feed(h); self.parsed[key] = (pp, h)
        return self.parsed[key]

    def run(self):
        pages = self.src.pages()
        if not pages:
            self.add("FAIL", "NO_PAGES", "-", "No HTML pages found"); return self.rep
        for p in pages:
            h = self.src.html(p); pp = PageParser(); pp.feed(h)
            key = self.src.info(p).get("key", p); self.parsed[key] = (pp, h)
        self.pages = pages
        for p in pages:
            self.check_page(p)
        self.check_site(pages)
        return self.rep

    # ---- per page
    APP_SKIP = {"NOINDEX", "DESC_MISSING", "DESC_LENGTH", "TITLE_LENGTH", "NO_CANONICAL", "CANONICAL_RELATIVE",
                "CANONICAL_NOT_SELF", "OG_MISSING", "OG_IMAGE_RELATIVE", "H1_MISSING"}

    def is_app(self, page):
        return norm(self.src.info(page).get("key", page)) in self.app_pages

    def check_page(self, page):
        pp, raw = self.get_parsed(page)
        is404 = "404" in page
        app = self.is_app(page) and "noindex" in (pp.meta("robots") or "").lower()
        a = lambda sev, code, msg: None if (app and code in self.APP_SKIP) else self.add(sev, code, page, msg)
        title = pp.title.strip()
        desc = pp.meta("description")
        robots = (pp.meta("robots") or "").lower()
        # head essentials
        if not title: a("FAIL", "TITLE_MISSING", "No <title>")
        elif not (20 <= len(title) <= 65): a("WARN", "TITLE_LENGTH", f"Title is {len(title)} chars (aim 20-65): {title[:70]}")
        if desc is None or not desc.strip(): a("FAIL", "DESC_MISSING", "No meta description")
        elif not (70 <= len(desc) <= 160): a("WARN", "DESC_LENGTH", f"Meta description is {len(desc)} chars (aim 70-160)")
        if not pp.lang: a("FAIL", "HTML_LANG", "<html> has no lang attribute")
        vp = pp.meta("viewport")
        if vp is None: a("FAIL", "NO_VIEWPORT", "Missing viewport meta (breaks mobile layout)")
        else:
            if "width=device-width" not in vp.replace(" ", ""): a("FAIL", "VIEWPORT_WIDTH", f"viewport lacks width=device-width: '{vp}'")
            if re.search(r"user-scalable\s*=\s*(no|0)|maximum-scale\s*=\s*[0-4](\.\d+)?\b", vp):
                a("WARN", "ZOOM_BLOCKED", f"Pinch-zoom disabled in viewport ('{vp}') - accessibility failure, auto-fixable")
        if not pp.charset: a("WARN", "NO_CHARSET", "Missing <meta charset>")
        if "noindex" in robots and not is404: a("FAIL", "NOINDEX", "robots meta contains noindex (staging leftover?)")
        if not pp.link_rel("icon") and not pp.link_rel("shortcut"): a("WARN", "NO_FAVICON_LINK", "No favicon <link>")
        canon = pp.link_rel("canonical")
        if is404: pass  # error pages don't need canonical / OG tags
        elif not canon: a("WARN", "NO_CANONICAL", "No canonical link")
        else:
            ch = canon[0].get("href", "")
            if not ch.startswith("http"): a("WARN", "CANONICAL_RELATIVE", f"Canonical should be absolute: {ch}")
            else:
                pu = urllib.parse.urlparse(ch)
                if self.cfg_host and pu.netloc.replace("www.", "") != self.cfg_host:
                    a("FAIL", "CANONICAL_DOMAIN", f"Canonical points to {pu.netloc}, expected {self.cfg_host}")
                elif norm(pu.path) != norm(self.src.info(page).get("key", page)) and not is404:
                    a("WARN", "CANONICAL_NOT_SELF", f"Canonical path {pu.path} differs from page {page}")
        for k in ("og:title", "og:description", "og:image", "og:url"):
            if not is404 and not pp.meta(k): a("WARN", "OG_MISSING", f"Missing {k} (link previews on WhatsApp/social)")
        img = pp.meta("og:image")
        if img and not img.startswith("http"): a("WARN", "OG_IMAGE_RELATIVE", "og:image must be an absolute URL")
        # headings
        h1 = [h for h in pp.headings if h[0] == 1]
        if len(h1) == 0 and not is404: a("FAIL", "H1_MISSING", "No <h1>")
        elif len(h1) > 1: a("WARN", "H1_MULTIPLE", f"{len(h1)} <h1> tags")
        prev = 0
        for lvl, txt in pp.headings:
            if prev and lvl > prev + 1:
                a("WARN", "HEADING_SKIP", f"h{prev} -> h{lvl} ('{txt.strip()[:40]}')"); break
            prev = lvl
        # duplicate ids
        dup = [i for i, c in pp.ids.items() if c > 1]
        if dup: a("WARN", "DUPLICATE_ID", "Duplicate id(s): " + ", ".join(dup[:5]))
        # placeholders / leftovers
        visible = " ".join(pp.text) + " " + title + " " + (desc or "") + " " + " ".join(i.get("alt", "") for i in pp.imgs)
        for ok_text in self.cfg.get("allow_text", []):  # real names that look like placeholders, e.g. "Old Monk XXX"
            visible = visible.replace(ok_text, " ")
        for pat in PLACEHOLDERS + self.cfg.get("forbidden_text", []):
            m = re.search(pat, visible, re.I)
            if m: a("FAIL", "PLACEHOLDER_TEXT", f"Leftover placeholder: '{m.group(0)}'")
        if re.search(r"<!--.*?(TODO|FIXME).*?-->", raw, re.S | re.I): a("WARN", "TODO_COMMENT", "TODO/FIXME in an HTML comment")
        if re.search(r"(localhost|127\.0\.0\.1|192\.168\.\d+\.\d+)", raw): a("FAIL", "LOCALHOST_REF", "Reference to localhost / local IP")
        for s in pp.scripts:
            body = s["body"]
            if re.search(r"\bconsole\.(log|debug)\(|\bdebugger\b", body): a("WARN", "DEBUG_CODE", "console.log/debugger left in inline script"); break
        # mobile: CSS (inline + linked local), framework detection, input types, lazy loading
        self.check_css(page + " <style>", pp.style_text)
        for l in pp.links:
            if "stylesheet" in l.get("rel", "").lower():
                h = l.get("href", "")
                if re.search(r"tailwind|bootstrap|bulma|foundation|materialize", h, re.I): self.framework = True
                loc = self.internal(page, h) if h and not h.startswith("data:") else None
                if loc and loc[0] not in self.css_seen:
                    self.css_seen.add(loc[0])
                    css = self.src.read_text(loc[0])
                    if css: self.check_css(loc[0], css)
        for s in pp.scripts:
            if re.search(r"tailwind|bootstrap", s.get("src", ""), re.I): self.framework = True
        for c in pp.controls:
            if c["_tag"] != "input" or c.get("type", "text").lower() != "text": continue
            hint = " ".join(c.get(k, "") for k in ("name", "id", "placeholder", "aria-label")).lower()
            if re.search(r"phone|mobile|whatsapp|contact[ _-]?no", hint):
                a("WARN", "INPUT_TYPE", f"Phone field '{c.get('name') or c.get('id')}' is type=text - use type=tel (numeric keypad), auto-fixable")
            elif re.search(r"e-?mail", hint):
                a("WARN", "INPUT_TYPE", f"Email field '{c.get('name') or c.get('id')}' is type=text - use type=email, auto-fixable")
        lazy_missing = [im for im in pp.imgs[1:] if "loading" not in im and im.get("src") and not im["src"].startswith("data:")]
        if lazy_missing: a("INFO", "IMG_NO_LAZY", f"{len(lazy_missing)} below-the-fold image(s) without loading=lazy, auto-fixable")
        # images
        for im in pp.imgs:
            src = im.get("src", "") or im.get("data-src", "")
            if "alt" not in im: a("FAIL", "IMG_NO_ALT", f"<img> without alt: {src[:60]}")
            elif re.search(r"\.(jpe?g|png|webp|gif)$", im["alt"], re.I) or im["alt"].strip().lower() in ("image", "photo", "img"):
                a("WARN", "IMG_ALT_BAD", f"Alt text is a filename/generic: '{im['alt']}'")
            if src and GENERIC_IMG.search(urllib.parse.unquote(src.split("?")[0]).rsplit("/", 1)[-1]): a("WARN", "IMG_FILENAME", f"Generic image filename (hurts image SEO): {src[:60]}")
            if src and "width" not in im and "height" not in im and not src.startswith("data:"):
                a("INFO", "IMG_NO_DIMS", f"No width/height (layout shift): {src[:60]}")
            self.check_asset(page, src, "IMG", big_kb=300)
        # links
        for an in pp.anchors:
            self.check_anchor(page, an)
        for l in pp.links:
            rel = l.get("rel", "").lower()
            href = l.get("href", "")
            if "stylesheet" in rel or "icon" in rel or "preload" in rel:
                self.check_asset(page, href, "ASSET", big_kb=None)
            if "fonts.googleapis.com" in href and "display=" not in href:
                a("WARN", "FONT_DISPLAY", "Google Fonts URL without &display=swap")
        for s in pp.scripts:
            src = s.get("src", "")
            if src:
                self.check_asset(page, src, "ASSET", big_kb=None)
                if s["_head"] and "defer" not in s and "async" not in s and s.get("type") != "module":
                    a("INFO", "SCRIPT_BLOCKING", f"Render-blocking script in <head>: {src[:60]}")
        for f in pp.iframes:
            if not f.get("title"): a("WARN", "IFRAME_TITLE", f"iframe without title: {f.get('src', '')[:50]}")
            if f.get("src", "").startswith("http://"): a("FAIL", "MIXED_CONTENT", f"http:// iframe: {f['src'][:60]}")
        # forms
        for f in pp.forms:
            act = f.get("action", "")
            if re.search(r"YOUR_|example\.|^#$", act): a("FAIL", "FORM_ACTION", f"Form action looks like a placeholder: '{act}'")
        for c in pp.controls:
            t = c.get("type", "text").lower()
            if c["_tag"] == "input" and t in ("hidden", "submit", "button", "image", "reset", "checkbox", "radio"): continue
            if not (c.get("aria-label") or c.get("aria-labelledby") or c.get("id") in pp.labels_for or c["_in_label"]):
                a("WARN", "INPUT_NO_LABEL", f"Form field without a label: name='{c.get('name', '')}'"); break
        for b in pp.buttons:
            if not (b["text"].strip() or b.get("aria-label")): a("WARN", "BUTTON_NO_TEXT", "Button with no text or aria-label"); break
        # structured data
        self.check_jsonld(page, pp)
        # strays
        if self.cfg_phones:
            vis = " ".join(pp.text)
            for m in IN_PHONE.findall(vis):
                if last10(m) not in self.cfg_phones: a("WARN", "PHONE_UNKNOWN", f"Phone number not in config: {m.strip()}"); break
        if len(raw) > 300_000: a("WARN", "HTML_HEAVY", f"HTML is {len(raw)//1024} KB")

    def check_asset(self, page, ref, code, big_kb, count=True):
        a = lambda sev, c, m: self.add(sev, c, page, m)
        if not ref or ref.startswith(("data:", "javascript:", "#", "blob:")): return
        if ref.startswith("http://"):
            a("FAIL", "MIXED_CONTENT", f"http:// resource (blocked on https): {ref[:70]}"); return
        loc = self.internal(page, ref if not ref.startswith("//") else "https:" + ref)
        if loc is None:
            if self.external and ref.startswith(("http", "//")): self.check_external(page, ref)
            return
        path, _ = loc
        i = self.src.info(path)
        if i["status"] != 200:
            a("FAIL", f"{code}_BROKEN", f"Missing file ({i['status']}): {ref[:70]}")
        else:
            self.linked.add(norm(i["key"]))
            if count: self.weight[page] += i.get("size", 0)
            if not i.get("case_ok", True):
                a("FAIL", "CASE_MISMATCH", f"Filename case differs from reference (breaks on Linux hosting): {ref[:70]}")
            if big_kb and i.get("size", 0) > big_kb * 1024:
                a("WARN", "IMG_HEAVY", f"{i['size']//1024} KB (> {big_kb} KB, compress/convert to WebP): {ref[:60]}")

    def check_external(self, page, url):
        try:
            req = urllib.request.Request(url if url.startswith("http") else "https:" + url, method="HEAD", headers=UA)
            urllib.request.urlopen(req, timeout=12)
        except urllib.error.HTTPError as e:
            if e.code in (404, 410): self.add("FAIL", "EXTERNAL_BROKEN", page, f"{e.code}: {url[:80]}")
        except Exception:
            self.add("WARN", "EXTERNAL_UNREACHABLE", page, f"Could not reach: {url[:80]}")

    def check_anchor(self, page, an):
        a = lambda sev, c, m: self.add(sev, c, page, m)
        href = an.get("href")
        text = an["text"].strip()
        if href is None: return
        href_s = href.strip()
        if href_s in ("", "#") or href_s.lower().startswith("javascript:"):
            a("WARN", "DEAD_LINK", f"Placeholder link (href='{href_s}') text='{text[:30]}'"); return
        if not (text or an.get("aria-label") or an.get("title")): a("WARN", "LINK_NO_TEXT", f"Link with no text: {href_s[:50]}")
        if re.fullmatch(r"(click here|here|read more|more)", text, re.I): a("INFO", "LINK_GENERIC", f"Generic link text '{text}'")
        low = href_s.lower()
        if low.startswith("mailto:"):
            addr = href_s[7:].split("?")[0]
            if not re.fullmatch(r"[^@\s]+@[^@\s]+\.[^@\s]+", addr): a("FAIL", "MAILTO_INVALID", f"Invalid mailto: {addr}")
            elif self.cfg.get("email") and addr.lower() != self.cfg["email"].lower():
                a("WARN", "EMAIL_MISMATCH", f"{addr} != config email {self.cfg['email']}")
            return
        if low.startswith("tel:"):
            self.tel_seen = True
            d = digits(href_s)
            if not (10 <= len(d) <= 15): a("FAIL", "TEL_INVALID", f"tel: link has {len(d)} digits: {href_s}")
            elif self.cfg_phones and last10(href_s) not in self.cfg_phones: a("FAIL", "TEL_MISMATCH", f"tel: {href_s} not in config phones")
            return
        if "wa.me" in low or "whatsapp.com" in low or low.startswith("whatsapp:"):
            self.check_wa(page, href_s); return
        if low.startswith(("http://", "https://", "//")) and self.internal(page, href_s) is None:
            if an.get("target") == "_blank" and "noopener" not in an.get("rel", "") and "noreferrer" not in an.get("rel", ""):
                a("INFO", "NO_NOOPENER", f"target=_blank without rel=noopener: {href_s[:50]}")
            if self.external: self.check_external(page, href_s)
            return
        loc = self.internal(page, href_s)
        if loc is None: return
        path, frag = loc
        if path.lower().endswith((".pdf", ".zip", ".jpg", ".jpeg", ".png", ".webp", ".svg")) or "." in Path(path).name and not path.lower().endswith((".html", ".htm")):
            self.check_asset(page, href_s, "FILE", big_kb=None, count=False); return
        i = self.src.info(path)
        if i["status"] != 200:
            a("FAIL", "BROKEN_LINK", f"{i['status']}: {href_s[:70]}"); return
        if not i.get("case_ok", True): a("FAIL", "CASE_MISMATCH", f"Link case differs from file (breaks on Linux): {href_s[:70]}")
        self.linked.add(norm(i["key"]))
        if frag and frag.lower() != "top":
            tp, _ = self.get_parsed(path)
            if frag not in tp.ids and frag not in {x.get("name") for x in tp.anchors}:
                a("WARN", "BROKEN_ANCHOR", f"#{frag} not found on {path}")

    def check_wa(self, page, href):
        a = lambda sev, c, m: self.add(sev, c, page, m)
        self.wa_seen = True
        u = urllib.parse.urlparse(href); q = urllib.parse.parse_qs(u.query)
        num = ""
        if u.netloc.endswith("wa.me"):
            num = u.path.strip("/")
            if not re.fullmatch(r"\d{8,15}", num):
                a("FAIL", "WA_LINK_FORMAT", f"wa.me needs digits only incl. country code (no +, spaces, dashes, placeholders): '{num}'")
        else:
            num = (q.get("phone") or [""])[0]
        if self.wa_ok and last10(num) not in self.wa_ok and re.fullmatch(r"\d{8,15}", digits(num) or "x"):
            a("FAIL", "WA_NUMBER_MISMATCH", f"WhatsApp link number {num} != config {self.cfg['whatsapp']} (extra allowed numbers go in whatsapp_also)")
        if " " in href: a("WARN", "WA_TEXT_ENCODING", "Raw spaces in WhatsApp link - URL-encode the text (%20)")
        if "text" not in q: a("INFO", "WA_NO_PREFILL", "WhatsApp link has no pre-filled ?text= message")

    def check_jsonld(self, page, pp):
        a = lambda sev, c, m: self.add(sev, c, page, m)
        nodes = []

        def walk(o):
            if isinstance(o, list):
                for x in o: walk(x)
            elif isinstance(o, dict):
                nodes.append(o)
                for v in o.values(): walk(v)
        for body in pp.jsonld:
            try: walk(json.loads(body))
            except Exception as e: a("FAIL", "JSONLD_INVALID", f"Invalid JSON-LD: {str(e)[:60]}")
        biz = []
        for n in nodes:
            t = n.get("@type")
            ts = t if isinstance(t, list) else [t]
            if any(x in BUSINESS_TYPES for x in ts): biz.append(n)
        is_home = norm(self.src.info(page).get("key", page)) == "/"
        if is_home and not biz and not pp.jsonld.__len__():
            a("WARN", "NO_SCHEMA", "No JSON-LD (LocalBusiness/Restaurant etc.) on the homepage")
        for n in biz:
            for fld in ("name", "address", "telephone"):
                if not n.get(fld): a("WARN", "SCHEMA_FIELD", f"Business schema missing '{fld}'")
            if self.cfg.get("phones") and n.get("telephone") and last10(str(n["telephone"])) not in self.cfg_phones:
                a("FAIL", "SCHEMA_PHONE_MISMATCH", f"Schema telephone {n['telephone']} not in config")
            if self.cfg.get("business_name") and n.get("name") and n["name"].strip().lower() != self.cfg["business_name"].strip().lower():
                a("WARN", "SCHEMA_NAME_MISMATCH", f"Schema name '{n['name']}' != config '{self.cfg['business_name']}'")

    # ---- site level
    def check_site(self, pages):
        a = lambda sev, c, m, pg="(site)": self.add(sev, c, pg, m)
        titles, descs = defaultdict(list), defaultdict(list)
        all_text, home = [], None
        for p in pages:
            pp, _ = self.get_parsed(p)
            titles[pp.title.strip().lower()].append(p)
            d = (pp.meta("description") or "").strip().lower()
            if d: descs[d].append(p)
            all_text.append(" ".join(pp.text) + " " + " ".join(l.get("href", "") for l in pp.anchors) + " ".join(pp.jsonld))
            if norm(self.src.info(p).get("key", p)) == "/": home = pp
        for t, ps in titles.items():
            if t and len(ps) > 1: a("WARN", "DUP_TITLE", f"Same <title> on {len(ps)} pages: {', '.join(ps[:4])}")
        for d, ps in descs.items():
            if len(ps) > 1: a("WARN", "DUP_DESC", f"Same meta description on {len(ps)} pages: {', '.join(ps[:4])}")
        blob = " ".join(all_text)
        c = self.cfg
        if c.get("business_name") and c["business_name"].lower() not in blob.lower():
            a("FAIL", "NAP_NAME", f"Business name '{c['business_name']}' not found on site")
        for ph in c.get("phones", []):
            if last10(ph) and last10(ph) not in digits(blob):
                a("FAIL", "NAP_PHONE", f"Phone {ph} not found anywhere on site")
        for part in c.get("address_parts", []):
            if part.lower() not in blob.lower(): a("FAIL", "NAP_ADDRESS", f"Address part '{part}' not found on site")
        if c.get("email") and c["email"].lower() not in blob.lower(): a("WARN", "NAP_EMAIL", f"Email {c['email']} not found on site")
        if c.get("whatsapp") and c.get("require_whatsapp", True) and not self.wa_seen:
            a("FAIL", "WA_MISSING", "No WhatsApp (wa.me) link anywhere on site")
        if c.get("phones") and not self.tel_seen:
            a("WARN", "NO_TEL_LINK", "No tap-to-call (tel:) link anywhere - on mobile calling is usually the #1 conversion")
        if self.css_found and not self.has_media and not self.framework:
            a("WARN", "NO_MEDIA_QUERIES", "No @media queries in any local CSS and no CSS framework detected - layout is probably not responsive")
        for p, w in self.weight.items():
            w += len(self.get_parsed(p)[1])
            if w > 4_000_000: a("FAIL", "PAGE_WEIGHT", f"~{w/1e6:.1f} MB of local assets - far too heavy for mobile data", p)
            elif w > 1_500_000: a("WARN", "PAGE_WEIGHT", f"~{w/1e6:.1f} MB of local assets (aim under 1.5 MB on mobile)", p)
        if c.get("city") and home:
            hay = (home.title + " " + (home.meta("description") or "") + " " + " ".join(h[1] for h in home.headings if h[0] == 1)).lower()
            if c["city"].lower() not in hay:
                a("WARN", "LOCAL_KEYWORD", f"City '{c['city']}' not in homepage title / description / h1", "/")
        # robots + sitemap
        robots = self.src.read_text("/robots.txt")
        if robots is None: a("WARN", "NO_ROBOTS", "robots.txt missing (run with --gen-seo)")
        else:
            if re.search(r"(?im)^user-agent:\s*\*\s*$(?:\n(?!user-agent).*)*?^disallow:\s*/\s*$", robots):
                a("FAIL", "ROBOTS_BLOCKS_ALL", "robots.txt has 'Disallow: /' for all crawlers")
            if "sitemap:" not in robots.lower(): a("INFO", "ROBOTS_NO_SITEMAP", "robots.txt has no Sitemap: line")
        sm = self.src.read_text("/sitemap.xml")
        if sm is None: a("WARN", "NO_SITEMAP", "sitemap.xml missing (run with --gen-seo)")
        else:
            in_sm = set()
            for loc in re.findall(r"<loc>\s*(.*?)\s*</loc>", sm):
                pu = urllib.parse.urlparse(loc)
                if self.cfg_host and pu.netloc.replace("www.", "") != self.cfg_host:
                    a("FAIL", "SITEMAP_DOMAIN", f"Sitemap URL on wrong domain: {loc}"); continue
                i = self.src.info(pu.path or "/")
                if i["status"] != 200: a("FAIL", "SITEMAP_BROKEN", f"Sitemap URL not found ({i['status']}): {loc}")
                else: in_sm.add(norm(i["key"]))
            for p in pages:
                pp, _ = self.get_parsed(p)
                k = norm(self.src.info(p).get("key", p))
                if "noindex" in (pp.meta("robots") or "").lower() or "404" in p: continue
                if k not in in_sm: a("WARN", "NOT_IN_SITEMAP", "Page missing from sitemap.xml", p)
        if self.src.kind == "local" and not any("404" in p for p in pages):
            a("WARN", "NO_404_PAGE", "No 404.html")
        if self.src.kind == "web":
            if self.src.info("/__definitely-missing-page__")["status"] == 200:
                a("WARN", "SOFT_404", "Missing URLs return 200 instead of 404")
        if self.src.info("/favicon.ico")["status"] != 200 and not any(self.get_parsed(p)[0].link_rel("icon") for p in pages):
            a("WARN", "NO_FAVICON", "No favicon.ico and no icon link")
        # orphans (local)
        if self.src.kind == "local":
            for p in pages:
                k = norm(self.src.info(p).get("key", p))
                if k != "/" and k not in self.linked and "404" not in p and k not in self.app_pages:
                    a("INFO", "ORPHAN_PAGE", "Page not linked from any other page", p)


# ----------------------------------------------------------------------------- fixer
class Fixer:
    """Applies only mechanical, reversible fixes. Never invents titles, descriptions, alt text or copy."""

    def __init__(self, src, cfg, dry):
        self.src, self.cfg, self.dry = src, cfg, dry
        d = cfg.get("domain", "").rstrip("/")
        self.domain = d
        self.domain_ok = bool(d) and "example.com" not in d
        self.host = urllib.parse.urlparse(d).netloc.replace("www.", "") if self.domain_ok else ""
        self.lang = cfg.get("lang", "en")
        self.cc = str(cfg.get("country_code", "91"))
        self.log = []
        self.backup = Path(".audit-backup") / datetime.datetime.now().strftime("%Y%m%d-%H%M%S") / src.root.name

    def canon_url(self, key):
        path = key[: -len("index.html")] if key.endswith("/index.html") else key
        return self.domain + path

    def run(self):
        pages = self.src.pages()
        for p in pages: self.fix_page(p)
        if self.domain_ok:
            if self.dry: self.log.append(("(site)", "would regenerate sitemap.xml and create robots.txt if missing"))
            else:
                gen_seo(self.src, self.cfg, pages)
                self.log.append(("(site)", "regenerated sitemap.xml (robots.txt created if missing)"))
        else:
            self.log.append(("(site)", "skipped canonical / OG / schema / sitemap: set a real 'domain' in the config"))
        return self.log

    def fix_page(self, page):
        pp = PageParser(); raw = self.src.html(page); pp.feed(raw)
        key = self.src.info(page)["key"]
        is404 = "404" in page
        L = lambda m: self.log.append((page, m))
        cnt = Counter()
        new = raw

        # --- tag-level edits
        def mixed(m):
            t = re.sub(r'\b(src|href)(\s*=\s*)(["\'])http://(?!localhost|127\.|192\.168\.)', r"\1\2\3https://", m.group(0), flags=re.I)
            if t != m.group(0): cnt["mixed"] += 1
            return t
        new = re.sub(r"<(?:link|script|img|iframe|source)\b[^>]*>", mixed, new, flags=re.I)

        def fonts(m):
            url = m.group(2)
            if "display=" in url: return m.group(0)
            cnt["fonts"] += 1
            return m.group(1) + url + ("&" if "?" in url else "?") + "display=swap" + m.group(3)
        new = re.sub(r'(href\s*=\s*["\'])(https://fonts\.googleapis\.com/css[^"\']*)(["\'])', fonts, new, flags=re.I)

        def anchor(m):
            tag = m.group(0)
            hm = re.search(r'href\s*=\s*(["\'])(.*?)\1', tag, re.I | re.S)
            if not hm: return tag
            href = hm.group(2)
            wm = re.match(r"(?i)^(?:https?:)?//(?:www\.)?wa\.me/([^?#]*)(?:\?(.*))?$", href.strip())
            if wm:
                raw_num = urllib.parse.unquote(wm.group(1))
                if not re.search(r"[A-Za-z]", raw_num):  # placeholders like XXXX are left for a human
                    d = digits(raw_num)
                    if len(d) == 10: d = self.cc + d
                    if 8 <= len(d) <= 15:
                        q = urllib.parse.parse_qs(wm.group(2) or "", keep_blank_values=True)
                        enc = urllib.parse.urlencode([(k, v) for k, vs in q.items() for v in vs], quote_via=urllib.parse.quote)
                        nh = f"https://wa.me/{d}" + ("?" + enc if enc else "")
                        if nh != href:
                            q0 = hm.group(1)
                            tag = tag.replace(hm.group(0), f"href={q0}{nh}{q0}", 1); cnt["wa"] += 1; href = nh
            pu = urllib.parse.urlparse(href)
            ext = href.startswith(("http://", "https://", "//")) and pu.netloc.replace("www.", "") != self.host
            if ext and re.search(r'target\s*=\s*["\']_blank["\']', tag, re.I):
                rm = re.search(r'\brel\s*=\s*(["\'])(.*?)\1', tag, re.I)
                if rm:
                    if not re.search(r"noopener|noreferrer", rm.group(2), re.I):
                        tag = tag.replace(rm.group(0), f"rel={rm.group(1)}{rm.group(2)} noopener noreferrer{rm.group(1)}", 1); cnt["rel"] += 1
                elif tag.endswith(">") and not tag.endswith("/>"):
                    tag = tag[:-1] + ' rel="noopener noreferrer">'; cnt["rel"] += 1
            return tag
        new = re.sub(r"<a\b[^>]*>", anchor, new, flags=re.I)

        # mobile: pinch-zoom, phone/email keyboards, lazy-loading
        def viewport(m):
            tag = m.group(0)
            if not re.search(r'name\s*=\s*["\']viewport["\']', tag, re.I): return tag
            t = re.sub(r"[,;]?\s*(user-scalable\s*=\s*(no|0)|maximum-scale\s*=\s*[0-4](\.\d+)?)", "", tag, flags=re.I)
            t = re.sub(r'content\s*=\s*(["\'])\s*[,;]\s*', r"content=\1", t, flags=re.I)
            if t != tag: cnt["zoom"] += 1
            return t
        new = re.sub(r"<meta\b[^>]*>", viewport, new, flags=re.I)

        def field(m):
            tag = m.group(0)
            tm = re.search(r'\btype\s*=\s*(["\'])(.*?)\1', tag, re.I)
            if tm and tm.group(2).lower() != "text": return tag
            hint = " ".join(re.findall(r'\b(?:name|id|placeholder|aria-label)\s*=\s*["\'](.*?)["\']', tag, re.I)).lower()
            kind = "tel" if re.search(r"phone|mobile|whatsapp|contact[ _-]?no", hint) else "email" if re.search(r"e-?mail", hint) else None
            if not kind: return tag
            if tm: tag = tag.replace(tm.group(0), f'type="{kind}"', 1)
            else: tag = re.sub(r"<input\b", f'<input type="{kind}"', tag, count=1, flags=re.I)
            if "autocomplete" not in tag.lower(): tag = re.sub(r"<input\b", f'<input autocomplete="{kind}"', tag, count=1, flags=re.I)
            cnt["field"] += 1
            return tag
        new = re.sub(r"<input\b[^>]*>", field, new, flags=re.I)

        seen_img = [0]
        def lazy(m):
            tag = m.group(0); seen_img[0] += 1
            if seen_img[0] == 1 or re.search(r"\bloading\s*=", tag, re.I) or not re.search(r"\bsrc\s*=", tag, re.I): return tag
            cnt["lazy"] += 1
            return re.sub(r"<img\b", '<img loading="lazy" decoding="async"', tag, count=1, flags=re.I)
        new = re.sub(r"<img\b[^>]*>", lazy, new, flags=re.I)

        if cnt["zoom"]: L("re-enabled pinch-zoom in viewport meta")
        if cnt["field"]: L(f"set type=tel / type=email (+autocomplete) on {cnt['field']} form field(s)")
        if cnt["lazy"]: L(f'added loading="lazy" decoding="async" to {cnt["lazy"]} below-the-fold image(s) (first image left eager for LCP)')
        if cnt["mixed"]: L(f"http:// -> https:// on {cnt['mixed']} resource URL(s) (check they load over https)")
        if cnt["fonts"]: L(f"added display=swap to {cnt['fonts']} Google Fonts URL(s)")
        if cnt["wa"]: L(f"normalised {cnt['wa']} wa.me link(s) (digits-only number, URL-encoded text)")
        if cnt["rel"]: L(f"added rel=noopener noreferrer to {cnt['rel']} external target=_blank link(s)")

        # --- <html lang>
        if not pp.lang and re.search(r"<html\b", new, re.I):
            new = re.sub(r"<html\b(?![^>]*\blang\s*=)", f'<html lang="{self.lang}"', new, count=1, flags=re.I)
            L(f'added lang="{self.lang}"')

        # --- <head> injections
        early, late = [], []
        if not pp.charset: early.append('<meta charset="utf-8">'); L("added meta charset")
        if pp.meta("viewport") is None:
            early.append('<meta name="viewport" content="width=device-width, initial-scale=1">'); L("added viewport meta")
        if not pp.link_rel("icon") and self.src.info("/favicon.ico")["status"] == 200:
            late.append('<link rel="icon" href="/favicon.ico">'); L("added favicon link")
        if self.domain_ok and not is404:
            cu = self.canon_url(key)
            canon = pp.link_rel("canonical")
            if not canon:
                late.append(f'<link rel="canonical" href="{cu}">'); L(f"added canonical {cu}")
            else:
                ch = canon[0].get("href", ""); pu = urllib.parse.urlparse(ch); fixed = None
                if not ch.startswith("http"): fixed = urllib.parse.urljoin(cu, ch)
                elif pu.netloc.replace("www.", "") != self.host: fixed = self.domain + pu.path + ("?" + pu.query if pu.query else "")
                if fixed:
                    repl = f'<link rel="canonical" href="{fixed}">'
                    new, k = re.subn(r"<link\b[^>]*rel\s*=\s*[\"']canonical[\"'][^>]*>", lambda m: repl, new, count=1, flags=re.I)
                    if k: L(f"canonical -> {fixed}")
            img = self.cfg.get("og_image", "")
            if img and not img.startswith("http") and self.src.info(img if img.startswith("/") else "/" + img)["status"] != 200:
                L(f"og_image '{img}' from config does not exist in the folder - og:image not added"); img = ""
            vals ={"og:title": pp.title.strip(), "og:description": (pp.meta("description") or "").strip(), "og:url": cu,
                    "og:image": urllib.parse.urljoin(self.domain + "/", img) if img else ""}
            added = [k for k, v in vals.items() if v and not pp.meta(k)]
            for k in added: late.append(f'<meta property="{k}" content="{htmllib.escape(vals[k], quote=True)}">')
            if added and not pp.meta("og:type"): late.append('<meta property="og:type" content="website">')
            if added: L("added " + ", ".join(added))
            c = self.cfg
            if norm(key) == "/" and not pp.jsonld and c.get("business_name"):
                ld = {"@context": "https://schema.org", "@type": c.get("schema_type", "LocalBusiness"),
                      "name": c["business_name"], "url": self.domain + "/"}
                if c.get("phones"): ld["telephone"] = c["phones"][0]
                if c.get("email"): ld["email"] = c["email"]
                if c.get("address_parts") or c.get("city"):
                    ad = {"@type": "PostalAddress"}
                    if c.get("address_parts"): ad["streetAddress"] = ", ".join(c["address_parts"])
                    if c.get("city"): ad["addressLocality"] = c["city"]
                    ld["address"] = ad
                if img: ld["image"] = urllib.parse.urljoin(self.domain + "/", img)
                late.append('<script type="application/ld+json">' + json.dumps(ld, ensure_ascii=False) + "</script>")
                L(f"added {ld['@type']} JSON-LD from config (review the address fields)")
        ho = re.search(r"<head\b[^>]*>", new, re.I)
        if (early or late) and not ho:
            L("no <head> found - could not inject the tags above")
        elif ho:
            if early: new = new[: ho.end()] + "\n" + "\n".join(early) + new[ho.end():]
            hc = re.search(r"</head\s*>", new, re.I)
            if late and hc: new = new[: hc.start()] + "\n".join(late) + "\n" + new[hc.start():]

        if new != raw and not self.dry:
            p = self.src._resolve(page)[0]
            dest = self.backup / p.relative_to(self.src.root)
            dest.parent.mkdir(parents=True, exist_ok=True); shutil.copy2(p, dest)
            p.write_text(new, "utf-8")


def render_fixes(log, dry):
    by = defaultdict(list)
    for page, msg in log: by[page].append(msg)
    lines = ["\n" + ("DRY RUN - would apply:" if dry else "AUTO-FIXES APPLIED:") + "\n" + "=" * 60]
    for page, msgs in by.items():
        lines.append(page)
        lines += [f"    + {m}" for m in msgs]
    if not dry and any(p != "(site)" and not m.startswith(("og_image", "no <head>")) for p, m in log):
        lines.append("\nOriginals backed up in ./.audit-backup/ - review with git diff or the backup copies.")
    return "\n".join(lines)


# ----------------------------------------------------------------------------- output
ORDER = {"FAIL": 0, "WARN": 1, "INFO": 2}
COL = {"FAIL": "\033[91m", "WARN": "\033[93m", "INFO": "\033[96m"}


def render(rep, src_label, color, limit=None):
    groups = defaultdict(list)
    for sev, code, page, msg in rep.items: groups[(sev, code)].append((page, msg))
    lines = []
    for (sev, code) in sorted(groups, key=lambda k: (ORDER[k[0]], k[1])):
        items = groups[(sev, code)]
        c0, c1 = (COL[sev], "\033[0m") if color else ("", "")
        lines.append(f"{c0}[{sev}] {code}{c1} - {len(items)} hit(s)")
        shown = items if limit is None else items[:limit]
        for page, msg in shown: lines.append(f"    {page}: {msg}")
        if limit and len(items) > limit: lines.append(f"    ... +{len(items) - limit} more (see report file)")
    mob = [i for i in rep.items if i[1] in MOBILE_CODES and i[0] != "INFO"]
    mf, mw = sum(1 for i in mob if i[0] == "FAIL"), sum(1 for i in mob if i[0] == "WARN")
    if mf: banner = f"MOBILE: NOT READY - {mf} blocker(s), {mw} warning(s). Most visitors are on phones: fix these first."
    elif mw: banner = f"MOBILE: OK with {mw} warning(s) - worth fixing before launch."
    else: banner = "MOBILE: static checks clean."
    banner += "\n(Static checks only - run mobile_check.py to test real rendering: overflow, tap targets, LCP.)"
    head = f"\n{banner}\n\nAudit of {src_label}\n" + "=" * 60
    foot = f"\nFAIL: {rep.count('FAIL')}   WARN: {rep.count('WARN')}   INFO: {rep.count('INFO')}"
    verdict = "READY TO SHIP" if rep.count("FAIL") == 0 else "NOT READY - fix the FAILs"
    return head + "\n" + "\n".join(lines) + "\n" + "=" * 60 + foot + "\n" + verdict


def gen_seo(src, cfg, pages):
    root = src.root
    dom = cfg.get("domain", "").rstrip("/")
    if not dom or "example.com" in dom:
        print("--gen-seo needs a real 'domain' in the config"); return
    urls = []
    for p in pages:
        pp = PageParser(); pp.feed(src.html(p))
        if "noindex" in (pp.meta("robots") or "").lower() or "404" in p: continue
        k = norm(src.info(p)["key"]); urls.append(dom + ("" if k == "/" else k) + ("/" if k == "/" else ""))
    sm = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
    sm += "".join(f"  <url><loc>{u}</loc></url>\n" for u in urls) + "</urlset>\n"
    (root / "sitemap.xml").write_text(sm)
    if not (root / "robots.txt").exists():
        (root / "robots.txt").write_text(f"User-agent: *\nAllow: /\n\nSitemap: {dom}/sitemap.xml\n")
    print(f"Wrote sitemap.xml ({len(urls)} URLs) and robots.txt in {root}")


TEMPLATE = {
    "business_name": "Business Name As Public", "domain": "https://www.example.com", "city": "Hyderabad",
    "phones": ["+91 90000 00000"], "whatsapp": "919000000000", "email": "hello@example.com",
    "address_parts": ["Madhapur", "Hyderabad"], "require_whatsapp": True,
    "forbidden_text": [], "ignore": [],
    "lang": "en", "og_image": "", "country_code": "91", "schema_type": "LocalBusiness",
}


def main():
    ap = argparse.ArgumentParser(description="Pre-launch website audit")
    ap.add_argument("folder", nargs="?", help="static site folder")
    ap.add_argument("--url", help="audit a live site instead of a folder")
    ap.add_argument("--crawl", type=int, default=25, help="max pages to crawl in --url mode")
    ap.add_argument("--config", help="client config JSON (NAP, WhatsApp, domain)")
    ap.add_argument("--external", action="store_true", help="also check external links (slow)")
    ap.add_argument("--strict", action="store_true", help="exit 1 on WARN too")
    ap.add_argument("--report", default="audit_report.md", help="markdown report path ('' to skip)")
    ap.add_argument("--fix", action="store_true", help="apply safe auto-fixes (folder mode), then re-audit")
    ap.add_argument("--dry-run", action="store_true", help="preview the auto-fixes without writing")
    ap.add_argument("--init-config", action="store_true", help="write client.config.json template")
    ap.add_argument("--gen-seo", action="store_true", help="generate sitemap.xml/robots.txt (folder mode)")
    args = ap.parse_args()

    if args.init_config:
        Path("client.config.json").write_text(json.dumps(TEMPLATE, indent=2)); print("Wrote client.config.json"); return 0
    cfg = json.loads(Path(args.config).read_text()) if args.config else {}
    if args.url: src, label = WebSource(args.url, args.crawl), args.url
    elif args.folder:
        if not Path(args.folder).is_dir(): print("Folder not found"); return 2
        src, label = LocalSource(args.folder), args.folder
    else: ap.print_help(); return 2
    if args.gen_seo and src.kind == "local": gen_seo(src, cfg, src.pages())
    if args.fix or args.dry_run:
        if src.kind != "local": print("--fix works on a folder (edit the source), not on --url"); return 2
        print(render_fixes(Fixer(src, cfg, dry=args.dry_run).run(), args.dry_run))
        print("\nRemaining issues" + (" (state before fixes)" if args.dry_run else " after fixes") + " - these need a human:")
    rep = Auditor(src, cfg, args.external).run()
    print(render(rep, label, sys.stdout.isatty(), limit=8))
    if args.report:
        Path(args.report).write_text("# Pre-launch audit\n\n```\n" + render(rep, label, False) + "\n```\n"); print(f"Full report: {args.report}")
    return 1 if rep.count("FAIL") or (args.strict and rep.count("WARN")) else 0


if __name__ == "__main__":
    sys.exit(main())
