import asyncio
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
        pg = await b.new_page(viewport={'width':960,'height':540})
        errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto('http://localhost:8792/b2-meadow/index.html', wait_until='commit'); await pg.wait_for_timeout(15000)
        js = "(()=>{const f=window.__fold,[u,v]=f.meadow.project(f.cat.p);const s=f.meadow.sheep[0];return [u.toFixed(2),v.toFixed(2),(f.cat.p.length()-600).toFixed(3),s.u.toFixed(2),s.v.toFixed(2),s.state]})()"
        print('start', await pg.evaluate(js))
        await pg.keyboard.down('w'); await pg.keyboard.down('Shift'); await pg.wait_for_timeout(4000); await pg.keyboard.up('Shift'); await pg.keyboard.up('w')
        print('after W', await pg.evaluate(js))
        # teleport cat next to sheep 0 and watch it move away
        await pg.evaluate("(()=>{const f=window.__fold,s=f.meadow.sheep[0];f.cat.p.copy(f.meadow.toWorld(s.u+0.8,s.v))})()")
        await pg.wait_for_timeout(3000)
        print('flee', await pg.evaluate(js))
        await pg.screenshot(path='shot_flee.png'); print(errs or 'no page errors')
        await b.close()
asyncio.run(main())
