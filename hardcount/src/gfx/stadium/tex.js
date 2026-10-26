// Procedural canvas textures for the venues: noise, concrete, seats, metal,
// brick, chain-link, lamp panels, glow sprites, ad boards, ribbon boards,
// building facades, banners and graffiti. Everything is drawn in code.
// Small generic textures are cached per module (three re-uploads a texture
// that was disposed with an old venue the next time it is used).
import * as THREE from 'three';
import { makeRng, makeNoise2D } from '../../core/util.js';

const cache = new Map();
export const once = (key, fn) => { if (!cache.has(key)) cache.set(key, fn()); return cache.get(key); };

export function cv(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return [c, c.getContext('2d')];
}

export function tex(c, { srgb = true, repeat = true, aniso = 8, mips = true } = {}) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = aniso;
  if (!mips) { t.generateMipmaps = false; t.minFilter = THREE.LinearFilter; }
  return t;
}

export const FONT = '"Arial Black", "Inter", "Helvetica Neue", Arial, sans-serif';
export const COND = '"Bahnschrift", "Arial Narrow", "Inter", Arial, sans-serif';

/** Fitted canvas text (shrinks to max width). */
export function label(x, s, px, py, size, col, o = {}) {
  let sz = size;
  const font = () => `${o.italic ? 'italic ' : ''}${o.w || 900} ${sz}px ${o.f || FONT}`;
  x.save();
  x.font = font();
  while (o.max && x.measureText(s).width > o.max && sz > 6) { sz -= 1; x.font = font(); }
  x.textAlign = o.align || 'center';
  x.textBaseline = o.base || 'middle';
  try { if (o.spacing) x.letterSpacing = `${o.spacing}px`; } catch { /* */ }
  if (o.glow) { x.shadowColor = o.glow; x.shadowBlur = o.blur || 12; }
  if (o.stroke) { x.lineWidth = o.stroke; x.strokeStyle = o.sc || '#000'; x.lineJoin = 'round'; x.strokeText(s, px, py); }
  x.fillStyle = col;
  x.fillText(s, px, py);
  x.restore();
  return sz;
}

export function speckle(x, w, h, rng, n, cols, a0 = 0.15, a1 = 0.5, s0 = 1, s1 = 2) {
  for (let i = 0; i < n; i++) {
    x.fillStyle = cols[(rng() * cols.length) | 0];
    x.globalAlpha = a0 + rng() * (a1 - a0);
    const s = s0 + rng() * (s1 - s0);
    x.fillRect(rng() * w, rng() * h, s, s);
  }
  x.globalAlpha = 1;
}

export function blotch(x, px, py, r, rgba0, rgba1 = 'rgba(0,0,0,0)') {
  const g = x.createRadialGradient(px, py, 0, px, py, r);
  g.addColorStop(0, rgba0);
  g.addColorStop(1, rgba1);
  x.fillStyle = g;
  x.fillRect(px - r, py - r, r * 2, r * 2);
}

/** Grayscale fbm noise canvas, values centred on mid gray. */
export function noiseCanvas(size, seed, freq = 4, oct = 4, contrast = 1) {
  return once(`noise|${size}|${seed}|${freq}|${oct}|${contrast}`, () => {
    const [c, x] = cv(size, size);
    const img = x.createImageData(size, size);
    const n = makeNoise2D(seed);
    const d = img.data;
    for (let j = 0; j < size; j++) {
      for (let i = 0; i < size; i++) {
        const v = n.fbm((i / size) * freq + 0.37, (j / size) * freq + 0.61, oct);
        const g = Math.max(0, Math.min(255, 128 + v * 230 * contrast));
        const k = (j * size + i) * 4;
        d[k] = d[k + 1] = d[k + 2] = g;
        d[k + 3] = 255;
      }
    }
    x.putImageData(img, 0, 0);
    return c;
  });
}

