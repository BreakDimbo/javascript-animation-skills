// QA r3 #2: keep small props on the painted board. Built-in materials clip fragments 0.08 m past the board rectangle, but the ground's
// ragged rim is already eaten up to ~0.3 m inside it, so a stone there stood on bare paper. This drops a WHOLE prop (all its vertices
// pushed outside the clip volume, so it is a clean cut, never a sliced object) once its centre + radius comes within INSET of the edge.
// Instanced meshes: centre = the instance origin, radius = R × the instance scale. Merged meshes: a per-vertex attribute foldC
// (xyz = the prop's centre in object space, w = its radius). Off in planet mode (board margin 0). The shadow pass gets the same cull.
import * as THREE from '../../shared/vendor/three.module.js';
import { hookBend, BOARDU } from '../../artkit/bend.js';
export const INSET = .32;
const CODE = (R) => `
{ vec4 fcC; float fcR;
#ifdef USE_INSTANCING
  fcC = modelMatrix * instanceMatrix * vec4(0., 0., 0., 1.); fcR = ${(+R).toFixed(3)} * length((modelMatrix * instanceMatrix)[0].xyz);
#else
  fcC = modelMatrix * vec4(foldC.xyz, 1.); fcR = foldC.w * length(modelMatrix[0].xyz);   // foldC.w in object units (finds: scale 1)
#endif
  if (uBoardF.w > 0.0 && foldBoardSD(fcC.xyz) > -(fcR + ${INSET.toFixed(3)})) gl_Position = vec4(2., 2., 2., 1.); }
`;
export function boardCull(mat, R = .1){
  if (mat.userData.boardCull) return mat; mat.userData.boardCull = true;
  const prev = mat.onBeforeCompile, key = mat.customProgramCacheKey();
  mat.onBeforeCompile = function (s, r){ prev.call(this, s, r);
    s.vertexShader = s.vertexShader.replace('#include <project_vertex>', '#include <project_vertex>\n' + CODE(R));
    s.vertexShader = '#ifndef USE_INSTANCING\nattribute vec4 foldC;\n#endif\n' + s.vertexShader; };
  mat.customProgramCacheKey = () => key + '|bcull' + R; mat.needsUpdate = true; return mat;
}
// the matching shadow-caster material (three's default depth material would still cast the culled prop's shadow)
export function cullDepth(R = .1){ const m = boardCull(new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking }), R); hookBend({ traverse: (f) => f({ material: m }) }); return m; }
export function cullMesh(mesh, R = .1){ boardCull(mesh.material, R); if (mesh.castShadow) mesh.customDepthMaterial = cullDepth(R); return mesh; }

// ---- r1.4: the regions' own props (b3 pond, b4 mill). Same rule as above, three paths:
// instanced (reeds, wheat, contact shadows) → boardCull on the material, R = the geometry's reach from its origin;
// merged (the pond's stepping stones) → foldC per equal vertex chunk; separate props (ducks, logs, sacks, mouse, donkey, hens,
// shades, wake rings) → CPU: each frame the prop's world bounding sphere is tested against the board and, when culled, layer 0 is
// cleared on all its meshes. three skips an object whose layers fail the camera's in both the colour and the shadow pass
// (WebGLShadowMap renderObject tests camera.layers), so the prop and its shadow go together, and .visible (driven by the
// modules) is left alone. Buildings (the mill, the cottage) and surfaces (ground, water) are not props: they keep the fragment clip.
export function geoReach(geo){ geo.computeBoundingSphere(); const b = geo.boundingSphere; return b.center.length() + b.radius; }
export function cullInstanced(mesh, R = geoReach(mesh.geometry)){ return cullMesh(mesh, R); }
// merged mesh of n props with equal vertex counts, in order (b3 pond stepping stones)
export function cullChunks(mesh, n){ const pos = mesh.geometry.attributes.position, N = pos.count, c = N / n; if (!n || c % 1) return false;
  const a = new Float32Array(N * 4), b = new THREE.Box3(), v = new THREE.Vector3(), ctr = new THREE.Vector3();
  for (let i = 0; i < n; i++){ b.makeEmpty(); for (let j = i * c; j < (i + 1) * c; j++) b.expandByPoint(v.fromBufferAttribute(pos, j)); b.getCenter(ctr);
    let r = 0; for (let j = i * c; j < (i + 1) * c; j++) r = Math.max(r, v.fromBufferAttribute(pos, j).distanceTo(ctr));
    for (let j = i * c; j < (i + 1) * c; j++) a.set([ctr.x, ctr.y, ctr.z, r], j * 4); }
  mesh.geometry.setAttribute('foldC', new THREE.BufferAttribute(a, 4)); cullMesh(mesh); return true; }
