# just breathe.

A 43-second sunset dogfight over the sea, in the manner of a hand-painted anime sky: a white fighter with elliptical wings, green-white-red roundels and a tricolour rudder, a navy rival diving out of the light, violet cumulus with gold edges, a sea full of sun, and at the end, the words *just breathe.*

This one is **3D**. `index.html` (61 KB) is a WebGL2 raymarcher: one fragment shader draws the planes (signed-distance models, cel-shaded, with an ink outline), the clouds (piles of spheres with flat bases and billow noise, rendered as a soft shell), the sea (wave normals, reflections, sun glitter), the tracers, smoke and spray. The waltz, the engines and the guns are synthesized in the same file with Web Audio. Nothing is loaded.

It keeps the pack's contract (`window.draw(frame)`, `FRAMES`, `FPS`, `CUES`, `SCORE`), so the pack's scripts render and check it unchanged:

```bash
node ../../skills/javascript-animation/scripts/render.mjs index.html just-breathe.mp4
node ../../skills/soundtrack/scripts/sync-check.mjs just-breathe.mp4 --cues-file just-breathe.cues.json
node ../../skills/javascript-animation/scripts/asset-audit.mjs index.html
```

Open `index.html` in a browser to watch it live (tap or click to start the sound). Add `?debug` to see the shot name, time and plane positions. The offline render (`?render`) draws every pixel at full quality; headless Chromium with no GPU falls back to software GL (SwiftShader), so expect several seconds a frame and a few hours for the whole film.

## Play it

`index.html?play` (or the *fly ›* button on the film) turns the same world into a game: you fly the white fighter through five levels, then an endless evening. Nobody dies: a beaten plane smokes, glides down and ditches, and when it is your turn the screen says *just breathe.* and lets you try the level again.

- **Controls.** Phone: drag on the left half to steer (up climbs, let go and the wings level), hold the right half to fire, the small button boosts. Keyboard: arrows or WASD, space to fire, shift to boost, 1-3 to pick a card. The guns help a little with aim when a rival sits in a narrow cone ahead.
- **Levels.** *first light* (rookies), *the strait* (veterans join), *the gold nose* (a black-and-gold ace with 30 points of armour, a nose cannon and a health bar across the top), *the long evening*, *last light* (two aces), then endless evenings that get tougher by 15% each. Rookies fly slowly and shoot wide; veterans turn harder, lead their shots and break away when you sit on their tail. Your furthest level is remembered, so you can continue from it.
- **Ammunition.** Beaten planes may drop a glowing crate; fly through it. Ammo crates climb four tiers, each with its own tracer colour: standard rounds, incendiary rounds (harder hits that flare), four guns, explosive rounds (splash damage to rivals nearby). Green crates repair.
- **Between levels** you get a bonus for the level and for the armour you kept, and choose one of three cards: faster guns, hot barrels, long rounds, thicker skin, afterburner, magnet sights, or an ammunition tier.
- **Feel.** Hits flash the rival white, throw sparks in your ammunition's colour, ping, and mark the reticle. A kill holds the world still for a tenth of a second, then a fireball, tumbling debris, a shockwave ring, a boom with a sub-bass drop, and the score rising from the wreck; kills within five seconds of each other build a combo up to ×4. Gunshots are layered (a bright crack, a thump that drops in pitch, a mechanical tick), enemy rounds that pass close whizz, the afterburner roars, low armour sounds an alarm, and the ace arrives with timpani.

## Running on a phone

The live film and the game use a lighter path than the offline render, built for phone GPUs:

