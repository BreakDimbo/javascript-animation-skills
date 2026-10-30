// wild animals between the regions: rabbits by the hedges and butterflies over the flower drifts share ONE dynamic vertex-coloured mesh
// (1 draw call, matte Lambert, no shadow pass: each rabbit carries its own soft contact disc); a single pair of swallows is the 2nd draw.
// They only live where no region's own animals are (occupied() in route.js), and never when the board grows into the planet.
import * as THREE from '../../shared/vendor/three.module.js';
import { mulberry } from '../../artkit/ground.js';
import { R } from '../core/util.js';
import { F } from '../world.js';
import { occupied } from './route.js';
import { createSwallows } from './swallows.js';

const C = (h) => new THREE.Color(h);
const RS = 2.1; // rabbit template ×2.1: about half the (visually ×1.25) cat's length, a storybook rabbit beside it
const FUR = C('#8d7a64'), FURD = C('#76644f'), CREAM = C('#e6dcc8'), EARIN = C('#b99484'), EYE = C('#2a221c'), SHADE = C('#2c3a1a');
const WINGS = [[C('#ece4d0'), C('#d9cfb6')], [C('#e4d38c'), C('#cdbb72')], [C('#ece4d0'), C('#c9c1b0')]], BODY = C('#4a3f36');

// rabbit template in its own frame (x right, y up, z forward; metres). part 0 = body (moves with the hop), 1 = head (pitches to nibble), 2 = contact disc (stays on the turf)
function rabbitTemplate(){
  const parts = [[], [], []];
  // 10 floats per vertex: position, normal, rgba (alpha < 1 only on the contact disc)
  const add = (p, geo, color, m, alpha = null) => { geo = geo.index ? geo.toNonIndexed() : geo; const P = geo.attributes.position, al = [];
    for (let i = 0; i < P.count; i++) al.push(alpha ? alpha(P.getX(i), P.getY(i)) : 1);
    geo.applyMatrix4(m); geo.computeVertexNormals();
    const N = geo.attributes.normal; for (let i = 0; i < P.count; i++) parts[p].push(P.getX(i), P.getY(i), P.getZ(i), N.getX(i), N.getY(i), N.getZ(i), color.r, color.g, color.b, al[i]); };
  const M = (x, y, z, sx = 1, sy = 1, sz = 1, rx = 0, ry = 0, rz = 0) => new THREE.Matrix4().compose(new THREE.Vector3(x, y, z),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(sx, sy, sz));
  const ball = (r, d = 1) => new THREE.IcosahedronGeometry(r, d);
  // body: a pear of haunch + chest, a paler belly, the cotton tail
  add(0, ball(.034, 2), FUR, M(0, .036, -.012, 1, .92, 1.25));
  add(0, ball(.026, 1), FURD, M(0, .05, -.02, .9, .6, 1.1));
  add(0, ball(.024, 1), CREAM, M(0, .026, .012, .85, .7, 1));
  add(0, ball(.011, 1), CREAM, M(0, .042, -.056));
  for (const s of [-1, 1]){ add(0, ball(.014, 1), FURD, M(s * .022, .02, -.03, .7, .9, 1.5)); add(0, ball(.007, 1), FUR, M(s * .012, .007, .03, .8, .6, 1.4)); }
  // head (pivot at the neck: .055 up, .03 forward), ears laid back a little, matte dark eyes
  add(1, ball(.02, 2), FUR, M(0, .012, .016, .95, .92, 1.15));
  add(1, ball(.009, 1), CREAM, M(0, .004, .034, 1, .8, 1));
  for (const s of [-1, 1]){
    add(1, ball(.009, 1), FURD, M(s * .008, .042, -.004, .55, 2.4, .32, -.35, 0, s * -.18));
    add(1, ball(.006, 1), EARIN, M(s * .008, .042, -.0005, .4, 2.0, .15, -.35, 0, s * -.18));
    add(1, ball(.0042, 1), EYE, M(s * .0165, .017, .024, .6, 1, 1)); }
  // soft contact darkening: alpha .55 at the centre → 0 at the rim (the mesh is a single transparent pass)
  add(2, new THREE.CircleGeometry(.062, 16), SHADE, M(0, .003, -.008, 1, 1, 1.3, -Math.PI / 2), (x, y) => .55 * (1 - Math.min(1, Math.hypot(x, y) / .062)));
  return parts.map(a => new Float32Array(a));
}

