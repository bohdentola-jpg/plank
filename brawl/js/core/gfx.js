// The drawing kit. Everything in the game is vector art drawn through these
// helpers so it all shares one look: dark outlines of an even weight, flat
// bright fills, one soft highlight, puppet-style limbs.

import { clamp, lerp, TAU } from './util.js';

export const OUT = '#1d1611';     // outline ink: warm near-black
export const LW = 2.3;            // default outline weight

export const FONT = {
  titan: "'Titan One', 'Arial Black', sans-serif",
  carter: "'Carter One', 'Arial Black', sans-serif",
  chewy: "'Chewy', 'Comic Sans MS', cursive",
  bangers: "'Bangers', 'Arial Black', sans-serif",
  comic: "'Comic Neue', 'Comic Sans MS', cursive",
  pixel: "'Silkscreen', monospace",
  hand: "'Schoolbell', 'Comic Sans MS', cursive",
  boog: "'Boogaloo', 'Arial Narrow', sans-serif",
};

// ---------------------------------------------------------------- colour --
const _rgb = new Map();
export function rgb(hex) {
  let c = _rgb.get(hex);
  if (c) return c;
  let h = hex.replace('#', '');
  if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  const n = parseInt(h, 16);
  c = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  _rgb.set(hex, c);
  return c;
}
const hx = (v) => {
  const s = Math.round(clamp(v, 0, 255)).toString(16);
  return s.length < 2 ? '0' + s : s;
};
const _mix = new Map();
export function mix(a, b, t) {
  const key = a + b + ((t * 32) | 0);
  let m = _mix.get(key);
  if (m) return m;
  const ca = rgb(a), cb = rgb(b);
  m = '#' + hx(lerp(ca[0], cb[0], t)) + hx(lerp(ca[1], cb[1], t)) + hx(lerp(ca[2], cb[2], t));
  _mix.set(key, m);
  return m;
}
export const lighten = (c, t = 0.3) => mix(c, '#ffffff', t);
export const darken = (c, t = 0.3) => mix(c, '#000000', t);
export function rgba(hex, a) {
  const c = rgb(hex);
  return `rgba(${c[0]},${c[1]},${c[2]},${a})`;
}

// A fighter's colours live in a palette object. Flashing (hit, charge, invuln)
// is done by swapping in a tinted copy rather than by touching the art code.
const _flash = new WeakMap();
export function tintPalette(pal, color, t) {
  if (t <= 0.01) return pal;
  const q = Math.min(8, Math.round(t * 8));
  let byPal = _flash.get(pal);
  if (!byPal) { byPal = new Map(); _flash.set(pal, byPal); }
  const key = color + q;
  let out = byPal.get(key);
  if (out) return out;
  out = {};
  for (const k in pal) {
    const v = pal[k];
    out[k] = typeof v === 'string' && v[0] === '#' ? mix(v, color, q / 8) : v;
  }
  byPal.set(key, out);
  return out;
}

// ----------------------------------------------------------------- paths --
export function rr(ctx, x, y, w, h, r) {
  r = Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

export function polyPath(ctx, pts, close = true) {
  ctx.beginPath();
  ctx.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
  if (close) ctx.closePath();
}

// Smooth closed curve through points (flat array x,y,x,y...). Good for
// organic bodies: hand-tweak 6-10 points and it reads as hand-drawn.
export function blobPath(ctx, pts, tension = 0.5, close = true) {
  const n = pts.length / 2;
  const P = (i) => {
    const k = close ? ((i % n) + n) % n : clamp(i, 0, n - 1);
    return [pts[k * 2], pts[k * 2 + 1]];
  };
  ctx.beginPath();
  const p0 = P(0);
  ctx.moveTo(p0[0], p0[1]);
  const last = close ? n : n - 1;
  for (let i = 0; i < last; i++) {
    const a = P(i - 1), b = P(i), c = P(i + 1), d = P(i + 2);
    const t = tension / 3 * 2;
    ctx.bezierCurveTo(
      b[0] + (c[0] - a[0]) * t / 2, b[1] + (c[1] - a[1]) * t / 2,
      c[0] - (d[0] - b[0]) * t / 2, c[1] - (d[1] - b[1]) * t / 2,
      c[0], c[1]);
  }
  if (close) ctx.closePath();
}

export function starPath(ctx, x, y, r1, r2, n, rot = -Math.PI / 2) {
  ctx.beginPath();
  for (let i = 0; i < n * 2; i++) {
    const r = i % 2 ? r2 : r1, a = rot + (i * Math.PI) / n;
    const px = x + Math.cos(a) * r, py = y + Math.sin(a) * r;
    if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py);
  }
  ctx.closePath();
}

