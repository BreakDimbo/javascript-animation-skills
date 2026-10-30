// the list of regions + queries over it. A region is:
// { id, no, name, dir, cardRadius, activeRadius, scale, group, heightAt(dir)|null, blocked(dir)|null, update(dt, ctx), setActive(on),
//   teleport: { u, v, lookAt }, avoid? }
// heightAt / blocked take a UNIT direction and return 0 / false outside the region's own footprint, so they never depend on activation.
import * as THREE from '../../shared/vendor/three.module.js';
import { R } from '../core/util.js';
import { F } from '../world.js';

export const REGIONS = [];
const HYST = 1.1; // a region switches off only once it is 10 % beyond its activeRadius
const _d = new THREE.Vector3();

export const register = (r) => { if (r) REGIONS.push(r); return r; };
export const byId = (id) => REGIONS.find(r => r.id === id) || null;
const dist = (a, b) => a.angleTo(b) * R;

// the region whose card applies at `up` (smallest cardRadius wins: the seal bay lies inside the meadow's frame)
export const regionAt = (up) => REGIONS.filter(r => dist(up, r.dir) < r.cardRadius).sort((a, b) => a.cardRadius - b.cardRadius)[0] || null;
// regions currently switched on by updateActivation (before its first call: those within activeRadius + 10 % of `up`)
export const activeRegions = (up) => REGIONS.filter(r => r._on ?? dist(up, r.dir) < r.activeRadius * HYST);
export function heightAt(dir){ const d = _d.copy(dir).normalize(); let h = 0; for (const r of REGIONS) if (r.heightAt) h += r.heightAt(d); return h; }
export const blocked = (dir) => REGIONS.some(r => r.blocked && r.blocked(dir));
export const avoidList = () => REGIONS.flatMap(r => r.avoid || []);

// distance activation. Walking: measured from the cat. Zoomed out (planet = 0..1 board→planet blend)
// the reach grows with `planet`, measured from the camera target.
export function updateActivation(ref, planet = 0){
  const k = 1 + 3 * planet;
  for (const r of REGIONS){
    const d = dist(ref, r.dir), on = r._on === undefined ? d < r.activeRadius * k : r._on ? d < r.activeRadius * k * HYST : d < r.activeRadius * k;
    if (on !== r._on){ r._on = on; r.setActive(on); }
  }
}

// ?at=<id> | ?at=u,v → { u, v, lookAt } or null
export function teleportFor(tp){
  if (!tp) return null;
  const r = byId(tp); if (r) return r.teleport;
  const [u, v] = tp.split(',').map(Number); return Number.isFinite(u) && Number.isFinite(v) ? { u, v, lookAt: null } : null;
}
export const teleportDir = (t) => F.dirOf(t.u, t.v);
