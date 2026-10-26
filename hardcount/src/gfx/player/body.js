// The body: one skinned mesh per player, built procedurally in the bind pose
// (metres, model space). Limbs are lofted tubes with superelliptic sections
// that change along each bone (deltoids, biceps, forearms, quads, calves),
// starting in a ball cap centred on the joint so shoulders and hips rotate
// without tearing; skin weights blend smoothly across elbows, knees, wrists,
// the waist and the neck. Shoulder pads sit under the jersey as part of the
// torso shape, rigid on the chest bone (their caps follow the clavicles a
// little). Everything maps into the per-player uniform atlas (layout.js).
import * as THREE from 'three';
import { B } from './rig.js';
import { R, SWATCH, uvOf, limbU, headU, headV } from './layout.js';

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const sstep = (a, b, v) => { const t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const lerp = (a, b, t) => a + (b - a) * t;
const D2R = Math.PI / 180;

// ------------------------------------------------------------------ builder

export class MeshBuilder {
  constructor() {
    this.P = []; this.N = []; this.UV = []; this.SI = []; this.SW = []; this.I = [];
    this.marks = {};
  }
  get count() { return this.P.length / 3; }
  get triCount() { return this.I.length / 3; }
  /** w = [bone, weight, bone, weight, …] (any length; top 4 kept, normalised) */
  vert(x, y, z, nx, ny, nz, u, v, w) {
    this.P.push(x, y, z);
    this.N.push(nx, ny, nz);
    this.UV.push(u, v);
    let b0 = 0, w0 = 0, b1 = 0, w1 = 0, b2 = 0, w2 = 0, b3 = 0, w3 = 0;
    // insertion into the top-4
    for (let i = 0; i < w.length; i += 2) {
      const b = w[i], ww = w[i + 1];
      if (ww <= 0) continue;
      // merge duplicates
      if (ww && b === b0 && w0) { w0 += ww; continue; }
      if (ww && b === b1 && w1) { w1 += ww; continue; }
      if (ww && b === b2 && w2) { w2 += ww; continue; }
      if (ww && b === b3 && w3) { w3 += ww; continue; }
      if (ww > w0) { b3 = b2; w3 = w2; b2 = b1; w2 = w1; b1 = b0; w1 = w0; b0 = b; w0 = ww; }
      else if (ww > w1) { b3 = b2; w3 = w2; b2 = b1; w2 = w1; b1 = b; w1 = ww; }
      else if (ww > w2) { b3 = b2; w3 = w2; b2 = b; w2 = ww; }
      else if (ww > w3) { b3 = b; w3 = ww; }
    }
    const sum = w0 + w1 + w2 + w3 || 1;
    if (!w0) { w0 = 1; }
    this.SI.push(b0, b1, b2, b3);
    this.SW.push(w0 / sum, w1 / sum, w2 / sum, w3 / sum);
    return this.count - 1;
  }
  tri(a, b, c) { this.I.push(a, b, c); }

  /**
   * Loft a tube through rings. ring = { c: Vector3, sec, v, w: (thDeg, x, y, z) => weights }
   * opts: { X: side axis (θ = 90°), Z: front axis (θ = 0°), A: loft axis (first → last ring),
   *         n, rect, th0 (seam angle, deg), uMap(j/n) → u (default identity) }
   * A ring with sec.pole = true collapses to its centre.
   */
  loft(rings, opts) {
    const { X, Z, n, rect } = opts;
    const th0 = opts.th0 ?? -90;
    const A = opts.A;
    const flip = new THREE.Vector3().crossVectors(Z, X).dot(A) < 0;
    const base = this.count;
    const nr = rings.length;
    const pts = new Array(nr * (n + 1));
    const tmp = [0, 0];
    for (let i = 0; i < nr; i++) {
      const r = rings[i];
      for (let j = 0; j <= n; j++) {
        const th = th0 + (360 * j) / n;
        const p = new THREE.Vector3();
        if (r.sec.pole) p.copy(r.c);
        else {
          sectionPoint(r.sec, th, tmp);
          p.copy(r.c).addScaledVector(X, tmp[0]).addScaledVector(Z, tmp[1]);
        }
        pts[i * (n + 1) + j] = p;
      }
    }
    // normals from the grid (periodic around, one-sided at the ends)
    const t1 = new THREE.Vector3(), t2 = new THREE.Vector3(), nn = new THREE.Vector3();
    const uv = [0, 0];
    for (let i = 0; i < nr; i++) {
      const r = rings[i];
      for (let j = 0; j <= n; j++) {
        const jj = j === n ? 0 : j;
        const jp = (jj + 1) % n, jm = (jj - 1 + n) % n;
        const p = pts[i * (n + 1) + j];
        t1.subVectors(pts[i * (n + 1) + jp], pts[i * (n + 1) + jm]);
        const ia = Math.max(0, i - 1), ib = Math.min(nr - 1, i + 1);
        t2.subVectors(pts[ib * (n + 1) + j], pts[ia * (n + 1) + j]);
        if (t1.lengthSq() < 1e-12) {
          // pole: use the neighbouring ring's spread
          const k = i === 0 ? 1 : i - 1;
          t1.subVectors(pts[k * (n + 1) + jp], pts[k * (n + 1) + jm]);
        }
        nn.crossVectors(t1, t2);
        if (flip) nn.negate();
        if (r.sec.pole || nn.lengthSq() < 1e-14) {
          nn.copy(A).multiplyScalar(i === 0 ? -1 : 1);
        }
        nn.normalize();
        const th = th0 + (360 * j) / n;
        const ul = opts.uMap ? opts.uMap(j / n) : j / n;
        uvOf(rect, ul, clamp(r.v, 0.002, 0.998), uv);
        this.vert(p.x, p.y, p.z, nn.x, nn.y, nn.z, uv[0], uv[1], r.w(th, p.x, p.y, p.z));
      }
    }
    for (let i = 0; i < nr - 1; i++) {
      for (let j = 0; j < n; j++) {
        const a = base + i * (n + 1) + j, b = a + 1, d = a + (n + 1), c = d + 1;
        if (flip) { this.tri(a, c, b); this.tri(a, d, c); } else { this.tri(a, b, c); this.tri(a, c, d); }
      }
    }
    return base;
  }

  /** Merge an arbitrary BufferGeometry (non-indexed or indexed) transformed by m. */
  piece(g, m, uvFn, wFn) {
    const base = this.count;
    const p = g.attributes.position, nrm = g.attributes.normal, guv = g.attributes.uv;
    const v = new THREE.Vector3(), nv = new THREE.Vector3();
    const nm = new THREE.Matrix3().getNormalMatrix(m);
    const uv = [0, 0];
    for (let i = 0; i < p.count; i++) {
      v.set(p.getX(i), p.getY(i), p.getZ(i));
      const lx = v.x, ly = v.y, lz = v.z;
      v.applyMatrix4(m);
      nv.set(nrm.getX(i), nrm.getY(i), nrm.getZ(i)).applyMatrix3(nm).normalize();
      uvFn(lx, ly, lz, guv ? guv.getX(i) : 0, guv ? guv.getY(i) : 0, uv);
      this.vert(v.x, v.y, v.z, nv.x, nv.y, nv.z, uv[0], uv[1], wFn(v.x, v.y, v.z));
    }
    if (g.index) for (let i = 0; i < g.index.count; i += 3) this.tri(base + g.index.getX(i), base + g.index.getX(i + 1), base + g.index.getX(i + 2));
    else for (let i = 0; i < p.count; i += 3) this.tri(base + i, base + i + 1, base + i + 2);
    return base;
  }

  /** Raw triangles: verts = [{p, n, uv, w}], tris = [[a,b,c]] (local indices). */
  raw(verts, tris) {
    const base = this.count;
    for (const q of verts) this.vert(q.p.x, q.p.y, q.p.z, q.n.x, q.n.y, q.n.z, q.uv[0], q.uv[1], q.w);
    for (const t of tris) this.tri(base + t[0], base + t[1], base + t[2]);
    return base;
  }

  mark(name) { this.marks[name] = this.I.length; }

  build() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.P, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.N, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.UV, 2));
    g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(this.SI, 4));
    g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(this.SW, 4));
    g.setIndex(this.count > 65535 ? new THREE.Uint32BufferAttribute(this.I, 1) : new THREE.Uint16BufferAttribute(this.I, 1));
    return g;
  }
}

