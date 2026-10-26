// Team logos, drawn in code onto a 2D canvas. One function draws any team's
// emblem at any size, so the same art lands on helmets, the midfield paint,
// end zones, the scoreboard, menus and the score bug.
//
//   drawLogo(ctx, team, cx, cy, size, opts)   size = the logo's height in px
//     opts.mono: '#hex'  one-colour version (field paint): outlines and dark
//                        details become see-through cuts
//     opts.flat: true    no glossy highlight (paint, decals)
//   logoCanvas(team, px, opts)  → cached square canvas with the logo centred
//   logoTexture(team, px, opts) → cached THREE.CanvasTexture of logoCanvas
//   drawWordmark(ctx, team, cx, cy, height, opts) → the team name lettered in
//     the team's style (end zones, menus). opts.text, opts.style, opts.mono,
//     opts.flat, opts.maxWidth, opts.city (small city line above)
//   drawBlockText(ctx, str, x, y, h, opts) → athletic lettering (jersey
//     numbers, wordmarks) in 'block' | 'pro' | 'college' | 'italic' | 'stencil'
//   drawEmblem(ctx, emblemId, palette, cx, cy, size, opts) → any emblem with
//     an explicit palette (QA sheets, custom schools)
//
// team.logo = { emblem, fg, bg, ring, fg2?, acc?, line?, letter?, letterFont? }
// Every emblem is drawn in a 200 × 200 design box (−100..100, y down) from
// role colours — fg (main), fg2 (second), acc (accent), line (outline), bg
// (plates), ring (trim), shade/light (derived) — so one drawing serves every
// palette, the mono stencil and the tiny score-bug size alike.
import * as THREE from 'three';

const TAU = Math.PI * 2;
const CUT = '#cut';

// ------------------------------------------------------------------ colour helpers

