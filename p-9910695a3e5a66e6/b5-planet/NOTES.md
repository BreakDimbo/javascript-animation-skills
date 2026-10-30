# b5-planet — 全星远景 + 地貌 LOD + 区域流式

Run: `cd /workspace/fold && python3 -m http.server 8795` → http://localhost:8795/b5-planet/
Keys: **G** descend to region 01 (sheep meadow), **F** fly back to space, drag = look around (yaw).
URL params: `?ground` start on the ground, `?t=0.5` freeze-start at a flight fraction (debug).
Screenshots: `shot.png` (space), `shot_ground.png` (cat eye height in region 01). `shot.py` = headless playwright helper.

## What works
- **Planet R=600** built from a cube-sphere (6 faces, tan-warped) **quadtree LOD** (`PlanetLOD`):
  24×24 cells per chunk, minLevel 3 (384 chunks in space view), refines to level 9 near camera
  (~7 cm cells at the cat). Split rule: `dist(cam, chunkCentre) < arc * splitFactor`. Children only
  replace a parent once all 4 are built (build budget 40 chunks/frame → no holes). Skirts hide
  T-junction cracks (normals are computed before skirt drop so seams don't shade). Unused chunks evicted after ~4 s.
- **Terrain** `terrainHeight(dir)` (CPU, deterministic, also usable by cat/sheep modules for ground snapping):
  continents + ridges (±30–60 m), metre-scale undulation, sea level at R. Region 01 is forced into a gentle meadow plateau.
- **Gouache colour bands** baked in vertex colours: posterised depth bands (foam/shallow/mid/deep), sand,
  dunes/ochre/rust desert, wheat, meadow/lime, forest masses, rock, snow cap at poles. Hash-dithered band edges (paper-bleed).
- **Shader** (`makeTerrainMaterial`): wrapped light quantised into 4 soft bands, slow drifting soft cloud shadows,
  gouache tone wash, paper grain, pencil-tick grass on vegetation within ~30 m, paper-coloured distance fog on the ground. No bloom/specular.
- Clay cloud puffs, slow planet spin (stops during descent), tiny moon (r=28 m) orbiting with a white clay hare.
- **RegionStreamer**: `register({id, centerDir, loadRadius=300, unloadRadius=500, onLoad, onUnload})`,
  `.on('load'|'unload', fn)`, `.update(pLocal)`; distance = hypot(great-circle arc, altitude); hysteresis.
  Six regions registered in `REGIONS` (01 meadow, 02 wheat, 03 dunes, 04 forest, 05 snow, 06 shore). HUD logs load/unload.
- Space→ground flight: log-altitude interpolation 2000 m → 0.45 m, direction slerp to region 01, up vector blends
  world-up → radial, look target blends planet centre → horizon; near plane scales with altitude.

## Not done / known issues
- Water: posterised depth bands + slow stepped swell bands in the shader; no true Gerstner displacement or animated shore foam yet.
- Faint skirt lines can show at LOD borders at grazing angles; mid-altitude dither looks a bit pixel-blocky.
- No geomorphing between LOD levels (pops are small due to banded colours).
- Ground camera is a static yaw view — the cat module should own the camera once landed.

## How to merge
```js
import { createPlanet, terrainHeight, REGIONS, R } from '../b5-planet/planet.js';
const planet = createPlanet(scene);             // adds group, lights, clouds, moon
planet.streamer.on('load', r => { if (r.id === '01-meadow') spawnSheep(); });
// each frame:
planet.update(dt, camera);                      // spins, LOD-refines + streams around the camera
// ground snapping for cat/sheep (planet-local direction):
const h = R + terrainHeight(localDir);
```
- Gameplay objects that live on the surface should be children of `planet.group` (it rotates in space view; set `planet.spin = 0` on the ground).
- `planet.localOf(worldVec)` converts world → planet-local.
- To feed LOD/streaming from the cat instead of the camera, call `planet.lod.update(pLocal)` / `planet.streamer.update(pLocal)` directly.

## Polish round 1 (20:32 SGT)
- Clouds: the clay sphere puffs are replaced by **flat painted cloud cards**. Each one is a canvas texture with two posterised gouache bands, paper-grain speckle and a dithered edge (alphaTest), laid flat to the sphere about 70–95 m up. Each also gets a **faint blurred painted shadow** card at ground height under it (opacity 0.24, depthWrite off). `makeCloud` still returns a Group; `clouds` export unchanged.
- Moon hare scaled ×2.6 so it shows on the moon's silhouette (still only a small bump at 2000 m).
- Not done: terrain band noise/blockiness (the next most valuable fix is to smooth the band-edge dither into wider painted edges); the near cloud still reads a little bright against the snow cap.

## Polish round 2 (20:33 SGT)
- Terrain band edges: replaced the per-vertex white-noise hash dither in `biomeColor` with a smooth low-frequency fbm "brush edge" (×90) plus a faint fine feather (×2200). Colour masses now read as clean gouache shapes with wobbly painted edges instead of noisy speckle. shot.png re-taken, no console errors. Remaining: the stair-stepping comes from vertex colours (it would need per-fragment biome lookup or a painted canvas texture to fix); the near cloud card at the top-left still looks a bit bright and puffy; the moon hare is barely readable at 2000 m.

## Polish round 3 (20:34 SGT)
- Cloud cards toned down from near-white to muted paper cream (#c4bfb0 / #ddd7c8) at 0.82 opacity, so the near cloud no longer pops against the planet and reads as a soft painted shape. shot.png re-taken with no console errors. The centre of that shot is soft because LOD chunks were still building (299/400) when it was captured. Still not done: stair-stepping in the vertex-colour bands, and the moon hare is still too small to read at 2000 m.

## Polish round 4 (20:36 SGT)
- Moon: clay changed from near-white #e2ddd1 to a muted warm grey #b9b2a3, so the white clay hare stands out against it. Hare scaled ×4.2 (was ×2.6) and set onto the moon's surface. In shot.png (no page errors) it now shows as a pale hare-shaped bump on the moon's silhouette, but it's only a few pixels at 2000 m. A closer moon or a hare-only close-up would make it clearly readable. Still not done: stair-stepping in the vertex-colour bands.
- Test note: port 8765 was serving a different root during this round, so the shot was taken on 127.0.0.1:18793.

## Polish round 5 (20:37 SGT)
- No code changes: this round started at 20:35:53, after the 20:35 feature freeze. I re-ran the headless check (shot.py on 127.0.0.1:18794) with no console or page errors and overwrote shot.png.
- Critique of the current shot (next steps for whoever continues): (1) the biome bands still stair-step and look blocky, because the colours are per-vertex. Moving the biome lookup into the fragment shader, or using a painted canvas texture, is the most valuable fix left. (2) The cloud cards seen edge-on near the limb still read as stacked grey puffs. Fade cards by view angle (opacity × dot(normal, viewDir)). (3) At 2000 m the moon hare is only a few pixels. (4) The snow cap edge is a hard white crust.

## Polish round 6 (20:37 SGT)
- No code changes: this round started at 20:36:38, after the 20:35 feature freeze. I re-ran the headless check (127.0.0.1:18795, 8 s wait) with no console or page errors and overwrote shot.png (chunks 360/480). The round-5 critique still stands. Top priority: per-fragment biome colour, or a painted canvas texture, to remove the stair-stepped blocky bands. Next: fade the cloud cards that sit edge-on at the limb, soften the snow-cap crust edge, and give the moon hare a closer framing.

## Polish round 7 (20:37 SGT)
- No code changes: this round started at 20:37:19, after the 20:35 feature freeze and less than 2 minutes before the 20:39 stop. I re-ran the headless check (127.0.0.1:18796, 6 s wait) with no console or page errors and overwrote shot.png. The round-5/6 priority list still stands: per-fragment biome colour or a painted canvas texture for the terrain, then fading edge-on cloud cards, softening the snow-cap edge, and framing the moon hare closer.

## Polish round 8 (20:38 SGT)
- No code changes: this round started at 20:37:56, about a minute before the 20:39 stop, so there was no safe time for a visual change. I re-ran the headless check (127.0.0.1:18797, 5 s wait) with no console or page errors and overwrote shot.png. Next, in priority order: (1) per-fragment biome colour, or a painted canvas ground texture with pencil-tick grass and paper bleed (as in the designer's /workspace/sheep/site/main.js), to replace the stair-stepped vertex-colour bands; (2) fade cloud cards by view angle; (3) soften the snow-cap edge; (4) frame the moon hare closer.
