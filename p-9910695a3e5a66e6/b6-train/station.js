// 褶星 Fold — b6-train: small clay station + loop railway + toy train + sleeping whippet.
// Exports: createStation(scene, planet, centerDir), createTrain(scene, planet, opts), placeOnSphere()
import * as THREE from '../shared/vendor/three.module.js';

// hand-painted gouache grain: soft dry-brush streaks + paper speckle, tinted by material colour (matte, no specular)
let GRAIN = null;
function grainTex() {
  if (GRAIN) return GRAIN;
  const n = 256, cv = document.createElement('canvas'); cv.width = cv.height = n; const g = cv.getContext('2d');
  g.fillStyle = '#f2ede2'; g.fillRect(0, 0, n, n);
  let r = 7; const rnd = () => ((r = (r * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 220; i++) { // dry-brush strokes
    const y = rnd() * n, x = rnd() * n, w = 30 + rnd() * 90, a = 0.025 + rnd() * 0.045;
    g.strokeStyle = rnd() < 0.5 ? `rgba(90,70,50,${a})` : `rgba(255,250,235,${a * 1.3})`;
    g.lineWidth = 2 + rnd() * 6; g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + w / 2, y + (rnd() - 0.5) * 6, x + w, y + (rnd() - 0.5) * 4); g.stroke();
  }
  const id = g.getImageData(0, 0, n, n), d = id.data; // paper speckle
  for (let i = 0; i < d.length; i += 4) { const k = (rnd() - 0.5) * 22; d[i] += k; d[i + 1] += k; d[i + 2] += k * 0.9; }
  g.putImageData(id, 0, 0);
  GRAIN = new THREE.CanvasTexture(cv); GRAIN.wrapS = GRAIN.wrapT = THREE.RepeatWrapping; GRAIN.colorSpace = THREE.SRGBColorSpace;
  GRAIN.anisotropy = 4; return GRAIN;
}
const clay = (c) => new THREE.MeshLambertMaterial({ color: c, map: grainTex() });
const PAL = { plaster: 0xe6dcc6, roof: 0xb88a72, wood: 0x8a7058, stone: 0xb9b0a0, rail: 0x6e675f,
  sleeper: 0x8a7562, train: 0x5f7a6a, trainB: 0xc79a5a, dark: 0x3e3833, dog: 0xcbb79c, dogB: 0xa89377 };

// orient obj so local +Y = radial up at dir, local -Z = forward tangent
export function placeOnSphere(obj, R, dir, fwd, h = 0) {
  const up = dir.clone().normalize();
  const f = fwd.clone().addScaledVector(up, -fwd.dot(up)).normalize();
  const x = new THREE.Vector3().crossVectors(f, up).normalize(); // right
  const m = new THREE.Matrix4().makeBasis(x, up, f.clone().negate());
  obj.quaternion.setFromRotationMatrix(m);
  obj.position.copy(up).multiplyScalar(R + h);
}

// soft clay bevel: segmented box, vertices pulled onto a rounded-box surface (radius ~ 18% of thinnest side)
function softBox(w, h, d) { const g = new THREE.BoxGeometry(w, h, d, 6, 6, 6); clayUV(g, w, h, d);
  const r = Math.min(w, h, d) * 0.18, p = g.attributes.position, v = new THREE.Vector3(), c = new THREE.Vector3();
  const hx = w / 2 - r, hy = h / 2 - r, hz = d / 2 - r;
  for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i); c.set(THREE.MathUtils.clamp(v.x, -hx, hx), THREE.MathUtils.clamp(v.y, -hy, hy), THREE.MathUtils.clamp(v.z, -hz, hz));
    v.sub(c); if (v.lengthSq() > 1e-12) v.setLength(r); v.add(c); p.setXYZ(i, v.x, v.y, v.z); }
  g.computeVertexNormals(); return g; }
function box(w, h, d, c, x = 0, y = 0, z = 0) { const m = new THREE.Mesh(softBox(w, h, d), clay(c)); m.position.set(x, y, z); m.castShadow = m.receiveShadow = true; return m; }

// world-scale UVs so grain density is constant on big and small boxes
function clayUV(geo, w, h, d) { const uv = geo.attributes.uv, nm = geo.attributes.normal;
  for (let i = 0; i < uv.count; i++) { const ax = Math.abs(nm.getX(i)), ay = Math.abs(nm.getY(i)); const [sx, sy] = ax > 0.5 ? [d, h] : ay > 0.5 ? [w, d] : [w, h]; uv.setXY(i, uv.getX(i) * sx * 0.6, uv.getY(i) * sy * 0.6); } }

