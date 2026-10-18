// PORT HALCYON — desert kit props: telephone poles and their wires,
// billboards, road signs, delineators, lamp posts, cars (parked, wrecked,
// stacked), oil drums, tyres, crates, fences, picnic tables, fan palms.
// Each takes the Builder (it picks its own materials) and a spot.
import * as THREE from 'three';
import { box, cylinder, cone } from '../builder.js';
import { MAT, paint, obox, panel, tube, hcyl, disc, hash1, TAU, sagWire, rot3 } from './kit.js';
import { uvOf, RS, adRect } from './tex.js';

// ------------------------------------------------------------------ telephone poles

/** Insulator offsets on the crossarms: [along the arm, height]. */
const INS = [[-1.15, 0], [-0.4, 0], [1.15, 0], [-0.62, -1.1], [0.62, -1.1]];

/**
 * A wooden telephone pole at (x, y, z), its crossarm square to ry (the line's
 * direction), h tall, leaning (lx, lz) at the top. Returns the wire points.
 */
export function pole(B, x, y, z, ry, h = 10, lean = [0, 0], near = false) {
  const acc = near ? B.near(MAT.paint(B)) : B.acc(MAT.paint(B));
  paint(acc, '#5e4c3c');
  const top = [x + lean[0], y + h, z + lean[1]];
  tube(acc, [[x, y - 0.6, z], [x + lean[0] * 0.5, y + h * 0.5, z + lean[1] * 0.5], top], [0.17, 0.14, 0.11], 6, true);
  // crossarms (square to the line), braces, insulators
  const c = Math.cos(ry + Math.PI / 2), s = Math.sin(ry + Math.PI / 2);
  paint(acc, '#4f4034');
  box(acc, top[0], top[1] - 1.0, top[2], 2.7, 0.14, 0.14, ry + Math.PI / 2, { top: true });
  box(acc, top[0], top[1] - 2.1, top[2], 1.6, 0.12, 0.12, ry + Math.PI / 2, { top: true });
  for (const k of [-1, 1]) acc.beam(top[0], top[1] - 1.75, top[2], top[0] + c * k * 0.75, top[1] - 0.95, top[2] - s * k * 0.75, 0.06, 0.06);
  const glass = B.near(MAT.paint(B));
  paint(glass, '#6f9f96');
  const pts = [];
  for (const [a, dh] of INS) {
    const px = top[0] + c * a, pz = top[2] - s * a, py = top[1] - 0.86 + dh;
    cylinder(glass, px, py, pz, 0.06, 0.2, 5, { top: true });
    pts.push([px, py + 0.2, pz]);
  }
  // a transformer can on some poles
  if (hash1(Math.round(x), Math.round(z)) < 0.12) {
    paint(acc, '#8a8e90');
    cylinder(acc, top[0] + c * 0.35 + Math.sin(ry) * 0.3, top[1] - 3.6, top[2] - s * 0.35 + Math.cos(ry) * 0.3, 0.32, 1.1, 8, { top: true });
  }
  return pts;
}

/** The wire attach points of a pole (as pole() makes them), without building it. */
export function poleTops(x, y, z, ry, h = 10, lean = [0, 0]) {
  const c = Math.cos(ry + Math.PI / 2), s = Math.sin(ry + Math.PI / 2);
  const tx = x + lean[0], ty = y + h, tz = z + lean[1];
  return INS.map(([a, dh]) => [tx + c * a, ty - 0.86 + dh + 0.2, tz - s * a]);
}

/** Wires between two poles' attach points (pushed into a LineSegments position array). */
export function wires(pos, A, Bp, sagK = 0.022) {
  const span = Math.hypot(Bp[0][0] - A[0][0], Bp[0][2] - A[0][2]);
  for (let w = 0; w < Math.min(A.length, Bp.length); w++) sagWire(pos, A[w], Bp[w], span * sagK * (w > 2 ? 1.3 : 1), 8);
}

// ------------------------------------------------------------------ billboards

/**
 * A roadside billboard: face (ad k of the ADS atlas) w × h on three legs,
 * its base legH up, facing ry; a catwalk and three lamps over the top.
 */
