// Stage select, with the match rules along the top.

import { W, H } from '../core/config.js';
import { clamp, vrng } from '../core/util.js';
import { OUT, txt, rr, fs, rrect, lighten, darken, para } from '../core/gfx.js';
import { STAGES } from '../stages/index.js';
import { fighterById } from '../fighters/index.js';
import { drawPortrait } from '../game/render.js';
import { skyBack, hot, clicked, hintBar } from './ui.js';
import { BattleScene } from './battle.js';

const TW = 140, TH = 86, GAP = 8;
const TIMES = [0, 2, 3, 5, 8];

export class StageScene {
  constructor(app, players, selectScene) {
    this.app = app; this.players = players; this.selectScene = selectScene; this.t = 0;
    this.stages = STAGES.filter((s) => !s.stub);
    this.items = this.stages.concat([{ id: '?', name: 'RANDOM', blurb: 'Let fate decide. Fate likes the hard ones.' }]);
    this.cols = Math.min(5, this.items.length); this.rows = Math.ceil(this.items.length / this.cols);
    this.gx = (W - (this.cols * TW + (this.cols - 1) * GAP)) / 2;
    this.gy = 112 + (3 - this.rows) * (TH + GAP) / 2;      // fewer rows: centre the grid in its space
    this.sel = clamp(app.settings.lastStage || 0, 0, this.items.length - 1);
    this.area = 'grid'; this.rule = 0;
    this.rules = Object.assign({ stocks: 3, time: 0, items: true, hazards: true }, app.settings.rules);
  }
  enter() { this.app.audio.playMusic('menu'); }

  ruleText(i) {
    const r = this.rules;
    return [`STOCKS: ${r.stocks}`, `TIME: ${r.time ? r.time + ':00' : 'OFF'}`, `ITEMS: ${r.items ? 'ON' : 'OFF'}`, `HAZARDS: ${r.hazards ? 'ON' : 'OFF'}`][i];
  }
  bump(i, d = 1) {
    const r = this.rules;
    if (i === 0) r.stocks = ((r.stocks - 1 + d + 9) % 9) + 1;
    else if (i === 1) r.time = TIMES[(TIMES.indexOf(r.time) + d + TIMES.length) % TIMES.length];
    else if (i === 2) r.items = !r.items; else r.hazards = !r.hazards;
    this.app.audio.sfx('ui_move');
  }
  ruleRect(i) { const w = 172, g = 10, x0 = (W - (4 * w + 3 * g)) / 2; return [x0 + i * (w + g), 62, w, 36]; }
  tileXY(i) { return [this.gx + (i % this.cols) * (TW + GAP), this.gy + Math.floor(i / this.cols) * (TH + GAP)]; }

  go() {
    if (this.going) return; this.going = true;
    const app = this.app, it = this.items[this.sel];
    const stage = it.id === '?' ? vrng.pick(this.stages).id : it.id;
    app.settings.rules = Object.assign({}, this.rules); app.settings.lastStage = this.sel; app.save();
    const cfg = { stage, players: this.players, rules: { stocks: this.rules.stocks, time: this.rules.time * 60, items: this.rules.items, hazards: this.rules.hazards }, selectScene: this.selectScene, stagePick: it.id };
    app.audio.sfx('ui_ok'); app.audio.stopMusic();
    app.go(() => new BattleScene(app, cfg));
  }
  back() { this.app.audio.sfx('ui_back'); const s = this.selectScene; s.enterAgain(); this.app.go(() => s); }

  update() {
    const app = this.app, mn = app.input.menu(), n = this.items.length, c = this.cols;
    this.t++;
    if (this.t < 10) return;
    if (this.area === 'grid') {
      let col = this.sel % c, row = Math.floor(this.sel / c), moved = false;
      if (mn.left) { col = (col + c - 1) % c; moved = true; }
      if (mn.right) { col = (col + 1) % c; moved = true; }
      if (mn.down) { row = (row + 1) % this.rows; moved = true; }
      if (mn.up) { if (row === 0) { this.area = 'rules'; app.audio.sfx('ui_move'); } else { row--; moved = true; } }
      if (moved) { this.sel = clamp(row * c + col, 0, n - 1); app.audio.sfx('ui_move'); }
      if (mn.ok || mn.start) this.go();
    } else {
      if (mn.left) { this.rule = (this.rule + 3) % 4; app.audio.sfx('ui_move'); }
      if (mn.right) { this.rule = (this.rule + 1) % 4; app.audio.sfx('ui_move'); }
      if (mn.ok) this.bump(this.rule, 1);
      if (mn.alt) this.bump(this.rule, -1);
      if (mn.down) { this.area = 'grid'; app.audio.sfx('ui_move'); }
      if (mn.start) this.go();
    }
    if (mn.back) { this.back(); return; }
    for (let i = 0; i < 4; i++) { const [x, y, w, h] = this.ruleRect(i); if (clicked(app, x, y, w, h)) { this.rule = i; this.bump(i, 1); } }
    for (let i = 0; i < n; i++) {
      const [x, y] = this.tileXY(i);
      if (hot(app, x, y, TW, TH) && app.input.mouse.moved === 0 && this.sel !== i) { this.sel = i; this.area = 'grid'; }
      if (clicked(app, x, y, TW, TH)) { this.sel = i; this.go(); }
    }
  }

