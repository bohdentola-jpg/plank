// STORY UI — small shared pieces: money, ordinals, colour helpers, and the
// two things everything on the board is made of: sheets of paper pinned up
// slightly crooked, and rubber stamps.
import { C, vText, vWidth, text, statBar, BODY_FONT } from '../../core/ui.js';
import { RANKS, rankOf, rankProgress } from '../../story/rep.js';

export const money = (n) => '$' + Math.round(n).toLocaleString();
export const ord = (n) => `${n}${['TH', 'ST', 'ND', 'RD'][(n % 100 >= 11 && n % 100 <= 13) ? 0 : n % 10] || 'TH'}`;
export const PAPER = '#f1ecdc', INK = '#16140f', SUBINK = '#5a5446';
export const NIGHT = '#14151a', NIGHT_INK = '#f1ecdc', NIGHT_SUB = '#9aa0ac';

export function hexA(hex, a) {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

/** A sheet pinned up at (x, y), w×h, turned by rot; fn draws in sheet space. */
export function paper(ctx, x, y, w, h, opts, fn) {
  const { rot = 0.015, color = PAPER, band = null, pin = '#c21c1c', bandH = 8 } = opts || {};
  ctx.save();
  ctx.translate(x + w / 2, y + h / 2);
  ctx.rotate(rot);
  ctx.translate(-w / 2, -h / 2);
  ctx.shadowColor = 'rgba(0,0,0,0.6)';
  ctx.shadowBlur = 18;
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, w, h);
  ctx.shadowBlur = 0;
  if (band) { ctx.fillStyle = band; ctx.fillRect(0, 0, w, bandH); }
  fn?.(w, h);
  if (pin) {
    ctx.fillStyle = pin;
    ctx.beginPath(); ctx.arc(w / 2, 14, 7, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}

/** A rubber stamp: a box round big type, centred on (cx, cy). */
export function stamp(ctx, label, cx, cy, opts = {}) {
  const size = opts.size || 26;
  const col = opts.color || '#c21c1c';
  const tw = vWidth(label, size);
  const w = opts.w || tw + size * 1.1, h = size * 1.75;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(opts.rot ?? -0.1);
  ctx.globalAlpha *= opts.alpha ?? 0.92;
  ctx.strokeStyle = col;
  ctx.lineWidth = opts.line || 3;
  ctx.strokeRect(-w / 2, -h / 2, w, h);
  if (opts.double) ctx.strokeRect(-w / 2 + 5, -h / 2 + 5, w - 10, h - 10);
  vText(ctx, label, 0, size / 2, Math.min(size, (w - 16) / Math.max(1, vWidth(label, 1))), { align: 'center', color: col, skew: 0 });
  ctx.restore();
}

/** Word-wrap without drawing: the lines a paragraph() would print. */
export function wrap(ctx, str, maxW, opts = {}) {
  ctx.save();
  ctx.font = `${opts.italic ? 'italic ' : ''}${opts.weight || 600} ${opts.size || 16}px ${opts.font || BODY_FONT}`;
  const lines = [];
  let line = '';
  for (const w of String(str).split(/\s+/)) {
    const test = line ? line + ' ' + w : w;
    if (ctx.measureText(test).width > maxW && line) { lines.push(line); line = w; } else line = test;
  }
  if (line) lines.push(line);
  ctx.restore();
  return lines;
}

/** Street rank: title, REP, and the bar to the next rank. */
export function drawRank(ctx, rep, x, y, w, opts = {}) {
  const k = rankOf(rep);
  const next = RANKS[k + 1];
  text(ctx, opts.label ?? 'STREET RANK', x, y, { size: 11, color: C.dim, weight: 800, spacing: 2 });
  text(ctx, `${Math.round(rep).toLocaleString()} REP`, x + w, y, { size: 12, color: C.cyan, weight: 900, align: 'right', spacing: 1 });
  const name = RANKS[k].name;
  vText(ctx, name, x, y + 30, Math.min(opts.size || 22, w / Math.max(1, vWidth(name, 1))), { color: opts.color || '#fff' });
  statBar(ctx, x, y + 40, w, 8, next ? rankProgress(rep) : 1, { segments: 24, color: C.cyan });
  text(ctx, next ? `NEXT: ${next.name} AT ${next.rep.toLocaleString()}` : 'TOP OF THE CITY', x, y + 64, { size: 11, color: C.dim, weight: 800, spacing: 1.5 });
}
