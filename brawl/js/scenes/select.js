// Character select: a grid of fighters up top, four player panels below.
// Each human moves their own cursor; CPUs are added with the "CPUs" button
// and can be given a fighter and a level by any human who has locked in.

import { W, H, PLAYER_COLORS, PLAYER_DARK, CPU_COLOR } from '../core/config.js';
import { clamp, ease, vrng } from '../core/util.js';
import { OUT, txt, rr, fs, rrect, panel, lighten, darken, dots, circle, polygon, shadow, star } from '../core/gfx.js';
import { keyLabel } from '../core/input.js';
import { FIGHTERS } from '../fighters/index.js';
import { dummyFighter, tickDummy, drawDummy, drawPortrait } from '../game/render.js';
import { skyBack, hot, clicked, hintBar } from './ui.js';

const TW = 108, TH = 84, GAP = 8;

export class SelectScene {
  constructor(app, opts = {}) {
    this.app = app; this.t = 0;
    this.roster = FIGHTERS.filter((f) => !f.stub);
    this.cols = Math.min(5, this.roster.length);
    this.rows = Math.ceil(this.roster.length / this.cols);
    this.gx = (W - (this.cols * TW + (this.cols - 1) * GAP)) / 2;
    this.gy = 62 + (3 - this.rows) * (TH + GAP) / 2;
    const lvl = app.settings.cpuLevel || 5;
    this.slots = [0, 1, 2, 3].map((i) => ({ i, type: 'none', dev: null, cur: (i * 3) % this.roster.length, locked: false, random: false, costume: i, level: lvl, d: null, key: '', pop: 0 }));
    app.input.setSplit(false);
    this.join(opts.dev && opts.dev.connected ? opts.dev : app.input.kbA);
    this.setCpus(1);
    this.startT = 0;
  }
  enter() { this.app.audio.playMusic('menu'); if (!this._said) { this._said = true; this.app.audio.sfx('v_choose', { delay: 0.3 }); } }

  // ---- slot bookkeeping ----
  humans() { return this.slots.filter((s) => s.type === 'human'); }
  cpus() { return this.slots.filter((s) => s.type === 'cpu'); }
  slotOf(dev) { return this.slots.find((s) => s.type === 'human' && s.dev === dev); }
  join(dev) {
    let s = this.slots.find((x) => x.type === 'none') || this.slots.find((x) => x.type === 'cpu');
    if (!s) return;
    Object.assign(s, { type: 'human', dev, locked: false, random: false, pop: 12 });
    if (dev.id === 'kbB') this.app.input.setSplit(true);
    this.app.audio.sfx('ui_ok');
  }
  dropSlot(s) {
    if (s.dev && s.dev.id === 'kbB') this.app.input.setSplit(false);
    Object.assign(s, { type: 'none', dev: null, locked: false });
    this.app.audio.sfx('ui_back');
    if (!this.humans().length) this.back();
  }
  setCpus(n) {
    let k = 0;
    for (const s of this.slots) {
      if (s.type === 'human') continue;
      if (k < n) { if (s.type !== 'cpu') Object.assign(s, { type: 'cpu', random: true, locked: false, pop: 12 }); k++; }
      else s.type = 'none';
    }
  }
  cycleCpus() {
    const free = 4 - this.humans().length, n = (this.cpus().length + 1) % (free + 1);
    this.setCpus(n); this.app.audio.sfx('ui_move');
  }
  activeCpu() { return this.cpus().find((s) => !s.locked) || null; }
  allLocked() { const h = this.humans(); return h.length > 0 && h.every((s) => s.locked); }
  canStart() { return this.allLocked() && this.humans().length + this.cpus().length >= 2; }

  move(s, mn) {
    const n = this.roster.length, c = this.cols;
    let col = s.cur % c, row = Math.floor(s.cur / c);
    if (mn.left) col = (col + c - 1) % c; if (mn.right) col = (col + 1) % c;
    if (mn.up) row = (row + this.rows - 1) % this.rows; if (mn.down) row = (row + 1) % this.rows;
    let idx = row * c + col;
    if (idx >= n) idx = mn.down ? col : mn.up ? (Math.floor((n - 1) / c)) * c + Math.min(col, (n - 1) % c) : n - 1;
    if (idx !== s.cur) { s.cur = clamp(idx, 0, n - 1); this.app.audio.sfx('ui_move'); return true; }
    return false;
  }
  lock(s) { s.locked = true; s.pop = 14; s.random = false; this.app.audio.sfx('ui_pick'); if (s.d) { s.d.state = 'win'; s.d.sf = 0; s.winT = 50; } }