function rgbOf(hex) {
  const h = String(hex).replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function hexOf(r, g, b) {
  const c = (v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0');
  return '#' + c(r) + c(g) + c(b);
}
export function mixHex(a, b, t) {
  const A = rgbOf(a), B = rgbOf(b);
  return hexOf(A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t);
}
const lighten = (hex, t) => mixHex(hex, '#ffffff', t);
const darken = (hex, t) => mixHex(hex, '#000000', t);
function luma(hex) {
  const [r, g, b] = rgbOf(hex);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}
const isHex = (c) => typeof c === 'string' && /^#[0-9a-f]{3,8}$/i.test(c);

// ------------------------------------------------------------------ path helpers

const pathCache = new Map();
function P2(d) {
  if (typeof d !== 'string') return d;
  let p = pathCache.get(d);
  if (!p) {
    p = new Path2D(d);
    if (pathCache.size > 4000) pathCache.clear();
    pathCache.set(d, p);
  }
  return p;
}
const fm = (n) => (Math.round(n * 100) / 100).toString();
/** Polygon path from [[x, y], …]. */
export function poly(pts, close = true) {
  let d = '';
  for (let i = 0; i < pts.length; i++) d += (i ? 'L' : 'M') + fm(pts[i][0]) + ' ' + fm(pts[i][1]) + ' ';
  return d + (close ? 'Z' : '');
}
/** Smooth closed path through points (Catmull-Rom → cubic Bézier). */
function smooth(pts, close = true, tension = 0.5) {
  const n = pts.length;
  const at = (i) => (close ? pts[(i + n) % n] : pts[Math.max(0, Math.min(n - 1, i))]);
  let d = `M${fm(pts[0][0])} ${fm(pts[0][1])} `;
  const last = close ? n : n - 1;
  for (let i = 0; i < last; i++) {
    const p0 = at(i - 1), p1 = at(i), p2 = at(i + 1), p3 = at(i + 2);
    const k = tension / 3;
    const c1 = [p1[0] + (p2[0] - p0[0]) * k, p1[1] + (p2[1] - p0[1]) * k];
    const c2 = [p2[0] - (p3[0] - p1[0]) * k, p2[1] - (p3[1] - p1[1]) * k];
    d += `C${fm(c1[0])} ${fm(c1[1])} ${fm(c2[0])} ${fm(c2[1])} ${fm(p2[0])} ${fm(p2[1])} `;
  }
  return d + (close ? 'Z' : '');
}
function circ(cx, cy, r) {
  return `M${fm(cx + r)} ${fm(cy)} A${fm(r)} ${fm(r)} 0 1 0 ${fm(cx - r)} ${fm(cy)} A${fm(r)} ${fm(r)} 0 1 0 ${fm(cx + r)} ${fm(cy)} Z`;
}
function ell(cx, cy, rx, ry, rot = 0) {
  const pts = [];
  for (let i = 0; i < 28; i++) {
    const a = (i / 28) * TAU;
    const x = Math.cos(a) * rx, y = Math.sin(a) * ry;
    pts.push([cx + x * Math.cos(rot) - y * Math.sin(rot), cy + x * Math.sin(rot) + y * Math.cos(rot)]);
  }
  return smooth(pts, true, 0.5);
}
function ringPath(cx, cy, r1, r2) {
  return circ(cx, cy, r1) + ' ' + `M${fm(cx + r2)} ${fm(cy)} A${fm(r2)} ${fm(r2)} 0 1 1 ${fm(cx - r2)} ${fm(cy)} A${fm(r2)} ${fm(r2)} 0 1 1 ${fm(cx + r2)} ${fm(cy)} Z`;
}
function rect(x, y, w, h) { return poly([[x, y], [x + w, y], [x + w, y + h], [x, y + h]]); }
function rrect(x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  return `M${fm(x + r)} ${fm(y)} L${fm(x + w - r)} ${fm(y)} Q${fm(x + w)} ${fm(y)} ${fm(x + w)} ${fm(y + r)} L${fm(x + w)} ${fm(y + h - r)} Q${fm(x + w)} ${fm(y + h)} ${fm(x + w - r)} ${fm(y + h)} L${fm(x + r)} ${fm(y + h)} Q${fm(x)} ${fm(y + h)} ${fm(x)} ${fm(y + h - r)} L${fm(x)} ${fm(y + r)} Q${fm(x)} ${fm(y)} ${fm(x + r)} ${fm(y)} Z`;
}
const pol = (r, a, cx = 0, cy = 0) => [cx + Math.cos(a) * r, cy + Math.sin(a) * r];
function starPts(cx, cy, R, r, n = 5, rot = -Math.PI / 2) {
  const pts = [];
  for (let i = 0; i < n * 2; i++) pts.push(pol(i % 2 ? r : R, rot + (i * Math.PI) / n, cx, cy));
  return pts;
}
/** Mirror a right-half point list (top centre → bottom centre) into a full outline. */
function mirrorPts(half) {
  const back = half.slice(1, -1).reverse().map(([x, y]) => [-x, y]);
  return [...half, ...back];
}
/**
 * Mirror a right-half path given as commands, starting on the axis at the top
 * and ending on the axis at the bottom: [['M',x,y], ['L',x,y], ['C',x1,y1,x2,y2,x,y], ['Q',x1,y1,x,y]].
 */
function sym(cmds) {
  let d = '';
  const segs = [];
  let cur = null;
  for (const c of cmds) {
    const [op, ...a] = c;
    if (op === 'M') { d += `M${fm(a[0])} ${fm(a[1])} `; cur = [a[0], a[1]]; continue; }
    d += op + a.map(fm).join(' ') + ' ';
    segs.push({ op, a, from: cur });
    cur = [a[a.length - 2], a[a.length - 1]];
  }
  for (let i = segs.length - 1; i >= 0; i--) {
    const { op, a, from } = segs[i];
    const to = [-from[0], from[1]];
    if (op === 'L') d += `L${fm(to[0])} ${fm(to[1])} `;
    else if (op === 'Q') d += `Q${fm(-a[0])} ${fm(a[1])} ${fm(to[0])} ${fm(to[1])} `;
    else if (op === 'C') d += `C${fm(-a[2])} ${fm(a[3])} ${fm(-a[0])} ${fm(a[1])} ${fm(to[0])} ${fm(to[1])} `;
  }
  return d + 'Z';
}
/** Transform every coordinate pair of an absolute M/L/C/Q/Z path. */
function tpath(d, f) {
  return d.replace(/(-?\d*\.?\d+)[ ,]+(-?\d*\.?\d+)/g, (m, x, y) => {
    const [X, Y] = f(parseFloat(x), parseFloat(y));
    return fm(X) + ' ' + fm(Y);
  });
}
const scaleAbout = (d, s, ox, oy, sy = s) => tpath(d, (x, y) => [ox + (x - ox) * s, oy + (y - oy) * sy]);
const mirrorX = (d) => tpath(d, (x, y) => [-x, y]);
const moveBy = (d, dx, dy) => tpath(d, (x, y) => [x + dx, y + dy]);
/** A band following a polyline: left edge forward, right edge back (widths per point). */
function bandPts(center, widths) {
  const L = [], R = [];
  for (let i = 0; i < center.length; i++) {
    const p = center[i], q = center[Math.min(center.length - 1, i + 1)], o = center[Math.max(0, i - 1)];
    let tx = q[0] - o[0], ty = q[1] - o[1];
    const len = Math.hypot(tx, ty) || 1;
    tx /= len; ty /= len;
    const w = (typeof widths === 'function' ? widths(i / (center.length - 1)) : widths) / 2;
    L.push([p[0] - ty * w, p[1] + tx * w]);
    R.push([p[0] + ty * w, p[1] - tx * w]);
  }
  return [...L, ...R.reverse()];
}
/** Sample a cubic Bézier chain [[p0, c1, c2, p1], …] into points. */
function bezPts(segs, n = 12) {
  const out = [];
  segs.forEach(([p0, c1, c2, p1], si) => {
    for (let i = si ? 1 : 0; i <= n; i++) {
      const t = i / n, u = 1 - t;
      out.push([
        u * u * u * p0[0] + 3 * u * u * t * c1[0] + 3 * u * t * t * c2[0] + t * t * t * p1[0],
        u * u * u * p0[1] + 3 * u * u * t * c1[1] + 3 * u * t * t * c2[1] + t * t * t * p1[1],
      ]);
    }
  });
  return out;
}

// ------------------------------------------------------------------ athletic lettering

// Centre-line glyphs on a 4-wide × 6-tall grid (y up), stroked heavy. The
// same skeleton makes block, pro (rounded, condensed), college (slab serifs),
// italic and stencil lettering.
const GL = {
  A: [[[0, 0], [0, 4.3], [1.7, 6], [2.3, 6], [4, 4.3], [4, 0]], [[0, 2.5], [4, 2.5]]],
  B: [[[0, 3.1], [3, 3.1], [4, 2.2], [4, 0.9], [3.1, 0], [0, 0], [0, 6], [2.9, 6], [3.8, 5.1], [3.8, 4], [2.9, 3.1]]],
  C: [[[4, 6], [0.9, 6], [0, 5.1], [0, 0.9], [0.9, 0], [4, 0]]],
  D: [[[0, 0], [0, 6], [2.8, 6], [4, 4.8], [4, 1.2], [2.8, 0], [0, 0]]],
  E: [[[4, 6], [0, 6], [0, 0], [4, 0]], [[0, 3.1], [3, 3.1]]],
  F: [[[4, 6], [0, 6], [0, 0]], [[0, 3.1], [3, 3.1]]],
  G: [[[4, 6], [0.9, 6], [0, 5.1], [0, 0.9], [0.9, 0], [4, 0], [4, 3], [2.2, 3]]],
  H: [[[0, 0], [0, 6]], [[4, 0], [4, 6]], [[0, 3.1], [4, 3.1]]],
  I: [[[0, 0], [0, 6]]],
  J: [[[4, 6], [4, 0.9], [3.1, 0], [0.9, 0], [0, 0.9], [0, 1.8]]],
  K: [[[0, 0], [0, 6]], [[4, 6], [1.3, 3.1], [0, 3.1]], [[1.3, 3.1], [4, 0]]],
  L: [[[0, 6], [0, 0], [4, 0]]],
  M: [[[0, 0], [0, 6], [2.5, 2.6], [5, 6], [5, 0]]],
  N: [[[0, 0], [0, 6], [4, 0], [4, 6]]],
  O: [[[0.9, 0], [0, 0.9], [0, 5.1], [0.9, 6], [3.1, 6], [4, 5.1], [4, 0.9], [3.1, 0], [0.9, 0]]],
  P: [[[0, 0], [0, 6], [3, 6], [4, 5], [4, 3.9], [3, 2.9], [0, 2.9]]],
  Q: [[[0.9, 0], [0, 0.9], [0, 5.1], [0.9, 6], [3.1, 6], [4, 5.1], [4, 0.9], [3.1, 0], [0.9, 0]], [[2.5, 1.3], [4.2, -0.5]]],
  R: [[[0, 0], [0, 6], [3, 6], [4, 5], [4, 4], [3, 3], [0, 3]], [[2.4, 3], [4, 0]]],
  S: [[[4, 6], [0.9, 6], [0, 5.1], [0, 3.9], [0.9, 3], [3.1, 3], [4, 2.1], [4, 0.9], [3.1, 0], [0, 0]]],
  T: [[[0, 6], [4.4, 6]], [[2.2, 6], [2.2, 0]]],
  U: [[[0, 6], [0, 0.9], [0.9, 0], [3.1, 0], [4, 0.9], [4, 6]]],
  V: [[[0, 6], [2.1, 0], [4.2, 6]]],
  W: [[[0, 6], [1.2, 0], [2.6, 4.2], [4, 0], [5.2, 6]]],
  X: [[[0, 6], [4, 0]], [[0, 0], [4, 6]]],
  Y: [[[0, 6], [2.1, 3], [4.2, 6]], [[2.1, 3], [2.1, 0]]],
  Z: [[[0, 6], [4, 6], [0, 0], [4, 0]]],
  0: [[[0.9, 0], [0, 0.9], [0, 5.1], [0.9, 6], [2.7, 6], [3.6, 5.1], [3.6, 0.9], [2.7, 0], [0.9, 0]]],
  1: [[[0, 4.9], [1.2, 6], [1.2, 0]]],
  2: [[[0, 5.1], [0.9, 6], [2.7, 6], [3.6, 5.1], [3.6, 3.9], [2.7, 3], [0.9, 3], [0, 2.1], [0, 0], [3.6, 0]]],
  3: [[[0, 6], [2.7, 6], [3.6, 5.1], [3.6, 3.9], [2.7, 3], [1, 3]], [[2.7, 3], [3.6, 2.1], [3.6, 0.9], [2.7, 0], [0, 0]]],
  4: [[[0, 6], [0, 2.4], [3.6, 2.4]], [[2.7, 6], [2.7, 0]]],
  5: [[[3.6, 6], [0, 6], [0, 3.2], [2.7, 3.2], [3.6, 2.3], [3.6, 0.9], [2.7, 0], [0, 0]]],
  6: [[[3.5, 6], [0.9, 6], [0, 5.1], [0, 0.9], [0.9, 0], [2.7, 0], [3.6, 0.9], [3.6, 2.2], [2.7, 3.1], [0, 3.1]]],
  7: [[[0, 6], [3.6, 6], [3.6, 5], [1.3, 0]]],
  8: [[[0.9, 3.1], [0, 4], [0, 5.1], [0.9, 6], [2.7, 6], [3.6, 5.1], [3.6, 4], [2.7, 3.1], [0.9, 3.1], [0, 2.2], [0, 0.9], [0.9, 0], [2.7, 0], [3.6, 0.9], [3.6, 2.2], [2.7, 3.1]]],
  9: [[[0.1, 0], [2.7, 0], [3.6, 0.9], [3.6, 5.1], [2.7, 6], [0.9, 6], [0, 5.1], [0, 3.8], [0.9, 2.9], [3.6, 2.9]]],
  '&': [[[4.2, 0], [1, 3.9], [1, 5.2], [1.8, 6], [2.6, 6], [3.3, 5.2], [3.3, 4.5], [0, 2.3], [0, 0.8], [0.8, 0], [2.4, 0], [4, 1.8]]],
  '-': [[[0, 3], [2.4, 3]]],
  "'": [[[0, 6], [0, 4.4]]],
  '.': [[[0, 0], [0, 0.01]]],
  '!': [[[0, 6], [0, 2.2]], [[0, 0], [0, 0.01]]],
  '#': [[[1.1, 0], [1.5, 6]], [[2.7, 0], [3.1, 6]], [[0, 2], [4.2, 2]], [[0, 4], [4.2, 4]]],
};
const GLW = {};
for (const [k, strokes] of Object.entries(GL)) {
  let mx = 0;
  for (const s of strokes) for (const p of s) mx = Math.max(mx, p[0]);
  GLW[k] = mx;
}

const FONT_STYLES = {
  block: { weight: 0.205, skew: 0, join: 'miter', condense: 1, track: 1.05 },
  pro: { weight: 0.2, skew: 0, join: 'round', condense: 0.84, track: 0.95 },
  college: { weight: 0.18, skew: 0, join: 'miter', condense: 1.04, track: 1.25, serif: true },
  italic: { weight: 0.195, skew: -0.21, join: 'miter', condense: 0.96, track: 1.0 },
  stencil: { weight: 0.215, skew: 0, join: 'miter', condense: 1.02, track: 1.1, stencil: true },
};
export const NUMBER_FONTS = Object.keys(FONT_STYLES);
// letters whose horizontal arms get a beak serif in the college face
const SERIF_ARMS = new Set(['E', 'F', 'L', 'T', 'Z', '7', '2', '5']);

function glyphKey(ch) {
  const u = ch.toUpperCase();
  return GL[u] ? u : ' ';
}

function textLayout(str, h, st, spacing) {
  const w = st.weight * h;
  const s = (h - w) / 6;
  const sx = s * st.condense;
  const gap = st.track * s + spacing;
  let x = 0;
  const items = [];
  for (const ch of String(str)) {
    const k = glyphKey(ch);
    if (k === ' ') { x += 2.4 * sx + gap; continue; }
    items.push({ k, x });
    x += GLW[k] * sx + w + gap;
  }
  return { w, s, sx, width: Math.max(0, x - gap), items };
}

function setFill(ctx, color) {
  if (color === CUT) { ctx.globalCompositeOperation = 'destination-out'; ctx.fillStyle = ctx.strokeStyle = '#000'; }
  else { ctx.globalCompositeOperation = 'source-over'; ctx.fillStyle = ctx.strokeStyle = color; }
}

function strokeGlyphs(ctx, L, st, extra, color) {
  const { w, s, sx } = L;
  const lw = w + extra * 2;
  setFill(ctx, color);
  ctx.lineWidth = lw;
  ctx.lineJoin = st.join;
  ctx.miterLimit = 2.2;
  ctx.lineCap = st.join === 'round' ? 'round' : 'square';
  ctx.beginPath();
  for (const it of L.items) {
    const ox = it.x + w / 2;
    for (const line of GL[it.k]) {
      const n = line.length;
      const closed = n > 3 && line[0][0] === line[n - 1][0] && line[0][1] === line[n - 1][1];
      for (let i = 0; i < (closed ? n - 1 : n); i++) {
        const X = ox + line[i][0] * sx, Y = -(w / 2 + line[i][1] * s);
        if (i) ctx.lineTo(X, Y); else ctx.moveTo(X, Y);
      }
      if (closed) ctx.closePath();
    }
  }
  ctx.stroke();
  if (st.serif) {
    // slab serifs where a stroke ends on a vertical or a horizontal
    ctx.beginPath();
    for (const it of L.items) {
      const ox = it.x + w / 2;
      for (const line of GL[it.k]) {
        if (line.length < 2) continue;
        for (const end of [0, line.length - 1]) {
          const p = line[end], q = line[end === 0 ? 1 : end - 1];
          const dx = q[0] - p[0], dy = q[1] - p[1];
          const X = ox + p[0] * sx, Y = -(w / 2 + p[1] * s);
          if (Math.abs(dx) < 0.2 * Math.abs(dy)) {
            const half = w * 0.95 + extra;
            const th = w * 0.55 + extra;
            if (dy > 0) ctx.rect(X - half, Y + w / 2 + extra - th, half * 2, th); // bottom of a stem
            else ctx.rect(X - half, Y - w / 2 - extra, half * 2, th); // top of a stem
          } else if (Math.abs(dy) < 0.2 * Math.abs(dx) && SERIF_ARMS.has(it.k)) {
            const th = w * 0.5 + extra;
            const len = w * 0.95 + extra;
            const xx = dx < 0 ? X + w / 2 + extra - th : X - w / 2 - extra;
            if (p[1] > 5) ctx.rect(xx, Y - w / 2 - extra, th, len + w / 2);
            else if (p[1] < 1) ctx.rect(xx, Y + w / 2 + extra - len - w / 2, th, len + w / 2);
            else ctx.rect(xx, Y - len * 0.75, th, len * 1.5);
          }
        }
      }
    }
    ctx.fill();
  }
}

function stencilGaps(ctx, L, st, h, color, extra) {
  const { w, s, sx } = L;
  setFill(ctx, color);
  ctx.lineCap = 'butt';
  ctx.lineWidth = Math.max(1, h * 0.055);
  ctx.beginPath();
  for (const it of L.items) {
    const ox = it.x + w / 2;
    const cands = [];
    for (const line of GL[it.k]) {
      for (let i = 1; i < line.length; i++) {
        const a = line[i - 1], b = line[i];
        const dx = b[0] - a[0], dy = b[1] - a[1];
        const len = Math.hypot(dx, dy);
        const horiz = Math.abs(dy) < 0.01 && len >= 1.6;
        const vert = Math.abs(dx) < 0.01 && len >= 4.4;
        if (horiz || vert) cands.push({ a, b, len, ext: Math.abs((a[1] + b[1]) / 2 - 3), horiz });
      }
    }
    cands.sort((p, q) => (q.ext - p.ext) || (q.len - p.len));
    for (const c of cands.slice(0, 2)) {
      const mx = (c.a[0] + c.b[0]) / 2, my = (c.a[1] + c.b[1]) / 2;
      const X = ox + mx * sx, Y = -(w / 2 + my * s);
      const r = w / 2 + extra + 1;
      if (c.horiz) { ctx.moveTo(X, Y - r); ctx.lineTo(X, Y + r); } else { ctx.moveTo(X - r, Y); ctx.lineTo(X + r, Y); }
    }
  }
  ctx.stroke();
}

function fontStyle(o) {
  const st = { ...(FONT_STYLES[o.font] || FONT_STYLES.block) };
  if (o.weight) st.weight = o.weight;
  if (o.skew !== undefined) st.skew = o.skew;
  if (o.condense) st.condense *= o.condense;
  if (o.track !== undefined) st.track = o.track;
  return st;
}

/** Width in px of athletic lettering (same options as drawBlockText). */
export function blockTextWidth(str, h, o = {}) {
  return textLayout(str, h, fontStyle(o), o.spacing || 0).width;
}

/**
 * Athletic lettering — jersey numbers, wordmarks, letters in logos.
 * (x, y) is the anchor: baseline by default, vertical centre with o.middle.
 * o: { font: 'block'|'pro'|'college'|'italic'|'stencil', align: 'center'|'left'|'right',
 *      fill | gradient [[stop, colour], …], outline, ow (px), outline2, ow2 (px),
 *      shadow [dx, dy, colour], weight, skew, condense, spacing, track, gap (stencil gap colour) }
 * Any colour may be the CUT marker used by mono logos. Returns the width.
 */
export function drawBlockText(ctx, str, x, y, h, o = {}) {
  str = String(str);
  const st = fontStyle(o);
  const L = textLayout(str, h, st, o.spacing || 0);
  const ox = x - (o.align === 'left' ? 0 : o.align === 'right' ? L.width : L.width / 2);
  const base = o.middle ? y + h / 2 : y;
  ctx.save();
  // italic leans right at the top: centred text shifts back by half the lean
  ctx.translate(ox + (o.align === 'left' || o.align === 'right' ? 0 : st.skew * h / 2), base);
  ctx.transform(1, 0, st.skew, 1, 0, 0);
  if (o.grow !== undefined) {
    // a single layer, thickened by `grow` px (layered lettering: arches, overlaps)
    strokeGlyphs(ctx, L, st, o.grow, o.fill || '#ffffff');
    if (st.stencil && o.gap) stencilGaps(ctx, L, st, h, o.gap, o.grow);
    ctx.restore();
    ctx.globalCompositeOperation = 'source-over';
    return L.width;
  }
  const ow = o.outline ? (o.ow ?? h * 0.06) : 0;
  const ow2 = o.outline2 ? (o.ow2 ?? h * 0.05) : 0;
  if (o.shadow) {
    ctx.save();
    ctx.translate(o.shadow[0], o.shadow[1]);
    strokeGlyphs(ctx, L, st, ow + ow2, o.shadow[2] || 'rgba(0,0,0,0.6)');
    ctx.restore();
  }
  if (o.outline2) strokeGlyphs(ctx, L, st, ow + ow2, o.outline2);
  if (o.outline) strokeGlyphs(ctx, L, st, ow, o.outline);
  let fill = o.fill || '#ffffff';
  if (o.gradient && fill !== CUT) {
    const g = ctx.createLinearGradient(0, -h, 0, 0);
    for (const [stop, c] of o.gradient) g.addColorStop(stop, c);
    fill = g;
  }
  strokeGlyphs(ctx, L, st, 0, fill);
  if (st.stencil) stencilGaps(ctx, L, st, h, o.gap || o.outline || CUT, ow);
  ctx.restore();
  ctx.globalCompositeOperation = 'source-over';
  return L.width;
}

// ------------------------------------------------------------------ the painter

/**
 * Resolve a team (or a bare palette) into role colours.
 * Mono palettes map light roles to the mono colour and dark roles to CUT.
 */
export function logoPalette(team, opts = {}) {
  const L = team.logo || {};
  const c = team.colors || {};
  const fg = L.fg || c.secondary || '#ffffff';
  const fg2 = L.fg2 || c.primary || '#333333';
  const line = L.line || c.dark || darken(fg2, 0.6);
  const P = {
    fg, fg2,
    acc: L.acc || c.accent || '#ffffff',
    bg: L.bg || c.primary || fg2,
    ring: L.ring || c.accent || '#ffffff',
    line,
    white: '#ffffff',
    shade: mixHex(fg, line, 0.38),
    shade2: mixHex(fg2, line, 0.38),
    light: lighten(fg, 0.45),
    mid: lighten(fg, 0.2),
    light2: lighten(fg2, 0.35),
    dark: line,
  };
  if (opts.mono) {
    for (const k of Object.keys(P)) P[k] = opts.mono;
    P.line = P.dark = P.bg = CUT;
    P.mono = opts.mono;
  }
  return P;
}

function makePainter(ctx, P, px) {
  const g = {
    ctx, P, px,
    small: px < 0.34,     // under ~68 px: drop fine details
    tiny: px < 0.17,      // score-bug size
    ow: Math.max(5.2, 0.85 / px),
    col(role) {
      if (role === CUT) return CUT;
      if (P.mono) {
        if (typeof role !== 'string') return P.mono;
        if (role === 'line' || role === 'dark' || role === 'bg' || role === 'cut') return CUT;
        return P.mono;
      }
      if (typeof role !== 'string') return role; // gradients / patterns
      if (role === 'cut') return CUT;
      return P[role] ?? role;
    },
    fill(shape, role, rule) {
      const c = g.col(role);
      setFill(ctx, c);
      ctx.fill(P2(shape), rule || 'nonzero');
      ctx.globalCompositeOperation = 'source-over';
    },
    stroke(shape, role, w, cap = 'round', join = 'round') {
      const c = g.col(role);
      setFill(ctx, c);
      ctx.lineWidth = w;
      ctx.lineCap = cap;
      ctx.lineJoin = join;
      ctx.miterLimit = 3;
      ctx.stroke(P2(shape));
      ctx.globalCompositeOperation = 'source-over';
    },
    /** outline + fill, stacked on what's below */
    part(shape, role, ow = g.ow, rule) {
      g.stroke(shape, 'line', ow * 2);
      g.fill(shape, role, rule);
    },
    /** several shapes sharing one outer outline (no outline between them) */
    parts(list, ow = g.ow) {
      for (const [s] of list) g.stroke(s, 'line', ow * 2);
      for (const [s, r, rule] of list) g.fill(s, r, rule);
    },
    /** thick lines with a merged outline: list of [path, role, width] */
    bars(list, ow = g.ow, cap = 'round', join = 'round') {
      for (const [s, , w] of list) g.stroke(s, 'line', w + ow * 2, cap, join);
      for (const [s, r, w] of list) g.stroke(s, r, w, cap, join);
    },
    /** detail line in the outline colour, thickened so it survives small sizes */
    line(shape, w = 3.2, role = 'line') {
      g.stroke(shape, role, Math.max(w, 0.7 / px));
    },
    clip(shape, fn) {
      ctx.save();
      ctx.clip(P2(shape));
      fn();
      ctx.restore();
    },
    with(tf, fn) {
      ctx.save();
      tf(ctx);
      fn();
      ctx.restore();
    },
    /** athletic letters, vertically centred on cy */
    text(str, x, cy, h, o = {}) {
      // a lone I needs its slabs or it reads as a bar
      const font = str === 'I' || str === '1' ? 'college' : (o.font || 'block');
      return drawBlockText(ctx, str, x, cy, h, {
        middle: true, align: 'center', font, skew: o.skew, condense: o.condense, track: o.track,
        fill: g.col(o.fill || 'fg'),
        outline: g.col(o.outline || 'line'), ow: o.ow ?? g.ow,
        outline2: o.outline2 ? g.col(o.outline2) : undefined, ow2: o.ow2 ?? g.ow,
        gap: g.col(o.gap || o.outline || 'line'),
        weight: o.weight,
      });
    },
  };
  return g;
}

// ------------------------------------------------------------------ emblems

// Each emblem: draw(g, o) in the 200-unit box. o = { letter, font } from the
// team's logo. `slot` is where an extra block letter goes (HS 'both' logos);
// `ownsLetter` emblems draw the letter themselves.
const EMBLEMS = {};
const def = (id, draw, extra = {}) => { EMBLEMS[id] = { draw, ...extra }; };

// ---------------------------------------------------------------- wave (Port Halcyon Tide)
def('wave', (g) => {
  // a breaking wave, Hokusai-style: the back rises out of the sea to a crest,
  // the lip pitches forward over the dark tube, white water rides the lip
  const crest = [
    [[-98, 66], [-74, 40], [-54, -34], [-14, -70]],
    [[-14, -70], [12, -92], [54, -96], [80, -72]],
    [[80, -72], [98, -56], [100, -24], [86, -4]],
    [[86, -4], [78, 8], [62, 8], [58, -4]],
  ];
  const body = 'M -98 98 L -98 66 C -74 40, -54 -34, -14 -70 C 12 -92, 54 -96, 80 -72 C 98 -56, 100 -24, 86 -4 C 78 8, 62 8, 58 -4 C 50 -24, 32 -34, 16 -28 C 0 -22, -8 2, 4 24 C 16 44, 52 54, 98 56 L 98 98 Z';
  const tube = 'M 58 -4 C 50 -24, 32 -34, 16 -28 C 0 -22, -8 2, 4 24 C 12 38, 26 44, 38 44 C 54 30, 62 14, 58 -4 Z';
  g.part(tube, 'bg');
  g.part(body, 'fg');
  g.part(tube, 'bg', g.ow * 0.8);
  // the swirl inside the tube
  if (!g.small) g.stroke('M 46 0 C 40 -16, 24 -20, 16 -10 C 8 2, 14 18, 28 20 C 36 20, 40 12, 36 6', 'light2', 4);
  // shading down the face of the wave
  if (!g.small) {
    g.fill('M -60 30 C -44 -10, -24 -40, 2 -58 C -14 -30, -22 0, -18 40 C -30 46, -46 42, -60 30 Z', 'shade');
    g.line('M -44 44 C -40 10, -24 -24, -2 -46', 3, 'light');
  }
  // white water along the crest and lip, fingered on its inner edge
  const top = bezPts(crest.slice(1), 18);
  const foamOut = top.map(([x, y]) => [x, y]);
  const foamIn = top.map(([x, y], i) => {
    const p = top[Math.min(top.length - 1, i + 1)], q = top[Math.max(0, i - 1)];
    let tx = p[0] - q[0], ty = p[1] - q[1];
    const l = Math.hypot(tx, ty) || 1;
    tx /= l; ty /= l;
    const u = i / (top.length - 1);
    const env = 0.45 + 0.75 * Math.sin(Math.min(1, u * 1.15) * Math.PI);
    // raking claws: the inner edge jumps in and eases back out, like fingers
    const ph = (i % 8) / 8;
    const claw = g.tiny ? 0 : Math.max(0, 1 - ph * 1.7) * 13;
    const d = (7 + claw) * env;
    return [x - ty * d, y + tx * d];
  });
  g.fill(poly([...foamOut, ...foamIn.slice().reverse()]), 'acc');
  g.line(body, g.ow * 0.9);
  // spray off the lip
  if (!g.tiny) for (const [x, y, r] of [[88, -86, 3.4], [95, -73, 2.8], [74, -95, 2.6], [98, -56, 2.2]]) g.part(circ(x, y, r), 'acc', g.ow * 0.4);
  // the sea in front
  g.part(smooth([[-98, 98], [-98, 62], [-74, 70], [-44, 76], [-12, 72], [22, 64], [58, 66], [82, 72], [98, 66], [98, 98]], false, 0.5) + 'Z', 'fg2');
  if (!g.small) {
    g.line(smooth([[-86, 84], [-52, 80], [-16, 87], [22, 81], [58, 87], [88, 82]], false), 3, 'light2');
  }
}, { slot: { x: -30, y: 46, h: 76 } });

// ---------------------------------------------------------------- gear (Detroit Motormen)
def('gear', (g, o) => {
  const n = 12, R = 94, r = 76, tw = TAU / n;
  const pts = [];
  for (let i = 0; i < n; i++) {
    const a = i * tw - Math.PI / 2;
    pts.push(pol(r, a - tw * 0.5), pol(r, a - tw * 0.25), pol(R, a - tw * 0.17), pol(R, a + tw * 0.17), pol(r, a + tw * 0.25));
  }
  g.part(poly(pts), 'fg');
  g.part(circ(0, 0, 60), 'fg2');
  if (!g.small) {
    for (let i = 0; i < n; i++) g.fill(circ(...pol(68, i * tw - Math.PI / 2 + tw / 2), 3.2), 'shade');
    g.stroke(circ(0, 0, 53), 'acc', 3);
  }
  if (o.letter) g.text(o.letter, 2, 0, 74, { font: o.font || 'italic', fill: 'fg', outline: 'acc', ow: 4.5, outline2: 'line', ow2: 4 });
  else {
    g.part(circ(0, 0, 22), 'fg');
    g.fill(circ(0, 0, 9), 'line');
  }
}, { ownsLetter: true });

// ---------------------------------------------------------------- derrick (Houston Wildcatters)
def('derrick', (g) => {
  g.part(circ(0, 16, 64), 'bg');
  g.stroke(circ(0, 16, 57), 'acc', 5);
  const top = -64, bot = 80, xt = 13, xb = 50;
  const legX = (y) => xt + (xb - xt) * ((y - top) / (bot - top));
  const girts = [-36, -6, 26, 56];
  const bars = [];
  bars.push([poly([[-xt, top], [-xb, bot]], false), 'fg', 10]);
  bars.push([poly([[xt, top], [xb, bot]], false), 'fg', 10]);
  for (const y of girts) bars.push([poly([[-legX(y), y], [legX(y), y]], false), 'fg', 6]);
  const ys = [top, ...girts];
  for (let i = 0; i < ys.length - 1; i++) {
    const a = ys[i], b = ys[i + 1];
    bars.push([poly([[-legX(a), a], [legX(b), b]], false), 'fg', 4.5]);
    bars.push([poly([[legX(a), a], [-legX(b), b]], false), 'fg', 4.5]);
  }
  bars.push([poly([[-74, bot + 4], [74, bot + 4]], false), 'fg', 12]);
  g.bars(bars, g.ow * 0.85, 'butt', 'miter');
  g.part(rect(-18, top - 12, 36, 14), 'fg');
  g.part(poly(starPts(0, -84, 16, 6.5)), 'acc');
}, { slot: { x: 0, y: 30, h: 80 } });

// ---------------------------------------------------------------- mountain (Salt Lake Summit)
def('mountain', (g) => {
  const B = 52;
  const sil = poly([[-96, B], [-56, -22], [-38, -2], [-2, -84], [28, -30], [52, -50], [96, B]]);
  g.part(sil, 'acc');
  // shadow faces
  g.clip(sil, () => {
    g.fill(poly([[-2, -84], [20, B], [60, B], [28, -30]]), 'fg2');
    g.fill(poly([[52, -50], [70, B], [100, B]]), 'fg2');
    g.fill(poly([[-56, -22], [-44, B], [-24, B], [-38, -2]]), 'fg2');
    // snow caps
    g.fill(poly([[-2, -84], [-22, -38], [-12, -44], [-4, -30], [6, -46], [14, -36], [20, -52]]), 'fg');
    g.fill(poly([[52, -50], [40, -24], [48, -28], [56, -20], [62, -32]]), 'fg');
    g.fill(poly([[-56, -22], [-66, -4], [-58, -8], [-50, -2], [-46, -12]]), 'fg');
  });
  g.line(poly([[-2, -84], [20, B]], false), 3);
  g.line(poly([[52, -50], [70, B]], false), 3);
  // base band with a swoosh
  const band = smooth([[-96, B - 6], [-40, B - 14], [20, B - 6], [96, B - 18], [96, B + 26], [-96, B + 26]], true, 0.35);
  g.part(rrect(-96, B - 4, 192, 30, 6), 'fg2');
  if (!g.tiny) g.part(smooth([[-84, B + 16], [-20, B + 4], [40, B + 10], [86, B - 2], [40, B + 18], [-20, B + 14]], true, 0.4), 'acc', g.ow * 0.6);
}, { slot: { x: 0, y: 20, h: 80 } });

// ---------------------------------------------------------------- anchor (Boston Ironsides)
def('anchor', (g) => {
  const arms = [];
  for (let i = 0; i <= 24; i++) arms.push(pol(70, Math.PI * (0.06 + 0.88 * i / 24), 0, 6));
  const armsIn = [];
  for (let i = 24; i >= 0; i--) armsIn.push(pol(54, Math.PI * (0.1 + 0.8 * i / 24), 0, 6));
  const fluke = (s) => poly([[s * 70 * Math.cos(Math.PI * 0.06) - s * 0, 10], [s * 92, -16], [s * 82, 24], [s * 58, 24]]);
  g.parts([
    [ringPath(0, -76, 19, 9), 'fg', 'evenodd'],
    [rrect(-46, -56, 92, 14, 7), 'fg'],
    [rect(-10, -66, 20, 140), 'fg'],
    [poly([...arms, ...armsIn]), 'fg'],
    [fluke(1), 'fg'], [fluke(-1), 'fg'],
    [poly([[-14, 72], [0, 90], [14, 72]]), 'fg'],
  ]);
  g.fill(circ(-46, -49, 9), 'fg');
  g.fill(circ(46, -49, 9), 'fg');
  if (!g.small) {
    g.line(poly([[-4, -40], [-4, 66]], false), 2.6, 'light');
    g.line(poly([[-38, -51], [38, -51]], false), 2.4, 'light');
  }
  // the rope
  const rope = 'M 20 -78 C 44 -66, 40 -40, 6 -30 C -34 -18, -38 8, -4 18 C 30 28, 34 48, 12 60';
  g.stroke(rope, 'line', 9 + g.ow * 2);
  g.stroke(rope, 'fg2', 9);
  if (!g.small) g.stroke(rope, 'light2', 2.4);
}, { slot: { x: 0, y: 10, h: 70 } });

// ---------------------------------------------------------------- crown (New York Empire)
def('crown', (g) => {
  const cap = 'M -64 30 C -66 -18, -34 -40, 0 -40 C 34 -40, 66 -18, 64 30 Z';
  const pts = poly([[-80, 32], [-86, -22], [-58, 0], [-42, -50], [-22, -2], [0, -74], [22, -2], [42, -50], [58, 0], [86, -22], [80, 32]]);
  const band = 'M -82 26 C -40 18, 40 18, 82 26 L 78 66 C 40 58, -40 58, -78 66 Z';
  g.parts([[cap, 'fg2'], [pts, 'fg'], [band, 'fg']]);
  g.part(pts, 'fg');
  if (!g.small) {
    g.line('M -70 -4 L -60 22 M -42 -36 L -38 18 M 0 -58 L 0 18 M 42 -36 L 38 18 M 70 -4 L 60 22', 2.2, 'shade');
  }
  g.part(band, 'fg');
  for (const [x, y] of [[-84, -24], [-40, -50], [0, -74], [40, -50], [84, -24]]) g.part(circ(x, y, 9), 'acc', g.ow * 0.7);
  g.part(ell(0, 43, 11, 13), 'fg2', g.ow * 0.6);
  if (!g.tiny) {
    for (const s of [-1, 1]) g.part(poly([[s * 40, 32], [s * 48, 42], [s * 40, 52], [s * 32, 42]]), 'acc', g.ow * 0.5);
    for (const s of [-1, 1]) g.fill(circ(s * 62, 42, 4), 'fg2');
  }
  if (!g.small) g.line('M -74 34 C -40 28, 40 28, 74 34', 2.4, 'light');
}, { slot: { x: 0, y: 30, h: 70 } });

// ---------------------------------------------------------------- flame (Chicago Blaze)
const FLAME = 'M 0 94 C -48 94, -74 62, -68 22 C -64 -6, -44 -24, -42 -52 C -24 -34, -20 -18, -18 -6 C -14 -42, 4 -68, 24 -98 C 30 -64, 58 -50, 62 -14 C 70 -26, 74 -38, 72 -54 C 96 -20, 90 32, 66 64 C 52 84, 28 94, 0 94 Z';
def('flame', (g) => {
  g.part(FLAME, 'fg2');
  g.part(scaleAbout(FLAME, 0.72, 4, 94), 'acc', g.ow * 0.7);
  g.part(scaleAbout(FLAME, 0.45, 8, 94), 'fg', g.ow * 0.6);
  if (!g.tiny) g.fill(scaleAbout(FLAME, 0.2, 10, 92), 'white');
}, { slot: { x: 0, y: 40, h: 80 } });

// ---------------------------------------------------------------- eagle (Washington Sentinels)
def('eagle', (g) => {
  // dark shoulders behind the white head
  const body = 'M -40 100 C -30 70, -4 52, 30 46 C 56 42, 80 50, 100 64 L 100 100 Z';
  const head = 'M -34 -44 C -20 -70, 14 -82, 46 -72 C 70 -64, 84 -44, 84 -20 L 98 -8 L 82 -2 L 96 16 L 78 18 L 90 38 L 70 36 L 76 58 L 56 50 L 56 74 L 38 60 L 30 84 L 18 62 L 4 78 C -6 52, -14 30, -22 14 L -40 10 C -44 0, -42 -24, -34 -44 Z';
  const beak = 'M -36 -46 C -58 -56, -84 -46, -94 -18 C -98 -4, -94 12, -84 20 C -86 6, -80 -4, -66 -6 L -36 -6 C -42 -20, -42 -34, -36 -46 Z';
  const jaw = 'M -64 0 C -58 10, -46 14, -34 10 L -36 -4 Z';
  g.part(body, 'fg2');
  g.part(head, 'fg');
  g.part(jaw, 'acc', g.ow * 0.8);
  g.part(beak, 'acc');
  // eye and the angry brow
  g.fill(ell(-8, -36, 9, 7, -0.2), 'acc');
  g.fill(circ(-10, -36, 4), 'line');
  g.fill('M -34 -46 C -18 -52, 4 -50, 18 -40 C 4 -42, -10 -42, -22 -36 Z', 'line');
  if (!g.small) {
    g.line('M -80 -8 C -76 -14, -70 -16, -62 -16', 2.4, 'shade');
    g.line('M 10 -20 C 24 -16, 40 -6, 50 8', 3, 'shade');
    g.line('M 0 0 C 14 6, 26 18, 32 32', 3, 'shade');
  }
}, { slot: { x: 34, y: 50, h: 76 } });

// ---------------------------------------------------------------- bolt (Orlando Voltage)
def('bolt', (g) => {
  const ring = ringPath(0, 0, 76, 60);
  g.part(ring, 'fg2', g.ow, 'evenodd');
  const bolt = poly([[30, -98], [-36, 6], [-2, 6], [-40, 98], [46, -16], [10, -16], [58, -98]]);
  g.part(bolt, 'fg');
  if (!g.small) g.line(poly([[38, -88], [-18, -2], [10, -2]], false), 3, 'white');
  if (!g.tiny) {
    for (const [a, l] of [[-2.5, 16], [-2.1, 12], [0.6, 14], [1.0, 11]]) {
      const [x, y] = pol(86, a);
      g.stroke(poly([[x, y], pol(86 + l, a)], false), 'line', 7);
      g.stroke(poly([[x, y], pol(86 + l, a)], false), 'fg', 3.5);
    }
  }
}, { slot: { x: 0, y: 30, h: 70 } });

// ---------------------------------------------------------------- rattlesnake (Atlanta Rattlers)
def('rattlesnake', (g) => {
  // coiled to strike: rattle up at the bottom right, the S of the body, the
  // wedge head up top with the jaws open
  const spine = bezPts([
    [[52, 80], [6, 96], [-76, 94], [-80, 58]],
    [[-80, 58], [-84, 22], [-30, 26], [12, 26]],
    [[12, 26], [62, 26], [84, -12], [54, -32]],
    [[54, -32], [34, -46], [20, -42], [6, -50]],
  ], 16);
  const body = poly(bandPts(spine, (u) => (u < 0.08 ? 16 + u * 200 : 32 - 12 * Math.pow((u - 0.08) / 0.92, 1.5))));
  // the rattle, rising from the tail tip
  for (let i = 3; i >= 0; i--) g.part(ell(60 + i * 8, 76 - i * 9, 8 - i * 0.6, 6.5 - i * 0.4, -0.9), 'acc', g.ow * 0.7);
  g.part(body, 'fg');
  if (!g.tiny) {
    g.clip(body, () => {
      for (let i = 6; i < spine.length - 5; i += 5) {
        const [x, y] = spine[i], [x2, y2] = spine[i + 1];
        const a = Math.atan2(y2 - y, x2 - x);
        const d = 9.5 * (1 - i / spine.length * 0.3);
        const dia = poly([pol(d * 1.35, a, x, y), pol(d, a + Math.PI / 2, x, y), pol(d * 1.35, a + Math.PI, x, y), pol(d, a - Math.PI / 2, x, y)]);
        g.fill(dia, 'fg2');
        if (!g.small) g.stroke(dia, 'line', 2.2);
      }
    });
    if (!g.small) g.line(poly(bandPts(spine.slice(4, -2), 20).slice(0, spine.length - 6), false), 2, 'light');
  }
  // the head: open jaws, fangs, forked tongue
  const mouth = 'M 2 -56 L -62 -66 L -58 -36 Z';
  g.fill(mouth, 'line');
  if (!g.small) g.fill('M -6 -54 L -50 -62 L -48 -44 Z', '#a8202c');
  const upper = 'M 10 -66 C 10 -82, -6 -96, -34 -96 C -58 -96, -76 -88, -80 -76 C -82 -68, -78 -62, -70 -62 C -56 -64, -40 -62, -24 -60 C -12 -58, 0 -56, 6 -52 Z';
  const lower = 'M 8 -50 C -10 -46, -36 -40, -58 -36 C -64 -35, -66 -40, -60 -44 C -44 -50, -24 -56, -4 -60 Z';
  g.part(lower, 'fg2');
  g.part(upper, 'fg2');
  g.fill('M -66 -63 L -62 -46 L -57 -62 Z', 'white');
  g.fill('M -46 -61 L -45 -50 L -41 -60 Z', 'white');
  if (!g.small) g.stroke('M -58 -48 L -84 -40 M -84 -40 L -96 -46 M -84 -40 L -94 -30', '#a8202c', 3);
  g.fill(ell(-40, -80, 7, 5, -0.15), 'acc');
  g.fill(ell(-40, -80, 1.8, 4.6, 0), 'line');
  g.fill('M -60 -84 C -48 -92, -30 -92, -20 -84 C -30 -86, -46 -86, -56 -80 Z', 'line');
  if (!g.small) g.fill(circ(-70, -72, 2.6), 'line');
}, { slot: { x: 24, y: 56, h: 66 } });

// ---------------------------------------------------------------- horse (Louisville Thoroughbreds)
def('horse', (g) => {
  const head = 'M 22 -74 L 14 -98 L 30 -82 L 40 -96 L 46 -72 C 66 -56, 84 -24, 92 10 C 98 40, 96 70, 92 98 L 30 98 C 34 76, 34 60, 30 50 C 20 58, 4 64, -14 66 C -30 68, -46 72, -56 70 C -70 68, -80 58, -82 46 C -84 34, -78 26, -70 22 C -52 0, -30 -30, -10 -52 C 0 -62, 10 -70, 22 -74 Z';
  const mane = 'M 24 -76 C 42 -80, 58 -70, 66 -58 C 74 -66, 80 -64, 84 -56 C 82 -48, 86 -40, 94 -36 C 88 -28, 92 -18, 100 -12 C 92 -6, 96 6, 100 14 C 92 18, 94 30, 98 40 C 90 42, 90 54, 94 64 L 92 98 C 96 60, 84 10, 60 -26 C 50 -42, 38 -58, 24 -76 Z';
  g.part(mane, 'fg2');
  g.part(head, 'fg');
  g.clip(head, () => g.fill(mane, 'fg2'));
  g.line(head, g.ow * 0.6);
  // face details
  g.fill(ell(-12, -34, 7, 5, -0.5), 'line');
  if (!g.tiny) g.fill(circ(-14, -36, 1.8), 'white');
  g.line('M -24 -44 C -16 -50, -6 -48, 0 -42', 3);
  g.fill('M -74 36 C -70 30, -62 32, -62 40 C -64 46, -70 44, -74 36 Z', 'line');
  g.line('M -80 54 C -70 56, -62 54, -56 50', 3);
  if (!g.small) {
    g.line('M 30 50 C 44 30, 40 0, 18 -8', 3, 'shade');
    g.line('M -40 2 C -30 12, -10 14, 6 8', 2.6, 'shade');
  }
  // bridle: browband, cheek piece and noseband, with the bit ring
  g.clip(head, () => {
    g.bars([
      ['M 10 -62 C 4 -52, -2 -46, -8 -46', 'acc', 5],
      ['M 2 -46 C -4 -20, -20 16, -40 44', 'acc', 5],
      ['M -66 14 C -54 22, -40 26, -22 22', 'acc', 5],
    ], g.ow * 0.5);
  });
  g.part(circ(-44, 48, 6), 'acc', g.ow * 0.5);
}, { slot: { x: 40, y: 56, h: 70 } });

// ---------------------------------------------------------------- tornado (Oklahoma City Twisters)
def('tornado', (g) => {
  // the funnel: wide under the storm, twisting down to a rope at the ground
  const funnel = 'M -88 -54 C -74 -8, -30 10, -22 38 C -16 58, -2 80, 12 98 L 22 98 C 24 78, 34 58, 42 36 C 52 6, 92 -16, 92 -54 Z';
  g.part(funnel, 'fg');
  g.clip(funnel, () => {
    // alternating bands of the twist, bowed so they read as wrapping round
    for (let i = 0; i < 7; i++) {
      const y = -54 + i * 22;
      const band = `M -100 ${fm(y)} C -40 ${fm(y + 14)}, 40 ${fm(y + 2)}, 100 ${fm(y - 12)} L 100 ${fm(y + 1)} C 40 ${fm(y + 14)}, -40 ${fm(y + 26)}, -100 ${fm(y + 12)} Z`;
      g.fill(band, 'light');
      if (!g.small) g.line(`M -100 ${fm(y + 12)} C -40 ${fm(y + 26)}, 40 ${fm(y + 14)}, 100 ${fm(y + 1)}`, 2.6, 'shade');
    }
  });
  g.line(funnel, g.ow * 0.9);
  // the storm cloud on top
  g.part('M -96 -56 C -100 -78, -78 -94, -56 -86 C -44 -100, -14 -102, -2 -88 C 14 -102, 46 -100, 58 -86 C 80 -96, 102 -78, 96 -56 C 92 -44, 78 -40, 64 -46 C 40 -36, -40 -36, -66 -46 C -82 -40, -94 -46, -96 -56 Z', 'fg2');
  if (!g.small) g.line('M -60 -70 C -40 -76, -20 -74, -6 -68 M 20 -74 C 40 -80, 60 -76, 72 -68', 2.6, 'light2');
  // debris
  if (!g.tiny) {
    for (const [x, y, s, a] of [[-46, 58, 8, 0.4], [-30, 84, 6, -0.3], [56, 52, 7, 0.8], [62, 80, 6, 0.2], [-58, 34, 5, 1.1]]) {
      g.with((c) => { c.translate(x, y); c.rotate(a); }, () => g.part(rect(-s / 2, -s / 3, s, s * 0.66), 'fg2', 2.4));
    }
  }
}, { slot: { x: 0, y: 30, h: 70 } });

// ---------------------------------------------------------------- bison (Kansas City Stampede)
def('bison', (g) => {
  const horn = 'M 46 -36 C 62 -44, 76 -56, 82 -80 C 84 -88, 82 -94, 78 -98 C 94 -86, 98 -60, 84 -40 C 76 -28, 62 -22, 50 -20 Z';
  g.part(horn, 'fg2');
  g.part(mirrorX(horn), 'fg2');
  const head = sym([
    ['M', 0, -70], ['L', 12, -82], ['L', 20, -66], ['L', 34, -78], ['L', 38, -60], ['L', 54, -66], ['L', 52, -48],
    ['C', 64, -46, 76, -30, 74, -10], ['L', 86, -2], ['L', 72, 8], ['L', 80, 22], ['L', 64, 24],
    ['C', 58, 40, 44, 54, 36, 64], ['C', 34, 76, 28, 86, 16, 90], ['L', 0, 92],
  ]);
  g.part(head, 'fg');
  // shaggy forelock and mane, a shade lighter than the face, combed with strands
  g.fill(sym([['M', 0, -66], ['L', 10, -76], ['L', 18, -58], ['L', 30, -68], ['L', 34, -44], ['C', 30, -30, 18, -22, 10, -12], ['L', 0, -8]]), 'mid');
  if (!g.small) {
    g.line('M -6 -60 C -10 -46, -12 -34, -8 -22 M 6 -60 C 10 -46, 12 -34, 8 -22 M -20 -54 C -24 -42, -24 -34, -20 -26 M 20 -54 C 24 -42, 24 -34, 20 -26', 2.4, 'shade');
    g.line('M -60 -30 C -66 -18, -66 -6, -60 4 M 60 -30 C 66 -18, 66 -6, 60 4 M -52 14 C -56 22, -54 30, -48 36 M 52 14 C 56 22, 54 30, 48 36', 2.4, 'shade');
  }
  // muzzle
  const muzzle = sym([['M', 0, 34], ['C', 18, 34, 34, 44, 34, 62], ['C', 34, 80, 20, 92, 0, 92]]);
  g.part(muzzle, 'shade', g.ow * 0.6);
  g.fill(ell(-14, 62, 6, 8, 0.3), 'line');
  g.fill(ell(14, 62, 6, 8, -0.3), 'line');
  // eyes under a heavy brow
  for (const s of [-1, 1]) {
    g.fill(ell(s * 30, 2, 8, 6, s * 0.3), 'acc');
    g.fill(circ(s * 29, 3, 3.6), 'line');
    g.fill(poly([[s * 16, -10], [s * 46, -8], [s * 40, 0], [s * 18, -2]]), 'line');
  }
  if (!g.small) {
    g.line('M -20 14 C -14 24, -8 30, -6 36', 2.6, 'shade');
    g.line('M 20 14 C 14 24, 8 30, 6 36', 2.6, 'shade');
  }
  // beard
  g.part(poly([[-20, 86], [-14, 100], [-4, 90], [0, 100], [4, 90], [14, 100], [20, 86]]), 'fg', g.ow * 0.6);
}, { slot: { x: 0, y: 46, h: 70 } });

// ---------------------------------------------------------------- longhorn (Fort Worth Cattlemen)
def('longhorn', (g) => {
  const horn = 'M 22 -40 C 46 -52, 66 -46, 80 -52 C 88 -56, 94 -66, 96 -82 C 102 -64, 100 -44, 86 -34 C 70 -24, 48 -28, 26 -18 Z';
  const tip = 'M 96 -82 C 100 -72, 99 -60, 94 -52 C 90 -58, 90 -66, 96 -82 Z';
  for (const m of [(d) => d, mirrorX]) {
    g.part(m(horn), 'fg');
    g.fill(m(tip), 'fg2');
  }
  const ear = 'M 28 -24 C 44 -24, 58 -16, 62 -6 C 50 -4, 38 -6, 28 -12 Z';
  g.part(ear, 'fg2', g.ow * 0.8);
  g.part(mirrorX(ear), 'fg2', g.ow * 0.8);
  const head = sym([['M', 0, -50], ['C', 16, -50, 28, -44, 30, -30], ['C', 32, -8, 28, 20, 22, 44], ['C', 28, 56, 28, 72, 20, 82], ['C', 14, 90, 6, 92, 0, 92]]);
  g.part(head, 'fg2');
  // white blaze and a light muzzle
  g.fill(sym([['M', 0, -44], ['C', 8, -40, 12, -30, 10, -18], ['L', 6, 30], ['L', 0, 40]]), 'fg');
  g.part(sym([['M', 0, 52], ['C', 16, 52, 24, 62, 24, 72], ['C', 22, 84, 12, 92, 0, 92]]), 'light', g.ow * 0.6);
  g.fill(ell(-10, 76, 4, 6, 0.3), 'line');
  g.fill(ell(10, 76, 4, 6, -0.3), 'line');
  for (const s of [-1, 1]) {
    g.fill(ell(s * 20, -4, 5, 4, 0), 'line');
    g.line(`M ${s * 12} -14 L ${s * 28} -10`, 3);
  }
  if (!g.tiny) {
    g.part(circ(0, -30, 9), 'acc', g.ow * 0.6);
    g.fill(poly(starPts(0, -30, 6, 2.6)), 'fg');
  }
}, { slot: { x: 0, y: 40, h: 70 } });

// ---------------------------------------------------------------- axe (Portland Axemen)
function axeShape(g) {
  const handle = rrect(-6.5, -60, 13, 152, 6);
  const head = sym([['M', 0, -86], ['L', 8, -82], ['C', 22, -82, 34, -90, 42, -98], ['C', 50, -80, 50, -54, 42, -36], ['C', 34, -44, 22, -50, 8, -50], ['L', 0, -48]]);
  g.part(handle, 'acc');
  g.part(head, 'fg');
  if (!g.small) {
    g.line('M 34 -88 C 40 -74, 40 -58, 36 -46', 3, 'white');
    g.line('M -34 -88 C -40 -74, -40 -58, -36 -46', 3, 'white');
    g.line('M -2 -30 L -2 80', 2.4, 'shade');
  }
  g.fill(rect(-7, -78, 14, 22), 'shade2');
}
def('axe', (g) => {
  for (const s of [1, -1]) g.with((c) => { c.translate(0, 8); c.rotate(s * 0.62); }, () => axeShape(g));
}, { slot: { x: 0, y: 36, h: 76 } });

// ---------------------------------------------------------------- wolf (Denver Wolves)
def('wolf', (g) => {
  const head = sym([
    ['M', 0, -50], ['L', 16, -54], ['L', 46, -98], ['L', 62, -50],
    ['L', 74, -34], ['L', 96, -18], ['L', 78, -8], ['L', 94, 12], ['L', 72, 16], ['L', 82, 40], ['L', 58, 40],
    ['C', 50, 56, 36, 74, 20, 86], ['L', 0, 94],
  ]);
  g.part(head, 'fg');
  // inner ears
  for (const s of [-1, 1]) g.fill(poly([[s * 24, -56], [s * 44, -86], [s * 54, -54]]), 'shade2');
  // dark mask over the brow
  g.fill(sym([['M', 0, -46], ['L', 18, -50], ['L', 40, -30], ['L', 30, -12], ['L', 14, -6], ['L', 0, -12]]), 'fg2');
  // pale muzzle and cheeks
  g.fill(sym([['M', 0, -10], ['L', 12, -6], ['C', 22, 10, 30, 30, 30, 46], ['C', 26, 64, 14, 80, 0, 86]]), 'light');
  g.fill(sym([['M', 46, 6], ['L', 70, 18], ['L', 60, 36], ['L', 40, 38]]), 'light');
  // eyes
  for (const s of [-1, 1]) {
    const eye = poly([[s * 12, -12], [s * 30, -20], [s * 40, -16], [s * 30, -8]]);
    g.fill(eye, 'acc');
    g.fill(circ(s * 27, -14, 3.6), 'line');
    g.line(eye, 2.6);
    g.fill(poly([[s * 8, -20], [s * 34, -30], [s * 44, -20], [s * 30, -24]]), 'line');
  }
  // nose and mouth
  g.fill(sym([['M', 0, 34], ['L', 12, 32], ['C', 16, 34, 16, 42, 10, 46], ['L', 0, 50]]), 'line');
  g.line('M 0 50 L 0 60 M 0 60 C -8 68, -16 68, -22 62 M 0 60 C 8 68, 16 68, 22 62', 3);
  if (!g.small) {
    g.line('M -50 -16 L -62 -4 M 50 -16 L 62 -4', 2.6, 'shade');
    g.line('M -38 22 L -52 30 M 38 22 L 52 30', 2.6, 'shade');
  }
}, { slot: { x: 36, y: 56, h: 70 } });

// ================================================================ college & high-school marks

// ---------------------------------------------------------------- owl
def('owl', (g) => {
  const body = sym([
    ['M', 0, -58], ['L', 18, -62], ['L', 42, -96], ['L', 52, -60],
    ['C', 70, -48, 80, -26, 80, 0], ['C', 84, 30, 80, 60, 64, 82], ['L', 40, 96], ['L', 0, 96],
  ]);
  g.part(body, 'fg2');
  // facial disc
  g.part(sym([['M', 0, -50], ['C', 22, -62, 62, -58, 66, -24], ['C', 68, 4, 46, 22, 20, 20], ['L', 0, 30]]), 'light2', g.ow * 0.7);
  // breast feathers
  g.fill(sym([['M', 0, 26], ['C', 20, 20, 44, 30, 50, 56], ['C', 50, 80, 30, 94, 0, 96]]), 'light2');
  if (!g.small) {
    for (const y of [44, 60, 76]) for (const x of [-26, 0, 26]) {
      if (Math.abs(x) > 20 && y > 70) continue;
      g.line(`M ${x - 7} ${y} L ${x} ${y + 7} L ${x + 7} ${y}`, 2.6, 'shade2');
    }
    g.line('M -64 0 C -60 30, -56 56, -44 78 M 64 0 C 60 30, 56 56, 44 78', 3, 'line');
  }
  // eyes
  for (const s of [-1, 1]) {
    g.part(circ(s * 30, -20, 25), 'fg', g.ow * 0.8);
    g.fill(circ(s * 30, -20, 15), 'white');
    g.fill(circ(s * 28, -19, 9.5), 'line');
    if (!g.tiny) g.fill(circ(s * 25, -23, 3), 'white');
    g.fill(poly([[s * 4, -40], [s * 56, -52], [s * 52, -40], [s * 10, -32]]), 'fg2');
  }
  g.part(poly([[-10, -12], [10, -12], [0, 14]]), 'acc', g.ow * 0.7);
}, { slot: { x: 34, y: 56, h: 70 } });

// ---------------------------------------------------------------- anvil
function anvilShape(g, sparks) {
  const anvil = 'M -97 -10 C -78 -24, -56 -30, -40 -32 L 80 -32 L 80 -8 L 62 -4 C 46 0, 36 10, 32 26 C 36 38, 50 46, 62 50 L 66 70 L -50 70 L -46 50 C -34 46, -24 38, -22 26 C -24 10, -34 2, -48 -2 C -66 -4, -84 -6, -97 -10 Z';
  g.part(anvil, 'fg');
  g.fill('M -80 -16 C -62 -26, -50 -28, -40 -28 L 76 -28 L 76 -20 L -40 -20 C -54 -20, -68 -16, -80 -14 Z', 'light');
  if (!g.small) {
    g.line('M -22 26 C -10 30, 20 30, 32 26', 2.6, 'shade');
    g.line('M -46 50 L 62 50', 2.6, 'shade');
    g.fill(rect(52, -26, 8, 8), 'shade');
  }
  // sparks off the face
  if (sparks && !g.tiny) {
    for (const [x1, y1, x2, y2] of [[20, -42, 30, -72], [34, -42, 58, -64], [8, -42, 0, -66], [46, -40, 76, -50]]) {
      g.stroke(`M ${x1} ${y1} L ${x2} ${y2}`, 'line', 9);
      g.stroke(`M ${x1} ${y1} L ${x2} ${y2}`, 'acc', 4);
    }
  }
}
def('anvil', (g, o) => {
  if (!o.letter) { anvilShape(g, true); return; }
  // the letter stands on the anvil
  g.text(o.letter, 0, -30, 118, { font: o.font || 'college', fill: 'fg2', outline: 'acc', ow: 5, outline2: 'line', ow2: 5 });
  g.with((c) => { c.translate(0, 46); c.scale(0.78, 0.66); }, () => anvilShape(g, false));
}, { ownsLetter: true });

// ---------------------------------------------------------------- pickaxe
def('pickaxe', (g, o) => {
  g.with((c) => { c.translate(4, 8); c.rotate(-0.7); if (o.letter) c.scale(1.04, 1.04); }, () => {
    g.part(rrect(-7, -54, 14, 152, 6), 'fg2');
    const head = 'M -90 -30 C -60 -58, -30 -70, 0 -70 C 30 -70, 60 -58, 90 -30 C 60 -44, 30 -50, 0 -50 C -30 -50, -60 -44, -90 -30 Z';
    g.part(head, 'fg');
    g.part(rrect(-12, -74, 24, 30, 4), 'shade');
    if (!g.small) g.line('M -70 -40 C -40 -56, 40 -56, 70 -40', 2.4, 'white');
  });
  if (o.letter) g.text(o.letter, -8, 22, 92, { font: o.font || 'block', fill: 'fg2', outline: 'acc', ow: 4.5, outline2: 'line', ow2: 4.5 });
}, { ownsLetter: true });

// ---------------------------------------------------------------- ship's wheel
def('wheel', (g) => {
  const bars = [];
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * TAU - Math.PI / 2;
    bars.push([poly([pol(10, a), pol(82, a)], false), 'fg', 11]);
  }
  g.bars(bars);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * TAU - Math.PI / 2;
    const [x, y] = pol(86, a);
    g.with((c) => { c.translate(x, y); c.rotate(a); }, () => g.part(rrect(-12, -7, 24, 14, 7), 'fg'));
  }
  g.part(ringPath(0, 0, 66, 50), 'fg', g.ow, 'evenodd');
  if (!g.small) g.stroke(circ(0, 0, 58), 'shade', 2.6);
  g.part(circ(0, 0, 22), 'fg2');
  g.part(circ(0, 0, 9), 'fg');
}, { slot: { x: 0, y: 0, h: 70 } });

