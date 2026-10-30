// Item illustrations: the flat-lay drawings used on shop cards, racks and the
// wardrobe. Each draws centered at (0,0) inside a ~100x100 box from an item's
// art spec { type, c, a, s, g, p, p2, finish, prismatic, ... }.
// The fabric / pattern / finish helpers are shared with the worn versions in
// figure.js, so an item looks the same on the rack and on your figure.
import {
  INK, shape, rect, rrect, ellipse, blob, stroke, tube, dot, text, drips, FONTS,
  mulberry32, shade, tint, mix, rgba, ellipsePts, pathPts, wobble, trace, makeCanvas,
} from '../ink.js';

// ---------------------------------------------------------------- shapes

export function dropPts(cx, cy, r, tip = 1.75) {
  return pathPts([
    ['M', cx, cy - r * tip],
    ['C', cx + r * 0.32, cy - r * (tip - 0.6), cx + r, cy - r * 0.55, cx + r, cy + r * 0.08],
    ['C', cx + r, cy + r * 0.66, cx + r * 0.56, cy + r, cx, cy + r],
    ['C', cx - r * 0.56, cy + r, cx - r, cy + r * 0.66, cx - r, cy + r * 0.08],
    ['C', cx - r, cy - r * 0.55, cx - r * 0.32, cy - r * (tip - 0.6), cx, cy - r * tip],
  ], 8);
}

export function heartPts(cx, cy, r) {
  return pathPts([
    ['M', cx, cy + r],
    ['C', cx - r * 1.5, cy + r * 0.05, cx - r * 1.15, cy - r * 1.2, cx, cy - r * 0.42],
    ['C', cx + r * 1.15, cy - r * 1.2, cx + r * 1.5, cy + r * 0.05, cx, cy + r],
  ], 8);
}

export function starPts(cx, cy, r1, r2, n = 5, rot = -Math.PI / 2) {
  const out = [];
  for (let i = 0; i < n * 2; i++) {
    const a = rot + (i * Math.PI) / n, r = i % 2 ? r2 : r1;
    out.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
  }
  return out;
}

export function flamePts(cx, cy, w, h, seed = 1, k = 0) {
  // a single flame tongue, base at (cx, cy), tip at (cx, cy - h)
  const r = mulberry32(seed);
  const sway = Math.sin(k) * w * 0.25;
  return pathPts([
    ['M', cx - w / 2, cy],
    ['C', cx - w * 0.6, cy - h * 0.35, cx - w * 0.15 + sway, cy - h * (0.55 + r() * 0.1), cx + sway * 1.6, cy - h],
    ['C', cx + w * 0.2 + sway, cy - h * (0.6 + r() * 0.1), cx + w * 0.62, cy - h * 0.32, cx + w / 2, cy],
    ['Q', cx, cy + w * 0.18, cx - w / 2, cy],
  ], 6);
}

// 4-point twinkle star
export function twinkle(g, x, y, s, color = '#fffaf0') {
  g.fillStyle = color;
  g.beginPath();
  g.moveTo(x, y - s);
  g.quadraticCurveTo(x + s * 0.16, y - s * 0.16, x + s, y);
  g.quadraticCurveTo(x + s * 0.16, y + s * 0.16, x, y + s);
  g.quadraticCurveTo(x - s * 0.16, y + s * 0.16, x - s, y);
  g.quadraticCurveTo(x - s * 0.16, y - s * 0.16, x, y - s);
  g.fill();
}

// ---------------------------------------------------------------- patterns

const tileCache = new Map();
const TILE_PX = 128, TILE_U = 32; // a 128px tile covers 32 drawing units

function tileFor(g, kind, col) {
  const key = `${kind}:${col}`;
  let entry = tileCache.get(key);
  if (!entry) {
    const c = makeCanvas(TILE_PX, TILE_PX);
    const tg = c.getContext('2d');
    tg.scale(TILE_PX / TILE_U, TILE_PX / TILE_U);
    const r = mulberry32(kind.length * 97 + col.charCodeAt(1));
    if (kind === 'camo') {
      const tones = [col, shade(col, 0.35), tint(col, 0.35)];
      for (let i = 0; i < 18; i++) {
        tg.fillStyle = rgba(tones[i % 3], 0.85);
        const x = r() * TILE_U, y = r() * TILE_U, rx = 3 + r() * 5, ry = 2 + r() * 4;
        for (const ox of [-TILE_U, 0, TILE_U]) for (const oy of [-TILE_U, 0, TILE_U]) {
          tg.beginPath();
          tg.ellipse(x + ox, y + oy, rx, ry, r() * 3, 0, Math.PI * 2);
          tg.fill();
        }
      }
    } else if (kind === 'check') {
      tg.fillStyle = col;
      for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) if ((i + j) % 2 === 0) tg.fillRect(i * 8, j * 8, 8, 8);
    } else if (kind === 'stripes') {
      tg.fillStyle = col;
      for (let i = -2; i < 6; i++) {
        tg.beginPath();
        tg.moveTo(i * 8, 0); tg.lineTo(i * 8 + 4, 0); tg.lineTo(i * 8 + 4 + TILE_U, TILE_U); tg.lineTo(i * 8 + TILE_U, TILE_U);
        tg.fill();
      }
    } else if (kind === 'splatter') {
      const cols = [col, '#fffaf0', tint(col, 0.4)];
      for (let i = 0; i < 26; i++) {
        tg.fillStyle = cols[i % 3];
        const x = r() * TILE_U, y = r() * TILE_U, rr = 0.6 + r() * r() * 3.2;
        tg.beginPath(); tg.arc(x, y, rr, 0, Math.PI * 2); tg.fill();
        if (rr > 2) for (let k = 0; k < 4; k++) { tg.beginPath(); tg.arc(x + (r() - 0.5) * 7, y + (r() - 0.5) * 7, 0.5 + r() * 0.8, 0, Math.PI * 2); tg.fill(); }
      }
    } else if (kind === 'galaxy') {
      tg.fillStyle = 'rgba(16,10,40,0.72)';
      tg.fillRect(0, 0, TILE_U, TILE_U);
      for (let i = 0; i < 5; i++) {
        const x = r() * TILE_U, y = r() * TILE_U;
        const gr = tg.createRadialGradient(x, y, 0, x, y, 7 + r() * 6);
        gr.addColorStop(0, rgba(i % 2 ? col : '#ff6fd0', 0.55));
        gr.addColorStop(1, rgba(col, 0));
        tg.fillStyle = gr;
        tg.fillRect(0, 0, TILE_U, TILE_U);
      }
      for (let i = 0; i < 22; i++) {
        tg.fillStyle = r() < 0.2 ? '#ffe9a8' : '#ffffff';
        const s = r() < 0.12 ? 0.9 : 0.35;
        tg.fillRect(r() * TILE_U, r() * TILE_U, s, s);
      }
    }
    entry = { canvas: c, patterns: new WeakMap() };
    tileCache.set(key, entry);
  }
  // one CanvasPattern per context, made once
  let pat = entry.patterns.get(g);
  if (!pat) {
    pat = g.createPattern(entry.canvas, 'repeat');
    if (pat && pat.setTransform && typeof DOMMatrix !== 'undefined') pat.setTransform(new DOMMatrix().scale(TILE_U / TILE_PX));
    if (pat) entry.patterns.set(g, pat);
  }
  return pat;
}

// Fill a pattern inside the current clip, over the box [x0,y0,x1,y1].
export function drawPattern(g, kind, col, box, seed = 1, t = 0) {
  const [x0, y0, x1, y1] = box;
  const w = x1 - x0, h = y1 - y0;
  col = col || '#fffaf0';
  if (kind === 'camo' || kind === 'check' || kind === 'stripes' || kind === 'splatter' || kind === 'galaxy') {
    const pat = tileFor(g, kind, col);
    if (!pat) return;
    g.fillStyle = pat;
    g.fillRect(x0 - 2, y0 - 2, w + 4, h + 4);
    if (kind === 'galaxy') {
      const tw = (Math.sin(t * 3 + seed) + 1) / 2;
      twinkle(g, x0 + w * 0.3, y0 + h * 0.35, 2.2 + tw * 1.2, '#ffffff');
      twinkle(g, x0 + w * 0.72, y0 + h * 0.64, 1.6 + (1 - tw) * 1.2, '#ffe9a8');
    }
  } else if (kind === 'tiedye') {
    const cx = x0 + w * 0.52, cy = y0 + h * 0.45;
    const cols = [col, tint(col, 0.45), '#fffaf0'];
    for (let i = 12; i >= 1; i--) {
      g.strokeStyle = rgba(cols[i % 3], 0.55);
      g.lineWidth = Math.max(w, h) / 16;
      g.beginPath();
      g.arc(cx, cy, (i / 12) * Math.max(w, h) * 0.75, 0, Math.PI * 2);
      g.stroke();
    }
  } else if (kind === 'flames') {
    const n = Math.max(3, Math.round(w / 12));
    for (let i = 0; i < n; i++) {
      const fx = x0 + (i + 0.5) * (w / n);
      const fh = h * (0.42 + ((i * 37) % 10) / 30);
      g.fillStyle = col;
      g.fill(trace(flamePts(fx, y1 + 2, w / n * 1.25, fh, seed + i, t * 4 + i), true, true));
      g.fillStyle = rgba('#ffe14a', 0.9);
      g.fill(trace(flamePts(fx, y1 + 2, w / n * 0.6, fh * 0.55, seed + i + 9, t * 4 + i + 1), true, true));
    }
  } else if (kind === 'drip') {
    g.fillStyle = col;
    g.fillRect(x0 - 2, y0 - 2, w + 4, h * 0.16);
    const r = mulberry32(seed);
    const n = Math.max(3, Math.round(w / 9));
    g.strokeStyle = col;
    g.lineCap = 'round';
    for (let i = 0; i < n; i++) {
      const dx = x0 + (i + r() * 0.6) * (w / n);
      const len = h * (0.12 + r() * r() * 0.5);
      const th = 1.6 + r() * 1.8;
      g.lineWidth = th;
      g.beginPath(); g.moveTo(dx, y0); g.lineTo(dx, y0 + h * 0.14 + len); g.stroke();
      g.beginPath(); g.arc(dx, y0 + h * 0.14 + len + th * 0.3, th * 0.75, 0, Math.PI * 2); g.fill();
    }
  }
}

