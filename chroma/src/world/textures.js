// Procedural canvas textures + derived normal maps. No image assets.
import * as THREE from 'three';
import { fbm, rng } from '../util.js';

const cache = new Map();

function mk(size) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  return c;
}

function toTexture(c, srgb = true, repeat = true) {
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  t.generateMipmaps = true;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  return t;
}

// Height canvas (greyscale) -> tangent-space normal map
function normalFromHeight(hc, strength = 2) {
  const size = hc.width;
  const src = hc.getContext('2d').getImageData(0, 0, size, size).data;
  const out = mk(size);
  const ctx = out.getContext('2d');
  const img = ctx.createImageData(size, size);
  const H = (x, y) => src[(((y + size) % size) * size + ((x + size) % size)) * 4] / 255;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const dx = (H(x + 1, y) - H(x - 1, y)) * strength;
    const dy = (H(x, y + 1) - H(x, y - 1)) * strength;
    let nx = -dx, ny = dy, nz = 1;
    const l = Math.hypot(nx, ny, nz);
    nx /= l; ny /= l; nz /= l;
    const i = (y * size + x) * 4;
    img.data[i] = (nx * 0.5 + 0.5) * 255;
    img.data[i + 1] = (ny * 0.5 + 0.5) * 255;
    img.data[i + 2] = (nz * 0.5 + 0.5) * 255;
    img.data[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return toTexture(out, false);
}

// per-pixel painter: fn(x, y) -> [r,g,b] (0..255)
function paintPixels(c, fn) {
  const size = c.width;
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(size, size);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const [r, g, b] = fn(x, y);
    const i = (y * size + x) * 4;
    img.data[i] = r; img.data[i + 1] = g; img.data[i + 2] = b; img.data[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return ctx;
}

function grain(x, y, size, freq, seed, oct = 4) {
  return fbm((x / size) * freq, (y / size) * freq, oct, seed, freq);
}

// ------------------------------------------------------------------ concrete
function concrete({ base = [214, 210, 202], seams = 2, seed = 3, size = 512, stain = 0.5 }) {
  const c = mk(size), h = mk(size);
  const step = size / seams;
  const ctx = paintPixels(c, (x, y) => {
    const n = grain(x, y, size, 8, seed) - 0.5;
    const n2 = grain(x, y, size, 32, seed + 5, 2) - 0.5;
    const st = (grain(x, y, size, 3, seed + 9, 3) - 0.5) * stain;
    const k = 1 + n * 0.12 + n2 * 0.06 + st * 0.18;
    return [base[0] * k, base[1] * k, base[2] * k];
  });
  // speckles
  const r = rng(seed);
  for (let i = 0; i < size * 1.2; i++) {
    ctx.fillStyle = `rgba(${r() < 0.5 ? '0,0,0' : '255,255,255'},${r() * 0.12})`;
    ctx.fillRect(r() * size, r() * size, 1 + r() * 2, 1 + r() * 2);
  }
  const hctx = paintPixels(h, (x, y) => { const v = 150 + (grain(x, y, size, 16, seed + 2, 3) - 0.5) * 60; return [v, v, v]; });
  for (let i = 0; i <= seams; i++) {
    for (const [cx, hx] of [[ctx, '#0000'], [hctx, '#000']]) { void cx; void hx; }
    ctx.fillStyle = 'rgba(40,40,45,0.35)';
    ctx.fillRect(i * step - 1.5, 0, 3, size); ctx.fillRect(0, i * step - 1.5, size, 3);
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    ctx.fillRect(i * step + 1.5, 0, 1.5, size); ctx.fillRect(0, i * step + 1.5, size, 1.5);
    hctx.fillStyle = '#202020';
    hctx.fillRect(i * step - 2, 0, 4, size); hctx.fillRect(0, i * step - 2, size, 4);
  }
  return { map: toTexture(c), normalMap: normalFromHeight(h, 2.5) };
}

// ------------------------------------------------------------------ dock pavers
function pavers({ seed = 7, size = 512 }) {
  const c = mk(size), h = mk(size);
  const n = 4, step = size / n;
  const r = rng(seed);
  const tints = Array.from({ length: n * n }, () => 0.93 + r() * 0.12);
  const ctx = paintPixels(c, (x, y) => {
    const t = tints[Math.floor(y / step) * n + Math.floor(x / step)];
    const g = grain(x, y, size, 12, seed) - 0.5;
    const g2 = grain(x, y, size, 48, seed + 3, 2) - 0.5;
    const k = t * (1 + g * 0.1 + g2 * 0.07);
    return [205 * k, 206 * k, 210 * k];
  });
  const hctx = paintPixels(h, (x, y) => { const v = 170 + (grain(x, y, size, 24, seed + 1, 2) - 0.5) * 40; return [v, v, v]; });
  for (let i = 0; i <= n; i++) {
    ctx.fillStyle = 'rgba(60,62,70,0.55)';
    ctx.fillRect(i * step - 2, 0, 4, size); ctx.fillRect(0, i * step - 2, size, 4);
    hctx.fillStyle = '#101010';
    hctx.fillRect(i * step - 3, 0, 6, size); hctx.fillRect(0, i * step - 3, size, 6);
  }
  return { map: toTexture(c), normalMap: normalFromHeight(h, 3) };
}

// ------------------------------------------------------------------ steel grate
function grate({ size = 256 }) {
  const c = mk(size), h = mk(size);
  const cells = 8, step = size / cells;
  const ctx = paintPixels(c, (x, y) => {
    const g = grain(x, y, size, 16, 21) - 0.5;
    const v = 92 * (1 + g * 0.25);
    return [v, v * 1.03, v * 1.1];
  });
  const hctx = h.getContext('2d');
  hctx.fillStyle = '#c0c0c0'; hctx.fillRect(0, 0, size, size);
  for (let y = 0; y < cells; y++) for (let x = 0; x < cells; x++) {
    const px = x * step + step * 0.16, py = y * step + step * 0.16, s = step * 0.68;
    ctx.fillStyle = 'rgba(15,18,24,0.85)';
    ctx.beginPath(); ctx.roundRect(px, py, s, s, 3); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.12)'; ctx.lineWidth = 1.5; ctx.stroke();
    hctx.fillStyle = '#202020';
    hctx.beginPath(); hctx.roundRect(px, py, s, s, 3); hctx.fill();
  }
  return { map: toTexture(c), normalMap: normalFromHeight(h, 3) };
}

// ------------------------------------------------------------------ corrugated container
function corrugated({ size = 512 }) {
  const c = mk(size), h = mk(size);
  const ribs = 12;
  paintPixels(h, (x) => {
    const p = (x / size) * ribs;
    const f = p - Math.floor(p);
    const v = f < 0.5 ? 255 * (f / 0.5) : 255 * (1 - (f - 0.5) / 0.5);
    return [v * 0.8 + 30, v * 0.8 + 30, v * 0.8 + 30];
  });
  const ctx = paintPixels(c, (x, y) => {
    const p = (x / size) * ribs;
    const f = p - Math.floor(p);
    const shade = 0.88 + 0.12 * Math.cos(f * Math.PI * 2);
    const g = grain(x, y, size, 10, 33) - 0.5;
    const rust = Math.max(0, grain(x, y, size, 6, 44, 4) - 0.62) * 2.2;
    const k = shade * (1 + g * 0.08);
    return [235 * k * (1 - rust * 0.25) + rust * 40, 235 * k * (1 - rust * 0.45), 235 * k * (1 - rust * 0.6)];
  });
  // top + bottom rails
  ctx.fillStyle = 'rgba(30,30,35,0.35)';
  ctx.fillRect(0, 0, size, 10); ctx.fillRect(0, size - 10, size, 10);
  return { map: toTexture(c), normalMap: normalFromHeight(h, 5) };
}

// ------------------------------------------------------------------ crate wood
function wood({ size = 256 }) {
  const c = mk(size), h = mk(size);
  const planks = 4, step = size / planks;
  const r = rng(5);
  const tint = Array.from({ length: planks }, () => 0.88 + r() * 0.2);
  const ctx = paintPixels(c, (x, y) => {
    const k = tint[Math.floor(y / step)];
    const gr = Math.sin((x / size) * 40 + fbm(x / size * 4, y / size * 30, 3, 9) * 9) * 0.5 + 0.5;
    const v = k * (0.85 + gr * 0.15);
    return [196 * v, 150 * v, 98 * v];
  });
  const hctx = paintPixels(h, () => [180, 180, 180]);
  for (let i = 0; i <= planks; i++) {
    ctx.fillStyle = 'rgba(50,30,15,0.6)'; ctx.fillRect(0, i * step - 1.5, size, 3);
    hctx.fillStyle = '#000'; hctx.fillRect(0, i * step - 2, size, 4);
  }
  ctx.strokeStyle = 'rgba(70,45,20,0.75)'; ctx.lineWidth = 10;
  ctx.strokeRect(5, 5, size - 10, size - 10);
  ctx.beginPath(); ctx.moveTo(8, 8); ctx.lineTo(size - 8, size - 8); ctx.stroke();
  return { map: toTexture(c), normalMap: normalFromHeight(h, 2) };
}

// ------------------------------------------------------------------ hazard stripes
function hazard({ size = 256 }) {
  const c = mk(size);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#f2c230'; ctx.fillRect(0, 0, size, size);
  ctx.fillStyle = '#26262b';
  for (let i = -size; i < size * 2; i += size / 2) {
    ctx.beginPath();
    ctx.moveTo(i, 0); ctx.lineTo(i + size / 4, 0); ctx.lineTo(i + size / 4 - size, size); ctx.lineTo(i - size, size);
    ctx.closePath(); ctx.fill();
  }
  paintGrime(ctx, size, 8);
  return { map: toTexture(c) };
}

function paintGrime(ctx, size, seed) {
  const img = ctx.getImageData(0, 0, size, size);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const k = 1 + (grain(x, y, size, 8, seed) - 0.5) * 0.18;
    const i = (y * size + x) * 4;
    img.data[i] *= k; img.data[i + 1] *= k; img.data[i + 2] *= k;
  }
  ctx.putImageData(img, 0, 0);
}

