// PORT HALCYON — ROUTE 99 and THE HIGH DESERT (the `desert` style serves both).
//
// ROUTE 99: two-lane blacktop through the sand, telephone poles strung along
// it the whole way (sagging wires), white delineators with amber eyes, mile
// markers and shields, billboards on tall legs (lit at night), sand blowing
// across the asphalt. At the I-9's end, DRY WELLS: the ROCKET DINER (a chrome
// streamliner with a 26 m rocket on its sign), RAZOR FUEL's lit canopy, the
// STARLITE MOTEL (pool, neon star, a chasing arrow), the DRY WELLS water tower
// on the mesa, and BIG AL'S AUTO SALVAGE (stacked wrecks, a crane); further
// south a rock shop with a concrete dinosaur. Joshua trees, saguaros,
// creosote, ocotillo; mesas with rock ledges.
//
// THE HIGH DESERT: emptier and stranger. Joshua tree forest and granite
// boulder heaps; down the Array Rd in the empty basin, a line of white radio
// dishes all looking the same way, a mast blinking red; up a side valley the
// old missile silo (hidden), its blast door slid half open; past the road's
// end a satellite smoulders in its crater (hidden).
import { box, cylinder, cone, drape, gable } from './builder.js';
import { MAT, paint, paintMix, obox, panel, flat, tube, hcyl, disc, clock, lineMesh, reachOf, hash1, TAU, sstep } from './desertkit/kit.js';
import { R, uvOf } from './desertkit/tex.js';
import { pole, poleTops, wires, billboard, roadSign, delineator, lampPost, car, wreckStack, drumBarrel, tyres, picnic, fanPalm, mast, beacon, animUV, stringLights, tumbleRun } from './desertkit/props.js';
import { tumbleShape } from './desertkit/flora.js';
import { boulder } from './desertkit/rocks.js';
import { steepAt, seedOf, cliffLedges, buildScatter, shrubs, cellGround, lowest } from './desertkit/scatter.js';
import { site, facing, setPiece, lampAt, addBox, addCircle, poleLine, signAt } from './desertkit/place.js';

const lotMat = (B) => MAT.lot(B);   // things laid flat on the ground (lots, pads, painted lines)

const R99 = ['r99_1', 'r99_2', 'r99_3', 'r99_4', 'r99_5', 'r99_6', 'r99_7', 'r99_8'];
const CAR_COLS = ['#c8322a', '#2a8a88', '#e8d8b0', '#f0a8b8', '#3a5a9a', '#e8e4da', '#5a8a4a', '#d8a030', '#1a1a1c'];
const WRECK_COLS = ['#7a3a2a', '#5a4a3a', '#8a6a3a', '#4a5a5a', '#6a2a20', '#7a7068', '#3a4a6a', '#8a5a30'];
const MESA_TONES = ['#a8603e', '#b87048', '#c08a5c', '#9a5236', '#c89a6a'];

export default {
  id: 'desert',

  plan(P) {
    if (P.d.id === 'highlands') return planHighlands(P);
    return planRoute99(P);
  },

  scatter(S) {
    if (S.d.id === 'highlands') scatterHighlands(S);
    else scatterDesert(S);
  },

  warm(B) {
    for (const k of ['paint', 'metal', 'rock', 'strata', 'plant', 'foliage', 'signs', 'roadsigns', 'ads', 'tin', 'stucco', 'wood', 'drift', 'neon', 'glass', 'lights', 'wire', 'hole', 'lot']) MAT[k](B);
  },

  *build(B, items) {
    const tick = clock(3);
    const wire = [];
    for (const it of items) {
      if (buildScatter(B, it)) { if (tick()) yield; continue; }
      switch (it.type) {
        case 'pole': {
          const tops = pole(B, it.x, it.y, it.z, it.ry, it.h, it.lean);
          if (it.next) wires(wire, tops, poleTops(it.next.x, it.next.y, it.next.z, it.next.ry, it.next.h, it.next.lean));
          break;
        }
        case 'delin': delineator(B, it.x, it.y, it.z, it.ry, it.amber); break;
        case 'sign': roadSign(B, it.x, B.groundY(it.x, it.z), it.z, it.ry, it.kind, it.o || {}); break;
        case 'billboard': billboard(B, it.x, B.groundY(it.x, it.z), it.z, it.ry, it.ad, it.o || {}); break;
        case 'drift': drift(B, it); break;
        case 'diner': yield* diner(B, it, tick); break;
        case 'gas': yield* gas(B, it); break;
        case 'motel': yield* motel(B, it); break;
        case 'tower': waterTower(B, it); break;
        case 'junk': yield* junkyard(B, it, tick); break;
        case 'stand': rockShop(B, it); break;
        case 'dish': dish(B, it); break;
        case 'array': yield* arrayBase(B, it); break;
        case 'silo': yield* silo(B, it); break;
        case 'crash': crashSite(B, it); break;
        case 'tumble': tumbleRun(B, it.x, it.z, 0.9, 0.35, 220, 60, 4, it.n, tumbleShape); break;
        default: break;
      }
      if (tick()) yield;
    }
    if (wire.length) B.group.add(lineMesh(wire, MAT.wire(B)));
  },
};

const road = (P, id) => P.net.byId.get(id);

// ================================================================== Route 99

const DINER_LAMPS = [[-14, 6], [22, 6], [-30, -8], [30, -10]];

function planRoute99(P) {
  const roads = R99.map((id) => road(P, id)).filter(Boolean);
  const r1 = road(P, 'r99_1'), r5 = road(P, 'r99_5'), i9 = road(P, 'i9_east2');
  if (r1) {
    const L = r1.length;
    // ---- the ROCKET DINER, east of the highway (the road's right, northbound)
    // (past the end of the raised approach to the junction: here the highway's back at grade)
    const sd = site(r1, L * 0.68, -1, 64, 50, 3);
    const dy = setPiece(P, { type: 'diner', ...sd, map: 'building' },
      [{ x: 6, z: -12, w: 36, d: 10.5, h: 9 }, { x: 5, z: -5.6, w: 5, d: 3.6, h: 4 }, { x: -26, z: 20, w: 3.4, d: 3.4, h: 26 }, { x: -20, z: -14, w: 20, d: 3, h: 4 }],
      [{ shape: 'box', x: 6, z: -12, w: 35, d: 9.4, h: 5.3, color: '#b8c0c4', lit: 0.5 }, { shape: 'box', x: 4, z: -11, w: 12, d: 0.6, h: 3.2, dy: 6, color: '#103c44' },
        { shape: 'cyl', x: -26, z: 20, r: 0.6, h: 15, color: '#c8322a' }, { shape: 'cyl', x: -26, z: 20, r: 1.25, h: 8.1, dy: 15.2, color: '#dfe4e8' }, { shape: 'cone', x: -26, z: 20, r: 1.0, h: 3.6, dy: 23.3, color: '#c8322a' }]);
    for (const [lx, lz] of DINER_LAMPS) { lampAt(P, sd, dy, lx, lz, 9.0, '#ffe6c0', 22, 0.9, 2.4); addCircle(P, sd, dy, lx, lz, 0.25, 9); }
    for (const [lx, lz] of [[-14, -6], [20, -5], [24, -9], [-10, 2]]) addCircle(P, sd, dy, lx, lz, 0.5, 6);
    lampAt(P, sd, dy, -26, 22, 16, '#ff5aa8', 26, 0.7, 2.6);
    lampAt(P, sd, dy, 6, -5, 6.5, '#5af0ff', 16, 0.6, 1.8);
    P.landmark({ id: 'rocket_diner', name: 'ROCKET DINER', x: sd.x, z: sd.z, r: 60, kind: 'diner' });
    // ---- RAZOR FUEL across the road, a little further north
    const sg = site(r1, L * 0.87, 1, 50, 34, 2);
    const gy = setPiece(P, { type: 'gas', ...sg, map: 'building' },
      [{ x: 0, z: -9, w: 15, d: 10, h: 5 }, { x: -19, z: 14, w: 1.2, d: 1.2, h: 9 }],
      [{ shape: 'box', x: 0, z: 3, w: 22, d: 12, h: 1.1, dy: 6.3, color: '#e8e4dc' }, { shape: 'box', x: 0, z: -9, w: 15, d: 10, h: 5.6, color: '#d8d2c4', lit: 0.4 }]);
    for (const [lx, lz] of [[-6, 0], [6, 0], [-6, 6], [6, 6]]) lampAt(P, sg, gy, lx, lz, 5.1, '#f4f8ff', 15, 1.25, 0);
    lampAt(P, sg, gy, 0, -3, 3.8, '#fff0d0', 10, 0.7, 0);
    lampAt(P, sg, gy, -19, 14, 7, '#ff8060', 9, 0.4, 1.2);
    for (const lz of [0.5, 5.5]) addBox(P, sg, gy, 0, lz, 13, 1.2, 1.4);
    for (const lx of [-8, 0, 8]) for (const lz of [-1.5, 7.5]) addCircle(P, sg, gy, lx, lz, 0.3, 5.3);
  }
  if (r5) {
    // ---- the STARLITE MOTEL, east of the highway south of the junction
    const sm = site(r5, 285, 1, 76, 48, 3);
    const my = setPiece(P, { type: 'motel', ...sm, map: 'building' },
      [{ x: -6, z: -17, w: 56, d: 10.5, h: 5.2 }, { x: -32, z: -1, w: 10.5, d: 24, h: 5.2 }, { x: 28, z: 4, w: 9, d: 8, h: 4.4 }, { x: 34, z: 21, w: 5.5, d: 2, h: 15 }, { x: -5, z: 2, w: 16, d: 10, h: 1.4 }],
      [{ shape: 'box', x: -6, z: -17, w: 56, d: 9, h: 5.0, color: '#e8c8a8', lit: 0.4 }, { shape: 'box', x: -32, z: -1, w: 9, d: 22, h: 5.0, color: '#e8c8a8', lit: 0.4 }, { shape: 'box', x: 34, z: 21, w: 8.6, d: 0.6, h: 4.4, dy: 8.9, color: '#2a9a98' }]);
    for (let k = 0; k < 7; k++) lampAt(P, sm, my, -30 + k * 8, -10.5, 2.6, '#ffd8a0', 8, 0.7, 0.8);
    for (let k = 0; k < 3; k++) lampAt(P, sm, my, -25.5, -7 + k * 7, 2.6, '#ffd8a0', 8, 0.7, 0.8);
    lampAt(P, sm, my, -5, 2, 0.4, '#40e8ff', 12, 0.9, 0);
    lampAt(P, sm, my, 34, 18, 11, '#ff5aa8', 22, 0.75, 2.4);
    lampAt(P, sm, my, 28, 9, 2.8, '#5af0ff', 9, 0.6, 0.8);
    for (const [lx, lz] of [[22, 0], [-22, 9], [16, -11]]) addCircle(P, sm, my, lx, lz, 0.6, 5);
        // ---- BIG AL'S AUTO SALVAGE, west of the highway further south
    const sj = site(r5, 520, -1, 84, 62, 6);
    if (P.isFree(sj.x, sj.z, sj.w, sj.d, sj.ry, { anywhere: true })) {
      const jy = setPiece(P, { type: 'junk', ...sj, map: 'yard' }, [],
        [{ shape: 'box', x: 22, z: -18, w: 1.6, d: 1.6, h: 22, color: '#d8a030' }, { shape: 'box', x: -20, z: -22, w: 10, d: 3, h: 3.5, color: '#9a9690', lit: 0.3 }, { shape: 'box', x: 0, z: -10, w: 70, d: 30, h: 3.2, color: '#6a5040' }]);
      junkColliders(P, sj, jy);
      lampAt(P, sj, jy, -30, 26, 9, '#ffb060', 34, 1.0, 2.2);
      lampAt(P, sj, jy, 30, -26, 9, '#ffb060', 30, 0.9, 2.2);
      lampAt(P, sj, jy, -22, -20, 2.2, '#ffc070', 7, 0.6, 0);
    }
  }
  // ---- the DRY WELLS water tower, up on the mesa east of the junction
  for (const [x, z] of [[3990, -232], [4020, -222], [3970, -250], [4050, -230]]) {
    const g = P.groundRange(x, z, 12, 12, 0);
    if (g.hi - g.lo > 1.5 || !P.isFree(x, z, 12, 12, 0, { anywhere: true })) continue;
    const y = g.lo;
    P.claim(x, z, 12, 12, 0);
    P.add({ type: 'tower', x, z, w: 12, d: 12, ry: 0.3, map: 'building' });
    for (const [dx, dz] of [[-4, -4], [4, -4], [4, 4], [-4, 4]]) P.collider({ kind: 'circle', x: x + dx, z: z + dz, r: 0.5, y0: y - 2, y1: y + 22 });
    P.far({ shape: 'cyl', x, z, y: y + 20.6, r: 5.3, h: 6.4, color: '#b9c2c6' });
    P.far({ shape: 'cone', x, z, y: y + 27, r: 5.5, h: 2.6, color: '#9aa4a8' });
    P.far({ shape: 'box', x, z, y, w: 5, d: 5, h: 20, color: '#6d7174' });
    P.lamp({ x, z, hx: x, hz: z, hy: y + 30.3, color: '#ff2a1a', radius: 1, intensity: 0.01, halo: 1.3 });
    break;
  }
  // ---- along the highway: poles and wires, delineators, signs, billboards, drifts
  for (const r of roads) poleLine(P, r, -1, 13.5);
  const dl = road(P, 'dl_in');
  if (dl) poleLine(P, dl, -1, 11);
  for (const r of roads) delineators(P, r);
  signs(P);
  billboards(P, roads, i9);
  for (const r of roads) drifts(P, r);
  for (const r of roads) for (let s0 = 200; s0 < r.length - 100; s0 += 650) { const p = r.posAt(s0, 0); if (!(r.flags[p.i] & 5)) P.add({ type: 'tumble', x: p.x, z: p.z }); }
  rockShopPlan(P);
}

