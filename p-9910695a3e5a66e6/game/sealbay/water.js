// 海豹湾 Seal Bay — the watercolour water + bank patch: ONE bend-hooked mesh following the sphere, custom shader.
// Ultra-Water's Gerstner sum (b3-pond) still moves the surface: it displaces where the washes are sampled and adds a ≤3 % slope
// tone. Shading is watercolour only: no specular, reflection, fresnel, caustics or foam.
import * as THREE from '../../shared/vendor/three.module.js';
import { MF_GLSL } from '../../artkit/minifields.js';
import { PAL } from '../../artkit/palette.js';
import { BAY_GLSL } from './shape.js';
import { INK_M, BANK_M } from './ink.js';

export const NRIP = 12, NSEAL = 5, NKAY = 2;
const hex = (h) => `vec3(${[1, 3, 5].map(i => (parseInt(h.slice(i, i + 2), 16) / 255).toFixed(3)).join(', ')})`;
const GL = `
float h21(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float vn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f);
  return mix(mix(h21(i), h21(i + vec2(1., 0.)), f.x), mix(h21(i + vec2(0., 1.)), h21(i + 1.), f.x), f.y); }
float fbm(vec2 p){ float a = .5, s = 0.; for (int i = 0; i < 5; i++){ s += a * vn(p); p = p * 2.03 + vec2(17.1, 9.3); a *= .5; } return s; }
float fbm3(vec2 p){ float a = .5, s = 0.; for (int i = 0; i < 3; i++){ s += a * vn(p); p = p * 2.03 + vec2(17.1, 9.3); a *= .5; } return s * 1.143; }
${BAY_GLSL}
// Ultra-Water (b3-pond) Gerstner sum: horizontal displacement + slope; deep-water dispersion, slowed for the miniature
#define WV(dx, dy, lam, A, ph) { float k = 6.2832 / lam, a = k * (dx * p.x + dy * p.y) - sqrt(9.81 * k) * .3 * uTime + ph; off += A * cos(a) * vec2(dx, dy); sl += A * k * cos(a) * vec2(dx, dy); }
void waves(vec2 p, out vec2 off, out vec2 sl){ off = vec2(0.); sl = vec2(0.);
  WV(.8, .6, 4.1, .08, 0.4) WV(-.5, .87, 2.6, .055, 2.1) WV(.97, -.26, 1.7, .035, 4.0) WV(-.9, -.44, .9, .016, 1.2) }
vec2 rot(vec2 v, float a){ float c = cos(a), s = sin(a); return vec2(c * v.x + s * v.y, -s * v.x + c * v.y); }
float line(float d, float w){ return 1. - smoothstep(w * .5, w * 1.25, abs(d)); }
const vec3 PEDGE = vec3(.290, .373, .710), PCORE = vec3(.149, .208, .498), MIDC = vec3(.427, .525, .839);
#define MIDA .645
#define MIDK .89
/* r6 (vd r5 §1): deep pools as wet-in-wet pooled pigment. F = sum of 3–5 overlapping anisotropic sub-blobs (diameters ≥ 3:1),
   body #4a5fb5 → #3e52a8 with ±10 % low-frequency tone, a small #26357f core leaning to the shadow side, a soft outward bloom
   (#4a5fb5 → #6d86d6 → wash, ≈ 35 % of the radius), and on the shadow side only (≈ 20 % of the rim) a smooth back-run edge:
   a 1–2 px #22306f pigment line with a 2–4 px paler #5a6fc0 halo outside it. No jaggies. */
const vec3 PB0 = vec3(.243, .322, .659), PB1 = vec3(.290, .373, .710), PLINE = vec3(.133, .188, .435), PBAND = vec3(.200, .275, .561), MID2 = vec3(.357, .455, .812);
const vec2 SHD = vec2(.993, .118);                                                     // shadow side: the sun comes from −x
vec2 pw(vec2 s, float sd, float a){ return s + (vec2(fbm3(s * 1.3 + sd), fbm3(s * 1.3 + sd + 9.)) - .5) * a + (vec2(fbm3(s * 3.1 + sd), fbm3(s * 3.1 + sd + 4.)) - .5) * a * .3; }
float sbl(vec2 s, vec2 c, vec2 r, float a){ vec2 d = rot(s - c, a) / r; return exp(-dot(d, d)); }
vec3 poolF(vec3 col, vec2 s, float F, vec2 c, float R, float sd, float hk, float ck, out float hardOut){
  hardOut = 0.;
  F += (fbm3(s * 2.1 + sd) - .5) * .16 + (fbm3(s * 5.3 + sd * 2.) - .5) * .03;         // breaks the outline, low frequency only
  if (F < .08) return col;
  float fw = max(fwidth(F), 1e-4);
  vec2 dir = normalize(s - c + 1e-4);
  float hs = smoothstep(.70, .86, dot(dir, SHD) + (fbm3(s * .9 + sd * 3.) - .5) * .22) * hk;
  float body = mix(smoothstep(.34, .78, F), smoothstep(.5 - fw, .5 + fw, F), hs);
  float tn = fbm3(s * 1.25 + sd * 5.), lf = 1. + (tn - .5) * .5 + (fbm3(s * 3.4 + sd) - .5) * .08;   // ≈ ±10 % tone inside
  vec3 bc = mix(PB1, PB0, clamp(smoothstep(.55, 1., F) * .7 + (tn - .5) * 1.2, 0., 1.)) * lf;
  float coreF = F + dot(s - c, SHD) / R * .3 + (fbm3(s * 2.7 + sd) - .5) * .22;
  /* r7.1 (vd r7): ck < 1 pulls the core colour toward the body (C1: 30 %) and feathers its edge over >= 9 px so it never reads as a lens/pupil */
  float cfw = mix(.38, max(.38, 9. * fwidth(coreF)), step(ck, .99));
  bc = mix(bc, mix(bc, PCORE * (1. + (lf - 1.) * .5), ck), smoothstep(1.02, 1.02 + cfw, coreF) * .85);
  float bloom = smoothstep(.1, .45, F) * (1. - hs);
  vec3 o = mix(col, mix(MIDC, PB1, smoothstep(.3, .55, F)), bloom * .8);
  o = mix(o, bc, body);
  /* r7 (vd r6 §1): no drawn rim. On the shadow side the pigment piles up just inside the edge: a 4–6 px #33468f band fading over
     8–10 px into the body, the outside simply stops within ~2 px; the band's strength is mottled along the rim so it never reads as a line */
  float dpx = (F - .5) / fw;                                                              // pixels from the hard rim (+ inside)
  float mot = .55 + .45 * smoothstep(.3, .7, fbm3(s * 7.3 + sd * 4.)) , band = smoothstep(.5, 3.5, dpx) * (1. - smoothstep(mix(1.5, 5.5, ck * ck), 15., dpx)) * hs;
  o = mix(o, mix(bc, PBAND, ck) * (1. + (fbm3(s * 11. + sd) - .5) * .1), band * mot * .8);   // ck < 1: band also 30 % toward the body, inner fade ~13 px
  hardOut = band;
  return o; }
/* r7: a lobed blob — radius with 3–5 low-frequency lobes (±18–25 %) and a ±4 % fine wobble; aspect ≤ 1.7 */
float lobe(vec2 s, vec2 c, vec2 r, float a, float k, float ph, float sd){
  vec2 d = rot(s - c, a) / r; float th = atan(d.y, d.x);
  float R = 1. + .15 * sin(k * th + ph) + .07 * sin((k + 2.) * th + ph * 1.7 + 1.) + (fbm3(s * 9. + sd) - .5) * .08;
  float q = length(d) / R; return exp(-q * q); }
vec3 speck(vec3 col, vec2 s, vec2 c, float r, float sd){
  vec2 q = pw(s, sd, r * 1.2); float F = exp(-dot(q - c, q - c) / (r * r)) + (fbm3(s * 3.1 + sd) - .5) * .2;
  return mix(col, mix(MIDC, PB1, smoothstep(.4, .75, F)) * (1. + (fbm3(s * 2. + sd) - .5) * .12), smoothstep(.15, .6, F) * .85); }
`;
export function makeWaterMaterial(uni){
  /* vd mvp-gate §3: the gap-patch feather is set in CSS px, so the shader needs the renderer's pixel ratio (1 in the 1440 @1x QA shots,
     1.5 desktop cap, 2 phone); read from the renderer every draw, no main.js / render.js change */
  uni.uPxR = uni.uPxR || { value: 1 };
  const mat = new THREE.ShaderMaterial({ uniforms: uni, transparent: true, depthWrite: false, side: THREE.DoubleSide,
    vertexShader: `attribute vec2 aLoc; varying vec2 vP;
void main(){ vP = aLoc; vec3 pos = position; vec4 mvPosition = modelViewMatrix * vec4(pos, 1.); gl_Position = projectionMatrix * mvPosition; }`,
    fragmentShader: `precision highp float; varying vec2 vP;
uniform float uTime, uPxR; uniform vec4 uRip[${NRIP}], uKy[${NKAY}], uSl[${NSEAL}], uCat; uniform sampler2D uInk, uBank;
${MF_GLSL}
float mfV3(vec3 p){ vec3 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f);
  return mix(mix(mix(mfHash(i).x, mfHash(i + vec3(1,0,0)).x, f.x), mix(mfHash(i + vec3(0,1,0)).x, mfHash(i + vec3(1,1,0)).x, f.x), f.y),
             mix(mix(mfHash(i + vec3(0,0,1)).x, mfHash(i + vec3(1,0,1)).x, f.x), mix(mfHash(i + vec3(0,1,1)).x, mfHash(i + vec3(1,1,1)).x, f.x), f.y), f.z); }
${GL}
// washes sampled from seals_f.jpg (pale #c9d6f5 → #8aa6ea → #4d6fd6 → #2a3fa8, navy pools), paper = the game's paper
const vec3 PAPER = ${hex(PAL.paper)}, GAP = vec3(.86, .91, .985), W0 = vec3(.745, .835, .99), W1 = vec3(.56, .675, .965), W2 = vec3(.42, .53, .86), W3 = vec3(.33, .44, .78), W4 = vec3(.29, .39, .70);   /* d13: deep ultramarine lifted to a soft cobalt (user: too heavy) */
const vec3 GCORE = vec3(.627, .715, .894);   // vd mvp-gate §3: gap-patch core hue (luma .709)
const vec3 INK = vec3(.094, .133, .2), M0 = vec3(.45, .62, .27), M1 = vec3(.54, .70, .31), M2 = vec3(.64, .77, .40), OCH = vec3(.80, .74, .52), SAND = vec3(.89, .85, .70);
/* d13: bank greens moved to the meadow's warm yellow-greens (PAL.bright/light family) so the bay sits on the same board */
void main(){
  vec2 p = vP; float t = uTime;
  float d = sdBay(p);
  // ragged wet edge (static: dried paint does not crawl); the cat's collision uses the smooth outline
  float dR = d + (fbm3(p * 1.1 + 4.) - .5) * .30 + (fbm3(p * 3.2) - .5) * .05;   /* d13: soft low-frequency shore, no serrated fringe */
  float aw = max(fwidth(dR), .004), wm = 1. - smoothstep(-aw, aw, dR);   // water body
  float fade = d + (fbm3(p * .55 + 6.) - .5) * .6 + (fbm3(p * 2.2) - .5) * .3 + (vn(p * 7.) - .5) * .12;   // ragged edge of the bank wash
  vec2 off, sl; waves(p, off, sl);
  vec2 s = p + off * .7;
  // ---- washes: a slow domain warp makes the glazes flow and morph (a blob changes over ~30 s)
  float tw = t * .022;
  vec2 w1 = vec2(fbm3(s * .21 + vec2(tw, -tw * .7)), fbm3(s * .21 + vec2(5.2 - tw * .6, 1.3 + tw)));
  vec2 q = s * .34 + (w1 - .5) * 1.7;
  float cr = (fbm3(s * 2.6 + 7.) - .5) * .09 + (vn(s * 9.) - .5) * .04;                  // cauliflower raggedness
  float A = fbm(q + vec2(3., 1.) + tw * .35) + cr + .05, B = fbm(q * 1.5 + vec2(11., 7.) - tw * .4) + cr;
  vec2 sw = s + (w1 - .5) * 1.1; float pools = .4 * exp(-dot(sw - vec2(-2.5, 4.7), sw - vec2(-2.5, 4.7)) / 1.3) + .36 * exp(-dot(sw - vec2(2.7, 5.4), sw - vec2(2.7, 5.4)) / 1.0);   // anchored navy pools, upper half
  float Cd = fbm(q * .85 + vec2(21., 4.) + vec2(-tw * .3, tw * .3)) + cr * 1.2 + pools, G = fbm(s * .45 + vec2(13., 4.) + w1 * 1.4 - tw * .25) + cr * .6;
  float m1 = smoothstep(.55, .64, A), m2 = smoothstep(.55, .63, B), m3 = smoothstep(.645, .705, Cd), m4 = smoothstep(.75, .82, Cd);
  float gap = smoothstep(.47, .56, G) * (1. - m2) * (1. - m3);
  // edge darkening: pigment pools in a thin band just inside each glaze's edge
  float r1 = smoothstep(.50, .53, A) * exp(-max(A - .53, 0.) / .03), r2 = smoothstep(.56, .58, B) * exp(-max(B - .58, 0.) / .025), r3 = smoothstep(.67, .69, Cd) * exp(-max(Cd - .69, 0.) / .025);
  vec3 col = mix(W0, GAP, gap * .85);
  col = mix(col, W1, m1 * (1. - gap * .6) * .8); col = mix(col, W2, m2 * .88); col = mix(col, W3, m3 * .62); col = mix(col, W4, m4 * .3);
  /* r5 (vd): mid-saturation ultramarine mottling (#6d86d6) takes ~4–6 % of the pale share; random blob sizes */
  { float mm = fbm(s * .62 + (w1 - .5) * 1.3 + vec2(41., 13.) + tw * .3) + (fbm3(s * 1.9 + 51.) - .5) * .16 + (vn(s * 5.) - .5) * .05;
    float m5 = smoothstep(MIDA, MIDA + .09, mm) * (1. - m2 * .6) * (1. - m3);
    col = mix(col, MIDC * (1. + (vn(p * 31.) - .5) * .06), m5 * MIDK);
    /* r6 (vd r5 §3): a deeper ultramarine layer #5b74cf (mix .6, ≈ 8 %) */
    float mq = fbm(s * .8 + (w1 - .5) * 1.1 + vec2(77., 29.) - tw * .25) + (fbm3(s * 2.3 + 63.) - .5) * .12;
    col = mix(col, MID2 * (1. + (vn(p * 29.) - .5) * .05), smoothstep(.665, .75, mq) * (1. - m3 * .7) * .64);
    col = clamp(mix(vec3(dot(col, vec3(.299, .587, .114))), col, 1.27), 0., 1.); }   /* r6/r7: saturation lift toward 0.38 */
  /* r7.2 (QA 15 / A4): the paper-white gaps never go brighter than the paper (luma ≤ .84) and are broken into smaller strokes.
     QA15-r2: inside the gap patches the cap drops to luma .72 (≈ 85 % of the on-screen paper), scaling the colour so the patch stays a
     pale water blue rather than near-white; the cap uses a narrower gap mask (G .50–.53 instead of .47–.56) for a slightly harder edge */
  { float gk = smoothstep(.35, .65, fbm3(s * 3.1 + 17.)), lu = dot(col, vec3(.299, .587, .114));
    col = mix(col, mix(col, W0, .55), gap * (1. - gk) * .8); lu = dot(col, vec3(.299, .587, .114));
    /* vd mvp-gate §3 (#15): the patch core read as a grey-violet smudge (screen RGB 160,179,214, B−R 54). Same brightness (cap .72 → .71,
       screen Y 177 → 174.7 after the #grain multiply ×.965), hue pulled back to the water: inside the patch the colour keeps its own luma but
       takes GCORE's chroma (screen 154,176,220, B−R 66 = the vd target 166,188,232 shifted down 11.7 in every channel to hold Y).
       The patch edge is feathered in screen space: signed CSS-px distance to the G = .515 contour (old band .50–.53 centre), smoothstep over
       ±9 px = 18 px full ramp (10–90 % = 11 px on a locally linear G) at any zoom. Offline at 1440 (157 px/m across, 66 px/m in depth):
       measured 10–90 % median 11.5 px (p10–p90 7.5–27, the fbm is not linear over 18 px), old G .50–.53 band median 9.8 (3.5–31). */
    float gd = (G - .515) / max(length(vec2(dFdx(G), dFdy(G))), 7.5e-4 / uPxR) / uPxR;
    float gh = smoothstep(-9., 9., gd) * (1. - m2) * (1. - m3);
    col *= min(1., mix(.84, .71, gh) / max(lu, 1e-3)); lu = dot(col, vec3(.299, .587, .114));
    col = mix(col, clamp(GCORE + (lu - dot(GCORE, vec3(.299, .587, .114))), 0., 1.), gh); }
  /* r5 (vd): deep-indigo pools — noise-broken outline (±~20 % of the diameter) with a fading tail, edge #4a5fb5 → centre #26357f,
     ±4 % grain; half the rim a hard, jagged watercolour back-run (dark line + paler bloom inside), the other half soft and fading */
  { vec2 sw = s + (w1 - .5) * .45; float hd;
    float hk = smoothstep(.3, .45, length(p - uKy[1].xy));                                   // no hard rim within 0.3 m of the yellow kayak
    // A: by the yellow kayak's loop (4 sub-blobs)
    vec2 sa = pw(sw, 2., .4); float F = sbl(sa, vec2(2.45, 3.55), vec2(0.671, 0.488), .3) + .9 * sbl(sa, vec2(2.98, 3.8), vec2(0.366, 0.293), 0.) + .85 * sbl(sa, vec2(1.98, 3.3), vec2(0.305, 0.232), 1.) + .8 * sbl(sa, vec2(2.72, 3.1), vec2(0.195, 0.171), 0.);
    col = poolF(col, sa, F, vec2(2.5, 3.5), .6, 1., hk, 1., hd);
    // B: left, well inside the board (4 sub-blobs)
    sa = pw(sw, 6., .38); F = sbl(sa, vec2(-1.75, 1.55), vec2(0.592, 0.414), -.4) + .9 * sbl(sa, vec2(-1.28, 1.78), vec2(0.32, 0.248), 0.) + .85 * sbl(sa, vec2(-2.18, 1.28), vec2(0.261, 0.202), .6) + .8 * sbl(sa, vec2(-1.5, 1.14), vec2(0.178, 0.153), 0.);
    col = poolF(col, sa, F, vec2(-1.7, 1.5), .55, 7., 1., 1., hd);
    // C1 + C2 (r7, vd r6 §1): two lobed stains with clearly different long axes (≈ 62° apart) and sizes (area ≈ 1.9 : 1);
    // the upper one trails two short fading tails (0.3–0.5 R)
    // (world radii/angles solved so that ON SCREEN at the default camera C1 is ≈ 44×29 px at −25°, C2 ≈ 62×40 px at +20°: aspect ≈ 1.5, axes 45° apart)
    sa = pw(sw, 12., .22); F = 1.42 * lobe(sa, vec2(2.66, .26), vec2(.49, .25), 1.083, 4., .6, 13.)
      + .24 * sbl(sa, vec2(2.92, .74), vec2(.14, .075), 1.083) + .2 * sbl(sa, vec2(2.3, .42), vec2(.12, .07), 2.6);
    col = poolF(col, sa, F, vec2(2.66, .26), .4, 13., 0., .7, hd);
    sa = pw(sw, 18., .22); F = 1.5 * lobe(sa, vec2(2.08, -.86), vec2(.56, .42), 1.613, 3., 2.2, 19.) + .5 * sbl(sa, vec2(1.86, -.68), vec2(.18, .15), 0.);
    col = poolF(col, sa, F, vec2(2.08, -.86), .5, 19., 1., 1., hd);
    // 5 scattered small deep specks (Ø 0.3–0.6 m), body colour only
    col = speck(col, sw, vec2(-3.6, 3.0), .3, 3.); col = speck(col, sw, vec2(1.0, 2.2), .19, 5.); col = speck(col, sw, vec2(4.2, 1.4), .24, 8.);
    col = speck(col, sw, vec2(-4.3, .2), .17, 11.); col = speck(col, sw, vec2(3.7, 5.3), .27, 14.); }
  col *= 1. - (r1 * .05 + r2 * .07 + r3 * .07) * vec3(1., .9, .6);
  // granulation: pigment settles into the paper tooth — dark grains + paper flecks, stronger in the dense washes (static in place)
  float pig = clamp(m1 * .15 + m2 * .6 + m3 * .9, 0., 1.), gr = vn(p * 52.) * .6 + vn(p * 27. + 3.) * .4;
  col *= 1. - smoothstep(.62, .74, gr) * pig * .06;                                                 // dark grains only, 2–3 px, sparse
  col *= 1. - .025 * clamp(dot(sl, vec2(.7, .7)) * 3., -1., 1.);                     // Ultra-Water slope: ≤3 % tone, no highlight
  // ---- seals: submerged ones are painted here as soft, blurred ultramarine silhouettes (blur grows with depth)
  for (int i = 0; i < ${NSEAL}; i++){ vec4 k = uSl[i]; if (k.w <= .02) continue;
    vec2 v = rot(p - k.xy, k.z); float rw = .062 * (1. - .55 * smoothstep(-.02, .2, -v.x)) * (1. - .35 * smoothstep(.12, .2, v.x));
    float e = (length(vec2(v.x / .205, v.y / rw)) - 1.) * rw, bw = mix(.008, .075, k.w);
    float cov = 1. - smoothstep(-bw, bw, e); col = mix(col, mix(W3, W4 * .85, k.w), cov * smoothstep(.05, .55, k.w) * mix(.75, .55, k.w)); }
  // ---- kayaks: soft dark-blue drop shadow directly beneath (multiply, as over a shallow bed) + two hugging wake lines
  for (int i = 0; i < ${NKAY}; i++){ vec4 k = uKy[i]; if (k.w <= 0.) continue;
    vec2 v = rot(p - k.xy - vec2(.04, -.045), k.z) / vec2(k.w * .56, k.w * .2); float e = length(v);
    col *= mix(vec3(1.), vec3(.3, .38, .72), (1. - smoothstep(.35, 1.25, e)) * .9);
    vec2 u = rot(p - k.xy, k.z) / vec2(k.w * .62, k.w * .17); float eu = length(u), lw = max(fwidth(eu), .02), br = smoothstep(.2, .45, vn(vec2(atan(u.y, u.x) * 2.4 + float(i) * 5., 1.3)));
    col = mix(col, vec3(.2, .26, .45), (line(eu - 1.15, lw * 1.2) + line(eu - 1.5, lw * 1.2) * .6) * br * .4); }
  // ---- ripples: 2–3 thin, broken pencil rings that expand and fade over ~2.6 s (uRip: x, y, t0, strength)
  for (int i = 0; i < ${NRIP}; i++){ vec4 r = uRip[i]; float age = t - r.z; if (age < 0. || age > 2.6) continue;
    vec2 dv = p - r.xy; float dist = length(dv), ang = atan(dv.y, dv.x), lw = max(fwidth(dist), .002) * 1.25, env = pow(1. - age / 2.6, 1.4) * smoothstep(0., .15, age) * r.w;
    float r0 = .05 + .55 * (1. - exp(-age * 1.1));
    for (int k = 0; k < 3; k++){ float rk = r0 - float(k) * .13; if (rk < .025) continue;
      float br = smoothstep(.22, .45, vn(vec2(ang * 3.3 + float(i) * 7.3 + float(k) * 3.7, float(k) * 1.7 + float(i)))), a = env * br * (1. - float(k) * .3);
      col = mix(col, mix(col, GAP, .7), line(dist - rk - lw * 1.4, lw) * a * .45);
      col = mix(col, vec3(.17, .22, .4), line(dist - rk, lw) * a * .7); } }
  // ---- pencil current squiggles: one static tile, drifting ≈ 2.5 mm/s (a 20 cm squiggle takes > 60 s to cross its length)
  float ink = 1. - texture2D(uInk, p / ${INK_M.toFixed(1)} + vec2(.0025, .0015) * t / ${INK_M.toFixed(1)}).r;
  float lane = smoothstep(.36, .52, fbm3(p * .33 + 3.)), clear = 1.;                                    // the marks gather in a few current lanes
  for (int i = 0; i < ${NSEAL}; i++) clear *= smoothstep(.12, .3, length(p - uSl[i].xy));
  for (int i = 0; i < ${NKAY}; i++) clear *= smoothstep(.2, .5, length(p - uKy[i].xy));
  col = mix(col, INK, ink * lane * clear * .55 * smoothstep(.1, -.25, dR));
  // the dried wet edge: a darker pigment line just inside the shore
  float wl = exp(-pow((dR + .03) / .03, 2.)) * (.7 + .3 * vn(p * 3.));
  col *= 1. - .07 * wl * vec3(.8, .7, .45);
  { float wB = mix(.08, .35, smoothstep(.3, .75, fbm3(p * .45 + 20.))), bl = (1. - smoothstep(0., wB, -dR)) * step(dR, 0.);
    col = mix(col, mix(M1, W0, .5), bl * bl * .55);                                                  /* r4 (vd): green bleeds into the water */
    float sp = smoothstep(.74, .8, fbm3(p * .5 + 40.)) * (1. - smoothstep(.0, .035, abs(dR + .02)));
    col = mix(col, PAPER, sp * 0.); }                                                                      /* r6 (vd r5 §2): paper splits off — they read as a white outline on the water side */
  // ---- bank: wet-in-wet mossy greens, ochre/sand touches, dense dark pencil tangles; it dissolves into the clay fields
  float mz = fbm(p * .9 + 2.), mb = fbm3(p * 2.4 + 8.);
  vec3 moss = mix(M0, M1, smoothstep(.3, .55, mz)); moss = mix(moss, M2, smoothstep(.55, .75, mz) * .8);
  moss = mix(moss, M0 * .94, smoothstep(.55, .8, mb) * .18 * (1. - smoothstep(.5, 1.2, fade)));                                         // darker blooms
  moss = mix(moss, OCH, smoothstep(.62, .8, fbm3(p * .6 + 9.)) * smoothstep(.5, 1.2, d) * .25);        // ochre / sand away from the water
  /* r4 (vd): 2–3 low-frequency wash levels inside the land (±10 %), each with a slightly darker tide mark at its edge */
  float lv1 = fbm3(p * .42 + 31.), lv2 = fbm3(p * .7 + 47.);
  float l1 = smoothstep(.47, .53, lv1), l2 = smoothstep(.52, .58, lv2);
  moss *= 1. + .10 * l1 - .09 * l2 - .02;
  moss = mix(moss, vec3(.42, .58, .32), l2 * .15);                                                 // the darker level leans cool sage
  moss *= 1. - .05 * (exp(-pow((lv1 - .53) / .018, 2.)) + exp(-pow((lv2 - .58) / .018, 2.)));        // tide marks
  moss *= 1. + (fbm3(p * 1.6 + 5.) - .5) * .05;
  /* r4 (vd): no sand band. The green bleeds outward into the water (≈ 8–35 cm, low-frequency), with 2–4 thin paper-white splits;
     a short pale sand lip only on the cat's headland */
  vec3 bcol = moss;
  float sandK = (1. - smoothstep(.35, .9, length((p - vec2(.05, .25)) * vec2(1., 1.6)))) * smoothstep(-.02, .02, dR) * (1. - smoothstep(.03, .09, dR));
  bcol = mix(bcol, mix(moss, SAND, .3), sandK * .5);                                              /* r6 (vd r5): no pale outline on the water side */
  /* r5 (vd): ink shrubs as irregular, broken bands hugging the shore (width 0.1–0.6 m ≈ ≤ 20 % of the lobe's short side, sizes vary
     > 3×), one small clump inland; ink #1f2a1a at 70–90 % over a dark-green wash (≈ 25 % darker, 15–30 % wider, soft edge) */
  /* r6 (vd r5 §2): fewer, larger ink clumps (≥ 0.3 m) in broken shore segments (≈ 60–75 % of the shore, gaps ≥ 0.8 m); under them a
     darker (moss × .66), wider (1.9× the band) yellow-green #4f6a2a wash with a soft inner edge */
  float bw = mix(.2, .6, smoothstep(.32, .68, fbm3(p * .75 + 61.)));
  float onB = smoothstep(.37, .43, fbm3(p * .36 + 73.) + (vn(p * 1.3 + 3.) - .5) * .08);           // long segments with a few long gaps
  float rag = (fbm3(p * 2.2 + 5.) - .5) * .45, dB = dR + rag * bw;
  float clump = smoothstep(.39, .53, fbm3(p * 1.5 + 11.));                                         // r7: existing clumps grown (≥ 0.4 m), no new strokes                                         // clumps 0.3–1 m inside each segment
  float ic = length((p - vec2(.3, -1.7)) * vec2(.8, 1.25)) + (fbm3(p * 2.4 + 2.) - .5) * .22;       // the one inland clump
  float tang = max(onB * clump * smoothstep(.02, .07, dR) * (1. - smoothstep(bw * .7, bw, dB)), 1. - smoothstep(.1, .17, ic));
  float under = max(onB * smoothstep(-.01, .05, dR) * (1. - smoothstep(bw * 1.1, bw * 1.9, dB)), (1. - smoothstep(.12, .3, ic)) * .5);
  bcol = mix(bcol, mix(moss * .66, vec3(.310, .416, .165), .4), under * .9);
  float inkA = mix(.6, mix(.85, .95, vn(p * 2.7 + 7.)), smoothstep(.45, .9, tang));             // r7 (vd r6 §2): centre 85–95 %, rim 60 %
  bcol = mix(bcol, vec3(.122, .165, .102), clamp(max(1. - texture2D(uBank, p / ${(BANK_M * .55).toFixed(2)}).r, 1. - texture2D(uBank, rot(p, 1.1) / ${(BANK_M * .55).toFixed(2)} + .37).r) * 2.8, 0., 1.) * smoothstep(.2, .55, tang) * inkA);
  /* r7.2 (QA 14 / D4): one continuous brushstroke hugging the shore on the land side, 0.9–2.1 cm wide (r7.3), opacity 55–90 % varying along
     the shore; it lives only inside the onB segments, so the long gaps keep it from ever closing into a contour */
  { float swk = mix(.009, .021, vn(p * 1.9 + 23.)), wob = (vn(p * 5.3 + 4.) - .5) * .008;      // r7.3: narrower (0.9–2.1 cm)
    float sk = smoothstep(.0, .006, dR + wob) * (1. - smoothstep(swk * .55, swk, dR + wob)) * smoothstep(.7, .98, onB);   // r7.3: only the segment cores, so the gaps stay open
    bcol = mix(bcol, vec3(.122, .165, .102), sk * mix(.55, .9, smoothstep(.3, .7, vn(p * 3.1 + 9.)))); }
  bcol *= 1. + (vn(p * 60.) - .5) * .03;
  { vec2 cq = (p - uCat.xy - vec2(.1, .02)) / vec2(.32, .2); bcol *= 1. - (1. - smoothstep(.3, 1.2, length(cq))) * .3 * uCat.w; } // cat contact shade
  // ---- compose: water over bank; the bank fades out (noisy, 1–2 m) into the gouache fields beyond
  // seam: over ~1.4 m the moss turns into a pale transparent wash that is lighter than the fields (paper shows through), sparse stipple only
  float sm = smoothstep(1.9, 3.0, fade);
  bcol = mix(bcol, mix(M2, PAPER, .3), smoothstep(1.5, 2.2, fade));
  bcol *= 1. - .03 * smoothstep(.62, .85, vn(p * 38.)) * smoothstep(1.4, 1.9, fade) * (1. - sm);   // sparse graphite stipple
  vec3 o = mix(bcol, col, wm);
  float alpha = max(wm, (1. - sm) * (1. - .25 * smoothstep(1.9, 2.4, fade) - .3 * smoothstep(2.1, 2.8, fade) * smoothstep(.35, .7, vn(p * 20.))));
  // paper grain: fine, ≤ ±3 %, fixed in board space (the paper does not slide when the board scrolls)
  vec2 bq = vec2(dot(normalize(vFoldW), uBoardX.xyz), dot(normalize(vFoldW), uBoardY.xyz)) * 600.;
  o *= 1. + (vn(bq * 22.) * .6 + vn(bq * 47. + 3.) * .4 - .5) * .06;
  // the board's ragged dry-brush edge: same function as the ground's, but a pixel is kept if ANY neighbouring speckle cell is kept (the
  // two meshes tessellate differently, so cells shift by a texel); that way no ground grass shows through, and the fringe is water-coloured
  if (uBoardF.w > 0.){
    float e0 = foldBoardSD(vFoldW) + (mfV3(vec3(bq * .9, 0.)) - .5) * .22 + (mfV3(vec3(bq * 3., 1.)) - .5) * .08;
    float sp = 0., sb = mfV3(vec3(bq * 16., 2.)) * .4; vec2 c0 = floor(bq * 60.);
    for (int k = 0; k < 9; k++){ vec2 c = c0 + vec2(float(k / 3 - 1), float(k - k / 3 * 3 - 1)); sp = max(sp, mfHash(vec3(c, 1.)).x * .6 + sb); }
    if (sp < smoothstep(-.32, .16, e0 - .05)) discard; o *= 1. - .05 * smoothstep(-.4, -.1, e0);
    o = mix(o, mix(o, PAPER, .6), clamp(smoothstep(-.34, .1, e0) * .8 - mfV3(vec3(bq * 9., 3.)) * .25, 0., 1.)); }
  gl_FragColor = vec4(o, alpha);
}` });
  mat.onBeforeRender = (r) => { uni.uPxR.value = r.getPixelRatio(); };
  return mat;
}
