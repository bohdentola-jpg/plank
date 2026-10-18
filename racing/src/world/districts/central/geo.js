// PORT HALCYON — geometry for Downtown and Uptown (on top of builder.js):
// facade walls uv'd in texture tiles with per-building offsets (so the
// window shader gives each building its own lit floors), prisms of any
// footprint (chamfered towers, drums, octagons), lids, upright quads for
// signs and screens, flat decals, beams, low-poly trees and cars.
// Everything takes an Acc (B.acc(mat) / B.near(mat)); vertex colours come
// from acc.col when the material has them.
import * as THREE from 'three';

const TAU = Math.PI * 2;

// ------------------------------------------------------------------ paints
// Few materials per cell: plain-coloured things (railings, slate, copper,
// bark, glass, LED strips) are colours of a few shared vertex-coloured
// materials. A paint { mat, col } stands for one; A(B, m) / N(B, m) give the
// cell's (or the near) accumulator for a material or a paint, and a paint's
// accumulator draws in its own colour whatever colour the shared one is at.

/** A colour (linear rgb, or a hex taken as sRGB) of a vertex-coloured material. */
export function paint(mat, col) {
  const c = typeof col === 'number' ? new THREE.Color(col) : null;
  return { mat, col: c ? [c.r, c.g, c.b] : col, isPaint: true, views: new WeakMap() };
}
function tinted(acc, col) {
  const fns = new Map();
  return new Proxy(acc, {
    get(t, k) {
      const v = t[k];
      if (typeof v !== 'function') return v;
      let w = fns.get(k);
      if (!w) {
        w = (...a) => {
          const prev = t.col;
          t.col = col;
          try { return v.apply(t, a); } finally { t.col = prev; }
        };
        fns.set(k, w);
      }
      return w;
    },
  });
}
function view(m, acc) {
  let p = m.views.get(acc);
  if (!p) { p = tinted(acc, m.col); m.views.set(acc, p); }
  return p;
}
export const A = (B, m) => (m.isPaint ? view(m, B.acc(m.mat)) : B.acc(m));
export const N = (B, m) => (m.isPaint ? view(m, B.near(m.mat)) : B.near(m));

/** Local (lx, lz) → world, turned ry about (x, z) (builder.js's convention). */
export function toWorld(x, z, ry) {
  const c = Math.cos(ry), s = Math.sin(ry);
  return (lx, lz) => [x + lx * c + lz * s, z - lx * s + lz * c];
}

/**
 * The four walls of a box (no top), uv in tiles: across = metres / uw from
 * u0, up = metres / vh from v0 (so a facade tile spans uw × vh metres).
 * faces: any of 'fblr' (front = +z).
 */
export function walls(acc, x, y, z, w, h, d, ry, uw, vh, u0 = 0, v0 = 0, faces = 'fblr') {
  const c = Math.cos(ry), s = Math.sin(ry);
  const P = (lx, ly, lz) => [x + lx * c + lz * s, y + ly, z - lx * s + lz * c];
  const hw = w / 2, hd = d / 2, vt = v0 + h / vh;
  if (faces.includes('f')) acc.quadP(P(-hw, 0, hd), P(hw, 0, hd), P(hw, h, hd), P(-hw, h, hd), [u0, v0, u0 + w / uw, vt]);
  if (faces.includes('r')) acc.quadP(P(hw, 0, hd), P(hw, 0, -hd), P(hw, h, -hd), P(hw, h, hd), [u0, v0, u0 + d / uw, vt]);
  if (faces.includes('b')) acc.quadP(P(hw, 0, -hd), P(-hw, 0, -hd), P(-hw, h, -hd), P(hw, h, -hd), [u0, v0, u0 + w / uw, vt]);
  if (faces.includes('l')) acc.quadP(P(-hw, 0, -hd), P(-hw, 0, hd), P(-hw, h, hd), P(-hw, h, -hd), [u0, v0, u0 + d / uw, vt]);
}

