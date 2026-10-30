// lights (sheep replica: cool hemi + warm low sun, soft shadows), re-aimed in the cat's local frame
import * as THREE from '../../shared/vendor/three.module.js';
import { MOBILE } from './util.js';

const L = (r, g, b) => new THREE.Color().setRGB(r, g, b, THREE.LinearSRGBColorSpace);
export function createLights(scene){
  const hemi = new THREE.HemisphereLight(L(.40, .43, .72), L(.30, .34, .42), Math.PI); scene.add(hemi);
  const SUN_LOCAL = new THREE.Vector3(-13, 15, 1.5).normalize();
  const sun = new THREE.DirectionalLight(L(.60, .57, .28), Math.PI / SUN_LOCAL.y * .9); sun.castShadow = true;
  sun.shadow.mapSize.set(MOBILE ? 1024 : 2048, MOBILE ? 1024 : 2048); const SC = sun.shadow.camera;
  { const ex = /[?&]zoom=/.test(location.search) ? 14 : /[?&]close/.test(location.search) ? 2.6 : MOBILE ? 4 : 5.5; SC.left = SC.bottom = -ex; SC.right = SC.top = ex; }
  /* r8: tight follow frustum = 2x shadow texel density on the hero */
  SC.near = 1; SC.far = 80;
  sun.shadow.radius = +(new URLSearchParams(location.search).get('shr') || 6); /* d-cat: 4.5 -> 6 with the 5x5 bilinear PCF (to_designer_09: radius 6-8 / N=5); ?shr= */ sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.03; scene.add(sun, sun.target);
  const E1 = new THREE.Vector3(), N1 = new THREE.Vector3(), sd = new THREE.Vector3();
  // same board-light everywhere on the planet; returns the sun direction (local frame, unit not guaranteed) in `sd`
  function update(cat){
    const up = cat.up; E1.set(0, 1, 0).cross(up).normalize(); N1.crossVectors(E1, up);
    sd.copy(E1).multiplyScalar(SUN_LOCAL.x).addScaledVector(up, SUN_LOCAL.y).addScaledVector(N1, SUN_LOCAL.z);
    sun.target.position.copy(cat.pos); sun.position.copy(cat.pos).addScaledVector(sd, 40); hemi.position.copy(up);
    return sd;
  }
  return { hemi, sun, update, sd };
}
