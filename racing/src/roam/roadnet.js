// FREE ROAM physics on a network of roads: the region's own road plus the
// short stubs that join it to the tunnels (a side road off a circuit, the
// two bores of a portal, a road running on past the end of a sprint). The
// drivable area is the union of the roads' corridors — a point is only "in
// the wall" when it is outside every one of them — and the ground comes
// from whichever road the car is on.
import { Track } from '../track/track.js';
import { clamp, smoothstep } from '../core/util.js';

/**
 * A stub road. Near its start the surface follows the road it leaves
 * (extended sideways from that road's edge), easing into its own level
 * profile over `blend` metres — so a side road meets a sloping main road
 * without a step.
 */
export class StubTrack extends Track {
  constructor(def, main = null, blend = null) {
    super(def);
    // a width that varies along the stub (a flared mouth), walls with it
    if (def.widthFn) {
      for (let i = 0; i < this.N; i++) {
        this.W[i] = def.widthFn(this.S[i]);
        this.WL[i] = this.W[i] + (def.wallL ?? def.wall ?? 6);
        this.WR[i] = this.W[i] + (def.wallR ?? def.wall ?? 6);
      }
    }
    this.main = main;
    this.blend = blend;   // { d0, d1 } — follow the main road before d0, own level after d1
    this._mh = -1;
    this._mp = {};
  }

  roadY(i, t, lat) {
    const own = super.roadY(i, t, lat);
    const B = this.blend;
    if (!B || !this.main) return own;
    const s = this.S[i] + t * this.step;
    const k = smoothstep(B.d0, B.d1, s);
    if (k >= 1) return own;
    const j = this.idx(i + 1);
    const x = this.X[i] + (this.X[j] - this.X[i]) * t + this.LX[i] * lat;
    const z = this.Z[i] + (this.Z[j] - this.Z[i]) * t + this.LZ[i] * lat;
    const M = this.main;
    const p = M.project(x, z, this._mh, this._mp);
    this._mh = p.i;
    const w = M.lerpArr(M.W, p.i, p.t);
    const my = M.roadY(p.i, p.t, clamp(p.lat, -w, w));
    return my + (own - my) * k;
  }
}

/** Could (x, z) be inside this road's walls? (its centreline's box, out to the farthest wall) */
const near = (T, x, z) => {
  if (T._reach === undefined) {
    let m = 0;
    for (let i = 0; i < T.N; i++) m = Math.max(m, T.WL[i], T.WR[i]);
    T._reach = m + 6;
  }
  const b = T.bounds, pad = T._reach;
  return x > b.minX - pad && x < b.maxX + pad && z > b.minZ - pad && z < b.maxZ + pad;
};

/** Is (x, z) past either end of an open road (its projection clamped)? */
export function pastEnd(T, p, x, z) {
  if (T.closed) return false;
  if (p.i === 0 && p.t <= 0) {
    return (x - T.X[0]) * T.TX[0] + (z - T.Z[0]) * T.TZ[0] < -0.05;
  }
  const n = T.N - 1;
  if (p.i >= n - 1 && p.t >= 1) {
    return (x - T.X[n]) * T.TX[n] + (z - T.Z[n]) * T.TZ[n] > 0.05;
  }
  return false;
}

export class RoadNet {
  /** main: the region's Track; stubs: StubTracks in the same frame. */
  constructor(main, stubs = []) {
    this.main = main;
    this.roads = [main, ...stubs];
    this._p = {};
  }

  /** Per-racer road state (hint per road, the road it's on). */
  state(r) {
    if (!r.net || r.net.n !== this.roads.length) r.net = { n: this.roads.length, hints: this.roads.map(() => -1), road: 0 };
    return r.net;
  }