// ---------------------------------------------------------------- star (faceted)
def('star', (g, o) => {
  const pts = starPts(0, 8, 98, 40);
  const c = [0, 8];
  g.part(poly(pts), 'fg');
  for (let i = 0; i < 10; i++) {
    const a = pts[i], b = pts[(i + 1) % 10];
    // each arm splits down its ridge: one side lit, one in shade
    if (i % 2 === 0) g.fill(poly([c, a, b]), 'fg'); else g.fill(poly([c, a, b]), 'shade');
  }
  if (!g.small) for (let i = 0; i < 10; i += 2) g.line(poly([c, pts[i]], false), 2.2, 'light');
  g.line(poly(pts), g.ow * 0.9);
  if (o.letter) g.text(o.letter, 0, 14, o.letter.length > 1 ? 44 : 66, { font: o.font || 'college', fill: 'fg2', outline: 'white', ow: 4.5, outline2: 'line', ow2: 4 });
}, { ownsLetter: true });

// ---------------------------------------------------------------- shield (+ letter)
const SHIELD = 'M -74 -84 L 74 -84 L 74 -14 C 74 40, 42 72, 0 96 C -42 72, -74 40, -74 -14 Z';
def('shield', (g, o) => {
  g.part(SHIELD, 'bg');
  g.stroke(scaleAbout(SHIELD, 0.86, 0, 0), 'ring', 7);
  if (o.letter) g.text(o.letter, 0, -2, o.letter.length > 1 ? 70 : 100, { font: o.font || 'college', fill: 'fg', outline: 'line', ow: 5, outline2: 'ring', ow2: 4 });
  else {
    g.part(rect(-12, -66, 24, 140), 'fg');
    g.part(rect(-54, -30, 108, 24), 'fg');
  }
}, { ownsLetter: true });

