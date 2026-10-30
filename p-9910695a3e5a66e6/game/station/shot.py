# usage: python3 shot.py out.png "query" W H waitms [js-before-shot]
import sys, asyncio
from playwright.async_api import async_playwright
out, q, W, H, wait = sys.argv[1], sys.argv[2], int(sys.argv[3]), int(sys.argv[4]), int(sys.argv[5])
js = sys.argv[6] if len(sys.argv) > 6 else None
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--disable-gpu', '--enable-unsafe-swiftshader'])
        pg = await b.new_page(viewport={'width': W, 'height': H}, device_scale_factor=1)
        logs = []
        pg.on('console', lambda m: logs.append(m.type + ': ' + m.text))
        pg.on('pageerror', lambda e: logs.append('ERR ' + str(e)))
        await pg.goto(f'http://localhost:8863/game/index.html?{q}', wait_until='commit', timeout=120000)
        await pg.wait_for_timeout(wait)
        if js:
            r = await pg.evaluate(js); print('js:', r)
            await pg.wait_for_timeout(int(sys.argv[7]) if len(sys.argv) > 7 else 3000)
        await pg.screenshot(path=out, timeout=240000)
        errs = [l for l in logs if l.startswith('error') or l.startswith('ERR') or l.startswith('warning')]
        print('\n'.join(l for l in logs if 'station' in l.lower())[-2000:])
        print('ERRORS/WARN:', len(errs)); print('\n'.join(errs[:20]))
        await b.close()
asyncio.run(main())
