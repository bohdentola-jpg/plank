// PORT HALCYON — GHOST TOWN. A dead silver-mining town on a dirt loop: MAIN ST
// lined with false-front wooden buildings gone grey in the sun (THE LAST
// CHANCE saloon, the general store, the Grand Hotel, sheriff, bank, assay
// office, barber, undertaker, a livery barn, a blacksmith's shed, a caved-in
// ruin), raised boardwalks under sagging porch roofs, hitching rails, water
// troughs, wagon wheels. A church with a bell tower at the end of the street,
// Boot Hill's crosses behind it, a windmill that still turns, a dead
// telegraph line leaning into town. Up the Mine Hill Rd, the SILVER QUEEN's
// headframe stands over the town. Tumbleweeds roll down Main St. At night it
// is dark: one lamp outside the saloon flickers, a candle burns in one
// window, the church glows faintly cold.
import * as THREE from 'three';
import { box, cylinder, cone, gable, hip, drape } from './builder.js';
import { MAT, smat, paint, paintMix, obox, panel, flat, tube, hcyl, disc, blob, clock, lineMesh, hash1, TAU } from './desertkit/kit.js';
import { uvOf, RG, RS } from './desertkit/tex.js';
import { pole, poleTops, wires, roadSign, drumBarrel, crate, tumbleRun } from './desertkit/props.js';
import { boulder } from './desertkit/rocks.js';
import { tumbleShape } from './desertkit/flora.js';
import { cellGround, seedOf, buildScatter, shrubs } from './desertkit/scatter.js';
import { site, local, setPiece, lampAt, poleLine } from './desertkit/place.js';
import { glowTexture } from '../../track/textures.js';
import { Acc } from '../build/geo.js';
import { U } from '../kit.js';

const WOODS = ['#9a9286', '#a89a88', '#8a7e70', '#b0a494', '#9a8470', '#a08a78', '#8e8a84'];
const PAINTED = ['#b8a890', '#a08068', '#8a9088', '#b09a80', '#9a6a58'];
const BOARD = 2.6;          // boardwalk depth in front of each building

// the one lamp that still works (badly): its glass and the light it throws flicker together
const flickerMat = (B) => smat(B, 'gt-flicker', () => { const m = new THREE.MeshBasicMaterial({ color: 0xffc070 }); m.userData.castShadow = false; return m; });
const poolMat = (B) => smat(B, 'gt-pool', () => {
  const m = new THREE.MeshBasicMaterial({ map: glowTexture(), color: 0xffa050, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.6, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 });
  m.userData.castShadow = false;
  return m;
});
const haloMat = (B) => smat(B, 'gt-halo', () => new THREE.SpriteMaterial({ map: glowTexture(), color: 0xffb060, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.8 }));

export default {
  id: 'ghosttown',

  plan(P) {
    const main = P.net.byId.get('gt_main');
    if (main) mainStreet(P, main);
    church(P);
    bootHill(P);
    windmill(P);
    outskirts(P);
    headframe(P);
    telegraph(P);
    if (main) P.add({ type: 'tumble', x: main.X[Math.floor(main.N / 2)], z: main.Z[Math.floor(main.N / 2)], road: 'gt_main' });
  },

  scatter(S) {
    const G = cellGround(S);
    const nz = (x, z, f) => 0.5 + 0.5 * S.noise(x / f, z / f);
    // dead trees and the odd saguaro; creosote and dry grass; rocks
    for (const [x, z] of S.points(44, { r: 3, density: () => 0.5 })) {
      if (G.slope(x, z).g > 0.4) continue;
      const y = G.h(x, z), s = S.range(0.7, 1.2);
      const kind = S.rng() < 0.55 ? 'dead' : 'saguaro';
      S.add({ type: 'plant', kind, x, z, y, s, seed: seedOf(S) });
      S.collider({ kind: 'circle', x, z, r: 0.4, y0: y - 1, y1: y + 6 });
    }
    shrubs(S, 9, (x, z) => 0.3 + 0.45 * nz(x, z, 60), [[0, 40], [2, 40], [1, 20]], { maxSlope: 0.6, tint: '#e8dcc8' });
    for (const [x, z] of S.points(30, { r: 2 })) {
      if (S.rng() > 0.4) continue;
      const y = G.h(x, z), s = S.range(0.4, 1.6);
      S.add({ type: 'rock', x, z, y, s, seed: seedOf(S), color: S.pick(['#8a7a68', '#9a8a74', '#7a6a58']) });
      if (s > 1.1) S.collider({ kind: 'circle', x, z, r: s * 0.9, y0: y - 1, y1: y + s * 1.2 });
    }
    // junk of a dead town: wheels, bottles, timbers lying about
    for (const [x, z] of S.points(36, { r: 2, density: () => 0.35 })) {
      S.add({ type: 'junk', x, z, y: G.h(x, z), ry: S.rng() * TAU, k: Math.floor(S.rng() * 3), seed: seedOf(S) });
    }
  },

  warm(B) {
    for (const k of ['paint', 'metal', 'rock', 'strata', 'plant', 'foliage', 'wood', 'ghost', 'tin', 'roadsigns', 'glass', 'lights', 'wire', 'tumble', 'hole', 'lot']) MAT[k](B);
    flickerMat(B); poolMat(B); haloMat(B);
  },

  *build(B, items) {
    yield;   // the cell's scatter was made in this same slice: start on a fresh one
    const tick = clock(3);
    const wire = [];
    for (const it of items) {
      if (buildScatter(B, it)) { if (tick()) yield; continue; }
      switch (it.type) {
        case 'bld': building(B, it); break;
        case 'church': buildChurch(B, it); break;
        case 'graves': buildBootHill(B, it); break;
        case 'windmill': buildWindmill(B, it); break;
        case 'headframe': yield* buildHeadframe(B, it); break;
        case 'lamp': flickerLamp(B, it); break;
        case 'tumble': tumbleweeds(B, it); break;
        case 'wagon': wagon(B, it); break;
        case 'junk': junk(B, it); break;
        case 'corral': corral(B, it, wire); break;
        case 'sign': roadSign(B, it.x, B.groundY(it.x, it.z), it.z, it.ry, it.kind, it.o || {}); break;
        case 'pole': {
          const tops = pole(B, it.x, it.y, it.z, it.ry, it.h, it.lean, true);
          if (it.next && !it.broken) wires(wire, tops, poleTops(it.next.x, it.next.y, it.next.z, it.next.ry, it.next.h, it.next.lean), 0.05);
          break;
        }
        default: break;
      }
      if (tick()) yield;
    }
    if (wire.length) B.group.add(lineMesh(wire, MAT.wire(B)));
  },
};

// ================================================================== planning

const KINDS = ['store', 'hotel', 'sheriff', 'bank', 'assay', 'barber', 'undertaker', 'post', 'smith', 'livery', 'false', 'false', 'ruin', 'shack', 'false', 'ruin'];