/** High-frequency speckle tile (alpha), for createPattern overlays. */
export function grainCanvas(size, seed, dens = 0.6, light = '255,255,255', dark = '0,0,0', a = 0.22) {
  return once(`grain|${size}|${seed}|${dens}|${light}|${dark}|${a}`, () => {
    const [c, x] = cv(size, size);
    const rng = makeRng(seed);
    const n = Math.floor(size * size * dens);
    for (let i = 0; i < n; i++) {
      x.fillStyle = rng() < 0.5 ? `rgba(${light},${rng() * a})` : `rgba(${dark},${rng() * a})`;
      x.fillRect(rng() * size, rng() * size, 1, 1 + (rng() < 0.3 ? 1 : 0));
    }
    return c;
  });
}

// ------------------------------------------------------------------ surfaces

/** Grass blades detail (grayscale, mid = 0.5), tiles every ~2.5 yd. */
export function grassDetail(kind = 'grass') {
  return once('detail|' + kind, () => {
    const S = 512;
    const [c, x] = cv(S, S);
    const rng = makeRng('detail' + kind);
    x.fillStyle = '#7a7a7a';
    x.fillRect(0, 0, S, S);
    if (kind === 'turf') {
      // tufted rows of fibres + black rubber crumb
      for (let r = 0; r < S; r += 6) {
        x.fillStyle = `rgba(255,255,255,${0.06 + rng() * 0.05})`;
        x.fillRect(0, r, S, 2);
      }
      for (let i = 0; i < 26000; i++) {
        const v = 90 + rng() * 140 | 0;
        x.fillStyle = `rgba(${v},${v},${v},${0.35 + rng() * 0.4})`;
        const px = rng() * S, py = rng() * S;
        x.fillRect(px, py, 1, 2 + rng() * 3);
      }
      for (let i = 0; i < 9000; i++) {
        x.fillStyle = `rgba(10,10,10,${0.3 + rng() * 0.5})`;
        x.fillRect(rng() * S, rng() * S, 1 + rng() * 1.5, 1 + rng() * 1.5);
      }
    } else {
      for (let i = 0; i < 52000; i++) {
        const v = 60 + rng() * 190 | 0;
        x.strokeStyle = `rgba(${v},${v},${v},${0.25 + rng() * 0.45})`;
        x.lineWidth = 0.8 + rng() * 1.2;
        const px = rng() * S, py = rng() * S, l = 2 + rng() * 7, a = -Math.PI / 2 + (rng() - 0.5) * 1.6;
        x.beginPath();
        x.moveTo(px, py);
        x.lineTo(px + Math.cos(a) * l, py + Math.sin(a) * l);
        x.stroke();
      }
      for (let i = 0; i < 40; i++) blotch(x, rng() * S, rng() * S, 20 + rng() * 50, `rgba(${rng() < 0.5 ? '0,0,0' : '255,255,255'},0.08)`);
    }
    const t = tex(c, { srgb: false, aniso: 8 });
    return t;
  });
}

export function concreteTex(tone = '#9a9890', key = 'c') {
  return once(`concrete|${tone}|${key}`, () => {
    const [c, x] = cv(256, 256);
    const rng = makeRng('conc' + tone + key);
    x.fillStyle = tone;
    x.fillRect(0, 0, 256, 256);
    speckle(x, 256, 256, rng, 9000, ['#000000', '#ffffff', '#6a665e'], 0.03, 0.14, 1, 2);
    for (let i = 0; i < 16; i++) blotch(x, rng() * 256, rng() * 256, 10 + rng() * 50, `rgba(0,0,0,${0.05 + rng() * 0.08})`);
    for (let i = 0; i < 6; i++) blotch(x, rng() * 256, rng() * 256, 10 + rng() * 40, 'rgba(255,255,255,0.05)');
    x.strokeStyle = 'rgba(0,0,0,0.22)';
    x.lineWidth = 2;
    x.strokeRect(0, 0, 256, 256);
    return tex(c);
  });
}

