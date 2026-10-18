// PORT HALCYON — CHINATOWN: dense walk-ups and shophouses wall to wall on
// short blocks, alleys through every other one, fire escapes, AC units and
// water tanks, tall lightbox signs stacked out over every pavement and neon
// boards over the shops (glyph-like blocks in red, pink, cyan, yellow),
// strings of red lanterns across every street, the DRAGON GATE over Grant
// Avenue, LANTERN SQUARE with its temple, seven-storey pagoda and night
// market, the teahouse behind Jade Alley and a garden on a roof.
import * as THREE from 'three';
import { litMat, plainMat, glowColorMat } from './builder.js';
import { cobbleTexture } from '../kit.js';
import { plasterTex, brickTex, tileTex, metalTex } from './oldquarter/tex.js';
import { ctWindows, ctShops, ctSigns, CTSHOP, CTS_V, CTS_H } from './oldquarter/cttex.js';
import { ctHouse, tank } from './oldquarter/cthouse.js';
import { lanternMat, lanternString, lantern, gate, temple, marketStall, phoneBooth, clutter, vent, steamMat, steam, dressLantern, teahouse } from './oldquarter/ctland.js';
import { frontage, corners, edgeKinds, lotPoly, ROAD, ITEM } from './oldquarter/plan.js';
import { drape, cylinder, box } from './builder.js';
import { bush, broadTree, cross } from './oldquarter/geo.js';
import { roadLamps } from '../build/roads.js';
import { CELL } from '../terrain.js';
import { makeRng } from '../../core/util.js';

// ------------------------------------------------------------------ the quarter's places

/** Lantern Square: the two-by-two blocks between Grant Ave and the alley, rows 14–16. */
const SQ = { x0: -360 + 4.4, x1: -80 - 12.8, z0: 865 + 9.4, z1: 1015 - 9.4 };
const GATE = { x: -80, z: 603 };
const TEA = { x: -220, z: 1432, w: 50, d: 34 };    // the teahouse court at the end of Jade Alley
const WEST_GATE = { x: -618, z: 1015 };

const PAINT = [[0.92, 0.88, 0.78], [0.7, 0.82, 0.7], [0.92, 0.66, 0.56], [0.95, 0.88, 0.58], [0.68, 0.8, 0.88], [0.76, 0.76, 0.74], [0.93, 0.92, 0.9], [0.62, 0.84, 0.76], [0.92, 0.7, 0.74], [0.85, 0.78, 0.66]];
const BRIGHT = [[0.45, 0.78, 0.76], [0.98, 0.84, 0.4], [0.95, 0.62, 0.7], [0.55, 0.78, 0.5], [0.95, 0.62, 0.36], [0.6, 0.72, 0.92]];
const BRICK = [[1, 1, 1], [0.82, 0.66, 0.56], [0.62, 0.52, 0.46], [0.95, 0.85, 0.75], [0.72, 0.58, 0.55]];
const TRIM = [[0.12, 0.32, 0.22], [0.6, 0.1, 0.08], [0.9, 0.86, 0.75], [0.1, 0.1, 0.1], [0.5, 0.5, 0.5], [0.18, 0.28, 0.45]];
const RAIL = [[0.2, 0.5, 0.3], [0.65, 0.12, 0.1], [0.9, 0.9, 0.88], [0.8, 0.62, 0.2]];
const TILE = [[0.16, 0.52, 0.32], [0.85, 0.62, 0.16], [0.75, 0.38, 0.25], [0.2, 0.36, 0.62]];
const NEON = [[1, 0.16, 0.3], [1, 0.3, 0.85], [0.16, 0.9, 1], [1, 0.82, 0.16], [0.5, 1, 0.35], [1, 0.55, 0.16]];
const NEON_HEX = ['#ff2a4c', '#ff4ad8', '#2ae6ff', '#ffd22a', '#80ff5a', '#ff8a2a'];

const pick = (P, a) => a[Math.floor(P.rng() * a.length) % a.length];
const jit = (P, c, k = 0.05) => c.map((v) => v * (1 - k + P.rng() * 2 * k));

// ------------------------------------------------------------------ plan

