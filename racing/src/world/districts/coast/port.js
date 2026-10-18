// PORT HALCYON — the working waterfront's shared pieces (Harbor Docks and
// the Shipyard): container blocks, ship-to-shore cranes, yard gantries and
// straddle carriers, high-mast floods, the quay edge (wall, fenders,
// bollards), ship hulls and the ships built on them, tugs, port trucks and
// chain-link. Each builder takes (B, M, it): the Builder, the materials and
// the plan item.
import * as THREE from 'three';
import { makeRng } from '../../../core/util.js';
import { box, cylinder, litMat } from '../builder.js';
import { C, col, frame, lbox, lbeam, tube, seedOf, mixC, disc, panel, mats, cmat, groundStrip } from './kit.js';
import { contUV, NEUTRAL, containerAtlas, plateTexture, fenceTexture, deckhouseTexture } from './tex.js';

export const CH = 2.59, CW = 2.44, C40 = 12.19, C20 = 6.06;

// container colours for the plain (tintable) livery
const TINTS = ['#b8322a', '#2a6fb8', '#d9a21e', '#2f8a4a', '#d8651e', '#5a3a8a', '#1f8f96', '#8c8f92', '#a8442e', '#c84a7a', '#d6d4cc', '#3a4a5a', '#e0c070', '#6a8a2a'];

/** Pick a container's livery row and tint (bay: the bay's own line). */
function livery(rng, bayRow, bayTint, pal) {
  let row = bayRow, tint = bayTint;
  if (rng() > (pal === 'empty' ? 0.92 : 0.62)) {
    row = pal === 'reefer' ? NEUTRAL : Math.floor(rng() * 8);
    tint = row === NEUTRAL ? (pal === 'reefer' ? C('#e8e8e4') : C(TINTS[Math.floor(rng() * TINTS.length)])) : null;
  }
  const f = 0.8 + rng() * 0.2;
  const t = tint || [1, 1, 1];
  return { row, c: [t[0] * f, t[1] * f * (0.97 + rng() * 0.05), t[2] * f] };
}

/**
 * A block of containers: `rows` across (local z) × `bays` along (local x),
 * up to it.tmax high (it.tiers: fixed heights per stack, else random).
 * Only the faces that can be seen are drawn. it: { x, z, ry, rows, bays,
 * len, tmax, pal: 'mixed'|'reefer'|'empty'|'line', y0? }
 */
export function stackBlock(B, M, it, acc = B.acc(M.cont)) {
  const rng = makeRng(seedOf(it));
  const nx = it.bays, nz = it.rows;
  const len = it.len || C40;
  const bp = len + (len > 7 ? 0.45 : 0.3), rp = CW + 0.32;
  const y0 = it.y0 ?? B.footY(it.x, it.z, nx * bp, nz * rp, it.ry).lo - 0.04;
  const T = new Uint8Array(nx * nz);
  const tmax = it.tmax || 4;
  for (let b = 0; b < nx; b++) {
    for (let r = 0; r < nz; r++) {
      let t = tmax;
      const q = it.full ? 1 : rng();
      if (q < 0.06 && it.pal !== 'empty') t = 0;
      else if (q < 0.28) t = Math.max(1, tmax - 1 - Math.floor(rng() * 2));
      else if (q < 0.4) t = Math.max(1, tmax - 1);
      if (!it.full && it.edgeLow && (r === 0 || r === nz - 1) && rng() < 0.4) t = Math.max(1, t - 1);
      T[b * nz + r] = t;
    }
  }
  const c = Math.cos(it.ry), s = Math.sin(it.ry);
  const X = it.x, Z = it.z;
  // local (lx, ly, lz) → world
  const P = (lx, ly, lz) => [X + lx * c + lz * s, y0 + ly, Z - lx * s + lz * c];
  const hl = len / 2, hw = CW / 2;
  const part = len > 7 ? 0 : 1;
  const xs = -(nx * bp) / 2 + bp / 2, zs = -(nz * rp) / 2 + rp / 2;
  for (let b = 0; b < nx; b++) {
    // this bay's line
    const bayRow = it.pal === 'reefer' ? NEUTRAL : it.pal === 'line' ? (it.line ?? 3) : Math.floor(rng() * 8);
    const bayTint = bayRow === NEUTRAL ? (it.pal === 'reefer' ? C('#ecece8') : C(TINTS[Math.floor(rng() * TINTS.length)])) : null;
    const cx = xs + b * bp;
    for (let r = 0; r < nz; r++) {
      const t = T[b * nz + r];
      const cz = zs + r * rp;
      const tL = r > 0 ? T[b * nz + r - 1] : 0, tR = r < nz - 1 ? T[b * nz + r + 1] : 0;
      const tB = b > 0 ? T[(b - 1) * nz + r] : 0, tF = b < nx - 1 ? T[(b + 1) * nz + r] : 0;
      for (let k = 0; k < t; k++) {
        const L = livery(rng, bayRow, bayTint, it.pal);
        acc.col = L.c;
        const yb = k * CH, yt = yb + CH - 0.02;
        const side = contUV(L.row, part), door = contUV(L.row, 2);
        if (r === nz - 1 || tR <= k) acc.quadP(P(cx - hl, yb, cz + hw), P(cx + hl, yb, cz + hw), P(cx + hl, yt, cz + hw), P(cx - hl, yt, cz + hw), side);
        if (r === 0 || tL <= k) acc.quadP(P(cx + hl, yb, cz - hw), P(cx - hl, yb, cz - hw), P(cx - hl, yt, cz - hw), P(cx + hl, yt, cz - hw), side);
        if (b === nx - 1 || tF <= k) acc.quadP(P(cx + hl, yb, cz + hw), P(cx + hl, yb, cz - hw), P(cx + hl, yt, cz - hw), P(cx + hl, yt, cz + hw), door);
        if (b === 0 || tB <= k) acc.quadP(P(cx - hl, yb, cz - hw), P(cx - hl, yb, cz + hw), P(cx - hl, yt, cz + hw), P(cx - hl, yt, cz - hw), door);
        if (k === t - 1) acc.quadP(P(cx - hl, yt, cz + hw), P(cx + hl, yt, cz + hw), P(cx + hl, yt, cz - hw), P(cx - hl, yt, cz - hw), contUV(L.row, 3));
      }
    }
  }
  return { y0, T };
}

