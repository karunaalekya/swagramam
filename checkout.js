/* Swagramam take away checkout (v97 phase 1+2). Talks to /api/* (Cloudflare Pages Functions).
   Prices, tip, discounts, tax, slots and the payment rule all come from the server. This page shows what the server returns and sends choices (tip %, coupon code, points), never amounts. */
(function () {
"use strict";
var $ = function (s, r) { return (r || document).querySelector(s); }, root = $("#ck"), dlg = $("#ck-dlg");
var WA = "https://wa.me/917659858999?text=" + encodeURIComponent("Hi Swagramam, I want to place a take away order.");
var OTP_LEN = 6;   // MSG91 code length: change here AND in the MSG91 template / backend check together
var S = { menu: null, byK: {}, bySku: {}, cart: {}, notes: {}, noteOpen: {}, date: null, time: null, slots: [], today: null, days: 7, q: null, token: null, phone: "", ver: null,
  mode: "join", method: null, join: false, busy: false, note: "", name: "", email: "", terms: false, mkt: false, otpSent: false, otp: "", otpMsg: null, dev: null, resendAt: 0,
  picker: false, tip: { pct: 5 }, tipOther: false, tipAmt: "", tipMsg: "", redeem: { coupon: null, freebie: null, points: 0 }, offers: null, offerMsg: "", dlgKind: null, dlgMsg: "", info: false, formErr: "" };
function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
function rs(m) { return "Rs " + (m / 100).toLocaleString("en-IN", { minimumFractionDigits: m % 100 ? 2 : 0 }); }
function store(k, v) { try { if (v === undefined) return localStorage.getItem("sx_" + k); if (v === null) localStorage.removeItem("sx_" + k); else localStorage.setItem("sx_" + k, v); } catch (e) { return null; } }
function api(path, body) {
  var o = body === undefined ? { cache: "no-store" } : { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) };
  return fetch(path, o).then(function (r) { return r.json().then(function (j) { j._status = r.status; return j; }, function () { return { ok: false, error: "server", message: "Something went wrong. Please try again." }; }); }, function () { return { ok: false, error: "network", message: "No connection. Please check your internet and try again." }; });
}
var dayName = function (d) { var p = d.split("-"), x = new Date(Date.UTC(+p[0], +p[1] - 1, +p[2])); return x.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }); };
var t12 = function (t) { var h = +t.slice(0, 2), m = t.slice(3); return (h % 12 || 12) + ":" + m + (h < 12 ? " am" : " pm"); };
var normPhone = function (p) { p = String(p || "").replace(/[\s\-()]/g, "").replace(/^(\+?91|0)(?=\d{10}$)/, ""); return /^[6-9]\d{9}$/.test(p) ? p : null; };

/* ---------- cart (same localStorage cart as the order popup; line notes kept separately) ---------- */
function loadCart() { S.cart = {}; try { var c = JSON.parse(store("cart") || "{}"); Object.keys(c).forEach(function (k) { var it = S.byK[k] || S.byK[k.split("|")[0] + "|"]; var q = Math.floor(+c[k]); if (it && q > 0) S.cart[it.sku] = Math.min(20, (S.cart[it.sku] || 0) + q); }); } catch (e) {} try { S.notes = JSON.parse(store("lnotes") || "{}") || {}; } catch (e) { S.notes = {}; } }
function saveCart() { var o = {}; Object.keys(S.cart).forEach(function (s) { o[S.bySku[s].k] = S.cart[s]; }); store("cart", JSON.stringify(o)); store("lnotes", JSON.stringify(S.notes)); }
function lines() { return Object.keys(S.cart).map(function (s) { var l = { sku: s, qty: S.cart[s] }; if (S.notes[s]) l.note = S.notes[s]; return l; }); }
function tipChoice() { if (S.tipOther) return S.tipAmt !== "" ? { amount: S.tipAmt } : null; return S.tip && S.tip.pct ? { pct: S.tip.pct } : null; }
function redeemChoice() { var r = {}; if (S.redeem.coupon) r.coupon = S.redeem.coupon; if (S.redeem.freebie) r.freebie = S.redeem.freebie; if (S.redeem.points) r.points = S.redeem.points; return Object.keys(r).length ? r : undefined; }
function payload() { return { lines: lines(), slot: S.date && S.time ? { date: S.date, time: S.time } : undefined, token: S.token || undefined, tip: tipChoice() || undefined, redeem: redeemChoice(), join: S.join || undefined }; }

/* ---------- server quote ---------- */
function requote(cb) {
  if (!lines().length) { S.q = null; return cb && cb(); }
  var my = ++requote.n; api("/api/quote", payload()).then(function (j) {
    if (my !== requote.n) return;
    if (!j.ok && j.error === "tip") { S.tipMsg = j.message; return cb && cb(); }   // keep the last good price on screen
    S.tipMsg = ""; S.q = j.ok ? j : { error: j.message || "Could not price your order." };
    if (j.ok) {
      S.offerMsg = j.offerError ? j.offerError.message : "";
      if (j.offerError) S.redeem = { coupon: null, freebie: null, points: 0 };   // the server priced it without the offer, so drop it here too
      if (S.method && j.methods.indexOf(S.method) < 0) S.method = null;
      if (!S.method) S.method = j.methods.indexOf("payu") >= 0 ? "payu" : j.methods[0];
    }
    cb && cb();
  });
}
requote.n = 0;
var qTimer; function requoteSoon() { clearTimeout(qTimer); qTimer = setTimeout(function () { requote(render); }, 450); }

/* ---------- slots ---------- */
function loadSlots(date, cb) { S.date = date; S.time = null; S.slots = []; api("/api/slots?date=" + date).then(function (j) { S.slots = j.ok ? j.slots : []; if (j.ok) { S.today = j.today; S.days = j.days; } cb && cb(); }); }
function dateList() { var out = [], p = S.today.split("-"), b = Date.UTC(+p[0], +p[1] - 1, +p[2]); for (var i = 0; i < 1; i++) {   /* takeaway: today only */ var d = new Date(b + i * 86400000); out.push(d.getUTCFullYear() + "-" + String(d.getUTCMonth() + 1).padStart(2, "0") + "-" + String(d.getUTCDate()).padStart(2, "0")); } return out; }