function plan(P) {
  // the places first: the square, the teahouse court
  P.claim((SQ.x0 + SQ.x1) / 2, (SQ.z0 + SQ.z1) / 2, SQ.x1 - SQ.x0, SQ.z1 - SQ.z0, 0);
  P.claim(TEA.x, TEA.z, TEA.w, TEA.d, 0);
  planSquare(P);
  planGates(P);
  planTeahouse(P);
  // corner buildings, then every street's frontage, then the backs of the blocks
  for (const C of corners(P, { size: [10, 15], water: true })) {
    const edges = edgeKinds(P, C.poly).map((e) => (e === 's' ? 's' : 'p'));
    makeBuilding(P, C, C.poly, edges, 'ten', { noRect: true, corner: true });
  }
  for (const r of P.roads()) {
    const t = r.rt.id;
    if (t !== 'street' && t !== 'avenue' && t !== 'alley' && t !== 'cobble') continue;
    const alley = t === 'alley', grant = t === 'avenue';
    for (const sd of [1, -1]) {
      const lots = frontage(P, r, sd, { width: alley ? [7, 12] : grant ? [7.5, 12] : [6.5, 11.5], depth: alley ? [9, 14] : grant ? [16, 23] : [14, 21], water: true });
      for (const L of lots) {
        const rr = P.rng();
        const kind = grant ? (rr < 0.32 ? 'shop' : rr < 0.62 ? 'ten' : rr < 0.84 ? 'rest' : 'mod') : alley ? (rr < 0.62 ? 'ten' : rr < 0.8 ? 'shop' : 'mod') : (rr < 0.5 ? 'ten' : rr < 0.74 ? 'shop' : rr < 0.88 ? 'mod' : 'rest');
        makeBuilding(P, L, null, null, kind, { alley });
      }
    }
  }
  for (const L of P.fill({ spacing: 22, width: [9, 14], depth: [8, 13], chance: 0.5, pad: 0.4, reach: 50 })) {
    makeBuilding(P, L, null, null, P.rng() < 0.8 ? 'ten' : 'mod', { rear: true });
  }
  planRoofGarden(P);
  planStrings(P);
  planStreetThings(P);
}

function makeBuilding(P, L, poly, edges, kind, o = {}) {
  const gy = L.y ?? (L.road ? L.road.Y[L.road.posAt(L.s ?? 0).i] : 6.2);
  const it = { type: 'ctb', map: 'building', x: L.x, z: L.z, w: L.w, d: L.d, ry: L.ry, kind, seed: Math.floor(P.rng() * 1e9), lit: 0.42 + P.rng() * 0.2, roadY: gy };
  if (kind === 'ten') {
    const brick = P.rng() < 0.55;
    it.wall = brick ? 'brick' : 'plaster';
    it.col = jit(P, brick ? pick(P, BRICK) : pick(P, PAINT));
    it.nf = 3 + Math.floor(P.rng() * 3); it.fh = 3.2; it.gf = 4.3;
    it.trim = pick(P, TRIM);
    it.fire = !o.rear && L.w > 6.5 && P.rng() < 0.4;
    it.tank = !o.rear && P.rng() < 0.16;
  } else if (kind === 'shop') {
    it.wall = 'plaster'; it.col = jit(P, pick(P, BRIGHT));
    it.nf = 2 + Math.floor(P.rng() * 2); it.fh = 3.4; it.gf = 4.4;
    it.trim = pick(P, TRIM); it.rail = pick(P, RAIL); it.tileCol = pick(P, TILE);
  } else if (kind === 'mod') {
    it.wall = 'plaster'; it.col = jit(P, [[0.88, 0.86, 0.8], [0.8, 0.82, 0.82], [0.9, 0.84, 0.72], [0.72, 0.74, 0.72]][Math.floor(P.rng() * 4)], 0.03);
    it.nf = 4 + Math.floor(P.rng() * 3); it.fh = 3.0; it.gf = 4.3;
    it.trim = [0.6, 0.6, 0.62];
    if (P.rng() < 0.4) it.billboard = Math.floor(P.rng() * CTS_H);
  } else {
    it.kind = 'rest';
    it.wall = 'plaster'; it.col = jit(P, [[0.72, 0.1, 0.08], [0.8, 0.16, 0.1], [0.62, 0.08, 0.1]][Math.floor(P.rng() * 3)], 0.03);
    it.nf = 1 + Math.floor(P.rng() * 2); it.fh = 3.4; it.gf = 4.8;
    it.trim = [0.85, 0.62, 0.18]; it.tileCol = TILE[0];
  }
  if (!poly) {
    const lp = lotPoly(L);
    const ek = edgeKinds(P, lp.poly);
    it.poly = lp.poly;
    it.edges = o.rear ? ['b', 'b', 'b', 'b'] : ['s', ek[1] === 's' ? 'w' : 'p', ek[2] === 's' ? 'w' : 'b', ek[3] === 's' ? 'w' : 'p'];
    if (o.rear) it.rear = true;
  } else { it.poly = poly; it.edges = edges; }
  if (L.ry !== undefined && !o.noRect) it.rect = { x: L.x, z: L.z, w: L.w, d: L.d, ry: L.ry };
  // shops along the front (none on the back of a block)
  if (!o.rear) {
    const nu = Math.max(1, Math.round(L.w / 5));
    it.shops = [];
    for (let u = 0; u < nu; u++) it.shops.push(kind === 'rest' ? pick(P, [0, 12, 1]) : o.alley ? pick(P, [9, 10, 3, 9, 1, 15, 11]) : Math.floor(P.rng() * CTSHOP.length));
    it.shopK = 0;
  }
  // signs: lightboxes out over the pavement, boards over the first floor
  it.signs = [];
  const front = it.edges.indexOf('s');
  if (front >= 0 && !o.rear) {
    const len = L.w;
    const nv = kind === 'ten' || kind === 'mod' ? (P.rng() < 0.35 ? 2 : 1) : kind === 'shop' && P.rng() < 0.5 ? 1 : 0;
    for (let q = 0; q < nv; q++) {
      const top = it.gf + it.nf * it.fh;
      const h = Math.min(top - it.gf - 1.2, 3.5 + P.rng() * 4);
      const y = gy + it.gf + 0.6 + P.rng() * Math.max(0, top - it.gf - 1.4 - h);
      const ci = Math.floor(P.rng() * NEON.length);
      it.signs.push({ k: front, kind: 'v', a: q === 0 ? 0.45 + P.rng() * 0.6 : len - 0.45 - P.rng() * 0.6, y: y + 0.12, h, w: 1.1 + P.rng() * 0.3, tile: Math.floor(P.rng() * CTS_V), neon: NEON[ci], hex: NEON_HEX[ci] });
    }
    if (kind !== 'mod' && P.rng() < (kind === 'rest' ? 1 : 0.4)) {
      const w = Math.min(len - 1, kind === 'rest' ? 7 : 3 + P.rng() * 2.5);
      const ci = Math.floor(P.rng() * NEON.length);
      it.signs.push({ k: front, kind: 'h', a: len / 2, y: gy + it.gf + 0.15, w, tile: Math.floor(P.rng() * CTS_H), neon: NEON[ci], hex: NEON_HEX[ci] });
    }
  }
  const top = it.gf + it.nf * it.fh + (kind === 'shop' ? 0 : 1);
  it.h = top;
  P.add(it);
  P.collider({ kind: 'box', x: L.x, z: L.z, hx: L.w / 2, hz: L.d / 2, ry: L.ry ?? 0, y0: gy - 3, y1: gy + top + 4 });
  const fc = it.wall === 'brick' ? '#6e3a2c' : kind === 'rest' ? '#7a1a14' : `#${new THREE.Color(it.col[0] * 0.7, it.col[1] * 0.68, it.col[2] * 0.64).getHexString()}`;
  P.far({ x: L.x, z: L.z, y: gy - 1.5, w: L.w, d: L.d, h: top + 1.5, ry: L.ry ?? 0, color: fc, lit: 0.48 });
  // the brightest signs throw their colour on the street (and show from afar)
  for (const s of it.signs) {
    if (s.kind !== 'v' || P.rng() > 0.09) continue;
    const c = Math.cos(L.ry), sn = Math.sin(L.ry);
    const lx = -L.w / 2 + s.a, lz = L.d / 2 + 1.0;
    const x = L.x + lx * c + lz * sn, z = L.z - lx * sn + lz * c;
    P.lamp({ x, z, y: gy, hx: x, hz: z, hy: s.y + s.h * 0.5, color: s.hex, radius: 11, intensity: 0.75, halo: 0 });
  }
  return it;
}