// ---------------------------------------------------------------- monogram (interlocking letters)
def('monogram', (g, o) => {
  const L = (o.letter || 'AB').slice(0, 3);
  const font = o.font || 'college';
  const st = { font, fill: 'fg', outline: 'fg2', ow: 5, outline2: 'line', ow2: 4 };
  if (L.length === 1) { g.text(L, 0, 0, 170, st); return; }
  if (L.length === 3) {
    g.text(L[0], -52, 0, 110, st); g.text(L[2], 52, 0, 110, st); g.text(L[1], 0, 0, 140, st);
    return;
  }
  // two letters interlocked: one shared keyline, then each letter over the
  // other in turn so they weave (first over second up top, under it below)
  const h = 150, a = [-24, -8], b = [24, 10];
  const lay = (ch, p, role, grow) => drawBlockText(g.ctx, ch, p[0], p[1], h, { font, align: 'center', middle: true, fill: g.col(role), grow });
  const oo = 9, oi = 4.5;
  lay(L[0], a, 'line', oo); lay(L[1], b, 'line', oo);
  lay(L[1], b, 'fg2', oi); lay(L[1], b, 'fg', 0);
  lay(L[0], a, 'line', oi + 2.5); lay(L[0], a, 'fg2', oi); lay(L[0], a, 'fg', 0);
  g.clip(rect(-100, 6, 200, 100), () => { lay(L[1], b, 'line', oi + 2.5); lay(L[1], b, 'fg2', oi); lay(L[1], b, 'fg', 0); });
}, { ownsLetter: true });

