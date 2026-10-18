// PORT HALCYON — planning helpers for Downtown and Uptown: what the road
// net says about a block (how far each side's road reaches in, and whether
// it is a street, an avenue, a boulevard or a deck overhead), junction
// corners (where signal poles and corner kiosks stand), walking a road's
// sidewalks, and footprint tests that tell a deck overhead from a road on
// the ground. Headless: no THREE meshes, no canvas.
import { F_BRIDGE, F_ELEV } from '../../net.js';
import { roadLamps } from '../../build/roads.js';
import { natural } from '../../terrain.js';

export const reachOf = (rt) => rt.hw + rt.shoulder + rt.walk;

/**
 * Plan on the natural ground: Downtown is flat and Uptown a smooth slope,
 * where the graded ground differs from it by well under a metre (which the
 * foundations, sunk 1.2–1.6 m, absorb) — and asking the planner for the
 * graded ground builds a terrain grid per cell at load (~10 ms each). Only
 * this district's own Planner is changed.
 */
export function naturalGround(P) {
  P.groundY = (x, z) => natural(x, z);
}
export const CLASS = { street: 1, cobble: 1, alley: 0.5, service: 0.5, avenue: 2, boulevard: 3, expressway: 2.5, freeway: 2.5 };

/**
 * The inner edge of a block side along a grid line. axis 'x': a line of
 * constant z (z0) from xa to xb, the block lying toward dir (+1 south, −1
 * north); 'z': constant x. Returns { edge, cls, elev } — edge the inner
 * edge's coordinate (the line itself if no road runs along it), cls the
 * best road class along it, elev whether a deck runs over it.
 */
export function blockSide(P, axis, line, a, b, dir) {
  let edge = line, cls = 0, elev = false, found = false;
  const near = new Map();
  for (const t of [0.25, 0.5, 0.75]) {
    const m = a + (b - a) * t;
    const x = axis === 'x' ? m : line, z = axis === 'x' ? line : m;
    P.net.near(x, z, 16, near);
    for (const [r, i] of near) {
      const along = axis === 'x' ? Math.abs(r.TX[i]) : Math.abs(r.TZ[i]);
      if (along < 0.85) continue;
      const pos = axis === 'x' ? r.Z[i] : r.X[i];
      if (Math.abs(pos - line) > 9) continue;
      const lifted = !!(r.flags[i] & (F_BRIDGE | F_ELEV));
      const reach = reachOf(r.rt) + (lifted ? 0.6 : 0);
      const e = pos + dir * reach;
      if (!found || (dir > 0 ? e > edge : e < edge)) edge = e;
      found = true;
      if (lifted) elev = true;
      else cls = Math.max(cls, CLASS[r.rt.id] ?? 1);
    }
  }
  return { edge, cls, elev, road: found };
}

/**
 * The road corridors on the ground (decks overhead and tunnels left out)
 * over the district's box at 2 m, rasterized once per plan (made on first
 * use, kept with the planner).
 */
const MASKS = new WeakMap(), BOXES = new WeakMap();
function roadBox(r) {
  let b = BOXES.get(r);
  if (!b) {
    b = { x0: Infinity, z0: Infinity, x1: -Infinity, z1: -Infinity };
    for (let i = 0; i < r.N; i++) {
      if (r.X[i] < b.x0) b.x0 = r.X[i];
      if (r.X[i] > b.x1) b.x1 = r.X[i];
      if (r.Z[i] < b.z0) b.z0 = r.Z[i];
      if (r.Z[i] > b.z1) b.z1 = r.Z[i];
    }
    BOXES.set(r, b);
  }
  return b;
}
export function groundMask(P) {
  let m = MASKS.get(P);
  if (m) return m;
  const b = P.d.box, R = 2, pad = 12;
  const x0 = b.x0 - pad, z0 = b.z0 - pad;
  const nx = Math.ceil((b.x1 - b.x0 + 2 * pad) / R), nz = Math.ceil((b.z1 - b.z0 + 2 * pad) / R);
  const a = new Uint8Array(nx * nz);
  const X1 = x0 + nx * R, Z1 = z0 + nz * R;
  for (const r of P.net.roads) {
    const reach = reachOf(r.rt) + 0.5;
    const rb = roadBox(r);
    if (rb.x1 < x0 - reach || rb.x0 > X1 + reach || rb.z1 < z0 - reach || rb.z0 > Z1 + reach) continue;
    for (let i = 0; i < r.N; i++) {
      const x = r.X[i], z = r.Z[i];
      if (x < x0 - reach || x > X1 + reach || z < z0 - reach || z > Z1 + reach) continue;
      if (r.flags[i] & (F_BRIDGE | F_ELEV | 2)) continue;
      const lx = r.LX[i], lz = r.LZ[i], tx = r.TX[i], tz = r.TZ[i];
      for (let lat = -reach; lat <= reach; lat += 1.5) {
        for (let lon = -r.step * 0.6; lon <= r.step * 0.6; lon += 1.4) {
          const ci = Math.floor((x + lx * lat + tx * lon - x0) / R), cj = Math.floor((z + lz * lat + tz * lon - z0) / R);
          if (ci >= 0 && cj >= 0 && ci < nx && cj < nz) a[cj * nx + ci] = 1;
        }
      }
    }
  }
  m = { x0, z0, nx, nz, a, R };
  MASKS.set(P, m);
  return m;
}