// Jagged comic-book burst (seeded so it doesn't boil every frame).
export function burstPath(ctx, x, y, r1, r2, n, seed = 1, rot = 0) {
  ctx.beginPath();
  let s = seed * 9301 + 49297;
  const rnd = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
  for (let i = 0; i < n * 2; i++) {
    const j = 0.82 + rnd() * 0.36;
    const r = (i % 2 ? r2 : r1) * j, a = rot + (i * Math.PI) / n;
    const px = x + Math.cos(a) * r, py = y + Math.sin(a) * r;
    if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py);
  }
  ctx.closePath();
}

// fill + outline whatever path is current
export function fs(ctx, fill, stroke = OUT, lw = LW) {
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke && lw > 0) {
    ctx.strokeStyle = stroke; ctx.lineWidth = lw;
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    ctx.stroke();
  }
}

// ---------------------------------------------------------------- shapes --
export function circle(ctx, x, y, r, fill, stroke = OUT, lw = LW) {
  ctx.beginPath(); ctx.arc(x, y, Math.max(0, r), 0, TAU); fs(ctx, fill, stroke, lw);
}
export function ellipse(ctx, x, y, rx, ry, fill, stroke = OUT, lw = LW, rot = 0) {
  ctx.beginPath(); ctx.ellipse(x, y, Math.max(0, rx), Math.max(0, ry), rot, 0, TAU);
  fs(ctx, fill, stroke, lw);
}
export function rrect(ctx, x, y, w, h, r, fill, stroke = OUT, lw = LW) {
  rr(ctx, x, y, w, h, r); fs(ctx, fill, stroke, lw);
}
export function polygon(ctx, pts, fill, stroke = OUT, lw = LW) {
  polyPath(ctx, pts, true); fs(ctx, fill, stroke, lw);
}
export function blob(ctx, pts, fill, stroke = OUT, lw = LW, tension = 0.5) {
  blobPath(ctx, pts, tension, true); fs(ctx, fill, stroke, lw);
}
export function line(ctx, x1, y1, x2, y2, color = OUT, lw = LW) {
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2);
  ctx.strokeStyle = color; ctx.lineWidth = lw; ctx.lineCap = 'round'; ctx.stroke();
}
export function curve(ctx, pts, color = OUT, lw = LW, tension = 0.5) {
  blobPath(ctx, pts, tension, false);
  ctx.strokeStyle = color; ctx.lineWidth = lw; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.stroke();
}
export function star(ctx, x, y, r1, r2, n, fill, stroke = OUT, lw = LW, rot) {
  starPath(ctx, x, y, r1, r2, n, rot); fs(ctx, fill, stroke, lw);
}

// A limb: a fat rounded line with an outline. pts = [x,y,x,y,...]
export function limb(ctx, pts, w, fill, out = OUT, lw = LW) {
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.beginPath(); ctx.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
  if (out && lw > 0) { ctx.strokeStyle = out; ctx.lineWidth = w + lw * 2; ctx.stroke(); }
  ctx.strokeStyle = fill; ctx.lineWidth = w; ctx.stroke();
}
// Same, but one smooth bendy curve (rubber hose).
export function hose(ctx, x1, y1, cx, cy, x2, y2, w, fill, out = OUT, lw = LW) {
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.quadraticCurveTo(cx, cy, x2, y2);
  if (out && lw > 0) { ctx.strokeStyle = out; ctx.lineWidth = w + lw * 2; ctx.stroke(); }
  ctx.strokeStyle = fill; ctx.lineWidth = w; ctx.stroke();
}

