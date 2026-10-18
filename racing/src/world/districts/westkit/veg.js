// PORT HALCYON — the west's trees and plants, low-poly and vertex-coloured
// (one foliage material and one bark material per pack, the colour per tree
// in the vertices, so a forest is a couple of draw calls a cell): lake pines,
// the giant redwoods, Italian cypress, olives, field oaks, windbreak
// poplars, bushes, ferns, fallen logs, rocks. Each takes the Accs to draw
// into, a position on the ground (x, y, z), a size and a 0..1 seed.
import { cylinder, cone, sphere } from '../builder.js';
import { lathe, limb, tube } from './geo.js';
import { lin, mixc, scalec } from './util.js';

const C = (hex) => lin(hex);
const vary = (c, t, k = 0.14) => scalec(c, 1 - k + t * k * 2);

/** Two cones base to base: up hUp, down hDown (a clump of foliage, a spinning top). */
export function bicone(acc, x, y, z, r, hUp, hDown, seg = 7) {
  cone(acc, x, y, z, r, hUp, seg);
  const T = [x, y - hDown, z];
  for (let i = 0; i < seg; i++) {
    const a0 = (i / seg) * Math.PI * 2, a1 = ((i + 1) / seg) * Math.PI * 2;
    const A = acc.v(x + Math.cos(a0) * r, y, z + Math.sin(a0) * r, i / seg, 0);
    const B = acc.v(x + Math.cos(a1) * r, y, z + Math.sin(a1) * r, (i + 1) / seg, 0);
    const t = acc.v(T[0], T[1], T[2], (i + 0.5) / seg, 1);
    acc.tri(A, B, t);
  }
}

/** A lake pine: a dark trunk, three or four stacked cones. h ≈ 9–22 m. */
export function pine(trunk, leaf, x, y, z, h, t, o = {}) {
  const base = o.leaf || C('#24402a');
  trunk.col = vary(C(o.trunk || '#3e3229'), t);
  cylinder(trunk, x, y - 0.4, z, 0.12 + h * 0.018, h * 0.42, 6, { r2: 0.08 });
  const tiers = h > 14 ? 4 : 3;
  const r0 = h * (0.26 + t * 0.06);
  for (let k = 0; k < tiers; k++) {
    const f = k / tiers;
    leaf.col = vary(mixc(base, C(o.tip || '#3b5a32'), f * 0.7), (t * 7.3 + k * 0.37) % 1, 0.12);
    const y0 = y + h * (0.16 + f * 0.62);
    cone(leaf, x + (t - 0.5) * 0.3 * k, y0, z + ((t * 3.1) % 1 - 0.5) * 0.3 * k, r0 * (1 - f * 0.62), h * (0.42 - f * 0.08), 7);
  }
  trunk.col = [1, 1, 1]; leaf.col = [1, 1, 1];
}

/**
 * A giant redwood: a flared, fluted trunk (bark material: uv in metres)
 * rising h (55–95 m) with bare branch stubs, then a high ragged crown of
 * dark clumps. r: trunk radius at breast height (1.6–4 m).
 */
export function redwood(bark, leaf, x, y, z, h, r, t, o = {}) {
  bark.col = vary(C(o.bark || '#ffffff'), t, 0.1);
  // the trunk: buttress flare at the foot, a long slow taper
  const prof = [[r * 1.7, -1.2], [r * 1.25, 1.2], [r, 6], [r * 0.8, h * 0.3], [r * 0.52, h * 0.62], [r * 0.24, h * 0.9], [0.05, h]];
  lathe(bark, x, y, z, prof, r > 2.5 ? 9 : 8, { u: 2.4, v: 4 });
  // the crown: clumps from ~45% up, wider low, a narrow spire at the top
  const dark = C(o.leaf || '#1e3a24'), lite = C(o.leaf2 || '#30552e');
  const c0 = h * (0.42 + ((t * 13.7) % 1) * 0.1);
  const n = 6 + Math.floor(t * 3);
  for (let k = 0; k < n; k++) {
    const f = k / n;
    const yy = y + c0 + (h - c0) * f * 0.92;
    const a = k * 2.4 + t * 6.283;
    const rr = (1 - f) * (h * 0.11 + r * 1.6) + 2.2;
    const off = r * (0.6 + (1 - f) * 0.9);
    const px = x + Math.cos(a) * off, pz = z + Math.sin(a) * off;
    leaf.col = vary(mixc(dark, lite, ((t * 5.1 + k * 0.29) % 1) * 0.8), (t + k * 0.17) % 1, 0.1);
    // a drooping, flattened clump (a low cone over a shallow one beneath)
    bicone(leaf, px, yy - rr * 0.35, pz, rr, rr * 0.9, rr * 0.35, 6);
    // bare stubs below the crown
    if (k < 2) {
      bark.col = vary(C('#9a8a80'), t);
      const sa = a + 1.7, sy = y + c0 * (0.55 + k * 0.12);
      tube(bark, [x + Math.cos(sa) * r * 0.7, sy, z + Math.sin(sa) * r * 0.7], [x + Math.cos(sa) * (r + 3.5), sy + 1.4, z + Math.sin(sa) * (r + 3.5)], 0.18, 4, { r2: 0.05 });
      bark.col = vary(C(o.bark || '#ffffff'), t, 0.1);
    }
  }
  leaf.col = mixc(dark, lite, 0.5);
  cone(leaf, x, y + h * 0.86, z, h * 0.05 + 1.5, h * 0.18, 6);
  bark.col = [1, 1, 1]; leaf.col = [1, 1, 1];
}

