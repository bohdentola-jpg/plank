// Hand-drawn ink renderer. Everything in 3RD RAIL is drawn with these:
// shapes are point lists that get a seeded wobble, a flat fill, an optional
// cel-shade crescent, and a thick dark outline. Seeds keep a shape's wobble
// stable between frames; "boil" (changing the seed a few times a second) is
// what makes characters look hand-animated.

export const INK = '#140f26';

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function rand() {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashStr(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export const lerp = (a, b, t) => a + (b - a) * t;
export const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

// ---------------------------------------------------------------- colors

export function hexToRgb(hex) {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function rgbToHex(r, g, b) {
  const c = (v) => clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0');
  return `#${c(r)}${c(g)}${c(b)}`;
}

// mix two hex colors
export function mix(a, b, t) {
  const A = hexToRgb(a), B = hexToRgb(b);
  return rgbToHex(lerp(A[0], B[0], t), lerp(A[1], B[1], t), lerp(A[2], B[2], t));
}

// darken toward a cool ink-purple instead of grey, so shadows stay in palette
export const shade = (c, t = 0.28) => mix(c, '#1a1236', t);
export const tint = (c, t = 0.3) => mix(c, '#fff6e6', t);

export function rgba(hex, a) {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r},${g},${b},${a})`;
}

// ---------------------------------------------------------------- points

export function ellipsePts(cx, cy, rx, ry, rot = 0, n = 0) {
  const per = Math.PI * (3 * (rx + ry) - Math.sqrt((3 * rx + ry) * (rx + 3 * ry)));
  const count = n || Math.max(10, Math.round(per / 6));
  const c = Math.cos(rot), s = Math.sin(rot);
  const out = [];
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2;
    const x = Math.cos(a) * rx, y = Math.sin(a) * ry;
    out.push([cx + x * c - y * s, cy + x * s + y * c]);
  }
  return out;
}

export function rectPts(x, y, w, h) {
  return [[x, y], [x + w, y], [x + w, y + h], [x, y + h]];
}

export function rrectPts(x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  if (r <= 0.5) return rectPts(x, y, w, h);
  const out = [];
  const corner = (cx, cy, a0) => {
    for (let i = 0; i <= 4; i++) {
      const a = a0 + (i / 4) * (Math.PI / 2);
      out.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
    }
  };
  corner(x + w - r, y + r, -Math.PI / 2);
  corner(x + w - r, y + h - r, 0);
  corner(x + r, y + h - r, Math.PI / 2);
  corner(x + r, y + r, Math.PI);
  return out;
}

// Sample a path given as commands: ['M',x,y] ['L',x,y] ['Q',cx,cy,x,y]
// ['C',x1,y1,x2,y2,x,y]. Returns a point list (closing is up to the caller).
export function pathPts(cmds, steps = 8) {
  const out = [];
  let px = 0, py = 0;
  for (const c of cmds) {
    const op = c[0];
    if (op === 'M' || op === 'L') {
      px = c[1]; py = c[2];
      out.push([px, py]);
    } else if (op === 'Q') {
      const [, cx, cy, x, y] = c;
      for (let i = 1; i <= steps; i++) {
        const t = i / steps, u = 1 - t;
        out.push([u * u * px + 2 * u * t * cx + t * t * x, u * u * py + 2 * u * t * cy + t * t * y]);
      }
      px = x; py = y;
    } else if (op === 'C') {
      const [, x1, y1, x2, y2, x, y] = c;
      for (let i = 1; i <= steps; i++) {
        const t = i / steps, u = 1 - t;
        out.push([
          u * u * u * px + 3 * u * u * t * x1 + 3 * u * t * t * x2 + t * t * t * x,
          u * u * u * py + 3 * u * u * t * y1 + 3 * u * t * t * y2 + t * t * t * y,
        ]);
      }
      px = x; py = y;
    }
  }
  return out;
}

export function transformPts(pts, { dx = 0, dy = 0, sx = 1, sy = 1, rot = 0, ox = 0, oy = 0 } = {}) {
  const c = Math.cos(rot), s = Math.sin(rot);
  return pts.map(([x, y]) => {
    const X = (x - ox) * sx, Y = (y - oy) * sy;
    return [ox + X * c - Y * s + dx, oy + X * s + Y * c + dy];
  });
}

// ---------------------------------------------------------------- wobble

// Subdivide every edge and push points along the edge normal by a smooth,
// seeded noise. For closed shapes the noise wraps exactly around the
// perimeter, so there's no seam where the outline starts.
export function wobble(pts, amp = 1, seed = 1, closed = true, seg = 7) {
  if (amp <= 0 || pts.length < 2) return pts;
  const n = pts.length;
  const edges = closed ? n : n - 1;
  let per = 0;
  for (let i = 0; i < edges; i++) {
    const a = pts[i], b = pts[(i + 1) % n];
    per += Math.hypot(b[0] - a[0], b[1] - a[1]);
  }
  if (per < 1) return pts;
  const r = mulberry32(seed);
  const waves = [
    [Math.max(1, Math.round(per / 70)), 0.55],
    [Math.max(2, Math.round(per / 26)), 0.32],
    [Math.max(3, Math.round(per / 11)), 0.13],
  ].map(([k, w]) => [(k * Math.PI * 2) / per, w, r() * Math.PI * 2]);
  const noise = (s) => {
    let v = 0;
    for (const [f, w, p] of waves) v += Math.sin(s * f + p) * w;
    return v;
  };
  const out = [];
  let s = 0;
  for (let i = 0; i < edges; i++) {
    const a = pts[i], b = pts[(i + 1) % n];
    const dx = b[0] - a[0], dy = b[1] - a[1];
    const len = Math.hypot(dx, dy);
    if (len < 0.001) continue;
    const nx = -dy / len, ny = dx / len;
    const k = Math.max(1, Math.ceil(len / seg));
    for (let j = 0; j < k; j++) {
      const t = j / k;
      const o = noise(s + len * t) * amp;
      out.push([a[0] + dx * t + nx * o, a[1] + dy * t + ny * o]);
    }
    s += len;
  }
  if (!closed) {
    const last = pts[n - 1];
    out.push([last[0], last[1]]);
  }
  return out;
}

// Trace a point list as a smooth curve (quadratic through midpoints).
export function trace(P, closed = true, smooth = true, path = new Path2D(), dx = 0, dy = 0) {
  const n = P.length;
  if (n < 2) return path;
  if (!smooth) {
    path.moveTo(P[0][0] + dx, P[0][1] + dy);
    for (let i = 1; i < n; i++) path.lineTo(P[i][0] + dx, P[i][1] + dy);
    if (closed) path.closePath();
    return path;
  }
  if (closed) {
    path.moveTo((P[n - 1][0] + P[0][0]) / 2 + dx, (P[n - 1][1] + P[0][1]) / 2 + dy);
    for (let i = 0; i < n; i++) {
      const p = P[i], q = P[(i + 1) % n];
      path.quadraticCurveTo(p[0] + dx, p[1] + dy, (p[0] + q[0]) / 2 + dx, (p[1] + q[1]) / 2 + dy);
    }
    path.closePath();
  } else {
    path.moveTo(P[0][0] + dx, P[0][1] + dy);
    for (let i = 1; i < n - 1; i++) {
      const p = P[i], q = P[i + 1];
      path.quadraticCurveTo(p[0] + dx, p[1] + dy, (p[0] + q[0]) / 2 + dx, (p[1] + q[1]) / 2 + dy);
    }
    path.lineTo(P[n - 1][0] + dx, P[n - 1][1] + dy);
  }
  return path;
}

// ---------------------------------------------------------------- drawing

let seedCounter = 1;
export const nextSeed = () => (seedCounter = (seedCounter * 48271) % 2147483647);

// A filled, outlined, optionally cel-shaded shape.
// o: { fill, line, lw, amp, seed, seg, smooth, shade, sdx, sdy, hi, hdx, hdy, alpha, inner }
export function shape(ctx, pts, o = {}) {
  const amp = o.amp ?? 1;
  const seed = o.seed ?? 7;
  const smooth = o.smooth ?? true;
  const P = wobble(pts, amp, seed, true, o.seg ?? 7);
  const path = trace(P, true, smooth);
  if (o.alpha != null) {
    ctx.save();
    ctx.globalAlpha *= o.alpha;
  }
  if (o.fill) {
    ctx.fillStyle = o.fill;
    ctx.fill(path);
    if (o.shade || o.hi) {
      ctx.save();
      ctx.clip(path);
      if (o.shade) {
        const sp = trace(P, true, smooth);
        trace(P, true, smooth, sp, -(o.sdx ?? 3), -(o.sdy ?? 3));
        ctx.fillStyle = o.shade;
        ctx.fill(sp, 'evenodd');
      }
      if (o.hi) {
        const hp = trace(P, true, smooth);
        trace(P, true, smooth, hp, o.hdx ?? 2, o.hdy ?? 2);
        ctx.fillStyle = o.hi;
        ctx.fill(hp, 'evenodd');
      }
      ctx.restore();
    }
    if (o.inner) {
      ctx.save();
      ctx.clip(path);
      o.inner(ctx, path);
      ctx.restore();
    }
  }
  const lw = o.lw ?? 3;
  if (lw > 0) {
    ctx.lineWidth = lw;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.strokeStyle = o.line || INK;
    ctx.stroke(path);
  }
  if (o.alpha != null) ctx.restore();
  return path;
}

// Open stroke with wobble.
export function stroke(ctx, pts, o = {}) {
  const P = wobble(pts, o.amp ?? 0.8, o.seed ?? 3, false, o.seg ?? 7);
  const path = trace(P, false, o.smooth ?? true);
  ctx.lineWidth = o.lw ?? 3;
  ctx.lineJoin = 'round';
  ctx.lineCap = o.cap || 'round';
  ctx.strokeStyle = o.color || INK;
  if (o.alpha != null) {
    ctx.save();
    ctx.globalAlpha *= o.alpha;
    ctx.stroke(path);
    ctx.restore();
  } else ctx.stroke(path);
  return path;
}

// Outlined tube: a thick ink stroke with a thinner colored stroke on top.
// Tails, whiskers-with-body, pipes, straps.
export function tube(ctx, pts, color, width, o = {}) {
  const P = wobble(pts, o.amp ?? 0.6, o.seed ?? 5, false, o.seg ?? 7);
  const path = trace(P, false, true);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.lineWidth = width + (o.lw ?? 3) * 2;
  ctx.strokeStyle = o.line || INK;
  ctx.stroke(path);
  ctx.lineWidth = width;
  ctx.strokeStyle = color;
  ctx.stroke(path);
  return path;
}

export const ellipse = (ctx, cx, cy, rx, ry, o = {}) =>
  shape(ctx, ellipsePts(cx, cy, rx, ry, o.rot || 0), o);
export const rrect = (ctx, x, y, w, h, r, o = {}) => shape(ctx, rrectPts(x, y, w, h, r), o);
export const rect = (ctx, x, y, w, h, o = {}) => shape(ctx, rectPts(x, y, w, h), { smooth: false, ...o });
export const poly = (ctx, pts, o = {}) => shape(ctx, pts, o);
export const blob = (ctx, cmds, o = {}) => shape(ctx, pathPts(cmds, o.steps || 8), o);

// Plain (no outline, no wobble) helpers for speed.
export function dot(ctx, x, y, r, color) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
}

// ---------------------------------------------------------------- text

export const FONTS = {
  sign: '"Bungee", "Arial Black", Impact, sans-serif',
  hand: '"Gochi Hand", "Comic Sans MS", "Chalkboard SE", cursive',
  marker: '"Permanent Marker", "Marker Felt", "Comic Sans MS", cursive',
  tag: '"Sedgwick Ave Display", "Permanent Marker", "Marker Felt", cursive',
  drip: '"Rubik Wet Paint", "Bungee", Impact, sans-serif',
};

// Outlined text. o: { font, size, fill, line, lw, align, baseline, rot,
//   skewX, shadow:[dx,dy,color], extrude:[dx,dy,steps,color], spacing }
export function text(ctx, str, x, y, o = {}) {
  const size = o.size || 32;
  ctx.save();
  ctx.translate(x, y);
  if (o.rot) ctx.rotate(o.rot);
  if (o.skewX) ctx.transform(1, 0, o.skewX, 1, 0, 0);
  ctx.font = `${size}px ${o.font || FONTS.sign}`;
  ctx.textAlign = o.align || 'center';
  ctx.textBaseline = o.baseline || 'alphabetic';
  if (o.spacing != null && 'letterSpacing' in ctx) ctx.letterSpacing = `${o.spacing}px`;
  ctx.lineJoin = 'round';
  ctx.miterLimit = 2;
  const lw = o.lw ?? size * 0.16;
  if (o.extrude) {
    const [ex, ey, steps, col] = o.extrude;
    ctx.fillStyle = col;
    ctx.strokeStyle = col;
    ctx.lineWidth = lw;
    for (let i = steps; i >= 1; i--) {
      const fx = (ex * i) / steps, fy = (ey * i) / steps;
      if (lw > 0) ctx.strokeText(str, fx, fy);
      ctx.fillText(str, fx, fy);
    }
    if (lw > 0) {
      ctx.strokeStyle = o.line || INK;
      ctx.lineWidth = lw;
      ctx.strokeText(str, ex, ey);
    }
  }
  if (o.shadow) {
    const [sx, sy, sc] = o.shadow;
    ctx.fillStyle = sc;
    ctx.strokeStyle = sc;
    ctx.lineWidth = lw;
    if (lw > 0) ctx.strokeText(str, sx, sy);
    ctx.fillText(str, sx, sy);
  }
  if (lw > 0) {
    ctx.strokeStyle = o.line || INK;
    ctx.lineWidth = lw;
    ctx.strokeText(str, 0, 0);
  }
  if (o.fill) {
    ctx.fillStyle = o.fill;
    ctx.fillText(str, 0, 0);
  }
  ctx.restore();
}

export function measure(ctx, str, size, font = FONTS.sign) {
  ctx.save();
  ctx.font = `${size}px ${font}`;
  const w = ctx.measureText(str).width;
  ctx.restore();
  return w;
}

// Paint drips hanging from a horizontal band [x, x+w] at y.
export function drips(ctx, x, y, w, color, seed = 1, o = {}) {
  const r = mulberry32(seed);
  const count = o.count ?? Math.max(1, Math.round(w / 26));
  const maxLen = o.maxLen ?? 34;
  const thick = o.thick ?? 5;
  for (let i = 0; i < count; i++) {
    const dx = x + r() * w;
    const len = 6 + r() * r() * maxLen;
    const t = thick * (0.6 + r() * 0.7);
    ctx.lineCap = 'round';
    if (o.line !== null) {
      ctx.strokeStyle = o.line || INK;
      ctx.lineWidth = t + (o.lw ?? 2.4);
      ctx.beginPath();
      ctx.moveTo(dx, y);
      ctx.lineTo(dx, y + len);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(dx, y + len + t * 0.35, t * 0.75 + (o.lw ?? 2.4) / 2, 0, Math.PI * 2);
      ctx.fillStyle = o.line || INK;
      ctx.fill();
    }
    ctx.strokeStyle = color;
    ctx.lineWidth = t;
    ctx.beginPath();
    ctx.moveTo(dx, y - 4);
    ctx.lineTo(dx, y + len);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(dx, y + len + t * 0.35, t * 0.75, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
  }
}

// ---------------------------------------------------------------- offscreen

export function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.ceil(w));
  c.height = Math.max(1, Math.ceil(h));
  return c;
}

// Render a drawing (in world units) into a canvas at `px` pixels per unit.
// Returns { canvas, x, y, w, h } where x/y is the world-space top-left.
export function bake(px, bounds, draw) {
  const [x, y, w, h] = bounds;
  const c = makeCanvas(w * px, h * px);
  const g = c.getContext('2d');
  g.scale(px, px);
  g.translate(-x, -y);
  draw(g);
  return { canvas: c, x, y, w, h };
}

// Noise texture for grain overlays.
export function noiseCanvas(size = 256, seed = 9, alpha = 40) {
  const c = makeCanvas(size, size);
  const g = c.getContext('2d');
  const img = g.createImageData(size, size);
  const r = mulberry32(seed);
  for (let i = 0; i < size * size; i++) {
    const v = Math.floor(r() * 255);
    img.data[i * 4] = v;
    img.data[i * 4 + 1] = v;
    img.data[i * 4 + 2] = v;
    img.data[i * 4 + 3] = alpha;
  }
  g.putImageData(img, 0, 0);
  return c;
}
