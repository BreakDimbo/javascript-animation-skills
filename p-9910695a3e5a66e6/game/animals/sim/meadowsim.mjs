// node game/animals/sim/meadowsim.mjs <seed>   (HC=0.281: fallback cat height; OFF=1: board off = planet/?close/?noboard path)
// 120 s at 60 Hz of the meadow flock under the r5 board keep-in, with the camera board of artkit/dioramacam.js following a scripted cat
// (strolls the flock, runs at sheep, drags the view round, then leaves right toward 小站 · The Halt). Prints the min drawn-outline clearance to
// the painted board edge (Hc), to the label strip (m, < 0 = inside), and how fast the keep-in moved / faded anything.
import './stub.mjs';
const L = new URL('../../..', import.meta.url).pathname.replace(/\/$/, '');
const THREE = await import(L + '/shared/vendor/three.module.js');
let seed = +(process.argv[2] || 1); const rng = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
const cs = await import(L + '/game/catScale.js'); cs.setCatHc(+(process.env.HC || 0.349), 'sim');
const W = await import(L + '/game/world.js'); const { mulberry } = await import(L + '/artkit/ground.js');
const SH = await import(L + '/game/animals/sheep.js');
// HOMES exactly as meadow.js builds them (its layout block, evaluated here)
const src = (await import('fs')).readFileSync(L + '/game/regions/meadow.js', 'utf8');
const blk = src.slice(src.indexOf('const SPAWN'), src.indexOf("throw new Error('meadow: no flock layout'); })();") + "throw new Error('meadow: no flock layout'); })();".length);
const tsrc = (await import('fs')).readFileSync(L + '/game/props/trees.js', 'utf8'), RIM = eval(tsrc.slice(tsrc.indexOf('export const RIM = ') + 19, tsrc.indexOf('];', tsrc.indexOf('export const RIM = ')) + 1)); // (trees.js needs a window)
const { HOMES, SPAWN, hedgeNear, offHedge, hedgeFade, HEDGE_HW, sheepR } = new Function('mulberry', 'meadowU', 'RIM', 'KEEP', blk + '; return { HOMES, GROUP, SPAWN, hedgeNear, offHedge, hedgeFade, HEDGE_HW, sheepR };')(mulberry, W.meadowU, RIM, SH.KEEP);
const NSHOW = 9, WAN = .42, wander = (x) => WAN * Math.tanh(x / 7), ADULT_K = 1.18, LAMB_K = .72;
const MUM = HOMES.reduce((b, [a, c], i) => b < 0 || Math.hypot(a - SPAWN[0], c - SPAWN[1]) < Math.hypot(HOMES[b][0] - SPAWN[0], HOMES[b][1] - SPAWN[1]) ? i : b, -1);
const hc = SH.hcNow(), lc = SH.lcNow(), minds = SH.createSheepMinds(HOMES.length, mulberry(91)), keep = SH.createKeepIn();
const size = HOMES.map(() => 1 + rng() * .25); // b2 sizes ≤ 1.25 (worst case)
const drift = HOMES.map(() => ({ a: rng() * 6, b: rng() * 6, w: .03 + rng() * .05, amp: 2 + rng() * 6, hd: rng() * 6 }));
// the camera board (dioramacam, catLen .45 → k2 1): target eases to the cat at 3.2/s, centre = target + 0.75·yaw, hx 3.3 across, hy 4.6 along yaw
const up0 = W.F.dirOf(SPAWN[0], SPAWN[1]); const e = new THREE.Vector3(0, 1, 0).cross(up0).normalize(), n = e.clone().cross(up0).negate(); // camrig initYaw (cyaw 0)
const yu0 = W.F.toUV(up0.clone().multiplyScalar(W.R).add(n)); let yaw = Math.atan2(yu0[1] - SPAWN[1], yu0[0] - SPAWN[0]);
const ST = W.F.toUV(W.REG.find(r => r.id === 'station').dir);
// the cat's script: waypoints (u, v, speed m/s), view drags at set times
const WP = [[.3, -4.3, 0], [1.6, -3.0, .7], ...HOMES.slice(0, NSHOW).map(([a, b], i) => [a + (i % 2 ? .5 : -.5), b + .3, i % 3 === 0 ? 1.8 : .8]), [2.6, -2.2, 1.6], [4.5, -2.6, .9], [7.5, -2.8, 1.2], [9, -3, 1.2]];
const DRAG = process.env.NODRAG ? [] : [[38, .9], [52, -1.4], [70, .6]]; // (t s, rad over 1.5 s)
const B = { on: !process.env.OFF, cu: 0, cv: 0, Xu: 1, Xv: 0, Yu: 0, Yv: 1, hx: 3.3, hy: 4.6, band: null }, band = { s: 1, a: 0, x0: 0, y0: 0, y1: 0 };
let cat = { u: SPAWN[0], v: SPAWN[1], fu: 1, fv: 0, speed: 0 }, tgt = { u: cat.u, v: cat.v }, wi = 1, pause = 0;
const dt = 1 / 60, R = { edge: 1e9, edgeAt: null, rect: 1e9, sign: 1e9, signAt: null, mv: 0, da: 0, fadeMin: 1, fades: 0, lamb: 1e9, spawnA: 1, hold: 0, jump: 0, bandT: 0 };
const prev = new Map(), faded = new Set();
// r6: the hedge band (meadow.js HEDGES, NOHEDGE=1: off): clearance of a sheep's ground radius to the band for any drawn sheep (alpha > .01) and for
// fully drawn ones (alpha ≥ .99); hedgeFaded = sheep the board-vs-hedge conflict dissolved below .99 at some point
const HOFF = !!process.env.NOHEDGE; R.hedge = 1e9; R.hedgeFull = 1e9; const hfaded = new Set();
for (let f = 0; f < 120 * 60; f++){ const t = f * dt;
  // cat
  if (pause > 0) { pause -= dt; cat.speed = 0; } else if (wi < WP.length){ const [gu, gv, sp] = WP[wi], du = gu - cat.u, dv = gv - cat.v, d = Math.hypot(du, dv);
    if (d < .05){ wi++; pause = 1.5 + rng() * 3; } else { const s = Math.min(d, sp * dt); cat.u += du / d * s; cat.v += dv / d * s; cat.fu = du / d; cat.fv = dv / d; cat.speed = sp; } }
  else { cat.speed = 0; if (wi === WP.length){ wi++; } }
  if (t > 100 && wi > WP.length && t < 101) { WP.push([cat.u - 6, cat.v - 1, 1.2]); } // back into the meadow
  for (const [t0, a] of DRAG) if (t >= t0 && t < t0 + 1.5) yaw += a * dt / 1.5;
  const k = 1 - Math.exp(-dt * 3.2); tgt.u += (cat.u - tgt.u) * k; tgt.v += (cat.v - tgt.v) * k;
  const Yu = Math.cos(yaw), Yv = Math.sin(yaw); B.Yu = Yu; B.Yv = Yv; B.Xu = Yv; B.Xv = -Yu; B.cu = tgt.u + .75 * Yu; B.cv = tgt.v + .75 * Yv;
  // the label strip (meadow.js r5 / loop group D4): label on a side edge → BAND_W inside it, cat row → BAND_D toward the camera; eased 1/s
  { const [ccx, ccy] = keep.toB(cat.u, cat.v, B), [ex, ey] = keep.toB(ST[0], ST[1], B), dl = Math.hypot(ex - ccx, ey - ccy), dx = (ex - ccx) / dl, dy = (ey - ccy) / dl;
    const tx = Math.abs(dx) > 1e-6 ? ((dx > 0 ? B.hx : -B.hx) - ccx) / dx : Infinity, ty = Math.abs(dy) > 1e-6 ? ((dy > 0 ? B.hy : -B.hy) - ccy) / dy : Infinity;
    const on = tx <= ty && tx > 0, sd = dx > 0 ? 1 : -1;
    if (on && (band.a === 0 || band.s === sd)){ band.s = sd; band.y0 = ccy - SH.KEEP.BAND_D; band.y1 = ccy; band.a = Math.min(1, band.a + dt); } else band.a = Math.max(0, band.a - dt);
    band.x0 = B.hx - SH.KEEP.BAND_W; B.band = band.a > 0 ? band : null; if (band.a === 1) R.bandT += dt; }
  const CAT = { ...cat, vu: Yu, vv: Yv };
  const P = [];
  for (let i = 0; i < NSHOW; i++){ const D = drift[i], H0 = HOMES[i], du = wander(D.amp * Math.sin(t * D.w + D.a)), dv = wander(D.amp * Math.cos(t * D.w * .8 + D.b));
    const km = minds.step(i, H0[0] + du, H0[1] + dv, D.hd + .2 * Math.sin(t * .1 + i), CAT, dt), H = ADULT_K * hc * (1 + (size[i] - 1) * .5);
    const [su, sv] = HOFF ? [H0[0] + du + km.du, H0[1] + dv + km.dv] : offHedge(i, H0[0] + du + km.du, H0[1] + dv + km.dv, H), [pu, pv, a, mv] = keep.apply(i, su, sv, H, B, dt, hc, lc, HOFF ? undefined : hedgeFade); P.push([i, pu, pv, a, mv, H]); }
  { const mu = minds.S[MUM], H0 = HOMES[MUM], D = drift[MUM], b = minds.stepLamb(H0[0] + wander(D.amp * Math.sin(t * D.w + D.a)) + mu.du, H0[1] + wander(D.amp * Math.cos(t * D.w * .8 + D.b)) + mu.dv, CAT, dt);
    const [lsu, lsv] = HOFF ? [b.u, b.v] : offHedge('lamb', b.u, b.v, LAMB_K * hc), [lu, lv, la, lmv] = keep.apply('lamb', lsu, lsv, LAMB_K * hc, B, dt, hc, lc, HOFF ? undefined : hedgeFade); P.push(['lamb', lu, lv, la, lmv, LAMB_K * hc]); }
  for (const [id, u, v, a, mv, H] of P){ const p = prev.get(id);
    if (p){ R.da = Math.max(R.da, Math.abs(a - p.a) / dt); if (a > .01 && p.a > .01) { const sp = Math.hypot(u - p.u, v - p.v) / dt; if (sp > R.jump){ R.jump = sp; R.jumpAt = [id, +t.toFixed(2), +a.toFixed(2)]; } } }
    prev.set(id, { u, v, a }); if (f === 0) R.spawnA = Math.min(R.spawnA, a);
    if (a < .999) faded.add(id);
    if (a <= .01) continue;
    { const hc_ = hedgeNear(u, v)[0] - HEDGE_HW - sheepR(H); if (hc_ < R.hedge){ R.hedge = hc_; R.hedgeAt = [id, +t.toFixed(2), +a.toFixed(2)]; } if (a >= .99) R.hedgeFull = Math.min(R.hedgeFull, hc_); if (hc_ < .05 && a < .99) hfaded.add(id); }
    R.mv = Math.max(R.mv, mv);
    const c = keep.clearance(u, v, H, B, hc); if (c.painted / hc < R.edge){ R.edge = c.painted / hc; R.edgeAt = [id, +t.toFixed(2)]; } R.rect = Math.min(R.rect, c.rect / hc);
    if (B.band && B.band.a === 1 && c.sign < R.sign){ R.sign = c.sign; R.signAt = [id, +t.toFixed(2)]; } }
}
const f2 = (x) => +x.toFixed(3);
console.log(JSON.stringify({ seed: process.argv[2] || 1, hc, board: B.on, minEdgeHc_painted: f2(R.edge), at: R.edgeAt, minEdgeHc_rect: f2(R.rect), minBandClear_m: f2(R.sign), bandAt: R.signAt, bandFullOn_s: f2(R.bandT),
  maxKeepSpeed_ms: f2(R.mv), maxSheepSpeed_ms: f2(R.jump), jumpAt: R.jumpAt, maxAlphaRate_s: f2(R.da), faded: [...faded], spawnMinAlpha: f2(R.spawnA), minHedgeClear_m: f2(R.hedge), hedgeAt: R.hedgeAt, minHedgeClearFull_m: f2(R.hedgeFull), hedgeFaded: [...hfaded] }));
