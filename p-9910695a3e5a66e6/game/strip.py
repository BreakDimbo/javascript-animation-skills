import sys, asyncio
from playwright.async_api import async_playwright
out, q, W, H, n, gap = sys.argv[1], sys.argv[2], int(sys.argv[3]), int(sys.argv[4]), int(sys.argv[5]), int(sys.argv[6])
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--disable-gpu', '--enable-unsafe-swiftshader'])
        pg = await b.new_page(viewport={'width': W, 'height': H}); logs = []
        pg.on('pageerror', lambda e: logs.append('ERR ' + str(e)))
        await pg.goto(f'http://localhost:8811/game/index.html?{q}', wait_until='commit', timeout=120000); await pg.wait_for_timeout(45000)
        for i in range(n): await pg.screenshot(path=f'{out}_{i}.png'); await pg.wait_for_timeout(gap)
        print('\n'.join(logs)); await b.close()
asyncio.run(main())
