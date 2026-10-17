// PORT HALCYON — building a district's share of one world cell. A pack's
// build(B, items) is a generator (yield every so often: the streamer runs it
// a few milliseconds a frame) and draws with:
//   B.cx, B.cz, B.x0, B.z0          the cell
//   B.rng(), B.range, B.pick         seeded per cell and pack
//   B.groundY(x, z)                  the built ground (exact: what cars drive on)
//   B.footY(x, z, w, d, ry)          { lo, hi } ground under a footprint
//   B.acc(mat)                       geometry for one material, merged per cell
//   B.near(mat)                      the same, drawn only close up (props, clutter)
//   B.group                          the cell's group (instanced/animated meshes)
//   B.anim(fn)                       fn(t, dt, d) each frame while the cell lives
//                                    (d: camera's distance to the cell)
//   B.mat(key, make)                 a material made once for the whole world
// Geometry helpers below take an Acc (B.acc(mat)): boxes and prisms with
// their uvs in metres (so facade textures tile by the storey), roofs,
// cylinders, cones, spheres, arches, lattice beams.
import * as THREE from 'three';
import { makeRng } from '../../core/util.js';
import { CELL } from '../terrain.js';
import { glowMat, nightEmissive } from '../kit.js';

const MATS = new Map();

export class Builder {
  constructor(D, cx, cz, pack, out) {
    this.D = D;
    this.cx = cx; this.cz = cz;
    this.x0 = cx * CELL; this.z0 = cz * CELL;
    this.pack = pack;
    this.batch = out.batch;
    this.nearBatch = out.nearBatch;
    this.group = out.group;
    this.out = out;
    this.rng = makeRng(`build:${pack.id}:${cx}:${cz}`);
    this.terrain = D.terrain;
    this.net = D.net;
  }
  pick(a) { return a[Math.floor(this.rng() * a.length) % a.length]; }
  range(a, b) { return a + (b - a) * this.rng(); }
  groundY(x, z) { return this.terrain.heightAt(x, z); }
  footY(x, z, w, d, ry) {
    const c = Math.cos(ry), s = Math.sin(ry);
    let lo = Infinity, hi = -Infinity;
    for (const [a, b] of [[0, 0], [-1, -1], [1, -1], [1, 1], [-1, 1], [0, -1], [0, 1], [-1, 0], [1, 0]]) {
      const lx = a * w / 2, lz = b * d / 2;
      const y = this.terrain.heightAt(x + lx * c + lz * s, z - lx * s + lz * c);
      lo = Math.min(lo, y); hi = Math.max(hi, y);
    }
    return { lo, hi };
  }
  acc(mat) { return this.batch.get(mat, !!mat.vertexColors); }
  near(mat) { return this.nearBatch.get(mat, !!mat.vertexColors); }
  anim(fn) { this.out.anims.push(fn); }
  mat(key, make) {
    const k = `${this.pack.id}:${key}`;
    if (!MATS.has(k)) MATS.set(k, make());
    return MATS.get(k);
  }
}

/** Every pack material made so far (for compiling them all up front). */
export function packMaterials() { return [...MATS.values()]; }

// ------------------------------------------------------------------ materials

/**
 * A material that takes the street lamps' baked light at night (most
 * things at street level should). params: MeshStandardMaterial params.
 * night: if it has an emissive (map), how bright that glows at night (lit
 * windows, signs); it fades out by day.
 */
export function litMat(params, { night = 0, glow = 2.6, shadow = true } = {}) {
  const m = glowMat(params, glow);
  if (night > 0) nightEmissive(m, night);
  m.userData.castShadow = shadow;
  return m;
}

/** A plain material (no baked light: high up, or unlit things far from lamps). */
export function plainMat(params, { night = 0, shadow = true } = {}) {
  const m = new THREE.MeshStandardMaterial(params);
  if (night > 0) nightEmissive(m, night);
  m.userData.castShadow = shadow;
  return m;
}

/** A glowing thing (neon, a lit sign, lamp glass): unlit, bright, bloom does the rest. */
export function glowColorMat(hex, k = 3) {
  return new THREE.MeshBasicMaterial({ color: new THREE.Color(hex).multiplyScalar(k), toneMapped: true });
}

// ------------------------------------------------------------------ geometry

