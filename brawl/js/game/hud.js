// Damage plates along the bottom, the clock, and the big announcer lettering.

import { W, H, PLAYER_DARK } from '../core/config.js';
import { clamp, ease, fmtTime, TAU } from '../core/util.js';
import { OUT, txt, rr, fs, rrect, circle, mix, lighten, darken, star, polygon, rays, starPath } from '../core/gfx.js';
import { drawPortrait } from './render.js';

export function pctColor(p) {
  if (p < 40) return mix('#ffffff', '#ffe45c', p / 40);
  if (p < 90) return mix('#ffe45c', '#ff8a1e', (p - 40) / 50);
  if (p < 150) return mix('#ff8a1e', '#e8402a', (p - 90) / 60);
  return mix('#e8402a', '#8f1410', clamp((p - 150) / 100, 0, 1));
}

export function drawHud(ctx, m) {
  const F = m.fighters, n = F.length;
  const pw = n > 3 ? 178 : 196, gap = n > 3 ? 14 : 30;
  const total = n * pw + (n - 1) * gap;
  let x = (W - total) / 2;
  for (const f of F) { plate(ctx, m, f, x, H - 74, pw); x += pw + gap; }
  if (m.rules.time && m.state !== 'intro') clock(ctx, m);
}

function plate(ctx, m, f, x, y, w) {
  const h = 62, dead = f.out;
  const hs = f._hudShake || 0;
  if (f._hudPct === undefined) f._hudPct = f.pct;
  if (f.pct > f._hudPct + 0.01) f._hudShake = 10;
  f._hudPct = f.pct;
  if (f._hudShake > 0) f._hudShake--;
  ctx.save();
  if (dead) ctx.globalAlpha = 0.45;
  // plate
  rr(ctx, x + 3, y + 5, w, h, 12); ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fill();
  const g = ctx.createLinearGradient(0, y, 0, y + h);
  g.addColorStop(0, lighten(f.color, 0.25)); g.addColorStop(1, darken(f.color, 0.18));
  rr(ctx, x, y, w, h, 12); fs(ctx, g, OUT, 3);
  rr(ctx, x + 4, y + 3, w - 8, h * 0.38, 9); ctx.fillStyle = 'rgba(255,255,255,0.2)'; ctx.fill();
  // portrait
  const pr = 50;
  rr(ctx, x + 6, y + 6, pr, pr, 9); fs(ctx, '#fff7e0', OUT, 2.5);
  drawPortrait(ctx, f.def, f.costume, x + 7, y + 7, pr - 2, pr - 2, { r: 8 });
  rr(ctx, x + 6, y + 6, pr, pr, 9); ctx.strokeStyle = OUT; ctx.lineWidth = 2.5; ctx.stroke();
  // tag
  txt(ctx, f.tag, x + 6 + pr / 2, y + h - 1, { font: 'boog', size: 15, fill: '#ffffff', lw: 3.5 });
  // name
  txt(ctx, f.def.name, x + pr + 14, y + h - 11, { font: 'boog', size: 15, fill: '#ffffff', lw: 3.2, align: 'left', maxW: w - pr - 22 });
  // damage
  const dx = x + pr + 14 + (hs ? (hs % 2 ? 2 : -2) : 0), dy = y + 25 + (hs ? ((hs >> 1) % 2 ? 1.5 : -1.5) : 0);
  if (dead) txt(ctx, 'OUT', dx, dy, { font: 'titan', size: 26, fill: '#cfcfcf', align: 'left', lw: 5 });
  else if (f.state === 'dead') txt(ctx, '. . .', dx, dy, { font: 'titan', size: 26, fill: '#ffffff', align: 'left', lw: 5 });
  else {
    const p = Math.floor(f.pct), col = pctColor(f.pct), sz = 36 + (hs > 5 ? (hs - 5) * 1.6 : 0);
    const s = String(p);
    ctx.font = `${sz}px 'Titan One'`;
    const tw = ctx.measureText(s).width;
    txt(ctx, s, dx, dy, { font: 'titan', size: sz, fill: [lighten(col, 0.25), col], align: 'left', lw: 6, shadow: 2 });
    txt(ctx, f.def.stamina ? '/' + f.def.stamina : '%', dx + tw + 2, dy + 5, { font: 'titan', size: f.def.stamina ? 15 : 20, fill: col, align: 'left', lw: 4.5 });
  }
  // stocks
  if (m.rules.stocks) {
    const sx = x + w - 10, sy = y - 9;
    if (f.stocks > 5) {
      stockDot(ctx, sx - 26, sy, f); txt(ctx, 'x' + f.stocks, sx, sy + 1, { font: 'boog', size: 15, align: 'right', lw: 3.2 });
    } else for (let i = 0; i < f.stocks; i++) stockDot(ctx, sx - 8 - i * 19, sy, f);
  } else {
    const sc = m.score(f);
    txt(ctx, (sc > 0 ? '+' : '') + sc, x + w - 12, y - 8, { font: 'titan', size: 18, align: 'right', lw: 4, fill: sc > 0 ? '#bfff7a' : sc < 0 ? '#ffb0a0' : '#ffffff' });
  }
  // gold star in hand
  if (f.superReady) {
    const t = m.real * 0.12;
    ctx.save(); ctx.translate(x + 8, y + 8); ctx.rotate(Math.sin(t) * 0.25); ctx.scale(1 + Math.sin(t * 2) * 0.1, 1 + Math.sin(t * 2) * 0.1);
    star(ctx, 0, 0, 13, 6, 5, '#ffd92e', OUT, 2.5);
    ctx.restore();
  }
  const hk = f.def.hooks;
  if (hk && hk.drawHud && !dead) hk.drawHud(ctx, f, x, y, w, m);
  ctx.restore();
}