  draw(ctx) {
    const t = this.t, app = this.app;
    skyBack(ctx, t);
    ctx.fillStyle = 'rgba(20,14,10,0.55)'; ctx.fillRect(0, 0, W, 52);
    ctx.fillStyle = '#2f7fe0'; ctx.fillRect(0, 50, W, 4);
    txt(ctx, 'PICK A STAGE', W / 2, 27, { font: 'carter', size: 32, fill: ['#fff27a', '#ffb21c'], lw: 7, shadow: 3 });
    // rules
    for (let i = 0; i < 4; i++) {
      const [x, y, w, h] = this.ruleRect(i), on = this.area === 'rules' && this.rule === i;
      rrect(ctx, x, y + 3, w, h, 10, OUT, null, 0);
      rrect(ctx, x, y, w, h, 10, on ? '#ffd92e' : '#fff7e0', OUT, 3);
      txt(ctx, this.ruleText(i), x + w / 2, y + h / 2 + 1, { font: 'boog', size: 19, fill: OUT, lw: 0, stroke: null });
      if (on) { rr(ctx, x - 4, y - 4, w + 8, h + 8, 13); ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 3; ctx.stroke(); }
    }
    // grid
    this.items.forEach((s, i) => {
      const [x, y] = this.tileXY(i), on = this.area === 'grid' && this.sel === i;
      rr(ctx, x + 3, y + 4, TW, TH, 10); ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fill();
      ctx.save(); rr(ctx, x, y, TW, TH, 10); ctx.clip();
      if (s.thumb) { ctx.translate(x, y); try { s.thumb(ctx, TW, TH, t); } catch (e) { ctx.fillStyle = '#89a'; ctx.fillRect(0, 0, TW, TH); } }
      else { ctx.fillStyle = '#3a3f55'; ctx.fillRect(x, y, TW, TH); txt(ctx, '?', x + TW / 2, y + TH / 2 - 6, { font: 'titan', size: 54, fill: ['#ffffff', '#cfd6e0'], lw: 7 }); }
      ctx.restore();
      rr(ctx, x, y + TH - 20, TW, 20, 0); ctx.fillStyle = 'rgba(20,14,10,0.72)';
      ctx.save(); rr(ctx, x, y, TW, TH, 10); ctx.clip(); ctx.fillRect(x, y + TH - 20, TW, 20); ctx.restore();
      txt(ctx, s.name, x + TW / 2, y + TH - 9, { font: 'boog', size: 14, fill: '#ffffff', lw: 0, stroke: null, maxW: TW - 10 });
      rr(ctx, x, y, TW, TH, 10); ctx.strokeStyle = OUT; ctx.lineWidth = 3; ctx.stroke();
      if (on) {
        const p = Math.sin(t * 0.2) * 2;
        rr(ctx, x - 4 - p, y - 4 - p, TW + 8 + p * 2, TH + 8 + p * 2, 13); ctx.strokeStyle = OUT; ctx.lineWidth = 8; ctx.stroke();
        rr(ctx, x - 4 - p, y - 4 - p, TW + 8 + p * 2, TH + 8 + p * 2, 13); ctx.strokeStyle = '#ffd92e'; ctx.lineWidth = 4.5; ctx.stroke();
      }
    });
    // info card for the highlighted stage
    const s = this.items[this.sel], y = 112 + 3 * (TH + GAP) + 8, h = H - 34 - y;
    rrect(ctx, 34, y + 4, W - 68, h, 12, 'rgba(0,0,0,0.3)', null, 0);
    rrect(ctx, 34, y, W - 68, h, 12, '#fff7e0', OUT, 3);
    txt(ctx, s.name, 52, y + 24, { font: 'carter', size: 26, fill: ['#ff7a4d', '#e8402a'], lw: 5, align: 'left', maxW: W - 250 });
    para(ctx, s.blurb || '', 52, y + 44, W - 260, { size: 15, lh: 18, fill: '#3a2d22' });
    if (s.home) {
      const def = fighterById(s.home);
      if (def && def.id === s.home && !def.stub) {
        rrect(ctx, W - 106, y + 8, 56, 56, 9, '#ffffff', OUT, 2.5);
        drawPortrait(ctx, def, 0, W - 104, y + 10, 52, 52, { r: 8 });
        txt(ctx, 'HOME OF', W - 116, y + 24, { font: 'pixel', size: 9, fill: '#6a5a4a', lw: 0, stroke: null, align: 'right' });
        txt(ctx, def.name, W - 116, y + 44, { font: 'boog', size: 17, fill: OUT, lw: 0, stroke: null, align: 'right', maxW: 140 });
      }
    }
    hintBar(ctx, app, [['MOVE', 'ARROWS'], ['FIGHT', 'ENTER'], ['BACK', 'ESC'], ['RULES: UP, THEN OK', '']]);
  }
}
