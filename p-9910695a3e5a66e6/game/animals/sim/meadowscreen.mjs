// node game/animals/sim/meadowscreen.mjs   (HC=0.281 for the fallback cat; KEEP=0 to skip the r5 board keep-in)
// The meadow flock as the arrival camera sees it at 1440×900 (teleport spawn, camrig initYaw, dioramacam home distance/elevation): per sheep its
// screen x/y, body height and length in px (front-on … side-on, the r4/r4.1 quad sizing), whether it is inside the painted board, left/right of the cat;
// plus the same for the pre-r4 sizing (hedge build: 14 sheep, quad .78·Hc/.281·size) for comparison.
import './stub.mjs';
const L = new URL('../../..', import.meta.url).pathname.replace(/\/$/, '');
const THREE = await import(L + '/shared/vendor/three.module.js');
const cs = await import(L + '/game/catScale.js'); cs.setCatHc(+(process.env.HC || 0.3491), 'sim');
const W = await import(L + '/game/world.js'); const { mulberry } = await import(L + '/artkit/ground.js'); const SH = await import(L + '/game/animals/sheep.js');
const { SHEEP_CAM } = await import(L + '/artkit/dioramacam.js'); const fs = await import('fs');
const src = fs.readFileSync(L + '/game/regions/meadow.js', 'utf8'), END = "throw new Error('meadow: no flock layout'); })();";
const blk = src.slice(src.indexOf('const SPAWN'), src.indexOf(END) + END.length);
const tsrc = fs.readFileSync(L + '/game/props/trees.js', 'utf8'), RIM = eval(tsrc.slice(tsrc.indexOf('export const RIM = ') + 19, tsrc.indexOf('];', tsrc.indexOf('export const RIM = ')) + 1));
const { HOMES, GROUP, SPAWN } = new Function('mulberry', 'meadowU', 'RIM', 'KEEP', blk + '; return { HOMES, GROUP, SPAWN };')(mulberry, W.meadowU, RIM, SH.KEEP);
const CELLS = JSON.parse(fs.readFileSync(L + '/artkit/tex/meta.json', 'utf8')).sheep.cells;
const hc = SH.hcNow(), NSHOW = +(src.match(/const NSHOW = (\d+)/) || [0, 9])[1], ADULT_K = 1.18;
// camera (1440×900: fit() widens the lens to 17.94°, home elev +0.31°), target = cat ground +0.1, yaw = camrig initYaw (board north, cyaw 0)
const up = W.F.dirOf(SPAWN[0], SPAWN[1]), e0 = new THREE.Vector3(0, 1, 0).cross(up).normalize(), yaw = e0.clone().cross(up).negate();
const t = Math.tan(SHEEP_CAM.vfov / 2 * Math.PI / 180), fov = 2 * Math.atan(t * SHEEP_CAM.aspect / 1.6), elev = Math.max(SHEEP_CAM.elev, fov / 2 + SHEEP_CAM.elev - SHEEP_CAM.vfov / 2 * Math.PI / 180);
const D = SHEEP_CAM.dist0 * .45 / SHEEP_CAM.sheepUnits, tg = up.clone().multiplyScalar(W.R + .1);
const cam = new THREE.PerspectiveCamera(fov * 180 / Math.PI, 1.6, .05, 1e4); cam.position.copy(tg).addScaledVector(yaw, -Math.cos(elev) * D).addScaledVector(up, Math.sin(elev) * D); cam.up.copy(up); cam.lookAt(tg); cam.updateMatrixWorld(true);
const X = new THREE.Vector3().setFromMatrixColumn(cam.matrixWorld, 0).normalize();
const px = (p) => { const q = p.clone().project(cam); return [(q.x + 1) * 720, (1 - q.y) * 450]; };
const hcPx = (u, v, h = hc) => { const d = W.F.dirOf(u, v), a = px(d.clone().multiplyScalar(W.R)), b = px(d.clone().multiplyScalar(W.R + h)); return Math.hypot(a[0] - b[0], a[1] - b[1]); };
const lenPx = (u, v, w) => { const d = W.F.dirOf(u, v), p = d.clone().multiplyScalar(W.R), a = px(p.clone().addScaledVector(X, -w / 2)), b = px(p.clone().addScaledVector(X, w / 2)); return Math.hypot(a[0] - b[0], a[1] - b[1]); };
// painted board at arrival: centre target + .75·yaw, hx 3.3 across, hy 4.6 along (board metres)
const B = { on: true, hx: 3.3, hy: 4.6, band: null }; { const c = W.F.toUV(tg.clone().normalize().multiplyScalar(W.R).addScaledVector(yaw, .75)); B.cu = c[0]; B.cv = c[1];
  const y1 = W.F.toUV(up.clone().multiplyScalar(W.R).add(yaw)), x1 = W.F.toUV(up.clone().multiplyScalar(W.R).add(X)); let l = Math.hypot(y1[0] - SPAWN[0], y1[1] - SPAWN[1]); B.Yu = (y1[0] - SPAWN[0]) / l; B.Yv = (y1[1] - SPAWN[1]) / l; l = Math.hypot(x1[0] - SPAWN[0], x1[1] - SPAWN[1]); B.Xu = (x1[0] - SPAWN[0]) / l; B.Xv = (x1[1] - SPAWN[1]) / l; }
