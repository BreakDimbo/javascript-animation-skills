# 褶星 Fold — art kit (artkit/)
n<!-- r2: + bend.js (diorama curvature), dioramacam.js (sheep camera follow), minifields.js (planet-wide miniature patchwork, GLSL+JS); ground.js gains miniPaint, watercolour edge fade and laneField(). followcam.js is no longer used by the game. -->
Target look = the designer's sheep-grazing replica (/workspace/sheep/site; renders sheep/out/X_final.jpg, FINAL17.png).
No Claude Code used. Codex image gen (default settings) via gen/run.sh.

## Contents
| file | what |
|---|---|
| palette.js | `PAL` unified colours (from sheep layout.js + sprite tones + cat), `rgb/rgba`, `nearestPal()` (Lab nearest family, used by reskin) |
| ground.js | `makeFrame` (gnomonic tangent frame), `paintBoard(spec)` (port of replica paintGround: blurred field polys, pigment pools, wheat ticks, brush streaks, 3-stroke paths, hedge shadow/mid/dab bands, per-pixel stamps, block-dissolve paper bleed → canvas + mask + hedge polylines + tree spots), `paintDetail()` (tileable 3 m pencil-grass tile: ticks / clover / tufts / flower dots), `groundMaterial(board, frame)` (Lambert; fragment projects world dir into the board frame → no UV seams, no pole pinch; triplanar detail + Codex paper tooth; outside board = paper) |
| clay.js | `clayMaterial()` (matte Lambert, Codex plasticine grain triplanar in object space, soft grazing darkening, no spec/emissive), `reskin(root)` (swap module materials → clay in palette; materials with their own shader hooks keep shader, colour remapped) |
| sprites.js | `createTrees` / `createClouds`: replica's Codex atlases as instanced billboards (1 draw each; trees upright on the sphere) |
| cat.js | fork of b1 cat: ground support = `planet.heightAt(up)`, `planet.blocked(up)` (pond), softer downhill snap |
| followcam.js | fork of b1 cam: jump damping uses alt-ground; keeps clear of terrain via `cam.heightAt` |
| tex/ | paper.png, clay.png (Codex, made tileable 512²), cat_turnaround.png (Codex design sheet), trees/sheep/clouds/grass/wheat.webp + meta.json (copied from the replica) |
| gen/ | Codex prompts + logs + raw outputs |

## Log
- r1 (20:41–21:25 SGT 2026-10-29): kit written; Codex: cat turnaround (old plump marmalade tabby, 4 views), paper, clay macro. Board baked offline (see game/bake.py).

## Next
- Cat: build the clay mesh from the Codex turnaround (visual hull of side+front silhouettes → SDF smooth → marching cubes in Python, projective texture from the 4 views, skinned to b1's rig). Current cat is still b1 primitives (reads as blocky).
- Ground: fields too uniform at cat eye level — add a mid-scale (8–12 m) mottling tile, crisper field edges, more flower drifts near paths.
- Sheep: swap clay sheep for the replica's sheep atlas sprites or a sculpted wool mesh.
- r4 (22:30 SGT): blobShadowMat, tree shadows, createClouds size/alt options, ground: speckle edge, hedges fix, field greens, wheat, flowers, graze, foam, wind, cloud shadows.
- r5 (22:48 SGT): createClouds fixed/keepOut options, darker blobShadowMat, ground: pencil ticks, flowers v2, wheat id, seam noise; cat ears/legs/face.
- r6: cloud height fix, tree grade, bridge + merged finds, organic fields, warm grade, sculptural cat (bdE 2.29)
- r7: Blender glb cat pipeline (placeholder), grass bdE 1.05, lens field lifted, bridge flares, fewer far clouds
- r8: ochre cat, inset eyes with a rim, contact blob plus a tight soft sun shadow, sheep .66, grass grade db +1.9, far hedges thinned, walkside.html strip.

## r9
- ground.js has a `uCS[2]` cloud-shadow uniform (xyz world centre, w radius; skipped when w≤0). It is not fed yet. r10: check vGW against the bent grid position, or feed board-uv centres instead.
- Hedges are thinner inside the board (hP ×mix(.88,.42,hFar)).
