// 褶星 Fold — artkit fork of b1 cat (ground height via planet.heightAt(up) -> metres above R)
// 褶星 Fold — b1: clay old orange cat + spherical-planet controller.
// exports createCat(scene) -> cat, updateCat(cat, dt, input, planet)  (also cat.update(dt,input,planet))
import * as THREE from '../shared/vendor/three.module.js';
import { GLTFLoader } from '../shared/vendor/GLTFLoader.js';
import { DRACOLoader } from '../shared/vendor/DRACOLoader.js';
import { ossEyes } from '../game/assets/cat_oss/eyes.js';
import { setCatHc, measureCatHc } from '../game/catScale.js';   /* d-cat r8d: Hc (stand height) from the loaded glb, measured in the idle clip frame 0 */

// r4 palette from the Codex turnaround (tex/cat_turnaround.png): marigold orange, burnt-orange tabby stripes, warm cream bib/belly/socks, amber eyes
const ORANGE = 0xec9a44, ORANGE_DK = 0xbf6524, WHITE = 0xf4ead5, PINK = 0xd99a8c, INK = 0x2b241d, AMBER = 0xd99a2b;
const G = 9.8, WALK = 0.75, TROT = 1.7, SPRINT = 4.6, JUMP_V = 3.35, CAT_R = 0.13;
const L = 0.115; // nominal leg length

// gouache look: 4 soft value bands (toon gradient) x hand-painted canvas grain (dry-brush strokes + paper tooth)
let _grad = null, _gradS = null, _grain = null;
function gouacheTex() {
  if (_grad) return;
  const g = new Uint8Array([138, 182, 222, 246]); _grad = new THREE.DataTexture(g, 4, 1, THREE.RedFormat); _grad.needsUpdate = true; // r4: lighter matte clay bands
  { /* r11: cat_oss only - 16-step linear-filtered ramp (darkest 150) so the toon light no longer jumps band-to-band across the low-poly facets */
    const g2 = new Uint8Array(16).map((_, i) => Math.round(150 + 96 * Math.pow(i / 15, 0.8))); _gradS = new THREE.DataTexture(g2, 16, 1, THREE.RedFormat); _gradS.magFilter = _gradS.minFilter = THREE.LinearFilter; _gradS.needsUpdate = true; }
  const c = document.createElement('canvas'); c.width = c.height = 256; const x = c.getContext('2d');
  x.fillStyle = '#fff'; x.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 900; i++) { // short dry-brush strokes along the fur direction
    const v = 205 + Math.random() * 50 | 0; x.strokeStyle = `rgba(${v},${v - 6},${v - 14},0.35)`; x.lineWidth = 1 + Math.random() * 2.5;
    const px = Math.random() * 256, py = Math.random() * 256, l = 4 + Math.random() * 10; x.beginPath(); x.moveTo(px, py); x.lineTo(px + l * 0.3, py + l); x.stroke();
  }
  const d = x.getImageData(0, 0, 256, 256); for (let i = 0; i < d.data.length; i += 4) { const n = (Math.random() - 0.5) * 22; d.data[i] += n; d.data[i + 1] += n; d.data[i + 2] += n; } x.putImageData(d, 0, 0);
  _grain = new THREE.CanvasTexture(c); _grain.wrapS = _grain.wrapT = THREE.RepeatWrapping; _grain.colorSpace = THREE.SRGBColorSpace;
}
/* D1b: C2 cat material, new-cat path only (D1 glbs built with --fit, i.e. CatRig extras.fit; ?mat=c2 forces it on, ?mat=old off; cat.glb keeps the r12 look).
   r5 colour calibration (to_designer_09): the lit flank shows its albedo. The shader measures the irradiance the scene lights actually deliver
   (the shadow-map visibility of the key, from outgoing / albedo vs the unshadowed toon sum), rebuilds the irradiance with a half-wrapped Lambert key
   + hemi + ambient from the same uniforms, divides by what a reference lit flank gets (horizontal normal facing the key), and turns that luminance
   ratio into shade s = smoothstep(.42, 1, ratio): lit plateau (ratio >= 1) = albedo,
   per channel, so the cool hemi / warm key white balance and intensity drop out. Shade side: albedo * (1 - (1 - s) * SHADE), SHADE (.20,.38,.45) darkens
   blue most and red least, so shadows go deeper apricot / warm cream, never grey or brown. Surfaces turning away from the camera lose a
   little s (?warm=, default .12) instead of being mixed toward a brown. Fog, shadows and the ramp stay in play. No emissive, rim or outline.
   Grain (r5, review ruling 2): c2_strokes.png, low-frequency brush strokes along the body (~4.5 cm in cat terms: tile .18 object units, strokes
   ~25 % of a tile), triplanar in bind-pose object space, +-2 % value (?grain=), mipmapped so it vanishes at the default distance. */
const MATQ = (location.search.match(/[?&]mat=(c2|old)\b/) || [])[1] || null;
/* d-cat A7: the default cat is the painted A6/A7 build (texture carries the gouache stripes, eyes and its own +-3 % brush grain);
   ?cat=cat loads the r12 cat.glb, ?cat=<name> any other build. Painted cats: shader grain 0 (?grain= still wins) and a 3-level soft
   value step (?steps=0 turns it off, ?steps=n sets n+1 levels). */
const DEFAULT_CAT = 'cat_a7', PAINTED = /^cat_a\d|^cat_A_/;
const GRAINQ = (location.search.match(/[?&]grain=([\d.]+)/) || [])[1], STEPSQ = (location.search.match(/[?&]steps=(\d+)/) || [])[1];
const C2 = { grain: +(GRAINQ ?? .02), warm: +((location.search.match(/[?&]warm=([\d.]+)/) || [])[1] ?? .12), tile: .18,
  shade: new THREE.Vector3(.20, .38, .45) };
/* the page lays #grain (paper.png, mean .5 grey) over the canvas with mix-blend multiply at opacity o, i.e. x (1 - o/2) on screen; undo it here
   (sRGB-space multiply -> linear gain ^2.2) so the displayed lit flank is the albedo, not 3.5 % under it */
const c2Disp = () => { const g = typeof document !== 'undefined' && document.getElementById('grain'); const o = g ? +getComputedStyle(g).opacity || 0 : 0;
  return Math.pow(1 / (1 - .5 * Math.min(Math.max(o, 0), .5)), 2.2); };
