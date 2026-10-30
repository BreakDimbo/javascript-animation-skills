// 褶星 Fold — b5-planet: whole-planet view, cube-sphere quadtree LOD, region streaming.
// Exports: createPlanet(scene), PlanetLOD, RegionStreamer, terrainHeight(dir), REGIONS, R
import * as THREE from '../shared/vendor/three.module.js';

export const R = 600;
export const SEA = 0;                 // sea level offset (m) above R
const SUN = new THREE.Vector3(0.55, 0.62, 0.56).normalize();

// ---------- noise (deterministic, shared by CPU terrain) ----------
function hash3(x, y, z) {
  let h = (x * 374761393 + y * 668265263 + z * 1274126177) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}
function vnoise(x, y, z) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
  let xf = x - xi, yf = y - yi, zf = z - zi;
  xf = xf * xf * (3 - 2 * xf); yf = yf * yf * (3 - 2 * yf); zf = zf * zf * (3 - 2 * zf);
  const l = (a, b, t) => a + (b - a) * t;
  return l(
    l(l(hash3(xi, yi, zi), hash3(xi + 1, yi, zi), xf), l(hash3(xi, yi + 1, zi), hash3(xi + 1, yi + 1, zi), xf), yf),
    l(l(hash3(xi, yi, zi + 1), hash3(xi + 1, yi, zi + 1), xf), l(hash3(xi, yi + 1, zi + 1), hash3(xi + 1, yi + 1, zi + 1), xf), yf),
    zf) * 2 - 1;
}
function fbm(x, y, z, oct) {
  let s = 0, a = 1, f = 1, n = 0;
  for (let i = 0; i < oct; i++) { s += a * vnoise(x * f + i * 17.3, y * f, z * f); n += a; a *= 0.5; f *= 2.03; }
  return s / n;
}

// ---------- regions (shared registry; centerDir in planet-local space) ----------
const dir = (x, y, z) => new THREE.Vector3(x, y, z).normalize();
export const REGIONS = [
  { id: '01-meadow', name: '羊之草甸 Sheep Meadow', centerDir: dir(0.32, 0.30, 0.90) },
  { id: '02-wheat',  name: '麦田 Wheat Fold',        centerDir: dir(-0.55, 0.15, 0.82) },
  { id: '03-dunes',  name: '沙丘 Dunes',             centerDir: dir(-0.85, -0.25, 0.10) },
  { id: '04-forest', name: '林 Forest Mass',         centerDir: dir(0.75, 0.45, 0.10) },
  { id: '05-snow',   name: '雪冠 Snow Cap',          centerDir: dir(0.05, 0.98, 0.10) },
  { id: '06-shore',  name: '海岸 Shore',             centerDir: dir(0.40, -0.55, 0.73) },
];
const M01 = REGIONS[0].centerDir;

// ---------- terrain: height (m above R) + biome colour ----------
const _t = { h: 0, land: 0, moist: 0 };
function terrainRaw(d) {
  const x = d.x, y = d.y, z = d.z;
  const cont = fbm(x * 1.6, y * 1.6, z * 1.6, 5) + 0.08;               // continents
  const ridge = 1 - Math.abs(fbm(x * 4 + 3, y * 4, z * 4, 4));
  const fine = fbm(x * 90, y * 90, z * 90, 3);                          // ~metre-scale undulation
  const micro = fbm(x * 700, y * 700, z * 700, 2);
  let land = cont;
  // region 01 is a gentle meadow plateau
  const m = Math.max(0, d.dot(M01) - 0.93) / 0.07;                      // 0..1 near region 01
  land = land * (1 - m) + 0.12 * m;
  let h = land > 0 ? land * 28 + Math.pow(Math.max(0, ridge - 0.5), 2) * 70 * Math.min(1, land * 4) * (1 - m) : land * 60;
  h += fine * 3 * (land > 0 ? 1 : 0.3) * (1 - 0.6 * m) + micro * 0.25;
  _t.h = h; _t.land = land; const mo = fbm(x * 3 + 9, y * 3, z * 3, 3) - (Math.abs(y) < 0.35 ? 0.25 : 0);
  _t.moist = mo * (1 - m) + (0.1 + fbm(x * 40, y * 40, z * 40, 2) * 0.15) * m;
  return _t;
}
export function terrainHeight(d) { const t = terrainRaw(d); return Math.max(t.h, SEA); }