function delineators(P, r) {
  const s0 = r.trim0 + 10, s1 = r.length - r.trim1 - 10;
  const rt = r.rt;
  for (let s = s0; s < s1; s += 50) {
    for (const sd of [1, -1]) {
      const p = r.posAt(s, sd * (rt.hw + rt.shoulder + 0.6));
      if (r.flags[p.i] & 5) continue;
      // reflectors face the traffic on their side of the road
      P.add({ type: 'delin', x: p.x, z: p.z, y: r.Y[p.i] - 0.05, ry: facing(r, p.i, sd, sd < 0 ? 1 : -1, 0), amber: sd > 0 });
    }
  }
}

function signs(P) {
  signAt(P, 'i9_east2', -420, -1, 'lastExit', 1, { out: 2.5, bottom: 2.2 });
  signAt(P, 'i9_east2', -160, -1, 'town', 1, { out: 2 });
  signAt(P, 'r99_1', 40, -1, 'shield', 1);
  signAt(P, 'r99_1', 70, -1, 'limit', 1);
  signAt(P, 'r99_2', 80, -1, 'services', 1);
  signAt(P, 'r99_2', 260, 1, 'town', -1);
  signAt(P, 'r99_2', 380, -1, 'mile', 1);
  signAt(P, 'r99_2', 300, -1, 'cattle', 1);
  signAt(P, 'r99_3', 160, -1, 'rocks', 1);
  signAt(P, 'r99_3', -120, 1, 'rocks', -1);
  signAt(P, 'r99_4', 120, -1, 'shield', 1);
  signAt(P, 'r99_4', -150, 1, 'limit', -1);
  signAt(P, 'r99_5', 40, 1, 'shield', 1);
  signAt(P, 'r99_5', -60, -1, 'drylake', -1);
  signAt(P, 'r99_5', -110, 1, 'drylake', 1);
  signAt(P, 'r99_6', -90, 1, 'ghost', 1);
  signAt(P, 'r99_7', 90, -1, 'ghost', -1);
  signAt(P, 'r99_6', 60, -1, 'limit', -1);
  signAt(P, 'r99_7', 220, 1, 'dip', 1);
  signAt(P, 'r99_7', 380, 1, 'mile', 1);
  signAt(P, 'r99_8', 160, -1, 'shield', -1);
  signAt(P, 'r99_8', 300, 1, 'limit', 1);
}

function billboards(P, roads, i9) {
  const spots = [];
  if (i9) for (const [f, side, ad] of [[0.45, -1, 0], [0.56, 1, 2], [0.66, -1, 1], [0.77, 1, 4], [0.86, -1, 5]]) spots.push([i9, i9.length * f, side, ad, 1]);
  const byId = (id) => roads.find((r) => r.spec.id === id);
  for (const [id, f, side, ad, dir] of [['r99_2', 0.35, 1, 3, -1], ['r99_2', 0.7, -1, 6, 1], ['r99_3', 0.3, 1, 5, 1], ['r99_5', 0.85, -1, 0, -1], ['r99_6', 0.4, 1, 7, 1], ['r99_6', 0.75, -1, 1, -1], ['r99_7', 0.5, -1, 6, -1], ['r99_8', 0.35, 1, 0, -1], ['r99_8', 0.7, -1, 2, 1], ['r99_4', 0.5, 1, 7, -1]]) {
    const r = byId(id);
    if (r) spots.push([r, r.length * f, side, ad, dir]);
  }
  for (const [r, s, side, ad, dir] of spots) {
    const p = r.posAt(s, side * (reachOf(r) + (r.rt.id === 'freeway' ? 18 : 14)));
    const i = p.i;
    const ry = facing(r, i, side, dir, 0.42);
    if (!P.isFree(p.x, p.z, 13, 4, ry, { anywhere: true, roadPad: true })) continue;
    P.claim(p.x, p.z, 13, 4, ry);
    P.add({ type: 'billboard', x: p.x, z: p.z, ry, ad, map: 'building' });
    const y = P.groundY(p.x, p.z);
    const c = Math.cos(ry), sn = Math.sin(ry);
    for (const lx of [-12 * 0.36, 0, 12 * 0.36]) P.collider({ kind: 'circle', x: p.x + lx * c - 0.6 * sn, z: p.z - lx * sn - 0.6 * c, r: 0.3, y0: y - 1, y1: y + 9 });
    P.far({ shape: 'box', x: p.x, z: p.z, y: y + 5.4, w: 12, d: 0.6, h: 4.2, ry, color: '#5a4a3a' });
    P.lamp({ x: p.x + sn * 1.3, z: p.z + c * 1.3, hx: p.x + sn * 1.3, hz: p.z + c * 1.3, hy: y + 9.7, color: '#fff0d0', radius: 9, intensity: 0.7, halo: 1.2 });
  }
}

/** Sand blown across the asphalt here and there. */
function drifts(P, r) {
  const n = Math.floor(r.length / 240);
  for (let k = 0; k < n; k++) {
    const s = r.trim0 + 30 + hash1(r.ri, k, 9) * (r.length - r.trim0 - r.trim1 - 80);
    const p = r.posAt(s, 0);
    if (r.flags[p.i] & 5) continue;
    P.add({ type: 'drift', x: p.x, z: p.z, road: r.spec.id, s, len: 14 + hash1(r.ri, k, 8) * 22, side: hash1(r.ri, k, 7) < 0.5 ? 1 : -1, reach: 0.4 + hash1(r.ri, k, 6) * 0.6 });
  }
}

/** The rock shop: a roadside curio stand with a concrete dinosaur, south on Route 99. */
function rockShopPlan(P) {
  const r = road(P, 'r99_6');
  if (!r) return;
  const st = site(r, r.length * 0.5, 1, 40, 30, 5);
  if (!P.isFree(st.x, st.z, st.w, st.d, st.ry, { anywhere: true })) return;
  const y = setPiece(P, { type: 'stand', ...st, map: 'building' },
    [{ x: -8, z: -6, w: 12.6, d: 7.6, h: 4 }, { x: 11, z: -2, w: 13, d: 4, h: 10 }],
    [{ shape: 'box', x: 11, z: -2, w: 10, d: 3.6, h: 6, color: '#5a8a5a' }, { shape: 'box', x: -8, z: -6, w: 12, d: 7, h: 4.4, color: '#c8a878', lit: 0.3 }]);
  lampAt(P, st, y, -8, -1.5, 3.2, '#ffcf8a', 10, 0.7, 1);
  lampAt(P, st, y, 4, 6, 4.2, '#ffd890', 16, 0.6, 0.6);
  lampAt(P, st, y, 11, 6, 1.0, '#a0ff90', 14, 0.5, 0);
}

function junkColliders(P, st, y) {
  const hw = st.w / 2, hd = st.d / 2;
  addBox(P, st, y, 0, -hd, st.w, 0.6, 3);
  addBox(P, st, y, -hw, 0, 0.6, st.d, 3);
  addBox(P, st, y, hw, 0, 0.6, st.d, 3);
  addBox(P, st, y, -hw / 2 - 3, hd, hw - 6, 0.6, 3);
  addBox(P, st, y, hw / 2 + 3, hd, hw - 6, 0.6, 3);
  for (const [lx, lz, w, d] of JUNK_STACKS) addBox(P, st, y, lx, lz, w, d, 4);
  addBox(P, st, y, 22, -18, 6, 5, 4);
  addBox(P, st, y, -20, -22, 10.5, 3.6, 3.5);
}
// rows of wreck stacks inside the yard: [lx, lz, w, d]
const JUNK_STACKS = [[-30, -6, 5, 18], [-22, -6, 5, 18], [-30, 14, 5, 12], [-12, 14, 14, 5], [6, 14, 14, 5], [0, -24, 18, 5], [32, -2, 5, 20], [10, -6, 5, 12]];

// ================================================================== the High Desert

