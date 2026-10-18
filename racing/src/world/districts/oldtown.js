// PORT HALCYON — OLD TOWN: the historic quarter on the river. Narrow stone,
// plaster, brick and half-timbered houses wall to wall along cobbled
// streets (zinc mansards and dormers, chimney stacks, shutters, window
// boxes, café awnings and terraces, carriage doors), chamfered corner
// blocks with domed turrets, the river between stone quays with its arched
// bridges, barges and steps down to the water, ST. CECILIA'S cathedral, the
// clock tower over the market square, the gardens on the old bastion; down
// a lane under the quai, LE PETIT PORT (a café barge), and up the towpath,
// THE OLD MILL with its turning wheel.
import * as THREE from 'three';
import { OLDTOWN } from '../map/areas/oldtown.js';
import { litMat, plainMat, glowColorMat } from './builder.js';
import { cobbleTexture } from '../kit.js';
import { groundTexture } from '../../track/textures.js';
import { cylinder, sphere } from './builder.js';
import { plasterTex, brickTex, stoneTex, slateTex, tileTex, metalTex } from './oldquarter/tex.js';
import { otWindows, otShops, OTS } from './oldquarter/ottex.js';
import { house, CAFE } from './oldquarter/othouse.js';
import { frontage, corners, edgeKinds, lotPoly, ROAD } from './oldquarter/plan.js';
import { rectPoly, broadTree, catenary, cross, wire } from './oldquarter/geo.js';
import { cathedral, clockTower, paved, fountain, carousel, stall, clippedTree, bench, railingRound, bandstand } from './oldquarter/otland.js';
import { planRiver, bridgeLayout, bankPt, riverS, quayTop, WALL_D, TOP_W } from './oldquarter/river.js';
import { quay, bridge, boat, mooring, lampPost } from './oldquarter/riverbuild.js';
import { portWalls, mill, kiosk, morris, bollard, bookBox, gasLamp } from './oldquarter/otport.js';
import { otSigns } from './oldquarter/ottex.js';
import { roadLamps } from '../build/roads.js';
import { CELL } from '../terrain.js';
import { makeRng } from '../../core/util.js';
import { natural } from '../terrain.js';

const G = OLDTOWN;
const [R0x, R0z] = G.R0;
/** Grid frame: local x along the streets across the river (u), local z down the river (v). */
const RY = Math.atan2(G.E[1] * -1, G.E[0]);
const toUV = (x, z) => [(x - R0x) * G.E[0] + (z - R0z) * G.E[1], (x - R0x) * G.D[0] + (z - R0z) * G.D[1]];
const PUV = G.P;

// ------------------------------------------------------------------ palettes

const PLASTER = [[0.95, 0.9, 0.78], [0.93, 0.76, 0.48], [0.93, 0.72, 0.64], [0.86, 0.58, 0.42], [0.97, 0.88, 0.62], [0.74, 0.8, 0.68], [0.72, 0.79, 0.86], [0.95, 0.94, 0.9], [0.95, 0.7, 0.56], [0.8, 0.76, 0.82], [0.9, 0.82, 0.7], [0.82, 0.52, 0.4]];
const BRICK = [[1, 1, 1], [0.8, 0.7, 0.64], [0.66, 0.58, 0.55], [1.06, 0.96, 0.84], [0.9, 0.8, 0.72]];
const STONE = [[0.9, 0.85, 0.76], [0.9, 0.82, 0.66], [0.82, 0.81, 0.78], [0.86, 0.83, 0.77], [0.8, 0.76, 0.68]];
const TRIM_WHITE = [[0.96, 0.95, 0.92], [0.92, 0.9, 0.84], [0.85, 0.86, 0.84]];
const TRIM_COL = [[0.3, 0.5, 0.36], [0.36, 0.5, 0.66], [0.52, 0.6, 0.66], [0.52, 0.18, 0.16], [0.56, 0.64, 0.5], [0.56, 0.52, 0.66], [0.3, 0.42, 0.5], [0.95, 0.94, 0.9]];
const ZINC = [[0.6, 0.65, 0.7], [0.5, 0.54, 0.6], [0.66, 0.68, 0.7]];
const SLATE = [[0.42, 0.44, 0.5], [0.36, 0.38, 0.43], [0.48, 0.5, 0.54]];
const TERRA = [[0.86, 0.48, 0.32], [0.74, 0.4, 0.28], [0.9, 0.58, 0.4], [0.62, 0.36, 0.26]];
/** How the plaster houses read from far off (their palette, in shadow). */
const FAR_PLASTER = ['#b39d80', '#b08a5c', '#ae8478', '#a0705a', '#b8a272', '#8c9680', '#8a96a2', '#b2ae a6'.replace(' ', ''), '#b4846c'];
const DOORS = [[0.2, 0.3, 0.24], [0.42, 0.14, 0.12], [0.16, 0.2, 0.32], [0.3, 0.22, 0.16], [0.12, 0.12, 0.13]];

const pick = (P, a) => a[Math.floor(P.rng() * a.length) % a.length];
/** Roads that run through open country: no houses along them. */
const RURAL = new Set(['highway', 'freeway', 'coastal', 'dirt', 'gravel', 'service', 'mountain']);
const jit = (P, c, k = 0.04) => c.map((v) => v * (1 - k + P.rng() * 2 * k));

// shopfront picks: cafés and bakeries often, the rest now and then
const SHOP_W = [5, 3, 3, 1.5, 2, 2, 1.5, 1.5, 1.5, 2, 1.2, 1.5, 1, 1.5, 1.2, 3];
function pickShop(P, cafeBoost = 1) {
  let tot = 0;
  for (let i = 0; i < SHOP_W.length; i++) tot += SHOP_W[i] * (CAFE.has(i) ? cafeBoost : 1);
  let r = P.rng() * tot;
  for (let i = 0; i < SHOP_W.length; i++) { r -= SHOP_W[i] * (CAFE.has(i) ? cafeBoost : 1); if (r <= 0) return i; }
  return 0;
}

// ------------------------------------------------------------------ the quarter's places

const BLOCK = (i, j) => ({ u0: G.COLS_U[i], u1: G.COLS_U[i + 1], v0: G.ROW_V[j], v1: G.ROW_V[j + 1] });
/** Inside the town's street grid (not the meadows round it). */
const inGrid = (u, v) => u > G.COLS_U[0] && u < G.COLS_U[G.COLS_U.length - 1] && v > G.ROW_V[0] && v < G.ROW_V[G.ROW_V.length - 1];
/** Where things are along the river (s along its centreline, side +1 east, −1 west). */
const MILL = { side: 1, s0: 652, s1: 670 };
const PORT = { side: -1, s0: 1380, s1: 1500, barge: 1452 };
export const PLACES = {
  cathedral: BLOCK(6, 3),
  parvis: BLOCK(5, 3),
  market: BLOCK(1, 7),
  garden: BLOCK(5, 9),
};
const blockRect = (b, pad = 7.9) => {
  const [x, z] = PUV((b.u0 + b.u1) / 2, (b.v0 + b.v1) / 2);
  return { x, z, w: b.u1 - b.u0 - 2 * pad, d: b.v1 - b.v0 - 2 * pad, ry: RY };
};

