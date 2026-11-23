// 2D UI toolkit for the canvas layer (1280×720 logical units).
// The look: a grounded thriller. Clean sans type (Inter), flat dark panels,
// white text, one restrained amber accent for "this matters / go here", red
// only for danger. No glow, no italics, no slants.
import { input } from './input.js';
import { clamp } from './util.js';

export const W = 1280;
export const H = 720;

export const C = {
  panel: 'rgba(10,12,15,0.80)',
  panel2: 'rgba(16,19,23,0.88)',
  edge: 'rgba(255,255,255,0.08)',
  accent: '#e7a740',
  accentDim: '#8a6a33',
  amber: '#e7a740',
  cyan: '#9dbbd0',
  text: '#eef0f2',
  dim: '#a5adb5',
  faint: '#5c646c',
  red: '#e5534b',
  green: '#7cc48f',
  blue: '#8fb0cc',
  aurora: '#7cc48f',
  violet: '#a99bd1',
};

export const BODY_FONT = 'Inter, "Segoe UI", "Helvetica Neue", Arial, sans-serif';
export const MONO_FONT = '"JetBrains Mono", Consolas, "Lucida Console", "DejaVu Sans Mono", monospace';

// Colours from the old neon palette that still arrive from content (toasts,
// cast colours) land on their grounded equivalents.
const TONE = {
  '#7fe6ff': C.cyan, '#5dffb0': C.green, '#ffd166': C.accent, '#ffb21e': C.accent,
  '#ff4048': C.red, '#ff5a50': C.red, '#9fe8b0': '#a9d4b2', '#d8ffd8': C.text,
  '#bff3ff': C.text, '#4fc3e8': C.cyan, '#3f8fa8': C.accentDim, '#ffd479': '#e9c58a',
  '#ff6a5a': C.red, '#c792ea': '#b9a6e0',
};
export const tone = (c) => (typeof c === 'string' && TONE[c.toLowerCase()]) || c;

const fontOf = (opts, size) => `${opts.italic ? 'italic ' : ''}${weightOf(opts.weight)} ${size}px ${opts.font || BODY_FONT}`;
function weightOf(w) {
  if (w === undefined) return 500;
  if (w >= 800) return 700;
  if (w >= 650) return 600;
  return w;
}

/** Body text. (x, y) is the baseline anchor unless opts.baseline says otherwise. */
export function text(ctx, str, x, y, opts = {}) {
  const size = opts.size || 16;
  ctx.save();
  ctx.font = fontOf(opts, size);
  ctx.textAlign = opts.align || 'left';
  ctx.textBaseline = opts.baseline || 'alphabetic';
  if (opts.alpha !== undefined) ctx.globalAlpha *= opts.alpha;
  if (opts.spacing) {
    try { ctx.letterSpacing = `${opts.spacing}px`; } catch { /* old browsers */ }
  }
  if (opts.shadow !== false) {
    ctx.shadowColor = 'rgba(0,0,0,0.6)';
    ctx.shadowOffsetY = 1;
    ctx.shadowBlur = size > 28 ? 8 : 3;
  }
  ctx.fillStyle = tone(opts.color) || C.text;
  ctx.fillText(str, x, y);
  ctx.restore();
}

export function measure(ctx, str, opts = {}) {
  ctx.save();
  ctx.font = fontOf(opts, opts.size || 16);
  if (opts.spacing) {
    try { ctx.letterSpacing = `${opts.spacing}px`; } catch { /* */ }
  }
  const w = ctx.measureText(str).width;
  ctx.restore();
  return w;
}

/** Word-wrap body text into a box. Returns the y after the last line. */
export function paragraph(ctx, str, x, y, maxW, opts = {}) {
  const size = opts.size || 16;
  const lh = opts.lineHeight || size * 1.4;
  const words = String(str).split(/\s+/);
  let line = '';
  for (const w of words) {
    const test = line ? line + ' ' + w : w;
    if (measure(ctx, test, opts) > maxW && line) {
      text(ctx, line, x, y, opts);
      y += lh;
      line = w;
    } else {
      line = test;
    }
  }
  if (line) { text(ctx, line, x, y, opts); y += lh; }
  return y;
}

