/* Enterprise Agentic AI 全景图 — interaction layer.
   Vanilla JS, no dependencies. Works from file:// and any subpath.
   Motion: critically/under-damped springs (snappy 320/30, default 170/26, heavy 90/20), see DESIGN.md. */
(function () {
'use strict';
var D = window.EA_DATA;
if (!D) { document.documentElement.classList.remove('js'); return; }
var doc = document, root = doc.documentElement;
var $ = function (s, c) { return (c || doc).querySelector(s); };
var $$ = function (s, c) { return Array.prototype.slice.call((c || doc).querySelectorAll(s)); };
var mqRM = window.matchMedia('(prefers-reduced-motion: reduce)');
var RM = mqRM.matches;
if (mqRM.addEventListener) mqRM.addEventListener('change', function (e) { RM = e.matches; });
var FINE = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
var clamp = function (v, a, b) { return v < a ? a : v > b ? b : v; };
var lerp = function (a, b, t) { return a + (b - a) * t; };
var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
var SVGNS = 'http://www.w3.org/2000/svg';
function el(tag, attrs, html) {
  var n = doc.createElement(tag);
  if (attrs) for (var k in attrs) { if (attrs[k] != null && attrs[k] !== false) n.setAttribute(k, attrs[k] === true ? '' : attrs[k]); }
  if (html != null) n.innerHTML = html;
  return n;
}
function sv(tag, attrs, text) {
  var n = doc.createElementNS(SVGNS, tag);
  if (attrs) for (var k in attrs) if (attrs[k] != null) n.setAttribute(k, attrs[k]);
  if (text != null) n.textContent = text;
  return n;
}
function slug(t) { return 'term-' + t.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''); }
function norm(s) { return String(s || '').toLowerCase(); }
function hl(text, q) {
  var t = esc(text); if (!q) return t;
  var i = norm(text).indexOf(q);
  if (i < 0) { /* fuzzy: mark the in-order letters that matched, only when every letter is found within a short span */
    var lt = norm(text), at = [], j = 0, k;
    for (k = 0; k < lt.length && j < q.length; k++) if (lt[k] === q[j]) { at.push(k); j++; }
    if (j < q.length || at[at.length - 1] - at[0] > q.length * 3) return t;
    var o = '', set = {}; at.forEach(function (x) { set[x] = 1; });
    for (k = 0; k < text.length; k++) o += set[k] ? '<mark>' + esc(text[k]) + '</mark>' : esc(text[k]);
    return o;
  }
  return esc(text.slice(0, i)) + '<mark>' + esc(text.slice(i, i + q.length)) + '</mark>' + esc(text.slice(i + q.length));
}
var EASE = {
  outQuint: function (t) { return 1 - Math.pow(1 - t, 5); },
  inOutQuart: function (t) { return t < .5 ? 8 * t * t * t * t : 1 - Math.pow(-2 * t + 2, 4) / 2; },
  inOutSine: function (t) { return -(Math.cos(Math.PI * t) - 1) / 2; }
};

/* ---------- spring engine (semi-implicit Euler, fixed 1/120 s substeps) ---------- */
var SPR = { snappy: [320, 30], def: [170, 26], heavy: [90, 20] };
function Spring(v, cfg, onUpdate) {
  this.x = v; this.t = v; this.v = 0;
  this.k = (cfg || SPR.def)[0]; this.c = (cfg || SPR.def)[1];
  this.on = onUpdate; this.live = false;
}
Spring.prototype.to = function (t, snap) {
  this.t = t;
  if (snap || RM) { this.x = t; this.v = 0; if (this.on) this.on(t); return this; }
  if (!this.live) { this.live = true; loop.add(this); }
  return this;
};
/* inertia: hand the spring a velocity (units/s) and let it coast toward a new target */
Spring.prototype.fling = function (vel, t) {
  if (RM) return this.to(t, true);
  this.v = vel; this.t = t;
  if (!this.live) { this.live = true; loop.add(this); }
  return this;
};
Spring.prototype.step = function (dt) {
  var n = Math.max(1, Math.round(dt / (1 / 120))), h = dt / n;
  for (var i = 0; i < n; i++) { var a = -this.k * (this.x - this.t) - this.c * this.v; this.v += a * h; this.x += this.v * h; }
  var done = Math.abs(this.v) < 0.01 && Math.abs(this.x - this.t) < 0.005;
  if (done) { this.x = this.t; this.v = 0; }
  if (this.on) this.on(this.x);
  return !done;
};
var loop = (function () {
  /* the one frame loop: pre hooks read scroll and set spring targets, springs step, then batched style writes flush once */
  var set = [], pre = [], post = [], raf = 0, last = 0, busy = false;
  function tick(ts) {
    var dt = Math.min(0.05, last ? (ts - last) / 1000 : 1 / 60); last = ts; busy = true;
    for (var p = 0; p < pre.length; p++) pre[p]();
    for (var i = set.length - 1; i >= 0; i--) { var s = set[i]; if (!s.step(dt)) { s.live = false; set.splice(i, 1); } }
    busy = false;
    for (var j = 0; j < post.length; j++) { post[j].q = false; post[j](); }
    post.length = 0;
    raf = set.length ? requestAnimationFrame(tick) : 0; if (!raf) last = 0;
  }
  function req() { if (!raf) raf = requestAnimationFrame(tick); }
  return {
    add: function (s) { set.push(s); if (!busy) req(); },
    kick: function () { if (!busy) req(); },
    pre: function (f) { pre.push(f); },
    once: function (f) { if (!busy) { f(); return; } if (!f.q) { f.q = true; post.push(f); } }
  };
})();
/* write a style value only when it changed (custom properties invalidate the element's subtree even when equal) */
function setv(e, k, v) { var c = e.__pv || (e.__pv = {}); if (c[k] === v) return; c[k] = v; if (k.charCodeAt(0) === 45) e.style.setProperty(k, v); else e.style[k] = v; }
/* a tween for things that must take a fixed time (scroll, timeline playback) */
function tween(ms, fn, ease, done) {
  var t0 = performance.now(), id = { stop: false };
  (function f(now) {
    if (id.stop) return;
    var p = clamp((now - t0) / ms, 0, 1); fn((ease || EASE.outQuint)(p));
    if (p < 1) requestAnimationFrame(f); else if (done) done();
  })(t0);
  return id;
}
/* lazy init: run fn once when element nears the viewport */
function whenNear(node, fn, margin) {
  if (!node) return;
  if (!('IntersectionObserver' in window)) { fn(); return; }
  var io = new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting) { io.disconnect(); fn(); } }); }, { rootMargin: margin || '300px 0px' });
  io.observe(node);
}
function onVisible(node, cb) {
  if (!('IntersectionObserver' in window)) { cb(true); return; }
  new IntersectionObserver(function (es) { es.forEach(function (e) { cb(e.isIntersecting); }); }, { threshold: 0 }).observe(node);
}

/* ---------- indexes over the page's own data ---------- */
var G = D.glossary, SRC = D.sources, LIN = D.lineage, DOM = D.domains, FAC = D.factories, VEN = D.vendors;
var termBy = {}; G.forEach(function (g) { termBy[g.term] = g; g.id = slug(g.term); });
var srcBy = {}; SRC.forEach(function (s) { srcBy[s.id] = s; });
var domBy = {}; DOM.forEach(function (d) { domBy[d.id] = d; });
var facBy = {}; FAC.forEach(function (f) { facBy[f.key] = f; });
var linRows = []; LIN.forEach(function (L, li) { L.rows.forEach(function (r, ri) { r.layer = L.layer; r.li = li; r.key = li + ':' + ri; linRows.push(r); }); });
var linByTerm = {}; linRows.forEach(function (r) { linByTerm[r.term] = r; });
function vendorId(n) { return 'vendor-' + n.toLowerCase().replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '-'); }
function srcIds(s) { return (String(s || '').match(/S\d{2}/g) || []); }
function capsOf(c) { return String(c || '').match(/C\d|G/g) || []; }
/* lineage row → glossary term (exact name, or the part before " /") */
function termForRow(r) {
  if (termBy[r.term]) return termBy[r.term];
  for (var i = 0; i < G.length; i++) if (G[i].term.split(' / ')[0] === r.term) return G[i];
  return null;
}
function rowForTerm(g) { return linByTerm[g.term] || linByTerm[g.term.split(' / ')[0]] || null; }

/* ---------- empty states: say what found nothing, and offer the one action that undoes it ---------- */
function emptyState(what, q, reset, tag) {
  tag = tag || 'li';
  return '<' + tag + ' class="empty" role="status"><b class="empty__t">' + (q ? '没有匹配「' + esc(q) + '」的' + what : '这个筛选下没有' + what) + '</b>' +
    '<span class="empty__h">换个关键词，或试试英文术语名、厂商名、来源编号（如 S04）。</span>' +
    (reset ? '<button type="button" class="btn btn--ghost btn--sm empty__btn" data-reset="' + reset + '">清除筛选</button>' : '') + '</' + tag + '>';
}
doc.addEventListener('click', function (e) {
  var b = e.target.closest && e.target.closest('[data-reset]'); if (!b) return;
  b.getAttribute('data-reset').split(',').forEach(function (sel) {
    var f = doc.querySelector(sel); if (!f) return;
    if (f.tagName === 'BUTTON') { f.click(); return; }
    f.value = ''; f.dispatchEvent(new Event('input', { bubbles: true })); f.dispatchEvent(new Event('change', { bubbles: true }));
    if (f.tagName === 'INPUT') f.focus({ preventScroll: true });
  });
});

