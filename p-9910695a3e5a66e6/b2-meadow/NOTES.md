# b2-meadow — 01 起点牧野 (sheep meadow on the R=600 planet)

Run: serve `/workspace/fold` (e.g. `python3 -m http.server 8792`) → open `/b2-meadow/index.html`.
`?wide` = fixed establishing shot from 22 m up. Screenshots: `shot.png` (cat cam), `shot_wide.png`, `shot_flee.png`, `shot_edge.png` (cat at the patch rim).
`shot.py` / `test_move.py` = headless playwright checks (they load with no page errors; the only console 404 is favicon).

## Files
- `meadow.js` — the module. `createMeadow(scene, planet, centerDir, {seed})` returns
  `{ group, ground, sheep, update(dt, time, catWorldPos), heightAt(worldPos) -> ground radius,
     project(worldPos) -> [u,v] metres, toWorld(u,v,h), dirOf(u,v), frame:{c,e1,e2}, baseColor, paperColor }`.
  Also exports `MEADOW_COL` (palette taken from the designer's layout.js colours).
- `main.js` — standalone harness only: planet sphere, light, placeholder cat (orange capsule, white chest/paws),
  WASD (camera-relative) / Shift trot / Space hop / ←→ orbit, radial gravity, spring-arm cam (0.5 m up, 2 m behind, 3 m when sprinting).
- `index.html` — page + SVG paper-grain overlay (multiply), small serif caption.

## What works
- 96×96 m painted canvas texture (2048²) mapped by gnomonic projection on the tangent frame at `centerDir`:
  jittered patchwork fields (designer colours), soft gouache radial bands, wheat stripes, worn path, painted hedgerows
  with shadow side, ~90k pencil ticks, cream/yellow flower dots, paper grain.
- No sticker border: from r≈34 m the texture dithers (noise threshold + fbm) into `MEADOW_COL.base` (#9cbd52);
  relief fades out and rim normals become radial, so it sits on a sphere painted in that base colour.
- Gentle relief (0.1–1.7 m), `heightAt()` gives the ground radius for any world point (outside the patch = R).
- 3D clay hedge lumps (InstancedMesh) along painted hedges, thinning out toward the rim.
- 14 clay sheep (jittered icosahedron wool, dark face/legs), designer's graze / idle / walk state machine with
  goal picking (crowding score), separation, paddock bounds (|u|,|v| < 29 m), leg gait, grazing head nibble,
  head turns to look at the cat, and they trot away when the cat is within 4.5 m (`update(dt,t,catPos)`).
- No bloom/glow/particles; Lambert matte, NoToneMapping, paper fog.

## Not done / known issues
- Fixed: the rim seam came from `THREE.Color` returning linear values; the texture now dissolves using sRGB bytes. If you change `MEADOW_COL.base`, use the same value for the planet material.
- Low headless FPS (swiftshader) makes the sim crawl because dt is clamped to 0.05; a real GPU is fine.
- Sheep are meshes, not the designer's painted sprite atlas (sprites/sheep.webp not ported — time).
- Camera doesn't collide with sheep/hedges; cat doesn't collide with hedges.
- Texture paint takes ~1 s at startup (CPU canvas pass).

## Merge
```js
import { createMeadow } from '../b2-meadow/meadow.js';
const meadow = createMeadow(scene, { radius: 600 }, regionDir);   // planet only needs .radius
// each frame:
meadow.update(dt, time, cat.position);
// ground height for the cat: r = Math.max(planetHeight(p), meadow.heightAt(p))
```
Paint the planet surface around region 01 in `meadow.baseColor` for a seamless transition. Delete my placeholder cat (it lives only in main.js).

## Round 1 (polish)
- Hedge lumps were near-black because the InstancedMesh colour was multiplied by a green material colour (green × green). Fixed: material is now white and each instance carries the gouache hedge green (#5f9a3a ± jitter), so the hedges come out as matte mid-green clay like full0.png. I tried smoother lumps (detail 2–3), but the headless swiftshader screenshot timed out on a loaded machine, so I reverted to detail 1.
- shot.png regenerated at 20:34; the hedges now read as mid-green clay. shot.py screenshot timeout raised to 90 s because swiftshader is slow on this shared machine. Still to do: the ground is blurry close to the cat because 2048² is stretched over 96 m (add a tiled detail-tick texture), and the sheep wool is still faceted.

## Round 2 (polish)
- Started at 20:34:50, 10 s before the 20:35 feature freeze, which left no time for a code change and a screenshot check, so I made no code changes. shot.png from 20:34 is the current state: the page loads and the hedges are mid-green clay. Still open, in order of value: (1) the ground is still too saturated and bright, so mute `MEADOW_COL.base` and the field colours toward the olive and ochre of full0.png, and change the planet material in main.js to match; (2) add a tiled pencil-tick detail texture near the cat so the ground isn't blurry; (3) smooth the faceted sheep wool, or port the designer's sheep sprite.

## Round 3 (polish)
- Palette muted toward full0.png olive/ochre: `MEADOW_COL` base #9cbd52→#97a85a, field greens/wheat/path/hedge desaturated, extra field colours too; hedge-lump instance colour 0x5f9a3a→0x617a3e. Planet still uses `MEADOW_COL.base`, so no seam (merge: re-read baseColor). shot.png re-taken 20:37, loads with no errors (only favicon 404). Ground is no longer bright green but still blurry near the cat. Next: tiled pencil-tick detail texture, smoother sheep wool / designer sprite.

## Round 4 (polish)
- Started at 20:37:19, two minutes before the 20:39 stop. That isn't enough time to change code and check it with a slow swiftshader screenshot, so I made no code changes. The round-3 state still stands: the muted olive/ochre palette is in, and the page loads with no errors (shot.png from 20:37). Next, in order of value: (1) a tiled pencil-tick detail texture blended in near the camera, so the ground isn't blurry; (2) smoother, rounder sheep wool (higher-detail icosahedron with vertex-noise displacement and flat cream colour), or port `/workspace/sheep/site/sprites/sheep.webp` as billboards; (3) a dithered paper-bleed edge like the designer's main.js.

## Round 5 (polish)
- Started at 20:37:33, about 90 s before the 20:39 stop, so I made no code changes; an edit couldn't be checked with a swiftshader screenshot in time. The round-3 state stands (muted olive/ochre painted ground, page loads, shot.png from 20:37). Top next step is unchanged: a tiled pencil-tick detail texture near the camera. After that, smooth the sheep wool or port the designer's sheep sprite.

## Round 6 (polish)
- Started at 20:37:46, about 70 s before the 20:39 stop, so I made no code changes; an edit couldn't be checked with a screenshot in time. The round-3 state stands: the muted olive/ochre painted ground is in, the page loads, and shot.png is from 20:37. Next, in order of value: (1) a tiled pencil-tick detail texture near the camera; (2) smoother sheep wool, or port the designer's sheep sprite; (3) a dithered paper-bleed edge.

## Round 7 (polish)
- Started at 20:37:59, about 60 s before the 20:39 stop, so I made no code changes; an edit couldn't be checked with a swiftshader screenshot in time. The round-3 state stands: the muted olive/ochre painted ground (fields, hedges, ticks) is in, the page loads, and shot.png is from 20:37. Next, in order of value: (1) a tiled pencil-tick + wildflower detail texture blended in near the camera, ported from the designer's main.js ground painter; (2) the designer's sheep sprite (`/workspace/sheep/site/sprites/sheep.webp`), or rounder cream clay wool; (3) a dithered paper-bleed edge.

## Round 8 (polish)
- Started at 20:38:15, under a minute before the 20:39 stop, so I made no code changes; nothing could be checked with a swiftshader screenshot in time. The round-3 state stands (muted olive/ochre painted ground, page loads, shot.png from 20:37). Next steps are unchanged: (1) a tiled pencil-tick + wildflower detail texture near the camera; (2) the designer's sheep sprite, or rounder cream clay wool; (3) a dithered paper-bleed edge.

## Round 9 (polish)
- Started at 20:38:26, under a minute before the 20:39 stop, so I made no code changes; nothing could be checked with a screenshot in time. The round-3 state stands (muted olive/ochre painted ground, page loads, shot.png from 20:37). Next steps are unchanged: (1) a tiled pencil-tick + wildflower detail texture near the camera; (2) the designer sheep sprite, or rounder cream clay wool; (3) a dithered paper-bleed edge.
