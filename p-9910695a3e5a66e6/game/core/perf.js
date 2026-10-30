// m-perf: engine-level performance helpers. Nothing here changes what a pixel looks like.
//  1. board culling — at the home framing every built-in material discards fragments outside the ragged board (artkit/bend.js,
//     foldBoardSD on the UNBENT world position, colour and shadow-depth pass alike). A mesh whose whole bounding sphere lies beyond
//     board + margin can only produce discarded fragments, so it is skipped for that render (visible=false inside
//     scene.onBeforeRender, restored in scene.onAfterRender — game code never sees the flag change). The far ground sphere is
//     skipped while the whole board sits inside the follow grid's hole (its board fragments are all discarded there).
//     Only meshes whose materials (and shadow-depth material) carry the board uniforms (bendHooked) and are not ShaderMaterials are
//     touched; planet / ?close / ?noboard views (margin 0) cull nothing extra. ?nocull disables it.
//  2. far-region update pause — a region whose content is well outside the board and the watercolour fade skips update();
//     planet view never pauses; the station (train timetable) never pauses. ?nopause disables it.
//  3. stats — window.__fold.perf() → { fps, ms, p99ms, calls, triangles, ... }; ?perf shows a small overlay (hidden by default).
import * as THREE from '../../shared/vendor/three.module.js';
import { R, qs, MOBILE } from './util.js';
import { BOARDU } from '../../artkit/bend.js';

let CULL = !qs.has('nocull'), PAUSE = !qs.has('nopause');
// metres of region content around its centre (scaled modules: pond 23 m × PS, mill 115 m × MS; flock lives inside the home board)
const REACH = { meadow: 24, pond: 8, mill: 16, sealbay: 30 }, VIEW = 46; // VIEW: board half-diagonal (≈5.7 m) + fade (38 m) + slack
const _c = new THREE.Vector3(), _s = new THREE.Sphere(), _d = new THREE.Vector3();