/** One plastic seat back per repeat (u), alpha around it; tint with vertex colour. */
export function seatTex() {
  return once('seat', () => {
    const [c, x] = cv(64, 64);
    x.clearRect(0, 0, 64, 64);
    const g = x.createLinearGradient(0, 0, 0, 64);
    g.addColorStop(0, '#ffffff');
    g.addColorStop(0.7, '#d0d0d0');
    g.addColorStop(1, '#8a8a8a');
    x.fillStyle = g;
    x.beginPath();
    x.moveTo(8, 64);
    x.lineTo(7, 20);
    x.quadraticCurveTo(8, 4, 32, 4);
    x.quadraticCurveTo(56, 4, 57, 20);
    x.lineTo(56, 64);
    x.closePath();
    x.fill();
    x.fillStyle = 'rgba(255,255,255,0.35)';
    x.fillRect(14, 10, 36, 4);
    x.fillStyle = 'rgba(0,0,0,0.25)';
    x.fillRect(8, 56, 48, 8);
    const t = tex(c, { aniso: 4 });
    return t;
  });
}

/** Brushed aluminium bench / bleacher plank (tint with vertex colour). */
export function aluminiumTex() {
  return once('alu', () => {
    const [c, x] = cv(256, 64);
    const rng = makeRng('alu');
    const g = x.createLinearGradient(0, 0, 0, 64);
    g.addColorStop(0, '#f2f4f6');
    g.addColorStop(0.45, '#c5cacf');
    g.addColorStop(0.55, '#aeb4ba');
    g.addColorStop(1, '#d9dde1');
    x.fillStyle = g;
    x.fillRect(0, 0, 256, 64);
    for (let i = 0; i < 400; i++) {
      x.fillStyle = `rgba(${rng() < 0.5 ? '255,255,255' : '0,0,0'},${rng() * 0.08})`;
      x.fillRect(0, rng() * 64, 256, 1);
    }
    x.fillStyle = 'rgba(0,0,0,0.3)';
    for (let k = 0; k < 4; k++) x.fillRect(0, k * 16, 256, 1);
    for (let i = 0; i < 30; i++) blotch(x, rng() * 256, rng() * 64, 4 + rng() * 10, 'rgba(60,60,60,0.12)');
    return tex(c);
  });
}

export function brickTex(base = '#7a3a2a', key = 'b') {
  return once(`brick|${base}|${key}`, () => {
    const [c, x] = cv(256, 256);
    const rng = makeRng('brick' + base + key);
    x.fillStyle = '#4a3a32';
    x.fillRect(0, 0, 256, 256);
    const bc = new THREE.Color(base);
    for (let r = 0; r < 32; r++) {
      for (let k = -1; k < 9; k++) {
        const off = (r % 2) * 16;
        const v = 0.75 + rng() * 0.45;
        x.fillStyle = `rgb(${bc.r * 255 * v | 0},${bc.g * 255 * v | 0},${bc.b * 255 * v | 0})`;
        x.fillRect(k * 32 + off + 1, r * 8 + 1, 30, 6);
      }
    }
    speckle(x, 256, 256, rng, 4000, ['#000', '#fff', '#3a2a20'], 0.04, 0.15);
    for (let i = 0; i < 10; i++) {
      const sx = rng() * 256;
      const g = x.createLinearGradient(0, 0, 0, 256);
      g.addColorStop(0, 'rgba(0,0,0,0)');
      g.addColorStop(1, 'rgba(0,0,0,0.22)');
      x.fillStyle = g;
      x.fillRect(sx, rng() * 128, 3 + rng() * 10, 256);
    }
    return tex(c);
  });
}

/** Corrugated / panelled metal cladding (tint by vertex colour). */
export function claddingTex() {
  return once('clad', () => {
    const [c, x] = cv(128, 128);
    const rng = makeRng('clad');
    for (let i = 0; i < 128; i++) {
      const v = 175 + Math.sin(i / 128 * Math.PI * 16) * 45 | 0;
      x.fillStyle = `rgb(${v},${v},${v})`;
      x.fillRect(i, 0, 1, 128);
    }
    for (let i = 0; i < 12; i++) blotch(x, rng() * 128, rng() * 128, 8 + rng() * 30, 'rgba(80,60,40,0.12)');
    for (let i = 0; i < 8; i++) {
      const sx = rng() * 128;
      x.fillStyle = 'rgba(70,40,20,0.15)';
      x.fillRect(sx, rng() * 60, 2, 40 + rng() * 60);
    }
    return tex(c);
  });
}