export function billboard(B, x, y, z, ry, k, o = {}) {
  const w = o.w ?? 12, h = o.h ?? 4, legH = o.legH ?? 5.5;
  const c = Math.cos(ry), s = Math.sin(ry);
  const at = (lx, lz) => [x + lx * c + lz * s, z - lx * s + lz * c];
  panel(B.acc(MAT.ads(B)), x, y + legH, z, ry, w, h, uvOf(adRect(k)), 0);
  const fr = B.acc(MAT.paint(B));
  // the back and the frame round the face
  paint(fr, '#4a3d30');
  box(fr, ...xyz(at(0, -0.22), y + legH - 0.15), w + 0.3, h + 0.3, 0.3, ry, { top: true });
  paint(fr, '#3a3028');
  for (const lx of [-w * 0.36, 0, w * 0.36]) {
    const [px, pz] = at(lx, -0.6);
    box(fr, px, y - 0.6, pz, 0.36, legH + h + 0.4, 0.36, ry);
    // diagonal brace
    const [bx, bz] = at(lx, -2.6);
    fr.beam(px, y + legH * 0.6, pz, bx, y - 0.2, bz, 0.14, 0.14);
  }
  // catwalk under the face, its rail
  const [cx, cz] = at(0, 0.45);
  paint(fr, '#55504a');
  box(fr, cx, y + legH - 0.3, cz, w, 0.1, 0.9, ry);
  // lamp arms over the top (lit)
  const lamps = B.near(MAT.neon(B));
  paint(lamps, '#fff2d0');
  for (const lx of [-w * 0.33, 0, w * 0.33]) {
    const [ax, az] = at(lx, 0.1), [hx, hz] = at(lx, 1.3);
    fr.beam(ax, y + legH + h + 0.05, az, hx, y + legH + h + 0.25, hz, 0.07, 0.07);
    box(lamps, hx, y + legH + h + 0.08, hz, 0.5, 0.16, 0.3, ry);
  }
}
const xyz = (p, y) => [p[0], y, p[1]];

// ------------------------------------------------------------------ road signs

/** A road sign (a cell of the ROADSIGNS atlas) on one or two posts, facing ry. */
export function roadSign(B, x, y, z, ry, kind, o = {}) {
  const [rect, size] = RS[kind];
  const w = size[0] * (o.scale || 1), h = size[1] * (o.scale || 1);
  const bottom = o.bottom ?? (w > 2 ? 1.0 : 1.7);
  panel(B.acc(MAT.roadsigns(B)), x, y + bottom, z, ry, w, h, uvOf(rect, 1024, 512));
  const acc = B.near(MAT.paint(B));
  const c = Math.cos(ry), s = Math.sin(ry);
  paint(acc, o.wood ? '#5a4030' : '#7f8286');
  // back of the plate
  box(acc, x - s * 0.04, y + bottom, z - c * 0.04, w, h, 0.05, ry, { top: true });
  const posts = w > 1.7 ? [-w * 0.32, w * 0.32] : [0];
  for (const k of posts) {
    const px = x + c * k - s * 0.09, pz = z - s * k - c * 0.09;
    if (o.wood) box(acc, px, y - 0.4, pz, 0.16, bottom + h * 0.85 + 0.4, 0.16, ry);
    else cylinder(acc, px, y - 0.4, pz, 0.045, bottom + h * 0.9 + 0.4, 5);
  }
}

/** A white roadside delineator post with an amber (or white) reflector. */
export function delineator(B, x, y, z, ry, amber = true) {
  const acc = B.near(MAT.paint(B));
  paint(acc, '#e8e6e0');
  box(acc, x, y - 0.2, z, 0.1, 1.35, 0.06, ry);
  const g = B.near(MAT.glass(B));
  paint(g, amber ? '#ff9a1a' : '#e8f0ff');
  const c = Math.cos(ry), s = Math.sin(ry);
  box(g, x + s * 0.035, y + 0.9, z + c * 0.035, 0.08, 0.16, 0.02, ry);
}

// ------------------------------------------------------------------ lamps

/** A desert lamp post: a steel pole with an arm and a head (the light is P.lamp's). */
export function lampPost(B, x, y, z, hx, hy, hz, o = {}) {
  const acc = B.acc(MAT.paint(B));
  paint(acc, o.wood ? '#5e4c3c' : '#6a6e72');
  cylinder(acc, x, y - 0.3, z, o.wood ? 0.15 : 0.11, hy - y + 0.3, 6, { r2: o.wood ? 0.12 : 0.08 });
  acc.beam(x, hy, z, hx, hy, hz, 0.1, 0.1);
  const g = B.acc(MAT.neon(B));
  paint(g, o.color || '#ffe2b0');
  box(g, hx, hy - 0.22, hz, 0.6, 0.18, 0.34, Math.atan2(hx - x, hz - z));
}