function mainStreet(P, r) {
  // the saloon first: south side, near x 3900
  let sBest = 0, bd = Infinity;
  for (let i = 0; i < r.N; i++) { const d = Math.abs(r.X[i] - 3900); if (d < bd) { bd = d; sBest = r.S[i]; } }
  const sal = site(r, sBest, -1, 17, 16, BOARD);
  addBuilding(P, sal, 'saloon', 0);
  // the rest of the street: lots both sides, shoulder to shoulder with gaps
  const lots = P.lots({ roads: (q) => q === r, width: [8, 13], depth: [12, 17], gap: [0, 5], setback: [BOARD, BOARD], ends: 14, pad: -0.6 });
  let k = 0;
  for (const L of lots) {
    const kind = KINDS[(k++ + Math.floor(P.rng() * 3)) % KINDS.length];
    addBuilding(P, L, kind, k);
  }
  // the flickering lamp outside the saloon, on the boardwalk's corner
  const [lx, lz] = local(sal, sal.w / 2 + 0.6, sal.d / 2 + BOARD - 0.3);
  const y = P.groundY(lx, lz);
  P.add({ type: 'lamp', x: lx, z: lz, y });
  P.lamp({ x: lx, z: lz, hx: lx, hz: lz, hy: y + 3.6, color: '#ffa860', radius: 10, intensity: 0.45, halo: 0 });
  P.collider({ kind: 'circle', x: lx, z: lz, r: 0.2, y0: y - 1, y1: y + 4 });
  P.landmark({ id: 'last_chance', name: 'LAST CHANCE SALOON', x: sal.x, z: sal.z, r: 25, kind: 'saloon' });
  // the town sign at the way in
  const gin = P.net.byId.get('gt_in');
  if (gin) {
    const p = gin.posAt(gin.length * 0.4, 7);
    if (P.isFree(p.x, p.z, 2, 2, 0, { anywhere: true })) { P.add({ type: 'sign', x: p.x, z: p.z, ry: Math.atan2(-gin.TX[p.i], -gin.TZ[p.i]), kind: 'ghost', o: { wood: true, scale: 0.9 } }); P.claim(p.x, p.z, 2, 2, 0); }
  }
}

/** A building on a lot (+z to the street), its boardwalk in front, colliders, far shape. */
function addBuilding(P, L, kind, k) {
  const { x, z, w, d, ry } = L;
  if (!P.isFree(x, z, w, d, ry, { anywhere: true, pad: -0.6 }) && kind === 'saloon') return;
  const g = P.groundRange(x, z, w, d, ry);
  const floors = kind === 'saloon' || kind === 'hotel' ? 2 : 1;
  const h = floors === 2 ? 7.8 : kind === 'livery' ? 7 : kind === 'shack' ? 3.2 : 4.4;
  const it = P.add({ type: 'bld', kind, x, z, w, d, ry, h, floors, tone: WOODS[Math.floor(P.rng() * WOODS.length)], paint: P.rng() < 0.4 ? PAINTED[Math.floor(P.rng() * PAINTED.length)] : null, seed: Math.floor(P.rng() * 1e6), walk: kind !== 'livery' && kind !== 'shack', y0: g.lo, map: 'building' });
  P.claim(x, z, w, d, ry);
  const [fx, fz] = local(L, 0, d / 2 + BOARD / 2);
  if (it.walk) {
    P.claim(fx, fz, w, BOARD, ry);
    P.collider({ kind: 'box', x: fx, z: fz, hx: w / 2, hz: BOARD / 2, ry, y0: g.lo - 1, y1: g.lo + 0.5 });
  }
  if (kind !== 'ruin') P.collider({ kind: 'box', x, z, hx: w / 2, hz: d / 2, ry, y0: g.lo - 2, y1: g.hi + h + 2 });
  else P.collider({ kind: 'box', x, z, hx: w / 2, hz: d / 2, ry, y0: g.lo - 2, y1: g.hi + 2.5 });
  P.far({ shape: 'box', x, z, y: g.lo - 1, w, d, h: h + 2.4 + (g.hi - g.lo), ry, color: it.paint || it.tone, lit: kind === 'saloon' ? 0.06 : 0 });
  void k;
}

/** The church at the street's east end, its bell tower over the town. */
function church(P) {
  const r = P.net.byId.get('gt_l2');
  if (!r) return;
  for (const [s, side] of [[90, 1], [120, 1], [90, -1], [150, 1]]) {
    const st = site(r, s, side, 14, 22, 6);
    if (!P.isFree(st.x, st.z, st.w + 4, st.d + 4, st.ry, { anywhere: true })) continue;
    const y = setPiece(P, { type: 'church', ...st, map: 'building' }, [{ x: 0, z: 0, w: 14, d: 22, h: 9 }, { x: 0, z: 9, w: 6, d: 6, h: 20 }],
      [{ shape: 'box', x: 0, z: -1, w: 12, d: 20, h: 9, color: '#c8c0b0' }, { shape: 'box', x: 0, z: 9, w: 5, d: 5, h: 17, color: '#c8c0b0', lit: 0.05 }, { shape: 'cone', x: 0, z: 9, r: 3.6, h: 7, dy: 17, color: '#5a4a3a' }]);
    lampAt(P, st, y, 0, 11.5, 2.2, '#80b8c8', 7, 0.35, 0);
    P.church = st;
    return;
  }
}

/** Boot Hill: a fenced plot of crosses and stones on a rise inside the loop. */
function bootHill(P) {
  // inside the loop, behind the church, on the town's quiet side
  for (const [x, z, ry] of [[4040, 1240, 0.3], [4000, 1290, 0.3], [3960, 1330, 0.2], [4060, 1330, 0.4], [3920, 1270, 0.1]]) {
    if (!P.inside(x, z, 10) || !P.isFree(x, z, 30, 24, ry, { roadPad: true })) continue;
    P.claim(x, z, 30, 24, ry);
    P.add({ type: 'graves', x, z, ry, w: 30, d: 24, map: 'park' });
    return;
  }
}

function windmill(P) {
  for (const [x, z] of [[3820, 1190], [3860, 1230], [3780, 1250], [3900, 1260]]) {
    if (!P.isFree(x, z, 12, 12, 0, { roadPad: true })) continue;
    const y = P.groundY(x, z);
    P.claim(x, z, 12, 12, 0);
    P.add({ type: 'windmill', x, z, ry: 0.5, map: 'building' });
    P.collider({ kind: 'box', x, z, hx: 2.4, hz: 2.4, ry: 0.5, y0: y - 1, y1: y + 14 });
    P.collider({ kind: 'circle', x: x + 4.5, z: z + 2, r: 2.4, y0: y - 1, y1: y + 3 });
    P.far({ shape: 'box', x, z, y, w: 2.6, d: 2.6, h: 13, ry: 0.5, color: '#6a5a48' });
    // a corral beside it
    if (P.isFree(x - 22, z + 6, 22, 18, 0.5, { roadPad: true })) { P.claim(x - 22, z + 6, 22, 18, 0.5); P.add({ type: 'corral', x: x - 22, z: z + 6, ry: 0.5, w: 22, d: 18 }); }
    return;
  }
}

/** Shacks, cabins and the odd wagon along the loop roads round the town. */
function outskirts(P) {
  for (const id of ['gt_l2', 'gt_l3', 'gt_l4', 'gt_in']) {
    const r = P.net.byId.get(id);
    if (!r) continue;
    const lots = P.lots({ roads: (q) => q === r, width: [6, 9], depth: [6, 9], gap: [25, 70], setback: [4, 10], ends: 20, chance: 0.6, roadPad: true });
    for (const L of lots) addBuilding(P, L, P.rng() < 0.3 ? 'ruin' : 'shack', 0);
  }
  // wagons: a broken one on Main St, one by the livery, a stagecoach left by the church
  for (const [x, z, ry, kind] of [[3790, 1075, 0.4, 'buckboard'], [4010, 1035, 2.2, 'buckboard'], [4060, 1110, 1.2, 'stage'], [3720, 1180, 0.8, 'broken']]) {
    if (!P.isFree(x, z, 6, 3, ry, { roadPad: true })) continue;
    const y = P.groundY(x, z);
    P.claim(x, z, 6, 3, ry);
    P.add({ type: 'wagon', x, z, ry, kind });
    P.collider({ kind: 'box', x, z, hx: 2.6, hz: 1.1, ry: ry + Math.PI / 2, y0: y - 1, y1: y + 2.4 });
  }
}

