// EASTSIDE — the plains north of the freeway: a loose grid of fields on the
// section lines (wheat, corn, beans, ploughed ground, hay stubble with its
// round bales), windbreaks of poplars and cedars, dirt farm tracks, and a
// handful of farmsteads: a white farmhouse, the red barn and its silo,
// grain bins, a machine shed, a windmill, and the yard light you see from
// the freeway at night. The grid is fixed (plan and scatter both read it).
import { cylinder, cone } from '../builder.js';
import { CELL } from '../../terrain.js';
import { ROAD, ITEM } from '../occ.js';
import { M, Frame, rgb, boxL, wallQ, slope, glowBox, clipRect } from './kit.js';
import { HM, hh } from './ehouse.js';

const PI = Math.PI;

// ------------------------------------------------------------------ the grid

/** Section lines: fields between them, 7 m in from each. */
export const FX = [960, 1175, 1385, 1600, 1810, 2020, 2230, 2440];
export const FZ = [-1745, -1535, -1325, -1115, -905, -695];
/** The freeway's centreline through the plains (east of the interchange). */
const FWY = [[600, -609], [1150, -600], [1349, -585], [1549, -571], [1748, -552], [1945, -521], [2143, -489], [2200, -480], [2398, -455], [2597, -430], [2795, -406], [2994, -381]];
export function fwyZ(x) {
  if (x <= FWY[0][0]) return FWY[0][1];
  for (let k = 1; k < FWY.length; k++) {
    if (x <= FWY[k][0]) { const [ax, az] = FWY[k - 1], [bx, bz] = FWY[k]; return az + ((bz - az) * (x - ax)) / (bx - ax); }
  }
  return FWY[FWY.length - 1][1];
}
/** The fields stop this far north of the freeway's centreline. */
const SOUTH = 46;
const south = (x) => fwyZ(x) - SOUTH;
/** Out on the farmland (north of the freeway, inside the section grid)? */
export function inPlains(x, z) { return x > FX[0] - 10 && x < FX[FX.length - 1] + 10 && z > FZ[0] - 10 && z < fwyZ(x) - 30; }

/** The farmsteads: grid cells [i, j] (their north part; a field fills the rest). */
const FARMS = [[1, 4], [3, 5], [5, 4], [2, 1], [6, 2]];

/** Dirt tracks (centre lines, 4 m wide): two along section lines, one from each farm to the north-south one. */
export const TRACKS = (() => {
  const t = [[FX[0] + 3, FZ[3] + 3, FX[7] - 3, FZ[3] + 3], [FX[4] + 3, FZ[0] + 3, FX[4] + 3, south(FX[4] + 3) + 8]];
  for (const [i, j] of FARMS) {
    const dx = (FX[i] + FX[i + 1]) / 2 + 4.5;
    t.push([Math.min(dx, FX[4] + 3), FZ[j] + 3, Math.max(dx, FX[4] + 3), FZ[j] + 3]);
  }
  return t;
})();
function nearTrack(x, z, r) {
  for (const [ax, az, bx, bz] of TRACKS) {
    const dx = bx - ax, dz = bz - az, L2 = dx * dx + dz * dz || 1;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / L2));
    if (Math.hypot(x - ax - dx * t, z - az - dz * t) < r) return true;
  }
  return false;
}

/** Windbreak rows on the north / west side of some section lines: [x0, z0, x1, z1, kind]. */
const WINDBREAKS = (() => {
  const w = [];
  for (const [k, kind] of [[1, 'poplar'], [3, 'cedar'], [5, 'poplar'], [7, 'cedar']]) w.push([FX[k] - 3.5, FZ[0] + 2, FX[k] - 3.5, south(FX[k]) + 2, kind]);
  for (const [k, a, b, kind] of [[1, 4, 7, 'poplar'], [2, 0, 4, 'cedar'], [4, 2, 7, 'poplar']]) w.push([FX[a] + 2, FZ[k] - 3.5, FX[b] - 2, FZ[k] - 3.5, kind]);
  return w;
})();

const CROPS = [
  ['wheat', '#d8b45a'], ['wheat', '#e2c470'], ['corn', '#5e8a34'], ['corn', '#7a8a3a'], ['beans', '#7aa044'],
  ['plough', '#6a4a32'], ['plough', '#7a5a3c'], ['stubble', '#c8b070'], ['stubble', '#bca468'], ['alfalfa', '#5a8a3a'],
];
const POPLAR = ['#d8b030', '#c8a028', '#a8a028', '#6a8a2a', '#e0b838'];

