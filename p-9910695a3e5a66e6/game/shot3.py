# usage: python3 shot3.py out.png "query" W H [n gap_ms]   (waits for scene, frames; prints draw calls)
import sys, asyncio
from playwright.async_api import async_playwright
out, q, W, H = sys.argv[1], sys.argv[2], int(sys.argv[3]), int(sys.argv[4])
n = int(sys.argv[5]) if len(sys.argv) > 5 else 1; gap = int(sys.argv[6]) if len(sys.argv) > 6 else 2000
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--disable-gpu', '--enable-unsafe-swiftshader'])
        pg = await b.new_page(viewport={'width': W, 'height': H}, device_scale_factor=1)
        logs = []
        pg.on('console', lambda m: logs.append(m.type + ': ' + m.text) if m.type in ('error',) else None)
        pg.on('pageerror', lambda e: logs.append('PAGEERR ' + str(e)))
        await pg.goto(f'http://localhost:8823/game/index.html?{q}', wait_until='commit', timeout=120000)
        await pg.wait_for_function('window.__fold && window.__fold.ready', timeout=180000)
        await pg.wait_for_timeout(25000)
        import os
        if os.environ.get("JS"): print("eval:", await pg.evaluate(os.environ["JS"])); await pg.wait_for_timeout(8000)
        for i in range(n):
            o = out if n == 1 else out.replace('.png', f'_{i}.png')
            await pg.screenshot(path=o, timeout=180000)
            if i < n - 1: await pg.wait_for_timeout(gap)
        print(await pg.evaluate("JSON.stringify(window.__fold.renderer.info.render)"))
        print('\n'.join(logs[-10:]) or 'no errors')
        await b.close()
asyncio.run(main())
