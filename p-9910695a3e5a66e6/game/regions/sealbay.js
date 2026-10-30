// 07 Seal Bay — thin wrapper around game/sealbay/* (loaded lazily so a failure there never stops the game)
import { R, qs, note, safe } from '../core/util.js';
import { REG, F } from '../world.js';

export async function createSealbayRegion(scene){
  const SBR = REG.find(r => r.no === '07');
  if (!SBR || qs.has('nosealbay')) return null;
  const sb = await import('../sealbay/sealbay.js').then(m => safe('sealbay', () => m.createSealBay(scene, { R, origin: SBR.dir })),
    e => (note('sealbay × ' + e.message), null));
  if (!sb) return null;
  window.__sealbay = sb;
  // ?at=sealbay[&sbx=m&sby=m] spawns on its shore; the default heading already looks out over the water
  const [u, v] = F.toUV(sb.dirAt(+(qs.get('sbx') ?? 0), +(qs.get('sby') ?? 0)));
  return { id: 'sealbay', no: SBR.no, name: SBR.name, dir: SBR.dir, cardRadius: SBR.rad, activeRadius: 70, scale: 1, group: sb.group, module: sb,
    avoid: sb.avoid,
    heightAt: null, blocked: (d) => sb.blocked(d),
    update(dt, { cat }){ safe('sealbay-up', () => sb.update(cat)); },
    setActive(on){ sb.group.visible = on; },
    teleport: { u, v, lookAt: null } };
}
