// QA: fly over Port Zarya.  ?screen=townview&hour=22&at=x,y,z&look=x,y,z
import * as THREE from 'three';
import { registerScreen, game } from '../main.js';
import { input } from '../core/input.js';
import { text, C, W, H } from '../core/ui.js';
import { buildTown, LightPool } from '../world/town.js';
import { createSky } from '../world/sky.js';
import { createSnow } from '../world/snow.js';
import { Environment } from '../world/environment.js';
import { getEnvMap } from '../core/envmap.js';

registerScreen('townview', () => {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(55, 16 / 9, 0.3, 6000);
  let town = null, env, sky, snow, pool, progress = 0, yaw = 0, pitch = -0.2;
  const pos = new THREE.Vector3(0, 60, 260);
  return {
    heavy: true,
    async enter(p) {
      game.renderer.setPost({ exposure: 1.05, bloomStrength: 0.45, vignette: 0.55 }, true);
      sky = createSky();
      scene.add(sky.mesh);
      env = new Environment(scene, sky, { hour: +(p.hour ?? 22) });
      scene.environment = getEnvMap(game.renderer.gl, 'night');
      scene.environmentIntensity = 0.25;
      snow = createSnow({ count: 6000, box: 70, height: 40 });
      scene.add(snow.points);
      if (p.at) { const [x, y, z] = p.at.split(',').map(Number); pos.set(x, y, z); }
      if (p.look) {
        const [x, y, z] = p.look.split(',').map(Number);
        const d = new THREE.Vector3(x, y, z).sub(pos);
        yaw = Math.atan2(-d.x, -d.z); pitch = Math.atan2(d.y, Math.hypot(d.x, d.z));
      } else { yaw = 0; pitch = -0.25; }
      town = await buildTown({ onProgress: (k) => { progress = k; } });
      scene.add(town.root);
      pool = new LightPool(scene, town.lightSources, 12);
      input.wantPointerLock = true;
    },
    exit() { input.wantPointerLock = false; input.releasePointer(); },
    update(dt) {
      if (!town) return;
      yaw -= input.mouseLook.dx * 0.003 + input.look.x * dt * 1.5;
      pitch -= input.mouseLook.dy * 0.003 + input.look.y * dt * 1.2;
      pitch = Math.max(-1.5, Math.min(1.5, pitch));
      const sp = (input.sprint ? 80 : 20) * dt;
      const fwd = new THREE.Vector3(-Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), -Math.cos(yaw) * Math.cos(pitch));
      const right = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw));
      pos.addScaledVector(fwd, input.move.y * sp).addScaledVector(right, input.move.x * sp);
      if (input.keys.has('KeyQ')) pos.y -= sp;
      if (input.keys.has('KeyE')) pos.y += sp;
      camera.position.copy(pos);
      camera.quaternion.setFromEuler(new THREE.Euler(pitch, yaw, 0, 'YXZ'));
      const r = env.update(dt, new THREE.Vector3(pos.x, 0, pos.z), camera);
      game.renderer.tweakPost({ exposure: env.exposure });
      snow.update(dt, camera, game.renderer.targets.h);
      pool.update(dt, pos, r.night);
      for (const it of town.interiors) it.group.visible = Math.hypot(pos.x - it.x, pos.z - it.z) < it.r;
    },
    draw(ctx) {
      if (!town) {
        text(ctx, 'BUILDING PORT ZARYA…', W / 2, H / 2, { size: 22, weight: 800, color: '#fff', align: 'center', spacing: 4 });
        ctx.fillStyle = 'rgba(255,255,255,0.15)'; ctx.fillRect(W / 2 - 200, H / 2 + 20, 400, 4);
        ctx.fillStyle = C.accent; ctx.fillRect(W / 2 - 200, H / 2 + 20, 400 * progress, 4);
        return;
      }
      text(ctx, `${env.clockString()}  ·  ${pos.x.toFixed(0)}, ${pos.y.toFixed(0)}, ${pos.z.toFixed(0)}  ·  ${game.fps ? game.fps.toFixed(0) : '--'} fps`, 24, 700, { size: 13, color: C.dim });
    },
    view() { return town ? { scene, camera } : null; },
  };
});
