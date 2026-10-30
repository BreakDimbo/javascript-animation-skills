// 小站 kit: soft clay boxes + a vertex-coloured part builder (one merged mesh per rigid body). Owned by the station stream.
import * as THREE from '../../shared/vendor/three.module.js';
import { mergeGeometries } from '../../shared/vendor/BufferGeometryUtils.js';
import { mulberry } from '../../artkit/ground.js';

// soft clay box: segmented, vertices projected on a rounded-box surface (radius r)
export function softBox(w, h, d, r = Math.min(w, h, d) * 0.2){
  const g = new THREE.BoxGeometry(w, h, d, 4, 4, 4), p = g.attributes.position, v = new THREE.Vector3(), c = new THREE.Vector3();
  const hx = w / 2 - r, hy = h / 2 - r, hz = d / 2 - r;
  for (let i = 0; i < p.count; i++){ v.fromBufferAttribute(p, i); c.set(THREE.MathUtils.clamp(v.x, -hx, hx), THREE.MathUtils.clamp(v.y, -hy, hy), THREE.MathUtils.clamp(v.z, -hz, hz));
    v.sub(c); if (v.lengthSq() > 1e-12) v.setLength(r); v.add(c); p.setXYZ(i, v.x, v.y, v.z); }
  g.computeVertexNormals(); return g;
}
// a squashed, slightly lumpy sphere (hand-pressed clay)
export function lump(r, sy = 1, wob = .06, seg = 14){
  const g = new THREE.SphereGeometry(r, seg, Math.round(seg * .75)), a = g.attributes.position;
  for (let i = 0; i < a.count; i++){ const x = a.getX(i), y = a.getY(i), z = a.getZ(i), k = 1 + wob * Math.sin(x / r * 5 + y / r * 3 + 1) * Math.cos(z / r * 4);
    a.setXYZ(i, x * k, y * k * sy, z * k); }
  g.computeVertexNormals(); return g;
}
export function Builder(seed){
  const rnd = mulberry(seed), geos = [], c = new THREE.Color(), M = new THREE.Matrix4(), Q = new THREE.Quaternion(), E = new THREE.Euler(), S = new THREE.Vector3(1, 1, 1);
  const api = {
    add(geo, col, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, jit = .02){
      let g = geo.index ? geo.toNonIndexed() : geo.clone(); for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal') g.deleteAttribute(k);
      M.compose(new THREE.Vector3(x, y, z), Q.setFromEuler(E.set(rx, ry, rz)), S); g.applyMatrix4(M);
      c.set(col); c.offsetHSL((rnd() - .5) * jit * .5, (rnd() - .5) * jit * 1.5, (rnd() - .5) * jit * 2.6); // hand-mixed value drift per part
      const n = g.attributes.position.count, a = new Float32Array(n * 3); for (let i = 0; i < n; i++){ a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; }
      g.setAttribute('color', new THREE.BufferAttribute(a, 3)); geos.push(g); return api; },
    box(w, h, d, col, x, y, z, ry = 0, r, jit){ return api.add(softBox(w, h, d, r), col, x, y, z, 0, ry, 0, jit); },
    get empty(){ return geos.length === 0; },
    mesh(mat, shadow = true){ const m = new THREE.Mesh(mergeGeometries(geos), mat); m.castShadow = shadow; m.receiveShadow = true; return m; } };
  return api;
}