/** A floodlight: a small lamp head pointing (dx, dz), on a short stand. */
export function floodlight(B, x, y, z, ry, color = '#fff4dc', stand = 0.8) {
  const acc = B.near(MAT.paint(B));
  paint(acc, '#3a3c40');
  box(acc, x, y, z, 0.12, stand, 0.12, ry);
  box(acc, x, y + stand, z, 0.6, 0.45, 0.3, ry);
  const g = B.near(MAT.neon(B));
  paint(g, color);
  const c = Math.cos(ry), s = Math.sin(ry);
  box(g, x + s * 0.16, y + stand + 0.05, z + c * 0.16, 0.5, 0.35, 0.02, ry);
}

/** A string of bulbs from a to b ([x, y, z]), sagging; bulbs at `every` m. */
export function stringLights(B, a, b, sag = 0.6, every = 1.2, colors = ['#ffcf7a']) {
  const acc = B.near(MAT.neon(B));
  const L = Math.hypot(b[0] - a[0], b[2] - a[2]);
  const n = Math.max(2, Math.round(L / every));
  for (let k = 0; k <= n; k++) {
    const t = k / n;
    paint(acc, colors[k % colors.length]);
    const px = a[0] + (b[0] - a[0]) * t, py = a[1] + (b[1] - a[1]) * t - sag * 4 * t * (1 - t), pz = a[2] + (b[2] - a[2]) * t;
    box(acc, px, py - 0.12, pz, 0.12, 0.14, 0.12, 0);
  }
  return [a, b, sag];
}

// ------------------------------------------------------------------ cars

const CARS = {
  sedan: { len: 4.9, w: 1.9, h: 0.75, cab: 0.48, cabOff: 0.0, roof: 0.62 },
  coupe: { len: 4.6, w: 1.85, h: 0.7, cab: 0.42, cabOff: -0.15, roof: 0.56 },
  wagon: { len: 5.1, w: 1.95, h: 0.78, cab: 0.66, cabOff: -0.1, roof: 0.64 },
  pickup: { len: 5.3, w: 1.95, h: 0.85, cab: 0.3, cabOff: 0.12, roof: 0.72, bed: true },
  van: { len: 4.8, w: 1.95, h: 1.7, cab: 0, cabOff: 0, roof: 0 },
};

/**
 * A car at (x, y, z) heading ry (its nose toward (sin ry, cos ry)).
 * o: { kind, color, wreck (0..1: rust, no glass, lost wheels), rx, rz (tilt),
 * crushed (flatten), fins (50s tail fins), near }.
 */
