import sys, asyncio
from playwright.async_api import async_playwright
out,q=sys.argv[1],sys.argv[2]; page=sys.argv[3] if len(sys.argv)>3 else 'catview.html'
async def main():
  async with async_playwright() as p:
    b=await p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--disable-gpu','--enable-unsafe-swiftshader'])
    pg=await b.new_page(viewport={'width':900,'height':600}); logs=[]
    pg.on('console',lambda m:logs.append(m.text)); pg.on('pageerror',lambda e:logs.append('ERR '+str(e)))
    await pg.goto(f'http://localhost:8811/game/{page}?{q}'); await pg.wait_for_function("document.title=='done'",timeout=60000)
    await pg.screenshot(path=out); print('\n'.join(logs)); await b.close()
asyncio.run(main())