// ---------------------------------------------------------------- letter (varsity block)
def('letter', (g, o) => {
  const L = (o.letter || 'A').slice(0, 3);
  const h = L.length === 1 ? 172 : L.length === 2 ? 118 : 86;
  g.text(L, 0, 2, h, { font: o.font || 'block', fill: 'fg', outline: 'fg2', ow: 9, outline2: 'line', ow2: 5 });
}, { ownsLetter: true });

// ---------------------------------------------------------------- paw
def('paw', (g) => {
  g.with((c) => c.rotate(-0.12), () => {
    const pad = 'M 0 4 C 28 4, 54 26, 58 50 C 62 76, 42 88, 24 84 C 12 82, 8 76, 0 76 C -8 76, -12 82, -24 84 C -42 88, -62 76, -58 50 C -54 26, -28 4, 0 4 Z';
    const toes = [ell(-62, -16, 17, 23, -0.35), ell(-24, -50, 18, 25, -0.12), ell(24, -50, 18, 25, 0.12), ell(62, -16, 17, 23, 0.35)];
    if (!g.tiny) {
      for (const [x, y, a] of [[-68, -40, -0.5], [-28, -78, -0.15], [28, -78, 0.15], [68, -40, 0.5]]) {
        g.with((c) => { c.translate(x, y); c.rotate(a); }, () => g.part(poly([[-6, 2], [0, -18], [6, 2]]), 'acc', g.ow * 0.6));
      }
    }
    g.part(pad, 'fg');
    for (const t of toes) g.part(t, 'fg');
    if (!g.small) {
      g.fill(ell(-10, 30, 14, 9, -0.4), 'light');
      for (const [x, y] of [[-68, -26], [-28, -60], [20, -62], [56, -28]]) g.fill(ell(x, y, 5, 7, 0), 'light');
    }
  });
}, { slot: { x: 36, y: 56, h: 70 } });

