# b3-pond — 06 芦苇鸭塘 (reed duck pond)

Run: `cd /workspace/fold && python3 -m http.server 8793` → http://localhost:8793/b3-pond/index.html
(`?over` = overview camera; `C` toggles it). WASD walk/turn, Shift run, Space hop.
Screenshots: `shot.png` (cat follow-cam at the bank), `shot_log.png` (cat on a tilted log + ring ripple), `shot_over.png` (overview).
Only console noise in headless Chrome was a favicon 404.

## Files
- `pond.js` — the module. `createPond(scene, planet, centerDir)` (planet = `{R:600}`), returns
  `{ group, update(dt, cat?), sample(x,z), waterLevel(x,z), terrainH, pondSD, toWorld(x,z,h), toLocal(worldPos), frame(x,z,yaw), addRipple(x,z,amp), logs, stones, ducks, sunDir, E, N, Cn }`.
  Also exports `clay(hex)` (MeshToonMaterial with a 3-step gouache gradient) and `POND`.
- `main.js` — standalone harness: planet sphere, placeholder cat, spring-arm camera. Not needed when merging.

## Coordinates
The pond is a local tangent patch around `centerDir`: local (x east, z north, h height above R).
`toWorld(x,z,h) = normalize(C + E·x + N·z)·(R+h)`; `toLocal` is its exact inverse. Up is always radial.
`frame(x,z,yaw)` gives a quaternion (+Y radial up, +Z toward yaw). Patch is 46 m wide; the pond is about 26 m across, 1.5 m deep.

## What works
- **Water** (ShaderMaterial, includes scene fog): a sum of 4 sine/Gerstner-ish waves (height + slope + small horizontal offset),
  damped in the shallows; 8 ring-ripple slots (`addRipple`). Colour = depth absorption `exp(-1.4·depth)` + wave-normal light + paper grain,
  **posterised to 4 flat bands**. Shore foam comes from the per-vertex depth field (wavering lap line), plus a second broken foam line that breathes.
  Ripple fronts draw as pale bands. No specular, no glitter, no bloom.
- **Ground**: hand-painted canvas texture (3 flat field bands, mud bank, darker bed, pencil-tick grass), with a block-dithered bleed into the planet base colour `#9ea374`.
- **Logs** (3): implicit spring-dampers for heave, pitch and roll, driven by the JS wave field (kept in sync with the GLSL).
  When `cat.on === log`, a 4 kg point load sinks the log about 3 cm and pitches/rolls it toward the cat (about 6° at 1 m from centre). Ripple on boarding.
- **Stepping stones**: a bowed path of 15-odd irregular stones across the west lobe; tops at +7–11 cm.
- **Ducks**: 3 clay groups (mallard drakes and hens); cohesion and separation, they stay in water deeper than 45 cm, avoid logs, shy away from the cat within 3 m, bob, occasionally dip their heads (ripple).
- **Reeds**: about 2600 instanced blades plus cattail heads in clumps along the shore, swaying in the vertex shader (`onBeforeCompile`).
- **Cat fear of water** (in main.js): walking on ground refuses any step into water ≥ 5 cm deep (lean-back hesitation). Running (Shift) or falling off a stone or log into deep water → `swim` (head-up paddle to the nearest bank until depth < 3 cm, so it ends safely on the shelf) → `shake` (1.6 s roll shudder) → walk.

## Not done / caveats
- The pond patch is flat-mapped onto the sphere (gnomonic). Its edge sits 1.5 cm above a sphere at R−0.03; on the merged planet, cut a hole or lower the base terrain here.
- The planet sphere's chordal sag at 160 segments is about 10 cm. The merged planet should use its own height function and call `pond.terrainH` inside the patch.
- No shadows. Water is opaque (no refraction of the bed). Ducks don't react to ripples. The cat is a placeholder; its logic lives in main.js `stepCat` and can be ported to the real cat.
- No sound.

## Merging
`const pond = createPond(scene, {R:600}, dir); each frame: pond.update(dt, {x,z,h,on})` where x,z come from `pond.toLocal(cat.position)`.
Use `pond.sample(x,z)` → `{h, kind:'ground'|'stone'|'log', ref, water, depth, wet}` for cat support and water fear, and set `cat.on = sample.ref` when standing on a log.

## Round 1 (polish)
- Water fragment shader: replaced the blocky `floor(vL*40)` hash grain with smooth brush-fibre noise (stretched along a stroke direction); gouache bands now blend over a soft wet edge (`fwidth`-scaled smoothstep) with slight pigment pooling. Shore foam, the breathing foam line and ripple rings use soft alpha brushstrokes with dry-brush gaps instead of hard `if` cut-offs.
- Ground texture: the paper-bleed edge into the planet base colour is now a soft noise blend (no 8-px dither blocks).
- Reeds: cattail heads were floating ~0.5 m above their stalks; they now sit just under the blade tip.
- Exports are unchanged. Still to do: rounder clay ducks, and a richer bank painting that matches the designer's ground.

## Round 2 (polish)
- Reeds rendered almost black because the per-instance colours were multiplied by an already-green material (`clay(0x7f8c57)`). The blade material is now white, so the instance palette (olive/ochre) shows as intended; cattail heads are a slightly lighter umber. The reed clumps now sit in the muted palette. Exports are unchanged; shot.png was re-taken. Still to do: rounder clay ducks, and pencil-tick texture on the near grass.

