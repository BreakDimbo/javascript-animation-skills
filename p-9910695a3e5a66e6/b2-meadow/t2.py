import asyncio
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
        pg = await b.new_page(); await pg.goto('http://localhost:8792/b2-meadow/index.html', wait_until='commit'); await pg.wait_for_timeout(12000)
        print(await pg.evaluate("(()=>{const c=window.__fold.meadow.ground.material.map.image,g=c.getContext('2d');return [[5,5],[1024,5],[1024,1024],[300,1024]].map(([x,y])=>Array.from(g.getImageData(x,y,1,1).data).join())})()"))
        await pg.evaluate("(()=>{const f=window.__fold;f.cat.p.copy(f.meadow.toWorld(0,-55))})()"); await pg.wait_for_timeout(4000)
        await pg.screenshot(path='shot_edge.png'); await b.close()
asyncio.run(main())