const C = (h) => new THREE.Color(h);
const PAL = {
  deep: C('#5f7f90'), mid: C('#7495a1'), shallow: C('#98b2ad'), foam: C('#e4e2d2'),
  sand: C('#d9c38f'), dune: C('#cfa56b'), ochre: C('#b97a45'), rust: C('#a4643a'),
  meadow: C('#8ea45a'), lime: C('#a6b866'), wheat: C('#d0b56c'),
  forest: C('#566f3d'), forestD: C('#435b35'), rock: C('#998e77'), snow: C('#f0ece1'),
};
function biomeColor(d, t, out) {
  // painted band edges: smooth wobbly brush edge (low-freq) + a faint fine feather instead of per-vertex white-noise dither
  const n = fbm(d.x * 90, d.y * 90, d.z * 90, 2) * 0.75 + vnoise(d.x * 2200, d.y * 2200, d.z * 2200) * 0.25;
  const j = n * 0.03;
  const h = t.h;
  if (h < SEA) {                                    // posterised depth bands
    const k = -h + j * 60;
    out.copy(k < 1.2 ? PAL.foam : k < 7 ? PAL.shallow : k < 20 ? PAL.mid : PAL.deep);
    return out;
  }
  const lat = Math.abs(d.y) + j + fbm(d.x * 6, d.y * 6, d.z * 6, 2) * 0.08;
  const mo = t.moist + j;
  if (lat > 0.8 || h > 30 + j * 60) out.copy(PAL.snow);
  else if (h > 21 + j * 40) out.copy(PAL.rock);
  else if (h < 1.6 + j * 20) out.copy(PAL.sand);
  else if (mo < -0.22) out.copy(h > 12 ? PAL.rust : mo < -0.35 ? PAL.dune : PAL.ochre);
  else if (mo < -0.08) out.copy(PAL.wheat);
  else if (mo > 0.22) out.copy(mo > 0.34 ? PAL.forestD : PAL.forest);
  else out.copy(mo > 0.08 ? PAL.meadow : PAL.lime);
  return out;
}

