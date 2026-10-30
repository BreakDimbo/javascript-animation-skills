// 小站 · paint: the cat's shading language for every station object (review-vd-station-r1 §1).
// MeshToonMaterial (specular 0, roughness 1, no rim / fresnel / env): 3 soft value bands 1.00 / .88 / .76 (smoothstep .36–.64 of the toon coordinate),
// plus, in object space: ±4 % directional stroke grain (strokes ≈ 1/8 of the object's short edge, along its long axis on horizontal faces),
// a low-frequency ±4 % value / ±2° hue mottle (uneven gouache), and a soft +5 % chalk-lightening on upward-facing outer edges.
import * as THREE from '../../shared/vendor/three.module.js';

let GRAD = null;
export function bandsTex(){
  if (GRAD) return GRAD;
  const n = 256, d = new Uint8Array(n), ss = THREE.MathUtils.smoothstep;
  for (let i = 0; i < n; i++){ const c = i / (n - 1); d[i] = Math.round(255 * (.76 + .12 * ss(c, .33, .39) + .12 * ss(c, .61, .67))); }
  GRAD = new THREE.DataTexture(d, n, 1, THREE.RedFormat); GRAD.minFilter = GRAD.magFilter = THREE.LinearFilter; GRAD.needsUpdate = true; return GRAD;
}
const NOISE = `
float stH(vec3 p){ p = fract(p * vec3(.1031, .1030, .0973)); p += dot(p, p.yxz + 33.33); return fract((p.x + p.y) * p.z); }
float stN(vec3 p){ vec3 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f);
  return mix(mix(mix(stH(i), stH(i + vec3(1,0,0)), f.x), mix(stH(i + vec3(0,1,0)), stH(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(stH(i + vec3(0,0,1)), stH(i + vec3(1,0,1)), f.x), mix(stH(i + vec3(0,1,1)), stH(i + vec3(1,1,1)), f.x), f.y), f.z); }
vec3 stHue(vec3 c, float a){ // small hue rotation (YIQ)
  float Y = dot(c, vec3(.299, .587, .114)), I = dot(c, vec3(.596, -.274, -.322)), Q = dot(c, vec3(.211, -.523, .312));
  float cs = cos(a), sn = sin(a); float I2 = I * cs - Q * sn, Q2 = I * sn + Q * cs;
  return vec3(Y + .956 * I2 + .621 * Q2, Y - .272 * I2 - .647 * Q2, Y - 1.106 * I2 + 1.703 * Q2); }`;

// opts: color, vertexColors, axis [x,y,z] (object long axis), stroke (strokes per object unit along the axis), mottle (blobs per unit), chalk (0..0.08), seed
export function paintMaterial(opts = {}){
  const m = new THREE.MeshToonMaterial({ color: opts.color ?? 0xffffff, vertexColors: !!opts.vertexColors, gradientMap: bandsTex(), side: opts.side ?? THREE.FrontSide });
  const ax = new THREE.Vector3(...(opts.axis || [1, 0, 0])).normalize();
  const u = { uStAxis: { value: ax }, uStK: { value: new THREE.Vector3(opts.stroke ?? 16, (opts.stroke ?? 16) * 5, opts.mottle ?? 3) },
    uStChalk: { value: Math.min(.08, opts.chalk ?? .05) }, uStSeed: { value: opts.seed ?? 0 } };
  m.userData.paint = u;
  m.onBeforeCompile = (s) => {
    Object.assign(s.uniforms, u);
    s.vertexShader = s.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vStP; varying vec3 vStN;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvStP = position; vStN = normal;');
    s.fragmentShader = s.fragmentShader.replace('#include <common>', `#include <common>
varying vec3 vStP; varying vec3 vStN; uniform vec3 uStAxis, uStK; uniform float uStChalk, uStSeed;${NOISE}`)
      .replace('#include <color_fragment>', `#include <color_fragment>
{ vec3 P = vStP + uStSeed * 7.13, N = normalize(vStN);
  // low-frequency mottle: value ±4 %, hue ±2°
  float mv = stN(P * uStK.z) * .65 + stN(P * uStK.z * 2.3 + 5.) * .35, mh = stN(P * uStK.z * .8 + 11.);
  diffuseColor.rgb = stHue(diffuseColor.rgb, (mh - .5) * .07) * (1. + (mv - .5) * .08);
  // directional stroke grain ±4 %: along the long axis projected into the face
  vec3 A = uStAxis - N * dot(uStAxis, N); A = dot(A, A) < .04 ? normalize(cross(N, vec3(0., 1., 0.)) + vec3(1e-4)) : normalize(A); vec3 B = cross(N, A);
  float g = stN(vec3(dot(P, A) * uStK.x, dot(P, B) * uStK.y, dot(P, N) * uStK.y + 3.)) * .7 + stN(vec3(dot(P, A) * uStK.x * 2.1, dot(P, B) * uStK.y * 1.7, 9.)) * .3;
  diffuseColor.rgb *= 1. + (g - .5) * .08;
  // chalky upward outer edges (+5 %, soft; sides and tops untouched)
  float e = smoothstep(.28, .5, N.y) * (1. - smoothstep(.8, .94, N.y));
  diffuseColor.rgb *= 1. + uStChalk * e; }`);
  };
  const key = `st-paint|${opts.vertexColors ? 1 : 0}`;
  m.customProgramCacheKey = () => key;
  return m;
}

