# 褶星 Fold — playable MVP (game/)
Run: `cd /workspace/fold && python3 -m http.server 8811` → http://localhost:8811/game/index.html
Controls: WASD/arrows walk · Shift run · Space jump · C sit · Z sleep · drag to look · touch: left-half stick.
Query: `?at=pond|mill|u,v` teleport · `&yaw=rad` heading · `?demo=walk` · `?close` cat close-up camera · `?mobile` force 2048 board.
Shots: `python3 shot.py out.png "query" W H waitms` (uses `--disable-gpu`: software canvas, ~5 s boot; WebGL = swiftshader).
Bake the board after editing world.js/ground.js: `python3 bake.py` → baked/board_{4096,2048}.png + mask + json (runtime falls back to live painting if missing).

## Structure
- world.js — layout (b10's: 01 meadow along(0), 06 pond along(173), 03 mill along(−210)), board extent u∈[−300,240] v∈[−95,95], board spec (path mill→paddock→pond, paddock hedge, pond bank/bed stamp, mill wheat sector/loop path/yard stamp).
- main.js — evolved b10 merge: modules imported directly (b2 meadow, b3 pond, b4 mill), their grounds + meadow hedges hidden, unified `heightAt` (meadow relief + mill hill + pond basin) used by cat, camera and a 90 m follow grid (0.5 m cells, snapped to the board lattice, rebuilt every 12 m with a height cache) + far sphere with a hole; clay hedge lumps (1 InstancedMesh) along painted hedges; tree/cloud sprites; reskin; light re-aimed in the cat's local frame (replica hemi + low warm sun, 28 m shadow box following the cat).
- Draw calls (desktop, meadow): grid, far sphere, hedges, trees, clouds, water, + module objects (~100). Not yet wired from b10: b5 planet (opt-in there), b6 train, b7 finds, b8 swallows, b9 sound — next run.

## r1 self-check (shots/r1/, compare_r1.jpg)
- Better: palette now the replica's bright limes, paper sky/edge, pencil ticks + tufts + flowers on the ground, clay hedges + Codex trees + clouds, water posterised (b3 Ultra-Water untouched), cat walks on terrain (hill, banks) and won't wade.
- Gaps vs X_final: (1) cat still b1 primitives — biggest gap; (2) ground at cat eye height is one flat green per 30 m field — the replica's richness comes from seeing many fields at once; needs mid-scale mottling + more varied nearby fields; (3) mill wheat stalks (b4) are ~1 m and read as bamboo next to a 0.25 m cat; (4) sheep are b2 primitives in wool colour, not the replica's sprites; (5) one cloud cell is lavender-shaded (atlas) — pick cells; (6) no paper vignette edge on the 3D view beyond CSS.

## r2 — sheep-view diorama camera (steering 21:24 SGT)
- Low cat-eye camera removed. artkit/dioramacam.js uses the replica's solved camera (layout.js cam): vfov 17.32°, elevation 24.5°, narrow screens keep the reference horizontal FOV (fitFov).
- Distance is 18.2 m: 53.6 × 0.45 / 1.33, so the cat takes the screen share a sheep takes in FINAL17 (about 4.9 % of frame width).
- Heading is carried along with the cat over the sphere (it never swings behind the cat). WASD and the stick move in screen directions. Drag orbits (elevation clamped to 0.22–1.35), wheel or pinch zooms from 0.5× to 3×, and H returns to the sheep view.
- Portrait screens tilt down until the top ray dips as far as in the reference (390 wide: about 46°); otherwise the top half would be empty paper.
- Curvature (artkit/bend.js): the vertex chunks are patched so world space drops by s²·(1/2R′ − 1/2R) around the focus, with R′ = 42 m (`?bend=`). The shadow depth pass uses the same bend; sprites and b3 water have it too.
- Edge: the ground fades into the paper with a ragged, pooled watercolour rim at 26–38 m from the camera (`?fog0` and `?fog1`). Props use scene fog over the same range.
- Ground (artkit/minifields.js): a miniature patchwork covers the whole planet. It uses 3D Voronoi fields (2.7 m cells, warped), each with its own brush-stroke direction, pigment pools and pencil ticks. About 52 % of field edges become 4–7 cm painted hedges that cast a soft shade away from the sun, and 6 % become footpaths. Flower drifts are added on top. The baked board now supplies only pond, mill and wheat stamps; the lane is drawn crisp from a distance field (`laneField`). The 3D clay hedge lumps and the board trees are gone; `?lumps` brings the lumps back.
- Trees: the same Voronoi maths in JS plants sprite trees on the painted hedges within 24 m of the cat, replanted every 7 m. They are 0.2× scale (about 0.6–1.1 m) and the pink ones are rare.
- Clouds are off (`?clouds` to show them).
- Query parameters: `?cyaw=rad` sets the camera heading, `?zoom=k` the distance, `?bend=R'` the curvature, `?nomini` gives the old board look, and `?close` the cat close-up (fov 40, near 0.03).
- Shots: shots/r2/ — compare_r2_angle.jpg (same angle as FINAL17 and X_final), sheet_1440.jpg, sheet_390.jpg, and {start,walk,pond,mill,close}_{1440,390}.png.
- Honest gaps: see the report. Module props (b3 pond about 26 m with reeds, b4 mill 8.5 m) are at real scale and dwarf the miniature frame. Fields are still about 2× larger relative to the cat than the reference's fields are to a sheep. The planet reads as a small-planet horizon rather than a bounded board. The cat is still b1 primitives.

## Acceptance checklist (user, via Soul, 21:59 SGT). Every item is judged against the sheep original and re-ticked each round.
Status per round: ✅ done · 🟡 partial · ❌ not started

| # | Item | r3 |
|---|------|----|
| 1 | Composition: one whole board on paper with a paper margin and a ragged watercolour edge; the small planet appears only when zoomed out | 🟡 board and margin done; the edge is torn-ragged rather than FINAL17's sprayed dry-brush bleed |
| 2 | Scale: fields, hedges, trees, sheep and cat relative to each other as in the original; pond, mill and station shrunk to match | 🟡 fields, hedges, sheep, cat and trees are close; pond, mill and station not yet shrunk |
| 3 | Ground: colour variation inside fields, pencil-stroke grain, small flowers, wheat brushwork, thin wavy dark hedges | 🟡 hedges are now continuous wavy lines; grain and flowers are too faint; wheat is flat |
| 4 | Water: Ultra-Water quantised into gouache steps, foam strokes at the banks, no highlights | 🟡 river has 3 gouache steps, drifting pale streaks and a sandy bank; no bank foam strokes yet; the b3 pond is not re-scaled |
| 5 | Characters: new cat (orange, white chest, white paw tips), walk/run/jump/sit/sleep/stretch; sheep from the original sprite sheets, grazing and wandering | 🟡 sheep ✅ (replica sprites driven by the b2 flock AI); cat is still b1 primitives |
| 6 | Material: paper grain and saturation as in the original, soft shadows, matte clay | 🟡 paper ✅; ground saturation close; contact shadows OK |
| 7 | Details: clouds, cloud shadows, wind in the grass, small serif region names, small finds in transition zones, natural region seams | 🟡 serif region names ✅; clouds hidden; no cloud shadows, wind, finds or seams |
| 8 | Performance and compatibility: smooth on desktop and mobile, 0 console errors, touch controls | 🟡 0 errors in shots; draw calls low (instanced sprites, one ground); touch stick from b1 |

## r3 — board framing, flock, river, field and hedge scale (steering 21:47 SGT)
- Default frame: the board window (dioramacam.board, half size 3.3 × 4.6 m) is set from the cat. Its centre is the target plus yaw × 0.75 m, which matches where the board sits in FINAL17. It sits on paper with a margin all round. Zooming out to 1.4–2.3× HOME_D grows the board and bends the planet in.
- Paths and river are analytic in the ground shader (foldPaths in ground.js mirrors world.js lanePath / meadowPath / riverPath), so they stay crisp at any zoom. The earlier distance-field texture was about 0.45 m per texel and broke the thin river into dashes.
- River: 0.2–0.29 m wide, with a sandy bank, three quantised water tones by depth, and slow drifting pale streaks (uTime). No highlights.
- Flock: the 14 b2 sheep keep their AI. They are drawn with the replica's sheep atlas (createFlock in sprites.js), mapped into the board as u' = 0.9 + 0.085u and v' = 0.12v, with a fake cat position so they still shy away from the cat. b2 runs at 2× speed.
- Fields: Voronoi cell 1.75 → 3.0 m. Colour is nearly one meadow green, as in FINAL17, with about 13 % wheat fields. Mini footpaths are off (the analytic path replaces them).
- Hedges: fixed a bug where each side offset its line independently, so the wobble cancelled the core. Edges are now oriented consistently (sg). Width 0.08–0.12 m, colour #356516 → #548c34.
- Trees: 0.13× scale. They stay clear of the river and paths and of a 1.4 m spawn circle.
- Cat spawn is at board (0.3, −1.0), between the path and the river, beside the flock.
- r3 shots: shots/r3/compare_r3.jpg (same angle as FINAL17), compare_r3_portrait.jpg (X_final, same aspect, plus 390), sheet_1440.jpg, and {start,walk,pond,mill,close,zoomout}_1440.png, start_390.png, xfangle_1188.png.
- r3 known regressions and gaps (fix first in r4):
  1. `?zoom=3` shows empty paper. The planet does not appear when zoomed out. Probably the board growth or the discard margin kills everything at pl → 1, or uFade/fog is clearing the ground.
  2. Pond: b3 is still at real scale, and its water and reeds float above the board top, unclipped. The mill is not visible at `at=mill` (clipped by the board, or the teleport is off). Next: shrink the pond to about 0.3 and the mill to about 0.25 about their centres, and scale heightAt to match.
  3. Compared with FINAL17:
     - Our hedges are uniform lines. FINAL17's are softer, with variable width and branching T-junctions.
     - Our fields are flatter, with no streaky light and dark brushwork, and the flowers are too faint.
     - The wheat is a large flat ochre. FINAL17 has one small wheat corner with a stroked texture.
     - Our board edge is torn paper. FINAL17's is a sprayed dry-brush speckle.
     - Our sheep are slightly smaller than FINAL17's, and there are fewer of them in frame (about 5 vs 12).
     - Our trees are too few.
     - The river needs foam strokes along the banks.
     - The cat is still b1 primitives.

## r4 — 22:10–22:30 SGT
Changes:
- Zoom-out fixed: fade/fog offset by dz = D − HOME_D, so the planet is filled with fields, river, trees, sheep and clouds (shots/r4/zoomout_*).
- Board edge: dry-brush spray speckle in board-local coords (fixed to the board, world scrolls under it).
- Pond PS 0.2 and mill MS 0.12 scaled about their anchors; pond recoloured to the river's gouache blues + foam rings; reeds capped; mill teleport moved; rebaked.
- Hedges: one-sided offset bug fixed; width varies .022–.07 m, dark wavy green; junction trees.
- Fields: per-field green pick, wind gusts, cloud shadows, round flower dabs, wheat fields (ochre streaks); grazed patches follow the sheep (uGraze[14]).
- River: sandy banks, 3 depth tones, drifting streaks, bank foam strokes. No highlights.
- Trees: edge + hedge-junction placement from sheep tree atlas, one forced pink, blob contact shadows; sheep blob shadows.
- Cat redesigned (marigold tabby, cream bib/belly/socks, amber eyes, object-space stripes); idle/walk/trot/sprint, jump, sit (C), sleep (Z), stretch (7 s idle).
- UI: debug text only with ?debug; help line is small italic serif, fades after 6 s ('?' re-shows).
- Spawn (0.3,−4.3) clear of flock; flock mapped with bounded tanh into the default frame.
- Diorama clouds on by default (34 puffs, 1.1–2.0 m, 2.6–3.6 m up); ?noclouds disables.

| # | Item | r4 status |
|---|---|---|
| 1 | Composition | ✅ board on paper, speckle edge; planet only zoomed out |
| 2 | Scale | 🟡 pond/mill now diorama scale; fields still slightly larger than FINAL17, sheep a bit small |
| 3 | Ground | 🟡 field greens, flowers, wheat, hedges done; pencil grain weaker than original; no wheat corner in default frame |
| 4 | Water | ✅ quantised blues, bank foam, no sparkle |
| 5 | Characters | 🟡 new cat + 6 states; close-up is still primitive (cone ears, cylinder legs); ~9 sheep visible, clustered at the top, target 12 |
| 6 | Material | 🟡 matte clay, blob shadows; sheep/tree shadows lighter than original |
| 7 | Details | 🟡 clouds, cloud shadows, wind, serif names done; region seams + small finds NOT done |
| 8 | Performance | 🟡 0 console errors in all r4 shots; ~3 extra instanced draws; touch controls unchanged from r3, not device-tested |

r4 gaps / next (r5): spread flock to 12 across the frame + darker shadows; more edge trees (original has ~8 big ones on the rim); wheat corner bottom-right of meadow; field cell ~2.4; cat close-up refinement (ears, tapered legs, face); region seams and transition finds; pond bank stamp tighter.

## r5 — 22:30–22:48 SGT (local git initialised at /workspace/fold; one commit per item, `git log --oneline`)
Changes:
- #1 12 sheep: each has a home scattered over the whole default frame (clear of river, path, cat spawn and rim trees); b2's brain adds only ±0.4 m of wander; the cat is mapped through the nearest home so that sheep still shies away. The other 2 b2 sheep are hidden. Contact shadows are darker (.52 sheep / .5 trees, deeper green-black).
- Review notes: the horizontal lane moved off-frame (v≈−15 near home), leaving one diagonal main path (meadowU in world.js mirrors fpMead in ground.js). Sheep scale .36→.46; cat ×.62 (about half a sheep).
- #2 / review #3: 9 hand-placed rim clumps (bottom-left group of 3, bottom-right group of 3, top-right, right edge, top) at 1.25–2.0× tree size, with dark contact pools.
- #3 wheat corner: the field under (3.0, −5.95) is forced to wheat (uWheatId uniform). Field cell 3.0→2.5.
- #4 cat close-up: pinched rounded ears with pink insides (no cones), tapered lathe legs, toe-bump paws, soft upper lids, slit pupils, small smiling mouth. Still orange with a white chest and white socks, matte clay. Default-frame cat is ×.62.
- #5 pencil grain: two crossed sets of short dash strokes (4–7 cm), value only.
- Review #4 flowers: two dab sizes, about 2× density, per-dab yellow/white/orange at full strength.
- #6 seams: board-stamp/patchwork blend widened with low-frequency noise. Finds: 10 clay props (gate, stone, bucket, signpost) — 4 in the home frame, 6 along the lane toward the pond and the mill.
- #7 pond bank: sandy lip 0.26 m (was a 0.64 m blurry apron).

| # | Item | r5 status |
|---|---|---|
| 1 | Composition | ✅ board on paper, speckle edge, planet only zoomed out; one diagonal path |
| 2 | Scale | 🟡 sheep and cat now in proportion and fields smaller; pond still fills its board (cut at the top edge) |
| 3 | Ground | 🟡 field greens, pencil ticks, flowers, wheat corner all in; FINAL17's grain is softer and more painterly than ours |
| 4 | Water | ✅ (bank tightened) |
| 5 | Characters | 🟡 12 sheep spread; cat redesigned with rounded ears and tapered legs; it reads as a toy rather than FINAL17-level sculpt |
| 6 | Material | 🟡 matte clay, darker contact pools; our trees are brighter and more saturated than FINAL17's layered greens |
| 7 | Details | 🟡 finds and seam blending in; BUG: hand-placed in-frame clouds do not render (the mesh logs 34 instances, but even a 3 m test cloud over the cat is invisible; far clouds do show) |
| 8 | Performance | 🟡 0 page errors in all r5 shots; +1 draw for the finds (10 small meshes, ~30 draws: worth merging); touch not device-tested |

Gaps / r6 plan:
1. Fix the in-frame cloud bug (check the cloud billboard against the near-ground mesh: depth and order, the bend, the board cull) and place 1–2 whole clouds like FINAL17.
2. Tree colour: darker layered shadow greens (tint the atlas toward FINAL17's #3e7a2a shadows); fewer stray pink trees outside the home frame.
3. Pond: shrink PS to ~0.15 or move the camera target so the whole pond sits inside the board; trim the mill yard stamp (it reads as a big wheat blob in mill_390).
4. A small stone bridge where the off-frame lane crosses the river (visible in zoom-out).
5. Merge the finds into one geometry; add a few in the pond and mill seams.
6. Softer, more painterly grain and field colour (closer to FINAL17's yellow-green warmth).
7. A cat close-up pass: muzzle shape and a softer head-to-neck join.

## r6 (22:49–23:05 SGT)
Changes: clouds fixed (were buried under turf — height now relative to heightAt), 2 whole small clouds over the board;
tree grade with darker layered shadow greens, single pink tree by the meadow; pond PS .2→.15 fits its board, mill yard trimmed (r 5.2);
humped 9-stone bridge where the diagonal path crosses the river (u −1.8, v −14.7); all finds (17 incl. pond + mill edge props) merged into 1 draw call (2444 tris);
softer pencil grain, warm grade (1.06,1.055,.9), organic fields (warp .58, hedgeP .66); cat: no brows/mouth, small nose, smaller sheened eyes,
neck/scruff mass, tapered shoulders/thighs, soft stripes. Grass bdE vs FINAL17: 2.48 → 2.29 (dL −2.6, db +1.7).

| # | Item | Status |
|---|------|--------|
| 1 | Composition | ok — single diagonal path, whole clouds inside frame |
| 2 | Scale | ok |
| 3 | Ground | improved — organic fields; grass still ~2.6 L darker than ref |
| 4 | Water | ok — Ultra-Water quantised, pond fits board |
| 5 | Characters | in progress — cat less toy-like, torso still chunky / shoulder bulky |
| 6 | Material | ok — matte clay, vertex-colour finds |
| 7 | Details | ok — bridge, pond/mill finds |
| 8 | Performance | ok — finds 1 draw call |
Errors: 0 (all r6 logs).

## r7 (23:02–23:26 SGT)
Cat route switched by steering to Tripo + Blender. **Tripo key present and authenticates; balance 0 → no paid task submitted** (plan: game/docs/tripo_plan.md).
Placeholder pipeline run end-to-end instead: `~/apps/blender -b --python tools/blender/cat_pipeline.py -- --out game/assets/cat/cat_placeholder.glb` (2.6 s).
- mesh: metaball body (spine, neck, skull, single muzzle form, cheeks, muscled tapering legs, 17-ball tail) + cone ears → voxel remesh (4.5 mm) → smooth → decimate → **one closed surface, 5,958 tris / 3,002 verts** + eyes/pupils/nose on the head bone
- colour: painted vertex colours (marigold, soft mackerel stripes, ringed tail, white bib/belly/muzzle, white paw tips); in game the artkit gouache toon + grain material
- rig: 23 bones (root, hips, spine, neck, head, 2 ears, 4 tail, 3×4 legs), automatic weights (0 unweighted verts)
- actions (8): idle, walk, trot, run, sit, sleep, jump, stretch — in place; strides walk .122 / trot .196 / run .367 model-units per cycle
- export: Draco glb (level 7), **273 KB**; loaded with GLTFLoader + DRACOLoader; primitive cat stays as fallback (also `?primcat`)
- game: mixer weights blended by speed (idle→walk→trot→run), gait phase advanced by distance/stride (paws planted), sit/sleep/stretch/jump by state, jump time from vy; scaled to the primitive's footprint ×0.9 (≈ half a sheep)
- Tripo prompts (not yet run): see docs/tripo_plan.md (prompt + negative prompt, image_to_model P1-20260311 from cat_turnaround side crop)
Other items: grass grade (1.135,1.14,1.04) → **grass bdE 2.29 → 1.05**; pond-board lane reaches the bank; dark field tone lifted (lens sliver);
bridge path flares + abutment contact shadow; far clouds 34 → 14.

| # | Item | Status |
|---|------|--------|
| 1 | Composition | ok |
| 2 | Scale | ok — glb cat ≈ half a sheep |
| 3 | Ground | ok — bdE 1.05 (db +3.1 still a touch yellow) |
| 4 | Water | ok |
| 5 | Characters | improved — one continuous rigged cat; placeholder until the Tripo mesh; walk swing is subtle |
| 6 | Material | ok — clay toon on glb; Tripo bake pending |
| 7 | Details | ok — bridge flares/shadow |
| 8 | Performance | ok — cat 1 skinned draw + 5 tiny parts, 273 KB |
Errors: 0 (all r7 logs).

## r8 (29 Oct 2026, 23:25–23:40 SGT)
Tripo: `assets/cat_tripo/` checked at start and end. It holds only `cat_ref.jpg`, the colour reference, so no glb, fbx or obj was found. No Tripo API calls were made and Tripo's rigging was not used.

| item | change | check |
|---|---|---|
| review 1, colour | ORANGE (.80,.53,.25), DK (.64,.37,.15), WHITE (.90,.84,.71): warm ochre from cat_ref.jpg | close_1440 |
| review 2, eyes | eye r .0115→.0136, seated .009 into the skull, a dark rim (eyerim) sphere behind, pupil .0078, matte with no dots | close_1440/390 |
| review 3, shadow | PCFSoftShadowMap; sun frustum follows the cat at ±5.5 (±2.6 close, ±14 zoom) instead of ±14; soft contact blob under the hero (fades with jump height) | close_1440 |
| review 4, sheep | scale .46→.66, NSHOW 12→14 | compare_r8 |
| 2, cat | chest, neck and head +.015, extra shoulder ball (longer front legs), bigger bib; walk A .32→.44 (STRIDE walk .1649), knee lift ×1.35/×1.2; new sit (rump down, front legs upright) | walk_side, viewshot |
| 3, grass | grade (1.135,1.14,1.04)→(1.115,1.14,1.125): bdE .72, dL −.5, da −.8, db +1.9 (was +3.1) | grass_bde.py |
| 4, zoomout | hedge probability falls to 42 % beyond 8–26 m from the home flock, so far fields merge into larger, varied parcels | zoomout_1440/390 |
| 5, walk strip | `walkside.html`: 6 rows over one cycle, the cat advanced by STRIDE·t/T over a ticked ground line, guides at the stance paws; planted paws drift ≤ .01 model units | walk_side.jpg |
| --src | `cat_pipeline.py --src X.{glb,fbx,obj}`: joins meshes, applies transforms, auto-orients (long axis → Y, highest point = head → −Y), scales to the rig height .355, sits it on the ground, decimates to --faces, adds clean UVs (UVclean), Cycles-bakes the embedded texture to a 1024 map with the clay grade (desaturate .82, warm, 9-step value) and proxy-voxel weights when bone heat fails, then the same rig and 8 actions | stand-in test below |

Stand-in test: `--standin /workspace/standin_tripo.glb` exported the placeholder as one textured mesh with no rig, rotated 90° and scaled ×2.7, with the texture embedded. `--src` on it found 1 mesh with 6000 tris, scale .3458, BAKED 1024², UNWEIGHTED 0, 5000 tris, 8 actions. It previewed correctly oriented and textured. The test files stay off the repo in /workspace. In game, `?cat=<name>` loads assets/cat/<name>.glb, and the placeholder or primitive remains the fallback.
Errors: 0 page errors in all r8 shots.

## r9 (29 Oct 2026, 23:39–00:01 SGT)
Model check, start and end: `assets/cat_tripo/` holds only `cat_ref.jpg`. `assets/cat_oss/` holds TripoSR, TRELLIS and Hunyuan3D candidates plus `cat_oss.glb`, which the parallel worker integrated in 8a72b1b and loads with `?cat=cat_oss`. This round did not touch it.

| item | change | commit |
|---|---|---|
| review 1, cat size | hero visual scale .62→1.25 in the default frame (visual only; colliders and stride use root scale). Now reads at sheep size | af475cf |
| review 2, eyes | thin almond rim, green-amber iris, tall slit pupil, matte with no dots | 3ac1369 |
| 2, poses | numeric ground solver: sit (rump .099, front paws +.001 via fleg reach), sleep as a curled loaf, stretch as a play-bow | d6d162a |
| 3a, grass | B grade 1.125→1.15: bdE .60, db +1.7 (target +1 not reached) | 92469a7 |
| 3b, shadows | PCFShadowMap with radius 4.5 (VSM streaked) | 011070d |
| 4a, hedges | inner-board hedge probability ×(.88→.42 far) | 5bf6629 |
| review 3, cloud shadows | **not done**. The uCS[2] shader scaffold is in ground.js (inactive at r=0). The world-space feed never showed in the default frame, although a forced r×30 test darkened the board. The feed was removed in the fix commit | 5bf6629, fix |
| 4b, strips | walk, trot and run side strips (trot stance drift ~.009; run has suspension) | shots |
Shots: start, close, pose_sit/sleep/stretch, poses_r9, compare_r9, sheet_1440/390, strips. Errors: 0.

## r10 (30 Oct 2026, 00:01–00:24 SGT)
Start check: the default load (no ?cat=) is `assets/cat/cat.glb`, which is byte-identical to cat_placeholder.glb. The other worker removed `assets/cat/cat_oss.glb` in 773e89a. Its uncommitted edits are only in cat_oss/ and tools/blender/cat_oss_*. This round left them alone.

Root cause from r9: the Read tool caches images by path. Re-reading start_1440.png returned an older frame, so a cloud shadow that may have worked looked missing. Every check this round used a unique copy under /tmp. A second problem was real: shadow darkening applied before lighting got cancelled by the tonal grade.

| item | change | check |
|---|---|---|
| 1, cloud shadows | two big soft shadows in board-local metres (`uCS[i].xy`, r 4.2/3.4), applied in fog_fragment after lighting, tint (.55,.62,.70), noisy edges; drift ~20 and ~27 min per crossing and leave the board before wrapping; `?csk=0` turns them off | start_1440, compare_r10 |
| 2, grass | B grade 1.15→1.25: db +0.9, bdE .37 (measured with csk=0) | grass_bde.py |
| 1b, sit | chest pitched 41°, front legs plumb under the chest by bisection (the solution that points down), hind legs folded at the sides, haunch planted on the mesh minimum. The tail lies on the turf behind; wrapping it in front of the paws is **not done** (euler z on pitched bones doesn't yaw in world space) | poses_r10 side/top/3-4 |
| 1b, sleep | spine, neck and head all bend the same way (1.3/1.25/.85) into a C seen from above; tail curls the same way | poses_r10 top |
| 4, ?pose= | `?pose=sit|sleep|stretch` holds the state while the cat stands still | pose_*_1440 |
| 5, trot | STRIDE trot .1957→.22, measured on walkside (`stride=` override): stance paws drift ≤.001 per 1/24 cycle (≈.012 per stance before). Swing paws still skim below .0225 | /tmp/ws.py |
Errors: 0 page errors in the r10 shots. catview.html takes `el=` (elevation) for top views.

## r11 (2026-10-30)
- #3 trot: swing paw lift ×1.7 (`lk`), stride .22 kept (53f7b5a). Some swing samples still skim < .0225.
- #1 sit: pitch 28.6°, leg scale 1.0, straighter spine; tail aimed along a ground arc (`tail_path`) to the front paws (c381290). Tail reads thick (bone stretch ≤1.4).
- #2 sleep: C spine + roll (b42ad82); r11b lowers roll .1, sphinx fore paws, hind legs back, belly sunk .028 into turf, head no longer under body (ccbb091). Side view is a low mound; in-game close it reads as lying down, NOT yet a curled loaf with chin on paws.
- #4 clouds: gaussian falloff, ~45% strength (e54b800) — near-imperceptible light change at 390.
- `?pose=` now snaps the blend and no longer resets stretchT every frame (sleep/stretch close shots were showing idle).
- shots/r11: poses_r11.jpg (side/top/3-4/in-game), compare_r11.jpg, sheet_1440/390, pose_*_1440, start_*.