  /** Ground under (x, z) for racer r — physics' env.ground. */
  ground(r, x, z, out = {}) {
    const st = this.state(r);
    const R = this.roads;
    let pick = -1, bestOver = Infinity;
    for (let n = 0; n < R.length; n++) {
      const k = n === 0 ? st.road : (n <= st.road ? n - 1 : n);
      const T = R[k];
      if (!near(T, x, z)) continue;
      const p = T.project(x, z, st.hints[k], this._p);
      st.hints[k] = p.i;
      if (pastEnd(T, p, x, z)) continue;
      const w = T.lerpArr(T.W, p.i, p.t);
      const over = Math.abs(p.lat) - w;
      if (over <= 0) { pick = k; break; }
      if (over < bestOver) { bestOver = over; pick = k; }
    }
    if (pick < 0) pick = st.road;
    st.road = pick;
    const T = R[pick];
    const g = T.ground(x, z, st.hints[pick], out);
    st.hints[pick] = g.i;
    g.road = pick;
    return g;
  }

  /**
   * How far (x, z) is into a wall: 0 inside any road's corridor, else the
   * smallest overshoot and the push-out normal from that road. lost: no road
   * anywhere near (nothing to push against: the reset brings the car back).
   */
  wallAt(r, x, z, res) {
    const st = this.state(r);
    const R = this.roads;
    let worst = Infinity, nx = 0, nz = 0;
    for (let k = 0; k < R.length; k++) {
      const T = R[k];
      if (!near(T, x, z)) continue;
      const p = T.project(x, z, st.hints[k], this._p);
      if (pastEnd(T, p, x, z)) continue;
      const i = p.i;
      const wl = T.lerpArr(T.WL, i, p.t), wr = T.lerpArr(T.WR, i, p.t);
      if (p.lat <= wl && p.lat >= -wr) { res.over = 0; return res; }
      const o = p.lat > wl ? p.lat - wl : -wr - p.lat;
      if (o < worst) {
        worst = o;
        const sgn = p.lat > wl ? -1 : 1;
        nx = T.LX[i] * sgn; nz = T.LZ[i] * sgn;
      }
    }
    res.lost = worst === Infinity;
    res.over = res.lost ? 0 : worst;
    res.nx = nx; res.nz = nz;
    return res;
  }

  /** Keep a car inside the network (sim.walls for the union of roads). */
  walls(sim, r) {
    const v = r.vehicle;
    const [fx, fz] = v.fwd;
    const [lx, lz] = v.left;
    const hl = r.dims.L / 2 - 0.05, hw = r.dims.W / 2 - 0.02;
    const res = this._w || (this._w = {});
    let worst = 0, wn = null, wc = null, wp = null;
    for (const [a, b] of [[hl, hw], [hl, -hw], [-hl, hw], [-hl, -hw], [0, hw], [0, -hw]]) {
      const x = v.x + fx * a + lx * b, z = v.z + fz * a + lz * b;
      this.wallAt(r, x, z, res);
      if (res.over > worst) { worst = res.over; wn = [res.nx, res.nz]; wc = [a, b]; wp = [x, z]; }
    }
    if (wn) {
      const impact = v.hitWall(wn[0], wn[1], worst, wc);
      r.scraping = true;
      r.scrapePoint = wp;
      if (impact > 2) sim.emit('wallhit', { id: r.id, impact, x: wp[0], z: wp[1], y: v.y });
    } else {
      r.scraping = false;
    }
  }

  /** Nearest point on any road: { road, s, lat, over } (for resets). */
  nearest(x, z) {
    let best = null;
    for (let k = 0; k < this.roads.length; k++) {
      const T = this.roads[k];
      const p = T.project(x, z, -1, {});
      if (!Number.isFinite(p.s) || !Number.isFinite(p.lat)) continue;   // (too far from it to say)
      const w = T.lerpArr(T.W, p.i, p.t);
      const over = Math.max(0, Math.abs(p.lat) - w) + (pastEnd(T, p, x, z) ? 50 : 0);
      if (!best || over < best.over) best = { road: k, s: p.s, lat: p.lat, over, i: p.i };
    }
    return best || { road: 0, s: this.main.startS, lat: 0, over: 0, i: 0 };
  }
}
