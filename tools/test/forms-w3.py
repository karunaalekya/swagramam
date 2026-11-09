# Web3Forms form tests (request mocked). Run: python3 tools/test/forms-w3.py
import json, subprocess, time, sys
from playwright.sync_api import sync_playwright
srv = subprocess.Popen(["python3","-m","http.server","8765"],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL); time.sleep(1)
B="http://localhost:8765/"; fails=[]
def chk(n,c):
    print(("PASS " if c else "FAIL ")+n); 
    if not c: fails.append(n)
def run(pw,mode,fn):
    br=pw.chromium.launch(); pg=br.new_page(viewport={"width":390,"height":800}); calls=[]
    def h(r):
        calls.append(json.loads(r.request.post_data))
        if mode=="ok": r.fulfill(status=200,content_type="application/json",body='{"success":true}')
        else: r.fulfill(status=500,content_type="application/json",body='{"success":false}')
    pg.route("https://api.web3forms.com/**",h); pg.add_init_script("sessionStorage.sxSeen=1;try{localStorage.setItem('x','1')}catch(e){}")
    fn(pg,calls); br.close()
def catering(pg,calls,mode):
    pg.goto(B+"catering.html"); pg.wait_for_timeout(600)
    pg.check("input[name=Event][value=Birthday]",force=True)
    pg.fill("#f-name","Ravi"); pg.fill("#f-phone","9876543210"); pg.fill("#f-date","2027-01-15"); pg.fill("#f-guests","50")
    return
with sync_playwright() as pw:
    def t_ok(pg,calls):
        catering(pg,calls,"ok"); pg.click(".ch-btn"); pg.wait_for_timeout(800)
        chk("catering success shows thanks",pg.is_visible(".ch-ok"))
        chk("catering one request",len(calls)==1)
        chk("catering subject","[Swagramam] Catering enquiry – Birthday – 15 Jan 2027"==calls[0]["subject"])
        chk("catering from_name",calls[0]["from_name"]=="Swagramam website")
        c=calls[0]
        chk("catering readable fields",c["Name"]=="Ravi" and c["Event type"]=="Birthday" and c["Number of guests"]=="50")
        chk("catering date format",c["Event date"]=="15 Jan 2027")
        chk("catering call+wa links",c["Call"]=="tel:+919876543210" and c["WhatsApp"]=="https://wa.me/919876543210" and c["Phone"]=="+91 9876543210")
        chk("catering submitted from","catering.html" in c["Submitted from"])
        chk("catering key placeholder sent",calls[0]["access_key"]=="__WEB3FORMS_KEY__")
    run(pw,"ok",t_ok)
    def t_blank(pg,calls):
        pg.goto(B+"catering.html"); pg.wait_for_timeout(600)
        pg.fill("#f-name","Ravi"); pg.fill("#f-phone","9876543210"); pg.fill("#f-guests","50")
        pg.click(".ch-btn"); pg.wait_for_timeout(800)
        chk("subject fallback",len(calls)==1 and calls[0]["subject"]=="[Swagramam] Catering enquiry – Enquiry – date not given")
    run(pw,"ok",t_blank)
    def t_err(pg,calls):
        catering(pg,calls,"err"); pg.click(".ch-btn"); pg.wait_for_timeout(800)
        chk("catering error msg+WA link",pg.is_visible(".ch-fail") and "wa.me/" in pg.get_attribute(".ch-fail a","href"))
        chk("catering button re-enabled",pg.is_enabled(".ch-btn")); chk("catering form still shown",pg.is_visible(".ch-form"))
    run(pw,"err",t_err)
    def t_bot(pg,calls):
        catering(pg,calls,"ok"); pg.evaluate("document.querySelector('.ch-hp').checked=true"); pg.click(".ch-btn"); pg.wait_for_timeout(500)
        chk("catering honeypot = no send",len(calls)==0)
    run(pw,"ok",t_bot)
    def cform(pg):
        pg.goto(B+"index.html"); pg.wait_for_timeout(800)
        pg.evaluate("document.querySelector('.ctd').open=true")
        f="form[data-endpoint]"; pg.fill(f+" [name=Name]","Asha"); pg.fill(f+" [name=Phone]","9000000000"); pg.fill(f+" [name=Message]","Table for 6")
    def c_ok(pg,calls):
        cform(pg); pg.click("form[data-endpoint] button[type=submit]"); pg.wait_for_timeout(800)
        chk("contact subject",calls[0]["subject"]=="[Swagramam] Contact – Asha")
        c=calls[0]
        chk("contact readable fields+links",c["Name"]=="Asha" and c["Message"]=="Table for 6" and c["Call"]=="tel:+919000000000" and c["WhatsApp"]=="https://wa.me/919000000000" and "index.html" in c["Submitted from"])
        chk("contact success text","Thank you" in pg.inner_text("form[data-endpoint] .fm"))
    run(pw,"ok",c_ok)
    def c_err(pg,calls):
        cform(pg); pg.click("form[data-endpoint] button[type=submit]"); pg.wait_for_timeout(800)
        chk("contact error + WA link",pg.is_visible("form[data-endpoint] .fm a[href*='wa.me']"))
    run(pw,"err",c_err)
    def c_bot(pg,calls):
        cform(pg); pg.evaluate("document.querySelector('form[data-endpoint] [name=botcheck]').checked=true"); pg.click("form[data-endpoint] button[type=submit]"); pg.wait_for_timeout(500)
        chk("contact honeypot = no send",len(calls)==0)
    run(pw,"ok",c_bot)
    for w in (360,390,1440):
        for pgname in ("catering.html","index.html"):
            br=pw.chromium.launch(); pg=br.new_page(viewport={"width":w,"height":800}); pg.add_init_script("sessionStorage.sxSeen=1")
            pg.goto(B+pgname); pg.wait_for_timeout(900)
            chk(f"no sideways scroll {pgname} {w}",pg.evaluate("document.documentElement.scrollWidth<=innerWidth"))
            br.close()
srv.terminate(); print("FAILS:",fails); sys.exit(1 if fails else 0)
