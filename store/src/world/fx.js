// Particles + screen effects (vignette, film grain).
import { view } from '../engine.js';
import { rgba, noiseCanvas, makeCanvas, dot, text, FONTS } from '../ink.js';

export class Particles {
  constructor() { this.list = []; }

  add(p) {
    this.list.push({ life: 1, max: 1, vx: 0, vy: 0, g: 0, size: 3, color: '#fff', kind: 'dot', ...p, age: 0 });
    if (this.list.length > 400) this.list.shift();
  }

  burst(x, y, n, o = {}) {
    for (let i = 0; i < n; i++) {
      const a = (o.angle ?? -Math.PI / 2) + (Math.random() - 0.5) * (o.spread ?? Math.PI * 2);
      const sp = (o.speed ?? 160) * (0.4 + Math.random() * 0.8);
      this.add({
        x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, g: o.g ?? 400,
        life: (o.life ?? 0.7) * (0.6 + Math.random() * 0.6), size: (o.size ?? 3) * (0.6 + Math.random() * 0.8),
        color: Array.isArray(o.color) ? o.color[Math.floor(Math.random() * o.color.length)] : (o.color || '#ffd23f'),
        kind: o.kind || 'dot', add: o.add,
      });
    }
  }

  update(dt) {
    for (const p of this.list) {
      p.age += dt;
      p.vy += p.g * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.drag) { p.vx *= 1 - p.drag * dt; p.vy *= 1 - p.drag * dt; }
    }
    this.list = this.list.filter((p) => p.age < p.life);
  }

  draw(g) {
    for (const p of this.list) {
      const k = 1 - p.age / p.life;
      g.save();
      if (p.add) g.globalCompositeOperation = 'lighter';
      g.globalAlpha = Math.min(1, k * 1.6);
      if (p.kind === 'spark') {
        g.strokeStyle = p.color;
        g.lineWidth = p.size * 0.6;
        g.lineCap = 'round';
        g.beginPath();
        g.moveTo(p.x, p.y);
        g.lineTo(p.x - p.vx * 0.03, p.y - p.vy * 0.03);
        g.stroke();
      } else if (p.kind === 'text') {
        text(g, p.text, p.x, p.y, { size: p.size, font: p.font || FONTS.sign, fill: p.color, lw: p.size * 0.18 });
      } else if (p.kind === 'note') {
        text(g, p.text || '♪', p.x, p.y, { size: p.size, font: 'serif', fill: p.color, lw: 2.4 });
      } else if (p.kind === 'z') {
        text(g, 'z', p.x, p.y, { size: p.size, font: FONTS.marker, fill: p.color, lw: 2.4 });
      } else {
        dot(g, p.x, p.y, p.size * (p.shrink ? k : 1), p.color);
      }
      g.restore();
    }
  }
}

// ---------------------------------------------------------------- screen fx

let vignette = null, vigKey = '';
let grain = null, grainPattern = null;

export function drawScreenFx(g, t, o = {}) {
  const W = g.canvas.width, H = g.canvas.height;
  const key = `${W}x${H}:${o.tint || ''}`;
  if (key !== vigKey) {
    vignette = makeCanvas(W, H);
    const vg = vignette.getContext('2d');
    const r = Math.hypot(W, H) / 2;
    const grad = vg.createRadialGradient(W / 2, H * 0.55, r * 0.35, W / 2, H * 0.5, r * 1.05);
    grad.addColorStop(0, 'rgba(8,4,20,0)');
    grad.addColorStop(1, o.tint || 'rgba(8,4,20,0.7)');
    vg.fillStyle = grad;
    vg.fillRect(0, 0, W, H);
    vigKey = key;
  }
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.drawImage(vignette, 0, 0);
  if (view.quality >= 1 && !o.noGrain) {
    if (!grain) {
      grain = noiseCanvas(192, 13, 34);
      grainPattern = g.createPattern(grain, 'repeat');
    }
    const fr = Math.floor(t * 12);
    g.save();
    g.globalCompositeOperation = 'overlay';
    g.globalAlpha = 0.55;
    g.translate((fr * 67) % 192, (fr * 131) % 192);
    g.fillStyle = grainPattern;
    g.fillRect(-192, -192, W + 384, H + 384);
    g.restore();
  }
}
