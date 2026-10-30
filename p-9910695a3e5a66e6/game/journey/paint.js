// m-loop: ground paint — flat gouache washes laid on the ground (worn path, wet grass, sand, wheat, ditch water), one Lambert material
// shared by every wash. Geometry carries per-vertex core/edge colour, opacity and a normalised edge distance aE (0 inside → 1 at the rim);
// the fragment roughens the rim with low-frequency value noise (a brush edge, never a glowing or soft-airbrushed halo).
import * as THREE from '../../shared/vendor/three.module.js';
import { R } from '../core/util.js';
import { F } from '../world.js';

const NOISE = `
float lpH(vec3 p){ p = fract(p * .3183099 + .1); p *= 17.; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float lpN(vec3 x){ vec3 i = floor(x), f = fract(x); f = f * f * (3. - 2. * f);
  return mix(mix(mix(lpH(i), lpH(i + vec3(1,0,0)), f.x), mix(lpH(i + vec3(0,1,0)), lpH(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(lpH(i + vec3(0,0,1)), lpH(i + vec3(1,0,1)), f.x), mix(lpH(i + vec3(0,1,1)), lpH(i + vec3(1,1,1)), f.x), f.y), f.z); }
`;
export function paintMaterial(){
  const m = new THREE.MeshLambertMaterial({ color: 0xffffff, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 });
  m.onBeforeCompile = (s) => {
    s.vertexShader = s.vertexShader.replace('#include <common>', '#include <common>\nattribute vec3 aCol, aCol2; attribute vec2 aEO; varying vec3 vCol, vCol2; varying vec2 vEO; varying vec3 vLP;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvCol = aCol; vCol2 = aCol2; vEO = aEO; vLP = (modelMatrix * vec4(position, 1.)).xyz;');
    s.fragmentShader = s.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vCol, vCol2; varying vec2 vEO; varying vec3 vLP;' + NOISE)
      .replace('vec4 diffuseColor = vec4( diffuse, opacity );', `
        float n1 = lpN(vLP * 7.), n2 = lpN(vLP * 23. + 5.), n3 = lpN(vLP * 1.7 + 11.);
        float e = vEO.x + (n1 - .5) * .32 + (n2 - .5) * .12;
        float a = vEO.y * (1. - smoothstep(.78, .98, e)) * (.86 + .14 * n3);
        vec3 c = mix(vCol, vCol2, smoothstep(.5, .86, e)) * (1. + (n2 - .5) * .10 + (n3 - .5) * .08);
        // stay inside the painted board: the props' clip margin would let washes run out over the paper past the ground's ragged rim
        if (uBoardF.w > 0.0) a *= 1. - smoothstep(-.42, -.08, foldBoardSD(vFoldW));
        vec4 diffuseColor = vec4(c, a * opacity);`);
  };
  m.customProgramCacheKey = () => 'fold-loop-paint';
  return m;
}

