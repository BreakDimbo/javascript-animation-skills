/* 10 Sources — bibliography ledger + date ribbon + publisher facets.
   app.js renderSources() delegates here (window.EAI_SRC_RENDER); ids #src-Sxx, #src-q, #src-count are kept. */
(function () {
  'use strict';
  var D = window.EA_DATA; if (!D) return;
  var doc = document;
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var RM = matchMedia('(prefers-reduced-motion: reduce)');
  var SRC = D.sources;
  var ids = function (s) { return String(s || '').match(/S\d{2}/g) || []; };
  /* computed: how many items on this page cite each source (glossary evidence + vendor tags, as the drawer lists) */
  var cites = {};
  SRC.forEach(function (s) { cites[s.id] = 0; });
  D.glossary.forEach(function (g) { ids(g.evidence).filter(function (x, i, a) { return a.indexOf(x) === i; }).forEach(function (id) { if (id in cites) cites[id]++; }); });
  D.vendors.forEach(function (v) { ids(v.tag).filter(function (x, i, a) { return a.indexOf(x) === i; }).forEach(function (id) { if (id in cites) cites[id]++; }); });
  /* months (computed from dates) */
  var mon = function (d) { return String(d).slice(0, 7); };
  var ms = SRC.map(function (s) { return mon(s.date); }).sort();
  var m0 = ms[0], m1 = ms[ms.length - 1], months = [];
  (function () { var y = +m0.slice(0, 4), m = +m0.slice(5, 7); while (true) { var k = y + '-' + (m < 10 ? '0' : '') + m; months.push(k); if (k === m1) break; m++; if (m > 12) { m = 1; y++; } } })();
  var mc = {}; months.forEach(function (k) { mc[k] = 0; }); ms.forEach(function (k) { mc[k]++; });
  var mmax = Math.max.apply(null, months.map(function (k) { return mc[k]; }));
  var pubs = [], pc = {};
  SRC.forEach(function (s) { if (!(s.publisher in pc)) { pc[s.publisher] = 0; pubs.push(s.publisher); } pc[s.publisher]++; });
  pubs.sort(function (a, b) { return pc[b] - pc[a] || pubs.indexOf(a) - pubs.indexOf(b); });
  var pmax = pc[pubs[0]];

  var st = { q: '', pub: null, mon: null }, list, side, cap;
  function hl(t, q) {
    t = String(t); if (!q) return esc(t);
    var i = t.toLowerCase().indexOf(q); if (i < 0) return esc(t);
    return esc(t.slice(0, i)) + '<mark>' + esc(t.slice(i, i + q.length)) + '</mark>' + esc(t.slice(i + q.length));
  }
  function render(q) {
    if (q != null) st.q = q;
    if (!list) return;
    var shown = SRC.filter(function (s) {
      return (!st.q || [s.id, s.title, s.publisher, s.date].join(' ').toLowerCase().indexOf(st.q) !== -1) &&
        (!st.pub || s.publisher === st.pub) && (!st.mon || mon(s.date) === st.mon);
    });
    var prev = null;
    list.innerHTML = shown.map(function (s) {
      var n = +s.id.slice(1), brk = prev != null && prev <= 28 && n >= 29; prev = n;
      var c = cites[s.id];
      return '<li class="bib-r' + (brk ? ' bib-r--brk' : '') + '" id="src-' + s.id + '">' +
        '<span class="id">' + esc(s.id) + '</span>' +
        '<a class="t" href="' + esc(s.url) + '" target="_blank" rel="noopener"><span>' + hl(s.title, st.q) + '</span><i aria-hidden="true">↗</i></a>' +
        '<span class="m"><span class="p">' + hl(s.publisher, st.q) + '</span><span class="sep"> · </span><time class="d">' + esc(s.date) + '</time></span>' +
        (c ? '<button class="bib-c" type="button" data-open="src:' + s.id + '" aria-label="' + esc(s.id) + ' 被引用 ' + c + ' 处，查看引用条目"><span>被引用 ' + c + ' 处</span></button>' : '<span class="bib-c bib-c--0" aria-hidden="true">—</span>') +
        '</li>';
    }).join('') || '<li class="empty bib-empty" role="status"><b class="empty__t">' + (st.q ? '没有匹配「' + esc(st.q) + '」的来源' : '这个筛选下没有来源') + '</b><button type="button" class="btn btn--ghost btn--sm empty__btn" data-bib-reset>清除筛选</button></li>';
    var cnt = doc.getElementById('src-count');
    if (cnt) cnt.innerHTML = '<b>' + shown.length + '</b><span> / ' + SRC.length + ' 条</span>';
    /* facet + ribbon state */
    Array.prototype.forEach.call(side.querySelectorAll('[data-pub]'), function (b) { var on = b.getAttribute('data-pub') === st.pub; b.setAttribute('aria-pressed', on); });
    Array.prototype.forEach.call(side.querySelectorAll('[data-mon]'), function (b) { var on = b.getAttribute('data-mon') === st.mon; b.setAttribute('aria-pressed', on); });
    side.classList.toggle('has-pub', !!st.pub); side.classList.toggle('has-mon', !!st.mon);
    capText();
  }
  function capText(k) {
    if (!cap) return;
    var m = k || st.mon;
    cap.innerHTML = m ? '<b>' + esc(m) + '</b> · ' + mc[m] + ' 条' : '<span>' + esc(m0) + '</span><span>' + esc(m1) + '</span>';
    cap.classList.toggle('is-one', !!m);
  }
  window.EAI_SRC_RENDER = render;

  function init() {
    list = doc.getElementById('src-list'); side = doc.querySelector('#sources .bib__side');
    if (!list || !side) return;
    var rib = side.querySelector('.bib__rib-bars'), pl = side.querySelector('.bib__pubs-list');
    cap = side.querySelector('.bib__rib-cap');
    rib.style.setProperty('--n', months.length);
    rib.innerHTML = months.map(function (k, i) {
      var c = mc[k], h = c ? Math.max(8, Math.round(c / mmax * 100)) : 0;
      return c ? '<button type="button" class="bib__bar" data-mon="' + k + '" aria-pressed="false" aria-label="' + k + ' · ' + c + ' 条" style="--h:' + (h / 100) + ';--i:' + i + '"><i></i></button>'
               : '<span class="bib__bar bib__bar--0" aria-hidden="true"><i></i></span>';
    }).join('');
    pl.innerHTML = pubs.map(function (p) {
      return '<li><button type="button" data-pub="' + esc(p) + '" aria-pressed="false" style="--w:' + (pc[p] / pmax).toFixed(3) + '"><span class="n">' + esc(p) + '</span><span class="c">' + pc[p] + '</span><i aria-hidden="true"></i></button></li>';
    }).join('');
    side.querySelector('.bib__pubs-k').textContent = '发布方 · ' + pubs.length;
    side.classList.add('is-js');
    capText();
    side.addEventListener('click', function (e) {
      var b = e.target.closest('[data-pub]'); if (b) { var p = b.getAttribute('data-pub'); st.pub = st.pub === p ? null : p; render(); return; }
      var m = e.target.closest('[data-mon]'); if (m) { var k = m.getAttribute('data-mon'); st.mon = st.mon === k ? null : k; render(); }
    });
    rib.addEventListener('pointerover', function (e) { var m = e.target.closest('[data-mon]'); if (m) capText(m.getAttribute('data-mon')); });
    rib.addEventListener('pointerleave', function () { capText(); });
    rib.addEventListener('focusin', function (e) { var m = e.target.closest('[data-mon]'); if (m) capText(m.getAttribute('data-mon')); });
    rib.addEventListener('focusout', function () { capText(); });
    doc.addEventListener('click', function (e) {
      if (e.target.closest('[data-bib-reset]')) { st.pub = null; st.mon = null; var q = doc.getElementById('src-q'); q.value = ''; render(''); q.focus({ preventScroll: true }); return; }
      /* a jump to a source that the facets hide: clear the facets first (app.js clears the search) */
      var a = e.target.closest('a[href^="#src-"]');
      if (a && (st.pub || st.mon) && !doc.getElementById(a.getAttribute('href').slice(1))) { st.pub = null; st.mon = null; render(); }
    }, true);
    render(st.q);
    if (!RM.matches && 'IntersectionObserver' in window) {
      side.classList.add('is-pre');
      var io = new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting) { io.disconnect(); requestAnimationFrame(function () { side.classList.remove('is-pre'); }); } }); }, { rootMargin: '0px 0px -15% 0px' });
      io.observe(rib);
    }
  }
  window.EAI_SRC_RENDER && (window.EAI_SRC_RENDER.reveal = function () { st.pub = null; st.mon = null; var q = doc.getElementById('src-q'); if (q) q.value = ''; render(''); });
  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', init); else init();
})();
