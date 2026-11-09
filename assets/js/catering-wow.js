/* Catering enquiry: validation, email POST + WhatsApp hand-off, success state, tracking, sticky quote bar */
(function () {
  'use strict';
  var card = document.getElementById('cq');
  var form = card && card.querySelector('form.ch-form');
  if (!form) return;

  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var ok = card.querySelector('.ch-ok');
  var btn = form.querySelector('.ch-btn');
  var $ = function (n) { return form.elements[n]; };
  var errEl = function (n) { return document.getElementById('e-' + n); };

  /* date: no past days */
  var d = new Date(), pad = function (x) { return (x < 10 ? '0' : '') + x; };
  var today = d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  $('Date').min = today;

  /* optional venue field */
  var more = form.querySelector('.ch-more'), venue = document.getElementById('ch-venue');
  more.addEventListener('click', function () {
    var open = venue.hidden;
    venue.hidden = !open;
    more.setAttribute('aria-expanded', String(open));
    more.textContent = open ? '\u2212 Hide venue' : '+ Add venue (optional)';
    if (open) $('Venue').focus();
  });

  /* ---- validation ---- */
  function cleanPhone(v) {
    var n = String(v || '').replace(/\D/g, '');
    if (n.length === 12 && n.indexOf('91') === 0) n = n.slice(2);
    else if (n.length === 11 && n.charAt(0) === '0') n = n.slice(1);
    return n;
  }
  var rules = {
    Name: function (v) { return v.trim().length < 2 ? 'Please enter your name.' : ''; },
    Phone: function (v) {
      if (!v.trim()) return 'Please enter your mobile number.';
      return /^[6-9]\d{9}$/.test(cleanPhone(v)) ? '' : 'Enter a valid 10-digit Indian mobile number.';
    },
    Email: function (v) { return v.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim()) ? 'Enter a valid email, or leave it empty.' : ''; },
    Date: function (v) { return v && v < today ? 'Please pick today or a later date.' : ''; },
    Guests: function (v) {
      if (!v) return '';
      var n = Number(v);
      return (n >= 1 && n <= 10000 && Math.floor(n) === n) ? '' : 'Enter a number of guests, like 150.';
    }
  };
  function check(name) {
    var f = $(name), msg = rules[name](f.value), e = errEl(name);
    e.textContent = msg;
    f.setAttribute('aria-invalid', msg ? 'true' : 'false');
    return !msg;
  }
  Object.keys(rules).forEach(function (n) {
    var f = $(n);
    f.addEventListener('blur', function () { if (f.value || f.getAttribute('aria-invalid') === 'true') check(n); });
    f.addEventListener('input', function () { if (f.getAttribute('aria-invalid') === 'true') check(n); });
  });

  /* ---- submit ---- */
  function collect() {
    var data = {};
    ['Name', 'Phone', 'Email', 'Event', 'Date', 'Guests', 'Venue', 'Notes'].forEach(function (n) {
      var el = $(n), v = '';
      if (n === 'Event') v = (form.querySelector('input[name="Event"]:checked') || {}).value || '';
      else v = el.value.trim();
      if (n === 'Phone') v = cleanPhone(v);
      if (v) data[n] = v;
    });
    return data;
  }
  function waUrl(data) {
    var lines = Object.keys(data).map(function (k) { return k + ': ' + (k === 'Phone' ? '+91 ' + data[k] : data[k]); });
    return 'https://wa.me/' + form.dataset.wa + '?text=' + encodeURIComponent(form.dataset.intro + '\n' + lines.join('\n'));
  }
  function niceDate(v) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v || '');
    if (!m) return '';
    return Number(m[3]) + ' ' + ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][Number(m[2]) - 1] + ' ' + m[1];
  }
  function sendEmail(data) {
    var d = niceDate(data.Date), ph = data.Phone || '';
    var body = { access_key: form.dataset.key || '',
      subject: '[Swagramam] Catering enquiry \u2013 ' + (data.Event || 'Enquiry') + ' \u2013 ' + (d || 'date not given'),
      from_name: 'Swagramam website', botcheck: '',
      'Name': data.Name || '', 'Phone': '+91 ' + ph, 'Email': data.Email || '', 'Call': 'tel:+91' + ph, 'WhatsApp': 'https://wa.me/91' + ph,
      'Event type': data.Event || '', 'Event date': d, 'Number of guests': data.Guests || '',
      'Venue / location': data.Venue || '', 'Requirements': data.Notes || '', 'Submitted from': location.href };
    return fetch(form.dataset.endpoint, { method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' }, body: JSON.stringify(body) })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { if (!r.ok || !j.success) throw new Error('send failed'); }); });
  }
  var fail = form.querySelector('.ch-fail');
  function showFail() {
    fail.innerHTML = '';
    fail.appendChild(document.createTextNode("Sorry, that didn't go through. Please "));
    var a = document.createElement('a');
    a.href = 'https://wa.me/' + form.dataset.wa + '?text=' + encodeURIComponent(form.dataset.intro);
    a.target = '_blank'; a.rel = 'noopener'; a.textContent = 'WhatsApp us';
    fail.appendChild(a); fail.hidden = false;
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var hp = form.elements.botcheck;
    if (hp && hp.checked) return; /* bot: do nothing */
    var valid = true, first = null;
    ['Name', 'Phone', 'Email', 'Date', 'Guests'].forEach(function (n) {
      if (!check(n)) { valid = false; if (!first) first = $(n); }
    });
    if (!valid) { first.focus(); return; }

    var data = collect(), url = waUrl(data);
    fail.hidden = true; btn.disabled = true;
    sendEmail(data).then(function () {
      if (window.gtag) {
        gtag('event', 'catering_enquiry', { event_type: data.Event || 'not_set', guests: data.Guests ? Number(data.Guests) : 0, has_date: !!data.Date, page: location.pathname });
      }
      ok.querySelector('.ch-nm').textContent = data.Name ? ', ' + data.Name.split(/\s+/)[0] : '';
      ok.querySelector('.ch-ph').textContent = '+91 ' + data.Phone;
      ok.querySelector('.ch-wa').href = url;
      form.hidden = true; ok.hidden = false;
      ok.focus({ preventScroll: true });
      if (card.getBoundingClientRect().top < 0) card.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'center' });
    }).catch(function () { btn.disabled = false; showFail(); });
  });

  ok.querySelector('.ch-again').addEventListener('click', function () {
    form.reset(); btn.disabled = false; fail.hidden = true;
    form.querySelectorAll('[aria-invalid]').forEach(function (x) { x.removeAttribute('aria-invalid'); });
    form.querySelectorAll('.cherr').forEach(function (x) { x.textContent = ''; });
    ok.hidden = true; form.hidden = false; $('Name').focus();
  });

  /* ---- every "Get a quote" link scrolls to the form ---- */
  function goForm(ev) {
    ev.preventDefault();
    card.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
    setTimeout(function () { var t = form.hidden ? ok : $('Name'); t.focus({ preventScroll: true }); }, reduce ? 0 : 450);
  }
  document.querySelectorAll('a[href="#cq"]').forEach(function (a) { a.addEventListener('click', goForm); });

  /* ---- sticky bar (phones): shown only while the form is off screen ---- */
  var bar = document.getElementById('cq-bar');
  if (bar && 'IntersectionObserver' in window) {
    bar.hidden = false; bar.classList.add('off');
    var seen = false;
    new IntersectionObserver(function (en) {
      var on = en[0].isIntersecting;
      bar.classList.toggle('off', on);
      document.body.classList.toggle('cq-bar-on', !on);
      seen = true;
    }, { threshold: 0.12 }).observe(card);
  }
})();
