// Die-cut stickers for the sticker book.
import { shape, ellipse, rrect, rect, blob, stroke, dot, text, FONTS, INK, ellipsePts, shade, rgba, makeCanvas, mulberry32 } from '../ink.js';
import { emblem, drawProduct } from './products.js';

const EMBLEMS = new Set(['bolt', 'token', 'rat', 'pizza', 'cheese', 'eye', 'gator', 'crown', 'star', 'ghost', 'train']);

function custom(g, kind, col) {
  switch (kind) {
    case 'spray':
      rrect(g, -7, -10, 14, 24, 4, { fill: col, lw: 2.4, seed: 3 });
      rrect(g, -7, -2, 14, 7, 1, { fill: '#fffaf0', lw: 1.6, seed: 4 });
      blob(g, [['M', -6, -10], ['C', -5, -17, 5, -17, 6, -10], ['Z']], { fill: '#c8c8e0', lw: 2, seed: 5 });
      rrect(g, -2.5, -19, 5, 4, 1, { fill: '#2a2238', lw: 1.6, seed: 6 });
      for (let i = 0; i < 5; i++) dot(g, 6 + i * 2.4, -18 - i * 1.6 + (i % 2) * 2, 1.4, col);
      break;
    case 'pigeon':
      ellipse(g, 0, 2, 12, 11, { fill: col, lw: 2.4, seed: 3 });
      blob(g, [['M', 9, -1], ['L', 18, 2], ['L', 9, 5], ['Z']], { fill: '#3a3550', lw: 2, seed: 4 });
      ellipse(g, 3, -1, 3.4, 3.6, { fill: '#ff9a3c', lw: 1.8, seed: 5 });
      dot(g, 3.8, -1, 1.4, INK);
      blob(g, [['M', -10, 6], ['C', -4, 12, 6, 12, 10, 8], ['L', 9, 11], ['C', 2, 15, -6, 14, -11, 9], ['Z']], { fill: '#4fae93', lw: 0, seed: 6 });
      break;
    case 'roach':
      ellipse(g, 0, 3, 9, 12, { fill: col, lw: 2.4, seed: 3 });
      stroke(g, [[0, -8], [0, 14]], { lw: 1.6, color: rgba('#140f26', 0.6) });
      ellipse(g, 0, -11, 6, 5, { fill: shade(col, 0.2), lw: 2.2, seed: 4 });
      stroke(g, [[-2, -15], [-8, -22]], { lw: 1.6 });
      stroke(g, [[2, -15], [8, -22]], { lw: 1.6 });
      for (const s of [-1, 1]) for (let i = 0; i < 3; i++) stroke(g, [[s * 8, -2 + i * 6], [s * 15, -5 + i * 7]], { lw: 1.6 });
      break;
    case 'turnstile':
      rrect(g, -12, -6, 10, 22, 3, { fill: col, lw: 2.4, seed: 3 });
      rrect(g, -14, -10, 14, 6, 2, { fill: '#e8ecf4', lw: 2, seed: 4 });
      ellipse(g, 3, 2, 3.4, 3.4, { fill: '#e8ecf4', lw: 1.8, seed: 5 });
      stroke(g, [[3, 2], [16, 1]], { lw: 3, color: '#e8ecf4' });
      stroke(g, [[3, 2], [6, 13]], { lw: 3, color: '#e8ecf4' });
      break;
    case 'phone':
      rrect(g, -11, -14, 22, 28, 5, { fill: col, lw: 2.4, seed: 3 });
      rrect(g, -8, -11, 16, 6, 2, { fill: '#e8e0ff', lw: 1.6, seed: 4 });
      for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) dot(g, -5 + c * 5, -1 + r * 5, 1.4, INK);
      break;
    case 'manhole':
      ellipse(g, 0, 0, 14, 14, { fill: col, lw: 2.4, seed: 3 });
      for (let k = -9; k <= 9; k += 4.5) stroke(g, [[k, -Math.sqrt(150 - k * k)], [k, Math.sqrt(150 - k * k)]], { lw: 1.2, color: rgba('#140f26', 0.6) });
      ellipse(g, 0, 0, 5, 5, { fill: shade(col, -0.3), lw: 1.6, seed: 4 });
      break;
    case 'boombox':
      drawProduct(g, { type: 'boombox', c: col }, 0, 0, 0.3, 5);
      break;
    case 'sneaker':
      drawProduct(g, { type: 'low', c: col, a: '#ff4f9a', s: '#f4efe6' }, 0, 0, 0.36, 5);
      break;
    case 'ghosttrain':
      rrect(g, -15, -9, 30, 18, 4, { fill: rgba('#bff8ec', 0.85), lw: 2.4, line: '#1d4a4a', seed: 3 });
      for (let i = 0; i < 3; i++) rrect(g, -12 + i * 9, -6, 7, 6, 1, { fill: '#ffd98a', lw: 1.4, line: '#1d4a4a', seed: 4 + i });
      dot(g, -9, 10, 2.6, '#1d4a4a');
      dot(g, 9, 10, 2.6, '#1d4a4a');
      for (let i = 0; i < 3; i++) stroke(g, [[-20 - i * 3, -4 + i * 4], [-24 - i * 3, -4 + i * 4]], { lw: 1.6, color: rgba('#bff8ec', 0.8) });
      break;
    case 'goldtoken':
      ellipse(g, 0, 0, 14, 14, { fill: '#ffd23f', shade: '#c8901a', sdx: 2, sdy: 2, lw: 2.6, seed: 3 });
      ellipse(g, 0, 0, 9.5, 9.5, { fill: '#ffe68a', lw: 1.6, seed: 4 });
      shape(g, [[2, -7], [-5, 1], [-0.5, 1], [-2.5, 7], [5, -1.5], [0.5, -1.5], [3, -7]], { fill: INK, lw: 0, smooth: false });
      for (const [x, y] of [[-12, -12], [12, -10], [11, 12]]) {
        g.fillStyle = '#fffaf0';
        g.beginPath();
        g.moveTo(x, y - 4); g.lineTo(x + 1, y - 1); g.lineTo(x + 4, y); g.lineTo(x + 1, y + 1); g.lineTo(x, y + 4); g.lineTo(x - 1, y + 1); g.lineTo(x - 4, y); g.lineTo(x - 1, y - 1);
        g.fill();
      }
      break;
    case 'shelly':
      blob(g, [['M', -14, 10], ['C', -14, -6, 2, -14, 12, -6], ['C', 16, -2, 14, 8, 8, 10], ['Z']], { fill: '#5e7a3a', lw: 2.4, seed: 3 });
      ellipse(g, 10, -6, 7, 6, { fill: col, lw: 2.2, seed: 4 });
      ellipse(g, 11, -7, 3.6, 3, { fill: rgba('#bfe9ff', 0.5), lw: 1.4, seed: 5 });
      dot(g, 11.5, -7, 1.2, INK);
      break;
    case 'whiskers':
      blob(g, [['M', -12, -4], ['L', -10, -16], ['L', -3, -8], ['Z']], { fill: col, lw: 2, seed: 3 });
      blob(g, [['M', 12, -4], ['L', 10, -16], ['L', 3, -8], ['Z']], { fill: col, lw: 2, seed: 4 });
      ellipse(g, 0, 1, 13, 11, { fill: col, lw: 2.4, seed: 5 });
      stroke(g, [[-7, -1], [-3, 0]], { lw: 1.8 });
      stroke(g, [[3, 0], [7, -1]], { lw: 1.8 });
      dot(g, 0, 4, 1.6, '#ff8fb8');
      for (const s of [-1, 1]) stroke(g, [[s * 5, 5], [s * 16, 4]], { lw: 1 });
      break;
    case 'cups':
      for (let i = -1; i <= 1; i++) blob(g, [['M', i * 10 - 5, 8], ['L', i * 10 - 3, -6], ['L', i * 10 + 3, -6], ['L', i * 10 + 5, 8], ['Z']], { fill: col, lw: 2, seed: 3 + i });
      emblem(g, 'token', 0, 13, 0.4, '#ffd23f', 7);
      break;
    default:
      text(g, '?', 0, 6, { size: 18, font: FONTS.sign, fill: col, lw: 2 });
  }
}

