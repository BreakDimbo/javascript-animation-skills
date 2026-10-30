# bake the painted board PNGs (desktop 4096 + mobile 2048) into game/baked/
import asyncio, base64, sys
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--disable-gpu'])
        for W in (sys.argv[1:] or ['4096', '2048']):
            pg = await b.new_page(); pg.on('pageerror', lambda e: print('ERR', e))
            await pg.goto(f'http://localhost:8811/game/bake.html?w={W}', wait_until='commit')
            await pg.wait_for_function('window.__bake', timeout=900000, polling=1000)
            o = await pg.evaluate('window.__bake')
            for k in ('board', 'mask'): open(f'baked/{k}_{W}.png', 'wb').write(base64.b64decode(o[k].split(',')[1]))
            open(f'baked/board_{W}.json', 'w').write(o['json']); print(W, 'baked in', round(o['ms']), 'ms')
        await b.close()
asyncio.run(main())
