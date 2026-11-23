// Title: the TV comes on to an old computer's power-on self test that "cold
// boots" into the logo — COLD BOOT over the aurora above the Bering Strait,
// snow drifting past, the Dome's light blinking on Kettle Hill.
import * as THREE from 'three';
import { registerScreen, game, go } from '../main.js';
import { input } from '../core/input.js';
import { C, W, H, text, panel, hints, vText, hit } from '../core/ui.js';
import { createSky } from '../world/sky.js';
import { createSnow } from '../world/snow.js';
import { store } from '../core/settings.js';
import { sfx } from '../audio/sfx.js';
import { makeNoise2D, clamp, easeOutCubic } from '../core/util.js';

const POST = [
  ['NOVATRON BIOS v4.06   (C) 1998 Novatron Electronics', 0.0],
  ['', 0.15],
  ['CPU   : 486DX4-100 ........................ OK', 0.3],
  ['MEMORY: 65536K ............................ OK', 0.6],
  ['', 0.75],
  ['DETECTING LINK ... БЕЛЫЙ МЫС / BELY MYS ... OK', 1.0],
  ['TROPOSCATTER UPLINK ...................... STANDBY', 1.35],
  ['SCANNING GRID TRAFFIC ... AURORA v3.2 ..... FOUND', 1.75],
  ['  > payload signature: ПОЛЫНЬ / WORMWOOD', 2.1],
  ['  > wakes in 14 days 06:00:00', 2.35],
  ['', 2.5],
  ['ATTEMPTING COLD BOOT_', 2.7],
];

const MENU = [
  { id: 'new', label: 'NEW GAME', desc: 'Fourteen days. One town. Save the world — quietly.' },
  { id: 'continue', label: 'CONTINUE', desc: 'Pick up where you left off.' },
  { id: 'options', label: 'OPTIONS', desc: 'Picture, sound, controls.' },
  { id: 'credits', label: 'CREDITS', desc: 'Who made this.' },
];

function buildScene() {
  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x05090e, 0.0016);
  const camera = new THREE.PerspectiveCamera(42, 16 / 9, 0.5, 4000);
  camera.position.set(0, 9, 60);
  camera.lookAt(0, 22, -300);

  const sky = createSky();
  scene.add(sky.mesh);

  // frozen sea + shore ice, gently lit by the aurora
  const noise = makeNoise2D(7);
  const seaG = new THREE.PlaneGeometry(4000, 4000, 160, 160);
  seaG.rotateX(-Math.PI / 2);
  const p = seaG.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), z = p.getZ(i);
    p.setY(i, noise.fbm(x * 0.01, z * 0.01, 3) * 0.8 + (z < -900 ? 0 : 0));
  }
  seaG.computeVertexNormals();
  const ice = new THREE.Mesh(seaG, new THREE.MeshStandardMaterial({ color: 0x8fa6b8, roughness: 0.35, metalness: 0.0 }));
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
  const hills = new THREE.Mesh(hillG, new THREE.MeshStandardMaterial({ color: 0x9aaabb, roughness: 0.9 }));
  hills.position.set(0, -4, -700);
  scene.add(hills);

  // the Dome on Kettle Hill and its beacon
  const dome = new THREE.Mesh(new THREE.SphereGeometry(14, 32, 16, 0, Math.PI * 2, 0, Math.PI * 0.6),
    new THREE.MeshStandardMaterial({ color: 0xdde6ee, roughness: 0.5 }));
  dome.position.set(180, 118, -720);
  scene.add(dome);
  const tower = new THREE.Mesh(new THREE.CylinderGeometry(9, 10, 14, 24), new THREE.MeshStandardMaterial({ color: 0x6d7680, roughness: 0.8 }));
  tower.position.set(180, 107, -720);
  scene.add(tower);
  const beacon = new THREE.Mesh(new THREE.SphereGeometry(1.4, 12, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(30, 2, 2) }));
  beacon.position.set(180, 134, -720);
  scene.add(beacon);

  // a scatter of warm town windows at the shore
  const winG = new THREE.BufferGeometry();
  const wp = [];
  for (let i = 0; i < 140; i++) wp.push(-260 + Math.random() * 380, 2 + Math.random() * 14 + (Math.random() < 0.1 ? 20 : 0), -560 - Math.random() * 90);
  winG.setAttribute('position', new THREE.Float32BufferAttribute(wp, 3));
  const wins = new THREE.Points(winG, new THREE.PointsMaterial({ color: new THREE.Color(6, 3.2, 1.2), size: 2.2, sizeAttenuation: true }));
  scene.add(wins);
  // one neon store that's far too bright for this town
  const neon = new THREE.Mesh(new THREE.PlaneGeometry(9, 2.2), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.6, 6, 9) }));
  neon.position.set(-40, 8, -560);
  scene.add(neon);

  scene.add(new THREE.HemisphereLight(0x3a6a7a, 0x0a0c10, 0.6));
  const moon = new THREE.DirectionalLight(0x9fb6d8, 0.5);
  moon.position.set(-200, 300, -400);
  scene.add(moon);
  const auroraLight = new THREE.DirectionalLight(0x40ffa0, 0.35);
  auroraLight.position.set(0, 400, -600);
  scene.add(auroraLight);

  const snow = createSnow({ count: 5000, box: 70, height: 40 });
  scene.add(snow.points);
  return { scene, camera, sky, snow, beacon };
}