// ------------------------------------------------------------------ plan

/**
 * Lay out the plains. h: { house(P, lot), solid(P, o, h, far, lit) } from the
 * pack (a farmhouse is a house on a lot of its own; a barn is a solid).
 */
export function planPlains(P, h) {
  for (let i = 0; i < FX.length - 1; i++) {
    for (let j = 0; j < FZ.length; j++) {
      const x0 = FX[i] + 7, x1 = FX[i + 1] - 7;
      let z0 = FZ[j] + 7;
      const zb = (j + 1 < FZ.length ? FZ[j + 1] : Infinity) - 7;
      if (Math.max(Math.min(zb, south(x0)), Math.min(zb, south(x1))) - z0 < 40) continue;
      const ij = i * 16 + j;
      if (FARMS.some(([a, b]) => a === i && b === j)) {
        farmstead(P, h, x0, x1, z0, ij);
        z0 += 99;
        addField(P, x0, x1, z0, zb, ij);
        continue;
      }
      const r = hh(i, j, 11);
      if (r < 0.1) continue;                                   // pasture: left to the grass
      if (r < 0.3) {                                           // two fields side by side
        const xm = (x0 + x1) / 2 + (hh(i, j, 12) - 0.5) * 60;
        addField(P, x0, xm - 4, z0, zb, ij);
        addField(P, xm + 4, x1, z0, zb, ij + 100);
      } else if (r < 0.5) {                                    // one behind the other
        const zm = (z0 + Math.min(zb, south(x0), south(x1))) / 2 + (hh(i, j, 13) - 0.5) * 50;
        addField(P, x0, x1, z0, zm - 4, ij);
        addField(P, x0, x1, zm + 4, zb, ij + 100);
      } else addField(P, x0, x1, z0, zb, ij);
    }
  }
  // the tracks, in pieces (each built by the cell it starts in)
  for (const [ax, az, bx, bz] of TRACKS) strip(P, ax, az, bx, bz, 2, 'dirt');
}

/** A rectangle of dirt along a line (half-width hw), in pieces of ≤ 120 m. */
function strip(P, ax, az, bx, bz, hw, kind) {
  const len = Math.hypot(bx - ax, bz - az);
  if (len < 1) return;
  const n = Math.max(1, Math.ceil(len / 120));
  const nx = (-(bz - az) / len) * hw, nz = ((bx - ax) / len) * hw;
  for (let k = 0; k < n; k++) {
    const f0 = k / n, f1 = (k + 1) / n;
    const px = ax + (bx - ax) * f0, pz = az + (bz - az) * f0, qx = ax + (bx - ax) * f1, qz = az + (bz - az) * f1;
    P.add({ type: 'lot', kind, x: (px + qx) / 2, z: (pz + qz) / 2, poly: [[px - nx, pz - nz], [qx - nx, qz - nz], [qx + nx, qz + nz], [px + nx, pz + nz]] });
  }
}

