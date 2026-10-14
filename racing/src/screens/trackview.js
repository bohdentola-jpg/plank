// Dev: environment inspector — builds a track's world (no cars) and parks the
// camera on the centerline.  ?screen=trackview&track=downtown&s=300&h=3&lat=0&look=40&yaw=0
// QA hook: window.__trackview.set(s, h, lat, look, yaw) then screenshot.
import * as THREE from 'three';
import { registerScreen, game } from '../main.js';
import { buildWorld } from '../track/build.js';
import { TRACK_BY_ID, TRACKS } from '../track/tracks.js';
import { C, vText, text } from '../core/ui.js';

registerScreen('trackview', () => {
  let world = null;
  const camera = new THREE.PerspectiveCamera(64, 4 / 3, 0.3, 3200);
  const q = game.query;
  const cfg = { s: Number(q.get('s') || 60), h: Number(q.get('h') || 2.2), lat: Number(q.get('lat') || 0), look: Number(q.get('look') || 40), yaw: Number(q.get('yaw') || 0), auto: q.get('auto') === '1' };
  let label = 'LOADING';
  const place = () => {
    if (!world) return;
    const T = world.track;
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
      const def = TRACK_BY_ID[params.track] || TRACKS[0];
      world = await buildWorld(def, game.renderer.gl, (f, l) => { label = l; });
      game.renderer.setPost(world.at.post || {}, true);
      place();
      window.__trackview = { set(s, h, lat, look, yaw) { Object.assign(cfg, { s, h: h ?? cfg.h, lat: lat ?? 0, look: look ?? 40, yaw: yaw ?? 0 }); place(); }, length: world.track.length, def };
    },
    exit() { world?.dispose(); },
    update(dt) {
      if (!world) return;
      if (cfg.auto) { cfg.s = (cfg.s + dt * 30) % world.track.length; place(); }
      world.update(dt, camera);
    },
    view() { return world ? { scene: world.scene, camera } : null; },
    draw(ctx) {
      if (!world) { vText(ctx, 'PLEASE STAND BY', 512, 380, 30, { align: 'center' }); text(ctx, label, 512, 410, { align: 'center', color: C.dim }); return; }
      text(ctx, `${world.def.name}  s=${Math.round(cfg.s)}/${Math.round(world.track.length)}m`, 24, 30, { size: 14, color: C.dim });
    },
  };
});