// ------------------------------------------------------------------ plan

function character(P, L, roadKind) {
  // neighbourhoods: stone blocks on the river and the main streets, colour
  // to the south, brick and timber round the market
  const [u, v] = toUV(L.x, L.z);
  const n = P.noise(L.x / 260, L.z / 260);
  const mk = PLACES.market;
  const dm = Math.hypot(u - (mk.u0 + mk.u1) / 2, v - (mk.v0 + mk.v1) / 2);
  const grand = roadKind === 'grand' || L.x > -1075;
  const r = P.rng();
  if (grand) return r < 0.72 ? 'haus' : r < 0.9 ? 'plaster' : 'brick';
  if (dm < 230) return r < 0.32 ? 'timber' : r < 0.62 ? 'brick' : 'plaster';
  if (v > 1500) return r < 0.62 ? 'plaster' : r < 0.82 ? 'brick' : 'haus';
  if (n > 0.15) return r < 0.5 ? 'brick' : r < 0.8 ? 'plaster' : 'haus';
  return r < 0.45 ? 'plaster' : r < 0.75 ? 'haus' : 'brick';
}

function makeHouse(P, L, poly, edges, kind, extra = {}, over = null) {
  // (the ground here is the town's flat: the road in front says how high)
  const gy = L.y ?? (L.road ? L.road.Y[L.road.posAt(L.s ?? 0).i] : natural(L.x, L.z));
  const g = { lo: gy - 0.8, hi: gy + 0.6 };
  const it = { type: 'house', map: 'building', x: L.x, z: L.z, w: L.w, d: L.d, ry: L.ry, poly, edges, kind, seed: Math.floor(P.rng() * 1e9), lit: 0.3 + P.rng() * 0.18, roadY: gy, ped: P.rng() < 0.5, ...extra };
  if (kind === 'haus' || kind === 'corner') {
    it.wall = 'stone'; it.col = jit(P, pick(P, STONE)); it.baseCol = it.col;
    it.nf = 4 + (P.rng() < 0.45 ? 1 : 0); it.fh = 3.2; it.gf = 4.6;
    it.trim = jit(P, pick(P, TRIM_WHITE), 0.02); it.roof = 'mansard'; it.roofMat = 'slate'; it.roofCol = pick(P, ZINC);
    it.shut = P.rng() < 0.15 ? 1 : 0;
  } else if (kind === 'plaster') {
    it.wall = 'plaster'; it.col = jit(P, pick(P, PLASTER));
    it.nf = 2 + Math.floor(P.rng() * 3); it.fh = 3.1; it.gf = 4.2;
    it.trim = pick(P, TRIM_COL); it.shut = P.rng() < 0.7 ? (P.rng() < 0.3 ? 2 : 1) : 0;
    const rr = P.rng();
    it.roof = rr < 0.4 ? 'mansard' : rr < 0.7 ? 'hip' : 'gable';
    it.roofMat = it.roof === 'mansard' ? 'slate' : 'tile';
    it.roofCol = it.roofMat === 'slate' ? pick(P, SLATE) : pick(P, TERRA);
    it.boxes = it.shut ? 0.4 : 0.15;
  } else if (kind === 'brick') {
    it.wall = 'brick'; it.col = jit(P, pick(P, BRICK));
    it.nf = 2 + Math.floor(P.rng() * 2); it.fh = 3.0; it.gf = 4.0;
    it.trim = jit(P, pick(P, TRIM_WHITE), 0.02); it.shut = 0;
    it.roof = L.w < 10 && P.rng() < 0.75 ? 'fgable' : 'gable';
    it.roofMat = P.rng() < 0.6 ? 'slate' : 'tile';
    it.roofCol = it.roofMat === 'slate' ? pick(P, SLATE) : pick(P, TERRA);
    it.boxes = 0.1;
  } else {
    // timber: whitewashed infill between dark oak
    it.wall = 'plaster'; it.col = jit(P, [[0.95, 0.93, 0.86], [0.93, 0.88, 0.76], [0.9, 0.86, 0.8]][Math.floor(P.rng() * 3)]);
    it.nf = 2 + Math.floor(P.rng() * 2); it.fh = 2.9; it.gf = 3.9;
    it.trim = [0.35, 0.22, 0.15]; it.shut = 0;
    it.roof = 'gable'; it.roofMat = P.rng() < 0.5 ? 'tile' : 'slate';
    it.roofCol = it.roofMat === 'slate' ? pick(P, SLATE) : pick(P, TERRA);
    it.boxes = 0.5;
  }
  it.door = pick(P, DOORS);
  if (over) Object.assign(it, over);
  if (!poly) {
    // a rectangle lot: its front on the street, a side or back on a street gets windows too
    const lp = lotPoly(L);
    const ek = edgeKinds(P, lp.poly);
    it.poly = lp.poly;
    it.edges = [lp.edges[0], ek[1] === 's' ? 'w' : 'p', ek[2] === 's' ? 'w' : lp.edges[2], ek[3] === 's' ? 'w' : 'p'];
  }
  if (L.ry !== undefined && !extra.noRect) it.rect = { x: L.x, z: L.z, w: L.w, d: L.d, ry: L.ry };
  // roofs on top of the walls; how tall all told
  const roofH = it.roof === 'mansard' ? 4.1 : it.roof === 'fgable' ? L.w * 0.75 + 0.6 : it.roof === 'gable' ? L.d * 0.45 : it.roof === 'hip' ? Math.min(L.w, L.d) * 0.42 : 1;
  const wallH = it.gf + it.nf * it.fh;
  it.h = wallH + roofH;
  P.add(it);
  P.collider({ kind: 'box', x: L.x, z: L.z, hx: L.w / 2, hz: L.d / 2, ry: L.ry, y0: g.lo - 3, y1: g.hi + wallH + roofH });
  const fc = it.wall === 'stone' ? '#b8ab94' : it.wall === 'brick' ? '#7a4434' : FAR_PLASTER[it.seed % FAR_PLASTER.length];
  P.far({ x: L.x, z: L.z, y: g.lo - 1, w: L.w, d: L.d, h: wallH + 1 + (g.hi - g.lo), ry: L.ry, color: fc, lit: 0.32 });
  if (it.roof !== 'flat') P.far({ x: L.x, z: L.z, y: g.hi + wallH, w: L.w * 0.9, d: L.d * 0.8, h: roofH * 0.6, ry: L.ry, color: it.roofMat === 'tile' ? '#8a4a34' : '#4c5058', lit: 0 });
  return it;
}

