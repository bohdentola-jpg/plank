// Small math + randomness helpers shared everywhere.

export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const invLerp = (a, b, v) => (v - a) / (b - a);
export const smoothstep = (a, b, v) => {
  const t = clamp((v - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
export const sign = (v) => (v < 0 ? -1 : 1);
export const TAU = Math.PI * 2;

/** Wrap an angle to (-π, π]. */
export function wrapAngle(a) {
  a = (a + Math.PI) % TAU;
  if (a < 0) a += TAU;
  return a - Math.PI;
}

/** Frame-rate independent exponential approach. */
export const damp = (cur, target, rate, dt) => target + (cur - target) * Math.exp(-rate * dt);

export const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
export const easeInOutCubic = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
export const easeOutBack = (t) => {
  const c1 = 1.70158, c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
};

/** Mulberry32 — tiny seeded PRNG. rng() → [0,1). */
export function makeRng(seed) {
  let a = (typeof seed === 'string' ? hashString(seed) : seed >>> 0) || 0x9e3779b9;
  const rng = () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  rng.range = (lo, hi) => lo + (hi - lo) * rng();
  rng.int = (lo, hi) => Math.floor(lo + (hi - lo + 1) * rng());
  rng.pick = (arr) => arr[Math.floor(rng() * arr.length)];
  rng.chance = (p) => rng() < p;
  rng.sign = () => (rng() < 0.5 ? -1 : 1);
  rng.gauss = () => {
    let u = 0, v = 0;
    while (u === 0) u = rng();
    while (v === 0) v = rng();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(TAU * v);
  };
  return rng;
}

export function hashString(s) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Value noise 2D (smooth), deterministic per seed. Returns ~[-1,1]. */
export function makeNoise2D(seed = 1) {
  const perm = new Uint8Array(512);
  const rng = makeRng(seed);
  const p = new Uint8Array(256);
  for (let i = 0; i < 256; i++) p[i] = i;
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [p[i], p[j]] = [p[j], p[i]];
  }
  for (let i = 0; i < 512; i++) perm[i] = p[i & 255];
  const grad = (h, x, y) => {
    switch (h & 7) {
      case 0: return x + y;
      case 1: return -x + y;
      case 2: return x - y;
      case 3: return -x - y;
      case 4: return x;
      case 5: return -x;
      case 6: return y;
      default: return -y;
    }
  };
  const fade = (t) => t * t * t * (t * (t * 6 - 15) + 10);
  // gradient (Perlin) noise
  const noise = (x, y) => {
    const X = Math.floor(x) & 255, Y = Math.floor(y) & 255;
    x -= Math.floor(x);
    y -= Math.floor(y);
    const u = fade(x), v = fade(y);
    const a = perm[X] + Y, b = perm[X + 1] + Y;
    return lerp(
      lerp(grad(perm[a], x, y), grad(perm[b], x - 1, y), u),
      lerp(grad(perm[a + 1], x, y - 1), grad(perm[b + 1], x - 1, y - 1), u),
      v,
    ) * 0.7071;
  };
  noise.fbm = (x, y, oct = 4, lac = 2, gain = 0.5) => {
    let amp = 1, f = 1, sum = 0, norm = 0;
    for (let i = 0; i < oct; i++) {
      sum += noise(x * f, y * f) * amp;
      norm += amp;
      amp *= gain;
      f *= lac;
    }
    return sum / norm;
  };
  noise.ridged = (x, y, oct = 4) => {
    let amp = 1, f = 1, sum = 0, norm = 0;
    for (let i = 0; i < oct; i++) {
      const n = 1 - Math.abs(noise(x * f, y * f));
      sum += n * n * amp;
      norm += amp;
      amp *= 0.5;
      f *= 2.03;
    }
    return sum / norm;
  };
  return noise;
}

export function fmtTime(sec, withMs = true) {
  if (!isFinite(sec) || sec < 0) return withMs ? '-:--.--' : '-:--';
  const m = Math.floor(sec / 60);
  const s = sec - m * 60;
  if (!withMs) return `${m}:${String(Math.floor(s)).padStart(2, '0')}`;
  const whole = Math.floor(s);
  const cs = Math.floor((s - whole) * 100);
  return `${m}:${String(whole).padStart(2, '0')}.${String(cs).padStart(2, '0')}`;
}

export function ordinal(n) {
  const s = ['TH', 'ST', 'ND', 'RD'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

export function fmtMoney(n) {
  return '$' + Math.round(n).toLocaleString('en-US');
}

/** '#rrggbb' ↔ [r,g,b] 0..1 */
export function hexToRgb(hex) {
  const n = parseInt(hex.replace('#', ''), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}
export function rgbToHex(r, g, b) {
  const c = (v) => Math.round(clamp(v, 0, 1) * 255).toString(16).padStart(2, '0');
  return '#' + c(r) + c(g) + c(b);
}
export function shade(hex, f) {
  const [r, g, b] = hexToRgb(hex);
  if (f >= 0) return rgbToHex(r + (1 - r) * f, g + (1 - g) * f, b + (1 - b) * f);
  return rgbToHex(r * (1 + f), g * (1 + f), b * (1 + f));
}

export const nextFrame = () => new Promise((r) => requestAnimationFrame(() => r()));

/**
 * Free the GPU memory behind a scene-graph subtree: every geometry, material
 * and texture under `root`, plus any `extra` disposables. three.js materials
 * don't free their own textures, so this does. Render-target textures (the
 * cached environment maps) and textures marked userData.keep are left alone;
 * a texture that is still used elsewhere just gets re-uploaded on next use.
 */
export function disposeTree(root, extra = []) {
  const geos = new Set(), mats = new Set(), texs = new Set();
  const addMat = (m) => { if (m) mats.add(m); };
  root?.traverse?.((o) => {
    if (o.geometry) geos.add(o.geometry);
    if (Array.isArray(o.material)) o.material.forEach(addMat); else addMat(o.material);
    if (o.isInstancedMesh) o.dispose?.();
  });
  const rest = [];
  for (const d of extra) {
    if (!d) continue;
    if (d.isTexture) texs.add(d);
    else if (d.isMaterial) mats.add(d);
    else if (d.isBufferGeometry) geos.add(d);
    else rest.push(d);
  }
  for (const m of mats) {
    for (const k in m) { const v = m[k]; if (v && v.isTexture) texs.add(v); }
    if (m.uniforms) for (const k in m.uniforms) { const v = m.uniforms[k] && m.uniforms[k].value; if (v && v.isTexture) texs.add(v); }
  }
  for (const g of geos) g.dispose();
  for (const m of mats) m.dispose();
  for (const t of texs) if (!t.isRenderTargetTexture && !(t.userData && t.userData.keep)) t.dispose();
  for (const d of rest) d.dispose?.();
}
