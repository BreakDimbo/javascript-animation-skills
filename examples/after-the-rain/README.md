# 雨停之后 / After the Rain

A 90-second animated painting in 3:4 portrait. It follows one morning by the Singapore River: rain on the street, a warm bar, the terrace as the rain stops and the sun breaks through, a sunlit roastery, the promenade at noon, brunch, and a myna on a café umbrella that ends up at the neighbours' table pecking at their muffin, with the river glittering behind it.

## How it's made

- **Nine painted plates.** The picture is built on nine anime-style background paintings made from the photos in [`/images`](../../images): the rainy street, the brass bar, the riverside terrace, the roastery, the tree-lined promenade, the brunch table from above and from the side, the myna on the umbrella, and the myna at the neighbours' table. People are cropped out of the street, bar, brunch, overhead and promenade paintings. The plates are embedded in `index.html` as JPEG data URIs, so the film is still one self-contained file (about 6 MB). **This example is the exception in this pack: it is not zero-asset.** The paintings were the requested look, and matching them exactly meant using them. The only birds in the film are the ones in the paintings.
- **The camera.** Each shot is one continuous camera path over its plate, a Catmull-Rom curve through keyframes for position, zoom, roll and a row-by-row shear. The shear moves the bottom of the frame more than the top, so a sideways move shows parallax between the floor and the back wall. A slow noise drift keeps every frame hand-held. The moves are a crane from the towers down to the lit window, a pull-back up the bar's brass wall, a crane down to the terrace puddle, a rising truck through the roastery, a tilt down the promenade, a turning pan across the table from overhead, and a long take at the neighbours' table that goes in to the bill and then up and back over the river.
- **The transitions.** Both shots are rendered to their own layers and composited, and every cut is on a beat:
  - *push*: the camera flies into the lit window, which whites out warm, and the bar opens out of it;
  - *drop*: a raindrop lands on the lens and its expanding, refracting ring opens onto the terrace;
  - *whip*: a fast pan with directional motion blur, sideways from the terrace into the roastery and downward from the treetops onto the table and from the myna onto the neighbours' table;
  - *flash*: the roastery's window light blooms to white and fades up on the sunlit promenade;
  - *match*: the latte seen from above dissolves into the same latte seen from the side, the two cups aligned;
  - *rack*: focus pulls off the cup and onto the myna.
- **Everything that moves is code.** On top of the plates, all computed from `t`:
  - rain in two layers, and splashes where it hits the umbrellas, the glass canopy, the puddle and the tables;
  - raindrops on the lens: each one refracts the scene behind it upside down, and some creep and then run down the glass. The drop that opens the terrace joins them, and they dry up one by one when the sun comes out;
  - out-of-focus lights sliding past the lens, faster than the painting behind them;
  - drops forming and falling from awnings, umbrella edges and the chain;
  - the puddle and the river redrawn in thin slices on a slow wave, so the water moves; wind in the leaves; leaf shadows swaying on the wall and across the tables;
  - rings on the puddle, glints, sun rays, a lens flare when the sun breaks, shafts of sun and dust in the roastery, the wet ground steaming, leaves falling and tumbling over the promenade, pollen in the air;
  - steam off the coffee and the espresso machine, the myna's blinks and the catchlight in its eye, and crumbs falling at each peck;
  - a warm light leak across the push and the flash.
- **Film finish.** A soft bloom, a little gouache texture and grain, and a vignette.

## Sound

Synthesized in the page with Web Audio: 80 bpm, 4/4, so every cut lands on a beat. The theme enters on piano as the sun breaks over the terrace, continues through the roastery, moves to strings at the flash onto the promenade, and returns an octave up over the river at the end. The heist is scored with pizzicato under the pecks.

The sound effects are synthesized too, and follow the same curves as the picture:

- **Rain** in four layers: a hiss, a low body, single near drops ticking left and right, and rain drumming on the umbrellas. Far thunder rolls as the film opens. Indoors the rain is muffled and a short room reverb comes up.
- **Places:** the espresso machine's hum and its steam wand spluttering in the bar; far cups in the roastery; wind in the leaves that comes in gusts (strongest on the promenade); the river lapping and gurgling; songbirds once the rain has stopped.
- **Actions:** water drops with a rising pitch; the drop on the lens; ceramic cups and a spoon that ring with inharmonic partials; the myna's calls, built from rising whistles, a harsh chatter and a gurgle; each peck, and the crumbs landing on the plate a second later.
- **Transitions:** air and a high shimmer swell into the push and the flash; the sideways whip sweeps from left to right and the downward whips fall in pitch; a cup rings on the match; a low hum on the rack.
- **Mix:** a low cut and a gentle low-shelf dip keep the bass from covering the detail.

## Files

- `index.html`: the whole film. Open it in a browser to watch it live, and click to start the sound.
- `storyboard.md`: the 9 shots with timing, camera, transitions, what moves, and sound.

## Render

```bash
node ../../skills/javascript-animation/scripts/render.mjs index.html after-the-rain.mp4
node ../../skills/soundtrack/scripts/sync-check.mjs after-the-rain.mp4 --cues-file after-the-rain.cues.json
```

(`asset-audit.mjs` reports the embedded plates. That is expected for this example.)
