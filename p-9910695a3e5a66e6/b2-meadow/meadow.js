// 褶星 Fold — region 01 起点牧野 (sheep meadow) on the R=600 planet.
// Exports createMeadow(scene, planet, centerDir) -> { update(dt, time, catPos), heightAt(pos), project(pos), sheep, baseColor }
import * as THREE from '../shared/vendor/three.module.js';

export const MEADOW_COL = {
  base: '#97a85a',   // colour the patch dissolves into — paint the rest of the planet this colour to merge seamlessly
  light: '#a2ad5c', bright: '#8aa04a', dark: '#7f9550', wheat: '#c4a95e', path: '#d9c39a',
  hedge: '#566f38', paper: '#ece5d8',
};

function mulberry(a){ return function(){ a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

// ---------- value noise ----------
const perm = new Uint8Array(512); { const r = mulberry(7); for (let i = 0; i < 256; i++) perm[i] = i; for (let i = 255; i > 0; i--){ const j = (r() * (i + 1)) | 0; [perm[i], perm[j]] = [perm[j], perm[i]]; } for (let i = 0; i < 256; i++) perm[i + 256] = perm[i]; }
function vnoise(x, y){ const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi; const h = (a, b) => perm[(perm[a & 255] + b) & 255] / 255;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  return (h(xi, yi) * (1 - u) + h(xi + 1, yi) * u) * (1 - v) + (h(xi, yi + 1) * (1 - u) + h(xi + 1, yi + 1) * u) * v; }
const fbm = (x, y) => vnoise(x, y) * 0.55 + vnoise(x * 2.1, y * 2.1) * 0.3 + vnoise(x * 4.3, y * 4.3) * 0.15;

const PATCH = 96;        // metres covered by the painted texture (field core ~60 m, the rest dissolves)
const CORE = 30;         // half-size of the sheep paddock
const TEXN = 2048;

// ---------- painted ground (port of designer's paintGround, simplified) ----------
export function paintGround(rand){
  const cv = document.createElement('canvas'); cv.width = cv.height = TEXN; const g = cv.getContext('2d');
  const s = TEXN / PATCH;                                  // px per metre
  const P = (u, v) => [(u / PATCH + 0.5) * TEXN, (v / PATCH + 0.5) * TEXN];
  const R = (a, b) => a + rand() * (b - a);
  g.fillStyle = MEADOW_COL.light; g.fillRect(0, 0, TEXN, TEXN);

  // patchwork fields: jittered grid of quads, shared vertices so hedges line up
  const N = 5, step = 120 / N, verts = [];
  for (let j = 0; j <= N; j++){ verts[j] = []; for (let i = 0; i <= N; i++){
    const edge = i === 0 || j === 0 || i === N || j === N;
    verts[j][i] = [-60 + i * step + (edge ? 0 : R(-6, 6)), -60 + j * step + (edge ? 0 : R(-6, 6))]; } }
  const fieldCols = [MEADOW_COL.bright, MEADOW_COL.dark, MEADOW_COL.light, '#929f55', MEADOW_COL.wheat, '#7d9446'];
  const fields = [];
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++){
    const q = [verts[j][i], verts[j][i + 1], verts[j + 1][i + 1], verts[j + 1][i]];
    const cx = (q[0][0] + q[2][0]) / 2, cz = (q[0][1] + q[2][1]) / 2;
    let col = fieldCols[(rand() * fieldCols.length) | 0];
    if (Math.hypot(cx, cz) < 14) col = MEADOW_COL.bright;           // home paddock lush
    if (col === MEADOW_COL.wheat && Math.hypot(cx, cz) < 26) col = MEADOW_COL.dark;
    fields.push({ q, col });
    g.save(); g.filter = `blur(${3 * s / 21}px)`; g.fillStyle = col; g.beginPath();
    q.forEach(([u, v], k) => { const [x, y] = P(u, v); k ? g.lineTo(x, y) : g.moveTo(x, y); }); g.closePath(); g.fill(); g.restore();
    // soft gouache banding inside each field: two lighter/darker sweeps
    for (let b = 0; b < 3; b++){ const [x, y] = P(cx + R(-8, 8), cz + R(-8, 8)); const r = R(5, 11) * s;
      const gr = g.createRadialGradient(x, y, 0, x, y, r); const c = rand() < 0.5 ? '255,250,200' : '40,80,20';
      gr.addColorStop(0, `rgba(${c},${R(0.05, 0.12).toFixed(3)})`); gr.addColorStop(1, `rgba(${c},0)`); g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2); }
    // wheat fields get ploughed stripes
    if (col === MEADOW_COL.wheat){ g.save(); g.beginPath(); q.forEach(([u, v], k) => { const [x, y] = P(u, v); k ? g.lineTo(x, y) : g.moveTo(x, y); }); g.clip();
      g.strokeStyle = 'rgba(150,120,50,.18)'; g.lineWidth = 0.25 * s; const a = R(0, Math.PI);
      for (let k = -40; k < 40; k++){ const [x, y] = P(cx + Math.cos(a + 1.57) * k * 0.8, cz + Math.sin(a + 1.57) * k * 0.8); g.beginPath(); g.moveTo(x - Math.cos(a) * 30 * s, y - Math.sin(a) * 30 * s); g.lineTo(x + Math.cos(a) * 30 * s, y + Math.sin(a) * 30 * s); g.stroke(); }
      g.restore(); }
  }
  // worn footpath through the meadow
  g.save(); g.strokeStyle = MEADOW_COL.path; g.globalAlpha = 0.75; g.lineCap = 'round'; g.lineWidth = 1.1 * s; g.filter = `blur(${0.25 * s}px)`;
  g.beginPath(); for (let k = 0; k <= 40; k++){ const t = k / 40, u = -50 + t * 100, v = Math.sin(t * 5.2) * 9 + t * 6 - 8; const [x, y] = P(u, v); k ? g.lineTo(x, y) : g.moveTo(x, y); } g.stroke(); g.restore();

  // hedgerows along field borders (painted; 3D lumps added separately) — skip some edges for gaps
  const hedges = [];
  for (let j = 0; j <= N; j++) for (let i = 0; i < N; i++) if (rand() < 0.55) hedges.push([verts[j][i], verts[j][i + 1]]);
  for (let j = 0; j < N; j++) for (let i = 0; i <= N; i++) if (rand() < 0.55) hedges.push([verts[j][i], verts[j + 1][i]]);
  for (const [[u0, v0], [u1, v1]] of hedges){
    const n = Math.ceil(Math.hypot(u1 - u0, v1 - v0) / 0.12);
    for (let k = 0; k < n; k++){ const t = k / n, w = 0.55 + 0.35 * vnoise(u0 * 3 + t * 9, v0); const [x, y] = P(u0 + (u1 - u0) * t + R(-.15, .15), v0 + (v1 - v0) * t + R(-.15, .15));
      g.fillStyle = 'rgba(40,70,25,.35)'; g.beginPath(); g.arc(x + 0.35 * s, y + 0.45 * s, w * s, 0, 7); g.fill();       // shadow side
      g.fillStyle = MEADOW_COL.hedge; g.beginPath(); g.arc(x, y, w * s * 0.9, 0, 7); g.fill(); }
    for (let k = 0; k < n * 0.8; k++){ const t = rand(); const [x, y] = P(u0 + (u1 - u0) * t + R(-.5, .5), v0 + (v1 - v0) * t + R(-.5, .5));
      g.fillStyle = rand() < 0.5 ? 'rgba(35,80,20,.3)' : 'rgba(110,160,60,.28)'; g.beginPath(); g.arc(x, y, R(1, 2.4) * s / 21, 0, 7); g.fill(); }
  }
  // pencil-tick grass
  const NT = 90000;
  for (let k = 0; k < NT; k++){ const x = rand() * TEXN, y = rand() * TEXN, l = R(3, 7) * s / 21, a = -1.57 + R(-0.5, 0.5);
    g.strokeStyle = rand() < 0.7 ? `rgba(55,95,30,${R(0.12, 0.3).toFixed(2)})` : `rgba(215,235,150,${R(0.12, 0.3).toFixed(2)})`;
    g.lineWidth = R(0.8, 1.5); g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke(); }
  // a few tiny flower dots (cream / pale yellow) near the paddock
  for (let k = 0; k < 2500; k++){ const r = Math.sqrt(rand()) * 40, a = rand() * 6.283; const [x, y] = P(Math.cos(a) * r, Math.sin(a) * r);
    g.fillStyle = rand() < 0.6 ? 'rgba(251,243,223,.8)' : 'rgba(232,205,110,.8)'; g.beginPath(); g.arc(x, y, R(1, 2), 0, 7); g.fill(); }

  // paper grain + dithered dissolve into planet base colour (no sticker edge)
  const id = g.getImageData(0, 0, TEXN, TEXN), d = id.data, base = new THREE.Color(MEADOW_COL.base);
  const bh = base.getHex(THREE.SRGBColorSpace), br = bh >> 16 & 255, bg = bh >> 8 & 255, bb = bh & 255;   // sRGB bytes (Color stores linear)
  for (let y = 0; y < TEXN; y++){ const v = (y / TEXN - 0.5) * PATCH;
    for (let x = 0; x < TEXN; x++){ const u = (x / TEXN - 0.5) * PATCH, i = (y * TEXN + x) * 4;
      const grain = ((perm[(x * 7 + perm[y & 255]) & 255] / 255) - 0.5) * 10;
      const r = Math.max(Math.abs(u), Math.abs(v)) * 0.55 + Math.hypot(u, v) * 0.45;
      const edge = (r - 34) / 12 + (fbm(u * 0.12, v * 0.12) - 0.5) * 1.6;      // 0 → inside, 1 → fully base
      const dither = (perm[(x + perm[(y * 3) & 255]) & 255] / 255) * 0.35;
      let k = Math.min(1, Math.max(0, edge + dither - 0.17));
      d[i] = d[i] * (1 - k) + br * k + grain; d[i + 1] = d[i + 1] * (1 - k) + bg * k + grain; d[i + 2] = d[i + 2] * (1 - k) + bb * k + grain * 0.8; } }
  g.putImageData(id, 0, 0);
  return { canvas: cv, hedges, fields };
}