/** One container (or a short stack) at world (x, y, z) turned ry: for chassis, decks, slings. */
export function container(acc, x, y, z, ry, row, tint, len = C40, tiers = 1) {
  const c = Math.cos(ry), s = Math.sin(ry);
  const P = (lx, ly, lz) => [x + lx * c + lz * s, y + ly, z - lx * s + lz * c];
  const hl = len / 2, hw = CW / 2, h = CH * tiers - 0.02;
  acc.col = tint;
  const side = contUV(row, len > 7 ? 0 : 1), door = contUV(row, 2);
  const sv = [side[0], side[1], side[2], side[1] + (side[3] - side[1]) * 1]; // one tier's worth (stretched if more)
  acc.quadP(P(-hl, 0, hw), P(hl, 0, hw), P(hl, h, hw), P(-hl, h, hw), sv);
  acc.quadP(P(hl, 0, -hw), P(-hl, 0, -hw), P(-hl, h, -hw), P(hl, h, -hw), sv);
  acc.quadP(P(hl, 0, hw), P(hl, 0, -hw), P(hl, h, -hw), P(hl, h, hw), door);
  acc.quadP(P(-hl, 0, -hw), P(-hl, 0, hw), P(-hl, h, hw), P(-hl, h, -hw), door);
  acc.quadP(P(-hl, h, hw), P(hl, h, hw), P(hl, h, -hw), P(-hl, h, -hw), contUV(row, 3));
}

/** A random container livery: { row, tint }. */
export function randomBox(rng, pal = 'mixed') {
  const row = Math.floor(rng() * 8);
  const t = row === NEUTRAL ? C(pal === 'reefer' ? '#ecece8' : TINTS[Math.floor(rng() * TINTS.length)]) : [1, 1, 1];
  const f = 0.82 + rng() * 0.18;
  return { row, tint: [t[0] * f, t[1] * f, t[2] * f] };
}

// ------------------------------------------------------------------ STS crane

const WHITE = C('#e6e4de'), RED = C('#b03328'), DARK = C('#2a2b2e'), GREY = C('#6d7074'), YEL = C('#e2b021');

/**
 * Ship-to-shore gantry crane. it: { x, z, y0, ry (local +z = seaward), up
 * (boom raised), tr (trolley 0..1 along the boom), num }. Origin between
 * the four legs; legs at u = ±9 (along the quay), w = ±15.25 (gauge).
 */
