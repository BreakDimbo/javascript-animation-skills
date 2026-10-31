/* 07 Vendors — index + reader (SECTIONS_SPEC §07). Owns #vx. Runs after app.js boot.
   Contracts kept: each vendor block has id = vendorId(name) (drawer "在厂商架构中查看" links),
   "来源与相关术语" still opens the drawer via data-open. */
(function () {
'use strict';
var D = window.EA_DATA; if (!D) return;
var doc = document, RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
var srcIds = {}; (D.sources || []).forEach(function (s) { srcIds[s.id] = 1; });
var sref = function (s) { return esc(s).replace(/S\d{2}/g, function (id) { return srcIds[id] ? '<a class="sref" href="#src-' + id + '" data-src="' + id + '">' + id + '</a>' : id; }); };
var vid = function (n) { return 'vendor-' + n.toLowerCase().replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '-'); };
var pad = function (i) { return (i < 9 ? '0' : '') + (i + 1); };

function init() {
  var root = doc.getElementById('vx'); if (!root) return;
  var V = D.vendors, N = V.length;
  var ix = doc.getElementById('vx-ix'), rd = doc.getElementById('vx-rd'), jl = doc.getElementById('vx-judges');
  ix.innerHTML = V.map(function (v, i) {
    return '<li><button type="button" class="vx-i" data-i="' + i + '" aria-controls="' + vid(v.n) + '"><span class="vx-i__n">' + pad(i) + '</span><span class="vx-i__t">' + esc(v.n) + '</span><span class="vx-i__s">' + esc(v.tag) + '</span><span class="vx-i__ab" aria-hidden="true"></span></button></li>';
  }).join('');
  rd.innerHTML = V.map(function (v, i) {
    return '<article class="vx-a" id="' + vid(v.n) + '" data-i="' + i + '" aria-labelledby="vx-n-' + i + '"' + (i ? ' hidden' : '') + '>' +
      '<p class="vx-a__k"><span>07.' + pad(i) + '</span><span class="vx-a__s">' + sref(v.tag) + '</span></p>' +
      '<h3 class="vx-a__n" id="vx-n-' + i + '">' + esc(v.n) + '</h3>' +
      '<p class="vx-a__t">' + esc(v.title) + '</p>' +
      '<div class="vx-a__cols"><div class="vx-a__body"><p class="vx-lab">公开架构</p><p>' + esc(v.body) + '</p></div>' +
      '<aside class="vx-a__judge"><p class="vx-lab vx-lab--o">判断：</p><p>' + esc(v.judge) + '</p></aside></div>' +
      '<div class="vx-a__foot"><button class="btn btn--quiet btn--sm" type="button" data-open="vendor:' + esc(v.n) + '"><span>来源与相关术语</span><span aria-hidden="true">→</span></button>' +
      '<button type="button" class="vx-next" data-go="' + ((i + 1) % N) + '"><span class="vx-lab">下一家</span><span class="vx-next__n">' + pad((i + 1) % N) + '</span><b>' + esc(V[(i + 1) % N].n) + '</b><span aria-hidden="true">→</span></button></div>' +
      '</article>';
  }).join('');
  jl.innerHTML = V.map(function (v, i) {
    return '<li><button type="button" class="vx-j__n" data-go="' + i + '"><span>' + pad(i) + '</span>' + esc(v.n) + '</button><p>' + esc(v.judge) + '</p></li>';
  }).join('');

  var btns = [].slice.call(ix.querySelectorAll('.vx-i')), arts = [].slice.call(rd.querySelectorAll('.vx-a'));
  var modes = [].slice.call(root.querySelectorAll('.vx-lens button')), pos = doc.getElementById('vx-pos');
  var cur = 0, b2 = 1, mode = 'one';

  function paint(anim) {
    var show = mode === 'two' ? [cur, b2] : mode === 'one' ? [cur] : [];
    arts.forEach(function (a, i) {
      var on = show.indexOf(i) >= 0; a.hidden = !on;
      a.classList.toggle('is-b', mode === 'two' && i === b2);
      a.style.order = mode === 'two' && i === b2 ? 2 : 1;
      if (on && anim && !RM) { a.classList.remove('is-in'); void a.offsetWidth; a.classList.add('is-in'); }
    });
    rd.hidden = mode === 'judge'; jl.hidden = mode !== 'judge';
    root.classList.toggle('is-two', mode === 'two');
    btns.forEach(function (b, i) {
      var on = i === cur || (mode === 'two' && i === b2);
      b.setAttribute('aria-current', on ? 'true' : 'false'); b.tabIndex = i === cur ? 0 : -1;
      b.querySelector('.vx-i__ab').textContent = mode === 'two' ? (i === cur ? 'A' : i === b2 ? 'B' : '') : '';
    });
    modes.forEach(function (m) { m.setAttribute('aria-pressed', m.dataset.m === mode ? 'true' : 'false'); });
    if (pos) pos.textContent = pad(cur) + ' / ' + pad(N - 1);
  }
  function go(i, focus) {
    i = (i + N) % N;
    if (mode === 'two') { if (i === cur) return; b2 = i; }
    else { if (mode === 'judge') mode = 'one'; cur = i; if (b2 === cur) b2 = (cur + 1) % N; }
    paint(true);
    if (focus) btns[i].focus();
  }
  ix.addEventListener('click', function (e) { var b = e.target.closest('.vx-i'); if (b) go(+b.dataset.i); });
  ix.addEventListener('keydown', function (e) {
    var b = e.target.closest('.vx-i'); if (!b) return; var i = +b.dataset.i, n = null;
    if (e.key === 'ArrowDown' || e.key === 'j') n = i + 1; if (e.key === 'ArrowUp' || e.key === 'k') n = i - 1;
    if (e.key === 'Home') n = 0; if (e.key === 'End') n = N - 1;
    if (n != null) { e.preventDefault(); if (mode === 'two') { btns[(n + N) % N].focus(); } else go(n, true); }
  });
  root.addEventListener('click', function (e) {
    var g = e.target.closest('[data-go]'); if (g) { mode = mode === 'judge' ? 'one' : mode; var t = +g.dataset.go; if (mode === 'two') { cur = t; if (b2 === cur) b2 = (cur + 1) % N; paint(true); } else go(t); if (g.classList.contains('vx-next') || g.classList.contains('vx-j__n')) btns[cur].focus({ preventScroll: true }); return; }
    var m = e.target.closest('.vx-lens button'); if (m) { mode = m.dataset.m; if (mode === 'two' && b2 === cur) b2 = (cur + 1) % N; paint(true); }
  });
  /* drawer / hash links to a vendor: show it before app.js measures the scroll target */
  doc.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a[href^="#vendor-"]'); if (!a) return;
    var t = doc.getElementById(a.getAttribute('href').slice(1)); if (!t || !t.classList.contains('vx-a')) return;
    mode = 'one'; cur = +t.dataset.i; if (b2 === cur) b2 = (cur + 1) % N; paint(false);
  }, true);
  if (/^#vendor-/.test(location.hash)) { var t0 = doc.getElementById(location.hash.slice(1)); if (t0 && t0.dataset.i) { cur = +t0.dataset.i; b2 = (cur + 1) % N; } }
  paint(false);
  rd.addEventListener('animationend', function (e) { e.target.classList.remove('is-in'); });
  root.classList.add('is-live');
}
if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', init); else init();
})();
