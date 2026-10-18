// PORT HALCYON — desert kit rock: boulders, granite boulder piles (the High
// Desert), sandstone hoodoos (pinched drums under a capstone), balanced
// rocks, strata blocks (canyon walls, mesa cliffs: their bands line up with
// the world's height so a wall of blocks reads as one layered cliff).
import { box } from '../builder.js';
import { paint, paintMix, blob, drum, hash1, TAU } from './kit.js';

/** Sandstone tones by band (deep red at the foot, orange, cream caprock). */
export const SAND = ['#a8492c', '#b8583a', '#c46a40', '#9a3e26', '#d08850', '#c9a074', '#b46448'];
export const GRANITE = ['#c8b090', '#b89e80', '#d6c0a0', '#a8927a'];

/** A boulder (sunk a little into the ground). */
export function boulder(acc, x, y, z, s, seed, color = '#8a7a68', flatten = 0.75) {
  paintMix(acc, color, '#ffffff', hash1(seed, 9) * 0.12);
  blob(acc, x, y + s * 0.25, z, s * (0.9 + hash1(seed, 1) * 0.5), s * flatten, s * (0.9 + hash1(seed, 2) * 0.4), hash1(seed, 3) * TAU, seed, 0.32, 0.55);
}

/**
 * A pile of rounded granite boulders (the High Desert's monzonite heaps): a
 * big one, smaller ones round its foot, one or two perched on top. y is the
 * lowest ground under it (so no side of it floats on a slope).
 */
export function boulderPile(acc, x, y, z, s, seed) {
  const n = 3 + Math.floor(hash1(seed, 1) * 4);
  const r0 = s * (1.0 + hash1(seed, 2) * 0.4);
  const c0 = y + r0 * 0.42;
  paint(acc, GRANITE[Math.floor(hash1(seed, 3) * GRANITE.length)]);
  blob(acc, x, c0, z, r0, r0 * 0.8, r0 * 0.9, hash1(seed, 4) * TAU, seed, 0.14, 0.6);
  const top = c0 + r0 * 0.8 * 0.8;
  for (let k = 1; k < n; k++) {
    const r = s * (0.4 + hash1(seed, k, 2) * 0.45);
    const a = hash1(seed, k, 3) * TAU;
    let px, pz, cy;
    if (k === n - 1 && hash1(seed, k, 9) < 0.7) {
      // perched on the big one
      px = x + Math.cos(a) * r0 * 0.25; pz = z + Math.sin(a) * r0 * 0.25; cy = top + r * 0.3;
    } else {
      const d = r0 * 0.85 + r * 0.5;
      px = x + Math.cos(a) * d; pz = z + Math.sin(a) * d; cy = y + r * 0.38;
    }
    paint(acc, GRANITE[Math.floor(hash1(seed, k, 5) * GRANITE.length)], 0.92 + hash1(seed, k, 6) * 0.16);
    blob(acc, px, cy, pz, r, r * 0.8, r * (0.85 + hash1(seed, k, 7) * 0.3), hash1(seed, k, 8) * TAU, seed * 13 + k, 0.14, 0.6);
  }
  return top + s * 0.6 - y;
}

/**
 * A hoodoo: courses of soft rock pinched between harder bands, narrowing up
 * to a capstone. acc: MAT.strata. h tall, r its base radius.
 */
export function hoodoo(acc, x, y, z, h, r, seed) {
  let yy = y - 1.2, rr = r * 1.25;
  const courses = 3 + Math.floor(hash1(seed, 1) * 3);
  const lean = [(hash1(seed, 2) - 0.5) * 0.08 * h, (hash1(seed, 3) - 0.5) * 0.08 * h];
  for (let k = 0; k < courses; k++) {
    const ch = (h - 1.5) / courses * (0.8 + hash1(seed, k, 4) * 0.4) + (k === 0 ? 1.2 : 0);
    const pinch = k % 2 ? 0.62 : 0.85;
    const r1 = rr * pinch * (k === courses - 1 ? 0.7 : 1);
    const t = k / courses;
    paint(acc, SAND[(Math.floor(hash1(seed, 5) * 3) + k) % SAND.length], 0.9 + hash1(seed, k, 6) * 0.2);
    drum(acc, x + lean[0] * t, yy, z + lean[1] * t, rr, r1, ch, 7, seed * 11 + k, 0.2, { u: 8, v: 16, v0: 0, top: false, lean: [lean[0] / courses, lean[1] / courses] });
    yy += ch;
    rr = r1 * (k % 2 ? 1.25 : 0.95);
  }
  // the capstone: harder, darker, wider than what holds it up
  const capR = rr * (1.5 + hash1(seed, 7) * 0.5);
  paint(acc, '#7a3420', 0.95);
  drum(acc, x + lean[0], yy, z + lean[1], capR, capR * 0.85, Math.max(1, h * 0.09), 7, seed * 17, 0.25, { u: 8, v: 16, v0: 0 });
  return yy + h * 0.09;
}

/** A balanced rock: a thin pedestal, a big boulder perched on it. acc: MAT.strata for the pedestal, rock for the boulder. */
export function balancedRock(accS, accR, x, y, z, s, seed) {
  paint(accS, SAND[1]);
  drum(accS, x, y - 1, z, 2.2 * s, 0.9 * s, 5.5 * s + 1, 7, seed, 0.2, { u: 8, v: 16, v0: 0 });
  paint(accR, '#9a4a2c');
  blob(accR, x + 0.4 * s, y + 4.5 * s + 2.4 * s, z, 3.3 * s, 2.5 * s, 2.8 * s, hash1(seed, 3) * TAU, seed, 0.22, 0.8);
  return y + 4.5 * s + 4.9 * s;
}

/**
 * A strata block: a chunky slab of layered rock (w along the wall, h tall,
 * d deep into it), turned ry; its bands follow the world height (v0) so
 * neighbouring blocks line up. tone: index into SAND.
 */
export function strataBlock(acc, x, y0, z, w, h, d, ry, tone, k = 1) {
  paint(acc, SAND[tone % SAND.length], k);
  box(acc, x, y0, z, w, h, d, ry, { u: 16, v: 16, v0: y0 / 16, topU: 16 });
}
