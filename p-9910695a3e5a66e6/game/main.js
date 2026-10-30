// 褶星 Fold — playable MVP. Orchestration only: the regions (game/regions/*) own their module, scale, height, activation and update;
// core/* owns the renderer, lights, painted ground and input. One painted board (gnomonic frame on the home meadow) carries the whole planet.
import { hookBend } from '../artkit/bend.js';
import { reskin } from '../artkit/clay.js';
import { createCat, updateCat } from '../artkit/cat.js';
import { R, qs, note, safe, bootLog } from './core/util.js';
import { createRender } from './core/render.js';
import { createLights } from './core/lights.js';
import { createGroundGrid } from './core/groundgrid.js';
import * as THREE from '../shared/vendor/three.module.js';
import { SHEEP_CAM } from '../artkit/dioramacam.js';
import { createCamRig } from './core/camrig.js';
import { createPortraitCam } from './journey/portraitcam.js';
import { createInput } from './core/input.js';
import { createCard } from './ui/card.js';
import { createSketchbook } from './ui/sketchbook.js';
import { createWayfinding } from './ui/wayfinding.js'; // D2 hook
import { createTitles } from './ui/titles.js';
import { createTouchKeys } from './ui/touch.js';
import { F, REG, STATION_MODULE, placeStation, STATION_UV, loopPath } from './world.js';
import { REGIONS, register, byId, regionAt, activeRegions, heightAt, blocked, avoidList, updateActivation, teleportFor, teleportDir } from './regions/registry.js';
import { createMeadowRegion, loadMeadowBake } from './regions/meadow.js';
const meadowBake = loadMeadowBake();   // fetch + decode the baked meadow ground while the rest of the boot runs
import { createPondRegion } from './regions/pond.js';
import { createMillRegion } from './regions/mill.js';
import { createSealbayRegion } from './regions/sealbay.js';
import * as stationMod from './regions/station.js';
import { createTreePlanter } from './props/trees.js';
import { createCloudLayer } from './props/clouds.js';
import { createFinds } from './props/finds.js';
import { buildRoute } from './journey/route.js';
import { createWild } from './journey/wild.js';
import { createSleep, savedSpawn } from './journey/sleep.js';
import { loopInfo, createBeltTerrain, createBelts } from './journey/belts.js';
import { createLoop } from './journey/loop.js';
import { createAudio } from './audio/audio.js';
import { createQA } from './journey/qa.js';
import { createPerf } from './core/perf.js'; // m-perf: board culling, far-region pause, ?perf stats
// the station's spot comes from m-station (STATION_DIR in regions/station.js), or ?stationAt=u,v; set before anything samples the loop
{ const q = (qs.get('stationAt') || '').split(',').map(Number), d = stationMod.STATION_DIR;
  if (q.length === 2 && q.every(isFinite)) placeStation(q[0], q[1]); else if (d) placeStation(...F.toUV(d));
  // check: the path must pass the platform's camera side (platform centre ≈ 1.05 m south of the track line), not cross it
  const [Su, Sv] = STATION_UV, P = loopPath(); let best = Infinity, bi = 0; P.forEach((p, i) => { const d2 = Math.hypot(p[0] - Su, p[1] - (Sv + 1.05)); if (d2 < best){ best = d2; bi = i; } });
  window.__stationCheck = { at: [+Su.toFixed(2), +Sv.toFixed(2)], platformDist: +best.toFixed(2), side: P[bi][1] > Sv + 1.05 ? 'south (camera side)' : 'NORTH (track side!)' };
  note(`station at ${Su.toFixed(2)},${Sv.toFixed(2)} · path passes ${best.toFixed(2)} m from the platform centre, ${window.__stationCheck.side}`); }

export { R };
const titles = createTitles(); // the title card doubles as the calm loading card
const { renderer, scene, camera, FADE } = createRender();
const lights = createLights(scene);

