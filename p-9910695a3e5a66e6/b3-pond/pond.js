// 06 芦苇鸭塘 — reed duck-pond region for 褶星 Fold.
// createPond(scene, planet, centerDir) -> pond API (update, sample, toLocal/toWorld, frame, addRipple)
// Water: Gerstner-ish sum + ring ripples, shore foam from depth field, absorption colour, posterised to gouache bands.
import * as THREE from '../shared/vendor/three.module.js';
import { mergeGeometries } from '../shared/vendor/BufferGeometryUtils.js';

// ---------- small helpers ----------
const hash = (x, y) => { const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return s - Math.floor(s); };
function vnoise(x, y){ const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy;
  const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
  const a = hash(ix, iy), b = hash(ix + 1, iy), c = hash(ix, iy + 1), d = hash(ix + 1, iy + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v; }
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
let _seed = 7; const rnd = () => (_seed = (_seed * 16807) % 2147483647) / 2147483647;

export function gouacheGradient(){
  const d = new Uint8Array([120, 120, 120, 255, 185, 185, 185, 255, 238, 238, 238, 255]);
  const t = new THREE.DataTexture(d, 3, 1); t.minFilter = t.magFilter = THREE.NearestFilter; t.needsUpdate = true; return t;
}
const GRAD = gouacheGradient();
export const clay = (hex, extra = {}) => new THREE.MeshToonMaterial({ color: hex, gradientMap: GRAD, ...extra });

// ---------- pond shape / depth field (local metres, x east, z north) ----------
export const POND = { radius: 13, maxDepth: 1.5, patch: 46, water: 0 };
// the painted surface floats LIFT above the bank so the coarse ground grid never pokes through: the waterline is the shader's soft contour
const LIFT = .12;
export function pondSD(x, z){ const th = Math.atan2(z, x);
  const r = POND.radius + 2.2 * Math.sin(2 * th + 1) + 1.3 * Math.sin(3 * th + 0.4) + 0.7 * Math.sin(5 * th + 2);
  return Math.hypot(x, z) - r; }
export function terrainH(x, z){ const sd = pondSD(x, z);
  if (sd < 0) return -POND.maxDepth * smooth(0.6, 7, -sd) - 0.035 * smooth(0, 0.6, -sd);   // shallow wading shelf, then basin
  return 0.16 * smooth(.9, 4, sd) +   // flat for ~1 m past the waterline, then the bank
     0.06 * (vnoise(x * .3, z * .3) - .5) * smooth(2, 6, sd); }

// waves — keep JS and GLSL in sync
const WAVES = [ // dirAngle, wavelength, amplitude, phase
  [0.3, 3.1, 0.022, 0.0], [1.9, 2.3, 0.016, 1.3], [-1.1, 1.4, 0.009, 2.1], [2.7, 0.9, 0.005, 0.7]];
function waveH(x, z, t, depth){ let h = 0; const damp = smooth(0, 0.6, depth);
  for (const [a, L, A, p] of WAVES){ const k = 2 * Math.PI / L, w = Math.sqrt(9.81 * k);
    h += A * Math.sin(k * (Math.cos(a) * x + Math.sin(a) * z) - w * t * 0.6 + p); }
  return h * damp; }
const GLSL_WAVES = WAVES.map(([a, L, A, p]) => { const k = 2 * Math.PI / L, w = Math.sqrt(9.81 * k);
  return `{ vec2 D=vec2(${Math.cos(a).toFixed(4)},${Math.sin(a).toFixed(4)}); float ph=${k.toFixed(4)}*dot(D,p)-${(w * .6).toFixed(4)}*uTime+${p.toFixed(3)};
    h+=${A}*sin(ph); g+=${A}*${k.toFixed(4)}*cos(ph)*D; off+=${(A * 0.6).toFixed(4)}*cos(ph)*D; }`; }).join('\n');

export function createPond(scene, planet, centerDir){
  const R = planet.R ?? planet.radius ?? 600;
  const Cn = centerDir.clone().normalize();
  const helper = Math.abs(Cn.y) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0);
  const E = new THREE.Vector3().crossVectors(helper, Cn).normalize();
  const N = new THREE.Vector3().crossVectors(E, Cn).normalize();
  const C = Cn.clone().multiplyScalar(R);
  const group = new THREE.Group(); group.name = 'pond06'; scene.add(group);

  const _v = new THREE.Vector3();
  function toWorld(x, z, h, out = new THREE.Vector3()){
    return out.copy(C).addScaledVector(E, x).addScaledVector(N, z).normalize().multiplyScalar(R + h); }
  function toLocal(p){ const pn = _v.copy(p).normalize(); const s = R / pn.dot(Cn);
    return { x: pn.dot(E) * s, z: pn.dot(N) * s, h: p.length() - R }; }
  const _m = new THREE.Matrix4(), _u = new THREE.Vector3(), _e = new THREE.Vector3(), _n = new THREE.Vector3();
  // quaternion at local point: +Y radial up, +Z toward heading yaw (0 = local +z)
  function frame(x, z, yaw = 0, out = new THREE.Quaternion()){
    toWorld(x, z, 0, _u).normalize();
    _e.copy(E).addScaledVector(_u, -E.dot(_u)).normalize(); _n.crossVectors(_e, _u);
    const fx = Math.sin(yaw), fz = Math.cos(yaw);
    const f = new THREE.Vector3().addScaledVector(_e, fx).addScaledVector(_n, fz);
    const r = new THREE.Vector3().crossVectors(_u, f);
    _m.makeBasis(r, _u, f); return out.setFromRotationMatrix(_m); }

  // ---------- ground patch with hand-painted canvas texture ----------
  const P = POND.patch, TEX = 1024;
  const cv = document.createElement('canvas'); cv.width = cv.height = TEX; const g = cv.getContext('2d');
  const img = g.createImageData(TEX, TEX), d = img.data;
  const GR = [[143, 152, 104], [158, 163, 116], [172, 172, 128]], MUD = [150, 132, 98], BED = [108, 104, 80], PAPER = [235, 229, 216];
  for (let j = 0; j < TEX; j++) for (let i = 0; i < TEX; i++){
    const x = (i / TEX - .5) * P, z = (.5 - j / TEX) * P, sd = pondSD(x, z), k = (j * TEX + i) * 4;
    const n = vnoise(x * .18, z * .18) * .7 + vnoise(x * .7, z * .7) * .3 + (hash(i, j) - .5) * .12;
    let c = GR[Math.min(2, Math.floor(n * 3))];                                   // flat gouache field bands
    if (sd < 1.3 + .8 * vnoise(x * .9, z * .9)) c = MUD;
    if (sd < -.4) c = BED;
    const edge = Math.hypot(x, z) / (P / 2);                                       // dithered block-bleed into the planet base colour
    const pe = smooth(.72, .97, edge + (vnoise(x * 1.3, z * 1.3) - .5) * .22 + (hash(i, j) - .5) * .05);
    const ink = [0, 1, 2].map(q => c[q] + (GR[1][q] - c[q]) * smooth(.4, .6, pe));   // soft paper-bleed, no blocks
    d[k] = ink[0]; d[k + 1] = ink[1]; d[k + 2] = ink[2]; d[k + 3] = 255; }
  g.putImageData(img, 0, 0);
  g.lineCap = 'round';                                                            // pencil-tick grass
  for (let s = 0; s < 260; s++){ const i = rnd() * TEX, j = rnd() * TEX;           // soft gouache dabs (designer-style field mottling)
    g.fillStyle = rnd() < .5 ? 'rgba(126,138,92,.10)' : 'rgba(184,180,136,.10)';
    g.beginPath(); g.ellipse(i, j, 14 + rnd() * 30, 6 + rnd() * 12, -.4 + rnd() * .3, 0, 7); g.fill(); }
  for (let s = 0; s < 22000; s++){ const i = rnd() * TEX, j = rnd() * TEX, x = (i / TEX - .5) * P, z = (.5 - j / TEX) * P;
    if (pondSD(x, z) < 1.2 || Math.hypot(x, z) > P * .36) continue;
    g.strokeStyle = rnd() < .5 ? 'rgba(92,104,70,.5)' : (rnd() < .7 ? 'rgba(120,128,84,.45)' : 'rgba(196,190,146,.4)'); g.lineWidth = .9 + rnd() * .6;
    const a = -1.2 + rnd() * .5, L = 3 + rnd() * 4; g.beginPath(); g.moveTo(i, j); g.lineTo(i + Math.cos(a) * L, j + Math.sin(a) * L); g.stroke(); }
  const groundTex = new THREE.CanvasTexture(cv); groundTex.colorSpace = THREE.SRGBColorSpace; groundTex.anisotropy = 4;

  const SEG = 180, gp = [], guv = [], gi = [];
  for (let j = 0; j <= SEG; j++) for (let i = 0; i <= SEG; i++){
    const x = (i / SEG - .5) * P, z = (.5 - j / SEG) * P, edge = Math.max(Math.abs(x), Math.abs(z)) / (P / 2);
    const h = terrainH(x, z) * (1 - smooth(.85, 1, edge)) + .015;
    toWorld(x, z, h, _v); gp.push(_v.x, _v.y, _v.z); guv.push(i / SEG, 1 - j / SEG); }
  for (let j = 0; j < SEG; j++) for (let i = 0; i < SEG; i++){ const a = j * (SEG + 1) + i, b = a + 1, c = a + SEG + 1, e = c + 1; gi.push(a, b, c, b, e, c); }
  const gg = new THREE.BufferGeometry(); gg.setAttribute('position', new THREE.Float32BufferAttribute(gp, 3));
  gg.setAttribute('uv', new THREE.Float32BufferAttribute(guv, 2)); gg.setIndex(gi); gg.computeVertexNormals();
  const ground = new THREE.Mesh(gg, clay(0xffffff, { map: groundTex })); group.add(ground);

  // ---------- water ----------
  const ripples = Array.from({ length: 8 }, () => new THREE.Vector4(0, 0, -99, 0)); let ripI = 0;
  const col = h => new THREE.Color(h);
  const wu = THREE.UniformsUtils.merge([THREE.UniformsLib.fog, {
    uTime: { value: 0 }, uRip: { value: ripples }, uE: { value: E }, uN: { value: N }, uSun: { value: new THREE.Vector3() },
    uBand: { value: [col(0x3e5654), col(0x56716b), col(0x768f84), col(0x9aab94)] }, uFoam: { value: col(0xe9e2cf) }, uShore: { value: col(0xdde6ec) }, uStroke: { value: col(0x9cbae8) }, uLine: { value: col(0xc8cbb5) }, uMud: { value: col(0x8d7d5c) } }]);
  wu.uRip.value = ripples; wu.uE.value = E; wu.uN.value = N;
  const water = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.ShaderMaterial({ uniforms: wu, fog: true, transparent: true,
    vertexShader: `
      attribute vec2 aLocal; attribute float aDepth;
      uniform float uTime; uniform vec4 uRip[8]; uniform vec3 uE, uN;
      varying float vDepth, vRing; varying vec2 vL; varying vec3 vNrm, vUp;
      #include <fog_pars_vertex>
      void main(){
        vec2 p = aLocal; float h = 0.; vec2 g = vec2(0.), off = vec2(0.);
        ${GLSL_WAVES}
        float damp = smoothstep(0., .6, aDepth); h *= damp; g *= damp; off *= damp;
        float ring = 0.;
        for (int i = 0; i < 8; i++){ vec4 r = uRip[i]; float age = uTime - r.z; if (age < 0. || age > 6.) continue;
          vec2 dv = p - r.xy; float dist = length(dv) + 1e-4, front = .55 * age, x = dist - front;
          float env = r.w * exp(-age * .7) * exp(-x * x * 5.) / (1. + dist);
          h += env * sin(x * 10.); g += env * 10. * cos(x * 10.) * dv / dist; ring = max(ring, env * 20.); }
        vec3 U = normalize(position);
        vec3 pos = position + U * (h + ${LIFT.toFixed(3)}) + (uE * off.x + uN * off.y) * .5;
        vUp = U; vNrm = normalize(U - uE * g.x - uN * g.y); vDepth = aDepth; vRing = ring; vL = p;
        vec4 mvPosition = modelViewMatrix * vec4(pos, 1.); gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: `
      uniform float uTime; uniform vec3 uSun, uBand[4], uFoam, uShore, uStroke, uLine, uMud;
      varying float vDepth, vRing; varying vec2 vL; varying vec3 vNrm, vUp;
      #include <fog_pars_fragment>
      float hs(vec2 q){ return fract(sin(dot(q, vec2(127.1, 311.7))) * 43758.5453); }
      float vn(vec2 q){ vec2 i = floor(q), f = fract(q); f = f*f*(3.-2.*f);
        return mix(mix(hs(i), hs(i+vec2(1,0)), f.x), mix(hs(i+vec2(0,1)), hs(i+vec2(1,1)), f.x), f.y); }
      float fbm(vec2 q){ return vn(q) * .6 + vn(q * 2.1 + 7.) * .4; }
      float hp(vec2 i){ return hs(vec2(mod(i.x, 80.), i.y)); }                       // noise that wraps around the shore (period 80)
      float vnp(vec2 q){ vec2 i = floor(q), f = fract(q); f = f*f*(3.-2.*f);
        return mix(mix(hp(i), hp(i+vec2(1,0)), f.x), mix(hp(i+vec2(0,1)), hp(i+vec2(1,1)), f.x), f.y); }
      float hk(vec2 i, float K){ return hs(vec2(mod(i.x, K), i.y)); }                // noise that wraps around the shore (integer period K)
      float vk(vec2 q, float K){ vec2 i = floor(q), f = fract(q); f = f*f*(3.-2.*f);
        return mix(mix(hk(i, K), hk(i+vec2(1,0), K), f.x), mix(hk(i+vec2(0,1), K), hk(i+vec2(1,1), K), f.x), f.y); }
      float pondSD(vec2 p){ float th = atan(p.y, p.x);
        return length(p) - (${POND.radius.toFixed(1)} + 2.2*sin(2.*th+1.) + 1.3*sin(3.*th+.4) + .7*sin(5.*th+2.)); }
      void main(){
        vec2 dr = vec2(uTime * .016, -uTime * .010);
        // waterline: the analytic contour + slow low-frequency wobble, feathered 1-2 px (never the mesh polygon)
        float sds = pondSD(vL);                                                        // contour softened: mean over a ring of taps rounds every corner (r ~ 1.5 m)
        for (int k = 0; k < 8; k++){ float ak = float(k) * .7854 + .3; sds += pondSD(vL + 1.5 * vec2(cos(ak), sin(ak))); }
        float sdn = sds / 9. + (fbm(vL * .33 + dr * .2 + 40.) - .5) * .09;
        float aw = fwidth(sdn) * 1.1 + .002;
        float alpha = 1. - smoothstep(-aw, aw, sdn);
        if (alpha < .003) discard;
        float sdi = -sdn;                                                              // metres inside the waterline
        float an = atan(vL.y, vL.x) / 6.28318 + .5;                                    // 0..1 around the shore
        // calm gouache: a broad depth wash in 4 value steps; the step edges are noise-warped like brushed washes
        float lit = dot(normalize(vNrm), uSun) - dot(normalize(vUp), uSun);
        float warp = (fbm(vL * .15 + dr) - .5) * 1.05 + (vn(vL * vec2(.5, .32) - dr * 1.4 + 5.) - .5) * .4;
        float d = vDepth + warp * smoothstep(.0, .5, vDepth) + lit * 2.2;
        float w = max(fwidth(d) * 5., .07) * (.8 + .5 * vn(vL * .9 + 11.));   // wide noisy feather: washes blend, no contour terraces
        // shelf width follows the shore: broad and pale by the stepping stones, narrow under the steep far bank, broken in places
        float stoneSide = exp(-pow((an - .62) * 5.5, 2.));
        float shN = vk(vec2(an * 11. + 2., 3.), 11.), shN2 = vk(vec2(an * 23., 7.), 23.);
        float t1 = .02 + .19 * shN * shN + .06 * (shN2 - .3) + .22 * stoneSide;
        t1 = max(t1, .0);
        float shelf = smoothstep(t1 - w, t1 + w, d);
        vec3 c = mix(uBand[3] + vec3(.03, .03, .025) * (stoneSide + .2), uBand[2], shelf);
        c = mix(c, uBand[1], smoothstep(.62 - w, .62 + w, d));
        c = mix(c, uBand[0], smoothstep(1.02 - w, 1.02 + w, d));
        // deep water: faint, long-wavelength, slow pigment variation (+-3 %), no steps
        c *= 1. + (fbm(vL * .07 + dr * .3 + 20.) - .5) * .07;
        // a few long soft light-blue strokes, curved along the pond (concentric), drifting slowly
        float sk = smoothstep(.62, .85, vn(vL * vec2(.07, .55) + vec2(uTime * .002, 3.))) * smoothstep(.5, .8, vn(vL * vec2(.04, .2) + 9.));   // a few short, almost straight flow strokes
        sk *= smoothstep(2.4, 4.4, sdi) * smoothstep(3., 6., length(vL));
        c = mix(c, uStroke, sk * .13);
        c *= 1. + (vn(vL * 18.) - .5) * .035;                                             // paper tooth
        // shore: thin, broken, pale blue-grey dry-brush dashes hugging the waterline
        float dash = smoothstep(.52, .68, vk(vec2(an * 110., sdi * 9. + vn(vL * 2.) * 1.5), 110.));
        float gap = smoothstep(.32, .6, vk(vec2(an * 14., 5.), 14.));
        float zone = smoothstep(.0, .05, sdi) * (1. - smoothstep(.13, .3, sdi + (vn(vL * 3.) - .5) * .12));
        float foam = zone * dash * gap;
        c = mix(c, uBand[1] * .8, smoothstep(.0, .08, sdi) * (1. - smoothstep(.12, .3, sdi)) * .22);   // damp contact
        c = mix(c, uShore, foam * .55);
        c = mix(c, uStroke, smoothstep(.45, .95, vRing) * .3);
        gl_FragColor = vec4(c, alpha);
        #include <colorspace_fragment>
        #include <fog_fragment>
      }` }));
  { const S = 200, W = 40, pos = [], loc = [], dep = [], idx = [];
    for (let j = 0; j <= S; j++) for (let i = 0; i <= S; i++){ const x = (i / S - .5) * W, z = (.5 - j / S) * W;
      toWorld(x, z, POND.water, _v); pos.push(_v.x, _v.y, _v.z); loc.push(x, z); dep.push(POND.water - terrainH(x, z)); }
    for (let j = 0; j < S; j++) for (let i = 0; i < S; i++){ const a = j * (S + 1) + i, b = a + 1, c = a + S + 1, e = c + 1;
      { const sdc = [a, b, c, e].map(q => pondSD(loc[q * 2], loc[q * 2 + 1])); if (Math.min(...sdc) > 1.6) continue; } idx.push(a, b, c, b, e, c); }
    const wg = water.geometry; wg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    wg.setAttribute('aLocal', new THREE.Float32BufferAttribute(loc, 2)); wg.setAttribute('aDepth', new THREE.Float32BufferAttribute(dep, 1)); wg.setIndex(idx); }
  water.frustumCulled = false; group.add(water);

  function addRipple(x, z, amp = .03, t = clock){ ripples[ripI].set(x, z, t, amp); ripI = (ripI + 1) % ripples.length; }

  // ---------- merge helper: vertex-coloured parts → one geometry (keeps draw calls low) ----------
  const part = (geo, hex, m4) => { let g2 = geo.index ? geo.toNonIndexed() : geo; if (m4) g2.applyMatrix4(m4); g2.deleteAttribute('uv');
    const c = new THREE.Color(hex), n = g2.attributes.position.count, a = new Float32Array(n * 3); for (let i = 0; i < n; i++){ a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; }
    g2.setAttribute('color', new THREE.BufferAttribute(a, 3)); return g2; };
  const M4 = (x, y, z, sx = 1, sy = 1, sz = 1, rx = 0, ry = 0, rz = 0) => new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(sx, sy, sz));
  const vcMat = () => new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: GRAD });

  // ---------- soft water shadows / contact rings: ONE instanced mesh for ducks, stones, log ----------
  const NSH = 24;
  const shTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const k = c.getContext('2d');
    const gr = k.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(20,48,104,.5)'); gr.addColorStop(.55, 'rgba(20,48,104,.44)'); gr.addColorStop(.8, 'rgba(24,56,118,.12)'); gr.addColorStop(1, 'rgba(24,56,118,0)');
    k.fillStyle = gr; k.fillRect(0, 0, 64, 64); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })();
  const shGeo = new THREE.PlaneGeometry(1, 1); shGeo.rotateX(-Math.PI / 2);
  const shadows = new THREE.InstancedMesh(shGeo, new THREE.MeshBasicMaterial({ map: shTex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }), NSH);
  shadows.frustumCulled = false; shadows.count = 0; shadows.renderOrder = 2; group.add(shadows);
  const _sq = new THREE.Quaternion(), _sp = new THREE.Vector3(), _ss = new THREE.Vector3(), _sm = new THREE.Matrix4(); let shN = 0;
  const addShadow = (x, z, yaw, sx, sz, lift = .08, i = shN++) => { toWorld(x, z, POND.water + LIFT + lift, _sp); frame(x, z, yaw, _sq); shadows.setMatrixAt(i, _sm.compose(_sp, _sq, _ss.set(sx, 1, sz))); shadows.count = Math.max(shadows.count, i + 1); };

  // ---------- stepping stones: flat grey stones, one merged mesh, soft darkening on the water ----------
  const stones = [];
  { const parts = [], a0 = 3.55, a1 = 4.45, sd0 = (x, z) => pondSD(x, z);
    const pt = th => { let r = 2; while (sd0(r * Math.cos(th), r * Math.sin(th)) < -.8) r += .05; return [r * Math.cos(th), r * Math.sin(th)]; };
    const [x0, z0] = pt(a0), [x1, z1] = pt(a1), L = Math.hypot(x1 - x0, z1 - z0), n = Math.round(L / .82);
    for (let i = 0; i <= n; i++){ const t = i / n, bow = Math.sin(t * Math.PI) * 2.2;
      const x = x0 + (x1 - x0) * t + bow * (z1 - z0) / L * -1 + (rnd() - .5) * .15, z = z0 + (z1 - z0) * t + bow * (x1 - x0) / L + (rnd() - .5) * .15;
      const r = .27 + rnd() * .2, top = LIFT + .08 + rnd() * .05, bot = terrainH(x, z), yaw = rnd() * 6;
      const geo = new THREE.CylinderGeometry(r * .86, r * 1.1, top - bot, 11, 1); geo.translate(0, (top + bot) / 2, 0);
      const ex = .78 + rnd() * .5, ez = .78 + rnd() * .5; geo.scale(ex, 1, ez);
      const p = geo.attributes.position; for (let k = 0; k < p.count; k++){ const yy = p.getY(k); p.setX(k, p.getX(k) * (1 + (hash(k, i) - .5) * .3)); p.setZ(k, p.getZ(k) * (1 + (hash(i, k) - .5) * .3)); if (yy > top - .01) p.setY(k, yy - hash(k * 3, i) * .015); }
      geo.computeVertexNormals();
      const tone = [0xccc5b5, 0xd5cebe, 0xc3bcac][i % 3], side = new THREE.Color(0x726b5f);
      { const g3 = geo.toNonIndexed(), nn = g3.attributes.normal, pp = g3.attributes.position, ca = new Float32Array(nn.count * 3), tc3 = new THREE.Color(tone), cc = new THREE.Color();
        for (let k = 0; k < nn.count; k++){ cc.copy(nn.getY(k) > .5 ? tc3 : (nn.getY(k) < -.5 ? side : side.clone().lerp(tc3, Math.max(0, pp.getY(k) - (bot + top) / 2) / ((top - bot) / 2) * .55))); ca[k * 3] = cc.r; ca[k * 3 + 1] = cc.g; ca[k * 3 + 2] = cc.b; }
        g3.setAttribute('color', new THREE.BufferAttribute(ca, 3)); g3.deleteAttribute('uv'); parts.push(g3.applyMatrix4(new THREE.Matrix4().compose(toWorld(x, z, 0), frame(x, z, yaw), new THREE.Vector3(1, 1, 1)))); }
      stones.push({ x, z, r: r * .85, top }); addShadow(x, z, yaw, r * 2.5, r * 2.5, .07); } 
    group.add(new THREE.Mesh(mergeGeometries(parts), vcMat())); }

  // ---------- one floating log, bark + pale cut ends (buoyant, tilts under a 4 kg point load) ----------
  const logs = [];
  { const x = 2.2, z = 3.6, yaw = .7, L = 3.2, r = .36;
    const m = new THREE.Group();
    const cyl = new THREE.CylinderGeometry(r, r * 1.06, L, 12, 3); cyl.rotateX(Math.PI / 2);
    const cp = cyl.attributes.position; for (let k = 0; k < cp.count; k++){ const f = 1 + (hash(k, 3) - .5) * .09; cp.setX(k, cp.getX(k) * f); cp.setY(k, cp.getY(k) * f); }
    cyl.computeVertexNormals();
    const bark = cyl.toNonIndexed(); bark.computeVertexNormals(); bark.deleteAttribute('uv');
    const cn = bark.attributes.normal, bc = new Float32Array(cn.count * 3), dark = new THREE.Color(0x6c5339), mid = new THREE.Color(0x826848), pale = new THREE.Color(0xd2bd92), tc = new THREE.Color();
    for (let k = 0; k < cn.count; k++){ const cap = Math.abs(cn.getZ(k)) > .85; tc.copy(cap ? pale : (Math.floor((Math.atan2(cn.getY(k), cn.getX(k)) + 3.2) * 2.2 + hash(k >> 3, 1)) % 2 ? dark : mid)); bc[k * 3] = tc.r; bc[k * 3 + 1] = tc.g; bc[k * 3 + 2] = tc.b; }
    bark.setAttribute('color', new THREE.BufferAttribute(bc, 3));
    const stub = part(new THREE.CylinderGeometry(.06, .08, .34, 6), 0x6c5339, M4(r * .7, .12, L * .2, 1, 1, 1, 0, 0, -1.1));
    const lg = new THREE.Mesh(mergeGeometries([bark, stub]), vcMat()); m.add(lg); group.add(m);
    logs.push({ m, x, z, x0: x, z0: z, yaw, L, r, mass: 30, heave: 0, vh: 0, pitch: 0, vp: 0, roll: 0, vr: 0, load: null, sh: -1 }); }
  logs[0].sh = shN++;

  // ---------- reeds: a few painted clumps (fan of thick olive blades + ochre cattail heads), swaying ----------
  const swayU = { value: 0 };
  const sway = mat => { mat.onBeforeCompile = s => { s.uniforms.uTime = swayU;
    s.vertexShader = 'uniform float uTime;\n' + s.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      vec3 ip = vec3(instanceMatrix[3]); float ph = dot(ip, vec3(.37, .21, .29));
      float bend = pow(max(position.y, 0.) / 2., 2.);
      transformed.x += (sin(uTime * .7 + ph) * .7 + sin(uTime * 1.5 + ph * 2.1) * .3) * .05 * bend;
      transformed.z += sin(uTime * .55 + ph * 1.7) * .03 * bend;`); }; return mat; };
  function clumpGeo(nBl, nHd, seed){ const rr = (() => { let s = seed; return () => (s = (s * 16807) % 2147483647) / 2147483647; })(), parts = [];
    const cols = [0x55643a, 0x667443, 0x4d5c36, 0x71804a];
    for (let i = 0; i < nBl; i++){ const a = i / nBl * 6.283 + rr(), lean = .1 + rr() * .3, H = 1.0 + rr() * .7, wd = .2 + rr() * .07, off = rr() * .12;
      const SEG = 4, pos = [], col = [], idx = [], c0 = new THREE.Color(cols[i % 4]), cb = c0.clone().multiplyScalar(.7), ca = c0.clone().lerp(new THREE.Color(0x8d8a52), .35);
      for (let k = 0; k <= SEG; k++){ const t = k / SEG, y = H * t, out = off + lean * H * t * t * 1.1, w = wd * (1 - t * t * .96) * .5;
        const tc2 = c0.clone().lerp(ca, t * t); tc2.lerp(cb, (1 - t) * .5);
        for (const sgn of [-1, 1]){ pos.push(Math.cos(a) * out - Math.sin(a) * w * sgn, y, Math.sin(a) * out + Math.cos(a) * w * sgn); col.push(tc2.r, tc2.g, tc2.b); } }
      for (let k = 0; k < SEG; k++){ const b = k * 2; idx.push(b, b + 1, b + 2, b + 1, b + 3, b + 2); }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.setIndex(idx);
      const gn = g.toNonIndexed(); gn.computeVertexNormals(); parts.push(gn); }
    for (let i = 0; i < nHd; i++){ const a = rr() * 6.283, lean = .1 + rr() * .2, H = 1.3 + rr() * .5, out = lean * H * H / H * 1.1 * .9;
      parts.push(part(new THREE.CapsuleGeometry(.058, .27, 2, 8), 0x7b6a52, M4(Math.cos(a) * out, H * .88, Math.sin(a) * out, 1, 1, 1, 0, 0, 0)));
      parts.push(part(new THREE.CylinderGeometry(.018, .022, H * .8, 4), 0x6a7440, M4(Math.cos(a) * out * .5, H * .4, Math.sin(a) * out * .5, 1, 1, 1, 0, 0, 0))); }
    return mergeGeometries(parts); }
  const reedMat = sway(new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: GRAD, side: THREE.DoubleSide }));
  const reedA = new THREE.InstancedMesh(clumpGeo(11, 1, 11), reedMat, 8), reedB = new THREE.InstancedMesh(clumpGeo(9, 3, 23), reedMat, 8);
  reedA.userData.short = reedB.userData.short = 1;
  { const q = new THREE.Quaternion(), s3 = new THREE.Vector3(), p3 = new THREE.Vector3(), mtx = new THREE.Matrix4();
    // 3 shore groups (angle in pond-local atan2(z,x), clumps) — screen: up = +x, right = +z at the default camera
    const GROUPS = [[-.78, 4], [.55, 4], [1.62, 2], [-2.2, 1]];
    let na = 0, nb = 0;
    for (const [a0, n] of GROUPS) for (let i = 0; i < n; i++){
      const a = a0 + (i - (n - 1) / 2) * .13 + (rnd() - .5) * .05; let r = 6; while (pondSD(Math.cos(a) * r, Math.sin(a) * r) < -.15 - rnd() * .2 && r < 30) r += .05;
      const x = Math.cos(a) * r, z = Math.sin(a) * r, sc = 1.0 + rnd() * .45;
      toWorld(x, z, terrainH(x, z) - .05, p3); frame(x, z, rnd() * 6, q); mtx.compose(p3, q, s3.set(sc * (.9 + rnd() * .3), sc, sc));
      if (i % 2) reedB.setMatrixAt(nb++, mtx); else reedA.setMatrixAt(na++, mtx);
      if (rnd() < .6){ const x2 = x + (rnd() - .5) * 1.4, z2 = z + (rnd() - .5) * 1.4; if (pondSD(x2, z2) > -.9){ toWorld(x2, z2, terrainH(x2, z2) - .05, p3); frame(x2, z2, rnd() * 6, q); mtx.compose(p3, q, s3.set(sc * .7, sc * .7, sc * .7)); if (nb < 8) reedB.setMatrixAt(nb++, mtx); } } }
    reedA.count = na; reedB.count = nb; }
  reedA.frustumCulled = reedB.frustumCulled = false; group.add(reedA, reedB);

  // ---------- ducks (round clay, 2 draw calls each: body + head/neck; scaled ≈ 1/3 of the cat) ----------
  const ducks = [], DS = 2.05;
  const DUCK = { drake: { body: 0xe6dcc4, wing: 0xc9bb9a, brst: 0x8e5f42, tail: 0x3a3a36, head: 0x2f6048, ring: 0xf2ece0, beak: 0xdc9a34 },
                 hen:   { body: 0x9f7a52, wing: 0x86643f, brst: 0x8f6d48, tail: 0x70553a, head: 0xb18c60, ring: 0xb18c60, beak: 0xc98a3c } };
  const S = (r, w = 10, h = 8) => new THREE.SphereGeometry(r, w, h);
  function duckGeo(hen){ const c = hen ? DUCK.hen : DUCK.drake, B = [], H = [];
    B.push(part(S(.13, 12, 9), c.body, M4(0, .04, 0, 1, .72, 1.55)));
    B.push(part(S(.1), c.brst, M4(0, .05, .1, 1, .8, .9)));
    for (const sx of [-1, 1]) B.push(part(S(.08, 8, 6), c.wing, M4(sx * .095, .085, -.03, .45, .5, 1.5, -.18, 0, 0)));
    B.push(part(new THREE.ConeGeometry(.06, .12, 7), c.tail, M4(0, .1, -.2, 1, 1, 1, -2.2, 0, 0)));
    H.push(part(S(.068, 10, 8), c.head, M4(0, .07, 0)));
    H.push(part(new THREE.CylinderGeometry(.04, .052, .1, 7), c.head, M4(0, .02, -.01)));
    if (!hen) H.push(part(new THREE.TorusGeometry(.048, .011, 5, 10), c.ring, M4(0, .0, 0, 1, 1, 1, Math.PI / 2, 0, 0)));
    H.push(part(S(.035, 8, 6), c.beak, M4(0, .058, .07, 1, .45, 1.6)));
    for (const sx of [-1, 1]) H.push(part(S(.011, 5, 4), 0x1c1a18, M4(sx * .055, .08, .035)));
    return [mergeGeometries(B), mergeGeometries(H)]; }
  const DG = [duckGeo(false), duckGeo(true)], dMat = vcMat();
  function makeDuck(hen){ const d = new THREE.Group(); const [bg, hg] = DG[hen ? 1 : 0];
    d.add(new THREE.Mesh(bg, dMat)); const neck = new THREE.Group(); neck.position.set(0, .13, .14); neck.add(new THREE.Mesh(hg, dMat)); d.add(neck);
    d.scale.setScalar(DS); d.userData.neck = neck; group.add(d); return d; }
  let gidN = 0;
  for (const [gx, gz, n] of [[3.5, -3, 3], [-1.5, 5.5, 2], [6.5, 4, 1]]){
    const gh = rnd() * 6; gidN++;
    for (let i = 0; i < n; i++){ const dk = { m: makeDuck(i > 0 && rnd() < .5 || (n === 1 && false)), x: gx + (rnd() - .5) * 1.5, z: gz + (rnd() - .5) * 1.5, yaw: gh, speed: .25, groupHead: gh, gid: gidN, phase: rnd() * 9, dip: 0, sh: shN++ }; ducks.push(dk); } }

  // ---------- sun ----------
  const sunDir = new THREE.Vector3().copy(Cn).multiplyScalar(.8).addScaledVector(E, .45).addScaledVector(N, .4).normalize();
  wu.uSun.value.copy(sunDir);

  // ---------- queries ----------
  function waterLevel(x, z, t = clock){ return POND.water + LIFT + waveH(x, z, t, POND.water - terrainH(x, z)); }
  function logTop(lg, x, z){ // height of log top at local point, or -Infinity
    const dx = x - lg.x, dz = z - lg.z, ax = Math.sin(lg.yaw), az = Math.cos(lg.yaw);
    const s = dx * ax + dz * az, l = dx * az - dz * ax;
    if (Math.abs(s) > lg.L / 2 || Math.abs(l) > lg.r * .95) return { h: -Infinity };
    return { h: lg.heave + Math.sqrt(lg.r * lg.r - l * l) + Math.sin(lg.pitch) * s - Math.sin(lg.roll) * l, s, l }; }
  // support under a local point: ground / stone / log, plus water info
  function sample(x, z){
    let h = terrainH(x, z), kind = 'ground', ref = null;
    for (const s of stones) if (Math.hypot(s.x - x, s.z - z) < s.r && s.top > h){ h = s.top; kind = 'stone'; ref = s; }
    for (const lg of logs){ const t = logTop(lg, x, z); if (t.h > h){ h = t.h; kind = 'log'; ref = lg; } }
    const w = waterLevel(x, z), depth = Math.max(0, w - LIFT - terrainH(x, z));
    return { h, kind, ref, water: w, depth, wet: kind === 'ground' && depth > 0 }; }

  // ---------- update ----------
  let clock = 0, prevLoad = null;
  const qa = new THREE.Quaternion(), qb = new THREE.Quaternion();
  function update(dt, cat){ // cat: {x,z,h,on} in local coords (optional)
    clock += dt; wu.uTime.value = clock; swayU.value = clock; shadows.instanceMatrix.needsUpdate = true;
    // logs: heave/pitch/roll spring-dampers driven by wave field + point load
    for (const lg of logs){
      const ax = Math.sin(lg.yaw), az = Math.cos(lg.yaw), half = lg.L * .4;
      const hA = waterLevel(lg.x + ax * half, lg.z + az * half), hB = waterLevel(lg.x - ax * half, lg.z - az * half);
      const hL = waterLevel(lg.x + az * lg.r, lg.z - ax * lg.r), hR = waterLevel(lg.x - az * lg.r, lg.z + ax * lg.r);
      let F = 0, T = 0, Tr = 0;
      const on = cat && cat.on === lg;
      if (on){ const t = logTop(lg, cat.x, cat.z); const m = 4, gF = m * 9.81; F = -gF; T = -gF * (t.s ?? 0); Tr = gF * (t.l ?? 0); }
      if (on && prevLoad !== lg) addRipple(lg.x, lg.z, .05);
      const k = 1400, c = 90, I = lg.mass * lg.L * lg.L / 12, kp = 240, cp = 30, kr = 160, cr = 9;   // tuned so 4 kg at the tip tilts ~8°
      const target = (hA + hB) / 2 - lg.r * .45;
      const wp = Math.atan2(hA - hB, half * 2), wr = Math.atan2(hL - hR, lg.r * 2);
      // implicit-Euler spring-dampers (stable at any dt): heave, pitch (toward the load), roll
      const spring = (x, v, x0, kk, cc, m, f) => { v = (v + dt * (kk * (x0 - x) + f) / m) / (1 + dt * cc / m + dt * dt * kk / m); return [x + v * dt, v]; };
      [lg.heave, lg.vh] = spring(lg.heave, lg.vh, target, k, c, lg.mass, F);
      [lg.pitch, lg.vp] = spring(lg.pitch, lg.vp, wp, kp, cp, I, T);
      [lg.roll, lg.vr] = spring(lg.roll, lg.vr, wr, kr, cr, lg.mass * lg.r * lg.r * 2, Tr);
      lg.roll = Math.max(-.6, Math.min(.6, lg.roll));
      if (!on){ lg.x += ((lg.x0 + Math.sin(clock * .05 + lg.yaw) * .4) - lg.x) * dt * .1; lg.z += ((lg.z0 + Math.cos(clock * .04 + lg.yaw) * .4) - lg.z) * dt * .1; }
      if (Math.abs(lg.vp) > .25 && Math.random() < dt * 3) addRipple(lg.x + ax * half * Math.sign(lg.pitch) * -1, lg.z + az * half * Math.sign(lg.pitch) * -1, .02);
      toWorld(lg.x, lg.z, lg.heave, lg.m.position); frame(lg.x, lg.z, lg.yaw, qa);
      qb.setFromEuler(new THREE.Euler(-lg.pitch, 0, lg.roll, 'YXZ')); lg.m.quaternion.copy(qa).multiply(qb); addShadow(lg.x, lg.z, lg.yaw, lg.r * 4.2, lg.L * 1.15, .08, lg.sh); }
    prevLoad = cat ? cat.on : null;
    // ducks: group cohesion, keep to deep water, shy of the cat
    for (const dk of ducks){
      const mates = ducks.filter(o => o.gid === dk.gid); let cx = 0, cz = 0; for (const o of mates){ cx += o.x; cz += o.z; } cx /= mates.length; cz /= mates.length;
      let tx = Math.sin(dk.groupHead), tz = Math.cos(dk.groupHead);
      tx += (cx - dk.x) * .35; tz += (cz - dk.z) * .35;
      for (const o of mates) if (o !== dk){ const dd = Math.hypot(o.x - dk.x, o.z - dk.z); if (dd < (dk.sep || 1.2)){ tx -= (o.x - dk.x) / dd; tz -= (o.z - dk.z) / dd; } }
      const ahead = POND.water - terrainH(dk.x + Math.sin(dk.yaw) * 1.5, dk.z + Math.cos(dk.yaw) * 1.5);
      if (ahead < .45){ tx -= dk.x * .3; tz -= dk.z * .3; }
      let flee = 0;
      if (cat){ const dd = Math.hypot(cat.x - dk.x, cat.z - dk.z); if (dd < 6.5){ tx -= (cat.x - dk.x) / dd * 2.4; tz -= (cat.z - dk.z) / dd * 2.4; flee = 1; } }
      for (const lg of logs){ const dd = Math.hypot(lg.x - dk.x, lg.z - dk.z); if (dd < lg.L * .7){ tx -= (lg.x - dk.x) / dd; tz -= (lg.z - dk.z) / dd; } }
      const want = Math.atan2(tx, tz); let dy = want - dk.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
      dk.yaw += dy * Math.min(1, dt * 1.6);
      dk.groupHead += (vnoise(clock * .05, dk.gid) - .5) * dt * .8;
      const sp = (.18 + .08 * Math.sin(clock * .7 + dk.phase)) * (1 + flee * 1.6);
      dk.x += Math.sin(dk.yaw) * sp * dt; dk.z += Math.cos(dk.yaw) * sp * dt;
      if (dk.sep) for (const o of mates) if (o !== dk){ const ex = dk.x - o.x, ez = dk.z - o.z, dd = Math.hypot(ex, ez) || 1e-3; if (dd < dk.sep){ const p = (dk.sep - dd) * .5 / dd; dk.x += ex * p; dk.z += ez * p; o.x -= ex * p; o.z -= ez * p; } } // life r2: min spacing (dk.sep set by game/animals/ducks.js)
      if (Math.random() < dt * .05) dk.dip = 1;                                            // occasional head dip
      dk.dip = Math.max(0, dk.dip - dt * .7);
      const w = waterLevel(dk.x, dk.z);
      toWorld(dk.x, dk.z, w - .06, dk.m.position); addShadow(dk.x, dk.z, dk.yaw, .8, 1.45, .08, dk.sh); frame(dk.x, dk.z, dk.yaw, dk.m.quaternion);
      const bob = Math.sin(clock * 2.1 + dk.phase) * .05; dk.m.rotateX(bob);
      const neck = dk.m.userData.neck, dip = Math.sin(dk.dip * Math.PI);
      neck.rotation.x = dip * 1.6; neck.position.z = .14 + dip * .06;
      if (dip > .9 && Math.random() < dt * 4) addRipple(dk.x + Math.sin(dk.yaw) * .25, dk.z + Math.cos(dk.yaw) * .25, .012);
      if (Math.random() < dt * .12) addRipple(dk.x, dk.z, .008); }
  }

  return { group, update, sample, waterLevel, terrainH, pondSD, toWorld, toLocal, frame, addRipple, logs, stones, ducks, sunDir, E, N, Cn,
    get time(){ return clock; } };
}
