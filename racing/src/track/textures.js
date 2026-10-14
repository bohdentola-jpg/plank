// Procedural canvas textures for the world. Cached by key; all color maps are
// tagged sRGB, data maps (roughness) linear.
import * as THREE from 'three';
import { makeRng } from '../core/util.js';

const cache = new Map();

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

export function toTex(c, { srgb = true, repeat = true, aniso = 8 } = {}) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = aniso;
  return t;
}

function cached(key, fn) {
  if (!cache.has(key)) cache.set(key, fn());
  return cache.get(key);
}

/** Speckle noise fill. */
function grain(ctx, w, h, rng, amount, size = 1, light = '255,255,255', dark = '0,0,0') {
  const n = Math.floor(w * h * amount);
  for (let i = 0; i < n; i++) {
    const x = rng() * w, y = rng() * h;
    const a = rng() * 0.25;
    ctx.fillStyle = rng() < 0.5 ? `rgba(${light},${a})` : `rgba(${dark},${a})`;
    ctx.fillRect(x, y, size, size);
  }
}

function blotches(ctx, w, h, rng, n, color, rMin, rMax, alpha = 0.2) {
  for (let i = 0; i < n; i++) {
    const x = rng() * w, y = rng() * h, r = rMin + rng() * (rMax - rMin);
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `rgba(${color},${alpha})`);
    g.addColorStop(1, `rgba(${color},0)`);
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
}

/**
 * Road surface. u spans the full road width; v covers `repeat` meters.
 * style: { lanes, center: 'double-yellow'|'dashed-white'|'yellow-dashed'|'none',
 *          edge: 'white'|'yellow'|'none', base: '#2a2b2e', worn: 0..1, wet: bool }
 */
