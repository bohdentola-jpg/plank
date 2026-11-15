// After the bell: winner on the podium, everyone else politely clapping.

import { W, H } from '../core/config.js';
import { clamp, ease, vrng } from '../core/util.js';
import { OUT, txt, rr, fs, rrect, lighten, darken, button, shadow } from '../core/gfx.js';
import { dummyFighter, tickDummy, drawDummy, drawPortrait } from '../game/render.js';
import { sunburst, hot, clicked } from './ui.js';
import { BattleScene } from './battle.js';

export class ResultsScene {
  constructor(app, cfg, m) {
    this.app = app; this.cfg = cfg; this.t = 0; this.sel = 0;
    const res = m.result || { order: m.fighters.map((f) => f.slot), stats: m.fighters.map((f) => Object.assign({ slot: f.slot }, f.stats)), reason: 'stock' };
    this.reason = res.reason;
    this.entries = res.order.map((slot, place) => {
      const f = m.fighters[slot];
      return { slot, place, def: f.def, costume: f.costume, tag: f.tag, color: f.color, st: res.stats[slot], d: dummyFighter(f.def, f.costume, place === 0 ? 'win' : 'lose') };
    });
    this.bySlot = this.entries.slice().sort((a, b) => a.slot - b.slot);
    this.btns = ['REMATCH', 'NEW FIGHTERS', 'MAIN MENU'];
    this.confetti = [];
  }
  enter() {
    const a = this.app.audio;
    a.playMusic('results'); a.sfx('j_win', { delay: 0.1 }); a.sfx('v_winner', { delay: 0.7 });
  }
  btnRect(i) { const w = 210, g = 16, x0 = (W - (3 * w + 2 * g)) / 2; return [x0 + i * (w + g), 540, w, 44]; }
  pick(i) {
    const app = this.app; if (this.gone) return; this.gone = true;
    app.audio.sfx('ui_ok');
    if (i === 0) { app.audio.stopMusic(); app.go(() => new BattleScene(app, this.cfg)); }
    else if (i === 1 && this.cfg.selectScene) { const s = this.cfg.selectScene; s.enterAgain(); app.go(() => s); }
    else if (i === 1) import('./select.js').then((m) => app.go(() => new m.SelectScene(app, {})));
    else import('./title.js').then((m) => app.go(() => new m.TitleScene(app, true)));
  }
  update() {
    const app = this.app; this.t++;
    for (const e of this.entries) tickDummy(e.d);
    if (this.t % 3 === 0 && this.confetti.length < 90) this.confetti.push({ x: vrng.range(0, W), y: -10, vx: vrng.range(-0.6, 0.6), vy: vrng.range(1.2, 2.8), r: vrng.range(0, 6), vr: vrng.range(-0.2, 0.2), c: vrng.pick(['#e8402a', '#2f7fe0', '#f2b81c', '#35a84a', '#ffffff', '#ff7bc0']), s: vrng.range(5, 9) });
    for (const c of this.confetti) { c.x += c.vx + Math.sin((this.t + c.s * 9) * 0.05) * 0.6; c.y += c.vy; c.r += c.vr; if (c.y > H + 10) { c.y = -10; c.x = vrng.range(0, W); } }
    if (this.t < 50) return;
    const mn = app.input.menu();
    if (mn.left) { this.sel = (this.sel + 2) % 3; app.audio.sfx('ui_move'); }
    if (mn.right) { this.sel = (this.sel + 1) % 3; app.audio.sfx('ui_move'); }
    for (let i = 0; i < 3; i++) { const [x, y, w, h] = this.btnRect(i); if (hot(app, x, y, w, h) && app.input.mouse.moved === 0) this.sel = i; if (clicked(app, x, y, w, h)) { this.sel = i; this.pick(i); } }
    if (mn.ok || mn.start) this.pick(this.sel);
    if (mn.back) this.pick(2);
  }
  draw(ctx) {
    const t = this.t, win = this.entries[0];
    sunburst(ctx, t, lighten(win.color, 0.5), lighten(win.color, 0.3), 250, 250);
    for (const c of this.confetti) { ctx.save(); ctx.translate(c.x, c.y); ctx.rotate(c.r); ctx.fillStyle = c.c; ctx.fillRect(-c.s / 2, -c.s / 3, c.s, c.s * 0.66); ctx.strokeStyle = OUT; ctx.lineWidth = 1; ctx.strokeRect(-c.s / 2, -c.s / 3, c.s, c.s * 0.66); ctx.restore(); }

    // podiums: winner big on the left, the rest lined up on the right
    const rise = ease.out3(clamp(t / 30, 0, 1));
    const wx = 215, wy = 372;
    rrect(ctx, wx - 110, wy + (1 - rise) * 200, 220, 60, 8, '#ffd92e', OUT, 4);
    txt(ctx, '1', wx, wy + 32 + (1 - rise) * 200, { font: 'titan', size: 40, fill: '#ffffff', lw: 7 });
    const sc = Math.min(2.7, 150 / Math.max(win.def.stats.h || 60, (win.def.stats.w || 30)));
    shadow(ctx, wx, wy + 2 + (1 - rise) * 200, 60, 0.22);
    drawDummy(ctx, win.d, wx, wy + (1 - rise) * 200, sc, 1);
    const others = this.entries.slice(1);
    others.forEach((e, i) => {
      const x = 470 + i * 112, y = 392 + i * 4, r2 = ease.out3(clamp((t - 10 - i * 8) / 30, 0, 1)), off = (1 - r2) * 200;
      rrect(ctx, x - 48, y + off, 96, 40 - i * 4, 6, ['#d9dfe8', '#e0a878', '#b9c2cf'][i] || '#b9c2cf', OUT, 3);
      txt(ctx, String(i + 2), x, y + 19 - i * 2 + off, { font: 'titan', size: 22, fill: '#ffffff', lw: 5 });
      shadow(ctx, x, y + 2 + off, 26, 0.2);
      drawDummy(ctx, e.d, x, y + off, Math.min(1.5, 84 / Math.max(e.def.stats.h || 60, e.def.stats.w || 30)), -1);
      txt(ctx, e.tag, x, y - 110 + off, { font: 'boog', size: 16, fill: '#ffffff', lw: 3.5 });
    });

    // headline
    const pop = ease.back(clamp((t - 12) / 16, 0, 1));
    txt(ctx, win.def.name + ' WINS!', W / 2, 52, { font: 'carter', size: 54 * pop, fill: ['#ffffff', lighten(win.color, 0.6)], lw: 11, stroke2: '#ffffff', lw2: 7, shadow: 6, maxW: W - 40, rot: -0.02 });
    txt(ctx, (win.tag === 'CPU' ? 'the computer takes it' : win.tag + ' takes it') + (this.reason === 'time' ? ' on the clock' : ''), W / 2, 96, { font: 'chewy', size: 20, fill: '#ffffff', lw: 4.5 });

    // the numbers
    const n = this.bySlot.length, cw = Math.min(170, (W - 150) / n), tx = 120, ty = 434;
    rrect(ctx, 24, ty - 4 + 4, W - 48, 100, 12, 'rgba(0,0,0,0.3)', null, 0);
    rrect(ctx, 24, ty - 4, W - 48, 100, 12, '#fff7e0', OUT, 3);
    ['KOs', 'FALLS', 'SELF-KOs', 'DAMAGE'].forEach((lab, r) => txt(ctx, lab, 40, ty + 38 + r * 16, { font: 'pixel', size: 10, fill: '#6a5a4a', lw: 0, stroke: null, align: 'left' }));
    this.bySlot.forEach((e, i) => {
      const x = tx + i * cw + cw / 2;
      rrect(ctx, x - cw / 2 + 6, ty + 2, cw - 12, 24, 7, e.color, OUT, 2.5);
      drawPortrait(ctx, e.def, e.costume, x - cw / 2 + 9, ty + 4, 20, 20, { r: 5 });
      txt(ctx, e.tag + '  ' + e.def.name, x + 10, ty + 15, { font: 'boog', size: 13, fill: '#ffffff', lw: 2.8, maxW: cw - 44 });
      [e.st.kos, e.st.falls, e.st.sds, Math.round(e.st.dealt) + '%'].forEach((v, r) => txt(ctx, v, x, ty + 38 + r * 16, { font: 'boog', size: 16, fill: OUT, lw: 0, stroke: null }));
    });

    this.btns.forEach((b, i) => { const [x, y, w, h] = this.btnRect(i); button(ctx, x, y, w, h, b, this.sel === i ? 1 : 0, { color: ['#44c13a', '#2f9bea', '#ff9d1c'][i], pulse: t, size: 21 }); });
  }
}
