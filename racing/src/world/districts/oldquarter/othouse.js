// PORT HALCYON — OLD TOWN's houses: narrow townhouses and apartment blocks
// on any convex footprint (a lot along the street, a chamfered corner), in
// four characters — stone apartment blocks with iron balconies and zinc
// mansards, pastel plaster houses with louvred shutters, brick houses with
// stepped gables, half-timbered houses round the market — each with its
// shopfronts, café awnings, cornices, dormers and chimney stacks.
// house(K, it) builds one from its plan item; K holds the cell's
// accumulators by material (K.near: the close-up ones). Budget: a few
// hundred vertices a house (a cell holds two hundred of them).
import { makeRng } from '../../../core/util.js';
import { box, gable, hip, cylinder, sphere } from '../builder.js';
import { edgeFace, fquad, fwall, fbox, mansard, pyramid, flat, polyOK } from './geo.js';
import { otwUV, otsUV, OTS } from './ottex.js';
import { metalUV } from './tex.js';

// shop tiles that put out an awning and terrace tables
export const CAFE = new Set([0, 2, 15]);
const AWNING = new Set([0, 1, 2, 3, 5, 7, 13, 14, 15]);
const SHUT = new Set([9, 10, 11]);

const wallAcc = (K, it) => (it.wall === 'brick' ? K.brick : it.wall === 'stone' ? K.stone : K.plaster);
const isGrand = (it) => it.kind === 'haus' || it.kind === 'corner';

/** A projecting band along a face: front, top and underside (no ends). */
export function band(acc, f, a0, a1, y, h, o, d, U = 2.4) {
  acc.quadP(f.P(a0, y, o + d), f.P(a1, y, o + d), f.P(a1, y + h, o + d), f.P(a0, y + h, o + d), [a0 / U, y / U, a1 / U, (y + h) / U]);
  acc.quadP(f.P(a0, y + h, o + d), f.P(a1, y + h, o + d), f.P(a1, y + h, o), f.P(a0, y + h, o), [a0 / U, 0, a1 / U, d / U]);
  acc.quadP(f.P(a0, y, o), f.P(a1, y, o), f.P(a1, y, o + d), f.P(a0, y, o + d), [a0 / U, 0, a1 / U, d / U]);
}

/**
 * One house. it: { poly (ccw), edges ('s' street, 'c' chamfer, 'w' a side
 * with windows, 'b' back, 'p' party), y0, gy, gf, fh, nf, kind, wall, col,
 * trim, roof, roofCol, roofMat, shops, shopK, shut, lit, seed, rect }.
 */
export function house(K, it) {
  const rng = makeRng(it.seed);
  const poly = it.poly, n = poly.length;
  const top = it.gy + it.gf + it.nf * it.fh;           // the eaves
  const W = wallAcc(K, it);
  const stoneBase = isGrand(it) || (it.seed % 5) < 2;
  for (let k = 0; k < n; k++) {
    const f = edgeFace(poly[k], poly[(k + 1) % n]);
    const e = it.edges[k];
    const street = e === 's' || e === 'c';
    W.col = it.col;
    if (street && stoneBase && it.wall !== 'stone') {
      K.stone.col = it.baseCol || [0.92, 0.88, 0.8];
      fwall(K.stone, f, 0, f.len, it.y0, it.gy + it.gf, 0, 2.4);
      fwall(W, f, 0, f.len, it.gy + it.gf, top, 0, 2, 2);
    } else fwall(W, f, 0, f.len, it.y0, top, 0, W === K.stone ? 2.4 : 2);
    if (e === 'p') continue;
    if (street) streetFace(K, it, f, e, top, rng, k);
    else sideFace(K, it, f, top, rng, e === 'w');
  }
  roof(K, it, top, rng);
}

// ------------------------------------------------------------------ faces

function bays(len, want) {
  const nb = Math.max(1, Math.round(len / want));
  return { nb, bw: len / nb };
}

