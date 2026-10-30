// 褶星 Fold — b8 家燕 barn swallows + dream-flight cutscene
// exports: createSwallows(scene, planet), updateSwallows(dt), playDreamFlight(fromDir, toDir, onDone, opts), setDreamCamera(cam)
import * as THREE from '../shared/vendor/three.module.js';

const C = { back: 0x4a5066, throat: 0x9a5a3e, belly: 0xe2d8c6, wing: 0x434860 }; // muted gouache
let S = null; // module state

// shared hand-painted grain: soft gouache mottling + pencil ticks, multiplies the base colour
let _grain = null;
function grainTex() {
  if (_grain || typeof document === 'undefined') return _grain;
  const cv = document.createElement('canvas'); cv.width = cv.height = 64;
  const g = cv.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, 64, 64);
  for (let i = 0; i < 90; i++) {
    const v = 214 + Math.floor(Math.random() * 41);
    g.fillStyle = `rgba(${v},${v - 4},${v - 10},0.5)`;
    g.beginPath(); g.ellipse(Math.random() * 64, Math.random() * 64, 2 + Math.random() * 6, 1 + Math.random() * 3, Math.random() * 3, 0, 7); g.fill();
  }
  g.strokeStyle = 'rgba(120,100,80,0.12)';
  for (let i = 0; i < 40; i++) { const x = Math.random() * 64, y = Math.random() * 64; g.beginPath(); g.moveTo(x, y); g.lineTo(x + 1.5, y - 3); g.stroke(); }
  _grain = new THREE.CanvasTexture(cv); _grain.colorSpace = THREE.SRGBColorSpace;
  _grain.wrapS = _grain.wrapT = THREE.RepeatWrapping;
  return _grain;
}
function mat(c) { return new THREE.MeshLambertMaterial({ color: c, map: grainTex() }) /* matte clay with painted grain */; }

function makeSwallow() {
  const g = new THREE.Group();              // local: +Z forward, +Y up
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.05, 16, 12), mat(C.back));
  body.scale.set(0.8, 0.7, 2.0); g.add(body);
  const belly = new THREE.Mesh(new THREE.SphereGeometry(0.045, 16, 12), mat(C.belly));
  belly.scale.set(0.8, 0.6, 1.6); belly.position.set(0, -0.012, -0.01); g.add(belly);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.035, 16, 12), mat(C.back));
  head.position.set(0, 0.01, 0.09); g.add(head);
  const throat = new THREE.Mesh(new THREE.SphereGeometry(0.026, 12, 10), mat(C.throat));
  throat.position.set(0, -0.008, 0.108); g.add(throat);
  // forked tail
  const ts = new THREE.Shape();
  ts.moveTo(-0.025, 0); ts.lineTo(0.025, 0); ts.lineTo(0.05, -0.17); ts.lineTo(0.012, -0.07);
  ts.lineTo(0, -0.06); ts.lineTo(-0.012, -0.07); ts.lineTo(-0.05, -0.17); ts.closePath();
  const tail = new THREE.Mesh(new THREE.ShapeGeometry(ts), new THREE.MeshLambertMaterial({ color: C.wing, map: grainTex(), side: THREE.DoubleSide }));
  tail.rotation.x = Math.PI / 2; tail.position.set(0, 0.005, -0.07); g.add(tail);
  // swept, pointed wings
  const ws = new THREE.Shape();
  ws.moveTo(0, 0.03); ws.quadraticCurveTo(0.12, 0.03, 0.2, -0.06); ws.quadraticCurveTo(0.1, -0.02, 0, -0.03); ws.closePath();
  const wg = new THREE.ShapeGeometry(ws);
  const wm = new THREE.MeshLambertMaterial({ color: C.wing, map: grainTex(), side: THREE.DoubleSide });
  const wings = [];
  for (const s of [1, -1]) {
    const pivot = new THREE.Group(); pivot.position.set(0.02 * s, 0.01, 0.02);
    const w = new THREE.Mesh(wg, wm); w.rotation.x = -Math.PI / 2; w.scale.x = s;
    pivot.add(w); g.add(pivot); wings.push({ pivot, s });
  }
  g.userData.wings = wings;
  g.scale.setScalar(1.6); // ~0.3 m wingspan-ish read at distance
  return g;
}

