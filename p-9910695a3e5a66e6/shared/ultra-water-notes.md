---
type: raw
source_url: https://github.com/Humpalumps/Ultra-Water
captured: 2026-10-29
captured_by: git clone --depth 1 + 公开 GitHub REST API（api.github.com，文档化接口）+ 本地运行截图
lang: en
---

# Humpalumps/Ultra-Water — 抓取记录（2026-10-29）

本文件为抓取快照与元数据，原件逐字拷贝在同名目录 `raw/2026-10-29-humpalumps-ultra-water/`：
- `README.md`（英文原文，12,340 字节）
- `LICENSE`（MIT，Copyright (c) 2026 Humpalumps）
- `THIRD_PARTY_NOTICES.md`（three.js / Dave Hoskins Hash without Sine / sebh UnrealEngineSkyAtmosphere，均 MIT）
- `package.json`（name 仍为 "gelatin-game-engine"；依赖 three ^0.186.1、lil-gui ^0.21.0；dev 依赖 vite ^8.3.5）
- `claude-launch.json`（仓库内 `.claude/launch.json` 拷贝：Claude Code 启动 `npm run dev -- --port 5199`）

## 仓库元数据（公开 GitHub REST API，读取于 2026-10-29 17:57 UTC+8）

- 描述："Real-time FFT ocean renderer for three.js (WebGL2): shore breakers, foam, caustics, underwater rendering and buoyancy at 200+ fps"
- ★197 / 28 forks / 0 open issues；语言 JavaScript；无 homepage（无在线 demo）；无 topics
- 创建：2026-10-28T16:27:44Z（= 2026-10-29 00:27 UTC+8）；最后推送 2026-10-28T23:03:51Z（= 2026-10-29 07:03 UTC+8）
- HEAD：ce9248fa20afbdf63fd4c11709f68d7368aca0a0（2026-10-28 23:03:49 +0000）
- 共 12 个提交（9b28bc1 → ce9248f，2026-10-28 21:58 至 2026-10-29 07:03 UTC+8），作者均为 Humpalumps，**12 个提交全部带 `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`**
- 作者账号：GitHub @Humpalumps，显示名 "Ian"，2026-01-26 注册，6 个公开仓库，2 位关注者，无个人主页/X 链接

## 提交列表（时间为 UTC）

```
ce9248f 2026-10-28T23:03:49Z Run the benchmark only on request, from a button in the perf panel
9a18dff 2026-10-28T22:18:27Z Add a performance panel with an uncap / cap toggle
a825fdd 2026-10-28T21:54:24Z Add a mobile profile that phones and tablets pick up automatically
e58ddcd 2026-10-28T17:00:21Z Add third-party notices for adapted MIT code
27e21ab 2026-10-28T16:28:28Z Retitle README to Ultra Water
d2f18e0 2026-10-28T16:20:35Z Add MIT license
8d16a6b 2026-10-28T16:16:15Z Add water colour presets to the Water folder
6f5a96d 2026-10-28T16:06:26Z Push water quality: AAA foam, clean caustics, sky, breakers
40bb600 2026-10-28T14:49:02Z Fix benchmark sync and cut frame cost ~25-35%
96fae38 2026-10-28T14:35:56Z Add underwater rendering and buoyant floating objects
19fab93 2026-10-28T14:05:04Z Tune water look, add glitter, breaker foam, sand ripples, README
9b28bc1 2026-10-28T13:58:36Z Add FFT ocean water renderer with island demo scene
```

首个提交说明："Three-cascade Tessendorf FFT (600/85/12 m), slope-moment roughness, coast-SDF shore breakers, planar reflections, single-MSAA water pass, baked sky cube, caustics, dual-filter bloom + AgX."（后来升级为 4 级联 + 2.1 m 毛细波层、eikonal 旅行时间场破浪。）

## 代码要点（读源码所得，HEAD ce9248f）

- 源码 `src/` 共 23 个 JS 文件约 4,536 行（`wc -l`）：engine/（PostFX、PlanarReflection、gpuTimer、fullscreen）、scene/（atmosphere、sky、terrain、islandHeight、floaters…）、water/（OceanSim 349、OceanSurface 643、shoreMap 301、UnderwaterPass 227、Caustics 164、Spray、MarineSnow、WaterQuery、bakeTextures）、main.js 589
- `OceanSim.js`：N=256，`CASCADE_LENGTHS = [600, 85, 12, 2.1]`，g=9.81，σ/ρ=7.4e-5（ω² = g·k + (σ/ρ)·k³），LOOP=300 s；PCG2D 哈希 + Box-Muller 高斯；JONSWAP（σ=0.07/0.09）+ 方向扩展（cos-2s，s 随 ω/ωp 变化，混合 cos²）；`jonswapParams`：α = 0.076·(gF/U²)^-0.22，ωp = 22·(UF/g²)^-0.33
- 默认海况：windSpeed 9 m/s、fetchKm 120、swellScale 0.7、swellWindSpeed 7、swellFetchKm 900、swellDirection −15°、choppiness 0.85
- GUI（lil-gui，标题仍为 "Gelatin Water"）：camera 七个机位（Golden hour 默认 / Breakers / Lagoon / Open ocean / Aerial / Flotsam / Underwater）、Sun & sky、Waves、Shore waves、Water（6 种颜色预设）、Floaters & underwater、Post、Quality
- 水色预设（线性 RGB 吸收 1/m）：clear [0.42, 0.075, 0.048]、tropical、toxic green、purple、rust orange、murky brown
- `window.app` 暴露 camera/views/ocean/surface 等；`window.runBenchmark`

## 本站实跑（2026-10-29）

- `npm install`（19 个包）+ `npx vite --port 5199` 本地起服务；系统 Chrome（/usr/bin/google-chrome）headless + `--use-angle=swiftshader`（软件 WebGL2，无 GPU）打开 `?desktop`，隐藏 HUD/GUI 后按机位截图。
- 软件渲染约 9 秒一帧（HUD 显示 8957.95 ms/frame），只能证明“能跑、画面如截图”，**不能验证 README 的 fps 数字**。
