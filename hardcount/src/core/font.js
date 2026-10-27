// HARD COUNT's own display face: a condensed varsity block, the lettering of
// jersey numbers, end zones and old scoreboards — square-cornered, heavy,
// upright, with hooked terminals on C, G, S and the round numerals. Drawn as
// strokes, identical on every machine. Glyphs live on a grid where the cap
// height is 6 units, baseline 0, y up. A stroke is a polyline [[x,y],…]
// ('z' at the end closes it); a dot is {d:[x,y]}.

const G = {
  A: [[[0, 0], [0.8, 6], [2.2, 6], [3, 0]], [[0.4, 2.2], [2.6, 2.2]]],
  B: [[[0, 0], [0, 6], [2.3, 6], [2.7, 5.6], [2.7, 3.5], [2.3, 3.1], [0, 3.1]], [[2.3, 3.1], [2.9, 2.6], [2.9, 0.4], [2.5, 0], [0, 0]]],
  C: [[[2.9, 4.7], [2.9, 6], [0, 6], [0, 0], [2.9, 0], [2.9, 1.3]]],
  D: [[[0, 0], [0, 6], [2.1, 6], [2.9, 5.2], [2.9, 0.8], [2.1, 0], 'z']],
  E: [[[2.9, 6], [0, 6], [0, 0], [2.9, 0]], [[0, 3.1], [2.2, 3.1]]],
  F: [[[2.9, 6], [0, 6], [0, 0]], [[0, 3.1], [2.2, 3.1]]],
  G: [[[2.9, 4.7], [2.9, 6], [0, 6], [0, 0], [2.9, 0], [2.9, 3], [1.5, 3]]],
  H: [[[0, 0], [0, 6]], [[2.9, 0], [2.9, 6]], [[0, 3.1], [2.9, 3.1]]],
  I: [[[0, 6], [1.3, 6]], [[0.65, 6], [0.65, 0]], [[0, 0], [1.3, 0]]],
  J: [[[1.4, 6], [2.9, 6], [2.9, 0], [0, 0], [0, 1.7]]],
  K: [[[0, 0], [0, 6]], [[2.9, 6], [0.8, 3.1], [0, 3.1]], [[0.8, 3.1], [3, 0]]],
  L: [[[0, 6], [0, 0], [2.8, 0]]],
  M: [[[0, 0], [0, 6], [1.9, 2.7], [3.8, 6], [3.8, 0]]],
  N: [[[0, 0], [0, 6], [2.9, 0], [2.9, 6]]],
  O: [[[0, 0], [2.9, 0], [2.9, 6], [0, 6], 'z']],
  P: [[[0, 0], [0, 6], [2.9, 6], [2.9, 2.9], [0, 2.9]]],
  Q: [[[0, 0], [2.9, 0], [2.9, 6], [0, 6], 'z'], [[1.7, 1.3], [3.1, -0.6]]],
  R: [[[0, 0], [0, 6], [2.9, 6], [2.9, 3.1], [0, 3.1]], [[1.4, 3.1], [3, 0]]],
  S: [[[2.9, 4.7], [2.9, 6], [0, 6], [0, 3.1], [2.9, 3.1], [2.9, 0], [0, 0], [0, 1.3]]],
  T: [[[0, 6], [3.2, 6]], [[1.6, 6], [1.6, 0]]],
  U: [[[0, 6], [0, 0], [2.9, 0], [2.9, 6]]],
  V: [[[0, 6], [1.5, 0], [3, 6]]],
  W: [[[0, 6], [0.9, 0], [1.9, 4.1], [2.9, 0], [3.8, 6]]],
  X: [[[0, 6], [2.9, 0]], [[0, 0], [2.9, 6]]],
  Y: [[[0, 6], [1.5, 3], [3, 6]], [[1.5, 3], [1.5, 0]]],
  Z: [[[0, 6], [2.9, 6], [0, 0], [2.9, 0]]],
  0: [[[0, 0], [2.8, 0], [2.8, 6], [0, 6], 'z']],
  1: [[[0, 4.9], [1.2, 6], [1.2, 0]], [[0, 0], [2.4, 0]]],
  2: [[[0, 4.7], [0, 6], [2.8, 6], [2.8, 3.1], [0, 3.1], [0, 0], [2.8, 0]]],
  3: [[[0, 4.7], [0, 6], [2.8, 6], [2.8, 0], [0, 0], [0, 1.3]], [[0.8, 3.1], [2.8, 3.1]]],
  4: [[[0, 6], [0, 2.4], [3, 2.4]], [[2.2, 4.3], [2.2, 0]]],
  5: [[[2.8, 6], [0, 6], [0, 3.2], [2.8, 3.2], [2.8, 0], [0, 0], [0, 1.3]]],
  6: [[[2.8, 4.7], [2.8, 6], [0, 6], [0, 0], [2.8, 0], [2.8, 3.1], [0, 3.1]]],
  7: [[[0, 4.7], [0, 6], [2.8, 6], [2.8, 4.8], [1.1, 0]]],
  8: [[[0, 0], [2.8, 0], [2.8, 6], [0, 6], 'z'], [[0, 3.1], [2.8, 3.1]]],
  9: [[[0, 1.3], [0, 0], [2.8, 0], [2.8, 6], [0, 6], [0, 2.9], [2.8, 2.9]]],
  '.': [{ d: [0.4, 0.4] }],
  ',': [[[0.6, 0.7], [0.6, 0], [0, -1]]],
  ':': [{ d: [0.4, 0.6] }, { d: [0.4, 4.1] }],
  ';': [{ d: [0.6, 4.1] }, [[0.6, 0.7], [0.6, 0], [0, -1]]],
  '-': [[[0, 3], [2.2, 3]]],
  '+': [[[0, 3], [2.8, 3]], [[1.4, 1.6], [1.4, 4.4]]],
  '=': [[[0, 2], [2.8, 2]], [[0, 4], [2.8, 4]]],
  '/': [[[0, -0.3], [2.6, 6.3]]],
  '\\': [[[0, 6.3], [2.6, -0.3]]],
  '!': [[[0.4, 6], [0.4, 2.1]], { d: [0.4, 0.4] }],
  '?': [[[0, 4.7], [0, 6], [2.8, 6], [2.8, 3.2], [1.4, 3.2], [1.4, 2]], { d: [1.4, 0.4] }],
  "'": [[[0.4, 6], [0.4, 4.3]]],
  '"': [[[0.4, 6], [0.4, 4.3]], [[1.7, 6], [1.7, 4.3]]],
  '%': [[[0, 0], [3, 6]], { d: [0.4, 5.4] }, { d: [2.6, 0.6] }],
  '#': [[[0.9, 0], [1.2, 6]], [[2.1, 0], [2.4, 6]], [[0, 2], [3.2, 2]], [[0, 4], [3.2, 4]]],
  '&': [[[3.3, 0], [0.8, 3.7], [0.8, 6], [2.5, 6], [2.5, 4.3], [0, 2.3], [0, 0], [2.3, 0], [3.3, 1.5]]],
  '(': [[[1.4, 6.6], [0.3, 5.4], [0.3, 0.6], [1.4, -0.6]]],
  ')': [[[0, 6.6], [1.1, 5.4], [1.1, 0.6], [0, -0.6]]],
  '[': [[[1.3, 6.6], [0, 6.6], [0, -0.6], [1.3, -0.6]]],
  ']': [[[0, 6.6], [1.3, 6.6], [1.3, -0.6], [0, -0.6]]],
  '<': [[[2.6, 5.4], [0, 3], [2.6, 0.6]]],
  '>': [[[0, 5.4], [2.6, 3], [0, 0.6]]],
  $: [[[2.8, 4.6], [2.8, 5.3], [0, 5.3], [0, 3.1], [2.8, 3.1], [2.8, 0.7], [0, 0.7], [0, 1.4]], [[1.4, 6.5], [1.4, -0.5]]],
  '*': [[[1.4, 6], [1.4, 3.2]], [[0.1, 5.3], [2.7, 3.9]], [[0.1, 3.9], [2.7, 5.3]]],
  '▶': [[[0, 0.4], [0, 5.6], [3.4, 3], 'z'], [[0.8, 1.7], [0.8, 4.3], [2.2, 3], 'z']],
  '◀': [[[3.4, 0.4], [3.4, 5.6], [0, 3], 'z'], [[2.6, 1.7], [2.6, 4.3], [1.2, 3], 'z']],
  '►': [[[0, 0.4], [0, 5.6], [3.4, 3], 'z'], [[0.8, 1.7], [0.8, 4.3], [2.2, 3], 'z']],
  '◄': [[[3.4, 0.4], [3.4, 5.6], [0, 3], 'z'], [[2.6, 1.7], [2.6, 4.3], [1.2, 3], 'z']],
  '❚': [[[0, 0], [0, 6]], [[0.8, 0], [0.8, 6]], [[1.6, 0], [1.6, 6]]],
  '·': [{ d: [0.4, 3] }],
  '→': [[[0, 3], [3.4, 3]], [[2, 4.5], [3.4, 3], [2, 1.5]]],
  '←': [[[0, 3], [3.4, 3]], [[1.4, 4.5], [0, 3], [1.4, 1.5]]],
  '★': [[[2, 6], [2.6, 3.9], [4.4, 3.9], [3, 2.6], [3.6, 0.4], [2, 1.7], [0.4, 0.4], [1, 2.6], [-0.4, 3.9], [1.4, 3.9], 'z']],
  '✓': [[[0, 3], [1.3, 1], [3.6, 5.6]]],
  '×': [[[0.3, 1.3], [2.7, 4.7]], [[0.3, 4.7], [2.7, 1.3]]],
  _: [[[0, -0.6], [3, -0.6]]],
  '°': [[[0.5, 6], [1.6, 6], [1.6, 4.9], [0.5, 4.9], 'z']],
};