function pickWin(rng, litP, shut) {
  const lit = rng() < litP;
  if (shut === 2 && rng() < 0.3) return lit ? 'c_lit' : 'c_dark';
  if (shut >= 1) return lit ? (rng() < 0.35 ? 's_drape' : 's_lit') : 's_dark';
  if (lit) return ['w_lit', 'w_sheer', 'w_drape', 'w_dim', 'w_sheer', 'w_lit'][Math.floor(rng() * 6)];
  return rng() < 0.55 ? 'w_lace' : 'w_dark';
}

const FLOWERS = [[0.85, 0.12, 0.16], [0.95, 0.4, 0.62], [0.95, 0.85, 0.9], [0.95, 0.55, 0.12], [0.6, 0.2, 0.7]];

function streetFace(K, it, f, e, top, rng, k) {
  const len = f.len;
  const S = K.stone;
  const stoneCol = it.baseCol || [0.92, 0.88, 0.8];
  const grand = isGrand(it);
  const timber = it.kind === 'timber';
  // string course over the shop floor, the cornice under the eaves
  const N = K.near;
  N.stone.col = stoneCol;
  band(N.stone, f, -0.05, len + 0.05, it.gy + it.gf - 0.1, 0.32, 0, 0.14);
  if (it.roof !== 'fgable') {
    band(S, f, -0.2, len + 0.2, top - 0.2, 0.5, 0, 0.42);
    S.col = [stoneCol[0] * 0.8, stoneCol[1] * 0.8, stoneCol[2] * 0.8];
    fquad(S, f, 0, len, top - 0.55, top - 0.2, 0.2, [0, 0, len / 2.4, 0.15]);
  }
  // upper floors: a window to a bay, a sill band per floor
  const want = it.kind === 'brick' ? 2.25 : grand ? 2.75 : 2.5;
  const { nb, bw } = bays(len, e === 'c' ? 3 : want);
  const shut = it.shut || 0;
  const wins = K.win;
  let boxes = it.boxes ? Math.ceil(it.boxes * 4) : 0;
  for (let fl = 1; fl <= it.nf; fl++) {
    const yb = it.gy + it.gf + (fl - 1) * it.fh;
    const noble = grand && fl === 1;
    const wh = Math.min(2.35, it.fh - 0.95) + (noble ? 0.25 : 0);
    const ww = Math.min(bw * 0.55, wh * 0.5);
    const ys = yb + 0.62;
    const balcony = grand && (fl === 2 || fl === it.nf) && it.nf >= 3;
    wins.col = it.trim;
    for (let b = 0; b < nb; b++) {
      const a = (b + 0.5) * bw;
      let t = pickWin(rng, it.lit, bw >= 2.45 ? shut : 0);
      if (balcony && t[0] === 'w') t = rng() < it.lit ? 'w_ballit' : 'w_bal';
      const qw = t[0] === 's' ? ww * 2 : ww;
      fquad(wins, f, a - qw / 2, a + qw / 2, ys, ys + wh, 0.04, otwUV(t));
      if (noble && it.ped) {
        // a pediment over each window of the noble floor
        N.stone.col = stoneCol;
        band(N.stone, f, a - ww / 2 - 0.25, a + ww / 2 + 0.25, ys + wh + 0.04, 0.16, 0, 0.18);
        pediment(N.stone, f, a, ys + wh + 0.2, ww + 0.5, 0.4);
      }
      if (boxes > 0 && !balcony && rng() < 0.5) {
        boxes--;
        N.paint.col = [0.16, 0.2, 0.14];
        band(N.paint, f, a - ww / 2 - 0.05, a + ww / 2 + 0.05, ys - 0.1, 0.24, 0.02, 0.24, 1);
        N.leaf.col = FLOWERS[Math.floor(rng() * FLOWERS.length)];
        band(N.leaf, f, a - ww / 2, a + ww / 2, ys + 0.14, 0.2, 0.04, 0.28, 1);
      }
    }
    if (timber) {
      const P = K.paint;
      P.col = [0.22, 0.14, 0.09];
      band(P, f, 0, len, yb - 0.12, 0.24, 0, 0.06, 1);
      for (let b = 0; b <= nb; b++) {
        const a = Math.min(len - 0.12, Math.max(0.12, b * bw));
        fquad(P, f, a - 0.11, a + 0.11, yb + 0.12, yb + it.fh - 0.12, 0.05, [0, 0, 0.2, 1]);
      }
      for (let b = 0; b < nb; b++) {
        braceQ(N.paint, f, b * bw + 0.15, yb + 0.15, b * bw + bw * 0.3, yb + 0.58, 0.05);
        braceQ(N.paint, f, (b + 1) * bw - 0.15, yb + 0.15, (b + 1) * bw - bw * 0.3, yb + 0.58, 0.05);
      }
    } else if (!balcony) {
      N.stone.col = stoneCol;
      band(N.stone, f, 0, len, ys - 0.14, 0.12, 0, 0.1);
      if (noble && !it.ped) band(N.stone, f, 0, len, ys + wh + 0.05, 0.14, 0, 0.12);
    }
    if (balcony) {
      N.stone.col = stoneCol;
      band(N.stone, f, 0.15, len - 0.15, ys - 0.2, 0.16, 0, 0.78);
      railing(N.metal, f, 0.25, len - 0.25, ys - 0.04, 0.95, 0.76);
    }
  }
  groundFloor(K, it, f, e, rng, k);
}

