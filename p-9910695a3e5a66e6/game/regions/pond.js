// 06 The Pond — b3 module shrunk by PS about its anchor, recoloured to the river's gouache blues
import * as THREE from '../../shared/vendor/three.module.js';
import { reskin } from '../../artkit/clay.js';
import { createPond, terrainH as pondH } from '../../b3-pond/pond.js';
import { R, note, safe } from '../core/util.js';
import { REG, PS, uP, vP, pondLocal } from '../world.js';
import { shrinkAbout, hideGround } from './landmark.js';
import { createDuckShy } from '../animals/ducks.js';

export function createPondRegion(scene){
  const m = safe('pond', () => createPond(scene, { R, radius: R }, REG[1].dir));
  if (!m) return null;
  m.group.traverse((o) => { const u = o.material?.uniforms;
    if (u?.uBand) { u.uBand.value = ['#2f63b8', '#3f7fd0', '#5f9adb',
      '#86b6e6'].map((h) => new THREE.Color(h)); u.uFoam.value.set('#e6eef2'); u.uLine.value.set('#cfe2f4'); } // same gouache blues as the river
    // reeds: diorama tufts
    if (o.isInstancedMesh && !o.userData.short){ o.geometry.computeBoundingBox(); const bb = o.geometry.boundingBox;
      if (bb.max.y - bb.min.y > .5){ o.geometry.scale(1, .45, 1); o.userData.short = 1; } } });
  const S = shrinkAbout(m.group, REG[1].dir, PS); hideGround(m.group); note(`pond: ${reskin(m.group)} materials → clay`);
  const P = new THREE.Vector3(), U = new THREE.Vector3(), rad = 23 * PS;
  const shy = safe('pond-life', () => createDuckShy(m));
  return { id: 'pond', no: REG[1].no, name: REG[1].name, dir: REG[1].dir, cardRadius: 8, activeRadius: 60, scale: PS, group: m.group, module: m, life: shy,
    avoid: [[REG[1].dir, 21 * PS + .8]],
    heightAt(d){ if (d.angleTo(REG[1].dir) * R >= rad) return 0;
      const [x, z] = pondLocal(S.unscale(P.copy(d).multiplyScalar(R), U).normalize()), r = Math.hypot(x, z);
      return r < 23 ? PS * pondH(x, z) * (1 - THREE.MathUtils.smoothstep(r, 17, 22.5)) : 0; },
    blocked(d){ const [x, z] = pondLocal(d); return Math.hypot(x, z) < 22 && pondH(x, z) < -0.07; }, // old cat: won't wade past the shelf
    update(dt, { cat, fcam }){ const l = m.toLocal(S.unscale(cat.root.position).normalize().multiplyScalar(cat.root.position.length())); m.update(dt,
      { x: l.x, z: l.z, h: l.h, on: null }); if (shy) { let cm = null; if (fcam && fcam.camera){ const c = m.toLocal(S.unscale(fcam.camera.position)); cm = [c.x, c.z]; } shy.update(dt, { x: l.x, z: l.z, speed: cat.speed || 0, cam: cm }); } }, /* life: ducks paddle off the cat's bank, wake rings */
    setActive(on){ m.group.visible = on; },
    teleport: { u: uP - 19 * PS, v: vP + 3 * PS, lookAt: REG[1].dir } };
}
