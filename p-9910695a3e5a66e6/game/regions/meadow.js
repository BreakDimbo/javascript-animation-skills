// 01 Sheep Meadow — b2 meadow brains, drawn as the replica's painted sheep folded into the home board frame
import * as THREE from '../../shared/vendor/three.module.js';
import { mulberry } from '../../artkit/ground.js';
import { reskin } from '../../artkit/clay.js';
import { createFlock } from '../../artkit/sprites.js';
import { createMeadow, MEADOW_PAINT_V } from '../../b2-meadow/meadow.js';
import { R, note, safe, qs } from '../core/util.js';
import { REG, F, meadowU } from '../world.js';
import { RIM } from '../props/trees.js';
import { heightAt as worldHeightAt } from './registry.js';
import { createSheepMinds, createKeepIn, KEEP, lcNow, hcNow } from '../animals/sheep.js';
import { BOARDU } from '../../artkit/bend.js';

let SHEEP_CELLS = null; fetch(new URL('../../artkit/tex/meta.json', import.meta.url)).then(r => r.json()).then(M => { SHEEP_CELLS = M.sheep.cells; }).catch(() => {});
const NSHOW = 9, WAN = .42, wander = (x) => WAN * Math.tanh(x / 7);
/* life r4 (review-vd-scale-1700 §1): 9 adults (+1 lamb) in 3 flocks of 4/3/2. Layout in board metres, checked in Hc at the a7 cat (0.349):
   sheep 1.9–2.1 Hc long; members ≥ 0.9 m apart (≈ 2.6 Hc centre to centre); nearest sheep of two flocks ≥ 2.1 m apart (≈ 6 Hc centre
   to centre = ≥ 4 Hc of grass between bodies); every home (and the lamb's) ≥ 1.45 m from the cat spawn (3 Hc + half a sheep). */
const SPAWN = [.3, -4.3], FLOCKS = [4, 3, 2];
/* life r5.2 (QA meadow 1955): homes are laid out inside the r5 keep-in of the arrival board (camrig yaw: board x = +u, y = +v; centre = spawn + 0.75 m
   along y; half-sizes 3.3 × 4.6), with room for the 0.42 m wander, and clear of the label strip (小站 sits far +u, so its label is on the right edge,
   cat row → BAND_D toward the camera), so no sheep is clamped or squeezed into a column on arrival; and 4–5 of the 9 graze left of the cat
   (the river leaves the left side narrow: it was 2 left / 7 right + lamb) */
const ARR = (() => { const hw = .5 * 1.18 * .3491 * 1.125 * KEEP.WMAX, xl = 3.3 - KEEP.RIM - KEEP.M_HC * .3491 - hw - .42;
  return { xl, cv: SPAWN[1] + .75, sx: 3.3 - KEEP.BAND_W - hw - .3, sy0: SPAWN[1] - KEEP.BAND_D - .3, sy1: SPAWN[1] + KEEP.DEPTH_HC * .3491 + .3 }; })();
const inArr = (u, v) => Math.abs(u - SPAWN[0]) < ARR.xl && Math.abs(v - ARR.cv) < 4.6 - 1 && !(u - SPAWN[0] > ARR.sx && v > ARR.sy0 && v < ARR.sy1);
/* life r6 (Deployer: a lower-left sheep stood on the painted hedge band, feet ≈ (−0.16, −5.96)–(0.06, −6.09)): the hedge line the board paints there,
   in board/fold (u, v) metres (the riverPath frame, F.dirOf), band half-width 0.08 m. Homes keep the band + a sheep radius + the full wander off it; the
   drawn spot (home + wander + mind + keep-in) is pushed out to band + sheep radius at run time. The hedge field itself is GPU-only (artkit/ground.js), so
   this line is hard-coded; re-take it if the board's hedges move. */
