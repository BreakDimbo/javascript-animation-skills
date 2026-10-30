// 褶星 Fold — the one size reference for every region (review-vd-station-r2 §1): the hero cat's standing height to the
// ear tips, Hc, in world metres. Regions size their props in Hc only (never in body length — cat_a7 is a short-bodied,
// big-headed design, its length is style, not size). Live binding: read CAT_HC, or subscribe with onCatHc(fn).
// Measured once from the model the game actually shows (the glb once loaded, else the primitive), in the bind pose,
// including the root scale. Until then (or if nothing ever loads) the fallback is the r2 calibration cat (cat.glb × 1.25).
import * as THREE from '../shared/vendor/three.module.js';

export const CAT_HC_FALLBACK = 0.281;
export let CAT_HC = CAT_HC_FALLBACK;
export let CAT_HC_SRC = 'fallback';
const subs = new Set();
export function onCatHc(fn){ subs.add(fn); fn(CAT_HC, CAT_HC_SRC); return () => subs.delete(fn); }
export function setCatHc(h, src = 'set'){
  if (!(h > .05 && h < 5)) return CAT_HC; if (Math.abs(h - CAT_HC) < 1e-4 && src === CAT_HC_SRC) return CAT_HC;
  CAT_HC = h; CAT_HC_SRC = src; for (const f of subs) f(CAT_HC, CAT_HC_SRC); return CAT_HC; }

// height (paw bottom → ear tip) of a model in the frame of `ref` (default: the model itself), × ref's world scale; skinned meshes in their current pose
const _v = new THREE.Vector3(), _m = new THREE.Matrix4(), _i = new THREE.Matrix4();
export function measureHeight(obj, ref = obj){
  ref.updateMatrixWorld(true); _i.copy(ref.matrixWorld).invert(); let lo = 1e9, hi = -1e9;
  obj.traverse((m) => { if (!m.isMesh || [].concat(m.material).some((x) => x?.transparent) || /eye|pupil|blob|shadow/i.test(m.name)) return;
    for (let p = m; p && p !== ref.parent; p = p.parent) if (p.visible === false) return;
    const a = m.geometry.attributes.position; _m.multiplyMatrices(_i, m.matrixWorld);
    for (let k = 0; k < a.count; k += 2){ _v.fromBufferAttribute(a, k); if (m.isSkinnedMesh) m.applyBoneTransform(k, _v); _v.applyMatrix4(_m); if (_v.y < lo) lo = _v.y; if (_v.y > hi) hi = _v.y; } });
  if (!(hi > lo)) return null; const sc = new THREE.Vector3(); ref.getWorldScale(sc); return (hi - lo) * sc.y; }

// the artkit cat ({root, body, glb?: {m, act}}): standing = its idle clip at t = 0, sampled on a scratch mixer with every
// node transform saved and restored, so the game's own animation is untouched. Without clips: the model as it is now.
export function measureCatHc(cat){
  if (!cat || !cat.root) return null; const g = cat.glb && cat.glb.m;
  if (!g) return measureHeight(cat.body, cat.root);
  const acts = Object.values(cat.glb.act || {}), clips = acts.map((a) => a.getClip && a.getClip()).filter(Boolean);
  const clip = clips.find((c) => /idle|stand/i.test(c.name)) || clips.find((c) => /walk/i.test(c.name));
  if (!clip) return measureHeight(g, cat.root);
  const saved = []; g.traverse((o) => saved.push([o, o.position.clone(), o.quaternion.clone(), o.scale.clone()]));
  const mx = new THREE.AnimationMixer(g), a = mx.clipAction(clip); a.play(); mx.update(0);
  const h = measureHeight(g, cat.root);
  a.stop(); mx.uncacheRoot(g); for (const [o, p, q, s] of saved){ o.position.copy(p); o.quaternion.copy(q); o.scale.copy(s); } g.updateMatrixWorld(true);
  return h; }

// call every frame until it returns true (one property check per frame until then). Measures the glb as soon as it is in;
// the primitive cat only when it is the chosen model (?primcat) — while the glb is still loading the primitive stands in at a
// different size, and the fallback is the better number.
let done = false;
export function observeCat(cat){
  if (done) return true; if (!cat || !cat.root) return false;
  if (CAT_HC_SRC === 'glb'){ done = true; return true; }   // integration 17:00: artkit/cat.js already set it on glb load, the one call
  const glb = !!(cat.glb && cat.glb.m), prim = !glb && typeof location !== 'undefined' && /[?&]primcat/.test(location.search);
  if (!glb && !prim) return false;
  const h = measureCatHc(cat); done = true; if (h) setCatHc(h, glb ? 'glb' : 'primitive'); return true; }
