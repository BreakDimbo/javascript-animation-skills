// 海豹湾 · Seal Bay — one watercolour ocean region (lifeoflagan seals/kayaks look). Self-contained: main.js only creates it,
// chains blocked(), adds the tree keep-out and calls update() once per rendered frame.
// Draw calls: water 1 · seals 1 (instanced) · kayaks 1 (instanced) · paddles 1 (instanced). Ripples/shadows live in the water shader.
import * as THREE from '../../shared/vendor/three.module.js';
import { hookBend } from '../../artkit/bend.js';
import { BAY, sdBay } from './shape.js';
import { waterInk, bankInk } from './ink.js';
import { makeWaterMaterial, NRIP, NSEAL, NKAY } from './water.js';
import { sealGeometry, kayakGeometry, paddleGeometry, KAY_L } from './models.js';

const S = Math.sin, C = Math.cos, TAU = Math.PI * 2, sstep = (a, b, x) => { x = Math.min(Math.max((x - a) / (b - a), 0), 1); return x * x * (3 - 2 * x); };
const HOVER = 0.008; // the patch sits 8 mm above the planet grid (depth precision at 18 m ≈ 0.06 mm)

export function createSealBay(scene, { R, origin }){
  const c = origin.clone().normalize();
  // local frame = the game's default camera frame at c: +x = E (screen right), +y = −N (the default heading, out over the water)
  const E = new THREE.Vector3(0, 1, 0).cross(c).normalize(), N = E.clone().cross(c).normalize(), Bf = N.clone().negate();
  const dirAt = (x, y, out = new THREE.Vector3()) => out.copy(c).multiplyScalar(R).addScaledVector(E, x).addScaledVector(Bf, y).normalize();
  const local = (d) => { const k = d.dot(c); return [R * d.dot(E) / k, R * d.dot(Bf) / k]; };
  const group = new THREE.Group(); group.name = 'sealbay'; scene.add(group);
  const sunL = new THREE.Vector3(-13, 15.6, 1.5).normalize(); // main.js SUN_LOCAL (E, up, N)
  const sunW = E.clone().multiplyScalar(sunL.x).addScaledVector(c, sunL.y).addScaledVector(N, sunL.z).normalize();

  // ---------- uniforms ----------
  const rip = Array.from({ length: NRIP }, () => new THREE.Vector4(0, 0, -100, 0)), ky = Array.from({ length: NKAY }, () => new THREE.Vector4()), sl = Array.from({ length: NSEAL }, () => new THREE.Vector4(0, 0, 0, 0));
  const uni = { uTime: { value: 0 }, uRip: { value: rip }, uKy: { value: ky }, uSl: { value: sl }, uCat: { value: new THREE.Vector4(0, 0, 0, 0) }, uInk: { value: waterInk() }, uBank: { value: bankInk() } };
  let ripN = 0; const spawnRip = (x, y, t0, s = 1) => { rip[ripN++ % NRIP].set(x, y, t0, s); };

  // ---------- water + bank patch (grid following the sphere; aLoc = local metres) ----------
  { const X0 = -10.5, X1 = 10.8, Y0 = -7, Y1 = 11, nx = 106, ny = 90, pos = [], loc = [], idx = [], v3 = new THREE.Vector3();
    for (let j = 0; j <= ny; j++) for (let i = 0; i <= nx; i++){ const x = X0 + (X1 - X0) * i / nx, y = Y0 + (Y1 - Y0) * j / ny; dirAt(x, y, v3).multiplyScalar(R + HOVER); pos.push(v3.x, v3.y, v3.z); loc.push(x, y); }
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++){ const a = j * (nx + 1) + i, b = a + 1, cc = a + nx + 1, d = cc + 1; idx.push(a, b, cc, b, d, cc); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('aLoc', new THREE.Float32BufferAttribute(loc, 2)); g.setIndex(idx);
    const water = new THREE.Mesh(g, makeWaterMaterial(uni)); water.frustumCulled = false; water.renderOrder = 1; water.name = 'sealbay-water'; group.add(water); }

  // ---------- placing things on the water ----------
  const up = new THREE.Vector3(), fw = new THREE.Vector3(), rt = new THREE.Vector3(), P = new THREE.Vector3(), M = new THREE.Matrix4(), M2 = new THREE.Matrix4(), M3 = new THREE.Matrix4(), V = new THREE.Vector3();
  // basis at local (x, y), heading psi (0 = +x, π/2 = +y) → matrix (X = forward, Y = up, Z = right)
  function placeM(x, y, psi, h, out, roll = 0, pitch = 0){
    dirAt(x, y, up); P.copy(up).multiplyScalar(R + HOVER + h);
    fw.copy(E).multiplyScalar(C(psi)).addScaledVector(Bf, S(psi)); fw.addScaledVector(up, -fw.dot(up)).normalize(); rt.crossVectors(fw, up);
    out.makeBasis(fw, up, rt).setPosition(P);
    if (roll || pitch){ M3.makeRotationX(roll).multiply(M2.makeRotationZ(pitch)); out.multiply(M3); }
    return out; }
  const LIT = `vec3 n = normalize(vN); float l = .74 + .36 * max(dot(n, uSun), 0.) + .08 * n.y;`; // matte: hemi-ish fill + low sun, no specular

  // ---------- seals: slate torpedoes; depth 0 crisp with matte dot face, 0.5 bluer and soft, 1 handed over to the water shader ----------
  const sg = sealGeometry(), sD = new Float32Array(NSEAL), lk = new Float32Array(2 * NSEAL); sg.setAttribute('aDepth', new THREE.InstancedBufferAttribute(sD, 1));
  sg.setAttribute('aLk', new THREE.InstancedBufferAttribute(lk, 2)); // (rear-up 0..1, head yaw rad) — r5b seal reaction
  const sealMat = new THREE.ShaderMaterial({ transparent: true, side: THREE.DoubleSide, uniforms: { uSun: { value: sunW }, uEye: { value: sg.userData.eye }, uNose: { value: sg.userData.nose } },
    vertexShader: `attribute float aDepth; attribute vec2 aLk; attribute vec3 color; varying float vD, vM; varying vec3 vN, vO, vV;
mat2 r2(float a){ float c = cos(a), s = sin(a); return mat2(c, s, -s, c); }
void main(){ vD = aDepth; vO = position; vM = color.r;
  vec3 q = position, nq = normal;
  // head turn (yaw about the neck, x ≈ .15) then the front body rearing up 0.36 rad (pitch about the fore flippers, x ≈ .03), both blended so the body bends, not breaks
  float hy = aLk.y * smoothstep(.1, .19, q.x); q.xz = r2(-hy) * (q.xz - vec2(.15, 0.)) + vec2(.15, 0.); nq.xz = r2(-hy) * nq.xz;
  float pu = aLk.x * .38 * smoothstep(-.04, .1, q.x); q.xy = r2(pu) * (q.xy - vec2(.03, -.01)) + vec2(.03, -.01); nq.xy = r2(pu) * nq.xy;
  q.y += aLk.x * .014 * smoothstep(-.06, .06, q.x);   // r7 (vd r6 §4): chest lifted 3.8 cm in all (body .6 + bend 1.8 + this 1.4), showing the pale throat
  vec3 pos = (instanceMatrix * vec4(q, 1.)).xyz; vN = normalize(mat3(instanceMatrix) * nq);
  vec4 mvPosition = modelViewMatrix * vec4(pos, 1.); vV = normalize(cameraPosition - pos); gl_Position = projectionMatrix * mvPosition; }`,
    fragmentShader: `precision highp float; varying float vD, vM; varying vec3 vN, vO, vV; uniform vec3 uSun, uEye, uNose;
void main(){ ${LIT} float d = clamp(vD, 0., 1.), nv = abs(dot(n, normalize(vV)));
  vec3 col = mix(vec3(.243, .290, .388), vec3(.357, .420, .525), smoothstep(.1, .6, nv)) * l;            // #3e4a63 flanks → #5b6b86 back
  col = mix(col, vec3(.56, .6, .66) * l, smoothstep(.9, .95, vM) * .8);                                 // paler muzzle
  float ey = min(length(vO - uEye), length(vO - uEye * vec3(1., 1., -1.))), ns = length(vO - uNose);
  float dots = max(1. - smoothstep(.0065, .0085, ey), 1. - smoothstep(.0065, .0085, ns));
  col = mix(col, vec3(.07, .08, .1), dots * (1. - smoothstep(.05, .3, d)));                               // matte dot eyes + nose
  col = mix(col, vec3(.25, .34, .64), smoothstep(.05, .5, d) * .75);                                    // bluer as it sinks
  float a = mix(1., smoothstep(0., .55, nv), smoothstep(.1, .5, d)) * (1. - smoothstep(.35, .7, d));     // soft silhouette, then gone
  col *= 1. + (fract(sin(dot(floor(vO.xz * 300.), vec2(12.9, 78.2))) * 43758.5) - .5) * .05;           // pigment grain
  if (a < .01) discard; gl_FragColor = vec4(col, a); }` });
  const sealsM = new THREE.InstancedMesh(sg, sealMat, NSEAL); sealsM.frustumCulled = false; sealsM.renderOrder = 3; group.add(sealsM);
  // a loose pod of three follows one smooth curve (time-lagged, offset sideways), two loners roam; each dives on its own cycle
  const podPath = (t) => [-1.2 + 1.5 * S(.075 * t + .4) + .45 * S(.19 * t + 1.1), 2.75 + .75 * S(.11 * t + 2.0) + .3 * S(.23 * t)];
  const SEALS = [
    { path: podPath, lag: 0, side: 0, cyc: 27, off: 4 }, { path: podPath, lag: 2.6, side: .17, cyc: 31, off: 14 }, { path: podPath, lag: 4.4, side: -.14, cyc: 29, off: 22 },
    { path: (t) => [1.7 + 1.1 * S(.09 * t + 2.5) + .3 * S(.27 * t), 1.6 + .55 * S(.13 * t + .3)], lag: 0, side: 0, cyc: 22, off: 10.5 },
    { path: (t) => [2.2 + .9 * S(.07 * t + 4.1), 3.95 + .35 * S(.12 * t + 1.)], lag: 0, side: 0, cyc: 34, off: 30 } ];
  const sealAt = (s, t) => { const [x, y] = s.path(t - s.lag), [x2, y2] = s.path(t - s.lag + .1), psi = Math.atan2(y2 - y, x2 - x); return [x - S(psi) * s.side, y + C(psi) * s.side, psi]; };
  // surface (rest) · dive 2 s · glide 5 s submerged · rise 2 s
  const sealDepth = (s, t) => { const u = ((t + s.off) % s.cyc + s.cyc) % s.cyc, a = s.cyc - 9;
    return u < a ? 0 : u < a + 2 ? sstep(0, 1, (u - a) / 2) : u < a + 7 ? 1 : 1 - sstep(0, 1, (u - a - 7) / 2); };

  // ---------- kayaks (QA17: VD hue/value of red #c4553f, yellow #d6a43e at HSV sat .61 → #c4604c, #d6ab53) + paddles ----------
  const kg = kayakGeometry(), kt = new Float32Array(3 * NKAY); [[.769, .376, .298], [.839, .671, .325]].forEach((cl, i) => kt.set(cl, i * 3)); kg.setAttribute('aTint', new THREE.InstancedBufferAttribute(kt, 3));
  const pg = paddleGeometry(); pg.setAttribute('aTint', new THREE.InstancedBufferAttribute(new Float32Array(3 * NKAY).fill(1), 3));
  const kMat = new THREE.ShaderMaterial({ side: THREE.DoubleSide, uniforms: { uSun: { value: sunW } },
    vertexShader: `attribute vec3 color; attribute float aTintW; attribute vec3 aTint; varying vec3 vC, vN;
void main(){ vC = color * mix(vec3(1.), aTint, aTintW); vec3 pos = (instanceMatrix * vec4(position, 1.)).xyz; vN = normalize(mat3(instanceMatrix) * normal);
  vec4 mvPosition = modelViewMatrix * vec4(pos, 1.); gl_Position = projectionMatrix * mvPosition; }`,
    fragmentShader: `precision highp float; varying vec3 vC, vN; uniform vec3 uSun;
void main(){ ${LIT} gl_FragColor = vec4(vC * l * (1. + (fract(sin(dot(floor(gl_FragCoord.xy * .5), vec2(12.9, 78.2))) * 43758.5) - .5) * .03), 1.); }` });
  const kayM = new THREE.InstancedMesh(kg, kMat, NKAY), padM = new THREE.InstancedMesh(pg, kMat, NKAY); kayM.frustumCulled = padM.frustumCulled = false; group.add(kayM, padM);
  const KAY = [ { path: (t) => [-1.35 + 1.25 * C(.12 * t + 1.0) + .2 * C(.24 * t), 1.75 + .55 * S(.12 * t + 1.0) + .12 * S(.36 * t)], ph: 0 },
    { path: (t) => [1.35 - 1.15 * C(.1 * t + 3.6), 3.0 + .5 * S(.1 * t + 3.6) + .1 * S(.3 * t + 1)], ph: 1.9 } ];
  const kayAt = (k, t) => { const [x, y] = k.path(t), [x2, y2] = k.path(t + .1); return [x, y, Math.atan2(y2 - y, x2 - x)]; };
  const PIV = new THREE.Vector3(-.012, .07, 0), BLADE = .2; // paddle pivot (hull space), blade centre distance along the shaft
  const paddleM = (i, t, out) => { const [x, y, psi] = kayAt(KAY[i], t), ph = TAU * t / 1.6 + KAY[i].ph;
    placeM(x, y, psi, .002 + .003 * S(t * 1.3 + i * 2), M, .03 * S(t * .9 + i * 1.7) + .01 * S(t * 2.1 + i), .015 * S(t * .7 + i));
    // the dipping blade (roll) sweeps bow → stern; one dip per 0.8 s, alternating sides (full L+R cycle 1.6 s)
    out.makeTranslation(PIV.x, PIV.y, PIV.z).multiply(M3.makeRotationY(.5 * C(ph))).multiply(M2.makeRotationX(.5 * S(ph))); out.premultiply(M); return [x, y, psi, ph]; };

  hookBend(group);

  // ---------- events (ripple sources), stepped at 30 Hz so time jumps (?sbT shots) still spawn them at the right moments ----------
  let tPrev = null, lastCatRip = -9, blockedHit = null; const prevD = new Float32Array(NSEAL).fill(-1), lastDip = new Float32Array(NKAY).fill(NaN);
  function events(t){
    for (let i = 0; i < NSEAL; i++){ const s = SEALS[i], r = RE[i];
      if (r.st >= 2 && r.st <= 4){ prevD[i] = -1; continue; }                       // a reacting seal rings its own ripples
      const d = sealDepth(s, t - r.hold + r.ph) * (1 - r.look);
      if (prevD[i] >= 0 && ((prevD[i] > .5) !== (d > .5))){ const [x, y, psi] = sealAt(s, t - r.hold); spawnRip(x + r.ox + C(psi) * .15, y + r.oy + S(psi) * .15, t, d <= .5 ? 1 : .6); }
      prevD[i] = d; }
    for (let i = 0; i < NKAY; i++){ const ph = TAU * t / 1.6 + KAY[i].ph, k = Math.floor(ph / Math.PI);
      if (!isNaN(lastDip[i]) && k !== lastDip[i]){ paddleM(i, t, M2); V.set(0, 0, (k % 2 ? -1 : 1) * BLADE).applyMatrix4(M2); const [x, y] = local(V.normalize()); spawnRip(x, y, t, .55); }
      lastDip[i] = k; }
  }
  // ---------- seals react to the cat (r5) ----------
  // idle → look (nearest surfaced seal within LOOK_R lifts its head and turns toward the cat; it stops swimming while it looks)
  // → dive (the cat kept closing in: inside DIVE_R, or ≥ .35 m closer than when the seal first looked) → under (glides ≈ 1.3 m away
  // from the cat, staying in open water) → rise (resurfaces farther out) → cool (ignores the cat for a while). Calm easing; the only
  // marks are the existing pencil ring ripples on dive and rise.
  const LOOK_R = 2.3, DIVE_R = 1.5, T_DIVE = 1.6, T_UNDER = 3.4, T_RISE = 2.2, T_COOL = 9;
  const RE = SEALS.map(() => ({ dv: 0, ry: 0, surf: 0, p0: 0, psi: 0, st: 0, k: 0, look: 0, yaw: 0, hold: 0, ox: 0, oy: 0, sx: 0, sy: 0, tx: 0, ty: 0, d0: 0, dep: 0, ph: 0 }));
  const angD = (a, b) => { let d = (b - a) % TAU; if (d > Math.PI) d -= TAU; if (d < -Math.PI) d += TAU; return d; };
  let tLastU = null;
  function react(t, dt, cx, cy){
    if (dt <= 0) return;
    const pos = RE.map((r, i) => { const [x, y] = sealAt(SEALS[i], t - r.hold); return [x + r.ox, y + r.oy]; });
    let best = -1, bd = LOOK_R;
    RE.forEach((r, i) => { if (r.st === 1) best = -2; });
    if (best === -1) RE.forEach((r, i) => { if (r.st !== 0) return; const dn = sealDepth(SEALS[i], t - r.hold + r.ph), dd = Math.hypot(pos[i][0] - cx, pos[i][1] - cy); if (dn < .1 && dd < bd){ bd = dd; best = i; } });
    RE.forEach((r, i) => {
      const [x, y] = pos[i], dist = Math.hypot(x - cx, y - cy); r.k += dt;
      if (best === i){ r.st = 1; r.k = 0; r.d0 = dist; }
      if (r.st === 1){
        if (r.k > .2) r.look = Math.min(1, r.look + dt / .5); r.yaw = Math.atan2(cy - y, cx - x); r.hold += dt * Math.max(r.look, sstep(0, .2, r.k));   // r7: stops, 0.2 s pause, then the 0.5 s lift
        if (dist > LOOK_R + .5){ r.st = 0; r.k = 0; }
        else if (r.k > 7){ r.st = 5; r.k = 0; }                                       // the cat just sits there: it loses interest and swims on
        else if (r.k > 1.1 && (dist < DIVE_R || r.d0 - dist > .3)){
          // pick the escape (r5b, vd r5 §6): glide ≈ 1.3 m straight away from the cat and come up 2.2–2.8 m from it; the line is
          // turned a little at a time (and the glide stretched 1.0–1.7 m) until the spot is open water, clear of land and the board edge
          const a0 = Math.atan2(y - cy, x - cx); let tx = x, ty = y, ok = false;
          for (let j = 0; j < 17 && !ok; j++){ const a = a0 + (j % 2 ? 1 : -1) * Math.ceil(j / 2) * .2;
            for (const G of [1.3, 1.2, 1.45, 1.1, 1.6, 1.0, 1.7]){ const nx = x + C(a) * G, ny = y + S(a) * G, dc = Math.hypot(nx - cx, ny - cy);
              if (dc >= 2.2 && dc <= 2.8 && sdBay(nx, ny) < -.4 && Math.abs(nx) < 6 && ny > -3 && ny < 7.2){ tx = nx; ty = ny; ok = true; break; } } }
          if (!ok){ tx = x; ty = y; }                                                     // nowhere better: come back up where it went down
          r.p0 = r.psi; r.dv = 1; r.st = 2; r.k = 0; r.sx = r.ox; r.sy = r.oy; r.tx = r.ox + tx - x; r.ty = r.oy + ty - y; r.yaw = Math.atan2(ty - y, tx - x);
          spawnRip(x, y, t, 1); }
      } else r.look = Math.max(0, r.look - dt / 1.2);
      if (r.st >= 2 && r.dv) r.hold += dt;                                                      // its own route stays paused until the ignore period ends
      if (r.st === 2){ r.dep = sstep(0, 1, r.k / T_DIVE); const u = sstep(0, 1, r.k / (T_DIVE + T_UNDER)) * .25; r.ox = r.sx + (r.tx - r.sx) * u; r.oy = r.sy + (r.ty - r.sy) * u; if (r.k >= T_DIVE){ r.st = 3; r.k = 0; } }
      else if (r.st === 3){ r.dep = 1; const u = .25 + .75 * sstep(0, 1, r.k / T_UNDER); r.ox = r.sx + (r.tx - r.sx) * u; r.oy = r.sy + (r.ty - r.sy) * u; if (r.k >= T_UNDER){ r.st = 4; r.k = 0; spawnRip(x, y, t, .8); r.surf = Math.hypot(x - cx, y - cy); } }
      else if (r.st === 4){ r.dep = 1 - sstep(0, 1, r.k / T_RISE); if (r.k >= T_RISE){ const s = SEALS[i], c = s.cyc; r.st = 5; r.k = 0; r.dep = 0; r.ph -= (((t - r.hold + r.ph + s.off) % c) + c) % c; } } // (its own dive cycle restarts at the surface)
      else if (r.st === 5){ if (r.k >= T_COOL){ r.st = 0; r.k = 0; r.dv = 0; } }
      r.ry = !r.dv ? 0 : r.st >= 2 && r.st <= 4 ? 1 : r.st === 5 ? 1 - sstep(0, 3, r.k) : 0;          // heading: the escape line, eased back to its route once up
      // once the cat has wandered off, the seal slowly drifts back onto its usual round (≈ 25 s)
      if (r.st === 0 && dist > LOOK_R + 1){ const f = Math.exp(-dt / 25), nx = r.ox * f, ny = r.oy * f, [bx, by] = sealAt(SEALS[i], t - r.hold);
        if (sdBay(bx + nx, by + ny) < -.3){ r.ox = nx; r.oy = ny; } }
    });
  }
  // ---------- per frame ----------
  let tSim = 0, last = performance.now();
  function update(cat){
    const now = performance.now(), dt = Math.min((now - last) / 1000, .05); last = now;
    tSim = window.__sbT !== undefined ? +window.__sbT : tSim + dt; const t = tSim; uni.uTime.value = t;
    if (tPrev === null || t < tPrev || t - tPrev > 30) tPrev = t - 3; // fresh start / rewind: replay 3 s of events
    while (tPrev + 1 / 30 <= t){ tPrev += 1 / 30; events(tPrev); }
    const dtS = Math.min(Math.max(t - (tLastU ?? t), 0), .1); tLastU = t;
    if (cat || window.__sbCat){ const [cx, cy] = window.__sbCat || local(cat.up); react(t, dtS, cx, cy); }
    for (let i = 0; i < NSEAL; i++){ const s = SEALS[i], r = RE[i], [x0, y0, psi0] = sealAt(s, t - r.hold), x = x0 + r.ox, y = y0 + r.oy;
      const fz = Math.max(r.look, r.st === 1 ? sstep(0, .2, r.k) : 0);                               // r7: bobbing/sway stop while it looks
      const d = r.st >= 2 && r.st <= 4 ? r.dep : sealDepth(s, t - r.hold + r.ph) * (1 - fz);
      // r5b (vd r5 §6): looking, the body swings fully toward the cat (capped at ±60° off its route heading); the head (vertex bend) takes any rest, ≤ ±35°
      const lw = sstep(0, 1, r.look), dy = angD(psi0, r.yaw), bodyY = Math.max(-1.047, Math.min(1.047, dy));
      let psi = psi0 + bodyY * lw;
      if (r.st === 2) psi = r.p0 + angD(r.p0, r.yaw) * sstep(0, 1.2, r.k);              // turns away calmly as it goes down
      else if (r.st >= 3 && r.dv) psi = psi0 + dy * r.ry;                                       // escape heading, eased back onto the route once up
      r.psi = psi;
      lk[2 * i] = lw; lk[2 * i + 1] = r.st === 1 ? Math.max(-.6, Math.min(.6, dy - bodyY)) * lw : 0;
            // looking: the front body rears up 0.38 rad (vertex bend at the fore flippers) and the head turns to the cat; the body itself stays level
      sD[i] = d; placeM(x, y, psi, -.004 - d * .03 + .006 * r.look, M, S(t * .8 + i) * .05 * (1 - d) * (1 - fz), -.06 * sstep(0, .5, d) * (1 - sstep(.5, 1, d)));
      sealsM.setMatrixAt(i, M); sl[i].set(x, y, psi, d); }
    sealsM.instanceMatrix.needsUpdate = true; sg.attributes.aDepth.needsUpdate = true; sg.attributes.aLk.needsUpdate = true;
    for (let i = 0; i < NKAY; i++){ const [x, y, psi] = paddleM(i, t, M2); kayM.setMatrixAt(i, M); padM.setMatrixAt(i, M2); ky[i].set(x, y, psi, KAY_L); }
    kayM.instanceMatrix.needsUpdate = padM.instanceMatrix.needsUpdate = true;
    if (cat){ const [cx, cy] = local(cat.up); uni.uCat.value.set(cx, cy, 0, sdBay(cx, cy) > 0 ? 1 : 0); }
    if (blockedHit && t - lastCatRip > .8){ spawnRip(blockedHit[0], blockedHit[1], t, .9); lastCatRip = t; } blockedHit = null;
  }
  // the cat may not swim: it stops at the bank; pressing into the edge rings a ripple at the waterline in front of its nose
  // the baked meadow board ends ~17 m south of the shore spawn (v = −95): its last 6 m are fade/clamp garbage (a dark band with white
  // holes), and the frame shows 7.5 m below the cat, so the cat may not walk further south than y = −4.2 (it can always walk back)
  const blocked = (d) => { const [x, y] = local(d); const sd = sdBay(x, y); if (sd >= .2) return false;
    const e = .01, gx = (sdBay(x + e, y) - sdBay(x - e, y)) / (2 * e), gy = (sdBay(x, y + e) - sdBay(x, y - e)) / (2 * e), gl = Math.hypot(gx, gy) || 1;
    blockedHit = [x - gx / gl * (sd + .04), y - gy / gl * (sd + .04)]; return true; };
  // tree keep-out: the water and its bank (main.js plants hedge trees around the cat)
  const avoid = [[dirAt(BAY.water[0], BAY.water[1]), 9.6]];
  return { group, update, blocked, dirAt, local, spawnRip, uni, avoid, sdBay, react: RE,
    seals: (t = tSim) => SEALS.map((s, i) => { const [x, y] = sealAt(s, t - RE[i].hold); return [x + RE[i].ox, y + RE[i].oy, RE[i].st]; }) };
}