function planHighlands(P) {
  const a3 = road(P, 'ar_r3'), a2 = road(P, 'ar_r2');
  if (a3) {
    // ---- the radio array: white dishes down the basin either side of the road
    let k = 0;
    for (let s = 90; s < a3.length - 40; s += 150) {
      const side = k % 2 ? 1 : -1;
      const p = a3.posAt(s, side * 52);
      if (!P.isFree(p.x, p.z, 16, 16, 0, { anywhere: true, roadPad: true })) continue;
      const y = P.groundY(p.x, p.z);
      P.claim(p.x, p.z, 16, 16, 0);
      P.add({ type: 'dish', x: p.x, z: p.z, w: 16, d: 16, k, map: 'building' });
      P.collider({ kind: 'circle', x: p.x, z: p.z, r: 3.6, y0: y - 2, y1: y + 14 });
      P.far({ shape: 'cyl', x: p.x, z: p.z, y, r: 1.8, h: 12, color: '#e8e8e4' });
      P.far({ shape: 'cyl', x: p.x, z: p.z, y: y + 11, r: 9.5, r2: 6, h: 5, color: '#f2f2ee' });
      P.lamp({ x: p.x, z: p.z, hx: p.x, hz: p.z, hy: y + 21, color: '#ff2a1a', radius: 1, intensity: 0.01, halo: 1.2 });
      // a work light at the pedestal throws a little light up into the bowl
      P.lamp({ x: p.x + 4, z: p.z + 4, hx: p.x + 4, hz: p.z + 4, hy: y + 2.5, color: '#d8e8ff', radius: 22, intensity: 0.55, halo: 1.0 });
      k++;
    }
    // the control building, its mast, near the junction
    let st = null;
    for (const [s, side] of [[60, 1], [60, -1], [120, 1], [120, -1], [200, 1], [200, -1]]) {
      const c = site(a3, s, side, 46, 36, 6);
      if (P.isFree(c.x, c.z, c.w, c.d, c.ry, { anywhere: true })) { st = c; break; }
    }
    if (st) {
      const y = setPiece(P, { type: 'array', ...st, map: 'building' },
        [{ x: -6, z: -6, w: 22, d: 12, h: 7 }, { x: 14, z: -10, w: 3.4, d: 3.4, h: 60 }],
        [{ shape: 'box', x: -6, z: -6, w: 22, d: 12, h: 6.5, color: '#d8dcde', lit: 0.5 }, { shape: 'box', x: 14, z: -10, w: 2, d: 2, h: 60, color: '#c84a3a' }]);
      lampAt(P, st, y, -6, 2, 4.5, '#cfe6ff', 16, 0.8, 1.4);
      lampAt(P, st, y, 14, -10, 60.2, '#ff2a1a', 1, 0.01, 2.6);
      lampAt(P, st, y, 14, -10, 30, '#ff2a1a', 1, 0.01, 1.8);
      P.landmark({ id: 'radio_array', name: 'HIGH DESERT ARRAY', x: st.x, z: st.z, r: 400, kind: 'observatory' });
    }
    signAt(P, 'ar_r2', -60, 1, 'array', 1, { out: 1 });
  }
  // ---- the missile silo past the end of the Silo Rd (hidden)
  const sr = road(P, 'si_road');
  if (sr) {
    const end = sr.posAt(sr.length - 1);
    const i = end.i;
    const fx = sr.TX[i], fz = sr.TZ[i];
    const x = end.x + fx * 30, z = end.z + fz * 30, ry = Math.atan2(-fx, -fz);
    const y = setPiece(P, { type: 'silo', x, z, w: 56, d: 50, ry, map: 'yard' },
      [{ x: 0, z: -4, w: 13, d: 13, h: 1.4 }, { x: 9.5, z: -4, w: 10, d: 9, h: 2.6 }, { x: 16, z: 14, w: 5, d: 4, h: 3 }, { x: -16, z: -16, w: 2, d: 2, h: 16 }, { x: 10, z: -18, w: 6, d: 3, h: 2.5 }],
      []);
    lampAt(P, { x, z, ry }, y, 0, -4, 1.2, '#4aff6a', 12, 0.55, 0);
    lampAt(P, { x, z, ry }, y, 16, 16.5, 2.6, '#ffd890', 8, 0.5, 0.8);
    P.landmark({ id: 'silo_9', name: 'SILO 9', x, z, r: 40, kind: 'silo', hidden: true });
  }
  // ---- the satellite that came down past the basin's far end (off the road)
  if (a3) {
    const end = a3.posAt(a3.length - 1);
    const x = end.x + 40, z = end.z - 260;
    if (P.inside(x, z, 20) && P.isFree(x, z, 30, 30, 0)) {
      const y = P.groundY(x, z);
      P.claim(x, z, 30, 30, 0);
      P.add({ type: 'crash', x, z, w: 30, d: 30, ry: 0.7, map: 'field' });
      P.collider({ kind: 'box', x, z, hx: 2.4, hz: 2.0, ry: 0.7, y0: y - 1, y1: y + 4 });
      P.lamp({ x, z, hx: x, hz: z, hy: y + 1.5, color: '#ff8a30', radius: 14, intensity: 0.5, halo: 0 });
    }
  }
  if (a2) poleLine(P, a2, 1, 10);
  if (a3) poleLine(P, a3, -1, 10);
}

// ================================================================== scatter

function scatterDesert(S) {
  const nz = (x, z, f) => 0.5 + 0.5 * S.noise(x / f, z / f);
  const G = cellGround(S);
  // Joshua trees in loose stands, saguaros on the open flats in between
  for (const [x, z] of S.points(34, { r: 3, density: (x, z) => sstep(0.35, 0.85, nz(x, z, 260)) * 0.85 })) {
    if (steepAt(S, x, z) > 0.35) continue;
    const y = G.h(x, z), s = S.range(0.7, 1.25);
    S.add({ type: 'plant', kind: 'joshua', x, z, y, s, seed: seedOf(S) });
    S.collider({ kind: 'circle', x, z, r: 0.4 * s, y0: y - 1, y1: y + 5 });
  }
  for (const [x, z] of S.points(46, { r: 3, density: (x, z) => sstep(0.25, 0.7, 1 - nz(x, z, 260)) * 0.8 })) {
    if (steepAt(S, x, z) > 0.3) continue;
    const y = G.h(x, z), s = S.range(0.6, 1.2);
    S.add({ type: 'plant', kind: 'saguaro', x, z, y, s, seed: seedOf(S) });
    S.collider({ kind: 'circle', x, z, r: 0.4, y0: y - 1, y1: y + 8 });
  }
  shrubs(S, 10, (x, z) => 0.35 + 0.4 * nz(x, z, 90), [[0, 55], [1, 25], [2, 13], [3, 7]], { maxSlope: 0.6 });
  for (const [x, z] of S.points(28, { r: 1.5, density: () => 0.5 })) {
    const r = S.rng();
    S.add({ type: 'plant', kind: r < 0.35 ? 'yucca' : r < 0.6 ? 'ocotillo' : r < 0.85 ? 'barrel' : 'pear', x, z, y: G.h(x, z), s: S.range(0.8, 1.25), seed: seedOf(S) });
  }
  for (const [x, z] of S.points(36, { r: 3 })) {
    if (S.rng() > 0.45) continue;
    const s = S.range(0.5, 2.4), y = lowest(G, x, z, s);
    S.add({ type: 'rock', x, z, y, s, seed: seedOf(S), color: S.pick(['#9a7a5a', '#a88a68', '#8a6a50', '#b08a64']) });
    if (s > 1.1) S.collider({ kind: 'circle', x, z, r: s * 0.9, y0: y - 1, y1: y + s * 1.2 });
  }
  cliffLedges(S, MESA_TONES);
}

function scatterHighlands(S) {
  const nz = (x, z, f) => 0.5 + 0.5 * S.noise(x / f, z / f);
  const G = cellGround(S);
  // the Joshua tree forest (thicker in the basin and on the lower slopes)
  for (const [x, z] of S.points(22, { r: 3, density: (x, z) => sstep(0.3, 0.75, nz(x, z, 200)) })) {
    const y = G.h(x, z);
    if (y > 380 || steepAt(S, x, z) > 0.45) continue;
    const s = S.range(0.75, 1.35);
    S.add({ type: 'plant', kind: 'joshua', x, z, y, s, seed: seedOf(S) });
    S.collider({ kind: 'circle', x, z, r: 0.45 * s, y0: y - 1, y1: y + 6 });
  }
  // granite boulder heaps
  for (const [x, z] of S.points(64, { r: 6 })) {
    if (S.rng() > 0.6) continue;
    const s = S.range(0.9, 2.4);
    if (G.slope(x, z).g > 0.5) continue;
    const y = lowest(G, x, z, s * 1.6);
    S.add({ type: 'rock', kind: 'pile', x, z, y: y + 0.3, s, seed: seedOf(S) });
    S.collider({ kind: 'circle', x, z, r: s * 1.5, y0: y - 1, y1: y + s * 2.4 });
  }
  shrubs(S, 13, (x, z) => 0.25 + 0.3 * nz(x, z, 70), [[2, 1], [3, 1]], { maxY: 520, s: [0.6, 1.1] });
  for (const [x, z] of S.points(40, { r: 2 })) {
    if (S.rng() > 0.5) continue;
    S.add({ type: 'rock', x, z, y: G.h(x, z), s: S.range(0.6, 1.8), seed: seedOf(S), color: S.pick(['#b8a088', '#a89078', '#c8b098']) });
  }
}

// ================================================================== building: helpers

/** Sand blown across the road: a strip of the drift texture laid on the asphalt. */
function drift(B, it) {
  const r = B.net.byId.get(it.road);
  if (!r) return;
  const acc = B.acc(MAT.drift(B));
  paint(acc, '#dcc08c');
  const hw = r.rt.hw + r.rt.shoulder;
  const n = Math.max(2, Math.round(it.len / 3));
  const base = acc.count;
  for (let k = 0; k <= n; k++) {
    const p = r.posAt(it.s - it.len / 2 + (k / n) * it.len, 0), i = p.i;
    const a = it.side * hw, b = it.side * (hw - hw * 2 * it.reach);
    for (const [lat, u] of [[a, 0], [b, 1]]) {
      const cl = Math.max(-r.rt.hw, Math.min(r.rt.hw, lat));
      acc.v(p.x + r.LX[i] * lat, r.roadY(i, p.t, cl) + 0.035, p.z + r.LZ[i] * lat, u, k / n);
    }
  }
  for (let k = 0; k < n; k++) {
    const q = base + k * 2;
    if (it.side > 0) { acc.tri(q, q + 1, q + 2); acc.tri(q + 1, q + 3, q + 2); } else { acc.tri(q, q + 2, q + 1); acc.tri(q + 1, q + 2, q + 3); }
  }
}

/** Local frame of a set piece: at(lx, lz) → [x, z]; ry; cos/sin; its ground. */
function frameOf(B, it) {
  const c = Math.cos(it.ry), s = Math.sin(it.ry);
  return { at: (lx, lz) => [it.x + lx * c + lz * s, it.z - lx * s + lz * c], ry: it.ry, c, s, y: B.groundY(it.x, it.z) };
}

/** A drape over a local rectangle (lots, pads). */
function lot(B, F, lx0, lz0, lx1, lz1, color, step = 4) {
  const acc = B.acc(lotMat(B));
  paint(acc, color);
  drape(acc, B, [F.at(lx0, lz1), F.at(lx1, lz1), F.at(lx1, lz0), F.at(lx0, lz0)], { lift: 0.05, step, uv: 6 });
}

/** Painted stall lines on a lot: n stalls w apart from lx0, len deep from lz0. */
function stalls(B, F, lx0, lz0, n, w, len) {
  const acc = B.acc(lotMat(B));
  paint(acc, '#e8e4d8');
  for (let k = 0; k <= n; k++) {
    const [x, z] = F.at(lx0 + k * w, lz0 + len / 2);
    flat(acc, x, B.groundY(x, z) + 0.08, z, 0.14, len, F.ry);
  }
}

/** A flat triangle (two-sided) in a vertical plane: an arrow head, a pennant. */
function tri2(acc, A, Bp, C) {
  const a = acc.v(...A, 0, 0), b = acc.v(...Bp, 1, 0), c = acc.v(...C, 0.5, 1);
  acc.tri(a, b, c);
  acc.tri(a, c, b);
}

