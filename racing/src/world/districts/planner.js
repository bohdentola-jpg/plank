// PORT HALCYON — planning a district: where its buildings, landmarks, lamps
// and solid things go, worked out once (headless, no meshes) from the road
// network and the land, deterministically (a seeded random per district).
// The plan is what the cells build from, what physics collides with, what
// the far skyline is drawn from and what the map shows.
//
// A district pack's plan(P) uses this:
//   P.d, P.net, P.terrain, P.rng(), P.pick(arr), P.range(a, b), P.noise(x, z)
//   P.inside(x, z, pad)        in this district (pad m in from its edge)
//   P.land(x, z)               dry land (not the sea, the lake or the river)
//   P.groundY(x, z)            built ground height (approximate: a 16 m grid)
//   P.roads(filter)            the roads that run through the district
//   P.isFree(x, z, w, d, ry, o) a footprint clear of roads, other footprints, water
//   P.claim(x, z, w, d, ry)    take a footprint (nothing else will go there)
//   P.lots(o)                  building lots along the roads (claimed)
//   P.fill(o)                  more lots wherever there's room (corners, interiors)
//   P.points(spacing, o)       jittered points over the district
//   P.nearestRoad(x, z, r)     { road, i, d, ry (facing it) } or null
//   P.add(item)                something to build: { type, x, z, ... } — the
//                              cell that holds (x, z) builds it with the pack
//   P.collider(c)              { kind: 'box', x, z, hx, hz, ry, y0, y1 } or
//                              { kind: 'circle', x, z, r, y0, y1 }
//   P.lamp(L)                  a light: { x, z, hx, hy, hz, color, radius,
//                              intensity?, halo? } (baked onto the ground at
//                              night, a halo round its head, a point far away)
//   P.far(f)                   the shape seen from far away: { shape: 'box'|
//                              'cyl'|'cone', x, z, y, w, d, h, ry, r, color, lit }
//   P.landmark(m)              { id, name, x, z, r, hidden, kind } for the map
import * as THREE from 'three';
import { makeRng, makeNoise2D, hashString } from '../../core/util.js';
import { CELL, waterAt } from '../terrain.js';
import { districtAt } from '../ground.js';
import { inPoly, edgeDist } from '../geom.js';
import { ROAD, MARGIN, ITEM, RESERVED } from './occ.js';

const TAU = Math.PI * 2;

export class Planner {
  constructor(D, d, pack) {
    this.D = D;               // the Districts
    this.d = d;
    this.pack = pack;
    this.net = D.net;
    this.terrain = D.terrain;
    this.occ = D.occ;
    this.rng = makeRng('district:' + d.id);
    this._noise = makeNoise2D(hashString('dn:' + d.id) % 100000);
    this.count = 0;
  }

  pick(a) { return a[Math.floor(this.rng() * a.length) % a.length]; }
  range(a, b) { return a + (b - a) * this.rng(); }
  noise(x, z) { return this._noise(x, z); }

  inside(x, z, pad = 0) {
    const b = this.d.box;
    if (x < b.x0 + pad || x > b.x1 - pad || z < b.z0 + pad || z > b.z1 - pad) return false;
    if (!inPoly(this.d.poly, x, z)) return false;
    return pad <= 0 || edgeDist(this.d.poly, x, z) >= pad;
  }

  land(x, z) { return !waterAt(x, z); }

  groundY(x, z) {
    const g = this.terrain.grid(Math.floor(x / CELL), Math.floor(z / CELL), 16);
    const fx = (x - g.x0) / g.res, fz = (z - g.z0) / g.res;
    const i = Math.max(0, Math.min(g.n - 2, Math.floor(fx))), j = Math.max(0, Math.min(g.n - 2, Math.floor(fz)));
    const tx = fx - i, tz = fz - j;
    const H = g.H, k = g.at(i, j), m = g.m;
    return (H[k] * (1 - tx) + H[k + 1] * tx) * (1 - tz) + (H[k + m] * (1 - tx) + H[k + m + 1] * tx) * tz;
  }

