// m-loop: the readable loop path and the four transition belts between the regions.
//   path   — a worn earth footpath painted on the ground (paint.js), continuing the shader lane from both ends of the home stretch
//   wet    — Station → Pond: damp darker grass, reed ditches beside the way, stepping stones on a faint damp track
//   dune   — Pond → Seal Bay: low sand dunes (real relief via heightAt), sand washes, marram / seagrass tufts, a pale sandy track
//   wheat  — Seal Bay → Mill: straw fields either side, wheat tufts swaying in slow travelling waves
//   wall   — Mill → Meadow: dry-stone walls (with gaps) both sides of a narrow footpath; the cat can't walk through them
// Everything is matte clay / gouache: no glow, no particles, no outlines. Props are chunked (~16 m) so off-screen chunks cull.
import * as THREE from '../../shared/vendor/three.module.js';
import { mulberry } from '../../artkit/ground.js';
import { clayMaterial } from '../../artkit/clay.js';
import { R, note, qs, MOBILE } from '../core/util.js';
import { F, REG, loopPath } from '../world.js';
import { paintMaterial, paintBuilder, lin, poseAt } from './paint.js';

const C = THREE.MathUtils.clamp, SS = THREE.MathUtils.smoothstep;
const COL = { path: lin('#dcc08a'), pathE: lin('#bea66e'), damp: lin('#b9a57a'), dampE: lin('#9c9467'), sand: lin('#ecdcb0'), sandE: lin('#d8c48e'),
  wet: lin('#5f8f48'), wetE: lin('#6e9a4e'), ditch: lin('#4f7b98'), ditchE: lin('#7d9a5c'), straw: lin('#dcc277'), strawE: lin('#ccb25e'),
  dune: lin('#e6d5a6'), duneE: lin('#d7c690') };

// the loop with arc length, tangent and per-leg weights (each belt ramps in/out over 9 m so it dissolves into its neighbours)
export function loopInfo(){
  const P = loopPath(); const S = [0]; for (let i = 1; i < P.length; i++) S.push(S[i - 1] + Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]));
  const legs = {}; P.forEach((p, i) => { const L = legs[p[2]] || (legs[p[2]] = { s0: S[i], s1: S[i] }); L.s1 = S[i]; });
  const w = (leg, s) => { const L = legs[leg]; if (!L) return 0; return SS(s, L.s0 - 4, L.s0 + 9) * (1 - SS(s, L.s1 - 9, L.s1 + 4)); };
  const at = (s) => { let lo = 0, hi = S.length - 1; while (hi - lo > 1){ const m = (lo + hi) >> 1; if (S[m] < s) lo = m; else hi = m; }
    const a = P[lo], b = P[hi], t = C((s - S[lo]) / ((S[hi] - S[lo]) || 1), 0, 1), tx = b[0] - a[0], ty = b[1] - a[1], l = Math.hypot(tx, ty) || 1;
    return { u: a[0] + tx * t, v: a[1] + ty * t, tu: tx / l, tv: ty / l, nu: -ty / l, nv: tx / l, yaw: Math.atan2(ty, tx) }; };
  return { P, S, L: S.at(-1), legs, w, at };
}

// nearest point of the loop to (u, v): { d, s } (coarse grid hash over the vertices)
function nearIndex(P, S){
  const H = new Map(), K = (i, j) => i * 4096 + j; P.forEach((p, k) => { const key = K(Math.floor(p[0] / 4), Math.floor(p[1] / 4)); (H.get(key) || H.set(key, []).get(key)).push(k); });
  return (u, v) => { const i0 = Math.floor(u / 4), j0 = Math.floor(v / 4); let bd = 1e9, bs = -1;
    for (let i = i0 - 1; i <= i0 + 1; i++) for (let j = j0 - 1; j <= j0 + 1; j++) for (const k of H.get(K(i, j)) || []){ const d = Math.hypot(P[k][0] - u, P[k][1] - v); if (d < bd){ bd = d; bs = S[k]; } }
    return { d: bd, s: bs }; };
}

