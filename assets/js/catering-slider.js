/* Catering hero: event-wise slider (moves left to right) with a canvas effect per event */
(function () {
  'use strict';
  var root = document.querySelector('.chs');
  if (!root) return;
  var view = root.querySelector('.chs-view');
  var slides = [].slice.call(root.querySelectorAll('.chs-sl'));
  var cv = root.querySelector('.chs-fx');
  var dotsBox = root.querySelector('.chs-dots');
  var capT = root.querySelector('.chs-t'), capD = root.querySelector('.chs-d');
  var pauseBtn = root.querySelector('.chs-pause');
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var cur = 0, busy = false, timer = null, holdUntil = 0, userPaused = false, inView = true, ready = false;
  var DELAY = 5400, SPEED = 850;

  /* ---- load the later slides only after the page has finished loading ---- */
  function loadRest() {
    slides.forEach(function (s) {
      var im = s.querySelector('img[data-src]');
      if (!im) return;
      if (im.dataset.srcset) im.srcset = im.dataset.srcset;
      im.src = im.dataset.src;
      im.removeAttribute('data-src'); im.removeAttribute('data-srcset');
    });
  }
  if (document.readyState === 'complete') setTimeout(loadRest, 300);
  else window.addEventListener('load', function () { setTimeout(loadRest, 300); });

  /* ---- slides ---- */
  function place(el, x, anim) {
    el.style.transition = anim ? 'transform ' + SPEED + 'ms cubic-bezier(.65,0,.25,1)' : 'none';
    el.style.transform = 'translate3d(' + x + '%,0,0)';
  }
  slides.forEach(function (s, i) { place(s, i === 0 ? 0 : -100, false); });
  slides[0].classList.add('on');

  slides.forEach(function (s, i) {
    var b = document.createElement('button');
    b.type = 'button'; b.className = 'chs-dot';
    b.setAttribute('aria-label', 'Show ' + s.dataset.t);
    b.addEventListener('click', function () { hold(12000); go(i, i > cur ? 1 : -1); });
    dotsBox.appendChild(b);
  });
  var dots = [].slice.call(dotsBox.children);

  function paint() {
    dots.forEach(function (d, i) { d.setAttribute('aria-current', i === cur ? 'true' : 'false'); });
    capT.textContent = slides[cur].dataset.t;
    capD.textContent = slides[cur].dataset.d;
    root.setAttribute('data-k', slides[cur].dataset.k);
    fx.set(slides[cur].dataset.k);
  }

  /* dir 1: new picture comes in from the left and the old one leaves to the right */
  function go(n, dir) {
    n = (n + slides.length) % slides.length;
    if (n === cur || busy) return;
    busy = true;
    var from = slides[cur], to = slides[n];
    place(to, -100 * dir, false);
    void to.offsetWidth;
    to.classList.add('on');
    place(to, 0, true); place(from, 100 * dir, true);
    from.classList.remove('on');
    cur = n; paint();
    setTimeout(function () { busy = false; }, SPEED + 40);
  }

  /* ---- autoplay ---- */
  function hold(ms) { holdUntil = Date.now() + ms; }
  function tick() {
    if (reduce || userPaused || !inView || document.hidden || Date.now() < holdUntil) return;
    go(cur + 1, 1);
  }
  function startTimer() { if (!timer && !reduce) timer = setInterval(tick, DELAY); }
  function stopTimer() { if (timer) { clearInterval(timer); timer = null; } }

  root.querySelector('.chs-prev').addEventListener('click', function () { hold(12000); go(cur - 1, -1); });
  root.querySelector('.chs-next').addEventListener('click', function () { hold(12000); go(cur + 1, 1); });
  if (pauseBtn) {
    if (reduce) { pauseBtn.hidden = true; }
    pauseBtn.addEventListener('click', function () {
      userPaused = !userPaused;
      pauseBtn.setAttribute('aria-pressed', String(userPaused));
      pauseBtn.setAttribute('aria-label', userPaused ? 'Play slideshow' : 'Pause slideshow');
      pauseBtn.classList.toggle('is-paused', userPaused);
      fx.run(!userPaused);
    });
  }
  view.addEventListener('mouseenter', function () { hold(6000); });
  root.addEventListener('focusin', function () { hold(8000); });
  root.addEventListener('keydown', function (e) {
    if (e.key === 'ArrowRight') { hold(12000); go(cur + 1, 1); }
    else if (e.key === 'ArrowLeft') { hold(12000); go(cur - 1, -1); }
  });

  /* swipe: dragging right brings the picture in from the left */
  var sx = null, sy = 0;
  view.addEventListener('pointerdown', function (e) { sx = e.clientX; sy = e.clientY; hold(8000); });
  view.addEventListener('pointerup', function (e) {
    if (sx === null) return;
    var dx = e.clientX - sx, dy = e.clientY - sy; sx = null;
    if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) { hold(12000); go(dx > 0 ? cur + 1 : cur - 1, dx > 0 ? 1 : -1); }
  });
  view.addEventListener('pointercancel', function () { sx = null; });

  /* ---- form chips and "quote for this" links jump the slider to that event ---- */
  var map = { 'Wedding / function': 0, 'Festival / house party': 1, 'Birthday': 2, 'Corporate / gathering': 3, 'Other function / event': 4 };
  document.querySelectorAll('.ch-form input[name="Event"]').forEach(function (r) {
    r.addEventListener('change', function () {
      if (map[r.value] === undefined) return;
      hold(12000); go(map[r.value], map[r.value] > cur ? 1 : -1);
    });
  });
  document.querySelectorAll('[data-ev]').forEach(function (a) {
    a.addEventListener('click', function () {
      var i = Number(a.dataset.ev), radios = document.querySelectorAll('.ch-form input[name="Event"]');
      if (radios[i]) { radios[i].checked = true; }
      hold(12000); go(i, i > cur ? 1 : -1);
    });
  });

  /* ---- effects: one small particle system, a different look per event ---- */
  var fx = (function () {
    var ctx = cv.getContext('2d'), w = 0, h = 0, dpr = 1, kind = '', P = [], last = 0, raf = 0, on = false;
    var small = window.matchMedia('(max-width:900px)').matches;
    var N = small ? 0.65 : 1;
    function rnd(a, b) { return a + Math.random() * (b - a); }
    function pick(a) { return a[(Math.random() * a.length) | 0]; }
    function size() {
      var r = cv.getBoundingClientRect();
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = Math.max(1, r.width); h = Math.max(1, r.height);
      cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    var PET = ['#F28C1B', '#F7B12E', '#E0502B', '#FFF4D6'], CON = ['#F7B12E', '#2f9a5c', '#fff6df', '#E86F8C', '#6bb7e8'];
    function petal() { return { t: 'petal', x: rnd(0, w), y: rnd(-h * .2, h), vy: rnd(18, 34), vx: rnd(-8, 8), s: rnd(5, 9), a: rnd(0, 6.3), va: rnd(-1.4, 1.4), ph: rnd(0, 6.3), c: pick(PET) }; }
    function spark(top) { return { t: 'spark', x: rnd(w * .1, w * .9), y: rnd(h * (top ? .08 : .1), h * (top ? .3 : .85)), s: rnd(2, 4.5), ph: rnd(0, 6.3), sp: rnd(1.2, 2.6) }; }
    function conf() { return { t: 'conf', x: rnd(0, w), y: rnd(-h * .3, h), vy: rnd(40, 80), vx: rnd(-14, 14), w: rnd(5, 9), l: rnd(8, 14), a: rnd(0, 6.3), va: rnd(-5, 5), ph: rnd(0, 6.3), c: pick(CON) }; }
    function steam(x0, y0) { return { t: 'steam', x: x0 + rnd(-18, 18), y: y0, x0: x0, vy: rnd(14, 26), r: rnd(14, 26), life: rnd(0, 1), ph: rnd(0, 6.3) }; }
    function fly() { return { t: 'fly', x: rnd(w * .05, w * .95), y: rnd(h * .3, h * .9), a: rnd(0, 6.3), sp: rnd(10, 22), ph: rnd(0, 6.3), r: rnd(2, 3.6) }; }
    function mote() { return { t: 'mote', x: rnd(0, w), y: rnd(0, h), vy: rnd(-10, -4), r: rnd(1.2, 2.6), ph: rnd(0, 6.3) }; }
    function build(k) {
      var a = [], i, n = function (x) { return Math.round(x * N); };
      if (k === 'wedding') { for (i = 0; i < n(26); i++) a.push(petal()); for (i = 0; i < n(14); i++) a.push(spark(false)); }
      else if (k === 'feast') {
        for (i = 0; i < n(4); i++) a.push(steam(w * .20, h * .435));
        for (i = 0; i < n(4); i++) a.push(steam(w * .305, h * .44));
        for (i = 0; i < n(3); i++) a.push(steam(w * .39, h * .435));
        for (i = 0; i < n(8); i++) a.push(mote());
      }
      else if (k === 'birthday') { for (i = 0; i < n(36); i++) a.push(conf()); for (i = 0; i < n(8); i++) a.push(spark(true)); }
      else if (k === 'corporate') { for (i = 0; i < n(26); i++) a.push(spark(true)); }
      else if (k === 'function') { for (i = 0; i < n(14); i++) a.push(petal()); for (i = 0; i < n(14); i++) a.push(conf()); for (i = 0; i < n(10); i++) a.push(spark(false)); }
      else if (k === 'village') { for (i = 0; i < n(20); i++) a.push(fly()); }
      else { for (i = 0; i < n(18); i++) a.push(mote()); }
      return a;
    }
    function star(x, y, s, al) {
      ctx.globalAlpha = al; ctx.fillStyle = '#FFD25E';
      ctx.beginPath();
      ctx.moveTo(x, y - s * 2); ctx.lineTo(x + s * .5, y - s * .5); ctx.lineTo(x + s * 2, y); ctx.lineTo(x + s * .5, y + s * .5);
      ctx.lineTo(x, y + s * 2); ctx.lineTo(x - s * .5, y + s * .5); ctx.lineTo(x - s * 2, y); ctx.lineTo(x - s * .5, y - s * .5); ctx.closePath(); ctx.fill();
    }
    function frame(ts) {
      raf = 0; if (!on) return;
      var dt = Math.min(.05, (ts - last) / 1000 || .016); last = ts;
      ctx.clearRect(0, 0, w, h);
      for (var i = 0; i < P.length; i++) {
        var p = P[i];
        if (p.t === 'petal') {
          p.y += p.vy * dt; p.x += (p.vx + Math.sin(ts / 900 + p.ph) * 14) * dt; p.a += p.va * dt;
          if (p.y > h + 12) { p.y = -12; p.x = rnd(0, w); }
          ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.a); ctx.globalAlpha = .9; ctx.fillStyle = p.c;
          ctx.beginPath(); ctx.ellipse(0, 0, p.s, p.s * .55, 0, 0, 6.3); ctx.fill(); ctx.restore();
        } else if (p.t === 'spark') {
          star(p.x, p.y, p.s, Math.max(0, Math.sin(ts / 1000 * p.sp + p.ph)) * .95);
        } else if (p.t === 'conf') {
          p.y += p.vy * dt; p.x += (p.vx + Math.sin(ts / 700 + p.ph) * 10) * dt; p.a += p.va * dt;
          if (p.y > h + 14) { p.y = -14; p.x = rnd(0, w); }
          ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.a); ctx.globalAlpha = .92; ctx.fillStyle = p.c;
          ctx.fillRect(-p.w / 2, -p.l / 2, p.w, p.l * Math.abs(Math.cos(p.a * .7)) + 2); ctx.restore();
        } else if (p.t === 'steam') {
          p.life += dt * .32; if (p.life >= 1) { p.life = 0; p.y = p.y0 || p.y; }
          var up = p.life * h * .22, al = Math.sin(p.life * 3.14159) * .34;
          var sx2 = p.x0 + Math.sin(ts / 1200 + p.ph) * 14 + (p.x - p.x0) * .4, sy2 = (p.base || (p.base = p.y)) - up;
          var rr = p.r * (1 + p.life * 1.6), g = ctx.createRadialGradient(sx2, sy2, 0, sx2, sy2, rr);
          g.addColorStop(0, 'rgba(255,255,255,' + al + ')'); g.addColorStop(1, 'rgba(255,255,255,0)');
          ctx.globalAlpha = 1; ctx.fillStyle = g; ctx.beginPath(); ctx.arc(sx2, sy2, rr, 0, 6.3); ctx.fill();
        } else if (p.t === 'fly') {
          p.a += Math.sin(ts / 1300 + p.ph) * dt * 1.4; p.x += Math.cos(p.a) * p.sp * dt; p.y += Math.sin(p.a) * p.sp * dt;
          if (p.x < 0) p.x = w; else if (p.x > w) p.x = 0; if (p.y < h * .25) p.y = h * .9; else if (p.y > h) p.y = h * .3;
          var gl = Math.max(0, Math.sin(ts / 700 + p.ph)) * .95, g2 = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * 4);
          g2.addColorStop(0, 'rgba(255,224,120,' + gl + ')'); g2.addColorStop(1, 'rgba(255,200,60,0)');
          ctx.globalAlpha = 1; ctx.fillStyle = g2; ctx.beginPath(); ctx.arc(p.x, p.y, p.r * 4, 0, 6.3); ctx.fill();
        } else {
          p.y += p.vy * dt; p.x += Math.sin(ts / 1500 + p.ph) * 6 * dt;
          if (p.y < -6) { p.y = h + 6; p.x = rnd(0, w); }
          ctx.globalAlpha = .35 + .4 * Math.sin(ts / 900 + p.ph); ctx.fillStyle = '#E9B23A';
          ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 6.3); ctx.fill();
        }
      }
      ctx.globalAlpha = 1;
      raf = requestAnimationFrame(frame);
    }
    function run(v) {
      on = v && !reduce && inView && !document.hidden;
      if (on && !raf) { last = performance.now(); raf = requestAnimationFrame(frame); }
      if (!on) { cancelAnimationFrame(raf); raf = 0; ctx.clearRect(0, 0, w, h); }
    }
    function set(k) { kind = k; size(); P = build(k); run(!userPaused); }
    if ('ResizeObserver' in window) new ResizeObserver(function () { size(); P = build(kind); }).observe(view);
    else window.addEventListener('resize', function () { size(); P = build(kind); });
    return { set: set, run: run };
  })();

  /* pause everything while the hero is off screen or the tab is hidden */
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (en) {
      inView = en[0].isIntersecting; fx.run(!userPaused);
    }, { threshold: 0.15 }).observe(root);
  }
  document.addEventListener('visibilitychange', function () { fx.run(!userPaused); });

  paint(); startTimer(); ready = true;
})();
