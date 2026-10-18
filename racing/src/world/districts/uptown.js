// PORT HALCYON — UPTOWN: old money and culture, up the hill from downtown.
// Side streets of brownstone and brick terraces with stoops, cornices,
// bay windows and a lamp by the door; corner apartment houses with doorman
// canopies; art deco towers on the boulevards and the Grand Concourse, set
// back in tiers to crowns floodlit gold, wooden water tanks on the roofs;
// grand hotels on Park Row looking over Halcyon Park; the City Museum's
// columns and steps on Park Boulevard; the Orpheum's bulb-chased marquee and
// blade sign; trees down every sidewalk and every boulevard median. The
// park: lawns, a pond, paths, the Mall lined with elms, the bandstand, an
// obelisk at the Concourse's head, park lamps, its wall and railings, and
// Park Drive winding through. The Concourse rides under the Victory Arch.
// Hidden: Belgrave Mews, a cobbled lane of carriage houses behind the
// terraces (off 4th Street, the block's middle), and the Boathouse on the
// park's pond, down a gravel lane off Park Drive.
import { litMat, drape, ribbon, hip } from './builder.js';
import { poleMat, darkConcreteMat } from '../kit.js';
import { groundTexture } from '../../track/textures.js';
import { windowMat, signalMat, blinkMat, nightGlowVC, chaseMat, waterMat, sharedMat } from './central/shaders.js';
import {
  rowhouseTex, ROW, decoTex, DECO, stoneTex, STONE, ashlarTex, boutiqueTex, utSignsTex, UT_SIGN_RECTS, signUV, glowOf,
  pondTex, hexTex, UT_STREET_SIGN, AWNINGS,
} from './central/paint.js';
import { walls, lid, block, panel, decal, tree, car, ring, disc, place, circle, polyWalls, polyCap, apex, toWorld, slope, blob, under, stairs, post, rod, paint, A, N } from './central/geo.js';
import { drawParts, drawTops } from './central/draw.js';
import { blockSide, cityJunctions, signalSpot, walkSidewalks, reachOf, frontLots, Spots, naturalGround } from './central/plan.js';
import { roadLamps } from '../build/roads.js';
import { ITEM } from './occ.js';
import { inPoly } from '../geom.js';
import * as THREE from 'three';

const ID = 'uptown';
const SPEC = {
  row: { uw: ROW.bays * 2.2, vh: ROW.floors * 3.4, floors: ROW.floors },
  deco: { uw: DECO.bays * 3, vh: DECO.floors * 3.5, floors: DECO.floors },
  crown: { uw: DECO.bays * 3, vh: DECO.floors * 3.5, floors: DECO.floors },
  stone: { uw: STONE.bays * 3.2, vh: STONE.floors * 3.8, floors: STONE.floors },
  shops: { uw: 24, vh: 9, floors: 1, rows: 2 },
};
// masonry tints: brownstone, red brick, cream brick, grey stone, painted white, sandstone, dark brick
const MASON = [[0.56, 0.4, 0.32], [0.56, 0.4, 0.32], [0.74, 0.4, 0.31], [0.74, 0.4, 0.31], [0.93, 0.84, 0.66], [0.72, 0.72, 0.7], [1, 0.98, 0.94], [0.84, 0.66, 0.48], [0.5, 0.3, 0.26]];
const TRIM = [[0.12, 0.1, 0.09], [0.1, 0.16, 0.12], [0.9, 0.88, 0.82], [0.32, 0.2, 0.14], [0.12, 0.14, 0.2]];
const DOOR = [[0.3, 0.12, 0.1], [0.1, 0.18, 0.12], [0.08, 0.08, 0.1], [0.36, 0.24, 0.12], [0.12, 0.16, 0.3]];
const DECO_T = [[1, 0.96, 0.86], [0.94, 0.8, 0.62], [0.84, 0.82, 0.8], [0.92, 0.74, 0.62], [1.02, 1.0, 0.96], [0.8, 0.72, 0.62]];
const STONE_T = [[1, 0.97, 0.9], [1.03, 1.02, 1.0], [0.9, 0.88, 0.84], [0.98, 0.9, 0.82]];
const hex = (t, base) => {
  const h = (v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0');
  return `#${h(base[0] * t[0])}${h(base[1] * t[1])}${h(base[2] * t[2])}`;
};

// the park's layout, kept for the scatter (planned once, read per cell);
// GROUNDS: claimed land the scatter may plant (the museum's), each with the
// rect to keep clear (the building and its steps)
let PARK = null;
const GROUNDS = [];

export default {
  id: ID,

  plan(P) {
    const ctx = { screenK: 0 };
    naturalGround(P);
    PARK = null;
    GROUNDS.length = 0;
    planPark(P, ctx);
    planMuseum(P, ctx);
    planTheatre(P, ctx);
    planArch(P, ctx);
    planMews(P, ctx);
    planParkRow(P, ctx);
    planCorners(P, ctx);
    planFlatirons(P, ctx);
    planFrontage(P, ctx);
    planEstates(P, ctx);
    planStreets(P, ctx);
  },

  scatter(S) {
    // trees in the park's groves and in the back gardens of the blocks
    const pk = PARK;
    for (const [x, z] of S.points(9, { clear: false, density: (px, pz) => (pk && inRect(pk.rect, px, pz) ? 0.5 + 0.5 * S.noise(px / 70, pz / 70) : 0.32) })) {
      if (pk && inRect(pk.rect, x, z)) {
        const R = pk.rect;
        if (x < R.x0 + 5 || x > R.x1 - 5 || z < R.z0 + 5 || z > R.z1 - 5) continue;
        if (S.occ.hitDisc(x, z, 4, 1) || inPoly(pk.pond, x, z) || nearPark(pk, x, z, 4)) continue;
      } else if (GROUNDS.some((g) => inRect(g, x, z))) {
        // the museum's grounds: trees round it, clear of the building and its steps
        if (S.occ.hitDisc(x, z, 4, 1) || GROUNDS.some((g) => g.keep && inRect(g.keep, x, z))) continue;
      } else if (!backyard(S, x, z)) continue;
      const y = S.groundY(x, z);
      const kind = S.pick(['elm', 'linden', 'plane', 'linden', 'pine']);
      const s = S.range(0.8, 1.25);
      S.add({ type: 'tree', kind, x, z, y, s, t: S.rng() });
      S.collider({ kind: 'circle', x, z, r: 0.45 * s, y0: y - 1, y1: y + 7 });
    }
  },

  warm(B) {
    mats(B);
  },

  *build(B, items) {
    const M = mats(B);
    let t0 = performance.now();
    for (const it of items) {
      switch (it.type) {
        case 'row': drawRow(B, it, M); break;
        case 'bldg': drawParts(B, it, M); drawTops(B, it, M); drawUpTops(B, it, M); drawDoorman(B, it, M); drawAwnings(B, it, M); break;
        case 'museum': drawMuseum(B, it, M); break;
        case 'theatre': drawTheatre(B, it, M); break;
        case 'arch': drawArch(B, it, M); break;
        case 'obelisk': drawObelisk(B, it, M); break;
        case 'lawn': drawLawn(B, it, M); break;
        case 'path': drawPath(B, it, M); break;
        case 'pond': drawPond(B, it, M); break;
        case 'bandstand': drawBandstand(B, it, M); break;
        case 'statue': drawStatue(B, it, M); break;
        case 'wall': drawParkWall(B, it, M); break;
        case 'plamp': drawParkLamp(B, it, M); break;
        case 'bench': drawBench(B, it, M); break;
        case 'tree': drawTree(B, it, M); break;
        case 'signal': drawSignal(B, it, M); break;
        case 'sf': drawFurniture(B, it, M); break;
        case 'carriage': drawCarriage(B, it, M); break;
        case 'coach': drawCoachHouse(B, it, M); break;
        case 'boathouse': drawBoathouse(B, it, M); break;
        default: break;
      }
      // (a few milliseconds a step: the streamer runs a step a frame)
      if (performance.now() - t0 > 2.5) { yield; t0 = performance.now(); }
    }
  },
};

const inRect = (r, x, z) => x >= r.x0 && x <= r.x1 && z >= r.z0 && z <= r.z1;

/** Scatter: a back garden (inside a block, away from every road and building). */
function backyard(S, x, z) {
  return S.free(x, z, 5, true) && !S.occ.hitDisc(x, z, 7, ITEM | 1);
}

/** Near the park's built things (paths, features) within r? */
function nearPark(pk, x, z, r) {
  for (const f of pk.keep) if (Math.hypot(f[0] - x, f[1] - z) < f[2] + r) return true;
  for (const p of pk.paths) {
    for (let k = 0; k < p.pts.length - 1; k++) {
      const a = p.pts[k], b = p.pts[k + 1];
      const dx = b[0] - a[0], dz = b[1] - a[1], l2 = dx * dx + dz * dz || 1;
      const t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / l2));
      if (Math.hypot(a[0] + dx * t - x, a[1] + dz * t - z) < p.w / 2 + r) return true;
    }
  }
  return false;
}

// =====================================================================
// planning
// =====================================================================

