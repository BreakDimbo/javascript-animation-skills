// sprite trees on the shader-painted hedges (same Voronoi maths in JS), re-planted around the cat as it travels
import * as THREE from '../../shared/vendor/three.module.js';
import { mulberry } from '../../artkit/ground.js';
import { createTrees } from '../../artkit/sprites.js';
import { MF, mfCells, mfEdgeHash, mfHash, mfHedge } from '../../artkit/minifields.js';
import { R, qs, safe } from '../core/util.js';
import { F, lanePath, meadowPath, riverPath } from '../world.js';

const TREE_S = +(qs.get('trees') ?? 0.115); // miniature: trees ≈ 2× the cat, as trees are ≈ 2× a sheep in the reference
const CLEAR = [[0.3, -4.3, .9], [0.3, -0.9, 1.9], ...riverPath().map(([u, v]) => [u, v, .75]), ...meadowPath()[0].map(([u, v]) => [u, v, .3]),
  ...lanePath().map(([u, v]) => [u, v, .3]), [-0.2, -1.6, .5]];
export const RIM = [[-3.15, -6.15, 1.9, 9], [-2.7, -6.55, 1.5, 11], [-3.45, -5.7, 1.3, 12], [3.35, -6.25, 2.0, 8], [3.85, -5.85, 1.5, 10],
  [2.9, -6.6, 1.4, 13], [3.7, -0.6, 1.6, 9], [3.95, -3.1, 1.3, 11], [-0.6, -0.35, 1.25, 10]];
const HOME0 = F.dirOf(0, 0);
/* ground-r4: local terrain normal (finite differences over ±.35 m): tree blob shadows lie on the slope instead of sinking into it (a sunk quad left only a thin dark dash) */
function groundN(dir, heightAt){ const E = new THREE.Vector3(0, 1, 0).cross(dir).normalize(), N = E.clone().cross(dir).normalize(), e = .35;
  const at = (a, b) => { const d = dir.clone().addScaledVector(E, a / R).addScaledVector(N, b / R).normalize(); return d.multiplyScalar(R + heightAt(d)); };
  const n = at(e, 0).sub(at(-e, 0)).cross(at(0, e).sub(at(0, -e))).normalize(); return n.dot(dir) < 0 ? n.negate() : n; }
function miniTrees(c, rad, heightAt, avoid){
  const E = new THREE.Vector3(0, 1, 0).cross(c).normalize(), N = E.clone().cross(c), out = [], P = new THREE.Vector3(), rnd = mulberry(7);
  for (let y = -rad; y <= rad; y += .7) for (let x = -rad; x <= rad; x += .7){
    if (x * x + y * y > rad * rad) continue;
    P.copy(c).multiplyScalar(R).addScaledVector(E, x).addScaledVector(N, y).setLength(R);
    const q = mfCells([P.x, P.y, P.z]); if (Math.abs(q.d) > .3) continue;
    const eh = mfEdgeHash(q.id1, q.id2); if (P.angleTo(HOME0) * R < 14 ? !mfHedge(q.id1, q.id2) : eh >= MF.hedgeP) continue;
    /* w2: in the home frame trees sit only on the real hedge rows (ground-r4: mfHedge outlines); away from home all boundaries, so pond / mill / far frames keep their trees */
    const h = mfHash(Math.round(P.x / .7) + .5, Math.round(P.y / .7) + .5, Math.round(P.z / .7) + .5);
    // r4: FINAL17 clusters round trees at hedge junctions; a junction is where a third field appears a short step along the hedge
    const t = new THREE.Vector3(...q.n).cross(c), j1 = mfCells([P.x + t.x * .5, P.y + t.y * .5, P.z + t.z * .5]),
      j2 = mfCells([P.x - t.x * .5, P.y - t.y * .5, P.z - t.z * .5]);
    const key = (a) => a.join(','), ids = new Set([key(q.id1), key(q.id2), key(j1.id1), key(j1.id2), key(j2.id1), key(j2.id2)]), junc = ids.size > 2;
    if (h[0] > (junc ? .5 : .06 + .1 * (eh < .12))) continue;
    // snap onto the hedge line
    const n = new THREE.Vector3(...q.n); P.addScaledVector(n, -q.d).setLength(R);
    const dir = P.clone().normalize(); if (avoid.some(([a, r]) => dir.angleTo(a) * R < r)) continue;
    { const [tu, tv] = F.toUV(dir); if (CLEAR.some(([a, b, r]) => Math.abs(a - tu) < r && Math.abs(b - tv) < r && Math.hypot(a - tu, b - tv) < r)) continue; }
    out.push({ dir, h: heightAt(dir), n: groundN(dir, heightAt), s: TREE_S * (.75 + .6 * h[1]),
      cell: 8 + ((h[2] * 6) | 0) /* r6: no random pinks; the one pink tree is placed by hand */ });
  }
  /* r5: FINAL17's rim clumps: ~8 big round trees in overlapping groups at the board's corners and edges (bottom-left and bottom-right groups) */
  for (const [u, v, k, cell] of RIM){ const d = F.dirOf(u, v); if (d.angleTo(c) * R < rad) out.push({ dir: d, h: heightAt(d), n: groundN(d, heightAt), s: TREE_S * k, cell }); }
  // the one pink tree, left of the river like FINAL17's
  { const d = F.dirOf(-3.0, -0.4); if (d.angleTo(c) * R < rad) out.push({ dir: d, h: heightAt(d), n: groundN(d, heightAt), s: TREE_S * 1.1, cell: 14 }); }
  return out;
}

// avoid: [[dir, radius m]] keep-out circles collected from the regions
export function createTreePlanter(scene, heightAt, avoid){
  let trees = null, plantC = null;
  const plant = (c) => { trees?.dispose?.(); const list = miniTrees(c, 24, heightAt, avoid); trees = safe('trees',
    () => createTrees(scene, list, R)); return list.length; };
  return { plant: (c) => { plantC = c.clone(); return plant(plantC); },
    follow(up){ if (up.angleTo(plantC) * R > 7){ plantC.copy(up); plant(plantC); } },
    update(sd){ trees?.update?.(sd); } };
}