export function roadTextures(width, style = {}) {
  const key = `road|${width}|${JSON.stringify(style)}`;
  return cached(key, () => {
    const W = 512, H = 512;
    const repeat = style.repeat || 12; // meters per texture tile
    const c = canvas(W, H);
    const x = c.getContext('2d');
    const r = canvas(W, H); // roughness (G)
    const rx = r.getContext('2d');
    const rng = makeRng(`road${width}${style.center}`);
    const pxPerM = W / width;
    x.fillStyle = style.base || '#3c3d41';
    x.fillRect(0, 0, W, H);
    rx.fillStyle = `rgb(0,${Math.round((style.wet ? 0.32 : 0.82) * 255)},0)`;
    rx.fillRect(0, 0, W, H);
    // aggregate
    grain(x, W, H, rng, 0.9, 1, '210,210,210', '0,0,0');
    grain(x, W, H, rng, 0.08, 2, '160,160,160', '10,10,10');
    // patches & cracks
    blotches(x, W, H, rng, 10, '0,0,0', 20, 70, 0.18);
    blotches(x, W, H, rng, 6, '90,90,95', 20, 60, 0.08);
    // repair patches (rectangles)
    for (let i = 0; i < 3; i++) {
      x.fillStyle = `rgba(${rng() < 0.5 ? '18,18,20' : '60,60,64'},0.35)`;
      x.fillRect(rng() * W, rng() * H, 30 + rng() * 90, 20 + rng() * 80);
    }
    x.strokeStyle = 'rgba(8,8,10,0.55)';
    x.lineWidth = 1.2;
    for (let i = 0; i < 9; i++) {
      x.beginPath();
      let px = rng() * W, py = rng() * H;
      x.moveTo(px, py);
      for (let k = 0; k < 6; k++) { px += (rng() - 0.5) * 40; py += rng() * 30; x.lineTo(px, py); }
      x.stroke();
    }
    // tire-worn lanes (darker, smoother)
    const lanes = style.lanes || Math.max(2, Math.round(width / 3.6));
    const laneW = width / lanes;
    for (let l = 0; l < lanes; l++) {
      for (const off of [0.28, 0.72]) {
        const cx = (l * laneW + laneW * off) * pxPerM;
        const g = x.createLinearGradient(cx - 14, 0, cx + 14, 0);
        g.addColorStop(0, 'rgba(0,0,0,0)');
        g.addColorStop(0.5, `rgba(0,0,0,${0.12 + (style.worn || 0.3) * 0.15})`);
        g.addColorStop(1, 'rgba(0,0,0,0)');
        x.fillStyle = g;
        x.fillRect(cx - 14, 0, 28, H);
        if (style.wet) {
          rx.fillStyle = 'rgba(0,40,0,0.5)';
          rx.fillRect(cx - 10, 0, 20, H);
        }
      }
    }
    // puddles (wet: very low roughness, slightly darker)
    if (style.wet) {
      for (let i = 0; i < 7; i++) {
        const px = rng() * W, py = rng() * H, pr = 18 + rng() * 50;
        const g = rx.createRadialGradient(px, py, 0, px, py, pr);
        g.addColorStop(0, 'rgba(0,8,0,1)');
        g.addColorStop(1, 'rgba(0,8,0,0)');
        rx.fillStyle = g;
        rx.fillRect(px - pr, py - pr, pr * 2, pr * 2);
        const g2 = x.createRadialGradient(px, py, 0, px, py, pr);
        g2.addColorStop(0, 'rgba(0,0,0,0.25)');
        g2.addColorStop(1, 'rgba(0,0,0,0)');
        x.fillStyle = g2;
        x.fillRect(px - pr, py - pr, pr * 2, pr * 2);
      }
    }
    // markings
    const paint = (u0m, wm, color, dash = null, alpha = 0.9) => {
      x.fillStyle = color;
      x.globalAlpha = alpha * (1 - (style.worn || 0.3) * 0.35);
      const px0 = u0m * pxPerM, pw = Math.max(2, wm * pxPerM);
      if (!dash) x.fillRect(px0, 0, pw, H);
      else {
        const [on, period] = dash;
        const onPx = on / repeat * H, perPx = period / repeat * H;
        for (let y = 0; y < H; y += perPx) x.fillRect(px0, y, pw, onPx);
      }
      x.globalAlpha = 1;
      rx.fillStyle = 'rgba(0,150,0,0.6)';
      if (!dash) rx.fillRect(px0, 0, pw, H);
    };
    const edge = style.edge ?? 'white';
    if (edge !== 'none') {
      const ec = edge === 'yellow' ? '#d9b23a' : '#e9e9e4';
      paint(0.35, 0.15, ec);
      paint(width - 0.5, 0.15, ec);
    }
    const center = style.center ?? 'dashed-white';
    if (center === 'double-yellow') {
      paint(width / 2 - 0.2, 0.12, '#d6a92c');
      paint(width / 2 + 0.08, 0.12, '#d6a92c');
    } else if (center === 'yellow-dashed') {
      paint(width / 2 - 0.06, 0.12, '#d6a92c', [3, 6]);
    } else if (center === 'dashed-white') {
      for (let l = 1; l < lanes; l++) paint(l * laneW - 0.06, 0.12, '#e6e6e0', [3, 9]);
    } else if (center === 'lanes-solid') {
      for (let l = 1; l < lanes; l++) paint(l * laneW - 0.06, 0.12, '#e6e6e0');
    }
    // grime over paint
    grain(x, W, H, rng, 0.25, 1, '200,200,200', '0,0,0');
    const map = toTex(c);
    const rough = toTex(r, { srgb: false });
    return { map, rough, repeat };
  });
}

export function curbTexture() {
  return cached('curb', () => {
    const c = canvas(64, 128);
    const x = c.getContext('2d');
    for (let i = 0; i < 2; i++) {
      x.fillStyle = i ? '#e8e8e6' : '#c8161e';
      x.fillRect(0, i * 64, 64, 64);
    }
    const rng = makeRng('curb');
    grain(x, 64, 128, rng, 0.4, 1);
    return toTex(c);
  });
}

