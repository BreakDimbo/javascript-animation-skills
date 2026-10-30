// m-loop: the 390 portrait follow camera (visual director, 16:24). Narrow portrait screens only (aspect < .8); desktop untouched.
// It's a pure crop of the diorama camera's own frame (camera.setViewOffset), so tilt, azimuth, perspective and lighting stay
// exactly the ones the board was composed for. No shake, no blur: just a smaller window that eases in and pans with the cat.
//   - starts on the full-board title view; after begin() it eases (smoothstep, 1.35 s) to the follow window
//   - follow window = FW of the board's on-screen width (default .6; ?fw=.55…65), raised if the cat would be under CAT_MIN px tall
//   - the window pans with the cat (critically damped, ~.35 s) and is clamped so it never leaves the board's on-screen box
//   - debug: ?fw=.55 (window), ?pcamk (no ease), ?nofollow (old full-board view)
//   - off in planet mode (finale / map), ?close, ?nofollow
import * as THREE from '../../shared/vendor/three.module.js';
import { BEND } from '../../artkit/bend.js';

export function createPortraitCam({ camera, fcam, cat, qs, R }){
  const FW = Math.min(.65, Math.max(.45, +(qs.get('fw') ?? .6))), CAT_MIN = 26, EASE = 1.35, off = qs.has('nofollow') || qs.has('close');
  let k = 0, t0 = -1, on = false, sx = null, sy = null, Zs = 1; const v = new THREE.Vector3(), F_ = new THREE.Vector3(), box = new THREE.Box3();
  const stats = { active: false, z: 1, visibleFrac: 1, catPx: 0, board: null };
  const bend = (w) => { const b = BEND.value.w; if (!b) return w; F_.set(BEND.value.x, BEND.value.y, BEND.value.z); const s = R * v.copy(w).normalize().sub(F_).length(); return w.addScaledVector(F_, -s * s * b); };
  const scr = (w) => { const p = w.clone().project(camera); return [(p.x * .5 + .5) * innerWidth, (-p.y * .5 + .5) * innerHeight]; };
  function boardBox(){ const B = fcam.board, gR = fcam.target.length() - .1; let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
    for (const [a, b] of [[1, 1], [1, -1], [-1, -1], [-1, 1], [0, 1], [0, -1], [1, 0], [-1, 0]]){
      const w = new THREE.Vector3().copy(B.F).multiplyScalar(R).addScaledVector(B.X, a * B.hx).addScaledVector(B.Y, b * B.hy).setLength(gR);
      const [x, y] = scr(bend(w)); x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
    return { x0, x1, y0, y1 }; }
  // the cat's on-screen height: its ground point to a point CAT_H up (the clay cat's ear height at the game's 1.25 scale)
  const CAT_H = .36; function catBox(){ const p0 = scr(cat.pos), p1 = scr(cat.pos.clone().addScaledVector(cat.up, CAT_H)); return { h: Math.abs(p0[1] - p1[1]), cx: p0[0], cy: (p0[1] + p1[1]) / 2 }; }
  return {
    stats,
    begin(){ on = true; t0 = -1; },
    // call after the diorama camera + portraitLens have set the base pose, before render
    update(dt, T, planet){
      const portrait = innerWidth / innerHeight < .8 && !off;
      if (camera.view && camera.view.enabled) camera.clearViewOffset();   // measure on the base (full) frame
      if (!portrait || planet > .01){ stats.active = false; return; }
      if (on && t0 < 0) t0 = T; const e = on ? (qs.has('pcamk') ? 1 : Math.min(1, (T - t0) / EASE)) : 0; k = e * e * (3 - 2 * e);   // ?pcamk: skip the ease (headless shots run at a few fps)
      const W = innerWidth, H = innerHeight, bb = boardBox(), cb = catBox(), bw = Math.max(1, bb.x1 - bb.x0);
      let Z = W / (FW * bw); if (cb.h > 0 && cb.h * Z < CAT_MIN) Z = Math.min(W / (.55 * bw), CAT_MIN / cb.h);   // visible = W / (bw·Z); never tighter than 55% of the board
      Z = Math.max(1, Math.min(2.6, Z)); const Ze = 1 + (Z - 1) * k;
      if (sx === null){ sx = cb.cx; sy = cb.cy; } const a = 1 - Math.exp(-dt / .35); sx += (cb.cx - sx) * a; sy += (cb.cy - sy) * a;
      // window (in full-frame px) centred on the cat (a little above centre: the cat sits at ~55% height), clamped to the board box
      const fx = W * Ze, fy = H * Ze; let ox = sx * Ze - W / 2, oy = sy * Ze - H * .55;
      const bx0 = bb.x0 * Ze, bx1 = bb.x1 * Ze, by0 = bb.y0 * Ze, by1 = bb.y1 * Ze;
      ox = bx1 - bx0 > W ? Math.min(bx1 - W, Math.max(bx0, ox)) : (bx0 + bx1) / 2 - W / 2;
      oy = by1 - by0 > H ? Math.min(by1 - H, Math.max(by0, oy)) : (by0 + by1) / 2 - H / 2 + H * .04;
      const cx0 = (Ze - 1) * W / 2, cy0 = (Ze - 1) * H / 2; ox = cx0 + (ox - cx0) * k; oy = cy0 + (oy - cy0) * k;   // full view ↔ follow
      ox = Math.min(fx - W, Math.max(0, ox)); oy = Math.min(fy - H, Math.max(0, oy));
      if (Ze > 1.0005) camera.setViewOffset(fx, fy, ox, oy, W, H);
      Object.assign(stats, { active: Ze > 1.0005, z: +Ze.toFixed(3), visibleFrac: +(W / (bw * Ze)).toFixed(3), catPx: +(cb.h * Ze).toFixed(1), board: [bb.x0, bb.x1, bb.y0, bb.y1].map(x => Math.round(x)) });
    },
  };
}