export function createPerf({ renderer, scene, camera, ground, fcam, cat }){
  const F = BOARDU.F.value, X = BOARDU.X.value, Y = BOARDU.Y.value;
  let list = [], listN = -1, hidden = [], frameNo = 0, farHidden = false, culled = 0;
  const effVis = (o) => { for (let p = o; p; p = p.parent){ if (!p.visible) return false; if (p === scene) return true; } return false; };
  const okMat = (m) => m && !m.isShaderMaterial && !m.isRawShaderMaterial && m.userData.bendHooked === true;
  function candidates(){
    list = []; scene.traverse(o => {
      if (!(o.isMesh || o.isPoints || o.isLine) || o.frustumCulled === false || o.isSkinnedMesh || o === ground?.far || o === ground?.grid) return;
      const ms = Array.isArray(o.material) ? o.material : [o.material]; if (!ms.every(okMat)) return;
      if (o.castShadow && !(o.customDepthMaterial ? okMat(o.customDepthMaterial) : false)) return;
      if (!o.geometry || o.geometry.morphAttributes?.position || o.isBatchedMesh) return; list.push(o); });
  }
  // phones: the cat's 2048² paint (opaque PNG, ~22 MB with mips) is drawn ~50–70 device px tall, i.e. sampled at mip ≥ 3, so a 1024²
  // copy gives the same picture for a quarter of the memory. Also the swapped-in eyes-closed map. ?fulltex keeps it.
  const CAP = MOBILE && !qs.has('fulltex') ? 1024 : 0;
  function capCatTex(){ if (!CAP || !cat?.root) return; cat.root.traverse(o => { const ms = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : [];
    for (const m of ms){ const t = m.map; if (!t || t.userData.mPerfCap || t.isCanvasTexture || t.isDataTexture) continue; const im = t.image; if (!im || !(im.width > CAP)) continue;
      if (m.transparent || m.alphaTest > 0 || m.alphaMap) continue;
      const k = CAP / Math.max(im.width, im.height), c = document.createElement('canvas'); c.width = Math.round(im.width * k); c.height = Math.round(im.height * k);
      const g = c.getContext('2d'); g.imageSmoothingQuality = 'high'; g.drawImage(im, 0, 0, c.width, c.height); t.image = c; t.userData.mPerfCap = 1; t.needsUpdate = true; } }); }
  // signed distance (m) of the board rectangle at direction d — same maths as foldBoardSD
  const boardSD = (d) => { if (d.x * F.x + d.y * F.y + d.z * F.z < 0.9) return 1e3; const fx = F.x * X.x + F.y * X.y + F.z * X.z, fy = F.x * Y.x + F.y * Y.y + F.z * Y.z; // xyz only (w = margin / half size)
    const qx = Math.abs(d.dot(X) * R - fx * R) - X.w, qy = Math.abs(d.dot(Y) * R - fy * R) - Y.w;
    return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0); };
  const prevB = scene.onBeforeRender, prevA = scene.onAfterRender;
  scene.onBeforeRender = function (...a){ prevB.apply(this, a); try { cullPass(); } catch (e){ restore(); CULL = false; console.warn('perf cull off:', e); } };
  function cullPass(){
    restore(); culled = 0; if ((frameNo++ % 30) === 0) capCatTex(); const margin = F.w; if (!CULL || margin <= 0) return;
    if ((frameNo % 30) === 1 || listN !== scene.children.length){ candidates(); listN = scene.children.length; }
    for (const o of list){
      if (!effVis(o)) continue; const g = o.geometry, pa = g.attributes.position; if (!pa) continue;
      // CPU-animated geometry / instances: refresh the bounds whenever their data changed (three's own culling assumes static bounds)
      if (!g.boundingSphere || g.userData._pv !== pa.version){ g.computeBoundingSphere(); g.userData._pv = pa.version; }
      if (o.isInstancedMesh){ if (!o.boundingSphere || o.userData._iv !== o.instanceMatrix.version || o.userData._ic !== o.count){ o.computeBoundingSphere(); o.userData._iv = o.instanceMatrix.version; o.userData._ic = o.count; }
        _s.copy(o.boundingSphere).applyMatrix4(o.matrixWorld); } else _s.copy(g.boundingSphere).applyMatrix4(o.matrixWorld);
      if (!(_s.radius >= 0) || _s.radius > 40) continue; const len = _s.center.length(); if (len < R * .9) continue;
      const sd = boardSD(_d.copy(_s.center).divideScalar(len)), rEff = _s.radius * (R / (len - _s.radius)) * 1.02 + 0.06; // 0.06 m: slack for small shader sway
      if (sd - rEff > margin){ o.visible = false; hidden.push(o); }
    }
    culled = hidden.length;
    // the far sphere: discarded inside the grid hole; if the whole board is in the hole the sphere draws nothing
    const far = ground?.far, grid = ground?.grid;
    if (far && far.visible && grid?.geometry.boundingSphere){ const n = grid.geometry.attributes.position.count, GN = Math.round(Math.sqrt(n)) - 1, hole = (GN / 2 - 2) * 0.5;
      _c.copy(grid.geometry.boundingSphere.center).applyMatrix4(grid.matrixWorld).normalize(); _d.set(F.x, F.y, F.z);
      const diag = Math.hypot(X.w + margin, Y.w + margin); if (_d.angleTo(_c) * R + diag + 3 < hole){ far.visible = false; farHidden = true; culled++; } }
  }
  function restore(){ for (const o of hidden) o.visible = true; hidden.length = 0; if (farHidden){ ground.far.visible = true; farHidden = false; } }
  scene.onAfterRender = function (...a){ restore(); prevA.apply(this, a); };

  // ---- far-region update pause ----
  const shouldUpdate = (r, catUp) => { if (!PAUSE || fcam.board.planet > 0.01 || !(r.id in REACH)) return true; return catUp.angleTo(r.dir) * R < REACH[r.id] + VIEW; };

  // ---- stats ----
  const dts = new Float32Array(120); let di = 0, lastT = 0, fpsE = 0, paused = 0; const last = { calls: 0, triangles: 0, n: 0 };
  const info = renderer.info;
  function tick(){ const t = performance.now(); if (lastT){ const dt = t - lastT; dts[di++ % dts.length] = dt; fpsE = fpsE ? fpsE * .95 + (1000 / dt) * .05 : 1000 / dt; } lastT = t; }
  const texBytes = () => { const seen = new Set(); let b = 0; scene.traverse(o => { const ms = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : [];
      for (const m of ms) for (const k in m){ const t = m[k]; if (t && t.isTexture) seen.add(t); } const u = ms.flatMap(m => Object.values(m.uniforms || {})); for (const x of u) if (x?.value?.isTexture) seen.add(x.value); });
    for (const t of seen){ const im = t.image; const w = im?.width || im?.videoWidth || 0, h = im?.height || 0, bpp = t.format === THREE.RedFormat ? 1 : t.format === THREE.RGFormat ? 2 : 4;
      b += w * h * bpp * (t.generateMipmaps !== false && t.minFilter !== THREE.LinearFilter && t.minFilter !== THREE.NearestFilter ? 4 / 3 : 1); }
    return { count: seen.size, MB: +(b / 1048576).toFixed(1) }; };
  function snapshot(full = false){
    const n = Math.min(di, dts.length), a = Array.from(dts.subarray(0, n)).sort((x, y) => x - y), sh = renderer.shadowMap, sun = scene.children.find(o => o.isDirectionalLight);
    const s = { fps: +fpsE.toFixed(1), ms: n ? +(a.reduce((x, y) => x + y, 0) / n).toFixed(2) : 0, p99ms: n ? +a[Math.floor(n * .99)].toFixed(1) : 0,
      calls: last.n ? last.calls : info.render.calls, triangles: last.n ? last.triangles : info.render.triangles, points: info.render.points, lines: info.render.lines,
      geometries: info.memory.geometries, textures: info.memory.textures, programs: info.programs?.length ?? 0,
      dpr: renderer.getPixelRatio(), canvas: [renderer.domElement.width, renderer.domElement.height], shadowMap: sun?.shadow?.mapSize.x ?? 0, shadowAuto: sh.autoUpdate,
      culled, pausedRegions: paused, cull: CULL, pause: PAUSE };
    if (full) s.texMemory = texBytes(); return s; }
  // overlay (?perf): fps · ms · draw calls · triangles; hidden unless asked for
  let el = null; if (qs.has('perf')){ el = document.createElement('div'); el.id = 'perfHud';
    el.style.cssText = 'position:fixed;left:6px;top:6px;z-index:99;font:11px/1.35 ui-monospace,Menlo,monospace;color:#2b261f;background:rgba(239,232,216,.82);padding:4px 6px;pointer-events:none;white-space:pre';
    document.body.appendChild(el); }
  let hudT = 0;
  const wrapRender = () => { const r0 = renderer.render.bind(renderer);
    renderer.render = (a, b) => { r0(a, b); if (a === scene){ last.calls = info.render.calls; last.triangles = info.render.triangles; last.n++; tick();
      if (el && performance.now() - hudT > 500){ hudT = performance.now(); const s = snapshot(); el.textContent = `${s.fps.toFixed(0)} fps  ${s.ms.toFixed(1)} ms  p99 ${s.p99ms} ms\n${s.calls} draws  ${(s.triangles / 1000).toFixed(0)}k tris  culled ${s.culled}\ndpr ${s.dpr}  ${s.canvas.join('×')}  tex ${s.textures}  geo ${s.geometries}`; } } }; };
  wrapRender();
  return { shouldUpdate, snapshot, setPaused(n){ paused = n; }, candidates: () => list.length, set({ cull = CULL, pause = PAUSE } = {}){ CULL = cull; PAUSE = pause; } };
}
