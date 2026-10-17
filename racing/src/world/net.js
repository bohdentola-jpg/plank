// PORT HALCYON — the road network. Every road in the world is a Road (a
// Track: a smooth centerline sampled every ~2 m with its frame, width and
// height), joined to others at nodes. Building the network:
//   1. roads from the map's specs, their ends hung on their nodes
//   2. heights: the land under each road, smoothed to the road type's taste,
//      held to its nodes' heights at the ends, kept above water (bridges),
//      lifted where it runs elevated, climb-limited
//   3. where the road leaves the ground (bridge / elevated) or goes into it
//      (tunnel), flagged per sample
//   4. junctions: how far each road stops short of a node so the junction
//      can be paved as one piece (and the corner sidewalks)
//   5. a spatial index over every sample for the ground, the terrain grader,
//      traffic and the map
import { Track } from '../track/track.js';
import { smoothArray } from '../track/path.js';
import { roadType } from './roadtypes.js';
import { natural, waterAt } from './terrain.js';
import { MAP } from './map/index.js';

export const F_BRIDGE = 1, F_TUNNEL = 2, F_ELEV = 4;
const IDX = 32;           // spatial index cell (m)
const KEY = (cx, cz) => cx * 65536 + cz;

export class Road extends Track {
  constructor(spec, ri, pts) {
    const rt = roadType(spec.type);
    super({
      id: spec.id, type: spec.loop ? 'circuit' : 'sprint', closed: !!spec.loop, env: 'world',
      points: pts, width: rt.hw * 2, radius: spec.radius ?? 30,
      bank: spec.bank ?? (rt.id === 'circuit' ? 0.7 : rt.id === 'freeway' || rt.id === 'expressway' ? 0.3 : 0),
      shoulder: rt.shoulder + rt.walk, wall: rt.shoulder + rt.walk + 0.4,
    });
    this.spec = spec;
    this.rt = rt;
    this.ri = ri;
    this.name = spec.name || '';
    this.district = spec.district || null;
    this.flags = new Uint8Array(this.N);
    this.trim0 = 0;
    this.trim1 = 0;
    this.layer = 0;
  }

  /** Is (x, z) past either end of this (open) road? */
  pastEnd(p, x, z) {
    if (this.closed) return false;
    if (p.i === 0 && p.t <= 0) return (x - this.X[0]) * this.TX[0] + (z - this.Z[0]) * this.TZ[0] < -0.05;
    const n = this.N - 1;
    if (p.i >= n - 1 && p.t >= 1) return (x - this.X[n]) * this.TX[n] + (z - this.Z[n]) * this.TZ[n] > 0.05;
    return false;
  }
}

/** Build the whole network from the map (or a given map). */
export function buildNet(map = MAP) {
  const net = new RoadNet(map);
  return net;
}

export class RoadNet {
  constructor(map) {
    this.map = map;
    this.nodes = new Map();    // id → { id, x, z, y, ends: [{ road, end, dx, dz }] }
    this.roads = [];
    this.byId = new Map();
    for (const [id, p] of Object.entries(map.nodes)) {
      this.nodes.set(id, { id, x: p[0], z: p[1], y: p[2] ?? null, authoredY: p[2] !== undefined && p[2] !== null, ends: [] });
    }
    for (const spec of map.roads) this.addRoad(spec);
    this.totalLength = this.roads.reduce((a, r) => a + r.length, 0);
    this.solveHeights();
    this.solveJunctions();
    this.index();
  }

  addRoad(spec) {
    const A = this.nodes.get(spec.a), B = this.nodes.get(spec.b);
    if (!A || !B) throw new Error(`road ${spec.id}: missing node ${!A ? spec.a : spec.b}`);
    if (this.byId.has(spec.id)) throw new Error(`road ${spec.id} defined twice`);
    const pts = [[A.x, A.z, 0, undefined]];
    for (const p of spec.pts || []) pts.push([p[0], p[1], p[2] ?? spec.radius ?? 30, p[3]]);
    pts.push([B.x, B.z, 0, undefined]);
    if (spec.loop) pts.pop();
    const r = new Road(spec, this.roads.length, pts);
    r.a = A; r.b = B;
    this.roads.push(r);
    this.byId.set(spec.id, r);
    // ends: direction pointing away from the node, along the road
    const k = Math.min(r.N - 1, 3);
    A.ends.push({ road: r, end: 0, dx: r.X[k] - r.X[0], dz: r.Z[k] - r.Z[0] });
    const n = r.N - 1;
    B.ends.push({ road: r, end: 1, dx: r.X[n - k] - r.X[n], dz: r.Z[n - k] - r.Z[n] });
    for (const e of [A.ends[A.ends.length - 1], B.ends[B.ends.length - 1]]) {
      const l = Math.hypot(e.dx, e.dz) || 1;
      e.dx /= l; e.dz /= l;
    }
    return r;
  }

