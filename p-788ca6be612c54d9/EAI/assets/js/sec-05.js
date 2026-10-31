/* 05 Lineage — driver × term dot matrix with a lineage pane. The table and time views of app.js stay as
   alternate tabs; this file adds the 矩阵 view and keeps it in sync with the shared search + layer filter. */
(function () {
  'use strict';
  var D = window.EA_DATA; if (!D) return;
  var doc = document;
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var RM = matchMedia('(prefers-reduced-motion: reduce)'), NARROW = matchMedia('(max-width: 900px)');
  var LIN = D.lineage, rows = [];
  LIN.forEach(function (L, li) { L.rows.forEach(function (r, ri) { rows.push({ r: r, li: li, key: li + ':' + ri, L: L }); }); });
  /* columns = distinct drivers, ordered by how many terms they drive (computed), then first appearance */
  var drv = [], cnt = {};
  rows.forEach(function (x) { x.r.drivers.forEach(function (d) { if (!(d in cnt)) { cnt[d] = 0; drv.push(d); } cnt[d]++; }); });
  var order = drv.slice().sort(function (a, b) { return cnt[b] - cnt[a] || drv.indexOf(a) - drv.indexOf(b); });
  var CW = 18;

  var host, body, pane, colhl, hdr, sel = rows[0].key, pin = null;

  function match(x, q) {
    if (!q) return true; var r = x.r;
    return [r.term, r.sub, r.origin, r.driverNote, r.date].concat(r.drivers || [], r.products || [], r.oss || []).join(' ').toLowerCase().indexOf(q) !== -1;
  }
  function list(a) { return (a || []).map(esc).join('<span class="lx-sep" aria-hidden="true"> · </span>'); }
  function paneHtml(x) {
    var r = x.r;
    return '<p class="lx-p__k"><span>' + esc(x.L.layer) + '</span></p>' +
      '<h3 class="lx-p__t">' + esc(r.term) + '</h3>' +
      '<p class="lx-p__s">' + esc(r.sub) + '</p>' +
      '<dl class="lx-p__dl">' +
        '<div><dt>代表性公开节点<time>' + esc(r.date) + '</time></dt><dd>' + esc(r.origin) + '</dd></div>' +
        '<div><dt>大厂推动者<span>' + r.drivers.length + '</span></dt><dd>' + list(r.drivers) + (r.driverNote ? '<small>' + esc(r.driverNote) + '</small>' : '') + '</dd></div>' +
        '<div><dt>代表产品与方案</dt><dd>' + list(r.products) + '</dd></div>' +
        '<div><dt>代表开源项目</dt><dd>' + list(r.oss) + (r.ossNote ? '<small>' + esc(r.ossNote) + '</small>' : '') + '</dd></div>' +
      '</dl>' +
      '<button class="lx-p__more" type="button" data-open="lin:' + x.key + '"><span>关联与来源</span><span aria-hidden="true">→</span></button>';
  }
  function rowHtml(x, i) {
    var r = x.r, cells = order.map(function (d) {
      var on = r.drivers.indexOf(d) >= 0;
      return '<span class="lx-c' + (on ? ' is-on' : '') + '" data-d="' + esc(d) + '">' + (on ? '<i></i>' : '') + '</span>';
    }).join('');
    return '<div class="lx-r' + (x.key === sel ? ' is-sel' : '') + '" role="option" tabindex="' + (x.key === sel ? 0 : -1) + '" aria-selected="' + (x.key === sel) + '" data-key="' + x.key + '" data-drv="' + esc(r.drivers.join('|')) + '" aria-label="' + esc(r.term + ' · ' + r.sub + ' · ' + r.date + ' · 大厂推动者 ' + r.drivers.join('、')) + '">' +
      '<span class="lx-t"><b>' + esc(r.term) + '</b><time>' + esc(r.date) + '</time></span>' +
      '<span class="lx-chips" aria-hidden="true">' + list(r.drivers) + '</span>' +
      '<span class="lx-cells" aria-hidden="true">' + cells + '</span></div>';
  }
  function state() {
    var q = (doc.getElementById('lineage-q').value || '').trim().toLowerCase(), layer = doc.getElementById('lineage-layer').value;
    return { q: q, layer: layer };
  }
  function draw() {
    var s = state(), html = '', vis = [], bi = 0;
    LIN.forEach(function (L, li) {
      if (s.layer !== '' && s.layer !== String(li)) return;
      var rs = rows.filter(function (x) { return x.li === li && match(x, s.q); });
      if (!rs.length) return;
      html += '<div class="lx-band" style="--i:' + bi + '"><span class="lx-band__n">' + esc(L.layer) + '</span><span class="lx-band__x">' + esc(L.note) + '</span></div>' +
        '<div class="lx-grp" style="--i:' + bi + '">' + rs.map(rowHtml).join('') + '</div>';
      bi++; vis = vis.concat(rs);
    });
    if (!vis.length) {
      body.innerHTML = '<div class="empty lx-empty" role="status"><b class="empty__t">' + (s.q ? '没有匹配「' + esc(s.q) + '」的谱系条目' : '这个筛选下没有谱系条目') + '</b>' +
        '<button type="button" class="btn btn--ghost btn--sm empty__btn" data-reset="#lineage-layer,#lineage-q">清除筛选</button></div>';
      pane.hidden = true; return;
    }
    body.innerHTML = html;
    if (!vis.some(function (x) { return x.key === sel; })) sel = vis[0].key;
    select(sel, false, true);
    applyPin();
  }
  function select(key, focus, quiet) {
    var x = rows.filter(function (y) { return y.key === key; })[0]; if (!x) return;
    var changed = key !== sel || pane.hidden || !pane.firstChild; sel = key;
    Array.prototype.forEach.call(body.querySelectorAll('.lx-r'), function (r) {
      var on = r.getAttribute('data-key') === key; r.classList.toggle('is-sel', on); r.setAttribute('aria-selected', on); r.tabIndex = on ? 0 : -1;
      if (on && focus) r.focus({ preventScroll: false });
    });
    if (changed || !quiet) {
      pane.hidden = false;
      if (!RM.matches && !quiet) { pane.classList.remove('is-in'); void pane.offsetWidth; }
      pane.innerHTML = paneHtml(x);
      pane.classList.add('is-in');
    }
    placePane();
  }
  /* desktop: the pane sits beside the matrix; narrow: it opens in place under the chosen row */
  function placePane() {
    var r = body.querySelector('.lx-r.is-sel');
    if (NARROW.matches && r) { if (r.nextSibling !== pane) r.parentNode.insertBefore(pane, r.nextSibling); }
    else if (pane.parentNode !== host) host.appendChild(pane);
  }
  function applyPin() {
    host.classList.toggle('is-pin', !!pin);
    Array.prototype.forEach.call(hdr.querySelectorAll('.lx-h'), function (h) { var on = h.getAttribute('data-d') === pin; h.classList.toggle('is-pin', on); h.setAttribute('aria-pressed', on); });
    Array.prototype.forEach.call(body.querySelectorAll('.lx-r'), function (r) { r.classList.toggle('is-off', !!pin && r.getAttribute('data-drv').split('|').indexOf(pin) < 0); });
  }

  function init() {
    var sec = doc.getElementById('lineage'); host = doc.getElementById('lineage-matrix');
    if (!sec || !host) return;
    hdr = host.querySelector('.lx-hd'); body = host.querySelector('.lx-body'); pane = host.querySelector('.lx-pane'); colhl = host.querySelector('.lx-colhl');
    hdr.innerHTML = '<span class="lx-hd__k"><span>大厂推动者 · ' + order.length + '</span><span>术语 · ' + rows.length + '</span></span>' +
      '<span class="lx-hd__cols">' + order.map(function (d, i) {
        return '<button class="lx-h" type="button" data-d="' + esc(d) + '" data-i="' + i + '" aria-pressed="false" aria-label="' + esc(d + ' · ' + cnt[d]) + '"><span class="lx-h__n">' + esc(d) + '</span><span class="lx-h__c">' + cnt[d] + '</span></button>';
      }).join('') + '</span>';
    host.style.setProperty('--cols', order.length);
    host.classList.add('is-js');
    draw();

    /* rows: click / keyboard select */
    body.addEventListener('click', function (e) { var r = e.target.closest('.lx-r'); if (r) select(r.getAttribute('data-key')); });
    body.addEventListener('keydown', function (e) {
      var r = e.target.closest('.lx-r'); if (!r) return;
      var all = Array.prototype.slice.call(body.querySelectorAll('.lx-r')), i = all.indexOf(r), n = null;
      if (e.key === 'ArrowDown') n = all[Math.min(all.length - 1, i + 1)];
      if (e.key === 'ArrowUp') n = all[Math.max(0, i - 1)];
      if (e.key === 'Home') n = all[0]; if (e.key === 'End') n = all[all.length - 1];
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); select(r.getAttribute('data-key')); return; }
      if (n) { e.preventDefault(); select(n.getAttribute('data-key'), true); }
    });
    /* columns: hover lights the column (transform only), click pins a driver */
    var hoverCol = function (i) {
      if (i == null) { host.classList.remove('is-col'); return; }
      colhl.style.transform = 'translate3d(' + (i * CW) + 'px,0,0)'; host.classList.add('is-col');
    };
    host.addEventListener('pointerover', function (e) {
      var c = e.target.closest('.lx-h, .lx-c'); if (!c) return;
      var d = c.getAttribute('data-d'), i = order.indexOf(d); hoverCol(i);
      Array.prototype.forEach.call(hdr.querySelectorAll('.lx-h'), function (h) { h.classList.toggle('is-hov', h.getAttribute('data-d') === d); });
    });
    host.addEventListener('pointerleave', function () { hoverCol(null); Array.prototype.forEach.call(hdr.querySelectorAll('.lx-h.is-hov'), function (h) { h.classList.remove('is-hov'); }); });
    hdr.addEventListener('focusin', function (e) { var h = e.target.closest('.lx-h'); if (h) hoverCol(+h.getAttribute('data-i')); });
    hdr.addEventListener('focusout', function () { hoverCol(null); });
    hdr.addEventListener('click', function (e) { var h = e.target.closest('.lx-h'); if (!h) return; var d = h.getAttribute('data-d'); pin = pin === d ? null : d; applyPin(); });
    host.addEventListener('keydown', function (e) { if (e.key === 'Escape' && pin) { pin = null; applyPin(); } });

    /* shared filters (app.js owns their state for the table/time views; read the same fields) */
    var t; var later = function () { clearTimeout(t); t = setTimeout(draw, 90); };
    doc.getElementById('lineage-q').addEventListener('input', later);
    doc.getElementById('lineage-layer').addEventListener('change', later);
    /* the 矩阵 tab: app.js's tab handler shows the table for any non-time tab, so follow aria-selected */
    var tm = doc.getElementById('lv-matrix'), tw = doc.getElementById('lineage-tablewrap');
    var sync = function () { var on = tm.getAttribute('aria-selected') === 'true'; host.hidden = !on; if (on) tw.hidden = true; };
    new MutationObserver(sync).observe(tm, { attributes: true, attributeFilter: ['aria-selected'] });
    sync();
    if (NARROW.addEventListener) NARROW.addEventListener('change', placePane);

    /* one entrance: layer bands rise in sequence (≤ 7 items, 40 ms) */
    if (!RM.matches && 'IntersectionObserver' in window) {
      host.classList.add('is-pre');
      var io = new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting) { io.disconnect(); requestAnimationFrame(function () { host.classList.remove('is-pre'); }); } }); }, { rootMargin: '0px 0px -10% 0px' });
      io.observe(host);
    }
  }
  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', init); else init();
})();
