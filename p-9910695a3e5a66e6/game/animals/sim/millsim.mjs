// node game/animals/sim/millsim.mjs <seed>   (CHASE=1: the cat chases each hen in turn; HC=0.281: fallback cat height). 120 s at 60 Hz, prints the min outline gaps in Lc.
import './stub.mjs';
const L = new URL('../../..', import.meta.url).pathname.replace(/\/$/, ''); // repo root
const THREE = await import(L + '/shared/vendor/three.module.js');
// seeded Math.random (per run)
let seed = +(process.argv[2] || 1); const rng = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; }; Math.random = rng;
const cs = await import(L + '/game/catScale.js'); cs.setCatHc(+(process.env.HC || 0.349), 'sim');
const W = await import(L + '/game/world.js');
const { createMill } = await import(L + '/b4-mill/mill.js');
const { createMillLife } = await import(L + '/game/animals/millyard.js');
const scene = new THREE.Scene();
const m = createMill(scene, { R: W.R, radius: W.R }, W.REG[2].dir);
const HENS = [[-6.5, 12.5], [-4.5, 14.8], [-8.2, 15.6], [-5.8, 17.4]];
const life = createMillLife(m, { hens: HENS, donkeyAt: [-15, 13, 2.2] });
const HCL = cs.CAT_HC / .12, LCm = 1.66 * HCL;
const toL = (v) => W.millLocal(v.clone().normalize());
{ const o = new THREE.Object3D(); m.frame(o, 5, 7, 0, 0); const [x, z] = toL(o.position); if (Math.hypot(x - 5, z - 7) > .01) { console.log('FRAME MISMATCH', x, z); process.exit(1); } }
// 2D convex hull of each hen's drawn verts (b4 metres)
const v = new THREE.Vector3();
function hull(h){ h.root.updateMatrixWorld(true); const P = [];
  h.root.traverse(o => { if (!o.isMesh) return; const p = o.geometry.attributes.position; const step = Math.max(1, (p.count / 60) | 0); for (let i = 0; i < p.count; i += step){ v.fromBufferAttribute(p, i).applyMatrix4(o.matrixWorld); P.push(toL(v)); } });
  P.sort((a, b) => a[0] - b[0] || a[1] - b[1]); const cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lo = [], up = []; for (const p of P){ while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], p) <= 0) lo.pop(); lo.push(p); }
  for (const p of P.slice().reverse()){ while (up.length >= 2 && cr(up[up.length - 2], up[up.length - 1], p) <= 0) up.pop(); up.push(p); } return lo.slice(0, -1).concat(up.slice(0, -1)); }
// separated convex polygons: distance = max over edge normals of the projection gap (exact for polygons when > 0); < 0 → overlap depth
function polyGap(A, B){ let best = -1e9; for (const [P, Q] of [[A, B], [B, A]]) for (let i = 0; i < P.length; i++){ const a = P[i], b = P[(i + 1) % P.length]; let nx = b[1] - a[1], nz = a[0] - b[0]; const n = Math.hypot(nx, nz) || 1; nx /= n; nz /= n;
  let pmax = -1e9, qmin = 1e9; for (const p of P) pmax = Math.max(pmax, p[0] * nx + p[1] * nz); for (const q of Q) qmin = Math.min(qmin, q[0] * nx + q[1] * nz); best = Math.max(best, qmin - pmax); }
  if (best <= 0) return best; // overlap
  // positive: true distance = min over vertex-edge distances
  let d = 1e9; const seg = (p, a, b) => { const sx = b[0] - a[0], sz = b[1] - a[1], t = Math.max(0, Math.min(1, ((p[0] - a[0]) * sx + (p[1] - a[1]) * sz) / (sx * sx + sz * sz || 1e-9))); return Math.hypot(p[0] - a[0] - sx * t, p[1] - a[1] - sz * t); };
  for (const [P, Q] of [[A, B], [B, A]]) for (const p of P) for (let i = 0; i < Q.length; i++) d = Math.min(d, seg(p, Q[i], Q[(i + 1) % Q.length])); return d; }
