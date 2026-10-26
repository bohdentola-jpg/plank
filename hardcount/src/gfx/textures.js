// Procedural canvas texture helpers shared by every builder. Color maps are
// tagged sRGB, data maps (roughness, alpha) linear.
import * as THREE from 'three';
import { makeRng } from '../core/util.js';

export const texCache = new Map();

export function canvas(w, h) {
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

export function cached(key, fn) {
  if (!texCache.has(key)) texCache.set(key, fn());
  return texCache.get(key);
}

/** Speckle noise fill. */
export function grain(ctx, w, h, rng, amount, size = 1, light = '255,255,255', dark = '0,0,0') {
  const n = Math.floor(w * h * amount);
  for (let i = 0; i < n; i++) {
    const x = rng() * w, y = rng() * h;
    const a = rng() * 0.25;
    ctx.fillStyle = rng() < 0.5 ? `rgba(${light},${a})` : `rgba(${dark},${a})`;
    ctx.fillRect(x, y, size, size);
  }
}

export function blotches(ctx, w, h, rng, n, color, rMin, rMax, alpha = 0.2) {
  for (let i = 0; i < n; i++) {
    const x = rng() * w, y = rng() * h, r = rMin + rng() * (rMax - rMin);
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `rgba(${color},${alpha})`);
    g.addColorStop(1, `rgba(${color},0)`);
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
}

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

export { makeRng };