function pediment(acc, f, a, y, w, rise) {
  const o = 0.18;
  const p0 = f.P(a - w / 2, y, o), p1 = f.P(a + w / 2, y, o), pt = f.P(a, y + rise, o);
  const i0 = acc.v(...p0, 0, 0), i1 = acc.v(...p1, w / 2, 0), i2 = acc.v(...pt, w / 4, rise / 2);
  acc.tri(i0, i1, i2);
  acc.quadP(p0, pt, f.P(a, y + rise, 0), f.P(a - w / 2, y, 0), [0, 0, 1, 0.1]);
  acc.quadP(pt, p1, f.P(a + w / 2, y, 0), f.P(a, y + rise, 0), [0, 0, 1, 0.1]);
}

/** A diagonal timber brace on a face (one-sided). */
function braceQ(acc, f, a0, y0, a1, y1, o) {
  const dx = a1 - a0, dy = y1 - y0, l = Math.hypot(dx, dy) || 1;
  const px = (-dy / l) * 0.09, py = (dx / l) * 0.09;
  if (dx * 1 > 0) acc.quadP(f.P(a0 - px, y0 - py, o), f.P(a1 - px, y1 - py, o), f.P(a1 + px, y1 + py, o), f.P(a0 + px, y0 + py, o));
  else acc.quadP(f.P(a1 + px, y1 + py, o), f.P(a0 + px, y0 + py, o), f.P(a0 - px, y0 - py, o), f.P(a1 - px, y1 - py, o));
}

/** An iron railing along a face (three sides: the front and its two returns). */
export function railing(acc, f, a0, a1, y, h, depth) {
  acc.col = [0.13, 0.13, 0.14];
  acc.quadP(f.P(a0, y, depth), f.P(a1, y, depth), f.P(a1, y + h, depth), f.P(a0, y + h, depth), metalUV(0, a1 - a0, 2));
  const uv2 = metalUV(0, depth, 2);
  acc.quadP(f.P(a0, y, 0.02), f.P(a0, y, depth), f.P(a0, y + h, depth), f.P(a0, y + h, 0.02), uv2);
  acc.quadP(f.P(a1, y, depth), f.P(a1, y, 0.02), f.P(a1, y + h, 0.02), f.P(a1, y + h, depth), uv2);
}

const AWN = [[0.55, 0.08, 0.1], [0.12, 0.3, 0.2], [0.12, 0.16, 0.32], [0.6, 0.12, 0.12], [0.85, 0.75, 0.55], [0.2, 0.2, 0.22], [0.75, 0.32, 0.12]];

