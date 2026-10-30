// 褶星 Fold art kit — miniature patchwork for the whole planet, at the scale the sheep camera sees
// (fields ≈ 3.6 m, hedges ≈ 6 cm painted lines with a soft cast shade, sandy footpaths on some field edges).
// Same maths in GLSL (ground shader) and JS (tree / prop placement), so trees sit on the painted hedges.
import * as THREE from '../shared/vendor/three.module.js';
export const MF = { cell: 2.5, warp: 0.58, hedgeP: 0.66, hedgeA: 0.22, hedgeL: 0.17, hedgeS: 23.1, R: 600, pathP: 0.0, sx: 0.62, thickR: 0.6 }; /* d15 (vd r4.1 #3): a hedged field must hold a disc of radius thickR m around its site (ramped in 6–9 m from home so the home layout is unchanged); smaller fields lose their hedge, wheat keeps only the sliver test */
export const MF_GLSL = `
vec3 mfHash(vec3 p){ p = fract(p * vec3(.1031, .1030, .0973)); p += dot(p, p.yxz + 33.33); return fract((p.xxy + p.yxx) * p.zyx); }
vec3 mfWarp(vec3 p){ return ${MF.warp.toFixed(3)} * vec3(sin(p.y * 1.13 + sin(p.z * .67)), sin(p.z * 1.07 + sin(p.x * .71)), sin(p.x * 1.17 + sin(p.y * .63))) + .06 * vec3(sin(p.y * 4.1 + p.z * 1.3), sin(p.z * 3.9 + p.x * 1.1), sin(p.x * 4.3 + p.y * 1.2)); }
// returns F1 cell id (xyz), and edge info: d = signed distance to the F1|F2 bisector (m), n = bisector normal, eh = edge hash
void mfCells(vec3 P, out vec3 id1, out vec3 id2, out float d, out vec3 n){
  vec3 q = (P + mfWarp(P)) / ${MF.cell.toFixed(3)} * vec3(${MF.sx.toFixed(3)}, 1., 1.); vec3 b = floor(q); float f1 = 1e9, f2 = 1e9; vec3 s1, s2;
  for (int k = -1; k <= 1; k++) for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++){
    vec3 c = b + vec3(i, j, k); vec3 s = c + mfHash(c + 17.0); vec3 dv = s - q; float dd = dot(dv, dv);
    if (dd < f1){ f2 = f1; s2 = s1; id2 = id1; f1 = dd; s1 = s; id1 = c; } else if (dd < f2){ f2 = dd; s2 = s; id2 = c; } }
  n = normalize((s2 - s1) * vec3(${MF.sx.toFixed(3)}, 1., 1.)); d = dot((q - 0.5 * (s1 + s2)) / vec3(${MF.sx.toFixed(3)}, 1., 1.), n) * ${MF.cell.toFixed(3)};
}
// w2: true nearest-boundary pass (continuous edge distance, no F2-swap jumps). d is measured ALONG the ground (3D bisector distance / tangent part of its normal),
// so planes that graze the surface do not smear into wide leaf-shaped blobs. Returns id1 (F1 cell), the nearest edge's neighbour id2, normal n, ground distance d, tn;
// r2: plus the second-nearest edge (neighbour id3, |ground distance| d3) so boundaries can taper into junctions instead of ending in a straight cut.
void mfEdge(vec3 P, vec3 dir, out vec3 id1, out vec3 id2, out float d, out vec3 n, out float tn, out vec3 id3a, out vec3 id3b, out float d3){
  vec3 q = (P + mfWarp(P)) / ${MF.cell.toFixed(3)} * vec3(${MF.sx.toFixed(3)}, 1., 1.); vec3 b = floor(q); float f1 = 1e9; vec3 s1 = vec3(0.); id1 = vec3(0.);
  for (int k = -1; k <= 1; k++) for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++){
    vec3 c = b + vec3(i, j, k); vec3 s = c + mfHash(c + 17.0); vec3 dv = s - q; float dd = dot(dv, dv); if (dd < f1){ f1 = dd; s1 = s; id1 = c; } }
  // Jacobian of P + mfWarp(P): the warp compresses/stretches distance, so a plane distance d maps to ground distance d / |tangent part of J^T n|
  float w_ = ${MF.warp.toFixed(3)}; float ay = cos(P.y * 1.13 + sin(P.z * .67)), az = cos(P.z * 1.07 + sin(P.x * .71)), ax = cos(P.x * 1.17 + sin(P.y * .63));
  vec3 J0 = vec3(1., w_ * ay * 1.13 + .246 * cos(P.y * 4.1 + P.z * 1.3), w_ * ay * cos(P.z * .67) * .67 + .078 * cos(P.y * 4.1 + P.z * 1.3));
  vec3 J1 = vec3(w_ * az * cos(P.x * .71) * .71 + .066 * cos(P.z * 3.9 + P.x * 1.1), 1., w_ * az * 1.07 + .234 * cos(P.z * 3.9 + P.x * 1.1));
  vec3 J2 = vec3(w_ * ax * 1.17 + .258 * cos(P.x * 4.3 + P.y * 1.2), w_ * ax * cos(P.y * .63) * .63 + .072 * cos(P.x * 4.3 + P.y * 1.2), 1.);
  float best = 1e9; id2 = id1; n = vec3(1., 0., 0.); tn = 1.; d = 1e3; d3 = 1e3; id3a = id1; id3b = id1; vec3 sxv = vec3(${MF.sx.toFixed(3)}, 1., 1.);
  for (int k = -2; k <= 2; k++) for (int j = -2; j <= 2; j++) for (int i = -2; i <= 2; i++){
    vec3 c = floor(s1) + vec3(i, j, k); if (c == id1) continue; vec3 s = c + mfHash(c + 17.0);
    vec3 nk = normalize((s - s1) * sxv); float dk = dot((q - .5 * (s1 + s)) / sxv, nk) * ${MF.cell.toFixed(3)};
    vec3 gk = nk.x * J0 + nk.y * J1 + nk.z * J2; float tk = length(gk - dir * dot(gk, dir)); float sc = abs(dk) / max(tk, .1); /* r2: .4 let grazing planes win the nearest test and cut real hedges dead */
    if (sc < best){ d3 = best; id3b = id2; best = sc; id2 = c; n = nk; d = dk / max(tk, .1); tn = tk; } else if (sc < d3){ d3 = sc; id3b = c; } }
  id3a = id1;
  /* r2: the other side's edges too (cell id2's neighbours), so the taper distance is the same seen from either side of an edge (no jump at the edge itself) */
  vec3 s2 = id2 + mfHash(id2 + 17.0);
  for (int k = -1; k <= 1; k++) for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++){
    vec3 c = id2 + vec3(i, j, k); if (c == id2 || c == id1) continue; vec3 s = c + mfHash(c + 17.0);
    vec3 nk = normalize((s - s2) * sxv); float dk = dot((q - .5 * (s2 + s)) / sxv, nk) * ${MF.cell.toFixed(3)};
    vec3 gk = nk.x * J0 + nk.y * J1 + nk.z * J2; float tk = length(gk - dir * dot(gk, dir)); float sc = abs(dk) / max(tk, .1);
    if (sc < d3){ d3 = sc; id3a = id2; id3b = c; } }
}
float mfEdgeHash(vec3 a, vec3 b){ vec3 h = mfHash(min(a, b) * 1.31 + max(a, b) * 0.71 + 5.0); return h.x; }
/* ground-r4: hedge rows = the outline of a per-cell label (a few "hedged" fields). An outline is always closed (0 or 2 hedge edges at every vertex), so a hedge never ends in a stub or breaks into dashes.
   Only fields the ground cuts near their site are hedged: a site far off the surface gives a thin sliver section, whose outline would be a pointed lens-shaped loop. */
float mfThickR(vec3 id, float rs){ vec3 sxv = vec3(${MF.sx.toFixed(3)}, 1., 1.), s = id + mfHash(id + 17.0), G = normalize(s / sxv) * ${MF.R.toFixed(1)}, q = (G + mfWarp(G)) / ${MF.cell.toFixed(3)} * sxv, nG = G / ${MF.R.toFixed(1)};
  float rho = rs * ${(MF.thickR / MF.cell).toFixed(4)} * smoothstep(6., 9., length(G - vec3(.3, -3., 600.))), ss = dot(s, s);
  for (int k = -1; k <= 1; k++) for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++){ if (i == 0 && j == 0 && k == 0) continue; vec3 c = id + vec3(i, j, k), sc = c + mfHash(c + 17.0), a = sc - s, b = a * sxv;
    if (dot(a, q) + rho * length(b - nG * dot(b, nG)) > (dot(sc, sc) - ss) * .5) return 0.; }
  return 1.; } /* d15 (vd r4.1 #3): a hedged field must hold a disc of radius thickR (m) round its site's ground point — exact half-space test per neighbour; ramped in 10–16 m from home (home layout unchanged) */
float mfThick(vec3 id){ return mfThickR(id, 0.); } /* wheat: only the sliver test */
float mfHedgeLab(vec3 id){ return mfHash(id + ${MF.hedgeS.toFixed(2)}).x > ${MF.hedgeL.toFixed(3)} ? 0. : mfThickR(id, 1.); }
float mfHedge(vec3 a, vec3 b){ return abs(mfHedgeLab(a) - mfHedgeLab(b)); }
`;
// JS port (for placement)
const fr = (x) => x - Math.floor(x);
export function mfHash(x, y, z){ let a = fr(x * .1031), b = fr(y * .1030), c = fr(z * .0973);
  const d = a * (b + 33.33) + b * (a + 33.33) + c * (c + 33.33); a += d; b += d; c += d;
  return [fr((a + b) * c), fr((a + a) * b), fr((b + a) * a)]; }
