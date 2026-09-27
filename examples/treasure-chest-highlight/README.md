# 宝箱高光时刻 · Treasure Chest Highlight

A single-file mobile-game reward sequence: tap a toon-shaded 3D chest to upgrade it through four rarity tiers, charge it, burst it open, reveal a legendary card on its own stage, then claim the rewards into the HUD.

Open `index.html` in a browser. It loads Three.js 0.160 and GSAP 3.12 from jsDelivr and fonts from Google Fonts. Everything else is in the file: the models, 2D card art, particles, and every sound (Web Audio).

The chest, card back, coins, gems and UI are original. The character cards are fan art of 22 Genshin Impact characters, all drawn in code. The characters and their names belong to HoYoverse and are not covered by this repository's MIT license. No official art, logos or other game assets are used.

| Pool | Characters |
|---|---|
| 5★ (legendary reveal) | 可莉 Klee, 钟离 Zhongli, 温迪 Venti, 雷电将军 Raiden Shogun, 甘雨 Ganyu, 胡桃 Hu Tao, 纳西妲 Nahida, 芙宁娜 Furina, 神里绫华 Kamisato Ayaka |
| 4★ | 菲谢尔 Fischl, 行秋 Xingqiu, 香菱 Xiangling, 班尼特 Bennett, 砂糖 Sucrose, 重云 Chongyun, 北斗 Beidou, 诺艾尔 Noelle, 芭芭拉 Barbara, 迪奥娜 Diona, 柯莱 Collei, 早柚 Sayu, 瑶瑶 Yaoyao |

Every opening draws characters at random. A rare chest gives one 4★ character and an epic chest gives two. A legendary chest gives one 4★ character, plus a 5★ character who gets the full reveal stage. Characters you haven't drawn before carry a NEW! badge. The owned list is kept in this browser's localStorage.

## Controls

- **自动 (default):** one tap plays the whole show: three tier-ups, charge, burst, the legendary reveal and the reward row. After that, tap 领取 to claim.
- **手动:** each tap on the chest upgrades it one tier. 开 启 opens it at the current tier. Opening at a lower tier gives a weaker burst and fewer rewards, and skips the hero stage.
- **图鉴** (bottom-left, while idle): shows every character, with the ones you haven't drawn yet dimmed. Close it with ✕, a tap outside, or Esc.
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

- **Characters:** Klee is drawn individually. The other 21 share one configurable chibi renderer (`drawChibi`). Each of those is a settings object in `CHARS`: hairstyle (short, bob, long, twin tails, ponytail) with optional tip gradient, bangs (long lock on either side), eye color per eye, special pupils (plum blossom, clover, diamond, droplet), eyeliner, beauty mark, eyepatch on either eye, mouth, brows, outfit (coat, robe, dress, shorts, with collar, tie, belt, bow, apron, bell, socks), pose (wave, point, thumbs-up, peace sign, hands on hips, hands behind back, holding a prop, cheering, hand to chin), a separate glove for each hand, plus drawing hooks for signature props, accessories and companions. To add a character, add one entry to `CHARS`.
- **Design references:** each character's colors, hairstyle, accessories and which side they sit on were checked against written descriptions of the official designs (wiki and cosplay-guide summaries). Official images were not used. A few side placements could not be confirmed from text and are best guesses: Klee's clover pin, Venti's beret flower, the side of Hu Tao's plum branch, Beidou's hairpin, Collei's hairpin, Xiangling's hair clip, and Xingqiu's long bang.
- **Chest:** every plank, strap, rivet, corner post, handle, hinge, lock plate and the octahedral gem is its own mesh. The plank seams are real 3.5 cm gaps in front of an inner core box. During the charge the core's colour ramps up, so light comes through the gaps between planks and staves.
- **Shading:** `MeshToonMaterial` with a 4-step gradient map. There are three lights: key, hemisphere sky, and a rim light in the tier colour, plus a stepped fresnel rim added in `onBeforeCompile`.
- **Outlines:** a second pass renders the view-space normal, part ID and linear depth of every mesh. A full-screen shader draws the thick silhouette by sampling colour-pass coverage in a ring. It draws thin seams where the part ID changes or the normals crease, and it only uses depth for large (7 %) jumps, so surfaces seen at a grazing angle don't pick up hatching. The colour pass is 4× MSAA at 1.5× resolution and is box-filtered down to the screen.
- **2D art:** each figure has a base, a blocky shade and a highlight. Thin inner lines are stroked per part, and the thick outer contour comes from dilating the figure's silhouette. Each card has its own element background pattern (flames, zigzags, waves, dots, hexes) and a ground shadow. Textures are drawn at ≥1.5× their largest on-screen size.

## Performance and memory

These numbers are for a 390×844 phone at 3× device pixel ratio, measured in Chromium's layer tree. Every effect is unchanged.

| | Before | After |
|---|---|---|
| Compositor layers | ≈ 577 MB, mostly three rotating 230vmax ray layers (130 MB each) and a 180vmax curtain light (79 MB) | ≈ 50–60 MB |
| WebGL render targets | ≈ 226 MB (half-float, 4× MSAA) | ≈ 136 MB (8-bit sRGB, 4× MSAA, still 1.5× supersampled) |

Changes:

- **Background and curtain**: the tier gradient, the three rotating conic ray layers and the reveal curtain with its rotating soft light are drawn into a single half-resolution Canvas 2D. They are soft gradients, so upscaling is not visible. Their gradients are built once and reused under a rotating context transform, so a frame allocates nothing unless the tier colors are mid-transition.
- **WebGL render targets**: color targets use 8-bit sRGB storage. The normal/part-ID/depth pass is packed into RGBA8: normal in RG, part ID in B (103 parts, 255 max), and linear depth over an 8-unit window in A. The main canvas has no depth buffer. Touch devices cap the internal resolution at 3.0 M pixels.
- **Compositing**: the flash is a fixed-size soft disc animated only by transform. The hero glow's size is updated only when it changes by more than 3 px. Blur filters on the light beams were removed (their gradients were already soft). Invisible beams, flash and glow switch to `visibility:hidden` so they drop out of compositing.
- **Allocations**: card art reuses two scratch canvases instead of allocating two per card. Per-frame vectors and colors are reused. Empty particle canvases are not redrawn.
- **Context loss**: if the mobile GPU drops the WebGL context, rendering pauses and resumes when the context is restored, instead of the tab crashing.
