// PORT HALCYON — finding room in the mountains: a footprint beside a road
// (turned to face it, clear of everything, on ground flat enough), or the
// flattest free spot in an area. Plans use these for their buildings.
//
// The plan's own ground (P.groundY) is a 16 m grid: good enough to rank
// many candidates, but on a mountainside it hides slopes a building would
// be buried in or float over. So the best few are checked again on the
// exact ground (the terrain's own 4 m vertices, worked out for just the
// points asked: cheap for a handful of footprints).
import { groundFn } from './util.js';

const EXACT = new WeakMap();
/** The exact built ground for a plan (shared by every pack's plan on the same net). */
export function exactGround(P) {
  let g = EXACT.get(P.net);
  if (!g) { g = groundFn(P.terrain, P.net); EXACT.set(P.net, g); }
  return g;
}

/** Lowest and highest exact ground under a w × d footprint (a (n+1)² grid of points). */
export function exactRange(P, x, z, w, d, ry, n = 4) {
  const g = exactGround(P);
  const c = Math.cos(ry), s = Math.sin(ry);
  let lo = Infinity, hi = -Infinity;
  for (let a = 0; a <= n; a++) {
    for (let b = 0; b <= n; b++) {
      const lx = (a / n - 0.5) * w, lz = (b / n - 0.5) * d;
      const h = g(x + lx * c + lz * s, z - lx * s + lz * c);
      if (h < lo) lo = h;
      if (h > hi) hi = h;
    }
  }
  return { lo, hi, span: hi - lo };
}

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

const REFINE = 12;   // candidates checked again on the exact ground

/**
 * Search a road (s0..s1, both sides unless sides given) for the best spot for
 * a footprint: free (roadPad), flattest, nearest the road's own height.
 * Returns the footprint (claimed) with its exact lo/hi, or null.
 */
export function findBesideRoad(P, r, w, d, o = {}) {
  const s0 = Math.max(r.trim0 + 20, o.s0 ?? 0), s1 = Math.min(r.length - r.trim1 - 20, o.s1 ?? r.length);
  const step = o.step ?? 12, sides = o.sides || [1, -1], setback = o.setback ?? 2.5;
  const maxSpan = o.maxSpan ?? 6, maxDy = o.maxDy ?? 4;
  const score = (f, u) => {
    const dy = Math.abs((u.lo + u.hi) / 2 - f.roadY);
    if (u.span > maxSpan || dy > maxDy) return Infinity;
    return u.span * 2 + dy + (o.prefer ? o.prefer(f) : 0);
  };
  const cands = [];
  for (let s = s0; s <= s1; s += step) {
    for (const sd of sides) {
      const f = besideRoad(P, r, s, sd, w, d, setback);
      if (!P.inside(f.x, f.z, o.pad ?? 4)) continue;
      if (!P.isFree(f.x, f.z, w, d, f.ry, { pad: o.clear ?? 1, roadPad: false })) continue;
      // (a little slack on the rough ground: the exact check decides)
      const u = unevenness(P, f);
      const k = score(f, { lo: u.lo + u.span * 0.25, hi: u.hi - u.span * 0.25, span: u.span * 0.5 });
      if (k < Infinity) cands.push({ f, k });
    }
  }
  cands.sort((a, b) => a.k - b.k);
  let best = null, bestScore = Infinity, ok = 0, tried = 0;
  for (const { f } of cands) {
    if (ok >= REFINE / 3 || tried++ >= REFINE * 3) break;
    const u = exactRange(P, f.x, f.z, w, d, f.ry);
    const k = score(f, u);
    if (k < Infinity) ok++;
    if (k < bestScore) { bestScore = k; best = { ...f, lo: u.lo, hi: u.hi }; }
  }
  if (best) P.claim(best.x, best.z, best.w, best.d, best.ry);
  return best;
}

/**
 * The flattest free spot for a w × d footprint within rad of (x, z), facing
 * ry (or its nearest road when ry is null). Claimed (unless noClaim).
 * Returns it with its exact lo/hi, or null.
 */
export function findFlat(P, x, z, w, d, rad, o = {}) {
  const step = o.step ?? 10;
  const cands = [];
  for (let dz = -rad; dz <= rad; dz += step) {
    for (let dx = -rad; dx <= rad; dx += step) {
      if (dx * dx + dz * dz > rad * rad) continue;
      const px = x + dx, pz = z + dz;
      let ry = o.ry;
      if (ry === undefined || ry === null) { const nr = P.nearestRoad(px, pz, 400); ry = nr ? nr.ry : 0; }
      if (!P.isFree(px, pz, w, d, ry, { pad: o.clear ?? 1, roadPad: o.roadPad ?? true, anywhere: o.anywhere })) continue;
      const g = P.groundRange(px, pz, w, d, ry);
      const extra = Math.hypot(dx, dz) * (o.pull ?? 0.05);
      cands.push({ px, pz, ry, extra, k: (g.hi - g.lo) * 3 + extra + (o.prefer ? o.prefer(px, pz, g) : 0) });
    }
  }
  cands.sort((a, b) => a.k - b.k);
  let best = null, bestScore = Infinity;
  for (const c of cands.slice(0, o.refine ?? REFINE * 2)) {
    const g = exactRange(P, c.px, c.pz, w, d, c.ry, o.n ?? 4);
    const k = g.span * 3 + c.extra + (o.prefer ? o.prefer(c.px, c.pz, g) : 0);
    if (k < bestScore) { bestScore = k; best = { x: c.px, z: c.pz, w, d, ry: c.ry, lo: g.lo, hi: g.hi }; }
  }
  if (best && !o.noClaim) P.claim(best.x, best.z, best.w, best.d, best.ry);
  return best;
}
