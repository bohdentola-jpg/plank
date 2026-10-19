// PORT HALCYON — the ground. natural(x, z) is the land as it lies before any
// road touches it: the coastal plain, the flat city, Uptown's hill, the
// farms, the lake's hills, the mountains with the Summit and the Ridgeline,
// the desert's mesas, carved by the canyon, the lake basin and the river,
// and falling into the bay at beaches, quays and cliffs.
//
// Terrain (the class) is the land as built: the natural ground graded to
// every road (cut down to it or filled up to it near the road, blending back
// over the road type's `blend`), sampled per world cell on a grid. Physics
// and the meshes both read the same grids, so what you see is what you hit.
import { LAND, ISLAND, CLIFFS, QUAYS, LAKE, LAKE_Y, RIVER, ZONES, CARVES } from './map/base.js';
import { bbox, inBox, inPoly, polyDist, edgeDist, segDist, sstep } from './geom.js';
import { makeNoise2D } from '../core/util.js';

const NZ = makeNoise2D(1337);
const ND = makeNoise2D(4242);

export const CELL = 256;      // world cell size (m)
export const SEA_Y = 0;
const SEA_BED = -14;

// ------------------------------------------------------------------ precompute
const ZS = ZONES.map((Z) => {
  const z = { ...Z };
  if (Z.poly) {
    z.box = bbox(Z.poly, Z.edge || 0);
    if (Z.kind === 'slope') {
      const b = bbox(Z.poly);
      // project onto dir: 0 at the polygon's start side, 1 at the far side
      const proj = Z.poly.map((p) => p[0] * Z.dir[0] + p[1] * Z.dir[1]);
      z.p0 = Math.min(...proj); z.p1 = Math.max(...proj);
      void b;
    }
  } else if (Z.kind === 'peak') {
    z.box = { x0: Z.x - Z.r, z0: Z.z - Z.r, x1: Z.x + Z.r, z1: Z.z + Z.r };
  } else if (Z.kind === 'ridge') {
    z.box = bbox(Z.path, Z.width);
  }
  z.off = (Z.id.length * 37.17) % 100;
  return z;
});
const CS = CARVES.map((C) => ({ ...C, box: bbox(C.path, C.width + 60) }));
const LAND_BOX = bbox(LAND);
const ISLAND_BOX = bbox(ISLAND, 200);
const LAKE_BOX = bbox(LAKE, 120);
const CLIFF_S = CLIFFS.map((c) => ({ ...c, box: bbox(c.poly, 60) }));
const QUAY_S = QUAYS.map((q) => ({ poly: q, box: bbox(q, 10) }));
// river: cumulative length + water level along it
const RIV = (() => {
  const P = RIVER.path;
  const ys = RIVER.ys || P.map((_, i) => RIVER.y0 + (RIVER.y1 - RIVER.y0) * (i / (P.length - 1)));
  const cum = [0];
  for (let i = 1; i < P.length; i++) cum.push(cum[i - 1] + Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]));
  return { P, ys, cum, box: bbox(P, RIVER.width + 80) };
})();

function zoneShape(Z, x, z) {
  switch (Z.kind) {
    case 'flat': return Z.y + (Z.amp ? NZ.fbm(x / Z.scale + Z.off, z / Z.scale, 2) * Z.amp : 0);
    case 'slope': {
      const p = x * Z.dir[0] + z * Z.dir[1];
      const t = Math.max(0, Math.min(1, (p - Z.p0) / Math.max(1, Z.p1 - Z.p0)));
      return Z.y0 + (Z.y1 - Z.y0) * t * t * (3 - 2 * t) + NZ.fbm(x / 260, z / 260, 2) * 1.2;
    }
    case 'hills': return Z.y + NZ.fbm(x / Z.scale + Z.off, z / Z.scale - Z.off, 4) * Z.amp;
    case 'mountains': {
      const r = NZ.ridged(x / Z.scale + Z.off, z / Z.scale, 5);
      const b = NZ.fbm(x / (Z.scale * 2.2), z / (Z.scale * 2.2) + 9, 3);
      return Z.y + (r - 0.42) * Z.amp * 1.7 + b * Z.amp * 0.45;
    }
    case 'mesas': {
      const n = NZ.fbm(x / Z.scale + Z.off, z / Z.scale + 3, 4);
      const lift = Math.max(0, n - 0.08) * Z.amp * 2.2;
      // terraces with soft risers: flat tops, steep cliffs between
      const tr = Z.terrace;
      const k = lift / tr, f = Math.floor(k), fr = k - f;
      const step = f * tr + tr * Math.pow(Math.max(0, (fr - 0.72) / 0.28), 3);
      return Z.y + step + ND.fbm(x / 90, z / 90, 2) * 2.2;
    }
    default: return 0;
  }
}

