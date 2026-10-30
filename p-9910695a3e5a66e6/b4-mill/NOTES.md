# b4-mill — 03 风车磨坊丘 Windmill Hill

Run: `cd /workspace/fold && python3 -m http.server 8794`, then open `/b4-mill/index.html`.
Test views: `?overview` (fixed establishing camera), `?donkey` (start riding), `?sacks` (cat sits at the flour sacks, so the dormouse peeks).
Screenshots: `shot.png` (overview), `shot_ride.png`, `shot_dormouse.png`. Headless Chrome reports no JS errors; the only console line is a 404 for favicon.

## What works
- `createMill(scene, planet, centerDir)` in `mill.js`. `planet` = `{ R }`. Everything sits on the R=600 sphere in a local tangent frame around `centerDir`, and "up" is always radial.
- Gaussian hill (11 m high, σ 34 m) on a 220 m ground patch. The patch has a hand-painted canvas texture: blurred gouache grass blotches, wheat in 12 ochre bands, a wobbly dirt loop path, pencil-tick grass, cream and ochre flower dots, and a dithered paper-bleed edge that fades into the planet colour `#8c9b5c`.
- Clay windmill: tapered tower, roof cap, 4 lattice sails turning slowly (0.35 rad/s). Mill house with a pitched roof and chimney.
- About 9000 instanced wheat stalks, coloured by band, swaying via a vertex-shader time uniform (`onBeforeCompile` on Lambert).
- Flour sacks in two piles with a gap. A dormouse lives in the gap and peeks out when the cat is sitting within 2.6 m (C toggles sit; the cat also sits automatically after 3 s idle). The camera drifts sideways so you can see it.
- Grey donkey with wool pannier bags walks the looped path (0.7 m/s) with a leg gait, head nod and tail swish. Press E near it (< 2.4 m) to ride on the bags: the donkey speeds up to 2.4 m/s and the camera pulls back. Press E again to hop off.
- Placeholder cat: orange body, white chest, snout and paw tips. W/S move, A/D turn, Shift sprints, Space jumps. Radial gravity, simple circle collisions with the tower, house and sacks. Spring-arm camera sits 0.58 m up and 2.2 m behind, pulling back to 3 m when sprinting.
- Matte Lambert materials only, no tone mapping, fog to the paper colour. No bloom, glow or particles.

## API returned by createMill
`{ group, update(dt, cat{position, sitting}), heightAt(worldPos), surf(x,z,lift), frame(obj,x,z,yaw,lift), collide(worldPos), seatWorld(out), donkeyNear(pos,d), donkey, setRiding(bool), riding, mousePeek, spawn, sackSpot(out), sackCenter(out) }`
- Ground height off the patch is 0 (the planet sphere). Merge by using `R + mill.heightAt(p)` as the ground radius inside the region.
- For riding, copy `mill.seatWorld(pos)` and `mill.donkey.quaternion` into the real cat each frame.

## Not done / known issues
- The cat is a placeholder blob. Swap in the real cat module and keep the `{position, sitting}` contract for `update`.
- Pencil ticks smear at grazing angles: the texture is 2048 px over 220 m. A tiled detail texture would fix this.
- No paper-grain or posterise post pass, and no sound.
- The dormouse has no idle animation beyond head turns.
- The donkey walks through the wheat field edge in one spot. Collisions are cat-only.
- Round 1 (20:31): the hill is flattened from 11 m high, σ 34 m to 4.5 m high, σ 48 m (`HILL_H`/`HILL_S` in mill.js). At the cat's eye height the horizon is now near-flat, so it reads as R=600 rather than a tiny ball. `shot.png` is overwritten with the ground-level cat view. Still to do: the ground texture smears near the camera and needs a tiled pencil-tick detail map; the windmill's clay colours could be warmer.
- Round 2 (20:34): warmer clay palette (clay #e2c9a4, roof #985d47, wood #7d5638). Added a shared hand-painted 256 px clay canvas texture (soft gouache strokes plus paper grain, `clayTex()`/`clay()` in mill.js) on the tower, band, cap, house, roof, chimney and sacks, so they no longer read as flat colour. Exports are unchanged. shot.png is re-shot. Still to do: the ground near the camera smears and needs a tiled pencil-tick detail map.
- Round 3 (20:38): added a tiled pencil-tick and paper-grain detail map, multiplied into the ground shader through `onBeforeCompile` at two scales (UV×240 ≈ 0.9 m tile and UV×61), so the ground near the low camera stays hand-painted instead of smearing. Exports are unchanged. NOT VISUALLY VERIFIED: headless Chrome hung in this environment, so shot.png is still the round-2 image. `node --check` passes. If the ground renders black or wrong, remove the `gmat.onBeforeCompile` line in mill.js.
- Round 4 (20:38): no code changes. The round started at 20:38, one minute before the 20:39 stop, so there was no time to make and verify an improvement. The round-3 ground detail map is still not visually verified; check it first when merging.
- Round 5 (20:38): no code changes. The round started at 20:38, one minute before the 20:39 stop. The round-3 ground detail map is still not visually verified; check it first when merging (or remove the `gmat.onBeforeCompile` line in mill.js if the ground looks wrong).