// ---------------------------------------------------------------- finishes

const GOLD = '#ffd23f';

export function finishFill(g, c, finish, box) {
  const [x0, y0, x1, y1] = box;
  if (finish === 'gold') {
    const base = c || GOLD;
    const gr = g.createLinearGradient(x0, y0, x1, y1);
    gr.addColorStop(0, tint(base, 0.55));
    gr.addColorStop(0.3, base);
    gr.addColorStop(0.55, shade(base, 0.3));
    gr.addColorStop(0.75, tint(base, 0.45));
    gr.addColorStop(1, shade(base, 0.18));
    return gr;
  }
  if (finish === 'chrome') {
    const gr = g.createLinearGradient(x0, y0, x1, y1);
    gr.addColorStop(0, '#f6f8ff');
    gr.addColorStop(0.28, '#9aa2bc');
    gr.addColorStop(0.5, '#eef2ff');
    gr.addColorStop(0.62, '#ffd6ef');
    gr.addColorStop(0.8, '#6d7390');
    gr.addColorStop(1, '#dfe6ff');
    return gr;
  }
  if (finish === 'ghost') return mix(c || '#bff8ec', '#bff8ec', 0.55);
  return c;
}

function rainbowGradient(g, box, t, alpha = 1, vertical = false) {
  const [x0, y0, x1, y1] = box;
  const w = x1 - x0, h = y1 - y0;
  const off = ((t * 0.35) % 1 + 1) % 1;
  const gr = vertical ? g.createLinearGradient(x0, y0, x0, y1) : g.createLinearGradient(x0 - w * 0.2, y0, x1 + w * 0.2, y1 + h * 0.3);
  const hues = [0, 50, 110, 180, 230, 290, 360];
  for (let i = 0; i < hues.length; i++) {
    const p = (i / (hues.length - 1) + off) % 1;
    gr.addColorStop(p, `hsla(${hues[i]},100%,60%,${alpha})`);
  }
  return gr;
}

// Overlays drawn INSIDE an item's clip: holo sheen, metallic shine.
export function finishOverlay(g, finish, box, t = 0) {
  if (!finish) return;
  const [x0, y0, x1, y1] = box;
  const w = x1 - x0, h = y1 - y0;
  if (finish === 'holo') {
    g.save();
    g.globalCompositeOperation = 'soft-light';
    g.fillStyle = rainbowGradient(g, box, t, 0.9);
    g.fillRect(x0, y0, w, h);
    g.restore();
  }
  if (finish === 'gold' || finish === 'chrome' || finish === 'holo') {
    // a diagonal glint that drifts slowly across
    const k = ((t * 0.25) % 1.6) - 0.3;
    const sx = x0 + w * k;
    g.save();
    g.globalCompositeOperation = 'lighter';
    g.fillStyle = 'rgba(255,255,255,0.32)';
    g.beginPath();
    g.moveTo(sx, y0); g.lineTo(sx + w * 0.16, y0); g.lineTo(sx - w * 0.14, y1); g.lineTo(sx - w * 0.3, y1);
    g.fill();
    g.restore();
  }
  if (finish === 'glow') {
    g.save();
    g.globalCompositeOperation = 'lighter';
    const gr = g.createRadialGradient(x0 + w / 2, y0 + h / 2, 0, x0 + w / 2, y0 + h / 2, Math.max(w, h) * 0.7);
    gr.addColorStop(0, 'rgba(255,255,255,0.25)');
    gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr;
    g.fillRect(x0, y0, w, h);
    g.restore();
  }
}

// The "insanely rare" prismatic foil, drawn inside an item's clip.
export function prismaticOverlay(g, box, t = 0, seed = 1) {
  const [x0, y0, x1, y1] = box;
  const w = x1 - x0, h = y1 - y0;
  g.save();
  // multiply tints light fabric, screen lights up dark fabric: rainbow on anything
  g.globalCompositeOperation = 'multiply';
  g.globalAlpha = 0.6;
  g.fillStyle = rainbowGradient(g, box, t, 1);
  g.fillRect(x0, y0, w, h);
  g.globalCompositeOperation = 'screen';
  g.globalAlpha = 0.5;
  g.fillStyle = rainbowGradient(g, box, t * 1.3 + 0.37, 1, true);
  g.fillRect(x0, y0, w, h);
  g.globalAlpha = 1;
  // two drifting foil glints
  g.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 2; i++) {
    const k = (((t * 0.4 + i * 0.55) % 1.6) + 1.6) % 1.6 - 0.3;
    const sx = x0 + w * k;
    g.fillStyle = `rgba(255,255,255,${i ? 0.22 : 0.38})`;
    g.beginPath();
    g.moveTo(sx, y0); g.lineTo(sx + w * 0.1, y0); g.lineTo(sx - w * 0.22, y1); g.lineTo(sx - w * 0.32, y1);
    g.fill();
  }
  g.restore();
  // twinkles
  const r = mulberry32(seed * 7 + 3);
  for (let i = 0; i < 3; i++) {
    const tw = Math.max(0, Math.sin(t * 4 + i * 2.1 + seed));
    if (tw > 0.05) twinkle(g, x0 + w * (0.15 + r() * 0.7), y0 + h * (0.15 + r() * 0.7), Math.max(w, h) * 0.06 * tw + 0.6, '#ffffff');
  }
}

// ---------------------------------------------------------------- fabric

function boxOf(pts) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const [x, y] of pts) {
    if (x < x0) x0 = x; if (x > x1) x1 = x;
    if (y < y0) y0 = y; if (y > y1) y1 = y;
  }
  return [x0, y0, x1, y1];
}

// The main garment/surface painter: base fill (or metallic finish), pattern,
// details, a translucent cel-shade crescent (so patterns show through),
// finish overlays, prismatic foil, then the ink outline.
// o: { color, seed, amp, lw, sdx, sdy, shadeAmt, smooth, pattern(false to skip), inner(g, box), t, line }
// true when a point list turns one way only (small wobbles ignored)
function isConvex(pts) {
  const n = pts.length;
  let pos = 0, neg = 0;
  for (let i = 0; i < n; i++) {
    const a = pts[i], b = pts[(i + 1) % n], c = pts[(i + 2) % n];
    const cr = (b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0]);
    if (cr > 0.05) pos++;
    else if (cr < -0.05) neg++;
    if (pos > 1 && neg > 1) return false;
  }
  return true;
}

export function fabric(g, pts, p, o = {}) {
  const smooth = o.smooth ?? true;
  const P = wobble(pts, o.amp ?? 0.9, o.seed ?? 7, true, o.seg ?? 7);
  const path = trace(P, true, smooth);
  const box = o.box || boxOf(pts);
  const c = o.color ?? p.c ?? '#8a86a8';
  const finish = o.finish === undefined ? p.finish : o.finish;
  const base = finishFill(g, c, finish, box);
  const shadeAmt = o.shadeAmt ?? 0.24;
  const prism = p.prismatic && o.prismatic !== false;
  const needsClip = (o.pattern !== false && p.p) || o.inner || prism || (finish && finish !== 'ghost');
  g.fillStyle = base;
  g.fill(path);
  if (!needsClip && isConvex(pts)) {
    // clip-free cel shade (clipping is the expensive part of drawing a figure):
    // darken the whole shape, then repaint the base inside a copy shrunk toward
    // the top-left, which leaves the shaded crescent on the bottom-right
    if (shadeAmt > 0) {
      const [x0, y0, x1, y1] = box;
      const kx = 1 - (o.sdx ?? 3) / Math.max(1, x1 - x0), ky = 1 - (o.sdy ?? 3) / Math.max(1, y1 - y0);
      g.fillStyle = rgba('#1a1236', shadeAmt);
      g.fill(path);
      const inner = P.map(([x, y]) => [x0 + (x - x0) * kx, y0 + (y - y0) * ky]);
      g.fillStyle = base;
      g.fill(trace(inner, true, smooth));
    }
  } else {
    g.save();
    g.clip(path);
    if (o.pattern !== false && p.p) drawPattern(g, p.p, p.p2, box, o.seed ?? 7, o.t || 0);
    if (o.inner) o.inner(g, box);
    if (shadeAmt > 0) {
      const sp = trace(P, true, smooth);
      trace(P, true, smooth, sp, -(o.sdx ?? 3), -(o.sdy ?? 3));
      g.fillStyle = rgba('#1a1236', shadeAmt);
      g.fill(sp, 'evenodd');
    }
    finishOverlay(g, finish, box, o.t || 0);
    if (prism) prismaticOverlay(g, box, o.t || 0, o.seed ?? 7);
    g.restore();
  }
  const lw = o.lw ?? 3;
  if (lw > 0) {
    g.lineWidth = lw;
    g.lineJoin = 'round';
    g.lineCap = 'round';
    g.strokeStyle = o.line || INK;
    g.stroke(path);
  }
  return path;
}

