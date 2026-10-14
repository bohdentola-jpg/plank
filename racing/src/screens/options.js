// OPTIONS — the TV's own on-screen menu (TALK 104.5 murmurs underneath).
// Blocky OSD type, tab pages, bar-graph sliders, like setting up a 2003 CRT.
import { registerScreen, game, go } from '../main.js';
import { Menu, uiSound } from '../core/menu.js';
import { C, text, osd, hints, hit, vText } from '../core/ui.js';
import { input } from '../core/input.js';
import { settings, store } from '../core/settings.js';
import { audio } from '../audio/audio.js';
import { music } from '../audio/music.js';
import { clamp } from '../core/util.js';

const OSD_GREEN = '#d8ffd8';
const OSD_BLUE = 'rgba(16,34,120,0.86)';

const CONTROLS = [
  ['STEER', 'LEFT STICK', 'A / D  ← →'],
  ['GAS', 'R2', 'W  ↑'],
  ['BRAKE / REVERSE', 'L2', 'S  ↓'],
  ['DRIFT', 'L2 + STEER', 'S + A / D'],
  ['HANDBRAKE', '□  SQUARE', 'SPACE'],
  ['NITROUS', '✕  CROSS', 'SHIFT'],
  ['SHIFT UP / DOWN', 'R1 / L1', 'E / Q'],
  ['CAMERA', '△  TRIANGLE', 'C'],
  ['LOOK BACK', '◯  CIRCLE', 'B'],
  ['RESET CAR', 'CREATE', 'R'],
  ['PAUSE', 'OPTIONS', 'ESC / P'],
];