/** The SILVER QUEEN's headframe on the mine hill east of town (at the Mine Hill Rd's top). */
function headframe(P) {
  const r = P.net.byId.get('hf_road');
  if (!r) return;
  const end = r.posAt(r.length - 1);
  const i = end.i;
  const fx = r.TX[i], fz = r.TZ[i];
  const x = end.x + fx * 16, z = end.z + fz * 16, ry = Math.atan2(-fx, -fz);
  const y = setPiece(P, { type: 'headframe', x, z, ry, w: 34, d: 30, map: 'building' },
    [{ x: 0, z: -2, w: 7, d: 7, h: 22 }, { x: -10, z: 2, w: 8, d: 7, h: 6 }, { x: 10, z: -4, w: 6, d: 6, h: 7 }],
    [{ shape: 'box', x: 0, z: -2, w: 6, d: 6, h: 22, color: '#5a4a3a' }, { shape: 'box', x: -10, z: 2, w: 8, d: 7, h: 6.5, color: '#8a7a6a' }, { shape: 'box', x: 10, z: -4, w: 6, d: 6, h: 7, color: '#7a6a5a' }]);
  lampAt(P, { x, z, ry }, y, 0, -2, 22.5, '#ff3020', 1, 0.01, 1.0);
  P.landmark({ id: 'silver_queen', name: 'SILVER QUEEN MINE', x, z, r: 30, kind: 'mine' });
}

/** A dead telegraph line leaning into town along the roads in, some poles' wires down. */
function telegraph(P) {
  for (const id of ['gt_in', 'gt_l4']) {
    const r = P.net.byId.get(id);
    if (r) poleLine(P, r, 1, 9, 7.5, { leanK: 4, broken: 0.25 });
  }
}

// ================================================================== building: the town

/** A ghost-town building by kind; local frame (+z to the street). */
function building(B, it) {
  const { x, z, w, d, ry } = it;
  const c = Math.cos(ry), s = Math.sin(ry);
  const at = (lx, lz) => [x + lx * c + lz * s, z - lx * s + lz * c];
  const g = B.footY(x, z, w, d, ry);
  const y = g.hi;
  const wood = B.acc(MAT.wood(B)), sg = B.acc(MAT.ghost(B)), pa = B.acc(MAT.paint(B));
  const tone = it.paint || it.tone;
  const kind = it.kind;
  const seed = it.seed;
  if (kind === 'ruin') return ruin(B, it, at, y, g);
  if (kind === 'shack') return shack(B, it, at, y, g);
  if (kind === 'livery') return livery(B, it, at, y, g);
  if (kind === 'smith') return smithy(B, it, at, y, g);
  // stone foundation, then the walls (wood, or stone for the bank and the jail)
  const stone = kind === 'bank' || kind === 'sheriff';
  paint(pa, '#6a6058');
  box(pa, x, g.lo - 0.8, z, w, y - g.lo + 1.0, d, ry, { top: false });
  const wallH = it.h;
  if (stone) {
    const rk = B.acc(MAT.strata(B));
    paint(rk, kind === 'bank' ? '#a89078' : '#9a8a78');
    box(rk, x, y + 0.2, z, w, wallH, d, ry, { u: 6, v: 6, top: false });
    paint(pa, '#5a5048');
    box(pa, x, y + 0.2 + wallH, z, w + 0.4, 0.5, d + 0.4, ry);
    // a stepped parapet on the front
    for (let k = 0; k < 3; k++) { const [px, pz] = at(0, d / 2 - 0.2); paint(rk, '#a89078', 0.95 - k * 0.05); box(rk, px, y + 0.7 + wallH + k * 0.5, pz, w * (0.9 - k * 0.25), 0.5, 0.4, ry, { u: 6, v: 6 }); }
  } else {
    paint(wood, tone);
    box(wood, x, y + 0.2, z, w, wallH, d, ry, { u: 2, v: 4, top: false });
    // a gable roof running back from the false front (shingles: dark boards)
    paint(wood, '#5a4a3c');
    gable(wood, x, y + 0.2 + wallH, z, d, w + 0.2, Math.min(2.6, w * 0.32), ry + Math.PI / 2, { over: 0.35, u: 2, endAcc: wood });
    // the false front: taller than the roof, a cornice, a stepped or flat top
    const ff = wallH + 2.4 + (hash1(seed, 1) < 0.5 ? 0.6 : 0);
    const [fx, fz] = at(0, d / 2 + 0.12);
    paint(wood, tone, 1.04);
    box(wood, fx, y + 0.2, fz, w + 0.3, ff, 0.24, ry, { u: 2, v: 4 });
    paint(wood, '#4a3e32');
    box(wood, fx, y + 0.2 + ff, fz, w + 0.6, 0.3, 0.5, ry, { u: 2, v: 4 });
    if (hash1(seed, 2) < 0.5) { paint(wood, tone, 1.04); box(wood, fx, y + 0.5 + ff, fz, w * 0.45, 0.9, 0.24, ry, { u: 2, v: 4 }); paint(wood, '#4a3e32'); box(wood, fx, y + 1.4 + ff, fz, w * 0.5, 0.2, 0.4, ry, { u: 2, v: 4 }); }
  }
  // the sign board on the front, high up
  const SIGN = { saloon: RG.saloon, store: RG.store, hotel: RG.hotel, sheriff: RG.sheriff, bank: RG.bank, assay: RG.assay, barber: RG.barber, undertaker: RG.undertaker, post: RG.post };
  const sr = SIGN[kind];
  const front = d / 2 + (stone ? 0.02 : 0.25);
  if (sr) {
    const sw = Math.min(w - 0.8, sr[2] / sr[3] * 1.6);
    const [px, pz] = at(0, front);
    panel(sg, px, y + 0.2 + wallH + (stone ? -1.9 : 0.4), pz, ry, sw, sw * sr[3] / sr[2], uvOf(sr, 1024, 512));
  }
  // windows and the door: dark, broken, boarded (the saloon has its batwings and one lit window)
  const wins = [RG.winDark, RG.winBroken, RG.winBoard];
  const doorX = kind === 'saloon' ? 0 : (hash1(seed, 3) - 0.5) * (w - 4) * 0.6;
  {
    const [px, pz] = at(doorX, front);
    panel(sg, px, y + 0.2, pz, ry, kind === 'saloon' ? 2.2 : 1.5, kind === 'saloon' ? 3.2 : 2.6, uvOf(kind === 'saloon' ? RG.doors : RG.doorPlain, 1024, 512));
  }
  for (const lx of [-w / 2 + 1.6, w / 2 - 1.6]) {
    if (Math.abs(lx - doorX) < 2.2) continue;
    const [px, pz] = at(lx, front);
    const lit = kind === 'saloon' && lx > 0;
    panel(sg, px, y + 1.0, pz, ry, 1.5, 1.5, uvOf(lit ? RG.winLit : wins[Math.floor(hash1(seed, Math.round(lx * 10)) * 3)], 1024, 512));
  }
  if (it.floors === 2) {
    for (const lx of [-w / 2 + 1.8, 0, w / 2 - 1.8]) {
      const [px, pz] = at(lx, front);
      panel(sg, px, y + 4.4, pz, ry, 1.4, 1.6, uvOf(wins[Math.floor(hash1(seed, Math.round(lx * 10) + 5) * 3)], 1024, 512));
    }
  }
  // side windows
  for (const sd of [1, -1]) {
    const [px, pz] = at(sd * (w / 2 + 0.03), 0);
    panel(sg, px, y + 1.0, pz, ry + sd * Math.PI / 2, 1.3, 1.3, uvOf(wins[Math.floor(hash1(seed, sd + 7) * 3)], 1024, 512));
  }
  if (kind === 'sheriff' || hash1(seed, 9) < 0.3) { const [px, pz] = at(doorX + 1.4, front + 0.01); panel(sg, px, y + 1.4, pz, ry, 0.5, 0.66, uvOf(RG.wanted, 1024, 512)); }
  // the boardwalk, the porch roof on posts (a balcony on the two-storey ones), a hitching rail
  if (it.walk) boardwalk(B, it, at, y);
}

