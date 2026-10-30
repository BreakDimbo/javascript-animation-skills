// 褶星 Fold — b10: integration shell. Every sibling module is optional; missing/broken ones get a placeholder.
import * as THREE from '../shared/vendor/three.module.js';

export const R = 600;
const PAPER = '#ece4d3';
const log = [];
const note = (k, ok, why = "") => { const s = `${k} ${ok ? "·" : "×"}${why ? " " + why : ""}`; if (log.includes(s)) return; log.push(s); document.getElementById("mods").textContent = log.join("\n"); };

// ---------- module discovery: list the folder first so missing files never 404 ----------
async function listJs(dir) {
  // empty folder -> python directory listing; folder with index.html -> follow its module script and that file's ./imports
  const get = async u => { try { const r = await fetch(u); return r.ok ? await r.text() : ''; } catch { return ''; } };
  const t = await get(`../${dir}/`);
  if (/Directory listing/i.test(t)) return [...t.matchAll(/href="([^"?/]+\.js)"/g)].map(m => decodeURIComponent(m[1]));
  const out = new Set(), srcs = [...t.matchAll(/<script[^>]*src="\.?\/?([^"/]+\.js)"/g)].map(m => m[1]);
  for (const s of srcs) { out.add(s); for (const m of (await get(`../${dir}/${s}`)).matchAll(/from\s+['"]\.\/([^'"/]+\.js)['"]/g)) out.add(m[1]); }
  return [...out];
}
async function load(dir, prefer) {
  const files = await listJs(dir);
  const f = prefer.find(p => files.includes(p)) || (files.length ? files.find(x => x !== 'main.js' && !/^(test|shot)/.test(x)) : prefer[0]);
  if (!f) { note(dir, false, 'absent'); return null; }
  try { const m = await import(`../${dir}/${f}`); note(dir, true, f); return m; }
  catch (e) { console.warn(dir, e); note(dir, false, 'import failed'); return null; }
}
const safe = (k, fn, fb = null) => { try { return fn(); } catch (e) { console.warn(k, e); note(k, false, 'init failed'); return fb; } };

// ---------- renderer / scene ----------
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2)); renderer.setSize(innerWidth, innerHeight);
document.body.prepend(renderer.domElement);
const scene = new THREE.Scene(); scene.background = new THREE.Color(PAPER);
scene.fog = new THREE.Fog(PAPER, 30, 260);
const camera = new THREE.PerspectiveCamera(50, innerWidth / innerHeight, 0.05, 5000);
addEventListener('resize', () => { renderer.setSize(innerWidth, innerHeight); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); });

// paper grain overlay (static, multiply)
{ const g = document.getElementById('grain'), c = g.getContext('2d'); g.width = 256; g.height = 256;
  const d = c.createImageData(256, 256); for (let i = 0; i < d.data.length; i += 4) { const v = 180 + Math.random() * 75; d.data[i] = d.data[i + 1] = d.data[i + 2] = v; d.data[i + 3] = 255; }
  c.putImageData(d, 0, 0); g.style.width = g.style.height = '100%'; g.style.imageRendering = 'auto'; }

// ---------- region layout: 01 meadow, 06 pond, 03 mill — ~40 m gaps between patch edges ----------
const C01 = new THREE.Vector3(0, 0, 1);
const E = new THREE.Vector3(1, 0, 0);
const along = (m) => C01.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), m / R).normalize();
const REG = [
  { no: '01', name: '羊之草甸 · Sheep Meadow', dir: along(0),    rad: 110 },
  { no: '06', name: '池 · The Pond',           dir: along(110 + 40 + 23), rad: 30 },
  { no: '03', name: '磨坊 · The Mill',          dir: along(-(110 + 40 + 60)), rad: 65 },
];

// ---------- input ----------
const keys = {}; const edge = {};
addEventListener('keydown', e => { if (!keys[e.code]) edge[e.code] = true; keys[e.code] = true; });
addEventListener('keyup', e => { keys[e.code] = false; });
const qs = new URLSearchParams(location.search), demo = qs.get('demo');
function readInput(T) {
  const inp = { x: (keys.KeyD || keys.ArrowRight ? 1 : 0) - (keys.KeyA || keys.ArrowLeft ? 1 : 0),
    y: (keys.KeyW || keys.ArrowUp ? 1 : 0) - (keys.KeyS || keys.ArrowDown ? 1 : 0),
    sprint: !!(keys.ShiftLeft || keys.ShiftRight), jump: !!edge.Space, sit: !!edge.KeyC, sleep: !!edge.KeyZ };
  if (demo === 'walk') { inp.y = 1; inp.x = Math.sin(T * 0.3) * 0.2; }
  for (const k in edge) edge[k] = false;
  return inp;
}

