// Geometry kit for the building/prop generators.
//
// GeoBuilder accumulates triangles per material key with a transform stack, so a
// whole building becomes ONE mesh per material (≈ one draw call each). Keys are
// material names from materials.js; a key starting with 'i:' goes to the
// building's separate interior group. Every vertex carries position, normal,
// uv and colour: flat faces get planar UVs in METRES measured in building space
// (so siding boards line up across wall pieces split around windows), and the
// colour is the paint/tint (materials multiply their texture by it).
//
//   const b = new GeoBuilder();
//   b.push().translate(0, 0, 4).rotateY(0.3);
//   b.box('siding_lap', 0, 0, 0, 6, 3, 0.2, { color: '#7a2f28' });
//   b.pop();
//   const { exterior, interior } = b.toGroups({ snow: true });
import * as THREE from 'three';
import { getMaterial, SOLID, TEX_MEAN } from './materials.js';

const _m = new THREE.Matrix4();
const _c = new THREE.Color();

/** Any colour-ish (hex number, css string, [r,g,b] linear, THREE.Color) → [r,g,b] linear. */
export function rgb(c, mul = 1) {
  if (c == null) return [mul, mul, mul];
  if (Array.isArray(c)) return [c[0] * mul, c[1] * mul, c[2] * mul];
  if (c.isColor) return [c.r * mul, c.g * mul, c.b * mul];
  _c.set(c);
  return [_c.r * mul, _c.g * mul, _c.b * mul];
}

/** Mix two colour-ish values (linear) → [r,g,b]. */
export function mixRgb(a, b, t) {
  const x = rgb(a), y = rgb(b);
  return [x[0] + (y[0] - x[0]) * t, x[1] + (y[1] - x[1]) * t, x[2] + (y[2] - x[2]) * t];
}

/** Fade a paint colour toward weathered grey (k = 0 fresh … 1 bleached). */
export function weather(c, k) {
  const x = rgb(c);
  const l = x[0] * 0.3 + x[1] * 0.55 + x[2] * 0.15;
  const g = l * 0.85 + 0.06;
  return [x[0] + (g - x[0]) * k * 0.75, x[1] + (g - x[1]) * k * 0.75, x[2] + (g - x[2]) * k * 0.7];
}

class Bucket {
  constructor() {
    this.pos = [];
    this.nrm = [];
    this.uv = [];
    this.col = [];
    this.idx = [];
    this.n = 0;
  }
}

export class GeoBuilder {
  constructor() {
    this.buckets = new Map();
    this.m = new THREE.Matrix4();
    this.nm = new THREE.Matrix3();
    this.stack = [];
    this.materials = new Map(); // key → material override
  }

  bucket(key) {
    let b = this.buckets.get(key);
    if (!b) this.buckets.set(key, (b = new Bucket()));
    return b;
  }

  /** Resolve a key: untextured materials all go to the shared 'solid' bucket. */
  _target(key) {
    const isInt = key.charCodeAt(0) === 105 && key.charCodeAt(1) === 58; // 'i:'
    const name = isInt ? key.slice(2) : key;
    const sd = SOLID[name];
    if (sd && !this.materials.has(key)) {
      if (!sd.mul) sd.mul = sd[2] ? rgb(sd[2]) : null;
      return { B: this.bucket(isInt ? 'i:solid' : 'solid'), rm: sd, mul: sd.mul };
    }
    return { B: this.bucket(key), rm: null, mul: null };
  }

  // ---------------------------------------------------------------- transform
  push() { this.stack.push(this.m.clone()); return this; }
  pop() { this.m.copy(this.stack.pop()); this.nm.getNormalMatrix(this.m); return this; }
  translate(x, y, z) { this.m.multiply(_m.makeTranslation(x, y, z)); this.nm.getNormalMatrix(this.m); return this; }
  rotateX(a) { if (a) { this.m.multiply(_m.makeRotationX(a)); this.nm.getNormalMatrix(this.m); } return this; }
  rotateY(a) { if (a) { this.m.multiply(_m.makeRotationY(a)); this.nm.getNormalMatrix(this.m); } return this; }
  rotateZ(a) { if (a) { this.m.multiply(_m.makeRotationZ(a)); this.nm.getNormalMatrix(this.m); } return this; }
  scale(x, y = x, z = x) { this.m.multiply(_m.makeScale(x, y, z)); this.nm.getNormalMatrix(this.m); return this; }
  apply(mat) { this.m.multiply(mat); this.nm.getNormalMatrix(this.m); return this; }
  /** push + translate + rotateY — the common "place a part here" pattern. */
  at(x, y, z, ry = 0) { return this.push().translate(x, y, z).rotateY(ry); }

