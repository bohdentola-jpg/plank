// 2D UI toolkit for the canvas layer (1024×768 logical units). Mid-2000s
// console look: slanted smoked-glass panels, amber/cyan accents, chunky italic
// display type (font.js), controller glyphs that match the device in use.
import { vText, vWidth } from './font.js';
import { input } from './input.js';
import { clamp } from './util.js';

export const W = 1024;
export const H = 768;

export const C = {
  panel: 'rgba(7,10,18,0.80)',
  panel2: 'rgba(14,19,32,0.86)',
  edge: 'rgba(160,180,220,0.20)',
  accent: '#ffb21e',
  accentDim: '#a8700f',
  cyan: '#46e8ff',
  text: '#eef1f7',
  dim: '#8c95a8',
  faint: '#4a5266',
  red: '#ff3d52',
  green: '#4dff8b',
  blue: '#5aa9ff',
};

export const BODY_FONT = '"Bahnschrift", "Segoe UI", "DIN Alternate", "Helvetica Neue", Arial, sans-serif';
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
  g.addColorStop(0, opts.fillTop || 'rgba(22,28,44,0.86)');
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

/** Header strip: big italic stroke-font title with an underline swoosh. */
export function header(ctx, title, sub, x = 64, y = 86, opts = {}) {
  vText(ctx, title, x, y, opts.size || 40, {
    color: C.text, weight: 0.16, outline: 3, outlineColor: 'rgba(0,0,0,0.75)', shadow: [3, 4, 'rgba(0,0,0,0.6)'],
  });
  const w = vWidth(title, opts.size || 40);
  const g = ctx.createLinearGradient(x, 0, x + w + 260, 0);
  g.addColorStop(0, opts.color || C.accent);
  g.addColorStop(1, 'rgba(255,178,30,0)');
  ctx.save();
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(x - 6, y + 10);
  ctx.lineTo(x + w + 260, y + 10);
  ctx.lineTo(x + w + 254, y + 14);
  ctx.lineTo(x - 10, y + 14);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  if (sub) text(ctx, sub, x + 2, y + 36, { size: 15, color: C.dim, weight: 600, spacing: 2 });
}

// ------------------------------------------------------------------ glyphs

const PAD_GLYPH = {
  confirm: 'cross', back: 'circle', extra: 'square', alt: 'triangle',
  tabL: 'L1', tabR: 'R1', pause: 'OPTIONS', reset: 'CREATE', camera: 'triangle',
  lr: 'dpadLR', ud: 'dpadUD', stick: 'stick', gas: 'R2', brake: 'L2', nitro: 'cross', handbrake: 'square',
  shiftUp: 'R1', shiftDown: 'L1', look: 'circle',
};
const KEY_LABEL = {
  confirm: 'ENTER', back: 'ESC', extra: 'X', alt: 'F', tabL: 'Q', tabR: 'E', pause: 'ESC',
  reset: 'R', camera: 'C', lr: '← →', ud: '↑ ↓', stick: 'ARROWS', gas: 'W / ↑', brake: 'S / ↓',
  nitro: 'SHIFT', handbrake: 'SPACE', shiftUp: 'E', shiftDown: 'Q', look: 'B',
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
  } else if (name === 'dpadLR' || name === 'dpadUD' || name === 'stick') {
    ctx.fillStyle = '#1b1e25';
    ctx.strokeStyle = 'rgba(255,255,255,0.3)';
    ctx.lineWidth = 1;
    if (name === 'stick') {
      ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.arc(0, 0, r * 0.55, 0, Math.PI * 2); ctx.fillStyle = '#2c313c'; ctx.fill();
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

/** Glyph for an action on the current device. Returns drawn width. */
export function actionGlyph(ctx, action, x, y, size = 11) {
  if (usingPad()) {
    const g = PAD_GLYPH[action] || 'cross';
    const w = padGlyph(ctx, g, x + size, y, size);
    return w || size * 2;
  }
  const lbl = KEY_LABEL[action] || action.toUpperCase();
  const w = keyCap(ctx, lbl, 0, -1000, size * 1.8); // measure
  keyCap(ctx, lbl, x + w / 2, y, size * 1.8);
  return w;
}

/** Bottom-right hint row: [[action, label], …] */
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
    const gw = usingPad() ? (PAD_GLYPH[action] && ['L1', 'R1', 'L2', 'R2', 'OPTIONS', 'CREATE'].includes(PAD_GLYPH[action]) ? measureGlyph(ctx, PAD_GLYPH[action], size) : size * 2) : measureKey(ctx, KEY_LABEL[action] || action, size * 1.8);
    actionGlyph(ctx, action, x - gw, y, size);
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
