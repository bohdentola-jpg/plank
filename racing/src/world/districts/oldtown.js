// PORT HALCYON — OLD TOWN: the historic quarter on the river. Narrow stone,
// plaster, brick and half-timbered houses wall to wall along cobbled
// streets (zinc mansards and dormers, chimney stacks, shutters, window
// boxes, café awnings and terraces, carriage doors), chamfered corner
// blocks with domed turrets, the river between stone quays with its arched
// bridges, barges and steps down to the water, ST. CECILIA'S cathedral, the
// clock tower over the market square, the gardens on the old bastion.
import * as THREE from 'three';
import { OLDTOWN } from '../map/areas/oldtown.js';
import { litMat, glowColorMat } from './builder.js';
import { cobbleTexture } from '../kit.js';
import { plasterTex, brickTex, stoneTex, slateTex, tileTex, metalTex } from './oldquarter/tex.js';
import { otWindows, otShops, OTS } from './oldquarter/ottex.js';
import { house, CAFE } from './oldquarter/othouse.js';
import { frontage, corners, edgeKinds, lotPoly, ROAD } from './oldquarter/plan.js';
import { rectPoly, broadTree } from './oldquarter/geo.js';
import { planRiver, bridgeLayout, WALL_D } from './oldquarter/river.js';
import { quay, bridge, boat, mooring } from './oldquarter/riverbuild.js';
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
export const PLACES = {
  cathedral: BLOCK(6, 3),
  parvis: BLOCK(5, 3),
  market: BLOCK(1, 7),
  garden: BLOCK(9, 8),
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
  const RV = planRiver(P);
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
  }
  planBoats(P, RV);
  // corner blocks (chamfered on the bigger streets, now and then a turret)
  const big = (r) => r.rt.id !== 'cobble';
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
    }
  }
  // houses wall to wall along every street
  for (const r of P.roads()) {
    if (RURAL.has(r.rt.id) || r.spec.id.startsWith('otx_')) continue;
    const grand = r.rt.id === 'street' || r.rt.id === 'avenue' || r.rt.id === 'boulevard' || /QUAI/.test(r.name || '');
    for (const sd of [1, -1]) {
      for (const L of frontage(P, r, sd, { width: grand ? [9, 15] : [6.5, 12.5], depth: grand ? [13, 17] : [10, 15], water: true })) {
        const kind = character(P, L, grand ? 'grand' : '');
        const nu = Math.max(1, Math.round(L.w / 4.8));
        const shops = [];
        for (let u = 0; u < nu; u++) shops.push(P.rng() < (grand ? 0.85 : 0.6) ? pickShop(P, grand ? 1.6 : 1) : -1);
        makeHouse(P, L, null, null, kind, { shops, shopK: 0 });
      }
    }
  }
  // workshops and coach houses in the courtyards
  for (const L of P.fill({ spacing: 40, width: [7, 12], depth: [6, 9], chance: 0.25, pad: 1.5, test: (x, z) => toUV(x, z)[1] > 470 })) {
    const it = makeHouse(P, L, null, null, P.rng() < 0.5 ? 'brick' : 'plaster', { shops: [-1], resi: true }, { nf: 1, roof: 'hip', roofMat: 'tile', roofCol: pick(P, TERRA) });
    it.edges = ['b', 'b', 'b', 'b'];
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

// ------------------------------------------------------------------ materials

function mats(B) {
  return {
    plaster: B.mat('plaster', () => litMat({ map: plasterTex(), vertexColors: true, roughness: 0.92 }, { glow: 1.15 })),
    brick: B.mat('brick', () => litMat({ map: brickTex(), vertexColors: true, roughness: 0.9 }, { glow: 1.5 })),
    stone: B.mat('stone', () => litMat({ map: stoneTex(), vertexColors: true, roughness: 0.85 }, { glow: 1.1 })),
    slate: B.mat('slate', () => litMat({ map: slateTex(), vertexColors: true, roughness: 0.55, metalness: 0.2 })),
    tile: B.mat('tile', () => litMat({ map: tileTex(), vertexColors: true, roughness: 0.8 })),
    win: B.mat('win', () => { const t = otWindows(); return litMat({ map: t.map, emissive: 0xffffff, emissiveMap: t.emi, vertexColors: true, roughness: 0.3, metalness: 0.1, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2 }, { night: 1.3 }); }),
    shop: B.mat('shop', () => { const t = otShops(); return litMat({ map: t.map, emissive: 0xffffff, emissiveMap: t.emi, roughness: 0.45, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2 }, { night: 1.5 }); }),
    paint: B.mat('paint', () => litMat({ vertexColors: true, roughness: 0.7 })),
    metal: B.mat('metal', () => litMat({ map: metalTex(), vertexColors: true, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.5, metalness: 0.5 }, { shadow: false })),
    glow: B.mat('glow', () => { const m = glowColorMat('#ffc27a', 3.2); m.side = THREE.DoubleSide; return m; }),
    leaf: B.mat('leaf', () => litMat({ vertexColors: true, roughness: 0.85, flatShading: true })),
    pave: B.mat('pave', () => litMat({ map: cobbleTexture(), roughness: 0.85, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -3 })),
  };
}

function kit(B) {
  const M = mats(B);
  const K = {};
  for (const [k, m] of Object.entries(M)) { m.name = 'ot:' + k; K[k] = B.acc(m); }
  K.near = {};
  for (const k of ['stone', 'paint', 'leaf', 'glow', 'metal', 'plaster', 'win', 'slate', 'tile']) K.near[k] = B.near(M[k]);
  K.M = M;
  return K;
}

// ------------------------------------------------------------------ build

function* build(B, items) {
  const K = kit(B);
  let n = 0;
  for (const it of items) {
    if (it.type === 'house') {
      // (the ground under it: its own cell's, never a neighbour's grid)
      const g = B.groundY(it.x, it.z);
      const ry = it.roadY ?? g;
      it.y0 = Math.min(g, ry) - 1.2;
      it.gy = Math.max(g, ry) + 0.12;
      house(K, it);
      n += 2;
    } else if (it.type === 'quay') {
      quay(K, B, it);
      for (const [x, z, y, s, t] of it.trees) planeTree(K, x, y, z, s, t);
      n += 4;
    } else if (it.type === 'bridge') {
      bridge(K, B, it);
      n += 12;
    } else if (it.type === 'boat') {
      boat(K, it, makeRng(it.seed));
      n += 2;
    }
    if (++n % 12 === 0) yield;
  }
}

/** A plane tree: a mottled trunk, a broad lumpy crown. */
function planeTree(K, x, y, z, s, t) {
  const rng = makeRng(Math.floor(t * 1e6));
  broadTree(K.paint, K.leaf, x, y, z, s * 1.15, rng, [0.3, 0.42, 0.2], { bark: [0.62, 0.6, 0.5], trunk: 3.6, lumps: 3, crown: 1.15 });
}

export default {
  id: 'oldtown',
  plan,
  warm(B) { mats(B); },
  build,
};

void OTS; void rectPoly;