const F = (g, cmds, p, sd, o = {}) => fabric(g, pathPts(cmds, 7), p, { seed: sd, ...o });

// ---------------------------------------------------------------- emblems

export function emblem(g, kind, x, y, s, col = '#ffd23f', seed = 1) {
  g.save();
  g.translate(x, y);
  g.scale(s, s);
  const lw = (2.4 / Math.max(0.6, s)) * 0.9;
  switch (kind) {
    case 'bolt':
      shape(g, [[2, -14], [-9, 2], [-1, 2], [-4, 14], [9, -3], [1, -3], [5, -14]], { fill: col, lw, smooth: false, seed });
      break;
    case 'drop':
      shape(g, dropPts(0, 3, 9.5), { fill: col, lw, seed });
      dot(g, -3.2, 1, 2.2, rgba('#ffffff', 0.7));
      break;
    case 'token': {
      ellipse(g, 0, 0, 12, 12, { fill: '#e8b84a', shade: '#b8862a', sdx: 1.5, sdy: 1.5, lw, seed });
      ellipse(g, 0, 0, 8, 8, { fill: '#f4cf6a', lw: lw * 0.7, seed: seed + 1 });
      shape(g, dropPts(0, 1.6, 4, 1.7), { fill: INK, lw: 0, seed: seed + 2 });
      break;
    }
    case 'train':
      rrect(g, -16, -10, 32, 18, 4, { fill: '#c8c8e0', lw, seed });
      rrect(g, -12, -6, 9, 7, 1.5, { fill: '#5aa0ff', lw: lw * 0.6, seed: seed + 1 });
      rrect(g, 3, -6, 9, 7, 1.5, { fill: '#5aa0ff', lw: lw * 0.6, seed: seed + 2 });
      ellipse(g, -9, 10, 3, 3, { fill: INK, lw: 0 });
      ellipse(g, 9, 10, 3, 3, { fill: INK, lw: 0 });
      shape(g, dropPts(0, -14, 3.6, 1.6), { fill: '#ff4f9a', lw: lw * 0.6, seed: seed + 3 });
      break;
    case 'eye':
      shape(g, pathPts([['M', -14, 0], ['Q', 0, -12, 14, 0], ['Q', 0, 12, -14, 0]]), { fill: '#fffaf0', lw, seed });
      dot(g, 0, 0, 5, col);
      dot(g, 0, 0, 2.2, INK);
      for (let i = -2; i <= 2; i++) stroke(g, [[i * 5, -9], [i * 6.5, -14]], { lw: lw * 0.6, color: col });
      break;
    case 'crown':
      shape(g, [[-13, 8], [-13, -6], [-6, 0], [0, -10], [6, 0], [13, -6], [13, 8]], { fill: '#ffd23f', lw, smooth: false, seed });
      dot(g, 0, 3, 2, '#ff4f9a');
      break;
    case 'star':
      shape(g, starPts(0, 0, 14, 6), { fill: col, lw, smooth: false, seed });
      break;
    case 'ghost':
      blob(g, [['M', -10, 10], ['C', -12, -16, 12, -16, 10, 10], ['L', 6, 6], ['L', 2, 10], ['L', -2, 6], ['L', -6, 10], ['Z']], { fill: '#bff8ec', lw, seed });
      dot(g, -4, -3, 1.8, INK); dot(g, 4, -3, 1.8, INK);
      break;
    case 'pizza':
      shape(g, [[-12, -10], [12, -10], [0, 14]], { fill: '#ffcf5a', lw, seed });
      rrect(g, -13, -13, 26, 5, 2, { fill: '#c8742e', lw: lw * 0.8, seed: seed + 1 });
      dot(g, -3, -3, 2.4, '#e8456b'); dot(g, 4, -1, 2.2, '#e8456b'); dot(g, 0, 5, 1.8, '#e8456b');
      break;
    case 'flame':
      shape(g, flamePts(0, 12, 22, 28, seed), { fill: col === '#ffd23f' ? '#ff8a3d' : col, lw, seed });
      shape(g, flamePts(0, 12, 11, 15, seed + 3), { fill: '#ffe14a', lw: 0, seed: seed + 1 });
      break;
    case 'heart':
      shape(g, heartPts(0, 0, 11), { fill: col === '#ffd23f' ? '#ff4f9a' : col, lw, seed });
      dot(g, -5, -4, 2.2, rgba('#ffffff', 0.7));
      break;
    case 'skull':
      blob(g, [['M', -11, 2], ['C', -12, -14, 12, -14, 11, 2], ['L', 7, 6], ['L', 7, 11], ['L', -7, 11], ['L', -7, 6], ['Z']], { fill: '#fffaf0', lw, seed });
      ellipse(g, -4.6, -1, 3.4, 3.8, { fill: INK, lw: 0, seed: seed + 1 });
      ellipse(g, 4.6, -1, 3.4, 3.8, { fill: INK, lw: 0, seed: seed + 2 });
      shape(g, [[0, 2.5], [-1.6, 5.5], [1.6, 5.5]], { fill: INK, lw: 0, smooth: false });
      for (let i = -1; i <= 1; i++) stroke(g, [[i * 3, 7], [i * 3, 11]], { lw: lw * 0.6 });
      break;
    case 'eightball':
      ellipse(g, 0, 0, 13, 13, { fill: '#1d1830', lw, seed });
      ellipse(g, 1, -2, 6, 6, { fill: '#fffaf0', lw: lw * 0.7, seed: seed + 1 });
      text(g, '8', 1, 1.6, { size: 9, font: FONTS.sign, fill: INK, lw: 0 });
      dot(g, -6, -6, 1.8, rgba('#ffffff', 0.55));
      break;
    case 'cone':
      shape(g, [[0, -14], [9, 10], [-9, 10]], { fill: '#ff8a3d', lw, seed });
      stroke(g, [[-4.6, -1], [4.6, -1]], { lw: 3, color: '#fffaf0', amp: 0 });
      stroke(g, [[-6.8, 5], [6.8, 5]], { lw: 3, color: '#fffaf0', amp: 0 });
      rect(g, -13, 9, 26, 5, { fill: '#2a2238', lw: lw * 0.8, seed: seed + 1 });
      break;
    case 'text':
      text(g, String(col), 0, 4, { size: 10, font: FONTS.sign, fill: '#fffaf0', lw: 2 });
      break;
    default:
      break;
  }
  g.restore();
}

// ---------------------------------------------------------------- tops

const SLEEVE_L = [['M', -22, -30], ['C', -34, -24, -40, 6, -40, 24], ['L', -30, 26], ['C', -28, 8, -26, -6, -20, -14], ['Z']];
const SLEEVE_R = [['M', 22, -30], ['C', 34, -24, 40, 6, 40, 24], ['L', 30, 26], ['C', 28, 8, 26, -6, 20, -14], ['Z']];
const BODY = (hem = 30) => [['M', -22, -32], ['C', -26, -10, -26, 14, -24, hem], ['L', 24, hem], ['C', 26, 14, 26, -10, 22, -32], ['C', 10, -40, -10, -40, -22, -32], ['Z']];

function hoodie(g, p, sd, t) {
  const c = p.c, d = shade(c, 0.3);
  F(g, [['M', -16, -36], ['C', -18, -50, 18, -50, 16, -36], ['Z']], p, sd, { color: d, t });
  F(g, SLEEVE_L, p, sd + 1, { t });
  F(g, SLEEVE_R, p, sd + 2, { t });
  rrect(g, -41, 22, 12, 8, 2, { fill: d, lw: 2.4, seed: sd + 3 });
  rrect(g, 29, 22, 12, 8, 2, { fill: d, lw: 2.4, seed: sd + 4 });
  F(g, BODY(), p, sd + 5, { t });
  rrect(g, -24, 26, 48, 8, 3, { fill: d, lw: 2.4, seed: sd + 6 });
  blob(g, [['M', -10, -36], ['C', -6, -26, 6, -26, 10, -36], ['C', 4, -32, -4, -32, -10, -36], ['Z']], { fill: shade(c, 0.5), lw: 2.4, seed: sd + 7 });
  stroke(g, [[-4, -30], [-5, -16]], { lw: 1.8, color: p.a || '#fffaf0', seed: sd + 8 });
  stroke(g, [[4, -30], [5, -16]], { lw: 1.8, color: p.a || '#fffaf0', seed: sd + 9 });
  stroke(g, [[-16, 24], [-12, 10], [12, 10], [16, 24]], { lw: 2, color: rgba('#140f26', 0.6), seed: sd + 10 });
  if (p.g) emblem(g, p.g, 0, -6, 0.75, p.a || '#ffd23f', sd + 11);
}

