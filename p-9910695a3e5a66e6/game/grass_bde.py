# grass-region colour check vs FINAL17: blur (σ6 like sheep/compare.py bdE), mask grass by hue/sat in each image, compare mean Lab (CIEDE2000)
# usage: python3 grass_bde.py [ref.png] ours.png   (ref defaults to FINAL17 = /workspace/fold/shared/full0.png)
import sys, numpy as np, cv2
from skimage.color import rgb2lab, deltaE_ciede2000
def grass(path, H=868):
    im = cv2.imread(path); im = cv2.resize(im, (int(im.shape[1] * H / im.shape[0]), H)); b = cv2.GaussianBlur(im, (0, 0), 6.0)
    hsv = cv2.cvtColor(b, cv2.COLOR_BGR2HSV); h, s, v = hsv[..., 0], hsv[..., 1], hsv[..., 2]
    m = (h > 28) & (h < 75) & (s > 70) & (v > 60)
    lab = rgb2lab(b[..., ::-1] / 255.)[m]; return lab.mean(0), lab.std(0), m.mean()
ref = sys.argv[1] if len(sys.argv) > 2 else '/workspace/fold/shared/full0.png'; ours = sys.argv[-1]
(a, sa, fa), (b, sb, fb) = grass(ref), grass(ours)
print(f'ref  L {a[0]:.1f} a {a[1]:+.1f} b {a[2]:+.1f} (σL {sa[0]:.1f}) cover {fa:.2f}')
print(f'ours L {b[0]:.1f} a {b[1]:+.1f} b {b[2]:+.1f} (σL {sb[0]:.1f}) cover {fb:.2f}')
print(f'grass bdE {float(deltaE_ciede2000(a[None], b[None])[0]):.2f}  dL {b[0]-a[0]:+.1f} da {b[1]-a[1]:+.1f} db {b[2]-a[2]:+.1f}')