/** The land as it lies (no roads). */
export function natural(x, z) {
  let h = 10 + NZ.fbm(x / 1400, z / 1400, 3) * 8;
  for (const Z of ZS) {
    if (!inBox(Z.box, x, z)) continue;
    if (Z.kind === 'peak') {
      const d = Math.hypot(x - Z.x, z - Z.z) / Z.r;
      if (d < 1) {
        const k = Math.pow(1 - d, 1.7);
        const rough = 1 + NZ.ridged(x / 520, z / 520, 4) * 0.35;
        h = Math.max(h, h + (Z.h - h) * k * rough * 0.92);
      }
      continue;
    }
    if (Z.kind === 'ridge') {
      let d = Infinity;
      for (let i = 0; i < Z.path.length - 1; i++) d = Math.min(d, segDist(Z.path[i][0], Z.path[i][1], Z.path[i + 1][0], Z.path[i + 1][1], x, z).d);
      if (d < Z.width) {
        const k = 1 - (d / Z.width) ** 2;
        const crest = Z.h + NZ.fbm(x / 300, z / 300, 3) * 40;
        h = Math.max(h, h + (crest - h) * k * k);
      }
      continue;
    }
    // (the boundary wanders, so zones don't read as rectangles)
    const sd = polyDist(Z.poly, x, z) + NZ.fbm(x / 340 + Z.off, z / 340, 3) * (Z.edge || 1) * 0.45;
    const m = sd <= 0 ? 1 : 1 - sstep(0, Z.edge || 1, sd);
    if (m <= 0) continue;
    h += (zoneShape(Z, x, z) - h) * m;
  }
  // carved: the canyon
  for (const C of CS) {
    if (!inBox(C.box, x, z)) continue;
    let d = Infinity;
    for (let i = 0; i < C.path.length - 1; i++) d = Math.min(d, segDist(C.path[i][0], C.path[i][1], C.path[i + 1][0], C.path[i + 1][1], x, z).d);
    const half = C.width / 2;
    if (d < half + 60) {
      const floor = h - C.depth + ND.fbm(x / 120, z / 120, 2) * (C.floorNoise || 0);
      // near-vertical walls in bands (the rock comes away in ledges)
      const t = sstep(half * 0.55, half + 60, d);
      const banded = t < 1 ? Math.floor(t * 5) / 5 + (t * 5 - Math.floor(t * 5)) ** 4 / 5 : 1;
      h = floor + (h - floor) * banded;
    }
  }
  // the lake: shore down to the water, a basin under it
  if (inBox(LAKE_BOX, x, z)) {
    const sd = polyDist(LAKE, x, z);
    if (sd < 0) {
      const bed = LAKE_Y - 1.5 - 13 * sstep(0, 220, -sd);
      h = Math.min(h, bed);
    } else if (sd < 70) {
      const shore = LAKE_Y + 0.7 + sd * 0.05;
      h = shore + (h - shore) * sstep(0, 70, sd);
    }
  }
  // the river: a channel with banks, its water falling toward the sea
  if (inBox(RIV.box, x, z)) {
    const r = riverAt(x, z);
    if (r) {
      const half = RIVER.width / 2;
      const bank = r.y + 2.2;
      if (r.d < half) {
        const bed = r.y - 2.6 * (1 - (r.d / half) ** 2) - 0.6;
        h = bed;
      } else if (r.d < half + 45) {
        // the banks: graded down to just over the water
        const k = sstep(half, half + 45, r.d);
        h = Math.min(h, bank + (h - bank) * k);
        if (h > bank && r.d < half + 6) h = bank;
      }
    }
  }
  // the coast: beaches slide into the bay, quays and cliffs drop into it
  h = coast(h, x, z);
  return h;
}

