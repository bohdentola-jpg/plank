// The classic block face painted on the field: yard numbers, end zone names,
// water towers and old scoreboards. Glyphs are centre-line polylines on a
// 4 × 6 grid (y up) drawn with a heavy square stroke, so they come out as
// square-cornered block letters, identical on every machine.

const G = {
  0: [[[0, 0], [4, 0], [4, 6], [0, 6], 'z']],
  1: [[[0.7, 4.9], [2, 6], [2, 0]]],
  2: [[[0, 6], [4, 6], [4, 3], [0, 3], [0, 0], [4, 0]]],
  3: [[[0, 6], [4, 6], [4, 0], [0, 0]], [[1.2, 3], [4, 3]]],
  4: [[[0, 6], [0, 2.4], [4.2, 2.4]], [[3.1, 6], [3.1, 0]]],
  5: [[[4, 6], [0, 6], [0, 3.1], [4, 3.1], [4, 0], [0, 0]]],
  6: [[[4, 6], [0, 6], [0, 0], [4, 0], [4, 3.1], [0, 3.1]]],
  7: [[[0, 6], [4, 6], [4, 4.6], [1.8, 0]]],
  8: [[[0, 0], [4, 0], [4, 6], [0, 6], 'z'], [[0, 3.1], [4, 3.1]]],
  9: [[[4, 2.9], [0, 2.9], [0, 6], [4, 6], [4, 0], [0, 0]]],
  A: [[[0, 0], [0, 6], [4, 6], [4, 0]], [[0, 2.8], [4, 2.8]]],
  B: [[[0, 0], [0, 6], [3, 6], [3.8, 5.2], [3.8, 3.8], [3, 3.1], [0, 3.1]], [[3, 3.1], [4, 2.3], [4, 0.8], [3.2, 0], [0, 0]]],
  C: [[[4, 6], [0, 6], [0, 0], [4, 0]]],
  D: [[[0, 0], [0, 6], [3, 6], [4, 5], [4, 1], [3, 0], 'z']],
  E: [[[4, 6], [0, 6], [0, 0], [4, 0]], [[0, 3.1], [3, 3.1]]],
  F: [[[4, 6], [0, 6], [0, 0]], [[0, 3.1], [3, 3.1]]],
  G: [[[4, 6], [0, 6], [0, 0], [4, 0], [4, 3], [2.2, 3]]],
  H: [[[0, 0], [0, 6]], [[4, 0], [4, 6]], [[0, 3.1], [4, 3.1]]],
  I: [[[0, 6], [2, 6]], [[1, 6], [1, 0]], [[0, 0], [2, 0]]],
  J: [[[4, 6], [4, 0], [0, 0], [0, 2]]],
  K: [[[0, 0], [0, 6]], [[4, 6], [1.3, 3.1], [0, 3.1]], [[1.3, 3.1], [4.1, 0]]],
  L: [[[0, 6], [0, 0], [4, 0]]],
  M: [[[0, 0], [0, 6], [2.5, 3], [5, 6], [5, 0]]],
  N: [[[0, 0], [0, 6], [4, 0], [4, 6]]],
  O: [[[0, 0], [4, 0], [4, 6], [0, 6], 'z']],
  P: [[[0, 0], [0, 6], [4, 6], [4, 3], [0, 3]]],
  Q: [[[0, 0], [4, 0], [4, 6], [0, 6], 'z'], [[2.4, 1.5], [4.3, -0.5]]],
  R: [[[0, 0], [0, 6], [4, 6], [4, 3], [0, 3]], [[1.9, 3], [4.1, 0]]],
  S: [[[4, 6], [0, 6], [0, 3.1], [4, 3.1], [4, 0], [0, 0]]],
  T: [[[0, 6], [4.4, 6]], [[2.2, 6], [2.2, 0]]],
  U: [[[0, 6], [0, 0], [4, 0], [4, 6]]],
  V: [[[0, 6], [2.1, 0], [4.2, 6]]],
  W: [[[0, 6], [1.2, 0], [2.6, 4], [4, 0], [5.2, 6]]],
  X: [[[0, 6], [4, 0]], [[0, 0], [4, 6]]],
  Y: [[[0, 6], [2.1, 3], [4.2, 6]], [[2.1, 3], [2.1, 0]]],
  Z: [[[0, 6], [4, 6], [0, 0], [4, 0]]],
  '-': [[[0.3, 3], [2.7, 3]]],
  '.': [[[0.2, 0.2], [0.8, 0.2]]],
  "'": [[[0.4, 6], [0.4, 4.4]]],
  '&': [[[4.2, 0], [0.8, 4.2], [0.8, 6], [3, 6], [3, 4.4], [0, 2], [0, 0], [3, 0], [4.2, 1.6]]],
  '!': [[[0.5, 6], [0.5, 2]], [[0.5, 0.6], [0.5, 0]]],
  '#': [[[1.2, 0], [1.6, 6]], [[2.8, 0], [3.2, 6]], [[0, 2], [4.2, 2]], [[0, 4], [4.2, 4]]],
  ':': [[[0.4, 0.2], [0.4, 0.9]], [[0.4, 4.1], [0.4, 4.8]]],
};

