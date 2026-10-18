// PORT HALCYON — DOWNTOWN: the financial core. Glass and steel on a tight
// grid: slab towers, setback "wedding cakes", drums, chamfered and wedge-
// topped towers, stepped crowns and spires, rising toward Halcyon Plaza
// where the Meridian Tower (the tallest thing in the city, its mast blinking
// red across the whole map) stands at the head of Central Avenue. Offices
// light floor by floor in cool LED white; lobbies glow at street level;
// crowns are outlined in light; LED screens wrap the corners of Halcyon
// Crossing (Main St at Central Ave) and flicker through their ads. At street
// level: mast-arm signals that run their cycle, bus shelters, newsstands,
// subway stairs, honey locusts in grates, bollards, parking under the
// Skyline Expressway's curves, and the plaza itself — granite, a fountain
// whose jets breathe, a steel sculpture, trees in planters, lamps.
// Hidden: SKYPARK (up a garage ramp off 12th Street to a rooftop helipad)
// and THE VAULT (a courtyard at the end of a back alley off 1st Avenue).
import { COLS, ROWS } from '../map/areas/city.js';
import { litMat, drape } from './builder.js';
import { poleMat, concreteMat } from '../kit.js';
import { groundTexture } from '../../track/textures.js';
import { windowMat, screenMat, signalMat, blinkMat, nightGlow, nightGlowVC, sharedMat } from './central/shaders.js';
import { curtainTex, CURTAIN, ribbonTex, RIBBON, punchedTex, PUNCHED, lobbyTex, screensTex, SCREEN_ATLAS, dtSignsTex, DT_SIGN_RECTS, signUV, glowOf, graniteTex, STREET_SIGN } from './central/paint.js';
import { walls, lid, block, panel, decal, tree, car, ring, disc, place, circle, polyWalls, polyCap, toWorld, slope, blob, paint, A, N } from './central/geo.js';
import { drawParts, drawTops, drawScreens, drawCanopy } from './central/draw.js';
import { blockSide, groundClear, cityJunctions, signalSpot, walkSidewalks, Spots, naturalGround } from './central/plan.js';
import { roadLamps } from '../build/roads.js';
import { Acc } from '../build/geo.js';
import { ITEM, ROAD, RESERVED } from './occ.js';
import { roadPiers } from '../build/roads.js';
import * as THREE from 'three';

const ID = 'downtown';
const STOREY = 4;