// geometry accumulator: everything sits on the sphere at R + heightAt + lift
export function paintBuilder(heightAt, lift = .008){
  const pos = [], col = [], col2 = [], eo = [], idx = []; const d = new THREE.Vector3();
  const vert = (u, v, c, c2, e, o) => { F.dirOf(u, v, d); const h = R + heightAt(d) + lift; pos.push(d.x * h, d.y * h, d.z * h); col.push(...c); col2.push(...c2); eo.push(e, o); return pos.length / 3 - 1; };
  return {
    // a ribbon along pts [[u, v]] with per-point { hw, c, c2, o } (half width m, core / edge linear rgb, opacity)
    ribbon(pts, at){
      const N = 4, base = []; // across: −1 … +1 in N steps each side
      for (let i = 0; i < pts.length; i++){ const p = pts[i], q = pts[Math.min(i + 1, pts.length - 1)], r = pts[Math.max(i - 1, 0)];
        let tx = q[0] - r[0], ty = q[1] - r[1]; const tl = Math.hypot(tx, ty) || 1; tx /= tl; ty /= tl; const nx = -ty, ny = tx, A = at(i, p);
        const row = []; for (let k = -N; k <= N; k++){ const f = k / N, w = A.hw * 1.25; row.push(vert(p[0] + nx * f * w, p[1] + ny * f * w, A.c, A.c2, Math.abs(f) * 1.25, A.o)); }
        base.push(row); }
      for (let i = 0; i < base.length - 1; i++) for (let k = 0; k < 2 * N; k++){ const a = base[i][k], b = base[i][k + 1], c = base[i + 1][k], e = base[i + 1][k + 1]; idx.push(a, c, b, b, c, e); }
    },
    // an irregular blob (ellipse rx × ry, rotation th) with a soft brush rim
    blob(u, v, rx, ry, th, c, c2, o, seg = 18){
      const ct = vert(u, v, c, c2, 0, o), cs = Math.cos(th), sn = Math.sin(th), rim = [], mid = [];
      for (let k = 0; k < seg; k++){ const a = k / seg * Math.PI * 2, wob = 1 + .16 * Math.sin(a * 3 + u) + .08 * Math.sin(a * 5 + v);
        const x = Math.cos(a) * rx * wob, y = Math.sin(a) * ry * wob;
        mid.push(vert(u + (x * cs - y * sn) * .6, v + (x * sn + y * cs) * .6, c, c2, .6, o));
        rim.push(vert(u + (x * cs - y * sn) * 1.12, v + (x * sn + y * cs) * 1.12, c, c2, 1.12, o)); }
      for (let k = 0; k < seg; k++){ const k1 = (k + 1) % seg; idx.push(ct, mid[k], mid[k1], mid[k], rim[k], mid[k1], mid[k1], rim[k], rim[k1]); }
    },
    build(mat, name){
      if (!idx.length) return null;
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      g.setAttribute('aCol', new THREE.Float32BufferAttribute(col, 3)); g.setAttribute('aCol2', new THREE.Float32BufferAttribute(col2, 3));
      g.setAttribute('aEO', new THREE.Float32BufferAttribute(eo, 2)); g.setIndex(idx);
      // flat normals = the sphere normal (the washes are lit like the ground beneath)
      const n = new Float32Array(pos.length); for (let i = 0; i < pos.length; i += 3){ const l = Math.hypot(pos[i], pos[i + 1], pos[i + 2]); n[i] = pos[i] / l; n[i + 1] = pos[i + 1] / l; n[i + 2] = pos[i + 2] / l; }
      g.setAttribute('normal', new THREE.BufferAttribute(n, 3)); g.computeBoundingSphere();
      const m = new THREE.Mesh(g, mat); m.name = name; m.receiveShadow = true; m.renderOrder = 1; return m;
    } };
}
export const lin = (hex) => { const c = new THREE.Color(hex); return [c.r, c.g, c.b]; }; // THREE.Color(hex) is already linear in r152+

// a local basis at board (u, v): x = board direction yaw, y = up, z = x × up; position at R + heightAt + y0
const _d = new THREE.Vector3(), _e = new THREE.Vector3(), _x = new THREE.Vector3(), _z = new THREE.Vector3(), _m = new THREE.Matrix4(), _q = new THREE.Quaternion();
export function poseAt(u, v, yaw, heightAt, y0 = 0, out = new THREE.Matrix4(), sc = [1, 1, 1]){
  F.dirOf(u, v, _d); _e.copy(F.dirOf(u + Math.cos(yaw) * .01, v + Math.sin(yaw) * .01)).sub(_d); _x.copy(_e).addScaledVector(_d, -_e.dot(_d)).normalize(); _z.crossVectors(_x, _d);
  _m.makeBasis(_x, _d, _z); _q.setFromRotationMatrix(_m); const h = R + heightAt(_d) + y0;
  return out.compose(_d.clone().multiplyScalar(h), _q, new THREE.Vector3(...sc));
}
