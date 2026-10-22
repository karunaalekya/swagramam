/* Swagramam take away checkout. Talks to /api/* (Cloudflare Pages Functions). Prices, tax, slots and the payment rule all come from the server. */
(function () {
"use strict";
var $ = function (s, r) { return (r || document).querySelector(s); }, root = $("#ck");
var WA = "https://wa.me/917659858999?text=" + encodeURIComponent("Hi Swagramam, I want to place a take away order.");
var S = { menu: null, byK: {}, bySku: {}, cart: {}, date: null, time: null, slots: [], today: null, days: 7, q: null, token: null, phone: "", ver: null, mode: "guest", method: null, join: false, busy: false, note: "", name: "", email: "", terms: false, mkt: false, otpSent: false, dev: null };
function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
function rs(m) { return "Rs " + (m / 100).toLocaleString("en-IN", { minimumFractionDigits: m % 100 ? 2 : 0 }); }
function store(k, v) { try { if (v === undefined) return localStorage.getItem("sx_" + k); if (v === null) localStorage.removeItem("sx_" + k); else localStorage.setItem("sx_" + k, v); } catch (e) { return null; } }
function api(path, body) {
  var o = body === undefined ? { cache: "no-store" } : { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) };
  return fetch(path, o).then(function (r) { return r.json().then(function (j) { j._status = r.status; return j; }, function () { return { ok: false, error: "server", message: "Something went wrong. Please try again." }; }); }, function () { return { ok: false, error: "network", message: "No connection. Please check your internet and try again." }; });
}
var dayName = function (d) { var p = d.split("-"), x = new Date(Date.UTC(+p[0], +p[1] - 1, +p[2])); return x.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }); };
var t12 = function (t) { var h = +t.slice(0, 2), m = t.slice(3); return (h % 12 || 12) + ":" + m + (h < 12 ? " am" : " pm"); };

/* ---------- cart (same localStorage cart as the order popup) ---------- */
function loadCart() { S.cart = {}; try { var c = JSON.parse(store("cart") || "{}"); Object.keys(c).forEach(function (k) { var it = S.byK[k] || (S.byK[k.split("|")[0] + "|"]); var q = Math.floor(+c[k]); if (it && q > 0) S.cart[it.sku] = Math.min(20, (S.cart[it.sku] || 0) + q); }); } catch (e) {} }
function saveCart() { var o = {}; Object.keys(S.cart).forEach(function (s) { o[S.bySku[s].k] = S.cart[s]; }); store("cart", JSON.stringify(o)); }
function lines() { return Object.keys(S.cart).map(function (s) { return { sku: s, qty: S.cart[s] }; }); }

/* ---------- server quote ---------- */
var qTimer;
function requote(cb) {
  if (!lines().length) { S.q = null; return cb && cb(); }
  var my = ++requote.n; api("/api/quote", { lines: lines(), slot: S.date && S.time ? { date: S.date, time: S.time } : undefined, token: S.token || undefined }).then(function (j) {
    if (my !== requote.n) return; S.q = j.ok ? j : { error: j.message || "Could not price your order." };
    if (j.ok && S.method && j.methods.indexOf(S.method) < 0) S.method = null;
    if (j.ok && !S.method) S.method = j.methods.indexOf("payu") >= 0 ? "payu" : j.methods[0];
    cb && cb();
  });
}
requote.n = 0;

/* ---------- slots ---------- */
function loadSlots(date, cb) {
  S.date = date; S.time = null; S.slots = [];
  api("/api/slots?date=" + date).then(function (j) { S.slots = j.ok ? j.slots : []; if (j.ok) { S.today = j.today; S.days = j.days; } cb && cb(); });
}
function dateList() { var out = [], p = S.today.split("-"), b = Date.UTC(+p[0], +p[1] - 1, +p[2]); for (var i = 0; i < S.days; i++) { var d = new Date(b + i * 86400000); out.push(d.getUTCFullYear() + "-" + String(d.getUTCMonth() + 1).padStart(2, "0") + "-" + String(d.getUTCDate()).padStart(2, "0")); } return out; }

