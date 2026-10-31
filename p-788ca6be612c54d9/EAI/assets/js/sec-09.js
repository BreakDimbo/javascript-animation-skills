/* 09 Glossary — indexed glossary: group rail · term index · specimen.
   Owns #gx (index.html). Runs after app.js boot (DOMContentLoaded listener registered later).
   Keeps app.js contracts: every term has an element id = slug(term) that contains .term__sum,
   #gloss-q / #gloss-group / #gloss-count stay in the DOM. */
(function () {
'use strict';
var D = window.EA_DATA; if (!D) return;
var doc = document;
var RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
var slug = function (t) { return 'term-' + t.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''); };
var srcIds = {}; (D.sources || []).forEach(function (s) { srcIds[s.id] = 1; });
var sref = function (s) { return esc(s).replace(/S\d{2}/g, function (id) { return srcIds[id] ? '<a class="sref" href="#src-' + id + '" data-src="' + id + '">' + id + '</a>' : id; }); };
var DOMS = ['C1', 'C2', 'C3', 'C4', 'C5', 'C6', 'C7', 'C8', 'G'];

function init() {
  var root = doc.getElementById('gx'); if (!root) return;
  var G = D.glossary, groups = [];
  G.forEach(function (g) { if (groups.indexOf(g.group) < 0) groups.push(g.group); });
  var order = []; groups.forEach(function (k) { G.forEach(function (g) { if (g.group === k) order.push(g); }); });
  var cnt = {}, max = 0; groups.forEach(function (k) { cnt[k] = G.filter(function (g) { return g.group === k; }).length; max = Math.max(max, cnt[k]); });

  var dist = doc.getElementById('gx-dist'), da = doc.getElementById('gx-dist-a'), db = doc.getElementById('gx-dist-b');
  if (dist) dist.innerHTML = groups.map(function (k) { return '<i data-g="' + esc(k) + '" style="flex:' + cnt[k] + '"></i>'; }).join('');
  function distOn(k) {
    if (!dist) return;
    [].forEach.call(dist.children, function (i) { i.classList.toggle('on', !!k && i.dataset.g === k); });
    if (da) da.textContent = groups.length + ' 组 · ' + G.length + ' 条';
    if (db) db.textContent = k ? k + ' ' + cnt[k] : '';
  }
  distOn('');
  /* rail */
  var rail = doc.getElementById('gx-rail');
  rail.innerHTML = '<li><button type="button" class="gx-g" data-g="" aria-pressed="true"><span>全部领域</span><b>' + G.length + '</b><i style="--w:1"></i></button></li>' +
    groups.map(function (k) { return '<li><button type="button" class="gx-g" data-g="' + esc(k) + '" aria-pressed="false"><span>' + esc(k) + '</span><b>' + cnt[k] + ' 条</b><i style="--w:' + (cnt[k] / max).toFixed(3) + '"></i></button></li>'; }).join('');

  /* index */
  var list = doc.getElementById('gx-list'), html = '', n = 0;
  groups.forEach(function (k) {
    html += '<li class="gx-h" data-g="' + esc(k) + '"><span>' + esc(k) + '</span><span class="gx-h__n">' + cnt[k] + '</span></li>';
    G.forEach(function (g) {
      if (g.group !== k) return; n++;
      g._n = n;
      html += '<li class="gx-li" id="' + slug(g.term) + '" data-g="' + esc(k) + '" data-i="' + (n - 1) + '">' +
        '<button type="button" class="gx-row term__sum" aria-expanded="false" aria-controls="gx-pane"><span class="gx-row__n">' + (n < 10 ? '0' : '') + n + '</span><span class="gx-row__t">' + esc(g.term) + '</span><span class="gx-row__y">' + esc(g.type) + '</span></button></li>';
    });
  });
  list.innerHTML = html + '<li class="gx-empty" hidden><b>没有匹配的术语</b><span>换个关键词，或试试英文术语名、厂商名、来源编号（如 S04）。</span><button type="button" class="btn btn--ghost btn--sm gx-clear">清除筛选</button></li>';

  /* specimens: every entry in the DOM (verbatim, no-JS readers, find); only the selected one is shown */
  var pane = doc.getElementById('gx-pane');
  pane.innerHTML = order.map(function (g, i) {
    var caps = String(g.caps).match(/C\d|G/g) || [];
    var strip = DOMS.map(function (d) { return '<span class="' + (caps.indexOf(d) >= 0 ? 'on' : '') + '">' + d + '</span>'; }).join('');
    return '<article class="gx-spec" data-i="' + i + '" aria-labelledby="gx-t-' + i + '"' + (i ? ' hidden' : '') + '>' +
      '<p class="gx-spec__k"><span>09.' + (g._n < 10 ? '0' : '') + g._n + ' · ' + esc(g.group) + '</span><span class="gx-spec__nav" aria-hidden="true">↑ ↓</span></p>' +
      '<h3 class="gx-spec__t" id="gx-t-' + i + '">' + esc(g.term) + '</h3>' +
      '<p class="gx-spec__plain">' + esc(g.plain) + '</p>' +
      '<dl class="gx-dl">' +
        '<dt>专业定义</dt><dd>' + esc(g.technical) + '</dd>' +
        '<dt class="gx-dl__b">边界：</dt><dd class="gx-dl__bd">' + esc(g.boundary) + '</dd>' +
        '<dt>概念类型</dt><dd>' + esc(g.type) + '</dd>' +
        '<dt>所属能力域</dt><dd class="gx-capsRow"><span class="gx-strip" aria-hidden="true">' + strip + '</span><span class="gx-caps">' + esc(g.caps) + '</span></dd>' +
        '<dt>代表实现：</dt><dd>' + esc(g.examples) + '</dd>' +
        '<dt>证据：</dt><dd class="gx-ev">' + sref(g.evidence) + '</dd>' +
      '</dl>' +
      '<div class="gx-acts"><button class="btn btn--quiet btn--sm" type="button" data-open="term:' + esc(g.term) + '"><span>关联与来源</span></button>' +
      '<button class="btn btn--quiet btn--sm" type="button" data-locate="' + esc(g.term) + '"><span>在能力域地图中定位</span></button></div>' +
      '</article>';
  }).join('');

  var lis = [].slice.call(list.querySelectorAll('.gx-li')), heads = [].slice.call(list.querySelectorAll('.gx-h'));
  var specs = [].slice.call(pane.querySelectorAll('.gx-spec'));
  pane.addEventListener('animationend', function (e) { if (e.target.classList.contains('gx-spec')) e.target.classList.remove('is-in'); });
  var gbtns = [].slice.call(rail.querySelectorAll('.gx-g'));
  var q = doc.getElementById('gloss-q'), sel = doc.getElementById('gloss-group'), count = doc.getElementById('gloss-count');
  var empty = list.querySelector('.gx-empty');
  var cur = -1, grp = '', mq = matchMedia('(max-width: 760px)');
  /* r6 · mobile: the spec opens as a bottom sheet over a short scrolling index (transform/opacity only) */
  var wrap = doc.getElementById('gx-paneWrap'), lastRow = null;
  var scrim = doc.createElement('div'); scrim.className = 'gx-scrim'; scrim.setAttribute('aria-hidden', 'true'); root.appendChild(scrim);
  var shut = doc.createElement('button'); shut.type = 'button'; shut.className = 'gx-shut'; shut.setAttribute('aria-label', '关闭'); shut.innerHTML = '<span aria-hidden="true"></span>';
  wrap.insertBefore(shut, wrap.firstChild);
  function sheet(on) {
    if (!mq.matches) on = false;
    if (on === root.classList.contains('is-sheet')) return;
    root.classList.toggle('is-sheet', on);
    if (on) { wrap.setAttribute('role', 'dialog'); wrap.setAttribute('aria-modal', 'true'); wrap.setAttribute('aria-label', '术语详情'); wrap.scrollTop = 0; shut.focus({ preventScroll: true }); }
    else { wrap.removeAttribute('role'); wrap.removeAttribute('aria-modal'); wrap.removeAttribute('aria-label'); if (lastRow && wrap.contains(doc.activeElement)) lastRow.focus({ preventScroll: true }); }
  }
  shut.addEventListener('click', function () { sheet(false); });
  scrim.addEventListener('click', function () { sheet(false); });
  doc.addEventListener('keydown', function (e) { if (e.key === 'Escape' && root.classList.contains('is-sheet')) sheet(false); });

  function setCount(k) { if (count) count.textContent = k + ' / ' + G.length + ' 条'; }
  function inView(li) { /* keep the selected row visible inside the scrolling index (one read, on demand) */
    if (!li || li.hidden || list.scrollHeight <= list.clientHeight + 1) return;
    /* r6: measure against the list itself (offsetTop can resolve to another offsetParent) and land the row fully inside, below a sticky group head */
    var lr = list.getBoundingClientRect(), r = li.getBoundingClientRect(), st = list.scrollTop, vh = list.clientHeight, pad = 48;
    var top = r.top - lr.top + st, h = r.height;
    if (top < st + pad) list.scrollTop = Math.max(0, top - pad); else if (top + h > st + vh - 24) list.scrollTop = Math.min(list.scrollHeight - vh, top + h - vh + 24);
  }
  function select(i, opt) {
    opt = opt || {};
    if (!grp) distOn(order[i].group), db && (db.textContent = order[i].group + ' ' + cnt[order[i].group]);
    if (i === cur && !opt.force) return;
    var prev = specs[cur];
    lis.forEach(function (li, j) { var b = li.firstChild, on = j === i; li.classList.toggle('is-sel', on); b.setAttribute('aria-expanded', on ? 'true' : 'false'); b.tabIndex = on ? 0 : -1; });
    if (cur < 0) lis.forEach(function (li, j) { li.firstChild.tabIndex = j === i ? 0 : -1; });
    specs.forEach(function (s, j) { s.hidden = j !== i; });
    var sp = specs[i];
    if (!RM && prev && prev !== sp) { sp.classList.remove('is-in'); void sp.offsetWidth; sp.classList.add('is-in'); }
    cur = i;
    if (pane.parentNode !== wrap) wrap.appendChild(pane);
    if (!opt.noScroll) inView(lis[i]);
    if (opt.focus) lis[i].firstChild.focus({ preventScroll: true });
  }
  function apply() {
    var s = (q.value || '').trim().toLowerCase(), k = 0, first = -1;
    lis.forEach(function (li, j) {
      var g = order[j], ok = (!grp || g.group === grp) && (!s || [g.term, g.plain, g.technical, g.boundary, g.type, g.examples, g.evidence].join(' ').toLowerCase().indexOf(s) !== -1);
      li.hidden = !ok; if (ok) { k++; if (first < 0) first = j; }
    });
    heads.forEach(function (h) { h.hidden = !lis.some(function (li) { return !li.hidden && li.dataset.g === h.dataset.g; }); });
    empty.hidden = k > 0;
    pane.parentNode && (pane.style.visibility = k ? '' : 'hidden');
    setCount(k);
    gbtns.forEach(function (b) { b.setAttribute('aria-pressed', b.dataset.g === grp ? 'true' : 'false'); });
    if (sel) sel.value = grp;
    distOn(grp);
    if (k && (cur < 0 || lis[cur].hidden)) select(first, { noScroll: false });
    if (k) list.scrollTop = 0, inView(lis[cur]);
  }
  function visibleIdx() { return lis.map(function (li, j) { return li.hidden ? -1 : j; }).filter(function (j) { return j >= 0; }); }

  rail.addEventListener('click', function (e) { var b = e.target.closest('.gx-g'); if (!b) return; grp = b.dataset.g; apply(); });
  var t; q.addEventListener('input', function () { clearTimeout(t); t = setTimeout(apply, 90); });
  q.addEventListener('keydown', function (e) { if (e.key === 'ArrowDown') { e.preventDefault(); var v = visibleIdx(); if (v.length) select(v.indexOf(cur) >= 0 ? cur : v[0], { focus: true, force: true }); } });
  if (sel) sel.addEventListener('change', function () { grp = sel.value; apply(); });
  empty.querySelector('.gx-clear').addEventListener('click', function () { q.value = ''; grp = ''; apply(); q.focus(); });
  list.addEventListener('click', function (e) { var b = e.target.closest('.gx-row'); if (!b) return; select(+b.parentNode.dataset.i, { noScroll: true, force: mq.matches }); lastRow = b; sheet(true); });
  list.addEventListener('keydown', function (e) {
    var b = e.target.closest('.gx-row'); if (!b) return;
    var v = visibleIdx(), at = v.indexOf(+b.parentNode.dataset.i), nx = null;
    if (e.key === 'ArrowDown' || e.key === 'j') nx = v[Math.min(v.length - 1, at + 1)];
    if (e.key === 'ArrowUp' || e.key === 'k') nx = v[Math.max(0, at - 1)];
    if (e.key === 'Home') nx = v[0]; if (e.key === 'End') nx = v[v.length - 1];
    if (nx != null) { e.preventDefault(); select(nx, { focus: true }); }
  });
  /* `/` focuses the search when the glossary is on screen */
  doc.addEventListener('keydown', function (e) {
    if (e.key !== '/' || e.metaKey || e.ctrlKey || /input|textarea|select/i.test((e.target.tagName || ''))) return;
    var r = root.getBoundingClientRect(); if (r.top < innerHeight * .6 && r.bottom > innerHeight * .3) { e.preventDefault(); q.focus(); }
  });
  /* app.js toggles .is-open on the element with the term id (hash links, drawer "在术语表中查看") */
  var mo = new MutationObserver(function (ms) {
    ms.forEach(function (m) { var li = m.target; if (li.classList.contains('is-open')) { li.classList.remove('is-open'); if (li.hidden) { q.value = ''; grp = ''; apply(); } select(+li.dataset.i, { force: true }); } });
  });
  lis.forEach(function (li) { mo.observe(li, { attributes: true, attributeFilter: ['class'] }); });
  /* term links: clear filters and bring the row into the index window BEFORE app.js measures where to scroll */
  doc.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a[href^="#term-"]'); if (!a) return;
    var li = doc.getElementById(decodeURIComponent(a.getAttribute('href').slice(1))); if (!li || !li.classList.contains('gx-li')) return;
    if (li.hidden) { q.value = ''; grp = ''; apply(); }
    select(+li.dataset.i);
    pin();
  }, true);
  if (/^#term-/.test(location.hash)) { var h0 = doc.getElementById(decodeURIComponent(location.hash.slice(1))); if (h0 && h0.dataset.i) select(+h0.dataset.i); }
  if (mq.addEventListener) mq.addEventListener('change', function () { sheet(false); select(cur, { force: true }); });
  /* r6: back/forward to a #term- hash — select and seat the row inside the index BEFORE app.js measures the page scroll (capture runs first at the target) */
  function fromHash() {
    if (!/^#term-/.test(location.hash)) return;
    var li0 = doc.getElementById(decodeURIComponent(location.hash.slice(1))); if (li0 && li0.classList.contains('gx-li') && +li0.dataset.i === cur && !li0.hidden) { inView(li0); return; }
    var li = doc.getElementById(decodeURIComponent(location.hash.slice(1))); if (!li || !li.classList.contains('gx-li')) return;
    if (li.hidden) { q.value = ''; grp = ''; apply(); }
    select(+li.dataset.i, { force: true });
    pin();
  }
  /* content-visibility:auto sections resize as they render during the jump, so app.js's measured target drifts;
     pin them rendered for the length of the jump so the landing is exact */
  var pinT;
  function pin() { var de = doc.documentElement; de.classList.add('gx-pin'); void de.offsetHeight; clearTimeout(pinT); pinT = setTimeout(function () { de.classList.remove('gx-pin'); }, 1700); }
  (window.EAI_PRE_HASH = window.EAI_PRE_HASH || []).push(fromHash);
  addEventListener('hashchange', fromHash, true);

  setCount(G.length);
  if (cur < 0) select(0, { noScroll: true });
  root.classList.add('is-live');
}
if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', init); else init();
})();
