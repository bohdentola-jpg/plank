// Shared helpers: canvas textures, color math, seeded rng.
import * as THREE from 'three';

export function mkCanvas(w, h) {
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  return cv;
}

export function tex(canvas, { repeat = null, srgb = true, aniso = 8 } = {}) {
  const t = new THREE.CanvasTexture(canvas);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(repeat[0], repeat[1]);
  }
  t.anisotropy = aniso;
  return t;
}

export function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  const f = (v) => Math.max(0, Math.min(255, Math.round(v + amt)));
  const r = f((n >> 16) & 255), g = f((n >> 8) & 255), b = f(n & 255);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

export function luminance(hex) {
  const n = parseInt(hex.slice(1), 16);
  return (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
}

export function contrastText(hex) { return luminance(hex) > 0.55 ? '#16181d' : '#f6f6f4'; }

let seed = Date.now() % 2147483647;
export function srand(s) { seed = (s % 2147483647) || 1; }
export function rnd() { seed = (seed * 48271) % 2147483647; return (seed - 1) / 2147483646; }
export function pick(arr) { return arr[Math.floor(rnd() * arr.length)]; }
export function irange(a, b) { return a + Math.floor(rnd() * (b - a + 1)); }

export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const lerp = (a, b, t) => a + (b - a) * t;