/** A younger redwood / fir in the understory (h 18–35 m). */
export function fir(bark, leaf, x, y, z, h, t, o = {}) {
  bark.col = vary(C(o.bark || '#ffffff'), t, 0.1);
  lathe(bark, x, y, z, [[h * 0.03 + 0.25, -0.6], [h * 0.025 + 0.2, h * 0.5], [0.05, h * 0.95]], 6, { u: 2.4, v: 4 });
  const base = C(o.leaf || '#22402a');
  const tiers = 4;
  for (let k = 0; k < tiers; k++) {
    const f = k / tiers;
    leaf.col = vary(mixc(base, C('#355a33'), f * 0.6), (t * 3.7 + k * 0.31) % 1, 0.12);
    cone(leaf, x, y + h * (0.3 + f * 0.55), z, h * (0.17 - f * 0.03), h * 0.3, 7);
  }
  bark.col = [1, 1, 1]; leaf.col = [1, 1, 1];
}

/** An Italian cypress: a tall dark spindle (h 9–16 m). */
export function cypress(trunk, leaf, x, y, z, h, t, o = {}) {
  const w = h * (0.075 + t * 0.02);
  trunk.col = C('#4a3a2a');
  cylinder(trunk, x, y - 0.3, z, 0.14, 1.0, 5);
  leaf.col = vary(C(o.leaf || '#22381f'), t, 0.12);
  lathe(leaf, x, y, z, [[0.2, 0.4], [w * 0.8, 1.0], [w, h * 0.22], [w * 0.92, h * 0.5], [w * 0.62, h * 0.75], [w * 0.28, h * 0.92], [0.02, h]], 7, { u: 2 });
  trunk.col = [1, 1, 1]; leaf.col = [1, 1, 1];
}

/** A Lombardy poplar (windbreaks): like a cypress but taller, lighter, looser. */
export function poplar(trunk, leaf, x, y, z, h, t) {
  const w = h * (0.11 + t * 0.03);
  trunk.col = C('#6a5e4e');
  cylinder(trunk, x, y - 0.3, z, 0.22, h * 0.3, 5, { r2: 0.14 });
  leaf.col = vary(C('#4a6a2c'), t, 0.16);
  lathe(leaf, x, y, z, [[0.2, h * 0.12], [w * 0.8, h * 0.2], [w, h * 0.4], [w * 0.85, h * 0.65], [w * 0.45, h * 0.88], [0.05, h]], 7, { u: 2 });
  trunk.col = [1, 1, 1]; leaf.col = [1, 1, 1];
}

/** An olive: a short twisted trunk in two or three limbs, silver-green clouds. */
export function olive(trunk, leaf, x, y, z, s, t) {
  trunk.col = vary(C('#6e6250'), t);
  const n = 2 + Math.floor(t * 2);
  const tops = [];
  for (let k = 0; k < n; k++) {
    const a = t * 6.283 + k * (6.283 / n);
    const lean = 0.6 + ((t * 7 + k) % 1) * 0.7;
    const p0 = [x, y - 0.3, z], p1 = [x + Math.cos(a) * lean * 0.4 * s, y + 1.0 * s, z + Math.sin(a) * lean * 0.4 * s];
    const p2 = [x + Math.cos(a + 0.5) * lean * s, y + 2.0 * s, z + Math.sin(a + 0.5) * lean * s];
    limb(trunk, [p0, p1, p2], 0.26 * s, 0.12 * s, 5);
    tops.push(p2);
  }
  const silver = C('#7d8a62'), grey = C('#9aa48a');
  for (let k = 0; k < tops.length; k++) {
    const p = tops[k];
    leaf.col = vary(mixc(silver, grey, ((t * 3 + k * 0.4) % 1) * 0.6), (t + k * 0.3) % 1, 0.1);
    sphere(leaf, p[0], p[1] + 0.6 * s, p[2], (1.3 + ((t * 5 + k) % 1) * 0.5) * s, 6, { sy: 0.62 });
  }
  leaf.col = vary(silver, t, 0.1);
  sphere(leaf, x, y + 2.8 * s, z, 1.5 * s, 6, { sy: 0.6 });
  trunk.col = [1, 1, 1]; leaf.col = [1, 1, 1];
}

