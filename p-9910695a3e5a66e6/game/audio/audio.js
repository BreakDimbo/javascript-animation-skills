// m-loop: a tiny audio manager. Starts on the first key / tap / click (browser autoplay rule). Per-region ambience loops crossfaded by
// the cat's distance to each region; cat footsteps by surface (grass / sand / wood) paced by its speed; one quiet theme. Fail-safe:
// every load / decode / play is guarded, missing files are simply silent. M toggles sound.
import { R, qs, note } from '../core/util.js';
import { AUDIO, AUDIO_BASE, STEP_TRIM } from './manifest.js';

// m-audio r2 bus gains (offline-measured, team/mvp/audio_mix_r2.md). Files: theme A −18.0 LUFS I (short-term median −18.5), ambiences −24.1…−24.2,
// footsteps trimmed per file (STEP_TRIM). At playback: music I ≈ −17, short-term median ≈ −17.5 (inside −18…−16); ambience ≈ −24.7 → ~7 LU under
// the music; footsteps ≈ 14 LU under the music in loudness, their peaks a few dB under the music's.
const MASTER = 1, MUSIC = 1.12, AMB = .94, BETWEEN = .89, STEP = .34, MUSIC_OUT = 1.4; // MUSIC_OUT: outro fade (s), equal-power (cosine) to 0
// r2b ambience ride: the ambience bus (not footsteps) dips, never rises, so it stays ≥ GAP LU under the music in Theme A's quiet passages.
// Driven by the precomputed loudness envelope (AUDIO.musicEnv) at the music's playback position, with a 1.5 s look-ahead (min over −0.5…+1.5 s);
// at most RIDE_MAX dB; slow one-pole: attack τ .7 s (~1.5 s 10–90 %), release τ .9 s (~2 s). AMB_REF = in-region ambience at playback (files −24.15 LUFS × AMB).
const GAP = 6.5, RIDE_MAX = 6, AMB_REF = -24.15 + 20 * Math.log10(AMB), RIDE_ATT = .7, RIDE_REL = .9;
const hold = (g, t) => { try { if (g.cancelAndHoldAtTime) { g.cancelAndHoldAtTime(t); return; } } catch (e) {} const v = g.value; g.cancelScheduledValues(t); g.setValueAtTime(v, t); }; // freeze a ramp where it is, no jump
const SS = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
export function createAudio({ cat, REG, surfaceAt }){
  let ac = null, master = null, on = !qs.has('mute'), started = false; const amb = {}, steps = {}; let music = null, mOut = 0, ambBus = null, env = null, mPos0 = 0, mT0 = 0, ride = 1, stepAcc = 0, lastSurf = 'grass'; const lastIx = {}, cache = new Map();
  const base = qs.get('audio') || AUDIO_BASE;
  function load(rel){ if (!cache.has(rel)) cache.set(rel, load0(rel)); return cache.get(rel); }
  async function load0(rel){ try { const r = await fetch(base + rel); if (!r.ok) return null; return await ac.decodeAudioData(await r.arrayBuffer()); } catch (e) { note('audio × ' + rel); return null; } }
  function loop(buf, g0 = 0, dest = master){ const g = ac.createGain(); g.gain.value = g0; g.connect(dest); if (buf){ const s = ac.createBufferSource(); s.buffer = buf; s.loop = true; s.connect(g); const off = Math.random() * buf.duration; g.off = off; g.t0 = ac.currentTime; try { s.start(0, off); } catch (e) {} } return g; }
  async function start(){
    if (started) return; started = true;
    try { ac = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return; }
    master = ac.createGain(); master.gain.value = 0; master.connect(ac.destination); ac.resume?.();
    master.gain.setTargetAtTime(on ? MASTER : 0, ac.currentTime, 1.2);
    ambBus = ac.createGain(); ambBus.gain.value = 1; ambBus.connect(master); // ambience bus: the ride lives here
    const jobs = [];
    if (AUDIO.musicEnv) jobs.push(fetch(base + AUDIO.musicEnv).then(r => r.ok ? r.json() : null).then(j => { if (j && Array.isArray(j.S) && j.S.length && j.step > 0) env = j; }).catch(() => {}));
    for (const [k, f] of Object.entries(AUDIO.amb || {})) jobs.push(load(f).then(b => { if (b) amb[k] = loop(b, 0, ambBus); }));
    for (const [k, list] of Object.entries(AUDIO.step || {})) jobs.push(Promise.all(list.map(load)).then(bs => { steps[k] = bs.map((b, i) => b && { b, trim: (STEP_TRIM[k] || [])[i] ?? 1 }).filter(Boolean); }));
    if (AUDIO.music) jobs.push(load(AUDIO.music).then(b => { if (b){ music = loop(b, 0); music.dur = b.duration; music.gain.setTargetAtTime(MUSIC, ac.currentTime + 2, 3); } }));
    await Promise.all(jobs); note(`audio: ${Object.keys(amb).length} ambiences, ${Object.values(steps).reduce((a, b) => a + b.length, 0)} steps${music ? ', theme' : ''}`);
  }
  const kick = () => { start(); if (ac && ac.state === 'suspended') ac.resume(); };
  for (const ev of ['keydown', 'pointerdown', 'touchstart']) addEventListener(ev, kick, { passive: true });
  addEventListener('keydown', (e) => { if (e.code === 'KeyM' && master){ on = !on; master.gain.setTargetAtTime(on ? MASTER : 0, ac.currentTime, .4); } });
  function step(surf){ if (!(steps[surf] && steps[surf].length)) surf = 'grass'; const list = steps[surf]; if (!list || !list.length) return;
    const s = ac.createBufferSource(), g = ac.createGain(); let i = Math.floor(Math.random() * list.length); if (list.length > 1 && i === lastIx[surf]) i = (i + 1 + Math.floor(Math.random() * (list.length - 1))) % list.length; lastIx[surf] = i; // rotation, never the same twice running
    s.buffer = list[i].b; s.playbackRate.value = .97 + Math.random() * .06; // pitch ±3%
    g.gain.value = STEP * list[i].trim * (.89 + Math.random() * .23) * Math.min(1, .5 + cat.speed / 3); /* ±1 dB variation */ s.connect(g); g.connect(master); try { s.start(); } catch (e) {} }
  return {
    get ctx(){ return ac; }, get loaded(){ return { amb: Object.keys(amb), steps: Object.fromEntries(Object.entries(steps).map(([k, v]) => [k, v.length])), music: !!music }; }, get surface(){ return lastSurf; }, get ride(){ return ride; }, start,
    update(dt, { quiet = 0, musicOut = 0 } = {}){
      if (!ac || ac.state !== 'running') return;
      // ambience weights: each region full inside its radius, gone 28 m beyond it; the 'between' bed fills what's left
      let sum = 0; const w = {};
      for (const r of REG){ if (!amb[r.id]) continue; const d = cat.up.angleTo(r.dir) * R; w[r.id] = 1 - SS(r.rad, r.rad + 28, d); sum += w[r.id]; }
      const t = ac.currentTime, k = 1 - quiet;
      // equal-power crossfade: the linear shares p (sum 1) become gains √p, so the summed power of the (uncorrelated) beds stays constant
      for (const id in amb){ const p = id === 'between' ? Math.max(0, 1 - sum) : (w[id] || 0) / Math.max(1, sum); amb[id].gain.setTargetAtTime(Math.sqrt(p) * AMB * (id === 'between' ? BETWEEN : 1) * k, t, 1.4); }
      if (music){ const g = music.gain;
        if (musicOut && !mOut){ // outro: fade with the picture, cosine (equal-power) from the current level to 0 over MUSIC_OUT s
          const v0 = g.value, n = 64, c = new Float32Array(n); for (let i = 0; i < n; i++) c[i] = v0 * Math.cos(i / (n - 1) * Math.PI / 2); c[n - 1] = 0;
          hold(g, t); try { g.setValueCurveAtTime(c, t + .01, MUSIC_OUT); } catch (e) { g.setTargetAtTime(0, t, MUSIC_OUT / 3); } }
        else if (!musicOut){ if (mOut) hold(g, t); g.setTargetAtTime(MUSIC, t, 2); } // back on resume, gently (τ 2 s)
        mOut = musicOut; }
      // ambience ride (r2b): look ahead in the music's loudness envelope; only downward, ≤ RIDE_MAX dB; released when the music is out
      if (ambBus){ let tgt = 1;
        if (env && music && !musicOut){ const pos = (music.off + (t - music.t0)) % (music.dur || env.dur), n = env.S.length; let sMin = Infinity;
          for (let dt2 = -.5; dt2 <= 1.5; dt2 += env.step){ const i = ((Math.floor((pos + dt2) / env.step) % n) + n) % n; sMin = Math.min(sMin, env.S[i]); }
          const dB = Math.max(-RIDE_MAX, Math.min(0, sMin + 20 * Math.log10(MUSIC) - GAP - AMB_REF)); tgt = Math.pow(10, dB / 20); }
        ambBus.gain.setTargetAtTime(tgt, t, tgt < ride ? RIDE_ATT : RIDE_REL); ride += (tgt - ride) * (1 - Math.exp(-dt / (tgt < ride ? RIDE_ATT : RIDE_REL))); }
      // footsteps: about one fall per 0.21 m at a walk, longer strides when running; none in the air or asleep
      if (cat.grounded && cat.speed > .08 && cat.state !== 'sleep' && cat.state !== 'sit'){ stepAcc += cat.speed * dt;
        const L = .21 + Math.min(.25, cat.speed * .05); if (stepAcc > L){ stepAcc = 0; lastSurf = surfaceAt(cat.up); step(lastSurf); } }
      else stepAcc = .15;
    } };
}