// ellipse containment check of each hull point
function fitMax(h, H){ const fx = Math.sin(h.yaw), fz = Math.cos(h.yaw); let mx = 0; for (const [x, z] of H){ const dx = x - (h.x + fx * h.c), dz = z - (h.z + fz * h.c), a = dx * fx + dz * fz, r = dx * fz - dz * fx; mx = Math.max(mx, (a / h.hl) ** 2 + (r / h.hw) ** 2); } return mx; }
const props = life.space.S.props;
function propClear(H, p){ let m = 1e9; for (const [x, z] of H){ let s;
  if (p.kind === 'circle') s = Math.hypot(x - p.x, z - p.z) - p.r;
  else if (p.kind === 'box'){ const c = Math.cos(p.yaw), sn = Math.sin(p.yaw), dx = x - p.x, dz = z - p.z, lx = dx * c - dz * sn, lz = dx * sn + dz * c; const ox = Math.abs(lx) - p.hx, oz = Math.abs(lz) - p.hz; s = ox > 0 || oz > 0 ? Math.hypot(Math.max(ox, 0), Math.max(oz, 0)) : Math.max(ox, oz); }
  else if (p.kind === 'poly'){ let b = 1e9; const P = p.pts; for (let i = 1; i < P.length; i++){ const [x0, z0] = P[i - 1], [x1, z1] = P[i], sx = x1 - x0, sz = z1 - z0, t = Math.max(0, Math.min(1, ((x - x0) * sx + (z - z0) * sz) / (sx * sx + sz * sz || 1e-9))); b = Math.min(b, Math.hypot(x - x0 - sx * t, z - z0 - sz * t)); } s = b - p.half; }
  else { const e = p.get(), fx = Math.sin(e.yaw), fz = Math.cos(e.yaw), dx = x - (e.x + fx * e.c), dz = z - (e.z + fz * e.c), a = dx * fx + dz * fz, r = dx * fz - dz * fx; s = (Math.hypot(a / e.hl, r / e.hw) - 1) * Math.min(e.hl, e.hw); }
  m = Math.min(m, s); } return m; }
// cat script (b4 metres): idle far → walk in → stroll through the yard → sprint past → sit near → wander loops, repeat; speed in world m/s like the region
const yard = [-6.2, 15];
function catAt(t){ const k = t % 40; const ang = t * .37;
  if (k < 4) return { x: yard[0] + 30, z: yard[1], speed: 0, sitting: true };
  if (k < 12){ const f = (k - 4) / 8; return { x: yard[0] + 30 - 30 * f, z: yard[1] + Math.sin(f * 6) * 3, speed: .45 }; }            // walks in (3.75 b4 m/s)
  if (k < 18){ return { x: yard[0] + Math.cos(ang * 3) * 3, z: yard[1] + Math.sin(ang * 3) * 3, speed: .45 }; }                     // strolls round the yard
  if (k < 22){ const f = (k - 18) / 4; return { x: yard[0] - 25 + 50 * f, z: yard[1] + 1.5, speed: 1.55 }; }                      // sprints across
  if (k < 28) return { x: yard[0] + 4, z: yard[1] - 5, speed: 0, sitting: true };
  return { x: yard[0] + Math.cos(ang * 2) * 9, z: yard[1] + Math.sin(ang * 1.4) * 7, speed: k < 34 ? 1.4 : .5 };                    // loops at a run, then walking
}
const CP = { x: 20, z: 15 }; function chase(t){ const k = t % 10; const hs = life.hens; let tg = hs[(t / 10 | 0) % hs.length]; const sp = k < 6 ? 1.6 : k < 8 ? .4 : 0;
  const dx = tg.x - CP.x, dz = tg.z - CP.z, d = Math.hypot(dx, dz) || 1, st = Math.min(d - .5, sp / .12 * (1 / 60)); if (st > 0){ CP.x += dx / d * st; CP.z += dz / d * st; } return { x: CP.x, z: CP.z, speed: sp, sitting: sp === 0 }; }