function boardwalk(B, it, at, y) {
  const { w, d, ry, seed } = it;
  const wood = B.acc(MAT.wood(B));
  const fz = d / 2 + BOARD / 2;
  const [bx, bz] = at(0, fz);
  const by = Math.max(y - 0.2, B.groundY(bx, bz));
  paint(wood, '#7a6a58');
  box(wood, bx, by - 0.4, bz, w, 0.85, BOARD, ry, { u: 2, v: 4, topU: 2 });
  // posts at the street edge, the porch roof (or a balcony)
  const posts = Math.max(2, Math.round(w / 3.2) + 1);
  paint(wood, '#6a5a48');
  for (let k = 0; k < posts; k++) { const [px, pz] = at(-w / 2 + 0.15 + (k / (posts - 1)) * (w - 0.3), d / 2 + BOARD - 0.15); box(wood, px, by + 0.45, pz, 0.16, it.floors === 2 ? 3.4 : 3.0, 0.16, ry, { u: 2, v: 4 }); }
  const sag = (hash1(seed, 11) - 0.5) * 0.12;
  if (it.floors === 2) {
    // the balcony: a floor at the second storey, a railing round it
    const [qx, qz] = at(0, fz);
    paint(wood, '#6e5e4c');
    box(wood, qx, by + 3.85, qz, w, 0.25, BOARD, ry, { u: 2, v: 4 });
    for (let k = 0; k <= Math.round(w / 0.5); k++) { const [px, pz] = at(-w / 2 + k * (w / Math.round(w / 0.5)), d / 2 + BOARD - 0.1); box(wood, px, by + 4.1, pz, 0.06, 0.9, 0.06, ry); }
    const [rx, rz] = at(0, d / 2 + BOARD - 0.1);
    box(wood, rx, by + 4.95, rz, w, 0.1, 0.12, ry, { u: 2, v: 4 });
  } else {
    const [qx, qz] = at(0, fz);
    paint(wood, '#5a4a3c');
    obox(wood, qx, by + 3.4, qz, w + 0.3, 0.12, BOARD + 0.4, ry, 0.12 + sag, sag * 0.5);
  }
  // a hitching rail and a trough in front of some
  if (hash1(seed, 12) < 0.55) {
    paint(wood, '#6a5a48');
    const [h1x, h1z] = at(-w * 0.25, d / 2 + BOARD + 0.9), [h2x, h2z] = at(w * 0.25, d / 2 + BOARD + 0.9);
    const hy = B.groundY(h1x, h1z);
    box(wood, h1x, hy - 0.3, h1z, 0.14, 1.4, 0.14, ry);
    box(wood, h2x, hy - 0.3, h2z, 0.14, 1.4, 0.14, ry);
    wood.beam(h1x, hy + 1.0, h1z, h2x, hy + 1.0, h2z, 0.12, 0.12);
  }
  if (hash1(seed, 13) < 0.3) {
    const [tx, tz] = at(w * 0.3, d / 2 + BOARD + 0.9);
    paint(wood, '#5a4a3a');
    box(wood, tx, B.groundY(tx, tz), tz, 2.2, 0.6, 0.7, ry, { u: 2, v: 4 });
  }
  // a wagon wheel leaning on the wall, barrels
  if (hash1(seed, 14) < 0.5) {
    const [wx, wz] = at(-w / 2 + 1.0, d / 2 + 0.25);
    wheel(B.near(MAT.wood(B)), wx, by + 0.45 + 0.6, wz, ry, 0.6, 0.25);
  }
  if (hash1(seed, 15) < 0.5) {
    const nr = B.near(MAT.paint(B));
    for (let k = 0; k < 2; k++) { const [qx, qz] = at(w / 2 - 0.6 - k * 0.7, d / 2 + 0.6); drumBarrel(nr, qx, by + 0.45, qz, '#6a5440'); }
  }
}

/** A spoked wooden wheel (r) standing in the plane facing ry, tilted back. */
function wheel(acc, x, y, z, ry, r, tilt = 0) {
  paint(acc, '#6a5440');
  const c = Math.cos(ry), s = Math.sin(ry);
  const P = (a, rr) => { const u = Math.cos(a) * rr, v = Math.sin(a) * rr; return [x + c * u - s * Math.sin(tilt) * v, y + v * Math.cos(tilt), z - s * u - c * Math.sin(tilt) * v]; };
  const n = 12;
  for (let k = 0; k < n; k++) { const a0 = (k / n) * TAU, a1 = ((k + 1) / n) * TAU; const p0 = P(a0, r), p1 = P(a1, r); acc.beam(p0[0], p0[1], p0[2], p1[0], p1[1], p1[2], 0.08, 0.1); }
  for (let k = 0; k < 6; k++) { const a = (k / 6) * TAU; const p = P(a, r * 0.95); acc.beam(x, y, z, p[0], p[1], p[2], 0.04, 0.04); }
}

function ruin(B, it, at, y, g) {
  const { w, d, ry, seed } = it;
  const wood = B.acc(MAT.wood(B)), pa = B.acc(MAT.paint(B));
  paint(pa, '#6a6058');
  box(pa, it.x, g.lo - 0.8, it.z, w, y - g.lo + 1.0, d, ry, { top: true });
  // what's left: the back wall, half of one side, a few studs, the roof caved in at a slant
  paint(wood, it.tone, 0.9);
  const [bx, bz] = at(0, -d / 2 + 0.1);
  box(wood, bx, y + 0.2, bz, w, it.h * 0.9, 0.2, ry, { u: 2, v: 4 });
  const [sx, sz] = at(-w / 2 + 0.1, -d / 4);
  box(wood, sx, y + 0.2, sz, 0.2, it.h * 0.6, d / 2, ry, { u: 2, v: 4 });
  for (let k = 0; k < 4; k++) { const [px, pz] = at(w / 2 - 0.1, -d / 2 + k * (d / 4)); box(wood, px, y + 0.2, pz, 0.14, it.h * (0.3 + hash1(seed, k) * 0.6), 0.14, ry); }
  paint(wood, '#5a4a3c');
  const [rx, rz] = at(0, -d / 4);
  obox(wood, rx, y + it.h * 0.35, rz, w * 0.95, 0.15, d * 0.6, ry, -0.45, 0.12);
  // a fallen false front lying in front
  const [fx, fz] = at(0.5, d / 2 - 1);
  paint(wood, it.tone);
  obox(wood, fx, y + 0.3, fz, w * 0.8, 0.2, 3.5, ry + 0.1, 0.05, 0.02);
  const nr = B.near(MAT.wood(B));
  for (let k = 0; k < 6; k++) { const [px, pz] = at((hash1(seed, k, 3) - 0.5) * w, (hash1(seed, k, 4) - 0.5) * d); paint(nr, '#7a6a58'); obox(nr, px, y + 0.25, pz, 0.18, 0.18, 2 + hash1(seed, k, 5) * 2, hash1(seed, k, 6) * TAU, 0.1, 0); }
}

