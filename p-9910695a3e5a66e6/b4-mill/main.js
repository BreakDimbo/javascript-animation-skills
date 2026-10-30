import * as THREE from '../shared/vendor/three.module.js';
import { createMill } from './mill.js';

const R = 600;
const renderer = new THREE.WebGLRenderer({ canvas: document.getElementById('c'), antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2)); renderer.toneMapping = THREE.NoToneMapping;
const scene = new THREE.Scene(); const PAPER = new THREE.Color('#e9e2d4');
scene.background = PAPER; scene.fog = new THREE.Fog(PAPER, 60, 260);
const camera = new THREE.PerspectiveCamera(55, 1, 0.05, 2000);
scene.add(new THREE.HemisphereLight('#f4ecdc', '#6f6a52', 1.9));
const sun = new THREE.DirectionalLight('#fff3df', 1.5); scene.add(sun, sun.target);

const planet = { R, mesh: new THREE.Mesh(new THREE.SphereGeometry(R, 160, 120), new THREE.MeshLambertMaterial({ color: '#8c9b5c' })) };
scene.add(planet.mesh);
const centerDir = new THREE.Vector3(0.2, 1, 0.15).normalize();
const mill = createMill(scene, planet, centerDir);
sun.position.copy(centerDir).multiplyScalar(R + 200).add(new THREE.Vector3(120, 40, 160)); sun.target.position.copy(centerDir).multiplyScalar(R);

// ---------- placeholder cat: old orange short-hair, white chest + paw tips ----------
function createCat(){
  const g = new THREE.Group(), m = (c) => new THREE.MeshLambertMaterial({ color: c });
  const O = '#d08a4a', W = '#efe6d6';
  const body = new THREE.Mesh(new THREE.SphereGeometry(.11, 14, 10).scale(1, .95, 2.0), m(O)); body.position.y = .2; g.add(body);
  const chest = new THREE.Mesh(new THREE.SphereGeometry(.085, 12, 8).scale(1, 1.1, .8), m(W)); chest.position.set(0, .19, .15); g.add(chest);
  const head = new THREE.Mesh(new THREE.SphereGeometry(.085, 14, 10), m(O)); head.position.set(0, .3, .22); g.add(head);
  const snout = new THREE.Mesh(new THREE.SphereGeometry(.04, 10, 8), m(W)); snout.position.set(0, .28, .295); g.add(snout);
  for (const s of [-1, 1]){ const ear = new THREE.Mesh(new THREE.ConeGeometry(.03, .06, 4), m(O)); ear.position.set(s * .045, .385, .2); g.add(ear);
    const eye = new THREE.Mesh(new THREE.SphereGeometry(.011, 6, 6), m('#2a2620')); eye.position.set(s * .033, .315, .295); g.add(eye); }
  const legs = []; for (const [x, z] of [[-.06, .13], [.06, .13], [-.06, -.13], [.06, -.13]]){ const p = new THREE.Group(); p.position.set(x, .15, z); g.add(p);
    const l = new THREE.Mesh(new THREE.CylinderGeometry(.024, .022, .15, 6), m(O)); l.position.y = -.075; p.add(l);
    const paw = new THREE.Mesh(new THREE.SphereGeometry(.027, 8, 6), m(W)); paw.position.y = -.145; p.add(paw); legs.push(p); }
  const tail = new THREE.Mesh(new THREE.CylinderGeometry(.018, .026, .3, 6), m(O)); tail.position.set(0, .28, -.32); tail.rotation.x = -.7; g.add(tail);
  g.userData = { body, legs, tail, head };
  return g;
}
const cat = createCat(); scene.add(cat);
const st = { pos: mill.spawn.clone(), heading: new THREE.Vector3(), vr: 0, sitting: false, idle: 0, riding: false };
{ const up = st.pos.clone().normalize(); st.heading.copy(mill.surf(-4, 10)).sub(st.pos).addScaledVector(up, -0).projectOnPlane(up).normalize(); }

const keys = {}; addEventListener('keydown', e => { keys[e.code] = true;
  if (e.code === 'KeyE'){ if (st.riding){ st.riding = false; mill.setRiding(false); const up = st.pos.clone().normalize(); const side = new THREE.Vector3().crossVectors(up, st.heading).normalize(); st.pos.addScaledVector(side, 1.2); }
    else if (mill.donkeyNear(st.pos)){ st.riding = true; mill.setRiding(true); } }
  if (e.code === 'KeyC') st.sitting = !st.sitting; });
addEventListener('keyup', e => keys[e.code] = false);
const hint = document.getElementById('hint');

