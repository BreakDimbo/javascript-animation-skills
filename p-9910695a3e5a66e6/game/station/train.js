// 小站 · track + toy train. Track = a closed stadium in station-local (x, z): the station straight runs along +x at z = 0,
// curves away north (−z) at both ends; the train runs it slowly, stops at the platform, and rests out of sight on the far side.
// No smoke, no lamps: a painted clay toy.
import * as THREE from '../../shared/vendor/three.module.js';
import { paintMaterial } from './paint.js';
import { mulberry } from '../../artkit/ground.js';
import { Builder } from './kit.js';
import { BOARDU, BEND } from '../../artkit/bend.js';

// r2 palette (review-vd-station-r1 §3): sat ≤ .38, nothing darker than L 25
const PAL = { rail: '#8a8580', soot: '#4a4541', green: '#5f7a5e', greenD: '#55705a', cream: '#e8dcc4', brick: '#9a5f4c', roof: '#55705a', glass: '#8fa1aa', brass: '#a8946e',
  ballast: '#a89c88' };
const SLEEPER = ['#7a6450', '#806a55', '#75604c', '#7d6752', '#836c56'];
export const GAUGE = .2, SH = .016, RH = .022;
// the track is ground, not a prop: clip it at the painted board's edge (props may overhang the board margin, ground must not)
const tight = (m) => { const prev = m.onBeforeCompile, key = m.customProgramCacheKey();
  m.onBeforeCompile = function (s, r){ prev.call(this, s, r); s.fragmentShader = s.fragmentShader.replace('#include <clipping_planes_fragment>',
    'if (uBoardF.w > 0.0 && foldBoardSD(vFoldW) > -0.12) discard;\n#include <clipping_planes_fragment>'); };
  m.customProgramCacheKey = () => key + '|tight'; return m; };

// QA H1 (team-20261030-1955): the cars' cut sits at the INNER edge of the torn rim, not at the rails' −0.12: the ragged rim reaches ~0.27 m into
// the board rect (life group's painted edge), + 0.03 m margin → TRAIN_CUT = −0.30. And it is a VIEW-RAY cut, not a vertical plane: a car fragment
// is discarded when the fragment itself OR the ground point seen behind it (camera ray through the fragment, intersected with the bent ground —
// ten fixed-point steps so the diorama bend's fall-away is followed (offline vs a brute-force ray march on the bent sphere: ≤ 2.4 mm short, worst case)) lies past the cut. So the screen silhouette of the cut follows the
// SD = −0.30 line of the ground behind the train at every height (a vertical cut face leans past the converging board edge toward the roof):
// no train pixel can land on paper or the torn rim. uTrainG = ground radius under the train (set per frame).
export const TRAIN_CUT = -.30;
const TRAIN_G = { value: 600 };
const RAYCUT_GLSL = `uniform float uTrainG;
float trainCutSD(vec3 w){ float sd = foldBoardSD(w), h = length(w) - uTrainG; if (h < .005) return sd;
  vec3 n = normalize(w); float s0 = 600. * length(n - uBend.xyz), D = uBend.w == 0. ? 0. : s0 * s0 * uBend.w; vec3 rd = (w - uBend.xyz * D) - cameraPosition, pu = w;
  for (int i = 0; i < 10; i++){ vec3 n2 = normalize(pu); float s2 = 600. * length(n2 - uBend.xyz), D2 = uBend.w == 0. ? 0. : s2 * s2 * uBend.w, dn = dot(rd, n2);
    if (dn > -1e-4) return sd; pu = cameraPosition + rd * (dot(n2 * uTrainG - uBend.xyz * D2 - cameraPosition, n2) / dn) + uBend.xyz * D2; }
  return max(sd, foldBoardSD(pu)); }
`;
const trainCut = (m) => { const prev = m.onBeforeCompile, key = m.customProgramCacheKey();
  m.onBeforeCompile = function (s, r){ prev.call(this, s, r); s.uniforms.uTrainG = TRAIN_G; if (!s.uniforms.uBend) s.uniforms.uBend = BEND;
    s.fragmentShader = s.fragmentShader.replace('void main()', (s.fragmentShader.includes('uniform vec4 uBend;') ? '' : 'uniform vec4 uBend;\n') + RAYCUT_GLSL + 'void main()')
      .replace('#include <clipping_planes_fragment>', `if (uBoardF.w > 0.0 && trainCutSD(vFoldW) > ${TRAIN_CUT.toFixed(3)}) discard;\n#include <clipping_planes_fragment>`); };
  m.customProgramCacheKey = () => key + '|traincut'; return m; };

