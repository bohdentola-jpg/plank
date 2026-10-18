// PORT HALCYON — desert kit scatter: the plants, rocks and cliff ledges every
// desert pack strews (each its own mix), and how they're built. Items are
// plain data ({ type: 'plant'|'rock'|'ledge', … }) so plan() and scatter()
// stay headless; buildScatter(B, it) draws one (false if it isn't one).
import { box } from '../builder.js';
import { MAT, paint, hash1 } from './kit.js';
import { saguaro, joshua, yucca, ocotillo, barrel, pricklyPear, juniper, deadTree, shrub } from './flora.js';
import { boulder, boulderPile } from './rocks.js';

/**
 * The cell's own ground, read straight off its terrain grid (exactly what
 * Terrain.heightAt gives inside the cell, without the lookups, and never
 * reaching into a neighbour's grid): h(x, z), and the slope there as
 * { g (rise over run), dx, dz (downhill) } from the grid's central differences.
 */
export function cellGround(S) {
  if (S._dkg) return S._dkg;
  const gr = S.terrain.grid(S.cx, S.cz, 4);
  const { res, n, m, H, x0, z0 } = gr;
  const h = (x, z) => {
    const fx = (x - x0) / res, fz = (z - z0) / res;
    const i = Math.min(n - 2, Math.max(0, Math.floor(fx))), j = Math.min(n - 2, Math.max(0, Math.floor(fz)));
    const tx = fx - i, tz = fz - j;
    const k = (j + 1) * m + (i + 1);
    const a = H[k], b = H[k + 1], c = H[k + m], d = H[k + m + 1];
    if (tx + tz <= 1) return a + (b - a) * tx + (c - a) * tz;
    return d + (c - d) * (1 - tx) + (b - d) * (1 - tz);
  };
  const out = { g: 0, dx: 0, dz: 0 };
  const slope = (x, z) => {
    const i = Math.min(n - 1, Math.max(0, Math.round((x - x0) / res))), j = Math.min(n - 1, Math.max(0, Math.round((z - z0) / res)));
    const k = (j + 1) * m + (i + 1);
    const hx = (H[k + 1] - H[k - 1]) / (2 * res), hz = (H[k + m] - H[k - m]) / (2 * res);
    out.g = Math.hypot(hx, hz); out.dx = -hx; out.dz = -hz;
    return out;
  };
  S._dkg = { h, slope };
  return S._dkg;
}

/** The lowest ground within r of (x, z) (centre and four points round it): where a big thing must sit. */
export function lowest(G, x, z, r) {
  return Math.min(G.h(x, z), G.h(x + r, z), G.h(x - r, z), G.h(x, z + r), G.h(x, z - r));
}

/** Slope (rise over run) of the built ground at (x, z) (inside the cell). */
export function steepAt(S, x, z) { return cellGround(S).slope(x, z).g; }

/** A seed for an item from the scatter's own rng. */
export const seedOf = (S) => Math.floor(S.rng() * 1e6);

/**
 * Rock ledges along steep ground (mesa cliffs, canyon walls): chunky strata
 * blocks set into the slope, facing down it, their bands lined up with the
 * world's height. tones: hex colours to pick from.
 */
export function cliffLedges(S, tones, every = 9, minSlope = 0.7, size = 1) {
  const G = cellGround(S);
  for (const [x, z] of S.points(every, { r: 2, roadPad: true, jitter: 0.6 })) {
    const sl = G.slope(x, z);
    if (sl.g < minSlope) continue;
    const y = G.h(x, z);
    S.add({ type: 'ledge', x, z, y, ry: Math.atan2(sl.dx, sl.dz), w: S.range(7, 12) * size, h: S.range(4, 9) * size, d: S.range(4, 7) * size, tone: tones[Math.floor(S.rng() * tones.length)], k: S.range(0.85, 1.1) });
  }
}

const SHRUB_W = [2.2, 1.4, 1.1, 1.6], SHRUB_H = [1.8, 0.8, 0.8, 1.3];

/** Build a scatter item; false if it isn't one of the shared kinds. */
export function buildScatter(B, it) {
  const { x, y, z, s } = it;
  if (it.type === 'plant') {
    switch (it.kind) {
      case 'joshua': joshua(B.acc(MAT.plant(B)), x, y, z, s, it.seed); break;
      case 'saguaro': saguaro(B.acc(MAT.plant(B)), x, y, z, s, it.seed); break;
      case 'juniper': juniper(B.acc(MAT.plant(B)), x, y, z, s, it.seed); break;
      case 'dead': deadTree(B.acc(MAT.plant(B)), x, y, z, s, it.seed); break;
      case 'yucca': yucca(B.near(MAT.plant(B)), x, y, z, s, it.seed); break;
      case 'ocotillo': ocotillo(B.near(MAT.plant(B)), x, y, z, s, it.seed); break;
      case 'barrel': barrel(B.near(MAT.plant(B)), x, y, z, s); break;
      case 'pear': pricklyPear(B.near(MAT.plant(B)), x, y, z, s, it.seed); break;
      case 'shrub': shrub(B.near(MAT.foliage(B)), x, y, z, SHRUB_W[it.cell] * s, SHRUB_H[it.cell] * s, it.cell, it.ry, it.tint || (it.cell === 3 ? '#e8ece0' : '#fffaf0')); break;
      default: return false;
    }
    return true;
  }
  if (it.type === 'rock') {
    if (it.kind === 'pile') boulderPile(B.acc(MAT.rock(B)), x, y - 0.3, z, s, it.seed);
    else boulder(s > 1.1 ? B.acc(MAT.rock(B)) : B.near(MAT.rock(B)), x, y - s * 0.35, z, s, it.seed, it.color);
    return true;
  }
  if (it.type === 'ledge') {
    // sunk into the slope: its back buried, its foot below the ground
    const fx = Math.sin(it.ry), fz = Math.cos(it.ry);
    const px = x - fx * it.d * 0.3, pz = z - fz * it.d * 0.3, y0 = y - it.h * 0.6;
    const acc = B.acc(MAT.strata(B));
    paint(acc, it.tone, it.k);
    box(acc, px, y0, pz, it.w, it.h, it.d, it.ry, { u: 16, v: 16, v0: y0 / 16, topU: 16 });
    return true;
  }
  return false;
}

/** Shrubs (cut-out quads) over a cell. cells: [[cell, weight], …]. */
export function shrubs(S, spacing, density, cells, o = {}) {
  const total = cells.reduce((a, c) => a + c[1], 0);
  const G = cellGround(S);
  for (const [x, z] of S.points(spacing, { r: 1, roadPad: false, density })) {
    const y = G.h(x, z);
    if (o.maxY !== undefined && y > o.maxY) continue;
    if (o.maxSlope !== undefined && G.slope(x, z).g > o.maxSlope) continue;
    let r = S.rng() * total, cell = cells[0][0];
    for (const [c, w] of cells) { if (r < w) { cell = c; break; } r -= w; }
    S.add({ type: 'plant', kind: 'shrub', cell, x, z, y, s: S.range(o.s?.[0] ?? 0.7, o.s?.[1] ?? 1.35), ry: S.rng() * Math.PI, tint: o.tint });
  }
}

export { hash1 };