/** Lanterns across the streets: from building front to building front, every 16 m (zig-zag in the alleys). */
function planStrings(P) {
  const occ = P.occ;
  for (const r of P.roads()) {
    const t = r.rt.id;
    if (t !== 'street' && t !== 'avenue' && t !== 'alley') continue;
    const alley = t === 'alley';
    const reach = r.rt.hw + r.rt.shoulder + r.rt.walk + 0.15;
    const step = alley ? 12 : 16;
    const list = [];
    let k = 0;
    for (let s = r.trim0 + 9; s < r.length - r.trim1 - 9; s += step, k++) {
      const s2 = alley ? s + (k % 2 ? 5 : -5) : s;
      const a = r.posAt(s, reach), b = r.posAt(Math.max(r.trim0 + 2, Math.min(r.length - r.trim1 - 2, s2)), -reach);
      // a building to tie it to on both sides
      const ia = r.posAt(s, reach + 2), ib = r.posAt(s2, -reach - 2);
      if (!(occ.get(ia.x, ia.z) & ITEM) || !(occ.get(ib.x, ib.z) & ITEM)) continue;
      if (!P.inside(a.x, a.z) || !P.inside(b.x, b.z)) continue;
      const y = (a.y + b.y) / 2 + (alley ? 5.6 : 7.2) + P.rng() * 1.2;
      const sag = alley ? 0.9 : t === 'avenue' ? 2.3 : 1.6;
      list.push([a.x, y, a.z, b.x, y, b.z, sag]);
      if (k % 3 === 0) {
        const mx = (a.x + b.x) / 2, mz = (a.z + b.z) / 2;
        P.lamp({ x: mx, z: mz, y: a.y, hx: mx, hz: mz, hy: y - sag - 0.6, color: '#ff4a32', radius: alley ? 8 : 10, intensity: 0.65, halo: 1.0 });
      }
    }
    if (!list.length) continue;
    const mid = r.posAt(r.length / 2);
    P.add({ type: 'strings', x: mid.x, z: mid.z, list, road: r.spec.id });
  }
}