const W = {};
for (const [k, strokes] of Object.entries(G)) {
  let w = 0;
  for (const s of strokes) for (const p of s) if (Array.isArray(p)) w = Math.max(w, p[0]);
  W[k] = w;
}
W[' '] = 2.4;

const glyph = (ch) => {
  const u = String(ch).toUpperCase();
  return G[u] ? u : (u === ' ' ? ' ' : '-');
};

/**
 * Metrics for a string. size = outer cap height in px, weight = stroke as a
 * fraction of the 6-unit grid (1.25 ≈ heavy block). Returns { width, scale, pad }.
 */
export function blockMetrics(str, size, weight = 1.25, gap = 1.3) {
  const unit = size / (6 + weight);
  let w = 0;
  const s = String(str);
  for (let i = 0; i < s.length; i++) {
    const g = glyph(s[i]);
    w += W[g] * unit + (i < s.length - 1 ? gap * unit + weight * unit : 0);
  }
  return { width: w + weight * unit, unit, pad: weight * unit / 2 };
}

/**
 * Draw block text. (x, y) = the bottom-left of the outer glyph box unless
 * opts.align = 'center' | 'right'. y is the baseline (bottom of the strokes).
 * opts: { weight, gap, color, outline (px), outlineColor, shadow [dx, dy, col], squeeze (x scale) }
 */
export function blockText(ctx, str, x, y, size, opts = {}) {
  const s = String(str);
  const weight = opts.weight ?? 1.25;
  const gap = opts.gap ?? 1.3;
  const m = blockMetrics(s, size, weight, gap);
  const sq = opts.squeeze ?? 1;
  let ox = x;
  if (opts.align === 'center') ox = x - (m.width * sq) / 2;
  else if (opts.align === 'right') ox = x - m.width * sq;
  const u = m.unit;
  const trace = () => {
    ctx.beginPath();
    let cx = ox / sq + m.pad;
    for (let i = 0; i < s.length; i++) {
      const g = glyph(s[i]);
      const strokes = G[g];
      if (strokes) {
        for (const st of strokes) {
          let first = true;
          for (const p of st) {
            if (p === 'z') { ctx.closePath(); continue; }
            const px = cx + p[0] * u, py = y - m.pad - p[1] * u;
            if (first) { ctx.moveTo(px, py); first = false; } else ctx.lineTo(px, py);
          }
        }
      }
      cx += W[g] * u + gap * u + weight * u;
    }
  };
  ctx.save();
  if (sq !== 1) { ctx.translate(0, 0); ctx.scale(sq, 1); }
  ctx.lineJoin = 'miter';
  ctx.miterLimit = 4;
  ctx.lineCap = 'square';
  const lw = weight * u;
  if (opts.shadow) {
    ctx.save();
    ctx.translate(opts.shadow[0] / sq, opts.shadow[1]);
    trace();
    ctx.lineWidth = lw + (opts.outline || 0) * 2;
    ctx.strokeStyle = opts.shadow[2] || 'rgba(0,0,0,0.5)';
    ctx.stroke();
    ctx.restore();
  }
  if (opts.outline) {
    trace();
    ctx.lineWidth = lw + opts.outline * 2;
    ctx.strokeStyle = opts.outlineColor || '#000';
    ctx.stroke();
  }
  trace();
  ctx.lineWidth = lw;
  ctx.strokeStyle = opts.color || '#fff';
  ctx.stroke();
  ctx.restore();
  return m.width * sq;
}
