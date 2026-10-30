// 海豹湾 Seal Bay — pencil ink tiles, drawn ONCE at startup (seeded, never re-randomised → no line boiling).
// The reference draws two kinds of current mark in graphite (#182527): tight curls/scribble clusters and longer angular
// zigzags (Z / N shapes with nearly straight legs); the banks carry dense tangled scribble.
import * as THREE from '../../shared/vendor/three.module.js';
import { mulberry } from '../../artkit/ground.js';

function tile(size, draw){
  const cv = document.createElement('canvas'); cv.width = cv.height = size; const g = cv.getContext('2d');
  g.fillStyle = '#fff'; g.fillRect(0, 0, size, size); g.lineCap = 'round'; g.lineJoin = 'round'; draw(g, size);
  const t = new THREE.CanvasTexture(cv); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; t.minFilter = THREE.LinearMipmapLinearFilter; t.generateMipmaps = true; return t;
}
// draw a polyline with pencil pressure (swells mid-stroke, lifts at the ends), copied at the wrap offsets it touches
function pencil(g, S, pts, w0, rgb, alpha, ph){
  let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9; for (const [x, y] of pts){ x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  for (const ox of [-S, 0, S]) for (const oy of [-S, 0, S]){
    if (x1 + ox < -8 || x0 + ox > S + 8 || y1 + oy < -8 || y0 + oy > S + 8) continue;
    for (let i = 1; i < pts.length; i++){ const p = i / pts.length, press = .5 + .7 * Math.pow(Math.sin(Math.PI * p), .6) * (.85 + .15 * Math.sin(ph + i * .7));
      g.strokeStyle = `rgba(${rgb},${alpha * (.62 + .38 * press)})`; g.lineWidth = w0 * press;
      g.beginPath(); g.moveTo(pts[i - 1][0] + ox, pts[i - 1][1] + oy); g.lineTo(pts[i][0] + ox, pts[i][1] + oy); g.stroke(); } }
}
// curl: a random walk whose turning keeps winding one way for a while (little loops and hooks)
function curl(rnd, x, y, n, step, turn){ const pts = [[x, y]]; let th = rnd() * 6.28, w = (rnd() - .5) * turn;
  for (let i = 0; i < n; i++){ w = w * .8 + (rnd() - .5) * turn; th += w; x += Math.cos(th) * step; y += Math.sin(th) * step; pts.push([x, y]); } return pts; }
// zigzag: 2–5 nearly straight legs with sharp turns, each leg very slightly bowed
function zigzag(rnd, x, y, legs, len){ const pts = [[x, y]]; let th = rnd() * 6.28;
  for (let l = 0; l < legs; l++){ const L = len * (.55 + rnd() * .7), bow = (rnd() - .5) * .25, n = 5;
    for (let i = 1; i <= n; i++){ th += bow / n; x += Math.cos(th) * L / n; y += Math.sin(th) * L / n; pts.push([x, y]); }
    th += (rnd() < .5 ? 1 : -1) * (1.9 + rnd() * .9); } return pts; }

export const INK_M = 8; // metres per water ink tile
// water: 2048² over 8 m = 3.9 mm/texel; line ≈ 2 texels ≈ 8 mm ≈ 1.3 px at 1440 in the default frame
export function waterInk(){
  return tile(2048, (g, S) => { const rnd = mulberry(31), C = '30,42,66';
    // long, thin, flowing curls (≈ 1 px at 1440) with an occasional angular kink; no repeated zigzag glyphs
    for (let i = 0; i < 70; i++){ const n = 26 + (rnd() * 30 | 0), pts = curl(rnd, rnd() * S, rnd() * S, n, 3.4, .5);
      if (rnd() < .35){ const k = 8 + (rnd() * (n - 16) | 0), a = (rnd() < .5 ? 1 : -1) * (1.2 + rnd() * .6), c = Math.cos(a), s2 = Math.sin(a), [kx, ky] = pts[k];
        for (let j = k + 1; j < pts.length; j++){ const dx = pts[j][0] - kx, dy = pts[j][1] - ky; pts[j] = [kx + dx * c - dy * s2, ky + dx * s2 + dy * c]; } }
      pencil(g, S, pts, 1.15 + rnd() * .35, C, .8, rnd() * 6); }
    for (let c = 0; c < 9; c++){ const cx = rnd() * S, cy = rnd() * S, n = 3 + (rnd() * 3 | 0);   // a few tight scribble clusters
      for (let k = 0; k < n; k++) pencil(g, S, curl(rnd, cx + (rnd() - .5) * 50, cy + (rnd() - .5) * 36, 10 + (rnd() * 10 | 0), 2.6, 1.2), 1.1 + rnd() * .3, C, .8, rnd() * 6); } });
}
// bank: 1024² over 4 m; dense tangled scribble clusters (the black tangles on seals_f.jpg's bank patches)
export const BANK_M = 4;
export function bankInk(){
  return tile(1024, (g, S) => { const rnd = mulberry(77), C = '18,32,30';
    for (let c = 0; c < 30; c++){ const cx = rnd() * S, cy = rnd() * S, sp = 30 + rnd() * 50, n = 13 + (rnd() * 18 | 0);   /* r5: ≈ 70 % of r4's density */
      for (let k = 0; k < n; k++){ const a = rnd() * 6.28, r = Math.pow(rnd(), .7) * sp; pencil(g, S, curl(rnd, cx + Math.cos(a) * r, cy + Math.sin(a) * r * .7, 10 + (rnd() * 18 | 0), 3.2, 2.0), 1.7 + rnd() * .7, C, .92, rnd() * 6); } }
    for (let i = 0; i < 42; i++) pencil(g, S, curl(rnd, rnd() * S, rnd() * S, 8 + (rnd() * 14 | 0), 3.4, 1.4), 1.6 + rnd() * .5, C, .85, rnd() * 6); });
}