/** A flat top over a w × d box at height y (uv in metres / uvm). */
export function lid(acc, x, y, z, w, d, ry, uvm = 4) {
  const c = Math.cos(ry), s = Math.sin(ry);
  const P = (lx, lz) => [x + lx * c + lz * s, y, z - lx * s + lz * c];
  const hw = w / 2, hd = d / 2;
  acc.quadP(P(-hw, hd), P(hw, hd), P(hw, -hd), P(-hw, -hd), [0, 0, w / uvm, d / uvm]);
}

/** A whole box (four walls and a top), uv in metres / uvm. */
export function block(acc, x, y, z, w, h, d, ry, uvm = 2, top = true) {
  walls(acc, x, y, z, w, h, d, ry, uvm, uvm);
  if (top) lid(acc, x, y + h, z, w, d, ry, uvm);
}

/** Box underside (soffits of canopies, deck slabs). */
export function under(acc, x, y, z, w, d, ry, uvm = 2) {
  const c = Math.cos(ry), s = Math.sin(ry);
  const P = (lx, lz) => [x + lx * c + lz * s, y, z - lx * s + lz * c];
  const hw = w / 2, hd = d / 2;
  acc.quadP(P(-hw, -hd), P(hw, -hd), P(hw, hd), P(-hw, hd), [0, 0, w / uvm, d / uvm]);
}

// ------------------------------------------------------------------ prisms

/** Rectangle with its corners cut by c (a local polygon, 8 points). */
export function chamfer(w, d, c) {
  const hw = w / 2, hd = d / 2;
  return [[-hw + c, -hd], [hw - c, -hd], [hw, -hd + c], [hw, hd - c], [hw - c, hd], [-hw + c, hd], [-hw, hd - c], [-hw, -hd + c]];
}
export const rect = (w, d) => [[-w / 2, -d / 2], [w / 2, -d / 2], [w / 2, d / 2], [-w / 2, d / 2]];
export function circle(r, n = 16, a0 = 0) {
  const out = [];
  for (let k = 0; k < n; k++) { const a = a0 + (k / n) * TAU; out.push([Math.cos(a) * r, Math.sin(a) * r]); }
  return out;
}

/** World points of a local polygon placed at (x, z) turned ry. */
export function place(poly, x, z, ry) {
  const W = toWorld(x, z, ry);
  return poly.map(([a, b]) => W(a, b));
}

/**
 * Upright walls round a world polygon from y0 to y1 (facing out whichever
 * way it winds), u continuous round it in tiles of uw metres from u0, v from
 * v0 in tiles of vh metres. y1 may be a function of the point (sloped tops).
 */
export function polyWalls(acc, pts, y0, y1, uw = 4, vh = 4, u0 = 0, v0 = 0) {
  let area = 0;
  for (let i = 0; i < pts.length; i++) { const a = pts[i], b = pts[(i + 1) % pts.length]; area += a[0] * b[1] - b[0] * a[1]; }
  const flip = area > 0;
  const top = typeof y1 === 'function' ? y1 : () => y1;
  let u = u0;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const ta = top(a), tb = top(b);
    const ua = u / uw, ub = (u + len) / uw;
    if (!flip) {
      const i0 = acc.v(a[0], y0, a[1], ua, v0), i1 = acc.v(b[0], y0, b[1], ub, v0);
      const i2 = acc.v(b[0], tb, b[1], ub, v0 + (tb - y0) / vh), i3 = acc.v(a[0], ta, a[1], ua, v0 + (ta - y0) / vh);
      acc.quad(i0, i1, i2, i3);
    } else {
      const i0 = acc.v(b[0], y0, b[1], ub, v0), i1 = acc.v(a[0], y0, a[1], ua, v0);
      const i2 = acc.v(a[0], ta, a[1], ua, v0 + (ta - y0) / vh), i3 = acc.v(b[0], tb, b[1], ub, v0 + (tb - y0) / vh);
      acc.quad(i0, i1, i2, i3);
    }
    u += len;
  }
}

