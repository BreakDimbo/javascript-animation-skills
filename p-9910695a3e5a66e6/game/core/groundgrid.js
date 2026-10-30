// the painted board + ground material, the coarse far sphere and the fine follow-the-cat height grid
import * as THREE from '../../shared/vendor/three.module.js';
import { paintBoard, groundMaterial } from '../../artkit/ground.js';
import { mfCells } from '../../artkit/minifields.js';
import { F, REG, lanePath, boardSpec, loopPath, STATION_UV } from '../world.js';
import { onCatHc } from '../catScale.js';
import { R, qs, MOBILE, note } from './util.js';

// baked PNG if present, else painted live
async function loadBoard(){
  const tag = MOBILE ? '2048' : '4096';
  try { const js = await (await fetch(`./baked/board_${tag}.json`)).json();
    const img = async (n) => { const i = new Image(); i.src = `./baked/${n}_${tag}.png`; await i.decode(); return i; };
    const [cv, mk] = await Promise.all([img('board'), img('mask')]); return { ...js, canvas: cv, mask: mk, baked: true };
  } catch (e) { return paintBoard(boardSpec(MOBILE ? 2048 : 4096)); }
}

// heightAt(dir) → metres above R (the registry's sum of region terms)
export async function createGroundGrid(scene, FADE, heightAt){
  const board = await loadBoard();
  note(`board ${board.W}×${board.H} · ${board.hedges.length} hedges · ${board.trees.length} trees`);
  /* hedge r1 (review-vd-scale-1700 #2, review-vd-station-r3 #3): no hedge across the cat's loop path; the dark diagonal at the platform's lower left
     was an mfHedge edge (u 120.9–122.6, v −3.6…−0.85): a keep disc removes it (no shrub clumps: optional, and not verifiable without shots) */
  const [Su, Sv] = STATION_UV, hedgeKeep = { paths: [loopPath().map(p => [p[0], p[1]])], discs: [{ u: Su + 2.05, v: Sv + 2.3, r: 1.9, f: .5 }], res: .125 };
  const gmat = groundMaterial(board, F, { stampBoxes: boardSpec(8).stampBoxes, lane: { laneU: [lanePath()[0][0], lanePath().at(-1)[0]] }, hedgeKeep });
  onCatHc((h) => { gmat.userData.ground.uHc.value = h; }); if (qs.has('hedgedbg')) gmat.userData.ground.uHedDbg.value = 1; /* hedges are sized in Hc, live */
  if (qs.has('nomini')) gmat.userData.ground.uMini.value = 0; gmat.userData.ground.uFade.value.set(FADE[0], FADE[1], 9); note('ground material');
  { const wd = F.dirOf(3.0, -5.95).multiplyScalar(R),
    q = mfCells([wd.x, wd.y, wd.z]); gmat.userData.ground.uWheatId.value.set(...q.id1); } /* r5: wheat corner, bottom-right of the home frame */
  REG.filter(r => r.id !== 'meadow').slice(0, 4).forEach((r, i) => gmat.userData.ground.uNoWheat.value[i].set(r.dir.x, r.dir.y, r.dir.z, Math.cos((r.rad + 14) / R))); /* QA r3 #4 */
  { const pc = REG[1].dir.clone().multiplyScalar(R); gmat.userData.ground.uCalm.value.set(pc.x, pc.y, pc.z, 26); } /* d15: the pond's calm lawn (vd r4.1 #2) */
  { const sc = (REG.find(r => r.id === 'station') || REG[4]).dir.clone().normalize().multiplyScalar(R); gmat.userData.ground.uCalm2.value.set(sc.x, sc.y, sc.z, 13); } /* m-loop T1: the halt's calm lawn — full within 7.8 m of the station (its arrival board reaches 6.8 m), back to the patchwork by 13 m */

  // coarse far sphere + fine follow-grid
  const farMat = new THREE.MeshLambertMaterial({ map: gmat.map, fog: false }); const uHole = { value: new THREE.Vector4(0, 0, 1, 2) };
  farMat.onBeforeCompile = (s) => { gmat.onBeforeCompile(s); s.uniforms.uHole = uHole; s.fragmentShader = s.fragmentShader.replace('uniform vec3 uC,',
    'uniform vec4 uHole; uniform vec3 uC,')
    .replace('vec3 dir = normalize(vGW);', 'vec3 dir = normalize(vGW); if (dot(dir, uHole.xyz) > uHole.w) discard;'); };
      farMat.customProgramCacheKey = () => 'fold-ground-far';
  const far = new THREE.Mesh(new THREE.SphereGeometry(R - 0.05, 256, 160), farMat); far.receiveShadow = false; scene.add(far);
  const GN = MOBILE ? 140 : 180, GH = 0.5;
  const ggeo = new THREE.BufferGeometry(); const gpos = new Float32Array((GN + 1) ** 2 * 3), guv = new Float32Array((GN + 1) ** 2 * 2), gidx = [];
  for (let j = 0; j < GN; j++) for (let i = 0; i < GN; i++){ const a = j * (GN + 1) + i, b = a + 1, c = a + GN + 1, d = c + 1; gidx.push(a, b, c, b, d, c); }
  ggeo.setIndex(gidx); ggeo.setAttribute('position', new THREE.BufferAttribute(gpos, 3)); ggeo.setAttribute('uv', new THREE.BufferAttribute(guv, 2));
  const grid = new THREE.Mesh(ggeo, gmat); grid.receiveShadow = true; grid.frustumCulled = false; scene.add(grid);
  const hcache = new Map(), WD = new THREE.Vector3(); let gridC = [1e9, 1e9];
  function rebuildGrid(u0, v0){
    const ci = Math.round(u0 / GH) - GN / 2, cj = Math.round(v0 / GH) - GN / 2; gridC = [u0, v0];
    for (let j = 0; j <= GN; j++) for (let i = 0; i <= GN; i++){
      const I = ci + i, J = cj + j, key = I * 65536 + J, u = I * GH, v = J * GH; F.dirOf(u, v, WD);
      let h = hcache.get(key); if (h === undefined) { h = heightAt(WD); hcache.set(key, h); }
      const k = (j * (GN + 1) + i) * 3; gpos[k] = WD.x * (R + h); gpos[k + 1] = WD.y * (R + h); gpos[k + 2] = WD.z * (R + h);
    }
    if (hcache.size > 400000) hcache.clear();
    ggeo.attributes.position.needsUpdate = true; F.dirOf(u0, v0, WD); uHole.value.set(WD.x, WD.y, WD.z, Math.cos((GN / 2 - 2) * GH / R));
      ggeo.computeVertexNormals(); ggeo.computeBoundingSphere();
  }
  // rebuild once the cat has walked 12 m from the last grid centre (force: first build / teleport)
  function update(up, force = false){ const [cu, cv] = F.toUV(up); if (force || Math.hypot(cu - gridC[0], cv - gridC[1]) > 12) rebuildGrid(cu, cv); }
  return { board, gmat, ground: gmat.userData.ground, far, grid, rebuildGrid, update };
}