/** Chain-link diamond mesh (alpha). */
export function chainLinkTex() {
  return once('chainlink', () => {
    const [c, x] = cv(64, 64);
    x.clearRect(0, 0, 64, 64);
    x.strokeStyle = 'rgba(205,210,214,1)';
    x.lineWidth = 2.4;
    for (let k = -64; k <= 64; k += 16) {
      x.beginPath(); x.moveTo(k, 0); x.lineTo(k + 64, 64); x.stroke();
      x.beginPath(); x.moveTo(k + 64, 0); x.lineTo(k, 64); x.stroke();
    }
    return tex(c, { aniso: 4 });
  });
}

/** Floodlight panel: one lamp per repeat. A bright disc in a dark housing. */
export function lampTex(warm = false) {
  return once('lamp' + (warm ? 'w' : 'c'), () => {
    const [c, x] = cv(64, 64);
    x.fillStyle = '#111316';
    x.fillRect(0, 0, 64, 64);
    x.fillStyle = '#26292e';
    x.fillRect(3, 3, 58, 58);
    const g = x.createRadialGradient(32, 32, 2, 32, 32, 27);
    g.addColorStop(0, '#ffffff');
    g.addColorStop(0.55, warm ? '#ffe3b0' : '#f2f6ff');
    g.addColorStop(0.85, warm ? '#c08040' : '#8ea4c8');
    g.addColorStop(1, '#1a1c20');
    x.fillStyle = g;
    x.beginPath(); x.arc(32, 32, 27, 0, Math.PI * 2); x.fill();
    return tex(c, { aniso: 4 });
  });
}

/** Soft radial glow sprite: intensity in RGB on black (for additive use). */
export function glowTex() {
  return once('glow', () => {
    const S = 128;
    const [c, x] = cv(S, S);
    const img = x.createImageData(S, S);
    const d = img.data;
    for (let j = 0; j < S; j++) {
      for (let i = 0; i < S; i++) {
        const u = (i + 0.5) / S * 2 - 1, v = (j + 0.5) / S * 2 - 1;
        const r = Math.min(1, Math.sqrt(u * u + v * v));
        // bright core, long soft tail, exactly zero at the rim
        const a = (Math.exp(-r * r * 18) * 0.75 + Math.exp(-r * r * 4.5) * 0.22 + (1 - r) * (1 - r) * 0.06) * (1 - r * r);
        const k = (j * S + i) * 4;
        d[k] = d[k + 1] = d[k + 2] = Math.round(Math.min(1, a) * 255);
        d[k + 3] = 255;
      }
    }
    x.putImageData(img, 0, 0);
    return tex(c, { srgb: false, repeat: false });
  });
}

/** Horizontal anamorphic streak. */
export function streakTex() {
  return once('flare', () => {
    const [c, x] = cv(256, 32);
    const img = x.createImageData(256, 32);
    const d = img.data;
    for (let j = 0; j < 32; j++) {
      for (let i = 0; i < 256; i++) {
        const u = (i / 255) * 2 - 1, v = (j / 31) * 2 - 1;
        const a = Math.exp(-u * u * 3.5) * Math.exp(-v * v * 9) * (1 - Math.abs(u));
        const k = (j * 256 + i) * 4;
        d[k] = d[k + 1] = d[k + 2] = Math.min(255, a * 255);
        d[k + 3] = 255;
      }
    }
    x.putImageData(img, 0, 0);
    return tex(c, { srgb: false, repeat: false });
  });
}

