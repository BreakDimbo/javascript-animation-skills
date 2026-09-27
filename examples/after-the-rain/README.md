# 雨停之后 / After the Rain

A 90-second animated painting in 3:4 portrait. It takes place on one morning by the Singapore River: rain on the street at dusk-blue first light, the terrace as the rain stops and the sun breaks through, a sunlit roastery, brunch, and a myna on a café umbrella that swoops down and steals a piece of the neighbours' muffin, then flies off over the river.

## How it's made

- **Six painted plates.** The picture is built on six anime-style background paintings made from the photos in [`/images`](../../images): the rainy street, the riverside terrace, the roastery, the brunch table, the myna on the umbrella, and the myna at the neighbours' table. People are cropped out of the street and brunch paintings. The plates are embedded in `index.html` as JPEG data URIs, so the film is still one self-contained file (about 4 MB). **This example is the exception in this pack: it is not zero-asset.** The paintings were the requested look, and matching them exactly meant using them.
- **Everything that moves is code.** Each shot is a camera move over one plate: pans, pushes, a tilt up. On top of the plate, all computed from `t`:
  - rain in two layers, and drops forming, swelling and falling from umbrella edges and the chain;
  - the puddle and the river redrawn in thin slices on a slow wave, so the water moves;
  - rings on the puddle, glints on the river, warm light that breathes through the leaves, dust turning in the roastery's sunbeams, steam off the coffee, lamp and window glow, sun rays when the sky clears;
  - the myna's blinks and the glint in its eye, crumbs falling at each peck, its shadow sweeping across the brunch table, and the painted myna flying off into the backlit distance with its crumb.
- **Film finish.** A soft bloom, a little gouache texture and grain, and a vignette.

## Sound

Synthesized in the page with Web Audio: 80 bpm, 4/4, so every cut lands on a beat. The theme on piano enters as the sun breaks over the terrace, moves to strings in the sun, and goes up an octave as the myna flies away. The heist is scored with pizzicato and a one-beat rest before the leap. Rain, room tone and the river follow the same weather curve as the picture, and every visible action has a sound: drips and plops, the call, the glint, the whoosh of the swoop, the pecks, the wingbeats.

## Files

- `index.html`: the whole film. Open it in a browser to watch it live, and click to start the sound.
- `storyboard.md`: the 11 shots with timing, camera, what moves, and sound.

## Render

```bash
node ../../skills/javascript-animation/scripts/render.mjs index.html after-the-rain.mp4
node ../../skills/soundtrack/scripts/sync-check.mjs after-the-rain.mp4 --cues-file after-the-rain.cues.json
```

(`asset-audit.mjs` reports the embedded plates. That is expected for this example.)
