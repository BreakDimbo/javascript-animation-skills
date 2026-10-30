import * as THREE from '../shared/vendor/three.module.js';
import { createStation, createTrain, placeOnSphere } from './station.js';

const R = 600, planet = { R };
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2)); renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace; document.body.appendChild(renderer.domElement);
const scene = new THREE.Scene(); scene.background = new THREE.Color(0xe9e1cf);
scene.fog = new THREE.Fog(0xe9e1cf, 40, 260);
const camera = new THREE.PerspectiveCamera(55, innerWidth / innerHeight, 0.05, 2000);

// --- painted ground: canvas gouache bands + pencil ticks + paper grain ---
function groundTex() {
  const c = document.createElement('canvas'); c.width = 2048; c.height = 1024; const g = c.getContext('2d');
  const bands = ['#9aa57c', '#a8ad80', '#b4b285', '#9fa77d', '#c2b98a', '#a3a97e'];
  let r = 7; const rnd = () => (r = (r * 16807) % 2147483647) / 2147483647;
  for (let y = 0; y < 1024; y += 0) { const h = 20 + rnd() * 60; g.fillStyle = bands[Math.floor(rnd() * bands.length)]; g.fillRect(0, y, 2048, h + 2); y += h; }
  for (let i = 0; i < 260; i++) { g.fillStyle = `rgba(${90 + rnd() * 40},${100 + rnd() * 30},70,${0.15 + rnd() * 0.2})`; g.beginPath(); g.ellipse(rnd() * 2048, rnd() * 1024, 30 + rnd() * 120, 8 + rnd() * 30, rnd() * 3, 0, 7); g.fill(); }
  g.strokeStyle = 'rgba(70,80,55,.35)'; g.lineWidth = 1;
  for (let i = 0; i < 26000; i++) { const x = rnd() * 2048, y = rnd() * 1024; g.beginPath(); g.moveTo(x, y); g.lineTo(x + rnd() * 2 - 1, y - 2 - rnd() * 3); g.stroke(); }
  const id = g.getImageData(0, 0, 2048, 1024), d = id.data;
  for (let i = 0; i < d.length; i += 4) { const n = (rnd() - 0.5) * 14; d[i] += n; d[i + 1] += n; d[i + 2] += n; }
  g.putImageData(id, 0, 0);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(140, 70); t.anisotropy = 8; return t;
}
const ground = new THREE.Mesh(new THREE.SphereGeometry(R, 256, 128), new THREE.MeshLambertMaterial({ map: groundTex() }));
ground.receiveShadow = true; scene.add(ground);

const center = new THREE.Vector3(1, 0.25, 0.3).normalize(); // keep off the texture pole
const sun = new THREE.DirectionalLight(0xfff1dc, 2.2); sun.position.set(30, R + 60, 20); sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048); Object.assign(sun.shadow.camera, { left: -30, right: 30, top: 30, bottom: -30, near: 1, far: 200 });
sun.shadow.bias = -0.0005; scene.add(sun, sun.target);
scene.add(new THREE.HemisphereLight(0xf4ecdc, 0xb8a888, 2.4));

const station = createStation(scene, planet, center, new THREE.Vector3(0, 1, 0));
const train = createTrain(scene, planet, station.path);

// --- placeholder cat (orange, white chest + paw tips) ---
const cat = new THREE.Group();
{ const o = new THREE.MeshLambertMaterial({ color: 0xd2843f }), w = new THREE.MeshLambertMaterial({ color: 0xf1ebdf });
  const b = new THREE.Mesh(new THREE.CapsuleGeometry(0.09, 0.27, 4, 10), o); b.rotation.x = Math.PI / 2; b.position.y = 0.17; cat.add(b);
  const ch = new THREE.Mesh(new THREE.SphereGeometry(0.08, 10, 8), w); ch.position.set(0, 0.15, -0.14); cat.add(ch);
  const h = new THREE.Mesh(new THREE.SphereGeometry(0.075, 12, 10), o); h.position.set(0, 0.27, -0.23); cat.add(h);
  for (const s of [-1, 1]) { const e = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.06, 4), o); e.position.set(s * 0.04, 0.34, -0.23); cat.add(e); }
  for (const [x, z] of [[-.05, -.12], [.05, -.12], [-.05, .12], [.05, .12]]) { const l = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.12), o); l.position.set(x, 0.06, z); cat.add(l);
    const p = new THREE.Mesh(new THREE.SphereGeometry(0.022, 6, 5), w); p.position.set(x, 0.01, z); cat.add(p); }
  const t = new THREE.Mesh(new THREE.CapsuleGeometry(0.018, 0.25, 3, 6), o); t.position.set(0, 0.28, 0.25); t.rotation.x = -0.6; cat.add(t);
  cat.traverse(m => m.castShadow = true); }
