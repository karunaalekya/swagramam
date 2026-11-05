# Browser test of board.html against the local dev server:
#   TEST_NOW_MS=<a morning time> BOARD_PIN=246810 node --no-warnings tools/dev-server.mjs 8787   then   python3 tools/test/board-e2e.py
import json, os, sys, urllib.request
from playwright.sync_api import sync_playwright
B = os.environ.get("B", "http://localhost:8787"); PIN = os.environ.get("BOARD_PIN", "246810"); ok, errs = [], []
def check(c, m): (ok if c else errs).append(m); print(("PASS " if c else "FAIL ") + m)
def api(path, body):
    r = urllib.request.Request(B + path, data=json.dumps(body).encode(), headers={"content-type": "application/json"}, method="POST")
    with urllib.request.urlopen(r) as x: return json.loads(x.read())
def get(path):
    with urllib.request.urlopen(B + path) as x: return json.loads(x.read())
menu = get("/api/menu"); items = menu.get("items") or menu.get("menu") or []
soup = next(i for i in items if i["name"] == "Munakkaada Vadiyalu Charu")
def place(phone, name, note=""):
    s = api("/api/otp/send", {"phone": phone}); v = api("/api/otp/verify", {"phone": phone, "code": s["devCode"]})
    sl = get("/api/slots"); t = next(x for x in sl["slots"] if not x.get("full"))
    r = api("/api/checkout/start", {"token": v["token"], "lines": [{"sku": soup["sku"], "qty": 2, "note": "less spicy"}], "slot": {"date": sl["date"], "time": t["time"]}, "method": "cod", "name": name, "note": note, "consent": {"terms": True, "marketing": False}})
    assert r.get("ok"), r; return r["orderId"]
with sync_playwright() as p:
    br = p.chromium.launch()
    for w, h, tag in [(390, 844, "m390"), (1280, 800, "d1280")]:
        ctx = br.new_context(viewport={"width": w, "height": h}, is_mobile=w < 600, has_touch=w < 600); pg = ctx.new_page(); logs = []
        pg.on("pageerror", lambda e: logs.append(str(e))); pg.on("console", lambda m: logs.append(m.text) if m.type == "error" and "401" not in m.text and "Failed to load" not in m.text else None)
        pg.add_init_script("window.print = () => { window.__printed = document.getElementById('ticket').innerText }")
        pg.goto(B + "/board.html"); pg.wait_for_selector("#pin")
        pg.fill("#pin", "000000"); pg.click("#lf button"); pg.wait_for_function("document.querySelector('#lerr').textContent.length > 0")
        check("not right" in pg.inner_text("#lerr"), tag + " wrong PIN refused")
        pg.fill("#pin", PIN); pg.click("#lf button"); pg.wait_for_selector("#sum span")
        check(True, tag + " PIN opens the board")
        a = place("98765" + ("43" if w < 600 else "44") + "100", "Ravi", "Pack the curd separately")
        pg.click("#snd"); check(pg.get_attribute("#snd", "aria-pressed") == "true", tag + " sound turns on")
        pg.wait_for_selector("#o-" + a, timeout=15000); check(True, tag + " new order appears by itself (polling)")
        crd = pg.inner_text("#o-" + a)
        check("Ravi" in crd and "2 ×" in crd and "less spicy" in crd and "Pack the curd" in crd and "Collect Rs" in crd, tag + " card shows name, qty, item note, order note, amount to collect")
        check(pg.evaluate("document.documentElement.scrollWidth <= innerWidth + 1"), tag + " no sideways scroll")
        if w >= 1000: check(pg.evaluate("[...document.querySelectorAll('.col')].filter(c => c.offsetParent).length") == 4, tag + " 4 columns side by side")
        pg.click(f"#o-{a} [data-a=print]"); check("TO COLLECT" in (pg.evaluate("window.__printed") or ""), tag + " 80 mm ticket prints the order")
        pg.click(f"#o-{a} [data-a=accept]"); pg.wait_for_selector(f"#o-{a}[data-col=preparing]", state="attached"); check(True, tag + " accept moves it to Preparing")
        if w < 600: pg.click("[data-tab=preparing]")
        pg.click(f"#o-{a} [data-a=ready]"); pg.wait_for_selector(f"#o-{a}[data-col=ready]", state="attached")
        if w < 600: pg.click("[data-tab=ready]")
        pg.wait_for_selector(f"#o-{a} a.wa"); check("wa.me/91" in pg.get_attribute(f"#o-{a} a.wa", "href"), tag + " ready gives a WhatsApp message link for the customer")
        st = get("/api/order/status?id=" + a); check(st["stage"] == "ready", tag + " customer page now says ready")
        if w < 600: pg.screenshot(path="/tmp/board-m390-ready.png", full_page=True)
        pg.click(f"#o-{a} [data-a=collected]"); pg.wait_for_selector("#dlg[open]"); check("Collected Rs" in pg.inner_text("#dlg"), tag + " collecting cash asks to confirm the amount")
        pg.click("#dlg [data-ok]"); pg.wait_for_selector(f"#o-{a}[data-col=done]", state="attached"); check("Taken at counter" in pg.inner_text("#sum"), tag + " collected order moves to Done and the day totals update")
        b2 = place("98765" + ("43" if w < 600 else "44") + "200", "Sita")
        if w < 600: pg.click("[data-tab=new]")
        pg.wait_for_selector("#o-" + b2, timeout=15000); pg.click(f"#o-{b2} [data-a=reject]"); pg.wait_for_selector("#dlg[open] [data-r]")
        pg.click("#dlg [data-r='Item not available']"); pg.wait_for_selector(f"#o-{b2}[data-col=done]", state="attached"); check(get("/api/order/status?id=" + b2)["stage"] == "cancelled", tag + " reject with a reason cancels the order")
        if w >= 1000: pg.screenshot(path="/tmp/board-d1280.png")
        check(not logs, tag + " no JS errors " + "; ".join(logs[:2])); ctx.close()
    br.close()
print("PASSED", len(ok), "FAILED", len(errs)); sys.exit(1 if errs else 0)
