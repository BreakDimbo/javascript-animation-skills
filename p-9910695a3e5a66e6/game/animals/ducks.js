// 动物互动 · pond: the ducks paddle off from the bank the cat comes to, leave soft painted rings behind, and drift back once it has gone.
// Works in the b3 pond's own local metres (before the PS shrink) on top of its duck brains: it only nudges dk.x/z and the group heading.
import * as THREE from '../../shared/vendor/three.module.js';
import { makeShade } from './millyard.js';
import { CAT_HC } from '../catScale.js';

/* r2 (VD): ducks 0.95 Hc long (= 0.57 Lc), contact shade like the cat's, turn within 0.4 s, 1.6× paddle for the first 1.5 s, one per group looks back 0.8 s */
const PS = .15; let DUCK_L = .70 * CAT_HC / PS, GAP = 1.7 * DUCK_L;  // live CAT_HC (game/catScale.js, fallback 0.281);  // VD r2: 0.70 Hc (0.42 Lc); GAP = 1.7 duck lengths centre-to-centre (gap 0.7 L = 0.30 Lc), applied in b3 grouping via dk.sep
const ALERT = 10, CALM = 13, RINGS = 10, REST = 24; /* r2: REST s loitering by the old spot after they come back */
const angTo = (a, b) => Math.atan2(Math.sin(b - a), Math.cos(b - a));

function ringTexture(){ // a soft gouache annulus: pale water tone, feathered both sides, faintly uneven like a brush ring
  const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d'), id = g.createImageData(128, 128), d = id.data;
  for (let y = 0; y < 128; y++) for (let x = 0; x < 128; x++){ const dx = x - 63.5, dy = y - 63.5, r = Math.hypot(dx, dy) / 63.5, a = Math.atan2(dy, dx);
    const w = .085 * (1 + .25 * Math.sin(a * 3 + 1) + .15 * Math.sin(a * 7)), k = Math.exp(-Math.pow((r - .78) / w, 2)) * (.8 + .2 * Math.sin(a * 5 + 2));
    const i = (y * 128 + x) * 4; d[i] = d[i + 1] = d[i + 2] = 255; d[i + 3] = Math.round(255 * Math.max(0, Math.min(1, k))); }
  g.putImageData(id, 0, 0); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; }

