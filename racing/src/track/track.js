// Track: the centerline plus everything physics/AI/race logic ask of it —
// projection onto the road, heights with banking, surfaces, walls, racing line.
import { buildCenterline, interpAnchors, smoothArray } from './path.js';
import { clamp } from '../core/util.js';

export class Track {
  /**
   * def: track definition (see tracks.js). terrain (optional, set later by the
   * builder): { heightAt(x,z), normalAt(x,z) } for off-road ground.
   */
  constructor(def) {
    this.def = def;
    const c = buildCenterline(def);
    Object.assign(this, { X: c.X, Z: c.Z, K: c.K, S: c.S, N: c.N, length: c.length, closed: c.closed, step: c.step });
    const N = this.N;
    const pts = def.points;
    // per-vertex elevation and half-width
    this.Y = interpAnchors(c.anchorS, pts.map((p) => p[3]), c.length, c.closed, N, c.step, def.y ?? 0);
    this.W = interpAnchors(c.anchorS, pts.map((p) => (p[4] !== undefined ? p[4] : null)), c.length, c.closed, N, c.step, (def.width ?? 14) / 2);
    if (def.elevation) this.applyProfile(def.elevation);
    this.Y = smoothArray(this.Y, 6, this.closed, 2);
    // smoothed curvature for banking + AI
    this.Ks = smoothArray(this.K, 5, this.closed, 2);
    // tangents/normals
    this.TX = new Float32Array(N); this.TZ = new Float32Array(N);
    this.LX = new Float32Array(N); this.LZ = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      const a = this.idx(i - 1), b = this.idx(i + 1);
      let tx = this.X[b] - this.X[a], tz = this.Z[b] - this.Z[a];
      if (!this.closed && i === 0) { tx = this.X[1] - this.X[0]; tz = this.Z[1] - this.Z[0]; }
      if (!this.closed && i === N - 1) { tx = this.X[N - 1] - this.X[N - 2]; tz = this.Z[N - 1] - this.Z[N - 2]; }
      const l = Math.hypot(tx, tz) || 1;
      this.TX[i] = tx / l; this.TZ[i] = tz / l;
      this.LX[i] = this.TZ[i]; this.LZ[i] = -this.TX[i];
    }
    // banking: + raises the left edge. Corners bank into the turn on circuits.
    const bankScale = def.bank ?? (def.env === 'circuit' ? 1 : 0.35);
    const B = new Float32Array(N);
    for (let i = 0; i < N; i++) B[i] = clamp(-this.Ks[i] * 6 * bankScale, -0.09, 0.09);
    this.B = smoothArray(B, 10, this.closed, 2);
    // walls (lateral distance from centerline) — env builders may override
    const wallPad = def.wall ?? 6;
    this.WL = new Float32Array(N).fill(0);
    this.WR = new Float32Array(N).fill(0);
    for (let i = 0; i < N; i++) {
      this.WL[i] = this.W[i] + (def.wallL ?? wallPad);
      this.WR[i] = this.W[i] + (def.wallR ?? wallPad);
    }
    this.shoulder = def.shoulder ?? 1.2;
    this.curb = new Uint8Array(N); // 1 where curbs are painted (circuits)
    this.offSurface = def.offSurface || 'grass';
    this.terrain = null;
    this.startS = def.startS ?? (this.closed ? 40 : 30);
    // (a drag ends its distance from the line, however long the strip runs on)
    this.finishS = this.closed ? this.startS
      : def.dragLength ? Math.min(this.startS + def.dragLength, this.length - 30)
      : this.length - (def.finishPad ?? 60);
    this._buildGrid();
  }

  idx(i) {
    const N = this.N;
    if (this.closed) return ((i % N) + N) % N;
    return i < 0 ? 0 : i >= N ? N - 1 : i;
  }

  /** Override the elevation with a profile [[sFraction, y], …]. */
  applyProfile(prof) {
    const N = this.N;
    const pts = prof.map(([f, y]) => [f * this.length, y]).sort((a, b) => a[0] - b[0]);
    for (let i = 0; i < N; i++) {
      const s = i * this.step;
      let a = pts[0], b = pts[pts.length - 1];
      for (let k = 0; k < pts.length - 1; k++) if (pts[k][0] <= s && pts[k + 1][0] >= s) { a = pts[k]; b = pts[k + 1]; break; }
      if (s < pts[0][0]) { a = this.closed ? [pts[pts.length - 1][0] - this.length, pts[pts.length - 1][1]] : pts[0]; b = pts[0]; }
      if (s > pts[pts.length - 1][0]) { a = pts[pts.length - 1]; b = this.closed ? [pts[0][0] + this.length, pts[0][1]] : a; }
      const t = b[0] === a[0] ? 0 : (s - a[0]) / (b[0] - a[0]);
      const e = t * t * t * (t * (t * 6 - 15) + 10);
      this.Y[i] = a[1] + (b[1] - a[1]) * e;
    }
  }

  _buildGrid() {
    const cell = 40;
    this.cell = cell;
    let minX = Infinity, minZ = Infinity, maxX = -Infinity, maxZ = -Infinity;
    for (let i = 0; i < this.N; i++) {
      minX = Math.min(minX, this.X[i]); maxX = Math.max(maxX, this.X[i]);
      minZ = Math.min(minZ, this.Z[i]); maxZ = Math.max(maxZ, this.Z[i]);
    }
    this.bounds = { minX, minZ, maxX, maxZ };
    this.gx0 = minX - cell * 2;
    this.gz0 = minZ - cell * 2;
    this.gw = Math.ceil((maxX - minX) / cell) + 5;
    this.gh = Math.ceil((maxZ - minZ) / cell) + 5;
    this.grid = new Map();
    for (let i = 0; i < this.N; i++) {
      const k = this._key(this.X[i], this.Z[i]);
      if (!this.grid.has(k)) this.grid.set(k, []);
      this.grid.get(k).push(i);
    }
  }

  _key(x, z) {
    const cx = Math.floor((x - this.gx0) / this.cell), cz = Math.floor((z - this.gz0) / this.cell);
    return cx * 100000 + cz;
  }

  /** Nearest sample index globally (spatial grid), or -1. */
  nearestIndex(x, z, radiusCells = 2) {
    let best = -1, bd = Infinity;
    const cx = Math.floor((x - this.gx0) / this.cell), cz = Math.floor((z - this.gz0) / this.cell);
    for (let dx = -radiusCells; dx <= radiusCells; dx++) {
      for (let dz = -radiusCells; dz <= radiusCells; dz++) {
        const list = this.grid.get((cx + dx) * 100000 + (cz + dz));
        if (!list) continue;
        for (const i of list) {
          const d = (this.X[i] - x) ** 2 + (this.Z[i] - z) ** 2;
          if (d < bd) { bd = d; best = i; }
        }
      }
    }
    if (best < 0 && radiusCells < 8) return this.nearestIndex(x, z, radiusCells * 2 + 2);
    return best;
  }

  /** Distance to the nearest centerline point anywhere (for scenery placement). */
  distToRoad(x, z) {
    const i = this.nearestIndex(x, z, 1);
    if (i < 0) return Infinity;
    const lat = Math.abs((x - this.X[i]) * this.LX[i] + (z - this.Z[i]) * this.LZ[i]);
    const lon = Math.abs((x - this.X[i]) * this.TX[i] + (z - this.Z[i]) * this.TZ[i]);
    return lon > this.step * 2 ? Math.hypot(lat, lon) : lat;
  }

  /**
   * Project a point. hint = last sample index (local search) or -1 (global).
   * Returns { i, t, s, lat, x, z } — lat > 0 is left of the centerline.
   */
  project(x, z, hint = -1, out = {}) {
    let best = -1, bd = Infinity;
    if (hint >= 0) {
      for (let k = -24; k <= 40; k++) {
        const i = this.idx(hint + k);
        const d = (this.X[i] - x) ** 2 + (this.Z[i] - z) ** 2;
        if (d < bd) { bd = d; best = i; }
      }
      if (bd > 60 * 60) best = this.nearestIndex(x, z);
    } else {
      best = this.nearestIndex(x, z);
    }
    let i = best;
    // refine onto the segment i→i+1 or i-1→i
    const j = this.idx(i + 1);
    const ax = this.X[i], az = this.Z[i];
    let t = ((x - ax) * (this.X[j] - ax) + (z - az) * (this.Z[j] - az)) / (this.step * this.step);
    if (t < 0 && (this.closed || i > 0)) {
      i = this.idx(i - 1);
      const bx = this.X[i], bz = this.Z[i];
      const nx = this.X[this.idx(i + 1)], nz = this.Z[this.idx(i + 1)];
      t = ((x - bx) * (nx - bx) + (z - bz) * (nz - bz)) / (this.step * this.step);
    }
    t = clamp(t, 0, 1);
    const i2 = this.idx(i + 1);
    const px = this.X[i] + (this.X[i2] - this.X[i]) * t;
    const pz = this.Z[i] + (this.Z[i2] - this.Z[i]) * t;
    const lx = this.LX[i] + (this.LX[i2] - this.LX[i]) * t;
    const lz = this.LZ[i] + (this.LZ[i2] - this.LZ[i]) * t;
    out.i = i;
    out.t = t;
    out.s = this.S[i] + t * this.step;
    out.lat = (x - px) * lx + (z - pz) * lz;
    out.x = px;
    out.z = pz;
    return out;
  }

  /** Interpolated per-sample value. */
  lerpArr(arr, i, t) {
    const j = this.idx(i + 1);
    return arr[i] + (arr[j] - arr[i]) * t;
  }

  /** Road surface height at (projection, lateral). */
  roadY(i, t, lat) {
    return this.lerpArr(this.Y, i, t) + lat * Math.tan(this.lerpArr(this.B, i, t));
  }

  /** Ground query for physics: {h, n, surface, lat, i}. */
  ground(x, z, hint, out = {}) {
    const p = this.project(x, z, hint, this._pq || (this._pq = {}));
    const w = this.lerpArr(this.W, p.i, p.t);
    const alat = Math.abs(p.lat);
    const edge = w + this.shoulder;
    let h, surface;
    if (alat <= w) {
      h = this.roadY(p.i, p.t, p.lat);
      surface = 'road';
    } else if (alat <= edge) {
      h = this.roadY(p.i, p.t, Math.sign(p.lat) * w) + (this.def.shoulderLift ?? 0);
      surface = this.curb[p.i] ? 'curb' : (this.def.shoulderSurface || this.offSurface);
    } else {
      const roadEdge = this.roadY(p.i, p.t, Math.sign(p.lat) * w);
      const th = this.terrain ? this.terrain.heightAt(x, z) : roadEdge;
      // blend road-edge height into terrain over a few meters
      const k = clamp((alat - edge) / 6, 0, 1);
      h = roadEdge + (th - roadEdge) * k;
      surface = this.offSurface;
    }
    // normal from slope + bank (road) — cheap finite difference
    const i = p.i, j = this.idx(i + 1);
    const dy = (this.Y[j] - this.Y[i]) / this.step;
    const bank = alat <= edge ? this.lerpArr(this.B, p.i, p.t) : 0;
    const tx = this.TX[i], tz = this.TZ[i];
    const lx = this.LX[i], lz = this.LZ[i];
    // n ≈ up − slope·t − tan(bank)·l
    let nx = -dy * tx - Math.tan(bank) * lx;
    let nz = -dy * tz - Math.tan(bank) * lz;
    let ny = 1;
    if (alat > edge + 2 && this.terrain?.normalAt) {
      const tn = this.terrain.normalAt(x, z);
      nx = tn[0] / tn[1]; nz = tn[2] / tn[1]; ny = 1;
    }
    const l = Math.hypot(nx, ny, nz);
    out.h = h;
    out.n = [nx / l, ny / l, nz / l];
    out.surface = surface;
    out.lat = p.lat;
    out.i = p.i;
    out.s = p.s;
    out.w = w;
    return out;
  }

  /** World position + heading at distance s and lateral offset. */
  posAt(s, lat = 0) {
    let ss = s;
    if (this.closed) ss = ((s % this.length) + this.length) % this.length;
    else ss = clamp(s, 0, this.length - 0.01);
    const f = ss / this.step;
    const i = this.idx(Math.floor(f));
    const t = f - Math.floor(f);
    const j = this.idx(i + 1);
    const x = this.X[i] + (this.X[j] - this.X[i]) * t + this.lerpArr(this.LX, i, t) * lat;
    const z = this.Z[i] + (this.Z[j] - this.Z[i]) * t + this.lerpArr(this.LZ, i, t) * lat;
    const tx = this.lerpArr(this.TX, i, t), tz = this.lerpArr(this.TZ, i, t);
    return { x, z, y: this.roadY(i, t, lat), heading: Math.atan2(tx, tz), i, t };
  }

  /** Signed progress difference b − a along the loop (handles wrap). */
  deltaS(a, b) {
    let d = b - a;
    if (this.closed) {
      if (d > this.length / 2) d -= this.length;
      if (d < -this.length / 2) d += this.length;
    }
    return d;
  }

  /**
   * Racing line: lateral offset per sample minimizing curvature inside the
   * road (iterative relaxation), plus a target speed profile for the AI.
   */
  computeRacingLine(mu = 1.15) {
    const N = this.N;
    const off = new Float32Array(N);
    const margin = 1.6;
    const px = new Float32Array(N), pz = new Float32Array(N);
    for (let iter = 0; iter < 140; iter++) {
      for (let i = 0; i < N; i++) {
        px[i] = this.X[i] + this.LX[i] * off[i];
        pz[i] = this.Z[i] + this.LZ[i] * off[i];
      }
      for (let i = 0; i < N; i++) {
        if (!this.closed && (i < 2 || i > N - 3)) continue;
        const a = this.idx(i - 2), b = this.idx(i + 2);
        const mx = (px[a] + px[b]) / 2, mz = (pz[a] + pz[b]) / 2;
        // move toward the chord midpoint (straightens the path)
        const d = (mx - px[i]) * this.LX[i] + (mz - pz[i]) * this.LZ[i];
        const lim = Math.max(0, this.W[i] - margin);
        off[i] = clamp(off[i] + d * 0.55, -lim, lim);
      }
    }
    const offS = smoothArray(off, 3, this.closed, 2);
    // curvature of the line
    const lx = new Float32Array(N), lz = new Float32Array(N);
    for (let i = 0; i < N; i++) { lx[i] = this.X[i] + this.LX[i] * offS[i]; lz[i] = this.Z[i] + this.LZ[i] * offS[i]; }
    const curv = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      const a = this.idx(i - 3), b = this.idx(i + 3);
      const ax = lx[i] - lx[a], az = lz[i] - lz[a];
      const bx = lx[b] - lx[i], bz = lz[b] - lz[i];
      const la = Math.hypot(ax, az) || 1, lb = Math.hypot(bx, bz) || 1;
      const cross = (ax * bz - az * bx) / (la * lb);
      curv[i] = Math.abs(Math.asin(clamp(cross, -1, 1))) / ((la + lb) / 2);
    }
    const curvS = smoothArray(curv, 3, this.closed, 1);
    // speed profile: v = sqrt(mu g / k), then braking/accel passes
    const vmax = new Float32Array(N);
    for (let i = 0; i < N; i++) vmax[i] = Math.min(95, Math.sqrt(mu * 9.81 / Math.max(1e-4, curvS[i])));
    const decel = 9.81 * mu * 0.82;
    for (let pass = 0; pass < (this.closed ? 2 : 1); pass++) {
      for (let k = N - 1; k >= 0; k--) {
        const i = k, j = this.idx(i + 1);
        if (!this.closed && i === N - 1) continue;
        // downhill eats into braking, uphill helps
        const grade = (this.Y[j] - this.Y[i]) / this.step;
        const dec = Math.max(2.5, decel + 9.81 * grade);
        vmax[i] = Math.min(vmax[i], Math.sqrt(vmax[j] * vmax[j] + 2 * dec * this.step));
      }
    }
    this.line = { off: offS, speed: vmax, curv: curvS };
    return this.line;
  }
}
