// Math the whole tape runs on: seeded randomness, value noise, easing, and the
// 2D grid raycast that both the level light-baker and the entities' eyes use.
// Nothing in here touches three.js or the DOM, so the headless validator can
// import it and run a whole level build in a few milliseconds.

// ------------------------------------------------------------------ random
// mulberry32: small, fast, and identical every run for a given seed. A tape
// that plays differently each time is a different tape.
export function rng(seed = 1) {
  let a = (seed >>> 0) || 1;
  return function next() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashStr(s) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < String(s).length; i++) {
    h ^= String(s).charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

// A bundle of shaped random helpers around one stream.
export function randoms(seed) {
  const r = rng(seed);
  const rand = (a = 1, b) => (b === undefined ? r() * a : a + r() * (b - a));
  const randInt = (a, b) => Math.floor(b === undefined ? r() * a : a + r() * (b - a + 1));
  const pick = (arr) => arr[Math.floor(r() * arr.length) % arr.length];
  const chance = (p) => r() < p;
  const shuffle = (arr) => {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(r() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };
  // gaussian-ish, for crowds and clutter that shouldn't look uniform
  const bell = (mid, spread) => mid + (r() + r() + r() - 1.5) * spread * 0.8;
  return { r, rand, randInt, pick, chance, shuffle, bell };
}

// ------------------------------------------------------------------ noise
// Value noise with smooth interpolation — enough for stains, damp patches,
// grain, drifting fog and wobbling water. Cheap and seamless-enough.
export class Noise2 {
  constructor(seed = 1) {
    this.p = new Float32Array(4096);
    const r = rng(seed);
    for (let i = 0; i < this.p.length; i++) this.p[i] = r();
  }

  raw(xi, yi) {
    const h = (Math.imul(xi | 0, 374761393) ^ Math.imul(yi | 0, 668265263)) >>> 0;
    return this.p[(h ^ (h >>> 13)) & 4095];
  }

  at(x, y) {
    const xi = Math.floor(x), yi = Math.floor(y);
    const fx = x - xi, fy = y - yi;
    const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
    const a = this.raw(xi, yi), b = this.raw(xi + 1, yi);
    const c = this.raw(xi, yi + 1), d = this.raw(xi + 1, yi + 1);
    const top = a + (b - a) * sx, bot = c + (d - c) * sx;
    return (top + (bot - top) * sy) * 2 - 1;
  }

  fbm(x, y, octaves = 4, gain = 0.5, lac = 2) {
    let sum = 0, amp = 1, norm = 0, f = 1;
    for (let i = 0; i < octaves; i++) {
      sum += this.at(x * f, y * f) * amp;
      norm += amp;
      amp *= gain;
      f *= lac;
    }
    return sum / (norm || 1);
  }
}

// ------------------------------------------------------------------ scalars
export const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
export const clamp01 = (v) => clamp(v, 0, 1);
export const lerp = (a, b, t) => a + (b - a) * t;
export const smooth = (t) => t * t * (3 - 2 * t);
export const invLerp = (a, b, v) => (b === a ? 0 : clamp01((v - a) / (b - a)));
export const damp = (cur, want, rate, dt) => cur + (want - cur) * (1 - Math.exp(-rate * dt));
export const wrapAngle = (a) => {
  let x = a;
  while (x > Math.PI) x -= Math.PI * 2;
  while (x < -Math.PI) x += Math.PI * 2;
  return x;
};
export const dist2 = (ax, az, bx, bz) => Math.hypot(ax - bx, az - bz);

// ------------------------------------------------------------------ grid sight
// Amanatides–Woo DDA across a cell grid. `blocked(cx,cz)` decides opacity.
// Returns true when nothing stopped the ray — used for entity line of sight,
// for the light baker's shadows, and for "is that thing watching me".
export function gridClear(blocked, ax, az, bx, bz, cell = 1) {
  const x0 = ax / cell, z0 = az / cell, x1 = bx / cell, z1 = bz / cell;
  let cx = Math.floor(x0), cz = Math.floor(z0);
  const ecx = Math.floor(x1), ecz = Math.floor(z1);
  const dx = x1 - x0, dz = z1 - z0;
  const stepX = dx > 0 ? 1 : -1, stepZ = dz > 0 ? 1 : -1;
  const tdx = dx === 0 ? Infinity : Math.abs(1 / dx);
  const tdz = dz === 0 ? Infinity : Math.abs(1 / dz);
  let tmx = dx === 0 ? Infinity : ((dx > 0 ? cx + 1 - x0 : x0 - cx) * tdx);
  let tmz = dz === 0 ? Infinity : ((dz > 0 ? cz + 1 - z0 : z0 - cz) * tdz);
  let guard = 0;
  while (guard++ < 4096) {
    if (cx === ecx && cz === ecz) return true;
    if (tmx < tmz) { cx += stepX; tmx += tdx; } else { cz += stepZ; tmz += tdz; }
    if (tmx > 1 && tmz > 1 && !(cx === ecx && cz === ecz)) return true;
    if (blocked(cx, cz)) return false;
  }
  return false;
}

// ------------------------------------------------------------------ misc
export const fmtTime = (secs) => {
  const s = Math.max(0, Math.floor(secs));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
};

// Frame counter formatting for the camcorder's timecode: HH:MM:SS:FF
export const fmtTimecode = (secs, fps = 30) => {
  const s = Math.max(0, secs);
  const f = Math.floor((s % 1) * fps);
  return `${fmtTime(s)}:${String(f).padStart(2, '0')}`;
};