function groundFloor(K, it, f, e, rng, k) {
  const len = f.len;
  let units = it.shops && k === (it.shopK || 0) ? it.shops : null;
  if (!units) {
    const nu = Math.max(1, Math.round(len / 4.8));
    units = [];
    for (let u = 0; u < nu; u++) units.push(it.resi ? -1 : rng() < 0.7 ? Math.floor(rng() * OTS.length) : -1);
  }
  const uw = len / units.length;
  const h = Math.min(it.gf - 0.3, 4.4);
  for (let u = 0; u < units.length; u++) {
    const a0 = u * uw + 0.12, a1 = (u + 1) * uw - 0.12;
    const t = units[u];
    if (t < 0) {
      // a residential front: a door and a shuttered window or two
      K.win.col = it.door || [0.25, 0.3, 0.22];
      const am = (a0 + a1) / 2;
      fquad(K.win, f, am - 0.7, am + 0.7, it.gy, it.gy + 2.9, 0.04, otwUV(rng() < it.lit ? 'door_lit' : 'door'));
      K.win.col = it.trim;
      if (a1 - a0 > 3.4) for (const s of [-1, 1]) fquad(K.win, f, am + s * 1.55 - 0.5, am + s * 1.55 + 0.5, it.gy + 0.9, it.gy + 2.9, 0.04, otwUV(rng() < 0.5 ? 'c_dark' : 'w_dark'));
      continue;
    }
    fquad(K.shop, f, a0, a1, it.gy, it.gy + h, 0.03, otsUV(t));
    if (AWNING.has(t) && !SHUT.has(t) && rng() < (CAFE.has(t) ? 0.95 : 0.55)) awning(K, f, a0 + 0.15, a1 - 0.15, it.gy + h - 0.3, CAFE.has(t) ? 2.3 : 1.4, rng);
    if (!SHUT.has(t) && rng() < 0.3) bladeSign(K, f, u % 2 ? a1 - 0.25 : a0 + 0.25, it.gy + it.gf + 0.55, t);
  }
}

/** A fabric awning: sloping out from the wall over a valance; striped for some. */
function awning(K, f, a0, a1, y, depth, rng) {
  const A = K.paint;
  const c1 = AWN[Math.floor(rng() * AWN.length)];
  const striped = rng() < 0.4;
  const c2 = [0.92, 0.9, 0.84];
  const drop = depth * 0.42, val = 0.32;
  const n = striped ? Math.max(3, Math.round((a1 - a0) / 0.6)) : 1;
  for (let q = 0; q < n; q++) {
    const s0 = a0 + (a1 - a0) * q / n, s1 = a0 + (a1 - a0) * (q + 1) / n;
    A.col = striped && q % 2 ? c2 : c1;
    A.quadP(f.P(s0, y - drop, depth), f.P(s1, y - drop, depth), f.P(s1, y, 0.05), f.P(s0, y, 0.05));
    A.quadP(f.P(s0, y - drop - val, depth), f.P(s1, y - drop - val, depth), f.P(s1, y - drop, depth), f.P(s0, y - drop, depth));
  }
  // the underside and the valance's back, in shade
  A.col = [c1[0] * 0.45, c1[1] * 0.45, c1[2] * 0.45];
  A.quadP(f.P(a1, y - drop, depth - 0.02), f.P(a0, y - drop, depth - 0.02), f.P(a0, y, 0.03), f.P(a1, y, 0.03));
  A.quadP(f.P(a1, y - drop - val, depth - 0.02), f.P(a0, y - drop - val, depth - 0.02), f.P(a0, y - drop, depth - 0.02), f.P(a1, y - drop, depth - 0.02));
  A.col = c1;
  for (const s of [a0, a1]) {
    const p0 = f.P(s, y, 0.05), p1 = f.P(s, y - drop, depth), p2 = f.P(s, y - drop - val, depth);
    // both faces (their own vertices: shared ones would cancel their normals)
    const a = [A.v(...p0), A.v(...p1), A.v(...p2)], b = [A.v(...p0), A.v(...p1), A.v(...p2)];
    A.tri(a[0], a[1], a[2]); A.tri(b[0], b[2], b[1]);
  }
}