/** A field from x0..x1, z0 to zb (or the freeway's margin, each corner its own). */
function addField(P, x0, x1, z0, zb, ij) {
  const zA = Math.min(zb, south(x0)), zB = Math.min(zb, south(x1));
  if (x1 - x0 < 40 || Math.min(zA, zB) - z0 < 30) return;
  const poly = [[x0, z0], [x1, z0], [x1, zB], [x0, zA]];
  for (const [px, pz] of poly) if (!P.inside(px, pz)) return;
  const zm = Math.min(zA, zB);
  if (P.occ.hitRect((x0 + x1) / 2, (z0 + zm) / 2, x1 - x0, zm - z0, 0, ROAD | ITEM, 0)) return;
  P.occ.markPoly(poly, ITEM);
  const [kind, col] = CROPS[Math.floor(hh(ij, 3, 5) * CROPS.length)];
  const rot = hh(ij, 9, 2) < 0.5 ? 0 : PI / 2;
  const it = { bales: null, wrap: hh(ij, 4, 4) < 0.3 };
  if (kind === 'stubble') {
    // round bales left where the baler dropped them, in rows along the crop rows
    it.bales = [];
    const across = rot === 0 ? [x0 + 14, x1 - 14] : [z0 + 14, zm - 14];
    const along = rot === 0 ? [z0 + 12, zm - 12] : [x0 + 12, x1 - 12];
    for (let a = across[0]; a < across[1] && it.bales.length < 26; a += 26 + P.rng() * 8) {
      for (let b = along[0] + P.rng() * 20; b < along[1] && it.bales.length < 26; b += 18 + P.rng() * 22) {
        if (P.rng() < 0.3) continue;
        const x = rot === 0 ? a + (P.rng() - 0.5) * 3 : b, z = rot === 0 ? b : a + (P.rng() - 0.5) * 3;
        const ry = (rot === 0 ? 0 : PI / 2) + (P.rng() - 0.5) * 0.6;
        it.bales.push([+x.toFixed(2), +z.toFixed(2), +ry.toFixed(3)]);
        const y = P.groundY(x, z);
        P.collider({ kind: 'circle', x, z, r: 0.85, y0: y - 1, y1: y + 1.6 });
      }
    }
  }
  // one item per cell it covers (each cell builds its own piece)
  for (let cx = Math.floor(x0 / CELL); cx * CELL < x1; cx++) {
    for (let cz = Math.floor(z0 / CELL); cz * CELL < Math.max(zA, zB); cz++) {
      const piece = clipRect(poly, cx * CELL, cz * CELL, (cx + 1) * CELL, (cz + 1) * CELL);
      if (piece.length < 3) continue;
      let mx = 0, mz = 0;
      for (const [px, pz] of piece) { mx += px; mz += pz; }
      const f = { type: 'field', x: mx / piece.length, z: mz / piece.length, poly: piece, col, rot };
      const mine = (it.bales || []).filter(([bx, bz]) => Math.floor(bx / CELL) === cx && Math.floor(bz / CELL) === cz);
      if (mine.length) { f.bales = mine; f.wrap = it.wrap; }
      P.add(f);
    }
  }
}

/** A convex polygon cut by another convex polygon (Sutherland–Hodgman). */
function clipConvex(subject, clip, ccw) {
  let out = subject;
  for (let e = 0; e < clip.length && out.length >= 3; e++) {
    const a = clip[e], b = clip[(e + 1) % clip.length];
    const side = (p) => ((b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0])) * ccw >= -1e-9;
    const src = out;
    out = [];
    for (let i = 0; i < src.length; i++) {
      const p = src[i], q = src[(i + 1) % src.length], ip = side(p), iq = side(q);
      if (ip) out.push(p);
      if (ip !== iq) {
        const dp = (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]);
        const dq = (b[0] - a[0]) * (q[1] - a[1]) - (b[1] - a[1]) * (q[0] - a[0]);
        const t = dp / (dp - dq);
        out.push([p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t]);
      }
    }
  }
  return out;
}