// ---------------------------------------------------------------- ram
function hornBand(cx, cy, s, t0, turns, R0, k) {
  const out = [], inn = [];
  const N = 60;
  for (let i = 0; i <= N; i++) {
    const u = i / N, t = t0 + turns * TAU * u;
    const r = R0 * Math.exp(-k * turns * TAU * u);
    const w = r * 0.5 + 3;
    out.push([cx + s * Math.cos(t) * r, cy + Math.sin(t) * r]);
    inn.push([cx + s * Math.cos(t) * (r - w), cy + Math.sin(t) * (r - w)]);
  }
  return { path: poly([...out, ...inn.slice().reverse()]), out, inn };
}
def('ram', (g) => {
  // a broad, wedge-shaped head between two heavy curled horns
  const face = sym([['M', 0, -62], ['C', 20, -62, 34, -54, 36, -34], ['C', 38, -12, 32, 14, 26, 32], ['C', 24, 46, 26, 60, 18, 72], ['C', 12, 80, 6, 82, 0, 82]]);
  for (const s of [-1, 1]) {
    const h = hornBand(s * 54, -4, s, -Math.PI * 0.64, 0.92, 56, 0.17);
    g.part(h.path, 'fg');
    if (!g.small) {
      for (let i = 4; i < h.out.length - 4; i += 4) g.line(poly([h.out[i], h.inn[i]], false), 2.4, 'shade');
      g.line(poly(h.out.slice(2, 40).map(([x, y], i) => [x + (h.inn[i + 2][0] - x) * 0.3, y + (h.inn[i + 2][1] - y) * 0.3]), false), 2.4, 'light');
    }
  }
  g.part(face, 'fg2');
  // the bony ridge down the face, the darker muzzle
  g.fill(sym([['M', 0, -58], ['C', 8, -56, 12, -46, 11, -34], ['L', 7, 26], ['L', 0, 34]]), 'light2');
  g.part(sym([['M', 0, 40], ['C', 16, 40, 26, 50, 25, 62], ['C', 22, 76, 12, 84, 0, 84]]), 'shade2', g.ow * 0.6);
  g.fill('M -14 58 C -10 52, -4 54, -4 60 C -6 66, -12 66, -14 58 Z', 'line');
  g.fill('M 14 58 C 10 52, 4 54, 4 60 C 6 66, 12 66, 14 58 Z', 'line');
  g.line('M -8 74 C -4 78, 4 78, 8 74', 2.6);
  for (const s of [-1, 1]) {
    g.fill(ell(s * 21, -10, 6.5, 4.5, s * 0.3), 'acc');
    g.fill(circ(s * 21, -10, 2.8), 'line');
    // a hard, angry brow
    g.fill(poly([[s * 6, -22], [s * 36, -24], [s * 32, -14], [s * 10, -14]]), 'line');
  }
  if (!g.small) g.line('M -30 30 C -24 38, -22 44, -22 50 M 30 30 C 24 38, 22 44, 22 50', 2.6, 'shade2');
}, { slot: { x: 0, y: 46, h: 70 } });

// ---------------------------------------------------------------- spartan / trojan helmet
def('spartan', (g) => {
  // a crested Corinthian helm in profile, facing left
  const crest = 'M -64 -30 C -70 -78, -24 -98, 28 -97 C 72 -96, 99 -70, 98 -22 C 90 -36, 72 -46, 54 -50 C 20 -56, -32 -50, -64 -30 Z';
  const helm = 'M -66 76 C -70 36, -76 0, -66 -26 C -52 -56, -12 -66, 24 -62 C 60 -58, 82 -34, 84 0 C 84 30, 78 56, 74 82 C 62 78, 50 78, 40 86 C 38 64, 30 46, 18 36 C 6 46, -6 64, -12 84 C -30 82, -50 80, -66 76 Z';
  g.part(crest, 'fg2');
  if (!g.small) {
    for (let i = 0; i <= 12; i++) {
      const a = Math.PI * (1.12 + i * 0.066);
      const p1 = [18 + Math.cos(a) * 74, -16 + Math.sin(a) * 40];
      const p2 = [18 + Math.cos(a) * 82, -16 + Math.sin(a) * 76];
      g.line(poly([p1, p2], false), 2.2, 'shade2');
    }
  }
  g.part(helm, 'fg');
  // the brow ridge, the eye slot and the open face (rimmed so a dark helm still reads)
  const face = 'M -74 -20 L -12 -18 C -2 -18, 2 -10, -4 -4 L -34 -2 C -40 16, -44 44, -46 76 L -64 74 C -68 36, -74 6, -74 -20 Z';
  g.stroke(face, 'light', g.small ? 6 : 5);
  g.fill(face, 'line');
  if (!g.small) {
    g.line('M -64 -30 C -40 -50, 20 -56, 62 -40', 3, 'light');
    g.line('M 18 36 C 30 16, 50 2, 82 0', 3, 'shade');
    g.line('M -12 84 C -4 60, 8 44, 18 36', 2.6, 'shade');
    g.fill(circ(30, 8, 4), 'shade');
  }
}, { slot: { x: 34, y: 56, h: 70 } });

// ---------------------------------------------------------------- knight (great helm)
def('knight', (g) => {
  const plume = 'M -4 -76 C 6 -100, 54 -104, 92 -82 C 66 -86, 44 -80, 34 -70 C 58 -72, 78 -62, 92 -46 C 62 -58, 30 -62, 8 -62 Z';
  const helm = sym([['M', 0, -80], ['C', 40, -80, 64, -60, 64, -28], ['L', 60, 72], ['C', 46, 84, 20, 90, 0, 90]]);
  g.part(plume, 'fg2');
  g.part(helm, 'fg');
  g.fill(sym([['M', 0, -78], ['C', 26, -78, 44, -66, 52, -50], ['L', 0, -50]]), 'light');
  // the cross of reinforcing bands
  g.part(rect(-9, -78, 18, 166), 'acc', g.ow * 0.6);
  g.part(rect(-62, -34, 124, 12), 'acc', g.ow * 0.6);
  // eye slits and breaths
  g.fill(rect(-54, -16, 40, 9), 'line');
  g.fill(rect(14, -16, 40, 9), 'line');
  if (!g.small) {
    for (const s of [-1, 1]) for (let r = 0; r < 3; r++) for (let c = 0; c < 2; c++) g.fill(circ(s * (28 + c * 12), 24 + r * 14, 3.2), 'line');
    g.line('M -60 -28 L -56 72 M 60 -28 L 56 72', 2.4, 'shade');
  }
}, { slot: { x: 34, y: 56, h: 70 } });

// ---------------------------------------------------------------- pine
def('pine', (g) => {
  const tree = poly([[0, -98], [30, -54], [14, -54], [46, -14], [24, -14], [62, 34], [-62, 34], [-24, -14], [-46, -14], [-14, -54], [-30, -54]]);
  g.part(rect(-11, 28, 22, 44), 'fg2');
  g.part(tree, 'fg');
  if (!g.small) {
    g.fill(poly([[0, -98], [-30, -54], [-14, -54], [-46, -14], [-24, -14], [-62, 34], [0, 34]]), 'light');
    g.line('M 0 -80 L 0 30', 2.4, 'shade');
  }
  g.part(rrect(-70, 66, 140, 14, 7), 'fg2', g.ow * 0.8);
}, { slot: { x: 0, y: 22, h: 100 } });

