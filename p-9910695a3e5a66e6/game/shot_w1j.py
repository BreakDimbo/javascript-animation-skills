# private (untracked) multi-shot helper for w1 journey, port 8821
# usage: python3 shot_w1j.py W H "out1.png|query1" "out2.png|query2" ...   env EVAL=js prints result per page; EXTRA=ms
import sys, asyncio, os
from playwright.async_api import async_playwright
W, H = int(sys.argv[1]), int(sys.argv[2]); jobs = [a.split('|', 1) for a in sys.argv[3:]]
extra = int(os.environ.get('EXTRA', '3000'))
async def one(b, out, q, attempt=0):
    pg = await b.new_page(viewport={'width': W, 'height': H}, device_scale_factor=1)
    logs = []
    pg.on('console', lambda m: logs.append(m.type + ': ' + m.text))
    pg.on('pageerror', lambda e: logs.append('ERR ' + str(e)))
    await pg.goto(f'http://localhost:8821/game/index.html?{q}', wait_until='commit', timeout=180000)
    for i in range(360):
        await pg.wait_for_timeout(500)
        try:
            if await pg.evaluate('!!(window.__fold && window.__fold.ready)'): break
        except Exception: pass
    if any('WebGL context' in l for l in logs) and attempt < 3:
        await pg.close(); print('webgl fail, retry', attempt); await asyncio.sleep(45); return await one(b, out, q, attempt + 1)
    await pg.wait_for_timeout(extra)
    await pg.screenshot(path=out, timeout=180000)
    info = await pg.evaluate("({calls: window.__fold.renderer.info.render.calls, tris: window.__fold.renderer.info.render.triangles})")
    print(out, q, info)
    if os.environ.get('EVAL'): print('  EVAL', await pg.evaluate(os.environ['EVAL']))
    bad = [l for l in logs if (l.startswith('ERR') or l.startswith('error')) and 'GPU stall' not in l]
    print('  errors:', len(bad), '\n'.join(bad)[:1500])
    if os.environ.get('LOG'): print('\n'.join(l for l in logs if 'GPU stall' not in l)[:3000])
    await pg.close()
async def main():
    async with async_playwright() as p:
        for out, q in jobs:
            for attempt in range(3):
                b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--disable-gpu', '--enable-unsafe-swiftshader'])
                try:
                    await one(b, out, q); await b.close(); break
                except Exception as e:
                    print('  crash, retry', attempt, str(e)[:200])
                    try: await b.close()
                    except Exception: pass
                    await asyncio.sleep(30)
asyncio.run(main())