// ------------------------------------------------------------- display type
// Titles and labels: uppercase Inter with a little tracking. `size` is the cap
// height in px (the old stroke font's unit), so layouts keep their proportions.
const CAP = 0.727; // Inter's cap height / em
let mctx = null;
function displayFont(size, opts) {
  const w = opts.weight === undefined ? 600 : opts.weight < 0.13 ? 400 : opts.weight < 0.165 ? 500 : opts.weight < 0.2 ? 600 : 700;
  return `${w} ${Math.round((size / CAP) * 10) / 10}px ${opts.font || BODY_FONT}`;
}
const tracking = (size, spacing) => (spacing || 0) + size * 0.06;

/** Width of display text (same arguments as vText). */
export function vWidth(str, size, spacing = 0, opts = {}) {
  if (!mctx) mctx = document.createElement('canvas').getContext('2d');
  mctx.font = displayFont(size, opts);
  const tr = tracking(size, spacing);
  try { mctx.letterSpacing = `${tr}px`; } catch { /* */ }
  const s = String(str).toUpperCase();
  return Math.max(0, mctx.measureText(s).width - tr);
}

/**
 * Display text. (x, y) is the baseline anchor.
 * opts: { align, color, weight (0.12 light … 0.2 bold), spacing (px), alpha, shadow }
 */
export function vText(ctx, str, x, y, size, opts = {}) {
  const s = String(str).toUpperCase();
  const tr = tracking(size, opts.spacing);
  ctx.save();
  if (opts.alpha !== undefined) ctx.globalAlpha *= opts.alpha;
  ctx.font = displayFont(size, opts);
  try { ctx.letterSpacing = `${tr}px`; } catch { /* */ }
  const w = Math.max(0, ctx.measureText(s).width - tr);
  let ox = x;
  if (opts.align === 'center') ox = x - w / 2;
  else if (opts.align === 'right') ox = x - w;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  if (opts.shadow !== false) {
    ctx.shadowColor = 'rgba(0,0,0,0.55)';
    ctx.shadowBlur = Math.max(3, size * 0.25);
    ctx.shadowOffsetY = 1;
  }
  let fill = tone(opts.color) || '#fff';
  if (opts.gradient && !opts.color) fill = tone(opts.gradient[0][1]);
  ctx.fillStyle = fill;
  ctx.fillText(s, ox, y);
  ctx.restore();
  return w;
}

/** Flat panel with a hairline edge and an optional short accent line on top. */
export function panel(ctx, x, y, w, h, opts = {}) {
  ctx.save();
  if (opts.alpha !== undefined) ctx.globalAlpha *= opts.alpha;
  roundRect(ctx, x, y, w, h, opts.radius ?? 6);
  ctx.fillStyle = opts.fill || C.panel;
  ctx.shadowColor = 'rgba(0,0,0,0.35)';
  ctx.shadowBlur = 18;
  ctx.shadowOffsetY = 6;
  ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.strokeStyle = opts.edge || C.edge;
  ctx.lineWidth = 1;
  ctx.stroke();
  if (opts.accent !== false && opts.accent !== undefined) {
    ctx.fillStyle = tone(opts.accent);
    ctx.fillRect(x + 12, y, Math.min(w - 24, opts.accentLen ? Math.min(48, opts.accentLen) : 32), 2);
  }
  ctx.restore();
}

/** Screen header: an uppercase title, a short accent rule, an optional subtitle. */
export function header(ctx, title, sub, x = 64, y = 86, opts = {}) {
  const size = opts.size ? opts.size * 0.75 : 28;
  vText(ctx, title, x, y, size, { color: C.text, weight: 0.17, spacing: 2 });
  ctx.save();
  ctx.fillStyle = tone(opts.color) || C.accent;
  ctx.fillRect(x, y + 14, 40, 2);
  ctx.restore();
  if (sub) text(ctx, sub, x, y + 40, { size: 15, color: C.dim, weight: 400 });
}