function stockDot(ctx, x, y, f) {
  circle(ctx, x, y, 8, '#fff7e0', OUT, 2.2);
  drawPortrait(ctx, f.def, f.costume, x - 7, y - 7, 14, 14, { r: 7 });
  ctx.beginPath(); ctx.arc(x, y, 8, 0, TAU); ctx.strokeStyle = OUT; ctx.lineWidth = 2.2; ctx.stroke();
}

function clock(ctx, m) {
  const x = W / 2, y = 30, low = m.timer <= 600;
  rrect(ctx, x - 52, y - 19, 104, 38, 12, low && m.real % 30 < 15 ? '#ffd0c4' : '#fff7e0', OUT, 3);
  txt(ctx, fmtTime(m.timer), x, y + 1, { font: 'titan', size: 25, fill: low ? '#e8402a' : '#2b2118', lw: 0, stroke: null });
}

// ---- announcer lettering, countdown, super cut-in ----
export function drawOverlay(ctx, m) {
  for (const o of m.overlays) o.draw(ctx, m);
  for (const c of m.cines) if (c.drawScreen) c.drawScreen(ctx, m);
  const c = m.count;
  if (c) {
    const u = c.t / 38, s = 1 + ease.out3(clamp(u * 3, 0, 1)) * 0.25 - clamp((u - 0.6) * 2, 0, 1) * 0.3;
    ctx.save(); ctx.globalAlpha = clamp(2.6 - u * 2.6, 0, 1);
    const big = m.state === 'intro';
    txt(ctx, c.n, W / 2, big ? H / 2 - 50 : 96, { font: 'titan', size: (big ? 150 : 70) * s, fill: ['#fff6b0', '#ffb81c'], lw: big ? 16 : 9, stroke2: '#ffffff', lw2: 8, shadow: 7 });
    ctx.restore();
  }
  const b = m.banner;
  if (b) {
    const u = b.t / b.life;
    let s = b.pop ? ease.back(clamp(b.t / 12, 0, 1)) : 1;
    ctx.save();
    ctx.globalAlpha = clamp((1 - u) * 6, 0, 1);
    if (b.big) {
      const bw = ease.out3(clamp(b.t / 14, 0, 1));
      ctx.fillStyle = 'rgba(20,14,10,0.55)'; ctx.fillRect(0, H / 2 - 100 - 2, W * bw, 104);
      ctx.fillStyle = '#e8402a'; ctx.fillRect(0, H / 2 - 100, W * bw, 6); ctx.fillRect(W - W * bw, H / 2 - 4, W * bw, 6);
    }
    txt(ctx, b.text, W / 2, b.y || H / 2 - 50, {
      font: b.font || 'carter', size: (b.size || 60) * s, fill: b.color ? [lighten(b.color, 0.45), b.color] : ['#ffffff', '#dfe8f5'],
      lw: Math.max(6, (b.size || 60) * 0.13), stroke2: '#ffffff', lw2: 7, shadow: 6, rot: b.pop ? -0.05 : 0, maxW: W - 40,
    });
    ctx.restore();
  }
  if (m.cut) cutIn(ctx, m);
}

function cutIn(ctx, m) {
  const c = m.cut, f = c.f, t = c.t;
  const a = clamp(t / 6, 0, 1) * clamp((44 - t) / 6, 0, 1);
  ctx.save();
  ctx.globalAlpha = a * 0.55; ctx.fillStyle = '#0d0a12'; ctx.fillRect(0, 0, W, H);
  ctx.globalAlpha = a;
  // slanted band
  const slide = (1 - ease.out3(clamp(t / 9, 0, 1))) * W;
  ctx.translate(-slide, 0);
  ctx.beginPath(); ctx.moveTo(0, 210); ctx.lineTo(W, 170); ctx.lineTo(W, 350); ctx.lineTo(0, 390); ctx.closePath();
  ctx.save(); ctx.clip();
  rays(ctx, 150, 280, 900, 26, m.real * 0.03, f.color, lighten(f.color, 0.22));
  ctx.restore();
  ctx.strokeStyle = OUT; ctx.lineWidth = 5; ctx.stroke();
  ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2; ctx.stroke();
  // portrait
  rr(ctx, 46, 196, 168, 168, 22); fs(ctx, '#fff7e0', OUT, 5);
  drawPortrait(ctx, f.def, f.costume, 50, 200, 160, 160, { r: 18 });
  rr(ctx, 46, 196, 168, 168, 22); ctx.strokeStyle = OUT; ctx.lineWidth = 5; ctx.stroke();
  const name = (f.def.superName || 'SUPER MOVE').toUpperCase();
  txt(ctx, name, 236, 262, { font: 'carter', size: 52, fill: ['#fffbd0', '#ffd21f'], align: 'left', lw: 9, shadow: 5, maxW: W - 260, rot: -0.03 });
  txt(ctx, f.def.name, 240, 316, { font: 'chewy', size: 26, fill: '#ffffff', align: 'left', lw: 5, maxW: W - 260 });
  ctx.restore();
}