/* Lucide icons (ISC licence, https://lucide.dev; see LICENSES.md). ico(name) -> inline SVG string */
var ICONS = {
  'focus': '<circle cx="12" cy="12" r="3"/> <path d="M3 7V5a2 2 0 0 1 2-2h2"/> <path d="M17 3h2a2 2 0 0 1 2 2v2"/> <path d="M21 17v2a2 2 0 0 1-2 2h-2"/> <path d="M7 21H5a2 2 0 0 1-2-2v-2"/>',
  'scissors': '<circle cx="6" cy="6" r="3"/> <path d="M8.12 8.12 12 12"/> <path d="M20 4 8.12 15.88"/> <circle cx="6" cy="18" r="3"/> <path d="M14.8 14.8 20 20"/>',
  'eye': '<path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0"/> <circle cx="12" cy="12" r="3"/>',
  'eye-off': '<path d="M10.733 5.076a10.744 10.744 0 0 1 11.205 6.575 1 1 0 0 1 0 .696 10.747 10.747 0 0 1-1.444 2.49"/> <path d="M14.084 14.158a3 3 0 0 1-4.242-4.242"/> <path d="M17.479 17.499a10.75 10.75 0 0 1-15.417-5.151 1 1 0 0 1 0-.696 10.75 10.75 0 0 1 4.446-5.143"/> <path d="m2 2 20 20"/>',
  'rotate-ccw': '<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/> <path d="M3 3v5h5"/>',
  'play': '<path d="M5 5a2 2 0 0 1 3.008-1.728l11.997 6.998a2 2 0 0 1 .003 3.458l-12 7A2 2 0 0 1 5 19z"/>',
  'pause': '<rect x="14" y="3" width="5" height="18" rx="1"/> <rect x="5" y="3" width="5" height="18" rx="1"/>',
  'search': '<path d="m21 21-4.34-4.34"/> <circle cx="11" cy="11" r="8"/>',
  'plus': '<path d="M5 12h14"/> <path d="M12 5v14"/>',
  'minus': '<path d="M5 12h14"/>',
  'scan': '<path d="M3 7V5a2 2 0 0 1 2-2h2"/> <path d="M17 3h2a2 2 0 0 1 2 2v2"/> <path d="M21 17v2a2 2 0 0 1-2 2h-2"/> <path d="M7 21H5a2 2 0 0 1-2-2v-2"/>',
  'x': '<path d="M18 6 6 18"/> <path d="m6 6 12 12"/>',
  'arrow-right': '<path d="M5 12h14"/> <path d="m12 5 7 7-7 7"/>',
  'arrow-down': '<path d="M12 5v14"/> <path d="m19 12-7 7-7-7"/>',
  'arrow-up-right': '<path d="M7 7h10v10"/> <path d="M7 17 17 7"/>',
  'sun': '<circle cx="12" cy="12" r="4"/> <path d="M12 2v2"/> <path d="M12 20v2"/> <path d="m4.93 4.93 1.41 1.41"/> <path d="m17.66 17.66 1.41 1.41"/> <path d="M2 12h2"/> <path d="M20 12h2"/> <path d="m6.34 17.66-1.41 1.41"/> <path d="m19.07 4.93-1.41 1.41"/>',
  'moon': '<path d="M20.985 12.486a9 9 0 1 1-9.473-9.472c.405-.022.617.46.402.803a6 6 0 0 0 8.268 8.268c.344-.215.825-.004.803.401"/>',
  'corner-down-left': '<path d="M20 4v7a4 4 0 0 1-4 4H4"/> <path d="m9 10-5 5 5 5"/>',
  'chevron-right': '<path d="m9 18 6-6-6-6"/>',
  'chevron-down': '<path d="m6 9 6 6 6-6"/>',
  'volume-2': '<path d="M11 4.702a.705.705 0 0 0-1.203-.498L6.413 7.587A1.4 1.4 0 0 1 5.416 8H3a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2.416a1.4 1.4 0 0 1 .997.413l3.383 3.384A.705.705 0 0 0 11 19.298z"/> <path d="M16 9a5 5 0 0 1 0 6"/> <path d="M19.364 18.364a9 9 0 0 0 0-12.728"/>',
  'volume-x': '<path d="M11 4.702a.7.7 0 0 0-1.203-.498L6.413 7.587A1.4 1.4 0 0 1 5.416 8H3a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2.416a1.4 1.4 0 0 1 .997.413l3.383 3.384A.7.7 0 0 0 11 19.298z"/> <path d="m16.5 14.5 5-5"/> <path d="m16.5 9.5 5 5"/>',
  'mouse-pointer-2': '<path d="M4.037 4.688a.495.495 0 0 1 .651-.651l16 6.5a.5.5 0 0 1-.063.947l-6.124 1.58a2 2 0 0 0-1.438 1.435l-1.579 6.126a.5.5 0 0 1-.947.063z"/>',
  'list': '<path d="M3 5h.01"/> <path d="M3 12h.01"/> <path d="M3 19h.01"/> <path d="M8 5h13"/> <path d="M8 12h13"/> <path d="M8 19h13"/>',
  'map': '<path d="M14.106 5.553a2 2 0 0 0 1.788 0l3.659-1.83A1 1 0 0 1 21 4.619v12.764a1 1 0 0 1-.553.894l-4.553 2.277a2 2 0 0 1-1.788 0l-4.212-2.106a2 2 0 0 0-1.788 0l-3.659 1.83A1 1 0 0 1 3 19.381V6.618a1 1 0 0 1 .553-.894l4.553-2.277a2 2 0 0 1 1.788 0z"/> <path d="M15 5.764v15"/> <path d="M9 3.236v15"/>',
  'layers-2': '<path d="M13 13.74a2 2 0 0 1-2 0L2.5 8.87a1 1 0 0 1 0-1.74L11 2.26a2 2 0 0 1 2 0l8.5 4.87a1 1 0 0 1 0 1.74z"/> <path d="m20 14.285 1.5.845a1 1 0 0 1 0 1.74L13 21.74a2 2 0 0 1-2 0l-8.5-4.87a1 1 0 0 1 0-1.74l1.5-.845"/>',
  'box': '<path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/> <path d="m3.3 7 8.7 5 8.7-5"/> <path d="M12 22V12"/>',
  'boxes': '<path d="M2.97 12.92A2 2 0 0 0 2 14.63v3.24a2 2 0 0 0 .97 1.71l3 1.8a2 2 0 0 0 2.06 0L12 19v-5.5l-5-3-4.03 2.42Z"/> <path d="m7 16.5-4.74-2.85"/> <path d="m7 16.5 5-3"/> <path d="M7 16.5v5.17"/> <path d="M12 13.5V19l3.97 2.38a2 2 0 0 0 2.06 0l3-1.8a2 2 0 0 0 .97-1.71v-3.24a2 2 0 0 0-.97-1.71L17 10.5l-5 3Z"/> <path d="m17 16.5-5-3"/> <path d="m17 16.5 4.74-2.85"/> <path d="M17 16.5v5.17"/> <path d="M7.97 4.42A2 2 0 0 0 7 6.13v4.37l5 3 5-3V6.13a2 2 0 0 0-.97-1.71l-3-1.8a2 2 0 0 0-2.06 0l-3 1.8Z"/> <path d="M12 8 7.26 5.15"/> <path d="m12 8 4.74-2.85"/> <path d="M12 13.5V8"/>',
  'book-open': '<path d="M12 5v16"/> <path d="M20.001 19A2 2 0 0022 17V5a2 2 0 00-1.999-2L16 3.002A5 5 0 0012 5a5 5 0 00-4-2H4a2 2 0 00-2 2v12a2 2 0 001.999 2H8a5 5 0 014 2 5 5 0 014-2z"/>',
  'clock': '<circle cx="12" cy="12" r="10"/> <path d="M12 6v6l4 2"/>',
  'link': '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/> <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>',
  'copy': '<rect width="14" height="14" x="8" y="8" rx="2" ry="2"/> <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>',
  'check': '<path d="M20 6 9 17l-5-5"/>',
  'info': '<circle cx="12" cy="12" r="10"/> <path d="M12 16v-4"/> <path d="M12 8h.01"/>',
  'move-3d': '<path d="M5 3v16h16"/> <path d="m5 19 6-6"/> <path d="m2 6 3-3 3 3"/> <path d="m18 16 3 3-3 3"/>',
  'zoom-in': '<circle cx="11" cy="11" r="8"/> <line x1="21" x2="16.65" y1="21" y2="16.65"/> <line x1="11" x2="11" y1="8" y2="14"/> <line x1="8" x2="14" y1="11" y2="11"/>',
  'menu': '<path d="M4 5h16"/> <path d="M4 12h16"/> <path d="M4 19h16"/>'
};
function ico(n, cls) { return '<svg class="i' + (cls ? ' ' + cls : '') + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" data-i="' + n + '">' + (ICONS[n] || '') + '</svg>'; }

/* =====================================================================
   UI sound: synthesised with WebAudio (no sample files). OFF by default;
   the bar toggle turns it on and the choice is remembered. Quiet (-30 dB),
   short (≤ 90 ms), and only on explicit user actions.
   ===================================================================== */
var SND = (function () {
  var on = false, ctx = null, last = 0;
  try { on = localStorage.getItem('eai-sound') === 'on'; } catch (e) {}
  function ac() { if (!ctx) { var A = window.AudioContext || window.webkitAudioContext; if (!A) return null; ctx = new A(); } if (ctx.state === 'suspended') ctx.resume(); return ctx; }
  function blip(f0, f1, dur, gain, type, at) {
    var c = ac(); if (!c) return; var t = c.currentTime + (at || 0);
    var o = c.createOscillator(), g = c.createGain(), lp = c.createBiquadFilter();
    o.type = type || 'sine'; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    lp.type = 'lowpass'; lp.frequency.value = 3200;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(gain, t + 0.006); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(lp); lp.connect(g); g.connect(c.destination); o.start(t); o.stop(t + dur + 0.02);
  }
  var LIB = {
    tick: function () { blip(1800, 1200, 0.028, 0.028, 'triangle'); },
    open: function () { blip(520, 660, 0.07, 0.03); blip(780, 990, 0.08, 0.02, 'sine', 0.045); },
    close: function () { blip(700, 480, 0.07, 0.026); },
    toggle: function () { blip(900, 900, 0.03, 0.026, 'triangle'); blip(1350, 1350, 0.035, 0.02, 'triangle', 0.04); },
    slide: function () { blip(1100, 1000, 0.018, 0.014, 'triangle'); }
  };
  function play(n) {
    if (!on || RM && n === 'slide') return; var now = performance.now(); if (now - last < 45) return; last = now;
    try { (LIB[n] || LIB.tick)(); } catch (e) {}
  }
  function set(v, quiet) {
    on = v; try { localStorage.setItem('eai-sound', v ? 'on' : 'off'); } catch (e) {}
    var b = $('#sound-toggle'); if (b) { b.setAttribute('aria-pressed', v ? 'true' : 'false'); b.setAttribute('aria-label', v ? '界面音效：开' : '界面音效：关'); }
    if (v && !quiet) play('toggle');
  }
  return { play: play, set: set, get on() { return on; } };
})();
window.EAI_SOUND = function (n) { SND.play(n); };
function initSound() {
  var b = $('#sound-toggle'); if (!b) return;
  SND.set(SND.on, true); /* sync the button with the stored choice, silently */
  b.addEventListener('click', function () { SND.set(!SND.on); });
  doc.addEventListener('click', function (e) {
    var t = e.target.closest && e.target.closest('button,[role="tab"],.seg button,a.btn'); if (!t || t === b) return;
    SND.play(t.matches('[data-close]') ? 'close' : 'tick');
  }, true);
}

/* =====================================================================
   Verbatim renders of the page's own data (labels match the original)
   ===================================================================== */
function srefs(ids) {
  return ids.map(function (id) { return '<a class="sref" href="#src-' + id + '" data-src="' + id + '">' + id + '</a>'; }).join(' ');
}
function srefText(s) { /* keep the original text, but make every S## a link */
  return esc(s).replace(/S\d{2}/g, function (id) { return srcBy[id] ? '<a class="sref" href="#src-' + id + '" data-src="' + id + '">' + id + '</a>' : id; });
}
function termsInDomain(id) { return G.filter(function (g) { return capsOf(g.caps).indexOf(id) >= 0; }); }

function renderDomains() {
  var host = $('#domain-list'); if (!host) return;
  host.innerHTML = DOM.map(function (d) {
    var n = termsInDomain(d.id).length;
    return '<article class="dcard" id="domain-' + d.id.toLowerCase() + '" data-dom="' + d.id + '">' +
      '<div class="dcard__h"><span class="dcard__id">' + esc(d.id) + '</span><h3>' + esc(d.name) + '</h3></div>' +
      '<p>' + esc(d.bound) + '</p>' +
      '<dl><dt>代表产品 / 实践：</dt><dd>' + esc(d.prod) + '</dd>' +
      '<dt>中国厂商 / 本地生态：</dt><dd>' + esc(d.cn) + '</dd>' +
      '<dt>典型失误：</dt><dd class="err">' + esc(d.err) + '</dd></dl>' +
      '<button class="dcard__more" type="button" data-open="domain:' + d.id + '"><span>术语表中落在 ' + esc(d.id) + ' 的 ' + n + ' 条术语</span><span aria-hidden="true">→</span></button>' +
      '</article>';
  }).join('');
}

function renderFactories() {
  var host = $('#factory-grid'); if (!host) return;
  host.innerHTML = FAC.map(function (f) {
    return '<article class="fcard ' + f.key + '" id="factory-' + f.key + '" data-fac="' + f.key + '">' +
      '<header class="fcard__hd"><span class="fcard__n">' + esc(f.n) + '</span><h3>' + esc(f.name) + '</h3>' +
      '<p class="fcard__sup">' + esc(f.cn) + '　供给：' + esc(f.supply) + '</p></header>' +
      '<div class="fcard__b">' +
      '<h4>核心能力</h4><ul>' + f.caps.map(function (c) { return '<li>' + esc(c) + '</li>'; }).join('') + '</ul>' +
      '<h4>评价指标</h4><p>' + esc(f.kpi) + '</p>' +
      '<h4>典型购买者</h4><p>' + esc(f.who) + '</p>' +
      '<h4>代表技术 / 产品</h4><p>' + esc(f.tech) + '</p>' +
      '<p class="bound">边界：' + esc(f.bound) + '</p>' +
      '</div></article>';
  }).join('');
}

function renderVendors() {
  var host = $('#vendor-grid'); if (!host) return;
  host.innerHTML = VEN.map(function (v) {
    return '<article class="vcard" id="' + vendorId(v.n) + '">' +
      '<div class="vcard__h"><span class="vcard__n">' + esc(v.n) + '</span><span class="vcard__tag">' + srefText(v.tag) + '</span></div>' +
      '<h3>' + esc(v.title) + '</h3>' +
      '<p class="vcard__body">' + esc(v.body) + '</p>' +
      '<p class="vcard__judge"><b>判断：</b>' + esc(v.judge) + '</p>' +
      '<div class="vcard__foot"><button class="btn btn--quiet btn--sm" type="button" data-open="vendor:' + esc(v.n) + '"><span>来源与相关术语</span><span aria-hidden="true">→</span></button></div>' +
      '</article>';
  }).join('');
}

function renderLadder() {
  var host = $('#ladder'); if (!host) return;
  var w = [100, 82, 66, 50, 36];
  host.innerHTML = D.evidence.map(function (t, i) {
    return '<li><div class="ladder__b" style="--w:' + w[i] + '%;--k:' + i + '"><i aria-hidden="true"></i><span>' + esc(t) + '</span></div></li>';
  }).join('');
  whenNear(host, function () { host.classList.add('is-in'); }, '-10% 0px');
}

/* ---------- 05 lineage table ---------- */
var lineageState = { q: '', layer: '', view: 'table' };
function lineageRowHtml(r) {
  var li = function (a, cls) { return (a || []).map(function (x) { return '<li' + (cls ? ' class="' + cls + '"' : '') + '>' + esc(x) + '</li>'; }).join(''); };
  return '<tr class="row" id="lin-' + r.key.replace(':', '-') + '">' +
    '<td class="term"><button type="button" data-open="lin:' + r.key + '"><b>' + esc(r.term) + '</b><span>' + esc(r.sub || '') + '</span></button></td>' +
    '<td class="origin">' + esc(r.origin) + '<time>' + esc(r.date) + '</time></td>' +
    '<td><ul class="drv">' + li(r.drivers, 'solid') + '</ul>' + (r.driverNote ? '<p class="note">' + esc(r.driverNote) + '</p>' : '') + '</td>' +
    '<td><ul class="prd">' + li(r.products, 'dash') + '</ul></td>' +
    '<td><ul class="oss">' + li(r.oss) + '</ul>' + (r.ossNote ? '<p class="note">' + esc(r.ossNote) + '</p>' : '') + '</td>' +
    '</tr>';
}
function lineageMatch(r, q) {
  if (!q) return true;
  return [r.term, r.sub, r.origin, r.driverNote, r.date].concat(r.drivers || [], r.products || [], r.oss || []).join(' ').toLowerCase().indexOf(q) !== -1;
}
function renderLineage() {
  var tb = $('#lineage-table tbody'); if (!tb) return;
  var q = lineageState.q, layer = lineageState.layer, html = '', n = 0;
  LIN.forEach(function (L, i) {
    if (layer !== '' && layer !== String(i)) return;
    var rows = L.rows.filter(function (r) { return lineageMatch(r, q); });
    if (!rows.length) return;
    n += rows.length;
    html += '<tr class="layer-row" data-kind="' + esc(L.kind) + '"><td colspan="5"><span class="layer-name">' + esc(L.layer) + '</span><span class="layer-note">' + esc(L.note) + '</span></td></tr>';
    html += rows.map(lineageRowHtml).join('');
  });
  tb.innerHTML = html || '<tr><td colspan="5">' + emptyState('谱系条目', q, '#lineage-layer,#lineage-q', 'div') + '</td></tr>';
  $('#lineage-count').textContent = n + ' / ' + linRows.length + ' 条';
  $('#lineage-cap').textContent = '共 ' + linRows.length + ' 个术语谱系条目，分 7 层。“代表性公开节点”指当前证据集能追溯的使用、论文、规范或系统化表述，不等同于唯一发明人或首次创新；' +
    '“代表厂商产品”是能力或方案映射，不是标准所有权或治理权的证据。';
  if (lineageState.view === 'time' && window.__drawLTime) window.__drawLTime();
}

/* ---------- 09 glossary ---------- */
var glossState = { q: '', group: '' };
var groups = []; G.forEach(function (g) { if (groups.indexOf(g.group) < 0) groups.push(g.group); });
function termHtml(g, q) {
  return '<article class="term" id="' + g.id + '" data-term="' + esc(g.term) + '">' +
    '<button class="term__sum" type="button" aria-expanded="false" aria-controls="' + g.id + '-more">' +
      '<span class="term__top"><span class="term__name">' + hl(g.term, q) + '</span><span class="term__type">' + esc(g.type) + '</span><span class="term__caps">' + esc(g.caps) + '</span></span>' +
      '<span class="term__plain">' + hl(g.plain, q) + '</span>' +
    '</button>' +
    '<div class="term__more" id="' + g.id + '-more"><div><div class="in">' +
      '<p>' + hl(g.technical, q) + '</p>' +
      '<p class="bd"><b>边界：</b>' + hl(g.boundary, q) + '</p>' +
      '<p><b>代表实现：</b>' + hl(g.examples, q) + '</p>' +
      '<p class="evd">证据：' + srefText(g.evidence) + '</p>' +
      '<div class="term__acts">' +
        '<button class="btn btn--quiet btn--sm" type="button" data-open="term:' + esc(g.term) + '"><span>关联与来源</span></button>' +
        '<button class="btn btn--quiet btn--sm" type="button" data-locate="' + esc(g.term) + '"><span>在能力域地图中定位</span></button>' +
      '</div>' +
    '</div></div></div>' +
  '</article>';
}
function glossMatch(g, q) {
  if (!q) return true;
  return [g.term, g.plain, g.technical, g.boundary, g.type, g.examples, g.evidence].join(' ').toLowerCase().indexOf(q) !== -1;
}
function renderGlossary() {
  var host = $('#gloss-list'); if (!host) return;
  var q = glossState.q, html = '', n = 0;
  groups.forEach(function (grp) {
    if (glossState.group && glossState.group !== grp) return;
    var items = G.filter(function (g) { return g.group === grp && glossMatch(g, q); });
    if (!items.length) return;
    n += items.length;
    html += '<h3 class="gl-group">' + esc(grp) + '<span>' + items.length + ' 条</span></h3>' + items.map(function (g) { return termHtml(g, q); }).join('');
  });
  host.innerHTML = html || emptyState('术语', q, '#gloss-group,#gloss-q', 'div');
  $('#gloss-count').textContent = n + ' / ' + G.length + ' 条';
}
function openTerm(id, flash) {
  var t = doc.getElementById(id);
  if (!t) { glossState.q = ''; glossState.group = ''; var gq = $('#gloss-q'); if (gq) gq.value = ''; var gs = $('#gloss-group'); if (gs) gs.value = ''; renderGlossary(); t = doc.getElementById(id); }
  if (!t) return null;
  t.classList.add('is-open'); $('.term__sum', t).setAttribute('aria-expanded', 'true');
  if (flash) { t.classList.remove('is-flash'); void t.offsetWidth; t.classList.add('is-flash'); setTimeout(function () { t.classList.remove('is-flash'); }, 1600); }
  return t;
}

/* ---------- 10 sources ---------- */
function renderSources(q) {
  var host = $('#src-list'); if (!host) return;
  q = q || '';
  if (window.EAI_SRC_RENDER) { window.EAI_SRC_RENDER(q); return; } /* 10 ledger: assets/js/sec-10.js */
  var list = SRC.filter(function (s) { return !q || [s.id, s.title, s.publisher, s.date].join(' ').toLowerCase().indexOf(q) !== -1; });
  host.innerHTML = list.map(function (s) {
    return '<li id="src-' + s.id + '"><a href="' + esc(s.url) + '" target="_blank" rel="noopener"><span class="id">' + esc(s.id) + '</span><span class="t">' + hl(s.title, q) + '</span><span class="p">' + hl(s.publisher, q) + '</span><span class="d">' + esc(s.date) + '</span></a></li>';
  }).join('') || emptyState('来源', q, '#src-q');
  $('#src-count').textContent = list.length + ' / ' + SRC.length + ' 条';
}

/* =====================================================================
   Chrome: chapters, rail, TOC, top bar, theme, lamp, buttons, reveals
   ===================================================================== */
var CH_LABEL = { index: '首页与导航', '00': '整体视图', '01': '标准与治理', '02': '能力域', '03': '四类工厂', '04': '协作架构', '05': '术语谱系', '06': '概念辨析', '07': '厂商架构', '08': '选型与建设', '09': '术语表', '10': '一手来源', EXT: '开源生态' };
var chapters = $$('main section[data-chapter]').filter(function (s) { return s.dataset.chapter !== 'cover'; }).map(function (s) {
  var c = s.dataset.chapter; return { el: s, id: s.id, c: c, n: c === 'index' ? '—' : c, label: CH_LABEL[c] || c, top: 0, h: 1, p: 0 };
});
var hero = $('.hero');
function buildNav() {
  var rail = $('#rail'), toc = $('#toc-list');
  rail.innerHTML = chapters.map(function (c) {
    return '<a href="#' + c.id + '" data-ch="' + c.c + '"><span class="rail__l">' + esc(c.label) + '</span><span class="rail__tick"><i></i></span><span class="rail__n">' + esc(c.n) + '</span></a>';
  }).join('');
  toc.innerHTML = chapters.map(function (c) {
    return '<li><a href="#' + c.id + '" data-ch="' + c.c + '"><span>' + esc(c.n) + '</span>' + esc(c.label) + '<i></i></a></li>';
  }).join('');
}
var heroH = 0, docH = 1, vh = innerHeight;
function measure() {
  vh = innerHeight; docH = Math.max(1, doc.documentElement.scrollHeight - vh);
  heroH = hero ? hero.offsetHeight : 0;
  chapters.forEach(function (c) { var r = c.el.getBoundingClientRect(); c.top = r.top + scrollY; c.h = Math.max(1, r.height); });
}
var curCh = null, railLinks, tocLinks, barEl, barNum, barLabel, barProg, railEl;
function onScroll() {
  var y = scrollY, probe = y + vh * 0.38, act = null;
  barEl.classList.toggle('is-top', y < 12);
  railEl.classList.toggle('is-hidden', y < heroH * 0.6);
  barProg.style.setProperty('--p', clamp(y / docH, 0, 1).toFixed(4));
  chapters.forEach(function (c, i) {
    c.p = clamp((probe - c.top) / c.h, 0, 1);
    if (probe >= c.top) act = c;
    var ps = c.p.toFixed(3);
    if (ps !== c.ps) { c.ps = ps; railLinks[i].firstChild.nextSibling.firstChild.style.setProperty('--p', ps); tocLinks[i].lastChild.style.setProperty('--p', ps); railLinks[i].classList.toggle('is-done', c.p >= 1); }
  });
  if (act !== curCh) {
    curCh = act;
    railLinks.forEach(function (a, i) { var on = chapters[i] === act; a.classList.toggle('is-active', on); if (on) a.setAttribute('aria-current', 'true'); else a.removeAttribute('aria-current'); });
    tocLinks.forEach(function (a, i) { a.classList.toggle('is-active', chapters[i] === act); });
    var num = act ? act.n : '—', lab = act ? act.label : '封面';
    if (RM) { barNum.textContent = num; barLabel.textContent = lab; }
    else {
      barLabel.classList.add('is-swap');
      setTimeout(function () { barNum.textContent = num; barLabel.textContent = lab; barLabel.classList.remove('is-swap'); }, 160);
    }
  }
}
function initChrome() {
  buildNav();
  railEl = $('#rail'); barEl = $('#bar'); barNum = $('#bar-num'); barLabel = $('#bar-label'); barProg = $('#bar-progress');
  railLinks = $$('#rail a'); tocLinks = $$('#toc-list a');
  measure(); onScroll();
  var ticking = false;
  addEventListener('scroll', function () { if (!ticking) { ticking = true; requestAnimationFrame(function () { ticking = false; onScroll(); }); } }, { passive: true });
  var rto; addEventListener('resize', function () { clearTimeout(rto); rto = setTimeout(function () { measure(); onScroll(); }, 120); });
  if ('ResizeObserver' in window) { var mt; new ResizeObserver(function () { clearTimeout(mt); mt = setTimeout(function () { measure(); onScroll(); }, 80); }).observe($('#main')); }
  /* platform-appropriate shortcut hint */
  var mac = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
  $$('#kbd-hint, .js-kbd').forEach(function (k) { k.textContent = mac ? '⌘K' : 'Ctrl K'; });
}

/* ---------- smooth, interruptible scroll to anchors ---------- */
var scrollAnim = null;
function scrollToEl(t, after) {
  if (!t) return;
  var y = clamp(t.getBoundingClientRect().top + scrollY - (parseInt(getComputedStyle(root).getPropertyValue('--bar-h')) || 64) - 14, 0, doc.documentElement.scrollHeight - innerHeight);
  if (scrollAnim) scrollAnim.stop = true;
  if (RM) { scrollTo(0, y); if (after) after(); return; }
  var y0 = scrollY, d = y - y0, ms = clamp(420 + Math.abs(d) * 0.045, 520, 1150);
  var stop = function () { if (scrollAnim) scrollAnim.stop = true; off(); };
  var off = function () { removeEventListener('wheel', stop); removeEventListener('touchstart', stop); removeEventListener('keydown', stop); };
  addEventListener('wheel', stop, { passive: true }); addEventListener('touchstart', stop, { passive: true }); addEventListener('keydown', stop);
  scrollAnim = tween(ms, function (p) { scrollTo(0, y0 + d * p); }, EASE.inOutQuart, function () { off(); if (after) after(); });
}
function goHash(hash, push) {
  if (!hash || hash === '#') return;
  /* a jump is a navigation, not a reading scroll: show the destination at once */
  doc.documentElement.classList.add('nav-jump'); clearTimeout(goHash._t); goHash._t = setTimeout(function () { doc.documentElement.classList.remove('nav-jump'); }, 1400);
  var id = decodeURIComponent(hash.slice(1)), t;
  if (id === 'top') { t = doc.body; scrollToEl($('.hero')); }
  else if (id.indexOf('term-') === 0) { t = openTerm(id, true); scrollToEl(t); }
  else if (id.indexOf('src-') === 0) {
    if (!doc.getElementById(id)) { $('#src-q').value = ''; if (window.EAI_SRC_RENDER && window.EAI_SRC_RENDER.reveal) window.EAI_SRC_RENDER.reveal(); else renderSources(''); }
    t = doc.getElementById(id); if (t) { scrollToEl(t); t.classList.remove('is-flash'); void t.offsetWidth; t.classList.add('is-flash'); setTimeout(function () { t.classList.remove('is-flash'); }, 1600); }
  } else { t = doc.getElementById(id); scrollToEl(t); }
  if (t && push !== false) { try { history.pushState(null, '', '#' + id); } catch (e) {} }
  if (t && t.focus && id !== 'top') { var f = t.matches('section,article,li,figure') ? t : null; if (f) { f.setAttribute('tabindex', '-1'); f.focus({ preventScroll: true }); } }
}
doc.addEventListener('click', function (e) {
  var a = e.target.closest('a[href^="#"]');
  if (!a || e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey) return;
  var h = a.getAttribute('href'); if (h.length < 2) return;
  if (h !== '#top' && !doc.getElementById(h.slice(1)) && h.indexOf('#term-') !== 0 && h.indexOf('#src-') !== 0) return;
  e.preventDefault();
  if (a.closest('#toc')) closeOverlay();
  if (a.closest('#drawer')) closeOverlay();
  goHash(h);
});
addEventListener('popstate', function () { if (!location.hash) return; /* r6: sections may seat a target first (e.g. the glossary scrolls its index) so the page measure is exact */ (window.EAI_PRE_HASH || []).forEach(function (f) { try { f(location.hash); } catch (e) {} }); goHash(location.hash, false); });

/* ---------- theme (View Transition crossfade) ---------- */
function initTheme() {
  var b = $('#theme-toggle');
  function sync() { var dark = root.getAttribute('data-theme') === 'dark'; b.setAttribute('aria-pressed', dark ? 'true' : 'false'); b.setAttribute('aria-label', dark ? '切换到浅色' : '切换到深色'); }
  sync();
  b.addEventListener('click', function () {
    var next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    var apply = function () {
      root.setAttribute('data-theme', next); try { localStorage.setItem('eai-theme', next); } catch (e) {}
      var m = $('meta[name="theme-color"]'); if (m) m.content = next === 'dark' ? '#11100d' : '#f3eee3';
      m = $('meta[name="color-scheme"]'); if (m) m.content = next; sync();
    };
    if (doc.startViewTransition && !RM) doc.startViewTransition(apply); else apply();
  });
}

/* ---------- lamp: light follows the pointer with a heavy spring; shadows fall away from it ---------- */
function initLamp() {
  if (!FINE) return;
  var st = root.style, lx = 72, ly = 16, qsx = null, qsy = null, shT = 0, shAt = 0;
  /* the pool of light is one composited layer moved by transform: no style or paint work per frame */
  var lamp = doc.createElement('div'); lamp.className = 'lamp'; lamp.setAttribute('aria-hidden', 'true');
  doc.body.insertBefore(lamp, doc.body.firstChild); root.classList.add('lamp-on');
  function shade() {
    /* shadows fall away from the lamp; --sx/--sy live on the root and restyle the page, so they move in coarse
       steps and at most ~5×/s, which is below what the eye reads on a soft shadow */
    shT = 0; shAt = performance.now();
    var sx = Math.round(clamp((lx / 100 - 0.5) * 2, -1, 1) * 6) / 6, sy = Math.round(clamp(1 - ly / 100 * 1.4, -0.3, 1) * 6) / 6;
    if (sx !== qsx || sy !== qsy) { qsx = sx; qsy = sy; st.setProperty('--sx', sx); st.setProperty('--sy', sy); }
  }
  function put() {
    lamp.style.transform = 'translate3d(' + (lx * innerWidth / 100).toFixed(1) + 'px,' + (ly * innerHeight / 100).toFixed(1) + 'px,0)';
    if (!shT) shT = setTimeout(shade, Math.max(0, 200 - (performance.now() - shAt)));
  }
  var SX = new Spring(lx, SPR.heavy, function (v) { lx = v; put(); }), SY = new Spring(ly, SPR.heavy, function (v) { ly = v; put(); });
  var pe = null, pr = 0;
  addEventListener('pointermove', function (e) {
    if (e.pointerType !== 'mouse' || doc.hidden) return;
    pe = e; if (!pr) pr = requestAnimationFrame(aim);
  }, { passive: true });
  addEventListener('resize', put);
  function aim() {
    pr = 0; var e = pe; if (!e) return;
    /* the lamp drifts toward the pointer but stays above the page: damped range */
    SX.to(lerp(72, e.clientX / innerWidth * 100, 0.55)); SY.to(lerp(14, e.clientY / innerHeight * 100, 0.35));
  }
  put();
}

/* ---------- magnetic + pressable buttons ---------- */
function initButtons() {
  $$('.btn').forEach(function (b) {
    var mag = FINE && b.classList.contains('magnetic');
    var mx = new Spring(0, SPR.snappy, function (v) { b.style.setProperty('--mx', v.toFixed(2) + 'px'); });
    var my = new Spring(0, SPR.snappy, function (v) { b.style.setProperty('--my', v.toFixed(2) + 'px'); });
    var s = new Spring(1, SPR.snappy, function (v) { b.style.setProperty('--s', v.toFixed(4)); });
    if (mag) {
      b.addEventListener('pointermove', function (e) {
        var r = b.getBoundingClientRect();
        mx.to(clamp((e.clientX - r.left - r.width / 2) * 0.22, -7, 7)); my.to(clamp((e.clientY - r.top - r.height / 2) * 0.3, -5, 5));
      });
      b.addEventListener('pointerleave', function () { mx.to(0); my.to(0); s.to(1); });
    }
    b.addEventListener('pointerdown', function () { s.to(0.965); });
    ['pointerup', 'pointercancel'].forEach(function (ev) { b.addEventListener(ev, function () { s.to(1); }); });
    if (!mag) b.addEventListener('pointerleave', function () { s.to(1); });
  });
}

/* ---------- section titles rise out of a mask (once) ---------- */
function initReveals() {
  $$('.reveal-title').forEach(function (h) {
    if (h.querySelector('.rt')) return;
    h.innerHTML = '<span class="rt-l"><span class="rt">' + h.innerHTML + '</span></span>';
  });
  if (RM || !('IntersectionObserver' in window)) { $$('.reveal-title').forEach(function (h) { h.classList.add('is-in'); }); return; }
  /* chapter transitions: as a chapter's head arrives, its eyebrow, title and lede rise in sequence and the
     first figure follows; each plays once, and nothing is hidden unless this script is running */
  var heads = $$('.sec__head'), figs = $$('.sec > .wrap > .viz, .sec > .wrap > figure');
  heads.concat(figs).forEach(function (n) { n.classList.add('ch-pre'); });
  var cio = new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('ch-in'); cio.unobserve(e.target); } }); }, { rootMargin: '0px 0px -6% 0px' });
  heads.concat(figs).forEach(function (n) { var r = n.getBoundingClientRect(); if (r.top < innerHeight && r.bottom > 0) n.classList.add('ch-in'); else cio.observe(n); });
  var io = new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); } }); }, { rootMargin: '0px 0px -8% 0px' });
  $$('.reveal-title').forEach(function (h) { io.observe(h); });
}