// m-loop bake (17:10, json-only 18:12): what paintGround feeds the rest of createMeadow is pre-baked by game/bake_meadow.html into
// game/baked/meadow_ground_2048.json (hedges + rand count). Only for callers that hide the ground mesh (game/regions/meadow.js does).
// MEADOW_PAINT_V hashes every input of the paint (its code, the noise tables, colours, sizes), so editing any of them makes an old
// bake stale and the live paint runs again. The bake stores how many rand() calls the paint used, so the stream stays identical.
const fnv = (str) => { let h = 0x811c9dc5; for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 0x01000193); return (h >>> 0).toString(16).padStart(8, '0'); };
export const MEADOW_PAINT_V = fnv([paintGround, vnoise, fbm, mulberry].map(String).join('\n') + perm.join() + JSON.stringify(MEADOW_COL) + `|${TEXN}|${PATCH}`);
export function bakeMeadowGround(seed = 2401){ const r = mulberry(seed); let n = 0; const g = paintGround(() => (n++, r())); return { ...g, randCalls: n, seed, v: MEADOW_PAINT_V, TEXN, PATCH }; }

// ---------- sheep (clay meshes, designer's graze/idle/walk state machine) ----------
function blob(r, detail, jitter, seed){ const g = new THREE.IcosahedronGeometry(r, detail); const p = g.attributes.position, v = new THREE.Vector3(), rr = mulberry(seed);
  const cache = new Map();
  for (let i = 0; i < p.count; i++){ v.fromBufferAttribute(p, i); const key = v.toArray().map(x => x.toFixed(3)).join(); let f = cache.get(key); if (f === undefined){ f = 1 + (rr() - 0.5) * jitter; cache.set(key, f); } v.multiplyScalar(f); p.setXYZ(i, v.x, v.y, v.z); }
  const nrm = g.attributes.normal; for (let i = 0; i < p.count; i++){ v.fromBufferAttribute(p, i).normalize(); nrm.setXYZ(i, v.x, v.y, v.z); } return g; }   // soft clay normals