export function stsCrane(B, M, it) {
  const rng = makeRng(seedOf(it));
  const st = B.acc(M.steel), gl = B.acc(M.glow), bl = B.acc(M.blink);
  const y0 = it.y0;
  const F = frame(it.x, y0, it.z, it.ry);
  const ry = it.ry;
  const GY = 45.5;                       // girder bottom
  // legs and their bogies
  for (const u of [-9, 9]) {
    for (const w of [-15.25, 15.25]) {
      col(st, WHITE);
      lbox(st, F, ry, u, 2.2, w, 1.9, GY - 2.2, 1.9, { u: 2 });
      col(st, DARK);
      lbox(st, F, ry, u, 0, w, 6.2, 1.5, 1.6, { u: 2 });
      lbox(st, F, ry, u, 1.5, w, 2.6, 0.8, 1.9, { u: 2 });
      col(st, YEL);
      lbox(st, F, ry, u, 0.1, w + (w > 0 ? 1.0 : -1.0), 6.3, 0.25, 0.15, { u: 2 });
    }
  }
  // the portal: beams along the quay on each rail, X bracing between, the portal beam across at 14 m
  for (const w of [-15.25, 15.25]) {
    col(st, WHITE);
    lbox(st, F, ry, 0, 13, w, 18, 1.6, 1.5, { u: 2 });
    lbox(st, F, ry, 0, GY - 1.6, w, 20, 1.6, 2.2, { u: 2 });
    lbeam(st, F, [-9, 14.6, w], [9, GY - 1.6, w], 0.9);
    lbeam(st, F, [9, 14.6, w], [-9, GY - 1.6, w], 0.9);
  }
  for (const u of [-9, 9]) {
    col(st, WHITE);
    lbox(st, F, ry, u, 14.5, 0, 1.6, 1.8, 30.5, { u: 2 });
    // knee braces up to the girder level
    lbeam(st, F, [u, 16.3, -15.25], [u, 26, -8], 0.8);
    lbeam(st, F, [u, 16.3, 15.25], [u, 26, 8], 0.8);
  }
  // the girders (back-reach + over the legs) and the boom (seaward, hinged at w = 15.5)
  const hinge = 15.5, tip = 64, back = -31;
  const up = !!it.up;
  const ang = up ? (78 + rng() * 6) * Math.PI / 180 : 0;
  const boomPt = (w, dy) => {
    // a point on the boom at distance w from the crane's origin (seaward), dy above the boom's bottom chord
    if (!up || w <= hinge) return [w, GY + dy];
    const d = w - hinge;
    return [hinge + d * Math.cos(ang) - dy * Math.sin(ang), GY + d * Math.sin(ang) + dy * Math.cos(ang)];
  };
  const GH = 3.2;                       // girder depth
  for (const u of [-4.6, 4.6]) {
    // landside girder: a solid box girder
    col(st, RED);
    lbox(st, F, ry, u, GY, (back + hinge) / 2, 1.5, GH, hinge - back, { u: 2 });
    // seaward boom: lattice (two chords, diagonals on both faces)
    const n = 14;
    for (let k = 0; k < n; k++) {
      const wa = hinge + (tip - hinge) * k / n, wb = hinge + (tip - hinge) * (k + 1) / n;
      const A0 = boomPt(wa, 0), A1 = boomPt(wa, GH), B0 = boomPt(wb, 0), B1 = boomPt(wb, GH);
      if (k === 0) { lbeam(st, F, [u, A0[1], A0[0]], [u, A1[1], A1[0]], 0.5); }
      lbeam(st, F, [u, A0[1], A0[0]], [u, B0[1], B0[0]], 0.75, 0.75);
      lbeam(st, F, [u, A1[1], A1[0]], [u, B1[1], B1[0]], 0.75, 0.75);
      lbeam(st, F, [u, B0[1], B0[0]], [u, B1[1], B1[0]], 0.4);
      if (k % 2) lbeam(st, F, [u, A0[1], A0[0]], [u, B1[1], B1[0]], 0.36);
      else lbeam(st, F, [u, A1[1], A1[0]], [u, B0[1], B0[0]], 0.36);
    }
  }
  // cross ties between the two booms
  for (let k = 0; k <= 7; k++) {
    const w = hinge + (tip - hinge) * k / 7;
    const p = boomPt(w, 0);
    col(st, RED);
    lbeam(st, F, [-4.6, p[1] + 0.2, p[0]], [4.6, p[1] + 0.2, p[0]], 0.45);
  }
  for (const w of [back + 1, -12, 0, 12]) { col(st, RED); lbeam(st, F, [-4.6, GY + 0.3, w], [4.6, GY + 0.3, w], 0.6); }
  // cross beams on the legs carrying the girders
  for (const w of [-15.25, 15.25]) { col(st, WHITE); lbox(st, F, ry, 0, GY - 0.3, w, 20, 0.6, 2.4, { u: 2 }); }
  // the A-frame and its stays
  const apexW = -3, apexY = 78;
  col(st, RED);
  for (const u of [-4.6, 4.6]) {
    lbeam(st, F, [u, GY + GH, -15.25], [u, apexY, apexW], 1.3);
    lbeam(st, F, [u, GY + GH, 15.25], [u, apexY, apexW], 1.3);
    lbeam(st, F, [u, 60, -8.8], [u, 60, 3.6], 0.6);
  }
  lbox(st, F, ry, 0, apexY - 0.6, apexW, 11, 1.4, 1.8, { u: 2 });
  col(st, GREY);
  for (const u of [-4.2, 4.2]) {
    const m = boomPt(40, GH), t2 = boomPt(tip - 2, GH);
    lbeam(st, F, [u, apexY, apexW + 0.5], [u, m[1], m[0]], 0.28);
    lbeam(st, F, [u, apexY, apexW + 0.5], [u, t2[1], t2[0]], 0.28);
    lbeam(st, F, [u, apexY, apexW - 0.5], [u, GY + GH, back + 2], 0.28);
  }
  // machinery house on the back-reach, with the crane's number
  col(st, WHITE);
  lbox(st, F, ry, 0, GY + GH, back + 8.5, 11, 6.2, 13, { u: 2 });
  col(st, RED);
  lbox(st, F, ry, 0, GY + GH + 6.2, back + 8.5, 11.4, 0.5, 13.4, { u: 2 });
  // trolley and cab on the boom (or parked over the legs when the boom is up)
  const tw = up ? -4 + rng() * 10 : hinge + 6 + (it.tr ?? rng()) * (tip - hinge - 14);
  col(st, GREY);
  lbox(st, F, ry, 0, GY + GH, tw, 8.6, 2.6, 7.2, { u: 2 });
  col(st, DARK);
  lbox(st, F, ry, 2.3, GY - 3.4, tw + 2.6, 2.6, 3.2, 3.0, { u: 2 });
  col(gl, C('#ffe9c0', 1.6));
  lbox(gl, F, ry, 2.3, GY - 2.6, tw + 4.12, 2.4, 1.3, 0.05, {});
  // spreader on its ropes (and maybe a box in it)
  if (!up) {
    const sy = 18 + rng() * 16;
    col(st, C('#3a3a3a'));
    for (const [du, dw] of [[-3.5, -1], [3.5, -1], [-3.5, 1], [3.5, 1]]) lbeam(st, F, [du * 0.8, GY, tw + dw], [du, sy + 0.6, tw + dw], 0.07);
    col(st, YEL);
    lbox(st, F, ry, 0, sy, tw, 12.4, 0.6, 2.5, { u: 2 }, Math.PI / 2 * 0);
    if (rng() < 0.6) {
      const L = randomBox(rng);
      const p = F(0, sy - CH, tw);
      container(B.acc(M.cont), p[0], p[1], p[2], ry, L.row, L.tint);
    }
  }
  // floodlights under the girders and the boom
  for (const w of [-22, -10, 2, 14, 26, 38, 50, 60]) {
    if (up && w > hinge) continue;
    for (const u of [-3.2, 3.2]) { col(gl, C('#eef4ff', 4)); lbox(gl, F, ry, u, GY - 0.35, w, 1.1, 0.3, 0.8, {}); }
  }
  // obstruction lights: the apex, the boom's tip, the back-reach
  col(bl, C('#ff2a18', 5));
  const ap = F(0, apexY + 1.6, apexW);
  bl.box(ap[0], ap[1], ap[2], 0.7, 0.7, 0.7);
  const tp = boomPt(tip, GH + 0.4), tpw = F(0, tp[1], tp[0]);
  bl.box(tpw[0], tpw[1], tpw[2], 0.6, 0.6, 0.6);
  const bk = F(0, GY + GH + 6.8, back + 3);
  bl.box(bk[0], bk[1], bk[2], 0.5, 0.5, 0.5);
  // amber beacons on the legs (crane moving lights)
  col(gl, C('#ffae2a', 3));
  for (const u of [-9, 9]) for (const w of [-15.25, 15.25]) { const q = F(u, 3.4, w + (w > 0 ? -1.2 : 1.2)); gl.box(q[0], q[1], q[2], 0.35, 0.35, 0.35); }
}

