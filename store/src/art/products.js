// Product illustrations. Each draws centered at (0,0) inside a ~100x100 box,
// from a spec { type, c, a, s, g, ... } stored with the product data.
// Emblems (bolt, rat, token...) are shared with apparel graphics + stickers.
import {
  INK, shape, rect, rrect, ellipse, blob, stroke, tube, dot, text, drips, FONTS,
  mulberry32, shade, tint, mix, rgba, ellipsePts, pathPts, makeCanvas,
} from '../ink.js';

// ---------------------------------------------------------------- emblems

export function emblem(g, kind, x, y, s, col = '#ffd23f', seed = 1) {
  g.save();
  g.translate(x, y);
  g.scale(s, s);
  const lw = 2.4 / Math.max(0.6, s) * 0.9;
  switch (kind) {
    case 'bolt':
      shape(g, [[2, -14], [-9, 2], [-1, 2], [-4, 14], [9, -3], [1, -3], [5, -14]], { fill: col, lw, smooth: false, seed });
      break;
    case 'token': {
      ellipse(g, 0, 0, 12, 12, { fill: '#e8b84a', shade: '#b8862a', sdx: 1.5, sdy: 1.5, lw, seed });
      ellipse(g, 0, 0, 8, 8, { fill: '#f4cf6a', lw: lw * 0.7, seed: seed + 1 });
      shape(g, [[1.5, -6], [-4, 1], [-0.5, 1], [-2, 6], [4, -1.5], [0.5, -1.5], [2.5, -6]], { fill: INK, lw: 0, smooth: false });
      break;
    }
    case 'rat':
      ellipse(g, -8, -8, 6, 6, { fill: '#b8b0d8', lw, seed });
      ellipse(g, 8, -8, 6, 6, { fill: '#b8b0d8', lw, seed: seed + 1 });
      ellipse(g, -8, -8, 3, 3, { fill: '#ff8fb8', lw: 0, seed });
      ellipse(g, 8, -8, 3, 3, { fill: '#ff8fb8', lw: 0, seed });
      blob(g, [['M', -11, -2], ['C', -11, -10, 11, -10, 11, -2], ['C', 11, 4, 4, 9, 0, 12], ['C', -4, 9, -11, 4, -11, -2], ['Z']], { fill: '#b8b0d8', lw, seed: seed + 2 });
      dot(g, -4, -1, 1.6, INK); dot(g, 4, -1, 1.6, INK); dot(g, 0, 9.5, 2.2, '#ff8fb8');
      break;
    case 'train':
      rrect(g, -16, -10, 32, 18, 4, { fill: '#c8c8e0', lw, seed });
      rrect(g, -12, -6, 9, 7, 1.5, { fill: '#5aa0ff', lw: lw * 0.6, seed: seed + 1 });
      rrect(g, 3, -6, 9, 7, 1.5, { fill: '#5aa0ff', lw: lw * 0.6, seed: seed + 2 });
      ellipse(g, -9, 10, 3, 3, { fill: INK, lw: 0 });
      ellipse(g, 9, 10, 3, 3, { fill: INK, lw: 0 });
      ellipse(g, 0, -15, 5, 5, { fill: '#d4473f', lw: lw * 0.6, seed: seed + 3 });
      text(g, '3', 0, -12.6, { size: 7, font: FONTS.sign, fill: '#fff', lw: 0 });
      break;
    case 'cheese':
      shape(g, [[-13, 8], [13, 8], [13, -2], [-13, -10]], { fill: '#ffd23f', lw, smooth: false, seed });
      dot(g, -4, 2, 2.4, '#d49a12'); dot(g, 6, 4, 1.8, '#d49a12'); dot(g, 2, -2, 1.4, '#d49a12');
      break;
    case 'eye':
      shape(g, pathPts([['M', -14, 0], ['Q', 0, -12, 14, 0], ['Q', 0, 12, -14, 0]]), { fill: '#fffaf0', lw, seed });
      dot(g, 0, 0, 5, col);
      dot(g, 0, 0, 2.2, INK);
      for (let i = -2; i <= 2; i++) stroke(g, [[i * 5, -9], [i * 6.5, -14]], { lw: lw * 0.6, color: col });
      break;
    case 'moth':
      blob(g, [['M', 0, -2], ['C', -14, -16, -20, 2, -10, 8], ['Z']], { fill: col, lw, seed });
      blob(g, [['M', 0, -2], ['C', 14, -16, 20, 2, 10, 8], ['Z']], { fill: col, lw, seed: seed + 1 });
      ellipse(g, 0, 2, 3, 8, { fill: INK, lw: 0 });
      dot(g, -8, -2, 2, INK); dot(g, 8, -2, 2, INK);
      break;
    case 'gator':
      blob(g, [['M', -14, 2], ['C', -14, -8, 0, -8, 4, -6], ['L', 16, -4], ['C', 18, 0, 16, 3, 12, 3], ['Z']], { fill: '#4f9a4a', lw, seed });
      for (let i = 0; i < 4; i++) shape(g, [[-2 + i * 4, 3], [0 + i * 4, 6], [2 + i * 4, 3]], { fill: '#fffaf0', lw: lw * 0.4, smooth: false });
      dot(g, -6, -4, 1.8, INK);
      break;
    case 'crown':
      shape(g, [[-13, 8], [-13, -6], [-6, 0], [0, -10], [6, 0], [13, -6], [13, 8]], { fill: '#ffd23f', lw, smooth: false, seed });
      dot(g, 0, 3, 2, '#ff4f9a');
      break;
    case 'star': {
      const s2 = [];
      for (let i = 0; i < 10; i++) {
        const a = -Math.PI / 2 + (i * Math.PI) / 5, r = i % 2 ? 6 : 14;
        s2.push([Math.cos(a) * r, Math.sin(a) * r]);
      }
      shape(g, s2, { fill: col, lw, smooth: false, seed });
      break;
    }
    case 'ghost':
      blob(g, [['M', -10, 10], ['C', -12, -16, 12, -16, 10, 10], ['L', 6, 6], ['L', 2, 10], ['L', -2, 6], ['L', -6, 10], ['Z']], { fill: '#bff8ec', lw, seed });
      dot(g, -4, -3, 1.8, INK); dot(g, 4, -3, 1.8, INK);
      break;
    case 'pizza':
      shape(g, [[-12, -10], [12, -10], [0, 14]], { fill: '#ffcf5a', lw, seed });
      rrect(g, -13, -13, 26, 5, 2, { fill: '#c8742e', lw: lw * 0.8, seed: seed + 1 });
      dot(g, -3, -3, 2.4, '#e8456b'); dot(g, 4, -1, 2.2, '#e8456b'); dot(g, 0, 5, 1.8, '#e8456b');
      break;
    case '1904':
      text(g, '1904', 0, 4, { size: 13, font: FONTS.sign, fill: col, lw: 2.2 });
      text(g, 'OLD HALL', 0, -10, { size: 6, font: FONTS.sign, fill: col, lw: 0 });
      break;
    case 'text':
      text(g, String(col), 0, 4, { size: 10, font: FONTS.sign, fill: '#fffaf0', lw: 2 });
      break;
    default:
      break;
  }
  g.restore();
}

