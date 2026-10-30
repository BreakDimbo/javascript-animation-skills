// 褶星 Fold — b1 test planet: gouache-banded sphere + hedges, stones, a low stone wall and marked ledges.
import * as THREE from '../shared/vendor/three.module.js';

export const R = 600;
export const PAL = {
  paper: 0xebe5d8,
  g0: '#8a9763', g1: '#9aa66e', g2: '#aab47c', g3: '#bdc194',
  hedge: 0x66734d, hedgeHi: 0x7b8760, stone: 0xb7ae9c, stoneDk: 0x9a917f, chalk: 0xf1ebdc,
};

// deterministic rng
function rng(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }

// tangent frame at a unit direction: east (x), up (y), north (z)
export function frameAt(up) {
  const ref = Math.abs(up.y) > 0.99 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0);
  const east = new THREE.Vector3().crossVectors(ref, up).normalize();
  const north = new THREE.Vector3().crossVectors(up, east).normalize();
  return { east, up: up.clone(), north };
}

// tile texture: pencil-tick grass on a mottled gouache wash (multiplied over vertex-colour bands)
function grassTile() {
  const N = 512, c = document.createElement('canvas'); c.width = c.height = N;
  const g = c.getContext('2d'), r = rng(7);
  g.fillStyle = '#e9ead8'; g.fillRect(0, 0, N, N);
  g.filter = 'blur(10px)';
  for (let i = 0; i < 60; i++) { // soft mottling dabs
    const v = 205 + r() * 50; g.fillStyle = `rgba(${v - 8},${v},${v - 30},0.5)`;
    for (const ox of [-N, 0, N]) for (const oy of [-N, 0, N]) { g.beginPath(); g.ellipse(r() * 0 + (i * 97 % N) + ox, ((i * 211) % N) + oy, 30 + r() * 50, 20 + r() * 30, r() * 3, 0, 7); g.fill(); }
  }
  g.filter = 'none'; g.lineCap = 'round';
  for (let i = 0; i < 2600; i++) { // pencil ticks, wrap-safe
    const x = r() * N, y = r() * N, l = 5 + r() * 9, a = -Math.PI / 2 + (r() - 0.5) * 0.9;
    const dark = r() < 0.7; g.strokeStyle = dark ? `rgba(70,92,40,${0.08 + r() * 0.14})` : `rgba(250,248,225,${0.25 + r() * 0.3})`;
    g.lineWidth = 1 + r() * 1.2;
    for (const ox of [-N, 0, N]) for (const oy of [-N, 0, N]) { g.beginPath(); g.moveTo(x + ox, y + oy); g.lineTo(x + ox + Math.cos(a) * l, y + oy + Math.sin(a) * l); g.stroke(); }
  }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function bandNoise(p) { // cheap smooth 3D value from sines (in metres)
  return Math.sin(p.x * 0.031 + Math.sin(p.z * 0.017) * 2.0) * 0.5 + Math.sin(p.y * 0.027 + p.x * 0.011) * 0.35
    + Math.sin((p.z + p.y) * 0.053 + Math.sin(p.x * 0.04)) * 0.25 + Math.sin(p.x * 0.11 - p.z * 0.09) * 0.1;
}

export function createPlanet(scene, renderer) {
  const group = new THREE.Group(); scene.add(group);
  // ground
  const geo = new THREE.SphereGeometry(R, 720, 360);
  const pos = geo.attributes.position, col = new Float32Array(pos.count * 3);
  const bands = [PAL.g0, PAL.g1, PAL.g2, PAL.g3].map(h => new THREE.Color(h));
  const v = new THREE.Vector3(), cc = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const n = bandNoise(v) * 0.5 + 0.5; // 0..1
    const f = Math.min(3, Math.max(0, n * 3.6 - 0.3)), k = Math.floor(f), e = f - k;
    const s = THREE.MathUtils.smoothstep(e, 0.82, 1.0); // posterised gouache bands with a soft painted edge
    cc.copy(bands[k]).lerp(bands[Math.min(3, k + 1)], s);
    col[i * 3] = cc.r; col[i * 3 + 1] = cc.g; col[i * 3 + 2] = cc.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const tex = grassTile(); tex.repeat.set(2 * Math.PI * R / 3.2, Math.PI * R / 3.2);
  tex.anisotropy = renderer ? renderer.capabilities.getMaxAnisotropy() : 4;
  const ground = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ map: tex, vertexColors: true }));
  ground.receiveShadow = true; group.add(ground);

  const spawnUp = new THREE.Vector3(0.0, 0.0, 1).normalize();
  const F = frameAt(spawnUp);
  const at = (x, z) => new THREE.Vector3().copy(F.up).multiplyScalar(R).addScaledVector(F.east, x).addScaledVector(F.north, z).normalize();
  // orient an object on the surface at direction d with yaw
  const place = (obj, d, yaw = 0, lift = 0) => {
    const f = frameAt(d), m = new THREE.Matrix4().makeBasis(f.east, f.up, f.north.clone().negate()); // right-handed
    obj.quaternion.setFromRotationMatrix(m); obj.rotateY(yaw);
    obj.position.copy(d).multiplyScalar(R + lift); group.add(obj); obj.updateMatrixWorld(true); return obj;
  };

  const colliders = [];
  const addBox = (obj, hx, hz, top) => colliders.push({ inv: obj.matrixWorld.clone().invert(), hx, hz, top });

  const r = rng(42);
  // low dry-stone wall (0.42 m) — jumpable
  const stoneMat = new THREE.MeshLambertMaterial({ color: PAL.stone });
  const stoneDk = new THREE.MeshLambertMaterial({ color: PAL.stoneDk });
  const chalk = new THREE.MeshLambertMaterial({ color: PAL.chalk });
  function wall(x, z, yaw, len, h) {
    const w = new THREE.Group();
    const base = new THREE.Mesh(new THREE.BoxGeometry(len, h, 0.42), stoneDk); base.position.y = h / 2; w.add(base);
    for (let i = 0; i < len / 0.22; i++) { // knobbly stones on faces & cap
      const s = new THREE.Mesh(new THREE.DodecahedronGeometry(0.09 + r() * 0.05, 0), r() < 0.5 ? stoneMat : stoneDk);
      s.position.set(-len / 2 + 0.1 + i * 0.22 + (r() - .5) * .05, h - 0.02 + r() * 0.02, (r() - .5) * 0.25);
      s.scale.set(1.2, 0.45, 1.1); s.rotation.set(r(), r() * 3, r()); s.castShadow = true; w.add(s);
      for (const sd of [-1, 1]) { const q = new THREE.Mesh(new THREE.DodecahedronGeometry(0.08 + r() * 0.04, 0), r() < 0.5 ? stoneMat : stoneDk);
        q.position.set(-len / 2 + 0.1 + i * 0.22, 0.08 + r() * (h - 0.16), sd * 0.2); q.scale.set(1.3, 0.7, 0.5); q.rotation.set(r(), r(), r()); w.add(q); }
    }
    base.castShadow = base.receiveShadow = true;
    place(w, at(x, z), yaw); addBox(w, len / 2, 0.21, h + 0.03); return w;
  }
  wall(0, 4.5, 0.15, 9, 0.42);
  wall(-7, -3, 1.3, 6, 0.38);

  // marked ledges: stone slabs with a chalk tick on top (stepped heights)
  const ledges = [[2.5, -2, 0.28], [3.3, -3.1, 0.5], [4.4, -3.6, 0.7], [-3, 2, 0.35]];
  for (const [x, z, h] of ledges) {
    const g = new THREE.Group();
    const b = new THREE.Mesh(new THREE.BoxGeometry(0.7, h, 0.6), stoneMat); b.position.y = h / 2; b.castShadow = b.receiveShadow = true; g.add(b);
    const cap = new THREE.Mesh(new THREE.BoxGeometry(0.76, 0.05, 0.66), stoneDk); cap.position.y = h; cap.castShadow = true; cap.receiveShadow = true; g.add(cap);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.05), chalk); m.rotation.x = -Math.PI / 2; m.rotation.z = 0.3; m.position.y = h + 0.028; g.add(m);
    const m2 = m.clone(); m2.rotation.z = -0.5; m2.position.x = 0.08; m2.scale.x = 0.5; g.add(m2);
    place(g, at(x, z), r() * 3); addBox(g, 0.38, 0.33, h + 0.025);
  }

  // hedgerows: chains of squashed blobs (instanced), solid colliders
  const blob = new THREE.IcosahedronGeometry(1, 2);
  const hedgeIM = new THREE.InstancedMesh(blob, new THREE.MeshLambertMaterial({ color: PAL.hedge }), 4000);
  const hedgeHi = new THREE.InstancedMesh(blob, new THREE.MeshLambertMaterial({ color: PAL.hedgeHi }), 4000);
  hedgeIM.castShadow = hedgeHi.castShadow = true; hedgeIM.receiveShadow = true;
  let hn = 0, hh = 0; const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), S = new THREE.Vector3(), P = new THREE.Vector3();
  const dummy = new THREE.Object3D();
  function hedge(x0, z0, x1, z1) {
    const L = Math.hypot(x1 - x0, z1 - z0), n = Math.floor(L / 0.5);
    for (let i = 0; i <= n; i++) {
      const t = i / n, x = x0 + (x1 - x0) * t + Math.sin(t * 9) * 0.6, z = z0 + (z1 - z0) * t + Math.cos(t * 7) * 0.6;
      const d = at(x, z), hgt = 0.8 + r() * 0.4;
      dummy.position.set(0, 0, 0); dummy.quaternion.identity(); dummy.scale.set(1, 1, 1);
      place(dummy, d, r() * 6, hgt * 0.45); group.remove(dummy);
      S.set(0.5 + r() * 0.3, hgt * 0.55, 0.5 + r() * 0.3); M.compose(dummy.position, dummy.quaternion, S);
      if (hn < 4000) hedgeIM.setMatrixAt(hn++, M);
      if (r() < 0.6 && hh < 4000) { P.copy(dummy.position).addScaledVector(d, hgt * 0.35); S.multiplyScalar(0.55); M.compose(P, dummy.quaternion, S); hedgeHi.setMatrixAt(hh++, M); }
      if (i % 2 === 0) { const c = new THREE.Object3D(); place(c, d, 0); group.remove(c); colliders.push({ inv: c.matrixWorld.clone().invert(), hx: 0.6, hz: 0.6, top: 99 }); }
    }
  }
  hedge(-14, 12, 16, 15); hedge(16, 15, 22, -12); hedge(-18, -14, 10, -18); hedge(-30, 30, -20, -30);
  for (let k = 0; k < 40; k++) { const a = r() * 6.28, d = 30 + r() * 120, b = r() * 6.28, l = 10 + r() * 30;
    const x = Math.cos(a) * d, z = Math.sin(a) * d; hedge(x, z, x + Math.cos(b) * l, z + Math.sin(b) * l); }
  hedgeIM.count = hn; hedgeHi.count = hh; group.add(hedgeIM, hedgeHi);

  // scattered stones
  const stIM = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(1, 0), stoneMat, 600); stIM.castShadow = true;
  for (let i = 0; i < 600; i++) {
    const a = r() * 6.28, d = 2 + Math.pow(r(), 0.7) * 160, s = 0.08 + Math.pow(r(), 3) * 0.5;
    dummy.position.set(0, 0, 0); dummy.quaternion.identity(); place(dummy, at(Math.cos(a) * d, Math.sin(a) * d), r() * 6, s * 0.15); group.remove(dummy);
    S.set(s * 1.3, s * 0.6, s); M.compose(dummy.position, dummy.quaternion, S); stIM.setMatrixAt(i, M);
    if (s > 0.3) colliders.push({ inv: dummy.matrixWorld.clone().invert(), hx: s, hz: s, top: s * 0.7 });
  }
  group.add(stIM);

  return { group, R, colliders, spawnUp, frame: F, at };
}
