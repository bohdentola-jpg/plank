// PORT HALCYON — planning helpers for the old quarter: continuous street
// frontage (lots that fill each free run of a street's edge exactly, so the
// houses stand wall to wall up to the corner buildings), corner lots at
// square junctions, and small geometry on the road network.
import { ROAD, MARGIN, ITEM, RESERVED } from '../occ.js';
import { ccw, rectPoly } from './geo.js';

/** Does occupancy at (x, z) have any of mask? */
export const occAt = (P, x, z, mask) => (P.occ.get(x, z) & mask) !== 0;
export { ROAD, MARGIN, ITEM, RESERVED };

/**
 * Lots along one side of a road, filling every free stretch exactly:
 * o: { width: [a, b], depth: [a, b], setback, minRun, pad }. Returns lots
 * like P.lots ({ x, z, ry, w, d, road, side, s }), claimed.
 */
export function frontage(P, r, sd, o = {}) {
  const rt = r.rt;
  const reach = rt.hw + rt.shoulder + rt.walk + 0.4;
  const sb = o.setback ?? 0;
  const W = o.width || [6.5, 12], Dp = o.depth || [11, 16];
  const s0 = (r.closed ? 0 : r.trim0) + 0.5, s1 = r.closed ? r.length : r.length - r.trim1 - 0.5;
  if (s1 - s0 < 4) return [];
  const step = 1;
  const n = Math.floor((s1 - s0) / step);
  const free = new Uint8Array(n);
  // free where the strip behind the sidewalk is clear (a few occupancy lookups a metre)
  const mask = ROAD | ITEM | RESERVED;
  const probe = [reach + sb + 2.2, reach + sb + 4.6, reach + sb + 7.4, reach + sb + Dp[0] - 1];
  const occ = P.occ, X = r.X, Z = r.Z, N1 = r.N - 1;
  for (let k = 0; k < n; k++) {
    const f = (s0 + (k + 0.5) * step) / r.step;
    const i = Math.min(N1 - 1, Math.floor(f)), t = f - i;
    const cx = X[i] + (X[i + 1] - X[i]) * t, cz = Z[i] + (Z[i + 1] - Z[i]) * t;
    const lx = r.LX[i] * sd, lz = r.LZ[i] * sd;
    // (never along a bridge: there's water under it)
    let ok = r.flags[i] & 1 ? 0 : 1;
    for (let q = 0; q < 4 && ok; q++) {
      if (occ.get(cx + lx * probe[q], cz + lz * probe[q]) & mask) { ok = 0; break; }
    }
    free[k] = ok;
  }
  const out = [];
  let k = 0;
  while (k < n) {
    if (!free[k]) { k++; continue; }
    let e = k;
    while (e < n && free[e]) e++;
    const run0 = s0 + k * step, run1 = s0 + e * step;
    k = e;
    let L = run1 - run0;
    if (L < (o.minRun ?? 4)) continue;
    // widths that add up to the run
    const ws = [];
    while (L > 0) {
      let w = W[0] + P.rng() * (W[1] - W[0]);
      if (L - w < W[0]) w = L <= W[1] * 1.15 ? L : L / 2;
      ws.push(w); L -= w;
      if (ws.length > 60) break;
    }
    let s = run0;
    for (const w of ws) {
      const p = r.posAt(s + w / 2), i = p.i;
      const lx = r.LX[i] * sd, lz = r.LZ[i] * sd;
      const ry = Math.atan2(-lx, -lz);
      let placed = null;
      for (let d = Dp[1]; d >= Dp[0] - 0.01; d -= 1.5) {
        const off = reach + sb + d / 2;
        const x = p.x + lx * off, z = p.z + lz * off;
        if (!P.inside(x, z)) break;
        if (P.isFree(x, z, w - 0.3, d, ry, { pad: -0.6, front: 1.6 - sb, water: o.water })) { placed = { x, z, ry, w, d, road: r, side: sd, s: s + w / 2 }; break; }
      }
      if (placed) { P.claim(placed.x, placed.z, placed.w, placed.d, placed.ry); out.push(placed); }
      s += w;
    }
  }
  return out;
}

/**
 * Corner lots at square junctions: for each pair of neighbouring ends that
 * meet at about a right angle, a lot in the corner they make (its two
 * street sides on the property lines). → [{ poly, x, z, ry, w, d, chamfer, node }]
 */