// Rail loop = great circle through centerDir with given tangent; returns pointAt(s) in metres of arc
export function makeRailPath(R, centerDir, tangent) {
  const a = centerDir.clone().normalize();
  const b = tangent.clone().addScaledVector(a, -tangent.dot(a)).normalize();
  const L = 2 * Math.PI * R;
  return { R, a, b, L,
    dir(s) { const t = s / R; return a.clone().multiplyScalar(Math.cos(t)).addScaledVector(b, Math.sin(t)); },
    fwd(s) { const t = s / R; return a.clone().multiplyScalar(-Math.sin(t)).addScaledVector(b, Math.cos(t)); } };
}

function buildTrack(scene, path) {
  const n = Math.floor(path.L / 0.9);
  const sl = new THREE.InstancedMesh(new THREE.BoxGeometry(1.5, 0.08, 0.22), clay(PAL.sleeper), n);
  const rl = new THREE.InstancedMesh(new THREE.BoxGeometry(0.07, 0.09, 0.95), clay(PAL.rail), n * 2);
  const o = new THREE.Object3D();
  for (let i = 0; i < n; i++) {
    const s = i * 0.9; placeOnSphere(o, path.R, path.dir(s), path.fwd(s), 0.04); o.updateMatrix(); sl.setMatrixAt(i, o.matrix);
    for (const side of [-0.5, 0.5]) { const c = o.clone(); c.translateX(side); c.translateY(0.06); c.updateMatrix(); rl.setMatrixAt(i * 2 + (side > 0), c.matrix); }
  }
  sl.receiveShadow = rl.castShadow = true; scene.add(sl, rl);
}

function makeDog() {
  const g = new THREE.Group(), m = clay(PAL.dog), mb = clay(PAL.dogB);
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.11, 0.42, 4, 10), m); body.rotation.x = Math.PI / 2; body.position.y = 0.11; body.scale.set(1, 1, 0.8);
  const neck = new THREE.Group(); neck.position.set(0, 0.12, -0.3); g.add(neck);
  const head = new THREE.Mesh(new THREE.CapsuleGeometry(0.055, 0.16, 4, 8), m); head.rotation.x = Math.PI / 2; head.position.set(0, 0, -0.1); neck.add(head);
  for (const s of [-1, 1]) { const ear = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.09, 6), mb); ear.position.set(s * 0.045, 0.04, -0.03); ear.rotation.set(0.9, 0, s * 0.5); neck.add(ear); }
  for (const [x, z] of [[-0.09, -0.22], [0.09, -0.22]]) { const l = new THREE.Mesh(new THREE.CapsuleGeometry(0.025, 0.22, 3, 6), mb); l.rotation.x = Math.PI / 2; l.position.set(x, 0.03, z - 0.12); g.add(l); }
  const tail = new THREE.Mesh(new THREE.CapsuleGeometry(0.015, 0.3, 3, 6), mb); tail.rotation.set(Math.PI / 2, 0, 0.8); tail.position.set(0.1, 0.05, 0.36); g.add(tail);
  g.add(body); g.traverse(o => o.castShadow = true);
  neck.rotation.x = 0.35; // head resting
  g.userData = { neck, lift: 0 };
  return g;
}

