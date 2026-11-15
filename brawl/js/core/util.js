// Small math + helper toolbox shared by everything.

export const TAU = Math.PI * 2;
export const DEG = Math.PI / 180;

export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const sign = (v) => (v < 0 ? -1 : v > 0 ? 1 : 0);
export const approach = (v, target, step) =>
  v < target ? Math.min(v + step, target) : Math.max(v - step, target);
export const dist = (x1, y1, x2, y2) => Math.hypot(x2 - x1, y2 - y1);
export const wrap = (v, n) => ((v % n) + n) % n;

// ---- easing -----------------------------------------------------------
export const ease = {
  lin: (t) => t,
  in: (t) => t * t,
  out: (t) => 1 - (1 - t) * (1 - t),
  io: (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2),
  out3: (t) => 1 - Math.pow(1 - t, 3),
  in3: (t) => t * t * t,
  // the overshoot-y tween every Flash menu used
  back: (t) => {
    const c1 = 1.70158, c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  },
  elastic: (t) => {
    if (t === 0 || t === 1) return t;
    return Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * (TAU / 3)) + 1;
  },
  bounce: (t) => {
    const n1 = 7.5625, d1 = 2.75;
    if (t < 1 / d1) return n1 * t * t;
    if (t < 2 / d1) return n1 * (t -= 1.5 / d1) * t + 0.75;
    if (t < 2.5 / d1) return n1 * (t -= 2.25 / d1) * t + 0.9375;
    return n1 * (t -= 2.625 / d1) * t + 0.984375;
  },
  snap: (t) => (t < 1 ? 0 : 1),
};

// ---- deterministic RNG (mulberry32) so matches can be replayed in tests ---
export class RNG {
  constructor(seed = 1) { this.s = seed >>> 0 || 1; }
  next() {
    let t = (this.s += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  range(a, b) { return a + (b - a) * this.next(); }
  int(a, b) { return Math.floor(this.range(a, b + 1)); }
  pick(arr) { return arr[Math.floor(this.next() * arr.length)]; }
  chance(p) { return this.next() < p; }
  sign() { return this.next() < 0.5 ? -1 : 1; }
}

// A non-deterministic one for purely cosmetic things (menus, particles).
export const vrng = new RNG((Date.now() ^ 0x9e3779b9) >>> 0);

// ---- geometry ----------------------------------------------------------
export function rectsOverlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}
export function circleRect(cx, cy, r, rx, ry, rw, rh) {
  const nx = clamp(cx, rx, rx + rw), ny = clamp(cy, ry, ry + rh);
  const dx = cx - nx, dy = cy - ny;
  return dx * dx + dy * dy <= r * r;
}
export function circleCircle(x1, y1, r1, x2, y2, r2) {
  const dx = x2 - x1, dy = y2 - y1, rr = r1 + r2;
  return dx * dx + dy * dy <= rr * rr;
}
export function pointInRect(px, py, r) {
  return px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h;
}

// ---- pose helpers --------------------------------------------------------
// A pose is a flat object of numbers and [x,y] pairs. These blend them.
export function lerpPose(a, b, t, out = {}) {
  for (const k in a) {
    const av = a[k], bv = b[k];
    if (bv === undefined) { out[k] = av; continue; }
    if (typeof av === 'number') out[k] = av + (bv - av) * t;
    else if (Array.isArray(av)) {
      const o = out[k] && out[k] !== av && out[k] !== bv ? out[k] : [];
      for (let i = 0; i < av.length; i++) o[i] = av[i] + (bv[i] - av[i]) * t;
      out[k] = o;
    } else out[k] = t < 0.5 ? av : bv;
  }
  for (const k in b) if (!(k in a)) out[k] = b[k];
  return out;
}

export function clonePose(p) {
  const o = {};
  for (const k in p) o[k] = Array.isArray(p[k]) ? p[k].slice() : p[k];
  return o;
}

// Keyframes: [[frame, poseDelta, easeName?], ...]. Each delta is applied on top
// of `base` (the stance), so a key only lists what differs from standing still.
// The ease on a key shapes the tween that ARRIVES at that key.
export function evalKeys(keys, frame, base) {
  if (!keys || !keys.length) return clonePose(base);
  let i = 0;
  while (i < keys.length - 1 && keys[i + 1][0] <= frame) i++;
  const k0 = keys[i];
  const p0 = Object.assign({}, base, k0[1]);
  if (i === keys.length - 1 || frame <= k0[0]) return clonePose(p0);
  const k1 = keys[i + 1];
  const p1 = Object.assign({}, base, k1[1]);
  let t = (frame - k0[0]) / Math.max(1, k1[0] - k0[0]);
  const e = ease[k1[2] || 'io'];
  t = e ? e(clamp(t, 0, 1)) : t;
  return lerpPose(p0, p1, t, {});
}

// Shorthand used by the fighter files to write keyframe lists.
export const K = (...keys) => keys;

export function fmtTime(frames) {
  const s = Math.max(0, Math.ceil(frames / 60));
  const m = Math.floor(s / 60), r = s % 60;
  return m + ':' + (r < 10 ? '0' : '') + r;
}

export function shuffle(arr, rng = vrng) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng.next() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
