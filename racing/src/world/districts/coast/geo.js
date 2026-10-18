// PORT HALCYON — the coast packs' plan-time geometry (no THREE, no canvas):
// points along the shore and the roads, offset lines, pieces of polylines.

/** Point on a polyline that runs steadily in x, at that x: { x, z, tx, tz, lx, lz } (l = its left). */
export function polyAtX(pts, x) {
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], b = pts[i + 1];
    if ((x - a[0]) * (x - b[0]) <= 0) {
      const t = (x - a[0]) / (b[0] - a[0] || 1);
      const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
      const tx = (b[0] - a[0]) / L, tz = (b[1] - a[1]) / L;
      return { x, z: a[1] + (b[1] - a[1]) * t, tx, tz, lx: tz, lz: -tx };
    }
  }
  return null;
}

/** A polyline offset to its left by d (mitred at the joints). */
export function offsetLine(pts, d) {
  const out = [];
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i], a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
    const L1 = Math.hypot(p[0] - a[0], p[1] - a[1]) || 1, L2 = Math.hypot(b[0] - p[0], b[1] - p[1]) || 1;
    let tx = (i > 0 ? (p[0] - a[0]) / L1 : 0) + (i < pts.length - 1 ? (b[0] - p[0]) / L2 : 0);
    let tz = (i > 0 ? (p[1] - a[1]) / L1 : 0) + (i < pts.length - 1 ? (b[1] - p[1]) / L2 : 0);
    const l = Math.hypot(tx, tz) || 1;
    tx /= l; tz /= l;
    out.push([p[0] + tz * d, p[1] - tx * d]);
  }
  return out;
}

/** Cut a polyline that runs steadily in x to x ∈ [x0, x1] (returned west to east). */
export function clipX(pts, x0, x1) {
  const xs = pts.map((p) => p[0]);
  const lo = Math.max(x0, Math.min(...xs)), hi = Math.min(x1, Math.max(...xs));
  if (hi - lo < 1) return [];
  const out = [[lo, polyAtX(pts, lo).z]];
  for (const p of [...pts].sort((a, b) => a[0] - b[0])) if (p[0] > lo + 0.5 && p[0] < hi - 0.5) out.push([p[0], p[1]]);
  out.push([hi, polyAtX(pts, hi).z]);
  return out;
}

/** Split a polyline into pieces no longer than len (each a list of points). */
export function pieces(pts, len) {
  const out = [];
  let cur = [pts[0]], acc = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], b = pts[i + 1];
    const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
    let s = 0;
    while (L - s > len - acc) {
      s += len - acc;
      const q = [a[0] + (b[0] - a[0]) * s / L, a[1] + (b[1] - a[1]) * s / L];
      cur.push(q);
      out.push(cur);
      cur = [q];
      acc = 0;
    }
    acc += L - s;
    cur.push(b);
  }
  if (cur.length > 1) out.push(cur);
  return out;
}

/** Middle of a polyline's ends. */
export const mid = (pts) => { const a = pts[0], b = pts[pts.length - 1]; return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]; };

/** A local frame as plain numbers (for the plan): (lx, lz) → [x, z] with local z along (sin ry, cos ry). */
export function frame2(x, z, ry) {
  const c = Math.cos(ry), s = Math.sin(ry);
  return (lx, lz) => [x + lx * c + lz * s, z - lx * s + lz * c];
}

/** The polyline between two x's of a shoreline, as quay pieces ≤ len (skipping gaps [[x0, x1], ...]). */
export function shoreRuns(pts, gaps, len) {
  const xs = pts.map((p) => p[0]);
  const lo = Math.min(...xs), hi = Math.max(...xs);
  const cuts = [[lo, hi]];
  for (const [g0, g1] of gaps) {
    for (let k = cuts.length - 1; k >= 0; k--) {
      const [a, b] = cuts[k];
      if (g1 <= a || g0 >= b) continue;
      cuts.splice(k, 1, ...[[a, g0], [g1, b]].filter(([p, q]) => q - p > 2));
    }
  }
  const out = [];
  for (const [a, b] of cuts) {
    const c = clipX(pts, a, b);
    if (c.length > 1) out.push(...pieces(c.reverse(), len));
  }
  return out;
}