// ---------- terrain: the dunes (a pseudo-region: heightAt + blocked only; registered before the ground grid is built) ----------
// keep the belts off the regions' own ground: 0 inside a region (the bay water gets a wide berth), 1 a few metres out
const KEEP = { sealbay: 20, pond: 11, mill: 11, station: 8 };
export function beltMask(u, v){ let k = 1; for (const r of REG){ const rr = KEEP[r.id]; if (!rr) continue; const [ru, rv] = r.uv || (r.uv = F.toUV(r.dir)); const d = Math.hypot(u - ru, v - rv);
  k = Math.min(k, THREE.MathUtils.smoothstep(d, rr, rr + 6)); } return k; }
export function createBeltTerrain(info){
  const rnd = mulberry(707), dunes = [], walls = [];
  const D = info.legs.dune;
  if (D) for (let s = D.s0 + 6; s < D.s1 - 5; s += 2.2 + rnd() * 2.4){ const a = info.at(s), k = info.w('dune', s); if (k < .3) continue;
    for (const side of [-1, 1]){ if (rnd() < .25) continue; const off = 1.6 + rnd() * 3.4, r = 1.1 + rnd() * 1.6;
      const du = a.u + a.nu * side * off, dv = a.v + a.nv * side * off, km = beltMask(du, dv); if (km < .05) continue;
      dunes.push({ u: du, v: dv, r, h: (.10 + rnd() * .16) * k * km, rx: r * (1.3 + rnd() * .6), ry: r, th: a.yaw + (rnd() - .5) * .8 }); } }
  // dry-stone wall runs: both sides of the Mill → Meadow footpath, 3–8 m long with 1–2.5 m gaps
  const Wl = info.legs.wall;
  if (Wl) for (const side of [-1, 1]){ let s = Wl.s0 + 7 + rnd() * 2; while (s < Wl.s1 - 10){ const len = 3 + rnd() * 5; const pts = [];
    for (let t = s; t < Math.min(s + len, Wl.s1 - 8); t += .07){ const a = info.at(t), off = .4 + .05 * Math.sin(t * .4 + side); pts.push([a.u + a.nu * side * off, a.v + a.nv * side * off, a.yaw]); }
    if (pts.length > 8) walls.push(pts); s += len + 1 + rnd() * 1.5; } }
  // spatial hash of wall points for blocked()
  const WH = new Map(), K = (u, v) => Math.floor(u * 2) * 8192 + Math.floor(v * 2);
  for (const w of walls) for (const p of w){ const k = K(p[0], p[1]); (WH.get(k) || WH.set(k, []).get(k)).push(p); }
  // bounding caps for a cheap reject
  const cap = (pts) => { if (!pts.length) return null; let u = 0, v = 0; for (const p of pts){ u += p.u ?? p[0]; v += p.v ?? p[1]; } u /= pts.length; v /= pts.length;
    let r = 0; for (const p of pts) r = Math.max(r, Math.hypot((p.u ?? p[0]) - u, (p.v ?? p[1]) - v) + (p.rx || 0) * 2.2); return { dir: F.dirOf(u, v), cos: Math.cos((r + 2) / R) }; };
  const dCap = cap(dunes), wCap = cap(walls.flat());
  const uv = new THREE.Vector3();
  function heightAt(d){ if (!dCap || d.dot(dCap.dir) < dCap.cos) return 0; const [u, v] = F.toUV(d); let h = 0;
    for (const q of dunes){ const du = u - q.u, dv = v - q.v; if (Math.abs(du) > q.rx * 2.2 || Math.abs(dv) > q.rx * 2.2) continue;
      const c = Math.cos(q.th), s = Math.sin(q.th), x = (du * c + dv * s) / q.rx, y = (-du * s + dv * c) / q.ry, r2 = x * x + y * y; if (r2 < 4) h += q.h * Math.exp(-r2 * 1.4) * (1 - r2 / 4); }
    return h; }
  function blocked(d){ if (!wCap || d.dot(wCap.dir) < wCap.cos) return false; const [u, v] = F.toUV(d);
    for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) for (const p of WH.get(K(u + i * .5, v + j * .5)) || []) if (Math.hypot(p[0] - u, p[1] - v) < .07) return true;
    return false; }
  return { id: 'belts', no: '', name: '', dir: F.dirOf(0, 0).negate(), cardRadius: 0, activeRadius: -1, scale: 1, group: null,
    heightAt, blocked, update(){}, setActive(){}, teleport: null, dunes, walls };
}

