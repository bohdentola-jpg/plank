// Seating bowls. A rounded-rectangle path around the field (straight sides,
// round corners) is offset outward row by row; each tier is stepped concrete
// (treads + risers), seat-back strips broken by aisles and vomitories, a
// front wall / fascia, a back wall, the exterior and an optional roof
// canopy. Tiers return seat positions for the crowd.
//
// Path parameter s is arclength along the BASE curve, starting at the +x
// side (x = ax, z = -(az - R)) and running +z (the field is on the left).
import * as THREE from 'three';
import { V3 } from './kit.js';

export class RRPath {
  constructor(ax, az, R) {
    R = Math.min(R, ax - 0.01, az - 0.01);
    this.ax = ax; this.az = az; this.R = R;
    const hx = ax - R, hz = az - R;
    const H = Math.PI / 2;
    this.segs = [
      { name: 'px', kind: 'line', a: [ax, -hz], b: [ax, hz], n: [1, 0] },
      { name: 'c1', kind: 'arc', c: [hx, hz], t0: 0, t1: H },
      { name: 'pz', kind: 'line', a: [hx, az], b: [-hx, az], n: [0, 1] },
      { name: 'c2', kind: 'arc', c: [-hx, hz], t0: H, t1: 2 * H },
      { name: 'nx', kind: 'line', a: [-ax, hz], b: [-ax, -hz], n: [-1, 0] },
      { name: 'c3', kind: 'arc', c: [-hx, -hz], t0: 2 * H, t1: 3 * H },
      { name: 'nz', kind: 'line', a: [-hx, -az], b: [hx, -az], n: [0, -1] },
      { name: 'c4', kind: 'arc', c: [hx, -hz], t0: 3 * H, t1: 4 * H },
    ];
    let s = 0;
    for (const g of this.segs) {
      g.len = g.kind === 'line' ? Math.hypot(g.b[0] - g.a[0], g.b[1] - g.a[1]) : R * (g.t1 - g.t0);
      g.s0 = s; s += g.len; g.s1 = s;
    }
    this.P = s;
  }
  /** [s0, s1] of a named segment (or of a run of names, in path order, may wrap). */
  range(...names) {
    const segs = names.map((n) => this.segs.find((g) => g.name === n));
    let s0 = segs[0].s0, s1 = segs[segs.length - 1].s1;
    if (s1 <= s0) s1 += this.P;
    return [s0, s1];
  }
  seg(s) {
    s = ((s % this.P) + this.P) % this.P;
    for (const g of this.segs) if (s <= g.s1 + 1e-6) return [g, s - g.s0];
    return [this.segs[this.segs.length - 1], 0];
  }
  /** Point at base arclength s, offset d outward → { x, z, nx, nz } */
  at(s, d = 0) {
    const [g, u] = this.seg(s);
    if (g.kind === 'line') {
      const t = g.len > 0 ? u / g.len : 0;
      return { x: g.a[0] + (g.b[0] - g.a[0]) * t + g.n[0] * d, z: g.a[1] + (g.b[1] - g.a[1]) * t + g.n[1] * d, nx: g.n[0], nz: g.n[1] };
    }
    const th = g.t0 + (u / g.len) * (g.t1 - g.t0);
    const nx = Math.cos(th), nz = Math.sin(th);
    return { x: g.c[0] + nx * (this.R + d), z: g.c[1] + nz * (this.R + d), nx, nz };
  }
  /** Sample s values over [s0, s1] (s1 may exceed P to wrap): segment ends + subdivisions. */
  samples(s0, s1, step = 6, arcStep = 0.11) {
    const bounds = [];
    for (let k = -1; k <= 2; k++) {
      for (const g of this.segs) {
        const b = g.s0 + k * this.P;
        if (b > s0 + 1e-6 && b < s1 - 1e-6) bounds.push(b);
      }
    }
    bounds.sort((a, b) => a - b);
    const knots = [s0, ...bounds, s1];
    const out = [s0];
    for (let i = 0; i < knots.length - 1; i++) {
      const a = knots[i], b = knots[i + 1];
      const [g] = this.seg((a + b) / 2);
      const st = g.kind === 'line' ? step : Math.max(0.5, this.R * arcStep);
      const n = Math.max(1, Math.ceil((b - a) / st - 1e-6));
      for (let k = 1; k <= n; k++) out.push(a + ((b - a) * k) / n);
    }
    return out;
  }
}

/** A row polyline at offset d: points with base s, cumulative length and normals. */
function polyline(path, ss, d) {
  const pts = [];
  let L = 0;
  for (let i = 0; i < ss.length; i++) {
    const p = path.at(ss[i], d);
    if (i) L += Math.hypot(p.x - pts[i - 1].x, p.z - pts[i - 1].z);
    pts.push({ ...p, s: ss[i], L });
  }
  return pts;
}

