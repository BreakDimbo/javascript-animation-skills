// region card (number + serif name, fades after 4.5 s) and the control hint line
export function createCard(regionAt){
  const card = document.getElementById('card'); let cur = null, cardT = 0;
  // control hint: small serif, fades out after a few seconds (back on any key press of '?')
  { const h = document.getElementById('help'); if (h){ setTimeout(() => h.classList.add('gone'), 6000); addEventListener('keydown',
    (e) => { if (e.key === '?'){ h.classList.remove('gone'); setTimeout(() => h.classList.add('gone'), 5000); } }); } }
  return { update(up, dt, hide = false){
    const r = hide ? null : regionAt(up); /* m-loop: no card under the title / finale veil */
    if (r !== cur){ cur = r;
      if (r){ card.querySelector('.no').textContent = r.no; card.querySelector('.nm').textContent = r.name; card.style.opacity = 1; cardT = 4.5; }
      else card.style.opacity = 0; }
    if (cardT > 0 && (cardT -= dt) <= 0) card.style.opacity = 0;
  } };
}
