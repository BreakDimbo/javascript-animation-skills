// 动物互动 · mill: hens scatter a few hops from a running cat, the donkey lifts its head and turns head + ears to watch,
// the dormouse peeks from the sacks while all is quiet and ducks back in when the cat comes close.
// Everything works in the b4 mill's own local metres (before the MS shrink); the cat comes in as { x, z, speed, sitting }.
import * as THREE from '../../shared/vendor/three.module.js';
import { CAT_HC } from '../catScale.js';
import { createBirdSpace } from './birdspace.js';
import { F, millLocal, loopPath, MILL_AT, MILL_APRON, millAt } from '../world.js';

const ease = (a, b, k, dt) => a + (b - a) * (1 - Math.exp(-k * dt));
const angTo = (a, b) => Math.atan2(Math.sin(b - a), Math.cos(b - a));
const clamp = THREE.MathUtils.clamp;

// ---------- hens (built here: the b4 mill has none) ----------
/* r2 (VD review §3): 2 russet #9a5a3c with #b07650 breasts, 1 cream #ece3cf, 1 dark brown #6b4632; comb #b5473a, beak + legs #d9a24a (all saturation ≤ .45) */
const HEN = [{ body: '#9a5a3c', dark: '#82492f', breast: '#b07650' }, { body: '#ece3cf', dark: '#d3c6aa', breast: '#f1eadb' }, { body: '#9a5a3c', dark: '#82492f', breast: '#b07650' }, { body: '#6b4632', dark: '#573829', breast: '#7d5640' }];
export function makeHen(c){
  const L = (h) => new THREE.MeshLambertMaterial({ color: h });
  const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
  const torso = new THREE.Mesh(new THREE.SphereGeometry(.3, 14, 10).scale(.9, .82, 1.22), L(c.body)); torso.position.y = .42; body.add(torso);
  const breast = new THREE.Mesh(new THREE.SphereGeometry(.2, 12, 9).scale(1.05, 1, .8), L(c.breast)); breast.position.set(0, .4, .2); body.add(breast);
  const tail = new THREE.Mesh(new THREE.SphereGeometry(.17, 10, 8).scale(.55, 1.1, .7), L(c.dark)); tail.position.set(0, .66, -.3); tail.rotation.x = -.5; body.add(tail);
  const wings = [-1, 1].map(s => { const w = new THREE.Group(); w.position.set(s * .25, .5, -.02); body.add(w);
    const m = new THREE.Mesh(new THREE.SphereGeometry(.16, 10, 8).scale(.35, .7, 1.25), L(c.dark)); m.position.set(0, -.04, -.04); w.add(m); return w; });
  const head = new THREE.Group(); head.position.set(0, .66, .26); body.add(head);
  const skull = new THREE.Mesh(new THREE.SphereGeometry(.13, 12, 9), L(c.body)); skull.position.set(0, .1, .06); head.add(skull);
  const comb = new THREE.Mesh(new THREE.SphereGeometry(.055, 8, 6).scale(.45, 1, 1.4), L('#b5473a')); comb.position.set(0, .23, .06); head.add(comb);
  const wattle = new THREE.Mesh(new THREE.SphereGeometry(.03, 6, 5).scale(.6, 1.2, .8), L('#b5473a')); wattle.position.set(0, 0, .16); head.add(wattle);
  const beak = new THREE.Mesh(new THREE.ConeGeometry(.04, .11, 6), L('#d9a24a')); beak.rotation.x = Math.PI / 2; beak.position.set(0, .08, .22); head.add(beak);
  for (const s of [-1, 1]){ const e = new THREE.Mesh(new THREE.SphereGeometry(.018, 6, 5), L('#2e1c10')); e.position.set(s * .1, .13, .12); head.add(e); }
  const legs = [-1, 1].map(s => { const l = new THREE.Mesh(new THREE.CylinderGeometry(.022, .02, .2, 5), L('#d9a24a')); l.position.set(s * .09, .1, 0); root.add(l); return l; });
  root.traverse(o => { if (o.isMesh) o.castShadow = true; });
  return { root, body, head, wings, legs };
}

