// 2D UI toolkit for the canvas layer (1024×768 logical units). Mid-2000s
// console look: slanted smoked-glass panels in graphite, HARD COUNT red with
// broadcast gold, heavy varsity block display type (font.js), condensed
// gothic body copy, controller glyphs that match the device in use.
import { vText, vWidth } from './font.js';
import { input } from './input.js';
import { clamp } from './util.js';

export const W = 1024;
export const H = 768;

export const C = {
  panel: 'rgba(11,11,13,0.82)',
  panel2: 'rgba(20,20,24,0.88)',
  edge: 'rgba(235,235,245,0.16)',
  accent: '#ff3a2c',
  accentDim: '#9c1f15',
  gold: '#ffd23a',
  text: '#eef1f7',
  dim: '#8c95a8',
  faint: '#4a5266',
  red: '#ff3d52',
  green: '#4dff8b',
  blue: '#5aa9ff',
};

// a condensed sports gothic: Franklin Gothic ships with Windows, Arial Narrow with macOS
export const BODY_FONT = '"Franklin Gothic Medium", "Franklin Gothic", "Arial Narrow", "Roboto Condensed", "Liberation Sans Narrow", "Helvetica Neue", Arial, sans-serif';
export const MONO_FONT = '"Consolas", "Lucida Console", "DejaVu Sans Mono", "Courier New", monospace';

export { vText, vWidth };

/** System-font text (body copy, small labels). */
export function text(ctx, str, x, y, opts = {}) {
  const size = opts.size || 16;
  ctx.save();
  ctx.font = `${opts.italic ? 'italic ' : ''}${opts.weight || 600} ${size}px ${opts.font || BODY_FONT}`;
  ctx.textAlign = opts.align || 'left';
  ctx.textBaseline = opts.baseline || 'alphabetic';
  if (opts.alpha !== undefined) ctx.globalAlpha *= opts.alpha;
  if (opts.spacing) {
    try { ctx.letterSpacing = `${opts.spacing}px`; } catch { /* old browsers */ }
  }
  if (opts.shadow !== false) {
    ctx.shadowColor = 'rgba(0,0,0,0.85)';
    ctx.shadowOffsetY = 1.5;
    ctx.shadowBlur = 2;
  }
  if (opts.glow) {
    ctx.shadowColor = opts.glowColor || opts.color || '#fff';
    ctx.shadowBlur = opts.glow;
    ctx.shadowOffsetY = 0;
  }
  ctx.fillStyle = opts.color || C.text;
  ctx.fillText(str, x, y);
  ctx.restore();
}

export function measure(ctx, str, opts = {}) {
  ctx.save();
  ctx.font = `${opts.italic ? 'italic ' : ''}${opts.weight || 600} ${opts.size || 16}px ${opts.font || BODY_FONT}`;
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
  const lh = opts.lineHeight || size * 1.35;
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

/** Slanted smoked-glass panel. */
export function panel(ctx, x, y, w, h, opts = {}) {
  const sk = opts.skew ?? Math.min(18, h * 0.18);
  ctx.save();
  if (opts.alpha !== undefined) ctx.globalAlpha *= opts.alpha;
  ctx.beginPath();
  ctx.moveTo(x + sk, y);
  ctx.lineTo(x + w, y);
  ctx.lineTo(x + w - sk, y + h);
  ctx.lineTo(x, y + h);
  ctx.closePath();
  const g = ctx.createLinearGradient(0, y, 0, y + h);
  g.addColorStop(0, opts.fillTop || 'rgba(30,30,34,0.88)');
  g.addColorStop(1, opts.fill || C.panel);
  ctx.fillStyle = g;
  ctx.shadowColor = 'rgba(0,0,0,0.55)';
  ctx.shadowBlur = 14;
  ctx.shadowOffsetY = 4;
  ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.strokeStyle = opts.edge || C.edge;
  ctx.lineWidth = 1;
  ctx.stroke();
  if (opts.accent !== false) {
    ctx.beginPath();
    ctx.moveTo(x + sk, y + 0.5);
    ctx.lineTo(x + Math.min(w, sk + (opts.accentLen || w * 0.4)), y + 0.5);
    ctx.strokeStyle = opts.accent || C.accent;
    ctx.lineWidth = 2;
    ctx.stroke();
  }
  ctx.restore();
}

/** Jersey-twill lettering: white block letters, a red tackle-twill border, a black edge. */
export function twill(ctx, str, x, y, size, opts = {}) {
  const base = { align: opts.align, weight: opts.weight ?? 0.17, spacing: opts.spacing, skew: opts.skew };
  vText(ctx, str, x, y, size, { ...base, color: '#000', outline: size * 0.16, outlineColor: 'rgba(0,0,0,0.85)', shadow: [size * 0.06, size * 0.09, 'rgba(0,0,0,0.55)'] });
  vText(ctx, str, x, y, size, { ...base, color: opts.color || '#ffffff', outline: size * 0.075, outlineColor: opts.trim || C.accent });
}

/** A red tag with white type under a title, like a network bug; returns its width. */
export function tag(ctx, str, x, y, opts = {}) {
  const size = opts.size || 15;
  const w = measure(ctx, str, { size, weight: 900, spacing: 5 }) + 26;
  const h = size + 7;
  ctx.save();
  ctx.fillStyle = opts.color || C.accent;
  ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + w, y); ctx.lineTo(x + w - 6, y + h); ctx.lineTo(x - 6, y + h); ctx.closePath(); ctx.fill();
  ctx.fillStyle = C.gold;
  ctx.beginPath(); ctx.moveTo(x + w + 2, y); ctx.lineTo(x + w + 8, y); ctx.lineTo(x + w + 2, y + h); ctx.lineTo(x + w - 4, y + h); ctx.closePath(); ctx.fill();
  ctx.restore();
  text(ctx, str, x + 8, y + h - 5, { size, weight: 900, color: '#ffffff', spacing: 5 });
  return w;
}