// ------------------------------------------------------------------ glyphs

const PAD_GLYPH = {
  confirm: 'cross', back: 'circle', extra: 'square', alt: 'triangle',
  tabL: 'L1', tabR: 'R1', pause: 'OPTIONS', camera: 'R3',
  lr: 'dpadLR', ud: 'dpadUD', stick: 'stick', gas: 'R2', brake: 'L2', handbrake: 'square',
  interact: 'cross', vehicle: 'triangle', jump: 'square', crouch: 'circle', sprint: 'R2',
  phone: 'CREATE', map: 'TOUCHPAD', journal: 'CREATE', skip: 'cross', replay: 'dpadUD',
  choice1: 'cross', choice2: 'circle', choice3: 'square', choice4: 'triangle', move: 'stick', look: 'R-STICK',
  left: 'stick', right: 'stick', up: 'stick', down: 'stick', wait: 'dpadUD', travel: 'triangle',
};
const KEY_LABEL = {
  confirm: 'ENTER', back: 'ESC', extra: 'X', alt: 'F', tabL: 'Q', tabR: 'E', pause: 'ESC',
  camera: 'C', lr: '← →', ud: '↑ ↓', stick: 'ARROWS', gas: 'W', brake: 'S', handbrake: 'SPACE',
  interact: 'E', vehicle: 'F', jump: 'SPACE', crouch: 'C', sprint: 'SHIFT', phone: 'TAB', map: 'M',
  journal: 'J', skip: 'ENTER', replay: 'R', choice1: '1', choice2: '2', choice3: '3', choice4: '4',
  move: 'WASD', look: 'MOUSE', left: 'A', right: 'D', up: 'W', down: 'S', wait: 'T', travel: 'G',
};

export function usingPad() {
  return input.device === 'pad' || (input.padConnected && input.device !== 'keyboard' && input.device !== 'mouse');
}

