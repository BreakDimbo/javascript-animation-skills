// 动物互动 · meadow: the flock notices the cat. Pure board-(u,v) maths on top of the b2 brains, no allocation per frame.
//  calm   → graze (b2 decides)
//  look   → the cat is near: head up (stand row), body turns to face it; holds a moment after it leaves
//  drift  → the cat comes running at it: a few unhurried steps away (walk row), then settle, look back, and graze again
//  lamb   → one small lamb by its mother; a calm cat draws it over for a few seconds, then it trots back
const LOOK_R = 1.7, RUN_R = 1.25, RUN_V = 1.3, HOLD = 1.6;
/* r2 (VD review): head/body turn toward the cat ≤ 60°; drift 1.0–1.3 m as a 1.2 s trot; a sheep between the camera and a cat ≤ 1.2 m behind it sidesteps 0.7 m in 0.8 s;
   lamb follows at 0.6–0.9 Lc with a 0.12 Hc skip every 0.35 s. Lc/Hc = the cat's body length / standing height in metres. */
/* sizes pinned to the cat's standing height only (VD 14:58): CAT_HC from game/catScale.js when the station stream lands it; not in this branch yet → its fallback 0.281 m.
   The review's Lc targets are hard-coded as Hc (1 Lc = 1.66 Hc). */
import { CAT_HC } from '../catScale.js';
// live: the cat's standing height from game/catScale.js (fallback 0.281), read every frame so a late glb load is picked up
export const hcNow = () => CAT_HC, lcNow = () => 1.66 * CAT_HC;
let LAMB_CLR = 0; export const setLambClear = v => { LAMB_CLR = v; }; // screen-across clearance tweak (Lc), QA only
const LOOK_MAX = Math.PI / 3, SIDE_R = 1.2, SIDE_W = .5, SIDE_D = .7, SIDE_T = .8;
const clampA = (x, m) => Math.max(-m, Math.min(m, x));
const ease = (a, b, k, dt) => a + (b - a) * (1 - Math.exp(-k * dt));
const angTo = (a, b) => { let d = b - a; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return d; };
const riverU = (v) => -1.85 + .45 * Math.sin(v * .37);

