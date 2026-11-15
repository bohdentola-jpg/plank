// LOADING... - the neutral stage. One flat platform, no tricks: you are
// fighting on a progress bar that has been stuck at 99% since 2009.

import { W, H } from '../core/config.js';
import { TAU } from '../core/util.js';
import { mkSolid } from '../game/physics.js';
import { OUT, rr, fs, txt, rays, vgrad, stripes, lighten, circle, rrect } from '../core/gfx.js';

function bar(ctx, x, y, w, h, t, pct = 0.99) {
  // casing
  rr(ctx, x - 6, y + 5, w + 12, h + 4, 18); ctx.fillStyle = 'rgba(0,0,0,0.28)'; ctx.fill();
  rr(ctx, x - 6, y - 2, w + 12, h + 4, 18); fs(ctx, '#f4f6fb', OUT, 4);
  rr(ctx, x, y + 6, w, h - 12, 12); fs(ctx, '#27374d', OUT, 2.5);
  // the fill: candy stripes sliding along
  ctx.save();
  rr(ctx, x + 3, y + 9, (w - 6) * pct, h - 18, 9); ctx.clip();
  ctx.translate((t * 0.6) % 32, 0);
  ctx.fillStyle = stripes(ctx, '#5fd13a', '#8be85c', 16);
  ctx.fillRect(x - 40, y, w + 80, h);
  ctx.restore();
  rr(ctx, x + 3, y + 9, (w - 6) * pct, (h - 18) * 0.45, 8); ctx.fillStyle = 'rgba(255,255,255,0.3)'; ctx.fill();
  rr(ctx, x + 3, y + 9, (w - 6) * pct, h - 18, 9); ctx.strokeStyle = OUT; ctx.lineWidth = 2; ctx.stroke();
}

export default {
  id: 'loading', name: 'LOADING...', home: 'clicky',
  blurb: 'Flat, fair, and stuck at 99%.',
  music: 'lab',
  build(m) {
    return {
      solids: [mkSolid(-290, 0, 580, 56, { id: 'bar' })],
      plats: [],
      blast: { l: -790, r: 790, t: -620, b: 340 },
      cam: { l: -650, r: 650, t: -500, b: 270 },
      spawns: [[-180, 0], [180, 0], [-65, 0], [65, 0]],
      respawn: [0, -200],
      focusX: 0, focusY: -60, t: 0,
      update() { this.t++; },
      drawBg(ctx, m) {
        const t = this.t, cam = m.cam;
        vgrad(ctx, 0, 0, W, H, ['#9be3f5', '#55b9e6', '#2f7fd0']);
        const px = -cam.x * 0.06, py = -cam.y * 0.06;
        ctx.save(); ctx.globalAlpha = 0.16;
        rays(ctx, W / 2 + px, H * 0.46 + py, 760, 28, t * 0.0022, 'rgba(255,255,255,0)', '#ffffff');
        ctx.restore();
        // big faded caption
        const dots = '.'.repeat(1 + ((t / 30) | 0) % 3);
        ctx.save(); ctx.globalAlpha = 0.2;
        txt(ctx, 'LOADING' + dots, W / 2 - 150 + px * 1.6, 150 + py * 1.6, { font: 'carter', size: 92, fill: '#ffffff', stroke: null, lw: 0, align: 'left' });
        ctx.restore();
        // spinner
        ctx.save(); ctx.translate(W - 110 + px * 2, 110 + py * 2);
        for (let i = 0; i < 10; i++) {
          const a = (i / 10) * TAU, on = ((t / 6) | 0) % 10;
          const k = ((i - on + 10) % 10) / 10;
          ctx.globalAlpha = 0.15 + (1 - k) * 0.5;
          circle(ctx, Math.cos(a) * 30, Math.sin(a) * 30, 6, '#ffffff', null, 0);
        }
        ctx.restore();
        // drifting chunks of progress
        ctx.save(); ctx.globalAlpha = 0.22; ctx.fillStyle = '#ffffff';
        for (let i = 0; i < 14; i++) {
          const sx = ((i * 137 + t * (0.2 + (i % 4) * 0.08)) % (W + 80)) - 40 + px * (1 + (i % 3));
          const sy = ((i * 89) % 420) + 40 + Math.sin(t * 0.01 + i) * 12 + py;
          const s = 8 + (i % 4) * 5;
          ctx.fillRect(sx, sy, s, s);
        }
        ctx.restore();
      },
      drawMid(ctx, m) {
        bar(ctx, -290, 0, 580, 56, this.t);
        txt(ctx, '99%', 0, 29, { font: 'titan', size: 24, fill: '#ffffff', lw: 5 });
        // a couple of rivets so it reads as a solid thing
        circle(ctx, -278, 28, 3.5, '#c3c9d6', OUT, 1.5); circle(ctx, 278, 28, 3.5, '#c3c9d6', OUT, 1.5);
      },
    };
  },
  thumb(ctx, w, h, t = 0) {
    vgrad(ctx, 0, 0, w, h, ['#9be3f5', '#55b9e6', '#2f7fd0']);
    ctx.save(); ctx.translate(w / 2, h * 0.62); ctx.scale(w / 760, w / 760);
    bar(ctx, -290, 0, 580, 56, t);
    txt(ctx, '99%', 0, 29, { font: 'titan', size: 24, fill: '#ffffff', lw: 5 });
    ctx.restore();
  },
};
