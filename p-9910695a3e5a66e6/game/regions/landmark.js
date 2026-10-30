// shared by pond.js / mill.js: diorama scale (shrink a full-size module about its anchor) and the module-ground hider
import * as THREE from '../../shared/vendor/three.module.js';
import { R } from '../core/util.js';

// the module keeps thinking in full-size coordinates: scale the group about A, and `unscale` world points before asking it
export function shrinkAbout(group, dir, s){
  const A = dir.clone().multiplyScalar(R);
  group.scale.setScalar(s); group.position.copy(A).multiplyScalar(1 - s); group.updateMatrixWorld(true);
  return { A, s, unscale: (p, out = new THREE.Vector3()) => out.copy(p).sub(A).multiplyScalar(1 / s).add(A) };
}

// hide the module ground (its palette was the mismatch), keep everything standing on it
export const hideGround = (grp) => grp.traverse(o => {
  if (o.isMesh && !o.isInstancedMesh && !o.material.isShaderMaterial && o.geometry.attributes.position.count > 3000){
    o.geometry.computeBoundingSphere(); if (o.geometry.boundingSphere.radius > 15) o.visible = false;
  }
});
