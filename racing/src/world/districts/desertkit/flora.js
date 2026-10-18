// PORT HALCYON — desert kit plants: saguaros (ribbed columns with arms),
// Joshua trees (shaggy forked arms, spiky pom-pom tips), yuccas, ocotillos,
// barrel cacti, prickly pears, junipers, dead trees, and the shrubs (crossed
// cut-out quads from the foliage atlas: creosote, bursage, bunchgrass, sage).
// All take an Acc of MAT.plant (vertex-coloured) except shrub() (MAT.foliage).
import { cylinder, cone, box } from '../builder.js';
import { paint, paintMix, tube, blob, hash1, TAU } from './kit.js';

/** A ribbed column (a saguaro's trunk or arm): seg ribs alternating two greens, domed top. */
function ribbed(acc, x, y0, z, r, h, seg, c1, c2) {
  const ring = (y, rr) => {
    const out = [];
    for (let k = 0; k < seg; k++) { const a = (k / seg) * TAU, f = k % 2 ? 0.84 : 1; out.push([x + Math.cos(a) * rr * f, y, z + Math.sin(a) * rr * f]); }
    return out;
  };
  const rings = [ring(y0 - 0.2, r * 0.96), ring(y0 + h * 0.45, r * 1.04), ring(y0 + h * 0.86, r), ring(y0 + h * 0.96, r * 0.7), ring(y0 + h, r * 0.18)];
  for (let i = 0; i < rings.length - 1; i++) {
    for (let k = 0; k < seg; k++) {
      const k2 = (k + 1) % seg;
      paint(acc, k % 2 ? c2 : c1, i >= 3 ? 1.12 : 1);
      acc.quadP(rings[i][k2], rings[i][k], rings[i + 1][k], rings[i + 1][k2]);
    }
  }
}

/** A saguaro: s scales it (1 ≈ 8 m), seed picks its arms. */
export function saguaro(acc, x, y, z, s, seed) {
  const h = (6.5 + hash1(seed, 1) * 3) * s, r = 0.36 * Math.max(0.8, s);
  ribbed(acc, x, y, z, r, h, 10, '#5a7a3c', '#40582a');
  const arms = hash1(seed, 2) < 0.15 ? 0 : 1 + Math.floor(hash1(seed, 3) * 3.2);
  for (let k = 0; k < arms; k++) {
    const a = hash1(seed, 10 + k) * TAU, ha = h * (0.38 + hash1(seed, 20 + k) * 0.3);
    const out = 0.9 + hash1(seed, 30 + k) * 0.5, up = h * (0.2 + hash1(seed, 40 + k) * 0.22);
    const dx = Math.cos(a), dz = Math.sin(a);
    paint(acc, '#527036');
    const rr = r * 0.62;
    tube(acc, [[x + dx * r * 0.5, y + ha, z + dz * r * 0.5], [x + dx * out * 0.8, y + ha + 0.12, z + dz * out * 0.8], [x + dx * out, y + ha + 0.6, z + dz * out], [x + dx * out, y + ha + up, z + dz * out]], [rr, rr, rr * 0.96, rr * 0.9], 7, false);
    paint(acc, '#5d7d40', 1.08);
    cone(acc, x + dx * out, y + ha + up, z + dz * out, rr * 0.9, rr * 1.4, 7);
  }
}

// a triangle wound to face away from the point o
function triOut(acc, A, B, C, o) {
  const ux = B[0] - A[0], uy = B[1] - A[1], uz = B[2] - A[2], vx = C[0] - A[0], vy = C[1] - A[1], vz = C[2] - A[2];
  const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
  const dot = nx * ((A[0] + B[0] + C[0]) / 3 - o[0]) + ny * ((A[1] + B[1] + C[1]) / 3 - o[1]) + nz * ((A[2] + B[2] + C[2]) / 3 - o[2]);
  const i0 = acc.v(A[0], A[1], A[2], 0, 0), i1 = acc.v(B[0], B[1], B[2], 1, 0), i2 = acc.v(C[0], C[1], C[2], 0.5, 1);
  if (dot >= 0) acc.tri(i0, i1, i2); else acc.tri(i0, i2, i1);
}