/** Superellipse section point at angle θ (deg, from the front toward the side axis). */
export function sectionPoint(sec, thDeg, out) {
  const th = thDeg * D2R;
  const s = Math.sin(th), c = Math.cos(th);
  const sqF = sec.sq || 2, sqB = sec.sqB || sqF;
  const e = 2 / (c >= 0 ? sqF : sqB);
  let x = Math.sign(s) * Math.pow(Math.abs(s), e) * sec.rx;
  let z = Math.sign(c) * Math.pow(Math.abs(c), e) * (c >= 0 ? sec.rzF : sec.rzB);
  if (sec.bumps) {
    let bump = 0;
    for (let k = 0; k < sec.bumps.length; k++) {
      const bp = sec.bumps[k];
      if (!bp[1]) continue;
      let d = thDeg - bp[0];
      d = ((d + 540) % 360) - 180;
      bump += bp[1] * Math.exp(-(d * d) / (2 * bp[2] * bp[2]));
    }
    if (bump) {
      const r = Math.hypot(x, z) || 1;
      x += (x / r) * bump;
      z += (z / r) * bump;
    }
  }
  out[0] = x + (sec.cx || 0);
  out[1] = z + (sec.cz || 0);
  return out;
}

/** Non-uniform Catmull-Rom over key sections: keys = [{t, rx, rzF, rzB, cx, cz, sq, b:[…]}]. */
function sampleKeys(keys, t, bumpDefs) {
  let k = 0;
  while (k < keys.length - 2 && t > keys[k + 1].t) k++;
  const k0 = keys[Math.max(0, k - 1)], k1 = keys[k], k2 = keys[k + 1], k3 = keys[Math.min(keys.length - 1, k + 2)];
  const span = k2.t - k1.t || 1;
  const u = clamp((t - k1.t) / span, 0, 1);
  const h = (name) => {
    const p0 = k0[name] ?? 0, p1 = k1[name] ?? 0, p2 = k2[name] ?? 0, p3 = k3[name] ?? 0;
    const m1 = k2.t - k0.t > 1e-6 ? ((p2 - p0) / (k2.t - k0.t)) * span : 0;
    const m2 = k3.t - k1.t > 1e-6 ? ((p3 - p1) / (k3.t - k1.t)) * span : 0;
    const u2 = u * u, u3 = u2 * u;
    return (2 * u3 - 3 * u2 + 1) * p1 + (u3 - 2 * u2 + u) * m1 + (-2 * u3 + 3 * u2) * p2 + (u3 - u2) * m2;
  };
  const sec = { rx: h('rx'), rzF: h('rzF'), rzB: h('rzB'), cx: h('cx'), cz: h('cz'), sq: h('sq') || 2, sqB: k1.sqB !== undefined ? h('sqB') : undefined };
  if (bumpDefs) {
    sec.bumps = bumpDefs.map((d, i) => {
      const a1 = k1.b?.[i] ?? 0, a2 = k2.b?.[i] ?? 0;
      return [d[0], lerp(a1, a2, u * u * (3 - 2 * u)), d[1]];
    });
  }
  return sec;
}

function scaleSec(sec, f) {
  return { ...sec, rx: sec.rx * f, rzF: sec.rzF * f, rzB: sec.rzB * f, cx: (sec.cx || 0) * f, cz: (sec.cz || 0) * f, bumps: sec.bumps?.map((b) => [b[0], b[1] * f, b[2]]) };
}

const W = (...a) => a;
const constW = (w) => () => w;

// ------------------------------------------------------------------ torso

