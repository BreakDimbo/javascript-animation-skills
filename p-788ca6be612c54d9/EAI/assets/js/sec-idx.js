/* Index — route map (12-stop rail + 4 route lines) and book-index rows (SECTIONS_SPEC "Knowledge index").
   Pure re-arrangement: the .path strip moves into the routes grid as the header rail; each route gets an
   aria-hidden dot line computed from its own links. kx search/filter stays in app.js. */
(function () {
'use strict';
var doc = document;
function init() {
  var routes = doc.querySelector('#knowledge-index .routes'), path = doc.querySelector('#knowledge-index .path');
  if (!routes || !path) return;
  var stops = [].map.call(path.querySelectorAll('a'), function (a) { return a.getAttribute('href'); });
  var hub = routes.querySelector('.routes__hub');
  routes.insertBefore(path, hub ? hub.nextSibling : routes.firstChild);
  routes.classList.add('rm');
  [].forEach.call(routes.querySelectorAll('.route'), function (r) {
    var on = [].map.call(r.querySelectorAll('.route__links a'), function (a) {
      var h = a.getAttribute('href'); if (/^#term-/.test(h)) h = '#glossary';
      return stops.indexOf(h);
    }).filter(function (i) { return i >= 0; });
    var lo = Math.min.apply(null, on), hi = Math.max.apply(null, on);
    var d = doc.createElement('div'); d.className = 'rm-line'; d.setAttribute('aria-hidden', 'true');
    d.style.setProperty('--lo', lo); d.style.setProperty('--hi', hi);
    d.innerHTML = '<i class="rm-line__l"></i>' + stops.map(function (_, i) { return '<b class="rm-dot' + (on.indexOf(i) >= 0 ? ' is-on' : '') + '" style="--x:' + i + '"></b>'; }).join('');
    r.insertBefore(d, r.querySelector('.route__links'));
    r.addEventListener('pointerenter', function () { routes.classList.add('has-hot'); r.classList.add('is-hot'); });
    r.addEventListener('pointerleave', function () { routes.classList.remove('has-hot'); r.classList.remove('is-hot'); });
    r.addEventListener('focusin', function () { routes.classList.add('has-hot'); r.classList.add('is-hot'); });
    r.addEventListener('focusout', function () { routes.classList.remove('has-hot'); r.classList.remove('is-hot'); });
  });
}
/* r6 · facet bars: each type chip carries a hairline bar proportional to its share of all entries (from app.js's own .n counts) */
function facets() {
  var chips = doc.getElementById('kx-types'); if (!chips) return;
  function paint() {
    var bs = [].slice.call(chips.querySelectorAll('button')); if (!bs.length || chips.querySelector('.kx-bar')) return;
    var n = bs.map(function (b) { var e = b.querySelector('.n'); return e ? +e.textContent || 0 : 0; }), tot = n[0] || Math.max.apply(null, n) || 1;
    bs.forEach(function (b, i) {
      var bar = doc.createElement('i'); bar.className = 'kx-bar'; bar.setAttribute('aria-hidden', 'true');
      bar.style.setProperty('--p', Math.max(.04, Math.min(1, n[i] / tot)).toFixed(4));
      b.appendChild(bar);
    });
    if ('IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (es) { if (es[0].isIntersecting) { chips.classList.add('is-bars'); io.disconnect(); } }, { rootMargin: '0px 0px -10% 0px' });
      io.observe(chips);
    } else chips.classList.add('is-bars');
  }
  paint();
  if (!chips.querySelector('.kx-bar')) new MutationObserver(function (m, mo) { paint(); if (chips.querySelector('.kx-bar')) mo.disconnect(); }).observe(chips, { childList: true });
}
function boot() { init(); facets(); }
if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', boot); else boot();
})();