/** Nearest point on the river: { d, y (water level there) } or null. */
export function riverAt(x, z) {
  const P = RIV.P;
  let best = null;
  for (let i = 0; i < P.length - 1; i++) {
    const s = segDist(P[i][0], P[i][1], P[i + 1][0], P[i + 1][1], x, z);
    if (!best || s.d < best.d) best = { d: s.d, i, t: s.t };
  }
  if (!best || best.d > RIVER.width / 2 + 60) return null;
  const y = RIV.ys[best.i] + (RIV.ys[best.i + 1] - RIV.ys[best.i]) * best.t;
  return { d: best.d, y, i: best.i, t: best.t };
}

function cliffTop(x, z) {
  for (const c of CLIFF_S) if (inBox(c.box, x, z) && inPoly(c.poly, x, z)) return c.top;
  return null;
}

/** Is (x, z) on land (the mainland or the island)? */
export function onLand(x, z) {
  if (inBox(ISLAND_BOX, x, z) && inPoly(ISLAND, x, z)) return true;
  if (!inBox(LAND_BOX, x, z)) return false;
  return inPoly(LAND, x, z);
}

/** Distance to the nearest coastline (mainland or island). */
function coastDist(x, z) {
  let d = Infinity;
  // only the bay side of LAND is coast (the first four vertices are the world's edge)
  for (let i = 3; i < LAND.length; i++) {
    const a = LAND[i], b = LAND[(i + 1) % LAND.length];
    if (i === LAND.length - 1) break;
    const s = segDist(a[0], a[1], b[0], b[1], x, z);
    if (s.d < d) d = s.d;
  }
  if (inBox(ISLAND_BOX, x, z)) d = Math.min(d, edgeDist(ISLAND, x, z));
  return d;
}

function coast(h, x, z) {
  // cheap reject: far inland
  if (z < 1000 && x < 2300) return h;
  const land = onLand(x, z);
  const d = coastDist(x, z);
  if (d > 260) return land ? h : SEA_BED;
  const cliff = cliffTop(x, z);
  const quay = !cliff && QUAY_S.some((q) => inBox(q.box, x, z) && inPoly(q.poly, x, z));
  if (land) {
    if (cliff || quay) return h;
    // a beach: down to the waterline over the last stretch
    const k = sstep(0, 90, d);
    return 0.6 + (h - 0.6) * k;
  }
  if (cliff) return SEA_BED + (h - SEA_BED) * (1 - sstep(0, 26, d)) * 0.8;
  if (quay) return d < 3 ? -6 : SEA_BED + 4 * (1 - sstep(0, 60, d));
  return 0.6 - 15 * sstep(0, 200, d);
}

/** Water surface at (x, z): { y, kind: 'sea'|'lake'|'river' } or null. */
export function waterAt(x, z) {
  if (!onLand(x, z)) return { y: SEA_Y, kind: 'sea' };
  if (inBox(LAKE_BOX, x, z) && inPoly(LAKE, x, z)) return { y: LAKE_Y, kind: 'lake' };
  if (inBox(RIV.box, x, z)) {
    const r = riverAt(x, z);
    if (r && r.d < RIVER.width / 2 + 1) return { y: r.y, kind: 'river' };
  }
  return null;
}

export const river = RIV;

// ------------------------------------------------------------------ built terrain

/**
 * The terrain as built: natural ground graded to the roads, on per-cell
 * grids. res = grid spacing (m) — 4 near the player (and for physics), 16
 * and 32 for the far ground. Cached; built on demand.
 */
export class Terrain {
  constructor(net) {
    this.net = net;
    this.cache = new Map();   // `${res}:${cx}:${cz}` → grid
    this.max = 900;           // cached grids kept
  }

  /** Grid for a cell: { res, n (verts per side), x0, z0, H (Float32Array), R (road mask 0..1), cx, cz }. */
  grid(cx, cz, res = 4) {
    const key = `${res}:${cx}:${cz}`;
    const g = this.cache.get(key);
    if (g) { g.used = this._tick = (this._tick || 0) + 1; return g; }
    return this.keep(key, this.build(cx, cz, res));
  }