function tee(g, p, sd, t) {
  const pp = p.dye && !p.p ? { ...p, p: 'tiedye', p2: p.dye } : p;
  F(g, [
    ['M', -14, -34], ['C', -6, -28, 6, -28, 14, -34],
    ['L', 36, -24], ['L', 30, -6], ['L', 22, -9],
    ['L', 22, 32], ['L', -22, 32], ['L', -22, -9],
    ['L', -30, -6], ['L', -36, -24], ['Z'],
  ], pp, sd, { t, smooth: true });
  stroke(g, pathPts([['M', -14, -34], ['Q', 0, -24, 14, -34]]), { lw: 2.4, color: shade(p.c, 0.4), seed: sd + 1 });
  if (p.g) emblem(g, p.g, 0, -4, 0.85, p.a || '#d4473f', sd + 2);
}

function jacket(g, p, sd, t) {
  const c = p.c, d = shade(c, 0.28), a = p.a || '#fffaf0';
  F(g, [['M', -22, -30], ['C', -34, -24, -40, 6, -40, 26], ['L', -29, 28], ['C', -28, 8, -26, -6, -20, -14], ['Z']], p, sd, { t });
  F(g, [['M', 22, -30], ['C', 34, -24, 40, 6, 40, 26], ['L', 29, 28], ['C', 28, 8, 26, -6, 20, -14], ['Z']], p, sd + 1, { t });
  stroke(g, [[-33, -16], [-37, 24]], { lw: 3, color: a, seed: sd + 2 });
  stroke(g, [[33, -16], [37, 24]], { lw: 3, color: a, seed: sd + 3 });
  F(g, BODY(32), p, sd + 4, { t });
  rrect(g, -10, -38, 20, 8, 3, { fill: d, lw: 2.4, seed: sd + 5 });
  stroke(g, [[0, -30], [0, 32]], { lw: 2.4, color: '#c8c8e0', seed: sd + 6 });
  ellipse(g, 0, -24, 2.5, 3.5, { fill: '#c8c8e0', lw: 1.6, seed: sd + 7 });
  stroke(g, [[-20, -24], [-22, 30]], { lw: 3, color: a, seed: sd + 8 });
  stroke(g, [[20, -24], [22, 30]], { lw: 3, color: a, seed: sd + 9 });
}

function windbreaker(g, p, sd, t) {
  const c = p.c, c2 = p.c2 || p.a || '#7b5cff';
  F(g, [['M', -22, -30], ['C', -34, -24, -40, 6, -40, 26], ['L', -29, 28], ['C', -28, 8, -26, -6, -20, -14], ['Z']], p, sd, { color: c2, t, pattern: false });
  F(g, [['M', 22, -30], ['C', 34, -24, 40, 6, 40, 26], ['L', 29, 28], ['C', 28, 8, 26, -6, 20, -14], ['Z']], p, sd + 1, { color: c2, t, pattern: false });
  F(g, BODY(32), p, sd + 2, {
    t,
    inner: (gg) => {
      gg.fillStyle = c2;
      gg.beginPath(); gg.moveTo(-30, 2); gg.lineTo(30, -12); gg.lineTo(30, 4); gg.lineTo(-30, 18); gg.fill();
      gg.fillStyle = '#fffaf0';
      gg.beginPath(); gg.moveTo(-30, 18); gg.lineTo(30, 4); gg.lineTo(30, 8); gg.lineTo(-30, 22); gg.fill();
    },
  });
  blob(g, [['M', -12, -38], ['C', -8, -30, 8, -30, 12, -38], ['L', 8, -26], ['L', -8, -26], ['Z']], { fill: shade(c, 0.3), lw: 2.4, seed: sd + 3 });
  stroke(g, [[0, -28], [0, 32]], { lw: 2, color: INK, seed: sd + 4 });
}

function puffer(g, p, sd, t) {
  const c = p.c, a = p.a || shade(c, 0.4);
  const quilt = (gg, box) => {
    gg.strokeStyle = rgba('#1a1236', 0.35);
    gg.lineWidth = 1.6;
    for (let y = box[1] + 9; y < box[3]; y += 9) {
      gg.beginPath(); gg.moveTo(box[0], y); gg.quadraticCurveTo((box[0] + box[2]) / 2, y + 2.6, box[2], y); gg.stroke();
    }
  };
  for (const s of [-1, 1]) {
    F(g, [['M', s * 22, -32], ['C', s * 38, -28, s * 44, 0, s * 44, 24], ['L', s * 30, 28], ['C', s * 29, 8, s * 27, -8, s * 21, -16], ['Z']], p, sd + (s > 0 ? 1 : 0), { t, inner: quilt, amp: 1.6 });
  }
  F(g, [['M', -24, -33], ['C', -30, -10, -30, 16, -27, 33], ['C', -10, 37, 10, 37, 27, 33], ['C', 30, 16, 30, -10, 24, -33], ['C', 10, -41, -10, -41, -24, -33], ['Z']], p, sd + 2, { t, inner: quilt, amp: 1.8 });
  rrect(g, -13, -42, 26, 10, 5, { fill: c, shade: shade(c, 0.25), sdx: 0, sdy: 2, lw: 2.6, seed: sd + 3 });
  stroke(g, [[0, -32], [0, 34]], { lw: 2.6, color: a, seed: sd + 4 });
  ellipse(g, 0, -26, 2.2, 3.4, { fill: '#c8c8e0', lw: 1.6, seed: sd + 5 });
}

function jersey(g, p, sd, t) {
  const c = p.c, a = p.a || '#fffaf0';
  F(g, [
    ['M', -12, -38], ['Q', 0, -22, 12, -38],
    ['L', 20, -38], ['Q', 18, -22, 26, -14],
    ['L', 26, 34], ['L', -26, 34], ['L', -26, -14],
    ['Q', -18, -22, -20, -38], ['Z'],
  ], p, sd, { t });
  stroke(g, pathPts([['M', -12, -37], ['Q', 0, -23, 12, -37]]), { lw: 3.2, color: a, seed: sd + 1 });
  stroke(g, pathPts([['M', 19.5, -37], ['Q', 18, -22, 25, -15]]), { lw: 3.2, color: a, seed: sd + 2 });
  stroke(g, pathPts([['M', -19.5, -37], ['Q', -18, -22, -25, -15]]), { lw: 3.2, color: a, seed: sd + 3 });
  text(g, String(p.num ?? '00'), 0, 18, { size: 30, font: FONTS.sign, fill: a, lw: 4 });
}

// ---------------------------------------------------------------- bottoms

function legs(g, p, sd, t, o = {}) {
  const bot = o.bot ?? 38, out = o.out ?? 24, inn = o.inn ?? 4;
  return F(g, [['M', -20, -36], ['L', 20, -36], ['L', out, bot], ['L', inn, bot], ['L', 0, -10], ['L', -inn, bot], ['L', -out, bot], ['Z']], p, sd, { t, smooth: false, amp: 0.6 });
}

function cargos(g, p, sd, t) {
  const d = shade(p.c, 0.28);
  legs(g, p, sd, t);
  rrect(g, -21, -38, 42, 8, 2, { fill: d, lw: 2.4, seed: sd + 1 });
  rrect(g, -23, 0, 12, 14, 2, { fill: d, lw: 2.2, seed: sd + 2 });
  rrect(g, 11, 0, 12, 14, 2, { fill: d, lw: 2.2, seed: sd + 3 });
  stroke(g, [[-6, -30], [-2, -10]], { lw: 1.6, color: rgba('#140f26', 0.5), seed: sd + 4 });
}

function trackpants(g, p, sd, t) {
  const a = p.a || '#fffaf0';
  legs(g, p, sd, t, { out: 20, inn: 5 });
  rrect(g, -21, -38, 42, 7, 3, { fill: shade(p.c, 0.25), lw: 2.4, seed: sd + 1 });
  stroke(g, [[-19.5, -32], [-19, 34]], { lw: 3, color: a, seed: sd + 2 });
  stroke(g, [[19.5, -32], [19, 34]], { lw: 3, color: a, seed: sd + 3 });
  rrect(g, -21, 33, 17, 6, 3, { fill: shade(p.c, 0.25), lw: 2.2, seed: sd + 4 });
  rrect(g, 4, 33, 17, 6, 3, { fill: shade(p.c, 0.25), lw: 2.2, seed: sd + 5 });
  stroke(g, [[-3, -35], [-5, -28]], { lw: 1.4, color: a, seed: sd + 6 });
  stroke(g, [[3, -35], [5, -28]], { lw: 1.4, color: a, seed: sd + 7 });
}

function shorts(g, p, sd, t) {
  const a = p.a || '#fffaf0';
  F(g, [['M', -21, -28], ['L', 21, -28], ['L', 27, 14], ['L', 4, 14], ['L', 0, -4], ['L', -4, 14], ['L', -27, 14], ['Z']], p, sd, { t, smooth: false, amp: 0.6 });
  rrect(g, -22, -30, 44, 8, 3, { fill: shade(p.c, 0.25), lw: 2.4, seed: sd + 1 });
  stroke(g, [[-25, 2], [-22, 13]], { lw: 3, color: a, seed: sd + 2 });
  stroke(g, [[25, 2], [22, 13]], { lw: 3, color: a, seed: sd + 3 });
  stroke(g, pathPts([['M', -3, -24], ['Q', -6, -16, -3, -12]]), { lw: 1.4, color: '#fffaf0', seed: sd + 4 });
  stroke(g, pathPts([['M', 3, -24], ['Q', 6, -16, 3, -12]]), { lw: 1.4, color: '#fffaf0', seed: sd + 5 });
}

