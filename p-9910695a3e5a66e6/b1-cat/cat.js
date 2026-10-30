// 褶星 Fold — b1: clay old orange cat + spherical-planet controller.
// exports createCat(scene) -> cat, updateCat(cat, dt, input, planet)  (also cat.update(dt,input,planet))
import * as THREE from '../shared/vendor/three.module.js';

const ORANGE = 0xd0874a, ORANGE_DK = 0xbb7341, WHITE = 0xf2eadb, PINK = 0xc98a7c, INK = 0x2b241d;
const G = 9.8, WALK = 0.75, TROT = 1.7, SPRINT = 4.6, JUMP_V = 3.35, CAT_R = 0.13;
const L = 0.115; // nominal leg length

// gouache look: 4 soft value bands (toon gradient) x hand-painted canvas grain (dry-brush strokes + paper tooth)
let _grad = null, _grain = null;
function gouacheTex() {
  if (_grad) return;
  const g = new Uint8Array([92, 150, 205, 238]); _grad = new THREE.DataTexture(g, 4, 1, THREE.RedFormat); _grad.needsUpdate = true;
  const c = document.createElement('canvas'); c.width = c.height = 256; const x = c.getContext('2d');
  x.fillStyle = '#fff'; x.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 900; i++) { // short dry-brush strokes along the fur direction
    const v = 205 + Math.random() * 50 | 0; x.strokeStyle = `rgba(${v},${v - 6},${v - 14},0.35)`; x.lineWidth = 1 + Math.random() * 2.5;
    const px = Math.random() * 256, py = Math.random() * 256, l = 4 + Math.random() * 10; x.beginPath(); x.moveTo(px, py); x.lineTo(px + l * 0.3, py + l); x.stroke();
  }
  const d = x.getImageData(0, 0, 256, 256); for (let i = 0; i < d.data.length; i += 4) { const n = (Math.random() - 0.5) * 22; d.data[i] += n; d.data[i + 1] += n; d.data[i + 2] += n; } x.putImageData(d, 0, 0);
  _grain = new THREE.CanvasTexture(c); _grain.wrapS = _grain.wrapT = THREE.RepeatWrapping; _grain.colorSpace = THREE.SRGBColorSpace;
}
const mat = c => { gouacheTex(); return new THREE.MeshToonMaterial({ color: c, gradientMap: _grad, map: _grain }); };
function blob(r, sx, sy, sz, m) { const o = new THREE.Mesh(new THREE.SphereGeometry(r, 20, 14), m); o.scale.set(sx, sy, sz); o.castShadow = true; return o; }

