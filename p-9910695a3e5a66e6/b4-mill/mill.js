// 03 风车磨坊丘 — windmill hill region for 褶星 Fold. Matte clay + gouache, no glow.
import * as THREE from '../shared/vendor/three.module.js';
import { clayMaterial } from '../artkit/clay.js';

const HILL_H = 4.5, HILL_S = 48, PATCH = 220;          // metres
const PATH_R = (t) => 40 + 4 * Math.sin(3 * t) + 2 * Math.sin(5 * t + 1);
function mulberry(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
const C = { planet:'#8c9b5c', grass:'#93a35e', grassLt:'#a9b66f', grassDk:'#6f8248', path:'#c8b48c', wheat:['#d8b862','#c9a04c','#e2c983','#bb9550'],
  clay:'#e2c9a4', clayDk:'#b8916a', roof:'#985d47', wood:'#7d5638', sail:'#efe6d2', sack:'#e6dcc6', sackDk:'#cdbfa3',
  donkey:'#8f8b86', donkeyDk:'#5e5a57', muzzle:'#d9d3c8', wool:'#ece4d2', mouse:'#b98a5a' };
const lam = (c, extra = {}) => new THREE.MeshLambertMaterial({ color: c, ...extra });
// hand-painted clay: soft gouache strokes + paper grain, tinted by material colour
let _clayTex = null;
function clayTex(){ if (_clayTex) return _clayTex; const cv = document.createElement('canvas'); cv.width = cv.height = 256; const g = cv.getContext('2d'), r = mulberry(7);
  g.fillStyle = '#f2ece2'; g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 140; i++){ g.globalAlpha = .05 + r() * .07; g.fillStyle = r() < .5 ? '#c9b499' : '#fffaf0'; g.beginPath(); g.ellipse(r() * 256, r() * 256, 10 + r() * 30, 3 + r() * 6, (r() - .5) * .5, 0, 7); g.fill(); }
  const id = g.getImageData(0, 0, 256, 256), d = id.data; for (let i = 0; i < d.length; i += 4){ const n = (r() - .5) * 16; d[i] += n; d[i + 1] += n; d[i + 2] += n; } g.putImageData(id, 0, 0);
  _clayTex = new THREE.CanvasTexture(cv); _clayTex.colorSpace = THREE.SRGBColorSpace; _clayTex.wrapS = _clayTex.wrapT = THREE.RepeatWrapping; return _clayTex; }
const clay = (c) => lam(c, { map: clayTex() });