  /** Lowest and highest ground under a footprint (approximate). */
  groundRange(x, z, w, d, ry) {
    const c = Math.cos(ry), s = Math.sin(ry);
    let lo = Infinity, hi = -Infinity;
    for (const [a, b] of [[0, 0], [-1, -1], [1, -1], [1, 1], [-1, 1]]) {
      const lx = a * w / 2, lz = b * d / 2;
      const y = this.groundY(x + lx * c + lz * s, z - lx * s + lz * c);
      lo = Math.min(lo, y); hi = Math.max(hi, y);
    }
    return { lo, hi };
  }

  /** Roads through the district (a sample inside it), in a fixed order. */
  roads(filter = null) {
    if (!this._roads) {
      this._roads = [];
      const b = this.d.box;
      for (const r of this.net.roads) {
        let n = 0;
        for (let i = 0; i < r.N; i += 8) {
          const x = r.X[i], z = r.Z[i];
          if (x < b.x0 || x > b.x1 || z < b.z0 || z > b.z1) continue;
          if (inPoly(this.d.poly, x, z)) { n++; if (n > 1) break; }
        }
        if (n) this._roads.push(r);
      }
    }
    return filter ? this._roads.filter(filter) : this._roads;
  }

  /**
   * Is a footprint free? Clear of every road corridor (roadPad: also clear
   * of the margin round roads), of other footprints (pad m round it; less
   * than 0 lets neighbours share a wall), of water, and (unless anywhere)
   * inside the district. front: metres at the footprint's front (+z) not
   * checked against the roads (a lot put flush to a sidewalk by its road's
   * own geometry: the 2 m grid would otherwise round the kerb into it).
   */
  isFree(x, z, w, d, ry, o = {}) {
    const pad = o.pad ?? 0.4;
    const c = Math.cos(ry), s = Math.sin(ry);
    if (!o.anywhere) {
      for (const [a, b] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
        if (!this.inside(x + a * w / 2 * c + b * d / 2 * s, z - a * w / 2 * s + b * d / 2 * c)) return false;
      }
    }
    const f = Math.min(o.front || 0, d * 0.5);
    const roadMask = ROAD | RESERVED | (o.roadPad ? MARGIN : 0);
    if (this.occ.hitRect(x - s * f / 2, z - c * f / 2, w, d - f, ry, roadMask, 0)) return false;
    if (this.occ.hitRect(x, z, w, d, ry, ITEM, pad)) return false;
    if (o.water !== true) {
      for (const [a, b] of [[0, 0], [-1, -1], [1, -1], [1, 1], [-1, 1]]) {
        if (waterAt(x + a * w / 2 * c + b * d / 2 * s, z - a * w / 2 * s + b * d / 2 * c)) return false;
      }
    }
    return true;
  }

  claim(x, z, w, d, ry) { this.occ.markRect(x, z, w, d, ry, ITEM); }

  /** Nearest road: { road, i, d, ry } where ry turns a lot's front (+z) to face it. */
  nearestRoad(x, z, rad = 200) {
    const n = this.net.nearest(x, z, rad);
    if (!n) return null;
    const r = n.road, i = n.i;
    const dx = r.X[i] - x, dz = r.Z[i] - z;
    // the road's own axis, flipped to face it
    const lat = (x - r.X[i]) * r.LX[i] + (z - r.Z[i]) * r.LZ[i];
    const sd = lat >= 0 ? 1 : -1;
    void dx; void dz;
    return { road: r, i, d: n.d, side: sd, ry: Math.atan2(-sd * r.LX[i], -sd * r.LZ[i]) };
  }