scene.add(cat);
const P = station.path, side = new THREE.Vector3().crossVectors(P.fwd(-9), P.dir(-9)).normalize(); // right of track
const C = { dir: P.dir(-9).addScaledVector(side, 1.9 / R).normalize(), fwd: P.fwd(-9), riding: false };

const keys = {}; let fast = false;
addEventListener('keydown', e => { keys[e.code] = true;
  if (e.code === 'KeyT') fast = !fast;
  if (e.code === 'KeyE') {
    if (C.riding) { C.riding = false; const s = train.s - 2.9; C.dir = station.path.dir(s).addScaledVector(new THREE.Vector3().crossVectors(station.path.fwd(s), station.path.dir(s)), 2.2 / R).normalize(); fast = false; }
    else { const s = train.s - 2.9; if (cat.position.distanceTo(station.path.dir(s).multiplyScalar(R)) < 4) C.riding = true; }
  } });
addEventListener('keyup', e => keys[e.code] = false);
addEventListener('resize', () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); });

const camPos = new THREE.Vector3(), tmp = new THREE.Vector3(); let time = 0, last = performance.now(), camInit = false;
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now; time += dt;
  train.update(dt, fast && C.riding);
  const up = C.dir;
  if (C.riding) { train.seatTransform(cat); C.dir = cat.position.clone().normalize(); C.fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(cat.quaternion); }
  else {
    const turn = (keys.KeyA ? 1 : 0) - (keys.KeyD ? 1 : 0), mv = (keys.KeyW ? 1 : 0) - (keys.KeyS ? 1 : 0);
    C.fwd.applyAxisAngle(up, turn * 2.2 * dt);
    const sp = (keys.ShiftLeft || keys.ShiftRight ? 4.5 : 1.6) * mv;
    if (sp) { const axis = tmp.crossVectors(up, C.fwd).normalize(); const a = sp * dt / R; C.dir.applyAxisAngle(axis, a).normalize(); C.fwd.applyAxisAngle(axis, a); }
    // stand on platform if over it
    const l = station.group.worldToLocal(C.dir.clone().multiplyScalar(R)); const onPlat = l.x > 0.8 && l.x < 3 && Math.abs(l.z) < 7;
    placeOnSphere(cat, R, C.dir, C.fwd, onPlat ? 0.42 : 0);
  }
  station.update(dt, cat.position, time);
  // spring-arm follow cam
  const u = C.dir.clone().normalize(), f = C.fwd.clone().addScaledVector(u, -C.fwd.dot(u)).normalize();
  const sprint = keys.ShiftLeft || C.riding; const back = C.riding ? 6 : sprint ? 3 : 2.0, hgt = C.riding ? 2.4 : 0.5;
  const target = cat.position.clone().addScaledVector(f, -back).addScaledVector(u, hgt);
  if (!camInit) { camPos.copy(target); camInit = true; } camPos.lerp(target, 1 - Math.exp(-dt * 5));
  camera.position.copy(camPos); camera.up.copy(u); camera.lookAt(cat.position.clone().addScaledVector(u, 0.25).addScaledVector(f, 1.2));
  sun.position.copy(u).multiplyScalar(R + 60).addScaledVector(f, 25).add(tmp.crossVectors(u, f).multiplyScalar(20)); sun.target.position.copy(cat.position);
  renderer.render(scene, camera); requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
window.__fold = { train, station, C, cat };
