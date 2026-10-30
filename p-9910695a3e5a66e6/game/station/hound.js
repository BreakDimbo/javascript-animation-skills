// 小站 · the hound: a sleepy clay hound on the platform. Sleeps head-on-paws; lifts its head when the cat comes near,
// gets up and trots a few steps to it and wags, then wanders back to its spot and settles. Local frame of the station (x, z, y up).
import * as THREE from '../../shared/vendor/three.module.js';
import { Builder, lump } from './kit.js';

// r2 palette (review-vd-station-r1 §3): read by value contrast (pale muzzle, dark ears), not by size
const C = { coat: '#c9a07a', coatD: '#b88e6a', ear: '#8a5a3c', cream: '#efe2c8', nose: '#4a3a34', eye: '#3a2414', blanket: '#9c6a5a', blanketD: '#86594c' };
const sm = THREE.MathUtils.smoothstep, lerp = THREE.MathUtils.lerp, damp = (a, b, k, dt) => a + (b - a) * Math.min(1, k * dt);
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));

export function createHound(mat, { bed, bedYaw, groundAt, clampXZ }){
  const root = new THREE.Group(); root.name = 'hound';
  const cap = (r, l, rs = 8, cs = 18) => new THREE.CapsuleGeometry(r, l, rs, cs);
  const blob = (r, sy, w) => lump(r, sy, w, 22);
  const part = (seed, fn) => { const b = Builder(seed); fn(b); return b.mesh(mat); };
  // the old blanket it sleeps on (stays put)
  const rug = part(3, (b) => { b.box(.5, .018, .34, C.blanket, 0, .009, 0, 0, .008, .015); b.box(.46, .004, .03, C.blanketD, 0, .019, -.1, 0, .002, .01); b.box(.46, .004, .03, C.blanketD, 0, .019, .1, 0, .002, .01); });
  rug.castShadow = false; rug.position.set(bed[0], groundAt(bed[0], bed[1]), bed[1]); rug.rotation.y = bedYaw + .12; rug.scale.setScalar(.62);
  // body (forward = +z in the dog group)
  const dog = new THREE.Group(); root.add(dog); const inner = new THREE.Group(); inner.scale.setScalar(.67); dog.add(inner); // r2: −46 % (review: 1.35 Lc nose→rump, 1.1 Hc at the shoulder, measured on station/sheet.html)
  // r2.1 (review-vd-station-r2 §2): taller, not longer — shoulder 1.04 → 1.2–1.25 Hc on longer legs, length kept at 2.4 Hc, head ×HEAD, ears +10 %
  const LEG = .05, HEAD = 1.12;
  const body = new THREE.Group(); inner.add(body);
  body.add(part(11, (b) => {
    b.add(cap(.088, .26).rotateX(Math.PI / 2).scale(1, .92, 1), C.coat, 0, 0, 0, 0, 0, 0, .015);
    b.add(blob(.088, .95, .02), C.coat, 0, .005, .14, 0, 0, 0, .01);                // chest
    b.add(blob(.062, 1, .015), C.cream, 0, -.025, .19, 0, 0, 0, .01);                // pale chest
    b.add(blob(.082, .92, .02), C.coatD, 0, .035, -.04, 0, 0, 0, .02);               // darker saddle
    b.add(blob(.086, .97, .02), C.coat, 0, .0, -.15, 0, 0, 0, .01); }));          // haunch
  // legs: pivots at shoulder / hip; leg hangs along −y
  const legs = [];
  for (const [x, z, front] of [[-.055, .14, 1], [.055, .14, 1], [-.06, -.15, 0], [.06, -.15, 0]]){
    const pv = new THREE.Group(); pv.position.set(x, -.03, z); body.add(pv);
    pv.add(part(20 + legs.length, (b) => { b.add(cap(.026, .07 + LEG), front ? C.coat : C.coatD, 0, -.06 - LEG / 2, 0, 0, 0, 0, .01); b.add(blob(.032, .72, .01).scale(1, 1, 1.3), C.cream, 0, -.115 - LEG, .014, 0, 0, 0, .01); }));
    legs.push({ pv, front });
  }
  // tail: two segments, root at the haunch
  const tail = new THREE.Group(); tail.position.set(0, .05, -.22); body.add(tail);
  const tail2 = new THREE.Group(); tail2.position.set(0, 0, -.09);
  tail.add(part(30, (b) => b.add(cap(.016, .08).rotateX(Math.PI / 2), C.coat, 0, 0, -.045)), tail2);
  tail2.add(part(31, (b) => b.add(cap(.013, .07).rotateX(Math.PI / 2), C.cream, 0, 0, -.04)));
  // neck → head
  const neck = new THREE.Group(); neck.position.set(0, .04, .2); body.add(neck);
  neck.add(part(40, (b) => b.add(cap(.05, .07).rotateX(Math.PI / 2 - .7), C.coat, 0, .03, .03, 0, 0, 0, .01)));
  const head = new THREE.Group(); head.position.set(0, .075, .08 - .2 * (HEAD - 1)); head.scale.setScalar(HEAD); neck.add(head);
  head.add(part(41, (b) => {
    b.add(blob(.058, .92, .015).scale(.98, 1, 1.12), C.coat, 0, 0, 0, 0, 0, 0, .01);
    b.add(cap(.035, .075).rotateX(Math.PI / 2).scale(1, .95, 1), C.coat, 0, -.02, .085, .08, 0, 0, .01);    // long hound muzzle
    b.add(blob(.03, .82, .01).scale(1, 1, 1.5), C.cream, 0, -.038, .1, 0, 0, 0, .01);                                       // chin
    b.add(blob(.017, .78, .005), C.nose, 0, -.012, .141, 0, 0, 0, .01);                                      // nose (matte)
    }));
  const eyes = [-1, 1].map((s) => { const e = part(50, (b) => b.add(lump(.0095, 1, 0, 14).scale(1, 1, .32), C.eye)); e.castShadow = false; e.position.set(s * .031, .014, .05); e.rotation.y = s * .5; head.add(e); return e; });
  // long hound ears hang from the top of the skull
  const ears = [-1, 1].map((s) => { const p = new THREE.Group(); p.position.set(s * .05, .012, -.012); head.add(p);
    p.add(part(60, (b) => b.add(blob(.032, 1, .02).scale(.45, 2.35 * 1.1, 1.15), C.ear, s * .012, -.06 * 1.1, 0, 0, 0, 0, .02))); return p; });

  // ---------- poses ----------
  const S = { x: bed[0], z: bed[1], yaw: bedYaw, up: 0, lift: 0, look: 0, wag: 0, wagA: 0, gait: 0, ph: 0, state: 'sleep', t: 0, near: 0, far: 0, eye: 0, blinkT: 2 };
  function pose(dt, T){
    const u = S.up, sp = S.gait;
    dog.position.set(S.x, groundAt(S.x, S.z), S.z); dog.rotation.y = S.yaw;
    const breathe = Math.sin(T * (u < .5 ? 1.5 : 2.4)) * .006;
    body.position.y = lerp(.072, .155 + LEG, u) + Math.abs(Math.sin(S.ph * 2)) * .01 * sp;
    body.rotation.x = lerp(.04, -.03, u);
    body.scale.set(1 + breathe, 1 + breathe * 1.4, 1);
    for (const [i, L] of legs.entries()){
      const sw = Math.sin(S.ph + (i === 0 || i === 3 ? 0 : Math.PI)) * .55 * sp;
      const rest = L.front ? -1.45 : -1.3;                          // lying: forelegs out in front, hind legs tucked under
      L.pv.rotation.x = lerp(rest, sw, u); L.pv.rotation.z = (L.pv.position.x > 0 ? 1 : -1) * lerp(L.front ? .08 : .32, 0, u);
    }
    // head: lying = chin on the forepaws; lift = head up, looking; look = turn toward the cat
    const hl = Math.max(S.lift, u);
    neck.rotation.x = lerp(.95, -.05, hl) + (1 - hl) * Math.sin(T * 1.5) * .02;
    head.rotation.x = lerp(-.6, .15 - .1 * u, hl);
    neck.rotation.y = S.look * .55 * hl; head.rotation.y = S.look * .45 * hl; head.rotation.z = -S.look * .12 * hl;
    for (const [i, e] of ears.entries()) e.rotation.set(-head.rotation.x * .6 + .08, 0, (i ? -1 : 1) * (.08 + .05 * sp * Math.sin(S.ph * 2 + i)));
    const blink = S.blinkT < .12 ? .15 : 1; for (const e of eyes) e.scale.y = lerp(.12, 1, S.eye) * blink;
    // tail: rests down when asleep, rises when awake; wag swings side to side
    tail.rotation.x = lerp(-.35, .45, Math.max(u * .9, S.lift * .4)) - .2 * (1 - u);
    tail.rotation.y = Math.sin(T * 9) * S.wagA * .17 + (1 - u) * .55; tail2.rotation.y = Math.sin(T * 9 - .9) * S.wagA * .09; // r2: wag ±15°, unhurried
    tail2.rotation.x = .25 * u;
  }

  // ---------- behaviour ----------
  // cat in station-local coords (cx, cz); dCat = distance from the dog's chest
  function update(dt, T, cat, cue = 0){
    S.t += dt; S.blinkT -= dt; if (S.blinkT < 0) S.blinkT = 2.5 + Math.random() * 3;
    const has = !!cat, fx = S.x + Math.sin(S.yaw) * .2, fz = S.z + Math.cos(S.yaw) * .2;
    const d = has ? Math.hypot(cat[0] - fx, cat[1] - fz) : 99, ang = has ? Math.atan2(cat[0] - S.x, cat[1] - S.z) : S.yaw;
    S.near = d < 1.05 ? S.near + dt : 0; S.far = d > 2.1 ? S.far + dt : 0;
    let tUp = 0, tLift = 0, tWag = 0, move = null, tLook = 0;
    switch (S.state){
      case 'sleep': if (d < 1.9 || cue > 0) S.state = 'watch'; break;
      case 'watch': tLift = 1; tWag = .25; tLook = wrap(ang - S.yaw);
        if (S.near > .7) S.state = 'rise'; else if (d > 2.2 && cue <= 0) { S.state = 'sleep'; } break;
      case 'rise': tLift = 1; tUp = 1; tWag = .7; tLook = wrap(ang - S.yaw); if (S.up > .92) S.state = 'greet'; break;
      case 'greet': { tUp = 1; tLift = 1; tWag = 1; tLook = wrap(ang - S.yaw);
        // trot a few steps to the cat, never off its patch
        const dx = cat ? cat[0] - S.x : 0, dz = cat ? cat[1] - S.z : 0, dist = Math.hypot(dx, dz), home = Math.hypot(S.x - bed[0], S.z - bed[1]);
        if (dist > .42 && home < .3) move = [dx / dist, dz / dist];   // r2: a few steps (≤ 3), no more
        if (S.far > 2.2) S.state = 'home'; break; }
      case 'home': { tUp = 1; tLift = 1; tWag = .2; const dx = bed[0] - S.x, dz = bed[1] - S.z, dist = Math.hypot(dx, dz);
        if (d < 1.0) { S.state = 'greet'; break; }
        if (dist > .04) move = [dx / dist, dz / dist]; else { S.yaw = damp(S.yaw, S.yaw + wrap(bedYaw - S.yaw), 3, dt); if (Math.abs(wrap(bedYaw - S.yaw)) < .08) S.state = 'settle'; } break; }
      case 'settle': tUp = 0; tLift = 1; tWag = .15; if (d < 1.0) { S.state = 'rise'; break; } if (S.up < .05) { S.state = 'watch'; } break;
    }
    if (move){ const want = Math.atan2(move[0], move[1]); S.yaw += wrap(want - S.yaw) * Math.min(1, dt * 5);
      const al = Math.max(0, Math.cos(wrap(want - S.yaw))), v = .42 * al; const n = clampXZ(S.x + Math.sin(S.yaw) * v * dt, S.z + Math.cos(S.yaw) * v * dt); S.x = n[0]; S.z = n[1];
      S.gait = damp(S.gait, 1, 8, dt); tLook *= .3; } else S.gait = damp(S.gait, 0, 6, dt);
    S.ph += dt * 10 * S.gait;
    S.up = damp(S.up, tUp, tUp > S.up ? 2.6 : 1.6, dt); S.lift = damp(S.lift, tLift, tLift > S.lift ? 3 : .7, dt);
    S.look = damp(S.look, THREE.MathUtils.clamp(tLook, -1.2, 1.2), 4, dt); S.wagA = damp(S.wagA, tWag, 3, dt);
    S.eye = damp(S.eye, S.state === 'sleep' && S.lift < .3 ? 0 : 1, 4, dt);
    pose(dt, T);
  }
  pose(0, 0);
  return { root, rug, update, S, reach: () => [S.x, S.z], parts: { dog, body, tail, head } };
}
