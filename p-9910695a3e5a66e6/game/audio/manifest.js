// m-loop audio manifest — the final files copied from team/audio/ (README there): OGG whole-file seamless loops (ambience, theme A),
// 5 footsteps per surface. Only listed files are requested. Paths are relative to game/index.html.
export const AUDIO_BASE = 'audio/files/';
const steps = (k) => [1, 2, 3, 4, 5].map(i => `step_${k}_0${i}.ogg`);
export const AUDIO = {
  amb: { meadow: 'amb_meadow.ogg', station: 'amb_station.ogg', pond: 'amb_pond.ogg', sealbay: 'amb_sealbay.ogg', mill: 'amb_mill.ogg', between: 'amb_meadow.ogg' },
  step: { grass: steps('grass'), sand: steps('sand'), wood: steps('wood') },
  music: 'theme_a_orbit_loop.ogg',
  musicEnv: 'theme_a_orbit_loop.env.json', // m-audio r2b: precomputed short-term loudness of the loop (0.5 s, centred 3 s) for the ambience ride
};
// m-audio r2: per-file footstep trims (linear), measured offline (team/audio/_work/r2/measure.json, 400 ms momentary max of each file):
// grass −28, sand −28.5, wood −27 LUFS after trim, so no single step jumps out (raw grass ranged −20…−27.5). Boost capped at +3 dB.
export const STEP_TRIM = {
  grass: [0.75, 0.525, 0.398, 0.944, 0.55],
  sand: [0.871, 1.148, 1.122, 1.059, 0.708],
  wood: [1.0, 1.202, 1.23, 1.012, 1.38],
};
