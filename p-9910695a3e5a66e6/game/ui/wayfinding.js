// 褶星 Fold — D2 wayfinding: a paper-edge hint toward the nearest unvisited region, and region names on the planet map.
// Pencil and ink only: one thin graphite arrow + a serif nameplate on the paper margin 8-24 px outside the board's ragged edge; no glow, no boxes.
// r2 (to_designer_09): hint moved off the grass onto the paper (35-55 % far->near, never under 30 %); map names written on the paper just outside
// the planet silhouette, each tied to its spot by a 0.75 px pencil leader at 30 % ink, like hand-drawn map annotations.
// Reads the diorama camera (D, HOME_D, board) and the shared bend uniform; writes nothing back. Visited regions persist in localStorage.
import * as THREE from '../../shared/vendor/three.module.js';
import { BEND } from '../../artkit/bend.js';

const KEY = 'fold.visited.v2', OLD = { '01': 'meadow', '02': 'station', '06': 'pond', '03': 'mill', '07': 'sealbay' }, // v2: region ids (v1 stored the old region numbers)
   NS = 'http://www.w3.org/2000/svg';
const INK = '#4a4236', INK_OP = .86, WT = '500', FONT = '"Cormorant Garamond","Noto Serif SC","Songti SC",Georgia,serif';
const sstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const el = (tag, at = {}, parent) => { const e = document.createElementNS(NS, tag); for (const k in at) e.setAttribute(k, at[k]); if (parent) parent.appendChild(e); return e; };