/* ---------- build view ---------- */
function render() {
  var q = S.q, ok = q && q.ok, h = "";
  if (S.menu.mock) h += '<p class="ck-mock"><b>Demo mode.</b> The payment page and the SMS code are test only. No money moves and no real SMS is sent.</p>';
  h += '<h1>Take away checkout</h1><p class="ck-sub">Order ahead and collect from the restaurant at Labbipet.</p>';
  if (!lines().length) { root.innerHTML = h + '<div class="ck-c"><p>Your cart is empty.</p><a class="ck-btn p" href="menu.html#menu">Choose dishes</a></div>'; return; }
  /* 1 pickup */
  h += '<section class="ck-c" aria-labelledby="h1"><h2 id="h1"><i>1</i>Pickup time</h2><div class="ck-days" role="group" aria-label="Pickup date">';
  dateList().forEach(function (d) { h += '<button type="button" class="ck-chip" data-date="' + d + '" aria-pressed="' + (d === S.date) + '">' + (d === S.today ? "Today" : dayName(d)) + "</button>"; });
  h += '</div><div class="ck-times" role="group" aria-label="Pickup time">';
  if (!S.slots.length) h += '<p class="ck-note">No pickup times left on this day. Please choose another day.</p>';
  ["l", "d"].forEach(function (m) { var xs = S.slots.filter(function (s) { return s.meal === m; }); if (!xs.length) return; h += '<span class="ck-m">' + (m === "l" ? "Lunch" : "Dinner") + "</span>"; xs.forEach(function (s) { h += '<button type="button" class="ck-chip" data-time="' + s.time + '"' + (s.full ? " disabled" : "") + ' aria-pressed="' + (s.time === S.time) + '">' + t12(s.time) + "</button>"; }); });
  h += "</div>";
  if (ok && q.conflicts.length) q.conflicts.forEach(function (c) { h += '<p class="ck-bad">' + esc(c.reason) + ' <button type="button" class="ck-rm" data-rm="' + esc(c.sku) + '">Remove it</button></p>'; });
  h += '<p class="ck-note">Lunch 12:00 to 4:30 pm (Mon till 4:00 pm). Dinner 7:00 to 11:30 pm. Thali is lunch only. Combos are dinner only. Ready about 25 minutes after you order.</p></section>';
  /* 2 cart */
  h += '<section class="ck-c" aria-labelledby="h2"><h2 id="h2"><i>2</i>Your order</h2>';
  (ok ? q.lines : lines().map(function (l) { var it = S.bySku[l.sku]; return { sku: l.sku, name: it.name, qty: l.qty, lineMinor: it.priceMinor * l.qty }; })).forEach(function (l) {
    h += '<div class="ck-ln"><b>' + esc(l.name) + '</b><span class="p">' + rs(l.lineMinor) + '</span><span class="ck-q"><button type="button" data-d="-1" data-sku="' + esc(l.sku) + '" aria-label="One less ' + esc(l.name) + '">&minus;</button><output>' + l.qty + '</output><button type="button" data-d="1" data-sku="' + esc(l.sku) + '" aria-label="One more ' + esc(l.name) + '">+</button></span><button type="button" class="ck-rm" data-rm="' + esc(l.sku) + '">Remove</button></div>';
  });
  h += '<label class="ck-f" for="ck-note">Order note (optional)</label><textarea class="ck-in" id="ck-note" maxlength="200" placeholder="For example: less spicy">' + esc(S.note) + "</textarea></section>";
  /* 3 details */
  h += '<section class="ck-c" aria-labelledby="h3"><h2 id="h3"><i>3</i>Your details</h2>';
  if (!S.token) {
    h += '<div class="ck-tabs"><button type="button" class="ck-chip" data-mode="guest" aria-pressed="' + (S.mode === "guest") + '">Order as guest</button><button type="button" class="ck-chip" data-mode="join" aria-pressed="' + (S.mode === "join") + '">Sign in or join</button></div>';
    h += '<label class="ck-f" for="ck-ph">Mobile number</label><div class="ck-row"><input class="ck-in" id="ck-ph" type="tel" inputmode="numeric" autocomplete="tel-national" maxlength="14" placeholder="10-digit mobile" value="' + esc(S.phone) + '"><button type="button" class="ck-btn" data-act="send">' + (S.otpSent ? "Resend" : "Send code") + "</button></div>";
    if (S.otpSent) h += '<label class="ck-f" for="ck-otp">6-digit code</label><div class="ck-row"><input class="ck-in" id="ck-otp" type="text" inputmode="numeric" autocomplete="one-time-code" maxlength="6" placeholder="Code from SMS"><button type="button" class="ck-btn p" data-act="verify">Verify</button></div>' + (S.dev ? '<p class="ck-ok">Test code (demo only): <b>' + esc(S.dev) + "</b></p>" : "");
    h += '<div id="ck-otpmsg"></div><p class="ck-note">We send a code to confirm your number. We use it only for this order and your Village Club points.</p>';
  } else {
    h += '<p class="ck-ok">Mobile verified: <b>+91 ' + esc(S.phone) + '</b> <button type="button" class="ck-rm" data-act="change">Change</button></p>';
    h += '<label class="ck-f" for="ck-nm">Name</label><input class="ck-in" id="ck-nm" autocomplete="name" maxlength="60" value="' + esc(S.name) + '"><label class="ck-f" for="ck-em">Email (optional)</label><input class="ck-in" id="ck-em" type="email" autocomplete="email" maxlength="120" value="' + esc(S.email) + '">';
  }
  h += "</section>";
  /* rewards */
  if (ok) {
    h += '<section class="ck-c" aria-label="Rewards"><div class="ck-pt">';
    if (S.ver && S.ver.member) h += "Village Club member. You have <b>" + S.ver.points + "</b> points. This order earns <b>" + q.pointsToEarn + "</b> points once collected and billed at the counter.";
    else if (S.ver) h += 'This order would earn <b>' + q.pointsToEarn + '</b> points. <label class="ck-chk" style="color:#FFF4D6"><input type="checkbox" id="ck-join"' + (S.join ? " checked" : "") + '> Join Village Club free to earn them</label>';
    else h += 'This order would earn <b>' + q.pointsToEarn + "</b> Village Club points. Verify your mobile and join to earn them.";
    h += '</div><p class="ck-note">Rs 1 = 1 point on the dish total before tax. Rewards are redeemed at the restaurant. <a href="rewards.html">How rewards work</a></p></section>';
  }
  /* 4 summary */
  h += '<section class="ck-c" aria-labelledby="h4"><h2 id="h4"><i>4</i>Payment</h2>';
  if (ok) {
    h += '<div class="ck-sum"><span>Dish total</span><span class="r">' + rs(q.subtotalMinor) + "</span><span>GST (" + q.gstPct + "%)" + (q.gstAssumed ? " *" : "") + '</span><span class="r">' + rs(q.taxMinor) + '</span><span class="t">Total to pay</span><span class="t r">' + rs(q.totalMinor) + "</span></div>";
    if (q.gstAssumed) h += '<p class="ck-note">* GST rate is a placeholder until the restaurant confirms it. The final bill is printed at the counter.</p>';
    h += '<div class="ck-pay" role="radiogroup" aria-label="How to pay">';
    h += '<label class="ck-opt"><input type="radio" name="pm" value="payu"' + (S.method === "payu" ? " checked" : "") + '><span><b>Pay online now</b><small>UPI, cards and net banking on PayU</small></span></label>';
    var cod = q.methods.indexOf("cod") >= 0, why = { over_limit: "Pay at pickup is for orders up to " + rs(S.menu.codMaxMinor) + ". Please pay online.", noshows: "Pay at pickup is not available on this number. Please pay online.", open_cap: "You already have open pay at pickup orders. Please pay online or collect them first.", off: "Pay at pickup is not available right now." }[q.codReason] || "";
    h += '<label class="ck-opt' + (cod ? "" : " off") + '"><input type="radio" name="pm" value="cod"' + (cod ? "" : " disabled") + (S.method === "cod" ? " checked" : "") + '><span><b>Pay at pickup</b><small>' + (cod ? "Pay at the counter when you collect (orders up to " + rs(S.menu.codMaxMinor) + ")" : esc(why)) + "</small></span></label></div>";
  } else if (q && q.error) h += '<p class="ck-bad">' + esc(q.error) + "</p>"; else h += '<p class="ck-note">Pricing...</p>';
  /* consent + place */
  h += '<label class="ck-chk"><input type="checkbox" id="ck-terms"' + (S.terms ? " checked" : "") + '><span>I accept the <a href="terms.html" target="_blank" rel="noopener">Terms</a> and <a href="privacy.html" target="_blank" rel="noopener">Privacy Policy</a>. (Required)</span></label>';
  h += '<label class="ck-chk"><input type="checkbox" id="ck-mkt"' + (S.mkt ? " checked" : "") + '><span>Send me offers and Village Club news on WhatsApp or SMS. (Optional)</span></label>';
  h += '<div id="ck-err"></div><button type="button" class="ck-btn p w" data-act="place"' + (S.busy ? " disabled" : "") + ">" + (S.busy ? "Please wait..." : S.method === "cod" ? "Place order" : "Pay " + (ok ? rs(q.totalMinor) : "") + " and place order") + '</button></section>';
  var keep = document.activeElement && document.activeElement.id, pos = keep && document.activeElement.selectionStart;
  root.innerHTML = h; if (keep) { var el = document.getElementById(keep); if (el) { el.focus(); try { if (pos != null) el.setSelectionRange(pos, pos); } catch (e) {} } }
}
function err(m) { var e = $("#ck-err"); if (e) { e.innerHTML = m ? '<p class="ck-bad" role="alert">' + esc(m) + "</p>" : ""; if (m) e.scrollIntoView({ block: "center", behavior: "smooth" }); } }