// y (reference metres), rx, rzF, rzB, cz, sq, bumps [belly, butt, chest, back], zone
const TORSO_LOW = [
  [0.840, 0.030, 0.030, 0.030, -0.012, 2.0, [0, 0, 0, 0], 'hip'],
  [0.858, 0.090, 0.066, 0.072, -0.013, 2.1, [0, 0.006, 0, 0], 'hip'],
  [0.890, 0.148, 0.094, 0.104, -0.014, 2.3, [0, 0.02, 0, 0], 'hip'],
  [0.940, 0.172, 0.106, 0.114, -0.013, 2.4, [0, 0.026, 0, 0], 'hip'],
  [0.990, 0.171, 0.108, 0.106, -0.007, 2.4, [0, 0.012, 0, 0], 'hip'],
  [1.028, 0.160, 0.106, 0.098, -0.002, 2.3, [0, 0, 0, 0], 'waist'],
  [1.048, 0.157, 0.104, 0.096, -0.001, 2.3, [0, 0, 0, 0], 'waist'],   // belt
  [1.070, 0.161, 0.112, 0.099, 0.000, 2.3, [0.004, 0, 0, 0], 'waist'],
  [1.130, 0.165, 0.117, 0.100, 0.002, 2.2, [0.008, 0, 0, 0], 'waist'],
  [1.205, 0.171, 0.121, 0.104, 0.000, 2.3, [0.004, 0, 0, 0], 'chest'],
  [1.280, 0.181, 0.127, 0.112, 0.000, 2.4, [0, 0, 0.004, 0.004], 'chest'],
];
const TORSO_PADS = [
  [1.322, 0.196, 0.137, 0.121, 0.000, 2.5, [0, 0, 0.009, 0.006], 'pad'],
  [1.345, 0.214, 0.144, 0.130, -0.001, 2.6, [0, 0, 0.012, 0.008], 'pad'],
  [1.390, 0.238, 0.149, 0.138, -0.003, 2.8, [0, 0, 0.012, 0.009], 'pad'],
  [1.440, 0.259, 0.151, 0.142, -0.006, 3.0, [0, 0, 0.009, 0.008], 'pad'],
  [1.482, 0.270, 0.147, 0.140, -0.010, 3.0, [0, 0, 0.006, 0.006], 'pad'],
  [1.515, 0.266, 0.137, 0.132, -0.012, 2.9, [0, 0, 0.003, 0.003], 'pad'],
  [1.543, 0.243, 0.121, 0.117, -0.013, 2.8, [0, 0, 0, 0], 'pad'],
  [1.564, 0.200, 0.105, 0.101, -0.013, 2.6, [0, 0, 0, 0], 'pad'],
  [1.578, 0.150, 0.091, 0.089, -0.012, 2.4, [0, 0, 0, 0], 'top'],
  [1.586, 0.105, 0.079, 0.079, -0.010, 2.2, [0, 0, 0, 0], 'top'],
  [1.588, 0.078, 0.070, 0.069, -0.010, 2.0, [0, 0, 0, 0], 'top'],
  [1.580, 0.060, 0.059, 0.059, -0.012, 2.0, [0, 0, 0, 0], 'top'],
];
const TORSO_SHIRT = [
  [1.330, 0.184, 0.130, 0.116, 0.000, 2.4, [0, 0, 0.004, 0.004], 'chest'],
  [1.390, 0.188, 0.130, 0.119, -0.004, 2.5, [0, 0, 0.004, 0.004], 'chest'],
  [1.440, 0.184, 0.118, 0.113, -0.008, 2.6, [0, 0, 0, 0], 'chest'],
  [1.478, 0.172, 0.100, 0.100, -0.012, 2.6, [0, 0, 0, 0], 'chest'],
  [1.506, 0.144, 0.087, 0.086, -0.014, 2.4, [0, 0, 0, 0], 'top'],
  [1.528, 0.102, 0.074, 0.072, -0.013, 2.2, [0, 0, 0, 0], 'top'],
  [1.538, 0.070, 0.064, 0.062, -0.012, 2.0, [0, 0, 0, 0], 'top'],
  [1.532, 0.056, 0.054, 0.054, -0.012, 2.0, [0, 0, 0, 0], 'top'],
];
const TORSO_BUMPS = [[0, 48], [180, 52], [0, 70], [180, 75]];

function torsoKeys(bd) {
  const rows = TORSO_LOW.concat(bd.padded ? TORSO_PADS : TORSO_SHIRT);
  const s = bd.s;
  return rows.map(([y, rx, rzF, rzB, cz, sq, b, zone]) => {
    let fx = 1, fzF = 1, fzB = 1;
    if (zone === 'hip') { fx = bd.hip; fzF = bd.hip * 0.97; fzB = bd.hip * (0.96 + 0.06 * bd.musc); }
    else if (zone === 'waist') { fx = bd.waist; fzF = bd.waist + bd.belly * 0.06; fzB = bd.waist * 0.97; }
    else if (zone === 'chest') { fx = lerp(bd.waist, bd.wide, sstep(1.18, 1.3, y)) * bd.musc ** 0.5; fzF = fx * 1.0; fzB = fx; }
    else if (zone === 'pad') { const p = bd.pads || 1; fx = bd.wide * p; fzF = bd.wide * (0.95 + 0.05 * p) * bd.musc ** 0.3; fzB = fzF; }
    else if (zone === 'top') { fx = bd.neck * 0.92 + 0.08 * bd.wide; fzF = fzB = bd.neck * 0.95 + 0.05; }
    const bp = sstep(1.0, 1.09, y) * (1 - sstep(1.16, 1.27, y));
    const belly = b[0] + bd.belly * 0.034 * bp;
    return {
      t: y * s, rx: rx * fx * s, rzF: rzF * fzF * s, rzB: rzB * fzB * s, cz: cz * s, sq,
      b: [belly * s, b[1] * s * bd.hip, b[2] * s, b[3] * s],
    };
  });
}

function torsoWeights(bd) {
  const s = bd.s;
  return (th, x, y) => {
    const yr = y / s;
    if (yr < 1.0) return W(B.hips, 1);
    if (yr < 1.13) { const k = sstep(1.0, 1.13, yr); return W(B.hips, 1 - k, B.spine, k); }
    if (yr < 1.2) return W(B.spine, 1);
    if (yr < 1.33) { const k = sstep(1.2, 1.33, yr); return W(B.spine, 1 - k, B.chest, k); }
    // pads: rigid on the chest; the caps follow the clavicles a little
    const ax = Math.abs(x) / s;
    const kc = sstep(0.15, 0.27, ax) * sstep(1.36, 1.46, yr) * (bd.padded ? 0.5 : 0.75);
    if (kc > 0.001) return W(B.chest, 1 - kc, x > 0 ? B.clavL : B.clavR, kc);
    return W(B.chest, 1);
  };
}

function buildTorso(mb, bd, dims, lod) {
  const keys = torsoKeys(bd);
  const tStart = keys[0].t, tEnd = keys[keys.length - 1].t;
  // keys rise to the collar; the inner collar lip at the end turns back down
  let up = keys.length;
  for (let i = 1; i < keys.length; i++) if (keys[i].t < keys[i - 1].t) { up = i; break; }
  const upKeys = keys.slice(0, up);
  const rows = [], yOf = [];
  for (let i = 0; i < upKeys.length; i++) {
    if (lod !== 'high' && i > 0 && i < upKeys.length - 1 && i % 2 === 1 && upKeys[i].t < 1.3 * bd.s) continue;
    rows.push(sampleKeys(upKeys, upKeys[i].t, TORSO_BUMPS));
    yOf.push(upKeys[i].t);
    if (lod === 'high' && i < upKeys.length - 1 && upKeys[i + 1].t - upKeys[i].t > 0.058 * bd.s) {
      const t = (upKeys[i].t + upKeys[i + 1].t) / 2;
      rows.push(sampleKeys(upKeys, t, TORSO_BUMPS));
      yOf.push(t);
    }
  }
  for (let i = up; i < keys.length; i++) {
    const k = keys[i];
    rows.push({ rx: k.rx, rzF: k.rzF, rzB: k.rzB, cx: 0, cz: k.cz, sq: k.sq });
    yOf.push(k.t);
  }
  // v by arc length along the front silhouette
  const arc = [0];
  for (let i = 1; i < rows.length; i++) {
    const dy = yOf[i] - yOf[i - 1];
    const dr = (rows[i].rzF + rows[i].rx) / 2 - (rows[i - 1].rzF + rows[i - 1].rx) / 2;
    arc.push(arc[i - 1] + Math.hypot(dy, dr));
  }
  const total = arc[arc.length - 1];
  const wfn = torsoWeights(bd);
  const rings = rows.map((sec, i) => ({
    c: new THREE.Vector3(0, yOf[i], 0),
    sec: i === 0 ? { ...sec } : sec,
    v: arc[i] / total,
    w: wfn,
  }));
  // close the crotch with a pole
  rings.unshift({ c: new THREE.Vector3(0, tStart - 0.006 * bd.s, keys[0].cz), sec: { pole: true }, v: 0, w: wfn });
  mb.loft(rings, {
    X: new THREE.Vector3(1, 0, 0), Z: new THREE.Vector3(0, 0, 1), A: new THREE.Vector3(0, 1, 0),
    n: lod === 'high' ? 22 : 12, rect: R.TORSO, th0: -135,
  });
  // landmarks for the painter (v of the belt, pads, etc.)
  const vAtY = (yRef) => {
    const y = yRef * bd.s;
    for (let i = 1; i < yOf.length; i++) {
      if (yOf[i] >= y) { const k = (y - yOf[i - 1]) / (yOf[i] - yOf[i - 1] || 1); return lerp(arc[i - 1], arc[i], k) / total; }
    }
    return 1;
  };
  const vFromTop = (m) => 1 - (m * bd.s) / total;
  return { vAtY, vFromTop, total, tEnd };
}