/* ---------- view pieces ---------- */
function secInfo() {
  var h = '<div class="ck-pk"><h2 id="h-info"><svg class="ck-pin" viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path fill="currentColor" d="M12 2a7 7 0 0 0-7 7c0 5.2 7 13 7 13s7-7.8 7-13a7 7 0 0 0-7-7zm0 9.5A2.5 2.5 0 1 1 12 6a2.5 2.5 0 0 1 0 5.5z"/></svg>Pickup details<span class="ck-pill">Today only</span></h2>';
  h += '<div class="ck-kv"><div><small>Pickup from</small><b>Swagramam, Labbipet</b><span class="ck-addr">Mogalrajapuram, Sidhartha Nagar, Vijayawada 520010</span></div></div>';
  h += secTime();
  var q = S.q; if (q && q.ok && q.conflicts.length) q.conflicts.forEach(function (c) { h += '<p class="ck-bad" role="alert">' + esc(c.reason) + ' <button type="button" class="ck-rm" data-rm="' + esc(c.sku) + '">Remove it</button></p>'; });
  return h + "</div>";
}
function termsBox() {
  return '<label class="ck-chk ck-terms"><input type="checkbox" id="ck-terms"' + (S.terms ? " checked" : "") + '><span>I agree to the <a href="terms.html" target="_blank" rel="noopener">Terms</a>, <a href="privacy.html" target="_blank" rel="noopener">Privacy Policy</a> and the <a href="rewards.html" target="_blank" rel="noopener">Village Club terms</a>. (Required)</span></label>';
}
function secIdentity() {
  var h = '<div class="ck-id">';
  if (S.token) {
    h += '<h2 id="h-id">Your details</h2><p class="ck-ok">Mobile verified: <b>+91 ' + esc(S.phone) + '</b> <button type="button" class="ck-rm" data-act="change">Change</button></p>' + rwSwipe("open");
    h += '<label class="ck-f" for="ck-nm">Name (optional)</label><input class="ck-in" id="ck-nm" autocomplete="name" maxlength="60" value="' + esc(S.name) + '">';
    if (!S.terms) h += termsBox();
  } else {
    h += '<h2 id="h-id">Your mobile number</h2>' + rwSwipe(S.otpSent ? (S.vbusy ? "verifying" : "otp") : "locked") + (S.otpSent && S.terms ? "" : termsBox());
    h += '<div class="ck-pair' + (S.otpSent ? " one" : "") + '"><div><label class="ck-f" for="ck-ph">Mobile number</label><div class="ck-row"><input class="ck-in" id="ck-ph" type="tel" inputmode="numeric" autocomplete="tel-national" maxlength="14" placeholder="10-digit mobile" value="' + esc(S.phone) + '"' + (S.otpSent ? " readonly" : "") + '>' + (S.otpSent ? '<button type="button" class="ck-btn" data-act="editphone">Edit</button>' : "") + "</div></div>";
    if (!S.otpSent) h += '<div><label class="ck-f" for="ck-nm">Name (optional)</label><input class="ck-in" id="ck-nm" autocomplete="name" maxlength="60" value="' + esc(S.name) + '"></div>';
    h += "</div>";
    if (!S.otpSent) h += '<div id="ck-formerr" role="alert">' + (S.formErr ? '<p class="ck-bad">' + esc(S.formErr) + "</p>" : "") + "</div>" + (S.formErr && S.terms ? '<button type="button" class="ck-btn p w" data-act="next">Send code</button>' : "");
    else {
      h += '<p class="ck-f" id="ck-otp-l">Enter the ' + OTP_LEN + '-digit code sent to +91 ' + esc(S.phone) + '</p><div class="ck-otp" role="group" aria-labelledby="ck-otp-l">';
      for (var i = 0; i < OTP_LEN; i++) h += '<input class="ck-ob" id="ck-o' + i + '" data-i="' + i + '" inputmode="numeric" autocomplete="' + (i ? "off" : "one-time-code") + '" maxlength="1" aria-label="Digit ' + (i + 1) + ' of ' + OTP_LEN + '" value="' + esc(S.otp.charAt(i)) + '">';
      h += '</div><div id="ck-otpmsg" role="alert">' + (S.otpMsg ? '<p class="' + (S.otpMsg.good ? "ck-ok" : "ck-bad") + '">' + esc(S.otpMsg.t) + "</p>" : "") + "</div>" + (S.dev ? '<p class="ck-ok">Test code (demo only): <b>' + esc(S.dev) + "</b></p>" : "");
      h += '<div class="ck-two"><button type="button" class="ck-btn" id="ck-rs" data-act="resend"></button><button type="button" class="ck-btn p" data-act="verify">Verify code</button></div>';
    }
  }
  return h + "</div>";
}
function secStart() { return '<section class="ck-c" id="s-pickup" aria-labelledby="h-info">' + secInfo() + secIdentity() + "</section>"; }
function secCart() {
  var q = S.q, ok = q && q.ok, rows = ok ? q.lines : lines().map(function (l) { var it = S.bySku[l.sku]; return { sku: l.sku, name: it.name, qty: l.qty, lineMinor: it.priceMinor * l.qty }; });
  var h = '<div class="ck-ord"><h2 id="h-cart">Your order</h2>';
  rows.forEach(function (l) {
    var n = esc(l.name), sk = esc(l.sku), open = S.noteOpen[l.sku] || S.notes[l.sku];
    h += '<div class="ck-ln"><b>' + n + '</b><span class="p">' + rs(l.lineMinor) + '</span><span class="ck-q"><button type="button" data-d="-1" data-sku="' + sk + '" aria-label="One less ' + n + '">&minus;</button><output aria-live="polite">' + l.qty + '</output><button type="button" data-d="1" data-sku="' + sk + '" aria-label="One more ' + n + '">+</button></span>';
    h += '<span class="ck-act"><button type="button" class="ck-rm" data-note="' + sk + '" aria-expanded="' + !!open + '">' + (S.notes[l.sku] ? "Edit note" : "Add note") + '</button><button type="button" class="ck-rm del" data-rm="' + sk + '" aria-label="Remove ' + n + ' from order">Delete</button></span>';
    if (open) h += '<label class="ck-ln-n"><span class="sr">Note for ' + n + '</span><input class="ck-in ck-lnote" data-nsku="' + sk + '" id="ck-n-' + sk + '" maxlength="80" placeholder="For example: less spicy" value="' + esc(S.notes[l.sku] || "") + '"></label>';
    h += "</div>";
  });
  if (ok && q.freebie) h += '<div class="ck-ln free"><b>' + esc(q.freebie.name) + ' <em>FREE</em></b><span class="p">Rs 0</span><span class="ck-act"><button type="button" class="ck-rm" data-rmoffer="freebie">Remove</button></span></div>';
  h += '<a class="ck-more" href="menu.html#menu">+ Add more items</a>';
  h += '<label class="ck-f" for="ck-note">Order instructions (optional)</label><textarea class="ck-in" id="ck-note" maxlength="200" placeholder="Anything the kitchen should know">' + esc(S.note) + "</textarea></div>";
  return h;
}
function secTip() {
  var q = S.q, ok = q && q.ok, opts = ok ? q.tipOptions : [{ pct: 5 }, { pct: 10 }, { pct: 15 }];
  var h = '<div class="ck-tip"><h2 id="h-tip">Tip our team directly</h2><p class="ck-note">This order comes straight to us, and so does your tip. 100% of it goes to our hardworking staff. Thanks for your support!</p><div class="ck-tips" role="group" aria-label="Tip amount">';
  opts.forEach(function (o) { var on = !S.tipOther && S.tip && S.tip.pct === o.pct; h += '<button type="button" class="ck-chip tip" data-tip="' + o.pct + '" aria-pressed="' + on + '"' + (on ? ' aria-label="' + o.pct + ' percent tip selected. Tap to remove"' : "") + ">" + o.pct + "%" + (on ? ' <span class="x" aria-hidden="true">&times;</span>' : "") + "</button>"; });
  h += '<button type="button" class="ck-chip tip" data-tip="other" aria-pressed="' + S.tipOther + '">Other' + (S.tipOther ? ' <span class="x" aria-hidden="true">&times;</span>' : "") + "</button></div>";
  if (S.tipOther) h += '<label class="ck-f" for="ck-tipamt">Tip amount in rupees' + (ok ? " (up to " + rs(q.tipMax.minor) + ")" : "") + '</label><input class="ck-in" id="ck-tipamt" type="text" inputmode="decimal" maxlength="7" placeholder="For example 30" value="' + esc(S.tipAmt) + '">';
  if (ok && q.tipMinor) h += '<p class="ck-note ck-tipamt" aria-live="polite">Your tip: <b>' + rs(q.tipMinor) + "</b>" + (S.tipOther || !S.tip ? "" : " (" + S.tip.pct + "% of the item total)") + "</p>";
  if (S.tipMsg) h += '<p class="ck-bad" role="alert">' + esc(S.tipMsg) + "</p>";
  return h + "</div>";
}
function secOrder() { return '<section class="ck-c" id="s-order" aria-labelledby="h-cart">' + secCart() + secTip() + "</section>"; }
function secRedeem() {
  var q = S.q, ok = q && q.ok, rd = ok && q.redeem, pi = ok && q.pointsInfo, lock = !S.token;
  var h = '<section class="ck-c' + (lock ? " ck-lock" : "") + '" id="s-offers" aria-labelledby="h-rw"><h2 id="h-rw">Redeem rewards and promos' + (lock ? '<span class="ck-pill">Verify mobile to unlock</span>' : "") + '</h2><div class="ck-offers"' + (lock ? ' inert aria-disabled="true"' : "") + ">";
  h += '<div class="ck-offer"><div><b>Apply coupon</b>' + (rd && rd.coupon ? '<span class="ck-tag">' + esc(rd.coupon.code) + " applied &middot; you save " + rs(rd.coupon.discountMinor) + "</span>" : "") + "</div>" + (rd && rd.coupon ? '<button type="button" class="ck-rm" data-rmoffer="coupon">Remove</button>' : '<button type="button" class="ck-btn sm" data-dlg="coupon">Apply</button>') + "</div>";
  h += '<div class="ck-offer"><div><b>Redeem freebies</b>' + (ok && q.freebie ? '<span class="ck-tag">' + esc(q.freebie.title) + " added</span>" : "") + "</div>" + (ok && q.freebie ? '<button type="button" class="ck-rm" data-rmoffer="freebie">Remove</button>' : '<button type="button" class="ck-btn sm" data-dlg="freebie">Choose</button>') + "</div>";
  if (pi && pi.member) {
    h += '<div class="ck-offer col"><label class="ck-chk tight"><input type="checkbox" id="ck-usepts"' + (S.redeem.points ? " checked" : "") + (pi.max ? "" : " disabled") + '><span><b>Use Village Club points</b><small>You have ' + pi.balance + " points" + (pi.max ? "" : pi.balance >= pi.min ? ". This order is too small to use them." : ". Use them once you have " + pi.min + ".") + "</small></span></label>";
    if (S.redeem.points && pi.max) h += '<input type="range" id="ck-pts" min="' + pi.min + '" max="' + pi.max + '" step="' + pi.step + '" value="' + S.redeem.points + '" aria-label="Points to use"><p class="ck-note" id="ck-ptslab" aria-live="polite">' + S.redeem.points + " points = " + rs(S.redeem.points * pi.valueMinor) + " off</p>";
    h += "</div>";
  } else if (S.token && ok) h += '<p class="ck-note">You are joining Village Club free with this order. Points start from this order.</p>';
  if (S.offerMsg) h += '<p class="ck-bad" role="alert">' + esc(S.offerMsg) + "</p>";
  return h + '<p class="ck-note">One offer per order. <a href="rewards.html">How rewards work</a></p></div></section>';
}
function secTime() {
  var open = S.picker, free = S.slots.filter(function (x) { return !x.full; }), meal = S.tabMeal || (S.time && (S.slots.filter(function (x) { return x.time === S.time; })[0] || {}).meal) || (free[0] && free[0].meal) || "l";
  var h = '<div class="ck-tm"><div class="ck-kv"><div><small>Pickup today</small><b id="ck-when">' + (S.time ? t12(S.time) + " &middot; ready in about 25 min" : "Choose a pickup time") + '</b></div><button type="button" class="ck-btn sm" data-act="chg" aria-expanded="' + open + '">' + (open ? "Done" : "Change") + "</button></div>";
  if (!S.slots.length) h += '<p class="ck-note">No pickup times left today. Please order on WhatsApp or come back tomorrow.</p>';
  if (open && S.slots.length) {
    var ms = ["l", "d"].filter(function (m) { return S.slots.some(function (x) { return x.meal === m; }); });
    if (ms.length > 1) { h += '<div class="ck-tabs" role="tablist">'; ms.forEach(function (m) { h += '<button type="button" role="tab" class="ck-tab" data-meal="' + m + '" aria-selected="' + (m === meal) + '">' + (m === "l" ? "Lunch" : "Dinner") + "</button>"; }); h += "</div>"; }
    h += '<div class="ck-times ck-scroll" role="group" aria-label="Pickup time today">';
    S.slots.filter(function (x) { return x.meal === meal; }).forEach(function (x) { h += '<button type="button" class="ck-chip" data-time="' + x.time + '"' + (x.full ? " disabled" : "") + ' aria-pressed="' + (x.time === S.time) + '">' + t12(x.time) + "</button>"; });
    h += "</div>";
  }
  return h + "</div>";
}
function secSummary() {
  var q = S.q, ok = q && q.ok, h = '<section class="ck-c" id="s-pay" aria-labelledby="h-pay"><h2 id="h-pay">Payment summary</h2><div class="ck-pg"><div class="ck-sl">';
  if (ok) {
    var member = (S.ver && S.ver.member) || S.join, label = q.redeem && q.redeem.coupon ? "Discount (" + esc(q.redeem.coupon.code) + ")" : q.redeem && q.redeem.points ? "Discount (points)" : "Discount";
    h += '<div class="ck-sum"><span>Item total</span><span class="r">' + rs(q.subtotalMinor) + "</span>";
    if (q.discountMinor) h += '<span class="ck-disc">' + label + '</span><span class="r ck-disc">&minus; ' + rs(q.discountMinor) + "</span>";
    if (q.tipMinor) h += "<span>Tip" + (S.tipOther || !S.tip ? "" : " (" + S.tip.pct + "%)") + "</span><span class=\"r\">" + rs(q.tipMinor) + "</span>";
    h += '<span>GST (' + q.gstPct + '%) and charges <button type="button" class="ck-i" data-act="info" aria-expanded="' + S.info + '" aria-label="About tax and charges">i</button></span><span class="r" id="ck-gst">' + rs(q.taxMinor) + "</span>";
    if (S.info) h += '<span class="ck-tipbox" role="note">GST ' + q.gstPct + "% is charged on the item total after any discount." + (q.gstAssumed ? " The rate is a placeholder until the restaurant confirms it." : "") + " The tip is not taxed.</span>";
    h += '<span class="ck-green">Points earning</span><span class="r ck-green">+ ' + q.pointsToEarn + " points</span>";
    h += '<span class="t">Total including all taxes</span><span class="t r" id="ck-total">' + rs(q.totalMinor) + "</span></div>";
    if (!member) h += '<p class="ck-pts">Verify your mobile to earn these points.</p>';
    h += '</div><div class="ck-sr"><div class="ck-pay" role="radiogroup" aria-label="How to pay"><label class="ck-opt"><input type="radio" name="pm" value="payu"' + (S.method === "payu" ? " checked" : "") + '><span><b>Pay online now</b><small>UPI, cards and net banking on PayU</small></span></label>';
    var cod = q.methods.indexOf("cod") >= 0, why = { over_limit: "Pay at pickup is for orders up to " + rs(S.menu.codMaxMinor) + " including tip. Please pay online.", noshows: "Pay at pickup is not available on this number. Please pay online.", open_cap: "You already have open pay at pickup orders. Please pay online or collect them first.", off: "Pay at pickup is not available right now." }[q.codReason] || "";
    h += '<label class="ck-opt' + (cod ? "" : " off") + '"><input type="radio" name="pm" value="cod"' + (cod ? "" : " disabled") + (S.method === "cod" ? " checked" : "") + '><span><b>Pay at pickup</b><small>' + (cod ? "Pay at the counter when you collect (orders up to " + rs(S.menu.codMaxMinor) + ")" : esc(why)) + "</small></span></label></div>";
  } else if (q && q.error) h += '<p class="ck-bad">' + esc(q.error) + "</p>"; else h += '<p class="ck-note">Pricing...</p>';
  if (!ok) h += '</div><div class="ck-sr">';
  h += '<div id="ck-err" role="alert"></div><button type="button" class="ck-btn p w" data-act="place"' + (S.busy ? " disabled" : "") + ">" + (S.busy ? "Please wait..." : S.method === "cod" ? "Place order" : "Pay " + (ok ? rs(q.totalMinor) : "") + " and place order") + "</button></div></div></section>";
  return h;
}
function render() {
  var demo = S.menu.mock ? '<span class="ck-demo" tabindex="0" title="Demo mode. The payment page, the SMS code and the offers are test only. No money moves and no real SMS is sent.">Demo mode</span>' : "";
  var strip = '<div class="ck-strip"><div class="ck-st1"><h1>Take away checkout</h1><span class="ck-where">Swagramam &middot; Labbipet</span>' + demo + "</div>";
  if (!lines().length) { root.className = "ck wide"; root.innerHTML = strip + '</div><div class="ck-c"><p>Your cart is empty.</p><a class="ck-btn p" href="menu.html#menu">Choose dishes</a></div>'; return; }
  root.className = "ck wide two";
  var qq = S.q && S.q.ok ? S.q : null, done = [!!S.time, !!S.token, !!S.token && !!qq, false], cur = done.indexOf(false), SN = [["Pickup", "s-pickup"], ["You", "h-id"], ["Order", "s-order"], ["Pay", "s-pay"]];
  var h = strip + '<ol class="ck-steps" aria-label="Checkout steps">' + SN.map(function (x, i) { return '<li class="' + (done[i] ? "done" : i === cur ? "cur" : "") + '"' + (i === cur ? ' aria-current="step"' : "") + '><a href="#' + x[1] + '"><span class="n">' + (done[i] ? "&#10003;" : i + 1) + "</span>" + x[0] + "</a></li>"; }).join("") + "</ol></div>";
  h += '<div class="ck-grid"><div class="ck-col ck-l">' + secStart() + '</div><div class="ck-gap" aria-hidden="true"><i></i></div><div class="ck-col ck-r"><div class="ck-c ck-one"><div class="ck-top">' + secOrder() + secRedeem() + '</div><div class="ck-bot">' + secSummary() + "</div></div></div></div>";
  h += '<div class="ck-bar"><div><small>Total</small><b>' + (qq ? rs(qq.totalMinor) : "\u2013") + '</b></div><button type="button" class="ck-btn p" data-act="barplace"' + (S.busy ? " disabled" : "") + ">" + (S.busy ? "Please wait..." : S.method === "cod" ? "Place order" : "Pay and place order") + "</button></div>";
  var keep = document.activeElement && document.activeElement.id, pos = keep && document.activeElement.selectionStart;
  root.innerHTML = h; if (keep) { var el = document.getElementById(keep); if (el) { el.focus(); try { if (pos != null) el.setSelectionRange(pos, pos); } catch (e) {} } }
  tick();
}
function err(m) { var e = $("#ck-err"); if (e) { e.innerHTML = m ? '<p class="ck-bad">' + esc(m) + "</p>" : ""; if (m) e.scrollIntoView({ block: "center", behavior: "smooth" }); } }

