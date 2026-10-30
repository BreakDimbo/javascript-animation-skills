// standalone harness for b3-pond: planet sphere + placeholder cat (WASD) + spring-arm camera
import * as THREE from '../shared/vendor/three.module.js';
import { createPond, clay, POND } from './pond.js';

const Q = new URLSearchParams(location.search);
const R = 600, planet = { R };
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(2, devicePixelRatio)); renderer.setSize(innerWidth, innerHeight);
renderer.setClearColor(0xebe5d8, 1); document.body.appendChild(renderer.domElement);
const scene = new THREE.Scene(); scene.fog = new THREE.Fog(0xe9e3d5, 25, 140);
const camera = new THREE.PerspectiveCamera(50, innerWidth / innerHeight, .05, 3000);

// planet body: flat matte paper-green
const planetMesh = new THREE.Mesh(new THREE.SphereGeometry(R - .03, 160, 120), clay(0x9ea374)); scene.add(planetMesh);

const centerDir = new THREE.Vector3(.3, .9, .2).normalize();
const pond = createPond(scene, planet, centerDir);
scene.add(new THREE.HemisphereLight(0xf3ecdc, 0x8a8468, 1.3));
const sun = new THREE.DirectionalLight(0xfff4e0, 1.9); sun.position.copy(pond.sunDir).multiplyScalar(1000); scene.add(sun, sun.target);

// ---------- placeholder cat: old orange short-hair, white chest + paw tips ----------
const cat = { x: 3, z: -15.5, h: .2, vh: 0, yaw: 0, state: 'walk', t: 0, on: null, sprint: false, hes: 0 };
const catM = new THREE.Group(); scene.add(catM);
{ const O = clay(0xc9844a), W = clay(0xece4d2), D = clay(0x8f5a33);
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(.085, .26, 4, 10), O); body.rotation.x = Math.PI / 2; body.position.y = .16; catM.add(body);
  const chest = new THREE.Mesh(new THREE.SphereGeometry(.075, 10, 8), W); chest.position.set(0, .14, .15); chest.scale.set(.9, 1, .7); catM.add(chest);
  const head = new THREE.Mesh(new THREE.SphereGeometry(.075, 12, 10), O); head.position.set(0, .24, .22); catM.add(head);
  for (const s of [-1, 1]){ const ear = new THREE.Mesh(new THREE.ConeGeometry(.026, .05, 4), O); ear.position.set(s * .04, .31, .21); catM.add(ear); }
  const muzzle = new THREE.Mesh(new THREE.SphereGeometry(.035, 8, 6), W); muzzle.position.set(0, .22, .285); muzzle.scale.set(1.2, .8, .8); catM.add(muzzle);
  catM.userData.legs = [];
  for (const [lx, lz] of [[-.05, .12], [.05, .12], [-.05, -.12], [.05, -.12]]){ const leg = new THREE.Group(); leg.position.set(lx, .12, lz);
    const l = new THREE.Mesh(new THREE.CylinderGeometry(.022, .02, .1, 6), O); l.position.y = -.05; leg.add(l);
    const paw = new THREE.Mesh(new THREE.SphereGeometry(.024, 6, 5), W); paw.position.y = -.11; leg.add(paw); catM.add(leg); catM.userData.legs.push(leg); }
  const tail = new THREE.Mesh(new THREE.CylinderGeometry(.014, .02, .3, 6), D); tail.position.set(0, .26, -.27); tail.rotation.x = -.6; catM.add(tail); }
const catPose = new THREE.Group(); // inner node for shake / swim tilt
catM.children.slice().forEach(c => catPose.add(c)); catM.add(catPose);

const keys = {}; addEventListener('keydown', e => { keys[e.code] = true; if (e.code === 'KeyC') overview = !overview; });
addEventListener('keyup', e => keys[e.code] = false);
let overview = Q.has('over');
const status = document.getElementById('s');