function interp(pts, L) {
  let lo = 0, hi = pts.length - 1;
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (pts[m].L <= L) lo = m; else hi = m; }
  const a = pts[lo], b = pts[hi];
  const t = b.L > a.L ? (L - a.L) / (b.L - a.L) : 0;
  const nx = a.nx + (b.nx - a.nx) * t, nz = a.nz + (b.nz - a.nz) * t;
  const nl = Math.hypot(nx, nz) || 1;
  return { x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t, nx: nx / nl, nz: nz / nl, s: a.s + (b.s - a.s) * t };
}

/** Inward-facing vertical strip along the path at offset d (y0..y1). */
export function ringWall(gb, path, ss, d, y0, y1, opts = {}) {
  const pts = polyline(path, ss, d);
  const uS = opts.uScale || 4, vS = opts.vScale || 4;
  const out = !!opts.outward;
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], b = pts[i + 1];
    const ya0 = typeof y0 === 'function' ? y0(a.s) : y0, yb0 = typeof y0 === 'function' ? y0(b.s) : y0;
    const ya1 = typeof y1 === 'function' ? y1(a.s) : y1, yb1 = typeof y1 === 'function' ? y1(b.s) : y1;
    const u0 = (opts.u0 || 0) + a.L / uS, u1 = (opts.u0 || 0) + b.L / uS;
    const v0 = opts.vFit ? 0 : ya0 / vS, v1 = opts.vFit ? 1 : ya1 / vS;
    if (!out) gb.quad(V3(a.x, ya0, a.z), V3(b.x, yb0, b.z), V3(b.x, yb1, b.z), V3(a.x, ya1, a.z), [u0, v0, u1, v1]);
    else gb.quad(V3(b.x, yb0, b.z), V3(a.x, ya0, a.z), V3(a.x, ya1, a.z), V3(b.x, yb1, b.z), [u1, v0, u0, v1]);
  }
  return pts[pts.length - 1].L;
}

/** Horizontal strip between offsets d0 (inner) and d1 (outer) at height y (faces up, or down with opts.down). */
export function ringFlat(gb, path, ss, d0, d1, y, opts = {}) {
  const a0 = polyline(path, ss, d0), a1 = polyline(path, ss, d1);
  const uS = opts.uScale || 4;
  for (let i = 0; i < ss.length - 1; i++) {
    const p = a0[i], q = a0[i + 1], r = a1[i + 1], t = a1[i];
    const yy = (k) => (typeof y === 'function' ? y(k) : y);
    const A = V3(p.x, yy(0), p.z), B = V3(q.x, yy(0), q.z), C = V3(r.x, yy(1), r.z), D = V3(t.x, yy(1), t.z);
    const uv = [p.L / uS, 0, q.L / uS, (d1 - d0) / uS];
    if (!opts.down) gb.quad(A, B, C, D, uv); else gb.quad(B, A, D, C, uv);
  }
}

/**
 * Build one tier of seating.
 * B: Batches. spec: {
 *   s0, s1, d0, rows, depth, h0, rise, riseGrow,
 *   concrete: 'concrete', tint: [r,g,b], seats: 'seats'|'bench'|null, seatColor(s, r) → hex,
 *   spacing, aisleEvery, aisleW, vom: { every, row, rows, w },
 *   group(s, r), want(s, r), light(r),
 *   front: { y0, rail }, back: { h }, exterior: true, roof: { depth, h, key }
 * }
 * Returns { seats, top, dEnd, hAt(r) }.
 */
