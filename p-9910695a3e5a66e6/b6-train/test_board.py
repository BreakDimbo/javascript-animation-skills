from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b=p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
    pg=b.new_page(viewport={'width':1280,'height':720}); errs=[]
    pg.on('pageerror',lambda e: errs.append(str(e)))
    pg.goto('http://localhost:8796/b6-train/index.html'); pg.wait_for_timeout(2000)
    pg.evaluate("__fold.train.s=-0.5")
    pg.wait_for_timeout(1500); print(pg.evaluate("[__fold.train.state, __fold.train.s]"))
    pg.evaluate("{const P=__fold.station.path; __fold.C.dir.copy(P.dir(__fold.train.s-2.9).normalize())}")
    pg.wait_for_timeout(4000); print(pg.evaluate("(()=>{const f=__fold;return [f.C.dir.length(), f.station.path.dir(f.train.s-2.9).dot(f.C.dir)]})()")); print(pg.evaluate("(()=>{const f=__fold;return [f.train.s, f.station.path.dir(f.train.s-2.9).multiplyScalar(600).distanceTo(f.C.dir.clone().multiplyScalar(600)), f.C.dir.clone().multiplyScalar(600).distanceTo(f.cat.position)]})()")); pg.evaluate("dispatchEvent(new KeyboardEvent(\"keydown\",{code:\"KeyE\"}))"); pg.wait_for_timeout(300)
    print('riding', pg.evaluate("__fold.C.riding")); pg.keyboard.press('KeyT'); pg.wait_for_timeout(10000)
    print(pg.evaluate("[__fold.train.state, __fold.train.s]"))
    pg.screenshot(path='/workspace/fold/b6-train/shot_ride.png'); print(errs); b.close()