  /** Local point → building space [x, y, z]. */
  P(x, y, z) {
    const e = this.m.elements;
    return [e[0] * x + e[4] * y + e[8] * z + e[12], e[1] * x + e[5] * y + e[9] * z + e[13], e[2] * x + e[6] * y + e[10] * z + e[14]];
  }
  /** Current yaw (rotation about Y) of the local frame in building space. */
  yaw() { const e = this.m.elements; return Math.atan2(e[8], e[10]); }

  // ---------------------------------------------------------------- emitters
  /**
   * Flat convex polygon (local points, counter-clockwise seen from the front).
   * o.color, o.uv (explicit [[u,v]..]), o.uvScale [su, sv], o.uvOff [ou, ov],
   * o.uvRot (swap u/v), o.flip (reverse winding).
   */
  poly(key, pts, o = {}) {
    const n = pts.length;
    if (n < 3) return;
    const tg = this._target(key);
    const B = tg.B;
    const P = new Array(n);
    for (let i = 0; i < n; i++) P[i] = this.P(pts[i][0], pts[i][1], pts[i][2]);
    let flip = !!o.flip;
    if (o.want) {
      // make the face point along a local direction
      const ne = this.nm.elements, w = o.want;
      const wx = ne[0] * w[0] + ne[3] * w[1] + ne[6] * w[2], wy = ne[1] * w[0] + ne[4] * w[1] + ne[7] * w[2], wz = ne[2] * w[0] + ne[5] * w[1] + ne[8] * w[2];
      let sx = 0, sy = 0, sz = 0;
      for (let i = 0; i < n; i++) {
        const a = P[i], b = P[(i + 1) % n];
        sx += (a[1] - b[1]) * (a[2] + b[2]);
        sy += (a[2] - b[2]) * (a[0] + b[0]);
        sz += (a[0] - b[0]) * (a[1] + b[1]);
      }
      if (sx * wx + sy * wy + sz * wz < 0) flip = !flip;
    }
    if (flip) P.reverse();
    // Newell normal
    let nx = 0, ny = 0, nz = 0;
    for (let i = 0; i < n; i++) {
      const a = P[i], b = P[(i + 1) % n];
      nx += (a[1] - b[1]) * (a[2] + b[2]);
      ny += (a[2] - b[2]) * (a[0] + b[0]);
      nz += (a[0] - b[0]) * (a[1] + b[1]);
    }
    const l = Math.hypot(nx, ny, nz);
    if (l < 1e-12) return;
    nx /= l; ny /= l; nz /= l;
    const col = rgb(o.color);
    if (tg.mul) { col[0] *= tg.mul[0]; col[1] *= tg.mul[1]; col[2] *= tg.mul[2]; }
    let uvs = tg.rm ? null : o.uv;
    if (uvs && flip) uvs = uvs.slice().reverse();
    let tx, ty, tz, bx, by, bz;
    if (!uvs && !tg.rm) {
      if (Math.abs(ny) > 0.995) {
        tx = 1; ty = 0; tz = 0;
        bx = 0; by = 0; bz = ny > 0 ? -1 : 1;
      } else {
        tx = nz; ty = 0; tz = -nx;
        const tl = Math.hypot(tx, tz);
        tx /= tl; tz /= tl;
        // b = n × t
        bx = ny * tz - nz * ty;
        by = nz * tx - nx * tz;
        bz = nx * ty - ny * tx;
      }
    }
    const su = o.uvScale ? o.uvScale[0] : 1, sv = o.uvScale ? o.uvScale[1] : 1;
    const ou = o.uvOff ? o.uvOff[0] : 0, ov = o.uvOff ? o.uvOff[1] : 0;
    const base = B.n;
    for (let i = 0; i < n; i++) {
      const p = P[i];
      B.pos.push(p[0], p[1], p[2]);
      B.nrm.push(nx, ny, nz);
      let u, v;
      if (tg.rm) { u = tg.rm[0]; v = tg.rm[1]; } else if (uvs) { u = uvs[i][0]; v = uvs[i][1]; } else {
        u = (p[0] * tx + p[1] * ty + p[2] * tz) * su + ou;
        v = (p[0] * bx + p[1] * by + p[2] * bz) * sv + ov;
        if (o.uvRot) { const t = u; u = v; v = -t; }
      }
      B.uv.push(u, v);
      B.col.push(col[0], col[1], col[2]);
    }
    for (let i = 1; i < n - 1; i++) B.idx.push(base, base + i, base + i + 1);
    B.n += n;
  }

