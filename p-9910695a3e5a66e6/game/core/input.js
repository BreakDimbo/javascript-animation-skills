// keyboard, demo walk and the minimal touch stick (left half of the screen)
import * as THREE from '../../shared/vendor/three.module.js';
import { qs } from './util.js';

export function createInput(){
  const keys = {}, edge = {};
  addEventListener('keydown', e => { if (!keys[e.code]) edge[e.code] = true; keys[e.code] = true; });
  addEventListener('keyup', e => { keys[e.code] = false; });
  const demo = qs.get('demo');
  const touch = { on: false, x: 0, y: 0, ox: 0, oy: 0, id: null };
  const C = THREE.MathUtils.clamp, P = { passive: true };
  addEventListener('touchstart', e => {
    for (const t of e.changedTouches) if (t.clientX < innerWidth / 2 && touch.id === null){
      touch.id = t.identifier; touch.on = true; touch.ox = t.clientX; touch.oy = t.clientY; } }, P);
  addEventListener('touchmove', e => {
    for (const t of e.changedTouches) if (t.identifier === touch.id){
      touch.x = C((t.clientX - touch.ox) / 50, -1, 1); touch.y = C((t.clientY - touch.oy) / 50, -1, 1); } }, P);
  addEventListener('touchend', e => {
    for (const t of e.changedTouches) if (t.identifier === touch.id){ touch.id = null; touch.on = false; touch.x = touch.y = 0; } }, P);
  function read(T){
    const inp = { x: (keys.KeyD || keys.ArrowRight ? 1 : 0) - (keys.KeyA || keys.ArrowLeft ? 1 : 0),
      y: (keys.KeyW || keys.ArrowUp ? 1 : 0) - (keys.KeyS || keys.ArrowDown ? 1 : 0),
      sprint: !!(keys.ShiftLeft || keys.ShiftRight), jump: !!edge.Space, sit: !!edge.KeyC, sleep: !!edge.KeyZ };
    if (demo === 'walk') { inp.y = 1; inp.x = Math.sin(T * 0.3) * 0.2; }
    if (touch.on) { inp.x = touch.x; inp.y = -touch.y; inp.sprint = Math.hypot(touch.x, touch.y) > .9; }
    for (const k in edge) edge[k] = false; return inp;
  }
  return { read, touch, keys };
}