// ---------- boot ----------
const [mCat, mCam, mPlanet, mMeadow, mPond, mMill, mFinds, mSwallow, mSound] = await Promise.all([
  load('b1-cat', ['cat.js']), load('b1-cat', ['followcam.js']), qs.has('b5') ? load('b5-planet', ['planet.js']) : Promise.resolve(null),
  load('b2-meadow', ['meadow.js']), load('b3-pond', ['pond.js']), load('b4-mill', ['mill.js']),
  load('b7-finds', ['finds.js']), load('b8-swallow', ['swallow.js']), load('b9-sound', ['soundscape.js', 'sound.js']),
]);
if (!qs.has('b5')) note('b5-planet', false, 'opt-in ?b5 (terrain height ≠ flat patches yet)');

// planet: b5 if requested, else matte paper sphere
let planet = null;
if (mPlanet?.createPlanet) planet = safe('b5-planet', () => { const p = mPlanet.createPlanet(scene); p.spin = 0; return p; });
if (!planet) {
  const geo = new THREE.SphereGeometry(R - 0.5, 160, 120);
  const mat = new THREE.MeshLambertMaterial({ color: '#b9b38f' });
  const mesh = new THREE.Mesh(geo, mat); scene.add(mesh);
  scene.add(new THREE.HemisphereLight('#f3eee2', '#8a8676', 1.7));
  const sun = new THREE.DirectionalLight('#fff6e6', 1.4); sun.position.set(400, 900, 1200); scene.add(sun);
  planet = { group: mesh, update() {} };
}

// regions
const placeholder = (r, col) => { const m = new THREE.Mesh(new THREE.CircleGeometry(r.rad, 48), new THREE.MeshLambertMaterial({ color: col }));
  m.position.copy(r.dir).multiplyScalar(R + 0.02); m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), r.dir); scene.add(m); return null; };
const meadow = (mMeadow?.createMeadow && safe('meadow', () => mMeadow.createMeadow(scene, { radius: R, R }, REG[0].dir))) || placeholder(REG[0], '#a9ad84');
const pond = (mPond?.createPond && safe('pond', () => mPond.createPond(scene, { R, radius: R }, REG[1].dir))) || placeholder(REG[1], '#8fa3a0');
const mill = (mMill?.createMill && safe('mill', () => mMill.createMill(scene, { R, radius: R }, REG[2].dir))) || placeholder(REG[2], '#c4b07e');

// cat
const catPlanet = { R, spawnUp: along(-20), colliders: [] };
let cat = mCat?.createCat && safe('cat', () => mCat.createCat(scene, catPlanet));
let stepCat;
if (cat) stepCat = (dt, inp, fwd) => mCat.updateCat(cat, dt, inp, catPlanet, fwd);
else { // placeholder: orange clay pebble that walks on the sphere
  const m = new THREE.Mesh(new THREE.SphereGeometry(0.15, 16, 12), new THREE.MeshLambertMaterial({ color: '#d08a4a' })); m.scale.set(1, 0.8, 1.6); scene.add(m);
  cat = { root: m, up: catPlanet.spawnUp.clone(), fwd: new THREE.Vector3(1, 0, 0), alt: 0, speed: 0, R, state: 'idle', gait: 'idle' };
  cat.pos = cat.up.clone().multiplyScalar(R);
  stepCat = (dt, inp, camFwd) => {
    const up = cat.up, cf = (camFwd || cat.fwd).clone().addScaledVector(up, -(camFwd || cat.fwd).dot(up)).normalize();
    const cr = new THREE.Vector3().crossVectors(cf, up); const w = cf.multiplyScalar(inp.y).addScaledVector(cr, inp.x);
    const sp = w.lengthSq() > 0.01 ? (inp.sprint ? 6 : 1.4) : 0; cat.speed += (sp - cat.speed) * Math.min(1, dt * 4); cat.gait = inp.sprint && sp ? 'sprint' : 'walk';
    if (sp) cat.fwd.copy(w.normalize());
    cat.pos.addScaledVector(cat.fwd, cat.speed * dt).setLength(R); cat.up.copy(cat.pos).normalize();
    cat.fwd.addScaledVector(cat.up, -cat.fwd.dot(cat.up)).normalize();
    m.position.copy(cat.pos).addScaledVector(cat.up, 0.12); m.lookAt(m.position.clone().add(cat.fwd)); m.up.copy(cat.up);
  };
}
let fcam = mCam?.createFollowCam && safe('followcam', () => mCam.createFollowCam(camera, renderer.domElement));
if (!fcam) fcam = { forward: () => cat.fwd, update(dt, c) { const p = c.pos.clone().addScaledVector(c.fwd, -2).addScaledVector(c.up, 0.5); camera.position.lerp(p, 1 - Math.exp(-dt * 5)); camera.up.copy(c.up); camera.lookAt(c.pos.clone().addScaledVector(c.up, 0.17)); } };

