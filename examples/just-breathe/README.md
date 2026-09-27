# just breathe.

A 43-second sunset dogfight over the sea, in the manner of a hand-painted anime sky: a white, green and red flying boat, a navy float-biplane diving out of the light, violet cumulus with gold edges, a sea full of sun, and at the end, the words *just breathe.*

This one is **3D**. `index.html` (61 KB) is a WebGL2 raymarcher: one fragment shader draws the planes (signed-distance models, cel-shaded, with an ink outline), the clouds (piles of spheres with flat bases and billow noise, rendered as a soft shell), the sea (wave normals, reflections, sun glitter), the tracers, smoke and spray. The waltz, the engines and the guns are synthesized in the same file with Web Audio. Nothing is loaded.

It keeps the pack's contract (`window.draw(frame)`, `FRAMES`, `FPS`, `CUES`, `SCORE`), so the pack's scripts render and check it unchanged:

```bash
node ../../skills/javascript-animation/scripts/render.mjs index.html just-breathe.mp4
node ../../skills/soundtrack/scripts/sync-check.mjs just-breathe.mp4 --cues-file just-breathe.cues.json
node ../../skills/javascript-animation/scripts/asset-audit.mjs index.html
```

Open `index.html` in a browser with a GPU to watch it live (click to start the sound). Add `?scale=.5` for a lighter preview and `?debug` to see the shot name, time and plane positions. Headless Chromium with no GPU falls back to software GL (SwiftShader): expect about 6 s a frame at 1280x720, so a full render takes around two hours.

## How it is built

- **One world, many cameras.** Both flight paths are integrated once at load from "turtle" programs (speed, turn rate, pitch rate) plus a keyed altitude curve. Orientation comes from the path itself: forward is the velocity and up is the lift (acceleration plus gravity), so turns bank and the loop goes inverted without any hand-set angles. The rival rides the hero's own path 1.3 s behind, overshoots when the hero loops, and after the hit glides down until the water catches its floats. The cloud the hero dives through is placed on the hero's path.
- **Ten shots on a 3/4 bar grid** (96 bpm, 1.875 s a bar): a calm opening where the flying boat roars over the camera into the sun, a profile of the livery, the rival dropping out of the clouds, tracers, the dive through a cumulus, the loop seen against the sun, the reversal and the hit, the ditching seen from the water, one silent bar skimming past the floating biplane, and the ending, where the camera holds on the sun, the words come up, and the hero passes overhead into the light.
- **Sound follows the world.** Each engine's gain, pan and Doppler shift are computed from the camera and the plane at 30 points a second, and the gunfire is placed the same way. The music is a waltz in D minor (musette accordion, piano, strings, brushes). It stops for the silent bar and resolves to D major for the ending.

The planes and the scene are original designs made for this piece. The mood is borrowed, not the characters.
