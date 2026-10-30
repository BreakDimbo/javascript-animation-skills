# m-loop: first-frame time with the baked meadow ground vs the live paint (?livepaint), alternating runs, same box load
import asyncio, re, sys, os
from playwright.async_api import async_playwright
async def run(b, q):
    pg = await b.new_page(viewport={'width': 1440, 'height': 900}); logs = []
    pg.on('console', lambda m: logs.append(m.text))
    await pg.goto(f'http://127.0.0.1:8893/game/index.html?nointro&nosave{q}', wait_until='commit', timeout=120000)
    for _ in range(600):
        if any(l.startswith('first frames') for l in logs): break
        await asyncio.sleep(.5)
    await pg.close()
    g = lambda pre: next((l for l in logs if l.startswith(pre)), '?')
    return g('meadow ground'), g('meadow bake'), g('first frames')
async def main():
    n = int(sys.argv[1]) if len(sys.argv) > 1 else 3
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--disable-gpu', '--enable-unsafe-swiftshader'])
        for i in range(n):
            for q in ('&livepaint', ''):
                r = await run(b, q); print(f'{q or "&baked":12s} load {os.getloadavg()[0]:5.1f} |', ' | '.join(r), flush=True)
        await b.close()
asyncio.run(main())