export function createDuckShy(m){
  const tex = ringTexture(), geo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
  const rings = Array.from({ length: RINGS }, () => { const mat = new THREE.MeshBasicMaterial({ color: 0xd9e7f1, alphaMap: tex, transparent: true, opacity: 0, depthWrite: false });
    const o = new THREE.Mesh(geo, mat); o.visible = false; o.renderOrder = 3; o.frustumCulled = false; m.group.add(o); return { o, t: 9, x: 0, z: 0, s: 1 }; });
  let ri = 0;
  const ring = (x, z, s = 1) => { const r = rings[ri]; ri = (ri + 1) % RINGS; r.t = 0; r.x = x; r.z = z; r.s = s; };
  const groups = new Map(); for (const dk of m.ducks){ if (!groups.has(dk.gid)) groups.set(dk.gid, { home: null, quiet: 0, scared: 0, rest: 0, log: null }); dk._rt = Math.random() * .5; }
  const state = { groups, scared: 0, duckScale: 1 };
  // measure the b3 duck once (its own frame) and scale every duck to DUCK_L; each gets a contact shade at 1.3× its footprint
  { const d0 = m.ducks[0].m; d0.updateMatrixWorld(true); const inv = new THREE.Matrix4().copy(d0.matrixWorld).invert(), bb = new THREE.Box3(), b = new THREE.Box3(), M4 = new THREE.Matrix4();
    d0.traverse(o => { if (o.isMesh){ o.geometry.computeBoundingBox(); b.copy(o.geometry.boundingBox).applyMatrix4(M4.multiplyMatrices(inv, o.matrixWorld)); bb.union(b); } });
    const sz = bb.getSize(new THREE.Vector3()), k = sz.z > 1e-3 ? DUCK_L / sz.z : 1; state.duckScale = k; state.duckSize = [sz.x * k, sz.z * k]; state.base = { x: sz.x, z: sz.z, k0: d0.scale.x, hc: CAT_HC };
    for (const dk of m.ducks){ dk.sep = GAP; dk.m.scale.multiplyScalar(k); dk.shade = makeShade(sz.x * k * 1.3, sz.z * k * 1.3); m.group.add(dk.shade); } }
  function hcSync(){ const B = state.base; if (!B || B.hc === CAT_HC) return; B.hc = CAT_HC; DUCK_L = .70 * CAT_HC / PS; GAP = 1.7 * DUCK_L;
    const k = DUCK_L / B.z; state.duckScale = k; state.duckSize = [B.x * k, B.z * k];
    for (const dk of m.ducks){ dk.sep = GAP; dk.m.scale.setScalar(B.k0 * k); const o = dk.shade; o.userData.w = B.x * k * 1.3; o.userData.l = B.z * k * 1.3; o.scale.set(o.userData.w, 1, o.userData.l); } }
  const QS = new THREE.Quaternion();

  function update(dt, cat){ // cat: { x, z, speed } in pond-local metres, or null
    hcSync();
    let any = 0;
    for (const [gid, G] of groups){
      const mates = m.ducks.filter(o => o.gid === gid); let cx = 0, cz = 0, near = 1e9;
      for (const o of mates){ cx += o.x; cz += o.z; if (cat) near = Math.min(near, Math.hypot(o.x - cat.x, o.z - cat.z)); } cx /= mates.length; cz /= mates.length;
      if (near < ALERT){ if (!G.home){ G.home = [cx, cz]; G.log = { home: [cx, cz], fled: 0 }; G.st = 0; G.lb = 0; } if (G.scared < .05) G.st = 0; G.st += dt; G.rest = 0; G.quiet = 0; G.scared = Math.min(1, G.scared + dt * 2.5); any = 1;
        const ax = cx - cat.x, az = cz - cat.z, want = Math.atan2(ax, az); for (const o of mates){ o.groupHead += angTo(o.groupHead, want) * Math.min(1, dt * 2.2);
          if (G.st < .6) o.yaw += angTo(o.yaw, Math.atan2(o.x - cat.x, o.z - cat.z)) * Math.min(1, dt * 9); } } /* turned round within ~0.4 s */
      else { G.scared = Math.max(0, G.scared - dt * .6); if (G.home){ G.quiet += dt; if (G.log) G.log.fled = Math.max(G.log.fled, Math.hypot(G.home[0] - cx, G.home[1] - cz));
        if (near > CALM && G.quiet > 3){ // r2: paddle back and then loiter round the old spot for REST s (the b3 brain alone keeps them cruising off)
          const hx = G.home[0] - cx, hz = G.home[1] - cz, hd = Math.hypot(hx, hz), want = Math.atan2(hx, hz);
          if (hd > 1.1) for (const o of mates) o.groupHead += angTo(o.groupHead, want) * Math.min(1, dt * 1.4);
          const pull = hd > 1.1 ? .32 : hd * .2; // calm return paddle, then a soft hold
          for (const o of mates){ const nx = o.x + hx / (hd || 1) * pull * dt, nz = o.z + hz / (hd || 1) * pull * dt; if (m.sample(nx, nz).depth > .3){ o.x = nx; o.z = nz; } }
          if (hd < 1.6) G.rest += dt; if (G.rest > REST){ G.home = null; G.rest = 0; } } } }
      if (G.log) G.log.now = [cx, cz];
      for (const o of mates){
        const d = cat ? Math.hypot(o.x - cat.x, o.z - cat.z) || 1e-3 : 1e9, k = Math.max(0, 1 - d / ALERT) * G.scared * ((G.st || 0) < 1.5 ? 1.6 : 1);
        if (k > 0){ const nx = o.x + (o.x - cat.x) / d * k * .9 * dt, nz = o.z + (o.z - cat.z) / d * k * .9 * dt; // a calm paddle, not a panic
          if (m.sample(nx, nz).depth > .3){ o.x = nx; o.z = nz; } }
        o._rt -= dt * (.4 + 1.6 * G.scared);       // wake rings: a slow trickle at rest, one every ~0.6 s while paddling off
        if (o._rt < 0){ o._rt = .9 + Math.random() * .4; if (G.scared > .15 || Math.random() < .12) ring(o.x - Math.sin(o.yaw) * .3, o.z - Math.cos(o.yaw) * .3, .8 + G.scared * .5); }
      }
    }
    // one duck per group glances back at the cat over its shoulder for 0.8 s, once it has put 1.5 s of water between them
    for (const [gid, G] of groups){ const o = m.ducks.find(q => q.gid === gid), nk = o && o.m.userData.neck; if (!nk) continue;
      if (G.home && G.st > 1.5 && G.lb === 0 && cat){ G.lb = .8; }
      let want = 0; if (G.lb > 0 && cat){ G.lb = Math.max(-1, G.lb - dt); if (G.lb <= 0) G.lb = -1; want = Math.max(-1.5, Math.min(1.5, angTo(o.yaw, Math.atan2(cat.x - o.x, cat.z - o.z)))); }
      nk.rotation.y += (want - nk.rotation.y) * Math.min(1, dt * 9); }
    // VD r2: no two ducks of a group may read as touching on screen. The b3 grouping keeps 1.7 L centre-to-centre on the water; seen from the
    // camera the depth axis is foreshortened, so pairs lined up along the view are spread to 1.7 L in a metric that counts depth at 0.6.
    if (cat && cat.cam) for (const [gid] of groups){ const ms = m.ducks.filter(o => o.gid === gid);
      for (let i = 0; i < ms.length; i++) for (let j = i + 1; j < ms.length; j++){ const a = ms[i], b = ms[j], rx = b.x - a.x, rz = b.z - a.z;
        let vx = (a.x + b.x) / 2 - cat.cam[0], vz = (a.z + b.z) / 2 - cat.cam[1]; const vl = Math.hypot(vx, vz) || 1; vx /= vl; vz /= vl;
        const dep = rx * vx + rz * vz, lat = rx * -vz + rz * vx, de = Math.hypot(lat, dep * .6) || 1e-3; if (de >= GAP) continue;
        const s = Math.min(GAP / de, 1 + dt * 3) - 1, px = rx * s * .5, pz = rz * s * .5; // ease apart, ≤ 3 × per second
        if (m.sample(b.x + px, b.z + pz).depth > .3){ b.x += px; b.z += pz; } if (m.sample(a.x - px, a.z - pz).depth > .3){ a.x -= px; a.z -= pz; } } }
    for (const o of m.ducks) if (o.shade){ m.toWorld(o.x, o.z, m.waterLevel(o.x, o.z) + .02, o.shade.position); m.frame(o.x, o.z, o.yaw, o.shade.quaternion); }
    state.scared = any;
    for (const r of rings){ if (r.t > 2.2){ r.o.visible = false; continue; } r.t += dt; const u = Math.min(1, r.t / 2.2);
      r.o.visible = true; m.toWorld(r.x, r.z, m.waterLevel(r.x, r.z) + .015, r.o.position); m.frame(r.x, r.z, 0, r.o.quaternion);
      const sc = r.s * (.6 + 1.9 * (1 - Math.pow(1 - u, 2))); r.o.scale.set(sc, 1, sc);
      r.o.material.opacity = .38 * Math.sin(Math.PI * Math.pow(u, .6)) * (1 - u * .4); }
  }
  return { update, state, rings };
}
