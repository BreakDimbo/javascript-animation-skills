// 动物互动 · pond: the ducks paddle off from the bank the cat comes to, leave soft painted rings behind, and drift back once it has gone.
// Works in the b3 pond's own local metres (before the PS shrink) on top of its duck brains: it only nudges dk.x/z and the group heading.
import * as THREE from '../../shared/vendor/three.module.js';
import { makeShade } from './millyard.js';
import { CAT_HC } from '../catScale.js';

/* r2 (VD): ducks 0.95 Hc long (= 0.57 Lc), contact shade like the cat's, turn within 0.4 s, 1.6× paddle for the first 1.5 s, one per group looks back 0.8 s */
const PS = .15; let DUCK_L = 1.30 * CAT_HC / PS, GAP = 1.15 * DUCK_L;  /* VD r4 (18:35): drawn body 1.30 Hc (real mesh, after the DS fix); b3 grouping centre spacing 1.15 L, outlines kept apart by keepApart() */  // live CAT_HC (game/catScale.js, fallback 0.281);  // VD r2: 0.70 Hc (0.42 Lc); GAP = 1.7 duck lengths centre-to-centre (gap 0.7 L = 0.30 Lc), applied in b3 grouping via dk.sep
const ALERT = 10, CALM = 13, RINGS = 10, REST = 24; /* r2: REST s loitering by the old spot after they come back */
const angTo = (a, b) => Math.atan2(Math.sin(b - a), Math.cos(b - a));

function ringTexture(){ // a soft gouache annulus: pale water tone, feathered both sides, faintly uneven like a brush ring
  const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d'), id = g.createImageData(128, 128), d = id.data;
  for (let y = 0; y < 128; y++) for (let x = 0; x < 128; x++){ const dx = x - 63.5, dy = y - 63.5, r = Math.hypot(dx, dy) / 63.5, a = Math.atan2(dy, dx);
    const w = .085 * (1 + .25 * Math.sin(a * 3 + 1) + .15 * Math.sin(a * 7)), k = Math.exp(-Math.pow((r - .78) / w, 2)) * (.8 + .2 * Math.sin(a * 5 + 2));
    const i = (y * 128 + x) * 4; d[i] = d[i + 1] = d[i + 2] = 255; d[i + 3] = Math.round(255 * Math.max(0, Math.min(1, k))); }
  g.putImageData(id, 0, 0); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; }

