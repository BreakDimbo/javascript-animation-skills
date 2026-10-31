/* 04 Architecture — pins <-> marginalia notes (w2) */
(function(){
  function init(){
    var root=document.getElementById('arch-plate'); if(!root) return;
    var lead=root.querySelector('.ap-lead');
    var reduce=window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches;
    var wide=window.matchMedia('(min-width: 1101px)');
    var pins={},notes={};
    root.querySelectorAll('.ap-pin').forEach(function(p){pins[p.dataset.pin]=p});
    root.querySelectorAll('.ap-n').forEach(function(n){
      notes[n.dataset.pin]=n;
      if(pins[n.dataset.pin]){n.tabIndex=0}
    });
    var cur=null,fromNote=false;
    function clear(){
      if(cur){ if(pins[cur]) pins[cur].classList.remove('is-on'); if(notes[cur]) notes[cur].classList.remove('is-on'); }
      cur=null; root.classList.remove('is-active');
      lead.classList.remove('is-on');
    }
    function on(k,withLead){
      if(cur===k) return; clear(); cur=k;
      var p=pins[k],n=notes[k];
      if(n) n.classList.add('is-on');
      if(!p) return;
      p.classList.add('is-on'); root.classList.add('is-active');
      if(withLead&&n&&wide.matches) drawLead(p,n);
    }
    function drawLead(p,n){
      // one measurement per hover (no per-frame reads)
      var r=root.getBoundingClientRect(),pr=p.getBoundingClientRect(),nr=n.getBoundingClientRect();
      var x1=nr.left-r.left-10,y1=nr.top-r.top+23;
      var x2=pr.left-r.left+pr.width/2+(pr.width/2+6),y2=pr.top-r.top+pr.height/2;
      var dx=x2-x1,dy=y2-y1,len=Math.sqrt(dx*dx+dy*dy),a=Math.atan2(dy,dx);
      var base='translate3d('+x1+'px,'+y1+'px,0) rotate('+a+'rad) ';
      lead.classList.remove('is-grow');
      lead.style.transform=base+'scaleX('+(reduce?len:0.001)+')';
      lead.classList.add('is-on');
      if(!reduce){ void lead.offsetWidth; lead.classList.add('is-grow'); lead.style.transform=base+'scaleX('+len+')'; }
    }
    Object.keys(notes).forEach(function(k){
      var n=notes[k];
      n.addEventListener('pointerenter',function(){on(k,true)});
      n.addEventListener('pointerleave',clear);
      n.addEventListener('focus',function(){on(k,true)});
      n.addEventListener('blur',clear);
      n.addEventListener('click',function(){ if(pins[k]) pins[k].focus({preventScroll:true}); });
    });
    Object.keys(pins).forEach(function(k){
      var p=pins[k];
      p.addEventListener('pointerenter',function(){on(k,false)});
      p.addEventListener('pointerleave',clear);
      p.addEventListener('focus',function(){on(k,false)});
      p.addEventListener('blur',clear);
      p.addEventListener('click',function(e){
        e.preventDefault(); e.stopPropagation();
        var n=notes[k]; if(!n) return;
        var rr=n.getBoundingClientRect();
        if(rr.top<80||rr.bottom>innerHeight-20) n.scrollIntoView({block:'center',behavior:reduce?'auto':'smooth'});
        n.focus({preventScroll:true});
      });
    });
    addEventListener('scroll',function(){ if(lead.classList.contains('is-on')) lead.classList.remove('is-on'); },{passive:true});
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',init); else init();
})();