// ---------- material: posterised gouache light, cloud shadows, paper grain, fog ----------
export function makeTerrainMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uSun: { value: SUN.clone() }, uPaper: { value: new THREE.Color('#ece5d6') }, uFog: { value: 0 } },
    vertexColors: true,
    vertexShader: /* glsl */`
      varying vec3 vCol; varying vec3 vN; varying vec3 vLocal; varying float vDist;
      void main(){
        vCol = color; vLocal = position; vN = normalize(mat3(modelMatrix) * normal);
        vec4 mv = modelViewMatrix * vec4(position,1.0); vDist = -mv.z;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */`
      uniform float uTime; uniform vec3 uSun; uniform vec3 uPaper; uniform float uFog;
      varying vec3 vCol; varying vec3 vN; varying vec3 vLocal; varying float vDist;
      float h3(vec3 p){ p = fract(p*0.3183099+.1); p*=17.0; return fract(p.x*p.y*p.z*(p.x+p.y+p.z)); }
      float vn(vec3 x){ vec3 i=floor(x), f=fract(x); f=f*f*(3.-2.*f);
        return mix(mix(mix(h3(i),h3(i+vec3(1,0,0)),f.x),mix(h3(i+vec3(0,1,0)),h3(i+vec3(1,1,0)),f.x),f.y),
                   mix(mix(h3(i+vec3(0,0,1)),h3(i+vec3(1,0,1)),f.x),mix(h3(i+vec3(0,1,1)),h3(i+vec3(1,1,1)),f.x),f.y),f.z); }
      void main(){
        vec3 n = normalize(vN);
        float l = clamp(dot(n, uSun)*0.5+0.5, 0.0, 1.0);          // wrapped, soft
        float b = floor(l*4.0)/4.0; l = mix(b, l, 0.35);           // gouache bands, slightly softened
        vec3 shade = mix(vec3(0.50,0.52,0.60), vec3(1.0,0.98,0.94), l);
        // soft drifting cloud shadows (planet-local)
        vec3 d = normalize(vLocal);
        float a = uTime*0.004; mat2 rot = mat2(cos(a),-sin(a),sin(a),cos(a));
        vec3 q = d; q.xz = rot*q.xz;
        float c = vn(q*7.0)*0.65 + vn(q*15.0)*0.35;
        float sh = smoothstep(0.62, 0.74, c);
        shade *= 1.0 - 0.16*sh;
        vec3 col = vCol * shade;
        // gouache tone wash (soft, low frequency) + pencil-tick grass near the camera
        col *= 0.95 + 0.1 * vn(vLocal * 0.12);
        vec3 an = abs(normalize(vLocal));
        vec2 uv = an.x > an.y && an.x > an.z ? vLocal.yz : an.y > an.z ? vLocal.xz : vLocal.xy;
        uv *= 6.0; vec2 cell = floor(uv), f = fract(uv) - 0.5;
        float r = h3(vec3(cell, 7.0)), ang = (r - 0.5) * 0.9;
        f += (vec2(h3(vec3(cell, 1.0)), h3(vec3(cell, 2.0))) - 0.5) * 0.5;
        vec2 rf = mat2(cos(ang), -sin(ang), sin(ang), cos(ang)) * f;
        float tick = step(abs(rf.x), 0.022) * step(abs(rf.y), 0.16) * step(0.35, r);
        float near = 1.0 - smoothstep(6.0, 30.0, vDist);
        float green = step(vCol.r, vCol.g * 0.95);      // ticks only on vegetation
        col *= 1.0 - 0.22 * tick * near * green;
        // restrained palette: pull 14% toward a warm grey of equal luminance
        float lum = dot(col, vec3(0.299, 0.587, 0.114));
        col = mix(col, vec3(lum) * vec3(1.04, 1.0, 0.92), 0.14);
        // water: slow posterised swell bands (no glitter)
        float water = step(vCol.r * 1.15, vCol.b) * 1.0;
        float sw = step(0.82, sin(dot(vLocal, vec3(0.31, 0.12, 0.27)) * 0.35 + uTime * 0.5) * sin(dot(vLocal, vec3(-0.2, 0.3, 0.1)) * 0.23 - uTime * 0.3));
        col = mix(col, col * 1.05 + 0.015, sw * water);
        // paper grain
        float g = h3(vec3(gl_FragCoord.xy*0.7, 3.1)) - 0.5;
        col *= 1.0 + g*0.05;
        col = mix(col, uPaper, uFog * smoothstep(20.0, 260.0, vDist));
        gl_FragColor = vec4(col, 1.0);
        #include <colorspace_fragment>
      }`,
  });
}

// ---------- cube-sphere quadtree LOD ----------
const FACES = [
  [new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 0, -1), new THREE.Vector3(0, 1, 0)],
  [new THREE.Vector3(-1, 0, 0), new THREE.Vector3(0, 0, 1), new THREE.Vector3(0, 1, 0)],
  [new THREE.Vector3(0, 1, 0), new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 0, -1)],
  [new THREE.Vector3(0, -1, 0), new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 0, 1)],
  [new THREE.Vector3(0, 0, 1), new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 1, 0)],
  [new THREE.Vector3(0, 0, -1), new THREE.Vector3(-1, 0, 0), new THREE.Vector3(0, 1, 0)],
];
function cubeDir(face, u, v, out) {               // u,v in [-1,1], tangent-warped for even cells
  const [n, a, b] = FACES[face];
  const tu = Math.tan(u * Math.PI / 4), tv = Math.tan(v * Math.PI / 4);
  return out.set(n.x + a.x * tu + b.x * tv, n.y + a.y * tu + b.y * tv, n.z + a.z * tu + b.z * tv).normalize();
}

export class PlanetLOD {
  constructor(parent, { segments = 24, maxLevel = 9, minLevel = 3, splitFactor = 2.4, buildBudget = 40 } = {}) {
    this.group = new THREE.Group(); parent.add(this.group);
    this.material = makeTerrainMaterial();
    this.N = segments; this.minLevel = minLevel; this.maxLevel = maxLevel; this.splitFactor = splitFactor; this.buildBudget = buildBudget;
    this.cache = new Map();   // key -> {mesh, center, radius, lastUsed}
    this.frame = 0; this.stats = { leaves: 0, built: 0, cached: 0 };
    this.roots = [0, 1, 2, 3, 4, 5].map(f => ({ face: f, u: -1, v: -1, s: 2, level: 0 }));
  }
  key(n) { return `${n.face}/${n.level}/${n.u.toFixed(6)}/${n.v.toFixed(6)}`; }
  build(n) {
    const N = this.N, G = N + 3, pos = new Float32Array(G * G * 3), col = new Float32Array(G * G * 3);
    const d = new THREE.Vector3(), c = new THREE.Color();
    const arcSize = (n.s / 2) * (Math.PI / 2) * R, skirt = arcSize * 0.03 + 0.3;
    for (let j = 0; j < G; j++) for (let i = 0; i < G; i++) {
      const ii = Math.min(N, Math.max(0, i - 1)), jj = Math.min(N, Math.max(0, j - 1));
      cubeDir(n.face, n.u + n.s * ii / N, n.v + n.s * jj / N, d);
      const t = terrainRaw(d);
      biomeColor(d, t, c);
      const r = R + Math.max(t.h, SEA);
      const k = (j * G + i) * 3;
      pos[k] = d.x * r; pos[k + 1] = d.y * r; pos[k + 2] = d.z * r;
      col[k] = c.r; col[k + 1] = c.g; col[k + 2] = c.b;
    }
    const idx = [];
    for (let j = 0; j < G - 1; j++) for (let i = 0; i < G - 1; i++) {
      const a = j * G + i, b = a + 1, e = a + G, f = e + 1;
      idx.push(a, b, f, a, f, e);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    g.setIndex(idx); g.computeVertexNormals();
    // drop the outer ring into a skirt *after* normals so chunk seams don't shade as grooves
    for (let j = 0; j < G; j++) for (let i = 0; i < G; i++) if (i === 0 || j === 0 || i === G - 1 || j === G - 1) {
      const k = (j * G + i) * 3, l = Math.hypot(pos[k], pos[k + 1], pos[k + 2]), f = (l - skirt) / l;
      pos[k] *= f; pos[k + 1] *= f; pos[k + 2] *= f;
    }
    g.computeBoundingSphere();
    const mesh = new THREE.Mesh(g, this.material); mesh.matrixAutoUpdate = false; mesh.visible = false;
    this.group.add(mesh);
    const center = cubeDir(n.face, n.u + n.s / 2, n.v + n.s / 2, new THREE.Vector3()).multiplyScalar(R);
    this.stats.built++;
    return { mesh, center, arc: arcSize, lastUsed: this.frame };
  }
  get(n, allowBuild) {
    const k = this.key(n); let e = this.cache.get(k);
    if (!e && allowBuild && this.budget > 0) { this.budget--; e = this.build(n); this.cache.set(k, e); }
    return e;
  }
  /** camLocal: camera position in planet-local space */
  update(camLocal) {
    this.frame++; this.budget = this.buildBudget; let leaves = 0;
    for (const e of this.cache.values()) e.mesh.visible = false;
    const visit = (n) => {
      const e = this.get(n, true); if (!e) return false;
      e.lastUsed = this.frame;
      const dist = camLocal.distanceTo(e.center);
      if (n.level < this.minLevel || (n.level < this.maxLevel && dist < e.arc * this.splitFactor)) {
        const h = n.s / 2, kids = [
          { face: n.face, u: n.u, v: n.v, s: h, level: n.level + 1 }, { face: n.face, u: n.u + h, v: n.v, s: h, level: n.level + 1 },
          { face: n.face, u: n.u, v: n.v + h, s: h, level: n.level + 1 }, { face: n.face, u: n.u + h, v: n.v + h, s: h, level: n.level + 1 }];
        const ready = kids.map(k => this.get(k, true));
        if (ready.every(Boolean)) { kids.forEach(visit); return true; }
      }
      e.mesh.visible = true; leaves++; return true;
    };
    this.roots.forEach(visit);
    // evict chunks unused for a while
    if (this.frame % 60 === 0) for (const [k, e] of this.cache) if (this.frame - e.lastUsed > 240) {
      e.mesh.geometry.dispose(); this.group.remove(e.mesh); this.cache.delete(k);
    }
    this.stats.leaves = leaves; this.stats.cached = this.cache.size;
  }
  setTime(t) { this.material.uniforms.uTime.value = t; }
}

// ---------- region streaming ----------
export class RegionStreamer {
  constructor({ radius = R, loadRadius = 300, unloadRadius = 500 } = {}) {
    this.R = radius; this.loadRadius = loadRadius; this.unloadRadius = unloadRadius;
    this.regions = new Map(); this.listeners = { load: [], unload: [] };
  }
  /** register({id, centerDir, loadRadius?, unloadRadius?, onLoad?, onUnload?}) */
  register(r) { this.regions.set(r.id, { loadRadius: this.loadRadius, unloadRadius: this.unloadRadius, ...r, loaded: false, distance: Infinity }); return this; }
  on(evt, fn) { this.listeners[evt].push(fn); return this; }
  /** distance from a planet-local point to a region centre: surface arc combined with altitude */
  distanceTo(r, p) {
    const len = p.length(), alt = Math.max(0, len - this.R);
    const arc = this.R * Math.acos(Math.min(1, Math.max(-1, p.dot(r.centerDir) / len)));
    return Math.hypot(arc, alt);
  }
  update(pLocal) {
    for (const r of this.regions.values()) {
      const d = r.distance = this.distanceTo(r, pLocal);
      if (!r.loaded && d < r.loadRadius) { r.loaded = true; r.onLoad?.(r); this.listeners.load.forEach(f => f(r)); }
      else if (r.loaded && d > r.unloadRadius) { r.loaded = false; r.onUnload?.(r); this.listeners.unload.forEach(f => f(r)); }
    }
  }
  loaded() { return [...this.regions.values()].filter(r => r.loaded).map(r => r.id); }
}

// ---------- clouds, moon + hare ----------
function clay(color) { return new THREE.MeshLambertMaterial({ color }); }
// flat painted cloud: canvas gouache shape (2 posterised bands + paper grain), laid tangent to the sphere
function paintCloudTex(rng, shadow) {
  const W = 256, H = 128, c = document.createElement('canvas'); c.width = W; c.height = H;
  const x = c.getContext('2d'), blobs = [];
  const n = 5 + Math.floor(rng() * 4);
  for (let i = 0; i < n; i++) blobs.push([40 + (i / (n - 1)) * 176 + (rng() - 0.5) * 16, 66 + (rng() - 0.5) * 18, 20 + rng() * 22]);
  const fill = (col, dx, dy, k) => { x.fillStyle = col; x.beginPath(); for (const [bx, by, br] of blobs) { x.moveTo(bx + dx + br * k, by + dy); x.arc(bx + dx, by + dy, br * k, 0, 6.2832); } x.fill(); };
  if (shadow) { x.filter = 'blur(6px)'; fill('rgba(70,74,60,1)', 0, 0, 1); x.filter = 'none'; }
  else { fill('#c4bfb0', 0, 4, 1); fill('#ddd7c8', -3, -3, 0.86); }
  // paper grain / dry-brush speckle, alpha preserved
  const img = x.getImageData(0, 0, W, H), d = img.data;
  for (let i = 0; i < d.length; i += 4) { if (!d[i + 3]) continue; const g = (Math.random() - 0.5) * 14; d[i] += g; d[i + 1] += g; d[i + 2] += g;
    if (!shadow && d[i + 3] < 255) d[i + 3] = Math.random() < d[i + 3] / 255 ? 255 : 0; }
  x.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function makeCloud(rng) {
  const g = new THREE.Group(), seed = rng();
  const r1 = () => rng(); const geo = new THREE.PlaneGeometry(110, 55); geo.rotateX(-Math.PI / 2);
  const s0 = s => { let k = Math.floor(seed * 1e6) + s; return () => (k = (k * 16807) % 2147483647) / 2147483647; };
  const top = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: paintCloudTex(s0(1), false), transparent: true, alphaTest: 0.5, opacity: 0.82, side: THREE.DoubleSide, fog: false }));
  top.rotation.y = r1() * 6.28; g.add(top);
  const sh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: paintCloudTex(s0(1), true), transparent: true, opacity: 0.24, depthWrite: false, fog: false }));
  sh.rotation.y = top.rotation.y; sh.renderOrder = 1; g.add(sh); g.userData.shadow = sh;
  return g;
}
function makeMoonWithHare() {
  const g = new THREE.Group();
  const moon = new THREE.Mesh(new THREE.SphereGeometry(28, 40, 28), clay('#b9b2a3')); g.add(moon);
  const hare = new THREE.Group(), w = clay('#faf8f2'), pink = clay('#e6c9c0');
  const body = new THREE.Mesh(new THREE.SphereGeometry(1.6, 16, 12), w); body.scale.set(1.25, 1, 0.95); body.position.y = 1.3; hare.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.95, 16, 12), w); head.position.set(1.5, 2.4, 0); hare.add(head);
  for (const z of [-0.35, 0.35]) {
    const ear = new THREE.Mesh(new THREE.CapsuleGeometry(0.22, 1.5, 4, 8), w); ear.position.set(1.25, 3.7, z); ear.rotation.z = 0.25; ear.rotation.x = z * 0.4; hare.add(ear);
    const inner = new THREE.Mesh(new THREE.CapsuleGeometry(0.1, 1.1, 3, 6), pink); inner.position.set(1.36, 3.7, z * 1.05); inner.rotation.copy(ear.rotation); hare.add(inner);
  }
  const tail = new THREE.Mesh(new THREE.SphereGeometry(0.45, 10, 8), w); tail.position.set(-1.9, 1.5, 0); hare.add(tail);
  hare.position.y = 26.5; hare.scale.setScalar(4.2); g.add(hare);
  g.userData.hare = hare;
  return g;
}

/** createPlanet(scene) -> { group, lod, streamer, moon, clouds, update(dt, camera), localOf(worldVec) } */
export function createPlanet(scene, opts = {}) {
  const group = new THREE.Group(); group.name = 'FoldPlanet'; scene.add(group);
  const lod = new PlanetLOD(group, opts.lod);
  const streamer = new RegionStreamer();
  REGIONS.forEach(r => streamer.register({ ...r }));

  scene.add(new THREE.HemisphereLight('#f3eee2', '#8a8676', 1.6));
  const sun = new THREE.DirectionalLight('#fff6e6', 1.6); sun.position.copy(SUN).multiplyScalar(2000); scene.add(sun);

  let s = 7; const rng = () => (s = (s * 16807) % 2147483647) / 2147483647;
  const clouds = new THREE.Group(); group.add(clouds);
  for (let i = 0; i < 9; i++) {
    const c = makeCloud(rng), d = new THREE.Vector3(rng() - 0.5, (rng() - 0.5) * 1.4, rng() - 0.5).normalize();
    c.position.copy(d).multiplyScalar(R + 70 + rng() * 25); c.scale.setScalar(1.8 + rng());
    c.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d); clouds.add(c);
    // faint painted shadow laid on the ground just under the cloud (offset slightly away from the sun)
    const gh = R + Math.max(0, terrainHeight(d)) + 0.6, alt = c.position.length();
    c.userData.shadow.position.set(0, (gh - alt) / c.scale.x, 0);
  }
  const moonPivot = new THREE.Group(); scene.add(moonPivot);
  const moon = makeMoonWithHare(); moon.position.set(1150, 260, -300); moonPivot.add(moon);

  const inv = new THREE.Matrix4(), tmp = new THREE.Vector3();
  let time = 0;
  const api = {
    group, lod, streamer, moon, clouds, spin: 0.012,
    localOf(v, out = new THREE.Vector3()) { inv.copy(group.matrixWorld).invert(); return out.copy(v).applyMatrix4(inv); },
    update(dt, camera) {
      time += dt;
      group.rotation.y += api.spin * dt;
      clouds.rotation.y += 0.004 * dt;
      moonPivot.rotation.y += 0.02 * dt;
      moon.userData.hare.rotation.y = Math.sin(time * 0.3) * 0.6;
      group.updateMatrixWorld(true);
      api.localOf(camera.getWorldPosition(tmp), tmp);
      lod.setTime(time); lod.update(tmp); streamer.update(tmp);
    },
  };
  return api;
}