/** Lantern Square: paving, the temple compound and pagoda, the night market, the lantern pole. */
function planSquare(P) {
  const g = 6.1;
  // the paving, split at the cell line so each half's ground is its own cell's
  const cut = Math.floor(SQ.x1 / CELL) * CELL;
  for (const [x0, x1] of cut > SQ.x0 && cut < SQ.x1 ? [[SQ.x0, cut], [cut, SQ.x1]] : [[SQ.x0, SQ.x1]]) {
    P.add({ type: 'pave', map: 'plaza', x: (x0 + x1) / 2, z: (SQ.z0 + SQ.z1) / 2, w: x1 - x0, d: SQ.z1 - SQ.z0, ry: 0, poly: [[x0, SQ.z1], [x1, SQ.z1], [x1, SQ.z0], [x0, SQ.z0]] });
  }
  // the temple compound on the west of the square, its gate to the east
  const T = { type: 'temple', map: 'building', x: SQ.x0 + 42, z: (SQ.z0 + SQ.z1) / 2, g, ry: 0, w: 80, d: 118, pagoda: [-28, -42] };
  P.add(T);
  const hw = T.w / 2, hd = T.d / 2;
  for (const [cx, cz, w, d] of [[T.x, T.z - hd, T.w, 1.2], [T.x, T.z + hd, T.w, 1.2], [T.x - hw, T.z, 1.2, T.d], [T.x + hw, T.z - hd / 2 - 2.6, 1.2, hd - 5.2], [T.x + hw, T.z + hd / 2 + 2.6, 1.2, hd - 5.2]]) {
    P.collider({ kind: 'box', x: cx, z: cz, hx: w / 2, hz: d / 2, ry: 0, y0: g - 1, y1: g + 4 });
  }
  P.collider({ kind: 'box', x: T.x - hw + 22, z: T.z, hx: 11.5, hz: 17, ry: 0, y0: g - 1, y1: g + 16 });
  P.collider({ kind: 'circle', x: T.x + T.pagoda[0], z: T.z + T.pagoda[1], r: 8, y0: g - 1, y1: g + 45 });
  P.collider({ kind: 'circle', x: T.x - hw + 22 + 8.5 + 10, z: T.z, r: 1.6, y0: g - 1, y1: g + 3 });
  for (const sz of [-1, 1]) P.collider({ kind: 'box', x: T.x - hw + 22, z: T.z + sz * (hd - 8), hx: 8, hz: 4.5, ry: 0, y0: g - 1, y1: g + 8 });
  P.far({ x: T.x - hw + 22, z: T.z, y: g - 1, w: 23, d: 34, h: 16, color: '#8a2018', lit: 0.2 });
  const px = T.x + T.pagoda[0], pz = T.z + T.pagoda[1];
  P.far({ shape: 'cyl', x: px, z: pz, y: g, w: 13, d: 13, r: 6.5, r2: 3.0, h: 36, color: '#9a3a22', lit: 0.5 });
  P.far({ shape: 'cone', x: px, z: pz, y: g + 36, w: 5, d: 5, r: 2.5, h: 9, color: '#b08a30', lit: 0 });
  // floodlights on the hall and the pagoda; the pagoda's lanterns show from afar
  for (const [lx, lz, r, hy] of [[T.x - hw + 40, T.z - 8, 24, 1], [T.x - hw + 40, T.z + 8, 24, 1], [px + 10, pz + 6, 16, 1], [px, pz, 8, 20], [px, pz, 7, 34]]) {
    P.lamp({ x: lx, z: lz, y: g, hx: lx, hz: lz, hy: g + hy, color: hy > 10 ? '#ff6a3a' : '#ffc890', radius: r, intensity: 1.1, halo: 0 });
  }
  P.landmark({ id: 'temple', name: 'TIN HAU TEMPLE', x: T.x - 10, z: T.z, r: 60, kind: 'temple' });
  // the night market: rows of stalls under strings of bulbs, the lantern pole in the middle
  const M = { type: 'market', x: -205, z: (SQ.z0 + SQ.z1) / 2, g, stalls: [], posts: [] };
  const cols = [[0.78, 0.08, 0.08], [0.95, 0.75, 0.1], [0.12, 0.4, 0.75], [0.1, 0.5, 0.3], [0.92, 0.4, 0.1]];
  for (const z of [SQ.z0 + 14, SQ.z0 + 36, SQ.z1 - 36, SQ.z1 - 14]) {
    for (let x = SQ.x0 + 98; x <= SQ.x0 + 98 + 6 * 14; x += 14) {
      if (Math.hypot(x - M.x, z - M.z) < 14) continue;
      const ry = z < M.z ? 0 : Math.PI;
      M.stalls.push([x, z, ry, Math.floor(P.rng() * cols.length)]);
      P.collider({ kind: 'box', x, z, hx: 1.9, hz: 1.5, ry: 0, y0: g - 1, y1: g + 3 });
    }
  }
  M.cols = cols;
  P.collider({ kind: 'circle', x: M.x, z: M.z, r: 0.6, y0: g - 1, y1: g + 15 });
  for (let k = 0; k < 10; k++) {
    const a = (k / 10) * Math.PI * 2;
    const x = M.x + Math.cos(a) * 34, z = M.z + Math.sin(a) * 34 * 0.85;
    M.posts.push([x, z]);
    P.collider({ kind: 'circle', x, z, r: 0.25, y0: g - 1, y1: g + 7 });
  }
  P.lamp({ x: M.x, z: M.z, y: g, hx: M.x, hz: M.z, hy: g + 9, color: '#ff5a3a', radius: 30, intensity: 0.9, halo: 3 });
  for (const [dx, dz] of [[-30, -20], [30, -20], [-30, 20], [30, 20]]) P.lamp({ x: M.x + dx, z: M.z + dz, y: g, hx: M.x + dx, hz: M.z + dz, hy: g + 3.2, color: '#ffd8a0', radius: 12, intensity: 0.8, halo: 0 });
  P.add(M);
  P.landmark({ id: 'lantern', name: 'LANTERN SQUARE', x: M.x, z: M.z, r: 80, kind: 'square' });
  // the east end: trees in planters, benches, by Grant Ave
  const E = { type: 'plaza', x: SQ.x1 - 28, z: (SQ.z0 + SQ.z1) / 2, g, trees: [], posts: [] };
  // lantern posts along the square's north and south sides
  for (const z of [SQ.z0 + 4, SQ.z1 - 4]) {
    for (let x = SQ.x1 - 30; x > SQ.x0 + 92; x -= 24) {
      E.posts.push([x, z]);
      P.collider({ kind: 'circle', x, z, r: 0.25, y0: g - 1, y1: g + 5 });
      P.lamp({ x, z, y: g, hx: x, hz: z, hy: g + 4.3, color: '#ff7a50', radius: 13, intensity: 0.75, halo: 1.1 });
    }
  }
  for (let z = SQ.z0 + 12; z < SQ.z1 - 6; z += 18) for (const x of [SQ.x1 - 46, SQ.x1 - 14]) { E.trees.push([x, z]); P.collider({ kind: 'circle', x, z, r: 1.2, y0: g - 1, y1: g + 7 }); }
  P.add(E);
}

