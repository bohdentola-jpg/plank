// A live, animated preview of your figure in a canvas: try-ons, the closet,
// the creator and capsule reveals all use it.
import { el } from './dom.js';
import { drawFigure } from '../art/figure.js';
import { rgba, mulberry32 } from '../ink.js';
import { tag } from '../art/graffiti.js';

export function figureView(o = {}) {
  const canvas = el('canvas', { class: 'figure-canvas', 'aria-hidden': 'true' });
  const wrap = el('div', { class: `figure-view ${o.className || ''}` }, canvas);
  const g = canvas.getContext('2d');
  let body = o.body, outfit = o.outfit || {};
  let pose = 'idle', poseUntil = 0, raf = 0, alive = true;
  const bursts = [];
  const seed = o.seed || 7;

  const size = () => {
    const r = wrap.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.max(10, Math.round(r.width * dpr));
    canvas.height = Math.max(10, Math.round(r.height * dpr));
  };
  const ro = 'ResizeObserver' in window ? new ResizeObserver(size) : null;
  if (ro) ro.observe(wrap);

  const loop = (ms) => {
    if (!alive) return;
    raf = requestAnimationFrame(loop);
    const t = ms / 1000;
    const W = canvas.width, H = canvas.height;
    if (W < 20 || H < 20) { size(); return; }
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, W, H);
    // backdrop: a scrap of graffiti wall
    if (o.backdrop !== false) {
      const bg = g.createRadialGradient(W / 2, H * 0.45, H * 0.1, W / 2, H * 0.5, H * 0.75);
      bg.addColorStop(0, o.glow || '#fff6e2');
      bg.addColorStop(1, o.bg || '#f1d9ae');
      g.fillStyle = bg;
      g.fillRect(0, 0, W, H);
      g.save();
      g.scale(H / 400, H / 400);
      const r = mulberry32(seed);
      for (let i = 0; i < 3; i++) tag(g, (W / (H / 400)) * (0.15 + r() * 0.7), 60 + r() * 220, { seed: seed + i * 11, alpha: 0.18, size: 30 + r() * 20 });
      g.restore();
      // floor shadow
      g.fillStyle = rgba('#140f26', 0.18);
      g.beginPath();
      g.ellipse(W / 2, H * 0.93, H * 0.16, H * 0.025, 0, 0, Math.PI * 2);
      g.fill();
    }
    const p = t < poseUntil ? pose : 'idle';
    const scale = (H * (o.fill || 0.78)) / 100;
    drawFigure(g, W / 2, H * 0.93, {
      body, outfit, scale, t, pose: p, view: 'front',
      blink: (t % 3.1) < 0.12 ? 1 : 0, boil: 11 + (Math.floor(t * 7) % 3) * 101,
    });
    // confetti
    for (let i = bursts.length - 1; i >= 0; i--) {
      const b = bursts[i];
      b.age += 1 / 60;
      b.vy += 0.35;
      b.x += b.vx;
      b.y += b.vy;
      if (b.age > 2) { bursts.splice(i, 1); continue; }
      g.save();
      g.translate(b.x * W, b.y);
      g.rotate(b.age * b.spin);
      g.fillStyle = b.c;
      g.fillRect(-4, -2, 8, 4);
      g.restore();
    }
  };
  requestAnimationFrame(() => { size(); raf = requestAnimationFrame(loop); });

  return {
    el: wrap,
    setOutfit(next) { outfit = next || {}; },
    setBody(next) { body = next; },
    play(name, secs = 1.6) {
      pose = name;
      poseUntil = performance.now() / 1000 + secs;
    },
    confetti(colors = ['#ff4f9a', '#ffd23f', '#3ec7b0', '#7b5cff', '#ff8a3d']) {
      const H = canvas.height;
      for (let i = 0; i < 60; i++) {
        bursts.push({ x: 0.5 + (Math.random() - 0.5) * 0.2, y: H * 0.45, vx: (Math.random() - 0.5) * 0.02, vy: -6 - Math.random() * 8, c: colors[i % colors.length], age: 0, spin: (Math.random() - 0.5) * 12 });
      }
    },
    destroy() {
      alive = false;
      cancelAnimationFrame(raf);
      if (ro) ro.disconnect();
    },
  };
}
