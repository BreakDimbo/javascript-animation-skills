# usage: python3 page_shot.py out.png path?query W H maxwaitms   (waits for window.__sheet.done, prints it)
import sys, asyncio, json
from playwright.async_api import async_playwright
out, path, W, H, wait = sys.argv[1], sys.argv[2], int(sys.argv[3]), int(sys.argv[4]), int(sys.argv[5])
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--disable-gpu', '--enable-unsafe-swiftshader'])
        pg = await b.new_page(viewport={'width': W, 'height': H}, device_scale_factor=1); logs = []
        pg.on('console', lambda m: logs.append(m.type + ': ' + m.text)); pg.on('pageerror', lambda e: logs.append('ERR ' + str(e)))
        await pg.goto(f'http://localhost:8863/game/{path}', wait_until='commit', timeout=120000)
        try: await pg.wait_for_function('window.__sheet && window.__sheet.done', timeout=wait)
        except Exception as e: print('timeout', e)
        await pg.wait_for_timeout(1500)
        print(json.dumps(await pg.evaluate('window.__sheet || null')))
        await pg.screenshot(path=out, timeout=240000)
        print('\n'.join(l for l in logs if 'GPU stall' not in l)[-3000:]); await b.close()
asyncio.run(main())