const WIDTH = {};
for (const [k, strokes] of Object.entries(G)) {
  let w = 0;
  for (const s of strokes) {
    if (Array.isArray(s)) { for (const p of s) if (Array.isArray(p)) w = Math.max(w, p[0]); } else w = Math.max(w, s.d[0] + 0.4);
  }
  WIDTH[k] = w;
}
WIDTH[' '] = 2.0;

const GAP = 1.7; // between glyphs, in grid units (the strokes are heavy: leave the counters room)

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
          for (let j = 1; j < st.length; j++) {
            if (st[j] === 'z') ctx.closePath();
            else ctx.lineTo(cx + st[j][0] * s, y - st[j][1] * s);
          }
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
 * Draw display text. (x, y) is the baseline anchor.
 * opts: { align: 'left'|'center'|'right', weight (stroke as fraction of size),
 *         color | gradient [[stop,color],…], outline, outlineColor, glow, glowColor,
 *         skew (italic shear, default 0: the block stands up), spacing (px),
 *         shadow [dx,dy,color], alpha }
 */
export function vText(ctx, str, x, y, size, opts = {}) {
  str = String(str);
  const spacing = opts.spacing || 0;
  const skew = opts.skew ?? 0;
  const w = vWidth(str, size, spacing);
  let ox = x;
  if (opts.align === 'center') ox = x - w / 2;
  else if (opts.align === 'right') ox = x - w;
  // block letters run heavy: the weight callers ask for, plus a little
  const lw = Math.max(1, size * (opts.weight ?? 0.17) * 1.12);

  ctx.save();
  if (opts.alpha !== undefined) ctx.globalAlpha *= opts.alpha;
  if (skew) {
    ctx.translate(ox, y);
    ctx.transform(1, 0, skew, 1, 0, 0);
    ctx.translate(-ox, -y);
  }
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
      const r = p.lw * 0.6;
      for (const [dx, dy] of dots) ctx.fillRect(dx - r, dy - r, r * 2, r * 2);
    }
    ctx.restore();
  }
  ctx.restore();
  return w;
}
