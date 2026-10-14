// A chamfered, wide, techno display face drawn as strokes — the game's own
// "racing font", identical on every machine. Glyphs live on a grid where the
// cap height is 6 units, baseline 0, y up. A stroke is a polyline [[x,y],…];
// a dot is {d:[x,y]}.

const G = {
  A: [[[0, 0], [0, 5], [1, 6], [3, 6], [4, 5], [4, 0]], [[0, 2.8], [4, 2.8]]],
  B: [[[0, 3], [3, 3], [4, 2], [4, 1], [3, 0], [0, 0], [0, 6], [3, 6], [4, 5], [4, 4], [3, 3]]],
  C: [[[4, 6], [1, 6], [0, 5], [0, 1], [1, 0], [4, 0]]],
  D: [[[0, 0], [0, 6], [3, 6], [4, 5], [4, 1], [3, 0], [0, 0]]],
  E: [[[4, 6], [0, 6], [0, 0], [4, 0]], [[0, 3], [3.2, 3]]],
  F: [[[4, 6], [0, 6], [0, 0]], [[0, 3], [3.2, 3]]],
  G: [[[4, 6], [1, 6], [0, 5], [0, 1], [1, 0], [4, 0], [4, 3], [2.2, 3]]],
  H: [[[0, 0], [0, 6]], [[4, 0], [4, 6]], [[0, 3], [4, 3]]],
  I: [[[0, 0], [0, 6]]],
  J: [[[4, 6], [4, 1], [3, 0], [1, 0], [0, 1], [0, 1.6]]],
  K: [[[0, 0], [0, 6]], [[4, 6], [1.2, 3], [0, 3]], [[1.2, 3], [4, 0]]],
  L: [[[0, 6], [0, 0], [4, 0]]],
  M: [[[0, 0], [0, 6], [2.5, 3], [5, 6], [5, 0]]],
  N: [[[0, 0], [0, 6], [4, 0], [4, 6]]],
  O: [[[1, 0], [0, 1], [0, 5], [1, 6], [3, 6], [4, 5], [4, 1], [3, 0], [1, 0]]],
  P: [[[0, 0], [0, 6], [3, 6], [4, 5], [4, 4], [3, 3], [0, 3]]],
  Q: [[[1, 0], [0, 1], [0, 5], [1, 6], [3, 6], [4, 5], [4, 1], [3, 0], [1, 0]], [[2.6, 1.4], [4.2, -0.3]]],
  R: [[[0, 0], [0, 6], [3, 6], [4, 5], [4, 4], [3, 3], [0, 3]], [[2.4, 3], [4, 0]]],
  S: [[[4, 6], [1, 6], [0, 5], [0, 4], [1, 3], [3, 3], [4, 2], [4, 1], [3, 0], [0, 0]]],
  T: [[[0, 6], [4.4, 6]], [[2.2, 6], [2.2, 0]]],
  U: [[[0, 6], [0, 1], [1, 0], [3, 0], [4, 1], [4, 6]]],
  V: [[[0, 6], [2.1, 0], [4.2, 6]]],
  W: [[[0, 6], [1.3, 0], [2.6, 4.2], [3.9, 0], [5.2, 6]]],
  X: [[[0, 6], [4, 0]], [[0, 0], [4, 6]]],
  Y: [[[0, 6], [2.1, 3], [4.2, 6]], [[2.1, 3], [2.1, 0]]],
  Z: [[[0, 6], [4, 6], [0, 0], [4, 0]]],
  0: [[[1, 0], [0, 1], [0, 5], [1, 6], [2.6, 6], [3.6, 5], [3.6, 1], [2.6, 0], [1, 0]]],
  1: [[[0, 4.8], [1.3, 6], [1.3, 0]]],
  2: [[[0, 6], [2.6, 6], [3.6, 5], [3.6, 4], [2.6, 3], [1, 3], [0, 2], [0, 0], [3.6, 0]]],
  3: [[[0, 6], [2.6, 6], [3.6, 5], [3.6, 4], [2.6, 3], [0.8, 3]], [[2.6, 3], [3.6, 2], [3.6, 1], [2.6, 0], [0, 0]]],
  4: [[[0, 6], [0, 2.2], [3.6, 2.2]], [[2.8, 4], [2.8, 0]]],
  5: [[[3.6, 6], [0, 6], [0, 3], [2.6, 3], [3.6, 2], [3.6, 1], [2.6, 0], [0, 0]]],
  6: [[[3.6, 6], [1, 6], [0, 5], [0, 1], [1, 0], [2.6, 0], [3.6, 1], [3.6, 2], [2.6, 3], [0, 3]]],
  7: [[[0, 6], [3.6, 6], [3.6, 5], [1.4, 0]]],
  8: [[[1, 3], [0, 4], [0, 5], [1, 6], [2.6, 6], [3.6, 5], [3.6, 4], [2.6, 3], [1, 3], [0, 2], [0, 1], [1, 0], [2.6, 0], [3.6, 1], [3.6, 2], [2.6, 3]]],
  9: [[[0, 0], [2.6, 0], [3.6, 1], [3.6, 5], [2.6, 6], [1, 6], [0, 5], [0, 4], [1, 3], [3.6, 3]]],
  '.': [{ d: [0.35, 0.35] }],
  ',': [[[0.5, 0.6], [0.5, 0], [0, -0.9]]],
  ':': [{ d: [0.35, 0.6] }, { d: [0.35, 4.2] }],
  ';': [{ d: [0.5, 4.2] }, [[0.5, 0.6], [0.5, 0], [0, -0.9]]],
  '-': [[[0, 3], [2.6, 3]]],
  '+': [[[0, 3], [3.2, 3]], [[1.6, 1.4], [1.6, 4.6]]],
  '=': [[[0, 2], [3.2, 2]], [[0, 4], [3.2, 4]]],
  '/': [[[0, -0.3], [3, 6.3]]],
  '\\': [[[0, 6.3], [3, -0.3]]],
  '!': [[[0.35, 6], [0.35, 2]], { d: [0.35, 0.35] }],
  '?': [[[0, 5], [1, 6], [3, 6], [4, 5], [4, 4], [3, 3], [2, 3], [2, 1.9]], { d: [2, 0.35] }],
  "'": [[[0.35, 6], [0.35, 4.4]]],
  '"': [[[0.35, 6], [0.35, 4.4]], [[1.6, 6], [1.6, 4.4]]],
  '%': [[[0, 0], [4, 6]], { d: [0.4, 5.4] }, { d: [3.6, 0.6] }],
  '#': [[[1.2, 0], [1.6, 6]], [[2.8, 0], [3.2, 6]], [[0, 2], [4.2, 2]], [[0, 4], [4.2, 4]]],
  '&': [[[4.2, 0], [1, 4], [1, 5], [2, 6], [3, 5], [3, 4.4], [0, 2.2], [0, 1], [1, 0], [2.6, 0], [4.2, 2]]],
  '(': [[[1.6, 6.6], [0.4, 5.2], [0.4, 0.8], [1.6, -0.6]]],
  ')': [[[0, 6.6], [1.2, 5.2], [1.2, 0.8], [0, -0.6]]],
  '[': [[[1.4, 6.6], [0, 6.6], [0, -0.6], [1.4, -0.6]]],
  ']': [[[0, 6.6], [1.4, 6.6], [1.4, -0.6], [0, -0.6]]],
  '<': [[[3, 5.5], [0, 3], [3, 0.5]]],
  '>': [[[0, 5.5], [3, 3], [0, 0.5]]],
  $: [[[4, 5.2], [1, 5.2], [0, 4.4], [0, 3.8], [1, 3], [3, 3], [4, 2.2], [4, 1.6], [3, 0.8], [0, 0.8]], [[2, 6.6], [2, -0.6]]],
  '*': [[[1.6, 6], [1.6, 3]], [[0.2, 5.2], [3, 3.8]], [[0.2, 3.8], [3, 5.2]]],
  '▶': [[[0, 0.4], [0, 5.6], [3.6, 3], [0, 0.4]], [[0.8, 1.6], [0.8, 4.4], [2.4, 3], [0.8, 1.6]]],
  '◀': [[[3.6, 0.4], [3.6, 5.6], [0, 3], [3.6, 0.4]], [[2.8, 1.6], [2.8, 4.4], [1.2, 3], [2.8, 1.6]]],
  '►': [[[0, 0.4], [0, 5.6], [3.6, 3], [0, 0.4]], [[0.8, 1.6], [0.8, 4.4], [2.4, 3], [0.8, 1.6]]],
  '◄': [[[3.6, 0.4], [3.6, 5.6], [0, 3], [3.6, 0.4]], [[2.8, 1.6], [2.8, 4.4], [1.2, 3], [2.8, 1.6]]],
  '❚': [[[0, 0], [0, 6]], [[0.7, 0], [0.7, 6]], [[1.4, 0], [1.4, 6]]],
  '·': [{ d: [0.35, 3] }],
  '×': [[[0.4, 1.2], [3, 4.8]], [[0.4, 4.8], [3, 1.2]]],
  _: [[[0, -0.6], [4, -0.6]]],
  '°': [[[0.6, 6], [1.6, 6], [1.6, 5], [0.6, 5], [0.6, 6]]],
};