export function drawSticker(g, st, x = 0, y = 0, s = 1) {
  g.save();
  g.translate(x, y);
  g.scale(s, s);
  const r = mulberry32(st.id.length * 31);
  g.rotate((r() - 0.5) * 0.25);
  // white die-cut border
  shape(g, ellipsePts(0, 0, 19, 19), { fill: '#fffaf0', lw: 2.4, amp: 0.8, seed: st.id.length });
  shape(g, ellipsePts(0, 0, 15.5, 15.5), { fill: st.bg, lw: 0, amp: 0.4, seed: st.id.length + 1 });
  g.save();
  g.scale(0.95, 0.95);
  if (EMBLEMS.has(st.art)) emblem(g, st.art, 0, 0, 0.82, st.color, 5);
  else custom(g, st.art, st.color);
  g.restore();
  // shine
  g.fillStyle = rgba('#ffffff', 0.22);
  g.beginPath();
  g.ellipse(-7, -9, 6, 3, -0.6, 0, Math.PI * 2);
  g.fill();
  g.restore();
}

const cache = new Map();
export function stickerImage(st, px = 96) {
  const key = `${st.id}@${px}`;
  if (cache.has(key)) return cache.get(key);
  const c = makeCanvas(px, px);
  const g = c.getContext('2d');
  g.scale(px / 44, px / 44);
  g.translate(22, 22);
  drawSticker(g, st);
  const url = c.toDataURL('image/png');
  cache.set(key, url);
  return url;
}