// ---------------------------------------------------------------- apparel

function hoodie(g, p, sd) {
  const c = p.c, d = shade(c, 0.3);
  // hood behind
  blob(g, [['M', -16, -36], ['C', -18, -50, 18, -50, 16, -36], ['Z']], { fill: d, lw: 3, seed: sd });
  // sleeves
  blob(g, [['M', -22, -30], ['C', -34, -24, -40, 6, -40, 24], ['L', -30, 26], ['C', -28, 8, -26, -6, -20, -14], ['Z']], { fill: c, shade: d, sdx: 2, sdy: 2, lw: 3, seed: sd + 1 });
  blob(g, [['M', 22, -30], ['C', 34, -24, 40, 6, 40, 24], ['L', 30, 26], ['C', 28, 8, 26, -6, 20, -14], ['Z']], { fill: c, shade: d, sdx: 2, sdy: 2, lw: 3, seed: sd + 2 });
  rrect(g, -41, 22, 12, 8, 2, { fill: d, lw: 2.4, seed: sd + 3 });
  rrect(g, 29, 22, 12, 8, 2, { fill: d, lw: 2.4, seed: sd + 4 });
  // body
  blob(g, [['M', -22, -32], ['C', -26, -10, -26, 14, -24, 30], ['L', 24, 30], ['C', 26, 14, 26, -10, 22, -32], ['C', 10, -40, -10, -40, -22, -32], ['Z']], { fill: c, shade: d, sdx: 3, sdy: 3, lw: 3, seed: sd + 5 });
  rrect(g, -24, 26, 48, 8, 3, { fill: d, lw: 2.4, seed: sd + 6 });
  // hood opening + strings
  blob(g, [['M', -10, -36], ['C', -6, -26, 6, -26, 10, -36], ['C', 4, -32, -4, -32, -10, -36], ['Z']], { fill: shade(c, 0.5), lw: 2.4, seed: sd + 7 });
  stroke(g, [[-4, -30], [-5, -16]], { lw: 1.8, color: p.a || '#fffaf0', seed: sd + 8 });
  stroke(g, [[4, -30], [5, -16]], { lw: 1.8, color: p.a || '#fffaf0', seed: sd + 9 });
  // pocket
  stroke(g, [[-16, 24], [-12, 10], [12, 10], [16, 24]], { lw: 2, color: rgba('#140f26', 0.6), seed: sd + 10 });
  if (p.g) emblem(g, p.g, 0, -6, 0.75, p.a || '#ffd23f', sd + 11);
  if (p.glow) {
    g.save();
    g.globalCompositeOperation = 'lighter';
    g.fillStyle = rgba(p.a || '#c8ff6a', 0.18);
    g.beginPath();
    g.arc(0, -6, 18, 0, Math.PI * 2);
    g.fill();
    g.restore();
  }
}

function tee(g, p, sd) {
  const c = p.c, d = shade(c, 0.25);
  blob(g, [
    ['M', -14, -34], ['C', -6, -28, 6, -28, 14, -34],
    ['L', 36, -24], ['L', 30, -6], ['L', 22, -9],
    ['L', 22, 32], ['L', -22, 32], ['L', -22, -9],
    ['L', -30, -6], ['L', -36, -24], ['Z'],
  ], { fill: c, shade: d, sdx: 3, sdy: 3, lw: 3, seed: sd, inner: p.dye ? (gg) => {
    const r = mulberry32(sd);
    for (let i = 0; i < 9; i++) {
      gg.strokeStyle = rgba(p.dye, 0.55);
      gg.lineWidth = 6;
      gg.beginPath();
      gg.arc(0, 0, 6 + i * 6 + r() * 2, 0, Math.PI * 2);
      gg.stroke();
    }
  } : null });
  stroke(g, pathPts([['M', -14, -34], ['Q', 0, -24, 14, -34]]), { lw: 2.4, color: shade(c, 0.4), seed: sd + 1 });
  if (p.g) emblem(g, p.g, 0, -4, 0.85, p.a || '#d4473f', sd + 2);
}

function jacket(g, p, sd) {
  const c = p.c, d = shade(c, 0.28), a = p.a || '#fffaf0';
  blob(g, [['M', -22, -30], ['C', -34, -24, -40, 6, -40, 26], ['L', -29, 28], ['C', -28, 8, -26, -6, -20, -14], ['Z']], { fill: c, shade: d, sdx: 2, sdy: 2, lw: 3, seed: sd });
  blob(g, [['M', 22, -30], ['C', 34, -24, 40, 6, 40, 26], ['L', 29, 28], ['C', 28, 8, 26, -6, 20, -14], ['Z']], { fill: c, shade: d, sdx: 2, sdy: 2, lw: 3, seed: sd + 1 });
  stroke(g, [[-33, -16], [-37, 24]], { lw: 3, color: a, seed: sd + 2 });
  stroke(g, [[33, -16], [37, 24]], { lw: 3, color: a, seed: sd + 3 });
  blob(g, [['M', -22, -32], ['C', -25, -10, -25, 14, -24, 32], ['L', 24, 32], ['C', 25, 14, 25, -10, 22, -32], ['C', 10, -38, -10, -38, -22, -32], ['Z']], { fill: c, shade: d, sdx: 3, sdy: 3, lw: 3, seed: sd + 4 });
  rrect(g, -10, -38, 20, 8, 3, { fill: d, lw: 2.4, seed: sd + 5 });
  stroke(g, [[0, -30], [0, 32]], { lw: 2.4, color: '#c8c8e0', seed: sd + 6 });
  ellipse(g, 0, -24, 2.5, 3.5, { fill: '#c8c8e0', lw: 1.6, seed: sd + 7 });
  stroke(g, [[-20, -24], [-22, 30]], { lw: 3, color: a, seed: sd + 8 });
  stroke(g, [[20, -24], [22, 30]], { lw: 3, color: a, seed: sd + 9 });
}

function windbreaker(g, p, sd) {
  const c = p.c, c2 = p.c2 || '#7b5cff';
  blob(g, [['M', -22, -30], ['C', -34, -24, -40, 6, -40, 26], ['L', -29, 28], ['C', -28, 8, -26, -6, -20, -14], ['Z']], { fill: c2, lw: 3, seed: sd });
  blob(g, [['M', 22, -30], ['C', 34, -24, 40, 6, 40, 26], ['L', 29, 28], ['C', 28, 8, 26, -6, 20, -14], ['Z']], { fill: c2, lw: 3, seed: sd + 1 });
  blob(g, [['M', -22, -32], ['C', -25, -10, -25, 14, -24, 32], ['L', 24, 32], ['C', 25, 14, 25, -10, 22, -32], ['C', 10, -38, -10, -38, -22, -32], ['Z']], { fill: c, shade: shade(c, 0.25), sdx: 3, sdy: 3, lw: 3, seed: sd + 2, inner: (gg) => {
    gg.fillStyle = c2;
    gg.beginPath(); gg.moveTo(-30, 2); gg.lineTo(30, -12); gg.lineTo(30, 4); gg.lineTo(-30, 18); gg.fill();
    gg.fillStyle = '#fffaf0';
    gg.beginPath(); gg.moveTo(-30, 18); gg.lineTo(30, 4); gg.lineTo(30, 8); gg.lineTo(-30, 22); gg.fill();
  } });
  blob(g, [['M', -12, -38], ['C', -8, -30, 8, -30, 12, -38], ['L', 8, -26], ['L', -8, -26], ['Z']], { fill: shade(c, 0.3), lw: 2.4, seed: sd + 3 });
  stroke(g, [[0, -28], [0, 32]], { lw: 2, color: '#140f26', seed: sd + 4 });
}