let _gradC2 = null, _grainC2 = null;
function c2Tex() {
  if (_gradC2) return;
  const g = new Uint8Array(16).map((_, i) => Math.round(160 + 92 * Math.pow(i / 15, 0.9))); _gradC2 = new THREE.DataTexture(g, 16, 1, THREE.RedFormat);
  _gradC2.magFilter = _gradC2.minFilter = THREE.LinearFilter; _gradC2.needsUpdate = true;
  _grainC2 = new THREE.TextureLoader().load(new URL('../game/assets/cat/c2_strokes.png', import.meta.url).href); _grainC2.wrapS = _grainC2.wrapT = THREE.RepeatWrapping; _grainC2.colorSpace = THREE.NoColorSpace; _grainC2.anisotropy = 4;
}
/* r8d (review-vd-cat-eyes-r8d #2): the painted eyes + cream surround (a mask around the glb extras `eyes` = [|x|, height, forward, R] in
   bind-pose object space, written by tools/cat_a/run_a7.py; fallback = the r8c bake) take no cast shadow and their lowest shade step is
   floored at EYEK (default .86 of the lit value, ?eyek=); the rest of the body is unchanged. No emissive. */
const EYEK = +((location.search.match(/[?&]eyek=([\d.]+)/) || [])[1] ?? .86);
function c2Material(src, vc, painted, geo, ud) {
  c2Tex(); const m = new THREE.MeshToonMaterial({ gradientMap: _gradC2, map: vc ? null : (src.map || null), vertexColors: vc, color: (vc || src.map) ? 0xffffff : src.color });
  m.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, { uGrain: { value: _grainC2 }, uGrainK: { value: C2.grain }, uTile: { value: C2.tile }, uWarmK: { value: C2.warm }, uShadeK: { value: C2.shade }, uDisp: { value: c2Disp() }, uSteps: { value: painted ? +(STEPSQ ?? 2) : +(STEPSQ ?? 0) },
      uHead: { value: new THREE.Vector2(geo && geo.boundingBox ? geo.boundingBox.max.z - .10 : 9, .165) }, uCreamK: { value: +((location.search.match(/[?&]creamk=([\d.]+)/) || [])[1] ?? 1) },
      uEye: { value: new THREE.Vector4(...((ud && Array.isArray(ud.eyes) && ud.eyes.length === 4) ? ud.eyes : [.0342, .2676, .168, .0171])) }, uEyeS: { value: painted ? (1 - EYEK) / C2.shade.z : 0 } });
    if (painted && GRAINQ == null) sh.uniforms.uGrainK.value = 0;
    sh.vertexShader = 'varying vec3 vOP; varying vec3 vON;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n vOP = position; vON = normal;'); /* bind-pose object space: the strokes ride with the fur */
    sh.fragmentShader = 'varying vec3 vOP; varying vec3 vON; uniform sampler2D uGrain; uniform float uGrainK, uTile, uWarmK, uDisp, uSteps, uCreamK, uEyeS; uniform vec3 uShadeK; uniform vec2 uHead; uniform vec4 uEye;\n' + sh.fragmentShader
      .replace('#include <color_fragment>', `#include <color_fragment>
  { vec3 an = pow(abs(normalize(vON)), vec3(4.)); an /= dot(an, vec3(1.)); vec3 q = vOP / uTile;   /* strokes run along the body axis (z); front/back faces: across */
    float gr = texture2D(uGrain, q.zy).r * an.x + texture2D(uGrain, q.zx + .37).r * an.y + texture2D(uGrain, q.xy + .61).r * an.z;
    diffuseColor.rgb *= 1. + clamp((gr - .5) * 2., -1., 1.) * uGrainK; }`)
      .replace('#include <opaque_fragment>', `
  #if NUM_DIR_LIGHTS > 0 && NUM_HEMI_LIGHTS > 0
  { vec3 Ld = directionalLights[ 0 ].direction, U = hemisphereLights[ 0 ].direction, Kc = directionalLights[ 0 ].color; float lu = clamp(dot(Ld, U), -.999, .999);
    vec3 nR = normalize(Ld - lu * U); float cR = dot(nR, Ld), d = dot(normal, Ld);   /* reference lit flank: horizontal, facing the key */
    #define C2HEMI(n) (mix(hemisphereLights[ 0 ].groundColor, hemisphereLights[ 0 ].skyColor, .5 + .5 * dot(n, U)) + ambientLightColor)
    #define C2LAM(x) clamp(((x) + .3) / 1.3, 0., 1.)   /* half-wrapped Lambert: the soft clay terminator (the toon ramp floor .63 flattened all form) */
    vec3 Ea = C2HEMI(normal), Eu = Kc * texture2D(gradientMap, vec2(.5 * d + .5, 0.)).r + Ea;   /* what three lit this fragment with, minus the shadow map */
    vec3 E = outgoingLight / max(diffuseColor.rgb, vec3(1e-3)) * PI;   /* irradiance actually received (toon BRDF = albedo / PI), incl. the shadow map */
    const vec3 W = vec3(.2126, .7152, .0722); float sh = clamp(dot(E - Ea, W) / max(dot(Eu - Ea, W), 1e-4), 0., 1.);   /* key visibility (cast shadows) */
    vec2 ed = vec2(abs(vOP.x) - uEye.x, vOP.y - uEye.y) / uEye.w;   /* r8d eye mask: eye + cream surround (+-1.4 R wide, 1.25 R tall), front faces only */
    float em = 0.;
    if (uEyeS > 0.) { float mx0 = max(diffuseColor.r, max(diffuseColor.g, diffuseColor.b)), st0 = (mx0 - min(diffuseColor.r, min(diffuseColor.g, diffuseColor.b))) / max(mx0, 1e-3);
      float core = smoothstep(1.06, .98, length((ed - vec2(0., .08)) / vec2(1.04, .92)));   /* the painted eye itself (liner, iris, pupil) */
      float crm0 = smoothstep(.40, .30, st0) * smoothstep(.72, .82, mx0);   /* cream surround by its albedo: the fur around it keeps its shading */
      em = max(core, crm0 * smoothstep(1.1, 1., length(ed / vec2(1.45, 1.3)))) * step(uEye.z - .03, vOP.z) * smoothstep(.05, .35, normalize(vON).z); }
    sh = mix(sh, 1., em);   /* no cast shadow on the eyes */
    vec3 Eref = Kc * C2LAM(cR) + C2HEMI(nR);
    float s = smoothstep(.42, 1., dot((Kc * C2LAM(d) * sh + Ea) / max(Eref, vec3(1e-4)), W));   /* 1 = lit flank plateau; ~.42 = key fully away/shadowed (hemi only) */
    /* r7 (review-vd-cat-r7 #6): on the head (bind-pose: in front of the ears' back, above the chin) the 3 flat steps put a dark plateau on the
       cheek curve under the eye (read as a texture seam); the head gets 2 levels with a wide .30-.70 blend instead */
    float hm = smoothstep(uHead.x - .015, uHead.x + .015, vOP.z) * smoothstep(uHead.y - .015, uHead.y + .015, vOP.y);
    if (uSteps > .5) { float q = s * uSteps, k = floor(min(q, uSteps - .001)); s = mix((k + smoothstep(.36, .64, q - k)) / uSteps, smoothstep(.30, .70, s), hm);   /* soft flat value steps */
      s = max(s, .6 * smoothstep(-.35, -.85, dot(normal, U))); }   /* paw soles / belly underside: warm bounce, no grey rim at the turf */
    float fc = isOrthographic ? normal.z : dot(normal, normalize(vViewPosition)); s *= 1. - uWarmK * (1. - smoothstep(-.05, .5, fc));   /* only the turn into the silhouette */
    s = mix(s, max(s, 1. - uEyeS), em);   /* r8d: eye-area shade floor (bluest channel >= EYEK of lit) */
    /* r7 (review #7): cream fur (bright, low saturation albedo) shades toward warm yellow (#ead2ae at the mid step), not pink-grey (#e1bfa2) */
    float mxc = max(diffuseColor.r, max(diffuseColor.g, diffuseColor.b)), sat = (mxc - min(diffuseColor.r, min(diffuseColor.g, diffuseColor.b))) / max(mxc, 1e-3);
    float crm = smoothstep(.45, .33, sat) * smoothstep(.6, .75, mxc) * uCreamK;
    vec3 shK = uShadeK * mix(vec3(1.), vec3(.5, .53, .75), crm);
    outgoingLight = diffuseColor.rgb * max(vec3(1.) - (1. - s) * shK, vec3(.18)) * uDisp; }
  #endif
  #include <opaque_fragment>`);
  };
  m.customProgramCacheKey = () => 'c2r8d' + (painted ? 'p' : ''); return m;
}
const c2Eye = src => { c2Tex(); return new THREE.MeshToonMaterial({ gradientMap: _gradC2, color: src.color }); };   /* matte, no specular, no emissive */
const mat = c => { gouacheTex(); return new THREE.MeshToonMaterial({ color: c, gradientMap: _grad, map: _grain }); };
// r4: tabby stripes painted in the clay (object space of the unit-sphere blob), like the turnaround's mackerel bands; belly side stays clean
function tabby(c, dark, { freq = 13, axis = 'z', top = -.25 } = {}) { const m = mat(c); const d = new THREE.Color(dark);
  m.onBeforeCompile = (sh) => { sh.uniforms.uDark = { value: d };
    sh.vertexShader = 'varying vec3 vObj;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvObj = position;');
    sh.fragmentShader = 'varying vec3 vObj; uniform vec3 uDark;\n' + sh.fragmentShader.replace('#include <map_fragment>', `#include <map_fragment>
      { float a = vObj.${axis} * ${freq.toFixed(1)} + vObj.x * vObj.x * 2.6 + sin(vObj.y * 7. + vObj.${axis} * 3.) * .35;
        float b = smoothstep(.05, .85, sin(a)) * .62 * smoothstep(${top.toFixed(2)}, ${(top + .3).toFixed(2)}, vObj.y);
        diffuseColor.rgb = mix(diffuseColor.rgb, uDark, b * .85); }`); };
  m.customProgramCacheKey = () => 'tabby' + freq + axis + top; return m; }
