# cat_oss.glb — open-source-model cat (r9 trial, loaded with `?cat=cat_oss`)

**Source:** `trellis2_cat_nonmetal.glb`, generated with **TRELLIS.2** (microsoft/TRELLIS.2, **MIT licence**) from the cat reference image;
metallicFactor set to 0 (the as-exported metallic=1 file renders dark/chrome and is not used). 94,248 tris, UV + 1024 WebP base colour.
No Tripo API used. Earlier trial on the TripoSR (MIT) mesh `triposr_cat_lincolor.glb` (vertex colour) is kept as
`tools/blender/cat_oss_pipeline.py`; it was dropped in favour of TRELLIS.2 (see verdict in game/shots/r9/).

**Build** (Blender 4.2.23 LTS, headless, ~15 s):
```
blender -b --python tools/blender/cat_oss_trellis.py -- --src game/assets/cat_oss/trellis2_cat_nonmetal.glb \
  --eyeL .0216,-.251,.278 --eyeR -.0216,-.251,.278 --out game/assets/cat_oss/cat_oss.glb
```
1. Merge the glTF UV-seam vertex splits (17,408 boundary edges → 0, closed); metallic forced to 0.
2. Orient: torso PCA yaw → long axis Y, head (ear tips) → −Y, Z up, ear-tip height 0.355 (placeholder rig units), centred on the torso.
3. Head slid 1.36 cm onto the spine midline (it sat off-centre); eye sites read off a gridded front/side render.
4. Legs: k-means of the four paws, then a per-slice shear stands each walking-stance leg plumb on a symmetric column
   (front ±.034, hind ±.038), fading to zero at the body junction; per-slice radius smoothed (lumps evened), never made thinner.
5. Voxel remesh 2.8 mm (one closed shell; whisker strands and crumbs dropped), light smoothing (strong on legs only),
   decimate to **6,000 triangles** (3,002 verts, 0 non-manifold edges).
6. Smart UV + Cycles selected-to-active bake of the TRELLIS.2 base colour (1024²), then the artkit clay grade:
   saturation ×0.86, warm ochre multiply (1, .97, .9), soft gouache value steps. Exported as JPEG q90.
7. Face kept from TRELLIS.2's texture (green irises, dark pupils, pink nose, white muzzle; matte, no highlight dots). No separate eye
   meshes, so the game's blink / closed-eye-in-sleep (which scales meshes named eye/pupil) does not apply to this cat.
8. Rig: the placeholder's 23 bones (same names and hierarchy), joints fitted to this mesh (leg columns, neck/head from the eyes,
   tail through edge-path quantiles), automatic heat weights: **0 unweighted vertices** of 3,002.
9. Actions: the placeholder's **8 actions — idle, walk, trot, run, sit, sleep, jump, stretch** — from `tools/blender/cat_oss_actions.py`
   (verbatim snapshot of `cat_pipeline.py`'s r9 action + ground-solver code, so parallel edits there can't change this build);
   in place, STRIDE walk .1649 / trot .1957 / run .367 (same as artkit/cat.js), sit/sleep/stretch planted by the numeric solver.
10. Draco glb (level 7): **`cat_oss.glb`, 361,916 bytes** (placeholder cat.glb: 287,956 bytes).

**Loading:** artkit/cat.js resolves `?cat=<name>` to `game/assets/cat/<name>.glb` (regex `[\w-]+`, no sub-folders).
This file deliberately lives only in `game/assets/cat_oss/`; to try it in game, copy it to `game/assets/cat/cat_oss.glb`
and open `index.html?cat=cat_oss`. The r9 comparison shots served it to that URL by request interception (no file in assets/cat/).
`cat_oss_tex.png` = the baked, graded texture (reference copy; the glb embeds its own JPEG).

## Re-applying actions (r10 sit/sleep rework)
The rig (23 bones, auto weights, 0 unweighted) and the actions are separate stages. The actions are exec'd with `ao/body/sc/OUT` in scope.
- Default: `tools/blender/cat_oss_actions.py`, a snapshot of `cat_pipeline.py` from line 200 (`# actions …`) to the end, plus JPEG texture export.
- To re-apply the shared actions currently in `cat_pipeline.py`, add `--actions-from-pipeline` to the build command. This was tested: 8 actions, 0 unweighted. Note that the pipeline exporter writes a PNG texture, which gives about 1.0 MB, so it is better to re-snapshot that section into `cat_oss_actions.py` and keep the JPEG args.