  /** Quad a,b,c,d (CCW from the front). */
  quad(key, a, b, c, d, o) { this.poly(key, [a, b, c, d], o); }

  /** Double-sided quad (e.g. a sign seen from both sides, a fence board). */
  quad2(key, a, b, c, d, o = {}) {
    this.poly(key, [a, b, c, d], o);
    this.poly(key, [a, b, c, d], { ...o, flip: true });
  }

  /**
   * Smooth / arbitrary mesh from raw arrays (local space).
   * uvs are used as given (multiply by o.uvScale for metre mapping).
   */
  mesh(key, pos, nrm, uv, idx, o = {}) {
    const tg = this._target(key);
    const B = tg.B;
    const e = this.m.elements, ne = this.nm.elements;
    const col = o.colors ? null : rgb(o.color);
    if (col && tg.mul) { col[0] *= tg.mul[0]; col[1] *= tg.mul[1]; col[2] *= tg.mul[2]; }
    const su = o.uvScale ? o.uvScale[0] : 1, sv = o.uvScale ? o.uvScale[1] : 1;
    const ou = o.uvOff ? o.uvOff[0] : 0, ov = o.uvOff ? o.uvOff[1] : 0;
    const count = pos.length / 3;
    const base = B.n;
    for (let i = 0; i < count; i++) {
      const x = pos[i * 3], y = pos[i * 3 + 1], z = pos[i * 3 + 2];
      B.pos.push(e[0] * x + e[4] * y + e[8] * z + e[12], e[1] * x + e[5] * y + e[9] * z + e[13], e[2] * x + e[6] * y + e[10] * z + e[14]);
      const a = nrm[i * 3], b = nrm[i * 3 + 1], c = nrm[i * 3 + 2];
      let nx = ne[0] * a + ne[3] * b + ne[6] * c, ny = ne[1] * a + ne[4] * b + ne[7] * c, nz = ne[2] * a + ne[5] * b + ne[8] * c;
      const l = Math.hypot(nx, ny, nz) || 1;
      B.nrm.push(nx / l, ny / l, nz / l);
      if (tg.rm) B.uv.push(tg.rm[0], tg.rm[1]);
      else B.uv.push(uv ? uv[i * 2] * su + ou : 0, uv ? uv[i * 2 + 1] * sv + ov : 0);
      if (col) B.col.push(col[0], col[1], col[2]);
      else B.col.push(o.colors[i * 3], o.colors[i * 3 + 1], o.colors[i * 3 + 2]);
    }
    if (idx) for (let i = 0; i < idx.length; i++) B.idx.push(base + idx[i]);
    else for (let i = 0; i < count; i++) B.idx.push(base + i);
    B.n += count;
  }

  /** Append any THREE.BufferGeometry (local space). */
  geom(key, g, o = {}) {
    const pos = g.attributes.position.array;
    if (!g.attributes.normal) g.computeVertexNormals();
    const nrm = g.attributes.normal.array;
    const uv = g.attributes.uv ? g.attributes.uv.array : null;
    const idx = g.index ? g.index.array : null;
    this.mesh(key, pos, nrm, uv, idx, o);
  }

