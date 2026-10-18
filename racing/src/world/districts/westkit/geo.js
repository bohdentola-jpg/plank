// PORT HALCYON — the west's extra geometry helpers (on top of builder.js's
// box/prism/gable/hip/cylinder/cone/sphere/lattice/ribbon/drape): pipes
// between any two points, lathed shapes (stacks, silos, furnaces, cypress),
// barn and hangar roofs, sawtooth sheds, fences that follow the ground,
// strings of lights, ground drapes with turned uvs (crop rows), and a local
// frame for building things out of parts. Everything takes an Acc (B.acc(mat)
// or B.near(mat)); faces wind counter-clockwise seen from outside.
import * as THREE from 'three';
import { box } from '../builder.js';

/** A local frame: (x, y, z) turned ry; local x → (cos ry, −sin ry), z → (sin ry, cos ry). */
export class Fr {
  constructor(x, y, z, ry = 0) { this.set(x, y, z, ry); }
  set(x, y, z, ry = 0) { this.x = x; this.y = y; this.z = z; this.ry = ry; this.c = Math.cos(ry); this.s = Math.sin(ry); return this; }
  p(lx, ly, lz) { return [this.x + lx * this.c + lz * this.s, this.y + ly, this.z - lx * this.s + lz * this.c]; }
  wx(lx, lz) { return this.x + lx * this.c + lz * this.s; }
  wz(lx, lz) { return this.z - lx * this.s + lz * this.c; }
  /** A box in this frame (base centre lx, ly, lz), optionally turned dry more. */
  box(acc, lx, ly, lz, w, h, d, o = {}, dry = 0) {
    box(acc, this.wx(lx, lz), this.y + ly, this.wz(lx, lz), w, h, d, this.ry + dry, o);
  }
  /** A child frame at local (lx, ly, lz) turned dry more. */
  sub(lx, ly, lz, dry = 0) { return new Fr(this.wx(lx, lz), this.y + ly, this.wz(lx, lz), this.ry + dry); }
}

/**
 * A square beam from a to b ([x, y, z]), w wide and h deep (faces out; the
 * Acc's own beam winds them inward). o.caps closes its ends.
 */
export function beam(acc, a, b, w, h = w, o = {}) {
  const d = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  const L = Math.hypot(d[0], d[1], d[2]) || 1;
  const t = [d[0] / L, d[1] / L, d[2] / L];
  const [u, v] = basis(t);
  const hw = w / 2, hh = h / 2;
  const C = [[-hw, -hh], [hw, -hh], [hw, hh], [-hw, hh]];
  const at = (p, k) => [p[0] + u[0] * C[k][0] + v[0] * C[k][1], p[1] + u[1] * C[k][0] + v[1] * C[k][1], p[2] + u[2] * C[k][0] + v[2] * C[k][1]];
  const U = o.u || 1;
  for (let k = 0; k < 4; k++) {
    const k1 = (k + 1) % 4;
    acc.quadP(at(a, k1), at(a, k), at(b, k), at(b, k1), [0, 0, (k % 2 ? h : w) / U, L / U]);
  }
  if (o.caps) {
    acc.quadP(at(a, 0), at(a, 1), at(a, 2), at(a, 3));
    acc.quadP(at(b, 3), at(b, 2), at(b, 1), at(b, 0));
  }
}