// ---------- world: regions, painted ground, props ----------
note('start modules');
// m-loop load cut: pond, mill and seal bay sit 78–97 m out on the loop, outside the first ground grid (±45 m) and the first view, so
// without ?at=… they are built right after the first frames instead of before them (mill alone is ~6 s of clay-material work here)
const EAGER = qs.has('at') || qs.has('eager');
const meadow = register(createMeadowRegion(scene, await meadowBake)); let pond = null, mill = null;
const lateRegions = async () => { addStation(); await new Promise(r => setTimeout(r, 30)); pond = register(safe('pond', () => createPondRegion(scene))); await new Promise(r => setTimeout(r, 30));
  mill = register(safe('mill', () => createMillRegion(scene))); await new Promise(r => setTimeout(r, 30));
  register(await createSealbayRegion(scene).catch(e => (note('sealbay × ' + e.message), null))); note('late regions'); if (renderer.extensions.has('KHR_parallel_shader_compile')) renderer.compileAsync(scene, camera).catch(() => {}); if (window.__fold) Object.assign(window.__fold, { pond: pond?.module, mill: mill?.module }); };
if (EAGER){ pond = register(createPondRegion(scene)); mill = register(createMillRegion(scene)); }
// m-loop: the station (m-station's game/regions/station.js) — optional; the loop walks past its spot when it is missing
// 02 小站 (m-station's game/regions/station.js, placed by REG 'station' no '02'); the loop walks past its spot if it is missing / ?nostation
const addStation = () => { if (STATION_MODULE && !qs.has('nostation')) register(safe('station', () => (stationMod.createStationRegion || stationMod.default)(scene))); };
if (EAGER) addStation();
note('modules done');
// m-loop: the loop path + belts; the dunes are real relief, so their terrain registers before the ground grid samples heightAt
const loopI = loopInfo(), beltTerrain = register(createBeltTerrain(loopI));
const ground = await createGroundGrid(scene, FADE, heightAt);
const clouds = createCloudLayer(scene, heightAt);
if (EAGER) register(await createSealbayRegion(scene));
const route = buildRoute(); createFinds(scene, heightAt, route); // the journey: finds, sleep stones, warrens and drifts between the regions
const belts = qs.has('nobelts') ? null : safe('belts', () => createBelts(scene, heightAt, loopI, beltTerrain));

// ---------- cat, camera, input ----------
const tp = teleportFor(qs.get('at')); // ?at=<region id> | u,v
const catPlanet = { R, spawnUp: savedSpawn() || teleportDir(tp || { u: 0.3, v: -4.3 }), colliders: [], heightAt, blocked };
const cat = createCat(scene, catPlanet); cat.root.scale.setScalar(qs.has('close') ? 1 : 1.25);
/* r9 review #1: hero reads at FINAL17-sheep size in the default frame (visual only; colliders/world scale untouched) */
const trees = createTreePlanter(scene, heightAt, avoidList()); note(`mini trees ${trees.plant(catPlanet.spawnUp)}`);
note(`cat: ${reskin(cat.root, { grain: 30 })} materials → clay`);
const rig = createCamRig(camera, renderer.domElement, scene, FADE, ground.ground); rig.init(cat, tp?.lookAt);
const input = createInput(), card = createCard(regionAt);
const wild = safe('wild', () => createWild(scene, { route, heightAt, fcam: rig.fcam })), sleep = createSleep(route.sleep);
const book = createSketchbook({ route, wild, regionAt });
// m-loop: the walk (visits, next region, finale), intro/outro lock, audio, phone keys
/* QA M1: under ?at= the region card no longer waits for the intro unlock (3 frames + 1.6 s + a rAF ease = frame-driven, 100 s+ at the mill under
   software GL): on regions-ready it unlocks and shows at once (wall clock), and its 4.5 s fade timer only runs once the cat has moved */
