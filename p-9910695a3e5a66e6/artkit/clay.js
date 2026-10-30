// 褶星 Fold art kit — matte clay material + module reskin.
// Clay = Lambert (no specular, no emissive), Codex plasticine macro grain in object space (triplanar),
// a soft "rounded" term (faces turning away from the eye pick up a little pigment), and nothing else.
import * as THREE from '../shared/vendor/three.module.js';
import { PAL, nearestPal } from './palette.js';

const BASE = new URL('./tex/', import.meta.url).href;
let _clayTex = null;
export function clayGrain(){
  if (_clayTex) return _clayTex;
  _clayTex = new THREE.TextureLoader().load(BASE + 'clay.png');
  _clayTex.wrapS = _clayTex.wrapT = THREE.RepeatWrapping; _clayTex.anisotropy = 4;
  return _clayTex;
}

// opts: color (hex/string), grain (tiles per local unit, default 6), grainAmt (0..1), vertexColors, side, flatShading
export function clayMaterial(opts = {}){
  const m = new THREE.MeshLambertMaterial({ color: opts.color ?? 0xffffff, vertexColors: !!opts.vertexColors, side: opts.side ?? THREE.FrontSide,
    flatShading: false, transparent: false });
  const u = { uGrain: { value: clayGrain() }, uGrainScale: { value: opts.grain ?? 6 }, uGrainAmt: { value: opts.grainAmt ?? 0.16 }, uRound: { value: opts.round ?? 0.22 } };
  m.userData.clay = u;
  m.onBeforeCompile = (s) => {
    Object.assign(s.uniforms, u);
    s.vertexShader = s.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vClayP; varying vec3 vClayN;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvClayP = position; vClayN = normal;');
    s.fragmentShader = s.fragmentShader
      .replace('#include <common>', `#include <common>
varying vec3 vClayP; varying vec3 vClayN; uniform sampler2D uGrain; uniform float uGrainScale, uGrainAmt, uRound;
float clayTri(vec3 p, vec3 n){ vec3 w = pow(abs(n), vec3(4.0)); w /= (w.x + w.y + w.z + 1e-4); p *= uGrainScale;
  return texture2D(uGrain, p.yz).r * w.x + texture2D(uGrain, p.zx + 0.37).r * w.y + texture2D(uGrain, p.xy + 0.71).r * w.z; }`)
      .replace('#include <color_fragment>', `#include <color_fragment>
{ float g = clayTri(vClayP, normalize(vClayN)) - 0.5; diffuseColor.rgb *= 1.0 + g * uGrainAmt * 2.0; }`)
      .replace('#include <opaque_fragment>', `{ // rounded matte read: grazing faces gather a touch of pigment (no rim light, no gloss)
  float f = 1.0 - clamp(dot(normalize(vNormal), normalize(vViewPosition)), 0.0, 1.0);
  outgoingLight *= 1.0 - uRound * f * f; }
#include <opaque_fragment>`);
  };
  m.customProgramCacheKey = () => 'fold-clay';
  return m;
}

// Swap every plain material under `root` for clay in the unified palette.
// Materials with their own shader hooks (wind sway, water) are kept, only their colour is remapped.
const cache = new Map();
export function remapColor(c){
  const hex = c.getHex(); if (hex === 0xffffff) return c.clone();
  const n = nearestPal(hex), p = new THREE.Color(n.hex), o = c.clone();
  // keep 25% of the module's own value so lit/shade variants inside a family survive
  const ol = o.r * .3 + o.g * .59 + o.b * .11, pl = p.r * .3 + p.g * .59 + p.b * .11;
  p.multiplyScalar(THREE.MathUtils.lerp(1, ol / Math.max(pl, 1e-3), 0.25));
  return p;
}
export function reskin(root, { skip = () => false, grain = 6 } = {}){
  let n = 0;
  root.traverse(o => {
    if (!o.isMesh || skip(o)) return;
    const swap = (mat) => {
      if (!mat || mat.isShaderMaterial || mat.isRawShaderMaterial || mat.isMeshBasicMaterial || mat.transparent || mat.alphaTest > 0) return mat;
      if (mat.onBeforeCompile !== THREE.Material.prototype.onBeforeCompile && !mat.userData.clay){ if (mat.color) mat.color.copy(remapColor(mat.color)); return mat; }
      if (mat.userData.clay) return mat;
      const key = mat.uuid; if (cache.has(key)) return cache.get(key);
      const cm = clayMaterial({ color: mat.color ? remapColor(mat.color) : 0xffffff, vertexColors: mat.vertexColors, side: mat.side, grain });
      cache.set(key, cm); n++; return cm;
    };
    o.material = Array.isArray(o.material) ? o.material.map(swap) : swap(o.material);
  });
  return n;
}
