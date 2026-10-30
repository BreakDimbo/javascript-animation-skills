// 海豹湾 Seal Bay — procedural seal / kayak / paddle geometry (merged, vertex-coloured), forward = +x, up = +y, right = +z.
// Everything floats at the waterline, so bodies are upper halves (open underneath, hidden by the water patch).
import * as THREE from '../../shared/vendor/three.module.js';

class Mesher { constructor(){ this.p = []; this.n = []; this.c = []; this.t = []; this.i = []; }
  vert(x, y, z, nx, ny, nz, col, tint = 0){ this.p.push(x, y, z); this.n.push(nx, ny, nz); this.c.push(col[0], col[1], col[2]); this.t.push(tint); return this.p.length / 3 - 1; }
  // loft along x: ring(t) → { x, cy, rw, rh, col(j/M), tint }; upper half sections (a ∈ [0, π]) or full rings
  loft(N, M, ring, half = true){
    const base = this.p.length / 3;
    for (let i = 0; i <= N; i++){ const r = ring(i / N);
      for (let j = 0; j <= M; j++){ const a = (half ? Math.PI : 2 * Math.PI) * j / M, ca = Math.cos(a), sa = Math.sin(a);
        let ny = sa / Math.max(r.rh, 1e-4), nz = ca / Math.max(r.rw, 1e-4), nx = r.dx || 0; const l = Math.hypot(nx, ny, nz) || 1;
        this.vert(r.x, r.cy + sa * r.rh, ca * r.rw, nx / l, ny / l, nz / l, typeof r.col === 'function' ? r.col(j / M) : r.col, r.tint || 0); } }
    for (let i = 0; i < N; i++) for (let j = 0; j < M; j++){ const a = base + i * (M + 1) + j, b = a + 1, c = a + M + 1, d = c + 1; this.i.push(a, c, d, a, d, b); }
  }
  ellipsoid(cx, cy, cz, rx, ry, rz, col, tint = 0, seg = 10){
    const base = this.p.length / 3;
    for (let i = 0; i <= seg; i++){ const th = Math.PI * i / seg; for (let j = 0; j <= seg * 2; j++){ const ph = 2 * Math.PI * j / (seg * 2);
      const x = Math.cos(th), y = Math.sin(th) * Math.cos(ph), z = Math.sin(th) * Math.sin(ph); const l = Math.hypot(x / rx, y / ry, z / rz);
      this.vert(cx + x * rx, cy + y * ry, cz + z * rz, x / rx / l, y / ry / l, z / rz / l, col, tint); } }
    for (let i = 0; i < seg; i++) for (let j = 0; j < seg * 2; j++){ const a = base + i * (seg * 2 + 1) + j, b = a + 1, c = a + seg * 2 + 1, d = c + 1; this.i.push(a, b, d, a, d, c); }
  }
  // flat leaf (flipper / blade) in the xz plane at height y: centre, half-length along dir, half-width
  leaf(cx, y, cz, dirA, len, wid, col, tint = 0, n = 8){
    const ux = Math.cos(dirA), uz = Math.sin(dirA), base = this.vert(cx, y, cz, 0, 1, 0, col, tint);
    for (let k = 0; k <= 2 * n; k++){ const a = Math.PI * 2 * k / (2 * n), s = Math.cos(a), w = Math.sin(a) * wid * Math.pow(1 - s * s, .1);
      this.vert(cx + ux * s * len - uz * w, y, cz + uz * s * len + ux * w, 0, 1, 0, col, tint); }
    for (let k = 0; k < 2 * n; k++) this.i.push(base, base + 1 + k, base + 2 + k);
  }
  geo(){ const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(this.n, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.c, 3)); g.setAttribute('aTintW', new THREE.Float32BufferAttribute(this.t, 1)); g.setIndex(this.i); return g; } }