/* ---------- segmented controls: a spring-driven indicator under the selected tab ---------- */
function segIndicator(seg) {
  var ind = seg.querySelector('.seg__ind');
  if (!ind) { ind = el('span', { 'class': 'seg__ind', 'aria-hidden': 'true' }); seg.insertBefore(ind, seg.firstChild); }
  var X = new Spring(0, SPR.snappy, function (v) { ind.style.transform = 'translate3d(' + v.toFixed(2) + 'px,' + ty + 'px,0)'; });
  var W = new Spring(0, SPR.snappy, function (v) { ind.style.width = v.toFixed(2) + 'px'; });
  var ty = 0, first = true;
  function place(snap) {
    var on = seg.querySelector('[aria-selected="true"],[aria-pressed="true"]');
    if (!on || !seg.offsetParent) { ind.style.opacity = on ? '' : '0'; return; }
    ind.style.opacity = '';
    ty = on.offsetTop; ind.style.height = on.offsetHeight + 'px';
    X.to(on.offsetLeft, snap || first); W.to(on.offsetWidth, snap || first); first = false;
  }
  place(true);
  addEventListener('resize', function () { place(true); });
  if ('ResizeObserver' in window) new ResizeObserver(function () { place(true); }).observe(seg);
  return place;
}
/* roving tabs with arrow keys (WAI-ARIA tabs pattern) */
function tabs(seg, onSelect) {
  var btns = $$('[role="tab"]', seg), place = segIndicator(seg);
  function select(b, focus) {
    btns.forEach(function (x) { var on = x === b; x.setAttribute('aria-selected', on ? 'true' : 'false'); x.tabIndex = on ? 0 : -1; });
    if (focus) b.focus(); place(); onSelect(b);
  }
  btns.forEach(function (b) {
    b.tabIndex = b.getAttribute('aria-selected') === 'true' ? 0 : -1;
    b.addEventListener('click', function () { select(b); });
    b.addEventListener('keydown', function (e) {
      var i = btns.indexOf(b), n = null;
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') n = btns[(i + 1) % btns.length];
      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') n = btns[(i - 1 + btns.length) % btns.length];
      if (e.key === 'Home') n = btns[0]; if (e.key === 'End') n = btns[btns.length - 1];
      if (n) { e.preventDefault(); select(n, true); }
    });
  });
  return { select: select, place: place };
}

/* ---------- 08: scenario tabs (mobile), formula denominator ---------- */
function initDecision() {
  var scen = $('#scen'); if (!scen) return;
  var panels = $$('.scenario', scen);
  panels.forEach(function (p, i) { p.setAttribute('data-l', 'ABC'[i]); });
  scen.classList.add('is-tabs');
  function show(id) { panels.forEach(function (p) { if (p.id === id) p.removeAttribute('data-off'); else p.setAttribute('data-off', ''); }); }
  tabs($('.seg--scen', scen), function (b) { show(b.getAttribute('aria-controls')); });
  show('scen-a');
  var f = $('#formula'), den = $('.fterm--den', f);
  if (den) { den.addEventListener('pointerenter', function () { f.classList.add('is-den'); }); den.addEventListener('pointerleave', function () { f.classList.remove('is-den'); }); }
}

/* ---------- EXT screenshot: a print on the desk, tilts slightly toward the pointer ---------- */
function initShotTilt() {
  var s = $('.highlight__shot'); if (!s || !FINE) return;
  var ry = new Spring(0, SPR.heavy, function (v) { s.style.setProperty('--ry', v.toFixed(3) + 'deg'); });
  var rx = new Spring(0, SPR.heavy, function (v) { s.style.setProperty('--rxx', v.toFixed(3) + 'deg'); });
  s.addEventListener('pointermove', function (e) { var r = s.getBoundingClientRect(); ry.to(((e.clientX - r.left) / r.width - 0.5) * 5); rx.to(-((e.clientY - r.top) / r.height - 0.5) * 4); });
  s.addEventListener('pointerleave', function () { ry.to(0); rx.to(0); });
}

/* ---------- tooltip ----------
   Anchored to the hovered mark when one is given (box = its client rect), else to the pointer. It prefers above,
   flips below when the top bar or the viewport edge is in the way, and flips sideways at the right edge. */
var tipEl, tipFor = null;
function tip(html, x, y, box) {
  if (!tipEl) tipEl = $('#tip');
  if (html == null) { tipEl.classList.remove('is-on'); tipFor = null; return; }
  var key = html + '|' + (box ? Math.round(box.left) + ',' + Math.round(box.top) : '');
  if (key !== tipFor || !box) { tipEl.innerHTML = html; tipFor = key; }
  tipEl.hidden = false;
  var w = tipEl.offsetWidth, h = tipEl.offsetHeight, top = (parseFloat(getComputedStyle(doc.documentElement).getPropertyValue('--bar-h')) || 56) + 8;
  var ax = x, ayT = y - 12, ayB = y + 18, L, T, side = 'top';
  if (box) { ax = box.left + box.width / 2; ayT = box.top - 8; ayB = box.bottom + 8; }
  if (box) L = ax - w / 2; else { L = x + 14; if (L + w > innerWidth - 8) L = x - w - 14; }
  L = clamp(L, 8, innerWidth - w - 8);
  if (ayT - h >= top) T = ayT - h; else { T = ayB; side = 'bottom'; }
  if (T + h > innerHeight - 8) T = Math.max(top, innerHeight - 8 - h);
  /* collision: if the box would cover a mark the reader is looking at (avoid = rects), try the other side,
     then beside the anchor, and keep the first spot that covers nothing */
  var avoid = tip.avoid;
  if (avoid && avoid.length && box) {
    var hit = function (l, t) { return avoid.some(function (r) { return l < r.right && l + w > r.left && t < r.bottom && t + h > r.top; }); };
    if (hit(L, T)) {
      var c = [[L, ayB, 'bottom'], [L, ayT - h, 'top'], [box.right + 10, box.top + box.height / 2 - h / 2, 'right'], [box.left - w - 10, box.top + box.height / 2 - h / 2, 'left']];
      for (var i = 0; i < c.length; i++) { var cl = clamp(c[i][0], 8, innerWidth - w - 8), ct = c[i][1]; if (ct >= top && ct + h <= innerHeight - 8 && !hit(cl, ct)) { L = cl; T = ct; side = c[i][2]; break; } }
    }
  }
  tipEl.dataset.side = side;
  tipEl.style.setProperty('--ax', clamp(ax - L, 12, w - 12).toFixed(0) + 'px');
  tipEl.style.transform = 'translate(' + L.toFixed(0) + 'px,' + T.toFixed(0) + 'px)';
  tipEl.classList.add('is-on');
}

/* =====================================================================
   Overlays: drawer, palette, TOC, lightbox (one at a time, focus-trapped)
   ===================================================================== */
var ov = { cur: null, opener: null, close: null };
function focusables(n) { return $$('a[href],button:not([disabled]),input,select,textarea,[tabindex]:not([tabindex="-1"])', n).filter(function (x) { return x.offsetParent !== null || x === doc.activeElement; }); }
function trap(e, n) {
  if (e.key !== 'Tab') return;
  var f = focusables(n); if (!f.length) return;
  var a = f[0], z = f[f.length - 1];
  if (e.shiftKey && doc.activeElement === a) { e.preventDefault(); z.focus(); }
  else if (!e.shiftKey && doc.activeElement === z) { e.preventDefault(); a.focus(); }
}
function lockScroll(on) {
  var sb = innerWidth - doc.documentElement.clientWidth;
  doc.body.style.overflow = on ? 'hidden' : ''; doc.body.style.paddingRight = on && sb ? sb + 'px' : '';
}
function closeOverlay(keepFocus) { if (ov.close) { var c = ov.close; ov.close = null; c(); ov.cur = null; if (!keepFocus) { if (ov.opener && ov.opener.focus && ov.opener.isConnected) ov.opener.focus({ preventScroll: true }); ov.opener = null; } } }
doc.addEventListener('keydown', function (e) {
  if (e.key === 'Escape' && ov.cur) { e.preventDefault(); closeOverlay(); return; }
  if (ov.cur) trap(e, ov.cur);
  if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K')) { e.preventDefault(); if (ov.cur === $('#palette')) closeOverlay(); else openPalette(); }
  else if (e.key === '/' && !ov.cur && !/INPUT|TEXTAREA|SELECT/.test(doc.activeElement.tagName)) { e.preventDefault(); openPalette(); }
});

/* ---------- drawer: a sheet on a spring; right on desktop, bottom on phones ---------- */
var drawer, scrim, dP, dMobile = false;
function initDrawer() {
  drawer = $('#drawer'); scrim = $('#scrim');
  dP = new Spring(0, SPR.def, function (p) {
    dMobile = innerWidth <= 640;
    drawer.style.transform = dMobile ? 'translate3d(0,' + ((1 - p) * (drawer.offsetHeight + 24)).toFixed(1) + 'px,0)' : 'translate3d(' + ((1 - p) * (drawer.offsetWidth + 30)).toFixed(1) + 'px,0,0)';
    if (p < 0.002 && dP.t === 0) { drawer.hidden = true; scrim.hidden = true; }
  });
  scrim.addEventListener('click', function () { closeOverlay(); });
  $$('[data-close]', drawer).forEach(function (b) { b.addEventListener('click', function () { closeOverlay(); }); });
  /* drag the sheet down to dismiss (phones) */
  var head = $('.drawer__head', drawer), grip = $('.drawer__grip', drawer), y0 = null, v = 0, lastY = 0, lastT = 0;
  [head, grip].forEach(function (h) {
    h.addEventListener('pointerdown', function (e) { if (innerWidth > 640 || e.target.closest('button')) return; y0 = e.clientY; lastY = y0; lastT = performance.now(); h.setPointerCapture(e.pointerId); });
    h.addEventListener('pointermove', function (e) {
      if (y0 == null) return; var now = performance.now(); v = (e.clientY - lastY) / Math.max(1, now - lastT); lastY = e.clientY; lastT = now;
      dP.to(clamp(1 - Math.max(0, e.clientY - y0) / drawer.offsetHeight, 0, 1), true);
    });
    h.addEventListener('pointerup', function (e) { if (y0 == null) return; var d = e.clientY - y0; y0 = null; if (d > 110 || v > 0.6) closeOverlay(); else dP.to(1); });
  });
  drawer.addEventListener('click', function (e) {
    var b = e.target.closest('[data-open]'); if (b) { e.preventDefault(); openItem(b.getAttribute('data-open'), true); return; }
    var loc = e.target.closest('[data-locate]'); if (loc) { closeOverlay(true); locateOnMap(loc.getAttribute('data-locate')); }
  });
}
function showDrawer(kind, title, body, foot) {
  $('#drawer-kind').textContent = kind; $('#drawer-title').textContent = title;
  $('#drawer-body').innerHTML = body; $('#drawer-foot').innerHTML = foot || '';
  $('#drawer-body').scrollTop = 0;
  if (ov.cur === drawer) { /* swap content in place: a short settle, no re-entry */
    if (!RM) { var b = $('#drawer-body'); b.animate([{ opacity: 0.001, transform: 'translateY(6px)' }, { opacity: 1, transform: 'none' }], { duration: 260, easing: 'cubic-bezier(.33,1,.68,1)' }); }
    return;
  }
  if (ov.cur) closeOverlay(true);
  ov.opener = ov.opener && ov.opener.isConnected ? ov.opener : doc.activeElement;
  SND.play('open');
  dP.to(0, true); ov.cur = drawer; drawer.hidden = false; scrim.hidden = false; lockScroll(true);
  void drawer.offsetWidth;
  requestAnimationFrame(function () { scrim.classList.add('is-on'); dP.to(1); });
  ov.close = function () { scrim.classList.remove('is-on'); lockScroll(false); dP.to(0); if (RM) { drawer.hidden = true; scrim.hidden = true; } };
  setTimeout(function () { var c = $('.drawer__close', drawer); if (c) c.focus({ preventScroll: true }); }, 30);
}
function pills(a, cls) { return a && a.length ? '<ul class="pills">' + a.map(function (x) { return '<li' + (cls ? ' class="' + cls + '"' : '') + '>' + esc(x) + '</li>'; }).join('') + '</ul>' : ''; }
function relList(items) { return '<ul class="rel">' + items.map(function (it) { return '<li><button type="button" data-open="' + esc(it[0]) + '"><span>' + esc(it[1]) + '</span><small>' + esc(it[2] || '') + '</small></button></li>'; }).join('') + '</ul>'; }
function srcList(ids) {
  ids = ids.filter(function (id) { return srcBy[id]; });
  return ids.length ? '<ul class="srcs">' + ids.map(function (id) { var s = srcBy[id]; return '<li><a href="' + esc(s.url) + '" target="_blank" rel="noopener"><b>' + id + '</b>' + esc(s.title) + '<span>' + esc(s.publisher) + ' · ' + esc(s.date) + ' ↗</span></a></li>'; }).join('') + '</ul>' : '';
}
function footLink(href, label) { return '<a class="btn btn--ghost btn--sm" href="' + href + '"><span>' + esc(label) + '</span><span aria-hidden="true">↓</span></a>'; }
var VENDOR_KEYS = { '阿里云': ['阿里'], '华为': ['华为'], '火山引擎': ['火山'] };
function vendorMentions(name) {
  var keys = VENDOR_KEYS[name] || [name];
  return G.filter(function (g) { var h = g.examples + ' ' + g.technical; return keys.some(function (k) { return h.indexOf(k) >= 0; }); });
}
function openItem(spec, fromDrawer) {
  var i = spec.indexOf(':'), type = spec.slice(0, i), key = spec.slice(i + 1);
  if (!fromDrawer && !ov.cur) ov.opener = doc.activeElement;
  if (type === 'term') {
    var g = termBy[key]; if (!g) return;
    var rel = [], r = rowForTerm(g);
    capsOf(g.caps).forEach(function (c) { if (domBy[c]) rel.push(['domain:' + c, c + ' · ' + domBy[c].name, '能力域']); });
    if (r) rel.push(['lin:' + r.key, r.term + ' · ' + r.sub, '术语谱系']);
    showDrawer('术语表 · ' + g.group, g.term,
      '<h5>通俗解释</h5><p>' + esc(g.plain) + '</p><h5>专业定义</h5><p>' + esc(g.technical) + '</p>' +
      '<p class="bd"><b>边界：</b>' + esc(g.boundary) + '</p>' +
      '<h5>概念类型 · 所属能力域</h5><ul class="pills"><li>' + esc(g.type) + '</li><li>' + esc(g.caps) + '</li></ul>' +
      '<h5>代表实现</h5><p>' + esc(g.examples) + '</p>' +
      '<h5>证据编号 · ' + esc(g.evidence) + '</h5>' + srcList(srcIds(g.evidence)) +
      (rel.length ? '<h5>关联</h5>' + relList(rel) : ''),
      footLink('#' + g.id, '在术语表中查看') + '<button class="btn btn--quiet btn--sm" type="button" data-locate="' + esc(g.term) + '"><span>在能力域地图中定位</span></button>');
  } else if (type === 'lin') {
    var row = linRows.filter(function (x) { return x.key === key; })[0]; if (!row) return;
    var tg = termForRow(row);
    showDrawer('术语谱系 · ' + row.layer, row.term,
      '<p>' + esc(row.sub) + '</p>' +
      '<h5>代表性公开节点 · ' + esc(row.date) + '</h5><p>' + esc(row.origin) + '</p>' +
      '<h5>大厂推动者</h5>' + pills(row.drivers) + (row.driverNote ? '<p class="small">' + esc(row.driverNote) + '</p>' : '') +
      '<h5>代表产品与方案</h5>' + pills(row.products) +
      '<h5>代表开源项目</h5>' + pills(row.oss) + (row.ossNote ? '<p class="small">' + esc(row.ossNote) + '</p>' : '') +
      (tg ? '<h5>关联</h5>' + relList([['term:' + tg.term, tg.term, '术语表']]) : '') +
      '<p class="drawer__note">“代表性公开节点”指当前证据集能追溯的使用、论文、规范或系统化表述，不等同于唯一发明人或首次创新；“代表厂商产品”是能力或方案映射，不是标准所有权或治理权的证据。</p>',
      footLink('#lineage', '在谱系表中查看'));
  } else if (type === 'domain') {
    var d = domBy[key]; if (!d) return;
    var ts = termsInDomain(d.id);
    showDrawer('能力域 · ' + d.id, d.name,
      '<p>' + esc(d.bound) + '</p><h5>代表产品 / 实践</h5><p>' + esc(d.prod) + '</p><h5>中国厂商 / 本地生态</h5><p>' + esc(d.cn) + '</p>' +
      '<h5>典型失误</h5><p class="err">' + esc(d.err) + '</p>' +
      '<h5>术语表中落在 ' + d.id + ' 的术语 · ' + ts.length + '</h5>' + relList(ts.map(function (g) { return ['term:' + g.term, g.term, g.caps]; })),
      footLink('#domain-' + d.id.toLowerCase(), '在能力域列表中查看'));
  } else if (type === 'factory') {
    var f = facBy[key]; if (!f) return;
    var fl = D.flows.filter(function (x) { return x.from === key || x.to === key; });
    showDrawer('四类工厂 · ' + f.n, f.name,
      '<p>' + esc(f.cn) + '　供给：' + esc(f.supply) + '</p><h5>核心能力</h5><ul>' + f.caps.map(function (c) { return '<li>' + esc(c) + '</li>'; }).join('') + '</ul>' +
      '<h5>评价指标</h5><p>' + esc(f.kpi) + '</p><h5>典型购买者</h5><p>' + esc(f.who) + '</p><h5>代表技术 / 产品</h5><p>' + esc(f.tech) + '</p>' +
      '<p class="bd"><b>边界：</b>' + esc(f.bound) + '</p>' +
      (fl.length ? '<h5>四厂之间的供给关系</h5>' + fl.map(function (x) { return '<p><b>' + esc(x.label) + '</b>　' + esc(x.t) + '</p>'; }).join('') + '<p class="small">' + esc(D.flowNote) + '</p>' : ''),
      footLink('#factory-' + key, '在四类工厂中查看'));
  } else if (type === 'vendor') {
    var v = VEN.filter(function (x) { return x.n === key; })[0]; if (!v) return;
    var ms = vendorMentions(v.n);
    showDrawer('厂商架构 · ' + v.tag, v.n,
      '<p><b>' + esc(v.title) + '</b></p><p>' + esc(v.body) + '</p><p><b>判断：</b>' + esc(v.judge) + '</p>' +
      '<h5>来源 · ' + esc(v.tag) + '</h5>' + srcList(srcIds(v.tag)) +
      (ms.length ? '<h5>术语表「代表实现」或「专业定义」中出现 ' + esc(v.n) + ' 的术语 · ' + ms.length + '</h5>' + relList(ms.map(function (g) { return ['term:' + g.term, g.term, g.caps]; })) : ''),
      footLink('#' + vendorId(v.n), '在厂商架构中查看'));
  } else if (type === 'src') {
    var s = srcBy[key]; if (!s) return;
    var cite = G.filter(function (g) { return srcIds(g.evidence).indexOf(key) >= 0; }).map(function (g) { return ['term:' + g.term, g.term, '术语表']; })
      .concat(VEN.filter(function (x) { return srcIds(x.tag).indexOf(key) >= 0; }).map(function (x) { return ['vendor:' + x.n, x.n, '厂商架构']; }));
    showDrawer('一手来源 · ' + s.id, s.title,
      '<p>' + esc(s.publisher) + ' · ' + esc(s.date) + '</p>' +
      '<p><a class="btn btn--primary btn--sm" href="' + esc(s.url) + '" target="_blank" rel="noopener"><span>打开来源</span><span aria-hidden="true">↗</span></a></p>' +
      (cite.length ? '<h5>本页引用该来源的条目 · ' + cite.length + '</h5>' + relList(cite) : ''),
      footLink('#src-' + s.id, '在来源列表中查看'));
  } else if (type === 'go') { goHash('#' + key); }
}
doc.addEventListener('click', function (e) {
  if (e.target.closest('#drawer')) return;
  var b = e.target.closest('[data-open]');
  if (b && !b.closest('.palette')) { e.preventDefault(); ov.opener = b; openItem(b.getAttribute('data-open')); return; }
  var l = e.target.closest('[data-locate]'); if (l) { locateOnMap(l.getAttribute('data-locate')); return; }
  var t = e.target.closest('.term__sum');
  if (t) { var a = t.parentNode, on = !a.classList.contains('is-open'); a.classList.toggle('is-open', on); t.setAttribute('aria-expanded', on ? 'true' : 'false'); }
  if (e.target.closest('[data-open-palette]')) { e.preventDefault(); openPalette(); }
});

/* ---------- knowledge items: one list feeds the Cmd-K palette and the on-page index ---------- */
var TYPES = [
  { k: 'sec', n: '章节', ic: '§', c: 'var(--ink)' },
  { k: 'term', n: '术语', ic: 'T', c: 'var(--c-agent)' },
  { k: 'lin', n: '术语谱系', ic: 'L', c: 'var(--c-data)' },
  { k: 'dom', n: '能力域', ic: 'C', c: 'var(--c-ai)' },
  { k: 'fac', n: '四类工厂', ic: 'F', c: 'var(--c-token)' },
  { k: 'ven', n: '厂商', ic: 'V', c: 'var(--ochre)' },
  { k: 'pair', n: '概念辨析', ic: '≠', c: 'var(--red)' },
  { k: 'scen', n: '场景', ic: 'S', c: 'var(--ink-3)' },
  { k: 'src', n: '一手来源', ic: '¶', c: 'var(--ink-4)' }
];
var TYPE = {}; TYPES.forEach(function (t) { TYPE[t.k] = t; });
var ITEMS = [];
function buildItems() {
  chapters.forEach(function (c) { var h = $('h2', c.el); ITEMS.push({ t: 'sec', title: c.n + '　' + c.label, sub: h ? h.textContent : '', hay: '', go: 'go:' + c.id }); });
  G.forEach(function (g) { ITEMS.push({ t: 'term', title: g.term, sub: g.plain, meta: g.caps, hay: [g.type, g.technical, g.boundary, g.examples, g.group].join(' '), go: 'term:' + g.term }); });
  linRows.forEach(function (r) { ITEMS.push({ t: 'lin', title: r.term, sub: r.sub + ' · ' + r.layer, meta: r.date, hay: [r.origin, r.driverNote, (r.drivers || []).join(' '), (r.products || []).join(' '), (r.oss || []).join(' ')].join(' '), go: 'lin:' + r.key }); });
  DOM.forEach(function (d) { ITEMS.push({ t: 'dom', title: d.id + ' ' + d.name, sub: d.bound, meta: d.id, hay: [d.prod, d.cn, d.err].join(' '), go: 'domain:' + d.id }); });
  FAC.forEach(function (f) { ITEMS.push({ t: 'fac', title: f.name, sub: f.cn + '　供给：' + f.supply, meta: f.n, hay: [f.kpi, f.who, f.tech, f.caps.join(' ')].join(' '), go: 'factory:' + f.key }); });
  VEN.forEach(function (v) { ITEMS.push({ t: 'ven', title: v.n, sub: v.title, meta: v.tag, hay: v.body + ' ' + v.judge, go: 'vendor:' + v.n }); });
  $$('#boundaries .pair').forEach(function (p, i) { var h = $('.pair__h', p); p.id = p.id || 'pair-' + (i + 1); ITEMS.push({ t: 'pair', title: h.textContent.replace('≠', ' ≠ ').replace(/\s+/g, ' ').trim(), sub: $('p', p).textContent, hay: p.textContent, go: 'go:' + p.id }); });
  $$('#scen .scenario').forEach(function (s) { var h = $('h4', s); ITEMS.push({ t: 'scen', title: h.textContent, sub: $('.who', s).textContent, hay: s.textContent, go: 'scen:' + s.id }); });
  SRC.forEach(function (s) { ITEMS.push({ t: 'src', title: s.title, sub: s.publisher + ' · ' + s.date, meta: s.id, hay: s.id, go: 'src:' + s.id }); });
  ITEMS.forEach(function (it, i) { it.i = i; it.lt = norm(it.title); it.ls = norm(it.sub); it.lh = norm(it.hay + ' ' + (it.meta || '')); it.lc = cmp(it.lt); });
}
/* fuzzy search: exact > prefix > substring (title, then sub, then body), then a squashed match that ignores spaces,
   hyphens and dots ("agentos" finds "Agent OS"), then every word somewhere, then an in-order subsequence of the title */