registerScreen('options', () => {
  let tab = 0;
  let t = 0;
  let confirmWipe = 0;
  const pages = [
    {
      name: 'PICTURE',
      menu: new Menu([
        { label: 'CRT EFFECT', type: 'slider', step: 0.1, min: 0, max: 1, get: () => settings.get('crt') ?? 1, set: (v) => { settings.set('crt', v); game.renderer.crt = v; } },
        {
          label: 'SHARPNESS', type: 'choice', hint: 'Internal 3D resolution. Lower is crunchier and faster.',
          options: [{ value: 480, label: '480 LINES' }, { value: 600, label: '600 LINES' }, { value: 720, label: '720 LINES' }],
          get: () => settings.get('lines'), set: (v) => { settings.set('lines', v); game.renderer.setInternalLines(v); },
        },
        { label: 'AUTO QUALITY', type: 'toggle', hint: 'Drops sharpness on its own if the frame rate sinks.', get: () => settings.get('autoQuality'), set: (v) => settings.set('autoQuality', v) },
      ], { id: 'opt0' }),
    },
    {
      name: 'SOUND',
      menu: new Menu([
        { label: 'VOLUME', type: 'slider', step: 0.05, min: 0, max: 1, get: () => settings.get('volMaster'), set: (v) => { settings.set('volMaster', v); audio.setVolumes({ master: v }); } },
        { label: 'MUSIC', type: 'slider', step: 0.05, min: 0, max: 1, get: () => settings.get('volMusic'), set: (v) => { settings.set('volMusic', v); audio.setVolumes({ music: v }); } },
        { label: 'EFFECTS', type: 'slider', step: 0.05, min: 0, max: 1, get: () => settings.get('volSfx'), set: (v) => { settings.set('volSfx', v); audio.setVolumes({ sfx: v }); } },
      ], { id: 'opt1' }),
    },
    {
      name: 'GAME',
      menu: new Menu([
        { label: 'UNITS', type: 'choice', options: [{ value: 'mph', label: 'MPH' }, { value: 'kmh', label: 'KM/H' }], get: () => settings.get('units'), set: (v) => settings.set('units', v) },
        { label: 'GEARBOX', type: 'choice', options: [{ value: 'auto', label: 'AUTOMATIC' }, { value: 'manual', label: 'MANUAL' }], get: () => settings.get('transmission'), set: (v) => settings.set('transmission', v) },
        { label: 'DRIVING ASSISTS', type: 'choice', hint: 'Traction + stability help. Off: you own every slide.', options: [{ value: 'on', label: 'ON' }, { value: 'off', label: 'OFF' }], get: () => settings.get('assists'), set: (v) => settings.set('assists', v) },
        { label: 'CAMERA', type: 'choice', options: [{ value: 0, label: 'CHASE FAR' }, { value: 1, label: 'CHASE' }, { value: 2, label: 'BUMPER' }, { value: 3, label: 'HOOD' }], get: () => settings.get('camera'), set: (v) => settings.set('camera', v) },
        { label: 'VIBRATION', type: 'toggle', get: () => settings.get('rumble') !== false, set: (v) => { settings.set('rumble', v); input.settingsRumble = v; if (v) input.rumble(0.6, 0.6, 200); } },
        { label: 'ERASE STORY SAVE', id: 'wipe', hint: 'Starts the story over. Press twice.' },
      ], { id: 'opt2' }),
    },
    { name: 'CONTROLS', menu: null },
  ];

  return {
    enter() {
      try { if (music.theme !== 'talk') music.play('talk', { fade: 1 }); music.setTuning(0); } catch { /* */ }
    },
    update(dt, busy) {
      t += dt;
      if (confirmWipe > 0) confirmWipe -= dt;
      try { music.update?.(); } catch { /* */ }
      if (busy) return;
      if (input.pressed('tabR')) { tab = (tab + 1) % pages.length; uiSound('tab'); }
      if (input.pressed('tabL')) { tab = (tab + pages.length - 1) % pages.length; uiSound('tab'); }
      if (input.takeClick() && hit.hover?.startsWith('tab:')) { tab = parseInt(hit.hover.slice(4), 10); uiSound('tab'); }
      const pg = pages[tab];
      const it = pg.menu?.update(dt);
      if (it?.id === 'wipe') {
        if (confirmWipe > 0) { store.remove('story'); confirmWipe = 0; uiSound('back'); pg.wiped = 2.5; } else confirmWipe = 3;
      }
      if (pg.wiped) pg.wiped = Math.max(0, pg.wiped - dt);
      if (input.pressed('back')) go('radio', { station: 'talk' });
    },
    draw(ctx) {
      // the "programme" behind the menu: a dim talk-radio card
      const g = ctx.createLinearGradient(0, 0, 0, 768);
      g.addColorStop(0, '#0a0d18');
      g.addColorStop(1, '#05060a');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 1024, 768);
      ctx.save();
      ctx.globalAlpha = 0.12;
      vText(ctx, 'TALK 104.5', 512, 420, 120, { align: 'center', color: '#7d8aa6' });
      ctx.restore();

      // OSD frame
      const x0 = 120, y0 = 120, w = 784, h = 500;
      ctx.fillStyle = OSD_BLUE;
      ctx.fillRect(x0, y0, w, h);
      ctx.strokeStyle = 'rgba(200,220,255,0.6)';
      ctx.lineWidth = 3;
      ctx.strokeRect(x0 + 6, y0 + 6, w - 12, h - 12);
      osd(ctx, 'MENU', x0 + 30, y0 + 52, 30, OSD_GREEN);
      osd(ctx, 'NOVATRON', x0 + w - 200, y0 + 52, 22, 'rgba(216,255,216,0.6)');
      // tabs
      pages.forEach((p, k) => {
        const tx = x0 + 30 + k * 186, ty = y0 + 78;
        hit.add(`tab:${k}`, tx, ty, 176, 40);
        ctx.fillStyle = k === tab ? 'rgba(216,255,216,0.95)' : 'rgba(0,0,40,0.6)';
        ctx.fillRect(tx, ty, 176, 40);
        osd(ctx, p.name, tx + 88 - p.name.length * 7.5, ty + 30, 20, k === tab ? '#0b1a66' : OSD_GREEN);
      });
      const pg = pages[tab];
      const px = x0 + 50, py = y0 + 180;
      if (pg.menu) {
        pg.menu.items.forEach((it, k) => {
          const y = py + k * 52;
          const sel = k === pg.menu.sel;
          hit.add(`${pg.menu.id}:${k}`, px - 20, y - 34, w - 60, 48);
          if (sel) {
            ctx.fillStyle = 'rgba(216,255,216,0.16)';
            ctx.fillRect(px - 20, y - 34, w - 60, 46);
            osd(ctx, '▶', px - 16, y, 18, OSD_GREEN);
          }
          osd(ctx, it.label, px + 14, y, 22, sel ? '#ffffff' : OSD_GREEN);
          const vx = px + 400;
          if (it.type === 'slider') {
            const v = clamp((it.get() - (it.min ?? 0)) / ((it.max ?? 1) - (it.min ?? 0)), 0, 1);
            const blocks = 20;
            for (let b = 0; b < blocks; b++) {
              ctx.fillStyle = b < Math.round(v * blocks) ? (sel ? '#ffffff' : OSD_GREEN) : 'rgba(216,255,216,0.15)';
              ctx.fillRect(vx + b * 13, y - 20, 9, 20);
            }
            osd(ctx, String(Math.round(v * 100)).padStart(3, ' '), vx + blocks * 13 + 10, y, 20, OSD_GREEN);
          } else if (it.type === 'choice' || it.type === 'toggle') {
            const opts = it.options || [{ value: false, label: 'OFF' }, { value: true, label: 'ON' }];
            const cur = opts.find((o) => o.value === it.get()) || opts[0];
            osd(ctx, `◀ ${cur.label} ▶`, vx, y, 22, sel ? '#ffffff' : OSD_GREEN);
          } else if (it.id === 'wipe') {
            const msg = pg.wiped ? 'ERASED' : confirmWipe > 0 ? 'PRESS AGAIN TO ERASE' : '';
            if (msg) osd(ctx, msg, vx, y, 18, '#ffb0a0');
          }
        });
        const cur = pg.menu.current;
        if (cur?.hint) text(ctx, cur.hint, px, y0 + h - 34, { size: 15, color: 'rgba(216,255,216,0.75)', weight: 700, font: '"Consolas", monospace', shadow: false });
      } else {
        osd(ctx, 'ACTION', px, py - 10, 16, 'rgba(216,255,216,0.6)');
        osd(ctx, 'CONTROLLER', px + 290, py - 10, 16, 'rgba(216,255,216,0.6)');
        osd(ctx, 'KEYBOARD', px + 520, py - 10, 16, 'rgba(216,255,216,0.6)');
        CONTROLS.forEach(([a, pad, key], k) => {
          const y = py + 22 + k * 27;
          osd(ctx, a, px, y, 17, OSD_GREEN);
          text(ctx, pad, px + 290, y, { size: 16, color: '#ffffff', weight: 700, font: '"Consolas", monospace', shadow: false });
          text(ctx, key, px + 520, y, { size: 16, color: '#ffffff', weight: 700, font: '"Consolas", monospace', shadow: false });
        });
      }
      // little OSD clock, because every TV had one
      const blink = Math.floor(t * 2) % 2 === 0;
      osd(ctx, `11${blink ? ':' : ' '}52 PM`, x0 + w - 150, y0 + h + 44, 22, 'rgba(216,255,216,0.8)');
      hints(ctx, [['tabR', 'PAGE'], ['ud', 'SELECT'], ['lr', 'ADJUST'], ['back', 'BACK']], { y: 720 });
    },
  };
});