function buildCat() {
  const M = { o: mat(ORANGE), d: mat(ORANGE_DK), w: mat(WHITE), p: mat(PINK), k: mat(INK) };
  const root = new THREE.Group();
  const body = new THREE.Group(); root.add(body);            // pivot at hips
  const torso = new THREE.Group(); body.add(torso);
  const t = blob(1, 0.078, 0.082, 0.19, M.o); t.position.set(0, 0, 0.12); torso.add(t);
  const belly = blob(1, 0.068, 0.056, 0.15, M.w); belly.position.set(0, -0.035, 0.13); torso.add(belly);
  const chest = blob(1, 0.07, 0.078, 0.07, M.w); chest.position.set(0, -0.012, 0.27); torso.add(chest);
  for (let i = 0; i < 4; i++) { const s = blob(1, 0.072, 0.056, 0.02, M.d); s.position.set(0, 0.03, 0.03 + i * 0.065); torso.add(s); } // tabby bands, sunk flush into the torso
  const haunch = blob(1, 0.1, 0.085, 0.09, M.o); haunch.position.set(0, 0.005, 0.0); torso.add(haunch);

  const neck = new THREE.Group(); neck.position.set(0, 0.03, 0.3); body.add(neck);
  const head = new THREE.Group(); head.position.set(0, 0.025, 0.05); neck.add(head);
  head.add(blob(1, 0.074, 0.066, 0.068, M.o));
  head.scale.set(1.14, 1.08, 1.06); // rounder, bigger head (less potato)
  for (const sx of [-1, 1]) { const wp = blob(1, 0.024, 0.02, 0.022, M.w); wp.position.set(sx * 0.016, -0.026, 0.058); head.add(wp); } // whisker pads
  const chin = blob(1, 0.022, 0.014, 0.02, M.w); chin.position.set(0, -0.043, 0.045); head.add(chin);
  const nose = blob(0.009, 1.2, 0.8, 1, M.p); nose.position.set(0, -0.01, 0.079); head.add(nose);
  const eyes = [];
  for (const sx of [-1, 1]) {
    const e = blob(0.0105, 1, 0.75, 0.6, M.k); e.position.set(sx * 0.03, 0.008, 0.06); e.castShadow = false; head.add(e); eyes.push(e);
    const ear = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.055, 4), M.o); ear.position.set(sx * 0.042, 0.06, -0.008); ear.rotation.set(-0.15, Math.PI / 4, sx * -0.35); ear.castShadow = true; head.add(ear);
    const ei = new THREE.Mesh(new THREE.ConeGeometry(0.017, 0.035, 4), M.p); ei.position.set(sx * 0.04, 0.054, 0.004); ei.rotation.copy(ear.rotation); head.add(ei);
    const ch = blob(1, 0.035, 0.03, 0.03, M.o); ch.position.set(sx * 0.045, -0.02, 0.02); head.add(ch); // cheek ruff
    for (let k = 0; k < 4; k++) head.add(blob(1, 0.008, 0.008, 0.012, M.d).translateX(sx * 0.0).translateY(0.05).translateZ(-0.03 + k * 0.022).translateX(sx * 0.0)); // forehead marks
  }
  // legs: pivot group -> upper(capsule mesh) + paw
  const legs = [];
  const legDef = [[-0.05, -0.035, 0.25, true], [0.05, -0.035, 0.25, true], [-0.055, -0.03, 0.0, false], [0.055, -0.03, 0.0, false]];
  for (const [x, y, z, front] of legDef) {
    const piv = new THREE.Group(); piv.position.set(x, y, z); body.add(piv);
    const thigh = front ? null : blob(1, 0.04, 0.06, 0.055, M.o); if (thigh) { thigh.position.set(0, -0.01, 0); piv.add(thigh); }
    const up = new THREE.Mesh(new THREE.CapsuleGeometry(front ? 0.021 : 0.025, L - 0.03, 4, 10), M.o); up.castShadow = true; piv.add(up);
    const paw = blob(1, 0.026, 0.017, 0.033, M.w); piv.add(paw);
    legs.push({ piv, up, paw, front, side: Math.sign(x), jy: y, jz: z });
  }
  // tail: chain
  const tail = []; let parent = body;
  for (let i = 0; i < 7; i++) {
    const g = new THREE.Group(); g.position.set(0, i ? 0 : 0.04, i ? 0.045 : -0.06); if (!i) g.rotation.y = Math.PI; parent.add(g);
    const s = new THREE.Mesh(new THREE.CapsuleGeometry(0.019 - i * 0.0012, 0.03, 3, 8), i > 4 ? M.d : M.o); s.rotation.x = Math.PI / 2; s.position.z = 0.022; s.castShadow = true; g.add(s);
    tail.push(g); parent = g;
  }
  return { root, body, torso, neck, head, legs, tail, eyes };
}

const POSES = {
  stand:   { hipY: 0.15, pitch: 0, roll: 0, legF: 0, legH: 0, fold: 0, headP: 0, headY: 0, neckY: 0.03, tailUp: 0.5, tailCurl: 0.15, squash: 1, stretchF: 0 },
  sit:     { hipY: 0.07, pitch: 0.55, roll: 0, legF: 0, legH: -1.45, fold: 0, headP: -0.45, headY: 0, neckY: 0.035, tailUp: -0.35, tailCurl: 0.5, squash: 1, stretchF: 0 },
  sleep:   { hipY: 0.075, pitch: 0.0, roll: 0.35, legF: -1.35, legH: -1.35, fold: 1, headP: 0.35, headY: 1.0, neckY: -0.02, tailUp: -0.2, tailCurl: 1.0, squash: 0.82, stretchF: 0 },
  stretch: { hipY: 0.16, pitch: -0.32, roll: 0, legF: -0.7, legH: 0.15, fold: 0, headP: -0.15, headY: 0, neckY: 0.0, tailUp: 1.1, tailCurl: 0.05, squash: 1, stretchF: 1 },
  air:     { hipY: 0.15, pitch: 0, roll: 0, legF: -0.5, legH: 0.6, fold: 0, headP: -0.1, headY: 0, neckY: 0.03, tailUp: 0.3, tailCurl: 0.0, squash: 1, stretchF: 0 },
};

