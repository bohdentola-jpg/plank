// Cosmetic effects: dust puffs, hit bursts, stars, KO blasts, floating words.
// Nothing here affects the simulation.

import { RNG, TAU, clamp, ease } from '../core/util.js';
import { OUT, burstPath, starPath, txt, fs, rgba, lighten, darken } from '../core/gfx.js';

export class Fx {
  constructor(m) {
    this.m = m;
    this.list = [];
    this.rng = new RNG(4242);
    this.quality = 1;      // 0 low, 1 normal
  }
  add(p) { if (this.list.length < 420) this.list.push(p); return p; }
  r(a, b) { return this.rng.range(a, b); }

  update() {
    const L = this.list;
    for (let i = L.length - 1; i >= 0; i--) {
      const p = L[i];
      p.t++;
      p.x += p.vx || 0; p.y += p.vy || 0;
      if (p.g) p.vy += p.g;
      if (p.drag) { p.vx *= p.drag; p.vy *= p.drag; }
      if (p.vr) p.rot += p.vr;
      if (p.t >= p.life) { L[i] = L[L.length - 1]; L.pop(); }
    }
  }

  // ---- emitters -----------------------------------------------------------
  dust(x, y, n = 3) {
    for (let i = 0; i < n; i++) this.add({ k: 'puff', x: x + this.r(-10, 10), y: y - this.r(1, 6), vx: this.r(-1.4, 1.4), vy: this.r(-0.9, -0.2), life: this.r(14, 24) | 0, t: 0, s: this.r(5, 9), c: '#efe6d2', drag: 0.92 });
  }
  puff(x, y, n = 4, c = '#f4f0e6') {
    for (let i = 0; i < n; i++) {
      const a = this.r(0, TAU), sp = this.r(0.6, 2.6);
      this.add({ k: 'puff', x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 0.4, life: this.r(16, 28) | 0, t: 0, s: this.r(6, 12), c, drag: 0.9 });
    }
  }
  smoke(x, y, c = '#8d8f98', s = 10) {
    this.add({ k: 'puff', x, y, vx: this.r(-0.5, 0.5), vy: this.r(-1.6, -0.6), life: this.r(22, 36) | 0, t: 0, s: this.r(s * 0.7, s * 1.2), c, drag: 0.96 });
  }
  spark(x, y, n = 4, c = '#fff3a0') {
    for (let i = 0; i < n; i++) {
      const a = this.r(0, TAU), sp = this.r(2, 6.5);
      this.add({ k: 'spark', x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: this.r(8, 15) | 0, t: 0, s: this.r(2, 3.6), c, drag: 0.86 });
    }
  }
  stars(x, y, n = 4, c = '#ffd92e') {
    for (let i = 0; i < n; i++) {
      const a = this.r(-Math.PI, 0), sp = this.r(1.5, 4.5);
      this.add({ k: 'star', x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 1, g: 0.16, life: this.r(26, 44) | 0, t: 0, s: this.r(5, 9), c, rot: this.r(0, 6), vr: this.r(-0.25, 0.25) });
    }
  }
  ring(x, y, r = 20, c = '#ffffff') { this.add({ k: 'ring', x, y, life: 14, t: 0, s: r, c }); }
  burst(x, y, r = 30, c = '#ffffff') { this.add({ k: 'burst', x, y, life: 10, t: 0, s: r, c, seed: (this.rng.next() * 99) | 0, rot: this.r(0, 6) }); }
  trail(x, y, c) { this.add({ k: 'puff', x: x + this.r(-6, 6), y: y + this.r(-6, 6), vx: 0, vy: 0, life: 14, t: 0, s: this.r(7, 11), c: '#ffffff' }); }
  drops(x, y, n = 5, c = '#6ec6ff') {
    for (let i = 0; i < n; i++) {
      const a = this.r(-Math.PI * 0.9, -Math.PI * 0.1), sp = this.r(2, 6);
      this.add({ k: 'drop', x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, g: 0.3, life: this.r(18, 30) | 0, t: 0, s: this.r(2.5, 4.5), c });
    }
  }
  flame(x, y, n = 3, c = '#ff8a1e') {
    for (let i = 0; i < n; i++) this.add({ k: 'flame', x: x + this.r(-6, 6), y: y + this.r(-4, 4), vx: this.r(-0.8, 0.8), vy: this.r(-2.2, -0.8), life: this.r(12, 20) | 0, t: 0, s: this.r(6, 11), c });
  }
  zap(x, y, n = 3, c = '#fff04a') {
    for (let i = 0; i < n; i++) this.add({ k: 'zap', x, y, life: 7, t: 0, s: this.r(16, 30), c, rot: this.r(0, TAU), seed: (this.rng.next() * 99) | 0 });
  }
  debris(x, y, n = 5, c = '#b98a4e') {
    for (let i = 0; i < n; i++) {
      const a = this.r(-Math.PI, 0), sp = this.r(2, 6);
      this.add({ k: 'chip', x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 1, g: 0.34, life: this.r(22, 40) | 0, t: 0, s: this.r(3, 6), c, rot: this.r(0, 6), vr: this.r(-0.4, 0.4) });
    }
  }
  confetti(x, y, n = 12) {
    const cols = ['#e8402a', '#2f7fe0', '#f2b81c', '#35a84a', '#ffffff', '#ff7bc0'];
    for (let i = 0; i < n; i++) {
      const a = this.r(-Math.PI, 0), sp = this.r(2, 8);
      this.add({ k: 'chip', x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 2, g: 0.14, drag: 0.97, life: this.r(50, 90) | 0, t: 0, s: this.r(4, 7), c: this.rng.pick(cols), rot: this.r(0, 6), vr: this.r(-0.4, 0.4) });
    }
  }
  word(x, y, s, o = {}) {
    this.add({ k: 'word', x, y, vx: 0, vy: o.vy === undefined ? -0.6 : o.vy, life: o.life || 40, t: 0, s: o.size || 22, c: o.color || '#ffe23a', str: s, font: o.font || 'bangers', rot: o.rot || this.r(-0.15, 0.15) });
  }
  bubble(x, y, s = 6) { this.add({ k: 'bub', x, y, vx: this.r(-0.3, 0.3), vy: this.r(-1.4, -0.6), life: this.r(30, 60) | 0, t: 0, s }); }