/** Light beam falloff: u across (soft edges), v along (fades away from the lamp). */
export function beamTex() {
  return once('beam', () => {
    const [c, x] = cv(64, 128);
    const img = x.createImageData(64, 128);
    const d = img.data;
    for (let j = 0; j < 128; j++) {
      for (let i = 0; i < 64; i++) {
        const u = (i / 63) * 2 - 1, v = j / 127;
        const a = Math.pow(Math.max(0, 1 - u * u), 1.5) * Math.pow(1 - v, 1.6);
        const k = (j * 64 + i) * 4;
        d[k] = d[k + 1] = d[k + 2] = a * 255;
        d[k + 3] = 255;
      }
    }
    x.putImageData(img, 0, 0);
    return tex(c, { srgb: false, repeat: false });
  });
}

// ------------------------------------------------------------------ signage

export const BRANDS = [
  ['NOVATRON', '#0c0f16', '#ffffff', '#46e8ff'],
  ['KUROSHIO', '#c8161e', '#ffffff', '#111111'],
  ['RAZOR FUEL', '#111111', '#ffd400', '#ff3a1a'],
  ['HALCYON BANK', '#0b2a6a', '#ffffff', '#46c0ff'],
  ['STATIC TIRES', '#f4f4f2', '#1d1d1d', '#d0231f'],
  ['MIDNIGHT 88.1', '#1a0a2a', '#ff4fb0', '#40e0ff'],
  ['BOLT COLA', '#e8241c', '#ffffff', '#ffd400'],
  ['IRONSIDE AUTO', '#2a2d33', '#f26a1b', '#ffffff'],
  ['CLEARWATER', '#0a6ab0', '#ffffff', '#9fe0ff'],
  ['GRIDIRON GRILL', '#6b1220', '#f2d48a', '#ffffff'],
  ['HARD COUNT', '#05070c', '#ffb21e', '#46e8ff'],
  ['TRI-STATE INSURANCE', '#ffffff', '#1a3a7a', '#c8161e'],
];

/** A strip of ads (each `aw` px wide). Returns the canvas texture. */
export function adStripTex(key, list, aw = 512, ah = 96, opts = {}) {
  return once(`ads|${key}|${aw}|${ah}`, () => {
    const [c, x] = cv(aw * list.length, ah);
    list.forEach(([name, bg, fg, ac], k) => {
      const x0 = k * aw;
      x.fillStyle = bg;
      x.fillRect(x0, 0, aw, ah);
      x.fillStyle = ac;
      x.fillRect(x0, ah - ah * 0.12, aw, ah * 0.12);
      if (opts.slash !== false) {
        x.beginPath();
        x.moveTo(x0 + aw * 0.04, ah * 0.88); x.lineTo(x0 + aw * 0.1, 0); x.lineTo(x0 + aw * 0.13, 0); x.lineTo(x0 + aw * 0.07, ah * 0.88);
        x.fill();
      }
      label(x, name, x0 + aw * 0.56, ah * 0.46, ah * 0.52, fg, { italic: true, max: aw * 0.78 });
      x.fillStyle = 'rgba(0,0,0,0.5)';
      x.fillRect(x0, 0, 2, ah);
    });
    return tex(c, { aniso: 8 });
  });
}

