# Tripo generation plan — Fold cat (r7, 2026-10-29 SGT)

Status: TRIPO_API_KEY is set and authenticates; balance check (free) at 23:17 SGT → `{"balance":0,"frozen":0}`.
**No paid task has been submitted.** Nothing below runs until credits are confirmed.

Sources (read 2026-10-29): pricing https://platform.tripo3d.ai/docs/billing ·
generation params https://platform.tripo3d.ai/docs/generation · rig/retarget https://platform.tripo3d.ai/docs/animation ,
https://developers.tripo3d.ai/en/docs/animations-rig , https://docs.tripo3d.ai/animation/retarget.html

## Prompts (exact)
- **prompt** (text_to_model, ≤1024 chars):
  `An old orange short-haired domestic tabby cat, standing on all four legs in a neutral side-on pose, tail held low and slightly curved, head level looking forward. Real adult cat proportions: body about 0.45 m long, slim waist, long legs, small rounded head with a short muzzle, upright triangular ears. Marigold orange fur with soft darker orange mackerel stripes, a clean white chest bib and white paw tips. Handmade clay sculpture look with a soft matte gouache surface, gentle hand-shaped forms, one continuous closed body. Single object, centered, no base.`
- **negative_prompt** (≤255 chars):
  `cartoon, chibi, big head, big eyes, toy, plush, glossy, shiny, metallic, fur cards, hair strands, open mouth, eyebrows, base, pedestal, ground plane, multiple animals, accessories, collar, armor, text`
- **image_to_model** input: the side view crop of `artkit/tex/cat_turnaround.png` (2172×724 turnaround → crop the side-on cat, ~724×724, pad to a white square). No prompt is accepted by image_to_model; the image carries the style.

## Task types & parameters
| param | value | why |
|---|---|---|
| type | `image_to_model` (recommended) / `text_to_model` (cheap) | image keeps the approved turnaround design |
| model_version | `P1-20260311` | Tripo's low-poly-optimised model; face_limit 48–20000; no `quad`/`smart_low_poly`/`geometry_quality` (unsupported → API error) |
| face_limit | `8000` | web budget; Blender decimates to ~6k tris anyway |
| texture | `true` | base colour to bake into our hand-painted map |
| pbr | `false` | clay/toon material is ours; PBR maps unused (pbr=true forces texture) |
| texture_quality | `standard` | painted over in Blender; detailed/extreme not worth +10/+20 |
| texture_alignment | `geometry` | 3D consistency over image fidelity |
| orientation | `align_image` | side view aligned |
| auto_size | `true` | metres → 0.45 m body sanity check |
| quad | not set | unsupported on P1, and forces FBX + 5 credits on other versions |
| model_seed | fixed per candidate (101, 202, 303) | reproducible |

## Rigging: Blender, not Tripo
Tripo `animate_rig` supports `rig_type: quadruped` (rig model v2.5-20260210), but `animate_retarget` offers only **one** quadruped preset
(`preset:quadruped:walk`); no trot/run/sit/sleep/jump/stretch. Our Blender pipeline (`tools/blender/cat_pipeline.py --src tripo.glb`)
already auto-weights a 23-bone cat rig and authors all 8 actions, so we rig in Blender. Optional: `rig check` is free; a Tripo quadruped
rig + walk (25 + 10 credits) only as a reference for comparing weights.

## Candidates & credit estimate
| option | tasks | credits each | total |
|---|---|---|---|
| **Cheap** | 2 × `text_to_model` Turbo-v1.0/v3.1, texture=false (geometry only; we paint the colour map in Blender) | 10 | **20** |
| Cheap+ | + 1 × `texture_model` standard on the picked mesh | 10 | 30 |
| **Recommended** | 3 × `image_to_model` P1-20260311, texture=true standard, pbr=false | 50 | **150** |
| Recommended+ (optional) | + Tripo `animate_rig` quadruped 25 + `animate_retarget` walk 10 on the pick | 35 | 185 |

Uncertain (marked): (a) whether the "Standard Texture" column price (P1 image→3D = 50) already includes the `texture_quality=standard` +10
surcharge; the billing notes read as included (note 2: "default when texture_quality=standard"), worst case 60 each → 180 recommended.
(b) `negative_prompt` is documented for text_to_model only. (c) the 27-preset list for rig v2.5 is from the schema page; only
`preset:quadruped:walk` is quadruped. Prices change; re-read the billing page before submitting.

## After generation (Blender)
decimate → fix ears/tail/muzzle → clean UV (smart project) → bake Tripo colour + painted stripes/white bib/paw tips to a 1k colour map →
auto-weight to the pipeline rig → idle/walk/trot/run/sit/sleep/jump/stretch → Draco glb → `game/assets/cat/cat.glb` (placeholder kept as `cat_placeholder.glb`).
