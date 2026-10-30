// m-loop: the walk itself — which loop region the cat is in, which it has visited this walk (in any order), the next one to head for,
// and the finale: once every present region is visited and the cat is back in the meadow, the camera pulls out to the whole planet,
// then fades to black and the end card. ?outro=1 forces the finale after the intro (for shots); ?loopall marks all but the meadow visited.
import { R, qs, note } from '../core/util.js';
import { REG, LOOP } from '../world.js';
import { byId } from '../regions/registry.js';

export function createLoop({ cat, fcam, titles, onLock }){
  const present = () => LOOP.filter(id => byId(id) || id === 'meadow'); // a region that failed to load (or the station before m-station) is skipped
  const reg = (id) => REG.find(r => r.id === id);
  const dist = (id) => cat.up.angleTo(reg(id).dir) * R;
  const visited = new Set(['meadow']); let born = performance.now() / 1000, begun = false; let left = false, state = qs.has('outro') ? 'force' : 'walk', T = 0, t0 = 0, cur = null;
  if (qs.has('loopall')) for (const id of LOOP) visited.add(id);
  const api = {
    visited, get state(){ return state; },
    // the next unvisited loop region after the last one visited, in loop order (then home)
    next(){ const P = present(); const todo = P.filter(id => !visited.has(id)); if (!todo.length) return left ? reg('meadow') : null;
      let last = 0; P.forEach((id, i) => { if (visited.has(id)) last = Math.max(last, i); });
      const after = P.slice(last + 1).find(id => !visited.has(id)) || todo[0]; return reg(after); },
    regionNow(){ return cur; },
    present,
    // main calls this when the intro has handed control to the player (the forced-finale timer counts from here, so a slow first frame can't race it)
    begin(){ if (!begun){ begun = true; born = performance.now() / 1000; } },
    update(dt){ T += dt;
      cur = null; for (const id of present()){ const r = reg(id); if (dist(id) < r.rad){ cur = id; break; } }
      if (cur && !visited.has(cur)){ visited.add(cur); note(`loop: visited ${cur} (${[...visited].join(',')})`); }
      if (dist('meadow') > reg('meadow').rad + 6) left = true;
      const done = present().every(id => visited.has(id));
      if ((state === 'walk' && done && left && cur === 'meadow') || (state === 'force' && begun && performance.now() / 1000 - born > (+qs.get('outro') > 1 ? +qs.get('outro') : 12))) { state = 'pull'; t0 = performance.now() / 1000; /* wall-clock: the finale keeps its pace at any frame rate */ onLock(true); note('loop: finale');
        fcam.Dt = fcam.HOME_D * 3.2; fcam.elevT = fcam.homeElev + .18; }
      if (state === 'pull'){ fcam.dYaw = (fcam.dYaw || 0) + dt * .06; // a slow quarter-turn while the planet comes into view
        if (performance.now() / 1000 - t0 > 7.5){ state = 'black'; titles.outro().then(() => { state = 'end'; }); } }
      if (state === 'black') fcam.dYaw = (fcam.dYaw || 0) + dt * .06;
    },
    // the end card waits for a key / tap, then the walk goes on (all visits kept; the finale does not repeat)
    async resume(){ if (state !== 'end') return; state = 'resume'; fcam.home(); await titles.resume(); onLock(false); state = 'free'; },
  };
  return api;
}
