// FOCUS GROUP — the small arithmetic everything else stands on.

export const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
export const clamp01 = (v) => clamp(v, 0, 1);
export const lerp = (a, b, t) => a + (b - a) * t;
export const smooth = (t) => t * t * (3 - 2 * t);

// frame-rate independent approach: damp(current, target, rate, dt)
export const damp = (cur, want, rate, dt) => cur + (want - cur) * (1 - Math.exp(-rate * dt));

/** Mulberry32. Same seed, same morning. */
export function rng(seed = 1) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Cheap value noise, good enough for grain and stains. */
export class Noise2 {
  constructor(seed = 1) {
    const R = rng(seed);
    this.p = new Uint8Array(512);
    const perm = new Uint8Array(256);
    for (let i = 0; i < 256; i++) perm[i] = i;
    for (let i = 255; i > 0; i--) {
      const j = Math.floor(R() * (i + 1));
      [perm[i], perm[j]] = [perm[j], perm[i]];
    }
    for (let i = 0; i < 512; i++) this.p[i] = perm[i & 255];
  }

  at(x, y) {
    const xi = Math.floor(x) & 255;
    const yi = Math.floor(y) & 255;
    const xf = x - Math.floor(x);
    const yf = y - Math.floor(y);
    const u = smooth(xf);
    const v = smooth(yf);
    const h = (a, b) => this.p[(this.p[a & 255] + b) & 255] / 255;
    const n00 = h(xi, yi);
    const n10 = h(xi + 1, yi);
    const n01 = h(xi, yi + 1);
    const n11 = h(xi + 1, yi + 1);
    return lerp(lerp(n00, n10, u), lerp(n01, n11, u), v);
  }

  fbm(x, y, oct = 4) {
    let sum = 0, amp = 0.5, f = 1, norm = 0;
    for (let i = 0; i < oct; i++) {
      sum += this.at(x * f, y * f) * amp;
      norm += amp;
      amp *= 0.5;
      f *= 2;
    }
    return sum / norm;
  }
}

// --------------------------------------------------------------- time

/** 06:41:07 — the burned-in clock on a surveillance frame. */
export function fmtClock(secs) {
  const s = Math.max(0, Math.floor(secs));
  const hh = String(Math.floor(s / 3600) % 24).padStart(2, '0');
  const mm = String(Math.floor(s / 60) % 60).padStart(2, '0');
  const ss = String(s % 60).padStart(2, '0');
  return `${hh}:${mm}:${ss}`;
}

/** The date strip a 1974 time-lapse deck would burn in. */
export function fmtStamp(dayIndex, secs) {
  const days = ['05', '06', '07', '08', '09', '10'];
  return `74-03-${days[clamp(dayIndex, 0, 5)]}  ${fmtClock(secs)}`;
}

// --------------------------------------------------------------- geometry

export const dist2 = (ax, az, bx, bz) => Math.hypot(ax - bx, az - bz);

/** Shortest signed angle from a to b, in radians. */
export function angleDelta(a, b) {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}

/** Is world point (x,z) inside an axis-aligned rectangle? */
export const inRect = (x, z, r) => x >= r.x0 && x <= r.x1 && z >= r.z0 && z <= r.z1;

/** Grow/shrink a rect by m on all sides. */
export const padRect = (r, m) => ({ x0: r.x0 - m, x1: r.x1 + m, z0: r.z0 - m, z1: r.z1 + m });

export const rectCentre = (r) => ({ x: (r.x0 + r.x1) / 2, z: (r.z0 + r.z1) / 2 });

// --------------------------------------------------------------- misc

export const pick = (arr, R = Math.random) => arr[Math.floor(R() * arr.length) % arr.length];

export function shuffled(arr, R = Math.random) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(R() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Title-case a checklist line without touching words that are already shouting. */
export const shout = (s) => String(s).toUpperCase();