export const SEAL_L = 0.52;
// seal from above: rounded head, a clear neck, full shoulders, long taper; two fore flippers, a fanned pair of hind flippers.
// Vertex colour: r > .9 flags the pale muzzle, .66 = lighter belly line along the waterline, .5 = slate back.
export function sealGeometry(){
  const m = new Mesher(), L = SEAL_L, body = [.5, .5, .5], belly = [.68, .68, .68], muzzle = [.95, .95, .95];
  const W = [[0, .012], [.03, .034], [.08, .047], [.14, .05], [.2, .042], [.25, .039], [.33, .062], [.42, .073], [.55, .068], [.7, .05], [.85, .03], [1, .014]];
  const wAt = (t) => { for (let i = 1; i < W.length; i++) if (t <= W[i][0]){ const u = (t - W[i - 1][0]) / (W[i][0] - W[i - 1][0]), k = .5 - .5 * Math.cos(Math.PI * u); return W[i - 1][1] * (1 - k) + W[i][1] * k; } return W[W.length - 1][1]; };
  m.loft(40, 14, (t) => { const rw = wAt(t), head = Math.exp(-Math.pow((t - .12) / .1, 2));
    return { x: L * (.5 - t), cy: -.004 + .016 * head, rw, rh: rw * (.78 + .14 * head), col: (j) => t < .06 ? muzzle : Math.abs(j - .5) > .4 ? belly : body, dx: t < .08 ? .6 : 0 }; });
  const fl = [.4, .4, .43], fl2 = [.36, .36, .4];
  for (const s of [-1, 1]){
    m.leaf(L * (.5 - .33) - .004, .008, s * .076, s * 2.2, .05, .017, fl);               // fore flippers, swept back
    m.leaf(-L * .5 - .03, .003, s * .02, Math.PI - s * .42, .05, .019, fl2); }            // hind flippers, a fan behind the tail
  const g = m.geo(); g.userData.eye = new THREE.Vector3(L * .5 - .046, .036, .021); g.userData.nose = new THREE.Vector3(L * .5 - .006, .012, 0); return g;
}
// kayak hull (pointed lens, tinted per instance, darker gunwale) + cockpit + a little seated paddler
export const KAY_L = 0.66;
export function kayakGeometry(){
  const m = new Mesher(), L = KAY_L, dark = [.11, .12, .15], white = [1, 1, 1];
  m.loft(28, 12, (t) => { const s = Math.pow(Math.sin(Math.PI * t), .78), up = Math.pow(Math.sin(Math.PI * t), .55);
    return { x: L * (.5 - t), cy: .0, rw: .062 * s + .002, rh: .03 * up + .003, col: (j) => { const e = Math.abs(j - .5) * 2; return e > .78 ? [.72, .72, .72] : e < .18 ? [1.06, 1.06, 1.06] : white; }, tint: 1 }; });
  m.ellipsoid(-.012, .03, 0, .085, .006, .036, dark, 0, 8);                                // cockpit
  // QA17 faceless matte silhouette: torso #4b4f58, buoyancy aid = hull tint x .8 (same hue/sat, 20 % darker), helmet merged into one head sphere #d9b48f (diameter .75 x torso width)
  m.ellipsoid(-.016, .052, 0, .03, .035, .04, [.294, .31, .345], 0, 9);                   // torso #4b4f58 (seated)
  m.ellipsoid(-.012, .062, 0, .033, .018, .044, [.8, .8, .8], 1, 8);                      // buoyancy aid: hull tint x .8
  m.ellipsoid(-.008, .105, 0, .03, .03, .03, [.851, .706, .561], 0, 10);                  // head #d9b48f, no face, no hair
  return m.geo();
}
// paddle along z: thin shaft + two slightly wider blades, all #5a4632
export function paddleGeometry(){
  const sh = [.353, .275, .196], bl = sh, len = .46, w = .0045, m2 = new Mesher();
  m2.loft(1, 6, (t) => ({ x: (t - .5) * len, cy: 0, rw: w, rh: w, col: sh }), false);
  for (const s of [-1, 1]) m2.leaf(s * (len / 2 - .03), 0, 0, 0, .042, .017, bl, 0, 8);
  const g = m2.geo(); g.rotateY(-Math.PI / 2); return g; // x → z
}
