# b1-cat — 主角猫与球面控制器 (褶星 Fold)

Run: serve `/workspace/fold` (any static server) and open `/b1-cat/index.html`.
Headless check: `python3 shot.py "?demo=side" out.png 9000` (edit the port in shot.py). Demo modes: `?demo=walk|sprint|sit|side|sleep|jump`
(demo mode runs 10 fixed sub-steps per frame so slow software renderers still advance).
Screenshots: `shot.png` (default view), `side.png` (sit), `sleep.png` (curled sleep), `jump.png`.
Loads with no JS errors (only a favicon 404).

## Controls
WASD / arrows: move, relative to the camera · Shift: sprint · Space: jump · C: sit (toggle) · Z: curl up and sleep (toggle) · mouse drag: orbit the camera.
Holding a direction walks, then eases into a trot after about 1.4 s; Shift sprints. After 7 s idle the cat does a stretch (play-bow).

## Files / API
- `cat.js`
  - `createCat(scene, planet?) -> cat` builds a clay cat from primitives (matte Lambert: orange body, white chest/belly/muzzle/paws, darker tabby saddle and tail tip, ears, blinking eyes, 7-segment tail) and adds it to the scene.
  - `updateCat(cat, dt, input, planet, camForward)` with `input = {x, y, sprint, jump, sit, sleep}` (jump/sit/sleep are one-frame edges).
  - Cat state: `cat.pos, cat.up, cat.fwd, cat.alt (height above r=R), cat.speed, cat.state ('idle'|'sit'|'sleep'|'stretch'), cat.gait ('idle'|'walk'|'trot'|'sprint'), cat.grounded`.
  - Physics: radial gravity of 9.8 along `normalize(pos)`. Movement is in the tangent plane, and the heading is parallel-transported with `Quaternion.setFromUnitVectors(oldUp, newUp)` then re-orthogonalised. No world-Y assumption anywhere.
  - Animation is procedural pose blending (stand/sit/sleep/stretch/air) plus a gait cycle: lateral-sequence walk, diagonal trot, rotary gallop with spine flex. Leg length auto-fits the ground. The tail sways and curls, the body breathes, the head looks around.
  - Body length is about 0.45 m and eye height about 0.2 m.
- `followcam.js`
  - `createFollowCam(camera, domElement) -> cam` with `cam.update(dt, cat)` and `cam.forward()` (pass this to `updateCat` for camera-relative input).
  - It is a spring arm: 0.35–0.6 m above the ground (mouse pitch), 1.9 m behind (2.3 trotting, 3.0 sprinting, 1.6 sitting or sleeping).
  - The camera's yaw is parallel-transported with the cat, `camera.up` is radial, and the camera auto-follows lazily behind a moving cat 2.5 s after the last drag.
- `planet.js`
  - `createPlanet(scene, renderer) -> { R, colliders, spawnUp, frame, at(x,z) }`: a test planet with R = 600 m.
  - Ground: vertex-colour posterised gouache bands multiplied by a tiled canvas of pencil-tick grass.
  - Props: instanced hedgerows, stones, two low dry-stone walls (0.42 m and 0.38 m), and 4 stone ledges marked with chalk at 0.28, 0.35, 0.5 and 0.7 m.
  - `frameAt(up)` and `place()` are helpers for putting objects on the sphere.
- `main.js` wires it together: paper background, fog to paper, hemisphere light plus a soft shadow-casting sun whose shadow camera follows the cat. The UI is small italic serif text.

## Merging
- Collision format: `planet.colliders` is an array of `{ inv: Matrix4 (world→local box frame, local +y = radial), hx, hz, top }`. `top` is the height above the surface (99 = solid, can't be stood on). Any module can push boxes into it. The cat stands on a box when its `alt >= top - 0.06`; otherwise it is pushed out.
- Ground is assumed to be the perfect sphere `|p| = R`. If the merged planet has a heightfield, replace the `support` base (currently 0) in `updateCat` with `height(dir)`. It is one line: `let support = 0;`.
- Only `cat.js` and `followcam.js` are needed to put the cat into another scene: call `createCat(scene, {R:600, spawnUp, colliders:[]})`.

## Known limits
- The camera can clip into hedges and walls; there is no camera collision.
- Turning in place has no dedicated turn animation.
- The sleep pose is a lowered, rolled body with the head turned and the tail curled. It is not a true spine curl (the torso is one blob).
- Ground textures use sphere UVs, so they stretch near the poles. Spawn is on the equator at (0,0,R).
- The palette is still slightly greener and more saturated than the designer's reference; tune `PAL` in planet.js.
- Software rendering in headless chromium runs at about 1–2 fps, so I could only check animation timing with the demo sub-steps.

## Polish round 1
- round 1: cat materials switched from flat Lambert to `MeshToonMaterial` with a 4-step soft gradient (gouache value bands) × a procedural canvas map (dry-brush strokes + paper-tooth noise), shared by all cat parts. The tabby saddle used to be four bumps sticking out of the back ("potato spikes"); it is now dark bands sunk flush into the torso. Exports are unchanged. Still to do: head/body proportions (bigger head, slimmer neck), a real muzzle and whisker pads, and a softer gait.

## Polish round 2
- round 2 (20:34, very little time): head scaled to about 1.14×1.08×1.06 for a rounder, bigger cat head. The single muzzle blob is now two white whisker pads plus a white chin. Exports are unchanged and the page loads clean (favicon 404 only). The default `shot.png` is a rear view, so the face change is hard to see there. Still to do: a slimmer torso and waist, a softer gait, and a palette closer to the designer's muted paper scene (the ground is still a saturated green, see `PAL` in planet.js).

## Polish round 3
- round 3 (20:35, about 5 minutes): the torso is slimmer (main blob 0.092→0.078 wide, 0.088→0.082 tall; the belly and tabby bands narrowed to match). The chest and haunch keep their size, so the silhouette now tapers into a cat waist instead of a uniform potato (see side.png). Exports are unchanged and the page loads clean (favicon 404 only). Still to do: a softer gait, and moving the ground palette toward the designer's muted paper tones (`PAL` in planet.js).

## Polish round 4
- round 4 (20:38, about 2 minutes left): ground and hedge `PAL` in planet.js moved toward the muted olive and paper greens of the designer scene (lower saturation, warmer). Nothing else changed and exports are unchanged. The page loads clean (favicon 404 only) and shot.png is updated. Still to do: a softer gait, more cat-like proportions from the rear view, and a lighter, more paper-like grass tone.