/** Two sleeve stripes under a title: red, then a thin gold one. */
export function stripes(ctx, x, y, w, opts = {}) {
  ctx.save();
  const fade = (col, a) => {
    const g = ctx.createLinearGradient(x, 0, x + w, 0);
    g.addColorStop(0, col);
    g.addColorStop(0.75, col);
    g.addColorStop(1, a);
    return g;
  };
  ctx.fillStyle = fade(opts.color || C.accent, 'rgba(255,58,44,0)');
  ctx.fillRect(x, y, w, opts.h || 5);
  ctx.fillStyle = fade(C.gold, 'rgba(255,210,58,0)');
  ctx.fillRect(x, y + (opts.h || 5) + 3, w * 0.8, 2);
  ctx.restore();
}

/** Header strip: big block title over two sleeve stripes. */
export function header(ctx, title, sub, x = 64, y = 86, opts = {}) {
  vText(ctx, title, x, y, opts.size || 40, {
    color: C.text, weight: 0.16, outline: 3, outlineColor: 'rgba(0,0,0,0.75)', shadow: [3, 4, 'rgba(0,0,0,0.6)'],
  });
  const w = vWidth(title, opts.size || 40);
  stripes(ctx, x - 4, y + 9, w + 260, { color: opts.color });
  if (sub) text(ctx, sub, x + 2, y + 38, { size: 15, color: C.dim, weight: 600, spacing: 2 });
}

// ------------------------------------------------------------------ glyphs

// menu actions → the pad button that does them
const PAD_GLYPH = {
  confirm: 'cross', back: 'circle', extra: 'square', alt: 'triangle',
  tabL: 'L1', tabR: 'R1', pause: 'OPTIONS', lr: 'dpadLR', ud: 'dpadUD', stick: 'stick', rstick: 'rstick',
};
const KEY_LABEL = {
  confirm: 'ENTER', back: 'ESC', extra: 'J', alt: 'I', tabL: 'Q', tabR: 'E', pause: 'ESC',
  lr: '← →', ud: '↑ ↓', stick: 'WASD', rstick: 'ARROWS',
};
// pad buttons (play) → glyph name / keyboard label
const BTN_GLYPH = {
  cross: 'cross', circle: 'circle', square: 'square', triangle: 'triangle',
  l1: 'L1', r1: 'R1', l2: 'L2', r2: 'R2', create: 'CREATE', options: 'OPTIONS', l3: 'L3', r3: 'R3',
  touch: 'TOUCHPAD', dup: 'dpadUD', ddown: 'dpadUD', dleft: 'dpadLR', dright: 'dpadLR', stick: 'stick', rstick: 'rstick',
};
const BTN_KEY = {
  cross: 'K', circle: 'L', square: 'J', triangle: 'I', l1: 'Q', r1: 'E', l2: 'Z', r2: 'SHIFT',
  create: 'R', options: 'ESC', l3: 'C', r3: 'V', touch: 'T', dup: '↑', ddown: '↓', dleft: '←', dright: '→',
  stick: 'WASD', rstick: 'ARROWS',
};

export function usingPad() {
  return input.device === 'pad' || (input.padConnected && input.device !== 'keyboard' && input.device !== 'mouse');
}