registerScreen('title', () => {
  let world = null;
  let t = 0;
  let phase = 'post';
  let sel = 0;
  let logoT = 0;
  const hasSave = !!store.load('save0');
  return {
    heavy: false,
    enter(params) {
      world = buildScene();
      phase = params.intro ? 'post' : 'menu';
      if (!params.intro) logoT = 3;
      game.renderer.setPost({ exposure: 1.15, bloomStrength: 0.9, vignette: 0.6, saturation: 1.05, lift: [0.0, 0.005, 0.012] }, true);
      sel = hasSave ? 1 : 0;
    },
    exit() {
      world?.scene.traverse((o) => { o.geometry?.dispose?.(); o.material?.dispose?.(); });
    },
    update(dt) {
      t += dt;
      world.sky.update(dt, world.camera);
      world.snow.update(dt, world.camera, game.renderer.targets.h);
      world.beacon.material.color.setScalar(0).r = Math.sin(t * 2.4) > 0.6 ? 30 : 0.4;
      const cam = world.camera;
      cam.position.x = Math.sin(t * 0.03) * 6;
      cam.position.y = 9 + Math.sin(t * 0.05) * 1.2;
      cam.lookAt(cam.position.x * 0.4, 24, -300);
      if (phase === 'post') {
        game.renderer.sceneOn = false;
        if (t > 3.4 || input.pressed('confirm') || input.pressed('back')) {
          phase = 'logo';
          logoT = 0;
          game.renderer.sceneOn = true;
          game.fx.staticAmt = 1;
          try { sfx.staticBurst(0.6); } catch { /* */ }
        }
        return;
      }
      game.renderer.sceneOn = true;
      logoT += dt;
      game.fx.staticAmt = Math.max(0, 1 - logoT * 1.6);
      if (phase === 'logo' && (logoT > 2.2 || input.pressed('confirm'))) { phase = 'menu'; input.consume('confirm'); }
      if (phase !== 'menu') return;
      if (input.pressed('up')) { sel = (sel + MENU.length - 1) % MENU.length; sfx.ui?.('move'); }
      if (input.pressed('down')) { sel = (sel + 1) % MENU.length; sfx.ui?.('move'); }
      if (hit.hover && hit.hover.startsWith('menu:')) sel = +hit.hover.slice(5);
      const click = input.takeClick() && hit.hover && hit.hover.startsWith('menu:');
      if (input.pressed('confirm') || click) {
        const id = MENU[sel].id;
        if (id === 'continue' && !hasSave) return;
        sfx.ui?.('select');
        if (id === 'new') go('creator', {});
        else if (id === 'continue') go('town', { load: true });
        else if (id === 'options') go('options', { from: 'title' });
        else if (id === 'credits') go('credits', { from: 'title' });
      }
    },
    draw(ctx) {
      if (phase === 'post') {
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, W, H);
        ctx.save();
        ctx.font = '600 22px "Consolas", "Lucida Console", "DejaVu Sans Mono", monospace';
        ctx.fillStyle = '#b8c4b0';
        let y = 90;
        for (const [line, at] of POST) {
          if (t < at) break;
          const shown = line.slice(0, Math.floor((t - at) * 90));
          ctx.fillStyle = /ПОЛЫНЬ|WORMWOOD|FOUND/.test(line) ? '#ff6a5a' : '#b8c4b0';
          ctx.fillText(shown + (line.endsWith('_') && Math.floor(t * 3) % 2 ? '' : ''), 80, y);
          y += 34;
        }
        ctx.restore();
        return;
      }
      // logo
      const k = easeOutCubic(clamp(logoT / 1.2, 0, 1));
      const lx = W / 2, ly = 250;
      ctx.save();
      ctx.globalAlpha = k;
      vText(ctx, 'COLD BOOT', lx, ly, 96, {
        align: 'center', weight: 0.17, spacing: 6,
        gradient: [[0, '#ffffff'], [0.5, '#bff3ff'], [1, '#4fc3e8']],
        outline: 3, outlineColor: 'rgba(0,10,20,0.8)', glow: 28, glowColor: 'rgba(120,230,255,0.75)',
        shadow: [4, 5, 'rgba(0,0,0,0.5)'],
      });
      text(ctx, 'ХОЛОДНЫЙ ПУСК', lx, ly + 52, { size: 26, weight: 800, align: 'center', color: '#ff5a50', spacing: 10, glow: 14, glowColor: 'rgba(255,60,40,0.8)' });
      text(ctx, 'SAVE THE WORLD.  QUIETLY.', lx, ly + 92, { size: 15, weight: 700, align: 'center', color: C.dim, spacing: 6 });
      ctx.restore();
      if (phase !== 'menu') return;

      const mx = W / 2 - 170, my = 420;
      panel(ctx, mx - 30, my - 34, 400, MENU.length * 46 + 40, { accentLen: 160 });
      MENU.forEach((m, i) => {
        const y = my + i * 46;
        const on = i === sel;
        const disabled = m.id === 'continue' && !hasSave;
        hit.add('menu:' + i, mx - 20, y - 26, 380, 40);
        if (on) {
          ctx.fillStyle = 'rgba(127,230,255,0.12)';
          ctx.fillRect(mx - 18, y - 26, 360, 38);
          ctx.fillStyle = C.accent;
          ctx.fillRect(mx - 18, y - 26, 4, 38);
        }
        vText(ctx, m.label, mx + 8, y + 2, 22, { color: disabled ? C.faint : on ? '#fff' : C.dim, weight: 0.16 });
      });
      text(ctx, MENU[sel].desc, W / 2, my + MENU.length * 46 + 34, { size: 15, color: C.dim, align: 'center' });
      hints(ctx, [['ud', 'SELECT'], ['confirm', 'OK']]);
    },
    view() { return world && phase !== 'post' ? { scene: world.scene, camera: world.camera } : null; },
  };
});