// ------------------------------------------------------------------ plaza tiles
function plazaTiles({ size = 512 }) {
  const c = mk(size), h = mk(size);
  const n = 8, step = size / n;
  const ctx = c.getContext('2d');
  const hctx = h.getContext('2d');
  hctx.fillStyle = '#d0d0d0'; hctx.fillRect(0, 0, size, size);
  const r = rng(12);
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const ring = Math.max(Math.abs(x - 3.5), Math.abs(y - 3.5));
    const warm = (x + y) % 2 === 0;
    const base = ring > 3 ? [222, 214, 198] : warm ? [236, 226, 206] : [214, 168, 128];
    const k = 0.94 + r() * 0.1;
    ctx.fillStyle = `rgb(${base[0] * k},${base[1] * k},${base[2] * k})`;
    ctx.fillRect(x * step, y * step, step, step);
  }
  paintGrime(ctx, size, 4);
  ctx.strokeStyle = 'rgba(90,80,70,0.55)'; ctx.lineWidth = 3;
  hctx.strokeStyle = '#303030'; hctx.lineWidth = 5;
  for (let i = 0; i <= n; i++) {
    for (const [cc] of [[ctx], [hctx]]) {
      cc.beginPath(); cc.moveTo(i * step, 0); cc.lineTo(i * step, size); cc.stroke();
      cc.beginPath(); cc.moveTo(0, i * step); cc.lineTo(size, i * step); cc.stroke();
    }
  }
  return { map: toTexture(c), normalMap: normalFromHeight(h, 2) };
}