/** A broad field tree (oak / maple / cottonwood): a stout trunk, three to five blobs. */
export function oak(trunk, leaf, x, y, z, s, t, o = {}) {
  trunk.col = vary(C('#4f4032'), t);
  cylinder(trunk, x, y - 0.3, z, 0.34 * s, 3.6 * s, 6, { r2: 0.22 * s });
  const base = C(o.leaf || '#3f5c2a'), alt = C(o.leaf2 || '#56742f');
  const n = 3 + Math.floor(t * 3);
  for (let k = 0; k < n; k++) {
    const a = t * 6.283 + k * 2.1;
    const d = k ? (1.3 + ((t * 9 + k) % 1)) * s : 0;
    leaf.col = vary(mixc(base, alt, ((t * 7 + k * 0.3) % 1) * 0.8), (t + k * 0.21) % 1, 0.12);
    sphere(leaf, x + Math.cos(a) * d, y + (4.6 + (k ? ((t * 3 + k) % 1) * 1.6 - 0.4 : 1)) * s, z + Math.sin(a) * d, (k ? 1.9 : 2.6) * s, 7, { sy: 0.8 });
  }
  trunk.col = [1, 1, 1]; leaf.col = [1, 1, 1];
}

/** A bush (s ≈ 0.6–1.8 m tall). */
export function bush(leaf, x, y, z, s, t, hex = '#3d5a2a') {
  leaf.col = vary(C(hex), t, 0.16);
  sphere(leaf, x, y + s * 0.3, z, s, 6, { sy: 0.7 });
  if (t > 0.5) sphere(leaf, x + s * 0.7, y + s * 0.15, z + s * 0.2, s * 0.7, 5, { sy: 0.7 });
  leaf.col = [1, 1, 1];
}

/**
 * A fern: n fronds arching out from the middle (thin strips: draw it with a
 * double-sided material). s: frond length (0.8–1.8 m).
 */
export function fern(acc, x, y, z, s, t, hex = '#4f7a2e') {
  const n = 6 + Math.floor(t * 4);
  const c0 = C(hex);
  for (let k = 0; k < n; k++) {
    const a = t * 6.283 + (k / n) * 6.283 + ((k * 0.37) % 0.3);
    const ca = Math.cos(a), sa = Math.sin(a);
    const L = s * (0.75 + ((t * 11 + k * 0.53) % 1) * 0.5);
    const w = L * 0.16;
    // two segments: up and out, then out and down
    const p0 = [x, y + 0.05, z], p1 = [x + ca * L * 0.5, y + L * 0.45, z + sa * L * 0.5], p2 = [x + ca * L, y + L * 0.18, z + sa * L];
    const lx = -sa * w, lz = ca * w;
    acc.col = vary(c0, ((t * 5 + k * 0.29) % 1), 0.18);
    const a0 = acc.v(p0[0], p0[1], p0[2], 0.5, 0);
    const b1 = acc.v(p1[0] - lx, p1[1], p1[2] - lz, 0, 0.5), b2 = acc.v(p1[0] + lx, p1[1], p1[2] + lz, 1, 0.5);
    const c2 = acc.v(p2[0], p2[1], p2[2], 0.5, 1);
    acc.tri(a0, b2, b1);
    acc.tri(b1, b2, c2);
  }
  acc.col = [1, 1, 1];
}

/** A fallen log (tube) with a root plate at one end; mossy. */
export function log(bark, moss, x, y, z, L, r, ang, t) {
  const ca = Math.cos(ang), sa = Math.sin(ang);
  const a = [x - ca * L / 2, y + r * 0.6, z - sa * L / 2], b = [x + ca * L / 2, y + r * 0.5, z + sa * L / 2];
  bark.col = vary(C('#8a6a5a'), t);
  tube(bark, a, b, r, 7, { r2: r * 0.75, caps: true, u: 2 });
  if (moss) {
    moss.col = vary(C('#4f6a2a'), t);
    tube(moss, [a[0], a[1] + r * 0.55, a[2]], [b[0], b[1] + r * 0.45, b[2]], r * 0.5, 5, { r2: r * 0.35 });
    moss.col = [1, 1, 1];
  }
  // the root plate: a ragged disc standing up at a
  bark.col = vary(C('#5a4636'), t);
  tube(bark, [a[0] - ca * 0.4, a[1], a[2] - sa * 0.4], [a[0] + ca * 0.3, a[1], a[2] + sa * 0.3], r * 2.6, 7, { caps: true, u: 2 });
  bark.col = [1, 1, 1];
}

/** A boulder (squashed low-poly sphere). */
export function rock(acc, x, y, z, s, t, hex = '#8a8278') {
  acc.col = vary(C(hex), t, 0.12);
  sphere(acc, x, y - s * 0.3, z, s, 6, { sy: 0.62 + t * 0.2 });
  acc.col = [1, 1, 1];
}
