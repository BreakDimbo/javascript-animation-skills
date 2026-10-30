// node game/animals/sim/millscreen.mjs [t...]   — where every mill-yard thing lands on a 1440×900 screen from the arrival camera (teleport, cat idle).
// Prints screen boxes for each hen, the sack pile (each sack), the dormouse, the donkey, the cottage; used to identify what QA saw.
import './stub.mjs';
const L = new URL('../../..', import.meta.url).pathname.replace(/\/$/, '');
const THREE = await import(L + '/shared/vendor/three.module.js');
let seed = 7; Math.random = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
const cs = await import(L + '/game/catScale.js'); cs.setCatHc(+(process.env.HC || 0.3491), 'sim');
const W = await import(L + '/game/world.js'); const { createMill } = await import(L + '/b4-mill/mill.js'); const { createMillLife } = await import(L + '/game/animals/millyard.js');
const { SHEEP_CAM } = await import(L + '/artkit/dioramacam.js');
export async function setup(){
  const scene = new THREE.Scene(), m = createMill(scene, { R: W.R, radius: W.R }, W.REG[2].dir);
  { const w = m.group.children.find(o => o.isGroup && o.children.some(k => k.geometry?.parameters?.radiusBottom === 2.6)); if (w){ m.frame(w, W.MILL_AT.x, W.MILL_AT.z, W.MILL_AT.yaw, -.3); w.scale.setScalar(W.MILL_AT.s); } }
  const life = createMillLife(m, { hens: [[-6.5, 12.5], [-4.5, 14.8], [-8.2, 15.6], [-5.8, 17.4]], donkeyAt: [-15, 13, 2.2] });
  // arrival camera, built in the game's world (shrunk about A by MS) and carried into module space with `unscale` (projection is scale-invariant)
  const A = W.REG[2].dir.clone().multiplyScalar(W.R), uns = (p) => p.clone().sub(A).multiplyScalar(1 / W.MS).add(A);
  const catDir = W.F.dirOf(W.uM - 2.4, W.vM + .6), up = catDir.clone(), look = W.REG[2].dir.clone(), yaw = look.addScaledVector(up, -look.dot(up)).normalize();
  const HOME_D = SHEEP_CAM.dist0 * .45 / SHEEP_CAM.sheepUnits, e = SHEEP_CAM.elev, tgt = up.clone().multiplyScalar(W.R + .1);
  const camW = tgt.clone().addScaledVector(yaw, -Math.cos(e) * HOME_D).addScaledVector(up, Math.sin(e) * HOME_D);
  const cam = new THREE.PerspectiveCamera(SHEEP_CAM.vfov, 1440 / 900, .1, 1e5); cam.position.copy(uns(camW)); cam.up.copy(up); cam.lookAt(uns(tgt)); cam.updateMatrixWorld(true); cam.updateProjectionMatrix();
  const catL = W.millLocal(uns(tgt).normalize());
  return { THREE, m, life, cam, camWorld: camW, catL, uns };
}
const v = new THREE.Vector3();
export function box(cam, root){ root.updateMatrixWorld(true); let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9, n = 0;
  root.traverse(o => { if (!o.isMesh || !o.visible) return; const p = o.geometry.attributes.position; for (let i = 0; i < p.count; i++){ v.fromBufferAttribute(p, i).applyMatrix4(o.matrixWorld).project(cam); const X = (v.x + 1) * 720, Y = (1 - v.y) * 450; x0 = Math.min(x0, X); x1 = Math.max(x1, X); y0 = Math.min(y0, Y); y1 = Math.max(y1, Y); n++; } });
  return n ? [x0, y0, x1, y1].map(q => Math.round(q)) : null; }