// Two-bone IK. Returns the joint position for a limb from (ax,ay) to (tx,ty).
// bend = +1 / -1 picks which way the elbow/knee points.
export function ik2(ax, ay, tx, ty, l1, l2, bend = 1) {
  let dx = tx - ax, dy = ty - ay;
  let d = Math.hypot(dx, dy) || 0.0001;
  const max = l1 + l2 - 0.01;
  if (d > max) { dx *= max / d; dy *= max / d; d = max; }
  const a = Math.atan2(dy, dx);
  const cos = clamp((l1 * l1 + d * d - l2 * l2) / (2 * l1 * d), -1, 1);
  const b = Math.acos(cos) * bend;
  return [ax + Math.cos(a + b) * l1, ay + Math.sin(a + b) * l1, ax + dx, ay + dy];
}

// Soft white highlight, the one bit of shading the art style allows itself.
export function gloss(ctx, x, y, rx, ry, a = 0.35, rot = -0.5) {
  ctx.beginPath(); ctx.ellipse(x, y, rx, ry, rot, 0, TAU);
  ctx.fillStyle = `rgba(255,255,255,${a})`; ctx.fill();
}
export function shadeArc(ctx, x, y, r, a = 0.16) {
  // crescent of shadow on the lower right of a round thing
  ctx.save();
  ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.clip();
  ctx.beginPath(); ctx.arc(x - r * 0.28, y - r * 0.3, r * 1.02, 0, TAU);
  ctx.rect(x + r * 2, y - r * 2, -r * 4, r * 4);
  ctx.fillStyle = `rgba(0,0,0,${a})`; ctx.fill('evenodd');
  ctx.restore();
}

// ----------------------------------------------------------------- faces --
// ex: 0 normal, 1 angry, 2 hurt (> <), 3 happy (^ ^), 4 dizzy, 5 closed, 6 shocked
export function eye(ctx, x, y, r, ex = 0, lx = 0, ly = 0, side = 1, opt = {}) {
  const white = opt.white || '#ffffff', pupil = opt.pupil || OUT, lw = opt.lw || 2;
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  if (ex === 2) {           // > <
    ctx.beginPath();
    ctx.moveTo(x - r * 0.7 * side, y - r * 0.7); ctx.lineTo(x + r * 0.5 * side, y);
    ctx.lineTo(x - r * 0.7 * side, y + r * 0.7);
    ctx.strokeStyle = pupil; ctx.lineWidth = lw + 0.6; ctx.stroke();
    return;
  }
  if (ex === 3) {           // ^ ^
    ctx.beginPath(); ctx.arc(x, y + r * 0.35, r * 0.75, Math.PI * 1.1, Math.PI * 1.9);
    ctx.strokeStyle = pupil; ctx.lineWidth = lw + 0.6; ctx.stroke();
    return;
  }
  if (ex === 5) {           // closed
    ctx.beginPath(); ctx.moveTo(x - r * 0.75, y); ctx.lineTo(x + r * 0.75, y);
    ctx.strokeStyle = pupil; ctx.lineWidth = lw + 0.6; ctx.stroke();
    return;
  }
  const ry = opt.tall ? r * 1.25 : r;
  ctx.beginPath(); ctx.ellipse(x, y, r, ry, 0, 0, TAU);
  ctx.fillStyle = white; ctx.fill();
  ctx.strokeStyle = OUT; ctx.lineWidth = lw; ctx.stroke();
  if (ex === 4) {           // dizzy swirl
    ctx.beginPath();
    for (let i = 0; i <= 14; i++) {
      const a = i * 0.9 + (opt.t || 0) * 0.3, rr2 = (i / 14) * r * 0.75;
      const px = x + Math.cos(a) * rr2, py = y + Math.sin(a) * rr2;
      if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py);
    }
    ctx.strokeStyle = pupil; ctx.lineWidth = 1.4; ctx.stroke();
    return;
  }
  const pr = ex === 6 ? r * 0.22 : r * (opt.pr || 0.45);
  const m = r - pr - 0.8;
  ctx.beginPath();
  ctx.arc(x + clamp(lx, -1, 1) * m, y + clamp(ly, -1, 1) * (ry - pr - 0.8), pr, 0, TAU);
  ctx.fillStyle = pupil; ctx.fill();
  if (pr > 2.2) {
    ctx.beginPath();
    ctx.arc(x + clamp(lx, -1, 1) * m - pr * 0.3, y + clamp(ly, -1, 1) * (ry - pr - 0.8) - pr * 0.35, pr * 0.3, 0, TAU);
    ctx.fillStyle = '#ffffff'; ctx.fill();
  }
  if (ex === 1) {           // angry: a brow slashing down toward the nose
    ctx.beginPath();
    ctx.moveTo(x - r * 1.15 * side, y - ry * 1.25);
    ctx.lineTo(x + r * 1.05 * side, y - ry * 0.45);
    ctx.strokeStyle = opt.brow || OUT; ctx.lineWidth = lw + 1.2; ctx.stroke();
  }
}