function cmp(s) { return s.replace(/[\s\-_.·/()（）]+/g, ''); }
function subseq(q, t) {
  var i = 0, j = 0, gaps = 0, last = -1;
  for (; i < q.length && j < t.length; j++) if (t[j] === q[i]) { if (last >= 0) gaps += j - last - 1; last = j; i++; }
  return i === q.length ? gaps : -1;
}
function search(q, types) {
  q = norm(q).trim();
  var out = [], qc = cmp(q), words = q.split(/\s+/).filter(Boolean);
  ITEMS.forEach(function (it) {
    if (types && types.indexOf(it.t) < 0) return;
    var s = 0;
    if (!q) s = 1;
    else if (it.lt === q) s = 120; else if (it.lt.indexOf(q) === 0) s = 100; else if (it.lt.indexOf(q) > 0) s = 70;
    else if (qc.length > 1 && it.lc.indexOf(qc) >= 0) s = 64;
    else if (it.ls.indexOf(q) >= 0) s = 30; else if (it.lh.indexOf(q) >= 0) s = 12;
    else if (words.length > 1 && words.every(function (w) { return (it.lt + ' ' + it.ls + ' ' + it.lh).indexOf(w) >= 0; })) s = 10;
    else if (qc.length >= 3) { var g = subseq(qc, it.lc); if (g >= 0 && g <= qc.length * 2) s = Math.max(2, 8 - g / 2); }
    if (s) out.push({ it: it, s: s });
  });
  out.sort(function (a, b) { return b.s - a.s || a.it.i - b.it.i; });
  return out.map(function (o) { return o.it; });
}
/* recents: the last six things opened from the palette, kept on this device only */
var RECENT_K = 'eai-recent';
function recents() { try { var a = JSON.parse(localStorage.getItem(RECENT_K) || '[]'); return a.map(function (g) { return ITEMS.filter(function (it) { return it.go === g; })[0]; }).filter(Boolean); } catch (e) { return []; } }
function pushRecent(it) { try { var a = JSON.parse(localStorage.getItem(RECENT_K) || '[]').filter(function (g) { return g !== it.go; }); a.unshift(it.go); localStorage.setItem(RECENT_K, JSON.stringify(a.slice(0, 6))); } catch (e) {} }
function runItem(it) {
  if (ov.cur === pal) pushRecent(it);
  var g = it.go, i = g.indexOf(':'), type = g.slice(0, i), key = g.slice(i + 1);
  if (type === 'go') { closeOverlay(true); goHash('#' + key); return; }
  if (type === 'scen') {
    closeOverlay(true);
    var b = doc.querySelector('[aria-controls="' + key + '"]'); if (b) b.click();
    goHash('#' + key); return;
  }
  openItem(g);
}

/* ---------- Cmd-K palette ---------- */
var pal, palQ, palList, palSel = 0, palRes = [];
function initPalette() {
  pal = $('#palette'); palQ = $('#palette-q'); palList = $('#palette-list');
  $('#open-palette').addEventListener('click', function () { openPalette(); });
  palQ.addEventListener('input', drawPalette);
  palQ.addEventListener('keydown', function (e) {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); setSel(palSel + (e.key === 'ArrowDown' ? 1 : -1), true); }
    else if (e.key === 'Enter') { e.preventDefault(); if (palRes[palSel]) runItem(palRes[palSel]); }
  });
  pal.addEventListener('pointerdown', function (e) { if (e.target === pal) closeOverlay(); });
  palList.addEventListener('click', function (e) {
    var sg = e.target.closest('[data-sug]'); if (sg) { palQ.value = sg.dataset.sug; drawPalette(); palQ.focus(); return; }
    if (e.target.closest('[data-clr]')) { try { localStorage.removeItem(RECENT_K); } catch (er) {} drawPalette(); palQ.focus(); return; }
    var o = e.target.closest('.palette__o'); if (o) runItem(palRes[+o.dataset.k]); });
  palList.addEventListener('pointermove', function (e) { var o = e.target.closest('.palette__o'); if (o && +o.dataset.k !== palSel) setSel(+o.dataset.k, false); });
}
function openPalette() {
  if (ov.cur === pal) return;
  var opener = doc.activeElement;
  if (ov.cur) closeOverlay(true);
  ov.opener = opener; ov.cur = pal; pal.hidden = false; lockScroll(true);
  palQ.value = ''; drawPalette();
  requestAnimationFrame(function () { pal.classList.add('is-on'); });
  palQ.focus({ preventScroll: true });
  ov.close = function () { pal.classList.remove('is-on'); lockScroll(false); setTimeout(function () { if (ov.cur !== pal) pal.hidden = true; }, RM ? 0 : 230); };
}
function drawPalette() {
  var q = palQ.value, res = search(q);
  var order = [], byT = {}, rec = [];
  if (!q.trim()) {
    rec = recents();
    res = res.filter(function (it) { return it.t === 'sec'; }).concat(search('', ['dom', 'fac']));
    if (rec.length) { order.push('rec'); byT.rec = rec; }
  } else res = res.slice(0, 60);
  /* group by type, ordered by each group's best hit */
  res.forEach(function (it) { if (!byT[it.t]) { byT[it.t] = []; order.push(it.t); } byT[it.t].push(it); });
  palRes = []; var html = '', lq = norm(q).trim();
  order.forEach(function (t) {
    html += '<li class="palette__g" role="presentation">' + (t === 'rec' ? '最近打开<button type="button" class="palette__clr" data-clr>清除</button>' : esc(TYPE[t].n)) + '</li>';
    byT[t].forEach(function (it) {
      var k = palRes.length, ty = TYPE[it.t]; palRes.push(it);
      html += '<li class="palette__o" role="option" id="po-' + k + '" data-k="' + k + '" aria-selected="false"><span class="palette__ic" style="color:' + ty.c + '">' + ty.ic + '</span>' +
        '<span class="palette__t"><b>' + hl(it.title, lq) + '</b><span>' + hl(it.sub, lq) + '</span></span><span class="palette__m">' + esc(it.meta || '') + '</span></li>';
    });
  });
  if (!html) {
    /* suggest real entries only: the first term, domain and vendor in the data */
    var sug = [G[0] && G[0].term, DOM[0] && DOM[0].id, VEN[0] && VEN[0].n].filter(Boolean);
    html = '<li class="palette__empty" role="presentation"><b>没有找到「' + esc(q) + '」</b><span>可尝试英文术语名、厂商名或来源编号（如 S04）。</span><span class="palette__sug">' +
      sug.map(function (x) { return '<button type="button" data-sug="' + esc(x) + '">' + esc(x) + '</button>'; }).join('') + '</span></li>';
  }
  palList.innerHTML = html;
  $('#palette-n').textContent = q.trim() ? palRes.length + ' 条结果' : ITEMS.length + ' 条可检索';
  setSel(0, true);
}
function setSel(i, scroll) {
  if (!palRes.length) { palQ.removeAttribute('aria-activedescendant'); return; }
  palSel = (i + palRes.length) % palRes.length;
  $$('.palette__o', palList).forEach(function (o) { o.setAttribute('aria-selected', +o.dataset.k === palSel ? 'true' : 'false'); });
  var o = $('#po-' + palSel); palQ.setAttribute('aria-activedescendant', 'po-' + palSel);
  if (scroll && o) o.scrollIntoView({ block: 'nearest' });
}

/* ---------- TOC sheet ---------- */
function initToc() {
  var toc = $('#toc'), sheet = $('.toc__sheet', toc);
  var P = new Spring(0, SPR.def, function (p) { sheet.style.transform = 'translate3d(0,' + ((1 - p) * (sheet.offsetHeight + 20)).toFixed(1) + 'px,0)'; if (p < 0.002 && P.t === 0) toc.hidden = true; });
  $('#open-toc').addEventListener('click', function () {
    P.to(0, true); ov.opener = this; ov.cur = toc; toc.hidden = false; lockScroll(true);
    requestAnimationFrame(function () { toc.classList.add('is-on'); P.to(1); var a = $('a.is-active', toc) || $('a', toc); a.focus({ preventScroll: true }); });
    ov.close = function () { toc.classList.remove('is-on'); lockScroll(false); P.to(0); if (RM) toc.hidden = true; };
  });
  toc.addEventListener('pointerdown', function (e) { if (e.target === toc) closeOverlay(); });
  $$('[data-close]', toc).forEach(function (b) { b.addEventListener('click', function () { closeOverlay(); }); });
  $('[data-open-palette]', toc).addEventListener('click', function (e) { e.stopPropagation(); closeOverlay(true); openPalette(); });
}

/* ---------- lightbox: pan / zoom the original plate ---------- */
function initLightbox() {
  var lb = $('#lightbox'), st = $('#lightbox-stage'), img = $('#lightbox-img');
  var s = 1, x = 0, y = 0, fit = 1, ptrs = {}, pinch = null, drag = null;
  function apply() { img.style.transform = 'translate3d(' + x + 'px,' + y + 'px,0) scale(' + s + ')'; }
  function reset() {
    var W = st.clientWidth, H = st.clientHeight, iw = img.naturalWidth || 1672, ih = img.naturalHeight || 941;
    fit = Math.min(W / iw, H / ih) * 0.94; s = fit; x = (W - iw * s) / 2; y = (H - ih * s) / 2; apply();
  }
  function zoomAt(f, cx, cy) { var ns = clamp(s * f, fit * 0.8, fit * 6); x = cx - (cx - x) * ns / s; y = cy - (cy - y) * ns / s; s = ns; apply(); }
  $$('[data-lightbox]').forEach(function (b) {
    b.addEventListener('click', function () {
      ov.opener = b; if (ov.cur) closeOverlay(true);
      ov.cur = lb; lb.hidden = false; lockScroll(true);
      img.alt = ($('img', b) || {}).alt || ''; img.onload = reset; img.src = b.getAttribute('data-lightbox'); if (img.complete) reset();
      requestAnimationFrame(function () { lb.classList.add('is-on'); });
      $('[data-close]', lb).focus({ preventScroll: true });
      ov.close = function () { lb.classList.remove('is-on'); lockScroll(false); setTimeout(function () { if (ov.cur !== lb) lb.hidden = true; }, RM ? 0 : 300); };
    });
  });
  $$('[data-close]', lb).forEach(function (b) { b.addEventListener('click', function () { closeOverlay(); }); });
  st.addEventListener('wheel', function (e) { e.preventDefault(); var r = st.getBoundingClientRect(); zoomAt(Math.exp(-e.deltaY * 0.0022), e.clientX - r.left, e.clientY - r.top); }, { passive: false });
  st.addEventListener('dblclick', reset);
  st.addEventListener('pointerdown', function (e) { st.setPointerCapture(e.pointerId); ptrs[e.pointerId] = [e.clientX, e.clientY]; drag = [e.clientX - x, e.clientY - y]; pinch = null; });
  st.addEventListener('pointermove', function (e) {
    if (!ptrs[e.pointerId]) return; ptrs[e.pointerId] = [e.clientX, e.clientY];
    var ids = Object.keys(ptrs), r = st.getBoundingClientRect();
    if (ids.length === 2) {
      var a = ptrs[ids[0]], b = ptrs[ids[1]], d = Math.hypot(a[0] - b[0], a[1] - b[1]), cx = (a[0] + b[0]) / 2 - r.left, cy = (a[1] + b[1]) / 2 - r.top;
      if (pinch) zoomAt(d / pinch, cx, cy); pinch = d;
    } else if (drag) { x = e.clientX - drag[0]; y = e.clientY - drag[1]; apply(); }
  });
  function up(e) { delete ptrs[e.pointerId]; pinch = null; var ids = Object.keys(ptrs); drag = ids.length ? [ptrs[ids[0]][0] - x, ptrs[ids[0]][1] - y] : null; }
  st.addEventListener('pointerup', up); st.addEventListener('pointercancel', up);
  addEventListener('resize', function () { if (!lb.hidden) reset(); });
}

/* ---------- on-page knowledge index ---------- */
function initIndex() {
  var host = $('#kx-list'), q = $('#kx-q'), chips = $('#kx-types'), more = $('#kx-more'), cnt = $('#kx-count');
  var types = TYPES.filter(function (t) { return t.k !== 'sec'; }), cur = '', all = false, LIMIT = innerWidth <= 640 ? 8 : 16;
  chips.innerHTML = '<button role="tab" type="button" aria-selected="true" data-t="">全部 <span class="n">' + ITEMS.filter(function (i) { return i.t !== 'sec'; }).length + '</span></button>' +
    types.map(function (t) { return '<button role="tab" type="button" aria-selected="false" data-t="' + t.k + '">' + esc(t.n) + ' <span class="n">' + ITEMS.filter(function (i) { return i.t === t.k; }).length + '</span></button>'; }).join('');
  var T = tabs(chips, function (b) { cur = b.dataset.t; all = false; draw(); });
  function draw() {
    var lq = norm(q.value).trim(), res = search(q.value, cur ? [cur] : types.map(function (t) { return t.k; }));
    var shown = all ? res : res.slice(0, LIMIT);
    host.innerHTML = shown.map(function (it, i) {
      var t = TYPE[it.t];
      return '<li><button class="kx__item" type="button" data-k="' + it.i + '" style="--i:' + i + ';--tc:' + t.c + '"><span class="kx__type">' + esc(t.n) + (it.meta ? ' · ' + esc(it.meta) : '') + '</span><span class="kx__name">' + hl(it.title, lq) + '</span><span class="kx__sub">' + hl(it.sub, lq) + '</span></button></li>';
    }).join('') || emptyState(cur ? TYPE[cur].n : '条目', q.value.trim(), (q.value.trim() ? '#kx-q' : '') + (cur ? (q.value.trim() ? ',' : '') + '#kx-types [data-t=""]' : ''));
    cnt.textContent = (lq || cur ? res.length + ' 条匹配' : res.length + ' 条知识条目') + (shown.length < res.length ? '，显示前 ' + shown.length + ' 条' : '');
    more.hidden = shown.length >= res.length;
    more.textContent = '显示全部 ' + res.length + ' 条';
    if (!RM && !draw.first) $$('.kx__item', host).forEach(function (b, i) { if (i < 24) b.animate([{ opacity: 0.001, transform: 'translateY(8px)' }, { opacity: 1, transform: 'none' }], { duration: 420, delay: i * 14, easing: 'cubic-bezier(.22,1,.36,1)', fill: 'backwards' }); });
    draw.first = false;
  }
  draw.first = true;
  var qt; q.addEventListener('input', function () { clearTimeout(qt); qt = setTimeout(function () { all = false; draw(); }, 90); });
  more.addEventListener('click', function () { all = true; draw(); });
  host.addEventListener('click', function (e) { var b = e.target.closest('.kx__item'); if (b) { ov.opener = b; runItem(ITEMS[+b.dataset.k]); } });
  draw();
}

/* =====================================================================
   VIZ A · exploded five-layer stack (CSS 3D, springs). Data: D.stack
   ===================================================================== */
function chipsOf(s) { return s.split(' · ').map(function (x) { return '<span>' + esc(x) + '</span>'; }).join(''); }
function buildStack(host, full, labels) {
  var world = el('div', { 'class': 'stack__world' });
  var L = D.stack.map(function (layer, i) {
    var n = el('div', { 'class': 'layer layer--' + (i + 1), 'data-layer': layer.id });
    var tiles = layer.tiles.map(function (t) {
      var fc = facBy[t.key] ? ' ' + t.key : '', dark = (t.key === 'os' || t.key === 'proto') ? ' tile--dark' : '';
      var body = t.lines.length === 1 && t.lines[0].indexOf(' · ') > 0 && (t.key === 'os' || t.key === 'proto' || t.key === 'biz')
        ? '<span class="tile__chips">' + chipsOf(t.lines[0]) + '</span>'
        : t.lines.map(function (l) { return '<span class="tile__l">' + esc(l) + '</span>'; }).join('');
      var tag = full ? 'button' : 'div';
      return '<' + tag + (full ? ' type="button"' : '') + ' class="tile' + fc + dark + '"' + (fc ? ' data-c' : '') + ' data-key="' + t.key + '"' + (full ? ' aria-pressed="false"' : '') + '><span class="tile__t">' + esc(t.t) + '</span>' + body + '</' + tag + '>';
    }).join('');
    n.innerHTML = '<div class="layer__drop"></div><div class="layer__slab">' + tiles + '</div><div class="layer__edge"></div><div class="layer__edge layer__edge--r"></div>' +
      (full || labels ? '<span class="layer__label"><b>' + String(i + 1).padStart(2, '0') + '</b>' + esc(layer.k) + '</span>' : '');
    world.appendChild(n); return n;
  });
  host.appendChild(world);
  var S = { rx: 54, rz: -34, gap: 40, sc: 1, ty: 0 };
  function flush() {
    setv(world, '--rx', S.rx.toFixed(2) + 'deg'); setv(world, '--rz', S.rz.toFixed(2) + 'deg');
    setv(world, '--sc', S.sc.toFixed(4)); setv(world, '--ty', S.ty.toFixed(1) + 'px');
    var n = L.length, mid = (n - 1) / 2;
    L.forEach(function (l, i) { setv(l, '--z', ((n - 1 - i - mid) * S.gap).toFixed(1) + 'px'); setv(l, '--do', clamp(0.25 + S.gap / 140, 0.25, 0.75).toFixed(2)); });
  }
  /* several springs move the world in one frame: their writes are merged into one flush after the springs step */
  function apply() { loop.once(flush); }
  var sp = {};
  ['rx', 'rz', 'gap', 'ty'].forEach(function (k) { sp[k] = new Spring(S[k], k === 'gap' || k === 'ty' ? SPR.heavy : SPR.def, function (v) { S[k] = v; apply(); }); });
  apply();
  return { world: world, layers: L, S: S, sp: sp, apply: apply };
}

/* shared sheet engine — 00's click-to-top and the hero's scroll choreography use the same springs.
   order[] lists sheets top-first. Each sheet has a fractional slot spring (sl); dz = (index − slot) × gap, so a reorder is
   pure translateZ. The sheet that travels (`mover`) also lifts (up) and slides out along its own plane (dx) so it never cuts
   through the others, then settles. Springs are critically damped (c = 2√k): ~500 ms settle, no overshoot. Every sheet is
   retargeted from wherever it is now (springs keep their velocity), so a new order mid-animation always lands; pending timers
   are cleared and their end state re-issued, so no sheet is left slid out or at a stale slot. */
var SPR_SHEET = [180, 26.8], SPR_OUT = [300, 34.6];
function sheetEngine(st) {
  var E = { order: st.layers.map(function (l, i) { return i; }) };
  E.L = st.layers.map(function (l, i) {
    var o = { tm: [] };
    o.flush = function () {
      setv(l, '--dz', ((i - o.sl.x) * st.S.gap + o.up.x + o.lift.x * 22 + o.drop.x).toFixed(1) + 'px');
      setv(l, '--dx', o.dx.x.toFixed(1) + 'px');
    };
    o.put = function () { loop.once(o.flush); };
    o.sl = new Spring(i, SPR_SHEET, o.put); o.up = new Spring(0, SPR_SHEET, o.put); o.dx = new Spring(0, SPR_SHEET, o.put);
    o.lift = new Spring(0, SPR.snappy, o.put); o.drop = new Spring(0, SPR.def, o.put);
    return o;
  });
  /* the gap spring drives --z; keep every sheet's slot offset in step with it */
  var gapOn = st.sp.gap.on; st.sp.gap.on = function (v) { gapOn(v); E.L.forEach(function (o) { o.put(); }); };
  E.snap = function () { E.L.forEach(function (o, i) { o.tm.forEach(clearTimeout); o.tm = []; o.sl.to(E.order.indexOf(i), true); o.up.to(0, true); o.dx.to(0, true); }); };
  E.go = function (next, mover, dir) {
    var prev = E.order, k = 0, wW = 520; E.order = next.slice();
    next.forEach(function (j, s) {
      var o = E.L[j]; o.tm.forEach(clearTimeout); o.tm = [];
      o.dx.k = SPR_SHEET[0]; o.dx.c = SPR_SHEET[1];
      if (j === mover) {
        /* slide out along the sheet's own plane, travel in z clear of the stack, then settle in its new slot */
        var hops = Math.abs(prev.indexOf(j) - s), up = s === 0 ? st.S.gap * 0.9 + 26 : 18;
        o.sl.to(s); o.dx.k = SPR_OUT[0]; o.dx.c = SPR_OUT[1]; o.dx.to((dir || -1) * 0.46 * wW); o.up.to(up);
        o.tm.push(setTimeout(function () { o.dx.k = SPR_SHEET[0]; o.dx.c = SPR_SHEET[1]; o.dx.to(0); o.up.to(0); }, 190 + 50 * Math.max(0, hops - 1)));
      } else {
        o.dx.to(0); o.up.to(0);
        /* the others step to their new slots, top-most first, with a slight stagger */
        if (Math.abs(o.sl.t - s) > 1e-3 || Math.abs(o.sl.x - s) > 1e-3) { var d = 70 + 45 * k++; o.tm.push(setTimeout(function () { o.sl.to(s); }, d)); }
      }
    });
  };
  return E;
}

