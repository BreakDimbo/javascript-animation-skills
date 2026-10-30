# bake the meadow ground (json-only: hedges + rand count) into game/baked/meadow_ground_2048.json; --check compares with the live paint
import asyncio, json, sys
from playwright.async_api import async_playwright
PORT = 8893
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--disable-gpu'])
        pg = await b.new_page(); pg.on('pageerror', lambda e: print('ERR', e))
        if '--check' in sys.argv:
            await pg.goto(f'http://127.0.0.1:{PORT}/game/bake_meadow.html?check', wait_until='commit')
            await pg.wait_for_function('window.__check', timeout=900000, polling=1000); print(json.dumps(await pg.evaluate('window.__check'), indent=1))
        else:
            await pg.goto(f'http://127.0.0.1:{PORT}/game/bake_meadow.html', wait_until='commit')
            await pg.wait_for_function('window.__bake', timeout=900000, polling=1000); o = await pg.evaluate('window.__bake')
            open('baked/meadow_ground_2048.json', 'w').write(o['json'])
            print('meadow ground baked in', round(o['ms']), 'ms; v', json.loads(o['json'])['v'])
        await b.close()
asyncio.run(main())