function plan(P) {
  // the places that aren't houses: claimed first so no lot lands on them
  for (const b of Object.values(PLACES)) {
    const R = blockRect(b);
    P.claim(R.x, R.z, R.w, R.d, R.ry);
  }
  // the river: quays and promenades (claimed), its bridges, boats along the walls
  const RV = planRiver(P, { keep: [[MILL.side, MILL.s0 - 12, MILL.s1 + 6]] });
  const bridges = [];
  for (const j of [1, 4, 7, 10, 13]) {
    const r = P.net.byId.get(`ot_h_3_${j}`);
    const L = r && bridgeLayout(r);
    if (!L) continue;
    const mid = r.posAt((L.sA + L.sB) / 2);
    P.add({ type: 'bridge', road: r.spec.id, grand: j === 4, x: mid.x, z: mid.z });
    bridges.push({ r, L, mid });
    for (const lp of L.lamps) {
      const p = r.posAt(lp.s, lp.side * (L.reach + 0.18));
      P.lamp({ x: p.x, z: p.z, y: p.y, hx: p.x, hz: p.z, hy: p.y + 1.56 + 3.65, color: '#ffd9a0', radius: 15, intensity: 1, halo: 2.8 });
    }
    P.far({ x: mid.x, z: mid.z, y: L.yw - 1, w: L.sB - L.sA, d: 2 * L.w + 1, h: r.Y[mid.i] + 1.1 - (L.yw - 1), ry: Math.atan2(-r.TZ[mid.i], r.TX[mid.i]), color: '#a89c86', lit: 0 });
    if (j === 4) P.landmark({ id: 'grandbridge', name: 'THE GRAND BRIDGE', x: mid.x, z: mid.z, r: 60, kind: 'bridge' });
  }
  planBoats(P, RV);
  planPort(P, RV);
  planMill(P);
  planBooks(P, RV);
  planPlaces(P);
  // corner blocks (chamfered on the bigger streets, now and then a turret)
  const big = (r) => r.rt.id !== 'cobble';
  const MK = blockRect(PLACES.market);
  for (const C of corners(P, { size: [11, 15], water: true, chamfer: (Q) => (Q.rng() < 0.45 ? 2.6 + Q.rng() * 1.4 : 0) })) {
    const ch = C.chamfer;
    const edges = edgeKinds(P, C.poly, ch > 0 ? ch * Math.SQRT2 : 0);
    const grand = big(C.e.road) || big(C.f.road);
    const kind = ch > 0 ? 'corner' : character(P, C, grand ? 'grand' : '');
    const it = makeHouse(P, C, C.poly, edges, kind === 'timber' ? 'plaster' : kind, { noRect: true });
    if (ch > 0) {
      it.roof = P.rng() < 0.7 ? 'mansard' : 'pyr';
      if (it.roof === 'pyr') it.turret = true;
      it.dome = P.rng() < 0.5 ? 'copper' : 'slate';
      it.shops = null;
      // the corners round the market square carry its enamelled name
      it.plate = Math.hypot(C.x - MK.x, C.z - MK.z) < 150;
    }
  }
  // houses wall to wall along every street
  for (const r of P.roads()) {
    if (RURAL.has(r.rt.id) || r.spec.id.startsWith('otx_')) continue;
    const quai = /QUAI/.test(r.name || '');
    const grand = r.rt.id === 'street' || r.rt.id === 'avenue' || r.rt.id === 'boulevard' || quai;
    for (const sd of [1, -1]) {
      for (const L of frontage(P, r, sd, { width: grand ? [9, 15] : [6.5, 12.5], depth: grand ? [13, 17] : [10, 15], water: true })) {
        const kind = character(P, L, grand ? 'grand' : '');
        const nu = Math.max(1, Math.round(L.w / 4.8));
        const shops = [];
        for (let u = 0; u < nu; u++) shops.push(P.rng() < (grand ? 0.85 : 0.6) ? pickShop(P, grand ? 1.6 : 1) : -1);
        makeHouse(P, L, null, null, kind, { shops, shopK: 0, hotel: quai && kind === 'haus' && P.rng() < 0.12 });
      }
    }
  }
  // workshops and coach houses in the courtyards
  for (const L of P.fill({ spacing: 40, width: [7, 12], depth: [6, 9], chance: 0.25, pad: 1.5, reach: 70, test: (x, z) => inGrid(...toUV(x, z)) })) {
    const it = makeHouse(P, L, null, null, P.rng() < 0.5 ? 'brick' : 'plaster', { shops: [-1], resi: true }, { nf: 1, roof: 'hip', roofMat: 'tile', roofCol: pick(P, TERRA) });
    it.edges = ['b', 'b', 'b', 'b'];
  }
}

// ------------------------------------------------------------------ the places

const CR = Math.cos(RY), SR = Math.sin(RY);
/** (u, v) on the grid, plus a local offset along/across it → world [x, z]. */
const at = (u, v) => PUV(u, v);
const lamp = (P, x, z, y, h = 4.6, o = {}) => P.lamp({ x, z, y, hx: x, hz: z, hy: y + h, color: o.color || '#ffd29a', radius: o.radius || 13, intensity: o.intensity ?? 0.95, halo: o.halo ?? 2.4 });