function stepCat(dt){
  const sp = pond.sample(cat.x, cat.z);
  cat.sprint = !!(keys.ShiftLeft || keys.ShiftRight);
  if (cat.state === 'swim'){ // paddle straight for the nearest bank, head high
    const r = Math.hypot(cat.x, cat.z), ox = cat.x / r, oz = cat.z / r;
    cat.yaw += (Math.atan2(ox, oz) - cat.yaw + Math.PI * 3) % (Math.PI * 2) - Math.PI > 0 ? dt * 2 : -dt * 2;
    cat.x += ox * .55 * dt; cat.z += oz * .55 * dt; cat.h = sp.water - .14;
    if (Math.random() < dt * 3) pond.addRipple(cat.x, cat.z, .03);
    if (sp.depth < .03){ cat.state = 'shake'; cat.t = 0; cat.h = sp.h; }
    return; }
  if (cat.state === 'shake'){ cat.t += dt; if (cat.t > 1.6) cat.state = 'walk'; cat.h = sp.h; return; }
  const fwd = (keys.KeyW || keys.ArrowUp ? 1 : 0) - (keys.KeyS || keys.ArrowDown ? 1 : 0);
  const turn = (keys.KeyA || keys.ArrowLeft ? 1 : 0) - (keys.KeyD || keys.ArrowRight ? 1 : 0);
  cat.yaw += turn * dt * 2.2;
  const v = fwd * (cat.sprint ? 3.2 : 1.1) * (fwd < 0 ? .5 : 1);
  const nx = cat.x + Math.sin(cat.yaw) * v * dt, nz = cat.z + Math.cos(cat.yaw) * v * dt;
  const ns = pond.sample(nx, nz), grounded = cat.h <= sp.h + .02;
  let block = false;
  if (ns.h > cat.h + .14) block = true;                                            // too tall a step
  // afraid of water: on firm footing, refuses to wade past 5 cm unless running/hopping
  if (grounded && ns.kind === 'ground' && ns.depth >= .05 && !cat.sprint && sp.kind === 'ground' && v) { block = true; cat.hes = .6; }
  if (!block){ cat.x = nx; cat.z = nz; }
  if (keys.Space && grounded) { cat.vh = 2.4; }
  cat.vh -= 9.81 * dt; cat.h += cat.vh * dt;
  const s2 = pond.sample(cat.x, cat.z);
  if (cat.h <= s2.h){ cat.h = s2.h; if (cat.vh < -1 && s2.kind !== 'ground') pond.addRipple(cat.x, cat.z, .02); cat.vh = 0; }
  cat.on = cat.h <= s2.h + .03 && s2.kind === 'log' ? s2.ref : null;
  if (s2.kind === 'ground' && s2.depth >= .05 && cat.h < s2.water - .05){ // fell in
    cat.state = 'swim'; pond.addRipple(cat.x, cat.z, .07); cat.vh = 0; }
  else if (s2.kind === 'ground' && s2.wet && v && Math.random() < dt * 4) pond.addRipple(cat.x, cat.z, .01);
  cat.hes = Math.max(0, cat.hes - dt);
}

const camPos = new THREE.Vector3(), tmp = new THREE.Vector3(), up = new THREE.Vector3(), fw = new THREE.Vector3(), lookAt = new THREE.Vector3();
let armLen = 2;
function placeCat(dt, t){
  pond.toWorld(cat.x, cat.z, cat.h, catM.position); pond.frame(cat.x, cat.z, cat.yaw, catM.quaternion);
  catPose.rotation.set(0, 0, 0); catPose.position.set(0, 0, 0);
  if (cat.state === 'shake'){ const k = Math.max(0, 1 - cat.t / 1.6); catPose.rotation.z = Math.sin(cat.t * 38) * .45 * k; }
  if (cat.state === 'swim'){ catPose.rotation.x = -.35; catPose.position.y = Math.sin(t * 6) * .01; }
  if (cat.hes > 0) catPose.rotation.x = -.15 * Math.sin(cat.hes * 6);                       // hesitating lean-back at the waterline
  const moving = keys.KeyW || keys.KeyS || cat.state === 'swim';
  catM.userData.legs.forEach((l, i) => l.rotation.x = moving ? Math.sin(t * (cat.sprint ? 16 : 9) + (i % 3 ? Math.PI : 0)) * .5 : 0);
  // spring-arm follow cam
  up.copy(catM.position).normalize(); fw.set(0, 0, 1).applyQuaternion(catM.quaternion);
  armLen += ((cat.sprint ? 3 : 2) - armLen) * Math.min(1, dt * 2);
  tmp.copy(catM.position).addScaledVector(up, .5).addScaledVector(fw, -armLen);
  const lc = pond.toLocal(tmp), gh = pond.sample(lc.x, lc.z); const minH = Math.max(gh.h, gh.water) + .3;
  if (lc.h < minH) tmp.addScaledVector(up, minH - lc.h);
  if (camPos.distanceTo(tmp) > 6) camPos.copy(tmp); camPos.lerp(tmp, Math.min(1, dt * 4));
  lookAt.copy(catM.position).addScaledVector(up, .2).addScaledVector(fw, .6);
  if (overview){ pond.toWorld(-2, -26, 14, camera.position); camera.up.copy(pond.Cn); camera.lookAt(pond.toWorld(0, -1, 0)); }
  else { camera.position.copy(camPos); camera.up.copy(up); camera.lookAt(lookAt); }
}

let last = performance.now(), T = 0;
function frame(now){
  const dt = Math.min(.05, (now - last) / 1000); last = now; T += dt;
  stepCat(dt); pond.update(dt, cat); placeCat(dt, T);
  status.textContent = cat.state === 'walk' ? (cat.on ? 'on a log' : cat.hes > 0 ? 'the cat will not wade deeper' : '') : cat.state === 'swim' ? 'splash — scrambling out' : 'shake';
  renderer.render(scene, camera); requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
addEventListener('resize', () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); });
window.__pond = { pond, cat, keys };