/** Where an STS crane's parts are, for the plan (far shapes, lamps). */
export function stsPlan(P, it, farColor = '#d6d4cc') {
  const F = frame(it.x, it.y0, it.z, it.ry);
  const GY = 45.5;
  // legs
  for (const u of [-9, 9]) for (const w of [-15.25, 15.25]) {
    const p = F(u, 0, w);
    P.far({ shape: 'box', x: p[0], z: p[2], y: it.y0, w: 2, d: 2, h: GY, ry: it.ry, color: farColor });
    P.collider({ kind: 'box', x: p[0], z: p[2], hx: 3.1, hz: 1.1, ry: it.ry, y0: it.y0 - 1, y1: it.y0 + GY });
  }
  // the girder + boom
  const back = -31, hinge = 15.5, tip = 64;
  if (!it.up) {
    const m = F(0, 0, (back + tip) / 2);
    P.far({ shape: 'box', x: m[0], z: m[2], y: it.y0 + GY, w: 10.5, d: tip - back, h: 3.2, ry: it.ry, color: '#9a3028' });
  } else {
    const m = F(0, 0, (back + hinge) / 2);
    P.far({ shape: 'box', x: m[0], z: m[2], y: it.y0 + GY, w: 10.5, d: hinge - back, h: 3.2, ry: it.ry, color: '#9a3028' });
    const b = F(0, 0, hinge + 6);
    P.far({ shape: 'box', x: b[0], z: b[2], y: it.y0 + GY, w: 10.5, d: 3.5, h: 47, ry: it.ry, color: '#9a3028' });
  }
  const a = F(0, 0, -3);
  P.far({ shape: 'box', x: a[0], z: a[2], y: it.y0 + GY + 3, w: 10, d: 4, h: 30, ry: it.ry, color: '#9a3028' });
  // red obstruction lights (far points), the floods
  const ap = F(0, 79.6, -3);
  P.lamp({ x: ap[0], z: ap[2], hx: ap[0], hy: ap[1], hz: ap[2], color: '#ff2a18', radius: 2, intensity: 0, halo: 4.5 });
  const tp = it.up ? F(0, GY + (tip - hinge) * 0.98, hinge + 6) : F(0, GY + 3.6, tip);
  P.lamp({ x: tp[0], z: tp[2], hx: tp[0], hy: tp[1], hz: tp[2], color: '#ff2a18', radius: 2, intensity: 0, halo: 3.5 });
  // light on the apron and over the berth (white metal halide)
  for (const w of it.up ? [-6, 8] : [-6, 8, 30, 52]) {
    const p = F(0, GY - 0.6, w);
    P.lamp({ x: p[0], z: p[2], hx: p[0], hy: p[1], hz: p[2], color: '#e4ecff', radius: 58, intensity: 1.1, halo: 6 });
  }
}

// ------------------------------------------------------------------ yard gantries

/**
 * Rubber-tyred gantry over a container block. it: { x, z, y0, ry (local x
 * along the block), span, h, paint: 'yellow'|'blue' }.
 */
export function rtgCrane(B, M, it) {
  const rng = makeRng(seedOf(it));
  const st = B.acc(M.paint), gl = B.acc(M.glow);
  const F = frame(it.x, it.y0, it.z, it.ry), ry = it.ry;
  const S = (it.span || 23.5) / 2, H = it.h || 20.5;
  const main = it.paint === 'blue' ? C('#2a5a9a') : C('#e3b322'), trim = C('#d8d8d2');
  for (const w of [-S, S]) {
    // wheel truck and sill beam
    col(st, DARK);
    for (const u of [-3.4, 3.4]) {
      lbox(st, F, ry, u, 0.2, w, 2.6, 1.0, 1.2, { u: 2 });
      lbox(st, F, ry, u - 0.7, 0, w, 1.1, 1.1, 0.9, { u: 2 });
      lbox(st, F, ry, u + 0.7, 0, w, 1.1, 1.1, 0.9, { u: 2 });
    }
    col(st, main);
    lbox(st, F, ry, 0, 1.2, w, 8.6, 1.1, 1.3, { u: 2 });
    for (const u of [-3.4, 3.4]) lbox(st, F, ry, u, 2.3, w, 1.1, H - 2.3, 1.1, { u: 2 });
    lbox(st, F, ry, 0, H - 1.2, w, 8.6, 1.4, 1.4, { u: 2 });
    lbeam(st, F, [-3.4, 3, w], [3.4, H - 1.6, w], 0.45);
  }
  // top girders across, trolley, cab, spreader
  col(st, main);
  for (const u of [-2.6, 2.6]) lbox(st, F, ry, u, H, 0, 1.0, 1.6, 2 * S + 2.4, { u: 2 });
  col(st, trim);
  const tw = (rng() - 0.5) * S * 1.2;
  lbox(st, F, ry, 0, H + 1.6, tw, 6.2, 2.4, 5, { u: 2 });
  col(st, DARK);
  lbox(st, F, ry, 3.6, H - 3.2, tw, 2.2, 2.6, 2.2, { u: 2 });
  col(gl, C('#ffe2b0', 1.5));
  lbox(gl, F, ry, 4.72, H - 2.6, tw, 0.05, 1.2, 1.9, {});
  const sy = 6 + rng() * 6;
  col(st, C('#2a2a2a'));
  for (const du of [-2.5, 2.5]) lbeam(st, F, [du, H, tw], [du * 1.2, sy + 0.5, tw], 0.06);
  col(st, YEL);
  lbox(st, F, ry, 0, sy, tw, 12.4, 0.5, 2.4, { u: 2 }, Math.PI / 2);
  // lights under the girders, beacon
  col(gl, C('#fff3dc', 3.5));
  for (const w of [-S * 0.6, 0, S * 0.6]) lbox(gl, F, ry, 0, H - 0.25, w, 1.2, 0.25, 0.8, {});
  col(gl, C('#ffae2a', 3));
  const b = F(-2.6, H + 1.8, S);
  gl.box(b[0], b[1], b[2], 0.4, 0.4, 0.4);
}

