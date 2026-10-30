// 01 Sheep Meadow — b2 meadow brains, drawn as the replica's painted sheep folded into the home board frame
import * as THREE from '../../shared/vendor/three.module.js';
import { mulberry } from '../../artkit/ground.js';
import { reskin } from '../../artkit/clay.js';
import { createFlock } from '../../artkit/sprites.js';
import { createMeadow } from '../../b2-meadow/meadow.js';
import { R, note, safe } from '../core/util.js';
import { REG, F, meadowU } from '../world.js';
import { RIM } from '../props/trees.js';
import { heightAt as worldHeightAt } from './registry.js';
import { createSheepMinds, lcNow, hcNow } from '../animals/sheep.js';

const NSHOW = 14, WAN = .42, wander = (x) => WAN * Math.tanh(x / 7);
/* r5: 12 sheep each get a home spread over the whole default frame (FINAL17 scatters them across the board); b2's brain only adds a small wander around it */
const HOMES = (() => { const out = [], rr = mulberry(57); let k = 0;
  const ok = (u, v) => Math.abs(u - (-1.85 + .45 * Math.sin(v * .37))) > .85 && Math.abs(u - meadowU(v)) > .4 && Math.hypot(u - .3,
    v + 4.3) > .95 && out.every(([a, b]) => Math.hypot(a - u, b - v) > .95);
  while (out.length < NSHOW && k++ < 4000){ const u = -3.3 + rr() * 6.9,
    v = -6.3 + rr() * 5.7; if (ok(u, v) && RIM.every(([a, b]) => Math.hypot(a - u, b - v) > .75)) out.push([u, v]); } return out; })();

