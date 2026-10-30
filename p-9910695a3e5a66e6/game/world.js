// 褶星 Fold — world layout + painted-board spec (shared by main.js and bake.html).
import * as THREE from '../shared/vendor/three.module.js';
import { PAL, rgb } from '../artkit/palette.js';
import { makeFrame, mulberry } from '../artkit/ground.js';
import { pondSD } from '../b3-pond/pond.js';
export const R = 600;
// ---------- layout (same as b10) ----------
export const C01 = new THREE.Vector3(0, 0, 1);
export const along = (m) => C01.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), m / R).normalize();
export const F = makeFrame(C01, new THREE.Vector3(1, 0, 0), R);
// m-loop: the walking loop  Meadow 01 → Station 02 → Pond 06 → Seal Bay 07 → Mill 03 → Meadow  (board u east, v south; the default camera looks −v).
// Region centres sit 58–82 m apart so each leg is ~35–55 s at the cat's trot (1.7 m/s); every centre stays ≥ 75 m from the meadow, beyond
// the meadow module's 70 m relief (its heightAt would otherwise add to the pond water / mill hill). REG indices 0–3 are fixed (regions/*.js
// read REG[0..3]); the station (built on m-station) is REG[4] and the loop tolerates it missing.
export const REG = [
  { id: 'meadow', no: '01', name: '羊之草甸 · Sheep Meadow', dir: F.dirOf(0, 0), rad: 16 },
  { id: 'pond', no: '03', name: '池塘 · The Pond', dir: F.dirOf(66, -72), rad: 9 },
  { id: 'mill', no: '05', name: '磨坊 · The Mill', dir: F.dirOf(-72, -40), rad: 10 },
  { id: 'sealbay', no: '04', name: '海豹湾 · Seal Bay', dir: F.dirOf(0, -78), rad: 12 }, // QA r3: numbered in loop order 01 meadow · 02 halt · 03 pond · 04 seal bay · 05 mill; north of the meadow, beyond its relief (game/sealbay/; dir = the shore spawn)
  { id: 'station', no: '02', name: '小站 · The Halt', dir: F.dirOf(119.75, -4.58), rad: 9 }, // m-station r2 spot; main.js calls placeStation() with station.js's STATION_DIR at boot
];
export const LOOP = ['meadow', 'station', 'pond', 'sealbay', 'mill'];
export const [uP, vP] = F.toUV(REG[1].dir), [uM, vM] = F.toUV(REG[2].dir);
// local frames identical to pond.js / mill.js (E = Y×c, N = E×c)
export const localFrame = (c) => { const E = new THREE.Vector3(0, 1, 0).cross(c).normalize(), N = E.clone().cross(c).normalize();
  return (d) => { const k = d.dot(c); return [R * d.dot(E) / k, R * d.dot(N) / k]; }; };
export const pondLocal = localFrame(REG[1].dir), millLocal = localFrame(REG[2].dir);
// QA #20: the windmill's pose in b4-local metres (b4 had it at 0, 0, yaw .4, scale 1). At the ?at=mill arrival frame (24.5° camera) a 1.75 m
// mill 2.4 m ahead of the cat swept its blades ~4 m (ground-equivalent) past the board's far edge; beside the cat, door to the camera, 0.85 ×,
// every blade tip stays ≥ 1.4 m inside the board (/tmp/millfit.mjs replica). apron = the spot in front of its door where the path ends.
export const MILL_AT = { x: -15, z: -10, yaw: -1.75, s: .85 };
export const millAt = (x, z, out = new THREE.Vector3()) => { const c = REG[2].dir, E = new THREE.Vector3(0, 1, 0).cross(c).normalize(), N = E.clone().cross(c).normalize();
  return out.copy(c).multiplyScalar(R).addScaledVector(E, x * MS).addScaledVector(N, z * MS).normalize(); };
// mill-local (the windmill group's own x, z, before its 0.85 scale) ↔ b4-local metres
export const millPose = (px, pz) => { const c = Math.cos(MILL_AT.yaw), s = Math.sin(MILL_AT.yaw); return [MILL_AT.x + MILL_AT.s * (px * c + pz * s), MILL_AT.z + MILL_AT.s * (-px * s + pz * c)]; };
export const millUnpose = (x, z) => { const c = Math.cos(MILL_AT.yaw), s = Math.sin(MILL_AT.yaw), dx = (x - MILL_AT.x) / MILL_AT.s, dz = (z - MILL_AT.z) / MILL_AT.s; return [dx * c - dz * s, dx * s + dz * c]; };
// life r1: at 0.85 × the lowest sail tips pass 0.156 board m over the ground (0.45 Hc) — the hub can't rise ~2.9 m over the cap and −15 % sails
// only buys 0.1 m, so the cat is kept out of the sweep instead: every blade point lower than 1.3 Hc has its foot in mill-local |x| ≤ 5.39,
// z 2.6…2.8 (the sail plane); MILL_SWEEP is that strip grown by 1.7 (0.17 board m = CAT_R .13 + .04). Outside it the lowest blade within the
// cat's radius clears 0.570 m = 1.63 Hc (/tmp/millsweep.mjs). The path's apron sits beside the sweep, door side, not under it.
export const MILL_SWEEP = { hx: 5.4, z0: 2.6, z1: 2.8, r: 1.7 };
export const millSweepSD = (x, z) => { const [px, pz] = millUnpose(x, z), dx = Math.max(Math.abs(px) - MILL_SWEEP.hx, 0), dz = Math.max(MILL_SWEEP.z0 - pz, pz - MILL_SWEEP.z1, 0); return Math.hypot(dx, dz) - MILL_SWEEP.r; };
export const MILL_APRON = millPose(-7.5, 1.6);