export function createWayfinding({ cam, camera, cat, REG, R = 600, qs = new URLSearchParams(location.search), next = null, hidden = () => false }) {
  // ---------- visited set ----------
  let visited = new Set();
  try { if (qs.has('wfreset')) localStorage.removeItem(KEY); visited = new Set(JSON.parse(localStorage.getItem(KEY) || '[]'));
    if (!localStorage.getItem(KEY)) { for (const n of JSON.parse(localStorage.getItem('fold.visited.v1') || '[]')) if (OLD[n]) visited.add(OLD[n]); } } catch (e) { /* private mode: session only */ }
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify([...visited])); } catch (e) {} };
  const off = qs.has('close') || qs.has('nowayfind');   // the close / eye cameras are not the diorama view

  // ---------- overlay ----------
  const svg = el('svg', { id: 'wayfind', width: '100%', height: '100%' });
  svg.style.cssText = 'position:fixed;left:0;top:0;width:100%;height:100%;pointer-events:none;overflow:visible;z-index:2';
  document.body.appendChild(svg);
  const hint = el('g', { opacity: 0 }, svg);
  // the arrow: a main graphite stroke and a fainter second pass slightly off it (a pencil line goes over itself), plus a two-stroke head
  const shaft = el('path', { fill: 'none', stroke: INK, 'stroke-width': .9, 'stroke-linecap': 'round' }, hint);
  const shaft2 = el('path', { fill: 'none', stroke: INK, 'stroke-width': .6, 'stroke-linecap': 'round', opacity: .45 }, hint);
  const head = el('path', { fill: 'none', stroke: INK, 'stroke-width': .9, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, hint);
  const plate = el('text', { fill: INK, 'font-size': 13, 'font-weight': WT, 'letter-spacing': '.16em', 'dominant-baseline': 'middle' }, hint); plate.style.fontFamily = FONT;
  const map = el('g', { opacity: 0 }, svg);
  const labels = REG.map(r => { const g = el('g', {}, map);
    const lead = el('path', { fill: 'none', stroke: INK, 'stroke-width': .75, 'stroke-linecap': 'round', opacity: .30 }, g);   // pencil leader, 30 % ink
    const dot = el('circle', { r: 1.1, fill: INK, opacity: .30 }, g);                                                               // the spot it annotates
    const t = el('text', { fill: INK, 'font-size': 13, 'font-weight': WT, 'letter-spacing': '.16em', 'text-anchor': 'middle', 'dominant-baseline': 'middle' }, g); t.style.fontFamily = FONT; t.textContent = r.name;
    return { r, g, t, lead, dot, w: 0 }; });
  // ---------- geometry helpers (same bend as artkit/bend.js foldBend, so labels sit on the drawn planet) ----------
  const F_ = new THREE.Vector3(), v1 = new THREE.Vector3(), v2 = new THREE.Vector3(), v3 = new THREE.Vector3();
  const bend = (w) => { const k = BEND.value.w; if (!k) return w; F_.set(BEND.value.x, BEND.value.y, BEND.value.z); const s = R * v1.copy(w).normalize().sub(F_).length(); return w.addScaledVector(F_, -s * s * k); };
  const toScreen = (w, out) => { const p = v2.copy(w).project(camera); out.x = (p.x * .5 + .5) * innerWidth; out.y = (-p.y * .5 + .5) * innerHeight; out.z = p.z; return out; };
  const groundR = () => cam.target.length() - .1;
  const boardSD = (d) => { const B = cam.board; if (d.dot(B.F) < .9) return 1e3;   // foldBoardSD in metres (bend.js)
    const qx = Math.abs(R * (d.dot(B.X) - B.F.dot(B.X))) - B.hx, qy = Math.abs(R * (d.dot(B.Y) - B.F.dot(B.Y))) - B.hy;
    return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0); };
  const dist = (r) => cat.up.angleTo(r.dir) * R;   // great-circle metres from the cat to a region centre

  // ---------- state ----------
  let shown = null, op = 0, mapK = 0, first = true; const S0 = { x: 0, y: 0, z: 0 }, S1 = { x: 0, y: 0, z: 0 }, C = [0, 1, 2, 3].map(() => ({ x: 0, y: 0, z: 0 }));
  const api = { visited, get target() { return shown; }, get opacity() { return op; }, debug: () => ({ op, hint: hint.getBBox?.(), labels: labels.map(L => ({ n: L.r.name, ...(L.at || {}) })), sil: SIL.length }) };

  // ---------- hint placement: on the paper just outside the ragged board edge, on the side facing the target ----------
  const EDGE = .08, GAP = 14, PAD = 12, LR = 24;   // EDGE: where the ragged rim (ground.js) still reads as solid edge; its sparse spray beyond ends ~10 px later. GAP: inside the 8-24 px band
  const P = [];   // board outline on screen (bent), 4 edges x 8 segments
  const PH = [], HT = 1.15;   // QA D4: the same outline raised HT m (the big trees' crowns, sheep well under): what stands on the board's front corner rises over the margin beside the edge further back
  const PI = [], HH = 7, CLR = 13 + HH;   // QA wf390: PI = the outline 0.45 m INSIDE the edge (where the frayed rim is solid grass again); HH = half a 13 px glyph; CLR = centre offset for a 13 px gap
  const boardOutline = (gR, P, ex = EDGE) => { const B = cam.board, hx = B.hx + ex, hy = B.hy + ex, cs = [[1, 1], [1, -1], [-1, -1], [-1, 1]]; P.length = 0;
    for (let i = 0; i < 4; i++) for (let j = 0; j < 8; j++) { const a = cs[i], b = cs[(i + 1) % 4], f = j / 8, u = a[0] + (b[0] - a[0]) * f, v = a[1] + (b[1] - a[1]) * f;
      const w = new THREE.Vector3().copy(B.F).multiplyScalar(R).addScaledVector(B.X, u * hx).addScaledVector(B.Y, v * hy).setLength(gR); const o = { x: 0, y: 0, z: 0 }; toScreen(bend(w), o); P.push(o); } };
  // QA wf390: the outline's screen y over a label's x span (lo: the upper crossing, else the lower one); ±Infinity when the span misses it
  const edgeAt = (Q, x, lo) => { let r = lo ? Infinity : -Infinity; for (let i = 0; i < Q.length; i++) { const a = Q[i], b = Q[(i + 1) % Q.length]; if (a.x === b.x || (a.x - x) * (b.x - x) > 0) continue;
    const y = a.y + (b.y - a.y) * (x - a.x) / (b.x - a.x); r = lo ? Math.min(r, y) : Math.max(r, y); } return r; };
  const spanEdge = (Q, x0, x1, lo) => { let r = lo ? Infinity : -Infinity; for (let k = 0; k <= 10; k++) { const y = edgeAt(Q, x0 + (x1 - x0) * k / 10, lo); r = lo ? Math.min(r, y) : Math.max(r, y); } return r; };
  const titleBox = () => { const c = document.getElementById('card'); if (!c || !(+getComputedStyle(c).opacity > .01)) return null; const r = c.getBoundingClientRect(); return r.height ? r : null; };
  /* QA wf390 (station @390 dock: the name pinned to the screen bottom while the follow camera eased the board's lower rim down onto it, 1.1 px gap):
     the label centre y for a name spanning x0…x1, re-solved every frame from the projected outline, first fit wins:
     (1) paper below the board, glyph top ≥ 13 px past the solid rim; (2) paper above it, glyph bottom ≥ 13 px clear of the raised (HT) outline,
     then of the plain rim, never over the region title; (3) the board fills the screen there: on solid grass, ≥ 13 px inside the frayed band
     (PI) and on screen; (4) last resort: the top paper, on screen */
  let fitMode = 0;
  const fitY = (x0, x1) => { const H = innerHeight, tb = titleBox();
    const clearT = (y) => !tb || x1 < tb.left - 6 || x0 > tb.right + 6 || y - HH > tb.bottom + 6 || y + HH < tb.top - 6;
    let yB = spanEdge(P, x0, x1, false); if (!isFinite(yB)) for (const p of P) yB = Math.max(yB, p.y);
    if (yB + CLR + HH + PAD + (fitMode ? 4 : 0) <= H) { fitMode = 0; return yB + CLR; }   // 4 px hysteresis: no flip-flop while the follow camera settles
    for (const Q of [PH, P]) { const yT = spanEdge(Q, x0, x1, true), y = (isFinite(yT) ? yT : Math.min(...P.map(p => p.y))) - CLR; if (y - HH >= PAD && clearT(y)) { fitMode = 1; return y; } }
    fitMode = 1;
    const iB = spanEdge(PI, x0, x1, false), iT = spanEdge(PI, x0, x1, true), y = Math.min(H - PAD - HH, iB - CLR); if (isFinite(iT) && y - HH >= Math.max(PAD, iT + 13) && clearT(y)) return y;
    return PAD + HH; };
  /* VD MVP gate D4 (390): the 坐 / 睡 / 本 rail always on paper — glyphs 16 px from the screen's right edge (span padding 8 + right 8), its
     box ≥ 4 px (glyphs ≥ 10 px) clear of the torn rim (P = the outline at EDGE, the outermost green), re-solved every frame from the projected
     board: its default spot (bottom 44 px) if that is paper, else the paper under the board, else the paper above it; only if the board fills
     the whole column does it stay at the default over the grass (86 % ink, index.html) */
  const PR = [], RIM_R = 4;
  const placeRail = () => { const tk = document.getElementById('touchk'); if (!tk || !tk.offsetWidth) return;
    const H = innerHeight, rw = tk.offsetWidth, rh = tk.offsetHeight, x1 = innerWidth - 8, x0 = x1 - rw, def = H - 44 - rh;
    boardOutline(groundR(), PR); const yB = spanEdge(PR, x0 - 10, x1 + 10, false), yT = spanEdge(PR, x0 - 10, x1 + 10, true);
    let top = def;
    if (isFinite(yB) && !(def >= yB + RIM_R || def + rh <= yT - RIM_R)) {
      if (H - 8 - (yB + RIM_R) >= rh) top = Math.max(yB + RIM_R, Math.min(def, H - 8 - rh));
      else if (yT - RIM_R - 8 >= rh) top = yT - RIM_R - rh; }
    tk.style.right = '8px'; tk.style.bottom = 'auto'; tk.style.top = top.toFixed(1) + 'px'; };
  const placeHint = () => {
    // screen direction toward the region: the cat's ground point and a point 3 m along the great circle toward it
    const up = cat.up, gR = groundR(); const t = v3.copy(shown.dir).addScaledVector(up, -shown.dir.dot(up)).normalize();
    toScreen(bend(new THREE.Vector3().copy(up).multiplyScalar(gR)), S0); toScreen(bend(new THREE.Vector3().copy(up).multiplyScalar(gR).addScaledVector(t, 3)), S1);
    let dx = S1.x - S0.x, dy = S1.y - S0.y; const dl = Math.hypot(dx, dy) || 1; dx /= dl; dy /= dl;
    boardOutline(gR, P); boardOutline(gR + HT, PH); boardOutline(gR, PI, -.45); let cx = 0, cy = 0; for (const p of P) { cx += p.x / P.length; cy += p.y / P.length; }
    // where the ray from the cat toward the target leaves the board, and that edge segment's outward normal
    let tE = Infinity, nx = dx, ny = dy, tx = 0, ty = 1;
    for (let i = 0; i < P.length; i++) { const a = P[i], b = P[(i + 1) % P.length], ex = b.x - a.x, ey = b.y - a.y, den = dx * ey - dy * ex; if (Math.abs(den) < 1e-6) continue;
      const tt = ((a.x - S0.x) * ey - (a.y - S0.y) * ex) / den, u = ((a.x - S0.x) * dy - (a.y - S0.y) * dx) / den;
      if (tt > 0 && u >= 0 && u <= 1 && tt < tE) { tE = tt; const el_ = Math.hypot(ex, ey) || 1; tx = ex / el_; ty = ey / el_; nx = ty; ny = -tx; if (((a.x + b.x) / 2 - cx) * nx + ((a.y + b.y) / 2 - cy) * ny < 0) { nx = -nx; ny = -ny; } } }
    if (!isFinite(tE)) tE = Math.min(innerWidth, innerHeight) * .4;
    /* QA D4 (meadow @1440: 「小站 · The Halt →」 half under a sheep and the big tree): on a left/right edge the name starts beyond the raised outline too,
       i.e. clear of anything up to HT tall standing on the board's rim, not only of the grass edge. QA wf: the TOP edge too (the back row of trees' crowns rise over it) */
    if (Math.abs(nx) >= .6 || ny <= -.6) for (let i = 0; i < PH.length; i++) { const a = PH[i], b = PH[(i + 1) % PH.length], ex = b.x - a.x, ey = b.y - a.y, den = dx * ey - dy * ex; if (Math.abs(den) < 1e-6) continue;
      const tt = ((a.x - S0.x) * ey - (a.y - S0.y) * ex) / den, u = ((a.x - S0.x) * dy - (a.y - S0.y) * dx) / den; if (tt > tE && u >= 0 && u <= 1 && tt < tE * 1.6) tE = tt; }
    const Ex = S0.x + dx * tE, Ey = S0.y + dy * tE;
    // the arrow points off the board, toward the target: its screen direction, kept within ~60 deg of the edge normal
    let ax = dx, ay = dy; if (ax * nx + ay * ny < .5) { ax = ax * .5 + nx; ay = ay * .5 + ny; const l = Math.hypot(ax, ay); ax /= l; ay /= l; }
    if (ty < 0) { tx = -tx; ty = -ty; }   // edge tangent, pointing down the screen
    plate.removeAttribute('transform'); plate.setAttribute('dominant-baseline', 'middle');
    const w = plate.getComputedTextLength?.() || 90, sideEdge = Math.abs(nx) >= .6;
    let t0x, t0y;   // arrow tail
    if (sideEdge && w + GAP + 9 + LR + PAD <= (nx > 0 ? innerWidth - Ex : Ex)) {   // left/right edge with room: "The Pond ->" reading outward
      plate.setAttribute('text-anchor', nx > 0 ? 'start' : 'end'); plate.setAttribute('x', (Ex + nx * GAP).toFixed(1)); plate.setAttribute('y', (Ey + ny * GAP).toFixed(1));
      t0x = Ex + nx * (GAP + w + 9); t0y = Ey + ny * GAP;
    } else if (sideEdge && (nx > 0 ? innerWidth - Ex : Ex) < GAP + 18 + PAD) {   // phone with the board ~90% wide: too thin a side margin for even a rotated name
      // -> the name sits in the paper under the board on that side ("The Pond ->" / "<- The Pond"), arrow outward; clamped to the safe area
      const r = nx > 0, rail = (document.getElementById('touchk')?.offsetWidth ? 40 : 0), ex = r ? innerWidth - PAD - LR - 2 - rail : PAD + LR + 2;
      const y = fitY(r ? ex - 6 - w : ex - LR, r ? ex + LR : ex + 6 + w);   // QA wf390: was min(screen bottom, under the board) — pinned onto the rim when the board reached the bottom   // arrow tail next to the screen edge (left of the touch rail on the right), the name runs inward
      plate.setAttribute('text-anchor', r ? 'end' : 'start'); plate.setAttribute('x', (r ? ex - 6 : ex + 6).toFixed(1)); plate.setAttribute('y', y.toFixed(1));
      drawArrow(ex, y, r ? 1 : -1, 0, LR - 2); clampHint(); return;
    } else if (sideEdge) {   // phone: no room beside the board -> the name runs along the edge (like a map margin note), the arrow at its head
      t0x = Ex + nx * 8; t0y = Ey + ny * 8; const len = 16, px = Ex + nx * (GAP + 4), py = Ey + ny * (GAP + 4);
      const sx = px + tx * 12, sy = py + ty * 12, ang = Math.atan2(ty, tx) * 180 / Math.PI;
      plate.setAttribute('text-anchor', 'start'); plate.setAttribute('x', sx.toFixed(1)); plate.setAttribute('y', sy.toFixed(1)); plate.setAttribute('transform', `rotate(${ang.toFixed(1)} ${sx.toFixed(1)} ${sy.toFixed(1)})`);
      ax = nx; ay = ny; drawArrow(t0x, t0y, ax, ay, len); clampHint(); return;
    } else {   // top / bottom edge: the name centred beyond the edge, the arrow beyond the name
      plate.setAttribute('text-anchor', 'middle'); plate.setAttribute('x', (Ex + nx * (GAP + 6)).toFixed(1)); plate.setAttribute('y', (Ey + ny * (GAP + 6)).toFixed(1));   // QA wf: centre 20 px out, so the 13 px glyphs start ≥ 13 px past the solid rim (its spray ends ~10 px out)
      t0x = Ex + nx * (GAP + 20); t0y = Ey + ny * (GAP + 20);
      const cy = Ey + ny * (GAP + 6), H = innerHeight, ae = Ey + ny * (GAP + 20 + LR);
      if (cy + HH > H - PAD || cy - HH < PAD || ae > H - PAD || ae < PAD) {   // QA wf390: no room for name + arrow beyond that edge on screen -> the name on the best fitting row, a short arrow at its end
        const x = Math.min(innerWidth - PAD - w / 2 - 20, Math.max(PAD + w / 2, Ex)), y = fitY(x - w / 2, x + w / 2 + 20); plate.setAttribute('x', x.toFixed(1)); plate.setAttribute('y', y.toFixed(1));
        drawArrow(x + w / 2 + 6, y, ax, ay, 14); clampHint(); return; }
    }
    drawArrow(t0x, t0y, ax, ay, LR); clampHint();
  };
  const drawArrow = (tx0, ty0, ax, ay, Lr) => {
    const hx = tx0 + ax * Lr, hy = ty0 + ay * Lr, qx = -ay, qy = ax, bow = 1.2;   // a hand line bows a little
    shaft.setAttribute('d', `M${tx0.toFixed(1)},${ty0.toFixed(1)} Q${((tx0 + hx) / 2 + qx * bow).toFixed(1)},${((ty0 + hy) / 2 + qy * bow).toFixed(1)} ${hx.toFixed(1)},${hy.toFixed(1)}`);
    shaft2.setAttribute('d', `M${(tx0 + qx * .7 + ax * 2).toFixed(1)},${(ty0 + qy * .7 + ay * 2).toFixed(1)} L${(hx + qx * .5 - ax * 1.5).toFixed(1)},${(hy + qy * .5 - ay * 1.5).toFixed(1)}`);
    const hl = 6, ha = .45, c = Math.cos(ha), s = Math.sin(ha);
    head.setAttribute('d', `M${(hx - hl * (ax * c - ay * s)).toFixed(1)},${(hy - hl * (ay * c + ax * s)).toFixed(1)} L${hx.toFixed(1)},${hy.toFixed(1)} L${(hx - hl * (ax * c + ay * s)).toFixed(1)},${(hy - hl * (ay * c - ax * s)).toFixed(1)}`);
  };
  const clampHint = () => {   // keep the whole hint on screen (slides along the margin; never pulled back over the board by more than the overflow)
    hint.setAttribute('transform', ''); const bb = hint.getBBox?.();
    if (bb && bb.width) { let ox = 0, oy = 0; if (bb.x < PAD) ox = PAD - bb.x; else if (bb.x + bb.width > innerWidth - PAD) ox = innerWidth - PAD - bb.x - bb.width;
      if (bb.y < PAD) oy = PAD - bb.y; else if (bb.y + bb.height > innerHeight - PAD) oy = innerHeight - PAD - bb.y - bb.height;
      const tk = document.getElementById('touchk'), rr = tk?.offsetWidth ? tk.getBoundingClientRect() : null;   // phone: never run under the 坐睡本 rail
      if (rr && bb.y + oy < rr.bottom && bb.y + oy + bb.height > rr.top && bb.x + ox + bb.width > rr.left - 6) ox = rr.left - 6 - bb.x - bb.width;
      if (ox || oy) hint.setAttribute('transform', `translate(${ox.toFixed(1)},${oy.toFixed(1)})`); }
  };

  // ---------- planet map helpers: front-facing test without screen bounds, the silhouette, and label boxes ----------
  const face = (d, gR, out) => { const w = bend(d.clone().multiplyScalar(gR)); toScreen(w, out);
    const e1 = new THREE.Vector3(0, 1, 0).cross(d).normalize(), e2 = d.clone().cross(e1);
    const a = bend(d.clone().multiplyScalar(gR).addScaledVector(e1, 1)).sub(w), b = bend(d.clone().multiplyScalar(gR).addScaledVector(e2, 1)).sub(w), nb = a.cross(b).normalize();
    if (nb.dot(d) < 0) nb.negate(); const onBoard = !(cam.board.margin > 0) || boardSD(d) <= cam.board.margin;
    return onBoard && out.z < 1 ? nb.dot(v1.copy(camera.position).sub(w).normalize()) : -1; };
  const rot = (Fb, ax, m) => Fb.clone().applyAxisAngle(ax, m / R);
  // walk from the focus along a bearing to the last front-facing point (bisection), i.e. where the drawn planet's outline crosses that bearing
  const limb = (Fb, ax, maxM, gR, out) => { let lo = 0, hi = 0, st = 6; const o = { x: 0, y: 0, z: 0 };
    while (hi < maxM) { const m = Math.min(maxM, hi + st); if (face(rot(Fb, ax, m), gR, o) < .02) { lo = hi; hi = m; break; } lo = hi = m; st *= 1.5; }
    if (hi === lo) { face(rot(Fb, ax, hi), gR, out); out.full = true; return out; }   // reached the target while still facing: it is visible
    for (let i = 0; i < 7; i++) { const m = (lo + hi) / 2; if (face(rot(Fb, ax, m), gR, o) >= .02) lo = m; else hi = m; }
    face(rot(Fb, ax, lo), gR, out); out.full = false; return out; };
  const SIL = []; let silN = 0;
  const silhouette = (Fb, gR) => { SIL.length = 0; const e1 = new THREE.Vector3(0, 1, 0).cross(Fb).normalize(), e2 = Fb.clone().cross(e1);
    for (let i = 0; i < 96; i++) { const th = i / 96 * Math.PI * 2, tg = e1.clone().multiplyScalar(Math.cos(th)).addScaledVector(e2, Math.sin(th)), ax = new THREE.Vector3().crossVectors(Fb, tg).normalize();
      const o = limb(Fb, ax, 900, gR, { x: 0, y: 0, z: 0 }); if (!o.full) SIL.push(o); }
    // on-screen silhouette points with paper beyond: outward normal from the polyline, away from the focus
    toScreen(bend(Fb.clone().multiplyScalar(gR)), S0);
    for (let i = 0; i < SIL.length; i++) { const p = SIL[i], a = SIL[(i + SIL.length - 1) % SIL.length], b = SIL[(i + 1) % SIL.length];
      let nx = -(b.y - a.y), ny = b.x - a.x; const l = Math.hypot(nx, ny) || 1; nx /= l; ny /= l; if (nx * (p.x - S0.x) + ny * (p.y - S0.y) < 0) { nx = -nx; ny = -ny; } p.nx = nx; p.ny = ny; } };
  api.update = (dt) => {
    // visiting
    for (const r of REG) if (!visited.has(r.id) && dist(r) < r.rad) { visited.add(r.id); save(); }
    const zoom = cam.D / cam.HOME_D;
    // ---------- hint: nearest unvisited region (by distance to its edge) ----------
    let best = null, bd = Infinity; for (const r of REG) if (!visited.has(r.id)) { const d = dist(r) - r.rad; if (d < bd) { bd = d; best = r; } }
    if (next) { best = next(); bd = best ? dist(best) - best.rad : Infinity; if (best && bd < 0) best = null; } // m-loop: the next region along the walk, not the nearest
    if (hidden()) best = null;
    const want = off || !best ? 0 : INK_OP * (1 - sstep(1.25, 1.55, zoom));   // QA wf (pond @1440: 「海豹湾 · Seal Bay ↓」 read at ~30 % — mid fade-in after the arrival unlock, 62 % far ramp, hairline 400 weight): ONE ink for every label on every board, 86 % #4a4236, Cormorant 500; gone in map zoom
    if (first) { first = false; shown = best; if (shown) plate.textContent = shown.name; op = want; mapK = sstep(1.7, 1.9, zoom); }   // no fade-in on load
    else if (best !== shown) { op = Math.max(0, op - dt * 1.2); if (op === 0) { shown = best; if (shown) plate.textContent = shown.name; } }   // one hint at a time: fade out, then swap
    else op += (want - op) * (1 - Math.exp(-dt * 5));   // QA wf: a 0.6 s dissolve (95 %), was ~2 s, so arrival shots no longer catch it half in
    hint.setAttribute('opacity', op.toFixed(3));
    placeRail();
    if (shown && op > .002) placeHint();
    // ---------- planet map (zoom >= 1.8): each name on the paper just outside the planet's outline, nearest its spot, with a pencil leader ----------
    const mk = sstep(1.7, 1.9, zoom); mapK += (mk - mapK) * (1 - Math.exp(-dt * 4)); map.setAttribute('opacity', mapK.toFixed(3));
    if (mapK > .002) {
      const gR = groundR(), Fb = new THREE.Vector3(BEND.value.x, BEND.value.y, BEND.value.z).normalize(); silhouette(Fb, gR);
      const placed = [], OFF = 28, H = 15, XM = Math.max(24, innerWidth * .1);   // OFF clears the far trees standing on the horizon; XM keeps names off the screen sides
      for (const L of labels) {
        const d = L.r.dir, arc = Fb.angleTo(d), ax = arc > 1e-5 ? new THREE.Vector3().crossVectors(Fb, d).normalize() : new THREE.Vector3(0, 1, 0).cross(Fb).normalize();
        const spot = limb(Fb, ax, arc * R, gR, { x: 0, y: 0, z: 0 });   // full: the spot itself is on the drawn planet; else: where its bearing goes over the horizon
        L.w = L.t.getComputedTextLength?.() || L.r.name.length * 8;
        // the nearest silhouette point whose label box fits on screen and clears the names already placed
        let best = null, bd = Infinity;
        for (const p of SIL) for (let row = 0; row < 3; row++) { const o = OFF + row * 22;   // narrow screens: a name that can't sit beside another steps out one line further on the paper
          const lx = p.x + p.nx * (o + L.w / 2 * Math.abs(p.nx)), ly = p.y + p.ny * (o + H / 2 * Math.abs(p.ny));
          const box = { x0: lx - L.w / 2 - 6, x1: lx + L.w / 2 + 6, y0: ly - H / 2 - 3, y1: ly + H / 2 + 3 };
          if (box.x0 < XM || box.x1 > innerWidth - XM || box.y0 < 16 || box.y1 > innerHeight - 16) continue;
          if (placed.some(q => box.x0 < q.x1 && box.x1 > q.x0 && box.y0 < q.y1 && box.y1 > q.y0)) continue;
          const dd = Math.hypot(p.x - spot.x, p.y - spot.y) + row * 40; if (dd < bd) { bd = dd; best = { p, lx, ly, box }; } }
        const k = (visited.has(L.r.id) ? .95 : .55) * (spot.full ? 1 : .85);   // unvisited fainter; over-the-horizon a little more; floor .30 (.55 x .85 = .47)
        if (!best) { L.g.setAttribute('opacity', 0); continue; }
        placed.push(best.box); L.g.setAttribute('opacity', 1); L.t.setAttribute('opacity', (INK_OP * Math.max(.7, k)).toFixed(3));   // QA wf: the map names share the hint's ink (60–86 %, was 30–100 %)
        L.t.setAttribute('x', best.lx.toFixed(1)); L.t.setAttribute('y', best.ly.toFixed(1));
        // leader: from the label's planet side to the spot, a hand line with a slight bow; stops 2 px short of the dot
        const sx = best.lx - best.p.nx * (L.w / 2 * Math.abs(best.p.nx) + 4), sy = best.ly - best.p.ny * (H / 2 * Math.abs(best.p.ny) + 2);
        // a visible spot is tied directly; one over the horizon is tied to the outline where its bearing goes over (a short mark on the rim, never a line across the land)
        let ex = spot.full ? spot.x : best.p.x, ey = spot.full ? spot.y : best.p.y; const ll = Math.hypot(ex - sx, ey - sy) || 1; ex -= (ex - sx) / ll * 2.5; ey -= (ey - sy) / ll * 2.5;
        const bw = Math.min(6, ll * .04), mx = (sx + ex) / 2 + (ey - sy) / ll * bw, my = (sy + ey) / 2 - (ex - sx) / ll * bw;
        L.lead.setAttribute('d', `M${sx.toFixed(1)},${sy.toFixed(1)} Q${mx.toFixed(1)},${my.toFixed(1)} ${ex.toFixed(1)},${ey.toFixed(1)}`);
        L.dot.setAttribute('cx', (spot.full ? spot.x : best.p.x).toFixed(1)); L.dot.setAttribute('cy', (spot.full ? spot.y : best.p.y).toFixed(1)); L.dot.setAttribute('opacity', spot.full ? .30 : 0);
        L.at = { x: +best.lx.toFixed(0), y: +best.ly.toFixed(0), spot: [+spot.x.toFixed(0), +spot.y.toFixed(0)], full: !!spot.full };
      }
    }
  };
  return api;
}
