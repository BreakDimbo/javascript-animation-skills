# 雨停之后 / After the Rain

A 90-second film in the style of a hand-painted anime background, made from the nine photos in [`/images`](../../images). It takes place on one rainy morning by the Singapore River. A myna shelters under a café umbrella while a couple ducks into a coffee roastery. The sun comes out, brunch arrives outside, and the myna steals a piece of the neighbours' muffin and flies off over the river.

Every frame is drawn in JavaScript on a canvas, and the soundtrack (piano, strings, celesta, pizzicato, rain, the river and the myna's calls) is synthesized in the same file with Web Audio. The film uses no image files, fonts or libraries. The photos were used only as reference for places, colours, food and people; none of their pixels are in the film.

- `index.html`: the whole film. Open it in a browser to watch it live, and click to start the sound.
- `storyboard.md`: the 19 shots with timing, camera, action and sound, and which photo each one comes from.

## Look

- **Painted plates, cel figures.** The backgrounds (sky, towers, trees, brass wall, stucco, wood grain) are painted once from seeded noise and cached. Figures are cel-shaded (one shadow tone, thin warm-brown outlines) and animate on twos (12 drawings a second), while the camera moves on every frame.
- **Weather as light.** The first half is cold slate and olive with warm windows in the rain. The second half is cerulean sky, crisp-lobed cumulus, dappled leaf shadows, glints on wet tiles and steam rising off the ground.
- **Camera.** Parallax layers give a crane down out of a dripping canopy, a low angle over a puddle, a dolly into the bar, a top-down rotation over the latte, a push through the window into the sky, a rack focus from a cup to the myna, the myna's own point of view, a tracking shot over the river and a crane up into the clouds.

## Sound

80 bpm, 4/4, so every cut lands on a beat. The theme is heard three times: on piano when the couple appears, on strings when the sun breaks, and an octave up as the myna flies away. The heist is scored with pizzicato and a one-beat rest before the leap. Rain, room tone and the river follow the same weather curves as the picture, and every visible action has its own sound (the drip on the myna's head, the umbrella folding, the café door bell, the steam wand, one celesta note per leaf of the rosetta, a ceramic knock for each plate, three pecks).

## Render

```bash
node ../../skills/javascript-animation/scripts/render.mjs index.html after-the-rain.mp4
node ../../skills/soundtrack/scripts/sync-check.mjs after-the-rain.mp4 --cues-file after-the-rain.cues.json
```
