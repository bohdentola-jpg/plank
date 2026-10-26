// The helmet. The shell is generated from its edge contour (the bottom edge
// and the face opening, a closed loop around the head) toward the crown, so
// the opening has a clean edge; a flared lip at the back, an inner padded
// shell and a rubber rim make it solid. The team texture is painted per texel
// by evaluating a 3D design function on the shell (stripes, skunk, wings,
// bolts, side logo decals, ear holes, bumper, rim trim), so nothing stretches
// over the dome. Facemasks are tube bars in six styles; chin strap + cup;
// visors as a separate transparent mesh. Helmet space: origin at the head
// centre, metres, +z forward (the model scales it with the head).
import * as THREE from 'three';
import { logoCanvas } from '../logos.js';
import { teamHelmetMaterial, finishOf } from './materials.js';
import { R as AR, uvOf } from './layout.js';

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const sstep = (a, b, v) => { const t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const lerp = (a, b, t) => a + (b - a) * t;
const D2R = Math.PI / 180;

export const HELMET_OFFSET = new THREE.Vector3(0, 0.012, -0.006);   // helmet centre relative to the head centre

// texture layout (512 × 256)
const TW = 512, TH = 256;
const HR = {
  SHELL: [0, 0, 512, 200],
  MASK: [4, 206, 120, 46],
  STRAP: [132, 206, 120, 46],
  PAD: [260, 206, 124, 46],
  RIM: [392, 206, 116, 46],
};
function huv(rect, u, v, out = [0, 0]) {
  out[0] = (rect[0] + u * rect[2]) / TW;
  out[1] = 1 - (rect[1] + (1 - v) * rect[3]) / TH;
  return out;
}

// ------------------------------------------------------------------ shell shape

function shellR(dx, dy, dz) {
  const a = 0.127, b = dy > 0 ? 0.138 : 0.134, c = dz > 0 ? 0.142 : 0.152;
  const p = lerp(2.15, 3.0, sstep(0.15, -0.55, dy));
  return Math.pow(Math.pow(Math.abs(dx / a), p) + Math.pow(Math.abs(dy / b), p) + Math.pow(Math.abs(dz / c), p), -1 / p);
}

/** Shell point at (λ, φ) degrees; inset > 0 moves inward (padding surface). */
export function shellPoint(lam, phi, out, inset = 0, flare = true) {
  const la = lam * D2R, ph = phi * D2R;
  const dx = Math.cos(ph) * Math.sin(la), dy = Math.sin(ph), dz = Math.cos(ph) * Math.cos(la);
  let r = shellR(dx, dy, dz) - inset;
  if (flare && inset === 0) r += 0.011 * sstep(-0.32, -0.6, dy) * sstep(-0.2, -0.85, dz);
  out.set(dx * r + HELMET_OFFSET.x, dy * r + HELMET_OFFSET.y, dz * r + HELMET_OFFSET.z);
  return out;
}

// edge contour: (λ, φ) from the back centre, round the right side, across the brow, round the left side
const EDGE_HALF = [
  [0, 15.5], [16, 15], [30, 12.5], [38, 7.5], [43, -2], [46, -14], [48, -27], [50.5, -38], [55, -47], [64, -53.5],
  [80, -56.5], [100, -55.5], [122, -48], [146, -38], [165, -33], [180, -31.5],
];
const EDGE = (() => {
  const L = [];
  for (let i = EDGE_HALF.length - 1; i >= 0; i--) L.push([-EDGE_HALF[i][0], EDGE_HALF[i][1]]);
  for (let i = 1; i < EDGE_HALF.length; i++) L.push(EDGE_HALF[i]);
  return L;   // λ from −180 to +180
})();

// dense arc-length table of the contour
const CONTOUR = (() => {
  const dense = [];
  const p = new THREE.Vector3(), q = new THREE.Vector3();
  for (let i = 0; i < EDGE.length - 1; i++) {
    const [l0, f0] = EDGE[i], [l1, f1] = EDGE[i + 1];
    const steps = 24;
    for (let k = 0; k < steps; k++) {
      const t = k / steps;
      dense.push([lerp(l0, l1, t), lerp(f0, f1, t)]);
    }
  }
  dense.push(EDGE[EDGE.length - 1]);
  const arc = [0];
  for (let i = 1; i < dense.length; i++) {
    shellPoint(dense[i - 1][0], dense[i - 1][1], p);
    shellPoint(dense[i][0], dense[i][1], q);
    arc.push(arc[i - 1] + p.distanceTo(q));
  }
  const total = arc[arc.length - 1];
  return { dense, arc: arc.map((a) => a / total) };
})();

/** Contour (λ, φ) at arc fraction c ∈ [0, 1]. */
function contourAt(c, out) {
  const { dense, arc } = CONTOUR;
  let lo = 0, hi = arc.length - 1;
  while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (arc[mid] <= c) lo = mid; else hi = mid; }
  const t = (c - arc[lo]) / (arc[hi] - arc[lo] || 1);
  out[0] = lerp(dense[lo][0], dense[hi][0], t);
  out[1] = lerp(dense[lo][1], dense[hi][1], t);
  return out;
}