/** HALCYON PARK: lawns, the pond, paths and the Mall, the bandstand, the obelisk, lamps, its wall. */
function planPark(P, ctx) {
  const n11 = P.net.nodes.get('u_1_1'), n13 = P.net.nodes.get('u_1_3');
  const n01 = P.net.nodes.get('u_0_1'), n21 = P.net.nodes.get('u_2_1');
  if (!n11 || !n13 || !n01 || !n21) return;
  const gx0 = n01.x, gx1 = n21.x, gz0 = n11.z, gz1 = n13.z;
  const N = blockSide(P, 'x', gz0, gx0, gx1, 1), S = blockSide(P, 'x', gz1, gx0, gx1, -1);
  const Wd = blockSide(P, 'z', gx0, gz0, gz1, 1), E = blockSide(P, 'z', gx1, gz0, gz1, -1);
  const rect = { x0: Wd.edge + 0.6, x1: E.edge - 0.6, z0: N.edge + 0.6, z1: S.edge - 0.6 };
  P.claim((rect.x0 + rect.x1) / 2, (rect.z0 + rect.z1) / 2, rect.x1 - rect.x0, rect.z1 - rect.z0, 0);
  const pk = { rect, paths: [], keep: [], pond: [] };
  PARK = pk;
  const W = rect.x1 - rect.x0, D = rect.z1 - rect.z0;
  const at = (u, v) => [rect.x0 + W * u, rect.z0 + D * v];
  // lawns: the whole park, cut at cell lines
  const cuts = (a, b) => { const o = [a]; for (let k = Math.ceil(a / 256) * 256; k < b; k += 256) o.push(k); o.push(b); return o; };
  const xs = cuts(rect.x0, rect.x1), zs = cuts(rect.z0, rect.z1);
  for (let i = 0; i < xs.length - 1; i++) for (let j = 0; j < zs.length - 1; j++) {
    P.add({ type: 'lawn', x: (xs[i] + xs[i + 1]) / 2, z: (zs[j] + zs[j + 1]) / 2, poly: [[xs[i], zs[j]], [xs[i + 1], zs[j]], [xs[i + 1], zs[j + 1]], [xs[i], zs[j + 1]]], map: 'park' });
  }
  // the pond in the west, a stone edge round it
  const [pcx, pcz] = at(0.2, 0.52);
  const pond = [];
  for (let k = 0; k < 18; k++) {
    const a = (k / 18) * Math.PI * 2;
    const r = 1 + 0.18 * Math.sin(a * 3 + 0.7) + 0.1 * Math.sin(a * 5 + 2.1);
    pond.push([pcx + Math.cos(a) * 50 * r, pcz + Math.sin(a) * 30 * r]);
  }
  pk.pond = pond;
  P.add({ type: 'pond', x: pcx, z: pcz, poly: pond, gy: P.groundY(pcx, pcz), map: 'water' });
  pk.keep.push([pcx, pcz, 60]);
  // the boathouse on the pond's east shore, at the end of Boathouse Lane
  // (its front looks back up the lane, its dock runs out over the water)
  const boat = planBoathouse(P, pk, P.groundY(pcx, pcz));
  // the paths: round the pond, gate to gate, the Mall up to the bandstand
  const bx = at(0.82, 0.48), sGate = at(0.82, 1.0), nGate = at(0.82, 0.0);
  const loop = [];
  for (let k = 0; k <= 24; k++) {
    const a = (k / 24) * Math.PI * 2;
    loop.push([pcx + Math.cos(a) * 72, pcz + Math.sin(a) * 46]);
  }
  const paths = [
    { pts: loop, w: 4 },
    { pts: [sGate, [sGate[0], sGate[1] - 18], [bx[0], bx[1] + 16]], w: 9, mall: true },
    { pts: [nGate, [bx[0], bx[1] - 16]], w: 4 },
    { pts: [at(0, 1), at(0.07, 0.9), [pcx + 20, pcz + 44]], w: 4 },
    { pts: [at(0.0, 0.15), [pcx - 40, pcz - 38]], w: 4 },
    { pts: [[pcx + 72, pcz], at(0.38, 0.5), at(0.5, 0.62), [bx[0] - 16, bx[1]]], w: 4 },
    { pts: [at(1, 0.2), [bx[0] + 14, bx[1] - 10]], w: 4 },
  ];
  for (const p of paths) {
    // keep each path off the park drive (cut it where the drive runs)
    const keep = [];
    let cur = [];
    for (const q of resamplePts(p.pts, 3)) {
      const onRoad = (P.occ.get(q[0], q[1]) & 1) || (boat && boat.covers(q[0], q[1], 2));
      if (onRoad) { if (cur.length > 1) keep.push(cur); cur = []; continue; }
      cur.push(q);
    }
    if (cur.length > 1) keep.push(cur);
    for (const seg of keep) {
      const mid = seg[Math.floor(seg.length / 2)];
      P.add({ type: 'path', x: mid[0], z: mid[1], pts: seg, w: p.w, map: 'park' });
    }
    pk.paths.push(p);
  }
  // the Mall's elms, both sides, and benches between them
  const mall = paths[1];
  const [m0, , m2] = mall.pts;
  const mlen = Math.hypot(m2[0] - m0[0], m2[1] - m0[1]);
  const mdx = (m2[0] - m0[0]) / mlen, mdz = (m2[1] - m0[1]) / mlen;
  for (let s = 14; s < mlen - 6; s += 11) {
    for (const sd of [-1, 1]) {
      const x = m0[0] + mdx * s - mdz * sd * 7.5, z = m0[1] + mdz * s + mdx * sd * 7.5;
      const y = P.groundY(x, z);
      P.add({ type: 'tree', kind: 'elm', x, z, y, s: P.range(1.0, 1.2), t: P.rng() });
      P.collider({ kind: 'circle', x, z, r: 0.5, y0: y - 1, y1: y + 8 });
      if (Math.round(s / 11) % 2) P.add({ type: 'bench', x: x + mdz * sd * 2.4, z: z - mdx * sd * 2.4, y, ry: Math.atan2(mdz * sd, -mdx * sd) });
    }
  }
  pk.keep.push([sGate[0], sGate[1] - mlen / 2, 10]);
  // the bandstand at the Mall's head
  {
    const [x, z] = bx;
    const gy = P.groundY(x, z);
    P.add({ type: 'bandstand', x, z, gy, r: 8 });
    P.collider({ kind: 'circle', x, z, r: 8.4, y0: gy - 1, y1: gy + 9 });
    P.lamp({ x, z, hy: gy + 4.2, color: '#ffd28a', radius: 16, intensity: 0.9, halo: 0 });
    pk.keep.push([x, z, 14]);
  }
  // a statue at the south gate, the obelisk where the Concourse looks in
  {
    const [x, z] = [sGate[0], sGate[1] - 9];
    const gy = P.groundY(x, z);
    P.add({ type: 'statue', x, z, gy, ry: Math.PI * 0 });
    P.collider({ kind: 'box', x, z, hx: 2.2, hz: 2.2, ry: 0, y0: gy - 1, y1: gy + 8 });
    P.lamp({ x, z: z + 3.5, hy: gy + 0.5, color: '#ffe8c0', radius: 9, intensity: 0.8, halo: 0 });
    pk.keep.push([x, z, 6]);
  }
  {
    const x = rect.x0 + 18, z = rect.z1 - 18;
    const gy = P.groundY(x, z);
    P.add({ type: 'obelisk', x, z, gy, h: 34 });
    P.landmark({ id: 'ut_obelisk', name: 'THE OBELISK', x, z, r: 20, kind: 'monument' });
    P.collider({ kind: 'box', x, z, hx: 3.2, hz: 3.2, ry: 0, y0: gy - 1, y1: gy + 34 });
    P.far({ shape: 'box', x, z, y: gy - 1, w: 3, d: 3, h: 35, color: '#c8bca4', lit: 0 });
    for (const [a, b] of [[-1, -1], [1, 1]]) P.lamp({ x: x + a * 5, z: z + b * 5, hy: gy + 0.4, color: '#ffe0b0', radius: 10, intensity: 0.8, halo: 0 });
    pk.keep.push([x, z, 7]);
  }
  // lamps along the paths and the drive
  const lampAt = (x, z) => {
    if (!inRect(rect, x, z) || inPoly(pond, x, z)) return;
    const y = P.groundY(x, z);
    P.add({ type: 'plamp', x, z, y });
    P.collider({ kind: 'circle', x, z, r: 0.22, y0: y - 1, y1: y + 4 });
    P.lamp({ x, z, hy: y + 3.9, color: '#ffc97a', radius: 13, intensity: 0.85, halo: 1.3 });
  };
  for (const p of paths) {
    const pts = resamplePts(p.pts, 26);
    pts.forEach((q, k) => {
      if (k === 0) return;
      const a = pts[k - 1];
      const dx = q[0] - a[0], dz = q[1] - a[1], l = Math.hypot(dx, dz) || 1;
      const off = (p.w / 2 + 1.2) * (k % 2 ? 1 : -1);
      lampAt(q[0] - dz / l * off, q[1] + dx / l * off);
    });
  }
  const drive = P.net.byId.get('xc_parkdrive'), drive2 = P.net.byId.get('xc_parkdrive_s');
  for (const r of [drive, drive2, P.net.byId.get('xc_boatlane')]) {
    if (!r) continue;
    const step = r === drive || r === drive2 ? 32 : 26;
    for (let s = r.trim0 + 16, k = 0; s < r.length - r.trim1 - 8; s += step, k++) {
      const side = k % 2 ? 1 : -1;
      const p = r.posAt(s, side * (r.rt.hw + r.rt.shoulder + 1.6));
      lampAt(p.x, p.z);
    }
  }
  // the wall: a stone kerb and railings round the park, open at the gates
  const gates = [nGate, sGate, at(0, 1), at(0, 0.15), at(1, 0.2)];
  if (drive) gates.push([drive.X[0], drive.Z[0]]);
  if (drive2) gates.push([drive2.X[drive2.N - 1], drive2.Z[drive2.N - 1]]);
  const wallRun = (ax, az, bx2, bz2) => {
    // split at gates (an 8 m gap round each), then by cell (each its own item)
    const len = Math.hypot(bx2 - ax, bz2 - az), tx = (bx2 - ax) / len, tz = (bz2 - az) / len;
    const cuts2 = [];
    for (const g of gates) {
      const s = (g[0] - ax) * tx + (g[1] - az) * tz;
      const lat = Math.abs((g[0] - ax) * -tz + (g[1] - az) * tx);
      if (lat < 14 && s > -6 && s < len + 6) cuts2.push([s - 7, s + 7]);
    }
    cuts2.sort((p, q) => p[0] - q[0]);
    let s = 0;
    const runs = [];
    for (const [c0, c1] of cuts2) { if (c0 > s + 2) runs.push([s, c0]); s = Math.max(s, c1); }
    if (len > s + 2) runs.push([s, len]);
    for (const [r0, r1] of runs) {
      for (let a = r0; a < r1 - 1; a += 60) {
        const b = Math.min(r1, a + 60);
        const x0 = ax + tx * a, z0 = az + tz * a, x1 = ax + tx * b, z1 = az + tz * b;
        if (P.occ.get((x0 + x1) / 2, (z0 + z1) / 2) & 1) continue;
        const y = Math.min(P.groundY(x0, z0), P.groundY(x1, z1));
        P.add({ type: 'wall', x: (x0 + x1) / 2, z: (z0 + z1) / 2, x0, z0, x1, z1, y });
        P.collider({ kind: 'box', x: (x0 + x1) / 2, z: (z0 + z1) / 2, hx: (b - a) / 2, hz: 0.35, ry: Math.atan2(tx, tz) + Math.PI / 2, y0: y - 1, y1: y + 1.6 });
      }
    }
  };
  const e = 0.8;
  wallRun(rect.x0 + e, rect.z0 + e, rect.x1 - e, rect.z0 + e);
  wallRun(rect.x1 - e, rect.z0 + e, rect.x1 - e, rect.z1 - e);
  wallRun(rect.x1 - e, rect.z1 - e, rect.x0 + e, rect.z1 - e);
  wallRun(rect.x0 + e, rect.z1 - e, rect.x0 + e, rect.z0 + e);
  // a horse and carriage waiting at the south gate
  {
    const [x, z] = [sGate[0] + 14, sGate[1] - 9];
    const y = P.groundY(x, z);
    P.add({ type: 'carriage', x, z, y, ry: Math.PI / 2 });
    P.collider({ kind: 'box', x, z, hx: 1.1, hz: 3.6, ry: Math.PI / 2, y0: y - 1, y1: y + 2.6 });
  }
  void ctx;
}

/**
 * THE BOATHOUSE (hidden): Park Drive's gravel lane ends at it, on the pond's
 * east shore: a timber pavilion on a stone plinth under a copper hip roof,
 * a lantern cupola, string lights along its eaves, rowboats at its dock.
 */
function planBoathouse(P, pk, wy) {
  const nb = P.net.nodes.get('xc_boat'), na = P.net.nodes.get('xc_pk');
  if (!nb || !na) return null;
  const fl = Math.hypot(na.x - nb.x, na.z - nb.z) || 1;
  const fx = (na.x - nb.x) / fl, fz = (na.z - nb.z) / fl;
  const ry = Math.atan2(fx, fz);
  const w = 16, d = 10, dock = 9;
  // its back on the shore: where the lane's line meets the pond
  let shore = Infinity;
  for (let i = 0; i < pk.pond.length; i++) {
    const a = pk.pond[i], b = pk.pond[(i + 1) % pk.pond.length];
    const ex = b[0] - a[0], ez = b[1] - a[1], den = -fx * ez + fz * ex;
    if (Math.abs(den) < 1e-9) continue;
    const t = ((a[0] - nb.x) * ez - (a[1] - nb.z) * ex) / den;
    const u = ((a[0] - nb.x) * -fz + (a[1] - nb.z) * fx) / den;
    if (t > 0 && u >= 0 && u <= 1) shore = Math.min(shore, t);
  }
  const back = shore < 40 ? Math.max(6 + d, shore) : 7 + d;
  const x = nb.x - fx * (back - d / 2), z = nb.z - fz * (back - d / 2);
  const gy = P.groundY(x, z);
  const c = Math.cos(ry), sn = Math.sin(ry);
  const covers = (qx, qz, pad) => {
    const dx = qx - x, dz = qz - z;
    const lx = dx * c - dz * sn, lz = dx * sn + dz * c;
    return Math.abs(lx) < w / 2 + pad && lz < d / 2 + pad && lz > -d / 2 - dock - pad;
  };
  P.claim(x - fx * dock / 2, z - fz * dock / 2, w + 2, d + dock + 2, ry);
  P.add({ type: 'boathouse', x, z, ry, w, d, gy, wy, dock, map: 'building' });
  P.collider({ kind: 'box', x, z, hx: w / 2, hz: d / 2, ry, y0: gy - 1, y1: gy + 9 });
  const kx = x - fx * (d / 2 + dock / 2), kz = z - fz * (d / 2 + dock / 2);
  P.collider({ kind: 'box', x: kx, z: kz, hx: 3, hz: dock / 2, ry, y0: wy - 1, y1: wy + 0.75 });
  // the porch lamp, the dock's lantern, the cupola's glow
  P.lamp({ x: x + fx * (d / 2 + 1.5), z: z + fz * (d / 2 + 1.5), hy: gy + 3.6, color: '#ffcf8a', radius: 11, intensity: 0.5, halo: 1 });
  P.lamp({ x: x - fx * (d / 2 + dock - 0.6), z: z - fz * (d / 2 + dock - 0.6), hy: wy + 2.6, color: '#ffc070', radius: 10, intensity: 0.6, halo: 1.2 });
  P.far({ shape: 'box', x, z, y: gy, w, d, h: 6.6, ry, color: '#d8ccb0', lit: 0.3 });
  pk.keep.push([x, z, 13], [kx, kz, 7]);
  P.landmark({ id: 'ut_boathouse', name: 'THE BOATHOUSE', x, z, r: 25, hidden: true, kind: 'boathouse' });
  return { x, z, covers };
}

function resamplePts(pts, step) {
  const out = [pts[0]];
  for (let k = 0; k < pts.length - 1; k++) {
    const a = pts[k], b = pts[k + 1];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const n = Math.max(1, Math.round(len / step));
    for (let i = 1; i <= n; i++) out.push([a[0] + (b[0] - a[0]) * i / n, a[1] + (b[1] - a[1]) * i / n]);
  }
  return out;
}

/** THE CITY MUSEUM on Park Boulevard: a portico of columns at the top of its steps, a dome. */
function planMuseum(P, ctx) {
  const a = P.net.nodes.get('u_3_3'), b = P.net.nodes.get('u_4_4');
  if (!a || !b) return;
  const N = blockSide(P, 'x', a.z, a.x, b.x, 1), S = blockSide(P, 'x', b.z, a.x, b.x, -1);
  const Wd = blockSide(P, 'z', a.x, a.z, b.z, 1), E = blockSide(P, 'z', b.x, a.z, b.z, -1);
  const x0 = Wd.edge + 0.6, x1 = E.edge - 0.6, z0 = N.edge + 0.6, z1 = S.edge - 0.6;
  const w = Math.min(150, x1 - x0 - 16), steps = 20;
  const d = Math.min(84, z1 - z0 - steps - 2);
  const x = (x0 + x1) / 2, z = z1 - steps - d / 2;
  const gy = P.groundY(x, z1);
  const top = gy + 26;
  P.claim(x, (z0 + z1) / 2, x1 - x0, z1 - z0, 0);
  GROUNDS.push({ x0: x0 + 3, x1: x1 - 3, z0: z0 + 3, z1: z1 - 3, keep: { x0: x - w / 2 - 6, x1: x + w / 2 + 6, z0: z - d / 2 - 6, z1: z1 } });
  P.add({ type: 'museum', x, z, w, d, gy, top, steps, front: z1, map: 'building' });
  P.collider({ kind: 'box', x, z, hx: w / 2, hz: d / 2, ry: 0, y0: gy - 2, y1: top });
  P.collider({ kind: 'box', x, z: z + d / 2 + steps / 2, hx: 34, hz: steps / 2, ry: 0, y0: gy - 2, y1: gy + 3.6 });
  for (const sd of [-1, 1]) P.collider({ kind: 'circle', x: x + sd * 44, z: z1 - 6, r: 4.6, y0: gy - 1, y1: gy + 1.2 });
  P.far({ shape: 'box', x, z, y: gy - 2, w, d, h: top - gy + 2, color: '#d0c6b0', lit: 0.1 });
  P.far({ shape: 'cyl', x, z, y: top, r: 15, h: 12, color: '#6a9e8a', lit: 0 });
  // floodlights on the portico and the steps
  for (const sd of [-1, 0, 1]) P.lamp({ x: x + sd * 22, z: z1 - 2, hy: gy + 1, color: '#ffe6c0', radius: 24, intensity: 0.6, halo: 0 });
  for (const sd of [-1, 1]) P.lamp({ x: x + sd * 44, z: z1 - 6, hy: gy + 1.3, color: '#bfe0ff', radius: 9, intensity: 0.7, halo: 0 });
  void ctx;
}