/** A farmstead across the north of the band x0..x1 from z0 (its front to the south). */
function farmstead(P, h, x0, x1, z0, ij) {
  const cx = (x0 + x1) / 2, cz = z0 + 46;
  const R = (k) => hh(ij, k, 77);
  // the farmhouse, on its lawn, west of the yard
  const L = { x: cx - 55, z: cz + 4, w: 28, d: 40, ry: 0, farm: true };
  if (P.isFree(L.x, L.z, L.w, L.d, 0, { pad: 0 })) { P.claim(L.x, L.z, L.w, L.d, 0); h.house(P, L); }
  // the barn and its silo, the machine shed, the grain bins
  const barn = h.solid(P, { type: 'barn', x: cx + 12, z: cz - 12, w: 16, d: 22, ry: 0 }, 11, '#7a2a1e', 0.05);
  P.collider({ kind: 'circle', x: cx + 24.5, z: cz - 18.6, r: 3.3, y0: barn.y0, y1: barn.y0 + 17 });
  P.far({ shape: 'cyl', x: cx + 24.5, z: cz - 18.6, y: barn.y0, r: 3.2, h: 16, color: '#b8b4aa' });
  h.solid(P, { type: 'mshed', x: cx + 56, z: cz + 16, w: 28, d: 14, ry: 0, col: R(1) < 0.5 ? '#a4a8a8' : '#8a3a2a' }, 7, '#8a8e90', 0.02);
  const bins = [[-12, 0, 4.2, 7], [0, 0, 4.2, 7], [12.5, 0, 4.8, 8.5]];
  const by = P.groundY(cx + 56, cz - 24);
  P.add({ type: 'bins', x: cx + 56, z: cz - 24, ry: 0, bins });
  for (const [lx, lz, r, bh] of bins) {
    P.collider({ kind: 'circle', x: cx + 56 + lx, z: cz - 24 + lz, r: r + 0.1, y0: by - 1, y1: by + bh + 2.5 });
    P.far({ shape: 'cyl', x: cx + 56 + lx, z: cz - 24 + lz, y: by - 0.5, r, h: bh + 1.5, color: '#a8acb0' });
  }
  P.occ.markRect(cx + 56, cz - 24, 40, 12, 0, ITEM);
  // the windmill out by the house; the yard light; a pickup; a stack of bales
  const wx = cx - 90, wz = cz - 30, wy = P.groundY(wx, wz);
  P.add({ type: 'windmill', x: wx, z: wz, ry: 0.4 + R(2) * 1.2 });
  P.collider({ kind: 'box', x: wx, z: wz, hx: 1.8, hz: 1.8, ry: 0, y0: wy - 1, y1: wy + 12 });
  const lx = cx + 24, lz = cz + 8, ly = P.groundY(lx, lz);
  P.add({ type: 'ylight', x: lx, z: lz });
  P.collider({ kind: 'circle', x: lx, z: lz, r: 0.2, y0: ly - 1, y1: ly + 8.5 });
  P.lamp({ x: lx, z: lz + 0.8, hx: lx, hz: lz + 0.8, hy: ly + 8.0, color: '#d4e4ff', radius: 26, intensity: 1.0, halo: 1.8 });
  const px = cx + 36, pz = cz + 21, pry = 0.5 + R(3) * 0.6;
  P.add({ type: 'car', x: px, z: pz, ry: pry, col: R(4) < 0.5 ? '#7a1a14' : '#2a3a5a' });
  P.collider({ kind: 'box', x: px, z: pz, hx: 0.95, hz: 2.4, ry: pry, y0: ly - 1, y1: ly + 2 });
  const sx = cx + 34, sz = cz - 31, sy = P.groundY(sx, sz);
  P.add({ type: 'bstack', x: sx, z: sz, ry: 0, wrap: R(5) < 0.3 });
  P.collider({ kind: 'box', x: sx, z: sz, hx: 3.4, hz: 0.75, ry: 0, y0: sy - 1, y1: sy + 3 });
  // a shelter belt of cedars along the north, shade trees by the house
  for (let tx = cx - 96; tx < cx - 24; tx += 7) {
    const tz = cz - 42 + (P.rng() - 0.5) * 1.5, ty = P.groundY(tx, tz), s = P.range(1.0, 1.35);
    P.add({ type: 'tree', x: tx, z: tz, y: ty, s, col: '#2a4a2a' });
    P.collider({ kind: 'circle', x: tx, z: tz, r: 0.45 * s, y0: ty - 1, y1: ty + 7 });
  }
  for (const [tx, tz, s, col] of [[cx - 76, cz - 4, 1.5, '#c8501e'], [cx - 52, cz - 27, 1.4, '#e0a020'], [cx - 31, cz + 26, 1.3, '#b8281a']]) {
    const ty = P.groundY(tx, tz);
    P.add({ type: 'tree', x: tx, z: tz, y: ty, s, col });
    P.collider({ kind: 'circle', x: tx, z: tz, r: 0.5 * s, y0: ty - 1, y1: ty + 7 });
  }
  // the yard (dirt), and the drive out to the track along the section line
  const yard = [[cx - 36, cz - 38], [cx + 84, cz - 38], [cx + 84, cz + 34], [cx - 36, cz + 34]];
  P.add({ type: 'lot', kind: 'dirt', x: cx + 24, z: cz, poly: yard });
  strip(P, cx + 4.5, cz - 38, cx + 4.5, z0 - 4, 2.2, 'dirt');
}

// ------------------------------------------------------------------ scatter

/** The windbreak trees in a scatter cell (poplars every 6 m, cedars every 5 m; gaps for the tracks). */
export function scatterWindbreaks(S) {
  for (const [ax, az, bx, bz, kind] of WINDBREAKS) {
    if (Math.max(ax, bx) < S.x0 - 4 || Math.min(ax, bx) > S.x1 + 4 || Math.max(az, bz) < S.z0 - 4 || Math.min(az, bz) > S.z1 + 4) continue;
    const len = Math.hypot(bx - ax, bz - az), sp = kind === 'poplar' ? 6 : 5;
    for (let t = 0; t <= len; t += sp) {
      const f = t / len;
      const x = ax + (bx - ax) * f + (hh(t, ax, 1) - 0.5) * 1.4, z = az + (bz - az) * f + (hh(t, az, 2) - 0.5) * 1.4;
      if (x < S.x0 || x >= S.x1 || z < S.z0 || z >= S.z1) continue;
      if (hh(t, ax + az, 3) < 0.06 || nearTrack(x, z, 5.6) || !S.inside(x, z) || !S.free(x, z, 1.2, true)) continue;
      const y = S.groundY(x, z);
      if (kind === 'poplar') {
        const s = 0.85 + hh(t, ax, 5) * 0.35;
        S.add({ type: 'poplar', x, z, y, s, col: POPLAR[Math.floor(hh(t, az, 6) * POPLAR.length)] });
        S.collider({ kind: 'circle', x, z, r: 0.3, y0: y - 1, y1: y + 9 });
      } else {
        const s = 0.95 + hh(t, ax, 5) * 0.4;
        S.add({ type: 'tree', x, z, y, s, col: '#2a4a2a' });
        S.collider({ kind: 'circle', x, z, r: 0.4 * s, y0: y - 1, y1: y + 7 });
      }
    }
  }
}