function shack(B, it, at, y, g) {
  const { w, d, ry, seed } = it;
  const wood = B.acc(MAT.wood(B));
  paint(wood, it.tone, 0.95);
  box(wood, it.x, g.lo - 0.4, it.z, w, y - g.lo + 3.0, d, ry, { u: 2, v: 4, top: false });
  const tin = B.acc(MAT.tin(B));
  paintMix(tin, '#8a8278', '#8a5a3a', hash1(seed, 1));
  obox(tin, it.x, y + 2.6, it.z, w + 0.6, 0.1, d + 0.6, ry, 0.22, 0.04);
  const sg = B.acc(MAT.ghost(B));
  const [dx, dz] = at(-w / 4, d / 2 + 0.03);
  panel(sg, dx, y, dz, ry, 1.1, 2.2, uvOf(RG.doorPlain, 1024, 512));
  const [wx, wz] = at(w / 4, d / 2 + 0.03);
  panel(sg, wx, y + 1.0, wz, ry, 1.0, 1.0, uvOf(hash1(seed, 2) < 0.5 ? RG.winBoard : RG.winBroken, 1024, 512));
  const pa = B.near(MAT.paint(B));
  paint(pa, '#3a3632');
  const [sx, sz] = at(w / 2 - 0.8, -d / 4);
  cylinder(pa, sx, y + 2.4, sz, 0.12, 1.8, 6);
  // an outhouse behind some
  if (hash1(seed, 3) < 0.4) {
    const [ox, oz] = at(w / 2 + 3, -d / 2 - 3);
    paint(wood, '#8a7a68');
    box(wood, ox, B.groundY(ox, oz) - 0.2, oz, 1.3, 2.4, 1.3, ry + 0.2, { u: 2, v: 4 });
  }
}

function livery(B, it, at, y, g) {
  const { w, d, ry } = it;
  const wood = B.acc(MAT.wood(B)), sg = B.acc(MAT.ghost(B));
  paint(wood, '#8a5a46');
  box(wood, it.x, g.lo - 0.4, it.z, w, y - g.lo + 4.6, d, ry, { u: 2, v: 4, top: false });
  paint(wood, '#5a4a3c');
  gable(wood, it.x, y + 4.2, it.z, w, d, 3.6, ry + Math.PI / 2, { over: 0.5, u: 2, endAcc: wood });
  // the big doors (dark, one hanging open), the hay loft door, the sign
  const hole = B.acc(MAT.hole(B));
  const [dx, dz] = at(0, d / 2 + 0.03);
  panel(hole, dx, y, dz, it.ry, 3.6, 3.4);
  paint(wood, '#7a5040');
  const [ox, oz] = at(2.6, d / 2 + 1.0);
  box(wood, ox, y, oz, 0.12, 3.4, 1.8, ry + 0.3, { u: 2, v: 4 });
  const [lx, lz] = at(0, d / 2 + 0.04);
  panel(hole, lx, y + 5.0, lz, ry, 1.4, 1.4);
  panel(sg, lx, y + 3.6, lz + 0.01, ry, Math.min(w - 1, 5), Math.min(w - 1, 5) / 4, uvOf(RG.livery, 1024, 512));
}

function smithy(B, it, at, y) {
  const { w, d, ry, seed } = it;
  const wood = B.acc(MAT.wood(B)), rk = B.acc(MAT.rock(B)), sg = B.acc(MAT.ghost(B));
  // an open shed: posts, a back wall, a lean-to roof; the forge and an anvil
  paint(wood, it.tone);
  const [bx, bz] = at(0, -d / 2 + 0.1);
  box(wood, bx, y - 0.2, bz, w, 4.2, 0.2, ry, { u: 2, v: 4 });
  for (const lx of [-w / 2 + 0.2, 0, w / 2 - 0.2]) { const [px, pz] = at(lx, d / 2 - 0.2); box(wood, px, y - 0.2, pz, 0.2, 3.4, 0.2, ry); }
  const tin = B.acc(MAT.tin(B));
  paint(tin, '#7a6250');
  const [rx, rz] = at(0, 0);
  obox(tin, rx, y + 3.6, rz, w + 0.6, 0.1, d + 0.6, ry, -0.12, 0);
  paint(rk, '#6a625a');
  const [fx, fz] = at(-w / 4, -d / 4);
  box(rk, fx, y, fz, 2.2, 1.0, 1.6, ry);
  cylinder(rk, fx, y + 1.0, fz - 0.3, 0.35, 3.4, 6);
  const pa = B.near(MAT.paint(B));
  paint(pa, '#2a2a2c');
  const [ax, az] = at(w / 6, 0);
  box(pa, ax, y, az, 0.3, 0.6, 0.3, ry); box(pa, ax, y + 0.6, az, 0.9, 0.3, 0.32, ry);
  const [sx, sz] = at(0, d / 2);
  panel(sg, sx, y + 3.0, sz, ry, Math.min(w - 1, 4.5), Math.min(w - 1, 4.5) / 4, uvOf(RG.smith, 1024, 512));
  void seed;
}