function planPlaces(P) {
  // ST. CECILIA'S: the west front on the cathedral square, the apse to the east
  {
    const b = PLACES.cathedral;
    const [x, z] = at(b.u0 + 12, (b.v0 + b.v1) / 2);
    const g = natural(x, z);
    P.add({ type: 'cathedral', x, z, g, ry: RY });
    const W = (lx, lz) => [x + lx * CR + lz * SR, z - lx * SR + lz * CR];
    for (const [lx, w, d, h] of [[5.5, 11.5, 35, 64], [34.5, 47, 29.6, 37], [64, 12.4, 45, 102], [77, 14, 29.6, 37], [90, 12, 24, 37]]) {
      const [cx, cz] = W(lx, 0);
      P.collider({ kind: 'box', x: cx, z: cz, hx: w / 2, hz: d / 2, ry: RY, y0: g - 2, y1: g + h });
    }
    const far = (lx, lz, w, d, h, y0 = 0, shape = 'box') => { const [cx, cz] = W(lx, lz); P.far({ shape, x: cx, z: cz, y: g + y0, w, d, h, r: w / 2, ry: RY, color: '#c9bfa8', lit: 0.06 }); };
    far(5.5, -11.5, 11, 11, 49); far(5.5, 11.5, 11, 11, 49);
    far(5.5, -11.5, 8.4, 8.4, 15, 49, 'cone'); far(5.5, 11.5, 8.4, 8.4, 15, 49, 'cone');
    far(1.5, 0, 3, 12, 40); far(34.5, 0, 47, 24, 22); far(34.5, 0, 47, 12, 33);
    far(64, 0, 12, 44, 33); far(77, 0, 14, 24, 33); far(64, 0, 12.4, 12.4, 38);
    far(64, 0, 10.4, 10.4, 64, 38, 'cone');
    // floodlights: the west front, the flanks, the transept ends, the apse, the spire
    for (const lz of [-10, 0, 10]) { const [lx2, lz2] = W(-7, lz); P.lamp({ x: lx2, z: lz2, y: g, hx: lx2, hz: lz2, hy: g + 1.2, color: '#ffcf9a', radius: 26, intensity: 0.62, halo: 0 }); }
    for (const [lx, lz, r] of [[30, 20, 24], [30, -20, 24], [64, 29, 24], [64, -29, 24], [100, 0, 22], [64, 0, 12]]) {
      const [px, pz] = W(lx, lz);
      P.lamp({ x: px, z: pz, y: g, hx: px, hz: pz, hy: lx === 64 && lz === 0 ? g + 27 : g + 1.2, color: '#ffcf9a', radius: r, intensity: 0.62, halo: 0 });
    }
    P.landmark({ id: 'cathedral', name: "ST. CECILIA'S", x: W(46, 0)[0], z: W(46, 0)[1], r: 70, kind: 'cathedral' });
  }
  // the cathedral square: paved, a fountain, a carousel, clipped limes, lamps
  {
    const b = PLACES.parvis, R = blockRect(b);
    const um = (b.u0 + b.u1) / 2, vm = (b.v0 + b.v1) / 2;
    const g = natural(R.x, R.z);
    const it = { type: 'square', kind: 'parvis', map: 'plaza', x: R.x, z: R.z, w: R.w, d: R.d, ry: RY, g, trees: [], benches: [], lamps: [] };
    const [fx, fz] = at(um - 12, vm);
    it.fountain = [fx, fz, 5.5];
    P.collider({ kind: 'circle', x: fx, z: fz, r: 5.8, y0: g - 1, y1: g + 4.5 });
    const [cx, cz] = at(um + 30, vm + 22);
    it.carousel = [cx, cz];
    P.collider({ kind: 'circle', x: cx, z: cz, r: 6.6, y0: g - 1, y1: g + 7.5 });
    lamp(P, cx, cz, g, 6, { radius: 16, color: '#ffd9a0', halo: 0 });
    for (const dv of [-34, 34]) {
      for (let du = -44; du <= 44; du += 11) {
        const [tx, tz] = at(um + du, vm + dv);
        it.trees.push([tx, tz]);
        P.collider({ kind: 'circle', x: tx, z: tz, r: 0.4, y0: g - 1, y1: g + 6 });
      }
    }
    for (const [du, dv] of [[-40, -24], [-40, 24], [40, -24], [0, -24], [0, 24]]) {
      const [lx, lz] = at(um + du, vm + dv);
      it.lamps.push([lx, lz]);
      lamp(P, lx, lz, g);
    }
    for (const du of [-30, -18, 18]) for (const dv of [-28, 28]) { const [bx, bz] = at(um + du, vm + dv); it.benches.push([bx, bz, RY + (dv > 0 ? Math.PI : 0)]); }
    furniture(P, it, um, vm, g, R, [[28, -12, 0]], [[-30, 14], [12, 16]]);
    P.add(it);
  }
  // the market square, the clock tower in the middle of it, stalls round its south side
  {
    const b = PLACES.market, R = blockRect(b);
    const um = (b.u0 + b.u1) / 2, vm = (b.v0 + b.v1) / 2;
    const g = natural(R.x, R.z);
    const it = { type: 'square', kind: 'market', map: 'plaza', x: R.x, z: R.z, w: R.w, d: R.d, ry: RY, g, trees: [], benches: [], lamps: [], stalls: [] };
    const [tx, tz] = at(-240, 1250);
    P.add({ type: 'clocktower', x: tx, z: tz, g, ry: RY });
    P.collider({ kind: 'box', x: tx, z: tz, hx: 4.8, hz: 4.8, ry: RY, y0: g - 2, y1: g + 60 });
    P.far({ x: tx, z: tz, y: g - 1, w: 9, d: 9, h: 44, ry: RY, color: '#9a5a44', lit: 0.1 });
    P.far({ shape: 'cyl', x: tx, z: tz, y: g + 43, w: 6, d: 6, r: 3, h: 6, color: '#c8bca4', lit: 0.3 });
    P.far({ shape: 'cone', x: tx, z: tz, y: g + 49, w: 5, d: 5, r: 2.6, h: 9, color: '#506a6c', lit: 0 });
    for (const [lx, lz] of [[-9, -9], [9, -9], [9, 9], [-9, 9]]) {
      const [px, pz] = [tx + lx * CR + lz * SR, tz - lx * SR + lz * CR];
      P.lamp({ x: px, z: pz, y: g, hx: px, hz: pz, hy: g + 1, color: '#ffd0a0', radius: 14, intensity: 0.55, halo: 0 });
    }
    P.landmark({ id: 'clocktower', name: 'THE CLOCK TOWER', x: tx, z: tz, r: 50, kind: 'tower' });
    P.landmark({ id: 'market', name: "PLACE DE L'HORLOGE", x: R.x, z: R.z, r: 60, kind: 'square' });
    // stalls in two rows
    const cols = [[0.72, 0.1, 0.12], [0.12, 0.3, 0.2], [0.14, 0.2, 0.42], [0.85, 0.55, 0.1]];
    for (const dv of [14, 30]) {
      for (let du = -38; du <= 38; du += 9.5) {
        const [sx, sz] = at(um + du, vm + dv);
        it.stalls.push([sx, sz, RY + (dv < 20 ? 0 : Math.PI), Math.floor(P.rng() * cols.length)]);
        P.collider({ kind: 'box', x: sx, z: sz, hx: 1.6, hz: 1.4, ry: RY, y0: g - 1, y1: g + 3 });
      }
    }
    it.stallCols = cols;
    for (const [du, dv] of [[-42, -30], [42, -30], [-42, 40], [42, 40], [0, 22]]) {
      const [lx, lz] = at(um + du, vm + dv);
      it.lamps.push([lx, lz]);
      lamp(P, lx, lz, g, 4.6, { radius: 15 });
    }
    // string lights over the stalls
    it.strings = [[at(um - 44, vm + 22), at(um + 44, vm + 22)], [at(um - 44, vm + 38), at(um + 44, vm + 38)]];
    for (const [du, dv] of [[-44, -6], [44, -6]]) { const [tx2, tz2] = at(um + du, vm + dv); it.trees.push([tx2, tz2]); P.collider({ kind: 'circle', x: tx2, z: tz2, r: 0.4, y0: g - 1, y1: g + 6 }); }
    furniture(P, it, um, vm, g, R, [[-28, -30, Math.PI]], [[26, -24]]);
    P.add(it);
  }
  // the walled garden: lawns, gravel walks, limes, a bandstand, benches, a railing round it
  {
    const b = PLACES.garden, R = blockRect(b, 9);
    const um = (b.u0 + b.u1) / 2, vm = (b.v0 + b.v1) / 2;
    const g = natural(R.x, R.z);
    const it = { type: 'garden', map: 'park', x: R.x, z: R.z, w: R.w, d: R.d, ry: RY, g, trees: [], benches: [], lamps: [] };
    const hw = R.w / 2, hd = R.d / 2;
    it.poly = [at(um - hw, vm + hd), at(um + hw, vm + hd), at(um + hw, vm - hd), at(um - hw, vm - hd)].map(([x, z]) => [x, z]);
    // its railing: solid but for the gates in the middle of each side
    for (const [a, b2, along] of [[[um - hw, vm - hd], [um + hw, vm - hd], 'u'], [[um - hw, vm + hd], [um + hw, vm + hd], 'u'], [[um - hw, vm - hd], [um - hw, vm + hd], 'v'], [[um + hw, vm - hd], [um + hw, vm + hd], 'v']]) {
      const L = along === 'u' ? 2 * hw : 2 * hd;
      for (const [t0, t1] of [[0, L / 2 - 1.6], [L / 2 + 1.6, L]]) {
        const pa = along === 'u' ? at(a[0] + t0, a[1]) : at(a[0], a[1] + t0), pb = along === 'u' ? at(a[0] + t1, a[1]) : at(a[0], a[1] + t1);
        const len = Math.hypot(pb[0] - pa[0], pb[1] - pa[1]);
        P.collider({ kind: 'box', x: (pa[0] + pb[0]) / 2, z: (pa[1] + pb[1]) / 2, hx: len / 2, hz: 0.25, ry: Math.atan2(-(pb[1] - pa[1]), pb[0] - pa[0]), y0: g - 1, y1: g + 2.2 });
      }
      void b2;
    }
    const [bx, bz] = at(um, vm);
    it.bandstand = [bx, bz];
    P.collider({ kind: 'circle', x: bx, z: bz, r: 5.4, y0: g - 1, y1: g + 8 });
    lamp(P, bx, bz, g, 4.2, { radius: 14, color: '#ffe0b0', halo: 0 });
    for (const [du, dv] of [[-30, -22], [30, -22], [-30, 22], [30, 22], [-18, 0], [18, 0], [0, -26], [0, 26]]) {
      const [tx, tz] = at(um + du + (P.rng() - 0.5) * 4, vm + dv + (P.rng() - 0.5) * 4);
      it.trees.push([tx, tz, 0.9 + P.rng() * 0.4]);
      P.collider({ kind: 'circle', x: tx, z: tz, r: 0.45, y0: g - 1, y1: g + 8 });
    }
    for (const [du, dv] of [[-12, -12], [12, -12], [-12, 12], [12, 12]]) { const [lx, lz] = at(um + du, vm + dv); it.lamps.push([lx, lz]); lamp(P, lx, lz, g, 4.2, { radius: 12 }); }
    for (const [du, dv, r] of [[-9, -6, 0], [9, -6, 0], [-9, 6, Math.PI], [9, 6, Math.PI]]) { const [px, pz] = at(um + du, vm + dv); it.benches.push([px, pz, RY + r]); }
    P.add(it);
    P.landmark({ id: 'bastion', name: 'JARDIN DU BASTION', x: R.x, z: R.z, r: 50, kind: 'park' });
  }
}