export function concreteTexture(tone = '#8d8c88', key = 'c') {
  return cached(`concrete|${tone}|${key}`, () => {
    const c = canvas(256, 256);
    const x = c.getContext('2d');
    x.fillStyle = tone;
    x.fillRect(0, 0, 256, 256);
    const rng = makeRng('conc' + tone + key);
    grain(x, 256, 256, rng, 0.8, 1);
    blotches(x, 256, 256, rng, 14, '0,0,0', 10, 50, 0.12);
    blotches(x, 256, 256, rng, 6, '255,255,255', 10, 40, 0.05);
    // slab joints
    x.strokeStyle = 'rgba(0,0,0,0.35)';
    x.lineWidth = 2;
    x.strokeRect(0, 0, 256, 256);
    x.beginPath(); x.moveTo(128, 0); x.lineTo(128, 256); x.stroke();
    return toTex(c);
  });
}

export function groundTexture(kind) {
  return cached(`ground|${kind}`, () => {
    const S = 256;
    const c = canvas(S, S);
    const x = c.getContext('2d');
    const rng = makeRng('ground' + kind);
    const pal = {
      grass: ['#3d5a26', '#4a6b2c', '#2f4a1d', '#5c7a35'],
      drygrass: ['#7d7346', '#8f8452', '#6b6038', '#9c9060'],
      sand: ['#c9a874', '#d6b884', '#b8955f', '#e0c595'],
      dirt: ['#6e5a42', '#7d684d', '#5a4835', '#8a7457'],
      gravel: ['#8c877d', '#9b968c', '#77736b', '#aaa59a'],
      rock: ['#6f6a64', '#807a72', '#5a5650', '#8e887f'],
      redrock: ['#a2563a', '#b4673f', '#8a4630', '#c07a52'],
      snow: ['#e8ecf0', '#f4f6f8', '#d6dce3', '#ffffff'],
      asphaltlot: ['#3a3b3e', '#414246', '#323336', '#48494d'],
    }[kind] || ['#555', '#666', '#444', '#777'];
    x.fillStyle = pal[0];
    x.fillRect(0, 0, S, S);
    for (let i = 0; i < 2600; i++) {
      x.fillStyle = pal[1 + Math.floor(rng() * 3)];
      x.globalAlpha = 0.25 + rng() * 0.35;
      const r = 1 + rng() * (kind === 'gravel' || kind === 'rock' ? 3 : 2);
      x.fillRect(rng() * S, rng() * S, r, kind === 'grass' || kind === 'drygrass' ? r * 2.5 : r);
    }
    x.globalAlpha = 1;
    blotches(x, S, S, rng, 12, '0,0,0', 15, 60, 0.12);
    if (kind === 'rock' || kind === 'redrock') {
      x.strokeStyle = 'rgba(0,0,0,0.3)';
      for (let i = 0; i < 14; i++) {
        x.beginPath();
        const y = rng() * S;
        x.moveTo(0, y);
        for (let k = 0; k <= 8; k++) x.lineTo(k * S / 8, y + (rng() - 0.5) * 16);
        x.lineWidth = 1 + rng() * 2;
        x.stroke();
      }
    }
    return toTex(c);
  });
}