/* ---------- events ---------- */
var EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
function resetRedeem() { S.redeem = { coupon: null, freebie: null, points: 0 }; }
function refocus(sel) { var e = $(sel); if (e) e.focus(); }
function onClick(e) {
  var b = e.target.closest("[data-date],[data-time],[data-d],[data-rm],[data-mode],[data-act],[data-tip],[data-dlg],[data-note],[data-rmoffer],[data-meal]"); if (!b) return; var a = b.dataset;
  if (a.meal) { S.tabMeal = a.meal; return render(); }
  if (a.date) return loadSlots(a.date, function () { render(); requote(render); });
  if (a.time) { S.time = a.time; S.picker = false; render(); return requote(render); }
  if (a.d) { var s = a.sku, n = (S.cart[s] || 0) + +a.d; if (n < 1) { delete S.cart[s]; delete S.notes[s]; } else S.cart[s] = Math.min(20, n); saveCart(); render(); return requote(render); }
  if (a.rm) { delete S.cart[a.rm]; delete S.notes[a.rm]; saveCart(); render(); return requote(render); }
  if (a.note) { S.noteOpen[a.note] = !S.noteOpen[a.note]; render(); return refocus('[data-nsku="' + a.note + '"]'); }
  if ("mode" in a) { S.mode = a.mode || null; S.join = a.mode === "join"; S.formErr = ""; return render(); }
  if (a.tip) {
    if (a.tip === "other") { S.tipOther = !S.tipOther; S.tip = null; S.tipAmt = ""; } else { var p = +a.tip; S.tipOther = false; S.tip = S.tip && S.tip.pct === p ? null : { pct: p }; }   // tap the selected chip again to remove the tip
    S.tipMsg = ""; render(); if (S.tipOther) refocus("#ck-tipamt"); return requote(render);
  }
  if (a.dlg) return openDlg(a.dlg);
  if (a.rmoffer) { if (a.rmoffer === "points") S.redeem.points = 0; else S.redeem[a.rmoffer] = null; S.offerMsg = ""; render(); return requote(render); }
  if (a.act === "chg") { S.picker = !S.picker; return render(); }
  if (a.act === "info") { S.info = !S.info; return render(); }
  if (a.act === "next") return nextStep();
  if (a.act === "editphone") { S.otpSent = false; S.otp = ""; S.otpMsg = null; S.dev = null; return render(); }
  if (a.act === "resend") return sendCode(true);
  if (a.act === "verify") return verify();
  if (a.act === "change") { api("/api/rewards/logout", {}); S.token = null; S.ver = null; S.otpSent = false; S.otp = ""; S.dev = null; S.otpMsg = null; resetRedeem(); S.join = S.mode === "join"; render(); return requote(render); }
  if (a.act === "place" || a.act === "barplace") return place();
}
function onInput(e) {
  var t = e.target;
  if (t.classList.contains("ck-ob")) return otpBox(t);
  if (t.id === "ck-ph") { S.phone = t.value.replace(/[^\d+ ]/g, ""); clearTimeout(autoSend.t); autoSend.t = setTimeout(autoSend, 250); } else if (t.id === "ck-note") S.note = t.value; else if (t.id === "ck-nm") S.name = t.value; else if (t.id === "ck-em") S.email = t.value;
  else if (t.id === "ck-terms") { S.terms = t.checked; if (t.checked) { S.formErr = ""; var fe0 = $("#ck-formerr"); if (fe0) fe0.innerHTML = ""; autoSend(); } }
  else if (t.dataset && t.dataset.nsku) { var v = t.value.trim(); if (v) S.notes[t.dataset.nsku] = v; else delete S.notes[t.dataset.nsku]; saveCart(); }
  else if (t.id === "ck-tipamt") { S.tipAmt = t.value.replace(/[^\d.]/g, ""); S.tipMsg = ""; requoteSoon(); }
  else if (t.id === "ck-usepts") { if (t.checked && S.q && S.q.pointsInfo) { if (!S.menu.offersStack) { S.redeem.coupon = null; S.redeem.freebie = null; } S.redeem.points = S.q.pointsInfo.max; } else S.redeem.points = 0; S.offerMsg = ""; render(); requote(render); }
  else if (t.id === "ck-pts") { S.redeem.points = +t.value; var l = $("#ck-ptslab"); if (l && S.q) l.textContent = S.redeem.points + " points = " + rs(S.redeem.points * S.q.pointsInfo.valueMinor) + " off"; requoteSoon(); }
  else if (t.name === "pm") { S.method = t.value; render(); }
}
/* ---------- OTP: OTP_LEN boxes, auto-advance, paste, backspace, auto-submit, 30 s resend timer ---------- */
function otpBox(t) {
  var d = t.value.replace(/\D/g, ""), i = +t.dataset.i, boxes = root.querySelectorAll(".ck-ob");
  if (d.length > 1) { for (var k = 0; k < d.length && i + k < OTP_LEN; k++) boxes[i + k].value = d.charAt(k); } else t.value = d;
  S.otp = Array.prototype.map.call(boxes, function (x) { return x.value; }).join("");
  var nx = Math.min(OTP_LEN - 1, i + Math.max(1, d.length)); if (d.length && boxes[nx]) boxes[nx].focus();
  if (S.otp.length === OTP_LEN) verify();
}
root.addEventListener("keydown", function (e) { var t = e.target; if (!t.classList || !t.classList.contains("ck-ob")) return; var i = +t.dataset.i; if (e.key === "Backspace" && !t.value && i > 0) { var p = $("#ck-o" + (i - 1)); p.value = ""; p.focus(); e.preventDefault(); S.otp = S.otp.slice(0, i - 1); } if (e.key === "Enter") verify(); });
function tick() { var b = $("#ck-rs"); if (!b) return; var s = Math.max(0, Math.ceil((S.resendAt - Date.now()) / 1000)); b.textContent = s ? "Resend in " + s + "s" : "Resend code"; b.disabled = s > 0; }
setInterval(tick, 1000);
function fe(m) { S.formErr = m; var e = $("#ck-formerr"); if (e) e.innerHTML = '<p class="ck-bad">' + esc(m) + "</p>"; }
function nextStep() {
  S.formErr = ""; var p = normPhone(S.phone);
  if (!p) return fe("Please enter a valid 10-digit mobile number.");
  if (!S.terms) return fe("Please accept the Terms and Privacy Policy to continue.");
  S.phone = p; sendCode(false);
}
function autoSend() {   // the code goes out by itself once the number is complete and the terms are ticked
  if (S.otpSent || S.sending || S.token) return;
  var p = normPhone(S.phone); if (!p) return;
  if (!S.terms) return fe("Tick the box above to get your code.");
  S.formErr = ""; S.phone = p; sendCode(false);
}
function sendCode(resend) {
  if (S.sending) return; S.sending = true;
  var btn = $(resend ? "#ck-rs" : "[data-act=next]"); if (btn) btn.disabled = true;
  api("/api/otp/send", { phone: S.phone }).then(function (j) {
    S.sending = false;
    if (j.ok) { S.otpSent = true; S.dev = j.devCode || null; S.resendAt = Date.now() + 30000; S.otp = ""; S.otpMsg = resend ? { t: "A new code has been sent.", good: true } : null; render(); rwWarm(); webOtp(); return refocus("#ck-o0"); }
    if (j.waitMs) S.resendAt = Date.now() + j.waitMs;
    if (S.otpSent) { S.otpMsg = { t: j.message }; render(); } else { S.formErr = j.message; render(); }
  });
}
function verify() {
  if (S.vbusy) return;
  if (S.otp.length !== OTP_LEN) { S.otpMsg = { t: "Enter all " + OTP_LEN + " digits of the code." }; var m = $("#ck-otpmsg"); if (m) m.innerHTML = '<p class="ck-bad">' + esc(S.otpMsg.t) + "</p>"; return; }
  S.vbusy = true; var rw0 = $(".rw"); if (rw0) { rw0.dataset.st = "verifying"; var l0 = rw0.querySelector(".rw-lab"); if (l0) l0.textContent = "Checking your code\u2026"; }
  api("/api/otp/verify", { phone: S.phone, code: S.otp, purpose: "checkout" }).then(function (j) {
    if (!j.ok) {
      S.vbusy = false; S.otp = ""; S.otpMsg = { t: j.message + (j.triesLeft != null ? " (" + j.triesLeft + " tries left)" : "") };
      var rw = $(".rw"); if (rw) { rw.dataset.st = "otp"; rw.classList.add("err"); setTimeout(function () { rw.classList.remove("err"); }, 700); var l1 = rw.querySelector(".rw-lab"); if (l1) l1.textContent = "Enter the code to unlock"; }
      var g = $(".ck-otp"); if (g) { g.classList.add("shake"); setTimeout(function () { g.classList.remove("shake"); }, 500); }
      var bx = root.querySelectorAll(".ck-ob"); for (var q = 0; q < bx.length; q++) bx[q].value = ""; if (bx[0]) bx[0].focus();
      var m = $("#ck-otpmsg"); if (m) m.innerHTML = '<p class="ck-bad">' + esc(S.otpMsg.t) + "</p>"; return;
    }
    var still = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches, rw = $(".rw");
    if (rw && !still) { rw.classList.add("go"); if (navigator.vibrate) try { navigator.vibrate(20); } catch (e) {} }
    setTimeout(function () {
      S.token = j.token; S.ver = j; if (j.name && !S.name.trim()) S.name = j.name; S.join = j.member ? false : S.mode === "join"; S.otpSent = false; S.otp = ""; S.otpMsg = null; S.dev = null; S.vbusy = false; S.rwFresh = true;
      store("mobile", S.phone); render(); rwFx();
      requote(function () { var wait = still ? 0 : 1800; setTimeout(function () { render(); var o = $("#s-offers"); if (o && innerWidth < 1024) o.scrollIntoView({ behavior: "smooth", block: "start" }); else { var rc = $(".rw"); if (rc) rc.scrollIntoView({ behavior: "smooth", block: "nearest" }); } }, wait); });
    }, rw && !still ? 800 : 0);
  }).catch(function () { S.vbusy = false; });
}
/* ---------- Rewards swipe: locked -> otp -> verifying -> open (v98) ---------- */
var RW_TIERS = [{ n: "Silver", at: 500 }, { n: "Gold", at: 2000 }, { n: "Village Elite", at: 5000 }];
function rwTier(p) {
  var next = null; for (var i = 0; i < RW_TIERS.length; i++) if (p < RW_TIERS[i].at) { next = RW_TIERS[i]; break; }
  var pig = p < RW_TIERS[0].at ? "empty" : p < RW_TIERS[1].at ? "half" : "full", prev = 0;
  for (var j = 0; j < RW_TIERS.length; j++) if (p >= RW_TIERS[j].at) prev = RW_TIERS[j].at;
  var cur = ""; for (var k = 0; k < RW_TIERS.length; k++) if (p >= RW_TIERS[k].at) cur = RW_TIERS[k].n;
  return { pig: pig, next: next, cur: cur, pct: next ? Math.max(4, Math.round((p - prev) / (next.at - prev) * 100)) : 100 };
}
function rwSwipe(st) {
  var v = S.ver || {}, pts = st === "open" ? v.points : null, known = st === "open" && pts != null, t = known ? rwTier(pts) : null;
  var pig = st === "open" && t ? t.pig : "empty";
  var lab = { locked: "Swipe to unlock rewards", otp: "Enter the code to unlock", verifying: "Checking your code\u2026", open: "Rewards unlocked" }[st];
  var sub = st === "locked" ? "Enter your mobile number to see your points." : st === "otp" ? "Type the " + OTP_LEN + "-digit code. It unlocks by itself." : st === "verifying" ? "One moment\u2026" :
    !known ? "Balance updating. You can still order." : !v.member && !pts ? "Welcome to Village Club. Your first order starts earning points." :
    t.next ? "Get " + (t.next.at - pts) + " more points to unlock " + t.next.n : (t.cur || "Village Elite") + " member. Thank you!";
  var n = st === "open" ? (known ? (S.rwFresh ? 0 : pts) : "\u2013") : "\u2013 \u2013";
  return '<div class="rw' + (S.rwFresh ? " fresh" : "") + '" data-st="' + st + '"><div class="rw-card"><div class="rw-t"><small>Reward points</small><div class="rw-n" id="rw-n" data-v="' + (known ? pts : "") + '" aria-live="polite">' + n + '</div>' +
    '<div class="rw-bar"><i style="--p:' + (known ? t.pct : 0) + '%"></i></div><p class="rw-sub">' + esc(sub) + '</p></div><img class="rw-pig" src="assets/rwd-pig-' + pig + '.webp" alt="" width="110" height="94" decoding="async"></div>' +
    '<div class="rw-track" role="status" aria-label="' + esc(lab) + '"><i class="rw-fill"></i><span class="rw-lab">' + esc(lab) + '</span><span class="rw-knob"><img src="assets/rwd-coin.webp" alt="" width="34" height="36"></span></div>' + (st === "open" ? '<a class="rw-hist" href="checkout.html?find=1">View my orders and points &rsaquo;</a>' : "") + '</div>';
}
function rwFx() {
  if (!S.rwFresh) return; S.rwFresh = false;
  var rw = $(".rw"), el = $("#rw-n"); if (!rw || !el) return;
  var to = +el.dataset.v, still = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (el.dataset.v === "" || still) { el.textContent = el.dataset.v === "" ? "\u2013" : to; return; }
  var t0 = performance.now(); (function f(now) { var k = Math.min(1, (now - t0) / 1200), e = 1 - Math.pow(1 - k, 3); el.textContent = Math.round(to * e); if (k < 1) requestAnimationFrame(f); })(t0);
  var card = rw.querySelector(".rw-card"); for (var i = 0; i < 12; i++) { var c = document.createElement("img"); c.className = "rw-c"; c.src = "assets/rwd-coin.webp"; c.alt = ""; c.style.cssText = "--x:" + (62 + Math.random() * 30).toFixed(0) + "%;--d:" + (i * 70) + "ms"; card.appendChild(c); setTimeout(function (x) { return function () { x.remove(); }; }(c), 2200); }
}
function rwWarm() { ["half", "full"].forEach(function (k) { var i = new Image(); i.src = "assets/rwd-pig-" + k + ".webp"; }); }
var otpAbort = null;
function webOtp() {
  if (!("OTPCredential" in window) || !navigator.credentials) return;
  try { if (otpAbort) otpAbort.abort(); otpAbort = new AbortController();
    navigator.credentials.get({ otp: { transport: ["sms"] }, signal: otpAbort.signal }).then(function (c) { if (c && c.code && S.otpSent) { S.otp = String(c.code).replace(/\D/g, "").slice(0, OTP_LEN); var b = root.querySelectorAll(".ck-ob"); for (var i = 0; i < OTP_LEN && b[i]; i++) b[i].value = S.otp.charAt(i); if (S.otp.length === OTP_LEN) verify(); } }).catch(function () {});
  } catch (e) {}
}
function rwAct(rw) { if (!rw || rw.dataset.st === "open") return; rw.classList.add("nudge"); setTimeout(function () { rw.classList.remove("nudge"); }, 600); var f = $(S.otpSent ? "#ck-o0" : !S.terms ? "#ck-terms" : "#ck-ph"); if (f) f.focus(); }
var swAt = 0;
root.addEventListener("click", function (e) { if (Date.now() - swAt < 400) return; var tr = e.target.closest && e.target.closest(".rw-track"); rwAct(tr && tr.closest(".rw")); });
/* real swipe: drag the coin to the right end (60%+) to unlock; a short drag springs back */
(function () {
  var d = null;
  root.addEventListener("pointerdown", function (e) {
    var k = e.target.closest && e.target.closest(".rw-knob"), rw = k && k.closest(".rw"); if (!rw || rw.dataset.st === "open" || rw.dataset.st === "verifying") return;
    var tr = rw.querySelector(".rw-track"); d = { k: k, rw: rw, x0: e.clientX, dx: 0, max: Math.max(1, tr.clientWidth - k.offsetWidth + 8), fill: rw.querySelector(".rw-fill") };
    try { k.setPointerCapture(e.pointerId); } catch (x) {} rw.classList.add("dragging"); k.classList.add("drag");
  });
  root.addEventListener("pointermove", function (e) {
    if (!d) return; d.dx = Math.max(0, Math.min(d.max, e.clientX - d.x0));
    d.k.style.transform = "translateX(" + d.dx + "px)"; d.fill.style.clipPath = "inset(0 " + (100 - 100 * Math.min(1, (d.dx + 34) / (d.max + 56))).toFixed(1) + "% 0 0 round 32px)";
  });
  function end() {
    if (!d) return; var x = d; d = null; x.rw.classList.remove("dragging"); x.k.classList.remove("drag"); x.k.style.transform = ""; x.fill.style.clipPath = "";
    if (x.dx > 6) swAt = Date.now(); if (x.dx > x.max * 0.6) rwAct(x.rw);
  }
  root.addEventListener("pointerup", end); root.addEventListener("pointercancel", end);
})();
/* ---------- coupon and freebie panels ---------- */
function openDlg(kind) {
  S.dlgKind = kind; S.dlgMsg = ""; S.offers = null; drawDlg(); if (!dlg.open) dlg.showModal();
  if (S.token) api("/api/offers", { token: S.token, lines: lines(), join: S.join || undefined }).then(function (j) { S.offers = j.ok ? j : { error: j.message }; drawDlg(); });
}
function drawDlg() {
  var k = S.dlgKind, h = '<div class="ck-dh"><h2 id="ck-dlg-t">' + (k === "coupon" ? "Apply coupon" : "Redeem freebies") + '</h2><button type="button" class="ck-x" data-dact="close" aria-label="Close">&times;</button></div>';
  if (!S.token) h += '<p>Verify your mobile number first to see the offers for you.</p><button type="button" class="ck-btn p w" data-dact="close">OK</button>';
  else if (!S.offers) h += '<p class="ck-note" role="status">Loading your offers...</p>';
  else if (S.offers.error) h += '<p class="ck-bad">' + esc(S.offers.error) + "</p>";
  else {
    if (k === "coupon") h += '<label class="ck-f" for="ck-code">Have a code?</label><div class="ck-row"><input class="ck-in" id="ck-code" autocapitalize="characters" autocomplete="off" maxlength="24" placeholder="Enter code"><button type="button" class="ck-btn p" data-dact="applycode">Apply</button></div>';
    if (S.dlgMsg) h += '<p class="ck-bad" role="alert">' + esc(S.dlgMsg) + "</p>";
    var list = k === "coupon" ? S.offers.coupons : S.offers.freebies;
    if (S.offers.instoreOnly) h += '<p class="ck-note">Rewards are redeemed at the restaurant for now.</p>';
    else if (!list.length) h += '<p class="ck-note">No offers right now.</p>';
    list.forEach(function (o) {
      h += '<div class="ck-off' + (o.eligible ? "" : " off") + '"><div><b>' + esc(o.title) + '</b> <span class="ck-code">' + esc(o.code) + "</span><p>" + esc(o.desc) + "</p>" + (o.eligible ? (o.discountMinor ? '<p class="ck-save">You save ' + rs(o.discountMinor) + "</p>" : "") : '<p class="ck-why">' + esc(o.reason) + "</p>") + "</div>" +
        (o.eligible ? '<button type="button" class="ck-btn sm p" data-dact="apply" data-code="' + esc(o.code) + '">' + (k === "coupon" ? "Apply" : "Add") + "</button>" : "") + "</div>";
    });
    h += '<p class="ck-note">One offer per order.</p>';
  }
  dlg.innerHTML = h;
}
function applyOffer(kind, code) {
  if (!S.menu.offersStack) resetRedeem(); S.redeem[kind] = code; S.dlgMsg = "";
  requote(function () { if (S.offerMsg) { S.dlgMsg = S.offerMsg; S.offerMsg = ""; drawDlg(); render(); } else { dlg.close(); render(); refocus('[data-rmoffer="' + kind + '"]'); } });
}
dlg.addEventListener("click", function (e) {
  var b = e.target.closest("[data-dact]"); if (!b) return; var a = b.dataset.dact;
  if (a === "close") { dlg.close(); refocus('[data-dlg="' + S.dlgKind + '"]'); }
  else if (a === "apply") applyOffer(S.dlgKind, b.dataset.code);
  else if (a === "applycode") { var v = ($("#ck-code", dlg) || {}).value || ""; if (!v.trim()) { S.dlgMsg = "Enter a code."; return drawDlg(); } applyOffer(S.dlgKind, v.trim()); }
});
dlg.addEventListener("keydown", function (e) { if (e.key === "Enter" && e.target.id === "ck-code") { e.preventDefault(); var b = $("[data-dact=applycode]", dlg); if (b) b.click(); } });
/* ---------- place order ---------- */
function place() {
  if (S.busy) return; err("");
  if (!S.q || !S.q.ok) return err("Please fix your order first.");
  if (!S.date || !S.time) { S.picker = true; render(); return err("Please choose a pickup day and time."); }
  if (S.q.conflicts.length) return err(S.q.conflicts[0].reason);
  if (!S.token) return err("Please verify your mobile number first. Enter it on the left and we will send you a code.");
  if (!S.method) return err("Please choose how to pay.");
  if (!S.terms) return err("Please accept the Terms and Privacy Policy to place your order.");
  if (S.tipMsg) return err(S.tipMsg);
  S.busy = true; render(); store("name", S.name.trim());
  api("/api/checkout/start", { token: S.token, lines: lines(), slot: { date: S.date, time: S.time }, method: S.method, name: S.name.trim() || "Guest", email: "", note: S.note, join: S.join, tip: tipChoice() || undefined, redeem: redeemChoice(), consent: { terms: S.terms, marketing: false } }).then(function (j) {
    if (!j.ok) { S.busy = false; if (j.error === "bad_token" || j.error === "token_used") { S.token = null; S.ver = null; S.otpSent = false; S.dev = null; } if (/offer|used|points|coupon|one_offer|member_only|expired|min/.test(j.error)) { resetRedeem(); requote(render); } render(); return err(j.message); }
    if (j.method === "cod") { location.href = "checkout.html?o=" + j.orderId; return; }
    var f = document.createElement("form"); f.method = "POST"; f.action = j.redirect.url;
    Object.keys(j.redirect.fields).forEach(function (k) { var i = document.createElement("input"); i.type = "hidden"; i.name = k; i.value = j.redirect.fields[k]; f.appendChild(i); });
    document.body.appendChild(f); f.submit();
  });
}


