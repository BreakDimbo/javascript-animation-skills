// diorama clouds: small puffs floating ~3 m over the board (FINAL17 has one or two above the board's far edge); their shade is painted by the ground shader
import { createClouds } from '../../artkit/sprites.js';
import { R, qs, DEBUG, safe } from '../core/util.js';
import { F } from '../world.js';
import * as THREE from '../../shared/vendor/three.module.js';
import { BOARDU } from '../../artkit/bend.js';
import { boardSD } from '../journey/boardcull.js';

export function createCloudLayer(scene, heightAt){
  /* r6 BUG FIX: fixed clouds were placed at R + h, but the home ground sits ~1.1 m above R (heightAt), so they were buried under the turf.
     Heights are now above local ground. */
  const clouds = qs.has('noclouds') ? null : safe('clouds',
    () => createClouds(scene, R, F, [-45, 45, -45, 45], 14, 4,
  /* r7 #6: thinner far cloud field */ { size: [1.1, 2.0], alt: [2.6, 3.6], keepOut: [0.3, -3.5, 9],
  fixed: [[0.35, -2.25, .95, .72, 0], [-1.75, -2.35, .5, .78, 1]] /* QA D5: 1.2 / 0.6 m toward the home frame's near side (≈ 56 / 28 px @1440): the whole puff now sits over the board, its top ≈ 1 m inside the far edge */.map(([u, v, sz, h, c]) => [u, v, sz, h + heightAt(F.dirOf(u, v)), c]) }));
  return { update(dt, camera, T, ground){
    clouds?.update?.(dt, camera);
    if (clouds?.mesh){ paperPuff(clouds.mesh); edgeFade(clouds.mesh, camera, heightAt); }
    /* r10 #1: two big soft cloud shadows drift slowly over the home frame; centres in board-local metres, applied after lighting in ground.js */
    const CS = ground.uCS.value, csk = +(qs.get('csk') || 1);
    [[((T * .02 + 9) % 24) - 12, 1, 4.2], [12 - ((T * .015 + 8) % 24), -2.2, 3.4]].forEach(([u, v, r], i) => CS[i].set(u, v, 0, r * csk));
      /* board-local metres; ~20 and ~27 min per crossing, off-board before wrapping */
    if (DEBUG) window._cs = CS.map(c => c.toArray().map(x => +x.toFixed(4)));
  } };
}

/* VD MVP gate D5 (review-vd-mvp-gate §6, meadow @1440: the big puff read grey-green: ~50 % alpha over the turf, measured blue 135 between grass 65
   and cloud ~205). Two causes, two fixes:
   1. edgeFade sized each puff by its whole quad (top = 0.5 × quad height) though the painted puff fills only 57–66 % of the cell, so its top ray
      footprint was taken ~0.2 m too far out and the home-frame puff sat at k ≈ 0.5. Extents are now the painted ones (0.48 w, 0.33 h of the
      quad) and full opacity is reached 0.35 m inside the edge (was 0.6): the arrival frame's puffs are at k = 1 (core 0.95 / 0.92 instance alpha).
   2. paperPuff: the core is opaque (instance alpha ≥ 0.92 ≥ 0.85), colour = paper #f2ede2 with ≤ 4.5 % of the painted shading kept, and only the
      outer band (24 atlas px ≈ 17 % of the puff's half-height / 20 % of its inradius) is feathered: alpha = smoothstep(.5, 1, 16-tap ring mean)
      → 0 at the painted rim, 1 one band inside. No glow / rim / outline; the ground shadow (uCS) unchanged. */
const PAPER_PUFF = new THREE.Color('#f2ede2');
function paperPuff(mesh){ const m = mesh.material; if (m.userData.paperPuff) return; m.userData.paperPuff = 1;
  const a = 'vec4 c = texture2D(map, vUv); c.a *= vA;', b = 'vec3 col = c.rgb * uTint;';
  if (!m.fragmentShader.includes(a) || !m.fragmentShader.includes(b)){ console.warn('clouds: paperPuff patch not applied'); return; }
  m.uniforms.uPaper = { value: PAPER_PUFF };
  m.fragmentShader = m.fragmentShader.replace('uniform sampler2D map;', 'uniform sampler2D map; uniform vec3 uPaper;')
    .replace(a, `vec4 c = texture2D(map, vUv); float sR = 0.0; for (int i = 0; i < 8; i++){ float t = float(i) * 0.785398;
        vec2 o = vec2(cos(t), sin(t)) * 0.0234; sR += texture2D(map, vUv + o).a + texture2D(map, vUv + o * 0.5).a; }
      c.a = smoothstep(0.5, 1.0, sR / 16.0) * step(0.02, c.a) * vA;`)
    .replace(b, 'float lum = dot(c.rgb, vec3(.3, .59, .11)); vec3 col = uPaper * mix(.955, 1.0, smoothstep(.6, .85, lum));');
  m.needsUpdate = true; }

/* m-loop QA D5 (meadow @1440: a cloud half over the paper at the top edge). The billboard is only culled by its anchor's board SD, so a puff
   anchored just inside the far edge, ~3 m up, is drawn over the paper beyond it and then vanishes in one frame. Each puff now fades by where it
   APPEARS: the camera ray through its top / left / right extremes is followed down to the ground, and the worst board SD of those footprints
   sets its alpha (whole puff 0.35 m inside the edge → full (gate D5; was 0.6); an extreme 0.05 m inside → 0). No clip, nothing past the board edge. */
const _C = new THREE.Vector3(), _P = new THREE.Vector3(), _T = new THREE.Vector3(), _up = new THREE.Vector3(), _rt = new THREE.Vector3(), _toC = new THREE.Vector3();
function footSD(C, P, gR){ _T.subVectors(P, C); const L = _T.length(); _T.divideScalar(L); const b = C.dot(_T), c = C.lengthSq() - gR * gR, disc = b * b - c;
  if (disc < 0) return 1e3; const t = -b - Math.sqrt(disc); if (t <= 0) return 1e3; return boardSD(_P.copy(C).addScaledVector(_T, t)); }
let A0 = null;
export function edgeFadeAlpha(sd){ const t = Math.min(1, Math.max(0, (-.05 - sd) / .30)); return t * t * (3 - 2 * t); }
function edgeFade(mesh, camera, heightAt){ const g = mesh.geometry, aP = g.attributes.aPos, aU = g.attributes.aUp, aS = g.attributes.aSize, aA = g.attributes.aAlpha;
  if (!aA) return; if (!A0) A0 = Float32Array.from(aA.array);
  const live = BOARDU.F.value.w > 0; camera.getWorldPosition(_C);
  for (let i = 0; i < g.instanceCount; i++){
    let k = 1;
    if (live){ const P = new THREE.Vector3(aP.getX(i), aP.getY(i), aP.getZ(i)), gR = R + heightAt(_T.copy(P).normalize()); _up.set(aU.getX(i), aU.getY(i), aU.getZ(i)).normalize(); _toC.subVectors(_C, P);
      _rt.crossVectors(_up, _toC).normalize(); _up.crossVectors(_toC, _rt).normalize(); const hw = aS.getX(i) * .48, hh = aS.getY(i) * .33; /* gate D5: painted extents (cell w ≤ .957, h ≤ .656) */
      const sd = Math.max(footSD(_C, P.clone().addScaledVector(_up, hh), gR), footSD(_C, P.clone().addScaledVector(_rt, hw), gR), footSD(_C, P.clone().addScaledVector(_rt, -hw), gR), boardSD(P));
      k = edgeFadeAlpha(sd); }
    aA.setX(i, A0[i] * k); }
  aA.needsUpdate = true; }
