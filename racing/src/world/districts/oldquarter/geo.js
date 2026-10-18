// PORT HALCYON — geometry for the old quarter (OLD TOWN and CHINATOWN):
// building faces worked in world coordinates from footprint polygons (each
// edge a face with its own frame: along it, up, and out), mansard and hipped
// roofs over any convex footprint, dormers, segmental arches, catenaries
// (lantern strings, café lights), stairs, trees. All of it writes into the
// builder's accumulators (positions, uvs in metres, an optional colour).
import * as THREE from 'three';
import { box, cylinder, cone, sphere, cap } from '../builder.js';

// ------------------------------------------------------------------ polygons

/** Signed area (negative: counter-clockwise seen from above, the builders' winding). */
export function sarea(poly) {
  let a = 0;
  for (let i = 0; i < poly.length; i++) { const p = poly[i], q = poly[(i + 1) % poly.length]; a += p[0] * q[1] - q[0] * p[1]; }
  return a / 2;
}
/** The polygon wound counter-clockwise seen from above (outward normals (−tz, tx)). */
export function ccw(poly) { return sarea(poly) > 0 ? poly.slice().reverse() : poly; }

/** A footprint rectangle (P.lots convention: +z local is the front) → world polygon, front edge first. */
export function rectPoly(x, z, w, d, ry) {
  const c = Math.cos(ry), s = Math.sin(ry);
  const P = (lx, lz) => [x + lx * c + lz * s, z - lx * s + lz * c];
  return [P(-w / 2, d / 2), P(w / 2, d / 2), P(w / 2, -d / 2), P(-w / 2, -d / 2)];
}

/** Local frame (box convention): P(lx, ly, lz) → world. */
export function frame(x, y, z, ry) {
  const c = Math.cos(ry), s = Math.sin(ry);
  return { x, y, z, ry, c, s, P: (lx, ly, lz) => [x + lx * c + lz * s, y + ly, z - lx * s + lz * c], X: (lx, lz) => [x + lx * c + lz * s, z - lx * s + lz * c] };
}

/**
 * The face of edge A→B (counter-clockwise polygon): a runs along it from A
 * (0) to B (len), o out from the wall. ry turns a box to stand square on it.
 */
export function edgeFace(A, B) {
  const dx = B[0] - A[0], dz = B[1] - A[1], len = Math.hypot(dx, dz) || 1e-6;
  const tx = dx / len, tz = dz / len, nx = -tz, nz = tx;
  return {
    len, tx, tz, nx, nz, ry: Math.atan2(-tz, tx), A, B,
    P: (a, y, o = 0) => [A[0] + tx * a + nx * o, y, A[1] + tz * a + nz * o],
  };
}

/** A quad on a face (facing out), a0→a1 along it, y0→y1 up, o out. */
export function fquad(acc, f, a0, a1, y0, y1, o, uv) {
  acc.quadP(f.P(a0, y0, o), f.P(a1, y0, o), f.P(a1, y1, o), f.P(a0, y1, o), uv || [a0, y0, a1, y1]);
}
/** Same, uv'd in metres (u metres a repeat across, v up). */
export function fwall(acc, f, a0, a1, y0, y1, o, U = 2, V = U, v0 = 0) {
  acc.quadP(f.P(a0, y0, o), f.P(a1, y0, o), f.P(a1, y1, o), f.P(a0, y1, o), [a0 / U, v0 + y0 / V, a1 / U, v0 + y1 / V]);
}
/** A box standing on a face: centred a along it, base y, from o out to o + d. */
export function fbox(acc, f, a, y, o, w, h, d, opt = {}) {
  const p = f.P(a, y, o + d / 2);
  box(acc, p[0], p[1], p[2], w, h, d, f.ry, opt);
}

/** Inset a convex counter-clockwise polygon by a (each edge moved in a). */
export function inset(poly, a) {
  const n = poly.length, out = [];
  const nrm = [];
  for (let i = 0; i < n; i++) {
    const p = poly[i], q = poly[(i + 1) % n];
    const dx = q[0] - p[0], dz = q[1] - p[1], l = Math.hypot(dx, dz) || 1;
    nrm.push([-dz / l, dx / l]);
  }
  for (let i = 0; i < n; i++) {
    const n1 = nrm[(i - 1 + n) % n], n2 = nrm[i];
    const k = a / Math.max(0.3, 1 + n1[0] * n2[0] + n1[1] * n2[1]);
    out.push([poly[i][0] - (n1[0] + n2[0]) * k, poly[i][1] - (n1[1] + n2[1]) * k]);
  }
  return out;
}

export function centroid(poly) {
  let x = 0, z = 0;
  for (const p of poly) { x += p[0]; z += p[1]; }
  return [x / poly.length, z / poly.length];
}