/** Straddle carrier: four legs, a frame over the top, the cab, maybe a box slung under. it: { x, z, y0, ry, cargo } */
export function straddle(B, M, it) {
  const rng = makeRng(seedOf(it));
  const st = B.acc(M.paint), gl = B.acc(M.glow);
  const F = frame(it.x, it.y0, it.z, it.ry), ry = it.ry;
  const H = 13.6, hx = 5.6, hz = 2.1;
  const paint = C(it.paint || '#d8d6ce'), acc2 = C('#2f5d8a');
  for (const sz of [-hz, hz]) {
    col(st, DARK);
    for (const u of [-hx + 0.9, -hx + 2.7, hx - 2.7, hx - 0.9]) lbox(st, F, ry, u, 0, sz, 1.2, 1.2, 0.55, { u: 2 });
    col(st, acc2);
    lbox(st, F, ry, 0, 0.55, sz, 2 * hx, 0.9, 0.7, { u: 2 });
    col(st, paint);
    for (const u of [-hx + 1.1, hx - 1.1]) lbox(st, F, ry, u, 1.4, sz, 1.0, H - 1.4, 0.8, { u: 2 });
    lbox(st, F, ry, 0, H - 1.2, sz, 2 * hx, 1.2, 0.9, { u: 2 });
    lbeam(st, F, [-hx + 1.1, 2, sz], [hx - 1.1, H - 1.3, sz], 0.35);
  }
  col(st, paint);
  for (const u of [-hx + 1.1, hx - 1.1]) lbox(st, F, ry, u, H - 1.2, 0, 0.9, 1.2, 2 * hz, { u: 2 });
  col(st, acc2);
  lbox(st, F, ry, hx - 1.4, H, hz - 0.2, 2.4, 2.4, 2.2, { u: 2 });
  col(gl, C('#ffe2b0', 1.4));
  lbox(gl, F, ry, hx - 0.18, H + 0.9, hz - 0.2, 0.05, 1.1, 1.8, {});
  col(gl, C('#ffae2a', 3));
  const b = F(-hx + 1.1, H + 0.3, hz);
  gl.box(b[0], b[1], b[2], 0.35, 0.35, 0.35);
  if (it.cargo) {
    const L = randomBox(rng);
    const p = F(0, 0, 0);
    container(B.acc(M.cont), p[0], it.y0 + 1.6, p[2], ry, L.row, L.tint);
  }
}

// ------------------------------------------------------------------ masts

/** High-mast floodlight: a tapered pole, a ring of lamps. it: { x, z, y0, h, color } (its light is a P.lamp). */
export function mast(B, M, it) {
  const st = B.acc(M.paint), gl = B.acc(M.glow);
  const H = it.h || 30;
  col(st, C('#7a7d80'));
  cylinder(st, it.x, it.y0 - 0.2, it.z, 0.55, H + 0.2, 8, { r2: 0.24 });
  col(st, C('#55585c'));
  box(st, it.x, it.y0 - 0.2, it.z, 1.6, 0.9, 1.6, 0);
  disc(st, it.x, it.y0 + H - 0.3, it.z, 2.1, 10);
  cylinder(st, it.x, it.y0 + H - 0.7, it.z, 2.1, 0.4, 10);
  const hot = C(it.color || '#e4ecff', 5);
  const n = it.heads || 8;
  for (let k = 0; k < n; k++) {
    const a = (k / n) * Math.PI * 2 + (it.n % 7);
    const hx = it.x + Math.cos(a) * 1.7, hz = it.z + Math.sin(a) * 1.7;
    col(st, C('#3a3c40'));
    box(st, hx, it.y0 + H - 1.2, hz, 0.9, 0.55, 0.7, -a);
    col(gl, hot);
    box(gl, hx, it.y0 + H - 1.26, hz, 0.75, 0.06, 0.55, -a, { bottom: true, top: false });
  }
}

// ------------------------------------------------------------------ the quay edge

/**
 * The quay edge along world [x, z] points (the coast): a concrete wall face
 * down into the water, fenders hung on it, a yellow edge line, bollards.
 * it: { pts, y0 (quay level), sea: +1|-1 (which side of the line is water,
 * relative to its left), bollards, fenders }.
 */
export function quayEdge(B, M, it) {
  const pts = it.pts;
  const wall = B.acc(M.conc), dec = B.acc(M.decal), near = B.near(M.matte), np = B.near(M.paint);
  const yBot = it.wallBottom ?? -7;
  const wl = it.waterY ?? 0;
  let run = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], b = pts[i + 1];
    const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (L < 0.5) continue;
    const tx = (b[0] - a[0]) / L, tz = (b[1] - a[1]) / L;
    // the water's side: the line's left (tz, −tx) when sea = +1
    const sx = tz * it.sea, sz = -tx * it.sea;
    const o = 0.35;
    const A = [a[0] + sx * o, a[1] + sz * o], Bq = [b[0] + sx * o, b[1] + sz * o];
    // the land's level just inside the edge, at both ends
    const ya = B.groundY(a[0] - sx * 1.4, a[1] - sz * 1.4) + 0.25, yb = B.groundY(b[0] - sx * 1.4, b[1] - sz * 1.4) + 0.25;
    // a vertical face from p to q, wound to face (fx, fz)
    const face = (p, q, p0, p1, q0, q1, fx, fz, uv) => {
      const cr = (q[0] - p[0]) * fz - (q[1] - p[1]) * fx;
      if (cr > 0) wall.quadP([p[0], p0, p[1]], [q[0], q0, q[1]], [q[0], q1, q[1]], [p[0], p1, p[1]], uv);
      else wall.quadP([q[0], q0, q[1]], [p[0], p0, p[1]], [p[0], p1, p[1]], [q[0], q1, q[1]], uv);
    };
    col(wall, C(it.wallC || '#8a8780'));
    face(A, Bq, yBot, ya, yBot, yb, sx, sz, [run / 4, 0, (run + L) / 4, 1.8]);
    // the slime band at the water
    if (it.slime !== false) {
      col(wall, C('#3c4a3a'));
      const A2 = [A[0] + sx * 0.03, A[1] + sz * 0.03], B2 = [Bq[0] + sx * 0.03, Bq[1] + sz * 0.03];
      face(A2, B2, wl - 1.2, wl + 0.9, wl - 1.2, wl + 0.9, sx, sz, [run / 4, 0, (run + L) / 4, 0.5]);
    }
    // the capping beam: its top and its inner face down to the ground
    col(wall, C('#a7a49c'));
    const In = [a[0] - sx * 0.9, a[1] - sz * 0.9], In2 = [b[0] - sx * 0.9, b[1] - sz * 0.9];
    capUp(wall, [In[0], ya, In[1]], [In2[0], yb, In2[1]], [Bq[0], yb, Bq[1]], [A[0], ya, A[1]], [0, 0, L / 4, 0.3]);
    face(In, In2, ya - 0.6, ya, yb - 0.6, yb, -sx, -sz, [0, 0, L / 4, 0.2]);
    // the yellow line along the edge
    if (it.line !== false) {
      col(dec, C('#d9b23a'));
      groundStrip(dec, B, [[a[0] - sx * 1.45, a[1] - sz * 1.45], [b[0] - sx * 1.45, b[1] - sz * 1.45]], 0.3, 0.05, 6);
    }
    // fenders hung on the wall and bollards on the edge
    if (it.fenders !== 0) {
      for (let d = (it.phase || 0) + 6; d < L; d += it.fenders || 14) {
        const px = a[0] + tx * d + sx * 0.78, pz = a[1] + tz * d + sz * 0.78;
        col(near, C('#1b1b1c'));
        cylinder(near, px, wl - 1.0, pz, 0.42, ya - wl + 0.6, 8, { top: true });
      }
    }
    for (let d = (it.phase || 0) + 12; d < L; d += it.bollards || 26) {
      const px = a[0] + tx * d - sx * 0.55, pz = a[1] + tz * d - sz * 0.55;
      const y = ya + (yb - ya) * d / L;
      col(np, C('#2c2d30'));
      cylinder(np, px, y - 0.05, pz, 0.3, 0.55, 8);
      cylinder(np, px, y + 0.5, pz, 0.46, 0.18, 8, { top: true });
      col(np, C('#d9b23a'));
      cylinder(np, px, y - 0.05, pz, 0.32, 0.12, 8);
    }
    run += L;
  }
}

