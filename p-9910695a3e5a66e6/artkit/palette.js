// 褶星 Fold art kit — unified palette, taken from the designer's replica (sheep-grazing layout.js colours + sprites).
// Every module should pull colours from here instead of inventing its own greens.
export const PAL = {
  // fields (layout.js colors)
  light: '#a9c74b', bright: '#83bc3a', dark: '#86ab4c', lime: '#70ac37', wheat: '#cdb651',
  hedge: '#437e28', hedgeShade: '#2f5f1c', hedgeLit: '#5f9a3a',
  path: '#e3c993', pathEdge: '#c8b478', bank: '#d0c57b',
  waterDeep: '#30619e', waterMid: '#4f84bb', waterEdge: '#6fa1c9', waterFoam: '#d9e6e4',
  paper: '#ece5d8', paperShade: '#e4dccb', ink: '#3a3128',
  flowerY: '#f2c84a', flowerO: '#ef9a3c', flowerW: '#fbf3df',
  // clay objects (sprite atlas tones)
  wool: '#f4ece0', woolShade: '#e3d2c4', sheepFace: '#2a1e1c',
  treeLit: '#8cc63f', tree: '#5ea232', treeShade: '#3c7a24', treePink: '#e59ac4',
  plaster: '#efe3cc', plasterShade: '#d9c6a6', roof: '#c0785a', roofShade: '#94553d', wood: '#8a6446', stone: '#b9b2a3', stoneDk: '#8f897d',
  // the cat (old orange shorthair)
  catOrange: '#d98a3e', catStripe: '#a65a26', catCream: '#f3e7d2', catPink: '#d99a8e', catEye: '#c98f2a', catInk: '#2b221b',
};
// sRGB hex -> [r,g,b] bytes
export const rgb = (h) => { const n = parseInt(h.slice(1), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; };
export const rgba = (h, a) => { const [r, g, b] = rgb(h); return `rgba(${r},${g},${b},${a})`; };

// Remap an arbitrary module colour (sRGB hex number) to the nearest palette family, keeping a little of its own value.
// Used by reskin() so every module's ad-hoc greens/olives land on the replica's colours.
const FAMILY = ['light', 'bright', 'dark', 'wheat', 'hedge', 'path', 'bank', 'wool', 'plaster', 'plasterShade', 'roof', 'wood', 'stone', 'stoneDk', 'tree', 'treeShade',
  'catOrange', 'catStripe', 'catCream', 'sheepFace', 'waterMid', 'ink'];
function lab([r, g, b]){ const f = c => { c /= 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
  const R = f(r), G = f(g), B = f(b); let x = (R * .4124 + G * .3576 + B * .1805) / .95047, y = R * .2126 + G * .7152 + B * .0722, z = (R * .0193 + G * .1192 + B * .9505) / 1.08883;
  const h = t => t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116; x = h(x); y = h(y); z = h(z); return [116 * y - 16, 500 * (x - y), 200 * (y - z)]; }
const FAM = FAMILY.map(k => ({ k, c: rgb(PAL[k]), L: lab(rgb(PAL[k])) }));
export function nearestPal(hexNum){
  const c = [hexNum >> 16 & 255, hexNum >> 8 & 255, hexNum & 255], L = lab(c);
  let best = FAM[0], bd = 1e9; for (const f of FAM){ const d = (f.L[0] - L[0]) ** 2 * 0.5 + (f.L[1] - L[1]) ** 2 + (f.L[2] - L[2]) ** 2; if (d < bd){ bd = d; best = f; } }
  return { key: best.k, hex: PAL[best.k], dist: Math.sqrt(bd) };
}