  // ---------------------------------------------------------------- heights

  solveHeights() {
    // the land under every sample (and whether it's water)
    for (const r of this.roads) {
      r.HN = new Float32Array(r.N);
      r.WY = new Float32Array(r.N).fill(-1e9);
      for (let i = 0; i < r.N; i++) {
        const h = natural(r.X[i], r.Z[i]);
        r.HN[i] = h;
        const w = waterAt(r.X[i], r.Z[i]);
        if (w && w.y > h - 0.2) r.WY[i] = w.y;
      }
    }
    // node heights: authored, else the land under the road ends there
    for (const n of this.nodes.values()) {
      if (n.authoredY) continue;
      let s = 0, c = 0, wmax = -1e9;
      for (const e of n.ends) {
        const r = e.road;
        for (let k = 0; k < Math.min(5, r.N); k++) {
          const i = e.end === 0 ? k : r.N - 1 - k;
          s += r.HN[i]; c++;
          wmax = Math.max(wmax, r.WY[i]);
        }
      }
      n.y = c ? s / c : natural(n.x, n.z);
      if (wmax > -1e8) n.y = Math.max(n.y, wmax + 1.5);
    }
    for (const r of this.roads) this.profile(r);
  }

  profile(r) {
    const N = r.N, rt = r.rt, sp = r.spec;
    const step = r.step;
    let y = new Float32Array(N);
    const authored = sp.profile === 'pts' || (sp.pts || []).some((p) => p[3] !== undefined);
    if (authored) {
      y.set(r.Y);
    } else if (sp.profile === 'flat') {
      y.fill((r.a.y + r.b.y) / 2);
    } else {
      // the land, but over water the deck spans bank to bank (with clearance)
      const clear = sp.clear ?? (rt.id === 'freeway' || rt.id === 'expressway' ? 9 : 6);
      for (let i = 0; i < N; i++) y[i] = r.HN[i];
      let i = 0;
      while (i < N) {
        if (r.WY[i] < -1e8) { i++; continue; }
        let j = i;
        while (j < N && r.WY[j] > -1e8) j++;
        const ya = i > 0 ? r.HN[i - 1] : r.a.y, yb = j < N ? r.HN[j] : r.b.y;
        let wmax = -1e9;
        for (let k = i; k < j; k++) wmax = Math.max(wmax, r.WY[k]);
        const span = j - i;
        for (let k = i; k < j; k++) {
          const t = (k - i + 0.5) / Math.max(1, span);
          const arch = Math.sin(t * Math.PI);
          y[k] = Math.max(ya + (yb - ya) * t, wmax + clear * (0.55 + 0.45 * arch));
        }
        i = j;
      }
      // forced bridges: hold a deck height over the stretch
      for (const [s0, s1, yd] of sp.bridge || []) {
        const i0 = Math.max(0, Math.floor(s0 / step)), i1 = Math.min(N - 1, Math.ceil(s1 / step));
        const ya = y[Math.max(0, i0 - 1)], yb = y[Math.min(N - 1, i1 + 1)];
        for (let k = i0; k <= i1; k++) {
          const t = (k - i0) / Math.max(1, i1 - i0);
          y[k] = yd !== undefined ? Math.max(yd, ya + (yb - ya) * t) : ya + (yb - ya) * t;
        }
      }
      const rad = Math.max(1, Math.round((sp.smooth ?? rt.smooth) / 2 / step));
      y = smoothArray(y, rad, r.closed, 3);
    }
    // elevated runs: the deck stands `h` over the land (ramping up and down)
    for (const [s0, s1, h, ramp = 160] of sp.elevated || []) {
      for (let i = 0; i < N; i++) {
        const s = i * step;
        const kin = Math.min(1, Math.max(0, (s - s0) / ramp), Math.max(0, (s1 - s) / ramp));
        if (kin <= 0) continue;
        const e = kin * kin * (3 - 2 * kin);
        y[i] = Math.max(y[i], y[i] + h * e);
      }
    }
    if (sp.elevated) {
      const rad = Math.max(1, Math.round(60 / step));
      y = smoothArray(y, rad, r.closed, 2);
    }
    // held to the nodes at both ends
    if (!r.closed) {
      const L = r.length;
      const bl = Math.min(L * 0.45, sp.endBlend ?? Math.max(30, (sp.smooth ?? rt.smooth) * 0.6));
      const ya = r.a.y, yb = r.b.y;
      for (let i = 0; i < N; i++) {
        const s = i * step;
        const ka = s < bl ? 1 - s / bl : 0, kb = L - s < bl ? 1 - (L - s) / bl : 0;
        const ea = ka * ka * (3 - 2 * ka), eb = kb * kb * (3 - 2 * kb);
        y[i] = y[i] + (ya - y[i]) * ea + (yb - y[i]) * eb * (1 - ea);
      }
      y[0] = ya; y[N - 1] = yb;
    }
    // grade limit (both directions)
    const g = (sp.grade ?? rt.grade) * step;
    for (let pass = 0; pass < 3; pass++) {
      for (let i = 1; i < N; i++) y[i] = Math.min(y[i], y[i - 1] + g);
      for (let i = N - 2; i >= 0; i--) y[i] = Math.min(y[i], y[i + 1] + g);
      for (let i = 1; i < N; i++) y[i] = Math.max(y[i], y[i - 1] - g);
      for (let i = N - 2; i >= 0; i--) y[i] = Math.max(y[i], y[i + 1] - g);
      if (!r.closed) { y[0] = r.a.y; y[N - 1] = r.b.y; }
    }
    r.Y = y;
    // flags: off the ground (bridge/elevated) or under it (tunnel)
    const elev = sp.elevated || [];
    const tun = sp.tunnel || [];
    for (let i = 0; i < N; i++) {
      const s = i * step;
      let f = 0;
      if (!sp.noBridge && (y[i] - r.HN[i] > 4.5 || r.WY[i] > -1e8)) f |= F_BRIDGE;
      if (elev.some(([s0, s1]) => s >= s0 && s <= s1) && y[i] - r.HN[i] > 3.5) f |= F_ELEV;
      if (tun.some(([s0, s1]) => s >= s0 && s <= s1) || (sp.autoTunnel && r.HN[i] - y[i] > 9)) f |= F_TUNNEL;
      r.flags[i] = f;
    }
    // a bridge's flag reaches back onto its approaches a little (the deck)
    const pad = 3;
    const fl = r.flags.slice();
    for (let i = 0; i < N; i++) if (fl[i] & F_BRIDGE) for (let k = -pad; k <= pad; k++) { const j = i + k; if (j >= 0 && j < N) r.flags[j] |= F_BRIDGE; }
    r.layer = elev.length ? 1 : 0;
  }

