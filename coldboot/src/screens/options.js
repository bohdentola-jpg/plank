// OPTIONS (from the title, or as a panel over the paused game) and CREDITS.
// The panel edits settings live: picture lines, CRT, volumes, subtitles, look,
// units. Both screens fall back to the title.
import { registerScreen, game, go } from '../main.js';
import { input } from '../core/input.js';
import { C, W, H, text, vText, panel, hints, hit, statBar } from '../core/ui.js';
import { settings } from '../core/settings.js';
import { audio } from '../audio/audio.js';
import { sfx } from '../audio/sfx.js';

const ROWS = [
  { head: 'PICTURE' },
  { k: 'lines', label: 'Resolution', kind: 'choice', values: [432, 540, 720, 900, 1080], fmt: (v) => `${v} lines`, apply: (v) => game.renderer.setInternalLines?.(v) },
  { k: 'crt', label: 'CRT effect', kind: 'slider', min: 0, max: 1, step: 0.1, fmt: (v) => (v <= 0 ? 'off' : `${Math.round(v * 100)}%`), apply: (v) => { game.renderer.crt = v; } },
  { k: 'autoQuality', label: 'Auto quality', kind: 'toggle' },
  { head: 'SOUND' },
  { k: 'volMaster', label: 'Master', kind: 'slider', min: 0, max: 1, step: 0.05, apply: () => vols() },
  { k: 'volMusic', label: 'Music', kind: 'slider', min: 0, max: 1, step: 0.05, apply: () => vols() },
  { k: 'volSfx', label: 'Effects', kind: 'slider', min: 0, max: 1, step: 0.05, apply: () => vols() },
  { k: 'volVoice', label: 'Voices', kind: 'slider', min: 0, max: 1, step: 0.05 },
  { head: 'GAME' },
  { k: 'subtitles', label: 'Subtitles', kind: 'toggle' },
  { k: 'lookSens', label: 'Look sensitivity', kind: 'slider', min: 0.3, max: 2.5, step: 0.1, fmt: (v) => `${v.toFixed(1)}×` },
  { k: 'invertY', label: 'Invert look', kind: 'toggle' },
  { k: 'rumble', label: 'Controller rumble', kind: 'toggle', apply: (v) => { input.settingsRumble = v; } },
  { k: 'units', label: 'Units', kind: 'choice', values: ['imperial', 'metric'], fmt: (v) => (v === 'metric' ? 'metric (°C, km)' : 'imperial (°F, mi)') },
];

function vols() {
  audio.setVolumes({ master: settings.get('volMaster'), music: settings.get('volMusic'), sfx: settings.get('volSfx') });
}

const KEYS = [
  ['WASD / left stick', 'walk · drive'], ['Shift / R2', 'run'], ['Mouse / right stick', 'look'],
  ['E / ✕', 'talk · use'], ['F / △', 'get in / out'], ['Tab', 'phone'], ['J', 'journal'], ['M', 'map'],
  ['C', 'crouch'], ['Space / Enter', 'skip a line'], ['Esc / OPTIONS', 'pause'],
];

