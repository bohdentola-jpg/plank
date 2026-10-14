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
    // one repeat = 10 m of street: two 5 m storefronts, 4.3 m tall
    const W = 1024, H = 448, UW = 512;
    const c = canvas(W, H), e = canvas(W, H);
    const x = c.getContext('2d'), ex = e.getContext('2d');
    const rng = makeRng('shop' + seed);
    const pick = (a) => a[Math.floor(rng() * a.length)];
    x.fillStyle = '#26221f';
    x.fillRect(0, 0, W, H);
    ex.fillStyle = '#000';
    ex.fillRect(0, 0, W, H);
    const neon = ['#ff2a6a', '#2ae0ff', '#ffb02a', '#7aff4a', '#c84aff', '#ff5a2a', '#ffffff'];
    const TYPES = {
      store: { light: '#fff6dc', glow: 0.75, back: '#d9d2bd', signs: ['24H MART', 'LIQUOR', 'DELI', 'PHARMACY', 'MINI MART'] },
      diner: { light: '#ffcf8a', glow: 0.7, back: '#c98a5a', signs: ['DINER', 'PIZZA', 'NOODLES', 'RAMEN', 'TACOS', 'BURGERS'] },
      laundry: { light: '#e8f4ff', glow: 0.8, back: '#dde6ea', signs: ['LAUNDROMAT', 'COIN LAUNDRY', 'WASH & FOLD'] },
      bar: { light: '#ff7a5a', glow: 0.3, back: '#3a1f1c', signs: ['BAR', 'LOUNGE', 'KARAOKE', 'CLUB', 'TAVERN'] },
      shutter: { light: null, signs: ['AUTO PARTS', 'TIRES', 'VIDEO', 'ARCADE', 'TATTOO', 'PHOTO'] },
      pawn: { light: '#ffe08a', glow: 0.6, back: '#b8a06a', signs: ['PAWN', 'GOLD & PAWN', 'CHECKS CASHED'] },
      dark: { light: null, signs: ['FOR LEASE', 'CLOSED', 'SHOES'] },
    };
    const kinds = ['store', 'diner', 'laundry', 'bar', 'shutter', 'pawn', 'dark', 'store', 'diner', 'bar'];
    for (let u = 0; u < 2; u++) {
      const x0 = u * UW;
      const kind = pick(kinds);
      const T = TYPES[kind];
      // pilasters (stone) + kick plate
      x.fillStyle = '#5a5249';
      x.fillRect(x0, 0, 18, H); x.fillRect(x0 + UW - 18, 0, 18, H);
      x.fillStyle = '#1a1816';
      x.fillRect(x0, H - 22, UW, 22);
      // window + door openings
      const wy0 = 128, wy1 = H - 26;
      const doorW = 112, doorX = u % 2 ? x0 + 30 : x0 + UW - 30 - doorW;
      const winX0 = u % 2 ? doorX + doorW + 12 : x0 + 30, winX1 = u % 2 ? x0 + UW - 30 : doorX - 12;
      const lit = !!T.light;
      // interior
      const interior = (ax, aw) => {
        if (!lit) {
          x.fillStyle = '#0c0e12';
          x.fillRect(ax, wy0, aw, wy1 - wy0);
          return;
        }
        x.fillStyle = T.back;
        x.fillRect(ax, wy0, aw, wy1 - wy0);
        // ceiling lights
        x.fillStyle = '#ffffff';
        for (let k = 0; k < 3; k++) x.fillRect(ax + 10 + k * (aw / 3), wy0 + 6, aw / 3 - 30, 6);
        if (kind === 'store' || kind === 'pawn') {
          for (let row = 0; row < 4; row++) {
            const ry = wy0 + 50 + row * 52;
            x.fillStyle = '#6a6458';
            x.fillRect(ax + 6, ry + 34, aw - 12, 6);
            for (let k = 0; k < aw / 14; k++) {
              x.fillStyle = pick(['#c8322a', '#2a6ac8', '#e8c22a', '#3a9a4a', '#f2f2f2', '#d86a2a', '#7a3ac8']);
              x.fillRect(ax + 8 + k * 14, ry + 8 + rng() * 8, 10, 26);
            }
          }
          if (kind === 'pawn') { // security bars
            x.fillStyle = '#2a2a2a';
            for (let k = ax; k < ax + aw; k += 22) x.fillRect(k, wy0, 5, wy1 - wy0);
          }
        } else if (kind === 'diner') {
          for (let k = 0; k < 3; k++) {
            const bx = ax + 20 + k * (aw / 3);
            x.fillStyle = '#a3241c';
            x.fillRect(bx, wy1 - 120, aw / 3 - 40, 70);
            x.fillStyle = '#e8e2d0';
            x.fillRect(bx + 10, wy1 - 140, aw / 3 - 60, 14);
            x.fillStyle = '#ffd890';
            x.beginPath(); x.arc(bx + (aw / 3 - 40) / 2, wy0 + 60, 12, 0, Math.PI * 2); x.fill();
          }
          x.fillStyle = 'rgba(40,20,10,0.55)';
          for (let k = 0; k < 2; k++) x.fillRect(ax + 30 + rng() * (aw - 80), wy1 - 190, 26, 70); // diners
        } else if (kind === 'laundry') {
          for (let k = 0; k < aw / 70; k++) {
            const mx = ax + 10 + k * 70;
            x.fillStyle = '#f4f6f8';
            x.fillRect(mx, wy1 - 150, 60, 120);
            x.fillStyle = '#20262c';
            x.beginPath(); x.arc(mx + 30, wy1 - 95, 20, 0, Math.PI * 2); x.fill();
            x.fillStyle = '#7ab0d8';
            x.beginPath(); x.arc(mx + 30, wy1 - 95, 14, 0, Math.PI * 2); x.fill();
          }
        } else if (kind === 'bar') {
          for (let k = 0; k < 3; k++) {
            const col = pick(neon);
            const bx = ax + 20 + rng() * (aw - 100), by = wy0 + 30 + rng() * 120;
            x.strokeStyle = col; x.lineWidth = 4;
            x.strokeRect(bx, by, 70, 40);
            ex.strokeStyle = col; ex.lineWidth = 6; ex.shadowColor = col; ex.shadowBlur = 14;
            ex.strokeRect(bx, by, 70, 40);
            ex.shadowBlur = 0;
          }
          x.fillStyle = 'rgba(10,5,5,0.7)';
          for (let k = 0; k < 3; k++) x.fillRect(ax + 20 + rng() * (aw - 60), wy1 - 170, 28, 80);
        }
        // interior glow into the emissive map
        const g = ex.createLinearGradient(0, wy0, 0, wy1);
        g.addColorStop(0, T.light);
        g.addColorStop(1, 'rgba(0,0,0,0)');
        ex.globalAlpha = T.glow;
        ex.fillStyle = g;
        ex.fillRect(ax, wy0, aw, wy1 - wy0);
        ex.globalAlpha = T.glow * 0.5;
        ex.fillStyle = T.light;
        ex.fillRect(ax, wy0, aw, wy1 - wy0);
        ex.globalAlpha = 1;
      };
      if (kind === 'shutter') {
        // corrugated roll-down gate over everything
        for (let yy = wy0 - 4; yy < wy1; yy += 8) {
          x.fillStyle = (yy / 8) % 2 ? '#7a7c80' : '#8e9095';
          x.fillRect(x0 + 26, yy, UW - 52, 8);
        }
        x.fillStyle = '#4a4c50';
        x.fillRect(x0 + 26, wy0 - 14, UW - 52, 12);
        // graffiti
        x.save();
        x.translate(x0 + 60 + rng() * 200, wy0 + 150 + rng() * 100);
        x.rotate((rng() - 0.5) * 0.3);
        x.font = 'italic 900 64px Arial Black, Arial';
        x.lineWidth = 6;
        x.strokeStyle = '#111';
        const tag = pick(['KZ', 'SLAB', 'DUB', 'RYZ', 'NITRO', '88']);
        x.strokeText(tag, 0, 0);
        x.fillStyle = pick(['#ff3d6e', '#46e8ff', '#e8f048', '#9a5bff']);
        x.fillText(tag, 0, 0);
        x.restore();
      } else {
        interior(winX0, winX1 - winX0);
        interior(doorX, doorW);
        // mullions + frames
        x.fillStyle = '#16181a';
        x.fillRect(winX0 - 6, wy0 - 6, winX1 - winX0 + 12, 8);
        x.fillRect(winX0 - 6, wy1 - 4, winX1 - winX0 + 12, 6);
        const panes = Math.max(1, Math.round((winX1 - winX0) / 130));
        for (let k = 0; k <= panes; k++) x.fillRect(winX0 - 4 + k * ((winX1 - winX0) / panes), wy0, 7, wy1 - wy0);
        x.fillRect(doorX - 5, wy0 - 6, doorW + 10, 8);
        x.fillRect(doorX - 5, wy0, 7, wy1 - wy0);
        x.fillRect(doorX + doorW - 2, wy0, 7, wy1 - wy0);
        x.fillStyle = '#b8b8b8';
        x.fillRect(doorX + 14, wy0 + 150, doorW - 28, 8); // push bar
        // glass reflection streaks
        x.save();
        x.globalAlpha = lit ? 0.12 : 0.25;
        x.fillStyle = '#ffffff';
        for (let k = 0; k < 3; k++) {
          const sx = winX0 + rng() * (winX1 - winX0);
          x.beginPath();
          x.moveTo(sx, wy0); x.lineTo(sx + 40, wy0); x.lineTo(sx - 30, wy1); x.lineTo(sx - 70, wy1);
          x.fill();
        }
        x.restore();
        // window posters / OPEN sign
        if (lit && rng() < 0.7) {
          const col = pick(['#ff2a2a', '#2ae0ff', '#ff5ad8']);
          const ox = winX0 + 20 + rng() * Math.max(10, winX1 - winX0 - 140);
          x.fillStyle = col;
          x.font = 'bold 30px Arial';
          x.fillText('OPEN', ox, wy0 + 90);
          ex.fillStyle = col; ex.font = 'bold 30px Arial'; ex.shadowColor = col; ex.shadowBlur = 12;
          ex.fillText('OPEN', ox, wy0 + 90);
          ex.shadowBlur = 0;
        }
        if (kind === 'dark' && rng() < 0.6) {
          x.fillStyle = '#e8e2d0';
          x.fillRect(winX0 + 30, wy0 + 60, 120, 70);
          x.fillStyle = '#b3261e';
          x.font = 'bold 20px Arial';
          x.fillText('FOR LEASE', winX0 + 36, wy0 + 102);
        }
      }
      // sign band
      const sign = pick(T.signs);
      const boxSign = rng() < 0.45;
      x.fillStyle = '#1b1a19';
      x.fillRect(x0 + 18, 14, UW - 36, 100);
      if (boxSign) {
        const bg = pick(['#f4efe0', '#ffe066', '#e8f4ff', '#c8322a', '#1d3f8f']);
        const fg = bg === '#c8322a' || bg === '#1d3f8f' ? '#ffffff' : '#16140f';
        x.fillStyle = bg;
        x.fillRect(x0 + 40, 26, UW - 80, 76);
        x.fillStyle = fg;
        x.font = 'bold 50px Arial Black, Arial';
        x.textAlign = 'center';
        x.fillText(sign, x0 + UW / 2, 82, UW - 100);
        ex.fillStyle = bg;
        ex.globalAlpha = kind === 'dark' ? 0.0 : 0.85;
        ex.fillRect(x0 + 40, 26, UW - 80, 76);
        ex.globalAlpha = 1;
        ex.fillStyle = '#000';
        ex.font = 'bold 50px Arial Black, Arial';
        ex.textAlign = 'center';
        ex.fillText(sign, x0 + UW / 2, 82, UW - 100);
      } else {
        const col = pick(neon);
        x.font = 'bold 58px Arial, sans-serif';
        x.textAlign = 'center';
        x.lineWidth = 3;
        x.strokeStyle = col;
        x.strokeText(sign, x0 + UW / 2, 86, UW - 80);
        if (kind !== 'dark') {
          ex.font = 'bold 58px Arial, sans-serif';
          ex.textAlign = 'center';
          ex.lineWidth = 6;
          ex.strokeStyle = col;
          ex.shadowColor = col;
          ex.shadowBlur = 16;
          ex.strokeText(sign, x0 + UW / 2, 86, UW - 80);
          ex.shadowBlur = 0;
        }
      }
      x.textAlign = 'left';
      ex.textAlign = 'left';
    }
    grain(x, W, H, rng, 0.08, 1);
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
