// m-loop QA hooks — window.__fold.qa. Lets a script walk the whole loop without a keyboard.
//   qa.walkLoop({ mode: 'steer', gait: 'trot' })  real walking: synthesises stick input toward the path ahead (collisions, relief, walls apply)
//            gait: 'walk' | 'trot' | 'sprint'  (sprint = Shift, 4.6 m/s ≈ 80 s for the 350 m loop at full fps)
//   qa.walkLoop({ mode: 'warp', mps: 25 })      moves the cat along the path at mps metres per real second (fps-independent; for slow headless boxes)
//   qa.jumpTo(s | regionId)                      teleports to arc length s (m) on the loop, or onto a region's loop point
//   qa.stop()                                    back to keyboard / touch
//   qa.status()  → { s, L, leg, u, v, region, visited, next, state, mode, done }   (state: walk | pull | black | end | resume | free)
// Typical full run: qa.walkLoop({mode:"warp", mps:30}); poll qa.status() until state === "end" (warp moves ≤ 3.5 m per rendered frame, so ≥ 108 frames; + 7.5 s pull + 3.4 s fade).
import * as THREE from '../../shared/vendor/three.module.js';
import { F, REG, fpLane } from '../world.js';

export function createQA({ cat, info: I0, loop, getCamFwd }){
  // the loop ends at the west end of the home lane; the last stretch back into the meadow (over the bridge, up the meadow path to the
  // spawn) is appended here so a scripted walk actually re-enters the meadow and triggers the finale
  const P = I0.P.slice(), S = I0.S.slice();
  const tail = []; for (let u = P[P.length - 1][0] + .5; u <= .6; u += .5) tail.push([u, fpLane(u)]); for (let v = fpLane(.6) + .5; v <= -4.3; v += .5) tail.push([.6 - .3 * (v - fpLane(.6)) / (-4.3 - fpLane(.6)), v]);
  for (const p of tail){ const q = P[P.length - 1]; S.push(S[S.length - 1] + Math.hypot(p[0] - q[0], p[1] - q[1])); P.push([p[0], p[1], 'home']); }
  const L = S[S.length - 1];
  const at = (ss) => { if (ss <= I0.L) return I0.at(ss); let i = S.findIndex(x => x >= ss); if (i < 1) i = S.length - 1; const k = (ss - S[i - 1]) / Math.max(1e-6, S[i] - S[i - 1]); return { u: P[i - 1][0] + (P[i][0] - P[i - 1][0]) * k, v: P[i - 1][1] + (P[i][1] - P[i - 1][1]) * k }; };
  const info = { P, S, L, legs: I0.legs, at };
  let frames = 0; const LOOPIDS = () => loop.present ? loop.present() : ['meadow']; let mode = null, s = 0, gait = 'trot', mps = 25, last = 0;
  const nearS = () => { const [u, v] = F.toUV(cat.up); let b = 0, bd = Infinity; for (let i = 0; i < info.P.length; i++){ const d = (info.P[i][0] - u) ** 2 + (info.P[i][1] - v) ** 2; if (d < bd){ bd = d; b = i; } } return info.S[b]; };
  const legAt = (ss) => { for (const k in info.legs) if (k !== 'home' && ss >= info.legs[k].s0 && ss <= info.legs[k].s1) return k; return 'home'; };
  function place(ss){ const a = info.at(ss), d = F.dirOf(a.u, a.v), ah = info.at(Math.min(info.L, ss + .5)), dh = F.dirOf(ah.u, ah.v);
    cat.up.copy(d); cat.pos.copy(d).multiplyScalar(cat.R + cat.alt); const f = dh.sub(d); f.addScaledVector(d, -f.dot(d)); if (f.lengthSq() > 1e-12) cat.fwd.copy(f.normalize()); }
  const api = {
    walkLoop(o = {}){ mode = o.mode || 'steer'; gait = o.gait || 'trot'; mps = o.mps || 25; s = o.from ?? (loop.regionNow() === 'meadow' || nearS() > I0.L - 1 ? 0 : nearS()); last = performance.now(); return api.status(); },
    jumpTo(x){ if (typeof x === 'string'){ const r = REG.find(q => q.id === x); const [ru, rv] = F.toUV(r.dir); let b = 0, bd = Infinity;
        info.P.forEach((p, i) => { const d = (p[0] - ru) ** 2 + (p[1] - rv) ** 2; if (d < bd){ bd = d; b = i; } }); x = info.S[b]; }
      s = Math.max(0, Math.min(info.L, x)); place(s); return api.status(); },
    stop(){ mode = null; },
    status(){ const [u, v] = F.toUV(cat.up), ss = mode === 'warp' ? s : nearS(); const n = loop.next();
      return { s: +ss.toFixed(1), L: +info.L.toFixed(1), leg: legAt(ss) || (ss > I0.L ? 'home' : null), u: +u.toFixed(2), v: +v.toFixed(2), region: loop.regionNow(), visited: [...loop.visited], next: n ? n.id : null, state: loop.state, mode, done: ss >= info.L - .6 }; },
    // called every frame by main.js with the real input; returns the input the cat should get
    input(inp){
      frames++; if (!mode) return inp;
      if (mode === 'warp'){ const t = performance.now(), d = Math.min(.6, (t - last) / 1000); last = t; if (s < info.L){ s = Math.min(info.L, s + Math.min(3.5, mps * d)); /* ≤ 3.5 m per frame so no region radius (≥ 9 m, chords ≥ 10 m) is jumped over */ place(s); } else mode = null; return { x: 0, y: 0 }; }
      // steer: aim 1.2 m ahead of the nearest path point, express that in camera-relative stick axes
      const s0 = nearS(); if (s0 >= info.L - .6){ mode = null; return { x: 0, y: 0 }; }
      const a = info.at(Math.min(info.L, s0 + 1.2)), tgt = F.dirOf(a.u, a.v).sub(cat.up); const up = cat.up;
      const cf = getCamFwd().clone(); cf.addScaledVector(up, -cf.dot(up)).normalize(); const cr = new THREE.Vector3().crossVectors(cf, up).normalize();
      tgt.addScaledVector(up, -tgt.dot(up)).normalize();
      return { x: tgt.dot(cr), y: tgt.dot(cf), sprint: gait === 'sprint', jump: false, sit: false, sleep: false, _walk: gait === 'walk' };
    },
    get mode(){ return mode; },
    // ---- the Deployer contract (fold-wt/qa/game/qa/README.md): window.__qa.walkLoop({ timeoutMs }) → { ok, visited, ms, notes } ----
    // Walks the whole loop from the meadow with the warp (min(30 m/s · dt, 3.5 m) per RENDERED frame, so it also finishes at 0.03 fps
    // software GL: ~133 frames for the r2 loop). visited = region ids in the order the cat first reached them, plus 'meadow' again on
    // the return. Resolves once the cat is back in the meadow and the finale has started ('pull'), or with ok:false at timeoutMs.
    // { waitEnd: true } waits for the end card instead.
    walkLoopQA({ timeoutMs = 900000, waitEnd = false, mps: m = 30 } = {}){
      const t0 = performance.now(), seq = ['meadow'], f0 = frames; let prev = loop.regionNow(), away = false;
      api.walkLoop({ mode: 'warp', mps: m, from: 0 }); place(0);
      return new Promise((res) => {
        const tick = () => {
          const r = loop.regionNow(); if (r && r !== prev && (r !== 'meadow' ? !seq.includes(r) : away)) seq.push(r); if (r !== 'meadow' && s > 20) away = true; prev = r;
          const st = loop.state, fin = waitEnd ? st === 'end' : ['pull', 'black', 'end', 'resume', 'free'].includes(st), ms = Math.round(performance.now() - t0);
          if (fin || ms > timeoutMs){ const miss = LOOPIDS().filter(id => !seq.includes(id));
            return res({ ok: fin && !miss.length, visited: seq, ms, notes: `${fin ? 'finale ' + st : 'TIMEOUT at s=' + s.toFixed(1) + '/' + info.L.toFixed(1) + ' m'}; ${frames - f0} frames; loop ${info.L.toFixed(1)} m` + (miss.length ? '; missed ' + miss.join(',') : '') }); }
          setTimeout(tick, 150); };
        tick(); });
    },
    progress(){ const ss = mode === 'warp' ? s : nearS(), leg = legAt(ss), LEGS = Object.keys(info.legs).filter(k => k !== 'home'), lg = info.legs[leg];
      const home = leg === 'home', back = home && ss > info.L / 2; /* leg 0..4 = plain, wet, dune, wheat, wall; 5 = the home stretch back into the meadow */
      return { area: loop.regionNow() || leg, leg: back ? LEGS.length : Math.max(0, LEGS.indexOf(leg)), t: home ? (back ? 1 : 0) : +Math.min(1, Math.max(0, (ss - lg.s0) / Math.max(1, lg.s1 - lg.s0))).toFixed(2), s: +ss.toFixed(1), L: +info.L.toFixed(1), state: loop.state, next: loop.next()?.id || null }; },
  };
  return api;
}
