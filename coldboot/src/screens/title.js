// Title: blue hour over the frozen Bering Strait. Port Zarya's windows on the
// far shore, one store far too bright for the town, the Dome's beacon on
// Kettle Hill, snow drifting past a slow push-in. A film-poster title; the
// first key press (which also unlocks audio) brings up the menu.
import * as THREE from 'three';
import { registerScreen, game, go } from '../main.js';
import { input } from '../core/input.js';
import { C, W, H, text, hints, vText, hit } from '../core/ui.js';
import { createSky } from '../world/sky.js';
import { createSnow } from '../world/snow.js';
import { hasSave as saveExists } from '../game/state.js';
import { sfx } from '../audio/sfx.js';
import { music } from '../audio/music.js';
import { audio } from '../audio/audio.js';
import { makeNoise2D, clamp, easeOutCubic } from '../core/util.js';

const MENU = [
  { id: 'continue', label: 'Continue', desc: 'Pick up where you left off.' },
  { id: 'new', label: 'New game', desc: 'One town, one code, five days. Save the world — quietly.' },
  { id: 'options', label: 'Options', desc: 'Picture, sound, controls.' },
  { id: 'credits', label: 'Credits', desc: 'Who made this, and with what.' },
];

function buildScene() {
  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x1a222c, 0.0011);
  const camera = new THREE.PerspectiveCamera(38, 16 / 9, 0.5, 4000);
  camera.position.set(0, 7, 70);
  camera.lookAt(0, 20, -300);

  const sky = createSky();
  const u = sky.uniforms;
  u.zenith.value.setRGB(0.018, 0.03, 0.055);
  u.horizon.value.setRGB(0.16, 0.19, 0.24);
  u.ground.value.setRGB(0.03, 0.035, 0.045);
  u.sunDir.value.set(0.55, -0.06, -0.83).normalize();
  u.sunColor.value.setRGB(1.0, 0.6, 0.42);
  u.sunAmt.value = 0.35;
  u.starAmt.value = 0.25;
  u.moonAmt.value = 0.4;
  u.aurora.value = 0.22;
  u.auroraA.value.setRGB(0.12, 0.55, 0.38);
  u.auroraB.value.setRGB(0.1, 0.38, 0.42);
  u.cloud.value = 0.6;
  u.cloudColor.value.setRGB(0.09, 0.1, 0.12);
  scene.add(sky.mesh);

  // frozen sea, wind-scoured
  const noise = makeNoise2D(7);
  const seaG = new THREE.PlaneGeometry(4000, 4000, 160, 160);
  seaG.rotateX(-Math.PI / 2);
  const p = seaG.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), z = p.getZ(i);
    p.setY(i, noise.fbm(x * 0.01, z * 0.01, 3) * 0.8 + Math.max(0, noise.ridged(x * 0.004, z * 0.004, 3) - 0.55) * 3);
  }
  seaG.computeVertexNormals();
  const ice = new THREE.Mesh(seaG, new THREE.MeshStandardMaterial({ color: 0x7b8794, roughness: 0.78, metalness: 0.0 }));
  scene.add(ice);

  // hills on the far shore
  const hillG = new THREE.PlaneGeometry(3000, 400, 200, 30);
  const hp = hillG.attributes.position;
  for (let i = 0; i < hp.count; i++) {
    const x = hp.getX(i), y = hp.getY(i);
    const t = (y + 200) / 400;
    const ridge = 60 + noise.ridged(x * 0.004, 3.3, 4) * 120 + noise.fbm(x * 0.02, 1.7, 3) * 18;
    hp.setY(i, t * ridge);
    hp.setZ(i, -t * 60);
  }
  hillG.computeVertexNormals();
  const hills = new THREE.Mesh(hillG, new THREE.MeshStandardMaterial({ color: 0x8a96a3, roughness: 0.95 }));
  hills.position.set(0, -4, -700);
  scene.add(hills);

  // the Dome on Kettle Hill and its beacon
  const dome = new THREE.Mesh(new THREE.SphereGeometry(14, 32, 16, 0, Math.PI * 2, 0, Math.PI * 0.6),
    new THREE.MeshStandardMaterial({ color: 0xc9d1d8, roughness: 0.5 }));
  dome.position.set(180, 118, -720);
  scene.add(dome);
  const tower = new THREE.Mesh(new THREE.CylinderGeometry(9, 10, 14, 24), new THREE.MeshStandardMaterial({ color: 0x5d656e, roughness: 0.8 }));
  tower.position.set(180, 107, -720);
  scene.add(tower);
  const beacon = new THREE.Mesh(new THREE.SphereGeometry(1.1, 12, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(14, 1, 1) }));
  beacon.position.set(180, 134, -720);
  scene.add(beacon);

  // Port Zarya's windows: warm, few, low
  const winG = new THREE.BufferGeometry();
  const wp = [];
  for (let i = 0; i < 110; i++) wp.push(-260 + Math.random() * 380, 2 + Math.random() * 10 + (Math.random() < 0.08 ? 14 : 0), -560 - Math.random() * 90);
  winG.setAttribute('position', new THREE.Float32BufferAttribute(wp, 3));
  const wins = new THREE.Points(winG, new THREE.PointsMaterial({ color: new THREE.Color(3.2, 1.7, 0.7), size: 1.6, sizeAttenuation: true }));
  scene.add(wins);
  // …and the one store that's far too bright for this town
  const store_ = new THREE.Mesh(new THREE.PlaneGeometry(8, 1.6), new THREE.MeshBasicMaterial({ color: new THREE.Color(3.6, 4.2, 4.8) }));
  store_.position.set(-40, 7, -560);
  scene.add(store_);

  scene.add(new THREE.HemisphereLight(0x8aa0b8, 0x1a1e24, 2.0));
  const sun = new THREE.DirectionalLight(0xffc8a0, 1.2);
  sun.position.set(300, 40, -500);
  scene.add(sun);

  const snow = createSnow({ count: 2600, box: 70, height: 40 });
  scene.add(snow.points);
  return { scene, camera, sky, snow, beacon };
}