const HEDGES = [[[-.88, -5.30], [-.56, -5.46], [-.25, -5.77], [.03, -6.09], [.35, -6.31], [.63, -6.43], [.91, -6.43], [1.19, -6.37], [1.47, -6.31], [1.63, -6.27]]], HEDGE_HW = .08;
// nearest point of the hedge lines: [distance, nearest point u, v, left unit normal of that segment u, v, signed distance to its left, beyond an end (cap)]
const hedgeNear = (u, v) => { let d = 1e9, r = null;
  for (const H of HEDGES) for (let i = 1; i < H.length; i++){ const [a0, a1] = H[i - 1], [b0, b1] = H[i], dx = b0 - a0, dy = b1 - a1, tr = ((u - a0) * dx + (v - a1) * dy) / (dx * dx + dy * dy), t = Math.max(0, Math.min(1, tr));
    const qu = a0 + dx * t, qv = a1 + dy * t, l = Math.hypot(u - qu, v - qv); if (l < d){ const ll = Math.hypot(dx, dy), lu = -dy / ll, lv = dx / ll; d = l;
      r = [l, qu, qv, lu, lv, (u - qu) * lu + (v - qv) * lv, (i === 1 && tr < 0) || (i === H.length - 1 && tr > 1)]; } }
  return r; };
const sheepR = (H) => .5 * H;   // ground radius of a drawn sheep about its spot (feet ±0.13 m at the a7 cat; H = drawn height in m)
const HEDGE_HOME = HEDGE_HW + sheepR(1.18 * .3491 * 1.25) + .42;   // largest sheep (size 1.25) at the glb cat + the full wander (WAN)
/* run time: the spot a sheep would stand on (home + wander + mind) is slid clear of band + radius before the board keep-in sees it: each frame it
   walks from last frame's spot toward the new one in ≤ 2 cm steps, pushed out of the band after each, so it slides along the hedge or round its
   ends and never hops across. If the board's hard clamp then drags it onto the band anyway, it dissolves (hedgeFade, through the keep-in's alpha):
   the board wins, nothing jumps */
const hedgeLast = new Map();
const pushOut = (u, v, c) => { const [d, qu, qv, lu, lv] = hedgeNear(u, v); return d >= c ? null : d > 1e-6 ? [qu + (u - qu) / d * c, qv + (v - qv) / d * c] : [qu + lu * c, qv + lv * c]; };
const offHedge = (id, u, v, H) => { const c = HEDGE_HW + sheepR(H), L0 = hedgeLast.get(id); let p;
  if (!L0) p = pushOut(u, v, c) || [u, v];
  else { p = [L0[0], L0[1]]; for (let k = 0; k < 400; k++){ const du = u - p[0], dv = v - p[1], l = Math.hypot(du, dv); if (l < 1e-5) break;
    const st = Math.min(l, .02), q = [p[0] + du / l * st, p[1] + dv / l * st]; p = pushOut(q[0], q[1], c) || q; } }
  hedgeLast.set(id, p); return p; };
const HEDGE_FADE = [.02, .3];   // a dragged sheep starts to dissolve .02 m before its radius touches the band, gone .3 m later (≈ the leash fade rate)
const hedgeFade = (u, v, H) => Math.min(1, Math.max(0, (HEDGE_HW + sheepR(H) + HEDGE_FADE[0] - hedgeNear(u, v)[0]) / HEDGE_FADE[1]));
const okUV = (u, v) => hedgeNear(u, v)[0] > HEDGE_HOME && Math.abs(u - (-1.85 + .45 * Math.sin(v * .37))) > .85 && Math.abs(u - meadowU(v)) > .4 && Math.hypot(u - SPAWN[0], v - SPAWN[1]) > 1.45
  && u > -3.2 && u < 3.5 && v > -6.2 && v < -.7 && RIM.every(([a, b]) => Math.hypot(a - u, b - v) > .75) && inArr(u, v);