  back() { import('./title.js').then((m) => this.app.go(() => new m.TitleScene(this.app, true))); }
  start() {
    if (!this.canStart() || this.going) return;
    this.going = true;
    const app = this.app, used = {};
    const players = [];
    for (const s of this.slots) {
      if (s.type === 'none') continue;
      const def = s.type === 'cpu' && s.random ? vrng.pick(this.roster) : this.roster[s.cur];
      let cos = s.type === 'cpu' && s.random ? s.i : s.costume;
      used[def.id] = used[def.id] || new Set();
      for (let k = 0; k < def.costumes.length && used[def.id].has(cos % def.costumes.length); k++) cos++;
      cos %= def.costumes.length; used[def.id].add(cos);
      players.push({ fighter: def.id, costume: cos, type: s.type, device: s.dev ? s.dev.id : null, level: s.level });
    }
    app.settings.cpuLevel = (this.cpus()[0] || { level: app.settings.cpuLevel }).level; app.save();
    app.audio.sfx('ui_ok');
    import('./stageselect.js').then((m) => app.go(() => new m.StageScene(app, players, this)));
  }
  enterAgain() { this.going = false; }

  update() {
    const app = this.app, inp = app.input;
    this.t++;
    for (const d of inp.devices) {
      if (!d.connected) continue;
      const mn = d.menu, s = this.slotOf(d);
      if (!s) { if (mn.ok && !(d.id === 'kbB' && !inp.split && this.slotOf(inp.kbA) && false)) this.join(d); continue; }
      if (!s.locked) {
        this.move(s, mn);
        if (mn.alt) { s.costume = (s.costume + 1) % this.roster[s.cur].costumes.length; app.audio.sfx('ui_move'); }
        if (mn.alt2) this.cycleCpus();
        if (mn.ok) this.lock(s);
        else if (mn.back) { if (s.i === 0 && this.humans().length === 1) this.back(); else this.dropSlot(s); }
      } else {
        const c = this.activeCpu();
        if (mn.start && this.canStart()) { this.start(); continue; }
        if (mn.alt2) this.cycleCpus();
        if (c) {
          if (this.move(c, mn)) c.random = false;
          if (mn.alt) { c.level = (c.level % 9) + 1; app.audio.sfx('ui_move'); }
          if (mn.ok && !mn.start) { c.random = false; this.lock(c); }
        } else if (mn.ok && this.canStart()) { this.start(); continue; }
        if (mn.back) {
          const last = this.cpus().filter((x) => x.locked).pop();
          if (last) { last.locked = false; last.random = true; } else s.locked = false;
          app.audio.sfx('ui_back');
        }
      }
    }
    // mouse: click a tile to pick for player 1 (then for the CPUs), click a spare panel to toggle a CPU
    const me = this.humans()[0];
    for (let i = 0; i < this.roster.length && me; i++) {
      const [x, y] = this.tileXY(i);
      if (clicked(app, x, y, TW, TH)) {
        if (!me.locked) { me.cur = i; this.lock(me); }
        else { const c = this.activeCpu(); if (c) { c.cur = i; this.lock(c); } }
      }
    }
    this.slots.forEach((s) => {
      const [px, py, pw, ph] = this.panelRect(s.i);
      if (clicked(app, px, py, pw, ph) && s.type !== 'human') { s.type === 'cpu' ? (s.type = 'none') : Object.assign(s, { type: 'cpu', random: true, locked: false, pop: 12 }); app.audio.sfx('ui_move'); }
    });
    if (this.canStart() && clicked(app, W / 2 - 150, 300, 300, 50)) this.start();
    if (inp.escPressed && !this.humans().some((s) => s.dev === inp.kbA)) this.back();

    // keep each panel's posed fighter in step with its cursor
    for (const s of this.slots) {
      if (s.pop > 0) s.pop--;
      if (s.type === 'none' || (s.type === 'cpu' && s.random)) { s.d = null; s.key = ''; continue; }
      const def = this.roster[s.cur], cos = (s.type === 'cpu' ? s.i : s.costume) % def.costumes.length, key = def.id + cos;
      if (key !== s.key) { s.d = dummyFighter(def, cos); s.key = key; }
      if (s.winT > 0 && --s.winT === 0) s.d.state = 'idle';
      tickDummy(s.d);
    }
    this.startT = this.canStart() ? this.startT + 1 : 0;
  }

  tileXY(i) { return [this.gx + (i % this.cols) * (TW + GAP), this.gy + Math.floor(i / this.cols) * (TH + GAP)]; }
  panelRect(i) { const pw = 182, g = 12, x0 = (W - (4 * pw + 3 * g)) / 2; return [x0 + i * (pw + g), 348, pw, 208]; }
  colorOf(s) { return s.type === 'cpu' ? CPU_COLOR : PLAYER_COLORS[s.i]; }