function blob(r, sx, sy, sz, m) { const o = new THREE.Mesh(new THREE.SphereGeometry(r, 20, 14), m); o.scale.set(sx, sy, sz); o.castShadow = true; return o; }

/* r5: soft rounded ear (sphere pinched toward a blunt tip, flattened front-to-back) */
function earGeo(r){ const g = new THREE.SphereGeometry(r, 18, 12), p = g.attributes.position;
  for (let i = 0; i < p.count; i++){ const y = p.getY(i) / r, k = 1 - .62 * Math.max(0, y) ** 1.4; p.setX(i, p.getX(i) * k); p.setY(i, p.getY(i) * 1.18); p.setZ(i, p.getZ(i) * .36 * (1 - .3 * Math.max(0, y))); }
  g.computeVertexNormals(); return g; }
/* r5: tapered leg — thick at the shoulder/hip, slimmer at the ankle, rounded both ends */
function legGeo(rt, rb, len){ const pts = [], n = 8;
  for (let i = 0; i <= n; i++){ const a = -Math.PI / 2 + i / n * Math.PI / 2; pts.push(new THREE.Vector2(Math.cos(a) * rb, -len / 2 + Math.sin(a) * rb)); }
  for (let i = 0; i <= n; i++){ const a = i / n * Math.PI / 2; pts.push(new THREE.Vector2(Math.cos(a) * rt, len / 2 + Math.sin(a) * rt)); }
  return new THREE.LatheGeometry(pts, 14); }

