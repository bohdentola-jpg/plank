// Small math + randomness helpers shared everywhere.
import * as THREE from 'three';

export const TAU = Math.PI * 2;
export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const invLerp = (a, b, v) => clamp((v - a) / (b - a), 0, 1);
export const smooth = (t) => t * t * (3 - 2 * t);
// frame-rate independent exponential smoothing factor
export const damp = (rate, dt) => 1 - Math.exp(-rate * dt);
export const rand = (a = 0, b = 1) => a + Math.random() * (b - a);
export const randInt = (a, b) => Math.floor(rand(a, b + 1));
export const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
export const chance = (p) => Math.random() < p;

export function angleDiff(a, b) {
  let d = (b - a) % TAU;
  if (d > Math.PI) d -= TAU;
  if (d < -Math.PI) d += TAU;
  return d;
}
export function approachAngle(a, b, maxStep) {
  const d = angleDiff(a, b);
  return Math.abs(d) <= maxStep ? b : a + Math.sign(d) * maxStep;
}
export function dampAngle(a, b, rate, dt) {
  return a + angleDiff(a, b) * damp(rate, dt);
}

// Seeded PRNG (mulberry32)
export function rng(seed = 1) {
  let s = seed >>> 0;
  const f = () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  f.range = (a, b) => a + f() * (b - a);
  f.int = (a, b) => Math.floor(a + f() * (b - a + 1));
  f.pick = (arr) => arr[Math.floor(f() * arr.length)];
  return f;
}

// Cheap smooth 2D value noise + fbm (used for procedural textures)
function hash2(x, y, seed) {
  let h = (x * 374761393 + y * 668265263 + seed * 1442695041) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
export function valueNoise(x, y, seed = 0, period = 0) {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const w = (n) => (period ? ((n % period) + period) % period : n);
  const a = hash2(w(xi), w(yi), seed), b = hash2(w(xi + 1), w(yi), seed);
  const c = hash2(w(xi), w(yi + 1), seed), d = hash2(w(xi + 1), w(yi + 1), seed);
  return lerp(lerp(a, b, u), lerp(c, d, u), v);
}
export function fbm(x, y, oct = 4, seed = 0, period = 0) {
  let s = 0, amp = 0.5, f = 1, norm = 0;
  for (let i = 0; i < oct; i++) {
    s += amp * valueNoise(x * f, y * f, seed + i * 17, period ? period * f : 0);
    norm += amp; amp *= 0.5; f *= 2;
  }
  return s / norm;
}

export const v3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
export const col = (hex) => new THREE.Color(hex);

// Linear-space colour from hex (for shader uniforms)
export function linColor(hex) {
  const c = new THREE.Color(hex);
  return c; // THREE.Color is linear internally when ColorManagement is enabled
}

export function hexToCss(c) {
  return '#' + new THREE.Color(c).getHexString();
}

export function formatTime(t) {
  t = Math.max(0, Math.ceil(t));
  const m = Math.floor(t / 60), s = t % 60;
  return `${m}:${s < 10 ? '0' : ''}${s}`;
}

// Distance from point p to segment ab (all Vector3); returns squared distance and writes t
export function segPointDistSq(ax, ay, az, bx, by, bz, px, py, pz) {
  const abx = bx - ax, aby = by - ay, abz = bz - az;
  const apx = px - ax, apy = py - ay, apz = pz - az;
  const len = abx * abx + aby * aby + abz * abz;
  let t = len > 0 ? (apx * abx + apy * aby + apz * abz) / len : 0;
  t = clamp(t, 0, 1);
  const dx = ax + abx * t - px, dy = ay + aby * t - py, dz = az + abz * t - pz;
  return dx * dx + dy * dy + dz * dz;
}

// Closest approach between segment (a->b) and a vertical capsule segment (c0..c1 along y)
export function segCapsuleDistSq(a, b, cx, cy0, cy1, cz) {
  // sample-based refinement is plenty for gameplay accuracy
  let best = Infinity;
  const N = 6;
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    const x = a.x + (b.x - a.x) * t, y = a.y + (b.y - a.y) * t, z = a.z + (b.z - a.z) * t;
    const yy = clamp(y, cy0, cy1);
    const d = (x - cx) * (x - cx) + (y - yy) * (y - yy) + (z - cz) * (z - cz);
    if (d < best) best = d;
  }
  return best;
}

export const TEAM_NAMES = ['', 'ALPHA', 'BRAVO'];

// Team colour pairs: [teamA, teamB, label]
export const COLOR_PAIRS = [
  { a: '#ff2e88', b: '#3cf03c', name: 'Bubblegum vs Lime' },
  { a: '#ff7a00', b: '#1e6bff', name: 'Tangerine vs Cobalt' },
  { a: '#a335ff', b: '#ffd21a', name: 'Grape vs Lemon' },
  { a: '#00d8c0', b: '#ff2ed1', name: 'Mint vs Magenta' },
  { a: '#ff3b3b', b: '#20d0ff', name: 'Cherry vs Sky' },
  { a: '#c8ff00', b: '#7a2cff', name: 'Acid vs Violet' },
];