/**
 * Box from its base centre (x, y, z): w along local x, h up, d along local
 * z, turned ry (local x → (cos ry, −sin ry), local z → (sin ry, cos ry)).
 * o: { u: metres per texture repeat across, v: metres per repeat up (per
 * face, so a facade tiles by the storey), top (true), bottom (false),
 * faces: which of 'f','b','l','r' to draw (default all), u0/v0 offsets }.
 */
export function box(acc, x, y, z, w, h, d, ry = 0, o = {}) {
  const c = Math.cos(ry), s = Math.sin(ry);
  const P = (lx, ly, lz) => [x + lx * c + lz * s, y + ly, z - lx * s + lz * c];
  const hw = w / 2, hd = d / 2;
  const U = o.u || 1, V = o.v || o.u || 1;
  const u0 = o.u0 || 0, v0 = o.v0 || 0;
  const F = o.faces || 'fblr';
  const vt = v0 + h / V;
  if (F.includes('f')) acc.quadP(P(-hw, 0, hd), P(hw, 0, hd), P(hw, h, hd), P(-hw, h, hd), [u0, v0, u0 + w / U, vt]);
  if (F.includes('b')) acc.quadP(P(hw, 0, -hd), P(-hw, 0, -hd), P(-hw, h, -hd), P(hw, h, -hd), [u0, v0, u0 + w / U, vt]);
  if (F.includes('r')) acc.quadP(P(hw, 0, hd), P(hw, 0, -hd), P(hw, h, -hd), P(hw, h, hd), [u0, v0, u0 + d / U, vt]);
  if (F.includes('l')) acc.quadP(P(-hw, 0, -hd), P(-hw, 0, hd), P(-hw, h, hd), P(-hw, h, -hd), [u0, v0, u0 + d / U, vt]);
  if (o.top !== false) {
    const tu = o.topU || U;
    acc.quadP(P(-hw, h, hd), P(hw, h, hd), P(hw, h, -hd), P(-hw, h, -hd), [0, 0, w / tu, d / tu]);
  }
  if (o.bottom) acc.quadP(P(-hw, 0, -hd), P(hw, 0, -hd), P(hw, 0, hd), P(-hw, 0, hd), [0, 0, w / U, d / U]);
}

/**
 * Upright prism: a polygon (local [x, z] points, counter-clockwise seen from
 * above in the world: i.e. turning left as you walk it with +z south) placed
 * at (x, z) turned ry, from y0 to y1. Walls uv'd in metres (u, v); a top cap.
 */
export function prism(acc, poly, x, z, y0, y1, ry = 0, o = {}) {
  const c = Math.cos(ry), s = Math.sin(ry);
  const W = poly.map(([lx, lz]) => [x + lx * c + lz * s, z - lx * s + lz * c]);
  const U = o.u || 1, V = o.v || o.u || 1;
  // wind the walls so they face out whichever way the polygon goes
  let area = 0;
  for (let i = 0; i < W.length; i++) { const a = W[i], b = W[(i + 1) % W.length]; area += a[0] * b[1] - b[0] * a[1]; }
  const flip = area > 0;
  let u = 0;
  for (let i = 0; i < W.length; i++) {
    const a = W[i], b = W[(i + 1) % W.length];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (o.walls !== false) {
      if (!flip) acc.quadP([a[0], y0, a[1]], [b[0], y0, b[1]], [b[0], y1, b[1]], [a[0], y1, a[1]], [u / U, 0, (u + len) / U, (y1 - y0) / V]);
      else acc.quadP([b[0], y0, b[1]], [a[0], y0, a[1]], [a[0], y1, a[1]], [b[0], y1, b[1]], [(u + len) / U, 0, u / U, (y1 - y0) / V]);
    }
    u += len;
  }
  if (o.top !== false) cap(acc, W, y1, true, o.topU || U);
  if (o.bottom) cap(acc, W, y0, false, o.topU || U);
}