/** A flat quad that faces up whichever way its corners go round. */
export function capUp(acc, A, Bq, Cq, D, uv) {
  const ny = (Bq[2] - A[2]) * (Cq[0] - A[0]) - (Bq[0] - A[0]) * (Cq[2] - A[2]);
  if (ny > 0) acc.quadP(A, Bq, Cq, D, uv);
  else acc.quadP(D, Cq, Bq, A, uv);
}

// ------------------------------------------------------------------ hulls

/**
 * A ship's hull in a local frame (bow at +x): length L, beam Bm, keel at
 * yk, deck at yd (sheer rising `sheer` at the bow). bands: [[yTop, colour],
 * …] from the keel up (the last reaches the deck). o: { bottom, transom,
 * open: [t0, t1] (no plating there: frames only), bowRake }.
 * acc: a vertex-coloured material (plate texture or plain paint).
 */
export function hull(acc, F, L, Bm, yk, yd, bands, o = {}) {
  const hb = o.hb || ((t) => {
    if (t < 0.04) return Bm / 2 * (0.86 + 0.14 * t / 0.04);
    if (t < 0.62) return Bm / 2;
    const k = (t - 0.62) / 0.38;
    return Bm / 2 * Math.sqrt(Math.max(0, 1 - Math.pow(k, 2.2)));
  });
  const sheer = o.sheer ?? 2.5;
  const deck = (t) => yd + sheer * Math.max(0, (t - 0.8) / 0.2) ** 2 + (o.sternRise || 0) * Math.max(0, (0.12 - t) / 0.12);
  const ts = o.ts || [0, 0.02, 0.04, 0.08, 0.16, 0.3, 0.45, 0.62, 0.7, 0.78, 0.85, 0.9, 0.94, 0.97, 0.99, 1];
  const xOf = (t) => -L / 2 + t * L;
  const bilge = Math.min(2.2, (yd - yk) * 0.25);
  const U = 16, V = 8;
  const open = o.open;
  for (let k = 0; k < ts.length - 1; k++) {
    const t0 = ts[k], t1 = ts[k + 1];
    if (open && t0 >= open[0] - 1e-6 && t1 <= open[1] + 1e-6) continue;
    const x0 = xOf(t0), x1 = xOf(t1);
    const h0 = hb(t0), h1 = hb(t1), d0 = deck(t0), d1 = deck(t1);
    // the bilge turn: from the keel (narrower) to the side
    const kb0 = Math.max(0, h0 - bilge), kb1 = Math.max(0, h1 - bilge);
    let yA = yk + bilge;
    for (const sd of [1, -1]) {
      // bilge strip
      acc.col = bands[0][1];
      quadSide(acc, F, x0, x1, sd, yk, kb0, kb1, yA, h0, h1, U, V);
    }
    let yb = yA;
    for (let bi = 0; bi < bands.length; bi++) {
      const top = bi === bands.length - 1 ? null : bands[bi][0];
      if (top !== null && top <= yb) continue;
      acc.col = bands[bi][1];
      if (o.jitter) { const j = 0.84 + o.jitter() * 0.3, c0 = bands[bi][1]; acc.col = [c0[0] * j, c0[1] * (j + (o.jitter() - 0.5) * 0.06), c0[2] * j]; }
      for (const sd of [1, -1]) {
        const ya0 = yb, ya1 = yb;
        const yt0 = top === null ? d0 : Math.min(top, d0), yt1 = top === null ? d1 : Math.min(top, d1);
        // a straight-sided strip between the two sections
        const P = (x, y, z) => F(x, y, z);
        if (sd > 0) acc.quadP(P(x0, ya0, h0), P(x1, ya1, h1), P(x1, yt1, h1), P(x0, yt0, h0), [x0 / U, ya0 / V, x1 / U, yt0 / V]);
        else acc.quadP(P(x1, ya1, -h1), P(x0, ya0, -h0), P(x0, yt0, -h0), P(x1, yt1, -h1), [x1 / U, ya0 / V, x0 / U, yt0 / V]);
      }
      if (top === null) break;
      yb = top;
    }
    // deck
    if (o.deckCol) {
      acc.col = o.deckCol;
      acc.quadP(F(x0, d0, h0), F(x1, d1, h1), F(x1, d1, -h1), F(x0, d0, -h0), [x0 / U, -h0 / U, x1 / U, h0 / U]);
    }
    if (o.bottom) {
      acc.col = bands[0][1];
      acc.quadP(F(x0, yk, -kb0), F(x1, yk, -kb1), F(x1, yk, kb1), F(x0, yk, kb0), [0, 0, 1, 1]);
    }
  }
  // the transom
  if (o.transom !== false) {
    const h0 = hb(0), d0 = deck(0);
    acc.col = o.transomCol || bands[bands.length - 1][1];
    const x0 = xOf(0);
    acc.quadP(F(x0, yk + bilge, -h0), F(x0, yk + bilge, h0), F(x0, d0, h0), F(x0, d0, -h0), [0, 0, 1, 1]);
    const kb = Math.max(0, h0 - bilge);
    acc.col = bands[0][1];
    acc.quadP(F(x0, yk, -kb), F(x0, yk, kb), F(x0, yk + bilge, h0), F(x0, yk + bilge, -h0), [0, 0, 1, 1]);
  }
  return { hb, deck, xOf };
}