  // ---------------------------------------------------------------- primitives
  /**
   * Axis-aligned box, base at y0, centred on (cx, cz). o.skip: string of faces
   * to omit: 't'op 'b'ottom 'f'ront(+z) 'k'(back −z) 'l'eft(−x) 'r'ight(+x).
   * o.ry rotates about the box's own vertical axis.
   */
  box(key, cx, y0, cz, w, h, d, o = {}) {
    const rot = o.ry || o.rx || o.rz;
    if (rot) {
      this.push().translate(cx, y0 + h / 2, cz).rotateY(o.ry || 0).rotateX(o.rx || 0).rotateZ(o.rz || 0);
      this._box(key, -w / 2, -h / 2, -d / 2, w / 2, h / 2, d / 2, o);
      this.pop();
    } else {
      this._box(key, cx - w / 2, y0, cz - d / 2, cx + w / 2, y0 + h, cz + d / 2, o);
    }
  }

  /** Centred box. */
  boxc(key, cx, cy, cz, w, h, d, o = {}) { this.box(key, cx, cy - h / 2, cz, w, h, d, o); }

  /** Box between min and max corners. */
  boxMinMax(key, x0, y0, z0, x1, y1, z1, o = {}) { this._box(key, x0, y0, z0, x1, y1, z1, o); }

  _box(key, x0, y0, z0, x1, y1, z1, o) {
    const s = o.skip || '';
    if (!s.includes('f')) this.poly(key, [[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]], o);
    if (!s.includes('k')) this.poly(key, [[x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0]], o);
    if (!s.includes('r')) this.poly(key, [[x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1]], o);
    if (!s.includes('l')) this.poly(key, [[x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0]], o);
    if (!s.includes('t')) this.poly(key, [[x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0]], o);
    if (!s.includes('b')) this.poly(key, [[x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1]], o);
  }

