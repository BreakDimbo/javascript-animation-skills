// 褶星 Fold — b7 finds: small discoveries on transition land + sleep spots (save points)
import * as THREE from '../shared/vendor/three.module.js';

export const R = 600;
const SAVE_KEY = 'fold.save.v1';

// ---- helpers ---------------------------------------------------------------
function rng(seed) { let s = seed >>> 0 || 1; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }
// shared hand-painted gouache mottle + paper grain (matte clay look, multiplies the base colour)
let _grain = null;
function grainTex() {
  if (_grain || typeof document === 'undefined') return _grain;
  const cv = document.createElement('canvas'); cv.width = cv.height = 256; const g = cv.getContext('2d'), r = rng(7);
  g.fillStyle = '#f2ede2'; g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 90; i++) { const v = 200 + r() * 50 | 0; g.fillStyle = `rgba(${v},${v - 6},${v - 16},.35)`;
    g.beginPath(); g.ellipse(r() * 256, r() * 256, 10 + r() * 30, 4 + r() * 12, r() * 3, 0, 7); g.fill(); }
  for (let i = 0; i < 1400; i++) { const v = r() < .5 ? 180 : 255; g.fillStyle = `rgba(${v},${v},${v - 10},.18)`; g.fillRect(r() * 256, r() * 256, 1, 1 + (r() * 2 | 0)); }
  for (let i = 0; i < 160; i++) { g.strokeStyle = 'rgba(120,105,85,.10)'; const x = r() * 256, y = r() * 256; g.beginPath(); g.moveTo(x, y); g.lineTo(x + r() * 6 - 3, y - 3 - r() * 5); g.stroke(); }
  _grain = new THREE.CanvasTexture(cv); _grain.wrapS = _grain.wrapT = THREE.RepeatWrapping; _grain.colorSpace = THREE.SRGBColorSpace;
  return _grain;
}
const mat = (c) => new THREE.MeshLambertMaterial({ color: c, map: grainTex() });
const PAL = { yarn: 0xb8574a, catnip: 0x8a9a6c, catnip2: 0x9fae80, log: 0x7a5e44, bark: 0x5e4935,
  hedge: 0x7c8668, stone: 0xb7a58c, cushion: 0xc58a6a, wing: 0xe9d9b0, wing2: 0xd7a85c };

function surfacePoint(planet, dir) {
  const r = planet && planet.heightAt ? planet.radius + planet.heightAt(dir) : (planet?.radius ?? R);
  return dir.clone().multiplyScalar(r);
}
// orient object so its local +Y is radial up
function placeOnSphere(obj, planet, dir, yaw = 0) {
  const up = dir.clone().normalize();
  obj.position.copy(surfacePoint(planet, up));
  obj.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), up);
  obj.rotateY(yaw);
}
// Fibonacci-ish spaced points every ~spacing metres along the sphere
function spacedDirs(count, rand) {
  const dirs = [];
  for (let i = 0; i < count; i++) {
    const y = 1 - 2 * (i + 0.5) / count, r = Math.sqrt(1 - y * y), t = i * 2.39996 + rand() * 0.4;
    const d = new THREE.Vector3(Math.cos(t) * r, y, Math.sin(t) * r);
    d.add(new THREE.Vector3(rand() - .5, rand() - .5, rand() - .5).multiplyScalar(0.02)).normalize();
    dirs.push(d);
  }
  return dirs;
}
// default transition test: everything counts; a planet can provide isTransition(dir)
const isTransition = (planet, d) => (planet && planet.isTransition ? planet.isTransition(d) : true);