function buildCat() {
  const M = { o: mat(ORANGE), t: tabby(ORANGE, ORANGE_DK), th: tabby(ORANGE, ORANGE_DK, { freq: 9, axis: 'y', top: -2 }), hd: tabby(ORANGE, ORANGE_DK, { freq: 22, axis: 'x', top: .45 }), d: mat(ORANGE_DK), w: mat(WHITE), p: mat(PINK), k: mat(INK), a: mat(AMBER), ae: new THREE.MeshStandardMaterial({ color: AMBER, roughness: .55, metalness: 0 }), ke: new THREE.MeshStandardMaterial({ color: INK, roughness: .5, metalness: 0 }) };
  const root = new THREE.Group();
  const body = new THREE.Group(); root.add(body);            // pivot at hips
  const torso = new THREE.Group(); body.add(torso);
  const t = blob(1, 0.074, 0.084, 0.215, M.t); t.position.set(0, 0.004, 0.135) /* r7: slimmer, longer, leaner */; torso.add(t); // r4: chunky, round barrel like the turnaround
  const belly = blob(1, 0.062, 0.05, 0.17, M.w); belly.position.set(0, -0.036, 0.15); torso.add(belly);
  const chest = blob(1, 0.064, 0.08, 0.07, M.w); chest.position.set(0, -0.012, 0.29); torso.add(chest); // big cream bib
  const haunch = blob(1, 0.088, 0.088, 0.095, M.t); haunch.position.set(0, 0.008, 0.0); torso.add(haunch);

  const neck = new THREE.Group(); neck.position.set(0, 0.032, 0.33); body.add(neck);
  const head = new THREE.Group(); head.position.set(0, 0.025, 0.05); neck.add(head);
  { const nk = blob(1, 0.054, 0.064, 0.075, M.t); nk.position.set(0, -0.004, -0.012); nk.rotation.x = -.5; neck.add(nk); } /* r6: neck/scruff mass so the head grows out of the body */
  head.add(blob(1, 0.074, 0.066, 0.068, M.hd));
  head.scale.set(1.02, 0.95, 0.98); /* r6: real-cat head:body ratio */ // big round head with full cheeks // rounder, bigger head (less potato)
  for (const sx of [-1, 1]) { const wp = blob(1, 0.017, 0.0135, 0.017, M.w); wp.position.set(sx * 0.012, -0.024, 0.06); head.add(wp); } // whisker pads
  const chin = blob(1, 0.014, 0.009, 0.013, M.w); chin.position.set(0, -0.043, 0.045); head.add(chin);
  const nose = blob(0.0064, 1.25, 0.72, 0.9, M.p); nose.position.set(0, -0.01, 0.077); /* r6: small nose */ head.add(nose);

  const eyes = [];
  for (const sx of [-1, 1]) {
    const ir = blob(0.0108, 1, 0.9, 0.5, M.ae); ir.position.set(sx * 0.028, 0.01, 0.06); ir.castShadow = false; head.add(ir);
    const e = blob(0.0064, 0.55, 1.05, 0.6, M.ke); e.position.set(sx * 0.028, 0.01, 0.064); e.castShadow = false; head.add(e); eyes.push(e), eyes.push(ir);
    const ear = new THREE.Mesh(earGeo(0.027), M.o); ear.position.set(sx * 0.04, 0.062, -0.012); ear.rotation.set(-0.12, sx * 0.25, sx * -0.32); ear.castShadow = true; head.add(ear);
    const ei = new THREE.Mesh(earGeo(0.017), M.p); ei.position.set(0, -0.004, 0.006); ear.add(ei); // soft pink inner ear
    const ch = blob(1, 0.03, 0.026, 0.026, M.hd); ch.position.set(sx * 0.04, -0.018, 0.018); head.add(ch); // cheek ruff
  }
  // legs: pivot group -> upper(capsule mesh) + paw
  const legs = [];
  const legDef = [[-0.044, -0.035, 0.275, true], [0.044, -0.035, 0.275, true], [-0.05, -0.03, 0.0, false], [0.05, -0.03, 0.0, false]];
  for (const [x, y, z, front] of legDef) {
    const piv = new THREE.Group(); piv.position.set(x, y, z); body.add(piv);
    const thigh = front ? blob(1, 0.024, 0.044, 0.034, M.t) : blob(1, 0.042, 0.066, 0.058, M.th); thigh.position.set(front ? -Math.sign(x) * 0.006 : 0, front ? 0.012 : -0.012, front ? -0.01 : 0); piv.add(thigh); /* r6: shoulder + haunch muscle flowing into the leg */
    const up = new THREE.Mesh(legGeo(front ? 0.027 : 0.031, front ? 0.018 : 0.019, L - 0.03), M.o); up.castShadow = true; piv.add(up);
    const paw = blob(1, 0.027, 0.018, 0.034, M.w); piv.add(paw); // white sock tips
    for (const tx of [-1, 0, 1]) { const toe = blob(1, 0.0095, 0.009, 0.011, M.w); toe.position.set(tx * 0.0135, -0.004, 0.026 - Math.abs(tx) * .004); paw.add(toe); } // three soft toe beans' bumps
    const sock = blob(1, 0.021, 0.02, 0.022, M.w); sock.position.y = 0.014; paw.add(sock);
    legs.push({ piv, up, paw, front, side: Math.sign(x), jy: y, jz: z });
  }
  // tail: chain
  const tail = []; let parent = body;
  for (let i = 0; i < 7; i++) {
    const g = new THREE.Group(); g.position.set(0, i ? 0 : 0.04, i ? 0.045 : -0.06); if (!i) g.rotation.y = Math.PI; parent.add(g);
    const s = new THREE.Mesh(new THREE.CapsuleGeometry(0.024 - i * 0.0011, 0.03, 3, 8), i === 6 ? M.w : i % 2 ? M.d : M.o); /* thick ringed tail, cream tip */ s.rotation.x = Math.PI / 2; s.position.z = 0.022; s.castShadow = true; g.add(s);
    tail.push(g); parent = g;
  }
  return { root, body, torso, neck, head, legs, tail, eyes };
}

const POSES = {
  stand:   { hipY: 0.15, pitch: 0, roll: 0, legF: 0, legH: 0, fold: 0, headP: 0, headY: 0, neckY: 0.03, tailUp: 0.5, tailCurl: 0.15, squash: 1, stretchF: 0 },
  sit:     { hipY: 0.07, pitch: 0.55, roll: 0, legF: 0, legH: -1.45, fold: 0, headP: -0.45, headY: 0, neckY: 0.035, tailUp: -0.35, tailCurl: 0.5, squash: 1, stretchF: 0 },
  sleep:   { hipY: 0.075, pitch: 0.0, roll: 0.35, legF: -1.35, legH: -1.35, fold: 1, headP: 0.35, headY: 1.0, neckY: -0.02, tailUp: -0.2, tailCurl: 1.0, squash: 0.82, stretchF: 0 },
  stretch: { hipY: 0.16, pitch: -0.32, roll: 0, legF: -0.7, legH: 0.15, fold: 0, headP: -0.15, headY: 0, neckY: 0.0, tailUp: 1.1, tailCurl: 0.05, squash: 1, stretchF: 1 },
  air:     { hipY: 0.15, pitch: 0, roll: 0, legF: -0.5, legH: 0.6, fold: 0, headP: -0.1, headY: 0, neckY: 0.03, tailUp: 0.3, tailCurl: 0.0, squash: 1, stretchF: 0 },
};

