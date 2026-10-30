import sys, asyncio
from playwright.async_api import async_playwright
async def main():
    url, out, wait = sys.argv[1], sys.argv[2], float(sys.argv[3])
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
        pg = await b.new_page(viewport={'width':1280,'height':720})
        pg.on('console', lambda m: print('CONSOLE', m.type, m.text))
        pg.on('pageerror', lambda e: print('PAGEERROR', e))
        await pg.goto(url); await pg.wait_for_timeout(wait*1000)
        if len(sys.argv)>4:
            await pg.keyboard.press('KeyG')
            for i,w in enumerate(sys.argv[4].split(',')):
                await pg.wait_for_timeout(float(w)*1000); await pg.screenshot(path=out.replace('.png',f'_{i}.png'))
                print(await pg.evaluate("document.getElementById('stat').textContent"))
        await pg.screenshot(path=out); await b.close()
asyncio.run(main())