/** Is a footprint clear of every road on the ground (decks overhead don't count)? */
export function groundClear(P, x, z, w, d, ry, pad = 0.5) {
  const m = groundMask(P);
  const c = Math.cos(ry), s = Math.sin(ry);
  const W = w + 2 * pad, D = d + 2 * pad;
  const nx = Math.max(1, Math.ceil(W / 1.6)), nz = Math.max(1, Math.ceil(D / 1.6));
  for (let a = 0; a <= nx; a++) {
    for (let b = 0; b <= nz; b++) {
      const lx = -W / 2 + (W * a) / nx, lz = -D / 2 + (D * b) / nz;
      const ci = Math.floor((x + lx * c + lz * s - m.x0) / m.R), cj = Math.floor((z - lx * s + lz * c - m.z0) / m.R);
      if (ci < 0 || cj < 0 || ci >= m.nx || cj >= m.nz) continue;
      if (m.a[cj * m.nx + ci]) return false;
    }
  }
  return true;
}

/**
 * Lots along roads, both sides (like P.lots, but a blocked spot skips on by
 * `skip` m instead of retrying every 2 m, and a small probe at the lot's
 * middle rules most blocked spots out cheaply). o: { width() → m, depths
 * [m, …] (tried in order), setback, gap() → m, ends, pad, skip, chance }.
 */
export function frontLots(P, roads, o) {
  const out = [];
  for (const r of roads) {
    const rt = r.rt;
    const reach = rt.hw + rt.shoulder + rt.walk + 0.4;
    for (const sd of [1, -1]) {
      let s = (r.closed ? 0 : r.trim0) + (o.ends ?? 0);
      const s1 = r.closed ? r.length : r.length - r.trim1 - (o.ends ?? 0);
      let guard = 0;
      while (s < s1 && guard++ < 4000) {
        const w = o.width();
        if (s + w > s1) break;
        const i = r.posAt(s + w / 2).i;
        const lx = r.LX[i] * sd, lz = r.LZ[i] * sd;
        const ry = Math.atan2(-lx, -lz);
        const sb = typeof o.setback === 'function' ? o.setback() : o.setback;
        const mid = reach + sb + o.depths[o.depths.length - 1] / 2;
        let placed = null;
        if (P.inside(r.X[i] + lx * mid, r.Z[i] + lz * mid) && P.isFree(r.X[i] + lx * mid, r.Z[i] + lz * mid, Math.min(4, w), 4, ry, { pad: 0 })) {
          for (const d of o.depths) {
            const off = reach + sb + d / 2;
            const x = r.X[i] + lx * off, z = r.Z[i] + lz * off;
            if (!P.inside(x, z)) break;
            if (P.isFree(x, z, w, d, ry, { pad: o.pad ?? -0.6, front: sb < 1.5 ? 1.6 - sb : 0 })) { placed = { x, z, ry, w, d, road: r, side: sd, s: s + w / 2, setback: sb }; break; }
          }
        }
        if (placed) {
          if (o.chance === undefined || P.rng() < o.chance) { P.claim(placed.x, placed.z, placed.w, placed.d, placed.ry); out.push(placed); }
          s += w + (o.gap ? o.gap() : 0);
        } else s += o.skip ?? 4;
      }
    }
  }
  return out;
}

