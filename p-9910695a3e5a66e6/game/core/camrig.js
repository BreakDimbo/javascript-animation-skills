// the sheep-scene diorama camera: initial heading, per-frame board/bend/fade uniforms, and the ?close cat close-up
import * as THREE from '../../shared/vendor/three.module.js';
import { setBend, setBoard } from '../../artkit/bend.js';
import { createDioramaCam } from '../../artkit/dioramacam.js';
import { qs } from './util.js';

const BEND_R = +(qs.get('bend') ?? 42); // radius the ground appears to curve with around the focus (m)

export function createCamRig(camera, canvas, scene, FADE, ground){
  const fcam = createDioramaCam(camera, canvas), close = qs.has('close'), tmp = new THREE.Vector3();
  // lookAt: direction of a landmark to face (teleports look toward their landmark) or null → board 'north' (−v),
  // like the reference board seen from its long side
  function init(cat, lookAt){
    const a = +(qs.get('yaw') ?? 0.9); const up = cat.up; const e = new THREE.Vector3(0, 1, 0).cross(up).normalize(), n = e.clone().cross(up);
      cat.fwd.copy(e).multiplyScalar(Math.cos(a)).addScaledVector(n, Math.sin(a));
    const ch = +(qs.get('cyaw') ?? 0); fcam.initYaw = n.clone().negate().applyAxisAngle(up, ch);
    if (lookAt && !qs.has('cyaw')) fcam.initYaw = lookAt.clone().addScaledVector(up, -lookAt.dot(up)).normalize();
    if (qs.has('zoom')) fcam.D = fcam.Dt = fcam.HOME_D * +qs.get('zoom');
  }
  function update(dt, cat){
    fcam.update(dt, cat);
    const b = fcam.board;
    setBend(fcam.target.clone().normalize(), close ? 0 : (qs.has('bend') ? BEND_R : b.bendR));
    setBoard(b.F, b.X, b.Y, b.hx, b.hy, close || qs.has('noboard') ? 0 : b.margin);
    // planet mode: the watercolour fade is measured from the cat, not the camera (r3 bug: at 3× zoom the camera sat beyond the fade and saw only paper)
    const pl = b.planet, dz = fcam.D - fcam.HOME_D; ground.uFade.value.set(pl > .97 ? FADE[0] + dz : 1e4, pl > .97 ? FADE[1] + dz : 2e4, 9);
    scene.fog.near = pl > .97 ? FADE[0] - 4 + dz : 1e4; scene.fog.far = pl > .97 ? FADE[1] - 6 + dz : 2e4;
  }
  // called after the grid/lights: the close-up camera overrides the diorama pose
  function closeUp(cat){
    if (!close) return;
    camera.fov = 40; camera.updateProjectionMatrix(); const up = cat.up, side = tmp.crossVectors(cat.fwd, up).normalize();
    camera.position.copy(cat.pos).addScaledVector(cat.fwd, .55).addScaledVector(side, .38).addScaledVector(up, .22); camera.up.copy(up);
      camera.lookAt(cat.pos.clone().addScaledVector(up, .13));
    if (qs.has('eyecam')) { /* r11 eyes check (master 05a3e0a, ported): ?close&eyecam=<yaw deg, 0 = straight on, + = from the cat's right>&eyed=<m> frames the face; &eyeroll0 keeps world up */
      const eL = cat.root.getObjectByName('eyerimL'), eR = cat.root.getObjectByName('eyerimR'), hb = cat.root.getObjectByName('head'), tg = new THREE.Vector3(), N1 = new THREE.Vector3();
      if (eL && eR) tg.addVectors(eL.getWorldPosition(new THREE.Vector3()), eR.getWorldPosition(N1)).multiplyScalar(.5); else if (hb) hb.getWorldPosition(tg); else tg.copy(cat.pos).addScaledVector(cat.up, .2); if (qs.has('eyedrop')) tg.addScaledVector(cat.up, -qs.get('eyedrop')); /* d-cat: lower the target to frame the whole cat */
      const d = +(qs.get('eyed') || .5), f0 = eL && eR ? new THREE.Vector3().subVectors(eL.getWorldPosition(new THREE.Vector3()), N1).cross(cat.up).normalize() : cat.fwd.clone(); if (f0.dot(cat.fwd) < 0) f0.negate(); /* straight on = square to the eye line */
      const dir = f0.applyAxisAngle(cat.up, -(+qs.get('eyecam') || 0) * Math.PI / 180);
      camera.fov = 16; camera.updateProjectionMatrix(); camera.position.copy(tg).addScaledVector(dir, d).addScaledVector(cat.up, d * .1); camera.up.copy(cat.up);
      if (eL && eR && !qs.has('eyeroll0')) { const ln = new THREE.Vector3().subVectors(eL.getWorldPosition(new THREE.Vector3()), eR.getWorldPosition(new THREE.Vector3())).normalize(); camera.up.addScaledVector(ln, -camera.up.dot(ln)).normalize(); }
      camera.lookAt(tg); }
  }
  return { fcam, init, update, closeUp };
}