/** The settings panel. onClose() is called when the player backs out. */
export function optionsPanel(onClose) {
  const items = ROWS.map((r, i) => ({ ...r, i })).filter((r) => !r.head);
  let sel = 0, t = 0;
  const change = (r, dir) => {
    let v = settings.get(r.k);
    if (r.kind === 'toggle') v = !v;
    else if (r.kind === 'slider') v = Math.round(Math.min(r.max, Math.max(r.min, (v ?? r.min) + dir * r.step)) * 100) / 100;
    else if (r.kind === 'choice') { const i = r.values.indexOf(v); v = r.values[(Math.max(0, i) + dir + r.values.length) % r.values.length]; }
    settings.set(r.k, v);
    r.apply?.(v);
    sfx.ui?.('move');
  };
  return {
    update(dt) {
      t += dt;
      if (input.pressed('up')) { sel = (sel + items.length - 1) % items.length; sfx.ui?.('move'); }
      if (input.pressed('down')) { sel = (sel + 1) % items.length; sfx.ui?.('move'); }
      const h = hit.hover || '';
      if (h.startsWith('opt:')) sel = +h.slice(4);
      const r = items[sel];
      if (input.pressed('left')) change(r, -1);
      if (input.pressed('right') || (input.pressed('confirm') && r.kind !== 'slider')) change(r, 1);
      const click = input.takeClick();
      if (click && h.startsWith('optL:')) change(items[+h.slice(5)], -1);
      else if (click && h.startsWith('optR:')) change(items[+h.slice(5)], 1);
      else if (click && h.startsWith('opt:') && r.kind !== 'slider') change(r, 1);
      if ((t > 0.2 && input.pressed('back')) || (click && h === 'opt-close')) { sfx.ui?.('select'); onClose(); }
    },
    draw(ctx) {
      ctx.fillStyle = 'rgba(2,6,10,0.78)';
      ctx.fillRect(0, 0, W, H);
      vText(ctx, 'OPTIONS', 90, 96, 40, { color: '#fff', weight: 0.17 });
      const x = 90, w = 640;
      panel(ctx, x - 20, 120, w + 40, 560, { accentLen: 180 });
      let y = 156, ii = 0;
      for (const r of ROWS) {
        if (r.head) { text(ctx, r.head, x, y + 4, { size: 12, weight: 800, color: C.accent, spacing: 3 }); y += 26; continue; }
        const i = ii++;
        const on = i === sel;
        hit.add('opt:' + i, x - 10, y - 18, w + 20, 30);
        if (on) { ctx.fillStyle = 'rgba(127,230,255,0.10)'; ctx.fillRect(x - 10, y - 19, w + 20, 30); ctx.fillStyle = C.accent; ctx.fillRect(x - 10, y - 19, 3, 30); }
        text(ctx, r.label, x + 6, y + 2, { size: 16, weight: 700, color: on ? '#fff' : C.text });
        const v = settings.get(r.k);
        const vx = x + 300;
        if (r.kind === 'slider') {
          statBar(ctx, vx, y - 8, 220, 10, ((v ?? 0) - r.min) / (r.max - r.min), { color: on ? C.accent : C.accentDim });
          text(ctx, r.fmt ? r.fmt(v) : `${Math.round((v ?? 0) * 100)}%`, vx + 300, y + 2, { size: 14, weight: 700, color: C.dim, align: 'right' });
        } else {
          const label = r.kind === 'toggle' ? (v ? 'ON' : 'OFF') : (r.fmt ? r.fmt(v) : String(v));
          text(ctx, '‹', vx, y + 3, { size: 20, weight: 800, color: on ? C.accent : C.faint });
          text(ctx, label, vx + 110, y + 2, { size: 15, weight: 800, color: on ? '#fff' : C.dim, align: 'center' });
          text(ctx, '›', vx + 220, y + 3, { size: 20, weight: 800, color: on ? C.accent : C.faint });
        }
        hit.add('optL:' + i, vx - 10, y - 18, 40, 30);
        hit.add('optR:' + i, vx + 190, y - 18, 40, 30);
        y += 31;
      }
      // controls reference
      const kx = 800;
      panel(ctx, kx - 20, 120, 420, 420, { accentLen: 120 });
      text(ctx, 'CONTROLS', kx, 160, { size: 12, weight: 800, color: C.accent, spacing: 3 });
      KEYS.forEach(([k, what], i) => {
        text(ctx, k, kx, 196 + i * 30, { size: 14, weight: 700, color: '#fff' });
        text(ctx, what, kx + 370, 196 + i * 30, { size: 14, weight: 600, color: C.dim, align: 'right' });
      });
      hit.add('opt-close', kx - 20, 560, 200, 40);
      panel(ctx, kx - 20, 560, 200, 40, { accent: C.accent });
      text(ctx, 'BACK', kx + 80, 586, { size: 15, weight: 800, color: '#fff', align: 'center', spacing: 2 });
      hints(ctx, [['ud', 'SELECT'], ['lr', 'CHANGE'], ['back', 'BACK']]);
    },
  };
}

