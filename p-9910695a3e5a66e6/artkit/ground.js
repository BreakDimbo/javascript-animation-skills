// 褶星 Fold art kit — hand-painted planet ground.
// One painted "board" canvas lives in a gnomonic tangent frame (u,v metres) centred on the home meadow; a shader projects
// every ground fragment's direction into that frame (no UV seams, no pole pinch — the far side simply reads as blank paper).
// Fine pencil grain / clover / flowers come from tileable detail tiles sampled triplanar in world metres, masked by the board.
// Techniques ported 1:1 from the sheep-grazing replica's paintGround(): blurred field polys, pigment pooling, broad brush
// streaks, hedge shadow/mid/core dab bands, three-stroke paths, block-dissolve paper bleed.
import { MF, MF_GLSL } from './minifields.js';
import * as THREE from '../shared/vendor/three.module.js';
import { PAL, rgb, rgba } from './palette.js';
import { BOARDU } from './bend.js';

export function mulberry(seed){ let a = seed >>> 0; return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

// ---------- frame ----------
export function makeFrame(C, E1, R){ C = C.clone().normalize(); E1 = E1.clone().sub(C.clone().multiplyScalar(E1.dot(C))).normalize(); const E2 = new THREE.Vector3().crossVectors(C, E1);
  return { C, E1, E2, R,
    toUV(p){ const k = p.dot(C); return [R * p.dot(E1) / k, R * p.dot(E2) / k]; },
    dirOf(u, v, out = new THREE.Vector3()){ return out.copy(C).multiplyScalar(R).addScaledVector(E1, u).addScaledVector(E2, v).normalize(); } };
}

// ---------- painter ----------
// spec: { frame, U0,U1,V0,V1, W (px), seed, keep:[{u,v,r}] (no hedges/trees), wheat(u,v)->bool, paths:[[[u,v],...]],
//         stamp(u,v)-> null | {rgb:[..], a, grass, flower, wheat}  (per-pixel overrides: pond bank, mill hill...) , stampBoxes:[[u0,v0,u1,v1]] }
export function paintBoard(spec){
  const { U0, U1, V0, V1, W } = spec, S = W / (U1 - U0), H = Math.round((V1 - V0) * S);
  const rnd = mulberry(spec.seed ?? 7); const _t0 = performance.now(); const tick = (k) => spec.onStep && spec.onStep(k, performance.now() - _t0);
  const X = u => (u - U0) * S, Y = v => (V1 - v) * S;
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H; const g = cv.getContext('2d');
  // mask: R grass, G flowers, B wheat (low res, smooth)
  const MW = W / 4, MH = H / 4; const mc = document.createElement('canvas'); mc.width = MW; mc.height = MH; const mg = mc.getContext('2d');
  const mX = u => X(u) / 4, mY = v => Y(v) / 4;

  // 1. fields: jittered lattice of quads, cells merged in pairs, each its own palette green
  const CELL = spec.cell ?? 30, nu = Math.ceil((U1 - U0) / CELL) + 2, nv = Math.ceil((V1 - V0) / CELL) + 2;
  const P = []; for (let j = 0; j <= nv; j++){ P[j] = []; for (let i = 0; i <= nu; i++) P[j][i] = [U0 - CELL + i * CELL + (rnd() - .5) * CELL * .55, V0 - CELL + j * CELL + (rnd() - .5) * CELL * .55]; }
  const greens = [PAL.light, PAL.bright, PAL.dark, PAL.lime, PAL.light, PAL.bright, PAL.lime];
  g.fillStyle = PAL.lime; g.fillRect(0, 0, W, H);
  mg.fillStyle = 'rgb(255,90,0)'; mg.fillRect(0, 0, MW, MH);
  const fields = [];
  g.save(); g.filter = `blur(${(1.2 * S).toFixed(1)}px)`;
  for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++){
    const q = [P[j][i], P[j][i + 1], P[j + 1][i + 1], P[j + 1][i]], cu = (q[0][0] + q[2][0]) / 2, cvv = (q[0][1] + q[2][1]) / 2;
    const isWheat = spec.wheat && spec.wheat(cu, cvv, 'field');
    const col = isWheat ? PAL.wheat : greens[(rnd() * greens.length) | 0];
    fields.push({ q, cu, cv: cvv, col, isWheat });
    g.fillStyle = col; g.beginPath(); q.forEach(([u, v], k) => k ? g.lineTo(X(u), Y(v)) : g.moveTo(X(u), Y(v))); g.closePath(); g.fill();
    if (isWheat){ mg.fillStyle = 'rgb(60,10,255)'; mg.beginPath(); q.forEach(([u, v], k) => k ? mg.lineTo(mX(u), mY(v)) : mg.moveTo(mX(u), mY(v))); mg.closePath(); mg.fill(); }
  }
  g.restore();
  tick(1);
  // 2. pigment pooling (dark pools + pale blooms), scaled from the replica's 260 per board
  const area = (U1 - U0) * (V1 - V0), pools = Math.round(area / 90);
  for (let k = 0; k < pools; k++){
    const x = rnd() * W, y = rnd() * H, r = (3 + rnd() * 9) * S, dark = rnd() < .55;
    const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, dark ? 'rgba(70,110,30,.06)' : 'rgba(225,240,160,.07)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr; g.fillRect(x - r, y - r, 2 * r, 2 * r);
  }
  tick(2);
  // 3. wheat stroke ticks (macro), field-wise
  for (const f of fields) if (f.isWheat){
    for (let k = 0; k < 220; k++){ const a = rnd(), b = rnd(); const u = f.q[0][0] * (1 - a) * (1 - b) + f.q[1][0] * a * (1 - b) + f.q[2][0] * a * b + f.q[3][0] * (1 - a) * b;
      const v = f.q[0][1] * (1 - a) * (1 - b) + f.q[1][1] * a * (1 - b) + f.q[2][1] * a * b + f.q[3][1] * (1 - a) * b;
      g.strokeStyle = rnd() < .5 ? 'rgba(160,130,50,.18)' : 'rgba(245,225,140,.22)'; g.lineWidth = .25 * S; g.beginPath(); g.moveTo(X(u), Y(v)); g.lineTo(X(u) + .9 * S, Y(v) - .25 * S); g.stroke(); }
  }
  tick(3);
  // 4. broad brush streaks along one hand direction (replica: angle −0.35, alpha .07, blurred)
  g.save(); g.filter = `blur(${(.6 * S).toFixed(1)}px)`;
  const streaks = Math.round(area / 110);
  for (let k = 0; k < streaks; k++){
    const x = rnd() * W, y = rnd() * H, L = (12 + rnd() * 22) * S, w = (1.4 + rnd() * 2.2) * S, an = -0.35 + (rnd() - .5) * .25;
    g.strokeStyle = rnd() < .5 ? 'rgba(60,110,28,.07)' : 'rgba(215,238,150,.08)'; g.lineWidth = w; g.lineCap = 'round';
    g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + Math.cos(an) * L * .5, y + Math.sin(an) * L * .5 + (rnd() - .5) * w * 2, x + Math.cos(an) * L, y + Math.sin(an) * L); g.stroke();
  }
  g.restore();

  tick(4);
  // 5. per-pixel stamps (pond bank, mill hill wheat sector...) in their bounding boxes
  if (spec.stamp) for (const [bu0, bv0, bu1, bv1] of spec.stampBoxes || []){
    const x0 = Math.max(0, Math.floor(X(bu0))), x1 = Math.min(W, Math.ceil(X(bu1))), y0 = Math.max(0, Math.floor(Y(bv1))), y1 = Math.min(H, Math.ceil(Y(bv0)));
    if (x1 <= x0 || y1 <= y0) continue;
    const id = g.getImageData(x0, y0, x1 - x0, y1 - y0), d = id.data;
    const mx0 = Math.floor(x0 / 4), my0 = Math.floor(y0 / 4), mw = Math.ceil(x1 / 4) - mx0, mh = Math.ceil(y1 / 4) - my0; const md = mg.getImageData(mx0, my0, mw, mh);
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++){
      const u = U0 + (x + .5) / S, v = V1 - (y + .5) / S, s = spec.stamp(u, v);
      if (!s){ if (((x & 3) | (y & 3)) === 0){ const mo = ((Math.floor(y / 4) - my0) * mw + (Math.floor(x / 4) - mx0)) * 4; md.data[mo] = 255; } continue; } /* ground-r4: no stamp here = plain meadow; drop the old board's hedge lines from the grass mask inside the box */
      const o = ((y - y0) * (x1 - x0) + (x - x0)) * 4, a = s.a ?? 1;
      d[o] += (s.rgb[0] - d[o]) * a; d[o + 1] += (s.rgb[1] - d[o + 1]) * a; d[o + 2] += (s.rgb[2] - d[o + 2]) * a;
      if (((x & 3) | (y & 3)) === 0){ const mo = ((Math.floor(y / 4) - my0) * mw + (Math.floor(x / 4) - mx0)) * 4;
        if (s.grass !== undefined) md.data[mo] += (s.grass * 255 - md.data[mo]) * a; if (s.flower !== undefined) md.data[mo + 1] += (s.flower * 255 - md.data[mo + 1]) * a; if (s.wheat !== undefined) md.data[mo + 2] += (s.wheat * 255 - md.data[mo + 2]) * a; }
    }
    g.putImageData(id, x0, y0); mg.putImageData(md, mx0, my0);
  }

  tick(5);
  // 6. flower drifts in the mask (painted flowers are in the detail tile, density here)
  mg.save(); mg.filter = 'blur(6px)';
  for (let k = 0; k < area / 260; k++){ const x = rnd() * MW, y = rnd() * MH, r = (4 + rnd() * 10) * S / 4; mg.fillStyle = `rgba(0,255,0,${(.25 + rnd() * .5).toFixed(2)})`; mg.globalCompositeOperation = 'lighter'; mg.beginPath(); mg.ellipse(x, y, r * 1.6, r, -.35, 0, 7); mg.fill(); }
  mg.restore(); mg.globalCompositeOperation = 'source-over';

  tick(6);
  // 7. paths: three strokes (wide warm edge, path, pale centre)
  const keep = spec.keep || [];
  const nearKeep = (u, v, pad = 0) => keep.some(k => Math.hypot(u - k.u, v - k.v) < k.r + pad);
  for (const pth of spec.paths || []){
    const line = (w, col, ctx = g, sx = X, sy = Y, sc = 1) => { ctx.strokeStyle = col; ctx.lineWidth = w * S / sc; ctx.lineCap = ctx.lineJoin = 'round'; ctx.beginPath(); pth.forEach(([u, v], k) => k ? ctx.lineTo(sx(u), sy(v)) : ctx.moveTo(sx(u), sy(v))); ctx.stroke(); };
    g.save(); g.filter = `blur(${(.25 * S).toFixed(1)}px)`; line(2.1, 'rgba(200,180,120,.6)'); line(1.5, PAL.path); line(.6, 'rgba(240,222,176,.55)'); g.restore();
    line(2.0, 'rgb(0,0,0)', mg, mX, mY, 4);
  }

  tick(7);
  // 8. hedges: along a subset of lattice edges, away from kept clearings and paths
  const hedges = [];
  const onPath = (u, v) => (spec.paths || []).some(p => p.some(([a, b]) => Math.hypot(a - u, b - v) < 4));
  for (let j = 1; j < nv; j++) for (let i = 1; i < nu; i++){
    for (const [a, b] of [[P[j][i], P[j][i + 1]], [P[j][i], P[j + 1][i]]]){
      if (rnd() > (spec.hedgeP ?? .55)) continue;
      const pts = []; const n = Math.max(4, Math.round(Math.hypot(b[0] - a[0], b[1] - a[1]) / 1.2));
      const bend = (rnd() - .5) * 4;
      for (let k = 0; k <= n; k++){ const t = k / n, s = Math.sin(t * Math.PI) * bend; const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy);
        const u = a[0] + dx * t - dy / L * s, v = a[1] + dy * t + dx / L * s; if (nearKeep(u, v) || onPath(u, v) || u < U0 + 8 || u > U1 - 8 || v < V0 + 8 || v > V1 - 8){ if (pts.length > 2) hedges.push(pts.splice(0)); else pts.length = 0; continue; } pts.push([u, v]); }
      if (pts.length > 2) hedges.push(pts);
    }
  }
  for (const h of spec.extraHedges || []) hedges.push(h);
  const strokeH = (pts, w, col, dx = 0, dy = 0) => { g.strokeStyle = col; g.lineWidth = w * S; g.lineCap = g.lineJoin = 'round'; g.beginPath(); pts.forEach(([u, v], k) => k ? g.lineTo(X(u) + dx, Y(v) + dy) : g.moveTo(X(u) + dx, Y(v) + dy)); g.stroke(); };
  g.save(); g.filter = `blur(${(.9 * S).toFixed(1)}px)`; for (const h of hedges) strokeH(h, 3.2, 'rgba(40,85,25,.16)', .9 * S, .4 * S); g.restore();
  g.save(); g.filter = `blur(${(.3 * S).toFixed(1)}px)`; for (const h of hedges) strokeH(h, 2.2, 'rgba(52,100,30,.30)'); g.restore();
  for (const h of hedges) for (const [u, v] of h){ for (let k = 0; k < 2; k++){ g.fillStyle = rnd() < .5 ? 'rgba(35,80,20,.25)' : 'rgba(95,150,55,.2)'; g.beginPath(); g.arc(X(u + (rnd() - .5) * 2), Y(v + (rnd() - .5) * 2), (.3 + rnd() * .4) * S, 0, 7); g.fill(); } }
  for (const h of hedges){ mg.strokeStyle = 'rgb(0,0,0)'; mg.lineWidth = 1.5 * S / 4; mg.beginPath(); h.forEach(([u, v], k) => k ? mg.lineTo(mX(u), mY(v)) : mg.moveTo(mX(u), mY(v))); mg.stroke(); }

  tick(8);
  // 9. trees: clay sprites on some hedge vertices
  const trees = [];
  for (const h of hedges) for (let k = 1; k < h.length - 1; k += 3) if (rnd() < (spec.treeP ?? .12)) trees.push({ u: h[k][0] + (rnd() - .5) * .6, v: h[k][1] + (rnd() - .5) * .6, s: .8 + rnd() * .6, cell: (rnd() * 64) | 0 });

  tick(9);
  // 10. paper bleed at the board edge: block dissolve (replica: 2–3 px blocks, probability ramp, paper underneath)
  const id = g.getImageData(0, 0, W, H), d = id.data, [pr, pg, pb] = [228, 221, 208], band = (spec.bleed ?? 14) * S, B = 3;
  const bn = mulberry(99);
  for (let by = 0; by < H; by += B) for (let bx = 0; bx < W; bx += B){
    const e = Math.min(bx, by, W - bx - B, H - by - B); if (e > band) continue;
    const wob = Math.sin(bx * .013) * .18 + Math.sin(by * .017 + 2) * .18;
    const p = 1 - e / band + wob; if (bn() > p * p) continue;
    for (let y = by; y < Math.min(H, by + B); y++) for (let x = bx; x < Math.min(W, bx + B); x++){ const o = (y * W + x) * 4; d[o] = pr; d[o + 1] = pg; d[o + 2] = pb; }
  }
  g.putImageData(id, 0, 0);
  mg.save(); mg.globalCompositeOperation = 'source-over'; const mb = band / 4; mg.strokeStyle = 'rgb(0,0,0)'; mg.lineWidth = mb * 1.3; mg.strokeRect(0, 0, MW, MH); mg.restore();

  tick(10);
  return { canvas: cv, mask: mc, hedges, trees, S, W, H, U0, U1, V0, V1, X, Y };
}