/** A lattice mast/boom between two points (four chords, zig-zag bracing), faces out. */
export function lattice2(acc, a, b, w, o = {}) {
  const d = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  const L = Math.hypot(d[0], d[1], d[2]) || 1;
  const t = [d[0] / L, d[1] / L, d[2] / L];
  const [u, v] = basis(t);
  const h = w / 2, bar = o.bar || Math.max(0.06, w * 0.06);
  const w2 = o.w2 ?? w;
  const corner = (p, i, j, f) => { const hh = (h + (w2 / 2 - h) * f); return [p[0] + (u[0] * i + v[0] * j) * hh, p[1] + (u[1] * i + v[1] * j) * hh, p[2] + (u[2] * i + v[2] * j) * hh]; };
  const C = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
  for (const [i, j] of C) beam(acc, corner(a, i, j, 0), corner(b, i, j, 1), bar, bar);
  const n = Math.max(1, Math.round(L / (o.bay || w * 1.2)));
  for (let k = 0; k < n; k++) {
    const f0 = k / n, f1 = (k + 1) / n;
    const p0 = [a[0] + d[0] * f0, a[1] + d[1] * f0, a[2] + d[2] * f0], p1 = [a[0] + d[0] * f1, a[1] + d[1] * f1, a[2] + d[2] * f1];
    for (let e = 0; e < 4; e++) {
      const [i0, j0] = C[e], [i1, j1] = C[(e + 1) % 4];
      const A = k % 2 ? corner(p0, i0, j0, f0) : corner(p1, i0, j0, f1), Bq = k % 2 ? corner(p1, i1, j1, f1) : corner(p0, i1, j1, f0);
      beam(acc, A, Bq, bar * 0.7, bar * 0.7);
    }
  }
}

/** Unit vector helpers. */
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };

/** Basis round axis t: two unit vectors perpendicular to it. */
function basis(t) {
  const up = Math.abs(t[1]) > 0.9 ? [1, 0, 0] : [0, 1, 0];
  const u = norm(cross(t, up));
  const v = cross(u, t);
  return [u, v];
}

/**
 * A pipe from a to b ([x, y, z]), radius r (r2 at b), seg sides. o.caps:
 * close both ends; o.u: metres per texture repeat round it.
 */
export function tube(acc, a, b, r, seg = 8, o = {}) {
  const d = sub(b, a);
  const L = Math.hypot(d[0], d[1], d[2]) || 1;
  const t = [d[0] / L, d[1] / L, d[2] / L];
  const [u, v] = basis(t);
  const r2 = o.r2 ?? r;
  const U = o.u || 2;
  const ring = (p, rr, k) => {
    const an = (k / seg) * Math.PI * 2, ca = Math.cos(an), sa = Math.sin(an);
    return [p[0] + (u[0] * ca + v[0] * sa) * rr, p[1] + (u[1] * ca + v[1] * sa) * rr, p[2] + (u[2] * ca + v[2] * sa) * rr];
  };
  const arc = (2 * Math.PI * r) / seg;
  // (the ring turns clockwise seen from b's end: k+1 before k faces out)
  for (let k = 0; k < seg; k++) {
    acc.quadP(ring(a, r, k + 1), ring(a, r, k), ring(b, r2, k), ring(b, r2, k + 1), [((k + 1) * arc) / U, 0, (k * arc) / U, L / U]);
  }
  if (o.caps) {
    for (const [p, rr, dir] of [[a, r, -1], [b, r2, 1]]) {
      const c = acc.v(p[0], p[1], p[2], 0.5, 0.5);
      const ids = [];
      for (let k = 0; k < seg; k++) { const q = ring(p, rr, k); ids.push(acc.v(q[0], q[1], q[2], 0.5, 0.5)); }
      for (let k = 0; k < seg; k++) {
        if (dir > 0) acc.tri(c, ids[(k + 1) % seg], ids[k]);
        else acc.tri(c, ids[k], ids[(k + 1) % seg]);
      }
    }
  }
}

/**
 * Surface of revolution round a vertical axis at (x, y, z): prof = [[r, h],
 * …] bottom to top (r 0 closes it). seg sides; o.u/o.v metres per repeat;
 * o.top closes the last ring with a flat cap; o.a0/o.a1 an arc only.
 */