// ------------------------------------------------------------------ limbs

const ARM_KEYS = [
  // t: 0 shoulder joint … 1 elbow … 2 wrist (fractions of the bone lengths)
  { t: 0.0, rx: 0.058, rzF: 0.058, rzB: 0.058, cz: 0.0, sq: 2 },
  { t: 0.14, rx: 0.056, rzF: 0.056, rzB: 0.055, cz: 0.0, sq: 2 },
  { t: 0.32, rx: 0.05, rzF: 0.053, rzB: 0.051, cz: 0.002, sq: 2 },
  { t: 0.52, rx: 0.046, rzF: 0.054, rzB: 0.049, cz: 0.003, sq: 2 },
  { t: 0.76, rx: 0.042, rzF: 0.046, rzB: 0.046, cz: 0.0, sq: 2 },
  { t: 0.96, rx: 0.039, rzF: 0.04, rzB: 0.044, cz: -0.003, sq: 2 },
  { t: 1.06, rx: 0.039, rzF: 0.039, rzB: 0.043, cz: -0.004, sq: 2 },
  { t: 1.22, rx: 0.04, rzF: 0.043, rzB: 0.041, cz: 0.0, sq: 2 },
  { t: 1.5, rx: 0.034, rzF: 0.037, rzB: 0.034, cz: 0.0, sq: 2 },
  { t: 1.82, rx: 0.025, rzF: 0.031, rzB: 0.028, cz: 0.0, sq: 2.1 },
  { t: 2.0, rx: 0.022, rzF: 0.029, rzB: 0.027, cz: 0.0, sq: 2.2 },
];

const LEG_KEYS = [
  // t: 0 hip joint … 1 knee … 2 ankle. bumps: [thigh pad (front), knee pad (front), calf (back)]
  { t: 0.0, rx: 0.088, rzF: 0.09, rzB: 0.092, cz: 0.0, sq: 2, b: [0, 0, 0] },
  { t: 0.16, rx: 0.087, rzF: 0.09, rzB: 0.09, cz: 0.004, sq: 2, b: [0.005, 0, 0] },
  { t: 0.42, rx: 0.08, rzF: 0.084, rzB: 0.08, cz: 0.008, sq: 2.1, b: [0.011, 0, 0] },
  { t: 0.66, rx: 0.07, rzF: 0.074, rzB: 0.068, cz: 0.008, sq: 2.1, b: [0.008, 0, 0] },
  { t: 0.86, rx: 0.06, rzF: 0.06, rzB: 0.058, cz: 0.004, sq: 2, b: [0.0, 0.004, 0] },
  { t: 0.97, rx: 0.056, rzF: 0.057, rzB: 0.055, cz: 0.003, sq: 2, b: [0, 0.013, 0] },
  { t: 1.05, rx: 0.054, rzF: 0.055, rzB: 0.054, cz: 0.001, sq: 2, b: [0, 0.015, 0] },
  { t: 1.13, rx: 0.052, rzF: 0.053, rzB: 0.056, cz: -0.004, sq: 2, b: [0, 0.006, 0.002] },
  { t: 1.3, rx: 0.056, rzF: 0.051, rzB: 0.064, cz: -0.011, sq: 2, b: [0, 0, 0.009] },
  { t: 1.47, rx: 0.052, rzF: 0.049, rzB: 0.06, cz: -0.012, sq: 2, b: [0, 0, 0.008] },
  { t: 1.66, rx: 0.042, rzF: 0.041, rzB: 0.046, cz: -0.006, sq: 2, b: [0, 0, 0.002] },
  { t: 1.86, rx: 0.034, rzF: 0.034, rzB: 0.036, cz: -0.002, sq: 2, b: [0, 0, 0] },
  { t: 2.0, rx: 0.032, rzF: 0.036, rzB: 0.036, cz: 0.0, sq: 2, b: [0, 0, 0] },
];
const LEG_BUMPS = [[0, 40], [0, 34], [180, 46]];

/**
 * A limb tube from a joint (ball cap above it) down through two bones.
 * chain = [upperBone, lowerBone, endBone, parentBone]; P = bind positions.
 */
function buildLimb(mb, opts) {
  const { side, top, mid, end, keys, bumps, lens, rect, n, capR, weights, f, ringsPerSeg } = opts;
  const X = new THREE.Vector3(side, 0, 0), Z = new THREE.Vector3(0, 0, 1), A = new THREE.Vector3(0, -1, 0);
  const total = lens[0] + lens[1];
  const posAt = (t) => (t <= 1 ? new THREE.Vector3().lerpVectors(top, mid, t) : new THREE.Vector3().lerpVectors(mid, end, t - 1));
  const distAt = (t) => (t <= 1 ? t * lens[0] : lens[0] + (t - 1) * lens[1]);
  const capH = capR * 0.92;
  const vOf = (d) => 1 - (d + capH) / (total + capH);  // v = 1 at the cap pole, 0 at the far end
  const rings = [];
  // ball cap (pole first)
  const k0 = scaleSec(sampleKeys(keys, 0, bumps), f(0));
  const capSteps = n >= 10 ? 4 : 2;
  for (let i = 0; i <= capSteps; i++) {
    const a = (i / capSteps) * (Math.PI / 2);
    const k = Math.sin(a);
    const c = top.clone().addScaledVector(A, -Math.cos(a) * capH);
    rings.push({ c, sec: i === 0 ? { pole: true } : scaleSec(k0, k), v: vOf(-Math.cos(a) * capH), w: constW(weights(0)) });
  }
  // shaft
  const ts = [];
  for (let i = 0; i < keys.length - 1; i++) {
    const steps = ringsPerSeg(keys[i].t, keys[i + 1].t);
    for (let k = 0; k < steps; k++) ts.push(lerp(keys[i].t, keys[i + 1].t, k / steps));
  }
  ts.push(keys[keys.length - 1].t);
  for (const t of ts) {
    if (t === 0) continue;
    rings.push({ c: posAt(t), sec: scaleSec(sampleKeys(keys, t, bumps), f(t)), v: vOf(distAt(t)), w: constW(weights(t)) });
  }
  mb.loft(rings, { X, Z, A, n, rect, th0: -90 });
}