export function createCat(scene, planet) {
  const parts = buildCat();
  scene.add(parts.root);
  const up = planet ? planet.spawnUp.clone() : new THREE.Vector3(0, 0, 1);
  const R = planet ? planet.R : 600;
  const fwd = new THREE.Vector3(0, 1, 0); fwd.addScaledVector(up, -fwd.dot(up)); if (fwd.lengthSq() < 1e-4) fwd.set(1, 0, 0); fwd.normalize();
  const cat = {
    ...parts, R,
    pos: up.clone().multiplyScalar(R), up, fwd,
    alt: 0, vy: 0, speed: 0, grounded: true, ground: 0,
    state: 'idle', gait: 'idle', phase: 0, t: 0, idleT: 0, holdT: 0, stretchT: 0, blink: 2,
    pose: { ...POSES.stand },
    update(dt, input, pl) { updateCat(cat, dt, input, pl); },
  };
  orient(cat);
  /* r8 review #3: soft contact-shadow blob under the hero (kills the stair-stepped shadow-map edge right at the paws) */
  { const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(.55, 'rgba(255,255,255,.55)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
    const bm = new THREE.Mesh(new THREE.PlaneGeometry(.24, .5), new THREE.MeshBasicMaterial({ color: 0x24390f, alphaMap: t, transparent: true, opacity: .42, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, fog: false }));
    bm.rotation.x = -Math.PI / 2; bm.position.y = .001; /* d-cat: was .004, which overdrew the bottom 4 mm of the paws (the grey sole rim) */ bm.renderOrder = 1; bm.castShadow = bm.receiveShadow = false; cat.root.add(bm); cat.blob = bm; }
  const cq = (location.search.match(/[?&]cat=([\w-]+)/) || [])[1];   /* ?cat=<name> tries assets/cat/<name>.glb (e.g. a Tripo-derived build); cat.glb is the default, the primitive the fallback */
  /* r9: ?cat=cat_oss* resolves to assets/cat_oss/ (open-source image-to-3D builds); if that file fails, fall back to cat.glb, then the primitive */
  const glbURL = n => new URL(`../game/assets/${/^cat_oss/.test(n) ? 'cat_oss' : 'cat'}/${n}.glb`, import.meta.url).href;
  if (!/[?&]primcat/.test(location.search)) loadGLBCat(cat, glbURL(cq || DEFAULT_CAT), (cq || DEFAULT_CAT) !== 'cat' ? glbURL('cat') : null);
  return cat;
}

/* r7: rigged glb cat (Blender pipeline, tools/blender/cat_pipeline.py). The primitive cat stays as the fallback if loading fails. */
const POSE_Q = (location.search.match(/[?&]pose=(sit|sleep|stretch)\b/) || [])[1] || null;
const STRIDE = { walk: 0.1649, trot: 0.22, run: 0.367 }; /* r10 #5: trot measured on walkside (stance drift ~0 at .22, was ~.012 per stance at .1957) */ // model-units of body travel per gait cycle (from the pipeline)
function localBox(obj, root) {
  root.updateMatrixWorld(true); const inv = new THREE.Matrix4().copy(root.matrixWorld).invert(), b = new THREE.Box3(), t = new THREE.Box3();
  obj.traverse(o => { if (o.isMesh && o.visible !== false) { o.geometry.computeBoundingBox(); t.copy(o.geometry.boundingBox).applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld)); b.union(t); } });
  return b;
}
function standBox(cat) { /* the primitive in its default stand pose whatever it is doing now: snapshot state + transforms, pose a fresh stand, measure, restore */
  const saved = []; cat.root.traverse(o => saved.push([o, o.position.clone(), o.quaternion.clone(), o.scale.clone(), o.visible]));
  const st = {}; for (const k of ['state', 'gait', 'speed', 't', 'phase', 'idleT', 'holdT', 'stretchT', 'blink', 'alt', 'pose']) if (k in cat) st[k] = cat[k];
  Object.assign(cat, { state: 'idle', gait: 'idle', speed: 0, phase: 0, t: 0, idleT: 0, holdT: 0, stretchT: 0, alt: 0, pose: { ...POSES.stand } }); animate(cat, 0, false);
  const b = localBox(cat.body, cat.root);
  Object.assign(cat, st); for (const [o, p, q, s_, v] of saved) { o.position.copy(p); o.quaternion.copy(q); o.scale.copy(s_); o.visible = v; } cat.root.updateMatrixWorld(true);
  return b; }
function mergeNormals(geo) { /* r11: average normals of vertices split by UV seams (same position) so the seams don't shade as creases */
  const P = geo.attributes.position, N = geo.attributes.normal; if (!N) return; const acc = new Map(), key = i => `${Math.round(P.getX(i) * 1e4)},${Math.round(P.getY(i) * 1e4)},${Math.round(P.getZ(i) * 1e4)}`;
  for (let i = 0; i < P.count; i++) { const k = key(i), a = acc.get(k) || [0, 0, 0]; a[0] += N.getX(i); a[1] += N.getY(i); a[2] += N.getZ(i); acc.set(k, a); }
  for (let i = 0; i < P.count; i++) { const a = acc.get(key(i)), l = Math.hypot(a[0], a[1], a[2]) || 1; N.setXYZ(i, a[0] / l, a[1] / l, a[2] / l); } N.needsUpdate = true; }