const keep = SH.createKeepIn(), useKeep = process.env.KEEP !== '0';
const catX = px(tg)[0]; console.log(`HC ${hc}  cat at px ${px(tg).map(Math.round)}  1 Hc at the cat = ${hcPx(SPAWN[0], SPAWN[1]).toFixed(1)} px  board centre (${B.cu.toFixed(2)},${B.cv.toFixed(2)})  NSHOW ${NSHOW}`);
const rows = []; const sideW = CELLS[1][0].w / CELLS[1][0].h * 1.11, frontW = CELLS[1][2].w / CELLS[1][2].h; // body width / height: side-on (×1.11 r4.1) and front-on cells
for (let i = 0; i < NSHOW; i++){ const H = ADULT_K * hc * 1.06; let [u, v] = HOMES[i], a = 1; if (useKeep){ for (let f = 0; f < 60; f++) [u, v, a] = keep.apply(i, HOMES[i][0], HOMES[i][1], H, B, 1 / 60, hc, SH.lcNow()); }
  const [sx, sy] = px(W.F.dirOf(u, v).multiplyScalar(W.R)), hp = hcPx(u, v, H), bx = keep.toB(u, v, B), on = sx > 0 && sx < 1440 && sy > 0 && sy < 900;
  rows.push({ i, flock: GROUP[i], uv: [+u.toFixed(2), +v.toFixed(2)], moved: +Math.hypot(u - HOMES[i][0], v - HOMES[i][1]).toFixed(3), alpha: +a.toFixed(2), px: [Math.round(sx), Math.round(sy)], side: sx < catX ? 'L' : 'R', onScreen: on, board: bx.map(q => +q.toFixed(2)),
    hPx: +hp.toFixed(0), lenPx: [+lenPx(u, v, H * frontW).toFixed(0), +lenPx(u, v, H * sideW).toFixed(0)] }); }
for (const r of rows) console.log(JSON.stringify(r));
const L2 = rows.filter(r => r.onScreen); console.log(`r4 now: ${L2.length} adults on screen (+ lamb) — left ${L2.filter(r => r.side === 'L').length} / right ${L2.filter(r => r.side === 'R').length}; length px front…side ${Math.min(...L2.map(r => r.lenPx[0]))}…${Math.max(...L2.map(r => r.lenPx[1]))}; body h px ${Math.min(...L2.map(r => r.hPx))}…${Math.max(...L2.map(r => r.hPx))}; max keep move ${Math.max(...rows.map(r => r.moved))} m, min alpha ${Math.min(...rows.map(r => r.alpha))}`);
// pre-r4 (hedge build 5ac1ba8): quad k = .78·(Hc/.281)·size, body h = k·cell h, side stretch 1 + .2·|fwd·X|
{ const ctr = (cell) => cell.h; const k = .78 * hc / .281 * 1.12, hS = k * CELLS[1][0].h, wS = k * CELLS[1][0].w * 1.2, wF = k * CELLS[1][2].w;
  console.log(`pre-r4 sizing at the cat's depth: body h ${(hS / hc).toFixed(2)} Hc, length front…side ${(wF / hc).toFixed(2)}…${(wS / hc).toFixed(2)} Hc = ${lenPx(SPAWN[0], SPAWN[1], wF).toFixed(0)}…${lenPx(SPAWN[0], SPAWN[1], wS).toFixed(0)} px;  r4.1: body h ${(ADULT_K * 1.06).toFixed(2)} Hc, length ${(ADULT_K * 1.06 * frontW).toFixed(2)}…${(ADULT_K * 1.06 * sideW).toFixed(2)} Hc = ${lenPx(SPAWN[0], SPAWN[1], ADULT_K * hc * 1.06 * frontW).toFixed(0)}…${lenPx(SPAWN[0], SPAWN[1], ADULT_K * hc * 1.06 * sideW).toFixed(0)} px`); }