export function makeLoop(Ls, Rc){
  const Lc = Math.PI * Rc, L = 2 * Ls + 2 * Lc;
  const at = (s) => { s = ((s % L) + L) % L;
    if (s < Ls) return [-Ls / 2 + s, 0];
    if (s < Ls + Lc){ const t = (s - Ls) / Rc; return [Ls / 2 + Rc * Math.sin(t), -Rc * (1 - Math.cos(t))]; }
    if (s < 2 * Ls + Lc) return [Ls / 2 - (s - Ls - Lc), -2 * Rc];
    const t = (s - 2 * Ls - Lc) / Rc; return [-Ls / 2 - Rc * Math.sin(t), -Rc * (1 + Math.cos(t))]; };
  return { L, at };
}

// surf(x, z, out) → world point on the ground; frame(x, z) → { up }
export function createTrack(group, { loop, surf, K = 1, TS = K }){
  const G = GAUGE * TS;
  const { L, at } = loop, rnd = mulberry(23), N = Math.ceil(L / .08), DS = L / N, P = [], UP = [], FW = [], RT = [];
  for (let i = 0; i < N; i++){ const [x, z] = at(i * DS); P.push(surf(x, z)); }
  for (let i = 0; i < N; i++){ const f = P[(i + 1) % N].clone().sub(P[(i + N - 1) % N]).normalize(), up = P[i].clone().normalize(); FW.push(f); UP.push(up); RT.push(new THREE.Vector3().crossVectors(f, up).normalize()); }
  { // soft ballast bed: a painted wash feathered across its width, sits just on the turf
    const pos = [], uv = [], nrm = [], idx = [], W = .36 * TS + .25; // ballast half-width + a 0.25 m feather into the grass
    for (let i = 0; i <= N; i++){ const k = i % N; for (const s of [-1, 1]){ const p = P[k].clone().addScaledVector(RT[k], s * W).addScaledVector(UP[k], .004); pos.push(p.x, p.y, p.z); nrm.push(UP[k].x, UP[k].y, UP[k].z); uv.push(s < 0 ? 0 : 1, i * DS * 2); }
      if (i < N){ const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); } }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3)); g.setIndex(idx);
    const cv = document.createElement('canvas'); cv.width = 64; cv.height = 64; const c = cv.getContext('2d'), gr = c.createLinearGradient(0, 0, 64, 0);
    { const f = .25 / (2 * W), G2 = (a) => `rgb(${a * 255 | 0},${a * 255 | 0},${a * 255 | 0})`; // alphaMap reads the grey value: soft 0.25 m feather each side, opaque core
      for (const [o, a] of [[0, 0], [f * .5, .3], [f, .85], [f * 1.4, 1], [1 - f * 1.4, 1], [1 - f, .85], [1 - f * .5, .3], [1, 0]]) gr.addColorStop(o, G2(a)); }
    c.fillStyle = gr; c.fillRect(0, 0, 64, 64);
    const t = new THREE.CanvasTexture(cv); t.wrapT = THREE.RepeatWrapping;
    const bm = paintMaterial({ color: PAL.ballast, axis: [1, 0, 0], stroke: 26, mottle: .9, chalk: 0, seed: 6 });
    Object.assign(bm, { alphaMap: t, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
    const m = new THREE.Mesh(g, tight(bm));
    m.renderOrder = 1; m.frustumCulled = false; m.receiveShadow = true; group.add(m); }
  { // rails: swept rounded-ish bars (top + two sides)
    const pos = [], nor = [], push = (a, n) => { pos.push(a.x, a.y, a.z); nor.push(n.x, n.y, n.z); }, hw = .009 * TS, rh = RH * TS * .8, sh = SH * TS;
    const quad = (a, b, c, d, n1, n2) => { push(a, n1); push(b, n2); push(c, n2); push(a, n1); push(c, n2); push(d, n1); };
    for (const side of [-1, 1]) for (let i = 0; i < N; i++){ const j = (i + 1) % N, c = (k, o, h) => P[k].clone().addScaledVector(RT[k], side * G + o).addScaledVector(UP[k], sh + h);
      quad(c(i, -hw, rh), c(j, -hw, rh), c(j, hw, rh), c(i, hw, rh), UP[i], UP[j]);
      quad(c(i, hw, rh), c(j, hw, rh), c(j, hw, 0), c(i, hw, 0), RT[i], RT[j]);
      quad(c(j, -hw, rh), c(i, -hw, rh), c(i, -hw, 0), c(j, -hw, 0), RT[j].clone().negate(), RT[i].clone().negate()); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    const m = new THREE.Mesh(g, tight(paintMaterial({ color: PAL.rail, axis: [1, 0, 0], stroke: 30, mottle: .8, chalk: 0, seed: 2 }))); m.castShadow = true; m.receiveShadow = true; m.frustumCulled = false; group.add(m); }
  { // sleepers: one instanced draw, hand-set skew and colour drift
    const n = Math.floor(L / .2), g = new THREE.BoxGeometry(.05 * TS, SH * TS, .5 * TS), m = new THREE.InstancedMesh(g, tight(paintMaterial({ axis: [0, 0, 1], stroke: 30, mottle: 3, chalk: .04, seed: 3 })), n);
    const o = new THREE.Object3D(), p = new THREE.Vector3(), col = new THREE.Color(), B = new THREE.Matrix4(), rt = new THREE.Vector3();
    for (let i = 0; i < n; i++){ const s = i * (L / n), k = Math.round(s / DS) % N; p.copy(P[k]); rt.copy(RT[k]).addScaledVector(FW[k], (rnd() - .5) * .08).normalize();
      B.makeBasis(rt, UP[k], FW[k].clone().negate()); o.quaternion.setFromRotationMatrix(B);
      o.position.copy(p).addScaledVector(UP[k], (SH / 2 + .002) * TS).addScaledVector(rt, (rnd() - .5) * .025 * TS).addScaledVector(FW[k], (rnd() - .5) * .02 * TS);
      o.scale.set(1, 1, .92 + rnd() * .12); o.updateMatrix(); m.setMatrixAt(i, o.matrix); m.setColorAt(i, col.set(SLEEPER[(rnd() * SLEEPER.length) | 0]).offsetHSL(0, (rnd() - .5) * .03, (rnd() - .5) * .04)); }
    m.castShadow = false; m.receiveShadow = true; m.frustumCulled = false; group.add(m); }
  // continuous lookup (world point at arc length s)
  const pt = (s, out = new THREE.Vector3()) => { s = ((s % L) + L) % L; const f = s / DS, i = Math.floor(f) % N, k = f - Math.floor(f); return out.lerpVectors(P[i], P[(i + 1) % N], k); };
  return { pt };
}

// two-car toy train: loco + one coach (r2: review — train 5.0–5.5 Lc), each one merged vertex-coloured mesh
export function createTrain(group, { track, loop, mat, K = 1, TS = K }){
  let ks = TS / K; // car size (world) per track arc unit
  const rnd = mulberry(77);
  const wheels = (b, zs = [-.3, .3]) => { for (const z of zs) for (const s of [-1, 1]){
    b.add(new THREE.CylinderGeometry(.06, .06, .035, 16).rotateZ(Math.PI / 2), PAL.soot, s * GAUGE, .088, z, 0, 0, 0, .02);
    b.add(new THREE.CylinderGeometry(.022, .022, .04, 10).rotateZ(Math.PI / 2), PAL.brass, s * (GAUGE + .006), .088, z, 0, 0, 0, .02); } };
  const loco = () => { const b = Builder(31); wheels(b);
    b.box(.48, .06, 1.0, PAL.soot, 0, .12, 0, 0, .025);                                                                   // footplate
    b.add(new THREE.CylinderGeometry(.165, .165, .58, 22, 1).rotateX(Math.PI / 2), PAL.green, 0, .3, .17, 0, 0, 0, .02); // boiler (front = +z)
    b.add(new THREE.CylinderGeometry(.17, .17, .04, 22).rotateX(Math.PI / 2), PAL.greenD, 0, .3, .47, 0, 0, 0, .01);    // smokebox ring
    b.add(new THREE.CylinderGeometry(.13, .13, .03, 18).rotateX(Math.PI / 2), PAL.soot, 0, .3, .49, 0, 0, 0, .01);       // smokebox door
    b.add(new THREE.CylinderGeometry(.04, .05, .11, 12), PAL.soot, 0, .5, .36, 0, 0, 0, .01);                          // short stack (cold)
    b.add(new THREE.SphereGeometry(.055, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), PAL.brass, 0, .45, .14, 0, 0, 0, .02); // dome
    b.box(.44, .38, .36, PAL.green, 0, .33, -.27, 0, .05, .02);                                                           // cab
    b.box(.52, .05, .46, PAL.roof, 0, .54, -.27, 0, .02, .02);                                                            // cab roof
    for (const s of [-1, 1]) b.box(.02, .12, .14, PAL.glass, s * .222, .4, -.24, 0, .008, .01);                          // cab windows
    b.box(.5, .03, .03, PAL.brick, 0, .15, .5, 0, .01);                                                                   // buffer beam
    for (const s of [-1, 1]) b.add(new THREE.CylinderGeometry(.022, .022, .05, 10).rotateX(Math.PI / 2), PAL.soot, s * .15, .15, .53);
    return b.mesh(mat); };
  // QA H1 §9 (r4: kept short — the full 0.96 coach needs the halt ≈ 0.6 (0.9 m) further in, past the board's right edge): the coach is a SHORT four-wheeler (body 0.56 car units, was 0.96; two windows a side, wheelbase ±0.18). The board cannot hold
  // the 9.1 Hc train docked whole inside the −0.30 m cut AND keep the loco's buffer ≥ 0.3 Hc clear of the shelter eave (window −0.575 m).
  const CB = .28;   // coach half body (car units); buffer tips at CB + .02
  const coach = (k) => { const b = Builder(41 + k); wheels(b, [-.18, .18]);
    b.box(.46, .05, 2 * CB, PAL.soot, 0, .12, 0, 0, .02);
    b.box(.46, .12, 2 * CB - .02, PAL.brick, 0, .2, 0, 0, .04, .02);                                                     // lower panels
    b.box(.45, .2, 2 * CB - .02, PAL.cream, 0, .35, 0, 0, .045, .02);                                                    // upper / windows band
    b.box(.52, .055, 2 * CB + .04, PAL.greenD, 0, .475, 0, 0, .025, .02);                                                // roof
    for (const z of [-.13, .13]) for (const s of [-1, 1]) b.box(.02, .1, .17, PAL.glass, s * .226, .36, z, 0, .01, .01);
    for (const z of [-CB, CB]) for (const s of [-1, 1]) b.add(new THREE.CylinderGeometry(.02, .02, .04, 10).rotateX(Math.PI / 2), PAL.soot, s * .15, .15, z);
    return b.mesh(mat); };
  const cars = [loco(), coach(0)]; for (const m of cars){ m.frustumCulled = false; m.scale.setScalar(TS); group.add(m); }
  const GAP = .5 + CB + .04; let SPACING = GAP * ks;                       // r2.1: buffers just touching (§9 short coach: 0.82, train 1.69 car units = 7.2 Hc)
  const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _m = new THREE.Vector3(), _f = new THREE.Vector3(), _u = new THREE.Vector3(), _r = new THREE.Vector3(), _B = new THREE.Matrix4();
  const place = (m, s) => { track.pt(s + .33 * ks, _a); track.pt(s - .33 * ks, _b); _m.copy(_a).add(_b).multiplyScalar(.5); _f.copy(_a).sub(_b).normalize(); _u.copy(_m).normalize();
    _r.crossVectors(_u, _f).normalize(); _u.crossVectors(_f, _r); _B.makeBasis(_r, _u, _f); m.quaternion.setFromRotationMatrix(_B); m.position.copy(_m); };
  const T = { s: 0, vel: 0, state: 'run', wait: 0, vmax: .7, hold: false, stops: [] };
  const L = loop.L, fwdDist = (a, b) => (((b - a) % L) + L) % L;
  function step(dt){
    if (T.state === 'dwell'){ T.wait -= dt; if (T.wait <= 0){ T.state = 'run'; T.last = T.next; } return; }
    // next stop ahead (skip the one just left)
    let best = null, bd = 1e9; for (const st of T.stops){ if (st === T.last) continue; const d = fwdDist(T.s, st.s); if (d < bd){ bd = d; best = st; } }
    const brake = .14, tgt = T.hold ? 0 : Math.min(T.vmax, Math.sqrt(2 * brake * bd) + .03);
    T.vel += THREE.MathUtils.clamp(tgt - T.vel, -(T.hold ? .5 : brake * 1.6) * dt, .16 * dt); T.vel = Math.max(0, T.vel);
    const st = T.vel * dt;
    if (best && (bd < .01 || (st >= bd && bd < 2))){ T.s = best.s; T.vel = 0; T.state = 'dwell'; T.wait = best.wait; T.next = best; T.arrived = best; }
    else T.s += st;
    T.s = ((T.s % L) + L) % L; }
  // review-vd-station-r3 #1: no part of the train ever hangs over paper. The cars share the rails' board clip (tight(): nothing past
  // foldBoardSD −0.12, where the rails end) and dissolve 1→0 (smoothstep) over the last 1.5 m before the head leaves / after the tail enters.
  // QA H2 (hedge-20261030-1910): a global alpha dissolve read as a glass train (interior boxes, rear wheels and trees seen through, roof/cab
  // sorting in front of trees), and a screen-space dither at that size reads as screen-door noise. So the cars stay fully OPAQUE (depthWrite on,
  // no transparency) and only the part past the board-clip line is removed, per fragment, by the same clip as the rails (tight()); the train
  // slides out of / into the board where the rails end. No alpha anywhere, so no interior can ever show through the shell.
  mat.transparent = false; mat.opacity = 1; mat.depthWrite = true; trainCut(mat);
  const R = 600, _p = new THREE.Vector3(), _q = new THREE.Vector3(), _d = new THREE.Vector3(), _t = new THREE.Vector3(), _l = new THREE.Vector3();
  const boardSD = (w) => { const F = BOARDU.F.value, X = BOARDU.X.value, Y = BOARDU.Y.value; if (!(F.w > 0)) return -1e3;   // foldBoardSD (bend.js), metres
    _d.copy(w).normalize(); if (_d.x * F.x + _d.y * F.y + _d.z * F.z < .9) return 1e3;
    const fx = F.x * X.x + F.y * X.y + F.z * X.z, fy = F.x * Y.x + F.y * Y.y + F.z * Y.z;
    const qx = Math.abs(R * (_d.x * X.x + _d.y * X.y + _d.z * X.z - fx)) - X.w, qy = Math.abs(R * (_d.x * Y.x + _d.y * Y.y + _d.z * Y.z - fy)) - Y.w;
    return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0); };
  const HW = .27, HEAD = .56, TAIL = CB + .03, CLIP = TRAIN_CUT, TOP = .57, FADE = 1.5, DS = .04;   // TOP: roof / chimney top (car units)    // car half-width / buffer overhangs (car units), rail clip (m), dissolve (m), scan step (arc)
  const sdAt = (s) => { track.pt(s, _p); track.pt(s + .02, _q); _t.subVectors(_q, _p).normalize(); _l.crossVectors(_p, _t).normalize().multiplyScalar(HW * ks * K);
    return Math.max(boardSD(_q.copy(_p).add(_l)), boardSD(_q.copy(_p).sub(_l)), boardSD(_p)); };
  const ends = (s) => [s + HEAD * ks, s - SPACING - TAIL * ks];
  const maxSD = (s) => { const [h, t] = ends(s); let m = -1e9; for (let x = t; x <= h + 1e-6; x += DS) m = Math.max(m, sdAt(x)); return Math.max(m, sdAt(h)); };
  const minSD = (s) => { const [h, t] = ends(s); let m = 1e9; for (let x = t; x <= h + 1e-6; x += DS) m = Math.min(m, sdAt(x)); return Math.min(m, sdAt(h)); };
  // the shader's view-ray cut in JS (trainCutSD): camera from the cars' last onBeforeRender, ground radius under the train
  const cam = new THREE.Vector3(), _rr = new THREE.Vector3(), _uu = new THREE.Vector3(), _nn = new THREE.Vector3(), _FF = new THREE.Vector3(), _n2 = new THREE.Vector3(), _gg = new THREE.Vector3(); let camOK = false;
  const dropAt = (v) => { const B = BEND.value; if (B.w === 0) return 0; _nn.copy(v).normalize(); const s0 = R * Math.hypot(_nn.x - B.x, _nn.y - B.y, _nn.z - B.z); return s0 * s0 * B.w; };
  const raySD = (w) => { const sd = boardSD(w), h = w.length() - TRAIN_G.value; if (!camOK || h < .005) return sd; const B = BEND.value; _FF.set(B.x, B.y, B.z);
    _rr.copy(w).addScaledVector(_FF, -dropAt(w)).sub(cam); _uu.copy(w);
    for (let i = 0; i < 10; i++){ const D2 = dropAt(_uu), n2 = _n2.copy(_uu).normalize(), dn = _rr.dot(n2); if (dn > -1e-4) return sd;
      const t = _gg.copy(n2).multiplyScalar(TRAIN_G.value).addScaledVector(_FF, -D2).sub(cam).dot(n2) / dn; _uu.copy(cam).addScaledVector(_rr, t).addScaledVector(_FF, D2); }
    return Math.max(sd, boardSD(_uu)); };
  const _upv = new THREE.Vector3(), _ww = new THREE.Vector3();
  const raySDAt = (s) => { track.pt(s, _p); track.pt(s + .02, _q); _t.subVectors(_q, _p).normalize(); _l.crossVectors(_p, _t).normalize().multiplyScalar(HW * ks * K); _upv.copy(_p).normalize();
    let m = -1e9; for (const sg of [-1, 0, 1]) for (const hh of [0, .5, 1]){ _ww.copy(_p).addScaledVector(_l, sg).addScaledVector(_upv, hh * TOP * ks * K); m = Math.max(m, raySD(_ww)); } return m; };
  const maxRaySD = (s) => { const [h, t] = ends(s); let m = -1e9; for (let x = t; x <= h + 1e-6; x += DS) m = Math.max(m, raySDAt(x)); return Math.max(m, raySDAt(h)); };
  cars.forEach((c) => { c.onBeforeRender = (r, sc, camera) => { if (!camera.isPerspectiveCamera) return; camera.getWorldPosition(cam); camOK = true; /* view pass only (not the sun's shadow camera) */ }; });
  const metres = (a, b) => track.pt(a, _p).distanceTo(track.pt(b, _q));
  const scan = (s0, dir) => { let m = 0; for (let k = 1; k * DS <= 4 / K; k++){ const s = s0 + dir * k * DS; m += metres(s, s - dir * DS); if (sdAt(s) > CLIP) return m; } return 1e3; }; // metres along the line until the clip
  const fade = { op: 1, maxSD: -1e3, exit: 1e3, entry: 1e3, wL: FADE, wE: FADE };
  const ss = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  const applyFade = () => { const [h, t] = ends(T.s); fade.maxSD = maxSD(T.s); fade.exit = scan(h, 1); fade.entry = scan(t, -1);
    // the dock is T.stops[0]. Leaving: 1→0 over the last 1.5 m before the head reaches the rail end. Arriving: the board leaves only ~0.1 m between
    // the tail entering and the dock, so the train dissolves 0→1 over the last 1.5 m of its approach and anything past the rail end is discarded by
    // the same board clip as the rails (tight): nothing is ever drawn over paper.
    const st = T.stops[0], dTo = st ? ((((st.s - T.s) % loop.L) + loop.L) % loop.L) * K : 1e9; fade.dTo = dTo;
    // H2: no alpha. op = 1 while any part of the train is inside the clip line (drawn opaque, the rest discarded per fragment), 0 once it is wholly past.
    fade.minSD = minSD(T.s);
    if (fade.maxSD > 1e2){ fade.op = 1; fade.cut = 0; } // another region's board (the train is clipped away by its prop margin anyway)
    else { TRAIN_G.value = track.pt(T.s, _ww).length(); fade.rayMax = fade.maxSD > CLIP - 1.5 ? maxRaySD(T.s) : -1e3;   // ray check only when an end is within 1.5 m of the cut
      fade.op = fade.minSD < CLIP ? 1 : 0; fade.cut = Math.max(fade.maxSD, fade.rayMax) > CLIP ? 1 : 0; }
    // shadows follow the clip: the depth pass has no board clip, so a train partly past the line casts no shadow (no shade from a part not drawn)
    for (const m of cars){ m.visible = fade.op > 0; m.castShadow = fade.op > 0 && !fade.cut; } };
  // docked: both ends ≥ margin inside the board edge; the dissolve windows shrink to what the line gives on either side of the stop (≤ 1.5 m)
  // §9: docked = whole inside the cut with ≥ margin at both ends, at the base (toCut) AND along the view rays (rayToCut; before the first frame,
  // without a camera, the base margin must also cover the roof lean: r4 0.37 m, measured at the game camera on team-merge-1440). sHi = the eave cap from the region. Nearest to stop0 that passes;
  // if none, the most-inside position ≤ sHi, flagged ok: false.
  const dockAt = (stop0, margin, sLo, sHi) => { let best = null, alt = null, altM = -1e9;
    for (let s = sLo; s <= sHi + 1e-9; s += DS / 2){ TRAIN_G.value = track.pt(s, _ww).length(); const b = CLIP - maxSD(s), r = b < margin ? b : camOK ? CLIP - maxRaySD(s) : b - .37, m = Math.min(b, r);   // ray scan only where the base passes
      if (m >= margin && (best === null || Math.abs(s - stop0) < Math.abs(best - stop0))) best = s; if (m > altM){ altM = m; alt = s; } }
    const ok = best !== null, s = ok ? best : (alt ?? stop0), [h, t] = ends(s); fade.wL = Math.min(FADE, scan(h, 1)); fade.wE = Math.min(FADE, scan(t, -1)); TRAIN_G.value = track.pt(s, _ww).length();
    return { s, ok, cam: camOK, margin: -maxSD(s), toCut: CLIP - maxSD(s), rayToCut: camOK ? CLIP - maxRaySD(s) : null, head: h, exit: scan(h, 1), entry: scan(t, -1) }; };   // toCut / rayToCut in m (≥ 0 = drawn whole)
  const update = (dt) => { step(dt); cars.forEach((m, i) => place(m, T.s - i * SPACING)); applyFade(); };
  // centres of the cars (arc lengths) for collision
  const carS = () => cars.map((_, i) => T.s - i * SPACING);
  // r2.1: follow the cat's size (game/catScale.js): same centre line, cars and spacing scale together
  const resize = (ts) => { ks = ts / K; SPACING = GAP * ks; for (const m of cars) m.scale.setScalar(ts); };
  return { T, cars, update, carS, resize, fade, dockAt, maxSD, boardSD, ends, HEAD, halfL: [.5, CB + .02], get camOK(){ return camOK; }, get SPACING(){ return SPACING; }, get ks(){ return ks; } };
}