function buildArm(mb, bd, dims, side, lod) {
  const P = dims.bind;
  const L = side > 0;
  const top = P[L ? B.armL : B.armR], mid = P[L ? B.foreL : B.foreR], end = P[L ? B.handL : B.handR];
  const s = bd.s, m = bd.musc * bd.limb;
  const cl = L ? B.clavL : B.clavR, ua = L ? B.armL : B.armR, fa = L ? B.foreL : B.foreR, hd = L ? B.handL : B.handR;
  buildLimb(mb, {
    side, top, mid, end, keys: ARM_KEYS, bumps: null,
    lens: [top.distanceTo(mid), mid.distanceTo(end)],
    rect: L ? R.ARM_L : R.ARM_R, n: lod === 'high' ? 10 : 6,
    capR: 0.061 * s * m,
    f: (t) => s * 1.1 * (t < 1.1 ? m : lerp(m, 1 + (m - 1) * 0.6, sstep(1.1, 2, t))),
    ringsPerSeg: (a, b) => (lod === 'high' ? (b - a > 0.2 ? 2 : 1) : (b - a > 0.25 ? 1 : (a > 0.9 && a < 1.1 ? 1 : 0)) || 1),
    weights: (t) => {
      if (t < 0.16) { const k = sstep(0, 0.16, t); return W(ua, 0.78 + 0.22 * k, cl, 0.22 * (1 - k)); }
      if (t < 0.84) return W(ua, 1);
      if (t < 1.16) { const k = sstep(0.84, 1.16, t); return W(ua, 1 - k, fa, k); }
      if (t < 1.55) return W(fa, 1);
      const k = sstep(1.55, 2.0, t) * 0.5;
      return W(fa, 1 - k, hd, k);
    },
  });
}

function buildLeg(mb, bd, dims, side, lod) {
  const P = dims.bind;
  const L = side > 0;
  const top = P[L ? B.thighL : B.thighR], mid = P[L ? B.shinL : B.shinR], end = P[L ? B.footL : B.footR];
  const s = bd.s, m = bd.musc * bd.limb;
  const th = L ? B.thighL : B.thighR, sh = L ? B.shinL : B.shinR, ft = L ? B.footL : B.footR;
  buildLimb(mb, {
    side, top, mid, end, keys: LEG_KEYS, bumps: LEG_BUMPS,
    lens: [top.distanceTo(mid), mid.distanceTo(end)],
    rect: R.LEG, n: lod === 'high' ? 12 : 7,
    capR: 0.084 * s * m * bd.hip,
    f: (t) => s * (t < 1 ? lerp(m * bd.hip ** 0.5, m, sstep(0, 1, t)) * lerp(1.1, 1.0, sstep(0.62, 0.98, t)) : lerp(m, 1 + (m - 1) * 0.7, sstep(1.2, 2, t))),
    ringsPerSeg: (a, b) => (lod === 'high' ? (b - a > 0.2 ? 2 : 1) : (b - a > 0.22 ? 1 : (a > 0.9 && a < 1.1 ? 1 : 0)) || 1),
    weights: (t) => {
      if (t < 0.14) { const k = sstep(0, 0.14, t); return W(th, 0.72 + 0.28 * k, B.hips, 0.28 * (1 - k)); }
      if (t < 0.84) return W(th, 1);
      if (t < 1.16) { const k = sstep(0.84, 1.16, t); return W(th, 1 - k, sh, k); }
      if (t < 1.84) return W(sh, 1);
      const k = sstep(1.84, 2.0, t) * 0.4;
      return W(sh, 1 - k, ft, k);
    },
  });
}

// ------------------------------------------------------------------ neck & head

function buildNeck(mb, bd, dims, lod) {
  const P = dims.bind, s = bd.s;
  const bot = new THREE.Vector3(0, 1.49 * s, -0.035 * s);
  const topP = new THREE.Vector3(0, 1.685 * s, 0.0);
  const A = topP.clone().sub(bot).normalize();
  const nf = bd.neck;
  const rings = [];
  const n = lod === 'high' ? 12 : 7;
  const steps = lod === 'high' ? 6 : 3;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const y = lerp(bot.y, topP.y, t);
    const flare = 1 + 0.18 * (1 - sstep(0, 0.35, t));   // trapezius flare at the base
    rings.push({
      c: new THREE.Vector3().lerpVectors(bot, topP, t),
      sec: { rx: 0.056 * nf * s * flare, rzF: 0.054 * nf * s, rzB: 0.06 * nf * s * (1 + 0.1 * (1 - t)), cz: 0, sq: 2 },
      v: t,
      w: () => {
        const yr = y / s;
        if (yr < 1.525) return W(B.chest, 1);
        if (yr < 1.59) { const k = sstep(1.525, 1.59, yr); return W(B.chest, 1 - k, B.neck, k); }
        if (yr < 1.63) return W(B.neck, 1);
        const k = sstep(1.63, 1.68, yr); return W(B.neck, 1 - k, B.head, k);
      },
    });
  }
  // neck skin lives in the HEAD region's bottom strip
  mb.loft(rings.map((r) => ({ ...r, v: lerp(0.0, 0.1, r.v) })), {
    X: new THREE.Vector3(1, 0, 0), Z: new THREE.Vector3(0, 0, 1), A, n, rect: R.HEAD, th0: -180,
  });
}

/** Head shape: unit direction (lat φ, lon λ in degrees) → point relative to the head centre (metres, unscaled). */
// eye centre on the face in (fx, fy) = (sin λ cos φ, sin φ) — shared with the face painter
export const EYE_FX = 0.41, EYE_FY = 0.08;
export const EYE_PHI = Math.asin(EYE_FY) / D2R;
export const EYE_LAM = Math.asin(EYE_FX / Math.cos(EYE_PHI * D2R)) / D2R;