// ================================================================== building: Dry Wells

function* diner(B, it, tick) {
  const F = frameOf(B, it);
  const { at, ry, c, s } = F;
  lot(B, F, -it.w / 2, -2, it.w / 2, it.d / 2, '#3a3a3c');
  lot(B, F, -it.w / 2 + 4, -it.d / 2 + 2, -12, -2, '#4a4844');
  stalls(B, F, -20, 8, 9, 3.2, 5.5);
  stalls(B, F, 12, 0, 5, 3.2, 5);
  yield;
  // ---- the diner: a streamliner with rounded ends on a stainless base
  const [bx, bz] = at(6, -12);
  const g = B.footY(bx, bz, 36, 11, ry);
  const y = g.hi;
  const L = 26, D = 9.4, R0 = D / 2;
  const metal = B.acc(MAT.metal(B)), pa = B.acc(MAT.paint(B)), signs = B.acc(MAT.signs(B)), neon = B.acc(MAT.neon(B));
  paint(pa, '#8a8680');
  box(pa, bx, g.lo - 0.6, bz, L + D - 0.4, y - g.lo + 0.7, D - 0.2, ry, { top: false });
  const ring = (yy, h, mat, col, k = 1) => {
    paint(mat, col, k);
    for (const sz of [1, -1]) box(mat, bx + s * sz * R0, yy, bz + c * sz * R0, L, h, 0.05, ry, { top: false, faces: sz > 0 ? 'f' : 'b' });
    for (const sx of [1, -1]) {
      const cx = bx + c * sx * L / 2, cz = bz - s * sx * L / 2;
      for (let k2 = 0; k2 < 8; k2++) {
        const a0 = -Math.PI / 2 + (k2 / 8) * Math.PI, a1 = -Math.PI / 2 + ((k2 + 1) / 8) * Math.PI;
        const p0 = [Math.cos(a0) * R0 * sx, Math.sin(a0) * R0], p1 = [Math.cos(a1) * R0 * sx, Math.sin(a1) * R0];
        const w0 = [cx + p0[0] * c + p0[1] * s, cz - p0[0] * s + p0[1] * c], w1 = [cx + p1[0] * c + p1[1] * s, cz - p1[0] * s + p1[1] * c];
        if (sx > 0) mat.quadP([w1[0], yy, w1[1]], [w0[0], yy, w0[1]], [w0[0], yy + h, w0[1]], [w1[0], yy + h, w1[1]], [0, 0, 1, h / 2]);
        else mat.quadP([w0[0], yy, w0[1]], [w1[0], yy, w1[1]], [w1[0], yy + h, w1[1]], [w0[0], yy + h, w0[1]], [0, 0, 1, h / 2]);
      }
    }
  };
  ring(y, 0.95, metal, '#cfd4d8');
  ring(y + 0.95, 2.0, metal, '#aab2b8');
  ring(y + 2.95, 0.85, pa, '#2aa3a0');
  ring(y + 3.8, 0.18, metal, '#e8ecef');
  // the window band on the front: the window module, either side of the door
  for (let k = 0; k < 6; k++) {
    const lx = -L / 2 + 2.2 + k * 4.4;
    if (Math.abs(lx + 1) < 2.4) continue;
    const [px, pz] = at(6 + lx, -12 + R0 + 0.06);
    panel(signs, px, y + 0.95, pz, ry, 4.2, 2.0, uvOf(R.dinerWin));
  }
  // the roof: a slab with rounded ends, roof units
  paint(pa, '#e8e6e0');
  box(pa, bx, y + 3.98, bz, L, 0.3, D + 0.6, ry);
  for (const sx of [1, -1]) cylinder(pa, bx + c * sx * L / 2, y + 3.98, bz - s * sx * L / 2, R0 + 0.3, 0.3, 10, { top: true });
  paint(pa, '#9a9a96');
  for (const lx of [-8, 3]) { const [px, pz] = at(6 + lx, -14); box(pa, px, y + 4.28, pz, 2.4, 1.2, 1.8, ry); }
  yield;
  // the vestibule and its door
  {
    const [vx, vz] = at(5, -12 + R0 + 1.6);
    paint(metal, '#d8dce0');
    box(metal, vx, y, vz, 4.4, 3.4, 3.2, ry);
    paint(pa, '#c8322a');
    box(pa, vx, y + 3.4, vz, 4.8, 0.35, 3.6, ry);
    const [dx, dz] = at(5, -12 + R0 + 3.22);
    panel(signs, dx, y, dz, ry, 2.4, 2.6, uvOf(R.dinerDoor));
  }
  // neon trims along the bands: pink under the roof, cyan at the base
  paint(neon, '#ff4fa3');
  box(neon, bx + s * (R0 + 0.08), y + 3.86, bz + c * (R0 + 0.08), L, 0.1, 0.06, ry);
  paint(neon, '#5af0ff');
  box(neon, bx + s * (R0 + 0.08), y + 0.9, bz + c * (R0 + 0.08), L, 0.08, 0.06, ry);
  // the roof sign: ROCKET DINER on a frame
  {
    paint(pa, '#3a3c40');
    for (const lx of [-4.5, 4.5]) { const [px, pz] = at(4 + lx, -11); box(pa, px, y + 4.28, pz, 0.2, 3.4, 0.2, ry); }
    const [sx, sz] = at(4, -11);
    paint(pa, '#103c44');
    box(pa, sx, y + 5.0, sz, 12.4, 3.2, 0.4, ry);
    const [fx, fz] = at(4, -10.79);
    panel(signs, fx, y + 5.05, fz, ry, 12, 3.0, uvOf(R.dinerSign));
    const [bx2, bz2] = at(4, -11.21);
    panel(signs, bx2, y + 5.05, bz2, ry + Math.PI, 12, 3.0, uvOf(R.dinerSign));
  }
  yield;
  // ---- the rocket on its pylon by the road
  rocketSign(B, F, -26, 20);
  if (tick()) yield;
  // ---- parked: classic cars nose-in, a rig along the back, palms, a phone booth
  for (let k = 0; k < 9; k++) {
    if (hash1(it.n, k) < 0.35) continue;
    const [px, pz] = at(-18.4 + k * 3.2, 10.75);
    car(B, px, B.groundY(px, pz), pz, ry + Math.PI, { kind: hash1(it.n, k, 1) < 0.25 ? 'pickup' : 'sedan', color: CAR_COLS[(k * 3 + it.n) % CAR_COLS.length], fins: hash1(it.n, k, 2) < 0.6 });
  }
  {
    const [px, pz] = at(-20, -14);
    const gy = B.groundY(px, pz);
    paint(pa, '#e7e7e4');
    box(pa, px, gy + 1.25, pz, 15, 3.1, 2.6, ry);
    paint(pa, '#2a5a8a');
    const [cx2, cz2] = at(-20 + 9.4, -14);
    box(pa, cx2, gy + 0.9, cz2, 3.4, 2.6, 2.5, ry);
    box(pa, cx2 - c * 0.6, gy + 3.5, cz2 + s * 0.6, 2.2, 0.8, 2.4, ry);
    paint(pa, '#141414');
    for (const lx of [-25, -23.6, -14.5, -11.2]) for (const lz of [-15.1, -12.9]) { const [wx, wz] = at(lx, lz); hcyl(pa, wx, gy + 0.5, wz, 0.5, 0.4, ry + Math.PI / 2, 8, true); }
  }
  for (const [lx, lz, h] of [[-14, -6, 9], [20, -5, 11], [24, -9, 8]]) { const [px, pz] = at(lx, lz); fanPalm(B, px, B.groundY(px, pz), pz, h, it.n * 7 + lx); }
  {
    const [px, pz] = at(-10, 2);
    const nr = B.near(MAT.paint(B));
    paint(nr, '#a8b2b8'); box(nr, px, B.groundY(px, pz), pz, 1.0, 2.3, 1.0, ry);
    paint(nr, '#3a5a8a'); box(nr, px, B.groundY(px, pz) + 2.3, pz, 1.1, 0.2, 1.1, ry);
  }
  lotLampPosts(B, F, DINER_LAMPS);
}

/** The rocket: a silver ship standing on a red-and-white pylon, neon fins, a flickering exhaust. */
function rocketSign(B, F, lx, lz) {
  const [x, z] = F.at(lx, lz);
  const y = B.groundY(x, z);
  const { ry, c, s } = F;
  const pa = B.acc(MAT.paint(B)), metal = B.acc(MAT.metal(B)), neon = B.acc(MAT.neon(B)), signs = B.acc(MAT.signs(B)), lights = B.acc(MAT.lights(B));
  paint(pa, '#a8a49c');
  box(pa, x, y - 0.5, z, 3.4, 1.4, 3.4, ry);
  for (let k = 0; k < 7; k++) {
    paint(pa, k % 2 ? '#e8e4da' : '#c8322a');
    cylinder(pa, x, y + 0.9 + k * 1.9, z, 0.55 - k * 0.03, 1.9, 8, { r2: 0.52 - k * 0.03 });
  }
  // the panel half way up: EAT / PIE / OPEN 24 HRS on both faces
  paint(pa, '#1d6f73');
  box(pa, x, y + 5.6, z, 6.4, 3.4, 0.5, ry);
  panel(signs, x + s * 0.27, y + 5.7, z + c * 0.27, ry, 6.2, 3.1, uvOf(R.rocketPanel));
  panel(signs, x - s * 0.27, y + 5.7, z - c * 0.27, ry + Math.PI, 6.2, 3.1, uvOf(R.rocketPanel));
  // a chasing row of bulbs under the panel, running toward the diner
  for (let k = 0; k < 11; k++) {
    for (const f of [1, -1]) {
      const k0 = lights.count;
      paint(lights, '#ffd27a');
      box(lights, x + c * (-2.8 + k * 0.56) + f * s * 0.3, y + 5.15, z - s * (-2.8 + k * 0.56) + f * c * 0.3, 0.22, 0.22, 0.12, ry);
      animUV(lights, k0, k / 11, 1.6);
    }
  }
  // the rocket: body, nose, fins (neon edged), portholes, a neon ring
  const base = y + 14.2;
  paint(metal, '#dfe4e8');
  cylinder(metal, x, base, z, 1.25, 6.5, 12, { r2: 1.2 });
  cylinder(metal, x, base + 6.5, z, 1.2, 1.6, 12, { r2: 0.95 });
  paint(pa, '#c8322a');
  cone(pa, x, base + 8.1, z, 0.95, 3.6, 12);
  cylinder(pa, x, base - 0.6, z, 0.95, 0.6, 12, { r2: 1.25 });
  for (let k = 0; k < 4; k++) {
    const a = (k / 4) * TAU + Math.PI / 4 + ry;
    const fx = Math.cos(a), fz = Math.sin(a), fry = Math.atan2(fx, fz);
    paint(pa, '#c8322a');
    obox(pa, x + fx * 1.75, base - 1.7, z + fz * 1.75, 0.18, 4.4, 1.9, fry, 0, 0);
    paint(neon, '#ff5aa8');
    obox(neon, x + fx * 2.68, base - 1.7, z + fz * 2.68, 0.1, 4.2, 0.1, fry, 0, 0);
  }
  paint(neon, '#5af0ff');
  for (const h of [4.4, 2.4]) hcyl(neon, x + s * 1.22, base + h, z + c * 1.22, 0.42, 0.08, ry - Math.PI / 2, 10, true);
  paint(neon, '#ffe36a');
  cylinder(neon, x, base + 6.45, z, 1.27, 0.12, 12);
  // the exhaust flame (flickering), pouring down round the top of the pylon
  const k0 = lights.count;
  paint(lights, '#ff9a2a');
  cone(lights, x, base - 0.6, z, 0.85, -3.0, 8);
  paint(lights, '#ffe36a');
  cone(lights, x, base - 0.6, z, 0.45, -2.0, 6);
  animUV(lights, k0, 0.3, -9);
}

