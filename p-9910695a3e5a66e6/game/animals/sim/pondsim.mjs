// node game/animals/sim/pondsim.mjs <seed>   (HC=0.281: fallback cat height; OLD=1: screen keep-out off, for the before number)
// 120 s at 60 Hz of the b3 pond + ducks.js under the diorama camera following a scripted cat round the bank. Every frame the real duck and log
// mesh vertices above the waterline are projected with a 1440×900 perspective camera (SHEEP_CAM vfov / elev / distance); reports the min
// screen gap duck hull ↔ log hull in Hc (px ÷ the px height of one Hc stood at that duck), and the min duck–duck ground outline gap in Lc.
import './stub.mjs';
const L = new URL('../../..', import.meta.url).pathname.replace(/\/$/, '');
const THREE = await import(L + '/shared/vendor/three.module.js');
let seed = +(process.argv[2] || 1); const SEED0 = seed; const rng = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; }; Math.random = rng;
const cs = await import(L + '/game/catScale.js'); cs.setCatHc(+(process.env.HC || 0.3491), 'sim');
const W = await import(L + '/game/world.js'); const { createPond } = await import(L + '/b3-pond/pond.js'); const { createDuckShy } = await import(L + '/game/animals/ducks.js');
const { SHEEP_CAM } = await import(L + '/artkit/dioramacam.js');
const PS = W.PS, scene = new THREE.Scene(), m = createPond(scene, { R: W.R, radius: W.R }, W.REG[1].dir), shy = createDuckShy(m);
if (process.env.OLD) shy.state.parts = null;
const HOME_D = SHEEP_CAM.dist0 * .45 / SHEEP_CAM.sheepUnits / PS; // dioramacam distance, in pond-local (full-size) metres
const cam = new THREE.PerspectiveCamera(SHEEP_CAM.vfov, 1440 / 900, .1, 4000);
const HC = cs.CAT_HC / PS, LC = 1.66 * HC, lg = m.logs[0];
const v = new THREE.Vector3(), up = new THREE.Vector3(), tgt = new THREE.Vector3();
function hull(P){ P.sort((a, b) => a[0] - b[0] || a[1] - b[1]); const cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]); const lo = [], u = [];
  for (const p of P){ while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], p) <= 0) lo.pop(); lo.push(p); }
  for (let i = P.length - 1; i >= 0; i--){ const p = P[i]; while (u.length >= 2 && cr(u[u.length - 2], u[u.length - 1], p) <= 0) u.pop(); u.push(p); } return lo.slice(0, -1).concat(u.slice(0, -1)); }
function polyGap(A, B){ let best = -1e9; for (const [P, Q] of [[A, B], [B, A]]) for (let i = 0; i < P.length; i++){ const a = P[i], b = P[(i + 1) % P.length]; let nx = b[1] - a[1], nz = a[0] - b[0]; const n = Math.hypot(nx, nz) || 1; nx /= n; nz /= n;
  let pmax = -1e9, qmin = 1e9; for (const p of P) pmax = Math.max(pmax, p[0] * nx + p[1] * nz); for (const q of Q) qmin = Math.min(qmin, q[0] * nx + q[1] * nz); best = Math.max(best, qmin - pmax); }
  if (best <= 0) return best; let d = 1e9; const seg = (p, a, b) => { const sx = b[0] - a[0], sz = b[1] - a[1], t = Math.max(0, Math.min(1, ((p[0] - a[0]) * sx + (p[1] - a[1]) * sz) / (sx * sx + sz * sz || 1e-9))); return Math.hypot(p[0] - a[0] - sx * t, p[1] - a[1] - sz * t); };
  for (const [P, Q] of [[A, B], [B, A]]) for (const p of P) for (let i = 0; i < Q.length; i++) d = Math.min(d, seg(p, Q[i], Q[(i + 1) % Q.length])); return d; }
const px = (p) => { v.copy(p).project(cam); return [(v.x + 1) * 720, (1 - v.y) * 450]; };
function screenVerts(root, above = true){ root.updateMatrixWorld(true); const P = [];
  root.traverse(o => { if (!o.isMesh) return; const p = o.geometry.attributes.position, st = Math.max(1, (p.count / 300) | 0);
    for (let i = 0; i < p.count; i += st){ v.fromBufferAttribute(p, i).applyMatrix4(o.matrixWorld); const l = m.toLocal(v); if (above && l.h < m.waterLevel(l.x, l.z) - .005) continue; P.push(px(v)); } }); return P; }