// the platform top: 0.6 m flags (±5 % value, ±2° hue each), joints 12 % darker (2–3 cm, soft), a pale coping strip on the rail side,
// moss in the grass-side joints (fading toward the middle), grass creeping up the end ramps. All in the slab's object space (design units).
// P: { flag, joint, z0, z1, coping, xEnd, ramp, mossW } in object units
export function platformMaterial(P, opts = {}){
  const m = paintMaterial({ color: opts.color ?? '#b9ad98', axis: [1, 0, 0], stroke: opts.stroke ?? 22, mottle: 2.2, chalk: .05, seed: 5 });
  const prev = m.onBeforeCompile, u = { uPf: { value: new THREE.Vector4(P.flag, P.joint, P.z0, P.z1) }, uPc: { value: new THREE.Vector4(P.coping, P.xEnd, P.ramp, P.mossW) },
    uPcop: { value: new THREE.Color(opts.coping ?? '#d8ccb2') }, uPmoss: { value: new THREE.Color(opts.moss ?? '#8a9a5a') }, uPgrass: { value: new THREE.Color(opts.grass ?? '#8fab52') }, uPbase: { value: m.color } };
  m.onBeforeCompile = function (s, r){ prev.call(this, s, r); Object.assign(s.uniforms, u);
    s.fragmentShader = s.fragmentShader.replace('uniform float uStChalk, uStSeed;', 'uniform float uStChalk, uStSeed; uniform vec4 uPf, uPc; uniform vec3 uPcop, uPmoss, uPgrass, uPbase;')
      .replace('// chalky upward outer edges', `// flags, coping, moss
  if (N.y > .9){ float x = P.x - uStSeed * 7.13, z = P.z - uStSeed * 7.13;
    float cop = 1. - smoothstep(uPf.z + uPc.x - .006, uPf.z + uPc.x + .006, z);              // rail-side coping strip
    vec2 q = vec2(x / uPf.x, (z - uPf.z - uPc.x) / uPf.x), id = floor(q), f = fract(q);
    if (cop > .5){ q = vec2(x / (uPf.x * .75) + .37, 0.); id = vec2(floor(q.x), -7.); f = vec2(fract(q.x), .5); }
    float h1 = stH(vec3(id, 3.)), h2 = stH(vec3(id, 8.));
    vec3 base = mix(diffuseColor.rgb, uPcop * (diffuseColor.rgb / max(uPbase, vec3(.01))), cop);   // keep the mottle on the coping
    base = stHue(base, (h2 - .5) * .07) * (1. + (h1 - .5) * .1);
    vec2 jd = min(f, 1. - f) * uPf.x; float jw = uPf.y * (.85 + .3 * stN(vec3(x * 9., z * 9., 1.)));
    float jt = 1. - smoothstep(jw * .35, jw * .65, cop > .5 ? jd.x : min(jd.x, jd.y));
    // the coping's inner edge is itself a joint line
    jt = max(jt, 1. - smoothstep(jw * .35, jw * .65, abs(z - uPf.z - uPc.x)));
    base *= 1. - .12 * jt;
    // moss + small grass in the joints on the grass side (5–8 % of the area there), fading toward the middle
    float side = smoothstep(uPf.w - uPc.w, uPf.w, z), mo = stN(vec3(x * 14., z * 14., 4.)) * .6 + stN(vec3(x * 40., z * 40., 6.)) * .4;
    float moss = (1. - smoothstep(jw * .4, jw * 1.4, min(jd.x, jd.y))) * side * smoothstep(.42, .62, mo);
    moss = max(moss, side * side * smoothstep(.7, .78, mo) * .8);
    base = mix(base, uPmoss * (.92 + .16 * mo), clamp(moss, 0., 1.) * (1. - cop));
    // the grass creeps up the end ramps
    float ax = abs(x), rg = smoothstep(uPc.y + uPc.z * .25, uPc.y + uPc.z * 1.05, ax + (mo - .5) * uPc.z * .7);   // lower half of the ramp only, broken by the mottle
    base = mix(base, uPgrass * (.9 + .2 * mo), rg * smoothstep(.3, .6, mo + rg * .4) * .75);
    diffuseColor.rgb = base; }
  // chalky upward outer edges`)
      // r2.1 (review-vd-station-r2 §4): on the end ramps the chalk edge drops to +2 % and only along the ramp's top edge (the crest), none on the slope
      .replace('diffuseColor.rgb *= 1. + uStChalk * e; }', `float rx = abs(P.x - uStSeed * 7.13) - uPc.y;
  float ck = rx <= 0. ? uStChalk : .02 * (1. - smoothstep(uPc.z * .06, uPc.z * .18, rx));
  diffuseColor.rgb *= 1. + ck * e; }`);
  };
  m.customProgramCacheKey = () => 'st-paint|platform';
  return m;
}