// ---------- detail tile (pencil grain, clover dabs, tufts, flower dots) ----------
// RGBA: R = grass tick value (128 neutral), G = flower alpha, B = flower hue selector, A = 255. Tileable, `m` metres across.
export function paintDetail(size = 1024, m = 3, seed = 3){
  const rnd = mulberry(seed), c = document.createElement('canvas'); c.width = c.height = size; const g = c.getContext('2d');
  const ppm = size / m; // px per metre
  const R = document.createElement('canvas'); R.width = R.height = size; const r = R.getContext('2d'); r.fillStyle = '#808080'; r.fillRect(0, 0, size, size);
  const wrap = (fn) => { for (const ox of [-size, 0, size]) for (const oy of [-size, 0, size]) fn(ox, oy); };
  // fine vertical-ish pencil ticks (replica: dark / light / darker, alpha .07–.17 ×1.8)
  const ticks = Math.round(m * m * 2600);
  for (let k = 0; k < ticks; k++){
    const x = rnd() * size, y = rnd() * size, L = (.012 + rnd() * .03) * ppm, a = (.07 + rnd() * .1) * 1.8, t = rnd(), an = -Math.PI / 2 + (rnd() - .5) * .7;
    const col = t < .5 ? `rgba(40,40,40,${a})` : t < .8 ? `rgba(230,230,230,${a})` : `rgba(10,10,10,${a})`;
    wrap((ox, oy) => { if (x + ox < -40 || x + ox > size + 40 || y + oy < -40 || y + oy > size + 40) return; r.strokeStyle = col; r.lineWidth = Math.max(1, .0035 * ppm); r.beginPath(); r.moveTo(x + ox, y + oy); r.lineTo(x + ox + Math.cos(an) * L, y + oy + Math.sin(an) * L); r.stroke(); });
  }
  // pale clover dabs + dark fanned tufts
  for (let k = 0; k < m * m * 40; k++){ const x = rnd() * size, y = rnd() * size, rr = (.01 + rnd() * .015) * ppm; wrap((ox, oy) => { r.fillStyle = 'rgba(235,235,235,.13)'; r.beginPath(); r.ellipse(x + ox, y + oy, rr * 1.4, rr, rnd(), 0, 7); r.fill(); }); }
  for (let k = 0; k < m * m * 26; k++){ const x = rnd() * size, y = rnd() * size; wrap((ox, oy) => { r.strokeStyle = 'rgba(20,20,20,.5)'; r.lineWidth = Math.max(1, .005 * ppm); for (let s = 0; s < 3; s++){ const an = -Math.PI / 2 + (s - 1) * .35; r.beginPath(); r.moveTo(x + ox, y + oy); r.lineTo(x + ox + Math.cos(an) * .05 * ppm, y + oy + Math.sin(an) * .05 * ppm); r.stroke(); } }); }
  const rd = r.getImageData(0, 0, size, size).data;
  // flower dots (alpha in G, hue in B)
  const F = document.createElement('canvas'); F.width = F.height = size; const f = F.getContext('2d'); f.fillStyle = '#000'; f.fillRect(0, 0, size, size);
  for (let k = 0; k < m * m * 9; k++){ const x = rnd() * size, y = rnd() * size, rr = (.007 + rnd() * .006) * ppm, hue = rnd(); const hb = hue < .55 ? 60 : hue < .8 ? 140 : 230;
    wrap((ox, oy) => { f.fillStyle = `rgb(255,255,${hb})`; f.beginPath(); f.arc(x + ox, y + oy, rr, 0, 7); f.fill(); }); }
  const fd = f.getImageData(0, 0, size, size).data;
  const out = g.createImageData(size, size), od = out.data;
  for (let i = 0; i < size * size; i++){ od[i * 4] = rd[i * 4]; od[i * 4 + 1] = fd[i * 4 + 1]; od[i * 4 + 2] = fd[i * 4 + 2]; od[i * 4 + 3] = 255; }
  g.putImageData(out, 0, 0);
  return c;
}