const woolMat = new THREE.MeshLambertMaterial({ color: 0xf1ebdf });
const faceMat = new THREE.MeshLambertMaterial({ color: 0x3b3430 });
const WOOL = [0, 1, 2, 3].map(k => blob(0.32, 2, 0.28, 11 + k).scale(1.35, 0.95, 0.95));
const legGeo = new THREE.CylinderGeometry(0.035, 0.03, 0.3, 6).translate(0, -0.15, 0);

class Sheep {
  constructor(m, u, v, rand){
    this.m = m; this.rand = rand; this.u = u; this.v = v;
    this.root = new THREE.Group(); this.body = new THREE.Group(); this.root.add(this.body);
    const wool = new THREE.Mesh(WOOL[(rand() * 4) | 0], woolMat); wool.position.y = 0.42; this.body.add(wool);
    this.neck = new THREE.Group(); this.neck.position.set(0.4, 0.5, 0); this.body.add(this.neck);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.1, 12, 8).scale(1.35, 0.95, 0.85), faceMat); head.position.set(0.08, -0.02, 0); this.neck.add(head);
    for (const sd of [-1, 1]){ const ear = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 5).scale(1.2, 0.35, 0.55), faceMat); ear.position.set(0.04, 0.04, sd * 0.1); ear.rotation.x = sd * 0.5; this.neck.add(ear); }
    const tuft = new THREE.Mesh(blob(0.07, 1, 0.3, 5), woolMat); tuft.position.set(0.03, 0.08, 0); this.neck.add(tuft);
    this.legs = [];
    for (const [lx, lz] of [[0.22, 0.12], [0.22, -0.12], [-0.22, 0.12], [-0.22, -0.12]]){ const l = new THREE.Mesh(legGeo, faceMat); l.position.set(lx, 0.3, lz); this.body.add(l); this.legs.push(l); }
    this.root.traverse(o => { if (o.isMesh) o.castShadow = true; });
    this.size = 0.9 + rand() * 0.2; this.root.scale.setScalar(this.size);
    this.heading = rand() * 6.283; this.targetHeading = this.heading;
    this.state = rand() < 0.7 ? 'graze' : 'idle'; this.t = 2 + rand() * 8; this.phase = rand() * 10;
    this.speed = 0; this.goal = null; this.headPitch = 0; this.gait = 0; this.lookYaw = 0; this.flee = 0;
  }
  pickGoal(r0, r1, flock){
    let best = null, bs = -1e9;
    for (let k = 0; k < 10; k++){ const a = this.rand() * 6.283, r = r0 + this.rand() * (r1 - r0), gu = this.u + Math.cos(a) * r, gv = this.v + Math.sin(a) * r;
      if (Math.abs(gu) > CORE - 2 || Math.abs(gv) > CORE - 2) continue;
      let crowd = 0; for (const o of flock) if (o !== this){ const dd = Math.hypot(o.u - gu, o.v - gv); if (dd < 1.6) crowd += 1; else if (dd < 7) crowd -= 0.1; }
      const sc = -crowd - Math.abs(angDiff(Math.atan2(gv - this.v, gu - this.u), this.heading)) * 0.3 + this.rand() * 0.6 - Math.hypot(gu, gv) * 0.02;
      if (sc > bs){ bs = sc; best = [gu, gv]; } }
    return best;
  }
  update(dt, time, flock, cat){
    // cat proximity → gently move away
    let fu = 0, fv = 0;
    if (cat){ const du = this.u - cat[0], dv = this.v - cat[1], d = Math.hypot(du, dv);
      if (d < 4.5 && d > 1e-3){ const k = (4.5 - d) / 4.5; fu = du / d * k; fv = dv / d * k; this.flee = Math.max(this.flee, k); }
      if (d < 7) this.lookYaw = THREE.MathUtils.clamp(angDiff(Math.atan2(-dv, -du), this.heading), -0.8, 0.8); }
    this.flee = Math.max(0, this.flee - dt * 0.4);
    this.t -= dt;
    if (this.flee > 0.15){ this.state = 'walk'; this.goal = null; this.t = 3 + this.rand() * 3; }
    else if (this.state === 'walk'){
      if (!this.goal) this.goal = this.pickGoal(2, 6, flock);
      if (!this.goal || Math.hypot(this.goal[0] - this.u, this.goal[1] - this.v) < 0.4){ this.goal = null; this.state = this.rand() < 0.75 ? 'graze' : 'idle'; this.t = this.state === 'graze' ? 5 + this.rand() * 9 : 1.5 + this.rand() * 2.5; }
    } else if (this.t < 0){
      this.state = this.state === 'graze' ? (this.rand() < 0.35 ? 'idle' : 'walk') : (this.rand() < 0.55 ? 'walk' : 'graze');
      this.t = 1.5 + this.rand() * 6; this.goal = null;
    }
    let want = 0;
    if (this.flee > 0.15){ want = 0.55 + this.flee * 0.9; this.targetHeading = Math.atan2(fv + this.vsin() * 0.2, fu + this.vcos() * 0.2); }
    else if (this.state === 'walk' && this.goal){ want = 0.6; this.targetHeading = Math.atan2(this.goal[1] - this.v, this.goal[0] - this.u); }
    else if (this.state === 'graze'){ want = Math.sin(this.phase * 0.31 + time * 0.23) > 0.65 ? 0.08 : 0; if (this.rand() < dt * 0.12) this.targetHeading = this.heading + (this.rand() - 0.5) * 1.4; }
    // separation + keep inside paddock
    let au = 0, av = 0;
    for (const o of flock){ if (o === this) continue; const du = this.u - o.u, dv = this.v - o.v, d = Math.hypot(du, dv); if (d < 1.1 && d > 1e-4){ const f = (1.1 - d); au += du / d * f; av += dv / d * f; } }
    const lim = CORE - 1; if (Math.abs(this.u) > lim) au -= Math.sign(this.u) * (Math.abs(this.u) - lim); if (Math.abs(this.v) > lim) av -= Math.sign(this.v) * (Math.abs(this.v) - lim);
    this.heading += angDiff(this.targetHeading, this.heading) * Math.min(1, dt * (this.flee > 0.15 ? 4 : 2));
    this.speed += (want - this.speed) * Math.min(1, dt * 3);
    this.u += (Math.cos(this.heading) * this.speed + au * 1.2) * dt; this.v += (Math.sin(this.heading) * this.speed + av * 1.2) * dt;
    // pose
    this.gait += dt * this.speed * 9;
    const sw = Math.sin(this.gait) * Math.min(1, this.speed * 2) * 0.5;
    this.legs[0].rotation.z = this.legs[3].rotation.z = sw; this.legs[1].rotation.z = this.legs[2].rotation.z = -sw;
    this.body.position.y = Math.abs(Math.sin(this.gait)) * 0.03 * Math.min(1, this.speed * 2);
    const pitch = this.state === 'graze' && this.flee < 0.15 ? -1.0 + Math.sin(time * 6 + this.phase) * 0.05 * (Math.sin(time * 0.7 + this.phase) > 0 ? 1 : 0) : 0.1;
    this.headPitch += (pitch - this.headPitch) * Math.min(1, dt * 3);
    this.neck.rotation.z = this.headPitch; this.neck.position.y = 0.5 + this.headPitch * 0.12;
    this.neck.rotation.y += ((this.state === 'graze' ? 0 : this.lookYaw) - this.neck.rotation.y) * Math.min(1, dt * 2);
    this.m.place(this.root, this.u, this.v, this.heading);
  }
  vcos(){ return Math.cos(this.heading); } vsin(){ return Math.sin(this.heading); }
}
function angDiff(a, b){ let d = a - b; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return d; }