export function headPoint(phiDeg, lamDeg, out) {
  const ph = phiDeg * D2R, la = lamDeg * D2R;
  const dx = Math.cos(ph) * Math.sin(la), dy = Math.sin(ph), dz = Math.cos(ph) * Math.cos(la);
  let x = dx * 0.075, y = dy * (dy > 0 ? 0.112 : 0.104), z = dz * (dz > 0 ? 0.094 : 0.1);
  // a square jaw: only a little narrower below the cheekbones; the back of the skull tucks into the neck
  const jaw = sstep(-0.25, -0.92, dy);
  x *= 1 - 0.13 * jaw;
  if (dz < 0) { const k = sstep(-0.25, -0.8, dy) * sstep(0, -0.6, dz); z *= 1 - 0.32 * k; x *= 1 - 0.1 * k; }
  // flatter temples
  x *= 1 - 0.05 * sstep(0.1, 0.5, dy) * sstep(0.3, 0.8, Math.abs(dx));
  const front = sstep(0.12, 0.55, dz);
  const fx = dx, fy = dy, ax = Math.abs(fx);
  const g = (a, b) => Math.exp(-(a * a) - (b * b));
  let disp = 0;
  // nose: bridge → tip → under the nose, wider at the nostrils
  const noseProf = fy > -0.22 ? lerp(0.024, 0.004, sstep(-0.22, 0.12, fy)) * sstep(0.2, 0.06, fy) : 0.024 * sstep(-0.34, -0.22, fy);
  const noseW = lerp(0.13, 0.07, sstep(-0.26, 0.1, fy));
  disp += noseProf * Math.exp(-((fx / noseW) ** 2)) * front;
  // brow ridge over the eyes
  disp += 0.0072 * Math.exp(-(((fy - 0.21) / 0.07) ** 2)) * Math.exp(-((fx / 0.55) ** 4)) * front;
  // eye sockets, centred on the eyeballs
  disp -= 0.011 * (g((fx - EYE_FX) / 0.125, (fy - EYE_FY) / 0.085) + g((fx + EYE_FX) / 0.125, (fy - EYE_FY) / 0.085)) * front;
  // cheekbones, jaw angles
  disp += 0.005 * (g((ax - 0.6) / 0.15, (fy + 0.12) / 0.12)) * front;
  disp += 0.006 * g((ax - 0.72) / 0.16, (fy + 0.55) / 0.16) * sstep(-0.2, 0.3, dz);
  // lips and mouth line
  disp += 0.0048 * g(fx / 0.26, (fy + 0.45) / 0.06) * front;
  disp += 0.0036 * g(fx / 0.22, (fy + 0.54) / 0.045) * front;
  disp -= 0.0024 * g(fx / 0.23, (fy + 0.49) / 0.02) * front;
  // chin
  disp += 0.009 * g(fx / 0.32, (fy + 0.79) / 0.12) * front;
  // occiput
  disp += 0.006 * g((dz + 0.85) / 0.35, (fy - 0.12) / 0.32);
  const r = Math.hypot(x, y, z) || 1;
  out.set(x + (x / r) * disp, y + (y / r) * disp, z + (z / r) * disp);
  return out;
}

export function headCenter(dims) {
  const s = dims.bd.s;
  return new THREE.Vector3(0, 1.71 * s, 0.022 * s);
}
export function headScale(bd) {
  return bd.s ** 0.55 * (0.97 + 0.035 * bd.girth);
}

const HEAD_LAMS_HI = [-180, -140, -100, -72, -56, -44, -34, -26, -19, -13, -7, 0, 7, 13, 19, 26, 34, 44, 56, 72, 100, 140, 180];
const HEAD_PHIS_HI = [-89.5, -68, -50, -38, -29, -21, -14, -7, 0, 6, 12, 20, 30, 44, 62, 80, 89.5];
const HEAD_LAMS_LO = [-180, -135, -90, -55, -25, 0, 25, 55, 90, 135, 180];
const HEAD_PHIS_LO = [-89.5, -55, -28, 0, 22, 50, 89.5];

function buildHead(mb, bd, dims, lod) {
  const C = headCenter(dims);
  const hs = headScale(bd);
  const lams = lod === 'high' ? HEAD_LAMS_HI : HEAD_LAMS_LO;
  const phis = lod === 'high' ? HEAD_PHIS_HI : HEAD_PHIS_LO;
  const nLon = lams.length - 1, nLat = phis.length - 1;
  const base = mb.count;
  const p = new THREE.Vector3(), q = new THREE.Vector3(), nn = new THREE.Vector3(), t1 = new THREE.Vector3(), t2 = new THREE.Vector3();
  const uv = [0, 0];
  const wHead = W(B.head, 1);
  for (let i = 0; i <= nLat; i++) {
    for (let j = 0; j <= nLon; j++) {
      const lam = lams[j], phi = phis[i];
      headPoint(phi, lam, p);
      // normal by finite differences on the sphere param
      headPoint(phi, lam + 0.5, q); t1.subVectors(q, p);
      headPoint(Math.min(89.9, phi + 0.5), lam, q); t2.subVectors(q, p);
      nn.crossVectors(t1, t2).normalize();
      if (!(nn.lengthSq() > 0.5)) nn.copy(p).normalize();
      if (nn.dot(p) < 0) nn.negate();
      uvOf(R.HEAD, headU(lam), lerp(0.1, 1, headV(phi)), uv);
      mb.vert(C.x + p.x * hs, C.y + p.y * hs, C.z + p.z * hs, nn.x, nn.y, nn.z, uv[0], uv[1], wHead);
    }
  }
  for (let i = 0; i < nLat; i++) {
    for (let j = 0; j < nLon; j++) {
      const a = base + i * (nLon + 1) + j, b = a + 1, d = a + nLon + 1, c = d + 1;
      // λ increases toward the left (+x); φ upward: (a, b, c) normal = t_λ × t_φ → outward
      mb.tri(a, b, c); mb.tri(a, c, d);
    }
  }
  if (lod !== 'high') return;
  // ears: small, flat against the head, tipped back
  for (const sd of [1, -1]) {
    const g = new THREE.SphereGeometry(1, 6, 4);
    const ep = new THREE.Vector3();
    headPoint(-3, sd * 92, ep);
    const m = new THREE.Matrix4().compose(
      new THREE.Vector3(C.x + (ep.x - sd * 0.002) * hs, C.y + ep.y * hs, C.z + (ep.z - 0.008) * hs),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.22, sd * 0.32, 0)),
      new THREE.Vector3(0.0085 * hs, 0.026 * hs, 0.0155 * hs),
    );
    const earUv = uvOf(R.HEAD, headU(sd * 90), lerp(0.1, 1, headV(-3)), [0, 0]);
    mb.piece(g, m, (lx, ly, lz, gu, gv, out) => { out[0] = earUv[0] + lz * 0.003; out[1] = earUv[1] + ly * 0.004; }, () => wHead);
    g.dispose();
  }
  // eyes: flattened eyeballs set into the sockets (the socket rims hide their edges)
  const ep = new THREE.Vector3(), en = new THREE.Vector3();
  for (const sd of [1, -1]) {
    headPoint(EYE_PHI, sd * EYE_LAM, ep);
    en.set(Math.sin(sd * EYE_LAM * D2R) * 0.7, 0.05, Math.cos(EYE_LAM * D2R)).normalize();
    ep.addScaledVector(en, -0.0084);
    const g = new THREE.SphereGeometry(1, 9, 5, 0, Math.PI * 2, 0, Math.PI * 0.62);
    g.rotateX(Math.PI / 2);
    const m = new THREE.Matrix4().compose(
      new THREE.Vector3(C.x + ep.x * hs, C.y + ep.y * hs, C.z + ep.z * hs),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(0.04, sd * 0.1, 0)),
      new THREE.Vector3(0.0118 * hs, 0.0079 * hs, 0.0104 * hs),
    );
    mb.piece(g, m, (lx, ly, lz, gu, gv, out) => {
      uvOf(R.EYE, 0.5 + lx * 0.5, 0.5 + ly * 0.5, out);
    }, () => wHead);
    g.dispose();
  }
}

