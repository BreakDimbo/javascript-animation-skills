# b7-finds — transition-land discoveries + sleep spots (save points)

Run: `cd /workspace/fold && python3 -m http.server 8777` → http://localhost:8777/b7-finds/
Controls: WASD wander, Shift trot (cam pulls to 3 m), Z near a stone/cushion = curl up → paper-white fade → save.

## Works
- `finds.js` exports `createFinds(scene, planet, seed, {spacing=80})`, `createSleepSpots(scene, planet, seed, {count|dirs})`,
  `saveGame(state)`, `loadGame()`, `sleepFade(el)`, `R`.
- Finds scattered Fibonacci-spaced every ~80 m (60–100) on the R=600 sphere, filtered by `planet.isTransition(dir)` if provided
  (~600 finds with the stub). Kinds: yarn end, catnip patch (cat rolls), fallen log, butterfly (wing flap + drifts up/away
  when cat is <1.6 m — never catchable, no particles), hedge gap (`finds.canPass(pos, bodySize)` blocks the bushes, gap only fits a cat).
- `finds.update(dt, t, catPos)` animates butterflies within 60 m and returns the nearest find in reach (for UI text / catnip roll).
- `finds.add(kind, dir)` to place a hand-authored find.
- Sleep spots: sun-warm stones + cushions; `sleep.nearest(catPos, reach)`. Save = localStorage key `fold.save.v1`
  `{v,t,pos:[x,y,z],spot,kind}`; `loadGame()` returns pos as Vector3. Verified headless: save written, no console errors.
- Placeholder orange cat (white chest + paw tips), radial-up movement, spring-arm cam. Matte Lambert, flat-shaded, no bloom/glow.

## Not done / rough
- Ground is a stub banded canvas texture, not the designer's hand-painted field texture.
- Planet `heightAt(dir)` is honoured if present (radius + height); no terrain slope alignment.
- Curl-up is a simple squash; real cat module should play its own curl anim when `trySleep` fires.
- No persistence of "found" flags (easy: add to saveGame state).

## Merge
Import `finds.js`; pass the real planet object with `{radius, heightAt(dir), isTransition(dir)}`. Each frame call
`finds.update(dt, t, cat.position)` and gate cat movement with `finds.canPass(next)`. On Z: `sleep.nearest(cat.position)` →
cat curl anim → `saveGame({pos})` + `sleepFade(paperDiv)`. On boot `loadGame()?.pos` to respawn.

## Round 1 (polish)
- Faceted low-poly → matte clay: dropped flatShading everywhere; hedges/stones/yarn use subdivided icosahedra (detail 2–3), log 14 sides → soft rounded silhouettes.
- New shared hand-painted canvas map in finds.js (`grainTex()`: gouache mottle blobs + paper grain + faint pencil ticks), multiplied over each PAL colour. No glow/particles. Exports unchanged. Headless shot OK (only a favicon-style 404).
- Catnip spikes → soft stretched clay leaf blobs (SphereGeometry scaled). Shot re-verified at 20:29.

## Round 2 (polish, 20:33)
- Replaced the stub striped ground in index.html with a seamless 1024² hand-painted canvas (designer style): blurred gouache field patches in muted sage/straw, wobbly blurred hedgerow strokes, ~5k slanted pencil-tick grass strokes, paper grain; seeded RNG, wrap-tiled so no seams; repeat 36×18. finds.js/exports untouched. Headless shot re-verified (only the favicon 404).
- Still rough: ground still a little dark/olive under the Lambert sun, so a lighter ambient fill would help; hedge bushes are a bit saturated; no paper-bleed edge at the horizon yet.

## Round 3 (polish, 20:36)
- Took the round-2 rough note: softer, lighter matte lighting (hemisphere fill 1.6→2.0 with a warmer, lighter ground bounce 0xa8a488; sun 1.4→1.15) so the painted ground reads less dark/olive, more like paper. In finds.js, hedge and catnip PAL colours are desaturated toward muted gouache sage (hedge 0x55683f→0x6a7656, catnip 0x7f9a5a/0x96ad6c→0x8a9a6c/0x9fae80). Only colour constants changed; exports unchanged; `node --check finds.js` OK.
- NOT re-verified visually: headless Chrome/Playwright hung at page load this round (machine busy), so shot.png is still the round-2 capture from 20:33. Re-shoot before merging.
- Still rough: no paper-bleed dithered edge at the horizon.

## Round 4 (polish, 20:37)
- With only ~3 min left, I used this round to verify round 3 instead of adding a feature. A new headless Chrome shot (swiftshader) loads fine with no page errors, and shot.png is now overwritten with the real round-3 look: matte clay cat/log/stone/yarn, muted sage painted ground, paper sky.
- Still rough: hedge row reads a bit dark and uniform against the paper sky (lighten or vary the bush tones); pencil-tick grass is too faint at this camera distance; no paper-bleed dithered horizon edge yet. Next step: soften the horizon by fading into the paper colour.

## Round 5 (polish, 20:37)
- Started at 20:37 with ~2 min left. One colour change only: hedge PAL 0x6a7656→0x7c8668 (lighter, muted gouache sage), so the hedge row reads less dark and uniform against the paper sky. `node --check finds.js` passes and exports are unchanged. Re-shot headless at 20:38: page renders fine and shot.png is overwritten; the hedges are visibly lighter and softer. Horizon is still a hard line.
- Next: paper-bleed dithered horizon fade; stronger pencil-tick grass at cat-camera distance.

## Round 6 (20:38)
- Started at 20:38:12, about 1 minute before the 20:39 stop. That isn't enough time to make and screenshot-verify a visual change, so no code changed this round. index.html and finds.js are as of round 5, and shot.png is the round-5 capture from 20:38.
- Top next step: paper-bleed horizon. Add `scene.fog = new THREE.Fog(paperColour, ~40, ~140)` (matte, no glow) plus a dithered paper vignette overlay. After that, darken and enlarge the pencil-tick strokes in the ground canvas so they read at cat-camera distance.

## Round 7 (20:38)
- Started at 20:38:24, under a minute before the 20:39 stop. No code changed, because a change couldn't be screenshot-verified in time. index.html, finds.js and shot.png are still as of round 5. Next steps are the same as round 6's: paper-colour `THREE.Fog` horizon plus a dithered vignette, then bolder pencil-tick grass.
