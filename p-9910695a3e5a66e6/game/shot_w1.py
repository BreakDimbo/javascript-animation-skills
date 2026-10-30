# private (untracked) shot helper for w1 on port 8821
# usage: python3 shot_w1.py out.png "query" W H [extra_ms] [sbT list comma] ; env EVAL=js prints result
import sys, asyncio, os
from playwright.async_api import async_playwright
out, q, W, H = sys.argv[1], sys.argv[2], int(sys.argv[3]), int(sys.argv[4])
extra = int(sys.argv[5]) if len(sys.argv) > 5 else 3000
ts = sys.argv[6].split(',') if len(sys.argv) > 6 and sys.argv[6] else [None]
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--disable-gpu', '--enable-unsafe-swiftshader'])
        pg = await b.new_page(viewport={'width': W, 'height': H}, device_scale_factor=1)
        logs = []
        pg.on('console', lambda m: logs.append(m.type + ': ' + m.text))
        pg.on('pageerror', lambda e: logs.append('ERR ' + str(e)))
        await pg.goto(f'http://localhost:8821/game/index.html?{q}', wait_until='commit', timeout=120000)
        for i in range(240):
            await pg.wait_for_timeout(500)
            try:
                if await pg.evaluate('!!(window.__fold && window.__fold.ready)'): break
            except Exception: pass
        await pg.wait_for_timeout(extra)
        for i, t in enumerate(ts):
            if t is not None:
                await pg.evaluate(f'window.__sbT = {t}')
                await pg.wait_for_timeout(2500)
            await pg.screenshot(path=out if len(ts) == 1 else out.replace('.png', f'_{i}.png'), timeout=150000)
        if os.environ.get('EVAL'): print(await pg.evaluate(os.environ['EVAL']))
        info = await pg.evaluate("({calls: window.__fold.renderer.info.render.calls, tris: window.__fold.renderer.info.render.triangles})")
        print(info); print('\n'.join(l for l in logs if (l.startswith('ERR') or l.startswith('error') or l.startswith('warn')) and 'GPU stall' not in l))
        await b.close()
asyncio.run(main())
