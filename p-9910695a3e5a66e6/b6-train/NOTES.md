# b6-train — 11 小站 + 环线小火车

Run: `cd /workspace/fold && python3 -m http.server 8796` → http://localhost:8796/b6-train/  (shot.png = headless capture; only console error is the favicon 404)

## Works
- `station.js` exports
  - `createStation(scene, planet, centerDir, tangent?)` → `{ group, path, dog, update(dt, catWorldPos, time) }`
    Clay platform, hut with hip roof, canopy, bench, serif name board 「褶星 · 小站」, and the loop track
    (instanced sleepers + rails along the full great circle through `centerDir`, length 2πR ≈ 3.77 km).
  - `createTrain(scene, planet, path, {cars, speed, dwell})` → `{ s, update(dt, fast), seatTransform(obj) }`
    Smokeless clay loco + 2 cars; brakes into the station (s = 0) and dwells 8 s, then runs the loop.
  - `makeRailPath(R, centerDir, tangent)`, `placeOnSphere(obj, R, dir, fwd, h)` (radial-up orientation helper).
- Old whippet sleeps on the platform (slow breathing), lifts and turns its head toward the cat within 3.5 m, settles back slowly.
- `main.js`: R = 600 sphere with canvas gouache-band ground + pencil ticks + grain, placeholder orange cat
  (WASD, Shift run, radial gravity, steps up onto platform), spring-arm cam (2 m / 3 m sprint / 6 m when riding).
  **E** near the second car = board / alight (alight puts you 2.2 m to the side). **T** = 8× fast-forward while riding.

## Doesn't / TODO
- Ground texture is plain equirect (station placed away from the pole); merge should use the shared planet ground instead.
- Platform step is a hard snap, no collision with hut/train. Track doesn't follow terrain height (assumes smooth sphere).
- Boarding verified headless (shot_ride.png): the cat sits on the second car's roof and the train brakes into the station and waits there. A full 8× loop was not watched end to end. Headless swiftshader runs at very low fps, so the ride looks slow there.

## Merge
Import `createStation/createTrain` from `b6-train/station.js`; pass `planet = {R}` and a region dir.
Call `station.update(dt, cat.position, t)` and `train.update(dt, fastForward)` each frame; when riding, call
`train.seatTransform(catObject)` instead of the cat controller. No lights/fog/postprocessing live in station.js.

## Round 1 (polish)
- station.js: all clay materials now share one procedural 256² canvas "gouache grain" map (soft dry-brush strokes + paper speckle, tinted by colour, Lambert/matte); box UVs are world-scaled so grain density is constant. Exports unchanged.
- main.js: hemisphere ground bounce warmed/lightened (0xb8a888, 2.4) so shaded plaster reads cream instead of olive. Verified headless (shot.png), no console errors besides favicon 404.
- Still TODO for look: rounded (bevelled) silhouettes for hut/platform/train, pencil-tick grass near the track.

## Round 2 (polish)
- station.js: every `box()` (hut, platform, bench, canopy, cars, dog parts) is now a soft clay rounded box (`softBox`: 6-seg box, vertices projected onto a rounded-box surface, r = 18% of thinnest side, smooth normals; grain UVs kept). Hut/platform read as hand-pressed clay instead of hard CG cubes. Exports unchanged; verified headless (shot.png), only favicon 404.
- Still TODO: hip roof / canopy slab still sharp-edged; pencil-tick grass along the track; rails/sleepers (InstancedMesh) still plain boxes.

## Round 3 (polish)
- station.js PAL muted toward the designer's gouache palette: roof/canopy 0x9a5a44→0xb88a72 (dusty terracotta), wood →0x8a7058, sleepers →0x8a7562, rails →0x6e675f; scene no longer has a dark saturated red-brown block. Exports unchanged; verified headless (shot.png), only favicon 404.
- main.js ground texture repeat 24×12 → 140×70 (~27 m tiles): pencil-tick grass and soft gouache bands now read at cat scale instead of a blurry smear (fog hides tiling far off). Merge should still use the shared planet ground.
- Still TODO: roof/canopy still sharp slabs, cat is placeholder, band edges are hard-cut (no dithered bleed).

## Round 4 (polish)
- station.js hut hip roof: 6 height segments, sides bulged outward (sin profile, +16%) and normals recomputed → soft pillowed clay roof with rounded eaves instead of a hard 4-sided pyramid. Exports unchanged; verified headless (shot.png), only favicon 404.
- Still TODO: canopy slab still flat/sharp; band edges hard-cut (no dithered paper bleed); cat is placeholder.

## Round 5 (polish)
- station.js: platform canopy slab is now 2× thicker (0.08 → 0.16 m, slightly wider), so the softBox rounding shows as a soft rounded clay edge rather than a paper-thin sharp sheet. Exports unchanged. Checked with a headless run (shot.png); the only console error is the favicon 404. Started at 20:34, so there was time for this one small change only.
- Still TODO: dithered paper-bleed band edges in the ground, the placeholder cat, and rounded rails/sleepers.

## Round 6 (polish)
- No code changes. The round started at 20:36 SGT, after the 20:35 feature freeze, so I only re-ran the headless check: index.html loads and renders the station, track, train and cat. The only console error is the favicon 404. shot.png was overwritten with this capture.
- Next most valuable: dithered paper-bleed band edges in the ground; the canopy still reads as a large flat slab from cat height; rails and sleepers are still plain boxes; the cat is a placeholder.

## Round 7 (polish)
- No code changes. The round started at 20:36 SGT, after the 20:35 feature freeze. I re-ran the headless check (shot.png overwritten): index.html loads and renders the station, track, train and cat; the only console error is the favicon 404. Exports unchanged.
- Looking at the shot critically: the canopy reads as a large flat slab from cat height, the ground bands are hard-cut with no dithered paper bleed, and the sleepers are plain boxes. These are the next things to fix.

## Round 8 (polish)
- No code changes. The round started at 20:37 SGT, after the 20:35 feature freeze. I re-ran the headless check (shot.png overwritten): index.html loads; the only console error is the favicon 404. Exports unchanged.
- Next most valuable (unchanged): dithered paper-bleed band edges in the ground, a thinner/rounder canopy silhouette, rounded sleepers, and the real cat from the cat module.

## Round 9 (polish)
- No code changes. The round started at 20:37 SGT, after the 20:35 feature freeze and 2 min before the hard stop. I re-ran the headless check (shot.png overwritten at 20:38): index.html loads; the only console error is the favicon 404. Exports unchanged.
- Next most valuable (unchanged): dithered paper-bleed band edges in the ground, a thinner/rounder canopy, rounded sleepers, and the real cat from the cat module.

## Round 10 (polish)
- No code changes. The round started at 20:38 SGT, one minute before the 20:39 hard stop, which left no time to change code and verify it. I didn't re-run the headless check this round: shot.png is the round 9 capture from 20:38, where index.html loaded and the only console error was the favicon 404. Exports unchanged.
- Next most valuable (unchanged): dithered paper-bleed band edges in the ground (main.js ground canvas), a thinner/rounder canopy, rounded sleepers, and the real cat from the cat module.

## Round 11 (polish)
- No code changes. The round started at 20:38 SGT, one minute before the 20:39 stop, which left no time to change code and verify it. No new headless check was run; shot.png is still the round 9 capture (index.html loaded, the only console error was the favicon 404). Exports unchanged.
- Next most valuable (unchanged): dithered paper-bleed band edges in the ground (main.js ground canvas), a thinner/rounder canopy, rounded sleepers, and the real cat from the cat module.