/** A spatial hash of round things already placed (spacing checks without an O(n²) scan). */
export class Spots {
  constructor(cell = 8) { this.cell = cell; this.map = new Map(); }
  key(i, j) { return i * 100003 + j; }
  free(x, z, r) {
    const c = this.cell;
    for (let i = Math.floor((x - r - 4) / c); i <= Math.floor((x + r + 4) / c); i++) {
      for (let j = Math.floor((z - r - 4) / c); j <= Math.floor((z + r + 4) / c); j++) {
        const a = this.map.get(this.key(i, j));
        if (!a) continue;
        for (const u of a) if (Math.abs(u[0] - x) < r + u[2] && Math.abs(u[1] - z) < r + u[2]) return false;
      }
    }
    return true;
  }
  add(x, z, r) {
    const k = this.key(Math.floor(x / this.cell), Math.floor(z / this.cell));
    let a = this.map.get(k);
    if (!a) { a = []; this.map.set(k, a); }
    a.push([x, z, r]);
  }
}

/** Junction nodes in the district whose every road is a city street (sidewalks). */
export function cityJunctions(P) {
  const out = [];
  for (const n of P.net.nodes.values()) {
    if (n.kind !== 'junction' || n.ends.length < 3) continue;
    if (!P.inside(n.x, n.z)) continue;
    if (!n.ends.every((e) => e.road.rt.walk > 0)) continue;
    out.push(n);
  }
  return out;
}

/**
 * Where a signal pole for traffic coming in along end e stands: on the
 * corner to that driver's right, just behind the junction's mouth. Returns
 * { x, z, y, ax, az (arm direction, over the road), len (arm), ry (the way
 * the signals face: out along the road toward the traffic) }.
 */
export function signalSpot(n, e) {
  const rt = e.road.rt;
  const rx = e.dz, rz = -e.dx;                 // the incoming driver's right
  const s = e.trim + 1.4, lat = rt.hw + rt.shoulder + 0.85;
  return {
    x: n.x + e.dx * s + rx * lat, z: n.z + e.dz * s + rz * lat, y: n.y + rt.curb,
    ax: -rx, az: -rz, len: Math.min(rt.hw * 0.8, 9), ry: Math.atan2(e.dx, e.dz),
  };
}

/**
 * Walk a road's sidewalks: fn(pos) every `step` m (from the junction mouths
 * in by `ends`), both sides; pos { x, z, y (sidewalk top), s, side, ry (the
 * way the kerb faces: toward the road), road, i, kerb (lat of the kerb),
 * back (lat of the property line) }. skipLamps: metres to keep from the
 * road's own lamp posts.
 */
export function walkSidewalks(r, step, fn, o = {}) {
  const rt = r.rt;
  if (rt.walk <= 0) return;
  const ends = o.ends ?? 6;
  const s0 = (r.closed ? 0 : r.trim0) + ends, s1 = (r.closed ? r.length : r.length - r.trim1) - ends;
  const lamps = o.skipLamps ? roadLamps(r) : null;
  for (const side of o.sides || [1, -1]) {
    for (let s = s0 + (o.offset ?? step / 2); s < s1; s += step) {
      const lat = side * (rt.hw + rt.shoulder + (o.lat ?? rt.walk * 0.5));
      const p = r.posAt(s, lat);
      if (lamps && lamps.some((L) => Math.abs(L.x - p.x) < o.skipLamps && Math.abs(L.z - p.z) < o.skipLamps)) continue;
      const i = p.i;
      fn({
        x: p.x, z: p.z, y: r.roadY(i, p.t, Math.max(-rt.hw, Math.min(rt.hw, lat))) + rt.curb, s, side, road: r, i,
        ry: Math.atan2(-side * r.LX[i], -side * r.LZ[i]), kerb: side * (rt.hw + rt.shoulder), back: side * (rt.hw + rt.shoulder + rt.walk),
        tx: r.TX[i], tz: r.TZ[i], lx: r.LX[i] * side, lz: r.LZ[i] * side,
      });
    }
  }
}

/** Distance from (x, z) to the nearest road lamp post of road r (Infinity if none). */
export function lampClear(r, x, z, d) {
  for (const L of roadLamps(r)) if (Math.abs(L.x - x) < d && Math.abs(L.z - z) < d) return false;
  return true;
}