// ---------- material ----------
export function groundMaterial(board, frame, { detailM = 3, paperTex, lane = null, stampBoxes = [] } = {}){
  const tex = new THREE.CanvasTexture(board.canvas); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8; tex.generateMipmaps = true; tex.minFilter = THREE.LinearMipmapLinearFilter;
  const mask = new THREE.CanvasTexture(board.mask); mask.colorSpace = THREE.NoColorSpace;
  const det = new THREE.CanvasTexture(paintDetail(1024, detailM)); det.colorSpace = THREE.NoColorSpace; det.wrapS = det.wrapT = THREE.RepeatWrapping; det.anisotropy = 8;
  const pap = paperTex || new THREE.TextureLoader().load(new URL('./tex/paper.png', import.meta.url).href); pap.wrapS = pap.wrapT = THREE.RepeatWrapping;
  const m = new THREE.MeshLambertMaterial({ map: tex, fog: false });
  const lin = (h) => new THREE.Color(h);
  BOARDU.GC.value = frame.C; BOARDU.GE1.value = frame.E1; BOARDU.GE2.value = frame.E2; BOARDU.GR.value = frame.R;
  const u = { uC: { value: frame.C }, uE1: { value: frame.E1 }, uE2: { value: frame.E2 }, uR: { value: frame.R },
    uMin: { value: new THREE.Vector2(board.U0, board.V0) }, uMax: { value: new THREE.Vector2(board.U1, board.V1) },
    uMask: { value: mask }, uSB: { value: [0, 1].map(i => new THREE.Vector4(...(stampBoxes[i] || [1e5, 1e5, 1e5, 1e5]))) }, uDet: { value: det }, uDetM: { value: detailM }, uPap: { value: pap }, uPaper: { value: new THREE.Color(228 / 255, 221 / 255, 208 / 255).convertSRGBToLinear() },
    uFY: { value: lin(PAL.flowerY) }, uFO: { value: lin(PAL.flowerO) }, uFW: { value: lin(PAL.flowerW) },
    uSun: { value: new THREE.Vector3(0, 1, 0) }, uMini: { value: 1 }, uLane: { value: lane && lane.isTexture ? lane : null }, uHasLane: { value: lane ? 1 : 0 }, uLaneU: { value: new THREE.Vector2(...(lane && lane.laneU || [-1e4, 1e4])) }, uFade: { value: new THREE.Vector3(26, 38, 9) }, uTime: { value: 0 }, uWheatId: { value: new THREE.Vector3(1e5, 0, 0) }, uGraze: { value: Array.from({ length: 14 }, () => new THREE.Vector4(0, 0, 0, 0)) }, uCS: { value: [new THREE.Vector4(), new THREE.Vector4()] }, uCalm: { value: new THREE.Vector4(1e5, 1e5, 1e5, 1) }, uBank: { value: lin('#d8c48e') }, uWat: { value: ['#2f63b8', '#3f7fd0', '#6fa6e0', '#cfe2f4'].map(lin) }, uPaperS: { value: new THREE.Vector3(...[1, 3, 5].map(i => parseInt(PAL.paper.slice(i, i + 2), 16) / 255)) },
    uF: { value: [lin(PAL.light), lin(PAL.bright), lin(PAL.dark), lin(PAL.lime), lin(PAL.wheat)] },
    uHed: { value: [lin(PAL.hedgeShade), lin(PAL.hedge), lin(PAL.hedgeLit)] }, uPath: { value: lin(PAL.path) }, uPathE: { value: lin(PAL.pathEdge) } };
  m.userData.ground = u;
  m.onBeforeCompile = (s) => {
    Object.assign(s.uniforms, u);
    s.vertexShader = s.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vGW;')
      .replace('#include <project_vertex>', '#include <project_vertex>\nvGW = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    s.fragmentShader = s.fragmentShader.replace('#include <common>', `#include <common>
varying vec3 vGW; uniform vec3 uC, uE1, uE2, uPaper, uFY, uFO, uFW, uSun, uF[5], uHed[3], uPath, uPathE; uniform float uMini, uHasLane, uTime; uniform vec3 uWheatId; uniform vec4 uGraze[14]; uniform vec4 uCS[2]; uniform vec4 uCalm; uniform vec3 uBank, uWat[4]; uniform vec3 uFade, uPaperS; uniform sampler2D uLane; uniform vec2 uLaneU;
// analytic path/river distances (crisp at any zoom; mirrors world.js lanePath / meadowPath / riverPath)
float fpLane(float u){ return 1.8 * sin(u * .045) + .7 * sin(u * .13 + 1.0) + (-15.0 - 1.8 * sin(u * .045)) * (1.0 - smoothstep(14.0, 40.0, abs(u))) + .25 * sin(u * .5); }
float fpMead(float v){ return 1.25 - .22 * clamp(v + 3.5, -12.0, 6.0) + .3 * sin(v * .42 + 1.0) + .1 * sin(v * 1.3); } /* r5: one diagonal main path like FINAL17 */
float fpRiv(float v){ return -1.85 + .45 * sin(v * .37) + .18 * sin(v * 1.1 + 2.0) + .05 * sin(v * 3.3); }
vec2 foldPaths(vec2 g){
  float u = g.x, v = g.y, e = .02;
  float uc = clamp(u, uLaneU.x, uLaneU.y), fl = fpLane(uc), dl = (fpLane(uc + e) - fpLane(uc - e)) / (2.0 * e);
  float a = length(vec2((u - uc), (v - fl) / sqrt(1.0 + dl * dl)));
  float vc = clamp(v, -15.5, 40.0), fm = fpMead(vc), dm = (fpMead(vc + e) - fpMead(vc - e)) / (2.0 * e);
  a = min(a, length(vec2((u - fm) / sqrt(1.0 + dm * dm), v - vc)));
  float vr = clamp(v, -40.0, 45.0), fr = fpRiv(vr), dr = (fpRiv(vr + e) - fpRiv(vr - e)) / (2.0 * e);
  float b = length(vec2((u - fr) / sqrt(1.0 + dr * dr), v - vr));
  return vec2(a, b);
}
${MF_GLSL}float mfV3(vec3 p){ vec3 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f);
  return mix(mix(mix(mfHash(i).x, mfHash(i + vec3(1,0,0)).x, f.x), mix(mfHash(i + vec3(0,1,0)).x, mfHash(i + vec3(1,1,0)).x, f.x), f.y),
             mix(mix(mfHash(i + vec3(0,0,1)).x, mfHash(i + vec3(1,0,1)).x, f.x), mix(mfHash(i + vec3(0,1,1)).x, mfHash(i + vec3(1,1,1)).x, f.x), f.y), f.z); }
/* w2 r2: one field's flat wash (FINAL17 greens; wheat = light warm straw ≈ #cdb750 → #e2c68d); wh = 1 for wheat */
vec3 mfFieldCol(vec3 id, out float wh){ vec3 ch = mfHash(id + 3.1);
  vec3 fc = ch.x < .34 ? uF[0] : ch.x < .74 ? uF[1] : mix(uF[2], uF[1], .35);
  wh = ((ch.y < .13 && mfThick(id) > .5) || length(id - uWheatId) < .01) ? 1. : 0.; /* ground-r4: no sliver wheat cells (only their dark rim showed, as a dash) */ /* r5: plus the wheat corner field of the home frame */
  fc = mix(fc, uF[4] * vec3(1.63, 1.545, 1.60), wh);
  return fc * vec3(.985, 1.025, .99) * (1.012 + .08 * ch.z); } /* d13: +6 %, a touch greener, so the darker r4 hedge outlines + blob shadows keep the FINAL17 mean (bdE) */
vec3 miniPaint(vec3 P, vec3 dir, vec4 d, float gm){
  vec3 id1, id2, nE, id3a, id3b; float dE, tn, d3; mfEdge(P, dir, id1, id2, dE, nE, tn, id3a, id3b, d3);
  vec3 ch = mfHash(id1 + 3.1); float ad = abs(dE);
  /* w2 r2: tonal steps are soft: within ~9 cm of an edge both fields fade to their mean, so no hard straight colour step crosses a boundary */
  float wh1, wh2; vec3 fc1 = mfFieldCol(id1, wh1), fc2 = mfFieldCol(id2, wh2);
  /* r3: soft Voronoi blend of the field colours (continuous at every edge AND vertex; the old nearest-edge blend left straight wedge steps at junctions); ~0.2 m gradient, per-cell noisy edge */
  vec3 fc; float wh, whS; { vec3 q = (P + mfWarp(P)) / ${MF.cell.toFixed(3)} * vec3(${MF.sx.toFixed(3)}, 1., 1.), b0 = floor(q); float dmin = 1e9, dmin0 = 1e9; vec3 sd[27]; vec3 cid[27]; int n = 0;
    for (int k = -1; k <= 1; k++) for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++){ vec3 c = b0 + vec3(i, j, k); vec3 sv = c + mfHash(c + 17.); sd[n] = sv; cid[n] = c; n++; dmin0 = min(dmin0, length(sv - q)); dmin = min(dmin, length(sv - q) + (mfV3(P * 1.25 + mfHash(c) * 40.) - .5) * .08); }
    vec3 acc = vec3(0.); float wa = 0., wha = 0., wa0 = 0., wh0a = 0.; n = 0;
    for (int k = -1; k <= 1; k++) for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++){ vec3 c = cid[n]; float dd = length(sd[n] - q) + (mfV3(P * 1.25 + mfHash(c) * 40.) - .5) * .08; float w = exp(-(dd - dmin) * 26.); float whc; vec3 fcc = mfFieldCol(c, whc); acc += fcc * w; wha += whc * w; wa += w; float w0 = exp(-(length(sd[n] - q) - dmin0) * 26.); wh0a += whc * w0; wa0 += w0; n++; }
    fc = acc / wa; wh = wha / wa; whS = wh0a / wa0; }
  /* d15 (vd r4.1 #2): round a region's own lawn (the pond) the green fields share one mean wash: no hedge is drawn there, so a field-to-field
     value step read as a vertical light band beside the cat. Fades back to the patchwork over the outer 40 % of uCalm.w */
  { float cm = 1. - smoothstep(uCalm.w * .6, uCalm.w, length(P - uCalm.xyz)); vec3 FM = (uF[0] * .34 + uF[1] * .40 + mix(uF[2], uF[1], .35) * .26) * vec3(.985, 1.025, .99) * 1.052;
    fc = mix(fc, mix(FM, fc, wh), cm * .9); } /* d15 (vd r4.1 #1): the rim line and the field colours share ONE weight field (wh); its border noise is low-frequency (≈ 0.8 m) so the line meanders instead of zig-zagging */
  vec2 gq = vec2(dot(dir, uE1), dot(dir, uE2)) * 600. / max(dot(dir, uC), 1e-3); /* board metres: ticks are screen-vertical, streaks have a per-field diagonal */
  float th = -.62 + (ch.z - .5) * 1.5; vec3 ax = normalize(uE1 * cos(th) + uE2 * sin(th)); ax = normalize(ax - dir * dot(ax, dir)); vec3 ay = cross(dir, ax);
  float al = dot(P, ax), ac = dot(P, ay);
  float st = mfV3(vec3(al * .55, ac * 6., ch.z * 50.)) * .6 + mfV3(vec3(al * 1.6, ac * 17., 7.)) * .4; /* long soft diagonal brush streaks, ±5 % */
  fc *= 1. + ((smoothstep(.28, .72, st) - .5) * (.08 + .04 * wh) + (st - .5) * .04) * smoothstep(.04, .32, d3); /* r3: streaks vanish near cell vertices (no converging rays) */
  fc *= 1. - wh * (.05 * smoothstep(.5, .8, mfV3(vec3(al * 1.6, ac * 22., 4.))) + .05 * smoothstep(.45, .75, mfV3(vec3(al * 2.5, ac * 60., 9.))) * smoothstep(.04, .3, d3)); /* r3: fine parallel straw strokes */ // faint ochre strokes along the wheat rows
  // wind: slow brighter gusts combing across the grass (no sparkle; a value shift only)
  fc *= 1. + .055 * smoothstep(.45, .85, mfV3(vec3(al * .35 - uTime * .5, ac * .5, uTime * .07))) * (1. + .4 * wh);
  // cloud shadows drifting over the board
  fc *= 1. - .13 * smoothstep(.56, .74, mfV3(P * .09 + vec3(uTime * .06, uTime * .02, -uTime * .04)));
  /* r9 review #3: big cloud shadows are applied in board (u,v) space after the board/patchwork blend, see below */
  // grazed patches where the flock has been: shorter, paler, yellower turf
  { float gz = 0.; for (int i = 0; i < 14; i++){ float dd = length(P - uGraze[i].xyz); gz = max(gz, smoothstep(.75, .15, dd + (mfV3(P * 2.2 + float(i)) - .5) * .45) * uGraze[i].w); }
    fc = mix(fc, fc * vec3(1.1, 1.06, .78), gz * .45 * (1. - wh)); }
  fc *= 1. + (mfV3(P * .45) - .5) * .2 + (mfV3(P * 1.7 + 3.) - .5) * .08;
  fc *= 1. + (d.r - .5) * 2. * .07; /* w2 r2: the triplanar pencil-grain tile was the "fur": a smooth wash now */
  float tf = smoothstep(.034, .02, length(fwidth(gq))); /* ticks/specks fade out once they would be sub-pixel (zoom-out) */
  { /* r3: FINAL17 pencil ticks: thin (~1 px), short (3-5 px), dense, low contrast, angle wobbling around screen-vertical; board metres so they never crawl */
    vec2 tc = gq / vec2(.032, .05), ti = floor(tc); vec3 h = mfHash(vec3(ti, 41.)); vec2 o = (fract(tc) - .5 - (h.xy - .5) * .6) * vec2(.032, .05);
    float an = (h.x - .5) * .9; vec2 ou = vec2(o.x * cos(an) - o.y * sin(an), o.x * sin(an) + o.y * cos(an));
    float dash = step(h.z, .75) * smoothstep(1., .55, length(ou / vec2(.0075, .02)));
    vec2 sc = gq / .06, si = floor(sc); vec3 h2 = mfHash(vec3(si, 43.)); vec2 o2 = (fract(sc) - .5 - (h2.xy - .5) * .5) * .06;
    float spk = step(h2.z, .2) * smoothstep(1., .5, length(o2 / vec2(.005, .006)));
    fc *= 1. - .14 * tf * dash * (1. - .25 * wh);
    fc *= 1. + .06 * tf * spk; }
  fc *= vec3(1.155, 1.185, 1.31); /* r9 #3: db -> ~+1 */ /* r8 #3: less yellow (db +3 -> ~0) */ /* r6: warm yellow-green grade toward FINAL17 (grass bdE check: grass_bde.py) */
  vec3 col = fc;
  /* w2 BUG FIX: the old F1|F2 bisector distance was a 3D plane distance that jumped at F2 swaps and smeared where the plane grazes the ground (leaf / crescent / notch blobs); see mfEdge */
  float eh = mfEdgeHash(id1, id2);
  vec3 sunT = uSun - dir * dot(uSun, dir); sunT = length(sunT) > 1e-3 ? normalize(sunT) : vec3(0.);
  float sg = dot(id2 - id1, vec3(1., 7., 49.)) > 0. ? 1. : -1.; vec3 nC = nE * sg; float dS = dE * sg; // orient each edge the same way from both sides, so offsets stay continuous
  vec3 tE = cross(dir, nC); float ae = dot(P, tE);
  float pth = step(${MF.hedgeP.toFixed(3)}, eh) * step(eh, ${(MF.hedgeP + MF.pathP).toFixed(3)});
  float pw = .04 + .012 * mfV3(vec3(ae * 1.3, 3., 1.));
  col = mix(col, uPathE, smoothstep(pw + .03, pw + .004, ad) * pth * .8);
  col = mix(col, uPath * (1. + (d.r - .5) * .25), smoothstep(pw, pw - .025, ad) * pth);
  /* r8 #4: away from the home board hedges thin out, so the far fields merge into larger, more varied parcels (zoomout read) */
  float hFar = smoothstep(8., 26., length(P - uGraze[0].xyz)); float hB = ${MF.hedgeP.toFixed(3)} * mix(.88, .42, hFar);
  /* w2: two boundary kinds like FINAL17: (a) a few bold, soft, width-varying dark hedge rows with a sunlit top edge, (b) plain tonal steps with only a soft shade on the side away from the sun.
     FINAL17's wheat fields are always rimmed by a dark hedge. */
  float wE = max(wh1, wh2) * (1. - min(wh1, wh2));
  float isH = mfHedge(id1, id2), isT = (1. - isH) * step(eh, hB);
  /* w2 r2: hedge ends taper. At a junction the nearest edge switches (straight cut along the bisector = the "square step");
     every boundary therefore fades out as the second-nearest edge (d3) approaches, unless that edge is the same kind (they join) */
  float eh3 = mfEdgeHash(id3a, id3b), w3a, w3b; mfFieldCol(id3a, w3a); mfFieldCol(id3b, w3b); float wE3 = max(w3a, w3b) * (1. - min(w3a, w3b));
  /* ground-r4: the third edge at the junction (the one between the far cell and the cell NOT in the second-nearest pair). Seen from one side the second-nearest edge is a non-hedge boundary and
     the hedge tapered away while the other side kept it = broken, stepped pieces. A hedge now continues if EITHER other edge at the vertex is a hedge. */
  float isH3o = 0.; { bool kn = (id3a == id1 || id3a == id2); vec3 kk = kn ? id3b : id3a, known = kn ? id3a : id3b, oth = (known == id1) ? id2 : id1; float wk, wo; mfFieldCol(kk, wk); mfFieldCol(oth, wo);
    isH3o = max(mfHedge(oth, kk), max(wk, wo) * (1. - min(wk, wo))); }
  float isH3 = max(max(mfHedge(id3a, id3b), wE3), isH3o), isT3 = (1. - isH3) * step(eh3, hB);
  float tap = smoothstep(.0, .3, d3 - ad); /* d15 (vd r4.1 #3): away from home, ~45 % of hedge edges open a field gate (≈ 0.9–1.6 m) about 2.3 m from a corner */ /* exactly 0 on the medial axis between two edges */
  float vw = smoothstep(.12, .35, tn) * smoothstep(.35, .9, gm), /* r3: banks / pond rims only NARROW the hedge (crisp core, no blur / ghost bands); none at all right beside a bank */ vis = smoothstep(.0, .12, vw), hed = isH * vis * mix(tap, 1., isH3) * (1. - (1. - smoothstep(.0, .35, abs(d3 - 2.3) - .45)) * step(.55, mfEdgeHash(id1, id2)) * smoothstep(6., 9., length(P - vec3(.3, -3., 600.)))), tonal = isT * vis * mix(tap, 1., max(isT3, isH3));
  float wob = (mfV3(P * .8 + vec3(4., 0., 2.)) - .5) * .14 + (mfV3(P * 5. + vec3(1., 3., 7.)) - .5) * .02; /* ground-r4: world-position noise, not edge-tangent: continuous where the nearest edge switches (no kinked steps) */
  float dh = dS - wob, adh = abs(dh);
  float away = dot(-sunT, nC) * sign(dS); float shc = dh * sign(away + 1e-4);
  float sh = exp(-pow((shc - .07) / .1, 2.)) * hed * mix(1., tap, isH3 * .0 + 1.) * vw * vw; /* r2: shade bands always taper toward the medial axis (they sit on one side only, so a join would cut them) */
  col *= 1. - .30 * sh;
  col *= 1. - .13 * exp(-pow((shc - .045) / .055, 2.)) * smoothstep(0., .25, abs(away) + .12) * tonal * tap * (.7 + .6 * mfV3(vec3(ae * .5, 3., 8.)));
  float hw = (.03 + .05 * mfV3(P * .35 + vec3(9., 2., 1.)) + .014 * mfV3(P * 2.2 + vec3(1., 6., 5.))) * mix(.15, 1., hed / max(isH, 1e-3)) * mix(.3, 1., vw);
  float core = smoothstep(hw, hw * .3, adh) * smoothstep(.0, .7, hed);
  float lit = clamp(.28 - dot(nC, sunT) * sign(dh) * .3 + (mfV3(vec3(ae * 10., dh * 24., 1.)) - .5) * .25 + .35 * smoothstep(hw * .35, hw, -dh * sign(away + 1e-4)), 0., 1.);
  vec3 hc = mix(vec3(.04, .15, .015), vec3(.10, .29, .04), lit); // linear: dark core ≈ #3f7a2a (FINAL17) → sunlit edge
  col = mix(col, hc, core);
  /* d13: the wheat rim follows the 0.5 iso-line of the soft Voronoi wheat weight (continuous at every vertex, sliver cells included) instead of the nearest edge,
     which jumped where a thin sliver cell sits between the wheat and its neighbour (stepped hedge at ?at=90,-1) */
  { float pxm = .5 * (length(dFdx(P)) + length(dFdy(P))), wg = length(vec2(dFdx(wh), dFdy(wh))) / max(pxm, 1e-6);
    float dW = (wh - .5) / max(wg, 1e-3) - wob * .6, hwW = (.03 + .05 * mfV3(P * .35 + vec3(9., 2., 1.)) + .014 * mfV3(P * 2.2 + vec3(1., 6., 5.))) * mix(.3, 1., vw);
    float on = step(.25, wg) * vis, coreW = smoothstep(hwW, hwW * .3, abs(dW)) * on;
    col *= 1. - .26 * exp(-pow((dW + .07) / .09, 2.)) * on * vw * vw; /* soft shade on the grass side */
    float litW = clamp(.28 + .35 * smoothstep(hwW * .35, hwW, dW), 0., 1.);
    col = mix(col, mix(vec3(.04, .15, .015), vec3(.10, .29, .04), litW), coreW); core = max(core, coreW); }

  { /* w2 r2: FINAL17 flowers: full-strength orange / yellow / white specks (≈ 2 cm) packed in ~1 m drifts, almost none between; board metres so they never crawl */
    float drift = smoothstep(.55, .66, mfV3(vec3(gq * .6, 31.)) * .65 + mfV3(vec3(gq * 2.2, 37.)) * .35);
    vec2 fq = gq / .075, fi = floor(fq); vec3 h = mfHash(vec3(fi, 53.)); vec2 o = fract(fq) - .5 - (h.xy - .5) * .55;
    float fa = step(h.z, .006 + .62 * drift) * smoothstep(.27, .16, length(o * vec2(1., 1.2))) * (1. - core) * (1. - pth) * (1. - .55 * wh);
    float fh = mfHash(vec3(fi, 59.)).x; vec3 fcl = fh < .60 ? uFY * 1.1 : fh < .85 ? uFO * 1.1 : uFW * 1.05; /* r4: 60 % yellow, 25 % orange, 15 % white */
    col = mix(col, fcl, fa); }
  return col;
}
 uniform float uR, uDetM; uniform vec2 uMin, uMax; uniform vec4 uSB[2]; uniform sampler2D uMask, uDet, uPap;