/* ---------- status view (after payment or pay at pickup) ---------- */
var VIEWS = {
  waiting_payment: ["wait", "&#8635;", "Checking your payment...", "Please do not close this page. This takes a few seconds."],
  placed_paid: ["ok", "&#10003;", "Order confirmed", "Payment received. The kitchen has your order."],
  placed_cod: ["ok", "&#10003;", "Order placed", "Pay at the counter when you collect."],
  confirmed: ["ok", "&#10003;", "Order confirmed", "The kitchen is preparing your order."],
  ready: ["ok", "&#10003;", "Ready for pickup", "Your order is ready. Please collect it from the counter."],
  done: ["ok", "&#10003;", "Order collected", "Thank you for dining with Swagramam."],
  payment_failed: ["bad", "!", "Payment did not go through", "No money was taken for this order. Your dishes are still saved, so you can try again."],
  expired: ["bad", "!", "This order timed out", "We did not receive payment in time. If money was taken it will be refunded. You can place the order again."],
  refund: ["bad", "!", "We need to refund a payment", "We could not accept this payment. The restaurant will refund it. Please call +91 76598 58999 if you need help."],
  cancelled: ["bad", "!", "Order cancelled", "This order was cancelled. Please call +91 76598 58999 if you have questions."],
};
function statusView(id) {
  var tries = 0;
  (function poll() {
    api("/api/order/status?id=" + encodeURIComponent(id)).then(function (j) {
      if (!j.ok) { root.innerHTML = '<div class="ck-c ck-st"><div class="ck-ico bad">!</div><p class="big">Order not found</p><a class="ck-btn p" href="menu.html#menu">Back to menu</a></div>'; return; }
      var v = VIEWS[j.stage] || VIEWS.waiting_payment, wait = j.stage === "waiting_payment" && j.method === "payu";
      var h = '<div class="ck-c ck-st"><div class="ck-ico ' + v[0] + '">' + v[1] + '</div><p class="big">' + v[2] + "</p><p>" + v[3] + '</p><div class="ck-ono">' + esc(j.id) + "</div>";
      h += "<p>Pickup <b>" + esc(dayName(j.slot.date)) + ", " + t12(j.slot.time) + "</b></p>";
      if (j.discountMinor) h += "<p>Discount" + (j.couponCode ? " (" + esc(j.couponCode) + ")" : "") + ": <b>&minus; " + rs(j.discountMinor) + "</b></p>";
      if (j.tipMinor) h += "<p>Tip: <b>" + rs(j.tipMinor) + "</b></p>";
      h += "<p>" + (j.method === "cod" ? "Pay at pickup: <b>" + rs(j.totalMinor) + "</b>" : "Total: <b>" + rs(j.totalMinor) + "</b>") + "</p>";
      if (j.items.length) h += '<p class="ck-note">' + j.items.map(function (i) { return esc(i.qty + " x " + i.name + (i.note ? " (" + i.note + ")" : "")); }).join(", ") + "</p>";
      if (j.pointsToEarn) h += '<div class="ck-pt">You will earn <b>' + j.pointsToEarn + "</b> Village Club points when the bill is settled at the counter.</div>";
      if (j.stage === "payment_failed" || j.stage === "expired") h += '<p><a class="ck-btn p" href="checkout.html">Try again</a></p>';
      if (/^(placed_|confirmed|ready|done)/.test(j.stage)) { store("cart", null); h += '<p><a class="ck-btn" href="menu.html">Back to menu</a></p>'; }
      if (wait && tries >= 40) h += '<p class="ck-note">Still waiting. If you completed the payment, it will show here once PayU confirms it. You can also look up your order later with your mobile number.</p>';
      root.innerHTML = h + "</div>";
      if ((wait || j.state === "SENT_TO_KITCHEN" || j.state === "CONFIRMED") && tries++ < 60) setTimeout(poll, wait ? 3000 : 15000);
    });
  })();
}