const _cs = [0, 0];
/** Shell surface at (c, s): c around the contour, s from the edge (0) to the crown (1). */
export function shellAt(c, s, out, inset = 0) {
  contourAt(c, _cs);
  const phi = lerp(_cs[1], 90, s);
  return shellPoint(_cs[0], Math.min(phi, 89.6), out, inset);
}

// ------------------------------------------------------------------ plain geometry builder

class GB {
  constructor() { this.P = []; this.N = []; this.UV = []; this.I = []; }
  get count() { return this.P.length / 3; }
  v(p, n, uv) { this.P.push(p.x, p.y, p.z); this.N.push(n.x, n.y, n.z); this.UV.push(uv[0], uv[1]); return this.count - 1; }
  /** add a triangle, flipped if its face normal disagrees with the vertex normals */
  t(a, b, c) {
    const P = this.P, N = this.N;
    const ax = P[a * 3], ay = P[a * 3 + 1], az = P[a * 3 + 2];
    const ux = P[b * 3] - ax, uy = P[b * 3 + 1] - ay, uz = P[b * 3 + 2] - az;
    const vx = P[c * 3] - ax, vy = P[c * 3 + 1] - ay, vz = P[c * 3 + 2] - az;
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const dot = nx * (N[a * 3] + N[b * 3] + N[c * 3]) + ny * (N[a * 3 + 1] + N[b * 3 + 1] + N[c * 3 + 1]) + nz * (N[a * 3 + 2] + N[b * 3 + 2] + N[c * 3 + 2]);
    if (dot < 0) this.I.push(a, c, b); else this.I.push(a, b, c);
  }
  merge(g, uv) {
    const base = this.count;
    const p = g.attributes.position, n = g.attributes.normal;
    for (let i = 0; i < p.count; i++) {
      this.P.push(p.getX(i), p.getY(i), p.getZ(i));
      this.N.push(n.getX(i), n.getY(i), n.getZ(i));
      this.UV.push(uv[0], uv[1]);
    }
    if (g.index) for (let i = 0; i < g.index.count; i++) this.I.push(base + g.index.getX(i));
    else for (let i = 0; i < p.count; i++) this.I.push(base + i);
  }
  build() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.P, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.N, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.UV, 2));
    g.setIndex(this.I);
    return g;
  }
}

function shellNormal(c, s, inset, out) {
  const p = new THREE.Vector3(), a = new THREE.Vector3(), b = new THREE.Vector3();
  shellAt(c, s, p, inset);
  const dc = 0.004, ds = 0.01;
  shellAt(Math.min(1, c + dc), s, a, inset);
  shellAt(Math.max(0, c - dc), s, b, inset);
  const tc = a.sub(b);
  shellAt(c, Math.min(1, s + ds), a, inset);
  shellAt(c, Math.max(0, s - ds), b, inset);
  const ts = a.sub(b);
  out.crossVectors(tc, ts);
  if (out.lengthSq() < 1e-14 || s > 0.985) out.copy(p).sub(HELMET_OFFSET);
  out.normalize();
  const radial = p.clone().sub(HELMET_OFFSET);
  if (out.dot(radial) < 0) out.negate();
  return out;
}