vec4 triDet(sampler2D t, vec3 p, vec3 w){ return texture2D(t, p.yz) * w.x + texture2D(t, p.zx) * w.y + texture2D(t, p.xy) * w.z; }`)
      .replace('#include <fog_fragment>', `#include <fog_fragment>
  if (uBoardF.w > 0.0){ // dry-brush fringe of the board edge, mixed into the paper after lighting
    vec2 bq = vec2(dot(normalize(vGW), uBoardX.xyz), dot(normalize(vGW), uBoardY.xyz)) * 600.; float e0 = foldBoardSD(vGW) + (mfV3(vec3(bq * .9, 0.)) - .5) * .22 + (mfV3(vec3(bq * 3., 1.)) - .5) * .08;
    // r4: FINAL17's sprayed dry-brush rim, in board-local coords so it stays put while the world scrolls under the board
    float fr = smoothstep(-.34, .1, e0), br = mfV3(vec3(bq * 9., 3.));
    gl_FragColor.rgb = mix(gl_FragColor.rgb, uPaperS, clamp(fr * .55 - br * .25, 0., 1.));
  }
  { /* r10 #1: two big soft cloud shadows in board-local metres (the world scrolls under the board), after lighting */
    vec3 cdir = normalize(vGW); vec2 cq = vec2(dot(cdir, uBoardX.xyz), dot(cdir, uBoardY.xyz)) * 600.; float cs = 0.;
    for (int i = 0; i < 2; i++){ float r = uCS[i].w; if (r <= 0.) continue;
      float dd = length((cq - uCS[i].xy) * vec2(1., 1.25)) + (mfV3(vec3(cq * .32, float(i) * 7.)) - .5) * r * .55 + (mfV3(vec3(cq * 1.2, 3.)) - .5) * r * .14;
      cs = max(cs, exp(-dd * dd / (r * r) * 1.1)); }
    cs *= 1. - smoothstep(30., 60., length(normalize(vGW) * 600. - vec3(.3, -3., 600.))); /* d15 (vd r4.1 #2): the big cloud shadows belong to the home frame (r10 #1); away from it their soft edge read as a light band */   /* r11: gaussian falloff = very wide feather */
    gl_FragColor.rgb *= mix(vec3(1.), vec3(.55, .62, .70), cs * .45 * uMini); }   /* r11: ~45% of r10 strength */
  { // watercolour edge: the planet dissolves into the paper with a ragged, pooled rim (instead of linear fog)
    float vd = distance(vGW, cameraPosition);
    float n = mfV3(vGW * .3) * .6 + mfV3(vGW * 1.6) * .28 + mfV3(vGW * 8.) * .12;
    float t = smoothstep(uFade.x, uFade.y, vd + (n - .5) * uFade.z);
    float rim = smoothstep(.3, .5, t) * (1. - step(.5, t));
    gl_FragColor.rgb *= 1. - .14 * rim;
    gl_FragColor.rgb = mix(gl_FragColor.rgb, uPaperS, step(.5, t) * (.92 + .08 * smoothstep(.5, .9, t)));
  }`)
      .replace('#include <map_fragment>', `{
  vec3 dir = normalize(vGW); float k = dot(dir, uC);
  vec2 g = vec2(dot(dir, uE1), dot(dir, uE2)) * uR / max(k, 1e-3);
  vec2 muv = (g - uMin) / (uMax - uMin);
  float inside = step(0.05, k) * step(0.0, muv.x) * step(muv.x, 1.0) * step(0.0, muv.y) * step(muv.y, 1.0);
  vec3 bcol = texture2D(map, clamp(muv, 0.0, 1.0)).rgb;
  vec3 mk = texture2D(uMask, clamp(muv, 0.0, 1.0)).rgb * inside;
  vec3 w = pow(abs(dir), vec3(6.0)); w /= (w.x + w.y + w.z);
  vec4 d = triDet(uDet, vGW / uDetM, w);
  // r4: the baked board's own rim (paper bleed + zeroed border mask) must never show: its features fade out 18-32 m inside the edge, so the live patchwork takes over seamlessly
  vec2 eDm = min(muv, 1.0 - muv) * (uMax - uMin); float ef = smoothstep(18.0, 32.0, min(eDm.x, eDm.y));
  // ground-r4: the baked mask also carries the OLD board's hedge lines and rim (grass = 0). They cut the live hedges into stepped stubs and drew ghost hedges, so the baked grass mask only counts inside the stamp boxes (pond bank, mill yard)
  float sbf = 0.0; for (int i = 0; i < 2; i++){ vec4 bx = uSB[i]; vec2 e2 = min(g - bx.xy, bx.zw - g); sbf = max(sbf, smoothstep(0.0, 1.5, min(e2.x, e2.y) + 1.5)); }
  mk = vec3(mix(1.0, mk.r, sbf), mk.g * ef, mk.b * ef);
  float grass = mk.r, wheat = mk.b;
  vec2 gOff = vec2(1.1) / (uMax - uMin); float gmN = mix(1.0, min(min(texture2D(uMask, clamp(muv + vec2(gOff.x, 0.), 0.0, 1.0)).r, texture2D(uMask, clamp(muv - vec2(gOff.x, 0.), 0.0, 1.0)).r), min(texture2D(uMask, clamp(muv + vec2(0., gOff.y), 0.0, 1.0)).r, texture2D(uMask, clamp(muv - vec2(0., gOff.y), 0.0, 1.0)).r)), ef); /* r3: grass mask 1.1 m around: hedges keep clear of banks */
  bcol *= 1.0 + (d.r - 0.5) * 2.0 * mix(0.55, 0.8, wheat) * max(grass, wheat * 0.8);
  // board features (paths, banks, yards, wheat) win over the miniature patchwork; its grass and paper do not
  float isPaper = 1.0 - smoothstep(0.02, 0.06, distance(bcol, uPaper));
  float bw = inside * (1.0 - isPaper) * clamp((1.0 - grass) * 1.4 + wheat, 0.0, 1.0);
  bw = smoothstep(0.25, 0.75, bw + (mfV3(vGW * 3.1) - 0.5) * 0.35 + (mfV3(vGW * .7 + 2.) - 0.5) * 0.3) * uMini * ef; /* r5: ragged, natural seam */
  vec3 col = uMini > 0.5 ? mix(miniPaint(vGW, dir, d, mix(1., min(grass, gmN), inside)), bcol, bw) : mix(uPaper, bcol, inside);
  /* r10 #1: cloud shadows are applied after lighting (see fog_fragment) so the tonal grade can't cancel them */
  grass = max(grass, (1.0 - bw) * uMini);
  if (uHasLane > 0.5 && inside > 0.5){
    vec2 LD = foldPaths(g); float ld = LD.x, lw = 0.055 + 0.015 * mfV3(vGW * 0.6) + 0.006 * mfV3(vGW * 4.0);
    float le = smoothstep(lw + 0.03, lw + 0.006, ld), lc = smoothstep(lw, lw - 0.014, ld);
    col = mix(col, uPathE, le * 0.85); col = mix(col, uPath * (1.0 + (d.r - 0.5) * 0.3), lc);
    col = mix(col, uPath * 1.07, lc * smoothstep(lw * 0.45, lw * 0.15, ld) * 0.5 * mfV3(vGW * 2.3));
    grass *= 1.0 - lc * 0.7;
    // river: sandy bank, then gouache water in three tonal steps with slow drifting pale streaks
    /* w2: FINAL17 river ~1.6x wider (full width ~.38 m), deep-blue gradient, lighter-blue elongated flow strokes, a thin pale sand lip on both banks */
    float rd = LD.y, rw = 0.185 + 0.03 * mfV3(vGW * 0.5) + 0.008 * mfV3(vGW * 3.0);
    float bk = smoothstep(rw + 0.032, rw + 0.012, rd), wa = smoothstep(rw, rw - 0.008, rd);
    col = mix(col, uBank * (1.0 + (d.r - 0.5) * 0.25), bk * (1.0 - lc));
    float dep = clamp(1.0 - rd / rw, 0.0, 1.0) + (mfV3(vGW * 2.0) - 0.5) * 0.18;
    vec3 wc = mix(uWat[1], uWat[0], smoothstep(0.05, 0.75, dep)); wc = mix(uWat[2] * 0.95, wc, smoothstep(0.0, 0.22, dep));
    float side = sign(g.x - fpRiv(g.y));
    float fl = mfV3(vec3(side * rd * 16.0, g.y * 3.2 - uTime * 0.07, 2.0)) * 0.6 + mfV3(vec3(side * rd * 30.0, g.y * 6.5 - uTime * 0.11, 5.0)) * 0.4;
    wc = mix(wc, uWat[2], smoothstep(0.6, 0.78, fl) * smoothstep(0.12, 0.35, dep) * 0.42);
    col = mix(col, wc, wa * (1.0 - lc));
    grass *= 1.0 - bk;
  }
  // paper tooth everywhere (stronger where unpainted)
  float pp = triDet(uPap, vGW / 0.9, w).r - 0.5;
  col *= 1.0 + pp * mix(0.10, 0.22, 1.0 - max(grass, wheat));
  if (uBoardF.w > 0.0){ // the board's ragged watercolour edge: wobbling outline, dry-brush speckle, a faint pooled rim
    vec2 bq = vec2(dot(normalize(vGW), uBoardX.xyz), dot(normalize(vGW), uBoardY.xyz)) * 600.; float e0 = foldBoardSD(vGW) + (mfV3(vec3(bq * .9, 0.)) - .5) * .22 + (mfV3(vec3(bq * 3., 1.)) - .5) * .08;
    float ramp = smoothstep(-.32, .16, e0), sp = mfHash(vec3(floor(bq * 60.), 1.)).x * .6 + mfV3(vec3(bq * 16., 2.)) * .4;
    if (sp < ramp) discard; // spray speckle: solid inside, thinning dots outside
    col *= 1. - .05 * smoothstep(-.4, -.1, e0);
  }
  diffuseColor.rgb *= col;
}`);
  };
  m.customProgramCacheKey = () => 'fold-ground-mini';
  return m;
}

// distance fields (metres/4 → 0..255) at board scale: R = lanes and footpaths (polylines), G = the river; drawn crisp by the shader
export function laneField(board, lanes, river = null, Wd = 2048){
  const { U0, U1, V0, V1 } = board, Hd = Math.round(Wd * (V1 - V0) / (U1 - U0)), sx = (U1 - U0) / Wd, sy = (V1 - V0) / Hd, MAX = 4;
  const field = (paths) => { const D = new Float32Array(Wd * Hd).fill(MAX);
    for (const path of paths) for (let k = 0; k < path.length - 1; k++){
      const [ax, ay] = path[k], [bx, by] = path[k + 1], dx = bx - ax, dy = by - ay, L2 = dx * dx + dy * dy || 1;
      const i0 = Math.max(0, Math.floor((Math.min(ax, bx) - MAX - U0) / sx)), i1 = Math.min(Wd - 1, Math.ceil((Math.max(ax, bx) + MAX - U0) / sx));
      const j0 = Math.max(0, Math.floor((Math.min(ay, by) - MAX - V0) / sy)), j1 = Math.min(Hd - 1, Math.ceil((Math.max(ay, by) + MAX - V0) / sy));
      for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++){
        const u = U0 + (i + .5) * sx, v = V0 + (j + .5) * sy; const t = Math.max(0, Math.min(1, ((u - ax) * dx + (v - ay) * dy) / L2));
        const d = Math.hypot(u - ax - t * dx, v - ay - t * dy); if (d < D[j * Wd + i]) D[j * Wd + i] = d; } }
    return D; };
  const A = field(lanes), B = river ? field([river]) : null;
  const px = new Uint8Array(Wd * Hd * 2); for (let i = 0; i < Wd * Hd; i++){ px[2 * i] = Math.round(A[i] / MAX * 255); px[2 * i + 1] = B ? Math.round(B[i] / MAX * 255) : 255; }
  const tex = new THREE.DataTexture(px, Wd, Hd, THREE.RGFormat, THREE.UnsignedByteType);
  tex.magFilter = tex.minFilter = THREE.LinearFilter; tex.flipY = false; tex.unpackAlignment = 2; tex.needsUpdate = true; return tex;
}
