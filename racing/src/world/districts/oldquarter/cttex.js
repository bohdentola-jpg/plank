// PORT HALCYON — CHINATOWN's atlases: its windows (sashes and aluminium
// sliders, AC units, security grilles, blinds lit fluorescent, warm or red),
// its shopfronts (roast-meat windows, noodle bars, herbalists' drawers,
// fruit stands, jewellers, rolled shutters) and its signs: tall lightboxes
// and neon boards stacked with glyph-like blocks (no real words: shapes
// that read as signage) in red, pink, cyan and yellow. Day map + night map.
import { canvasPair, tileUV, grain, fitText } from './tex.js';

// ------------------------------------------------------------------ glyphs

/**
 * A made-up character in a size × size cell: a few strokes on a grid —
 * a radical on the left or top, a box, bars, a hook — never a real word.
 */
export function glyph(x, cx, cy, size, rng, col) {
  const s = size, t = Math.max(2, s / 7);
  const g0x = cx - s / 2, g0y = cy - s / 2;
  x.fillStyle = col;
  x.strokeStyle = col;
  x.lineWidth = t;
  x.lineCap = 'square';
  const H = (a, b, y) => x.fillRect(g0x + a * s, g0y + y * s - t / 2, (b - a) * s, t);
  const V = (y0, y1, a) => x.fillRect(g0x + a * s - t / 2, g0y + y0 * s, t, (y1 - y0) * s);
  const D = (a0, b0, a1, b1) => { x.beginPath(); x.moveTo(g0x + a0 * s, g0y + b0 * s); x.lineTo(g0x + a1 * s, g0y + b1 * s); x.stroke(); };
  const box = (a0, b0, a1, b1) => { H(a0, a1, b0); H(a0, a1, b1); V(b0, b1, a0); V(b0, b1, a1); };
  const split = rng();
  if (split < 0.45) {
    // a left radical, a right body
    const k = Math.floor(rng() * 3);
    if (k === 0) { V(0.1, 0.9, 0.18); D(0.06, 0.38, 0.3, 0.3); D(0.06, 0.62, 0.32, 0.56); }
    else if (k === 1) { x.fillRect(g0x + 0.12 * s, g0y + 0.12 * s, t, t); D(0.06, 0.4, 0.28, 0.48); D(0.08, 0.9, 0.3, 0.62); }
    else { H(0.05, 0.35, 0.3); V(0.1, 0.9, 0.2); D(0.2, 0.55, 0.05, 0.8); }
    const r = Math.floor(rng() * 3);
    if (r === 0) { box(0.45, 0.15, 0.88, 0.5); H(0.45, 0.9, 0.7); V(0.5, 0.92, 0.66); }
    else if (r === 1) { H(0.42, 0.92, 0.18); V(0.18, 0.88, 0.67); box(0.48, 0.42, 0.86, 0.8); }
    else { H(0.42, 0.9, 0.3); H(0.46, 0.86, 0.55); H(0.42, 0.92, 0.82); V(0.1, 0.82, 0.66); }
  } else if (split < 0.8) {
    // a cap on top, a body below
    const k = Math.floor(rng() * 3);
    if (k === 0) { x.fillRect(g0x + 0.47 * s, g0y + 0.04 * s, t, t); H(0.12, 0.88, 0.2); V(0.2, 0.3, 0.12); V(0.2, 0.3, 0.88); }
    else if (k === 1) { H(0.2, 0.8, 0.1); D(0.3, 0.1, 0.15, 0.32); D(0.7, 0.1, 0.86, 0.32); }
    else { H(0.1, 0.9, 0.14); V(0.04, 0.3, 0.35); V(0.04, 0.3, 0.65); }
    const r = Math.floor(rng() * 3);
    if (r === 0) { box(0.2, 0.4, 0.8, 0.88); H(0.2, 0.8, 0.64); }
    else if (r === 1) { H(0.1, 0.9, 0.5); V(0.36, 0.92, 0.5); D(0.5, 0.6, 0.15, 0.9); D(0.5, 0.6, 0.85, 0.9); }
    else { box(0.15, 0.42, 0.5, 0.78); box(0.55, 0.42, 0.88, 0.78); H(0.08, 0.92, 0.92); }
  } else {
    // one boxed body with bars through it
    box(0.15, 0.12, 0.85, 0.88);
    H(0.15, 0.85, 0.5);
    V(0.12, 0.88, 0.5);
    if (rng() < 0.5) D(0.15, 0.88, 0.0, 1.0);
  }
}

/** A row or column of glyphs. */
function glyphs(x, n, x0, y0, step, vertical, size, rng, col) {
  for (let k = 0; k < n; k++) glyph(x, vertical ? x0 : x0 + k * step, vertical ? y0 + k * step : y0, size, rng, col);
}