export function corners(P, o = {}) {
  const out = [];
  const size = o.size || [11, 15];
  for (const n of P.net.nodes.values()) {
    if (n.kind !== 'junction' || !P.inside(n.x, n.z, -1)) continue;
    const E = n.ends;
    for (let k = 0; k < E.length; k++) {
      const e = E[k], f = E[(k + 1) % E.length];
      if (E.length < 2) continue;
      const cr = e.dx * f.dz - e.dz * f.dx, dt = e.dx * f.dx + e.dz * f.dz;
      if (Math.abs(dt) > 0.2 || cr <= 0.2) continue;
      if (o.test && !o.test(e.road, f.road)) continue;
      const re = e.road.rt, rf = f.road.rt;
      const we = re.hw + re.shoulder + re.walk + 0.4, wf = rf.hw + rf.shoulder + rf.walk + 0.4;
      // the property corner: e's left property line meets f's right one
      const lex = -e.dz, lez = e.dx, lfx = -f.dz, lfz = f.dx;
      const ax = n.x + lex * we, az = n.z + lez * we;            // on e's line (through the node)
      const bx = n.x - lfx * wf, bz = n.z - lfz * wf;            // on f's line
      // ax + e·t = bx + f·u  → solve for t
      const den = e.dx * f.dz - e.dz * f.dx;
      if (Math.abs(den) < 0.3) continue;
      const t = ((bx - ax) * f.dz - (bz - az) * f.dx) / den;
      const cx = ax + e.dx * t, cz = az + e.dz * t;
      const Le = size[0] + P.rng() * (size[1] - size[0]), Lf = size[0] + P.rng() * (size[1] - size[0]);
      // the lot's own frame: +x along e, +z along f (into the block)
      const mx = cx + e.dx * Le / 2 + f.dx * Lf / 2, mz = cz + e.dz * Le / 2 + f.dz * Lf / 2;
      const ry = Math.atan2(-e.dz, e.dx);
      // (local z of that frame is (sin ry, cos ry) = (−e.dz… ) ⟂ e; it points along f or against it)
      if (!P.inside(mx, mz)) continue;
      const test = P.isFree(mx + (e.dx + f.dx) * 0.8, mz + (e.dz + f.dz) * 0.8, Le - 1.6, Lf - 1.6, ry, { pad: -0.6, water: o.water });
      if (!test) continue;
      const ch = o.chamfer ? o.chamfer(P) : 0;
      const C = [cx, cz];
      const pts = ch > 0.5
        ? [[cx + e.dx * ch, cz + e.dz * ch], [cx + e.dx * Le, cz + e.dz * Le], [cx + e.dx * Le + f.dx * Lf, cz + e.dz * Le + f.dz * Lf], [cx + f.dx * Lf, cz + f.dz * Lf], [cx + f.dx * ch, cz + f.dz * ch]]
        : [C, [cx + e.dx * Le, cz + e.dz * Le], [cx + e.dx * Le + f.dx * Lf, cz + e.dz * Le + f.dz * Lf], [cx + f.dx * Lf, cz + f.dz * Lf]];
      P.claim(mx, mz, Le, Lf, ry);
      out.push({ poly: ccw(pts), x: mx, z: mz, ry, w: Le, d: Lf, chamfer: ch, node: n, e, f, y: n.y });
    }
  }
  return out;
}

/** Edge kinds for a polygon: 's' where a road lies just outside it, else 'p'. */
export function edgeKinds(P, poly, chamferLen = 0) {
  const kinds = [];
  for (let k = 0; k < poly.length; k++) {
    const a = poly[k], b = poly[(k + 1) % poly.length];
    const dx = b[0] - a[0], dz = b[1] - a[1], l = Math.hypot(dx, dz) || 1;
    const nx = -dz / l, nz = dx / l;
    const mx = (a[0] + b[0]) / 2, mz = (a[1] + b[1]) / 2;
    if (chamferLen && Math.abs(l - chamferLen) < 0.05) { kinds.push('c'); continue; }
    let road = false;
    for (const d of [2.5, 4.5]) if (occAt(P, mx + nx * d, mz + nz * d, ROAD)) road = true;
    kinds.push(road ? 's' : 'p');
  }
  return kinds;
}

/** A rectangle lot's polygon (front edge first) and kinds: front street, back, sides party. */
export function lotPoly(L) {
  return { poly: rectPoly(L.x, L.z, L.w, L.d, L.ry), edges: ['s', 'p', 'b', 'p'] };
}

/** Points every `step` m along a road's trimmed length: [{ s, i, x, z }]. */
export function along(r, step, pad = 2) {
  const out = [];
  const s0 = (r.closed ? 0 : r.trim0) + pad, s1 = r.closed ? r.length : r.length - r.trim1 - pad;
  for (let s = s0 + step / 2; s < s1; s += step) {
    const p = r.posAt(s);
    out.push({ s, i: p.i, x: r.X[p.i], z: r.Z[p.i] });
  }
  return out;
}