// ------------------------------------------------------------------ build

/**
 * A smooth-ish crown: a six-sided lathe from a top point through rings
 * [[y, r], …] (top to bottom, every other one turned 30°) to a bottom point.
 * Shared corners: 2 + 6 × rings vertices.
 */
export function lathe(acc, x, z, yTop, rings, yBot, a0 = 0) {
  const c0 = acc.count;
  acc.v(x, yTop, z);
  rings.forEach(([y, r], q) => {
    for (let k = 0; k < 6; k++) { const a = a0 + (k * PI) / 3 + (q % 2 ? PI / 6 : 0); acc.v(x + Math.cos(a) * r, y, z + Math.sin(a) * r); }
  });
  const bot = acc.v(x, yBot, z);
  const R = (q, k) => c0 + 1 + q * 6 + (k % 6);
  for (let k = 0; k < 6; k++) acc.tri(c0, R(0, k + 1), R(0, k));
  for (let q = 0; q < rings.length - 1; q++) {
    for (let k = 0; k < 6; k++) {
      if (q % 2 === 0) {          // the lower ring's corner k sits between the upper's k and k+1
        acc.tri(R(q, k + 1), R(q + 1, k), R(q, k));
        acc.tri(R(q + 1, k + 1), R(q + 1, k), R(q, k + 1));
      } else {                    // the upper ring's corner k sits between the lower's k and k+1
        acc.tri(R(q, k + 1), R(q + 1, k + 1), R(q, k));
        acc.tri(R(q + 1, k + 1), R(q + 1, k), R(q, k));
      }
    }
  }
  const last = rings.length - 1;
  for (let k = 0; k < 6; k++) acc.tri(bot, R(last, k), R(last, k + 1));
}

/** A four-sided tapering trunk (shared corners). */
function trunk(acc, x, y, z, r0, r1, h, a0) {
  const t0 = acc.count;
  for (let k = 0; k < 4; k++) {
    const a = a0 + (k * PI) / 2;
    acc.v(x + Math.cos(a) * r0, y, z + Math.sin(a) * r0, k / 4, 0);
    acc.v(x + Math.cos(a) * r1, y + h, z + Math.sin(a) * r1, k / 4, 1);
  }
  for (let k = 0; k < 4; k++) { const b0 = t0 + k * 2, b1 = t0 + ((k + 1) % 4) * 2; acc.quad(b1, b0, b0 + 1, b1 + 1); }
}

/** A Lombardy poplar: tall and narrow (≈ 28 vertices). */
export function poplar(B, it) {
  const { x, y, z } = it, s = it.s, a0 = (x * 0.37 + z * 0.61) % 6.283;
  trunk(B.acc(M.trunk(B)), x, y - 0.3, z, 0.18 * s, 0.1 * s, 2.6 * s, a0);
  const lf = B.acc(M.leaf(B));
  lf.col = rgb(it.col);
  lathe(lf, x, z, y + 12 * s, [[y + 9.6 * s, 1.0 * s], [y + 6.4 * s, 1.55 * s], [y + 3.4 * s, 1.25 * s]], y + 1.8 * s, a0);
}

/** A field: the ground under it in crop rows (uv turned rot: the rows run along v), tinted it.col. */
export function fieldB(B, it) {
  const acc = B.acc(HM.crops(B));
  acc.col = rgb(it.col);
  latticeDrape(acc, B, it.poly, it.rot);
  if (it.bales) {
    const p = B.acc(M.paint(B));
    p.col = rgb(it.wrap ? '#e8e8e2' : '#c8a860');
    for (const [x, z, ry] of it.bales) bale(p, x, B.groundY(x, z) + 0.78, z, ry);
  }
}
/**
 * A convex polygon laid on the ground on an 8 m lattice (world-aligned, so the
 * pieces of a field in two cells meet vertex for vertex), uv turned rot.
 */
