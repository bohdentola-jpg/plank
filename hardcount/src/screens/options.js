// OPTIONS — the television's own on-screen menu, over the station's test
// card. Blocky OSD type, tab pages, bar-graph sliders: setting up a 2005 CRT.
import { registerScreen, game, go } from '../main.js';
import { Menu, uiSound } from '../core/menu.js';
import { text, osd, hints, hit, vText } from '../core/ui.js';
import { input } from '../core/input.js';
import { settings, store } from '../core/settings.js';
import { audio } from '../audio/audio.js';
import { music } from '../audio/music.js';
import { voice } from '../audio/voice.js';
import { clamp } from '../core/util.js';

const OSD_GREEN = '#d8ffd8';
const OSD_BLUE = 'rgba(16,34,120,0.88)';

const CONTROLS = [
  ['MOVE', 'LEFT STICK', 'W A S D'],
  ['SPRINT', 'R2', 'SHIFT'],
  ['SNAP / THROW TO ✕', '✕', 'K / SPACE'],
  ['THROW TO ◯ □ △', '◯  □  △', 'L  J  I'],
  ['HOT ROUTE / MOTION', 'R1 / L1', 'E / Q'],
  ['HARD COUNT · AUDIBLE', '□ · △  (PRE-SNAP)', 'J · I'],
  ['LATERAL / PITCH', 'L1', 'Q'],
  ['JUKE · TRUCK · SPIN', 'RIGHT STICK ← → ↑ ↓', 'ARROWS'],
  ['SPIN · STIFF ARM · HURDLE', '◯ · □ · △', 'L · J · I'],
  ['SWITCH DEFENDER', '◯', 'L'],
  ['HIT STICK · CUT', 'RIGHT STICK ↑ / ↓', 'ARROW ↑ / ↓'],
  ['TIMEOUT · REPLAY · PAUSE', 'TOUCHPAD · CREATE · OPTIONS', 'T · R · ESC'],
];

/** The station's test card behind the menu: SMPTE-ish bars and the ident. */
function testCard(ctx, t) {
  const bars = ['#c0c0c0', '#c0c000', '#00c0c0', '#00c000', '#c000c0', '#c00000', '#0000c0'];
  const w = 1024 / bars.length;
  bars.forEach((c, i) => { ctx.fillStyle = c; ctx.fillRect(i * w, 0, w + 1, 520); });
  const low = ['#0000c0', '#131313', '#c000c0', '#131313', '#00c0c0', '#131313', '#c0c0c0'];
  low.forEach((c, i) => { ctx.fillStyle = c; ctx.fillRect(i * w, 520, w + 1, 60); });
  ctx.fillStyle = '#0a0a0a';
  ctx.fillRect(0, 580, 1024, 188);
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillRect(0, 0, 1024, 768);
  ctx.save();
  ctx.globalAlpha = 0.5;
  vText(ctx, 'HCN', 512, 700, 60, { align: 'center', color: '#ffffff', weight: 0.2 });
  ctx.restore();
  void t;
}

