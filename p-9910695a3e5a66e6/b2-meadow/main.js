// Standalone harness for the b2 meadow: planet sphere + meadow + placeholder cat + spring-arm cam.
import * as THREE from '../shared/vendor/three.module.js';
import { createMeadow, MEADOW_COL } from './meadow.js';

const R = 600;
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2)); renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.NoToneMapping;
document.body.prepend(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(MEADOW_COL.paper);
scene.fog = new THREE.Fog(MEADOW_COL.paper, 25, 140);
const camera = new THREE.PerspectiveCamera(50, innerWidth / innerHeight, 0.05, 3000);

// planet body (bare ground in the meadow base colour so the patch dissolves into it)
const planetMesh = new THREE.Mesh(new THREE.SphereGeometry(R, 256, 128), new THREE.MeshLambertMaterial({ color: MEADOW_COL.base }));
planetMesh.receiveShadow = true; scene.add(planetMesh);
const planet = { radius: R, mesh: planetMesh };

const centerDir = new THREE.Vector3(0.2, 1, 0.1).normalize();
const meadow = createMeadow(scene, planet, centerDir);

// soft warm key + cool sky fill, matte
scene.add(new THREE.HemisphereLight(0xfff6e0, 0x6c7a45, 1.6));
const sun = new THREE.DirectionalLight(0xfff1d6, 1.5);
sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); sun.shadow.radius = 4; sun.shadow.bias = -0.0005;
Object.assign(sun.shadow.camera, { left: -20, right: 20, top: 20, bottom: -20, near: 1, far: 120 });
scene.add(sun, sun.target);

// ---------- placeholder cat ----------
const cat = new THREE.Group();
const orange = new THREE.MeshLambertMaterial({ color: 0xd9874a }), white = new THREE.MeshLambertMaterial({ color: 0xf3ece0 });
const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.1, 0.25, 4, 10).rotateZ(Math.PI / 2), orange); body.position.y = 0.17;
const chest = new THREE.Mesh(new THREE.SphereGeometry(0.085, 10, 8), white); chest.position.set(0.16, 0.15, 0);
const head = new THREE.Mesh(new THREE.SphereGeometry(0.085, 12, 10), orange); head.position.set(0.24, 0.24, 0);
for (const s of [-1, 1]){ const ear = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.06, 4), orange); ear.position.set(0.24, 0.32, s * 0.045); cat.add(ear);
  const paw = new THREE.Mesh(new THREE.SphereGeometry(0.03, 6, 5), white); paw.position.set(0.14, 0.02, s * 0.06); cat.add(paw); }
const tail = new THREE.Mesh(new THREE.CapsuleGeometry(0.025, 0.2, 3, 6), orange); tail.position.set(-0.26, 0.24, 0); tail.rotation.z = -0.6;
cat.add(body, chest, head, tail); cat.traverse(o => { if (o.isMesh) o.castShadow = true; }); scene.add(cat);

// cat state on the sphere: position p (world), forward f (tangent), vertical speed
const st = { p: meadow.toWorld(-3, -18, 0), f: meadow.frame.e2.clone(), vr: 0, h: 0, speed: 0 };
const keys = {}; addEventListener('keydown', e => keys[e.code] = true); addEventListener('keyup', e => keys[e.code] = false);
const groundR = p => meadow.heightAt(p);

const camPos = new THREE.Vector3(), camLook = new THREE.Vector3(), up = new THREE.Vector3(), tmp = new THREE.Vector3(), right = new THREE.Vector3();
let camYaw = 0, armLen = 2;          // camYaw: camera heading relative to cat forward basis
const camFwd = st.f.clone();

function updateCat(dt){
  up.copy(st.p).normalize();
  camFwd.addScaledVector(up, -camFwd.dot(up)).normalize();
  right.crossVectors(camFwd, up).normalize();
  let ix = (keys.KeyD ? 1 : 0) - (keys.KeyA ? 1 : 0), iz = (keys.KeyW ? 1 : 0) - (keys.KeyS ? 1 : 0);
  if (keys.ArrowLeft) camFwd.applyAxisAngle(up, dt * 1.6); if (keys.ArrowRight) camFwd.applyAxisAngle(up, -dt * 1.6);
  const sprint = keys.ShiftLeft || keys.ShiftRight;
  const want = (ix || iz) ? (sprint ? 3.2 : 1.2) : 0;
  if (ix || iz){ const d = tmp.copy(camFwd).multiplyScalar(iz).addScaledVector(right, ix).normalize(); st.f.lerp(d, Math.min(1, dt * 8)).normalize(); }
  st.f.addScaledVector(up, -st.f.dot(up)).normalize();
  st.speed += (want - st.speed) * Math.min(1, dt * 6);
  st.p.addScaledVector(st.f, st.speed * dt);
  // radial gravity
  const gr = groundR(st.p); let r = st.p.length();
  if (keys.Space && st.h <= 0.001) st.vr = 2.2;
  st.vr -= 9.8 * dt; st.h = Math.max(0, r - gr + st.vr * dt); if (st.h <= 0) st.vr = 0;
  st.p.normalize().multiplyScalar(gr + st.h);
  up.copy(st.p).normalize();
  // orient cat
  const z = tmp.crossVectors(st.f, up).normalize();
  cat.position.copy(st.p); cat.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(st.f, up, z));
  body.position.y = 0.17 + Math.abs(Math.sin(performance.now() * 0.012 * st.speed)) * 0.015 * Math.min(1, st.speed);
  // camera follows cat heading gently when moving
  if (st.speed > 0.3 && iz >= 0) camFwd.lerp(st.f, Math.min(1, dt * 1.2)).normalize();
  armLen += ((sprint && st.speed > 2 ? 3 : 2) - armLen) * Math.min(1, dt * 2);
  const want0 = tmp.copy(st.p).addScaledVector(camFwd, -armLen).addScaledVector(up, 0.5);
  const minR = groundR(want0) + 0.35; if (want0.length() < minR) want0.setLength(minR);
  camPos.lerp(want0, Math.min(1, dt * 5));
  camLook.copy(st.p).addScaledVector(up, 0.25).addScaledVector(camFwd, 1.2);
  camera.position.copy(camPos); camera.up.copy(up); camera.lookAt(camLook);
  // sun shadow follows the cat
  sun.target.position.copy(st.p); sun.position.copy(st.p).addScaledVector(up, 40).addScaledVector(meadow.frame.e1, 22).addScaledVector(meadow.frame.e2, -14);
}
camPos.copy(st.p).addScaledVector(camFwd, -2).addScaledVector(st.p.clone().normalize(), 0.5);

const clock = new THREE.Clock(); let time = 0;
// optional: ?wide for an establishing shot (screenshot)
const WIDE = new URLSearchParams(location.search).has('wide');
function frame(){
  const dt = Math.min(0.05, clock.getDelta()); time += dt;
  updateCat(dt);
  if (WIDE){ const c = meadow.frame.c; camera.position.copy(c).multiplyScalar(R + 22).addScaledVector(meadow.frame.e2, -40); camera.up.copy(c); camera.lookAt(tmp.copy(c).multiplyScalar(R).addScaledVector(meadow.frame.e2, 2)); }
  meadow.update(dt, time, st.p);
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}
frame();
addEventListener('resize', () => { renderer.setSize(innerWidth, innerHeight); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); });
window.__fold = { scene, camera, meadow, cat: st, keys };