// matches GLSL: p += dot(p, p.yxz+33.33) → a*(b+33.33)+b*(a+33.33)+c*(c+33.33); (p.xxy+p.yxx)*p.zyx → [(a+b)c, (a+a)b, (b+a)a]
export function mfWarp(p){ const w = MF.warp, S = Math.sin; return [w * S(p[1] * 1.13 + S(p[2] * .67)) + .06 * S(p[1] * 4.1 + p[2] * 1.3), w * S(p[2] * 1.07 + S(p[0] * .71)) + .06 * S(p[2] * 3.9 + p[0] * 1.1), w * S(p[0] * 1.17 + S(p[1] * .63)) + .06 * S(p[0] * 4.3 + p[1] * 1.2)]; }
export function mfCells(P){
  const wv = mfWarp(P), q = [(P[0] + wv[0]) / MF.cell * MF.sx, (P[1] + wv[1]) / MF.cell, (P[2] + wv[2]) / MF.cell], b = q.map(Math.floor);
  let f1 = 1e9, f2 = 1e9, s1, s2, id1, id2;
  for (let k = -1; k <= 1; k++) for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++){
    const c = [b[0] + i, b[1] + j, b[2] + k], h = mfHash(c[0] + 17, c[1] + 17, c[2] + 17), s = [c[0] + h[0], c[1] + h[1], c[2] + h[2]];
    const dd = (s[0] - q[0]) ** 2 + (s[1] - q[1]) ** 2 + (s[2] - q[2]) ** 2;
    if (dd < f1){ f2 = f1; s2 = s1; id2 = id1; f1 = dd; s1 = s; id1 = c; } else if (dd < f2){ f2 = dd; s2 = s; id2 = c; } }
  const n = [(s2[0] - s1[0]) * MF.sx, s2[1] - s1[1], s2[2] - s1[2]], l = Math.hypot(...n); n[0] /= l; n[1] /= l; n[2] /= l;
  const d = ((q[0] - (s1[0] + s2[0]) / 2) / MF.sx * n[0] + (q[1] - (s1[1] + s2[1]) / 2) * n[1] + (q[2] - (s1[2] + s2[2]) / 2) * n[2]) * MF.cell;
  return { id1, id2, d, n };
}
export function mfEdgeHash(a, b){ const mn = a.map((v, i) => Math.min(v, b[i])), mx = a.map((v, i) => Math.max(v, b[i]));
  return mfHash(mn[0] * 1.31 + mx[0] * .71 + 5, mn[1] * 1.31 + mx[1] * .71 + 5, mn[2] * 1.31 + mx[2] * .71 + 5)[0]; }
