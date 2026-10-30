import sys, asyncio
from playwright.async_api import async_playwright
async def main():
    q = sys.argv[1] if len(sys.argv) > 1 else ''
    out = sys.argv[2] if len(sys.argv) > 2 else 'shot.png'
    wait = int(sys.argv[3]) if len(sys.argv) > 3 else 3000
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
        pg = await b.new_page(viewport={'width':1280,'height':720})
        pg.on('console', lambda m: print('CONSOLE', m.type, m.text))
        pg.on('pageerror', lambda e: print('PAGEERROR', e))
        await pg.goto('http://127.0.0.1:18731/b1-cat/index.html' + q)
        await pg.wait_for_timeout(wait)
        print(await pg.evaluate('JSON.stringify({s:__fold.cat.state,g:__fold.cat.gait,sp:__fold.cat.speed,alt:__fold.cat.alt,p:__fold.cat.pos.toArray().map(v=>+v.toFixed(2))})'))
        await pg.screenshot(path=out)
        await b.close()
asyncio.run(main())
