// Title screen and main menu.

import { W, H } from '../core/config.js';
import { clamp, ease } from '../core/util.js';
import { OUT, txt, shadow, checker } from '../core/gfx.js';
import { FIGHTERS } from '../fighters/index.js';
import { dummyFighter, tickDummy, drawDummy } from '../game/render.js';
import { sunburst, drawLogo, ButtonList, CornerButtons } from './ui.js';

export class TitleScene {
  constructor(app, skipIntro) {
    this.app = app; this.t = skipIntro ? 60 : 0;
    this.menu = new ButtonList(app, [
      { label: 'BRAWL!', color: '#44c13a', size: 30 },
      { label: 'HOW TO PLAY', color: '#2f9bea' },
      { label: 'OPTIONS', color: '#ff9d1c' },
      { label: 'CREDITS', color: '#b06be0' },
    ], W / 2 - 125, 318, 250, 48, 12);
    this.corner = new CornerButtons(app);
    // six of the cast stand either side of the menu; every few seconds one swaps out
    const roster = FIGHTERS.filter((f) => !f.stub);
    this.roster = roster; this.nextUp = 0;
    this.spots = [70, 150, 228, 572, 650, 730].map((x, i) => ({ x, d: null, swap: 0, show: 0, i }));
    for (const sp of this.spots) this.fill(sp);
  }
  fill(sp) {
    const def = this.roster[this.nextUp % this.roster.length]; this.nextUp++;
    sp.d = dummyFighter(def, Math.floor(this.nextUp / this.roster.length) % def.costumes.length); sp.d.t = sp.i * 17; sp.swap = 18;
  }
  enter() { this.app.audio.playMusic('menu'); }
  update() {
    const app = this.app; this.t++;
    for (const sp of this.spots) {
      if (sp.swap > 0) sp.swap--;
      if (this.roster.length > this.spots.length && this.t % 200 === 100 + sp.i * 30 % 200 && this.t > 100 && (this.t / 200 | 0) % this.spots.length === sp.i) this.fill(sp);
      if (sp.show === 0 && this.t % 170 === (sp.i * 41) % 170) { sp.d.state = 'win'; sp.d.sf = 0; sp.show = 50; }
      if (sp.show > 0 && --sp.show === 0) sp.d.state = 'idle';
      tickDummy(sp.d);
    }
    this.corner.update();
    if (this.t < 30) return;
    const mn = app.input.menu();
    const pick = this.menu.update(mn);
    if (pick === 0) import('./select.js').then((m) => app.go(() => new m.SelectScene(app, { dev: mn.dev })));
    else if (pick === 1) import('./howto.js').then((m) => app.go(() => new m.HowToScene(app)));
    else if (pick === 2) import('./options.js').then((m) => app.go(() => new m.OptionsScene(app)));
    else if (pick === 3) import('./credits.js').then((m) => app.go(() => new m.CreditsScene(app)));
  }
  draw(ctx) {
    const t = this.t;
    sunburst(ctx, t);
    // lino floor
    ctx.save(); ctx.fillStyle = checker(ctx, '#f4efe2', '#d9d2c0', 20); ctx.translate(0, 536); ctx.fillRect(0, 0, W, 64); ctx.restore();
    ctx.fillStyle = OUT; ctx.fillRect(0, 533, W, 4);
    // the cast
    for (const sp of this.spots) {
      const pop = ease.back(1 - sp.swap / 18);
      shadow(ctx, sp.x, 562, sp.d.w * 0.5, 0.2);
      drawDummy(ctx, sp.d, sp.x, 560, pop, sp.x < W / 2 ? 1 : -1);
    }
    const drop = ease.bounce(clamp(t / 40, 0, 1));
    drawLogo(ctx, W / 2, -200 + drop * 352, 0.74, t);
    if (t >= 30) this.menu.draw(ctx);
    this.corner.draw(ctx);
    txt(ctx, 'v' + this.app.version, W - 10, H - 12, { font: 'pixel', size: 10, fill: '#ffffff', lw: 3, align: 'right' });
  }
}