/**
 * A square's street furniture: newspaper kiosks ([du, dv, turn]), Morris
 * columns ([du, dv]), and cast-iron bollards along its corners' edges.
 */
function furniture(P, it, um, vm, g, R, kiosks, columns) {
  it.kiosks = []; it.morris = []; it.bollards = [];
  for (const [du, dv, t] of kiosks) {
    const [x, z] = at(um + du, vm + dv);
    it.kiosks.push([x, z, RY + t]);
    P.collider({ kind: 'box', x, z, hx: 1.5, hz: 1.15, ry: RY + t, y0: g - 1, y1: g + 4 });
    lamp(P, x, z, g, 2.2, { radius: 8, intensity: 0.7, halo: 0, color: '#fff0c8' });
  }
  for (const [du, dv] of columns) {
    const [x, z] = at(um + du, vm + dv);
    it.morris.push([x, z, RY]);
    P.collider({ kind: 'circle', x, z, r: 0.85, y0: g - 1, y1: g + 4 });
  }
  const hw = R.w / 2 - 0.7, hd = R.d / 2 - 0.7;
  for (const [cu, cv] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
    for (let k = 0; k < 5; k++) {
      for (const along of ['u', 'v']) {
        if (k === 0 && along === 'v') continue;
        const du = along === 'u' ? cu * (hw - k * 2.2) : cu * hw, dv = along === 'v' ? cv * (hd - k * 2.2) : cv * hd;
        const [x, z] = at(um + du, vm + dv);
        it.bollards.push([x, z]);
        P.collider({ kind: 'circle', x, z, r: 0.18, y0: g - 1, y1: g + 1 });
      }
    }
  }
}

/** Barges, houseboats and launches moored along the quay walls, between the bridges. */
function planBoats(P, RV) {
  const occ = P.occ;
  for (const side of [1, -1]) {
    for (let s = RV.s0 + 60 + (side > 0 ? 0 : 35); s < RV.s1 - 40; s += 52 + P.rng() * 40) {
      const r = P.rng();
      if (r < 0.12) continue;
      const kind = r < 0.55 ? 'barge' : r < 0.82 ? 'house' : 'launch';
      const len = kind === 'barge' ? 26 + P.rng() * 10 : kind === 'house' ? 20 + P.rng() * 7 : 8 + P.rng() * 3;
      const beam = kind === 'launch' ? 2.6 : kind === 'house' ? 6 : 5.2;
      // (the café barge has the lane's stretch, the mill its own)
      if (side === PORT.side && s + len / 2 > PORT.s0 && s - len / 2 < PORT.s1) continue;
      if (side === MILL.side && s + len / 2 > MILL.s0 - 15 && s - len / 2 < MILL.s1 + 15) continue;
      const m = mooring(s, side, WALL_D - beam / 2 - 0.9);
      // clear of the bridges
      let ok = true;
      for (let d = -len / 2 - 10; d <= len / 2 + 10; d += 4) {
        const q = mooring(s + d, side, WALL_D - beam / 2 - 0.9);
        if (occ.get(q.x, q.z) & ROAD) { ok = false; break; }
      }
      if (!ok || !P.inside(m.x, m.z)) continue;
      P.add({ type: 'boat', kind, len, x: m.x, z: m.z, y: m.y, ry: m.ry + (P.rng() < 0.5 ? Math.PI : 0), seed: Math.floor(P.rng() * 1e6), lit: 0.6 });
      s += len;
    }
  }
}