function jeans(g, p, sd, t) {
  const c = p.c || '#3e6fd8', a = p.a || '#ff9a3c';
  const pp = { ...p, c };
  legs(g, pp, sd, t, { out: 23, inn: 4.5 });
  rrect(g, -21, -38, 42, 7, 2, { fill: shade(c, 0.12), lw: 2.4, seed: sd + 1 });
  g.setLineDash([2.5, 2.5]);
  stroke(g, pathPts([['M', -18, -30], ['Q', -12, -22, -6, -30]]), { lw: 1.4, color: a, seed: sd + 2, amp: 0 });
  stroke(g, pathPts([['M', 18, -30], ['Q', 12, -22, 6, -30]]), { lw: 1.4, color: a, seed: sd + 3, amp: 0 });
  stroke(g, [[-14, -6], [-15, 30]], { lw: 1.4, color: a, seed: sd + 4, amp: 0 });
  stroke(g, [[14, -6], [15, 30]], { lw: 1.4, color: a, seed: sd + 5, amp: 0 });
  g.setLineDash([]);
  rrect(g, -24, 30, 20.5, 8, 2, { fill: tint(c, 0.25), lw: 2.4, seed: sd + 6 });
  rrect(g, 3.5, 30, 20.5, 8, 2, { fill: tint(c, 0.25), lw: 2.4, seed: sd + 7 });
}

// ---------------------------------------------------------------- footwear

function sneaker(g, p, sd, t, high = false) {
  const c = p.c, a = p.a || '#d4473f', s = p.s || '#f4efe6';
  const ghostA = p.ghost ? 0.82 : 1;
  if (ghostA < 1) { g.save(); g.globalAlpha *= ghostA; }
  if (high) {
    F(g, [['M', -32, 14], ['L', -30, -30], ['C', -22, -34, -10, -34, -6, -30], ['L', -2, -8], ['C', 14, -6, 32, 0, 38, 10], ['L', 38, 16], ['L', -32, 16], ['Z']], p, sd, { t });
    ellipse(g, -18, -10, 7, 7, { fill: a, lw: 2.4, seed: sd + 1 });
    for (let i = 0; i < 4; i++) stroke(g, [[-10 + i * 2, -26 + i * 6], [-2 + i * 2, -26 + i * 6]], { lw: 1.8, color: '#fffaf0', seed: sd + 2 + i });
  } else {
    F(g, [['M', -36, 14], ['L', -34, -10], ['C', -26, -16, -12, -16, -6, -10], ['C', 10, -8, 30, -2, 38, 8], ['L', 38, 16], ['L', -36, 16], ['Z']], p, sd, { t });
    for (let i = 0; i < 3; i++) stroke(g, [[-8 + i * 5, -10 + i * 2], [-2 + i * 5, -12 + i * 2]], { lw: 1.8, color: shade(c, 0.5), seed: sd + 2 + i });
  }
  // our stripe: a lightning zigzag
  stroke(g, [[-24, 6], [-6, -2], [4, 4], [24, -4]], { lw: 4, color: a, seed: sd + 8, smooth: false });
  rrect(g, -37, 12, 76, 9, 4, { fill: s, lw: 3, seed: sd + 9 });
  stroke(g, [[-34, 18], [36, 18]], { lw: 1.4, color: rgba('#140f26', 0.4), seed: sd + 10 });
  if (ghostA < 1) g.restore();
}

function boots(g, p, sd, t) {
  const c = p.c || '#8a5a2e', a = p.a || '#ffd23f';
  F(g, [['M', -26, 14], ['L', -26, -34], ['C', -18, -38, -4, -38, 0, -34], ['L', 2, -10], ['C', 18, -8, 32, -2, 36, 8], ['L', 36, 14], ['Z']], { ...p, c }, sd, { t });
  rrect(g, -30, 11, 70, 11, 3, { fill: '#2a2238', lw: 3, seed: sd + 1 });
  for (let i = 0; i < 7; i++) rect(g, -26 + i * 9.5, 19, 5, 4, { fill: '#2a2238', lw: 1.6, amp: 0, seed: sd + 2 + i });
  for (let i = 0; i < 5; i++) {
    stroke(g, [[-16 + i * 1.5, -30 + i * 7], [-4 + i * 1.5, -26 + i * 7]], { lw: 1.8, color: a, seed: sd + 10 + i });
    stroke(g, [[-4 + i * 1.5, -30 + i * 7], [-16 + i * 1.5, -26 + i * 7]], { lw: 1.8, color: a, seed: sd + 20 + i });
  }
  rrect(g, -27, -38, 9, 9, 2, { fill: a, lw: 2, seed: sd + 30 });
  stroke(g, [[-24, 8], [32, 8]], { lw: 1.6, color: rgba('#140f26', 0.45), seed: sd + 31 });
}

function slides(g, p, sd, t) {
  const c = p.c;
  rrect(g, -38, 8, 48, 10, 5, { fill: p.s || '#f4efe6', lw: 3, seed: sd });
  F(g, [['M', -32, 8], ['C', -30, -10, 0, -10, 4, 8], ['Z']], p, sd + 1, { t });
  rrect(g, -6, 18, 48, 10, 5, { fill: p.s || '#f4efe6', lw: 3, seed: sd + 2 });
  F(g, [['M', 0, 18], ['C', 2, 0, 32, 0, 36, 18], ['Z']], p, sd + 3, { t });
  emblem(g, p.g || 'drop', 18, 10, 0.45, '#fffaf0', sd + 4);
  drips(g, -24, 2, 20, c, sd, { count: 2, maxLen: 8, thick: 3 });
}

// ---------------------------------------------------------------- headwear

function cap(g, p, sd, t) {
  const c = p.c, a = p.a || shade(c, 0.4);
  F(g, [['M', -30, 8], ['C', -32, -22, 26, -26, 28, 6], ['Z']], p, sd, { t });
  stroke(g, pathPts([['M', -2, -18], ['Q', 2, -4, 0, 7]]), { lw: 1.8, color: rgba('#140f26', 0.45), seed: sd + 1 });
  dot(g, -1, -18, 2.6, a);
  F(g, [['M', 18, 2], ['C', 30, 0, 44, 6, 46, 14], ['C', 34, 16, 22, 12, 14, 8], ['Z']], p, sd + 2, { color: a, pattern: false, t });
  if (p.g) emblem(g, p.g, -8, -4, 0.62, p.a, sd + 3);
}

function beanie(g, p, sd, t) {
  const c = p.c, a = p.a || shade(c, 0.3);
  F(g, [['M', -28, 12], ['C', -32, -30, 32, -30, 28, 12], ['Z']], p, sd, {
    t,
    inner: (gg) => {
      gg.strokeStyle = rgba('#140f26', 0.3);
      gg.lineWidth = 1.4;
      for (let i = -22; i <= 22; i += 6) { gg.beginPath(); gg.moveTo(i, -16 + Math.abs(i) * 0.25); gg.lineTo(i, 8); gg.stroke(); }
    },
  });
  rrect(g, -30, 4, 60, 16, 5, { fill: a, lw: 3, seed: sd + 1 });
  ellipse(g, 0, -28, 9, 8, { fill: tint(c, 0.3), lw: 2.6, seed: sd + 2, amp: 1.4 });
}

function bucket(g, p, sd, t) {
  const pp = p.p ? p : { ...p, p: 'check', p2: p.a || '#fffaf0' };
  F(g, [['M', -38, 12], ['C', -30, 0, 30, 0, 38, 12], ['C', 30, 18, -30, 18, -38, 12], ['Z']], pp, sd, { t });
  F(g, [['M', -22, 6], ['C', -24, -26, 24, -26, 22, 6], ['Z']], pp, sd + 1, { t });
  rrect(g, -23, 0, 46, 6, 2, { fill: INK, lw: 2, seed: sd + 2 });
}

function fedora(g, p, sd, t) {
  const c = p.c || '#3a3456', a = p.a || '#ff4f9a';
  F(g, [['M', -44, 10], ['C', -30, 0, 30, -2, 46, 8], ['C', 32, 18, -30, 18, -44, 10], ['Z']], { ...p, c: shade(c, 0.12) }, sd, { t });
  F(g, [['M', -24, 6], ['C', -26, -12, -20, -26, -8, -24], ['C', -2, -18, 2, -18, 8, -24], ['C', 20, -26, 26, -12, 24, 6], ['Z']], { ...p, c }, sd + 1, { t });
  rrect(g, -25, -4, 50, 8, 2, { fill: a, lw: 2.6, seed: sd + 2 });
  stroke(g, pathPts([['M', -6, -22], ['Q', 0, -14, 6, -22]]), { lw: 1.8, color: rgba('#140f26', 0.5), seed: sd + 3 });
}