registerScreen('title', () => {
  let world = null;
  let t = 0;
  let phase = 'press';
  let sel = 0;
  let menuT = 0;
  const hasSave = saveExists();
  const items = MENU.filter((m) => m.id !== 'continue' || hasSave);
  return {
    heavy: false,
    enter(params) {
      world = buildScene();
      const unlocked = audio.ctx && audio.ctx.state === 'running';
      phase = params.intro || !unlocked ? 'press' : 'menu';
      if (phase === 'menu') { t = 4; menuT = 1; }
      game.renderer.sceneOn = true;
      game.renderer.setPost({
        exposure: 1.0, bloomStrength: 0.45, vignette: 0.5, saturation: 0.82, contrast: 1.06,
        lift: [0.004, 0.008, 0.016], grain: 0.03,
      }, true);
      sel = 0;
      try { music.play('cb_title', { fade: 3 }); } catch { /* */ }
    },
    exit() {
      world?.scene.traverse((o) => { o.geometry?.dispose?.(); o.material?.dispose?.(); });
    },
    update(dt) {
      t += dt;
      world.sky.update(dt, world.camera);
      world.snow.update(dt, world.camera, game.renderer.targets.h);
      world.beacon.material.color.setRGB(Math.sin(t * 2.2) > 0.75 ? 14 : 0.3, 0.2, 0.2);
      const cam = world.camera;
      const push = Math.min(1, t / 60);
      cam.position.set(Math.sin(t * 0.025) * 5, 7 + Math.sin(t * 0.04) * 0.8, 70 - push * 22);
      cam.lookAt(cam.position.x * 0.3, 20, -300);
      // fade up from black
      game.fx.fade = phase === 'press' ? Math.max(0, 1 - t / 2.5) : game.fx.fade;

      if (phase === 'press') {
        if (t > 1.2 && (input.pressed('any') || input.takeClick())) {
          audio.unlock();
          try { music.play('cb_title', { fade: 2 }); } catch { /* */ }
          sfx.ui?.('select');
          phase = 'menu';
          menuT = 0;
          game.fx.fade = 0;
          input.consume?.('confirm');
        }
        return;
      }
      menuT = Math.min(1, menuT + dt * 2.2);
      if (input.pressed('up')) { sel = (sel + items.length - 1) % items.length; sfx.ui?.('move'); }
      if (input.pressed('down')) { sel = (sel + 1) % items.length; sfx.ui?.('move'); }
      if (hit.hover && hit.hover.startsWith('menu:')) {
        const i = +hit.hover.slice(5);
        if (i !== sel) { sel = i; sfx.ui?.('move'); }
      }
      const click = input.takeClick() && hit.hover && hit.hover.startsWith('menu:');
      if ((input.pressed('confirm') || click) && menuT > 0.5) {
        const id = items[sel].id;
        sfx.ui?.('select');
        if (id === 'new') go('creator', {});
        else if (id === 'continue') go('town', { load: true });
        else if (id === 'options') go('options', { from: 'title' });
        else if (id === 'credits') go('credits', { from: 'title' });
      }
    },
    draw(ctx) {
      // a soft dark gradient on the left so type reads over the sky
      const g = ctx.createLinearGradient(0, 0, W * 0.6, 0);
      g.addColorStop(0, 'rgba(4,6,9,0.55)');
      g.addColorStop(1, 'rgba(4,6,9,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);

      const k = easeOutCubic(clamp((t - 1.0) / 2.2, 0, 1));
      const x = 96, y = 300;
      ctx.save();
      ctx.globalAlpha = k;
      vText(ctx, 'Cold Boot', x, y, 64, { weight: 0.12, spacing: 14, color: '#f2f4f6' });
      text(ctx, 'ХОЛОДНЫЙ  ПУСК', x + 3, y + 40, { size: 15, weight: 500, color: C.dim, spacing: 7 });
      ctx.fillStyle = C.accent;
      ctx.fillRect(x + 3, y + 62, 36, 2);
      text(ctx, 'Save the world. Quietly.', x + 3, y + 92, { size: 17, weight: 400, color: '#c9cfd5' });
      ctx.restore();

      if (phase === 'press') {
        if (t > 2.2) {
          const a = 0.55 + 0.45 * Math.sin((t - 2.2) * 2.4);
          text(ctx, input.padConnected ? 'Press any button' : 'Press any key', W / 2, H - 92, { size: 16, weight: 500, color: '#fff', align: 'center', alpha: Math.min(1, (t - 2.2) * 1.5) * a, spacing: 3 });
          text(ctx, 'Headphones recommended  ·  Russian dialogue with English subtitles', W / 2, H - 48, { size: 13, weight: 400, color: C.faint, align: 'center', alpha: Math.min(1, (t - 2.2)) });
        }
        return;
      }

      // menu
      const my = y + 168;
      const a = easeOutCubic(menuT);
      ctx.save();
      ctx.globalAlpha = a;
      items.forEach((m, i) => {
        const yy = my + i * 44;
        const on = i === sel;
        hit.add('menu:' + i, x - 16, yy - 28, 320, 40);
        if (on) {
          ctx.fillStyle = C.accent;
          ctx.fillRect(x - 16, yy - 19, 3, 24);
        }
        text(ctx, m.label, x + (on ? 4 : 0) * a, yy, { size: 22, weight: on ? 600 : 400, color: on ? '#fff' : 'rgba(225,230,235,0.55)' });
      });
      const d = items[sel].desc;
      text(ctx, d, x, my + items.length * 44 + 22, { size: 14, weight: 400, color: C.dim });
      ctx.restore();
      hints(ctx, [['ud', 'Select'], ['confirm', 'OK']]);
      // build stamp, bottom-left
      text(ctx, 'Port Zarya, Alaska  ·  Bely Mys, Chukotka', x, H - 40, { size: 12, weight: 400, color: C.faint, spacing: 1 });
    },
    view() { return world ? { scene: world.scene, camera: world.camera } : null; },
  };
});