const cq_ = u => (u.match(/\/([\w-]+)\.glb$/) || [])[1] || '';
function loadGLBCat(cat, url, fallback) {
  if (!cat.pb0) cat.pb0 = standBox(cat); /* r12 + r8d: size/seat the glb from the primitive in its stand pose, measured with every node transform saved/restored (pose-independent; a slow load used to measure the walking primitive, +18 %) */
  const DELAY = +((location.search.match(/[?&]catdelay=(\d+)/) || [])[1] || 0); /* test hook: ?catdelay=ms delays the glb load (simulates a slow box) */
  if (DELAY && !cat._dl) { cat._dl = 1; setTimeout(() => loadGLBCat(cat, url, fallback), DELAY); return; } /* r12: size/seat the glb from the primitive in its stand pose (dt 0 = no state change) */
  if (cat._glbURL === url) return; cat._glbURL = url;   /* d-catfix (QA 1720 #18): idempotent per cat+url, a second call for the same cat never starts a second load */
  const ld = new GLTFLoader(), dr = new DRACOLoader(); dr.setDecoderPath(new URL('../shared/vendor/draco/', import.meta.url).href); ld.setDRACOLoader(dr);
  const onErr = e => { if (fallback){ console.warn('cat glb failed, falling back to cat.glb', url); loadGLBCat(cat, fallback, null); } else console.warn('cat glb failed, primitive fallback', e && e.message); };
  let done; cat.glbReady = new Promise(r => { done = r; });   /* d-catfix: resolves (cat) once the glb is on the cat, or (null) on primitive fallback; harness/regions can await it */
  glbBytes(url).then(buf => ld.parse(buf, THREE.LoaderUtils.extractUrlBase(url), g => { onGLB(g); done(cat); }, e => { _glbBuf.delete(url); onErr(e); done(null); }),
    e => { _glbBuf.delete(url); onErr(e); done(null); });
  function onGLB(g) {
    const m = g.scene; gouacheTex();
    const pb = cat.pb0; /* r12: measured here it followed the primitive's current pose, so ?pose=sit|sleep sank the glb ~.18 and rescaled it */
    let d1 = false; m.traverse(o => { if (o.userData && o.userData.fit) d1 = true; }); const c2 = MATQ === 'c2' || (MATQ !== 'old' && d1); /* D1b */
    m.traverse(o => { if (o.isMesh) { o.castShadow = true; o.frustumCulled = false;
      const src = o.material, oss = /cat_oss/.test(url);
      if (c2) { o.material = /eye|pupil/.test(o.name) || /eye|pupil/.test(src.name) ? c2Eye(src) : c2Material(src, !!o.geometry.attributes.color, PAINTED.test(cq_(url)), (o.geometry.computeBoundingBox(), o.geometry), o.userData); if (/eye|pupil/.test(o.name) || /eye|pupil/.test(src.name)) o.castShadow = false; return; } if (oss && !/eye|pupil/.test(o.name)) mergeNormals(o.geometry); const nm = new THREE.MeshToonMaterial({ gradientMap: oss ? _gradS : _grad, map: o.geometry.attributes.color ? _grain : (src.map || null), vertexColors: !!o.geometry.attributes.color, color: o.geometry.attributes.color ? 0xffffff : src.color });
      if (/eye|pupil/.test(o.name) || /eye|pupil/.test(src.name)) { o.material = oss ? new THREE.MeshToonMaterial({ gradientMap: _gradS, color: o.geometry.attributes.color ? 0xffffff : src.color, vertexColors: !!o.geometry.attributes.color }) /* r11: modelled eyes matte toon like the fur, no specular */ : new THREE.MeshStandardMaterial({ color: src.color, roughness: Math.max(.5, src.roughness ?? .5), metalness: 0 }); o.castShadow = false; }
      else o.material = nm; } });
    m.traverse(o => { if (o.isMesh) for (const mt of [].concat(o.material)) Object.assign(mt, { stencilWrite: true, stencilRef: 1, stencilZPass: THREE.ReplaceStencilOp });   /* d-cat: the cat marks the stencil ... */ });
    if (cat.blob) Object.assign(cat.blob.material, { stencilWrite: true, stencilRef: 1, stencilFunc: THREE.NotEqualStencilFunc });   /* ... so the contact blob never darkens the paws (it overdrew a khaki rim under the soles) */
    cat.root.add(m); const mb = localBox(m, cat.root);
    const k = Math.min((pb.max.z - pb.min.z) / (mb.max.z - mb.min.z), (pb.max.y - pb.min.y) / (mb.max.y - mb.min.y)) * 0.9; /* keep ≈ half a sheep */ m.scale.setScalar(k);
    const mb2 = localBox(m, cat.root); m.position.set(0, pb.min.y - mb2.min.y, (pb.min.z + pb.max.z) / 2 - (mb2.min.z + mb2.max.z) / 2);
    const mixer = new THREE.AnimationMixer(m), act = {};
    const sx = {}; m.traverse(o => { const u = o.userData && o.userData.stride; if (u && typeof u === 'object') for (const g of ['walk', 'trot', 'run']) if (!(g in sx) && +u[g] > 0) sx[g] = +u[g]; }); /* D1: measured strides from the glb extras (CatRig node), constants as fallback */
    for (const c of g.animations) { /* D1 (glbs with measured strides only): the exporter starts the baked gait keys at t = 1/fps; shift them to 0 so phase*duration is exactly one cycle */
      const t0 = Math.min(...c.tracks.map(t => t.times[0])); if (sx[c.name] && t0 > 0) { for (const t of c.tracks) t.times = t.times.map(x => x - t0); /* new arrays: tracks share time accessors */ c.resetDuration(); }
      const a = mixer.clipAction(c); a.play(); a.setEffectiveWeight(0); act[c.name] = a; }
    cat.body.visible = false; cat.glb = { m, mixer, act, k, phase: 0, w: {}, jt: 0, stride: { ...STRIDE, ...sx }, painted: PAINTED.test(cq_(url)) ? url.replace(/\.glb$/, '_eyesclosed.jpg') : null };
    const eyes = []; m.traverse(o => { if (o.isMesh && /eye|pupil/.test(o.name)) { o.userData.sy = o.scale.y; eyes.push(o); } }); cat.glbEyes = eyes; cat.glbLid = eyes.some(o => /lid/.test(o.name));
    const hc = measureCatHc(cat); if (hc) setCatHc(hc, 'glb'); cat.hc = hc; /* d-cat r8d: one Hc per glb, idle frame 0 x root scale; TODO(Soul, 17:00 integration): main.js/regions read CAT_HC / onCatHc from game/catScale.js */
    console.log('cat glb: ' + g.animations.length + ' actions, scale ' + k.toFixed(3) + (c2 ? ', material c2' : '') + ' ' + cq_(url) + ' Hc ' + (hc ? hc.toFixed(4) : '-') + ' pb0H ' + (pb.max.y - pb.min.y).toFixed(4));
  }
}
/* d-catfix (QA 1720 #18, net::ERR_ABORTED on cat_a7.glb): one network request per glb URL for the page's lifetime. The bytes promise is cached at
   module level, so a second createCat / loadGLBCat (re-init, ?catdelay retry, another module importing the cat) reuses the in-flight fetch
   instead of starting (and racing / cancelling) a second one; each caller parses its own copy (scenes are not shared between cats). */
const _glbBuf = new Map();
function glbBytes(url) {
  if (!_glbBuf.has(url)) _glbBuf.set(url, xhrBytes(url));
  return _glbBuf.get(url).then(b => b.slice(0)); }
/* d-catfix2 (QA 1955 #18, ERR_ABORTED at 21.3 s while the cat still loads): there is exactly one request for the glb (nothing else in the repo fetches it),
   but THREE.FileLoader is fetch() + a JS getReader() progress stream; on the busy software-GL box the body is drained one main-thread task per chunk and
   Chromium then reports that fetch to CDP/Playwright as loadingFailed net::ERR_ABORTED although every byte reached JS (known Chromium fetch-body quirk,
   playwright#32752). A plain XHR arraybuffer load (no JS stream) is one request that ends as a normal 'requestfinished'; fetch only where XHR is missing. */
function xhrBytes(url) {
  if (typeof XMLHttpRequest === 'undefined') return fetch(url, { credentials: 'same-origin' }).then(r => { if (!r.ok) throw new Error(`glb ${r.status} ${url}`); return r.arrayBuffer(); });
  return new Promise((res, rej) => { const x = new XMLHttpRequest(); x.open('GET', url, true); x.responseType = 'arraybuffer';
    x.onload = () => (x.status === 200 || x.status === 0) && x.response ? res(x.response) : rej(new Error(`glb ${x.status} ${url}`));
    x.onerror = () => rej(new Error('glb network error ' + url)); x.send(); }); }