// ------------------------------------------------------------------ hands & shoes

function buildHand(mb, bd, dims, side, lod) {
  const P = dims.bind, s = bd.s * (0.96 + 0.06 * bd.girth);
  const L = side > 0;
  const wr = P[L ? B.handL : B.handR];
  const hd = L ? B.handL : B.handR, fg = L ? B.fingL : B.fingR, fa = L ? B.foreL : B.foreR;
  const X = new THREE.Vector3(side, 0, 0), Z = new THREE.Vector3(0, 0, 1), A = new THREE.Vector3(0, -1, 0);
  const knuck = 0.092;
  // [d below the wrist, rx (thickness), rz (width), cx (toward the back of the hand), cz]
  const rows = [
    [-0.034, 0.029, 0.033, 0.002, 0.0],
    [-0.012, 0.029, 0.034, 0.002, 0.0],
    [-0.002, 0.022, 0.032, 0.001, 0.0],
    [0.02, 0.019, 0.037, 0.0, 0.0],
    [0.05, 0.019, 0.043, 0.0, -0.002],
    [0.08, 0.018, 0.045, 0.001, -0.003],
    [0.1, 0.0165, 0.043, 0.002, -0.004],
    [0.135, 0.0145, 0.04, 0.003, -0.005],
    [0.162, 0.012, 0.036, 0.004, -0.006],
    [0.176, 0.006, 0.026, 0.004, -0.006],
    [0.18, 0, 0, 0.004, -0.006],
  ];
  const keep = lod === 'high' ? rows.filter((r, i) => i !== 1 && i !== 6) : rows.filter((r, i) => i % 2 === 0 || i === rows.length - 1);
  const rings = keep.map(([d, rx, rz, cx, cz], i) => ({
    c: wr.clone().addScaledVector(A, d * s),
    sec: rx === 0 ? { pole: true } : { rx: rx * s, rzF: rz * s, rzB: rz * s, cx: cx * s, cz: cz * s, sq: 3.0 },
    v: 1 - (d + 0.034) / 0.214,
    w: () => {
      if (d < -0.02) return W(fa, 0.65, hd, 0.35);
      if (d < 0) return W(fa, 0.35, hd, 0.65);
      if (d < 0.075) return W(hd, 1);
      const k = sstep(0.075, 0.112, d);
      return W(hd, 1 - k, fg, k);
    },
  }));
  mb.loft(rings, { X, Z, A, n: lod === 'high' ? 8 : 5, rect: R.HAND, th0: -90, uMap: (u) => u * 0.78 });
  if (lod !== 'high') return;
  // thumb: a short tube on the thumb side, angled toward the palm
  const t0 = wr.clone().add(new THREE.Vector3(-side * 0.008 * s, -0.03 * s, 0.03 * s));
  const dir = new THREE.Vector3(-side * 0.3, -0.72, 0.62).normalize();
  const tl = 0.062 * s;
  const TX = new THREE.Vector3().crossVectors(dir, new THREE.Vector3(0, 0, 1)).normalize();
  const TZ = new THREE.Vector3().crossVectors(TX, dir).normalize();
  const trings = [];
  const tr = [[0, 0.014], [0.3, 0.0135], [0.65, 0.011], [0.9, 0.0085], [1.0, 0.005], [1.03, 0]];
  for (const [t, r] of tr) {
    trings.push({ c: t0.clone().addScaledVector(dir, t * tl), sec: r === 0 ? { pole: true } : { rx: r * s, rzF: r * s, rzB: r * s, sq: 2 }, v: 0.5 - t * 0.4, w: () => W(hd, 1) });
  }
  mb.loft(trings, { X: TX, Z: TZ, A: dir, n: 5, rect: R.HAND, th0: 0, uMap: (u) => 0.8 + u * 0.18 });
}

function buildShoe(mb, bd, dims, side, cut, lod) {
  const P = dims.bind, s = bd.s * (0.95 + 0.05 * bd.girth);
  const L = side > 0;
  const ank = P[L ? B.footL : B.footR];
  const ft = L ? B.footL : B.footR, to = L ? B.toeL : B.toeR;
  const hi = cut === 'high' ? 2 : cut === 'mid' ? 1 : 0;
  // [z from the ankle, half width, bottom y, top y (low, mid, high)] — y above the ground
  const rows = [
    [-0.083, 0.0, 0.03, [0.03, 0.03, 0.03]],
    [-0.08, 0.022, 0.006, [0.06, 0.065, 0.075]],
    [-0.072, 0.033, 0.0, [0.085, 0.1, 0.13]],
    [-0.05, 0.041, 0.0, [0.104, 0.125, 0.165]],
    [-0.015, 0.045, 0.0, [0.112, 0.134, 0.172]],
    [0.022, 0.048, 0.0, [0.104, 0.124, 0.158]],
    [0.06, 0.051, 0.0, [0.084, 0.088, 0.09]],
    [0.1, 0.054, 0.0, [0.066, 0.066, 0.066]],
    [0.13, 0.055, 0.0, [0.056, 0.056, 0.056]],
    [0.168, 0.051, 0.0, [0.048, 0.048, 0.048]],
    [0.198, 0.043, 0.002, [0.041, 0.041, 0.041]],
    [0.218, 0.029, 0.006, [0.034, 0.034, 0.034]],
    [0.227, 0.0, 0.016, [0.022, 0.022, 0.022]],
  ];
  const keep = lod === 'high' ? rows : rows.filter((r, i) => i % 2 === 0 || i === rows.length - 1 || i === 1);
  const z0 = rows[0][0], z1 = rows[rows.length - 1][0];
  const X = new THREE.Vector3(side, 0, 0), Z = new THREE.Vector3(0, 1, 0), A = new THREE.Vector3(0, 0, 1);
  const rings = keep.map(([z, w, yb, yt]) => {
    const top = yt[hi];
    const cy = (yb + top) / 2, ry = (top - yb) / 2;
    return {
      c: new THREE.Vector3(ank.x + side * 0.004 * s, cy * s, ank.z + z * s),
      sec: w === 0 ? { pole: true } : { rx: w * s, rzF: ry * s, rzB: ry * s, sq: 2.6, sqB: 5 },
      v: (z - z0) / (z1 - z0),
      w: () => {
        if (z < 0.085) return W(ft, 1);
        const k = sstep(0.085, 0.15, z);
        return W(ft, 1 - k, to, k);
      },
    };
  });
  // section θ = 0 is the top of the shoe, 90 the outside, 180 the sole
  mb.loft(rings, { X, Z, A, n: lod === 'high' ? 10 : 6, rect: R.SHOE, th0: -90 });
}