/** PlayStation-style face/shoulder glyph. */
export function padGlyph(ctx, name, x, y, r = 11) {
  ctx.save();
  ctx.translate(x, y);
  const face = { cross: '#8fb4ff', circle: '#ff7a7a', square: '#ff9be0', triangle: '#5ee8be' };
  if (face[name]) {
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    const g = ctx.createRadialGradient(-r * 0.3, -r * 0.4, 1, 0, 0, r);
    g.addColorStop(0, '#3a3f4b');
    g.addColorStop(1, '#14161b');
    ctx.fillStyle = g;
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.strokeStyle = face[name];
    ctx.lineWidth = Math.max(1.6, r * 0.17);
    ctx.lineCap = 'round';
    const s = r * 0.48;
    ctx.beginPath();
    if (name === 'cross') { ctx.moveTo(-s, -s); ctx.lineTo(s, s); ctx.moveTo(s, -s); ctx.lineTo(-s, s); }
    if (name === 'circle') ctx.arc(0, 0, s * 1.05, 0, Math.PI * 2);
    if (name === 'square') ctx.rect(-s * 0.9, -s * 0.9, s * 1.8, s * 1.8);
    if (name === 'triangle') { ctx.moveTo(0, -s * 1.1); ctx.lineTo(s * 1.05, s * 0.75); ctx.lineTo(-s * 1.05, s * 0.75); ctx.closePath(); }
    ctx.stroke();
  } else if (name === 'dpadLR' || name === 'dpadUD' || name === 'stick' || name === 'rstick') {
    ctx.fillStyle = '#1b1e25';
    ctx.strokeStyle = 'rgba(255,255,255,0.3)';
    ctx.lineWidth = 1;
    if (name === 'stick' || name === 'rstick') {
      ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.arc(0, 0, r * 0.55, 0, Math.PI * 2); ctx.fillStyle = '#2c313c'; ctx.fill();
      ctx.fillStyle = '#dfe4ee';
      ctx.font = `800 ${Math.round(r * 0.8)}px ${BODY_FONT}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(name === 'stick' ? 'L' : 'R', 0, 1);
    } else {
      const a = r * 0.36;
      ctx.beginPath();
      ctx.moveTo(-a, -r); ctx.lineTo(a, -r); ctx.lineTo(a, -a); ctx.lineTo(r, -a); ctx.lineTo(r, a); ctx.lineTo(a, a);
      ctx.lineTo(a, r); ctx.lineTo(-a, r); ctx.lineTo(-a, a); ctx.lineTo(-r, a); ctx.lineTo(-r, -a); ctx.lineTo(-a, -a);
      ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = C.accent;
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
    // shoulder / system buttons as rounded pills
    ctx.font = `700 ${Math.round(r * 0.95)}px ${BODY_FONT}`;
    const tw = ctx.measureText(name).width;
    const w = tw + r * 1.1, h = r * 1.7;
    roundRect(ctx, -w / 2, -h / 2, w, h, h * 0.4);
    const g = ctx.createLinearGradient(0, -h / 2, 0, h / 2);
    g.addColorStop(0, '#3a3f4b');
    g.addColorStop(1, '#16181e');
    ctx.fillStyle = g;
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.28)';
    ctx.stroke();
    ctx.fillStyle = '#dfe4ee';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(name, 0, 1);
    ctx.restore();
    return w;
  }
  ctx.restore();
  return r * 2;
}

export function keyCap(ctx, label, x, y, h = 20) {
  ctx.save();
  ctx.font = `700 ${Math.round(h * 0.55)}px ${BODY_FONT}`;
  const w = Math.max(h, ctx.measureText(label).width + h * 0.7);
  roundRect(ctx, x - w / 2, y - h / 2, w, h, 4);
  const g = ctx.createLinearGradient(0, y - h / 2, 0, y + h / 2);
  g.addColorStop(0, '#e9ecf2');
  g.addColorStop(1, '#a9aeb8');
  ctx.fillStyle = g;
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.6)';
  ctx.stroke();
  ctx.fillStyle = '#15171c';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, x, y + 1);
  ctx.restore();
  return w;
}

function glyphWidth(ctx, pad, size) {
  if (['L1', 'R1', 'L2', 'R2', 'L3', 'R3', 'OPTIONS', 'CREATE', 'TOUCHPAD'].includes(pad)) return measureGlyph(ctx, pad, size);
  return size * 2;
}

/** Glyph for a menu action on the current device. Returns drawn width. */
export function actionGlyph(ctx, action, x, y, size = 11) {
  if (usingPad()) {
    const g = PAD_GLYPH[action] || BTN_GLYPH[action] || 'cross';
    const w = glyphWidth(ctx, g, size);
    padGlyph(ctx, g, x + w / 2, y, size);
    return w;
  }
  const lbl = KEY_LABEL[action] || BTN_KEY[action] || action.toUpperCase();
  const w = measureKey(ctx, lbl, size * 1.8);
  keyCap(ctx, lbl, x + w / 2, y, size * 1.8);
  return w;
}

/** Glyph for a pad button (cross, r2, l1…) — the PS glyph, or its keyboard key. */
export function btnGlyph(ctx, btn, x, y, size = 11, forcePad = false) {
  if (forcePad || usingPad()) {
    const g = BTN_GLYPH[btn] || btn;
    const w = glyphWidth(ctx, g, size);
    padGlyph(ctx, g, x + w / 2, y, size);
    return w;
  }
  const lbl = BTN_KEY[btn] || btn.toUpperCase();
  const w = measureKey(ctx, lbl, size * 1.8);
  keyCap(ctx, lbl, x + w / 2, y, size * 1.8);
  return w;
}

export function btnGlyphWidth(ctx, btn, size = 11) {
  if (usingPad()) return glyphWidth(ctx, BTN_GLYPH[btn] || btn, size);
  return measureKey(ctx, BTN_KEY[btn] || btn.toUpperCase(), size * 1.8);
}

/** Bottom-right hint row: [[action or button, label], …] */
export function hints(ctx, items, opts = {}) {
  const y = opts.y ?? H - 34;
  let x = opts.x ?? W - 40;
  const size = 11;
  ctx.save();
  // right-to-left layout
  for (let i = items.length - 1; i >= 0; i--) {
    const [action, label] = items[i];
    const tw = measure(ctx, label, { size: 14, weight: 700, spacing: 1 });
    text(ctx, label, x, y + 5, { size: 14, weight: 700, color: C.text, align: 'right', spacing: 1 });
    x -= tw + 8;
    const isBtn = !PAD_GLYPH[action] && !KEY_LABEL[action] && (BTN_GLYPH[action] || BTN_KEY[action]);
    let gw;
    if (usingPad()) gw = glyphWidth(ctx, isBtn ? BTN_GLYPH[action] : (PAD_GLYPH[action] || 'cross'), size);
    else gw = measureKey(ctx, isBtn ? BTN_KEY[action] : (KEY_LABEL[action] || action.toUpperCase()), size * 1.8);
    if (isBtn) btnGlyph(ctx, action, x - gw, y, size); else actionGlyph(ctx, action, x - gw, y, size);
    x -= gw + 22;
  }
  ctx.restore();
}

function measureGlyph(ctx, name, r) {
  ctx.save();
  ctx.font = `700 ${Math.round(r * 0.95)}px ${BODY_FONT}`;
  const w = ctx.measureText(name).width + r * 1.1;
  ctx.restore();
  return w;
}
function measureKey(ctx, label, h) {
  ctx.save();
  ctx.font = `700 ${Math.round(h * 0.55)}px ${BODY_FONT}`;
  const w = Math.max(h, ctx.measureText(label).width + h * 0.7);
  ctx.restore();
  return w;
}

export function roundRect(ctx, x, y, w, h, r) {
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

/** Horizontal stat bar with segmented fill (classic car-stats look). */
export function statBar(ctx, x, y, w, h, value, opts = {}) {
  const segs = opts.segments || 20;
  const gap = 2;
  const sw = (w - gap * (segs - 1)) / segs;
  const filled = clamp(value, 0, 1) * segs;
  const delta = opts.compare !== undefined ? clamp(opts.compare, 0, 1) * segs : null;
  for (let i = 0; i < segs; i++) {
    const sx = x + i * (sw + gap);
    let col = 'rgba(255,255,255,0.08)';
    if (i < Math.floor(filled)) col = opts.color || C.accent;
    else if (i < filled) col = opts.color || C.accent;
    if (delta !== null) {
      if (i >= Math.floor(filled) && i < Math.floor(delta)) col = C.green;
      if (i < Math.floor(filled) && i >= Math.floor(delta)) col = C.red;
    }
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.moveTo(sx + 3, y);
    ctx.lineTo(sx + sw + 3, y);
    ctx.lineTo(sx + sw, y + h);
    ctx.lineTo(sx, y + h);
    ctx.closePath();
    ctx.fill();
  }
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

/** "VCR OSD" text — boxy green-on-nothing, like a VHS deck overlay. */
export function osd(ctx, str, x, y, size = 26, color = '#d8ffd8', align = 'left') {
  vText(ctx, str, x, y, size, { color, align, weight: 0.2, skew: 0, spacing: 2, shadow: [2, 2, 'rgba(0,0,0,0.8)'], glow: 6, glowColor: 'rgba(160,255,160,0.5)' });
}