/* ---------- order lookup ---------- */
function lookupView() {
  var L = { phone: store("mobile") || "", token: null };
  function draw(extra) { root.innerHTML = '<h1>Find my orders</h1><section class="ck-c"><label class="ck-f" for="lk-ph">Mobile number</label><div class="ck-row"><input class="ck-in" id="lk-ph" type="tel" inputmode="numeric" maxlength="14" value="' + esc(L.phone) + '"><button class="ck-btn" id="lk-send" type="button">Send code</button></div><div class="ck-row" style="margin-top:10px"><input class="ck-in" id="lk-otp" inputmode="numeric" maxlength="6" placeholder="' + OTP_LEN + '-digit code"><button class="ck-btn p" id="lk-go" type="button">Show orders</button></div><div id="lk-m"></div>' + (extra || "") + "</section>"; }
  draw();
  root.addEventListener("click", function (e) {
    var m = function (t, g) { $("#lk-m").innerHTML = t ? '<p class="' + (g ? "ck-ok" : "ck-bad") + '">' + esc(t) + "</p>" : ""; };
    if (e.target.id === "lk-send") { L.phone = $("#lk-ph").value; api("/api/otp/send", { phone: L.phone }).then(function (j) { m(j.ok ? (j.devCode ? "Test code (demo only): " + j.devCode : "Code sent.") : j.message, j.ok); }); }
    if (e.target.id === "lk-go") { api("/api/otp/verify", { phone: $("#lk-ph").value, code: $("#lk-otp").value, purpose: "lookup" }).then(function (j) { if (!j.ok) return m(j.message); api("/api/order/lookup", { token: j.token }).then(function (r) { var h = r.orders && r.orders.length ? r.orders.map(function (o) { return '<p><a href="checkout.html?o=' + o.id + '"><b>' + o.id + "</b></a> &middot; " + esc(dayName(o.slot.date)) + " " + t12(o.slot.time) + " &middot; " + rs(o.totalMinor) + " &middot; " + esc(o.stage.replace(/_/g, " ")) + "</p>"; }).join("") : "<p>No orders found for this number.</p>"; m(""); $("#lk-m").innerHTML = h; }); }); }
  });
}