// A pair of eyes around (x,y). side=+1 means the "nose" is to the right of
// the left eye, i.e. brows tilt toward the middle.
export function eyes(ctx, x, y, r, gap, ex = 0, lx = 0, ly = 0, opt) {
  eye(ctx, x - gap, y, r, ex, lx, ly, 1, opt);
  eye(ctx, x + gap, y, r, ex, lx, ly, -1, opt);
}

// mouth kinds: 0 small smile, 1 gritted/angry, 2 open "o" (hurt), 3 big grin, 4 wobbly, 5 flat
export function mouth(ctx, x, y, w, kind = 0, opt = {}) {
  const col = opt.color || OUT, lw = opt.lw || 2;
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.strokeStyle = col; ctx.lineWidth = lw;
  ctx.beginPath();
  if (kind === 0) { ctx.arc(x, y - w * 0.35, w * 0.6, Math.PI * 0.2, Math.PI * 0.8); ctx.stroke(); }
  else if (kind === 1) {
    rr(ctx, x - w / 2, y - w * 0.22, w, w * 0.44, w * 0.12);
    ctx.fillStyle = '#ffffff'; ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x - w / 2, y); ctx.lineTo(x + w / 2, y);
    ctx.moveTo(x, y - w * 0.22); ctx.lineTo(x, y + w * 0.22); ctx.lineWidth = 1.2; ctx.stroke();
  } else if (kind === 2) {
    ctx.ellipse(x, y, w * 0.3, w * 0.4, 0, 0, TAU);
    ctx.fillStyle = opt.inside || '#7a1f25'; ctx.fill(); ctx.stroke();
  } else if (kind === 3) {
    ctx.moveTo(x - w / 2, y - w * 0.12);
    ctx.quadraticCurveTo(x, y + w * 0.7, x + w / 2, y - w * 0.12);
    ctx.closePath();
    ctx.fillStyle = opt.inside || '#7a1f25'; ctx.fill(); ctx.stroke();
  } else if (kind === 4) {
    ctx.moveTo(x - w / 2, y);
    ctx.quadraticCurveTo(x - w / 4, y - w * 0.3, x, y);
    ctx.quadraticCurveTo(x + w / 4, y + w * 0.3, x + w / 2, y);
    ctx.stroke();
  } else { ctx.moveTo(x - w / 2, y); ctx.lineTo(x + w / 2, y); ctx.stroke(); }
}