export function createMill(scene, planet, centerDir){
  const R = planet.R, rand = mulberry(303);
  const c = centerDir.clone().normalize();
  const t1 = new THREE.Vector3(0, 1, 0).cross(c); if (t1.lengthSq() < 1e-4) t1.set(1, 0, 0).cross(c); t1.normalize();
  const t2 = t1.clone().cross(c).normalize();   // (t1, c, t2) right-handed
  const group = new THREE.Group(); scene.add(group);

  const hill = (x, z) => HILL_H * Math.exp(-(x * x + z * z) / (2 * HILL_S * HILL_S));
  const dirOf = (x, z) => c.clone().multiplyScalar(R).addScaledVector(t1, x).addScaledVector(t2, z).normalize();
  const toLocal = (p) => { const d = p.clone().normalize(), k = d.dot(c); return k > 0 ? [R * d.dot(t1) / k, R * d.dot(t2) / k] : [1e9, 1e9]; };
  const heightAtLocal = (x, z) => { return hill(x, z); };
  const heightAt = (p) => { const [x, z] = toLocal(p); return Math.hypot(x, z) > PATCH * .5 ? 0 : heightAtLocal(x, z); };
  const surf = (x, z, lift = 0) => dirOf(x, z).multiplyScalar(R + heightAtLocal(x, z) + lift);
  const frame = (obj, x, z, yaw = 0, lift = 0) => {
    const up = dirOf(x, z); const f = t2.clone().addScaledVector(up, -t2.dot(up)).normalize(); const rt = up.clone().cross(f);
    obj.position.copy(surf(x, z, lift)); obj.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(rt, up, f));
    obj.rotateY(yaw); return obj; };

  // ---------- painted ground patch ----------
  const TW = 2048, cv = document.createElement('canvas'); cv.width = cv.height = TW; const g = cv.getContext('2d');
  const px = (x) => (x / PATCH + .5) * TW;
  g.fillStyle = C.grass; g.fillRect(0, 0, TW, TW);
  g.filter = 'blur(28px)';
  for (let i = 0; i < 26; i++){ g.fillStyle = rand() < .5 ? C.grassLt : C.grassDk; g.globalAlpha = .35; g.beginPath(); g.ellipse(rand() * TW, rand() * TW, 60 + rand() * 180, 40 + rand() * 120, rand() * 3, 0, 7); g.fill(); }
  g.globalAlpha = .55; const hg = g.createRadialGradient(TW/2, TW/2, 0, TW/2, TW/2, px(30) - TW/2); hg.addColorStop(0, C.grassLt); hg.addColorStop(1, 'rgba(169,182,111,0)'); g.fillStyle = hg; g.fillRect(0, 0, TW, TW);
  g.globalAlpha = 1;
  // wheat field: gouache bands (sector east of the mill)
  const wheatIn = (x, z) => { const r = Math.hypot(x, z), a = Math.atan2(z, x); return r > 13 && r < 34 && a > -0.9 && a < 1.0; };
  g.filter = 'blur(4px)';
  for (let b = 0; b < 12; b++){ g.fillStyle = C.wheat[b % 4]; g.beginPath();
    const r0 = 13 + b * 21 / 12, r1 = r0 + 21 / 12 + .2;
    for (let a = -0.9; a <= 1.0; a += .02) g.lineTo(px(r0 * Math.cos(a)), px(r0 * Math.sin(a)));
    for (let a = 1.0; a >= -0.9; a -= .02) g.lineTo(px(r1 * Math.cos(a)), px(r1 * Math.sin(a)));
    g.fill(); }
  // dirt loop path
  g.filter = 'blur(3px)'; g.strokeStyle = C.path; g.lineWidth = 2.2 / PATCH * TW; g.lineCap = 'round'; g.beginPath();
  for (let t = 0; t <= Math.PI * 2 + .01; t += .01){ const r = PATH_R(t); g.lineTo(px(r * Math.cos(t)), px(r * Math.sin(t))); } g.stroke();
  // little track up to the mill
  g.lineWidth = 1.4 / PATCH * TW; g.beginPath(); g.moveTo(px(0), px(-3)); g.quadraticCurveTo(px(-12), px(-20), px(0), px(-PATH_R(-Math.PI/2) )); g.stroke();
  g.filter = 'none';
  // pencil-tick grass + few flowers
  for (let i = 0; i < 26000; i++){ const x = rand() * TW, y = rand() * TW; const lx = (x / TW - .5) * PATCH, lz = (y / TW - .5) * PATCH;
    const inW = wheatIn(lx, lz); g.strokeStyle = inW ? `rgba(120,85,35,${.12 + rand() * .15})` : (rand() < .6 ? `rgba(55,80,30,${.15 + rand() * .2})` : `rgba(210,225,160,${.15 + rand() * .2})`);
    g.lineWidth = 1.3; g.beginPath(); g.moveTo(x, y); g.lineTo(x + (rand() - .5) * 3, y - 4 - rand() * 5); g.stroke(); }
  for (let i = 0; i < 900; i++){ const x = rand() * TW, y = rand() * TW; if (wheatIn((x / TW - .5) * PATCH, (y / TW - .5) * PATCH)) continue;
    g.fillStyle = rand() < .7 ? '#f3ecd8' : '#e2b85a'; g.beginPath(); g.arc(x, y, 1.5 + rand() * 1.5, 0, 7); g.fill(); }
  // dithered paper-bleed edge into planet colour
  const img = g.getImageData(0, 0, TW, TW), d = img.data, pc = new THREE.Color(C.planet);
  const PR = [pc.r * 255, pc.g * 255, pc.b * 255].map(v => Math.round(Math.pow(v / 255, 1 / 2.2) * 255));
  const pcs = new THREE.Color(C.planet); const PS = [Math.round(pcs.r*255), Math.round(pcs.g*255), Math.round(pcs.b*255)];
  for (let y = 0; y < TW; y += 1) for (let x = 0; x < TW; x += 1){ const r = Math.hypot(x - TW/2, y - TW/2) / (TW / 2);
    if (r < .72) continue; let k = THREE.MathUtils.smoothstep(r, .72, .97); k += (rand() - .5) * .35; if (k < .5) continue;
    const i = (y * TW + x) * 4; d[i] = PS[0]; d[i+1] = PS[1]; d[i+2] = PS[2]; }
  void PR; g.putImageData(img, 0, 0);
  const gtex = new THREE.CanvasTexture(cv); gtex.colorSpace = THREE.SRGBColorSpace; gtex.anisotropy = 8;
  const pg = new THREE.PlaneGeometry(PATCH, PATCH, 160, 160); pg.rotateX(-Math.PI / 2);
  const pp = pg.attributes.position;
  for (let i = 0; i < pp.count; i++){ const x = pp.getX(i), z = pp.getZ(i); const r = Math.hypot(x, z); const v = r > PATCH * .5 ? dirOf(x, z).multiplyScalar(R + .02) : surf(x, z, .03); pp.setXYZ(i, v.x, v.y, v.z); }
  // UV: after rotateX, v = .5 - z/PATCH, and flipY puts canvas row 0 at v=1 -> canvas y == +z
  pg.computeVertexNormals();
  // round 3: tiled pencil-tick + paper-grain detail (multiplied, ~0.9 m tile) so the ground near the low camera stays hand-painted
  const dc = document.createElement('canvas'); dc.width = dc.height = 256; const dg = dc.getContext('2d');
  dg.fillStyle = '#fff'; dg.fillRect(0, 0, 256, 256);
  for (let k = 0; k < 2600; k++){ const v = 228 + Math.random() * 27 | 0; dg.fillStyle = `rgb(${v},${v},${v - 4})`; dg.fillRect(Math.random() * 256, Math.random() * 256, 1.5, 1.5); }
  dg.lineCap = 'round';
  for (let k = 0; k < 520; k++){ const x = Math.random() * 256, y = Math.random() * 256, l = 3 + Math.random() * 7, a = -Math.PI / 2 + (Math.random() - .5) * .9;
    const v = 150 + Math.random() * 60 | 0; dg.strokeStyle = `rgba(${v - 10},${v},${v - 40},${.35 + Math.random() * .35})`; dg.lineWidth = .8 + Math.random() * .7;
    for (const ox of [-256, 0, 256]) for (const oy of [-256, 0, 256]){ dg.beginPath(); dg.moveTo(x + ox, y + oy); dg.lineTo(x + ox + Math.cos(a) * l, y + oy + Math.sin(a) * l); dg.stroke(); } }
  const dtex = new THREE.CanvasTexture(dc); dtex.wrapS = dtex.wrapT = THREE.RepeatWrapping; dtex.anisotropy = 8;
  const gmat = lam(0xffffff, { map: gtex });
  gmat.onBeforeCompile = (sh) => { sh.uniforms.uDetail = { value: dtex };
    sh.fragmentShader = 'uniform sampler2D uDetail;\n' + sh.fragmentShader.replace('#include <map_fragment>',
      '#include <map_fragment>\n  { vec3 dt = texture2D(uDetail, vMapUv * 240.0).rgb; vec3 dt2 = texture2D(uDetail, vMapUv * 61.0 + .37).rgb; diffuseColor.rgb *= mix(vec3(1.0), dt * dt2, .85); }'); };
  const ground = new THREE.Mesh(pg, gmat); group.add(ground);

  // ---------- windmill ----------
  const mill = new THREE.Group(); frame(mill, 0, 0, 0.4, -0.3); group.add(mill);
  const tower = new THREE.Mesh(new THREE.CylinderGeometry(1.7, 2.6, 8.5, 18, 4), clay(C.clay)); tower.position.y = 4.25; mill.add(tower);
  const band = new THREE.Mesh(new THREE.CylinderGeometry(2.0, 2.0, .35, 18), clay(C.clayDk)); band.position.y = 5.6; mill.add(band);
  const cap = new THREE.Mesh(new THREE.ConeGeometry(2.1, 2.4, 18), clay(C.roof)); cap.position.y = 9.7; cap.scale.z = 1.15; mill.add(cap);
  const door = new THREE.Mesh(new THREE.BoxGeometry(1, 1.8, .3), lam(C.wood)); door.position.set(0, .9, 2.45); mill.add(door);
  for (const [y, a] of [[3.4, .3], [6.6, -.5]]){ const w = new THREE.Mesh(new THREE.BoxGeometry(.5, .6, .2), lam('#4b4038')); w.position.set(Math.sin(a) * 2.1, y, Math.cos(a) * 2.1); w.lookAt(0, y, 0); mill.add(w); }
  const hub = new THREE.Group(); hub.position.set(0, 8.2, 2.2); mill.add(hub);
  hub.add(new THREE.Mesh(new THREE.CylinderGeometry(.3, .3, .9, 10).rotateX(Math.PI / 2), lam(C.wood)));
  const sails = new THREE.Group(); sails.position.z = .5; hub.add(sails);
  for (let k = 0; k < 4; k++){ const arm = new THREE.Group(); arm.rotation.z = k * Math.PI / 2; sails.add(arm);
    const spar = new THREE.Mesh(new THREE.BoxGeometry(.16, 6.4, .16), lam(C.wood)); spar.position.y = 3.2; arm.add(spar);
    const cloth = new THREE.Mesh(new THREE.BoxGeometry(1.25, 4.6, .05), lam(C.sail)); cloth.position.set(.72, 3.9, 0); arm.add(cloth);
    for (let j = 0; j < 6; j++){ const lat = new THREE.Mesh(new THREE.BoxGeometry(1.4, .06, .09), lam(C.wood)); lat.position.set(.72, 1.8 + j * .85, .05); arm.add(lat); } }

  // ---------- mill house ----------
  const HX = -10, HZ = 3;
  const house = new THREE.Group(); frame(house, HX, HZ, -0.5, -0.2); group.add(house);
  const walls = new THREE.Mesh(new THREE.BoxGeometry(5, 3, 4), clay(C.clay)); walls.position.y = 1.5; house.add(walls);
  const roofG = new THREE.CylinderGeometry(2.9, 2.9, 5.4, 3, 1); roofG.rotateZ(Math.PI / 2); roofG.rotateX(Math.PI / 6);
  const roof = new THREE.Mesh(roofG, clay(C.roof)); roof.position.y = 3.0 + 1.45 * .5; roof.scale.set(1, .7, .8); house.add(roof);
  const hdoor = new THREE.Mesh(new THREE.BoxGeometry(1, 1.9, .2), lam(C.wood)); hdoor.position.set(.8, .95, 2.02); house.add(hdoor);
  const win = new THREE.Mesh(new THREE.BoxGeometry(.8, .7, .2), lam('#4b4038')); win.position.set(-1.2, 1.8, 2.02); house.add(win);
  const chim = new THREE.Mesh(new THREE.BoxGeometry(.6, 1.4, .6), clay(C.clayDk)); chim.position.set(-1.6, 4.1, -.6); house.add(chim);

  // ---------- burlap sacks with a dormouse gap ----------
  /* VD mvp-gate §6 (was 8 upright cream ellipsoids that read as a clutch of eggs): 5 flat burlap sacks lying down, stacked 3-2, #cbb489 with the
     tie #a88e62. clayMaterial is used directly so reskin() keeps the exact hexes (its palette remap would turn them into #ddc48f / #976d4d).
     1 Hc = .3491 board m = 2.909 b4 m (MS .12): length 1.65 = .567 Hc, cross-section 1.0 wide x .6 high (h:w .60), tie tuft .265 above the sack = .091 Hc.
     Same anchor, frame and centre (x .05) as before; sacks-local box old x -1.98..1.98, z -.98..+.48, top 1.50 -> now x -1.44..1.54, z -1.23..+.59,
     top 1.31 (narrower, .35 deeper because one sack is 1.65 long). millyard.js reads the meshes for the hens' screen hull; its SACKS circles and
     mouse SIDES are hard-coded to the old pile (see the gate-fix report). Side vs top: geometry normals tipped up by .11 so the camera-side flank sits
     ~13.4 % under the top in the arrival light (raw normals ~16.7 %; the thin +z end ~31 %, 4 % of the visible area); Lambert only, no highlight, no outline. */
  const SL = 1.65, SW = 1.0, SH = .8, TIP = .11;   // SH = sphere half-axes x2; the flat underside (x.55) + sag leave a real height of .60
  const sg = (v, e) => Math.sign(v) * Math.pow(Math.abs(v), e);
  const pillow = (z) => 1 - .45 * Math.pow(Math.abs(z), 6);              // ends pinch thin like a sewn / gathered sack
  const sackG = new THREE.SphereGeometry(1, 28, 18).rotateX(Math.PI / 2).rotateZ(Math.PI / 2);   // poles on the long axis, uv seam underneath
  { const p = sackG.attributes.position;
    for (let i = 0; i < p.count; i++){ const X = sg(p.getX(i), .55), Z = sg(p.getZ(i), .4); let Y = sg(p.getY(i), .75) * pillow(Z);
      if (Y < 0) Y *= .55; else Y *= 1 - .05 * (1 - Z * Z);                 // flat underside, the filling sags a touch mid-length
      p.setXYZ(i, X * SW * .5 * (1 - .12 * Math.pow(Math.abs(Z), 6)), Y * SH * .5, Z * SL * .5); }
    sackG.computeVertexNormals(); const n = sackG.attributes.normal;
    for (let i = 0; i < n.count; i++){ const v = new THREE.Vector3(n.getX(i), n.getY(i) + TIP, n.getZ(i)).normalize(); n.setXYZ(i, v.x, v.y, v.z); } }
  const SBOT = SH * .5 * .55;                                              // centre height of a sack resting on the ground
  const topAt = (zl) => { const Z = Math.min(.999, Math.abs(zl) / (SL * .5)); const sn = Math.pow(Z, 2.5);   // top surface height above the sack centre
    return Math.pow(Math.sqrt(1 - sn * sn), .75) * pillow(Z) * (1 - .05 * (1 - Z * Z)) * SH * .5; };
  const sackM = clayMaterial({ color: '#cbb489', grain: 8, grainAmt: .18 }), tieM = clayMaterial({ color: '#a88e62', grain: 8, grainAmt: .14 });
  const tieG = new THREE.CylinderGeometry(.085, .045, .3, 7).translate(0, .15, 0);   // gathered neck flaring into a little tuft
  const sacks = new THREE.Group(); const SX = -2.2, SZ = 9.6; frame(sacks, SX, SZ, -0.5); group.add(sacks);
  const PX = .05, PZ = -.27;
  // [x, y, z, tuft at +1/-1 end]; bottom row of 3 side by side, 2 on top nested in the grooves (top pair set back .1 so the bottom necks show)
  const sackLay = [[PX - .98, SBOT, PZ, 1], [PX, SBOT, PZ, 1], [PX + .98, SBOT, PZ, 1], [PX - .49, SBOT + .5, PZ - .1, 1], [PX + .49, SBOT + .5, PZ - .1, -1]];
  const rr = Array.from({ length: 32 }, rand);                            // old pile drew 32 rand(); keep the stream so the wheat etc. stay put
  sackLay.forEach(([x, y, z, e], i) => { const yaw = (rr[i * 4] - .5) * .1, roll = (rr[i * 4 + 1] - .5) * .06, dz = (rr[i * 4 + 2] - .5) * .06;
    const s = new THREE.Mesh(sackG, sackM); s.position.set(x, y, z + dz); s.rotation.set(0, yaw, roll); sacks.add(s);
    const zl = e * (SL * .5 - .2), t = new THREE.Mesh(tieG, tieM);
    t.position.copy(new THREE.Vector3(0, topAt(zl) - .04, zl).applyEuler(s.rotation).add(s.position)); t.rotation.set(e * .45, yaw, roll); sacks.add(t); });
  // sample points for the b4 obstacle list: two per bottom sack (front / back half)
  const sackPos = sackLay.slice(0, 3).flatMap(([x, , z]) => [[x, 0, z + .4], [x, 0, z - .4]]);
  // dormouse lives in the gap at x≈0.05
  const mouse = new THREE.Group(); sacks.add(mouse);
  const mbody = new THREE.Mesh(new THREE.SphereGeometry(.07, 12, 8).scale(1, .9, 1.3), lam(C.mouse)); mbody.position.y = .07; mouse.add(mbody);
  const mhead = new THREE.Mesh(new THREE.SphereGeometry(.05, 12, 8), lam(C.mouse)); mhead.position.set(0, .1, .09); mouse.add(mhead);
  for (const s of [-1, 1]){ const ear = new THREE.Mesh(new THREE.SphereGeometry(.022, 8, 6).scale(1, 1, .4), lam('#d7a98a')); ear.position.set(s * .035, .15, .08); mouse.add(ear);
    const eye = new THREE.Mesh(new THREE.SphereGeometry(.011, 6, 6), lam('#1e1a18')); eye.position.set(s * .024, .115, .133); mouse.add(eye); }
  const mtail = new THREE.Mesh(new THREE.SphereGeometry(.035, 8, 6).scale(.8, .8, 2.4), lam('#a07650')); mtail.position.set(0, .07, -.13); mouse.add(mtail);
  const mouseHide = new THREE.Vector3(.05, .02, -.35), mousePeek = new THREE.Vector3(.05, .02, .72);   // b4 standalone: just past the middle sack's front end (z .59)
  mouse.position.copy(mouseHide);

  // ---------- wheat (instanced, swaying) ----------
  const uTime = { value: 0 };
  const stalkG = new THREE.ConeGeometry(.05, .9, 4, 1); stalkG.translate(0, .45, 0);
  const wmat = lam(0xffffff); wmat.onBeforeCompile = (sh) => { sh.uniforms.uTime = uTime;
    sh.vertexShader = 'uniform float uTime;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      vec3 ip = instanceMatrix[3].xyz; float ph = uTime * 1.1 + ip.x * .23 + ip.z * .17 + ip.y * .11;
      float sw = (sin(ph) * .5 + sin(ph * 2.3 + 1.7) * .2 + .25) * position.y * position.y * .35;
      transformed.x += sw; transformed.z += sw * .4;`); };
  const NW = 9000, wheat = new THREE.InstancedMesh(stalkG, wmat, NW); const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), col = new THREE.Color(), o = new THREE.Object3D();
  let n = 0; for (let tries = 0; n < NW && tries < NW * 4; tries++){ const x = (rand() * 2 - 1) * 34, z = (rand() * 2 - 1) * 34; if (!wheatIn(x, z)) continue;
    frame(o, x, z, rand() * 6, -.05); o.scale.setScalar(.7 + rand() * .6); o.updateMatrix(); wheat.setMatrixAt(n, o.matrix);
    const band = Math.floor((Math.hypot(x, z) - 13) / (21 / 12)); col.set(C.wheat[(band + (rand() < .15 ? 1 : 0)) % 4]).multiplyScalar(.9 + rand() * .15); wheat.setColorAt(n, col); n++; }
  wheat.count = n; group.add(wheat);

  // ---------- donkey with wool pannier bags ----------
  const donkey = new THREE.Group(); group.add(donkey); const dbody = new THREE.Group(); donkey.add(dbody);
  const torso = new THREE.Mesh(new THREE.SphereGeometry(.5, 16, 12).scale(.8, .75, 1.5), lam(C.donkey)); torso.position.y = .95; dbody.add(torso);
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(.16, .22, .7, 10), lam(C.donkey)); neck.position.set(0, 1.35, .65); neck.rotation.x = .6; dbody.add(neck);
  const head = new THREE.Group(); head.position.set(0, 1.62, .95); dbody.add(head);
  head.add(new THREE.Mesh(new THREE.SphereGeometry(.17, 12, 10).scale(1, 1, 1.9), lam(C.donkey)));
  const muz = new THREE.Mesh(new THREE.SphereGeometry(.13, 10, 8), lam(C.muzzle)); muz.position.set(0, -.05, .3); head.add(muz);
  for (const s of [-1, 1]){ const ear = new THREE.Mesh(new THREE.ConeGeometry(.06, .42, 8), lam(C.donkey)); ear.position.set(s * .1, .3, -.12); ear.rotation.set(-.3, 0, s * -.35); head.add(ear);
    const eye = new THREE.Mesh(new THREE.SphereGeometry(.025, 6, 6), lam('#1e1a18')); eye.position.set(s * .13, .05, .1); head.add(eye); }
  const mane = new THREE.Mesh(new THREE.BoxGeometry(.06, .12, .7), lam(C.donkeyDk)); mane.position.set(0, 1.55, .62); mane.rotation.x = .6; dbody.add(mane);
  const tail = new THREE.Mesh(new THREE.CylinderGeometry(.03, .05, .55, 6), lam(C.donkeyDk)); tail.position.set(0, .9, -.78); tail.rotation.x = -.3; dbody.add(tail);
  const legs = []; for (const [x, z] of [[-.2, .45], [.2, .45], [-.2, -.45], [.2, -.45]]){ const piv = new THREE.Group(); piv.position.set(x, .75, z); dbody.add(piv);
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(.07, .06, .75, 8), lam(C.donkey)); leg.position.y = -.375; piv.add(leg);
    const hoof = new THREE.Mesh(new THREE.CylinderGeometry(.07, .08, .08, 8), lam(C.donkeyDk)); hoof.position.y = -.72; piv.add(hoof); legs.push(piv); }
  const woolG = new THREE.IcosahedronGeometry(.3, 2); { const p = woolG.attributes.position, v = new THREE.Vector3(); for (let i = 0; i < p.count; i++){ v.fromBufferAttribute(p, i); v.multiplyScalar(1 + .08 * Math.sin(v.x * 30) * Math.sin(v.y * 27 + v.z * 21)); p.setXYZ(i, v.x, v.y, v.z); } woolG.computeVertexNormals(); }
  for (const s of [-1, 1]){ const bag = new THREE.Mesh(woolG, lam(C.wool)); bag.position.set(s * .5, .95, -.05); bag.scale.set(.8, 1.1, 1.2); dbody.add(bag); }
  const strap = new THREE.Mesh(new THREE.BoxGeometry(1.05, .08, .2), lam('#7a5a3c')); strap.position.set(0, 1.28, -.05); dbody.add(strap);
  const seat = new THREE.Object3D(); seat.position.set(0, 1.33, -.1); dbody.add(seat);    // cat rides here
  let dT = 0.3, dRide = false;

  const obstacles = [{ x: 0, z: 0, r: 3.0 }, { x: HX, z: HZ, r: 3.3 }];
  for (const [x, , z] of sackPos){ const a = -0.5; obstacles.push({ x: SX + x * Math.cos(a) + z * Math.sin(a), z: SZ - x * Math.sin(a) + z * Math.cos(a), r: .5 }); }
  void obstacles;

  // ---------- api ----------
  const tmp = new THREE.Vector3(); let mouseK = 0; const sackWorld = new THREE.Vector3();
  function donkeyLocal(t){ const r = PATH_R(t); return [r * Math.cos(t), r * Math.sin(t)]; }
  function update(dt, cat){
    uTime.value += dt;
    sails.rotation.z -= dt * 0.35;
    // donkey
    const speed = dRide ? 2.4 : 0.7;      // m/s along path
    dT += speed * dt / PATH_R(dT);
    const [x0, z0] = donkeyLocal(dT), [x1, z1] = donkeyLocal(dT + .02);
    frame(donkey, x0, z0, 0); // orient to path tangent
    const up = dirOf(x0, z0), fw = surf(x1, z1).sub(surf(x0, z0)); fw.addScaledVector(up, -fw.dot(up)).normalize(); const rt = up.clone().cross(fw);
    donkey.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(rt, up, fw));
    const gait = uTime.value * (dRide ? 7 : 3.2);
    legs.forEach((l, i) => l.rotation.x = Math.sin(gait + (i === 0 || i === 3 ? 0 : Math.PI)) * (dRide ? .45 : .28));
    dbody.position.y = Math.abs(Math.sin(gait)) * .04; head.rotation.x = Math.sin(gait * .5) * .08; tail.rotation.z = Math.sin(uTime.value * 1.7) * .25;
    // dormouse peeks when the cat sits nearby
    sacks.localToWorld(sackWorld.set(.05, 0, .3));
    const near = cat && cat.position.distanceTo(sackWorld) < 2.6 && cat.sitting;
    mouseK = THREE.MathUtils.damp(mouseK, near ? 1 : 0, near ? 1.2 : 4, dt);
    mouse.position.lerpVectors(mouseHide, mousePeek, mouseK);
    mhead.rotation.y = Math.sin(uTime.value * 1.3) * .5 * mouseK; mhead.position.y = .1 + Math.max(0, Math.sin(uTime.value * 4.1)) * .01 * mouseK;
    mouse.visible = mouseK > .02;
  }
  function seatWorld(out){ donkey.updateMatrixWorld(true); return seat.getWorldPosition(out); }
  function donkeyNear(p, d = 2.4){ donkey.updateMatrixWorld(true); return donkey.getWorldPosition(tmp).distanceTo(p) < d; }
  // push a world point (on the surface) out of obstacles; returns adjusted point
  function collide(p){ let [x, z] = toLocal(p); let hit = false;
    for (const o of obstacles){ const dx = x - o.x, dz = z - o.z, dd = Math.hypot(dx, dz), rr = o.r + .25; if (dd < rr && dd > 1e-6){ x = o.x + dx / dd * rr; z = o.z + dz / dd * rr; hit = true; } }
    if (!hit) return p; const h = p.length() - R - heightAtLocal(...toLocal(p)); return dirOf(x, z).multiplyScalar(R + heightAtLocal(x, z) + h); }
  return { group, update, heightAt, surf, frame, collide, seatWorld, donkeyNear, donkey,
    setRiding(v){ dRide = v; }, get riding(){ return dRide; }, get mousePeek(){ return mouseK; }, spawn: surf(-4, 22),
    sackSpot(out){ sacks.updateMatrixWorld(true); return sacks.localToWorld(out.set(.05, 0, 1.5)); },
    sackCenter(out){ return sacks.localToWorld(out.set(.05, .3, 0)); } };
}