/** Building facade with windows (+ an emissive map of the lit ones). */
export function facadeTex(style, seed, opts = {}) {
  return once(`facade|${style}|${seed}|${opts.lit ?? ''}`, () => {
    const W = 256, H = 512;
    const [c, x] = cv(W, H);
    const [e, ex] = cv(W, H);
    const rng = makeRng(`fac${style}${seed}`);
    const bases = {
      brick: ['#6a3326', '#5b2c22'], tan: ['#9b8466', '#8a7458'], concrete: ['#7a7770', '#6c6962'],
      glass: ['#1c2733', '#16202a'], dark: ['#2a2a2e', '#232326'], white: ['#c9c7c0', '#b8b6ae'],
      teal: ['#1d4d58', '#163c45'],
    };
    const pal = bases[style] || bases.concrete;
    x.fillStyle = pal[0];
    x.fillRect(0, 0, W, H);
    ex.fillStyle = '#000';
    ex.fillRect(0, 0, W, H);
    speckle(x, W, H, rng, 6000, ['#000', '#fff'], 0.03, 0.12);
    if (style === 'brick') {
      x.strokeStyle = 'rgba(25,12,8,0.35)';
      x.lineWidth = 1;
      for (let y = 0; y < H; y += 5) {
        x.beginPath(); x.moveTo(0, y); x.lineTo(W, y); x.stroke();
      }
    }
    const glass = style === 'glass';
    const cols = glass ? 8 : (opts.cols || 6);
    const rows = glass ? 16 : (opts.rows || 12);
    const cw = W / cols, rh = H / rows;
    const litP = opts.lit ?? 0.3;
    for (let r = 0; r < rows; r++) {
      const floorK = rng();
      for (let k = 0; k < cols; k++) {
        const wx = k * cw + cw * 0.2, wy = r * rh + rh * 0.28;
        const ww = cw * 0.6, wh = rh * (glass ? 0.75 : 0.5);
        const lit = rng() < litP * (0.3 + floorK * 1.4);
        const warm = rng() < 0.72;
        if (glass) {
          x.fillStyle = lit ? (warm ? '#d8b880' : '#a8c8e8') : `rgb(${30 + rng() * 25 | 0},${44 + rng() * 25 | 0},${60 + rng() * 25 | 0})`;
          x.fillRect(k * cw + 1, r * rh + 1, cw - 2, rh - 2);
        } else {
          x.fillStyle = lit ? (warm ? '#f0cf8e' : '#c8dcf2') : `rgb(${16 + rng() * 18 | 0},${20 + rng() * 18 | 0},${28 + rng() * 22 | 0})`;
          x.fillRect(wx, wy, ww, wh);
          x.fillStyle = 'rgba(0,0,0,0.35)';
          x.fillRect(wx - 1, wy + wh, ww + 2, 2);
          if (opts.fireEscape && k % 3 === 1) { x.fillStyle = 'rgba(20,20,20,0.9)'; x.fillRect(wx - cw * 0.25, wy + wh + 2, ww + cw * 0.5, 3); }
        }
        if (lit) {
          ex.fillStyle = warm ? '#ffc078' : '#a0c4ff';
          ex.globalAlpha = 0.35 + rng() * 0.6;
          if (glass) ex.fillRect(k * cw + 1, r * rh + 1, cw - 2, rh - 2); else ex.fillRect(wx, wy, ww, wh);
          ex.globalAlpha = 1;
          if (rng() < 0.3) { x.fillStyle = 'rgba(0,0,0,0.35)'; x.fillRect(wx, wy, ww, wh * 0.45); }
        }
      }
    }
    if (opts.fireEscape) {
      x.strokeStyle = 'rgba(15,15,15,0.85)';
      x.lineWidth = 2;
      for (let k = 1; k < cols; k += 3) {
        for (let r = 0; r < rows; r++) {
          const y0 = r * rh + rh * 0.8;
          x.beginPath(); x.moveTo(k * cw - 4, y0); x.lineTo(k * cw + cw + 4, y0 - rh * 0.8); x.stroke();
        }
      }
    }
    for (let i = 0; i < 14; i++) {
      const g = x.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, 'rgba(0,0,0,0)');
      g.addColorStop(1, 'rgba(0,0,0,0.2)');
      x.fillStyle = g;
      x.fillRect(rng() * W, rng() * H * 0.5, 2 + rng() * 5, H);
    }
    return { map: tex(c), emi: tex(e) };
  });
}