registerScreen('options', () => {
  let tab = 0, t = 0, wipeArm = 0, wipedT = 0, from = 'huddle';
  const pages = [
    {
      name: 'PICTURE',
      menu: new Menu([
        { label: 'CRT EFFECT', type: 'slider', step: 0.1, min: 0, max: 1, get: () => settings.get('crt') ?? 1, set: (v) => { settings.set('crt', v); game.renderer.crt = v; } },
        { label: 'SHARPNESS', type: 'choice', hint: 'Internal 3D resolution: lower is crunchier and faster.', options: [{ value: 480, label: '480 LINES' }, { value: 600, label: '600 LINES' }, { value: 720, label: '720 LINES' }], get: () => settings.get('lines'), set: (v) => { settings.set('lines', v); game.renderer.setInternalLines(v); } },
        { label: 'AUTO QUALITY', type: 'toggle', hint: 'Steps the sharpness down by itself when the frame rate sinks.', get: () => settings.get('autoQuality'), set: (v) => settings.set('autoQuality', v) },
      ], { id: 'opt0' }),
    },
    {
      name: 'SOUND',
      menu: new Menu([
        { label: 'VOLUME', type: 'slider', step: 0.05, min: 0, max: 1, get: () => settings.get('volMaster'), set: (v) => { settings.set('volMaster', v); audio.setVolumes({ master: v }); } },
        { label: 'MUSIC', type: 'slider', step: 0.05, min: 0, max: 1, get: () => settings.get('volMusic'), set: (v) => { settings.set('volMusic', v); audio.setVolumes({ music: v }); } },
        { label: 'EFFECTS', type: 'slider', step: 0.05, min: 0, max: 1, get: () => settings.get('volSfx'), set: (v) => { settings.set('volSfx', v); audio.setVolumes({ sfx: v }); } },
        { label: 'CROWD', type: 'slider', step: 0.05, min: 0, max: 1, get: () => settings.get('volCrowd') ?? 0.85, set: (v) => { settings.set('volCrowd', v); audio.setVolumes({ crowd: v }); } },
        { label: 'CLOSED CAPTIONS', type: 'toggle', hint: 'The broadcast booth as captions during games.', get: () => settings.get('captions') !== false, set: (v) => settings.set('captions', v) },
        { label: 'PA ANNOUNCER', type: 'toggle', hint: 'The stadium announcer reads the big moments aloud (your computer\'s speech voice).', get: () => !!settings.get('announcer'), set: (v) => { settings.set('announcer', v); if (v) { try { voice.say('Welcome to Hard Count football.', { kind: 'pa', chime: true }); } catch { /* */ } } } },
      ], { id: 'opt1' }),
    },
    {
      name: 'GAME',
      menu: new Menu([
        { label: 'SKILL LEVEL', type: 'choice', options: [{ value: 'rookie', label: 'ROOKIE' }, { value: 'pro', label: 'PRO' }, { value: 'allpro', label: 'ALL-PRO' }, { value: 'allglory', label: 'ALL-GLORY' }], get: () => settings.get('difficulty'), set: (v) => settings.set('difficulty', v) },
        { label: 'QUARTER LENGTH', type: 'choice', options: [2, 3, 4, 5, 6, 8].map((v) => ({ value: v, label: `${v} MIN` })), get: () => settings.get('quarterLen'), set: (v) => settings.set('quarterLen', v) },
        { label: 'ACCELERATED CLOCK', type: 'toggle', hint: 'The clock runs between plays (a 25-second play clock is about 12).', get: () => settings.get('accelClock') !== false, set: (v) => settings.set('accelClock', v) },
        { label: 'FIELD', type: 'choice', options: [{ value: 'sevens', label: 'SEVENS 80×40' }, { value: 'full', label: 'FULL 100×53' }], get: () => settings.get('fieldSize'), set: (v) => settings.set('fieldSize', v) },
        { label: 'PENALTIES', type: 'choice', options: [{ value: 'on', label: 'ON' }, { value: 'off', label: 'OFF' }], get: () => settings.get('penalties'), set: (v) => settings.set('penalties', v) },
        { label: 'FATIGUE', type: 'toggle', get: () => settings.get('fatigue') !== false, set: (v) => settings.set('fatigue', v) },
        { label: 'GAME CAMERA', type: 'choice', options: [{ value: 'broadcast', label: 'BROADCAST' }, { value: 'low', label: 'TIGHT' }, { value: 'high', label: 'ALL-22' }, { value: 'sideline', label: 'SIDELINE' }], get: () => settings.get('camera'), set: (v) => settings.set('camera', v) },
        { label: 'PASS LEAD', type: 'choice', hint: 'ASSIST throws him open; MANUAL lets the left stick place every ball.', options: [{ value: 'assist', label: 'ASSIST' }, { value: 'manual', label: 'MANUAL' }], get: () => settings.get('passLead'), set: (v) => settings.set('passLead', v) },
        { label: 'AUTO SWITCH', type: 'toggle', hint: 'On defense, hands you the man nearest the ball after the throw.', get: () => settings.get('autoSwitch') !== false, set: (v) => settings.set('autoSwitch', v) },
        { label: 'ERASE CAREER', id: 'wipe', hint: 'Starts Road to Glory over. Press twice.' },
      ], { id: 'opt2' }),
    },
    {
      name: 'CONTROLLER',
      menu: new Menu([
        { label: 'VIBRATION', type: 'toggle', get: () => settings.get('rumble') !== false, set: (v) => { settings.set('rumble', v); input.settingsRumble = v; if (v) input.rumble(0.6, 0.6, 200); } },
      ], { id: 'opt3' }),
    },
  ];

  return {
    enter(params = {}) {
      from = params.from === 'pause' ? 'huddle' : (params.back || 'huddle');
      try { music.play('hud_options', { fade: 1 }); } catch { /* */ }
    },
    update(dt, busy) {
      t += dt;
      if (wipeArm > 0) wipeArm -= dt;
      if (wipedT > 0) wipedT -= dt;
      if (busy) return;
      if (input.pressed('tabR')) { tab = (tab + 1) % pages.length; uiSound('tab'); }
      if (input.pressed('tabL')) { tab = (tab + pages.length - 1) % pages.length; uiSound('tab'); }
      if (input.takeClick() && hit.hover?.startsWith('tab:')) { tab = parseInt(hit.hover.slice(4), 10); uiSound('tab'); }
      const pg = pages[tab];
      const it = pg.menu?.update(dt);
      if (it?.id === 'wipe') {
        if (wipeArm > 0) { store.remove('career'); wipeArm = 0; wipedT = 2.5; uiSound('back'); } else { wipeArm = 3; uiSound('error'); }
      }
      if (input.pressed('back')) go(from);
    },
    draw(ctx) {
      testCard(ctx, t);
      const x0 = 112, y0 = 96, w = 800, h = 560;
      ctx.fillStyle = OSD_BLUE;
      ctx.fillRect(x0, y0, w, h);
      ctx.strokeStyle = 'rgba(200,220,255,0.6)';
      ctx.lineWidth = 3;
      ctx.strokeRect(x0 + 6, y0 + 6, w - 12, h - 12);
      osd(ctx, 'MENU', x0 + 30, y0 + 52, 30, OSD_GREEN);
      osd(ctx, 'NOVATRON', x0 + w - 200, y0 + 52, 22, 'rgba(216,255,216,0.6)');
      pages.forEach((p, k) => {
        const tx = x0 + 30 + k * 186, ty = y0 + 78;
        hit.add(`tab:${k}`, tx, ty, 176, 40);
        ctx.fillStyle = k === tab ? 'rgba(216,255,216,0.95)' : 'rgba(0,0,40,0.6)';
        ctx.fillRect(tx, ty, 176, 40);
        osd(ctx, p.name, tx + 88 - p.name.length * 7.5, ty + 30, 20, k === tab ? '#0b1a66' : OSD_GREEN);
      });
      const pg = pages[tab];
      const px = x0 + 50, py = y0 + 172;
      const rowH = pg.menu.items.length > 7 ? 34 : pg.menu.items.length > 5 ? 42 : 50;
      pg.menu.items.forEach((it, k) => {
        const y = py + k * rowH;
        const sel = k === pg.menu.sel;
        hit.add(`${pg.menu.id}:${k}`, px - 20, y - rowH + 14, w - 60, rowH - 2);
        if (sel) {
          ctx.fillStyle = 'rgba(216,255,216,0.16)';
          ctx.fillRect(px - 20, y - rowH + 14, w - 60, rowH - 4);
          osd(ctx, '▶', px - 16, y, 18, OSD_GREEN);
        }
        osd(ctx, it.label, px + 14, y, 20, sel ? '#ffffff' : OSD_GREEN);
        const vx = px + 390;
        if (it.type === 'slider') {
          const v = clamp((it.get() - (it.min ?? 0)) / ((it.max ?? 1) - (it.min ?? 0)), 0, 1);
          const blocks = 20;
          for (let b = 0; b < blocks; b++) {
            ctx.fillStyle = b < Math.round(v * blocks) ? (sel ? '#ffffff' : OSD_GREEN) : 'rgba(216,255,216,0.15)';
            ctx.fillRect(vx + b * 13, y - 18, 9, 18);
          }
          osd(ctx, String(Math.round(v * 100)).padStart(3, ' '), vx + blocks * 13 + 10, y, 18, OSD_GREEN);
        } else if (it.type === 'choice' || it.type === 'toggle') {
          const opts = it.options || [{ value: false, label: 'OFF' }, { value: true, label: 'ON' }];
          const cur = opts.find((o) => o.value === it.get()) || opts[0];
          osd(ctx, `◀ ${cur.label} ▶`, vx, y, 20, sel ? '#ffffff' : OSD_GREEN);
        } else if (it.id === 'wipe') {
          osd(ctx, wipedT > 0 ? 'ERASED' : wipeArm > 0 ? 'PRESS AGAIN' : '', vx, y, 20, wipeArm > 0 ? '#ffb0a0' : OSD_GREEN);
        }
      });
      // the controls card on the controller page
      if (tab === 3) {
        CONTROLS.forEach(([a, pad, key], i) => {
          const y = py + 70 + i * 26;
          text(ctx, a, px + 14, y, { size: 13, weight: 800, color: OSD_GREEN, spacing: 1, font: '"Consolas", monospace' });
          text(ctx, pad, px + 330, y, { size: 13, weight: 800, color: '#ffffff', font: '"Consolas", monospace' });
          text(ctx, key, px + 600, y, { size: 13, weight: 800, color: 'rgba(216,255,216,0.7)', font: '"Consolas", monospace' });
        });
      }
      const hint = pg.menu.current?.hint;
      if (hint) text(ctx, hint, x0 + 40, y0 + h - 26, { size: 13, weight: 700, color: 'rgba(216,255,216,0.8)', font: '"Consolas", monospace' });
      hints(ctx, [['tabL', 'PAGE'], ['ud', 'SELECT'], ['lr', 'ADJUST'], ['back', 'EXIT']]);
    },
  };
});