- **Baked sky.** At load, the sky (sun, cirrus, islands, rays) and the sky-with-clouds are painted once into two panoramas, a strip per frame. The sea reflects the panorama with one lookup instead of marching the clouds again, and the horizon haze is read from it too.
- **Clouds at low resolution.** Clouds are soft, so they are marched into a buffer at 40% of the render resolution, with the depth of their front, and composited at full resolution: planes still fly in front of, behind and into them.
- **Particles as geometry.** Smoke, spray, tracers, vapour and gulls are instanced quads, depth-tested against the raymarched scene, instead of loops inside every pixel.
- **Dynamic resolution.** The render scale moves between 30% and 100% of the screen to hold the frame rate; a post pass grades and upscales.
- **Cheaper CPU work.** Per-cloud values live in uniforms; flight frames are memoized.

It has been checked in headless Chromium (software GL) for correctness, not yet on an iPhone.


## How it is built

- **One world, many cameras.** Both flight paths are integrated once at load from "turtle" programs (speed, turn rate, pitch rate) plus a keyed altitude curve. Orientation comes from the path itself: forward is the velocity and up is the lift (acceleration plus gravity), averaged over 1.2 s and weighted by its strength, so turns bank, banks roll in and out at a believable rate, and the loop goes inverted without any hand-set angles. Chase cameras follow a frame averaged over a quarter second, so they glide. The rival rides the hero's own path 1.3 s behind, overshoots when the hero loops, and after the hit glides down to a belly landing on the water. The cloud the hero dives through is placed on the hero's path.
- **Ten shots on a 3/4 bar grid** (96 bpm, 1.875 s a bar): a calm opening where the fighter roars over the camera into the sun, a profile of the livery, the rival dropping out of the clouds, tracers, the dive through a cumulus, the loop seen against the sun, the reversal and the hit, the ditching seen from the water, one silent bar skimming past the floating rival, and the ending, where the camera holds on the sun, the words come up, and the hero passes overhead into the light.
- **Details.** The cumulus are piles of spheres with big round lobes grown onto them, then a shallower layer of small ones (lattices of random balls, blended into the surface), with feathered edges. They are lit the way a background painter would: three tones with soft steps (blue-violet shadow, rose middle, cream-gold light) chosen from a normal that follows the big lobes, a warm band where light turns to shadow, and a faint horizontal brush grain. The fighters have a lofted fuselage (a long cowling running into a pointed spinner), and carry exhaust stubs with soot streaks, wing cannons, an antenna mast, a tail wheel, and panel and control-surface lines that fade out when they get smaller than a pixel.
- **Small things.** A pilot in a leather cap sits behind a glass canopy that reflects the sky; the airframe casts its own shadows (wing on fuselage, tail on tailplane); the paint picks up the sky; exhausts flicker close up; spent cartridge cases tumble out of the hero's wings as it fires; the rival's engine coughs after the hit and dies on the water. Rocky islands sit in the haze on the horizon and in the water, low streaks of cloud lie along it, soft rays fan out of the sun, and a few gulls circle in the opening and the ending, with their calls in the soundtrack.
- **The fight.** Wingtip vapour trails appear only under high g (the break, the loop, the pull-outs). The rival opens fire as it dives and keeps firing through the chase; tracers are streaks, bullets that pass close to the camera whizz, cameras riding with a firing plane shake a little, and the hit throws a flash and tumbling shards. Motes of haze streak past the chase cameras to sell the speed. The rival rolls into its dive (its dive eases into the chase path with no kink in speed or acceleration, so it arrives without a shudder), and the hero rolls once as it flies into the sun.
- **Water that reacts.** Each plane leaves a trail of short wake segments over its last 3 s, weighted by how low and fast it flies. The sea shader turns them into ripples spreading out to both sides, ruffled dark water with sun glints under the prop wash, and foam only where something touches the water. Spray rises behind a low pass, and the rival's belly landing throws up a plume and leaves a sliding wake.
- **Sound follows the world.** Each engine's gain, pan and Doppler shift are computed from the camera and the plane at 30 points a second, and the gunfire is placed the same way. The music is a waltz in D minor (musette accordion, piano, strings, brushes). It stops for the silent bar and resolves to D major for the ending.

The planes and the scene are original designs made for this piece. The mood is borrowed, not the characters.