function lotLampPosts(B, F, pts) {
  for (const [lx, lz] of pts) {
    const [x, z] = F.at(lx, lz);
    const y = B.groundY(x, z);
    lampPost(B, x, y, z, x, y + 9.0, z, { color: '#fff2d8' });
  }
}

function* gas(B, it) {
  const F = frameOf(B, it);
  const { at, ry, c, s } = F;
  lot(B, F, -it.w / 2, -it.d / 2, it.w / 2, it.d / 2, '#8e8b84');
  yield;
  const y = F.y;
  const pa = B.acc(MAT.paint(B)), signs = B.acc(MAT.signs(B)), stucco = B.acc(MAT.stucco(B));
  // ---- the canopy (lit underneath), columns, fascia
  const cw = 22, cd = 12, ch = 5.3, cz0 = 3;
  paint(pa, '#e2ded6');
  for (const lx of [-8, 0, 8]) for (const lz of [-1.5, 7.5]) { const [px, pz] = at(lx, lz); box(pa, px, y - 0.2, pz, 0.5, ch + 0.2, 0.5, ry); }
  const [cx, cz] = at(0, cz0);
  paint(pa, '#f2efe8');
  box(pa, cx, y + ch, cz, cw, 1.1, cd, ry);
  for (const [lz, r2] of [[cz0 + cd / 2 + 0.02, 0], [cz0 - cd / 2 - 0.02, Math.PI]]) {
    for (let k = 0; k < 4; k++) { const [px, pz] = at(-cw / 2 + cw / 8 + k * cw / 4, lz); panel(signs, px, y + ch + 0.05, pz, ry + r2, cw / 4, 1.0, uvOf(R.fascia)); }
  }
  for (const sx of [1, -1]) {
    for (let k = 0; k < 2; k++) { const [px, pz] = at(sx * (cw / 2 + 0.02), cz0 - cd / 4 + k * cd / 2); panel(signs, px, y + ch + 0.05, pz, ry + sx * Math.PI / 2, cd / 2, 1.0, uvOf(R.fascia)); }
  }
  for (const lz of [cz0 - 3, cz0 + 3]) for (const lx of [-6, 6]) { const [px, pz] = at(lx, lz); flat(signs, px, y + ch - 0.02, pz, 8, 4.5, ry, uvOf(R.canopyLight), true); }
  // ---- pump islands
  for (const lz of [0.5, 5.5]) {
    const [ix, iz] = at(0, lz);
    paint(pa, '#c8c4bc');
    box(pa, ix, y, iz, 13, 0.22, 1.3, ry);
    for (const lx of [-4.5, 0, 4.5]) {
      const [px, pz] = at(lx, lz);
      paint(pa, '#e5e2db');
      box(pa, px, y + 0.22, pz, 0.75, 1.85, 0.6, ry);
      for (const sg of [1, -1]) { const [qx, qz] = at(lx, lz + sg * 0.31); panel(signs, qx, y + 0.3, qz, ry + (sg > 0 ? 0 : Math.PI), 0.7, 1.7, uvOf(R.pump)); }
      paint(pa, '#d4231c');
      box(pa, px, y + 2.07, pz, 0.85, 0.16, 0.66, ry);
    }
  }
  yield;
  // ---- the store at the back
  {
    const [sx, sz] = at(0, -9);
    const g = B.footY(sx, sz, 14, 9, ry);
    paint(stucco, '#f0ece2');
    box(stucco, sx, g.lo - 0.4, sz, 14, g.hi - g.lo + 4.4, 9, ry, { u: 4 });
    paint(pa, '#d4231c');
    box(pa, sx, g.hi + 4.0, sz, 14.4, 0.6, 9.4, ry);
    const [fx, fz] = at(0, -9 + 4.52);
    panel(signs, fx, g.hi, fz, ry, 13.6, 3.6, uvOf(R.storeFront));
    paint(pa, '#9a9a96');
    const [ax, az] = at(3, -10); box(pa, ax, g.hi + 4.6, az, 2.6, 1.2, 2, ry);
    const nr = B.near(MAT.paint(B));
    const [ix, iz] = at(-5.5, -4); paint(nr, '#e8eef2'); box(nr, ix, g.hi, iz, 2.2, 1.3, 0.9, ry);
    const [px2, pz2] = at(7.5, -4.2); paint(nr, '#c8322a'); box(nr, px2, g.hi, pz2, 0.6, 1.5, 0.5, ry);
    const [tx, tz] = at(9.5, -3.8); tyres(nr, tx, g.hi, tz, 5);
  }
  // ---- the price sign by the road
  {
    const [px, pz] = at(-19, 14);
    const gy = B.groundY(px, pz);
    paint(pa, '#8a8e92');
    box(pa, px, gy - 0.3, pz, 0.36, 9.0, 0.36, ry);
    panel(signs, px + s * 0.2, gy + 5.5, pz + c * 0.2, ry, 3.2, 3.2, uvOf(R.price));
    panel(signs, px - s * 0.2, gy + 5.5, pz - c * 0.2, ry + Math.PI, 3.2, 3.2, uvOf(R.price));
    paint(pa, '#d4231c');
    box(pa, px, gy + 8.7, pz, 3.4, 0.5, 0.5, ry);
  }
  // a tow truck waiting at the side
  const [tx, tz] = at(19, -6);
  car(B, tx, B.groundY(tx, tz), tz, ry + Math.PI / 2, { kind: 'pickup', color: '#e8b030' });
}

function* motel(B, it) {
  const F = frameOf(B, it);
  const { at, ry } = F;
  lot(B, F, -it.w / 2, -10, it.w / 2, it.d / 2, '#3c3c3e');
  stalls(B, F, -28, -9.5, 13, 3.4, 5);
  yield;
  const pa = B.acc(MAT.paint(B)), signs = B.acc(MAT.signs(B)), stucco = B.acc(MAT.stucco(B));
  // a wing of rooms: len long, 9 deep, fronting local +z turned by rot
  const wing = (lx, lz, len, rot, rooms) => {
    const rr = ry + rot;
    const c = Math.cos(rr), s = Math.sin(rr);
    const [wx, wz] = at(lx, lz);
    const g = B.footY(wx, wz, len, 9, rr);
    paint(stucco, '#f0dcc0');
    box(stucco, wx, g.lo - 0.4, wz, len, g.hi - g.lo + 3.8, 9, rr, { u: 4 });
    paint(pa, '#c86a4a');
    box(pa, wx, g.hi + 3.4, wz, len + 0.6, 0.35, 9.6, rr);
    paint(pa, '#a85a3a');
    gable(pa, wx, g.hi + 3.75, wz, len + 0.4, 9.4, 1.3, rr, { over: 0.3 });
    for (let k = 0; k < rooms / 2; k++) {
      const off = -len / 2 + 4 + k * 8;
      panel(signs, wx + c * off + s * 4.52, g.hi, wz - s * off + c * 4.52, rr, 8, 3.0, uvOf(R.motelRoom));
    }
    paint(pa, '#2a9a98');
    box(pa, wx + s * 5.6, g.hi + 2.9, wz + c * 5.6, len, 0.16, 2.4, rr);
    paint(pa, '#e8e4da');
    for (let k = 0; k <= rooms / 2; k++) { const off = -len / 2 + k * (len / (rooms / 2)); box(pa, wx + c * off + s * 6.6, g.hi, wz - s * off + c * 6.6, 0.14, 2.9, 0.14, rr); }
    return g.hi;
  };
  const y = wing(-6, -17, 56, 0, 14);
  yield;
  wing(-32, -1, 22, Math.PI / 2, 6);
  yield;
  // ---- the office (a big window, OFFICE in neon) on the front corner
  {
    const [ox, oz] = at(28, 4);
    const g = B.footY(ox, oz, 9, 8, ry);
    paint(stucco, '#f1e4c8');
    box(stucco, ox, g.lo - 0.4, oz, 9, g.hi - g.lo + 4, 8, ry, { u: 4 });
    paint(pa, '#2a9a98');
    box(pa, ox, g.hi + 3.6, oz, 10.4, 0.5, 9.4, ry);
    obox(pa, ox, g.hi + 4.1, oz, 10, 0.2, 9, ry, 0.12, 0);
    const [fx, fz] = at(28, 8.03);
    panel(signs, fx, g.hi, fz, ry, 4.2, 3.4, uvOf(R.office));
  }
  // ---- the pool: coping, water (glowing turquoise at night), loungers, an umbrella, a fence
  {
    const [px, pz] = at(-5, 2);
    const gy = B.groundY(px, pz);
    paint(pa, '#e8e4da');
    box(pa, px, gy - 0.3, pz, 16, 0.75, 10, ry);
    const w = B.acc(MAT.glass(B));
    paint(w, '#28c8d8');
    flat(w, px, gy + 0.46, pz, 14.6, 8.6, ry);
    const nr = B.near(MAT.paint(B));
    for (let k = 0; k < 5; k++) {
      const [lx, lz] = at(-12 + k * 3, -4.5);
      paint(nr, k % 2 ? '#f0f0ea' : '#f15e8a');
      obox(nr, lx, gy + 0.3, lz, 0.7, 0.12, 1.9, ry, 0.15, 0);
    }
    const [ux, uz] = at(6, -4.5);
    paint(nr, '#e8e4da'); cylinder(nr, ux, gy, uz, 0.05, 2.3, 4);
    paint(nr, '#f15e8a'); cone(nr, ux, gy + 2.0, uz, 1.6, 0.6, 8);
    paint(nr, '#d8dcdf');
    for (const [a, b, l, r2] of [[-5, 7.6, 20, 0], [-5, -3.6, 20, 0], [5.2, 2, 11, Math.PI / 2], [-15.2, 2, 11, Math.PI / 2]]) { const [qx, qz] = at(a, b); box(nr, qx, gy, qz, l, 1.1, 0.06, ry + r2, { top: true }); }
  }
  yield;
  motelSign(B, F, 34, 21);
  for (let k = 0; k < 13; k++) {
    if (hash1(it.n, k) < 0.55) continue;
    const [px, pz] = at(-26.3 + k * 3.4, -7);
    car(B, px, B.groundY(px, pz), pz, ry + Math.PI, { kind: hash1(it.n, k, 1) < 0.3 ? 'wagon' : 'sedan', color: CAR_COLS[(k * 5 + 1) % CAR_COLS.length], fins: hash1(it.n, k, 2) < 0.5 });
  }
  { const [ix, iz] = at(16, -11); const nr = B.near(MAT.paint(B)); paint(nr, '#e8eef2'); box(nr, ix, y, iz, 1.4, 1.8, 0.9, ry); }
  { const [px, pz] = at(22, 0); fanPalm(B, px, B.groundY(px, pz), pz, 10, it.n * 3); }
  { const [px, pz] = at(-22, 9); fanPalm(B, px, B.groundY(px, pz), pz, 8, it.n * 5); }
}

