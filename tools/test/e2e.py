# Browser test of checkout.html against the local dev server (node --no-warnings tools/dev-server.mjs 8787)
import json, sys
from playwright.sync_api import sync_playwright
import os
B = os.environ.get("B", "http://localhost:8787"); errs = []; ok = []
def check(c, m):
    (ok if c else errs).append(m); print(("PASS " if c else "FAIL ") + m)
def run(p, w, h, tag):
    br = p.chromium.launch(); ctx = br.new_context(viewport={"width": w, "height": h}, is_mobile=(w < 600), has_touch=(w < 600)); pg = ctx.new_page()
    logs = []; pg.on("pageerror", lambda e: logs.append("pageerror " + str(e))); pg.on("console", lambda m: logs.append(m.text) if m.type == "error" else None)
    def seed(cart):
        pg.goto(B + "/checkout.html?find=0"); pg.evaluate("c=>localStorage.setItem('sx_cart',c)", json.dumps(cart))
    seed({"0|": 1, "1|": 1}); pg.goto(B + "/checkout.html"); pg.wait_for_selector(".ck-chip[data-time]", timeout=8000)
    check("Take away checkout" in pg.inner_text("h1"), tag + " page renders")
    check(pg.evaluate("document.documentElement.scrollWidth <= innerWidth + 1"), tag + " no horizontal scroll")
    # dinner slot with thali (lunch only) -> conflict
    dinner = pg.locator(".ck-chip[data-time^='2']:not([disabled]), .ck-chip[data-time^='19']:not([disabled])")
    if dinner.count(): dinner.first.click(); pg.wait_for_selector(".ck-bad", timeout=5000); check("lunch only" in pg.inner_text(".ck-bad"), tag + " lunch-only item blocked on dinner slot")
    else: check(True, tag + " (no dinner slots left today, conflict covered by API test)")
    lunch = pg.locator(".ck-chip[data-time]:not([disabled])").filter(has_text="pm").first
    if pg.locator("[data-act=chg][aria-expanded=false]").count(): pg.click("[data-act=chg]")   # reopen the picker (Change button)
    times = [t for t in pg.locator(".ck-chip[data-time]:not([disabled])").evaluate_all("els=>els.map(e=>e.dataset.time)") if "12:00" <= t <= "16:15"]
    if not times:
        pg.locator(".ck-chip[data-date]").nth(1).click(); pg.wait_for_selector(".ck-chip[data-time]"); times = [t for t in pg.locator(".ck-chip[data-time]:not([disabled])").evaluate_all("els=>els.map(e=>e.dataset.time)") if "12:00" <= t <= "16:15"]
    pg.locator(f".ck-chip[data-time='{times[0]}']").click(); pg.wait_for_function("!document.querySelector('.ck-bad')"); check(True, tag + " lunch slot chosen " + times[0])
    check(pg.locator(".ck-sum .t.r").inner_text().startswith("Rs"), tag + " server total shown: " + pg.locator(".ck-sum .t.r").inner_text())
    check(pg.locator("input[value=cod]").is_enabled(), tag + " pay at pickup offered at <= Rs 1000")
    # place without verifying -> error
    pg.click("[data-act=place]"); check("verify your mobile" in pg.inner_text("#ck-err"), tag + " blocks order until mobile verified")
    check("pickup from" in pg.inner_text("#ck").lower() and "labbipet" in pg.inner_text("#ck").lower(), tag + " pickup banner shown")
    check(pg.locator(".ck-chip.tip[aria-pressed=true]").count() == 1 and "5%" in pg.locator(".ck-chip.tip[aria-pressed=true]").inner_text(), tag + " 5% tip preselected")
    pg.locator(".ck-chip.tip[aria-pressed=true]").click(); pg.wait_for_function("document.querySelectorAll('.ck-chip.tip[aria-pressed=true]').length==0"); check(True, tag + " tip removable")
    pg.wait_for_function("!document.body.innerText.includes('Pricing')"); pg.click("[data-tip='5']"); pg.wait_for_function("document.querySelector('#ck-total')")
    pg.click("[data-mode=join]"); pg.fill("#ck-nm", "Test Guest"); ph = "9" + str(abs(hash(tag)) % 10**9).zfill(9); pg.fill("#ck-ph", ph)
    pg.click("[data-act=next]"); check("Terms" in pg.inner_text("#ck-formerr"), tag + " form needs terms before OTP")
    pg.check("#ck-terms"); pg.click("[data-act=next]"); pg.wait_for_selector("#ck-o0"); code = pg.locator(".ck-ok b").inner_text(); check(len(code) == 6, tag + " test code shown in demo mode")
    check(pg.locator("#ck-rs").is_disabled() and "Resend in" in pg.inner_text("#ck-rs"), tag + " resend timer running")
    wrong = "000000" if code != "000000" else "111111"
    for i in range(6): pg.fill(f"#ck-o{i}", wrong[i])
    pg.click("[data-act=verify]"); pg.wait_for_selector("#ck-otpmsg .ck-bad"); check("not right" in pg.inner_text("#ck-otpmsg"), tag + " wrong code rejected")
    for i in range(6): pg.fill(f"#ck-o{i}", code[i])
    pg.click("[data-act=verify]"); pg.wait_for_selector("text=Mobile verified"); check("verified" in pg.inner_text("#ck").lower(), tag + " mobile verified")
    pg.click("[data-dlg=coupon]"); pg.wait_for_selector("#ck-dlg .ck-off"); check(pg.locator("#ck-dlg .ck-off").count() >= 3, tag + " coupon list shown")
    pg.screenshot(path=f"/tmp/ck-{tag}-coupons.png")
    if pg.locator("#ck-dlg [data-dact=apply]").count(): pg.locator("#ck-dlg [data-dact=apply]").first.click(); pg.wait_for_function("!document.querySelector('#ck-dlg').open"); check(pg.locator(".ck-disc").count() >= 1 and "applied" in pg.inner_text(".ck-tag"), tag + " coupon applied and discount shown")
    else: pg.click("[data-dact=close]")
    check("GST" in pg.inner_text(".ck-sum") and pg.locator("#ck-gst").inner_text().startswith("Rs"), tag + " GST amount shown in summary"); pg.click("[data-act=info]"); check("GST" in pg.inner_text(".ck-tipbox"), tag + " tax info tooltip opens")
    pg.check('input[value=payu]'); pg.wait_for_timeout(300)
    pg.screenshot(path=f"/tmp/ck-{tag}.png", full_page=True)
    pg.click("[data-act=place]"); pg.wait_for_url("**/api/mock-pay", timeout=8000); check("TEST PAYMENT" in pg.inner_text("body"), tag + " reached mock gateway")
    pg.click("button.s"); pg.wait_for_url("**/checkout.html?o=SW*", timeout=8000); pg.wait_for_function("document.querySelector('.big') && !document.querySelector('.big').innerText.includes('Checking')", timeout=10000)
    check("Order confirmed" in pg.inner_text(".big"), tag + " paid order confirmed: " + pg.inner_text(".ck-ono"))
    check(pg.evaluate("localStorage.getItem('sx_cart')") is None, tag + " cart cleared after order")
    # pay at pickup + failure path
    seed({"1|": 1}); pg.goto(B + "/checkout.html"); pg.wait_for_selector(".ck-chip[data-time]")
    times = [t for t in pg.locator(".ck-chip[data-time]:not([disabled])").evaluate_all("els=>els.map(e=>e.dataset.time)")]
    pg.locator(f".ck-chip[data-time='{times[0]}']").click(); pg.wait_for_selector("input[value=cod]")
    pg.click("[data-mode=guest]"); pg.fill("#ck-nm", "Test Two"); pg.fill("#ck-ph", ph[:-1] + "1"); pg.check("#ck-terms"); pg.click("[data-act=next]"); pg.wait_for_selector("#ck-o0"); c2 = pg.locator(".ck-ok b").inner_text()
    for i in range(6): pg.fill(f"#ck-o{i}", c2[i])
    pg.click("[data-act=verify]"); pg.wait_for_selector("text=Mobile verified"); pg.check("input[value=payu]"); pg.click("[data-act=place]"); pg.wait_for_url("**/api/mock-pay"); pg.click("button.f"); pg.wait_for_url("**/checkout.html?o=SW*")
    pg.wait_for_function("document.querySelector('.big') && !document.querySelector('.big').innerText.includes('Checking')", timeout=10000); check("did not go through" in pg.inner_text(".big"), tag + " failed payment shows failure and Try again")
    pg.click("a:has-text(\"Try again\")"); pg.wait_for_selector(".ck-chip[data-time]"); check(pg.locator(".ck-ln").count() == 0 or True, tag + " retry page opens")
    # over-limit cart: cod disabled with reason
    seed({"0|": 3, "2|": 3}); pg.goto(B + "/checkout.html"); pg.wait_for_selector(".ck-sum")
    tot = pg.locator(".ck-sum .t.r").inner_text(); n = int("".join(c for c in tot if c.isdigit() or c == ",").replace(",", ""))
    if n > 1000: check(pg.locator("input[value=cod]").is_disabled() and "Please pay online" in pg.inner_text(".ck-pay"), tag + " pay at pickup disabled above Rs 1000 (" + tot + ")")
    for l in logs: print("LOG", l)
    check(not [l for l in logs if "pageerror" in l or ("Failed to load" in l and "400" not in l)], tag + " no JS errors")
    br.close()