/** A spiky pom-pom: a jittered octahedron core with five spikes (three-sided pyramids). */
function pompom(acc, x, y, z, s, seed) {
  const c = [x, y, z], r = 0.3 * s;
  const P = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]].map((d, i) => {
    const k = r * (0.85 + hash1(seed, i, 5) * 0.3);
    return [x + d[0] * k, y + d[1] * k * 0.9, z + d[2] * k];
  });
  for (const a of [0, 1]) for (const b of [2, 3]) for (const d of [4, 5]) triOut(acc, P[a], P[b], P[d], c);
  for (let q = 0; q < 5; q++) {
    // one straight up, four round the sides tilted up
    const an = (q / 4) * TAU + hash1(seed, q, 77) * 0.9, el = q === 4 ? 1.45 : 0.3 + hash1(seed, q, 78) * 0.45;
    const dx = Math.cos(an) * Math.cos(el), dy = Math.sin(el), dz = Math.sin(an) * Math.cos(el);
    // two vectors square to the spike
    let sx = -dz, sy = 0, sz = dx;
    const sl = Math.hypot(sx, sz) || 1;
    sx /= sl; sz /= sl;
    if (Math.hypot(dx, dz) < 0.05) { sx = 1; sz = 0; }
    const ux = dy * sz - dz * sy, uy = dz * sx - dx * sz, uz = dx * sy - dy * sx;
    const b0 = [x + dx * r * 0.5, y + dy * r * 0.5, z + dz * r * 0.5], rb = 0.13 * s, len = (0.55 + hash1(seed, q, 79) * 0.2) * s;
    const T = [x + dx * len, y + dy * len, z + dz * len];
    const B = [0, 1, 2].map((k) => { const a = (k / 3) * TAU; return [b0[0] + (sx * Math.cos(a) + ux * Math.sin(a)) * rb, b0[1] + (sy * Math.cos(a) + uy * Math.sin(a)) * rb, b0[2] + (sz * Math.cos(a) + uz * Math.sin(a)) * rb]; });
    for (let k = 0; k < 3; k++) triOut(acc, B[k], B[(k + 1) % 3], T, b0);
  }
}

/** A Joshua tree: a shaggy trunk forking into arms, spiky clusters at the tips. */
export function joshua(acc, x, y, z, s, seed) {
  const tips = [];
  const grow = (p, dir, len, r, depth, k) => {
    const lean = 0.25 + hash1(seed, k, 1) * 0.45;
    const a = hash1(seed, k, 2) * TAU;
    let dx = dir[0] * 0.5 + Math.cos(a) * lean, dy = dir[1] * 0.6 + 0.8, dz = dir[2] * 0.5 + Math.sin(a) * lean;
    const l = Math.hypot(dx, dy, dz);
    dx /= l; dy /= l; dz /= l;
    const end = [p[0] + dx * len, p[1] + dy * len, p[2] + dz * len];
    paintMix(acc, '#6a5a44', '#857058', hash1(seed, k, 5));
    tube(acc, [p, end], [r, r * 0.8], 5, false);
    const kids = depth > 0 ? (hash1(seed, k, 6) < (depth > 1 ? 0.5 : 0.6) ? 2 : 1) : 0;
    if (!kids) { tips.push([end, [dx, dy, dz], r]); return; }
    for (let q = 0; q < kids; q++) grow(end, [dx, dy, dz], len * (0.62 + hash1(seed, k * 7 + q, 7) * 0.25), r * 0.74, depth - 1, k * 3 + q + 1);
  };
  const trunkH = (1.6 + hash1(seed, 9) * 1.6) * s;
  paint(acc, '#5e4e3a');
  const base = [x, y - 0.3, z], top = [x + (hash1(seed, 8) - 0.5) * 0.4, y + trunkH, z + (hash1(seed, 7) - 0.5) * 0.4];
  tube(acc, [base, top], [0.36 * s, 0.28 * s], 6, false);
  const n = hash1(seed, 11) < 0.25 ? 1 : 2 + (hash1(seed, 12) < 0.3 ? 1 : 0);
  const depth = s > 1.05 ? 2 : 1;
  for (let k = 0; k < n; k++) grow(top, [0, 1, 0], (1.4 + hash1(seed, 13 + k) * 0.9) * s, 0.24 * s, depth, k + 1);
  // the tips: a skirt of dead leaves, a burst of green spikes
  for (const [p, d, r] of tips) {
    paint(acc, '#6b6040');
    tube(acc, [[p[0], p[1] - 0.4 * s, p[2]], [p[0], p[1] + 0.1 * s, p[2]]], [r * 1.9, r * 1.4], 5, false);
    paintMix(acc, '#5d6e34', '#6e7e40', hash1(seed, Math.round(p[0] * 10)));
    pompom(acc, p[0] + d[0] * 0.15, p[1] + 0.25 * s, p[2] + d[2] * 0.15, s, seed + Math.round(p[1] * 31));
  }
}