const { HOMES, GROUP } = (() => { const rr = mulberry(57);
  for (let tries = 0; tries < 400; tries++){ const out = [], grp = []; let fail = false;
    for (let g = 0; g < FLOCKS.length && !fail; g++){ let placed = 0, c = null;
      for (let k = 0; k < 300 && !c; k++){ const u = -3.2 + rr() * 6.7, v = -6.2 + rr() * 5.5;
        if (okUV(u, v) && out.every(([a, b]) => Math.hypot(a - u, b - v) > 2.1 + .9)) c = [u, v]; }
      if (!c){ fail = true; break; }
      for (let k = 0; k < 600 && placed < FLOCKS[g]; k++){ const r = placed ? .9 + rr() * .4 : 0, t = rr() * 6.283, u = c[0] + r * Math.cos(t) * (placed ? 1 : 0), v = c[1] + r * Math.sin(t) * (placed ? 1 : 0);
        if (placed && !out.some(([a, b], i) => grp[i] === g && Math.hypot(a - u, b - v) < 1.35)) continue;
        if (!okUV(u, v) || out.some(([a, b], i) => Math.hypot(a - u, b - v) < (grp[i] === g ? .9 : 2.1))) continue;
        out.push([u, v]); grp.push(g); placed++; }
      if (placed < FLOCKS[g]) fail = true; }
    if (!fail && out.some(([u, v]) => okUV(u + .42, v + .18)) && (([n]) => n >= 4 && n <= 5)([out.filter(([u]) => u < SPAWN[0]).length])) return { HOMES: out, GROUP: grp }; }
  throw new Error('meadow: no flock layout'); })();

// the pre-baked meadow ground (game/bake_meadow.py; json-only: this region hides the module's ground mesh); null → live paint
export async function loadMeadowBake(){ if (qs.has('livepaint')) return null;
  try { const json = await (await fetch('./baked/meadow_ground_2048.json')).json();
    if (json.v !== MEADOW_PAINT_V){ note(`meadow bake stale (${json.v} ≠ ${MEADOW_PAINT_V}) → live paint`); return null; }
    return { json };
  } catch (e){ note('meadow bake missing → live paint'); return null; } }

