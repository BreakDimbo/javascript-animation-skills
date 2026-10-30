// m-loop audio manifest — the final files copied from team/audio/ (README there): OGG whole-file seamless loops (ambience, theme A),
// 5 footsteps per surface. Only listed files are requested. Paths are relative to game/index.html.
export const AUDIO_BASE = 'audio/files/';
const steps = (k) => [1, 2, 3, 4, 5].map(i => `step_${k}_0${i}.ogg`);
export const AUDIO = {
  amb: { meadow: 'amb_meadow.ogg', station: 'amb_station.ogg', pond: 'amb_pond.ogg', sealbay: 'amb_sealbay.ogg', mill: 'amb_mill.ogg', between: 'amb_meadow.ogg' },
  step: { grass: steps('grass'), sand: steps('sand'), wood: steps('wood') },
  music: 'theme_a_orbit_loop.ogg',
};