/** A yucca: a short trunk and a spiky rosette. */
export function yucca(acc, x, y, z, s, seed) {
  const th = (0.4 + hash1(seed, 1) * 0.9) * s;
  paint(acc, '#6a5a44');
  cylinder(acc, x, y - 0.2, z, 0.12 * s, th + 0.2, 5, { r2: 0.1 * s });
  for (let k = 0; k < 11; k++) {
    const a = hash1(seed, k) * TAU, lean = 0.25 + hash1(seed, k, 1) * 0.9, len = (0.75 + hash1(seed, k, 2) * 0.4) * s;
    paint(acc, k % 2 ? '#6e7a40' : '#7d8650');
    tube(acc, [[x, y + th, z], [x + Math.cos(a) * Math.sin(lean) * len, y + th + Math.cos(lean) * len, z + Math.sin(a) * Math.sin(lean) * len]], [0.06 * s, 0.006], 3, false);
  }
}

/** An ocotillo: thin whips fanning out of one base. */
export function ocotillo(acc, x, y, z, s, seed) {
  for (let k = 0; k < 9; k++) {
    const a = (k / 9) * TAU + hash1(seed, k) * 0.5, lean = 0.12 + hash1(seed, k, 1) * 0.32, len = (3 + hash1(seed, k, 2) * 1.8) * s;
    const tip = [x + Math.cos(a) * Math.sin(lean) * len, y + Math.cos(lean) * len, z + Math.sin(a) * Math.sin(lean) * len];
    paint(acc, k % 2 ? '#5d5b3b' : '#4f5a33');
    tube(acc, [[x, y - 0.1, z], [(x + tip[0]) / 2, (y + tip[1]) / 2, (z + tip[2]) / 2], tip], [0.06 * s, 0.045 * s, 0.015], 3, false);
    if (hash1(seed, k, 3) < 0.5) { paint(acc, '#d8402a'); box(acc, tip[0], tip[1] - 0.05, tip[2], 0.1, 0.25, 0.1, 0); }
  }
}

/** A barrel cactus with a crown of yellow flowers. */
export function barrel(acc, x, y, z, s) {
  paint(acc, '#5f7034');
  cylinder(acc, x, y - 0.1, z, 0.34 * s, 0.7 * s, 9, { r2: 0.3 * s });
  paint(acc, '#c8a03a');
  cylinder(acc, x, y + 0.6 * s, z, 0.3 * s, 0.12 * s, 9, { r2: 0.08 * s, top: true });
}

/** A prickly pear: flat oval pads stacked at angles. */
export function pricklyPear(acc, x, y, z, s, seed) {
  const pads = 4 + Math.floor(hash1(seed, 1) * 4);
  for (let k = 0; k < pads; k++) {
    const a = hash1(seed, k) * TAU, h = (k < 2 ? 0.35 : 0.8 + hash1(seed, k, 2) * 0.5) * s;
    const ox = Math.cos(a) * 0.3 * s * (k > 0), oz = Math.sin(a) * 0.3 * s * (k > 0);
    paint(acc, k % 2 ? '#6a8040' : '#5d7438');
    blob(acc, x + ox, y + h, z + oz, 0.38 * s, 0.42 * s, 0.08 * s, a, seed + k, 0.12, 1);
    if (hash1(seed, k, 3) < 0.4) { paint(acc, '#b8284a'); box(acc, x + ox, y + h + 0.38 * s, z + oz, 0.08, 0.1, 0.08, 0); }
  }
}