const NEON = ['#ff2a4a', '#ff4ad2', '#2ae6ff', '#ffd02a', '#7aff5a', '#ff8a2a', '#ffffff'];
const BOARD = ['#b8141a', '#0e0e10', '#f2d22a', '#f0eee6', '#14532e', '#1a2a6a', '#7a0e3a', '#e85a10'];
const pick = (rng, a) => a[Math.floor(rng() * a.length) % a.length];
const LATIN = ['BBQ', 'NOODLE', 'DIM SUM', 'TEA', 'HOTEL', 'KTV', 'BAKERY', 'HERBS', 'MARKET', 'JADE', 'GOLD', 'BAR', 'CAFE', 'RICE', 'DUMPLING', 'MAHJONG', 'TATTOO', 'FISH', 'SEAFOOD', 'LUCKY', 'DRAGON', 'PHOENIX', 'GARDEN', 'PALACE', 'DELI', 'FOTO', 'VIDEO', 'TRAVEL'];

// ------------------------------------------------------------------ signs

/** Sign tiles: vertical lightboxes 128×512 (8, top half), boards 256×128 (16, bottom half). */
export const CTS_V = 8, CTS_H = 16;
export const ctsVUV = (k) => tileUV(1024, 1024, (k % 8) * 128, 0, 128, 512, 2);
export const ctsHUV = (k) => tileUV(1024, 1024, (k % 4) * 256, 512 + Math.floor((k % 16) / 4) * 128, 256, 128, 2);

function hSign(x, e, k, rng) {
  const px = (k % 4) * 256, py = 512 + Math.floor(k / 4) * 128, W = 256, H = 128;
  const bg = BOARD[(k * 3 + 1) % BOARD.length];
  const dark = ['#0e0e10', '#1a2a6a', '#14532e', '#7a0e3a', '#b8141a'].includes(bg);
  const ink = dark ? pick(rng, ['#ffd02a', '#ffffff', '#fff2c8']) : pick(rng, ['#b8141a', '#101010']);
  const neon = pick(rng, NEON);
  x.fillStyle = bg; x.fillRect(px, py, W, H);
  x.strokeStyle = '#d8b040'; x.lineWidth = 4; x.strokeRect(px + 4, py + 4, W - 8, H - 8);
  const n = 3 + (k % 3);
  const gs = Math.min(56, (W - 40) / n);
  const seed = Math.floor(rng() * 1e9);
  const withWord = k % 2 === 0;
  const gy = withWord ? py + 44 : py + H / 2;
  glyphs(x, n, px + W / 2 - (n - 1) * gs * 1.05 / 2, gy, gs * 1.05, false, gs * 0.9, seeded(seed), ink);
  const word = pick(rng, LATIN);
  if (withWord) fitText(x, word, px + W / 2, py + 98, W - 30, 'bold 26px Arial, sans-serif', ink);
  // night: a lit board, or neon tubes on a dark one
  if (k % 3) {
    e.fillStyle = bg; e.globalAlpha = 0.8; e.fillRect(px, py, W, H); e.globalAlpha = 1;
    glyphs(e, n, px + W / 2 - (n - 1) * gs * 1.05 / 2, gy, gs * 1.05, false, gs * 0.9, seeded(seed), dark ? '#ffffff' : '#300000');
  } else {
    e.shadowColor = neon; e.shadowBlur = 12;
    glyphs(e, n, px + W / 2 - (n - 1) * gs * 1.05 / 2, gy, gs * 1.05, false, gs * 0.9, seeded(seed), neon);
    e.shadowBlur = 0;
  }
  if (withWord) fitText(e, word, px + W / 2, py + 98, W - 30, 'bold 26px Arial, sans-serif', k % 3 ? (dark ? '#ffffff' : '#400000') : neon);
  e.strokeStyle = '#d8a030'; e.lineWidth = 3; e.globalAlpha = 0.5; e.strokeRect(px + 4, py + 4, W - 8, H - 8); e.globalAlpha = 1;
}

