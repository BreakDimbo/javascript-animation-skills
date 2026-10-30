// 褶星 Fold art kit — the sheep scene's camera, following the cat over the sphere.
// Same lens as the replica's solved reference camera (layout.js cam: vfov 17.32°, elevation 24.5°, narrow screens keep
// the reference horizontal FOV), distance scaled so the cat is as big on screen as a sheep is in the reference
// (FINAL17: sheep ≈ 4.9 % of frame width ≈ 1.33 board units at 53.6 units → cat 0.45 m ⇒ 18.2 m).
// Heading is parallel-transported with the cat (never swings behind it); drag orbits, wheel/pinch zooms, H = home view.
import * as THREE from '../shared/vendor/three.module.js';
export const SHEEP_CAM = { vfov: 17.3237, aspect: 2376 / 1432, elev: Math.atan2(22.2, Math.hypot(-1.8776, 48.7275)), azim: Math.atan2(-1.8776, 48.7275), dist0: 53.62, sheepUnits: 1.33 };
export function createDioramaCam(camera, dom, { catLen = 0.45 } = {}){
  const HOME_D = SHEEP_CAM.dist0 * catLen / SHEEP_CAM.sheepUnits;
  const cam = { camera, D: HOME_D, Dt: HOME_D, elev: SHEEP_CAM.elev, elevT: SHEEP_CAM.elev, yaw: null, prevUp: null, target: new THREE.Vector3(), init: false, HOME_D,
    forward(){ return cam.yaw; }, home(){ cam.Dt = HOME_D; cam.elevT = cam.homeElev; cam.dragged = false; } };
  const fit = () => { const a = innerWidth / innerHeight, t = Math.tan(THREE.MathUtils.degToRad(SHEEP_CAM.vfov / 2)), R = SHEEP_CAM.aspect;
    const tt = a < R ? t * R / a * (a < 1 ? 1.04 : 1) : t; camera.fov = THREE.MathUtils.radToDeg(2 * Math.atan(tt)); camera.aspect = a; camera.updateProjectionMatrix();
    // portrait: the wider vertical lens would show sky-paper above the horizon, so tilt down until the top ray dips as in the reference
    cam.homeElev = Math.max(SHEEP_CAM.elev, THREE.MathUtils.degToRad(camera.fov / 2) + SHEEP_CAM.elev - THREE.MathUtils.degToRad(SHEEP_CAM.vfov / 2)); if (!cam.dragged) cam.elev = cam.elevT = cam.homeElev; };
  fit(); addEventListener('resize', fit);
  let drag = null, pinch = null; const pts = new Map();
  dom.addEventListener('pointerdown', e => { if (e.pointerType === 'touch' && e.clientX < innerWidth / 2) return; pts.set(e.pointerId, [e.clientX, e.clientY]); drag = [e.clientX, e.clientY]; });
  addEventListener('pointerup', e => { pts.delete(e.pointerId); drag = null; pinch = null; });
  addEventListener('pointermove', e => {
    if (!pts.has(e.pointerId)) return; pts.set(e.pointerId, [e.clientX, e.clientY]);
    if (pts.size === 2){ const [a, b] = [...pts.values()], d = Math.hypot(a[0] - b[0], a[1] - b[1]); if (pinch) cam.Dt = THREE.MathUtils.clamp(cam.Dt * pinch / d, HOME_D * .5, HOME_D * 3); pinch = d; return; }
    if (!drag) return; const dx = e.clientX - drag[0], dy = e.clientY - drag[1]; drag = [e.clientX, e.clientY];
    cam.dYaw = (cam.dYaw || 0) - dx * 0.005; cam.elevT = THREE.MathUtils.clamp(cam.elevT + dy * 0.003, 0.22, 1.35); cam.dragged = true;
  });
  dom.addEventListener('wheel', e => { cam.Dt = THREE.MathUtils.clamp(cam.Dt * Math.exp(e.deltaY * 0.001), HOME_D * .5, HOME_D * 3); e.preventDefault(); }, { passive: false });
  addEventListener('keydown', e => { if (e.code === 'KeyH') cam.home(); });
  const _q = new THREE.Quaternion(), off = new THREE.Vector3(), _goal = new THREE.Vector3(), _tu = new THREE.Vector3();   // perf: per-frame scratch
  cam.update = (dt, cat) => {
    dt = Math.min(dt, 0.05); const up = cat.up;
    if (!cam.yaw){ cam.yaw = (cam.initYaw || cat.fwd).clone(); cam.prevUp = up.clone(); }
    _q.setFromUnitVectors(cam.prevUp, up); cam.yaw.applyQuaternion(_q); cam.prevUp.copy(up);
    if (cam.dYaw){ _q.setFromAxisAngle(up, cam.dYaw); cam.yaw.applyQuaternion(_q); cam.dYaw = 0; }
    cam.yaw.addScaledVector(up, -cam.yaw.dot(up)).normalize();
    // smooth follow: target eases to the cat's ground point (jumps don't bob the frame)
    const goal = _goal.copy(up).multiplyScalar(cat.R + (cat.ground ?? cat.alt) + 0.1);
    if (!cam.init){ cam.target.copy(goal); cam.init = true; } else cam.target.lerp(goal, 1 - Math.exp(-dt * 3.2));
    const k = 1 - Math.exp(-dt * 5); cam.D += (cam.Dt - cam.D) * k; cam.elev += (cam.elevT - cam.elev) * k;
    const tu = _tu.copy(cam.target).normalize();
    off.copy(cam.yaw).multiplyScalar(-Math.cos(cam.elev)).addScaledVector(tu, Math.sin(cam.elev)).multiplyScalar(cam.D);
    camera.position.copy(cam.target).add(off); camera.up.copy(tu); camera.lookAt(cam.target);
    // board ↔ planet: at the home distance one ragged board sits on paper (FINAL17 framing: 6.6 × 9.2 m, centred 0.75 m beyond the
    // target like the reference board); zooming out past ~1.4× grows it into the whole curved planet
    const z = cam.D / HOME_D, pl = THREE.MathUtils.smoothstep(z, 1.4, 2.3), k2 = catLen / 0.45;
    const F = cam.board.F.copy(cam.target).addScaledVector(cam.yaw, 0.75 * k2).normalize();
    cam.board.X.crossVectors(cam.yaw, F).normalize(); cam.board.Y.crossVectors(F, cam.board.X).normalize();
    cam.board.hx = 3.3 * k2 * (1 + pl * pl * 14); cam.board.hy = 4.6 * k2 * (1 + pl * pl * 14);
    cam.board.margin = pl > 0.97 ? 0 : 0.08; cam.board.planet = pl; cam.board.bendR = pl > 0.01 ? THREE.MathUtils.lerp(600, 42, Math.sqrt(pl)) : 0;
  };
  cam.board = { F: new THREE.Vector3(), X: new THREE.Vector3(), Y: new THREE.Vector3(), hx: 3.3, hy: 4.6, margin: 0.6, planet: 0, bendR: 0 };
  return cam;
}
