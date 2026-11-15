// Shared menu furniture: the logo, backdrops, mouse-or-buttons widgets.

import { W, H } from '../core/config.js';
import { clamp, ease, TAU } from '../core/util.js';
import { OUT, txt, rr, fs, rays, vgrad, button, panel, lighten, darken, dots, checker, circle, star, polygon, rrect, line, cloud } from '../core/gfx.js';

// ---- pointer helper: is the mouse over this box, and was it just clicked? ----
export function hot(app, x, y, w, h) {
  const m = app.input.mouse;
  return m.moved < 240 && m.x >= x && m.x <= x + w && m.y >= y && m.y <= y + h;
}
export function clicked(app, x, y, w, h) {
  const m = app.input.mouse;
  return m.pressed && m.x >= x && m.x <= x + w && m.y >= y && m.y <= y + h;
}

// A vertical list of glossy buttons driven by stick/keys or the mouse.
export class ButtonList {
  constructor(app, items, x, y, w, h, gap) {
    this.app = app; this.items = items; this.x = x; this.y = y; this.w = w; this.h = h; this.gap = gap; this.sel = 0; this.t = 0;
  }
  // returns the index chosen this frame, or -1
  update(mn) {
    const a = this.app, n = this.items.length;
    this.t++;
    if (mn.up) { this.sel = (this.sel + n - 1) % n; a.audio.sfx('ui_move'); }
    if (mn.down) { this.sel = (this.sel + 1) % n; a.audio.sfx('ui_move'); }
    for (let i = 0; i < n; i++) {
      const by = this.y + i * (this.h + this.gap);
      if (hot(a, this.x, by, this.w, this.h) && a.input.mouse.moved === 0 && this.sel !== i) { this.sel = i; a.audio.sfx('ui_move'); }
      if (clicked(a, this.x, by, this.w, this.h)) { this.sel = i; a.audio.sfx('ui_ok'); return i; }
    }
    if (mn.ok) { a.audio.sfx('ui_ok'); return this.sel; }
    return -1;
  }
  draw(ctx) {
    this.items.forEach((it, i) => {
      const by = this.y + i * (this.h + this.gap);
      const pop = ease.back(clamp((this.t - i * 3) / 14, 0, 1));
      ctx.save(); ctx.translate(this.x + this.w / 2, by + this.h / 2); ctx.scale(pop, pop); ctx.translate(-(this.x + this.w / 2), -(by + this.h / 2));
      button(ctx, this.x, by, this.w, this.h, it.label, i === this.sel ? 1 : 0, { color: it.color || '#ff9d1c', pulse: this.app.t, size: it.size });
      ctx.restore();
    });
  }
}

// ---- backdrops ----
export function sunburst(ctx, t, a = '#ffcf3a', b = '#ffb21c', cx = W / 2, cy = H * 0.42) {
  ctx.fillStyle = a; ctx.fillRect(0, 0, W, H);
  rays(ctx, cx, cy, 760, 24, t * 0.004, a, b);
  const g = ctx.createRadialGradient(cx, cy, 20, cx, cy, 520);
  g.addColorStop(0, 'rgba(255,255,255,0.55)'); g.addColorStop(0.5, 'rgba(255,255,255,0.08)'); g.addColorStop(1, 'rgba(120,40,0,0.25)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
}
export function skyBack(ctx, t) {
  vgrad(ctx, 0, 0, W, H, ['#7fd3f7', '#56b6ee', '#3a8fdc']);
  ctx.save(); ctx.globalAlpha = 0.14;
  rays(ctx, W / 2, H * 0.4, 760, 28, t * 0.003, 'rgba(255,255,255,0)', '#ffffff');
  ctx.restore();
  ctx.save(); ctx.globalAlpha = 0.9;
  for (let i = 0; i < 5; i++) cloud(ctx, ((i * 197 + t * (0.15 + i * 0.04)) % (W + 200)) - 100, 70 + i * 62 + (i % 2) * 30, 0.8 + (i % 3) * 0.3, '#ffffff');
  ctx.restore();
}
// a chalkboard in a wooden frame, for the reading screens
export function chalkboard(ctx, t, title) {
  ctx.fillStyle = '#c98b4b'; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#a56c33'; for (let i = 0; i < 9; i++) ctx.fillRect(0, i * 70 + 30, W, 3);
  rr(ctx, 22, 22, W - 44, H - 44, 10); fs(ctx, '#2f6b4f', OUT, 5);
  rr(ctx, 30, 30, W - 60, H - 60, 6); ctx.strokeStyle = 'rgba(0,0,0,0.25)'; ctx.lineWidth = 3; ctx.stroke();
  // chalk dust smears
  ctx.save(); rr(ctx, 32, 32, W - 64, H - 64, 6); ctx.clip();
  ctx.globalAlpha = 0.06; ctx.fillStyle = '#ffffff';
  for (let i = 0; i < 7; i++) { ctx.beginPath(); ctx.ellipse(120 + i * 110, 150 + (i % 3) * 140, 150, 40, -0.3 + i * 0.2, 0, TAU); ctx.fill(); }
  ctx.restore();
  // tray
  rrect(ctx, 60, H - 34, W - 120, 14, 4, '#b47a3c', OUT, 3);
  rrect(ctx, 110, H - 40, 34, 8, 3, '#ffffff', OUT, 2); rrect(ctx, 160, H - 40, 26, 8, 3, '#ffd84a', OUT, 2); rrect(ctx, W - 190, H - 42, 54, 12, 3, '#3a3f55', OUT, 2);
  if (title) txt(ctx, title, W / 2, 74, { font: 'hand', size: 46, fill: '#ffffff', lw: 0, stroke: null });
  if (title) { ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 3; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(W / 2 - 170, 102); ctx.quadraticCurveTo(W / 2, 110, W / 2 + 170, 100); ctx.stroke(); }
}
export const chalk = (ctx, s, x, y, o = {}) => txt(ctx, s, x, y, Object.assign({ font: 'hand', size: 22, fill: '#ffffff', lw: 0, stroke: null, align: 'left' }, o));

// ---- the logo ----
export function drawLogo(ctx, x, y, s = 1, t = 0) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  const wob = Math.sin(t * 0.05) * 0.012;
  ctx.rotate(-0.045 + wob);
  // starburst behind
  ctx.save(); ctx.rotate(t * 0.006);
  star(ctx, 0, 6, 250, 190, 14, '#e8402a', OUT, 6);
  star(ctx, 0, 6, 232, 176, 14, '#ff6a3d', null, 0);
  ctx.restore();
  // "COMPUTER LAB" on a ribbon
  ctx.save(); ctx.translate(0, -70); ctx.rotate(-0.02);
  polygon(ctx, [-236, -30, 236, -30, 252, 0, 236, 30, -236, 30, -252, 0], '#2f7fe0', OUT, 5);
  polygon(ctx, [-228, -23, 228, -23, 240, 0, 228, 23, -228, 23, -240, 0], '#4f9bf0', null, 0);
  txt(ctx, 'COMPUTER LAB', 0, 2, { font: 'carter', size: 46, fill: ['#ffffff', '#dcecff'], lw: 8, shadow: 4 });
  ctx.restore();
  // "BRAWL"
  txt(ctx, 'BRAWL', 0, 34, { font: 'carter', size: 150, fill: ['#fff27a', '#ffb21c'], gradMid: 0.5, lw: 20, stroke2: '#ffffff', lw2: 12, shadow: 10 });
  // a little cursor arrow tucked on the L, because it is a computer lab
  ctx.save(); ctx.translate(222, 84); ctx.rotate(-0.3); ctx.scale(1.5, 1.5);
  polygon(ctx, [0, 0, 0, 30, 8, 23, 14, 36, 20, 33, 14, 21, 24, 21], '#ffffff', OUT, 3);
  ctx.restore();
  ctx.restore();
}