// ------------------------------------------------------------------ text --
// One call for all lettering: thick outline, optional two-tone fill, a hard
// drop shadow. That stack is most of what makes a title read as "Flash game".
export function txt(ctx, s, x, y, o = {}) {
  const size = o.size || 20;
  ctx.save();
  ctx.font = `${size}px ${FONT[o.font || 'titan']}`;
  ctx.textAlign = o.align || 'center';
  ctx.textBaseline = o.base || 'middle';
  ctx.lineJoin = 'round'; ctx.miterLimit = 2;
  s = String(s);
  if (o.rot || o.sx || o.maxW) {
    ctx.translate(x, y);
    if (o.rot) ctx.rotate(o.rot);
    let sx = o.sx || 1;
    if (o.maxW) { const w = ctx.measureText(s).width; if (w * sx > o.maxW) sx = o.maxW / w; }
    ctx.scale(sx, o.sy || 1);
    x = 0; y = 0;
  }
  const lw = o.lw === undefined ? Math.max(2, size * 0.16) : o.lw;
  const stroke = o.stroke === undefined ? OUT : o.stroke;
  if (o.shadow) {
    const dy = typeof o.shadow === 'number' ? o.shadow : Math.max(2, size * 0.09);
    ctx.fillStyle = o.shadowColor || OUT;
    if (stroke && lw > 0) { ctx.strokeStyle = o.shadowColor || OUT; ctx.lineWidth = lw; ctx.strokeText(s, x, y + dy); }
    ctx.fillText(s, x, y + dy);
  }
  if (stroke && lw > 0) {
    if (o.stroke2) { ctx.strokeStyle = o.stroke2; ctx.lineWidth = lw + (o.lw2 || 5); ctx.strokeText(s, x, y); }
    ctx.strokeStyle = stroke; ctx.lineWidth = lw; ctx.strokeText(s, x, y);
  }
  let fill = o.fill || '#ffffff';
  if (Array.isArray(fill)) {
    const g = ctx.createLinearGradient(0, y - size * 0.5, 0, y + size * 0.45);
    g.addColorStop(0, fill[0]); g.addColorStop(o.gradMid || 0.55, fill[0]);
    g.addColorStop((o.gradMid || 0.55) + 0.02, fill[1]); g.addColorStop(1, fill[1]);
    fill = g;
  }
  ctx.fillStyle = fill; ctx.fillText(s, x, y);
  ctx.restore();
}
export function textW(ctx, s, size, font = 'titan') {
  ctx.save(); ctx.font = `${size}px ${FONT[font]}`;
  const w = ctx.measureText(String(s)).width; ctx.restore();
  return w;
}
// word-wrapped paragraph, returns the y after the last line
export function para(ctx, s, x, y, maxW, o = {}) {
  const size = o.size || 15, lh = o.lh || size * 1.25;
  ctx.save(); ctx.font = `${size}px ${FONT[o.font || 'comic']}`;
  const lines = [];
  for (const raw of String(s).split('\n')) {
    let cur = '';
    for (const word of raw.split(' ')) {
      const t = cur ? cur + ' ' + word : word;
      if (ctx.measureText(t).width > maxW && cur) { lines.push(cur); cur = word; } else cur = t;
    }
    lines.push(cur);
  }
  ctx.restore();
  for (const l of lines) {
    txt(ctx, l, x, y, Object.assign({ font: 'comic', lw: 0, stroke: null, fill: OUT, align: 'left', base: 'top' }, o, { size }));
    y += lh;
  }
  return y;
}

// -------------------------------------------------------------------- UI --
// The glossy candy button. state: 0 idle, 1 focused, 2 pressed
export function button(ctx, x, y, w, h, label, state = 0, o = {}) {
  const base = o.color || '#ff9d1c';
  const top = lighten(base, 0.28), bot = darken(base, 0.14);
  const py = state === 2 ? 2 : 0;
  ctx.save();
  if (state === 1 && o.pulse) {
    const s = 1 + Math.sin(o.pulse * 0.18) * 0.02;
    ctx.translate(x + w / 2, y + h / 2); ctx.scale(s, s); ctx.translate(-(x + w / 2), -(y + h / 2));
  }
  // hard shadow
  if (state !== 2) { rr(ctx, x, y + 5, w, h, h * 0.42); ctx.fillStyle = OUT; ctx.fill(); }
  const g = ctx.createLinearGradient(0, y + py, 0, y + h + py);
  g.addColorStop(0, top); g.addColorStop(0.5, base); g.addColorStop(1, bot);
  rr(ctx, x, y + py, w, h, h * 0.42); fs(ctx, g, OUT, 3);
  // gloss band
  ctx.save();
  rr(ctx, x + 4, y + py + 3, w - 8, h * 0.42, h * 0.3);
  ctx.fillStyle = 'rgba(255,255,255,0.32)'; ctx.fill();
  ctx.restore();
  if (state === 1) {
    rr(ctx, x - 4, y + py - 4, w + 8, h + 8, h * 0.5);
    ctx.strokeStyle = o.ring || '#ffffff'; ctx.lineWidth = 3; ctx.stroke();
  }
  txt(ctx, label, x + w / 2, y + h / 2 + py + 1, {
    font: o.font || 'titan', size: o.size || Math.round(h * 0.5), fill: o.text || '#ffffff',
    lw: o.tlw || Math.max(3, h * 0.09), shadow: 2, maxW: w - 18,
  });
  ctx.restore();
}