## Comparison (r9)
See `game/shots/r9/oss_vs_placeholder_{close,default,walk,close_390}.jpg`. All 8 capture runs logged 0 console errors.

## r10 cute clay kitten variants (`--look A|B|C`, tools/blender/cat_oss_look.py)
Build command: the same as above plus `--look A|B|C --out game/assets/cat_oss/cat_oss_<X>.glb`. Each variant is 6,000 tris and 3,002 verts, with the same 23 bones, 8 actions and 0 unweighted vertices.
Each build also writes `cat_oss_<X>_eyesclosed.jpg`, the same texture with the eyes closed.
- **A, recolour only.**
  - The texture is re-coloured by a luma ramp: light persimmon fur (250,166,86) with soft stripes (232,120,54) at 55 % contrast.
  - Cream bib, muzzle and socks (248,238,218) are widened by a 3-px dilation, and the paws are made fully cream.
  - The nose and the inner ears are pink.
  - The eyes are kept from the source.
  - The fur micro-detail is softened with a 1-px masked blur.
  - The tail rest pose is changed to rise gently up and back on the midline, with a relaxed tip. This fixes the r9 drift to the cat's right.
- **B, A plus proportions.**
  - The head is 17 % bigger about the neck, with rounder cheeks (+13 % width) and a muzzle 25 % shorter. The shape is changed on the source mesh before the remesh, so the bake still lines up.
  - The texture eyes are resampled 1.15× bigger and set 2.5 mm wider apart.
  - The tail rest pose is a question mark.
- **C, B plus clay.**
  - A 2.2-px blur and 5-step gouache value bands remove the fur micro-detail.
  - Short dry-brush strokes (±4 % value) and paper tooth (±1.2 %) are added.
- **Tail method:** the 4 tail bones are posed onto midline target directions. The armature is applied to the mesh and the pose becomes the rest pose (`pose.armature_apply`). The actions rotate the tail relative to this new rest.

## Closed eyes (sleep / blink): `eyes.js`
The eyes are painted in the texture, so cat.js's eye-mesh scale blink cannot affect them. `eyes.js` swaps the body map to `<name>_eyesclosed.jpg` instead.
- One-line integration in `artkit/cat.js` `driveGLB`: right after `const closed = cat.state === 'sleep' || cat.blink < 0.12;` add `ossEyes(cat, closed);`
- Also add `import { ossEyes } from '../game/assets/cat_oss/eyes.js';` at the top.
- If no closed texture exists, the eyes simply stay open.

## Making cat_oss the default (after r10; not done here)
1. Copy the chosen `cat_oss_<X>.glb` to `game/assets/cat/cat.glb`. Before that, keep the placeholder as `cat_placeholder.glb`, which already exists.
   Alternatively, copy it as `game/assets/cat/cat_oss.glb` and use `?cat=cat_oss`. cat.js resolves `?cat=<name>` (regex `[\w-]+`) to `../game/assets/cat/<name>.glb`, with `cat.glb` as the fallback, so no code change is needed for the glb itself.
   - Option: change the default name in that one expression in cat.js (`cq||'cat'`) to `'cat_oss'`.
2. Copy `cat_oss_<X>_eyesclosed.jpg` next to it as `<name>_eyesclosed.jpg`. eyes.js resolves it relative to itself from `?cat`, so for the default either pass `url` or keep the file in `cat_oss/` named `cat_oss_eyesclosed.jpg`. Then add the 2 eyes.js lines above.
3. cat.js scales the glb to the placeholder's bbox ×0.9, so the bigger head of B/C makes the whole cat a little smaller. If needed, re-check the "half a sheep" size at the default frame.
4. `STRIDE` (walk .1649, trot .1957, run .367) is the same rig and the same actions, so it needs no change.

## Bug found in tools/blender/cat_pipeline.py (not edited, for its owner)
`import_src` orients the import with `rotation_euler` plus `transform_apply`. But the glTF importer sets `rotation_mode = 'QUATERNION'`, so the euler value is ignored and the orient step does nothing. Fix it in one of two ways:
- set `o.rotation_mode = 'XYZ'` before assigning `rotation_euler`, or
- transform the mesh data, e.g. `me.transform(Matrix.Rotation(...))`, which is what cat_oss_trellis.py does.