const WIDTH = {};
for (const [k, strokes] of Object.entries(G)) {
  let w = 0;
  for (const s of strokes) {
    if (Array.isArray(s)) for (const p of s) w = Math.max(w, p[0]);
    else w = Math.max(w, s.d[0] + 0.35);
  }
  WIDTH[k] = w;
}
WIDTH[' '] = 2.2;

const GAP = 1.45; // between glyphs, in grid units

function glyphFor(ch) {
  const up = ch.toUpperCase();
  return G[up] ? up : (up === ' ' ? ' ' : '?');
}

/** Width in px of a string at a given cap height (no skew). */
export function vWidth(str, size, spacing = 0) {
  const s = size / 6;
  let w = 0;
  for (let i = 0; i < str.length; i++) {
    const g = glyphFor(str[i]);
    w += (WIDTH[g] + (i < str.length - 1 ? GAP : 0)) * s + (i < str.length - 1 ? spacing : 0);
  }
  return w;
}

function tracePath(ctx, str, x, y, size, spacing) {
  const s = size / 6;
  let cx = x;
  const dots = [];
  ctx.beginPath();
  for (let i = 0; i < str.length; i++) {
    const g = glyphFor(str[i]);
    const strokes = G[g];
    if (strokes) {
      for (const st of strokes) {
        if (Array.isArray(st)) {
          ctx.moveTo(cx + st[0][0] * s, y - st[0][1] * s);
          for (let j = 1; j < st.length; j++) ctx.lineTo(cx + st[j][0] * s, y - st[j][1] * s);
        } else {
          dots.push([cx + st.d[0] * s, y - st.d[1] * s]);
        }
      }
    }
    cx += (WIDTH[g] + GAP) * s + spacing;
  }
  return dots;
}