// ---- meshes ----------------------------------------------------------------
function makeYarn(rand) {
  const g = new THREE.Group();
  const ball = new THREE.Mesh(new THREE.IcosahedronGeometry(0.06, 2), mat(PAL.yarn)); ball.position.y = 0.06; g.add(ball);
  const pts = []; for (let i = 0; i < 8; i++) pts.push(new THREE.Vector3(0.06 + i * 0.07, 0.01, Math.sin(i * 1.3 + rand()) * 0.05));
  g.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 20, 0.006, 4), mat(PAL.yarn)));
  return g;
}
function makeCatnip(rand) {
  const g = new THREE.Group();
  for (let i = 0; i < 14; i++) {
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.045, 10, 8), mat(i % 3 ? PAL.catnip : PAL.catnip2));
    const a = rand() * 6.28, rr = rand() * 0.45; m.position.set(Math.cos(a) * rr, 0.07, Math.sin(a) * rr); m.scale.set(1, 1.6 + rand() * 1.4, 0.7); m.rotation.z = (rand() - .5) * .5; g.add(m);
  }
  return g;
}
function makeLog(rand) {
  const g = new THREE.Group();
  const l = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.19, 1.8 + rand(), 14), mat(PAL.log));
  l.rotation.z = Math.PI / 2; l.position.y = 0.16; g.add(l);
  const end = new THREE.Mesh(new THREE.CircleGeometry(0.15, 7), mat(0xa88a63)); end.position.set(0.95, 0.16, 0); end.rotation.y = Math.PI / 2; g.add(end);
  return g;
}
function makeHedgeGap(rand) {
  const g = new THREE.Group();
  for (const side of [-1, 1]) for (let i = 0; i < 5; i++) {
    const b = new THREE.Mesh(new THREE.IcosahedronGeometry(0.45 + rand() * 0.15, 3), mat(PAL.hedge));
    b.position.set(side * (0.42 + i * 0.6), 0.5, (rand() - .5) * 0.2); b.scale.y = 1.3; g.add(b);
  }
  // arch over the cat-sized gap (0.3 m tall opening)
  const top = new THREE.Mesh(new THREE.IcosahedronGeometry(0.4, 3), mat(PAL.hedge)); top.position.set(0, 0.75, 0); g.add(top);
  return g;
}
function makeButterfly() {
  const g = new THREE.Group(), body = new THREE.Group(); g.add(body);
  const wg = new THREE.PlaneGeometry(0.05, 0.04); wg.translate(0.025, 0, 0);
  const L = new THREE.Mesh(wg, new THREE.MeshLambertMaterial({ color: PAL.wing, side: THREE.DoubleSide }));
  const Rw = L.clone(); Rw.scale.x = -1;
  L.rotation.x = Rw.rotation.x = -Math.PI / 2; body.add(L, Rw);
  g.userData.wings = [L, Rw]; g.userData.body = body;
  return g;
}
function makeStone(rand) {
  const m = new THREE.Mesh(new THREE.IcosahedronGeometry(0.4, 3), mat(PAL.stone));
  m.scale.set(1.2, 0.35, 0.9); m.position.y = 0.1; const g = new THREE.Group(); g.add(m); return g;
}
function makeCushion() {
  const g = new THREE.Group();
  const m = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.32, 0.1, 12), mat(PAL.cushion)); m.position.y = 0.05; g.add(m);
  const b = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.04, 5, 14), mat(0xa86f55)); b.rotation.x = Math.PI / 2; b.position.y = 0.09; g.add(b);
  return g;
}

// ---- finds -----------------------------------------------------------------
const KINDS = ['yarn', 'catnip', 'log', 'butterfly', 'hedgeGap'];
const MAKERS = { yarn: makeYarn, catnip: makeCatnip, log: makeLog, butterfly: makeButterfly, hedgeGap: makeHedgeGap };