  /**
   * The same grid made a slice at a time (a generator, for the streamer: a
   * 4 m grid is several milliseconds of work); its value is the grid. If
   * something asks for it outright meanwhile, that one is kept.
   */
  *gridSteps(cx, cz, res = 4) {
    const key = `${res}:${cx}:${cz}`;
    const had = this.cache.get(key);
    if (had) { had.used = this._tick = (this._tick || 0) + 1; return had; }
    const g = yield* this.buildSteps(cx, cz, res);
    return this.cache.get(key) || this.keep(key, g);
  }

  keep(key, g) {
    g.used = this._tick = (this._tick || 0) + 1;
    this.cache.set(key, g);
    if (this.cache.size > this.max) this.evict();
    return g;
  }

  evict() {
    const arr = [...this.cache.entries()].sort((a, b) => a[1].used - b[1].used);
    for (let i = 0; i < arr.length - this.max * 0.8; i++) this.cache.delete(arr[i][0]);
  }

  build(cx, cz, res) {
    const it = this.buildSteps(cx, cz, res);
    let r;
    do { r = it.next(); } while (!r.done);
    return r.value;
  }

  *buildSteps(cx, cz, res) {
    // n verts a side over the cell, plus a one-vertex apron all round (so
    // normals at the cell's edge match its neighbour's): grid is (n+2)²
    const n = Math.round(CELL / res) + 1;
    const m = n + 2;
    const x0 = cx * CELL, z0 = cz * CELL;
    const ax = x0 - res, az = z0 - res;
    const H = new Float32Array(m * m);
    const N = new Float32Array(m * m);   // natural (kept for colouring)
    for (let j = 0; j < m; j++) {
      for (let i = 0; i < m; i++) {
        const h = natural(ax + i * res, az + j * res);
        H[j * m + i] = h;
        N[j * m + i] = h;
      }
      if (j % 17 === 16) yield;
    }
    yield;
    // grade to the roads: stamp every nearby road sample's influence
    const D = new Float32Array(m * m).fill(1e9);  // distance past the graded edge
    const Y = new Float32Array(m * m);            // road level to grade to
    const B = new Float32Array(m * m);            // blend width
    this.net.stamp(ax, az, m, res, D, Y, B);
    const R = new Float32Array(m * m);
    for (let k = 0; k < m * m; k++) {
      const d = D[k];
      if (d >= 1e8) continue;
      const w = d <= 0 ? 0 : sstep(0, B[k], d);
      H[k] = Y[k] + (H[k] - Y[k]) * w;
      R[k] = 1 - w;
    }
    // (n, x0, z0 describe the cell's own verts; at(i, j) indexes the apron grid)
    return { res, n, m, x0, z0, H, N, R, cx, cz, at: (i, j) => (j + 1) * m + (i + 1) };
  }

  /** Bilinear height from the res-4 grids (what physics drives on). */
  heightAt(x, z) {
    const cx = Math.floor(x / CELL), cz = Math.floor(z / CELL);
    const g = this.grid(cx, cz, 4);
    const fx = (x - g.x0) / g.res, fz = (z - g.z0) / g.res;
    const i = Math.min(g.n - 2, Math.max(0, Math.floor(fx))), j = Math.min(g.n - 2, Math.max(0, Math.floor(fz)));
    const tx = fx - i, tz = fz - j;
    const m = g.m, H = g.H;
    const k = (j + 1) * m + (i + 1);
    // the same two triangles the mesh draws (split along i+j)
    const a = H[k], b = H[k + 1], c = H[k + m], d = H[k + m + 1];
    if (tx + tz <= 1) return a + (b - a) * tx + (c - a) * tz;
    return d + (c - d) * (1 - tx) + (b - d) * (1 - tz);
  }

  normalAt(x, z, out = [0, 1, 0]) {
    const e = 2;
    const hx = this.heightAt(x + e, z) - this.heightAt(x - e, z);
    const hz = this.heightAt(x, z + e) - this.heightAt(x, z - e);
    const l = Math.hypot(hx, 2 * e, hz);
    out[0] = -hx / l; out[1] = 2 * e / l; out[2] = -hz / l;
    return out;
  }
}