function buildShell(gb, lod) {
  const nc = lod === 'high' ? 36 : 20;
  const ns = lod === 'high' ? 8 : 4;
  const sOf = (k) => Math.pow(k / ns, 1.15);
  const p = new THREE.Vector3(), n = new THREE.Vector3();
  const uv = [0, 0];
  // outer shell
  const outer = [];
  for (let k = 0; k <= ns; k++) {
    for (let j = 0; j <= nc; j++) {
      const c = j / nc, s = sOf(k);
      shellAt(c, s, p);
      shellNormal(c, s, 0, n);
      outer.push(gb.v(p, n, huv(HR.SHELL, c, s, uv)));
    }
  }
  for (let k = 0; k < ns; k++) for (let j = 0; j < nc; j++) {
    const a = outer[k * (nc + 1) + j], b = outer[k * (nc + 1) + j + 1], c = outer[(k + 1) * (nc + 1) + j + 1], d = outer[(k + 1) * (nc + 1) + j];
    gb.t(a, b, c); gb.t(a, c, d);
  }
  // inner padding shell (coarser), normals inward
  const inset = 0.016;
  const nci = lod === 'high' ? 16 : 8, nsi = lod === 'high' ? 3 : 2;
  const inner = [];
  for (let k = 0; k <= nsi; k++) {
    for (let j = 0; j <= nci; j++) {
      const c = j / nci, s = Math.pow(k / nsi, 1.3) * 0.98;
      shellAt(c, s, p, inset);
      shellNormal(c, s, inset, n);
      n.negate();
      inner.push(gb.v(p, n, huv(HR.PAD, c, s, uv)));
    }
  }
  for (let k = 0; k < nsi; k++) for (let j = 0; j < nci; j++) {
    const a = inner[k * (nci + 1) + j], b = inner[k * (nci + 1) + j + 1], c = inner[(k + 1) * (nci + 1) + j + 1], d = inner[(k + 1) * (nci + 1) + j];
    gb.t(a, b, c); gb.t(a, c, d);
  }
  // rubber rim joining the outer and inner edges
  const q = new THREE.Vector3(), en = new THREE.Vector3(), up = new THREE.Vector3();
  const rim = [];
  for (let j = 0; j <= nc; j++) {
    const c = j / nc;
    shellAt(c, 0, p);
    shellAt(c, 0, q, inset);
    shellAt(c, 0.05, up);
    en.subVectors(p, up).normalize();   // away from the crown
    rim.push(gb.v(p, en, huv(HR.RIM, c, 1, uv)), gb.v(q, en, huv(HR.RIM, c, 0, uv)));
  }
  for (let j = 0; j < nc; j++) {
    const a = rim[j * 2], b = rim[j * 2 + 1], c = rim[j * 2 + 3], d = rim[j * 2 + 2];
    gb.t(a, b, c); gb.t(a, c, d);
  }
}

// ------------------------------------------------------------------ facemasks

// bars as control points (helmet space). x is mirrored automatically for "sym" bars.
const zF = (y) => 0.152 + (0.04 - y) * 0.14;   // front plane leans out toward the chin
function hbar(yf, ys, opts = {}) {
  const xs = opts.xs ?? 0.108, zs = opts.zs ?? 0.066;
  const zf = zF(yf) + (opts.dz || 0);
  const pts = [
    [xs, ys, zs], [xs - 0.006, lerp(ys, yf, 0.55), zs + 0.04], [0.074, yf, zf - 0.024], [0, yf + (opts.sag || 0), zf],
  ];
  return { pts: pts.concat(pts.slice(0, 3).reverse().map(([x, y, z]) => [-x, y, z])) };
}
const RAIL = { pts: [[0.093, 0.04, 0.118], [0.106, 0.005, 0.104], [0.11, -0.035, 0.088], [0.106, -0.072, 0.072], [0.098, -0.092, 0.062]], sym: true };
const TOPBAR = { pts: [[0.093, 0.04, 0.118], [0.07, 0.046, 0.14], [0.0, 0.047, 0.152], [-0.07, 0.046, 0.14], [-0.093, 0.04, 0.118]] };
const vbar = (x, y0, y1) => ({ pts: [[x, y0, zF(y0) + 0.002], [x, (y0 + y1) / 2, zF((y0 + y1) / 2) + 0.004], [x, y1, zF(y1) + 0.002]], sym: x !== 0 });