/** THE ORPHEUM: an old picture palace on Park Boulevard, its marquee chasing bulbs, its blade sign. */
function planTheatre(P, ctx) {
  const a = P.net.nodes.get('u_4_4'), b = P.net.nodes.get('u_5_5');
  if (!a || !b) return;
  const N = blockSide(P, 'x', a.z, a.x, b.x, 1);
  const Wd = blockSide(P, 'z', a.x, a.z, b.z, 1);
  const w = 34, d = 62;
  const x = Wd.edge + 0.6 + 70, z = N.edge + 0.6 + d / 2;
  if (!P.isFree(x, z, w - 3, d - 3, Math.PI, { pad: 0 })) return;
  P.claim(x, z, w, d, Math.PI);
  const g = P.groundRange(x, z, w, d, Math.PI);
  const gy = g.lo;
  // its front faces north, onto Park Blvd
  P.add({ type: 'theatre', x, z, w, d, ry: Math.PI, gy, map: 'building' });
  P.collider({ kind: 'box', x, z, hx: w / 2, hz: d / 2, ry: Math.PI, y0: gy - 2, y1: gy + 40 });
  P.far({ shape: 'box', x, z, y: gy - 2, w, d, h: 26, ry: Math.PI, color: '#a8846a', lit: 0.1 });
  P.far({ shape: 'box', x, z: z + 12, y: gy + 24, w: w - 6, d: 22, h: 14, ry: Math.PI, color: '#8a6a56', lit: 0 });
  P.lamp({ x, z: z - d / 2 - 4, hy: gy + 4.2, color: '#ffd890', radius: 20, intensity: 0.85, halo: 2.6 });
  for (const sd of [-1, 1]) P.collider({ kind: 'box', x: x + sd * (w / 2 + 2.5), z: z - d / 2 - 2.6, hx: 0.8, hz: 1.2, ry: Math.PI, y0: gy - 1, y1: gy + 1.8 });
  P.lamp({ x: x - w / 2 + 3, z: z - d / 2 - 2, hy: gy + 16, color: '#ff4a3a', radius: 6, intensity: 0.4, halo: 3 });
  P.landmark({ id: 'ut_orpheum', name: 'THE ORPHEUM', x, z: z - d / 2, r: 30, kind: 'theatre' });
  void ctx;
}

/** THE VICTORY ARCH across the Grand Concourse (the road runs through it), floodlit. */
function planArch(P, ctx) {
  const r = P.net.roads.find((q) => q.spec.id === 'u_concourse~7') || P.net.roads.filter((q) => q.name === 'GRAND CONCOURSE').sort((p, q) => q.length - p.length)[0];
  if (!r) return;
  const s = r.length * 0.42;
  const p = r.posAt(s);
  const i = p.i;
  const ry = Math.atan2(r.TX[i], r.TZ[i]);
  const half = r.rt.hw + r.rt.shoulder + 1.6;      // the opening clears the carriageway
  const pier = 5.5, depth = 9, H = 26;
  const gy = r.roadY(i, p.t, 0);
  // (no map footprint: it stands over the road)
  P.add({ type: 'arch', x: p.x, z: p.z, ry, gy, half, pier, depth, H });
  for (const sd of [-1, 1]) {
    const lat = sd * (half + pier / 2);
    const cx = p.x + r.LX[i] * lat, cz = p.z + r.LZ[i] * lat;
    P.collider({ kind: 'box', x: cx, z: cz, hx: pier / 2, hz: depth / 2, ry, y0: gy - 2, y1: gy + H });
    P.claim(cx, cz, pier + 2, depth + 4, ry);
    for (const fz of [-1, 1]) P.lamp({ x: cx + r.TX[i] * fz * (depth / 2 + 4), z: cz + r.TZ[i] * fz * (depth / 2 + 4), hy: gy + 0.5, color: '#ffe6c0', radius: 16, intensity: 0.55, halo: 0 });
  }
  // (each box collider: hx across the road, hz along it; ry is the road's heading)
  P.far({ shape: 'box', x: p.x, z: p.z, y: gy - 2, w: 2 * (half + pier), d: depth, h: H + 2, ry, color: '#d4c8b0', lit: 0 });
  P.landmark({ id: 'ut_arch', name: 'VICTORY ARCH', x: p.x, z: p.z, r: 30, kind: 'monument' });
  void ctx;
}

/** BELGRAVE MEWS: carriage houses down both cobbled lanes off the street. */
function planMews(P, ctx) {
  const pieces = P.net.roads.filter((r) => r.spec.id.startsWith('xc_mews'));
  for (const r of pieces) {
    const L = r.length;
    const deadAtB = r.b.kind === 'dead';
    for (const side of [1, -1]) {
      let s = (deadAtB ? r.trim0 + 4 : 6);
      const s1 = deadAtB ? L - 2 : L - r.trim1 - 4;
      while (s < s1 - 6) {
        const w = P.pick([7, 8, 9]);
        const p = r.posAt(s + w / 2, side * (reachOf(r.rt) + 5.5));
        const i = p.i;
        const ry = Math.atan2(-side * r.LX[i], -side * r.LZ[i]);
        if (P.isFree(p.x, p.z, w - 0.5, 9, ry, { pad: -0.4 })) {
          P.claim(p.x, p.z, w, 10, ry);
          const g = P.groundRange(p.x, p.z, w, 10, ry);
          P.add({ type: 'coach', x: p.x, z: p.z, ry, w, d: 10, gy: g.lo, h: 7.2, tint: P.pick(MASON), door: P.pick(DOOR), seed: Math.floor(P.rng() * 180), map: 'building' });
          P.collider({ kind: 'box', x: p.x, z: p.z, hx: w / 2, hz: 5, ry, y0: g.lo - 1, y1: g.hi + 8 });
          P.far({ x: p.x, z: p.z, y: g.lo - 1, w, d: 10, h: 9, ry, color: '#8a5a44', lit: 0.25 });
          if (P.rng() < 0.35) P.lamp({ x: p.x, z: p.z, hx: p.x + Math.sin(ry) * 5.4, hz: p.z + Math.cos(ry) * 5.4, hy: g.lo + 3, color: '#ffc070', radius: 7, intensity: 0.6, halo: 1 });
        }
        s += w + 0.05;
      }
    }
    const end = deadAtB ? r.b : r.a;
    if (end.kind === 'dead' && end.id === 'xc_m0') P.landmark({ id: 'ut_mews', name: 'BELGRAVE MEWS', x: end.x, z: end.z, r: 25, hidden: true, kind: 'lane' });
  }
  void ctx;
}

/** Park Row: grand hotels and apartment houses facing the park across its streets. */
function planParkRow(P, ctx) {
  const pk = PARK;
  if (!pk) return;
  const near = (r) => {
    const m = Math.floor(r.N / 2);
    const x = r.X[m], z = r.Z[m];
    const R = pk.rect;
    return x > R.x0 - 40 && x < R.x1 + 40 && z > R.z0 - 40 && z < R.z1 + 40 && !inRect(R, x, z);
  };
  const lots = frontLots(P, P.roads((r) => near(r) && r.rt.walk > 0), { width: () => P.range(38, 56), depths: [40, 34], gap: () => P.range(0, 2), setback: 0.6, pad: -0.6, skip: 8 });
  const names = ['royale', 'belmont', 'astoria'];
  let hk = 0;
  for (const L of lots) {
    const hotel = hk < names.length && L.w > 44 && P.rng() < 0.55;
    if (hotel) makeHotel(P, L, names[hk++], ctx);
    else makeDeco(P, L, P.range(54, 96), ctx, { grand: true });
  }
}

/** The corner apartment houses at the junctions of the grid. */
function planCorners(P, ctx) {
  for (const n of cityJunctions(P)) {
    const E = n.ends;
    if (E.some((e) => e.road.name === 'GRAND CONCOURSE' || e.road.spec.id.startsWith('xc_'))) continue;
    for (let k = 0; k < E.length; k++) {
      const e = E[k], f = E[(k + 1) % E.length];
      // only square corners (perpendicular ends)
      if (Math.abs(e.dx * f.dx + e.dz * f.dz) > 0.2) continue;
      const big = Math.max(e.road.rt.walk > 4 ? 1 : 0, f.road.rt.walk > 4 ? 1 : 0);
      if (P.rng() > (big ? 0.7 : 0.38)) continue;
      const re = reachOf(e.road.rt), rf = reachOf(f.road.rt);
      const a = P.range(22, 30), b = P.range(20, 26);
      // e's direction along a, f's along b, from the block's corner
      const kx = n.x + e.dx * (rf + 0.6) + f.dx * (re + 0.6), kz = n.z + e.dz * (rf + 0.6) + f.dz * (re + 0.6);
      const cx = kx + e.dx * a / 2 + f.dx * b / 2, cz = kz + e.dz * a / 2 + f.dz * b / 2;
      // its front on the bigger road: facing back across f's offset toward e's line
      const frontE = (e.road.rt.walk >= f.road.rt.walk);
      const ry = frontE ? Math.atan2(-f.dx, -f.dz) : Math.atan2(-e.dx, -e.dz);
      const w = frontE ? a : b, d = frontE ? b : a;
      if (!P.isFree(cx, cz, w - 3.4, d - 3.4, ry, { pad: 0 })) continue;
      P.claim(cx, cz, w, d, ry);
      const L = { x: cx, z: cz, ry, w, d, corner: true };
      makeDeco(P, L, big ? P.range(30, 62) : P.range(22, 38), ctx, { corner: true });
    }
  }
}

/**
 * Flatirons: where the Grand Concourse meets the grid at a sharp angle, a
 * wedge of a building fills the corner between the two sidewalks, its prow
 * blunted toward the junction, gold lights round its cornice at night.
 */
function planFlatirons(P, ctx) {
  for (const n of P.net.nodes.values()) {
    if (n.kind !== 'junction' || !P.inside(n.x, n.z, 20)) continue;
    const E = n.ends;
    if (!E.some((e) => e.road.name === 'GRAND CONCOURSE')) continue;
    for (let k = 0; k < E.length; k++) {
      const e = E[k], f = E[(k + 1) % E.length];
      const cosA = e.dx * f.dx + e.dz * f.dz;
      if (cosA < 0.55) continue;
      // each road's outer sidewalk edge on the side facing the other
      let nex = -e.dz, nez = e.dx;
      if (nex * f.dx + nez * f.dz < 0) { nex = -nex; nez = -nez; }
      let nfx = -f.dz, nfz = f.dx;
      if (nfx * e.dx + nfz * e.dz < 0) { nfx = -nfx; nfz = -nfz; }
      const re = reachOf(e.road.rt) + 0.8, rf = reachOf(f.road.rt) + 0.8;
      // the tip: where the two edge lines meet (t along e, s along f)
      const bx = nfx * rf - nex * re, bz = nfz * rf - nez * re;
      const det = e.dx * -f.dz - e.dz * -f.dx;
      if (Math.abs(det) < 1e-3) continue;
      const t = (bx * -f.dz - bz * -f.dx) / det;
      const kx = n.x + nex * re + e.dx * t, kz = n.z + nez * re + e.dz * t;
      const blunt = 3;
      let placed = null;
      for (const L of [58, 48, 38, 30]) {
        const poly = [
          [kx + e.dx * blunt, kz + e.dz * blunt], [kx + e.dx * L, kz + e.dz * L],
          [kx + f.dx * L, kz + f.dz * L], [kx + f.dx * blunt, kz + f.dz * blunt],
        ];
        if (wedgeFree(P, poly)) { placed = { poly, L }; break; }
      }
      if (!placed) continue;
      const { poly, L } = placed;
      const cx = poly.reduce((a, p) => a + p[0], 0) / 4, cz = poly.reduce((a, p) => a + p[1], 0) / 4;
      const local = poly.map(([x, z]) => [x - cx, z - cz]);
      let lo = Infinity;
      for (const p of poly) lo = Math.min(lo, P.groundY(p[0], p[1]));
      const gy = lo;
      const H = P.range(40, 88);
      const st = 3.5, top = gy + 4.5 + Math.round((H - 4.5) / st) * st;
      const tint = P.pick(DECO_T);
      const it = {
        type: 'bldg', x: cx, z: cz, ry: 0, w: L, d: L, gy, y0: gy - 1.6, seed: Math.floor(P.rng() * 180), seedV: Math.floor(P.rng() * 16), map: 'building',
        parts: [
          { s: 'poly', poly: local, y0: gy - 0.25, y1: gy + 4.5, m: 'shops', band: P.rng() < 0.5 ? 1 : 0, lid: false },
          { s: 'poly', poly: local, y0: gy + 4.5, y1: top - 2 * st, m: 'deco', tint, led: null },
          { s: 'poly', poly: local, y0: top - 2 * st, y1: top, m: P.rng() < 0.5 ? 'crown' : 'deco', tint: [1, 0.92, 0.75], led: 'g' },
        ],
        tops: [],
      };
      P.add(it);
      // solid: the wedge in slices along its axis
      const ax = (e.dx + f.dx), az = (e.dz + f.dz), al = Math.hypot(ax, az) || 1;
      const ux = ax / al, uz = az / al;
      const half = Math.sqrt((1 - cosA) / 2) / Math.sqrt((1 + cosA) / 2);   // tan(θ/2)
      for (const [u0, u1] of [[blunt, L * 0.4], [L * 0.4, L * 0.7], [L * 0.7, L * 0.95]]) {
        const um = (u0 + u1) / 2, hw = um * half;
        const px = kx + ux * um, pz = kz + uz * um;
        P.collider({ kind: 'box', x: px, z: pz, hx: hw, hz: (u1 - u0) / 2, ry: Math.atan2(ux, uz), y0: it.y0, y1: top + 1 });
        P.far({ x: px, z: pz, y: it.y0, w: hw * 2, d: u1 - u0, h: top - it.y0, ry: Math.atan2(ux, uz), color: hex(tint, [200, 186, 160]), lit: 0.36 });
        P.claim(px, pz, hw * 2, u1 - u0, Math.atan2(ux, uz));
      }
      P.lamp({ x: kx + ux * 6, z: kz + uz * 6, hy: top + 1, color: '#ffcf7a', radius: 4, intensity: 0.2, halo: 3.5 });
      void ctx;
    }
  }
}

/** Is a (convex) wedge clear of roads and other footprints (its inner part: road cells spill 2 m)? */
function wedgeFree(P, poly) {
  const cx = poly.reduce((a, p) => a + p[0], 0) / poly.length, cz = poly.reduce((a, p) => a + p[1], 0) / poly.length;
  const inner = poly.map(([x, z]) => [cx + (x - cx) * 0.86, cz + (z - cz) * 0.86]);
  let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
  for (const [x, z] of inner) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z); }
  for (let x = x0; x <= x1; x += 2.5) {
    for (let z = z0; z <= z1; z += 2.5) {
      if (!inPoly(inner, x, z)) continue;
      if (!P.inside(x, z) || (P.occ.get(x, z) & (1 | 4 | 8))) return false;
    }
  }
  return true;
}

