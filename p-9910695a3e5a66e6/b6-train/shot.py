import sys
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b=p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
    pg=b.new_page(viewport={'width':1280,'height':720}); errs=[]
    pg.on('console',lambda m: errs.append(m.text) if m.type=='error' else None); pg.on('pageerror',lambda e: errs.append(str(e)))
    pg.goto('http://localhost:8796/b6-train/index.html'); pg.wait_for_timeout(4000)
    pg.keyboard.down('KeyD'); pg.wait_for_timeout(500); pg.keyboard.up('KeyD'); pg.wait_for_timeout(1500)
    pg.screenshot(path='/workspace/fold/b6-train/shot.png'); print('errors',errs); b.close()