  /**
   * A beam (box) from point a to point b with cross-section w (horizontal) × h.
   * o.roll rotates the section about the beam axis.
   */
  beam(key, a, b, w, h, o = {}) {
    const dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2];
    const len = Math.hypot(dx, dy, dz);
    if (len < 1e-6) return;
    const yaw = Math.atan2(dx, dz);
    const pitch = -Math.atan2(dy, Math.hypot(dx, dz));
    this.push().translate(a[0], a[1], a[2]).rotateY(yaw).rotateX(pitch).rotateZ(o.roll || 0);
    this._box(key, -w / 2, -h / 2, 0, w / 2, h / 2, len, o);
    this.pop();
  }

  /**
   * Cylinder along Y, base at y0. o.segs (12), o.rTop (= r), o.caps ('tb' default),
   * o.smooth (true), o.thetaStart, o.thetaLen, o.uvScale.
   */
  cyl(key, x, y0, z, r, h, o = {}) {
    const segs = o.segs || 12;
    const rt = o.rTop ?? r;
    const t0 = o.thetaStart || 0, tl = o.thetaLen ?? Math.PI * 2;
    const full = Math.abs(tl - Math.PI * 2) < 1e-6;
    const pos = [], nrm = [], uv = [], idx = [];
    const slope = (r - rt) / h;
    const circ = Math.max(r, rt) * tl;
    if (o.smooth !== false) {
      for (let i = 0; i <= segs; i++) {
        const t = t0 + (i / segs) * tl;
        const s = Math.sin(t), c = Math.cos(t);
        const nl = Math.hypot(1, slope);
        pos.push(x + s * r, y0, z + c * r, x + s * rt, y0 + h, z + c * rt);
        nrm.push(s / nl, slope / nl, c / nl, s / nl, slope / nl, c / nl);
        uv.push((i / segs) * circ, 0, (i / segs) * circ, h);
        if (i < segs) { const k = i * 2; idx.push(k, k + 2, k + 1, k + 1, k + 2, k + 3); }
      }
      this.mesh(key, pos, nrm, uv, idx, o);
    } else {
      for (let i = 0; i < segs; i++) {
        const ta = t0 + (i / segs) * tl, tb = t0 + ((i + 1) / segs) * tl;
        this.poly(key, [
          [x + Math.sin(ta) * r, y0, z + Math.cos(ta) * r], [x + Math.sin(tb) * r, y0, z + Math.cos(tb) * r],
          [x + Math.sin(tb) * rt, y0 + h, z + Math.cos(tb) * rt], [x + Math.sin(ta) * rt, y0 + h, z + Math.cos(ta) * rt],
        ], o);
      }
    }
    const caps = o.caps ?? 'tb';
    if (full) {
      if (caps.includes('t') && rt > 0) this._disc(key, x, y0 + h, z, rt, segs, 1, o);
      if (caps.includes('b') && r > 0) this._disc(key, x, y0, z, r, segs, -1, o);
    }
  }

  _disc(key, x, y, z, r, segs, dir, o) {
    const pts = [];
    for (let i = 0; i < segs; i++) {
      const t = (i / segs) * Math.PI * 2 * dir;
      pts.push([x + Math.sin(t) * r, y, z + Math.cos(t) * r]);
    }
    this.poly(key, pts, { color: o.color, uvScale: o.capUvScale, uvOff: o.uvOff });
  }

  /** Cylinder between two points (pipes, poles, rods, wires). */
  cylBetween(key, a, b, r, o = {}) {
    const dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2];
    const len = Math.hypot(dx, dy, dz);
    if (len < 1e-6) return;
    const yaw = Math.atan2(dx, dz);
    const pitch = Math.acos(Math.max(-1, Math.min(1, dy / len)));
    this.push().translate(a[0], a[1], a[2]).rotateY(yaw).rotateX(pitch);
    this.cyl(key, 0, 0, 0, r, len, o);
    this.pop();
  }

  /**
   * Surface of revolution about Y through (x, y0, z): prof = [[r, y], ...] bottom→top.
   * Smooth normals. o.segs (16), o.color, o.uvScale.
   */
  lathe(key, x, y0, z, prof, o = {}) {
    const segs = o.segs || 16;
    const n = prof.length;
    const pos = [], nrm = [], uv = [], idx = [];
    // profile normals (2D), averaged at joints
    const pn = [];
    for (let j = 0; j < n; j++) {
      const a = prof[Math.max(0, j - 1)], b = prof[Math.min(n - 1, j + 1)];
      let dr = b[0] - a[0], dy = b[1] - a[1];
      const l = Math.hypot(dr, dy) || 1;
      pn.push([dy / l, -dr / l]);
    }
    let vlen = [0];
    for (let j = 1; j < n; j++) vlen.push(vlen[j - 1] + Math.hypot(prof[j][0] - prof[j - 1][0], prof[j][1] - prof[j - 1][1]));
    let rmax = 0;
    for (const p of prof) rmax = Math.max(rmax, p[0]);
    const circ = Math.PI * 2 * rmax;
    const t0 = o.thetaStart || 0, tl = o.thetaLen ?? Math.PI * 2;
    for (let i = 0; i <= segs; i++) {
      const t = t0 + (i / segs) * tl;
      const s = Math.sin(t), c = Math.cos(t);
      for (let j = 0; j < n; j++) {
        const [r, y] = prof[j];
        pos.push(x + s * r, y0 + y, z + c * r);
        nrm.push(s * pn[j][0], pn[j][1], c * pn[j][0]);
        uv.push((i / segs) * circ, vlen[j]);
      }
    }
    for (let i = 0; i < segs; i++) {
      for (let j = 0; j < n - 1; j++) {
        const a = i * n + j, b = (i + 1) * n + j;
        idx.push(a, b, a + 1, a + 1, b, b + 1);
      }
    }
    this.mesh(key, pos, nrm, uv, idx, o);
  }

  /** Sphere (or part of one: o.phiTop/o.phiBottom in radians from the top). */
  sphere(key, x, y, z, r, o = {}) {
    const rings = o.rings || 8;
    const p0 = o.phiTop ?? 0, p1 = o.phiBottom ?? Math.PI;
    const prof = [];
    for (let j = rings; j >= 0; j--) {
      const p = p0 + (j / rings) * (p1 - p0);
      prof.push([Math.sin(p) * r * (o.sx || 1), -Math.cos(p) * r]);
    }
    if (o.sx) { this.push().translate(x, y, z).scale(1, o.sy || 1, 1); this.lathe(key, 0, 0, 0, prof, o); this.pop(); } else this.lathe(key, x, y, z, prof, o);
  }

  /** Polyline tube (wires, neon tubing, rails). o.segs (5), o.closed. */
  tube(key, pts, r, o = {}) {
    for (let i = 0; i < pts.length - 1; i++) this.cylBetween(key, pts[i], pts[i + 1], r, { segs: o.segs || 5, caps: '', color: o.color, uvScale: o.uvScale });
    if (o.closed && pts.length > 2) this.cylBetween(key, pts[pts.length - 1], pts[0], r, { segs: o.segs || 5, caps: '', color: o.color });
  }

  /**
   * Prism: a vertical extrusion of a 2D outline (x, z pairs, CCW seen from above)
   * from y0 to y0 + h. o.caps ('tb').
   */
  prism(key, outline, y0, h, o = {}) {
    const n = outline.length;
    let area = 0;
    for (let i = 0; i < n; i++) {
      const a = outline[i], b = outline[(i + 1) % n];
      area += a[0] * b[1] - b[0] * a[1];
    }
    const flip = area > 0;
    for (let i = 0; i < n; i++) {
      const a = outline[i], b = outline[(i + 1) % n];
      this.poly(key, [[a[0], y0, a[1]], [b[0], y0, b[1]], [b[0], y0 + h, b[1]], [a[0], y0 + h, a[1]]], { ...o, flip });
    }
    const caps = o.caps ?? 'tb';
    const shape = outline.map((p) => new THREE.Vector2(p[0], p[1]));
    const tris = THREE.ShapeUtils.triangulateShape(shape, []);
    for (const [i0, i1, i2] of tris) {
      const A = outline[i0], Bp = outline[i1], C = outline[i2];
      if (caps.includes('t')) this.poly(key, [[A[0], y0 + h, A[1]], [Bp[0], y0 + h, Bp[1]], [C[0], y0 + h, C[1]]], { color: o.color, want: [0, 1, 0] });
      if (caps.includes('b')) this.poly(key, [[A[0], y0, A[1]], [Bp[0], y0, Bp[1]], [C[0], y0, C[1]]], { color: o.color, want: [0, -1, 0] });
    }
  }

  /**
   * Flat shape with holes (THREE.Shape in its XY plane) placed in the local XY
   * plane facing +Z, optionally extruded by depth (sides + back).
   */
  shape(key, shp, o = {}) {
    const depth = o.depth || 0;
    const g = depth > 0
      ? new THREE.ExtrudeGeometry(shp, { depth, bevelEnabled: false, curveSegments: o.curveSegments || 6 })
      : new THREE.ShapeGeometry(shp, o.curveSegments || 6);
    if (depth > 0) g.translate(0, 0, -depth);
    // ShapeGeometry/Extrude UVs are already in shape units (metres here).
    this.geom(key, g, o);
    g.dispose();
  }

  // ---------------------------------------------------------------- output
  stats() {
    let tris = 0, verts = 0;
    for (const B of this.buckets.values()) { tris += B.idx.length / 3; verts += B.n; }
    return { calls: this.buckets.size, tris, verts };
  }

  /**
   * Keep the number of exterior (or interior) buckets ≤ budget by folding the
   * smallest textured buckets into a similar texture already present, or into
   * 'solid' (texture replaced by its mean colour). Glass/neon/signs never fold.
   */
  fold(budget, interior) {
    const pre = interior ? 'i:' : '';
    const keys = () => [...this.buckets.keys()].filter((k) => (interior ? k.startsWith('i:') : !k.startsWith('i:')) && this.buckets.get(k).n > 0);
    let guard = 64;
    while (keys().length > budget && guard-- > 0) {
      const cand = keys().filter((k) => {
        const n = interior ? k.slice(2) : k;
        return !/glass|neon|glow|sign:|^solid$|leaf|chainlink/.test(n) && !this.materials.has(k);
      }).sort((a, b) => this.buckets.get(a).idx.length - this.buckets.get(b).idx.length);
      if (!cand.length) break;
      const src = cand[0];
      const name = interior ? src.slice(2) : src;
      const present = new Set(keys().map((k) => (interior ? k.slice(2) : k)));
      const pref = (FOLD[name] || []).find((t) => present.has(t) && t !== name);
      const dstKey = pref ? pre + pref : pre + 'solid';
      const S = this.buckets.get(src), D = this.bucket(dstKey);
      const base = D.n;
      for (let i = 0; i < S.pos.length; i++) D.pos.push(S.pos[i]);
      for (let i = 0; i < S.nrm.length; i++) D.nrm.push(S.nrm[i]);
      if (pref) for (let i = 0; i < S.uv.length; i++) D.uv.push(S.uv[i]);
      else {
        const rm = [0.85, /metal|corr|diamond/.test(name) ? 0.35 : 0];
        for (let i = 0; i < S.n; i++) D.uv.push(rm[0], rm[1]);
      }
      const mean = !pref && TEX_MEAN[name] ? rgb(TEX_MEAN[name]) : null;
      for (let i = 0; i < S.col.length; i++) D.col.push(mean ? S.col[i] * mean[i % 3] * 1.15 : S.col[i]);
      for (let i = 0; i < S.idx.length; i++) D.idx.push(S.idx[i] + base);
      D.n += S.n;
      this.buckets.delete(src);
    }
  }

  /** key → BufferGeometry (keys keep their 'i:' prefix). */
  geometries() {
    const out = new Map();
    for (const [key, B] of this.buckets) {
      if (!B.n) continue;
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(B.pos, 3));
      g.setAttribute('normal', new THREE.Float32BufferAttribute(B.nrm, 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute(B.uv, 2));
      g.setAttribute('color', new THREE.Float32BufferAttribute(B.col, 3));
      g.setIndex(B.n > 65535 ? new THREE.Uint32BufferAttribute(B.idx, 1) : new THREE.Uint16BufferAttribute(B.idx, 1));
      g.computeBoundingSphere();
      g.computeBoundingBox();
      out.set(key, g);
    }
    return out;
  }

  /**
   * Build meshes. Returns { exterior: Group, interior: Group|null }.
   * o.snow: snow on up-facing exterior surfaces (default true).
   */
  toGroups(o = {}) {
    this.fold(o.budget ?? 12, false);
    this.fold(o.interiorBudget ?? 13, true);
    const geos = this.geometries();
    const ext = new THREE.Group();
    let int = null;
    const order = [];
    for (const [key, g] of geos) order.push([key, g]);
    // opaque first, then glass, then neon/additive
    const rank = (k) => (/glass|neon|glow|sign/.test(k) ? 2 : 0);
    order.sort((a, b) => rank(a[0]) - rank(b[0]));
    for (const [key, g] of order) {
      const isInt = key.startsWith('i:');
      const name = isInt ? key.slice(2) : key;
      const mat = this.materials.get(key) || materialFor(name, { snow: !isInt && o.snow !== false });
      const mesh = new THREE.Mesh(g, mat);
      mesh.name = key;
      const emissive = /glass|neon|glow|sign|light/.test(name);
      mesh.castShadow = !emissive && o.castShadow !== false;
      mesh.receiveShadow = !/neon|glow/.test(name);
      mesh.matrixAutoUpdate = false;
      if (isInt) (int || (int = new THREE.Group())).add(mesh);
      else ext.add(mesh);
    }
    if (int) int.name = 'interior';
    ext.name = 'exterior';
    return { exterior: ext, interior: int };
  }
}