/** A flat cap over a world polygon at y (or a function of the point: sloped). */
export function polyCap(acc, pts, y, up = true, uvm = 4) {
  const tri = THREE.ShapeUtils.triangulateShape(pts.map((p) => new THREE.Vector2(p[0], p[1])), []);
  const Y = typeof y === 'function' ? y : () => y;
  const base = acc.count;
  for (const p of pts) acc.v(p[0], Y(p), p[1], p[0] / uvm, p[1] / uvm);
  for (const t of tri) {
    const a = pts[t[0]], b = pts[t[1]], c = pts[t[2]];
    const ny = (b[1] - a[1]) * (c[0] - a[0]) - (b[0] - a[0]) * (c[1] - a[1]);
    if ((ny > 0) === up) acc.tri(base + t[0], base + t[1], base + t[2]);
    else acc.tri(base + t[0], base + t[2], base + t[1]);
  }
}

/** A convex cap fanned to an apex (pyramid / cone roof over a polygon). */
export function apex(acc, pts, y0, ax, ay, az, uvm = 4) {
  let area = 0;
  for (let i = 0; i < pts.length; i++) { const a = pts[i], b = pts[(i + 1) % pts.length]; area += a[0] * b[1] - b[0] * a[1]; }
  const flip = area > 0;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const h = Math.hypot(ay - y0, Math.hypot((a[0] + b[0]) / 2 - ax, (a[1] + b[1]) / 2 - az));
    if (!flip) {
      const i0 = acc.v(a[0], y0, a[1], 0, 0), i1 = acc.v(b[0], y0, b[1], len / uvm, 0), i2 = acc.v(ax, ay, az, len / uvm / 2, h / uvm);
      acc.tri(i0, i1, i2);
    } else {
      const i0 = acc.v(b[0], y0, b[1], 0, 0), i1 = acc.v(a[0], y0, a[1], len / uvm, 0), i2 = acc.v(ax, ay, az, len / uvm / 2, h / uvm);
      acc.tri(i0, i1, i2);
    }
  }
}

/** A ring band (a cornice, a crown ring, a basin's rim): outer walls, top, inner walls. */
export function ring(acc, x, y, z, r0, r1, h, n = 16) {
  const o = circle(r1, n).map(([a, b]) => [x + a, z + b]);
  const i = circle(r0, n).map(([a, b]) => [x + a, z + b]);
  polyWalls(acc, o, y, y + h, 2, 2);
  // inner walls face in: walk the inner ring the other way round
  const ir = [...i].reverse();
  let area = 0;
  for (let k = 0; k < ir.length; k++) { const a = ir[k], b = ir[(k + 1) % ir.length]; area += a[0] * b[1] - b[0] * a[1]; }
  for (let k = 0; k < ir.length; k++) {
    const a = ir[k], b = ir[(k + 1) % ir.length];
    // (the opposite of polyWalls' choice: these must face the centre)
    if (area > 0) acc.quadP([a[0], y, a[1]], [b[0], y, b[1]], [b[0], y + h, b[1]], [a[0], y + h, a[1]], [0, 0, 1, h / 2]);
    else acc.quadP([b[0], y, b[1]], [a[0], y, a[1]], [a[0], y + h, a[1]], [b[0], y + h, b[1]], [0, 0, 1, h / 2]);
  }
  for (let k = 0; k < n; k++) {
    const a = o[k], b = o[(k + 1) % n], c = i[(k + 1) % n], d = i[k];
    const ny = (b[1] - a[1]) * (c[0] - a[0]) - (b[0] - a[0]) * (c[1] - a[1]);
    if (ny > 0) acc.quadP([a[0], y + h, a[1]], [b[0], y + h, b[1]], [c[0], y + h, c[1]], [d[0], y + h, d[1]], [0, 0, 1, 0.3]);
    else acc.quadP([a[0], y + h, a[1]], [d[0], y + h, d[1]], [c[0], y + h, c[1]], [b[0], y + h, b[1]], [0, 0, 1, 0.3]);
  }
}

