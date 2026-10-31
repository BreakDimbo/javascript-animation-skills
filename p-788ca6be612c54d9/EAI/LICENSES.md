# Third-party code, fonts and assets

None of these are credited on the page itself. This file records where each one came from.
Everything was downloaded from the original publisher, or built in this repo.

## Code
| Item | Where it ships | Licence | Source |
|---|---|---|---|
| three.js r180 (core + HDRLoader) | bundled into `assets/js/map3d.js` | MIT, © 2010-2025 three.js authors | https://github.com/mrdoob/three.js |
| Lucide icons (37 glyphs, inlined as SVG paths) | `assets/js/app.js` (`ICONS`), inline in `index.html` | ISC, © Lucide contributors (parts © Cole Bemis, Feather, MIT) | https://lucide.dev, npm `lucide-static` |
| Teardown approach (exploded machine, rail with isolate/cut/hide, explode slider, idle tour). Approach only, no code copied | `assets/js/map3d.js` | MIT (teardown / claude-motion) | via https://breakdimbo.github.io/zh-blog-mirrors/elvar-teardown/ |
| MotionSites method (7-step spec / shoot / score loop). Approach only. No examples, media, copy or brand used | process only | MIT (instructions/scripts part) | https://github.com/Motionsites-AI/claude-skill |

## Fonts (all SIL Open Font License 1.1, self-hosted, subset to the glyphs this page uses)
| Family | File | Notes |
|---|---|---|
| Newsreader (Production Type for Google Fonts) | `newsreader-var.*.woff2`, `newsreader-italic-var.*.woff2` | variable wght + opsz, instanced and subset with fontTools |
| Inter (Rasmus Andersson) | `inter-var.*.woff2` | variable wght + opsz. Features kept: kern calt case tnum lnum frac zero cv05 cv08 cv11 ss01 ss02 |
| JetBrains Mono | `jetbrains-mono-400/500.*.woff2` | labels and keys |
| Noto Serif SC (Adobe/Google) | `noto-serif-sc-600-subset.woff2` | family name "EAI Serif SC", subset to the CJK headings on the page |

## Images and textures
| Asset | Where | Licence | Source |
|---|---|---|---|
| HDRI "Studio Small 09" by Sergej Majboroda, downsampled to 256×128 RGBE | `assets/js/machine-assets.js` (base64) | CC0 | https://polyhaven.com/a/studio_small_09 |
| Paper001 normal map, re-encoded 512 px WebP | `assets/js/machine-assets.js` (base64) | CC0 | https://ambientcg.com/view?id=Paper001 |
| Film grain | `app.css` `body::before` | self-generated (SVG feTurbulence), no licence needed | — |

## Sound
UI sounds are synthesised at runtime with WebAudio oscillators (`016-sound.js`). They are off by default. No sample files are used.