function buildChurch(B, it) {
  const { x, z, w, d, ry } = it;
  const c = Math.cos(ry), s = Math.sin(ry);
  const at = (lx, lz) => [x + lx * c + lz * s, z - lx * s + lz * c];
  const g = B.footY(x, z, w, d, ry);
  const y = g.hi;
  const wood = B.acc(MAT.wood(B)), sg = B.acc(MAT.ghost(B)), pa = B.acc(MAT.paint(B));
  paint(pa, '#6a6058');
  box(pa, x, g.lo - 0.8, z, w, y - g.lo + 1.4, d, ry);
  // the nave: faded whitewash, a steep roof
  paint(wood, '#c8c0b0');
  box(wood, x, y + 0.6, z, w - 2, 6.4, d - 4, ry, { u: 2, v: 4, top: false });
  paint(wood, '#4a3e34');
  gable(wood, x, y + 7.0, z, d - 4, w - 2, 4.6, ry + Math.PI / 2, { over: 0.5, u: 2, endAcc: wood });
  // the bell tower in front: a square shaft, an open belfry, a pyramid roof, a cross
  const [tx, tz] = at(0, d / 2 - 3);
  paint(wood, '#c0b8a8');
  box(wood, tx, y + 0.6, tz, 4.4, 10, 4.4, ry, { u: 2, v: 4 });
  paint(wood, '#b0a898');
  for (const [a, b] of [[-1.9, -1.9], [1.9, -1.9], [1.9, 1.9], [-1.9, 1.9]]) { const [px, pz] = at(a, d / 2 - 3 + b); box(wood, px, y + 10.6, pz, 0.4, 3.2, 0.4, ry); }
  paint(wood, '#4a3e34');
  box(wood, tx, y + 13.8, tz, 5.0, 0.4, 5.0, ry, { u: 2, v: 4 });
  hip(wood, tx, y + 14.2, tz, 5.0, 5.0, 4.0, ry, { over: 0.2, u: 2 });
  const metal = B.acc(MAT.metal(B));
  paint(metal, '#6a5a3a');
  cylinder(metal, tx, y + 11.2, tz, 0.75, 1.3, 10, { r2: 0.45, top: true });
  paint(pa, '#3a3632');
  box(pa, tx, y + 18.2, tz, 0.16, 2.2, 0.16, ry);
  box(pa, tx, y + 19.4, tz, 1.1, 0.16, 0.16, ry);
  // the door under the tower, arched windows down the sides (a faint cold glow)
  const [dx, dz] = at(0, d / 2 - 0.78);
  panel(sg, dx, y + 0.6, dz, ry, 1.8, 3.0, uvOf(RG.doorPlain, 1024, 512));
  for (const sd of [1, -1]) for (const lz of [-4, 0, 4]) {
    const [px, pz] = at(sd * (w / 2 - 0.97), lz);
    panel(sg, px, y + 2.0, pz, ry + sd * Math.PI / 2, 1.5, 2.6, uvOf(RG.church, 1024, 512));
  }
  // steps
  paint(pa, '#7a7068');
  const [sx, sz] = at(0, d / 2 + 0.6);
  box(pa, sx, y - 0.3, sz, 3, 0.6, 1.2, ry);
  roadSignAt(B, at(w / 2 + 3, d / 2 + 2), ry, 'bootHill');
}

function roadSignAt(B, p, ry, kind) { roadSign(B, p[0], B.groundY(p[0], p[1]), p[1], ry, kind, { wood: true, scale: 0.9 }); }

function buildBootHill(B, it) {
  const { x, z, w, d, ry } = it;
  const c = Math.cos(ry), s = Math.sin(ry);
  const at = (lx, lz) => [x + lx * c + lz * s, z - lx * s + lz * c];
  const wood = B.acc(MAT.wood(B)), rk = B.near(MAT.rock(B));
  // a picket fence, sagging, gaps in it
  paint(wood, '#8a8070');
  const edge = [[-w / 2, -d / 2], [w / 2, -d / 2], [w / 2, d / 2], [-w / 2, d / 2], [-w / 2, -d / 2]];
  for (let e = 0; e < 4; e++) {
    const [ax, az] = edge[e], [bx, bz] = edge[e + 1];
    const L = Math.hypot(bx - ax, bz - az), n = Math.round(L / 0.6);
    for (let k = 0; k < n; k++) {
      if (e === 2 && Math.abs(k - n / 2) < 3) continue;
      if (hash1(it.n, e, k) < 0.12) continue;
      const t = k / n;
      const [px, pz] = at(ax + (bx - ax) * t, az + (bz - az) * t);
      // a picket: two faces of a thin board, leaning a little
      const py = B.groundY(px, pz) - 0.2, h = 1.1 + hash1(it.n, k, e) * 0.2, lean = (hash1(it.n, k, 9) - 0.5) * 0.25;
      const fr = ry + (e % 2 ? Math.PI / 2 : 0);
      panel(wood, px, py, pz, fr, 0.11, h, [0, 0, 0.06, h / 4], lean);
      panel(wood, px, py, pz, fr + Math.PI, 0.11, h, [0, 0, 0.06, h / 4], -lean);
    }
  }
  // graves: wooden crosses (some fallen), a few headstones, mounds
  const la = B.acc(MAT.lot(B));
  for (let i = 0; i < 5; i++) for (let j = 0; j < 4; j++) {
    if (hash1(it.n, i, j) < 0.2) continue;
    const lx = -w / 2 + 3 + i * (w - 6) / 4 + (hash1(it.n, i, j + 5) - 0.5), lz = -d / 2 + 3 + j * (d - 6) / 3;
    const [px, pz] = at(lx, lz);
    const py = B.groundY(px, pz);
    paint(la, '#7a6450');
    flat(la, px, py + 0.04, pz + 0.0, 0.9, 1.9, ry + (hash1(it.n, i, j + 3) - 0.5) * 0.2);
    const tilt = (hash1(it.n, i, j + 1) - 0.5) * 0.5;
    if (hash1(it.n, i, j + 2) < 0.25) {
      paint(rk, '#8a8680');
      blob(rk, px, py + 0.35, pz - 0.95, 0.35, 0.5, 0.12, ry, it.n + i * 7 + j, 0.1, 0.8);
    } else {
      paint(wood, '#9a9080');
      const [hx, hz] = at(lx, lz - 1.0);
      obox(wood, hx, py - 0.3, hz, 0.12, 1.5, 0.1, ry, 0, tilt);
      obox(wood, hx, py + 0.75, hz, 0.7, 0.12, 0.1, ry, 0, tilt);
    }
  }
  const tr = B.acc(MAT.plant(B));
  const [tx, tz] = at(w / 2 - 2, -d / 2 + 2);
  deadTreeAt(tr, tx, B.groundY(tx, tz), tz, it.n);
}

function deadTreeAt(acc, x, y, z, seed) {
  paint(acc, '#6a6258');
  tube(acc, [[x, y - 0.3, z], [x + 0.3, y + 3, z], [x + 0.8, y + 5.5, z + 0.3]], [0.35, 0.25, 0.14], 5, false);
  for (let k = 0; k < 4; k++) {
    const a = hash1(seed, k) * TAU, h = 2.8 + k * 0.8;
    tube(acc, [[x + 0.3, y + h, z], [x + 0.3 + Math.cos(a) * 2.4, y + h + 1.2, z + Math.sin(a) * 2.4]], [0.12, 0.03], 4, false);
  }
}

