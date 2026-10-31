/* 03 Factories — the flow arcs head an aligned 4-column comparison (SECTIONS_SPEC §03). Owns #fx.
   Replaces Viz D (#flow-stage) + the card grid (#factory-grid); both hosts are gone so app.js skips them.
   Contracts kept: column ids factory-<key> (drawer "在四类工厂中查看"), data-open="factory:<key>". */
(function () {
'use strict';
var D = window.EA_DATA; if (!D) return;
var doc = document, SVGNS = 'http://www.w3.org/2000/svg';
var RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };

function init() {
  var root = doc.getElementById('fx'); if (!root) return;
  var F = D.factories, FL = D.flows || [], keys = F.map(function (f) { return f.key; });
  var W = 1104, H = 132, cx = function (k) { return (keys.indexOf(k) + 0.5) * W / 4; };
  /* arcs: adjacent supply lines low, the skip line (Token → Agent) high */
  var arcs = FL.map(function (f, i) {
    var a = cx(f.from), b = cx(f.to), span = Math.abs(keys.indexOf(f.to) - keys.indexOf(f.from));
    var x1 = span > 1 ? a + 6 : a + 34, x2 = span > 1 ? b + 6 : b - 34, y0 = H - 4, lift = span > 1 ? 112 : 62, yc = y0 - lift * 1.33;
    var mx = (x1 + x2) / 2, ly = y0 - lift - 8;
    return { f: f, i: i, d: 'M' + x1 + ' ' + y0 + ' C' + x1 + ' ' + yc + ' ' + x2 + ' ' + yc + ' ' + x2 + ' ' + y0, mx: mx, ly: ly };
  });
  var svg = '<svg class="fx-arcs" viewBox="0 0 ' + W + ' ' + H + '" role="group" aria-label="四类工厂之间的供给关系">' +
    '<defs><marker id="fx-ah" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M1 1L9 5L1 9" fill="none" stroke="context-stroke" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></marker></defs>' +
    arcs.map(function (a) {
      return '<g class="fx-arc" data-i="' + a.i + '" data-from="' + a.f.from + '" data-to="' + a.f.to + '" tabindex="0" role="button" aria-label="' + esc(a.f.label + '：' + a.f.t) + '">' +
        '<path class="fx-arc__hit" d="' + a.d + '"/><path class="fx-arc__l" pathLength="1" d="' + a.d + '" marker-end="url(#fx-ah)" style="--k:' + a.i + '"/>' +
        '<text x="' + a.mx + '" y="' + a.ly + '" text-anchor="middle">' + esc(a.f.label) + '</text></g>';
    }).join('') + '</svg>';
  var tip = '<div class="fx-tip" id="fx-tip" role="status" aria-live="polite" hidden><b></b><span></span></div>';
  var heads = F.map(function (f, i) {
    return '<div class="fx-h" id="factory-' + f.key + '" data-c="' + i + '" style="--fc:var(--c-' + f.key + ')">' +
      '<button type="button" class="fx-h__b" data-c="' + i + '" aria-pressed="false"><span class="fx-h__n">' + esc(f.n) + '</span><span class="fx-h__t">' + esc(f.name) + '</span></button>' +
      '<p class="fx-h__s">' + esc(f.cn) + '　供给：' + esc(f.supply) + '</p></div>';
  }).join('');
  var rows = [['caps', '核心能力'], ['kpi', '评价指标'], ['who', '典型购买者'], ['tech', '代表技术 / 产品'], ['bound', '边界：']];
  var body = rows.map(function (r) {
    return '<div class="fx-r fx-r--' + r[0] + '" data-r="' + r[0] + '"><p class="fx-r__l">' + r[1] + '</p>' +
      F.map(function (f, i) {
        var v = r[0] === 'caps' ? '<ul>' + f.caps.map(function (c) { return '<li>' + esc(c) + '</li>'; }).join('') + '</ul>' : '<p>' + esc(f[r[0]]) + '</p>';
        return '<div class="fx-c" data-c="' + i + '">' + v + '</div>';
      }).join('') + '</div>';
  }).join('');
  var foot = '<div class="fx-r fx-r--foot">' + F.map(function (f, i) { return '<div class="fx-c" data-c="' + i + '"><button class="fx-more" type="button" data-open="factory:' + f.key + '"><span>关联与来源</span><span aria-hidden="true">→</span></button></div>'; }).join('') + '</div>';
  root.innerHTML = '<div class="fx-band">' + svg + tip + '</div><div class="fx-heads">' + heads + '</div><div class="fx-m">' + body + foot + '<div class="fx-col" aria-hidden="true"></div></div>';

  var hbs = [].slice.call(root.querySelectorAll('.fx-h__b'));
  var arcEls = [].slice.call(root.querySelectorAll('.fx-arc')), tipEl = root.querySelector('#fx-tip'), band = root.querySelector('.fx-band');
  var pinned = -1, hovC = -1;
  function paint() {
    var c = hovC >= 0 ? hovC : pinned;
    root.classList.toggle('has-c', c >= 0);
    root.style.setProperty('--ci', c < 0 ? 0 : c);
    [].forEach.call(root.querySelectorAll('[data-c]'), function (n) { n.classList.toggle('is-c', +n.dataset.c === c); });
    hbs.forEach(function (b, i) { b.setAttribute('aria-pressed', i === pinned ? 'true' : 'false'); });
    var k = c >= 0 ? keys[c] : null;
    arcEls.forEach(function (a) { var on = k && (a.dataset.from === k || a.dataset.to === k); a.classList.toggle('is-on', !!on); a.classList.toggle('is-dim', !!k && !on); });
  }
  function showTip(a) {
    var f = FL[+a.dataset.i], ar = arcs[+a.dataset.i];
    tipEl.querySelector('b').textContent = f.label; tipEl.querySelector('span').textContent = f.t;
    tipEl.style.left = (ar.mx / W * 100) + '%'; tipEl.style.top = (ar.ly / H * 100) + '%';
    tipEl.hidden = false; arcEls.forEach(function (x) { x.classList.toggle('is-hot', x === a); });
  }
  function hideTip() { tipEl.hidden = true; arcEls.forEach(function (x) { x.classList.remove('is-hot'); }); }
  var fine = matchMedia('(hover: hover) and (pointer: fine)').matches;
  root.addEventListener('click', function (e) {
    var b = e.target.closest('.fx-h__b'); if (b) { var i = +b.dataset.c; pinned = pinned === i ? -1 : i; paint(); return; }
    var a = e.target.closest('.fx-arc'); if (a) { tipEl.hidden || !a.classList.contains('is-hot') ? showTip(a) : hideTip(); }
  });
  if (fine) {
    root.addEventListener('pointerover', function (e) {
      var c = e.target.closest('.fx-heads [data-c], .fx-m .fx-c'); var nc = c ? +c.dataset.c : -1;
      if (nc !== hovC) { hovC = nc; paint(); }
      var r = e.target.closest('.fx-r'); [].forEach.call(root.querySelectorAll('.fx-r'), function (x) { x.classList.toggle('is-r', x === r && !x.classList.contains('fx-r--foot')); });
      var a = e.target.closest('.fx-arc'); if (a) showTip(a);
    });
    root.addEventListener('pointerout', function (e) {
      if (!root.contains(e.relatedTarget)) { hovC = -1; paint(); [].forEach.call(root.querySelectorAll('.fx-r'), function (x) { x.classList.remove('is-r'); }); }
      var a = e.target.closest('.fx-arc'); if (a && !(e.relatedTarget && a.contains(e.relatedTarget))) hideTip();
    });
  }
  root.addEventListener('focusin', function (e) { var a = e.target.closest('.fx-arc'); if (a) showTip(a); });
  root.addEventListener('focusout', function (e) { if (e.target.closest('.fx-arc')) hideTip(); });
  root.addEventListener('keydown', function (e) {
    var a = e.target.closest('.fx-arc'); if (a && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); showTip(a); return; }
    var b = e.target.closest('.fx-h__b'); if (!b) return; var i = +b.dataset.c, n = null;
    if (e.key === 'ArrowRight') n = (i + 1) % 4; if (e.key === 'ArrowLeft') n = (i + 3) % 4;
    if (n != null) { e.preventDefault(); pinned = n; paint(); hbs[n].focus(); }
    if (e.key === 'Escape') { pinned = -1; paint(); }
  });
  /* mobile: the columns become a 4-tab switcher, one factory at a time */
  var mq = matchMedia('(max-width: 760px)');
  function mob() { if (mq.matches && pinned < 0) { pinned = 0; } root.classList.toggle('is-mob', mq.matches); paint(); }
  if (mq.addEventListener) mq.addEventListener('change', mob); mob();
  /* entrance: arcs draw once when the band first comes into view */
  if (!RM && 'IntersectionObserver' in window) {
    band.classList.add('is-pre');
    var io = new IntersectionObserver(function (es) { if (es[0].isIntersecting) { io.disconnect(); band.classList.remove('is-pre'); band.classList.add('is-draw'); setTimeout(function () { band.classList.remove('is-draw'); }, 1600); } }, { threshold: 0.4 });
    io.observe(band);
  }
  root.classList.add('is-live');
}
if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', init); else init();
})();