const MASKS = {
  qb: [TOPBAR, RAIL, hbar(-0.022, -0.016), hbar(-0.088, -0.082, { sag: -0.004 })],
  skill: [TOPBAR, RAIL, hbar(-0.02, -0.014), hbar(-0.088, -0.082, { sag: -0.004 }), vbar(0, -0.02, -0.088)],
  robot: [TOPBAR, RAIL, hbar(-0.02, -0.014), hbar(-0.09, -0.084, { sag: -0.002 }),
    { pts: [[0.106, -0.02, 0.09], [0.07, -0.05, 0.15], [0.03, -0.088, zF(-0.088) + 0.002]], sym: true }],
  lineman: [TOPBAR, RAIL, hbar(-0.016, -0.01), hbar(-0.052, -0.046), hbar(-0.09, -0.084, { sag: -0.003 }), vbar(0, 0.047, -0.09)],
  cage: [TOPBAR, RAIL, hbar(-0.016, -0.01), hbar(-0.052, -0.046), hbar(-0.09, -0.084, { sag: -0.003 }), vbar(0, 0.047, -0.09), vbar(0.042, -0.016, -0.09)],
  kicker: [TOPBAR, { pts: RAIL.pts.slice(0, 4), sym: true }, hbar(-0.04, -0.034, { sag: -0.003 })],
};
export const MASK_STYLES = Object.keys(MASKS);

function buildMask(gb, style, lod) {
  const bars = MASKS[style] || MASKS.skill;
  const radial = lod === 'high' ? 4 : 3;
  const r = 0.0047;
  const uv = huv(HR.MASK, 0.5, 0.5, [0, 0]);
  const list = [];
  for (const b of bars) {
    list.push(b.pts);
    if (b.sym) list.push(b.pts.map(([x, y, z]) => [-x, y, z]));
  }
  if (lod !== 'high') list.splice(4);   // low LOD: top bar, rails, first bar
  for (const pts of list) {
    const curve = new THREE.CatmullRomCurve3(pts.map(([x, y, z]) => new THREE.Vector3(x, y, z).add(HELMET_OFFSET)), false, 'centripetal');
    const len = curve.getLength();
    const segs = Math.max(3, Math.round(len / (lod === 'high' ? 0.03 : 0.05)));
    const g = new THREE.TubeGeometry(curve, segs, r, radial, false);
    gb.merge(g, uv);
    g.dispose();
  }
}

function buildStrap(gb, lod) {
  if (lod !== 'high') return;
  const uv = huv(HR.STRAP, 0.5, 0.5, [0, 0]);
  const cup = new THREE.Vector3(0, -0.118, 0.082).add(HELMET_OFFSET);
  for (const sd of [1, -1]) {
    for (const [a, b] of [[[0.112, -0.05, 0.05], [0.075, -0.098, 0.086]], [[0.116, -0.098, 0.03], [0.07, -0.122, 0.07]]]) {
      const pts = [new THREE.Vector3(sd * a[0], a[1], a[2]).add(HELMET_OFFSET), new THREE.Vector3(sd * lerp(a[0], b[0], 0.5) * 1.02, lerp(a[1], b[1], 0.5), lerp(a[2], b[2], 0.5)).add(HELMET_OFFSET), new THREE.Vector3(sd * b[0], b[1], b[2]).add(HELMET_OFFSET), cup.clone().add(new THREE.Vector3(sd * 0.022, 0.004, -0.004))];
      const g = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 5, 0.0035, 3, false);
      gb.merge(g, uv);
      g.dispose();
    }
  }
  const g = new THREE.SphereGeometry(1, 8, 4, 0, Math.PI * 2, 0, Math.PI * 0.62);
  g.rotateX(Math.PI / 2 + 0.35);
  g.scale(0.027, 0.019, 0.014);
  g.translate(cup.x, cup.y - 0.004, cup.z - 0.002);
  gb.merge(g, uv);
  g.dispose();
}

