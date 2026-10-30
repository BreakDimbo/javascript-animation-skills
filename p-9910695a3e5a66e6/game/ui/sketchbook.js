// the sketchbook (GAME_REVIEW §1.2): sit (C) a few seconds beside a find, an animal or a region's own creature and one pencil page fades
// in at the paper's lower right, stays a moment and fades out; the book gains that entry. J (or the dog-eared page corner) opens the
// whole book: a paper spread, serif small type, empty cells for what has not been seen yet. No popup, no numbers, no sound.
import { R, qs, note } from '../core/util.js';
import { F } from '../world.js';

export const ENTRIES = [
  ['catnip', '猫薄荷', 'Catnip'], ['log', '倒木', 'Fallen log'], ['yarn', '毛线头', 'A loose end of yarn'], ['warmstone', '晒暖的石头', 'A sun-warm stone'],
  ['stile', '篱笆木梯', 'The stile'], ['birdbath', '鸟浴盆', 'Birdbath'], ['mitten', '红手套', 'A lost red mitten'], ['drift', '野花丛', 'Wildflower drift'],
  ['butterfly', '粉蝶', 'Cabbage whites'], ['rabbit', '野兔', 'A rabbit by the hedge'], ['swallow', '家燕', 'Swallows, low'], ['sleep', '小憩', 'A nap on the stone'],
  ['sheep', '羊', 'Sheep'], ['duck', '绿头鸭', 'Mallard'], ['seal', '海豹', 'Harbour seal'] ];
const NAME = Object.fromEntries(ENTRIES.map(([k, zh, en]) => [k, [zh, en]]));
const KEY = 'fold.sketchbook', SIT = 2.5, NEAR = 1.6, SHOW = 4.2;
const load = () => { if (qs.has('nosave')) return new Set(); try { return new Set(JSON.parse(localStorage.getItem(KEY) || '[]')); } catch { return new Set(); } };
const img = (k) => `assets/sketch/${k}.jpg`;

export function createSketchbook({ route, wild, regionAt }){
  const seen = load(); for (const k of (qs.get('seen') || '').split(',').filter(k => NAME[k])) seen.add(k); // debug: ?seen=a,b
  const save = () => { if (!qs.has('nosave')) try { localStorage.setItem(KEY, JSON.stringify([...seen])); } catch {} };
  const el = (tag, cls, html = '') => { const e = document.createElement(tag); if (cls) e.className = cls; e.innerHTML = html; return e; };
  // one page, lower right of the paper
  const page = el('div', 'sk-page', '<img alt=""><div class="cap"><span class="zh"></span><span class="en"></span></div>');
  // the dog-eared corner (opens the book); appears once the book has a first page
  const corner = el('div', 'sk-corner'); corner.title = 'J';
  const book = el('div', 'sk-book', '<div class="sheet"><div class="hd">速写本 · <i>Sketchbook</i></div><div class="grid"></div><div class="ft">J</div></div>');
  document.body.append(page, corner, book);
  const grid = book.querySelector('.grid');
  const fill = () => { grid.innerHTML = ''; for (const [k, zh, en] of ENTRIES){ const c = el('div', 'cell' + (seen.has(k) ? ' on' : ''));
    c.innerHTML = seen.has(k) ? `<img src="${img(k)}" alt=""><div class="cap">${zh} · <i>${en}</i></div>` : '<div class="cap">· · ·</div>'; grid.appendChild(c); } };
  const open = (on = !book.classList.contains('on')) => { if (on) fill(); book.classList.toggle('on', on); };
  corner.addEventListener('click', () => open()); book.addEventListener('click', () => open(false));
  addEventListener('keydown', (e) => { if (e.key === 'j' || e.key === 'J') open(); else if (e.key === 'Escape') open(false); });
  corner.classList.toggle('on', seen.size > 0);

  let showT = 0;
  function show(k){
    page.querySelector('img').src = img(k); const [zh, en] = NAME[k]; page.querySelector('.zh').textContent = zh; page.querySelector('.en').textContent = en;
    page.classList.add('on'); showT = SHOW;
  }
  function add(k){ if (seen.has(k)) return false; seen.add(k); save(); show(k); corner.classList.add('on'); note(`sketch: ${k}`); return true; }

  // what the sitting cat is beside, in order of closeness; each subject maps to one entry
  const dist = (u, v, cu, cv) => Math.hypot(u - cu, v - cv);
  function subject(cat){
    const [cu, cv] = F.toUV(cat.up), out = [];
    for (const f of route.finds){ const d = dist(f.u, f.v, cu, cv); if (d < NEAR + (f.kind === 'drift' ? 1 : 0)) out.push([d, f.kind === 'drift' && seen.has('drift') ? 'butterfly' : f.kind]); }
    for (const s of route.sleep){ const d = dist(s.u, s.v, cu, cv); if (d < NEAR) out.push([d, 'sleep']); }
    if (wild) for (const r of wild.rabbits){ const d = r.pos.angleTo(cat.up) * R; if (d < 3.2) out.push([d + .5, 'rabbit']); }
    const reg = regionAt(cat.up); if (reg){ const k = { meadow: 'sheep', pond: 'duck', sealbay: 'seal' }[reg.id]; if (k) out.push([4, k]); }
    if (wild?.swallows?.mesh?.visible) out.push([6, 'swallow']);
    out.sort((a, b) => a[0] - b[0]); return out.map(o => o[1]).find(k => !seen.has(k)) || null;
  }

  let sitT = 0, took = false;
  // debug: ?sketch=<key> shows that page once the game runs (headless shots can't hold C for 2.5 s); ?sketch=book opens the book
  { const k = qs.get('sketch'); if (k) setTimeout(() => { if (k === 'book') open(); else if (NAME[k]){ seen.delete(k); add(k); } }, +(qs.get('sketchT') || 2500)); }
  return { seen, show, add, open, page, book,
    update(dt, cat){
      if (showT > 0 && (showT -= dt) <= 0) page.classList.remove('on');
      if (cat.state !== 'sit'){ sitT = 0; took = false; return; }
      if (took || (sitT += dt) < SIT) return;
      took = true; const k = subject(cat); if (k) add(k);
    } };
}