/** A flat disc facing up (a pond's water, a basin's water, a lawn circle). */
export function disc(acc, x, y, z, r, n = 16, uvm = 0) {
  const c = acc.v(x, y, z, uvm ? x / uvm : 0.5, uvm ? z / uvm : 0.5);
  const ids = [];
  for (let k = 0; k < n; k++) {
    const a = (k / n) * TAU, px = x + Math.cos(a) * r, pz = z + Math.sin(a) * r;
    ids.push(acc.v(px, y, pz, uvm ? px / uvm : 0.5 + Math.cos(a) * 0.5, uvm ? pz / uvm : 0.5 + Math.sin(a) * 0.5));
  }
  // (counter-clockwise seen from above with z south → (c, k+1, k) faces up)
  for (let k = 0; k < n; k++) acc.tri(c, ids[(k + 1) % n], ids[k]);
}

// ------------------------------------------------------------------ quads

/**
 * An upright quad centred (x, y0..y0+h, z), w wide, facing ry (its normal
 * is the local +z: (sin ry, cos ry)). uv [u0, v0, u1, v1].
 */
export function panel(acc, x, y0, z, w, h, ry, uv = [0, 0, 1, 1]) {
  const c = Math.cos(ry), s = Math.sin(ry);
  const hw = w / 2;
  acc.quadP([x - hw * c, y0, z + hw * s], [x + hw * c, y0, z - hw * s], [x + hw * c, y0 + h, z - hw * s], [x - hw * c, y0 + h, z + hw * s], uv);
}

/** A flat quad facing up at y (a decal: a helipad, a crossing, a grate). */
export function decal(acc, x, y, z, w, d, ry, uv = [0, 0, 1, 1]) {
  const c = Math.cos(ry), s = Math.sin(ry);
  const P = (lx, lz) => [x + lx * c + lz * s, y, z - lx * s + lz * c];
  acc.quadP(P(-w / 2, d / 2), P(w / 2, d / 2), P(w / 2, -d / 2), P(-w / 2, -d / 2), uv);
}

/** A sloped quad (an awning): from the wall at height y0 out d metres dropping to y1. */
export function slope(acc, x, z, w, d, y0, y1, ry, uv = [0, 0, 1, 1]) {
  const c = Math.cos(ry), s = Math.sin(ry);
  const P = (lx, ly, lz) => [x + lx * c + lz * s, ly, z - lx * s + lz * c];
  acc.quadP(P(-w / 2, y1, d), P(w / 2, y1, d), P(w / 2, y0, 0), P(-w / 2, y0, 0), uv);
}

// ------------------------------------------------------------------ nature & clutter

/** A low-poly ball with shared vertices (use a flatShading material for facets). */
export function blob(acc, x, y, z, rx, ry_, rz, seg = 6, rings = 4) {
  const base = acc.count;
  for (let j = 0; j <= rings; j++) {
    const th = (j / rings) * Math.PI;
    for (let i = 0; i <= seg; i++) {
      const ph = (i / seg) * TAU;
      acc.v(x + Math.sin(th) * Math.cos(ph) * rx, y + Math.cos(th) * ry_, z + Math.sin(th) * Math.sin(ph) * rz, i / seg, j / rings);
    }
  }
  const row = seg + 1;
  for (let j = 0; j < rings; j++) {
    for (let i = 0; i < seg; i++) {
      const a = base + j * row + i, b = a + 1, c = a + row, d = c + 1;
      if (j > 0) acc.tri(a, b, c);
      if (j < rings - 1) acc.tri(b, d, c);
    }
  }
}