if (import.meta.url === 'file://' + process.argv[1] && !process.env.RUN){
  const S = await setup(), { m, life, cam, catL } = S; const ts = process.argv.slice(2).map(Number); if (!ts.length) ts.push(1, 6);
  console.log('cat local', catL.map(q => q.toFixed(2)).join(','));
  let T = 0; const dt = 1 / 60;
  for (const tt of ts){ while (T < tt){ T += dt; const cat = { x: catL[0], z: catL[1], speed: 0, sitting: false, cam: S.uns(S.camWorld) }; m.update(dt, { position: m.surf(catL[0], catL[1]), sitting: false }); life.update(dt, cat, T); }
    console.log(`t ${tt}s  (px @1440; QA 1024-wide shot ×1.406)`);
    life.hens.forEach((h, i) => console.log(' hen', i, h.root.children[0].children[0].material.color.getHexString(), JSON.stringify(box(cam, h.root)), 'local', h.x.toFixed(2), h.z.toFixed(2)));
    const sacks = m.group.children.find(o => o.isGroup && o.children.filter(c => c.geometry?.type === 'SphereGeometry').length >= 5);   // r4: 5 sacks (4fe5652; was 8)
    if (sacks){ console.log(' sack pile', JSON.stringify(box(cam, sacks))); sacks.children.filter(c => c.isMesh && c.geometry.type === 'SphereGeometry').forEach((s, k) => console.log('  sack', k, JSON.stringify(box(cam, s)))); }
    if (life.mouseObj) console.log(' dormouse', JSON.stringify(box(cam, life.mouseObj)), 'out', life.mouseOut.toFixed(2));
    console.log(' donkey', JSON.stringify(box(cam, life.donkeyObj)));
    const house = m.group.children.find(o => o.isGroup && o.children.some(c => c.geometry?.type === 'BoxGeometry' && c.geometry.parameters.width === 5)); if (house) console.log(' cottage', JSON.stringify(box(cam, house))); }
}
// ---- screen-gap run: arrival camera, then the follow camera (target eases to the cat at 3.2/s, fixed yaw), cat script below; real perspective vertices
export function hullPx(cam, root){ root.updateMatrixWorld(true); const pts = [];
  root.traverse(o => { if (!o.isMesh || !o.visible || o.material?.transparent) return; const p = o.geometry.attributes.position; for (let i = 0; i < p.count; i += 2){ v.fromBufferAttribute(p, i).applyMatrix4(o.matrixWorld).project(cam); pts.push([(v.x + 1) * 720, (1 - v.y) * 450]); } });
  pts.sort((a, b) => a[0] - b[0] || a[1] - b[1]); const cr = (O, A, B) => (A[0] - O[0]) * (B[1] - O[1]) - (A[1] - O[1]) * (B[0] - O[0]);
  const lo = [], up = []; for (const q of pts){ while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop(); lo.push(q); }
  for (let i = pts.length - 1; i >= 0; i--){ const q = pts[i]; while (up.length >= 2 && cr(up[up.length - 2], up[up.length - 1], q) <= 0) up.pop(); up.push(q); }
  return lo.slice(0, -1).concat(up.slice(0, -1)); }
