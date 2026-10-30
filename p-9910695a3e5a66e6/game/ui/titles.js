// m-loop: the title card (also the calm loading card), the fade veil and the end card. Small serif type, fades only.
export function createTitles(){
  // the veil + title card are static markup in index.html (so the loading card shows before any script has loaded)
  const veil = document.getElementById('veil') || Object.assign(document.body.appendChild(document.createElement('div')), { id: 'veil' });
  const mk = (cls, a, b, c) => { const d = document.createElement('div'); d.className = 'tcard ' + cls; d.innerHTML = `<div class="t1">${a}</div><div class="t2">${b}</div><div class="t3">${c}</div>`; document.body.append(d); return d; };
  const title = document.getElementById('tTitle') || mk('title on', '褶 星', 'Fold', '');
  const end = mk('end', '褶 星', '走完了一圈 · once around the fold', '');
  const wait = (ms) => new Promise(r => setTimeout(r, ms));
  const OUT = 1.4; // s, the ending fade to black (= audio.js MUSIC_OUT)
  return {
    veil, title, end,
    loading(txt){ title.querySelector('.t3').textContent = txt || ''; },
    // title → fade (the world dissolves in under the paper)
    // QA #13: ?at=<region> skips the title hold — the paper dissolves on a wall-clock CSS transition started at ready (≤ sec s, no frame counting)
    reveal(sec = 1.2){ title.classList.remove('on'); veil.style.transition = sec > 0 ? `opacity ${sec}s ease-out` : 'none'; veil.style.opacity = 0; },
    async intro(){ title.querySelector('.t3').style.opacity = 0; await wait(900); title.classList.remove('on'); await wait(1300); veil.style.opacity = 0; await wait(2400); },
    // fade to black → end card. E2: 1.4 s (was 3.2), ease-in sine (black = 1 − cos(πt/2)) mirroring m-audio's equal-power music fade (gain cos(πt/2), MUSIC_OUT 1.4 s);
    // both start on the same frame (loop.state → 'black' calls outro() and sets musicOut) and end together, then the end card cuts in. The pull-out (loop.js) eases in ≈1 s of its 7.5 s, so the held view before black is ≈6 s (≥ 2 s)
    async outro(){ veil.classList.add('ink'); veil.style.transition = `opacity ${OUT}s cubic-bezier(.12, 0, .39, 0)`; veil.style.opacity = 1; await wait(OUT * 1000); end.classList.add('on'); end.querySelector('.t3').textContent = '';
      await wait(5200); end.querySelector('.t3').textContent = '按任意键继续散步 · any key to walk on'; },
    async resume(){ end.classList.remove('on'); await wait(1400); veil.style.transition = 'opacity 2.4s ease'; veil.style.opacity = 0; await wait(2400); veil.classList.remove('ink'); },
  };
}