function latticeDrape(acc, B, poly, rot, step = 8, lift = 0.14, uv = 16) {
  const c = Math.cos(rot), s = Math.sin(rot);
  let ax = Infinity, bx = -Infinity, az = Infinity, bz = -Infinity, area = 0;
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i], q = poly[(i + 1) % poly.length];
    ax = Math.min(ax, p[0]); bx = Math.max(bx, p[0]); az = Math.min(az, p[1]); bz = Math.max(bz, p[1]);
    area += p[0] * q[1] - q[0] * p[1];
  }
  const ccw = area > 0 ? 1 : -1;
  const ids = new Map();
  const vid = (x, z) => {
    const k = Math.round(x * 16) * 4194304 + Math.round(z * 16);
    let i = ids.get(k);
    if (i === undefined) { i = acc.v(x, B.groundY(x, z) + lift, z, (x * c + z * s) / uv, (-x * s + z * c) / uv); ids.set(k, i); }
    return i;
  };
  const inside = (x, z) => {
    for (let e = 0; e < poly.length; e++) {
      const a = poly[e], b = poly[(e + 1) % poly.length];
      if (((b[0] - a[0]) * (z - a[1]) - (b[1] - a[1]) * (x - a[0])) * ccw < -1e-9) return false;
    }
    return true;
  };
  for (let gx = Math.floor(ax / step) * step; gx < bx; gx += step) {
    for (let gz = Math.floor(az / step) * step; gz < bz; gz += step) {
      let sq = [[gx, gz], [gx + step, gz], [gx + step, gz + step], [gx, gz + step]];
      if (!(inside(gx, gz) && inside(gx + step, gz) && inside(gx + step, gz + step) && inside(gx, gz + step))) sq = clipConvex(sq, poly, ccw);
      if (sq.length < 3) continue;
      const i0 = vid(sq[0][0], sq[0][1]);
      for (let k = 1; k < sq.length - 1; k++) {
        const a = sq[0], b = sq[k], d = sq[k + 1];
        const ny = (b[1] - a[1]) * (d[0] - a[0]) - (b[0] - a[0]) * (d[1] - a[1]);
        if (Math.abs(ny) < 1e-6) continue;
        const i1 = vid(b[0], b[1]), i2 = vid(d[0], d[1]);
        if (ny > 0) acc.tri(i0, i1, i2); else acc.tri(i0, i2, i1);
      }
    }
  }
}

function fieldDrape(acc, B, poly, rot, lift = 0.12, step = 6, uv = 16) {
  const c = Math.cos(rot), s = Math.sin(rot);
  const verts = new Map();
  const vid = (p) => {
    const k = `${Math.round(p[0] * 20)},${Math.round(p[1] * 20)}`;
    let i = verts.get(k);
    if (i === undefined) {
      i = acc.v(p[0], B.groundY(p[0], p[1]) + lift, p[1], (p[0] * c + p[1] * s) / uv, (-p[0] * s + p[1] * c) / uv);
      verts.set(k, i);
    }
    return i;
  };
  const emit = (a, b, d) => {
    const ny = (b[1] - a[1]) * (d[0] - a[0]) - (b[0] - a[0]) * (d[1] - a[1]);
    if (ny > 0) acc.tri(vid(a), vid(b), vid(d)); else acc.tri(vid(a), vid(d), vid(b));
  };
  const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
  const mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  const split = (a, b, d, depth) => {
    const ab = dist(a, b), bd = dist(b, d), da = dist(d, a), m = Math.max(ab, bd, da);
    if (m <= step || depth > 14) { emit(a, b, d); return; }
    if (m === ab) { const p = mid(a, b); split(a, p, d, depth + 1); split(p, b, d, depth + 1); }
    else if (m === bd) { const p = mid(b, d); split(a, b, p, depth + 1); split(a, p, d, depth + 1); }
    else { const p = mid(d, a); split(a, b, p, depth + 1); split(p, b, d, depth + 1); }
  };
  // a convex polygon: a fan from its first corner
  for (let k = 1; k < poly.length - 1; k++) split(poly[0], poly[k], poly[k + 1], 0);
}