/**
 * Draw stroke-font text. (x, y) is the baseline anchor.
 * opts: { align: 'left'|'center'|'right', weight (stroke as fraction of size),
 *         color | gradient [[stop,color],…], outline, outlineColor, glow, glowColor,
 *         skew (italic shear, default -0.18), spacing (px), shadow [dx,dy,color], alpha }
 */
export function vText(ctx, str, x, y, size, opts = {}) {
  str = String(str);
  const spacing = opts.spacing || 0;
  const skew = opts.skew ?? -0.18;
  const w = vWidth(str, size, spacing);
  let ox = x;
  if (opts.align === 'center') ox = x - w / 2;
  else if (opts.align === 'right') ox = x - w;
  const lw = Math.max(1, size * (opts.weight ?? 0.17));

  ctx.save();
  if (opts.alpha !== undefined) ctx.globalAlpha *= opts.alpha;
  // italic shear around the baseline
  ctx.translate(ox, y);
  ctx.transform(1, 0, skew, 1, 0, 0);
  ctx.translate(-ox, -y);
  ctx.lineJoin = 'miter';
  ctx.miterLimit = 3;
  ctx.lineCap = 'square';

  const passes = [];
  if (opts.shadow) passes.push({ dx: opts.shadow[0], dy: opts.shadow[1], color: opts.shadow[2] || 'rgba(0,0,0,0.7)', lw: lw + (opts.outline || 0) * 2 });
  if (opts.outline) passes.push({ dx: 0, dy: 0, color: opts.outlineColor || '#000', lw: lw + opts.outline * 2 });
  passes.push({ dx: 0, dy: 0, color: null, lw, main: true });

  for (const p of passes) {
    ctx.save();
    ctx.translate(p.dx, p.dy);
    const dots = tracePath(ctx, str, ox, y, size, spacing);
    ctx.lineWidth = p.lw;
    let style = p.color;
    if (p.main) {
      if (opts.gradient) {
        const gr = ctx.createLinearGradient(0, y - size, 0, y);
        for (const [stop, col] of opts.gradient) gr.addColorStop(stop, col);
        style = gr;
      } else {
        style = opts.color || '#fff';
      }
      if (opts.glow) {
        ctx.shadowColor = opts.glowColor || opts.color || '#fff';
        ctx.shadowBlur = opts.glow;
      }
    }
    ctx.strokeStyle = style;
    ctx.stroke();
    if (dots.length) {
      ctx.fillStyle = style;
      const r = p.lw * 0.62;
      for (const [dx, dy] of dots) ctx.fillRect(dx - r, dy - r, r * 2, r * 2);
    }
    ctx.restore();
  }
  ctx.restore();
  return w;
}