// ---------- visuals ----------
export function createBelts(scene, heightAt, info, terrain){
  const t0 = performance.now(), rnd = mulberry(4242), grp = new THREE.Group(); grp.name = 'loop-belts'; scene.add(grp);
  const pm = paintMaterial(), near = nearIndex(info.P, info.S);
  // (1) washes under everything: wet grass, ditches, sand, straw — built per ~40 m piece (culls), then the path on top
  const PIECE = 40, pieces = new Map(); const pb = (s) => { const k = Math.floor(s / PIECE); return pieces.get(k) || pieces.set(k, paintBuilder(heightAt, .006)).get(k); };
  const { w, at } = info;
  const wash = (s, u, v, rx, ry, th, c, c2, o, seg) => { const km = beltMask(u, v); if (km > .05) pb(s).blob(u, v, rx, ry, th, c, c2, o * km, seg); };
  for (let s = 0; s < info.L; s += 1.3){ const a = at(s);
    const kw = w('wet', s), kd = w('dune', s), kh = w('wheat', s);
    if (kw > .05) for (const side of [-1, 1]) if (rnd() < .9){ const off = .9 + rnd() * 3.2, r = .9 + rnd() * 1.4;
      wash(s, a.u + a.nu * side * off + (rnd() - .5), a.v + a.nv * side * off + (rnd() - .5), r * 1.4, r, a.yaw + rnd(), COL.wet, COL.wetE, .30 * kw); }
    if (kd > .05) for (const side of [-1, 1]) if (rnd() < .8){ const off = .7 + rnd() * 3.6, r = .8 + rnd() * 1.3;
      wash(s, a.u + a.nu * side * off, a.v + a.nv * side * off, r * 1.5, r, a.yaw + rnd() * .6, COL.sand, COL.sandE, .42 * kd); }
    if (kh > .05) for (const side of [-1, 1]){ const off = .45 + 1.2 + rnd() * .5;
      wash(s, a.u + a.nu * side * off, a.v + a.nv * side * off, 1.5, 1.05 + rnd() * .3, a.yaw, COL.straw, COL.strawE, .78 * kh, 14); }
  }
  for (const q of terrain.dunes) pb(near(q.u, q.v).s).blob(q.u, q.v, q.rx * 1.1, q.ry * 1.1, q.th, COL.dune, COL.duneE, .45);
  // reed ditches: narrow water channels beside the wet way (1.1–1.8 m off, 3–7 m long), a few cutting across it (stepping stones there)
  const ditches = [], crossings = [];
  const Lw = info.legs.wet;
  if (Lw){ for (const side of [-1, 1]){ let s = Lw.s0 + 8 + rnd() * 3; while (s < Lw.s1 - 8){ const len = 3 + rnd() * 4, off = 1.1 + rnd() * .7, pts = [];
      for (let t = s; t < s + len; t += .35){ const a = at(t), k = w('wet', t); if (k < .4) break; pts.push([a.u + a.nu * side * (off + .25 * Math.sin(t * .7)), a.v + a.nv * side * (off + .25 * Math.sin(t * .7))]); }
      if (pts.length > 4){ ditches.push(pts); pb(s).ribbon(pts, (i) => ({ hw: .07 + .015 * Math.sin(i * .9), c: COL.ditch, c2: COL.ditchE, o: .9 * Math.min(1, i / 2, (pts.length - 1 - i) / 2) })); }
      s += len + 2 + rnd() * 3; } }
    for (const f of [.28, .55, .8]){ const s = Lw.s0 + (Lw.s1 - Lw.s0) * f, a = at(s), pts = [];
      for (let x = -2.6; x <= 2.6; x += .3) pts.push([a.u + a.nu * x + a.tu * x * .25, a.v + a.nv * x + a.tv * x * .25]);
      ditches.push(pts); crossings.push(s); pb(s).ribbon(pts, (i) => ({ hw: .065, c: COL.ditch, c2: COL.ditchE, o: .9 * Math.min(1, i / 2, (pts.length - 1 - i) / 2) })); } }
  // the path itself: worn earth, sandier on the dunes, damp + faint on the wet stretch, narrow between the walls
  { const pts = info.P.map(p => [p[0], p[1]]); const N = pts.length, pp = paintBuilder(heightAt, .009);
    const look = (i) => { const s = info.S[i], kw = w('wet', s), kd = w('dune', s), kl = w('wall', s), e = 1; // full strength to the very ends: the shader lane draws the same colour up to them, so the join is seamless
      const mix = (a, b, t) => a.map((x, j) => x + (b[j] - x) * t);
      let c = mix(COL.path, COL.damp, kw), c2 = mix(COL.pathE, COL.dampE, kw); c = mix(c, COL.sand, kd); c2 = mix(c2, COL.sandE, kd);
      const tw = Math.min(1, s / 8, (info.L - s) / 8), wide = .068 + .037 * tw * tw * (3 - 2 * tw); // lane width at the joins, widening away from them
      return { hw: (wide + .016 * Math.sin(s * .37) + .008 * Math.sin(s * 2.1)) * (1 + .3 * kd) * (1 - .3 * kl), c, c2, o: (.97 - .3 * kw) * e }; }; // r1 review: wider + firmer so the loop reads at the game camera
    pp.ribbon(pts, (i) => look(i)); const m = pp.build(pm, 'loop-path'); if (m) { m.renderOrder = -1; grp.add(m); } }
  for (const [, b] of pieces){ const m = b.build(pm, 'loop-wash'); if (m){ m.renderOrder = -2; grp.add(m); } }

  // (2) props, chunked
  const CH = 16, chunks = new Map();
  const chunk = (kind, s) => { const key = kind + Math.floor(s / CH); return chunks.get(key) || chunks.set(key, { kind, list: [] }).get(key); };
  const add = (kind, s, u, v, yaw, sc, y0 = 0, col = null) => { if (kind !== 'step' && beltMask(u, v) < .5) return; chunk(kind, s).list.push({ u, v, yaw, sc, y0, col }); };
  // stepping stones: along the wet track (every 0.3 m, alternating) and across each ditch crossing
  if (Lw) for (let s = Lw.s0 + 3; s < Lw.s1 - 3; s += .28 + rnd() * .06){ const k = w('wet', s); if (rnd() > k * 1.1) continue; const a = at(s), j = (Math.floor(s / .3) % 2 ? 1 : -1) * .035;
    const sc = .055 + rnd() * .025; add('step', s, a.u + a.nu * j, a.v + a.nv * j, rnd() * 6.3, [sc * 1.2, .016, sc], -.006, rnd() < .5 ? '#bdb6a6' : '#aaa393'); }
  // reeds along the ditch banks
  for (const d of ditches) for (let i = 0; i < d.length; i++){ if (rnd() < .35) continue; const [u, v] = d[i], s = near(u, v).s; if (near(u, v).d < .3) continue;
    for (const side of [-1, 1]){ if (rnd() < .3) continue; const j = i < d.length - 1 ? i + 1 : i - 1, tu = d[j][0] - u, tv = d[j][1] - v, tl = Math.hypot(tu, tv) || 1, o = .1 + rnd() * .06;
      add('reed', s, u - tv / tl * side * o, v + tu / tl * side * o, rnd() * 6.3, [1, .8 + rnd() * .6, 1], -.004, rnd() < .5 ? '#7d8f46' : '#8f9a52'); } }
  // marram / seagrass tufts on and between the dunes
  { const Ld = info.legs.dune; if (Ld) for (let s = Ld.s0; s < Ld.s1; s += .35){ const k = w('dune', s); const a = at(s);
    for (let n = 0; n < 3; n++){ if (rnd() > k * .9) continue; const side = rnd() < .5 ? -1 : 1, off = .35 + rnd() * 5;
      add('grass', s, a.u + a.nu * side * off + (rnd() - .5) * .3, a.v + a.nv * side * off + (rnd() - .5) * .3, rnd() * 6.3, [.9 + rnd() * .5, .8 + rnd() * .6, .9 + rnd() * .5], -.004, rnd() < .6 ? '#a3ad7f' : '#b6b383'); } } }
  // wheat tufts on the straw fields (aligned with the wind so the sway reads as waves)
  { const Lh = info.legs.wheat; if (Lh) for (let s = Lh.s0; s < Lh.s1; s += .2){ const k = w('wheat', s); const a = at(s);
    for (const side of [-1, 1]) for (let n = 0; n < 2; n++){ if (rnd() > k * (MOBILE ? .6 : .95)) continue; const off = .32 + rnd() * 2.3;
      add('wheat', s, a.u + a.nu * side * off + (rnd() - .5) * .15, a.v + a.nv * side * off + (rnd() - .5) * .15, .6, [.9 + rnd() * .3, .85 + rnd() * .35, .9 + rnd() * .3], -.004, rnd() < .5 ? '#d8bd68' : '#cfb25a'); } } }
  // dry-stone walls: two courses of rounded field stones + a cope of flatter ones
  for (const run of terrain.walls) for (let i = 0; i < run.length; i++){ const [u, v, yaw] = run[i], s = near(u, v).s;
    const tone = () => ['#b9b2a3', '#a9a294', '#c3bcab', '#9d978a'][Math.floor(rnd() * 4)];
    add('stone', s, u, v, yaw + (rnd() - .5) * .5, [.042 + rnd() * .014, .03 + rnd() * .008, .034 + rnd() * .01], .022, tone());
    if (i % 2 === 0) add('stone', s, u + (rnd() - .5) * .02, v + (rnd() - .5) * .02, yaw + (rnd() - .5) * .6, [.04 + rnd() * .012, .026, .032], .072, tone());
    if (i % 3 === 0) add('stone', s, u, v, yaw + (rnd() - .5) * .3, [.05, .016, .036], .108, tone()); }

  const GEO = {
    step: new THREE.IcosahedronGeometry(1, 1),
    stone: new THREE.IcosahedronGeometry(1, 0),
    reed: tuft(5, .007, .17, .32, 3), grass: tuft(6, .005, .1, .55, 3), wheat: wheatTuft() };
  const MAT = { step: clayMaterial({ color: '#ffffff', grain: 30 }), stone: clayMaterial({ color: '#ffffff', grain: 24 }), reed: clayMaterial({ color: '#ffffff', grain: 40, round: .1 }),
    grass: clayMaterial({ color: '#ffffff', grain: 40, round: .1 }), wheat: swayMaterial() };
  const mtx = new THREE.Matrix4(), cc = new THREE.Color(); let nInst = 0, nMesh = 0;
  for (const [, c] of chunks){ const im = new THREE.InstancedMesh(GEO[c.kind], MAT[c.kind], c.list.length);
    c.list.forEach((p, i) => { poseAt(p.u, p.v, p.yaw, heightAt, p.y0, mtx, p.sc); im.setMatrixAt(i, mtx); im.setColorAt(i, cc.set(p.col || '#ffffff')); });
    im.castShadow = c.kind === 'stone' || c.kind === 'step' || c.kind === 'reed'; im.receiveShadow = true; im.computeBoundingSphere(); im.name = 'belt-' + c.kind;
    grp.add(im); nInst += c.list.length; nMesh++; }
  note(`loop belts: ${nMesh} chunks, ${nInst} props, ${terrain.dunes.length} dunes, ${terrain.walls.length} wall runs, ${ditches.length} ditches (${(performance.now() - t0).toFixed(0)} ms)`);
  // only the stretch near the cat is drawn (plus frustum culling); in the planet view the whole loop shows
  const far = F.dirOf(0, 0);
  const chunkDirs = [...grp.children].map(o => { o.geometry.computeBoundingSphere(); const bs = (o.isInstancedMesh ? o.boundingSphere : o.geometry.boundingSphere); return { o, c: bs.center.clone().normalize(), r: bs.radius }; });
  return { group: grp, info, ditches, crossings,
    update(dt, T, cat, planet){ MAT.wheat.userData.uTime.value = T;
      for (const q of chunkDirs) if (q.o.isInstancedMesh) q.o.visible = planet > .2 ? false : cat.up.angleTo(q.c) * R < q.r + 26; } };
}