export function panel(ctx, x, y, w, h, o = {}) {
  const r = o.r === undefined ? 12 : o.r;
  if (o.shadow !== false) { rr(ctx, x + 4, y + 5, w, h, r); ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fill(); }
  rr(ctx, x, y, w, h, r); fs(ctx, o.fill || '#fff7e0', o.stroke === undefined ? OUT : o.stroke, o.lw || 3);
  if (o.inner) {
    rr(ctx, x + 5, y + 5, w - 10, h - 10, Math.max(2, r - 4));
    ctx.strokeStyle = o.inner; ctx.lineWidth = 2; ctx.stroke();
  }
}

// rotating two-tone rays, the stock Flash title-screen backdrop
export function rays(ctx, x, y, r, n, rot, a, b) {
  ctx.fillStyle = a; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
  ctx.fillStyle = b;
  const step = TAU / n;
  for (let i = 0; i < n; i += 2) {
    ctx.beginPath(); ctx.moveTo(x, y);
    ctx.arc(x, y, r, rot + i * step, rot + (i + 1) * step); ctx.closePath(); ctx.fill();
  }
}

// --------------------------------------------------------------- patterns --
const _pat = new Map();
function makeCanvas(w, h) {
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(w, h);
  const c = document.createElement('canvas'); c.width = w; c.height = h; return c;
}
export function pattern(ctx, key, w, h, drawFn) {
  let p = _pat.get(key);
  if (p) return p;
  const c = makeCanvas(w, h);
  drawFn(c.getContext('2d'), w, h);
  p = ctx.createPattern(c, 'repeat');
  _pat.set(key, p);
  return p;
}
export const dots = (ctx, color, bg, size = 12, r = 2.2) =>
  pattern(ctx, 'dots' + color + bg + size + r, size, size, (c) => {
    if (bg) { c.fillStyle = bg; c.fillRect(0, 0, size, size); }
    c.fillStyle = color;
    c.beginPath(); c.arc(size / 4, size / 4, r, 0, TAU); c.fill();
    c.beginPath(); c.arc(size * 0.75, size * 0.75, r, 0, TAU); c.fill();
  });
export const stripes = (ctx, a, b, size = 16) =>
  pattern(ctx, 'str' + a + b + size, size, size, (c) => {
    c.fillStyle = a; c.fillRect(0, 0, size, size);
    c.fillStyle = b; c.beginPath();
    c.moveTo(0, size); c.lineTo(size / 2, size); c.lineTo(size, size / 2); c.lineTo(size, 0);
    c.lineTo(size / 2, 0); c.lineTo(0, size / 2); c.closePath(); c.fill();
  });
export const checker = (ctx, a, b, size = 16) =>
  pattern(ctx, 'chk' + a + b + size, size * 2, size * 2, (c) => {
    c.fillStyle = a; c.fillRect(0, 0, size * 2, size * 2);
    c.fillStyle = b; c.fillRect(0, 0, size, size); c.fillRect(size, size, size, size);
  });

// vertical gradient fill of a rect, used for every sky in the game
export function vgrad(ctx, x, y, w, h, stops) {
  const g = ctx.createLinearGradient(0, y, 0, y + h);
  const n = stops.length - 1;
  stops.forEach((c, i) => g.addColorStop(i / n, c));
  ctx.fillStyle = g; ctx.fillRect(x, y, w, h);
}

// puffy cartoon cloud, flat bottom
export function cloud(ctx, x, y, s, fill = '#ffffff', stroke = null, lw = 2) {
  ctx.beginPath();
  ctx.moveTo(x - 38 * s, y);
  ctx.arc(x - 26 * s, y - 6 * s, 14 * s, Math.PI * 0.75, Math.PI * 1.55);
  ctx.arc(x - 6 * s, y - 16 * s, 18 * s, Math.PI * 1.1, Math.PI * 1.8);
  ctx.arc(x + 16 * s, y - 10 * s, 15 * s, Math.PI * 1.35, Math.PI * 1.95);
  ctx.arc(x + 30 * s, y - 2 * s, 10 * s, Math.PI * 1.5, Math.PI * 0.3);
  ctx.lineTo(x - 38 * s, y + 4 * s);
  ctx.closePath();
  fs(ctx, fill, stroke, lw);
}

// ground shadow blob under things
export function shadow(ctx, x, y, rx, a = 0.22) {
  ctx.beginPath(); ctx.ellipse(x, y, Math.max(1, rx), Math.max(1, rx * 0.24), 0, 0, TAU);
  ctx.fillStyle = `rgba(0,0,0,${a})`; ctx.fill();
}
