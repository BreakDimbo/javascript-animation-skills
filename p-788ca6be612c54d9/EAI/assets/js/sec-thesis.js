/* Thesis — one quiet entrance (w2) */
(function(){
  function init(){
    var t=document.querySelector('.thesis'); if(!t||!('IntersectionObserver' in window)) return;
    if(window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    var r=t.getBoundingClientRect(); if(r.top<innerHeight*.9) return; // already visible: never hide
    t.classList.add('is-pre');
    var io=new IntersectionObserver(function(es){es.forEach(function(e){ if(e.isIntersecting){ t.classList.remove('is-pre'); io.disconnect(); } })},{rootMargin:'0px 0px -12% 0px'});
    io.observe(t);
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',init); else init();
})();