function groundHull(root){ root.updateMatrixWorld(true); const P = []; root.traverse(o => { if (!o.isMesh) return; const p = o.geometry.attributes.position, st = Math.max(1, (p.count / 80) | 0); for (let i = 0; i < p.count; i += st){ v.fromBufferAttribute(p, i).applyMatrix4(o.matrixWorld); const l = m.toLocal(v); P.push([l.x, l.z]); } }); return hull(P); }
// the cat: round the dry bank (r 13.5–15.5 local), stops, a few dashes; the camera looks across at the pond (teleport lookAt), drags ±0.5 rad
let th = rng() * 6.283, sp = 0, pause = 0, yawOff = 0, ctx = { x: 0, z: 0 }; const R0 = 14.2;
const res = { scr: 1e9, scrAt: null, scrMine: 1e9, dd: 1e9, near: 0 }; const dt = 1 / 60;
for (let f = 0; f < (+process.env.SECS || 120) * 60; f++){ const t = f * dt;
  if (pause > 0){ pause -= dt; sp = 0; } else { sp = rng() < .002 ? 1.8 : (sp > 1 ? sp : .55); th += sp * dt / R0 * (Math.sin(t * .05) > -.3 ? 1 : -1); if (rng() < dt * .12) pause = 2 + rng() * 5; if (sp > 1 && rng() < dt) sp = .55; }
  const rr = R0 + Math.sin(t * .13) * 1.2, cx = Math.cos(th) * rr, cz = Math.sin(th) * rr, ch = m.terrainH ? Math.max(0, m.terrainH(cx, cz)) : 0;
  yawOff = .5 * Math.sin(t * .07 + SEED0 % 7);   // r7.1: was `seed % 7` — seed is the rng state, so the camera swung ±0.5 rad at random every frame
  const yaw = Math.atan2(-cx, -cz) + yawOff; // facing the pond centre (local x, z heading)
  m.toWorld(cx, cz, ch, tgt); up.copy(tgt).normalize();
  const fw = new THREE.Vector3(); { const a = new THREE.Vector3(), b = new THREE.Vector3(); m.toWorld(cx + Math.sin(yaw) * .1, cz + Math.cos(yaw) * .1, ch, a); fw.subVectors(a, tgt).addScaledVector(up, -0).normalize(); fw.addScaledVector(up, -fw.dot(up)).normalize(); }
  const e = SHEEP_CAM.elev; cam.position.copy(tgt).addScaledVector(fw, -Math.cos(e) * HOME_D).addScaledVector(up, Math.sin(e) * HOME_D); cam.up.copy(up); cam.lookAt(tgt); cam.updateMatrixWorld(true);
  m.update(dt, { x: cx, z: cz, h: ch, on: null });
  const cl = m.toLocal(cam.position); shy.update(dt, { x: cx, z: cz, speed: sp, cam: [cl.x, cl.z, cl.h] });
  for (const dk of m.ducks){ if (dk._px !== undefined && t > .5){ const vx = (dk.x - dk._px) / dt * PS, vz = (dk.z - dk._pz) / dt * PS; if (dk._vx !== undefined){ const acc = Math.hypot(vx - dk._vx, vz - dk._vz) / dt; res.amax = Math.max(res.amax || 0, acc); if (vx * dk._vx + vz * dk._vz < 0 && Math.hypot(vx, vz) > .03 && Math.hypot(dk._vx, dk._vz) > .03) res.flip = (res.flip || 0) + 1; } dk._vx = vx; dk._vz = vz; }
    if (dk._px !== undefined && t > .5){ const sp2 = Math.hypot(dk.x - dk._px, dk.z - dk._pz) / dt * PS; if (sp2 > 1.1) res.fast = (res.fast || 0) + 1; if (sp2 > (res.vmax || 0)){ res.vmax = sp2; res.vAt = +t.toFixed(2); } } dk._px = dk.x; dk._pz = dk.z; }
  if (f % 2) continue;
  cam.updateProjectionMatrix(); cam.matrixWorldInverse.copy(cam.matrixWorld).invert();
  const LH = hull(screenVerts(lg.m));
  { const H = m.ducks.map(dk => hull(screenVerts(dk.m))), hp = m.ducks.map(dk => { const a = new THREE.Vector3(), b = new THREE.Vector3(); m.toWorld(dk.x, dk.z, m.waterLevel(dk.x, dk.z), a); m.toWorld(dk.x, dk.z, m.waterLevel(dk.x, dk.z) + HC, b); const pa = px(a), pb = px(b); return Math.hypot(pa[0] - pb[0], pa[1] - pb[1]); });
    for (let i = 0; i < H.length; i++) for (let j = i + 1; j < H.length; j++){ const g = polyGap(H[i], H[j]), gh = g / ((hp[i] + hp[j]) / 2); if (gh < (res.sdd ?? 1e9)){ res.sdd = gh; res.sddAt = [i, j, +t.toFixed(2), +g.toFixed(1), shy.state.parts && shy.state.screen.pairScr ? +(shy.state.screen.pairScr(m.ducks[i], m.ducks[j], m.ducks[i].x, m.ducks[i].z, m.ducks[j].x, m.ducks[j].z) / HC).toFixed(3) : null]; } if (gh < .3) res.sddN = (res.sddN || 0) + 1; } }
  for (const dk of m.ducks){ if (Math.hypot(dk.x - lg.x, dk.z - lg.z) > lg.L / 2 + 4) continue; res.near++;
    const DH = hull(screenVerts(dk.m)); const g = polyGap(DH, LH);
    const a = new THREE.Vector3(), b = new THREE.Vector3(); m.toWorld(dk.x, dk.z, m.waterLevel(dk.x, dk.z), a); m.toWorld(dk.x, dk.z, m.waterLevel(dk.x, dk.z) + HC, b); const pa = px(a), pb = px(b), hcPx = Math.hypot(pa[0] - pb[0], pa[1] - pb[1]);
    const gHc = g / hcPx; if (gHc < res.scr){ res.scr = gHc; res.scrAt = { t: +t.toFixed(2), duck: m.ducks.indexOf(dk), drake: dk.m.children.length && null, d: +(Math.hypot(dk.x - lg.x, dk.z - lg.z) / HC).toFixed(2) }; }
    if (shy.state.screen && shy.state.parts) res.scrMine = Math.min(res.scrMine, shy.state.screen.scrGap(dk, dk.x, dk.z, lg) / HC); }
  { const [w, l] = shy.state.duckSize, ext = (o, ux, uz) => { const fx = Math.sin(o.yaw), fz = Math.cos(o.yaw), a = ux * fx + uz * fz, b = ux * fz - uz * fx; return Math.hypot(l * .5 * a, w * .5 * b); };
    const D = m.ducks; for (let i = 0; i < D.length; i++) for (let j = i + 1; j < D.length; j++){ const rx = D[j].x - D[i].x, rz = D[j].z - D[i].z, d = Math.hypot(rx, rz) || 1e-6; res.ddm = Math.min(res.ddm ?? 1e9, (d - ext(D[i], rx / d, rz / d) - ext(D[j], rx / d, rz / d)) / LC); } }
  if (f % 6 === 0){ const G = m.ducks.map(d => groundHull(d.m)); for (let i = 0; i < G.length; i++) for (let j = i + 1; j < G.length; j++) res.dd = Math.min(res.dd, polyGap(G[i], G[j]) / LC); }
}
const f3 = x => +x.toFixed(3);
console.log(JSON.stringify({ minScreenDuckDuck_Hc: f3(res.sdd), sddAt: res.sddAt, framesDuckDuckUnder03: res.sddN || 0, maxAccel_world_ms2: f3(res.amax || 0), velFlips: res.flip || 0, seed: process.argv[2] || 1, hc: cs.CAT_HC, old: !!process.env.OLD, ducks: m.ducks.length, minScreenDuckLog_Hc: f3(res.scr), at: res.scrAt, modelGap_Hc: f3(res.scrMine), minDuckDuck_Lc_meshTopDown: f3(res.dd), minDuckDuck_Lc_ellipse: f3(res.ddm), maxDuckSpeed_world_ms: f3(res.vmax), vAt: res.vAt, framesOver1p1: res.fast || 0, nearSamples: res.near, log: [f3(lg.x), f3(lg.z)] }));