function buildWindmill(B, it) {
  const { x, z, ry } = it;
  const y = B.groundY(x, z);
  const wood = B.acc(MAT.wood(B)), pa = B.acc(MAT.paint(B));
  // the tower: four legs, cross-braced, a platform
  paint(wood, '#6a5a48');
  const legs = [[-1.6, -1.6], [1.6, -1.6], [1.6, 1.6], [-1.6, 1.6]];
  const c = Math.cos(ry), s = Math.sin(ry);
  const P = (a, b, h) => [x + a * c + b * s, y + h, z - a * s + b * c];
  for (const [a, b] of legs) { const p0 = P(a, b, -0.3), p1 = P(a * 0.35, b * 0.35, 11); wood.beam(p0[0], p0[1], p0[2], p1[0], p1[1], p1[2], 0.2, 0.2); }
  for (const h of [3, 6, 9]) {
    const k = 1 - (h / 11) * 0.65;
    for (let e = 0; e < 4; e++) { const [a0, b0] = legs[e], [a1, b1] = legs[(e + 1) % 4]; const p0 = P(a0 * k, b0 * k, h), p1 = P(a1 * k, b1 * k, h); wood.beam(p0[0], p0[1], p0[2], p1[0], p1[1], p1[2], 0.1, 0.1); }
  }
  const top = P(0, 0, 11);
  paint(pa, '#5a5a58');
  box(pa, top[0], top[1], top[2], 1.0, 0.8, 1.6, ry);
  // the tail vane
  paint(pa, '#8a8a84');
  const tail = P(0, -2.6, 11.3);
  pa.beam(top[0], top[1] + 0.4, top[2], tail[0], tail[1], tail[2], 0.08, 0.08);
  box(pa, tail[0], tail[1] - 0.6, tail[2], 0.05, 1.3, 1.6, ry);
  // the wheel: a separate mesh that turns (its own little geometry, built once per cell)
  const wa = new Acc(true);
  paint(wa, '#9a9a94');
  const R = 2.4;
  for (let k = 0; k < 18; k++) {
    const a = (k / 18) * TAU;
    // a blade: a thin slat from the hub out, angled
    obox(wa, Math.cos(a) * R * 0.55, Math.sin(a) * R * 0.55 - 0.05, 0, 0.32, 0.1, 0.05, 0, 0, a);
    wa.quadP([Math.cos(a - 0.08) * 0.5, Math.sin(a - 0.08) * 0.5, 0], [Math.cos(a - 0.12) * R, Math.sin(a - 0.12) * R, 0.06], [Math.cos(a + 0.12) * R, Math.sin(a + 0.12) * R, -0.06], [Math.cos(a + 0.08) * 0.5, Math.sin(a + 0.08) * 0.5, 0]);
    wa.quadP([Math.cos(a + 0.08) * 0.5, Math.sin(a + 0.08) * 0.5, 0], [Math.cos(a + 0.12) * R, Math.sin(a + 0.12) * R, -0.06], [Math.cos(a - 0.12) * R, Math.sin(a - 0.12) * R, 0.06], [Math.cos(a - 0.08) * 0.5, Math.sin(a - 0.08) * 0.5, 0]);
  }
  paint(wa, '#5a5a58');
  hcyl(wa, 0, 0, 0.1, 0.35, 0.5, -Math.PI / 2, 8, true);
  const mesh = new THREE.Mesh(wa.toGeometry(true), MAT.paint(B));
  const hub = P(0, 1.0, 11.4);
  mesh.position.set(hub[0], hub[1], hub[2]);
  mesh.rotation.order = 'YXZ';
  mesh.rotation.y = ry;
  mesh.castShadow = true;
  B.group.add(mesh);
  let ang = hash1(it.n, 1) * TAU, gust = 0;
  B.anim((t, dt, dist) => {
    if (dist > 500) return;
    gust = 0.6 + 0.4 * Math.sin(t * 0.21 + it.n) * Math.sin(t * 0.077);
    ang += dt * 1.6 * gust;
    mesh.rotation.z = ang;
  });
  // the stock tank beside it, the pump rod
  const [qx, qz] = [x + c * 4.5 + s * 2, z - s * 4.5 + c * 2];
  const metal = B.acc(MAT.metal(B));
  paint(metal, '#6a6a64');
  cylinder(metal, qx, y - 0.2, qz, 2.2, 1.0, 14, { top: false });
  const w = B.acc(MAT.glass(B));
  paint(w, '#203038');
  disc(w, qx, y + 0.65, qz, 2.15, 14, true);
  paint(pa, '#3a3a38');
  pa.beam(top[0], top[1], top[2], x, y + 0.5, z, 0.05, 0.05);
}

function* buildHeadframe(B, it) {
  const { x, z, ry } = it;
  const c = Math.cos(ry), s = Math.sin(ry);
  const at = (lx, lz) => [x + lx * c + lz * s, z - lx * s + lz * c];
  const y = B.groundY(x, z);
  const wood = B.acc(MAT.wood(B)), pa = B.acc(MAT.paint(B));
  // the shaft collar, the headframe: four tall timber legs, braced, a back-stay leaning to the hoist house
  const [sx, sz] = at(0, -2);
  const sy = B.groundY(sx, sz);
  paint(wood, '#5a4a3a');
  box(wood, sx, sy - 0.5, sz, 5, 1.2, 5, ry, { u: 2, v: 4 });
  const hole = B.acc(MAT.hole(B));
  flat(hole, sx, sy + 0.72, sz, 3, 3, ry);
  const L = (a, b, h) => { const [px, pz] = at(a, -2 + b); return [px, sy + h, pz]; };
  const legs = [[-2.4, -2.4], [2.4, -2.4], [2.4, 2.4], [-2.4, 2.4]];
  paint(wood, '#4e4034');
  for (const [a, b] of legs) { const p0 = L(a, b, 0), p1 = L(a * 0.45, b * 0.45, 19); wood.beam(...p0, ...p1, 0.4, 0.4); }
  for (const h of [4, 8, 12, 16]) {
    const k = 1 - (h / 19) * 0.55;
    for (let e = 0; e < 4; e++) { const [a0, b0] = legs[e], [a1, b1] = legs[(e + 1) % 4]; wood.beam(...L(a0 * k, b0 * k, h), ...L(a1 * k, b1 * k, h), 0.22, 0.22); }
    if (h < 16) for (let e = 0; e < 4; e++) { const [a0, b0] = legs[e], [a1, b1] = legs[(e + 1) % 4]; const k2 = 1 - ((h + 4) / 19) * 0.55; wood.beam(...L(a0 * k, b0 * k, h), ...L(a1 * k2, b1 * k2, h + 4), 0.14, 0.14); }
  }
  // the back-stays down to the hoist house side
  for (const a of [-1.2, 1.2]) wood.beam(...L(a, -1, 18), ...L(a * 2, 9, 0), 0.32, 0.32);
  // the sheave wheel up top
  const top = L(0, 0, 19.5);
  wheel(wood, top[0], top[1], top[2], ry + Math.PI / 2, 1.7, 0);
  paint(wood, '#3e342a');
  box(wood, top[0], top[1] - 1.0, top[2], 2.6, 0.4, 2.6, ry, { u: 2, v: 4 });
  yield;
  // the hoist house (tin), the ore bin, the sign, the tailings spilling down the hill
  const tin = B.acc(MAT.tin(B));
  {
    const [hx, hz] = at(-10, 8);
    const g = B.footY(hx, hz, 8, 7, ry);
    paintMix(tin, '#8a8278', '#9a6040', 0.4);
    box(tin, hx, g.lo - 0.4, hz, 8, g.hi - g.lo + 5, 7, ry, { u: 4 });
    paint(tin, '#7a5a40');
    gable(tin, hx, g.hi + 4.6, hz, 8.4, 7.4, 1.8, ry, { over: 0.3, u: 4 });
    paint(pa, '#3a3632');
    const [cx, cz] = at(-12, 7); cylinder(pa, cx, g.hi + 5, cz, 0.35, 5, 8);
    // the hoist cable up to the sheave
    pa.beam(hx, g.hi + 3.6, hz, top[0], top[1], top[2], 0.05, 0.05);
  }
  {
    const [bx, bz] = at(10, -4);
    const g = B.footY(bx, bz, 6, 6, ry);
    paint(wood, '#6a5848');
    for (const [a, b] of [[-2.4, -2.4], [2.4, -2.4], [2.4, 2.4], [-2.4, 2.4]]) { const [px, pz] = at(10 + a, -4 + b); box(wood, px, g.lo - 0.3, pz, 0.3, 4, 0.3, ry); }
    obox(wood, bx, g.lo + 3.6, bz, 5.6, 3.4, 5.6, ry, 0, 0);
    paint(wood, '#5a4a3a');
    obox(wood, bx + c * 3.6, g.lo + 2.4, bz - s * 3.6, 1.2, 0.2, 3, ry, 0, -0.6);
  }
  const sg = B.acc(MAT.ghost(B));
  const [nx, nz] = at(-10, 11.55);
  panel(sg, nx, B.groundY(nx, nz) + 3.0, nz, ry, 7, 1.75, uvOf(RG.mineCo, 1024, 512));
  const rk = B.acc(MAT.rock(B));
  for (let k = 0; k < 5; k++) {
    const [px, pz] = at(14 + k * 3, 6 + k * 2.2);
    paint(rk, '#b8a888', 0.95 + k * 0.02);
    blob(rk, px, B.groundY(px, pz) - 1.0, pz, 5 - k * 0.5, 2.6 - k * 0.3, 4, ry, it.n * 3 + k, 0.15, 0.4);
  }
  // an ore cart left on a short spur of track
  const metal = B.acc(MAT.metal(B));
  paint(metal, '#5a4030');
  const [ox, oz] = at(4, 3);
  obox(metal, ox, B.groundY(ox, oz) + 0.35, oz, 1.0, 0.8, 1.5, ry + 0.4, 0, 0);
}