/** Building facade: windows grid with lit/unlit panes + emissive mask. */
export function facadeTextures(style, seed) {
  return cached(`facade|${style}|${seed}`, () => {
    const W = 256, H = 512;
    const c = canvas(W, H);
    const e = canvas(W, H);
    const x = c.getContext('2d');
    const ex = e.getContext('2d');
    const rng = makeRng(`fac${style}${seed}`);
    const bases = {
      brick: ['#5b2e24', '#6a3629', '#4e271f'],
      concrete: ['#77736c', '#86827a', '#6a665f'],
      glass: ['#1c2733', '#22303e', '#16202a'],
      stucco: ['#9b8f7a', '#a89c86', '#8d826e'],
      dark: ['#2a2a2e', '#323236', '#232326'],
      warehouse: ['#5d6266', '#6a6f73', '#50555a'],
    };
    const pal = bases[style] || bases.concrete;
    x.fillStyle = pal[0];
    x.fillRect(0, 0, W, H);
    ex.fillStyle = '#000';
    ex.fillRect(0, 0, W, H);
    grain(x, W, H, rng, 0.5, 1);
    if (style === 'brick') {
      x.strokeStyle = 'rgba(30,15,10,0.35)';
      x.lineWidth = 1;
      for (let y = 0; y < H; y += 6) {
        x.beginPath(); x.moveTo(0, y); x.lineTo(W, y); x.stroke();
        for (let xx = (y / 6) % 2 ? 0 : 7; xx < W; xx += 14) { x.beginPath(); x.moveTo(xx, y); x.lineTo(xx, y + 6); x.stroke(); }
      }
    }
    const cols = style === 'glass' ? 8 : style === 'warehouse' ? 4 : 6;
    const rows = style === 'glass' ? 16 : 12;
    const cw = W / cols, rh = H / rows;
    const litP = style === 'warehouse' ? 0.1 : 0.2;
    for (let r = 0; r < rows; r++) {
      for (let k = 0; k < cols; k++) {
        const wx = k * cw + cw * 0.24, wy = r * rh + rh * 0.3;
        const ww = cw * 0.52, wh = rh * (style === 'glass' ? 0.7 : 0.46);
        // whole floors tend to be dark or lit together (offices at night)
        const floorLit = ((r * 7919 + seed.length * 31) % 5) / 5;
        const lit = rng() < litP * (0.4 + floorLit * 1.4);
        const warm = rng() < 0.75;
        if (style === 'glass') {
          x.fillStyle = lit ? (warm ? '#e8c890' : '#bcd8f0') : `rgba(${40 + rng() * 30},${60 + rng() * 30},${80 + rng() * 30},1)`;
          x.fillRect(k * cw + 1, r * rh + 1, cw - 2, rh - 2);
        } else {
          x.fillStyle = lit ? (warm ? '#f0cf8e' : '#c8dcf2') : `rgb(${18 + rng() * 20},${22 + rng() * 20},${30 + rng() * 25})`;
          x.fillRect(wx, wy, ww, wh);
          x.fillStyle = 'rgba(0,0,0,0.35)';
          x.fillRect(wx, wy + wh, ww, 2);
        }
        if (lit) {
          ex.fillStyle = warm ? '#ffbe78' : '#9cc0ff';
          ex.globalAlpha = 0.25 + rng() * 0.45;
          if (style === 'glass') ex.fillRect(k * cw + 1, r * rh + 1, cw - 2, rh - 2);
          else ex.fillRect(wx, wy, ww, wh);
          ex.globalAlpha = 1;
          // blinds / silhouettes
          if (rng() < 0.3) { x.fillStyle = 'rgba(0,0,0,0.3)'; x.fillRect(wx, wy, ww, wh * 0.4); }
        }
      }
    }
    // grime streaks
    for (let i = 0; i < 20; i++) {
      const sx = rng() * W;
      const g = x.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, 'rgba(0,0,0,0)');
      g.addColorStop(1, 'rgba(0,0,0,0.2)');
      x.fillStyle = g;
      x.fillRect(sx, rng() * H * 0.5, 2 + rng() * 6, H);
    }
    const map = toTex(c);
    const emi = toTex(e);
    return { map, emi };
  });
}