/** PlayStation-style face/shoulder glyph, flat. */
export function padGlyph(ctx, name, x, y, r = 11) {
  ctx.save();
  ctx.translate(x, y);
  const face = { cross: '#a9c1ee', circle: '#ee9f9f', square: '#e6abd6', triangle: '#97dcc4' };
  if (face[name]) {
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(18,20,24,0.92)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.55)';
    ctx.lineWidth = 1.2;
    ctx.stroke();
    ctx.strokeStyle = face[name];
    ctx.lineWidth = Math.max(1.5, r * 0.15);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    const s = r * 0.46;
    ctx.beginPath();
    if (name === 'cross') { ctx.moveTo(-s, -s); ctx.lineTo(s, s); ctx.moveTo(s, -s); ctx.lineTo(-s, s); }
    if (name === 'circle') ctx.arc(0, 0, s * 1.05, 0, Math.PI * 2);
    if (name === 'square') ctx.rect(-s * 0.9, -s * 0.9, s * 1.8, s * 1.8);
    if (name === 'triangle') { ctx.moveTo(0, -s * 1.1); ctx.lineTo(s * 1.05, s * 0.75); ctx.lineTo(-s * 1.05, s * 0.75); ctx.closePath(); }
    ctx.stroke();
  } else if (name === 'dpadLR' || name === 'dpadUD' || name === 'stick') {
    ctx.fillStyle = 'rgba(18,20,24,0.92)';
    ctx.strokeStyle = 'rgba(255,255,255,0.55)';
    ctx.lineWidth = 1.2;
    if (name === 'stick') {
      ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.arc(0, 0, r * 0.5, 0, Math.PI * 2); ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.fill();
    } else {
      const a = r * 0.36;
      ctx.beginPath();
      ctx.moveTo(-a, -r); ctx.lineTo(a, -r); ctx.lineTo(a, -a); ctx.lineTo(r, -a); ctx.lineTo(r, a); ctx.lineTo(a, a);
      ctx.lineTo(a, r); ctx.lineTo(-a, r); ctx.lineTo(-a, a); ctx.lineTo(-r, a); ctx.lineTo(-r, -a); ctx.lineTo(-a, -a);
      ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#fff';
      const t = r * 0.5;
      ctx.beginPath();
      if (name === 'dpadLR') {
        ctx.moveTo(-r + 2, 0); ctx.lineTo(-r + 2 + t * 0.7, -t * 0.5); ctx.lineTo(-r + 2 + t * 0.7, t * 0.5);
        ctx.moveTo(r - 2, 0); ctx.lineTo(r - 2 - t * 0.7, -t * 0.5); ctx.lineTo(r - 2 - t * 0.7, t * 0.5);
      } else {
        ctx.moveTo(0, -r + 2); ctx.lineTo(-t * 0.5, -r + 2 + t * 0.7); ctx.lineTo(t * 0.5, -r + 2 + t * 0.7);
        ctx.moveTo(0, r - 2); ctx.lineTo(-t * 0.5, r - 2 - t * 0.7); ctx.lineTo(t * 0.5, r - 2 - t * 0.7);
      }
      ctx.fill();
    }
  } else {
    // shoulder / system buttons as pills
    ctx.font = `600 ${Math.round(r * 0.9)}px ${BODY_FONT}`;
    const tw = ctx.measureText(name).width;
    const w = tw + r * 1.2, h = r * 1.7;
    roundRect(ctx, -w / 2, -h / 2, w, h, h * 0.45);
    ctx.fillStyle = 'rgba(18,20,24,0.92)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.55)';
    ctx.lineWidth = 1.2;
    ctx.stroke();
    ctx.fillStyle = '#eef0f2';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(name, 0, 1);
    ctx.restore();
    return w;
  }
  ctx.restore();
  return r * 2;
}

/** A keyboard key: a light rounded box with the label in dark type. */
export function keyCap(ctx, label, x, y, h = 20) {
  ctx.save();
  ctx.font = `600 ${Math.round(h * 0.52)}px ${BODY_FONT}`;
  const w = Math.max(h, ctx.measureText(label).width + h * 0.7);
  roundRect(ctx, x - w / 2, y - h / 2, w, h, 4);
  ctx.fillStyle = 'rgba(238,240,242,0.94)';
  ctx.shadowColor = 'rgba(0,0,0,0.4)';
  ctx.shadowBlur = 4;
  ctx.shadowOffsetY = 1;
  ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.fillStyle = '#121418';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, x, y + 1);
  ctx.restore();
  return w;
}

/** Glyph for an action on the current device. Returns drawn width. */
export function actionGlyph(ctx, action, x, y, size = 11) {
  if (usingPad()) {
    const g = PAD_GLYPH[action] || 'cross';
    const w = padGlyph(ctx, g, x + size, y, size);
    return w || size * 2;
  }
  const lbl = KEY_LABEL[action] || action.toUpperCase();
  const w = measureKey(ctx, lbl, size * 1.8);
  keyCap(ctx, lbl, x + w / 2, y, size * 1.8);
  return w;
}

/** Bottom-right hint row: [[action, label], …] */
export function hints(ctx, items, opts = {}) {
  const y = opts.y ?? H - 34;
  let x = opts.x ?? W - 40;
  const size = 10.5;
  ctx.save();
  for (let i = items.length - 1; i >= 0; i--) {
    const [action, label] = items[i];
    const lbl = label.length > 2 && label === label.toUpperCase() ? label[0] + label.slice(1).toLowerCase() : label;
    const tw = measure(ctx, lbl, { size: 14, weight: 500 });
    text(ctx, lbl, x, y + 5, { size: 14, weight: 500, color: C.text, align: 'right' });
    x -= tw + 9;
    const gw = glyphWidth(ctx, action, size);
    actionGlyph(ctx, action, x - gw, y, size);
    x -= gw + 24;
  }
  ctx.restore();
}