/** Frontage: deco blocks and towers on the big roads, terraces of rowhouses on the streets. */
function planFrontage(P, ctx) {
  // the Grand Concourse first: an unbroken wall of deco apartment houses down
  // both sides, narrower and shallower where the diagonal leaves thin lots
  const conc = (r) => r.name === 'GRAND CONCOURSE';
  for (const L of frontLots(P, P.roads(conc), { width: () => P.range(16, 30), depths: [34, 26, 18, 13], gap: () => 0, setback: 0.6, pad: -0.6, skip: 2.5 })) {
    const r = P.rng();
    makeDeco(P, L, r < 0.22 ? P.range(80, 140) : r < 0.7 ? P.range(36, 70) : P.range(24, 36), ctx, {});
  }
  // and narrow ones into what's left by the junctions
  for (const L of frontLots(P, P.roads(conc), { width: () => P.range(9, 14), depths: [14, 10], gap: () => 0, setback: 0.6, pad: -0.6, skip: 2 })) {
    makeDeco(P, L, P.range(18, 30), ctx, {});
  }
  const big = (r) => (r.rt.id === 'boulevard' || r.rt.id === 'avenue') && !r.spec.id.startsWith('xc_') && !conc(r);
  for (const L of frontLots(P, P.roads(big), { width: () => P.range(24, 44), depths: [40, 32, 24], gap: () => P.range(0, 1.5), setback: 0.6, pad: -0.6, skip: 5 })) {
    const along = L.road.name === 'GRAND CONCOURSE' || L.road.name === 'PARK BLVD';
    const r = P.rng();
    const H = r < 0.16 ? P.range(90, 150) : r < 0.5 ? P.range(42, 80) : P.range(22, 42);
    makeDeco(P, L, along ? H * 1.15 : H, ctx, {});
  }
  const street = (r) => (r.rt.id === 'street' || r.rt.id === 'cobble') && !r.spec.id.startsWith('xc_');
  const rows = frontLots(P, P.roads(street), { width: () => P.pick([6.6, 6.6, 8.8, 8.8, 8.8, 11]), depths: [18, 14], setback: 3.4, pad: -0.6, skip: 4, chance: 0.97 });
  // a terrace: neighbours share a look for a few houses, then it changes
  let run = 0, look = null;
  for (const L of rows) {
    if (run <= 0) { run = 2 + Math.floor(P.rng() * 6); look = { tint: P.pick(MASON), trim: P.pick(TRIM), floors: P.pick([3, 4, 4, 4, 5]), mansard: P.rng() < 0.25 }; }
    run--;
    makeRow(P, L, look);
  }
}

/** Big houses in their own gardens on the hill's east side (where no street runs). */
function planEstates(P, ctx) {
  for (const L of P.fill({ spacing: 70, width: [22, 30], depth: [16, 22], pad: 9, chance: 0.75, roadPad: true, test: (x) => x > 780 })) {
    makeDeco(P, L, P.range(12, 18), ctx, { estate: true });
  }
}

/** A rowhouse from its lot. */
function makeRow(P, L, look) {
  const { x, z, w, d, ry } = L;
  const g = P.groundRange(x, z, w, d, ry);
  // the sidewalk's height in front of it
  const r = L.road, i = r.posAt(L.s).i;
  const sy = r.roadY(i, 0, 0) + r.rt.curb;
  const floors = look.floors + (P.rng() < 0.15 ? (P.rng() < 0.5 ? -1 : 1) : 0);
  const it = {
    type: 'row', x, z, ry, w, d, gy: Math.min(g.lo, sy - 0.3), sy, floors: Math.max(3, Math.min(5, floors)),
    tint: look.tint.map((v) => v * P.range(0.94, 1.06)), trim: look.trim, door: P.pick(DOOR),
    seed: Math.floor(P.rng() * 180), stoop: P.rng() < 0.82, bay: w >= 8 && P.rng() < 0.35, mansard: look.mansard, doorLeft: P.rng() < 0.5,
    setback: L.setback ?? 3.4, map: 'building',
  };
  const top = sy - 1.6 + it.floors * 3.4;
  P.add(it);
  P.collider({ kind: 'box', x, z, hx: w / 2, hz: d / 2, ry, y0: it.gy - 1.2, y1: top + 1 });
  if (it.stoop) {
    // the stoop out front is solid too
    const fx = Math.sin(ry), fz = Math.cos(ry), lx = Math.cos(ry), lz = -Math.sin(ry);
    const dxl = (it.doorLeft ? -1 : 1) * (w / 2 - 1.4);
    P.collider({ kind: 'box', x: x + fx * (d / 2 + 1.5) + lx * dxl, z: z + fz * (d / 2 + 1.5) + lz * dxl, hx: 1.1, hz: 1.5, ry, y0: sy - 1, y1: sy + 1.9 });
    if (P.rng() < 0.3) P.lamp({ x: x + fx * (d / 2 + 0.4) + lx * (dxl + (it.doorLeft ? 1 : -1) * 1.2), z: z + fz * (d / 2 + 0.4) + lz * (dxl + (it.doorLeft ? 1 : -1) * 1.2), hy: sy + 4, color: '#ffbf72', radius: 7, intensity: 0.75, halo: 0.9 });
  }
  P.far({ x, z, y: it.gy - 1, w, d, h: top - it.gy + 2, ry, color: hex(it.tint, [170, 150, 135]), lit: 0.32 });
}

/**
 * An art deco building (an apartment house, a hotel, an office tower) from
 * its lot and height: a street band of shops, a shaft set back in tiers,
 * a crown (gold-lit tiers, fins, a spire or a copper roof) or, lower down,
 * a water tank on the roof; a doorman's canopy at the door.
 */
function makeDeco(P, L, H, ctx, o) {
  const { x, z, w, d, ry } = L;
  const g = P.groundRange(x, z, w, d, ry);
  const gy = g.lo;
  const it = { type: 'bldg', x, z, ry, w, d, gy, y0: gy - 1.6, seed: Math.floor(P.rng() * 180), seedV: Math.floor(P.rng() * 16), parts: [], tops: [], map: 'building' };
  const mk = o.estate ? 'stone' : o.grand ? P.pick(['stone', 'deco']) : P.pick(['deco', 'deco', 'stone']);
  const tint = mk === 'deco' ? P.pick(DECO_T) : P.pick(STONE_T);
  const baseH = o.estate ? 0.3 : 4.5;
  const st = mk === 'deco' ? 3.5 : 3.8;
  const snap = (h) => gy + baseH + Math.max(1, Math.round((h - baseH) / st)) * st;
  const top = snap(H);
  if (!o.estate) {
    // shopfronts on the street (both streets at a corner), the facade down to the ground behind
    const front = o.corner ? 'flr' : 'f', back = o.corner ? 'b' : 'blr';
    it.parts.push({ s: 'box', w, d, y0: gy - 0.25, y1: gy + baseH, m: 'shops', band: P.rng() < 0.5 ? 1 : 0, lid: false, faces: front });
    it.parts.push({ s: 'box', w, d, y0: gy - 0.25, y1: gy + baseH, m: mk, tint, lid: false, faces: back, back: true });
  }
  const tall = H > 70;
  if (tall) {
    // the wedding cake: a broad base, setbacks, a crown
    const n = 3 + Math.floor(P.rng() * 2);
    let cw = w, cd = d, y = gy + baseH;
    const fr = [0.5, 0.25, 0.15, 0.1].slice(0, n);
    const tot = fr.reduce((a, b) => a + b, 0);
    for (let k = 0; k < n; k++) {
      const y1 = k === n - 1 ? top : snap(y - gy + (H - baseH) * fr[k] / tot);
      const crown = k === n - 1 && P.rng() < 0.75;
      it.parts.push({ s: 'box', w: cw, d: cd, y0: y, y1: Math.max(y1, y + st), m: crown ? 'crown' : mk, tint: crown ? [1, 0.92, 0.75] : tint, led: crown ? 'g' : null, ledM: 'g' });
      y = Math.max(y1, y + st);
      const s = P.range(2.2, 4.5);
      cw -= 2 * s; cd -= 2 * s;
      if (cw < 9 || cd < 9) break;
    }
    const last = it.parts[it.parts.length - 1];
    const k = P.rng();
    if (k < 0.4) it.tops.push({ k: 'spire', y, r: Math.max(1.2, Math.min(last.w, last.d) * 0.16), h: H * P.range(0.12, 0.2) });
    else if (k < 0.7) it.parts.push({ s: 'pyr', w: last.w, d: last.d, y0: y, y1: y + Math.min(last.w, last.d) * 0.55, m: 'copper' });
    else it.tops.push({ k: 'fins', y: last.y0, w: last.w, d: last.d, h: last.y1 - last.y0 + 3, m: 'g' });
    // floods on the crown, seen from across the city
    for (const [a, b] of [[-1, -1], [1, 1]]) {
      const c = Math.cos(ry), s2 = Math.sin(ry);
      const lx = a * last.w * 0.4, lz = b * last.d * 0.4;
      P.lamp({ x: x + lx * c + lz * s2, z: z - lx * s2 + lz * c, hy: last.y1 + 1, color: '#ffcf7a', radius: 4, intensity: 0.2, halo: 4.5 });
    }
  } else {
    it.parts.push({ s: 'box', w, d, y0: o.estate ? gy - 1.4 : gy + baseH, y1: top, m: mk, tint });
    if (o.estate) it.parts.push({ s: 'pyr', w: w + 1, d: d + 1, y0: top, y1: top + Math.min(w, d) * 0.32, m: 'slate' });
    else if (P.rng() < 0.55) {
      // a cornice, and a water tank on the roof (the old city's skyline)
      it.tops.push({ k: 'cornice', y: top, w, d });
      if (P.rng() < 0.7) it.tops.push({ k: 'tank', y: top, dx: (P.rng() - 0.5) * w * 0.4, dz: (P.rng() - 0.5) * d * 0.4, r: P.range(2.2, 3.2), h: P.range(3.6, 5) });
    } else it.tops.push({ k: 'mansard', y: top, w, d, h: st * 1.2 });
  }
  if (!o.estate) it.door = { w: Math.min(3.4, w * 0.2), canopy: P.rng() < 0.65 || o.grand || o.corner, setback: L.setback ?? 0.5, name: o.name || null };
  if (!o.estate && (o.grand || P.rng() < 0.55)) it.awnings = { k: Math.floor(P.rng() * AWNINGS), sides: o.corner ? 'flr' : 'f' };
  P.add(it);
  let yTop = gy;
  for (const p of it.parts) yTop = Math.max(yTop, p.y1);
  P.collider({ kind: 'box', x, z, hx: w / 2, hz: d / 2, ry, y0: it.y0, y1: yTop + 2 });
  for (const p of it.parts) {
    if (p.m === 'shops' || p.back) continue;
    const y0 = p === it.parts.find((q) => q.m !== 'shops' && !q.back) ? it.y0 : p.y0;
    if (p.s === 'pyr') P.far({ shape: 'cone', x, z, y: p.y0, r: Math.min(p.w, p.d) / 2, h: p.y1 - p.y0, color: p.m === 'copper' ? '#5f9e88' : '#4a505a', lit: 0 });
    else P.far({ shape: 'box', x, z, y: y0, w: p.w, d: p.d, h: p.y1 - y0, ry, color: p.m === 'crown' ? '#d8b878' : hex(p.tint || [1, 1, 1], mk === 'deco' ? [200, 186, 160] : [206, 198, 182]), lit: p.m === 'crown' ? 0.9 : 0.36 });
  }
  if (it.door) {
    const fx = Math.sin(ry), fz = Math.cos(ry);
    P.lamp({ x: x + fx * (d / 2 + 3), z: z + fz * (d / 2 + 3), hy: gy + 3.6, color: '#ffd59a', radius: 10, intensity: 0.8, halo: 1.2 });
    if (it.door.canopy) {
      const cl = (L.setback ?? 0.5) + (L.road ? reachOf(L.road.rt) - L.road.rt.hw - L.road.rt.shoulder - 0.6 : 3.2);
      it.door.len = Math.max(2.5, Math.min(5, cl));
      for (const sd of [-1, 1]) {
        const lx = Math.cos(ry) * sd * (it.door.w / 2 + 0.2), lz = -Math.sin(ry) * sd * (it.door.w / 2 + 0.2);
        P.collider({ kind: 'circle', x: x + fx * (d / 2 + it.door.len) + lx, z: z + fz * (d / 2 + it.door.len) + lz, r: 0.12, y0: gy - 1, y1: gy + 3 });
      }
    }
  }
  return it;
}

function makeHotel(P, L, name, ctx) {
  const it = makeDeco(P, L, P.range(48, 64), ctx, { grand: true, name });
  it.parts.forEach((p) => { if (p.m === 'deco') p.m = 'stone'; });
  it.tops = it.tops.filter((t) => t.k !== 'tank');
  const last = it.parts[it.parts.length - 1];
  if (!it.tops.some((t) => t.k === 'mansard') && last.s === 'box') it.tops.push({ k: 'mansard', y: last.y1, w: last.w, d: last.d, h: 5 });
  it.flags = 3;
  it.door.name = name;
  it.door.canopy = true;
  it.door.w = 5;
}

// ---------------------------------------------------------------- the streets

