// barn swallows between the regions (from team-w7's swallows.js): ONE pair at a time crosses the board low on a gentle curve, then the
// sky stays empty for a while. One dynamic vertex-coloured mesh (1 draw call), flat-shaded matte, no shadow, no trails.
import * as THREE from '../../shared/vendor/three.module.js';
import { mulberry } from '../../artkit/ground.js';

const NAVY = new THREE.Color('#3b4460'), WING = new THREE.Color('#353d57'), CREAM = new THREE.Color('#e4dac4');
const TRIS = 15, MAXB = 2; // per bird: body 8 tris, tail 3, wings 2×2
const CROSS = 6.5, GAP = 16; // seconds over the board, seconds of empty sky between passes

export function createSwallows(scene, { R, heightAt }){
  const pos = new Float32Array(MAXB * TRIS * 9), nor = new Float32Array(pos.length), col = new Float32Array(pos.length);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
  geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3).setUsage(THREE.DynamicDrawUsage));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const mesh = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide }));
  mesh.frustumCulled = false; mesh.name = 'swallows'; mesh.visible = false; scene.add(mesh);
  const sm = THREE.MathUtils.smoothstep, rnd = mulberry(404);
  // a pass: a chord across the board frame, fixed in the world when it starts (so the cat walking does not drag the birds along)
  const pass = { t: -4, F: new THREE.Vector3(), X: new THREE.Vector3(), Y: new THREE.Vector3(), a: 0, off: 0, bend: 0, alt: .5 };
  const birds = [{ k: 0, flap: .3, bank: 0 }, { k: 1, flap: 1.4, bank: 0 }];
  const d = new THREE.Vector3(), d2 = new THREE.Vector3(), fw = new THREE.Vector3(), rt = new THREE.Vector3(), P0 = new THREE.Vector3(), up = new THREE.Vector3();
  const V = []; for (let i = 0; i < 6; i++) V.push(new THREE.Vector3());
  let w = 0;
  function tri(a, b, c, color){
    const o = w * 9; w++;
    const nx = (b.y - a.y) * (c.z - a.z) - (b.z - a.z) * (c.y - a.y), ny = (b.z - a.z) * (c.x - a.x) - (b.x - a.x) * (c.z - a.z), nz = (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
    const l = Math.hypot(nx, ny, nz) || 1;
    [a, b, c].forEach((p, i) => { pos[o + i * 3] = p.x; pos[o + i * 3 + 1] = p.y; pos[o + i * 3 + 2] = p.z; nor[o + i * 3] = nx / l; nor[o + i * 3 + 1] = ny / l; nor[o + i * 3 + 2] = nz / l;
      col[o + i * 3] = color.r; col[o + i * 3 + 1] = color.g; col[o + i * 3 + 2] = color.b; });
  }
  const S = .8; // body ≈ .17 m, span ≈ .34 m: smaller than the cat, bigger than a butterfly
  const W = (x, y, z, bank, out) => { const c = Math.cos(bank), s = Math.sin(bank), xr = x * c - y * s, yr = x * s + y * c;
    return out.copy(P0).addScaledVector(rt, xr * S).addScaledVector(up, yr * S).addScaledVector(fw, z * S); };
  // board-local metres along the pass chord at progress s (0..1): enters 7 m out, leaves 7 m out on the far side, bowed sideways by `bend`
  const chord = (s, side) => { const L = 7, x = -L + 2 * L * s, y = pass.off + pass.bend * (1 - (2 * s - 1) ** 2) + side, c = Math.cos(pass.a), si = Math.sin(pass.a);
    return [x * c - y * si, x * si + y * c]; };
  const dirAt = (xy, out) => out.copy(pass.F).multiplyScalar(R).addScaledVector(pass.X, xy[0]).addScaledVector(pass.Y, xy[1]).normalize();

  return { mesh,
    /** board: fcam.board (F, X, Y unit vectors of the visible board); on: false → no new pass starts (a pass in flight finishes) */
    update(dt, T, board, on){
      pass.t += dt; w = 0;
      if (pass.t > CROSS + GAP && on){ pass.t = 0; pass.F.copy(board.F); pass.X.copy(board.X); pass.Y.copy(board.Y);
        pass.a = rnd() * 6.283; pass.off = (rnd() - .5) * 3; pass.bend = (rnd() - .5) * 3; pass.alt = .38 + rnd() * .25; }
      if (pass.t < 0 || pass.t > CROSS){ mesh.visible = false; return; }
      for (const b of birds){
        const tt = pass.t - b.k * .45, s = tt / CROSS; if (s < 0 || s > 1) continue;
        const side = b.k * .3 * Math.sin(T * .7), p = chord(s, side), p2 = chord(Math.min(1.01, s + .01), side);
        dirAt(p, d); dirAt(p2, d2);
        // low over the board, dipping toward the grass at mid-crossing
        const alt = pass.alt + b.k * .08 - .22 * Math.sin(Math.PI * s) ** 2 + .04 * Math.sin(T * 1.3 + b.flap);
        P0.copy(d).multiplyScalar(R + heightAt(d) + alt); up.copy(d);
        fw.copy(d2).sub(d); fw.addScaledVector(d, -fw.dot(d)).normalize(); rt.crossVectors(up, fw).normalize();
        const target = -pass.bend * .12 + Math.sin(T * .8 + b.flap) * .08; b.bank += (target - b.bank) * Math.min(1, dt * 1.5);
        // wings: a short flap burst then a long glide, wings held a little up
        const cy = (T * .3 + b.flap) % 1, fl = cy < .4 ? sm(cy, 0, .05) * (1 - sm(cy, .35, .4)) : 0;
        const f = .16 + fl * Math.sin(T * 13 + b.flap * 5) * .62, bk = b.bank, v = V;
        const nose = W(0, 0, .12, bk, v[0]), tailB = W(0, 0, -.085, bk, v[1]), top = W(0, .028, .01, bk, v[2]), bot = W(0, -.032, 0, bk, v[3]), lf = W(-.032, 0, .01, bk, v[4]), rg = W(.032, 0, .01, bk, v[5]);
        tri(nose, top, rg, NAVY); tri(nose, lf, top, NAVY); tri(tailB, rg, top, NAVY); tri(tailB, top, lf, NAVY);
        tri(nose, rg, bot, CREAM); tri(nose, bot, lf, CREAM); tri(tailB, bot, rg, CREAM); tri(tailB, lf, bot, CREAM);
        const t0 = W(-.02, 0, -.075, bk, v[0]), t1 = W(.02, 0, -.075, bk, v[1]), tn = W(0, 0, -.11, bk, v[2]), tl = W(-.05, 0, -.215, bk, v[3]), tr = W(.05, 0, -.215, bk, v[4]);
        tri(t0, t1, tn, WING); tri(t0, tn, tl, WING); tri(tn, t1, tr, WING);
        for (const s2 of [-1, 1]){ const r0 = W(s2 * .02, 0, .06, bk, v[0]), r1 = W(s2 * .02, 0, -.05, bk, v[1]);
          const el = W(s2 * .12 * Math.cos(f), .12 * Math.sin(f), .035, bk, v[2]), tp = W(s2 * .21 * Math.cos(f * 1.1), .21 * Math.sin(f * 1.1), -.07, bk, v[3]);
          tri(r0, el, r1, WING); tri(el, tp, r1, WING); }
      }
      mesh.visible = w > 0; geo.setDrawRange(0, w * 3);
      geo.attributes.position.needsUpdate = geo.attributes.normal.needsUpdate = geo.attributes.color.needsUpdate = true;
    },
    // debug / shots: start a pass now
    pass(){ pass.t = CROSS + GAP + 1; } };
}
