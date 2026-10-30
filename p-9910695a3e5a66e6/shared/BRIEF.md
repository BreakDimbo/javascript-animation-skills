# 褶星 Fold — shared brief (read fully first)

Project: a clay/gouache miniature planet "褶星 Fold". Player is an old ORANGE short-hair cat (white chest, white paw tips, matte clay+gouache), free-roaming the planet. Non-combat, wandering/ambient. Only region 01 has sheep; every region has its own animals.

## LEARN FROM DESIGNER FIRST (mandatory, ~3 min)
The designer bot built the reference scene: /workspace/sheep/site (index.html, main.js, style.css, plus/*.js, docs/*.md, README.md).
Study how it does: hand-painted canvas ground texture (fields, hedgerows, pencil-tick grass, dithered paper-bleed edge), sheep sprites/meshes and their state machine, camera, paper background, restrained colour. Match that look: matte, paper texture, soft gouache bands, muted palette. Reference images: /workspace/fold/shared/full0.png (original scene), 00_hero_planet.jpg, 00b_cat_view_fold_meadow.jpg.

## HARD STYLE RULES
NO bloom, NO glow, NO sparkle/specular glitter, NO particles, NO chromatic aberration, NO glitch, no glowing bold text. Restrained, premium, cinematic (A24 / Wong Kar-wai). Small serif UI text if any.

## Tech conventions (so modules can be merged later)
- Plain ES modules, three.js r170 from /workspace/fold/shared/vendor/three.module.js (import via relative path ../shared/vendor/three.module.js). No build step, no npm, no CDN.
- Units: metres. Planet radius R = 600 m (the x10 planet). Cat body length 0.45 m, eye height 0.2 m; sheep ~0.9 m long.
- "Up" is radial (normalize(position)). Gravity toward planet centre. Never assume world Y-up for gameplay (OrbitControls only allowed in debug).
- Cat camera: spring-arm follow cam, 0.35–0.6 m above ground, 1.5–2.5 m behind, pulls to 3 m when sprinting.
- Each module lives in its own folder with index.html runnable standalone, and exports its main pieces from a module file (e.g. cat.js exports createCat(scene), updateCat(dt, input, planet)).
- Water: follow Ultra-Water techniques (notes: /workspace/fold/shared/ultra-water-notes.md; FFT/Gerstner-ish waves, shore foam, absorption colour) but POSTERISE into gouache bands; no glitter, no bloom.
- Serve test: `cd /workspace/fold && python3 -m http.server 8765` style; verify your page loads without console errors using headless chromium if available (e.g. `chromium --headless --screenshot` or playwright if installed). Save a screenshot as shot.png in your folder.

## Deadline
HARD STOP at 20:40 Asia/Singapore (UTC+8) — check `date`. By 20:35 stop adding features, make sure index.html runs, write NOTES.md (what works, what doesn't, how to merge). Work incrementally: get something running in the first 8 minutes, then improve. Only edit files inside your own folder.