let catMoved = false; let locked = !qs.has('nointro'); const ZERO = { x: 0, y: 0, sprint: false, jump: false, sit: false, sleep: false };
const loop = createLoop({ cat, fcam: rig.fcam, titles, onLock: (on) => { locked = on; } });
const REGP = REG.filter(r => r.id !== 'station' || byId('station')); // only regions that loaded get a name on the map
const pcam = createPortraitCam({ camera, fcam: rig.fcam, cat, qs, R }); { const b0 = loop.begin; loop.begin = (...a) => { pcam.begin(); return b0.apply(loop, a); }; } // 390 follow camera: eases in when the walk begins
const way = safe('wayfind', () => createWayfinding({ cam: rig.fcam, camera, cat, REG: REGP, R, qs, next: () => loop.next(), hidden: () => locked })); // D2 hook
const surfaceAt = (up) => { for (const r of activeRegions(up)) if (r.surfaceAt){ const s = r.surfaceAt(up); if (s) return s; }
  const sb = byId('sealbay'); if (sb && up.angleTo(sb.dir) * R < 13) return 'sand';
  const st = byId('station'); if (st && up.angleTo(st.dir) * R < 4) return 'wood';
  return beltTerrain.heightAt(up) > .02 ? 'sand' : 'grass'; };
const audio = safe('audio', () => createAudio({ cat, REG, surfaceAt }));
const touch = createTouchKeys();
const qa = createQA({ cat, info: loopI, loop, getCamFwd: () => rig.fcam.forward() });
addEventListener('keydown', () => loop.resume()); addEventListener('pointerdown', () => loop.resume());

// ---------- loop ----------
const FREEZE = qs.has('freeze') ? +qs.get('freeze') : null; if (FREEZE !== null) window.__sbT = FREEZE; /* debug: fixed time + dt=0 for pixel diffs */
let T = 0, nfr = 0, last = performance.now();
const ctx = { T: 0, cat, fcam: rig.fcam, sd: lights.sd, ground: ground.ground };
function frame(){
  const now = performance.now(), dt = FREEZE === null ? Math.min((now - last) / 1000, 0.05) : 0; last = now; T = FREEZE === null ? T + dt : FREEZE;
  { const inp = qa.input(input.read(T)); safe('cat', () => updateCat(cat, dt, locked ? ZERO : inp, catPlanet, rig.fcam.forward())); }
  rig.update(dt, cat);
  portraitLens(); safe('pcam', () => pcam.update(dt, T, rig.fcam.board.planet));
  if ((nfr++ & 63) === 0) hookBend(scene);
  rig.closeUp(cat);
  ground.update(cat.up);
  trees.follow(cat.up);
  updateActivation(rig.fcam.board.planet > .01 ? rig.fcam.target : cat.up, rig.fcam.board.planet);
  lights.update(cat); ground.ground.uSun.value.copy(lights.sd).normalize(); ground.ground.uTime.value = T; ctx.T = T;
  { let np = 0; for (const r of activeRegions(cat.up)){ if (perf && !perf.shouldUpdate(r, cat.up)){ np++; continue; } safe(r.id + '-up', () => r.update(dt, ctx)); } perf?.setPaused(np); } // m-perf: far regions pause
  clouds.update(dt, camera, T, ground.ground); trees.update(lights.sd);
  if (tp && !catMoved && (cat.speed || 0) > .05) catMoved = true;
  card.update(cat.up, dt, locked || rig.fcam.D < rig.fcam.HOME_D * .8, tp && !catMoved); // the card is screen-space over the paper margin; zoomed in (pinch / wheel / ?zoom) the scene fills the top of the screen, so no card there (station r2.1 hound shot: title over the loco)
  safe('loop', () => loop.update(dt)); if (belts) safe('belts-up', () => belts.update(dt, T, cat, rig.fcam.board.planet));
  if (audio) safe('audio-up', () => audio.update(dt, { quiet: loop.state === 'black' || loop.state === 'end' ? .7 : 0, musicOut: ['black', 'end', 'resume'].includes(loop.state) ? 1 : 0 }));
  if (wild) safe('wild-up', () => wild.update(dt, T, cat)); sleep.update(dt, cat);
  safe('book', () => book.update(dt, cat)); if (way) safe('wayfind-up', () => way.update(dt));
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}
ground.update(cat.up, true); updateActivation(cat.up, 0); note('grid');
// QA r1: on portrait / narrow screens the board filled ~78 % of the width (cat tiny). Same camera angle and distance, a longer lens:
// tan(fov/2) ÷ PZ (1.14 portrait, easing to 1 by aspect 1.3; desktop unchanged). Re-derived from the dioramacam fit each frame
// (never compounded). ?pz=<k> overrides (pz=1 = the old framing).
function portraitLens(){ if (qs.has('close')) return; const a = innerWidth / innerHeight, t = Math.tan(THREE.MathUtils.degToRad(SHEEP_CAM.vfov / 2)), RA = SHEEP_CAM.aspect;
  const tt = a < RA ? t * RA / a * (a < 1 ? 1.04 : 1) : t, PZ = qs.has('pz') ? +qs.get('pz') : 1 + .14 * (1 - THREE.MathUtils.smoothstep(a, 1, 1.3));
  const fov = THREE.MathUtils.radToDeg(2 * Math.atan(tt / PZ)); if (Math.abs(camera.fov - fov) > 1e-4){ camera.fov = fov; camera.updateProjectionMatrix(); } }
