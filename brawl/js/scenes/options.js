// Options, and the key-rebinding screen.

import { W, H } from '../core/config.js';
import { clamp } from '../core/util.js';
import { OUT, txt, rrect } from '../core/gfx.js';
import { keyLabel, DEFAULT_KEYS } from '../core/input.js';
import { DEFAULTS, saveSettings } from '../core/storage.js';
import { chalkboard, chalk, keycap, hot, clicked } from './ui.js';

export class OptionsScene {
  constructor(app) { this.app = app; this.t = 0; this.sel = 0; }
  enter() { this.app.audio.playMusic('menu'); }
  rows() {
    const a = this.app, s = a.settings, inp = a.input, au = a.audio;
    const vol = (v) => '■'.repeat(Math.round(v * 10)) + '□'.repeat(10 - Math.round(v * 10));
    const step = (k, d) => { s[k] = clamp(Math.round(s[k] * 10 + d) / 10, 0, 1); au.volMusic = s.volMusic; au.volSfx = s.volSfx; au.applyVolumes(); if (k === 'volSfx') au.sfx('hitM'); };
    return [
      { label: 'Music', value: vol(s.volMusic), adj: (d) => step('volMusic', d) },
      { label: 'Sound effects', value: vol(s.volSfx), adj: (d) => step('volSfx', d) },
      { label: 'Screen shake', value: s.shake ? 'ON' : 'OFF', adj: () => { s.shake = !s.shake; } },
      { label: 'Picture quality', value: ['LOW', 'MEDIUM', 'HIGH'][s.quality], adj: (d) => { a.setQuality((s.quality + d + 3) % 3); } },
      { label: 'Full screen', value: document.fullscreenElement ? 'ON' : 'OFF', adj: () => a.toggleFullscreen() },
      { label: 'UP also jumps (keyboard)', value: inp.kbA.tapJump ? 'ON' : 'OFF', adj: () => { inp.kbA.tapJump = inp.kbB.tapJump = !inp.kbA.tapJump; } },
      { label: 'UP also jumps (controller)', value: inp.pads[0].tapJump ? 'ON' : 'OFF', adj: () => { const v = !inp.pads[0].tapJump; inp.pads.forEach((p) => { p.tapJump = v; }); } },
      { label: 'Controller layout', value: inp.padPreset === 'brawl' ? 'A ATTACKS, X/Y JUMP' : 'A JUMPS, X ATTACKS', adj: () => { inp.padPreset = inp.padPreset === 'brawl' ? 'platformer' : 'brawl'; } },
      { label: 'Change keyboard keys...', value: '', go: () => a.go(() => new KeysScene(a)) },
      { label: 'Reset everything', value: '', go: () => { Object.assign(s, JSON.parse(JSON.stringify(DEFAULTS))); inp.resetKeys(); inp.padPreset = 'brawl'; inp.kbA.tapJump = inp.kbB.tapJump = true; inp.pads.forEach((p) => { p.tapJump = true; }); au.volMusic = s.volMusic; au.volSfx = s.volSfx; au.setMuted(false); a.setQuality(2); a.audio.sfx('rip'); } },
    ];
  }
  update() {
    const app = this.app, mn = app.input.menu(), rows = this.rows(), n = rows.length; this.t++;
    if (this.t < 10) return;
    if (mn.up) { this.sel = (this.sel + n - 1) % n; app.audio.sfx('ui_move'); }
    if (mn.down) { this.sel = (this.sel + 1) % n; app.audio.sfx('ui_move'); }
    rows.forEach((r, i) => { if (hot(app, 60, 118 + i * 38, W - 120, 36) && app.input.mouse.moved === 0) this.sel = i; });
    const r = rows[this.sel];
    const click = clicked(app, 60, 118 + this.sel * 38, W - 120, 36);
    if (r.adj && (mn.left || mn.right || mn.ok || click)) { r.adj(mn.left ? -1 : 1); app.audio.sfx('ui_move'); app.save(); }
    else if (r.go && (mn.ok || click)) { app.audio.sfx('ui_ok'); r.go(); app.save(); return; }
    if (mn.back) { app.save(); app.audio.sfx('ui_back'); import('./title.js').then((m) => app.go(() => new m.TitleScene(app, true))); }
  }
  draw(ctx) {
    chalkboard(ctx, this.t, 'OPTIONS');
    this.rows().forEach((r, i) => {
      const y = 136 + i * 38, on = i === this.sel;
      if (on) { ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctx.fillRect(60, y - 18, W - 120, 36); chalk(ctx, '>', 70, y, { size: 26, fill: '#ffe45c' }); }
      chalk(ctx, r.label, 100, y, { size: 24, fill: on ? '#ffe45c' : '#ffffff' });
      chalk(ctx, r.value, W - 90, y, { size: r.value.length > 12 ? 17 : 22, align: 'right', font: r.value[0] === '■' || r.value[0] === '□' ? 'pixel' : 'hand', fill: on ? '#ffe45c' : '#ffffff' });
    });
    chalk(ctx, 'left / right to change      ESC to go back', W / 2, H - 70, { size: 18, align: 'center', fill: 'rgba(255,255,255,0.7)' });
  }
}