/* ---------- events ---------- */
function onClick(e) {
  var b = e.target.closest("[data-date],[data-time],[data-d],[data-rm],[data-mode],[data-act]"); if (!b) return; var a = b.dataset;
  if (a.date) return loadSlots(a.date, function () { requote(render); render(); });
  if (a.time) { S.time = a.time; render(); return requote(render); }
  if (a.d) { var s = a.sku, n = (S.cart[s] || 0) + +a.d; if (n < 1) delete S.cart[s]; else S.cart[s] = Math.min(20, n); saveCart(); render(); return requote(render); }
  if (a.rm) { delete S.cart[a.rm]; saveCart(); render(); return requote(render); }
  if (a.mode) { S.mode = a.mode; return render(); }
  if (a.act === "send") return sendCode(b);
  if (a.act === "verify") return verify(b);
  if (a.act === "change") { S.token = null; S.ver = null; S.otpSent = false; S.dev = null; return render(); }
  if (a.act === "place") return place();
}
function onInput(e) {
  var t = e.target;
  if (t.id === "ck-ph") S.phone = t.value.replace(/[^\d+ ]/g, ""); else if (t.id === "ck-note") S.note = t.value; else if (t.id === "ck-nm") S.name = t.value; else if (t.id === "ck-em") S.email = t.value;
  else if (t.id === "ck-terms") S.terms = t.checked; else if (t.id === "ck-mkt") S.mkt = t.checked; else if (t.id === "ck-join") S.join = t.checked;
  else if (t.name === "pm") { S.method = t.value; render(); }
}
function msg(m, good) { var e = $("#ck-otpmsg"); if (e) e.innerHTML = m ? '<p class="' + (good ? "ck-ok" : "ck-bad") + '" role="alert">' + esc(m) + "</p>" : ""; }
function sendCode(btn) {
  btn.disabled = true; msg("");
  api("/api/otp/send", { phone: S.phone }).then(function (j) { btn.disabled = false;
    if (!j.ok) return msg(j.message); S.otpSent = true; S.dev = j.devCode || null; render(); var o = $("#ck-otp"); if (o) o.focus(); });
}
function verify(btn) {
  var code = ($("#ck-otp") || {}).value || ""; btn.disabled = true; msg("");
  api("/api/otp/verify", { phone: S.phone, code: code, purpose: "checkout" }).then(function (j) { btn.disabled = false;
    if (!j.ok) return msg(j.message + (j.triesLeft != null ? " (" + j.triesLeft + " tries left)" : ""));
    S.token = j.token; S.ver = j; S.phone = S.phone.replace(/[\s\-()]/g, "").replace(/^(\+?91|0)(?=\d{10}$)/, ""); if (j.name && !S.name) S.name = j.name; if (j.member) S.join = false;
    store("mobile", S.phone); render(); requote(render); });
}
function place() {
  if (S.busy) return; err("");
  if (!S.q || !S.q.ok) return err("Please fix your order first.");
  if (!S.date || !S.time) return err("Please choose a pickup day and time.");
  if (S.q.conflicts.length) return err(S.q.conflicts[0].reason);
  if (!S.token) return err("Please verify your mobile number first.");
  if (!S.name.trim()) return err("Please enter your name.");
  if (S.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(S.email.trim())) return err("That email address does not look right.");
  if (!S.method) return err("Please choose how to pay.");
  if (!S.terms) return err("Please accept the Terms and Privacy Policy to place your order.");
  S.busy = true; render(); store("name", S.name.trim());
  api("/api/checkout/start", { token: S.token, lines: lines(), slot: { date: S.date, time: S.time }, method: S.method, name: S.name, email: S.email, note: S.note, join: S.join, consent: { terms: S.terms, marketing: S.mkt } }).then(function (j) {
    if (!j.ok) { S.busy = false; if (j.error === "bad_token" || j.error === "token_used") { S.token = null; S.ver = null; S.otpSent = false; S.dev = null; } render(); return err(j.message); }
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
      h += "<p>" + (j.method === "cod" ? "Pay at pickup: <b>" + rs(j.totalMinor) + "</b>" : "Total: <b>" + rs(j.totalMinor) + "</b>") + "</p>";
      if (j.items.length) h += '<p class="ck-note">' + j.items.map(function (i) { return esc(i.qty + " x " + i.name); }).join(", ") + "</p>";
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
  function draw(extra) { root.innerHTML = '<h1>Find my orders</h1><section class="ck-c"><label class="ck-f" for="lk-ph">Mobile number</label><div class="ck-row"><input class="ck-in" id="lk-ph" type="tel" inputmode="numeric" maxlength="14" value="' + esc(L.phone) + '"><button class="ck-btn" id="lk-send" type="button">Send code</button></div><div class="ck-row" style="margin-top:10px"><input class="ck-in" id="lk-otp" inputmode="numeric" maxlength="6" placeholder="6-digit code"><button class="ck-btn p" id="lk-go" type="button">Show orders</button></div><div id="lk-m"></div>' + (extra || "") + "</section>"; }
  draw();
  root.addEventListener("click", function (e) {
    var m = function (t, g) { $("#lk-m").innerHTML = t ? '<p class="' + (g ? "ck-ok" : "ck-bad") + '">' + esc(t) + "</p>" : ""; };
    if (e.target.id === "lk-send") { L.phone = $("#lk-ph").value; api("/api/otp/send", { phone: L.phone }).then(function (j) { m(j.ok ? (j.devCode ? "Test code (demo only): " + j.devCode : "Code sent.") : j.message, j.ok); }); }
    if (e.target.id === "lk-go") { api("/api/otp/verify", { phone: $("#lk-ph").value, code: $("#lk-otp").value, purpose: "lookup" }).then(function (j) { if (!j.ok) return m(j.message); api("/api/order/lookup", { token: j.token }).then(function (r) { var h = r.orders && r.orders.length ? r.orders.map(function (o) { return '<p><a href="checkout.html?o=' + o.id + '"><b>' + o.id + "</b></a> &middot; " + esc(dayName(o.slot.date)) + " " + t12(o.slot.time) + " &middot; " + rs(o.totalMinor) + " &middot; " + esc(o.stage.replace(/_/g, " ")) + "</p>"; }).join("") : "<p>No orders found for this number.</p>"; m(""); $("#lk-m").innerHTML = h; }); }); }
  });
}

/* ---------- start ---------- */
function unavailable() {
  root.innerHTML = '<h1>Online ordering opens soon</h1><div class="ck-c"><p>We are not taking online take away orders yet. You can still order on WhatsApp or call us.</p><p><a class="ck-btn p w" href="' + WA + '" target="_blank" rel="noopener">Order on WhatsApp</a></p><p><a class="ck-btn w" href="menu.html">Back to menu</a></p></div>';
}
function start() {
  var qs = new URLSearchParams(location.search);
  $("#ck-find").addEventListener("click", function (e) { e.preventDefault(); history.pushState(null, "", "checkout.html?find=1"); lookupView(); });
  if (qs.get("o")) return statusView(qs.get("o"));
  if (qs.get("find")) return lookupView();
  api("/api/menu").then(function (m) {
    if (!m.ok || !m.live) return unavailable();
    S.menu = m; m.items.forEach(function (i) { S.byK[i.k] = i; S.bySku[i.sku] = i; }); loadCart();
    S.phone = store("mobile") || ""; S.name = store("name") || "";
    api("/api/slots").then(function (s) {
      if (!s.ok) return unavailable(); S.today = s.today; S.days = s.days;
      var first = s.slots.length ? s.date : null, i = 0, ds = dateList();
      function pick(k) { if (k >= ds.length) { loadSlots(s.date, go); return; } api("/api/slots?date=" + ds[k]).then(function (r) { if (r.ok && r.slots.length) { S.date = ds[k]; S.slots = r.slots; go(); } else pick(k + 1); }); }
      function go() { render(); requote(render); }
      pick(0);
    });
  });
  root.addEventListener("click", onClick); root.addEventListener("input", onInput); root.addEventListener("change", onInput);
}
start();
})();