function driveGLB(cat, dt) {
  const G2 = cat.glb, s = cat.speed, ws = cat.root.scale.x * G2.k;
  const tgt = {};
  if (!cat.grounded) tgt.jump = 1;
  else if (cat.state === 'sleep' || cat.state === 'sit' || cat.state === 'stretch') tgt[cat.state] = 1;
  else if (s < 0.06) tgt.idle = 1;
  else { const a = THREE.MathUtils.smoothstep(s, 0.06, 0.3), w2 = THREE.MathUtils.smoothstep(s, 1.0, 1.6), r = THREE.MathUtils.smoothstep(s, 2.6, 3.6);
    tgt.idle = 1 - a; tgt.walk = a * (1 - w2); tgt.trot = a * w2 * (1 - r); tgt.run = a * w2 * r; }
  let stride = 0, sw = 0; for (const n of ['walk', 'trot', 'run']) if (tgt[n]) { stride += G2.stride[n] * tgt[n]; sw += tgt[n]; }
  if (sw > 0) G2.phase = (G2.phase + dt * s / (stride / sw * ws)) % 1; /* gait phase advances by distance / stride → paws stay planted */
  const rate = POSE_Q ? 1 : Math.min(1, dt * (cat.state === 'sleep' ? 2.5 : 8));   /* r11: ?pose snaps (slow sleep blend never settled under swiftshader) */
  for (const [n, a] of Object.entries(G2.act)) {
    const w = G2.w[n] = (G2.w[n] || 0) + ((tgt[n] || 0) - (G2.w[n] || 0)) * rate; a.setEffectiveWeight(w);
    const d = a.getClip().duration;
    if (STRIDE[n]) a.time = G2.phase * d;
    else if (n === 'jump') a.time = THREE.MathUtils.clamp(0.36 + (JUMP_V - cat.vy) / (2 * JUMP_V) * 0.24, 0.3, 0.62);
    else if (n === 'sit') a.time = 0.5;
    else if (n === 'stretch') a.time = THREE.MathUtils.clamp(cat.stretchT || 0, 0, d - 0.01);
    else a.time = (a.time + dt) % d;
  }
  G2.mixer.update(0);
  const closed = cat.state === 'sleep' || cat.blink < 0.12; for (const e of cat.glbEyes) { if (cat.glbLid) e.visible = /lid/.test(e.name) ? closed : !closed; /* r11 cat_oss: closed = curved lid line */ else e.scale.y = e.userData.sy * (closed ? 0.12 : 1); }
  if (G2.painted) ossEyes(cat, closed, G2.painted);   /* painted eyes: swap in the closed-lid map (sleep, blink) */
}

const _v = new THREE.Vector3(), _q = new THREE.Quaternion(), _m = new THREE.Matrix4(), _x = new THREE.Vector3(), _l = new THREE.Vector3();

function orient(cat) {
  _x.crossVectors(cat.up, cat.fwd).normalize();
  _m.makeBasis(_x, cat.up, cat.fwd);
  cat.root.quaternion.setFromRotationMatrix(_m);
  cat.root.position.copy(cat.pos);
}

// input: { x, y (camera-relative: y forward), sprint, jump (edge), sit (edge), sleep (edge) }, camFwd: tangent-ish vector
export function updateCat(cat, dt, input, planet, camFwd) {
  dt = Math.max(0, Math.min(dt, 0.05)); cat.t += dt;
  const up = cat.up;
  // camera-relative desire on the tangent plane
  const cf = _v.copy(camFwd || cat.fwd); cf.addScaledVector(up, -cf.dot(up)).normalize();
  const cr = _x.crossVectors(cf, up).normalize();
  const want = new THREE.Vector3().addScaledVector(cf, input.y || 0).addScaledVector(cr, input.x || 0);
  const mag = Math.min(1, want.length()); if (mag > 0.01) want.normalize();
  const moving = mag > 0.01;

  // state transitions
  if (input.sleep) cat.state = cat.state === 'sleep' ? 'idle' : (cat.grounded ? 'sleep' : cat.state);
  if (input.sit) cat.state = cat.state === 'sit' ? 'idle' : (cat.grounded ? 'sit' : cat.state);
  if (moving && (cat.state === 'sit' || cat.state === 'sleep' || cat.state === 'stretch')) cat.state = 'idle';
  if (input.jump && cat.grounded && cat.state !== 'sleep') { cat.vy = JUMP_V * (input.sprint ? 1.05 : 1); cat.grounded = false; if (cat.state === 'sit') cat.state = 'idle'; }
  if (cat.state === 'idle' && !moving && cat.grounded && cat.speed < 0.05) { cat.idleT += dt; if (cat.idleT > 7) { cat.state = 'stretch'; cat.stretchT = 0; cat.idleT = 0; } } else cat.idleT = 0;
  if (cat.state === 'stretch') { cat.stretchT += dt; if (cat.stretchT > 2.8) cat.state = 'idle'; }
  if (POSE_Q && !moving && cat.grounded) { if (cat.state !== POSE_Q) cat.stretchT = 0; cat.state = POSE_Q; cat.idleT = 0; } /* r10 #4: ?pose=sit|sleep|stretch holds a pose for close shots */

  // heading turns toward desire (parallel to tangent plane)
  let target = 0;
  if (moving && (cat.state === 'idle')) {
    cat.holdT += dt;
    const ang = Math.atan2(_l.crossVectors(cat.fwd, want).dot(up), cat.fwd.dot(want));
    const rate = (cat.grounded ? 5.5 : 1.5) * dt;
    const turn = Math.max(-rate, Math.min(rate, ang));
    _q.setFromAxisAngle(up, turn); cat.fwd.applyQuaternion(_q);
    target = (input.sprint ? SPRINT : cat.holdT > 1.4 ? TROT : WALK) * mag * (Math.abs(ang) > 1.6 ? 0.4 : 1);
  } else cat.holdT = 0;
  const acc = target > cat.speed ? 3.5 : 6;
  if (cat.grounded) cat.speed += (target - cat.speed) * Math.min(1, acc * dt);

  // move along the tangent, then parallel-transport the heading to the new up
  const np = _v.copy(cat.pos).addScaledVector(cat.fwd, cat.speed * dt);
  const nUp = np.clone().normalize();
  // collisions with box colliders (in their local frames, y = radial)
  let support = planet && planet.heightAt ? planet.heightAt(nUp) : 0;
  if (planet && planet.blocked && planet.blocked(nUp)) { nUp.copy(up); cat.speed *= 0.3; support = planet.heightAt ? planet.heightAt(nUp) : 0; }
  if (planet) for (const c of planet.colliders) {
    _l.copy(nUp).multiplyScalar(cat.R + cat.alt).applyMatrix4(c.inv);
    if (Math.abs(_l.x) > c.hx + CAT_R + 0.5 || Math.abs(_l.z) > c.hz + CAT_R + 0.5) continue;
    const inX = Math.abs(_l.x) < c.hx + CAT_R * 0.6, inZ = Math.abs(_l.z) < c.hz + CAT_R * 0.6;
    if (inX && inZ) {
      if (cat.alt >= c.top - 0.06) { support = Math.max(support, c.top); continue; }
      // push out along shallowest axis
      const px = c.hx + CAT_R * 0.6 - Math.abs(_l.x), pz = c.hz + CAT_R * 0.6 - Math.abs(_l.z);
      if (px < pz) _l.x += Math.sign(_l.x) * px; else _l.z += Math.sign(_l.z) * pz;
      _l.applyMatrix4(_m.copy(c.inv).invert()); nUp.copy(_l).normalize();
      cat.speed *= 0.6;
    }
  }
  _q.setFromUnitVectors(up, nUp); cat.fwd.applyQuaternion(_q);
  cat.up.copy(nUp); cat.fwd.addScaledVector(nUp, -cat.fwd.dot(nUp)).normalize();

  // radial gravity
  cat.ground = support;
  if (!cat.grounded) { cat.vy -= G * dt; cat.alt += cat.vy * dt; if (cat.alt <= support && cat.vy <= 0) { cat.alt = support; cat.vy = 0; cat.grounded = true; cat.land = 0.25; } }
  else if (cat.alt > support + 0.22) { cat.grounded = false; cat.vy = 0; }
  else cat.alt += (support - cat.alt) * Math.min(1, 20 * dt);
  cat.pos.copy(cat.up).multiplyScalar(cat.R + cat.alt);
  orient(cat);
  animate(cat, dt, moving);
}