// facade materials: texture tile = bays × floors cells of BAY × storey m
const SPEC = {
  curtain: { uw: CURTAIN.bays * 3, vh: CURTAIN.floors * 4, floors: CURTAIN.floors },
  crown: { uw: CURTAIN.bays * 3, vh: CURTAIN.floors * 4, floors: CURTAIN.floors },
  ribbon: { uw: RIBBON.bays * 3, vh: RIBBON.floors * 4, floors: RIBBON.floors },
  punched: { uw: PUNCHED.bays * 3, vh: PUNCHED.floors * 3.6, floors: PUNCHED.floors },
  lobby: { uw: 24, vh: 24, floors: 1, rows: 4 },
};
// glass, panel and stone tints (vertex colours over neutral textures)
const GLASS = [[0.52, 0.66, 0.9], [0.48, 0.76, 0.8], [0.84, 0.88, 0.94], [0.86, 0.68, 0.5], [0.38, 0.4, 0.46], [0.58, 0.8, 0.68], [0.7, 0.8, 0.95], [0.62, 0.6, 0.72]];
const PANEL = [[1, 1, 1], [1, 0.95, 0.86], [0.8, 0.82, 0.86], [0.5, 0.5, 0.55], [0.84, 0.68, 0.52], [0.66, 0.74, 0.8]];
const STONE = [[1, 0.97, 0.9], [0.78, 0.78, 0.78], [0.86, 0.63, 0.55], [0.75, 0.65, 0.56], [1.04, 1.03, 1.0], [0.62, 0.62, 0.64]];
const FAR = { curtain: [62, 80, 100], crown: [90, 110, 140], ribbon: [150, 148, 142], punched: [160, 150, 136] };
const farColor = (m, t) => {
  const b = FAR[m] || [120, 120, 120], k = t || [1, 1, 1];
  const h = (v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0');
  return `#${h(b[0] * k[0])}${h(b[1] * k[1])}${h(b[2] * k[2])}`;
};

// the core: Halcyon Plaza (heights fall away from it)
const CORE = [-80, -150];
function skyline(x, z) {
  const d = Math.hypot(x - CORE[0], (z - CORE[1]) * 1.15);
  const east = Math.exp(-(((x - 420) / 260) ** 2 + ((z + 40) / 300) ** 2));
  return 34 + 185 * Math.exp(-((d / 420) ** 2)) + 50 * east;
}

// the plaza's blocks (between CENTRAL AVE's ends: grid lines −220…60, −280…−60)
const PLAZA = { x0: -220, x1: 60, z0: -280, z1: -60 };
const inPlaza = (x0, z0, x1, z1) => x0 >= PLAZA.x0 - 1 && x1 <= PLAZA.x1 + 1 && z0 >= PLAZA.z0 - 1 && z1 <= PLAZA.z1 + 1;

export default {
  id: ID,

  plan(P) {
    const ctx = { lots: [], screenK: 0 };
    naturalGround(P);
    planPlaza(P, ctx);
    planSecrets(P, ctx);
    planBlocks(P, ctx);
    planStreets(P, ctx);
    P.landmark({ id: 'dt_crossing', name: 'HALCYON CROSSING', x: -80, z: -40, r: 50, kind: 'square' });
  },

  warm(B) {
    mats(B);
  },

  *build(B, items) {
    const M = mats(B);
    let t0 = performance.now();
    for (const it of items) {
      switch (it.type) {
        case 'bldg': drawBldg(B, it, M); break;
        case 'garage': drawGarage(B, it, M); break;
        case 'lot': drawLot(B, it, M); break;
        case 'pave': drawPave(B, it, M); break;
        case 'fountain': drawFountain(B, it, M); break;
        case 'sculpture': drawSculpture(B, it, M); break;
        case 'planter': drawPlanter(B, it, M); break;
        case 'plamp': drawPlazaLamp(B, it, M); break;
        case 'bollards': drawBollards(B, it, M); break;
        case 'pavilion': drawPavilion(B, it, M); break;
        case 'flags': drawFlags(B, it, M); break;
        case 'signal': drawSignal(B, it, M); break;
        case 'sf': drawFurniture(B, it, M); break;
        case 'heli': drawHelicopter(B, it, M); break;
        case 'vault': drawVault(B, it, M); break;
        case 'deckend': drawDeckEnd(B, it, M); break;
        default: break;
      }
      // (a couple of milliseconds a step: the streamer runs a step a frame)
      if (performance.now() - t0 > 2) { yield; t0 = performance.now(); }
    }
  },
};

// =====================================================================
// planning
// =====================================================================

/** The grid's blocks, cut into parcels, each a building (or a car park). */
function planBlocks(P, ctx) {
  const X = [-700, ...COLS.filter((c) => c > -700 && c < 720), 720];
  const Z = [-560, ...ROWS.filter((r) => r > -560 && r < 560), 560];
  for (let bj = 0; bj < Z.length - 1; bj++) {
    for (let bi = 0; bi < X.length - 1; bi++) {
      const gx0 = X[bi], gx1 = X[bi + 1], gz0 = Z[bj], gz1 = Z[bj + 1];
      if (inPlaza(gx0, gz0, gx1, gz1)) continue;
      const N = blockSide(P, 'x', gz0, gx0, gx1, 1), S = blockSide(P, 'x', gz1, gx0, gx1, -1);
      const Wd = blockSide(P, 'z', gx0, gz0, gz1, 1), E = blockSide(P, 'z', gx1, gz0, gz1, -1);
      const m = (sd) => (sd.road ? 0.6 : 0.3);
      const b = { x0: Wd.edge + m(Wd), x1: E.edge - m(E), z0: N.edge + m(N), z1: S.edge - m(S), N, S, W: Wd, E, bi, bj };
      if (b.x1 - b.x0 < 12 || b.z1 - b.z0 < 12) continue;
      // an elevated road through the block (the Skyline Expressway runs
      // mid-block): build either side of it, park cars under it
      const pieces = carve(P, b);
      for (const pc of pieces) {
        if (pc.lot) { planLotRect(P, pc); continue; }
        const parcels = (pieces.length === 1 && specialParcels(P, pc, ctx)) || subdivide(P, pc);
        for (const q of parcels) placeParcel(P, pc, q, ctx);
      }
    }
  }
}

const NONE = { edge: 0, cls: 0, elev: false, road: false };

/**
 * Split a block where something on the occupancy map (an elevated road's
 * corridor) runs through it: project the blocked 2 m cells (the block's
 * inner part only: the street corridors' cells spill over its edges) onto
 * each axis, keep the free runs as pieces (their inner sides face no
 * street) and the blocked runs as car parks under the deck.
 */
function carve(P, b, depth = 0) {
  const st = 3, pad = 2.4;
  const xs0 = b.x0 + pad, xs1 = b.x1 - pad, zs0 = b.z0 + pad, zs1 = b.z1 - pad;
  const nx = Math.max(1, Math.floor((xs1 - xs0) / st)), nz = Math.max(1, Math.floor((zs1 - zs0) / st));
  const cb = new Uint8Array(nx), rb = new Uint8Array(nz);
  let any = false;
  for (let i = 0; i < nx; i++) {
    for (let j = 0; j < nz; j++) {
      if (P.occ.get(xs0 + (i + 0.5) * st, zs0 + (j + 0.5) * st) & (ROAD | RESERVED | ITEM)) { cb[i] = 1; rb[j] = 1; any = true; }
    }
  }
  if (!any) return [b];
  const runs = (arr, a0, n) => {
    const out = [];
    let k = 0;
    while (k < n) {
      const v = arr[k];
      let e = k;
      while (e < n && arr[e] === v) e++;
      out.push({ blocked: !!v, a: a0 + k * st, b: a0 + e * st });
      k = e;
    }
    // the outer runs reach the block's own edges
    return out;
  };
  const rx = runs(cb, xs0, nx), rz = runs(rb, zs0, nz);
  const free = (r) => r.filter((q) => !q.blocked).reduce((a, q) => a + (q.b - q.a), 0);
  const alongX = free(rx) * (b.z1 - b.z0) >= free(rz) * (b.x1 - b.x0);
  const R = alongX ? rx : rz;
  const lo = alongX ? b.x0 : b.z0, hi = alongX ? b.x1 : b.z1;
  const out = [];
  R.forEach((q, k) => {
    // widen the outer runs to the block's edges, leave a gap by the deck
    let a = k === 0 ? lo : q.a, c = k === R.length - 1 ? hi : q.b;
    if (!q.blocked) { if (k > 0) a += 1.2; if (k < R.length - 1) c -= 1.2; }
    if (c - a < 6) return;
    const pc = alongX
      ? { x0: a, x1: c, z0: b.z0, z1: b.z1, N: b.N, S: b.S, W: k === 0 ? b.W : NONE, E: k === R.length - 1 ? b.E : NONE }
      : { x0: b.x0, x1: b.x1, z0: a, z1: c, W: b.W, E: b.E, N: k === 0 ? b.N : NONE, S: k === R.length - 1 ? b.S : NONE };
    pc.bi = b.bi; pc.bj = b.bj;
    // a blocked run may still have room beside the deck: carve it the other way
    if (q.blocked && depth === 0) { out.push(...carve(P, pc, 1).map((r) => (r === pc ? { ...pc, lot: true } : r))); return; }
    if (q.blocked) pc.lot = true;
    out.push(pc);
  });
  return out;
}

/** A car park on a rectangle (under a deck), if no road on the ground crosses it. */
function planLotRect(P, pc) {
  const w = pc.x1 - pc.x0, d = pc.z1 - pc.z0;
  if (w < 8 || d < 8) return;
  const x = (pc.x0 + pc.x1) / 2, z = (pc.z0 + pc.z1) / 2;
  if (P.occ.hitRect(x, z, w, d, 0, ITEM, -0.5) || !groundClear(P, x, z, w - 1, d - 1, 0, 0.2)) return;
  planLot(P, x, z, w, d, w > d ? 0 : Math.PI / 2);
}

/** Cut a block into parcels: slices along its long side, deep slices split front/back. */
function subdivide(P, b) {
  const W = b.x1 - b.x0, D = b.z1 - b.z0;
  const cx = (b.x0 + b.x1) / 2, cz = (b.z0 + b.z1) / 2;
  const H = skyline(cx, cz);
  const alongX = W >= D;
  const L = alongX ? W : D, S = alongX ? D : W;
  const target = H > 150 ? P.range(42, 60) : H > 90 ? P.range(32, 50) : P.range(22, 36);
  const n = Math.max(1, Math.round(L / target));
  const cuts = [0];
  for (let k = 1; k < n; k++) cuts.push(Math.round((L * k) / n + P.range(-0.14, 0.14) * (L / n)));
  cuts.push(L);
  const out = [];
  for (let k = 0; k < n; k++) {
    const a = cuts[k], c = cuts[k + 1];
    const split = S > 58 || (S > 44 && P.rng() < 0.35);
    const parts = split ? [[0, Math.round(S * P.range(0.42, 0.6))], [null, S]] : [[0, S]];
    if (split) parts[1][0] = parts[0][1];
    for (const [s0, s1] of parts) {
      if (alongX) out.push({ x0: b.x0 + a, x1: b.x0 + c, z0: b.z0 + s0, z1: b.z0 + s1 });
      else out.push({ x0: b.x0 + s0, x1: b.x0 + s1, z0: b.z0 + a, z1: b.z0 + c });
    }
  }
  return out;
}

/** The sides of a parcel that face a road (class) and its front. */
function parcelFrame(P, b, pc) {
  const eps = 0.8;
  const side = { N: pc.z0 <= b.z0 + eps ? b.N : null, S: pc.z1 >= b.z1 - eps ? b.S : null, W: pc.x0 <= b.x0 + eps ? b.W : null, E: pc.x1 >= b.x1 - eps ? b.E : null };
  const cls = (sd) => (sd && sd.road ? (sd.cls || (sd.elev ? 1.5 : 0)) : 0);
  let best = null, bc = -1;
  for (const k of ['S', 'N', 'E', 'W']) {
    const c = cls(side[k]) + P.rng() * 0.3;
    if (side[k] && side[k].road && c > bc) { bc = c; best = k; }
  }
  if (!best) best = 'S';
  const ry = { N: Math.PI, S: 0, E: Math.PI / 2, W: -Math.PI / 2 }[best];
  const ns = best === 'N' || best === 'S';
  const w = ns ? pc.x1 - pc.x0 : pc.z1 - pc.z0, d = ns ? pc.z1 - pc.z0 : pc.x1 - pc.x0;
  // local faces (f +z, b −z, r +x, l −x) → world sides
  const map = { N: { f: 'N', b: 'S', r: 'W', l: 'E' }, S: { f: 'S', b: 'N', r: 'E', l: 'W' }, E: { f: 'E', b: 'W', r: 'N', l: 'S' }, W: { f: 'W', b: 'E', r: 'S', l: 'N' } }[best];
  const faces = {};
  for (const f of ['f', 'b', 'l', 'r']) faces[f] = cls(side[map[f]]);
  const roads = Object.values(side).filter((sd) => sd && sd.road && sd.cls > 0).length;
  return { x: (pc.x0 + pc.x1) / 2, z: (pc.z0 + pc.z1) / 2, w, d, ry, faces, corner: roads >= 2, cls: Math.max(...Object.values(faces)) };
}

function placeParcel(P, b, pc, ctx) {
  if (pc.x1 - pc.x0 < 12 || pc.z1 - pc.z0 < 12) return;
  const F = parcelFrame(P, b, pc);
  let { x, z, w, d, ry } = F;
  if (!fits(P, x, z, w, d, ry)) {
    // under the expressway's curves: a car park; otherwise shrink to fit
    if (!P.occ.hitRect(x, z, w, d, ry, ITEM, -0.5) && groundClear(P, x, z, w, d, ry, 0.3)) { planLot(P, x, z, w, d, ry); return; }
    let ok = false;
    for (const k of [0.85, 0.7, 0.55]) {
      if (fits(P, x, z, w * k, d * k, ry)) { w *= k; d *= k; ok = true; break; }
    }
    if (!ok) return;
  }
  if (pc.kind === 'garage') { planGarage(P, x, z, w, d, ry, pc); return; }
  const H0 = skyline(x, z);
  let H;
  if (pc.H) H = pc.H;
  else {
    const r = P.rng();
    H = H0 * (r < 0.25 ? P.range(0.35, 0.6) : r < 0.78 ? P.range(0.6, 1.0) : P.range(1.0, 1.35));
    // a slender tower needs a footprint to stand on
    H = Math.min(H, Math.min(w, d) * 5.2, 262);
    H = Math.max(H, 16);
  }
  // a few mid-block lots are car parks or garages instead (the expressway's shadow, the edges)
  if (!pc.kind && !F.corner && H0 < 120 && P.rng() < 0.06 && w > 24 && d > 24) { planGarage(P, x, z, w, d, ry, { levels: Math.floor(P.range(4, 7)) }); return; }
  P.claim(x, z, w, d, ry);
  makeTower(P, { ...F, x, z, w, d, ry }, H, pc, ctx);
}

/**
 * A building from its parcel and height: picks a type (low office, mid-rise,
 * slab, setback, chamfered, drum, wedge, spire, stepped crown), a podium if
 * the parcel is much bigger than the tower, materials and tints, the street
 * level (lobby or shops), its rooftop, screens, a canopy; plans its
 * collider, far shape and lamps.
 */
/**
 * Is a parcel free? (the road corridors' 2 m cells spill up to 2 m past a
 * sidewalk, and parcels sit flush to them: test the footprint inset 1.8 m)
 */
function fits(P, x, z, w, d, ry) {
  return P.isFree(x, z, Math.max(1, w - 3.6), Math.max(1, d - 3.6), ry, { pad: 0 });
}

function makeTower(P, F, H, pc = {}, ctx) {
  const { x, z, w, d, ry } = F;
  const g = P.groundRange(x, z, w, d, ry);
  const gy = g.lo;
  const it = {
    type: 'bldg', x, z, ry, w, d, gy, y0: g.lo - 1.6, seed: Math.floor(P.rng() * 180), seedV: Math.floor(P.rng() * 16),
    parts: [], tops: [], screens: [], map: 'building',
  };
  const tall = H > 70;
  const baseH = pc.band === 'none' ? 0.25 : tall ? 8 : 5;
  let kind = pc.type;
  if (!kind) {
    if (H < 42) kind = 'low';
    else if (H < 90) kind = P.pick(['mid', 'mid', 'mid', 'cham', 'setback', 'slab']);
    else kind = pickW(P, [['slab', 22], ['setback', 18], ['cham', 16], ['cyl', Math.min(w, d) > 30 ? 12 : 0], ['wedge', 10], ['spire', 8], ['stepped', 12], ['twinslab', w > 46 ? 6 : 0]]);
  }
  const mk = pc.m || (kind === 'low' || kind === 'mid' ? P.pick(['punched', 'punched', 'ribbon', 'ribbon', 'curtain']) : kind === 'setback' ? P.pick(['punched', 'curtain', 'punched']) : P.pick(['curtain', 'curtain', 'curtain', 'ribbon']));
  const tint = pc.tint || (mk === 'curtain' ? P.pick(GLASS) : mk === 'ribbon' ? P.pick(PANEL) : P.pick(STONE));
  const led = P.rng() < 0.55 ? (P.rng() < 0.3 ? 'b' : 'w') : null;
  const snap = (h) => gy + baseH + Math.max(1, Math.round((h - baseH) / STOREY)) * STOREY;
  const top = snap(H);
  // podium: the parcel's full footprint, the tower set back on it
  const maxT = Math.max(26, Math.min(52, H * 0.24));
  let tw = Math.min(w, maxT), td = Math.min(d, maxT);
  let podTop = gy + baseH;
  let tx = 0, tz = 0;
  if (kind === 'helix') { tw = 40; td = 40; }
  const wantsPodium = tall && !pc.noPodium && kind !== 'helix' && (w > tw + 8 || d > td + 8);
  if (wantsPodium) {
    podTop = snap(P.range(14, 24));
    const pm = P.pick(['punched', 'ribbon']);
    it.parts.push({ s: 'box', w, d, y0: gy + baseH, y1: podTop, m: pm, tint: pm === 'punched' ? P.pick(STONE) : P.pick(PANEL), led: P.rng() < 0.3 ? 'w' : null });
    // the tower toward the front corner or centred
    tz = Math.max(0, (d - td) / 2 - P.range(4, 10)) * (P.rng() < 0.6 ? 1 : 0);
    tx = (P.rng() - 0.5) * Math.max(0, w - tw - 8);
  } else if (kind !== 'helix') { tw = w; td = d; }
  // the street-level band (all round the base)
  // texture rows: 3 a warm lobby, 2 a cool one, 1 and 0 runs of shops
  const band = pc.band ?? ((tall && P.rng() < 0.7) || P.rng() < 0.2 ? 2 + (P.rng() < 0.5 ? 1 : 0) : (P.rng() < 0.5 ? 1 : 0));
  const baseShape = wantsPodium ? { s: 'box', w, d } : null;
  const parts = it.parts;
  const shaftTint = tint;
  const T = (o) => parts.push({ dx: tx, dz: tz, m: mk, tint: shaftTint, ...o });
  switch (kind) {
    case 'low':
    case 'mid': {
      if (kind === 'mid' && P.rng() < 0.35 && H > 50) {
        const h1 = snap(H * P.range(0.55, 0.75));
        T({ s: 'box', w: tw, d: td, y0: podTop, y1: h1, led });
        const s1 = P.range(3, 6);
        T({ s: 'box', w: tw - 2 * s1, d: td - 2 * s1, y0: h1, y1: top, led });
      } else T({ s: 'box', w: tw, d: td, y0: podTop, y1: top, led: kind === 'mid' ? led : null });
      break;
    }
    case 'slab': {
      T({ s: 'box', w: tw, d: td, y0: podTop, y1: top, led });
      if (P.rng() < 0.45) it.tops.push({ k: 'screenwall', m: mk, tint, dx: tx, dz: tz, y: top, w: tw, d: td, h: 6 });
      break;
    }
    case 'twinslab': {
      // two slabs side by side, one taller (a bank's twin towers)
      const sw = tw * 0.46;
      T({ s: 'box', w: sw, d: td, dx: tx - tw * 0.27, y0: podTop, y1: top, led });
      T({ s: 'box', w: sw, d: td, dx: tx + tw * 0.27, y0: podTop, y1: snap(H * 0.82), led });
      break;
    }
    case 'setback': {
      const n = 3 + Math.floor(P.rng() * 3);
      let cw = tw, cd = td, y = podTop;
      const fr = [0.42, 0.24, 0.16, 0.1, 0.08].slice(0, n);
      const tot = fr.reduce((a, b) => a + b, 0);
      for (let k = 0; k < n; k++) {
        const y1 = k === n - 1 ? top : snap(y - gy + (H - (podTop - gy)) * fr[k] / tot);
        const crown = k === n - 1 && P.rng() < 0.6;
        T({ s: 'box', w: cw, d: cd, y0: y, y1: Math.max(y1, y + STOREY), m: crown ? 'crown' : mk, tint: crown ? [0.75, 0.85, 1] : tint, led: led || (k === n - 1 ? 'w' : null) });
        y = Math.max(y1, y + STOREY);
        const s = P.range(2.5, 5.5);
        cw -= 2 * s; cd -= 2 * s;
        if (cw < 8 || cd < 8) break;
      }
      if (P.rng() < 0.45) it.tops.push({ k: 'spire', dx: tx, dz: tz, y, r: Math.max(1.5, cw * 0.18), h: H * P.range(0.1, 0.18) });
      break;
    }
    case 'cham': {
      const c = Math.min(tw, td) * P.range(0.14, 0.24);
      const n = P.rng() < 0.5 ? 1 : 2;
      let cw = tw, cd = td, y = podTop;
      for (let k = 0; k < n; k++) {
        const y1 = k === n - 1 ? top : snap(H * 0.68);
        T({ s: 'cham', w: cw, d: cd, c: c * cw / tw, y0: y, y1, led });
        y = y1; cw -= 6; cd -= 6;
      }
      if (P.rng() < 0.55) T({ s: 'pyr', w: cw + 6, d: cd + 6, c: c * 0.8, y0: y, y1: y + Math.min(cw, cd) * P.range(0.35, 0.6), m: 'crown', tint: [0.7, 0.85, 1] });
      break;
    }
    case 'cyl': {
      const r = Math.min(tw, td) / 2;
      T({ s: 'cyl', r, n: 24, y0: podTop, y1: top, led: led || 'b' });
      T({ s: 'drum', r: r * 0.72, n: 20, y0: top, y1: top + 7, m: 'crown', tint: [0.7, 0.85, 1], led: 'w' });
      if (P.rng() < 0.6) it.tops.push({ k: 'mast', dx: tx, dz: tz, y: top + 7, r: 0.9, h: H * 0.16, lights: [0.5, 1] });
      break;
    }
    case 'wedge': {
      T({ s: 'box', w: tw, d: td, y0: podTop, y1: top, lid: false, slope: tw * P.range(0.55, 0.9), slopeM: 'crown', led: null });
      break;
    }
    case 'spire': {
      const c = Math.min(tw, td) * 0.16;
      T({ s: 'cham', w: tw, d: td, c, y0: podTop, y1: top, led: 'w' });
      T({ s: 'pyr', w: tw, d: td, c, y0: top, y1: top + H * P.range(0.14, 0.22), m: 'crown', tint: [0.75, 0.85, 1] });
      break;
    }
    case 'helix': {
      // THE HELIX: a 40 m square turning a quarter turn on its way up
      T({ s: 'twist', w: tw, d: td, y0: podTop, y1: top, step: 8, twist: Math.PI / 2, crownN: 3, crownM: 'crown', crownTint: [0.6, 0.92, 1], led: 3, ledM: 'b' });
      it.tops.push({ k: 'mast', dx: tx, dz: tz, y: top, r: 1.1, h: 34, rot: Math.PI / 2, lights: [0.5, 1] });
      P.landmark({ id: 'dt_helix', name: 'THE HELIX', x, z, r: 50, kind: 'tower' });
      break;
    }
    case 'stepped': {
      T({ s: 'box', w: tw, d: td, y0: podTop, y1: top, led });
      let cw = tw, cd = td, y = top;
      for (let k = 0; k < 3; k++) {
        cw *= 0.74; cd *= 0.74;
        const hh = P.range(5, 9) - k;
        T({ s: 'box', w: cw, d: cd, y0: y, y1: y + hh, m: 'crown', tint: [0.72, 0.84, 1], led: k % 2 ? 'b' : 'w' });
        y += hh;
      }
      break;
    }
    default: break;
  }
  // the street-level band, all round the lowest part
  const first = baseShape || parts.find((p) => p.s !== 'pyr') || parts[0];
  if (band === 'none') parts[0].y0 = gy - 1.4;
  else {
    const bs = first.s === 'drum' ? 'cyl' : first.s === 'twist' ? 'box' : first.s;
    // shopfronts and lobbies only where a street runs; the facade comes down to the ground on the other sides
    const streets = ['f', 'b', 'l', 'r'].filter((k) => (F.faces?.[k] || 0) > 0).join('') || 'f';
    const backs = bs === 'box' ? ['f', 'b', 'l', 'r'].filter((k) => !streets.includes(k)).join('') : '';
    parts.unshift({ ...first, dx: wantsPodium ? 0 : first.dx, dz: wantsPodium ? 0 : first.dz, s: bs, y0: gy - 0.25, y1: gy + baseH, m: 'lobby', band, tint: null, led: null, lid: false, slope: 0, faces: bs === 'box' ? streets : undefined });
    if (backs) {
      const shaft = wantsPodium ? parts[1] : first;
      parts.splice(1, 0, { s: 'box', w: wantsPodium ? w : first.w, d: wantsPodium ? d : first.d, dx: wantsPodium ? 0 : first.dx, dz: wantsPodium ? 0 : first.dz, y0: gy - 0.25, y1: gy + baseH, m: shaft.m === 'crown' ? mk : shaft.m, tint: shaft.tint, lid: false, faces: backs, back: true });
    }
  }
  // the plant on flat roofs
  const last = parts[parts.length - 1];
  if (last.s === 'box' && !last.slope && last.m !== 'crown' && kind !== 'stepped') {
    it.tops.push({ k: 'mech', dx: last.dx || 0, dz: last.dz || 0, y: last.y1, w: last.w * P.range(0.45, 0.7), d: last.d * P.range(0.45, 0.7), h: P.range(3.5, 7) });
    if (H > 150 && P.rng() < 0.35) it.tops.push({ k: 'heli', dx: (last.dx || 0) + last.w * 0.2, dz: last.dz || 0, y: last.y1, w: Math.min(16, last.w * 0.4) });
    else if (P.rng() < 0.4) it.tops.push({ k: 'antennas', y: last.y1, list: [[last.w * 0.3, -last.d * 0.3, P.range(6, 16)], [-last.w * 0.25, last.d * 0.2, P.range(4, 10)]].map(([a, b, h]) => [a + (last.dx || 0), b + (last.dz || 0), h]) });
  }
  // the owner's name on the crown
  const named = pc.logo ?? (tall && H > 120 && P.rng() < 0.4 ? 'c' + Math.floor(P.rng() * 7) : null);
  if (named) {
    const lp = parts.filter((p) => p.s === 'box' && p.m !== 'lobby').pop();
    if (lp) it.tops.push({ k: 'logo', name: named, dx: lp.dx || 0, dz: lp.dz || 0, y: lp.y1 - 7, w: lp.w, d: lp.d, h: 4.5, faces: 'fb' });
  }
  // screens on corner buildings of the big streets
  if (!pc.screens && F.corner && F.cls >= 2 && P.rng() < 0.38) {
    for (const f of ['f', 'l', 'r']) {
      if ((F.faces[f] || 0) < 1) continue;
      const span = f === 'f' ? w : d;
      const sw = Math.min(span * 0.6, P.range(10, 18));
      it.screens.push({ f, y: gy + baseH + P.range(1, 5), w: sw, h: sw / 2, off: (P.rng() - 0.5) * (span - sw) * 0.6, ph: ctx.screenK++ });
    }
  } else if (pc.screens) for (const sc of pc.screens) it.screens.push({ ...sc, y: gy + baseH + sc.y, ph: ctx.screenK++ });
  // an entrance canopy, lit underneath, and its light on the sidewalk
  if (tall && P.rng() < 0.65) it.canopy = { w: Math.min(16, w * 0.45), d: 3.4, y: gy + 5.4, off: (P.rng() - 0.5) * w * 0.3 };
  if (it.canopy && P.rng() < 0.55) {
    // a row of steel bollards along the front, under the canopy's edge
    const bw = it.canopy.w + 6, c = Math.cos(ry), s = Math.sin(ry), off = it.canopy.off, out = d / 2 + 2.2;
    it.bollards = { w: bw, off, out };
    P.collider({ kind: 'box', x: x + off * c + out * s, z: z - off * s + out * c, hx: bw / 2, hz: 0.3, ry, y0: gy - 1, y1: gy + 1.2 });
  }
  const fx = Math.sin(ry), fz = Math.cos(ry);
  const ex = x + fx * (d / 2 + 2.6) + Math.cos(ry) * (it.canopy?.off || 0), ez = z + fz * (d / 2 + 2.6) - Math.sin(ry) * (it.canopy?.off || 0);
  if (tall || P.rng() < 0.4) P.lamp({ x: ex, z: ez, hy: gy + (tall ? 5 : 3.6), color: tall ? '#dfe9ff' : '#ffe2b8', radius: tall ? 12 : 8, intensity: tall ? 0.9 : 0.7, halo: tall ? 1.6 : 1.0 });
  for (const sc of it.screens) {
    const ox = { f: [0, 1], b: [0, -1], r: [1, 0], l: [-1, 0] }[sc.f];
    const dist = (sc.f === 'f' || sc.f === 'b' ? d : w) / 2 + 5;
    const lx = ox[0] * dist, lz = ox[1] * dist;
    P.lamp({ x: x + lx * Math.cos(ry) + lz * Math.sin(ry), z: z - lx * Math.sin(ry) + lz * Math.cos(ry), hy: sc.y + sc.h / 2, color: P.pick(['#7ab0ff', '#ff6ab0', '#ffd27a', '#7affd0']), radius: 15, intensity: 0.55, halo: 0 });
  }
  P.add(it);
  // solid: the base footprint, up to the top
  let yTop = gy;
  for (const p of parts) yTop = Math.max(yTop, p.y1 + (p.slope || 0));
  it.top = yTop;
  P.collider({ kind: 'box', x, z, hx: w / 2, hz: d / 2, ry, y0: it.y0, y1: yTop });
  // far shapes, part by part
  const W2 = toWorld(x, z, ry);
  for (const p of parts) {
    if (p.m === 'lobby' || p.back) continue;
    const [px, pz] = W2(p.dx || 0, p.dz || 0);
    const col = farColor(p.m, p.tint);
    const lit = p.m === 'crown' ? 0.85 : p.m === 'curtain' ? 0.42 : 0.36;
    const y0 = p === parts.find((q) => q.m !== 'lobby' && !q.back) ? it.y0 : p.y0;
    if (p.s === 'cyl' || p.s === 'drum') P.far({ shape: 'cyl', x: px, z: pz, y: y0, r: p.r, h: p.y1 - y0, color: col, lit });
    else if (p.s === 'twist') P.far({ shape: 'cyl', x: px, z: pz, y: y0, r: p.w * 0.6, h: p.y1 - y0, color: col, lit });
    else if (p.s === 'pyr') P.far({ shape: 'cone', x: px, z: pz, y: p.y0, r: Math.min(p.w, p.d) / 2, h: p.y1 - p.y0, color: col, lit: 0 });
    else P.far({ shape: 'box', x: px, z: pz, y: y0, w: p.w, d: p.d, h: p.y1 + (p.slope || 0) * 0.5 - y0, ry: ry + (p.rot || 0), color: col, lit });
  }
  for (const t of it.tops) {
    if (t.k === 'mast' || t.k === 'spire') {
      const [px, pz] = W2(t.dx || 0, t.dz || 0);
      P.far({ shape: 'box', x: px, z: pz, y: t.y, w: 1.6, d: 1.6, h: t.h, color: '#9aa0a8', lit: 0 });
    }
  }
  return it;
}

function pickW(P, list) {
  const tot = list.reduce((a, [, w]) => a + w, 0);
  let r = P.rng() * tot;
  for (const [k, w] of list) { r -= w; if (r <= 0) return k; }
  return list[0][0];
}

// ---------------------------------------------------------------- special blocks

/**
 * Blocks with landmarks: Halcyon Crossing's corner screen buildings (Main St
 * at Central Ave, both sides), the Helix at 5th Ave and Main, and the
 * Skypark garage on 12th Street's east side.
 */
function specialParcels(P, b, ctx) {
  const { x0, x1, z0, z1 } = b;
  // HALCYON CROSSING: the two blocks south of Main St either side of Central Ave
  if (b.bj === 5 && (b.bi === 4 || b.bi === 5)) {
    const east = b.bi === 5;
    const cw = 44, cd = 40;
    const corner = east ? { x0, x1: x0 + cw, z0, z1: z0 + cd } : { x0: x1 - cw, x1, z0, z1: z0 + cd };
    corner.H = east ? 96 : 84;
    corner.type = 'mid';
    corner.m = east ? 'ribbon' : 'curtain';
    corner.tint = east ? [0.5, 0.5, 0.55] : [0.38, 0.4, 0.46];
    // screens: big ones on the plaza side (N) and on Central Ave, stacked
    const f = 'f';
    corner.screens = [
      { f, y: 2, w: 30, h: 15, off: east ? -4 : 4 },
      { f, y: 19, w: 22, h: 11, off: east ? 6 : -6 },
      { f: east ? 'r' : 'l', y: 3, w: 24, h: 12, off: 4 },
      { f: east ? 'r' : 'l', y: 18, w: 16, h: 8, off: -6 },
    ];
    // the west corner wears the crossing's name up top, lit red
    corner.logo = east ? null : 'crossing';
    corner.noPodium = true;
    const rest = east
      ? [{ x0: x0 + cw, x1: x0 + cw + 38, z0, z1: z0 + cd }, { x0: x0 + cw + 38, x1, z0, z1: z0 + cd }, { x0, x1: x0 + 58, z0: z0 + cd, z1 }, { x0: x0 + 58, x1, z0: z0 + cd, z1 }]
      : [{ x0, x1: x1 - cw - 40, z0, z1: z0 + cd }, { x0: x1 - cw - 40, x1: x1 - cw, z0, z1: z0 + cd }, { x0, x1: x1 - 60, z0: z0 + cd, z1 }, { x0: x1 - 60, x1, z0: z0 + cd, z1 }];
    // the corner faces Main St (north): make sure its front is the plaza side
    corner.front = 'N';
    return [corner, ...rest];
  }
  // THE HELIX: 5th Ave & Main, the block's north-west corner
  if (b.bj === 5 && b.bi === 8) {
    const hx = { x0, x1: x0 + 60, z0, z1: z0 + 60, type: 'helix', H: 252, m: 'curtain', tint: [0.48, 0.76, 0.8], logo: false, screens: [] };
    return [hx, { x0: x0 + 60, x1, z0, z1: z0 + 44 }, { x0: x0 + 60, x1, z0: z0 + 44, z1 }, { x0, x1: x0 + 60, z0: z0 + 60, z1 }];
  }
  void ctx;
  return null;
}

// ---------------------------------------------------------------- the plaza

function planPlaza(P, ctx) {
  const N = blockSide(P, 'x', PLAZA.z0, PLAZA.x0, PLAZA.x1, 1), S = blockSide(P, 'x', PLAZA.z1, PLAZA.x0, PLAZA.x1, -1);
  const Wd = blockSide(P, 'z', PLAZA.x0, PLAZA.z0, PLAZA.z1, 1), E = blockSide(P, 'z', PLAZA.x1, PLAZA.z0, PLAZA.z1, -1);
  const x0 = Wd.edge + 0.4, x1 = E.edge - 0.4, z0 = N.edge + 0.4, z1 = S.edge - 0.4;
  ctx.plaza = { x0, x1, z0, z1 };
  // the paving, in 64 m tiles (each cell builds its own share, a tile a time)
  const cuts = (a, b) => { const out = [a]; for (let k = Math.ceil(a / 64) * 64; k < b; k += 64) if (k - a > 1 && b - k > 1) out.push(k); out.push(b); return out; };
  const xs = cuts(x0, x1), zs = cuts(z0, z1);
  for (let i = 0; i < xs.length - 1; i++) {
    for (let j = 0; j < zs.length - 1; j++) {
      const poly = [[xs[i], zs[j]], [xs[i + 1], zs[j]], [xs[i + 1], zs[j + 1]], [xs[i], zs[j + 1]]];
      P.add({ type: 'pave', x: (xs[i] + xs[i + 1]) / 2, z: (zs[j] + zs[j + 1]) / 2, poly, map: 'plaza' });
    }
  }
  // the MERIDIAN TOWER at the head of Central Avenue: as far north as it fits
  // (an elevated road may cross the plaza: everything here finds its room)
  const firstFit = (cands, w, d) => cands.find(([x, z]) => fits(P, x, z, w, d, 0)) || null;
  const along = (x, za, zb, st = 3) => { const out = []; for (let z = za; z <= zb; z += st) out.push([x, z]); return out; };
  const mer = firstFit(along(-80, z0 + 31, z1 - 80), 76, 60) || [-80, z1 - 80];
  planMeridian(P, mer[0], mer[1], ctx);
  const merS = mer[1] + 30;
  // ONE PLAZA (east of it) and the station hall (west), wherever they fit
  const one = firstFit([...along(8, z0 + 22, merS - 20), ...along(-160, z0 + 22, merS - 20)], 40, 40);
  if (one) {
    P.claim(one[0], one[1], 40, 40, 0);
    makeTower(P, { x: one[0], z: one[1], w: 40, d: 40, ry: 0, faces: { f: 3, b: 1, l: 1, r: 0 }, corner: true, cls: 3 }, 168, { type: 'slab', m: 'curtain', tint: [0.86, 0.68, 0.5], logo: 'c7', screens: [] }, ctx);
  }
  for (const [x, z, w, d] of [[-168, z0 + 13, 46, 24], [-180, z0 + 13, 34, 22], [10, z0 + 13, 46, 24], [-168, merS - 13, 40, 22], [6, merS - 13, 40, 22]]) {
    if (!fits(P, x, z, w, d, 0)) continue;
    P.claim(x, z, w, d, 0);
    const gy = P.groundY(x, z);
    P.add({ type: 'pavilion', x, z, w, d, ry: 0, gy, h: 10, sign: 'station', map: 'building' });
    P.collider({ kind: 'box', x, z, hx: w / 2, hz: d / 2, ry: 0, y0: gy - 1, y1: gy + 12 });
    P.far({ shape: 'box', x, z, y: gy - 1, w, d, h: 12, color: '#3a4a5a', lit: 0.6 });
    P.lamp({ x, z: z + d / 2 + 3, hy: gy + 5, color: '#cfffe0', radius: 14, intensity: 0.8, halo: 1.5 });
    break;
  }
  // the open plaza: z from the Meridian's steps to Main St
  const oz0 = merS + 4, oz1 = z1;
  const gy = P.groundY(-80, (oz0 + oz1) / 2);
  // the fountain on Central Ave's axis, the sculpture nearer Main St
  const fz = oz0 + (oz1 - oz0) * 0.42;
  P.add({ type: 'fountain', x: -80, z: fz, r: 13, gy, map: 'plaza' });
  P.collider({ kind: 'circle', x: -80, z: fz, r: 13.4, y0: gy - 1, y1: gy + 1.2 });
  P.collider({ kind: 'circle', x: -80, z: fz, r: 2.2, y0: gy - 1, y1: gy + 9 });
  P.lamp({ x: -80, z: fz, hy: gy + 1.5, color: '#bfe0ff', radius: 18, intensity: 0.9, halo: 0 });
  const sz = oz1 - 24;
  P.add({ type: 'sculpture', x: -80, z: sz, gy, map: 'plaza' });
  P.collider({ kind: 'circle', x: -80, z: sz, r: 4.2, y0: gy - 1, y1: gy + 16 });
  P.lamp({ x: -80, z: sz + 5, hy: gy + 0.6, color: '#eef4ff', radius: 12, intensity: 0.9, halo: 0 });
  // the café kiosk and the subway entrance
  {
    const x = x0 + 26, z = oz1 - 18;
    P.claim(x, z, 14, 13, 0);
    P.add({ type: 'pavilion', x, z, w: 12, d: 8, ry: 0, gy, h: 4.2, cafe: true, map: 'building' });
    P.collider({ kind: 'box', x, z, hx: 6, hz: 4, ry: 0, y0: gy - 1, y1: gy + 5 });
    P.lamp({ x, z: z + 6, hy: gy + 3.5, color: '#ffd9a0', radius: 10, intensity: 0.9, halo: 1.2 });
    const sx = x1 - 22, sz2 = oz1 - 14;
    P.claim(sx, sz2, 5, 9, 0);
    P.add({ type: 'sf', k: 'subway', x: sx, z: sz2, y: gy + 0.05, ry: 0 });
    P.collider({ kind: 'box', x: sx, z: sz2, hx: 1.6, hz: 3.6, ry: 0, y0: gy - 1, y1: gy + 2.5 });
  }
  // bosques: trees in granite planters on the plaza's free paving (off the
  // axis, off anything built, off whatever runs overhead), with benches
  for (let px = x0 + 9; px <= x1 - 9; px += 12.5) {
    if (px > -114 && px < -46) continue;
    for (let pz = z0 + 9; pz <= z1 - 10; pz += 13) {
      if (!P.isFree(px, pz, 4, 4, 0, { pad: 0.5 })) continue;
      P.add({ type: 'planter', x: px, z: pz, gy, s: P.range(0.9, 1.15), t: P.rng(), bench: P.rng() < 0.45 });
      P.collider({ kind: 'box', x: px, z: pz, hx: 1.35, hz: 1.35, ry: 0, y0: gy - 1, y1: gy + 6 });
    }
  }
  // tall plaza lamps down both sides of the axis and along the front
  for (const px of [-104, -56]) {
    for (let pz = oz0 + 6; pz < oz1 - 4; pz += 30) {
      P.add({ type: 'plamp', x: px, z: pz, gy });
      P.collider({ kind: 'circle', x: px, z: pz, r: 0.3, y0: gy - 1, y1: gy + 9 });
      P.lamp({ x: px, z: pz, hy: gy + 9.4, color: '#e2ecff', radius: 20, intensity: 1, halo: 2.4 });
    }
  }
  // bollards along Main St (gaps on the axis and at the ends: you can drive in)
  const bz = oz1 - 1.6;
  for (const [a, b] of [[x0 + 14, -96], [-64, x1 - 14]]) {
    P.add({ type: 'bollards', x: (a + b) / 2, z: bz, x0: a, x1: b, gy });
    P.collider({ kind: 'box', x: (a + b) / 2, z: bz, hx: (b - a) / 2, hz: 0.3, ry: 0, y0: gy - 1, y1: gy + 1.1 });
  }
  // flags before the Meridian's doors
  P.add({ type: 'flags', x: -80, z: oz0 - 1, gy });
  P.collider({ kind: 'box', x: -80, z: oz0 - 1, hx: 9, hz: 0.4, ry: 0, y0: gy - 1, y1: gy + 14 });
}

/** The tallest tower in the city, its crown lit, its mast blinking red over the whole map. */
function planMeridian(P, x, z, ctx) {
  const w = 76, d = 60;
  P.claim(x, z, w, d, 0);
  const g = P.groundRange(x, z, w, d, 0);
  const gy = g.lo;
  const it = { type: 'bldg', x, z, ry: 0, w, d, gy, y0: gy - 1.6, seed: 77, seedV: 3, parts: [], tops: [], screens: [], map: 'building', name: 'MERIDIAN TOWER' };
  const steel = [0.78, 0.86, 0.96];
  it.parts.push({ s: 'box', w, d, y0: gy - 0.25, y1: gy + 10, m: 'lobby', band: 2, lid: false });
  it.parts.push({ s: 'box', w, d, y0: gy + 10, y1: gy + 22, m: 'punched', tint: [0.6, 0.6, 0.64], led: 'w' });
  const tiers = [[48, 8, 22, 154], [42, 7, 154, 232], [35, 6, 232, 282], [27, 5, 282, 308]];
  for (const [s, c, a, b] of tiers) it.parts.push({ s: 'cham', w: s, d: s, c, dz: -2, y0: gy + a, y1: gy + b, m: 'curtain', tint: steel, led: 'b' });
  it.parts.push({ s: 'cham', w: 20, d: 20, c: 4, dz: -2, y0: gy + 308, y1: gy + 326, m: 'crown', tint: [0.7, 0.85, 1], led: 'w' });
  it.parts.push({ s: 'pyr', w: 20, d: 20, c: 4, dz: -2, y0: gy + 326, y1: gy + 336, m: 'crown', tint: [0.7, 0.85, 1] });
  it.tops.push({ k: 'fins', dz: -2, y: gy + 232, w: 35, d: 35, h: 76, m: 'b' });
  it.tops.push({ k: 'mast', dz: -2, y: gy + 333, r: 1.4, h: 62, lights: [0.25, 0.55, 0.8, 1] });
  it.tops.push({ k: 'logo', name: 'meridian', dz: -2, y: gy + 294, w: 27, d: 27, h: 5, faces: 'fblr' });
  it.canopy = { w: 30, d: 5, y: gy + 7, off: 0 };
  it.top = gy + 395;
  P.add(it);
  P.collider({ kind: 'box', x, z, hx: w / 2, hz: d / 2, ry: 0, y0: it.y0, y1: gy + 340 });
  P.far({ shape: 'box', x, z, y: it.y0, w, d, h: 24, color: '#6a6c74', lit: 0.4 });
  for (const [s, , a, b] of tiers) P.far({ shape: 'box', x, z: z - 2, y: gy + a, w: s * 0.92, d: s * 0.92, h: b - a, color: '#48586c', lit: 0.5 });
  P.far({ shape: 'box', x, z: z - 2, y: gy + 308, w: 19, d: 19, h: 18, color: '#7a92b4', lit: 1 });
  P.far({ shape: 'cone', x, z: z - 2, y: gy + 326, r: 10, h: 10, color: '#8aa0c0', lit: 0 });
  P.far({ shape: 'box', x, z: z - 2, y: gy + 333, w: 2, d: 2, h: 62, color: '#a0a6ae', lit: 0 });
  // the warning lights: points of red seen across the map, and the crown's floods
  P.lamp({ x, z: z - 2, hy: gy + 395.5, color: '#ff2a1a', radius: 3, intensity: 0.2, halo: 3.5 });
  P.lamp({ x, z: z - 2, hy: gy + 370, color: '#ff2a1a', radius: 3, intensity: 0.2, halo: 2.6 });
  for (const [a, b] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) P.lamp({ x: x + a * 12, z: z - 2 + b * 12, hy: gy + 316, color: '#cfe2ff', radius: 4, intensity: 0.2, halo: 6 });
  P.lamp({ x, z: z + d / 2 + 4, hy: gy + 6.5, color: '#fff0d8', radius: 18, intensity: 1, halo: 2 });
  P.landmark({ id: 'dt_meridian', name: 'MERIDIAN TOWER', x, z, r: 60, kind: 'tower' });
  void ctx;
}

// ---------------------------------------------------------------- car parks & garages

function planLot(P, x, z, w, d, ry) {
  if (Math.abs(Math.sin(ry)) > 0.7) [w, d] = [d, w];
  const g = P.groundRange(x, z, w, d, ry);
  P.claim(x, z, w, d, ry);
  const piers = [];
  for (const [r] of P.net.near(x, z, Math.hypot(w, d) / 2 + 20, new Map())) for (const pr of roadPiers(r)) for (const c of pr.cols) piers.push(c);
  const it = { type: 'lot', x, z, w, d, ry, gy: g.lo, cars: [], map: 'yard' };
  // stalls in rows, every third one empty
  const c = Math.cos(ry), s = Math.sin(ry);
  for (let lz = -d / 2 + 4; lz < d / 2 - 3; lz += 7) {
    for (let lx = -w / 2 + 2.2; lx < w / 2 - 2; lx += 2.8) {
      if (P.rng() < 0.38) continue;
      const px = x + lx * c + lz * s, pz = z - lx * s + lz * c;
      if (!groundClear(P, px, pz, 2, 4.6, ry, 0.2)) continue;
      if (piers.some((c) => Math.abs(c.x - px) < 3.4 && Math.abs(c.z - pz) < 3.4)) continue;
      it.cars.push([lx, lz, P.rng() < 0.5 ? 0 : Math.PI, Math.floor(P.rng() * 1000)]);
      P.collider({ kind: 'box', x: px, z: pz, hx: 0.95, hz: 2.25, ry, y0: g.lo - 1, y1: g.lo + 1.5 });
    }
  }
  P.add(it);
  if (!piers.some((c) => Math.abs(c.x - x) < 3 && Math.abs(c.z - z) < 3)) {
    it.pole = true;
    P.collider({ kind: 'circle', x, z, r: 0.3, y0: g.lo - 1, y1: g.lo + 7 });
  }
  P.lamp({ x, z, hy: g.lo + 7, color: '#ffb066', radius: 16, intensity: 0.7, halo: 1.8 });
}

function planGarage(P, x, z, w, d, ry, o = {}) {
  const g = P.groundRange(x, z, w, d, ry);
  P.claim(x, z, w, d, ry);
  const levels = o.levels || 5;
  const lh = 3.2;
  const it = { type: 'garage', x, z, w, d, ry, gy: g.lo, y0: g.lo - 1.4, levels, lh, sign: o.sign || 'parkP', roofCars: [], map: 'building', skypark: !!o.skypark };
  const top = g.lo + levels * lh;
  for (let k = 0; k < 7; k++) it.roofCars.push([(P.rng() - 0.5) * (w - 6), (P.rng() - 0.5) * (d - 8), P.rng() < 0.5 ? 0 : Math.PI, Math.floor(P.rng() * 1000)]);
  P.add(it);
  P.collider({ kind: 'box', x, z, hx: w / 2, hz: d / 2, ry, y0: it.y0, y1: o.colliderTop ?? top + 1.2 });
  P.far({ shape: 'box', x, z, y: it.y0, w, d, h: top + 1.2 - it.y0, ry, color: '#8a8780', lit: 0.15 });
  const fx = Math.sin(ry), fz = Math.cos(ry);
  P.lamp({ x: x + fx * (d / 2 + 2), z: z + fz * (d / 2 + 2), hy: g.lo + 4, color: '#ffb066', radius: 12, intensity: 0.8, halo: 1.4 });
  return it;
}

// ---------------------------------------------------------------- the streets

function planStreets(P, ctx) {
  // signals at every junction of city streets: one pole per approach
  for (const n of cityJunctions(P)) {
    // the two phases: approaches running mostly north–south vs east–west
    const off = ((n.x * 0.013 + n.z * 0.007) % 1 + 1) % 1;
    for (const e of n.ends) {
      const sp = signalSpot(n, e);
      const ns = Math.abs(e.dz) > Math.abs(e.dx);
      const name = e.road.name;
      P.add({ type: 'signal', x: sp.x, z: sp.z, y: sp.y, ax: sp.ax, az: sp.az, len: sp.len, ry: sp.ry, ph: (off + (ns ? 0 : 0.5)) % 1, sign: STREET_SIGN[name] || null, lanes: e.road.rt.hw > 7 ? 3 : 2 });
      P.collider({ kind: 'circle', x: sp.x, z: sp.z, r: 0.3, y0: sp.y - 1, y1: sp.y + 7 });
    }
  }
  // along the sidewalks
  const roads = P.roads((r) => r.rt.walk > 0 && !(r.flags[Math.floor(r.N / 2)] & 5));
  const spots = new Spots();
  const used = { push: ([x, z, r]) => spots.add(x, z, r) };
  const free = (x, z, r) => spots.free(x, z, r);
  for (const r of roads) {
    const rt = r.rt;
    const big = rt.id === 'boulevard' || rt.id === 'avenue';
    const main = rt.id === 'boulevard';
    if (r.length - r.trim0 - r.trim1 < 30) continue;
    // a bus shelter on the big streets, a newsstand near a corner, subway stairs
    const mid = (r.trim0 + r.length - r.trim1) / 2;
    const sides = P.rng() < 0.5 ? [1, -1] : [-1, 1];
    const placeAt = (s, side, lat, k, rad, extra = {}) => {
      const p = r.posAt(s, side * lat);
      if (!P.inside(p.x, p.z) || !free(p.x, p.z, rad)) return null;
      if (!lampOk(r, p.x, p.z, rad + 1.2)) return null;
      const i = p.i;
      const y = r.roadY(i, p.t, Math.max(-rt.hw, Math.min(rt.hw, side * lat))) + rt.curb;
      const ry = Math.atan2(-side * r.LX[i], -side * r.LZ[i]);
      used.push([p.x, p.z, rad]);
      const it = P.add({ type: 'sf', k, x: p.x, z: p.z, y, ry, ...extra });
      return it;
    };
    if (big && P.rng() < 0.55) {
      const side = sides[0];
      const it = placeAt(mid + P.range(-12, 12), side, rt.hw + rt.shoulder + 1.3, 'shelter', 3.2, { ad: Math.floor(P.rng() * 4) });
      if (it) {
        P.collider({ kind: 'box', x: it.x, z: it.z, hx: 2.2, hz: 0.9, ry: it.ry, y0: it.y - 1, y1: it.y + 2.8 });
        P.lamp({ x: it.x, z: it.z, hy: it.y + 2.4, color: '#e8f0ff', radius: 6, intensity: 0.6, halo: 0.8 });
      }
    }
    if (P.rng() < 0.4) {
      const side = sides[1];
      const s = P.rng() < 0.5 ? r.trim0 + 12 : r.length - r.trim1 - 12;
      const it = placeAt(s, side, rt.hw + rt.shoulder + rt.walk - 1.3, 'news', 2.2);
      if (it) {
        P.collider({ kind: 'box', x: it.x, z: it.z, hx: 1.4, hz: 1.0, ry: it.ry, y0: it.y - 1, y1: it.y + 2.8 });
        P.lamp({ x: it.x, z: it.z, hy: it.y + 2.5, color: '#fff2d8', radius: 6, intensity: 0.6, halo: 0.8 });
      }
    }
    if ((main || r.name === 'CENTRAL AVE' || r.name === '1ST AVE' || r.name === '5TH AVE') && P.rng() < 0.55) {
      const side = sides[P.rng() < 0.5 ? 0 : 1];
      const s = P.rng() < 0.5 ? r.trim0 + 20 : r.length - r.trim1 - 20;
      const it = placeAt(s, side, rt.hw + rt.shoulder + rt.walk - 1.9, 'subway', 4);
      if (it) {
        P.collider({ kind: 'box', x: it.x, z: it.z, hx: 1.5, hz: 3.6, ry: it.ry + Math.PI / 2, y0: it.y - 1, y1: it.y + 2.6 });
        P.lamp({ x: it.x, z: it.z, hy: it.y + 3, color: '#c8ffd8', radius: 7, intensity: 0.7, halo: 1.2 });
      }
    }
    // honey locusts in grates on Main St and some avenues; small clutter everywhere
    const treeStep = main ? 15 : big ? 22 : 0;
    if (treeStep && (main || P.rng() < 0.5)) {
      walkSidewalks(r, treeStep, (p) => {
        if (!P.inside(p.x, p.z) || !free(p.x, p.z, 1.6)) return;
        const lat = Math.abs(p.kerb) + 1.4;
        const q = r.posAt(p.s, Math.sign(p.kerb) * lat);
        if (!lampOk(r, q.x, q.z, 2.6)) return;
        used.push([q.x, q.z, 1.6]);
        P.add({ type: 'sf', k: 'tree', x: q.x, z: q.z, y: p.y, ry: p.ry, s: P.range(0.85, 1.1), t: P.rng() });
        P.collider({ kind: 'circle', x: q.x, z: q.z, r: 0.35, y0: p.y - 1, y1: p.y + 6 });
      }, { ends: 10, offset: P.range(3, 8) });
    }
    walkSidewalks(r, 11, (p) => {
      if (P.rng() > 0.22 || !P.inside(p.x, p.z) || !free(p.x, p.z, 0.8)) return;
      const k = P.pick(['bin', 'hydrant', 'boxes', 'bin', 'meter']);
      const lat = k === 'boxes' ? Math.abs(p.back) - 0.9 : Math.abs(p.kerb) + 0.6;
      const q = r.posAt(p.s, Math.sign(p.kerb) * lat);
      if (!lampOk(r, q.x, q.z, 1.2)) return;
      used.push([q.x, q.z, 0.8]);
      P.add({ type: 'sf', k, x: q.x, z: q.z, y: p.y, ry: p.ry });
    }, { ends: 12, offset: P.range(2, 9) });
  }
  void ctx;
}

function lampOk(r, x, z, d) {
  for (const L of roadLamps(r)) if (Math.abs(L.x - x) < d && Math.abs(L.z - z) < d) return false;
  return true;
}

// ---------------------------------------------------------------- hidden places

/**
 * SKYPARK: a parking garage on the east edge whose roof carries the deck at
 * the top of the ramp (the roads are in map/areas/x_central.js): here the
 * garage under and beside the deck, the helipad, a helicopter, the wall at
 * the deck's end. THE VAULT: at the dead end of the back alley off 1st Ave,
 * a courtyard closed by an old brick building with a speakeasy's door under
 * a neon sign. (Planned before the blocks so the blocks build round them.)
 */
function planSecrets(P, ctx) {
  const deck = P.net.byId.get('xc_skydeck');
  const ramp = P.net.byId.get('xc_skyramp');
  if (deck && ramp) {
    const ax = deck.X[0], az = deck.Z[0], bx = deck.X[deck.N - 1], bz = deck.Z[deck.N - 1];
    const len = Math.hypot(bx - ax, bz - az);
    const tx = (bx - ax) / len, tz = (bz - az) / len;
    const heading = Math.atan2(tx, tz);
    const top = deck.Y[Math.floor(deck.N / 2)];
    const deckW = 2 * (deck.rt.hw + deck.rt.shoulder);
    // the garage reaches away from the street the ramp comes off
    let px = -tz, pz = tx;
    if ((ax - ramp.a.x) * px + (az - ramp.a.z) * pz < 0) { px = -px; pz = -pz; }
    const mx = (ax + bx) / 2, mz = (az + bz) / 2;
    let extra = 0;
    for (let e = 4; e <= 48; e += 4) {
      const ex = mx + px * (deckW / 2 + e), ez = mz + pz * (deckW / 2 + e);
      if (!P.inside(ex, ez, 2)) break;
      extra = e;
    }
    const across = deckW + 1 + extra, along = len + 6;
    const cp = (extra - 1) / 2;
    const cx = mx + px * cp, cz = mz + pz * cp;
    // local x across the deck (w), local z along it (d)
    const gy = P.groundY(cx, cz);
    const roofY = top - 1.75;
    const levels = Math.max(2, Math.floor((roofY - gy) / 3.2));
    const it = planGarage(P, cx, cz, across, along, heading, { levels, skypark: true, colliderTop: top - 0.45, sign: 'skypark' });
    it.deckY = roofY;
    it.roofY = roofY;
    it.roofCarsW = [];
    for (let k = 0; k < 9; k++) {
      const o = deckW / 2 + 3 + P.rng() * Math.max(1, extra - 6), s = (P.rng() - 0.5) * (len - 6);
      it.roofCarsW.push([mx + px * o + tx * s, mz + pz * o + tz * s, heading + (P.rng() < 0.5 ? 0 : Math.PI), Math.floor(P.rng() * 1000)]);
    }
    // the pad two thirds of the way along, a helicopter on it, the end wall
    const hx = ax + tx * len * 0.66, hz = az + tz * len * 0.66;
    P.add({ type: 'heli', x: hx, z: hz, y: top, ry: heading, pad: 15 });
    P.collider({ kind: 'box', x: hx, z: hz, hx: 1.7, hz: 5.6, ry: heading, y0: top - 0.5, y1: top + 3.2 });
    const ex = bx + tx * 0.6, ez = bz + tz * 0.6;
    P.add({ type: 'deckend', x: ex, z: ez, y: top, ry: heading, w: deckW + 1 });
    P.collider({ kind: 'box', x: ex, z: ez, hx: deckW / 2 + 1, hz: 0.7, ry: heading, y0: top - 2, y1: top + 1.6 });
    P.lamp({ x: hx, z: hz, hy: top + 0.7, color: '#7affb0', radius: 5, intensity: 0.5, halo: 2.2 });
    P.lamp({ x: ex - tx * 3, z: ez - tz * 3, hy: top + 1.2, color: '#ff4a3a', radius: 4, intensity: 0.4, halo: 1.4 });
    P.landmark({ id: 'dt_skypark', name: 'SKYPARK HELIPAD', x: hx, z: hz, r: 30, hidden: true, kind: 'helipad' });
  }
  const n = P.net.nodes.get('xc_v0');
  if (n && n.ends.length === 1) {
    const e = n.ends[0];
    const gy = n.y;
    // the courtyard: 10 m past the alley's dead end, closed by a brick block
    const bw = 16, bd = 24, gap = 10;
    const x = n.x - e.dx * (gap + bd / 2), z = n.z - e.dz * (gap + bd / 2);
    const ry = Math.atan2(e.dx, e.dz);
    if (P.isFree(x, z, bw - 2, bd - 2, ry, { pad: 0 })) {
      P.claim(x, z, bw, bd, ry);
      makeTower(P, { x, z, w: bw, d: bd, ry, faces: { f: 0.5, b: 0, l: 0, r: 0 }, corner: false, cls: 0.5 }, 17, { type: 'low', m: 'punched', tint: [0.8, 0.5, 0.42], logo: null, screens: [], noPodium: true, band: 'none' }, ctx);
    }
    const dx = n.x - e.dx * (gap - 0.2), dz = n.z - e.dz * (gap - 0.2);
    P.add({ type: 'vault', x: dx, z: dz, gy, ry });
    P.collider({ kind: 'box', x: dx + e.dx * 2.4, z: dz + e.dz * 2.4, hx: 2.6, hz: 1.2, ry, y0: gy - 1, y1: gy + 1.2 });
    P.lamp({ x: dx + e.dx * 1.5, z: dz + e.dz * 1.5, hy: gy + 3.4, color: '#ff3a8a', radius: 13, intensity: 0.9, halo: 1.8 });
    P.landmark({ id: 'dt_vault', name: 'THE VAULT', x: dx, z: dz, r: 20, hidden: true, kind: 'bar' });
  }
}

// =====================================================================
// materials
// =====================================================================

const PAL = [['#d8e6ff', 6], ['#a8c8ff', 2.5], ['#ffe6c0', 1.5]];

let _M = null;
/** Every material Downtown uses, each made once for the world through B.mat. */
function mats(B) {
  if (_M) return _M;
  const m = (k, f) => B.mat(k, f);
  const lob = lobbyTex();
  const signs = dtSignsTex();
  // one sign material: painted markings never glow, street blades a little
  const blades = Object.fromEntries(Object.values(STREET_SIGN).concat(['s_blank']).map((k) => [k, 0.45]));
  const signGlow = glowOf(signs, DT_SIGN_RECTS, { heli: 0, stairs: 0, grate: 0, ...blades }, 'dtsigns-glow');
  // a lit crown is the curtain wall with every window on (shaders.js)
  const curtain = m('curtain', () => windowMat(curtainTex(), { key: 'dt-curtain', tint: true, ...CURTAIN, pal: PAL, occ: [0.18, 0.72], dense: 0.93, sparse: 0.05, rough: 0.22, metal: 0.55, env: 1.25, night: 1.35, crown: { hex: '#cfe2ff', k: 1.55 } }));
  const paintCar = m('paintCar', () => litMat({ vertexColors: true, roughness: 0.35, metalness: 0.5, envMapIntensity: 1.0 }));
  const leaf = sharedMat(B, 'leaf', () => litMat({ vertexColors: true, roughness: 0.9, flatShading: true }, { glow: 0.32 }));
  // every LED strip, lit edge and neon: one material, its colour per vertex
  const glo = sharedMat(B, 'glo', () => nightGlowVC(4));
  const lit = (hex, k) => { const c = new THREE.Color(hex); return [c.r * k / 4, c.g * k / 4, c.b * k / 4]; };
  // (the kit's own concrete: the expressway's, already in most cells here)
  const concrete = concreteMat();
  const sign = m('sign', () => litMat({ map: signs, emissive: 0xffffff, emissiveMap: signGlow, roughness: 0.55 }, { night: 1.1, glow: 2.2 }));
  const M = {
    mats: {
      curtain,
      crown: curtain,
      ribbon: m('ribbon', () => windowMat(ribbonTex(), { key: 'dt-ribbon', tint: true, ...RIBBON, pal: PAL, occ: [0.15, 0.65], dense: 0.9, sparse: 0.06, rough: 0.45, metal: 0.25, env: 0.8, night: 1.25 })),
      punched: m('punched', () => windowMat(punchedTex(), { key: 'dt-punched', tint: true, ...PUNCHED, pal: [['#e8eeff', 4], ['#ffe2b0', 3], ['#b8d0ff', 1.5]], occ: [0.2, 0.7], dense: 0.85, sparse: 0.08, rough: 0.8, metal: 0.05, env: 0.4, night: 1.25 })),
      lobby: m('lobby', () => litMat({ map: lob.map, emissive: 0xffffff, emissiveMap: lob.emi, roughness: 0.3, metalness: 0.35, envMapIntensity: 1.0 }, { night: 0.95, glow: 1.6 })),
    },
    crownOf: { crown: 'curtain' },
    spec: SPEC,
    roof: concrete,
    concrete,
    metal: paint(paintCar, 0x3c4046),
    glass: paint(paintCar, 0x1c2833),
    steel: paint(paintCar, 0xa8adb2),
    pole: poleMat(),
    led: paint(glo, lit(0xd8e6ff, 3.2)),
    ledB: paint(glo, lit(0x5a9aff, 3.6)),
    ledG: paint(glo, lit(0x8affaa, 3)),
    neon: paint(glo, lit(0xff3a8a, 4)),
    blink: sharedMat(B, 'blink', () => blinkMat('#ff2a1a', 5)),
    screen: m('screen', () => screenMat(screensTex(), SCREEN_ATLAS.cols, SCREEN_ATLAS.rows, 1.5)),
    sign,
    signPlain: sign,
    pave: m('pave', () => litMat({ map: graniteTex(), roughness: 0.6, envMapIntensity: 0.6, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }, { glow: 2.6 })),
    lot: m('lot', () => litMat({ map: groundTexture('asphaltlot'), roughness: 0.9, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 })),
    paint: m('paint', () => litMat({ color: 0xd8d8d0, roughness: 0.6, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 })),
    signal: sharedMat(B, 'signal', () => signalMat(28)),
    water: m('water', () => nightGlow(0x1e4a6e, 0x2a6aff, 0.7, { rough: 0.04, metal: 0.4 })),
    trunk: paint(leaf, 0x4a3a2c),
    leaf,
    paintCar,
    jet: m('jet', () => nightGlow(0xdfefff, 0xbfe0ff, 2.4, { rough: 0.2 })),
  };
  M.uv = (name) => signUV(DT_SIGN_RECTS, name);
  _M = M;
  return M;
}

// =====================================================================
// building
// =====================================================================

function drawBldg(B, it, M) {
  drawParts(B, it, M);
  drawTops(B, it, M);
  drawScreens(B, it, M);
  drawCanopy(B, it, M);
  if (it.bollards) {
    const { w, off, out } = it.bollards;
    const c = Math.cos(it.ry), s = Math.sin(it.ry);
    const acc = N(B, M.metal), gl = N(B, M.led);
    for (let a = -w / 2; a <= w / 2 + 0.01; a += 1.7) {
      const px = it.x + (off + a) * c + out * s, pz = it.z - (off + a) * s + out * c;
      acc.cyl(px, it.gy, pz, 0.17, 1.0, 6, 0.15);
      gl.cyl(px, it.gy + 0.78, pz, 0.172, 0.07, 6);
    }
  }
}

function drawPave(B, it, M) {
  drape(A(B, M.pave), B, it.poly, { lift: 0.07, step: 6, uv: 9.6 });
}

function drawFountain(B, it, M) {
  const { x, z, r, gy } = it;
  // the basin: a granite rim, the water, a second tier, the jets (they breathe)
  ring(A(B, M.concrete), x, gy - 0.2, z, r - 0.9, r, 0.85, 28);
  disc(A(B, M.water), x, gy + 0.42, z, r - 0.9, 28, 6);
  ring(A(B, M.concrete), x, gy - 0.2, z, 3.4, 4.2, 1.6, 16);
  disc(A(B, M.water), x, gy + 1.2, z, 3.4, 16, 6);
  A(B, M.concrete).cyl(x, gy, z, 1.1, 2.6, 10, 0.7);
  ring(A(B, M.led), x, gy + 0.32, z, r - 1.05, r - 0.9, 0.12, 28);
  // jets: a mesh of their own, rising and falling with the clock
  const acc = new Acc();
  for (let k = 0; k < 12; k++) {
    const a = (k / 12) * Math.PI * 2;
    acc.cyl(Math.cos(a) * (r - 3), 0, Math.sin(a) * (r - 3), 0.18, 3.2 + (k % 2) * 1.6, 5, 0.05);
  }
  acc.cyl(0, 2.2, 0, 0.5, 6.5, 8, 0.12);
  blob(acc, 0, 8.6, 0, 1.4, 0.9, 1.4, 6, 3);
  const mesh = new THREE.Mesh(acc.toGeometry(false), M.jet);
  mesh.position.set(x, gy + 0.4, z);
  B.group.add(mesh);
  B.anim((t, dt, dist) => {
    if (dist > 400) return;
    mesh.scale.y = 0.75 + 0.25 * Math.sin(t * 1.3) + 0.08 * Math.sin(t * 5.1);
  });
}

function drawSculpture(B, it, M) {
  // THE HALCYON: three steel blades twisting round each other on a granite plinth
  const { x, z, gy } = it;
  block(A(B, M.concrete), x, gy - 0.2, z, 6.5, 1.1, 6.5, Math.PI / 4, 2);
  const st = A(B, M.steel);
  for (let k = 0; k < 3; k++) {
    const a0 = (k / 3) * Math.PI * 2;
    let prev = null;
    for (let s = 0; s <= 10; s++) {
      const t = s / 10, a = a0 + t * 2.2, rr = 2.4 * (1 - t * 0.55);
      const p = [x + Math.cos(a) * rr, gy + 0.9 + t * 14, z + Math.sin(a) * rr];
      if (prev) st.beam(prev[0], prev[1], prev[2], p[0], p[1], p[2], 0.75 * (1 - t * 0.5), 0.3);
      prev = p;
    }
  }
  panel(A(B, M.sign), x, gy + 0.15, z + 3.28, 5.2, 0.8, 0, M.uv('plaza'));
}

function drawPlanter(B, it, M) {
  const { x, z, gy, s, t } = it;
  block(A(B, M.concrete), x, gy - 0.1, z, 2.7, 0.75, 2.7, 0, 2);
  decal(A(B, M.trunk), x, gy + 0.66, z, 2.3, 2.3, 0, [0, 0, 0.6, 0.6]);
  const leaf = A(B, M.leaf);
  leaf.col = [0.2 + t * 0.08, 0.34 + t * 0.08, 0.13];
  tree(A(B, M.trunk), leaf, x, gy + 0.6, z, s, 'locust', t);
  leaf.col = [1, 1, 1];
  if (it.bench) {
    const ac = N(B, M.metal);
    ac.box(x + 2.3, gy, z, 0.6, 0.45, 2.4, 0);
    ac.box(x + 2.55, gy + 0.45, z, 0.12, 0.45, 2.4, 0);
  }
}

function drawPlazaLamp(B, it, M) {
  const { x, z, gy } = it;
  A(B, M.pole).cyl(x, gy, z, 0.16, 9.2, 6, 0.1);
  A(B, M.metal).box(x, gy + 9.1, z, 1.6, 0.25, 0.5, 0);
  A(B, M.led).box(x, gy + 8.95, z, 1.4, 0.12, 0.38, 0);
}

function drawBollards(B, it, M) {
  const acc = N(B, M.metal), gl = N(B, M.led);
  for (let px = it.x0; px <= it.x1; px += 1.8) {
    acc.cyl(px, it.gy, it.z, 0.16, 1.05, 6, 0.14);
    gl.cyl(px, it.gy + 0.82, it.z, 0.165, 0.06, 6);
  }
}

function drawPavilion(B, it, M) {
  const { x, z, w, d, ry, gy, h } = it;
  // a glass box with a thin roof, glowing from inside
  walls(A(B, M.mats.lobby), x, gy - 0.2, z, w, h + 0.2, d, ry, 24, (h + 0.2) * 4, 0.31, it.cafe ? 0.25 : 0.5);
  block(A(B, M.metal), x, gy + h, z, w + 1.4, 0.7, d + 1.4, ry, 3);
  if (it.sign) panel(A(B, M.sign), x + Math.sin(ry) * (d / 2 + 0.75), gy + h - 0.1, z + Math.cos(ry) * (d / 2 + 0.75), Math.min(w * 0.6, 16), Math.min(w * 0.6, 16) / 4, ry, M.uv(it.sign));
  if (it.sign) ledBand(B, M, x, gy + h + 0.7, z, w + 1.4, d + 1.4, ry);
  if (it.cafe) {
    // an awning and tables out front
    const aw = A(B, M.paintCar);
    aw.col = [0.12, 0.29, 0.2];
    slope(aw, x + Math.sin(ry) * d / 2, z + Math.cos(ry) * d / 2, w, 2.6, gy + 3.6, gy + 3.0, ry);
    aw.col = [1, 1, 1];
    const nb = N(B, M.metal);
    for (let k = -1; k <= 1; k++) {
      const px = x + Math.cos(ry) * k * 3.5 + Math.sin(ry) * (d / 2 + 4), pz = z - Math.sin(ry) * k * 3.5 + Math.cos(ry) * (d / 2 + 4);
      nb.cyl(px, gy, pz, 0.06, 0.75, 5);
      nb.cyl(px, gy + 0.72, pz, 0.45, 0.05, 8);
    }
  }
}

function ledBand(B, M, x, y, z, w, d, ry) {
  const c = Math.cos(ry), s = Math.sin(ry);
  const P2 = (lx, lz) => [x + lx * c + lz * s, z - lx * s + lz * c];
  const C = [P2(-w / 2, -d / 2), P2(w / 2, -d / 2), P2(w / 2, d / 2), P2(-w / 2, d / 2)];
  const acc = A(B, M.ledG);
  for (let k = 0; k < 4; k++) { const a = C[k], b = C[(k + 1) % 4]; acc.beam(a[0], y, a[1], b[0], y, b[1], 0.2, 0.2); }
}

function drawFlags(B, it, M) {
  const { x, z, gy } = it;
  const colors = [[0.85, 0.12, 0.15], [0.95, 0.95, 0.95], [0.12, 0.25, 0.65]];
  for (let k = -1; k <= 1; k++) {
    const px = x + k * 7;
    A(B, M.pole).cyl(px, gy, z, 0.1, 13, 6, 0.06);
    const f = A(B, M.paintCar);
    f.col = colors[k + 1];
    f.box(px + 1.4, gy + 10.6, z, 2.6, 1.6, 0.06, 0);
    f.col = [1, 1, 1];
  }
}

function drawSignal(B, it, M) {
  const { x, z, y, ax, az, len, ry } = it;
  const pole = A(B, M.pole);
  pole.cyl(x, y, z, 0.17, 6.6, 6, 0.13);
  const ex = x + ax * len, ez = z + az * len;
  pole.beam(x, y + 6.2, z, ex, y + 6.2, ez, 0.16, 0.2);
  pole.beam(x, y + 4.6, z, x + ax * len * 0.35, y + 6.15, z + az * len * 0.35, 0.08, 0.08);
  // signal heads hanging over the lanes, a pedestrian head on the pole
  const fx = Math.sin(ry), fz = Math.cos(ry);
  const housing = N(B, M.metal);
  const lens = N(B, M.signal);
  const heads = it.lanes;
  for (let k = 0; k < heads; k++) {
    const f = 0.42 + (k / Math.max(1, heads - 1)) * 0.55;
    const hx = x + ax * len * f, hz = z + az * len * f;
    housing.box(hx, y + 4.95, hz, 0.42, 1.2, 0.34, ry);
    const cols = [[1, 0.12, 0.08], [1, 0.62, 0.1], [0.15, 1, 0.65]];
    for (let L = 0; L < 3; L++) {
      lens.col = cols[L];
      const ly = y + 5.85 - L * 0.37;
      panel(lens, hx + fx * 0.18, ly - 0.14, hz + fz * 0.18, 0.26, 0.28, ry, [it.ph, 0, it.ph, 1]);
    }
  }
  lens.col = [1, 1, 1];
  housing.box(x + fx * 0.25, y + 2.6, z + fz * 0.25, 0.32, 0.5, 0.25, ry);
  if (it.sign) {
    const sx = x + ax * len * 0.3, sz = z + az * len * 0.3;
    const sry = Math.atan2(ax, az) + Math.PI / 2;
    panel(A(B, M.sign), sx, y + 6.45, sz, 2.6, 0.5, sry, M.uv(it.sign));
    panel(A(B, M.sign), sx, y + 6.45, sz, 2.6, 0.5, sry + Math.PI, M.uv(it.sign));
  }
}

function drawFurniture(B, it, M) {
  const { x, z, y, ry } = it;
  const fx = Math.sin(ry), fz = Math.cos(ry), lx = Math.cos(ry), lz = -Math.sin(ry);
  switch (it.k) {
    case 'tree': {
      decal(N(B, M.signPlain), x, y + 0.02, z, 1.8, 1.8, ry, M.uv('grate'));
      const leaf = A(B, M.leaf);
      leaf.col = [0.2 + it.t * 0.08, 0.34 + it.t * 0.08, 0.13];
      tree(A(B, M.trunk), leaf, x, y, z, it.s, 'locust', it.t);
      leaf.col = [1, 1, 1];
      break;
    }
    case 'shelter': {
      // a glass box open to the kerb: back pane, two ends, roof, a lit ad, a bench
      const g = A(B, M.glass), m = N(B, M.metal);
      const bx = x - fx * 0.75, bz = z - fz * 0.75;
      panel(g, bx, y, bz, 4.2, 2.4, ry);
      panel(g, bx, y, bz, 4.2, 2.4, ry + Math.PI);
      for (const sd of [-1, 1]) {
        const ex = x + lx * sd * 2.1, ez = z + lz * sd * 2.1;
        panel(g, ex, y, ez, 1.5, 2.4, ry + sd * Math.PI / 2);
        panel(g, ex, y, ez, 1.5, 2.4, ry - sd * Math.PI / 2);
        m.box(ex - fx * 0.75, y, ez - fz * 0.75, 0.1, 2.5, 0.1, ry);
      }
      block(A(B, M.metal), x, y + 2.45, z, 4.6, 0.18, 1.9, ry, 2);
      const ax = x + lx * 2.12, az = z + lz * 2.12;
      panel(A(B, M.sign), ax, y + 0.3, az, 1.1, 1.9, ry + Math.PI / 2, M.uv('ad' + it.ad));
      panel(A(B, M.sign), ax, y + 0.3, az, 1.1, 1.9, ry - Math.PI / 2, M.uv('ad' + ((it.ad + 1) % 4)));
      m.box(x - fx * 0.45, y, z - fz * 0.45, 2.6, 0.45, 0.45, ry);
      panel(N(B, M.sign), x + lx * 2.5 + fx * 0.6, y + 2.0, z + lz * 2.5 + fz * 0.6, 0.45, 0.6, ry, M.uv('busstop'));
      break;
    }
    case 'news': {
      const kiosk = A(B, M.paintCar);
      kiosk.col = [0.12, 0.29, 0.2];
      block(kiosk, x, y, z, 2.6, 2.5, 1.8, ry, 2);
      kiosk.col = [1, 1, 1];
      block(A(B, M.metal), x, y + 2.5, z, 3.0, 0.2, 2.4, ry, 2);
      panel(A(B, M.sign), x + fx * 0.92, y + 0.4, z + fz * 0.92, 2.3, 1.15, ry, M.uv('news'));
      break;
    }
    case 'subway': {
      // the stairwell (a dark decal), railings round three sides, globes on posts, the sign
      const sry = ry + Math.PI / 2;
      decal(A(B, M.signPlain), x, y + 0.03, z, 1.9, 6, sry, M.uv('stairs'));
      const m = A(B, M.paintCar);
      m.col = [0.12, 0.29, 0.2];
      const P2 = (a, b) => [x + Math.cos(sry) * a + Math.sin(sry) * b, z - Math.sin(sry) * a + Math.cos(sry) * b];
      const C = [P2(-1.05, 3.1), P2(-1.05, -3.1), P2(1.05, -3.1), P2(1.05, 3.1)];
      for (let k = 0; k < 3; k++) { const a = C[k], b = C[k + 1]; m.beam(a[0], y + 1.0, a[1], b[0], y + 1.0, b[1], 0.07, 0.07); }
      for (const c of C) m.cyl(c[0], y, c[1], 0.05, 1.0, 5);
      for (const c of [C[0], C[3]]) {
        m.cyl(c[0], y, c[1], 0.07, 2.6, 6);
        blob(A(B, M.ledG), c[0], y + 2.85, c[1], 0.3, 0.3, 0.3, 6, 4);
      }
      const sp = P2(0, -3.3);
      m.cyl(sp[0], y, sp[1], 0.06, 2.2, 5);
      m.col = [1, 1, 1];
      panel(A(B, M.sign), sp[0], y + 2.2, sp[1], 1.8, 0.56, sry + Math.PI, M.uv('subway'));
      panel(A(B, M.sign), sp[0], y + 2.2, sp[1], 1.8, 0.56, sry, M.uv('subway'));
      break;
    }
    case 'bin': {
      const bin = N(B, M.paintCar);
      bin.col = [0.12, 0.29, 0.2];
      bin.cyl(x, y, z, 0.32, 0.95, 7, 0.36);
      bin.col = [1, 1, 1];
      break;
    }
    case 'hydrant': {
      const n = N(B, M.paintCar);
      n.col = [0.75, 0.62, 0.12];
      n.cyl(x, y, z, 0.16, 0.7, 6, 0.13);
      n.box(x, y + 0.42, z, 0.5, 0.12, 0.12, ry);
      n.col = [1, 1, 1];
      break;
    }
    case 'boxes': {
      const n = N(B, M.paintCar);
      const cols = [[0.1, 0.3, 0.7], [0.8, 0.15, 0.1], [0.9, 0.75, 0.1]];
      for (let k = 0; k < 3; k++) {
        n.col = cols[k];
        n.box(x + lx * (k - 1) * 0.55, y, z + lz * (k - 1) * 0.55, 0.45, 1.05, 0.45, ry);
      }
      n.col = [1, 1, 1];
      break;
    }
    case 'meter': {
      N(B, M.metal).cyl(x, y, z, 0.05, 1.2, 4);
      N(B, M.metal).box(x, y + 1.2, z, 0.22, 0.32, 0.18, ry);
      break;
    }
    default: break;
  }
}

function drawLot(B, it, M) {
  const { x, z, w, d, ry, gy } = it;
  const c = Math.cos(ry), s = Math.sin(ry);
  const W2 = (lx, lz) => [x + lx * c + lz * s, z - lx * s + lz * c];
  drape(A(B, M.lot), B, [W2(-w / 2, -d / 2), W2(w / 2, -d / 2), W2(w / 2, d / 2), W2(-w / 2, d / 2)], { lift: 0.06, step: 6, uv: 6 });
  // stall lines
  const pa = N(B, M.paint);
  for (let lz = -d / 2 + 4; lz < d / 2 - 3; lz += 7) {
    for (let lx = -w / 2 + 0.8; lx < w / 2 - 0.5; lx += 2.8) {
      const [px, pz] = W2(lx, lz);
      decal(pa, px, B.groundY(px, pz) + 0.09, pz, 0.12, 4.8, ry);
    }
  }
  const body = N(B, M.paintCar), glass = N(B, M.glass);
  for (const [lx, lz, a, seed] of it.cars) {
    const [px, pz] = W2(lx + 1.4, lz);
    body.col = carColor(seed);
    car(body, glass, px, B.groundY(px, pz), pz, ry + a);
  }
  body.col = [1, 1, 1];
  // a light pole in the middle (unless a pier stands there)
  if (it.pole) {
    A(B, M.pole).cyl(x, gy, z, 0.18, 7, 6, 0.12);
    A(B, M.ledG).box(x, gy + 6.9, z, 1.2, 0.2, 0.5, ry);
  }
}

function carColor(seed) {
  const C = [[0.75, 0.75, 0.78], [0.08, 0.08, 0.1], [0.6, 0.06, 0.06], [0.1, 0.2, 0.5], [0.9, 0.9, 0.88], [0.3, 0.32, 0.35], [0.12, 0.3, 0.2], [0.8, 0.6, 0.1]];
  return C[seed % C.length];
}

function drawGarage(B, it, M) {
  const { x, z, w, d, ry, gy, levels, lh } = it;
  const conc = A(B, M.concrete);
  const c = Math.cos(ry), s = Math.sin(ry);
  // floor slabs with spandrel walls, open between them, lit inside at night
  const deckTop = it.deckY ?? (gy + levels * lh);
  for (let k = 0; k <= levels; k++) {
    const y = gy + k * lh;
    if (y > deckTop - 0.2) break;
    walls(conc, x, y - 0.3, z, w, 1.15, d, ry, 2, 2);
    if (k > 0) {
      // the sodium tubes under each slab
      const L = A(B, M.ledG);
      for (let lz = -d / 2 + 4; lz < d / 2 - 2; lz += 8) {
        const px = x + lz * s, pz = z + lz * c;
        L.box(px, y - 0.45, pz, w - 4, 0.12, 0.3, ry);
      }
    }
  }
  // the dark inside (a box set back), columns at the corners, a stair tower
  walls(A(B, M.metal), x, gy, z, w - 1.4, deckTop - gy - 0.3, d - 1.4, ry, 4, 4);
  for (const [a, b] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
    conc.box(x + a * (w / 2 - 0.4) * c + b * (d / 2 - 0.4) * s, gy, z - a * (w / 2 - 0.4) * s + b * (d / 2 - 0.4) * c, 0.8, deckTop - gy, 0.8, ry);
  }
  const sx = x + (w / 2 - 3) * c, sz = z - (w / 2 - 3) * s;
  block(conc, sx, gy, sz, 6, deckTop - gy + (it.skypark ? 3.2 : 2.6), 6, ry, 2);
  if (it.skypark) {
    lid(conc, x, it.roofY, z, w, d, ry, 4);
    walls(conc, x, it.roofY, z, w, 1.1, d, ry, 2, 2);
    const body = N(B, M.paintCar);
    for (const [cx, cz, a, seed] of it.roofCarsW) {
      body.col = carColor(seed);
      car(body, N(B, M.glass), cx, it.roofY, cz, a);
    }
    body.col = [1, 1, 1];
  } else {
    lid(conc, x, gy + levels * lh + 0.85, z, w, d, ry, 4);
    const body = N(B, M.paintCar);
    for (const [lx, lz, a, seed] of it.roofCars) {
      body.col = carColor(seed);
      car(body, N(B, M.glass), x + lx * c + lz * s, gy + levels * lh + 0.85, z - lx * s + lz * c, ry + a);
    }
    body.col = [1, 1, 1];
  }
  // the P sign on the street face, the entrance
  const fx = Math.sin(ry), fz = Math.cos(ry);
  const sy = Math.min(deckTop - 4, gy + 9);
  panel(A(B, M.sign), x + fx * (d / 2 + 0.6) + c * (w * 0.3), sy, z + fz * (d / 2 + 0.6) - s * (w * 0.3), it.sign === 'skypark' ? 7 : 3.2, it.sign === 'skypark' ? 2.6 : 3.2, ry, M.uv(it.sign));
  panel(A(B, M.sign), x + fx * (d / 2 + 0.6) - c * (w * 0.32), gy + 5, z + fz * (d / 2 + 0.6) + s * (w * 0.32), 1.2, 4, ry, M.uv('parking'));
}

function drawHelicopter(B, it, M) {
  const { x, z, y, ry } = it;
  const c = Math.cos(ry), s = Math.sin(ry);
  decal(A(B, M.signPlain), x, y + 0.05, z, it.pad, it.pad, ry, M.uv('heli'));
  // a sleek little helicopter: body, tail boom, skids, rotor
  const b = A(B, M.paintCar);
  b.col = [0.12, 0.14, 0.2];
  blob(b, x, y + 1.7, z, 1.3, 1.1, 2.4, 8, 5);
  const tx = x - s * 5, tz = z - c * 5;
  b.beam(x - s * 1.5, y + 1.9, z - c * 1.5, tx, y + 2.4, tz, 0.35, 0.45);
  b.box(tx, y + 2.2, tz, 0.15, 1.6, 0.9, ry);
  b.col = [1, 1, 1];
  const m = A(B, M.metal);
  for (const sd of [-1, 1]) {
    const ox = c * sd * 1.1, oz = -s * sd * 1.1;
    m.beam(x + ox - s * 1.8, y + 0.2, z + oz - c * 1.8, x + ox + s * 1.8, y + 0.2, z + oz + c * 1.8, 0.12, 0.12);
  }
  m.cyl(x, y + 2.7, z, 0.15, 0.6, 5);
  for (const a of [0.4, 0.4 + Math.PI / 2]) {
    const ca = Math.cos(ry + a), sa = Math.sin(ry + a);
    m.beam(x - ca * 5, y + 3.3, z + sa * 5, x + ca * 5, y + 3.3, z - sa * 5, 0.3, 0.06);
  }
  A(B, M.blink).box(tx, y + 3.1, tz, 0.3, 0.3, 0.3);
}

function drawVault(B, it, M) {
  // (it.x, it.z) at the back building's face, ry facing out into the court
  const { x, z, gy, ry } = it;
  const fx = Math.sin(ry), fz = Math.cos(ry), lx = Math.cos(ry), lz = -Math.sin(ry);
  // a stairwell down to the door: a dark hole with railings, three steps
  decal(A(B, M.signPlain), x + fx * 2.2, gy + 0.04, z + fz * 2.2, 2.4, 3.6, ry + Math.PI, M.uv('stairs'));
  const m = N(B, M.metal);
  for (const sd of [-1, 1]) {
    const ax = x + lx * sd * 1.3, az = z + lz * sd * 1.3;
    m.beam(ax + fx * 0.3, gy + 1.0, az + fz * 0.3, ax + fx * 4.0, gy + 1.0, az + fz * 4.0, 0.07, 0.07);
    m.cyl(ax + fx * 4.0, gy, az + fz * 4.0, 0.05, 1.0, 5);
  }
  block(A(B, M.metal), x + fx * 0.1, gy - 0.4, z + fz * 0.1, 1.5, 2.6, 0.2, ry, 1);
  // the neon: an arch of pink over the door, a cocktail glass
  const neon = A(B, M.neon);
  neon.box(x + fx * 0.25, gy + 2.6, z + fz * 0.25, 2.6, 0.14, 0.14, ry);
  neon.box(x + fx * 0.25 - lx * 1.25, gy + 1.8, z + fz * 0.25 - lz * 1.25, 0.14, 1.6, 0.14, ry);
  neon.box(x + fx * 0.25 + lx * 1.25, gy + 1.8, z + fz * 0.25 + lz * 1.25, 0.14, 1.6, 0.14, ry);
  const gx = x + fx * 0.25 + lx * 2.6, gz = z + fz * 0.25 + lz * 2.6;
  neon.beam(gx - lx * 0.5, gy + 3.4, gz - lz * 0.5, gx, gy + 2.8, gz, 0.1, 0.1);
  neon.beam(gx + lx * 0.5, gy + 3.4, gz + lz * 0.5, gx, gy + 2.8, gz, 0.1, 0.1);
  neon.beam(gx - lx * 0.5, gy + 3.4, gz - lz * 0.5, gx + lx * 0.5, gy + 3.4, gz + lz * 0.5, 0.1, 0.1);
  neon.box(gx, gy + 2.2, gz, 0.1, 0.6, 0.1, ry);
  // crates and a poster on the wall
  const n = N(B, M.concrete);
  for (let k = 0; k < 4; k++) n.box(x - lx * (3 + k * 0.95) + fx * (1 + (k % 2) * 0.4), gy, z - lz * (3 + k * 0.95) + fz * (1 + (k % 2) * 0.4), 0.9, 0.85 + (k === 1 ? 0.85 : 0), 0.9, ry + k * 0.3);
  panel(A(B, M.sign), x + fx * 0.12 - lx * 3.4, gy + 1.5, z + fz * 0.12 - lz * 3.4, 0.8, 1.6, ry, M.uv('ad1'));
}

function drawDeckEnd(B, it, M) {
  const { x, z, y, ry, w } = it;
  block(A(B, M.concrete), x, y - 0.3, z, w, 1.4, 0.7, ry, 2);
  const c = Math.cos(ry), s = Math.sin(ry);
  for (let k = -2; k <= 2; k++) A(B, M.blink).box(x + c * k * w * 0.2, y + 1.15, z - s * k * w * 0.2, 0.3, 0.2, 0.3, ry);
}