export function lathe(acc, x, y, z, prof, seg = 10, o = {}) {
  const U = o.u || 2, V = o.v || o.u || 2;
  const a0 = o.a0 ?? 0, a1 = o.a1 ?? Math.PI * 2;
  let vAcc = 0;
  for (let j = 0; j < prof.length - 1; j++) {
    const [ra, ha] = prof[j], [rb, hb] = prof[j + 1];
    const sl = Math.hypot(rb - ra, hb - ha);
    for (let k = 0; k < seg; k++) {
      const p0 = a0 + (a1 - a0) * (k / seg), p1 = a0 + (a1 - a0) * ((k + 1) / seg);
      const c0 = Math.cos(p0), s0 = Math.sin(p0), c1 = Math.cos(p1), s1 = Math.sin(p1);
      const rm = Math.max(ra, rb, 0.01);
      const u0 = (p0 * rm) / U, u1 = (p1 * rm) / U;
      acc.quadP(
        [x + c1 * ra, y + ha, z + s1 * ra], [x + c0 * ra, y + ha, z + s0 * ra],
        [x + c0 * rb, y + hb, z + s0 * rb], [x + c1 * rb, y + hb, z + s1 * rb],
        [u1, vAcc / V, u0, (vAcc + sl) / V],
      );
    }
    vAcc += sl;
  }
  if (o.top) {
    const [r, h] = prof[prof.length - 1];
    if (r > 0.01) {
      const c = acc.v(x, y + h, z, 0.5, 0.5);
      const ids = [];
      for (let k = 0; k <= seg; k++) { const p = a0 + (a1 - a0) * (k / seg); ids.push(acc.v(x + Math.cos(p) * r, y + h, z + Math.sin(p) * r, 0.5 + Math.cos(p) * 0.5, 0.5 + Math.sin(p) * 0.5)); }
      for (let k = 0; k < seg; k++) acc.tri(c, ids[k + 1], ids[k]);
    }
  }
}

/**
 * Gambrel (barn) roof over a w × d box top at height y, ridge along local x:
 * lower slopes steep, upper slopes shallow. Ends (two pentagons) into endAcc.
 */
export function gambrel(acc, endAcc, x, y, z, w, d, ry, o = {}) {
  const F = new Fr(x, y, z, ry);
  const ov = o.over ?? 0.5, U = o.u || 2;
  const hd = d / 2, hw = w / 2 + ov;
  const kz = hd * (o.knee ?? 0.62), ky = o.kneeH ?? d * 0.34, ry2 = ky + (o.ridgeH ?? d * 0.16);
  const ez = hd + ov, ey = -ov * (ky / (hd - kz));
  // slopes (front +z then back −z), each lower then upper
  const sl = (z0, y0, z1, y1) => Math.hypot(z1 - z0, y1 - y0);
  for (const sgn of [1, -1]) {
    const A = [ez * sgn, ey], K = [kz * sgn, ky], R = [0, ry2];
    const seg = [[A, K], [K, R]];
    for (const [p, q] of seg) {
      const L = sl(p[0], p[1], q[0], q[1]);
      if (sgn > 0) acc.quadP(F.p(-hw, p[1], p[0]), F.p(hw, p[1], p[0]), F.p(hw, q[1], q[0]), F.p(-hw, q[1], q[0]), [0, 0, (2 * hw) / U, L / U]);
      else acc.quadP(F.p(hw, p[1], p[0]), F.p(-hw, p[1], p[0]), F.p(-hw, q[1], q[0]), F.p(hw, q[1], q[0]), [0, 0, (2 * hw) / U, L / U]);
    }
  }
  // the ends: pentagons in the wall planes
  const e = endAcc || acc;
  for (const sx of [1, -1]) {
    const lx = (w / 2) * sx;
    const pts = [[hd, 0], [kz, ky], [0, ry2], [-kz, ky], [-hd, 0]];
    const ids = pts.map(([lz, ly]) => e.v(...F.p(lx, ly, lz), (lz + hd) / U, ly / U));
    for (let k = 1; k < pts.length - 1; k++) {
      if (sx > 0) e.tri(ids[0], ids[k + 1], ids[k]);
      else e.tri(ids[0], ids[k], ids[k + 1]);
    }
  }
}