function lerpPose(p, t, k) { for (const key in t) p[key] += (t[key] - p[key]) * k; }

function animate(cat, dt, moving) {
  const s = cat.speed;
  const gait = s < 0.05 ? 'idle' : s < 1.2 ? 'walk' : s < 3 ? 'trot' : 'sprint';
  cat.gait = gait;
  let tgt = !cat.grounded ? POSES.air : POSES[cat.state] || POSES.stand;
  if (!cat.grounded) tgt = { ...POSES.air, pitch: Math.max(-0.4, Math.min(0.4, cat.vy * 0.12)) };
  lerpPose(cat.pose, tgt, Math.min(1, (cat.state === 'sleep' ? 2.2 : 7) * dt));
  const P = cat.pose;

  // gait cycle
  const freq = gait === 'walk' ? 1.6 * s / WALK * 0.9 : gait === 'trot' ? 2.6 : gait === 'sprint' ? 3.6 : 0;
  cat.phase += freq * dt * Math.PI * 2;
  const amp = gait === 'walk' ? 0.38 : gait === 'trot' ? 0.55 : gait === 'sprint' ? 0.85 : 0;
  cat.amp = (cat.amp || 0) + (amp - (cat.amp || 0)) * Math.min(1, 6 * dt);
  const A = cat.grounded ? cat.amp : 0;
  // leg phase offsets: walk = lateral sequence, trot = diagonal pairs, sprint = rotary gallop
  const off = gait === 'sprint' ? [0.0, 0.12, 0.55, 0.65] : gait === 'trot' ? [0, 0.5, 0.5, 0] : [0.5, 0, 0.25, 0.75];
  cat.off = cat.off || off.slice(); for (let i = 0; i < 4; i++) cat.off[i] += (off[i] - cat.off[i]) * Math.min(1, 4 * dt);

  let bob = A * 0.022 * Math.abs(Math.sin(cat.phase)), flex = gait === 'sprint' ? Math.sin(cat.phase) * 0.12 * A : 0;
  const breathe = Math.sin(cat.t * (cat.state === 'sleep' ? 1.6 : 2.4)) * 0.006;
  if (cat.land > 0) { cat.land -= dt; bob -= cat.land * 0.12; }
  const pitch = P.pitch + flex;
  cat.body.position.set(0, P.hipY + bob + breathe * 0.5, -0.13);
  cat.body.rotation.set(-pitch, 0, P.roll);
  cat.torso.scale.set(1 + breathe, P.squash + breathe * 1.5, 1 + P.stretchF * 0.06);
  cat.root.position.addScaledVector(cat.up, 0); // root sits on ground at cat.pos

  for (let i = 0; i < 4; i++) {
    const g = cat.legs[i], ph = cat.phase + cat.off[i] * Math.PI * 2;
    const sw = Math.sin(ph) * A, lift = Math.max(0, Math.cos(ph)) * A * 0.35;
    const base = g.front ? P.legF : P.legH;
    const jointY = P.hipY + bob + g.jy * Math.cos(pitch) + g.jz * Math.sin(pitch);
    const ang = base + sw;
    let len;
    if (P.fold > 0.5 || base < -1) len = 0.75 * L;
    else len = Math.max(0.5 * L, Math.min(1.7 * L, jointY / Math.max(0.3, Math.cos(ang)))) * (1 - lift);
    if (!cat.grounded) len = 0.85 * L;
    g.piv.rotation.set(pitch + ang * (g.front ? 1 : 1) * -1 + 0, 0, 0);
    g.piv.rotation.x = pitch - ang;
    g.up.position.y = -len / 2 + 0.01; g.up.scale.y = len / L;
    g.paw.position.set(0, -len + 0.012, 0.012);
  }
  // head: stays roughly level, looks around when idle
  const look = cat.state === 'idle' && !moving ? Math.sin(cat.t * 0.35) * 0.5 * Math.max(0, Math.sin(cat.t * 0.13)) : 0;
  cat.neck.position.y = P.neckY; cat.neck.rotation.set(pitch * 0.85 + P.headP - flex * 0.5 + Math.sin(cat.phase * 2) * A * 0.03, P.headY + look, P.headY * 0.25);
  // blink
  cat.blink -= dt; const closed = cat.state === 'sleep' || (cat.blink < 0.12);
  if (cat.blink < 0) cat.blink = 2 + Math.random() * 4;
  for (const e of cat.eyes) e.scale.y = closed ? 0.12 : 0.75;
  // tail
  for (let i = 0; i < cat.tail.length; i++) {
    const seg = cat.tail[i], k = i / cat.tail.length;
    const sway = Math.sin(cat.t * (moving ? 3 : 1.1) - i * 0.6) * (0.12 + k * 0.1) * (cat.state === 'sleep' ? 0.15 : 1);
    if (i === 0) seg.rotation.set((P.tailUp + 0.2) * 1.2 + pitch * 0.5, Math.PI + sway * 0.5, 0);
    else seg.rotation.set(P.tailUp > 0.6 ? -0.08 : 0.18 + P.tailCurl * 0.12 - (gait === 'sprint' ? 0.15 : 0), sway + P.tailCurl * 0.42 * (i > 1 ? 1 : 0.3), 0);
  }
  if (cat.glb) driveGLB(cat, dt);
  if (cat.blob){ const sy = cat.root.scale.y || 1, al = Math.max(0, (cat.alt || 0) - (cat.ground || 0)); cat.blob.position.y = .001 - al / sy; cat.blob.material.opacity = .42 / (1 + al * 6); }
}