function initHeroStack() {
  var host = $('#hero-stack'); if (!host) return;
  var sec = $('.hero.cine'), st = buildStack(host, false, true), E = sheetEngine(st), cap = $('.hero__object-cap'), capText = cap ? cap.textContent : '';
  var n = st.layers.length, base = 1, MOB = false, mq = matchMedia('(max-width:1023px),(hover:none)');
  var labs = st.layers.map(function (l) { return $('.layer__label', l); });
  /* every scroll-driven value is written on the element that uses it, and only when it changes: a custom property set on the
     section would re-resolve style for the whole hero subtree on every frame */
  function q(s) { return sec ? $(s, sec) : null; }
  var elT = q('.cine__title'), elLamp = q('.cine__lamp'), elCh = q('.cine__chapter'), elSh = q('.cine__shade'), pin = q('.cine__pin'), box = q('.cine__pinbox');
  var elC = sec ? $$('.cine__k, .cine__cap, .cine__scrim, .cine__blur, .cine__copy, .cine__side, .hero__arrow', sec) : [];
  function wv(e, k, v) { if (e) setv(e, k, v); }

  /* the layer caption: each sheet's own name and short content, verbatim from D.stack */
  var capL = null, capIn = null;
  var CAPS = D.stack.map(function (l, i) {
    var names = l.tiles.map(function (t) { return t.t; }), same = l.tiles.length === 1 || names.join(' · ') === l.title;
    var rows = same ? l.tiles.map(function (t) { return t.lines[0]; }) : names;
    return '<p class="cine__layer-k"><b>' + String(i + 1).padStart(2, '0') + '</b>' + esc(l.k) + '</p><p class="cine__layer-t">' + esc(l.title) + '</p>' +
      '<ul class="cine__layer-l">' + rows.map(function (r) { return '<li>' + esc(r) + '</li>'; }).join('') + '</ul>';
  });
  if (box) { capL = el('div', { 'class': 'cine__layer', 'aria-hidden': 'true' }); capIn = el('div', { 'class': 'cine__layer-in' }); capL.appendChild(capIn); box.appendChild(capL); }
  var capTok = 0;
  function setCaption(i) {
    if (!capIn) return;
    var html = i < 0 ? '' : CAPS[i], tok = ++capTok;
    if (!capIn.innerHTML || !capIn.animate) { capIn.innerHTML = html; return; }
    var a = capIn.animate([{ opacity: 1 }, { opacity: 0, transform: 'translate3d(0,-6px,0)' }], { duration: RM ? 120 : 150, easing: 'ease-in', fill: 'forwards' });
    a.onfinish = function () {
      if (tok !== capTok) return;
      capIn.innerHTML = html; a.cancel();
      capIn.animate(RM ? [{ opacity: 0 }, { opacity: 1 }] : [{ opacity: 0, transform: 'translate3d(0,8px,0)' }, { opacity: 1, transform: 'none' }], { duration: RM ? 200 : 360, easing: 'cubic-bezier(.22,1,.36,1)' });
    };
  }

  function fit() {
    var w = host.clientWidth, h = host.clientHeight || 500;
    MOB = mq.matches;
    base = MOB ? clamp(Math.min(w / 600, h / 430), 0.4, 1.2) : clamp(Math.min(w / 780, h / 500), 0.6, 2.1);
    need = true; loop.kick();
  }
  var scS = new Spring(1, SPR.def, function (v) { st.S.sc = v; st.apply(); });
  /* entrance: each sheet drops into place bottom-first (90ms stagger) on its own spring, while the stack settles its angle */
  var ready = RM;
  if (!RM) {
    st.sp.gap.to(110, true); st.sp.rx.to(62, true); st.sp.rz.to(-46, true); scS.to(base * 0.94, true);
    st.layers.forEach(function (l, i) { E.L[i].drop.to(380, true); l.style.setProperty('--la', '0'); });
  }
  var vis = true; onVisible(host, function (v) { vis = v; });
  root.addEventListener('eai:ready', function () {
    ready = true; need = true; loop.kick();
    st.layers.forEach(function (l, i) {
      var d = 200 + (n - 1 - i) * 100;
      setTimeout(function () { E.L[i].drop.to(0); tween(520, function (v) { l.style.setProperty('--la', v.toFixed(3)); }, null, function () { l.style.removeProperty('--la'); }); }, RM ? 0 : d);
    });
  });

  /* scroll choreography over the pinned runway (0..1):
     0–.10   the cover clears and the stack opens until every sheet's edge and label reads
     .10–.84 five equal windows: in each, one sheet comes to the top on the same springs as 00's click-to-top, then holds.
             The deck turns like a carousel (the old top slides off along its plane and settles at the bottom, the rest step up),
             so the order is a pure function of scroll position and reversing simply turns it back.
     .84–1   the last sheet goes under, the stack closes into chapter 00's resting pose on paper, and the pin releases */
  var P = 0, px = 0, py = 0, W = -1, need = true;
  function ss(a, b, x) { var t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); }
  var T0 = 0.1, T1 = 0.84;
  function rot(w) { var o = []; for (var k = 0; k < n; k++) o.push((w + k) % n); return o; }
  function turnTo(w) {
    if (w === W) return;
    var prev = W, next = rot(w % n), top = next[0]; W = w;
    st.layers.forEach(function (l, j) { var s = next.indexOf(j); l.setAttribute('data-slot', s); l.classList.toggle('is-top', s === 0); });
    if (prev < 0 || RM) {
      E.order = next; E.snap();
      if (RM && prev >= 0 && st.world.animate) st.world.animate([{ opacity: 0.4 }, { opacity: 1 }], { duration: 240, easing: 'ease-out' });
    } else if (w === prev + 1) E.go(next, E.order[0], -1); /* forward: the old top slides off and goes under */
    else E.go(next, top, -1);                               /* back (or a jump): the sheet comes out and up to the top */
    setCaption(w < n ? top : -1);
  }
  function pose() {
    if (!ready) return;
    var e1 = ss(0, T0, P), e3 = ss(T1, 1, P), calm = 1 - e1, ex = e1 * (1 - e3), mv = RM ? 0 : 1;
    st.sp.gap.to(lerp(64, MOB ? 78 : 96, ex) + Math.max(0, -py) * 10 * calm);
    st.sp.rz.to(-34 - 6 * ex + px * 9 * calm);
    st.sp.rx.to(54 + 4 * ex - py * 6 * calm);
    scS.to(base * lerp(lerp(1, MOB ? 0.9 : 0.8, e1), 0.86, e3));
    turnTo(P < T1 ? clamp(Math.floor((P - T0) / ((T1 - T0) / n)), 0, n - 1) : n);
    var lab = (ss(0.03, T0, P) * (1 - ss(T1 + 0.01, T1 + 0.08, P))).toFixed(3);
    labs.forEach(function (x) { wv(x, 'opacity', lab); });
    wv(capL, 'opacity', (ss(0.05, T0, P) * (1 - ss(T1 - 0.02, T1 + 0.03, P))).toFixed(3));
    if (MOB || !sec) return;
    wv(host, 'transform', 'translate3d(' + (9 * ex * mv).toFixed(2) + 'vw,' + (-17 * ex * mv).toFixed(2) + 'vh,0)');
    wv(elT, '--p-t-y', (-170 * e1 * mv).toFixed(1) + 'px'); wv(elT, '--p-t-o', (1 - ss(0.01, 0.08, P)).toFixed(3));
    wv(elT, '--p-zh-x', (90 * e1 * mv).toFixed(1) + 'px'); wv(elT, '--p-zh-o', (1 - ss(0, 0.06, P)).toFixed(3));
    var co = (1 - ss(0, 0.05, P)).toFixed(3), cy = (46 * ss(0, 0.06, P) * mv).toFixed(1) + 'px';
    elC.forEach(function (x) { wv(x, '--p-c-o', co); wv(x, '--p-c-y', cy); });
    wv(elLamp, '--p-lamp', (1 + 0.1 * ex * mv).toFixed(3));
    wv(elCh, '--p-ch-o', (ss(T1 + 0.02, T1 + 0.07, P) * (1 - ss(0.95, 0.995, P))).toFixed(3)); wv(elCh, '--p-ch-y', (24 * (1 - ss(T1 + 0.02, T1 + 0.08, P)) * mv).toFixed(1) + 'px');
    wv(elSh, '--p-sh-o', ss(0.88, 0.98, P).toFixed(3));
    var ho = P > 0.86; if (ho !== sec.classList.contains('is-handoff')) sec.classList.toggle('is-handoff', ho);
  }
  /* one frame loop: scroll and pointer only mark the pose dirty; the shared spring loop reads scrollY once per frame,
     poses, then steps the springs. Geometry is measured on resize, never in the scroll path */
  var sTop = 0, sH = 0, sVH = innerHeight, sRun = 1, sIn = true, sCls = null, sDark = null;
  function geo() {
    if (!sec) return; MOB = mq.matches; sVH = innerHeight;
    var r = sec.getBoundingClientRect(); sH = sec.offsetHeight;
    if (MOB && pin && box) {
      var pr = pin.getBoundingClientRect(), stick = parseFloat(getComputedStyle(box).top) || 64;
      sTop = pr.top + scrollY - stick; sRun = Math.max(1, pin.offsetHeight - box.offsetHeight);
    } else { sTop = r.top + scrollY; sRun = sH - sVH; }
  }
  function frame() {
    if (!sec || !need) return; need = false;
    var y = scrollY, pinned = sRun > 40;
    var np = pinned ? clamp((y - sTop) / sRun, 0, 1) : 0, cl = np > 0.002, dark = secTop + sH - y > 80 && (MOB || np < 0.86);
    if (cl !== sCls) { sCls = cl; sec.classList.toggle('is-scrolling', cl); }
    if (dark !== sDark) { sDark = dark; root.classList.toggle('hero-dark', dark); }
    if (!sIn && np >= 1 && P >= 1) return; /* far below the hero: nothing to pose */
    P = np; pose();
  }
  var secTop = 0;
  function measure() { geo(); if (sec) secTop = sec.getBoundingClientRect().top + scrollY; }
  loop.pre(frame);
  function dirty() { need = true; loop.kick(); }
  if (sec && 'IntersectionObserver' in window) new IntersectionObserver(function (es) { sIn = es[0].isIntersecting; }).observe(sec);
  addEventListener('scroll', dirty, { passive: true });
  addEventListener('resize', function () { measure(); fit(); }, { passive: true });
  if ('ResizeObserver' in window) { var gT; new ResizeObserver(function () { clearTimeout(gT); gT = setTimeout(function () { measure(); dirty(); }, 60); }).observe(doc.body); }
  measure(); fit();
  /* hover a sheet: it lifts a little, the caption names it; click goes to chapter 00 with that sheet brought to the top */
  var hot = -1;
  function setHot(i) {
    if (i === hot) return; hot = i;
    E.L.forEach(function (o, j) { o.lift.to(j === i ? 1 : 0); });
    st.layers.forEach(function (l, j) { l.classList.toggle('is-hot', j === i); });
    if (cap) cap.textContent = i >= 0 ? String(i + 1).padStart(2, '0') + ' · ' + D.stack[i].k : capText;
  }
  host.addEventListener('pointermove', function (e) {
    if (e.pointerType !== 'mouse') return;
    var l = e.target.closest && e.target.closest('.layer'); setHot(l ? st.layers.indexOf(l) : -1);
  }, { passive: true });
  host.addEventListener('pointerleave', function () { setHot(-1); }, { passive: true });
  host.addEventListener('click', function (e) {
    var l = e.target.closest && e.target.closest('.layer'); if (!l) return;
    var v = $('#viz-stack'), i = st.layers.indexOf(l); if (v) scrollToEl(v);
    if (window.EAI_STACK_FOCUS) setTimeout(function () { window.EAI_STACK_FOCUS(i); }, 450); else window.EAI_STACK_PENDING = i;
  });
  if (FINE) addEventListener('pointermove', function (e) {
    if (!vis || e.pointerType !== 'mouse' || MOB) return;
    px = e.clientX / innerWidth - 0.5; py = e.clientY / innerHeight - 0.5; dirty();
  }, { passive: true });
}

function initFullStack() {
  var host = $('#full-stack'), panel = $('#stack-panel'); if (!host) return;
  var st = buildStack(host, true), peel = $('#stack-peel'), n = st.layers.length;
  var REST = { rx: 54, rz: -34 }, PICK = { rx: 38, rz: -24 };
  var focus = -1, hot = -1, sel = null;
  function gapFromSlider() { return lerp(6, 92, (+peel.value) / 100); }
  /* click-to-top: the shared sheet engine (sheetEngine above) keeps order[] top-first and moves sheets on springs */
  var E = sheetEngine(st);
  var scS = new Spring(1, SPR.def, function (v) { st.S.sc = v; st.apply(); });
  function fitSc(f) {
    var w = host.clientWidth, h = host.clientHeight || 560, mob = w < 560;
    return f ? clamp(Math.min((w - (mob ? 16 : 56)) / 540, (h - 40) / 330), 0.4, 1.5)
             : clamp(Math.min((w - (mob ? 24 : 150)) / 640, h / 640), 0.42, 0.98);
  }
  function fit(snap) { scS.to(fitSc(false), snap === true); }
  fit(true); addEventListener('resize', function () { fit(true); });
  if ('ResizeObserver' in window) new ResizeObserver(function () { fit(true); }).observe(host);

  /* layout: the stack stays in place; the chosen sheet is on top (order[0]), the rest keep their relative order beneath it */
  function layout(snap) {
    var top = E.order[0];
    if (snap) E.snap();
    E.L.forEach(function (o, i) {
      var h = i === hot && i !== top;
      o.lift.to(0, snap);
      st.layers[i].classList.toggle('is-focus', i === focus);
      st.layers[i].classList.toggle('is-top', i === top);
      st.layers[i].classList.toggle('is-hot', h);
      st.layers[i].classList.toggle('is-dim', false);
    });
    host.classList.toggle('is-picked', focus >= 0);
    fit(snap);
  }
  /* bring sheet i to the top in place (i < 0: back to the natural 01–05 order) */
  function reorder(i, snap) {
    var prev = E.order, next = i < 0 ? prev.slice().sort(function (a, b) { return a - b; }) : [i].concat(prev.filter(function (j) { return j !== i; }));
    var moved = next.some(function (j, s) { return prev[s] !== j; });
    if (snap || !moved) { E.order = next; layout(snap); return; }
    if (RM) { /* reduced motion: instant reorder, short fade */
      E.order = next; layout(true);
      st.world.animate([{ opacity: 0.35 }, { opacity: 1 }], { duration: 180, easing: 'ease-out' });
      return;
    }
    E.go(next, i >= 0 && prev[0] !== i ? i : -1);
    layout(false);
  }
  function setFocus(i, opt) {
    opt = opt || {};
    focus = i == null ? -1 : i; hot = -1; sel = null;
    $$('.tile', host).forEach(function (x) { x.classList.remove('is-sel'); x.setAttribute('aria-pressed', 'false'); });
    host.classList.remove('has-sel');
    $$('.tile', host).forEach(function (x) { x.tabIndex = focus >= 0 && x.closest('.layer') === st.layers[focus] ? 0 : -1; });
    reorder(focus, opt.snap);
    var t = focus >= 0 ? PICK : REST; if (!opt.keepPose) { st.sp.rx.to(t.rx, opt.snap); st.sp.rz.to(t.rz, opt.snap); }
    syncTabs(opt.focusTab);
    renderPanel();
    if (opt.sound !== false && window.EAI_SOUND) window.EAI_SOUND('tick');
  }
  st.sp.gap.to(0, true);
  whenNear(host, function () { setTimeout(function () { st.sp.gap.to(gapFromSlider()); layout(); }, RM ? 0 : 120); }, '-15% 0px');
  peel.addEventListener('input', function () { st.sp.gap.to(gapFromSlider()); });
  $('#stack-reset').addEventListener('click', function () { peel.value = 62; st.sp.gap.to(gapFromSlider()); setFocus(innerWidth < 560 ? 0 : null, { sound: false }); });

  /* tabs: 整体 + one per sheet; arrows / Home / End move between them */
  var tabsEl = el('div', { 'class': 'ltabs', role: 'tablist', 'aria-label': '五层', 'aria-orientation': 'vertical' });
  tabsEl.innerHTML = '<button type="button" role="tab" class="ltab ltab--all" data-l="-1" aria-controls="stack-panel-body"><b>00</b><span>整体</span></button>' +
    D.stack.map(function (l, i) { return '<button type="button" role="tab" class="ltab" data-l="' + i + '" aria-controls="stack-panel-body"><b>' + String(i + 1).padStart(2, '0') + '</b><span>' + esc(l.k) + '</span></button>'; }).join('');
  panel.innerHTML = '';
  var body = el('div', { 'class': 'stack-panel__inner', id: 'stack-panel-body', role: 'tabpanel', 'aria-live': 'polite' });
  panel.appendChild(tabsEl); panel.appendChild(body);
  panel.removeAttribute('aria-live');
  var tabBtns = $$('.ltab', tabsEl);
  function syncTabs(moveFocus) {
    tabBtns.forEach(function (b) { var on = +b.dataset.l === focus; b.setAttribute('aria-selected', on ? 'true' : 'false'); b.tabIndex = on ? 0 : -1; if (on && moveFocus) b.focus({ preventScroll: true }); });
  }
  tabsEl.addEventListener('click', function (e) { var b = e.target.closest('.ltab'); if (b) setFocus(+b.dataset.l < 0 ? null : +b.dataset.l); });
  tabsEl.addEventListener('keydown', function (e) {
    var k = e.key, i = focus + 1, N = n + 1, j = null;
    if (k === 'ArrowDown' || k === 'ArrowRight') j = (i + 1) % N;
    if (k === 'ArrowUp' || k === 'ArrowLeft') j = (i - 1 + N) % N;
    if (k === 'Home') j = 0; if (k === 'End') j = N - 1;
    if (j == null) return; e.preventDefault(); setFocus(j ? j - 1 : null, { focusTab: true });
  });
  /* the 3D labels beside the sheets are pointer targets for the same tabs */
  st.layers.forEach(function (l, i) { var lab = $('.layer__label', l); if (lab) { lab.setAttribute('aria-hidden', 'true'); lab.dataset.l = i; } });

  /* drag to orbit (overview only): horizontal → yaw, vertical → pitch. Capture only after a real drag so taps stay clicks */
  var down = null, dragging = false, lastX = 0, lastT = 0, vx = 0;
  /* the sheet is chosen at press time: sheets keep moving while the button is down, and a release over another sheet would
     otherwise turn the click into a click on their common parent (no sheet at all) */
  var press = null;
  host.addEventListener('pointerdown', function (e) {
    if (e.button) return; down = { x: e.clientX, y: e.clientY, rz: st.sp.rz.t, rx: st.sp.rx.t, id: e.pointerId }; dragging = false; lastX = e.clientX; lastT = performance.now(); vx = 0;
    var l = e.target.closest('.layer'); press = l ? { i: +l.dataset.i, tile: e.target.closest('.tile') } : null;
  });
  host.addEventListener('pointermove', function (e) {
    if (!down || e.pointerId !== down.id) {
      if (e.pointerType === 'mouse' && !down) { var l = e.target.closest && e.target.closest('.layer'); var h = l ? st.layers.indexOf(l) : -1; if (h !== hot) { hot = h; layout(); } }
      return;
    }
    var dx = e.clientX - down.x, dy = e.clientY - down.y;
    if (!dragging && Math.hypot(dx, dy) >= 5) { dragging = true; try { host.setPointerCapture(e.pointerId); } catch (er) {} host.classList.add('is-drag'); }
    if (!dragging) return;
    var now = performance.now(); vx = (e.clientX - lastX) / Math.max(1, now - lastT); lastX = e.clientX; lastT = now;
    st.sp.rz.to(clamp(down.rz + dx * 0.28, -80, 10)); st.sp.rx.to(clamp(down.rx - dy * 0.22, 18, 70));
  });
  host.addEventListener('pointerleave', function () { if (hot >= 0) { hot = -1; layout(); } });
  function end() {
    if (dragging) { st.sp.rz.to(clamp(st.sp.rz.t + vx * 40, -80, 10)); host.classList.remove('is-drag'); }
    down = null; setTimeout(function () { dragging = false; }, 0);
  }
  host.addEventListener('pointerup', end); host.addEventListener('pointercancel', end);
  /* sheet index comes from the element's own data-i (fixed at build), never from DOM order or positions that change while animating */
  st.layers.forEach(function (l, i) { l.dataset.i = i; });
  host.addEventListener('click', function (e) {
    var pr = e.detail ? press : null; press = null;
    if (dragging) return;
    var l = e.target.closest('.layer'), i = pr ? pr.i : l ? +l.dataset.i : -1;
    if (i < 0) return; /* a click beside the sheets keeps the current order (00 / Esc return to the overview) */
    if (i !== E.order[0] || i !== focus) { setFocus(i); return; }
    var t = pr ? pr.tile : e.target.closest('.tile'); if (t) selectTile(t.getAttribute('aria-pressed') === 'true' ? null : t);
  });
  host.addEventListener('keydown', function (e) {
    var step = { ArrowLeft: [0, -6], ArrowRight: [0, 6], ArrowUp: [-4, 0], ArrowDown: [4, 0] }[e.key];
    if (step && e.shiftKey) { e.preventDefault(); st.sp.rx.to(clamp(st.sp.rx.t + step[0], 18, 70)); st.sp.rz.to(clamp(st.sp.rz.t + step[1], -80, 10)); return; }
    if (!e.shiftKey && (e.key === 'ArrowDown' || e.key === 'ArrowUp') && e.target === host) { e.preventDefault(); setFocus(clamp(focus + (e.key === 'ArrowDown' ? 1 : -1), 0, n - 1)); return; }
    if (e.key === 'Escape') { if (sel) selectTile(null); else if (focus >= 0) setFocus(null); }
  });
  host.tabIndex = 0;

  /* the readable panel: overview = every sheet as text; focus = that sheet's tiles as text; tile = its lineage / factory links */
  var tileByKey = {}; D.stack.forEach(function (l, li) { l.tiles.forEach(function (t) { t.layer = l; t.li = li; tileByKey[t.key] = t; }); });
  function tileText(t) { return '<b>' + esc(t.t) + '</b><span>' + t.lines.map(esc).join(' · ') + '</span>'; }
  function renderPanel() {
    var h = '';
    if (sel) {
      var d = tileByKey[sel.dataset.key], layer = d.layer;
      h += '<button type="button" class="stack-panel__back" data-back>' + ico('arrow-right', 'i-back') + '<span>' + String(d.li + 1).padStart(2, '0') + ' ' + esc(layer.k) + '</span></button>';
      h += '<p class="stack-panel__k">' + esc(layer.k) + ' · ' + esc(layer.title) + '</p><h4 class="stack-panel__t">' + esc(d.t) + '</h4><div class="stack-panel__b">';
      h += '<ul class="stack-panel__lines">' + d.lines.map(function (l) { return '<li>' + esc(l) + '</li>'; }).join('') + '</ul>';
      var rows = [];
      (d.lineage || []).forEach(function (name) { LIN.forEach(function (L2) { if (L2.layer === name) { h += '<p class="stack-panel__sub">05 术语谱系 · ' + esc(L2.layer) + '</p><p class="small">' + esc(L2.note) + '</p>'; h += '<ul class="rows">' + L2.rows.map(function (r) { return '<li><button type="button" data-open="lin:' + r.key + '"><b>' + esc(r.term) + '</b><span>' + esc(r.sub) + ' · ' + esc(r.date) + '</span></button></li>'; }).join('') + '</ul>'; } }); });
      (d.rows || []).forEach(function (name) { var r = linByTerm[name]; if (r) rows.push(r); });
      if (rows.length) h += '<p class="stack-panel__sub">05 术语谱系 · ' + esc(rows[0].layer) + '</p><ul class="rows">' + rows.map(function (r) { return '<li><button type="button" data-open="lin:' + r.key + '"><b>' + esc(r.term) + '</b><span>' + esc(r.sub) + ' · ' + esc(r.date) + '</span></button></li>'; }).join('') + '</ul>';
      if (facBy[d.key]) h += '<p class="stack-panel__sub">03 四类工厂</p><ul class="rows"><li><button type="button" data-open="factory:' + d.key + '"><b>' + esc(facBy[d.key].name) + '</b><span>' + esc(facBy[d.key].cn) + '　供给：' + esc(facBy[d.key].supply) + '</span></button></li></ul>';
      if (d.key === 'value' || d.key === 'biz') h += '<p class="stack-panel__sub">04 协作架构 · 08 选型与建设</p><ul class="rows"><li><button type="button" data-open="go:architecture"><b>价值口径</b><span>更高的任务完成率 · 更低的单位任务成本 · 更高的业务 ROI</span></button></li><li><button type="button" data-open="go:formula"><b>每项成功任务完全成本</b><span>建议指标 / 本研究口径，非官方标准</span></button></li></ul>';
      h += '</div>';
    } else if (focus >= 0) {
      var ly = D.stack[focus];
      h += '<p class="stack-panel__k">' + String(focus + 1).padStart(2, '0') + ' · ' + esc(ly.k) + '</p><h4 class="stack-panel__t">' + esc(ly.title) + '</h4>' +
        '<ul class="ltiles">' + ly.tiles.map(function (t) { return '<li><button type="button" data-tile="' + t.key + '">' + tileText(t) + '</button></li>'; }).join('') + '</ul>' +
        '<p class="stack-panel__nav"><button type="button" data-step="-1"' + (focus ? '' : ' disabled') + '>上一层</button><button type="button" data-step="1"' + (focus < n - 1 ? '' : ' disabled') + '>下一层</button></p>';
    } else {
      h += '<p class="stack-panel__k">拖动旋转 · 点击一层查看</p><h4 class="stack-panel__t">选择一层</h4>' +
        '<ol class="lsum">' + D.stack.map(function (l, i) { return '<li><button type="button" data-goto="' + i + '"><b>' + String(i + 1).padStart(2, '0') + '</b><span><em>' + esc(l.k) + '</em>' + esc(l.title) + '</span>' + ico('chevron-right') + '</button></li>'; }).join('') + '</ol>' +
        '<div class="stack-panel__b"><p class="small">每层的条目取自 05 术语谱系中同名的层，点击条目可查看定义与推动者。</p></div>';
    }
    body.innerHTML = h;
    if (!RM) body.animate([{ opacity: 0.001, transform: 'translateY(6px)' }, { opacity: 1, transform: 'none' }], { duration: 320, easing: 'cubic-bezier(.22,1,.36,1)' });
  }
  body.addEventListener('click', function (e) {
    var b = e.target.closest('button'); if (!b) return;
    if (b.hasAttribute('data-back')) { selectTile(null); return; }
    if (b.dataset.goto != null) { setFocus(+b.dataset.goto); return; }
    if (b.dataset.step) { setFocus(clamp(focus + +b.dataset.step, 0, n - 1)); return; }
    if (b.dataset.tile) { var t = $('.tile[data-key="' + b.dataset.tile + '"]', host); if (t) selectTile(t); }
  });
  function selectTile(t) {
    sel = t || null;
    $$('.tile', host).forEach(function (x) { var on = x === t; x.classList.toggle('is-sel', on); x.setAttribute('aria-pressed', on ? 'true' : 'false'); });
    host.classList.toggle('has-sel', !!t);
    if (t) { var li = st.layers.indexOf(t.closest('.layer')); if (li !== focus) { focus = li; reorder(li); syncTabs(); } }
    renderPanel();
  }
  window.EAI_STACK_FOCUS = function (i) { setFocus(i, { sound: false }); };
  var pend = window.EAI_STACK_PENDING; delete window.EAI_STACK_PENDING;
  setFocus(pend != null ? pend : innerWidth < 560 ? 0 : null, { snap: true, sound: false });
  host.appendChild(el('p', { 'class': 'stack-hint', 'aria-hidden': 'true' }, '<span>点击一层 · 移到最上</span><span>↑↓ · 切换层</span><span>拖动 · 旋转</span>'));

  var vt = $('#viz-stack .seg');
  tabs(vt, function (b) {
    var flat = b.dataset.view === 'flat';
    $('#stack-3d').hidden = flat; $('#stack-flat').hidden = !flat; $('#stack-tools').style.visibility = flat ? 'hidden' : '';
    if (!flat) fit();
  });
}

