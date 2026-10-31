/* 02 Domains — lens matrix (8 domains × 4 fields). Owns #domain-list rows; the machine viz above is untouched.
   Rows keep class .dcard + data-dom so the existing map/machine hover link (app.js) still binds to them. */
(function () {
  'use strict';
  var D = window.EA_DATA; if (!D) return;
  var doc = document;
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var RM = matchMedia('(prefers-reduced-motion: reduce)');
  var F = ['bound', 'prod', 'cn', 'err'];
  function capsOf(c) { return String(c || '').match(/C\d|G/g) || []; }
  function count(id) { return D.glossary.filter(function (g) { return capsOf(g.caps).indexOf(id) >= 0; }).length; }

  var LAB = { prod: '代表产品 / 实践：', cn: '中国厂商 / 本地生态：', err: '典型失误：' }; // sr-only cell labels (verbatim field labels)
  function render() {
    var host = doc.getElementById('domain-list'), lens = doc.getElementById('lens');
    if (!host || !lens) return;
    host.innerHTML = D.domains.map(function (d, i) {
      return '<div class="dcard lm-row" id="domain-' + d.id.toLowerCase() + '" data-dom="' + d.id + '" style="--i:' + i + '">' +
        '<div class="lm-row__h"><span class="lm-row__id">' + esc(d.id) + '</span><h3>' + esc(d.name) + '</h3>' +
        '<button class="lm-row__more" type="button" data-open="domain:' + d.id + '"><span>术语表中落在 ' + esc(d.id) + ' 的 ' + count(d.id) + ' 条术语</span><span aria-hidden="true">→</span></button></div>' +
        F.map(function (f) { return '<p class="lm-c lm-c--' + f + '" data-f="' + f + '">' + (LAB[f] ? '<span class="lm-lab">' + LAB[f] + '</span>' : '') + esc(d[f]) + '</p>'; }).join('') +
        '</div>';
    }).join('');
    lens.classList.add('is-js');

    var tabs = Array.prototype.slice.call(lens.querySelectorAll('.lm__tab'));
    function set(f, focus) {
      if (lens.getAttribute('data-lens') === f) return;
      tabs.forEach(function (t) { var on = t.getAttribute('data-f') === f; t.setAttribute('aria-selected', on ? 'true' : 'false'); t.tabIndex = on ? 0 : -1; if (on && focus) t.focus(); });
      if (RM.matches) { lens.setAttribute('data-lens', f); return; }
      /* text cross-fade: out 120 ms, swap the column order, in 220 ms (opacity + 4 px only) */
      lens.classList.add('is-swap');
      clearTimeout(set._t);
      set._t = setTimeout(function () { lens.setAttribute('data-lens', f); requestAnimationFrame(function () { lens.classList.remove('is-swap'); }); }, 120);
    }
    tabs.forEach(function (t, i) {
      t.tabIndex = t.getAttribute('aria-selected') === 'true' ? 0 : -1;
      t.addEventListener('click', function () { set(t.getAttribute('data-f')); });
      t.addEventListener('keydown', function (e) {
        var n = null;
        if (e.key === 'ArrowRight') n = tabs[(i + 1) % tabs.length];
        if (e.key === 'ArrowLeft') n = tabs[(i - 1 + tabs.length) % tabs.length];
        if (e.key === 'Home') n = tabs[0]; if (e.key === 'End') n = tabs[tabs.length - 1];
        if (n) { e.preventDefault(); set(n.getAttribute('data-f'), true); }
      });
    });
    /* the matrix itself is the control: a collapsed cell promotes its field */
    host.addEventListener('click', function (e) {
      var c = e.target.closest('.lm-c'); if (!c || c.getAttribute('data-f') === lens.getAttribute('data-lens')) return;
      if (matchMedia('(max-width: 760px)').matches) return;
      set(c.getAttribute('data-f'));
    });
    /* one entrance: rows rise 8 px with a 30 ms stagger, once */
    if (!RM.matches && 'IntersectionObserver' in window) {
      lens.classList.add('is-pre');
      var io = new IntersectionObserver(function (es) {
        es.forEach(function (e) { if (e.isIntersecting) { io.disconnect(); requestAnimationFrame(function () { lens.classList.remove('is-pre'); }); } });
      }, { rootMargin: '0px 0px -12% 0px' });
      io.observe(host);
    }
  }
  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', render); else render();
})();