function planStreets(P, ctx) {
  // signals on every junction of city streets: old-style posts, one per approach
  for (const n of cityJunctions(P)) {
    const off = ((n.x * 0.011 + n.z * 0.017) % 1 + 1) % 1;
    for (const e of n.ends) {
      const sp = signalSpot(n, e);
      const ns = Math.abs(e.dz) > Math.abs(e.dx);
      P.add({ type: 'signal', x: sp.x, z: sp.z, y: sp.y, ry: sp.ry, ph: (off + (ns ? 0 : 0.5)) % 1, sign: UT_STREET_SIGN[e.road.name] || null, ax: sp.ax, az: sp.az });
      P.collider({ kind: 'circle', x: sp.x, z: sp.z, r: 0.22, y0: sp.y - 1, y1: sp.y + 5 });
    }
  }
  const spots = new Spots();
  const used = { push: ([x, z, r]) => spots.add(x, z, r) };
  const free = (x, z, r) => spots.free(x, z, r);
  const lampOk = (r, x, z, d) => { for (const L of roadLamps(r)) if (Math.abs(L.x - x) < d && Math.abs(L.z - z) < d) return false; return true; };
  const roads = P.roads((r) => r.rt.walk > 0 && !(r.flags[Math.floor(r.N / 2)] & 5));
  for (const r of roads) {
    const rt = r.rt;
    const blvd = rt.id === 'boulevard';
    const conc = r.name === 'GRAND CONCOURSE';
    // street trees in their pits, every 12–15 m both sides
    const step = conc ? 12 : blvd ? 13 : 15;
    walkSidewalks(r, step, (p) => {
      const lat = Math.abs(p.kerb) + 1.1;
      const q = r.posAt(p.s, Math.sign(p.kerb) * lat);
      if (!P.inside(q.x, q.z) || !free(q.x, q.z, 1.8) || !lampOk(r, q.x, q.z, 2.6) || P.occ.hitDisc(q.x, q.z, 1.5, ITEM)) return;
      used.push([q.x, q.z, 1.8]);
      const kind = conc || blvd ? 'plane' : P.pick(['linden', 'elm', 'plane', 'linden']);
      P.add({ type: 'tree', kind, x: q.x, z: q.z, y: p.y, s: P.range(0.85, 1.1), t: P.rng(), pit: true, ry: p.ry });
      P.collider({ kind: 'circle', x: q.x, z: q.z, r: 0.4, y0: p.y - 1, y1: p.y + 7 });
    }, { ends: 11, offset: P.range(4, 9) });
    // the boulevards' medians: a row of trees down the middle
    if (blvd && rt.median > 0) {
      for (let s = r.trim0 + 12; s < r.length - r.trim1 - 10; s += 12) {
        const q = r.posAt(s, 0);
        if (!P.inside(q.x, q.z)) continue;
        const y = q.y + 0.15;
        P.add({ type: 'tree', kind: 'linden', x: q.x, z: q.z, y, s: P.range(0.9, 1.15), t: P.rng() });
        P.collider({ kind: 'circle', x: q.x, z: q.z, r: 0.45, y0: y - 1, y1: y + 7 });
      }
    }
    // banners on the Concourse's lamp posts
    if (conc) for (const L of roadLamps(r)) P.add({ type: 'sf', k: 'banner', x: L.x, z: L.z, y: L.y, ry: L.ry, t: (L.x * 0.37 + L.z) & 1 });
    // hydrants, mailboxes, benches
    walkSidewalks(r, 16, (p) => {
      if (P.rng() > 0.2 || !P.inside(p.x, p.z) || !free(p.x, p.z, 0.8) || P.occ.hitDisc(p.x, p.z, 1.2, ITEM)) return;
      const k = P.pick(['hydrant', 'mailbox', 'bench', 'hydrant']);
      const q = r.posAt(p.s, Math.sign(p.kerb) * (Math.abs(p.kerb) + 0.7));
      if (!lampOk(r, q.x, q.z, 1.4)) return;
      used.push([q.x, q.z, 0.9]);
      P.add({ type: 'sf', k, x: q.x, z: q.z, y: p.y, ry: p.ry });
      if (k === 'bench') P.collider({ kind: 'box', x: q.x, z: q.z, hx: 1.0, hz: 0.35, ry: p.ry, y0: p.y - 1, y1: p.y + 0.9 });
    }, { ends: 12, offset: P.range(2, 9) });
  }
  void ctx;
}

// =====================================================================
// materials
// =====================================================================

let _M = null;
function mats(B) {
  if (_M) return _M;
  const m = (k, f) => B.mat(k, f);
  const shop = boutiqueTex();
  const signs = utSignsTex();
  // one sign material: awnings and carved names never glow, blades a little
  const glowLevels = { aw0: 0, aw1: 0, aw2: 0, aw3: 0, aw4: 0, museum: 0, victory: 0, plaque: 0, mews: 0.2, banner0: 0.35, banner1: 0.35, banner2: 0.35 };
  for (const k of Object.values(UT_STREET_SIGN).concat(['u_blank'])) glowLevels[k] = 0.45;
  const signGlow = glowOf(signs, UT_SIGN_RECTS, glowLevels, 'utsigns-glow');
  const WARM = [['#ffcf86', 5], ['#ffe2b0', 3], ['#ffb870', 2]];
  // a lit crown is the deco facade with every window on (shaders.js)
  const deco = m('deco', () => windowMat(decoTex(), { key: 'ut-deco', tint: true, ...DECO, pal: WARM, occ: [0.35, 0.8], dense: 0.72, sparse: 0.14, curtains: true, tv: 0.04, perWindow: true, rough: 0.8, metal: 0.02, env: 0.4, night: 1.2, crown: { hex: '#ffd890', k: 1.83 } }));
  // plain-coloured iron, slate, copper: colours of the trim material
  const trim = m('trim', () => litMat({ vertexColors: true, roughness: 0.6, metalness: 0.15 }));
  const leaf = sharedMat(B, 'leaf', () => litMat({ vertexColors: true, roughness: 0.9, flatShading: true }, { glow: 0.32 }));
  // gold crown edges and warm lamp glass: one glowing material
  const glo = sharedMat(B, 'glo', () => nightGlowVC(4));
  const lit = (hex, k) => { const c = new THREE.Color(hex); return [c.r * k / 4, c.g * k / 4, c.b * k / 4]; };
  const sign = m('sign', () => litMat({ map: signs, emissive: 0xffffff, emissiveMap: signGlow, roughness: 0.6 }, { night: 1.1, glow: 2.2 }));
  const gold = paint(glo, lit(0xffc860, 3.2));
  const M = {
    mats: {
      row: m('row', () => windowMat(rowhouseTex(), { key: 'ut-row', tint: true, lit: true, glow: 2.2, ...ROW, pal: WARM, occ: [0.45, 0.9], dense: 0.62, sparse: 0.22, curtains: true, tv: 0.07, perWindow: true, rough: 0.85, metal: 0, env: 0.35, night: 1.15 })),
      deco,
      crown: deco,
      stone: m('stone', () => windowMat(stoneTex(), { key: 'ut-stone', tint: true, ...STONE, pal: WARM, occ: [0.4, 0.85], dense: 0.7, sparse: 0.18, curtains: true, perWindow: true, rough: 0.8, metal: 0, env: 0.35, night: 1.2 })),
      shops: m('shops', () => litMat({ map: shop.map, emissive: 0xffffff, emissiveMap: shop.emi, roughness: 0.55, metalness: 0.1 }, { night: 1.0, glow: 1.8 })),
    },
    crownOf: { crown: 'deco' },
    spec: SPEC,
    roof: darkConcreteMat(),
    metal: paint(trim, 0x1d201e),
    steel: paint(trim, 0xa8adb2),
    pole: poleMat(),
    wood: paint(trim, 0x6e5038),
    cream: paint(trim, 0xcbbf9f),
    boatGreen: paint(trim, 0x1f4a32),
    boatRed: paint(trim, 0x8a2a22),
    ashlar: m('ashlar', () => litMat({ map: ashlarTex(), roughness: 0.85 }, { glow: 1.9 })),
    slate: paint(trim, 0x3a4048),
    copper: paint(trim, 0x5f9e88),
    trim,
    sign,
    awning: sign,
    led: gold,
    ledB: gold,
    ledG: gold,
    warm: paint(glo, lit(0xffd29a, 2.6)),
    blink: sharedMat(B, 'blink', () => blinkMat('#ff2a1a', 5)),
    chase: m('chase', () => chaseMat(3.4, 7)),
    signal: sharedMat(B, 'signal', () => signalMat(28)),
    lawn: m('lawn', () => litMat({ map: groundTexture('grass'), color: 0xb8c8a0, roughness: 0.95, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }, { glow: 2.2 })),
    path: m('path', () => litMat({ map: hexTex(), roughness: 0.85, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }, { glow: 1.6 })),
    pond: m('pond', () => waterMat(pondTex())),
    trunk: paint(leaf, 0x4a3a2c),
    leaf,
    beam: m('beam', () => {
      const mm = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.55, 0.6, 0.75), transparent: true, opacity: 0.18, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
      return mm;
    }),
  };
  M.mats.copper = M.copper;
  M.mats.slate = M.slate;
  M.uv = (name) => signUV(UT_SIGN_RECTS, name);
  _M = M;
  return M;
}

// =====================================================================
// building
// =====================================================================

const ROW_UW = SPEC.row.uw, ROW_VH = SPEC.row.vh;

function drawRow(B, it, M) {
  const { x, z, ry, w, d, gy, sy, floors, seed } = it;
  const c = Math.cos(ry), s = Math.sin(ry);
  const fx = s, fz = c, lx = c, lz = -s;
  const base = sy - 1.6;
  const top = base + floors * 3.4;
  const y0 = gy - 1.2;
  const acc = A(B, M.mats.row);
  acc.col = it.tint;
  walls(acc, x, y0, z, w, top - y0, d, ry, ROW_UW, ROW_VH, seed * 8, (y0 - base) / ROW_VH);
  // a bay window up the parlor floors
  if (it.bay) {
    const bxl = it.doorLeft ? w / 2 - 2.2 - 0.3 : -w / 2 + 2.2 + 0.3;
    const bx = x + lx * bxl + fx * (d / 2 + 0.45), bz = z + lz * bxl + fz * (d / 2 + 0.45);
    walls(acc, bx, base + 3.4, bz, 4.4, 6.8, 0.9, ry, ROW_UW, ROW_VH, seed * 8 + 0.5, 1 / 4);
    lid(A(B, M.roof), bx, base + 10.2, bz, 4.4, 0.9, ry, 2);
  }
  acc.col = [1, 1, 1];
  const trim = A(B, M.trim);
  // roof: a cornice (or a mansard storey), a chimney
  trim.col = it.trim;
  trim.box(x + fx * (d / 2 + 0.3), top - 0.75, z + fz * (d / 2 + 0.3), w + 0.02, 0.85, 0.7, ry);
  panel(trim, x + fx * (d / 2 + 0.06), top - 1.25, z + fz * (d / 2 + 0.06), w, 0.25, ry);
  lid(A(B, M.roof), x, top, z, w, d, ry, 4);
  if (it.mansard) {
    // a mansard storey: slate sloping back 2 m from the cornice, then its roof
    const sacc = A(B, M.slate);
    slope(sacc, x + fx * (d / 2 - 0.2), z + fz * (d / 2 - 0.2), w, 2.0, top, top + 3.0, ry + Math.PI);
    walls(sacc, x - fx * 1.1, top, z - fz * 1.1, w, 3.0, d - 2.2, ry, 3, 3, 0, 0, 'lrb');
    lid(A(B, M.roof), x - fx * 1.1, top + 3.0, z - fz * 1.1, w, d - 2.2, ry, 4);
    // dormers
    for (let k = 0; k < Math.max(1, Math.round(w / 4.4)); k++) {
      const ox = -w / 2 + (k + 0.5) * (w / Math.max(1, Math.round(w / 4.4)));
      const dx = x + lx * ox + fx * (d / 2 - 1.0), dz = z + lz * ox + fz * (d / 2 - 1.0);
      trim.col = it.trim;
      trim.box(dx, top + 0.4, dz, 1.4, 1.9, 1.2, ry);
      panel(A(B, M.warm), dx + fx * 0.62, top + 0.7, dz + fz * 0.62, 0.8, 1.1, ry);
    }
  }
  trim.col = it.tint.map((v) => v * 0.8);
  trim.box(x - fx * (d * 0.25) + lx * (w * 0.3), top, z - fz * (d * 0.25) + lz * (w * 0.3), 0.9, 1.6, 0.7, ry);
  // the door, its lit transom, the stoop up to it
  const dxl = (it.doorLeft ? -1 : 1) * (w / 2 - 1.4);
  const doorY = it.stoop ? sy + 1.8 : sy;
  const dcx = x + lx * dxl + fx * (d / 2 + 0.03), dcz = z + lz * dxl + fz * (d / 2 + 0.03);
  trim.col = it.door;
  panel(trim, dcx + fx * 0.02, doorY, dcz + fz * 0.02, 1.3, 2.45, ry);
  panel(A(B, M.warm), dcx + fx * 0.04, doorY + 2.5, dcz + fz * 0.04, 1.3, 0.45, ry);
  if (it.stoop) {
    trim.col = it.tint.map((v) => v * 0.85);
    stairs(trim, x + lx * dxl + fx * (d / 2), z + lz * dxl + fz * (d / 2), fx, fz, 2.0, 3.0, sy - 0.2, sy, sy + 1.8, 5);
    // railings down both sides
    const rail = N(B, M.metal);
    for (const sd of [-1, 1]) {
      const ox = dxl + sd * 1.05;
      const ax = x + lx * ox + fx * (d / 2 + 0.2), az = z + lz * ox + fz * (d / 2 + 0.2);
      const bx = x + lx * ox + fx * (d / 2 + 3.1), bz = z + lz * ox + fz * (d / 2 + 3.1);
      rod(rail, ax, sy + 2.75, az, bx, sy + 1.05, bz, 0.07);
      post(rail, bx, sy, bz, 0.06, 1.05, 4);
    }
    N(B, M.warm).box(dcx + lx * (it.doorLeft ? 1.1 : -1.1) + fx * 0.15, doorY + 1.9, dcz + lz * (it.doorLeft ? 1.1 : -1.1) + fz * 0.15, 0.28, 0.42, 0.28, ry);
  }
  trim.col = [1, 1, 1];
  // an areaway railing along the front
  const sb = it.setback;
  const rail = N(B, M.metal);
  const ex = x + fx * (d / 2 + sb - 0.2), ez = z + fz * (d / 2 + sb - 0.2);
  const doorAt = dxl;
  const segs = it.stoop ? [[-w / 2, doorAt - 1.15], [doorAt + 1.15, w / 2]] : [[-w / 2, doorAt - 0.8], [doorAt + 0.8, w / 2]];
  for (const [a, b] of segs) {
    if (b - a < 0.4) continue;
    rod(rail, ex + lx * a, sy + 0.95, ez + lz * a, ex + lx * b, sy + 0.95, ez + lz * b, 0.06);
  }
}