export function createCat(scene, planet) {
  const parts = buildCat();
  scene.add(parts.root);
  const up = planet ? planet.spawnUp.clone() : new THREE.Vector3(0, 0, 1);
  const R = planet ? planet.R : 600;
  const fwd = new THREE.Vector3(0, 1, 0); fwd.addScaledVector(up, -fwd.dot(up)); if (fwd.lengthSq() < 1e-4) fwd.set(1, 0, 0); fwd.normalize();
  const cat = {
    ...parts, R,
    pos: up.clone().multiplyScalar(R), up, fwd,
    alt: 0, vy: 0, speed: 0, grounded: true, ground: 0,
    state: 'idle', gait: 'idle', phase: 0, t: 0, idleT: 0, holdT: 0, stretchT: 0, blink: 2,
    pose: { ...POSES.stand },
    update(dt, input, pl) { updateCat(cat, dt, input, pl); },
  };
  orient(cat);
  return cat;
}

const _v = new THREE.Vector3(), _q = new THREE.Quaternion(), _m = new THREE.Matrix4(), _x = new THREE.Vector3(), _l = new THREE.Vector3();

function orient(cat) {
  _x.crossVectors(cat.up, cat.fwd).normalize();
  _m.makeBasis(_x, cat.up, cat.fwd);
  cat.root.quaternion.setFromRotationMatrix(_m);
  cat.root.position.copy(cat.pos);
}