/** The bouquinistes: green boxes along the parapets either side of the Grand Bridge. */
function planBooks(P, RV) {
  const occ = P.occ;
  for (const q of RV.quays) {
    const runs = q.side < 0 ? [[1236, 1392]] : [[1418, 1580]];
    for (const [a, b] of runs) {
      for (let t = Math.max(q.s0 + 1.5, a); t < Math.min(q.s1 - 1.2, b); t += 2.3) {
        if (q.lamps.some((x) => Math.abs(x - t) < 2.2) || q.steps.some((x) => Math.abs(x - t) < 5) || q.ladders.some((x) => Math.abs(x - t) < 1.6)) continue;
        let road = false;
        for (const d of [-1, 1.5, 4]) { const p = bankPt(t, q.side, WALL_D + d); if (occ.get(p.bx, p.bz) & ROAD) road = true; }
        if (road || P.rng() < 0.22) continue;
        q.books = q.books || [];
        q.books.push([t, P.rng() < 0.4]);
      }
    }
  }
}

/**
 * LE PETIT PORT (hidden): the lane runs down off the quai to the water; walls
 * hold the town up beside it, a parapet keeps it from the river, and at its
 * foot the café barge lies along the parapet with its gangway across.
 */
function planPort(P, RV) {
  const r = P.net.byId.get('otx_port');
  if (!r) return;
  const rt = r.rt, half = rt.hw + rt.shoulder + rt.walk;
  const runs = [];
  for (const sd of [1, -1]) {
    let run = null;
    const end = () => { if (run && run.pts.length > 1) runs.push(run); run = null; };
    for (let i = 0; i < r.N; i++) {
      if (r.S[i] < r.trim0 + 0.5) continue;
      const lat = sd * (half + 0.3);
      const x = r.X[i] + r.LX[i] * lat, z = r.Z[i] + r.LZ[i] * lat;
      // the river side has the quay's parapet
      if (riverS(x, z).d < WALL_D + 2.5) { end(); continue; }
      const yl = r.Y[i] + rt.curb;
      const yt = natural(x + r.LX[i] * sd * 2, z + r.LZ[i] * sd * 2);
      if (yt - yl < 0.3) { end(); continue; }
      if (!run) run = { pts: [] };
      run.pts.push([x, z, yl, yt, -r.LX[i] * sd, -r.LZ[i] * sd]);
    }
    end();
  }
  // a wall across the lane's end, under the bridge's abutment
  {
    const n = r.N - 1, ex = r.X[n] + r.TX[n] * 0.4, ez = r.Z[n] + r.TZ[n] * 0.4;
    const yl = r.Y[n] + rt.curb, yt = natural(ex + r.TX[n] * 3, ez + r.TZ[n] * 3);
    if (yt - yl > 0.3) {
      const pts = [];
      for (const lat of [half + 0.3, -(half + 0.3)]) pts.push([ex + r.LX[n] * lat, ez + r.LZ[n] * lat, yl, yt, -r.TX[n], -r.TZ[n]]);
      // (wound so the face looks back up the lane)
      const f = pts[1][0] - pts[0][0], g = pts[1][1] - pts[0][1];
      if (f * -r.TZ[n] - g * -r.TX[n] > 0) pts.reverse();
      runs.push({ pts });
    }
  }
  for (const run of runs) {
    const pts = run.pts;
    for (let k = 0; k < pts.length - 1; k += 4) {
      const a = pts[k], b = pts[Math.min(pts.length - 1, k + 4)];
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      if (len < 0.5) continue;
      let lo = Infinity, hi = -Infinity;
      for (let q = k; q <= Math.min(pts.length - 1, k + 4); q++) { lo = Math.min(lo, pts[q][2]); hi = Math.max(hi, pts[q][3]); }
      P.collider({ kind: 'box', x: (a[0] + b[0]) / 2 - a[4] * 0.3, z: (a[1] + b[1]) / 2 - a[5] * 0.3, hx: len / 2 + 0.2, hz: 0.32, ry: Math.atan2(-(b[1] - a[1]), b[0] - a[0]), y0: lo - 1, y1: hi + 1.2 });
    }
  }
  const mi = r.N >> 1;
  P.add({ type: 'portwall', x: r.X[mi], z: r.Z[mi], runs });
  // the café barge: bow to the bridge, its gangway over a gap in the parapet
  const L = 30, beam = 5.6, dc = WALL_D - beam / 2 - 0.5;
  const m = mooring(PORT.barge, PORT.side, dc);
  const ry = m.ry + Math.PI;
  const bk = bankPt(PORT.barge, PORT.side, WALL_D);
  const wallSide = Math.cos(ry) * bk.ox - Math.sin(ry) * bk.oz > 0 ? 1 : -1;
  const sg = PORT.barge + (L / 2 - 6.2 - 2.2);
  let gangY = null;
  for (const q of RV.quays) {
    if (q.side !== PORT.side || sg < q.s0 || sg > q.s1) continue;
    let best = Infinity;
    for (const [t, y] of q.lane) if (Math.abs(t - sg) < best) { best = Math.abs(t - sg); gangY = y; }
    if (gangY !== null) q.gaps.push(sg - 1, sg + 1);
  }
  P.add({ type: 'boat', kind: 'cafe', len: L, x: m.x, z: m.z, y: m.y, ry, seed: 1789, lit: 1, wallSide: gangY !== null ? wallSide : 0, gap: WALL_D - dc - beam / 2, gangY });
  // (its windows light it; a lantern at the bow's mast top shows from the bridge)
  const bow = mooring(PORT.barge - L / 2 + 1.8, PORT.side, dc);
  P.lamp({ x: bow.x, z: bow.z, y: m.y + 1.2, hx: bow.x, hz: bow.z, hy: m.y + 6.0, color: '#ffd29a', radius: 8, intensity: 0.45, halo: 1.4 });
  P.landmark({ id: 'petitport', name: 'LE PETIT PORT', x: m.x, z: m.z, r: 35, kind: 'cafe', hidden: true });
}

/**
 * THE OLD MILL (hidden): at the head of the towpath, under the levee where
 * the river runs higher than the land, its wheel fed through a sluice.
 */