function pants(g, p, sd) {
  const c = p.c, d = shade(c, 0.28);
  blob(g, [['M', -20, -36], ['L', 20, -36], ['L', 24, 38], ['L', 4, 38], ['L', 0, -10], ['L', -4, 38], ['L', -24, 38], ['Z']], { fill: c, shade: d, sdx: 3, sdy: 3, lw: 3, seed: sd });
  rrect(g, -21, -38, 42, 8, 2, { fill: d, lw: 2.4, seed: sd + 1 });
  rrect(g, -22, 0, 12, 14, 2, { fill: d, lw: 2.2, seed: sd + 2 });
  rrect(g, 10, 0, 12, 14, 2, { fill: d, lw: 2.2, seed: sd + 3 });
  stroke(g, [[-6, -30], [-2, -10]], { lw: 1.6, color: rgba('#140f26', 0.5), seed: sd + 4 });
}

function cap(g, p, sd) {
  const c = p.c, a = p.a || shade(c, 0.4);
  blob(g, [['M', -30, 8], ['C', -32, -22, 26, -26, 28, 6], ['Z']], { fill: c, shade: shade(c, 0.25), sdx: 3, sdy: 3, lw: 3, seed: sd });
  stroke(g, pathPts([['M', -2, -18], ['Q', 2, -4, 0, 7]]), { lw: 1.8, color: rgba('#140f26', 0.45), seed: sd + 1 });
  dot(g, -1, -18, 2.6, a);
  blob(g, [['M', 18, 2], ['C', 30, 0, 44, 6, 46, 14], ['C', 34, 16, 22, 12, 14, 8], ['Z']], { fill: a, lw: 3, seed: sd + 2 });
  if (p.g) emblem(g, p.g, -8, -4, 0.62, p.a, sd + 3);
}

function beanie(g, p, sd) {
  const c = p.c, a = p.a || shade(c, 0.3);
  blob(g, [['M', -28, 12], ['C', -32, -30, 32, -30, 28, 12], ['Z']], { fill: c, shade: shade(c, 0.25), sdx: 3, sdy: 3, lw: 3, seed: sd });
  for (let i = -22; i <= 22; i += 6) stroke(g, [[i, -14 + Math.abs(i) * 0.25], [i, 6]], { lw: 1.4, color: rgba('#140f26', 0.35), seed: sd + i });
  rrect(g, -30, 4, 60, 16, 5, { fill: a, lw: 3, seed: sd + 1 });
  ellipse(g, 0, -28, 9, 8, { fill: tint(c, 0.3), lw: 2.6, seed: sd + 2, amp: 1.4 });
}

function bucket(g, p, sd) {
  const c = p.c, a = p.a || '#fffaf0';
  const check = (gg) => {
    gg.fillStyle = a;
    for (let i = -6; i < 6; i++) for (let j = -4; j < 4; j++) if ((i + j) % 2 === 0) gg.fillRect(i * 8, j * 8, 8, 8);
  };
  blob(g, [['M', -38, 12], ['C', -30, 0, 30, 0, 38, 12], ['C', 30, 18, -30, 18, -38, 12], ['Z']], { fill: c, lw: 3, seed: sd, inner: check });
  blob(g, [['M', -22, 6], ['C', -24, -26, 24, -26, 22, 6], ['Z']], { fill: c, lw: 3, seed: sd + 1, inner: check });
  rrect(g, -23, 0, 46, 6, 2, { fill: '#140f26', lw: 2, seed: sd + 2 });
}

function chain(g, p, sd) {
  const c = p.c || '#ffd23f';
  const heavy = p.heavy ? 1.5 : 1;
  const pts = pathPts([['M', -30, -30], ['C', -30, 10, 30, 10, 30, -30]], 18);
  for (let i = 0; i < pts.length; i++) {
    const [x, y] = pts[i];
    ellipse(g, x, y, 4.4 * heavy, 3 * heavy, { fill: c, lw: 1.8, rot: i * 0.9, seed: sd + i, amp: 0.2 });
  }
  if (p.heavy) {
    ellipse(g, 0, 18, 14, 14, { fill: c, shade: shade(c, 0.3), sdx: 2, sdy: 2, lw: 3, seed: sd + 50 });
    text(g, 'AL', 0, 23, { size: 12, font: FONTS.sign, fill: INK, lw: 0 });
  } else {
    emblem(g, 'token', 0, 16, 1.1, c, sd + 50);
  }
}

function bag(g, p, sd) {
  const c = p.c, a = p.a || '#d4473f';
  stroke(g, pathPts([['M', -26, -4], ['C', -20, -48, 20, -48, 26, -4]]), { lw: 5, color: shade(c, 0.2), seed: sd });
  rrect(g, -32, -8, 64, 40, 10, { fill: c, shade: shade(c, 0.35), sdx: 3, sdy: 3, lw: 3, seed: sd + 1 });
  rrect(g, -32, 2, 64, 6, 1, { fill: a, lw: 0, seed: sd + 2 });
  stroke(g, [[-20, 18], [20, 18]], { lw: 2, color: '#c8c8e0', seed: sd + 3 });
  ellipse(g, 18, 18, 3, 3, { fill: '#c8c8e0', lw: 1.6, seed: sd + 4 });
  ellipse(g, -16, 20, 8, 8, { fill: '#d4473f', lw: 2, seed: sd + 5 });
  text(g, '3', -16, 24, { size: 10, font: FONTS.sign, fill: '#fff', lw: 0 });
}

function bandana(g, p, sd) {
  const c = p.c;
  shape(g, [[-38, -24], [38, -24], [0, 34]], { fill: c, shade: shade(c, 0.25), sdx: 3, sdy: 3, lw: 3, seed: sd });
  // map lines
  stroke(g, [[-24, -16], [-4, -6], [10, -12], [22, -2]], { lw: 2.6, color: '#ffd23f', seed: sd + 1 });
  stroke(g, [[-12, -18], [-4, 4], [2, 18]], { lw: 2.6, color: '#3ec7b0', seed: sd + 2 });
  stroke(g, [[20, -18], [8, 2]], { lw: 2.6, color: '#fffaf0', seed: sd + 3 });
  for (const [x, y] of [[-4, -6], [10, -12], [-4, 4]]) ellipse(g, x, y, 3, 3, { fill: '#fffaf0', lw: 1.6, seed: sd + x });
}

