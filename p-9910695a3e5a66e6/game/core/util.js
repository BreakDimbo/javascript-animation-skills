// shared page-level helpers: query string, platform flags, boot log and the safe() wrapper
export const qs = new URLSearchParams(location.search);
export const MOBILE = Math.min(innerWidth, innerHeight) < 600 || qs.has('mobile');
export const DEBUG = qs.has('debug');
export const R = 600;
const T0 = performance.now(), log = [];
export const bootLog = log;
export const note = (s) => {
  s += ` @${((performance.now() - T0) / 1000).toFixed(1)}s`; console.log(s); log.push(s);
  if (DEBUG) document.getElementById('mods').textContent = log.join('\n');
};
export const safe = (k, fn, fb = null) => { try { return fn(); } catch (e) { console.warn(k, e); note(k + ' × ' + e.message); return fb; } };
