// 03 The Mill — b4 module shrunk by MS about its anchor
import * as THREE from '../../shared/vendor/three.module.js';
import { reskin } from '../../artkit/clay.js';
import { createMill } from '../../b4-mill/mill.js';
import { R, note, safe } from '../core/util.js';
import { REG, MS, uM, vM, millLocal, MILL_AT, millSweepSD } from '../world.js';
import { shrinkAbout, hideGround } from './landmark.js';
import { createMillLife } from '../animals/millyard.js';
import { cullRegion } from '../journey/boardcull.js';

export function createMillRegion(scene){
  const m = safe('mill', () => createMill(scene, { R, radius: R }, REG[2].dir));
  if (!m) return null;
  /* QA #20: the windmill (b4's tower + sails group) re-seated beside the arrival spot, door to the camera, 0.85 × — see world.js MILL_AT */
  safe('mill-pose', () => { const w = m.group.children.find(o => o.isGroup && o.children.some(k => k.geometry?.parameters?.radiusBottom === 2.6));
    if (w){ m.frame(w, MILL_AT.x, MILL_AT.z, MILL_AT.yaw, -.3); w.scale.setScalar(MILL_AT.s); } });
  const S = shrinkAbout(m.group, REG[2].dir, MS); hideGround(m.group); note(`mill: ${reskin(m.group)} materials → clay`);
  const P = new THREE.Vector3(), U = new THREE.Vector3(), rad = 115 * MS;
  /* life: hens in the yard between the sacks and the cottage, the donkey grazing by the yard, all in b4-local metres */
  const life = safe('mill-life', () => createMillLife(m, { reskin, hens: [[-6.5, 12.5], [-4.5, 14.8], [-8.2, 15.6], [-5.8, 17.4]], donkeyAt: [-15, 13, 2.2] }));
  /* r1.4: props culled whole near the board edge (journey/boardcull.js): wheat stalks (instanced), sacks, the dormouse, donkey, hens and
     their shades (CPU, with their shadows); the windmill and the cottage are buildings and keep the fragment clip */
  const bc = safe('mill-cull', () => { const c = cullRegion(m.group); note(`mill board-cull: ${c.instanced.length} instanced, ${c.props.length} props`); return c; });
  const CL = { x: 0, z: 0, speed: 0, sitting: false, cam: null }; let T = 0;
  /* life r1: keep the cat out of the low sail sweep (world.js MILL_SWEEP); escapable — never trap a cat already inside */
  const B = new THREE.Vector3(), cosB = Math.cos(40 * MS / R); let catIn = false;
  const inSweep = (d) => { const [x, z] = millLocal(S.unscale(B.copy(d).multiplyScalar(R), B).normalize()); return millSweepSD(x, z) < 0; };
  return { id: 'mill', no: REG[2].no, name: REG[2].name, dir: REG[2].dir, cardRadius: 8, activeRadius: 60, scale: MS, group: m.group, module: m, life,
    avoid: [[REG[2].dir, 15 * MS + .8]],
    heightAt(d){ return d.angleTo(REG[2].dir) * R < rad ? MS * m.heightAt(S.unscale(P.copy(d).multiplyScalar(R), U).normalize().multiplyScalar(R)) : 0; },
    blocked(d){ return d.dot(REG[2].dir) > cosB && !catIn && inSweep(d); },
    update(dt, { cat, fcam }){ if (bc) bc.update(); catIn = inSweep(U.copy(cat.root.position).normalize()); m.update(dt, { position: S.unscale(cat.root.position), sitting: cat.state === 'sit' }); T += dt;
      if (life){ const [x, z] = millLocal(S.unscale(cat.root.position, U).normalize()); CL.x = x; CL.z = z; CL.speed = cat.speed || 0; CL.sitting = cat.state === 'sit'; CL.cam = fcam && fcam.camera ? fcam.camera.position : null; /* life r2: the dormouse peeks out on the camera side */
        life.update(dt, CL, T); } },
    setActive(on){ m.group.visible = on; },
    teleport: { u: uM - 2.4, v: vM + 0.6, lookAt: REG[2].dir } };
}
