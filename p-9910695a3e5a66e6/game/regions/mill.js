// 03 The Mill — b4 module shrunk by MS about its anchor
import * as THREE from '../../shared/vendor/three.module.js';
import { reskin } from '../../artkit/clay.js';
import { createMill } from '../../b4-mill/mill.js';
import { R, note, safe } from '../core/util.js';
import { REG, MS, uM, vM, millLocal } from '../world.js';
import { shrinkAbout, hideGround } from './landmark.js';
import { createMillLife } from '../animals/millyard.js';

export function createMillRegion(scene){
  const m = safe('mill', () => createMill(scene, { R, radius: R }, REG[2].dir));
  if (!m) return null;
  const S = shrinkAbout(m.group, REG[2].dir, MS); hideGround(m.group); note(`mill: ${reskin(m.group)} materials → clay`);
  const P = new THREE.Vector3(), U = new THREE.Vector3(), rad = 115 * MS;
  /* life: hens in the yard between the sacks and the cottage, the donkey grazing by the yard, all in b4-local metres */
  const life = safe('mill-life', () => createMillLife(m, { reskin, hens: [[-6.5, 12.5], [-4.5, 14.8], [-8.2, 15.6], [-5.8, 17.4]], donkeyAt: [-15, 13, 2.2] }));
  const CL = { x: 0, z: 0, speed: 0, sitting: false, cam: null }; let T = 0;
  return { id: 'mill', no: REG[2].no, name: REG[2].name, dir: REG[2].dir, cardRadius: 8, activeRadius: 60, scale: MS, group: m.group, module: m, life,
    avoid: [[REG[2].dir, 15 * MS + .8]],
    heightAt(d){ return d.angleTo(REG[2].dir) * R < rad ? MS * m.heightAt(S.unscale(P.copy(d).multiplyScalar(R), U).normalize().multiplyScalar(R)) : 0; },
    blocked: null,
    update(dt, { cat, fcam }){ m.update(dt, { position: S.unscale(cat.root.position), sitting: cat.state === 'sit' }); T += dt;
      if (life){ const [x, z] = millLocal(S.unscale(cat.root.position, U).normalize()); CL.x = x; CL.z = z; CL.speed = cat.speed || 0; CL.sitting = cat.state === 'sit'; CL.cam = fcam && fcam.camera ? fcam.camera.position : null; /* life r2: the dormouse peeks out on the camera side */
        life.update(dt, CL, T); } },
    setActive(on){ m.group.visible = on; },
    teleport: { u: uM - 2.4, v: vM + 0.6, lookAt: REG[2].dir } };
}