/** Walls round a polygon from y0 to y1 (uv in metres), skipping edges where skip(k). */
export function walls(acc, poly, y0, y1, U = 2, V = U, skip = null) {
  for (let k = 0; k < poly.length; k++) {
    if (skip && skip(k)) continue;
    const f = edgeFace(poly[k], poly[(k + 1) % poly.length]);
    fwall(acc, f, 0, f.len, y0, y1, 0, U, V);
  }
}

/** Slopes from a polygon at y up to its inset at y + h (a mansard's lower slope, a hip's eaves). */
export function slopes(acc, outer, inner, y, h, U = 2) {
  const n = outer.length;
  for (let k = 0; k < n; k++) {
    const a = outer[k], b = outer[(k + 1) % n], c = inner[(k + 1) % n], d = inner[k];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const sl = Math.hypot(h, Math.hypot(d[0] - a[0], d[1] - a[1]));
    acc.quadP([a[0], y, a[1]], [b[0], y, b[1]], [c[0], y + h, c[1]], [d[0], y + h, d[1]], [0, 0, len / U, sl / U]);
  }
}

/** A pyramid from a polygon at y to a point rise above its centre. */
export function pyramid(acc, poly, y, rise, U = 2) {
  const [cx, cz] = centroid(poly);
  for (let k = 0; k < poly.length; k++) {
    const a = poly[k], b = poly[(k + 1) % poly.length];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const sl = Math.hypot(rise, Math.hypot((a[0] + b[0]) / 2 - cx, (a[1] + b[1]) / 2 - cz));
    const i0 = acc.v(a[0], y, a[1], 0, 0), i1 = acc.v(b[0], y, b[1], len / U, 0), i2 = acc.v(cx, y + rise, cz, len / U / 2, sl / U);
    acc.tri(i0, i1, i2);
  }
}

/** A flat cap (roof, slab top). */
export function flat(acc, poly, y, U = 2) { cap(acc, poly, y, true, U); }

/**
 * Mansard over a convex polygon: the steep lower slope (rise h1, in by a),
 * then a low hip (rise h2) over what's left. Returns the inner polygon.
 */
export function mansard(acc, poly, y, h1, a, h2, U = 2) {
  const inner = inset(poly, a);
  slopes(acc, poly, inner, y, h1, U);
  const top = inset(inner, Math.min(3, a * 2.5));
  if (h2 > 0.05 && polyOK(top)) { slopes(acc, inner, top, y + h1, h2, U); flat(acc, top, y + h1 + h2, U); }
  else flat(acc, inner, y + h1, U);
  return inner;
}

/** Still convex and the right way round after insetting? */
export function polyOK(p) { return sarea(p) < -1; }

// ------------------------------------------------------------------ small shapes

/** Two crossed quads (a cheap bead/bulb/leaf seen from anywhere). */
export function cross(acc, x, y, z, s, h = s) {
  acc.quadP([x - s, y, z], [x + s, y, z], [x + s, y + h, z], [x - s, y + h, z]);
  acc.quadP([x, y, z - s], [x, y, z + s], [x, y + h, z + s], [x, y + h, z - s]);
}

/** A little upright octagonal prism (a bulb, a lantern body, a pot). */
export function lantern(acc, x, y, z, r, h, seg = 6, o = {}) {
  cylinder(acc, x, y, z, r * (o.rb ?? 0.75), h * 0.2, seg, { r2: r });
  cylinder(acc, x, y + h * 0.2, z, r, h * 0.6, seg);
  cylinder(acc, x, y + h * 0.8, z, r, h * 0.2, seg, { r2: r * (o.rt ?? 0.75), top: true });
}

/** Points along a hanging wire from a to b ([x, y, z]), sagging `sag` at the middle. */
export function catenary(a, b, sag, n) {
  const out = [];
  for (let k = 0; k <= n; k++) {
    const t = k / n;
    out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t - sag * 4 * t * (1 - t), a[2] + (b[2] - a[2]) * t]);
  }
  return out;
}

/** A thin wire along points (a flat ribbon facing up-ish and one facing sideways). */
export function wire(acc, pts, w = 0.03) {
  for (let k = 0; k < pts.length - 1; k++) {
    const p = pts[k], q = pts[k + 1];
    acc.quadP([p[0], p[1] - w, p[2]], [q[0], q[1] - w, q[2]], [q[0], q[1] + w, q[2]], [p[0], p[1] + w, p[2]]);
    acc.quadP([p[0], p[1] + w, p[2]], [q[0], q[1] + w, q[2]], [q[0], q[1] - w, q[2]], [p[0], p[1] - w, p[2]]);
  }
}

/** A flight of steps: from (x, y, z) going `len` along heading ry (local +z), rising h, w wide. */
export function stairs(acc, x, y, z, ry, w, len, h, n) {
  const c = Math.cos(ry), s = Math.sin(ry);
  for (let k = 0; k < n; k++) {
    const lz = (k + 0.5) * len / n;
    box(acc, x + lz * s, y, z + lz * c, w, (k + 1) * h / n, len / n, ry, { u: 1 });
  }
}