// textured materials that can stand in for each other when folding buckets
const FOLD = {
  wood_raw: ['wood_weathered', 'logs', 'floor_wood', 'plywood'], wood_weathered: ['wood_raw', 'logs', 'plywood'],
  osb: ['plywood', 'wood_raw'], plywood: ['osb', 'wood_raw', 'wood_weathered'], logs: ['wood_raw', 'wood_weathered'],
  metal_rust: ['metal_corr_rust', 'metal_paint_rust'], metal_paint_rust: ['metal_rust', 'metal_corr_rust'],
  metal_corr_rust: ['metal_rust', 'metal_paint_rust'], metal_corr: ['metal_corr_paint'], metal_corr_paint: ['metal_corr'],
  siding_panel: ['siding_lap', 'siding_peel'], siding_lap: ['siding_panel', 'siding_peel'], siding_peel: ['siding_panel', 'siding_lap'],
  siding_lap_old: ['siding_peel', 'wood_weathered'], wood_dark: ['wood_panel', 'floor_wood'], wood_panel: ['wood_dark'],
  floor_wood: ['wood_raw', 'wood_dark'], concrete: ['asphalt', 'gravel'], gravel: ['concrete'], asphalt: ['concrete'],
  snow_dirty: ['snow'], tile: ['linoleum'], linoleum: ['tile'], carpet: [], plaster: [], diamond_plate: ['metal_corr'],
};

