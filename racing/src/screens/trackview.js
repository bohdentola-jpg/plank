// Dev: a track's course where it runs in Port Halcyon (no cars), the camera
// parked on its line, race dressing up.
//   ?screen=trackview&track=downtown&s=300&h=3&lat=0&look=40&yaw=0&time=night
// QA hook: window.__trackview.set(s, h, lat, look, yaw) then screenshot.
import * as THREE from 'three';
import { registerScreen, game } from '../main.js';
import { TRACK_BY_ID, TRACKS } from '../track/tracks.js';
import { Track } from '../track/track.js';
import { worldData } from '../world/data.js';
import { WorldScene } from '../world/scene.js';
import { courseFor, courseWalls } from '../world/course.js';
import { buildDressing } from '../world/racedress.js';
import { C, vText, text } from '../core/ui.js';

registerScreen('trackview', () => {
  let world = null, T = null, def = null;
  const camera = new THREE.PerspectiveCamera(64, 4 / 3, 0.3, 3200);
  const q = game.query;
  const cfg = { s: Number(q.get('s') || 60), h: Number(q.get('h') || 2.2), lat: Number(q.get('lat') || 0), look: Number(q.get('look') || 40), yaw: Number(q.get('yaw') || 0), auto: q.get('auto') === '1' };
  let label = 'LOADING';
  const place = () => {
    if (!T) return;
    const p = T.posAt(cfg.s, cfg.lat);
    const a = T.posAt(cfg.s + cfg.look, cfg.lat * 0.5);
    camera.position.set(p.x, p.y + cfg.h, p.z);
    if (cfg.yaw) {
      const dx = a.x - p.x, dz = a.z - p.z;
      const c = Math.cos(cfg.yaw), s = Math.sin(cfg.yaw);
      camera.lookAt(p.x + dx * c + dz * s, a.y + cfg.h * 0.6, p.z - dx * s + dz * c);
    } else camera.lookAt(a.x, a.y + cfg.h * 0.6, a.z);
  };
  return {
    async enter(params) {
      def = TRACK_BY_ID[params.track] || TRACKS[0];
      const D = worldData();
      if (!D.districts.planned) for (const _ of D.districts.planAll()) void _;
      T = new Track(def);
      courseWalls(T, courseFor(def.id));
      world = new WorldScene({ net: D.net, terrain: D.terrain, districts: D.districts, wet: def.weather !== 'dry' }, game.renderer.gl, { time: q.get('time') || def.time || 'night' });
      world.live = false;
      label = 'SURVEYING';
      await world.buildFar((f, l) => { label = l; });
      await world.warm(camera);
      world.scene.add(buildDressing(courseFor(def.id), T, { id: def.id }));
      const p = T.posAt(cfg.s);
      await world.ensureAsync(p.x, p.z, 400, (f) => { label = `PAVING ${Math.round(f * 100)}%`; }, 60);
      game.renderer.setPost(world.at.post || {}, true);
      place();
      world.live = true;
      label = 'READY';
      window.__trackview = { set(s, h, lat, look, yaw) { Object.assign(cfg, { s, h: h ?? cfg.h, lat: lat ?? 0, look: look ?? 40, yaw: yaw ?? 0 }); place(); }, length: T.length, def, world, track: T };
    },
    exit() { world?.dispose(); world = null; },
    update(dt) {
      if (!world || !T) return;
      if (cfg.auto) { cfg.s = (cfg.s + dt * 30) % T.length; place(); }
      world.update(dt, camera, [{ x: camera.position.x, z: camera.position.z, vx: 0, vz: 0 }]);
    },
    view() { return label === 'READY' ? { scene: world.scene, camera } : null; },
    draw(ctx) {
      if (label !== 'READY') {
        vText(ctx, 'PLEASE STAND BY', 512, 380, 30, { align: 'center' });
        text(ctx, label, 512, 410, { align: 'center', color: C.dim });
        return;
      }
      text(ctx, `${def.name}  s=${Math.round(cfg.s)}/${Math.round(T.length)}m`, 24, 30, { size: 14, color: C.dim });
    },
  };
});
