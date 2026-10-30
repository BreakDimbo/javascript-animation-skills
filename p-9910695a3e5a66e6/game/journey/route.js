// the journey between regions: deterministic placements of finds, sleep stones, flower drifts and rabbit warrens along lanePath(),
// plus the "where is a region's own life" test shared by wild.js and sleep.js
import * as THREE from '../../shared/vendor/three.module.js';
import { mulberry } from '../../artkit/ground.js';
import { MF, mfCells, mfEdgeHash } from '../../artkit/minifields.js';
import { R } from '../core/util.js';
import { F, REG, loopPath, meadowPath, riverPath, uP, vP, uM, vM } from '../world.js';
import { REGIONS, activeRegions, blocked } from '../regions/registry.js';

const P = new THREE.Vector3();
const dirDist = (a, b) => a.angleTo(b) * R;
const uvDist = (u, v, a, b) => Math.hypot(u - a, v - b);

// a region keeps its own animals inside this reach: active (registry) AND within 2.6 × its card radius (≥ 22 m). activeRadius alone
// would not do: the meadow stays active for 150 m, i.e. over nearly the whole lane
export const OWN = 2.6, OWN_MIN = 22;
export const occupied = (up) => activeRegions(up).some(r => dirDist(up, r.dir) < Math.max(r.cardRadius * OWN, OWN_MIN));

// the nearest painted hedge line at (u, v) or null: { d (≤ 0, m to the line), n (3D, points toward the line) }. Mirrors ground.js:
// beyond 8–26 m from the home flock the shader keeps only 55 % of the hedge rows (hA × mix(1, .55, hFar))
export function hedgeAt(u, v){
  const d = F.dirOf(u, v); P.copy(d).multiplyScalar(R); const q = mfCells([P.x, P.y, P.z]);
  const far = THREE.MathUtils.smoothstep(Math.hypot(u - .3, v + 3), 8, 26);
  return mfEdgeHash(q.id1, q.id2) < MF.hedgeA * (1 - .45 * far) ? q : null;
}

let lane = null; const mead = meadowPath()[0], river = riverPath();
const polyDist = (pl, u, v) => { let m = 1e9; for (const [a, b] of pl) m = Math.min(m, Math.hypot(a - u, b - v)); return m; };
// spawns to keep clear (1 m), plus the region footprints (finds there are hand-placed in regions)
const SPAWNS = [[.3, -4.3], ...REG.map(r => F.toUV(r.dir))];
function laneDist(u, v){ if (!lane) lane = loopPath().map(p => [p[0], p[1]]); return polyDist(lane, u, v); }
function ok(u, v, { path = .55, hedge = false } = {}){
  const d = F.dirOf(u, v);
  if (blocked(d)) return false;
  if (SPAWNS.some(([a, b]) => uvDist(u, v, a, b) < 1.2)) return false;
  if (REGIONS.some(r => dirDist(d, r.dir) < (r.id === 'meadow' ? 9 : Math.max(r.cardRadius, 9) + 4))) return false;
  if (Math.abs(u) < 14 && v > -22 && v < 6) return false; // the home frame and its lane foot stay as they are
  if (laneDist(u, v) < path || polyDist(mead, u, v) < .8 || (Math.abs(u) < 12 && polyDist(river, u, v) < 1.2)) return false;
  const q = hedgeAt(u, v); if (q && Math.abs(q.d) < .22 && !hedge) return false;
  return true;
}

// a 3D tangent vector n at (u, v) → unit board (du, dv)
const _e = new THREE.Vector3(), _f = new THREE.Vector3();
function uvOf(u, v, n){ const d = F.dirOf(u, v); _e.copy(F.dirOf(u + .01, v)).sub(d); _f.copy(F.dirOf(u, v + .01)).sub(d);
  const a = n[0] * _e.x + n[1] * _e.y + n[2] * _e.z, b = n[0] * _f.x + n[1] * _f.y + n[2] * _f.z, l = Math.hypot(a, b) || 1; return [a / l, b / l]; }