export function createMeadowRegion(scene){
  const m = safe('meadow', () => createMeadow(scene, { radius: R, R }, REG[0].dir));
  if (!m) return null;
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
  const MUM = HOMES.reduce((b, [a, c], i) => Math.abs(Math.hypot(a - .3, c + 4.3) - 1.3) < Math.abs(Math.hypot(HOMES[b][0] - .3, HOMES[b][1] + 4.3) - 1.3) ? i : b, 0);
  const flockList = [], life = { minds, flockList, ctx: null, r1: false };

  function update(dt, ctx){
    const { T, cat, fcam, sd, ground } = ctx; life.ctx = ctx; /* life: qa probes can step the flock with the live ctx */
    const [cu2, cv2] = F.toUV(cat.up); for (const q of m.sheep) if (q.u0 === undefined){ q.u0 = q.u; q.v0 = q.v; }
    { const [fu, fv] = F.toUV(cF.copy(cat.up).multiplyScalar(R).addScaledVector(cat.fwd, .2)), du = fu - cu2, dv = fv - cv2, l = Math.hypot(du, dv) || 1;
      CAT.u = cu2; CAT.v = cv2; CAT.fu = du / l; CAT.fv = dv / l; CAT.speed = cat.speed || 0;
      /* life r2: the camera's view direction on the board (where 'behind a sheep' is) */
      if (life.r1) CAT.vu = undefined; else if (fcam && fcam.yaw){ const [gu, gv] = F.toUV(cF.copy(cat.up).multiplyScalar(R).addScaledVector(fcam.yaw, .2)), wu = gu - cu2, wv = gv - cv2, wl = Math.hypot(wu, wv) || 1; CAT.vu = wu / wl; CAT.vv = wv / wl; } }
    /* the cat is mapped into b2 space through the nearest sheep home, so that sheep still shies away */
    let bi = 0, bd = 1e9; HOMES.forEach(([a, b], i) => { const d = Math.hypot(a - cu2, b - cv2); if (d < bd){ bd = d; bi = i; } });
    const q0 = m.sheep[bi], fake = m.dirOf(q0.u0 + (cu2 - HOMES[bi][0]) * 9, q0.v0 + (cv2 - HOMES[bi][1]) * 9).multiplyScalar(R + 0.3);
    m.update(dt * 2, T, fake);
    if (!flock) return;
    m.sheep.forEach((s, i) => { const L = flockList[i] || (flockList[i] = { dir: new THREE.Vector3(), fwd: new THREE.Vector3(), row: 1, scale: .6, h: 0 });
      const H0 = HOMES[i] || HOMES[0], du = wander(s.u - s.u0), dv = wander(s.v - s.v0);
      const k = minds.step(i, H0[0] + du, H0[1] + dv, s.heading, CAT, dt), pu = H0[0] + du + k.du, pv = H0[1] + dv + k.dv; /* life: notice / drift / look back */
      F.dirOf(pu, pv, L.dir); const a = F.dirOf(pu + Math.cos(k.ang) * .05, pv + Math.sin(k.ang) * .05);
        L.fwd.subVectors(a, L.dir).normalize();
      L.h = worldHeightAt(L.dir); L.scale = i < NSHOW ? .78 * KH() * (s.size || 1) : 0; /* r8 review #4: FINAL17 body size; life r2 (VD #1): 1.5–1.6 Lc */
      L.row = minds.rowOf(k, s.state === 'graze' && (s.speed || 0) < .1 ? 0 : (s.speed || 0) > .2 ? (Math.sin((s.gait || 0) * 2) > 0 ? 2 : 1) : 1); });
    { const n = m.sheep.length, L = flockList[n] || (flockList[n] = { dir: new THREE.Vector3(), fwd: new THREE.Vector3(), row: 0, scale: .4, h: 0 });
      const mu = minds.S[MUM], q = m.sheep[MUM], H0 = HOMES[MUM], b = minds.stepLamb(H0[0] + wander(q.u - q.u0) + mu.du, H0[1] + wander(q.v - q.v0) + mu.dv, CAT, dt);
      F.dirOf(b.u, b.v, L.dir); L.fwd.subVectors(F.dirOf(b.u + Math.cos(b.ang) * .05, b.v + Math.sin(b.ang) * .05), L.dir).normalize();
      L.h = worldHeightAt(L.dir) + b.hop; L.scale = LAMB * KH(); L.row = b.row; }
    /* life r2: draw far → near by the sprite's bottom edge */
    const cam = fcam && fcam.camera; if (cam) OCC.camP.setFromMatrixPosition(cam.matrixWorld);
    const order = OCC.order; order.length = 0; for (let i = 0; i < flockList.length; i++){ order.push(i); flockList[i]._z = cam ? OCC.p.copy(flockList[i].dir).multiplyScalar(R + flockList[i].h).distanceToSquared(OCC.camP) : 0; }
    if (!life.r1) order.sort((a, b) => flockList[b]._z - flockList[a]._z); const drawList = OCC.dl || (OCC.dl = []); drawList.length = 0; for (const i of order) drawList.push(flockList[i]);
    flock.update(drawList, fcam.yaw, fcam.board.X, sd);
    if (cam && !life.r1) occlusion(dt, cat, cam, order); /* life.r1 = true: qa switch that replays the r1 behaviour for before/after frames */
    // grazed turf trails the flock: each sheep's patch creeps after it (~25 s lag), stronger while it grazes
    const GZu = ground.uGraze.value, kz = 1 - Math.exp(-dt / 25);
    flockList.forEach((L, i) => { if (i >= 14) return; const g = GZu[i], tx = L.dir.x * R, ty = L.dir.y * R, tz = L.dir.z * R;
      if (g.w === 0) g.set(tx, ty, tz, 1); else { g.x += (tx - g.x) * kz; g.y += (ty - g.y) * kz; g.z += (tz - g.z) * kz; } });
  }
  /* life r2: screen-space occlusion of the cat by each sprite (rect overlap / cat rect), with the dissolve state machine */
  /* sprite scales were set against the 0.281 m calibration cat: they follow the live CAT_HC (= Hc-only sizing) */
  const KH = () => hcNow() / .281;
  const LAMB = .45, SR = new THREE.Vector3(), PT = new THREE.Vector3(), rect = (base, up, hw, h, cam, out) => { let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
    for (const [sx, sy] of [[-1, 0], [1, 0], [-1, 1], [1, 1]]){ PT.copy(base).addScaledVector(SR, sx * hw).addScaledVector(up, sy * h).project(cam); x0 = Math.min(x0, PT.x); x1 = Math.max(x1, PT.x); y0 = Math.min(y0, PT.y); y1 = Math.max(y1, PT.y); }
    out[0] = x0; out[1] = x1; out[2] = y0; out[3] = y1; return out; }, RC = [0, 0, 0, 0], RS = [0, 0, 0, 0], BS = new THREE.Vector3();
  function occlusion(dt, cat, cam, order){
    SR.setFromMatrixColumn(cam.matrixWorld, 0).normalize(); const cd = cat.root.position.distanceTo(OCC.camP);
    rect(cat.root.position, cat.up, lcNow() * .5, hcNow(), cam, RC); const ca = Math.max(1e-6, (RC[1] - RC[0]) * (RC[3] - RC[2]));
    const g = flock.mesh.geometry.attributes.aAlpha; let dirty = false;
    order.forEach((i, j) => { const L = flockList[i]; BS.copy(L.dir).multiplyScalar(R + L.h);
      let f = 0; if (L.scale > 0 && BS.distanceTo(OCC.camP) < cd - .05){ rect(BS, L.dir, L.scale * .42, L.scale * .78, cam, RS);
        const ox = Math.max(0, Math.min(RC[1], RS[1]) - Math.max(RC[0], RS[0])), oy = Math.max(0, Math.min(RC[3], RS[3]) - Math.max(RC[2], RS[2])); f = ox * oy / ca; }
      OCC.frac[i] = f; OCC.t[i] = f > .3 ? (OCC.t[i] || 0) + dt : 0;
      const want = OCC.t[i] > .4 ? .58 : (f > .3 && (OCC.a[i] ?? 1) < .99 ? .58 : 1), a0 = OCC.a[i] ?? 1;
      const a = want < a0 ? Math.max(want, a0 - dt * .55 / .3) : Math.min(want, a0 + dt * .55 / .5); OCC.a[i] = a;
      if (g.getX(j) !== a){ g.setX(j, a); dirty = true; } });
    if (dirty) g.needsUpdate = true; }
  life.occ = OCC;
  const hP = new THREE.Vector3();
  return { id: 'meadow', no: REG[0].no, name: REG[0].name, dir: REG[0].dir, cardRadius: 12, activeRadius: 150, scale: 1, group: m.group, module: m, flock, life, /* life: exposed for the qa probes */
    heightAt(d){ const x = d.angleTo(REG[0].dir) * R; return x < 70 ? m.heightAt(hP.copy(d).multiplyScalar(R)) - R : 0; },
    blocked: null, update,
    setActive(on){ m.group.visible = on; if (flock){ flock.mesh.visible = on; if (flock.shadow) flock.shadow.visible = on; } },
    teleport: { u: 0.3, v: -4.3, lookAt: null } };
}