const geoCache = new Map();
/** Shell + facemask + chin strap, shared by every helmet with this facemask style. */
export function helmetGeometry(style, lod = 'high') {
  const key = `${style}|${lod}`;
  if (geoCache.has(key)) return geoCache.get(key);
  const gb = new GB();
  buildShell(gb, lod);
  buildMask(gb, style, lod);
  buildStrap(gb, lod);
  const g = gb.build();
  g.computeBoundingSphere();
  g.userData.shared = true;
  geoCache.set(key, g);
  return g;
}

let visorGeo = null;
export function visorGeometry() {
  if (visorGeo) return visorGeo;
  const gb = new GB();
  const nx = 12, ny = 3;
  const p = new THREE.Vector3(), n = new THREE.Vector3();
  const ids = [];
  for (let j = 0; j <= ny; j++) {
    for (let i = 0; i <= nx; i++) {
      const a = lerp(-50, 50, i / nx) * D2R;
      const y = lerp(-0.026, 0.04, j / ny);
      const R = 0.128 - 0.004 * Math.abs(i / nx - 0.5) * 2;
      p.set(Math.sin(a) * R * 0.9, y, Math.cos(a) * R + 0.004).add(HELMET_OFFSET);
      n.set(Math.sin(a), 0.1, Math.cos(a)).normalize();
      ids.push(gb.v(p, n, [i / nx, j / ny]));
    }
  }
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const a = ids[j * (nx + 1) + i], b = ids[j * (nx + 1) + i + 1], c = ids[(j + 1) * (nx + 1) + i + 1], d = ids[(j + 1) * (nx + 1) + i];
    gb.t(a, b, c); gb.t(a, c, d);
  }
  visorGeo = gb.build();
  visorGeo.userData.shared = true;
  return visorGeo;
}

// ------------------------------------------------------------------ team texture