// contact shade = the cat's own technique (artkit/cat.js r8 #3): radial canvas alpha (1 → .55 at 55 % → 0), #24390f, opacity .42, polygon offset, no fog.
// Ellipse at 1.3× the footprint; airborne it fades and shrinks, reaching 60 % opacity at 0.25 Hc of lift.
let SH_TEX = null;
function shadeTex(){ if (SH_TEX) return SH_TEX; const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(.55, 'rgba(255,255,255,.55)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  SH_TEX = new THREE.CanvasTexture(c); SH_TEX.colorSpace = THREE.SRGBColorSpace; return SH_TEX; }
const SH_GEO = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
export function makeShade(w, l){ const o = new THREE.Mesh(SH_GEO, new THREE.MeshBasicMaterial({ color: 0x24390f, alphaMap: shadeTex(), transparent: true, opacity: .42, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, fog: false }));
  o.scale.set(w, 1, l); o.renderOrder = 1; o.castShadow = o.receiveShadow = false; o.userData.w = w; o.userData.l = l; return o; }
export function liftShade(o, lift, hc){ const k = Math.min(1, Math.max(0, lift) / (.25 * hc)); o.material.opacity = .42 * (1 - .4 * k); const sc = 1 - .25 * k; o.scale.set(o.userData.w * sc, 1, o.userData.l * sc); }

/* sizes in the cat's standing height (VD 14:58: Hc only, CAT_HC fallback 0.281 m); the mill works in b4 metres = world / MS */
// CAT_HC is the live binding from game/catScale.js (fallback 0.281); everything below is re-derived whenever it changes (the cat glb loads late)
const MS = .12, HOP_T = .3, RUN1 = 1.2 / MS;
let HC_AT = 0, HCL = 0, HOP_UP = 0, HOP_X = 0, EXTRA = 0;   // 1 Hc in mill-local metres (≈ 2.34 at 0.281); VD §2 hens (Lc → Hc × 1.66)
function hcSync(){ if (HC_AT === CAT_HC) return false; HC_AT = CAT_HC; HCL = CAT_HC / MS; HOP_UP = .25 * HCL; HOP_X = .58 * HCL; EXTRA = 1.33 * HCL; return true; }
/* r5 (QA #21): hen footprint ellipse in Hc, measured from the mesh verts in every pose (rest x ±.193 z −.391…+.483; hop wings open x ±.227 z −.544…+.302;
   peck z …+.490): centre .03 behind the root, half-length .55, half-width .265 — contains the drawn hen in all poses. Gap between any two outlines ≥ 0.30 Lc. */
const HEN_E = { c: -.03, hl: .55, hw: .265 }, GAP_LC = .30, LC = 1.66;
// keep-outs in b4 metres: the windmill (r6, follows world.js MILL_AT: tower base 2.6 × s, the door + apron strip out to 3.6 × s, the low sail sweep in front of it),
// the cottage walls + roof eaves (5 × 4 box, eaves to ±2.7 × ±2.35, yaw −0.5), the sack pile (r4: d-gatefix 4fe5652's 5 flat sacks, one box, see PILE),
// the dormouse while it is out (ellipse), the grazing donkey (body ellipse at 1.6×),
// and the loop lane + the mill spur to the door apron (world.js loopPath / MILL_APRON, half width belts.js HW)
// the grazing donkey (body ellipse at 1.6×), and the loop lane (world.js loopPath, half width 0.9 board m = 7.5 b4 m)
const HX = -10, HZ = 3, SX = -2.2, SZ = 9.6, LANE_HALF = (.105 + .02) / MS; /* belts.js HW .105 board m (+ .02 rim) = 1.04 b4 m */
/* r4 (d-gatefix 4fe5652): the pile is 5 burlap sacks lying along z, 3-2 (bottom x −.93 / .05 / 1.03, top −.44 / .54; 1.0 wide × 1.65 long),
   sacks-local box x −1.44…1.54, z −1.23…+.59, top 1.31. Ground keep-out = that box + .04 (as the old r .38 + .04 circles). */
const PILE = { x0: -1.44, x1: 1.54, z0: -1.23, z1: .59, pad: .04 };
hcSync();

export function createMillLife(m, { hens: henAt = [], donkeyAt = [0, 0, 0], sackAt = [-2.1, 9.8], reskin } = {}){
  const grp = new THREE.Group(); m.group.add(grp);
  // hens: 0.83 Hc long, 0.6 Hc to the comb (base model .92 × .95 local)
  const rnd = Math.random, HS = [0, 0, 0], hsSet = () => { HS[0] = HS[1] = .6 * HCL / .95; HS[2] = .83 * HCL / .92; }; hsSet();
  const hens = henAt.map(([x, z], i) => { const h = makeHen(HEN[i % HEN.length]); h.root.scale.set(HS[0], HS[1], HS[2]); grp.add(h.root);
    h.shade = makeShade(.54 * HS[0] * 1.3, .8 * HS[2] * 1.3); grp.add(h.shade);
    return { ...h, x, z, hx: x, hz: z, c: HEN_E.c * HCL, hl: HEN_E.hl * HCL, hw: HEN_E.hw * HCL, yaw: rnd() * 6.28, mode: 'peck', t: rnd() * 3, hop: 0, hops: 0, hopA: 0, cool: 0, peck: rnd() * 9, look: 0, delay: 0, extra: 0, hy: 0, air: 0 }; });
  if (reskin) reskin(grp);

  // donkey: the module's own model, re-posed here (it stands grazing by the yard instead of circling the 40 m loop)
  const D = m.donkey, dbody = D.children[0], head = dbody.children.find(o => o.isGroup && o.children.some(c => c.isMesh && c.geometry.type === 'SphereGeometry'));
  const ears = head ? head.children.filter(o => o.isMesh && o.geometry.type === 'ConeGeometry') : [];
  const legs = dbody.children.filter(o => o.isGroup && o !== head);
  /* r2: neck, mane and head hang from one pivot at the withers, so the mane follows the head turn (the b4 mane sat on the body) */
  const neckPivot = new THREE.Group(); neckPivot.position.set(0, 1.06, .45); dbody.add(neckPivot); D.updateMatrixWorld(true);
  for (const o of dbody.children.filter(o => o.isMesh && (o.geometry.type === 'CylinderGeometry' && Math.abs(o.position.z - .65) < 1e-3 || o.geometry.type === 'BoxGeometry' && Math.abs(o.position.z - .62) < 1e-3))) neckPivot.attach(o);
  if (head) neckPivot.attach(head);
  D.scale.setScalar(1.6); /* at the mill's 0.12 shrink the b4 donkey stood shorter than the cat */
  const dk = { x: donkeyAt[0], z: donkeyAt[1], yaw: donkeyAt[2], watch: 0, hy: 0, hp: .65, near: 0, gait: 0, turn: 0 };
  const ear0 = ears.map(e => e.rotation.clone());
  const dShade = makeShade(.8 * 1.6 * 1.3, 1.6 * 1.6 * 1.3); grp.add(dShade);

  // r5 (QA #21): bird space — outline separation + keep-outs for the hens, every frame (see birdspace.js)
  const MGND = { x: 1e4, z: 1e4, yaw: 0, c: 0, hl: .01, hw: .01 };   // set by update() while the dormouse is out
  const sackProps = [(() => { const a = -.5, x = (PILE.x0 + PILE.x1) / 2, z = (PILE.z0 + PILE.z1) / 2;   // same frame() transform as the meshes (sacks yaw −0.5)
    return { kind: 'box', x: SX + x * Math.cos(a) + z * Math.sin(a), z: SZ - x * Math.sin(a) + z * Math.cos(a), yaw: a, hx: (PILE.x1 - PILE.x0) / 2 + PILE.pad, hz: (PILE.z1 - PILE.z0) / 2 + PILE.pad }; })(),
    // the dormouse's body on the ground while it is out (sacks-local → mill group, same transform); parked far off while it is in
    { kind: 'ellipse', get: () => MGND, cap: 0 }];   // cap set in spaceSync: .6 Hc/s
  const lane = { kind: 'poly', pts: [], half: LANE_HALF }, spur = { kind: 'poly', pts: [], half: LANE_HALF }; let laneAt = 0;
  // r6: the windmill moved with MILL_AT (loop r1.5): tower circle, door/apron strip (box along its facing), and the sail sweep — the blade tips pass
  // ~1.2–1.5 m (b4) off the ground, under a hen's 1.75 m comb, over a strip ±3.2 m wide just in front of the door; all re-read from MILL_AT
  const tower = { kind: 'circle', x: 0, z: 0, r: 2.6 }, apron = { kind: 'box', x: 0, z: 0, yaw: 0, hx: .6, hz: 1 }, sweep = { kind: 'box', x: 0, z: 0, yaw: 0, hx: 3.2, hz: .5 };
  function millSync(){ const A = MILL_AT || { x: 0, z: 0, yaw: .4, s: 1 }, s = A.s, fx = Math.sin(A.yaw), fz = Math.cos(A.yaw);
    Object.assign(tower, { x: A.x, z: A.z, r: 2.6 * s });
    Object.assign(apron, { x: A.x + fx * 1.8 * s, z: A.z + fz * 1.8 * s, yaw: A.yaw, hx: .6 * s + .1, hz: 1.8 * s });
    Object.assign(sweep, { x: A.x + fx * 2.7 * s, z: A.z + fz * 2.7 * s, yaw: A.yaw, hx: 3.8 * s, hz: .6 * s }); }
  function laneSync(){ // the loop lane near the mill + the spur to the door apron, in b4 metres (sampled late so the loop group's current path is the one used)
    millSync();
    try { const P = loopPath(), out = []; for (const [u, v] of P){ const [x, z] = millLocal(F.dirOf(u, v)); const bx = x / MS, bz = z / MS; if (hyp2(bx, bz) < 60) out.push([bx, bz]); } lane.pts = out;
      // spur exactly as belts.js draws it: from the loop point nearest the apron (board metres, < 8 m) straight to the apron
      spur.pts = []; if (MILL_APRON && millAt){ const [Au, Av] = F.toUV(millAt(...MILL_APRON)); let bi = 0, bd = 1e9; P.forEach((p, i) => { const d = Math.hypot(p[0] - Au, p[1] - Av); if (d < bd){ bd = d; bi = i; } });
        if (bd < 8){ const [x, z] = millLocal(F.dirOf(P[bi][0], P[bi][1])); spur.pts = [[x / MS, z / MS], [MILL_APRON[0], MILL_APRON[1]]]; spur.len = bd; } } } catch (e){ lane.pts = []; } }
  const hyp2 = Math.hypot;
  const props = [tower, apron, sweep, { kind: 'box', x: HX, z: HZ, yaw: -.5, hx: 2.7, hz: 2.35 }, ...sackProps,
    { kind: 'ellipse', get: () => ({ x: dk.x, z: dk.z, yaw: dk.yaw, c: .25, hl: 1.75, hw: .75 }) }, lane, spur];
  const space = createBirdSpace({ props });
  const spaceSync = () => { const g = GAP_LC * LC * HCL; space.set({ gap: g, soft: .3 * HCL, rate: .45 * HCL, pGap: g, propSoft: .4 * HCL }); sackProps[1].cap = .6 * HCL;
    for (const h of hens){ h.c = HEN_E.c * HCL; h.hl = HEN_E.hl * HCL; h.hw = HEN_E.hw * HCL; } };
  for (const h of hens) space.add(h);
  laneSync(); spaceSync();
  // spread the yard homes so two hens wandering 1.5 m from home toward each other still keep the gap, then start each hen at its home
  { const g = space.S.gap; space.set({ gap: g + 2 * 1.5 + .4 }); space.settle(80); for (const h of hens){ h.hx = h.x; h.hz = h.z; } space.set({ gap: g }); space.settle(20); }

  // dormouse: the module's mouse group, found by its body sphere. r2: body 0.5 Hc (+ 0.5 Hc tail), back #c58a52, belly #efe2c8, eyes #2e1c10
  let mouse = null; m.group.traverse(o => { if (!mouse && o.isMesh && o.geometry.type === 'SphereGeometry' && Math.abs((o.geometry.parameters.radius || 0) - .07) < 1e-6 && o.geometry.parameters.widthSegments === 12) mouse = o.parent; });
  let MSC = .5 * HCL / .23; const M = { k: 0, kt: 0, hist: [], st: 'in', t: 0, still: 0, side: 0, yaw: 0 };
  let mShade = null, mTail = null, mTail0 = null, mEars = [], sacks = null;
  /* the four ways out of the sack pile (sacks-local): front, back, the two ends. Each frame-while-hidden the one facing the camera and clear of the cottage is chosen.
     r4 (4fe5652 pile): e = the pile face (front z .59, back −1.23, ends x 1.54 / −1.44, ends on the middle row z −.27). The new pile has no gap between sacks,
     so the peek spot p = e + n·(MREAR·MSC + .04): MREAR .12 is how far the drawn body reaches behind its root (rear .091, and the ears-up rear-back
     pitch −.5 rad swings the body centre .034 back: rear .119; ±.5 rad sway only shortens it), so the body stands clear of the burlap and only the tail
     (behind the body) stays in the pile. Front / back sit .08 nearer (t): the box z faces are the pinched sack ends, lower than the body's rear. At MSC 1 that is ≈ the designer's front .75 / back −1.4 / ends 1.7, −1.6; at the live MSC (≈ 5.1 / 6.3 at
     Hc .281 / .3491) the front spot is z 1.16 / 1.31 (mesh-checked offline: no body vertex inside a sack, ≥ 2 cm at every side). Re-derived in resize(). */
  const MBODY = .091, MREAR = .12, SIDES = [{ e: [.05, PILE.z1], n: [0, 1], yaw: 0, t: .08 }, { e: [.05, PILE.z0], n: [0, -1], yaw: Math.PI, t: .08 }, { e: [PILE.x1, -.27], n: [1, 0], yaw: Math.PI / 2, t: 0 }, { e: [PILE.x0, -.27], n: [-1, 0], yaw: -Math.PI / 2, t: 0 }];
  const sidesSync = () => { for (const S of SIDES){ const o = MREAR * MSC + .04 - S.t; S.p = [S.e[0] + S.n[0] * o, .02, S.e[1] + S.n[1] * o]; } }; sidesSync();
  const vPeek = new THREE.Vector3(), vHide = new THREE.Vector3(), vCam = new THREE.Vector3(), vHouse = new THREE.Vector3(), vA = new THREE.Vector3();
  if (mouse){ sacks = mouse.parent; mouse.scale.setScalar(MSC); mouse.rotation.order = 'YXZ';
    mouse.traverse(o => { if (!o.isMesh || !o.material || !o.material.color) return; const r = o.geometry.parameters.radius; o.material = o.material.clone();
      if (r === .011) o.material.color.set('#2e1c10'); else if (r === .022){ o.material.color.set('#e0aa86'); mEars.push(o); }
      else if (r === .035){ o.material.color.set('#b47a48'); mTail = o; o.scale.z = 2.4 * 1.35; o.position.z = -.16; } else o.material.color.set('#c58a52'); });
    const belly = new THREE.Mesh(new THREE.SphereGeometry(.062, 12, 8).scale(1, .55, 1.15), new THREE.MeshLambertMaterial({ color: '#efe2c8' })); belly.position.set(0, .045, .01); mouse.add(belly); if (reskin) reskin(belly);
    if (mTail) mTail0 = mTail.position.clone();
    mShade = makeShade(.14 * MSC * 1.3, .3 * MSC * 1.3); sacks.add(mShade);
    vHouse.copy(m.surf(-10, 3, 1.6)); }
  const HOUSE_R = 3.6;

  /* r7 (QA #21, screen): from the live camera (cat.cam, world → b4-local x, z, h) every hen's silhouette is projected onto the view plane
     (lateral, depth·sin e + height·cos e) — the hull of its mesh box at its yaw, scale and hop lift — and kept ≥ SCR_GAP_HC from every other
     hen's and from the sack pile (+ the dormouse while it is out) and the donkey. Hens lined up along the view no longer stack on screen and
     none stands over/behind the white sacks. Soft drift inside SCR_SOFT, hard push along the gap gradient (rate-capped; outright for the first
     0.25 s with a camera); a hen pushed while idle takes its home along, so it does not wander back into the clash. */
  const SCR_GAP_HC = .3 + .1, SCR_SOFT_HC = .5, SCR_VMAX = .6 /* world m/s */, VIEW = { on: false, cx: 0, cz: 0, ch: 0, t: 0 };
  const _v = new THREE.Vector3(), _b = new THREE.Box3(), _m4 = new THREE.Matrix4();
  const _w = new THREE.Vector3(), toXZH = (p) => { const [x, z] = millLocal(_w.copy(p).normalize()); return [x, z, p.length() - (m.surf(x, z, 0).length())]; };   // group-space point → b4 x, z, height
  function boxPts(root, rel, out = []){ root.updateWorldMatrix(true, true); rel.updateWorldMatrix(true, false); _m4.copy(rel.matrixWorld).invert();
    root.traverse(o => { if (!o.isMesh || !o.visible) return; o.geometry.computeBoundingBox(); _b.copy(o.geometry.boundingBox).applyMatrix4(new THREE.Matrix4().multiplyMatrices(_m4, o.matrixWorld));
      for (const x of [_b.min.x, _b.max.x]) for (const y of [_b.min.y, _b.max.y]) for (const z of [_b.min.z, _b.max.z]) out.push(new THREE.Vector3(x, y, z)); }); return out; }
  // hen box in its own root frame (unscaled), from the mesh, once; donkey box in its frame (unscaled), once; the sack pile in b4 x, z, h, once
  const henBox = new THREE.Box3().setFromPoints(boxPts(hens[0] ? hens[0].root : new THREE.Group(), hens[0] ? hens[0].root : new THREE.Group()).concat([new THREE.Vector3()]));
  henBox.max.y += .12; // head raised when alert
  const dkBox = new THREE.Box3().setFromPoints(boxPts(D, D).concat([new THREE.Vector3()]));
  const sackPts = sacks ? (() => { const out = []; for (const o of sacks.children) if (o.isMesh && o !== mShade) boxPts(o, m.group, out); return out.map(toXZH); })() : [];
  const hull2 = (pts) => { pts.sort((a, b) => a[0] - b[0] || a[1] - b[1]); const cr = (O, A, B) => (A[0] - O[0]) * (B[1] - O[1]) - (A[1] - O[1]) * (B[0] - O[0]);
    const lo = [], up = []; for (const q of pts){ while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop(); lo.push(q); }
    for (let i = pts.length - 1; i >= 0; i--){ const q = pts[i]; while (up.length >= 2 && cr(up[up.length - 2], up[up.length - 1], q) <= 0) up.pop(); up.push(q); }
    return lo.slice(0, -1).concat(up.slice(0, -1)); };
  const segD = (p, a, b) => { const sx = b[0] - a[0], sy = b[1] - a[1], t = Math.max(0, Math.min(1, ((p[0] - a[0]) * sx + (p[1] - a[1]) * sy) / (sx * sx + sy * sy || 1e-12))); return Math.hypot(p[0] - a[0] - sx * t, p[1] - a[1] - sy * t); };
  const inPoly = (p, H) => { for (let i = 0; i < H.length; i++){ const a = H[i], b = H[(i + 1) % H.length]; if ((b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]) < 0) return false; } return true; };
  function polyGap(A, B){ // ≥ 0: edge distance; < 0: overlapping (minus the smaller of the two penetration estimates)
    if (A.some(p => inPoly(p, B)) || B.some(p => inPoly(p, A))){ let d = 1e9; for (const P of [[A, B], [B, A]]) for (const p of P[0]) if (inPoly(p, P[1])){ let e = 1e9; for (let i = 0; i < P[1].length; i++) e = Math.min(e, segD(p, P[1][i], P[1][(i + 1) % P[1].length])); d = Math.min(d, e); } return -d; }
    let d = 1e9; for (const [P, Q] of [[A, B], [B, A]]) for (const p of P) for (let i = 0; i < Q.length; i++) d = Math.min(d, segD(p, Q[i], Q[(i + 1) % Q.length])); return d; }
  /* r7.2: the true view at (x, z), built in group space from the camera point (VIEW.c) and m.surf's own axes — the old basis took the elevation
     as atan(h / d) in b4 x, z, h, which ignores the planet curving away under the far camera (same flaw the pond had: depth axis over-read) */
  const _P = new THREE.Vector3(), _ex = new THREE.Vector3(), _ez = new THREE.Vector3(), _eh = new THREE.Vector3(), _f = new THREE.Vector3(), _r = new THREE.Vector3(), _u = new THREE.Vector3();
  function basis(x, z){ _P.copy(m.surf(x, z, 0)); _ex.copy(m.surf(x + 1, z, 0)).sub(_P); _ez.copy(m.surf(x, z + 1, 0)).sub(_P); _eh.copy(m.surf(x, z, 1)).sub(_P);
    const s = 2 / (_ex.length() + _ez.length()); _f.subVectors(_P, VIEW.c).normalize(); _r.crossVectors(_f, _eh).normalize(); _u.crossVectors(_r, _f).normalize();
    return [_ex.dot(_r) * s, _ez.dot(_r) * s, _eh.dot(_r) * s, _ex.dot(_u) * s, _ez.dot(_u) * s, _eh.dot(_u) * s]; }
  const pr = (Bs, x, z, h) => [x * Bs[0] + z * Bs[1] + h * Bs[2], x * Bs[3] + z * Bs[4] + h * Bs[5]];
  function boxHull(Bs, bx, x, z, yaw, sx, sy, sz, lift){ const fx = Math.sin(yaw), fz = Math.cos(yaw), out = [];
    for (const lx of [bx.min.x * sx, bx.max.x * sx]) for (const lz of [bx.min.z * sz, bx.max.z * sz]) for (const ly of [bx.min.y * sy, bx.max.y * sy])
      out.push(pr(Bs, x + lx * fz + lz * fx, z - lx * fx + lz * fz, Math.max(0, ly + lift))); return hull2(out); }
  const henHull = (Bs, h, x = h.x, z = h.z) => boxHull(Bs, henBox, x, z, h.yaw, HS[0], HS[1], HS[2], h.air);
  let mousePts = [];
  function obstHulls(Bs){ const out = []; if (sackPts.length) out.push(hull2(sackPts.concat(mousePts).map(q => pr(Bs, q[0], q[1], q[2]))));
    out.push(boxHull(Bs, dkBox, dk.x, dk.z, dk.yaw, 1.6, 1.6, 1.6, 0)); return out; }
  function scrGapOf(h, x, z){ const Bs = basis(x, z), H = henHull(Bs, h, x, z); let g = 1e9;
    for (const o of hens) if (o !== h && Math.hypot(o.x - x, o.z - z) < 6 * HCL) g = Math.min(g, polyGap(H, henHull(Bs, o)));
    if (Math.hypot(x - SX, z - SZ) < 8 * HCL || Math.hypot(x - dk.x, z - dk.z) < 8 * HCL) for (const O of obstHulls(Bs)) g = Math.min(g, polyGap(H, O));
    return g; }
  function screenPass(dt, hard){ const need = SCR_GAP_HC * HCL, soft = SCR_SOFT_HC * HCL, e = .03 * HCL;
    for (const h of hens){ const g = scrGapOf(h, h.x, h.z); if (g >= need + soft) continue;
      let gx = (scrGapOf(h, h.x + e, h.z) - g) / e, gz = (scrGapOf(h, h.x, h.z + e) - g) / e; const gl = Math.hypot(gx, gz);
      if (gl < .05){ gx = Math.sin(h.yaw + 1.57); gz = Math.cos(h.yaw + 1.57); } else { gx /= gl; gz /= gl; }
      let q; if (g >= need){ if (!dt) continue; const f = 1 - (g - need) / soft; q = Math.min(h._skb, f * f * .25 * HCL * dt); }
      else { if (!hard) continue; q = Math.min(h._skb, (need - g) / Math.max(.3, gl)); }
      h._skb -= q; h.x += gx * q; h.z += gz * q;
      if (h.mode === 'peck' || h.mode === 'step' || h.mode === 'look' || h.mode === 'stand'){ h.hx += gx * q; h.hz += gz * q; } } }
  function viewSync(cat){ if (!cat.cam || !cat.cam.isVector3){ VIEW.on = false; VIEW.t = 0; return; }
    _v.copy(cat.cam); m.group.worldToLocal(_v); VIEW.c = (VIEW.c || new THREE.Vector3()).copy(_v); const [x, z, h] = toXZH(_v); VIEW.on = true; VIEW.cx = x; VIEW.cz = z; VIEW.ch = h;
    mousePts = mouse && mouse.visible && M.k > .05 ? boxPts(mouse, m.group).map(toXZH) : []; }
  function pickSide(camLocal){ // camLocal: camera position in sacks-local coordinates
    let best = 0, bs = -1e9; vHouse.copy(m.surf(-10, 3, 1.6)); m.group.localToWorld(vHouse); sacks.worldToLocal(vHouse);
    SIDES.forEach((S, i) => { vA.set(S.p[0], .4, S.p[2]); const dx = camLocal.x - vA.x, dy = camLocal.y - vA.y, dz = camLocal.z - vA.z, L = Math.hypot(dx, dy, dz) || 1;
      const face = (S.n[0] * dx + S.n[1] * dz) / L; // the mouth faces the camera
      const t = Math.max(0, (vHouse.x - vA.x) * dx / L + (vHouse.y - vA.y) * dy / L + (vHouse.z - vA.z) * dz / L);
      const px = vA.x + dx / L * t - vHouse.x, py = vA.y + dy / L * t - vHouse.y, pz = vA.z + dz / L * t - vHouse.z, blocked = Math.hypot(px, py, pz) < HOUSE_R ? 1 : 0;
      const sc = face - blocked * 2 + (i === 0 ? .05 : 0); if (sc > bs){ bs = sc; best = i; } });
    return best; }

  // live CAT_HC: re-size hens, their shades, the dormouse and its shade
  const reShade = (o, w, l) => { o.userData.w = w; o.userData.l = l; o.scale.set(w, 1, l); };
  function resize(){ hsSet(); spaceSync(); for (const h of hens){ h.root.scale.set(HS[0], HS[1], HS[2]); reShade(h.shade, .54 * HS[0] * 1.3, .8 * HS[2] * 1.3); }
    MSC = .5 * HCL / .23; sidesSync(); if (mouse){ mouse.scale.setScalar(MSC); if (mShade) reShade(mShade, .14 * MSC * 1.3, .3 * MSC * 1.3); } }
  function update(dt, cat, T){
    if (hcSync()) resize();
    // ----- hens -----
    let nearest = null, nd = 1e9; for (const h of hens){ const d = Math.hypot(h.x - cat.x, h.z - cat.z); if (d < nd){ nd = d; nearest = h; } }
    for (const h of hens){
      const ex = h.x - cat.x, ez = h.z - cat.z, d = Math.hypot(ex, ez) || 1e-3; h.cool = Math.max(0, h.cool - dt); h.t -= dt;
      if (h.mode !== 'hop' && h.mode !== 'wait' && h.mode !== 'run' && h.cool === 0 && (d < 4 || (d < 9 && cat.speed > 1.3))){
        // staggered take-off (0.1–0.25 s apart, nearest first), 2–3 hops; a cat running past within 1.2 m sends the nearest one a further 0.8 Lc
        h.mode = 'wait'; h.delay = d < 4 && h === nearest ? 0 : .1 + rnd() * .15 + (d - nd) * .02; h.hops = 2 + (rnd() < .5 ? 1 : 0); h.hop = 0;
        h.hopA = Math.atan2(ex, ez) + (rnd() - .5) * .9; h.cool = 2.6; h.extra = h === nearest && d < RUN1 && cat.speed > 1.3 ? EXTRA : 0;
        h.hopA = space.steer(h, h.hopA, HOP_X * h.hops + h.extra); }
      if (h.mode === 'wait'){ h.delay -= dt; if (h.delay <= 0) h.mode = 'hop'; }
      if (h.mode === 'hop' || h.mode === 'run'){ // r5: look 0.9 Hc ahead every frame and bend round a hen or a prop before reaching it (no push-out pops)
        const la = .9 * HCL; if (space.clearAt(h, h.x + Math.sin(h.hopA) * la, h.z + Math.cos(h.hopA) * la, h.hopA) < .1 * HCL){ const a = space.steer(h, h.hopA, la, .1 * HCL);
          if (space.clearAt(h, h.x + Math.sin(a) * la, h.z + Math.cos(a) * la, a) < 0){ h.extra = 0; if (h.mode === 'run') { h.mode = 'stand'; h.t = .4; } else h.hops = Math.min(h.hops, 1); } h.hopA = a; } }
      if (h.mode === 'hop'){
        h.hop += dt / HOP_T; h.yaw += angTo(h.yaw, h.hopA) * Math.min(1, dt * 16);
        const st = HOP_X * dt / HOP_T; h.x += Math.sin(h.hopA) * st; h.z += Math.cos(h.hopA) * st;
        if (h.hop >= 1){ h.hop = 0; h.hops--; h.hopA = space.steer(h, h.hopA + (rnd() - .5) * .5, HOP_X * Math.max(1, h.hops) + h.extra); if (h.hops <= 0){ if (h.extra > 0){ h.mode = 'run'; h.hopA = space.steer(h, h.hopA, h.extra); } else { h.mode = 'stand'; h.t = .4; } } } }
      else if (h.mode === 'run'){ const st = Math.min(h.extra, 5.2 * dt); h.extra -= st; h.x += Math.sin(h.hopA) * st; h.z += Math.cos(h.hopA) * st; h.yaw += angTo(h.yaw, h.hopA) * Math.min(1, dt * 10);
        if (h.extra <= 1e-3){ h.mode = 'stand'; h.t = .4; } }
      else if (h.mode === 'stand'){ if (h.t < 0){ h.mode = 'look'; h.t = 1.2; } }
      else if (h.mode === 'look'){ if (h.t < 0){ h.mode = 'peck'; h.t = 2 + rnd() * 3; } }
      else if (h.mode === 'step'){ const s = .55 * dt; h.x += Math.sin(h.yaw) * s; h.z += Math.cos(h.yaw) * s; if (h.t < 0){ h.mode = 'peck'; h.t = 2 + rnd() * 4; } }
      else if (h.t < 0){ // peck → a little step, drifting back toward the yard
        const bx = h.hx - h.x, bz = h.hz - h.z, far = Math.hypot(bx, bz);
        h.yaw = far > 1.5 ? Math.atan2(bx, bz) + (rnd() - .5) * .6 : h.yaw + (rnd() - .5) * 2.2; h.mode = 'step'; h.t = .5 + rnd() * .6;
        h.yaw = space.steer(h, h.yaw, .55 * h.t, .15 * HCL); }
      const air = h.mode === 'hop' ? Math.sin(Math.PI * h.hop) : 0; h.air = air * HOP_UP;
      h.body.rotation.x = h.mode === 'hop' ? -.25 * air : h.mode === 'run' ? -.3 : 0;
      for (const [i, w] of h.wings.entries()) w.rotation.z = (i ? -1 : 1) * -(h.mode === 'hop' ? .7 * Math.sin(Math.PI * h.hop) : h.mode === 'run' ? .35 : 0); // 40° open, one beat per hop
      h.peck += dt;
      const pk = h.mode === 'peck' ? Math.max(0, Math.sin(h.peck * 5.5)) * (Math.sin(h.peck * .9) > 0 ? 1 : 0) : 0;
      const alert = h.mode === 'look' || h.mode === 'stand' || h.mode === 'hop' || h.mode === 'run' || h.mode === 'wait'; h.look = ease(h.look, alert ? 1 : 0, 7, dt);
      // head to the cat, ≤ 70° off the body line, held 1.2 s
      h.hy = ease(h.hy, h.mode === 'look' ? clamp(angTo(h.yaw, Math.atan2(-ex, -ez)), -1.22, 1.22) : 0, 8, dt);
      h.head.rotation.set(pk * .95 - h.look * .2, h.hy, 0); h.head.position.y = .66 + h.look * .1;
      const lg = h.mode === 'step' ? Math.sin(T * 18) * .35 : h.mode === 'run' ? Math.sin(T * 34) * .6 : 0; h.legs[0].rotation.x = lg; h.legs[1].rotation.x = -lg;
    }
    // r5: separation + keep-outs after all hens have moved, then seat the meshes
    if (++laneAt % 300 === 0) laneSync();
    space.solve(Math.min(dt, .1));
    viewSync(cat); if (VIEW.on && hens.length){ VIEW.t += dt; const first = VIEW.t < .25; for (const h of hens) h._skb = first ? 1e9 : SCR_VMAX / MS * Math.max(dt, 1 / 240);
      for (let it = 0, n = first ? 24 : 6; it < n; it++){ screenPass(it ? 0 : dt, true); space.settle(1); } }
    for (const h of hens){ m.frame(h.root, h.x, h.z, h.yaw, h.air); m.frame(h.shade, h.x, h.z, h.yaw, .03); liftShade(h.shade, h.air, HCL); }
    // ----- donkey -----
    { const ex = cat.x - dk.x, ez = cat.z - dk.z, d = Math.hypot(ex, ez), toCat = Math.atan2(ex, ez), rel = angTo(dk.yaw, toCat);
      dk.watch = ease(dk.watch, d < 15 ? 1 : 0, d < 15 ? 3.8 : 1.2, dt);   // head up in ~0.6 s
      dk.near = d < 15 ? dk.near + dt : 0;
      // after a while, or if the cat walks round behind it, the donkey shifts its whole body to keep watching
      const turnWant = dk.near > 2.5 && Math.abs(rel) > .9 ? Math.sign(rel) : 0;
      dk.turn = ease(dk.turn, turnWant, 3, dt); dk.yaw += dk.turn * .45 * dt;
      dk.hy = ease(dk.hy, dk.watch > .5 ? clamp(angTo(dk.yaw, toCat), -1.05, 1.05) : Math.sin(T * .21) * .25, 3.8, dt);
      dk.hp = ease(dk.hp, dk.watch > .5 ? -.12 : .62 + Math.sin(T * 1.7) * .05 * (Math.sin(T * .5) > 0 ? 1 : 0), dk.watch > .5 ? 3.8 : 1.4, dt);
      m.frame(D, dk.x, dk.z, dk.yaw, 0); m.frame(dShade, dk.x, dk.z, dk.yaw, .03);
      dk.gait += dt * Math.abs(dk.turn) * 6;
      legs.forEach((l, i) => l.rotation.x = Math.sin(dk.gait + (i === 0 || i === 3 ? 0 : Math.PI)) * .18 * Math.abs(dk.turn));
      dbody.position.y = 0;
      neckPivot.rotation.set(0, dk.hy * .55, 0); if (head){ head.rotation.set(dk.hp, dk.hy * .45, 0); }
      const side = Math.sign(dk.hy || 1);
      ears.forEach((e, i) => { const s = i === 0 ? -1 : 1, o = ear0[i];  // pricked forward and swivelled 35° toward the cat; relaxed back while grazing
        e.rotation.x = o.x + dk.watch * .5 - (1 - dk.watch) * .15 + Math.sin(T * .7 + i * 2) * .08 * (1 - dk.watch);
        e.rotation.z = o.z + dk.watch * s * side * -.61; });
    }
    // ----- dormouse: in → out (60 % clear of the sacks, ears up, ≥ 1.5 s) → freeze 0.3 s → duck back in 0.25 s, tail last (0.1 s behind) -----
    if (mouse){ const d = Math.hypot(cat.x - sackAt[0], cat.z - sackAt[1]);
      const still = cat.speed < .15 || cat.sitting; M.still = still ? M.still + dt : 0;
      /* r7 (QA #21 "small brown bird"): no ambient peek with the cat far off — from the arrival view it read as a chick at the white sacks; it now
         only comes out as a reaction, once the cat has stopped in the yard (3–13 m) for a while */
      const calm = d < 13 && ((d > 6 && M.still > 3) || (d > 3 && M.still > 2.5 && cat.sitting)), threat = d < 11 && !still;
      M.t += dt;
      if (M.st === 'in' && M.k < .02 && cat.cam){ vCam.copy(cat.cam); sacks.worldToLocal(vCam); M.side = pickSide(vCam); }
      if (M.st === 'in' && calm && M.t > .8){ M.st = 'out'; M.t = 0; }
      else if (M.st === 'out' && threat && M.t > 1.5){ M.st = 'freeze'; M.t = 0; }
      else if (M.st === 'out' && d > 16 && M.t > 1.5){ M.st = 'duck'; M.t = 0; M.k0 = M.k; }   // r7: the cat has left the yard
      else if (M.st === 'out' && threat && M.k < .5){ M.st = 'duck'; M.t = 0; M.k0 = M.k; }
      else if (M.st === 'freeze' && M.t > .3){ M.st = 'duck'; M.t = 0; M.k0 = M.k; }
      else if (M.st === 'duck' && M.t > .25){ M.st = 'in'; M.t = 0; }
      if (M.st === 'out') M.k = ease(M.k, 1, 2.2, dt); else if (M.st === 'duck') M.k = (M.k0 ?? 1) * Math.max(0, 1 - M.t / .25); else if (M.st === 'in') M.k = Math.max(0, M.k - dt * 4);
      M.hist.push(M.k); if (M.hist.length > 4) M.hist.shift(); M.kt = M.st === 'duck' || M.st === 'in' ? Math.max(M.k, M.hist[0]) : M.k; // tail lags ≈ 0.1 s (3 frames @30 Hz)
      const S = SIDES[M.side]; vPeek.set(S.p[0], S.p[1], S.p[2]); vHide.set(S.p[0] - S.n[0] * .9, -1.0, S.p[2] - S.n[1] * .9);
      mouse.position.lerpVectors(vHide, vPeek, M.k); mouse.visible = M.kt > .03;
      const up = M.st === 'out' ? Math.max(0, (M.k - .6) / .4) : M.st === 'freeze' ? 1 : 0, sway = M.st === 'out' ? Math.sin(T * 1.3) * .5 * M.k : 0;
      mouse.rotation.set(-.5 * up, S.yaw + sway, 0); mouse.position.y += .05 * up;
      for (const e of mEars) e.scale.set(1, 1 + .6 * up + (M.st === 'freeze' ? .2 : 0), .4);
      if (mTail && mTail0){ mTail.position.copy(mTail0); mTail.position.z -= (M.kt - M.k) * .9 / MSC; mTail.visible = M.kt > .03; }
      /* ground keep-out for the hens while it is out: the body ellipse slides out of the pile with the peek (starts pGap + body deep behind the pile
         face, where no hen can be, so a hen beside the mouth is eased aside, never popped by the prop gap switching on) */
      if (M.k < .02){ MGND.x = MGND.z = 1e4; MGND.hl = MGND.hw = .01; } else { const a = -.5, b = (1 - M.k) * (space.S.pGap + MBODY * MSC), x = mouse.position.x - S.n[0] * b, z = mouse.position.z - S.n[1] * b;
        MGND.x = SX + x * Math.cos(a) + z * Math.sin(a); MGND.z = SZ - x * Math.sin(a) + z * Math.cos(a); MGND.yaw = a + S.yaw; MGND.hl = MBODY * MSC; MGND.hw = .07 * MSC; }
      if (mShade){ mShade.position.set(mouse.position.x, .015, mouse.position.z); mShade.rotation.y = S.yaw; mShade.visible = M.k > .2; mShade.material.opacity = .42 * Math.min(1, (M.k - .2) * 2); } }
  }
  return { update, hens, space, spur, screen: { scrGapOf, VIEW, henBox, dkBox, sackPts, basis, henHull, obstHulls, need: () => SCR_GAP_HC * HCL, hcl: () => HCL }, donkey: dk, get mouseOut(){ return M.k; }, mouse: M, mouseObj: mouse, donkeyObj: D, hasMouse: !!mouse, sides: SIDES };
}