// ------------------------------------------------------------------ building facade
function facade({ size = 512, seed = 1 }) {
  const c = mk(size), e = mk(size), h = mk(size);
  const ctx = paintPixels(c, (x, y) => {
    const g = grain(x, y, size, 10, seed) - 0.5;
    const v = 238 * (1 + g * 0.06);
    return [v, v * 0.985, v * 0.96];
  });
  const ectx = e.getContext('2d');
  ectx.fillStyle = '#000'; ectx.fillRect(0, 0, size, size);
  const hctx = h.getContext('2d');
  hctx.fillStyle = '#b0b0b0'; hctx.fillRect(0, 0, size, size);
  const r = rng(seed * 7 + 1);
  const cols = 2, rows = 2, cw = size / cols, rh = size / rows;
  for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
    const wx = x * cw + cw * 0.2, wy = y * rh + rh * 0.18, ww = cw * 0.6, wh = rh * 0.58;
    // frame
    ctx.fillStyle = 'rgba(60,64,80,0.9)';
    ctx.fillRect(wx - 6, wy - 6, ww + 12, wh + 12);
    const grd = ctx.createLinearGradient(wx, wy, wx + ww, wy + wh);
    grd.addColorStop(0, '#9fd8ff'); grd.addColorStop(0.5, '#4f86b8'); grd.addColorStop(1, '#2d4d78');
    ctx.fillStyle = grd; ctx.fillRect(wx, wy, ww, wh);
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.beginPath(); ctx.moveTo(wx + ww * 0.1, wy + wh); ctx.lineTo(wx + ww * 0.45, wy); ctx.lineTo(wx + ww * 0.6, wy); ctx.lineTo(wx + ww * 0.25, wy + wh); ctx.fill();
    ctx.fillStyle = 'rgba(50,55,70,0.95)';
    ctx.fillRect(wx + ww / 2 - 3, wy, 6, wh);
    ctx.fillRect(wx, wy + wh * 0.45, ww, 5);
    // sill
    ctx.fillStyle = 'rgba(255,255,255,0.9)'; ctx.fillRect(wx - 10, wy + wh + 6, ww + 20, 8);
    hctx.fillStyle = '#404040'; hctx.fillRect(wx, wy, ww, wh);
    hctx.fillStyle = '#ffffff'; hctx.fillRect(wx - 10, wy + wh + 6, ww + 20, 8);
    if (r() < 0.55) {
      const lit = ['#ffcf7a', '#ffe7b0', '#ffb36b', '#c7e6ff'][Math.floor(r() * 4)];
      ectx.fillStyle = lit; ectx.globalAlpha = 0.7 + r() * 0.3;
      ectx.fillRect(wx, wy, ww, wh);
      ectx.globalAlpha = 1;
    }
  }
  const map = toTexture(c);
  const emissiveMap = toTexture(e);
  return { map, emissiveMap, normalMap: normalFromHeight(h, 2) };
}