/** A flat polygon at height y facing up (or down). pts: world [x, z]. */
export function cap(acc, pts, y, up = true, uv = 1) {
  const tri = THREE.ShapeUtils.triangulateShape(pts.map((p) => new THREE.Vector2(p[0], p[1])), []);
  const base = acc.count;
  for (const p of pts) acc.v(p[0], y, p[1], p[0] / uv, p[1] / uv);
  for (const t of tri) {
    const a = pts[t[0]], b = pts[t[1]], c = pts[t[2]];
    // y of (b − a) × (c − a): > 0 faces up in this order
    const ny = (b[1] - a[1]) * (c[0] - a[0]) - (b[0] - a[0]) * (c[1] - a[1]);
    if ((ny > 0) === up) acc.tri(base + t[0], base + t[1], base + t[2]);
    else acc.tri(base + t[0], base + t[2], base + t[1]);
  }
}

/**
 * Gable roof over a w × d box top at height y: ridge along local x (or z
 * with alongZ), rising `rise`, eaves `over`hanging. Two slopes (uv in
 * metres) and the two gable ends (to `endAcc`, default the same).
 */
export function gable(acc, x, y, z, w, d, rise, ry = 0, o = {}) {
  const c = Math.cos(ry), s = Math.sin(ry);
  const P = (lx, ly, lz) => [x + lx * c + lz * s, y + ly, z - lx * s + lz * c];
  const ov = o.over ?? 0.4;
  const U = o.u || 2;
  const ends = o.endAcc || acc;
  if (!o.alongZ) {
    const hw = w / 2 + ov, hd = d / 2 + ov;
    const sl = Math.hypot(hd, rise);
    acc.quadP(P(-hw, 0, hd), P(hw, 0, hd), P(hw, rise, 0), P(-hw, rise, 0), [0, 0, (2 * hw) / U, sl / U]);
    acc.quadP(P(hw, 0, -hd), P(-hw, 0, -hd), P(-hw, rise, 0), P(hw, rise, 0), [0, 0, (2 * hw) / U, sl / U]);
    // gable triangles (in the wall plane)
    const ew = w / 2, ed = d / 2;
    const a = ends.v(...P(ew, 0, ed), 0, 0), b = ends.v(...P(ew, 0, -ed), d / U, 0), t = ends.v(...P(ew, rise, 0), d / 2 / U, rise / U);
    ends.tri(a, b, t);
    const a2 = ends.v(...P(-ew, 0, -ed), 0, 0), b2 = ends.v(...P(-ew, 0, ed), d / U, 0), t2 = ends.v(...P(-ew, rise, 0), d / 2 / U, rise / U);
    ends.tri(a2, b2, t2);
  } else {
    gable(acc, x, y, z, d, w, rise, ry + Math.PI / 2, { ...o, alongZ: false });
  }
}

/** Hip roof (four slopes to a ridge, or a point if square). */
export function hip(acc, x, y, z, w, d, rise, ry = 0, o = {}) {
  if (d > w) { hip(acc, x, y, z, d, w, rise, ry + Math.PI / 2, o); return; }
  const c = Math.cos(ry), s = Math.sin(ry);
  const P = (lx, ly, lz) => [x + lx * c + lz * s, y + ly, z - lx * s + lz * c];
  const ov = o.over ?? 0.4;
  const U = o.u || 2;
  const hw = w / 2 + ov, hd = d / 2 + ov;
  const r = Math.max(0, hw - hd);       // half ridge length along x
  const A = P(-hw, 0, hd), B = P(hw, 0, hd), C = P(hw, 0, -hd), Dd = P(-hw, 0, -hd);
  const R1 = P(-r, rise, 0), R2 = P(r, rise, 0);
  acc.quadP(A, B, R2, R1, [0, 0, 2 * hw / U, rise / U]);
  acc.quadP(C, Dd, R1, R2, [0, 0, 2 * hw / U, rise / U]);
  const t1a = acc.v(...B, 0, 0), t1b = acc.v(...C, 2 * hd / U, 0), t1c = acc.v(...R2, hd / U, rise / U);
  acc.tri(t1a, t1b, t1c);
  const t2a = acc.v(...Dd, 0, 0), t2b = acc.v(...A, 2 * hd / U, 0), t2c = acc.v(...R1, hd / U, rise / U);
  acc.tri(t2a, t2b, t2c);
}

