// PORT HALCYON — finding room in the mountains: a footprint beside a road
// (turned to face it, clear of everything, on ground flat enough), or the
// flattest free spot in an area. Plans use these for their buildings.

/** A footprint w (along the road) × d beside road r at s on side sd (+1 left), setback m past its edge. */
export function besideRoad(P, r, s, sd, w, d, setback = 2) {
  const p = r.posAt(s);
  const i = p.i;
  const reach = r.rt.hw + r.rt.shoulder + r.rt.walk;
  const off = reach + setback + d / 2;
  const x = r.X[i] + r.LX[i] * sd * off, z = r.Z[i] + r.LZ[i] * sd * off;
  // +z of the footprint faces the road
  const ry = Math.atan2(-r.LX[i] * sd, -r.LZ[i] * sd);
  return { x, z, ry, w, d, s, sd, road: r, i, roadY: r.Y[i] };
}

/** How uneven the ground is under a footprint (approximate): { lo, hi, span }. */
export function unevenness(P, f) {
  const g = P.groundRange(f.x, f.z, f.w, f.d, f.ry);
  return { lo: g.lo, hi: g.hi, span: g.hi - g.lo };
}

/**
 * Search a road (s0..s1, both sides unless sides given) for the best spot for
 * a footprint: free (roadPad), flattest, nearest the road's own height.
 * Returns the footprint (claimed) or null.
 */
export function findBesideRoad(P, r, w, d, o = {}) {
  const s0 = Math.max(r.trim0 + 20, o.s0 ?? 0), s1 = Math.min(r.length - r.trim1 - 20, o.s1 ?? r.length);
  const step = o.step ?? 12, sides = o.sides || [1, -1], setback = o.setback ?? 2.5;
  let best = null, bestScore = Infinity;
  for (let s = s0; s <= s1; s += step) {
    for (const sd of sides) {
      const f = besideRoad(P, r, s, sd, w, d, setback);
      if (!P.inside(f.x, f.z, o.pad ?? 4)) continue;
      if (!P.isFree(f.x, f.z, w, d, f.ry, { pad: o.clear ?? 1, roadPad: false })) continue;
      const u = unevenness(P, f);
      if (u.span > (o.maxSpan ?? 6)) continue;
      const dy = Math.abs((u.lo + u.hi) / 2 - f.roadY);
      if (dy > (o.maxDy ?? 4)) continue;
      const score = u.span * 2 + dy + (o.prefer ? o.prefer(f) : 0);
      if (score < bestScore) { bestScore = score; best = { ...f, lo: u.lo, hi: u.hi }; }
    }
  }
  if (best) P.claim(best.x, best.z, best.w, best.d, best.ry);
  return best;
}

/**
 * The flattest free spot for a w × d footprint within rad of (x, z), facing
 * ry (or its nearest road when ry is null). Claimed. Returns it or null.
 */
export function findFlat(P, x, z, w, d, rad, o = {}) {
  let best = null, bestScore = Infinity;
  const step = o.step ?? 10;
  for (let dz = -rad; dz <= rad; dz += step) {
    for (let dx = -rad; dx <= rad; dx += step) {
      if (dx * dx + dz * dz > rad * rad) continue;
      const px = x + dx, pz = z + dz;
      let ry = o.ry;
      if (ry === undefined || ry === null) { const nr = P.nearestRoad(px, pz, 400); ry = nr ? nr.ry : 0; }
      if (!P.isFree(px, pz, w, d, ry, { pad: o.clear ?? 1, roadPad: o.roadPad ?? true, anywhere: o.anywhere })) continue;
      const g = P.groundRange(px, pz, w, d, ry);
      const score = (g.hi - g.lo) * 3 + Math.hypot(dx, dz) * (o.pull ?? 0.05) + (o.prefer ? o.prefer(px, pz, g) : 0);
      if (score < bestScore) { bestScore = score; best = { x: px, z: pz, w, d, ry, lo: g.lo, hi: g.hi }; }
    }
  }
  if (best && !o.noClaim) P.claim(best.x, best.z, best.w, best.d, best.ry);
  return best;
}
