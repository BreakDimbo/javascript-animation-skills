# m-loop shots: python3 shot_loop.py out.png "query" W H waitms [js-after-load] [js-wait-ms]
# prints boot log, console errors/warnings, time to __fold.ready and first frames
import sys, asyncio, time
from playwright.async_api import async_playwright
out, q, W, H, wait = sys.argv[1], sys.argv[2], int(sys.argv[3]), int(sys.argv[4]), int(sys.argv[5])
js = sys.argv[6] if len(sys.argv) > 6 else None
jsw = int(sys.argv[7]) if len(sys.argv) > 7 else 0
PORT = 8893
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--disable-gpu', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'])
        pg = await b.new_page(viewport={'width': W, 'height': H}, device_scale_factor=1)
        logs = []
        pg.on('console', lambda m: logs.append(m.type + ': ' + m.text) if m.type in ('error', 'warning') else None)
        pg.on('pageerror', lambda e: logs.append('PAGEERROR ' + str(e)))
        pg.on('requestfailed', lambda r: logs.append('REQFAIL ' + r.url))
        t0 = time.time()
        await pg.goto(f'http://127.0.0.1:{PORT}/game/index.html?{q}', wait_until='commit', timeout=120000)
        try:
            await pg.wait_for_function('window.__fold && window.__fold.ready', timeout=wait)
            print(f'ready after {time.time()-t0:.1f}s')
        except Exception as e:
            print('not ready', e)
        rest = wait - (time.time() - t0) * 1000
        if rest > 0: await pg.wait_for_timeout(rest)
        if js:
            r = await pg.evaluate(js); print('js ->', r)
            if jsw: await pg.wait_for_timeout(jsw)
        await pg.screenshot(path=out, timeout=240000)
        try:
            mods = await pg.evaluate("(window.__fold && window.__fold.mods || []).join('\\n')"); print(mods)
        except Exception as e: print('mods?', e)
        errs = [l for l in logs if 'GPU stall' not in l]
        print('CONSOLE', len(errs)); print('\n'.join(errs[-20:]))
        await b.close()
asyncio.run(main())