// ------------------------------------------------------------------ accessories

function swatchUv(name) {
  const [u, v] = SWATCH[name];
  return uvOf(R.MISC, u, v, [0, 0]);
}

function buildTowel(mb, bd, dims) {
  const s = bd.s;
  const uv = swatchUv('towel');
  // hangs from the front of the waistband, over the right thigh
  const x0 = -0.112 * s, y0 = 1.05 * s, z0 = (0.098 * bd.waist + bd.belly * 0.01) * s + 0.004;
  const wdt = 0.07 * s, len = 0.2 * s;
  const verts = [], tris = [];
  const rows = 4;
  for (let i = 0; i <= rows; i++) {
    const t = i / rows;
    const y = y0 - t * len;
    const z = z0 + 0.02 * s * Math.sin(t * Math.PI * 0.8) + t * 0.02 * s;
    const sway = t * t;
    const w = W(B.hips, 1 - sway * 0.55, B.thighR, sway * 0.55);
    for (const k of [0, 1]) {
      const x = x0 + (k - 0.5) * wdt * (1 - t * 0.12);
      verts.push({ p: new THREE.Vector3(x, y, z), n: new THREE.Vector3(0, 0, 1), uv, w });
      verts.push({ p: new THREE.Vector3(x, y, z - 0.003), n: new THREE.Vector3(0, 0, -1), uv, w });
    }
  }
  for (let i = 0; i < rows; i++) {
    const a = i * 4;
    // front face (verts 0, 2 of each row), back face (1, 3)
    tris.push([a, a + 4, a + 6], [a, a + 6, a + 2]);
    tris.push([a + 1, a + 3, a + 7], [a + 1, a + 7, a + 5]);
  }
  mb.raw(verts, tris);
}

function buildNeckRoll(mb, bd, dims, lod) {
  const s = bd.s;
  const uv = swatchUv('neckRoll');
  const g = new THREE.TorusGeometry(0.105 * s * bd.neck, 0.03 * s, 6, lod === 'high' ? 14 : 8, Math.PI * 1.25);
  // lay the torus flat (Rx 90°) and turn it so the 225° arc wraps the back of the neck
  const m = new THREE.Matrix4().compose(
    new THREE.Vector3(0, 1.572 * s, -0.02 * s),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI / 2, -157.5 * D2R, 0, 'YXZ')),
    new THREE.Vector3(1.2, 1, 1),
  );
  mb.piece(g, m, (lx, ly, lz, gu, gv, out) => { out[0] = uv[0]; out[1] = uv[1]; }, () => W(B.chest, 1));
  g.dispose();
}

function buildHandWarmer(mb, bd) {
  const s = bd.s;
  const uv = swatchUv('warmer');
  const g = new THREE.CapsuleGeometry(0.032 * s, 0.13 * s, 3, 8);
  const m = new THREE.Matrix4().compose(
    new THREE.Vector3(0, 1.06 * s, (0.118 * bd.waist + bd.belly * 0.02) * s + 0.025 * s),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, Math.PI / 2)),
    new THREE.Vector3(1, 1, 0.8),
  );
  mb.piece(g, m, (lx, ly, lz, gu, gv, out) => { out[0] = uv[0]; out[1] = uv[1]; }, (x, y) => W(B.hips, 0.5, B.spine, 0.5));
  g.dispose();
}

function buildWhistle(mb, bd) {
  const s = bd.s;
  const uv = swatchUv('whistle');
  const g = new THREE.CylinderGeometry(0.009 * s, 0.009 * s, 0.035 * s, 6);
  const m = new THREE.Matrix4().compose(
    new THREE.Vector3(0.02 * s, 1.36 * s, 0.135 * s),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(0.3, 0, 0.5)),
    new THREE.Vector3(1, 1, 1),
  );
  mb.piece(g, m, (lx, ly, lz, gu, gv, out) => { out[0] = uv[0]; out[1] = uv[1]; }, () => W(B.chest, 1));
  g.dispose();
}

// ------------------------------------------------------------------ assemble

/**
 * Build the body geometry for a build + look.
 * extra: { helmetOn: [fn(mb)], hairAlways: [fn(mb)], hairOff: [fn(mb)] } — callbacks that
 * append geometry into the draw ranges (helmet-only decals, hanging hair, full hair).
 * Returns { geometry, ranges, landmarks, tris }.
 */
export function buildBody(dims, look = {}, opts = {}) {
  const bd = dims.bd;
  const lod = opts.lod || 'high';
  const mb = new MeshBuilder();
  // [helmet-on only][body][hair always][hair helmet-off only]
  for (const f of opts.helmetOn || []) f(mb);
  const bodyStart = mb.I.length;
  const parts = {};
  let mark = mb.triCount;
  const tally = (name) => { parts[name] = (parts[name] || 0) + mb.triCount - mark; mark = mb.triCount; };
  const torso = buildTorso(mb, bd, dims, lod); tally('torso');
  buildNeck(mb, bd, dims, lod); tally('neck');
  buildHead(mb, bd, dims, lod); tally('head');
  for (const sd of [1, -1]) {
    buildArm(mb, bd, dims, sd, lod); tally('arms');
    buildHand(mb, bd, dims, sd, lod); tally('hands');
    buildLeg(mb, bd, dims, sd, lod); tally('legs');
    buildShoe(mb, bd, dims, sd, look.shoes || 'low', lod); tally('shoes');
  }
  if (look.towel && lod === 'high') buildTowel(mb, bd, dims);
  if (look.neckRoll) buildNeckRoll(mb, bd, dims, lod);
  if (look.handWarmer && lod === 'high') buildHandWarmer(mb, bd);
  if (opts.whistle) buildWhistle(mb, bd);
  tally('props');
  const hairStart = mb.I.length;
  for (const f of opts.hairAlways || []) f(mb);
  const hairOffStart = mb.I.length;
  for (const f of opts.hairOff || []) f(mb);
  const end = mb.I.length;
  const geometry = mb.build();
  return {
    geometry,
    ranges: {
      helmetOn: { start: 0, count: hairOffStart },
      helmetOff: { start: bodyStart, count: end - bodyStart },
    },
    landmarks: { vAtY: torso.vAtY, vFromTop: torso.vFromTop },
    tris: end / 3,
    parts: { ...parts, hairAlways: (hairOffStart - hairStart) / 3, hairOff: (end - hairOffStart) / 3, helmetDecal: bodyStart / 3 },
  };
}