  draw(ctx) {
    const t = this.t, app = this.app;
    skyBack(ctx, t);
    // header
    ctx.fillStyle = 'rgba(20,14,10,0.55)'; ctx.fillRect(0, 0, W, 52);
    ctx.fillStyle = '#e8402a'; ctx.fillRect(0, 50, W, 4);
    txt(ctx, 'CHOOSE YOUR FIGHTER', W / 2, 27, { font: 'carter', size: 32, fill: ['#fff27a', '#ffb21c'], lw: 7, shadow: 3 });

    // grid
    this.roster.forEach((def, i) => {
      const [x, y] = this.tileXY(i), pal = def.costumes[0].pal, col = pal.main || '#8aa';
      const h = hot(app, x, y, TW, TH);
      rr(ctx, x + 3, y + 4, TW, TH, 10); ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fill();
      rr(ctx, x, y, TW, TH, 10); fs(ctx, lighten(col, 0.45), OUT, 3);
      ctx.save(); rr(ctx, x + 2, y + 2, TW - 4, TH - 4, 8); ctx.clip();
      ctx.fillStyle = dots(ctx, lighten(col, 0.25), null, 14, 2.6); ctx.fillRect(x, y, TW, TH);
      ctx.restore();
      drawPortrait(ctx, def, 0, x + 4, y + 4, TW - 8, TH - 24, { r: 7 });
      rr(ctx, x + 2, y + TH - 22, TW - 4, 20, 6); ctx.fillStyle = darken(col, 0.45); ctx.fill();
      txt(ctx, def.name, x + TW / 2, y + TH - 11, { font: 'boog', size: 15, fill: '#ffffff', lw: 3, maxW: TW - 10 });
      rr(ctx, x, y, TW, TH, 10); ctx.strokeStyle = h ? '#ffffff' : OUT; ctx.lineWidth = 3; ctx.stroke();
    });
    // cursors (drawn after all tiles so they sit on top)
    const onTile = {};
    for (const s of this.slots) {
      if (s.type === 'none' || (s.type === 'cpu' && s.random)) continue;
      const [x, y] = this.tileXY(s.cur), k = (onTile[s.cur] = (onTile[s.cur] || 0) + 1) - 1, col = this.colorOf(s);
      const pulse = s.locked ? 0 : Math.sin(t * 0.2) * 2, inset = -3 - k * 4 - pulse;
      rr(ctx, x + inset, y + inset, TW - inset * 2, TH - inset * 2, 12); ctx.strokeStyle = OUT; ctx.lineWidth = 7; ctx.stroke();
      rr(ctx, x + inset, y + inset, TW - inset * 2, TH - inset * 2, 12); ctx.strokeStyle = col; ctx.lineWidth = 4; ctx.stroke();
      const tx = x + 14 + k * 30, ty = y - 2;
      rrect(ctx, tx - 14, ty - 10, 30, 18, 6, col, OUT, 2.5);
      txt(ctx, s.type === 'cpu' ? 'CPU' : 'P' + (s.i + 1), tx + 1, ty, { font: 'boog', size: 13, fill: '#ffffff', lw: 2.5 });
      if (s.locked) star(ctx, x + TW - 10 - k * 18, y + 10, 9, 4.2, 5, '#ffd92e', OUT, 2);
    }

    // player panels
    for (const s of this.slots) {
      const [x, y, w, h] = this.panelRect(s.i), col = s.type === 'none' ? '#7d8796' : this.colorOf(s);
      const pop = 1 + (s.pop / 14) * 0.08;
      ctx.save(); ctx.translate(x + w / 2, y + h / 2); ctx.scale(pop, pop); ctx.translate(-(x + w / 2), -(y + h / 2));
      rr(ctx, x + 3, y + 5, w, h, 12); ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fill();
      rr(ctx, x, y, w, h, 12); fs(ctx, s.type === 'none' ? 'rgba(255,255,255,0.35)' : '#fff7e0', OUT, 3);
      rr(ctx, x, y, w, 30, 12); fs(ctx, col, OUT, 3);
      ctx.fillStyle = col; ctx.fillRect(x + 1.5, y + 16, w - 3, 14); ctx.fillStyle = OUT; ctx.fillRect(x, y + 29, w, 3);
      const head = s.type === 'human' ? 'P' + (s.i + 1) + '  ' + this.devLabel(s.dev) : s.type === 'cpu' ? 'CPU   LEVEL ' + s.level : 'EMPTY';
      txt(ctx, head, x + w / 2, y + 16, { font: 'boog', size: 16, fill: '#ffffff', lw: 3.2, maxW: w - 14 });
      if (s.type === 'none') {
        txt(ctx, 'PRESS ATTACK', x + w / 2, y + 96, { font: 'chewy', size: 19, fill: '#ffffff', lw: 4 });
        txt(ctx, 'TO JOIN', x + w / 2, y + 120, { font: 'chewy', size: 19, fill: '#ffffff', lw: 4 });
        txt(ctx, 'or click for a CPU', x + w / 2, y + 150, { font: 'pixel', size: 9, fill: '#ffffff', lw: 2.5 });
      } else if (s.type === 'cpu' && s.random) {
        txt(ctx, '?', x + w / 2, y + 100, { font: 'titan', size: 86, fill: ['#ffffff', '#cfd6e0'], lw: 9, shadow: 4, rot: Math.sin(t * 0.06) * 0.08 });
        txt(ctx, 'RANDOM', x + w / 2, y + 168, { font: 'chewy', size: 22, fill: OUT, lw: 0, stroke: null });
        txt(ctx, 'surprise opponent', x + w / 2, y + 190, { font: 'pixel', size: 9, fill: '#6a5a4a', lw: 0, stroke: null });
      } else if (s.d) {
        const def = s.d.def, sc = Math.min(1.9, 100 / Math.max(def.stats.h || 60, (def.stats.w || 30) * 1.1));
        // little stage
        ctx.beginPath(); ctx.ellipse(x + w / 2, y + 150, 62, 12, 0, 0, Math.PI * 2); fs(ctx, lighten(col, 0.55), OUT, 2.5);
        shadow(ctx, x + w / 2, y + 150, 30, 0.2);
        ctx.save(); rr(ctx, x + 3, y + 33, w - 6, h - 36, 9); ctx.clip();
        drawDummy(ctx, s.d, x + w / 2, y + 150, sc, 1);
        ctx.restore();
        txt(ctx, def.name, x + w / 2, y + 176, { font: 'chewy', size: 21, fill: OUT, lw: 0, stroke: null, maxW: w - 12 });
        txt(ctx, def.costumes[s.d.costume % def.costumes.length].name.toUpperCase(), x + w / 2, y + 195, { font: 'pixel', size: 9, fill: '#6a5a4a', lw: 0, stroke: null, maxW: w - 12 });
        if (s.locked) {
          ctx.save(); ctx.translate(x + w - 40, y + 58); ctx.rotate(0.2); const k = ease.back(1 - s.pop / 14);
          ctx.scale(k, k);
          rrect(ctx, -34, -13, 68, 26, 6, '#44c13a', OUT, 3); txt(ctx, 'READY!', 0, 1, { font: 'boog', size: 17, fill: '#ffffff', lw: 3 });
          ctx.restore();
        }
      }
      ctx.restore();
    }

    if (this.canStart()) {
      const k = ease.back(clamp(this.startT / 12, 0, 1)), w = 300 * k, hh = 50 * k;
      ctx.save(); ctx.translate(W / 2, 325); ctx.rotate(-0.03);
      rrect(ctx, -w / 2, -hh / 2, w, hh, 14, t % 30 < 15 ? '#ffd92e' : '#ffb21c', OUT, 4);
      if (k > 0.9) txt(ctx, 'PRESS START!', 0, 2, { font: 'carter', size: 30, fill: '#ffffff', lw: 6, shadow: 3 });
      ctx.restore();
    }
    this.hints(ctx);
  }

  devLabel(d) {
    if (!d) return '';
    if (d.type === 'pad') return 'PAD ' + (d.index + 1);
    return this.app.input.split ? (d.id === 'kbA' ? 'KEYS: WASD' : 'KEYS: ARROWS') : 'KEYBOARD';
  }
  hints(ctx) {
    const inp = this.app.input, me = this.humans()[0];
    if (!me) return;
    if (me.dev.type === 'pad') {
      const p = me.dev.style === 'ps' ? ['✕', '○', '□', '△', 'OPTIONS'] : ['A', 'B', 'X', 'Y', 'START'];
      hintBar(ctx, this.app, [['PICK', p[0]], ['BACK', p[1]], [me.locked ? 'CPU LEVEL' : 'COSTUME', p[2]], ['CPUS', p[3]], ['GO', p[4]]]);
    } else {
      const k = inp.keys[me.dev.tableName], L = (a) => keyLabel(k[a][0]);
      hintBar(ctx, this.app, [['PICK', L('attack')], ['BACK', L('special')], [me.locked ? 'CPU LEVEL' : 'COSTUME', L('shield')], ['CPUS', L('grab')], ['GO', L('start')]]);
    }
  }
}