function shades(g, p, sd) {
  const c = p.c, a = p.a || '#3ec7b0';
  stroke(g, [[-40, -6], [-30, -8]], { lw: 3.6, color: c, seed: sd });
  stroke(g, [[40, -6], [30, -8]], { lw: 3.6, color: c, seed: sd + 1 });
  blob(g, [['M', -32, -12], ['L', -4, -12], ['C', -4, 4, -10, 10, -18, 10], ['C', -28, 10, -32, 2, -32, -12], ['Z']], { fill: a, lw: 3.4, line: c, seed: sd + 2 });
  blob(g, [['M', 32, -12], ['L', 4, -12], ['C', 4, 4, 10, 10, 18, 10], ['C', 28, 10, 32, 2, 32, -12], ['Z']], { fill: a, lw: 3.4, line: c, seed: sd + 3 });
  stroke(g, [[-4, -10], [4, -10]], { lw: 3.4, color: c, seed: sd + 4 });
  stroke(g, [[-26, -8], [-18, 0]], { lw: 2.4, color: rgba('#ffffff', 0.7), seed: sd + 5 });
  stroke(g, [[10, -8], [18, 0]], { lw: 2.4, color: rgba('#ffffff', 0.7), seed: sd + 6 });
  dot(g, 0, 12, 0.1, c);
}

// ---------------------------------------------------------------- footwear

function sneaker(g, p, sd, high = false) {
  const c = p.c, a = p.a || '#d4473f', s = p.s || '#f4efe6';
  const ghost = p.ghost;
  if (ghost) { g.save(); g.globalAlpha *= 0.82; }
  if (high) {
    blob(g, [['M', -32, 14], ['L', -30, -30], ['C', -22, -34, -10, -34, -6, -30], ['L', -2, -8], ['C', 14, -6, 32, 0, 38, 10], ['L', 38, 16], ['L', -32, 16], ['Z']], { fill: c, shade: shade(c, 0.25), sdx: 3, sdy: 3, lw: 3, seed: sd });
    ellipse(g, -18, -10, 7, 7, { fill: a, lw: 2.4, seed: sd + 1 });
    for (let i = 0; i < 4; i++) stroke(g, [[-10 + i * 2, -26 + i * 6], [-2 + i * 2, -26 + i * 6]], { lw: 1.8, color: '#fffaf0', seed: sd + 2 + i });
  } else {
    blob(g, [['M', -36, 14], ['L', -34, -10], ['C', -26, -16, -12, -16, -6, -10], ['C', 10, -8, 30, -2, 38, 8], ['L', 38, 16], ['L', -36, 16], ['Z']], { fill: c, shade: shade(c, 0.25), sdx: 3, sdy: 3, lw: 3, seed: sd });
    for (let i = 0; i < 3; i++) stroke(g, [[-8 + i * 5, -10 + i * 2], [-2 + i * 5, -12 + i * 2]], { lw: 1.8, color: shade(c, 0.5), seed: sd + 2 + i });
  }
  // swoosh-ish stripe (our own: a lightning stripe)
  stroke(g, [[-24, 6], [-6, -2], [4, 4], [24, -4]], { lw: 4, color: a, seed: sd + 8, smooth: false });
  rrect(g, -37, 12, 76, 9, 4, { fill: s, lw: 3, seed: sd + 9 });
  stroke(g, [[-34, 18], [36, 18]], { lw: 1.4, color: rgba('#140f26', 0.4), seed: sd + 10 });
  if (ghost) g.restore();
}

function slides(g, p, sd) {
  const c = p.c;
  rrect(g, -38, 8, 48, 10, 5, { fill: '#f4efe6', lw: 3, seed: sd });
  blob(g, [['M', -32, 8], ['C', -30, -10, 0, -10, 4, 8], ['Z']], { fill: c, lw: 3, seed: sd + 1 });
  rrect(g, -6, 18, 48, 10, 5, { fill: '#f4efe6', lw: 3, seed: sd + 2 });
  blob(g, [['M', 0, 18], ['C', 2, 0, 32, 0, 36, 18], ['Z']], { fill: c, lw: 3, seed: sd + 3 });
  emblem(g, 'bolt', 18, 10, 0.45, '#fffaf0', sd + 4);
  // slime drip
  drips(g, -24, 2, 20, c, sd, { count: 2, maxLen: 8, thick: 3 });
}

function socks(g, p, sd) {
  const cols = ['#ff4f9a', '#3ec7b0', '#ffd23f', '#7b5cff', '#ff8a3d', '#7ed957'];
  for (let i = 0; i < 6; i++) {
    const x = -34 + i * 13;
    g.save();
    g.translate(x, -4 + (i % 2) * 6);
    blob(g, [['M', -5, -26], ['L', 5, -26], ['L', 5, 12], ['C', 5, 20, 14, 20, 14, 26], ['L', -2, 26], ['C', -6, 26, -5, 18, -5, 12], ['Z']], { fill: cols[i], shade: shade(cols[i], 0.25), sdx: 1.5, sdy: 1.5, lw: 2.4, seed: sd + i });
    stroke(g, [[-5, -20], [5, -20]], { lw: 2, color: '#fffaf0' });
    g.restore();
  }
}

// ---------------------------------------------------------------- art supplies

function sprayCan(g, x, y, c, sd, s = 1) {
  g.save();
  g.translate(x, y);
  g.scale(s, s);
  rrect(g, -9, -18, 18, 40, 5, { fill: c, shade: shade(c, 0.3), sdx: 2, sdy: 2, lw: 2.6, seed: sd });
  rrect(g, -9, -6, 18, 12, 1, { fill: '#fffaf0', lw: 2, seed: sd + 1 });
  dot(g, 0, 0, 3.2, c);
  blob(g, [['M', -8, -18], ['C', -6, -28, 6, -28, 8, -18], ['Z']], { fill: '#c8c8e0', lw: 2.4, seed: sd + 2 });
  rrect(g, -3, -30, 6, 6, 1.5, { fill: '#2a2238', lw: 2, seed: sd + 3 });
  g.restore();
}

function cans(g, p, sd) {
  const cols = ['#ff4f9a', '#ffd23f', '#3ec7b0', '#7b5cff', '#ff8a3d', '#7ed957'];
  rrect(g, -42, 10, 84, 26, 3, { fill: '#c8a070', lw: 3, seed: sd });
  for (let i = 0; i < 3; i++) sprayCan(g, -24 + i * 24, -2, cols[i + 3], sd + 10 + i, 0.9);
  for (let i = 0; i < 3; i++) sprayCan(g, -30 + i * 30, 8, cols[i], sd + 20 + i, 1);
  text(g, 'RASCAL', 0, 32, { size: 9, font: FONTS.sign, fill: INK, lw: 0 });
}

