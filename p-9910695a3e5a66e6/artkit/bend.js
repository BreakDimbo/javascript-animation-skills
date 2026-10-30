// 褶星 Fold art kit — "diorama curvature": the ground falls away around the focus like a small planet.
// A world-space drop along the focus normal (s²·k, s = arc distance from focus) patched into three's shared vertex
// chunks, so every built-in material and its shadow depth pass bend identically. ShaderMaterials opt in via hookBend().
import * as THREE from '../shared/vendor/three.module.js';
export const BEND = { value: new THREE.Vector4(0, 0, 1, 0) };   // xyz = focus dir, w = k (1/2R' − 1/2R)
export const BEND_GLSL = `uniform vec4 uBend;
vec4 foldBend(vec4 w){ if (uBend.w == 0.0) return w; vec3 n = normalize(w.xyz); float s = 600.0 * length(n - uBend.xyz); w.xyz -= uBend.xyz * (s * s * uBend.w); return w; }
`;
// the board: a ragged rectangle of painted world around the focus; everything else is paper
export const BOARDU = { GC: { value: new THREE.Vector3(0, 0, 1) }, GE1: { value: new THREE.Vector3(1, 0, 0) }, GE2: { value: new THREE.Vector3(0, 1, 0) }, GR: { value: 600 }, /* w2 r2: ground frame shared with sprite shadows (river mask) */
   F: { value: new THREE.Vector4(0, 0, 1, 0) }, X: { value: new THREE.Vector4(1, 0, 0, 3.3) }, Y: { value: new THREE.Vector4(0, 1, 0, 4.6) } };
export const BOARD_GLSL = `
#ifndef FOLD_BOARD
#define FOLD_BOARD
uniform vec4 uBoardF, uBoardX, uBoardY; // F: focus dir, w = prop margin (0 = board off) · X/Y: tangent axes, w = half sizes (m)
float foldBoardSD(vec3 w){ vec3 d = normalize(w); if (dot(d, uBoardF.xyz) < 0.9) return 1e3;
  vec2 q = abs(vec2(dot(d, uBoardX.xyz), dot(d, uBoardY.xyz)) * 600.0 - vec2(dot(uBoardF.xyz, uBoardX.xyz), dot(uBoardF.xyz, uBoardY.xyz)) * 600.0) - vec2(uBoardX.w, uBoardY.w);
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0); }
#endif
`;
const C = THREE.ShaderChunk;
if (!C.common.includes('FOLD_BOARD')){
  C.common += BOARD_GLSL;
  C.uv_pars_vertex = 'varying vec3 vFoldW;\n' + C.uv_pars_vertex; C.uv_pars_fragment = 'varying vec3 vFoldW;\n' + C.uv_pars_fragment;
  C.project_vertex = C.project_vertex.replace('mvPosition = modelViewMatrix * mvPosition;', 'vFoldW = (modelMatrix * mvPosition).xyz;\nmvPosition = modelViewMatrix * mvPosition;');
  C.clipping_planes_fragment = 'if (uBoardF.w > 0.0 && foldBoardSD(vFoldW) > uBoardF.w) discard;\n' + C.clipping_planes_fragment;
}
if (!C.common.includes('foldBend')){
  C.common += '\n#ifndef FOLD_BEND_FN\n#define FOLD_BEND_FN\n#ifdef VERTEX_SHADER_FOLD\n#endif\n#endif\n';
  C.project_vertex = C.project_vertex.replace('mvPosition = modelViewMatrix * mvPosition;', 'mvPosition = viewMatrix * foldBend(modelMatrix * mvPosition);');
  C.worldpos_vertex = C.worldpos_vertex.replace('worldPosition = modelMatrix * worldPosition;', 'worldPosition = foldBend(modelMatrix * worldPosition);');
  // declare in every vertex shader that uses the chunks (common is shared by both stages; guard by a vertex-only chunk)
  C.uv_pars_vertex = BEND_GLSL + C.uv_pars_vertex;
}
export function setBoard(focusDir, ax, ay, hx, hy, margin){ BOARDU.F.value.set(focusDir.x, focusDir.y, focusDir.z, margin); BOARDU.X.value.set(ax.x, ax.y, ax.z, hx); BOARDU.Y.value.set(ay.x, ay.y, ay.z, hy); }
export function setBend(focusDir, Rp, R = 600){ BEND.value.set(focusDir.x, focusDir.y, focusDir.z, Rp > 0 ? 1 / (2 * Rp) - 1 / (2 * R) : 0); }
// attach the shared uniform to every material under root (and shadow depth materials); safe to call repeatedly
const depthMat = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking });
const hook = (m) => {
  if (!m || m.userData.bendHooked) return; m.userData.bendHooked = true;
  const prev = m.onBeforeCompile, key = m.customProgramCacheKey();
  m.onBeforeCompile = function (s, r){ prev.call(this, s, r); s.uniforms.uBend = BEND; s.uniforms.uBoardF = BOARDU.F; s.uniforms.uBoardX = BOARDU.X; s.uniforms.uBoardY = BOARDU.Y;
    if (m.isShaderMaterial && !s.vertexShader.includes('foldBend(')){
      s.vertexShader = BEND_GLSL + s.vertexShader
        .replace(/vec4 mvPosition = modelViewMatrix \* vec4\(pos, 1\.\);/, 'vFoldW = (modelMatrix * vec4(pos, 1.)).xyz; vec4 mvPosition = viewMatrix * foldBend(modelMatrix * vec4(pos, 1.));')
        .replace(/vec4 mv = viewMatrix \* vec4\(w, 1\.0\);/, 'vec4 mv = viewMatrix * foldBend(vec4(w, 1.0));');
      if (s.vertexShader.includes('vFoldW =')){ s.vertexShader = 'varying vec3 vFoldW;\n' + s.vertexShader;
        s.fragmentShader = BOARD_GLSL + 'varying vec3 vFoldW;\n' + s.fragmentShader.replace(/void main\s*\(\s*\)\s*\{/, 'void main(){ if (uBoardF.w > 0.0 && foldBoardSD(vFoldW) > uBoardF.w) discard;'); }
    } };
  m.customProgramCacheKey = () => key + '|bend';
  m.needsUpdate = true;
};
hook(depthMat);
export function hookBend(root){
  root.traverse(o => { if (!o.material) return; (Array.isArray(o.material) ? o.material : [o.material]).forEach(hook);
    if (o.castShadow && o.isMesh && !o.customDepthMaterial) o.customDepthMaterial = depthMat; });
}