const camPos = new THREE.Vector3(), camLook = new THREE.Vector3(), tmp = new THREE.Vector3();
let camInit = false;
function updateCat(dt, t){
  const up = st.pos.clone().normalize();
  const U = cat.userData; let moving = false, sprint = keys.ShiftLeft || keys.ShiftRight;
  if (st.riding){
    mill.seatWorld(st.pos); const dq = mill.donkey.quaternion; st.heading.set(0, 0, 1).applyQuaternion(dq);
    cat.position.copy(st.pos); cat.quaternion.copy(dq); st.sitting = true;
  } else {
    const turn = (keys.KeyA || keys.ArrowLeft ? 1 : 0) - (keys.KeyD || keys.ArrowRight ? 1 : 0);
    const fwd = (keys.KeyW || keys.ArrowUp ? 1 : 0) - (keys.KeyS || keys.ArrowDown ? .6 : 0);
    st.heading.applyAxisAngle(up, turn * 2.2 * dt).projectOnPlane(up).normalize();
    if (fwd){ moving = true; st.sitting = false; st.pos.addScaledVector(st.heading, fwd * (sprint ? 4.2 : 1.6) * dt); }
    // radial gravity
    const ground = R + mill.heightAt(st.pos); let r = st.pos.length();
    if (keys.Space && r - ground < .01){ st.vr = 2.6; st.sitting = false; }
    st.vr -= 9.8 * dt; r += st.vr * dt; if (r < ground){ r = ground; st.vr = 0; }
    st.pos.setLength(r); st.pos.copy(mill.collide(st.pos));
    const up2 = st.pos.clone().normalize(); st.heading.projectOnPlane(up2).normalize();
    st.idle = moving ? 0 : st.idle + dt; if (st.idle > 3) st.sitting = true;
    cat.position.copy(st.pos);
    cat.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(tmp.crossVectors(up2, st.heading), up2, st.heading));
  }
  // pose
  const ph = t * (sprint ? 16 : 9);
  U.legs.forEach((l, i) => l.rotation.x = moving ? Math.sin(ph + (i === 0 || i === 3 ? 0 : Math.PI)) * .6 : 0);
  const sit = st.sitting && !moving ? 1 : 0;
  U.body.rotation.x = THREE.MathUtils.damp(U.body.rotation.x, -sit * .5, 6, dt);
  U.legs[2].position.y = U.legs[3].position.y = .15 - sit * .07;
  U.tail.rotation.x = -.7 + Math.sin(t * 1.4) * .15;
  // spring-arm cam
  const upC = st.pos.clone().normalize();
  const dist = sprint && moving ? 3.0 : st.riding ? 3.0 : 2.2, h = st.riding ? 1.2 : .58;
  const side = tmp.crossVectors(upC, st.heading).normalize();
  const want = st.pos.clone().addScaledVector(st.heading, -dist * (1 - .35 * mill.mousePeek)).addScaledVector(upC, h).addScaledVector(side, -.9 * mill.mousePeek);
  const minR = R + mill.heightAt(want) + .35; if (want.length() < minR) want.setLength(minR);
  const look = st.pos.clone().addScaledVector(upC, st.riding ? .6 : .25).addScaledVector(st.heading, .6);
  if (!camInit){ camPos.copy(want); camLook.copy(look); camInit = true; }
  camPos.lerp(want, 1 - Math.exp(-dt * 5)); camLook.lerp(look, 1 - Math.exp(-dt * 10));
  camera.position.copy(camPos); camera.up.copy(upC); camera.lookAt(camLook);
  if (OVERVIEW){ camera.position.copy(mill.surf(-55, 60, 38)); camera.up.copy(centerDir); camera.lookAt(mill.surf(0, 4, 3)); }
  hint.textContent = st.riding ? 'E — 下来 · get down' : mill.donkeyNear(st.pos) ? 'E — 骑上驴背 · ride the donkey' : mill.mousePeek > .5 ? '睡鼠探出头来 · a dormouse peeks out' : 'WASD 走 · Shift 跑 · C 坐下';
}

function resize(){ renderer.setSize(innerWidth, innerHeight, false); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); }
addEventListener('resize', resize); resize();
const OVERVIEW = new URLSearchParams(location.search).has('overview');
const clock = new THREE.Clock(); let T = 0;
if (new URLSearchParams(location.search).has('donkey')){ st.riding = true; mill.setRiding(true); }
if (new URLSearchParams(location.search).has('sacks')){ mill.sackSpot(st.pos); const up = st.pos.clone().normalize(); st.pos.setLength(R + mill.heightAt(st.pos)); st.heading.copy(mill.sackCenter(new THREE.Vector3())).sub(st.pos).projectOnPlane(up).normalize(); st.sitting = true; st.idle = 9; }
function frame(){ const dt = Math.min(clock.getDelta(), .05); T += dt; mill.update(dt, { position: st.pos, sitting: st.sitting }); updateCat(dt, T); renderer.render(scene, camera); requestAnimationFrame(frame); }
frame();
window.__fold = { st, mill, camera };
