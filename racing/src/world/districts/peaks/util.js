// PORT HALCYON — the mountains' shared helpers (Kaido Pass, The Summit,
// Ridgeline, The North Woods): colours for vertex-coloured meshes, a cell's
// distance-to-the-roads field (for thinning forests near the roads and
// putting trees' colliders only where cars can reach them), walking a cell's
// road samples (for roadside dressing), and a local frame for placing parts.
import * as THREE from 'three';
import { CELL, natural } from '../../terrain.js';
import { sstep } from '../../geom.js';
import { lampsInBox } from '../../build/roads.js';

const GRID = 4;   // the terrain's near grid (m)

const _c = new THREE.Color();
/** sRGB hex → linear [r, g, b] (vertex colours are linear). */
export function lin(hex) {
  _c.set(hex);
  return [_c.r, _c.g, _c.b];
}
/** Mix two linear colours. */
export const mixc = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
/** Scale a linear colour. */
export const mulc = (a, k) => [a[0] * k, a[1] * k, a[2] * k];

/** Set an accumulator's current vertex colour (copy, so callers can reuse arrays). */
export function tint(acc, c) {
  acc.col = [c[0], c[1], c[2]];
  return acc;
}

/**
 * A local frame at (x, y, z) turned ry: P(lx, ly, lz) → world [x, y, z]
 * (local x → (cos ry, −sin ry), local z → (sin ry, cos ry), the builder's
 * box convention).
 */
export function frame(x, y, z, ry) {
  const c = Math.cos(ry), s = Math.sin(ry);
  const P = (lx, ly, lz) => [x + lx * c + lz * s, y + ly, z - lx * s + lz * c];
  P.xz = (lx, lz) => [x + lx * c + lz * s, z - lx * s + lz * c];
  P.c = c; P.s = s; P.ry = ry; P.x = x; P.y = y; P.z = z;
  return P;
}

const IDX = 32;
const KEY = (cx, cz) => cx * 65536 + cz;

/**
 * Road samples near a box: calls fn(road, i) for each sample of each road
 * whose centre lies within the box grown by pad.
 */
export function eachSample(net, x0, z0, x1, z1, pad, fn) {
  const c0 = Math.floor((x0 - pad) / IDX), c1 = Math.floor((x1 + pad) / IDX);
  const d0 = Math.floor((z0 - pad) / IDX), d1 = Math.floor((z1 + pad) / IDX);
  for (let cx = c0; cx <= c1; cx++) {
    for (let cz = d0; cz <= d1; cz++) {
      const a = net.grid.get(KEY(cx + 32768, cz + 32768));
      if (!a) continue;
      for (let k = 0; k < a.length; k += 2) fn(net.roads[a[k]], a[k + 1]);
    }
  }
}

/**
 * Distance from the nearest road's edge (its whole corridor: carriageway,
 * shoulders, sidewalks) over a cell, on an 8 m grid with a margin, by a
 * chamfer transform. field.at(x, z) → metres (0 on a road; capped at 120).
 * Tunnels don't count.
 */
const FIELDS = new Map();
export function roadField(net, cx, cz, res = 8, pad = 96) {
  // (several of the mountain packs may share a cell: work it out once)
  const key = `${cx},${cz},${res}`;
  const hit = FIELDS.get(key);
  if (hit && hit.net === net) return hit.field;
  const field = makeField(net, cx, cz, res, pad);
  FIELDS.set(key, { net, field });
  if (FIELDS.size > 24) FIELDS.delete(FIELDS.keys().next().value);
  return field;
}

function makeField(net, cx, cz, res, pad) {
  const x0 = cx * CELL - pad, z0 = cz * CELL - pad;
  const n = Math.ceil((CELL + 2 * pad) / res) + 1;
  const D = new Float32Array(n * n).fill(1e4);
  eachSample(net, x0, z0, x0 + n * res, z0 + n * res, 8, (r, i) => {
    if (r.flags[i] & 2) return;
    const rt = r.rt;
    const reach = rt.hw + rt.shoulder + rt.walk;
    const fx = (r.X[i] - x0) / res, fz = (r.Z[i] - z0) / res;
    const rr = reach / res;
    const i0 = Math.max(0, Math.floor(fx - rr)), i1 = Math.min(n - 1, Math.ceil(fx + rr));
    const j0 = Math.max(0, Math.floor(fz - rr)), j1 = Math.min(n - 1, Math.ceil(fz + rr));
    for (let j = j0; j <= j1; j++) {
      for (let k = i0; k <= i1; k++) {
        const d = Math.hypot(k - fx, j - fz) - rr;
        const q = j * n + k;
        if (d < D[q]) D[q] = Math.max(0, d);
      }
    }
  });
  // chamfer (3-4) both ways
  const a = 1, b = Math.SQRT2;
  for (let j = 0; j < n; j++) {
    for (let k = 0; k < n; k++) {
      const q = j * n + k;
      let v = D[q];
      if (k > 0) v = Math.min(v, D[q - 1] + a);
      if (j > 0) {
        v = Math.min(v, D[q - n] + a);
        if (k > 0) v = Math.min(v, D[q - n - 1] + b);
        if (k < n - 1) v = Math.min(v, D[q - n + 1] + b);
      }
      D[q] = v;
    }
  }
  for (let j = n - 1; j >= 0; j--) {
    for (let k = n - 1; k >= 0; k--) {
      const q = j * n + k;
      let v = D[q];
      if (k < n - 1) v = Math.min(v, D[q + 1] + a);
      if (j < n - 1) {
        v = Math.min(v, D[q + n] + a);
        if (k < n - 1) v = Math.min(v, D[q + n + 1] + b);
        if (k > 0) v = Math.min(v, D[q + n - 1] + b);
      }
      D[q] = v;
    }
  }
  return {
    at(x, z) {
      const k = Math.round((x - x0) / res), j = Math.round((z - z0) / res);
      if (k < 0 || j < 0 || k >= n || j >= n) return 120;
      return Math.min(120, D[j * n + k] * res);
    },
  };
}