/**
 * The bare frames of a hull's unfinished part (t from t0 to t1): a rib
 * every `sp` metres round the section (side, bilge, floor, side, a deck
 * beam), the keel and stringers along. h: hull() result (hb, deck, xOf).
 */
export function hullFrames(acc, F, h, L, yk, t0, t1, sp = 3, w = 0.35) {
  const n = Math.max(1, Math.round((t1 - t0) * L / sp));
  const bil = 2;
  const sec = (t) => {
    const x = h.xOf(t), b = h.hb(t), d = h.deck(t), kb = Math.max(0, b - bil);
    return [[x, d, b], [x, yk + bil, b], [x, yk, kb], [x, yk, -kb], [x, yk + bil, -b], [x, d, -b]];
  };
  for (let k = 0; k <= n; k++) {
    const t = t0 + (t1 - t0) * k / n;
    const s = sec(t);
    for (let i = 0; i < s.length - 1; i++) lbeam(acc, F, s[i], s[i + 1], w, w);
    if (k % 2 === 0) lbeam(acc, F, s[0], s[5], w * 0.8, w * 0.8);
  }
  // keel, bilge and side stringers, the deck edges
  const ta = sec(t0), tb = sec(t1);
  for (const i of [0, 1, 2, 3, 4, 5]) lbeam(acc, F, ta[i], tb[i], w * 1.3, w * 1.3);
  const mA = [ta[0][0], (ta[0][1] + ta[1][1]) / 2, ta[0][2]], mB = [tb[0][0], (tb[0][1] + tb[1][1]) / 2, tb[0][2]];
  lbeam(acc, F, mA, mB, w, w);
  lbeam(acc, F, [mA[0], mA[1], -mA[2]], [mB[0], mB[1], -mB[2]], w, w);
}

function quadSide(acc, F, x0, x1, sd, yk, kb0, kb1, yA, h0, h1, U, V) {
  if (sd > 0) acc.quadP(F(x0, yk, kb0), F(x1, yk, kb1), F(x1, yA, h1), F(x0, yA, h0), [x0 / U, yk / V, x1 / U, yA / V]);
  else acc.quadP(F(x1, yk, -kb1), F(x0, yk, -kb0), F(x0, yA, -h0), F(x1, yA, -h1), [x1 / U, yk / V, x0 / U, yA / V]);
}

// ------------------------------------------------------------------ tugs

/** A harbour tug at the water level wl: black and red, white house, twin funnels. nameUV on signMat (optional). */
export function tugBoat(B, M, x, z, ry, wl, nameUV = null, signMat = null) {
  const F = frame(x, 0, z, ry);
  const pl = B.acc(M.plate), hs = B.acc(M.house), st = B.acc(M.paint), gl = B.acc(M.glow), mt = B.acc(M.matte);
  const L = 30, Bm = 10;
  hull(pl, frame(x, wl, z, ry), L, Bm, -4.2, 2.6, [[-0.2, C('#8a2a22')], [0.5, C('#1a1a1c')], [2.0, C('#1d1d20')], [null, C('#c8322a')]], { deckCol: C('#5a3a2a'), sheer: 1.6, hb: (t) => Bm / 2 * (t < 0.55 ? 0.94 + 0.06 * t / 0.55 : Math.sqrt(Math.max(0, 1 - Math.pow((t - 0.55) / 0.45, 2.4)))) });
  // tyre fenders down the sides, the bow fender
  col(mt, C('#141414'));
  for (let k = -3; k <= 3; k++) for (const sd of [-1, 1]) { const p = F(k * 3.4, wl + 1.0, sd * (Bm / 2 + 0.15)); mt.box(p[0], p[1], p[2], 1.0, 0.9, 0.35, ry); }
  lbox(mt, F, ry, L / 2 - 1.2, wl + 1.2, 0, 2.2, 1.6, 3.4, {});
  // the house and the wheelhouse with windows all round
  col(hs, C('#f0eee6'));
  lbox(hs, F, ry, 1.5, wl + 2.6, 0, 11, 3.2, 7.4, { u: 10, v: 10 });
  lbox(hs, F, ry, 3.2, wl + 5.8, 0, 5.4, 2.8, 6.4, { u: 10, v: 10 });
  col(gl, C('#ffe6b0', 1.5));
  lbox(gl, F, ry, 3.2, wl + 6.6, 0, 5.5, 1.3, 6.5, { top: false });
  col(st, C('#1a1a1a'));
  lbox(st, F, ry, 3.2, wl + 8.6, 0, 5.8, 0.3, 6.8, {});
  // funnels: red with black tops
  for (const sd of [-1, 1]) {
    col(st, C('#c8322a'));
    lbox(st, F, ry, -2.8, wl + 5.8, sd * 2.2, 1.6, 3.6, 1.2, {});
    col(st, C('#141414'));
    lbox(st, F, ry, -2.8, wl + 9.4, sd * 2.2, 1.7, 0.6, 1.3, {});
  }
  // the mast and its lights
  col(st, C('#e8e6de'));
  const m = F(4.4, wl + 8.9, 0);
  st.beam(m[0], m[1], m[2], m[0], m[1] + 4.5, m[2], 0.18, 0.18);
  col(gl, C('#ffffff', 3));
  gl.box(m[0], m[1] + 4.6, m[2], 0.35, 0.35, 0.35);
  col(gl, C('#ffae2a', 3));
  gl.box(m[0], m[1] + 3.6, m[2], 0.3, 0.3, 0.3);
  if (nameUV) {
    for (const sd of [1, -1]) {
      const p = F(1.5, wl + 4.5, sd * 3.73);
      panel(B.acc(signMat), p[0], p[1], p[2], 6.2, 1.1, ry + (sd > 0 ? 0 : Math.PI), nameUV);
    }
  }
}