function planGates(P) {
  // the Dragon Gate over Grant Ave, a smaller one on the way in from Old Town
  const r = P.net.byId.get('c_v_7_10');
  const g = r ? r.posAt(GATE.z - 565).y : 6.1;
  P.add({ type: 'gate', x: GATE.x, z: GATE.z, g, ry: 0, half: 8.1, outer: 11.7, grand: true });
  for (const sx of [-1, 1]) for (const [cx, rr] of [[8.1, 0.65], [11.7, 0.6]]) P.collider({ kind: 'circle', x: GATE.x + sx * cx, z: GATE.z, r: rr, y0: g - 1, y1: g + 10 });
  for (const sx of [-1, 1]) P.lamp({ x: GATE.x + sx * 6, z: GATE.z, y: g, hx: GATE.x + sx * 6, hz: GATE.z, hy: g + 6.2, color: '#ff4a2a', radius: 12, intensity: 0.7, halo: 1.3 });
  P.far({ x: GATE.x, z: GATE.z, y: g + 6, w: 27, d: 2.4, h: 6, color: '#2a6a44', lit: 0 });
  P.landmark({ id: 'gate', name: 'DRAGON GATE', x: GATE.x, z: GATE.z, r: 40, kind: 'gate' });
  const w = P.net.byId.get('c_h_3_16');
  const gw = w ? w.posAt(22).y : 6.1;
  P.add({ type: 'gate', x: WEST_GATE.x, z: WEST_GATE.z, g: gw, ry: Math.PI / 2, half: 6.0, outer: 8.6, grand: false });
  for (const sz of [-1, 1]) for (const cz of [6.0, 8.6]) P.collider({ kind: 'circle', x: WEST_GATE.x, z: WEST_GATE.z + sz * cz, r: 0.55, y0: gw - 1, y1: gw + 8 });
}

/** The teahouse court at the end of Jade Alley (hidden), the garden on a roof by it. */
function planTeahouse(P) {
  const g = 6.0;
  // (ry 0: its local −z, the moon gate's side, is north, where the alley comes in)
  P.add({ type: 'teahouse', x: TEA.x, z: TEA.z, g, ry: 0, w: TEA.w, d: TEA.d });
  // its walls (all but the moon gate) and the pavilion
  const hw = TEA.w / 2, hd = TEA.d / 2;
  for (const [cx, cz, w, d] of [[TEA.x, TEA.z + hd, TEA.w, 0.6], [TEA.x - hw, TEA.z, 0.6, TEA.d], [TEA.x + hw, TEA.z, 0.6, TEA.d], [TEA.x - hw / 2 - 1.6, TEA.z - hd, hw - 3.2, 0.6], [TEA.x + hw / 2 + 1.6, TEA.z - hd, hw - 3.2, 0.6]]) {
    P.collider({ kind: 'box', x: cx, z: cz, hx: w / 2, hz: d / 2, ry: 0, y0: g - 1, y1: g + 5 });
  }
  P.collider({ kind: 'box', x: TEA.x, z: TEA.z + hd - 9, hx: 7.2, hz: 4.2, ry: 0, y0: g - 1, y1: g + 11 });
  P.lamp({ x: TEA.x, z: TEA.z, y: g, hx: TEA.x, hz: TEA.z, hy: g + 3.5, color: '#ffb070', radius: 16, intensity: 1, halo: 0 });
  P.lamp({ x: TEA.x, z: TEA.z - hd - 2, y: g, hx: TEA.x, hz: TEA.z - hd - 2, hy: g + 4.5, color: '#ff5a3a', radius: 9, intensity: 0.8, halo: 1.8 });
  P.landmark({ id: 'teahouse', name: 'JADE TEAHOUSE', x: TEA.x, z: TEA.z, r: 30, kind: 'teahouse', hidden: true });
}