/**
 * The runs of road samples a cell owns (sample centres inside the cell) for
 * roads passing a filter: [{ road, i0, i1 }] (i1 inclusive), sorted. (A
 * cell's runs are worked out once: several dressings walk them.)
 */
const RUNS = new Map();
export function cellRuns(net, cx, cz, filter = null) {
  const key = `${cx},${cz}`;
  let hit = RUNS.get(key);
  if (!hit || hit.net !== net) {
    hit = { net, runs: makeRuns(net, cx, cz) };
    RUNS.set(key, hit);
    if (RUNS.size > 24) RUNS.delete(RUNS.keys().next().value);
  }
  return filter ? hit.runs.filter((run) => filter(run.road)) : hit.runs;
}

function makeRuns(net, cx, cz) {
  const x0 = cx * CELL, z0 = cz * CELL;
  const byRoad = new Map();
  eachSample(net, x0, z0, x0 + CELL, z0 + CELL, 0, (r, i) => {
    if (r.X[i] < x0 || r.X[i] >= x0 + CELL || r.Z[i] < z0 || r.Z[i] >= z0 + CELL) return;
    let a = byRoad.get(r);
    if (!a) { a = []; byRoad.set(r, a); }
    a.push(i);
  });
  const out = [];
  for (const [r, a] of byRoad) {
    a.sort((p, q) => p - q);
    let s = a[0], prev = a[0];
    for (let k = 1; k <= a.length; k++) {
      if (k === a.length || a[k] !== prev + 1) { out.push({ road: r, i0: s, i1: prev }); if (k < a.length) s = a[k]; }
      if (k < a.length) prev = a[k];
    }
  }
  out.sort((p, q) => p.road.ri - q.road.ri || p.i0 - q.i0);
  return out;
}

/**
 * Jittered points over the cell (like S.points: one a `spacing` square,
 * jittered), cheapest tests first: o.pre(x, z) (say, the distance from the
 * roads), o.density(x, z), inside the district, then clear of roads and
 * footprints within o.r. (The mountains have no sea, lake or river in them,
 * so no water test.) → [[x, z], …]
 */
export function cellPoints(S, spacing, o = {}) {
  const out = [];
  const j = o.jitter ?? 0.9, r = o.r ?? 1, pad = o.roadPad ?? true;
  for (let z = S.z0 + spacing / 2; z < S.z1; z += spacing) {
    for (let x = S.x0 + spacing / 2; x < S.x1; x += spacing) {
      const px = x + (S.rng() - 0.5) * spacing * j, pz = z + (S.rng() - 0.5) * spacing * j;
      const keep = S.rng();
      if (o.pre && !o.pre(px, pz)) continue;
      if (o.density && keep > o.density(px, pz)) continue;
      if (!S.inside(px, pz)) continue;
      if (!S.free(px, pz, r, pad)) continue;
      out.push([px, pz]);
    }
  }
  return out;
}

/** A point beside a road sample: lat metres to its left (+) or right (−). */
export function beside(r, i, lat) {
  return [r.X[i] + r.LX[i] * lat, r.Z[i] + r.LZ[i] * lat];
}

/** Road curvature (signed, 1/m) smoothed over ±k samples. */
export function curvature(r, i, k = 6) {
  let s = 0, c = 0;
  for (let j = Math.max(0, i - k); j <= Math.min(r.N - 1, i + k); j++) { s += r.Ks ? r.Ks[j] : r.K[j]; c++; }
  return s / c;
}

/** Is a road one of the open-country kinds the mountains dress (not city streets)? */
export const isCountryRoad = (r) => r.rt.id === 'mountain' || r.rt.id === 'gravel' || r.rt.id === 'dirt' || r.rt.id === 'highway' || r.rt.id === 'service';

