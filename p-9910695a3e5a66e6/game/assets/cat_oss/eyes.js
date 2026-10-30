// 褶星 Fold — cat_oss closed-eye texture swap (sleep + blink). Self-contained helper, NOT wired in.
// The TRELLIS.2 cat's eyes live in its baked texture (no eye meshes), so cat.js's eye-scale blink does nothing on it;
// instead swap the body map for <name>_eyesclosed.jpg (same UVs, built by tools/blender/cat_oss_trellis.py --look A|B|C).
// Integration (artkit/cat.js): `import { ossEyes } from '../game/assets/cat_oss/eyes.js';` and in driveGLB, right after
//   `const closed = cat.state === 'sleep' || cat.blink < 0.12;`   add   `ossEyes(cat, closed);`
import * as THREE from '../../../shared/vendor/three.module.js';
export function ossEyes(cat, closed, url) {
  const g = cat.glb; if (!g) return;
  let s = g.ossEyes;
  if (!s) {
    let mesh = null; g.m.traverse(o => { if (!mesh && o.isMesh && o.material && o.material.map) mesh = o; });
    s = g.ossEyes = { mesh, open: mesh && mesh.material.map, closed: null };
    if (!mesh) return;
    const name = (new URLSearchParams(location.search).get('cat') || 'cat_oss').replace(/[^\w-]/g, '');
    new THREE.TextureLoader().load(url || new URL(`./${name}_eyesclosed.jpg`, import.meta.url).href, t => {
      const o = s.open; t.flipY = o.flipY; t.colorSpace = o.colorSpace; t.wrapS = o.wrapS; t.wrapT = o.wrapT; t.anisotropy = o.anisotropy; s.closed = t;
    }, undefined, () => { s.closed = null; /* no closed texture for this cat: keep eyes open, no error */ });
  }
  if (!s.mesh) return;
  const want = closed && s.closed ? s.closed : s.open;
  if (s.mesh.material.map !== want) s.mesh.material.map = want;
}
