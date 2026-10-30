// Graffiti generators: hand tags, bubble-letter throw-ups, big pieces and
// sticker clusters. Used on car walls, the logo, the tag wall and the runner.
import {
  rrect, dot, text, drips, FONTS, mulberry32, shade, rgba, measure,
} from '../ink.js';

// ---------------------------------------------------------------- graffiti

export const TAG_WORDS = ['RIZO', 'KAPS', 'NEKO', 'SKUM', 'VYBE', 'ZEEK', 'MOTOR', 'BOLT', 'GRIME', 'TOKN', 'LUXE', 'YUM', 'OKAY', 'PEZ', 'DUST', 'NOVA', 'CHEZ', 'BLIP', 'SOOT', 'WHYS', 'DEUX', 'FOMO', 'MUNK'];
export const SPRAY = ['#ff4f9a', '#ffd23f', '#3ec7b0', '#7ed957', '#ff8a3d', '#5aa0ff', '#b48cff', '#f4efe6'];

export function tag(g, x, y, o = {}) {
  const r = mulberry32(o.seed || 1);
  const word = o.word || TAG_WORDS[Math.floor(r() * TAG_WORDS.length)];
  const col = o.color || SPRAY[Math.floor(r() * SPRAY.length)];
  const size = o.size || 26 + r() * 16;
  const rot = o.rot ?? (r() - 0.5) * 0.35;
  g.save();
  g.globalAlpha *= o.alpha ?? 0.92;
  text(g, word, x, y, { size, font: FONTS.tag, fill: col, lw: size * 0.06, line: rgba('#140f26', 0.8), rot, skewX: -0.15 });
  if (r() < 0.6) {
    const w = measure(g, word, size, FONTS.tag);
    g.save();
    g.translate(x, y);
    g.rotate(rot);
    drips(g, -w * 0.4, -size * 0.1, w * 0.8, col, (o.seed || 1) + 9, { count: 2 + Math.floor(r() * 3), maxLen: 18, thick: 2.2, line: null });
    g.restore();
  }
  g.restore();
}

// Bubble-letter throw-up: thick outline, fill, 3D shadow, shine dots.
export function throwup(g, x, y, o = {}) {
  const r = mulberry32(o.seed || 2);
  const word = o.word || TAG_WORDS[Math.floor(r() * TAG_WORDS.length)];
  const fill = o.fill || SPRAY[Math.floor(r() * SPRAY.length)];
  const out = o.outline || '#140f26';
  const size = o.size || 44;
  const rot = o.rot ?? (r() - 0.5) * 0.18;
  text(g, word, x, y, {
    size, font: o.font || FONTS.drip, fill, line: out, lw: size * 0.2, rot,
    extrude: [size * 0.07, size * 0.09, 4, shade(fill, 0.6)],
  });
  // shine dots
  g.save();
  g.translate(x, y);
  g.rotate(rot);
  const w = measure(g, word, size, o.font || FONTS.drip);
  for (let i = 0; i < 3; i++) dot(g, -w / 2 + w * (0.15 + i * 0.3) + r() * 8, -size * 0.55 + r() * 6, 2.4, rgba('#ffffff', 0.85));
  g.restore();
}

// Big multi-color piece (for legal walls + logos).
export function piece(g, x, y, word, o = {}) {
  const size = o.size || 72;
  const fill = o.fill || '#ff4f9a';
  const fill2 = o.fill2 || '#ffd23f';
  const rot = o.rot ?? -0.04;
  const font = o.font || FONTS.drip;
  g.save();
  g.translate(x, y);
  g.rotate(rot);
  g.font = `${size}px ${font}`;
  const w = g.measureText(word).width;
  // glow cloud behind
  if (o.cloud !== false) {
    const r = mulberry32(o.seed || 3);
    for (let i = 0; i < 14; i++) {
      const cx = -w / 2 + r() * w, cy = -size * 0.35 + (r() - 0.5) * size * 0.8;
      g.fillStyle = rgba(o.cloudColor || '#b48cff', 0.22);
      g.beginPath();
      g.arc(cx, cy, size * (0.25 + r() * 0.3), 0, Math.PI * 2);
      g.fill();
    }
  }
  const grad = g.createLinearGradient(0, -size * 0.8, 0, size * 0.1);
  grad.addColorStop(0, fill2);
  grad.addColorStop(1, fill);
  text(g, word, 0, 0, {
    size, font, fill: grad, line: o.outline || '#140f26', lw: size * 0.16,
    extrude: [size * 0.06, size * 0.08, 5, o.extrudeColor || '#2a1a4a'],
  });
  // highlight line along letter tops
  g.save();
  g.beginPath();
  g.rect(-w, -size * 0.85, w * 2, size * 0.18);
  g.clip();
  text(g, word, 0, 0, { size, font, fill: rgba('#ffffff', 0.55), lw: 0 });
  g.restore();
  if (o.drips !== false) drips(g, -w * 0.45, -size * 0.04, w * 0.9, fill, (o.seed || 3) + 1, { count: Math.round(w / 40), maxLen: size * 0.4, thick: size * 0.06 });
  // sparkles
  const sp = (sx, sy, s) => {
    g.fillStyle = '#fffaf0';
    g.beginPath();
    g.moveTo(sx, sy - s); g.lineTo(sx + s * 0.25, sy - s * 0.25); g.lineTo(sx + s, sy);
    g.lineTo(sx + s * 0.25, sy + s * 0.25); g.lineTo(sx, sy + s); g.lineTo(sx - s * 0.25, sy + s * 0.25);
    g.lineTo(sx - s, sy); g.lineTo(sx - s * 0.25, sy - s * 0.25); g.closePath();
    g.fill();
  };
  sp(-w * 0.52, -size * 0.75, size * 0.12);
  sp(w * 0.5, -size * 0.2, size * 0.09);
  g.restore();
}

// A cluster of stickers slapped on a wall/column.
export function stickers(g, x, y, n, seed = 5) {
  const r = mulberry32(seed);
  for (let i = 0; i < n; i++) {
    const sx = x + (r() - 0.5) * 50, sy = y + (r() - 0.5) * 40;
    const w = 14 + r() * 14, h = 9 + r() * 10;
    const col = SPRAY[Math.floor(r() * SPRAY.length)];
    g.save();
    g.translate(sx, sy);
    g.rotate((r() - 0.5) * 0.7);
    rrect(g, -w / 2, -h / 2, w, h, 2, { fill: '#fffaf0', lw: 1.6, amp: 0.2, seed: seed + i });
    rrect(g, -w / 2 + 2, -h / 2 + 2, w - 4, h - 4, 1.5, { fill: col, lw: 0, amp: 0, seed: seed + i });
    if (r() < 0.5) text(g, TAG_WORDS[Math.floor(r() * TAG_WORDS.length)], 0, h * 0.2, { size: h * 0.55, font: FONTS.sign, fill: '#140f26', lw: 0 });
    g.restore();
  }
}
