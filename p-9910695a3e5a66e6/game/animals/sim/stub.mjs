const ctx = new Proxy({}, { get: (t, k) => {
  if (k === 'createImageData' || k === 'getImageData') return (w, h) => ({ width: w.width || w, height: h || w.height, data: new Uint8ClampedArray(((w.width || w) * (h || w.height || w)) * 4) });
  if (k === 'createRadialGradient' || k === 'createLinearGradient' || k === 'createPattern') return () => ({ addColorStop(){} });
  if (k === 'measureText') return () => ({ width: 10 });
  if (k in t) return t[k]; return () => {}; }, set: (t, k, v) => { t[k] = v; return true; } });
const el = () => ({ width: 1, height: 1, getContext: () => ctx, style: {}, addEventListener(){}, removeEventListener(){} });
// createElementNS: three's ImageLoader (artkit clayGrain's texture, since b4-mill uses clayMaterial in 4fe5652) — the image never loads offline
globalThis.document = { createElement: el, createElementNS: el };
globalThis.window = globalThis;
