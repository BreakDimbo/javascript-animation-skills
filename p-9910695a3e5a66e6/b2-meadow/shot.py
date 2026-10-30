import sys, asyncio
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
        pg = await b.new_page(viewport={'width':1280,'height':720})
        errs=[]; pg.on('console', lambda m: errs.append(m.type+': '+m.text) if m.type in ('error','warning') else None); pg.on('pageerror', lambda e: errs.append('pageerror: '+str(e)))
        await pg.goto('http://localhost:8792/b2-meadow/index.html'+(sys.argv[2] if len(sys.argv)>2 else ''), wait_until='commit')
        await pg.wait_for_timeout(20000)
        await pg.screenshot(path=sys.argv[1], timeout=90000); print('\n'.join(errs) or 'no errors')
        await b.close()
asyncio.run(main())