/** A tiny deterministic stream (so the day map and the night map draw the same glyphs). */
function seeded(seed) {
  let a = seed >>> 0 || 1;
  return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

/** The sign atlas: { map, emi }. */
export function ctSigns() {
  return canvasPair('ct-signs', 1024, 1024, (x, e, w, h, rng) => {
    x.fillStyle = '#101010'; x.fillRect(0, 0, w, h);
    for (let k = 0; k < CTS_V; k++) vSignPair(x, e, k, rng, Math.floor(rng() * 1e9));
    for (let k = 0; k < CTS_H; k++) hSign(x, e, k, rng);
    grain(x, w, h, rng, 9000, 0.06, 1.5);
  });
}

function vSignPair(x, e, k, rng, seed) {
  // the picks first (colours, word), then the glyphs from a fresh stream, the same for day and night
  const px = k * 128, W = 128, H = 512;
  const bg = BOARD[k % BOARD.length];
  const dark = ['#0e0e10', '#1a2a6a', '#14532e', '#7a0e3a', '#b8141a'].includes(bg);
  const ink = dark ? pick(rng, ['#fff2c8', '#ffd02a', '#ffffff']) : pick(rng, ['#b8141a', '#101010', '#14532e']);
  const neon = pick(rng, NEON);
  const word = pick(rng, LATIN);
  const lightbox = k % 3 !== 1;
  const n = 4 + (k % 2);
  const step = (H - 110) / n;
  const gsz = Math.min(W - 34, step * 0.86);
  x.fillStyle = bg; x.fillRect(px, 0, W, H);
  x.strokeStyle = neon; x.lineWidth = 6; x.strokeRect(px + 5, 5, W - 10, H - 10);
  glyphs(x, n, px + W / 2, 40 + step / 2, step, true, gsz, seeded(seed + 7), ink);
  fitText(x, word, px + W / 2, H - 42, W - 24, 'bold 30px Arial, sans-serif', ink);
  if (lightbox) {
    e.fillStyle = bg; e.globalAlpha = 0.85; e.fillRect(px, 0, W, H); e.globalAlpha = 1;
    glyphs(e, n, px + W / 2, 40 + step / 2, step, true, gsz, seeded(seed + 7), dark ? '#ffffff' : '#200000');
  } else {
    e.shadowColor = ink; e.shadowBlur = 10;
    glyphs(e, n, px + W / 2, 40 + step / 2, step, true, gsz, seeded(seed + 7), ink);
    e.shadowBlur = 0;
  }
  e.strokeStyle = neon; e.lineWidth = 7; e.shadowColor = neon; e.shadowBlur = 14;
  e.strokeRect(px + 5, 5, W - 10, H - 10);
  e.shadowBlur = 0;
  fitText(e, word, px + W / 2, H - 42, W - 24, 'bold 30px Arial, sans-serif', lightbox ? (dark ? '#ffffff' : '#400000') : neon);
}


// ------------------------------------------------------------------ windows

/** Window tiles: name → [px, py, pw, ph] in the 1024² atlas. */
export const CTW = {
  s_dark: [0, 0, 128, 256], s_warm: [128, 0, 128, 256], s_cool: [256, 0, 128, 256], s_red: [384, 0, 128, 256],
  s_ac: [512, 0, 128, 256], s_aclit: [640, 0, 128, 256], s_grill: [768, 0, 128, 256], s_tv: [896, 0, 128, 256],
  p_dark: [0, 256, 256, 256], p_lit: [256, 256, 256, 256], p_wash: [512, 256, 256, 256], p_pink: [768, 256, 256, 256],
  m_dark: [0, 512, 256, 128], m_lit: [0, 640, 256, 128], m_mix: [256, 512, 256, 128], m_cool: [256, 640, 256, 128],
  d_dark: [512, 512, 128, 256], d_lit: [640, 512, 128, 256], d_red: [768, 512, 128, 256], d_green: [896, 512, 128, 256],
  lattice: [0, 768, 256, 256], moon: [256, 768, 256, 256], tdoor: [512, 768, 256, 256], board: [768, 768, 256, 256],
};
export const ctwUV = (n) => tileUV(1024, 1024, ...CTW[n]);

const LIT = { warm: ['#ffd27a', '#ffb850'], cool: ['#d8fff0', '#a8f0ff'], red: ['#ff5a3a', '#c82a2a'], tv: ['#7aa8ff', '#3a5aff'], pink: ['#ff8ad8', '#ff4aa8'] };

function sash(x, e, px, py, pw, ph, rng, o = {}) {
  // a segmental-arched opening, a white sash frame, two panes, a blind
  x.fillStyle = '#1e1a18';
  x.fillRect(px, py, pw, ph);
  const ix = px + 12, iy = py + 14, iw = pw - 24, ih = ph - 26;
  const g = x.createLinearGradient(ix, iy, ix, iy + ih);
  g.addColorStop(0, '#3c4a58'); g.addColorStop(1, '#141a22');
  x.fillStyle = g; x.fillRect(ix, iy, iw, ih);
  if (o.lit) {
    const c = LIT[o.lit];
    const ge = e.createRadialGradient(ix + iw / 2, iy + ih * 0.4, 4, ix + iw / 2, iy + ih / 2, ih * 0.7);
    ge.addColorStop(0, c[0]); ge.addColorStop(1, c[1]);
    e.fillStyle = ge; e.fillRect(ix, iy, iw, ih);
  }
  // the blind, pulled part way down
  const bl = ih * (0.15 + rng() * 0.4);
  x.fillStyle = pick(rng, ['#d8cfb4', '#c8b896', '#e8e2d0', '#9ab0a0']);
  x.fillRect(ix, iy, iw, bl);
  if (o.lit) { e.fillStyle = 'rgba(0,0,0,0.45)'; e.fillRect(ix, iy, iw, bl); }
  x.fillStyle = '#ece8e0'; e.fillStyle = '#000';
  for (const b of [[ix, iy, iw, 6], [ix, iy + ih - 6, iw, 6], [ix, iy, 6, ih], [ix + iw - 6, iy, 6, ih], [ix, iy + ih / 2 - 4, iw, 8]]) { x.fillRect(...b); e.fillRect(...b); }
  // the brick arch over it, a sill under it
  x.fillStyle = 'rgba(0,0,0,0.35)';
  x.beginPath(); x.ellipse(px + pw / 2, py + 16, pw / 2, 14, 0, Math.PI, 0); x.fill();
  x.fillStyle = '#b8b0a0'; x.fillRect(px + 4, py + ph - 10, pw - 8, 8);
  if (o.ac) {
    // an air conditioner in the lower sash
    const ay = iy + ih * 0.58;
    x.fillStyle = '#c8c8c0'; x.fillRect(ix - 4, ay, iw + 8, ih * 0.36);
    x.fillStyle = '#7a7a76';
    for (let k = 0; k < 7; k++) x.fillRect(ix + 4, ay + 8 + k * 9, iw - 8, 3);
    e.fillStyle = '#000'; e.fillRect(ix - 4, ay, iw + 8, ih * 0.36);
  }
  if (o.grill) {
    x.fillStyle = '#202020';
    for (let k = 0; k < 6; k++) x.fillRect(ix + k * iw / 5 - 2, iy, 4, ih);
    for (let k = 0; k < 4; k++) x.fillRect(ix, iy + k * ih / 3 - 2, iw, 4);
    e.fillStyle = '#000';
    for (let k = 0; k < 6; k++) e.fillRect(ix + k * iw / 5 - 2, iy, 4, ih);
  }
}

function pair(x, e, px, py, rng, o = {}) {
  x.fillStyle = '#1e1a18'; x.fillRect(px, py, 256, 256);
  sash(x, e, px, py, 128, 256, rng, { lit: o.lit1 });
  sash(x, e, px + 128, py, 128, 256, rng, { lit: o.lit2 });
  if (o.wash) {
    // a pole of washing outside
    x.fillStyle = '#5a5a5a'; x.fillRect(px + 8, py + 70, 240, 4);
    for (let k = 0; k < 6; k++) {
      x.fillStyle = pick(rng, ['#e8e8e8', '#3a6ac8', '#c83a3a', '#e8c83a', '#3a9a5a', '#e888b8']);
      const wx = px + 16 + k * 38;
      x.fillRect(wx, py + 74, 28, 34 + rng() * 26);
      e.fillStyle = '#000'; e.fillRect(wx, py + 74, 28, 60);
    }
  }
  if (o.plants) {
    for (let k = 0; k < 5; k++) {
      x.fillStyle = pick(rng, ['#3a7a2a', '#2a5a1a', '#5a8a3a']);
      x.beginPath(); x.arc(px + 30 + k * 48, py + 238, 16 + rng() * 6, 0, Math.PI * 2); x.fill();
      x.fillStyle = '#8a4a2a'; x.fillRect(px + 20 + k * 48, py + 240, 20, 14);
    }
  }
}

/** A band of aluminium sliders (modern infill), lit in some panes. */
function band(x, e, px, py, rng, mode) {
  x.fillStyle = '#d8d4cc'; x.fillRect(px, py, 256, 128);
  for (let k = 0; k < 4; k++) {
    const wx = px + 6 + k * 62, wy = py + 18, ww = 56, wh = 92;
    const g = x.createLinearGradient(wx, wy, wx, wy + wh);
    g.addColorStop(0, '#5a6a7a'); g.addColorStop(1, '#1a222c');
    x.fillStyle = g; x.fillRect(wx, wy, ww, wh);
    const lit = mode === 'lit' || (mode === 'mix' && rng() < 0.5) || (mode === 'cool' && rng() < 0.7);
    if (lit) { e.fillStyle = mode === 'cool' ? '#d8fff4' : pick(rng, ['#ffd890', '#fff0c8', '#ffb870']); e.fillRect(wx, wy, ww, wh); }
    x.fillStyle = '#a8aaac'; x.fillRect(wx + ww / 2 - 2, wy, 4, wh); x.fillRect(wx, wy, ww, 3); x.fillRect(wx, wy + wh - 3, ww, 3);
    e.fillStyle = '#000'; e.fillRect(wx + ww / 2 - 2, wy, 4, wh);
    if (rng() < 0.4) { x.fillStyle = 'rgba(220,210,190,0.85)'; x.fillRect(wx, wy, ww, wh * 0.4); e.fillStyle = 'rgba(0,0,0,0.6)'; e.fillRect(wx, wy, ww, wh * 0.4); }
  }
  x.fillStyle = 'rgba(0,0,0,0.25)'; x.fillRect(px, py + 114, 256, 6);
}

/** A balcony door (glass, a curtain). */
function bdoor(x, e, px, py, rng, lit) {
  x.fillStyle = '#1e1a18'; x.fillRect(px, py, 128, 256);
  const ix = px + 10, iy = py + 10, iw = 108, ih = 240;
  x.fillStyle = '#1c2430'; x.fillRect(ix, iy, iw, ih);
  const cur = pick(rng, ['#c83a3a', '#e8d8a8', '#3a8a6a', '#d8a83a']);
  x.fillStyle = cur; x.fillRect(ix + 4, iy + 4, iw * 0.35, ih - 8); x.fillRect(ix + iw * 0.62, iy + 4, iw * 0.35, ih - 8);
  if (lit) {
    e.fillStyle = lit; e.fillRect(ix, iy, iw, ih);
    e.fillStyle = 'rgba(0,0,0,0.5)'; e.fillRect(ix + 4, iy + 4, iw * 0.35, ih - 8); e.fillRect(ix + iw * 0.62, iy + 4, iw * 0.35, ih - 8);
  }
  x.fillStyle = '#e0dcd4'; e.fillStyle = '#000';
  for (const b of [[ix, iy, iw, 5], [ix, iy + ih - 5, iw, 5], [ix, iy, 5, ih], [ix + iw - 5, iy, 5, ih], [ix + iw / 2 - 3, iy, 6, ih], [ix, iy + 70, iw, 4]]) { x.fillRect(...b); e.fillRect(...b); }
}

/** Temple lattice: red and gold, lit warm from inside. */
function latticePanel(x, e, px, py, rng) {
  x.fillStyle = '#7a1010'; x.fillRect(px, py, 256, 256);
  const g = e.createRadialGradient(px + 128, py + 128, 10, px + 128, py + 128, 180);
  g.addColorStop(0, '#ffd890'); g.addColorStop(1, '#c86a20');
  e.fillStyle = g; e.fillRect(px + 16, py + 16, 224, 224);
  x.fillStyle = '#e8b830'; e.fillStyle = '#000';
  for (let k = 0; k <= 8; k++) { x.fillRect(px + 16 + k * 28 - 3, py + 16, 6, 224); x.fillRect(px + 16, py + 16 + k * 28 - 3, 224, 6); e.fillRect(px + 16 + k * 28 - 3, py + 16, 6, 224); e.fillRect(px + 16, py + 16 + k * 28 - 3, 224, 6); }
  x.strokeStyle = '#e8b830'; x.lineWidth = 5; e.strokeStyle = '#000'; e.lineWidth = 5;
  for (let k = 0; k < 4; k++) for (let q = 0; q < 4; q++) { x.strokeRect(px + 30 + k * 56, py + 30 + q * 56, 28, 28); e.strokeRect(px + 30 + k * 56, py + 30 + q * 56, 28, 28); }
  x.fillStyle = '#5a0a0a'; x.fillRect(px, py, 256, 16); x.fillRect(px, py + 240, 256, 16); x.fillRect(px, py, 16, 256); x.fillRect(px + 240, py, 16, 256);
  void rng;
}

function moonWindow(x, e, px, py, rng) {
  x.fillStyle = '#e8e0d0'; x.fillRect(px, py, 256, 256);
  const cx = px + 128, cy = py + 128;
  x.fillStyle = '#3a0a0a'; x.beginPath(); x.arc(cx, cy, 108, 0, Math.PI * 2); x.fill();
  e.save(); e.beginPath(); e.arc(cx, cy, 100, 0, Math.PI * 2); e.clip();
  const g = e.createRadialGradient(cx, cy, 10, cx, cy, 100); g.addColorStop(0, '#a8784a'); g.addColorStop(1, '#6a2a0c');
  e.fillStyle = g; e.fillRect(px, py, 256, 256); e.restore();
  x.strokeStyle = '#2a6a3a'; x.lineWidth = 10; x.beginPath(); x.arc(cx, cy, 108, 0, Math.PI * 2); x.stroke();
  x.strokeStyle = '#c89a30'; x.lineWidth = 5; e.strokeStyle = '#000'; e.lineWidth = 5;
  for (let k = 0; k < 6; k++) { const a = k * Math.PI / 3; for (const c of [x, e]) { c.beginPath(); c.moveTo(cx, cy); c.lineTo(cx + Math.cos(a) * 100, cy + Math.sin(a) * 100); c.stroke(); } }
  for (const c of [x, e]) { c.beginPath(); c.arc(cx, cy, 55, 0, Math.PI * 2); c.stroke(); }
  void rng;
}

function templeDoor(x, e, px, py, rng) {
  x.fillStyle = '#5a0808'; x.fillRect(px, py, 256, 256);
  x.fillStyle = '#b81414'; x.fillRect(px + 30, py + 30, 98, 226); x.fillRect(px + 130, py + 30, 96, 226);
  x.fillStyle = '#e8c040';
  for (let r = 0; r < 7; r++) for (let c = 0; c < 4; c++) { x.beginPath(); x.arc(px + 46 + c * 22, py + 50 + r * 28, 4, 0, Math.PI * 2); x.arc(px + 146 + c * 22, py + 50 + r * 28, 4, 0, Math.PI * 2); x.fill(); }
  x.fillStyle = '#1a1a1a'; x.fillRect(px + 30, py + 8, 196, 22);
  glyphs(x, 3, px + 90, py + 19, 38, false, 18, seeded(91), '#e8c040');
  e.fillStyle = '#5a3008'; e.fillRect(px + 30, py + 8, 196, 22);
  void rng;
}

function shutteredBoard(x, e, px, py, rng) {
  // a red and gold signboard panel (for gates and temple fronts)
  x.fillStyle = '#121212'; x.fillRect(px, py, 256, 256);
  x.fillStyle = '#9a0e0e'; x.fillRect(px + 10, py + 60, 236, 136);
  x.strokeStyle = '#e8c040'; x.lineWidth = 8; x.strokeRect(px + 14, py + 64, 228, 128);
  const s = seeded(1234);
  glyphs(x, 3, px + 128 - 70, py + 128, 70, false, 58, s, '#f0c840');
  e.fillStyle = 'rgba(255,170,60,0.55)'; e.fillRect(px + 10, py + 60, 236, 136);
  glyphs(e, 3, px + 128 - 70, py + 128, 70, false, 58, seeded(1234), '#ffe080');
  void rng;
}

/** The window atlas: { map, emi }. */
export function ctWindows() {
  return canvasPair('ct-windows', 1024, 1024, (x, e, w, h, rng) => {
    x.fillStyle = '#1e1a18'; x.fillRect(0, 0, w, h);
    const T = CTW;
    sash(x, e, ...T.s_dark, rng, {});
    sash(x, e, ...T.s_warm, rng, { lit: 'warm' });
    sash(x, e, ...T.s_cool, rng, { lit: 'cool' });
    sash(x, e, ...T.s_red, rng, { lit: 'red' });
    sash(x, e, ...T.s_ac, rng, { ac: true });
    sash(x, e, ...T.s_aclit, rng, { ac: true, lit: 'warm' });
    sash(x, e, ...T.s_grill, rng, { grill: true });
    sash(x, e, ...T.s_tv, rng, { grill: true, lit: 'tv' });
    pair(x, e, T.p_dark[0], T.p_dark[1], rng, { plants: true });
    pair(x, e, T.p_lit[0], T.p_lit[1], rng, { lit1: 'warm', lit2: 'cool' });
    pair(x, e, T.p_wash[0], T.p_wash[1], rng, { lit1: 'warm', wash: true });
    pair(x, e, T.p_pink[0], T.p_pink[1], rng, { lit1: 'pink', lit2: 'red', plants: true });
    band(x, e, T.m_dark[0], T.m_dark[1], rng, 'dark');
    band(x, e, T.m_lit[0], T.m_lit[1], rng, 'lit');
    band(x, e, T.m_mix[0], T.m_mix[1], rng, 'mix');
    band(x, e, T.m_cool[0], T.m_cool[1], rng, 'cool');
    bdoor(x, e, T.d_dark[0], T.d_dark[1], rng, null);
    bdoor(x, e, T.d_lit[0], T.d_lit[1], rng, '#ffd48a');
    bdoor(x, e, T.d_red[0], T.d_red[1], rng, '#ff6a4a');
    bdoor(x, e, T.d_green[0], T.d_green[1], rng, '#c8ffe0');
    latticePanel(x, e, T.lattice[0], T.lattice[1], rng);
    moonWindow(x, e, T.moon[0], T.moon[1], rng);
    templeDoor(x, e, T.tdoor[0], T.tdoor[1], rng);
    shutteredBoard(x, e, T.board[0], T.board[1], rng);
  });
}

// ------------------------------------------------------------------ shopfronts

export const CTSHOP = [
  { kind: 'roast', lit: 1, frame: '#8a1010' }, { kind: 'noodle', lit: 1, frame: '#1a1a1a' },
  { kind: 'bakery', lit: 1, frame: '#e8c020' }, { kind: 'herbal', lit: 0.7, frame: '#3a2410' },
  { kind: 'grocer', lit: 1, frame: '#1a6a2a' }, { kind: 'jewel', lit: 1, frame: '#b8141a' },
  { kind: 'tea', lit: 0.8, frame: '#14532e' }, { kind: 'gift', lit: 1, frame: '#c83a1a' },
  { kind: 'fish', lit: 0.9, frame: '#1a3a6a' }, { kind: 'shutter', lit: 0, frame: '#5a5a5c' },
  { kind: 'halfshut', lit: 0.6, frame: '#4a4a4c' }, { kind: 'phone', lit: 1, frame: '#202020' },
  { kind: 'dimsum', lit: 1, frame: '#a01818' }, { kind: 'bubble', lit: 1, frame: '#e84a9a' },
  { kind: 'karaoke', lit: 0.9, frame: '#3a1a5a' }, { kind: 'laundry', lit: 1, frame: '#2a5a9a' },
];
export const ctShopUV = (i) => tileUV(1024, 1024, (i % 4) * 256, Math.floor(i / 4) * 256, 256, 256, 2);

function ctInterior(x, e, kind, ax, ay, aw, ah, lit, rng) {
  const back = { roast: '#e8c890', noodle: '#f0e0b0', bakery: '#fff0c0', herbal: '#8a5a2a', grocer: '#f0f0e0', jewel: '#ffe8b0', tea: '#d8c890', gift: '#ffd8c0', fish: '#a0d8f0', phone: '#ffffff', dimsum: '#ffe0b0', bubble: '#ffe0f0', karaoke: '#8a3ab8', laundry: '#e8f4ff', halfshut: '#ffd8a0' }[kind] || '#d0c0a0';
  x.fillStyle = lit ? back : '#141414';
  x.fillRect(ax, ay, aw, ah);
  if (kind === 'roast') {
    x.fillStyle = '#5a5a5a'; x.fillRect(ax, ay + 12, aw, 4);
    for (let k = 0; k < aw / 22; k++) { x.fillStyle = pick(rng, ['#b8501a', '#a03a10', '#c86a2a']); x.beginPath(); x.ellipse(ax + 12 + k * 22, ay + 46, 9, 28, 0, 0, Math.PI * 2); x.fill(); }
  } else if (kind === 'noodle' || kind === 'dimsum') {
    for (let k = 0; k < 3; k++) { x.fillStyle = '#c8202a'; x.fillRect(ax + 10 + k * aw / 3, ay + 8, aw / 3 - 20, 26); glyph(x, ax + aw / 6 + k * aw / 3, ay + 21, 18, rng, '#ffe080'); }
    for (let k = 0; k < 4; k++) { x.fillStyle = 'rgba(40,20,10,0.6)'; x.fillRect(ax + 8 + rng() * (aw - 30), ay + ah * 0.5, 16, 40); }
    x.fillStyle = '#e8e0d0'; for (let k = 0; k < 3; k++) { x.beginPath(); x.ellipse(ax + 20 + k * aw / 3, ay + ah * 0.78, 18, 6, 0, 0, Math.PI * 2); x.fill(); }
  } else if (kind === 'herbal' || kind === 'tea') {
    for (let r = 0; r < 6; r++) for (let c = 0; c < aw / 18; c++) { x.fillStyle = kind === 'tea' ? pick(rng, ['#c83a1a', '#2a6a3a', '#d8a83a', '#3a3a8a']) : '#6a3a1a'; x.fillRect(ax + 2 + c * 18, ay + 6 + r * 22, 15, 18); x.fillStyle = '#e8c870'; x.fillRect(ax + 8 + c * 18, ay + 13 + r * 22, 4, 4); }
  } else if (kind === 'grocer' || kind === 'gift' || kind === 'bakery') {
    for (let r = 0; r < 4; r++) for (let c = 0; c < aw / 10; c++) { x.fillStyle = kind === 'bakery' ? pick(rng, ['#e8b040', '#f0d070', '#c88030']) : pick(rng, ['#e83a2a', '#f8a020', '#9ac040', '#f0e050', '#c83ab8', '#3a8a3a']); x.beginPath(); x.arc(ax + 5 + c * 10, ay + 20 + r * 26 + rng() * 6, 4.5, 0, Math.PI * 2); x.fill(); }
    if (kind === 'gift') for (let k = 0; k < 4; k++) { x.fillStyle = '#e8202a'; x.beginPath(); x.ellipse(ax + 20 + k * aw / 4, ay + 14, 10, 13, 0, 0, Math.PI * 2); x.fill(); }
  } else if (kind === 'jewel') {
    for (let r = 0; r < 3; r++) { x.fillStyle = '#3a0a0a'; x.fillRect(ax + 6, ay + 20 + r * 40, aw - 12, 24); for (let c = 0; c < aw / 14; c++) { x.fillStyle = pick(rng, ['#ffd040', '#f0e0a0', '#40e0a0']); x.fillRect(ax + 10 + c * 14, ay + 26 + r * 40, 6, 6); } }
  } else if (kind === 'fish') {
    for (let k = 0; k < 3; k++) { x.fillStyle = '#2a8ad8'; x.fillRect(ax + 6 + k * aw / 3, ay + ah * 0.35, aw / 3 - 12, ah * 0.5); x.fillStyle = '#e88a3a'; for (let q = 0; q < 3; q++) x.fillRect(ax + 14 + k * aw / 3 + q * 12, ay + ah * 0.5 + rng() * 20, 8, 3); }
  } else if (kind === 'phone' || kind === 'laundry' || kind === 'bubble') {
    for (let k = 0; k < aw / 30; k++) { x.fillStyle = pick(rng, kind === 'bubble' ? ['#ff8ad8', '#8ae8ff', '#fff'] : ['#202020', '#3a3a3a', '#e8e8e8']); x.fillRect(ax + 6 + k * 30, ay + 30 + rng() * 40, 22, 40); }
  } else if (kind === 'karaoke') {
    for (let k = 0; k < 3; k++) { x.strokeStyle = pick(rng, NEON); x.lineWidth = 4; x.strokeRect(ax + 10 + rng() * (aw - 70), ay + 20 + rng() * (ah - 70), 56, 34); }
  }
  if (lit) {
    const c = { fish: '#80d0ff', phone: '#f0f8ff', laundry: '#e0f0ff', karaoke: '#c060ff', bubble: '#ff9ad8', herbal: '#ffb060' }[kind] || '#ffd890';
    const g = e.createLinearGradient(0, ay, 0, ay + ah);
    g.addColorStop(0, c); g.addColorStop(1, 'rgba(90,40,10,0.5)');
    e.globalAlpha = lit; e.fillStyle = g; e.fillRect(ax, ay, aw, ah); e.globalAlpha = 1;
  }
}

function ctShopTile(x, e, i, rng) {
  const S = 256, px = (i % 4) * S, py = Math.floor(i / 4) * S;
  const o = CTSHOP[i];
  x.fillStyle = o.frame; x.fillRect(px, py, S, S);
  const signH = 54, ay = py + signH + 8, ah = S - signH - 8 - 14;
  if (o.kind === 'shutter' || o.kind === 'halfshut') {
    const top = o.kind === 'halfshut' ? ay + ah * 0.55 : ay + ah;
    if (o.kind === 'halfshut') ctInterior(x, e, 'halfshut', px + 10, top, S - 20, ay + ah - top, 0.8, rng);
    for (let yy = ay - 4; yy < top; yy += 7) { x.fillStyle = (yy / 7) % 2 ? '#7a7c80' : '#909296'; x.fillRect(px + 10, yy, S - 20, 7); }
    // painted glyphs on the shutter
    glyphs(x, 3, px + S / 2 - 50, ay + 60, 50, false, 40, rng, '#b8141a');
  } else {
    const doorW = 60, dx = rng() < 0.5 ? px + 14 : px + S - 14 - doorW;
    const wx0 = dx === px + 14 ? dx + doorW + 8 : px + 14, wx1 = dx === px + 14 ? px + S - 14 : dx - 8;
    ctInterior(x, e, o.kind, wx0, ay, wx1 - wx0, ah, o.lit, rng);
    ctInterior(x, e, o.kind, dx, ay, doorW, ah + 10, o.lit * 0.85, rng);
    x.fillStyle = '#c8c8c8'; e.fillStyle = '#000';
    for (const b of [[wx0 - 4, ay, 5, ah], [wx1 - 1, ay, 5, ah], [dx - 3, ay, 5, ah + 10], [dx + doorW - 2, ay, 5, ah + 10], [wx0, ay + ah * 0.5, wx1 - wx0, 4]]) { x.fillRect(...b); e.fillRect(...b); }
    // a menu or price boards in the window, lit
    if (['noodle', 'dimsum', 'roast', 'bubble', 'bakery'].includes(o.kind)) {
      const mx = wx0 + 8, my = ay + ah * 0.55, mw = Math.min(70, wx1 - wx0 - 16), mh = 40;
      x.fillStyle = '#fff6d0'; x.fillRect(mx, my, mw, mh);
      e.fillStyle = '#fff2c0'; e.fillRect(mx, my, mw, mh);
      for (let r = 0; r < 4; r++) { x.fillStyle = '#b81414'; x.fillRect(mx + 4, my + 5 + r * 9, mw * 0.5, 4); x.fillRect(mx + mw * 0.7, my + 5 + r * 9, mw * 0.2, 4); e.fillStyle = '#601000'; e.fillRect(mx + 4, my + 5 + r * 9, mw * 0.5, 4); }
    }
  }
  // the signboard: glyphs and a word, lit
  const board = pick(rng, BOARD);
  const dark = ['#0e0e10', '#1a2a6a', '#14532e', '#7a0e3a', '#b8141a'].includes(board);
  const ink = dark ? pick(rng, ['#ffd02a', '#ffffff']) : '#b8141a';
  x.fillStyle = board; x.fillRect(px + 4, py + 4, S - 8, signH);
  x.strokeStyle = '#d8a830'; x.lineWidth = 3; x.strokeRect(px + 6, py + 6, S - 12, signH - 4);
  const seed = Math.floor(rng() * 1e9);
  glyphs(x, 3, px + 44, py + 4 + signH / 2, 40, false, 34, seeded(seed), ink);
  const word = pick(rng, LATIN);
  fitText(x, word, px + 200, py + 4 + signH / 2, 100, 'bold 24px Arial, sans-serif', ink);
  if (o.lit > 0.3) {
    e.fillStyle = board; e.globalAlpha = 0.6; e.fillRect(px + 4, py + 4, S - 8, signH); e.globalAlpha = 1;
    glyphs(e, 3, px + 44, py + 4 + signH / 2, 40, false, 34, seeded(seed), dark ? '#ffffff' : '#400000');
    fitText(e, word, px + 200, py + 4 + signH / 2, 100, 'bold 24px Arial, sans-serif', dark ? '#ffffff' : '#400000');
  }
}

/** The shopfront atlas: { map, emi }. */
export function ctShops() {
  return canvasPair('ct-shops', 1024, 1024, (x, e, w, h, rng) => {
    for (let i = 0; i < CTSHOP.length; i++) ctShopTile(x, e, i, rng);
    grain(x, w, h, rng, 16000, 0.07, 1.5);
  });
}