// a tuft of n thin leaning blades (cones), merged
function tuft(n, r, h, lean, seg){
  const parts = []; for (let i = 0; i < n; i++){ const g = new THREE.ConeGeometry(r, h * (.75 + .5 * ((i * 37) % 10) / 10), seg, 1); g.translate(0, h / 2, 0);
    const a = i / n * Math.PI * 2 + .4, l = lean * (.5 + .5 * ((i * 53) % 7) / 7); g.rotateZ(Math.cos(a) * l); g.rotateX(Math.sin(a) * l); g.translate(Math.cos(a) * r * 1.5, 0, Math.sin(a) * r * 1.5); parts.push(g); }
  return merge(parts);
}
function wheatTuft(){
  const parts = []; for (let i = 0; i < 6; i++){ const a = i / 6 * Math.PI * 2, h = .12 + .03 * ((i * 41) % 5) / 5;
    const st = new THREE.CylinderGeometry(.0025, .003, h, 3, 1); st.translate(0, h / 2, 0); const hd = new THREE.SphereGeometry(.011, 5, 3); hd.scale(.7, 1.9, .7); hd.translate(0, h + .012, 0);
    for (const g of [st, hd]){ g.rotateZ(Math.cos(a) * .12); g.rotateX(Math.sin(a) * .12); g.translate(Math.cos(a) * .018, 0, Math.sin(a) * .018); parts.push(g); } }
  return merge(parts);
}
function merge(parts){
  let n = 0, ni = 0; for (const g of parts){ n += g.attributes.position.count; ni += g.index ? g.index.count : g.attributes.position.count; }
  const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), idx = []; let o = 0;
  for (const g of parts){ pos.set(g.attributes.position.array, o * 3); nor.set(g.attributes.normal.array, o * 3); const I = g.index ? g.index.array : [...Array(g.attributes.position.count).keys()]; for (const i of I) idx.push(i + o); o += g.attributes.position.count; }
  const m = new THREE.BufferGeometry(); m.setAttribute('position', new THREE.BufferAttribute(pos, 3)); m.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); m.setIndex(idx); return m;
}
// clay + a travelling sway (local x of every wheat instance points the same way, so neighbouring tufts move together: waves, not jitter)
function swayMaterial(){
  const m = clayMaterial({ color: '#ffffff', grain: 40, round: .1 }), prev = m.onBeforeCompile, uT = { value: 0 };
  m.userData.uTime = uT;
  m.onBeforeCompile = function (s, r){ prev.call(this, s, r); s.uniforms.uWT = uT;
    s.vertexShader = s.vertexShader.replace('#include <common>', '#include <common>\nuniform float uWT;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        { vec3 ip = vec3(instanceMatrix[3]); float ph = dot(ip, vec3(.9, .35, .55)) * 1.1 - uWT * 1.15;
          float g = .5 + .5 * sin(ph) ; g = g * g; transformed.x += (g * .035 + .006 * sin(uWT * 2.1 + ip.x * 7.)) * smoothstep(0., .14, position.y); }`); };
  const key = m.customProgramCacheKey(); m.customProgramCacheKey = () => key + '|sway';
  return m;
}