// ---------------------------------------------------------------- sun
def('sun', (g) => {
  const rays = [];
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * TAU - Math.PI / 2, long = i % 2 === 0;
    const R = long ? 98 : 80, hw = long ? 0.13 : 0.11;
    rays.push([poly([pol(52, a - hw * 1.6), pol(R, a), pol(52, a + hw * 1.6)]), long ? 'fg' : 'acc']);
  }
  g.parts(rays);
  g.part(circ(0, 0, 58), 'fg');
  g.part(circ(0, 0, 44), 'fg2', g.ow * 0.6);
  if (!g.small) g.fill(circ(-14, -14, 14), 'light2');
}, { slot: { x: 0, y: 4, h: 70 } });

// ---------------------------------------------------------------- torch
def('torch', (g) => {
  g.part(poly([[-20, -6], [20, -6], [9, 96], [-9, 96]]), 'fg2');
  g.part(rrect(-32, -22, 64, 22, 5), 'fg');
  if (!g.small) g.line('M -12 20 L 12 20 M -11 44 L 11 44 M -9 68 L 9 68', 2.6, 'shade2');
  const f = scaleAbout(moveBy(FLAME, 0, 0), 0.66, 0, 94);
  const fl = moveBy(f, 0, -116);
  g.part(fl, 'fg');
  g.part(scaleAbout(fl, 0.62, 2, -22), 'acc', g.ow * 0.6);
}, { slot: { x: 30, y: 50, h: 70 } });

// ---------------------------------------------------------------- bulldog
def('bulldog', (g) => {
  const ear = 'M 30 -70 C 44 -96, 76 -92, 82 -70 C 72 -66, 60 -58, 52 -48 Z';
  g.part(ear, 'fg2');
  g.part(mirrorX(ear), 'fg2');
  const head = sym([['M', 0, -70], ['C', 30, -72, 58, -64, 72, -40], ['C', 86, -18, 94, 10, 92, 36], ['C', 90, 62, 72, 80, 46, 88], ['C', 30, 94, 14, 96, 0, 96]]);
  g.part(head, 'fg');
  // jowls and muzzle
  g.fill(sym([['M', 0, -14], ['C', 22, -14, 40, -2, 50, 18], ['C', 60, 40, 52, 62, 34, 70], ['L', 0, 72]]), 'light');
  // furrowed brow
  g.line('M -54 -30 C -34 -18, -16 -18, 0 -28 C 16 -18, 34 -18, 54 -30', 5);
  if (!g.small) {
    g.line('M -20 -50 C -8 -44, 8 -44, 20 -50 M -26 -40 C -10 -34, 10 -34, 26 -40', 2.6, 'shade');
    g.line('M -50 30 C -60 44, -60 58, -50 70 M 50 30 C 60 44, 60 58, 50 70', 2.8, 'shade');
  }
  for (const s of [-1, 1]) {
    g.fill(ell(s * 28, -12, 7, 5, 0), 'white');
    g.fill(circ(s * 27, -11, 3.8), 'line');
  }
  // the nose
  g.fill(sym([['M', 0, 4], ['C', 14, 2, 24, 6, 24, 14], ['C', 22, 24, 10, 26, 0, 30]]), 'line');
  if (!g.tiny) g.fill(ell(-8, 10, 5, 2.6, 0), 'light2');
  // underbite: the lower jaw jutting out with two teeth up
  g.part(sym([['M', 0, 44], ['C', 22, 44, 38, 46, 42, 54], ['C', 38, 72, 20, 82, 0, 84]]), 'dark', g.ow * 0.6);
  for (const s of [-1, 1]) g.part(poly([[s * 30, 52], [s * 26, 34], [s * 20, 52]]), 'white', g.ow * 0.5);
  g.fill(sym([['M', 0, 54], ['C', 12, 54, 20, 56, 22, 60], ['C', 16, 70, 8, 74, 0, 74]]), '#b03a48');
}, { slot: { x: 36, y: 60, h: 66 } });

// ---------------------------------------------------------------- bear
def('bear', (g) => {
  for (const s of [-1, 1]) {
    g.part(circ(s * 56, -62, 22), 'fg');
    g.fill(circ(s * 56, -60, 11), 'shade');
  }
  const head = sym([['M', 0, -70], ['C', 34, -72, 62, -58, 74, -32], ['C', 84, -8, 82, 14, 92, 30], ['L', 78, 34], ['C', 76, 56, 58, 76, 34, 86], ['C', 22, 90, 10, 92, 0, 92]]);
  g.part(head, 'fg');
  g.fill(sym([['M', 0, -6], ['C', 26, -6, 44, 12, 46, 36], ['C', 46, 62, 26, 80, 0, 82]]), 'light');
  // snarl
  g.fill(sym([['M', 0, 44], ['C', 16, 42, 30, 46, 34, 56], ['C', 28, 72, 14, 78, 0, 78]]), 'line');
  for (const s of [-1, 1]) g.fill(poly([[s * 24, 52], [s * 20, 66], [s * 14, 50]]), 'white');
  g.fill(sym([['M', 0, 52], ['L', 8, 52], ['L', 6, 60], ['L', 0, 60]]), 'white');
  g.fill(sym([['M', 0, 8], ['C', 14, 6, 22, 10, 20, 18], ['C', 16, 28, 8, 32, 0, 34]]), 'line');
  for (const s of [-1, 1]) {
    g.fill(ell(s * 30, -16, 6, 4.5, s * 0.35), 'acc');
    g.fill(circ(s * 30, -16, 2.6), 'line');
    g.fill(poly([[s * 12, -24], [s * 44, -30], [s * 40, -20], [s * 16, -18]]), 'line');
  }
  if (!g.small) g.line('M -60 -20 L -70 -6 M 60 -20 L 70 -6 M -56 10 L -70 22 M 56 10 L 70 22', 2.6, 'shade');
}, { slot: { x: 36, y: 60, h: 66 } });

// ---------------------------------------------------------------- horseshoe
def('horseshoe', (g, o) => {
  const out = [], inn = [];
  const a0 = -0.42, a1 = Math.PI + 0.42;
  for (let i = 0; i <= 30; i++) {
    const a = a0 + (a1 - a0) * (i / 30);
    out.push(pol(86, a, 0, 2));
    inn.push(pol(52, a, 0, 2));
  }
  const shoe = poly([...out, ...inn.slice().reverse()]);
  g.part(shoe, 'fg');
  for (const s of [-1, 1]) g.part(rect(s > 0 ? 50 : -86, -40, 36, 12), 'fg', g.ow * 0.8);
  if (!g.small) {
    g.stroke(poly(Array.from({ length: 31 }, (_, i) => pol(69, a0 + (a1 - a0) * (i / 30), 0, 2)), false), 'shade', 2.4);
    for (let i = 1; i < 8; i++) {
      if (i === 4) continue;
      const a = a0 + (a1 - a0) * (i / 8);
      const [x, y] = pol(69, a, 0, 2);
      g.with((c) => { c.translate(x, y); c.rotate(a); }, () => g.fill(rect(-3.5, -5, 7, 10), 'line'));
    }
  }
  if (o.letter) g.text(o.letter, 0, -2, 88, { font: o.font || 'college', fill: 'fg2', outline: 'white', ow: 4.5, outline2: 'line', ow2: 4 });
}, { ownsLetter: true });

// ---------------------------------------------------------------- lighthouse
def('lighthouse', (g) => {
  // beams
  if (!g.tiny) {
    g.fill('M -6 -66 L -98 -94 L -98 -46 Z', 'light2');
    g.fill('M 6 -66 L 98 -94 L 98 -46 Z', 'light2');
  }
  g.part('M -98 98 C -90 70, -60 64, -40 70 C -20 60, 20 60, 40 70 C 60 64, 90 70, 98 98 Z', 'fg2');
  const tower = poly([[-24, -44], [24, -44], [40, 76], [-40, 76]]);
  g.part(tower, 'fg');
  g.clip(tower, () => {
    for (let i = 0; i < 3; i++) {
      const y = -30 + i * 38;
      g.fill(rect(-50, y, 100, 19), 'fg2');
    }
  });
  g.line(tower, g.ow * 0.8);
  g.part(rect(-36, -52, 72, 10), 'fg2', g.ow * 0.8);
  g.part(rect(-20, -80, 40, 28), 'acc', g.ow * 0.8);
  if (!g.small) g.line('M -7 -80 L -7 -52 M 7 -80 L 7 -52', 2.4);
  g.part(poly([[-28, -80], [28, -80], [0, -100]]), 'fg2', g.ow * 0.8);
  if (!g.small) g.part(rrect(-8, 44, 16, 24, 7), 'line', 1);
}, { slot: { x: 40, y: 50, h: 70 } });

// ---------------------------------------------------------------- swords (crossed cutlasses)
function cutlass(g) {
  const blade = 'M -7 56 L -9 -36 C -9 -66, 2 -86, 18 -98 C 14 -74, 10 -50, 9 -36 L 7 56 Z';
  g.part(blade, 'fg');
  if (!g.small) g.line('M 2 50 L 1 -34 C 1 -56, 6 -72, 14 -86', 2.2, 'white');
  g.part('M -28 56 L 28 56 C 30 62, 28 68, 22 68 L -22 68 C -28 68, -30 62, -28 56 Z', 'acc', g.ow * 0.8);
  g.part('M 24 62 C 40 70, 36 96, 10 98 L 8 92 C 26 90, 30 76, 20 68 Z', 'acc', g.ow * 0.7);
  g.part(rrect(-6, 66, 12, 26, 5), 'fg2', g.ow * 0.7);
  g.part(circ(0, 96, 6), 'acc', g.ow * 0.6);
}
def('swords', (g, o) => {
  g.with((c) => { c.translate(0, 6); c.rotate(0.62); c.scale(0.92, 0.92); }, () => cutlass(g));
  g.with((c) => { c.translate(0, 6); c.rotate(-0.62); c.scale(-0.92, 0.92); }, () => cutlass(g));
  if (o.letter) g.text(o.letter, 0, 2, 78, { font: o.font || 'block', fill: 'fg2', outline: 'acc', ow: 4.5, outline2: 'line', ow2: 4.5 });
}, { ownsLetter: true });

// ---------------------------------------------------------------- comet
def('comet', (g) => {
  const tails = [
    [[[-90, 90], [-50, 60], [-10, 10], [26, -28]], 'fg2', 34],
    [[[-98, 50], [-60, 26], [-20, -6], [20, -34]], 'acc', 18],
    [[[-50, 98], [-26, 64], [0, 30], [30, -20]], 'acc', 16],
  ];
  for (const [seg, role, w] of tails) {
    const pts = bezPts([seg], 16);
    g.part(poly(bandPts(pts, (u) => 2 + w * u)), role, g.ow * 0.7);
  }
  g.part(poly(starPts(38, -38, 58, 24, 5, -Math.PI / 2 + 0.2)), 'fg');
  if (!g.small) g.fill(poly(starPts(38, -38, 30, 12, 5, -Math.PI / 2 + 0.2)), 'light');
}, { slot: { x: 30, y: 48, h: 70 } });

// ---------------------------------------------------------------- hurricane
def('hurricane', (g) => {
  const arm = 'M -30 -2 C -34 -50, 10 -86, 84 -92 C 50 -74, 26 -54, 20 -24 C 14 -14, -10 -8, -30 -2 Z';
  g.part(arm, 'fg');
  g.part(tpath(arm, (x, y) => [-x, -y]), 'fg');
  g.part(circ(0, 0, 36), 'fg2');
  g.part(circ(0, 0, 16), 'white', g.ow * 0.6);
  if (!g.small) {
    g.line('M -16 -40 C 0 -62, 30 -76, 60 -82', 2.6, 'light');
    g.line('M 16 40 C 0 62, -30 76, -60 82', 2.6, 'light');
  }
}, { slot: { x: 34, y: 56, h: 70 } });

// ---------------------------------------------------------------- viking helmet
def('viking', (g) => {
  const horn = 'M 50 -12 C 76 -16, 90 -46, 84 -92 C 100 -64, 104 -24, 84 4 C 76 14, 62 16, 52 14 Z';
  g.part(horn, 'acc');
  g.part(mirrorX(horn), 'acc');
  if (!g.small) for (const s of [-1, 1]) g.line(`M ${s * 62} -20 C ${s * 74} -26, ${s * 82} -34, ${s * 86} -46 M ${s * 72} -2 C ${s * 84} -10, ${s * 92} -20, ${s * 94} -32`, 2.4, 'shade');
  g.part('M -62 44 C -66 -24, -40 -70, 0 -72 C 40 -70, 66 -24, 62 44 Z', 'fg');
  g.fill('M -50 -6 C -48 -40, -26 -62, 0 -64 C -16 -50, -26 -30, -28 -6 Z', 'light');
  g.part(rect(-9, -70, 18, 116), 'fg2', g.ow * 0.6);
  g.part(rrect(-68, 30, 136, 20, 6), 'fg2', g.ow * 0.8);
  g.part(rect(-8, 46, 16, 44), 'fg2', g.ow * 0.8);
  if (!g.small) for (let i = 0; i < 6; i++) g.fill(circ(-54 + i * 21.6, 40, 3.2), 'acc');
}, { slot: { x: 0, y: 50, h: 70 } });

