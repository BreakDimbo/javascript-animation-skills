// small clay finds in the seams between regions (gate, stone, bucket, signpost, the stone bridge), baked into ONE vertex-coloured mesh
import * as THREE from '../../shared/vendor/three.module.js';
import { mulberry } from '../../artkit/ground.js';
import { R, note } from '../core/util.js';
import { F, uP, vP, uM, vM, PS, lanePath, meadowU } from '../world.js';

/* r5 #6: small clay finds in the seams between regions (gate, stone, bucket, signpost) — FINAL17-style miniature props */
import { cullMesh } from '../journey/boardcull.js';
export function createFinds(scene, heightAt, route = null){ const g = new THREE.Group(); g.name = 'finds'; scene.add(g);
  const M = (c) => new THREE.MeshStandardMaterial({ color: c, roughness: 1 }), wood = M('#9a6b43'), woodD = M('#7a5233'), stoneM = M('#a9a294'),
    tin = M('#8f9aa0'), paint = M('#e9dfc8');
  const box = (w, h, d, m) => { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); o.castShadow = true; return o; };
  const make = { gate(){ const o = new THREE.Group(); for (const x of [-.15, .15]) o.add(box(.022, .12, .022, woodD).translateX(x).translateY(.06));
      for (const y of [.035, .07, .1]) o.add(box(.3, .014, .01, wood).translateY(y)); const d = box(.33, .012, .01, wood); d.position.y = .067;
        d.rotation.z = .36; o.add(d); return o; },
    stone(){ const o = new THREE.Mesh(new THREE.IcosahedronGeometry(.045, 1), stoneM); o.scale.set(1.3, .62,
      1); o.position.y = .018; o.castShadow = true; const w = new THREE.Group(); w.add(o);
      const s2 = o.clone(); s2.scale.set(.7, .45, .6); s2.position.set(.05, .01, .02); w.add(s2); return w; },
    bucket(){ const o = new THREE.Group(); const b = new THREE.Mesh(new THREE.CylinderGeometry(.03, .024, .045, 14, 1, true),
      tin); b.material.side = THREE.DoubleSide; b.position.y = .0225; b.castShadow = true; o.add(b);
      const base = new THREE.Mesh(new THREE.CircleGeometry(.024, 14), tin); base.rotation.x = -Math.PI / 2; base.position.y = .002; o.add(base);
      const h = new THREE.Mesh(new THREE.TorusGeometry(.029, .0025, 6, 16, Math.PI), woodD); h.position.y = .045; o.add(h); return o; },
    sign(){ const o = new THREE.Group(); o.add(box(.018, .2, .018, woodD).translateY(.1)); const a = box(.12, .032, .01, paint); a.position.set(.045, .165,
      0); o.add(a); const b = box(.1, .028, .01, paint); b.position.set(-.04, .125, 0); b.rotation.z = .06; o.add(b); return o; } };
  const Y = new THREE.Vector3(0, 1, 0), Q = new THREE.Quaternion();
  make.bridge = () => { const o = new THREE.Group(), st = M('#b9ae99'), stD = M('#8f8676'); const N = 9, Lb = .62, Hb = .07;
    for (let i = 0; i < N; i++){ const x0 = -Lb / 2 + i * Lb / N, xm = x0 + Lb / N / 2,
      y = Hb * Math.cos(Math.PI * xm / Lb); /* humped deck of dressed stones */
      const b = box(Lb / N + .004, .035, .2, st); b.position.set(xm, y, 0); b.rotation.z = -Math.sin(Math.PI * xm / Lb) * Math.PI * Hb / Lb; o.add(b);
      for (const zs of [-1, 1]){ const w = box(Lb / N + .002, .04, .018, i % 2 ? st : stD); w.position.set(xm, y + .035,
        zs * .092); w.rotation.z = b.rotation.z; o.add(w); } }
    for (const xs of [-1, 1]) o.add(box(.06, .05, .22, stD).translateX(xs * .31).translateY(.0));
    /* r7 #5: path flares onto each bank + a darker contact shadow where the abutments meet the turf */
    const pathM = M('#cdb98f'), shM = M('#4f6a2c');
    for (const xs of [-1, 1]){ for (let k = 0; k < 3; k++){ const f = box(.05, .006, .22 + k * .06, pathM); f.position.set(xs * (.36 + k * .045), .002,
      0); o.add(f); }
      const sh = box(.09, .003, .3, shM); sh.position.set(xs * .33, .0005, 0); sh.castShadow = false; o.add(sh); }
    return o; };
  const E0 = new THREE.Vector3(), MB = new THREE.Matrix4(), TX = new THREE.Vector3(), TZ = new THREE.Vector3();
  const put = (kind, u, v, yaw = 0) => { const d = F.dirOf(u, v); const o = make[kind](); o.position.copy(d).multiplyScalar(R + heightAt(d));
    E0.copy(F.dirOf(u + Math.cos(yaw) * .01, v + Math.sin(yaw) * .01)).sub(d); TX.copy(E0).addScaledVector(d, -E0.dot(d)).normalize(); TZ.crossVectors(TX, d);
    MB.makeBasis(TX, d, TZ); o.quaternion.setFromRotationMatrix(MB); g.add(o); return o; };
  /* r6 #4: stone bridge where the (moved) lane crosses the river */
  { const riv = (v) => -1.85 + .45 * Math.sin(v * .37) + .18 * Math.sin(v * 1.1 + 2) + .05 * Math.sin(v * 3.3), lp0 = lanePath();
    for (let i = 1; i < lp0.length; i++){ const [ua, va] = lp0[i - 1], [ub, vb] = lp0[i]; const fa = ua - riv(va), fb = ub - riv(vb);
      if (fa * fb <= 0){ const t = fa / (fa - fb), u = ua + (ub - ua) * t,
        v = va + (vb - va) * t; put('bridge', u, v, Math.atan2(vb - va, ub - ua)); note(`bridge at ${u.toFixed(2)},${v.toFixed(2)}`); } } }
  /* r6 #5: finds at the pond and mill edges, near where the cat arrives */
  { const [pu, pv] = [uP - 19 * PS, vP + 3 * PS], [mu, mv] = [uM - 2.4, vM + 0.6];
    put('bucket', pu - .5, pv + .25, .3); put('stone', pu + .45, pv - .3, 1.1); put('sign', pu - .3, pv - .5, .6);
    put('gate', mu + .5, mv + .35, 1.4); put('stone', mu - .45, mv - .3, .2); put('bucket', mu + .2, mv - .55, 0); }
  /* home frame: a field gate beside the path, a stone by the river, a bucket at a hedge corner, a signpost where the path leaves the board */
  put('gate', meadowU(-2.0) + .3, -2.0, .2); put('stone', -1.45, -5.0, .7); put('bucket', 2.45, -1.6, 0); put('sign', meadowU(-6.4) - .22, -6.4, -.4);
  /* transition zones along the lane toward the pond and the mill */
  const lp = lanePath(), at = (f) => lp[Math.round(f * (lp.length - 1))];
  [[.15, 'sign'], [.3, 'stone'], [.45, 'gate'], [.6, 'bucket'], [.75, 'stone'],
    [.88, 'sign']].forEach(([f, k], i) => { const [u, v] = at(f); put(k, u, v + (i % 2 ? .25 : -.25), i * 1.3); });

  /* journey: small finds along the ways (game/journey/route.js), same single merged mesh; every one gets a soft contact darkening */
  if (route){
    const fr = mulberry(31), blob = (r, m, sx = 1, sy = .6, sz = 1, y = 0, det = 1) => { const o = new THREE.Mesh(new THREE.IcosahedronGeometry(r, det), m); o.scale.set(sx, sy, sz); o.position.y = y; o.castShadow = true; return o; };
    const FL = ['#efe6cf', '#df9f92', '#e8c75e', '#b39bc8', '#f3ecd9', '#e8c75e'].map(M), leaf = M('#6f8f4a'), leafD = M('#587a3a'), flat = ['#b9ae99', '#a9a294', '#c2b59d'].map(M), warm = M('#c9ad82'),
      yarnM = M('#c4604a'), yarnD = M('#a54a39'), mit = M('#b8372f'), mitC = M('#e9dfc8'), bark = M('#7d5a3c'), barkE = M('#c9a67a'), moss = M('#6f8f4a'), shade = M('#2c3a1a'),
      rust = M('#b87a5c'), rustD = M('#94603f'), cush = M('#c9916f'), steel = M('#8f9aa0');
    // soft contact darkening: a disc whose alpha falls from .5 at the centre to 0 at the rim (baked below); it faces down, so the
    // shadow pass (shadowSide = FrontSide) skips it while the colour pass (DoubleSide) still draws it
    const disc = (r, sy = 1) => { const o = new THREE.Mesh(new THREE.CircleGeometry(r, 14), shade); o.rotation.x = Math.PI / 2; o.position.y = .004; o.scale.y = sy; o.userData.shade = .5; return o; };
    const J = {
      yarn(){ const o = new THREE.Group(); o.add(disc(.05)); o.add(blob(.034, yarnM, 1, .95, 1, .034));
        for (let i = 0; i < 3; i++){ const t = new THREE.Mesh(new THREE.TorusGeometry(.035, .0045, 5, 18), yarnD); t.position.y = .034; t.rotation.set(.9 + i * .5, i * 1.1, i * .7); o.add(t); }
        const tail = new THREE.Mesh(new THREE.TorusGeometry(.03, .004, 5, 12, 4), yarnM); tail.rotation.x = -Math.PI / 2; tail.position.set(.045, .005, .01); o.add(tail); return o; },
      catnip(){ const o = new THREE.Group(); o.add(disc(.075)); for (let i = 0; i < 9; i++){ const a = i * 2.4, r = .012 + fr() * .04, l = blob(.022 + fr() * .01, i % 2 ? leaf : leafD, 1.3, .55, 1, .012 + fr() * .015, 0);
          l.position.x = Math.cos(a) * r; l.position.z = Math.sin(a) * r; l.rotation.y = a; o.add(l); } return o; },
      log(){ const o = new THREE.Group(); o.add(disc(.075, .55)); const c = new THREE.Mesh(new THREE.CylinderGeometry(.03, .034, .13, 9), bark); c.rotation.z = Math.PI / 2; c.position.y = .03; c.castShadow = true; o.add(c);
        for (const x of [-1, 1]){ const e = new THREE.Mesh(new THREE.CircleGeometry(.03, 9), barkE); e.rotation.y = x * Math.PI / 2; e.position.set(x * .066, .03, 0); o.add(e); }
        const mo = blob(.022, moss, 1.5, .4, 1, .06); mo.position.x = -.01; o.add(mo); return o; },
      mitten(){ const o = new THREE.Group(); o.add(disc(.06)); const h = blob(.03, mit, 1, .5, 1.2, .016); o.add(h); const th = blob(.015, mit, 1.2, .6, .8, .016); th.position.set(.018, 0, .028); th.rotation.y = .7; o.add(th);
        const cu = new THREE.Mesh(new THREE.CylinderGeometry(.027, .027, .014, 10), mitC); cu.rotation.z = Math.PI / 2; cu.position.set(-.034, .02, 0); cu.castShadow = true; o.add(cu); o.rotation.y = 0; return o; },
      birdbath(){ const o = new THREE.Group(); o.add(disc(.07)); const f = new THREE.Mesh(new THREE.CylinderGeometry(.02, .028, .05, 9), flat[1]); f.position.y = .025; f.castShadow = true; o.add(f);
        const b = new THREE.Mesh(new THREE.CylinderGeometry(.06, .035, .018, 12), flat[0]); b.position.y = .058; b.castShadow = true; o.add(b);
        const w = new THREE.Mesh(new THREE.CircleGeometry(.05, 12), M('#9bb2b0')); w.rotation.x = -Math.PI / 2; w.position.y = .068; o.add(w); return o; },
      warmstone(){ const o = new THREE.Group(); o.add(disc(.1, .8)); const a = new THREE.Mesh(new THREE.CylinderGeometry(.06, .068, .018, 8), warm); a.position.y = .01; a.scale.z = .8; a.castShadow = true; o.add(a); return o; },
      drift(){ const o = new THREE.Group(); o.add(disc(.3, .6)); for (let i = 0; i < 22; i++){ const a = fr() * 6.28, r = Math.sqrt(fr()) * .36, h = .025 + fr() * .035, g = new THREE.Group();
          const st = new THREE.Mesh(new THREE.BoxGeometry(.005, h, .005), leaf); st.position.y = h / 2; g.add(st);
          const hd = blob(.017 + fr() * .009, FL[Math.floor(fr() * FL.length)], 1, .6, 1, h, 0); g.add(hd); g.position.set(Math.cos(a) * r, 0, Math.sin(a) * r * .6); o.add(g); } return o; },
      stile(){ const o = new THREE.Group(), wd = M('#9a6b43'), wdD = M('#7a5233'), bx = (w, h, d, m) => { const q = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); q.castShadow = true; return q; };
        o.add(disc(.12, .7)); for (const x of [-.11, .11]) o.add(bx(.02, .1, .02, wdD).translateX(x).translateY(.05)); o.add(bx(.26, .014, .012, wd).translateY(.088));
        o.add(bx(.11, .014, .05, wd).translateY(.03).translateZ(.045)); o.add(bx(.05, .02, .04, stoneM).translateY(.01).translateZ(.09)); return o; },
      sleepStone(){ const o = new THREE.Group(); o.add(disc(.28, .85)); const a = new THREE.Mesh(new THREE.CylinderGeometry(.2, .23, .045, 14), warm); a.position.y = .022; a.scale.z = .85; a.castShadow = true; a.receiveShadow = true; o.add(a);
        const b = new THREE.Mesh(new THREE.CylinderGeometry(.16, .17, .02, 12), M('#d3bb92')); b.position.y = .05; b.scale.z = .85; o.add(b); return o; },
      sleepCushion(){ const o = new THREE.Group(); o.add(disc(.26)); const a = new THREE.Mesh(new THREE.CylinderGeometry(.19, .2, .06, 16), rust); a.position.y = .03; a.castShadow = true; o.add(a);
        const r = new THREE.Mesh(new THREE.TorusGeometry(.185, .022, 6, 18), rustD); r.rotation.x = Math.PI / 2; r.position.y = .055; o.add(r);
        const t = new THREE.Mesh(new THREE.CylinderGeometry(.15, .15, .02, 14), cush); t.position.y = .062; o.add(t); return o; } };
    Object.assign(make, J);
    for (const f of [...route.finds, ...route.sleep]) put(f.kind, f.u, f.v, f.yaw);
    note(`journey: ${route.finds.length} finds + ${route.sleep.length} sleep spots`);
  }
  /* r6 #5: bake every find into ONE vertex-coloured mesh (1 draw + its shadow pass) */
  g.updateMatrixWorld(true); const pos = [], nor = [], col = [], C = new THREE.Color();
  /* QA r3 #2: per-vertex prop centre + radius (foldC) so journey/boardcull.js drops a whole find near the board's edge */
  const fc = [], top = (o) => { while (o.parent && o.parent !== g) o = o.parent; return o; }, SPH = new Map(), bb = new THREE.Box3(), sp = new THREE.Sphere();
  for (const t of g.children){ bb.setFromObject(t); bb.getBoundingSphere(sp); SPH.set(t, [sp.center.x, sp.center.y, sp.center.z, Math.min(sp.radius, .6)]); }
  g.traverse(o => { if (!o.isMesh) return; const ge = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone(), sh = o.userData.shade, P = ge.attributes.position;
    const al = []; if (sh){ const rr = o.geometry.parameters.radius; for (let i = 0; i < P.count; i++) al.push(sh * (1 - Math.min(1, Math.hypot(P.getX(i), P.getY(i)) / rr))); }
    ge.applyMatrix4(o.matrixWorld); const Nn = ge.attributes.normal; C.copy(o.material.color);
    const cs = SPH.get(top(o)) || [0, 0, 0, 1]; for (let i = 0; i < P.count; i++){ fc.push(...cs); pos.push(P.getX(i), P.getY(i), P.getZ(i)); nor.push(Nn.getX(i), Nn.getY(i), Nn.getZ(i)); col.push(C.r, C.g,
      C.b, sh ? al[i] : 1); } ge.dispose(); });
  scene.remove(g); const mg = new THREE.BufferGeometry(); mg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    mg.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); mg.setAttribute('color', new THREE.Float32BufferAttribute(col, 4)); mg.setAttribute('foldC', new THREE.Float32BufferAttribute(fc, 4));
  /* journey: RGBA vertex colours (alpha only on the contact discs) → a transparent pass, still 1 draw (forceSinglePass); the mesh sits at the
     planet centre, so it sorts first among the transparent sprites drawn over it */
  const one = new THREE.Mesh(mg, new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide, shadowSide: THREE.FrontSide, transparent: true, forceSinglePass: true }));
    one.castShadow = true; one.receiveShadow = true; one.name = 'finds'; cullMesh(one); scene.add(one);
  note(`finds: ${g.children.length} props → 1 mesh, ${pos.length / 9 | 0} tris`); return one; }
