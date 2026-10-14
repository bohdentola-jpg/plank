// Dev: car model inspector.  ?screen=carlab&car=lancet&ang=0.7&dist=6.5&h=1.4&env=studio&look={json}
import * as THREE from 'three';
import { registerScreen, game } from '../main.js';
import { CARS, CAR_BY_ID } from '../car/cars.js';
import { buildCarModel } from '../car/model.js';
import { getEnvMap } from '../core/envmap.js';
import { input } from '../core/input.js';
import { C, vText, text } from '../core/ui.js';

registerScreen('carlab', () => {
  const q = game.query;
  const scene = new THREE.Scene();
  const envName = q.get('env') || 'studio';
  scene.environment = getEnvMap(game.renderer.gl, envName);
  scene.background = new THREE.Color(envName === 'day' ? 0x8fb2d8 : 0x0c0d10);
  const camera = new THREE.PerspectiveCamera(Number(q.get('fov') || 38), 4 / 3, 0.1, 200);
  scene.add(new THREE.HemisphereLight(0xbfd4ff, 0x202020, 0.5));
  const key = new THREE.DirectionalLight(0xffffff, 1.6);
  key.position.set(4, 8, 5);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.camera.left = -5; key.shadow.camera.right = 5; key.shadow.camera.top = 5; key.shadow.camera.bottom = -5;
  scene.add(key);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), new THREE.MeshStandardMaterial({ color: 0x2a2b2e, roughness: 0.55, metalness: 0.0 }));
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);

  let idx = Math.max(0, CARS.findIndex((c) => c.id === (q.get('car') || 'lancet')));
  let model = null;
  let look = {};
  try { look = JSON.parse(q.get('look') || '{}'); } catch { /* */ }
  const build = () => {
    if (model) { scene.remove(model.group); model.dispose(); }
    model = buildCarModel(CARS[idx], look, { hiRes: true });
    scene.add(model.group);
    model.setLights(Number(q.get('lights') || 0), 0.3, Number(q.get('brake') || 0));
  };
  build();

  let ang = Number(q.get('ang') ?? 0.7);
  let dist = Number(q.get('dist') ?? 6.5);
  let h = Number(q.get('h') ?? 1.4);
  // QA hook for contact sheets
  window.__carlab = {
    set(id, a, d, hh, lk) {
      idx = Math.max(0, CARS.findIndex((c) => c.id === id));
      if (lk) look = lk;
      build();
      if (a !== undefined) ang = a;
      if (d !== undefined) dist = d;
      if (hh !== undefined) h = hh;
    },
    ids: CARS.map((c) => c.id),
  };
  const spinOn = q.get('spin') === '1';
  return {
    view: () => ({ scene, camera }),
    update(dt) {
      if (input.pressed('tabR')) { idx = (idx + 1) % CARS.length; build(); }
      if (input.pressed('tabL')) { idx = (idx + CARS.length - 1) % CARS.length; build(); }
      ang += input.steer * dt * 1.5 + (spinOn ? dt * 0.4 : 0);
      if (input.keys.has('ArrowUp')) h += dt;
      if (input.keys.has('ArrowDown')) h -= dt;
      camera.position.set(Math.sin(ang) * dist, h, Math.cos(ang) * dist);
      camera.lookAt(0, 0.55, 0);
      model.animate(dt, 0, Number(q.get('steer') || 0));
    },
    draw(ctx) {
      const c = CARS[idx];
      vText(ctx, `${c.make} ${c.model}`, 40, 60, 26, { color: C.text });
      text(ctx, `${idx + 1}/${CARS.length}  Q/E switch · arrows orbit`, 40, 86, { size: 14, color: C.dim });
    },
  };
});