// extras: finds (b7), swallows (b8), soundscape (b9, starts on first key press)
const ctx = { scene, camera, renderer, R, regions: REG, get cat() { return cat; } };
const extras = [], off = (qs.get('off') || '').split(',');
if (mFinds?.createFinds && !off.includes('finds')) { const f = safe('finds', () => mFinds.createFinds(scene, { radius: R, R })); if (f) extras.push(['finds', { update: (dt, c) => f.update(dt, T, cat.root ? cat.root.position : cat.pos) }]); }
if (mSwallow?.createSwallows && !off.includes('swallow')) { const ok = safe('swallow', () => (mSwallow.createSwallows(scene, { radius: R, R }), mSwallow.setDreamCamera?.(camera), true)); if (ok && mSwallow.updateSwallows) extras.push(['swallow', { update: dt => mSwallow.updateSwallows(dt) }]); }
if (mSound?.createSoundscape && !off.includes('sound')) { const sc = safe('sound', () => mSound.createSoundscape());
  if (sc) { addEventListener('keydown', () => { if (!sc.ready) safe('sound-start', () => sc.start?.()); }, { once: false });
    extras.push(['sound', { update: dt => { if (sc.ready) { const p = cat.root ? cat.root.position : cat.pos; sc.update(dt, { pos: { x: p.x, y: p.y, z: p.z }, speed: cat.speed || 0, sleeping: cat.state === 'sleep' }); } } }]); } }

// ---------- region card ----------
const card = document.getElementById('card'); let cur = null, cardT = 0;
function regionAt(up) { for (const r of REG) if (up.angleTo(r.dir) * R < r.rad) return r; return null; }

// ---------- loop ----------
const clock = new THREE.Clock(); let T = 0;
const local = new THREE.Vector3();
function frame() {
  const dt = Math.min(clock.getDelta(), 0.05); T += dt;
  const inp = readInput(T);
  safe('cat-step', () => stepCat(dt, inp, fcam.forward()));
  if (!mSwallow?.isDreaming?.()) safe('cam', () => fcam.update(dt, cat));
  planet.update?.(dt, camera);
  const cp = cat.root ? cat.root.position : cat.pos;
  if (meadow?.update) safe('meadow-up', () => meadow.update(dt, T, cp));
  if (pond?.update && pond.toLocal) safe('pond-up', () => { const l = pond.toLocal(cp); pond.update(dt, { x: l.x, z: l.z, h: l.h, on: null }); });
  if (mill?.update) safe('mill-up', () => mill.update(dt, { position: cp, sitting: cat.state === 'sit' }));
  for (const [k, o] of extras) if (o.update) safe(k + '-up', () => o.update(dt, ctx));

  const r = regionAt(cat.up);
  if (r !== cur) { cur = r; if (r) { card.querySelector('.no').textContent = r.no; card.querySelector('.nm').textContent = r.name; card.style.opacity = 1; cardT = 4.5; } else card.style.opacity = 0; }
  if (cardT > 0 && (cardT -= dt) <= 0) card.style.opacity = 0;

  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
window.__fold = { scene, cat, REG, mods: log };