function motelSign(B, F, lx, lz) {
  const [x, z] = F.at(lx, lz);
  const y = B.groundY(x, z);
  const ry = F.ry + 0.5;
  const c = Math.cos(ry), s = Math.sin(ry);
  const pa = B.acc(MAT.paint(B)), signs = B.acc(MAT.signs(B)), neon = B.acc(MAT.neon(B)), lights = B.acc(MAT.lights(B));
  paint(pa, '#2a9a98');
  for (const k of [-2.2, 2.2]) box(pa, x + c * k, y - 0.4, z - s * k, 0.5, 13.4, 0.5, ry);
  paint(pa, '#f2e7cf');
  box(pa, x, y + 7.9, z, 8.6, 4.4, 0.6, ry);
  panel(signs, x + s * 0.32, y + 8.0, z + c * 0.32, ry, 8.2, 4.1, uvOf(R.motelSign));
  panel(signs, x - s * 0.32, y + 8.0, z - c * 0.32, ry + Math.PI, 8.2, 4.1, uvOf(R.motelSign));
  paint(pa, '#1a1416');
  box(pa, x, y + 6.2, z, 4.2, 1.1, 0.3, ry);
  panel(signs, x + s * 0.16, y + 6.25, z + c * 0.16, ry, 4.0, 1.0, uvOf(R.vacancy));
  panel(signs, x - s * 0.16, y + 6.25, z - c * 0.16, ry + Math.PI, 4.0, 1.0, uvOf(R.vacancy));
  // the star on top: spikes of neon
  const sy = y + 13.6;
  paint(neon, '#ffe36a');
  for (let k = 0; k < 10; k++) {
    const a = (k / 10) * TAU, len = k % 2 ? 0.9 : 1.9;
    neon.beam(x, sy, z, x + c * Math.cos(a) * len, sy + Math.sin(a) * len, z - s * Math.cos(a) * len, 0.17, 0.17);
  }
  // the arrow: a shaft out to the side, down, a head pointing at the office; bulbs chasing along it
  const pts = [];
  for (let k = 0; k <= 8; k++) pts.push([x + c * (4.6 + k * 0.7), y + 9.6 - k * 0.15, z - s * (4.6 + k * 0.7)]);
  for (let k = 1; k <= 5; k++) pts.push([x + c * 10.2, y + 9.6 - 1.2 - k * 0.9, z - s * 10.2]);
  paint(pa, '#f15e8a');
  for (let k = 0; k < pts.length - 1; k++) pa.beam(pts[k][0], pts[k][1], pts[k][2], pts[k + 1][0], pts[k + 1][1], pts[k + 1][2], 0.55, 0.55);
  const tip = pts[pts.length - 1];
  tri2(pa, [tip[0] - c * 1.3, tip[1], tip[2] + s * 1.3], [tip[0] + c * 1.3, tip[1], tip[2] - s * 1.3], [tip[0], tip[1] - 2.0, tip[2]]);
  pts.forEach((p, k) => {
    for (const f of [1, -1]) {
      const k0 = lights.count;
      paint(lights, '#ffd27a');
      box(lights, p[0] + f * s * 0.3, p[1] - 0.1, p[2] + f * c * 0.3, 0.22, 0.22, 0.1, ry);
      animUV(lights, k0, k / pts.length, 1.4);
    }
  });
  paint(pa, '#5a5c60');
  pa.beam(x + c * 2.2, y + 9.6, z - s * 2.2, x + c * 4.6, y + 9.6, z - s * 4.6, 0.25, 0.25);
}

function waterTower(B, it) {
  const { x, z } = it;
  const y = B.groundY(x, z) - 0.3;
  const acc = B.acc(MAT.paint(B)), signs = B.acc(MAT.signs(B));
  paint(acc, '#6d7174');
  const legs = [[-4, -4], [4, -4], [4, 4], [-4, 4]];
  for (const [dx, dz] of legs) acc.beam(x + dx, y, z + dz, x + dx * 0.55, y + 20.5, z + dz * 0.55, 0.42, 0.42);
  for (const hh of [5, 10, 15]) {
    const k = 1 - (hh / 20.5) * 0.45, k2 = 1 - ((hh + 5) / 20.5) * 0.45;
    for (let e = 0; e < 4; e++) {
      const [ax, az] = legs[e], [bx, bz] = legs[(e + 1) % 4];
      acc.beam(x + ax * k, y + hh, z + az * k, x + bx * k, y + hh, z + bz * k, 0.16, 0.16);
      if (hh < 15) acc.beam(x + ax * k, y + hh, z + az * k, x + bx * k2, y + hh + 5, z + bz * k2, 0.1, 0.1);
    }
  }
  // the tank: a funnel underneath, a band wrapped with the town's name, a cone roof, a catwalk
  paint(acc, '#a8b2b6');
  cylinder(acc, x, y + 19.6, z, 2.4, 1.0, 12, { r2: 5.2 });
  const seg = 24, r = 5.25, y0 = y + 20.6, h = 6.4;
  const [u0, v0, u1, v1] = uvOf(R.towerBand);
  for (let j = 0; j < seg; j++) {
    const a0 = (j / seg) * TAU, a1 = ((j + 1) / seg) * TAU;
    const ua = u0 + (u1 - u0) * ((j / seg) * 2 % 1), ub = ua + (u1 - u0) * (2 / seg);
    signs.quadP([x + Math.cos(a1) * r, y0, z + Math.sin(a1) * r], [x + Math.cos(a0) * r, y0, z + Math.sin(a0) * r], [x + Math.cos(a0) * r, y0 + h, z + Math.sin(a0) * r], [x + Math.cos(a1) * r, y0 + h, z + Math.sin(a1) * r], [ub, v0, ua, v1]);
  }
  paint(acc, '#9aa4a8');
  cone(acc, x, y0 + h, z, 5.5, 2.6, 16);
  paint(acc, '#5a5e62');
  cylinder(acc, x, y0 - 0.3, z, 6.0, 0.12, 16, { top: true });
  for (let k = 0; k < 12; k++) { const a = (k / 12) * TAU; box(acc, x + Math.cos(a) * 5.95, y0 - 0.2, z + Math.sin(a) * 5.95, 0.06, 1.0, 0.06, 0); }
  acc.beam(x + 4.3, y, z + 4.3, x + 2.5, y + 20.5, z + 2.5, 0.08, 0.5);
  beacon(B, x, y0 + h + 2.7, z, 0.1);
}

function* junkyard(B, it, tick) {
  const F = frameOf(B, it);
  const { at, ry } = F;
  const hw = it.w / 2, hd = it.d / 2;
  lot(B, F, -hw, -hd, hw, hd, '#6e6050', 6);
  // the tin fence (a gate in the front middle)
  const tin = B.acc(MAT.tin(B));
  const fence = (ax, az, bx, bz) => {
    const L = Math.hypot(bx - ax, bz - az);
    const n = Math.max(1, Math.round(L / 4));
    for (let k = 0; k < n; k++) {
      const t0 = k / n, t1 = (k + 1) / n;
      const [x0, z0] = at(ax + (bx - ax) * t0, az + (bz - az) * t0), [x1, z1] = at(ax + (bx - ax) * t1, az + (bz - az) * t1);
      const y0 = B.groundY(x0, z0), y1 = B.groundY(x1, z1);
      paintMix(tin, '#b8b4ac', '#8a6a4a', hash1(it.n, k, Math.round(ax)));
      const h = 2.6 + hash1(it.n, k, 5) * 0.4;
      tin.quadP([x0, y0 - 0.3, z0], [x1, y1 - 0.3, z1], [x1, y1 + h, z1], [x0, y0 + h, z0], [0, 0, L / n / 4, 0.75]);
      tin.quadP([x1, y1 - 0.3, z1], [x0, y0 - 0.3, z0], [x0, y0 + h, z0], [x1, y1 + h, z1], [0, 0, L / n / 4, 0.75]);
    }
  };
  fence(-hw, -hd, hw, -hd);
  fence(-hw, -hd, -hw, hd);
  fence(hw, hd, hw, -hd);
  fence(-hw, hd, -6, hd);
  fence(6, hd, hw, hd);
  yield;
  // the sign over the gate
  {
    const pa = B.acc(MAT.paint(B));
    paint(pa, '#4a4a4c');
    for (const lx of [-6, 6]) { const [px, pz] = at(lx, hd); box(pa, px, B.groundY(px, pz) - 0.3, pz, 0.35, 6.4, 0.35, ry); }
    const [sx, sz] = at(0, hd + 0.05);
    const gy = B.groundY(sx, sz);
    panel(B.acc(MAT.signs(B)), sx, gy + 4.0, sz, ry, 11, 2.5, uvOf(R.junkSign));
    paint(pa, '#3a3a3c');
    const [qx, qz] = at(0, hd - 0.05);
    box(pa, qx, gy + 3.9, qz, 11.4, 2.7, 0.12, ry);
  }
  // the stacks
  for (const [lx, lz, w, d] of JUNK_STACKS) {
    const along = w > d;
    const n = Math.max(1, Math.round((along ? w : d) / 4.6));
    for (let k = 0; k < n; k++) {
      const t = (k + 0.5) / n - 0.5;
      const [px, pz] = at(lx + (along ? t * w : 0), lz + (along ? 0 : t * d));
      wreckStack(B, px, B.groundY(px, pz), pz, ry + (along ? Math.PI / 2 : 0), 2 + Math.floor(hash1(it.n, k, lx) * 2.6), it.n * 31 + k * 7 + lx, WRECK_COLS);
    }
    if (tick()) yield;
  }
  // loose wrecks, tyre piles, drums
  const nr = B.near(MAT.paint(B));
  for (let k = 0; k < 9; k++) {
    const lx = -hw + 8 + hash1(it.n, k, 1) * (it.w - 16), lz = -hd + 8 + hash1(it.n, k, 2) * (it.d - 16);
    if (JUNK_STACKS.some(([sx, sz, w, d]) => Math.abs(lx - sx) < w / 2 + 3 && Math.abs(lz - sz) < d / 2 + 3)) continue;
    if (Math.abs(lx) < 8 && lz > 10) continue;
    const [px, pz] = at(lx, lz);
    car(B, px, B.groundY(px, pz), pz, hash1(it.n, k, 3) * TAU, { kind: ['sedan', 'pickup', 'wagon', 'van', 'coupe'][k % 5], color: WRECK_COLS[k % WRECK_COLS.length], wreck: 0.7 + hash1(it.n, k, 4) * 0.3, rz: (hash1(it.n, k, 5) - 0.5) * 0.3, rx: (hash1(it.n, k, 6) - 0.5) * 0.15 });
  }
  for (let k = 0; k < 7; k++) { const [px, pz] = at(-hw + 4 + k * 2.2, hd - 4); tyres(nr, px, B.groundY(px, pz), pz, 2 + (k % 4)); }
  for (let k = 0; k < 6; k++) { const [px, pz] = at(hw - 5 - (k % 3) * 0.8, -hd + 4 + Math.floor(k / 3) * 0.8); drumBarrel(nr, px, B.groundY(px, pz), pz, ['#2f5a8a', '#8a2a20', '#3a6a3a'][k % 3]); }
  yield;
  // the crane: tracks, a cab, a lattice boom, a magnet holding a wreck up
  {
    const [cx, cz] = at(22, -18);
    const gy = B.groundY(cx, cz);
    const pa = B.acc(MAT.paint(B));
    paint(pa, '#2a2a2a');
    for (const k of [-1.6, 1.6]) { const [tx, tz] = at(22 + k, -18); box(pa, tx, gy, tz, 1.0, 1.0, 5.6, ry); }
    paint(pa, '#d8a030');
    box(pa, cx, gy + 1.0, cz, 4.0, 2.6, 4.4, ry);
    paint(pa, '#3a4048');
    const [wx, wz] = at(20.6, -16.2); box(pa, wx, gy + 2.2, wz, 1.2, 1.2, 1.4, ry);
    const a = 0.85, Lb = 22;
    const dirx = -F.c, dirz = F.s;
    const bx = cx + dirx * Math.cos(a) * Lb, bz = cz + dirz * Math.cos(a) * Lb, by = gy + 3 + Math.sin(a) * Lb;
    paint(pa, '#d8a030');
    for (const [i, j] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) pa.beam(cx + F.s * i * 0.6, gy + 3 + j * 0.6, cz + F.c * i * 0.6, bx + F.s * i * 0.3, by + j * 0.3, bz + F.c * i * 0.3, 0.1, 0.1);
    for (let k = 0; k < 10; k++) { const t = k / 10, t2 = (k + 1) / 10; pa.beam(cx + (bx - cx) * t + F.s * 0.5, gy + 3 + (by - gy - 3) * t, cz + (bz - cz) * t + F.c * 0.5, cx + (bx - cx) * t2 - F.s * 0.5, gy + 3 + (by - gy - 3) * t2, cz + (bz - cz) * t2 - F.c * 0.5, 0.07, 0.07); }
    paint(pa, '#2a2a2a');
    pa.beam(bx, by, bz, bx, gy + 7, bz, 0.05, 0.05);
    cylinder(pa, bx, gy + 5.6, bz, 1.0, 1.4, 10, { top: true, bottom: true });
    car(B, bx, gy + 2.6, bz, ry + 0.4, { kind: 'sedan', color: '#7a3a2a', wreck: 1, crushed: true, near: false });
  }
  // the office trailer (a lit window), the dog's house, floodlight poles
  {
    const [ox, oz] = at(-20, -22);
    const gy = B.groundY(ox, oz);
    const tn = B.acc(MAT.tin(B));
    paint(tn, '#d8d4c8');
    box(tn, ox, gy, oz, 10, 2.8, 3.2, ry, { u: 4 });
    const pa = B.acc(MAT.paint(B));
    paint(pa, '#3a3a3c');
    box(pa, ox, gy + 2.8, oz, 10.4, 0.2, 3.6, ry);
    const [wx, wz] = at(-22, -22 + 1.62);
    panel(B.acc(MAT.signs(B)), wx, gy + 1.0, wz, ry, 2.2, 1.1, uvOf(R.shackWin));
    const [dx, dz] = at(-12, -20);
    paint(pa, '#8a5a3a'); box(pa, dx, gy, dz, 1.2, 0.9, 1.4, ry);
    paint(pa, '#5a3a24'); gable(pa, dx, gy + 0.9, dz, 1.2, 1.4, 0.5, ry, { over: 0.1 });
  }
  for (const [lx, lz] of [[-30, 26], [30, -26]]) {
    const [px, pz] = at(lx, lz);
    const gy = B.groundY(px, pz);
    lampPost(B, px, gy, pz, px, gy + 9, pz, { wood: true, color: '#ffb060' });
  }
}

