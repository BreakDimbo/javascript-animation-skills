// region card (number + serif name, fades after 4.5 s) and the control hint line
export function createCard(regionAt){
  const card = document.getElementById('card'); let cur = null, cardT = 0;
  // control hint: small serif, fades out after a few seconds (back on any key press of '?')
  { const h = document.getElementById('help'); if (h){ setTimeout(() => h.classList.add('gone'), 6000); addEventListener('keydown',
    (e) => { if (e.key === '?'){ h.classList.remove('gone'); setTimeout(() => h.classList.add('gone'), 5000); } }); } }
  const set = (r) => { card.querySelector('.no').textContent = r.no; card.querySelector('.nm').textContent = r.name; card.style.opacity = 1; cardT = 4.5; };
  return {
    /* QA M1: ?at= arrival — called from main the moment the regions are ready (wall clock, not a frame): the card is set at full opacity with no
       CSS fade (a 1.8 s transition on a 25 s software frame read as "missing"), so it is visible on the very next paint */
    show(up){ const r = regionAt(up); if (!r) return false; card.style.transition = 'none'; cur = r; set(r); void card.offsetHeight; requestAnimationFrame(() => { card.style.transition = ''; }); return true; },
    // hold: keep the timer paused (?at= arrival, until the cat first moves)
    update(up, dt, hide = false, hold = false){
    const r = hide ? null : regionAt(up); /* m-loop: no card under the title / finale veil */
    if (r !== cur){ cur = r;
      if (r) set(r);
      else card.style.opacity = 0; }
    if (!hold && cardT > 0 && (cardT -= dt) <= 0) card.style.opacity = 0;
  } };
}
