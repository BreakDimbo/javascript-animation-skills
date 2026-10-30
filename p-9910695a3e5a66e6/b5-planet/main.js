import * as THREE from '../shared/vendor/three.module.js';
import { createPlanet, REGIONS, R, terrainHeight } from './planet.js';

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
document.body.appendChild(renderer.domElement);
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(35, innerWidth / innerHeight, 1, 6000);
addEventListener('resize', () => { renderer.setSize(innerWidth, innerHeight); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); });

const planet = createPlanet(scene);
const log = document.getElementById('log'), stat = document.getElementById('stat');
const say = (s) => { const p = document.createElement('div'); p.textContent = s; log.prepend(p); while (log.children.length > 5) log.lastChild.remove(); };
planet.streamer.on('load', r => say(`load · ${r.name}`)).on('unload', r => say(`unload · ${r.name}`));

// ---- space ⇄ ground flight ----
const Q = new URLSearchParams(location.search);
let t = Q.has('ground') ? 1 : +(Q.get('t') || 0), target = t, yaw = 0, dragging = false, lastX = 0;
addEventListener('keydown', e => {
  if (e.code === 'KeyG') target = 1;
  if (e.code === 'KeyF') target = 0;
});
addEventListener('pointerdown', e => { dragging = true; lastX = e.clientX; });
addEventListener('pointerup', () => dragging = false);
addEventListener('pointermove', e => { if (dragging) { yaw -= (e.clientX - lastX) * 0.004; lastX = e.clientX; } });

const V0 = new THREE.Vector3(0.1, 0.22, 1).normalize();
const WUP = new THREE.Vector3(0, 1, 0);
const ease = x => x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
const gDir = new THREE.Vector3(), d = new THREE.Vector3(), loc = new THREE.Vector3(), fwd = new THREE.Vector3(), look = new THREE.Vector3();
const q = new THREE.Quaternion(), qa = new THREE.Quaternion(), upv = new THREE.Vector3();
const slerpDir = (a, b, k, out) => { qa.setFromUnitVectors(a, b); q.identity().slerp(qa, k); return out.copy(a).applyQuaternion(q); };

const clock = new THREE.Clock();
function frame() {
  const dt = Math.min(0.05, clock.getDelta());
  const sp = 1 / 7;                                          // ~7 s flight
  t += Math.sign(target - t) * Math.min(Math.abs(target - t), sp * dt);
  const e = ease(t);
  planet.spin = 0.012 * (1 - Math.min(1, t * 6));

  planet.group.updateMatrixWorld(true);
  gDir.copy(REGIONS[0].centerDir).transformDirection(planet.group.matrixWorld);
  slerpDir(V0, gDir, THREE.MathUtils.smoothstep(e, 0.0, 0.55), d);
  const alt = Math.exp(THREE.MathUtils.lerp(Math.log(2000), Math.log(0.45), Math.pow(e, 1.6)));
  planet.localOf(d, loc).sub(planet.localOf(new THREE.Vector3(), new THREE.Vector3())).normalize();
  const ground = terrainHeight(loc);
  camera.position.copy(d).multiplyScalar(R + ground + alt);

  // look: planet centre in space, along the horizon near the ground
  const w = THREE.MathUtils.smoothstep(e, 0.7, 1.0);
  upv.copy(WUP).lerp(d, w).normalize();
  fwd.copy(WUP).addScaledVector(d, -WUP.dot(d)).normalize().applyAxisAngle(d, yaw);
  look.copy(camera.position).addScaledVector(fwd, 12).addScaledVector(d, -1.2).multiplyScalar(w);
  camera.up.copy(upv); camera.lookAt(look);
  camera.near = THREE.MathUtils.clamp(alt * 0.08, 0.03, 20); camera.far = 4000; camera.updateProjectionMatrix();
  planet.lod.material.uniforms.uFog.value = w;

  planet.update(dt, camera);
  renderer.render(scene, camera);
  const s = planet.lod.stats;
  stat.textContent = `alt ${alt < 10 ? alt.toFixed(2) : alt.toFixed(0)} m · chunks ${s.leaves}/${s.cached} · regions ${planet.streamer.loaded().join(', ') || '—'}`;
  requestAnimationFrame(frame);
}
frame();
window.__planet = planet;