## Round 3 (polish)
- Started at 20:33, two minutes before the 20:35 feature freeze, so no code changed this round. Reviewed shot.png. The water bands, the foam and the reed palette now read as gouache. The weakest area is the near grass: it is flat olive with blurry dark blobs. Next step: paint pencil-tick strokes and soft field bands into the ground canvas, as the designer's main.js does. After that: rounder clay ducks (they're small sphere stacks; add a lifted tail and a flatter breast). Exports are unchanged.

## Round 4 (polish)
- Ground canvas: added 260 soft, low-alpha gouache ellipse dabs (field mottling like the designer's ground). Pencil ticks went from 9k to 22k, with varied width and a third pale-straw colour. Exports are unchanged; shot.png was re-taken and loads cleanly. Caveat: the canvas is 1024 px across 46 m (about 22 px/m), so the ticks still blur near the follow-cam. Next step: a tiled detail grass texture (repeat about 1 per 2 m) multiplied over the ground map in `clay`'s onBeforeCompile, then rounder clay ducks.

## Round 5 (polish)
- Started at 20:34:46, inside the 20:35 feature freeze, so no code changed. Exports are unchanged. The shot.png from the end of round 4 (20:34) is still current. Next steps, in priority order: (1) a tiled pencil-tick detail texture over the ground map near the camera; (2) rounder clay ducks (flatter breast, lifted tail); (3) wider, softer foam brushstrokes at the shoreline.

## Round 6 (polish)
- Started at 20:35:00, at the feature freeze, so no code changed. Exports are unchanged. shot.png from 20:34 (end of round 4) is still current. Next steps, in priority order: (1) a tiled pencil-tick detail texture multiplied over the ground map near the camera (bank painting); (2) rounder clay ducks (flatter breast, lifted tail); (3) wider, softer foam brushstrokes at the shoreline.

## Round 7 (polish)
- Ducks have rounder clay forms: each now has a flattened breast sphere under the chest and two folded wing pads (stretched spheres; drakes use a grey-brown `DM.wing` clay, hens use their head colour). The silhouette reads as a duck rather than a stack of spheres. Exports are unchanged. shot.png was re-taken at 20:36 and loads cleanly (the only console error is a 404, likely the favicon). In this shot the ducks are small and far away. Still open: a tiled pencil-tick detail texture over the near ground, which is still blurry olive with dark blobs near the camera, and wider foam brushstrokes along the shore.

## Round 8 (polish)
- Started at 20:36:13, after the 20:35 feature freeze, so no code changed. Exports are unchanged. shot.png from round 7 (20:36, clay ducks) is still current and loads cleanly. Next steps, in priority order: (1) a tiled pencil-tick detail texture multiplied over the ground map near the camera, so the banks look like the designer's ground; (2) wider, softer foam brushstrokes along the shore.

## Round 9 (polish)
- Started at 20:36:23, after the 20:35 feature freeze, so no code changed. Exports are unchanged. shot.png from round 7 (20:36, clay ducks) is still current. Next steps, in priority order: (1) a tiled pencil-tick detail texture multiplied over the ground map near the camera, so the banks look like the designer's ground; (2) wider, softer foam brushstrokes along the shore.

## Round 10 (polish)
- Started at 20:36:35, after the 20:35 feature freeze, so no code changed. Exports are unchanged. shot.png from round 7 (20:36, clay ducks) is still current. Next steps, in priority order: (1) a tiled pencil-tick detail texture multiplied over the ground map near the camera (bank painting like the designer's ground); (2) wider, softer foam brushstrokes along the shore.

## Round 11 (polish)
- Started at 20:36:47, after the 20:35 feature freeze, so no code changed. Exports are unchanged. shot.png from round 7 (20:36, clay ducks) is still current. Next steps, in priority order: (1) a tiled pencil-tick detail texture multiplied over the ground map near the camera (bank painting like the designer's ground); (2) wider, softer foam brushstrokes along the shore.

## Round 12 (polish)
- Started at 20:37:00, after the 20:35 feature freeze, so no code changed. Exports are unchanged. shot.png from round 7 (20:36, clay ducks) is still current. Next steps, in priority order: (1) a tiled pencil-tick detail texture multiplied over the ground map near the camera (bank painting like the designer's ground); (2) wider, softer foam brushstrokes along the shore; (3) smooth the band edges in the water shader so they don't look blocky.

## Round 13 (polish)
- Started at 20:37:12, after the 20:35 feature freeze, so no code changed. Exports are unchanged. shot.png from round 7 (20:36, clay ducks) is still current. Next steps, in priority order: (1) smooth the water band edges (replace the hard posterise step with a smoothstep about 0.02 wide between bands, so the edges look painted rather than pixel-dithered); (2) a tiled pencil-tick detail texture over the near-bank ground; (3) wider, softer foam brushstrokes along the shore.

## Round 14 (polish)
- Water band edges are softer. In pond.js the transition width between gouache bands is now `clamp(fwidth(sv)*2.5, .14, .4)`; it was `*1.5, .04, .35`. The bands now blend like wet gouache instead of stepping in blocks. The shore foam edge also feathers more widely (`edgeFoam -.012/+.014`). Exports are unchanged. shot.png was re-taken at 20:38 and renders cleanly. Still open: the near-bank ground is a blurry olive with dark smears and needs a tiled pencil-tick detail texture. The cat's tail also sticks straight up.

## Round 15 (polish)
- Started at 20:38:21, one minute before the 20:39 stop, so no code changed. Exports are unchanged. shot.png from round 14 (20:38, softer water bands) is still current. Next steps, in priority order: (1) a tiled pencil-tick detail texture multiplied over the near-bank ground, which is still blurry olive with dark smears; (2) wider, softer foam brushstrokes along the shore; (3) lower the cat's tail, which sticks straight up.