// ---------------------------------------------------------------- wagon wheel
def('wagonwheel', (g) => {
  const bars = [];
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * TAU;
    bars.push([poly([pol(14, a), pol(76, a)], false), 'fg', 9]);
  }
  g.bars(bars, g.ow, 'butt');
  g.part(ringPath(0, 0, 94, 74), 'fg2', g.ow, 'evenodd');
  if (!g.small) {
    g.stroke(circ(0, 0, 84), 'shade2', 2.6);
    for (let i = 0; i < 12; i++) g.fill(circ(...pol(84, (i / 12) * TAU + 0.26), 3), 'line');
  }
  g.part(circ(0, 0, 22), 'fg2');
  g.part(circ(0, 0, 9), 'fg', g.ow * 0.6);
}, { slot: { x: 0, y: 0, h: 70 } });

// ------------------------------------------------------------------ registry helpers

export const EMBLEM_IDS = () => Object.keys(EMBLEMS);

function drawLetterSlot(g, o, slot) {
  const s = slot || { x: 38, y: 50, h: 80 };
  g.text(o.letter, s.x, s.y, s.h, { font: o.font || 'block', fill: 'fg', outline: 'line', ow: g.ow * 1.1, outline2: 'acc', ow2: g.ow * 0.9 });
}

/** Draw an emblem into a design-space painter. */
function paintEmblem(g, emblem, o) {
  const E = EMBLEMS[emblem] || EMBLEMS.shield || EMBLEMS.wave;
  if (o.letter && !E.ownsLetter) {
    // mascot with a block letter: the mascot steps back, the letter in front
    g.with((c) => { c.translate(-10, -8); c.scale(0.86, 0.86); }, () => E.draw(g, { ...o, letter: null }));
    drawLetterSlot(g, o, E.slot);
  } else {
    E.draw(g, o);
  }
}

// ------------------------------------------------------------------ rendering + caching

function glossPass(ctx, W, H) {
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalCompositeOperation = 'source-atop';
  const gr = ctx.createLinearGradient(0, 0, W * 0.2, H);
  gr.addColorStop(0, 'rgba(255,255,255,0.30)');
  gr.addColorStop(0.36, 'rgba(255,255,255,0.10)');
  gr.addColorStop(0.5, 'rgba(255,255,255,0)');
  gr.addColorStop(0.78, 'rgba(0,0,0,0.06)');
  gr.addColorStop(1, 'rgba(0,0,0,0.2)');
  ctx.fillStyle = gr;
  ctx.fillRect(0, 0, W, H);
  // a soft specular glint up and to the left
  const sp = ctx.createRadialGradient(W * 0.34, H * 0.22, 0, W * 0.34, H * 0.22, W * 0.42);
  sp.addColorStop(0, 'rgba(255,255,255,0.16)');
  sp.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = sp;
  ctx.fillRect(0, 0, W, H);
  ctx.restore();
}

function renderEmblem(canvas, emblem, P, o, px, opts) {
  const ctx = canvas.getContext('2d');
  ctx.save();
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.translate(canvas.width / 2, canvas.height / 2);
  const k = px / 200;
  ctx.scale(k, k);
  const g = makePainter(ctx, P, k);
  paintEmblem(g, emblem, o);
  ctx.restore();
  if (!opts.flat && !opts.mono) glossPass(ctx, canvas.width, canvas.height);
}

const bitmapCache = new Map();
const MAX_BITMAPS = 220;

function logoKey(team) {
  const L = team.logo || {};
  return (team.id || '?') + '|' + JSON.stringify(L) + '|' + (team.colors ? team.colors.primary + team.colors.secondary + team.colors.dark : '');
}

function logoOpts(team) {
  const L = team.logo || {};
  return { letter: L.letter || (L.emblem ? null : (team.abbr || '?')[0]), font: L.letterFont };
}

function bitmapFor(key, px, build) {
  const k = key + '|' + px;
  let c = bitmapCache.get(k);
  if (c) { bitmapCache.delete(k); bitmapCache.set(k, c); return c; }
  c = typeof document !== 'undefined' ? document.createElement('canvas') : null;
  if (!c) return null;
  c.width = c.height = px;
  build(c);
  bitmapCache.set(k, c);
  while (bitmapCache.size > MAX_BITMAPS) bitmapCache.delete(bitmapCache.keys().next().value);
  return c;
}

function scaleOf(ctx) {
  const m = ctx.getTransform ? ctx.getTransform() : null;
  return m ? Math.hypot(m.a, m.b) || 1 : 1;
}

/** Draw any emblem with an explicit palette (QA, custom schools). */
export function drawEmblem(ctx, emblem, palette, cx, cy, size, opts = {}) {
  const px = Math.max(8, Math.min(1024, Math.round(size * scaleOf(ctx))));
  const P = { ...palette };
  const key = 'E:' + emblem + '|' + JSON.stringify(palette) + '|' + (opts.letter || '') + (opts.font || '') + '|' + (opts.mono || '') + (opts.flat ? 'f' : '');
  const bmp = bitmapFor(key, px, (c) => {
    const pal = opts.mono ? logoPalette({ logo: {}, colors: {} }, { mono: opts.mono }) : {
      ...logoPalette({ logo: P, colors: {} }), ...P,
    };
    renderEmblem(c, emblem, pal, { letter: opts.letter, font: opts.font }, px, opts);
  });
  if (bmp) ctx.drawImage(bmp, cx - size / 2, cy - size / 2, size, size);
}

export function drawLogo(ctx, team, cx, cy, size, opts = {}) {
  const px = Math.max(8, Math.min(1024, Math.round(size * scaleOf(ctx))));
  const key = logoKey(team) + '|' + (opts.mono || '') + (opts.flat ? 'f' : '');
  const bmp = bitmapFor(key, px, (c) => {
    const P = logoPalette(team, opts);
    renderEmblem(c, (team.logo && team.logo.emblem) || 'letter', P, logoOpts(team), px, opts);
  });
  if (bmp) ctx.drawImage(bmp, cx - size / 2, cy - size / 2, size, size);
}

// ------------------------------------------------------------------ wordmarks

const WORD_FONT = { block: 'block', pro: 'pro', college: 'college', italic: 'italic', stencil: 'stencil', speed: 'italic', arch: 'college' };

/**
 * The team name lettered the team's way: block, pro, college, italic,
 * stencil, speed (italic with streaks) or arch (college arc). (cx, cy) is the
 * centre of the cap height; height = cap height in px. Returns the width.
 * opts: { text, style, mono: '#hex', flat, maxWidth, city: true (city line above), cityText }
 */
export function drawWordmark(ctx, team, cx, cy, height, opts = {}) {
  const W = team.wordmark || {};
  const c = team.colors || {};
  const text = String(opts.text ?? team.name ?? '').toUpperCase();
  const style = opts.style || W.style || (team.level === 'college' ? 'arch' : team.level === 'hs' ? 'block' : 'italic');
  const font = WORD_FONT[style] || 'block';
  const mono = opts.mono;
  const fill = mono || W.fill || c.secondary || '#ffffff';
  const outline = mono ? null : (W.outline || c.dark || '#000000');
  const outline2 = mono ? null : (W.outline2 || null);
  const flat = opts.flat || !!mono;
  let h = height;
  const ow = () => (outline ? h * 0.075 : 0);
  const ow2 = () => (outline2 ? h * 0.06 : 0);
  const base = { font, condense: 1 };
  if (style === 'pro') base.condense = 0.92;
  // fit inside maxWidth: condense first, then shrink
  let width = blockTextWidth(text, h, base);
  const maxW = opts.maxWidth;
  if (maxW) {
    const total = () => width + (ow() + ow2()) * 2 + (style === 'speed' ? h * 0.5 : 0);
    if (total() > maxW) {
      base.condense *= Math.max(0.74, (maxW - (ow() + ow2()) * 2) / width);
      width = blockTextWidth(text, h, base);
      if (total() > maxW) {
        h *= maxW / total();
        width = blockTextWidth(text, h, base);
      }
    }
  }
  const grad = flat ? null : [[0, lighten(fill, 0.42)], [0.48, fill], [0.52, darken(fill, 0.06)], [1, darken(fill, 0.22)]];
  const shadow = flat ? null : [h * 0.05, h * 0.07, 'rgba(0,0,0,0.45)'];
  ctx.save();
  if (opts.city || opts.cityText) {
    const ct = String(opts.cityText || team.city || '').toUpperCase();
    const chh = h * 0.3;
    drawBlockText(ctx, ct, cx, cy - h * 0.5 - chh * 0.95, chh, {
      font: 'block', align: 'center', middle: true, fill: outline2 && !mono ? outline2 : fill, outline: outline || undefined, ow: chh * 0.12, spacing: chh * 0.35, weight: 0.17,
    });
  }
  if (style === 'arch') {
    drawArched(ctx, text, cx, cy, h, base, { fill, grad, outline, ow: ow(), outline2, ow2: ow2(), shadow, maxW });
  } else {
    if (style === 'speed' && !mono) {
      // streaks trailing off to the left, behind the letters
      const sx = cx - width / 2 - h * 0.1;
      for (let i = 0; i < 3; i++) {
        const y = cy - h * 0.32 + i * h * 0.3;
        const len = h * (1.6 - i * 0.35);
        const th = h * (0.13 - i * 0.02);
        ctx.beginPath();
        ctx.moveTo(sx - len, y);
        ctx.lineTo(sx + h * 0.2, y - th / 2);
        ctx.lineTo(sx + h * 0.2, y + th / 2);
        ctx.closePath();
        ctx.fillStyle = i === 1 ? (outline2 || fill) : fill;
        ctx.globalAlpha = 0.95 - i * 0.12;
        ctx.fill();
        ctx.globalAlpha = 1;
      }
    }
    drawBlockText(ctx, text, cx + (style === 'speed' ? h * 0.12 : 0), cy, h, {
      ...base, align: 'center', middle: true, fill, gradient: grad, outline: outline || undefined, ow: ow(),
      outline2: outline2 || undefined, ow2: ow2(), shadow, gap: outline || CUT,
    });
    if (style === 'italic' && !mono && opts.underline !== false && W.underline) {
      ctx.fillStyle = outline2 || fill;
      ctx.fillRect(cx - width / 2, cy + h * 0.66, width, h * 0.08);
    }
  }
  ctx.restore();
  return width;
}

function drawArched(ctx, text, cx, cy, h, base, o) {
  const st = { ...FONT_STYLES[base.font], condense: FONT_STYLES[base.font].condense * base.condense };
  const L = textLayout(text, h, st, 0);
  const R = Math.max(L.width * 1.9, h * 6);
  // the arc's centre sits below; lift it by half the droop so the arch is
  // centred on cy
  const half = L.width / 2 / R;
  const droop = R * (1 - Math.cos(half));
  const ocx = cx, ocy = cy + R + droop / 2;
  const glyphs = [];
  let x = 0;
  for (const ch of text) {
    const k = glyphKey(ch);
    const gw = k === ' ' ? 2.4 * L.sx : GLW[k] * L.sx + L.w;
    glyphs.push({ ch, mid: x + gw / 2 });
    x += gw + st.track * L.s;
  }
  const total = x - st.track * L.s;
  const layers = [];
  if (o.shadow) layers.push({ fill: o.shadow[2], grow: o.ow + o.ow2, dx: o.shadow[0], dy: o.shadow[1] });
  if (o.outline2) layers.push({ fill: o.outline2, grow: o.ow + o.ow2 });
  if (o.outline) layers.push({ fill: o.outline, grow: o.ow });
  layers.push({ fill: o.fill, grow: 0, main: true });
  for (const layer of layers) {
    for (const gph of glyphs) {
      if (gph.ch === ' ') continue;
      const a = (gph.mid - total / 2) / R;
      ctx.save();
      ctx.translate(ocx + Math.sin(a) * R + (layer.dx || 0), ocy - Math.cos(a) * R + (layer.dy || 0));
      ctx.rotate(a);
      let fill = layer.fill;
      if (layer.main && o.grad) {
        // gradients resolve in the glyph's own space (baseline at 0, cap at −h)
        const gr = ctx.createLinearGradient(0, -h, 0, 0);
        for (const [s, col] of o.grad) gr.addColorStop(s, col);
        fill = gr;
      }
      drawBlockText(ctx, gph.ch, 0, 0, h, { font: base.font, condense: base.condense, align: 'center', middle: true, fill, grow: layer.grow });
      ctx.restore();
    }
  }
}

const canvasCache = new Map();
const texCache = new Map();

export function logoCanvas(team, px = 256, opts = {}) {
  const key = `${logoKey(team)}:${px}:${opts.mono || ''}:${opts.flat ? 1 : 0}`;
  if (canvasCache.has(key)) return canvasCache.get(key);
  const c = document.createElement('canvas');
  c.width = c.height = px;
  drawLogo(c.getContext('2d'), team, px / 2, px / 2, px * 0.92, opts);
  canvasCache.set(key, c);
  return c;
}

export function logoTexture(team, px = 256, opts = {}) {
  const key = `${logoKey(team)}:${px}:${opts.mono || ''}:${opts.flat ? 1 : 0}`;
  if (texCache.has(key)) return texCache.get(key);
  const t = new THREE.CanvasTexture(logoCanvas(team, px, opts));
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  t.userData.keep = true;
  texCache.set(key, t);
  return t;
}

/** Forget cached logo bitmaps (after editing a team's colours in place). */
export function clearLogoCache() {
  bitmapCache.clear();
  canvasCache.clear();
}
