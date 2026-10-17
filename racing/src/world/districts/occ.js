// PORT HALCYON — who has which bit of ground, at 2 m: the road corridors
// (carriageway, shoulders, sidewalks and junction paving), a margin round
// them, and every footprint a district has planned so far. Sparse: 128 m
// tiles allocated on first touch. Districts plan against this so a building
// never stands in a road, on a sidewalk, or inside another building.
import { F_TUNNEL } from '../net.js';

export const RES = 2;                 // m per occupancy cell
const TILE = 64;                      // cells per tile side (128 m)
export const ROAD = 1, MARGIN = 2, ITEM = 4, RESERVED = 8, WATERSIDE = 16;

const tkey = (tx, tz) => (tx + 4096) * 8192 + (tz + 4096);

export class Occ {
  constructor() {
    this.tiles = new Map();
  }

  tile(tx, tz, make) {
    const k = tkey(tx, tz);
    let t = this.tiles.get(k);
    if (!t && make) { t = new Uint8Array(TILE * TILE); this.tiles.set(k, t); }
    return t;
  }

  /** Flags at (x, z). */
  get(x, z) {
    const ix = Math.floor(x / RES), iz = Math.floor(z / RES);
    const t = this.tile(Math.floor(ix / TILE), Math.floor(iz / TILE), false);
    if (!t) return 0;
    return t[(iz - Math.floor(iz / TILE) * TILE) * TILE + (ix - Math.floor(ix / TILE) * TILE)];
  }

  setCell(ix, iz, flag) {
    const tx = Math.floor(ix / TILE), tz = Math.floor(iz / TILE);
    const t = this.tile(tx, tz, true);
    t[(iz - tz * TILE) * TILE + (ix - tx * TILE)] |= flag;
  }

  cell(ix, iz) {
    const tx = Math.floor(ix / TILE), tz = Math.floor(iz / TILE);
    const t = this.tile(tx, tz, false);
    return t ? t[(iz - tz * TILE) * TILE + (ix - tx * TILE)] : 0;
  }

  /**
   * Visit the cells of a rectangle centred (x, z), w along its local x (which
   * points (cos ry, −sin ry)), d along its local z ((sin ry, cos ry)), grown
   * by pad. fn(ix, iz) → true stops early (and visit returns true).
   */
  visitRect(x, z, w, d, ry, pad, fn) {
    const c = Math.cos(ry), s = Math.sin(ry);
    const hw = w / 2 + pad, hd = d / 2 + pad;
    // bounding box of the turned rectangle
    const ex = Math.abs(c) * hw + Math.abs(s) * hd, ez = Math.abs(s) * hw + Math.abs(c) * hd;
    const i0 = Math.floor((x - ex) / RES), i1 = Math.floor((x + ex) / RES);
    const j0 = Math.floor((z - ez) / RES), j1 = Math.floor((z + ez) / RES);
    for (let j = j0; j <= j1; j++) {
      const pz = (j + 0.5) * RES - z;
      for (let i = i0; i <= i1; i++) {
        const px = (i + 0.5) * RES - x;
        // into the rectangle's frame
        const lx = px * c - pz * s, lz = px * s + pz * c;
        if (lx < -hw || lx > hw || lz < -hd || lz > hd) continue;
        if (fn(i, j)) return true;
      }
    }
    return false;
  }

  /** Is any cell under the rectangle flagged with any of mask? */
  hitRect(x, z, w, d, ry, mask, pad = 0) {
    return this.visitRect(x, z, w, d, ry, pad, (i, j) => (this.cell(i, j) & mask) !== 0);
  }

  markRect(x, z, w, d, ry, flag, pad = 0) {
    this.visitRect(x, z, w, d, ry, pad, (i, j) => { this.setCell(i, j, flag); });
  }

  hitDisc(x, z, r, mask) {
    const i0 = Math.floor((x - r) / RES), i1 = Math.floor((x + r) / RES);
    const j0 = Math.floor((z - r) / RES), j1 = Math.floor((z + r) / RES);
    for (let j = j0; j <= j1; j++) {
      for (let i = i0; i <= i1; i++) {
        const dx = (i + 0.5) * RES - x, dz = (j + 0.5) * RES - z;
        if (dx * dx + dz * dz > r * r) continue;
        if (this.cell(i, j) & mask) return true;
      }
    }
    return false;
  }

  markDisc(x, z, r, flag) {
    const i0 = Math.floor((x - r) / RES), i1 = Math.floor((x + r) / RES);
    const j0 = Math.floor((z - r) / RES), j1 = Math.floor((z + r) / RES);
    for (let j = j0; j <= j1; j++) {
      for (let i = i0; i <= i1; i++) {
        const dx = (i + 0.5) * RES - x, dz = (j + 0.5) * RES - z;
        if (dx * dx + dz * dz <= r * r) this.setCell(i, j, flag);
      }
    }
  }

  /** Mark a convex/simple polygon [[x, z], …]. */
  markPoly(poly, flag) {
    let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
    for (const [px, pz] of poly) { x0 = Math.min(x0, px); x1 = Math.max(x1, px); z0 = Math.min(z0, pz); z1 = Math.max(z1, pz); }
    for (let j = Math.floor(z0 / RES); j <= Math.floor(z1 / RES); j++) {
      for (let i = Math.floor(x0 / RES); i <= Math.floor(x1 / RES); i++) {
        if (inPolyF(poly, (i + 0.5) * RES, (j + 0.5) * RES)) this.setCell(i, j, flag);
      }
    }
  }

  /**
   * Rasterise the road network: every sample's corridor (out to its reach:
   * carriageway, shoulders, sidewalks) as ROAD, `margin` m more as MARGIN,
   * and junction paving. Tunnels are underground and leave the ground free.
   */
  addRoads(net, margin = 3) {
    const h = RES / 2;
    for (const r of net.roads) {
      const rt = r.rt;
      const reach = rt.hw + rt.shoulder + rt.walk + 0.4;
      const R = reach + margin;
      for (let i = 0; i < r.N; i++) {
        if (r.flags[i] & F_TUNNEL) continue;
        const x = r.X[i], z = r.Z[i], lx = r.LX[i], lz = r.LZ[i], tx = r.TX[i], tz = r.TZ[i];
        // march across the road (and a sample's length along it) a half cell at a time
        for (let lat = -R; lat <= R; lat += h) {
          const f = Math.abs(lat) <= reach ? ROAD | MARGIN : MARGIN;
          for (let lon = -r.step * 0.5; lon <= r.step * 0.5 + 0.01; lon += h) {
            this.setCell(Math.floor((x + lx * lat + tx * lon) / RES), Math.floor((z + lz * lat + tz * lon) / RES), f);
          }
        }
      }
    }
    // (the corridors run right up to their nodes, so they already cover the
    // junction and its corner sidewalks; the paving polygon is belt and braces)
    for (const n of net.nodes.values()) {
      if (n.kind === 'junction' && n.poly) this.markPoly(n.poly, ROAD | MARGIN);
    }
  }
}

function inPolyF(poly, x, z) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i][0], zi = poly[i][1], xj = poly[j][0], zj = poly[j][1];
    if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside;
  }
  return inside;
}
