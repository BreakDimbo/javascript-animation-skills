// m-loop: a tiny audio manager. Starts on the first key / tap / click (browser autoplay rule). Per-region ambience loops crossfaded by
// the cat's distance to each region; cat footsteps by surface (grass / sand / wood) paced by its speed; one quiet theme. Fail-safe:
// every load / decode / play is guarded, missing files are simply silent. M toggles sound.
import { R, qs, note } from '../core/util.js';
import { AUDIO, AUDIO_BASE } from './manifest.js';

const MUSIC = .5, AMB = .35; // music is the anchor: theme A (−18 LUFS file) × .5 ≈ −24, ambience (−24.2 LUFS files) × .35 ≈ −33 → ambience ~7 LU under the music (offline mix check, loop_r1.md)
const SS = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
export function createAudio({ cat, REG, surfaceAt }){
  let ac = null, master = null, on = !qs.has('mute'), started = false; const amb = {}, steps = {}; let music = null, stepAcc = 0, lastSurf = 'grass'; const lastIx = {}, cache = new Map();
  const base = qs.get('audio') || AUDIO_BASE;
  function load(rel){ if (!cache.has(rel)) cache.set(rel, load0(rel)); return cache.get(rel); }
  async function load0(rel){ try { const r = await fetch(base + rel); if (!r.ok) return null; return await ac.decodeAudioData(await r.arrayBuffer()); } catch (e) { note('audio × ' + rel); return null; } }
  function loop(buf, g0 = 0){ const g = ac.createGain(); g.gain.value = g0; g.connect(master); if (buf){ const s = ac.createBufferSource(); s.buffer = buf; s.loop = true; s.connect(g); try { s.start(0, Math.random() * buf.duration); } catch (e) {} } return g; }
  async function start(){
    if (started) return; started = true;
    try { ac = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return; }
    master = ac.createGain(); master.gain.value = 0; master.connect(ac.destination); ac.resume?.();
    master.gain.setTargetAtTime(on ? .9 : 0, ac.currentTime, 1.2);
    const jobs = [];
    for (const [k, f] of Object.entries(AUDIO.amb || {})) jobs.push(load(f).then(b => { if (b) amb[k] = loop(b, 0); }));
    for (const [k, list] of Object.entries(AUDIO.step || {})) jobs.push(Promise.all(list.map(load)).then(bs => { steps[k] = bs.filter(Boolean); }));
    if (AUDIO.music) jobs.push(load(AUDIO.music).then(b => { if (b){ music = loop(b, 0); music.gain.setTargetAtTime(MUSIC, ac.currentTime + 2, 3); } }));
    await Promise.all(jobs); note(`audio: ${Object.keys(amb).length} ambiences, ${Object.values(steps).reduce((a, b) => a + b.length, 0)} steps${music ? ', theme' : ''}`);
  }
  const kick = () => { start(); if (ac && ac.state === 'suspended') ac.resume(); };
  for (const ev of ['keydown', 'pointerdown', 'touchstart']) addEventListener(ev, kick, { passive: true });
  addEventListener('keydown', (e) => { if (e.code === 'KeyM' && master){ on = !on; master.gain.setTargetAtTime(on ? .9 : 0, ac.currentTime, .4); } });
  function step(surf){ if (!(steps[surf] && steps[surf].length)) surf = 'grass'; const list = steps[surf]; if (!list || !list.length) return;
    const s = ac.createBufferSource(), g = ac.createGain(); let i = Math.floor(Math.random() * list.length); if (list.length > 1 && i === lastIx[surf]) i = (i + 1 + Math.floor(Math.random() * (list.length - 1))) % list.length; lastIx[surf] = i; // rotation, never the same twice running
    s.buffer = list[i]; s.playbackRate.value = .97 + Math.random() * .06; // pitch ±3%
    g.gain.value = (.26 + Math.random() * .08) * Math.min(1, .5 + cat.speed / 3); s.connect(g); g.connect(master); try { s.start(); } catch (e) {} }
  return {
    get ctx(){ return ac; }, get loaded(){ return { amb: Object.keys(amb), steps: Object.fromEntries(Object.entries(steps).map(([k, v]) => [k, v.length])), music: !!music }; }, get surface(){ return lastSurf; }, start,
    update(dt, { quiet = 0, musicOut = 0 } = {}){
      if (!ac || ac.state !== 'running') return;
      // ambience weights: each region full inside its radius, gone 28 m beyond it; the 'between' bed fills what's left
      let sum = 0; const w = {};
      for (const r of REG){ if (!amb[r.id]) continue; const d = cat.up.angleTo(r.dir) * R; w[r.id] = 1 - SS(r.rad, r.rad + 28, d); sum += w[r.id]; }
      const t = ac.currentTime, k = 1 - quiet;
      for (const id in amb){ const g = id === 'between' ? Math.max(0, 1 - sum) : (w[id] || 0) / Math.max(1, sum); amb[id].gain.setTargetAtTime(g * AMB * (id === 'between' ? .55 : 1) * k, t, 1.4); }
      if (music) music.gain.setTargetAtTime(MUSIC * (1 - musicOut), t, musicOut ? 1.6 : 2);
      // footsteps: about one fall per 0.21 m at a walk, longer strides when running; none in the air or asleep
      if (cat.grounded && cat.speed > .08 && cat.state !== 'sleep' && cat.state !== 'sit'){ stepAcc += cat.speed * dt;
        const L = .21 + Math.min(.25, cat.speed * .05); if (stepAcc > L){ stepAcc = 0; lastSurf = surfaceAt(cat.up); step(lastSurf); } }
      else stepAcc = .15;
    } };
}