/** Simple shopfront strip for ground floors: lit windows, awnings, signs. */
export function shopfrontTextures(seed) {
  return cached(`shop|${seed}`, () => {
    const W = 512, H = 128;
    const c = canvas(W, H), e = canvas(W, H);
    const x = c.getContext('2d'), ex = e.getContext('2d');
    const rng = makeRng('shop' + seed);
    x.fillStyle = '#2a2724';
    x.fillRect(0, 0, W, H);
    ex.fillStyle = '#000';
    ex.fillRect(0, 0, W, H);
    const units = 4;
    const uw = W / units;
    const signs = ['24H', 'BAR', 'RAMEN', 'PAWN', 'LIQUOR', 'DINER', 'TATTOO', 'ARCADE', 'PIZZA', 'MOTEL', 'KARAOKE', 'AUTO PARTS', 'VIDEO', 'NOODLES', 'CLUB', 'TIRES'];
    const neon = ['#ff2a6a', '#2ae0ff', '#ffb02a', '#7aff4a', '#c84aff', '#ff5a2a'];
    for (let u = 0; u < units; u++) {
      const x0 = u * uw;
      const lit = rng() < 0.7;
      // window
      x.fillStyle = lit ? '#8a6a44' : '#15181d';
      x.fillRect(x0 + 10, 50, uw - 20, 66);
      if (lit) {
        ex.fillStyle = '#b8824a';
        ex.globalAlpha = 0.35;
        ex.fillRect(x0 + 10, 50, uw - 20, 66);
        ex.globalAlpha = 1;
        x.fillStyle = 'rgba(40,20,10,0.4)';
        for (let k = 0; k < 3; k++) x.fillRect(x0 + 16 + rng() * (uw - 50), 70 + rng() * 30, 14, 30);
      }
      // door frame
      x.fillStyle = '#111';
      x.fillRect(x0 + uw * 0.7, 56, uw * 0.18, 60);
      // neon sign
      const txt = signs[Math.floor(rng() * signs.length)];
      const col = neon[Math.floor(rng() * neon.length)];
      x.font = 'bold 22px Arial, sans-serif';
      x.textAlign = 'center';
      x.fillStyle = col;
      x.fillText(txt, x0 + uw / 2, 38);
      ex.font = 'bold 22px Arial, sans-serif';
      ex.textAlign = 'center';
      ex.fillStyle = col;
      ex.shadowColor = col;
      ex.shadowBlur = 10;
      ex.fillText(txt, x0 + uw / 2, 38);
      ex.shadowBlur = 0;
    }
    return { map: toTex(c), emi: toTex(e) };
  });
}

/** Radial glow sprite (for lamp heads, light streaks). */
export function glowTexture() {
  return cached('glow', () => {
    const c = canvas(64, 64);
    const x = c.getContext('2d');
    const g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.25, 'rgba(255,255,255,0.55)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g;
    x.fillRect(0, 0, 64, 64);
    return toTex(c, { repeat: false });
  });
}

/** Vertical light-streak (wet road reflection) sprite. Row 0 is the viewer's
 *  end of the streak, the bottom row sits under the light (uv.y = 0 there). */
export function streakTexture() {
  return cached('streak', () => {
    const W = 32, H = 256;
    const c = canvas(W, H);
    const x = c.getContext('2d');
    const img = x.createImageData(W, H);
    const d = img.data;
    const ss = (a, b, v) => { const t = Math.min(1, Math.max(0, (v - a) / (b - a))); return t * t * (3 - 2 * t); };
    for (let py = 0; py < H; py++) {
      const t = py / (H - 1);
      const along = ss(0, 0.5, t) * (1 - ss(0.82, 1, t));
      for (let px = 0; px < W; px++) {
        const u = (px / (W - 1)) * 2 - 1;
        const k = (py * W + px) * 4;
        d[k] = d[k + 1] = d[k + 2] = 255;
        d[k + 3] = Math.round(along * Math.exp(-u * u * 4.5) * 255);
      }
    }
    x.putImageData(img, 0, 0);
    return toTex(c, { repeat: false });
  });
}

/** Text/graphic billboard. */
export function billboardTexture(lines, bg = '#1a1a1a', fg = '#fff', accent = '#ff3355', seed = 'b') {
  return cached(`bb|${lines.join('|')}|${bg}|${fg}|${accent}`, () => {
    const W = 512, H = 256;
    const c = canvas(W, H);
    const x = c.getContext('2d');
    const g = x.createLinearGradient(0, 0, W, H);
    g.addColorStop(0, bg);
    g.addColorStop(1, '#000');
    x.fillStyle = g;
    x.fillRect(0, 0, W, H);
    x.fillStyle = accent;
    x.fillRect(0, H - 40, W, 40);
    x.textAlign = 'left';
    x.fillStyle = fg;
    x.font = 'italic 900 64px Arial Black, Arial, sans-serif';
    x.fillText(lines[0] || '', 26, 92);
    x.font = 'bold 30px Arial, sans-serif';
    x.fillText(lines[1] || '', 30, 146);
    x.fillStyle = '#000';
    x.font = 'bold 24px Arial, sans-serif';
    x.fillText(lines[2] || '', 30, H - 12);
    const rng = makeRng(seed);
    grain(x, W, H, rng, 0.3, 1);
    return toTex(c, { repeat: false });
  });
}