/**
 * Quonset / hangar: a half-barrel along local x (length w), span d, at base
 * centre (x, y, z) turned ry, rising d/2 (o.rise to flatten or lift it).
 * The two arch ends go to endAcc (fan from the base centre).
 */
export function quonset(acc, endAcc, x, y, z, w, d, ry, o = {}) {
  const F = new Fr(x, y, z, ry);
  const n = o.seg || 10, U = o.u || 2;
  const rise = o.rise ?? d / 2;
  const hw = w / 2;
  const pt = (k) => { const a = Math.PI * (k / n); return [Math.cos(a) * d / 2, Math.sin(a) * rise]; };
  let s = 0;
  for (let k = 0; k < n; k++) {
    const [z0, y0] = pt(k), [z1, y1] = pt(k + 1);
    const L = Math.hypot(z1 - z0, y1 - y0);
    // outward: from z = +d/2 up over the top to −d/2
    acc.quadP(F.p(-hw, y0, z0), F.p(hw, y0, z0), F.p(hw, y1, z1), F.p(-hw, y1, z1), [0, s / U, (2 * hw) / U, (s + L) / U]);
    s += L;
  }
  if (endAcc !== false) {
    const e = endAcc || acc;
    for (const sx of [1, -1]) {
      const c = e.v(...F.p(sx * hw, 0, 0), 0.5, 0);
      const ids = [];
      for (let k = 0; k <= n; k++) { const [lz, ly] = pt(k); ids.push(e.v(...F.p(sx * hw, ly, lz), (lz + d / 2) / U, ly / U)); }
      for (let k = 0; k < n; k++) { if (sx > 0) e.tri(c, ids[k + 1], ids[k]); else e.tri(c, ids[k], ids[k + 1]); }
    }
  }
}

/**
 * Sawtooth roof over a w × d box top at y: n teeth along local z, each a
 * steep glazed face (to glassAcc, facing −z) and a long sloped back.
 */
export function sawtooth(acc, glassAcc, x, y, z, w, d, ry, n, rise, o = {}) {
  const F = new Fr(x, y, z, ry);
  const hw = w / 2, U = o.u || 2;
  const tw = d / n;
  for (let k = 0; k < n; k++) {
    const z0 = -d / 2 + k * tw, z1 = z0 + tw;
    // the long slope rises from z1 (low) back to z0 (high)
    const L = Math.hypot(tw, rise);
    acc.quadP(F.p(-hw, 0, z1), F.p(hw, 0, z1), F.p(hw, rise, z0), F.p(-hw, rise, z0), [0, 0, (2 * hw) / U, L / U]);
    // the glazed face at z0 facing −z
    (glassAcc || acc).quadP(F.p(hw, 0, z0), F.p(-hw, 0, z0), F.p(-hw, rise, z0), F.p(hw, rise, z0), [0, 0, (2 * hw) / U, rise / U]);
    // the triangles at the sides
    for (const sx of [1, -1]) {
      const a = acc.v(...F.p(sx * hw, 0, z0), 0, 0), b = acc.v(...F.p(sx * hw, 0, z1), tw / U, 0), c = acc.v(...F.p(sx * hw, rise, z0), 0, rise / U);
      if (sx > 0) acc.tri(a, c, b); else acc.tri(a, b, c);
    }
  }
}

/** A quad seen from both sides (signs, fences, leaves). */
export function quad2(acc, A, B, C, D, uv = [0, 0, 1, 1]) {
  acc.quadP(A, B, C, D, uv);
  acc.quadP(B, A, D, C, [uv[2], uv[1], uv[0], uv[3]]);
}

/**
 * A vertical wall along world points pts ([[x, z], …]) from ground-ish y0s
 * to y1s (arrays or fns of (x, z)), facing its left ((tz, −tx)) side; o.both
 * for both faces. uv: u in metres / o.u along, v in metres / o.v up.
 */
