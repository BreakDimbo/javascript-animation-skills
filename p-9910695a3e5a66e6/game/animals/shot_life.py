# headless before/after driver for the 'life' reactions.
# usage: python3 shot_life.py <at> <outprefix> <script.json>   script = [{"wait":ms}|{"shot":"name"}|{"js":"..."}|{"run":[du,dv,secs,speed]}]
import sys, json, asyncio
from playwright.async_api import async_playwright
at, pre, steps = sys.argv[1], sys.argv[2], json.loads(open(sys.argv[3]).read())
PORT = 8871
# board-(u,v) cat driver: tp(u,v) teleports; go(u,v,speed) steers the real cat (fwd + speed) each frame until it arrives
DRIVE = '''(() => { const f = __fold, c = f.cat, F = f.F, R = c.R; const st = window.__drv = { on: false, T: 0, last: performance.now() };
  window.tp = (u, v) => { const d = F.dirOf(u, v); c.up.copy(d); c.pos.copy(d).multiplyScalar(R); c.root.position.copy(d).multiplyScalar(R + f.heightAt(d)); c.speed = 0; st.on = false; return 'tp'; };
  window.uv = () => F.toUV(c.up).map(x => +x.toFixed(2));
  window.go = (u, v, sp) => { Object.assign(st, { on: true, u, v, sp }); return 'go'; };
  const tick = () => { const now = performance.now(); st.T += Math.min((now - st.last) / 1000, .05); st.last = now; if (st.on){ const [cu, cv] = F.toUV(c.up), du = st.u - cu, dv = st.v - cv, dd = Math.hypot(du, dv);
      if (dd < .12) st.on = false; else { const a = F.dirOf(cu + du / dd * .05, cv + dv / dd * .05).sub(c.up); a.addScaledVector(c.up, -a.dot(c.up)).normalize(); c.fwd.copy(a); c.speed = st.sp; } }
    requestAnimationFrame(tick); }; tick();
  // deterministic stepping (headless swiftshader renders at < 1 fps): move the cat and update one region at 30 Hz, synchronously
  window.simR = (id, secs) => { const r = f.REGIONS.find(q => q.id === id), dt = 1 / 30, ctx = (r.life && r.life.ctx) || (st.ctx || (st.ctx = { cat: c, T: 0, fcam: { camera: f.camera } }));
    for (let k = 0; k < secs * 30; k++){
      if (st.on){ const [cu, cv] = F.toUV(c.up), du = st.u - cu, dv = st.v - cv, dd = Math.hypot(du, dv);
        if (dd < .1) { st.on = false; c.speed = 0; } else { const s = Math.min(dd, st.sp * dt), nu = cu + du / dd * s, nv = cv + dv / dd * s, d = F.dirOf(nu, nv);
          const a = F.dirOf(cu + du / dd * .05, cv + dv / dd * .05).sub(d); a.addScaledVector(d, -a.dot(d)).normalize(); c.fwd.copy(a); c.up.copy(d); c.pos.copy(d).multiplyScalar(R); c.speed = st.sp; } }
      else c.speed = 0;
      c.root.position.copy(c.up).multiplyScalar(R + f.heightAt(c.up));
      ctx.T = (ctx.T || 0) + dt; r.update(dt, ctx); }
    return 'sim ' + id + ' ' + secs; };
  const cam = f.camera, prev = f.renderer.render;
  f.renderer.render = (a, b) => { if (st.lock){ cam.position.copy(st.lock.p); cam.quaternion.copy(st.lock.q); cam.updateMatrixWorld(true); } return prev(a, b); };
  window.lockCam = () => { st.lock = { p: cam.position.clone(), q: cam.quaternion.clone() }; return 'locked'; };
  // r2 measuring: projected pixel boxes of an Object3D (mesh bounding boxes) or of a flock sprite entry
  const V3 = c.root.position.constructor;
  window.bbpx = (o) => { o.updateMatrixWorld(true); let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; const W = innerWidth, H = innerHeight;
    o.traverse(q => { if (!q.isMesh || !q.visible) return; if (!q.geometry.boundingBox) q.geometry.computeBoundingBox(); const b = q.geometry.boundingBox;
      for (let i = 0; i < 8; i++){ const p = new V3(i & 1 ? b.max.x : b.min.x, i & 2 ? b.max.y : b.min.y, i & 4 ? b.max.z : b.min.z).applyMatrix4(q.matrixWorld).project(f.camera);
        const X = (p.x + 1) / 2 * W, Y = (1 - p.y) / 2 * H; x0 = Math.min(x0, X); x1 = Math.max(x1, X); y0 = Math.min(y0, Y); y1 = Math.max(y1, Y); } });
    const wp = new V3().setFromMatrixPosition(o.matrixWorld); return [x0, y0, x1, y1].map(v => Math.round(v)).concat([+wp.distanceTo(f.camera.position).toFixed(3)]); };
  window.sppx = (L) => { const W = innerWidth, H = innerHeight, R = f.cat.R, rt = new V3().setFromMatrixColumn(f.camera.matrixWorld, 0).normalize(); let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    for (const [sx, sy] of [[-1, 0], [1, 0], [-1, 1], [1, 1]]){ const p = L.dir.clone().multiplyScalar(R + L.h).addScaledVector(rt, sx * .42 * L.scale).addScaledVector(L.dir, sy * .78 * L.scale).project(f.camera);
      const X = (p.x + 1) / 2 * W, Y = (1 - p.y) / 2 * H; x0 = Math.min(x0, X); x1 = Math.max(x1, X); y0 = Math.min(y0, Y); y1 = Math.max(y1, Y); }
    return [x0, y0, x1, y1].map(v => Math.round(v)).concat([+L.dir.clone().multiplyScalar(R + L.h).distanceTo(f.camera.position).toFixed(3)]); };
  return 'drive ok'; })()'''
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--disable-gpu', '--enable-unsafe-swiftshader'])
        pg = await b.new_page(viewport={'width': 1440, 'height': 900}, device_scale_factor=1)  # a {'viewport':[390,844]} step switches to the phone frame
        logs = []
        pg.on('console', lambda m: logs.append(m.type + ': ' + m.text))
        pg.on('pageerror', lambda e: logs.append('ERR ' + str(e)))
        await pg.goto(f'http://127.0.0.1:{PORT}/game/index.html?at={at}', wait_until='commit', timeout=120000)
        await pg.wait_for_function('window.__fold && window.__fold.ready', timeout=300000)
        await pg.wait_for_timeout(4000)
        await pg.evaluate(DRIVE)
        for s in steps:
            if 'sim' in s:
                t0 = await pg.evaluate('__drv.T'); await pg.wait_for_function(f'__drv.T > {t0 + s["sim"]}', timeout=600000, polling=250)
            if 'until' in s: await pg.wait_for_function(s['until'], timeout=240000, polling=200)
            if 'viewport' in s: await pg.set_viewport_size({'width': s['viewport'][0], 'height': s['viewport'][1]})
            if 'wait' in s: await pg.wait_for_timeout(s['wait'])
            if 'js' in s: print('js>', await pg.evaluate(s['js']))
            if 'shot' in s: await pg.screenshot(path=f'{pre}_{s["shot"]}.png', timeout=240000); print('shot', s['shot'])
        errs = [l for l in logs if l.startswith('error') or l.startswith('ERR')]
        print('ERRORS', len(errs)); print('\n'.join(errs[:10])); print('WARN', [l for l in logs if l.startswith('warn')][:8])
        await b.close()
asyncio.run(main())