// ---------- meadow ----------
export function createMeadow(scene, planet = { radius: 600 }, centerDir = new THREE.Vector3(0, 1, 0), opts = {}){
  const Rp = planet.radius ?? planet.R ?? 600;
  const rand = mulberry(opts.seed ?? 2401);
  const c = centerDir.clone().normalize();
  const e1 = new THREE.Vector3().crossVectors(Math.abs(c.y) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0), c).normalize();
  const e2 = new THREE.Vector3().crossVectors(c, e1).normalize();      // (e1, c, e2) right-handed-ish tangent frame
  const group = new THREE.Group(); group.name = 'meadow-01'; scene.add(group);

  // gentle undulation (metres above the sphere), fades to 0 at the edge so it meets the bare planet
  const relief = (u, v) => { const r = Math.hypot(u, v), f = THREE.MathUtils.smoothstep(PATCH / 2 - r, 0, 10);
    return 0.12 * THREE.MathUtils.smoothstep(PATCH / 2 - Math.max(Math.abs(u), Math.abs(v)), 0, 4) + f * (fbm(u * 0.04 + 3, v * 0.04) * 1.6 + (Math.sin(u * 0.11) * Math.cos(v * 0.09) + 1) * 0.2); };   // always above the bare sphere
  const dirOf = (u, v, out = new THREE.Vector3()) => out.copy(c).multiplyScalar(Rp).addScaledVector(e1, u).addScaledVector(e2, v).normalize();
  const toWorld = (u, v, h = 0, out = new THREE.Vector3()) => dirOf(u, v, out).multiplyScalar(Rp + relief(u, v) + h);
  const project = (p) => { const k = Rp / Math.max(1e-6, p.dot(c)); return [p.dot(e1) * k, p.dot(e2) * k]; };   // gnomonic (u, v)
  const heightAt = (p) => { const [u, v] = project(p); return Rp + (Math.abs(u) < PATCH / 2 && Math.abs(v) < PATCH / 2 ? relief(u, v) : 0); };   // radius of the ground under p

  // ground mesh
  const bk = opts.baked?.json, groundBaked = !!(bk && bk.v === MEADOW_PAINT_V && bk.seed === (opts.seed ?? 2401) && bk.TEXN === TEXN);
  let canvas, hedges; if (groundBaked){ hedges = bk.hedges; for (let i = 0; i < bk.randCalls; i++) rand();   // fresh bake: same hedges, same rand stream
    // json-only bake: the game hides this ground mesh (the board paints the meadow), so a flat 1-px swatch stands in for the painted texture
    canvas = document.createElement('canvas'); canvas.width = canvas.height = 1; const g1 = canvas.getContext('2d'); g1.fillStyle = MEADOW_COL.light; g1.fillRect(0, 0, 1, 1); }
  else ({ canvas, hedges } = paintGround(rand));
  const tex = new THREE.CanvasTexture(canvas); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
  const NSEG = 160, pos = [], uv = [], idx = [], tmp = new THREE.Vector3();
  for (let j = 0; j <= NSEG; j++) for (let i = 0; i <= NSEG; i++){ const u = (i / NSEG - 0.5) * PATCH, v = (j / NSEG - 0.5) * PATCH;
    toWorld(u, v, 0, tmp); pos.push(tmp.x, tmp.y, tmp.z); uv.push(i / NSEG, 1 - j / NSEG); }
  for (let j = 0; j < NSEG; j++) for (let i = 0; i < NSEG; i++){ const a = j * (NSEG + 1) + i, b = a + 1, d = a + NSEG + 1, e = d + 1; idx.push(a, d, b, b, d, e); }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); geo.setIndex(idx); geo.computeVertexNormals();
  // keep winding facing outward
  { const n = geo.attributes.normal; tmp.fromBufferAttribute(n, 0); if (tmp.dot(c) < 0){ for (let k = 0; k < idx.length; k += 3){ const t = idx[k + 1]; idx[k + 1] = idx[k + 2]; idx[k + 2] = t; } geo.setIndex(idx); geo.computeVertexNormals(); } }
  // at the rim the normals become exactly radial so lighting matches the bare planet sphere (no seam)
  { const n = geo.attributes.normal, P = geo.attributes.position, a = new THREE.Vector3(), b = new THREE.Vector3();
    for (let j = 0; j <= NSEG; j++) for (let i = 0; i <= NSEG; i++){ const k = j * (NSEG + 1) + i, e = Math.min(i, j, NSEG - i, NSEG - j) / NSEG * PATCH;
      const w = THREE.MathUtils.smoothstep(e, 0, 8); a.fromBufferAttribute(n, k); b.fromBufferAttribute(P, k).normalize(); a.lerp(b, 1 - w).normalize(); n.setXYZ(k, a.x, a.y, a.z); } }
  const ground = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ map: tex, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
  ground.receiveShadow = true; group.add(ground);

  // 3D hedgerow lumps (instanced clay blobs) along the painted hedges, only within the visible core
  const lumpGeo = blob(0.5, 1, 0.3, 99).scale(1, 0.8, 1);
  const hedgeMat = new THREE.MeshLambertMaterial({ color: 0xffffff });
  const lumps = [];
  for (const [[u0, v0], [u1, v1]] of hedges){ const n = Math.ceil(Math.hypot(u1 - u0, v1 - v0) / 0.55);
    for (let k = 0; k < n; k++){ const t = (k + rand() * 0.5) / n, u = u0 + (u1 - u0) * t, v = v0 + (v1 - v0) * t; const r = Math.hypot(u, v);
      if (r > 44 || (r > 34 && rand() < (r - 34) / 10)) continue; lumps.push([u + (rand() - .5) * .3, v + (rand() - .5) * .3, 0.55 + rand() * 0.6]); } }
  const hedgeInst = new THREE.InstancedMesh(lumpGeo, hedgeMat, lumps.length); hedgeInst.castShadow = true;
  const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), S = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0), hc = new THREE.Color();
  lumps.forEach(([u, v, s], k) => { toWorld(u, v, s * 0.25, tmp); Q.setFromUnitVectors(up, dirOf(u, v, S)); S.set(s, s * (0.8 + rand() * 0.4), s);
    M.compose(tmp, Q, S); hedgeInst.setMatrixAt(k, M); hc.set(0x617a3e).offsetHSL((rand() - .5) * 0.03, 0, (rand() - .5) * 0.08); hedgeInst.setColorAt(k, hc); });
  group.add(hedgeInst);

  // placement helper: put an object at (u,v) with heading (radians in tangent plane, 0 = +e1)
  const _q = new THREE.Quaternion(), _m = new THREE.Matrix4(), _n = new THREE.Vector3(), _f = new THREE.Vector3(), _s = new THREE.Vector3();
  const place = (obj, u, v, heading, h = 0) => {
    dirOf(u, v, _n); toWorld(u, v, h, obj.position);
    _f.copy(e1).multiplyScalar(Math.cos(heading)).addScaledVector(e2, Math.sin(heading)); _f.addScaledVector(_n, -_f.dot(_n)).normalize();
    _s.crossVectors(_f, _n);                       // local +x = forward, +y = up, +z = side
    _m.makeBasis(_f, _n, _s); obj.quaternion.setFromRotationMatrix(_m);
  };

  // flock: 3 loose groups in the home paddock
  const sheep = [];
  const ctx = { place };
  const groups = [[-8, -6], [9, 4], [-2, 14]];
  for (let k = 0; k < 14; k++){ const [gu, gv] = groups[k % 3]; const s = new Sheep(ctx, gu + (rand() - .5) * 6, gv + (rand() - .5) * 6, rand); sheep.push(s); group.add(s.root); place(s.root, s.u, s.v, s.heading); }

  function update(dt, time, catPos){
    const cat = catPos ? project(catPos) : null;
    for (const s of sheep) s.update(dt, time, sheep, cat);
  }
  return { group, ground, groundBaked, sheep, update, heightAt, project, toWorld, dirOf, frame: { c, e1, e2 }, baseColor: MEADOW_COL.base, paperColor: MEADOW_COL.paper };
}