  /**
   * Building lots along the roads, both sides, fronting the sidewalk:
   *   roads   filter (road) → bool (default: every road through the district)
   *   width   [min, max] along the road (or fn(P, road) → number)
   *   depth   [min, max] back from the road (tries max first, shrinks to fit)
   *   gap     [min, max] between lots
   *   setback [min, max] from the road's edge (its sidewalk's back)
   *   sides   which sides ([1, -1])
   *   ends    keep this far from a road's ends (its junctions)
   *   pad     clearance round other footprints
   *   chance  keep a lot with this probability (gaps: parking, yards)
   * → [{ x, z, ry, w, d, road, side, s, setback }], ry turning +z to face the road.
   */
  lots(o = {}) {
    const out = [];
    const W = o.width || [12, 22], Dp = o.depth || [10, 24], G = o.gap || [0, 0];
    const SB = o.setback ?? [0, 0];
    const ends = o.ends ?? 3;
    const sides = o.sides || [1, -1];
    const val = (v, road) => (typeof v === 'function' ? v(this, road) : Array.isArray(v) ? this.range(v[0], v[1]) : v);
    for (const r of this.roads(o.roads)) {
      const rt = r.rt;
      const reach = rt.hw + rt.shoulder + rt.walk + 0.4;
      for (const sd of sides) {
        let s = (r.closed ? 0 : r.trim0) + ends;
        const s1 = r.closed ? r.length : r.length - r.trim1 - ends;
        let guard = 0;
        while (s < s1 && guard++ < 4000) {
          const w = val(W, r);
          if (s + w > s1) break;
          const p = r.posAt(s + w / 2);
          const i = p.i;
          const lx = r.LX[i] * sd, lz = r.LZ[i] * sd;
          const ry = Math.atan2(-lx, -lz);
          const sb = val(SB, r);
          let placed = null;
          const dMax = Array.isArray(Dp) ? Dp[1] : val(Dp, r), dMin = Array.isArray(Dp) ? Dp[0] : dMax;
          for (let d = dMax; d >= dMin - 0.01; d -= 2) {
            const off = reach + sb + d / 2;
            const x = r.X[i] + lx * off, z = r.Z[i] + lz * off;
            if (!this.inside(x, z)) break;
            if (this.isFree(x, z, w, d, ry, { pad: o.pad ?? 0.4, front: sb < 1.5 ? 1.6 - sb : 0, roadPad: o.roadPad })) { placed = { x, z, ry, w, d, road: r, side: sd, s: s + w / 2, setback: sb }; break; }
          }
          if (placed && (o.chance === undefined || this.rng() < o.chance)) {
            this.claim(placed.x, placed.z, placed.w, placed.d, placed.ry);
            out.push(placed);
            s += w + val(G, r);
          } else if (placed) {
            s += w + val(G, r);
          } else s += 2;
        }
      }
    }
    return out;
  }

  /**
   * More lots wherever there's room: a jittered scan over the district,
   * each lot turned square to its nearest road. o: { spacing, width, depth,
   * pad, roadPad, chance, test(x, z) }.
   */
  fill(o = {}) {
    const out = [];
    const sp = o.spacing || 14;
    const W = o.width || [10, 20], Dp = o.depth || [10, 20];
    const b = this.d.box;
    for (let z = b.z0 + sp / 2; z < b.z1; z += sp) {
      for (let x = b.x0 + sp / 2; x < b.x1; x += sp) {
        const px = x + (this.rng() - 0.5) * sp * 0.5, pz = z + (this.rng() - 0.5) * sp * 0.5;
        if (!this.inside(px, pz)) continue;
        if (this.occ.get(px, pz) & (ROAD | ITEM | RESERVED)) continue;
        if (o.test && !o.test(px, pz)) continue;
        if (o.chance !== undefined && this.rng() > o.chance) continue;
        const nr = this.nearestRoad(px, pz, o.reach || 160);
        const ry = nr ? nr.ry : (o.ry ?? 0);
        const w0 = Array.isArray(W) ? W[1] : W, w1 = Array.isArray(W) ? W[0] : W;
        const d0 = Array.isArray(Dp) ? Dp[1] : Dp, d1 = Array.isArray(Dp) ? Dp[0] : Dp;
        let placed = null;
        for (let k = 0; k < 4 && !placed; k++) {
          const t = k / 3;
          const w = w0 + (w1 - w0) * t, d = d0 + (d1 - d0) * t;
          if (this.isFree(px, pz, w, d, ry, { pad: o.pad ?? 0.4, roadPad: o.roadPad })) placed = { x: px, z: pz, ry, w, d, road: nr?.road || null, side: nr?.side || 1, fill: true };
        }
        if (placed) {
          this.claim(placed.x, placed.z, placed.w, placed.d, placed.ry);
          out.push(placed);
        }
      }
    }
    return out;
  }

  /** Jittered grid points inside the district (and o.test). */
  points(spacing, o = {}) {
    const out = [];
    const b = this.d.box;
    const j = o.jitter ?? 0.8;
    for (let z = b.z0 + spacing / 2; z < b.z1; z += spacing) {
      for (let x = b.x0 + spacing / 2; x < b.x1; x += spacing) {
        const px = x + (this.rng() - 0.5) * spacing * j, pz = z + (this.rng() - 0.5) * spacing * j;
        if (!this.inside(px, pz)) continue;
        if (o.clear !== false && (this.occ.get(px, pz) & (ROAD | ITEM | RESERVED | (o.roadPad ? MARGIN : 0)))) continue;
        if (o.test && !o.test(px, pz)) continue;
        out.push([px, pz]);
      }
    }
    return out;
  }

