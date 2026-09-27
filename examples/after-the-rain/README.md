# 雨停之后 / After the Rain

A 90-second film in a hand-painted anime style, made from the nine photos in [`/images`](../../images). There are no people in it: the lead is a small myna, drawn as an anime character. On a rainy morning by the river it shelters under a café umbrella and peers through a warm window at a latte being poured. The steam turns into a cloud, the sky opens, and in the sunshine the myna steals a piece of muffin and flies off into the cumulus.

Every frame is drawn in JavaScript on a canvas, and the soundtrack (piano, strings, celesta, pizzicato, rain, the river and the myna's calls) is synthesized in the same file with Web Audio. The film uses no image files, fonts or libraries. The photos were used only as reference for places, colours and food; none of their pixels are in the film.

- `index.html`: the whole film. Open it in a browser to watch it live, and click to start the sound.
- `storyboard.md`: the 19 shots with timing, camera, action and sound, and which photo each one comes from.

## Look

- **An anime lead.** The myna has a round body, a big glossy eye with two highlights, a curly forehead tuft and a slate blue-black coat with sheen and rim light. Its expressions: wet and fluffed, wide-eyed, a sweat drop, determined, and eyes shut in a grin.
- **Painted backgrounds.** Pastel shophouses with red-tiled roofs, lobed cumulus with crisp sunlit caps, scalloped foliage, and a gouache texture and soft bloom over every frame. Figures are cel-shaded and move on twos; the camera moves on every frame.
- **Camera and transitions.** A crane down out of a dripping canopy, a push in on a window, a point-of-view shot through a rainy pane, a top-down latte pour, steam that becomes a cloud and dissolves into the sky, a rack focus, a point-of-view shot of the muffin, a tracking flight over the river and a crane up into the clouds.

## Sound

80 bpm, 4/4, so every cut lands on a beat. The theme is heard three times: on piano when the myna reaches the window, on strings when the sun breaks, and an octave up as it flies away. The heist is scored with pizzicato and a one-beat rest before the leap. Rain, room tone and the river follow the same weather curves as the picture, and every visible action has its own sound (the drip on the myna's head, its wingbeats and landings, the steam wand, one celesta note per leaf of the rosetta, a ceramic knock for each plate, three pecks, a happy trill).

## Render

```bash
node ../../skills/javascript-animation/scripts/render.mjs index.html after-the-rain.mp4
node ../../skills/soundtrack/scripts/sync-check.mjs after-the-rain.mp4 --cues-file after-the-rain.cues.json
```