function grass({ size = 256 }) {
  const c = mk(size);
  paintPixels(c, (x, y) => {
    const g = grain(x, y, size, 12, 77) - 0.5;
    const g2 = grain(x, y, size, 48, 78, 2) - 0.5;
    const k = 1 + g * 0.35 + g2 * 0.25;
    return [92 * k, 168 * k, 72 * k];
  });
  return { map: toTexture(c) };
}

function plain({ v = 230 }) {
  const c = mk(64);
  paintPixels(c, (x, y) => { const k = 1 + (grain(x, y, 64, 4, 3) - 0.5) * 0.05; return [v * k, v * k, v * k]; });
  return { map: toTexture(c) };
}

const MAKERS = { concrete, pavers, grate, corrugated, wood, hazard, plazaTiles, facade, grass, plain };

export function getTex(name, opts = {}) {
  const key = name + JSON.stringify(opts);
  if (!cache.has(key)) cache.set(key, MAKERS[name](opts));
  return cache.get(key);
}

// ---------------------------------------------------------------------------
// Text / sign textures
export function signTexture(text, { w = 512, h = 128, bg = '#1b1e2b', fg = '#ffffff', accent = '#ff2e88', font = 'Bungee, "Arial Black", Impact, sans-serif', size = 72, stroke = null } = {}) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d');
  if (bg) {
    ctx.fillStyle = bg;
    ctx.beginPath(); ctx.roundRect(0, 0, w, h, h * 0.18); ctx.fill();
    ctx.strokeStyle = accent; ctx.lineWidth = h * 0.07;
    ctx.beginPath(); ctx.roundRect(h * 0.06, h * 0.06, w - h * 0.12, h - h * 0.12, h * 0.14); ctx.stroke();
  }
  ctx.font = `${size}px ${font}`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  if (stroke) { ctx.lineWidth = size * 0.12; ctx.strokeStyle = stroke; ctx.strokeText(text, w / 2, h / 2 + size * 0.05); }
  ctx.fillStyle = fg;
  ctx.fillText(text, w / 2, h / 2 + size * 0.05);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}