/** Uptown's own rooftop things: cornices, water tanks, mansards. */
function drawUpTops(B, it, M) {
  const W = toWorld(it.x, it.z, it.ry);
  const c = Math.cos(it.ry), s = Math.sin(it.ry);
  for (const t of it.tops || []) {
    const [cx, cz] = W(t.dx || 0, t.dz || 0);
    if (t.k === 'cornice') {
      const tr = A(B, M.trim);
      tr.col = [0.85, 0.82, 0.76];
      tr.box(cx, t.y - 0.9, cz, t.w + 1.0, 1.0, t.d + 1.0, it.ry);
      tr.col = [1, 1, 1];
    } else if (t.k === 'tank') {
      // a wooden water tank on steel legs, a conical cap
      const legs = A(B, M.metal);
      for (let k = 0; k < 4; k++) {
        const a = k * Math.PI / 2 + Math.PI / 4;
        legs.cyl(cx + Math.cos(a) * t.r * 0.8, t.y, cz + Math.sin(a) * t.r * 0.8, 0.14, 3.2, 4);
      }
      A(B, M.wood).cyl(cx, t.y + 3.2, cz, t.r, t.h, 10, t.r * 0.96);
      const pts = place(circle(t.r * 1.05, 10), cx, cz, 0);
      apex(A(B, M.slate), pts, t.y + 3.2 + t.h, cx, t.y + 3.2 + t.h + t.r * 0.7, cz, 2);
      A(B, M.metal).cyl(cx, t.y + 3.2 + t.h * 0.3, cz, t.r * 1.01, 0.12, 10);
      A(B, M.metal).cyl(cx, t.y + 3.2 + t.h * 0.75, cz, t.r * 0.99, 0.12, 10);
    } else if (t.k === 'mansard') {
      const sl = A(B, M.slate);
      const h = t.h;
      // four sloped faces up to a smaller flat top, dormers on the front
      const P2 = (lx, lz) => [cx + lx * c + lz * s, cz - lx * s + lz * c];
      const hw = t.w / 2, hd = t.d / 2, iw = hw - 1.6, id = hd - 1.6;
      const o = [P2(-hw, hd), P2(hw, hd), P2(hw, -hd), P2(-hw, -hd)];
      const i2 = [P2(-iw, id), P2(iw, id), P2(iw, -id), P2(-iw, -id)];
      for (let k = 0; k < 4; k++) {
        const a = o[k], b = o[(k + 1) % 4], b2 = i2[(k + 1) % 4], a2 = i2[k];
        sl.quadP([a[0], t.y, a[1]], [b[0], t.y, b[1]], [b2[0], t.y + h, b2[1]], [a2[0], t.y + h, a2[1]], [0, 0, 4, 2]);
      }
      lid(A(B, M.roof), cx, t.y + h, cz, iw * 2, id * 2, it.ry, 4);
      const n = Math.max(1, Math.floor(t.w / 6));
      const tr = A(B, M.trim);
      tr.col = [0.9, 0.88, 0.82];
      for (let k = 0; k < n; k++) {
        const ox = -t.w / 2 + (k + 0.5) * (t.w / n);
        const [dx, dz] = P2(ox, hd - 0.9);
        tr.box(dx, t.y + 0.3, dz, 1.6, 2.4, 1.4, it.ry);
        panel(A(B, M.warm), dx + s * 0.72, t.y + 0.7, dz + c * 0.72, 0.9, 1.4, it.ry);
      }
      tr.col = [1, 1, 1];
    }
  }
}

/** Striped awnings over the shopfronts, one per 6 m front, clear of the door. */
function drawAwnings(B, it, M) {
  const aw = it.awnings;
  if (!aw) return;
  const uv = M.uv('aw' + aw.k);
  const acc = A(B, M.awning);
  const c = Math.cos(it.ry), s = Math.sin(it.ry);
  for (const f of aw.sides) {
    // the face's frame: out (its normal), along (its own x), its half-span and distance
    const fr = f === 'f' ? 0 : f === 'l' ? -Math.PI / 2 : Math.PI / 2;
    const ry = it.ry + fr;
    const ox = Math.sin(ry), oz = Math.cos(ry), ax = Math.cos(ry), az = -Math.sin(ry);
    const span = f === 'f' ? it.w : it.d, dist = (f === 'f' ? it.d : it.w) / 2;
    const n = Math.max(1, Math.floor(span / 6));
    for (let k = 0; k < n; k++) {
      const along = -span / 2 + (k + 0.5) * (span / n);
      if (f === 'f' && it.door && Math.abs(along) < it.door.w / 2 + 2.6) continue;
      const bx = it.x + ox * (dist + 0.02) + ax * along, bz = it.z + oz * (dist + 0.02) + az * along;
      slope(acc, bx, bz, span / n - 0.6, 1.5, it.gy + 4.1, it.gy + 3.4, ry, uv);
      // the valance hanging from its front edge
      panel(acc, bx + ox * 1.5, it.gy + 3.05, bz + oz * 1.5, span / n - 0.6, 0.36, ry, [uv[0], uv[1], uv[2], uv[1] + (uv[3] - uv[1]) * 0.3]);
    }
  }
  void c; void s;
}

/** The street door of an apartment house or hotel: a doorman's canopy out to the curb, flags. */
function drawDoorman(B, it, M) {
  const dr = it.door;
  if (!dr) return;
  const c = Math.cos(it.ry), s = Math.sin(it.ry);
  const fx = s, fz = c;
  const fx0 = it.x + fx * (it.d / 2), fz0 = it.z + fz * (it.d / 2);
  // the doors themselves (lit glass) in the shop band
  panel(A(B, M.warm), fx0 + fx * 0.05, it.gy, fz0 + fz * 0.05, dr.w, 3.0, it.ry);
  if (dr.canopy) {
    const len = dr.len || 3.5;
    const tr = A(B, M.trim);
    tr.col = dr.name ? [0.35, 0.08, 0.1] : [0.08, 0.2, 0.14];
    tr.box(fx0 + fx * len / 2, it.gy + 3.3, fz0 + fz * len / 2, dr.w + 0.5, 0.35, len, it.ry);
    tr.col = [1, 1, 1];
    under(A(B, M.warm), fx0 + fx * len / 2, it.gy + 3.28, fz0 + fz * len / 2, dr.w, len - 0.3, it.ry);
    const pm = N(B, M.metal);
    for (const sd of [-1, 1]) {
      const lx = c * sd * (dr.w / 2 + 0.2), lz = -s * sd * (dr.w / 2 + 0.2);
      pm.cyl(fx0 + fx * (len - 0.2) + lx, it.gy, fz0 + fz * (len - 0.2) + lz, 0.06, 3.3, 5);
    }
    if (dr.name) panel(A(B, M.sign), fx0 + fx * (len + 0.02), it.gy + 3.1, fz0 + fz * (len + 0.02), dr.w + 0.4, 0.75, it.ry, M.uv(dr.name));
  }
  if (dr.name) {
    // the hotel's name in lights over the door, its flags
    panel(A(B, M.sign), fx0 + fx * 0.3, it.gy + 6.2, fz0 + fz * 0.3, Math.min(it.w * 0.7, 20), Math.min(it.w * 0.7, 20) / 5.3, it.ry, M.uv(dr.name));
    const pm = A(B, M.metal);
    for (let k = -1; k <= 1; k++) {
      const lx = c * k * 5, lz = -s * k * 5;
      const bx = fx0 + lx + fx * 0.3, bz = fz0 + lz + fz * 0.3;
      pm.beam(bx, it.gy + 9, bz, bx + fx * 3.2, it.gy + 10.4, bz + fz * 3.2, 0.08, 0.08);
      const fl = A(B, M.trim);
      fl.col = [[0.7, 0.1, 0.12], [0.95, 0.92, 0.85], [0.12, 0.2, 0.5]][k + 1];
      fl.box(bx + fx * 2.6, it.gy + 8.4, bz + fz * 2.6, 0.05, 1.8, 1.2, it.ry);
      fl.col = [1, 1, 1];
    }
  }
}

function drawMuseum(B, it, M) {
  const { x, z, w, d, gy, top, steps } = it;
  const st = A(B, M.ashlar);
  const fz = z + d / 2;
  // the body: two wings and a taller centre, a frieze, a dome on a drum
  walls(st, x, gy - 2, z, w, top - gy + 2, d, 0, 8, 8);
  lid(A(B, M.roof), x, top, z, w, d, 0, 6);
  block(st, x, top - 1.6, z, w + 1.6, 1.6, d + 1.6, 0, 4);
  block(st, x, top, z - 4, 56, 5, d - 22, 0, 4);
  const dr = A(B, M.ashlar);
  dr.cyl(x, top + 5, z - 4, 13, 7, 16);
  for (let k = 0; k < 16; k++) {
    const a = (k / 16) * Math.PI * 2;
    A(B, M.warm).box(x + Math.cos(a) * 13.05, top + 7, z - 4 + Math.sin(a) * 13.05, 1.2, 3, 0.2, -a + Math.PI / 2);
  }
  blob(A(B, M.copper), x, top + 12, z - 4, 13.5, 11, 13.5, 16, 8);
  A(B, M.copper).cyl(x, top + 22, z - 4, 1.2, 4, 8, 0.4);
  // the portico: steps, a stylobate, eight columns, the entablature, a pediment
  const pw = 54, pd = 12;
  const sy = gy + 3.2;
  // the stylobate under the portico, then eight steps down to the sidewalk
  block(st, x, gy - 1.5, fz + pd / 2, pw + 6, sy - gy + 1.5, pd, 0, 2);
  const flight = steps - pd;
  for (let k = 0; k < 8; k++) {
    const run = flight - k * (flight / 8);
    block(st, x, gy - 1.5, fz + pd + run / 2, pw + 12 - k * 0.8, 1.5 + 0.4 * (k + 1), run, 0, 2);
  }
  const cy0 = sy, cy1 = top - 4.2;
  for (let k = 0; k < 8; k++) {
    const cx = x - pw / 2 + 3 + (k * (pw - 6)) / 7;
    st.cyl(cx, cy0, fz + pd - 2.2, 1.1, cy1 - cy0, 12, 0.95);
    block(st, cx, cy0, fz + pd - 2.2, 2.8, 0.6, 2.8, 0, 2);
    block(st, cx, cy1 - 0.6, fz + pd - 2.2, 2.8, 0.6, 2.8, 0, 2);
  }
  block(st, x, cy1, fz + pd / 2, pw + 2, 3.6, pd + 2, 0, 3);
  under(st, x, cy1, fz + pd / 2, pw + 2, pd + 2, 0, 3);
  // pediment (a gable over the portico)
  const P = (lx, ly, lz) => [x + lx, cy1 + 3.6 + ly, fz + pd / 2 + lz];
  const hw = pw / 2 + 1, hd = pd / 2 + 1, rise = 7.5;
  const ro = A(B, M.slate);
  ro.quadP(P(-hw, 0, -hd), P(-hw, 0, hd), P(0, rise, hd), P(0, rise, -hd), [0, 0, 6, 1]);
  ro.quadP(P(hw, 0, hd), P(hw, 0, -hd), P(0, rise, -hd), P(0, rise, hd), [0, 0, 6, 1]);
  const a1 = st.v(...P(-hw, 0, hd), 0, 0), b1 = st.v(...P(hw, 0, hd), 6, 0), t1 = st.v(...P(0, rise, hd), 3, 1);
  st.tri(a1, b1, t1);
  panel(A(B, M.sign), x, cy1 + 0.7, fz + pd + 1.05, 34, 2.2, 0, M.uv('museum'));
  // the doors (warm light) and banners between the columns
  panel(A(B, M.warm), x, sy, fz + 0.06, 8, 7, 0);
  for (const sd of [-1, 1]) panel(A(B, M.warm), x + sd * 14, sy, fz + 0.06, 5, 6, 0);
  for (let k = 0; k < 3; k++) {
    const cx = x - pw / 2 + 3 + ((k * 3 + 1.5) * (pw - 6)) / 7;
    panel(A(B, M.sign), cx, sy + 4, fz + pd - 2.2, 2.2, 7.5, 0, M.uv('banner' + k));
  }
  // the two fountains by the steps
  for (const sd of [-1, 1]) {
    const bx = x + sd * 44, bz = it.front - 6;
    ring(A(B, M.ashlar), bx, gy - 0.2, bz, 3.8, 4.6, 0.9, 18);
    disc(A(B, M.pond), bx, gy + 0.5, bz, 3.8, 18, 6);
    A(B, M.ashlar).cyl(bx, gy, bz, 0.6, 2.4, 8, 0.4);
    blob(N(B, M.warm), bx, gy + 2.6, bz, 0.7, 0.9, 0.7, 6, 3);
  }
}