function planRoofGarden(P) {
  // the tallest walk-up on the corner by Jade Alley gets a garden on its roof
  let best = null;
  const cx = Math.floor(-240 / CELL), cz = Math.floor(1400 / CELL);
  for (const it of P.D.items.get(`${cx},${cz}`) || []) {
    if (it.type !== 'ctb' || it.pack !== 'chinatown' || (it.kind !== 'ten' && it.kind !== 'mod')) continue;
    const d = Math.hypot(it.x - -248, it.z - 1402);
    if (d < 30 && (!best || d < best.d)) best = { it, d };
  }
  if (!best) return;
  const it = best.it;
  it.roofGarden = true; it.tank = false; it.billboard = undefined;
  P.landmark({ id: 'skygarden', name: 'SKY GARDEN', x: it.x, z: it.z, r: 28, kind: 'garden', hidden: true });
  P.lamp({ x: it.x, z: it.z, y: it.roadY + it.h, hx: it.x, hz: it.z, hy: it.roadY + it.h + 2.5, color: '#ffb880', radius: 10, intensity: 0.9, halo: 2 });
}

/** Phone booths on Grant Ave's corners, clutter down the alleys. */
function planStreetThings(P) {
  const things = new Map();
  const add = (x, z, t) => {
    const k = `${Math.floor(x / CELL)},${Math.floor(z / CELL)}`;
    let a = things.get(k);
    if (!a) { a = { type: 'things', x, z, list: [] }; things.set(k, a); }
    a.list.push(t);
  };
  for (const r of P.roads()) {
    const t = r.rt.id;
    if (t === 'avenue') {
      for (const s of [r.trim0 + 3, r.length - r.trim1 - 3]) {
        if (P.rng() < 0.5) continue;
        for (const sd of [1, -1]) {
          if (P.rng() < 0.5) continue;
          const p = r.posAt(s, sd * (r.rt.hw + 1.2));
          add(p.x, p.z, ['booth', p.x, p.y + 0.15, p.z, Math.atan2(r.TX[p.i], r.TZ[p.i])]);
          P.collider({ kind: 'circle', x: p.x, z: p.z, r: 0.7, y0: p.y - 1, y1: p.y + 3 });
        }
      }
    }
    if (t === 'alley') {
      for (let s = r.trim0 + 6; s < r.length - r.trim1 - 6; s += 16 + P.rng() * 14) {
        const sd = P.rng() < 0.5 ? 1 : -1;
        const edge = r.rt.hw + r.rt.shoulder;
        const q = r.posAt(s, sd * (edge + 1.0));
        if (!(P.occ.get(q.x, q.z) & ITEM)) continue;
        const ry = Math.atan2(r.TX[q.i], r.TZ[q.i]);
        if (P.rng() < 0.45) {
          // a kitchen's exhaust on the wall, steaming
          const v = r.posAt(s, sd * (edge + 0.75));
          add(v.x, v.z, ['vent', v.x, v.y, v.z, Math.atan2(-r.LX[v.i] * sd, -r.LZ[v.i] * sd)]);
          continue;
        }
        // dumpsters and crates against the wall (out of the lane)
        const p = r.posAt(s, sd * (edge + 0.45));
        add(p.x, p.z, ['clutter', p.x, p.y, p.z, ry + (P.rng() - 0.5) * 0.3]);
        P.collider({ kind: 'circle', x: p.x, z: p.z, r: 0.75, y0: p.y - 1, y1: p.y + 1.4 });
      }
    }
  }
  for (const a of things.values()) P.add(a);
}

// ------------------------------------------------------------------ materials

