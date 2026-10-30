# r2 qa: screen height (px) and L*/ΔE contrast of each animal against the ground within 2 Lc, from a shot + the run's "BB {...}" box line.
# usage: python3 contrast_life.py shot.png '<json of BB>'
import sys, json, numpy as np
from PIL import Image
def lab(rgb):
    c = rgb / 255.0; c = np.where(c > .04045, ((c + .055) / 1.055) ** 2.4, c / 12.92)
    M = np.array([[.4124, .3576, .1805], [.2126, .7152, .0722], [.0193, .1192, .9505]]); xyz = c @ M.T / np.array([.95047, 1., 1.08883])
    f = np.where(xyz > .008856, np.cbrt(xyz), 7.787 * xyz + 16 / 116)
    return np.stack([116 * f[..., 1] - 16, 500 * (f[..., 0] - f[..., 1]), 200 * (f[..., 1] - f[..., 2])], -1)
img = np.asarray(Image.open(sys.argv[1]).convert('RGB')).astype(float); H, W, _ = img.shape; L = lab(img)
bb = json.loads(sys.argv[2]); cat = bb['cat']; hc = max(1, cat[3] - cat[1]); lc = 1.66 * hc
print(f'cat box h={hc}px (1 Hc), 1 Lc≈{lc:.0f}px')
def items():
    for k, v in bb.items():
        if k in ('W',) or v is None: continue
        if isinstance(v[0], list):
            for i, b in enumerate(v): yield f'{k}{i}', b
        else: yield k, v
for name, b in items():
    x0, y0, x1, y1 = [int(t) for t in b[:4]]
    h = y1 - y0; dk = (b[4] / cat[4]) if len(b) > 4 and len(cat) > 4 else None
    hn = f' ≈{h * dk / hc:.2f} Hc at the cat\'s depth' if dk else ''
    if x1 < 0 or y1 < 0 or x0 >= W or y0 >= H: print(f'{name}: off-screen'); continue
    e = int(2 * lc); X0, Y0, X1, Y1 = max(0, x0 - e), max(0, y0 - e), min(W, x1 + e), min(H, y1 + e)
    ring = np.ones((Y1 - Y0, X1 - X0), bool); ring[max(0, y0 - Y0):max(0, y1 - Y0), max(0, x0 - X0):max(0, x1 - X0)] = False
    R = img[Y0:Y1, X0:X1]; green = (R[..., 1] > R[..., 0]) & (R[..., 1] > R[..., 2] * 1.05)
    g = L[Y0:Y1, X0:X1][ring & green]
    if len(g) < 20: print(f'{name}: h={h}px ({h / hc:.2f} Hc) — ground sample too small'); continue
    gm = g.mean(0)
    bx0, bx1, by0, by1 = max(0, x0), min(W, x1), max(0, y0), min(H, y1)
    B = L[by0:by1, bx0:bx1].reshape(-1, 3); dE = np.linalg.norm(B - gm, axis=1); body = B[dE > 12]
    if name == 'cat' or len(body) < 10: bm = None
    if len(body) < 10: print(f'{name}: h={h}px ({h / hc:.2f} Hc) — no distinct body pixels'); continue
    bm = body.mean(0); dl = abs(bm[0] - gm[0]); de = np.linalg.norm(bm - gm)
    ok = 'PASS' if (dl >= 18 or de >= 25) else 'low'
    print(f'{name}: h={h}px{hn}  body L*={bm[0]:.0f} ground L*={gm[0]:.0f}  ΔL*={dl:.0f}  ΔE={de:.0f}  {ok}  (body px {len(body)}/{len(B)})')