function drawTheatre(B, it, M) {
  const { x, z, w, d, ry, gy } = it;
  const c = Math.cos(ry), s = Math.sin(ry);
  const fx = s, fz = c, lx = c, lz = -s;
  const st = A(B, M.mats.stone);
  st.col = [0.95, 0.8, 0.66];
  // the auditorium and the fly tower behind the front block
  walls(st, x - fx * 8, gy - 2, z - fz * 8, w, 26, d - 16, ry, SPEC.stone.uw, SPEC.stone.vh, 40, 0.1);
  lid(A(B, M.roof), x - fx * 8, gy + 24, z - fz * 8, w, d - 16, ry, 6);
  walls(st, x - fx * 18, gy + 24, z - fz * 18, w - 6, 14, 22, ry, SPEC.stone.uw, SPEC.stone.vh, 40, 0.3);
  lid(A(B, M.roof), x - fx * 18, gy + 38, z - fz * 18, w - 6, 22, ry, 6);
  st.col = [1, 1, 1];
  // the front: terracotta and gold, a great arched window
  const fr = A(B, M.ashlar);
  const fcx = x + fx * (d / 2 - 8), fcz = z + fz * (d / 2 - 8);
  walls(fr, fcx, gy - 2, fcz, w, 30, 16, ry, 6, 6);
  lid(A(B, M.roof), fcx, gy + 28, fcz, w, 16, ry, 6);
  const tr = A(B, M.trim);
  tr.col = [0.62, 0.32, 0.22];
  tr.box(fcx + fx * 8.05, gy + 26, fcz + fz * 8.05, w + 0.4, 2.2, 0.5, ry);
  tr.box(fcx + fx * 8.05, gy + 6.5, fcz + fz * 8.05, w + 0.4, 1.0, 0.5, ry);
  tr.col = [1, 1, 1];
  const fx0 = x + fx * (d / 2), fz0 = z + fz * (d / 2);
  panel(A(B, M.warm), fx0 + fx * 0.1, gy + 9, fz0 + fz * 0.1, 12, 14, ry);
  for (let k = -1; k <= 1; k++) panel(A(B, M.metal), fx0 + fx * 0.15 + lx * k * 4, gy + 9, fz0 + fz * 0.15 + lz * k * 4, 0.4, 14, ry);
  panel(A(B, M.warm), fx0 + fx * 0.06, gy, fz0 + fz * 0.06, 20, 3.4, ry);
  // the marquee: a box over the sidewalk, its letter boards, bulbs chasing round it
  const mw = 24, md = 5, my = gy + 4.6, mh = 2.6;
  const mx = fx0 + fx * md / 2, mz = fz0 + fz * md / 2;
  const mk = A(B, M.trim);
  mk.col = [0.55, 0.08, 0.08];
  mk.box(mx, my, mz, mw, mh, md, ry);
  mk.col = [1, 1, 1];
  under(A(B, M.warm), mx, my - 0.01, mz, mw - 0.5, md - 0.4, ry);
  panel(A(B, M.sign), mx + fx * (md / 2 + 0.03), my + 0.3, mz + fz * (md / 2 + 0.03), mw - 3, mh - 0.6, ry, M.uv('marquee'));
  for (const sd of [-1, 1]) panel(A(B, M.sign), mx + lx * sd * (mw / 2 + 0.03), my + 0.3, mz + lz * sd * (mw / 2 + 0.03), md - 1, mh - 0.6, ry + sd * Math.PI / 2, M.uv('marquee2'));
  const bulbs = A(B, M.chase);
  bulbs.col = [1, 0.85, 0.55];
  const bulbRow = (ax, ay, az, bx, by, bz, n, i0) => {
    for (let k = 0; k <= n; k++) {
      const t = k / n;
      const px = ax + (bx - ax) * t, py = ay + (by - ay) * t, pz = az + (bz - az) * t;
      const id = i0 + k;
      bulbs.v(px - 0.1, py - 0.1, pz, id, 0); bulbs.v(px + 0.1, py - 0.1, pz, id, 0);
      const b0 = bulbs.count;
      bulbs.v(px + 0.1, py + 0.1, pz, id, 0); bulbs.v(px - 0.1, py + 0.1, pz, id, 0);
      bulbs.tri(b0 - 2, b0 - 1, b0); bulbs.tri(b0 - 2, b0, b0 + 1);
      void b0;
    }
    return i0 + n + 1;
  };
  // (bulbs as little boxes, numbered round the marquee so the chase runs round it)
  let id = 0;
  const ring2 = (yy) => {
    const out = md / 2 + 0.06;
    const corners = [[-mw / 2, out], [mw / 2, out], [mw / 2, -md / 2], [-mw / 2, -md / 2]];
    for (let k = 0; k < 3; k++) {
      const a = corners[k], b = corners[k + 1];
      const A = [mx + lx * a[0] + fx * a[1], yy, mz + lz * a[0] + fz * a[1]], Bq = [mx + lx * b[0] + fx * b[1], yy, mz + lz * b[0] + fz * b[1]];
      const n = Math.round(Math.hypot(Bq[0] - A[0], Bq[2] - A[2]) / 0.55);
      for (let q = 0; q <= n; q++) {
        const t = q / n;
        const px = A[0] + (Bq[0] - A[0]) * t, pz = A[2] + (Bq[2] - A[2]) * t;
        const b0 = bulbs.count;
        const e = 0.11;
        bulbs.v(px - e, yy - e, pz - e, id, 0); bulbs.v(px + e, yy - e, pz + e, id, 0);
        bulbs.v(px + e, yy + e, pz + e, id, 0); bulbs.v(px - e, yy + e, pz - e, id, 0);
        bulbs.tri(b0, b0 + 1, b0 + 2); bulbs.tri(b0, b0 + 2, b0 + 3);
        bulbs.tri(b0, b0 + 2, b0 + 1); bulbs.tri(b0, b0 + 3, b0 + 2);
        id++;
      }
    }
  };
  ring2(my + 0.15);
  ring2(my + mh - 0.15);
  void bulbRow;
  // the blade sign up the corner, edged in bulbs
  const bx = fx0 + fx * 1.4 - lx * (w / 2 - 2.5), bz = fz0 + fz * 1.4 - lz * (w / 2 - 2.5);
  const blade = A(B, M.trim);
  blade.col = [0.5, 0.06, 0.06];
  blade.box(bx, gy + 8, bz, 0.5, 15, 2.8, ry);
  blade.col = [1, 1, 1];
  for (const sd of [-1, 1]) panel(A(B, M.sign), bx + lx * sd * 0.27, gy + 8.3, bz + lz * sd * 0.27, 2.6, 14.4, ry + sd * Math.PI / 2, M.uv('orpheum'));
  for (let k = 0; k < 30; k++) {
    const yy = gy + 8 + (k / 29) * 15;
    for (const sd of [-1, 1]) {
      const px = bx + fx * sd * 1.45, pz = bz + fz * sd * 1.45;
      const b0 = bulbs.count;
      const e = 0.12;
      bulbs.v(px - e * lx, yy - e, pz - e * lz, id, 0); bulbs.v(px + e * lx, yy - e, pz + e * lz, id, 0);
      bulbs.v(px + e * lx, yy + e, pz + e * lz, id, 0); bulbs.v(px - e * lx, yy + e, pz - e * lz, id, 0);
      bulbs.tri(b0, b0 + 1, b0 + 2); bulbs.tri(b0, b0 + 2, b0 + 3);
      bulbs.tri(b0, b0 + 2, b0 + 1); bulbs.tri(b0, b0 + 3, b0 + 2);
    }
    id++;
  }
  bulbs.col = [1, 1, 1];
  // two searchlights out front, their beams sweeping the sky
  const beam = new THREE.Group();
  const geo = new THREE.CylinderGeometry(2.6, 0.35, 160, 10, 1, true);
  geo.translate(0, 80, 0);
  const lights = [];
  for (const sd of [-1, 1]) {
    const px = fx0 + fx * 2.6 + lx * sd * (w / 2 + 2.5), pz = fz0 + fz * 2.6 + lz * sd * (w / 2 + 2.5);
    const py = B.groundY(px, pz);
    const tm = N(B, M.metal);
    tm.box(px, py, pz, 1.4, 0.9, 2.2, ry);
    tm.cyl(px, py + 0.9, pz, 0.5, 0.9, 8);
    const mesh = new THREE.Mesh(geo, M.beam);
    mesh.position.set(px, py + 1.6, pz);
    mesh.frustumCulled = false;
    beam.add(mesh);
    lights.push([mesh, sd]);
  }
  B.group.add(beam);
  B.anim((t, dt, dist) => {
    beam.visible = dist < 700;
    if (!beam.visible) return;
    for (const [mesh, sd] of lights) {
      mesh.rotation.set(0.42 * Math.sin(t * 0.5 + sd), 0, 0.38 * Math.cos(t * 0.37 + sd * 2));
    }
  });
}

function drawArch(B, it, M) {
  const { x, z, ry, gy, half, pier, depth, H } = it;
  // (the road runs along ry: the arch's local x spans across it)
  const ar = ry;
  const W = 2 * (half + pier), open = 2 * half, spring = H - 6 - half;
  const st = A(B, M.ashlar);
  const c = Math.cos(ar), s = Math.sin(ar);
  for (const sd of [-1, 1]) {
    const lat = sd * (half + pier / 2);
    walls(st, x + c * lat, gy - 2, z - s * lat, pier, spring + 2, depth, ar, 4, 4);
  }
  // the vault over the road: the arch wall at each face and the soffit
  const spanH = H - spring;
  for (const fz of [-1, 1]) {
    const P = (lx, ly) => [x + lx * c + fz * (depth / 2) * Math.sin(ar), gy + spring + ly, z - lx * s + fz * (depth / 2) * Math.cos(ar)];
    const seg = 10;
    for (let k = 0; k < seg; k++) {
      const a0 = Math.PI - (k / seg) * Math.PI, a1 = Math.PI - ((k + 1) / seg) * Math.PI;
      const q = [P(Math.cos(a0) * half, Math.sin(a0) * half), P(Math.cos(a1) * half, Math.sin(a1) * half), P(Math.cos(a1) * half, spanH), P(Math.cos(a0) * half, spanH)];
      if (fz > 0) st.quadP(q[0], q[1], q[2], q[3], [0, 0, 1, 1]);
      else st.quadP(q[1], q[0], q[3], q[2], [0, 0, 1, 1]);
    }
    const qa = [P(-W / 2, 0), P(-half, 0), P(-half, spanH), P(-W / 2, spanH)];
    const qb = [P(half, 0), P(W / 2, 0), P(W / 2, spanH), P(half, spanH)];
    for (const q of [qa, qb]) { if (fz > 0) st.quadP(q[0], q[1], q[2], q[3], [0, 0, 2, 2]); else st.quadP(q[1], q[0], q[3], q[2], [0, 0, 2, 2]); }
  }
  for (let k = 0; k < 10; k++) {
    const a0 = Math.PI - (k / 10) * Math.PI, a1 = Math.PI - ((k + 1) / 10) * Math.PI;
    const P = (lx, ly, lz) => [x + lx * c + lz * Math.sin(ar), gy + spring + ly, z - lx * s + lz * Math.cos(ar)];
    st.quadP(P(Math.cos(a0) * half, Math.sin(a0) * half, depth / 2), P(Math.cos(a0) * half, Math.sin(a0) * half, -depth / 2), P(Math.cos(a1) * half, Math.sin(a1) * half, -depth / 2), P(Math.cos(a1) * half, Math.sin(a1) * half, depth / 2), [0, 0, 1, 1]);
  }
  // attic, cornice, the ends, the inscription, a quadriga-ish crown
  block(st, x, gy + H, z, W + 1.2, 1.2, depth + 1.2, ar, 3);
  walls(st, x, gy + spring, z, W, spanH, depth, ar, 4, 4, 0, 0, 'lr');
  lid(A(B, M.roof), x, gy + H, z, W, depth, ar, 4);
  block(st, x, gy + H + 1.2, z, W * 0.6, 4, depth * 0.7, ar, 3);
  for (const fz of [-1, 1]) panel(A(B, M.sign), x + Math.sin(ar) * fz * (depth / 2 + 0.05), gy + H - 4.6, z + Math.cos(ar) * fz * (depth / 2 + 0.05), W * 0.7, 2.6, ar + (fz > 0 ? 0 : Math.PI), M.uv('victory'));
  const br = A(B, M.copper);
  blob(br, x, gy + H + 7.5, z, 2.2, 2.5, 3.2, 8, 4);
  br.box(x, gy + H + 5.2, z, 2.5, 1.2, 6.5, ar);
}

function drawObelisk(B, it, M) {
  const { x, z, gy, h } = it;
  const st = A(B, M.ashlar);
  block(st, x, gy - 1, z, 7, 1.6, 7, 0, 2);
  block(st, x, gy + 0.6, z, 5, 2.4, 5, 0, 2);
  const pts = place([[-1.6, -1.6], [1.6, -1.6], [1.6, 1.6], [-1.6, 1.6]], x, z, 0);
  polyWalls(st, place([[-1.6, -1.6], [1.6, -1.6], [1.6, 1.6], [-1.6, 1.6]], x, z, 0), gy + 3, gy + h - 3, 2, 2);
  void pts;
  const top = place([[-1.1, -1.1], [1.1, -1.1], [1.1, 1.1], [-1.1, 1.1]], x, z, 0);
  // the shaft tapers: a second, slimmer stage, then a pyramidion
  polyWalls(st, top, gy + h - 3, gy + h - 1.5, 2, 2);
  apex(A(B, M.copper), top, gy + h - 1.5, x, gy + h + 1.2, z, 2);
}

function drawLawn(B, it, M) {
  drape(A(B, M.lawn), B, it.poly, { lift: 0.05, step: 8, uv: 6 });
}

function drawPath(B, it, M) {
  const pts = it.pts.map((p) => [p[0], B.groundY(p[0], p[1]) + 0.09, p[1]]);
  ribbon(A(B, M.path), pts, it.w, { u: 4 });
}

function drawPond(B, it, M) {
  drape(A(B, M.pond), B, it.poly, { lift: 0.12, step: 6, uv: 24 });
  // a stone kerb round it
  const st = A(B, M.ashlar);
  const n = it.poly.length;
  for (let k = 0; k < n; k++) {
    const a = it.poly[k], b = it.poly[(k + 1) % n];
    const ya = B.groundY(a[0], a[1]), yb = B.groundY(b[0], b[1]);
    st.beam(a[0], (ya + yb) / 2 + 0.15, a[1], b[0], (ya + yb) / 2 + 0.15, b[1], 0.9, 0.45);
  }
}

function drawBandstand(B, it, M) {
  const { x, z, gy, r } = it;
  const st = A(B, M.ashlar);
  const pts = place(circle(r, 8, Math.PI / 8), x, z, 0);
  polyWalls(st, pts, gy - 0.5, gy + 1.0, 2, 2);
  polyCap(A(B, M.path), pts, gy + 1.0, true, 3);
  const pm = A(B, M.metal);
  for (const p of place(circle(r - 0.6, 8, Math.PI / 8), x, z, 0)) pm.cyl(p[0], gy + 1, p[1], 0.14, 3.6, 6);
  const roof = place(circle(r + 0.8, 8, Math.PI / 8), x, z, 0);
  polyWalls(A(B, M.trim), roof, gy + 4.6, gy + 5.1, 2, 2);
  apex(A(B, M.copper), roof, gy + 5.1, x, gy + 8.2, z, 3);
  A(B, M.copper).cyl(x, gy + 8.1, z, 0.15, 1.2, 5);
  // string lights round the eaves
  const gl = A(B, M.led);
  for (let k = 0; k < 8; k++) {
    const a = roof[k], b = roof[(k + 1) % 8];
    for (let q = 0; q < 5; q++) {
      const t = (q + 0.5) / 5;
      gl.box(a[0] + (b[0] - a[0]) * t, gy + 4.5, a[1] + (b[1] - a[1]) * t, 0.18, 0.18, 0.18);
    }
  }
}

function drawStatue(B, it, M) {
  const { x, z, gy } = it;
  const st = A(B, M.ashlar);
  block(st, x, gy - 1, z, 4.4, 1.4, 4.4, 0, 2);
  block(st, x, gy + 0.4, z, 3.2, 3.6, 3.2, 0, 2);
  panel(A(B, M.sign), x, gy + 1.6, z + 1.62, 1.2, 0.9, 0, M.uv('plaque'));
  // a bronze figure on a horse
  const br = A(B, M.copper);
  blob(br, x, gy + 5.6, z, 0.8, 0.75, 2.0, 6, 4);
  br.beam(x, gy + 6.2, z - 1.6, x, gy + 7.2, z - 2.3, 0.5, 0.6);
  for (const [a, b] of [[-0.45, -1.3], [0.45, -1.3], [-0.45, 1.3], [0.45, 1.3]]) br.beam(x + a, gy + 4, z + b, x + a * 0.9, gy + 5.4, z + b * 0.9, 0.22, 0.22);
  blob(br, x, gy + 7, z + 0.2, 0.42, 0.85, 0.42, 6, 4);
  blob(br, x, gy + 8.05, z + 0.25, 0.22, 0.26, 0.22, 6, 3);
  br.beam(x + 0.3, gy + 7.3, z + 0.2, x + 0.9, gy + 8.4, z - 0.4, 0.12, 0.12);
}

function drawParkWall(B, it, M) {
  const { x0, z0, x1, z1, y } = it;
  const len = Math.hypot(x1 - x0, z1 - z0);
  const ry = Math.atan2(x1 - x0, z1 - z0) + Math.PI / 2;
  block(A(B, M.ashlar), (x0 + x1) / 2, y - 0.6, (z0 + z1) / 2, len, 1.2, 0.7, ry, 2);
  const rl = N(B, M.metal);
  rl.beam(x0, y + 1.45, z0, x1, y + 1.45, z1, 0.06, 0.06);
  for (let s = 0; s <= len; s += 2.4) {
    const t = s / len;
    rl.cyl(x0 + (x1 - x0) * t, y + 0.6, z0 + (z1 - z0) * t, 0.035, 1.0, 4);
  }
}