// input: { x, y (camera-relative: y forward), sprint, jump (edge), sit (edge), sleep (edge) }, camFwd: tangent-ish vector
export function updateCat(cat, dt, input, planet, camFwd) {
  dt = Math.max(0, Math.min(dt, 0.05)); cat.t += dt;
  const up = cat.up;
  // camera-relative desire on the tangent plane
  const cf = _v.copy(camFwd || cat.fwd); cf.addScaledVector(up, -cf.dot(up)).normalize();
  const cr = _x.crossVectors(cf, up).normalize();
  const want = new THREE.Vector3().addScaledVector(cf, input.y || 0).addScaledVector(cr, input.x || 0);
  const mag = Math.min(1, want.length()); if (mag > 0.01) want.normalize();
  const moving = mag > 0.01;

  // state transitions
  if (input.sleep) cat.state = cat.state === 'sleep' ? 'idle' : (cat.grounded ? 'sleep' : cat.state);
  if (input.sit) cat.state = cat.state === 'sit' ? 'idle' : (cat.grounded ? 'sit' : cat.state);
  if (moving && (cat.state === 'sit' || cat.state === 'sleep' || cat.state === 'stretch')) cat.state = 'idle';
  if (input.jump && cat.grounded && cat.state !== 'sleep') { cat.vy = JUMP_V * (input.sprint ? 1.05 : 1); cat.grounded = false; if (cat.state === 'sit') cat.state = 'idle'; }
  if (cat.state === 'idle' && !moving && cat.grounded && cat.speed < 0.05) { cat.idleT += dt; if (cat.idleT > 7) { cat.state = 'stretch'; cat.stretchT = 0; cat.idleT = 0; } } else cat.idleT = 0;
  if (cat.state === 'stretch') { cat.stretchT += dt; if (cat.stretchT > 2.8) cat.state = 'idle'; }

  // heading turns toward desire (parallel to tangent plane)
  let target = 0;
  if (moving && (cat.state === 'idle')) {
    cat.holdT += dt;
    const ang = Math.atan2(_l.crossVectors(cat.fwd, want).dot(up), cat.fwd.dot(want));
    const rate = (cat.grounded ? 5.5 : 1.5) * dt;
    const turn = Math.max(-rate, Math.min(rate, ang));
    _q.setFromAxisAngle(up, turn); cat.fwd.applyQuaternion(_q);
    target = (input.sprint ? SPRINT : cat.holdT > 1.4 ? TROT : WALK) * mag * (Math.abs(ang) > 1.6 ? 0.4 : 1);
  } else cat.holdT = 0;
  const acc = target > cat.speed ? 3.5 : 6;
  if (cat.grounded) cat.speed += (target - cat.speed) * Math.min(1, acc * dt);

  // move along the tangent, then parallel-transport the heading to the new up
  const np = _v.copy(cat.pos).addScaledVector(cat.fwd, cat.speed * dt);
  const nUp = np.clone().normalize();
  // collisions with box colliders (in their local frames, y = radial)
  let support = 0;
  if (planet) for (const c of planet.colliders) {
    _l.copy(nUp).multiplyScalar(cat.R + cat.alt).applyMatrix4(c.inv);
    if (Math.abs(_l.x) > c.hx + CAT_R + 0.5 || Math.abs(_l.z) > c.hz + CAT_R + 0.5) continue;
    const inX = Math.abs(_l.x) < c.hx + CAT_R * 0.6, inZ = Math.abs(_l.z) < c.hz + CAT_R * 0.6;
    if (inX && inZ) {
      if (cat.alt >= c.top - 0.06) { support = Math.max(support, c.top); continue; }
      // push out along shallowest axis
      const px = c.hx + CAT_R * 0.6 - Math.abs(_l.x), pz = c.hz + CAT_R * 0.6 - Math.abs(_l.z);
      if (px < pz) _l.x += Math.sign(_l.x) * px; else _l.z += Math.sign(_l.z) * pz;
      _l.applyMatrix4(_m.copy(c.inv).invert()); nUp.copy(_l).normalize();
      cat.speed *= 0.6;
    }
  }
  _q.setFromUnitVectors(up, nUp); cat.fwd.applyQuaternion(_q);
  cat.up.copy(nUp); cat.fwd.addScaledVector(nUp, -cat.fwd.dot(nUp)).normalize();

  // radial gravity
  cat.ground = support;
  if (!cat.grounded) { cat.vy -= G * dt; cat.alt += cat.vy * dt; if (cat.alt <= support && cat.vy <= 0) { cat.alt = support; cat.vy = 0; cat.grounded = true; cat.land = 0.25; } }
  else if (cat.alt > support + 0.03) { cat.grounded = false; cat.vy = 0; }
  else cat.alt += (support - cat.alt) * Math.min(1, 20 * dt);
  cat.pos.copy(cat.up).multiplyScalar(cat.R + cat.alt);
  orient(cat);
  animate(cat, dt, moving);
}

function lerpPose(p, t, k) { for (const key in t) p[key] += (t[key] - p[key]) * k; }

