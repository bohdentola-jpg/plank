// Jersey number fonts, drawn as thick strokes on a 5 × 8 grid so they look
// the same on every machine. Five styles from the kit schema:
//   block   — square varsity block, sharp corners
//   pro     — condensed pro block with rounded corners and curved bowls
//   college — collegiate slab: chamfered corners, slab serifs
//   italic  — slanted pro block
//   stencil — block with stencil bridges cut through the strokes
// drawNumber(ctx, str, cx, cy, h, { style, fill, outline, outline2, mirror })

// centre-line paths (x 0..5, y 0..8, y up); 'M' starts a new sub-path
const BLOCK = {
  0: [[[0.85, 0.85], [4.15, 0.85], [4.15, 7.15], [0.85, 7.15], [0.85, 0.85]]],
  1: [[[2.75, 0.85], [2.75, 7.15], [1.3, 6.0]], [[1.35, 0.85], [4.1, 0.85]]],
  2: [[[0.85, 7.15], [4.15, 7.15], [4.15, 4.1], [0.85, 4.1], [0.85, 0.85], [4.25, 0.85]]],
  3: [[[0.75, 7.15], [4.15, 7.15], [4.15, 0.85], [0.75, 0.85]], [[1.6, 4.05], [4.15, 4.05]]],
  4: [[[0.85, 7.15], [0.85, 3.5], [4.4, 3.5]], [[3.45, 7.15], [3.45, 0.85]]],
  5: [[[4.15, 7.15], [0.85, 7.15], [0.85, 4.2], [4.15, 4.2], [4.15, 0.85], [0.75, 0.85]]],
  6: [[[4.15, 7.15], [0.85, 7.15], [0.85, 0.85], [4.15, 0.85], [4.15, 4.2], [0.85, 4.2]]],
  7: [[[0.75, 7.15], [4.15, 7.15], [4.15, 5.8], [2.3, 0.85]]],
  8: [[[0.85, 0.85], [4.15, 0.85], [4.15, 7.15], [0.85, 7.15], [0.85, 0.85]], [[0.85, 4.1], [4.15, 4.1]]],
  9: [[[4.15, 3.8], [0.85, 3.8], [0.85, 7.15], [4.15, 7.15], [4.15, 0.85], [0.85, 0.85]]],
};

// rounded versions: corners replaced by quarter curves (pro / italic)
function roundPath(path, r) {
  // insert quadratic-ish corner points: returns [{x,y,c}] with c = control flag
  const out = [];
  const closed = path.length > 2 && path[0][0] === path[path.length - 1][0] && path[0][1] === path[path.length - 1][1];
  for (let i = 0; i < path.length; i++) {
    const p = path[i];
    const isEnd = !closed && (i === 0 || i === path.length - 1);
    if (isEnd) { out.push({ x: p[0], y: p[1] }); continue; }
    const a = path[i === 0 ? path.length - 2 : i - 1], b = path[i === path.length - 1 ? 1 : i + 1];
    const da = Math.hypot(a[0] - p[0], a[1] - p[1]), db = Math.hypot(b[0] - p[0], b[1] - p[1]);
    const ra = Math.min(r, da * 0.45), rb = Math.min(r, db * 0.45);
    out.push({ x: p[0] + ((a[0] - p[0]) / da) * ra, y: p[1] + ((a[1] - p[1]) / da) * ra });
    out.push({ x: p[0], y: p[1], ctrl: true });
    out.push({ x: p[0] + ((b[0] - p[0]) / db) * rb, y: p[1] + ((b[1] - p[1]) / db) * rb });
  }
  return { pts: out, closed };
}

const STYLE = {
  block: { w: 1.52, join: 'miter', cap: 'butt', round: 0, skew: 0, cond: 1.0, serif: false },
  pro: { w: 1.42, join: 'round', cap: 'butt', round: 1.05, skew: 0, cond: 0.9, serif: false },
  college: { w: 1.6, join: 'bevel', cap: 'butt', round: 0, skew: 0, cond: 1.04, serif: true },
  italic: { w: 1.44, join: 'round', cap: 'butt', round: 0.8, skew: -0.24, cond: 0.94, serif: false },
  stencil: { w: 1.56, join: 'miter', cap: 'butt', round: 0, skew: 0, cond: 1.0, serif: false, stencil: true },
};

