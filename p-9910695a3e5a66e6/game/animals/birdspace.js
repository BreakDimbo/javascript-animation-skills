// 动物互动 · bird space (mill r5, QA #21): keeps every bird's drawn outline ≥ a set gap from every other bird's, at all times —
// spawn, pecking, stepping, hopping and running alike — and keeps the birds out of the props (windmill, cottage, sacks, donkey, the lane).
// Each bird is an ellipse about its footprint (centre offset c along its facing, half-length hl, half-width hw, all in the caller's
// metres) that contains the drawn mesh in every pose. Two layers: steer() bends a take-off / step heading toward the nearest clear
// direction, and solve() does a soft drift inside a band past the gap, then pushes out any remaining shortfall (split between the pair).
// Optional chicks (b.mum = a bird) are held within `leash` of their hen's outline but never closer than the gap.
const hyp = Math.hypot;
// support extent of a bird's ellipse along unit (ux, uz), measured from its centre point (x, z)
function ext(b, ux, uz){ const fx = Math.sin(b.yaw), fz = Math.cos(b.yaw), a = ux * fx + uz * fz, r = ux * fz - uz * fx; return hyp(b.hl * a, b.hw * r) ; }
const cx = (b) => b.x + Math.sin(b.yaw) * (b.c || 0), cz = (b) => b.z + Math.cos(b.yaw) * (b.c || 0);
// lower bound of the outline gap between two birds (projection gap on the centre line; ≤ the true distance between the ellipses)
export function pairGap(a, b){ const ax = cx(a), az = cz(a), dx = cx(b) - ax, dz = cz(b) - az, d = hyp(dx, dz) || 1e-6, ux = dx / d, uz = dz / d;
  return { g: d - ext(a, ux, uz) - ext(b, ux, uz), ux, uz, d }; }

/* props: { kind: 'circle', x, z, r } | { kind: 'box', x, z, yaw, hx, hz } (yaw as the b4 frame(): local x → (cos, −sin), local z → (sin, cos))
          | { kind: 'ellipse', get: () => ({ x, z, yaw, hl, hw, c }) } | { kind: 'poly', pts: [[x, z], …], half } (a lane centre line + half width)
          any prop may carry cap (m/s): its hard push-out is limited to cap·dt per frame */
function propNear(p, x, z){ // closest point of the prop to (x, z) and the signed distance from it (negative inside)
  if (p.kind === 'circle'){ const dx = x - p.x, dz = z - p.z, d = hyp(dx, dz) || 1e-6; return { ux: dx / d, uz: dz / d, s: d - p.r }; }
  if (p.kind === 'box'){ const c = Math.cos(p.yaw), s = Math.sin(p.yaw), dx = x - p.x, dz = z - p.z;
    const lx = dx * c - dz * s, lz = dx * s + dz * c; // into box-local
    const qx = Math.max(-p.hx, Math.min(p.hx, lx)), qz = Math.max(-p.hz, Math.min(p.hz, lz)); let ex = lx - qx, ez = lz - qz, d = hyp(ex, ez), sd = d;
    if (d < 1e-6){ const mx = p.hx - Math.abs(lx), mz = p.hz - Math.abs(lz); if (mx < mz){ ex = Math.sign(lx) || 1; ez = 0; sd = -mx; } else { ex = 0; ez = Math.sign(lz) || 1; sd = -mz; } d = 1; }
    ex /= d; ez /= d; return { ux: ex * c + ez * s, uz: -ex * s + ez * c, s: sd }; }
  if (p.kind === 'poly'){ let best = 1e9, bx = 0, bz = 0; const P = p.pts;
    for (let i = 1; i < P.length; i++){ const [x0, z0] = P[i - 1], [x1, z1] = P[i], sx = x1 - x0, sz = z1 - z0, L2 = sx * sx + sz * sz || 1e-9;
      const t = Math.max(0, Math.min(1, ((x - x0) * sx + (z - z0) * sz) / L2)), qx = x0 + sx * t, qz = z0 + sz * t, d = hyp(x - qx, z - qz); if (d < best){ best = d; bx = qx; bz = qz; } }
    const d = best || 1e-6; return { ux: (x - bx) / d, uz: (z - bz) / d, s: best - p.half }; }
  return null; }
export function propGap(b, p){
  if (p.kind === 'ellipse'){ const e = p.get(); return pairGap(b, e); }
  const x = cx(b), z = cz(b), n = propNear(p, x, z); return { g: n.s - ext(b, -n.ux, -n.uz), ux: -n.ux, uz: -n.uz }; } // u points from the bird toward the prop