  // ---------------------------------------------------------------- junctions

  solveJunctions() {
    for (const n of this.nodes.values()) {
      const E = n.ends;
      n.kind = E.length === 0 ? 'none' : E.length === 1 ? 'dead' : 'junction';
      if (E.length === 2) {
        const a = E[0], b = E[1];
        const dot = a.dx * b.dx + a.dz * b.dz;
        // nearly straight through, same kind of road: just a joint
        if (dot < -0.85 && a.road.rt.id === b.road.rt.id) n.kind = 'joint';
      }
      for (const e of E) e.ang = Math.atan2(e.dz, e.dx);
      E.sort((p, q) => p.ang - q.ang);
      n.reach = 0;
      if (n.kind !== 'junction') continue;
      for (const e of E) {
        const r = e.road, rt = r.rt;
        const wi = rt.hw + rt.shoulder + rt.walk;
        let t = rt.hw * 0.6;
        for (const f of E) {
          if (f === e) continue;
          const rf = f.road.rt;
          const wf = rf.hw + rf.shoulder + rf.walk;
          const c = e.dx * f.dx + e.dz * f.dz;
          const s = Math.sqrt(Math.max(0, 1 - c * c));
          t = Math.max(t, (wf + wi * Math.abs(c)) / Math.max(s, 0.3) + 0.5);
        }
        t = Math.min(t, 60, r.length * 0.45);
        e.trim = t;
        if (e.end === 0) r.trim0 = t; else r.trim1 = t;
        n.reach = Math.max(n.reach, t + wi);
      }
      // the paved junction: each end's carriageway corners at its trim, in angle order
      n.poly = [];
      for (const e of E) {
        const r = e.road, rt = r.rt;
        const w = rt.hw + rt.shoulder;
        const lx = -e.dz, lz = e.dx;   // left of the outward direction
        const cx = n.x + e.dx * e.trim, cz = n.z + e.dz * e.trim;
        n.poly.push([cx - lx * w, cz - lz * w], [cx + lx * w, cz + lz * w]);
      }
    }
  }