export const BOARD = { U0: -300, U1: 240, V0: -95, V1: 95 };
// the lane (mill → paddock → pond): drawn in the ground shader from a distance field, so it stays crisp at the miniature scale
// r4: the pond and mill are miniatures, scaled about their anchors (pond 0.3, mill 0.25) to sit at the sheep/cat scale
export const PS = 0.15, MS = 0.12; /* r6: pond 0.2→0.15 so it fits its board */
// m-loop: the shader lane (ground.js fpLane, clamped to the first/last u of lanePath) is now only the home stretch u ∈ [−14, 14] across the top of
// the meadow; game/journey/path.js paints the rest of the loop (loopPath) as a ground decal that joins it at both ends
export const LANE_HOME = 14;
export const fpLane = (u) => 1.8 * Math.sin(u * .045) + .7 * Math.sin(u * .13 + 1) + (-15.0 - 1.8 * Math.sin(u * .045)) * (1 - THREE.MathUtils.smoothstep(Math.abs(u), 14, 40)) + .25 * Math.sin(u * .5);
export function lanePath(){ const path = []; // the home stretch of the lane, west → east
for (let u = -LANE_HOME; u <= LANE_HOME + 1e-6; u += 1){
  const v = 1.8 * Math.sin(u * .045) + .7 * Math.sin(u * .13 + 1) + (-15.0 - 1.8 * Math.sin(u * .045)) * (1 - THREE.MathUtils.smoothstep(Math.abs(u), 14, 40)) + .25 * Math.sin(u * .5);
  path.push([u, v]); }
return path; }
// the meadow footpath (runs up through the flock like the reference's path) and the little river on its west side
export const meadowU = (v) => 1.25 - .22 * THREE.MathUtils.clamp(v + 3.5, -12, 6) + .3 * Math.sin(v * .42 + 1) + .1 * Math.sin(v * 1.3); /* r5 diagonal; mirrors ground.js fpMead */
export function meadowPath(){ const p = []; for (let v = -15.5; v <= 40; v += .25) p.push([meadowU(v), v]); return [p]; }
export function riverPath(){ const p = []; for (let v = -40; v <= 45; v += .25) p.push([-1.85 + .45 * Math.sin(v * .37) + .18 * Math.sin(v * 1.1 + 2) + .05 * Math.sin(v * 3.3), v]); return p; }
export function boardSpec(W){
const { U0, U1, V0, V1 } = BOARD;

const rnd = mulberry(11);
const path = []; // mill loop -> around the paddock -> pond bank
for (let u = uM + 42; u <= uP - 15; u += 2){
  let v = 3 * Math.sin(u * .045) + 1.5 * Math.sin(u * .13 + 1);
  const t = 1 - THREE.MathUtils.smoothstep(Math.abs(u), 36, 66); v = THREE.MathUtils.lerp(v, -37 + Math.sin(u * .08) * 1.5, t);
  path.push([u, v]);
}
const PAD = 31, paddock = []; for (const [a, b] of [[[-PAD, -PAD], [PAD, -PAD]], [[PAD, -PAD], [PAD, PAD]], [[PAD, PAD], [-PAD, PAD]], [[-PAD, PAD], [-PAD, -PAD]]]){
  const h = []; for (let t = 0; t <= 1.0001; t += 1 / 40){ const u = a[0] + (b[0] - a[0]) * t, v = a[1] + (b[1] - a[1]) * t; if (Math.abs(u) < 5 && v < 0) { if (h.length > 2) paddock.push(h.splice(0)); else h.length = 0; continue; } h.push([u + Math.sin(v * .3) * .4, v + Math.sin(u * .3) * .4]); } if (h.length > 2) paddock.push(h); }
const bankCol = rgb(PAL.bank), bedA = rgb('#8fae8a'), bedB = rgb('#4f7ea0'), wheatC = rgb(PAL.wheat), pathC = rgb(PAL.path), yard = rgb('#d9c48a');
const WD = new THREE.Vector3();
return { U0, U1, V0, V1, W, seed: 5, cell: 30,
  keep: [{ u: 0, v: 0, r: 36 }, { u: uP, v: vP, r: 26 }, { u: uM, v: vM, r: 50 }], paths: [], extraHedges: paddock, // r2: lane drawn by the shader (lanePath)
  wheat: (u, v) => false && Math.abs(u) > 70 && Math.abs(u - uP) > 45 && ((Math.sin(u * .031 + 1) + Math.cos(v * .043)) > 1.45),
  stampBoxes: [[uP - 6, vP - 6, uP + 6, vP + 6], [uM - 3, vM - 3, uM + 3, vM + 3]],
  stamp(u, v){
    if (Math.abs(u - uP) < 6){ u = uP + (u - uP) / PS; v = vP + (v - vP) / PS; } else { u = uM + (u - uM) / MS; v = vM + (v - vM) / MS; }
    F.dirOf(u, v, WD);
    if (Math.abs(u - uP) < 24){ const [x, z] = pondLocal(WD), sd = pondSD(x, z);
      if (sd < 0){ const t = THREE.MathUtils.smoothstep(-sd, 0, 6); return { rgb: bankCol.map((c, i) => c + (bedA[i] - c) * Math.min(1, t * 2) + (bedB[i] - bedA[i]) * Math.max(0, t * 2 - 1)), a: 1, grass: 0, flower: 0 }; }
      if (sd < 1.3){ const a = 1 - THREE.MathUtils.smoothstep(sd, .35, 1.3); return { rgb: bankCol, a: a * .85, grass: 1 - a, flower: 0 }; } /* r5: tight sandy lip, not a blurry ochre apron */
      return null; }
    const [x, z] = millLocal(WD), r = Math.hypot(x, z), an = Math.atan2(z, x);
    // loop path
    const t = an, pr = 40 + 4 * Math.sin(3 * t) + 2 * Math.sin(5 * t + 1);
    if (false && Math.abs(r - pr) < 1.3) { const a = 1 - THREE.MathUtils.smoothstep(Math.abs(r - pr), .55, 1.3); return { rgb: pathC, a, grass: 1 - a, flower: 0 }; }
    const ry = Math.hypot(x - MILL_AT.x, z - MILL_AT.z); /* QA #20: the trimmed yard moves with the windmill */
    if (ry < 5.2) { const a = 1 - THREE.MathUtils.smoothstep(ry, 2.6, 5.2); return { rgb: yard, a: a * .7, grass: 1 - a * .7, flower: 0 }; } /* r6: trimmed mill yard */
    if (false && r > 12 && r < 35 && an > -0.95 && an < 1.05){ const e = Math.min(r - 12, 35 - r, (an + .95) * r, (1.05 - an) * r); const a = THREE.MathUtils.smoothstep(e, 0, 2); return { rgb: wheatC, a, grass: 1 - a, wheat: a, flower: 0 }; }
    return null;
  } };
}

