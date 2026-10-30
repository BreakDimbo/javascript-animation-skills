// lights (sheep replica: cool hemi + warm low sun, soft shadows), re-aimed in the cat's local frame
import * as THREE from '../../shared/vendor/three.module.js';
import { MOBILE } from './util.js';
import { BOARDU } from '../../artkit/bend.js';

const L = (r, g, b) => new THREE.Color().setRGB(r, g, b, THREE.LinearSRGBColorSpace);
export function createLights(scene){
  const hemi = new THREE.HemisphereLight(L(.40, .43, .72), L(.30, .34, .42), Math.PI); scene.add(hemi);
  const SUN_LOCAL = new THREE.Vector3(-13, 15.6, 1.5).normalize();   // r3: 48.9° → 50.0° (platform contact shade ≤ 0.3 Hc)
  const sun = new THREE.DirectionalLight(L(.60, .57, .28), Math.PI / SUN_LOCAL.y * .9); sun.castShadow = true;
  sun.shadow.mapSize.set(MOBILE ? 1024 : 2048, MOBILE ? 1024 : 2048); const SC = sun.shadow.camera;
  const Q = new URLSearchParams(location.search), FIXED = Q.has('zoom') || Q.has('close');
  let EX0 = 5.5, ex = 0;
  { const ex = /[?&]zoom=/.test(location.search) ? 14 : /[?&]close/.test(location.search) ? 2.6 : MOBILE ? 4 : 5.5; SC.left = SC.bottom = -ex; SC.right = SC.top = ex; EX0 = ex; }
  /* r8: tight follow frustum = 2x shadow texel density on the hero */
  SC.near = 1; SC.far = 80;
  sun.shadow.radius = +(new URLSearchParams(location.search).get('shr') || 6); /* d-cat: 4.5 -> 6 with the 5x5 bilinear PCF (to_designer_09: radius 6-8 / N=5); ?shr= */ sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.03; scene.add(sun, sun.target);
  /* review-vd-station-r3 #2: the sun stays at 48.9° (≥ 38°: shadow length 0.87 × height). The ground shader takes no shadow-map shadows
     (ground shade = painted blobs), so shadow intensity stays 1 everywhere; ?shi= is a debug knob */
  sun.shadow.intensity = +(Q.get('shi') || 1);
  /* …and the shadow camera covers the whole painted board (it followed the cat at ±5.5 m and cut a straight diagonal edge across the far side
     of larger boards): centred on the board, half-extent ≥ the board's half-diagonal + 0.6 m (prop heights); ?zoom / ?close keep theirs */
  const BC = new THREE.Vector3(), _fx = new THREE.Vector3(), _fy = new THREE.Vector3();
  const fitBoard = (cat) => { const F = BOARDU.F.value, X = BOARDU.X.value, Y = BOARDU.Y.value; let e = EX0;
    if (!FIXED && F.w > 0 && F.x * cat.up.x + F.y * cat.up.y + F.z * cat.up.z > .99){ e = Math.max(EX0, Math.hypot(X.w, Y.w) + .6); BC.set(F.x, F.y, F.z).normalize().multiplyScalar(cat.pos.length()); }
    else BC.copy(cat.pos);
    if (Math.abs(e - ex) > 1e-3){ ex = e; SC.left = SC.bottom = -e; SC.right = SC.top = e; SC.updateProjectionMatrix(); }
    return BC; };
  const E1 = new THREE.Vector3(), N1 = new THREE.Vector3(), sd = new THREE.Vector3();
  // same board-light everywhere on the planet; returns the sun direction (local frame, unit not guaranteed) in `sd`
  function update(cat){
    const up = cat.up; E1.set(0, 1, 0).cross(up).normalize(); N1.crossVectors(E1, up);
    sd.copy(E1).multiplyScalar(SUN_LOCAL.x).addScaledVector(up, SUN_LOCAL.y).addScaledVector(N1, SUN_LOCAL.z);
    const c = fitBoard(cat); sun.target.position.copy(c); sun.position.copy(c).addScaledVector(sd, 40); hemi.position.copy(up);
    return sd;
  }
  return { hemi, sun, update, sd, shadowInfo: () => ({ ex, centre: BC.toArray(), intensity: sun.shadow.intensity, elevDeg: Math.asin(SUN_LOCAL.y) * 180 / Math.PI }) };
}
