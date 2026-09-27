# 雨停之后 / After the Rain

A 90-second film painted in the manner of a Ghibli-style still: soft gouache and watercolour, warm sunlight, cool blue-grey leaf shadows on rough stucco. It was made from the nine photos in [`/images`](../../images). There are no people in it: the lead is a Javan myna, painted naturalistically. On a rainy morning by the river it shelters under a café umbrella and peers through a warm window at a steaming cup of coffee. The steam turns into a cloud, the sky opens, and in the sunshine the myna steals a piece of muffin and flies off into the cumulus.

Every frame is drawn in JavaScript on a canvas, and the soundtrack (piano, strings, celesta, pizzicato, rain, the river and the myna's calls) is synthesized in the same file with Web Audio. The film uses no image files, fonts or libraries. The photos were used only as reference for places, colours and food; none of their pixels are in the film.

- `index.html`: the whole film. Open it in a browser to watch it live, and click to start the sound.
- `storyboard.md`: the 19 shots with timing, camera, action and sound, and which photo each one comes from.

## Look

- **The reference.** The look is matched to a single painted still of a myna on a canvas umbrella against a sunlit stucco wall. It has no outlines; the palette is muted cream, slate and olive; the light is warm with soft, blue-grey diagonal leaf shadows; the leaves are translucent against the sun.
- **The myna, painted.** The head and body form one silhouette. The volume comes from broad washes (a lit breast, a shaded back, the near-black head melting into the neck), with low-contrast feather strokes and soft mottling over them and tufts breaking the rim. The wing is brown-black with pale-edged flight feathers. The eye is amber, the bill and legs yellow, the forehead tuft spiky, and the tail tip white and ragged. The bird is painted on its own layer and set down slightly softened, like a brushed edge.
- **Painted plates.** Stucco with grain, the khaki canvas umbrella with folds and a rolled hem, a branch of sunlit leaves, soft cumulus, muted shophouses on the far bank. Every plate is softened slightly, and the whole frame gets gouache texture, bloom and a slight desaturation.
- **Camera.** The film keeps to what a painted still does well: side-on views in parallax layers, big skies, and close-ups of the myna or of one object. A crane down out of dripping leaves, a push in on a window, an over-the-shoulder shot through a rainy pane, steam that becomes a cloud and dissolves into the sky, a push in on the muffin, a tracking flight over the river and a crane up into the clouds.

## Sound

80 bpm, 4/4, so every cut lands on a beat. The theme is heard three times: on piano when the myna reaches the window, on strings when the sun breaks, and an octave up as it flies away. The heist is scored with pizzicato and a one-beat rest before the leap. Rain, room tone and the river follow the same weather curves as the picture, and every visible action has its own sound (the drip on the myna's head, its wingbeats and landings, its shake and its preening, sparkles on the muffin, three pecks, a happy trill).

## Render

```bash
node ../../skills/javascript-animation/scripts/render.mjs index.html after-the-rain.mp4
node ../../skills/soundtrack/scripts/sync-check.mjs after-the-rain.mp4 --cues-file after-the-rain.cues.json
```
