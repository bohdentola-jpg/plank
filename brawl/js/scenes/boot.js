// The preloader (with the obligatory PLAY button: browsers, like Flash before
// them, won't make a sound until you click) and the studio card.

import { W, H } from '../core/config.js';
import { clamp, ease, TAU } from '../core/util.js';
import { OUT, txt, rr, fs, stripes, button, rrect, circle, ellipse, limb, eyes, mouth, lighten } from '../core/gfx.js';
import { skyBack, drawLogo, hot, clicked } from './ui.js';
import { TitleScene } from './title.js';

const FONTS = ['Titan One', 'Carter One', 'Chewy', 'Bangers', 'Comic Neue', 'Silkscreen', 'Schoolbell', 'Boogaloo'];

export class BootScene {
  constructor(app) {
    this.app = app; this.t = 0; this.p = 0; this.shown = 0; this.fonts = false; this.loaded = false; this.ready = false; this.readyT = 0;
    Promise.all(FONTS.map((f) => document.fonts.load(`700 20px "${f}"`).catch(() => {}))).then(() => { this.fonts = true; });
    app.audio.load((p) => { this.p = p; }).then(() => { this.loaded = true; }, () => { this.loaded = true; });
    setTimeout(() => { this.fonts = true; this.loaded = true; this.p = 1; }, 15000);    // never hang on a slow file
  }
  update() {
    const app = this.app;
    this.t++;
    this.shown += (this.p - this.shown) * 0.12;
    if (this.loaded && this.fonts && this.shown > 0.985 && !this.ready) { this.ready = true; this.shown = 1; }
    if (this.ready) {
      this.readyT++;
      const go = app.input.anyPressed || clicked(app, W / 2 - 120, 396, 240, 70);
      if (go && this.readyT > 8) { app.audio.unlock(); app.audio.sfx('ui_ok'); app.go(() => new SplashScene(app)); }
    }
  }
  draw(ctx) {
    skyBack(ctx, this.t);
    if (!this.fonts) return;
    drawLogo(ctx, W / 2, 205, 0.72, this.t);
    if (!this.ready) {
      const x = W / 2 - 190, y = 410, w = 380, h = 40;
      rr(ctx, x - 5, y - 1, w + 10, h + 2, 16); fs(ctx, '#f4f6fb', OUT, 4);
      rr(ctx, x, y + 5, w, h - 10, 10); fs(ctx, '#27374d', OUT, 2.5);
      ctx.save(); rr(ctx, x + 3, y + 8, Math.max(8, (w - 6) * this.shown), h - 16, 7); ctx.clip();
      ctx.translate((this.t * 0.8) % 32, 0); ctx.fillStyle = stripes(ctx, '#5fd13a', '#8be85c', 16); ctx.fillRect(x - 40, y, w + 80, h);
      ctx.restore();
      txt(ctx, 'LOADING ' + Math.round(this.shown * 100) + '%', W / 2, y + 66, { font: 'chewy', size: 26, fill: '#ffffff', lw: 5 });
    } else {
      const pop = ease.back(clamp(this.readyT / 16, 0, 1));
      ctx.save(); ctx.translate(W / 2, 431); ctx.scale(pop, pop); ctx.translate(-W / 2, -431);
      button(ctx, W / 2 - 120, 396, 240, 70, 'PLAY', hot(this.app, W / 2 - 120, 396, 240, 70) ? 1 : 0, { color: '#44c13a', pulse: this.t, size: 44 });
      ctx.restore();
      if (this.t % 60 < 40) txt(ctx, 'click, or press any key', W / 2, 496, { font: 'pixel', size: 10, fill: '#ffffff', lw: 3 });
    }
    txt(ctx, 'v' + this.app.version, W - 10, H - 10, { font: 'pixel', size: 10, fill: '#ffffff', lw: 3, align: 'right' });
  }
}

// "GLUE STICK GAMES presents": a made-up studio, because every web game had one.
export class SplashScene {
  constructor(app) { this.app = app; this.t = 0; }
  enter() { this.app.audio.sfx('pop', { delay: 0.35 }); this.app.audio.sfx('star_get', { delay: 0.5, vol: 0.6 }); }
  update() {
    this.t++;
    if (this.t > 150 || (this.t > 20 && (this.app.input.anyPressed || this.app.input.mouse.pressed))) this.app.go(() => new TitleScene(this.app));
  }
  draw(ctx) {
    const t = this.t;
    ctx.fillStyle = '#fff7e0'; ctx.fillRect(0, 0, W, H);
    const drop = ease.bounce(clamp(t / 34, 0, 1));
    ctx.save(); ctx.translate(W / 2, -160 + drop * 400); ctx.rotate(Math.sin(t * 0.06) * 0.04 - 0.1);
    // a glue stick with a face; its cap pops off
    const capUp = ease.out3(clamp((t - 30) / 14, 0, 1));
    rrect(ctx, -38, -70, 76, 150, 14, '#8a55d6', OUT, 6);
    rrect(ctx, -38, 52, 76, 28, 10, '#f2b81c', OUT, 6);
    rrect(ctx, -28, -34, 56, 60, 8, '#ffffff', OUT, 3);
    eyes(ctx, 0, -12, 8, 12, t > 44 ? 3 : 0, 0, 0, { lw: 2.4 });
    mouth(ctx, 0, 10, 18, t > 44 ? 3 : 0, { lw: 2.6 });
    rrect(ctx, -30, -96, 60, 30, 8, '#f4f6fb', OUT, 6);                 // the glue
    ctx.save(); ctx.translate(capUp * 70, -capUp * 86); ctx.rotate(capUp * 0.9);
    rrect(ctx, -42, -122, 84, 56, 12, '#6f3fc0', OUT, 6);
    ctx.restore();
    ctx.restore();
    const a = clamp((t - 40) / 16, 0, 1);
    ctx.globalAlpha = a;
    txt(ctx, 'GLUE STICK GAMES', W / 2, 432 + (1 - a) * 20, { font: 'carter', size: 54, fill: ['#b78cf0', '#8a55d6'], lw: 9, shadow: 5 });
    txt(ctx, 'presents', W / 2, 482, { font: 'hand', size: 30, fill: OUT, lw: 0, stroke: null });
    ctx.globalAlpha = 1;
  }
}