function crown(g, p, sd, t) {
  const c = p.c || GOLD, a = p.a || '#ff4f9a';
  const pp = { ...p, c, finish: p.finish || 'gold' };
  fabric(g, [[-36, 22], [-38, -18], [-20, 2], [-10, -30], [0, -6], [10, -30], [20, 2], [38, -18], [36, 22]], pp, { seed: sd, t, smooth: false, amp: 0.6 });
  rrect(g, -37, 12, 74, 12, 3, { fill: finishFill(g, shade(c, 0.12), 'gold', [-37, 12, 37, 24]), lw: 2.6, seed: sd + 1 });
  for (const [x, y, r] of [[-38, -20, 4], [-10, -32, 4.4], [10, -32, 4.4], [38, -20, 4], [0, 18, 5], [-22, 18, 3.4], [22, 18, 3.4]]) {
    ellipse(g, x, y, r, r, { fill: a, lw: 2, seed: sd + x + 40 });
    dot(g, x - r * 0.3, y - r * 0.35, r * 0.3, rgba('#ffffff', 0.8));
  }
}

function headphones(g, p, sd, t) {
  const c = p.c || '#3ec7b0', a = p.a || '#2a2238';
  tube(g, pathPts([['M', -26, 10], ['C', -30, -44, 30, -44, 26, 10]]), c, 7, { lw: 3, seed: sd });
  for (const s of [-1, 1]) {
    fabric(g, pathPts([['M', s * 20, -2], ['L', s * 38, -2], ['L', s * 38, 28], ['L', s * 20, 28], ['Z']]), p, { seed: sd + (s > 0 ? 2 : 1), t, smooth: true });
    rrect(g, s > 0 ? 18 : -24, 2, 6, 22, 3, { fill: a, lw: 2, seed: sd + 3 + s });
  }
}

function durag(g, p, sd, t) {
  const c = p.c || '#7b5cff', a = p.a || tint(c, 0.4);
  tube(g, pathPts([['M', 12, 8], ['C', 26, 18, 30, 30, 40, 40]]), shade(c, 0.12), 8, { lw: 2.8, seed: sd });
  tube(g, pathPts([['M', 6, 10], ['C', 16, 22, 18, 34, 26, 44]]), shade(c, 0.2), 8, { lw: 2.8, seed: sd + 1 });
  F(g, [['M', -30, 12], ['C', -34, -30, 30, -32, 28, 12], ['C', 14, 6, -14, 6, -30, 12], ['Z']], { ...p, c }, sd + 2, {
    t,
    inner: (gg) => {
      gg.strokeStyle = rgba('#ffffff', 0.35);
      gg.lineWidth = 3;
      gg.beginPath(); gg.moveTo(-18, -12); gg.quadraticCurveTo(-8, -24, 6, -22); gg.stroke();
    },
  });
  stroke(g, pathPts([['M', 0, -26], ['Q', 2, -8, 0, 7]]), { lw: 1.8, color: a, seed: sd + 3 });
}

function halo(g, p, sd, t) {
  const c = p.c || '#fff2a8';
  g.save();
  g.globalCompositeOperation = 'lighter';
  const gr = g.createRadialGradient(0, 0, 4, 0, 0, 48);
  gr.addColorStop(0, rgba(c, 0.55));
  gr.addColorStop(1, rgba(c, 0));
  g.fillStyle = gr;
  g.fillRect(-50, -50, 100, 100);
  g.restore();
  g.save();
  g.translate(0, -2);
  g.lineWidth = 13;
  g.strokeStyle = INK;
  g.beginPath(); g.ellipse(0, 0, 36, 13, 0, 0, Math.PI * 2); g.stroke();
  g.lineWidth = 8;
  g.strokeStyle = finishFill(g, c, p.finish || 'gold', [-36, -13, 36, 13]);
  g.beginPath(); g.ellipse(0, 0, 36, 13, 0, 0, Math.PI * 2); g.stroke();
  g.lineWidth = 2.4;
  g.strokeStyle = 'rgba(255,255,255,0.85)';
  g.beginPath(); g.ellipse(0, -1.5, 33, 10.5, 0, Math.PI * 1.1, Math.PI * 1.75); g.stroke();
  g.restore();
  for (const [x, y, s] of [[-30, -20, 5], [34, -16, 4], [6, 24, 3.4]]) twinkle(g, x, y, s, '#fffaf0');
}

// ---------------------------------------------------------------- face

function shades(g, p, sd, t) {
  const c = p.c || '#140f26', a = p.a || '#3ec7b0';
  const style = p.style || 'round';
  stroke(g, [[-40, -6], [-30, -8]], { lw: 3.6, color: c, seed: sd });
  stroke(g, [[40, -6], [30, -8]], { lw: 3.6, color: c, seed: sd + 1 });
  const lensOpts = (k) => ({ seed: sd + 2 + k, lw: 3.4, line: c, t, color: a, shadeAmt: 0.12 });
  if (style === 'shield') {
    fabric(g, pathPts([['M', -36, -14], ['C', -10, -18, 10, -18, 36, -14], ['C', 34, 6, 22, 12, 6, 6], ['L', 0, 2], ['L', -6, 6], ['C', -22, 12, -34, 6, -36, -14], ['Z']]), p, lensOpts(0));
  } else {
    for (const s of [-1, 1]) {
      let pts;
      if (style === 'star') pts = starPts(s * 17, -2, 15, 7);
      else if (style === 'heart') pts = heartPts(s * 17, -1, 12);
      else pts = pathPts([['M', s * 32, -12], ['L', s * 4, -12], ['C', s * 4, 4, s * 10, 10, s * 18, 10], ['C', s * 28, 10, s * 32, 2, s * 32, -12], ['Z']]);
      fabric(g, pts, p, { ...lensOpts(s > 0 ? 1 : 0), smooth: style !== 'star' });
    }
    stroke(g, [[-4, -10], [4, -10]], { lw: 3.4, color: c, seed: sd + 4 });
  }
  stroke(g, [[-26, -8], [-18, 0]], { lw: 2.4, color: rgba('#ffffff', 0.7), seed: sd + 5 });
  stroke(g, [[10, -8], [18, 0]], { lw: 2.4, color: rgba('#ffffff', 0.7), seed: sd + 6 });
}

function bandana(g, p, sd, t) {
  const c = p.c || '#d4473f', a = p.a || '#fffaf0';
  fabric(g, [[-38, -24], [38, -24], [0, 34]], { ...p, c }, {
    seed: sd, t,
    inner: (gg) => {
      gg.fillStyle = a;
      const r = mulberry32(sd);
      for (let i = 0; i < 18; i++) {
        const x = -30 + r() * 60, y = -20 + r() * 40;
        gg.beginPath(); gg.ellipse(x, y, 2.6, 1.6, r() * 3, 0, Math.PI * 2); gg.fill();
        gg.beginPath(); gg.arc(x + 3, y - 2, 0.9, 0, Math.PI * 2); gg.fill();
      }
      gg.strokeStyle = a;
      gg.lineWidth = 1.6;
      gg.beginPath(); gg.moveTo(-31, -19); gg.lineTo(31, -19); gg.lineTo(0, 26); gg.closePath(); gg.stroke();
    },
  });
}

function visor(g, p, sd, t) {
  const c = p.c || '#2a2238', a = p.a || '#3ef0d8';
  g.save();
  g.globalCompositeOperation = 'lighter';
  const gr = g.createRadialGradient(0, 0, 4, 0, 0, 50);
  gr.addColorStop(0, rgba(a, 0.35));
  gr.addColorStop(1, rgba(a, 0));
  g.fillStyle = gr;
  g.fillRect(-50, -40, 100, 80);
  g.restore();
  fabric(g, pathPts([['M', -44, -12], ['C', -16, -20, 16, -20, 44, -12], ['L', 40, 10], ['C', 14, 4, -14, 4, -40, 10], ['Z']]), p, {
    seed: sd, t, color: a, line: c, lw: 3.6,
    inner: (gg, box) => {
      gg.fillStyle = 'rgba(255,255,255,0.18)';
      for (let y = box[1] + 3; y < box[3]; y += 4) gg.fillRect(box[0], y, box[2] - box[0], 1.2);
      gg.fillStyle = 'rgba(255,255,255,0.55)';
      gg.beginPath(); gg.ellipse(-18, -8, 14, 3, -0.08, 0, Math.PI * 2); gg.fill();
    },
  });
}

function goggles(g, p, sd, t) {
  const c = p.c || '#ff8a3d', a = p.a || '#7b5cff';
  rrect(g, -46, -6, 92, 10, 4, { fill: shade(c, 0.2), lw: 2.6, seed: sd });
  for (const s of [-1, 1]) {
    ellipse(g, s * 18, -1, 19, 16, { fill: c, lw: 3.2, seed: sd + 1 + s, shade: shade(c, 0.25), sdx: 2, sdy: 2 });
    fabric(g, ellipsePts(s * 18, -1, 13.5, 11), p, {
      seed: sd + 4 + s, t, color: a, shadeAmt: 0.1,
      inner: (gg, box) => {
        const gr = gg.createLinearGradient(box[0], box[1], box[2], box[3]);
        gr.addColorStop(0, rgba('#ffffff', 0.45));
        gr.addColorStop(0.5, rgba('#ffffff', 0));
        gr.addColorStop(1, rgba('#ff4f9a', 0.35));
        gg.fillStyle = gr;
        gg.fillRect(box[0], box[1], box[2] - box[0], box[3] - box[1]);
      },
    });
  }
  rrect(g, -4, -6, 8, 8, 2, { fill: c, lw: 2.4, seed: sd + 8 });
}

