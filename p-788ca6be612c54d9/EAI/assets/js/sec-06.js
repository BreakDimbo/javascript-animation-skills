/* 06 Boundaries — diptych rows: hovering or focusing one side quiets the other (SECTIONS_SPEC §06). */
(function () {
'use strict';
var doc = document;
function init() {
  var root = doc.getElementById('bx'); if (!root) return;
  [].forEach.call(root.querySelectorAll('.bx-s'), function (s) { s.tabIndex = 0; });
  function set(r, s) { [].forEach.call(r.querySelectorAll('.bx-s'), function (x) { x.classList.toggle('is-q', !!s && x !== s); }); r.classList.toggle('is-a', !!s && s === r.querySelector('.bx-s')); r.classList.toggle('is-b', !!s && s !== r.querySelector('.bx-s')); }
  function on(e) { var s = e.target.closest('.bx-s'); var r = e.target.closest('.bx-r'); if (r) set(r, s); }
  function off(e) { var r = e.target.closest('.bx-r'); if (r && !(e.relatedTarget && r.contains(e.relatedTarget) && e.relatedTarget.closest('.bx-s'))) set(r, null); }
  if (matchMedia('(hover: hover)').matches) { root.addEventListener('pointerover', on); root.addEventListener('pointerout', off); }
  root.addEventListener('focusin', on); root.addEventListener('focusout', off);
}
if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', init); else init();
})();