export function car(B, x, y, z, ry, o = {}) {
  const K = CARS[o.kind || 'sedan'];
  const near = o.near !== false;
  const body = near ? B.near(MAT.paint(B)) : B.acc(MAT.paint(B));
  const chrome = near ? B.near(MAT.metal(B)) : B.acc(MAT.metal(B));
  const wreck = o.wreck || 0;
  const crush = o.crushed ? 0.55 : 1;
  const rx = o.rx || 0, rz = o.rz || 0;
  const seed = Math.round(x * 7 + z * 13);
  const lost = wreck > 0.5 && hash1(seed, 1) < 0.6;
  const lift = lost ? 0.05 : 0.32;
  // everything in the car's own frame (its length along local z, the way it
  // heads), turned and tilted together as one rigid body
  const M = rot3(ry, rx, rz);
  const P = (lx, ly, lz) => [x + M[0] * lx + M[3] * ly + M[6] * lz, y + M[1] * lx + M[4] * ly + M[7] * lz, z + M[2] * lx + M[5] * ly + M[8] * lz];
  const ob = (acc, lx, ly, lz, w, h, d) => {
    const p = P(lx, ly * crush + lift, lz);
    obox(acc, p[0], p[1], p[2], w, h * crush, d, ry, rx, rz);
  };
  const col = o.color || '#8a2a20';
  paint(body, col, wreck > 0 ? 0.75 : 1);
  if (K.cab === 0) {
    // a van: one tall box, a windscreen band
    ob(body, 0, 0, 0, K.w, K.h, K.len);
    paint(body, wreck > 0.4 ? '#141414' : '#22303a');
    ob(body, 0, K.h * 0.55, K.len / 2 - 0.02, K.w - 0.1, K.h * 0.3, 0.06);
  } else {
    ob(body, 0, 0, 0, K.w, K.h, K.len);
    // the cabin (glass), its roof
    const cl = K.len * (K.bed ? 0.3 : K.cab);
    paint(body, wreck > 0.4 ? '#141414' : '#26323c');
    ob(body, 0, K.h, K.cabOff * K.len, K.w - 0.14, K.roof * 0.7, cl);
    paint(body, col, wreck > 0 ? 0.7 : 0.95);
    ob(body, 0, K.h + K.roof * 0.7, K.cabOff * K.len, K.w - 0.18, K.roof * 0.3, cl * 0.92);
    if (K.bed) {
      // the bed's sides
      paint(body, col, 0.8);
      ob(body, K.w / 2 - 0.06, K.h, -K.len * 0.25, 0.1, 0.45, K.len * 0.45);
      ob(body, -K.w / 2 + 0.06, K.h, -K.len * 0.25, 0.1, 0.45, K.len * 0.45);
      ob(body, 0, K.h, -K.len / 2 + 0.06, K.w, 0.45, 0.1);
    }
    if (o.fins) {
      paint(body, col, 0.95);
      for (const k of [-1, 1]) ob(body, k * (K.w / 2 - 0.12), K.h, -K.len / 2 + 0.5, 0.12, 0.32, 1.0);
    }
  }
  // bumpers (chrome, rusted on wrecks), lamps
  paint(chrome, wreck > 0.3 ? '#6a4a34' : '#d8dcdf');
  ob(chrome, 0, 0.12, K.len / 2 + 0.05, K.w + 0.06, 0.2, 0.14);
  ob(chrome, 0, 0.12, -K.len / 2 - 0.05, K.w + 0.06, 0.2, 0.14);
  if (!wreck) {
    const g = B.near(MAT.glass(B));
    paint(g, '#fff6dc');
    for (const k of [-1, 1]) ob(g, k * (K.w / 2 - 0.3), K.h * 0.55, K.len / 2 + 0.01, 0.3, 0.16, 0.04);
    paint(g, '#c81818');
    for (const k of [-1, 1]) ob(g, k * (K.w / 2 - 0.25), K.h * 0.55, -K.len / 2 - 0.01, 0.3, 0.16, 0.04);
  }
  // wheels
  if (!lost) {
    paint(body, '#141414');
    for (const lz of [K.len * 0.32, -K.len * 0.32]) {
      for (const k of [-1, 1]) {
        if (wreck > 0.3 && hash1(seed, lz > 0 ? 2 : 3, k) < 0.3) continue;
        const p = P(k * (K.w / 2 - 0.12), 0.34, lz);
        hcyl(body, p[0], p[1], p[2], 0.34, 0.26, ry + Math.PI / 2, 8, true);
      }
    }
  }
}

/** A stack of wrecks (n high, each a little askew), crushed flat. */
export function wreckStack(B, x, y, z, ry, n, seed, colors) {
  let h = y;
  for (let k = 0; k < n; k++) {
    const r = hash1(seed, k);
    car(B, x + (r - 0.5) * 0.5, h, z + (hash1(seed, k, 1) - 0.5) * 0.5, ry + (r - 0.5) * 0.4, {
      kind: r < 0.6 ? 'sedan' : r < 0.8 ? 'wagon' : 'coupe', color: colors[Math.floor(hash1(seed, k, 2) * colors.length)],
      wreck: 1, crushed: true, near: false, rz: (hash1(seed, k, 3) - 0.5) * 0.1,
    });
    h += 0.75;
  }
  return h;
}

// ------------------------------------------------------------------ clutter

/** An oil drum (upright or lying). */
export function drumBarrel(acc, x, y, z, color, lying = false, ry = 0) {
  paint(acc, color);
  if (lying) hcyl(acc, x, y + 0.29, z, 0.29, 0.88, ry, 8, true);
  else cylinder(acc, x, y, z, 0.29, 0.88, 8, { top: true });
}

/** A pile of tyres (k high). */
export function tyres(acc, x, y, z, k = 4) {
  paint(acc, '#161616');
  for (let i = 0; i < k; i++) {
    cylinder(acc, x + (hash1(i, Math.round(x)) - 0.5) * 0.12, y + i * 0.26, z + (hash1(i, Math.round(z)) - 0.5) * 0.12, 0.4, 0.25, 9, { top: false });
  }
  paint(acc, '#050505');
  disc(acc, x, y + k * 0.26 - 0.01, z, 0.24, 8, true);
}