function mats(B) {
  return {
    plaster: B.mat('plaster', () => litMat({ map: plasterTex(), vertexColors: true, roughness: 0.9 }, { glow: 1.25 })),
    brick: B.mat('brick', () => litMat({ map: brickTex(), vertexColors: true, roughness: 0.9 }, { glow: 1.6 })),
    // (roofs, windows and signs take no baked lamp light: lit by their own glow, and the bake is lighter for it)
    tile: B.mat('tile', () => plainMat({ map: tileTex(), vertexColors: true, roughness: 0.45, metalness: 0.15 })),
    win: B.mat('win', () => { const t = ctWindows(); return plainMat({ map: t.map, emissive: 0xffffff, emissiveMap: t.emi, vertexColors: true, roughness: 0.3, metalness: 0.1, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2 }, { night: 1.35 }); }),
    shop: B.mat('shop', () => { const t = ctShops(); return litMat({ map: t.map, emissive: 0xffffff, emissiveMap: t.emi, roughness: 0.45, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2 }, { night: 1.6 }); }),
    sign: B.mat('sign', () => { const t = ctSigns(); const m = plainMat({ map: t.map, emissive: 0xffffff, emissiveMap: t.emi, roughness: 0.4, vertexColors: true, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2 }, { night: 2.4 }); return m; }),
    neon: B.mat('neon', () => { const m = glowColorMat('#ffffff', 2.6); m.vertexColors = true; m.side = THREE.DoubleSide; return m; }),
    lantern: B.mat('lantern', lanternMat),
    steam: B.mat('steam', steamMat),
    paint: B.mat('paint', () => litMat({ vertexColors: true, roughness: 0.7 })),
    // (the same paint, unlit by the lamps: roofs, tanks, cornices, sign brackets, wires)
    trim: B.mat('trim', () => plainMat({ vertexColors: true, roughness: 0.7 })),
    metal: B.mat('metal', () => litMat({ map: metalTex(), vertexColors: true, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.5, metalness: 0.5 }, { shadow: false })),
    leaf: B.mat('leaf', () => litMat({ vertexColors: true, roughness: 0.85, flatShading: true })),
    pave: B.mat('pave', () => litMat({ map: cobbleTexture(), vertexColors: true, roughness: 0.8, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -3 })),
    water: B.mat('water', () => litMat({ color: 0x1a4a5a, roughness: 0.06, metalness: 0.3, emissive: 0x3ab0a0, vertexColors: true }, { night: 0.35 })),
  };
}

function kit(B) {
  const M = mats(B);
  const K = {};
  for (const [k, m] of Object.entries(M)) { m.name = 'ct:' + k; K[k] = B.acc(m); }
  K.near = {};
  for (const k of ['paint', 'leaf', 'metal', 'win', 'tile', 'neon', 'trim']) K.near[k] = B.near(M[k]);
  K.lanternNear = B.near(M.lantern);
  K.steam = B.near(M.steam);
  K.lanternFn = lantern;
  K.M = M;
  return K;
}

// ------------------------------------------------------------------ build

function* build(B, items) {
  const K = kit(B);
  // (yield every couple of milliseconds: the streamer runs a few a frame)
  let t0 = performance.now();
  for (const it of items) {
    if (it.type === 'ctb') {
      const g = B.groundY(it.x, it.z);
      const ry = it.roadY ?? g;
      it.y0 = Math.min(g, ry) - 1.2;
      it.gy = Math.max(g, ry) + 0.12;
      ctHouse(K, it);
      if (it.roofGarden) roofGarden(K, it);
    } else if (it.type === 'strings') {
      // the lanterns themselves close up only (the strings' lamps light the street from afar)
      const L = { ...K, lantern: K.lanternNear };
      for (const [ax, ay, az, bx, by, bz, sag] of it.list) lanternString(L.lantern, K.near.trim, [ax, ay, az], [bx, by, bz], sag, 2.9, ax * 0.1);
    } else if (it.type === 'pave') {
      // (a strip at a time: draping the square in one go is too long a step)
      K.pave.col = [0.78, 0.46, 0.4];
      const xs = it.poly.map((p) => p[0]), zs = it.poly.map((p) => p[1]);
      const x0 = Math.min(...xs), x1 = Math.max(...xs), z0 = Math.min(...zs), z1 = Math.max(...zs);
      const n = Math.max(1, Math.round((x1 - x0) / 40));
      for (let q = 0; q < n; q++) {
        const a = x0 + (x1 - x0) * q / n, b = x0 + (x1 - x0) * (q + 1) / n;
        drape(K.pave, B, [[a, z1], [b, z1], [b, z0], [a, z0]], { lift: 0.07, step: 6, uv: 3 });
        yield;
      }
      t0 = performance.now();
    } else if (it.type === 'temple') {
      temple(K, it);
    } else if (it.type === 'market') {
      market(K, it);
    } else if (it.type === 'plaza') {
      for (const [x, z] of it.posts || []) {
        K.paint.col = [0.62, 0.07, 0.05];
        cylinder(K.paint, x, it.g - 0.2, z, 0.13, 4.6, 6, { r2: 0.08 });
        K.paint.col = [0.8, 0.6, 0.18];
        cylinder(K.paint, x, it.g + 4.2, z, 0.3, 0.06, 6, { top: true });
        K.lantern.col = [1, 1, 1];
        lantern(K.lantern, x, it.g + 4.15, z, x * 0.3, 1.25);
      }
      for (const [x, z] of it.trees) {
        K.paint.col = [0.55, 0.1, 0.08];
        cylinder(K.paint, x, it.g - 0.2, z, 1.1, 0.75, 8, { top: true });
        broadTree(K.paint, K.leaf, x, it.g + 0.5, z, 0.85, makeRng(Math.floor(x * 7 + z)), [0.22, 0.45, 0.2], { lumps: 3, trunk: 2.6 });
      }
    } else if (it.type === 'gate') {
      gate(K, it);
    } else if (it.type === 'teahouse') {
      teahouse(K, it);
    } else if (it.type === 'things') {
      const rng = makeRng(Math.floor(it.x * 3 + it.z));
      for (const [t, x, y, z, ry] of it.list) {
        if (t === 'booth') phoneBooth(K, x, y, z, ry);
        else if (t === 'vent') vent(K, x, y, z, ry, rng);
        else clutter(K, x, y, z, ry, rng);
      }
    }
    if (performance.now() - t0 > 1.5) { yield; t0 = performance.now(); }
  }
  // dress the road builder's red street lanterns standing in this cell
  yield;
  dressLamps(B, K);
}

