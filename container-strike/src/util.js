// Math and RNG utilities. The seeded PRNG is what makes recoil patterns
// deterministic: the same weapon id always hashes to the same pattern.

export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const DEG = Math.PI / 180;

export function strHash(s) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const rand = (a = 1, b) => (b === undefined ? Math.random() * a : a + Math.random() * (b - a));
export const randInt = (a, b) => Math.floor(rand(a, b + 1));
export const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

export function moveToward(cur, target, maxDelta) {
  const d = target - cur;
  if (Math.abs(d) <= maxDelta) return target;
  return cur + Math.sign(d) * maxDelta;
}

export function angleDiff(a, b) {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}

// Ray vs AABB (slab method). Returns { tMin, tMax, normal } or null.
// dir need not be normalized; t values are in units of |dir|.
export function rayAABB(ox, oy, oz, dx, dy, dz, min, max) {
  let tMin = -Infinity, tMax = Infinity;
  let nx = 0, ny = 0, nz = 0;
  const axes = [
    [ox, dx, min.x, max.x, 1, 0, 0],
    [oy, dy, min.y, max.y, 0, 1, 0],
    [oz, dz, min.z, max.z, 0, 0, 1],
  ];
  for (const [o, d, lo, hi, ax, ay, az] of axes) {
    if (Math.abs(d) < 1e-9) {
      if (o < lo || o > hi) return null;
      continue;
    }
    let t1 = (lo - o) / d, t2 = (hi - o) / d;
    let sign = -1;
    if (t1 > t2) { const tmp = t1; t1 = t2; t2 = tmp; sign = 1; }
    if (t1 > tMin) { tMin = t1; nx = ax * sign; ny = ay * sign; nz = az * sign; }
    if (t2 < tMax) tMax = t2;
    if (tMin > tMax) return null;
  }
  if (tMax < 0) return null;
  return { tMin, tMax, nx, ny, nz };
}

// Ray vs sphere. Returns smallest positive t (units of |dir|) or -1.
export function raySphere(ox, oy, oz, dx, dy, dz, cx, cy, cz, r) {
  const lx = cx - ox, ly = cy - oy, lz = cz - oz;
  const dd = dx * dx + dy * dy + dz * dz;
  if (dd < 1e-12) return -1;
  const tca = (lx * dx + ly * dy + lz * dz) / dd;
  const d2 = lx * lx + ly * ly + lz * lz - tca * tca * dd;
  const r2 = r * r;
  if (d2 > r2) return -1;
  const thc = Math.sqrt((r2 - d2) / dd);
  const t0 = tca - thc, t1 = tca + thc;
  if (t0 >= 0) return t0;
  if (t1 >= 0) return t1;
  return -1;
}

export function fmtMoney(n) { return '$' + n; }
export function fmtTime(sec) {
  sec = Math.max(0, Math.ceil(sec));
  return Math.floor(sec / 60) + ':' + String(sec % 60).padStart(2, '0');
}