const dt = 1 / 60, N = 120 / dt; let T = 0, minG = 1e9, minE = 1e9, worstFit = 0, maxV = 0, ovl = 0; const pc = props.map(() => 1e9); const last = life.hens.map(h => [h.x, h.z]);
let modeMin = {}; let dMin = 1e9; let catMinD = 1e9; const birdsMinFrame = [];
for (let i = 0; i < N; i++){ T += dt; const c = process.env.CHASE ? chase(T) : catAt(T); const cat = { x: c.x, z: c.z, speed: c.speed, sitting: !!c.sitting, cam: null };
  m.update(dt, { position: m.surf(c.x, c.z), sitting: cat.sitting }); life.update(dt, cat, T);
  life.hens.forEach((h, j) => { const sp = Math.hypot(h.x - last[j][0], h.z - last[j][1]) / dt; if (sp / HCL > 2.3 && process.env.DBG) console.log("fast", T.toFixed(2), j, h.mode, (sp / HCL).toFixed(2), h.x.toFixed(2), h.z.toFixed(2)); maxV = Math.max(maxV, sp); last[j] = [h.x, h.z]; });
  minE = Math.min(minE, life.space.minGap());
  if (i % 2) continue;
  const H = life.hens.map(hull); const DH = hull({ root: life.donkeyObj }); for (const Hh of H) dMin = Math.min(dMin, polyGap(Hh, DH)); life.hens.forEach((h, j) => { worstFit = Math.max(worstFit, fitMax(h, H[j])); props.forEach((p, k) => { pc[k] = Math.min(pc[k], propClear(H[j], p)); }); });
  let fm = 1e9; for (let a = 0; a < H.length; a++) for (let b = a + 1; b < H.length; b++){ const g = polyGap(H[a], H[b]); fm = Math.min(fm, g); if (g <= 0) ovl++; const key = life.hens[a].mode + '/' + life.hens[b].mode; modeMin[key] = Math.min(modeMin[key] ?? 1e9, g / LCm); }
  minG = Math.min(minG, fm); }
const pn = props.map((p, k) => k === 0 ? 'tower' : k === 1 ? 'doorApron' : k === 2 ? 'sailSweep' : k === 3 ? 'cottage' : k === 4 ? 'sacks' : k === 5 ? 'dormouse' : p.kind === 'ellipse' ? 'donkey' : p === life.spur ? 'spur' : 'lane');
const pmin = {}; pn.forEach((n, k) => pmin[n] = Math.min(pmin[n] ?? 1e9, pc[k]));
console.log(JSON.stringify({ seed: process.argv[2] || 1, HCL: +HCL.toFixed(3), minOutlineGapLc: +(minG / LCm).toFixed(3), minEllipseGapLc: +(minE / LCm).toFixed(3), overlapFrames: ovl, ellipseFit: +worstFit.toFixed(3),
  donkeyHullLc: +(dMin / LCm).toFixed(2), propClearLc: Object.fromEntries(Object.entries(pmin).map(([k, v]) => [k, +(v / LCm).toFixed(2)])), maxSpeedHcPerS: +(maxV / HCL).toFixed(2), lanePts: props.find(p => p.kind === 'poly').pts.length, spur: life.spur.pts.map(q => q.map(v => +v.toFixed(2))), spurLenBoard: +(life.spur.len || 0).toFixed(2), tower: [props[0].x, props[0].z, +props[0].r.toFixed(2)],
  homes: life.hens.map(h => [+h.hx.toFixed(2), +h.hz.toFixed(2)]), worstModes: Object.entries(modeMin).sort((a, b) => a[1] - b[1]).slice(0, 3).map(([k, v]) => k + ' ' + v.toFixed(3)) }));