/* =====================================================================
   VIZ C · governance timeline with a draggable cursor. Data: D.events / D.lanes
   ===================================================================== */
function textW(s, px) { var w = 0; for (var i = 0; i < s.length; i++) { var c = s.charCodeAt(i); w += c > 0x2e80 ? 1 : c === 32 ? 0.3 : (c >= 65 && c <= 90) ? 0.66 : 0.55; } return w * (px || 12); }
function mIdx(d) { var p = d.split('-'); return (+p[0] - 2024) * 12 + (+(p[1] || 1) - 1) - 9; }
function mLabel(m) { var t = m + 9, y = 2024 + Math.floor(t / 12), mo = t % 12 + 1; return y + '-' + (mo < 10 ? '0' : '') + mo; }
function initTimeline() {
  var host = $('#tl'), detail = $('#tl-detail'), play = $('#tl-play'); if (!host) return;
  /* r6: the track takes the host's real width (measured once) so labels stay 1:1 at any column width */
  var hw = host.clientWidth, W = hw > 200 ? Math.max(720, Math.round(hw - 36)) : 1100, X0 = 138, X1 = W - 190, M0 = 0, M1 = 25, ROW = 24, PADT = 40;
  var x = function (m) { return X0 + (m - M0) / (M1 - M0) * (X1 - X0); };
  var EV = D.events.map(function (e, i) { return Object.assign({ i: i, m: mIdx(e.d) }, e); });
  /* greedy row packing per lane so labels never overlap */
  var lanes = D.lanes.map(function (l) { return { id: l.id, name: l.name, rows: [] }; }), laneBy = {};
  lanes.forEach(function (l) { laneBy[l.id] = l; });
  EV.slice().sort(function (a, b) { return a.m - b.m; }).forEach(function (e) {
    var L = laneBy[e.lane], x0 = x(e.m) - 7, x1 = x(e.m) + 12 + textW(e.t, 11.5), r = 0;
    while (L.rows[r] != null && L.rows[r] > x0) r++;
    L.rows[r] = x1 + 10; e.row = r;
  });
  var y = PADT; lanes.forEach(function (L) { L.y = y; L.h = Math.max(1, L.rows.length) * ROW + 18; y += L.h + 8; });
  var H = y + 8;
  var svg = sv('svg', { viewBox: '0 0 ' + W + ' ' + H, role: 'img', 'aria-label': '治理与厂商事件时间轴：' + lanes.map(function (l) { return l.name; }).join('、') });
  /* years and quarter ticks */
  var gYr = sv('g');
  for (var m = M0; m <= M1; m++) {
    var lab = mLabel(m), mo = +lab.slice(5);
    if (mo === 1) { gYr.appendChild(sv('line', { 'class': 'yr', x1: x(m), x2: x(m), y1: 22, y2: H - 6 })); gYr.appendChild(sv('text', { 'class': 'yr-t', x: x(m) + 6, y: 18 }, lab.slice(0, 4))); }
    else if (mo % 3 === 1) gYr.appendChild(sv('line', { 'class': 'yr', x1: x(m), x2: x(m), y1: 30, y2: H - 6, 'stroke-dasharray': '2 4', opacity: '.6' }));
  }
  svg.appendChild(gYr);
  var past = sv('rect', { 'class': 'past', x: X0, y: PADT - 6, width: 0, height: H - PADT });
  lanes.forEach(function (L) {
    svg.appendChild(sv('rect', { 'class': 'lane-bg', x: 8, y: L.y, width: W - 16, height: L.h, rx: 10 }));
    svg.appendChild(sv('text', { 'class': 'lane-l', x: 22, y: L.y + 22 }, L.name));
    svg.appendChild(sv('text', { 'class': 'lane-r', x: 22, y: L.y + 38 }, EV.filter(function (e) { return e.lane === L.id; }).length + ' 项'));
  });
  svg.appendChild(past);
  var cy = function (e) { var L = laneBy[e.lane]; return L.y + 18 + e.row * ROW; };
  /* the same name changing lanes: MCP, A2A; AAIF growth */
  var CHAINS = [['MCP', 'lineage:MCP', 'anchor:AAIF'], ['A2A', 'lineage:A2A']];
  var hops = [];
  function chainOf(t, refs) { return EV.filter(function (e) { return refs.indexOf(e.ref) >= 0 && (e.t === t || e.ref === 'anchor:AAIF' && e.d === '2025-12'); }).sort(function (a, b) { return a.m - b.m; }); }
  CHAINS.forEach(function (c) {
    var ch = chainOf(c[0], c.slice(1));
    for (var k = 1; k < ch.length; k++) {
      var a = ch[k - 1], b = ch[k], ax = x(a.m), ay = cy(a), bx = x(b.m), by = cy(b), mx = (ax + bx) / 2;
      var p = sv('path', { 'class': 'hop', d: 'M' + ax + ' ' + ay + ' C' + mx + ' ' + ay + ' ' + mx + ' ' + by + ' ' + bx + ' ' + by });
      p.dataset.m = b.m; svg.appendChild(p); hops.push(p);
    }
  });
  var gEv = sv('g'), evEls = [];
  EV.forEach(function (e) {
    var g = sv('g', { 'class': 'ev', tabindex: '0', role: 'button', 'data-i': e.i, 'aria-label': e.d + ' ' + laneBy[e.lane].name + ' · ' + e.t });
    if (e.status) g.setAttribute('data-status', e.status);
    var X = x(e.m), Y = cy(e);
    g.appendChild(sv('circle', { cx: X, cy: Y, r: 5.5 }));
    g.appendChild(sv('text', { x: X + 11, y: Y + 4 }, e.t));
    gEv.appendChild(g); evEls.push(g);
  });
  svg.appendChild(gEv);
  /* r6: hovering a maturity token in 01's ledger lights the events its body owns (event.ref anchor:<BODY>, narrowed by status when one matches) */
  var axRoot = $('#ax');
  if (axRoot) {
    var hlFor = function (n) {
      var row = n && n.closest('.ax-r'), key = row ? row.id.replace('anchor-', '').toUpperCase() : '', tok = n && n.closest('.status'), st = tok ? (tok.className.match(/status--(\w+)/) || [])[1] : '';
      var m = key ? EV.filter(function (e) { return e.ref === 'anchor:' + key; }) : [], ms = m.filter(function (e) { return st && e.status === st; });
      if (ms.length) m = ms;
      evEls.forEach(function (g, i) { g.classList.toggle('is-hl', m.indexOf(EV[i]) >= 0); });
      svg.classList.toggle('has-hl', m.length > 0);
      $$('.ax-cell .status', axRoot).forEach(function (t) { t.classList.toggle('is-hl', t === tok); });
    };
    $$('.ax-cell .status', axRoot).forEach(function (t) { t.tabIndex = 0; t.setAttribute('role', 'button'); t.setAttribute('aria-label', t.textContent + '：在下方时间轴中标出相关事件'); });
    axRoot.addEventListener('pointerover', function (e) { var t = e.target.closest('.ax-cell .status, .ax-name'); hlFor(t); });
    axRoot.addEventListener('pointerleave', function () { hlFor(null); });
    axRoot.addEventListener('focusin', function (e) { if (e.target.closest('.ax-cell .status')) hlFor(e.target); });
    axRoot.addEventListener('focusout', function () { hlFor(null); });
    axRoot.addEventListener('keydown', function (e) {
      var t = e.target.closest('.ax-cell .status'); if (!t || (e.key !== 'Enter' && e.key !== ' ')) return; e.preventDefault();
      var hit = EV.filter(function (ev, i) { return evEls[i].classList.contains('is-hl'); }).sort(function (a, b) { return b.m - a.m; })[0];
      if (hit) { setM(hit.m, { keepSel: true }); show(hit, true); }
    });
  }
  var cur = sv('g', { 'class': 'cur' });
  var curLine = sv('line', { 'class': 'cur-line', x1: 0, x2: 0, y1: 26, y2: H - 4 });
  var capR = sv('rect', { 'class': 'cur-cap', x: -30, y: 22, width: 60, height: 20, rx: 10 });
  var capT = sv('text', { 'class': 'cur-t', x: 0, y: 36, 'text-anchor': 'middle' });
  var hit = sv('rect', { 'class': 'cur-hit', x: -16, y: 18, width: 32, height: H - 18 });
  [curLine, capR, capT, hit].forEach(function (n) { cur.appendChild(n); });
  svg.appendChild(cur);
  host.appendChild(svg);

  var minM = 1, maxM = 24, cm = maxM, sel = null;
  var CM = new Spring(cm, SPR.snappy, function (v) { draw(v); });
  function draw(v) {
    var X = x(v); cur.setAttribute('transform', 'translate(' + X.toFixed(2) + ',0)');
    past.setAttribute('width', Math.max(0, X - X0).toFixed(2));
    var mm = Math.round(v); capT.textContent = mLabel(mm);
    evEls.forEach(function (g, i) { g.classList.toggle('is-past', EV[i].m <= v + 0.001); });
    hops.forEach(function (p) { p.classList.toggle('is-on', +p.dataset.m <= v + 0.001); });
  }
  function setM(m, opts) {
    m = clamp(Math.round(m), minM, maxM); var changed = m !== cm; cm = m;
    host.setAttribute('aria-valuenow', m); host.setAttribute('aria-valuemin', minM); host.setAttribute('aria-valuemax', maxM); host.setAttribute('aria-valuetext', mLabel(m));
    CM.to(m, opts && opts.snap);
    if (changed && !(opts && opts.keepSel)) { var last = EV.filter(function (e) { return e.m <= m; }).sort(function (a, b) { return b.m - a.m || b.i - a.i; })[0]; show(last, false); }
  }
  function show(e, explicit) {
    sel = e || null;
    evEls.forEach(function (g, i) { g.classList.toggle('is-sel', !!e && i === e.i); });
    if (!e) { detail.innerHTML = '<p class="small">拖动游标或点击事件</p>'; return; }
    var L = laneBy[e.lane], st = e.status ? '<span class="status status--' + e.status + '">' + esc(D.status[e.status]) + '</span>' : '';
    var go = '';
    if (e.ref) {
      var p = e.ref.split(':'), r;
      if (p[0] === 'lineage' && (r = linByTerm[p[1]])) go = '<button class="go" type="button" data-open="lin:' + r.key + '">05 术语谱系 · ' + esc(r.term) + ' →</button>';
      else if (p[0] === 'vendor') go = '<button class="go" type="button" data-open="vendor:' + esc(p[1]) + '">07 厂商架构 · ' + esc(p[1]) + ' →</button>';
      else if (p[0] === 'anchor') go = '<a class="go" href="#anchor-' + p[1].toLowerCase() + '">01 标准与治理 · ' + esc(p[1]) + ' ↑</a>';
    }
    detail.innerHTML = '<div class="tl-detail__d"><b>' + esc(e.d) + '</b><span class="lane-chip">' + esc(L.name) + '</span>' + st + (e.srcDate ? '<span class="lane-chip">来源日期</span>' : '') + '</div>' +
      '<div class="tl-detail__b"><h5>' + esc(e.t) + '</h5><p>' + esc(e.x) + '</p>' + (e.note ? '<p class="meta">' + esc(e.note) + '</p>' : '') +
      '<p class="meta">' + (e.src ? srefs(e.src) + ' ' : '') + go + '</p></div>';
    if (explicit && !RM) detail.animate([{ opacity: 0.001, transform: 'translateY(6px)' }, { opacity: 1, transform: 'none' }], { duration: 300, easing: 'cubic-bezier(.33,1,.68,1)' });
  }
  /* pointer: press anywhere on the track to move the cursor, drag to scrub */
  function mFromClient(cx) { var r = svg.getBoundingClientRect(); var vx = (cx - r.left) / r.width * W; return M0 + (vx - X0) / (X1 - X0) * (M1 - M0); }
  var drag = null;
  svg.addEventListener('pointerdown', function (e) {
    var g = e.target.closest('.ev'); if (g) return;
    stopPlay(); drag = { x: e.clientX, id: e.pointerId, moved: false };
  });
  svg.addEventListener('pointermove', function (e) {
    if (drag && e.pointerId === drag.id) {
      if (!drag.moved && Math.abs(e.clientX - drag.x) > 4) { drag.moved = true; try { svg.setPointerCapture(e.pointerId); } catch (er) {} }
      if (drag.moved) setM(mFromClient(e.clientX));
    }
    var g = e.target.closest('.ev');
    if (g && FINE) { var ev = EV[+g.dataset.i]; tip('<b>' + esc(ev.t) + '</b>' + esc(ev.x.length > 70 ? ev.x.slice(0, 70) + '…' : ev.x) + '<small>' + esc(ev.d) + ' · ' + esc(laneBy[ev.lane].name) + '</small>', e.clientX, e.clientY, (g.querySelector('circle') || g).getBoundingClientRect()); }
    else tip(null);
  });
  svg.addEventListener('pointerleave', function () { tip(null); });
  svg.addEventListener('pointerup', function (e) { if (drag && !drag.moved && !e.target.closest('.ev')) setM(mFromClient(e.clientX)); drag = null; });
  svg.addEventListener('pointercancel', function () { drag = null; });
  svg.addEventListener('click', function (e) { var g = e.target.closest('.ev'); if (g) { var ev = EV[+g.dataset.i]; stopPlay(); if (ev.m > cm) setM(ev.m, { keepSel: true }); show(ev, true); } });
  svg.addEventListener('keydown', function (e) { var g = e.target.closest('.ev'); if (g && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); e.stopPropagation(); g.dispatchEvent(new MouseEvent('click', { bubbles: true })); } });
  host.addEventListener('keydown', function (e) {
    if (e.target !== host) return;
    var k = { ArrowLeft: -1, ArrowDown: -1, ArrowRight: 1, ArrowUp: 1, PageDown: -3, PageUp: 3 }[e.key];
    if (k) { e.preventDefault(); stopPlay(); setM(cm + k); }
    if (e.key === 'Home') { e.preventDefault(); setM(minM); } if (e.key === 'End') { e.preventDefault(); setM(maxM); }
  });
  /* playback: a steady sweep, sine in/out, one pass */
  var pl = null;
  function stopPlay() { if (pl) { pl.stop = true; pl = null; } if (play) { play.setAttribute('aria-pressed', 'false'); $('span', play).textContent = '播放'; } }
  if (play) play.addEventListener('click', function () {
    if (pl) { stopPlay(); return; }
    play.setAttribute('aria-pressed', 'true'); $('span', play).textContent = '暂停';
    var from = cm >= maxM ? minM : cm; setM(from, { snap: true });
    if (RM) { setM(maxM); stopPlay(); return; }
    pl = tween((maxM - from) * 320, function (p) { var m = lerp(from, maxM, p); CM.to(m, true); var r = Math.round(m); if (r !== cm) setM(r, { snap: true }); }, EASE.inOutSine, function () { pl = null; stopPlay(); });
  });
  setM(maxM, { snap: true }); show(EV.filter(function (e) { return e.m === maxM; }).slice(-1)[0], false);
  /* r6: no autoplay sweep (P16) — the reader scrubs */
  /* narrow screens: the track scrolls sideways — open on the cursor's end (the latest record) */
  whenNear(host, function () { if (host.scrollWidth > host.clientWidth + 4) host.scrollLeft = host.scrollWidth; }, '0px');
}

/* =====================================================================
   VIZ B · capability-domain map: 62 glossary terms placed by their own "所属能力域" field
   ===================================================================== */
