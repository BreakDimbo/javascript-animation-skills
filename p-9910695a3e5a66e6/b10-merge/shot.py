import sys, asyncio
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
        pg = await b.new_page(viewport={'width':800,'height':450})
        errs=[]; pg.on('console', lambda m: errs.append(m.type+': '+m.text) if m.type in ('error','warning') else None); pg.on('pageerror', lambda e: errs.append('pageerror: '+str(e)))
        await pg.goto('http://localhost:8810/b10-merge/index.html'+(sys.argv[2] if len(sys.argv)>2 else ''), wait_until='commit')
        await pg.wait_for_timeout(int(sys.argv[3]) if len(sys.argv)>3 else 15000)
        print('\n'.join(errs) or 'no errors')
        import base64
        d = await pg.evaluate("document.querySelector('canvas').toDataURL('image/png')")
        open(sys.argv[1],'wb').write(base64.b64decode(d.split(',')[1]))
        print(await pg.evaluate('window.__fold && window.__fold.mods.join(" | ")'))
        await b.close()
asyncio.run(main())