/** A round bale lying on its side: centre (x, y, z), its axis along ry's local z (shared corners). */
function bale(acc, x, y, z, ry, r = 0.78, hl = 0.62) {
  const c = Math.cos(ry), s = Math.sin(ry);
  const P = (lx, ly, lz) => [x + lx * c + lz * s, y + ly, z - lx * s + lz * c];
  const n = 8, b = acc.count;
  for (const lz of [hl, -hl]) {
    acc.v(...P(0, 0, lz));
    for (let k = 0; k < n; k++) { const a = (k / n) * PI * 2; acc.v(...P(Math.cos(a) * r, Math.sin(a) * r, lz)); }
  }
  const Fr = (k) => b + 1 + (k % n), Bk = (k) => b + n + 2 + (k % n);
  for (let k = 0; k < n; k++) {
    acc.tri(b, Fr(k), Fr(k + 1));
    acc.tri(b + n + 1, Bk(k + 1), Bk(k));
    acc.tri(Fr(k), Bk(k), Bk(k + 1));
    acc.tri(Fr(k), Bk(k + 1), Fr(k + 1));
  }
}

/** Bales stacked by the barn: four, three on top. */
export function bstack(B, it) {
  const p = B.acc(M.paint(B));
  p.col = rgb(it.wrap ? '#e8e8e2' : '#c4a45c');
  const F = new Frame(it.x, it.z, it.ry, B.groundY(it.x, it.z));
  for (const lx of [-2.4, -0.8, 0.8, 2.4]) { const q = F.P(lx, 0.78, 0); bale(p, q[0], q[1], q[2], it.ry); }
  for (const lx of [-1.6, 0, 1.6]) { const q = F.P(lx, 0.78 + 1.35, 0); bale(p, q[0], q[1], q[2], it.ry); }
}

/** Grain bins: corrugated steel drums with conical roofs, an auger up to the biggest. */
export function bins(B, it) {
  const y = B.groundY(it.x, it.z) - 0.4;
  const F = new Frame(it.x, it.z, it.ry, y);
  const st = B.acc(M.steel(B));
  let top = null;
  for (const [lx, lz, r, h] of it.bins) {
    const [x, , z] = F.P(lx, 0, lz);
    st.col = rgb('#b8bcc0');
    cylinder(st, x, y, z, r, h, 14);
    st.col = rgb('#a4a8ac');
    cone(st, x, y + h, z, r + 0.2, r * 0.55, 14);
    st.col = rgb('#6a6e72');
    cylinder(st, x, y + h + r * 0.5, z, 0.5, 0.5, 6, { top: true });
    if (!top || h > top[3]) top = [x, z, r, h];
  }
  // the auger: a long pipe leaning up to the tallest bin's top
  const [tx, tz, tr, th] = top;
  const a = F.P(it.bins[0][0] - 9, 0, 6), b = [tx, y + th + tr * 0.45, tz];
  st.col = rgb('#8a8e92');
  st.beam(a[0], y + 0.5, a[2], b[0], b[1], b[2], 0.35, 0.35);
}

/** A machine shed: steel walls, a low gable roof, three open bays on its front. */
export function mshed(B, it) {
  const F = new Frame(it.x, it.z, it.ry, 0);
  const hw = it.w / 2, hd = it.d / 2, top = it.yb + 5.4, rise = 1.5, y0 = it.y0;
  const p = B.acc(M.paint(B));
  p.col = rgb(it.col);
  wallQ(p, F, hw, hd, hw, -hd, y0, top);
  wallQ(p, F, hw, -hd, -hw, -hd, y0, top);
  wallQ(p, F, -hw, -hd, -hw, hd, y0, top);
  // the front: piers between the bays, a band over them
  const bay = (it.w - 4 * 0.8) / 3;
  for (let k = 0; k < 4; k++) { const x = -hw + k * (bay + 0.8); wallQ(p, F, x, hd, x + 0.8, hd, y0, top); }
  wallQ(p, F, -hw, hd, hw, hd, it.yb + 4.6, top);
  for (const sx of [1, -1]) {
    const x = sx * hw, A = F.P(x, top, hd), Ap = F.P(x, top + rise, 0), Bq = F.P(x, top, -hd);
    const ia = p.v(...A), ib = p.v(...Bq), ic = p.v(...Ap);
    if (sx > 0) p.tri(ia, ib, ic); else p.tri(ia, ic, ib);
  }
  // inside the bays: dark
  const d = B.acc(M.dark(B));
  wallQ(d, F, -hw + 0.4, hd - 0.6, hw - 0.4, hd - 0.6, y0, it.yb + 4.6);
  // the roof (and its underside)
  const rf = B.acc(M.steel(B));
  rf.col = rgb('#8a8c8e');
  slope(rf, F, [-hw - 0.4, top, hd + 0.5], [hw + 0.4, top, hd + 0.5], [hw + 0.4, top + rise, 0], [-hw - 0.4, top + rise, 0]);
  slope(rf, F, [hw + 0.4, top, -hd - 0.5], [-hw - 0.4, top, -hd - 0.5], [-hw - 0.4, top + rise, 0], [hw + 0.4, top + rise, 0]);
  rf.col = rgb('#4a4c4e');
  slope(rf, F, [hw + 0.4, top - 0.05, hd + 0.5], [-hw - 0.4, top - 0.05, hd + 0.5], [-hw - 0.4, top + rise - 0.05, 0], [hw + 0.4, top + rise - 0.05, 0]);
}

