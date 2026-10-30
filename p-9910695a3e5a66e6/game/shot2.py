# usage: python3 shot2.py out.png "query" W H waitms [sbT]   (sbT: freeze Seal Bay time; several comma-separated → out_0.png, out_1.png …)
import sys, asyncio
from playwright.async_api import async_playwright
out, q, W, H, wait = sys.argv[1], sys.argv[2], int(sys.argv[3]), int(sys.argv[4]), int(sys.argv[5])
ts = sys.argv[6].split(',') if len(sys.argv) > 6 else [None]
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--disable-gpu', '--enable-unsafe-swiftshader'])
        pg = await b.new_page(viewport={'width': W, 'height': H}, device_scale_factor=1)
        logs = []
        pg.on('console', lambda m: logs.append(m.type + ': ' + m.text))
        pg.on('pageerror', lambda e: logs.append('ERR ' + str(e)))
        await pg.goto(f'http://localhost:8821/game/index.html?{q}', wait_until='commit', timeout=120000)
        await pg.wait_for_timeout(wait)
        for i, t in enumerate(ts):
            if t is not None:
                await pg.evaluate(f'window.__sbT = {t}')
                await pg.wait_for_timeout(2500)
            await pg.screenshot(path=out if len(ts) == 1 else out.replace('.png', f'_{i}.png'), timeout=150000)
        info = await pg.evaluate("({calls: window.__fold.renderer.info.render.calls, tris: window.__fold.renderer.info.render.triangles})")
        print(info); print('\n'.join(l for l in logs if not l.startswith('log') and 'GPU stall' not in l))
        await b.close()
asyncio.run(main())