export function mfThick(id, rs = 0){ const h = mfHash(id[0] + 17, id[1] + 17, id[2] + 17), sv = [id[0] + h[0], id[1] + h[1], id[2] + h[2]], g = [sv[0] / MF.sx, sv[1], sv[2]], lg = Math.hypot(...g);
  const G = g.map(x => x / lg * MF.R), wv = mfWarp(G), q = [(G[0] + wv[0]) / MF.cell * MF.sx, (G[1] + wv[1]) / MF.cell, (G[2] + wv[2]) / MF.cell], hm = Math.hypot(G[0] - .3, G[1] + 3, G[2] - 600);
  const sr = Math.min(1, Math.max(0, (hm - 6) / 3)), rho = rs * MF.thickR * sr * sr * (3 - 2 * sr) / MF.cell, nG = G.map(x => x / MF.R), ss = sv[0] ** 2 + sv[1] ** 2 + sv[2] ** 2;
  for (let k = -1; k <= 1; k++) for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++){ if (!(i || j || k)) continue; const c = [id[0] + i, id[1] + j, id[2] + k], hc = mfHash(c[0] + 17, c[1] + 17, c[2] + 17), sc = [c[0] + hc[0], c[1] + hc[1], c[2] + hc[2]];
    const a = [sc[0] - sv[0], sc[1] - sv[1], sc[2] - sv[2]], b = [a[0] * MF.sx, a[1], a[2]], bn = b[0] * nG[0] + b[1] * nG[1] + b[2] * nG[2], bt = Math.hypot(b[0] - bn * nG[0], b[1] - bn * nG[1], b[2] - bn * nG[2]);
    if (a[0] * q[0] + a[1] * q[1] + a[2] * q[2] + rho * bt > (sc[0] ** 2 + sc[1] ** 2 + sc[2] ** 2 - ss) / 2) return 0; }
  return 1; }
export function mfHedgeLab(id){ return mfHash(id[0] + MF.hedgeS, id[1] + MF.hedgeS, id[2] + MF.hedgeS)[0] <= MF.hedgeL ? mfThick(id, 1) : 0; }
/* ground-r4: mirrors GLSL mfHedge (closed hedge outlines of the hedged fields) */
export function mfHedge(a, b){ return mfHedgeLab(a) !== mfHedgeLab(b); }