// ------------------------------------------------------------------ trucks

/** A port truck: tractor unit + skeletal chassis (+ a box). it fields: x, z, y0, ry, box, cab colour. */
export function truck(B, M, x, y0, z, ry, rng, withBox = true) {
  const st = B.near(M.paint), gl = B.near(M.glow);
  const F = frame(x, y0, z, ry);
  const cab = C(rng.pick(['#c8322a', '#2a5a9a', '#e8e6de', '#2f6a3a', '#d8a21e', '#1c1c1e']));
  // tractor (at +x end)
  col(st, cab);
  lbox(st, F, ry, 7.4, 1.0, 0, 2.6, 2.8, 2.5, { u: 2 });
  col(st, DARK);
  lbox(st, F, ry, 8.3, 0.2, 0, 4.2, 0.9, 2.3, { u: 2 });
  lbox(st, F, ry, -0.5, 0.9, 0, 13.4, 0.35, 1.0, { u: 2 });
  for (const u of [-5.4, -4.2, 6.3, 9.0]) for (const w of [-1.05, 1.05]) lbox(st, F, ry, u, 0, w, 1.0, 1.0, 0.5, { u: 2 });
  col(gl, C('#fff2d0', 2.2));
  lbox(gl, F, ry, 8.72, 1.4, 0.8, 0.05, 0.3, 0.4, {});
  lbox(gl, F, ry, 8.72, 1.4, -0.8, 0.05, 0.3, 0.4, {});
  col(gl, C('#ff2020', 2));
  lbox(gl, F, ry, -7.2, 0.9, 0.9, 0.05, 0.25, 0.3, {});
  lbox(gl, F, ry, -7.2, 0.9, -0.9, 0.05, 0.25, 0.3, {});
  if (withBox) {
    const L = randomBox(rng);
    const p = F(-0.6, 0, 0);
    container(B.near(M.cont), p[0], y0 + 1.25, p[2], ry, L.row, L.tint);
  }
}

/** A loose chassis or a box on the ground (yard clutter). */
export function looseBox(B, M, x, y0, z, ry, rng, tiers = 1) {
  const L = randomBox(rng);
  container(B.acc(M.cont), x, y0, z, ry, L.row, L.tint, C40, 1);
  for (let k = 1; k < tiers; k++) {
    const L2 = randomBox(rng);
    container(B.acc(M.cont), x, y0 + k * CH, z, ry + (rng() - 0.5) * 0.03, L2.row, L2.tint, C40, 1);
  }
}

// ------------------------------------------------------------------ fences

/**
 * Chain-link fence along world [x, z] points, h high, on posts every ~3 m,
 * with barbed wire on top (security). it: { pts, h }.
 */
export function fence(B, M, pts, h = 2.6, barbed = true) {
  const mesh = B.acc(M.fence), post = B.acc(M.paint);
  let u = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], b = pts[i + 1];
    const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (L < 0.2) continue;
    const n = Math.max(1, Math.round(L / 3));
    for (let k = 0; k < n; k++) {
      const t0 = k / n, t1 = (k + 1) / n;
      const x0 = a[0] + (b[0] - a[0]) * t0, z0 = a[1] + (b[1] - a[1]) * t0;
      const x1 = a[0] + (b[0] - a[0]) * t1, z1 = a[1] + (b[1] - a[1]) * t1;
      const y0 = B.groundY(x0, z0), y1 = B.groundY(x1, z1);
      const du = L / n / 3;
      mesh.col = [1, 1, 1];
      mesh.quadP([x0, y0, z0], [x1, y1, z1], [x1, y1 + h, z1], [x0, y0 + h, z0], [u, 0, u + du, h / 3]);
      col(post, C('#8a8d90'));
      post.box(x0, y0 - 0.2, z0, 0.1, h + 0.5, 0.1);
      if (barbed) {
        col(post, C('#55585a'));
        post.beam(x0, y0 + h + 0.3, z0, x1, y1 + h + 0.3, z1, 0.04, 0.04);
        post.beam(x0, y0 + h + 0.5, z0, x1, y1 + h + 0.5, z1, 0.04, 0.04);
      }
      u += du;
    }
  }
}

// ------------------------------------------------------------------ materials

/** The coast kit's materials plus the port's: containers, hull plate, chain-link, ships' decks. */
export function portMats(B) {
  const M = mats(B);
  M.cont = cmat(B, 'cont', () => litMat({ map: containerAtlas(), vertexColors: true, roughness: 0.62, metalness: 0.25, envMapIntensity: 0.6 }));
  M.plate = cmat(B, 'plate', () => litMat({ map: plateTexture(), vertexColors: true, roughness: 0.6, metalness: 0.3, envMapIntensity: 0.6 }));
  M.fence = cmat(B, 'fence', () => litMat({ map: fenceTexture(), vertexColors: true, alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.6, metalness: 0.4 }, { shadow: false }));
  M.house = cmat(B, 'house', () => {
    const t = deckhouseTexture();
    return litMat({ map: t.map, emissive: 0xffffff, emissiveMap: t.emi, vertexColors: true, roughness: 0.7, envMapIntensity: 0.5 }, { night: 1.1 });
  });
  return M;
}

export { THREE, panel, tube, mixC };