export function createBirdSpace({ gap = 1, soft = .5, rate = 1, propGap: pGap = gap, propSoft = soft, leash = Infinity, props = [] } = {}){
  const S = { gap, soft, rate, pGap, propSoft, leash, props, birds: [] };
  function set(o){ Object.assign(S, o); }
  function add(b){ S.birds.push(b); return b; }
  // clearance left if bird b stood at (x, z) facing yaw: min over other birds and props of (gap − required)
  function clearAt(b, x, z, yaw){ const t = { ...b, x, z, yaw }; let m = 1e9;
    for (const o of S.birds){ if (o === b) continue; m = Math.min(m, pairGap(t, o).g - S.gap); }
    for (const p of S.props){ if (p.skip && p.skip(b)) continue; m = Math.min(m, propGap(t, p).g - S.pGap); }
    return m; }
  // the heading nearest `ang` (within ±1.6 rad) whose end point after `dist` keeps the gap with margin; the original if none is better
  function steer(b, ang, dist, margin = 0){ let best = ang, bs = -1e9;
    for (const da of [0, .25, -.25, .5, -.5, .8, -.8, 1.15, -1.15, 1.6, -1.6]){ const a = ang + da, ex = b.x + Math.sin(a) * dist, ez = b.z + Math.cos(a) * dist;
      const c = Math.min(clearAt(b, ex, ez, a), clearAt(b, b.x + Math.sin(a) * dist * .5, b.z + Math.cos(a) * dist * .5, a)) - margin;
      const sc = (c >= 0 ? 10 : c) - Math.abs(da) * .3; if (sc > bs){ bs = sc; best = a; } }
    return best; }
  function moveBy(b, dx, dz){ b.x += dx; b.z += dz; }
  function pairs(dt, hard){ const B = S.birds;
    for (let i = 0; i < B.length; i++) for (let j = i + 1; j < B.length; j++){ const a = B[i], b = B[j], { g, ux, uz } = pairGap(a, b);
      const ka = a.pinned ? 0 : 1, kb = b.pinned ? 0 : 1, kk = ka + kb; if (!kk) continue;
      if (!hard && g < S.gap + S.soft){ const f = 1 - Math.max(0, g - S.gap) / S.soft, v = f * f * S.rate * dt; moveBy(a, -ux * v * ka / kk, -uz * v * ka / kk); moveBy(b, ux * v * kb / kk, uz * v * kb / kk); }
      if (g < S.gap){ const v = (S.gap - g) * 1.001; moveBy(a, -ux * v * ka / kk, -uz * v * ka / kk); moveBy(b, ux * v * kb / kk, uz * v * kb / kk); } } }
  function propsPass(dt, hard){
    for (const b of S.birds){ if (b.pinned) continue;
      for (const p of S.props){ if (p.skip && p.skip(b)) continue; const { g, ux, uz } = propGap(b, p);
        if (!hard && g < S.pGap + S.propSoft){ const f = 1 - Math.max(0, g - S.pGap) / S.propSoft, v = f * f * S.rate * dt; moveBy(b, -ux * v, -uz * v); }
        if (g < S.pGap){ let v = (S.pGap - g) * 1.001; if (p.cap && S.fdt){ v = Math.min(v, Math.max(0, p.cap * S.fdt - (b._cap || 0))); b._cap = (b._cap || 0) + v; } moveBy(b, -ux * v, -uz * v); } } } }
  function leashPass(){ // chicks: outline gap to their hen within [gap, leash]
    for (const b of S.birds){ if (!b.mum || b.pinned) continue; const { g, ux, uz } = pairGap(b.mum, b); if (g > S.leash){ const v = g - S.leash; moveBy(b, -ux * v, -uz * v); } } }
  // one frame: soft drift + hard push, 3 passes, props after pairs, then a last pairs pass (a prop push can't leave two birds touching)
  // r4: a prop with cap (m/s) is pushed out of at most cap·dt per frame (a moving prop — the dormouse — eases a squeezed hen aside, never pops it); settle() is uncapped
  function solve(dt, iters = 3){ S.fdt = dt; for (const b of S.birds) b._cap = 0; for (let k = 0; k < iters; k++){ leashPass(); pairs(k ? 0 : dt, k > 0); propsPass(k ? 0 : dt, k > 0); } pairs(0, true); propsPass(0, true); pairs(0, true); }
  // spawn: settle hard (also used to spread the yard homes)
  function settle(n = 60){ S.fdt = 0; for (let k = 0; k < n; k++){ leashPass(); pairs(0, true); propsPass(0, true); } }
  function minGap(){ let m = 1e9; const B = S.birds; for (let i = 0; i < B.length; i++) for (let j = i + 1; j < B.length; j++) m = Math.min(m, pairGap(B[i], B[j]).g); return m; }
  return { set, add, steer, clearAt, solve, settle, minGap, S };
}