// ---------- m-loop: the walking loop ----------
// waypoints (board u, v) from the east end of the home lane round to its west end; each region is passed at its arrival point, not
// through its centre (the pond and the bay are water). `leg` = which transition belt the following stretch belongs to (journey/belts.js)
// The station's position belongs to m-station (regions/station.js STATION_DIR, r2: 119.75, −4.58). main.js calls
// placeStation(u, v) at boot, BEFORE anything samples the loop, so the REG entry, the loop path and the belts follow it.
// ?stationAt=u,v overrides it (to try a spot). The approach and exit are laid out relative to the station: along its south
// (camera / platform) side ~3.6 m off the platform edge, round the east end of the track loop (which curves away north), then to the pond.
export const STATION_UV = [119.75, -4.58];
export function placeStation(u, v){ if (!isFinite(u) || !isFinite(v)) return; STATION_UV[0] = u; STATION_UV[1] = v; REG.find(r => r.id === 'station').dir.copy(F.dirOf(u, v)); }
export function loopWaypoints(){
  const [Su, Sv] = STATION_UV, lerp = (a, b, t) => a + (b - a) * t;
  // Meadow → Station. If the baked board's old east lane (fpLane) already runs along the platform's camera side (0.3–4.4 m south
  // of the platform edge, true for r2's 119.75,−4.58), the loop simply follows it, so there is one painted path, not two
  // parallel ones. Otherwise it meanders on its own toward a pass ~3 m south of the platform.
  const onLane = [Su - 6, Su, Su + 5].every(u => { const d = fpLane(u) - (Sv + 1.62); return d > .3 && d < 4.4; });
  const A = [24, -16.2], B = [Su - 9, Sv + 3.4], nA = Math.max(1, Math.round(Math.hypot(B[0] - A[0], B[1] - A[1]) / 12));
  const plain = []; if (onLane) for (let u = 26; u < Su - 7; u += 10) plain.push([u, null]);
  else for (let i = 0; i <= nA; i++){ const t = i / nA; plain.push([lerp(A[0], B[0], t), lerp(A[1], B[1], t) + (i && i < nA ? 1.6 * Math.sin(i * 1.7) : 0)]); }
  const pass = onLane ? [[Su - 2, null], [Su + 6, null, 'wet']] : [[Su - 2, Sv + 4.6], [Su + 6, Sv + 4.2, 'wet']];
  // Station → Pond north-west bank (63.5, −63): east past the platform, round the east end of the track (2 m tighter than r1), then a near-straight curve north-west (bow 1.5 m, was 4)
  const C = [Su + 8.5, Sv - 3], D = [64.0, -68.8], /* QA r3 #3: the pond stretch now runs along the pond's south-west bank (~0.7 m off the waterline), past the cat's arrival spot, instead of 4 m away */ nC = Math.max(2, Math.round(Math.hypot(D[0] - C[0], D[1] - C[1]) / 12));
  const wet = []; for (let i = 1; i < nC; i++){ const t = i / nC, bow = Math.sin(Math.PI * t) * 1.5; wet.push([lerp(C[0], D[0], t) + bow, lerp(C[1], D[1], t) + bow * .4]); }
  return [
    [LANE_HOME, null, 'home'], [17, null, 'plain'], ...plain, ...pass, // → station: along the platform's camera side
    [Su + 8.5, Sv + 1], C, ...wet, D, // → pond, its west bank
    [62.4, -71.8], [59.5, -74.4, 'dune'], [54, -77], [45, -80], [37.5, -83.6], [29.5, -81.4], [21, -84.2], [10.5, -80.8], [5.5, -82.9], [0, -83.4], // → seal bay: round the south of the bay on its bank (QA #16: the old line ran through the water), the spur up the lobe is in belts.js
    [-5.5, -82.9, 'wheat'], [-11, -79], [-16, -71], [-27, -64], [-40, -57], [-52, -50], [-61, -44.5], [-68.5, -41.8], // → mill yard (−72, −40)
    [-70, -36.6, 'wall'], [-63, -30], [-52, -24.5], [-40, -20.5], [-28, -17], [-19, null], [-LANE_HOME, null, 'home'], // → home lane west end
  ];
}
// the sampled loop polyline [[u, v, leg], …] every ~0.5 m (Catmull-Rom through loopWaypoints(), plus a small hand wobble)
export function loopPath(step = .5){
  const WP = loopWaypoints(), W = WP.map(([u, v]) => [u, v ?? fpLane(u)]); let leg = 'home'; const legs = WP.map(w => (leg = w[2] || leg));
  const out = [];
  for (let i = 0; i < W.length - 1; i++){
    const p0 = W[Math.max(0, i - 1)], p1 = W[i], p2 = W[i + 1], p3 = W[Math.min(W.length - 1, i + 2)], n = Math.max(2, Math.ceil(Math.hypot(p2[0] - p1[0], p2[1] - p1[1]) / step));
    for (let k = 0; k < n; k++){ const t = k / n, t2 = t * t, t3 = t2 * t;
      const c = (a, b, c_, d) => .5 * (2 * b + (-a + c_) * t + (2 * a - 5 * b + 4 * c_ - d) * t2 + (-a + 3 * b - 3 * c_ + d) * t3);
      out.push([c(p0[0], p1[0], p2[0], p3[0]), c(p0[1], p1[1], p2[1], p3[1]), legs[i]]); }
  }
  out.push([...W.at(-1), 'home']);
  // hand wobble (zero at both ends so it meets the shader lane exactly)
  // the normal comes from the un-wobbled centreline, tangent over ±2 samples (feeding back already-wobbled points kinked the ribbon at waypoint joins)
  const B = out.map(p => [p[0], p[1]]);
  let s = 0; const L = out.length; for (let i = 0; i < L; i++){ const e = Math.min(i, L - 1 - i) / 24, k = Math.min(1, e);
    if (i){ s += Math.hypot(B[i][0] - B[i - 1][0], B[i][1] - B[i - 1][1]); }
    const q0 = B[Math.max(0, i - 2)], q1 = B[Math.min(L - 1, i + 2)], a = Math.atan2(q1[1] - q0[1], q1[0] - q0[0]), w = k * (.35 * Math.sin(s * .21) + .15 * Math.sin(s * .67 + 2));
    out[i][0] += -Math.sin(a) * w; out[i][1] += Math.cos(a) * w; }
  return out;
}
// m-station merged: game/regions/station.js (createStationRegion) is present. Set false to build without it (also drop its import in main.js)
export const STATION_MODULE = true;