  // ---------------------------------------------------------------- output

  add(item) {
    item.pack = this.pack.id;
    item.district = this.d.id;
    item.n = this.count++;
    this.D.addItem(item);
    return item;
  }

  collider(c) { this.D.addCollider(c); return c; }

  lamp(L) {
    const l = {
      x: L.x, z: L.z, y: L.y ?? this.groundY(L.x, L.z),
      hx: L.hx ?? L.x, hz: L.hz ?? L.z, hy: L.hy,
      color: L.color instanceof THREE.Color ? L.color : new THREE.Color(L.color || '#ffd8a0'),
      radius: L.radius ?? 14, intensity: L.intensity ?? 1, halo: L.halo,
    };
    if (l.hy === undefined) l.hy = l.y + 5;
    this.D.addLamp(l);
    return l;
  }

  far(f) {
    const o = { shape: 'box', ry: 0, lit: 0, color: '#777777', ...f };
    if (o.y === undefined) o.y = this.groundY(o.x, o.z) - 1;
    this.D.addFar(o);
    return o;
  }

  landmark(m) { this.D.landmarks.push({ district: this.d.id, ...m }); return m; }
}

/**
 * Scattering one cell of a district (trees, rocks, bushes): lazily, when
 * the cell is built or something drives near it, deterministic per cell.
 * pack.scatter(S) uses: S.d, S.cx, S.cz, S.x0, S.z0, S.x1, S.z1, S.rng(),
 * S.range, S.pick, S.noise(x, z), S.inside(x, z), S.free(x, z, r, roadPad),
 * S.groundY(x, z) (exact), S.points(spacing, o), S.add(item), S.collider(c).
 */
export class Scatter {
  constructor(D, d, pack, cx, cz) {
    this.D = D;
    this.d = d;
    this.pack = pack;
    this.cx = cx; this.cz = cz;
    this.x0 = cx * CELL; this.z0 = cz * CELL;
    this.x1 = this.x0 + CELL; this.z1 = this.z0 + CELL;
    this.rng = makeRng(`scatter:${d.id}:${cx}:${cz}`);
    this._noise = D.noiseFor(d.id);
    this.items = [];
    this.colliders = [];
    this.terrain = D.terrain;
    this.occ = D.occ;
    this.net = D.net;
  }
  pick(a) { return a[Math.floor(this.rng() * a.length) % a.length]; }
  range(a, b) { return a + (b - a) * this.rng(); }
  noise(x, z) { return this._noise(x, z); }
  inside(x, z) { return districtAt(x, z)?.id === this.d.id; }
  land(x, z) { return !waterAt(x, z); }
  /** No road (roadPad: nor its margin) and no planned footprint within r. */
  free(x, z, r = 1, roadPad = true) {
    return !this.occ.hitDisc(x, z, r, ROAD | ITEM | RESERVED | (roadPad ? MARGIN : 0));
  }
  groundY(x, z) { return this.terrain.heightAt(x, z); }
  points(spacing, o = {}) {
    const out = [];
    const j = o.jitter ?? 0.9;
    for (let z = this.z0 + spacing / 2; z < this.z1; z += spacing) {
      for (let x = this.x0 + spacing / 2; x < this.x1; x += spacing) {
        const px = x + (this.rng() - 0.5) * spacing * j, pz = z + (this.rng() - 0.5) * spacing * j;
        const keep = this.rng();
        if (!this.inside(px, pz)) continue;
        if (o.density && keep > o.density(px, pz)) continue;
        if (o.water !== true && waterAt(px, pz)) continue;
        if (o.clear !== false && !this.free(px, pz, o.r ?? 1, o.roadPad ?? true)) continue;
        out.push([px, pz]);
      }
    }
    return out;
  }
  add(item) { item.pack = this.pack.id; item.district = this.d.id; item.n = this.items.length; this.items.push(item); return item; }
  collider(c) { this.colliders.push(c); return c; }
}

export { TAU };
