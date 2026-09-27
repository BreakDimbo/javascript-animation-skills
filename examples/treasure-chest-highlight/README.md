# 宝箱高光时刻 · Treasure Chest Highlight

A single-file mobile-game reward sequence: tap a toon-shaded 3D chest to upgrade it through four rarity tiers, charge it, burst it open, reveal a legendary card on its own stage, then claim the rewards into the HUD.

Open `index.html` in a browser. It loads Three.js 0.160 and GSAP 3.12 from jsDelivr and fonts from Google Fonts. Everything else is in the file: the models, 2D card art, particles, and every sound (Web Audio).

All art is original. The fox 赤曜, the thunder puffball 噼啪, the water sprite 汐汐, the chest and the card back were drawn for this piece. None of them comes from an existing game.

## Controls

- **自动 (default):** one tap plays the whole show: three tier-ups, charge, burst, the legendary reveal and the reward row. After that, tap 领取 to claim.
- **手动:** each tap on the chest upgrades it one tier. 开 启 opens it at the current tier. Opening at a lower tier gives a weaker burst and fewer rewards, and skips the hero stage.
- Top-right: the coin and gem balances and a mute toggle. Audio starts on the first tap.
- `?rm=1` forces reduced motion (no screen shake, 35 % of the particles). The page also follows the OS `prefers-reduced-motion` setting.

## Stage timings

| Stage | Duration |
|---|---|
| 1. Ready | Idle until tapped. The chest sways ±0.5 rad and floats. A "tap me" wiggle (0.45 s) plays 1.4 s after entering idle, then every 2.8 s. |
| 2. Tier-up (per tap) | 1.3 s: anticipation squash 0.13 s, 1.05-unit jump and 360° spin, colour switch with flash, particle ring and title slam at 0.34 s, landing squash at 0.69 s, elastic settle. Auto mode chains three of these (≈ 4.2 s). |
| 3. Charge | 1.1 s: shake grows (power2.in), plank seams go from dark to tier colour to white-hot, particles are pulled inward, a rising synth plays, and the last 0.12 s is a hard squash. |
| 4. Burst | 0.55 s before the reveal starts. The flash fades over 0.75–1.05 s and the shake lasts 0.45–0.69 s, both scaled by tier. |
| 5a. Legendary reveal | 2.9 s: the card arcs out of the chest and flips twice in WebGL (1.15 s). The chest collapses and the curtain fades in (0.1–0.6 s). The card lands at 1.12 s with a fanfare and confetti, the title slams at 1.2 s, the info panel appears at 1.45 s, and the stat numbers finish rolling at ≈ 2.9 s. It then waits for a tap. |
| 5b. Reward row | ≈ 1.8 s: the hero card flies into its slot (0.55 s). The other cards arc out of the chest 0.13 s apart, each flight 0.62 s, followed by a 0.9 s wobble and a 0.95 s count-up. |
| 5c. Claim | ≈ 2.4 s: 22 coins and 14 gems follow Bézier curves into the HUD (35 ms stagger, 0.6–0.9 s each), and the counter bumps on every arrival. The cards then fold away. |

A full auto run from the first tap to the finished info panel takes about 8.7 s.

## Intensity knobs

These are all in the `TUNE` object at the top of the script:

| Key | Effect |
|---|---|
| `power[tier]` | Burst strength per tier (0.6 / 0.8 / 1.0 / 1.35). Scales ring radius and width, streak speed, spark speed and sound level. |
| `flashByTier`, `flashMax` | Bloom flash opacity per tier. `flashMax` is a hard cap of 0.8. |
| `shakePx`, `shakePerTier` | Screen-shake amplitude in px. |
| `pushZoom` | Camera push at the burst (+0.025 per tier). |
| `particles` | Global particle multiplier. Particle counts also grow per tier inside `burst()`. |
| `chargeTime` | Length of the build-up. |
| `hopSpeed` | Time scale of the tier-up hop. |
| `idleSway` | How far the idle chest turns to show its sides. |
| `outlineOuterPx`, `outlineInnerPx` | Silhouette and seam line widths in CSS px. They stay constant on screen. |
| `supersample` | Internal render scale (1.5×). It is reduced automatically above about 4.6 M internal pixels. |

## How the look is built

- **Chest:** every plank, strap, rivet, corner post, handle, hinge, lock plate and the octahedral gem is its own mesh. The plank seams are real 3.5 cm gaps in front of an inner core box. During the charge the core's colour ramps up, so light comes through the gaps between planks and staves.
- **Shading:** `MeshToonMaterial` with a 4-step gradient map. There are three lights: key, hemisphere sky, and a rim light in the tier colour, plus a stepped fresnel rim added in `onBeforeCompile`.
- **Outlines:** a second pass renders the view-space normal, part ID and linear depth of every mesh. A full-screen shader draws the thick silhouette by sampling colour-pass coverage in a ring. It draws thin seams where the part ID changes or the normals crease, and it only uses depth for large (7 %) jumps, so surfaces seen at a grazing angle don't pick up hatching. The colour pass is 4× MSAA at 1.5× resolution and is box-filtered down to the screen.
- **2D art:** each figure has a base, a blocky shade and a highlight. Thin inner lines are stroked per part, and the thick outer contour comes from dilating the figure's silhouette. Each card has its own element background pattern (flames, zigzags, waves, dots, hexes) and a ground shadow. Textures are drawn at ≥1.5× their largest on-screen size.