export function wallAlong(acc, pts, y0, y1, o = {}) {
  const U = o.u || 2, V = o.v || U;
  let s = 0;
  const Y0 = (p, i) => (typeof y0 === 'function' ? y0(p[0], p[1], i) : Array.isArray(y0) ? y0[i] : y0);
  const Y1 = (p, i) => (typeof y1 === 'function' ? y1(p[0], p[1], i) : Array.isArray(y1) ? y1[i] : y1);
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], b = pts[i + 1];
    const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const a0 = Y0(a, i), a1 = Y1(a, i), b0 = Y0(b, i + 1), b1 = Y1(b, i + 1);
    const uv = [s / U, Math.min(a0, b0) / V, (s + L) / U, Math.max(a1, b1) / V];
    acc.quadP([b[0], b0, b[1]], [a[0], a0, a[1]], [a[0], a1, a[1]], [b[0], b1, b[1]], [uv[2], uv[1], uv[0], uv[3]]);
    if (o.both) acc.quadP([a[0], a0, a[1]], [b[0], b0, b[1]], [b[0], b1, b[1]], [a[0], a1, a[1]], uv);
    s += L;
  }
}

/**
 * A fence along world points following the ground (gy(x, z)): posts every
 * `every` m (postAcc), rails (railAcc) at heights `rails` (each [h, size]).
 * o.post: [w, h]; o.wire: rails as thin flat strips.
 */
export function fence(postAcc, railAcc, pts, gy, o = {}) {
  const every = o.every || 3;
  const pw = o.post?.[0] ?? 0.14, ph = o.post?.[1] ?? 1.3;
  const rails = o.rails || [[0.5, 0.1], [1.0, 0.1]];
  let prev = null;
  let s = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], b = pts[i + 1];
    const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (L < 0.01) continue;
    const n = Math.max(1, Math.round(L / every));
    const ry = Math.atan2(b[0] - a[0], b[1] - a[1]);
    for (let k = i ? 1 : 0; k <= n; k++) {
      const t = k / n;
      const x = a[0] + (b[0] - a[0]) * t, z = a[1] + (b[1] - a[1]) * t;
      const y = gy(x, z);
      if (postAcc) box(postAcc, x, y - 0.3, z, pw, ph + 0.3, pw, ry, { u: 1, top: true });
      if (prev && railAcc) {
        for (const [h, sz] of rails) {
          if (o.wire) {
            railAcc.quadP([prev[0], prev[2] + h, prev[1]], [x, y + h, z], [x, y + h + sz, z], [prev[0], prev[2] + h + sz, prev[1]], [s, 0, s + L / n, 1]);
            railAcc.quadP([x, y + h, z], [prev[0], prev[2] + h, prev[1]], [prev[0], prev[2] + h + sz, prev[1]], [x, y + h + sz, z], [s, 0, s + L / n, 1]);
          } else beam(railAcc, [prev[0], prev[2] + h, prev[1]], [x, y + h, z], sz * 0.6, sz);
        }
      }
      prev = [x, z, y];
      s += L / n;
    }
  }
}

/** Bulbs along a sagging wire from a to b ([x, y, z]): n bulbs (glowAcc), the wire (wireAcc). */
export function stringLights(glowAcc, wireAcc, a, b, n, sag = 0.6, size = 0.16) {
  let prev = a;
  for (let k = 1; k <= n + 1; k++) {
    const t = k / (n + 1);
    const p = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t - Math.sin(Math.PI * t) * sag, a[2] + (b[2] - a[2]) * t];
    if (wireAcc) beam(wireAcc, prev, p, 0.03, 0.03);
    if (k <= n && glowAcc) box(glowAcc, p[0], p[1] - size, p[2], size, size * 1.3, size, 0, { u: 1 });
    prev = p;
  }
}