const segD = (p, a, b) => { const sx = b[0] - a[0], sy = b[1] - a[1], t = Math.max(0, Math.min(1, ((p[0] - a[0]) * sx + (p[1] - a[1]) * sy) / (sx * sx + sy * sy || 1e-12))); return Math.hypot(p[0] - a[0] - sx * t, p[1] - a[1] - sy * t); };
const inP = (p, H) => { for (let i = 0; i < H.length; i++){ const a = H[i], b = H[(i + 1) % H.length]; if ((b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]) < 0) return false; } return true; };
export function pgap(A, B){ if (A.some(p => inP(p, B)) || B.some(p => inP(p, A))) return -1; let d = 1e9; for (const [P, Q] of [[A, B], [B, A]]) for (const p of P) for (let i = 0; i < Q.length; i++) d = Math.min(d, segD(p, Q[i], Q[(i + 1) % Q.length])); return d; }
if (process.env.RUN){
  const S = await setup(), { m, life, cam, catL } = S;
  const T0 = m.surf(catL[0], catL[1], .1 / 0.12), OFF = cam.position.clone().sub(T0); const tg = T0.clone();
  const HCL = cs.CAT_HC / .12, yard = [-6.2, 15];
  const sacks = m.group.children.find(o => o.isGroup && o.children.filter(c => c.geometry?.type === 'SphereGeometry').length >= 5);   // r4: 5 sacks (4fe5652; was 8)
  const script = (t) => { const k = t % 40, ang = t * .37;   // starts idle at the arrival spot, then walks into the yard and around it like millsim
    if (k < 5) return { x: catL[0], z: catL[1], speed: 0 };
    if (k < 13){ const f = (k - 5) / 8; return { x: catL[0] + (yard[0] + 6 - catL[0]) * f, z: catL[1] + (yard[1] - 8 - catL[1]) * f, speed: .45 }; }
    if (k < 20) return { x: yard[0] + 6 + Math.cos(ang * 2) * 3, z: yard[1] - 8 + Math.sin(ang * 2) * 3, speed: .45 };
    if (k < 26) return { x: yard[0] + 5, z: yard[1] - 6, speed: 0, sitting: true };
    if (k < 32){ const f = (k - 26) / 6; return { x: yard[0] + 5 - 25 * f, z: yard[1] - 6 + 3 * f, speed: 1.5 }; }
    const f = (k - 32) / 8; return { x: yard[0] - 20 + (catL[0] - yard[0] + 20) * f, z: yard[1] - 3 + (catL[1] - yard[1] + 3) * f, speed: .45 }; };
  let T = 0; const dt = 1 / 60, N = (+process.env.RUN || 120) / dt; let mHH = 1e9, mHO = 1e9, mArr = 1e9, worst = null, n0 = 0; const cnt = { hh: 0, ho: 0 }; let maxV = 0;
  for (let i = 0; i < N; i++){ T += dt; const c = script(T); const goal = m.surf(c.x, c.z, .1 / .12); tg.lerp(goal, 1 - Math.exp(-dt * 3.2)); cam.position.copy(tg).add(OFF); cam.lookAt(tg); cam.updateMatrixWorld(true);
    m.update(dt, { position: m.surf(c.x, c.z), sitting: !!c.sitting }); life.update(dt, { x: c.x, z: c.z, speed: c.speed, sitting: !!c.sitting, cam: cam.position }, T);
    life.hens.forEach((h, j) => { if (i > 15 && h._lx !== undefined) maxV = Math.max(maxV, Math.hypot(h.x - h._lx, h.z - h._lz) / dt / HCL); h._lx = h.x; h._lz = h.z; });
    if (i % 3) continue;
    const H = life.hens.map(h => hullPx(cam, h.root)); const O = [hullPx(cam, sacks), hullPx(cam, life.donkeyObj)];
    life.hens.forEach((h, j) => { // px per Hc at this hen
      const a = m.surf(h.x, h.z, 0).project(cam), b = m.surf(h.x, h.z, HCL).project(cam), pxHc = Math.hypot((a.x - b.x) * 720, (a.y - b.y) * 450);
      for (let k = j + 1; k < H.length; k++){ const g = pgap(H[j], H[k]) / pxHc; if (g < mHH){ mHH = g; worst = ['hen', j, k, T.toFixed(2)]; } if (T < 5) mArr = Math.min(mArr, g); if (g < .3) cnt.hh++; }
      O.forEach((Ob, k) => { const g = pgap(H[j], Ob) / pxHc; if (g < mHO){ mHO = g; if (g < mHH) worst = ['obst', j, k, T.toFixed(2)]; } if (T < 5) mArr = Math.min(mArr, g); if (g < .3){ cnt.ho++; if (process.env.DBG) console.log("ho", T.toFixed(2), j, k, g.toFixed(3), life.screen.scrGapOf(h, h.x, h.z).toFixed(2), (life.screen.need()).toFixed(2), h.mode); } }); });
    if (process.env.DBG && i % 600 === 0) console.log(T.toFixed(1), H.map(h => h.length).join(','), JSON.stringify(H[0].slice(0, 3)), JSON.stringify(O[0].slice(0, 3)), cam.position.toArray().map(q => q.toFixed(1)));
    n0++; }
  console.log(`HC ${cs.CAT_HC} frames ${n0}: min screen gap hen–hen ${mHH.toFixed(3)} Hc, hen–(sacks+dormouse | donkey) ${mHO.toFixed(3)} Hc, arrival (first 5 s) ${mArr.toFixed(3)} Hc; frames<0.3: hh ${cnt.hh} ho ${cnt.ho}; worst ${worst}; max hen speed ${maxV.toFixed(2)} Hc/s; world minGap ${(life.space.minGap() / (1.66 * HCL)).toFixed(3)} Lc`);
}