  // ---------------------------------------------------------------- index

  index() {
    this.grid = new Map();
    for (const r of this.roads) {
      for (let i = 0; i < r.N; i++) {
        const k = KEY(Math.floor(r.X[i] / IDX) + 32768 >> 0, Math.floor(r.Z[i] / IDX) + 32768 >> 0);
        let a = this.grid.get(k);
        if (!a) { a = []; this.grid.set(k, a); }
        a.push(r.ri, i);
      }
    }
    this.jgrid = new Map();
    for (const n of this.nodes.values()) {
      if (n.kind !== 'junction') continue;
      const k = KEY(Math.floor(n.x / IDX) + 32768 >> 0, Math.floor(n.z / IDX) + 32768 >> 0);
      let a = this.jgrid.get(k);
      if (!a) { a = []; this.jgrid.set(k, a); }
      a.push(n);
    }
    this.maxReach = Math.max(...this.roads.map((r) => r.rt.reach)) + 2;
  }

  /** For each road near (x, z) (within r m of a sample): road → nearest sample index. */
  near(x, z, rad, out = new Map()) {
    out.clear();
    const c0 = Math.floor((x - rad) / IDX), c1 = Math.floor((x + rad) / IDX);
    const d0 = Math.floor((z - rad) / IDX), d1 = Math.floor((z + rad) / IDX);
    const best = this._best || (this._best = new Map());
    best.clear();
    for (let cx = c0; cx <= c1; cx++) {
      for (let cz = d0; cz <= d1; cz++) {
        const a = this.grid.get(KEY(cx + 32768, cz + 32768));
        if (!a) continue;
        for (let k = 0; k < a.length; k += 2) {
          const r = this.roads[a[k]], i = a[k + 1];
          const d2 = (r.X[i] - x) ** 2 + (r.Z[i] - z) ** 2;
          if (d2 > rad * rad) continue;
          const b = best.get(r);
          if (b === undefined || d2 < b) { best.set(r, d2); out.set(r, i); }
        }
      }
    }
    return out;
  }

  /** Junction nodes whose paving might cover (x, z). */
  junctionsNear(x, z, out = []) {
    out.length = 0;
    const cx = Math.floor(x / IDX), cz = Math.floor(z / IDX);
    for (let dx = -2; dx <= 2; dx++) {
      for (let dz = -2; dz <= 2; dz++) {
        const a = this.jgrid.get(KEY(cx + dx + 32768, cz + dz + 32768));
        if (!a) continue;
        for (const n of a) if ((n.x - x) ** 2 + (n.z - z) ** 2 < (n.reach + 4) ** 2) out.push(n);
      }
    }
    return out;
  }

  /**
   * Road surfaces at (x, z): every road whose corridor covers the point,
   * as { road, i, t, s, lat, h, zone: 'road'|'shoulder'|'walk'|'median', surface }.
   */
  surfaces(x, z, out = []) {
    out.length = 0;
    const near = this.near(x, z, this.maxReach + 2, this._nm || (this._nm = new Map()));
    const p = this._pp || (this._pp = {});
    for (const [r, i0] of near) {
      r.project(x, z, i0, p);
      if (r.pastEnd(p, x, z)) continue;
      const rt = r.rt;
      const lat = p.lat, al = Math.abs(lat);
      const hw = rt.hw;
      if (al > hw + rt.shoulder + rt.walk) continue;
      // trimmed at junctions: the junction paving owns that bit
      if (!r.closed && (p.s < r.trim0 - 0.5 || p.s > r.length - r.trim1 + 0.5)) continue;
      let h = r.roadY(p.i, p.t, Math.max(-hw, Math.min(hw, lat)));
      let zone = 'road', surface = rt.surface;
      if (rt.median && al < rt.median) { zone = 'median'; h += 0.15; surface = 'grass'; }
      else if (al > hw + rt.shoulder) { zone = 'walk'; h += rt.curb; surface = 'sidewalk'; }
      else if (al > hw) { zone = 'shoulder'; surface = rt.shoulderSurface; }
      out.push({ road: r, i: p.i, t: p.t, s: p.s, lat, h, zone, surface, flags: r.flags[p.i] });
    }
    // junction paving: flat at the node, sidewalks round the corners
    for (const n of this.junctionsNear(x, z, this._jn || (this._jn = []))) {
      const inPave = pointInConvex(n.poly, x, z);
      if (inPave) { out.push({ node: n, h: n.y, zone: 'road', surface: 'road', flags: 0 }); continue; }
      const d = Math.hypot(x - n.x, z - n.z);
      if (d < n.reach) {
        const walk = Math.max(...n.ends.map((e) => e.road.rt.walk));
        if (walk > 0) out.push({ node: n, h: n.y + 0.15, zone: 'walk', surface: 'sidewalk', flags: 0 });
      }
    }
    return out;
  }