export function createWild(scene, { route, heightAt, fcam }){
  const TPL = rabbitTemplate(), RV = TPL.reduce((n, a) => n + a.length / 10, 0), MAXR = 4, MAXF = 3, FT = 6; // butterfly: 2 wings × 2 tris + body 2 tris
  const NV = MAXR * RV + MAXF * FT * 3, pos = new Float32Array(NV * 3), nor = new Float32Array(NV * 3), col = new Float32Array(NV * 4);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
  geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3).setUsage(THREE.DynamicDrawUsage));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 4).setUsage(THREE.DynamicDrawUsage));
  const mesh = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide, transparent: true, forceSinglePass: true }));
  mesh.frustumCulled = false; mesh.name = 'wild'; scene.add(mesh);
  const swallows = createSwallows(scene, { R, heightAt });

  // ---------- rabbits: 2–3 per warren, each with a home a little off its hedge on the field side ----------
  const rnd = mulberry(77), rabbits = [];
  route.warrens.forEach((w, wi) => { const n = 2 + (rnd() < .4 ? 1 : 0), d = F.dirOf(w.u, w.v), toH = new THREE.Vector3(...w.n), _p = toH.addScaledVector(d, -toH.dot(d)).normalize(), along = new THREE.Vector3().crossVectors(d, toH).normalize();
    for (let k = 0; k < n; k++){ const s = (k - (n - 1) / 2) * .8 + (rnd() - .5) * .25, off = .4 + rnd() * .4;
      // home: along the hedge by s, out into the field by off; hedge point: the painted line behind it
      const hedge = d.clone().multiplyScalar(R).addScaledVector(along, s).addScaledVector(toH, w.dist).normalize();
      const home = hedge.clone().multiplyScalar(R).addScaledVector(toH, -off).normalize();
      rabbits.push({ wi, home, hedge, toH: toH.clone(), pos: home.clone(), yaw: rnd() * 6.28, st: 'sit', t: rnd() * 3, hopT: 0, from: new THREE.Vector3(), to: new THREE.Vector3(),
        hidden: 0, nib: 0, nibT: rnd() * 4, ear: 0, scale: RS * (.92 + rnd() * .16) }); } });

  // ---------- butterflies: up to 3 over the nearest flower drifts ----------
  const flies = []; for (let i = 0; i < MAXF; i++) flies.push({ drift: null, ph: i * 2.1, pal: WINGS[i % 3], off: new THREE.Vector2(), push: new THREE.Vector2() });

  // per-frame vertex writer
  let w = 0, fade = 1; const M4 = new THREE.Matrix4(), M5 = new THREE.Matrix4(), NM = new THREE.Matrix3(), V = new THREE.Vector3(), N3 = new THREE.Vector3();
  const writePart = (arr, m, sc = 1) => { NM.getNormalMatrix(m); for (let i = 0; i < arr.length; i += 10){
    V.set(arr[i] * sc, arr[i + 1] * sc, arr[i + 2] * sc).applyMatrix4(m); N3.set(arr[i + 3], arr[i + 4], arr[i + 5]).applyMatrix3(NM).normalize();
    const o = w * 3, c = w * 4; pos[o] = V.x; pos[o + 1] = V.y; pos[o + 2] = V.z; nor[o] = N3.x; nor[o + 1] = N3.y; nor[o + 2] = N3.z;
    col[c] = arr[i + 6]; col[c + 1] = arr[i + 7]; col[c + 2] = arr[i + 8]; col[c + 3] = arr[i + 9] * fade; w++; } };
  const tri = (a, b, c, color) => { const nx = (b.y - a.y) * (c.z - a.z) - (b.z - a.z) * (c.y - a.y), ny = (b.z - a.z) * (c.x - a.x) - (b.x - a.x) * (c.z - a.z), nz = (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x), l = Math.hypot(nx, ny, nz) || 1;
    for (const p of [a, b, c]){ const o = w * 3, q = w * 4; pos[o] = p.x; pos[o + 1] = p.y; pos[o + 2] = p.z; nor[o] = nx / l; nor[o + 1] = ny / l; nor[o + 2] = nz / l;
      col[q] = color.r; col[q + 1] = color.g; col[q + 2] = color.b; col[q + 3] = 1; w++; } };

  // a local frame on the sphere at unit dir d facing heading `fw` (tangent) → matrix with x right, y up, z forward, origin lifted by `lift`
  const X = new THREE.Vector3(), Z = new THREE.Vector3(), O = new THREE.Vector3();
  const frameAt = (d, fw, lift, m) => { Z.copy(fw).addScaledVector(d, -fw.dot(d)).normalize(); X.crossVectors(d, Z).normalize();
    O.copy(d).multiplyScalar(R + heightAt(d) + lift); return m.makeBasis(X, d, Z).setPosition(O); };
  const fwOf = (d, yaw, out) => { const e = new THREE.Vector3(0, 1, 0).cross(d).normalize(), n = e.clone().cross(d); return out.copy(e).multiplyScalar(Math.cos(yaw)).addScaledVector(n, Math.sin(yaw)); };
  const FW = new THREE.Vector3(), TMP = new THREE.Vector3(), HEAD = new THREE.Matrix4().makeTranslation(0, .055, .03), ROT = new THREE.Matrix4(), DISC = new THREE.Matrix4();
  const dist = (a, b) => a.angleTo(b) * R;
  // tangent unit vector at a pointing to b, written into out
  const toward = (a, b, out) => out.copy(b).addScaledVector(a, -b.dot(a)).normalize();

  function updateRabbit(r, dt, cat){
    r.t += dt;
    const dc = dist(r.pos, cat.up);
    if (r.st === 'hidden'){ r.hidden -= dt; if (r.hidden <= 0 && dist(r.home, cat.up) > 3){ r.st = 'sit'; r.pos.copy(r.home); r.t = 0; } return false; }
    if ((r.st === 'sit' || r.st === 'nibble') && dc < 1.2 && cat.speed > .05){ r.st = 'flee'; r.hops = 0; r.hopT = 1; } // the cat comes trotting: off into the hedge
    if (r.st === 'flee'){
      r.hopT += dt / .4;
      if (r.hopT >= 1){ // start the next hop: toward the hedge, a little sideways away from the cat
        r.hopT = 0; r.hops++; r.from.copy(r.pos);
        toward(r.pos, r.hedge, FW); toward(r.pos, cat.up, TMP); FW.addScaledVector(TMP, -.5).normalize();
        const left = dist(r.pos, r.hedge), step = Math.min(.3, left + .08);
        r.to.copy(r.pos).multiplyScalar(R).addScaledVector(FW, step).normalize(); r.yaw = null; r.fw = FW.clone();
        if (left < .05 || r.hops > 6){ r.st = 'hidden'; r.hidden = 18 + (r.t % 9); return false; }
      }
      r.pos.copy(r.from).lerp(r.to, r.hopT).normalize();
    } else if (r.t > 3 + (r.nibT % 3)){ r.t = 0; r.st = r.st === 'sit' ? 'nibble' : 'sit'; r.nibT += 1.7; }
    return true;
  }
  function drawRabbit(r){
    const fw = r.fw ?? fwOf(r.pos, r.yaw, FW); const hop = r.st === 'flee' ? Math.sin(Math.PI * r.hopT) : 0;
    // into the hedge: the last bit of the last hop shrinks it into the painted line
    const left = dist(r.pos, r.hedge), sink = r.st === 'flee' ? THREE.MathUtils.smoothstep(left, 0, .2) : 1, sc = r.scale * (.25 + .75 * sink);
    frameAt(r.pos, fw, 0, DISC); fade = (1 - .5 * hop) * sink; writePart(TPL[2], DISC, r.scale * (1 - .2 * hop)); fade = 1;
    frameAt(r.pos, fw, hop * .09, M4);
    // hop: stretched and pitched nose-up on the way up, nose-down landing
    ROT.makeRotationX(r.st === 'flee' ? -.35 * Math.cos(Math.PI * r.hopT) : 0); M4.multiply(ROT); writePart(TPL[0], M4, sc);
    // head: a nibble dips the head to the turf with a slow chew bob; sitting, a small look about
    const nib = r.st === 'nibble' ? .75 + .08 * Math.sin(r.t * 9) : r.st === 'flee' ? -.15 : .08 * Math.sin(r.t * .9);
    r.nib += (nib - r.nib) * .12; M5.copy(M4).multiply(HEAD.makeTranslation(0, .055 * sc, .03 * sc)).multiply(ROT.makeRotationX(r.nib));
    if (r.st === 'sit') M5.multiply(ROT.makeRotationY(.35 * Math.sin(r.t * .5)));
    writePart(TPL[1], M5, sc);
  }

  // butterflies drift on slow lissajous loops over their drift, pushed gently away from the cat; wings: a slow open/close with long glides
  const A = new THREE.Vector3(), B = new THREE.Vector3(), Cc = new THREE.Vector3(), D = new THREE.Vector3(), E = new THREE.Vector3(), P = new THREE.Vector3(), Fw = new THREE.Vector3(), Rt = new THREE.Vector3(), Up = new THREE.Vector3();
  const dd = new THREE.Vector3();
  function drawFly(f, T, cat){
    const dr = f.drift, t = T * .35 + f.ph;
    let x = Math.sin(t * .9) * .35 + Math.sin(t * 2.3) * .08, y = Math.sin(t * .63 + 1) * .22 + Math.cos(t * 1.9) * .06;
    // drift away from the cat (push decays slowly, so they keep the new spot for a while)
    const [cu, cv] = F.toUV(cat.up), ex = dr.u + x + f.push.x - cu, ey = dr.v + y + f.push.y - cv, de = Math.hypot(ex, ey);
    if (de < 1) { f.push.x += ex / (de || 1) * (1 - de) * .02; f.push.y += ey / (de || 1) * (1 - de) * .02; }
    f.push.multiplyScalar(.9985); if (f.push.length() > 1.6) f.push.setLength(1.6);
    x += f.push.x; y += f.push.y;
    const x2 = x + Math.cos(t * .9) * .35 * .9 * .03 + .001, y2 = y + Math.cos(t * .63 + 1) * .22 * .63 * .03;
    F.dirOf(dr.u + x, dr.v + y, dd); const alt = .2 + .08 * Math.sin(t * 1.3 + f.ph) + .03 * Math.sin(T * 5 + f.ph);
    P.copy(dd).multiplyScalar(R + heightAt(dd) + alt); Up.copy(dd);
    F.dirOf(dr.u + x2, dr.v + y2, A); Fw.copy(A).sub(dd); Fw.addScaledVector(dd, -Fw.dot(dd)).normalize(); Rt.crossVectors(Up, Fw).normalize();
    const cy = (T * .55 + f.ph) % 1, flap = cy < .45 ? Math.abs(Math.sin(T * 7 + f.ph)) : .25, a = .15 + flap * 1.1, S = .06;
    const Wv = (sx, z, s, out) => out.copy(P).addScaledVector(Rt, sx * Math.cos(a) * s * S).addScaledVector(Up, Math.sin(a) * Math.abs(sx) * S).addScaledVector(Fw, z * S);
    for (const s of [-1, 1]){ // forewing (rounded tip forward) + hindwing
      Wv(0, .25, s, A); Wv(s * 1.0, .55, 1, B); Wv(s * .95, -.05, 1, Cc); tri(A, B, Cc, f.pal[0]);
      Wv(0, -.15, s, D); Wv(s * .7, -.6, 1, E); tri(D, Cc, E, f.pal[1]); }
    A.copy(P).addScaledVector(Fw, .4 * S).addScaledVector(Up, .02 * S); B.copy(P).addScaledVector(Fw, -.45 * S); Cc.copy(P).addScaledVector(Rt, .06 * S); tri(A, Cc, B, BODY); Cc.copy(P).addScaledVector(Rt, -.06 * S); tri(A, B, Cc, BODY);
  }

  const near = [];
  return { mesh, swallows, rabbits,
    update(dt, T, cat){
      w = 0;
      const on = fcam.board.planet < .05 && !occupied(cat.up);
      if (on){
        // rabbits of the warrens within ~11 m (the default board is 6.6 × 9.2 m); at most MAXR drawn
        let nr = 0; for (const r of rabbits){ if (dist(r.home, cat.up) > 11){ r.st = 'sit'; r.pos.copy(r.home); continue; }
          if (updateRabbit(r, dt, cat) && nr < MAXR){ drawRabbit(r); nr++; } }
        // butterflies: the nearest drifts within 10 m, up to 2 over the closest one and 1 over the next
        near.length = 0; for (const d of route.drifts){ const dk = Math.hypot(d.u - F.toUV(cat.up)[0], d.v - F.toUV(cat.up)[1]); if (dk < 10) near.push([dk, d]); }
        near.sort((a, b) => a[0] - b[0]);
        flies.forEach((f, i) => { const d = near[i === 2 ? 1 : 0]?.[1] ?? (i < 2 ? null : near[0]?.[1]); if (i === 1 && !near[0]) return;
          if (!d) return; if (f.drift !== d){ f.drift = d; f.push.set(0, 0); } drawFly(f, T, cat); });
      }
      mesh.visible = w > 0; geo.setDrawRange(0, w);
      if (w > 0){ geo.attributes.position.needsUpdate = geo.attributes.normal.needsUpdate = geo.attributes.color.needsUpdate = true; }
      swallows.update(dt, T, fcam.board, on);
    } };
}
