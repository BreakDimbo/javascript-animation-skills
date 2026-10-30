# usage: python3 shot.py out.png "query" W H waitms
import sys, asyncio
from playwright.async_api import async_playwright
out, q, W, H, wait = sys.argv[1], sys.argv[2], int(sys.argv[3]), int(sys.argv[4]), int(sys.argv[5])
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--disable-gpu', '--enable-unsafe-swiftshader'])
        pg = await b.new_page(viewport={'width': W, 'height': H}, device_scale_factor=1)
        logs = []
        pg.on('console', lambda m: logs.append(m.type + ': ' + m.text))
        pg.on('pageerror', lambda e: logs.append('ERR ' + str(e)))
        await pg.goto(f'http://localhost:8811/game/index.html?{q}', wait_until='commit', timeout=120000)
        await pg.wait_for_timeout(wait)
        await pg.screenshot(path=out)
        mods = await pg.evaluate("document.getElementById('mods').textContent")
        print(mods); print('\n'.join(logs[-15:]))
        await b.close()
asyncio.run(main())