function planMill(P) {
  const sm = (MILL.s0 + MILL.s1) / 2, w = MILL.s1 - MILL.s0, d = 12, dc = WALL_D + TOP_W + 3.7 + d / 2;
  const b = bankPt(sm, MILL.side, dc);
  if (!P.inside(b.bx, b.bz)) return;
  // local x down the river, local +z towards it
  const ry = MILL.side > 0 ? Math.atan2(-b.tz, b.tx) : Math.atan2(b.tz, -b.tx);
  const c = Math.cos(ry), s = Math.sin(ry);
  const W = (lx, lz) => [b.bx + lx * c + lz * s, b.bz - lx * s + lz * c];
  const g = natural(b.bx, b.bz);
  const levee = dc - (WALL_D + TOP_W);
  P.add({ type: 'mill', map: 'building', x: b.bx, z: b.bz, g, ry, w, d, wheel: -1.5, levee, lit: 0.55 });
  P.collider({ kind: 'box', x: b.bx, z: b.bz, hx: w / 2, hz: d / 2, ry, y0: g - 2, y1: g + 16 });
  const [px, pz] = W(-3.5, (d / 2 + levee) / 2);
  P.collider({ kind: 'box', x: px, z: pz, hx: 5.6, hz: (levee - d / 2) / 2, ry, y0: g - 2, y1: g + 6 });
  P.far({ x: b.bx, z: b.bz, y: g - 1, w, d, h: 10.6, ry, color: '#8a8276', lit: 0.25 });
  P.far({ x: b.bx, z: b.bz, y: g + 9.6, w: w * 0.96, d: d * 0.6, h: 4, ry, color: '#8a4a34', lit: 0 });
  const [dx, dz] = W(w / 2 + 0.5, 1.5);
  P.lamp({ x: dx, z: dz, y: g, hx: dx, hz: dz, hy: g + 2.6, color: '#ffc27a', radius: 12, intensity: 0.95, halo: 1.6 });
  const [fx, fz] = W(-1.5, levee - 0.8);
  P.lamp({ x: fx, z: fz, y: g, hx: fx, hz: fz, hy: g + 1.2, color: '#ffd8a8', radius: 11, intensity: 1.0, halo: 0 });
  P.landmark({ id: 'mill', name: 'THE OLD MILL', x: b.bx, z: b.bz, r: 35, kind: 'mill', hidden: true });
}

// ------------------------------------------------------------------ materials

function mats(B) {
  return {
    plaster: B.mat('plaster', () => litMat({ map: plasterTex(), vertexColors: true, roughness: 0.92 }, { glow: 1.15 })),
    brick: B.mat('brick', () => litMat({ map: brickTex(), vertexColors: true, roughness: 0.9 }, { glow: 1.5 })),
    stone: B.mat('stone', () => litMat({ map: stoneTex(), vertexColors: true, roughness: 0.85 }, { glow: 1.1 })),
    // (roofs, windows and signs take no baked lamp light: high up, or lit by their own glow; the bake is lighter for it)
    slate: B.mat('slate', () => plainMat({ map: slateTex(), vertexColors: true, roughness: 0.55, metalness: 0.2 })),
    tile: B.mat('tile', () => plainMat({ map: tileTex(), vertexColors: true, roughness: 0.8 })),
    win: B.mat('win', () => { const t = otWindows(); return plainMat({ map: t.map, emissive: 0xffffff, emissiveMap: t.emi, vertexColors: true, roughness: 0.3, metalness: 0.1, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2 }, { night: 1.3 }); }),
    shop: B.mat('shop', () => { const t = otShops(); return litMat({ map: t.map, emissive: 0xffffff, emissiveMap: t.emi, roughness: 0.45, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2 }, { night: 1.5 }); }),
    paint: B.mat('paint', () => litMat({ vertexColors: true, roughness: 0.7 })),
    // (unlit by the lamps, to keep the bake light: chimneys, lamp irons, signs' boards, high trim)
    trim: B.mat('trim', () => plainMat({ vertexColors: true, roughness: 0.7 })),
    stoneHi: B.mat('stoneHi', () => plainMat({ map: stoneTex(), vertexColors: true, roughness: 0.85 })),
    metal: B.mat('metal', () => litMat({ map: metalTex(), vertexColors: true, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.5, metalness: 0.5 }, { shadow: false })),
    glow: B.mat('glow', () => { const m = glowColorMat('#ffc27a', 3.2); m.side = THREE.DoubleSide; return m; }),
    leaf: B.mat('leaf', () => litMat({ vertexColors: true, roughness: 0.85, flatShading: true })),
    pave: B.mat('pave', () => litMat({ map: cobbleTexture(), roughness: 0.85, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -3 })),
    gravel: B.mat('gravel', () => litMat({ map: groundTexture('gravel'), color: 0xd8ccb4, roughness: 0.95, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -3 })),
    water: B.mat('water', () => litMat({ color: 0x2a5a78, roughness: 0.06, metalness: 0.3, emissive: 0x3a90d0, vertexColors: true }, { night: 0.45 })),
    sign: B.mat('sign', () => { const t = otSigns(); return plainMat({ map: t, emissive: 0xffffff, emissiveMap: t, roughness: 0.5, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2 }, { night: 1.4 }); }),
  };
}

function kit(B) {
  const M = mats(B);
  const K = {};
  for (const [k, m] of Object.entries(M)) { m.name = 'ot:' + k; K[k] = B.acc(m); }
  K.near = {};
  for (const k of ['stone', 'paint', 'leaf', 'glow', 'metal', 'plaster', 'win', 'slate', 'tile', 'trim', 'stoneHi']) K.near[k] = B.near(M[k]);
  K.M = M;
  return K;
}

// ------------------------------------------------------------------ build

function* build(B, items) {
  const K = kit(B);
  // (yield every couple of milliseconds: the streamer runs a few a frame)
  let t0 = performance.now();
  for (const it of items) {
    if (it.type === 'house') {
      // (the ground under it: its own cell's, never a neighbour's grid)
      const g = B.groundY(it.x, it.z);
      const ry = it.roadY ?? g;
      it.y0 = Math.min(g, ry) - 1.2;
      it.gy = Math.max(g, ry) + 0.12;
      house(K, it);
    } else if (it.type === 'quay') {
      quay(K, B, it);
      for (const [x, z, y, s, t] of it.trees) planeTree(K, x, y, z, s, t);
      for (const [sb, open] of it.books || []) {
        const b = bankPt(sb, it.side, WALL_D + 0.24);
        bookBox(K, b.bx, quayTop(sb, it.side).top + 0.85, b.bz, Math.atan2(-b.tz, b.tx), open);
      }
    } else if (it.type === 'bridge') {
      yield* bridge(K, B, it);
      t0 = performance.now();
    } else if (it.type === 'boat') {
      boat(K, it, makeRng(it.seed));
    } else if (it.type === 'cathedral') {
      cathedral(K, it);
    } else if (it.type === 'clocktower') {
      clockTower(K, B, it, K.M);
    } else if (it.type === 'square') {
      yield* square(K, B, it);
      t0 = performance.now();
    } else if (it.type === 'garden') {
      yield* garden(K, B, it);
      t0 = performance.now();
    } else if (it.type === 'portwall') {
      portWalls(K, it);
    } else if (it.type === 'mill') {
      mill(K, B, it, K.M);
    } else if (it.type === 'tree') {
      sceneryTree(K, it);
    }
    if (performance.now() - t0 > 1.5) { yield; t0 = performance.now(); }
  }
  yield;
  dressGasLamps(B, K);
}

/** The road builder's gas lamps in this cell, in their cast iron. */
function dressGasLamps(B, K) {
  const seen = new Set();
  for (let gx = B.x0; gx < B.x0 + CELL; gx += 64) {
    for (let gz = B.z0; gz < B.z0 + CELL; gz += 64) {
      for (const r of B.net.near(gx + 32, gz + 32, 46).keys()) {
        if (seen.has(r)) continue;
        seen.add(r);
        for (const L of roadLamps(r)) {
          if (L.style !== 'gas' || Math.floor(L.x / CELL) !== B.cx || Math.floor(L.z / CELL) !== B.cz) continue;
          gasLamp(K, L);
        }
      }
    }
  }
}