function dressLamps(B, K) {
  const x0 = B.x0, z0 = B.z0;
  const seen = new Set();
  for (let gx = Math.floor(x0 / 32); gx < Math.floor((x0 + CELL) / 32); gx += 2) {
    for (let gz = Math.floor(z0 / 32); gz < Math.floor((z0 + CELL) / 32); gz += 2) {
      for (const n of [B.net.near(gx * 32 + 32, gz * 32 + 32, 46)]) {
        for (const r of n.keys()) {
          if (seen.has(r)) continue;
          seen.add(r);
          for (const L of roadLamps(r)) {
            if (L.style !== 'lantern') continue;
            if (Math.floor(L.x / CELL) !== B.cx || Math.floor(L.z / CELL) !== B.cz) continue;
            dressLantern(K, L);
          }
        }
      }
    }
  }
}

/** The night market: stalls, the lantern pole and its strings out to the posts. */
function market(K, it) {
  const rng = makeRng(77);
  for (const [x, z, ry, ci] of it.stalls) {
    marketStall(K, x, it.g, z, ry, it.cols[ci], rng);
    // the food stalls' woks steam
    if (rng() < 0.4) steam(K.steam, x, it.g + 1.15, z, 4, 1.0, 1.8, Math.floor(x * 3 + z));
  }
  const g = it.g;
  K.paint.col = [0.66, 0.08, 0.06];
  cylinder(K.paint, it.x, g - 0.2, it.z, 0.42, 14.5, 8, { r2: 0.3 });
  K.paint.col = [0.85, 0.62, 0.18];
  cylinder(K.paint, it.x, g + 14.3, it.z, 0.6, 0.4, 8, { top: true });
  lantern(K.lantern, it.x, g + 14.2, it.z, 0, 2.2);
  for (const [x, z] of it.posts) {
    K.paint.col = [0.6, 0.08, 0.06];
    cylinder(K.paint, x, g - 0.2, z, 0.14, 7.2, 6);
    lanternString(K.lantern, K.near.paint, [it.x, g + 13.4, it.z], [x, g + 6.9, z], 1.4, 2.0, x);
  }
}

/** A garden on a roof: planters, shrubs and little trees, a pergola under bulbs, lanterns. */
function roofGarden(K, it) {
  const L = it.rect;
  if (!L) return;
  const top = it.gy + it.gf + it.nf * it.fh + 1.0;
  const c = Math.cos(L.ry), s = Math.sin(L.ry);
  const W = (lx, lz) => [L.x + lx * c + lz * s, L.z - lx * s + lz * c];
  const rng = makeRng(it.seed + 5);
  for (let q = 0; q < 10; q++) {
    const lx = (rng() - 0.5) * (L.w - 3), lz = (rng() - 0.5) * (L.d - 3);
    const p = W(lx, lz);
    K.paint.col = [0.52, 0.32, 0.22];
    box(K.paint, p[0], top - 0.05, p[1], 1.4, 0.55, 1.4, L.ry, { u: 1 });
    if (q % 3 === 0) broadTree(K.paint, K.leaf, p[0], top + 0.5, p[1], 0.5, rng, [0.25, 0.5, 0.22], { lumps: 2, trunk: 2 });
    else bush(K.leaf, p[0], top + 0.45, p[1], 0.7, 0.9, [0.22 + rng() * 0.1, 0.5, 0.2]);
  }
  // the pergola and its bulbs, two lantern strings across the roof
  K.paint.col = [0.3, 0.2, 0.14];
  for (const [lx, lz] of [[-2.5, -2], [2.5, -2], [2.5, 2], [-2.5, 2]]) { const p = W(lx, lz); cylinder(K.paint, p[0], top, p[1], 0.08, 2.6, 4); }
  for (const lz of [-2, 0, 2]) { const a = W(-2.8, lz), b = W(2.8, lz); K.paint.beam(a[0], top + 2.6, a[1], b[0], top + 2.6, b[1], 0.1, 0.1); }
  for (let k = 0; k < 12; k++) { const p = W(-2.6 + k * 0.47, (k % 2 ? 1 : -1) * 1.1); cross(K.neon, p[0], top + 2.4, p[1], 0.07, 0.14); }
  const A = W(-L.w / 2 + 0.5, -L.d / 2 + 0.5), Bq = W(L.w / 2 - 0.5, L.d / 2 - 0.5);
  lanternString(K.lantern, K.near.paint, [A[0], top + 3, A[1]], [Bq[0], top + 3, Bq[1]], 0.6, 1.8, 3);
  void tank;
}

export default {
  id: 'chinatown',
  plan,
  warm(B) { mats(B); },
  build,
};

void ROAD;
