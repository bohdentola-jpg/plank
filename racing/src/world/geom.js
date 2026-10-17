// PORT HALCYON — small 2D geometry helpers for the world map (x east, z
// south): polygons, polylines, distances, bounding boxes. Pure functions,
// no THREE, so node tools can use them too.

/** Axis box of a point list: {x0, z0, x1, z1}. */
export function bbox(pts, pad = 0) {
  let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity;
  for (const p of pts) {
    if (p[0] < x0) x0 = p[0];
    if (p[0] > x1) x1 = p[0];
    if (p[1] < z0) z0 = p[1];
    if (p[1] > z1) z1 = p[1];
  }
  return { x0: x0 - pad, z0: z0 - pad, x1: x1 + pad, z1: z1 + pad };
}

export const inBox = (b, x, z, pad = 0) => x >= b.x0 - pad && x <= b.x1 + pad && z >= b.z0 - pad && z <= b.z1 + pad;

/** Even-odd point in polygon. */
export function inPoly(poly, x, z) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i][0], zi = poly[i][1], xj = poly[j][0], zj = poly[j][1];
    if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside;
  }
  return inside;
}

/** Distance from (x, z) to segment a→b, and the parameter t along it. */
export function segDist(ax, az, bx, bz, x, z) {
  const dx = bx - ax, dz = bz - az;
  const l2 = dx * dx + dz * dz;
  let t = l2 > 0 ? ((x - ax) * dx + (z - az) * dz) / l2 : 0;
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  const px = ax + dx * t, pz = az + dz * t;
  return { d: Math.hypot(x - px, z - pz), t, px, pz };
}

/** Distance to a polyline (open). */
export function lineDist(pts, x, z) {
  let best = Infinity;
  for (let i = 0; i < pts.length - 1; i++) {
    const r = segDist(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], x, z);
    if (r.d < best) best = r.d;
  }
  return best;
}

/** Distance to a polygon's boundary. */
export function edgeDist(poly, x, z) {
  let best = Infinity;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const r = segDist(poly[j][0], poly[j][1], poly[i][0], poly[i][1], x, z);
    if (r.d < best) best = r.d;
  }
  return best;
}

/** Signed distance to a polygon: negative inside, positive outside. */
export function polyDist(poly, x, z) {
  const d = edgeDist(poly, x, z);
  return inPoly(poly, x, z) ? -d : d;
}

/** Area-weighted centroid of a polygon. */
export function centroid(poly) {
  let a = 0, cx = 0, cz = 0;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const f = poly[j][0] * poly[i][1] - poly[i][0] * poly[j][1];
    a += f;
    cx += (poly[j][0] + poly[i][0]) * f;
    cz += (poly[j][1] + poly[i][1]) * f;
  }
  if (Math.abs(a) < 1e-9) return [poly[0][0], poly[0][1]];
  return [cx / (3 * a), cz / (3 * a)];
}

/** Polygon area (absolute). */
export function area(poly) {
  let a = 0;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) a += poly[j][0] * poly[i][1] - poly[i][0] * poly[j][1];
  return Math.abs(a) / 2;
}

/** Points along a polyline every `step` meters: [[x, z, s, tx, tz], ...]. */
export function resample(pts, step) {
  const out = [];
  let s = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, az] = pts[i], [bx, bz] = pts[i + 1];
    const len = Math.hypot(bx - ax, bz - az);
    if (len < 1e-6) continue;
    const tx = (bx - ax) / len, tz = (bz - az) / len;
    const n = Math.max(1, Math.ceil(len / step));
    for (let k = out.length ? 1 : 0; k <= n; k++) {
      const t = k / n;
      out.push([ax + (bx - ax) * t, az + (bz - az) * t, s + len * t, tx, tz]);
    }
    s += len;
  }
  return out;
}

/** Polyline length. */
export function polyLength(pts) {
  let s = 0;
  for (let i = 0; i < pts.length - 1; i++) s += Math.hypot(pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1]);
  return s;
}

/** Rotate (x, z) by angle a (radians, counter-clockwise seen from above with z south → clockwise on the map). */
export function rot(x, z, a) {
  const c = Math.cos(a), s = Math.sin(a);
  return [x * c - z * s, x * s + z * c];
}

/** Do segments p1→p2 and p3→p4 cross? returns {t, u, x, z} or null. */
export function segCross(p1, p2, p3, p4) {
  const d1x = p2[0] - p1[0], d1z = p2[1] - p1[1];
  const d2x = p4[0] - p3[0], d2z = p4[1] - p3[1];
  const den = d1x * d2z - d1z * d2x;
  if (Math.abs(den) < 1e-9) return null;
  const t = ((p3[0] - p1[0]) * d2z - (p3[1] - p1[1]) * d2x) / den;
  const u = ((p3[0] - p1[0]) * d1z - (p3[1] - p1[1]) * d1x) / den;
  if (t < 0 || t > 1 || u < 0 || u > 1) return null;
  return { t, u, x: p1[0] + d1x * t, z: p1[1] + d1z * t };
}

/** Smoothstep. */
export const sstep = (a, b, v) => {
  const t = Math.max(0, Math.min(1, (v - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
