// m-loop: the 390 portrait follow camera (visual director, 16:24). Narrow portrait screens only (aspect < .8); desktop untouched.
// It's a pure crop of the diorama camera's own frame (camera.setViewOffset), so tilt, azimuth, perspective and lighting stay
// exactly the ones the board was composed for. No shake, no blur: just a smaller window that eases in and pans with the cat.
//   - starts on the full-board title view; after begin() it eases (smoothstep, 1.35 s) to the follow window
//   - VD 17:15: the cat is 26 px tall at the live CAT_HC (wins); visible width 48–50% of the board, never below 45%
//   - pond: visible 42–45%; within 3 Hc of the waterline the centre eases (0.8 s) 10% of the screen height toward the water
//   - the window pans with the cat (exponential, ~.35 s); sides clamped inside the board, top/bottom may leave the frame
//     (the board only has to cover the band between the region card, while shown, and the wayfinding line)
//   - debug: ?fw=.49 (base visible fraction), ?pcamk (no ease), ?nofollow (old full-board view)
//   - off in planet mode (finale / map), ?close, ?nofollow
import * as THREE from '../../shared/vendor/three.module.js';
import { BEND } from '../../artkit/bend.js';
import { REG, PS, pondLocal } from '../world.js';
import { pondSD } from '../../b3-pond/pond.js';
import { CAT_HC, CAT_HC_SRC, onCatHc } from '../catScale.js';