const hex = (h) => [parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255];

/** A painted board on an iron bracket, out from the wall over the pavement (close up only). */
function bladeSign(K, f, a, y, t) {
  const N = K.near;
  N.paint.col = [0.1, 0.1, 0.1];
  fbox(N.paint, f, a, y + 0.78, 0, 0.05, 0.05, 1.1, { u: 1 });
  const p = f.P(a, y, 0.68);
  N.paint.col = OTS[t] ? hex(OTS[t].frame) : [0.3, 0.1, 0.1];
  box(N.paint, p[0], p[1], p[2], 0.06, 0.72, 0.8, f.ry, { u: 1 });
  N.paint.col = [0.85, 0.68, 0.3];
  const q = f.P(a, y + 0.22, 0.68);
  box(N.paint, q[0], q[1], q[2], 0.08, 0.26, 0.44, f.ry, { u: 1, faces: 'lr', top: false });
}

/** A side or courtyard face: windows in every other bay ('w': a side on a street gets them all). */
function sideFace(K, it, f, top, rng, full) {
  const { nb, bw } = bays(f.len, full ? 2.7 : 3.4);
  const Wn = full ? K.win : K.near.win;
  Wn.col = it.trim;
  for (let fl = 1; fl <= it.nf; fl++) {
    if (!full && fl % 2 === 0) continue;
    const yb = it.gy + it.gf + (fl - 1) * it.fh;
    const wh = Math.min(2.1, it.fh - 1.0);
    for (let b = 0; b < nb; b++) {
      if (!full && (b + fl) % 2 && nb > 1) continue;
      const a = (b + 0.5) * bw;
      const lit = rng() < it.lit * 0.8;
      fquad(Wn, f, a - wh * 0.25, a + wh * 0.25, yb + 0.7, yb + 0.7 + wh, 0.04, otwUV(lit ? (rng() < 0.5 ? 'w_dim' : 'w_lit') : (rng() < 0.5 ? 'w_dark' : 'w_lace')));
    }
  }
  if (full) {
    K.stone.col = it.baseCol || [0.92, 0.88, 0.8];
    band(K.stone, f, -0.2, f.len + 0.2, top - 0.2, 0.5, 0, 0.42);
  }
}

// ------------------------------------------------------------------ roofs

function roof(K, it, top, rng) {
  const poly = it.poly;
  const R = it.roofMat === 'tile' ? K.tile : K.slate;
  R.col = it.roofCol;
  const kind = it.roof;
  if (kind === 'mansard') {
    const h1 = 2.7, a = 0.85, h2 = 0.9 + (it.seed % 7) * 0.08;
    mansard(R, poly, top, h1, a, h2, 2);
    dormers(K, it, top, a, rng);
    chimneys(K, it, top + h1 + h2, rng);
    return;
  }
  if (kind === 'flat') {
    K.stone.col = it.baseCol || [0.9, 0.86, 0.78];
    for (let k = 0; k < poly.length; k++) {
      const f = edgeFace(poly[k], poly[(k + 1) % poly.length]);
      fbox(K.stone, f, f.len / 2, top, -0.3, f.len, 0.9, 0.3, { u: 2.4, faces: 'fb' });
    }
    R.col = [0.35, 0.35, 0.36];
    flat(R, poly, top + 0.05, 2);
    return;
  }
  if (it.rect && (kind === 'gable' || kind === 'fgable' || kind === 'hip')) {
    const { x, z, w, d, ry } = it.rect;
    const Wl = wallAcc(K, it);
    Wl.col = it.col;
    let rise;
    if (kind === 'hip') {
      rise = Math.min(w, d) * 0.42;
      hip(R, x, top, z, w, d, rise, ry, { over: 0.45, u: 2 });
    } else if (kind === 'gable') {
      rise = d * 0.45;
      gable(R, x, top, z, w, d, rise, ry, { over: 0.4, u: 2, endAcc: Wl });
      if (rng() < 0.6) dormersGable(K, it, top, rng);
    } else {
      rise = w * 0.75;
      gable(R, x, top, z, w, d, rise, ry, { over: 0.3, u: 2, alongZ: true, endAcc: Wl });
      steppedGable(K, it, top, rise, rng);
    }
    chimneys(K, it, top + rise * 0.8, rng);
    return;
  }
  // anything else (corners): a pyramid, and a domed turret on the cut corner
  if (polyOK(poly)) pyramid(R, poly, top, 3.2, 2);
  if (it.turret) turret(K, it, top, rng);
}