var mapApi = null;
function rng(seed) { var s = seed >>> 0 || 1; return function () { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return ((s >>> 0) % 100000) / 100000; }; }
function hash(str) { var h = 2166136261; for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
function initMap() {
  var host = $('#map'); if (!host) return;
  var narrow = host.clientWidth < 700;
  /* layout: neighbours share the most terms (C5|C6, C5|C7, C5|C8, C2|C4, C1|C2, C3|C6) */
  var ORDER = narrow ? [['C8', 'C5'], ['C7', 'C6'], ['C4', 'C3'], ['C2', 'C1']] : [['C8', 'C5', 'C7', 'C4'], ['C3', 'C6', 'C1', 'C2']];
  if (narrow) ORDER = [['C8', 'C5'], ['C3', 'C6'], ['C7', 'C4'], ['C1', 'C2']];
  var cols = ORDER[0].length, rows = ORDER.length, GAP = 18, PAD = 16, BW = narrow ? 300 : 282, BH = narrow ? 300 : 300, AX = narrow ? 70 : 92;
  var W = PAD * 2 + cols * BW + (cols - 1) * GAP;
  var gridH = rows * BH + (rows - 1) * GAP + AX;
  var BAND = 86, H = PAD + gridH + 16 + BAND + PAD;
  if (narrow) host.style.height = Math.round(H * host.clientWidth / W) + 'px';
  var box = {};
  ORDER.forEach(function (r, ri) { r.forEach(function (id, ci) {
    var bx = PAD + ci * (BW + GAP), by = PAD + ri * (BH + GAP) + (ri >= rows / 2 ? AX : 0);
    box[id] = { x: bx, y: by, w: BW, h: BH, cx: bx + BW / 2, cy: by + BH / 2 + 10 };
  }); });
  var axisY = PAD + (rows / 2) * (BH + GAP) - GAP / 2 + AX / 2;
  box.G = { x: PAD, y: PAD + gridH + 16, w: W - PAD * 2, h: BAND, cx: W / 2, cy: PAD + gridH + 16 + BAND / 2 + 8 };
  box.X = { x: PAD + 40, y: axisY - AX / 2 + 12, w: W - PAD * 2 - 40, h: AX - 24, cx: W / 2, cy: axisY };

  var svg = sv('svg', { viewBox: '0 0 ' + W + ' ' + H, role: 'group', 'aria-label': '能力域地图' });
  var vp = sv('g', { 'class': 'vp' }); svg.appendChild(vp);
  /* G band and the cross-layer axis */
  var band = sv('g', { 'class': 'band' });
  band.appendChild(sv('rect', { x: box.G.x, y: box.G.y, width: box.G.w, height: box.G.h, rx: 14 }));
  band.appendChild(sv('text', { x: box.G.x + 16, y: box.G.y + 22 }, 'G1 · G2　安全治理 / 评测运营：贯穿全部能力域的横轴'));
  vp.appendChild(band);
  var ax = sv('g', { 'class': 'axisx' });
  ax.appendChild(sv('line', { x1: PAD, x2: W - PAD, y1: axisY, y2: axisY }));
  ax.appendChild(sv('text', { x: PAD + 4, y: axisY - 6 }, '跨层'));
  vp.appendChild(ax);
  var domEls = {};
  DOM.forEach(function (d) {
    var b = box[d.id], g = sv('g', { 'class': 'dom', tabindex: '0', role: 'button', 'data-dom': d.id, 'aria-label': d.id + ' ' + d.name + '：放大查看，再次激活打开详情' });
    g.appendChild(sv('rect', { 'class': 'f', x: b.x, y: b.y, width: b.w, height: b.h, rx: 14 }));
    g.appendChild(sv('text', { 'class': 'dl', x: b.x + 14, y: b.y + 22 }, d.id));
    g.appendChild(sv('text', { 'class': 'dn', x: b.x + 42, y: b.y + 22 }, d.name.length > 30 ? d.name.slice(0, 29) + '…' : d.name));
    g.appendChild(sv('text', { 'class': 'dc', x: b.x + b.w - 14, y: b.y + b.h - 12, 'text-anchor': 'end' }, termsInDomain(d.id).length + ' 条'));
    vp.appendChild(g); domEls[d.id] = g;
  });
  /* place nodes */
  var linkG = sv('g'); vp.appendChild(linkG);
  var nodes = G.map(function (g) {
    var caps = String(g.caps).indexOf('跨层') === 0 ? ['X'] : capsOf(g.caps);
    var r = rng(hash(g.term)), anchors = caps.map(function (c) { return box[c]; }).filter(Boolean), x, y;
    var lw = textW(g.term, 11) + 14;
    if (anchors.length === 1 && caps[0] !== 'X') { var b = anchors[0]; x = b.x + 16 + r() * Math.max(10, b.w - 32 - lw); y = b.y + 46 + r() * (b.h - 70); if (caps[0] === 'G') { y = b.y + 44 + r() * (b.h - 54); } }
    else { x = anchors.reduce(function (s, b) { return s + b.cx; }, 0) / anchors.length - lw / 2 + (r() - 0.5) * 30; y = anchors.reduce(function (s, b) { return s + b.cy; }, 0) / anchors.length + (r() - 0.5) * 30; }
    var kind = caps[0] === 'X' ? 'x' : caps.indexOf('G') >= 0 ? 'g' : caps.length > 1 ? 'multi' : 'one';
    return { g: g, caps: caps, anchors: anchors, x: x, y: y, w: lw, kind: kind, one: anchors.length === 1 && caps[0] !== 'X' ? anchors[0] : null };
  });
  /* relax label rectangles apart; single-domain terms stay inside their box */
  for (var it = 0; it < 140; it++) {
    for (var i = 0; i < nodes.length; i++) for (var j = i + 1; j < nodes.length; j++) {
      var a = nodes[i], b2 = nodes[j];
      var ox = Math.min(a.x + a.w, b2.x + b2.w) - Math.max(a.x - 6, b2.x - 6), oy = 20 - Math.abs(a.y - b2.y);
      if (ox > 0 && oy > 0) {
        if (oy < ox) { var s = a.y < b2.y ? -1 : 1; a.y += s * oy / 2; b2.y -= s * oy / 2; }
        else { var s2 = a.x < b2.x ? -1 : 1; a.x += s2 * ox / 2; b2.x -= s2 * ox / 2; }
      }
    }
    nodes.forEach(function (n) {
      var B = n.one;
      if (B) { n.x = clamp(n.x, B.x + 14, B.x + B.w - n.w - 4); n.y = clamp(n.y, B.y + (B === box.G ? 40 : 44), B.y + B.h - 26); }
      else { n.x = clamp(n.x, PAD + 6, W - PAD - n.w); n.y = clamp(n.y, PAD + 40, H - PAD - 10); }
      if (!B || B === box.X) ORDER.forEach(function (r) { r.forEach(function (id) { var b = box[id];
        if (n.x + n.w > b.x && n.x < b.x + b.w && n.y > b.y - 8 && n.y < b.y + 40) n.y = (n.y < b.y + 16) ? b.y - 10 : b.y + 44; }); });
    });
  }
  var COL = { one: 'var(--ink-3)', multi: 'var(--ochre)', g: 'var(--red)', x: 'var(--c-data)' };
  var nodeG = sv('g'); vp.appendChild(nodeG);
  nodes.forEach(function (n, i) {
    n.links = n.anchors.filter(function (b) { return b !== n.one; }).map(function (b) {
      var tx = clamp(n.x, b.x + 10, b.x + b.w - 10), ty = clamp(n.y, b.y + 10, b.y + b.h - 10);
      if (b === box.X) { tx = n.x; ty = axisY; }
      var l = sv('path', { 'class': 'link', d: 'M' + n.x.toFixed(1) + ' ' + n.y.toFixed(1) + ' L' + tx.toFixed(1) + ' ' + ty.toFixed(1) }); linkG.appendChild(l); return l;
    });
    var gg = sv('g', { 'class': 'node', tabindex: '-1', role: 'button', 'data-i': i, 'aria-label': n.g.term + '（' + n.g.caps + '）', style: '--nc:' + COL[n.kind] });
    gg.appendChild(sv('circle', { cx: n.x.toFixed(1), cy: n.y.toFixed(1), r: 4.5 }));
    gg.appendChild(sv('text', { x: (n.x + 9).toFixed(1), y: (n.y + 4).toFixed(1) }, n.g.term));
    nodeG.appendChild(gg); n.el = gg;
  });
  host.appendChild(svg);
  host.appendChild(el('div', { 'class': 'map__legend', 'aria-hidden': 'true' },
    '<span><i style="--lc:var(--ink-3)"></i>单一能力域</span><span><i style="--lc:var(--ochre)"></i>跨能力域</span><span><i style="--lc:var(--red)"></i>含治理横轴 G</span><span><i style="--lc:var(--c-data)"></i>跨层</span><span>' + (FINE ? '拖动平移 · ⌘/Ctrl + 滚轮缩放' : '点按能力域放大 · 双指缩放') + '</span>'));

  /* ---------- camera: spring-driven pan & zoom ---------- */
  var cam = { x: 0, y: 0, k: 1 }, fitK = 1;
  function applyCam() { vp.setAttribute('transform', 'translate(' + cam.x.toFixed(2) + ',' + cam.y.toFixed(2) + ') scale(' + cam.k.toFixed(4) + ')'); host.style.touchAction = cam.k > fitK * 1.08 ? 'none' : 'pan-y'; }
  var CX = new Spring(0, SPR.def, function (v) { cam.x = v; applyCam(); }), CY = new Spring(0, SPR.def, function (v) { cam.y = v; applyCam(); }), CK = new Spring(1, SPR.def, function (v) { cam.k = v; applyCam(); });
  var vw = 1, vh2 = 1;
  function size() { vw = host.clientWidth; vh2 = host.clientHeight; svg.setAttribute('viewBox', '0 0 ' + vw + ' ' + vh2); fitK = Math.min(vw / W, vh2 / H); }
  function camTo(k, cx, cy, snap) { /* centre world point (cx,cy) at k */ CK.to(k, snap); CX.to(vw / 2 - cx * k, snap); CY.to(vh2 / 2 - cy * k, snap); }
  function fit(snap) { focusDom = null; camTo(fitK, W / 2, H / 2, snap); }
  size(); fit(true);
  addEventListener('resize', function () { size(); if (!focusDom) fit(true); });

  /* ---------- highlight state ---------- */
  var focusDom = null, vendorOn = null, mx = null;
  function setHot(pred, doms) {
    var any = !!pred;
    host.classList.toggle('is-filter', any);
    nodes.forEach(function (n) { var on = any && pred(n); n.el.classList.toggle('is-hot', on); n.links.forEach(function (l) { l.classList.toggle('is-hot', on); }); });
    Object.keys(domEls).forEach(function (id) { domEls[id].classList.toggle('is-hot', !!doms && doms.indexOf(id) >= 0); });
    $$('.dcard').forEach(function (c) { c.classList.toggle('is-hot', !!doms && doms.indexOf(c.dataset.dom) >= 0); });
  }
  function baseHot() {
    var q = norm($('#map-q').value).trim();
    if (vendorOn) { var ms = vendorMentions(vendorOn); setHot(function (n) { return ms.indexOf(n.g) >= 0; }); }
    else if (q) setHot(function (n) { return norm(n.g.term).indexOf(q) >= 0 || norm(n.g.plain).indexOf(q) >= 0; });
    else if (focusDom) setHot(function (n) { return n.caps.indexOf(focusDom) >= 0; }, [focusDom]);
    else setHot(null);
    /* the search field says how many terms it found, and says so plainly when it found none */
    var fq = $('#map-q'), fn = fq.parentNode.querySelector('.field__n');
    if (!fn) { fn = el('span', { 'class': 'field__n', 'aria-live': 'polite' }); fq.parentNode.appendChild(fn); }
    var hits = q ? G.filter(function (g) { return norm(g.term).indexOf(q) >= 0 || norm(g.plain).indexOf(q) >= 0; }).length : -1;
    fn.textContent = hits < 0 ? '' : hits ? hits + ' 条' : '无匹配'; fn.classList.toggle('is-none', hits === 0); fq.parentNode.classList.toggle('has-n', hits >= 0);
    if (mx) {
      var set = null;
      if (vendorOn) set = vendorMentions(vendorOn).map(function (g) { return g.term; });
      else if (q) set = G.filter(function (g) { return norm(g.term).indexOf(q) >= 0 || norm(g.plain).indexOf(q) >= 0; }).map(function (g) { return g.term; });
      mx.filter(set ? new Set(set) : null, vendorOn);
    }
  }
  function nodeOf(t) { return t && t.closest ? t.closest('.node') : null; }
  svg.addEventListener('pointerover', function (e) {
    var nd = nodeOf(e.target), dm = e.target.closest && e.target.closest('.dom');
    if (nd) { var n = nodes[+nd.dataset.i]; setHot(function (m) { return m === n; }, n.caps); }
    else if (dm && !drag) { var id = dm.dataset.dom; setHot(function (m) { return m.caps.indexOf(id) >= 0; }, [id]); }
  });
  svg.addEventListener('pointermove', function (e) {
    var nd = nodeOf(e.target);
    if (nd && FINE && !drag) { var n = nodes[+nd.dataset.i]; tip('<b>' + esc(n.g.term) + '</b>' + esc(n.g.plain) + '<small>' + esc(n.g.type) + ' · ' + esc(n.g.caps) + '</small>', e.clientX, e.clientY, (nd.querySelector('circle,rect') || nd).getBoundingClientRect()); }
    else tip(null);
  });
  svg.addEventListener('pointerleave', function () { tip(null); baseHot(); });
  svg.addEventListener('pointerout', function (e) { if (!e.relatedTarget || !svg.contains(e.relatedTarget)) return; if (!nodeOf(e.relatedTarget) && !(e.relatedTarget.closest && e.relatedTarget.closest('.dom'))) baseHot(); });

  /* ---------- pointer: drag to pan (mouse anywhere; touch when zoomed), pinch to zoom ---------- */
  var ptrs = {}, drag = null, pinch = null, moved = false;
  svg.addEventListener('pointerdown', function (e) {
    ptrs[e.pointerId] = [e.clientX, e.clientY]; moved = false;
    var ids = Object.keys(ptrs);
    if (ids.length === 1) drag = { x: e.clientX, y: e.clientY, cx: CX.t, cy: CY.t, id: e.pointerId, cap: false };
    if (ids.length === 2) { var a = ptrs[ids[0]], b = ptrs[ids[1]]; pinch = { d: Math.hypot(a[0] - b[0], a[1] - b[1]), k: CK.t }; drag = null; try { svg.setPointerCapture(e.pointerId); } catch (er) {} }
  });
  svg.addEventListener('pointermove', function (e) {
    if (!ptrs[e.pointerId]) return; ptrs[e.pointerId] = [e.clientX, e.clientY];
    var ids = Object.keys(ptrs), r = svg.getBoundingClientRect();
    if (pinch && ids.length === 2) {
      var a = ptrs[ids[0]], b = ptrs[ids[1]], d = Math.hypot(a[0] - b[0], a[1] - b[1]), mx = (a[0] + b[0]) / 2 - r.left, my = (a[1] + b[1]) / 2 - r.top;
      zoomAt(clamp(pinch.k * d / pinch.d, fitK * 0.9, 3.2), mx, my, true); moved = true; return;
    }
    if (!drag || drag.id !== e.pointerId) return;
    var dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    if (!drag.cap && Math.hypot(dx, dy) > 5) { if (e.pointerType === 'touch' && CK.t <= fitK * 1.08) { drag = null; return; } drag.cap = true; moved = true; try { svg.setPointerCapture(e.pointerId); } catch (er) {} host.classList.add('is-drag'); tip(null); }
    if (drag.cap) { CX.to(drag.cx + dx, true); CY.to(drag.cy + dy, true); }
  });
  function up(e) { delete ptrs[e.pointerId]; if (Object.keys(ptrs).length < 2) pinch = null; if (drag && drag.id === e.pointerId) { drag = null; host.classList.remove('is-drag'); } }
  svg.addEventListener('pointerup', up); svg.addEventListener('pointercancel', up);
  function zoomAt(k, sx, sy, snap) { var wx = (sx - CX.t) / CK.t, wy = (sy - CY.t) / CK.t; CK.to(k, snap); CX.to(sx - wx * k, snap); CY.to(sy - wy * k, snap); }
  host.addEventListener('wheel', function (e) {
    if (!(e.ctrlKey || e.metaKey)) return;
    e.preventDefault(); var r = svg.getBoundingClientRect();
    zoomAt(clamp(CK.t * Math.exp(-e.deltaY * 0.004), fitK * 0.9, 3.2), e.clientX - r.left, e.clientY - r.top);
  }, { passive: false });
  $('#map-zin').addEventListener('click', function () { zoomAt(clamp(CK.t * 1.35, fitK * 0.9, 3.2), vw / 2, vh2 / 2); });
  $('#map-zout').addEventListener('click', function () { zoomAt(clamp(CK.t / 1.35, fitK * 0.9, 3.2), vw / 2, vh2 / 2); });
  $('#map-fit').addEventListener('click', function () { fit(); baseHot(); });

  function focusDomain(id) {
    var b = box[id]; focusDom = id;
    camTo(Math.min(vw / (b.w + 40), vh2 / (b.h + 40), Math.max(fitK * 1.7, 1.15), 1.6), b.x + b.w / 2, b.y + b.h / 2);
    baseHot();
  }
  svg.addEventListener('click', function (e) {
    if (moved) return;
    var nd = nodeOf(e.target);
    if (nd) { ov.opener = nd; openItem('term:' + nodes[+nd.dataset.i].g.term); return; }
    var dm = e.target.closest('.dom');
    if (dm) { var id = dm.dataset.dom; if (focusDom === id) { ov.opener = dm; openItem('domain:' + id); } else focusDomain(id); }
  });
  svg.addEventListener('keydown', function (e) {
    var t = e.target;
    if ((e.key === 'Enter' || e.key === ' ') && (t.classList.contains('node') || t.classList.contains('dom'))) { e.preventDefault(); t.dispatchEvent(new MouseEvent('click', { bubbles: true })); }
    /* arrow keys walk the terms of the focused domain */
    if (t.classList.contains('dom') && e.key === 'ArrowDown') { e.preventDefault(); var id = t.dataset.dom; var first = nodes.filter(function (n) { return n.caps.indexOf(id) >= 0; })[0]; if (first) { first.el.tabIndex = 0; first.el.focus(); } }
    if (t.classList.contains('node') && /Arrow/.test(e.key)) {
      e.preventDefault(); var cur = nodes[+t.dataset.i], dirs = { ArrowRight: [1, 0], ArrowLeft: [-1, 0], ArrowDown: [0, 1], ArrowUp: [0, -1] }[e.key], best = null, bd = 1e9;
      nodes.forEach(function (n) { if (n === cur) return; var dx = n.x - cur.x, dy = n.y - cur.y, along = dx * dirs[0] + dy * dirs[1]; if (along <= 0) return; var d = along + Math.abs(dx * dirs[1] + dy * dirs[0]) * 2.5; if (d < bd) { bd = d; best = n; } });
      if (best) { t.tabIndex = -1; best.el.tabIndex = 0; best.el.focus(); }
    }
  });
  svg.addEventListener('focusin', function (e) { var nd = nodeOf(e.target); if (nd) { var n = nodes[+nd.dataset.i]; setHot(function (m) { return m === n; }, n.caps); } });

  /* ---------- vendor chips + search ---------- */
  var vh = $('#map-vendors');
  var names = VEN.map(function (v) { return v.n; }).concat(['AWS', 'NVIDIA']);
  vh.innerHTML = '<span class="vlabel">按厂商高亮</span>' + names.map(function (n) { var c = vendorMentions(n).length; return '<button class="vchip" type="button" aria-pressed="false" data-v="' + esc(n) + '"' + (c ? '' : ' disabled title="术语表的代表实现与专业定义中未出现该名称"') + '>' + esc(n) + '<span class="n">' + c + '</span></button>'; }).join('');
  vh.addEventListener('click', function (e) {
    var b = e.target.closest('.vchip'); if (!b || b.disabled) return;
    var on = b.getAttribute('aria-pressed') !== 'true';
    $$('.vchip', vh).forEach(function (x) { x.setAttribute('aria-pressed', x === b && on ? 'true' : 'false'); });
    vendorOn = on ? b.dataset.v : null; if (on) $('#map-q').value = '';
    baseHot();
  });
  $('#map-q').addEventListener('input', function () { vendorOn = null; $$('.vchip', vh).forEach(function (x) { x.setAttribute('aria-pressed', 'false'); }); baseHot(); });
  $('#map-q').addEventListener('keydown', function (e) { if (e.key === 'Enter') { var n = nodes.filter(function (n) { return n.el.classList.contains('is-hot'); })[0]; if (n) locate(n); } });

  function locate(n) {
    focusDom = null; vendorOn = null;
    camTo(Math.max(fitK * 1.6, 1.25), n.x + n.w / 2, n.y);
    setHot(function (m) { return m === n; }, n.caps);
    n.el.tabIndex = 0; setTimeout(function () { n.el.focus({ preventScroll: true }); }, 60);
  }
  mapApi = { locate: function (term) {
    if (mx && fig.classList.contains('is-3d')) { mx.locate(term); return; }
    var n = nodes.filter(function (x) { return x.g.term === term; })[0]; if (n) locate(n);
  } };
  /* ---------- the 3D machine (立体拆解): lazy, optional; the flat map above stays the accessible view ---------- */
  var fig = $('#viz-map'), mhost = $('#map3d'), seg = $('#map-view');
  function glOK() { /* no probe context: creating one costs a second WebGL context (and seconds on software GL); if the machine's own context fails, ensureMachine rejects and the flat map takes over */ return !!(window.WebGL2RenderingContext || window.WebGLRenderingContext); }
  function assetBase() { var sc = $('script[src*="assets/js/app.js"]'); return sc ? sc.getAttribute('src').replace(/app\.js.*$/, '') : 'assets/js/'; }
  function loadScript(src) { return new Promise(function (res, rej) { var t = doc.createElement('script'); t.src = src; t.async = true; t.onload = res; t.onerror = rej; doc.head.appendChild(t); }); }
  var loading = null;
  function ensureMachine() {
    if (mx) return Promise.resolve(mx);
    if (loading) return loading;
    var b = assetBase();
    mhost.classList.add('is-loading');
    /* fetch the two 3D files in parallel (mount reads the assets only at mount time), then mount in an idle slice of its own */
    var idle = function () { return new Promise(function (r) { if (window.requestIdleCallback) requestIdleCallback(function () { r(); }, { timeout: 1500 }); else setTimeout(r, 40); }); };
    loading = Promise.all([loadScript(b + 'machine-assets.js').catch(function () {}), loadScript(b + 'map3d.js')]).then(idle).then(function () {
      var hits = {};
      names.forEach(function (n) { hits[n] = vendorMentions(n).map(function (g) { return g.term; }); });
      mx = window.EAI_MACHINE.mount(mhost, {
        data: D, vendorHits: hits, esc: esc, ico: ico, reduced: RM || (/[?&]mxsnap/.test(location.search) && !/[?&]mxtour/.test(location.search)), dark: root.getAttribute('data-theme') === 'dark', sound: window.EAI_SOUND,
        open: function (spec) { openItem(spec); ov.opener = mhost.querySelector('.mx__stage'); },
        onFilter: function () { vendorOn = null; $$('.vchip', vh).forEach(function (x) { x.setAttribute('aria-pressed', 'false'); }); $('#map-q').value = ''; host.classList.remove('is-filter'); }
      });
      mhost.__mx = mx;
      new MutationObserver(function () { mx.theme(root.getAttribute('data-theme') === 'dark'); }).observe(root, { attributes: true, attributeFilter: ['data-theme'] });
      var m = /[?&]mx=([^&#]+)/.exec(location.search);
      if (m) { var st = {}; decodeURIComponent(m[1]).split(',').forEach(function (kv) { var p = kv.split(':'); st[p[0]] = p[1]; }); mx.state(st); }
      mhost.classList.remove('is-loading');
      baseHot();
      return mx;
    });
    return loading;
  }
  var segPlace = null;
  function setView(v, save) {
    var three = v === '3d';
    $$('button', seg).forEach(function (b) { b.setAttribute('aria-pressed', b.dataset.v === v ? 'true' : 'false'); });
    if (segPlace) segPlace(); 
    if (save) try { localStorage.setItem('eai-map-view', v); } catch (e) {}
    if (three) {
      ensureMachine().then(function () { fig.classList.add('is-3d'); mhost.hidden = false; }, function () { setView('2d'); seg.hidden = true; });
    } else { fig.classList.remove('is-3d'); mhost.hidden = true; if (mx) mx.tour.stop(); size(); fit(true); }
  }
  if (seg) {
    if (!glOK()) seg.hidden = true;
    else {
      seg.hidden = false; segPlace = segIndicator(seg);
      seg.addEventListener('click', function (e) { var b = e.target.closest('button[data-v]'); if (b) setView(b.dataset.v, true); });
      var pref = null; try { pref = localStorage.getItem('eai-map-view'); } catch (e) {}
      if (/[?&]mx=/.test(location.search)) pref = '3d';
      setView(pref || (innerWidth >= 900 ? '3d' : '2d'));
    }
  }
  /* domain cards below the map highlight their region on hover */
  $$('.dcard').forEach(function (c) {
    c.addEventListener('pointerenter', function () { var id = c.dataset.dom; setHot(function (m) { return m.caps.indexOf(id) >= 0; }, [id]); if (mx) mx.preview(id); });
    c.addEventListener('pointerleave', function () { baseHot(); if (mx) mx.preview(null); });
  });
}
function locateOnMap(term) {
  var v = $('#viz-map');
  var go = function () { if (!mapApi) initMap(); if (mapApi) mapApi.locate(term); };
  scrollToEl(v, go);
}

/* =====================================================================
   VIZ D · four-factory supply graph. Data: D.factories, D.flows (04 card), lineage layer 推理服务
   ===================================================================== */
function initFlow() {
  var host = $('#flow-stage'), det = $('#flow-detail'); if (!host) return;
  var narrow = host.clientWidth < 560, NW = narrow ? 230 : 214, NH = narrow ? 92 : 112;
  var L = narrow
    ? { W: 360, H: 640, pos: { ai: [40, 14], token: [40, 186], data: [40, 358], agent: [40, 530] } }
    : { W: 700, H: 470, pos: { ai: [4, 176], token: [243, 18], data: [243, 336], agent: [482, 176] } };
  var svg = sv('svg', { viewBox: '0 0 ' + L.W + ' ' + L.H, role: 'group', 'aria-label': '四类工厂之间的供给关系' });
  var gE = sv('g'), gN = sv('g'); svg.appendChild(gE); svg.appendChild(gN);
  var P = function (k) { var p = L.pos[k]; return { x: p[0], y: p[1], cx: p[0] + NW / 2, cy: p[1] + NH / 2, r: p[0] + NW, b: p[1] + NH }; };
  function edgePath(f) {
    var a = P(f.from), b = P(f.to);
    if (narrow) {
      if (f.from === 'token' && f.to === 'agent') return { d: 'M' + a.r + ' ' + a.cy + ' C' + (a.r + 58) + ' ' + a.cy + ' ' + (b.r + 58) + ' ' + b.cy + ' ' + b.r + ' ' + b.cy, lx: a.r + 44, ly: (a.cy + b.cy) / 2 };
      return { d: 'M' + a.cx + ' ' + a.b + ' L' + b.cx + ' ' + b.y, lx: a.cx, ly: (a.b + b.y) / 2 };
    }
    if (f.from === 'ai') return { d: 'M' + a.cx + ' ' + a.y + ' C' + a.cx + ' ' + (b.cy) + ' ' + (b.x - 40) + ' ' + b.cy + ' ' + b.x + ' ' + b.cy, lx: a.cx + 30, ly: b.cy + 14 };
    if (f.from === 'token' && f.to === 'data') return { d: 'M' + a.cx + ' ' + a.b + ' L' + b.cx + ' ' + b.y, lx: a.cx, ly: (a.b + b.y) / 2 };
    if (f.from === 'data') return { d: 'M' + a.r + ' ' + a.cy + ' C' + (b.cx) + ' ' + a.cy + ' ' + b.cx + ' ' + (b.b + 30) + ' ' + b.cx + ' ' + b.b, lx: b.cx - 30, ly: a.cy + 4 };
    return { d: 'M' + a.r + ' ' + a.cy + ' C' + b.cx + ' ' + a.cy + ' ' + b.cx + ' ' + (b.y - 30) + ' ' + b.cx + ' ' + b.y, lx: b.cx - 30, ly: a.cy - 4 };
  }
  var edges = D.flows.map(function (f, i) {
    var g = sv('g', { 'class': 'edge', 'data-i': i }), ep = edgePath(f);
    g.appendChild(sv('path', { 'class': 'l', d: ep.d, 'marker-end': 'url(#fah)' }));
    g.appendChild(sv('path', { 'class': 'dash', d: ep.d }));
    g.appendChild(sv('path', { 'class': 'hit', d: ep.d }));
    var w = textW(f.label, 10.5) + 16, lb = sv('g', { 'class': 'lb', tabindex: '0', role: 'button', 'aria-label': f.label + '：' + f.t });
    lb.appendChild(sv('rect', { x: ep.lx - w / 2, y: ep.ly - 11, width: w, height: 22, rx: 11 }));
    lb.appendChild(sv('text', { x: ep.lx, y: ep.ly + 4, 'text-anchor': 'middle' }, f.label));
    g.appendChild(lb); gE.appendChild(g); return { f: f, g: g };
  });
  var defs = sv('defs'), mk = sv('marker', { id: 'fah', viewBox: '0 0 10 10', refX: '9', refY: '5', markerWidth: '6', markerHeight: '6', orient: 'auto-start-reverse' });
  mk.appendChild(sv('path', { d: 'M1 1L9 5L1 9', fill: 'none', stroke: 'var(--ink-3)', 'stroke-width': '1.6', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }));
  defs.appendChild(mk); svg.insertBefore(defs, gE);
  /* lens: the inference-serving overlap shared by AI and Token factories (05 lineage layer) */
  var inf = LIN.filter(function (l) { return l.kind === 'inference'; })[0];
  var a = P('ai'), t = P('token'), lx = narrow ? a.r + 54 : a.cx + 60, ly = narrow ? (a.b + t.y) / 2 : t.cy + 84;
  if (!narrow) { lx = a.cx + 92; ly = t.cy + 74; }
  var lens = sv('g', { tabindex: '0', role: 'button', 'aria-label': inf.layer });
  lens.appendChild(sv('path', { 'class': 'lens', d: 'M' + (lx - 38) + ' ' + ly + ' A50 50 0 0 1 ' + (lx + 38) + ' ' + ly + ' A50 50 0 0 1 ' + (lx - 38) + ' ' + ly + 'Z' }));
  lens.appendChild(sv('text', { 'class': 'lens-t', x: lx, y: ly + 4, 'text-anchor': 'middle' }, '推理服务'));
  /* first sight: each supply line draws itself from source to target, in order, then its label settles */
  if (!RM && 'IntersectionObserver' in window) {
    svg.classList.add('is-pre');
    new IntersectionObserver(function (es) { svg.classList.toggle('is-live', es[0].isIntersecting); }).observe(svg);
    var fio = new IntersectionObserver(function (es) { if (es[0].isIntersecting) { fio.disconnect(); svg.classList.remove('is-pre'); svg.classList.add('is-draw'); setTimeout(function () { svg.classList.remove('is-draw'); }, 2400); } }, { threshold: 0.35 });
    fio.observe(host);
  }
  edges.forEach(function (e, i) { var l = e.g.querySelector('path.l'); l.setAttribute('pathLength', '1'); e.g.style.setProperty('--d', (i * 140) + 'ms'); });
  var nodes = {};
  FAC.forEach(function (f) {
    var p = P(f.key), g = sv('g', { 'class': 'fnode ' + f.key, tabindex: '0', role: 'button', 'aria-pressed': 'false', 'data-k': f.key, 'aria-label': f.n + ' ' + f.name + ' · ' + f.cn });
    var lift = sv('g', { 'class': 'lift' });
    lift.appendChild(sv('rect', { 'class': 'b', x: p.x, y: p.y, width: NW, height: NH, rx: 12 }));
    lift.appendChild(sv('path', { 'class': 'hd', d: 'M' + p.x + ' ' + (p.y + 12) + 'a12 12 0 0 1 12 -12h' + (NW - 24) + 'a12 12 0 0 1 12 12v22h-' + NW + 'z' }));
    lift.appendChild(sv('text', { 'class': 'n', x: p.x + 12, y: p.y + 22 }, f.n));
    lift.appendChild(sv('text', { 'class': 't', x: p.x + 36, y: p.y + 23 }, f.name));
    lift.appendChild(sv('text', { 'class': 's', x: p.x + 12, y: p.y + 56 }, f.cn));
    lift.appendChild(sv('text', { 'class': 'k', x: p.x + 12, y: p.y + 76 }, '供给：' + f.supply));
    if (!narrow) lift.appendChild(sv('text', { 'class': 'k', x: p.x + 12, y: p.y + 96 }, D.flows.filter(function (x) { return x.from === f.key; }).length + ' 出 · ' + D.flows.filter(function (x) { return x.to === f.key; }).length + ' 入'));
    g.appendChild(lift); g.style.setProperty('--fc', 'var(--c-' + f.key + ')');
    gN.appendChild(g); nodes[f.key] = g;
  });
  gN.appendChild(lens);
  svg.appendChild(sv('text', { 'class': 'note', x: narrow ? 12 : L.W / 2, y: L.H - 4, 'text-anchor': narrow ? 'start' : 'middle' }, narrow ? '' : D.flowNote));
  host.appendChild(svg);

  function hotEdges(pred) { edges.forEach(function (e) { var on = pred && pred(e.f); e.g.classList.toggle('is-on', !!on); e.g.classList.toggle('is-dim', !!pred && !on); }); }
  var selK = null;
  function swap(html, fc) { det.style.setProperty('--fc', fc || 'var(--ink)'); det.innerHTML = '<div class="swap">' + html + '</div>'; }
  function selectFactory(k) {
    selK = k; var f = facBy[k];
    Object.keys(nodes).forEach(function (x) { nodes[x].classList.toggle('is-sel', x === k); nodes[x].setAttribute('aria-pressed', x === k ? 'true' : 'false'); });
    hotEdges(function (e) { return e.from === k || e.to === k; });
    var ins = D.flows.filter(function (x) { return x.to === k; }), outs = D.flows.filter(function (x) { return x.from === k; });
    swap('<p class="k">' + esc(f.n) + ' · ' + esc(f.cn) + '</p><h4>' + esc(f.name) + '</h4><p class="cn">供给：' + esc(f.supply) + '</p>' +
      '<ul>' + f.caps.map(function (c) { return '<li>' + esc(c) + '</li>'; }).join('') + '</ul>' +
      '<div class="io">' + ins.concat(outs).map(function (x) { return '<p><b>' + esc(x.label) + '</b>' + esc(x.t) + '</p>'; }).join('') + '</div>' +
      '<div class="jump"><button class="btn btn--ghost btn--sm" type="button" data-open="factory:' + k + '"><span>指标、购买者与边界</span><span aria-hidden="true">→</span></button></div>', 'var(--c-' + k + ')');
    $$('.fcard').forEach(function (c) { c.classList.toggle('is-sel', c.dataset.fac === k); });
  }
  function showEdge(e) {
    hotEdges(function (x) { return x === e.f; });
    swap('<p class="k">04 协作架构 · 四厂之间的供给关系</p><h4>' + esc(e.f.label) + '</h4><p class="cn">' + esc(facBy[e.f.from].name) + ' → ' + esc(facBy[e.f.to].name) + '</p><ul><li>' + esc(e.f.t) + '</li></ul><div class="io"><p>' + esc(D.flowNote) + '</p></div>');
  }
  function showLens() {
    hotEdges(function (x) { return x.from === 'ai' && x.to === 'token'; });
    Object.keys(nodes).forEach(function (x) { nodes[x].classList.toggle('is-sel', x === 'ai' || x === 'token'); });
    swap('<p class="k">05 术语谱系</p><h4>推理服务</h4><p class="cn">' + esc(inf.layer) + ' · ' + esc(inf.note) + '</p>' +
      '<div class="io">' + inf.rows.map(function (r) { return '<p><b>' + esc(r.term) + '</b>' + esc(r.sub) + ' · ' + esc(r.origin) + '</p>'; }).join('') + '</div>' +
      '<div class="jump">' + inf.rows.map(function (r) { return '<button class="btn btn--ghost btn--sm" type="button" data-open="lin:' + r.key + '"><span>' + esc(r.term) + '</span><span aria-hidden="true">→</span></button> '; }).join('') + '</div>', 'var(--c-token)');
  }
  svg.addEventListener('click', function (e) {
    var n = e.target.closest('.fnode'); if (n) { selectFactory(n.dataset.k); return; }
    var ed = e.target.closest('.edge'); if (ed) { showEdge(edges[+ed.dataset.i]); return; }
    if (e.target.closest('[aria-label="' + inf.layer + '"]')) showLens();
  });
  svg.addEventListener('keydown', function (e) { if ((e.key === 'Enter' || e.key === ' ') && e.target.getAttribute('role') === 'button') { e.preventDefault(); e.target.dispatchEvent(new MouseEvent('click', { bubbles: true })); } });
  svg.addEventListener('pointerover', function (e) {
    var ed = e.target.closest('.edge'); if (ed) { hotEdges(function (x) { return x === edges[+ed.dataset.i].f; }); return; }
    var n = e.target.closest('.fnode'); if (n) { var k = n.dataset.k; hotEdges(function (x) { return x.from === k || x.to === k; }); }
  });
  svg.addEventListener('pointermove', function (e) { var ed = e.target.closest('.edge'); if (ed && FINE) { var f = edges[+ed.dataset.i].f; tip.avoid = $$('.fnode rect.b', svg).map(function (r) { return r.getBoundingClientRect(); }); tip('<b>' + esc(f.label) + '</b>' + esc(f.t), e.clientX, e.clientY, ed.querySelector('.lb rect').getBoundingClientRect()); tip.avoid = null; } else tip(null); });
  svg.addEventListener('pointerleave', function () { tip(null); if (selK) hotEdges(function (x) { return x.from === selK || x.to === selK; }); else hotEdges(null); });
  selectFactory('ai');
}

/* ---------- 05 lineage, time view ---------- */
function initLineageTime() {
  var host = $('#lineage-time');
  window.__drawLTime = function () {
    var q = lineageState.q, layer = lineageState.layer;
    var W = Math.max(920, Math.round(host.clientWidth - 40) || 1100), PX0 = 8, PX1 = 150, MX0 = 180, MX1 = W - 170, NX = W - 130, ROW = 28;
    var y0 = 2023, y1 = 2027;
    function xOf(d) {
      if (d === '—') return null;
      var p = d.split('-'), yr = +p[0], mo = p[1] ? +p[1] - 1 : 0;
      if (yr < 2023) return { pre: true, yr: yr };
      return MX0 + ((yr - y0) * 12 + mo) / ((y1 - y0) * 12) * (MX1 - MX0);
    }
    var lanes = []; LIN.forEach(function (L, i) {
      if (layer !== '' && layer !== String(i)) return;
      var rows = L.rows.filter(function (r) { return lineageMatch(r, q); }); if (rows.length) lanes.push({ L: L, rows: rows });
    });
    var svg = sv('svg', { viewBox: '0 0 ' + W + ' 100', role: 'group', 'aria-label': '术语谱系时间轴' }), y = 34;
    for (var yr = y0; yr <= y1; yr++) { var gx = MX0 + (yr - y0) * 12 / ((y1 - y0) * 12) * (MX1 - MX0); svg.appendChild(sv('text', { 'class': 'yr', x: gx + 4, y: 16 }, yr < y1 ? String(yr) : '')); svg.appendChild(sv('line', { 'class': 'grid-l', x1: gx, x2: gx, y1: 22, y2: 9999 })); }
    svg.appendChild(sv('text', { 'class': 'pre', x: PX0, y: 16 }, '2023 年以前'));
    svg.appendChild(sv('text', { 'class': 'pre', x: NX, y: 16 }, '日期 —'));
    lanes.forEach(function (ln) {
      svg.appendChild(sv('text', { 'class': 'lay', x: PX0, y: y + 12 }, ln.L.layer));
      svg.appendChild(sv('line', { 'class': 'lay-r', x1: PX0, x2: W - 4, y1: y + 20, y2: y + 20 }));
      y += 30;
      var packs = { pre: [], main: [], nd: [] }, preX = PX0, ndY = 0, rowsUsed = 1;
      var placed = ln.rows.map(function (r) {
        var xx = xOf(r.date), w = textW(r.term, 11.5) + textW(r.date, 10) + 30, px, kind;
        if (xx === null) { kind = 'nd'; px = NX; } else if (xx.pre) { kind = 'pre'; px = PX0; } else { kind = 'main'; px = xx; }
        return { r: r, x: px, w: w, kind: kind };
      });
      var lanesRows = [];
      placed.sort(function (a, b) { return a.x - b.x; }).forEach(function (p) {
        var k = 0; while (lanesRows[k] && lanesRows[k][p.kind] != null && lanesRows[k][p.kind] > p.x) k++;
        if (p.kind !== 'main') { k = 0; while (lanesRows[k] && lanesRows[k][p.kind] != null) k++; }
        lanesRows[k] = lanesRows[k] || {}; lanesRows[k][p.kind] = p.x + p.w + 8; p.row = k;
      });
      rowsUsed = Math.max(1, lanesRows.length);
      placed.forEach(function (p) {
        var g = sv('g', { 'class': 'lt', tabindex: '0', role: 'button', 'data-open': 'lin:' + p.r.key, 'aria-label': p.r.term + ' ' + p.r.date });
        var yy = y + p.row * ROW;
        g.appendChild(sv('rect', { x: p.x, y: yy, width: p.w, height: 20, rx: 10 }));
        g.appendChild(sv('text', { x: p.x + 10, y: yy + 14 }, p.r.term));
        g.appendChild(sv('text', { 'class': 'd', x: p.x + p.w - 10, y: yy + 14, 'text-anchor': 'end' }, p.r.date));
        svg.appendChild(g);
      });
      y += rowsUsed * ROW + 14;
    });
    if (!lanes.length) { svg.appendChild(sv('text', { 'class': 'pre', x: W / 2, y: 52, 'text-anchor': 'middle' }, '这个筛选下没有谱系条目')); svg.appendChild(sv('text', { 'class': 'pre pre--h', x: W / 2, y: 74, 'text-anchor': 'middle' }, '清除上方的关键词或层级筛选即可恢复')); }
    svg.setAttribute('viewBox', '0 0 ' + W + ' ' + Math.max(90, y)); svg.style.width = W + 'px';
    host.innerHTML = ''; host.appendChild(svg);
  };
  host.addEventListener('keydown', function (e) { var g = e.target.closest('.lt'); if (g && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); ov.opener = g; openItem(g.getAttribute('data-open')); } });
}

/* =====================================================================
   Boot
   ===================================================================== */
function initControls() {
  /* 05 lineage */
  var sel = $('#lineage-layer');
  LIN.forEach(function (l, i) { var o = doc.createElement('option'); o.value = String(i); o.textContent = l.layer; sel.appendChild(o); });
  var lq = $('#lineage-q'), t1;
  lq.addEventListener('input', function () { clearTimeout(t1); t1 = setTimeout(function () { lineageState.q = lq.value.trim().toLowerCase(); renderLineage(); }, 80); });
  sel.addEventListener('change', function () { lineageState.layer = sel.value; renderLineage(); });
  tabs($('#lineage .seg'), function (b) {
    lineageState.view = b.dataset.lview;
    var time = lineageState.view === 'time';
    $('#lineage-tablewrap').hidden = time; $('#lineage-time').hidden = !time;
    if (time) window.__drawLTime();
  });
  /* 09 glossary */
  var gs = $('#gloss-group');
  groups.forEach(function (g) { var o = doc.createElement('option'); o.value = g; o.textContent = g; gs.appendChild(o); });
  var gq = $('#gloss-q'), t2;
  gq.addEventListener('input', function () { clearTimeout(t2); t2 = setTimeout(function () { glossState.q = gq.value.trim().toLowerCase(); renderGlossary(); }, 90); });
  gs.addEventListener('change', function () { glossState.group = gs.value; renderGlossary(); });
  /* 10 sources */
  var sq = $('#src-q'), t3;
  sq.addEventListener('input', function () { clearTimeout(t3); t3 = setTimeout(function () { renderSources(sq.value.trim().toLowerCase()); }, 80); });
  /* source chips anywhere: plain click jumps to the list; the list item flashes */
}
function ready() {
  if (root.classList.contains('is-ready')) return;
  root.classList.add('is-ready'); doc.body.classList.add('is-ready');
  root.dispatchEvent(new Event('eai:ready'));
}
function boot() {
  renderDomains(); renderFactories(); renderVendors(); renderLadder(); renderLineage(); renderGlossary(); renderSources('');
  initChrome(); initTheme(); initSound(); initLamp(); initReveals(); initDecision(); initButtons();
  initDrawer(); initPalette(); initToc(); initLightbox(); initControls(); initShotTilt();
  buildItems(); initIndex(); initLineageTime();
  initHeroStack();
  whenNear($('#viz-stack'), initFullStack, '400px 0px');
  whenNear($('#viz-timeline'), initTimeline, '400px 0px');
  whenNear($('#viz-map'), function () { if (!mapApi) initMap(); }, '400px 0px');
  whenNear($('#viz-flow'), initFlow, '400px 0px');
  /* desktop opens the 3D machine by default: build it ahead, in idle time, so the first scroll into the map chapter does not
     stall. Not during the opening (it would compete with the hero for the GPU): only once the reader has scrolled and at
     least 3 s have passed since load, whichever is later; the machine then links its shaders in idle slices */
  if (FINE && innerWidth >= 900 && 'requestIdleCallback' in window) {
    var preT = 0, preS = false, preGo = function () { if (preT !== 1 || !preS) return; preT = 2; requestIdleCallback(function idleMount() { if (mapApi) return; if (performance.now() - preLast < 600) { requestIdleCallback(idleMount, { timeout: 4000 }); return; } initMap(); }, { timeout: 4000 }); };
    var preLoad = function () { setTimeout(function () { preT = 1; preGo(); }, 3000); };
    /* wait for the scroll to settle (600 ms quiet) so the mount and shadow pre-pass never land inside a scroll */
    /* never while the pinned hero is on screen: a pause between two of its scroll steps is not a settled scroll, and the
       mount (shader link, shadow pre-pass) would land in the middle of the choreography */
    var heroIn = false, heroEl = $('.hero.cine');
    if (heroEl && 'IntersectionObserver' in window) new IntersectionObserver(function (es) { heroIn = es[0].isIntersecting; }).observe(heroEl);
    var preQ = 0, preLast = 0, preOn = function () {
      preLast = performance.now(); if (preT === 2) { removeEventListener('scroll', preOn); return; }
      clearTimeout(preQ); preQ = setTimeout(function () { if (heroIn) return; preS = true; preGo(); }, 600);
    };
    addEventListener('scroll', preOn, { passive: true });
    if (doc.readyState === 'complete') preLoad(); else addEventListener('load', preLoad, { once: true });
    /* no scroll at all: after 7 s with no input, or the moment the reader aims at a link into the map, build ahead anyway */
    var preIn = 0, preArm = function () { clearTimeout(preIn); preIn = setTimeout(function () { if (preT === 1) { preS = true; preGo(); } }, 7000); };
    /* pointermove re-arms too (throttled to once per 200 ms), so a reader moving the mouse never gets the mount mid-gesture */
    var preArmT = 0, preArmMove = function () { var t = performance.now(); if (t - preArmT < 200) return; preArmT = t; preArm(); };
    ['pointerdown', 'pointermove', 'keydown', 'wheel', 'touchstart'].forEach(function (t) { addEventListener(t, t === 'pointermove' ? preArmMove : preArm, { passive: true }); });
    addEventListener('load', preArm, { once: true }); if (doc.readyState === 'complete') preArm();
    var preAim = function (e) {
      var a = e.target && e.target.closest && e.target.closest('a[href^="#"]'); if (!a) return;
      var h = a.getAttribute('href'); if (h === '#viz-map' || h === '#domains' || /^#domain-/.test(h)) { if (preT === 0) preT = 1; preS = true; preGo(); }
    };
    addEventListener('pointerover', preAim, { passive: true }); addEventListener('focusin', preAim);
  }
  /* entrance once fonts are in (never wait more than 700 ms) */
  var done = false, go = function () { if (done) return; done = true; requestAnimationFrame(function () { requestAnimationFrame(ready); }); };
  if (doc.fonts && doc.fonts.ready) doc.fonts.ready.then(go); setTimeout(go, 700);
  /* far chapters skip style, layout and paint until they near the viewport (content-visibility). Each one first
     records its real height as the placeholder size, so scroll length and anchors stay exact */
  var cvGo = function () {
    if (!('contentVisibility' in doc.documentElement.style)) return;
    $$('#main > .sec').forEach(function (s) {
      if (s.id === 'domains') return; /* the machine measures its own stage */
      var h = s.offsetHeight; if (!h) return;
      s.style.containIntrinsicSize = 'auto ' + h + 'px'; s.classList.add('cv-far');
    });
  };
  root.addEventListener('eai:ready', function () { setTimeout(function () { (window.requestIdleCallback || setTimeout)(cvGo, { timeout: 1500 }); }, 400); });
  /* warm the machine's code in idle time so building it later is the only cost left on the scroll path */
  addEventListener('load', function () {
    (window.requestIdleCallback || setTimeout)(function () {
      if (innerWidth < 900) return;
      ['machine-assets.js', 'map3d.js'].forEach(function (f) { var l = doc.createElement('link'); l.rel = 'prefetch'; l.as = 'script'; l.href = 'assets/js/' + f; doc.head.appendChild(l); });
    }, { timeout: 3000 });
  });
  if (location.hash && location.hash.length > 1) setTimeout(function () { goHash(location.hash, false); }, 60);
  measure();
}
if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', boot); else boot();
})();