  // the impact graphic for a landed hit; power 0..1.5
  hit(x, y, kind = 'punch', power = 0.5) {
    const big = power > 0.75;
    const col = kind === 'fire' ? '#ff9a1f' : kind === 'elec' ? '#fff04a' : kind === 'water' ? '#8fd6ff' : kind === 'slash' ? '#ffffff' : kind === 'goo' ? '#9be04a' : '#ffe23a';
    this.add({ k: 'burst', x, y, life: big ? 12 : 9, t: 0, s: 18 + power * 26, c: col, seed: (this.rng.next() * 99) | 0, rot: this.r(0, 6), core: true });
    this.spark(x, y, 3 + ((power * 5) | 0), '#ffffff');
    if (kind === 'fire') this.flame(x, y, 4);
    else if (kind === 'elec') this.zap(x, y, 3);
    else if (kind === 'water') this.drops(x, y, 6);
    else if (kind === 'goo') this.drops(x, y, 6, '#8ed63c');
    if (big) { this.stars(x, y, 3); this.ring(x, y, 30 + power * 20, '#ffffff'); }
  }

  // the big send-off when someone crosses a blast line
  koBlast(x, y, side, color) {
    const ang = side === 'l' ? 0 : side === 'r' ? Math.PI : side === 't' ? Math.PI / 2 : -Math.PI / 2;
    this.add({ k: 'ko', x, y, life: 46, t: 0, rot: ang, c: color, seed: (this.rng.next() * 99) | 0 });
    for (let i = 0; i < 16; i++) {
      const a = ang + this.r(-0.5, 0.5), sp = this.r(5, 16);
      this.add({ k: 'chip', x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, g: 0.1, drag: 0.96, life: this.r(30, 60) | 0, t: 0, s: this.r(5, 10), c: i % 2 ? color : '#ffffff', rot: this.r(0, 6), vr: this.r(-0.5, 0.5) });
    }
  }