function hexRGB(hex) {
  const n = parseInt(String(hex || '#888888').replace('#', ''), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function distToSeg(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay;
  const t = clamp(((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy || 1), 0, 1);
  return Math.hypot(px - ax - dx * t, py - ay - dy * t);
}

const BOLT = [[0.115, 0.07], [0.03, 0.045], [0.0, 0.065], [-0.08, 0.028], [-0.045, 0.03], [-0.13, -0.005]];

/** Paint colour for a shell point P (helmet space) — the helmet's design. */
function design(P, team, logo, s) {
  const H = team.helmet || {};
  const sc = H.stripeColors || [];
  const P0x = P.x - HELMET_OFFSET.x, P0y = P.y - HELMET_OFFSET.y, P0z = P.z - HELMET_OFFSET.z;
  const ax = Math.abs(P0x);
  let col = H.shell || '#ffffff';
  const stripe = H.stripe || 'none';
  if (stripe === 'single') { if (ax < 0.0115) col = sc[0]; }
  else if (stripe === 'double') {
    if (ax > 0.007 && ax < 0.019) col = sc[0];
    else if (sc[1] && ax >= 0.019 && ax < 0.0235) col = sc[1];
  } else if (stripe === 'triple') {
    if (ax < 0.0075) col = sc[1] || sc[0];
    else if (ax > 0.0115 && ax < 0.0205) col = P0x > 0 ? sc[0] : (sc[2] || sc[0]);
  } else if (stripe === 'skunk') {
    if (ax < 0.03) col = sc[0];
    else if (sc[1] && ax < 0.037) col = sc[1];
  } else if (stripe === 'bolt') {
    if (ax > 0.07) {
      let d = 1;
      for (let i = 0; i < BOLT.length - 1; i++) d = Math.min(d, distToSeg(P0z, P0y, BOLT[i][0], BOLT[i][1], BOLT[i + 1][0], BOLT[i + 1][1]));
      const w = 0.011 * (1 - 0.5 * sstep(0.1, -0.13, P0z));
      if (d < w) col = sc[0];
      else if (sc[1] && d < w + 0.004) col = sc[1];
    }
  } else if (stripe === 'wings') {
    // front "wings": the front of the shell in the stripe colour with a pointed edge sweeping back over the ears
    const edge = 0.05 + 0.07 * sstep(0.0, 0.13, ax) - 0.09 * clamp(P0y / 0.14, 0, 1) - 0.035 * sstep(-0.02, -0.09, P0y);
    const wing = P0z > edge + 0.012 * Math.sin(ax * 140);
    const tails = P0y > 0.04 && (ax < 0.008 || Math.abs(ax - 0.042) < 0.0065);
    if (wing || tails) col = sc[0];
    else if (sc[1] && (P0z > edge - 0.006 || (P0y > 0.04 && (ax < 0.012 || Math.abs(ax - 0.042) < 0.01)))) col = sc[1];
  }
  let rgb = hexRGB(col);
  // side logo decals (readable from either side)
  if (logo && ax > 0.055) {
    const side = P0x > 0 ? 1 : -1;
    const size = 0.094, zc = -0.012, yc = 0.02;
    const ix = 0.5 - side * (P0z - zc) / size, iy = 0.5 - (P0y - yc) / size;
    if (ix >= 0 && ix < 1 && iy >= 0 && iy < 1) {
      const lx = Math.floor(ix * logo.w), ly = Math.floor(iy * logo.h);
      const k = (ly * logo.w + lx) * 4;
      const a = logo.d[k + 3] / 255;
      if (a > 0) rgb = [lerp(rgb[0], logo.d[k], a), lerp(rgb[1], logo.d[k + 1], a), lerp(rgb[2], logo.d[k + 2], a)];
    }
  }
  // ear holes with a metal ring
  if (ax > 0.08) {
    const d = Math.hypot(P0z - 0.002, P0y + 0.045);
    if (d < 0.0095) rgb = [16, 16, 18];
    else if (d < 0.0135) rgb = [150, 152, 156];
  }
  // front bumper above the brow
  if (ax < 0.026 && P0y > 0.034 && P0y < 0.055 && P0z > 0.1) rgb = [24, 24, 26];
  // rubber trim along the edge
  if (s < 0.024) rgb = [20, 20, 22];
  else if (s < 0.04) rgb = rgb.map((c) => c * 0.82);
  return rgb;
}

const texCache = new Map();

/** The team's helmet paint (shared by the whole team). */
export function teamHelmetTexture(team) {
  const key = team.id + '|' + JSON.stringify(team.helmet);
  if (texCache.has(key)) return texCache.get(key);
  const c = document.createElement('canvas');
  c.width = TW; c.height = TH;
  const x = c.getContext('2d');
  // logo pixels
  let logo = null;
  if (team.helmet?.logo !== false && team.logo) {
    const lc = logoCanvas(team, 128);
    logo = { w: lc.width, h: lc.height, d: lc.getContext('2d').getImageData(0, 0, lc.width, lc.height).data };
  }
  const [sx, sy, sw, sh] = HR.SHELL;
  const img = x.createImageData(sw, sh);
  const P = new THREE.Vector3();
  for (let j = 0; j < sh; j++) {
    const s = 1 - (j + 0.5) / sh;
    for (let i = 0; i < sw; i++) {
      const cc = (i + 0.5) / sw;
      shellAt(cc, s, P);
      const rgb = design(P, team, logo, s);
      // a little ambient occlusion toward the edge
      const ao = 0.86 + 0.14 * sstep(0.0, 0.25, s);
      const k = (j * sw + i) * 4;
      img.data[k] = rgb[0] * ao; img.data[k + 1] = rgb[1] * ao; img.data[k + 2] = rgb[2] * ao; img.data[k + 3] = 255;
    }
  }
  x.putImageData(img, sx, sy);
  // facemask / strap / padding / rim swatches
  const H = team.helmet || {};
  x.fillStyle = H.facemask || '#cccccc'; x.fillRect(...HR.MASK);
  // chin strap + cup: the team's, else white on light shells and black on dark ones
  const shellC = new THREE.Color(H.shell || '#888888');
  x.fillStyle = H.strap || (0.2126 * shellC.r + 0.7152 * shellC.g + 0.0722 * shellC.b > 0.45 ? '#e4e4e2' : '#1d1e21'); x.fillRect(...HR.STRAP);
  x.fillStyle = '#1a1b1e'; x.fillRect(...HR.PAD);
  // jaw pads in the team colour at the cheeks of the padding (c ranges at the face-opening sides, low s)
  x.fillStyle = team.colors?.primary || '#222';
  for (const [c0, c1] of [[0.24, 0.42], [0.58, 0.76]]) x.fillRect(HR.PAD[0] + c0 * HR.PAD[2], HR.PAD[1] + HR.PAD[3] * 0.55, (c1 - c0) * HR.PAD[2], HR.PAD[3] * 0.45);
  x.fillStyle = '#18181a'; x.fillRect(...HR.RIM);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  tex.userData.keep = true;
  texCache.set(key, tex);
  return tex;
}

const ormCache = new Map();
/** Packed clearcoat (R) / roughness (G) / metalness (B) for a finish. */
export function helmetORM(finishName) {
  if (ormCache.has(finishName)) return ormCache.get(finishName);
  const f = finishOf(finishName);
  const c = document.createElement('canvas');
  c.width = TW / 4; c.height = TH / 4;
  const x = c.getContext('2d');
  const put = (rect, cc, r, m) => {
    x.fillStyle = `rgb(${Math.round(cc * 255)},${Math.round(r * 255)},${Math.round(m * 255)})`;
    x.fillRect(rect[0] / 4, rect[1] / 4, Math.ceil(rect[2] / 4), Math.ceil(rect[3] / 4));
  };
  x.fillStyle = 'rgb(0,230,0)'; x.fillRect(0, 0, c.width, c.height);
  put(HR.SHELL, f.clear, f.rough, f.metal);
  put(HR.MASK, 0.6, 0.34, 0.25);
  put(HR.STRAP, 0.0, 0.55, 0.0);
  put(HR.PAD, 0.0, 0.92, 0.0);
  put(HR.RIM, 0.0, 0.7, 0.0);
  // the bottom rim of the shell region is rubber: keep the clearcoat off there
  x.fillStyle = `rgb(0,${Math.round(0.7 * 255)},0)`;
  x.fillRect(0, (HR.SHELL[3] * (1 - 0.024)) / 4, c.width, 2);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.NoColorSpace;
  t.userData.keep = true;
  ormCache.set(finishName, t);
  return t;
}

export function helmetMaterialFor(team, lod = 'high') {
  const tex = teamHelmetTexture(team);
  const fin = team.helmet?.finish || 'gloss';
  return teamHelmetMaterial(team.id + '|' + JSON.stringify(team.helmet), tex, helmetORM(fin), fin, lod);
}

// ------------------------------------------------------------------ helmet number decal (in the body mesh)

/**
 * Append the back-of-helmet number decal into a body MeshBuilder: a patch on the
 * shell (slightly proud), weighted to the head bone, mapped to the HNUM atlas rect.
 * C = head centre (model space), hs = head scale, headBone = bone index.
 */
export function addHelmetNumberDecal(mb, C, hs, headBone) {
  const nx = 4, ny = 2;
  const p = new THREE.Vector3(), n = new THREE.Vector3(), q = new THREE.Vector3();
  const verts = [], tris = [];
  for (let j = 0; j <= ny; j++) {
    for (let i = 0; i <= nx; i++) {
      const lam = 180 - 15 + (30 * i) / nx;   // increasing λ → toward −x: reads correctly from behind
      const phi = 6 + (20 * j) / ny;
      shellPoint(lam, phi, p);
      shellPoint(lam, phi, q, -0.0015);
      n.copy(q).sub(HELMET_OFFSET).normalize();
      const uv = uvOf(AR.HNUM, i / nx, j / ny, [0, 0]);
      verts.push({ p: q.clone().multiplyScalar(hs).add(C), n: n.clone(), uv, w: [headBone, 1] });
    }
  }
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const a = j * (nx + 1) + i, b = a + 1, c = a + nx + 2, d = a + nx + 1;
    tris.push([a, c, b], [a, d, c]);
  }
  // orient: the patch faces outward (−z at the back); check one triangle
  const A = verts[tris[0][0]].p, Bv = verts[tris[0][1]].p, Cv = verts[tris[0][2]].p;
  const fn = new THREE.Vector3().subVectors(Bv, A).cross(new THREE.Vector3().subVectors(Cv, A));
  if (fn.dot(verts[0].n) < 0) for (const t of tris) { const tmp = t[1]; t[1] = t[2]; t[2] = tmp; }
  mb.raw(verts, tris);
}
