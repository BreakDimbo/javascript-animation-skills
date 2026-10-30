// 褶星 Fold art kit — Codex-painted clay sprites from the sheep replica's atlases (trees, clouds), one draw call per kind.
// Trees: cylindrical billboards around the local radial up (they stay upright on the sphere). Clouds: soft camera-facing cards.
import * as THREE from '../shared/vendor/three.module.js';
import { BEND, BEND_GLSL, BOARDU, BOARD_GLSL } from './bend.js';
const BASE = new URL('./tex/', import.meta.url).href;
const load = (n) => { const t = new THREE.TextureLoader().load(BASE + n); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t; };
let META = null; const meta = async () => META ?? (META = await (await fetch(BASE + 'meta.json')).json());

function billboardMaterial(tex, { cylindrical = true, alphaTest = 0.5, transparent = false, fog = true, tint = [1, 1, 1], grade = false } = {}){
  return new THREE.ShaderMaterial({ transparent, depthWrite: !transparent, alphaTest,
    uniforms: { map: { value: tex }, uFogC: { value: new THREE.Color() }, uFog: { value: new THREE.Vector2(1e4, 2e4) }, uTint: { value: new THREE.Vector3(...tint) }, uBend: BEND, uBoardF: BOARDU.F, uBoardX: BOARDU.X, uBoardY: BOARDU.Y },
    vertexShader: BEND_GLSL + BOARD_GLSL + `attribute vec3 aPos; attribute vec3 aUp; attribute vec2 aSize; attribute vec4 aRect; attribute float aAlpha;
      varying vec2 vUv; varying float vD; varying float vA;
      void main(){ vec3 up = normalize(aUp); vec3 toC = cameraPosition - aPos;
        vec3 right = normalize(cross(up, toC)); ${cylindrical ? '' : 'up = normalize(cross(toC, right));'}
        vec3 w = aPos + right * (position.x * aSize.x) + up * (position.y * aSize.y);
        vUv = aRect.xy + uv * aRect.zw; vA = aAlpha; vec4 mv = viewMatrix * foldBend(vec4(w, 1.0)); vD = -mv.z; gl_Position = projectionMatrix * mv; if (uBoardF.w > 0.0 && foldBoardSD(aPos) > 0.05) gl_Position = vec4(2., 2., 2., 1.); }`,
    fragmentShader: `uniform sampler2D map; uniform vec3 uFogC, uTint; uniform vec2 uFog; varying vec2 vUv; varying float vD; varying float vA;
      void main(){ vec4 c = texture2D(map, vUv); c.a *= vA; if (c.a < ${alphaTest.toFixed(2)}) discard;
        vec3 col = c.rgb * uTint; ${grade ? '{ float l = dot(col, vec3(.3, .59, .11)); col = mix(col * vec3(.5, .68, .46), col * vec3(1.0, .97, .86), smoothstep(.22, .82, l)); col = mix(col, col * vec3(.82, .9, .8), smoothstep(.5, .2, l) * .5); }' : ''} ${fog ? 'col = mix(col, uFogC, smoothstep(uFog.x, uFog.y, vD));' : ''}
        gl_FragColor = vec4(col, ${transparent ? 'c.a' : '1.0'}); 
        #include <colorspace_fragment>
      }` });
}
function instanced(mat, items, anchorY){
  const g = new THREE.InstancedBufferGeometry(); const pl = new THREE.PlaneGeometry(1, 1); pl.translate(0, anchorY, 0);
  g.index = pl.index; g.setAttribute('position', pl.attributes.position); g.setAttribute('uv', pl.attributes.uv);
  const A = (k, n) => new THREE.InstancedBufferAttribute(new Float32Array(items.length * n), n);
  const aPos = A('aPos', 3), aUp = A('aUp', 3), aSize = A('aSize', 2), aRect = A('aRect', 4), aAlpha = A('aAlpha', 1);
  items.forEach((t, i) => { aPos.setXYZ(i, ...t.pos); aUp.setXYZ(i, ...t.up); aSize.setXY(i, ...t.size); aRect.setXYZW(i, ...t.rect); aAlpha.setX(i, t.alpha ?? 1); });
  Object.entries({ aPos, aUp, aSize, aRect, aAlpha }).forEach(([k, a]) => g.setAttribute(k, a)); g.instanceCount = items.length;
  const m = new THREE.Mesh(g, mat); m.frustumCulled = false; return m;
}
const syncFog = (mat, scene) => { if (scene.fog) { mat.uniforms.uFogC.value.copy(scene.fog.color); mat.uniforms.uFog.value.set(scene.fog.near, scene.fog.far); } };

