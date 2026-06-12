// Seeded randomness + noise. Everything the generator does flows from one
// world seed, so the same seed always builds the same world.

export function hashStr(s) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

// mulberry32: tiny, fast, good enough for terrain decoration
export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// integer lattice hash → [0,1), cheap and deterministic per (seed,x,y,z)
export function hash3(seed, x, y, z) {
  let h = seed ^ Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(z, 2147483647 ^ 1274126177);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

// ------------------------------------------------------------ 2D simplex
// Compact simplex noise for heightmaps / climate. Output roughly [-1, 1].
const F2 = 0.5 * (Math.sqrt(3) - 1);
const G2 = (3 - Math.sqrt(3)) / 6;
const GRAD2 = [[1, 1], [-1, 1], [1, -1], [-1, -1], [1, 0], [-1, 0], [0, 1], [0, -1]];

export class Noise2 {
  constructor(seed) {
    const r = rng(seed);
    this.perm = new Uint8Array(512);
    const p = new Uint8Array(256);
    for (let i = 0; i < 256; i++) p[i] = i;
    for (let i = 255; i > 0; i--) {
      const j = (r() * (i + 1)) | 0;
      [p[i], p[j]] = [p[j], p[i]];
    }
    for (let i = 0; i < 512; i++) this.perm[i] = p[i & 255];
  }

  at(xin, yin) {
    const perm = this.perm;
    const s = (xin + yin) * F2;
    const i = Math.floor(xin + s), j = Math.floor(yin + s);
    const t = (i + j) * G2;
    const x0 = xin - (i - t), y0 = yin - (j - t);
    const i1 = x0 > y0 ? 1 : 0, j1 = x0 > y0 ? 0 : 1;
    const x1 = x0 - i1 + G2, y1 = y0 - j1 + G2;
    const x2 = x0 - 1 + 2 * G2, y2 = y0 - 1 + 2 * G2;
    const ii = i & 255, jj = j & 255;
    let n = 0;
    let t0 = 0.5 - x0 * x0 - y0 * y0;
    if (t0 > 0) {
      const g = GRAD2[perm[ii + perm[jj]] & 7];
      t0 *= t0; n += t0 * t0 * (g[0] * x0 + g[1] * y0);
    }
    let t1 = 0.5 - x1 * x1 - y1 * y1;
    if (t1 > 0) {
      const g = GRAD2[perm[ii + i1 + perm[jj + j1]] & 7];
      t1 *= t1; n += t1 * t1 * (g[0] * x1 + g[1] * y1);
    }
    let t2 = 0.5 - x2 * x2 - y2 * y2;
    if (t2 > 0) {
      const g = GRAD2[perm[ii + 1 + perm[jj + 1]] & 7];
      t2 *= t2; n += t2 * t2 * (g[0] * x2 + g[1] * y2);
    }
    return 70 * n;
  }

  // fractal sum: octaves of self, persistence 0.5
  fbm(x, y, oct = 4, lac = 2, gain = 0.5) {
    let amp = 1, f = 1, sum = 0, norm = 0;
    for (let o = 0; o < oct; o++) {
      sum += amp * this.at(x * f, y * f);
      norm += amp;
      amp *= gain; f *= lac;
    }
    return sum / norm;
  }

  // ridged variant for mountain crests
  ridge(x, y, oct = 4) {
    let amp = 0.5, f = 1, sum = 0;
    for (let o = 0; o < oct; o++) {
      sum += amp * (1 - Math.abs(this.at(x * f, y * f)));
      amp *= 0.5; f *= 2.1;
    }
    return sum;
  }
}

// ------------------------------------------------------------ 3D value noise
// Trilinear value noise for cave carving. Output [-1, 1].
export class Noise3 {
  constructor(seed) { this.seed = seed >>> 0; }

  at(x, y, z) {
    const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
    const xf = x - xi, yf = y - yi, zf = z - zi;
    const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf), w = zf * zf * (3 - 2 * zf);
    const s = this.seed;
    const c000 = hash3(s, xi, yi, zi), c100 = hash3(s, xi + 1, yi, zi);
    const c010 = hash3(s, xi, yi + 1, zi), c110 = hash3(s, xi + 1, yi + 1, zi);
    const c001 = hash3(s, xi, yi, zi + 1), c101 = hash3(s, xi + 1, yi, zi + 1);
    const c011 = hash3(s, xi, yi + 1, zi + 1), c111 = hash3(s, xi + 1, yi + 1, zi + 1);
    const x00 = c000 + (c100 - c000) * u, x10 = c010 + (c110 - c010) * u;
    const x01 = c001 + (c101 - c001) * u, x11 = c011 + (c111 - c011) * u;
    const y0 = x00 + (x10 - x00) * v, y1 = x01 + (x11 - x01) * v;
    return (y0 + (y1 - y0) * w) * 2 - 1;
  }

  fbm(x, y, z, oct = 3) {
    let amp = 1, f = 1, sum = 0, norm = 0;
    for (let o = 0; o < oct; o++) {
      sum += amp * this.at(x * f, y * f, z * f);
      norm += amp;
      amp *= 0.5; f *= 2;
    }
    return sum / norm;
  }
}

export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const smoothstep = (a, b, t) => {
  const x = clamp((t - a) / (b - a), 0, 1);
  return x * x * (3 - 2 * x);
};