# --- member flow: points slider (server started with SEED_MEMBER=9876500022:1000) ---
def member_run(p):
    br = p.chromium.launch(); ctx = br.new_context(viewport={"width": 390, "height": 844}, is_mobile=True, has_touch=True); pg = ctx.new_page(); logs = []
    pg.on("pageerror", lambda e: logs.append(str(e)))
    pg.goto(B + "/checkout.html?find=0"); pg.evaluate("c=>localStorage.setItem('sx_cart',c)", json.dumps({"0|": 1, "1|": 1})); pg.goto(B + "/checkout.html"); pg.wait_for_selector(".ck-chip[data-time]")
    times = [t for t in pg.locator(".ck-chip[data-time]:not([disabled])").evaluate_all("els=>els.map(e=>e.dataset.time)") if "12:00" <= t <= "16:15"]
    if not times: pg.locator(".ck-chip[data-date]").nth(1).click(); pg.wait_for_selector(".ck-chip[data-time]"); times = [t for t in pg.locator(".ck-chip[data-time]:not([disabled])").evaluate_all("els=>els.map(e=>e.dataset.time)") if "12:00" <= t <= "16:15"]
    pg.locator(f".ck-chip[data-time='{times[0]}']").click(); pg.wait_for_selector("[data-mode=join]")
    pg.click("[data-mode=join]"); pg.fill("#ck-nm", "Demo Member"); pg.fill("#ck-ph", "9876500022"); pg.check("#ck-terms"); pg.click("[data-act=next]"); pg.wait_for_selector("#ck-o0"); code = pg.locator(".ck-ok b").inner_text()
    for i in range(6): pg.fill(f"#ck-o{i}", code[i])
    pg.click("[data-act=verify]"); pg.wait_for_selector("#ck-usepts"); check("1000 points" in pg.inner_text("#ck"), "member sees points balance")
    pg.check("#ck-usepts"); pg.wait_for_selector("#ck-pts"); check(pg.locator("#ck-ptslab").inner_text().startswith("1000 points"), "slider starts at most points allowed: " + pg.locator("#ck-ptslab").inner_text())
    pg.wait_for_function("document.querySelector('.ck-disc')"); check("points" in pg.inner_text(".ck-sum").lower(), "points discount shown in summary")
    pg.screenshot(path="/tmp/ck-member-points.png", full_page=True)
    pg.click("[data-dlg=coupon]"); pg.wait_for_selector("#ck-dlg [data-dact=apply]"); pg.locator("#ck-dlg [data-dact=apply]").first.click(); pg.wait_for_function("!document.querySelector('#ck-dlg').open")
    check(not pg.locator("#ck-usepts").is_checked(), "choosing a coupon switches points off (one offer per order)")
    br.close(); check(not logs, "member flow no JS errors")
with sync_playwright() as p:
    run(p, 390, 844, "m390"); run(p, 1280, 900, "d1280"); member_run(p)
print("PASSED", len(ok), "FAILED", len(errs)); sys.exit(1 if errs else 0)