function markers(g, p, sd) {
  const cols = ['#ff4f9a', '#3ec7b0', '#ffd23f', '#140f26', '#7b5cff'];
  for (let i = 0; i < 5; i++) {
    g.save();
    g.translate(-28 + i * 14, 0);
    g.rotate(-0.2 + i * 0.1);
    rrect(g, -6, -26, 12, 46, 3, { fill: '#2a2238', lw: 2.6, seed: sd + i });
    rrect(g, -6, -12, 12, 12, 1, { fill: cols[i], lw: 2, seed: sd + 10 + i });
    rrect(g, -5, -34, 10, 9, 3, { fill: cols[i], lw: 2.4, seed: sd + 20 + i });
    g.restore();
  }
}

function stickerpack(g, p, sd) {
  const cols = ['#ff4f9a', '#3ec7b0', '#ffd23f', '#7b5cff', '#ff8a3d'];
  const kinds = ['bolt', 'rat', 'star', 'cheese', 'pizza'];
  for (let i = 0; i < 5; i++) {
    g.save();
    g.translate(-22 + (i % 3) * 22, -14 + Math.floor(i / 3) * 28);
    g.rotate((i - 2) * 0.15);
    rrect(g, -14, -12, 28, 24, 5, { fill: '#fffaf0', lw: 2.6, seed: sd + i });
    rrect(g, -11, -9, 22, 18, 4, { fill: cols[i], lw: 0, seed: sd + i });
    emblem(g, kinds[i], 0, 0, 0.55, '#fffaf0', sd + 10 + i);
    g.restore();
  }
  text(g, 'x50', 30, 30, { size: 12, font: FONTS.marker, fill: '#ffd23f', lw: 3, rot: -0.2 });
}

function sketchbook(g, p, sd) {
  rrect(g, -30, -36, 60, 72, 4, { fill: '#1d1830', shade: '#100c1c', sdx: 3, sdy: 3, lw: 3, seed: sd });
  rrect(g, 26, -36, 6, 72, 2, { fill: '#e8456b', lw: 2.4, seed: sd + 1 });
  text(g, 'BLACK', -2, -8, { size: 11, font: FONTS.tag, fill: '#f4efe6', lw: 0, rot: -0.1 });
  text(g, 'BOOK', -2, 8, { size: 13, font: FONTS.tag, fill: '#ffd23f', lw: 0, rot: -0.1 });
  drips(g, -18, 14, 30, '#ffd23f', sd, { count: 3, maxLen: 10, thick: 2, line: null });
}

function print(g, p, sd) {
  const ghost = p.ghost;
  rect(g, -34, -42, 68, 84, { fill: ghost ? '#e8dcc0' : '#fffaf0', lw: 3, seed: sd, amp: 0.4 });
  rect(g, -28, -36, 56, 60, { fill: ghost ? '#2a5a5e' : '#2b2350', lw: 2, seed: sd + 1, amp: 0.3 });
  if (ghost) {
    rrect(g, -22, -4, 44, 18, 4, { fill: rgba('#bff8ec', 0.8), lw: 2, seed: sd + 2 });
    for (let i = 0; i < 3; i++) rrect(g, -18 + i * 13, 0, 9, 7, 1, { fill: '#ffd23f', lw: 1.4, seed: sd + 3 + i });
    text(g, 'LAST TRAIN', 0, 36, { size: 8, font: FONTS.sign, fill: '#2a5a5e', lw: 0 });
    dot(g, 14, -24, 6, '#fffaf0');
  } else {
    text(g, 'LEGAL', 0, -10, { size: 15, font: FONTS.drip, fill: '#ff4f9a', lw: 3, rot: -0.08 });
    text(g, 'WALL', 0, 10, { size: 15, font: FONTS.drip, fill: '#ffd23f', lw: 3, rot: -0.08 });
    text(g, 'RASCAL', 0, 36, { size: 8, font: FONTS.tag, fill: '#140f26', lw: 0 });
  }
}

function patches(g, p, sd) {
  const items = [['bolt', '#ffd23f', -18, -14], ['rat', '#7b5cff', 18, -12], ['star', '#ff4f9a', -16, 18], ['cheese', '#3ec7b0', 18, 18]];
  items.forEach(([k, c, x, y], i) => {
    ellipse(g, x, y, 16, 16, { fill: c, lw: 3, seed: sd + i });
    stroke(g, ellipsePts(x, y, 13, 13).concat([ellipsePts(x, y, 13, 13)[0]]), { lw: 1.2, color: rgba('#140f26', 0.5), seed: sd + 10 + i });
    emblem(g, k, x, y, 0.55, '#fffaf0', sd + 20 + i);
  });
}

function deck(g, p, sd) {
  g.save();
  g.rotate(-0.5);
  rrect(g, -14, -46, 28, 92, 14, { fill: p.c || '#ff4f9a', shade: shade(p.c || '#ff4f9a', 0.3), sdx: 3, sdy: 3, lw: 3, seed: sd });
  emblem(g, 'rat', 0, -8, 0.8, '#fffaf0', sd + 1);
  text(g, '3RD', 0, 26, { size: 10, font: FONTS.drip, fill: '#ffd23f', lw: 2 });
  for (const yy of [-34, 34]) {
    rect(g, -12, yy - 3, 24, 6, { fill: '#c8c8e0', lw: 2, seed: sd + yy });
    ellipse(g, -12, yy, 4, 4, { fill: '#ffd23f', lw: 2, seed: sd + yy + 1 });
    ellipse(g, 12, yy, 4, 4, { fill: '#ffd23f', lw: 2, seed: sd + yy + 2 });
  }
  g.restore();
}

// ---------------------------------------------------------------- music

function cassette(g, p, sd) {
  const c = p.c || '#ffd23f';
  rrect(g, -40, -26, 80, 52, 5, { fill: '#2a2238', shade: '#1a1430', sdx: 3, sdy: 3, lw: 3, seed: sd });
  rrect(g, -34, -20, 68, 28, 3, { fill: c, lw: 2.4, seed: sd + 1 });
  rrect(g, -20, -12, 40, 14, 6, { fill: '#2a2238', lw: 2, seed: sd + 2 });
  ellipse(g, -11, -5, 5, 5, { fill: '#fffaf0', lw: 1.8, seed: sd + 3 });
  ellipse(g, 11, -5, 5, 5, { fill: '#fffaf0', lw: 1.8, seed: sd + 4 });
  text(g, p.label || 'TUNNEL TAPES', 0, -14.5, { size: 5.5, font: FONTS.sign, fill: INK, lw: 0 });
  blob(g, [['M', -24, 26], ['L', -18, 14], ['L', 18, 14], ['L', 24, 26], ['Z']], { fill: '#3a3456', lw: 2.4, seed: sd + 5 });
}