function animWings(b, t) {
  // flap bursts then glide (wings held slightly up)
  const cyc = (t * 0.35 + b.userData.phase) % 1;
  const flapping = cyc < 0.6;
  const a = flapping ? Math.sin(t * 22 + b.userData.phase * 10) * 0.75 : 0.12;
  for (const w of b.userData.wings) w.pivot.rotation.z = a * w.s;
}

// orient object at p (world), facing velocity dir v, up radial
const _m = new THREE.Matrix4(), _x = new THREE.Vector3(), _y = new THREE.Vector3(), _z = new THREE.Vector3();
function orient(obj, p, v, bank = 0) {
  _y.copy(p).normalize();
  _z.copy(v).addScaledVector(_y, -v.dot(_y)).normalize();
  _x.crossVectors(_y, _z).normalize();
  _m.makeBasis(_x, _y, _z);
  obj.position.copy(p);
  obj.quaternion.setFromRotationMatrix(_m);
  if (bank) obj.rotateZ(bank);
}

export function createSwallows(scene, planet = {}, opts = {}) {
  const R = planet.radius ?? 600;
  const groups = [];
  const nGroups = opts.groups ?? 6;
  for (let i = 0; i < nGroups; i++) {
    const axis = new THREE.Vector3().randomDirection();
    const start = new THREE.Vector3().randomDirection().projectOnPlane(axis).normalize();
    const birds = [];
    const n = 3 + Math.floor(Math.random() * 4);
    for (let k = 0; k < n; k++) {
      const b = makeSwallow(); b.userData.phase = Math.random();
      b.userData.off = new THREE.Vector3((Math.random() - .5) * 8, (Math.random() - .5) * 3, (Math.random() - .5) * 8);
      b.userData.wob = Math.random() * 6.28;
      scene.add(b); birds.push(b);
    }
    groups.push({ axis, start, ang: Math.random() * 6.28, speed: (9 + Math.random() * 4) / R,
      alt: opts.alt ?? (3 + Math.random() * 5), birds, turn: (Math.random() - .5) * 0.2 });
  }
  const lead = makeSwallow(); lead.userData.phase = 0; lead.visible = false; scene.add(lead);
  S = { scene, R, groups, lead, t: 0, camera: planet.camera ?? opts.camera ?? null, dream: null, fade: makeFade() };
  return { groups, lead, update: updateSwallows };
}

export function setDreamCamera(cam) { if (S) S.camera = cam; }

const _p = new THREE.Vector3(), _q = new THREE.Quaternion(), _v = new THREE.Vector3(), _tmp = new THREE.Vector3();
export function updateSwallows(dt) {
  if (!S) return;
  S.t += dt; const t = S.t;
  for (const g of S.groups) {
    g.ang += g.speed * dt;
    g.axis.applyAxisAngle(g.start, g.turn * dt * 0.05).normalize(); // slow meander
    g.start.projectOnPlane(g.axis).normalize();
    for (const b of g.birds) {
      const o = b.userData.off, w = b.userData.wob;
      const ang = g.ang + (o.z + Math.sin(t * 0.7 + w) * 2) / S.R;
      _q.setFromAxisAngle(g.axis, ang);
      _p.copy(g.start).applyQuaternion(_q);
      const up = _p.clone();
      _v.crossVectors(g.axis, up).normalize(); // forward
      _tmp.crossVectors(up, _v);               // side
      const alt = g.alt + o.y + Math.sin(t * 1.3 + w) * 1.2;
      _p.multiplyScalar(S.R + alt).addScaledVector(_tmp, o.x + Math.sin(t * 0.9 + w) * 1.5);
      const bank = Math.cos(t * 0.9 + w) * 0.4;
      orient(b, _p, _v, bank);
      animWings(b, t);
    }
  }
  if (S.dream) stepDream(dt);
  else animWings(S.lead, t);
}

// ---- dream flight ----
function makeFade() {
  if (typeof document === 'undefined') return null;
  const d = document.createElement('div');
  d.style.cssText = 'position:fixed;inset:0;pointer-events:none;opacity:0;z-index:50;background:#efe8d8;' +
    'background-image:radial-gradient(rgba(120,100,70,.06) 1px,transparent 1px);background-size:3px 3px;';
  document.body.appendChild(d); return d;
}