// a point well inside one painted hedge row: the same two fields meet on both sides of it 0.8 m and 1.4 m away (the shader tapers a
// hedge to nothing toward a junction, where a third field appears)
const samePair = (a, b) => (a.id1 + '' === b.id1 + '' && a.id2 + '' === b.id2 + '') || (a.id1 + '' === b.id2 + '' && a.id2 + '' === b.id1 + '');
function midHedge(u, v, q){
  for (const r of [.8, 1.4]){ let n = 0; for (let k = 0; k < 12; k++){ const a = k / 12 * 6.283, p = hedgeAt(u + Math.cos(a) * r, v + Math.sin(a) * r); if (p && samePair(p, q) && Math.abs(p.d) < r * .5) n++; }
    if (n < 2) return false; }
  return true;
}

export function buildRoute(){
  lane = loopPath().map(p => [p[0], p[1]]); // sampled here, not at import, so placeStation() (main.js) has run
  const rnd = mulberry(2026), finds = [], sleep = [], drifts = [], warrens = [];
  // cumulative arc length
  const L = [0]; for (let i = 1; i < lane.length; i++) L.push(L[i - 1] + Math.hypot(lane[i][0] - lane[i - 1][0], lane[i][1] - lane[i - 1][1]));
  const at = (s) => { let i = 1; while (i < L.length - 1 && L[i] < s) i++; const t = (s - L[i - 1]) / (L[i] - L[i - 1] || 1), a = lane[i - 1], b = lane[i];
    return { u: a[0] + (b[0] - a[0]) * t, v: a[1] + (b[1] - a[1]) * t, yaw: Math.atan2(b[1] - a[1], b[0] - a[0]) }; };
  const KINDS = ['catnip', 'log', 'yarn', 'warmstone', 'stile', 'birdbath', 'catnip', 'log', 'mitten', 'warmstone', 'stile']; // the red mitten: one lost glove, not a theme
  const spaced = (u, v, m = 3) => finds.every(f => uvDist(f.u, f.v, u, v) > m);
  // (1) one find every 15–25 m along the lane, 0.8–3.4 m to either side
  let k = 0, s = 30;
  while (s < L[L.length - 1] - 30){
    const base = at(s);
    for (let tries = 0; tries < 10; tries++){
      const side = rnd() < .5 ? -1 : 1, off = .8 + rnd() * 2.6;
      const u = base.u - Math.sin(base.yaw) * side * off, v = base.v + Math.cos(base.yaw) * side * off;
      let kind = KINDS[k % KINDS.length]; if (tries > 4) kind = 'catnip';
      if (kind === 'stile'){ // a stile sits ON a hedge gap: nearest hedge point within a few metres of the lane
        let best = null; for (let dx = -5; dx <= 5; dx += .5) for (let dy = -5; dy <= 5; dy += .5){ const q = hedgeAt(base.u + dx, base.v + dy);
          if (q && Math.abs(q.d) < .5 && (!best || Math.hypot(dx, dy) < best.r) && midHedge(base.u + dx, base.v + dy, q)){
            // slide onto the painted line itself (q.d is the distance to it along n)
            const x = base.u + dx, y = base.v + dy, [nu, nv] = uvOf(x, y, q.n), x2 = x + nu * -q.d, y2 = y + nv * -q.d;
            if (ok(x2, y2, { hedge: true })) best = { r: Math.hypot(dx, dy), u: x2, v: y2, yaw: Math.atan2(nu, -nv) }; } }
        if (!best) { k++; kind = KINDS[k % KINDS.length]; } else { finds.push({ kind, u: best.u, v: best.v, yaw: best.yaw }); k++; break; }
      }
      if (ok(u, v)){ finds.push({ kind, u, v, yaw: rnd() * 6.28 }); k++; break; }
    }
    s += 15 + rnd() * 10;
  }
  // (2) wildflower drifts (the butterflies' places) every 26–34 m, half a beat out of step with the finds
  for (let s2 = 42; s2 < L[L.length - 1] - 30; s2 += 26 + rnd() * 8){
    const base = at(s2);
    for (let tries = 0; tries < 12; tries++){ const side = rnd() < .5 ? -1 : 1, off = 1.2 + rnd() * 3.5, u = base.u - Math.sin(base.yaw) * side * off, v = base.v + Math.cos(base.yaw) * side * off;
      if (ok(u, v, { path: .9 }) && spaced(u, v)){ const f = { kind: 'drift', u, v, yaw: rnd() * 6.28 }; finds.push(f); drifts.push(f); break; } }
  }
  // (3) off the lane: a loose scatter (≥ 6 m apart) over the band 2.5–13 m either side, about one per 9 m of lane, so wherever the cat
  // strays a frame (6.6 × 9.2 m) holds about one small thing. Common kinds are weighted up; the red mitten stays rare
  const NOFF = Math.round(L[L.length - 1] / 9), OFFK = [['catnip', 3], ['log', 3], ['warmstone', 3], ['drift', 3], ['yarn', 1], ['birdbath', 1], ['mitten', .3]];
  const pick = () => { let x = rnd() * OFFK.reduce((a, k) => a + k[1], 0); for (const [k, wt] of OFFK){ if ((x -= wt) < 0) return k; } return 'catnip'; };
  for (let n = 0, tries = 0; n < NOFF && tries < 4000; tries++){
    const b = at(15 + rnd() * (L[L.length - 1] - 30)), side = rnd() < .5 ? -1 : 1, off = 2.5 + rnd() * 10.5, along = (rnd() - .5) * 4;
    const x = b.u - Math.sin(b.yaw) * side * off + Math.cos(b.yaw) * along, y = b.v + Math.cos(b.yaw) * side * off + Math.sin(b.yaw) * along;
    if (!ok(x, y, { path: 1.5 }) || !spaced(x, y, 6)) continue;
    const f = { kind: pick(), u: x, v: y, yaw: rnd() * 6.28 }; finds.push(f); if (f.kind === 'drift') drifts.push(f); n++;
  }
  // sleep stones (save points): one at each region seam (mill, meadow, pond, seal bay) and two in the long stretches
  const SLEEP = [[.007, 'stone'], [.3, 'cushion'], [.5, 'stone'], [.7, 'cushion'], [.9, 'stone']]; // m-loop: fractions of the loop's length
  for (const [fr, kind] of SLEEP){
    const b0 = at(L[L.length - 1] * fr), best = [b0.u, b0.v]; let done = false;
    for (let t = 0; t < 60 && !done; t++){ const side = t % 2 ? -1 : 1, off = 1 + (t >> 1) * .3, u = best[0] + (t * 1.7 % 5 - 2), v = best[1] + side * off;
      if (ok(u, v)){ sleep.push({ kind: kind === 'stone' ? 'sleepStone' : 'sleepCushion', u, v, yaw: rnd() * 6.28 }); done = true; } } }
  { const sb = F.toUV(REG[3].dir); // the seal bay seam: on the open grass south of its card, on the way from home
    for (let t = 0; t < 80; t++){ const u = sb[0] + 1.5 + (t % 7) * .8, v = sb[1] + 17 + (t >> 3) * 1.2; if (ok(u, v)){ sleep.push({ kind: 'sleepCushion', u, v, yaw: .7 }); break; } } }
  // rabbit warrens: about every 13–20 m along the lane, a mid-row point of a painted hedge within 9 m of it (rabbits sit on its field side)
  for (let s2 = 18; s2 < L[L.length - 1] - 18; s2 += 13 + rnd() * 7){
    const b = at(s2); let best = null;
    for (let dx = -9; dx <= 9; dx += .5) for (let dy = -9; dy <= 9; dy += .5){ const x = b.u + dx, y = b.v + dy, q = hedgeAt(x, y);
      if (!q || Math.abs(q.d) > .5 || !midHedge(x, y, q) || !ok(x, y, { hedge: true, path: 1.4 })) continue;
      const r = Math.hypot(dx, dy) + rnd() * 2; if (!best || r < best.r) best = { r, u: x, v: y, q }; }
    if (best) warrens.push({ u: best.u, v: best.v, n: best.q.n, dist: Math.abs(best.q.d) });
  }
  return { finds, sleep, drifts, warrens };
}