export function blobShadowMat(strength = .5){
  /* w2: FINAL17 sheep/tree shadows are large, soft, dark-green and fall away from the sun: elongated along the ground projection of the sun, centre pushed away from it,
     gaussian edge, multiplied into the turf with ~#3b6a25 (not alpha-blended black) */
  return new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.DstColorFactor, blendDst: THREE.ZeroFactor,
    uniforms: { uBend: BEND, uBoardF: BOARDU.F, uBoardX: BOARDU.X, uBoardY: BOARDU.Y, uSun: { value: new THREE.Vector3(0, 1, 0) }, uGC: BOARDU.GC, uGE1: BOARDU.GE1, uGE2: BOARDU.GE2, uGR: BOARDU.GR },
    vertexShader: BEND_GLSL + BOARD_GLSL + `attribute vec3 aPos; attribute vec3 aUp; attribute vec2 aSize; uniform vec3 uSun; varying vec2 vQ; varying float vSd; varying vec3 vW;
      void main(){ vec3 up = normalize(aUp); vec3 s = uSun - up * dot(uSun, up); vec3 ax = length(s) > 1e-3 ? normalize(s) : normalize(cross(up, vec3(0.3, 1., .2))); vec3 ay = cross(up, ax);
        vec3 c = aPos + up * .03 - ax * aSize.x * .85; vec3 w = c + ax * position.x * aSize.x * 2.4 + ay * position.y * aSize.x * 1.4; vSd = uBoardF.w > 0.0 ? foldBoardSD(w) : -1.; vW = w;
        vQ = position.xy * 2.; gl_Position = projectionMatrix * viewMatrix * foldBend(vec4(w, 1.)); if (uBoardF.w > 0.0 && foldBoardSD(aPos) > 0.05) gl_Position = vec4(2., 2., 2., 1.); }`,
    fragmentShader: `varying vec2 vQ; varying float vSd; varying vec3 vW; uniform vec3 uGC, uGE1, uGE2; uniform float uGR;
      float fpRiv(float v){ return -1.85 + .45 * sin(v * .37) + .18 * sin(v * 1.1 + 2.0) + .05 * sin(v * 3.3); }
      void main(){ float r = dot(vQ, vQ); float a = pow(smoothstep(1., .0, r), 1.4) * 1.25 * smoothstep(-.02, -.3, vSd) * ${strength.toFixed(3)};
        /* w2 r2: over the river the shadow fades to ~25 % (a dark band across water reads as an artefact) */
        { vec3 dr = normalize(vW); vec2 g = vec2(dot(dr, uGE1), dot(dr, uGE2)) * uGR / max(dot(dr, uGC), 1e-3); a *= 1. - .75 * smoothstep(.34, .2, abs(g.x - fpRiv(clamp(g.y, -40., 45.)))); } gl_FragColor = vec4(mix(vec3(1.), vec3(.231, .416, .145), a), 1.); }` });
}
// list: [{dir, h, s, cell}] — trees use the side-view row (cells 8–13 green, 14–15 pink, used rarely like the original's one pink tree)
export function createTrees(scene, list, R){
  const tex = load('trees.webp'); const mat = billboardMaterial(tex, { tint: [0.97, 0.98, 0.95], grade: true }); /* r6: FINAL17's layered deep shadow greens, warm lit tops */
  const shMat = blobShadowMat(.55);
  const mesh = { update(sun){ syncFog(mat, scene); if (sun) shMat.uniforms.uSun.value.copy(sun); }, dispose(){ for (const m of [mesh.mesh, mesh.shadow]) if (m){ scene.remove(m); m.geometry.dispose(); } } };
  meta().then(M => { const T = M.trees, cols = T.cols, rows = Math.ceil(T.cells.length / cols);
    const items = list.map((t, i) => { const cell = t.cell >= 14 ? t.cell : 8 + (t.cell % 6), c = T.cells[cell];
      const H = 4.2 * t.s, wcell = H / c.h; const p = t.dir.clone().multiplyScalar(R + t.h - 0.035 * H);
      return { pos: p.toArray(), up: t.dir.toArray(), size: [wcell, wcell], rect: [(cell % cols) / cols, 1 - (((cell / cols) | 0) + 1) / rows, 1 / cols, 1 / rows] }; });
    const m = instanced(mat, items, 0.5); m.renderOrder = 1; scene.add(m); mesh.mesh = m;
    // soft contact shade under each crown (FINAL17's trees sit on a dark pool offset away from the sun)
    const sh = instanced(shMat, items.map((it, i) => ({ ...it, pos: list[i].dir.clone().multiplyScalar(R + list[i].h).toArray(), up: (list[i].n || list[i].dir).toArray(), size: [it.size[0] * .5, it.size[0] * .5] })), 0.0);
    sh.renderOrder = 0; scene.add(sh); mesh.shadow = sh; });
  return mesh;
}
export function createClouds(scene, R, F, [U0, U1, V0, V1], n = 16, seed = 4, { size = [16, 30], alt = [34, 50], fixed = [], keepOut = null } = {}){
  let a = seed; const rnd = () => (a = (a * 16807) % 2147483647) / 2147483647;
  const tex = load('clouds.webp'); const mat = billboardMaterial(tex, { cylindrical: false, alphaTest: 0.02, transparent: true, fog: false, tint: [1.0, 0.99, 0.97] });
  const obj = { update(){} };
  meta().then(M => { const C = M.clouds, cols = C.cols, rows = Math.ceil(C.cells.length / cols);
    const items = []; for (let i = 0; i < n; i++){ const u = U0 + rnd() * (U1 - U0), v = V0 + rnd() * (V1 - V0), d = F.dirOf(u, v), cell = (rnd() * 4) | 0, s = size[0] + rnd() * (size[1] - size[0]);
      if (keepOut && Math.hypot(u - keepOut[0], v - keepOut[1]) < keepOut[2]) continue;
      items.push({ pos: d.clone().multiplyScalar(R + alt[0] + rnd() * (alt[1] - alt[0])).toArray(), up: d.toArray(), size: [s, s * .62], rect: [(cell % cols) / cols, 1 - (((cell / cols) | 0) + 1) / rows, 1 / cols, 1 / rows], alpha: .92 }); }
    /* r5: hand-placed whole puffs that sit inside the default frame (FINAL17: one over the far end of the path, one small at top-left) */
    for (const [u, v, sz, h, cell] of fixed){ const d = F.dirOf(u, v); items.push({ pos: d.clone().multiplyScalar(R + h).toArray(), up: d.toArray(), size: [sz, sz * .62], rect: [(cell % cols) / cols, 1 - (((cell / cols) | 0) + 1) / rows, 1 / cols, 1 / rows], alpha: .95 }); }
    const m = instanced(mat, items, 0.0); m.renderOrder = 5; scene.add(m); obj.mesh = m; console.log('clouds', items.length, 'fixed', fixed.length); });
  return obj;
}

