import * as THREE from '../shared/vendor/three.module.js';
import { createPlanet, PAL } from './planet.js';
import { createCat, updateCat } from './cat.js';
import { createFollowCam } from './followcam.js';

const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2)); renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);
const scene = new THREE.Scene(); scene.background = new THREE.Color(PAL.paper);
scene.fog = new THREE.Fog(PAL.paper, 14, 34);
const camera = new THREE.PerspectiveCamera(52, innerWidth / innerHeight, 0.03, 400);
addEventListener('resize', () => { renderer.setSize(innerWidth, innerHeight); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); });

scene.add(new THREE.HemisphereLight(0xf6f1e4, 0x8a9466, 1.9));
const sun = new THREE.DirectionalLight(0xfff1d6, 1.25); sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048); Object.assign(sun.shadow.camera, { left: -6, right: 6, top: 6, bottom: -6, near: 0.5, far: 60 });
sun.shadow.radius = 4; sun.shadow.bias = -0.0005; sun.shadow.normalBias = 0.02;
scene.add(sun, sun.target);

const planet = createPlanet(scene, renderer);
const cat = createCat(scene, planet);
const fcam = createFollowCam(camera, renderer.domElement);

const keys = new Set(), edges = new Set();
addEventListener('keydown', e => { if (!keys.has(e.code)) edges.add(e.code); keys.add(e.code); if (e.code === 'Space') e.preventDefault(); });
addEventListener('keyup', e => keys.delete(e.code));
const k = (...c) => c.some(x => keys.has(x));
// optional scripted input for headless tests: ?demo
const demo = new URLSearchParams(location.search).get('demo');

const hud = document.getElementById('hud');
let last = performance.now(), T = 0;
function frame(now) {
  const dt = Math.max(0, Math.min(0.05, (now - last) / 1000)); last = now; T += dt;
  const input = {
    x: (k('KeyD', 'ArrowRight') ? 1 : 0) - (k('KeyA', 'ArrowLeft') ? 1 : 0),
    y: (k('KeyW', 'ArrowUp') ? 1 : 0) - (k('KeyS', 'ArrowDown') ? 1 : 0),
    sprint: k('ShiftLeft', 'ShiftRight'), jump: edges.has('Space'), sit: edges.has('KeyC'), sleep: edges.has('KeyZ'),
  };
  if ((demo === 'side' || demo === 'sleep') && !window.__d0) { fcam.dYaw = 1.7; window.__d0 = 1; }
  if (0) fcam.dYaw = 1.7;
  if (demo === 'walk') { input.y = 1; input.x = Math.sin(T * 0.3) * 0.3; }
  if (demo === 'sprint') { input.y = 1; input.sprint = true; }
  if ((demo === 'sit' || demo === 'side') && !window.__d1 && T > 0.3) { input.sit = true; window.__d1 = 1; }
  if (demo === 'sleep' && !window.__d1 && T > 0.3) { input.sleep = true; window.__d1 = 1; }
  if (demo === 'jump' && T > 0.5) { input.y = 1; input.sprint = T < 2.2; if (T > 1.45 && !window.__d1) { input.jump = true; window.__d1 = 1; } }
  edges.clear();
  // demo mode: fixed sub-steps so slow headless renderers still advance simulated time
  const steps = demo ? 10 : 1, h = demo ? 0.03 : dt;
  for (let i = 0; i < steps; i++) {
    updateCat(cat, h, input, planet, fcam.forward());
    fcam.update(h, cat);
    input.jump = input.sit = input.sleep = false;
  }
  if (demo) T += h * steps - dt;
  // shadow camera follows the cat; sun fixed in the cat's local sky
  sun.position.copy(cat.pos).addScaledVector(cat.up, 20).addScaledVector(planet.frame.east, 9).addScaledVector(planet.frame.north, 6);
  sun.target.position.copy(cat.pos); sun.target.updateMatrixWorld();
  if (hud) hud.textContent = `${cat.state === 'idle' ? cat.gait : cat.state}${cat.grounded ? '' : ' · air'}`;
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
window.__fold = { cat, planet, fcam, THREE };