/** The roadside rock shop: a curio shack, a big green concrete dinosaur, painted rocks. */
function rockShop(B, it) {
  const F = frameOf(B, it);
  const { at, ry, c, s } = F;
  lot(B, F, -it.w / 2, -it.d / 2, it.w / 2, it.d / 2, '#9a8a70', 5);
  const wood = B.acc(MAT.wood(B)), pa = B.acc(MAT.paint(B));
  // the shack: plank walls, a tin roof, a hand-painted sign board on the eave
  const [sx, sz] = at(-8, -6);
  const g = B.footY(sx, sz, 12, 7, ry);
  paint(wood, '#c8a878');
  box(wood, sx, g.lo - 0.3, sz, 12, g.hi - g.lo + 3.4, 7, ry, { u: 2, v: 4 });
  const tin = B.acc(MAT.tin(B));
  paint(tin, '#a89c8a');
  gable(tin, sx, g.hi + 3.1, sz, 12.6, 7.6, 1.4, ry, { over: 0.4, u: 4 });
  paint(pa, '#e8c63a');
  const [bx, bz] = at(-8, -6 + 3.62);
  box(pa, bx, g.hi + 2.2, bz, 10, 1.1, 0.12, ry);
  // the dinosaur: a chunky green brontosaurus of tubes
  const [dx, dz] = at(11, -2);
  const dy = B.groundY(dx, dz);
  const pl = B.acc(MAT.plant(B));
  const P = (lx, ly, lz) => [dx + lx * c + lz * s, dy + ly, dz - lx * s + lz * c];
  paint(pl, '#5a8a5a');
  tube(pl, [P(-4.0, 4.2, 0), P(-1.6, 4.9, 0), P(1.4, 4.8, 0), P(3.8, 4.0, 0)], [1.3, 2.1, 2.0, 1.2], 10, false);
  for (const [lx, lz] of [[-2.4, -1.1], [-2.4, 1.1], [2.2, -1.1], [2.2, 1.1]]) { const q = P(lx, 0, lz); cylinder(pl, q[0], dy - 0.3, q[2], 0.7, 3.4, 8, { r2: 0.62 }); }
  tube(pl, [P(-3.6, 5.0, 0), P(-5.4, 7.0, 0), P(-6.4, 9.4, 0), P(-6.9, 10.9, 0)], [1.0, 0.75, 0.58, 0.52], 8, false);
  tube(pl, [P(-6.8, 10.9, 0), P(-7.9, 11.2, 0), P(-8.6, 11.0, 0)], [0.6, 0.55, 0.4], 8, true);
  tube(pl, [P(3.6, 4.4, 0), P(6.2, 3.4, 0.6), P(8.6, 1.9, 1.6), P(10.2, 0.7, 2.6)], [1.1, 0.8, 0.45, 0.12], 7, false);
  paint(pl, '#e8e4da');
  for (const sg of [-1, 1]) { const q = P(-8.0, 11.35, sg * 0.42); box(pl, q[0], q[1], q[2], 0.16, 0.16, 0.16, ry); }
  // painted rocks for sale on tables, string lights to a pole, a hand-made sign
  const nr = B.near(MAT.paint(B));
  for (let k = 0; k < 3; k++) {
    const [tx, tz] = at(-14 + k * 4, 2);
    picnic(nr, tx, B.groundY(tx, tz), tz, ry);
    for (let q = 0; q < 5; q++) { const [rx2, rz2] = at(-14.6 + k * 4 + q * 0.3, 2); paint(nr, ['#c8322a', '#2a6ac8', '#e8c22a', '#3a9a4a', '#9a5ad0'][q]); box(nr, rx2, B.groundY(rx2, rz2) + 0.8, rz2, 0.22, 0.18, 0.22, ry); }
  }
  const [p1x, p1z] = at(-2, -2.5), [p2x, p2z] = at(4, 8);
  const gyy = B.groundY(p2x, p2z);
  paint(pa, '#5e4c3c'); cylinder(pa, p2x, gyy - 0.3, p2z, 0.1, 4.5, 6);
  stringLights(B, [p1x, g.hi + 3.0, p1z], [p2x, gyy + 4.0, p2z], 0.5, 0.9, ['#ff5a5a', '#ffd25a', '#5affa0', '#5ab4ff']);
  const [gx, gz] = at(0, it.d / 2 - 1);
  const ga = B.near(MAT.wood(B));
  paint(ga, '#d8c8a0');
  box(ga, gx, B.groundY(gx, gz) + 1.2, gz, 5, 1.6, 0.12, ry, { u: 2, v: 4 });
  paint(pa, '#5e4c3c');
  for (const k of [-2, 2]) { const [qx, qz] = at(k, it.d / 2 - 1.1); box(pa, qx, B.groundY(qx, qz) - 0.3, qz, 0.14, 2.9, 0.14, ry); }
}

// ================================================================== building: the High Desert

function dish(B, it) {
  const { x, z } = it;
  const y = B.groundY(x, z);
  const acc = B.acc(MAT.paint(B));
  paint(acc, '#cfcfca');
  cylinder(acc, x, y - 0.5, z, 3.4, 1.3, 10, { top: true });
  paint(acc, '#e8e8e4');
  cylinder(acc, x, y + 0.8, z, 1.8, 10.2, 8, { r2: 1.3, top: true });
  // the dish: a shallow bowl tilted at the sky (every dish looks the same way)
  const az = 2.4, el = 0.95;
  const nx = Math.cos(el) * Math.sin(az), ny = Math.sin(el), nz = Math.cos(el) * Math.cos(az);
  const ux = Math.cos(az), uz = -Math.sin(az);
  const vx = ny * Math.sin(az), vy = -Math.cos(el), vz = ny * Math.cos(az);
  const cx = x, cy = y + 13.5, cz = z;
  paint(acc, '#4a4c50');
  box(acc, x, y + 11, z, 3.6, 2.6, 2.4, az);
  const rings = 4, seg = 16, Rr = 10.5, depth = 2.6;
  const P = (r, a) => {
    const d = depth * (r / Rr) ** 2;
    const lx = Math.cos(a) * r, ly = Math.sin(a) * r;
    return [cx + ux * lx + vx * ly + nx * d, cy + vy * ly + ny * d, cz + uz * lx + vz * ly + nz * d];
  };
  for (let i = 0; i < rings; i++) {
    const r0 = (i / rings) * Rr, r1 = ((i + 1) / rings) * Rr;
    for (let k = 0; k < seg; k++) {
      const a0 = (k / seg) * TAU, a1 = ((k + 1) / seg) * TAU;
      paint(acc, '#f2f2ee', 0.95 + 0.05 * ((i + k) % 2));
      acc.quadP(P(r0, a0), P(r1, a0), P(r1, a1), P(r0, a1));
      paint(acc, '#c8c8c4');
      acc.quadP(P(r0, a1), P(r1, a1), P(r1, a0), P(r0, a0));
    }
  }
  const fx = cx + nx * 8, fy = cy + ny * 8, fz = cz + nz * 8;
  paint(acc, '#d8d8d4');
  for (let k = 0; k < 3; k++) { const p = P(Rr * 0.92, (k / 3) * TAU + 0.5); acc.beam(p[0], p[1], p[2], fx, fy, fz, 0.16, 0.16); }
  box(acc, fx, fy - 0.6, fz, 1.2, 1.2, 1.2, az);
  beacon(B, fx, fy + 0.8, fz, (it.k * 0.17) % 1, 0.3);
}