/** A tree from the scatter: limes and fruit trees in the courtyards, poplars and oaks in the fields. */
function sceneryTree(K, it) {
  const rng = makeRng(Math.floor(it.seed * 1e6));
  if (it.kind === 'poplar') {
    K.paint.col = [0.5, 0.46, 0.38];
    cylinder(K.paint, it.x, it.y - 0.3, it.z, 0.2 * it.s, 4 * it.s, 5, { r2: 0.12 });
    K.leaf.col = [0.26 + rng() * 0.05, 0.4 + rng() * 0.06, 0.18];
    sphere(K.leaf, it.x, it.y + 9 * it.s, it.z, 1.7 * it.s, 6, { sy: 3.4 });
  } else if (it.kind === 'fruit') {
    broadTree(K.paint, K.leaf, it.x, it.y, it.z, it.s * 0.75, rng, [0.36, 0.48, 0.2], { bark: [0.4, 0.32, 0.24], trunk: 1.8, lumps: 1, crown: 1.1 });
  } else if (it.kind === 'oak') {
    broadTree(K.paint, K.leaf, it.x, it.y, it.z, it.s * 1.3, rng, [0.22, 0.34, 0.15], { bark: [0.36, 0.32, 0.26], trunk: 3.0, lumps: 2, crown: 1.2 });
  } else {
    broadTree(K.paint, K.leaf, it.x, it.y, it.z, it.s, rng, [0.3, 0.42, 0.18], { bark: [0.5, 0.46, 0.38], trunk: 3.2, lumps: 2, crown: 1.05 });
  }
}

/** Courtyard trees inside the town's blocks; poplars and oaks out in the fields. */
function scatter(S) {
  const pts = S.points(18, { r: 4.5, density: (x, z) => (inGrid(...toUV(x, z)) ? 0.4 : 0.16) });
  for (const [x, z] of pts) {
    const town = inGrid(...toUV(x, z));
    const r = S.rng();
    const kind = town ? (r < 0.7 ? 'lime' : 'fruit') : (r < 0.55 ? 'poplar' : 'oak');
    const y = S.groundY(x, z);
    S.add({ type: 'tree', kind, x, z, y, s: 0.8 + S.rng() * 0.45, seed: S.rng() });
    if (!S.free(x, z, 9, true)) S.collider({ kind: 'circle', x, z, r: 0.5, y0: y - 1, y1: y + 9 });
  }
}

/** A plane tree: a mottled trunk, a broad lumpy crown. */
function planeTree(K, x, y, z, s, t) {
  const rng = makeRng(Math.floor(t * 1e6));
  broadTree(K.paint, K.leaf, x, y, z, s * 1.15, rng, [0.27, 0.38, 0.18], { bark: [0.62, 0.6, 0.5], trunk: 3.6, lumps: 4, crown: 0.95 });
}

/** A square: paved, and whatever the plan put on it. */
function* square(K, B, it) {
  const c = Math.cos(it.ry), s = Math.sin(it.ry), hw = it.w / 2, hd = it.d / 2, g = it.g;
  const W = (lx, lz) => [it.x + lx * c + lz * s, it.z - lx * s + lz * c];
  // (paved a quarter at a time: draping a whole square is too long a step)
  for (const [a, b] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
    const x0 = Math.min(0, a * hw), x1 = Math.max(0, a * hw), z0 = Math.min(0, b * hd), z1 = Math.max(0, b * hd);
    paved(K, B, [W(x0, z1), W(x1, z1), W(x1, z0), W(x0, z0)]);
    yield;
  }
  if (it.fountain) fountain(K, it.fountain[0], g, it.fountain[1], it.fountain[2]);
  if (it.carousel) carousel(K, B, it.carousel[0], g, it.carousel[1], K.M);
  for (const [x, z] of it.trees) {
    if (it.kind === 'parvis') clippedTree(K, x, g, z, it.ry, 1);
    else planeTree(K, x, g, z, 1, x * 0.37 + z);
  }
  for (const [x, z, ry] of it.benches) bench(K, x, g, z, ry);
  for (const [x, z] of it.lamps) lampPost(K, x, g, z, 'double', it.ry);
  for (const [x, z, ry] of it.kiosks || []) kiosk(K, x, g, z, ry);
  for (const [x, z, ry] of it.morris || []) morris(K, x, g, z, ry);
  for (const [x, z] of it.bollards || []) bollard(K, x, g, z);
  const rng = makeRng(Math.floor(it.x * 13 + it.z));
  for (const [x, z, ry, ci] of it.stalls || []) stall(K, x, g, z, ry, 3.0, 2.6, it.stallCols[ci], rng);
  for (const [a, b] of it.strings || []) {
    for (const p of [a, b]) { K.paint.col = [0.08, 0.1, 0.09]; cylinder(K.paint, p[0], g, p[1], 0.07, 5.2, 5); }
    const pts = catenary([a[0], g + 5.1, a[1]], [b[0], g + 5.1, b[1]], 1.2, 44);
    for (const p of pts) cross(K.glow, p[0], p[1] - 0.12, p[2], 0.07, 0.16);
    wire(K.near.paint, pts, 0.015);
  }
}

/** The walled garden: gravel walks, the railing, the bandstand, limes, lamps, benches. */
function* garden(K, B, it) {
  const c = Math.cos(it.ry), s = Math.sin(it.ry), hw = it.w / 2, hd = it.d / 2, g = it.g;
  const W = (lx, lz) => [it.x + lx * c + lz * s, it.z - lx * s + lz * c];
  const walk = (x0, z0, x1, z1) => paved(K, B, [W(x0, z1), W(x1, z1), W(x1, z0), W(x0, z0)], 'gravel');
  walk(-hw, -1.6, hw, 1.6);
  yield;
  walk(-1.6, -hd, 1.6, hd);
  yield;
  const ring = [];
  for (let k = 0; k < 12; k++) { const a = (k / 12) * Math.PI * 2; ring.push(W(Math.cos(a) * 9, Math.sin(a) * 9)); }
  paved(K, B, ring, 'gravel');
  railingRound(K, it.poly, g);
  bandstand(K, it.bandstand[0], g, it.bandstand[1]);
  for (const [x, z, sc] of it.trees) planeTree(K, x, g, z, sc, x + z * 0.71);
  for (const [x, z] of it.lamps) lampPost(K, x, g, z, 'single', it.ry);
  for (const [x, z, ry] of it.benches) bench(K, x, g, z, ry);
}

export default {
  id: 'oldtown',
  plan,
  scatter,
  warm(B) { mats(B); },
  build,
};

void OTS; void rectPoly;