// CPU board SD of a world point (same as foldBoardSD in artkit/bend.js)
const _d = new THREE.Vector3();
export function boardSD(p){ const F = BOARDU.F.value, X = BOARDU.X.value, Y = BOARDU.Y.value; _d.copy(p).normalize();
  if (_d.x * F.x + _d.y * F.y + _d.z * F.z < .9) return 1e3;
  const qx = Math.abs((_d.x * X.x + _d.y * X.y + _d.z * X.z - (F.x * X.x + F.y * X.y + F.z * X.z)) * 600) - X.w;
  const qy = Math.abs((_d.x * Y.x + _d.y * Y.y + _d.z * Y.z - (F.x * Y.x + F.y * Y.y + F.z * Y.z)) * 600) - Y.w;
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0); }
// collect props under root: an object whose world bounding sphere is ≤ maxR is one prop; a bigger group is a building if any of its
// own meshes is bigger than maxR (skipped whole), else a container (its children are tried); big meshes and instanced/culled ones are skipped
export function cullProps(root, { maxR = .3, skip = () => false } = {}){
  const props = [], bb = new THREE.Box3(), sp = new THREE.Sphere(), big = (o) => { bb.setFromObject(o); if (bb.isEmpty()) return -1; bb.getBoundingSphere(sp); return sp.radius; };
  const gpu = (o) => o.isInstancedMesh || o.geometry?.attributes?.foldC;
  root.updateMatrixWorld(true);
  const consider = (o) => { if (skip(o) || gpu(o) || o.isLight || o.isCamera) return; const r = big(o); if (r < 0) return;
    if (r <= maxR){ const meshes = []; o.traverse(x => { if (x.isMesh && !gpu(x)) meshes.push({ x, mask: x.layers.mask }); }); if (!meshes.length) return;
      props.push({ o, c: o.worldToLocal(sp.center.clone()), r: r / o.matrixWorld.getMaxScaleOnAxis(), meshes, off: false }); return; }
    if (o.isMesh) return;
    let building = false; o.traverse(x => { if (!building && x.isMesh && !gpu(x) && x !== o){ x.geometry.computeBoundingSphere(); if (x.geometry.boundingSphere.radius * x.matrixWorld.getMaxScaleOnAxis() > maxR) building = true; } });
    if (!building) o.children.forEach(consider); };
  root.children.forEach(consider);
  const w = new THREE.Vector3();
  const set = (p, off) => { if (p.off === off) return; p.off = off; for (const m of p.meshes) m.x.layers.mask = off ? (m.mask & ~1) : m.mask; };
  return { props,
    update(){ const live = BOARDU.F.value.w > 0;   // planet / ?close / ?noboard: margin 0 → everything back
      for (const p of props){ if (!live){ set(p, false); continue; } w.copy(p.c).applyMatrix4(p.o.matrixWorld);
        set(p, boardSD(w) > -(p.r * p.o.matrixWorld.getMaxScaleOnAxis() + INSET)); } } };
}
// a region module: every instanced mesh (one R per shared material: the largest reach), then the separate props; call .update() each frame
export function cullRegion(root, opts){ const byMat = new Map();
  root.traverse(o => { if (o.isInstancedMesh && !Array.isArray(o.material)) byMat.set(o.material, Math.max(byMat.get(o.material) || 0, geoReach(o.geometry))); });
  const inst = []; root.traverse(o => { if (o.isInstancedMesh && byMat.has(o.material)){ cullMesh(o, +byMat.get(o.material).toFixed(3)); inst.push(o); } });
  const cp = cullProps(root, opts); cp.instanced = inst; return cp; }