/** A juniper: a twisted trunk and a dense, dark, lumpy crown. */
export function juniper(acc, x, y, z, s, seed) {
  paint(acc, '#5a4434');
  const lean = [(hash1(seed, 1) - 0.5) * 1.2 * s, (hash1(seed, 2) - 0.5) * 1.2 * s];
  tube(acc, [[x, y - 0.2, z], [x + lean[0] * 0.3, y + 1.0 * s, z + lean[1] * 0.3], [x + lean[0], y + 2.0 * s, z + lean[1]]], [0.22 * s, 0.17 * s, 0.12 * s], 5, false);
  const n = 2 + Math.floor(hash1(seed, 3) * 3);
  for (let k = 0; k < n; k++) {
    const a = hash1(seed, k, 4) * TAU, r = (0.6 + hash1(seed, k, 5) * 0.7) * s;
    paintMix(acc, '#3b5230', '#4a6238', hash1(seed, k, 6));
    blob(acc, x + lean[0] + Math.cos(a) * r * 0.8, y + (2.0 + hash1(seed, k, 7) * 1.2) * s, z + lean[1] + Math.sin(a) * r * 0.8, r * 1.3, r * 1.05, r * 1.25, a, seed * 7 + k, 0.3, 0.8);
  }
}

/** A dead tree: a grey trunk, bare forking branches. */
export function deadTree(acc, x, y, z, s, seed) {
  const branch = (p, dir, len, r, depth, k) => {
    const a = hash1(seed, k, 1) * TAU, sp = 0.5 + hash1(seed, k, 2) * 0.5;
    let dx = dir[0] + Math.cos(a) * sp, dy = dir[1] + 0.5, dz = dir[2] + Math.sin(a) * sp;
    const l = Math.hypot(dx, dy, dz);
    dx /= l; dy /= l; dz /= l;
    const end = [p[0] + dx * len, p[1] + dy * len, p[2] + dz * len];
    paintMix(acc, '#8a8278', '#a49c90', hash1(seed, k, 3));
    tube(acc, [p, end], [r, r * 0.55], 4, false);
    if (depth > 0) for (let q = 0; q < 2; q++) branch(end, [dx, dy, dz], len * 0.66, r * 0.6, depth - 1, k * 3 + q + 1);
  };
  const h = (2.5 + hash1(seed, 5) * 2) * s;
  paint(acc, '#7a7268');
  const top = [x + (hash1(seed, 6) - 0.5) * 0.8, y + h, z + (hash1(seed, 7) - 0.5) * 0.8];
  tube(acc, [[x, y - 0.3, z], top], [0.3 * s, 0.18 * s], 5, false);
  for (let k = 0; k < 3; k++) branch(top, [0, 0.6, 0], (1.5 + hash1(seed, 8 + k)) * s, 0.15 * s, 2, k + 1);
}

/** A shrub: crossed cut-out quads of foliage cell k (0 creosote, 1 bursage, 2 grass, 3 sage), w wide, h tall. */
export function shrub(acc, x, y, z, w, h, k, ry, tint = '#ffffff', planes = 3) {
  paint(acc, tint);
  const u0 = (k % 2) * 0.5, v1 = 1 - Math.floor(k / 2) * 0.5, v0 = v1 - 0.5;
  const uv = [u0 + 0.004, v0 + 0.004, u0 + 0.496, v1 - 0.004];
  for (let p = 0; p < planes; p++) {
    const a = ry + (p / planes) * Math.PI;
    const dx = Math.cos(a) * w / 2, dz = Math.sin(a) * w / 2;
    acc.quadP([x - dx, y - 0.08, z - dz], [x + dx, y - 0.08, z + dz], [x + dx, y + h, z + dz], [x - dx, y + h, z - dz], uv);
  }
}

/** A tumbleweed as line segments (local, radius ≈ 0.5): [x, y, z, x, y, z, …]. */
export function tumbleShape(seed, n = 60) {
  const pts = [];
  for (let j = 0; j < n; j++) {
    const u = hash1(seed, j) * 2 - 1, a = hash1(seed, j, 1) * TAU, r = 0.3 + hash1(seed, j, 2) * 0.22;
    pts.push([Math.sqrt(1 - u * u) * Math.cos(a) * r, u * r * 0.85, Math.sqrt(1 - u * u) * Math.sin(a) * r]);
  }
  const seg = [];
  for (let j = 0; j < n; j++) {
    const near = pts.map((q, m) => [(q[0] - pts[j][0]) ** 2 + (q[1] - pts[j][1]) ** 2 + (q[2] - pts[j][2]) ** 2, m]).sort((a, b) => a[0] - b[0]);
    for (const m of [near[1 + Math.floor(hash1(seed, j, 3) * 3)][1], near[2 + Math.floor(hash1(seed, j, 4) * 4)][1]]) seg.push(...pts[j], ...pts[m]);
  }
  return seg;
}