// Flock: the replica's Codex-painted sheep (rows graze/stand/walk/jump × 8 views), one billboard draw + one soft-shadow draw.
// drive(i) is called per frame with { dir, fwd (world tangent), row, scale }; the view column is chosen against the camera like the replica.
export function createFlock(scene, n, R){
  const tex = load('sheep.webp'); const mat = billboardMaterial(tex, { tint: [1, 1, 1] });
  const shMat = blobShadowMat(.55);
  const flock = { mesh: null, shadow: null, n, ready: false };
  const items = Array.from({ length: n }, () => ({ pos: [0, 0, R], up: [0, 0, 1], size: [0.6, 0.6], rect: [0, 0, 1 / 8, 1 / 4] }));
  flock.mesh = instanced(mat, items, 0.5); flock.mesh.renderOrder = 1; scene.add(flock.mesh);
  flock.shadow = instanced(shMat, items, 0.0); flock.shadow.renderOrder = 0; scene.add(flock.shadow);
  const g = flock.mesh.geometry, gs = flock.shadow.geometry;
  let CELLS = null; meta().then(M => { CELLS = M.sheep.cells; flock.ready = true; });
  const V = new THREE.Vector3();
  flock.update = (list, camYaw, camRight, sun) => {
    shMat.uniforms.uSun.value.copy(sun); syncFog(mat, scene);
    list.forEach((s, i) => {
      const sz = s.fwd.dot(camYaw), sx = s.fwd.dot(camRight), th = Math.atan2(-sz * 0.6, sx);
      const col = ((Math.round((Math.PI - th) / (Math.PI / 4)) % 8) + 8) % 8, row = s.row;
      const k = s.scale, c = CELLS ? CELLS[row][col] : { h: .72 };
      V.copy(s.dir).multiplyScalar(R + s.h - (1 - c.h) * 0.5 * k + 0.01);
      g.attributes.aPos.setXYZ(i, V.x, V.y, V.z); g.attributes.aUp.setXYZ(i, s.dir.x, s.dir.y, s.dir.z); g.attributes.aSize.setXY(i, k, k);
      g.attributes.aRect.setXYZW(i, col / 8, 1 - (row + 1) / 4, 1 / 8, 1 / 4);
      V.copy(s.dir).multiplyScalar(R + s.h); gs.attributes.aPos.setXYZ(i, V.x, V.y, V.z); gs.attributes.aUp.setXYZ(i, s.dir.x, s.dir.y, s.dir.z); gs.attributes.aSize.setXY(i, k * .62, k);
    });
    for (const a of ['aPos', 'aUp', 'aSize', 'aRect']) g.attributes[a].needsUpdate = true; for (const a of ['aPos', 'aUp', 'aSize']) gs.attributes[a].needsUpdate = true;
  };
  return flock;
}
