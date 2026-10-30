// diorama clouds: small puffs floating ~3 m over the board (FINAL17 has one or two above the board's far edge); their shade is painted by the ground shader
import { createClouds } from '../../artkit/sprites.js';
import { R, qs, DEBUG, safe } from '../core/util.js';
import { F } from '../world.js';

export function createCloudLayer(scene, heightAt){
  /* r6 BUG FIX: fixed clouds were placed at R + h, but the home ground sits ~1.1 m above R (heightAt), so they were buried under the turf.
     Heights are now above local ground. */
  const clouds = qs.has('noclouds') ? null : safe('clouds',
    () => createClouds(scene, R, F, [-45, 45, -45, 45], 14, 4,
  /* r7 #6: thinner far cloud field */ { size: [1.1, 2.0], alt: [2.6, 3.6], keepOut: [0.3, -3.5, 9],
  fixed: [[0.35, -1.05, .95, .72, 0], [-1.75, -1.75, .5, .78, 1]].map(([u, v, sz, h, c]) => [u, v, sz, h + heightAt(F.dirOf(u, v)), c]) }));
  return { update(dt, camera, T, ground){
    clouds?.update?.(dt, camera);
    /* r10 #1: two big soft cloud shadows drift slowly over the home frame; centres in board-local metres, applied after lighting in ground.js */
    const CS = ground.uCS.value, csk = +(qs.get('csk') || 1);
    [[((T * .02 + 9) % 24) - 12, 1, 4.2], [12 - ((T * .015 + 8) % 24), -2.2, 3.4]].forEach(([u, v, r], i) => CS[i].set(u, v, 0, r * csk));
      /* board-local metres; ~20 and ~27 min per crossing, off-board before wrapping */
    if (DEBUG) window._cs = CS.map(c => c.toArray().map(x => +x.toFixed(4)));
  } };
}
