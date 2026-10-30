// m-loop: phone controls. The left half is already a drag-to-walk stick (core/input.js); this adds three small serif words on the
// right margin — 坐 sit (draw a page) · 睡 sleep · 本 book — that press C / Z / J. Shown on touch devices (or ?touch).
import { qs } from '../core/util.js';
export function createTouchKeys(){
  const isTouch = qs.has('touch') || matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
  const box = document.createElement('div'); box.id = 'touchk'; document.body.append(box);
  const press = (code, key) => { dispatchEvent(new KeyboardEvent('keydown', { code, key })); setTimeout(() => dispatchEvent(new KeyboardEvent('keyup', { code, key })), 120); };
  for (const [t, code, key] of [['坐', 'KeyC', 'c'], ['睡', 'KeyZ', 'z'], ['本', 'KeyJ', 'j']]){ const b = document.createElement('span'); b.textContent = t;
    b.addEventListener('touchstart', (e) => { e.preventDefault(); e.stopPropagation(); press(code, key); }, { passive: false });
    b.addEventListener('click', () => press(code, key)); box.append(b); }
  if (isTouch){ box.style.display = 'flex'; const h = document.getElementById('help'); if (h) h.textContent = '左半屏拖动走 · 右半屏拖动看 · 坐 画一页 · 睡 · 本'; }
  return { box, isTouch, show(on){ box.style.opacity = on ? 1 : 0; } };
}