/** A wooden crate / pallet stack. */
export function crate(acc, x, y, z, s = 1, ry = 0, color = '#8a6a48') {
  paint(acc, color);
  box(acc, x, y, z, 1.1 * s, 0.9 * s, 0.9 * s, ry);
}

/** A picnic table (top + benches). */
export function picnic(acc, x, y, z, ry) {
  paint(acc, '#7a5a3a');
  box(acc, x, y + 0.72, z, 1.9, 0.07, 0.8, ry);
  const c = Math.cos(ry), s = Math.sin(ry);
  for (const k of [-0.62, 0.62]) box(acc, x + s * k, y + 0.42, z + c * k, 1.9, 0.06, 0.28, ry);
  for (const k of [-0.75, 0.75]) box(acc, x + c * k, y, z - s * k, 0.08, 0.72, 1.5, ry);
}

/** A run of post-and-wire fence (posts in acc, three wires as lines into pos). */
export function fenceRun(acc, pos, pts, gy, h = 1.2, every = 4, color = '#6b5a48') {
  paint(acc, color);
  let prev = null;
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, az] = pts[i], [bx, bz] = pts[i + 1];
    const L = Math.hypot(bx - ax, bz - az);
    const n = Math.max(1, Math.round(L / every));
    for (let k = 0; k <= n; k++) {
      if (i > 0 && k === 0) continue;
      const t = k / n;
      const px = ax + (bx - ax) * t, pz = az + (bz - az) * t;
      const y = gy(px, pz);
      box(acc, px, y - 0.3, pz, 0.09, h + 0.3, 0.09, Math.atan2(bx - ax, bz - az));
      if (prev) for (const hh of [0.35, 0.7, 1.05]) pos.push(prev[0], prev[1] + hh * h / 1.2, prev[2], px, y + hh * h / 1.2, pz);
      prev = [px, y, pz];
    }
  }
}

/** A fan palm (a shaggy trunk, a ball of fronds). */
export function fanPalm(B, x, y, z, h, seed) {
  const acc = B.acc(MAT.plant(B));
  paint(acc, '#7a6650');
  const lean = [(hash1(seed, 1) - 0.5) * 1.2, (hash1(seed, 2) - 0.5) * 1.2];
  const top = [x + lean[0], y + h, z + lean[1]];
  tube(acc, [[x, y - 0.3, z], [x + lean[0] * 0.4, y + h * 0.5, z + lean[1] * 0.4], top], [0.34, 0.27, 0.24], 6, false);
  paint(acc, '#6b5a40');
  cylinder(acc, top[0], top[1] - 1.6, top[2], 0.32, 1.6, 6, { r2: 0.7 });
  for (let k = 0; k < 14; k++) {
    const a = (k / 14) * TAU + hash1(seed, k) * 0.4, droop = 0.15 + hash1(seed, k, 1) * 0.5;
    const len = 2.6 + hash1(seed, k, 2) * 0.8;
    const ex = top[0] + Math.cos(a) * len * Math.cos(droop), ey = top[1] - Math.sin(droop) * len * 0.8, ez = top[2] + Math.sin(a) * len * Math.cos(droop);
    paint(acc, k % 2 ? '#4f6a34' : '#5c7a3c');
    // a frond: a flat fan blade
    const mx = (top[0] + ex) / 2, mz = (top[2] + ez) / 2, my = (top[1] + ey) / 2 + 0.25;
    const px = -Math.sin(a) * 0.55, pz = Math.cos(a) * 0.55;
    acc.quadP([top[0], top[1], top[2]], [mx - px, my, mz - pz], [ex, ey, ez], [mx + px, my, mz + pz]);
    acc.quadP([top[0], top[1] - 0.02, top[2]], [mx + px, my - 0.02, mz + pz], [ex, ey - 0.02, ez], [mx - px, my - 0.02, mz - pz]);
  }
  return top;
}

