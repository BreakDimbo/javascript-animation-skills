// 褶星 Fold — ambient soundscape. Region beds crossfaded by great-circle distance on the planet, cat footsteps by
// surface, a soft purr when sleeping. Recordings reused from the sheep scene (Wikimedia Commons, PD / CC BY-SA, see
// /workspace/sheep/site/docs/sound.md); everything else is generated WebAudio. Restrained: no stingers, gentle compressor.
//
//   const sc = createSoundscape(listener)  // listener: THREE.AudioListener, an AudioContext, or nothing
//   await sc.start()                        // call from a user gesture
//   sc.update(dt, { pos, speed, surface, sleeping, night })   // pos: {x,y,z} metres, planet-centred
//   sc.step(surface)                        // one footfall (called automatically from speed if autoSteps)
export const SND_BASE = new URL('./snd/', import.meta.url).href;
export const R = 600;
// region centres as directions on the sphere (merge: replace with the real region anchors)
export const REGIONS = {
  meadow: { dir: norm([0.0, 1, 0.15]), radius: 120 },
  pond:   { dir: norm([0.55, 0.8, -0.25]), radius: 90 },
  mill:   { dir: norm([-0.5, 0.82, -0.3]), radius: 90 },
};
function norm(v){ const l = Math.hypot(...v); return v.map(x => x / l); }
const rnd = (a, b) => a + (b - a) * Math.random(), ss = (x, a, b) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

