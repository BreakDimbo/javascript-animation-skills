// sleep stones and cushions are the save points: Z beside one curls the cat up (the cat's own sleep state); after 2 s asleep the page
// fades to paper white (b7's sleepFade, no glow), the place is saved, and it fades back. A reload starts at the stone it was saved at.
import { saveGame, loadGame, sleepFade } from '../../b7-finds/finds.js';
import { R, qs, note } from '../core/util.js';
import { F } from '../world.js';

const REACH = .8; // m from the stone's centre: "on or next to" it (stone ≈ .4 m across, the cat ≈ .45 m long)

// the saved spawn (a unit direction) or null. ?at= teleports and ?nosave both win over the save
export function savedSpawn(){
  if (qs.get('at') || qs.has('nosave')) return null;
  const sv = loadGame(); if (!sv || !sv.pos || !Number.isFinite(sv.pos.x)) return null;
  note(`save restored (spot ${sv.spot})`); return sv.pos.normalize();
}

export function createSleep(spots){
  const dirs = spots.map(s => F.dirOf(s.u, s.v));
  const paper = document.createElement('div');
  paper.style.cssText = 'position:fixed;inset:0;pointer-events:none;opacity:0;z-index:40;background:#f1ebdc;transition:opacity 1.2s ease';
  document.body.appendChild(paper);
  let t = 0, done = false;
  const nearest = (up) => { let bi = -1, bd = 1e9; dirs.forEach((d, i) => { const k = d.angleTo(up) * R; if (k < bd){ bd = k; bi = i; } }); return [bi, bd]; };
  return { paper, spots,
    nearest,
    update(dt, cat){
      if (cat.state !== 'sleep'){ t = 0; done = false; return; }
      t += dt; if (t < 2 || done) return;
      done = true; const [i, d] = nearest(cat.up); if (d > REACH) return;
      const s = spots[i];
      saveGame({ pos: cat.up.clone(), spot: i, kind: s.kind }); note(`saved at sleep spot ${i} (${s.kind})`); // where the cat lies, beside that stone
      sleepFade(paper, 900);
    } };
}