// corner toggles (sound, quality, fullscreen): small pixel-text buttons
export class CornerButtons {
  constructor(app) { this.app = app; }
  list() {
    const s = this.app.settings;
    return [
      { label: s.muted ? 'SOUND: OFF' : 'SOUND: ON', do: () => { s.muted = !s.muted; this.app.audio.setMuted(s.muted); this.app.save(); } },
      { label: 'QUALITY: ' + ['LOW', 'MED', 'HIGH'][s.quality], do: () => { this.app.setQuality((s.quality + 2) % 3); } },
      { label: 'FULL SCREEN', do: () => this.app.toggleFullscreen() },
    ];
  }
  update() {
    const L = this.list(); let x = 12;
    for (const b of L) { const w = b.label.length * 8 + 16; if (clicked(this.app, x, H - 26, w, 18)) { b.do(); this.app.audio.sfx('click'); } x += w + 8; }
    const rp = this.app.input.rawPressed;
    if (rp.includes('KeyM')) { L[0].do(); }
  }
  draw(ctx) {
    const L = this.list(); let x = 12;
    for (const b of L) {
      const w = b.label.length * 8 + 16, h = hot(this.app, x, H - 26, w, 18);
      rrect(ctx, x, H - 26, w, 18, 5, h ? '#ffffff' : 'rgba(255,255,255,0.75)', OUT, 2);
      txt(ctx, b.label, x + w / 2, H - 16, { font: 'pixel', size: 10, fill: OUT, lw: 0, stroke: null });
      x += w + 8;
    }
  }
}

// keycap / pad-button glyphs for the how-to and hint bars
export function keycap(ctx, label, x, y, o = {}) {
  const w = o.w || Math.max(26, label.length * 9 + 14), h = o.h || 26;
  rrect(ctx, x, y + 3, w, h, 6, '#9aa3b5', OUT, 2);
  rrect(ctx, x, y, w, h, 6, o.fill || '#f4f6fb', OUT, 2);
  txt(ctx, label, x + w / 2, y + h / 2 + 1, { font: 'boog', size: o.size || 15, fill: OUT, lw: 0, stroke: null });
  return w;
}
export function padBtn(ctx, label, x, y, color = '#3a3f55') {
  circle(ctx, x, y + 2, 12, darken(color, 0.4), OUT, 2);
  circle(ctx, x, y, 12, color, OUT, 2);
  txt(ctx, label, x, y + 1, { font: 'boog', size: label.length > 1 ? 11 : 15, fill: '#ffffff', lw: 0, stroke: null });
}
// "MOVE [keys]  PICK [key] ..." strip along the bottom
export function hintBar(ctx, app, parts) {
  let total = 0; const sizes = parts.map((p) => { const w = 8 + p[0].length * 6.8 + (p[1] ? p[1].length * 8 + 22 : 0) + 16; total += w; return w; });
  let x = (W - total) / 2; const y = H - 24;
  ctx.fillStyle = 'rgba(20,14,10,0.55)'; ctx.fillRect(0, y - 8, W, 32);
  parts.forEach((p, i) => {
    txt(ctx, p[0], x, y + 8, { font: 'pixel', size: 10, fill: '#ffffff', lw: 0, stroke: null, align: 'left' });
    if (p[1]) keycap(ctx, p[1], x + p[0].length * 6.8 + 8, y - 3, { h: 20, size: 12, w: p[1].length * 8 + 14 });
    x += sizes[i];
  });
}