// ---- the flickering lamp

function flickerLamp(B, it) {
  const { x, z, y } = it;
  const pa = B.acc(MAT.paint(B));
  paint(pa, '#3a3430');
  cylinder(pa, x, y - 0.3, z, 0.08, 3.6, 6);
  box(pa, x, y + 3.3, z, 0.42, 0.08, 0.42, 0);
  box(pa, x, y + 3.95, z, 0.46, 0.1, 0.46, 0);
  // the glass: its own material, bright or dim as the flame takes it
  const fl = B.acc(flickerMat(B));
  box(fl, x, y + 3.38, z, 0.32, 0.56, 0.32, 0);
  // the light on the boardwalk and street round it, and a halo, flickering together
  const pool = B.acc(poolMat(B));
  const gy = B.groundY(x, z);
  const R = 7;
  pool.quadP([x - R, gy + 0.12, z + R], [x + R, gy + 0.12, z + R], [x + R, gy + 0.12, z - R], [x - R, gy + 0.12, z - R], [0, 0, 1, 1]);
  const halo = new THREE.Sprite(haloMat(B));
  halo.position.set(x, y + 3.6, z);
  halo.scale.set(2.6, 2.6, 1);
  halo.renderOrder = 4;
  B.group.add(halo);
  const fm = flickerMat(B), pm = poolMat(B), hm = haloMat(B);
  const base = new THREE.Color(0xffc070);
  let v = 1, next = 0, target = 1;
  B.anim((t, dt) => {
    if (t > next) {
      // mostly on, now and then it sputters, sometimes it nearly dies
      const r = Math.random();
      target = r < 0.06 ? 0.08 : r < 0.25 ? 0.45 + Math.random() * 0.3 : 0.9 + Math.random() * 0.1;
      next = t + (target < 0.2 ? 0.08 + Math.random() * 0.25 : 0.04 + Math.random() * 0.18);
    }
    v += (target - v) * Math.min(1, dt * 30);
    const n = U.night.value;
    fm.color.copy(base).multiplyScalar(0.35 + v * 3.2 * n);
    pm.opacity = 0.75 * v * n;
    hm.opacity = 0.9 * v * n;
  });
}

// ---- tumbleweeds rolling down Main St (with the wind, east)

function tumbleweeds(B, it) {
  const r = B.net.byId.get(it.road);
  if (!r) return;
  const a = r.posAt(0), b = r.posAt(r.length - 1);
  tumbleRun(B, (a.x + b.x) / 2, (a.z + b.z) / 2, b.x - a.x, b.z - a.z, r.length - 20, 8, 5, it.n, tumbleShape);
}

// ---- small things

function wagon(B, it) {
  const { x, z, ry, kind } = it;
  const y = B.groundY(x, z);
  const wood = B.acc(MAT.wood(B));
  const c = Math.cos(ry), s = Math.sin(ry);
  const at = (a, b) => [x + a * c + b * s, z - a * s + b * c];
  // the bed along local z, wheels either side
  const broken = kind === 'broken';
  paint(wood, '#7a6450');
  const [bx, bz] = at(0, 0);
  obox(wood, bx, y + (broken ? 0.4 : 0.9), bz, 1.5, 0.5, 3.6, ry, broken ? 0.18 : 0, broken ? 0.25 : 0);
  if (kind === 'stage') {
    paint(wood, '#5a2a20');
    obox(wood, bx, y + 1.4, bz, 1.7, 1.8, 2.6, ry, 0, 0);
    paint(wood, '#3a2a20');
    obox(wood, bx, y + 3.2, bz, 1.9, 0.12, 2.9, ry, 0, 0);
  }
  for (const b of [-1.2, 1.2]) for (const a of [-0.95, 0.95]) {
    if (broken && b > 0 && a > 0) continue;
    const [wx, wz] = at(a, b);
    wheel(wood, wx, y + 0.65, wz, ry + Math.PI / 2, 0.65, 0);
  }
  // the tongue lying on the ground
  const [tx, tz] = at(0, 2.2), [ux, uz] = at(0.3, 4.2);
  wood.beam(tx, y + 0.6, tz, ux, y + 0.05, uz, 0.12, 0.12);
}

function junk(B, it) {
  const acc = B.near(MAT.wood(B));
  if (it.k === 0) { wheel(acc, it.x, it.y + 0.1, it.z, it.ry, 0.55, 1.45); return; }
  if (it.k === 1) { paint(acc, '#7a6a58'); obox(acc, it.x, it.y + 0.1, it.z, 0.2, 0.2, 2.6 + hash1(it.seed, 1) * 2, it.ry, 0.05, 0); return; }
  const nr = B.near(MAT.paint(B));
  drumBarrel(nr, it.x, it.y - 0.05, it.z, '#6a5440', true, it.ry);
}

function corral(B, it, wire) {
  const { x, z, w, d, ry } = it;
  const c = Math.cos(ry), s = Math.sin(ry);
  const at = (a, b) => [x + a * c + b * s, z - a * s + b * c];
  const wood = B.acc(MAT.wood(B));
  paint(wood, '#7a6a58');
  const edge = [[-w / 2, -d / 2], [w / 2, -d / 2], [w / 2, d / 2], [-w / 2, d / 2], [-w / 2, -d / 2]];
  for (let e = 0; e < 4; e++) {
    const [ax, az] = edge[e], [bx, bz] = edge[e + 1];
    const n = Math.round(Math.hypot(bx - ax, bz - az) / 2.6);
    let prev = null;
    for (let k = 0; k <= n; k++) {
      const t = k / n;
      const [px, pz] = at(ax + (bx - ax) * t, az + (bz - az) * t);
      const py = B.groundY(px, pz);
      const down = hash1(it.n, e, k) < 0.15;
      if (!down) box(wood, px, py - 0.3, pz, 0.16, 1.8, 0.16, ry);
      if (prev && !down && !(e === 2 && k === Math.round(n / 2))) for (const h of [0.6, 1.3]) wood.beam(prev[0], prev[1] + h, prev[2], px, py + h, pz, 0.1, 0.06);
      prev = down ? null : [px, py, pz];
    }
  }
  void wire;
}