/** A lattice mast (radio, floodlights) from y0 up h, w wide at the base. */
export function mast(acc, x, y0, z, h, w, taper = 0.4) {
  const w1 = w * taper;
  const C = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
  for (const [i, j] of C) acc.beam(x + i * w / 2, y0, z + j * w / 2, x + i * w1 / 2, y0 + h, z + j * w1 / 2, 0.12, 0.12);
  const n = Math.max(2, Math.round(h / (w * 1.1)));
  for (let k = 0; k < n; k++) {
    const t0 = k / n, t1 = (k + 1) / n;
    const wa = w + (w1 - w) * t0, wb = w + (w1 - w) * t1;
    for (let e = 0; e < 4; e++) {
      const [i0, j0] = C[e], [i1, j1] = C[(e + 1) % 4];
      const A = [x + (k % 2 ? i0 : i1) * wa / 2, y0 + h * t0, z + (k % 2 ? j0 : j1) * wa / 2];
      const Bp = [x + (k % 2 ? i1 : i0) * wb / 2, y0 + h * t1, z + (k % 2 ? j1 : j0) * wb / 2];
      acc.beam(A[0], A[1], A[2], Bp[0], Bp[1], Bp[2], 0.07, 0.07);
    }
  }
}

/** A red aircraft-warning light (blinking) at (x, y, z). */
export function beacon(B, x, y, z, phase = 0, r = 0.35) {
  const g = B.acc(MAT.lights(B));
  paint(g, '#ff2a1a');
  const b0 = g.count;
  box(g, x, y, z, r, r, r, 0);
  // uv.x = phase, uv.y = 0.6 Hz blink
  for (let i = b0; i < g.count; i++) { g.uv[i * 2] = phase; g.uv[i * 2 + 1] = 0.6; }
}

/**
 * Tumbleweeds blowing through: n weeds rolling with the wind (dx, dz) along a
 * `span` m run centred on (x, z), spread `spread` m across it, bouncing over
 * the ground, wrapping round to start again. One LineSegments in B.group,
 * moved by B.anim while the camera's within 450 m.
 */
export function tumbleRun(B, x, z, dx, dz, span, spread, n, seed, shapeOf) {
  const l = Math.hypot(dx, dz) || 1;
  dx /= l; dz /= l;
  const shapes = [];
  for (let k = 0; k < n; k++) shapes.push(shapeOf(seed * 13 + k, 46));
  const pos = new Float32Array(shapes.reduce((a, sh) => a + sh.length, 0));
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const lines = new THREE.LineSegments(g, MAT.tumble(B));
  lines.frustumCulled = false;
  B.group.add(lines);
  const st = shapes.map((_, k) => ({ u: (k / n) * span, v: (hash1(seed, k) - 0.5) * spread, sp: 3.2 + hash1(seed, k, 1) * 3.2, size: 0.75 + hash1(seed, k, 2) * 0.7, ph: hash1(seed, k, 3) * 6, q: new THREE.Quaternion() }));
  const ax = new THREE.Vector3(dz, 0, -dx), dq = new THREE.Quaternion(), v = new THREE.Vector3();
  B.anim((t, dt, dist) => {
    if (dist > 450) return;
    dt = Math.min(dt, 0.1);
    let o = 0;
    st.forEach((w, k) => {
      const gust = 0.65 + 0.5 * Math.sin(t * 0.37 + k * 1.7) * Math.sin(t * 0.13 + k);
      w.u = (w.u + w.sp * gust * dt) % span;
      const lat = w.v + Math.sin(w.u * 0.05 + k) * 2;
      const px = x + dx * (w.u - span / 2) - dz * lat, pz = z + dz * (w.u - span / 2) + dx * lat;
      w.ph += dt * w.sp * gust * 1.4;
      const py = B.groundY(px, pz) + 0.42 * w.size + Math.abs(Math.sin(w.ph)) * 0.55;
      dq.setFromAxisAngle(ax, -dt * w.sp * gust / (0.45 * w.size));
      w.q.premultiply(dq);
      const sh = shapes[k];
      for (let j = 0; j < sh.length; j += 3) {
        v.set(sh[j], sh[j + 1], sh[j + 2]).multiplyScalar(w.size).applyQuaternion(w.q);
        pos[o++] = px + v.x; pos[o++] = py + v.y; pos[o++] = pz + v.z;
      }
    });
    g.attributes.position.needsUpdate = true;
  });
}

/** Set the animated-light uv (phase, mode) of everything added to acc since vertex b0. */
export function animUV(acc, b0, phase, mode) {
  for (let i = b0; i < acc.count; i++) { acc.uv[i * 2] = phase; acc.uv[i * 2 + 1] = mode; }
}

export { cone };
