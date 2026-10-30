// 02 小站 · The Halt — a tiny countryside halt: a short platform with a bench shelter, a bit of track curving away north,
// a slow clay toy train that stops now and then, and a sleepy hound on its blanket that wakes for the cat.
// Self-contained: everything is laid out in a local tangent frame at STATION_DIR (move the halt by changing the dir, or by
// adding a REG entry with no '02' in world.js). Local frame (right-handed): x = board −u (the train's direction past the platform), z = board +v
// (the camera side), y = up; track centre line z = 0; the loop curves away to −z.
import * as THREE from '../../shared/vendor/three.module.js';
import { paintMaterial, platformMaterial } from '../station/paint.js';
import { R, qs, note, safe } from '../core/util.js';
import { F, REG } from '../world.js';
import { heightAt as worldHeightAt } from './registry.js';
import { Builder, lump, softBox } from '../station/kit.js';
import { makeLoop, createTrack, createTrain } from '../station/train.js';
import { createHound } from '../station/hound.js';
import { CAT_HC_FALLBACK, onCatHc, observeCat } from '../catScale.js';

// between the home meadow (rad 110) and the pond (along 173, rad 30), just north of the mill→pond lane.
// r2: nudged to (119.75, −4.58) — the one spot near the lane where no miniature wheat field or hedge row runs under the track (searched with artkit/minifields.js)
export const STATION_DIR = F.dirOf(119.75, -4.58);
const NAME = '小站 · The Halt';
// r2 palette (review-vd-station-r1 §3): saturation ≤ .38, nothing darker than L 25
const PAL = { stone: '#b9ad98', coping: '#d8ccb2', moss: '#8a9a5a', wood: '#8c6c52', woodD: '#7d5c46', roof: '#b06e58', roofD: '#9c614e',
  post: '#7d5c46', iron: '#4e524c', board: '#efe6d2', churn: '#b9b4a8', churnD: '#a39e93', pot: '#a87a62', flower: '#dcb862', leaf: '#7f9658', ink: '#4a3a2e' };