function vinyl(g, p, sd) {
  const c = p.c || '#ff4f9a';
  rect(g, -44, -40, 70, 80, { fill: c, shade: shade(c, 0.3), sdx: 3, sdy: 3, lw: 3, seed: sd, amp: 0.4 });
  text(g, 'RUSH', -9, -10, { size: 14, font: FONTS.drip, fill: '#fffaf0', lw: 2.6 });
  text(g, 'HOUR', -9, 8, { size: 14, font: FONTS.drip, fill: '#ffd23f', lw: 2.6 });
  g.save();
  g.beginPath();
  g.rect(26 - 1.5, -60, 80, 120);
  g.clip();
  ellipse(g, 22, 0, 36, 36, { fill: '#140f26', lw: 3, seed: sd + 1 });
  for (let r = 14; r < 34; r += 5) {
    g.strokeStyle = rgba('#ffffff', 0.12);
    g.lineWidth = 1;
    g.beginPath(); g.arc(22, 0, r, 0, Math.PI * 2); g.stroke();
  }
  ellipse(g, 22, 0, 10, 10, { fill: '#ffd23f', lw: 2, seed: sd + 2 });
  g.restore();
}

function headphones(g, p, sd) {
  const c = p.c || '#3ec7b0';
  tube(g, pathPts([['M', -26, 10], ['C', -30, -44, 30, -44, 26, 10]]), c, 7, { lw: 3, seed: sd });
  rrect(g, -38, -2, 18, 30, 8, { fill: c, shade: shade(c, 0.3), sdx: 2, sdy: 2, lw: 3, seed: sd + 1 });
  rrect(g, 20, -2, 18, 30, 8, { fill: c, shade: shade(c, 0.3), sdx: 2, sdy: 2, lw: 3, seed: sd + 2 });
  rrect(g, -24, 2, 6, 22, 3, { fill: '#2a2238', lw: 2, seed: sd + 3 });
  rrect(g, 18, 2, 6, 22, 3, { fill: '#2a2238', lw: 2, seed: sd + 4 });
  text(g, 'E', -29, 18, { size: 9, font: FONTS.sign, fill: '#fffaf0', lw: 0 });
}

function boombox(g, p, sd) {
  const c = p.c || '#d4473f';
  stroke(g, pathPts([['M', -30, -24], ['Q', 0, -48, 30, -24]]), { lw: 5, color: '#c8c8e0', seed: sd });
  stroke(g, pathPts([['M', -30, -24], ['Q', 0, -48, 30, -24]]), { lw: 1.6, seed: sd + 1 });
  rrect(g, -46, -24, 92, 52, 8, { fill: c, shade: shade(c, 0.3), sdx: 3, sdy: 3, lw: 3, seed: sd + 2 });
  for (const sx of [-26, 26]) {
    ellipse(g, sx, 4, 15, 15, { fill: '#2a2238', lw: 2.6, seed: sd + sx });
    ellipse(g, sx, 4, 6, 6, { fill: '#5a5276', lw: 2, seed: sd + sx + 1 });
  }
  rrect(g, -10, -16, 20, 14, 2, { fill: '#2a2238', lw: 2, seed: sd + 3 });
  rrect(g, -8, -13, 16, 8, 1, { fill: '#3ec7b0', lw: 0, seed: sd + 4 });
  for (let i = 0; i < 4; i++) rrect(g, -9 + i * 5, 6, 4, 6, 1, { fill: '#c8c8e0', lw: 1.4, seed: sd + 5 + i });
}

function slipmat(g, p, sd) {
  ellipse(g, 14, -10, 28, 28, { fill: '#7b5cff', lw: 3, seed: sd + 1 });
  emblem(g, 'bolt', 18, -14, 0.8, '#ffd23f', sd + 2);
  ellipse(g, -14, 10, 28, 28, { fill: '#140f26', lw: 3, seed: sd });
  text(g, 'ECHO', -14, 15, { size: 11, font: FONTS.sign, fill: '#3ec7b0', lw: 0 });
}

// ---------------------------------------------------------------- bodega

function freshener(g, p, sd) {
  stroke(g, [[0, -46], [0, -32]], { lw: 1.6, seed: sd });
  ellipse(g, 0, -48, 3, 3, { fill: 'none', lw: 1.6, seed: sd });
  shape(g, [[0, -34], [-16, -10], [-8, -10], [-24, 14], [-10, 14], [-28, 36], [28, 36], [10, 14], [24, 14], [8, -10], [16, -10]], { fill: p.c || '#ffd23f', shade: shade(p.c || '#ffd23f', 0.25), sdx: 2, sdy: 2, lw: 3, smooth: false, seed: sd + 1 });
  rrect(g, -4, 36, 8, 8, 1, { fill: '#c8742e', lw: 2, seed: sd + 2 });
  text(g, 'CHOPPED', 0, 12, { size: 6, font: FONTS.sign, fill: INK, lw: 0 });
  text(g, 'CHEESE', 0, 22, { size: 6, font: FONTS.sign, fill: INK, lw: 0 });
}

function chips(g, p, sd) {
  const c = p.c || '#ff8a3d';
  blob(g, [['M', -28, -36], ['L', 28, -36], ['L', 26, -30], ['C', 32, 0, 32, 20, 26, 34], ['L', 28, 40], ['L', -28, 40], ['L', -26, 34], ['C', -32, 20, -32, 0, -26, -30], ['Z']], { fill: c, shade: shade(c, 0.25), sdx: 3, sdy: 3, lw: 3, seed: sd });
  for (let i = -24; i < 26; i += 4) {
    stroke(g, [[i, -36], [i + 2, -32]], { lw: 1, color: rgba('#140f26', 0.5) });
    stroke(g, [[i, 40], [i + 2, 36]], { lw: 1, color: rgba('#140f26', 0.5) });
  }
  text(g, 'CHEEZ', 0, -12, { size: 13, font: FONTS.drip, fill: '#ffd23f', lw: 3, rot: -0.1 });
  text(g, 'RATS', 0, 4, { size: 13, font: FONTS.drip, fill: '#fffaf0', lw: 3, rot: -0.1 });
  emblem(g, 'rat', 0, 22, 0.7, '#fffaf0', sd + 1);
}

function soda(g, p, sd) {
  const c = p.c || '#3ec7b0';
  rrect(g, -18, -36, 36, 74, 6, { fill: c, shade: shade(c, 0.3), sdx: 3, sdy: 3, lw: 3, seed: sd });
  rrect(g, -16, -40, 32, 8, 3, { fill: '#c8c8e0', lw: 2.4, seed: sd + 1 });
  rrect(g, -16, 32, 32, 7, 3, { fill: '#c8c8e0', lw: 2.4, seed: sd + 2 });
  emblem(g, 'bolt', 0, -8, 1, '#ffd23f', sd + 3);
  text(g, '3RD', 0, 14, { size: 11, font: FONTS.sign, fill: '#140f26', lw: 0 });
  text(g, 'RAIL', 0, 25, { size: 9, font: FONTS.sign, fill: '#140f26', lw: 0 });
}

function brownbag(g, p, sd) {
  blob(g, [['M', -26, -30], ['L', 26, -30], ['L', 30, 40], ['L', -30, 40], ['Z']], { fill: '#c89a62', shade: '#a07844', sdx: 3, sdy: 3, lw: 3, seed: sd });
  shape(g, [[-26, -30], [-22, -40], [-14, -32], [-6, -42], [2, -32], [10, -42], [18, -32], [26, -40], [26, -30]], { fill: '#d8aa72', lw: 2.6, smooth: false, seed: sd + 1 });
  text(g, '?', 0, 22, { size: 40, font: FONTS.marker, fill: '#140f26', lw: 0 });
}

