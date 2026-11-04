/* Menu page: the first 4 cards come toward the visitor, then settle back.
   Fires when each card enters view (re-fires when scrolled back to), and on hover / tap. */
(function () {
  var started = false;
  function init() {
  if (started) return;
  // If the 4 cards are not picked up, put the real selector first in this list.
  var SELECTORS = [
    '#mx-g > li',            /* menu.html: "Dish photos" 4-column grid, rendered by JS */
    '[data-menu-card]', '.menu-card', '.course-card', '.category-card', '.cat-card',
    '.explore-card', '.menu-cat', '.menu-category', '.dish-card', '.card'
  ];
  var cards = [];
  for (var s = 0; s < SELECTORS.length && cards.length < 2; s++) {
    cards = Array.prototype.slice.call(document.querySelectorAll('main ' + SELECTORS[s] + ', ' + SELECTORS[s]));
    cards = cards.filter(function (el, i, a) { return a.indexOf(el) === i; });
  }
  cards = cards.slice(0, 4);
  if (cards.length < 2) { return; }
  started = true;
  console.info('[menu-fly] animating', cards.length, 'cards via', cards[0].className || cards[0].tagName);

  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduce) return;

  // shared perspective on the nearest common parent
  var parent = cards[0].parentElement;
  while (parent && !cards.every(function (c) { return parent.contains(c); })) parent = parent.parentElement;
  (parent || document.body).classList.add('mf-stage');
  cards.forEach(function (c) { c.classList.add('mf-card'); });

  var rest = 'translate3d(0,0,0) scale(1) rotateX(0deg)';
  var near = 'translate3d(0,-10px,110px) scale(1.07) rotateX(-3deg)';
  function fly(card, delay) {
    if (!card.animate) return;
    card.animate([
      { transform: rest, boxShadow: '0 6px 14px rgba(40,30,10,.12)', offset: 0 },
      { transform: near, boxShadow: '0 34px 60px rgba(40,30,10,.34)', offset: 0.42 },
      { transform: near, boxShadow: '0 34px 60px rgba(40,30,10,.34)', offset: 0.58 },
      { transform: rest, boxShadow: '0 6px 14px rgba(40,30,10,.12)', offset: 1 }
    ], { duration: 1700, delay: delay || 0, easing: 'cubic-bezier(.22,.8,.2,1)', fill: 'backwards' });
  }

  // stagger by the order in which cards enter together
  var queue = [], timer = 0;
  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (e.isIntersecting) queue.push(e.target);
    });
    clearTimeout(timer);
    timer = setTimeout(function () {
      queue.sort(function (a, b) { return cards.indexOf(a) - cards.indexOf(b); })
           .forEach(function (c, i) { fly(c, i * 260); });
      queue = [];
    }, 60);
  }, { threshold: 0.6 });
  cards.forEach(function (c) { io.observe(c); });

  // hover / touch: lift toward the viewer and tilt to the pointer
  cards.forEach(function (c) {
    c.addEventListener('pointerenter', function () { c.classList.add('mf-hover'); c.style.transform = near; c.style.boxShadow = '0 34px 60px rgba(40,30,10,.34)'; });
    c.addEventListener('pointermove', function (e) {
      if (e.pointerType === 'touch') return;
      var r = c.getBoundingClientRect(), x = (e.clientX - r.left) / r.width - .5, y = (e.clientY - r.top) / r.height - .5;
      c.style.transform = 'translate3d(0,-10px,110px) scale(1.07) rotateX(' + (-y * 8) + 'deg) rotateY(' + (x * 10) + 'deg)';
    });
    c.addEventListener('pointerleave', function () { c.style.transform = ''; c.style.boxShadow = ''; });
  });
  }
  init();
  if (!started) {   // the grid is filled by menu.html's own script, so wait for it
    var host = document.getElementById('mx-g') || document.body;
    var mo = new MutationObserver(function () { init(); if (started) mo.disconnect(); });
    mo.observe(host, { childList: true, subtree: true });
    setTimeout(function () { if (!started) console.warn('[menu-fly] no cards matched, set SELECTORS'); }, 6000);
  }
})();