  // ---- drawing -----------------------------------------------------------
  draw(ctx) {
    for (const p of this.list) {
      const u = p.t / p.life;
      switch (p.k) {
        case 'puff': {
          const s = p.s * (0.6 + u * 0.9);
          ctx.globalAlpha = clamp(1.25 - u * 1.25, 0, 1) * 0.9;
          ctx.beginPath(); ctx.arc(p.x, p.y, s, 0, TAU);
          ctx.fillStyle = p.c; ctx.fill();
          ctx.strokeStyle = rgba('#3a2d22', 0.55); ctx.lineWidth = 1.6; ctx.stroke();
          ctx.globalAlpha = 1; break;
        }
        case 'spark': {
          ctx.strokeStyle = p.c; ctx.lineWidth = p.s * (1 - u) + 0.6; ctx.lineCap = 'round';
          ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - p.vx * 2.2, p.y - p.vy * 2.2); ctx.stroke();
          break;
        }
        case 'star': {
          ctx.globalAlpha = clamp(2 - u * 2, 0, 1);
          starPath(ctx, p.x, p.y, p.s, p.s * 0.45, 5, p.rot); fs(ctx, p.c, OUT, 1.8);
          ctx.globalAlpha = 1; break;
        }
        case 'ring': {
          ctx.globalAlpha = 1 - u;
          ctx.beginPath(); ctx.arc(p.x, p.y, p.s * (0.4 + ease.out(u) * 1.1), 0, TAU);
          ctx.strokeStyle = p.c; ctx.lineWidth = 4 * (1 - u) + 1; ctx.stroke();
          ctx.globalAlpha = 1; break;
        }
        case 'burst': {
          const s = p.s * (0.55 + ease.out(Math.min(1, u * 2.4)) * 0.6);
          ctx.globalAlpha = clamp(1.7 - u * 1.7, 0, 1);
          burstPath(ctx, p.x, p.y, s, s * 0.52, 9, p.seed + 1, p.rot); fs(ctx, p.c, OUT, 2.2);
          if (p.core) { burstPath(ctx, p.x, p.y, s * 0.55, s * 0.3, 7, p.seed + 5, p.rot + 0.4); fs(ctx, '#ffffff', null, 0); }
          ctx.globalAlpha = 1; break;
        }
        case 'drop': {
          ctx.globalAlpha = clamp(1.6 - u * 1.6, 0, 1);
          ctx.beginPath(); ctx.arc(p.x, p.y, p.s, 0, TAU); ctx.fillStyle = p.c; ctx.fill();
          ctx.strokeStyle = darken(p.c, 0.45); ctx.lineWidth = 1.4; ctx.stroke();
          ctx.globalAlpha = 1; break;
        }
        case 'flame': {
          const s = p.s * (1 - u * 0.7);
          ctx.globalAlpha = clamp(1.5 - u * 1.5, 0, 1);
          ctx.beginPath();
          ctx.moveTo(p.x, p.y - s * 1.5);
          ctx.quadraticCurveTo(p.x + s, p.y - s * 0.2, p.x, p.y + s * 0.7);
          ctx.quadraticCurveTo(p.x - s, p.y - s * 0.2, p.x, p.y - s * 1.5);
          fs(ctx, u < 0.4 ? '#ffe45c' : p.c, darken(p.c, 0.5), 1.6);
          ctx.globalAlpha = 1; break;
        }
        case 'zap': {
          let s = p.seed * 7 + p.t * 13;
          const rnd = () => ((s = (s * 9301 + 49297) % 233280) / 233280) - 0.5;
          ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot);
          ctx.beginPath(); ctx.moveTo(0, 0);
          for (let i = 1; i <= 4; i++) ctx.lineTo((p.s * i) / 4, rnd() * 12);
          ctx.strokeStyle = OUT; ctx.lineWidth = 5; ctx.lineJoin = 'miter'; ctx.stroke();
          ctx.strokeStyle = p.c; ctx.lineWidth = 2.4; ctx.stroke();
          ctx.restore(); break;
        }
        case 'chip': {
          ctx.globalAlpha = clamp(3 - u * 3, 0, 1);
          ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot);
          ctx.fillStyle = p.c; ctx.fillRect(-p.s / 2, -p.s / 3, p.s, p.s * 0.66);
          ctx.strokeStyle = OUT; ctx.lineWidth = 1.2; ctx.strokeRect(-p.s / 2, -p.s / 3, p.s, p.s * 0.66);
          ctx.restore(); ctx.globalAlpha = 1; break;
        }
        case 'bub': {
          ctx.globalAlpha = clamp(2 - u * 2, 0, 1) * 0.8;
          ctx.beginPath(); ctx.arc(p.x + Math.sin(p.t * 0.2) * 2, p.y, p.s, 0, TAU);
          ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.fill();
          ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.5; ctx.stroke();
          ctx.globalAlpha = 1; break;
        }
        case 'word': {
          const pop = ease.back(Math.min(1, p.t / 7));
          ctx.globalAlpha = clamp(3 - u * 3, 0, 1);
          txt(ctx, p.str, p.x, p.y, { font: p.font, size: p.s * pop, fill: p.c, lw: Math.max(3, p.s * 0.2), rot: p.rot, shadow: 2 });
          ctx.globalAlpha = 1; break;
        }
        case 'ko': {
          // a fat beam of light firing back in from the edge of the screen
          const w = (1 - u) * 90 + 10, len = 2200;
          ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot);
          ctx.globalAlpha = clamp(1.4 - u * 1.4, 0, 1);
          ctx.fillStyle = p.c;
          ctx.beginPath(); ctx.moveTo(-60, -w); ctx.lineTo(len, -w * 0.35); ctx.lineTo(len, w * 0.35); ctx.lineTo(-60, w); ctx.closePath(); ctx.fill();
          ctx.fillStyle = lighten(p.c, 0.55);
          ctx.beginPath(); ctx.moveTo(-60, -w * 0.55); ctx.lineTo(len, -w * 0.15); ctx.lineTo(len, w * 0.15); ctx.lineTo(-60, w * 0.55); ctx.closePath(); ctx.fill();
          ctx.fillStyle = '#ffffff';
          ctx.beginPath(); ctx.moveTo(-60, -w * 0.22); ctx.lineTo(len, -w * 0.04); ctx.lineTo(len, w * 0.04); ctx.lineTo(-60, w * 0.22); ctx.closePath(); ctx.fill();
          // streaks
          let s = p.seed * 31;
          const rnd = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
          ctx.strokeStyle = '#ffffff'; ctx.lineCap = 'round';
          for (let i = 0; i < 9; i++) {
            const yy = (rnd() - 0.5) * w * 3.2, x0 = rnd() * 500 + u * 900;
            ctx.lineWidth = 2 + rnd() * 4;
            ctx.beginPath(); ctx.moveTo(x0, yy); ctx.lineTo(x0 + 120 + rnd() * 200, yy * 0.8); ctx.stroke();
          }
          ctx.restore(); ctx.globalAlpha = 1; break;
        }
      }
    }
  }
}