function animate(cat, dt, moving) {
  const s = cat.speed;
  const gait = s < 0.05 ? 'idle' : s < 1.2 ? 'walk' : s < 3 ? 'trot' : 'sprint';
  cat.gait = gait;
  let tgt = !cat.grounded ? POSES.air : POSES[cat.state] || POSES.stand;
  if (!cat.grounded) tgt = { ...POSES.air, pitch: Math.max(-0.4, Math.min(0.4, cat.vy * 0.12)) };
  lerpPose(cat.pose, tgt, Math.min(1, (cat.state === 'sleep' ? 2.2 : 7) * dt));
  const P = cat.pose;

  // gait cycle
  const freq = gait === 'walk' ? 1.6 * s / WALK * 0.9 : gait === 'trot' ? 2.6 : gait === 'sprint' ? 3.6 : 0;
  cat.phase += freq * dt * Math.PI * 2;
  const amp = gait === 'walk' ? 0.38 : gait === 'trot' ? 0.55 : gait === 'sprint' ? 0.85 : 0;
  cat.amp = (cat.amp || 0) + (amp - (cat.amp || 0)) * Math.min(1, 6 * dt);
  const A = cat.grounded ? cat.amp : 0;
  // leg phase offsets: walk = lateral sequence, trot = diagonal pairs, sprint = rotary gallop
  const off = gait === 'sprint' ? [0.0, 0.12, 0.55, 0.65] : gait === 'trot' ? [0, 0.5, 0.5, 0] : [0.5, 0, 0.25, 0.75];
  cat.off = cat.off || off.slice(); for (let i = 0; i < 4; i++) cat.off[i] += (off[i] - cat.off[i]) * Math.min(1, 4 * dt);

  let bob = A * 0.022 * Math.abs(Math.sin(cat.phase)), flex = gait === 'sprint' ? Math.sin(cat.phase) * 0.12 * A : 0;
  const breathe = Math.sin(cat.t * (cat.state === 'sleep' ? 1.6 : 2.4)) * 0.006;
  if (cat.land > 0) { cat.land -= dt; bob -= cat.land * 0.12; }
  const pitch = P.pitch + flex;
  cat.body.position.set(0, P.hipY + bob + breathe * 0.5, -0.13);
  cat.body.rotation.set(-pitch, 0, P.roll);
  cat.torso.scale.set(1 + breathe, P.squash + breathe * 1.5, 1 + P.stretchF * 0.06);
  cat.root.position.addScaledVector(cat.up, 0); // root sits on ground at cat.pos

  for (let i = 0; i < 4; i++) {
    const g = cat.legs[i], ph = cat.phase + cat.off[i] * Math.PI * 2;
    const sw = Math.sin(ph) * A, lift = Math.max(0, Math.cos(ph)) * A * 0.35;
    const base = g.front ? P.legF : P.legH;
    const jointY = P.hipY + bob + g.jy * Math.cos(pitch) + g.jz * Math.sin(pitch);
    const ang = base + sw;
    let len;
    if (P.fold > 0.5 || base < -1) len = 0.75 * L;
    else len = Math.max(0.5 * L, Math.min(1.7 * L, jointY / Math.max(0.3, Math.cos(ang)))) * (1 - lift);
    if (!cat.grounded) len = 0.85 * L;
    g.piv.rotation.set(pitch + ang * (g.front ? 1 : 1) * -1 + 0, 0, 0);
    g.piv.rotation.x = pitch - ang;
    g.up.position.y = -len / 2 + 0.01; g.up.scale.y = len / L;
    g.paw.position.set(0, -len + 0.012, 0.012);
  }
  // head: stays roughly level, looks around when idle
  const look = cat.state === 'idle' && !moving ? Math.sin(cat.t * 0.35) * 0.5 * Math.max(0, Math.sin(cat.t * 0.13)) : 0;
  cat.neck.position.y = P.neckY; cat.neck.rotation.set(pitch * 0.85 + P.headP - flex * 0.5 + Math.sin(cat.phase * 2) * A * 0.03, P.headY + look, P.headY * 0.25);
  // blink
  cat.blink -= dt; const closed = cat.state === 'sleep' || (cat.blink < 0.12);
  if (cat.blink < 0) cat.blink = 2 + Math.random() * 4;
  for (const e of cat.eyes) e.scale.y = closed ? 0.12 : 0.75;
  // tail
  for (let i = 0; i < cat.tail.length; i++) {
    const seg = cat.tail[i], k = i / cat.tail.length;
    const sway = Math.sin(cat.t * (moving ? 3 : 1.1) - i * 0.6) * (0.12 + k * 0.1) * (cat.state === 'sleep' ? 0.15 : 1);
    if (i === 0) seg.rotation.set((P.tailUp + 0.2) * 1.2 + pitch * 0.5, Math.PI + sway * 0.5, 0);
    else seg.rotation.set(P.tailUp > 0.6 ? -0.08 : 0.18 + P.tailCurl * 0.12 - (gait === 'sprint' ? 0.15 : 0), sway + P.tailCurl * 0.42 * (i > 1 ? 1 : 0.3), 0);
  }
}