  /** Nearest road sample to (x, z): { road, i, d } or null (within rad). */
  nearest(x, z, rad = 400) {
    let best = null;
    for (let R = 40; R <= rad; R *= 2) {
      const near = this.near(x, z, R, this._nn || (this._nn = new Map()));
      for (const [r, i] of near) {
        const d = Math.hypot(r.X[i] - x, r.Z[i] - z);
        if (!best || d < best.d) best = { road: r, i, d };
      }
      if (best) return best;
    }
    return best;
  }

  /**
   * Grade the terrain to the roads: for a grid (n×n verts, spacing res, from
   * x0,z0) find, per vertex, the nearest road corridor's distance past its
   * edge (D), the road level there (Y) and the road type's blend (B). Bridges,
   * elevated decks and tunnels leave the ground alone.
   */
  stamp(x0, z0, n, res, D, Y, B) {
    const ext = (n - 1) * res;
    const pad = 70;
    const c0 = Math.floor((x0 - pad) / IDX), c1 = Math.floor((x0 + ext + pad) / IDX);
    const d0 = Math.floor((z0 - pad) / IDX), d1 = Math.floor((z0 + ext + pad) / IDX);
    const seen = this._seen || (this._seen = new Set());
    seen.clear();
    for (let cx = c0; cx <= c1; cx++) {
      for (let cz = d0; cz <= d1; cz++) {
        const a = this.grid.get(KEY(cx + 32768, cz + 32768));
        if (!a) continue;
        for (let k = 0; k < a.length; k += 2) {
          const r = this.roads[a[k]], i = a[k + 1];
          const id = r.ri * 100000 + i;
          if (seen.has(id)) continue;
          seen.add(id);
          if (r.flags[i] & (F_BRIDGE | F_TUNNEL | F_ELEV)) continue;
          const rt = r.rt;
          const core = rt.hw + rt.shoulder + rt.walk + 0.6;
          const reach = core + (r.spec.blend ?? rt.blend);
          const x = r.X[i], z = r.Z[i];
          const lx = r.LX[i], lz = r.LZ[i], tx = r.TX[i], tz = r.TZ[i];
          const i0 = Math.max(0, Math.floor((x - reach - x0) / res)), i1 = Math.min(n - 1, Math.ceil((x + reach - x0) / res));
          const j0 = Math.max(0, Math.floor((z - reach - z0) / res)), j1 = Math.min(n - 1, Math.ceil((z + reach - z0) / res));
          if (i0 > i1 || j0 > j1) continue;
          const half = r.step * 0.62;
          const yc = r.Y[i] - 0.12;
          const bk = Math.tan(r.B[i]);
          for (let jj = j0; jj <= j1; jj++) {
            const vz = z0 + jj * res - z;
            for (let ii = i0; ii <= i1; ii++) {
              const vx = x0 + ii * res - x;
              const lon = vx * tx + vz * tz;
              if (lon > half || lon < -half) continue;
              const lat = vx * lx + vz * lz;
              const al = lat < 0 ? -lat : lat;
              if (al > reach) continue;
              const d = al - core;
              const kk = jj * n + ii;
              if (d < D[kk]) {
                D[kk] = d;
                const cl = lat > rt.hw ? rt.hw : lat < -rt.hw ? -rt.hw : lat;
                Y[kk] = yc + cl * bk;
                B[kk] = r.spec.blend ?? rt.blend;
              }
            }
          }
        }
      }
    }
  }
}

function pointInConvex(poly, x, z) {
  // works for any simple polygon (even-odd)
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i][0], zi = poly[i][1], xj = poly[j][0], zj = poly[j][1];
    if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside;
  }
  return inside;
}
