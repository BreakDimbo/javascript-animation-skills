# m-loop: CPU profile of the boot (until __fold.ready), top self-time functions by file
import asyncio, json, collections
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--disable-gpu', '--enable-unsafe-swiftshader'])
        pg = await b.new_page(viewport={'width': 1440, 'height': 900})
        c = await pg.context.new_cdp_session(pg)
        await c.send('Profiler.enable'); await c.send('Profiler.setSamplingInterval', {'interval': 2000}); await c.send('Profiler.start')
        await pg.goto('http://127.0.0.1:8893/game/index.html?nointro', wait_until='commit')
        await pg.wait_for_function('window.__fold && window.__fold.ready', timeout=300000)
        prof = (await c.send('Profiler.stop'))['profile']
        nodes = {n['id']: n for n in prof['nodes']}; dt = collections.Counter(); df = collections.Counter()
        ts = prof['timeDeltas']; 
        for sid, d in zip(prof['samples'], ts):
            cf = nodes[sid]['callFrame']; k = f"{cf['functionName'] or '(anon)'} {cf['url'].split('/')[-1]}:{cf['lineNumber']}"; dt[k] += d; df[cf['url'].split('/')[-1] or cf['functionName']] += d
        print('by file (ms):'); [print(f'  {v/1000:8.0f} {k}') for k, v in df.most_common(15)]
        print('by fn (ms):'); [print(f'  {v/1000:8.0f} {k}') for k, v in dt.most_common(25)]
        print('boot:', await pg.evaluate("(window.__fold.mods||[]).join(' | ')"))
        await b.close()
asyncio.run(main())