/** Dormers along the street and back faces of a mansard. */
function dormers(K, it, top, a, rng) {
  const n = it.poly.length;
  for (let k = 0; k < n; k++) {
    const e = it.edges[k];
    if (e === 'p') continue;
    const f = edgeFace(it.poly[k], it.poly[(k + 1) % n]);
    if (f.len < 2.6) continue;
    const back = e === 'b';
    if (back && rng() < 0.5) continue;
    const { nb, bw } = bays(f.len, back ? 7 : 2.8);
    for (let b = 0; b < nb; b++) {
      if (nb > 3 && b % 2) continue;
      dormer(K, f, (b + 0.5) * bw, top + 0.15, Math.min(1.2, bw * 0.5), 1.7, rng, it);
    }
  }
}

/** A dormer: its front standing back from the cornice, a little pitched cap. */
function dormer(K, f, am, y, w, h, rng, it) {
  const N = K.near;
  const D = N.stone;
  D.col = it.dormerCol || [0.88, 0.86, 0.8];
  const o = -0.3, hw = w / 2 + 0.16;
  fquad(D, f, am - hw, am + hw, y, y + h, o, [0, 0, 0.6, 0.7]);
  const R = it.roofMat === 'tile' ? N.tile : N.slate;
  R.col = it.roofCol;
  const yr = y + h, rise = 0.42, back = -1.3;
  R.quadP(f.P(am - hw - 0.1, yr, o + 0.12), f.P(am, yr + rise, o + 0.12), f.P(am, yr + rise, o + back), f.P(am - hw - 0.1, yr, o + back), [0, 0, 0.6, 0.7]);
  R.quadP(f.P(am, yr + rise, o + 0.12), f.P(am + hw + 0.1, yr, o + 0.12), f.P(am + hw + 0.1, yr, o + back), f.P(am, yr + rise, o + back), [0, 0, 0.6, 0.7]);
  const i0 = D.v(...f.P(am - hw, yr, o)), i1 = D.v(...f.P(am + hw, yr, o)), i2 = D.v(...f.P(am, yr + rise, o));
  D.tri(i0, i1, i2);
  N.win.col = it.trim;
  fquad(N.win, f, am - w / 2 + 0.04, am + w / 2 - 0.04, y + 0.1, y + h - 0.08, o + 0.02, otwUV(rng() < it.lit * 0.7 ? 'd_lit' : 'd_dark'));
}

function dormersGable(K, it, top, rng) {
  const f = edgeFace(it.poly[0], it.poly[1]);
  const { nb, bw } = bays(f.len, 4);
  for (let b = 0; b < nb; b++) {
    if (nb > 2 && b % 2) continue;
    dormer(K, f, (b + 0.5) * bw, top - 0.1, Math.min(1.1, bw * 0.45), 1.5, rng, it);
  }
}