/** A farm windmill: a steel lattice tower, a wheel of sixteen blades, a tail vane. */
export function windmill(B, it) {
  const y = B.groundY(it.x, it.z);
  const F = new Frame(it.x, it.z, it.ry, y);
  const st = B.acc(M.steel(B));
  st.col = rgb('#7a7e84');
  const H = 11, b = 1.7, t = 0.35;
  const C = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
  for (const [sx, sz] of C) { const a = F.P(sx * b, -0.3, sz * b), c = F.P(sx * t, H, sz * t); st.beam(a[0], a[1], a[2], c[0], c[1], c[2], 0.12, 0.12); }
  for (const hy of [2.6, 5.4, 8.2]) {
    const r = b + ((t - b) * hy) / H;
    for (let e = 0; e < 4; e++) {
      const [ax, az] = C[e], [bx, bz] = C[(e + 1) % 4];
      const p = F.P(ax * r, hy, az * r), q = F.P(bx * r, hy, bz * r);
      st.beam(p[0], p[1], p[2], q[0], q[1], q[2], 0.07, 0.07);
    }
  }
  boxL(st, F, 0, H, 0, 1.0, 0.12, 1.0);
  boxL(st, F, 0, H + 0.12, 0.2, 0.32, 0.5, 1.2);
  // the wheel, facing local +z
  const bl = B.acc(M.paint(B));
  bl.col = rgb('#d0ccc4');
  const cy = H + 0.4, hz = 0.95;
  for (let k = 0; k < 16; k++) {
    const a = (k / 16) * PI * 2, a2 = a + 0.2;
    const p0 = F.P(Math.cos(a) * 0.35, cy + Math.sin(a) * 0.35, hz), p1 = F.P(Math.cos(a) * 1.9, cy + Math.sin(a) * 1.9, hz);
    const p2 = F.P(Math.cos(a2) * 1.9, cy + Math.sin(a2) * 1.9, hz + 0.12), p3 = F.P(Math.cos(a2) * 0.35, cy + Math.sin(a2) * 0.35, hz + 0.12);
    bl.quadP(p0, p1, p2, p3);
    bl.quadP(p3, p2, p1, p0);
  }
  // the tail and its vane
  const tA = F.P(0, cy, 0), tB = F.P(0, cy, -2.4);
  st.beam(tA[0], tA[1], tA[2], tB[0], tB[1], tB[2], 0.08, 0.08);
  const vn = B.acc(M.paint(B));
  vn.col = rgb('#9a2a1e');
  const v0 = F.P(0, cy - 0.5, -1.5), v1 = F.P(0, cy - 0.5, -3.0), v2 = F.P(0, cy + 0.65, -3.0), v3 = F.P(0, cy + 0.65, -1.5);
  vn.quadP(v0, v1, v2, v3);
  vn.quadP(v3, v2, v1, v0);
}

/** The yard light: a wooden pole, an arm, a mercury lamp. */
export function ylight(B, it) {
  const y = B.groundY(it.x, it.z);
  const w = B.acc(M.wood(B));
  w.col = rgb('#6a5a48');
  w.cyl(it.x, y - 0.3, it.z, 0.15, 8.9, 6, 0.12);
  const st = B.acc(M.steel(B));
  st.col = rgb('#5a5c60');
  st.beam(it.x, y + 8.1, it.z, it.x, y + 8.35, it.z + 0.9, 0.08, 0.08);
  glowBox(B, it.x, y + 7.9, it.z + 0.9, 0.42, 0.22, 0.55, 0, '#e0ecff');
}