/* ---------- start ---------- */
function unavailable() {
  root.className = "ck"; root.innerHTML = '<h1>Online ordering opens soon</h1><div class="ck-c"><p>We are not taking online take away orders yet. You can still order on WhatsApp or call us.</p><p><a class="ck-btn p w" href="' + WA + '" target="_blank" rel="noopener">Order on WhatsApp</a></p><p><a class="ck-btn w" href="menu.html">Back to menu</a></p></div>';
}
function start() {
  var qs = new URLSearchParams(location.search);
  $("#ck-find").addEventListener("click", function (e) { e.preventDefault(); history.pushState(null, "", "checkout.html?find=1"); lookupView(); });
  if (qs.get("o")) return statusView(qs.get("o"));
  if (qs.get("find")) return lookupView();
  api("/api/menu").then(function (m) {
    if (!m.ok || !m.live) return unavailable();
    S.menu = m; m.items.forEach(function (i) { S.byK[i.k] = i; S.bySku[i.sku] = i; }); loadCart(); S.tip = m.tip && m.tip.defaultPct ? { pct: m.tip.defaultPct } : null;   // 5% preselected, removable
    S.phone = store("mobile") || ""; S.name = store("name") || "";
    var restore = api("/api/rewards/me").then(function (j) { if (j && j.ok && !S.token) { S.phone = j.phone; S.mode = "join"; S.token = j.token; S.ver = j; if (j.name && !S.name.trim()) S.name = j.name; S.join = !j.member; S.rwFresh = true; rwWarm(); } });
    api("/api/slots").then(function (s) {
      if (!s.ok) return unavailable(); S.today = s.today; S.days = s.days;
      var ds = dateList();
      function pick(k) { if (k >= ds.length) { loadSlots(s.date, go); return; } api("/api/slots?date=" + ds[k]).then(function (r) { if (r.ok && r.slots.length) { S.date = ds[k]; S.slots = r.slots; go(); } else pick(k + 1); }); }
      function go() { restore.then(function () { if (!S.time) { var f0 = S.slots.filter(function (x) { return !x.full; })[0]; if (f0) S.time = f0.time; } var fx = S.rwFresh; render(); rwFx(); requote(function () { if (fx) setTimeout(render, 1600); else render(); }); }); }
      pick(0);
    });
  });
  root.addEventListener("click", onClick); root.addEventListener("input", onInput); root.addEventListener("change", onInput);
}
start();
})();