function grill(g, p, sd, t) {
  const c = p.c || GOLD, a = p.a || '#7ef7ff';
  const pp = { ...p, c, finish: p.finish || 'gold' };
  blob(g, [['M', -40, -10], ['C', -20, -22, 20, -22, 40, -10], ['C', 30, 20, -30, 20, -40, -10], ['Z']], { fill: '#5a1a3a', lw: 3, seed: sd });
  for (let i = 0; i < 8; i++) {
    const x = -31 + i * 8.8;
    const yTop = -14 + Math.abs(i - 3.5) * 1.1;
    fabric(g, pathPts([['M', x - 4, yTop], ['L', x + 4, yTop], ['L', x + 3.4, yTop + 12], ['Q', x, yTop + 14.5, x - 3.4, yTop + 12], ['Z']]), pp, { seed: sd + 1 + i, t, lw: 1.8, shadeAmt: 0.15 });
    fabric(g, pathPts([['M', x - 3.4, 12 - Math.abs(i - 3.5) * 0.9], ['L', x + 3.4, 12 - Math.abs(i - 3.5) * 0.9], ['L', x + 4, 2], ['L', x - 4, 2], ['Z']]), pp, { seed: sd + 20 + i, t, lw: 1.8, shadeAmt: 0.15 });
    if (i === 2 || i === 5) {
      ellipse(g, x, yTop + 6, 2.4, 2.4, { fill: a, lw: 1.2, seed: sd + 40 + i });
      dot(g, x - 0.8, yTop + 5.2, 0.8, '#ffffff');
    }
  }
}

// ---------------------------------------------------------------- neck

function chainLinks(g, pts, c, heavy, sd) {
  for (let i = 0; i < pts.length; i++) {
    const [x, y] = pts[i];
    ellipse(g, x, y, 4.4 * heavy, 3 * heavy, { fill: i % 2 ? c : shade(c, 0.12), lw: 1.8, rot: i * 0.9, seed: sd + i, amp: 0.2 });
  }
}

function medallion(g, x, y, r, p, sd, t) {
  const c = p.c || GOLD;
  fabric(g, ellipsePts(x, y, r, r), { ...p, c, finish: p.finish || 'gold' }, { seed: sd, t });
  ellipse(g, x, y, r * 0.72, r * 0.72, { fill: rgba('#000000', 0), lw: 1.6, line: shade(c, 0.4), seed: sd + 1 });
  emblem(g, p.g || 'drop', x, y, r / 16, p.g === 'token' ? c : shade(c, 0.45), sd + 2);
}

function chain(g, p, sd, t) {
  const c = p.c || GOLD;
  if (p.heavy) return rope(g, p, sd, t);
  chainLinks(g, pathPts([['M', -30, -30], ['C', -30, 10, 30, 10, 30, -30]], 18), c, 1, sd);
  medallion(g, 0, 16, 11, p, sd + 50, t);
}

function rope(g, p, sd, t) {
  const c = p.c || GOLD;
  const pts = pathPts([['M', -32, -34], ['C', -32, 8, 32, 8, 32, -34]], 14);
  for (let i = 0; i < pts.length; i++) {
    const [x, y] = pts[i];
    ellipse(g, x, y, 6.6, 4.2, { fill: i % 2 ? tint(c, 0.15) : shade(c, 0.15), lw: 2, rot: 0.8 + (i % 2) * 0.9, seed: sd + i, amp: 0.2 });
  }
  medallion(g, 0, 20, 17, p, sd + 50, t);
}

function pendant(g, p, sd, t) {
  const c = p.c || '#c8c8e0';
  stroke(g, pathPts([['M', -28, -34], ['C', -26, 2, 26, 2, 28, -34]]), { lw: 2.2, color: '#2a2238', seed: sd });
  fabric(g, dropPts(0, 16, 10, 1.6), { ...p, c }, { seed: sd + 1, t });
  emblem(g, p.g || 'star', 0, 17, 0.42, '#fffaf0', sd + 2);
}

function scarf(g, p, sd, t) {
  const c = p.c || '#e8456b', a = p.a || '#fffaf0';
  const stripes = (gg, box) => {
    gg.fillStyle = a;
    for (let y = box[1] + 4; y < box[3]; y += 10) gg.fillRect(box[0], y, box[2] - box[0], 3.2);
  };
  F(g, [['M', -10, -6], ['L', 2, -6], ['L', 0, 40], ['L', -14, 40], ['Z']], { ...p, c }, sd, { t, inner: stripes, smooth: false });
  for (let i = 0; i < 4; i++) stroke(g, [[-12.5 + i * 3.6, 40], [-12.5 + i * 3.6, 46]], { lw: 1.8, color: c, seed: sd + 10 + i });
  F(g, [['M', -34, -26], ['C', -20, -16, 20, -16, 34, -26], ['L', 34, -8], ['C', 20, 2, -20, 2, -34, -8], ['Z']], { ...p, c }, sd + 1, { t, inner: stripes });
}

// ---------------------------------------------------------------- hand items

function deck(g, p, sd, t) {
  const c = p.c || '#ff4f9a', a = p.a || '#ffd23f';
  g.save();
  g.rotate(-0.5);
  fabric(g, rrectPtsLocal(-14, -46, 28, 92, 14), { ...p, c }, { seed: sd, t });
  emblem(g, p.g || 'drop', 0, -8, 0.8, '#fffaf0', sd + 1);
  text(g, 'DRIP', 0, 26, { size: 10, font: FONTS.drip, fill: a, lw: 2 });
  for (const yy of [-34, 34]) {
    rect(g, -12, yy - 3, 24, 6, { fill: '#c8c8e0', lw: 2, seed: sd + yy });
    ellipse(g, -12, yy, 4, 4, { fill: a, lw: 2, seed: sd + yy + 1 });
    ellipse(g, 12, yy, 4, 4, { fill: a, lw: 2, seed: sd + yy + 2 });
  }
  g.restore();
}

