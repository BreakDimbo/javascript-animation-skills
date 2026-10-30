# m-loop QA: walk the whole loop via __fold.qa (warp), log visits / states, screenshot the finale stages. Port 8893.
# usage: python3 qa_loop.py W H [prefix] [extra query, e.g. stationAt=119.75,-4.58]
import sys, asyncio, time, json
from playwright.async_api import async_playwright
W, H = int(sys.argv[1]), int(sys.argv[2]); pre = sys.argv[3] if len(sys.argv) > 3 else f'shots/loop/qa_{W}'; EXTRA = sys.argv[4] if len(sys.argv) > 4 else ''
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--disable-gpu', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'])
        pg = await b.new_page(viewport={'width': W, 'height': H}, device_scale_factor=1)
        logs = []
        pg.on('console', lambda m: logs.append(m.type + ': ' + m.text) if m.type in ('error', 'warning') else None)
        pg.on('pageerror', lambda e: logs.append('PAGEERROR ' + str(e)))
        pg.on('requestfailed', lambda r: logs.append('REQFAIL ' + r.url))
        await pg.goto(f'http://127.0.0.1:8893/game/index.html?nointro' + ('&' + EXTRA if EXTRA else ''), wait_until='commit', timeout=120000)
        await pg.wait_for_function('window.__fold && window.__fold.ready', timeout=300000)
        await pg.keyboard.press('KeyX')  # first input → audio starts
        await pg.wait_for_timeout(4000)
        print('audio', await pg.evaluate('JSON.stringify(__fold.audio && __fold.audio.loaded)'))
        print('station', await pg.evaluate('JSON.stringify(window.__stationCheck)'))
        await pg.evaluate("window.__qaRes = null; window.__qa.walkLoop({ timeoutMs: 1500000, waitEnd: true }).then(r => window.__qaRes = r)")  # the Deployer contract
        print('start', await pg.evaluate("JSON.stringify(__fold.qa.status())"))
        t0 = time.time(); seen = None; shot = set()
        while time.time() - t0 < 1500:
            st = json.loads(await pg.evaluate('JSON.stringify(__fold.qa.status())'))
            key = (st['leg'], tuple(st['visited']), st['state'])
            if key != seen: print(f"{time.time()-t0:6.1f}s", st); seen = key
            if st['state'] == 'pull' and 'pull' not in shot:
                await pg.wait_for_timeout(5000); await pg.screenshot(path=f'{pre}_pull.png', timeout=240000); shot.add('pull')
            if st['state'] == 'end' and 'end' not in shot:
                await pg.wait_for_timeout(6000); await pg.screenshot(path=f'{pre}_end.png', timeout=240000); shot.add('end'); break
            await pg.wait_for_timeout(700)
        print('audio', await pg.evaluate('JSON.stringify(__fold.audio && __fold.audio.loaded)'))
        await pg.wait_for_function('window.__qaRes', timeout=120000)
        print('__qa.walkLoop ->', await pg.evaluate('JSON.stringify(window.__qaRes)'))
        print('__qa.progress ->', await pg.evaluate('JSON.stringify(window.__qa.progress())'))
        errs = [l for l in logs if 'GPU stall' not in l]; print('CONSOLE', len(errs)); print('\n'.join(errs[-20:]))
        await b.close()
asyncio.run(main())