let nf = 0; const _r = renderer.render.bind(renderer);
renderer.render = (a, b) => { const t = performance.now(); _r(a, b); if (nf++ < 3) note(`frame ${nf} ${(performance.now() - t).toFixed(0)}ms`); };
requestAnimationFrame(frame);
// m-loop intro: the title holds while the first frames compile, then dissolves while the camera comes down from the planet onto the meadow
const tpCard = () => { if (!tp) return; locked = false; card.show(cat.up); };
{ const HD = rig.fcam.HOME_D;
  if (!qs.has('nointro') && !tp){ rig.fcam.D = rig.fcam.Dt = HD * 3.2; }
  (async () => { await new Promise(r => { const w = () => (nf >= 3 ? r() : setTimeout(w, 100)); w(); }); note('first frames'); if (!EAGER) lateRegions().then(() => { window.__fold.regionsReady = true; tpCard(); }); else { window.__fold.regionsReady = true; tpCard(); }
    if (qs.has('nointro')){ if (!['walk', 'force'].includes(loop.state)) { loop.begin(); return; } titles.veil.style.transition = 'none'; titles.veil.style.opacity = 0; titles.title.classList.remove('on'); locked = false; loop.begin(); return; }
    const t0 = performance.now(), land = () => { const k = Math.min(1, (performance.now() - t0) / 5200), e = k * k * (3 - 2 * k);
      if (!tp) rig.fcam.Dt = HD * (3.2 - 2.2 * e); if (k < 1) requestAnimationFrame(land); else { locked = loop.state !== 'walk' && loop.state !== 'free' ? locked : false; loop.begin(); } };
    if (!tp) titles.intro(); setTimeout(() => requestAnimationFrame(land), 1600); })(); }
window.__pcam = pcam.stats; window.__qa = { walkLoop: (o) => qa.walkLoopQA(o), progress: () => qa.progress(), status: () => qa.status(), jumpTo: (x) => qa.jumpTo(x), stop: () => qa.stop() }; // Deployer contract (fold-wt/qa/game/qa/README.md)
const perf = safe('perf', () => createPerf({ renderer, scene, camera, ground, fcam: rig.fcam, cat })); // m-perf (?perf overlay, __fold.perf())
window.__fold = { perf: Object.assign(() => perf?.snapshot(true), { set: (o) => perf?.set(o) }), qa, loop, belts, audio, titles, route, wild, sleep, book, way, scene, cat, meadow: meadow?.module, pond: pond?.module, mill: mill?.module, camera, REG, REGIONS, F, board: ground.board, heightAt, renderer,
  mods: bootLog, ready: true };
// QA #13: a teleport (?at=…) opens straight onto its region: the veil dissolves from ready over 1.2 s (wall clock), not after the first 3 frames + the 2.2 s title hold + a 2.4 s fade
if (tp) titles.reveal(qs.has('nointro') ? 0 : 1.2);