function tracePaths(ctx, ch, st, ox, oy, sx, sy) {
  const paths = BLOCK[ch];
  if (!paths) return;
  const X = (x) => ox + x * sx, Y = (y) => oy - y * sy;
  ctx.beginPath();
  for (const path of paths) {
    if (st.round > 0 && path.length > 2) {
      const { pts } = roundPath(path, st.round);
      ctx.moveTo(X(pts[0].x), Y(pts[0].y));
      for (let i = 1; i < pts.length; i++) {
        const p = pts[i];
        if (p.ctrl && i + 1 < pts.length) {
          const q = pts[i + 1];
          ctx.quadraticCurveTo(X(p.x), Y(p.y), X(q.x), Y(q.y));
          i++;
        } else ctx.lineTo(X(p.x), Y(p.y));
      }
    } else {
      ctx.moveTo(X(path[0][0]), Y(path[0][1]));
      for (let i = 1; i < path.length; i++) ctx.lineTo(X(path[i][0]), Y(path[i][1]));
    }
  }
}

function serifs(ctx, ch, ox, oy, sx, sy, w) {
  // small slab serifs on the collegiate 1, 4, 7
  const X = (x) => ox + x * sx, Y = (y) => oy - y * sy;
  ctx.beginPath();
  if (ch === '4') { ctx.moveTo(X(2.5), Y(0.85)); ctx.lineTo(X(4.4), Y(0.85)); }
  if (ch === '7') { ctx.moveTo(X(1.4), Y(0.85)); ctx.lineTo(X(3.4), Y(0.85)); }
  ctx.lineWidth = w * 0.85;
  ctx.stroke();
}

const scratch = typeof document !== 'undefined' ? document.createElement('canvas') : null;

/**
 * Draw a number centred at (cx, cy) with cap height h.
 * opts: { style, fill, outline (colour|null), outline2 (second ring colour|null), ow (outline width
 * as a fraction of h), mirror: draw mirrored (for mirrored UV mappings) }
 */
export function drawNumber(ctx, str, cx, cy, h, opts = {}) {
  str = String(str);
  const st = STYLE[opts.style] || STYLE.block;
  const sy = h / 8, sx = sy * st.cond;
  const gap = 0.68 * sx;
  const cw = 5 * sx;
  const totalW = str.length * cw + (str.length - 1) * gap;
  const ow = (opts.ow ?? 0.07) * h;
  const lw = st.w * sy;
  // draw into a scratch canvas so stencil cuts don't punch through the jersey
  const pad = Math.ceil(ow * 2 + lw + h * 0.3);
  const W = Math.ceil(totalW + pad * 2), H = Math.ceil(h + pad * 2);
  const c = scratch;
  c.width = W; c.height = H;
  const x = c.getContext('2d');
  x.clearRect(0, 0, W, H);
  x.save();
  // italic shear around the baseline centre
  if (st.skew) { x.translate(W / 2, H / 2); x.transform(1, 0, st.skew, 1, 0, 0); x.translate(-W / 2, -H / 2); }
  x.lineJoin = st.join;
  x.lineCap = st.cap;
  x.miterLimit = 4;
  const ox0 = (W - totalW) / 2, oy = H / 2 + h / 2;
  const passes = [];
  if (opts.outline2) passes.push([opts.outline2, lw + ow * 4]);
  if (opts.outline) passes.push([opts.outline, lw + ow * 2]);
  passes.push([opts.fill || '#fff', lw]);
  for (const [col, w] of passes) {
    x.strokeStyle = col;
    x.lineWidth = w;
    for (let i = 0; i < str.length; i++) {
      const ox = ox0 + i * (cw + gap);
      tracePaths(x, str[i], st, ox, oy, sx, sy);
      x.stroke();
      if (st.serif) serifs(x, str[i], ox, oy, sx, sy, w);
    }
  }
  x.restore();
  if (st.stencil) {
    // bridges: a horizontal cut through the uprights and a vertical cut through the bars
    x.save();
    x.globalCompositeOperation = 'destination-out';
    x.fillStyle = '#000';
    const bw = Math.max(1, h * 0.045);
    for (let i = 0; i < str.length; i++) {
      const ox = ox0 + i * (cw + gap);
      x.fillRect(ox + 2.5 * sx - bw / 2, oy - 8 * sy - ow * 3, bw, h * 0.2);
      x.fillRect(ox + 2.5 * sx - bw / 2, oy - h * 0.2 + ow * 3, bw, h * 0.2);
      x.fillRect(ox - ow * 3, oy - 5.7 * sy, sx * 1.9, bw);
      x.fillRect(ox + 3.2 * sx, oy - 2.6 * sy, sx * 2, bw);
    }
    x.restore();
  }
  ctx.save();
  if (opts.mirror) {
    ctx.translate(cx, cy);
    ctx.scale(-1, 1);
    ctx.drawImage(c, -W / 2, -H / 2);
  } else {
    ctx.drawImage(c, cx - W / 2, cy - H / 2);
  }
  ctx.restore();
}

export function numberWidth(str, h, style) {
  const st = STYLE[style] || STYLE.block;
  const sy = h / 8, sx = sy * st.cond;
  return String(str).length * 5 * sx + (String(str).length - 1) * 0.68 * sx;
}
