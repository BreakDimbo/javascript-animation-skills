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
- **Everything that moves is code.** On top of the plates, all computed from `t`: rain in two layers, out-of-focus lights sliding past the lens, drops forming and falling from awnings, umbrella edges and the chain, the puddle and the river redrawn in thin slices on a slow wave, wind in the leaves and leaf shadows swaying on the wall, rings on the puddle, glints, sun rays, dust in the sunbeams, steam off the coffee and the espresso machine, the myna's blinks and the catchlight in its eye, and crumbs falling at each peck.
- **Film finish.** A soft bloom, a little gouache texture and grain, and a vignette.

## Sound

Synthesized in the page with Web Audio: 80 bpm, 4/4, so every cut lands on a beat. The theme enters on piano as the sun breaks over the terrace, continues through the roastery, moves to strings at the flash onto the promenade, and returns an octave up over the river at the end. The heist is scored with pizzicato under the pecks. Rain, room tone and the river follow the same curves as the picture, and every visible action has a sound: drips and plops, the espresso machine, cups, the whooshes of the whips, birds, the call, the glint, the pecks.

## Files

- `index.html`: the whole film. Open it in a browser to watch it live, and click to start the sound.
- `storyboard.md`: the 9 shots with timing, camera, transitions, what moves, and sound.

## Render

```bash
node ../../skills/javascript-animation/scripts/render.mjs index.html after-the-rain.mp4
node ../../skills/soundtrack/scripts/sync-check.mjs after-the-rain.mp4 --cues-file after-the-rain.cues.json
```

(`asset-audit.mjs` reports the embedded plates. That is expected for this example.)