export function buildTier(B, path, spec) {
  const ss = path.samples(spec.s0, spec.s1, spec.step || 6);
  const rows = spec.rows, depth = spec.depth || 0.95;
  const rise0 = spec.rise || 0.45, grow = spec.riseGrow || 0;
  const hAt = (r) => spec.h0 + r * rise0 + grow * r * r * 0.5;
  const dAt = (r) => spec.d0 + r * depth;
  const conc = B.get(spec.concrete || 'concrete');
  const tint = spec.tint || [0.78, 0.77, 0.74];
  const lightAt = spec.light || (() => 1);
  // ---- steps
  for (let r = 0; r < rows; r++) {
    const h = hAt(r), hPrev = r ? hAt(r - 1) : (spec.front?.y0 ?? spec.h0 - 1);
    const lk = 0.75 + 0.25 * lightAt(r);
    conc.setColor(tint[0] * lk, tint[1] * lk, tint[2] * lk);
    // riser at the front of row r
    ringWall(conc, path, ss, dAt(r), hPrev, h, { uScale: 4, vScale: 4 });
    // tread
    conc.setColor(tint[0] * lk * 1.06, tint[1] * lk * 1.06, tint[2] * lk * 1.06);
    ringFlat(conc, path, ss, dAt(r), dAt(r + 1), h);
  }
  const top = hAt(rows - 1);
  const dEnd = dAt(rows);
  // ---- back wall + exterior + cap
  const backH = spec.back?.h ?? 2.2;
  conc.setColor(tint[0] * 0.85, tint[1] * 0.85, tint[2] * 0.85);
  ringWall(conc, path, ss, dEnd, top, top + backH);
  if (spec.exterior !== false) {
    const ext = B.get(spec.exteriorKey || spec.concrete || 'concrete');
    ext.setColor(...(spec.exteriorTint || tint.map((v) => v * 0.8)));
    ringWall(ext, path, ss, dEnd + 0.6, spec.exteriorFrom ?? 0, top + backH, { outward: true, uScale: spec.exteriorU || 4, vScale: spec.exteriorV || 4 });
    conc.setColor(tint[0] * 0.9, tint[1] * 0.9, tint[2] * 0.9);
    ringFlat(conc, path, ss, dEnd, dEnd + 0.6, top + backH);
    // ends of an open tier
    if (spec.s1 - spec.s0 < path.P - 0.01) {
      for (const s of [spec.s0, spec.s1]) {
        const a = path.at(s, spec.d0 - 0.3), b = path.at(s, dEnd + 0.6);
        const lo = spec.exteriorFrom ?? 0;
        const first = s === spec.s0;
        const A = V3(a.x, lo, a.z), Bv = V3(b.x, lo, b.z), C = V3(b.x, top + backH, b.z), D = V3(a.x, hAt(0) + 0.8, a.z);
        if (first) conc.quad(Bv, A, D, C, [0, 0, (dEnd - spec.d0) / 4, (top + backH) / 4]);
        else conc.quad(A, Bv, C, D, [0, 0, (dEnd - spec.d0) / 4, (top + backH) / 4]);
      }
    }
  }
  // ---- front wall + rail cap
  if (spec.front) {
    const fy0 = spec.front.y0 ?? 0;
    const fk = spec.front.key || spec.concrete || 'concrete';
    const fw = B.get(fk);
    fw.setColor(...(spec.front.tint || tint));
    ringWall(fw, path, ss, spec.d0 - 0.02, fy0, hAt(0) + (spec.front.rail ?? 0.35), { uScale: spec.front.uScale || 4, vScale: spec.front.vScale || 4, vFit: !!spec.front.vFit });
    conc.setColor(tint[0], tint[1], tint[2]);
    ringFlat(conc, path, ss, spec.d0 - 0.3, spec.d0, hAt(0) + (spec.front.rail ?? 0.35));
  }
  // ---- seats + fans
  const seats = [];
  if (spec.seats) {
    const sb = B.get(spec.seats === 'bench' ? 'alu' : 'seats');
    const sp = spec.spacing || 0.55;
    const per = spec.aisleEvery || 22;
    const aw = spec.aisleW || 1.1;
    const period = per * sp + aw;
    const vom = spec.vom;
    const col = new THREE.Color();
    for (let r = 0; r < rows; r++) {
      const h = hAt(r);
      const dSeat = dAt(r) + depth * 0.72;
      const pts = polyline(path, ss, dSeat);
      const L = pts[pts.length - 1].L;
      const inVom = (s) => {
        if (!vom || r < vom.row || r >= vom.row + vom.rows) return false;
        const k = Math.round((s - spec.s0 - vom.offset) / vom.every);
        const c = spec.s0 + vom.offset + k * vom.every;
        return Math.abs(s - c) < vom.w / 2 && c > spec.s0 + 2 && c < spec.s1 - 2;
      };
      for (let p0 = 0; p0 < L; p0 += period) {
        const run0 = p0, run1 = Math.min(L, p0 + per * sp);
        // seat-back strip pieces between polyline vertices
        let k = 0;
        while (k < pts.length - 1 && pts[k + 1].L <= run0) k++;
        let a = run0;
        while (a < run1 - 1e-4 && k < pts.length - 1) {
          const b = Math.min(run1, pts[k + 1].L);
          const A = interp(pts, a), Bp = interp(pts, b);
          const sMid = (A.s + Bp.s) / 2;
          if (!inVom(sMid) && b - a > 0.05) {
            if (spec.seats === 'bench') {
              sb.setColor(...(spec.benchTint || [0.85, 0.85, 0.85]));
              const back = 0.3;
              sb.quad(V3(A.x, h + 0.42, A.z), V3(Bp.x, h + 0.42, Bp.z), V3(Bp.x + Bp.nx * back, h + 0.42, Bp.z + Bp.nz * back), V3(A.x + A.nx * back, h + 0.42, A.z + A.nz * back), [a / 3, 0, b / 3, 1]);
            } else {
              col.set(spec.seatColor ? spec.seatColor(sMid, r) : '#2a4a8a');
              sb.setColor(col.r, col.g, col.b);
              const u0 = (a - p0) / sp, u1 = (b - p0) / sp;
              sb.quad(V3(A.x, h + 0.12, A.z), V3(Bp.x, h + 0.12, Bp.z), V3(Bp.x, h + 0.58, Bp.z), V3(A.x, h + 0.58, A.z), [u0, 0, u1, 1]);
            }
          }
          a = b;
          if (b >= pts[k + 1].L - 1e-6) k++;
        }
        // fans: one per seat in the run
        for (let q = 0; q < per; q++) {
          const at = p0 + (q + 0.5) * sp;
          if (at > run1) break;
          const P = interp(pts, at);
          if (inVom(P.s)) continue;
          const inward = depth * 0.27;
          seats.push({
            p: V3(P.x - P.nx * inward, h, P.z - P.nz * inward),
            s: P.s, row: r, group: spec.group ? spec.group(P.s, r) : 'home',
            want: spec.want ? spec.want(P.s, r) : 0.5, light: lightAt(r),
            sec: Math.floor((P.s - spec.s0) / (period * 2)),
          });
        }
      }
    }
    // vomitory portals
    if (vom) {
      const dark = B.get('dark');
      dark.setColor(0.02, 0.02, 0.025);
      const r1 = vom.row + vom.rows;
      for (let c = spec.s0 + vom.offset; c < spec.s1 - 2; c += vom.every) {
        if (c < spec.s0 + 2) continue;
        const a = path.at(c - vom.w / 2, dAt(r1) - 0.02), b = path.at(c + vom.w / 2, dAt(r1) - 0.02);
        const y0 = hAt(vom.row) - 0.1, y1 = hAt(r1) + 0.1;
        dark.quad(V3(a.x, y0, a.z), V3(b.x, y0, b.z), V3(b.x, y1, b.z), V3(a.x, y1, a.z));
        // side walls of the cut
        conc.setColor(tint[0] * 0.8, tint[1] * 0.8, tint[2] * 0.8);
        for (const [sx, flip] of [[c - vom.w / 2, false], [c + vom.w / 2, true]]) {
          const f = path.at(sx, dAt(vom.row)), g = path.at(sx, dAt(r1));
          const yA = hAt(vom.row) + 0.6, yB = hAt(r1) + 0.6;
          const P0 = V3(f.x, hAt(vom.row) - 0.1, f.z), P1 = V3(g.x, hAt(vom.row) - 0.1, g.z), P2 = V3(g.x, yB, g.z), P3 = V3(f.x, yA, f.z);
          if (flip) conc.quad(P1, P0, P3, P2); else conc.quad(P0, P1, P2, P3);
        }
      }
    }
  }
  // ---- roof canopy
  if (spec.roof) {
    const R = spec.roof;
    const rk = B.get(R.key || 'metalDS');
    rk.setColor(...(R.tint || [0.55, 0.57, 0.6]));
    const yb = top + backH + (R.h || 4), yf = yb + (R.rise ?? 1.2);
    const dF = dEnd - R.depth, dB = dEnd + 0.8;
    // underside + top as one double-sided sheet, sloped up toward the field
    ringFlat(rk, path, ss, dF, dB, (k) => (k ? yb : yf), { down: true, uScale: 6 });
    // fascia at the front edge
    const fz = B.get(R.fasciaKey || 'paint');
    fz.setColor(...(R.fascia || [0.85, 0.86, 0.88]));
    ringWall(fz, path, ss, dF, yf - (R.fasciaH ?? 1.4), yf + 0.2, { vFit: true, uScale: R.fasciaU || 8 });
    // columns at the back
    const colB = B.get('metal');
    colB.setColor(0.5, 0.52, 0.55);
    for (const s of path.samples(spec.s0, spec.s1, R.colEvery || 18)) {
      const p = path.at(s, dEnd + 0.4);
      colB.box(p.x, top, p.z, 0.4, yb - top, 0.4, 0, {});
    }
    spec.roofEdge = { d: dF, y: yf };
  }
  return { seats, top, dEnd, hAt, dAt, backTop: top + backH, ss };
}