registerScreen('options', () => {
  let p, from = 'title';
  return {
    enter(params = {}) {
      from = params.from || 'title';
      p = optionsPanel(() => go(from === 'title' ? 'title' : 'title', {}));
    },
    update(dt) { p.update(dt); },
    draw(ctx) {
      ctx.fillStyle = '#05080c';
      ctx.fillRect(0, 0, W, H);
      p.draw(ctx);
    },
    view() { return null; },
  };
});

// ------------------------------------------------------------------ credits
export const CREDIT_LINES = [
  ['COLD BOOT', 'title'], ['ХОЛОДНЫЙ ПУСК', 'ru'], ['Save the world. Quietly.', 'sub'], ['', ''],
  ['A game about six people at a table in a fish warehouse,', ''], ['one stranger, fourteen days, and a small town worth saving.', ''], ['', ''],
  ['— PEOPLE —', 'head'],
  ['Every face, body and hairline is grown at runtime', ''], ['from the MakeHuman base mesh and its CC0 assets.', ''], ['', ''],
  ['— VOICES —', 'head'],
  ['Russian: Silero TTS v4 (ru)', ''], ['English: Piper (LibriTTS-R voices)', ''], ['Checked line by line with Whisper.', ''], ['', ''],
  ['— WORLD —', 'head'],
  ['three.js', ''], ['Textures: Poly Haven & ambientCG (CC0)', ''], ['Sky, snow, sea ice, aurora, music and sound: procedural', ''], ['', ''],
  ['— CODE —', 'head'],
  ['A small Python lives inside Lyosha\'s laptop.', ''], ['It was written for this game, line by line.', ''], ['', ''],
  ['— THANKS —', 'head'], ['to everyone who keeps the lights on, quietly.', ''], ['', ''], ['', ''],
  ['Тихо.', 'ru'],
];

registerScreen('credits', () => {
  let t = 0;
  return {
    enter() { t = 0; },
    update(dt) {
      t += dt;
      if ((t > 0.4 && (input.pressed('back') || input.pressed('confirm'))) || t > CREDIT_LINES.length * 44 / 30 + 26) go('title', {});
    },
    draw(ctx) {
      ctx.fillStyle = '#04070a';
      ctx.fillRect(0, 0, W, H);
      const y0 = Math.max(H / 2 - (CREDIT_LINES.length - 1) * 44, H + 20 - t * 30);
      CREDIT_LINES.forEach(([s, kind], i) => {
        const y = y0 + i * 44;
        if (!s || y < -40 || y > H + 40) return;
        ctx.save();
        ctx.globalAlpha = Math.max(0, Math.min(1, Math.min(y - 40, H - 40 - y) / 70));
        if (kind === 'title') vText(ctx, s, W / 2, y, 44, { align: 'center', color: '#fff', weight: 0.17, glow: 16, glowColor: 'rgba(120,230,255,0.6)' });
        else if (kind === 'ru') text(ctx, s, W / 2, y, { size: 24, weight: 800, color: '#ff5a50', align: 'center', spacing: 6 });
        else text(ctx, s, W / 2, y, { size: kind === 'head' ? 15 : 18, weight: kind === 'head' ? 800 : 600, color: kind === 'head' ? C.accent : kind === 'sub' ? C.dim : '#e8eef4', align: 'center', spacing: kind === 'head' ? 4 : 0 });
        ctx.restore();
      });
      hints(ctx, [['back', 'BACK']]);
    },
    view() { return null; },
  };
});