export function createDuckShy(m){
  const tex = ringTexture(), geo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
  const rings = Array.from({ length: RINGS }, () => { const mat = new THREE.MeshBasicMaterial({ color: 0xd9e7f1, alphaMap: tex, transparent: true, opacity: 0, depthWrite: false });
    const o = new THREE.Mesh(geo, mat); o.visible = false; o.renderOrder = 3; o.frustumCulled = false; m.group.add(o); return { o, t: 9, x: 0, z: 0, s: 1 }; });
  let ri = 0;
  const ring = (x, z, s = 1) => { const r = rings[ri]; ri = (ri + 1) % RINGS; r.t = 0; r.x = x; r.z = z; r.s = s; };
  const groups = new Map(); for (const dk of m.ducks){ if (!groups.has(dk.gid)) groups.set(dk.gid, { home: null, quiet: 0, scared: 0, rest: 0, log: null }); dk._rt = Math.random() * .5; }
  const state = { groups, scared: 0, duckScale: 1 };
  // measure the b3 duck once (its own frame) and scale every duck to DUCK_L; each gets a contact shade at 1.3× its footprint
  { const d0 = m.ducks[0].m; d0.updateMatrixWorld(true); const inv = new THREE.Matrix4().copy(d0.matrixWorld).invert(), bb = new THREE.Box3(), b = new THREE.Box3(), M4 = new THREE.Matrix4();
    d0.traverse(o => { if (o.isMesh){ o.geometry.computeBoundingBox(); b.copy(o.geometry.boundingBox).applyMatrix4(M4.multiplyMatrices(inv, o.matrixWorld)); bb.union(b); } });
    const sz = bb.getSize(new THREE.Vector3()), k = sz.z > 1e-3 ? DUCK_L / sz.z : 1; state.duckScale = k; state.duckSize = [sz.x * k, sz.z * k]; state.base = { x: sz.x, z: sz.z, k0: d0.scale.x, hc: CAT_HC };
    /* QA 18:30 fix: bb is the raw duck (d0's own frame, before b3's DS 2.05), so the mesh scale is k itself — r2–r4 multiplied DS × k and drew ducks 2.05× DUCK_L (1.43 Hc) */
    /* QA 1955 (pond): the drawn duck's two parts as boxes in its own frame (unscaled): body, and head + neck at rest (neck group pose) — for the screen keep-out */
    { const parts = []; for (const ch of d0.children){ const pb = new THREE.Box3(); ch.updateMatrixWorld(true); ch.traverse(o => { if (o.isMesh){ b.copy(o.geometry.boundingBox).applyMatrix4(M4.multiplyMatrices(inv, o.matrixWorld)); pb.union(b); } }); if (!pb.isEmpty()) parts.push(pb.clone()); }
      state.parts = parts.map(q => [q.min.x, q.max.x, q.min.y, q.max.y, q.min.z, q.max.z]); }
    for (const dk of m.ducks){ dk.sep = GAP; dk.m.scale.setScalar(k); dk.shade = makeShade(sz.x * k * 1.3, sz.z * k * 1.3); m.group.add(dk.shade); } }
  function hcSync(){ const B = state.base; if (!B || B.hc === CAT_HC) return; B.hc = CAT_HC; DUCK_L = 1.30 * CAT_HC / PS; GAP = 1.15 * DUCK_L;
    const k = DUCK_L / B.z; state.duckScale = k; state.duckSize = [B.x * k, B.z * k];
    for (const dk of m.ducks){ dk.sep = GAP; dk.m.scale.setScalar(k); const o = dk.shade; o.userData.w = B.x * k * 1.3; o.userData.l = B.z * k * 1.3; o.scale.set(o.userData.w, 1, o.userData.l); } }
  const QS = new THREE.Quaternion();
  /* QA 18:30 (Deployer, team bd52acf pond_desktop): no duck touches another duck (any group) or the floating log / stepping stones.
     Footprint = ellipse of the duck's real half-length × half-width; h(u) is its extent along unit u.
     duck–duck: outlines ≥ 0.30 Lc apart (VD r4; was 0.9 L at QA 18:30); duck–log (capsule) and duck–stone: outline ≥ PROP_GAP = 0.3 L off the prop.
     Inside SOFT extra the duck turns gently along the prop (natural drift); the hard push only ever removes the shortfall. */
  const SEP_GAP_LC = .30, PROP_GAP = .3, SOFT = .6;   // VD r4: outlines ≥ 0.30 Lc apart (any pair); props ≥ 0.3 L
  const ext = (o, ux, uz) => { const [w, l] = state.duckSize, fx = Math.sin(o.yaw), fz = Math.cos(o.yaw), a = ux * fx + uz * fz, b = ux * fz - uz * fx; return Math.hypot(l * .5 * a, w * .5 * b); };
  const wet = (x, z) => m.sample(x, z).depth > .3;
  function steer(o, nx, nz, w){ const want = Math.atan2(nx, nz), tg = [want + Math.PI / 2, want - Math.PI / 2].sort((p, q) => Math.abs(angTo(o.yaw, p)) - Math.abs(angTo(o.yaw, q)))[0]; o.yaw += angTo(o.yaw, tg) * Math.min(1, w); }
  /* QA 1955 (Deployer, team 3ff7d7b pond_desktop): the green drake beside the floating log had its body on water but its head drawn over the log's end
     (gap 0 on screen). The ground keep-out above only sees footprints; the head stands ~0.4 Hc up and the camera looks down at ~24°, so a duck just
     in front of the log reads over it. Screen keep-out: from the live camera (cat.cam = its pond-local x, z, h) both shapes are projected onto the
     view plane (lateral, and depth·sin e + height·cos e): the duck = hull of its body box and head/neck box (at its yaw, live scale), the log = its
     axis (live x, z, yaw, heave, pitch) swept by its radius. Their gap must stay ≥ 0.3 Hc on screen (SCR_GAP_HC in view-plane metres): eased off inside SCR_SOFT,
     hard push (along the gap's gradient) for any shortfall. The log is never moved. */
  const SCR_GAP_HC = .3 + .1, SCR_SOFT_HC = .6, SCR_VMAX = .8, /* world m/s */   // +.1: the view-plane model is orthographic; the real 17° perspective reads up to ~.03 Hc tighter, and the rate cap below can lag ~.05 (pondsim)
  VIEW = { on: false, cx: 0, cz: 0, ch: 0, se: Math.sin(.43), ce: Math.cos(.43) };
  function duckHull(o, x, z, vx, vz){ const k = state.duckScale, fx = Math.sin(o.yaw), fz = Math.cos(o.yaw), wl = m.waterLevel(x, z), y0 = wl - .06, pts = [];
    for (const [x0, x1, ya, yb, z0, z1] of state.parts || []) for (const lx of [x0, x1]) for (const ly of [ya, yb]) for (const lz of [z0, z1]){
      const px = x + (lx * fz + lz * fx) * k, pz = z + (-lx * fx + lz * fz) * k, py = Math.max(wl, y0 + ly * k) - wl;   // below the waterline is not drawn
      pts.push([px * -vz + pz * vx, (px * vx + pz * vz) * VIEW.se + py * VIEW.ce]); }
    pts.sort((a, b) => a[0] - b[0] || a[1] - b[1]); const cr = (O, A, B) => (A[0] - O[0]) * (B[1] - O[1]) - (A[1] - O[1]) * (B[0] - O[0]);
    const lo = [], up = []; for (const q of pts){ while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop(); lo.push(q); }
    for (let i = pts.length - 1; i >= 0; i--){ const q = pts[i]; while (up.length >= 2 && cr(up[up.length - 2], up[up.length - 1], q) <= 0) up.pop(); up.push(q); }
    return lo.slice(0, -1).concat(up.slice(0, -1)); }
  const segD = (p, a, b) => { const sx = b[0] - a[0], sy = b[1] - a[1], t = Math.max(0, Math.min(1, ((p[0] - a[0]) * sx + (p[1] - a[1]) * sy) / (sx * sx + sy * sy || 1e-12))); return Math.hypot(p[0] - a[0] - sx * t, p[1] - a[1] - sy * t); };
  const inPoly = (p, H) => { for (let i = 0; i < H.length; i++){ const a = H[i], b = H[(i + 1) % H.length]; if ((b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]) < 0) return false; } return true; };
  const segX = (a, b, c, d) => { const o = (p, q, r) => Math.sign((q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0])); return o(a, b, c) !== o(a, b, d) && o(c, d, a) !== o(c, d, b); };
  // view-plane gap (local metres) between duck o standing at (x, z) and log lg; < 0 overlapping
  // r7.2: same true view as the duck pairs (pairBasis, world space at the duck ↔ log midpoint), not the local-elevation basis
  function scrGap(o, x, z, lg){ const ax = Math.sin(lg.yaw), az = Math.cos(lg.yaw), half = lg._hDraw || lg.L / 2, tilt = Math.abs(half * Math.sin(lg.pitch || 0));
    const tt = Math.max(-half, Math.min(half, (x - lg.x) * ax + (z - lg.z) * az)), Bs = pairBasis((x + lg.x + ax * tt) / 2, (z + lg.z + az * tt) / 2), H = duckHullB(o, x, z, Bs), { l, u } = Bs;
    const yc = (lg.heave || 0);   // absolute local height of the log axis (was heave − water level in the old water-relative basis)
    const pr = (px, pz, py) => [px * l[0] + pz * l[1] + py * l[2], px * u[0] + pz * u[1] + py * u[2]];
    const A = pr(lg.x - ax * half, lg.z - az * half, yc), B = pr(lg.x + ax * half, lg.z + az * half, yc), r = (lg._rDraw || lg.r * 1.06) + tilt; // drawn radius incl. the side stub and flare
    if (inPoly(A, H) || inPoly(B, H)) return -r; let d = 1e9;
    for (let i = 0; i < H.length; i++){ const a = H[i], b = H[(i + 1) % H.length]; if (segX(A, B, a, b)) return -r; d = Math.min(d, segD(a, A, B), segD(A, a, b), segD(B, a, b)); }
    return d - r; }
  const SCR_SOFT_RATE = 1.6;   // local units/s at the soft band's inner edge (a duck swims ≤ ~0.6): holds a swimming duck in the soft band
  function screenKeep(o, dt, hard){ if (!VIEW.on || !state.parts) return; const need = SCR_GAP_HC * CAT_HC / PS, soft = SCR_SOFT_HC * CAT_HC / PS, e = .02;
    for (const lg of m.logs || []){ if (Math.hypot(o.x - lg.x, o.z - lg.z) > lg.L / 2 + lg.r + 3 * DUCK_L) continue;
      { const g = scrGap(o, o.x, o.z, lg); if (g >= need + soft) continue;
        let gx = (scrGap(o, o.x + e, o.z, lg) - g) / e, gz = (scrGap(o, o.x, o.z + e, lg) - g) / e, gl = Math.hypot(gx, gz);
        if (gl < .05){ gx = o.x - lg.x; gz = o.z - lg.z; const l2 = Math.hypot(gx, gz) || 1; gx /= l2; gz /= l2; gl = .5; } else { gx /= gl; gz /= gl; }
        // r7.2: both pushes go into the duck's Jacobi sum (applied in screenPairs with the pair pushes), so a duck squeezed between a log and a
        // neighbour is not shoved one way by the log and back by the pair on alternate passes; the neighbour gives way instead
        o._mx = o._mx || 0; o._mz = o._mz || 0;
        if (g >= need){ if (!dt) continue; const f = 1 - (g - need) / soft; steer(o, gx, gz, dt * 1.2 * f); o._mx += gx * f * f * .45 * dt; o._mz += gz * f * f * .45 * dt; continue; } // soft: drift off like the props above (gentle: the log gap's gradient turns at its ends)
        const q = (need - g) / Math.max(.3, gl) * hard; o._mx += gx * q; o._mz += gz * q; } } }
  // each log's drawn radius about its axis (bark noise, root flare and the side stub included), from its own mesh, once
  for (const lg of m.logs || []){ let rm = lg.r, zm = lg.L / 2; lg.m.updateMatrixWorld(true); const inv = new THREE.Matrix4().copy(lg.m.matrixWorld).invert(), M = new THREE.Matrix4(), q = new THREE.Vector3();
    lg.m.traverse(o => { if (!o.isMesh) return; M.multiplyMatrices(inv, o.matrixWorld); const p = o.geometry.attributes.position; for (let i = 0; i < p.count; i++){ q.fromBufferAttribute(p, i).applyMatrix4(M); rm = Math.max(rm, Math.hypot(q.x, q.y)); zm = Math.max(zm, Math.abs(q.z)); } });
    lg._rDraw = rm; lg._hDraw = zm; }
  /* r7.1 (QA merge-1440, pond @1440: brown duck ↔ green mallard closing 0.28 → 0.20 Hc on screen): duck ↔ duck keep-out on screen, ≥ SCR_GAP_HC.
     The pair basis is the true view at the pair's midpoint, built in world space (camera = cat.cam back through m.toWorld): the planet curves under
     the far camera (it stands ~115 m off on R 600), so the elevation seen from the water is not the local atan(h / d) — pondsim measured the
     ground-depth axis drawn ~0.7× what that local angle gives, which read a 0.09 Hc pair as 0.40. Each duck's hull (body + head/neck boxes, above the
     waterline) is projected in that basis; inside SCR_SOFT both ducks drift apart along the gap gradient (eased f², ≤ 0.225 m/s local each, below
     a paddle — a closing pair eases apart), any shortfall is pushed out split between them, from the same per-frame rate budget as the log push. */
  const _P = new THREE.Vector3(), _Q = new THREE.Vector3(), _C = new THREE.Vector3(), _f = new THREE.Vector3(), _r = new THREE.Vector3(), _u = new THREE.Vector3(), _n = new THREE.Vector3();
  function pairBasis(x, z){ const wl = m.waterLevel(x, z); m.toWorld(x, z, wl, _P); m.toWorld(VIEW.cx, VIEW.cz, VIEW.ch, _C);
    const ax = (dx, dz, dh, o) => m.toWorld(x + dx, z + dz, wl + dh, o).sub(_P);
    const ex = ax(1, 0, 0, new THREE.Vector3()), ez = ax(0, 1, 0, new THREE.Vector3()), eh = ax(0, 0, 1, new THREE.Vector3()), s = 1 / ex.length();
    _f.subVectors(_P, _C).normalize(); _n.copy(eh).normalize(); _r.crossVectors(_f, _n).normalize(); _u.crossVectors(_r, _f).normalize();
    return { l: [ex.dot(_r) * s, ez.dot(_r) * s, eh.dot(_r) * s], u: [ex.dot(_u) * s, ez.dot(_u) * s, eh.dot(_u) * s] }; }
  // the drawn duck as it stands this frame (neck turned for the glance back included): every mesh's box corners, relative to its seat, once per pass
  const _bx = new THREE.Box3(), _c = new THREE.Vector3();
  function snapCorners(o){ o.m.updateMatrixWorld(true); const s0 = m.toLocal(o.m.position), sx = s0.x, sz = s0.z, sh = m.waterLevel(sx, sz), C = [];
    o.m.traverse(q => { if (!q.isMesh || !q.visible) return; if (!q.geometry.boundingBox) q.geometry.computeBoundingBox(); const bb = q.geometry.boundingBox;
      for (const X of [bb.min.x, bb.max.x]) for (const Y of [bb.min.y, bb.max.y]) for (const Z of [bb.min.z, bb.max.z]){ const p = m.toLocal(_c.set(X, Y, Z).applyMatrix4(q.matrixWorld)); C.push([p.x - sx, p.z - sz, p.h - sh]); } });
    o._cn = C; o._cy = o.yaw; }
  function duckHullB(o, x, z, B){ const k = state.duckScale, fx = Math.sin(o.yaw), fz = Math.cos(o.yaw), wl = m.waterLevel(x, z), y0 = wl - .06, pts = [], { l, u } = B;
    if (o._cn && Math.abs(angTo(o._cy, o.yaw)) < .05){ for (const [dx, dz, dh] of o._cn){ const px = x + dx, pz = z + dz, py = wl + Math.max(0, dh); pts.push([px * l[0] + pz * l[1] + py * l[2], px * u[0] + pz * u[1] + py * u[2]]); } }
    else
    for (const [x0, x1, ya, yb, z0, z1] of state.parts || []) for (const lx of [x0, x1]) for (const ly of [ya, yb]) for (const lz of [z0, z1]){
      const px = x + (lx * fz + lz * fx) * k, pz = z + (-lx * fx + lz * fz) * k, py = Math.max(wl, y0 + ly * k);   // below the waterline is not drawn
      pts.push([px * l[0] + pz * l[1] + py * l[2], px * u[0] + pz * u[1] + py * u[2]]); }
    pts.sort((a, b) => a[0] - b[0] || a[1] - b[1]); const cr = (O, A, Bq) => (A[0] - O[0]) * (Bq[1] - O[1]) - (A[1] - O[1]) * (Bq[0] - O[0]);
    const lo = [], up = []; for (const q of pts){ while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop(); lo.push(q); }
    for (let i = pts.length - 1; i >= 0; i--){ const q = pts[i]; while (up.length >= 2 && cr(up[up.length - 2], up[up.length - 1], q) <= 0) up.pop(); up.push(q); }
    return lo.slice(0, -1).concat(up.slice(0, -1)); }
  const polyGap = (A, B) => { if (A.some(p => inPoly(p, B)) || B.some(p => inPoly(p, A))) return -.05; let d = 1e9;
    for (const [P, Q] of [[A, B], [B, A]]) for (let i = 0; i < Q.length; i++){ const a = Q[i], b = Q[(i + 1) % Q.length]; for (const p of P) d = Math.min(d, segD(p, a, b)); for (let k = 0; k < P.length; k++) if (segX(P[k], P[(k + 1) % P.length], a, b)) return -.05; } return d; };
  function pairScr(a, b, ax, az, bx, bz, B){ B = B || pairBasis((ax + bx) / 2, (az + bz) / 2); return polyGap(duckHullB(a, ax, az, B), duckHullB(b, bx, bz, B)); }
  function screenPairs(dt, hard){ if (!VIEW.on || !state.parts) return; const D = m.ducks, need = SCR_GAP_HC * CAT_HC / PS, soft = SCR_SOFT_HC * CAT_HC / PS, e = .02;
    const can = (o, dx, dz) => { const d1 = m.sample(o.x + dx, o.z + dz).depth; return d1 > .3 || d1 >= m.sample(o.x, o.z).depth; };
    for (const o of D){ o._mx = o._mx || 0; o._mz = o._mz || 0; }   // the log pushes (screenKeep) are already in
    for (let i = 0; i < D.length; i++) for (let j = i + 1; j < D.length; j++){ const a = D[i], b = D[j]; if (Math.hypot(a.x - b.x, a.z - b.z) > 4 * DUCK_L) continue;
      const B = pairBasis((a.x + b.x) / 2, (a.z + b.z) / 2), g = pairScr(a, b, a.x, a.z, b.x, b.z, B); if (g >= need + soft) continue;
      // gradient of the gap in b's position (a's is its mirror for a symmetric pair; measured separately so a yawed pair still parts the short way)
      let bx = (pairScr(a, b, a.x, a.z, b.x + e, b.z, B) - g) / e, bz = (pairScr(a, b, a.x, a.z, b.x, b.z + e, B) - g) / e, ax = (pairScr(a, b, a.x + e, a.z, b.x, b.z, B) - g) / e, az = (pairScr(a, b, a.x, a.z + e, b.x, b.z, B) - g) / e;
      const fb = () => { const rx = b.x - a.x, rz = b.z - a.z, l = Math.hypot(rx, rz) || 1; return [rx / l, rz / l]; };
      let gb = Math.hypot(bx, bz), ga = Math.hypot(ax, az); if (gb < .05){ [bx, bz] = fb(); gb = .5; } else { bx /= gb; bz /= gb; } if (ga < .05){ const [x, z] = fb(); ax = -x; az = -z; ga = .5; } else { ax /= ga; az /= ga; }
      let qa, qb; if (g >= need){ if (!dt) continue; const f = 1 - (g - need) / soft, q = f * f * SCR_SOFT_RATE * dt * .5; qa = qb = q; } // r7.2: strong enough to hold a swimming duck in the soft band, so the hard push (a sawtooth when it does the holding) stays a backstop
      else { const q = (need - g) / Math.max(.3, ga + gb) * hard; qa = qb = q; }
      a._mx += ax * qa; a._mz += az * qa; b._mx += bx * qb; b._mz += bz * qb; }
    // applied together (Jacobi), not pair by pair: a duck squeezed between two neighbours gets both pushes summed (they cancel and the outer two
    // part) instead of being shoved left then right on alternate frames; each duck's move is capped by its per-frame budget
    for (const o of D){ const l = Math.hypot(o._mx, o._mz); if (l > 1e-9){ const q = Math.min(l, o._skb), dx = o._mx / l * q, dz = o._mz / l * q; let mx = dx, mz = dz;
        { // r7.2: in the shallows, slide along the bank: the part of the move that climbs out of the water is dropped, eased in over .3–.45 deep (no on/off chatter)
          const d0 = m.sample(o.x, o.z).depth, w = Math.min(1, Math.max(0, (.45 - d0) / .15));
          if (w > 0){ const nx = m.sample(o.x + .05, o.z).depth - d0, nz = m.sample(o.x, o.z + .05).depth - d0, nl = Math.hypot(nx, nz) || 1, ux = nx / nl, uz = nz / nl, k = mx * ux + mz * uz;
            if (k < 0){ mx -= ux * k * w; mz -= uz * k * w; } } }
        if (can(o, mx, mz)){ o.x += mx; o.z += mz; o._skb -= Math.hypot(mx, mz); } } o._mx = o._mz = 0; } }
  state.screen = { scrGap, pairScr, pairBasis, duckHullB, VIEW, need: () => SCR_GAP_HC * CAT_HC / PS };
  function keepApart(dt, hard = 1){
    const D = m.ducks, L = DUCK_L;
    const pairs = (soft) => { for (let i = 0; i < D.length; i++) for (let j = i + 1; j < D.length; j++){ const a = D[i], b = D[j]; let rx = b.x - a.x, rz = b.z - a.z; const d = Math.hypot(rx, rz) || 1e-3; rx /= d; rz /= d;
      const need = ext(a, rx, rz) + ext(b, rx, rz) + SEP_GAP_LC * 1.66 * CAT_HC / PS, band = .35 * L;
      if (soft && d < need + band){ const f = 1 - Math.max(0, d - need) / band, q = f * f * .3 * dt; if (wet(b.x + rx * q, b.z + rz * q)){ b.x += rx * q; b.z += rz * q; } if (wet(a.x - rx * q, a.z - rz * q)){ a.x -= rx * q; a.z -= rz * q; } }   // soft: drift apart before they touch
      if (d >= need) continue; const p = (need - d) * .5 * hard;
      if (wet(b.x + rx * p, b.z + rz * p)){ b.x += rx * p; b.z += rz * p; } else { a.x -= rx * p; a.z -= rz * p; }
      if (wet(a.x - rx * p, a.z - rz * p)){ a.x -= rx * p; a.z -= rz * p; } else { b.x += rx * p; b.z += rz * p; } } };
    for (let it = 0; it < 3; it++) pairs(it === 0);   // a push can crowd a third duck: relax a few times
    for (const o of D){
      for (const lg of m.logs || []){ const ax = Math.sin(lg.yaw), az = Math.cos(lg.yaw), dx = o.x - lg.x, dz = o.z - lg.z, t = Math.max(-lg.L / 2, Math.min(lg.L / 2, dx * ax + dz * az));
        let nx = dx - ax * t, nz = dz - az * t; const d = Math.hypot(nx, nz) || 1e-3; nx /= d; nz /= d; const need = lg.r + ext(o, nx, nz) + PROP_GAP * L;
        if (d < need + SOFT * L){ const f = 1 - Math.max(0, d - need) / (SOFT * L); steer(o, nx, nz, dt * 1.2 * f); o.x += nx * f * f * .45 * dt; o.z += nz * f * f * .45 * dt; }   // soft: a slow drift off (≤ 0.45 m/s local, b3 paddles .18–.26)
        if (d < need){ o.x += nx * (need - d) * hard; o.z += nz * (need - d) * hard; } }
      for (const st of m.stones || []){ let nx = o.x - st.x, nz = o.z - st.z; const d = Math.hypot(nx, nz) || 1e-3; nx /= d; nz /= d; const need = st.r + ext(o, nx, nz) + PROP_GAP * L;
        if (d < need + SOFT * L){ const f = 1 - Math.max(0, d - need) / (SOFT * L); steer(o, nx, nz, dt * 1.2 * f); o.x += nx * f * f * .45 * dt; o.z += nz * f * f * .45 * dt; }   // soft: a slow drift off (≤ 0.45 m/s local, b3 paddles .18–.26)
        if (d < need){ o.x += nx * (need - d) * hard; o.z += nz * (need - d) * hard; } }
    }
    // props last pushed someone: settle the ducks once more, alternating with the screen keep-out (QA 1955: nothing reads over the log on screen;
    // it only ever moves a duck away from the log) so both the 0.30 Lc duck gaps and the 0.3 Hc log gap hold together
    if (VIEW.on && state.parts) for (const o of D) snapCorners(o);
    if (VIEW.on && state.parts){ state.viewT = (state.viewT || 0) + dt; const first = state.viewT < .25; for (const o of D) o._skb = first ? 1e9 : SCR_VMAX / PS * Math.max(dt, 1 / 240); } // the first 0.25 s with a camera settle outright (spawn keep-in: the pond is entered from off-board) // per-frame budget: the push never outruns a brisk paddle
    if (VIEW.on && state.parts) for (let it = 0; it < 6; it++){ for (const o of D) screenKeep(o, it ? 0 : dt, hard); screenPairs(it ? 0 : dt, hard); pairs(); } else pairs();
    for (const o of D) m.toWorld(o.x, o.z, m.waterLevel(o.x, o.z) - .06, o.m.position);   // re-seat: b3 placed the mesh before this pass
  }
  for (let it = 0; it < 40; it++) keepApart(1 / 30);   // b3 scatters ducks at random in a 1.5 m square: start clear

  function update(dt, cat){ // cat: { x, z, speed, cam: [x, z, h] } in pond-local metres, or null
    hcSync();
    if (cat && cat.cam && cat.cam.length > 2){ VIEW.on = true; VIEW.cx = cat.cam[0]; VIEW.cz = cat.cam[1]; VIEW.ch = cat.cam[2];
      const e = Math.atan2(cat.cam[2] - m.waterLevel(cat.x, cat.z), Math.hypot(cat.cam[0] - cat.x, cat.cam[1] - cat.z) || 1e-3); VIEW.se = Math.sin(e); VIEW.ce = Math.cos(e); } else VIEW.on = false;
    let any = 0;
    for (const [gid, G] of groups){
      const mates = m.ducks.filter(o => o.gid === gid); let cx = 0, cz = 0, near = 1e9;
      for (const o of mates){ cx += o.x; cz += o.z; if (cat) near = Math.min(near, Math.hypot(o.x - cat.x, o.z - cat.z)); } cx /= mates.length; cz /= mates.length;
      if (near < ALERT){ if (!G.home){ G.home = [cx, cz]; G.log = { home: [cx, cz], fled: 0 }; G.st = 0; G.lb = 0; } if (G.scared < .05) G.st = 0; G.st += dt; G.rest = 0; G.quiet = 0; G.scared = Math.min(1, G.scared + dt * 2.5); any = 1;
        const ax = cx - cat.x, az = cz - cat.z, want = Math.atan2(ax, az); for (const o of mates){ o.groupHead += angTo(o.groupHead, want) * Math.min(1, dt * 2.2);
          if (G.st < .6) o.yaw += angTo(o.yaw, Math.atan2(o.x - cat.x, o.z - cat.z)) * Math.min(1, dt * 9); } } /* turned round within ~0.4 s */
      else { G.scared = Math.max(0, G.scared - dt * .6); if (G.home){ G.quiet += dt; if (G.log) G.log.fled = Math.max(G.log.fled, Math.hypot(G.home[0] - cx, G.home[1] - cz));
        if (near > CALM && G.quiet > 3){ // r2: paddle back and then loiter round the old spot for REST s (the b3 brain alone keeps them cruising off)
          const hx = G.home[0] - cx, hz = G.home[1] - cz, hd = Math.hypot(hx, hz), want = Math.atan2(hx, hz);
          if (hd > 1.1) for (const o of mates) o.groupHead += angTo(o.groupHead, want) * Math.min(1, dt * 1.4);
          const pull = hd > 1.1 ? .32 : hd * .2; // calm return paddle, then a soft hold
          for (const o of mates){ const nx = o.x + hx / (hd || 1) * pull * dt, nz = o.z + hz / (hd || 1) * pull * dt; if (m.sample(nx, nz).depth > .3){ o.x = nx; o.z = nz; } }
          if (hd < 1.6) G.rest += dt; if (G.rest > REST){ G.home = null; G.rest = 0; } } } }
      if (G.log) G.log.now = [cx, cz];
      for (const o of mates){
        const d = cat ? Math.hypot(o.x - cat.x, o.z - cat.z) || 1e-3 : 1e9, k = Math.max(0, 1 - d / ALERT) * G.scared * ((G.st || 0) < 1.5 ? 1.6 : 1);
        if (k > 0){ const nx = o.x + (o.x - cat.x) / d * k * .9 * dt, nz = o.z + (o.z - cat.z) / d * k * .9 * dt; // a calm paddle, not a panic
          if (m.sample(nx, nz).depth > .3){ o.x = nx; o.z = nz; } }
        o._rt -= dt * (.4 + 1.6 * G.scared);       // wake rings: a slow trickle at rest, one every ~0.6 s while paddling off
        if (o._rt < 0){ o._rt = .9 + Math.random() * .4; if (G.scared > .15 || Math.random() < .12) ring(o.x - Math.sin(o.yaw) * .3, o.z - Math.cos(o.yaw) * .3, .8 + G.scared * .5); }
      }
    }
    // one duck per group glances back at the cat over its shoulder for 0.8 s, once it has put 1.5 s of water between them
    for (const [gid, G] of groups){ const o = m.ducks.find(q => q.gid === gid), nk = o && o.m.userData.neck; if (!nk) continue;
      if (G.home && G.st > 1.5 && G.lb === 0 && cat){ G.lb = .8; }
      let want = 0; if (G.lb > 0 && cat){ G.lb = Math.max(-1, G.lb - dt); if (G.lb <= 0) G.lb = -1; want = Math.max(-1.5, Math.min(1.5, angTo(o.yaw, Math.atan2(cat.x - o.x, cat.z - o.z)))); }
      nk.rotation.y += (want - nk.rotation.y) * Math.min(1, dt * 9); }
    // VD r2: no two ducks of a group may read as touching on screen. The b3 grouping keeps 1.7 L centre-to-centre on the water; seen from the
    // camera the depth axis is foreshortened, so pairs lined up along the view are spread to 1.7 L in a metric that counts depth at 0.6.
    if (cat && cat.cam) for (const [gid] of groups){ const ms = m.ducks.filter(o => o.gid === gid);
      for (let i = 0; i < ms.length; i++) for (let j = i + 1; j < ms.length; j++){ const a = ms[i], b = ms[j], rx = b.x - a.x, rz = b.z - a.z;
        let vx = (a.x + b.x) / 2 - cat.cam[0], vz = (a.z + b.z) / 2 - cat.cam[1]; const vl = Math.hypot(vx, vz) || 1; vx /= vl; vz /= vl;
        const dep = rx * vx + rz * vz, lat = rx * -vz + rz * vx, de = Math.hypot(lat, dep * .6) || 1e-3; if (de >= GAP) continue;
        const s = Math.min(GAP / de, 1 + dt * 3) - 1, px = rx * s * .5, pz = rz * s * .5; // ease apart, ≤ 3 × per second
        if (m.sample(b.x + px, b.z + pz).depth > .3){ b.x += px; b.z += pz; } if (m.sample(a.x - px, a.z - pz).depth > .3){ a.x -= px; a.z -= pz; } } }
    keepApart(dt);
    for (const o of m.ducks) if (o.shade){ m.toWorld(o.x, o.z, m.waterLevel(o.x, o.z) + .02, o.shade.position); m.frame(o.x, o.z, o.yaw, o.shade.quaternion); }
    state.scared = any;
    for (const r of rings){ if (r.t > 2.2){ r.o.visible = false; continue; } r.t += dt; const u = Math.min(1, r.t / 2.2);
      r.o.visible = true; m.toWorld(r.x, r.z, m.waterLevel(r.x, r.z) + .015, r.o.position); m.frame(r.x, r.z, 0, r.o.quaternion);
      const sc = r.s * (.6 + 1.9 * (1 - Math.pow(1 - u, 2))); r.o.scale.set(sc, 1, sc);
      r.o.material.opacity = .38 * Math.sin(Math.PI * Math.pow(u, .6)) * (1 - u * .4); }
  }
  return { update, state, rings, keepApart, gaps: { SEP_GAP_LC, PROP_GAP } };
}