export function createStationRegion(scene){
  const SR = REG.find((r) => r.no === '02'), DIR = (SR?.dir || STATION_DIR).clone().normalize();
  const group = new THREE.Group(); group.name = 'station'; scene.add(group);
  // the cat's shading language (review-vd-station-r1 §1): toon bands, stroke grain, mottle, chalky top edges — one material per object family
  const mat = paintMaterial({ vertexColors: true, axis: [1, 0, 0], stroke: 24, mottle: 3, chalk: .05, seed: 1 });
  const matTrain = paintMaterial({ vertexColors: true, axis: [0, 0, 1], stroke: 18, mottle: 2.5, chalk: .05, seed: 4 });
  const matDog = paintMaterial({ vertexColors: true, axis: [0, 0, 1], stroke: 40, mottle: 5, chalk: .03, seed: 7 });

  // ---------- local tangent frame ----------
  const [U0, V0] = F.toUV(DIR), Zw = F.dirOf(U0, V0 + 1).sub(DIR); Zw.addScaledVector(DIR, -Zw.dot(DIR)).normalize();
  const Xw = new THREE.Vector3().crossVectors(DIR, Zw).normalize(); // right-handed (x, up, z)
  const _d = new THREE.Vector3(), _p = new THREE.Vector3();
  const dirAt = (x, z, out = new THREE.Vector3()) => out.copy(DIR).multiplyScalar(R).addScaledVector(Xw, x).addScaledVector(Zw, z).normalize();
  const surf = (x, z, out = new THREE.Vector3()) => { dirAt(x, z, _d); return out.copy(_d).multiplyScalar(R + worldHeightAt(_d)); };
  const local = (d) => { const k = d.dot(DIR); return [R * d.dot(Xw) / k, R * d.dot(Zw) / k]; };
  const basis = new THREE.Matrix4().makeBasis(Xw, DIR, Zw);
  // design units → world: the whole halt is drawn at K× its design size (cat ≈ 1 m long at this camera)
  const K = 1.5, surfK = (x, z, out) => surf(x * K, z * K, out), localK = (d) => local(d).map((a) => a / K), dirK = (x, z, out) => dirAt(x * K, z * K, out);
  // a rigid prop group standing on the ground at design (x, z)
  const stand = (obj, x, z, yaw = 0) => { const o = new THREE.Group(); surfK(x, z, o.position); o.quaternion.setFromRotationMatrix(basis); o.scale.setScalar(K);
    obj.rotation.y = yaw; o.add(obj); group.add(o); return o; };

  // ---------- track + train ----------
  const Ls = 4.2, Rc = 2, loop = makeLoop(Ls, Rc);
  const TS = K * .8;                                            // r2.1: loco 2.3 Hc, coach 2.0 Hc, train 8.3–9.1 Hc at the reference cat (review-vd-station-r2 §3)
  let track = createTrack(group, { loop, surf: surfK, K, TS }), trackObjs = group.children.slice();
  const train = createTrain(group, { track, loop, mat: matTrain, K, TS });
  const STOP = Ls / 2 - .65;                                    // r2.1: 0.9 m back toward the coach from r2 — the cab stands clear of the shelter eave (≥ .3 Hc)
  train.T.stops = [{ s: STOP, wait: 11 }, { s: Ls + Math.PI * Rc + Ls / 2 + 1.2, wait: 26 }];   // the far-side rest is out of frame
  train.T.s = qs.has('tt') ? STOP : STOP - .5; train.T.last = null;

  // ---------- platform (sloped ends), shelter, bench, name board, odds and ends ----------
  const PH = .065, PZ0 = .34, PZ1 = 1.08, PL = 1.6, RAMP = .3;    // r2: platform ≤ .35 Hc
  // about-a-point scaling for a prop built at design size (r2 review scale table)
  const parts = {}; // for the scale sheet (game/station/sheet.html)
  const shrink = (m, s, x, y, z) => { m.scale.setScalar(s); m.position.set(x * (1 - s), y * (1 - s), z * (1 - s)); return m; };
  // r2.1: props follow the cat — their design scale × (CAT_HC / reference Hc), about the point where they stand
  const fitted = [], fitProp = (m, s0, x, y, z) => { fitted.push([m, s0, x, y, z]); return shrink(m, s0, x, y, z); };
  { // the slab: warm stone, bevelled, sloped ends; flags / coping / moss / ramp grass are painted in its shader
    const sh = new THREE.Shape(); sh.moveTo(-PL - RAMP, 0); sh.lineTo(-PL, PH); sh.lineTo(PL, PH); sh.lineTo(PL + RAMP, 0); sh.lineTo(-PL - RAMP, 0);
    const g = new THREE.ExtrudeGeometry(sh, { depth: PZ1 - PZ0 - .04, bevelEnabled: true, bevelThickness: .02, bevelSize: .016, bevelSegments: 4, curveSegments: 4 });
    g.translate(0, -.016, PZ0 + .02); g.computeVertexNormals();
    const m = new THREE.Mesh(g, platformMaterial({ flag: .6 / K, joint: .025 / K, z0: PZ0, z1: PZ1, coping: .25 / K, xEnd: PL, ramp: RAMP, mossW: .32 }, { color: PAL.stone, coping: PAL.coping, moss: PAL.moss }));
    m.castShadow = true; m.receiveShadow = true; stand(m, 0, 0); }
  // shelter: an open timber canopy on four posts with a bench beneath (r2: ×.79, eave 3.3 → 2.6 Hc)
  const SX = .58, SZ = .8, SW = .86, SD = .4, SHH = .44, SS = .79;
  { const b = Builder(8);
    for (const dx of [-1, 1]) for (const dz of [-1, 1]) b.box(.04, SHH, .04, PAL.woodD, SX + dx * (SW / 2 - .03), PH + SHH / 2, SZ + dz * (SD / 2 - .03), 0, .01, .02);
    b.box(SW - .04, .16, .024, PAL.wood, SX, PH + SHH - .14, SZ + SD / 2 - .03, 0, .008, .02);  // back boards (camera side)
    for (let i = 0; i < 5; i++) b.box(.006, .15, .026, PAL.woodD, SX - SW / 2 + .1 + i * (SW - .2) / 4, PH + SHH - .14, SZ + SD / 2 - .02, 0, .0025, .01);
    // gabled roof, ridge across the platform (z): two soft slabs falling to ±x, a little overhang
    for (const sx of [-1, 1]){ const g = softBox(SW / 2 + .11, .036, SD + .16, .012); g.translate(sx * (SW / 4 + .055), 0, 0);
      b.add(g, sx < 0 ? PAL.roofD : PAL.roof, SX, PH + SHH + .13, SZ, 0, 0, -sx * .32, .02); }
    b.box(.04, .04, SD + .18, PAL.roofD, SX, PH + SHH + .15, SZ, 0, .014, .01);           // ridge
    // bench under the canopy
    b.box(SW - .16, .03, .13, PAL.wood, SX, PH + .12, SZ + .05, 0, .01); b.box(SW - .16, .09, .028, PAL.wood, SX, PH + .2, SZ + .12, 0, .009);
    for (const dx of [-.3, .3]) b.box(.03, .12, .11, PAL.woodD, SX + dx, PH + .06, SZ + .05, 0, .008);
    stand(parts.shelter = fitProp(b.mesh(mat), SS, SX, PH, SZ), 0, 0); }
  // name board on two posts at the east end of the platform, read from the camera side (r2: ×.75, board 1.6 → 1.2 Lc)
  const NBX = 1.4, NBZ = .98, NS = .69;
  { const o = stand(new THREE.Group(), 0, 0), b = Builder(9); for (const dx of [-.21, .21]) b.box(.032, .4, .032, PAL.iron, NBX + dx, PH + .2, NBZ, 0, .009);
    b.box(.54, .14, .032, PAL.iron, NBX, PH + .36, NBZ - .006, 0, .012, .01); o.add(fitProp(b.mesh(mat), NS, NBX, PH, NBZ));
    const cv = document.createElement('canvas'); cv.width = 512; cv.height = 128; const g = cv.getContext('2d'); g.fillStyle = PAL.board; g.fillRect(0, 0, 512, 128);
    g.fillStyle = PAL.ink; g.font = '50px "Noto Serif CJK SC","Source Han Serif SC","Songti SC",serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText('小  站', 256, 62); g.fillStyle = 'rgba(74,58,46,.45)'; g.fillRect(70, 104, 372, 2);
    const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
    const pm = paintMaterial({ map: true, axis: [1, 0, 0], stroke: 30, mottle: 4, chalk: 0, seed: 9 }); pm.map = t;
    const pl = new THREE.Mesh(new THREE.PlaneGeometry(.47, .1), pm); pl.receiveShadow = true; pl.position.set(NBX, PH + .36, NBZ + .0115);
    const po = new THREE.Group(); po.add(pl); o.add(fitProp(po, NS, NBX, PH, NBZ)); parts.board = o; }
  // a cold lamp post (×.87), two milk churns (×.7), a flower tub
  const lx = -.12, lz = .98;
  { const b = Builder(12);
    b.box(.032, .52, .032, PAL.iron, lx, PH + .26, lz, 0, .008); b.box(.1, .024, .024, PAL.iron, lx, PH + .5, lz - .04, 0, .006);
    b.add(new THREE.CylinderGeometry(.03, .045, .07, 10), PAL.iron, lx, PH + .47, lz - .09, 0, 0, 0, .01); b.add(lump(.036, .45, 0, 12), PAL.iron, lx, PH + .508, lz - .09);
    stand(parts.lamp = fitProp(b.mesh(mat), .87, lx, PH, lz), 0, 0); }
  { const b = Builder(13);
    for (const [x, z, s] of [[1.42, .56, 1], [1.5, .7, .9]]){ b.add(lump(.055 * s, 1.15, .015, 16).scale(1, 1, 1), PAL.churn, x, PH + .062 * s, z, 0, 0, 0, .03);
      b.add(new THREE.CylinderGeometry(.03 * s, .046 * s, .05 * s, 16), PAL.churnD, x, PH + .14 * s, z, 0, 0, 0, .02); b.add(lump(.034 * s, .4, 0, 14), PAL.churnD, x, PH + .168 * s, z); }
    stand(parts.churns = fitProp(b.mesh(mat), .7, 1.46, PH, .63), 0, 0); }
  { const b = Builder(14);
    b.add(lump(.065, .62, .02, 16), PAL.pot, -1.48, PH + .03, .97, 0, 0, 0, .03);
    for (const [dx, dz, c, r] of [[0, 0, PAL.leaf, .06], [.03, .02, PAL.flower, .025], [-.03, -.01, PAL.flower, .022], [.0, -.035, '#ece1c8', .02]]) b.add(lump(r, .8, .05, 12), c, -1.48 + dx, PH + .08 + (c === PAL.leaf ? 0 : .03), .97 + dz, 0, 0, 0, .05);
    stand(parts.tub = fitProp(b.mesh(mat), 1, -1.48, PH, .97), 0, 0); }

  // ---------- the hound ----------
  const pH = (x, z) => { // platform top (with the ramps), 0 outside
    if (z < PZ0 || z > PZ1) return 0; const ax = Math.abs(x); return ax <= PL ? PH : ax < PL + RAMP ? PH * (1 - (ax - PL) / RAMP) : 0; };
  const bed = [-.8, .72];
  const hound = createHound(matDog, { bed, bedYaw: -Math.PI / 2 + .2, groundAt: pH,
    clampXZ: (x, z) => [THREE.MathUtils.clamp(x, -PL + .15, SX - SW / 2 - .1), THREE.MathUtils.clamp(z, PZ0 + .14, PZ1 - .1)] });
  const hr = stand(hound.root, 0, 0); stand(hound.rug, 0, 0);
  // ---------- cat interaction ----------
  // the platform lifts the cat visually (root offset along up, re-applied every frame after updateCat): the painted ground stays flat
  const sm = THREE.MathUtils.smoothstep;
  const liftAt = (x, z) => { if (z < PZ0 - .06 || z > PZ1 + .06 || Math.abs(x) > PL + RAMP) return 0; const side = Math.min(sm(z, PZ0 - .06, PZ0 + .02), 1 - sm(z, PZ1 - .02, PZ1 + .06));
    return pH(x, THREE.MathUtils.clamp(z, PZ0, PZ1)) * side; };
  // solid things: the bench, the shelter's back boards, the churns, the name-board posts — and the train cars / hound (escapable: never trap a cat already inside)
  const boxes0 = [[SX - (SW / 2 - .06) * SS, SX + (SW / 2 - .06) * SS, SZ - .03, SZ + SD / 2 * SS, SX, SZ], [1.36, 1.56, .5, .76, 1.46, .63], [NBX - .25 * NS, NBX + .25 * NS, NBZ - .04, NBZ + .04, NBX, NBZ], [-1.56, -1.4, .9, 1.04, -1.48, .97]];
  let boxes = boxes0, fitS = 1;
  const inBoxes = (x, z) => boxes.some(([a, b, c, d]) => x > a && x < b && z > c && z < d);
  const inTrain = (x, z) => { for (const s of train.carS()) for (let o = -.45; o <= .451; o += .15){ const [px, pz] = loop.at(s + o * train.ks); if (Math.hypot(x - px, z - pz) < .3 * train.ks) return true; } return false; };
  const inDog = (x, z) => { const [hx, hz] = hound.reach(); return Math.hypot(x - hx, z - hz) < .13 * fitS; };
  let catXZ = null, lift = 0;
  const near = (x, z) => Math.hypot(x, z + Rc) < Ls / 2 + 2 * Rc + 1.5;
  function blocked(d){ if (d.dot(DIR) < .9995) return false; const [x, z] = localK(d); if (!near(x, z)) return false;
    if (inBoxes(x, z)) return true;
    const c = catXZ; if (inTrain(x, z) && !(c && inTrain(c[0], c[1]))) return true;
    if (inDog(x, z) && !(c && inDog(c[0], c[1]))) return true; return false; }

  // ---------- r2.1: size everything that stands on the platform from the cat (Hc only — review-vd-station-r2 §1) ----------
  let catDone = false, fitInfo = { s: 1, hc: CAT_HC_FALLBACK, src: 'fallback' };
  function fitTo(hc, src){
    const s = hc / CAT_HC_FALLBACK; if (Math.abs(s - fitS) < 1e-3 && fitInfo.src === src) return; fitS = s; fitInfo = { s, hc, src };
    for (const [m, s0, x, y, z] of fitted) shrink(m, s0 * s, x, y, z);
    boxes = boxes0.map(([a, b, c, d, px, pz]) => [px + (a - px) * s, px + (b - px) * s, pz + (c - pz) * s, pz + (d - pz) * s]);
    hound.parts.dog.scale.setScalar(s); hound.rug.scale.setScalar(.62 * s);
    // the train and its gauge: rebuild the track meshes (same centre line), resize the cars in place
    for (const o of trackObjs){ group.remove(o); o.geometry?.dispose(); }
    const before = new Set(group.children); track.dispose?.(); const nt = createTrack(group, { loop, surf: surfK, K, TS: TS * s }); const fresh = group.children.filter((o) => !before.has(o));
    fresh.forEach((o, i) => { const old = trackObjs[i]; if (old && old.material && o.material && old.material.type === o.material.type){ o.material.dispose?.(); o.material = old.material; } }); trackObjs = fresh;   // keep the bent, board-clipped materials (hookBend has already seen them)
    track.pt = nt.pt; train.resize(TS * s);
    note(`station: fitted to the cat — Hc ${hc.toFixed(3)} m (${src}) → ×${s.toFixed(3)}`);
  }
  onCatHc((hc, src) => fitTo(hc, src));

  let warm = +(qs.get('hound') || 0); // debug (?at=station&hound=s): pre-run the hound for s seconds against the cat, for close shots
  function update(dt, { T, cat }){
    if (!catDone) catDone = observeCat(cat);   // measures CAT_HC once the game's cat model is in (game/catScale.js); fitTo() follows via onCatHc
    catXZ = localK(cat.up);
    if (warm > 0){ for (let t = 0; t < warm; t += 1 / 30) hound.update(1 / 30, T + t, catXZ, 0); warm = 0; }
    const [cx, cz] = catXZ;
    // a polite toy: it waits while the cat is on the line just ahead of the loco
    let hold = false; const s0 = train.T.s + .5 * train.ks; for (let o = 0; o <= 1.6; o += .1){ const [px, pz] = loop.at(s0 + o); if (Math.hypot(cx - px, cz - pz) < .42){ hold = true; break; } }
    train.T.hold = hold; train.update(dt);
    const arrived = train.T.state === 'dwell' && train.T.next === train.T.stops[0] ? 1 : 0;
    hound.update(dt, T, near(cx, cz) ? catXZ : null, arrived && train.T.wait > 8 ? 1 : 0);
    // platform lift
    const target = liftAt(cx, cz);
    lift += (target - lift) * Math.min(1, dt * 14); if (lift > 1e-4) cat.root.position.addScaledVector(cat.up, lift * K);
  }

  // keep-out circles for the planted mini trees: track, platform, around the halt
  const avoid = []; for (let s = 0; s < loop.L; s += .7){ const [x, z] = loop.at(s); avoid.push([dirK(x, z), .75 * K]); }
  for (let x = -2.4; x <= 2.41; x += .6) avoid.push([dirK(x, .7), 1.0 * K]);
  if (qs.has('tt')) train.update(0);
  else for (let t = 0; t < 1; t += .05) train.update(.05);
  // ?at=station: on the grass south-west of the platform, looking north across it to the line curving away
  const spawn = qs.has('hound') ? dirK(-.6, 1.6) : dirK(.15, 1.32), [su, sv] = F.toUV(spawn);
  note(`station: dir ${U0.toFixed(1)},${V0.toFixed(1)} · loop ${loop.L.toFixed(1)} m`);
  window.__station = { train, hound, local: localK, dirAt: dirK, K, TS, PH, parts, fit: () => fitInfo, rewarm: (sec) => { warm = sec; }, update: null };   // rewarm: debug, re-run the ?hound pre-roll (shots taken after the glb fit)
  return { id: 'station', no: SR?.no || '02', name: SR?.name || NAME, dir: DIR, cardRadius: 6, activeRadius: 40, scale: 1, group, avoid,
    heightAt: null, blocked, update,
    setActive(on){ group.visible = on; if (!on) lift = 0; },
    teleport: { u: su, v: sv, lookAt: qs.has('hound') ? dirK(-.6, -6) : dirK(.15, -6) } };
}