/** Upright cylinder (caps optional), seg sides, radius r (to r2 at the top). */
export function cylinder(acc, x, y, z, r, h, seg = 10, o = {}) {
  const r2 = o.r2 ?? r;
  const U = o.u || (2 * Math.PI * r) / Math.max(1, Math.round(2 * Math.PI * r / 2));
  const V = o.v || o.u || 1;
  for (let i = 0; i < seg; i++) {
    const a0 = (i / seg) * Math.PI * 2, a1 = ((i + 1) / seg) * Math.PI * 2;
    const arc = (2 * Math.PI * r) / seg;
    acc.quadP(
      [x + Math.cos(a1) * r, y, z + Math.sin(a1) * r], [x + Math.cos(a0) * r, y, z + Math.sin(a0) * r],
      [x + Math.cos(a0) * r2, y + h, z + Math.sin(a0) * r2], [x + Math.cos(a1) * r2, y + h, z + Math.sin(a1) * r2],
      [((i + 1) * arc) / U, 0, (i * arc) / U, h / V],
    );
  }
  if (o.top) {
    const cIdx = acc.v(x, y + h, z, 0.5, 0.5);
    const ring = [];
    for (let i = 0; i <= seg; i++) { const a = (i / seg) * Math.PI * 2; ring.push(acc.v(x + Math.cos(a) * r2, y + h, z + Math.sin(a) * r2, 0.5 + Math.cos(a) * 0.5, 0.5 + Math.sin(a) * 0.5)); }
    for (let i = 0; i < seg; i++) acc.tri(cIdx, ring[i + 1], ring[i]);
  }
  if (o.bottom) {
    const cIdx = acc.v(x, y, z, 0.5, 0.5);
    const ring = [];
    for (let i = 0; i <= seg; i++) { const a = (i / seg) * Math.PI * 2; ring.push(acc.v(x + Math.cos(a) * r, y, z + Math.sin(a) * r, 0.5, 0.5)); }
    for (let i = 0; i < seg; i++) acc.tri(cIdx, ring[i], ring[i + 1]);
  }
}

/** Cone (a spire, a conifer, a pile): base radius r at y, point h above. */
export function cone(acc, x, y, z, r, h, seg = 8) {
  const tip = [x, y + h, z];
  for (let i = 0; i < seg; i++) {
    const a0 = (i / seg) * Math.PI * 2, a1 = ((i + 1) / seg) * Math.PI * 2;
    const A = acc.v(x + Math.cos(a1) * r, y, z + Math.sin(a1) * r, (i + 1) / seg, 0);
    const B = acc.v(x + Math.cos(a0) * r, y, z + Math.sin(a0) * r, i / seg, 0);
    const T = acc.v(tip[0], tip[1], tip[2], (i + 0.5) / seg, 1);
    acc.tri(A, B, T);
  }
}

/** Low-poly sphere (o.dome: its top half; o.sy squashes it). */
export function sphere(acc, x, y, z, r, seg = 8, o = {}) {
  const rings = Math.max(2, Math.round(seg / 2));
  const jEnd = o.dome ? Math.ceil(rings / 2) : rings;
  const sy = o.sy || 1;
  const pt = (i, j) => {
    const th = (j / rings) * Math.PI, ph = (i / seg) * Math.PI * 2;
    return [x + Math.sin(th) * Math.cos(ph) * r, y + Math.cos(th) * r * sy, z + Math.sin(th) * Math.sin(ph) * r];
  };
  for (let j = 0; j < jEnd; j++) {
    for (let i = 0; i < seg; i++) {
      acc.quadP(pt(i + 1, j + 1), pt(i, j + 1), pt(i, j), pt(i + 1, j), [(i + 1) / seg, (j + 1) / rings, i / seg, j / rings]);
    }
  }
}

/**
 * A round arch in a wall: an opening w wide, springing at height hs, its
 * crown at hs + w/2, wall thickness t, outer extent W × H (the wall around
 * it), at base centre (x, y, z) turned ry (the wall spans local x).
 */
