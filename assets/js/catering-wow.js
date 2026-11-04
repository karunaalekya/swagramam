/* Catering hero: wash reveal, parallax, golden dust, occasion focus chips */
(function () {
  var root = document.getElementById('catering-wow');
  if (!root) return;
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var img = root.querySelector('.cw-img');
  var stage = root.querySelector('.cw-stage');
  var canvas = root.querySelector('.cw-dust');
  var chips = root.querySelectorAll('.cw-chip');
  var isPhone = function () { return window.matchMedia('(max-width: 760px)').matches; };

  root.classList.add('js');

  /* 1. reveal once the artwork is decoded, so the wash never plays on an empty frame */
  function start() {
    if (root.classList.contains('is-in')) return;
    root.classList.add('is-in');
    setTimeout(function () { root.classList.add('is-done'); }, reduce ? 0 : 2600);
  }
  var io = new IntersectionObserver(function (e) {
    if (e[0].isIntersecting) { (img.decode ? img.decode().catch(function () {}) : Promise.resolve()).then(start); io.disconnect(); }
  }, { threshold: 0.15 });
  io.observe(root);

  /* 2. occasion chips: glide into that part of the artwork (zoom on desktop, pan on phone) */
  var focus = [
    { x: 12, label: 'wedding' }, { x: 38, label: 'feast' },
    { x: 60, label: 'birthday' }, { x: 86, label: 'corporate' }
  ];
  function setFocus(i) {
    var on = chips[i].getAttribute('aria-pressed') !== 'true';
    chips.forEach(function (c) { c.setAttribute('aria-pressed', 'false'); });
    root.classList.remove('is-zoom');
    if (!on) { img.style.objectPosition = ''; return; }
    chips[i].setAttribute('aria-pressed', 'true');
    if (isPhone() && !root.classList.contains('has-mobile')) {
      img.style.animation = 'none';
      img.style.objectPosition = focus[i].x + '% 50%';
      img.style.transition = 'object-position 1s cubic-bezier(.22,.8,.2,1)';
    } else if (!isPhone()) {
      root.style.setProperty('--cw-ox', focus[i].x + '%');
      root.style.setProperty('--cw-oy', '45%');
      root.style.setProperty('--cw-lx', focus[i].x + '%');
      root.classList.add('is-zoom');
    }
  }
  chips.forEach(function (c, i) { c.addEventListener('click', function () { setFocus(i); }); });

  if (reduce) return;

  /* 3. gentle parallax from pointer (desktop) */
  if (window.matchMedia('(hover:hover)').matches) {
    stage.addEventListener('pointermove', function (e) {
      if (root.classList.contains('is-zoom')) return;
      var r = stage.getBoundingClientRect();
      root.style.setProperty('--cw-px', ((e.clientX - r.left) / r.width - 0.5) * -14 + 'px');
      root.style.setProperty('--cw-py', ((e.clientY - r.top) / r.height - 0.5) * -8 + 'px');
      root.style.setProperty('--cw-lx', ((e.clientX - r.left) / r.width) * 100 + '%');
    });
    stage.addEventListener('pointerleave', function () {
      root.style.setProperty('--cw-px', '0px'); root.style.setProperty('--cw-py', '0px');
    });
  }

  /* 4. golden dust / fireflies, paused when off screen or tab hidden */
  var ctx = canvas.getContext('2d'), W, H, dots = [], raf = 0, visible = false;
  function size() {
    var d = Math.min(window.devicePixelRatio || 1, 2);
    W = canvas.clientWidth; H = canvas.clientHeight;
    canvas.width = W * d; canvas.height = H * d; ctx.setTransform(d, 0, 0, d, 0, 0);
    var n = Math.min(38, Math.round(W / 38));
    dots = [];
    for (var i = 0; i < n; i++) dots.push({
      x: Math.random() * W, y: Math.random() * H, r: 0.8 + Math.random() * 2.2,
      vx: (Math.random() - 0.5) * 0.18, vy: -0.08 - Math.random() * 0.28,
      p: Math.random() * 6.28, s: 0.6 + Math.random() * 1.2
    });
  }
  function tick(t) {
    ctx.clearRect(0, 0, W, H);
    for (var i = 0; i < dots.length; i++) {
      var d = dots[i];
      d.x += d.vx + Math.sin(t / 1800 + d.p) * 0.12; d.y += d.vy;
      if (d.y < -6) { d.y = H + 6; d.x = Math.random() * W; }
      var a = 0.25 + 0.45 * (0.5 + 0.5 * Math.sin(t / 700 * d.s + d.p));
      var g = ctx.createRadialGradient(d.x, d.y, 0, d.x, d.y, d.r * 4);
      g.addColorStop(0, 'rgba(236,178,52,' + a + ')'); g.addColorStop(1, 'rgba(236,178,52,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(d.x, d.y, d.r * 4, 0, 6.28); ctx.fill();
    }
    raf = requestAnimationFrame(tick);
  }
  function run() { if (!raf && visible && !document.hidden) raf = requestAnimationFrame(tick); }
  function halt() { cancelAnimationFrame(raf); raf = 0; }
  size();
  window.addEventListener('resize', size);
  new IntersectionObserver(function (e) { visible = e[0].isIntersecting; visible ? run() : halt(); }).observe(stage);
  document.addEventListener('visibilitychange', function () { document.hidden ? halt() : run(); });
})();