export function createStation(scene, planet, centerDir, tangent = new THREE.Vector3(1, 0, 0)) {
  const R = planet.R, path = makeRailPath(R, centerDir, tangent);
  buildTrack(scene, path);
  const st = new THREE.Group();
  // platform sits to the right of the track
  st.add(box(2.2, 0.38, 14, PAL.stone, 1.9, 0.19, 0));
  st.add(box(2.24, 0.05, 14.04, 0xd8cfbe, 1.9, 0.4, 0));
  // station hut
  const hut = new THREE.Group(); hut.position.set(4.6, 0, 0); st.add(hut);
  hut.add(box(3.2, 2.4, 4.4, PAL.plaster, 0, 1.2, 0));
  hut.add(box(0.06, 1.6, 0.9, PAL.wood, -1.62, 0.8, 0.6));        // door
  hut.add(box(0.06, 0.7, 0.8, 0x8fa3a3, -1.62, 1.5, -1.1));        // window
  const roofG = new THREE.CylinderGeometry(0.01, 2.6, 1.1, 4, 6); { const a = roofG.attributes.position; for (let i = 0; i < a.count; i++) { const t = (a.getY(i) + 0.55) / 1.1, k = 1 + 0.16 * Math.sin(Math.PI * t); a.setX(i, a.getX(i) * k); a.setZ(i, a.getZ(i) * k); } roofG.computeVertexNormals(); } roofG.rotateY(Math.PI / 4); // clay-pillowed hip roof roofG.scale(1.0, 1, 1.25);
  const roof = new THREE.Mesh(roofG, clay(PAL.roof)); roof.position.y = 2.95; roof.castShadow = true; hut.add(roof);
  // canopy over platform
  for (const z of [-4, 0, 4]) st.add(box(0.1, 2.2, 0.1, PAL.wood, 2.6, 1.5, z));
  st.add(box(1.9, 0.16, 10.1, PAL.roof, 2.2, 2.66, 0)); // thicker slab so softBox rounding reads as a pillowed clay canopy
  // name board
  const cv = document.createElement('canvas'); cv.width = 256; cv.height = 64; const g = cv.getContext('2d');
  g.fillStyle = '#efe6d2'; g.fillRect(0, 0, 256, 64); g.fillStyle = '#3e3833'; g.font = '28px serif'; g.textAlign = 'center'; g.fillText('褶 星  ·  小 站', 128, 42);
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.4), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(cv) }));
  sign.material.map.colorSpace = THREE.SRGBColorSpace; sign.position.set(2.0, 2.2, -5.5); sign.rotation.y = -Math.PI / 2; st.add(sign);
  st.add(box(0.06, 2.0, 0.06, PAL.wood, 2.0, 1.2, -6.2), box(0.06, 2.0, 0.06, PAL.wood, 2.0, 1.2, -4.8));
  // bench
  st.add(box(0.4, 0.06, 1.4, PAL.wood, 2.6, 0.82, 2.2), box(0.4, 0.4, 0.06, PAL.dark, 2.6, 0.6, 1.6), box(0.4, 0.4, 0.06, PAL.dark, 2.6, 0.6, 2.8));
  // dog on platform
  const dog = makeDog(); dog.position.set(2.1, 0.42, -1.2); dog.rotation.y = 0.4; st.add(dog);
  st.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  placeOnSphere(st, R, path.dir(0), path.fwd(0), 0);
  scene.add(st);
  const dogWorld = new THREE.Vector3();
  return { group: st, path, stopS: 0, dog,
    update(dt, catPos, time) {
      dog.getWorldPosition(dogWorld);
      const near = catPos && catPos.distanceTo(dogWorld) < 3.5;
      const d = dog.userData; d.lift += ((near ? 1 : 0) - d.lift) * Math.min(1, dt * (near ? 2.5 : 0.8));
      d.neck.rotation.x = 0.35 - d.lift * 0.75 + Math.sin(time * 1.3) * 0.015 * (1 - d.lift); // slow breathing while asleep
      if (near) { const l = dog.worldToLocal(catPos.clone()); d.neck.rotation.y += (THREE.MathUtils.clamp(Math.atan2(-l.x, -l.z), -0.8, 0.8) - d.neck.rotation.y) * dt * 2; }
      else d.neck.rotation.y *= 1 - dt;
    } };
}

export function createTrain(scene, planet, path, { cars = 3, speed = 9, dwell = 8 } = {}) {
  const groups = [];
  const mk = (loco) => {
    const g = new THREE.Group();
    g.add(box(1.3, 0.9, 2.6, loco ? PAL.train : PAL.trainB, 0, 0.75, 0));
    g.add(box(1.4, 0.1, 2.7, PAL.dark, 0, 1.25, 0));
    if (loco) { const b = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 1.2, 14), clay(PAL.train)); b.rotation.x = Math.PI / 2; b.position.set(0, 0.85, -1.6); g.add(b);
      g.add(box(0.2, 0.5, 0.2, PAL.dark, 0, 1.4, -1.9)); }
    else { g.add(box(1.32, 0.3, 1.6, 0xe6dcc6, 0, 0.95, 0)); }
    for (const z of [-0.8, 0.8]) for (const x of [-0.6, 0.6]) { const w = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.1, 12), clay(PAL.dark)); w.rotation.z = Math.PI / 2; w.position.set(x, 0.26, z); g.add(w); }
    g.traverse(o => { if (o.isMesh) o.castShadow = o.receiveShadow = true; });
    scene.add(g); return g;
  };
  for (let i = 0; i < cars; i++) groups.push(mk(i === 0));
  const T = { s: -60, speed, state: 'run', wait: 0, groups, path, seatS: 0,
    update(dt, fast) {
      const v = this.speed * (fast ? 8 : 1);
      if (this.state === 'dwell') { this.wait -= dt; if (this.wait <= 0) this.state = 'run'; }
      else {
        // brake into the station (s = 0 mod L)
        const toStop = ((path.L - (this.s % path.L)) % path.L);
        const k = toStop < 25 ? Math.max(0.15, toStop / 25) : 1;
        const step = v * k * dt;
        if (toStop > 0.05 && step >= toStop) { this.s += toStop; this.state = 'dwell'; this.wait = dwell; }
        else this.s += Math.max(step, toStop < 0.05 && this.state === 'run' && this.wait <= 0 ? v * dt : step);
      }
      this.s = ((this.s % path.L) + path.L) % path.L;
      groups.forEach((g, i) => { const s = this.s + 1.4 - i * 2.9; placeOnSphere(g, path.R, path.dir(s), path.fwd(s), 0.1); });
    },
    seatTransform(obj) { const s = this.s - 2.9 * 1; placeOnSphere(obj, path.R, path.dir(s), path.fwd(s), 1.15); } };
  return T;
}