/**
 * A street tree: a trunk and a canopy of two or three blobs. kind: 'locust'
 * (airy, light: downtown's plaza and Main St), 'plane' (big, broad: uptown's
 * avenues), 'elm' (tall vase), 'linden' (round). leaf acc should have
 * vertex colours (acc.col set per tree); t in 0..1 varies it.
 */
export function tree(trunk, leaf, x, y, z, s, kind, t) {
  const k = { locust: [3.6, 2.3, 0.15], plane: [4.4, 3.5, 0.27], elm: [4.6, 3.4, 0.24], linden: [3.8, 2.9, 0.22], pine: [3, 2.2, 0.2] }[kind] || [4, 3, 0.22];
  const [hTrunk, rCan, rTrunk] = k;
  trunk.cyl(x, y - 0.3, z, rTrunk * s, (hTrunk + 0.3) * s, 5, rTrunk * 0.75 * s);
  const top = y + hTrunk * s;
  const R = rCan * s;
  const a = t * TAU;
  const ca = Math.cos(a), sa = Math.sin(a);
  if (kind === 'pine') {
    blob(leaf, x, top + R, z, R * 0.8, R * 1.6, R * 0.8, 5, 4);
    return;
  }
  // the trunk forks into two or three limbs up into the crown
  const limbs = kind === 'elm' ? 3 : 2;
  for (let q = 0; q < limbs; q++) {
    const b = a + (q / limbs) * TAU;
    const spread = kind === 'elm' ? 0.75 : 0.5;
    trunk.beam(x, top - 0.6 * s, z, x + Math.cos(b) * R * spread, top + R * (kind === 'elm' ? 0.9 : 0.55), z + Math.sin(b) * R * spread, rTrunk * 1.1 * s, rTrunk * 1.1 * s);
  }
  if (kind === 'elm') {
    // a vase: wide and high, open below
    blob(leaf, x, top + R * 1.15, z, R * 1.2, R * 0.62, R * 1.2, 7, 4);
    blob(leaf, x + ca * R * 0.55, top + R * 0.85, z + sa * R * 0.55, R * 0.7, R * 0.5, R * 0.7, 5, 3);
    blob(leaf, x - ca * R * 0.5, top + R * 1.55, z - sa * R * 0.5, R * 0.62, R * 0.42, R * 0.62, 5, 3);
  } else if (kind === 'locust') {
    // light and open: three loose clumps
    for (let q = 0; q < 3; q++) {
      const b = a + (q / 3) * TAU;
      blob(leaf, x + Math.cos(b) * R * 0.5, top + R * (0.55 + 0.25 * (q % 2)), z + Math.sin(b) * R * 0.5, R * 0.62, R * 0.45, R * 0.62, 5, 3);
    }
  } else {
    // round and full (linden), broad (plane)
    const wide = kind === 'plane' ? 1.15 : 1;
    blob(leaf, x, top + R * 0.75, z, R * wide, R * 0.8, R * wide, 7, 4);
    blob(leaf, x + ca * R * 0.5, top + R * 1.15, z + sa * R * 0.5, R * 0.62, R * 0.52, R * 0.62, 5, 3);
    blob(leaf, x - ca * R * 0.55, top + R * 0.45, z - sa * R * 0.55, R * 0.58 * wide, R * 0.45, R * 0.58 * wide, 5, 3);
  }
}

/** A low-poly car (body and cabin) in acc's current colour; glass in glass acc. */
export function car(acc, glass, x, y, z, ry, len = 4.4, wid = 1.8) {
  // (ry: the car's heading, along its local z)
  const c = Math.cos(ry), s = Math.sin(ry);
  acc.box(x, y + 0.28, z, wid, 0.72, len, ry);
  (glass || acc).box(x - s * 0.2, y + 1.0, z - c * 0.2, wid * 0.86, 0.52, len * 0.5, ry);
}