/** Spray-paint graffiti wall section. */
export function graffitiTex(seed = 'g', base = '#8a7f72') {
  return once(`graffiti|${seed}|${base}`, () => {
    const W = 1024, H = 256;
    const [c, x] = cv(W, H);
    const rng = makeRng('graf' + seed);
    x.fillStyle = base;
    x.fillRect(0, 0, W, H);
    speckle(x, W, H, rng, 12000, ['#000', '#fff', '#5a5048'], 0.03, 0.15, 1, 2);
    // block joints
    x.strokeStyle = 'rgba(0,0,0,0.25)';
    x.lineWidth = 2;
    for (let y = 0; y < H; y += 32) { x.beginPath(); x.moveTo(0, y); x.lineTo(W, y); x.stroke(); }
    for (let y = 0; y < H; y += 32) for (let k = (y / 32) % 2 * 32; k < W; k += 64) { x.beginPath(); x.moveTo(k, y); x.lineTo(k, y + 32); x.stroke(); }
    const cols = ['#ff2a6a', '#2ae0ff', '#ffd02a', '#7aff4a', '#c84aff', '#ff6a1a', '#ffffff', '#1a1a1a', '#3a6aff'];
    const words = ['HARD', 'KNOX', 'ZEKE', 'DUST', 'CREW', 'VYBE', 'ORBIT', 'NOVA', 'RUSH', 'BLITZ', '7ON7', 'GRIND'];
    for (let k = 0; k < 6; k++) {
      const cx = 80 + k * 170 + (rng() - 0.5) * 50, cy = 80 + rng() * 110;
      const word = words[(rng() * words.length) | 0];
      const fill = cols[(rng() * cols.length) | 0], out = cols[(rng() * cols.length) | 0];
      const size = 54 + rng() * 40;
      x.save();
      x.translate(cx, cy);
      x.rotate((rng() - 0.5) * 0.35);
      x.font = `italic 900 ${size}px ${FONT}`;
      x.textAlign = 'center';
      x.textBaseline = 'middle';
      x.lineJoin = 'round';
      x.lineWidth = 14; x.strokeStyle = '#111'; x.strokeText(word, 0, 0);
      x.lineWidth = 8; x.strokeStyle = out; x.strokeText(word, 0, 0);
      const g = x.createLinearGradient(0, -size / 2, 0, size / 2);
      g.addColorStop(0, fill);
      g.addColorStop(1, cols[(rng() * cols.length) | 0]);
      x.fillStyle = g;
      x.fillText(word, 0, 0);
      // drips
      x.fillStyle = fill;
      for (let d = 0; d < 5; d++) x.fillRect((rng() - 0.5) * size * 1.6, size * 0.3, 2, 8 + rng() * 26);
      x.restore();
    }
    // tags
    x.strokeStyle = 'rgba(20,20,20,0.85)';
    x.lineWidth = 3;
    for (let k = 0; k < 18; k++) {
      x.beginPath();
      let px = rng() * W, py = 20 + rng() * (H - 40);
      x.moveTo(px, py);
      for (let s = 0; s < 6; s++) { px += 6 + rng() * 14; py += (rng() - 0.5) * 22; x.lineTo(px, py); }
      x.stroke();
    }
    // grime at the foot
    const g = x.createLinearGradient(0, H * 0.75, 0, H);
    g.addColorStop(0, 'rgba(30,25,20,0)');
    g.addColorStop(1, 'rgba(30,25,20,0.5)');
    x.fillStyle = g;
    x.fillRect(0, H * 0.75, W, H * 0.25);
    return tex(c);
  });
}

/** Banner cloth with text (school spirit, championships). */
export function bannerTex(key, lines, bg, fg, accent, w = 256, h = 512) {
  return once(`banner|${key}`, () => {
    const [c, x] = cv(w, h);
    x.fillStyle = bg;
    x.fillRect(0, 0, w, h);
    x.fillStyle = accent;
    x.fillRect(0, 0, w, h * 0.06);
    x.fillRect(0, h * 0.94, w, h * 0.06);
    x.fillRect(w * 0.06, 0, w * 0.03, h);
    x.fillRect(w * 0.91, 0, w * 0.03, h);
    const n = lines.length;
    lines.forEach((s, k) => label(x, s, w / 2, h * (0.2 + 0.62 * (k + 0.5) / n), Math.min(h / n * 0.5, w * 0.3), fg, { max: w * 0.78 }));
    const rng = makeRng('banner' + key);
    speckle(x, w, h, rng, 2000, ['#000', '#fff'], 0.02, 0.08);
    return tex(c, { repeat: false });
  });
}