export function archWall(acc, x, y, z, W, H, t, w, hs, ry = 0, o = {}) {
  const c = Math.cos(ry), s = Math.sin(ry);
  const P = (lx, ly, lz) => [x + lx * c + lz * s, y + ly, z - lx * s + lz * c];
  const U = o.u || 2;
  const seg = 8, R = w / 2;
  for (const face of [1, -1]) {
    const lz = (face * t) / 2;
    // the two piers either side of the opening
    const pier = (x0, x1) => {
      const q = face > 0 ? [P(x0, 0, lz), P(x1, 0, lz), P(x1, H, lz), P(x0, H, lz)] : [P(x1, 0, lz), P(x0, 0, lz), P(x0, H, lz), P(x1, H, lz)];
      acc.quadP(q[0], q[1], q[2], q[3], [0, 0, Math.abs(x1 - x0) / U, H / U]);
    };
    pier(-W / 2, -R);
    pier(R, W / 2);
    // the spandrel over the arch, a fan of quads from the arc up to the top
    for (let k = 0; k < seg; k++) {
      const a0 = Math.PI - (k / seg) * Math.PI, a1 = Math.PI - ((k + 1) / seg) * Math.PI;
      const ax0 = Math.cos(a0) * R, ay0 = hs + Math.sin(a0) * R, ax1 = Math.cos(a1) * R, ay1 = hs + Math.sin(a1) * R;
      const q = [P(ax0, ay0, lz), P(ax1, ay1, lz), P(ax1, H, lz), P(ax0, H, lz)];
      if (face > 0) acc.quadP(q[0], q[1], q[2], q[3], [0, 0, 0.5, 0.5]);
      else acc.quadP(q[1], q[0], q[3], q[2], [0, 0, 0.5, 0.5]);
    }
  }
  // the soffit under the arch and the jambs
  for (let k = 0; k < seg; k++) {
    const a0 = Math.PI - (k / seg) * Math.PI, a1 = Math.PI - ((k + 1) / seg) * Math.PI;
    const A = P(Math.cos(a0) * R, hs + Math.sin(a0) * R, t / 2), B = P(Math.cos(a1) * R, hs + Math.sin(a1) * R, t / 2);
    const C = P(Math.cos(a1) * R, hs + Math.sin(a1) * R, -t / 2), Dd = P(Math.cos(a0) * R, hs + Math.sin(a0) * R, -t / 2);
    acc.quadP(A, Dd, C, B, [0, 0, 1, 0.2]);
  }
  acc.quadP(P(-R, 0, t / 2), P(-R, 0, -t / 2), P(-R, hs, -t / 2), P(-R, hs, t / 2), [0, 0, t / U, hs / U]);
  acc.quadP(P(R, 0, -t / 2), P(R, 0, t / 2), P(R, hs, t / 2), P(R, hs, -t / 2), [0, 0, t / U, hs / U]);
  // top and ends
  acc.quadP(P(-W / 2, H, t / 2), P(W / 2, H, t / 2), P(W / 2, H, -t / 2), P(-W / 2, H, -t / 2), [0, 0, W / U, t / U]);
  acc.quadP(P(W / 2, 0, t / 2), P(W / 2, 0, -t / 2), P(W / 2, H, -t / 2), P(W / 2, H, t / 2), [0, 0, t / U, H / U]);
  acc.quadP(P(-W / 2, 0, -t / 2), P(-W / 2, 0, t / 2), P(-W / 2, H, t / 2), P(-W / 2, H, -t / 2), [0, 0, t / U, H / U]);
}

/** A lattice mast/boom between two points: four chords and zig-zag bracing. */
export function lattice(acc, a, b, w, o = {}) {
  const dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2];
  const L = Math.hypot(dx, dy, dz) || 1;
  const t = [dx / L, dy / L, dz / L];
  let up = Math.abs(t[1]) > 0.9 ? [1, 0, 0] : [0, 1, 0];
  const sx = [t[1] * up[2] - t[2] * up[1], t[2] * up[0] - t[0] * up[2], t[0] * up[1] - t[1] * up[0]];
  const sl = Math.hypot(...sx) || 1;
  for (let k = 0; k < 3; k++) sx[k] /= sl;
  up = [sx[1] * t[2] - sx[2] * t[1], sx[2] * t[0] - sx[0] * t[2], sx[0] * t[1] - sx[1] * t[0]];
  const h = w / 2, bar = o.bar || Math.max(0.06, w * 0.06);
  const corner = (p, i, j) => [p[0] + sx[0] * i * h + up[0] * j * h, p[1] + sx[1] * i * h + up[1] * j * h, p[2] + sx[2] * i * h + up[2] * j * h];
  const C = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
  for (const [i, j] of C) { const p = corner(a, i, j), q = corner(b, i, j); acc.beam(p[0], p[1], p[2], q[0], q[1], q[2], bar, bar); }
  const n = Math.max(1, Math.round(L / (o.bay || w * 1.2)));
  for (let k = 0; k < n; k++) {
    const f0 = k / n, f1 = (k + 1) / n;
    const p0 = [a[0] + dx * f0, a[1] + dy * f0, a[2] + dz * f0], p1 = [a[0] + dx * f1, a[1] + dy * f1, a[2] + dz * f1];
    for (let e = 0; e < 4; e++) {
      const [i0, j0] = C[e], [i1, j1] = C[(e + 1) % 4];
      const A = corner(k % 2 ? p0 : p1, i0, j0), B = corner(k % 2 ? p1 : p0, i1, j1);
      acc.beam(A[0], A[1], A[2], B[0], B[1], B[2], bar * 0.7, bar * 0.7);
    }
  }
}

