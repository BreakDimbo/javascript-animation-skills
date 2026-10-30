// 海豹湾 Seal Bay — bay outline in local metres (origin = the cat's shore spawn, +x screen-right, +y out over the water,
// i.e. the default camera heading). One wide water body (13.6 × 11 m), a mossy lobe pushing in from the near bank where the
// cat stands, and a bank patch biting in from the far side (seals_f.jpg's top/bottom green patches). JS and GLSL share the maths.
export const BAY = {
  water: [0.2, 2.15, 6.8, 5.55],   // cx, cy, a, b of the main body: x −6.6…7.0, y −3.4…7.7
  near: [0.05, -2.45, 1.4, 2.8],   // the cat's lobe: top at y ≈ 0.35
  far: [-0.85, 5.75, 2.35, 2.3],   // far bank patch: reaches y ≈ 3.45
};
const S = Math.sin;
// wobbly ellipse distance (approx metres): < 0 inside
function ell(x, y, [cx, cy, a, b], k){ const qx = (x - cx) / a, qy = (y - cy) / b, th = Math.atan2(qy, qx);
  const w = 1 + .06 * S(3 * th + k) + .04 * S(5 * th + 2.3 * k) + .025 * S(9 * th + k * 3.1);
  return (Math.hypot(qx, qy) / w - 1) * Math.min(a, b); }
const smax = (a, b, k) => { const h = Math.max(k - Math.abs(a - b), 0) / k; return Math.max(a, b) + h * h * k * 0.25; };
// signed distance to the waterline (m, approx): < 0 water, > 0 bank
export function sdBay(x, y){ return smax(smax(ell(x, y, BAY.water, 1), -ell(x, y, BAY.near, 2), .5), -ell(x, y, BAY.far, 4), .5); }
export const BAY_GLSL = `
float sbEll(vec2 p, vec4 e, float k){ vec2 q = (p - e.xy) / e.zw; float th = atan(q.y, q.x);
  float w = 1. + .06 * sin(3. * th + k) + .04 * sin(5. * th + 2.3 * k) + .025 * sin(9. * th + k * 3.1);
  return (length(q) / w - 1.) * min(e.z, e.w); }
float sbSmax(float a, float b, float k){ float h = max(k - abs(a - b), 0.) / k; return max(a, b) + h * h * k * .25; }
float sdBay(vec2 p){ return sbSmax(sbSmax(sbEll(p, vec4(${BAY.water.join(', ')}), 1.), -sbEll(p, vec4(${BAY.near.join(', ')}), 2.), .5), -sbEll(p, vec4(${BAY.far.join(', ')}), 4.), .5); }
`;