function candle(g, p, sd) {
  const c = p.c || '#ffd23f';
  rrect(g, -22, -18, 44, 56, 4, { fill: rgba('#ffffff', 0.25), lw: 3, seed: sd });
  rrect(g, -18, -6, 36, 40, 3, { fill: c, lw: 0, seed: sd + 1 });
  rrect(g, -16, 2, 32, 22, 2, { fill: '#fffaf0', lw: 2, seed: sd + 2 });
  if (p.c === '#7b5cff') emblem(g, 'moth', 0, 13, 0.6, '#7b5cff', sd + 3);
  else {
    // lucky cat face
    ellipse(g, 0, 14, 8, 7, { fill: '#fffaf0', lw: 1.6, seed: sd + 3 });
    dot(g, -3, 13, 1.2, INK); dot(g, 3, 13, 1.2, INK);
    stroke(g, [[-7, 8], [-5, 4], [-3, 8]], { lw: 1.4 }); stroke(g, [[3, 8], [5, 4], [7, 8]], { lw: 1.4 });
  }
  stroke(g, [[0, -18], [0, -24]], { lw: 2, seed: sd + 4 });
  blob(g, [['M', 0, -40], ['C', 8, -30, 6, -24, 0, -22], ['C', -6, -24, -8, -30, 0, -40], ['Z']], { fill: '#ffb03a', lw: 2.4, seed: sd + 5 });
  blob(g, [['M', 0, -34], ['C', 3, -28, 3, -25, 0, -24], ['C', -3, -25, -3, -28, 0, -34], ['Z']], { fill: '#fff6c8', lw: 0, seed: sd + 6 });
}

function mug(g, p, sd) {
  const c = p.c || '#f4efe6';
  tube(g, pathPts([['M', 22, -14], ['C', 42, -14, 42, 16, 22, 16]]), c, 6, { lw: 3, seed: sd });
  rrect(g, -28, -26, 52, 58, 8, { fill: c, shade: shade(c, 0.18), sdx: 3, sdy: 3, lw: 3, seed: sd + 1 });
  ellipse(g, -2, 2, 12, 11, { fill: '#f0a050', lw: 2.2, seed: sd + 2 });
  shape(g, [[-12, -4], [-11, -14], [-6, -8]], { fill: '#f0a050', lw: 2, smooth: false });
  shape(g, [[8, -4], [7, -14], [2, -8]], { fill: '#f0a050', lw: 2, smooth: false });
  stroke(g, [[-7, 0], [-3, 1]], { lw: 1.6 }); stroke(g, [[1, 1], [5, 0]], { lw: 1.6 });
  text(g, 'BODEGA', -2, 26, { size: 7, font: FONTS.sign, fill: '#e8456b', lw: 0 });
  stroke(g, [[-14, -34], [-10, -42], [-14, -50]], { lw: 1.6, color: rgba('#fffaf0', 0.6) });
  stroke(g, [[4, -34], [8, -42], [4, -50]], { lw: 1.6, color: rgba('#fffaf0', 0.6) });
}

function wallet(g, p, sd) {
  const c = p.c || '#ffc93d';
  rrect(g, -38, -26, 76, 52, 7, { fill: '#2a2238', shade: '#1a1430', sdx: 3, sdy: 3, lw: 3, seed: sd });
  rrect(g, -32, -20, 64, 40, 4, { fill: c, lw: 2.4, seed: sd + 1, rot: 0 });
  text(g, 'FARE CARD', -2, -4, { size: 9, font: FONTS.sign, fill: '#2a2238', lw: 0 });
  rect(g, -32, 6, 64, 6, { fill: '#2a2238', lw: 0, amp: 0 });
  text(g, '3RD RAIL', -10, 18, { size: 6, font: FONTS.sign, fill: '#2a2238', lw: 0 });
}

// ---------------------------------------------------------------- secret stock

function keychain(g, p, sd) {
  ellipse(g, 0, -40, 8, 8, { fill: 'none', lw: 3, line: '#c8c8e0', seed: sd });
  stroke(g, [[0, -32], [0, -18]], { lw: 2.4, color: '#c8c8e0', seed: sd + 1 });
  ellipse(g, 0, 4, 22, 22, { fill: rgba('#b48cff', 0.7), shade: rgba('#7b5cff', 0.6), sdx: 3, sdy: 3, lw: 3, seed: sd + 2 });
  ellipse(g, -7, -4, 6, 4, { fill: rgba('#ffffff', 0.7), lw: 0, rot: -0.6, seed: sd + 3 });
  dot(g, 4, 8, 2, '#ffd23f'); dot(g, -4, 12, 1.4, '#fffaf0'); dot(g, 8, -2, 1.2, '#fffaf0');
  rrect(g, -14, 22, 28, 10, 3, { fill: '#c8a050', lw: 2.6, seed: sd + 4 });
}

function tarot(g, p, sd) {
  for (const i of [0, 2, 1]) {
    g.save();
    g.rotate((i - 1) * 0.28);
    g.translate((i - 1) * 6, 4);
    rrect(g, -18, -34, 36, 62, 4, { fill: '#2a1a4a', lw: 3, seed: sd + i });
    rrect(g, -14, -30, 28, 54, 3, { fill: 'none', lw: 1.4, line: '#ffd23f', seed: sd + 10 + i });
    if (i === 1) {
      emblem(g, 'eye', 0, -8, 0.7, '#b48cff', sd + 20);
      emblem(g, 'star', 0, 14, 0.45, '#ffd23f', sd + 21);
    }
    g.restore();
  }
}

function necklace(g, p, sd) {
  const pts = pathPts([['M', -32, -34], ['C', -32, 4, 32, 4, 32, -34]], 14);
  stroke(g, pts, { lw: 2.2, color: '#c89a62', seed: sd });
  for (let i = 2; i < pts.length - 2; i += 2) {
    const [x, y] = pts[i];
    shape(g, [[x - 4, y], [x + 4, y], [x, y + 12]], { fill: '#fffaf0', lw: 2, seed: sd + i });
  }
  shape(g, [[-7, 0], [7, 0], [0, 24]], { fill: '#ffd23f', lw: 2.4, seed: sd + 50 });
}

function coasters(g, p, sd) {
  for (const [x, y, i] of [[-16, 8, 0], [14, -6, 1]]) {
    ellipse(g, x, y, 28, 28, { fill: '#4a4660', shade: '#2e2a44', sdx: 3, sdy: 3, lw: 3, seed: sd + i });
    for (let k = -20; k <= 20; k += 6) stroke(g, [[x + k, y - Math.sqrt(Math.max(0, 600 - k * k)) * 0.8], [x + k, y + Math.sqrt(Math.max(0, 600 - k * k)) * 0.8]], { lw: 1.2, color: rgba('#140f26', 0.6) });
    ellipse(g, x, y, 11, 11, { fill: '#5a5676', lw: 2, seed: sd + 5 + i });
    text(g, 'SEWER', x, y + 3, { size: 5.5, font: FONTS.sign, fill: '#c8c8e0', lw: 0 });
  }
}