/** A sloped quad strip along a polyline at heights ys (a ramp, a path, a stair rail). */
export function ribbon(acc, pts, w, o = {}) {
  const base = acc.count;
  let u = 0;
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i], q = pts[Math.min(pts.length - 1, i + 1)], r = pts[Math.max(0, i - 1)];
    let dx = q[0] - r[0], dz = q[2] - r[2];
    const l = Math.hypot(dx, dz) || 1;
    dx /= l; dz /= l;
    const lx = dz, lz = -dx;
    if (i) u += Math.hypot(p[0] - pts[i - 1][0], p[2] - pts[i - 1][2]);
    acc.v(p[0] - lx * w / 2, p[1], p[2] - lz * w / 2, 0, u / (o.u || w));
    acc.v(p[0] + lx * w / 2, p[1], p[2] + lz * w / 2, 1, u / (o.u || w));
  }
  for (let i = 0; i < pts.length - 1; i++) {
    const a = base + i * 2;
    acc.tri(a, a + 2, a + 1);
    acc.tri(a + 1, a + 2, a + 3);
  }
}

/**
 * Something flat laid on the ground (a plaza, a car park, a lawn, a field):
 * the polygon (world [x, z] points) triangulated and split until no edge is
 * longer than o.step (4 m: the ground's own grid), every vertex at the built
 * ground + o.lift. uv in metres / o.uv. Give its material polygonOffset (or
 * a lift) so it doesn't flicker against the ground.
 */
export function drape(acc, B, poly, o = {}) {
  const lift = o.lift ?? 0.06, step = o.step ?? 4, uv = o.uv ?? 4;
  const tri = THREE.ShapeUtils.triangulateShape(poly.map((p) => new THREE.Vector2(p[0], p[1])), []);
  const verts = new Map();
  const vid = (p) => {
    const k = `${Math.round(p[0] * 20)},${Math.round(p[1] * 20)}`;
    let i = verts.get(k);
    if (i === undefined) { i = acc.v(p[0], B.groundY(p[0], p[1]) + lift, p[1], p[0] / uv, p[1] / uv); verts.set(k, i); }
    return i;
  };
  const d = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
  const mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  const emit = (a, b, c) => {
    const ny = (b[1] - a[1]) * (c[0] - a[0]) - (b[0] - a[0]) * (c[1] - a[1]);
    if (ny > 0) acc.tri(vid(a), vid(b), vid(c)); else acc.tri(vid(a), vid(c), vid(b));
  };
  const split = (a, b, c, depth) => {
    const ab = d(a, b), bc = d(b, c), ca = d(c, a);
    const m = Math.max(ab, bc, ca);
    if (m <= step || depth > 12) { emit(a, b, c); return; }
    if (m === ab) { const p = mid(a, b); split(a, p, c, depth + 1); split(p, b, c, depth + 1); }
    else if (m === bc) { const p = mid(b, c); split(a, b, p, depth + 1); split(a, p, c, depth + 1); }
    else { const p = mid(c, a); split(a, b, p, depth + 1); split(p, b, c, depth + 1); }
  };
  for (const t of tri) split(poly[t[0]], poly[t[1]], poly[t[2]], 0);
}
