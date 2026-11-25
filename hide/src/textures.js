// Procedural textures — everything is painted on canvases at load time.
import * as THREE from 'three';
import { rng, makeNoise, clamp, nextFrame } from './util.js';

let ANISO = 4;
export const setAniso = (a) => (ANISO = a);

const cv = (w, h = w) => {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
};

function toTex(c, { srgb = true, repeat = 1, repeatY, mips = true } = {}) {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat, repeatY ?? repeat);
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.anisotropy = ANISO;
  if (!mips) {
    t.generateMipmaps = false;
    t.minFilter = THREE.LinearFilter;
  }
  return t;
}

// Paint pixels from a per-pixel function returning [r,g,b] (0..255) and an
// optional height channel collected into `height`.
function paint(w, h, fn) {
  const c = cv(w, h);
  const g = c.getContext('2d');
  const img = g.createImageData(w, h);
  const d = img.data;
  const out = [0, 0, 0];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      fn(x, y, out);
      const i = (y * w + x) * 4;
      d[i] = out[0];
      d[i + 1] = out[1];
      d[i + 2] = out[2];
      d[i + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  return c;
}

// Tileable height field -> tangent-space normal map.
function normalFromHeight(hf, w, h, strength = 2) {
  return paint(w, h, (x, y, o) => {
    const xl = hf[y * w + ((x - 1 + w) % w)], xr = hf[y * w + ((x + 1) % w)];
    const yu = hf[((y - 1 + h) % h) * w + x], yd = hf[((y + 1) % h) * w + x];
    let nx = (xl - xr) * strength, ny = (yd - yu) * strength, nz = 1;
    const l = Math.hypot(nx, ny, nz);
    o[0] = ((nx / l) * 0.5 + 0.5) * 255;
    o[1] = ((ny / l) * 0.5 + 0.5) * 255;
    o[2] = ((nz / l) * 0.5 + 0.5) * 255;
  });
}

// ---------------------------------------------------------------------------
// Sales floor: waxed vinyl composition tile, 4x4 tiles per texture (2.4 m).
function floorTiles(S) {
  const N = makeNoise(11);
  const R = rng(5);
  const tiles = 4;
  const tilePx = S / tiles;
  const tint = [];
  for (let i = 0; i < tiles * tiles; i++) tint.push(R.range(-7, 7));
  const hf = new Float32Array(S * S);
  const rough = new Float32Array(S * S);
  const color = paint(S, S, (x, y, o) => {
    const tx = Math.floor(x / tilePx), ty = Math.floor(y / tilePx);
    const lx = x - tx * tilePx, ly = y - ty * tilePx;
    const edge = Math.min(lx, ly, tilePx - 1 - lx, tilePx - 1 - ly);
    const u = x / S, v = y / S;
    const grime = N.fbm(u * 6, v * 6, 4, 0.55, 6);
    const chip = N(x * 0.9, y * 0.35, (S * 0.9) | 0);
    const speck = N.hash(x, y);
    let base = 196 + tint[ty * tiles + tx];
    // VCT chips: soft directional flecks
    let r = base, g = base - 4, b = base - 14;
    if (chip > 0.72) { r -= 26; g -= 24; b -= 20; }
    else if (chip < 0.18) { r += 10; g += 9; b += 7; }
    if (speck > 0.996) { r -= 60; g -= 58; b -= 50; }
    const dirt = clamp((grime - 0.45) * 1.6, 0, 1);
    r -= dirt * 46; g -= dirt * 44; b -= dirt * 38;
    let hgt = 1, ro = 0.16 + dirt * 0.34 + (chip > 0.72 ? 0.05 : 0);
    if (edge < 2.2) {
      const k = edge / 2.2;
      r = r * (0.55 + 0.45 * k) - 10; g = g * (0.55 + 0.45 * k) - 10; b = b * (0.55 + 0.45 * k) - 10;
      hgt = 0.4 + 0.6 * k;
      ro = 0.7 - 0.5 * k;
    } else if (edge < 7) {
      // grime collects along the seams
      const k = 1 - (edge - 2.2) / 4.8;
      r -= k * 14 * grime; g -= k * 14 * grime; b -= k * 12 * grime;
      ro += k * 0.12;
    }
    hf[y * S + x] = hgt + (N(x * 0.5, y * 0.5, S / 2) - 0.5) * 0.04;
    rough[y * S + x] = ro;
    o[0] = clamp(r, 0, 255); o[1] = clamp(g, 0, 255); o[2] = clamp(b, 0, 255);
  });
  // scuff marks from carts and shoes
  const g = color.getContext('2d');
  for (let i = 0; i < 70; i++) {
    const x = R() * S, y = R() * S, len = R.range(8, 60) * (S / 1024), a = R() * Math.PI;
    g.strokeStyle = `rgba(20,18,16,${R.range(0.08, 0.35)})`;
    g.lineWidth = R.range(0.6, 2.2) * (S / 1024);
    g.beginPath();
    g.moveTo(x, y);
    g.quadraticCurveTo(x + Math.cos(a) * len * 0.5 + R.range(-6, 6), y + Math.sin(a) * len * 0.5 + R.range(-6, 6), x + Math.cos(a) * len, y + Math.sin(a) * len);
    g.stroke();
  }
  const roughC = paint(S, S, (x, y, o) => { o[0] = o[1] = o[2] = clamp(rough[y * S + x] * 255, 0, 255); });
  return {
    map: toTex(color),
    roughnessMap: toTex(roughC, { srgb: false }),
    normalMap: toTex(normalFromHeight(hf, S, S, 3.5), { srgb: false }),
  };
}

// Stockroom: sealed concrete with stains, saw-cut joints and hairline cracks (4 m).
function concrete(S) {
  const N = makeNoise(23);
  const R = rng(9);
  const hf = new Float32Array(S * S);
  const rough = new Float32Array(S * S);
  const color = paint(S, S, (x, y, o) => {
    const u = x / S, v = y / S;
    const m = N.fbm(u * 8, v * 8, 5, 0.55, 8);
    const big = N.fbm(u * 2, v * 2, 3, 0.5, 2);
    const fine = N.hash(x, y);
    let c = 112 + (m - 0.5) * 40 + (big - 0.5) * 36 + (fine - 0.5) * 10;
    let ro = 0.62 + (m - 0.5) * 0.3;
    let hgt = m * 0.5 + fine * 0.05;
    // saw-cut joints every 2 m (texture is 4 m)
    const jx = Math.min(Math.abs(x - S / 2), x, S - 1 - x);
    const jy = Math.min(Math.abs(y - S / 2), y, S - 1 - y);
    const j = Math.min(jx, jy);
    if (j < 1.6) { c *= 0.5; hgt -= 0.6; ro = 0.9; }
    o[0] = clamp(c * 1.02, 0, 255); o[1] = clamp(c, 0, 255); o[2] = clamp(c * 0.95, 0, 255);
    hf[y * S + x] = hgt;
    rough[y * S + x] = ro;
  });
  const g = color.getContext('2d');
  // oil and water stains
  for (let i = 0; i < 9; i++) {
    const x = R() * S, y = R() * S, r = R.range(20, 110) * (S / 1024);
    const grad = g.createRadialGradient(x, y, 0, x, y, r);
    grad.addColorStop(0, `rgba(30,26,20,${R.range(0.18, 0.4)})`);
    grad.addColorStop(0.7, 'rgba(30,26,20,0.08)');
    grad.addColorStop(1, 'rgba(30,26,20,0)');
    g.fillStyle = grad;
    g.beginPath();
    g.ellipse(x, y, r, r * R.range(0.5, 1), R() * 3, 0, Math.PI * 2);
    g.fill();
  }
  // hairline cracks (random walks)
  g.strokeStyle = 'rgba(25,23,20,0.55)';
  for (let i = 0; i < 7; i++) {
    let x = R() * S, y = R() * S, a = R() * 6.28;
    g.lineWidth = R.range(0.6, 1.4) * (S / 1024);
    g.beginPath();
    g.moveTo(x, y);
    const steps = R.int(20, 60);
    for (let s = 0; s < steps; s++) {
      a += R.range(-0.6, 0.6);
      x += Math.cos(a) * 6 * (S / 1024);
      y += Math.sin(a) * 6 * (S / 1024);
      g.lineTo(x, y);
    }
    g.stroke();
  }
  const roughC = paint(S, S, (x, y, o) => { o[0] = o[1] = o[2] = clamp(rough[y * S + x] * 255, 0, 255); });
  return {
    map: toTex(color),
    roughnessMap: toTex(roughC, { srgb: false }),
    normalMap: toTex(normalFromHeight(hf, S, S, 2.2), { srgb: false }),
  };
}

// Painted cinder block, texture covers 1.6 m x 1.6 m (4 x 8 blocks, running bond).
function blockWall(S, tint = [196, 194, 184]) {
  const N = makeNoise(31);
  const hf = new Float32Array(S * S);
  const bw = S / 4, bh = S / 8;
  const color = paint(S, S, (x, y, o) => {
    const row = Math.floor(y / bh);
    const off = row % 2 ? bw / 2 : 0;
    const lx = (x + off) % bw, ly = y % bh;
    const edge = Math.min(lx, ly, bw - 1 - lx, bh - 1 - ly);
    const u = x / S, v = y / S;
    const pit = N(x * 0.35, y * 0.35, (S * 0.35) | 0);
    const stain = N.fbm(u * 3, v * 12, 3, 0.5, 3);
    let k = 1 - (pit > 0.8 ? 0.12 : 0) - clamp((stain - 0.55) * 0.9, 0, 0.25);
    let hgt = 1 - (pit > 0.8 ? 0.25 : 0) + pit * 0.08;
    if (edge < 3) { k *= 0.78 + edge * 0.05; hgt = 0.2 + edge * 0.25; }
    o[0] = tint[0] * k; o[1] = tint[1] * k; o[2] = tint[2] * k;
    hf[y * S + x] = hgt;
  });
  return {
    map: toTex(color),
    normalMap: toTex(normalFromHeight(hf, S, S, 2.5), { srgb: false }),
  };
}

// Plain painted drywall with orange-peel texture.
function drywall(S) {
  const N = makeNoise(41);
  const hf = new Float32Array(S * S);
  const color = paint(S, S, (x, y, o) => {
    const u = x / S, v = y / S;
    const peel = N(x * 0.25, y * 0.25, (S * 0.25) | 0);
    const blot = N.fbm(u * 4, v * 4, 3, 0.5, 4);
    const c = 228 - clamp((blot - 0.5) * 50, -8, 22);
    o[0] = c; o[1] = c; o[2] = c;
    hf[y * S + x] = peel * 0.6;
  });
  return { map: toTex(color), normalMap: toTex(normalFromHeight(hf, S, S, 1.2), { srgb: false }) };
}

// Drop ceiling: 0.6 x 1.2 m tiles on a T-bar grid; texture covers 4.8 m square.
function ceiling(S) {
  const N = makeNoise(51);
  const R = rng(14);
  const cols = 8, rows = 4;
  const tw = S / cols, th = S / rows;
  const stained = new Set([R.int(0, 31), R.int(0, 31), R.int(0, 31)]);
  const missing = R.int(0, 31);
  const color = paint(S, S, (x, y, o) => {
    const cx = Math.floor(x / tw), cy = Math.floor(y / th);
    const lx = x - cx * tw, ly = y - cy * th;
    const edge = Math.min(lx, ly, tw - 1 - lx, th - 1 - ly);
    const id = cy * cols + cx;
    if (edge < 2.5 * (S / 1024)) { o[0] = o[1] = o[2] = 214; return; }
    if (id === missing) { o[0] = 8; o[1] = 8; o[2] = 9; return; }
    const fis = N(x * 0.6, y * 0.6, (S * 0.6) | 0);
    let c = 206 - (fis > 0.74 ? 34 : 0) - N.hash(x, y) * 10;
    let r = c, g = c - 2, b = c - 8;
    if (stained.has(id)) {
      const dx = (lx / tw - 0.5) * 1.2, dy = (ly / th - 0.5);
      const d = Math.hypot(dx, dy) + (N(x * 0.05, y * 0.05) - 0.5) * 0.2;
      const ring = clamp(1 - Math.abs(d - 0.32) * 18, 0, 1);
      const fill = clamp(1 - d * 3, 0, 1);
      r -= ring * 70 + fill * 30; g -= ring * 80 + fill * 38; b -= ring * 100 + fill * 50;
    }
    o[0] = clamp(r, 0, 255); o[1] = clamp(g, 0, 255); o[2] = clamp(b, 0, 255);
  });
  return { map: toTex(color) };
}

// Kraft cardboard atlas: 2 x 2 different box faces.
function cardboard(S) {
  const N = makeNoise(61);
  const R = rng(21);
  const c = paint(S, S, (x, y, o) => {
    const u = x / S, v = y / S;
    const fib = N(x * 0.8, y * 0.08, (S * 0.8) | 0);
    const blot = N.fbm(u * 5, v * 5, 3, 0.5, 5);
    const corr = Math.sin(y * 0.9) * 2;
    const k = 1 - clamp((blot - 0.5) * 0.4, -0.06, 0.15) + (fib - 0.5) * 0.06;
    o[0] = (176 + corr) * k; o[1] = (134 + corr) * k; o[2] = (88 + corr) * k;
  });
  const g = c.getContext('2d');
  const h = S / 2;
  const words = ['THIS SIDE UP', 'FRAGILE', 'KEEP DRY', 'HANDLE WITH CARE', '12 x 400 g', 'NET WT 18 kg'];
  for (let q = 0; q < 4; q++) {
    const ox = (q % 2) * h, oy = Math.floor(q / 2) * h;
    // tape seam
    g.fillStyle = 'rgba(205,170,120,0.75)';
    g.fillRect(ox + h * 0.44, oy, h * 0.12, h);
    g.fillStyle = 'rgba(255,240,210,0.18)';
    g.fillRect(ox + h * 0.47, oy, h * 0.02, h);
    g.fillStyle = 'rgba(45,32,22,0.75)';
    g.font = `bold ${Math.round(h * 0.07)}px Arial, sans-serif`;
    g.fillText(words[q % words.length], ox + h * 0.06, oy + h * 0.14);
    g.font = `${Math.round(h * 0.05)}px Arial, sans-serif`;
    g.fillText(words[(q + 3) % words.length], ox + h * 0.6, oy + h * 0.88);
    // up arrows
    g.lineWidth = h * 0.015;
    g.strokeStyle = 'rgba(45,32,22,0.7)';
    for (let a = 0; a < 2; a++) {
      const ax = ox + h * (0.68 + a * 0.1), ay = oy + h * 0.2;
      g.beginPath();
      g.moveTo(ax, ay + h * 0.12); g.lineTo(ax, ay); g.moveTo(ax - h * 0.03, ay + h * 0.04); g.lineTo(ax, ay); g.lineTo(ax + h * 0.03, ay + h * 0.04);
      g.stroke();
    }
    if (q % 2 === 0) {
      // shipping label with a barcode
      g.fillStyle = 'rgba(238,236,228,0.95)';
      g.fillRect(ox + h * 0.08, oy + h * 0.55, h * 0.3, h * 0.2);
      g.fillStyle = '#222';
      for (let b = 0; b < 28; b++) if (R() > 0.4) g.fillRect(ox + h * 0.1 + b * h * 0.009, oy + h * 0.63, h * 0.006, h * 0.08);
      g.font = `${Math.round(h * 0.025)}px monospace`;
      g.fillText('SKU 0' + R.int(100000, 999999), ox + h * 0.1, oy + h * 0.6);
    }
  }
  return { map: toTex(c) };
}

// Pallet / plywood planks.
function wood(S) {
  const N = makeNoise(71);
  const hf = new Float32Array(S * S);
  const c = paint(S, S, (x, y, o) => {
    const u = x / S, v = y / S;
    const plank = Math.floor(v * 4);
    const grain = N(u * 3 + plank * 7.3, v * 60) * 0.5 + N.fbm(u * 8, v * 30, 3, 0.5) * 0.5;
    const ring = Math.sin((grain * 18 + u * 2) * 3.1) * 0.5 + 0.5;
    const knot = N(u * 6 + plank, v * 6, 6);
    let k = 0.82 + ring * 0.14 + (plank % 2) * 0.05 - (knot > 0.83 ? 0.35 : 0);
    const lv = (v * 4) % 1;
    let hgt = 1;
    if (lv < 0.02 || lv > 0.98) { k *= 0.35; hgt = 0; }
    o[0] = 186 * k; o[1] = 150 * k; o[2] = 104 * k;
    hf[y * S + x] = hgt + ring * 0.05;
  });
  return { map: toTex(c), normalMap: toTex(normalFromHeight(hf, S, S, 2), { srgb: false }) };
}

// ---------------------------------------------------------------------------
// Product labels: an 8 x 8 atlas of made-up brands. The last row holds plain
// materials (metal, white plastic, amber glass, ...).
const BRANDS = ['BRAMBLE', 'KORVO', 'SUNPUFF', 'NUTTIES', 'GOLDENVALE', 'MAPLE CREST', 'ZESTO', 'PIPPA', 'FIZZWELL', 'MORROW', 'CRISPLY', 'OAKMILL', 'BRIGHTSIDE', 'TIDEWELL', 'NORTHFIELD', 'LUMA', 'PEBBLE', 'BELLWOOD', 'KIP & CO', 'SNAPPERS', 'FROSTLINE', 'GRAINHOUSE', 'RUSTICO', 'VELLA', 'COPPERPOT', 'WILLOW', 'HARVESTA', 'ORCHARD LN', 'DAYBREAK', 'MOSSLEY', 'TANNER', 'CLOVERLY'];
const KINDS = ['CEREAL', 'SOUP', 'BEANS', 'PASTA', 'CRACKERS', 'COFFEE', 'TEA', 'SODA', 'RICE', 'COOKIES', 'CHIPS', 'TOMATOES', 'OATS', 'SAUCE', 'BROTH', 'CORN', 'FLOUR', 'SUGAR', 'DETERGENT', 'WIPES'];
const PALETTE = ['#b8262c', '#e0a21a', '#1f5aa6', '#2c7a3f', '#f2efe6', '#5a2a6e', '#d4561c', '#11151c', '#8bb7d9', '#c93f6b', '#3d6e70', '#e8d38a', '#7a4b2a', '#f6f3ec', '#9e1b1b', '#4a8a2a'];

export const ATLAS = { cols: 8, rows: 8, METAL: 56, WHITE: 57, AMBER: 58, KRAFT: 59, BLACK: 60, RED: 61, GREEN: 62, CREAM: 63 };

function labelAtlas(S) {
  const R = rng(99);
  const c = cv(S);
  const g = c.getContext('2d');
  const T = S / 8;
  for (let i = 0; i < 56; i++) {
    const x = (i % 8) * T, y = Math.floor(i / 8) * T;
    const bg = R.pick(PALETTE);
    let fg = R.pick(PALETTE);
    if (fg === bg) fg = bg === '#f2efe6' ? '#11151c' : '#f2efe6';
    const accent = R.pick(PALETTE);
    g.save();
    g.beginPath();
    g.rect(x, y, T, T);
    g.clip();
    g.fillStyle = bg;
    g.fillRect(x, y, T, T);
    const style = i % 4;
    if (style === 0) {
      // box front: band + hero circle
      g.fillStyle = accent;
      g.fillRect(x, y + T * 0.62, T, T * 0.38);
      g.fillStyle = 'rgba(255,255,255,0.85)';
      g.beginPath();
      g.arc(x + T * 0.5, y + T * 0.62, T * 0.22, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = R.pick(['#c8732a', '#d9b44a', '#7b3a1d', '#a8c25a']);
      g.beginPath();
      g.arc(x + T * 0.5, y + T * 0.64, T * 0.15, 0, Math.PI * 2);
      g.fill();
    } else if (style === 1) {
      // can wrap: horizontal stripes
      g.fillStyle = accent;
      g.fillRect(x, y + T * 0.3, T, T * 0.4);
      g.fillStyle = fg;
      g.fillRect(x, y + T * 0.28, T, T * 0.03);
      g.fillRect(x, y + T * 0.69, T, T * 0.03);
    } else if (style === 2) {
      // diagonal sash
      g.fillStyle = accent;
      g.beginPath();
      g.moveTo(x, y + T * 0.7); g.lineTo(x + T, y + T * 0.35); g.lineTo(x + T, y + T * 0.55); g.lineTo(x, y + T * 0.9);
      g.fill();
    } else {
      // minimal: border frame
      g.strokeStyle = accent;
      g.lineWidth = T * 0.05;
      g.strokeRect(x + T * 0.08, y + T * 0.08, T * 0.84, T * 0.84);
    }
    // wordmark
    const brand = BRANDS[i % BRANDS.length];
    g.fillStyle = fg;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    let fs = T * 0.2;
    g.font = `900 ${fs}px Impact, 'Arial Black', sans-serif`;
    while (g.measureText(brand).width > T * 0.86 && fs > 6) { fs -= 1; g.font = `900 ${fs}px Impact, 'Arial Black', sans-serif`; }
    g.fillText(brand, x + T / 2, y + T * (style === 1 ? 0.5 : 0.2));
    g.font = `bold ${T * 0.085}px Arial, sans-serif`;
    g.fillStyle = style === 1 ? fg : accent === bg ? fg : '#fff';
    g.fillText(KINDS[(i * 7) % KINDS.length], x + T / 2, y + T * (style === 1 ? 0.82 : 0.36));
    // small print
    g.globalAlpha = 0.6;
    g.font = `${T * 0.045}px Arial, sans-serif`;
    g.fillText(`NET WT ${R.int(2, 32)} OZ`, x + T / 2, y + T * 0.94);
    g.globalAlpha = 1;
    g.restore();
  }
  const plain = ['#9aa0a6', '#eceae4', '#7a4212', '#b08a5a', '#16181b', '#a3221f', '#2e6b35', '#e9dfc4'];
  for (let i = 0; i < 8; i++) {
    const x = i * T, y = 7 * T;
    g.fillStyle = plain[i];
    g.fillRect(x, y, T, T);
    if (i === 0) {
      const grd = g.createLinearGradient(x, y, x + T, y);
      grd.addColorStop(0, 'rgba(255,255,255,0.0)');
      grd.addColorStop(0.5, 'rgba(255,255,255,0.35)');
      grd.addColorStop(1, 'rgba(0,0,0,0.2)');
      g.fillStyle = grd;
      g.fillRect(x, y, T, T);
    }
  }
  const t = toTex(c);
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  return t;
}

// Shelf-edge price strip (repeats along the shelf).
function priceStrip() {
  const R = rng(4);
  const c = cv(512, 32);
  const g = c.getContext('2d');
  g.fillStyle = '#d9d7cf';
  g.fillRect(0, 0, 512, 32);
  for (let x = 6; x < 500; x += R.range(54, 90)) {
    const yellow = R() < 0.25;
    g.fillStyle = yellow ? '#f1d23a' : '#fbfaf5';
    g.fillRect(x, 4, 40, 24);
    g.fillStyle = yellow ? '#b01e1e' : '#1b1b1b';
    g.font = 'bold 13px Arial';
    g.fillText(`${R.int(0, 9)}.${R.int(10, 99)}`, x + 4, 21);
    g.fillStyle = '#222';
    for (let b = 0; b < 8; b++) g.fillRect(x + 28 + b, 8, R() > 0.5 ? 1 : 0, 8);
  }
  g.fillStyle = 'rgba(0,0,0,0.25)';
  g.fillRect(0, 0, 512, 2);
  return toTex(c);
}

// Flannel tartan for the blanket in the hiding spot.
function tartan(S) {
  const N = makeNoise(81);
  const hf = new Float32Array(S * S);
  const band = (t) => {
    const p = (t * 8) % 1;
    if (p < 0.12) return 0; // dark green
    if (p < 0.18) return 1; // cream thread
    if (p < 0.55) return 2; // red
    if (p < 0.6) return 0;
    return 2;
  };
  const cols = [[34, 52, 38], [222, 206, 170], [152, 34, 30]];
  const c = paint(S, S, (x, y, o) => {
    const u = x / S, v = y / S;
    const weave = (x + y) % 4 < 2;
    const a = cols[band(u)], b = cols[band(v)];
    const pick = weave ? a : b;
    const mix = weave ? b : a;
    const fuzz = N(x * 0.5, y * 0.5, (S * 0.5) | 0);
    const k = 0.8 + fuzz * 0.25;
    o[0] = (pick[0] * 0.7 + mix[0] * 0.3) * k;
    o[1] = (pick[1] * 0.7 + mix[1] * 0.3) * k;
    o[2] = (pick[2] * 0.7 + mix[2] * 0.3) * k;
    hf[y * S + x] = (weave ? 1 : 0.4) + fuzz * 0.5;
  });
  return { map: toTex(c), normalMap: toTex(normalFromHeight(hf, S, S, 1.4), { srgb: false }) };
}

// Monster skin: pale, mottled, veined, wet.
function skin(S) {
  const N = makeNoise(91);
  const hf = new Float32Array(S * S);
  const rough = new Float32Array(S * S);
  const c = paint(S, S, (x, y, o) => {
    const u = x / S, v = y / S;
    const mott = N.fbm(u * 6, v * 6, 5, 0.55, 6);
    const ridge = 1 - Math.abs(N.fbm(u * 10, v * 10, 4, 0.5, 10) * 2 - 1);
    const vein = Math.pow(ridge, 10);
    const pore = N.hash(x, y);
    let r = 150 + (mott - 0.5) * 70, g = 146 + (mott - 0.5) * 66, b = 136 + (mott - 0.5) * 50;
    r -= vein * 60; g -= vein * 64; b -= vein * 30;
    if (mott < 0.34) { r -= 36; g -= 30; b -= 24; }
    if (pore > 0.985) { r -= 30; g -= 30; b -= 26; }
    o[0] = clamp(r, 0, 255); o[1] = clamp(g, 0, 255); o[2] = clamp(b, 0, 255);
    hf[y * S + x] = mott * 0.6 + vein * 0.5 - (pore > 0.985 ? 0.3 : 0);
    rough[y * S + x] = 0.38 + (1 - mott) * 0.3;
  });
  const rc = paint(S, S, (x, y, o) => { o[0] = o[1] = o[2] = rough[y * S + x] * 255; });
  return { map: toTex(c), normalMap: toTex(normalFromHeight(hf, S, S, 3), { srgb: false }), roughnessMap: toTex(rc, { srgb: false }) };
}

// Flashlight beam pattern (light cookie): hot spot, reflector ring, falloff.
function cookie(S = 256) {
  const N = makeNoise(5);
  const c = paint(S, S, (x, y, o) => {
    const dx = (x / S - 0.5) * 2, dy = (y / S - 0.5) * 2;
    const r = Math.hypot(dx, dy);
    const a = Math.atan2(dy, dx);
    // hot spot, a bright reflector ring, then a wide dim spill
    let v = Math.exp(-r * r * 26) * 1.0 + 0.45 * Math.exp(-Math.pow((r - 0.22) * 14, 2)) + 0.16 * clamp(1 - r * 1.05, 0, 1) + 0.08 * clamp(1 - r * 0.6, 0, 1);
    v -= 0.05 * Math.exp(-Math.pow((r - 0.36) * 18, 2));
    v *= 0.92 + 0.08 * N(Math.cos(a) * 3 + 5, Math.sin(a) * 3 + 5);
    v *= 0.9 + 0.1 * N(dx * 6 + 9, dy * 6 + 9);
    if (r > 0.98) v = 0;
    const k = clamp(v, 0, 1) * 255;
    o[0] = k; o[1] = k * 0.97; o[2] = k * 0.9;
  });
  const t = toTex(c, { srgb: true });
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  return t;
}

// Generic printed sign / text panel.
export function signTexture(lines, { w = 512, h = 128, bg = '#18407a', fg = '#ffffff', font = 'Arial', weight = 'bold', border = null, emissive = false } = {}) {
  const c = cv(w, h);
  const g = c.getContext('2d');
  g.fillStyle = bg;
  g.fillRect(0, 0, w, h);
  if (border) {
    g.strokeStyle = border;
    g.lineWidth = h * 0.06;
    g.strokeRect(h * 0.05, h * 0.05, w - h * 0.1, h - h * 0.1);
  }
  g.fillStyle = fg;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  const n = lines.length;
  lines.forEach((ln, i) => {
    const size = typeof ln === 'object' ? ln.size : i === 0 ? 0.5 : 0.22;
    const text = typeof ln === 'object' ? ln.text : ln;
    let fs = h * size;
    g.font = `${weight} ${fs}px ${font}, Arial, sans-serif`;
    while (g.measureText(text).width > w * 0.92 && fs > 8) { fs -= 2; g.font = `${weight} ${fs}px ${font}, Arial, sans-serif`; }
    const yy = n === 1 ? h / 2 : h * (0.15 + (0.7 * (i + 0.5)) / n) + (i === 0 ? -h * 0.03 : h * 0.04);
    if (emissive) { g.shadowColor = fg; g.shadowBlur = h * 0.12; }
    g.fillText(text, w / 2, yy);
    g.shadowBlur = 0;
  });
  const t = toTex(c);
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  return t;
}

// Night parking lot seen through the front windows.
function outside(W = 2048, H = 512) {
  const R = rng(17);
  const N = makeNoise(19);
  const c = paint(W, H, (x, y, o) => {
    const v = y / H;
    const u = x / W;
    if (v < 0.52) {
      // sky: low clouds lit sodium orange from below
      const cl = N.fbm(u * 6, v * 5, 4, 0.5);
      const k = 6 + v * 26 + cl * 22;
      o[0] = k * 1.25; o[1] = k * 0.95; o[2] = k * 0.85;
    } else {
      // wet asphalt
      const wet = N.fbm(u * 30, v * 8, 3, 0.5);
      const k = 7 + wet * 9;
      o[0] = k; o[1] = k; o[2] = k * 1.1;
    }
  });
  const g = c.getContext('2d');
  // tree line silhouette
  g.fillStyle = '#040505';
  g.beginPath();
  g.moveTo(0, H * 0.53);
  for (let x = 0; x <= W; x += 8) g.lineTo(x, H * (0.44 - N(x * 0.01, 3) * 0.1 - N(x * 0.05, 7) * 0.03));
  g.lineTo(W, H * 0.53);
  g.fill();
  // lamp posts with sodium glow and reflections
  for (let i = 0; i < 4; i++) {
    const lx = W * (0.12 + i * 0.26 + R.range(-0.03, 0.03)), ly = H * 0.22;
    g.fillStyle = '#0a0a0a';
    g.fillRect(lx - 2, ly, 4, H * 0.34);
    const grd = g.createRadialGradient(lx, ly, 0, lx, ly, 90);
    grd.addColorStop(0, 'rgba(255,200,120,1)');
    grd.addColorStop(0.08, 'rgba(255,160,70,0.8)');
    grd.addColorStop(0.4, 'rgba(160,80,20,0.18)');
    grd.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grd;
    g.fillRect(lx - 100, ly - 100, 200, 200);
    // pool on the asphalt + streaky reflection
    const pool = g.createRadialGradient(lx, H * 0.62, 0, lx, H * 0.62, 140);
    pool.addColorStop(0, 'rgba(200,120,50,0.35)');
    pool.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = pool;
    g.beginPath();
    g.ellipse(lx, H * 0.62, 150, 30, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = 'rgba(255,170,90,0.18)';
    for (let s = 0; s < 14; s++) g.fillRect(lx - 3 + R.range(-4, 4), H * 0.58 + s * 12, 6, 6);
  }
  // a lone parked car
  g.fillStyle = '#060607';
  const cx = W * 0.58, cy = H * 0.6;
  g.beginPath();
  g.moveTo(cx - 90, cy); g.lineTo(cx - 80, cy - 22); g.lineTo(cx - 40, cy - 40); g.lineTo(cx + 40, cy - 40); g.lineTo(cx + 70, cy - 20); g.lineTo(cx + 95, cy - 16); g.lineTo(cx + 95, cy);
  g.fill();
  // painted bay lines
  g.strokeStyle = 'rgba(200,190,160,0.12)';
  g.lineWidth = 3;
  for (let i = 0; i < 16; i++) {
    const x = i * (W / 16) + 40;
    g.beginPath(); g.moveTo(x, H * 0.66); g.lineTo(x - 60, H); g.stroke();
  }
  const t = toTex(c);
  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.ClampToEdgeWrapping;
  return t;
}

// Rain drops + runnels on the glass (alpha in the red channel; used as alphaMap).
function rainGlass(S = 512) {
  const R = rng(33);
  const c = cv(S);
  const g = c.getContext('2d');
  g.fillStyle = '#000';
  g.fillRect(0, 0, S, S);
  for (let i = 0; i < 380; i++) {
    const x = R() * S, y = R() * S, r = R.range(0.6, 2.6);
    g.fillStyle = `rgba(255,255,255,${R.range(0.25, 0.8)})`;
    g.beginPath();
    g.ellipse(x, y, r, r * 1.2, 0, 0, Math.PI * 2);
    g.fill();
  }
  for (let i = 0; i < 26; i++) {
    let x = R() * S, y = R() * S * 0.5;
    g.strokeStyle = `rgba(255,255,255,${R.range(0.15, 0.4)})`;
    g.lineWidth = R.range(0.8, 2);
    g.beginPath();
    g.moveTo(x, y);
    const len = R.range(40, 260);
    for (let s = 0; s < len; s += 6) { x += R.range(-1.2, 1.2); g.lineTo(x, y + s); }
    g.stroke();
  }
  const t = toTex(c, { srgb: false });
  return t;
}

// Pegboard backing for gondola shelving.
function pegboard(S = 256) {
  const hf = new Float32Array(S * S);
  const step = S / 8;
  const c = paint(S, S, (x, y, o) => {
    const dx = (x % step) - step / 2, dy = (y % step) - step / 2;
    const hole = Math.hypot(dx, dy) < step * 0.13;
    const k = hole ? 30 : 205;
    o[0] = k; o[1] = k; o[2] = k * 0.97;
    hf[y * S + x] = hole ? 0 : 1;
  });
  return { map: toTex(c), normalMap: toTex(normalFromHeight(hf, S, S, 1.5), { srgb: false }) };
}

// Film grain tile used by the CSS overlay on mobile.
export function grainDataURL(S = 128) {
  const c = paint(S, S, (x, y, o) => {
    const v = Math.random() * 255;
    o[0] = o[1] = o[2] = v;
  });
  return c.toDataURL('image/png');
}

export async function buildTextures(cfg, onStep = () => {}) {
  const S = cfg.texSize;
  const T = {};
  const steps = [
    ['floor', () => (T.floor = floorTiles(S))],
    ['concrete', () => (T.concrete = concrete(S))],
    ['walls', () => {
      T.block = blockWall(S / 2);
      T.drywall = drywall(S / 4);
    }],
    ['ceiling', () => (T.ceiling = ceiling(S))],
    ['boxes', () => (T.cardboard = cardboard(S))],
    ['wood', () => (T.wood = wood(S / 2))],
    ['labels', () => {
      T.labels = labelAtlas(cfg.atlasSize);
      T.price = priceStrip();
    }],
    ['fabric', () => (T.tartan = tartan(S / 4))],
    ['skin', () => (T.skin = skin(S / 2))],
    ['light', () => {
      T.cookie = cookie(256);
      T.outside = outside(cfg.texSize >= 1024 ? 2048 : 1024, cfg.texSize >= 1024 ? 512 : 256);
      T.rain = rainGlass(cfg.texSize >= 1024 ? 512 : 256);
      T.peg = pegboard(256);
    }],
  ];
  for (let i = 0; i < steps.length; i++) {
    onStep(steps[i][0], i / steps.length);
    steps[i][1]();
    await nextFrame();
  }
  return T;
}