export function createPortraitCam({ camera, fcam, cat, qs, R }){
  const FW = Math.min(.5, Math.max(.45, +(qs.get('fw') ?? .5))), VMIN = .45, POND_V = .435, CAT_MIN = 26, EASE = 1.35, PE = .8, off = qs.has('nofollow') || qs.has('close');
  let k = 0, t0 = -1, on = false, sx = null, sy = null, pw = 0, ww = 0, oys = null; const pondDir = REG[1].dir, pondA = pondDir.clone().multiplyScalar(R);
  const ramp = (x, tgt, dt) => qs.has('pcamk') ? tgt : x + Math.max(-dt / PE, Math.min(dt / PE, tgt - x)), sm = (x) => x * x * (3 - 2 * x);   // 0.8 s linear ramp, smoothstepped
  const v = new THREE.Vector3(), F_ = new THREE.Vector3(), box = new THREE.Box3(), _p = new THREE.Vector3(), _w = new THREE.Vector3(), _c = new THREE.Vector3();   // perf: per-frame scratch
  const CORNERS = [[1, 1], [1, -1], [-1, -1], [-1, 1], [0, 1], [0, -1], [1, 0], [-1, 0]];
  const stats = { active: false, z: 1, visibleFrac: 1, catPx: 0, board: null, pond: 0, shore: 0, waterM: null };
  // metres from the cat to the pond's waterline (the pond module is shrunk by PS about its anchor)
  const waterDist = (p) => { const x = v.copy(p).sub(pondA).multiplyScalar(1 / PS).add(pondA).normalize(); const [a, b] = pondLocal(x); return pondSD(a, b) * PS; };
  const bend = (w) => { const b = BEND.value.w; if (!b) return w; F_.set(BEND.value.x, BEND.value.y, BEND.value.z); const s = R * v.copy(w).normalize().sub(F_).length(); return w.addScaledVector(F_, -s * s * b); };
  const scr = (w) => { const p = _p.copy(w).project(camera); return [(p.x * .5 + .5) * innerWidth, (-p.y * .5 + .5) * innerHeight]; };
  function boardBox(){ const B = fcam.board, gR = fcam.target.length() - .1; let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
    for (const [a, b] of CORNERS){
      const w = _w.copy(B.F).multiplyScalar(R).addScaledVector(B.X, a * B.hx).addScaledVector(B.Y, b * B.hy).setLength(gR);
      const [x, y] = scr(bend(w)); x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
    return { x0, x1, y0, y1 }; }
  // the cat's on-screen height: its ground point to a point Hc up. Hc is the live CAT_HC (game/catScale.js: 0.281 fallback until
  // artkit/cat.js measures the loaded glb, 0.349 for a7); re-read on every setCatHc, so 26 px always means the cat the game shows
  let CAT_H = CAT_HC, CAT_SRC = CAT_HC_SRC; onCatHc((h, src) => { CAT_H = h; CAT_SRC = src; }); function catBox(){ const p0 = scr(cat.pos), p1 = scr(_c.copy(cat.pos).addScaledVector(cat.up, CAT_H)); return { h: Math.abs(p0[1] - p1[1]), cx: p0[0], cy: (p0[1] + p1[1]) / 2 }; }
  return {
    stats,
    begin(){ on = true; t0 = -1; sx = null; },
    // call after the diorama camera + portraitLens have set the base pose, before render
    update(dt, T, planet){
      const portrait = innerWidth / innerHeight < .8 && !off;
      if (camera.view && camera.view.enabled) camera.clearViewOffset();   // measure on the base (full) frame
      if (!portrait || planet > .01){ stats.active = false; return; }
      if (on && t0 < 0) t0 = T; const e = on ? (qs.has('pcamk') ? 1 : Math.min(1, (T - t0) / EASE)) : 0; k = e * e * (3 - 2 * e);   // ?pcamk: skip the ease (headless shots run at a few fps)
      const W = innerWidth, H = innerHeight, bb = boardBox(), cb = catBox(), bw = Math.max(1, bb.x1 - bb.x0);
      // zoom: the cat at 26 px, inside 45–50% visible; the pond tightens to 43.5% (both eased over 0.8 s)
      const inPond = cat.up.angleTo(pondDir) * R < REG[1].rad; pw = ramp(pw, inPond ? 1 : 0, dt);
      const wm = inPond || pw > 0 ? waterDist(cat.pos) : 1e9, nearW = wm < 3 * CAT_H; ww = ramp(ww, nearW ? 1 : 0, dt);
      const Zv = (f) => W / (f * bw), Zc = cb.h > 0 ? CAT_MIN / cb.h : Zv(FW);
      let Z = Math.min(Zv(VMIN), Math.max(Zv(FW), Zc)); Z = Z + (Math.min(Zv(.42), Math.max(Zv(POND_V), Z)) - Z) * sm(pw);
      Z = Math.max(1, Math.min(2.8, Z)); const Ze = 1 + (Z - 1) * k;
      if (sx === null || Math.hypot(cb.cx - sx, cb.cy - sy) > W * .25){ sx = cb.cx; sy = cb.cy; oys = null; }   // snap on begin / teleports
      else { const a = 1 - Math.exp(-dt / .35); sx += (cb.cx - sx) * a; sy += (cb.cy - sy) * a; }
      // near the water: the centre moves 10% of the screen height toward the pond (screen direction cat → pond centre)
      let dx = 0, dy = 0; if (ww > 0){ const pc = scr(bend(_c.copy(pondA).setLength(fcam.target.length() - .1))), L = Math.hypot(pc[0] - cb.cx, pc[1] - cb.cy) || 1;
        dx = (pc[0] - cb.cx) / L * .1 * H * sm(ww); dy = (pc[1] - cb.cy) / L * .1 * H * sm(ww); }
      // window (in full-frame px) centred on the cat (a little above centre: the cat sits at ~55% height)
      const fx = W * Ze, fy = H * Ze; let ox = sx * Ze + dx - W / 2, oy = sy * Ze + dy - H * .55;
      const iw = (bb.x1 - bb.x0) * .045, ih = (bb.y1 - bb.y0) * .03;   // inset: the ragged rim is inside the board box
      const bx0 = (bb.x0 + iw) * Ze, bx1 = (bb.x1 - iw) * Ze, by0 = (bb.y0 + ih) * Ze, by1 = (bb.y1 - ih) * Ze;
      ox = bx1 - bx0 > W ? Math.min(bx1 - W, Math.max(bx0, ox)) : (bx0 + bx1) / 2 - W / 2;
      // vertical: the board covers the band [card bottom (while the card shows; else the screen top) … H − 44 px] and may leave the frame past it
      const cd = document.getElementById('card'), cardOn = cd && +(cd.style.opacity || 0) > .05, top = cardOn ? cd.getBoundingClientRect().bottom + 10 : 0, bot = H - 44;
      const A = by0 - top, B = by1 - bot;   // oy = A: the board's top edge on the band's top; oy = B: its bottom edge on the band's bottom
      if (B >= A) oy = cardOn ? A : Math.min(B, Math.max(A, oy));   // taller than the band: cover it (edges may leave the frame), but never slide under the card
      else oy = Math.min(A, Math.max(B, oy));                       // shorter: follow the cat inside the band
      if (oys === null || k < 1) oys = oy; else oys += (oy - oys) * (1 - Math.exp(-dt / .5)); oy = oys;   // the card fading out = a slow pan, never a jump
      const cx0 = (Ze - 1) * W / 2, cy0 = (Ze - 1) * H / 2; ox = cx0 + (ox - cx0) * k; oy = cy0 + (oy - cy0) * k;   // full view ↔ follow
      ox = Math.min(fx - W, Math.max(0, ox)); oy = Math.min(fy - H, Math.max(0, oy));
      if (Ze > 1.0005) camera.setViewOffset(fx, fy, ox, oy, W, H);
      Object.assign(stats, { active: Ze > 1.0005, z: +Ze.toFixed(3), visibleFrac: +(W / (bw * Ze)).toFixed(3), catPx: +(cb.h * Ze).toFixed(1), board: [bb.x0, bb.x1, bb.y0, bb.y1].map(x => Math.round(x)), pond: +pw.toFixed(2), shore: +ww.toFixed(2), waterM: wm < 1e8 ? +wm.toFixed(2) : null, hc: +CAT_H.toFixed(3), hcSrc: CAT_SRC });
    },
  };
}