/**
 * Is (x, z) within reach of any lamp that lights this cell (the roads' and
 * the districts')? Trees out of every lamp's reach go in an unlit material,
 * so the cell's light bake skips their (many) vertices.
 */
export function lampTest(S, pad = 45) {
  const x0 = S.x0 - pad, z0 = S.z0 - pad, x1 = S.x1 + pad, z1 = S.z1 + pad;
  const lamps = [...lampsInBox(S.net, x0, z0, x1, z1), ...S.D.lampsInBox(x0, z0, x1, z1)];
  if (!lamps.length) return () => false;
  return (x, z, extra = 4) => {
    for (const L of lamps) {
      const r = L.radius + extra;
      if ((L.hx - x) * (L.hx - x) + (L.hz - z) * (L.hz - z) < r * r) return true;
    }
    return false;
  };
}

/**
 * How level the ground is at (x, z): the y of its normal, from a ground
 * function h(x, z) (a pack's groundY).
 */
export function levelness(h, x, z, e = 2) {
  const hx = h(x + e, z) - h(x - e, z);
  const hz = h(x, z + e) - h(x, z - e);
  return (2 * e) / Math.hypot(hx, 2 * e, hz);
}

/**
 * The built ground at (x, z), exactly as Terrain.heightAt gives it (the
 * same 4 m vertices, the same two triangles a square), but without building
 * a neighbour cell's whole grid just to ask about a point past the cell's
 * edge (a tree near it, a slope draped over a cutting, a fence running on):
 * where that grid isn't built yet it works out the few vertices it needs
 * itself, the natural ground graded to the roads just as the grid does.
 */
const _D = new Float32Array(1), _Y = new Float32Array(1), _W = new Float32Array(1);
export function groundFn(T, net) {
  const V = new Map();
  const vert = (i, j) => {
    const key = (i + 60000) * 131072 + (j + 60000);
    let h = V.get(key);
    if (h !== undefined) return h;
    const X = i * GRID, Z = j * GRID;
    h = Math.fround(natural(X, Z));
    _D[0] = 1e9; _Y[0] = 0; _W[0] = 0;
    net.stamp(X, Z, 1, GRID, _D, _Y, _W);
    const d = _D[0];
    if (d < 1e8) {
      const w = d <= 0 ? 0 : sstep(0, _W[0], d);
      h = Math.fround(_Y[0] + (h - _Y[0]) * w);
    }
    V.set(key, h);
    return h;
  };
  // the cells' built grids (or false: none yet, work the vertices out),
  // looked up once a cell (no key strings per call: this runs a lot)
  const G = new Map();
  let lk = NaN, lg = false;
  const n = CELL / GRID;
  return (x, z) => {
    const cx = Math.floor(x / CELL), cz = Math.floor(z / CELL);
    const k = (cx + 32768) * 65536 + (cz + 32768);
    if (k !== lk) {
      lg = G.get(k);
      if (lg === undefined) { lg = T.cache.get(`4:${cx}:${cz}`) || false; G.set(k, lg); }
      lk = k;
    }
    // (as heightAt: the cell's own vertices, clamped to its last square;
    // the same two triangles a square, split along i+j)
    const x0 = cx * CELL, z0 = cz * CELL;
    const fx = (x - x0) / GRID, fz = (z - z0) / GRID;
    const i = Math.min(n - 1, Math.max(0, Math.floor(fx))), j = Math.min(n - 1, Math.max(0, Math.floor(fz)));
    const tx = fx - i, tz = fz - j;
    if (lg) {
      const m = lg.m, H = lg.H, q = (j + 1) * m + (i + 1);
      const a = H[q], b = H[q + 1], c = H[q + m], d = H[q + m + 1];
      if (tx + tz <= 1) return a + (b - a) * tx + (c - a) * tz;
      return d + (c - d) * (1 - tx) + (b - d) * (1 - tz);
    }
    const I = cx * n + i, J = cz * n + j;
    if (tx + tz <= 1) {
      const a = vert(I, J);
      return a + (vert(I + 1, J) - a) * tx + (vert(I, J + 1) - a) * tz;
    }
    const d = vert(I + 1, J + 1);
    return d + (vert(I, J + 1) - d) * (1 - tx) + (vert(I + 1, J) - d) * (1 - tz);
  };
}

/**
 * Give a pack's Scatter or Builder the grid-free ground (its groundY), so
 * nothing it places past the cell's edge builds the neighbour's grid.
 */
export function useGround(ctx) {
  ctx.groundY = groundFn(ctx.terrain, ctx.net);
  return ctx;
}

/** Deterministic hash of a few numbers to [0, 1). */
export function hash01(a, b = 0, c = 0) {
  let h = Math.imul((a * 73856093) ^ (b * 19349663) ^ (c * 83492791), 0x9e3779b1);
  h ^= h >>> 15; h = Math.imul(h, 0x85ebca6b); h ^= h >>> 13;
  return ((h >>> 0) % 1000003) / 1000003;
}