/**
 * A ground drape (like builder's drape) whose uvs are turned: u along
 * (cos a, sin a) in x/z, v across, both in metres / uv; o.col sets the
 * vertex colour (an Acc with colours); o.lift, o.step as drape.
 */
export function drapeUV(acc, B, poly, o = {}) {
  const lift = o.lift ?? 0.06, step = o.step ?? 4, uv = o.uv ?? 4, ang = o.ang ?? 0;
  const ca = Math.cos(ang), sa = Math.sin(ang);
  const tri = THREE.ShapeUtils.triangulateShape(poly.map((p) => new THREE.Vector2(p[0], p[1])), []);
  const verts = new Map();
  if (o.col && acc.c) acc.col = o.col;
  const gy = o.gy || ((x, z) => B.groundY(x, z));
  const vid = (p) => {
    const k = `${Math.round(p[0] * 20)},${Math.round(p[1] * 20)}`;
    let i = verts.get(k);
    if (i === undefined) {
      const u = (p[0] * ca + p[1] * sa) / uv, v = (-p[0] * sa + p[1] * ca) / uv;
      i = acc.v(p[0], gy(p[0], p[1]) + lift, p[1], u, v);
      verts.set(k, i);
    }
    return i;
  };
  const d = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
  const mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  const emit = (a, b, c) => {
    const ny = (b[1] - a[1]) * (c[0] - a[0]) - (b[0] - a[0]) * (c[1] - a[1]);
    if (ny > 0) acc.tri(vid(a), vid(b), vid(c)); else acc.tri(vid(a), vid(c), vid(b));
  };
  const split = (a, b, c, depth) => {
    const ab = d(a, b), bc = d(b, c), ca2 = d(c, a);
    const m = Math.max(ab, bc, ca2);
    if (m <= step || depth > 14) { emit(a, b, c); return; }
    if (m === ab) { const p = mid(a, b); split(a, p, c, depth + 1); split(p, b, c, depth + 1); }
    else if (m === bc) { const p = mid(b, c); split(a, b, p, depth + 1); split(a, p, c, depth + 1); }
    else { const p = mid(c, a); split(a, b, p, depth + 1); split(p, b, c, depth + 1); }
  };
  for (const t of tri) split(poly[t[0]], poly[t[1]], poly[t[2]], 0);
  if (o.col && acc.c) acc.col = [1, 1, 1];
}

/** Set an Acc's vertex colour for what follows (no-op without colours); returns the Acc. */
export function col(acc, c) {
  if (acc.c) acc.col = c;
  return acc;
}

/** A flat disc/polygon at height y facing up (fan), world points. */
export function fan(acc, pts, y, uv = 4) {
  let cx = 0, cz = 0;
  for (const p of pts) { cx += p[0]; cz += p[1]; }
  cx /= pts.length; cz /= pts.length;
  const c = acc.v(cx, y, cz, cx / uv, cz / uv);
  const ids = pts.map((p) => acc.v(p[0], y, p[1], p[0] / uv, p[1] / uv));
  for (let k = 0; k < pts.length; k++) {
    const a = pts[k], b = pts[(k + 1) % pts.length];
    const ny = (a[1] - cz) * (b[0] - cx) - (a[0] - cx) * (b[1] - cz);
    if (ny > 0) acc.tri(c, ids[k], ids[(k + 1) % pts.length]); else acc.tri(c, ids[(k + 1) % pts.length], ids[k]);
  }
}

/** A tapered, slightly bent low-poly limb (branch, twisted olive trunk) through points. */
export function limb(acc, pts, r0, r1, seg = 5) {
  const n = pts.length - 1;
  for (let i = 0; i < n; i++) {
    const ra = r0 + (r1 - r0) * (i / n), rb = r0 + (r1 - r0) * ((i + 1) / n);
    tube(acc, pts[i], pts[i + 1], ra, seg, { r2: rb, u: 1 });
  }
}