const PILLS = ['L1', 'R1', 'L2', 'R2', 'L3', 'R3', 'OPTIONS', 'CREATE', 'TOUCHPAD', 'R-STICK'];
export function glyphWidth(ctx, action, size = 11) {
  if (usingPad()) {
    const g = PAD_GLYPH[action];
    return g && PILLS.includes(g) ? measureGlyph(ctx, g, size) : size * 2;
  }
  return measureKey(ctx, KEY_LABEL[action] || action.toUpperCase(), size * 1.8);
}

function measureGlyph(ctx, name, r) {
  ctx.save();
  ctx.font = `600 ${Math.round(r * 0.9)}px ${BODY_FONT}`;
  const w = ctx.measureText(name).width + r * 1.2;
  ctx.restore();
  return w;
}
function measureKey(ctx, label, h) {
  ctx.save();
  ctx.font = `600 ${Math.round(h * 0.52)}px ${BODY_FONT}`;
  const w = Math.max(h, ctx.measureText(label).width + h * 0.7);
  ctx.restore();
  return w;
}

export function roundRect(ctx, x, y, w, h, r) {
  r = Math.max(0, Math.min(r, w / 2, h / 2));
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

/** A thin flat meter. opts.compare shows what a change would do (green gain / red loss). */
export function statBar(ctx, x, y, w, h, value, opts = {}) {
  const v = clamp(value, 0, 1);
  const r = Math.min(h / 2, 3);
  ctx.save();
  roundRect(ctx, x, y, w, h, r);
  ctx.fillStyle = 'rgba(255,255,255,0.10)';
  ctx.fill();
  const col = tone(opts.color) || C.accent;
  if (opts.compare !== undefined) {
    const c = clamp(opts.compare, 0, 1);
    const lo = Math.min(v, c), hi = Math.max(v, c);
    if (lo > 0) { roundRect(ctx, x, y, w * lo, h, r); ctx.fillStyle = col; ctx.fill(); }
    if (hi > lo) { ctx.fillStyle = c > v ? C.green : C.red; ctx.fillRect(x + w * lo, y, w * (hi - lo), h); }
  } else if (v > 0) {
    roundRect(ctx, x, y, Math.max(h, w * v), h, r);
    ctx.fillStyle = col;
    ctx.fill();
  }
  ctx.restore();
}

/** Simple hit-region registry for mouse support (cleared each frame). */
export const hit = {
  regions: [],
  hover: null,
  begin() { this.regions.length = 0; },
  add(id, x, y, w, h) { this.regions.push({ id, x, y, w, h }); },
  resolve() {
    const m = input.mouse;
    this.hover = null;
    for (let i = this.regions.length - 1; i >= 0; i--) {
      const r = this.regions[i];
      if (m.x >= r.x && m.x <= r.x + r.w && m.y >= r.y && m.y <= r.y + r.h) { this.hover = r.id; break; }
    }
    return this.hover;
  },
};

/** A small system notice (controller connected, no sound…). */
export function osd(ctx, str, x, y, size = 26, color = C.text, align = 'left') {
  const s = Math.min(15, size * 0.7);
  ctx.save();
  ctx.font = `600 ${s}px ${BODY_FONT}`;
  try { ctx.letterSpacing = '1.5px'; } catch { /* */ }
  const w = ctx.measureText(str).width;
  const bx = align === 'center' ? x - w / 2 : align === 'right' ? x - w : x;
  roundRect(ctx, bx - 12, y - s - 8, w + 24, s + 18, 4);
  ctx.fillStyle = 'rgba(10,12,15,0.78)';
  ctx.fill();
  ctx.fillStyle = tone(color) === '#d8ffd8' ? C.text : tone(color);
  ctx.textAlign = 'left';
  ctx.fillText(str, bx, y);
  ctx.restore();
}