const ACTS = [['up', 'Up'], ['down', 'Down'], ['left', 'Left'], ['right', 'Right'], ['jump', 'Jump'], ['attack', 'Attack'], ['special', 'Special'], ['strong', 'Strong'], ['shield', 'Shield'], ['grab', 'Grab'], ['taunt', 'Taunt'], ['start', 'Pause']];
const TABLES = [['solo', 'ONE PLAYER'], ['split1', 'SHARED: LEFT SIDE'], ['split2', 'SHARED: RIGHT SIDE']];

export class KeysScene {
  constructor(app) { this.app = app; this.t = 0; this.tab = 0; this.sel = 0; this.listen = false; }
  update() {
    const app = this.app, inp = app.input; this.t++;
    if (this.t < 10) return;
    const table = inp.keys[TABLES[this.tab][0]], act = ACTS[this.sel][0];
    if (this.listen) {
      const code = inp.rawPressed[0];
      if (!code) return;
      this.listen = false;
      if (code === 'Escape') { app.audio.sfx('ui_back'); return; }
      // one key, one job: take it away from whatever had it in this table
      for (const a in table) table[a] = table[a].filter((c) => c !== code);
      table[act] = [code].concat(table[act].slice(0, 1));
      for (const a in table) if (!table[a].length) table[a] = [];
      app.audio.sfx('ui_pick'); app.save();
      this.cool = 12;
      return;
    }
    if (this.cool > 0) { this.cool--; return; }
    const rp = inp.rawPressed;
    const up = rp.includes('ArrowUp'), down = rp.includes('ArrowDown'), left = rp.includes('ArrowLeft'), right = rp.includes('ArrowRight');
    const mn = inp.menu();
    if (up || (mn.up && mn.dev && mn.dev.type === 'pad')) { this.sel = (this.sel + ACTS.length - 1) % ACTS.length; app.audio.sfx('ui_move'); }
    if (down || (mn.down && mn.dev && mn.dev.type === 'pad')) { this.sel = (this.sel + 1) % ACTS.length; app.audio.sfx('ui_move'); }
    if (left || (mn.left && mn.dev && mn.dev.type === 'pad')) { this.tab = (this.tab + 2) % 3; app.audio.sfx('chalk'); }
    if (right || (mn.right && mn.dev && mn.dev.type === 'pad')) { this.tab = (this.tab + 1) % 3; app.audio.sfx('chalk'); }
    ACTS.forEach((a, i) => { const [x, y] = this.cell(i); if (clicked(app, x, y - 16, 330, 32)) { this.sel = i; this.listen = true; } });
    if (rp.includes('Enter') || rp.includes('NumpadEnter')) { this.listen = true; app.audio.sfx('ui_ok'); }
    if (rp.includes('Delete') || rp.includes('Backspace')) { table[act] = DEFAULT_KEYS[TABLES[this.tab][0]][act].slice(); app.audio.sfx('rip'); app.save(); }
    if (rp.includes('Escape') || (mn.back && mn.dev && mn.dev.type === 'pad')) { app.save(); app.audio.sfx('ui_back'); app.go(() => new OptionsScene(app)); }
  }
  cell(i) { return [i < 6 ? 70 : 420, 190 + (i % 6) * 46]; }
  draw(ctx) {
    chalkboard(ctx, this.t, 'KEYBOARD KEYS');
    TABLES.forEach((tb, i) => chalk(ctx, tb[1], 150 + i * 250, 132, { size: 20, align: 'center', fill: i === this.tab ? '#ffe45c' : 'rgba(255,255,255,0.55)' }));
    chalk(ctx, '<', 40, 132, { size: 24 }); chalk(ctx, '>', W - 52, 132, { size: 24 });
    const table = this.app.input.keys[TABLES[this.tab][0]];
    ACTS.forEach((a, i) => {
      const [x, y] = this.cell(i), on = i === this.sel;
      if (on) { ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctx.fillRect(x - 12, y - 18, 330, 36); }
      chalk(ctx, a[1], x, y, { size: 24, fill: on ? '#ffe45c' : '#ffffff' });
      let cx = x + 120;
      if (on && this.listen) chalk(ctx, this.t % 30 < 18 ? 'press a key...' : '', cx, y, { size: 20, fill: '#ffe45c' });
      else if (!table[a[0]].length) chalk(ctx, '(none)', cx, y, { size: 18, fill: 'rgba(255,255,255,0.5)' });
      else for (const code of table[a[0]]) cx += keycap(ctx, keyLabel(code), cx, y - 13) + 6;
    });
    chalk(ctx, 'ARROWS choose      ENTER change      DELETE default      ESC done', W / 2, H - 70, { size: 17, align: 'center', fill: 'rgba(255,255,255,0.7)' });
  }
}