export function createSoundscape(listener){
  let ctx = null, out = null, master, ready = false, buf = {};
  const beds = {}, w = { meadow: 0, pond: 0, mill: 0 };
  let nextBleat = 6, nextLark = 3, nextDuck = 5, nextCreak = 2, stepPhase = 0, t = 0, purr = null, windG = [], gust = 0;

  function noiseBuf(sec, pink){ const n = ctx.sampleRate * sec | 0, b = ctx.createBuffer(1, n, ctx.sampleRate), d = b.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0;
    for (let i = 0; i < n; i++){ const x = Math.random() * 2 - 1;
      if (pink){ b0 = .99765 * b0 + x * .099046; b1 = .963 * b1 + x * .2965164; b2 = .57 * b2 + x * 1.0526913; d[i] = (b0 + b1 + b2 + x * .1848) * .18; } else d[i] = x; }
    const f = ctx.sampleRate * .2 | 0;  // seamless loop
    for (let i = 0; i < f; i++){ const k = i / f; d[i] = d[i] * Math.sin(k * Math.PI / 2) + d[n - f + i] * Math.cos(k * Math.PI / 2); }
    const o = ctx.createBuffer(1, n - f, ctx.sampleRate); o.copyToChannel(d.subarray(0, n - f), 0); return o; }
  const G = v => { const g = ctx.createGain(); g.gain.value = v; return g; };
  const F = (type, f, q = .7) => { const n = ctx.createBiquadFilter(); n.type = type; n.frequency.value = f; n.Q.value = q; return n; };
  const P = p => { const n = ctx.createStereoPanner(); n.pan.value = p; return n; };
  const S = (b, loop) => { const s = ctx.createBufferSource(); s.buffer = b; s.loop = !!loop; return s; };
  function chain(...n){ for (let i = 0; i < n.length - 1; i++) n[i].connect(n[i + 1]); return n[n.length - 1]; }
  function play(b, { gain = .4, pan = 0, rate = 1, offset = 0, dur, fade = 0, to } = {}){
    const s = S(b), g = G(0), now = ctx.currentTime; s.playbackRate.value = rate; chain(s, g, P(pan), to || master);
    if (fade){ g.gain.setValueAtTime(0, now); g.gain.linearRampToValueAtTime(gain, now + fade); g.gain.setValueAtTime(gain, now + dur - fade); g.gain.linearRampToValueAtTime(0, now + dur); s.start(now, offset, dur); }
    else { g.gain.value = gain; s.start(now, offset); } }

  async function start(){
    if (ready) return;
    ctx = listener?.context || (listener instanceof AudioContext ? listener : new AudioContext());
    out = listener?.getInput ? listener.getInput() : ctx.destination;
    if (ctx.state === 'suspended') await ctx.resume();
    const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -16; comp.ratio.value = 3;
    master = G(0); chain(master, comp, out); master.gain.setTargetAtTime(.9, ctx.currentTime, 1.5);
    for (const k of Object.keys(w)) { beds[k] = G(0); beds[k].connect(master); }
    const pink = noiseBuf(7, true), white = noiseBuf(3, false);
    // wind: shared base (always a little) + region tint: meadow airy, mill fuller/lower
    for (const side of [-1, 1]){ const s = S(pink, true), lp = F('lowpass', 500, .5), g = G(0); s.playbackRate.value = side > 0 ? 1.03 : .97;
      chain(s, lp, g, P(side * .6), master); s.start(0, side > 0 ? 3.1 : 0); windG.push({ g, lp }); }
    // pond: water lap — band-passed noise with slow amplitude swell (two LFO-ish voices)
    for (const [f, p, r] of [[420, -.4, .17], [650, .45, .23]]){ const s = S(white, true), bp = F('bandpass', f, 1.4), lp = F('lowpass', 1200, .5), g = G(.0), o = ctx.createOscillator(), og = G(.06);
      o.frequency.value = r; chain(o, og, g.gain); g.gain.value = .07; chain(s, bp, lp, g, P(p), beds.pond); s.start(); o.start(); }
    // mill: low rumble of the sails' wind
    { const s = S(pink, true), lp = F('lowpass', 180, .6), g = G(.5); chain(s, lp, g, beds.mill); s.start(0, 2); }
    // purr: 25 Hz pulsed low noise
    { const s = S(pink, true), lp = F('lowpass', 260, .8), g = G(0), am = G(0), o = ctx.createOscillator(), og = G(.5), dc = ctx.createConstantSource();
      o.frequency.value = 24; dc.offset.value = .5; chain(o, og, am.gain); dc.connect(am.gain); chain(s, lp, am, g, master); s.start(); o.start(); dc.start(); purr = { g, o }; }
    // recordings from the sheep scene (fail soft if missing)
    await Promise.all(['bleat1', 'bleat2', 'bleat3', 'bleat4', 'lamb1', 'lark', 'crickets'].map(f =>
      fetch(SND_BASE + f + '.mp3').then(r => r.arrayBuffer()).then(a => ctx.decodeAudioData(a)).then(b => { buf[f] = b; }).catch(e => console.warn('snd', f, e))));
    if (buf.crickets){ const s = S(buf.crickets, true), g = G(0); chain(s, g, beds.meadow); s.start(); beds.cricketG = g; }
    ready = true;
  }

  // synthesized one-shots
  function duck(pan){ const n = rnd(2, 4) | 0; for (let i = 0; i < n; i++){ const t0 = ctx.currentTime + i * rnd(.16, .24);
      const o = ctx.createOscillator(), bp = F('bandpass', rnd(900, 1100), 4), g = G(0); o.type = 'sawtooth'; o.frequency.setValueAtTime(rnd(300, 340), t0); o.frequency.linearRampToValueAtTime(rnd(230, 260), t0 + .12);
      g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(.05, t0 + .015); g.gain.exponentialRampToValueAtTime(.001, t0 + .14);
      chain(o, bp, g, P(pan), beds.pond); o.start(t0); o.stop(t0 + .16); } }
  function creak(pan){ const t0 = ctx.currentTime, d = rnd(.6, 1.3), o = ctx.createOscillator(), lfo = ctx.createOscillator(), lg = G(rnd(20, 40)), bp = F('bandpass', rnd(500, 750), 6), g = G(0);
    o.type = 'sawtooth'; o.frequency.value = rnd(55, 80); lfo.frequency.value = rnd(4, 9); chain(lfo, lg, o.frequency);
    g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(.05, t0 + d * .3); g.gain.linearRampToValueAtTime(0, t0 + d);
    chain(o, bp, g, P(pan), beds.mill); o.start(t0); lfo.start(t0); o.stop(t0 + d); lfo.stop(t0 + d); }
  const SURF = { grass: { f: 2200, q: .6, lp: 3500, d: .09, g: .07 }, stone: { f: 1800, q: 2.5, lp: 6000, d: .035, g: .06 }, wood: { f: 380, q: 3, lp: 1500, d: .06, g: .09 } };
  function step(surface = 'grass', k = 1){ if (!ready) return; const s = SURF[surface] || SURF.grass, t0 = ctx.currentTime, n = ctx.sampleRate * s.d | 0, b = ctx.createBuffer(1, n, ctx.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < n; i++){ const e = Math.exp(-i / n * 5); d[i] = (Math.random() * 2 - 1) * e * (surface === 'grass' && Math.random() < .3 ? 1.6 : 1); }
    const src = S(b), bp = F('bandpass', s.f * rnd(.85, 1.15), s.q), lp = F('lowpass', s.lp), g = G(s.g * k * rnd(.7, 1)); chain(src, bp, lp, g, P(rnd(-.08, .08)), master); src.start(t0); }

  function weights(pos){ const l = Math.hypot(pos.x, pos.y, pos.z) || 1, u = [pos.x / l, pos.y / l, pos.z / l], r = {};
    for (const [k, reg] of Object.entries(REGIONS)){ const c = Math.min(1, Math.max(-1, u[0] * reg.dir[0] + u[1] * reg.dir[1] + u[2] * reg.dir[2])), dist = Math.acos(c) * R;
      r[k] = 1 - ss(dist, reg.radius * .5, reg.radius * 1.4); }
    return r; }

  function update(dt, { pos, speed = 0, surface = 'grass', sleeping = false, night = 0, autoSteps = true } = {}){
    if (!ready) return; t += dt; const now = ctx.currentTime, W = weights(pos);
    for (const k of Object.keys(w)){ w[k] = W[k]; beds[k].gain.setTargetAtTime(w[k] * (sleeping ? .55 : 1), now, 1.2); }
    gust += (Math.sin(t * .13) * .5 + Math.sin(t * .37 + 1) * .3 + .5 - gust) * Math.min(1, dt * .5);
    const wk = .12 + .1 * w.meadow + .18 * w.mill;
    for (const [i, x] of windG.entries()){ x.g.gain.setTargetAtTime(wk * (.6 + .5 * gust) * (sleeping ? .6 : 1), now, .5); x.lp.frequency.setTargetAtTime(300 + 700 * gust + (i ? 60 : 0), now, .5); }
    if (beds.cricketG) beds.cricketG.gain.setTargetAtTime(.2 * ss(night, .25, .8), now, .8);
    if ((nextBleat -= dt) < 0){ nextBleat = rnd(9, 26); if (w.meadow > .15){ const b = buf[['bleat1', 'bleat2', 'bleat3', 'bleat4', 'lamb1'][Math.random() * 5 | 0]]; if (b) play(b, { gain: .3 * rnd(.5, 1), pan: rnd(-.7, .7), rate: rnd(.92, 1.06), to: beds.meadow }); } }
    if ((nextLark -= dt) < 0){ nextLark = rnd(16, 40); if (w.meadow > .2 && night < .4 && buf.lark){ const d = rnd(6, 12); play(buf.lark, { gain: .13, pan: rnd(-.6, .6), offset: rnd(0, buf.lark.duration - d - .1), dur: d, fade: 1.2, to: beds.meadow }); } }
    if ((nextDuck -= dt) < 0){ nextDuck = rnd(5, 16); if (w.pond > .15) duck(rnd(-.6, .6)); }
    if ((nextCreak -= dt) < 0){ nextCreak = rnd(2.5, 6) / (.6 + gust); if (w.mill > .15) creak(rnd(-.3, .3)); }
    purr.g.gain.setTargetAtTime(sleeping ? .22 : 0, now, sleeping ? 2 : .4); purr.o.frequency.setTargetAtTime(23 + 3 * Math.sin(t * .4), now, .5);
    if (autoSteps && speed > .05 && !sleeping){ stepPhase += dt * Math.min(6, 2.2 * speed + 1); if (stepPhase >= 1){ stepPhase -= 1; step(surface, Math.min(1.2, .5 + speed * .3)); } }
  }
  function setMuted(m){ if (master) master.gain.setTargetAtTime(m ? 0 : .9, ctx.currentTime, .3); }
  return { start, update, step, setMuted, weights, get ready(){ return ready; }, get ctx(){ return ctx; }, mix: w };
}