function drawParkLamp(B, it, M) {
  const { x, z, y } = it;
  A(B, M.metal).cyl(x, y, z, 0.11, 3.6, 6, 0.07);
  A(B, M.metal).cyl(x, y, z, 0.22, 0.5, 6, 0.14);
  A(B, M.warm).box(x, y + 3.6, z, 0.4, 0.55, 0.4);
  A(B, M.metal).box(x, y + 4.15, z, 0.55, 0.12, 0.55);
}

function drawBench(B, it, M) {
  const { x, z, y, ry } = it;
  const fx = Math.sin(ry), fz = Math.cos(ry);
  const w = N(B, M.wood);
  w.box(x, y + 0.42, z, 1.9, 0.08, 0.5, ry);
  w.box(x - fx * 0.24, y + 0.5, z - fz * 0.24, 1.9, 0.45, 0.06, ry);
  const m = N(B, M.metal);
  for (const sd of [-1, 1]) m.box(x + Math.cos(ry) * sd * 0.8, y, z - Math.sin(ry) * sd * 0.8, 0.08, 0.45, 0.5, ry);
}

const LEAF = { elm: [0.2, 0.34, 0.14], linden: [0.24, 0.38, 0.15], plane: [0.26, 0.36, 0.16], pine: [0.12, 0.24, 0.12] };
function drawTree(B, it, M) {
  const leaf = A(B, M.leaf);
  const base = LEAF[it.kind] || LEAF.linden;
  const k = 0.85 + it.t * 0.3;
  leaf.col = [base[0] * k, base[1] * k, base[2] * k];
  tree(A(B, M.trunk), leaf, it.x, it.y, it.z, it.s, it.kind, it.t);
  leaf.col = [1, 1, 1];
  if (it.pit) {
    // a little iron guard round the pit
    const g = N(B, M.metal);
    const pts = place([[-0.8, -0.8], [0.8, -0.8], [0.8, 0.8], [-0.8, 0.8]], it.x, it.z, it.ry || 0);
    for (let q = 0; q < 4; q++) { const a = pts[q], b = pts[(q + 1) % 4]; rod(g, a[0], it.y + 0.45, a[1], b[0], it.y + 0.45, b[1], 0.04); }
  }
}

function drawSignal(B, it, M) {
  // an old-style post: signal heads on the post itself, the street's name on top
  const { x, z, y, ry } = it;
  const pm = A(B, M.metal);
  pm.cyl(x, y, z, 0.13, 4.9, 6, 0.1);
  pm.cyl(x, y, z, 0.24, 0.6, 6, 0.18);
  const fx = Math.sin(ry), fz = Math.cos(ry);
  const housing = N(B, M.metal);
  const lens = N(B, M.signal);
  for (const [hy, f] of [[3.0, 0.24], [3.0, -0.24]]) {
    const facing = f > 0 ? ry : ry + Math.PI;
    const hx = x + Math.sin(facing) * 0.24, hz = z + Math.cos(facing) * 0.24;
    housing.box(hx, y + hy, hz, 0.38, 1.1, 0.3, facing);
    if (f < 0) continue;
    const cols = [[1, 0.12, 0.08], [1, 0.62, 0.1], [0.15, 1, 0.65]];
    for (let L = 0; L < 3; L++) {
      lens.col = cols[L];
      panel(lens, hx + Math.sin(facing) * 0.16, y + hy + 0.78 - L * 0.34 - 0.13, hz + Math.cos(facing) * 0.16, 0.24, 0.26, facing, [it.ph, 0, it.ph, 1]);
    }
  }
  lens.col = [1, 1, 1];
  if (it.sign) {
    const sry = Math.atan2(it.ax, it.az) + Math.PI / 2;
    panel(A(B, M.sign), x, y + 4.95, z, 1.8, 0.34, sry, M.uv(it.sign));
    panel(A(B, M.sign), x, y + 4.95, z, 1.8, 0.34, sry + Math.PI, M.uv(it.sign));
  }
  void fx; void fz;
}

function drawFurniture(B, it, M) {
  const { x, z, y, ry } = it;
  switch (it.k) {
    case 'banner': {
      // a pair of red-and-gold banners on the lamp post
      const fl = A(B, M.trim);
      const lx = Math.cos(ry), lz = -Math.sin(ry);
      for (const sd of [-1, 1]) {
        fl.col = it.t ? [0.62, 0.08, 0.1] : [0.1, 0.16, 0.38];
        fl.box(x + lx * sd * 0.55, y + 4.0, z + lz * sd * 0.55, 0.9, 2.2, 0.05, ry + Math.PI / 2);
        fl.col = [0.85, 0.68, 0.28];
        fl.box(x + lx * sd * 0.55, y + 4.0, z + lz * sd * 0.55, 0.92, 0.18, 0.06, ry + Math.PI / 2);
      }
      fl.col = [1, 1, 1];
      break;
    }
    case 'hydrant': {
      const n = N(B, M.trim);
      n.col = [0.7, 0.12, 0.1];
      n.cyl(x, y, z, 0.16, 0.7, 6, 0.13);
      n.box(x, y + 0.42, z, 0.5, 0.12, 0.12, ry);
      n.col = [1, 1, 1];
      break;
    }
    case 'mailbox': {
      const n = N(B, M.trim);
      n.col = [0.12, 0.2, 0.5];
      n.box(x, y, z, 0.55, 1.05, 0.5, ry);
      n.cyl(x, y + 1.05, z, 0.27, 0.12, 8);
      n.col = [1, 1, 1];
      break;
    }
    case 'bench': {
      drawBench(B, { x, z, y, ry: ry + Math.PI }, M);
      break;
    }
    default: break;
  }
}

function drawCarriage(B, it, M) {
  const { x, z, y, ry } = it;
  const fx = Math.sin(ry), fz = Math.cos(ry);
  const b = N(B, M.trim);
  b.col = [0.08, 0.08, 0.1];
  b.box(x - fx * 0.8, y + 0.9, z - fz * 0.8, 1.5, 1.3, 2.2, ry);
  b.col = [0.55, 0.1, 0.1];
  b.box(x - fx * 0.8, y + 2.2, z - fz * 0.8, 1.6, 0.12, 2.0, ry);
  b.col = [0.82, 0.82, 0.78];
  // the horse
  blob(b, x + fx * 2.0, y + 1.45, z + fz * 2.0, 0.4, 0.45, 1.0, 6, 3);
  b.beam(x + fx * 2.7, y + 1.6, z + fz * 2.7, x + fx * 3.2, y + 2.3, z + fz * 3.2, 0.25, 0.35);
  for (const [a, c2] of [[-0.2, 1.4], [0.2, 1.4], [-0.2, 2.6], [0.2, 2.6]]) b.beam(x + fx * c2 + Math.cos(ry) * a, y, z + fz * c2 - Math.sin(ry) * a, x + fx * c2 + Math.cos(ry) * a, y + 1.2, z + fz * c2 - Math.sin(ry) * a, 0.12, 0.12);
  b.col = [1, 1, 1];
  const w = N(B, M.metal);
  for (const sd of [-1, 1]) w.cyl(x - fx * 0.8 + Math.cos(ry) * sd * 0.85, y + 0.55, z - fz * 0.8 - Math.sin(ry) * sd * 0.85, 0.55, 0.08, 10);
}

function drawBoathouse(B, it, M) {
  const { x, z, ry, w, d, gy, wy, dock } = it;
  const fx = Math.sin(ry), fz = Math.cos(ry);
  const W = toWorld(x, z, ry);
  const top = gy + 0.8, eave = top + 3.8;
  // a stone plinth, cream timber walls, the copper hip roof
  walls(A(B, M.ashlar), x, gy - 1.4, z, w + 0.6, 2.2, d + 0.6, ry, 3, 3);
  lid(A(B, M.ashlar), x, top, z, w + 0.6, d + 0.6, ry, 3);
  walls(A(B, M.cream), x, top, z, w, eave - top, d, ry, 2, 2);
  hip(A(B, M.copper), x, eave, z, w, d, 2.8, ry, { over: 0.9 });
  // a green band under the eaves, corner posts
  walls(A(B, M.boatGreen), x, eave - 0.45, z, w + 0.08, 0.45, d + 0.08, ry, 2, 2);
  for (const [a, b] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
    const [px, pz] = W(a * (w / 2 + 0.05), b * (d / 2 + 0.05));
    A(B, M.boatGreen).box(px, top, pz, 0.36, eave - top, 0.36, ry);
  }
  // lit windows all round: the door and windows to the lane, tall arches to the water
  const warm = A(B, M.warm);
  const face = (lx, lz, fr, ww, y0, h) => {
    const [px, pz] = W(lx, lz);
    panel(warm, px, y0, pz, ww, h, ry + fr);
  };
  for (const k of [-2, -1, 1, 2]) face(k * 3.2, d / 2 + 0.04, 0, 1.6, top + 1.0, 1.9);
  for (const k of [-1, 0, 1]) face(k * 4.6, -d / 2 - 0.04, Math.PI, 3.0, top + 0.4, 3.0);
  for (const sd of [-1, 1]) for (const k of [-1, 1]) face(sd * (w / 2 + 0.04), k * 2.4, sd * Math.PI / 2, 1.5, top + 1.0, 1.9);
  {
    const [px, pz] = W(0, d / 2 + 0.06);
    panel(A(B, M.boatGreen), px, top, pz, 1.8, 2.7, ry);
    panel(warm, px + fx * 0.02, top + 2.75, pz + fz * 0.02, 1.8, 0.5, ry);
    panel(A(B, M.sign), px + fx * 0.04, eave - 0.42, pz + fz * 0.04, 5.6, 1.17, ry, M.uv('boathouse'));
    // steps up to the door
    A(B, M.ashlar).box(px + fx * 1.1, gy - 0.2, pz + fz * 1.1, 3.0, 0.5, 1.4, ry);
    A(B, M.ashlar).box(px + fx * 0.5, gy - 0.2, pz + fz * 0.5, 3.0, 0.85, 1.0, ry);
  }
  // the lantern cupola on the ridge
  {
    const cy = eave + 2.3;
    walls(A(B, M.cream), x, cy, z, 1.8, 1.4, 1.8, ry, 2, 2);
    for (const fr of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
      const ox = Math.sin(ry + fr) * 0.92, oz = Math.cos(ry + fr) * 0.92;
      panel(warm, x + ox, cy + 0.25, z + oz, 1.2, 0.9, ry + fr);
    }
    hip(A(B, M.copper), x, cy + 1.4, z, 1.8, 1.8, 1.2, ry, { over: 0.25 });
  }
  // string lights along the long eaves
  const gl = A(B, M.led);
  for (const sd of [-1, 1]) {
    for (let k = 0; k <= 10; k++) {
      const [px, pz] = W(-w / 2 + (k / 10) * w, sd * (d / 2 + 0.95));
      gl.box(px, eave - 0.35 - 0.12 * Math.sin((k / 10) * Math.PI * 3) ** 2, pz, 0.16, 0.16, 0.16);
    }
  }
  // the dock: planks on posts out over the water, a lantern at its end
  const wood = A(B, M.wood);
  const [kx, kz] = W(0, -d / 2 - dock / 2);
  wood.box(kx, wy + 0.42, kz, 6, 0.24, dock, ry);
  for (const a of [-1, 1]) {
    for (let q = 0; q <= 3; q++) {
      const [px, pz] = W(a * 2.7, -d / 2 - (q / 3) * (dock - 0.4) - 0.2);
      wood.cyl(px, wy - 0.6, pz, 0.14, 1.05, 5);
    }
  }
  {
    const [px, pz] = W(2.4, -d / 2 - dock + 0.6);
    A(B, M.metal).cyl(px, wy + 0.66, pz, 0.07, 2.2, 5);
    A(B, M.warm).box(px, wy + 2.6, pz, 0.36, 0.48, 0.36);
    A(B, M.metal).box(px, wy + 3.08, pz, 0.48, 0.1, 0.48);
  }
  // rowboats tied up either side of it
  const hulls = [M.cream, M.boatGreen, M.boatRed];
  [[-4.6, -3.0, 0.08], [4.7, -5.6, -0.1], [-4.4, -7.4, 0.15]].forEach(([lx, lz, a], k) => {
    const [px, pz] = W(lx, -d / 2 + lz);
    const hull = A(B, hulls[k]);
    hull.box(px, wy + 0.02, pz, 1.25, 0.42, 3.7, ry + a);
    const bow = Math.sin(ry + a), bowz = Math.cos(ry + a);
    hull.box(px + bow * 2.0, wy + 0.06, pz + bowz * 2.0, 0.7, 0.36, 0.5, ry + a);
    A(B, M.wood).box(px, wy + 0.3, pz, 1.05, 0.08, 0.32, ry + a);
  });
}

function drawCoachHouse(B, it, M) {
  const { x, z, ry, w, d, gy, h } = it;
  const acc = A(B, M.mats.row);
  acc.col = it.tint;
  walls(acc, x, gy - 1, z, w, h + 1, d, ry, ROW_UW, ROW_VH, it.seed * 8, 0.12);
  acc.col = [1, 1, 1];
  const fx = Math.sin(ry), fz = Math.cos(ry);
  const tr = A(B, M.trim);
  // a carriage door, a hay-loft door above, a cornice, ivy
  tr.col = it.door;
  tr.box(x + fx * (d / 2 + 0.02), gy, z + fz * (d / 2 + 0.02), Math.min(3.4, w - 2), 3.1, 0.12, ry);
  tr.col = [0.85, 0.82, 0.74];
  tr.box(x + fx * (d / 2 + 0.25), gy + h - 0.6, z + fz * (d / 2 + 0.25), w + 0.1, 0.6, 0.5, ry);
  tr.col = [1, 1, 1];
  {
    // ivy climbing one corner: leafy clumps against the wall
    const lf = A(B, M.leaf);
    lf.col = [0.1, 0.2, 0.08];
    const side = it.seed % 2 ? 1 : -1;
    const ix = x + fx * (d / 2 + 0.3) + Math.cos(ry) * side * (w / 2 - 1.1), iz = z + fz * (d / 2 + 0.3) - Math.sin(ry) * side * (w / 2 - 1.1);
    for (let k = 0; k < 3; k++) blob(lf, ix - Math.cos(ry) * side * k * 0.35, gy + 1.2 + k * 1.9, iz + Math.sin(ry) * side * k * 0.35, 1.0 - k * 0.12, 1.3, 0.45, 5, 3);
    lf.col = [1, 1, 1];
  }
  lid(A(B, M.roof), x, gy + h, z, w, d, ry, 4);
  panel(A(B, M.warm), x + fx * (d / 2 + 0.05), gy + 3.6, z + fz * (d / 2 + 0.05), 1.2, 1.6, ry);
}