/** A Flemish stepped gable over the front wall (the roof behind it runs front to back). */
function steppedGable(K, it, top, rise, rng) {
  const f = edgeFace(it.poly[0], it.poly[1]);
  const Wl = wallAcc(K, it);
  const len = f.len;
  const steps = 4 + (it.seed % 2);
  const sh = (rise + 0.6) / steps;
  for (let k = 0; k < steps; k++) {
    const ins = (k / steps) * (len / 2 - 0.5);
    const y = top + k * sh;
    Wl.col = it.col;
    fbox(Wl, f, len / 2, y, -0.45, len - 2 * ins, sh, 0.5, { u: 2, faces: 'flr' });
    K.stone.col = [0.9, 0.87, 0.8];
    fbox(K.stone, f, ins + 0.3, y + sh, -0.5, 0.65, 0.12, 0.6, { u: 1, faces: 'f' });
    fbox(K.stone, f, len - ins - 0.3, y + sh, -0.5, 0.65, 0.12, 0.6, { u: 1, faces: 'f' });
  }
  K.win.col = it.trim;
  fquad(K.win, f, len / 2 - 0.55, len / 2 + 0.55, top + 0.5, top + 2.6, 0.06, otwUV(rng() < it.lit * 0.6 ? 'a_lit' : 'a_dark'));
  K.stone.col = [0.9, 0.87, 0.8];
  fbox(K.stone, f, len / 2, top + steps * sh, -0.45, 0.4, 0.8, 0.4, { u: 1 });
}

/** Chimney stacks on the party walls, a pot or two on each (pots close up). */
function chimneys(K, it, yTop, rng) {
  const n = it.poly.length;
  const C = it.wall === 'brick' ? K.brick : K.plaster;
  C.col = it.wall === 'brick' ? it.col : [0.8, 0.74, 0.66];
  let made = 0;
  const yb = it.gy + it.gf + Math.max(0, it.nf - 1) * it.fh;
  for (let k = 0; k < n && made < 2; k++) {
    if (it.edges[k] !== 'p' || rng() < 0.4) continue;
    const f = edgeFace(it.poly[k], it.poly[(k + 1) % n]);
    const L = Math.min(2.4, f.len * 0.3), am = f.len * (0.3 + rng() * 0.4);
    const p = f.P(am, yb, -0.45);
    box(C, p[0], yb, p[2], L, yTop + 1.1 - yb, 0.9, f.ry, { u: 2 });
    const N = K.near;
    N.paint.col = [0.62, 0.36, 0.25];
    const np = L > 1.6 ? 2 : 1;
    for (let q = 0; q < np; q++) {
      const pp = f.P(am - L / 2 + (q + 0.5) * L / np, yTop + 1.1, -0.45);
      cylinder(N.paint, pp[0], pp[1], pp[2], 0.12, 0.45, 4, { r2: 0.09 });
    }
    made++;
  }
}

/** A round corner turret with a dome (on chamfered corners). */
function turret(K, it, top, rng) {
  const cf = it.edges.indexOf('c');
  if (cf < 0) return;
  const f = edgeFace(it.poly[cf], it.poly[(cf + 1) % it.poly.length]);
  const p = f.P(f.len / 2, top, -1.4);
  const r = 2.2;
  K.stone.col = it.baseCol || [0.92, 0.88, 0.8];
  cylinder(K.stone, p[0], top - 0.5, p[2], r, 3.6, 10, { u: 2.4 });
  K.win.col = it.trim;
  for (let q = 0; q < 5; q++) {
    const a = f.ry + (q - 2) * 0.55;
    const ox = Math.sin(a), oz = Math.cos(a), tx = Math.cos(a), tz = -Math.sin(a);
    const c = [p[0] + ox * (r + 0.03), p[2] + oz * (r + 0.03)];
    K.win.quadP([c[0] - tx * 0.45, top + 0.4, c[1] - tz * 0.45], [c[0] + tx * 0.45, top + 0.4, c[1] + tz * 0.45], [c[0] + tx * 0.45, top + 2.4, c[1] + tz * 0.45], [c[0] - tx * 0.45, top + 2.4, c[1] - tz * 0.45], otwUV(rng() < it.lit ? 'a_lit' : 'a_dark'));
  }
  K.slate.col = it.dome === 'copper' ? [0.38, 0.62, 0.52] : [0.4, 0.43, 0.48];
  sphere(K.slate, p[0], top + 3.1, p[2], r + 0.15, 10, { dome: true, sy: 1.35 });
  K.stone.col = [0.85, 0.75, 0.45];
  cylinder(K.stone, p[0], top + 3.1 + (r + 0.15) * 1.3, p[2], 0.12, 1.4, 5, { r2: 0.02 });
}