function rrectPtsLocal(x, y, w, h, r) {
  const out = [];
  r = Math.min(r, w / 2, h / 2);
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

function boombox(g, p, sd, t) {
  const c = p.c || '#d4473f', a = p.a || '#3ec7b0';
  stroke(g, pathPts([['M', -30, -24], ['Q', 0, -48, 30, -24]]), { lw: 5, color: '#c8c8e0', seed: sd });
  stroke(g, pathPts([['M', -30, -24], ['Q', 0, -48, 30, -24]]), { lw: 1.6, seed: sd + 1 });
  fabric(g, rrectPtsLocal(-46, -24, 92, 52, 8), { ...p, c }, { seed: sd + 2, t });
  for (const sx of [-26, 26]) {
    ellipse(g, sx, 4, 15, 15, { fill: '#2a2238', lw: 2.6, seed: sd + sx });
    ellipse(g, sx, 4, 6, 6, { fill: '#5a5276', lw: 2, seed: sd + sx + 1 });
  }
  rrect(g, -10, -16, 20, 14, 2, { fill: '#2a2238', lw: 2, seed: sd + 3 });
  rrect(g, -8, -13, 16, 8, 1, { fill: a, lw: 0, seed: sd + 4 });
  for (let i = 0; i < 4; i++) rrect(g, -9 + i * 5, 6, 4, 6, 1, { fill: '#c8c8e0', lw: 1.4, seed: sd + 5 + i });
}

export function sprayCanShape(g, x, y, s, p, sd, t = 0) {
  const c = p.c || '#ff4f9a';
  g.save();
  g.translate(x, y);
  g.scale(s, s);
  fabric(g, rrectPtsLocal(-9, -18, 18, 40, 5), { ...p, c }, { seed: sd, t, lw: 2.6 });
  rrect(g, -9, -6, 18, 12, 1, { fill: '#fffaf0', lw: 2, seed: sd + 1 });
  shape(g, dropPts(0, 1.4, 3.2, 1.7), { fill: c, lw: 1.2, seed: sd + 5 });
  blob(g, [['M', -8, -18], ['C', -6, -28, 6, -28, 8, -18], ['Z']], { fill: '#c8c8e0', lw: 2.4, seed: sd + 2 });
  rrect(g, -3, -30, 6, 6, 1.5, { fill: '#2a2238', lw: 2, seed: sd + 3 });
  g.restore();
}

function spraycan(g, p, sd, t) {
  sprayCanShape(g, 0, 6, 1.7, p, sd, t);
  for (let i = 0; i < 9; i++) dot(g, 10 + i * 3, -42 - (i % 3) * 3 + i * 0.6, 1.4 + (i % 2), rgba(p.c || '#ff4f9a', 0.7));
}

function bag(g, p, sd, t) {
  const c = p.c, a = p.a || '#d4473f';
  stroke(g, pathPts([['M', -26, -4], ['C', -20, -48, 20, -48, 26, -4]]), { lw: 5, color: shade(c, 0.2), seed: sd });
  fabric(g, rrectPtsLocal(-32, -8, 64, 40, 10), p, { seed: sd + 1, t });
  rrect(g, -32, 2, 64, 6, 1, { fill: a, lw: 0, seed: sd + 2 });
  stroke(g, [[-20, 18], [20, 18]], { lw: 2, color: '#c8c8e0', seed: sd + 3 });
  ellipse(g, 18, 18, 3, 3, { fill: '#c8c8e0', lw: 1.6, seed: sd + 4 });
  emblem(g, p.g || 'drop', -16, 20, 0.5, a, sd + 5);
}

function lantern(g, p, sd, t) {
  const c = p.c || '#9affe0';
  stroke(g, pathPts([['M', -12, -38], ['Q', 0, -54, 12, -38]]), { lw: 2.6, color: '#3a3456', seed: sd });
  rrect(g, -18, -38, 36, 8, 2, { fill: '#3a3456', lw: 2.6, seed: sd + 1 });
  g.save();
  g.globalCompositeOperation = 'lighter';
  const gl = g.createRadialGradient(0, 0, 4, 0, 0, 46);
  gl.addColorStop(0, rgba(c, 0.5));
  gl.addColorStop(1, rgba(c, 0));
  g.fillStyle = gl;
  g.fillRect(-50, -50, 100, 100);
  g.restore();
  fabric(g, rrectPtsLocal(-16, -30, 32, 52, 6), { ...p, c: mix(c, '#ffffff', 0.25) }, { seed: sd + 2, t, shadeAmt: 0.1 });
  stroke(g, [[-16, -10], [16, -10]], { lw: 2, color: '#3a3456' });
  stroke(g, [[0, -30], [0, 22]], { lw: 2, color: '#3a3456' });
  blob(g, [['M', 0, -6], ['C', 6, 2, 4, 8, 0, 9], ['C', -4, 8, -6, 2, 0, -6], ['Z']], { fill: '#fffbe0', lw: 1.6, seed: sd + 3 });
  rrect(g, -18, 22, 36, 8, 2, { fill: '#3a3456', lw: 2.6, seed: sd + 4 });
}

// ---------------------------------------------------------------- auras (icons)
// Auras are effects, so their icons sit on a dark glowing disc.

function auraDisc(g, glow, sd) {
  ellipse(g, 0, 0, 44, 44, { fill: '#1b1533', lw: 3, seed: sd });
  g.save();
  g.globalCompositeOperation = 'lighter';
  const gr = g.createRadialGradient(0, 4, 2, 0, 4, 44);
  gr.addColorStop(0, rgba(glow, 0.55));
  gr.addColorStop(1, rgba(glow, 0));
  g.fillStyle = gr;
  g.beginPath(); g.arc(0, 0, 42, 0, Math.PI * 2); g.fill();
  g.restore();
}

function figureMini(g, col = '#fffaf0') {
  // a tiny silhouette so the aura reads as "around you"
  g.fillStyle = rgba(col, 0.9);
  g.beginPath(); g.arc(0, -10, 10, 0, Math.PI * 2); g.fill();
  g.beginPath(); g.moveTo(-8, 2); g.quadraticCurveTo(0, -2, 8, 2); g.lineTo(9, 22); g.lineTo(-9, 22); g.closePath(); g.fill();
}

function sparkleAura(g, p, sd) {
  const c = p.c || '#ffd23f';
  auraDisc(g, c, sd);
  figureMini(g, '#2e2652');
  for (const [x, y, s] of [[-24, -22, 9], [22, -26, 7], [26, 10, 10], [-26, 16, 6], [0, -36, 5], [-6, 30, 5]]) twinkle(g, x, y, s, s > 8 ? '#fffaf0' : c);
}

function flameAura(g, p, sd) {
  const c = p.c || '#ff6a2a', a = p.a || '#ffd23f';
  auraDisc(g, c, sd);
  for (let i = 0; i < 7; i++) {
    const x = -30 + i * 10;
    shape(g, flamePts(x, 30, 16, 40 + (i % 3) * 12, sd + i), { fill: c, lw: 0, seed: sd + i });
    shape(g, flamePts(x, 30, 8, 22 + (i % 2) * 8, sd + i + 20), { fill: a, lw: 0, seed: sd + i + 20 });
  }
  figureMini(g, '#2e2652');
}

function ghostAura(g, p, sd) {
  const c = p.c || '#9affe0';
  auraDisc(g, c, sd);
  for (let i = 0; i < 4; i++) {
    const x = -24 + i * 16;
    g.strokeStyle = rgba(c, 0.6);
    g.lineWidth = 4;
    g.lineCap = 'round';
    g.beginPath(); g.moveTo(x, 30); g.bezierCurveTo(x - 8, 10, x + 8, -6, x, -28 + (i % 2) * 8); g.stroke();
  }
  figureMini(g, rgba('#e8fff6', 0.9));
}

function moneyAura(g, p, sd) {
  auraDisc(g, '#ffd23f', sd);
  figureMini(g, '#2e2652');
  for (const [x, y, s] of [[-24, -24, 0.55], [18, -30, 0.5], [28, 2, 0.6], [-28, 10, 0.5], [-6, -38, 0.42], [10, 26, 0.48], [-16, 30, 0.4]]) emblem(g, 'token', x, y, s, '#ffd23f', sd + Math.round(x));
}

function rainbowAura(g, p, sd) {
  auraDisc(g, '#ff6fd0', sd);
  const cols = ['#ff4f6f', '#ff9a3d', '#ffd23f', '#7ed957', '#3ec7ff', '#9a6bff'];
  g.save();
  g.lineCap = 'round';
  cols.forEach((col, i) => {
    g.strokeStyle = col;
    g.lineWidth = 4.2;
    g.beginPath(); g.arc(0, 18, 36 - i * 4.4, Math.PI * 1.05, Math.PI * 1.95); g.stroke();
  });
  g.restore();
  figureMini(g, '#2e2652');
}

function lightningAura(g, p, sd) {
  const c = p.c || '#7ef7ff';
  auraDisc(g, c, sd);
  figureMini(g, '#2e2652');
  for (const [x, y, s, r] of [[-26, -6, 0.9, -0.3], [26, -10, 0.95, 0.35], [0, -32, 0.7, 0]]) {
    g.save();
    g.translate(x, y);
    g.rotate(r);
    shape(g, [[2, -14], [-9, 2], [-1, 2], [-4, 14], [9, -3], [1, -3], [5, -14]].map(([a, b]) => [a * s, b * s]), { fill: c, lw: 2, smooth: false, seed: sd + x });
    g.restore();
  }
}

// ---------------------------------------------------------------- registry

const DRAW = {
  hoodie, tee, jacket, windbreaker, puffer, jersey,
  cargos, pants: cargos, trackpants, shorts, jeans,
  low: (g, p, sd, t) => sneaker(g, p, sd, t, false),
  high: (g, p, sd, t) => sneaker(g, p, sd, t, true),
  slides, boots,
  cap, beanie, bucket, fedora, crown, headphones, durag, halo,
  shades, bandana, visor, goggles, grill,
  chain, rope, pendant, scarf,
  deck, boombox, spraycan, bag, lantern,
  sparkle: sparkleAura, flame: flameAura, ghostglow: ghostAura, moneyrain: moneyAura, rainbow: rainbowAura, lightning: lightningAura,
};

export const ART_TYPES = Object.keys(DRAW);

export function drawProduct(g, art, x = 0, y = 0, s = 1, seed = 1, t = 0) {
  const fn = DRAW[art.type];
  g.save();
  g.translate(x, y);
  g.scale(s, s);
  if (art.finish === 'ghost') g.globalAlpha *= 0.78;
  if (art.finish === 'glow') {
    g.save();
    g.globalCompositeOperation = 'lighter';
    const gr = g.createRadialGradient(0, 0, 6, 0, 0, 56);
    gr.addColorStop(0, rgba(art.a || art.c || '#ffffff', 0.45));
    gr.addColorStop(1, rgba(art.a || art.c || '#ffffff', 0));
    g.fillStyle = gr;
    g.fillRect(-56, -56, 112, 112);
    g.restore();
  }
  if (fn) fn(g, art, seed, t);
  else rrect(g, -30, -30, 60, 60, 8, { fill: '#5a5276', lw: 3 });
  if (art.prismatic) {
    // foil stars around the item so a prismatic icon reads at a glance
    for (const [px, py, ps] of [[-40, -38, 7], [38, -30, 5.5], [34, 36, 6.5], [-36, 32, 4.5]]) {
      twinkle(g, px, py, ps + 1.6, INK);
      twinkle(g, px, py, ps, `hsl(${(px * 3 + py * 5 + 400) % 360},100%,72%)`);
    }
  }
  g.restore();
}

// Cached item images for the DOM (data URLs). The key covers the whole art
// spec, so recolors, finishes and prismatic variants never collide.
const urlCache = new Map();
export function productImage(product, px = 220) {
  const art = product.art || product;
  const key = `${px}:${product.seed || 7}:${JSON.stringify(art)}`;
  if (urlCache.has(key)) return urlCache.get(key);
  const c = makeCanvas(px, px);
  const g = c.getContext('2d');
  g.scale(px / 110, px / 110);
  g.translate(55, 55);
  drawProduct(g, art, 0, 0, 1, product.seed || 7);
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