export function createMeadowRegion(scene, baked = null){
  const t0 = performance.now(), m = safe('meadow', () => createMeadow(scene, { radius: R, R }, REG[0].dir, { baked }));
  if (!m) return null; note(`meadow ground ${m.groundBaked ? 'baked' : 'live paint'}: ${Math.round(performance.now() - t0)} ms`);
  // hide the module ground (its palette was the mismatch) and the 3D hedge lumps; the board paints them
  m.ground.visible = false; m.group.traverse(o => { if (o.isInstancedMesh && o.count > 100 && o.geometry.attributes.position.count < 400) o.visible = false; });
  note(`meadow: ${reskin(m.group)} materials → clay`);
  // the flock: b2's sheep brains, drawn with the replica's painted sheep at the cat's size
  for (const s of m.sheep) s.root.visible = false;
  const flock = safe('flock', () => createFlock(scene, m.sheep.length + 1, R)); note(`flock: ${m.sheep.length} painted sheep + lamb`); /* life: +1 = the lamb */
  const minds = createSheepMinds(m.sheep.length, mulberry(91)), CAT = { u: 0, v: 0, fu: 1, fv: 0, speed: 0, vu: 1, vv: 0 }, cF = new THREE.Vector3();
  /* life r2 (VD #4): the sheep sprites keep alphaTest 0.5 (no soft edge to mis-sort) and are drawn in bottom-edge depth order; a sheep that hides > 30 % of the cat
     for > 0.4 s dissolves to 58 % in 0.3 s (VD r2) (blended; instances drawn far → near, depth still written) and comes back over 0.5 s. No outline, no x-ray. */
  if (flock){ const mat = flock.mesh.material, a = 'c.a *= vA; if (c.a < 0.50) discard;';
    const o = 'gl_FragColor = vec4(col, 1.0);';
    if (mat.fragmentShader.includes(a) && mat.fragmentShader.includes(o)){
      // the cut-out stays alphaTest .5 on the atlas alpha; aAlpha (1 except for a sheep covering the cat) becomes a plain blend factor.
      // Instances are drawn far → near (sorted below), so blending inside the one draw call stays in order; depth is still written.
      mat.fragmentShader = mat.fragmentShader.replace(a, 'if (c.a < 0.50) discard;').replace(o, 'gl_FragColor = vec4(col, vA);');
      mat.transparent = true; mat.depthWrite = true; mat.needsUpdate = true; }
    else note('meadow-life: flock shader changed, dissolve fallback off'); }
  const OCC = { a: [], t: [], frac: [], camP: new THREE.Vector3(), r: new THREE.Vector3(), p: new THREE.Vector3(), order: [] };
  /* life: the lamb's ewe = the home ~1.3 from the default spawn, so the first frame already has a lamb in it */
  const MUM = HOMES.reduce((b, [a, c], i) => !okUV(a + .42, c + .18) ? b : b < 0 || Math.hypot(a - SPAWN[0], c - SPAWN[1]) < Math.hypot(HOMES[b][0] - SPAWN[0], HOMES[b][1] - SPAWN[1]) ? i : b, -1); /* r4: the nearest ewe whose lamb spot is clear */
  const keep = createKeepIn(), KB = { on: false, cu: 0, cv: 0, Xu: 1, Xv: 0, Yu: 0, Yv: 1, hx: 3.3, hy: 4.6, band: null }, kbV = new THREE.Vector3(), kbBand = { s: 1, a: 0, x0: 0, y0: 0, y1: 0 };
  const flockList = [], life = { minds, keep, kb: KB, flockList, ctx: null, r1: false, homes: HOMES, group: GROUP, nshow: NSHOW, spawn: SPAWN };

  function update(dt, ctx){
    const { T, cat, fcam, sd, ground } = ctx; life.ctx = ctx; /* life: qa probes can step the flock with the live ctx */
    const [cu2, cv2] = F.toUV(cat.up); for (const q of m.sheep) if (q.u0 === undefined){ q.u0 = q.u; q.v0 = q.v; }
    { const [fu, fv] = F.toUV(cF.copy(cat.up).multiplyScalar(R).addScaledVector(cat.fwd, .2)), du = fu - cu2, dv = fv - cv2, l = Math.hypot(du, dv) || 1;
      CAT.u = cu2; CAT.v = cv2; CAT.fu = du / l; CAT.fv = dv / l; CAT.speed = cat.speed || 0;
      /* life r2: the camera's view direction on the board (where 'behind a sheep' is) */
      if (life.r1) CAT.vu = undefined; else if (fcam && fcam.camera){ const [gu, gv] = F.toUV(cF.copy(fcam.camera.position).normalize()), wu = cu2 - gu, wv = cv2 - gv, wl = Math.hypot(wu, wv); if (wl > 1e-4){ CAT.vu = wu / wl; CAT.vv = wv / wl; } }
      else if (fcam && fcam.yaw){ const [gu, gv] = F.toUV(cF.copy(cat.up).multiplyScalar(R).addScaledVector(fcam.yaw, .2)), wu = gu - cu2, wv = gv - cv2, wl = Math.hypot(wu, wv) || 1; CAT.vu = wu / wl; CAT.vv = wv / wl; } } // view = the rendered camera's foot → cat (board or follow cam); yaw only if no camera
    /* the cat is mapped into b2 space through the nearest sheep home, so that sheep still shies away */
    let bi = 0, bd = 1e9; HOMES.forEach(([a, b], i) => { const d = Math.hypot(a - cu2, b - cv2); if (d < bd){ bd = d; bi = i; } });
    const q0 = m.sheep[bi], fake = m.dirOf(q0.u0 + (cu2 - HOMES[bi][0]) * 9, q0.v0 + (cv2 - HOMES[bi][1]) * 9).multiplyScalar(R + 0.3);
    m.update(dt * 2, T, fake);
    if (!flock) return;
    /* life r5 (QA D3): this frame's camera board (bend.js BOARDU, the same rect foldBoardSD clips with) in board-(u, v) metres, and the wayfinding label's strip */
    { const Fb = BOARDU.F.value, Xb = BOARDU.X.value, Yb = BOARDU.Y.value; KB.on = Fb.w > 0;
      if (KB.on){ kbV.set(Fb.x, Fb.y, Fb.z).normalize(); const [cu, cv] = F.toUV(kbV); KB.cu = cu; KB.cv = cv;
        kbV.multiplyScalar(R); const [xu, xv] = F.toUV(cF.copy(kbV).addScaledVector(BOARDU.X.value, 1)), [yu, yv] = F.toUV(cF.copy(kbV).addScaledVector(BOARDU.Y.value, 1));
        let l = Math.hypot(xu - cu, xv - cv) || 1; KB.Xu = (xu - cu) / l; KB.Xv = (xv - cv) / l; l = Math.hypot(yu - cu, yv - cv) || 1; KB.Yu = (yu - cu) / l; KB.Yv = (yv - cv) / l;
        KB.hx = Xb.w; KB.hy = Yb.w;
        // the wayfinding label (ui/wayfinding.js; screen-space, on the paper margin where the ray cat → target leaves the board): when it sits on a
        // side edge, keep sheep out of the strip it is read over — BAND_W inside that edge, from the cat's row BAND_D toward the camera (loop group D4)
        const way = globalThis.__fold && globalThis.__fold.way, tg = way && way.target; let bOn = false, bS = 1, bY = 0;
        if (tg && tg.dir && (way.opacity ?? 1) > .02){ const up = cat.up; kbV.copy(tg.dir).addScaledVector(up, -tg.dir.dot(up)); if (kbV.lengthSq() < 1e-10) kbV.set(0, 0, 0); else kbV.normalize();
          const [tu, tv] = F.toUV(cF.copy(up).multiplyScalar(R).add(kbV)), [ccx, ccy] = keep.toB(cu2, cv2, KB), [ex, ey] = keep.toB(tu, tv, KB), dl = Math.hypot(ex - ccx, ey - ccy);
          if (dl > 1e-3){ const dx = (ex - ccx) / dl, dy = (ey - ccy) / dl; const tx = Math.abs(dx) > 1e-6 ? ((dx > 0 ? KB.hx : -KB.hx) - ccx) / dx : Infinity, ty = Math.abs(dy) > 1e-6 ? ((dy > 0 ? KB.hy : -KB.hy) - ccy) / dy : Infinity;
            if (tx <= ty && tx > 0){ bOn = true; bS = dx > 0 ? 1 : -1; bY = ccy; } } }
        // the strip eases in/out over ~1 s (and swaps sides only once faded), so a label appearing or moving never shoves a sheep
        if (bOn && (kbBand.a === 0 || kbBand.s === bS)){ kbBand.s = bS; kbBand.y0 = bY - KEEP.BAND_D; kbBand.y1 = bY; kbBand.a = Math.min(1, kbBand.a + dt); } else kbBand.a = Math.max(0, kbBand.a - dt);
        kbBand.x0 = KB.hx - KEEP.BAND_W; KB.band = kbBand.a > 0 ? kbBand : null; } }
    const HC_ = hcNow(), LC_ = lcNow();
    m.sheep.forEach((s, i) => { const L = flockList[i] || (flockList[i] = { dir: new THREE.Vector3(), fwd: new THREE.Vector3(), row: 1, scale: .6, h: 0 });
      const H0 = HOMES[i] || HOMES[0], du = wander(s.u - s.u0), dv = wander(s.v - s.v0);
      const k = minds.step(i, H0[0] + du, H0[1] + dv, s.heading, CAT, dt); /* life: notice / drift / look back */
      L.scale = i < NSHOW ? ADULT_K * hcNow() * (1 + ((s.size || 1) - 1) * .5) : 0;
      const [su, sv] = offHedge(i, H0[0] + du + k.du, H0[1] + dv + k.dv, L.scale), [pu, pv, ea, mv] = i < NSHOW ? keep.apply(i, su, sv, L.scale, KB, dt, HC_, LC_, hedgeFade) : [su, sv, 1, 0]; L.edgeA = ea; L.kmv = mv; /* r5: board keep-in */
      F.dirOf(pu, pv, L.dir); const a = F.dirOf(pu + Math.cos(k.ang) * .05, pv + Math.sin(k.ang) * .05);
        L.fwd.subVectors(a, L.dir).normalize();
      L.h = worldHeightAt(L.dir); L.scale = i < NSHOW ? ADULT_K * hcNow() * (1 + ((s.size || 1) - 1) * .5) : 0; /* r4 (VD scale 17:00): height 1.13–1.23 Hc, live CAT_HC, applied once */
      L.row = minds.rowOf(k, s.state === 'graze' && (s.speed || 0) < .1 ? 0 : (s.speed || 0) > .2 ? (Math.sin((s.gait || 0) * 2) > 0 ? 2 : 1) : 1);
      if (mv > .12){ L.kg = (L.kg || 0) + dt * mv * 9; L.row = Math.sin(L.kg * 2) > 0 ? 2 : 1; } }); /* r5: a sheep the keep-in moves walks */
    { const n = m.sheep.length, L = flockList[n] || (flockList[n] = { dir: new THREE.Vector3(), fwd: new THREE.Vector3(), row: 0, scale: .4, h: 0 });
      const mu = minds.S[MUM], q = m.sheep[MUM], H0 = HOMES[MUM], b = minds.stepLamb(H0[0] + wander(q.u - q.u0) + mu.du, H0[1] + wander(q.v - q.v0) + mu.dv, CAT, dt);
      const [lsu, lsv] = offHedge('lamb', b.u, b.v, LAMB_K * hcNow()), [lu, lv, la] = keep.apply('lamb', lsu, lsv, LAMB_K * hcNow(), KB, dt, HC_, LC_, hedgeFade); L.edgeA = la; /* r5: the lamb keeps in too (it only ever binds by its ewe: the follow caps sit by the cat, mid-board) */
      F.dirOf(lu, lv, L.dir); L.fwd.subVectors(F.dirOf(lu + Math.cos(b.ang) * .05, lv + Math.sin(b.ang) * .05), L.dir).normalize();
      L.h = worldHeightAt(L.dir) + b.hop; L.scale = LAMB_K * hcNow(); L.row = b.row; }
    /* life r2: draw far → near by the sprite's bottom edge */
    const cam = fcam && fcam.camera; if (cam) OCC.camP.setFromMatrixPosition(cam.matrixWorld);
    const order = OCC.order; order.length = 0; for (let i = 0; i < flockList.length; i++){ order.push(i); flockList[i]._z = cam ? OCC.p.copy(flockList[i].dir).multiplyScalar(R + flockList[i].h).distanceToSquared(OCC.camP) : 0; }
    if (!life.r1) order.sort((a, b) => flockList[b]._z - flockList[a]._z); const drawList = OCC.dl || (OCC.dl = []); drawList.length = 0; for (const i of order) drawList.push(flockList[i]);
    /* r4: the painted cells differ in how much of the k × k quad the sheep fills (h 0.63–0.80 of k by view). L.scale holds the wanted body height;
       k = height / (this frame's cell h), using the same view pick as artkit/sprites.js, so every view stands 1.10–1.25 Hc tall. The painted sheep is
       rounder than the VD's 1.9–2.1 Hc body: its width grows with how side-on it is (× 1 + 0.11 sin²(facing vs view); VD r3, was 0.2 |fwd·right|),
       front views stay as painted. */
    const CL = SHEEP_CELLS; for (const L of drawList){ const sz = L.fwd.dot(fcam.yaw), sx = L.fwd.dot(fcam.board.X), th = Math.atan2(-sz * .6, sx);
      const col = ((Math.round((Math.PI - th) / (Math.PI / 4)) % 8) + 8) % 8, ch = CL ? CL[L.row][col].h : .66; L._H = L.scale; L.scale = L.scale / ch; const s2 = sx * sx / Math.max(1e-6, sx * sx + sz * sz); L._sx = 1 + .11 * s2; }  /* VD r3: side-on ×1.11, sin² of the facing vs the view axis → 1.0 facing toward/away */
    flock.update(drawList, fcam.yaw, fcam.board.X, sd);
    { const g = flock.mesh.geometry.attributes.aSize; drawList.forEach((L, j) => { g.setXY(j, L.scale * L._sx, L.scale); L.scale = L._H; }); g.needsUpdate = true;
      /* r5: a sheep dissolving at the board edge takes its contact shadow with it (shadow quad shrinks with its alpha; at 0 both quads are gone) */
      const gsz = flock.shadow && flock.shadow.geometry.attributes.aSize; let sd2 = false;
      drawList.forEach((L, j) => { const ea = L.edgeA ?? 1; if (ea < 1){ if (gsz){ gsz.setXY(j, gsz.getX(j) * ea, gsz.getY(j) * ea); sd2 = true; } if (ea <= 0) g.setXY(j, 0, 0); } }); if (sd2) gsz.needsUpdate = true; }
    if (cam && !life.r1) occlusion(dt, cat, cam, order);
    else { const g = flock.mesh.geometry.attributes.aAlpha; let dd = false; drawList.forEach((L, j) => { const aa = L.edgeA ?? 1; if (g.getX(j) !== aa){ g.setX(j, aa); dd = true; } }); if (dd) g.needsUpdate = true; } /* life.r1 = true: qa switch that replays the r1 behaviour for before/after frames */
    // grazed turf trails the flock: each sheep's patch creeps after it (~25 s lag), stronger while it grazes
    const GZu = ground.uGraze.value, kz = 1 - Math.exp(-dt / 25);
    flockList.forEach((L, i) => { if (i >= 14) return; const g = GZu[i]; if (i >= NSHOW){ g.w = 0; return; } /* r4: hidden b2 sheep graze nothing */ const _g = g, tx = L.dir.x * R, ty = L.dir.y * R, tz = L.dir.z * R;
      if (g.w === 0) g.set(tx, ty, tz, 1); else { g.x += (tx - g.x) * kz; g.y += (ty - g.y) * kz; g.z += (tz - g.z) * kz; } });
  }
  /* life r2: screen-space occlusion of the cat by each sprite (rect overlap / cat rect), with the dissolve state machine */
  /* r4: sprite sizes are in Hc from the live CAT_HC (hcNow), applied once */
  /* r4: L.scale = the sheep's body height in Hc (× the live CAT_HC exactly once — no .281 ratio on top); the quad is sized from it per view below.
     LAMB (quad size, for the lamb's occlusion rect) uses the side cell */
  const ADULT_K = 1.18, LAMB_K = .72, LAMB = LAMB_K / .66, SR = new THREE.Vector3(), PT = new THREE.Vector3(), rect = (base, up, hw, h, cam, out) => { let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
    for (const [sx, sy] of [[-1, 0], [1, 0], [-1, 1], [1, 1]]){ PT.copy(base).addScaledVector(SR, sx * hw).addScaledVector(up, sy * h).project(cam); x0 = Math.min(x0, PT.x); x1 = Math.max(x1, PT.x); y0 = Math.min(y0, PT.y); y1 = Math.max(y1, PT.y); }
    out[0] = x0; out[1] = x1; out[2] = y0; out[3] = y1; return out; }, RC = [0, 0, 0, 0], RS = [0, 0, 0, 0], BS = new THREE.Vector3();
  function occlusion(dt, cat, cam, order){
    SR.setFromMatrixColumn(cam.matrixWorld, 0).normalize(); const cd = cat.root.position.distanceTo(OCC.camP);
    rect(cat.root.position, cat.up, lcNow() * .5, hcNow(), cam, RC); const ca = Math.max(1e-6, (RC[1] - RC[0]) * (RC[3] - RC[2]));
    const g = flock.mesh.geometry.attributes.aAlpha; let dirty = false;
    order.forEach((i, j) => { const L = flockList[i]; BS.copy(L.dir).multiplyScalar(R + L.h);
      let f = 0; if (L.scale > 0 && BS.distanceTo(OCC.camP) < cd - .05){ rect(BS, L.dir, L.scale * .7, L.scale, cam, RS);
        const ox = Math.max(0, Math.min(RC[1], RS[1]) - Math.max(RC[0], RS[0])), oy = Math.max(0, Math.min(RC[3], RS[3]) - Math.max(RC[2], RS[2])); f = ox * oy / ca; }
      OCC.frac[i] = f; OCC.t[i] = f > .3 ? (OCC.t[i] || 0) + dt : 0;
      const want = OCC.t[i] > .4 ? .58 : (f > .3 && (OCC.a[i] ?? 1) < .99 ? .58 : 1), a0 = OCC.a[i] ?? 1;
      const a = want < a0 ? Math.max(want, a0 - dt * .55 / .3) : Math.min(want, a0 + dt * .55 / .5); OCC.a[i] = a;
      const aa = a * (L.edgeA ?? 1); /* r5: × the board keep-in fade */ if (g.getX(j) !== aa){ g.setX(j, aa); dirty = true; } });
    if (dirty) g.needsUpdate = true;
    /* life r3 (VD r2 #3): the following lamb measures its own on-screen overlap with the cat box (tail allowance ×1.3) and widens its across-screen offset
       until it is under ~8 % (target ≤ 15 %), easing back once clear */
    { const lb = minds.lamb, L = flockList[m.sheep.length]; if (lb && L){ let f = 0;
        if (lb.mode === 'follow'){ rect(cat.root.position, cat.up, lcNow() * .65, hcNow() * 1.15, cam, RC); const c2 = Math.max(1e-6, (RC[1] - RC[0]) * (RC[3] - RC[2]));
          BS.copy(L.dir).multiplyScalar(R + L.h); rect(BS, L.dir, L.scale * .7, L.scale, cam, RS);
          f = Math.max(0, Math.min(RC[1], RS[1]) - Math.max(RC[0], RS[0])) * Math.max(0, Math.min(RC[3], RS[3]) - Math.max(RC[2], RS[2])) / c2; }
        lb.clr = Math.max(0, Math.min(1.2, (lb.clr || 0) + (f > .08 ? dt * 1.2 : f === 0 ? -dt * .15 : 0))); lb.ovf = f; } } }
  life.occ = OCC;
  const hP = new THREE.Vector3();
  return { id: 'meadow', no: REG[0].no, name: REG[0].name, dir: REG[0].dir, cardRadius: 12, activeRadius: 150, scale: 1, group: m.group, module: m, flock, life, /* life: exposed for the qa probes */
    heightAt(d){ const x = d.angleTo(REG[0].dir) * R; return x < 70 ? m.heightAt(hP.copy(d).multiplyScalar(R)) - R : 0; },
    blocked: null, update,
    setActive(on){ m.group.visible = on; if (flock){ flock.mesh.visible = on; if (flock.shadow) flock.shadow.visible = on; } },
    teleport: { u: 0.3, v: -4.3, lookAt: null } };
}