/** Scatter small discoveries ~every 60–100 m over transition land. */
export function createFinds(scene, planet, seed = 7, opts = {}) {
  const rand = rng(seed), radius = planet?.radius ?? R;
  const spacing = opts.spacing ?? 80;
  const count = Math.round(4 * Math.PI * radius * radius / (spacing * spacing));
  const group = new THREE.Group(); group.name = 'finds'; scene.add(group);
  const items = [];
  for (const d of spacedDirs(count, rand)) {
    if (!isTransition(planet, d)) continue;
    const kind = KINDS[Math.floor(rand() * KINDS.length)];
    const obj = MAKERS[kind](rand);
    placeOnSphere(obj, planet, d, rand() * 6.28);
    group.add(obj);
    items.push({ kind, obj, dir: d.clone(), home: obj.position.clone(), phase: rand() * 10, found: false });
  }
  const tmp = new THREE.Vector3();
  const add = (kind, d) => {
    const obj = MAKERS[kind](rand); placeOnSphere(obj, planet, d, rand() * 6.28); group.add(obj);
    const it = { kind, obj, dir: d.clone().normalize(), home: obj.position.clone(), phase: rand() * 10, found: false };
    items.push(it); return it;
  };
  return {
    group, items, add,
    /** returns the nearest find within `reach` metres of catPos (or null); animates butterflies */
    update(dt, t, catPos) {
      let near = null, best = Infinity;
      for (const it of items) {
        const dist = catPos ? it.home.distanceTo(catPos) : Infinity;
        if (it.kind === 'butterfly' && dist < 60) {
          // soft flutter; drifts away from the cat — never catchable
          const up = it.dir, w = it.obj.userData.wings, ph = t * 9 + it.phase;
          w[0].rotation.y = Math.sin(ph) * 0.9; w[1].rotation.y = -Math.sin(ph) * 0.9;
          const flee = dist < 1.6 ? (1.6 - dist) : 0;
          it.obj.userData.flee = THREE.MathUtils.lerp(it.obj.userData.flee || 0, flee, dt * 2);
          const b = it.obj.userData.body;
          b.position.set(Math.sin(t * 0.7 + it.phase) * 0.6, 0.35 + Math.sin(t * 1.9 + it.phase) * 0.12 + it.obj.userData.flee * 1.2, Math.cos(t * 0.5 + it.phase) * 0.6);
        }
        if (dist < best) { best = dist; near = it; }
      }
      if (near && best < (near.kind === 'log' || near.kind === 'hedgeGap' ? 1.6 : 1.0)) { near.found = true; return near; }
      return null;
    },
    /** hedge gaps: true if cat (small) may pass at this position */
    canPass(pos, bodySize = 0.45) {
      for (const it of items) if (it.kind === 'hedgeGap' && it.home.distanceTo(pos) < 3) {
        it.obj.worldToLocal(tmp.copy(pos));
        if (Math.abs(tmp.z) < 0.6 && Math.abs(tmp.x) > 0.3) return false; // bushes
        if (Math.abs(tmp.x) <= 0.3 && bodySize > 0.6) return false;        // gap only fits a cat
      }
      return true;
    },
  };
}

// ---- sleep spots -----------------------------------------------------------
export function createSleepSpots(scene, planet, seed = 11, opts = {}) {
  const rand = rng(seed), group = new THREE.Group(); group.name = 'sleepSpots'; scene.add(group);
  const spots = [];
  const dirs = opts.dirs ?? spacedDirs(opts.count ?? 24, rand);
  dirs.forEach((d, i) => {
    const kind = i % 2 ? 'cushion' : 'stone';
    const obj = kind === 'stone' ? makeStone(rand) : makeCushion();
    placeOnSphere(obj, planet, d, rand() * 6.28); group.add(obj);
    spots.push({ id: i, kind, obj, dir: d.clone(), pos: obj.position.clone() });
  });
  return {
    group, spots,
    nearest(catPos, reach = 1.2) {
      let best = null, bd = reach;
      for (const s of spots) { const dd = s.pos.distanceTo(catPos); if (dd < bd) { bd = dd; best = s; } }
      return best;
    },
  };
}

// ---- save / load -----------------------------------------------------------
export function saveGame(state) {
  const data = { v: 1, t: Date.now(), ...state,
    pos: state.pos && [state.pos.x, state.pos.y, state.pos.z] };
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(data)); return true; } catch { return false; }
}
export function loadGame() {
  try {
    const d = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null'); if (!d) return null;
    if (d.pos) d.pos = new THREE.Vector3(...d.pos); return d;
  } catch { return null; }
}

/** paper-white fade overlay for sleep; returns promise resolving when faded back */
export function sleepFade(el, hold = 1400) {
  el.style.opacity = '1';
  return new Promise((res) => setTimeout(() => { el.style.opacity = '0'; setTimeout(res, 1200); }, 1200 + hold));
}