function* arrayBase(B, it) {
  const F = frameOf(B, it);
  const { at, ry } = F;
  lot(B, F, -it.w / 2, -it.d / 2, it.w / 2, it.d / 2, '#9a958c');
  const acc = B.acc(MAT.paint(B)), signs = B.acc(MAT.signs(B));
  const [bx, bz] = at(-6, -6);
  const g = B.footY(bx, bz, 22, 12, ry);
  paint(acc, '#e4e6e6');
  box(acc, bx, g.lo - 0.5, bz, 22, g.hi - g.lo + 6.5, 12, ry);
  for (let k = 0; k < 5; k++) { const [px, pz] = at(-6 - 8 + k * 4, -6 + 6.02); panel(signs, px, g.hi + 2.6, pz, ry, 3.6, 1.8, uvOf(R.ctrlWin)); }
  paint(acc, '#8a8e92');
  for (const lx of [-12, -2]) { const [px, pz] = at(lx, -8); box(acc, px, g.hi + 6, pz, 2.6, 1.4, 2.6, ry); }
  paint(acc, '#f0f0ec');
  { const [px, pz] = at(2, -4); cylinder(acc, px, g.hi + 6, pz, 0.2, 1.8, 6); cone(acc, px, g.hi + 7.8, pz, 1.6, 0.4, 10); }
  yield;
  // the mast: red and white lattice, blinking at two heights
  {
    const [mx, mz] = at(14, -10);
    const gy = B.groundY(mx, mz);
    const m = B.acc(MAT.paint(B));
    for (let k = 0; k < 6; k++) {
      paint(m, k % 2 ? '#e8e4da' : '#c84a3a');
      mast(m, mx, gy + k * 10, mz, 10, 2.6 - k * 0.3, (2.3 - k * 0.3) / (2.6 - k * 0.3));
    }
    beacon(B, mx, gy + 60.2, mz, 0, 0.5);
    beacon(B, mx, gy + 30, mz, 0, 0.4);
  }
  // the fence round the compound, the sign by the road
  const pos = [];
  const fa = B.near(MAT.paint(B));
  const corners = [[-it.w / 2, -it.d / 2], [it.w / 2, -it.d / 2], [it.w / 2, it.d / 2 - 2], [6, it.d / 2 - 2]].map(([a, b]) => at(a, b));
  paint(fa, '#9a9c9e');
  for (let i = 0; i < corners.length - 1; i++) {
    const [ax, az] = corners[i], [bx2, bz2] = corners[i + 1];
    const n = Math.max(1, Math.round(Math.hypot(bx2 - ax, bz2 - az) / 3));
    for (let k = 0; k <= n; k++) {
      const px = ax + (bx2 - ax) * k / n, pz = az + (bz2 - az) * k / n, py = B.groundY(px, pz);
      box(fa, px, py - 0.2, pz, 0.07, 2.4, 0.07, 0);
      if (k) { const qx = ax + (bx2 - ax) * (k - 1) / n, qz = az + (bz2 - az) * (k - 1) / n, qy = B.groundY(qx, qz); for (const h of [0.4, 1.2, 2.0, 2.2]) pos.push(qx, qy + h, qz, px, py + h, pz); }
    }
  }
  B.group.add(lineMesh(pos, MAT.wire(B)));
  const [sx, sz] = at(-14, it.d / 2 - 1);
  roadSign(B, sx, B.groundY(sx, sz), sz, ry, 'array', {});
}

function* silo(B, it) {
  const F = frameOf(B, it);
  const { at, ry } = F;
  lot(B, F, -it.w / 2, -it.d / 2, it.w / 2, it.d / 2, '#8e8a80', 5);
  const acc = B.acc(MAT.paint(B)), signs = B.acc(MAT.signs(B)), hole = B.acc(MAT.hole(B));
  // the launcher: a raised collar round the hole, the blast door slid aside on its rails
  const [cx, cz] = at(0, -4);
  const gy = B.groundY(cx, cz);
  paint(acc, '#a8a49a');
  cylinder(acc, cx, gy - 0.4, cz, 6.4, 1.4, 16, { top: false });
  for (let k = 0; k < 16; k++) {
    const a0 = (k / 16) * TAU, a1 = ((k + 1) / 16) * TAU;
    acc.quadP([cx + Math.cos(a1) * 6.4, gy + 1.0, cz + Math.sin(a1) * 6.4], [cx + Math.cos(a0) * 6.4, gy + 1.0, cz + Math.sin(a0) * 6.4], [cx + Math.cos(a0) * 4.2, gy + 1.0, cz + Math.sin(a0) * 4.2], [cx + Math.cos(a1) * 4.2, gy + 1.0, cz + Math.sin(a1) * 4.2]);
  }
  disc(hole, cx, gy + 0.9, cz, 4.25, 16, true);
  const glow = B.acc(MAT.glass(B));
  paint(glow, '#1a6a2a');
  disc(glow, cx, gy + 0.95, cz, 1.6, 12, true);
  paint(acc, '#5a5a56');
  for (const lz of [-3.2, 3.2]) { const [rx, rz] = at(5, -4 + lz); box(acc, rx, gy + 0.9, rz, 22, 0.3, 0.5, ry); }
  const [dx, dz] = at(9.5, -4);
  paint(acc, '#9a968c');
  box(acc, dx, gy + 1.2, dz, 10, 1.4, 9, ry);
  flat(signs, dx, gy + 2.62, dz, 9.6, 8.6, ry + Math.PI / 2, uvOf(R.silo));
  yield;
  // vents, an antenna mast, the guard shack (a lamp still on), a rusted truck
  for (const [lx, lz] of [[-12, 4], [-9, 8], [12, 10]]) {
    const [px, pz] = at(lx, lz);
    paint(acc, '#8a8678'); cylinder(acc, px, B.groundY(px, pz), pz, 0.7, 2.2, 8, { top: true });
    paint(acc, '#5a5a56'); box(acc, px, B.groundY(px, pz) + 2.2, pz, 1.8, 0.2, 1.8, ry);
  }
  { const [px, pz] = at(-16, -16); const m = B.acc(MAT.paint(B)); paint(m, '#7a7a76'); mast(m, px, B.groundY(px, pz), pz, 16, 1.6, 0.4); }
  {
    const [sx, sz] = at(16, 14);
    const g = B.groundY(sx, sz);
    paint(acc, '#b8b4a4'); box(acc, sx, g - 0.3, sz, 5, 3.1, 4, ry);
    paint(acc, '#6a6a60'); box(acc, sx, g + 2.8, sz, 5.6, 0.25, 4.6, ry);
    const [wx, wz] = at(16, 16.02); panel(signs, wx, g + 1.1, wz, ry, 1.6, 0.8, uvOf(R.shackWin));
  }
  { const [tx, tz] = at(10, -18); car(B, tx, B.groundY(tx, tz), tz, ry + 0.3, { kind: 'pickup', color: '#5a6a3a', wreck: 0.8, rz: 0.08 }); }
  // the fence: concrete posts, chain link as wires, a stretch flattened, the gate gone
  const pos = [];
  const fa = B.near(MAT.paint(B));
  paint(fa, '#a8a49a');
  const hw = it.w / 2 - 1, hd = it.d / 2 - 1;
  const run = [[-hw, -hd], [hw, -hd], [hw, hd], [-hw, hd], [-hw, -hd]];
  for (let i = 0; i < run.length - 1; i++) {
    const [ax, az] = run[i], [bx, bz] = run[i + 1];
    const n = Math.max(1, Math.round(Math.hypot(bx - ax, bz - az) / 3.5));
    for (let k = 0; k <= n; k++) {
      if (i === 2 && k > 5 && k < n - 6) continue;
      const lx = ax + (bx - ax) * k / n, lz = az + (bz - az) * k / n;
      const fallen = i === 1 && k > n * 0.4 && k < n * 0.75;
      const [px, pz] = at(lx, lz), py = B.groundY(px, pz);
      if (fallen) obox(fa, px, py + 0.1, pz, 0.14, 2.6, 0.14, ry + Math.PI / 2, 1.45, 0);
      else box(fa, px, py - 0.2, pz, 0.14, 2.8, 0.14, ry);
      if (k && !fallen && !(i === 2 && k === n - 6)) {
        const [qx, qz] = at(ax + (bx - ax) * (k - 1) / n, az + (bz - az) * (k - 1) / n), qy = B.groundY(qx, qz);
        for (const h of [0.3, 0.9, 1.5, 2.1, 2.5, 2.7]) pos.push(qx, qy + h, qz, px, py + h, pz);
      }
    }
  }
  B.group.add(lineMesh(pos, MAT.wire(B)));
  for (const [lx, sc] of [[-9, 1], [9, 0.8]]) { const [gx, gz] = at(lx, hd + 0.5); roadSign(B, gx, B.groundY(gx, gz), gz, ry, 'restricted', { scale: sc }); }
}

function crashSite(B, it) {
  const { x, z } = it;
  const y = B.groundY(x, z);
  const la = B.acc(lotMat(B));
  paint(la, '#3a2e24');
  drape(la, B, Array.from({ length: 14 }, (_, k) => { const a = (k / 14) * TAU; const r = 11 + hash1(it.n, k) * 3; return [x + Math.cos(a) * r, z + Math.sin(a) * r]; }), { lift: 0.05, step: 4, uv: 6 });
  const rk = B.acc(MAT.rock(B));
  for (let k = 0; k < 16; k++) {
    const a = (k / 16) * TAU + hash1(it.n, k, 1) * 0.3, r = 12 + hash1(it.n, k, 2) * 4;
    boulder(rk, x + Math.cos(a) * r, y - 0.3, z + Math.sin(a) * r, 0.6 + hash1(it.n, k, 3) * 1.2, it.n * 9 + k, '#6a5a4a');
  }
  // the satellite: a gold-foil body nose-down, solar wings broken and bent
  const acc = B.acc(MAT.metal(B));
  paint(acc, '#c8a040');
  obox(acc, x, y - 1.2, z, 3.2, 4.4, 2.6, it.ry, 0.6, 0.3);
  paint(acc, '#d8d8d4');
  hcyl(acc, x + 1.2, y + 2.6, z - 0.6, 0.9, 2.2, it.ry, 10, true);
  const pa = B.acc(MAT.paint(B));
  for (const [ox, oz, rx, rz] of [[5, 2, 0.3, 0.9], [-5.5, -1.5, -0.6, -0.4]]) {
    paint(pa, '#1a2a5a');
    obox(pa, x + ox, y + 0.2, z + oz, 7, 0.08, 3, it.ry + 0.2, rx, rz);
    paint(pa, '#c8ccd0');
    obox(pa, x + ox * 0.6, y + 0.4, z + oz * 0.6, 3.5, 0.15, 0.15, it.ry + 0.2, rx * 0.5, rz * 0.5);
  }
  for (let k = 0; k < 10; k++) {
    const r = 6 + hash1(it.n, k, 4) * 30, a = it.ry + (hash1(it.n, k, 5) - 0.5) * 0.8;
    const px = x + Math.cos(a) * r, pz = z + Math.sin(a) * r;
    paint(pa, k % 3 ? '#c8a040' : '#8a8e92');
    obox(pa, px, B.groundY(px, pz) - 0.1, pz, 0.6 + hash1(it.n, k, 6), 0.15, 0.4 + hash1(it.n, k, 7), a, (hash1(it.n, k, 8) - 0.5), 0.2);
  }
  const n = B.acc(MAT.lights(B));
  const k0 = n.count;
  paint(n, '#ff7a20');
  box(n, x - 0.4, y + 0.3, z + 0.4, 0.8, 0.5, 0.8, it.ry);
  animUV(n, k0, 0.5, -6);
}