const NO_SNOW = /glass|neon|glow|sign|snow|ice|light|fabric|rubber|chrome/;
/** Material used for a builder key (shared, vertex-coloured). */
export function materialFor(name, o = {}) {
  return getMaterial(name, { vertexColors: true, snow: !!o.snow && !NO_SNOW.test(name) });
}

// ------------------------------------------------------------------ helpers

/**
 * Rectangles covering [x0,x1]×[y0,y1] minus rectangular holes (each
 * {x0,x1,y0,y1}); holes must lie inside and not overlap. Returns [[xa,ya,xb,yb]...].
 */
export function rectMinusHoles(x0, y0, x1, y1, holes) {
  const xs = new Set([x0, x1]);
  for (const h of holes) { xs.add(Math.max(x0, Math.min(x1, h.x0))); xs.add(Math.max(x0, Math.min(x1, h.x1))); }
  const X = [...xs].sort((a, b) => a - b);
  const out = [];
  for (let i = 0; i < X.length - 1; i++) {
    const xa = X[i], xb = X[i + 1];
    if (xb - xa < 1e-5) continue;
    const xm = (xa + xb) / 2;
    const cover = holes.filter((h) => h.x0 < xm && h.x1 > xm).map((h) => [Math.max(y0, h.y0), Math.min(y1, h.y1)]).sort((a, b) => a[0] - b[0]);
    let y = y0;
    for (const [ha, hb] of cover) {
      if (ha > y + 1e-5) out.push([xa, y, xb, ha]);
      y = Math.max(y, hb);
    }
    if (y1 > y + 1e-5) out.push([xa, y, xb, y1]);
  }
  // merge vertically-adjacent columns with identical y spans to cut triangles
  out.sort((a, b) => a[1] - b[1] || a[3] - b[3] || a[0] - b[0]);
  const merged = [];
  for (const r of out) {
    const last = merged[merged.length - 1];
    if (last && Math.abs(last[1] - r[1]) < 1e-5 && Math.abs(last[3] - r[3]) < 1e-5 && Math.abs(last[2] - r[0]) < 1e-5) last[2] = r[2];
    else merged.push(r.slice());
  }
  return merged;
}

/** Catenary wire between two points (sag metres at the middle) → points. */
export function catenary(a, b, sag, n = 8) {
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    pts.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t - sag * 4 * t * (1 - t), a[2] + (b[2] - a[2]) * t]);
  }
  return pts;
}

/** Instantiate cached geometries (Map key→geometry) as a Group sharing everything. */
export function groupFromGeometries(geos, o = {}) {
  const g = new THREE.Group();
  for (const [key, geo] of geos) {
    const isInt = key.startsWith('i:');
    const name = isInt ? key.slice(2) : key;
    const mat = (o.materials && o.materials.get(key)) || materialFor(name, { snow: o.snow !== false && !isInt });
    const m = new THREE.Mesh(geo, mat);
    const emissive = /glass|neon|glow|sign|light/.test(name);
    m.castShadow = !emissive && o.castShadow !== false;
    m.receiveShadow = !/neon|glow/.test(name);
    m.name = key;
    g.add(m);
  }
  return g;
}
