/* 08 Decision — scenario stepper morphing one panel, ledger, dark-typeset formula (SECTIONS_SPEC §08).
   app.js initDecision still owns the tabs (aria-selected, data-off); this file only adds the stop names,
   the step rule and the panel cross-fade. */
(function () {
'use strict';
var doc = document, RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
function init() {
  var scen = doc.getElementById('scen'); if (!scen) return;
  var seg = scen.querySelector('.seg--scen'), btns = [].slice.call(seg.querySelectorAll('[role="tab"]'));
  btns.forEach(function (b) {
    var p = doc.getElementById(b.getAttribute('aria-controls')), h = p && p.querySelector('h4');
    var name = h ? h.textContent.replace(/^场景\s*[A-C]\s*·\s*/, '') : '';
    var nm = doc.createElement('span'); nm.className = 'dx-st__t'; nm.setAttribute('aria-hidden', 'true'); nm.textContent = name;
    var l = doc.createElement('span'); l.className = 'dx-st__l';
    while (b.firstChild) l.appendChild(b.firstChild);
    b.classList.add('dx-st'); b.appendChild(l); b.appendChild(nm);
  });
  var rule = doc.createElement('span'); rule.className = 'dx-rule'; rule.setAttribute('aria-hidden', 'true');
  rule.innerHTML = '<i></i>'; seg.insertBefore(rule, seg.firstChild);
  function sync(anim) {
    var i = 0; btns.forEach(function (b, k) { if (b.getAttribute('aria-selected') === 'true') i = k; b.classList.toggle('is-past', false); });
    btns.forEach(function (b, k) { b.classList.toggle('is-past', k < i); });
    seg.style.setProperty('--step', i);
    if (anim && !RM) {
      var p = doc.getElementById(btns[i].getAttribute('aria-controls'));
      p.classList.remove('is-in'); void p.offsetWidth; p.classList.add('is-in');
    }
  }
  scen.addEventListener('animationend', function (e) { if (e.target.classList) e.target.classList.remove('is-in'); });
  seg.addEventListener('click', function (e) { if (e.target.closest('[role="tab"]')) sync(true); });
  seg.addEventListener('keydown', function (e) { if (!/^(Arrow|Home|End)/.test(e.key)) return; setTimeout(function () { sync(true); }, 0); });
  sync(false);
  var f = doc.getElementById('formula'), den = f && f.querySelector('.fterm--den');
  if (den) { den.addEventListener('focus', function () { f.classList.add('is-den'); }); den.addEventListener('blur', function () { f.classList.remove('is-den'); }); }
}
if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', init); else init();
})();
