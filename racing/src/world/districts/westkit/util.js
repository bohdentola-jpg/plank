// PORT HALCYON — the west's shared kit: small helpers the west's district
// packs (Halcyon Lake, Ironwood Park, the Redwoods, Crestwood Hills, West
// Farms) all lean on. Headless-safe (plan and scatter use these): no THREE,
// no canvas.
import { districtAt } from '../../ground.js';
import { segDist } from '../../geom.js';
import { ROAD, MARGIN, ITEM, RESERVED } from '../occ.js';

export { ROAD, MARGIN, ITEM, RESERVED };

/** Does this district own (x, z)? (Districts overlap: the first in the list wins.) */
export const owns = (id, x, z) => districtAt(x, z)?.id === id;

/** A footprint's corners (and centre) all owned by the district. */
export function ownsRect(id, x, z, w, d, ry = 0) {
  const c = Math.cos(ry), s = Math.sin(ry);
  for (const [a, b] of [[0, 0], [-1, -1], [1, -1], [1, 1], [-1, 1]]) {
    const lx = a * w / 2, lz = b * d / 2;
    if (!owns(id, x + lx * c + lz * s, z - lx * s + lz * c)) return false;
  }
  return true;
}

/** Local (lx, lz) of a footprint turned ry → world [x, z]. */
export const toWorld = (x, z, ry, lx, lz) => {
  const c = Math.cos(ry), s = Math.sin(ry);
  return [x + lx * c + lz * s, z - lx * s + lz * c];
};

/** World (wx, wz) → local [lx, lz] of a frame at (x, z) turned ry. */
export const toLocal = (x, z, ry, wx, wz) => {
  const c = Math.cos(ry), s = Math.sin(ry), dx = wx - x, dz = wz - z;
  return [dx * c - dz * s, dx * s + dz * c];
};

/** Heading (ry) whose local +z points along (dx, dz). */
export const facing = (dx, dz) => Math.atan2(dx, dz);

/** Hex colour → linear [r, g, b] (vertex colours are linear). */
const LIN = new Map();
export function lin(hex) {
  let c = LIN.get(hex);
  if (c) return c;
  const n = typeof hex === 'number' ? hex : parseInt(hex.replace('#', ''), 16);
  const f = (v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
  c = [f((n >> 16) & 255), f((n >> 8) & 255), f(n & 255)];
  LIN.set(hex, c);
  return c;
}

/** Mix two linear colours. */
export const mixc = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
export const scalec = (a, k) => [a[0] * k, a[1] * k, a[2] * k];

/** Distance from (x, z) to a polyline [[x, z], …]: { d, i, t, px, pz }. */
export function nearOnLine(pts, x, z) {
  let best = { d: Infinity, i: 0, t: 0, px: pts[0][0], pz: pts[0][1] };
  for (let i = 0; i < pts.length - 1; i++) {
    const r = segDist(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], x, z);
    if (r.d < best.d) best = { d: r.d, i, t: r.t, px: r.px, pz: r.pz };
  }
  return best;
}

/** Walk a polyline every `step` m: [[x, z, s, tx, tz], …] (ends included). */
export function walk(pts, step) {
  const out = [];
  let s = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, az] = pts[i], [bx, bz] = pts[i + 1];
    const len = Math.hypot(bx - ax, bz - az);
    if (len < 1e-6) continue;
    const tx = (bx - ax) / len, tz = (bz - az) / len;
    const n = Math.max(1, Math.ceil(len / step));
    for (let k = out.length ? 1 : 0; k <= n; k++) {
      const t = k / n;
      out.push([ax + (bx - ax) * t, az + (bz - az) * t, s + len * t, tx, tz]);
    }
    s += len;
  }
  return out;
}

/** Polyline length. */
export function lineLen(pts) {
  let s = 0;
  for (let i = 0; i < pts.length - 1; i++) s += Math.hypot(pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1]);
  return s;
}

/** Point at distance s along a polyline: [x, z, tx, tz]. */
export function pointAt(pts, s) {
  let acc = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, az] = pts[i], [bx, bz] = pts[i + 1];
    const len = Math.hypot(bx - ax, bz - az);
    if (acc + len >= s || i === pts.length - 2) {
      const t = len > 0 ? Math.max(0, Math.min(1, (s - acc) / len)) : 0;
      return [ax + (bx - ax) * t, az + (bz - az) * t, (bx - ax) / (len || 1), (bz - az) / (len || 1)];
    }
    acc += len;
  }
  return [pts[0][0], pts[0][1], 1, 0];
}

/** Offset a polyline sideways by d (+ to its left: (tz, −tx)). */
export function offsetLine(pts, d) {
  const out = [];
  for (let i = 0; i < pts.length; i++) {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
    let tx = b[0] - a[0], tz = b[1] - a[1];
    const l = Math.hypot(tx, tz) || 1;
    tx /= l; tz /= l;
    out.push([pts[i][0] + tz * d, pts[i][1] - tx * d]);
  }
  return out;
}

/** A ring polygon (n points) round (x, z), radius r (± wobble from rnd()). */
export function ringPoly(x, z, r, n = 12, rnd = null, wob = 0.15) {
  const out = [];
  for (let k = 0; k < n; k++) {
    const a = (k / n) * Math.PI * 2;
    const rr = r * (1 + (rnd ? (rnd() - 0.5) * 2 * wob : 0));
    out.push([x + Math.cos(a) * rr, z + Math.sin(a) * rr]);
  }
  return out;
}

/** A rectangle's corners (world) — w along local x, d along local z, turned ry. */
export function rectPoly(x, z, w, d, ry = 0) {
  return [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([a, b]) => toWorld(x, z, ry, a * w / 2, b * d / 2));
}

/** Is the whole segment a→b clear of road corridors (and margins), sampled every 2 m? */
export function clearLine(occ, a, b, w = 2, mask = ROAD | MARGIN) {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const n = Math.max(1, Math.ceil(len / 2));
  for (let k = 0; k <= n; k++) {
    const t = k / n;
    if (occ.hitDisc(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, w / 2, mask)) return false;
  }
  return true;
}

/** Road samples of road r between s0 and s1 every step: [{ x, z, y, i, tx, tz, lx, lz, s }]. */
export function roadRun(r, s0, s1, step = 4) {
  const out = [];
  for (let s = s0; s <= s1 + 1e-6; s += step) {
    const p = r.posAt(s);
    const i = p.i;
    out.push({ x: p.x, z: p.z, y: p.y, i, tx: r.TX[i], tz: r.TZ[i], lx: r.LX[i], lz: r.LZ[i], s });
  }
  return out;
}

/** Edge of a road's corridor (carriageway + shoulder + walk) from the centre. */
export const reachOf = (r) => r.rt.hw + r.rt.shoulder + r.rt.walk;

/** Deterministic 0..1 hash of two numbers (and a salt). */
export function hash2(x, z, salt = 0) {
  let h = Math.imul((Math.floor(x) * 73856093) ^ (Math.floor(z) * 19349663) ^ (salt * 83492791), 0x9e3779b1);
  h ^= h >>> 15; h = Math.imul(h, 0x85ebca6b); h ^= h >>> 13;
  return ((h >>> 0) % 100000) / 100000;
}

/** Pick by weights: [[w, value], …] with u in 0..1. */
export function weighted(list, u) {
  let tot = 0;
  for (const [w] of list) tot += w;
  let a = u * tot;
  for (const [w, v] of list) { if ((a -= w) <= 0) return v; }
  return list[list.length - 1][1];
}