/**
 * Stadium exterior: precast panels between columns, a concourse band with lit
 * openings (emissive map), a team-colour stripe. One repeat = 16 × 16 yd.
 */
export function exteriorTex(key, base = '#b8b6ae', accent = '#1a3a7a', opts = {}) {
  return once(`ext|${key}|${base}|${accent}`, () => {
    const W = 512, H = 512;
    const [c, x] = cv(W, H);
    const [e, ex] = cv(W, H);
    const rng = makeRng('ext' + key);
    x.fillStyle = base;
    x.fillRect(0, 0, W, H);
    ex.fillStyle = '#000';
    ex.fillRect(0, 0, W, H);
    speckle(x, W, H, rng, 9000, ['#000', '#fff'], 0.02, 0.1, 1, 2);
    // panel joints
    x.strokeStyle = 'rgba(0,0,0,0.18)';
    x.lineWidth = 2;
    for (let y = 0; y <= H; y += 64) { x.beginPath(); x.moveTo(0, y); x.lineTo(W, y); x.stroke(); }
    for (let xx = 0; xx <= W; xx += 128) { x.beginPath(); x.moveTo(xx, 0); x.lineTo(xx, H); x.stroke(); }
    // columns
    for (const cx of [0, 256]) {
      const g = x.createLinearGradient(cx - 20, 0, cx + 20, 0);
      g.addColorStop(0, 'rgba(0,0,0,0.25)');
      g.addColorStop(0.3, 'rgba(255,255,255,0.12)');
      g.addColorStop(1, 'rgba(0,0,0,0.3)');
      x.fillStyle = g;
      x.fillRect(cx - 20, 0, 40, H);
      x.fillRect(cx + W - 20, 0, 40, H);
    }
    // concourse band: dark openings with warm light behind
    const oy = opts.bandY ?? 300, oh = opts.bandH ?? 84;
    for (let k = 0; k < 4; k++) {
      const ox = 32 + k * 128;
      if (k === 0 || k === 2) continue;
      x.fillStyle = '#1a1814';
      x.fillRect(ox, oy, 192 - 64, oh);
      ex.fillStyle = '#ffc890';
      ex.globalAlpha = 0.55;
      ex.fillRect(ox + 4, oy + 4, 120, oh - 8);
      ex.globalAlpha = 1;
      x.fillStyle = 'rgba(60,40,20,0.8)';
      for (let p = 0; p < 4; p++) x.fillRect(ox + 10 + rng() * 100, oy + oh - 34, 9, 30);
    }
    for (const ox of [32, 288]) {
      x.fillStyle = '#20242a';
      x.fillRect(ox + 16, oy, 96, oh);
      ex.fillStyle = '#ffdcae';
      ex.globalAlpha = 0.35;
      ex.fillRect(ox + 20, oy + 4, 88, oh - 8);
      ex.globalAlpha = 1;
    }
    // team stripe + grime
    x.fillStyle = accent;
    x.fillRect(0, oy - 34, W, 14);
    x.fillRect(0, 40, W, 10);
    for (let i = 0; i < 16; i++) {
      const g = x.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, 'rgba(0,0,0,0)');
      g.addColorStop(1, 'rgba(0,0,0,0.18)');
      x.fillStyle = g;
      x.fillRect(rng() * W, rng() * 200, 3 + rng() * 8, H);
    }
    return { map: tex(c), emi: tex(e) };
  });
}

export function resetTexCache() {
  for (const v of cache.values()) {
    if (v && v.isTexture) v.dispose();
    else if (v && v.map) { v.map.dispose?.(); v.emi?.dispose?.(); }
  }
  cache.clear();
}