function bobble(g, p, sd) {
  rrect(g, -22, 28, 44, 12, 3, { fill: '#2a2238', lw: 3, seed: sd });
  text(g, 'BIG AL', 0, 37, { size: 7, font: FONTS.sign, fill: '#ffd23f', lw: 0 });
  rrect(g, -12, 4, 24, 26, 6, { fill: '#e8d6b8', lw: 3, seed: sd + 1 });
  stroke(g, [[0, 4], [0, -4]], { lw: 2, seed: sd + 2 });
  blob(g, [['M', -20, -10], ['C', -24, -36, 0, -40, 8, -34], ['L', 34, -26], ['C', 38, -20, 34, -16, 28, -16], ['L', -10, -6], ['Z']], { fill: '#4f9a4a', shade: '#3a7a36', sdx: 2, sdy: 2, lw: 3, seed: sd + 3 });
  for (let i = 0; i < 5; i++) shape(g, [[0 + i * 6, -18], [3 + i * 6, -13], [6 + i * 6, -18]], { fill: i === 2 ? '#ffd23f' : '#fffaf0', lw: 1.4, smooth: false });
  rrect(g, -12, -34, 16, 7, 2, { fill: '#140f26', lw: 2, seed: sd + 4 });
}

function watch(g, p, sd) {
  stroke(g, pathPts([['M', 0, -30], ['C', 20, -50, 40, -30, 34, -6]]), { lw: 2.6, color: '#ffd23f', seed: sd });
  rrect(g, -4, -40, 8, 8, 2, { fill: '#ffd23f', lw: 2.4, seed: sd + 1 });
  ellipse(g, 0, 0, 30, 30, { fill: '#ffd23f', shade: '#c8901a', sdx: 3, sdy: 3, lw: 3, seed: sd + 2 });
  ellipse(g, 0, 0, 24, 24, { fill: '#fffaf0', lw: 2, seed: sd + 3 });
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    dot(g, Math.cos(a) * 19, Math.sin(a) * 19, 1.4, INK);
  }
  stroke(g, [[0, 0], [0, -14]], { lw: 2.4 });
  stroke(g, [[0, 0], [10, 4]], { lw: 2 });
  text(g, '1904', 0, 12, { size: 5, font: FONTS.sign, fill: INK, lw: 0 });
}

function pin(g, p, sd) {
  g.save();
  g.globalCompositeOperation = 'lighter';
  const gl = g.createRadialGradient(0, 0, 4, 0, 0, 44);
  gl.addColorStop(0, rgba('#9affe0', 0.45));
  gl.addColorStop(1, rgba('#9affe0', 0));
  g.fillStyle = gl;
  g.fillRect(-50, -50, 100, 100);
  g.restore();
  ellipse(g, 0, 0, 28, 28, { fill: '#bff8ec', shade: '#7ad8c0', sdx: 3, sdy: 3, lw: 3, seed: sd });
  ellipse(g, 0, 0, 20, 20, { fill: '#e8fff8', lw: 2, seed: sd + 1 });
  emblem(g, 'ghost', 0, 0, 1, '#bff8ec', sd + 2);
}

function lantern(g, p, sd) {
  stroke(g, pathPts([['M', -12, -38], ['Q', 0, -54, 12, -38]]), { lw: 2.6, color: '#3a3456', seed: sd });
  rrect(g, -18, -38, 36, 8, 2, { fill: '#3a3456', lw: 2.6, seed: sd + 1 });
  g.save();
  g.globalCompositeOperation = 'lighter';
  const gl = g.createRadialGradient(0, 0, 4, 0, 0, 46);
  gl.addColorStop(0, rgba('#9affe0', 0.5));
  gl.addColorStop(1, rgba('#9affe0', 0));
  g.fillStyle = gl;
  g.fillRect(-50, -50, 100, 100);
  g.restore();
  rrect(g, -16, -30, 32, 52, 6, { fill: rgba('#bff8ec', 0.55), lw: 3, seed: sd + 2 });
  stroke(g, [[-16, -10], [16, -10]], { lw: 2, color: '#3a3456' });
  stroke(g, [[0, -30], [0, 22]], { lw: 2, color: '#3a3456' });
  blob(g, [['M', 0, -6], ['C', 6, 2, 4, 8, 0, 9], ['C', -4, 8, -6, 2, 0, -6], ['Z']], { fill: '#e8fff8', lw: 1.6, seed: sd + 3 });
  rrect(g, -18, 22, 36, 8, 2, { fill: '#3a3456', lw: 2.6, seed: sd + 4 });
}

// ---------------------------------------------------------------- registry

const DRAW = {
  hoodie, tee, jacket, windbreaker, pants, cap, beanie, bucket, chain, bag, bandana, shades,
  low: (g, p, sd) => sneaker(g, p, sd, false),
  high: (g, p, sd) => sneaker(g, p, sd, true),
  slides, socks, cans, markers, stickerpack, sketchbook, print, patches, deck,
  cassette, vinyl, headphones, boombox, slipmat,
  freshener, chips, soda, brownbag, candle, mug, wallet,
  keychain, tarot, necklace, coasters, bobble, watch, pin, lantern,
};

export const ART_TYPES = Object.keys(DRAW);

export function drawProduct(g, art, x = 0, y = 0, s = 1, seed = 1) {
  const fn = DRAW[art.type];
  g.save();
  g.translate(x, y);
  g.scale(s, s);
  if (fn) fn(g, art, seed);
  else rrect(g, -30, -30, 60, 60, 8, { fill: '#5a5276', lw: 3 });
  g.restore();
}

// Cached product images for the DOM (data URLs), keyed by id + size.
const urlCache = new Map();
export function productImage(product, px = 220) {
  const key = product.id + '@' + px;
  if (urlCache.has(key)) return urlCache.get(key);
  const c = makeCanvas(px, px);
  const g = c.getContext('2d');
  g.scale(px / 110, px / 110);
  g.translate(55, 55);
  drawProduct(g, product.art, 0, 0, 1, (product.seed || 7));
  const url = c.toDataURL('image/png');
  urlCache.set(key, url);
  return url;
}

export function emblemImage(kind, color, px = 96, bg = null) {
  const key = `emb:${kind}:${color}:${px}:${bg}`;
  if (urlCache.has(key)) return urlCache.get(key);
  const c = makeCanvas(px, px);
  const g = c.getContext('2d');
  g.scale(px / 40, px / 40);
  g.translate(20, 20);
  if (bg) ellipse(g, 0, 0, 17, 17, { fill: bg, lw: 2.4, seed: 3 });
  emblem(g, kind, 0, 0, 0.95, color, 5);
  const url = c.toDataURL('image/png');
  urlCache.set(key, url);
  return url;
}