export function createSheepMinds(n, rand = Math.random){
  const S = Array.from({ length: n }, () => ({ mode: 'calm', du: 0, dv: 0, gu: 0, gv: 0, hold: 0, t: 0, cool: 0, ang: null, ang0: 0, look: 0, sp: 0, top: .95, gait: 0, scool: 0, moved: 0 }));
  const lamb = { u: null, v: null, ang: 0, mode: 'mum', t: 0, cool: 6, sp: 0, gait: 0, mum: 0 };
  // u,v: where b2 + home put sheep i this frame (before our offset); baseAng: its b2 heading in board space; cat: {u,v,fu,fv,speed}
  function step(i, u, v, baseAng, cat, dt){
    const s = S[i]; s.cool = Math.max(0, s.cool - dt); s.scool = Math.max(0, s.scool - dt); s.t += dt;
    const x = u + s.du, y = v + s.dv, ex = cat.u - x, ey = cat.v - y, d = Math.hypot(ex, ey) || 1e-3;
    const toCat = Math.atan2(ey, ex), approach = -(cat.fu * ex + cat.fv * ey) / d; // >0: the cat is heading at this sheep
    if (s.mode !== 'drift' && d < RUN_R && cat.speed > RUN_V && approach > .45 && s.cool === 0){
      const k = 1.05 + rand() * .2, ax = -ex / d, ay = -ey / d;
      let gu = s.du + ax * k, gv = s.dv + ay * k; const m = Math.hypot(gu, gv); if (m > 2.4){ gu *= 2.4 / m; gv *= 2.4 / m; }
      if (Math.abs(u + gu - riverU(v + gv)) < .7) gu = s.du - ax * k * .3; // never shy into the river
      s.mode = 'drift'; s.gu = gu; s.gv = gv; s.t = 0; s.cool = 4; s.top = Math.hypot(gu - s.du, gv - s.dv) / 1.05; s.moved = 0;
    }
    // r2: the cat has slipped in behind this sheep (camera side = -view): step aside, perpendicular to the camera–cat line, then look round at it
    if (cat.vu !== undefined && s.mode !== 'drift' && s.mode !== 'side' && s.scool === 0 && d < SIDE_R){
      const rx = x - cat.u, ry = y - cat.v, along = rx * cat.vu + ry * cat.vv, lat = rx * -cat.vv + ry * cat.vu;
      if (along < 0 && Math.abs(lat) < SIDE_W){ const sg = lat >= 0 ? 1 : -1; let gu = s.du - cat.vv * sg * SIDE_D, gv = s.dv + cat.vu * sg * SIDE_D;
        if (Math.abs(u + gu - riverU(v + gv)) < .7){ gu = s.du + cat.vv * sg * SIDE_D; gv = s.dv - cat.vu * sg * SIDE_D; }
        s.mode = 'side'; s.gu = gu; s.gv = gv; s.t = 0; s.scool = 5; s.top = SIDE_D / (SIDE_T * .85); s.moved = 0; } }
    if (s.mode === 'drift' || s.mode === 'side'){
      const gx = s.gu - s.du, gy = s.gv - s.dv, gd = Math.hypot(gx, gy);
      s.sp = ease(s.sp, gd > .04 ? s.top : 0, 9, dt);
      if (gd > 1e-3){ const st = Math.min(gd, s.sp * dt); s.du += gx / gd * st; s.dv += gy / gd * st; s.moved += st; s.ang = s.ang === null ? Math.atan2(gy, gx) : s.ang + angTo(s.ang, Math.atan2(gy, gx)) * Math.min(1, dt * 6); }
      s.gait += dt * s.sp * 9;
      if (gd < .04 || s.t > 3){ s.mode = 'look'; s.hold = HOLD + .8; s.ang0 = s.ang; s.sp = 0; }
    } else if (d < LOOK_R){ if (s.mode === 'calm'){ s.mode = 'look'; s.ang0 = s.ang === null ? baseAng : s.ang; } s.hold = HOLD; }
    else if (s.mode === 'look'){ s.hold -= dt; if (s.hold < 0) s.mode = 'calm'; }
    if (s.mode === 'look' && s.sp > .02){ s.sp = ease(s.sp, 0, 5, dt); }
    s.look = ease(s.look, s.mode === 'calm' ? 0 : 1, 5, dt);
    // turn: towards the cat while looking, back to the b2 heading when calm (eased, so the 8 painted views step round, not snap)
    const want = s.mode === 'look' ? s.ang0 + clampA(angTo(s.ang0, toCat), LOOK_MAX) : (s.mode === 'drift' || s.mode === 'side') ? s.ang : baseAng;
    s.ang = s.ang === null ? baseAng : s.ang + angTo(s.ang, want) * Math.min(1, dt * (s.mode === 'calm' ? 1.5 : 3.2));
    // when calm and the cat is well away, the displaced sheep creep home at grazing pace (~1 cm/s: never reads as sliding)
    if (s.mode === 'calm' && d > 4){ s.du *= 1 - Math.min(1, dt / 70); s.dv *= 1 - Math.min(1, dt / 70); }
    return s;
  }
  // row: 0 graze, 1 stand, 2 walk (alternating with 1 for the stride, like meadow.js)
  const rowOf = (s, baseRow) => (s.mode === 'drift' || s.mode === 'side') && s.sp > .15 ? (Math.sin(s.gait * 2) > 0 ? 2 : 1) : s.look > .5 ? 1 : baseRow;
  // the lamb: mum = index of the ewe it belongs to (its board position), returns the lamb's (u, v, angle, row)
  function stepLamb(mu, mv, cat, dt){
    const L = lamb; if (L.u === null){ L.u = mu + .42; L.v = mv + .18; L.ang = Math.PI; }
    L.cool = Math.max(0, L.cool - dt); L.t += dt;
    const ex = cat.u - L.u, ey = cat.v - L.v, d = Math.hypot(ex, ey) || 1e-3;
    if (L.mode === 'mum' && L.cool === 0 && d < 2.4 && cat.speed < 1.0) { L.mode = 'follow'; L.t = 0; }
    if (L.mode === 'follow' && (L.t > 5.5 || cat.speed > 2.2 || Math.hypot(cat.u - mu, cat.v - mv) > 4)){ L.mode = 'back'; L.cool = 18; }
    let tx, ty, keep;
    const HC = CAT_HC;
    if (L.mode === 'follow'){ tx = cat.u - ex / d * 1.25 * HC; ty = cat.v - ey / d * 1.25 * HC; keep = .25 * HC; /* r2: trail 0.75 Lc behind */
      if (cat.vu !== undefined){ /* VD r2 (screen space): split the 0.75 Lc trail point into screen-across (lat) and depth (al) about the cat, then push it across far
           enough that the lamb's on-screen box clears the cat's: cat half-extent across = 0.6 Lc × |facing·across| (body + tail) + 0.2 Lc, lamb half-width 0.25 Lc */
        const LC = 1.66 * HC, bx = tx - cat.u, by = ty - cat.v, al = bx * cat.vu + by * cat.vv, lat = bx * -cat.vv + by * cat.vu;
        const fl = Math.hypot(cat.fu || 0, cat.fv || 0) || 1, fx = Math.abs(((cat.fu || 0) * -cat.vv + (cat.fv || 0) * cat.vu) / fl);
        if (Math.abs(lat) > .3 * LC || !L.sg) L.sg = lat >= 0 ? 1 : -1;   // follow the tail side when it is clear, else keep the side it is on
        const lw = L.sg * Math.max((LAMB_CLR + .6 * fx + .2 + .25) * LC, Math.abs(lat)); tx = cat.u + cat.vu * al - cat.vv * lw; ty = cat.v + cat.vv * al + cat.vu * lw; } } 
    else { tx = mu + .42; ty = mv + .18; keep = .06; }
    const gx = tx - L.u, gy = ty - L.v, gd = Math.hypot(gx, gy);
    const top = L.mode === 'back' ? 1.0 : L.mode === 'follow' ? 1.5 : .35, lead = L.mode === 'follow' ? Math.min(cat.speed, 1.2) : 0;  // r2: it keeps pace with a walking cat
    L.sp = ease(L.sp, gd > keep ? Math.min(top, gd * (L.mode === 'follow' ? 2.4 : 1.5) + lead) : 0, L.mode === 'follow' ? 6 : 4, dt);
    if (gd > 1e-3){ const st = Math.min(gd, L.sp * dt); L.u += gx / gd * st; L.v += gy / gd * st; }
    if (L.mode === 'back' && gd < .1){ L.mode = 'mum'; L.sg = 0; }
    const want = L.sp > .08 ? Math.atan2(gy, gx) : L.mode === 'follow' ? Math.atan2(ey, ex) : L.ang;
    L.ang += angTo(L.ang, want) * Math.min(1, dt * 4); L.gait += dt * L.sp * 11;
    /* r2: a skip of 0.12 Hc every 0.35 s while it trots (phase runs only while moving, so it lands and stands still) */
    L.hopT = L.sp > .12 ? (L.hopT || 0) + dt / .35 : 0; const hop = L.sp > .12 ? .12 * HC * Math.abs(Math.sin(Math.PI * L.hopT)) : 0;
    const row = L.sp > .12 ? (Math.sin(L.gait * 2) > 0 ? 2 : 1) : L.mode === 'follow' ? 1 : (Math.sin(L.t * .4) > -.3 ? 0 : 1);
    return { u: L.u, v: L.v, ang: L.ang, row, hop };
  }
  return { S, lamb, step, rowOf, stepLamb };
}