function slerpDir(a, b, t, out) {
  const ang = a.angleTo(b);
  if (ang < 1e-5) return out.copy(a);
  const s = Math.sin(ang);
  return out.copy(a).multiplyScalar(Math.sin((1 - t) * ang) / s).addScaledVector(b, Math.sin(t * ang) / s);
}

// spline on sphere: great arc + sideways S-bend; altitude 20..60 m
function pathPoint(D, u, out) {
  slerpDir(D.a, D.b, u, out);
  out.addScaledVector(D.side, Math.sin(Math.PI * u) * Math.sin(Math.PI * u * 2 + 0.6) * D.bend).normalize();
  const alt = 20 + 40 * Math.sin(Math.PI * u) ** 0.8;
  return out.multiplyScalar(S.R + alt);
}

export function playDreamFlight(fromDir, toDir, onDone, opts = {}) {
  if (!S) throw new Error('createSwallows first');
  const cam = opts.camera ?? S.camera; if (!cam) throw new Error('no camera: setDreamCamera(cam)');
  const a = fromDir.clone().normalize(), b = toDir.clone().normalize();
  let side = new THREE.Vector3().crossVectors(a, b);
  if (side.lengthSq() < 1e-6) side = new THREE.Vector3(0, 1, 0).cross(a);
  side.normalize();
  const ang = a.angleTo(b);
  const dur = opts.duration ?? THREE.MathUtils.clamp(8 + ang * S.R / 60, 8, 22);
  S.dream = { a, b, side, bend: Math.min(0.12, ang * 0.15), t: 0, dur, cam, onDone, fadeIn: 1.4, fadeOut: 1.6, camPos: null };
  S.lead.visible = true;
  if (S.fade) S.fade.style.opacity = '1';
  return { cancel() { endDream(false); } };
}

const _look = new THREE.Vector3(), _ahead = new THREE.Vector3(), _cp = new THREE.Vector3(), _up = new THREE.Vector3();
function stepDream(dt) {
  const D = S.dream; D.t += dt;
  const T = Math.min(D.t / D.dur, 1);
  const u = T * T * (3 - 2 * T) * 0.9 + T * 0.1; // ease
  pathPoint(D, u, _p);
  pathPoint(D, Math.min(u + 0.004, 1.0001), _ahead);
  if (u >= 1) _ahead.copy(_p).addScaledVector(_v.copy(_p).sub(pathPoint(D, u - 0.004, _tmp)), 1);
  _v.copy(_ahead).sub(_p);
  orient(S.lead, _p, _v, Math.sin(D.t * 0.6) * 0.25);
  animWings(S.lead, S.t);
  // camera: behind & slightly above the bird, looking past it
  _up.copy(_p).normalize();
  const fwd = _v.clone().addScaledVector(_up, -_v.dot(_up)).normalize();
  _cp.copy(_p).addScaledVector(fwd, -2.2).addScaledVector(_up, 0.6);
  if (!D.camPos) D.camPos = _cp.clone(); else D.camPos.lerp(_cp, 1 - Math.exp(-dt * 6));
  D.cam.position.copy(D.camPos);
  D.cam.up.copy(_up);
  _look.copy(_p).addScaledVector(fwd, 6).addScaledVector(_up, -2.5);
  D.cam.lookAt(_look);
  // paper fade
  if (S.fade) {
    const fi = 1 - Math.min(D.t / D.fadeIn, 1), fo = Math.max(0, (D.t - (D.dur - D.fadeOut)) / D.fadeOut);
    S.fade.style.opacity = String(Math.max(fi, Math.min(fo, 1)));
  }
  if (D.t >= D.dur) endDream(true);
}
function endDream(done) {
  const D = S.dream; if (!D) return;
  S.dream = null; S.lead.visible = false;
  if (S.fade) S.fade.style.opacity = '1'; // caller fades back in after placing the cat
  if (done && D.onDone) D.onDone();
}
export function setPaperFade(v) { if (S && S.fade) S.fade.style.opacity = String(v); }
export function isDreaming() { return !!(S && S.dream); }