/**
 * A wall face with segmental arches cut in it (bridge spandrels, arcades):
 * on face f, from a0 to a1, wall from y0 up to yTop; arches: [{ a0, a1,
 * spring, crown }] (each opening from its springing line to its crown).
 * Fills everything that isn't an opening; soffits optional (o.depth).
 */
export function archedWall(acc, f, a0, a1, y0, yTop, arches, o = {}) {
  const U = o.u || 2.4, off = o.off || 0;
  const seg = o.seg || 10;
  let cur = a0;
  const pierQ = (p0, p1) => { if (p1 - p0 > 0.01) fwall(acc, f, p0, p1, y0, yTop, off, U); };
  for (const A of arches) {
    pierQ(cur, A.a0);
    const span = A.a1 - A.a0, rise = A.crown - A.spring;
    // circle through the springing points and the crown
    const half = span / 2;
    const R = (half * half + rise * rise) / (2 * rise);
    const cy = A.crown - R, cxA = A.a0 + half;
    const th = Math.asin(Math.min(1, half / R));
    // below the springing: the opening (nothing); over it, a fan of quads from the arc up to yTop
    let pa = A.a0, py = A.spring;
    for (let k = 1; k <= seg; k++) {
      const ang = -th + (2 * th * k) / seg;
      const ax = cxA + Math.sin(ang) * R, ay = cy + Math.cos(ang) * R;
      acc.quadP(f.P(pa, py, off), f.P(ax, ay, off), f.P(ax, yTop, off), f.P(pa, yTop, off), [pa / U, py / U, ax / U, yTop / U]);
      if (o.depth) {
        // the soffit (intrados) back through the wall
        const d = o.depth;
        acc.quadP(f.P(ax, ay, off), f.P(pa, py, off), f.P(pa, py, off - d), f.P(ax, ay, off - d), [0, 0, d / U, Math.hypot(ax - pa, ay - py) / U]);
      }
      pa = ax; py = ay;
    }
    // the parts of the piers under the springing either side are part of the pier quads; the
    // band between y0 and the springing inside the opening stays open
    cur = A.a1;
  }
  pierQ(cur, a1);
}

/** Voussoirs: a ring of slightly proud stones round a segmental arch (decoration). */
export function voussoirs(acc, f, A, ring = 0.7, off = 0.05, n = 13) {
  const span = A.a1 - A.a0, rise = A.crown - A.spring, half = span / 2;
  const R = (half * half + rise * rise) / (2 * rise);
  const cy = A.crown - R, cx = A.a0 + half;
  const th = Math.asin(Math.min(1, half / R));
  for (let k = 0; k < n; k++) {
    const g0 = -th + (2 * th * (k + 0.06)) / n, g1 = -th + (2 * th * (k + 0.94)) / n;
    const r1 = R + ring * (k === Math.floor(n / 2) ? 1.5 : 1);
    const P = (g, r) => f.P(cx + Math.sin(g) * r, cy + Math.cos(g) * r, off);
    acc.quadP(P(g0, R), P(g1, R), P(g1, r1), P(g0, r1), [0, 0, 0.4, ring]);
  }
}

// ------------------------------------------------------------------ vegetation

/**
 * A broad tree (plane, lime): a trunk and a crown of a few lumps. leafCol:
 * [r, g, b]; trunk acc may be vertex-coloured too.
 */
export function broadTree(trunk, leaf, x, y, z, s, rng, leafCol, o = {}) {
  const th = (o.trunk ?? 3.2) * s;
  trunk.col = o.bark || [0.55, 0.5, 0.42];
  cylinder(trunk, x, y - 0.3, z, 0.22 * s, th + 0.3, 6, { r2: 0.15 * s });
  const n = o.lumps ?? 3;
  for (let k = 0; k < n; k++) {
    const a = (k / n) * Math.PI * 2 + rng() * 0.8;
    const r = (1.7 + rng() * 0.7) * s * (o.crown ?? 1);
    const d = k === 0 && n > 2 ? 0 : 1.1 * s;
    const t = 0.85 + rng() * 0.3;
    leaf.col = [leafCol[0] * t, leafCol[1] * t, leafCol[2] * t];
    sphere(leaf, x + Math.cos(a) * d, y + th + r * 0.55 + (k === 0 ? 0.9 * s : 0), z + Math.sin(a) * d, r, 6, { sy: 0.78 });
  }
}

/** A clipped cone/column of a tree (cypress, topiary), or a round bush. */
export function bush(leaf, x, y, z, r, h, col, kind = 'ball') {
  leaf.col = col;
  if (kind === 'cone') cone(leaf, x, y, z, r, h, 6);
  else sphere(leaf, x, y + r * 0.6, z, r, 5, { sy: h / (2 * r) });
}

export { THREE };
