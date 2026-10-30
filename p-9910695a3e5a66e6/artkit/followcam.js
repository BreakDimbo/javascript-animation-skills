// 褶星 Fold — b1: spring-arm follow camera on a sphere (radial up, parallel-transported yaw).
import * as THREE from '../shared/vendor/three.module.js';

export function createFollowCam(camera, dom = window) {
  const cam = {
    camera, yaw: null, pitch: 0.22, dist: 2.0, h: 0.45, lastDrag: -9, t: 0,
    pos: new THREE.Vector3(), upS: new THREE.Vector3(), look: new THREE.Vector3(), init: false,
    forward() { return cam.yaw; },
  };
  let drag = null;
  dom.addEventListener('pointerdown', e => { drag = { x: e.clientX, y: e.clientY }; });
  addEventListener('pointerup', () => drag = null);
  addEventListener('pointermove', e => {
    if (!drag) return; const dx = e.clientX - drag.x, dy = e.clientY - drag.y; drag = { x: e.clientX, y: e.clientY };
    cam.dYaw = (cam.dYaw || 0) - dx * 0.006; cam.pitch = Math.max(0.0, Math.min(0.75, cam.pitch + dy * 0.003)); cam.lastDrag = cam.t;
  });
  const _q = new THREE.Quaternion(), _v = new THREE.Vector3(), _d = new THREE.Vector3();

  cam.update = (dt, cat) => {
    dt = Math.max(0, Math.min(dt, 0.05)); cam.t += dt;
    const up = cat.up;
    if (!cam.yaw) { cam.yaw = cat.fwd.clone(); cam.prevUp = up.clone(); }
    // parallel transport the camera yaw along with the cat
    _q.setFromUnitVectors(cam.prevUp, up); cam.yaw.applyQuaternion(_q); cam.prevUp.copy(up);
    if (cam.dYaw) { _q.setFromAxisAngle(up, cam.dYaw); cam.yaw.applyQuaternion(_q); cam.dYaw = 0; }
    // lazy auto-follow behind the cat when moving and the player isn't steering the camera
    if (cat.speed > 0.3 && cam.t - cam.lastDrag > 2.5) {
      const ang = Math.atan2(_v.crossVectors(cam.yaw, cat.fwd).dot(up), cam.yaw.dot(cat.fwd));
      if (Math.abs(ang) < 2.4) { _q.setFromAxisAngle(up, ang * Math.min(1, dt * (0.6 + cat.speed * 0.25))); cam.yaw.applyQuaternion(_q); }
    }
    cam.yaw.addScaledVector(up, -cam.yaw.dot(up)).normalize();

    const sprint = cat.gait === 'sprint', rest = cat.state === 'sleep' || cat.state === 'sit';
    const tDist = sprint ? 3.0 : cat.gait === 'trot' ? 2.3 : rest ? 1.6 : 1.9;
    cam.dist += (tDist - cam.dist) * Math.min(1, dt * 1.6);
    const hh = 0.35 + cam.pitch / 0.75 * 0.25 + (sprint ? 0.05 : 0); // 0.35–0.6 m above ground
    const target = _d.copy(cat.pos).addScaledVector(up, 0.17 + (cat.alt - (cat.ground || 0)) * -0.3);
    const want = target.clone().addScaledVector(cam.yaw, -cam.dist).addScaledVector(up, hh - 0.17);
    // keep the camera above the sphere surface
    const minR = cat.R + 0.25 + (cam.heightAt ? cam.heightAt(want.clone().normalize()) : 0); if (want.length() < minR) want.setLength(minR);
    if (!cam.init) { cam.pos.copy(want); cam.upS.copy(up); cam.look.copy(target); cam.init = true; }
    const k = 1 - Math.exp(-dt * 6), kl = 1 - Math.exp(-dt * 10);
    cam.pos.lerp(want, k); cam.look.lerp(target, kl); cam.upS.lerp(up, k).normalize();
    camera.position.copy(cam.pos); camera.up.copy(cam.upS);
    camera.lookAt(cam.look.clone().addScaledVector(cam.yaw, 0.25));
  };
  return cam;
}
