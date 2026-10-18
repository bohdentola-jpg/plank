// PORT HALCYON — THE WORKS: the old industrial waterfront south-east of
// downtown, where your garage is. Red-brick foundries and mills with tall
// arched windows and saw-tooth roofs, corrugated sheds with roll-up doors
// and loading docks, rooftop water tanks, chain-link and razor wire,
// graffiti, sodium floodlights over the yards, the odd neon sign (THE RIVET,
// across the street from your door; Krank's body shop next to it). Its
// landmarks: the FOUNDRY STACK (90 m of brick with its name down the side
// and red lights on top), HALCYON POWER STATION (disused, four white
// chimneys over the waterfront), the LOW LINE (an elevated freight line
// across the whole district on riveted steel bents, LOW LINE LANE under it)
// and the PORT RAIL YARD with its gantry crane. Hidden: the drag strip
// under the Low Line's last span (SPUR RD), and the boneyard at the end of
// CINDER ALLEY, an abandoned warehouse you can drive into.
import { COLS } from '../map/areas/city.js';
import { GARAGE } from '../map/base.js';
import { ROAD, ITEM, RESERVED } from './occ.js';
import { drape } from './builder.js';
import * as W from './eastend/wbuild.js';
import { frontLots } from './eastend/plan.js';
import { M, rgb, shade, Frame, boxW, chainFence, floodMast, glowBox, drum, pallets, skip, car, tree, warmNeighbours, drapePieces, STEP_MS } from './eastend/kit.js';
import { BK, METAL, tileUV } from './eastend/atlas.js';

const XS = COLS.slice(10);                                   // 340 … 1400: the Works' north–south streets
const ZS = [565, 715, 865, 1015, 1165, 1315, 1500];          // its east–west streets (every other row; Industrial Way)
const LOW_Z = 1240;                                          // the Low Line (and its lane)
const PI = Math.PI;

const BRICKS = ['#d88a72', '#c87a66', '#b87060', '#a87a6a', '#e0a080', '#9a6a5e', '#e8d4b0', '#c8c0b0', '#b8c0b0'];
const SHEDS = ['#c87a52', '#b85a48', '#7898c0', '#78a8a8', '#98b080', '#f0e8d0', '#d8dce0', '#ffffff', '#e0c070', '#8a9098', '#a8a8a0'];
const ROOFS = ['#7a7a78', '#6a6e72', '#8a6a52', '#5a6a5a', '#9a9a96'];
const FAR_BRICK = '#5a3428', FAR_SHED = '#5d6266';

// ------------------------------------------------------------------ helpers (plan)

/** The interior of a block round (cx, cz): out from the middle until the first road. */
function blockRect(P, cx, cz) {
  const probe = (dx, dz) => { for (let t = 0; t < 260; t += 1) if (P.occ.get(cx + dx * t, cz + dz * t) & ROAD) return t; return 260; };
  return { x0: cx - probe(-1, 0) + 0.6, x1: cx + probe(1, 0) - 0.6, z0: cz - probe(0, -1) + 0.6, z1: cz + probe(0, 1) - 0.6 };
}

/** A footprint against a block's side: face 'N'|'S'|'E'|'W' toward that street. */
function along(R, face, a0, a1, depth, inset = 0) {
  if (face === 'S') return { x: (a0 + a1) / 2, z: R.z1 - inset - depth / 2, w: a1 - a0, d: depth, ry: 0 };
  if (face === 'N') return { x: (a0 + a1) / 2, z: R.z0 + inset + depth / 2, w: a1 - a0, d: depth, ry: PI };
  if (face === 'E') return { x: R.x1 - inset - depth / 2, z: (a0 + a1) / 2, w: a1 - a0, d: depth, ry: PI / 2 };
  return { x: R.x0 + inset + depth / 2, z: (a0 + a1) / 2, w: a1 - a0, d: depth, ry: -PI / 2 };
}

function ground(P, o) {
  const g = P.groundRange(o.x, o.z, o.w, o.d, o.ry);
  o.y0 = g.lo - 1.2;
  o.yb = g.hi + 0.25;
  return o;
}

/** Bays across a front of width w (the builders lay facades the same way). */
const bays = (w, bw = 4) => Math.max(1, Math.round(w / bw));

/** A lamp over a door in bay i of a front (frame of the building). */
function doorLamp(P, o, i, bw, h, hex = '#ffb060') {
  const F = new Frame(o.x, o.z, o.ry);
  const n = bays(o.w, bw), lx = -o.w / 2 + (i + 0.5) * (o.w / n);
  const x = F.X(lx, o.d / 2), z = F.Z(lx, o.d / 2);
  const [dx, dz] = F.dir(0, 1);
  P.lamp({ x, z, hx: x + dx * 0.5, hz: z + dz * 0.5, hy: o.yb + h, color: hex, radius: 10, intensity: 0.9, halo: 1.3 });
}

function brickB(P, o) {
  o.type = 'brick';
  o.floors ??= 3; o.gh ??= 4.4; o.fh ??= 4; o.par ??= 1.1;
  o.tint ??= P.pick(BRICKS);
  o.win ??= 'arch';
  o.lit ??= 0.1;
  ground(P, o);
  P.claim(o.x, o.z, o.w, o.d, o.ry);
  const it = P.add({ ...o, map: 'building' });
  const top = W.brickTop(it);
  const h = top + (o.roof === 'saw' ? (o.rise || 3.6) : o.roof === 'gable' ? Math.min(o.w, o.d) * 0.22 : o.par) - o.y0;
  P.collider({ kind: 'box', x: o.x, z: o.z, hx: o.w / 2, hz: o.d / 2, ry: o.ry, y0: o.y0, y1: o.y0 + h });
  P.far({ x: o.x, z: o.z, y: o.y0, w: o.w, d: o.d, h, ry: o.ry, color: FAR_BRICK, lit: o.farLit ?? 0.08 });
  if (o.tower) {
    const F = new Frame(o.x, o.z, o.ry);
    P.far({ shape: 'cyl', x: F.X(...o.tower), z: F.Z(...o.tower), y: top + 6, r: 2.5, h: 5.2, color: '#4a3a2c' });
  }
  if (o.doors) for (const i of o.doors) doorLamp(P, it, i, o.bay || 4, 2.95);
  return it;
}

function shedB(P, o) {
  o.type = 'shed';
  o.h ??= 8;
  o.tint ??= P.pick(SHEDS);
  o.roofTint ??= P.pick(ROOFS);
  o.roof ??= P.pick(['gable', 'gable', 'low', 'barrel', 'mono']);
  o.lit ??= 0.12;
  ground(P, o);
  P.claim(o.x, o.z, o.w, o.d, o.ry);
  const it = P.add({ ...o, map: 'building' });
  const S = Math.min(o.w, o.d);
  const rise = o.roof === 'low' ? S * 0.08 : o.roof === 'barrel' ? S * 0.18 : o.roof === 'mono' ? S * 0.1 : S * 0.2;
  const h = o.yb + o.h + rise - o.y0;
  P.collider({ kind: 'box', x: o.x, z: o.z, hx: o.w / 2, hz: o.d / 2, ry: o.ry, y0: o.y0, y1: o.y0 + h });
  const c = rgb(o.tint);
  P.far({ x: o.x, z: o.z, y: o.y0, w: o.w, d: o.d, h: h - rise * 0.5, ry: o.ry, color: '#' + hex3(shade(c, 0.6)), lit: 0.04 });
  if (o.doors) for (const i of o.doors) doorLamp(P, it, i, 5, 2.75);
  if (o.canopy) {
    const F = new Frame(o.x, o.z, o.ry);
    const n = bays(o.w, 5), bw = o.w / n;
    for (let x = -o.w / 2 + o.canopy[0] * bw + 2; x < -o.w / 2 + (o.canopy[1] + 1) * bw; x += 12) {
      P.lamp({ x: F.X(x, o.d / 2 + 2.2), z: F.Z(x, o.d / 2 + 2.2), hy: o.yb + 5.5, color: '#ffb070', radius: 13, intensity: 0.9, halo: 1.6 });
    }
  }
  return it;
}

function hex3(c) {
  const f = (v) => Math.round(Math.pow(Math.max(0, Math.min(1, v)), 1 / 2.2) * 255).toString(16).padStart(2, '0');
  return f(c[0]) + f(c[1]) + f(c[2]);
}

function quonsetB(P, o) {
  o.type = 'quonset';
  o.tint ??= P.pick(['#a8a8a0', '#98a088', '#c8b8a0', '#8a9098']);
  ground(P, o);
  P.claim(o.x, o.z, o.w, o.d, o.ry);
  const it = P.add({ ...o, map: 'building' });
  P.collider({ kind: 'box', x: o.x, z: o.z, hx: o.w / 2, hz: o.d / 2, ry: o.ry, y0: o.y0, y1: o.yb + o.d / 2 });
  P.far({ x: o.x, z: o.z, y: o.y0, w: o.w, d: o.d * 0.8, h: o.yb + o.d * 0.4 - o.y0, ry: o.ry, color: '#6a6e68', lit: 0 });
  return it;
}

/** A yard: paved, cluttered, fenced along `fence` sides (local 'f','l','r','b'), a flood mast. */
function yardB(P, o) {
  const F = new Frame(o.x, o.z, o.ry);
  P.claim(o.x, o.z, o.w, o.d, o.ry);
  const hw = o.w / 2, hd = o.d / 2;
  const poly = [[-hw, -hd], [hw, -hd], [hw, hd], [-hw, hd]].map(([a, b]) => [F.X(a, b), F.Z(a, b)]);
  P.add({ type: 'lot', x: o.x, z: o.z, poly, kind: o.surface || 'lot', map: 'yard' });
  // clutter in rows down the sides, a lane clear up the middle
  const n = Math.floor(o.w * o.d / 90);
  for (let k = 0; k < n; k++) {
    const lx = (P.rng() - 0.5) * (o.w - 6), lz = (P.rng() - 0.5) * (o.d - 6);
    if (Math.abs(lx) < 4) continue;
    const x = F.X(lx, lz), z = F.Z(lx, lz);
    const r = P.rng();
    const ry = o.ry + (P.rng() < 0.7 ? 0 : PI / 2) + (P.rng() - 0.5) * 0.2;
    if (r < 0.18 && o.w > 16 && o.d > 18) {
      // a trailer or a container
      const t = P.rng() < 0.5 ? 'trailer' : 'box';
      if (!P.isFree(x, z, 3, 14, ry, { pad: 0.5 })) continue;
      P.claim(x, z, 3, 14, ry);
      if (t === 'trailer') P.add({ type: 'trailer', x, z, ry, tint: P.pick(SHEDS), cab: P.rng() < 0.3 ? P.pick(['#b02018', '#1d4fa8', '#e8e4d8', '#2a2a2c']) : null });
      else P.add({ type: 'boxes', x, z, ry: ry + PI / 2, cnt: 1, tiers: 1 + Math.floor(P.rng() * 2.4), len: P.rng() < 0.5 ? 6.1 : 12.2, cols: CONT, seed: P.rng() * 1e6 | 0 });
      P.collider({ kind: 'box', x, z, hx: 1.5, hz: 7, ry, y0: P.groundY(x, z) - 1, y1: P.groundY(x, z) + 4.2 });
    } else if (r < 0.62) {
      if (!P.isFree(x, z, 2.4, 2.4, ry, { pad: 0.2 })) continue;
      P.claim(x, z, 2.4, 2.4, ry);
      const kinds = ['pallets', 'pallets', 'drums', 'drums', 'skip', 'tyres', 'forklift'];
      const kind = P.pick(kinds);
      P.add({ type: 'prop', kind, x, z, ry, cnt: 2 + Math.floor(P.rng() * 6), seed: P.rng() * 1e6 | 0 });
      if (kind === 'skip' || kind === 'forklift') P.collider({ kind: 'box', x, z, hx: kind === 'skip' ? 1.7 : 0.6, hz: kind === 'skip' ? 0.9 : 1.2, ry, y0: P.groundY(x, z) - 1, y1: P.groundY(x, z) + 1.8 });
      else P.collider({ kind: 'circle', x, z, r: 0.8, y0: P.groundY(x, z) - 1, y1: P.groundY(x, z) + 1.2 });
    } else if (r < 0.7) {
      if (!P.isFree(x, z, 2.2, 4.6, ry, { pad: 0.3 })) continue;
      P.claim(x, z, 2.2, 4.6, ry);
      P.add({ type: 'car', x, z, ry, col: P.pick(CARS), wreck: P.rng() < 0.4 });
      P.collider({ kind: 'box', x, z, hx: 0.95, hz: 2.25, ry, y0: P.groundY(x, z) - 1, y1: P.groundY(x, z) + 1.5 });
    }
  }
  if (o.flood !== false && o.w * o.d > 900 && P.rng() < 0.6) {
    const lx = (P.rng() < 0.5 ? -1 : 1) * (hw - 1.2), lz = (P.rng() < 0.5 ? -1 : 1) * (hd - 1.2);
    const x = F.X(lx, lz), z = F.Z(lx, lz);
    flood(P, x, z, 10 + P.rng() * 3, P.rng() < 0.5 ? 1 : 2, o.ry + (lx > 0 ? PI / 2 : -PI / 2) + (lz > 0 ? 0 : PI) * 0);
  }
  for (const s of o.fence || []) fenceSide(P, F, o, s, o.gate === s);
}

const CONT = ['#b8452a', '#2a5a8a', '#3a7a4a', '#c8a030', '#8a8a86', '#7a3a2a', '#d8d4c8', '#2a3a5a'];
const CARS = ['#7a1a14', '#1a2a4a', '#c8c4b8', '#2a2a2c', '#5a5a5e', '#3a4a2a', '#8a6a2a', '#e8e4d8', '#2a4a5a', '#6a2a4a'];

/** A floodlight mast (sodium) with its light. */
function flood(P, x, z, h, heads, ry, col = '#ffa040', radius = 30) {
  const y = P.groundY(x, z);
  P.add({ type: 'flood', x, z, h, heads, ry, col });
  P.collider({ kind: 'circle', x, z, r: 0.25, y0: y - 1, y1: y + h });
  const [dx, dz] = [Math.sin(ry), Math.cos(ry)];
  P.lamp({ x, z, hx: x + dx * 2, hz: z + dz * 2, hy: y + h, color: col, radius, intensity: 1.15, halo: 3.2 });
}

/** Chain-link along one side of a footprint (local side 'f'|'b'|'l'|'r'), a gate gap in the middle if asked. */
function fenceSide(P, F, o, side, gate) {
  const hw = o.w / 2 - 0.3, hd = o.d / 2 - 0.3;
  const ends = { f: [[-hw, hd], [hw, hd]], b: [[hw, -hd], [-hw, -hd]], l: [[-hw, -hd], [-hw, hd]], r: [[hw, hd], [hw, -hd]] }[side];
  const [a, b] = ends;
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const pts = [];
  const n = Math.max(1, Math.round(len / 3));
  for (let k = 0; k <= n; k++) { const t = k / n; pts.push([F.X(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t), F.Z(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t)]); }
  const gaps = [];
  if (gate && n > 4) { const m = Math.floor(n / 2); gaps.push(m - 1, m); }
  fenceRun(P, pts, gaps);
}

/** Fence items and their colliders along a run of points. */
function fenceRun(P, pts, gaps = [], h = 3) {
  if (pts.length < 2) return;
  P.add({ type: 'fence', x: pts[0][0], z: pts[0][1], pts, gaps, h });
  for (let k = 0; k < pts.length - 1; k++) {
    if (gaps.includes(k)) continue;
    const [ax, az] = pts[k], [bx, bz] = pts[k + 1];
    const len = Math.hypot(bx - ax, bz - az);
    if (len < 0.2) continue;
    const y = P.groundY(ax, az);
    P.collider({ kind: 'box', x: (ax + bx) / 2, z: (az + bz) / 2, hx: len / 2, hz: 0.15, ry: -Math.atan2(bz - az, bx - ax), y0: y - 1, y1: y + h });
  }
}

/** A graffiti wall (with its collider). */
function gwallB(P, x, z, ry, w, h = 3.4) {
  P.claim(x, z, w, 0.8, ry);
  P.add({ type: 'gwall', x, z, ry, w, h, u0: P.rng() * 0.7 });
  const y = P.groundY(x, z);
  P.collider({ kind: 'box', x, z, hx: w / 2, hz: 0.25, ry, y0: y - 1, y1: y + h });
}

/** A lit sign on a building's front (frame o), centred at local x lx, bottom at height hb above its floor. */
function frontSign(P, o, lx, hb, w, h, key, light = null) {
  const F = new Frame(o.x, o.z, o.ry);
  const x = F.X(lx, o.d / 2 + 0.12), z = F.Z(lx, o.d / 2 + 0.12);
  P.add({ type: 'sign', x, z, ry: o.ry, y: o.yb + hb, w, h, key });
  if (light) {
    const [dx, dz] = F.dir(0, 1);
    P.lamp({ x, z, hx: x + dx * 1.2, hz: z + dz * 1.2, hy: o.yb + hb + h / 2, color: light, radius: 13, intensity: 1.0, halo: 1.2 });
  }
}

// ------------------------------------------------------------------ the plan

function plan(P) {
  const T = globalThis.__planTimes ? {} : null;
  let t = performance.now();
  const step = (name, fn) => { fn(P); if (T) { const n = performance.now(); T[name] = +(n - t).toFixed(1); t = n; } };
  step('hero', hero);
  step('lowLine', lowLine);
  step('power', powerStation);
  step('yard', railYard);
  step('tanks', tankFarm);
  step('salvage', salvage);
  step('bone', boneyard);
  step('spur', spur);
  step('blocks', blocks);
  step('fences', streetFences);
  if (T) globalThis.__planTimes.works = T;
}

// ---- Foundry St: across from your garage, and either side of it

function hero(P) {
  const fz = 715;                                   // Foundry St
  const nf = fz - 9.2, sf = fz + 9.2;               // fronts flush with its sidewalks
  // THE FOUNDRY hall (west of the bar): tall arched bays, a monitor roof, a big door
  brickB(P, { x: 655.5, z: nf - 30, w: 49, d: 60, ry: 0, floors: 1, hall: true, gh: 10.4, par: 1.4, tint: '#c07462', roof: 'monitor', lit: 0.3, cool: 0.6, hallDoor: 6, cornice: BK.dentil, farLit: 0.15 });
  // THE RIVET, right across the street from your door
  const bar = brickB(P, { x: 700, z: nf - 12.5, w: 30, d: 25, ry: 0, floors: 2, gh: 6.4, fh: 4.2, par: 1.2, tint: '#8a4a3e', front: 'bar', doors: [3], lit: 0.65, cool: 0, win: 'pair', cornice: BK.cornice, roof: 'flat' });
  frontSign(P, bar, 0, 4.25, 8, 2, 'rivet', '#ff2a3a');
  // the lot between the bar and the iron works: a graffiti wall at its back, cars
  P.claim(732, nf - 25, 32, 50, 0);
  P.add({ type: 'lot', x: 732, z: nf - 25, poly: [[716.5, nf - 50], [748, nf - 50], [748, nf], [716.5, nf]], kind: 'lot', map: 'yard' });
  gwallB(P, 732, nf - 49, 0, 30, 3.6);
  for (const [x, z, ry, c] of [[724, nf - 18, 0.1, '#7a1a14'], [740, nf - 22, -0.06, '#2a2a2c'], [731, nf - 33, PI / 2 + 0.1, '#c8c4b8']]) {
    P.add({ type: 'car', x, z, ry, col: c });
    P.collider({ kind: 'box', x, z, hx: 0.95, hz: 2.25, ry, y0: 4, y1: 7.6 });
  }
  flood(P, 746.5, nf - 47, 9, 1, -PI * 0.75);
  fenceRun(P, [[716.6, nf - 0.4], [722, nf - 0.4], [727, nf - 0.4]], []);
  fenceRun(P, [[739, nf - 0.4], [744, nf - 0.4], [748, nf - 0.4]], []);
  // HALCYON IRON WORKS: four floors, its name painted on the side you see from your door
  brickB(P, { x: 770.4, z: nf - 38, w: 40.8, d: 76, ry: 0, floors: 4, gh: 4.6, fh: 4, par: 1.2, tint: '#c47460', ghost: 'ghostIron', ghostSide: 'l', fire: [6], doors: [2, 8], tower: [8, -18], front: 'doors', lit: 0.14 });
  // the Foundry stack, and the boiler house at its foot
  stackB(P, 708, 628, 'stack', { letters: true, face: Math.atan2(736 - 628, 700 - 708) });
  brickB(P, { x: 697, z: 664, w: 20, d: 24, ry: 0, floors: 1, gh: 6.5, par: 0, tint: '#b06a58', roof: 'gable', front: 'blank', lit: 0.2, chimney: [-5, -6, 6] });
  // a shed along the street behind (z 565)
  shedB(P, { x: 668, z: 574.2 + 17, w: 64, d: 34, ry: PI, h: 7.5, tint: '#b85a48', roof: 'barrel', docks: [2, 4], doors: [9], lit: 0.1 });
  // YOUR GARAGE's block: auto parts and tyres to the west, Krank's to the east
  const parts = brickB(P, { x: 645, z: sf + 12, w: 30, d: 24, ry: PI, floors: 1, gh: 5.6, par: 1.3, tint: '#e8d4b0', front: 'shop', doors: [1], lit: 0.6, roof: 'flat', cornice: BK.coping });
  frontSign(P, parts, 0, 4.0, 10, 2.5, 'parts', '#7aa0ff');
  const tires = brickB(P, { x: 672.5, z: sf + 11, w: 21, d: 22, ry: PI, floors: 1, gh: 5.4, par: 1.0, tint: '#c8c0b0', front: 'garage', lit: 0.5, roof: 'flat', cornice: BK.coping });
  frontSign(P, tires, 0, 4.0, 7, 2.6, 'tires', '#ffd040');
  for (const [x, z, cnt] of [[664, sf + 25, 5], [667, sf + 26, 4], [680, sf + 25.5, 6], [683, sf + 24, 3]]) P.add({ type: 'prop', kind: 'tyres', x, z, cnt });
  const krank = brickB(P, { x: 738.5, z: sf + 14, w: 44, d: 28, ry: PI, floors: 2, gh: 6.2, fh: 4, par: 1.2, tint: '#d8d0c0', front: 'garage', lit: 0.55, cool: 0.6, roof: 'flat', doors: [1, 9], win: 'small' });
  frontSign(P, krank, 0, 4.2, 9, 2.25, 'body', '#ff3ab0');
  brickB(P, { x: 776.4, z: sf + 12, w: 28.8, d: 24, ry: PI, floors: 3, gh: 4.4, fh: 3.8, tint: '#a87a6a', front: 'doors', doors: [5], lit: 0.2, win: 'small', fire: [-2] });
  // behind them: the garage's back lot (cars waiting on parts), a Quonset hut
  P.add({ type: 'lot', x: 700, z: 790, poly: [[630, 766], [790, 766], [790, 815], [630, 815]], kind: 'lot', map: 'yard' });
  P.claim(700, 790, 160, 49, 0);
  for (let k = 0; k < 9; k++) {
    const x = 640 + k * 15 + P.rng() * 4, z = 776 + P.rng() * 4, ry = PI / 2 + (P.rng() - 0.5) * 0.3;
    if (Math.abs(x - 700) < 14) continue;
    P.add({ type: 'car', x, z, ry, col: P.pick(CARS), wreck: P.rng() < 0.5 });
    P.collider({ kind: 'box', x, z, hx: 0.95, hz: 2.25, ry, y0: 4, y1: 7.6 });
  }
  quonsetB(P, { x: 760, z: 800, w: 26, d: 13, ry: 0, tint: '#a8a8a0' });
  flood(P, 632, 767, 10, 2, PI * 0.25);
  fenceRun(P, [[629.8, 766], [629.8, 790], [629.8, 815]], []);
  fenceRun(P, [[790.2, 816], [790.2, 790], [790.2, 766]], []);
}

/** A tall brick chimney with its lights, collider and far shape. */
function stackB(P, x, z, key, o = {}) {
  const y0 = P.groundY(x, z) - 1;
  const it = { type: 'stack', x, z, y0, r0: 3.4, r1: 2.3, h: o.h || 92, base: 7, tint: '#b8705a', letters: !!o.letters, face: o.face || 0, lights: [0.5, 1] };
  P.claim(x, z, 10.5, 10.5, 0);
  P.add({ ...it, map: 'building' });
  P.collider({ kind: 'box', x, z, hx: 5, hz: 5, ry: 0, y0, y1: y0 + 8 });
  P.collider({ kind: 'circle', x, z, r: 3.5, y0, y1: y0 + it.h });
  P.far({ shape: 'box', x, z, y: y0, w: 10, d: 10, h: 8.6, color: '#6a3a2c' });
  P.far({ shape: 'cyl', x, z, y: y0 + 8.6, r: 3.4, r2: 2.3, h: it.h - 8.6, color: '#6a3a2c' });
  // floodlit from its foot (two lamps on the plinth's corners)
  for (const [dx, dz] of [[-6.5, 6.5], [6.5, 6.5]]) P.lamp({ x: x + dx, z: z + dz, hx: x + dx * 0.8, hz: z + dz * 0.8, hy: y0 + 2.5, color: '#ffc890', radius: 14, intensity: 0.55, halo: 1.4 });
  P.add({ type: 'flood', x: x - 6.5, z: z + 6.5, h: 2.2, heads: 1, ry: PI * 0.75, col: '#ffc080' });
  P.add({ type: 'flood', x: x + 6.5, z: z + 6.5, h: 2.2, heads: 1, ry: -PI * 0.75, col: '#ffc080' });
  // red lights: a far point and a halo (they don't light the ground)
  for (const t of [0.5, 1]) {
    const hy = y0 + 8.6 + (it.h - 8.6) * t;
    P.lamp({ x, z, hx: x, hz: z + 3, hy, color: '#ff2a18', radius: 1.5, intensity: 0.2, halo: t === 1 ? 6 : 4 });
  }
  P.landmark({ id: 'foundry_stack', name: 'FOUNDRY STACK', x, z, r: 40, kind: 'chimney' });
  return it;
}

// ---- the Low Line

function lowLine(P) {
  const z = LOW_Z, xA = 352, xB = 1497;
  const yd = P.groundY(900, z) + 8.6;
  // where the streets cross under it (no columns there)
  const blocked = [];
  let inB = false, b0 = 0;
  for (let x = xA; x <= xB; x += 0.5) {
    const hit = P.occ.hitDisc(x, z - 5.4, 0.8, ROAD) || P.occ.hitDisc(x, z + 5.4, 0.8, ROAD);
    if (hit && !inB) { inB = true; b0 = x; }
    if (!hit && inB) { inB = false; blocked.push([b0, x]); }
  }
  if (inB) blocked.push([b0, xB]);
  // columns: just clear of each crossing, evenly between
  const cols = [];
  let prev = xA + 3;
  const free = [];
  for (const [a, b] of blocked) { free.push([prev, a - 1.2]); prev = b + 1.2; }
  free.push([prev, xB - 4]);
  for (const [a, b] of free) {
    if (b - a < 1) continue;
    const n = Math.max(1, Math.round((b - a) / 12.5));
    for (let k = 0; k <= n; k++) cols.push(a + (b - a) * (k / n));
  }
  // claim the strip under it (nothing gets built under the line), columns solid
  for (const [a, b] of free) P.claim((a + b) / 2, z, b - a + 2.4, 15, 0);
  const yg = (x) => P.groundY(x, z);
  for (const x of cols) for (const sd of [1, -1]) P.collider({ kind: 'box', x, z: z + sd * 5.4, hx: 0.38, hz: 0.38, ry: 0, y0: yg(x) - 1, y1: yd });
  // the abutments at both ends
  for (const ax of [xA + 2, xB - 2]) P.collider({ kind: 'box', x: ax, z, hx: 2.1, hz: 6, ry: 0, y0: yg(ax) - 1, y1: yd + 1 });
  // lamps hung under every third bent, plates over the streets
  const lamps = cols.filter((x, k) => k % 3 === 1);
  for (const x of lamps) P.lamp({ x, z, hx: x, hz: z, hy: yd - 4.7, color: '#ffa040', radius: 17, intensity: 1.0, halo: 1.8 });
  const plates = blocked.map(([a, b]) => ({ x: (a + b) / 2, k: 'lowline', w: 8 }));
  for (let x = xA + 80; x < xB - 40; x += 210) plates.push({ x, k: 'belt', w: 6.5 });
  // one run per half cell
  const cuts = [xA];
  for (let c = Math.ceil(xA / 128) * 128; c < xB; c += 128) if (c - cuts[cuts.length - 1] > 20) cuts.push(c);
  cuts.push(xB);
  for (let k = 0; k < cuts.length - 1; k++) {
    const x0 = cuts[k], x1 = cuts[k + 1];
    P.add({
      type: 'el', x: (x0 + x1) / 2, z, x0, x1, yd,
      cols: cols.filter((x) => x >= x0 && x < x1).map((x) => [x, yg(x)]),
      abut: k === 0 ? 'w' : k === cuts.length - 2 ? 'e' : null, abutY: k === 0 ? yg(xA) : yg(xB),
      lamps: lamps.filter((x) => x >= x0 && x < x1),
      plates: plates.filter((p) => p.x >= x0 && p.x < x1),
      seed: k * 977 + 13, map: 'track',
    });
  }
  P.far({ x: (xA + xB) / 2, z, y: yd - 2.6, w: xB - xA, d: 10.4, h: 3.8, ry: 0, color: '#2e3833' });
  for (const x of cols.filter((x, k) => k % 2 === 0)) for (const sd of [1, -1]) P.far({ x, z: z + sd * 5.4, y: yg(x) - 1, w: 0.7, d: 0.7, h: yd - yg(x) - 1.6, color: '#2e3833' });
  // a train of boxcars parked up on it, long forgotten
  const cars = ['box', 'box', 'tank', 'box', 'hopper'];
  let cx = 882;
  for (let k = 0; k < cars.length; k++) {
    P.add({ type: 'railcar', x: cx, z: z + 1.9, ry: PI / 2, y: yd + 0.2, kind: cars[k], tint: P.pick(['#7a3a2a', '#5a4a3a', '#3a4a5a', '#2a2a2a', '#6a2a1a']), len: 15 });
    cx += 16.2;
  }
  P.landmark({ id: 'low_line', name: 'THE LOW LINE', x: 760, z, r: 60, kind: 'rail' });
}

// ---- the power station

function powerStation(P) {
  const x = 900, z = 1590, ry = PI, hw = 108, hd = 34, bd = 50, D = hd + bd;
  if (!P.isFree(x, z, hw, D, ry, { pad: 0 })) return;
  const o = ground(P, { x, z, w: hw, d: D, ry });
  P.claim(x, z, hw + 4, D + 4, ry);
  // its grounds: the forecourt to Industrial Way, the coal yard behind
  const R = blockRect(P, x, 1530);
  P.claim((R.x0 + R.x1) / 2, (R.z0 + 1719) / 2, R.x1 - R.x0, 1719 - R.z0, 0);
  const chimneys = [[-(hw / 2 - 10), bd / 2 - 8], [hw / 2 - 10, bd / 2 - 8], [-(hw / 2 - 10), -(bd / 2 - 8)], [hw / 2 - 10, -(bd / 2 - 8)]];
  const ch = 50;
  P.add({ type: 'power', x, z, ry, w: hw, d: D, hw, hd, bd, D, y0: o.y0, yb: o.yb, chimneys, ch, map: 'building' });
  P.collider({ kind: 'box', x, z, hx: hw / 2 + 1, hz: D / 2, ry, y0: o.y0, y1: o.yb + 45 });
  const F = new Frame(x, z, ry);
  const Fh = { x: F.X(0, D / 2 - hd / 2), z: F.Z(0, D / 2 - hd / 2) }, Fb = new Frame(F.X(0, -D / 2 + bd / 2), F.Z(0, -D / 2 + bd / 2), ry);
  P.far({ x: Fh.x, z: Fh.z, y: o.y0, w: hw, d: hd, h: o.yb + 25.6 - o.y0, ry, color: '#5a3026', lit: 0.03 });
  P.far({ x: Fb.x, z: Fb.z, y: o.y0, w: hw - 4, d: bd, h: o.yb + 39.6 - o.y0, ry, color: '#5a3026', lit: 0.02 });
  for (const [cx, cz] of chimneys) {
    const wx = Fb.X(cx, cz), wz = Fb.Z(cx, cz);
    P.far({ shape: 'cyl', x: wx, z: wz, y: o.yb + 43, r: 4.2, r2: 3.3, h: ch, color: '#d8d4c8' });
    P.lamp({ x: wx, z: wz, hx: wx, hz: wz + 3.6, hy: o.yb + 43 + ch - 0.4, color: '#ff2a18', radius: 1.5, intensity: 0.2, halo: 5.5 });
  }
  // the coal bunker at the end of the conveyor
  const bx = F.X(hw / 2 + 26, -D / 2 + 10), bz = F.Z(hw / 2 + 26, -D / 2 + 10);
  P.claim(bx, bz, 9, 9, ry);
  P.collider({ kind: 'box', x: bx, z: bz, hx: 4.2, hz: 4.2, ry, y0: o.y0, y1: o.yb + 9 });
  // the forecourt: fenced along Industrial Way, the gate chained, DANGER signs
  const fz = 1500 + 13.4;
  fenceRun(P, [[810, fz], [830, fz], [850, fz], [870, fz], [890, fz]], []);
  fenceRun(P, [[910, fz], [930, fz], [950, fz], [970, fz], [990, fz]], []);
  for (const sx of [884, 916]) P.add({ type: 'sign', x: sx, z: fz - 0.2, ry: PI, y: P.groundY(sx, fz) + 1.2, w: 1.4, h: 1.4, key: 'danger', posts: 1 });
  P.add({ type: 'lot', x, z: 1530, poly: [[812, 1516], [988, 1516], [988, 1546], [812, 1546]], kind: 'pave', map: 'yard' });
  flood(P, 812, 1518, 12, 2, PI * 0.8);
  flood(P, 988, 1518, 12, 2, -PI * 0.8);
  P.landmark({ id: 'power_station', name: 'HALCYON POWER STATION', x, z, r: 90, kind: 'power' });
}

// ---- the rail yard

function railYard(P) {
  const xA = 1012, xB = 1450;
  const runs = [1527, 1532, 1537, 1542];       // through tracks
  const load = [1566, 1571];                   // loading tracks under the gantry
  const tracks = [...runs, ...load];
  // the stubs it crosses (level crossings)
  const crossAt = [1200, 1400];
  for (const tz of tracks) {
    // one item per cell along the track
    const cuts = [xA, 1024, 1280, xB];
    for (let k = 0; k < cuts.length - 1; k++) {
      const x0 = Math.max(xA, cuts[k]), x1 = Math.min(xB, cuts[k + 1]);
      if (x1 - x0 < 2) continue;
      const cross = crossAt.filter((cx) => cx > x0 - 12 && cx < x1 + 12).map((cx) => [cx - 9.6 - x0, cx + 9.6 - x0]);
      P.add({ type: 'track', x: (x0 + x1) / 2, z: tz, pts: [[x0, tz], [x1, tz]], cross, roadY: P.groundY(1200, tz) + 0.14, map: 'track' });
    }
    P.claim((xA + xB) / 2, tz, xB - xA, 4, 0);
    // buffer stops at both ends
    for (const bx of [xA + 0.6, xB - 0.6]) P.collider({ kind: 'box', x: bx, z: tz, hx: 0.5, hz: 1.4, ry: 0, y0: P.groundY(bx, tz) - 1, y1: P.groundY(bx, tz) + 1.4 });
  }
  // crossbucks at the level crossings
  for (const cx of crossAt) for (const [dx, dz, ry] of [[-10.6, 1520, PI], [10.6, 1578, 0]]) {
    P.add({ type: 'xing', x: cx + dx, z: dz, ry: ry + PI / 2 });
    P.collider({ kind: 'circle', x: cx + dx, z: dz, r: 0.3, y0: 4, y1: 10 });
  }
  // freight cars along the tracks (gaps where you can see through)
  const kinds = ['box', 'box', 'tank', 'hopper', 'gondola', 'flat', 'box'];
  const tints = ['#7a3a2a', '#5a4a3a', '#3a4a5a', '#2a2a2a', '#6a2a1a', '#8a6a3a', '#2a4a3a', '#c8c0a8'];
  for (const tz of tracks) {
    let x = xA + 8 + P.rng() * 30;
    while (x < xB - 10) {
      if (P.rng() < 0.3) { x += 20 + P.rng() * 40; continue; }
      const len = 15;
      if (crossAt.some((c) => Math.abs(x - c) < 18)) { x += 8; continue; }
      const kind = P.pick(kinds);
      const y = P.groundY(x, tz) + 0.3;
      P.add({ type: 'railcar', x, z: tz, ry: PI / 2, y, kind, tint: P.pick(tints), len, boxes: 1 + (P.rng() < 0.5 ? 1 : 0), tints: [P.pick(CONT), P.pick(CONT)] });
      P.collider({ kind: 'box', x, z: tz, hx: len / 2, hz: 1.5, ry: 0, y0: y - 1, y1: y + 4.6 });
      if (P.rng() < 0.4) P.far({ x, z: tz, y, w: len, d: 3, h: 4.4, color: '#4a3a30' });
      x += len + 1.2;
    }
  }
  // the gantry crane over the loading tracks and the container stacks
  const gx = 1310, gz = 1574.5, span = 35;
  P.add({ type: 'gantry', x: gx, z: gz, span, h: 22, map: 'building' });
  for (const sz of [-1, 1]) for (const sx of [-1, 1]) P.collider({ kind: 'circle', x: gx + sx * 5.5, z: gz + sz * span / 2, r: 1.0, y0: 4, y1: 30 });
  P.far({ x: gx, z: gz, y: P.groundY(gx, gz) + 20, w: 3.2, d: span + 9, h: 3, color: '#a87a20' });
  for (const sz of [-1, 1]) P.far({ x: gx, z: gz + sz * span / 2, y: P.groundY(gx, gz), w: 9, d: 1.4, h: 20, color: '#a87a20' });
  for (let k = 0; k < 6; k++) {
    const x = 1226 + k * 26, z = 1584;
    if (Math.abs(x - gx) < 7) continue;
    if (!P.isFree(x, z, 13, 14, 0, { pad: 0.5 })) continue;
    P.claim(x, z, 13, 14, 0);
    const tiers = 2 + Math.floor(P.rng() * 3);
    P.add({ type: 'boxes', x, z, ry: PI / 2, cnt: 5, tiers, len: 12.2, cols: CONT, seed: k * 31 + 7 });
    P.collider({ kind: 'box', x, z, hx: 6.5, hz: 6.6, ry: 0, y0: 4, y1: 4 + tiers * 2.6 + 1 });
    P.far({ x, z, y: P.groundY(x, z), w: 13, d: 13, h: tiers * 2.6, color: '#6a4a3a' });
  }
  // the yard office and signal tower
  brickB(P, { x: 1080, z: 1594, w: 14, d: 10, ry: PI, floors: 2, gh: 4, fh: 3.6, tint: '#c8b8a0', front: 'doors', doors: [1], lit: 0.8, cool: 0.7, win: 'small', roof: 'gable' });
  P.add({ type: 'sign', x: 1080, z: 1515.5, ry: PI, y: P.groundY(1080, 1515) + 3.2, w: 9, h: 2.25, key: 'yard', posts: 2 });
  // fenced along Industrial Way, floods over the tracks
  const fz = 1500 + 13.6;
  fenceRun(P, [[1011, fz], [1030, fz], [1050, fz], [1070, fz]], []);
  fenceRun(P, [[1090, fz], [1110, fz], [1130, fz], [1150, fz], [1170, fz], [1188.5, fz]], []);
  fenceRun(P, [[1211.5, fz], [1240, fz], [1270, fz], [1300, fz], [1330, fz], [1360, fz], [1388.5, fz]], []);
  for (const [x, z] of [[1030, 1555], [1160, 1555], [1250, 1556], [1380, 1555], [1110, 1600]]) flood(P, x, z, 18, 3, 0, '#ffa850', 40);
  P.landmark({ id: 'rail_yard', name: 'PORT RAIL YARD', x: 1230, z: 1560, r: 120, kind: 'yard' });
}

// ---- the tank farm (the east edge, up by Eastside)

function tankFarm(P) {
  const xs = [1434, 1476], zs = [614, 668, 722, 776];
  P.add({ type: 'lot', x: 1455, z: 710, poly: [[1411, 574], [1499, 574], [1499, 846], [1411, 846]], kind: 'pave', map: 'yard' });
  let k = 0;
  for (const z of zs) for (const x of xs) {
    const r = 15 + P.rng() * 1.5, h = 11 + P.rng() * 6;
    if (!P.isFree(x, z, r * 2, r * 2, 0, { pad: 0 })) continue;
    const y0 = P.groundY(x, z) - 0.3;
    P.claim(x, z, r * 2 + 1, r * 2 + 1, 0);
    P.add({ type: 'tank', x, z, r, h, y0, tint: P.pick(['#e8e6e0', '#d8d8d4', '#c8ccd0', '#e0d8c4', '#b8b4ac']), map: 'building' });
    P.collider({ kind: 'circle', x, z, r: r + 0.6, y0, y1: y0 + h + 2 });
    P.far({ shape: 'cyl', x, z, y: y0, r, h, color: '#9a9a96' });
    if (k++ % 3 === 0) P.lamp({ x, z, hx: x + r * 0.7, hz: z + r * 0.7, hy: y0 + h + 1.5, color: '#ffa040', radius: 18, intensity: 0.9, halo: 2.2 });
  }
  // fence along the street (x 1400) and the two Eastside links
  fenceRun(P, [[1410.4, 575], [1410.4, 600], [1410.4, 640], [1410.4, 680], [1410.4, 720], [1410.4, 760], [1410.4, 800], [1410.4, 845]], [3]);
  fenceRun(P, [[1499.4, 574], [1499.4, 620], [1499.4, 680], [1499.4, 740], [1499.4, 800], [1499.4, 845]], []);
  flood(P, 1455, 694, 14, 3, 0);
  flood(P, 1455, 750, 14, 3, PI);
}

// ---- the salvage yard (north-east block, on Foundry St)

function salvage(P) {
  const R = blockRect(P, 1300, 640);
  if (R.x1 - R.x0 < 60) return;
  // the office at the Foundry St corner, the rest behind a corrugated fence
  const off = brickB(P, { ...along(R, 'S', R.x0, R.x0 + 26, 18), floors: 1, gh: 4.6, par: 1, tint: '#c8c0b0', front: 'shop', doors: [2], lit: 0.5, roof: 'flat', cornice: BK.coping });
  void off;
  const x0 = R.x0 + 28, x1 = R.x1 - 1, z0 = R.z0 + 1, z1 = R.z1 - 0.5;
  P.claim((x0 + x1) / 2, (z0 + z1) / 2, x1 - x0, z1 - z0, 0);
  P.add({ type: 'lot', x: (x0 + x1) / 2, z: (z0 + z1) / 2, poly: [[x0, z0], [x1, z0], [x1, z1], [x0, z1]], kind: 'dirt', map: 'yard' });
  P.add({ type: 'sfence', x: (x0 + x1) / 2, z: z1, pts: [[x0, z1], [x1, z1], [x1, z0], [x0, z0], [x0, z1]], gaps: [0], tint: '#5a7a6a' });
  const segs = [[[x0 + 12, z1], [x1, z1]], [[x1, z1], [x1, z0]], [[x1, z0], [x0, z0]], [[x0, z0], [x0, z1]]];
  for (const [[ax, az], [bx, bz]] of segs) {
    const len = Math.hypot(bx - ax, bz - az);
    P.collider({ kind: 'box', x: (ax + bx) / 2, z: (az + bz) / 2, hx: len / 2, hz: 0.2, ry: -Math.atan2(bz - az, bx - ax), y0: 4, y1: 9 });
  }
  P.add({ type: 'sign', x: (x0 + x1) / 2 + 20, z: z1 + 0.35, ry: 0, y: P.groundY(1300, z1) + 2.6, w: 12, h: 2.25, key: 'salvage' });
  // car piles in rows, the crane over one of them, a crusher
  for (let row = 0; row < 3; row++) {
    for (let k = 0; k < 4; k++) {
      const x = x0 + 20 + k * 32 + (P.rng() - 0.5) * 6, z = z0 + 20 + row * 38 + (P.rng() - 0.5) * 6;
      if (x > x1 - 12) continue;
      const n = 3 + Math.floor(P.rng() * 3), tiers = 3 + Math.floor(P.rng() * 4);
      const ry = (P.rng() - 0.5) * 0.3;
      P.add({ type: 'carpile', x, z, ry, cnt: n, tiers, seed: row * 97 + k * 13 });
      P.collider({ kind: 'box', x, z, hx: n * 1.0 + 0.4, hz: 2.4, ry, y0: 4, y1: 4 + tiers * 0.62 + 2 });
      P.far({ x, z, y: P.groundY(x, z), w: n * 2, d: 4.4, h: tiers * 0.6, ry, color: '#4a3a32' });
    }
  }
  const cx = x0 + 52, cz = z0 + 77;
  P.add({ type: 'crane', x: cx, z: cz, ry: 0.6, boom: 24 });
  P.collider({ kind: 'box', x: cx, z: cz, hx: 2.4, hz: 3.4, ry: 0.6, y0: 4, y1: 10 });
  P.far({ x: cx, z: cz, y: 6, w: 4, d: 6, h: 18, ry: 0.6, color: '#8a6a20' });
  flood(P, x0 + 4, z0 + 4, 12, 2, PI * 0.75);
  flood(P, x1 - 4, z1 - 4, 12, 2, -PI * 0.25);
}

// ---- the boneyard (hidden: at the end of Cinder Alley)

function boneyard(P) {
  const x0 = 1297, x1 = 1390.4, z0 = 1026.4, z1 = 1153.8;
  if (!P.isFree((x0 + x1) / 2, (z0 + z1) / 2, x1 - x0, z1 - z0, 0, { pad: 0 })) return;
  P.claim((x0 + x1) / 2, (z0 + z1) / 2, x1 - x0, z1 - z0, 0);
  P.add({ type: 'lot', x: (x0 + x1) / 2, z: (z0 + z1) / 2, poly: [[x0, z0], [x1, z0], [x1, z1], [x0, z1]], kind: 'dirt', map: 'yard' });
  // the fence all round, broken open where the alley ends
  const fpts = (a, b, n) => Array.from({ length: n + 1 }, (_, k) => [a[0] + (b[0] - a[0]) * k / n, a[1] + (b[1] - a[1]) * k / n]);
  fenceRun(P, fpts([x0, 1094.6], [x0, z1], 16), []);
  fenceRun(P, fpts([x0, z1], [x1, z1], 24), [9]);
  fenceRun(P, fpts([x1, z1], [x1, z0], 32), []);
  fenceRun(P, fpts([x1, z0], [x0, z0], 24), []);
  fenceRun(P, fpts([x0, z0], [x0, 1085.4], 15), []);
  P.add({ type: 'sign', x: x0 - 0.3, z: 1082, ry: -PI / 2, y: P.groundY(x0, 1082) + 1.0, w: 2.2, h: 1.1, key: 'noentry' });
  // the warehouse: steel portals at 8 m, what's left of its cladding
  const bx = 1346, bz = 1090, w = 40, d = 96, h = 9;
  const g = P.groundRange(bx, bz, w, d, 0);
  const n = Math.round(d / 8);
  const fallen = [4, 5, 9];
  const holes = [2, 7, 10];
  const walls = [];
  for (let k = 0; k < n; k++) for (const sd of [1, -1]) {
    const r = P.rng();
    if ((sd < 0 && (k === 3 || k === 6 || k === 7)) || r < 0.3) continue;      // the open bays you drive in by
    walls.push([k, sd, r < 0.6 ? h : h * (0.4 + P.rng() * 0.5)]);
  }
  P.add({ type: 'bone', x: bx, z: bz, w, d, ry: 0, yb: g.hi + 0.05, h, fallen, holes, walls, map: 'building' });
  for (let k = 0; k <= n; k++) for (const sx of [-1, 1]) {
    if (fallen.includes(k) && sx < 0) continue;
    P.collider({ kind: 'circle', x: bx + sx * w / 2, z: bz - d / 2 + (k / n) * d, r: 0.4, y0: g.lo - 1, y1: g.hi + h });
  }
  for (const [k, sd, hgt] of walls) P.collider({ kind: 'box', x: bx + sd * w / 2, z: bz - d / 2 + (k + 0.5) * d / n, hx: 0.2, hz: d / n / 2, ry: 0, y0: g.lo - 1, y1: g.hi + hgt });
  P.far({ x: bx, z: bz, y: g.lo, w, d, h: h * 0.8, color: '#4a3a30' });
  // inside and round it: a burned-out car, a fire in a drum, tyres, graffiti
  const stuff = [['car', 1338, 1074, 0.4], ['car', 1352, 1112, 2.6], ['fire', 1344, 1095, 0], ['tyres', 1331, 1060, 0], ['tyres', 1366, 1120, 0], ['car', 1312, 1135, 1.2], ['skip', 1378, 1040, 0.2]];
  for (const [k, x, z, ry] of stuff) {
    if (k === 'car') { P.add({ type: 'car', x, z, ry, col: '#2a2420', wreck: true }); P.collider({ kind: 'box', x, z, hx: 0.95, hz: 2.25, ry, y0: 4, y1: 7.5 }); }
    else if (k === 'fire') {
      P.add({ type: 'fire', x, z });
      P.collider({ kind: 'circle', x, z, r: 0.45, y0: 4, y1: 7.2 });
      P.lamp({ x, z, hx: x, hz: z, hy: P.groundY(x, z) + 1.6, color: '#ff8a30', radius: 11, intensity: 1.1, halo: 2.2 });
    } else if (k === 'tyres') P.add({ type: 'prop', kind: 'tyres', x, z, cnt: 4 });
    else { P.add({ type: 'prop', kind: 'skip', x, z, ry }); P.collider({ kind: 'box', x, z, hx: 1.7, hz: 0.9, ry, y0: 4, y1: 7.5 }); }
  }
  gwallB(P, 1310, 1048, PI / 2, 16, 3.2);
  gwallB(P, 1380, 1140, -PI / 2, 14, 3.2);
  P.landmark({ id: 'boneyard', name: 'THE BONEYARD', x: bx, z: bz, r: 60, kind: 'yard', hidden: true });
}

// ---- Spur Rd: the drag strip down the east edge

function spur(P) {
  const x = 1458;
  // start line and the quarter-mile mark, burnt rubber in between
  P.add({ type: 'decal', x, z: 1150, kind: 'start' });
  P.add({ type: 'decal', x, z: 1150 + 402, kind: 'finish' });
  // spectators' cars along the east side near the bridge
  for (let k = 0; k < 7; k++) {
    const z = 1262 + k * 7.2 + P.rng() * 2, cx = 1470.5 + P.rng() * 1.2, ry = (P.rng() < 0.5 ? 0 : PI) + (P.rng() - 0.5) * 0.25;
    if (!P.isFree(cx, z, 2.2, 4.6, ry, { pad: 0.2 })) continue;
    P.claim(cx, z, 2.2, 4.6, ry);
    P.add({ type: 'car', x: cx, z, ry, col: P.pick(['#c81e1e', '#e8e4d8', '#1a1a1a', '#e8c020', '#2a5ac8', '#3ac83a']), lights: P.rng() < 0.5 });
    P.collider({ kind: 'box', x: cx, z, hx: 0.95, hz: 2.25, ry, y0: 4, y1: 7.6 });
  }
  flood(P, 1467, 1252, 10, 2, -PI * 0.5);
  flood(P, 1467, 1316, 10, 1, -PI * 0.5);
  for (const z of [1000, 1090, 1150, 1400, 1552]) flood(P, 1466, z, 9, 1, -PI * 0.5, '#ff9a3a', 24);
  P.landmark({ id: 'low_line_drag', name: 'UNDER THE LOW LINE', x, z: LOW_Z, r: 50, kind: 'drag', hidden: true });
}

// ---- everything else: buildings along the streets, sheds and yards inside

function blocks(P) {
  // brick along Foundry St and the old north-west quarter; sheds further south and east
  const old = (x, z) => z < 880 || x < 640;
  const tb = performance.now();
  const lots = frontLots(P, {
    roads: (r) => r.rt.id === 'street' || r.rt.id === 'avenue',
    width: (P2) => (P2.rng() < 0.35 ? P2.range(16, 26) : P2.range(28, 64)),
    depth: [16, 44], gap: [1, 12], setback: [0, 0.3], pad: 0.6, ends: 4,
  });
  if (globalThis.__planTimes) globalThis.__planTimes.lots = performance.now() - tb;
  for (const L of lots) {
    const o = { x: L.x, z: L.z, w: L.w, d: L.d, ry: L.ry };
    const r = P.rng(), isOld = old(L.x, L.z);
    const ind = L.road.rt.id === 'avenue';
    if (L.w < 26) {
      if (r < 0.12) quonsetB(P, { ...o, d: Math.min(o.d, 16), w: Math.max(o.w, 12) });
      else if (r < 0.22 && L.d > 20) yardB(P, { ...o, fence: ['f'], gate: 'f' });
      else brickB(P, { ...o, floors: 1 + Math.floor(P.rng() * (isOld ? 3.4 : 2.2)), front: P.pick(['doors', 'garage', 'loading', 'shop', 'blank']), doors: P.rng() < 0.6 ? [Math.floor(bays(L.w) / 2)] : null, win: P.pick(['arch', 'arch', 'pair', 'small']), roof: P.rng() < 0.2 ? 'gable' : 'flat', tower: P.rng() < 0.08 && L.w > 18 ? [0, -L.d / 4] : null, fire: P.rng() < 0.2 ? [0] : null });
    } else if (isOld ? r < 0.55 : r < 0.25) {
      const floors = 2 + Math.floor(P.rng() * 4);
      brickB(P, {
        ...o, floors, front: P.pick(['doors', 'loading', 'loading', 'blank']), doors: [1, bays(L.w) - 2].filter((i, k) => k === 0 || P.rng() < 0.5),
        win: P.pick(['arch', 'arch', 'arch', 'pair']), state: P.rng() < 0.18 ? 'derelict' : 'ok',
        roof: floors <= 2 && P.rng() < 0.45 ? 'saw' : 'flat', tower: floors >= 3 && P.rng() < 0.4 ? [(P.rng() - 0.5) * L.w * 0.5, -L.d / 4] : null,
        ghost: floors >= 3 && P.rng() < 0.3 ? P.pick(['ghostCold', 'ghostSoap', 'ghostIron']) : null, ghostSide: P.pick(['l', 'r']),
        fire: floors >= 3 && P.rng() < 0.35 ? [(P.rng() - 0.5) * (L.w - 10)] : null,
        chimney: P.rng() < 0.15 ? [(P.rng() - 0.5) * L.w * 0.6, -L.d * 0.3, 6 + P.rng() * 10] : null,
      });
    } else if (r < (isOld ? 0.7 : 0.4) && L.w >= 32) {
      // a saw-tooth shed (brick walls), single storey
      brickB(P, { ...o, floors: 1, gh: 6 + P.rng() * 2, roof: 'saw', front: P.pick(['loading', 'doors']), doors: [1], tint: P.pick(BRICKS), lit: 0.15, state: P.rng() < 0.15 ? 'derelict' : 'ok' });
    } else {
      const n = bays(L.w, 5);
      const docks = ind || P.rng() < 0.5 ? [1, 2, 3].filter((i) => i < n - 1) : null;
      shedB(P, { ...o, h: 7 + P.rng() * 4, docks, doors: [n - 1], office: P.rng() < 0.4 ? [0] : null, canopy: docks && P.rng() < 0.6 ? [1, Math.min(n - 2, 3)] : null });
    }
  }
  // inside the blocks: sheds and yards, driveways between them
  if (globalThis.__planTimes) globalThis.__planTimes.lotsB = performance.now() - tb;
  const inner = interiors(P);
  if (globalThis.__planTimes) globalThis.__planTimes.fill = performance.now() - tb;
  for (const L of inner) {
    const o = { x: L.x, z: L.z, w: L.w, d: L.d, ry: L.ry };
    const r = P.rng();
    if (r < 0.4) yardB(P, { ...o, fence: P.rng() < 0.5 ? ['l', 'r'] : [] });
    else if (r < 0.55 && L.w > 24) quonsetB(P, { ...o, d: Math.min(16, o.d), w: Math.min(o.w, 36) });
    else shedB(P, { ...o, h: 6 + P.rng() * 4, doors: [0], roof: P.pick(['gable', 'low', 'mono']) });
  }
  if (globalThis.__planTimes) globalThis.__planTimes.fillB = performance.now() - tb;
  // what's still open: loose clutter, a skip here, a dead car there
  for (const [x, z] of P.points(26, { roadPad: true })) {
    if (P.rng() > 0.45) continue;
    const ry = P.rng() * PI * 2;
    const kind = P.pick(['skip', 'pallets', 'drums', 'car', 'tyres', 'pallets']);
    if (!P.isFree(x, z, 4, 4, ry, { pad: 0.5, roadPad: true })) continue;
    P.claim(x, z, 3.6, 3.6, ry);
    if (kind === 'car') { P.add({ type: 'car', x, z, ry, col: P.pick(CARS), wreck: P.rng() < 0.6 }); P.collider({ kind: 'box', x, z, hx: 0.95, hz: 2.25, ry, y0: 4, y1: 7.5 }); }
    else { P.add({ type: 'prop', kind, x, z, ry, cnt: 2 + Math.floor(P.rng() * 5), seed: P.rng() * 1e6 | 0 }); P.collider({ kind: 'circle', x, z, r: kind === 'skip' ? 1.6 : 0.8, y0: 4, y1: 7 }); }
  }
}

/** The blocks of the grid (split where a lane or alley runs through them). */
function blockCentres() {
  const out = [];
  for (let i = 0; i < XS.length - 1; i++) {
    const cx = (XS[i] + XS[i + 1]) / 2;
    for (let j = 0; j < ZS.length - 1; j++) {
      const cz = (ZS[j] + ZS[j + 1]) / 2;
      if (j === 4) { out.push([cx, 1202], [cx, 1278]); continue; }          // the Low Line
      if (i === 3 && j === 1) { out.push([cx, 752], [cx, 828]); continue; } // Rivet Alley
      if (i === 5 && j === 3) { out.push([1245, 1052], [1245, 1128]); continue; } // Cinder Alley
      out.push([cx, cz]);
    }
    out.push([cx, 1612]);                                                  // south of Industrial Way
  }
  out.push([1430, 1000], [1430, 1120], [1430, 1380]);                      // west of Spur Rd
  return out;
}

/** Sheds and yards in what's left inside each block (a coarse scan, biggest first). */
function interiors(P) {
  const out = [];
  const sizes = [[52, 36], [40, 30], [30, 24], [22, 16]];
  for (const [cx, cz] of blockCentres()) {
    const R = blockRect(P, cx, cz);
    if (R.x1 - R.x0 < 20 || R.z1 - R.z0 < 16) continue;
    const wide = R.x1 - R.x0 >= R.z1 - R.z0;
    for (let z = R.z0 + 14; z < R.z1 - 8; z += 26) {
      for (let x = R.x0 + 14; x < R.x1 - 8; x += 30) {
        if (P.occ.get(x, z) & (ITEM | ROAD | RESERVED)) continue;
        const ry = wide ? (z < (R.z0 + R.z1) / 2 ? PI : 0) : (x < (R.x0 + R.x1) / 2 ? -PI / 2 : PI / 2);
        for (const [w, d] of sizes) {
          if (P.isFree(x, z, w, d, ry, { pad: 5, roadPad: true })) {
            P.claim(x, z, w, d, ry);
            out.push({ x, z, w, d, ry });
            break;
          }
        }
      }
    }
  }
  return out;
}

/** Chain-link (or a graffiti wall) wherever a street's frontage is left open. */
function streetFences(P) {
  const gx = GARAGE.x, gz = GARAGE.z;
  for (const r of P.roads((r) => r.rt.id === 'street' || r.rt.id === 'avenue' || r.rt.id === 'alley')) {
    const off = r.rt.hw + r.rt.shoulder + r.rt.walk + 1.0;
    const s0 = (r.closed ? 0 : r.trim0) + 3, s1 = (r.closed ? r.length : r.length - r.trim1) - 3;
    for (const sd of [1, -1]) {
      let run = [];
      const flush = () => {
        if (run.length >= 3) {
          const len = (run.length - 1) * 3;
          if (len > 14 && P.rng() < 0.18 && len < 40) {
            const [ax, az] = run[0], [bx, bz] = run[run.length - 1];
            gwallB(P, (ax + bx) / 2, (az + bz) / 2, -Math.atan2(bz - az, bx - ax) + (sd > 0 ? 0 : PI), len, 3.2);
          } else {
            const gaps = run.length > 8 ? [Math.floor(run.length / 2) - 1, Math.floor(run.length / 2)] : [];
            fenceRun(P, run, gaps);
            for (let k = 0; k < run.length - 1; k++) P.claim((run[k][0] + run[k + 1][0]) / 2, (run[k][1] + run[k + 1][1]) / 2, 3, 0.6, 0);
          }
        }
        run = [];
      };
      for (let s = s0; s < s1; s += 3) {
        const p = r.posAt(s, sd * off);
        const x = p.x, z = p.z;
        const ok = P.inside(x, z) && Math.hypot(x - gx, z - gz) > 34 &&
          !P.occ.hitDisc(x, z, 1.1, ITEM | RESERVED | ROAD);
        if (ok) run.push([x, z]); else flush();
      }
      flush();
    }
  }
}

// ------------------------------------------------------------------ scatter

function scatter(S) {
  // weeds and scrub in the cracks: low bushes, a scraggly tree now and then
  for (const [x, z] of S.points(16, { r: 1.5, density: (px, pz) => 0.25 + 0.2 * S.noise(px / 70, pz / 70) })) {
    const y = S.groundY(x, z);
    if (S.rng() < 0.12) {
      S.add({ type: 'tree', x, z, s: S.range(0.6, 1.0), col: S.pick(['#4a5a2a', '#5a6230', '#3e4e26']) });
      S.collider({ kind: 'circle', x, z, r: 0.3, y0: y - 1, y1: y + 5 });
    } else S.add({ type: 'weed', x, z, y, s: S.range(0.5, 1.2) });
  }
}

// ------------------------------------------------------------------ build

// a step is a few milliseconds of building (the clock says when); the set
// pieces (the Low Line, the power station, the boneyard, rail track, big
// lots) yield between their own parts
function* build(B, items) {
  yield* warmNeighbours(B, items);
  let t0 = performance.now(), blink = false;
  for (const it of items) {
    let g = null;
    switch (it.type) {
      case 'brick': W.brick(B, it); break;
      case 'shed': W.shed(B, it); break;
      case 'quonset': W.quonset(B, it); break;
      case 'stack': W.stack(B, it); blink = true; break;
      case 'el': g = W.el(B, it); break;
      case 'power': g = W.power(B, it); blink = true; break;
      case 'track': g = W.track(B, it); break;
      case 'railcar': W.railcar(B, it); break;
      case 'gantry': W.gantry(B, it); blink = true; break;
      case 'boxes': W.boxes(B, it); break;
      case 'tank': W.tank(B, it); break;
      case 'carpile': W.carpile(B, it); break;
      case 'crane': W.crane(B, it); break;
      case 'bone': g = W.bone(B, it); break;
      case 'fire': W.fireBarrel(B, it.x, it.z); blink = true; break;
      case 'trailer': W.trailer(B, it); break;
      case 'gwall': W.gwall(B, it); break;
      case 'sign': W.sign(B, it); break;
      case 'xing': W.xing(B, it); blink = true; break;
      case 'fence': chainFence(B, it.pts, it.h, { gaps: it.gaps }); break;
      case 'sfence': solidFence(B, it); break;
      case 'flood': floodMast(B, it.x, it.z, it.h, it.heads, it.ry, it.col); break;
      case 'lot': g = lotDrape(B, it); break;
      case 'decal': decal(B, it); break;
      case 'car': carProp(B, it); break;
      case 'prop': prop(B, it); break;
      case 'tree': tree(B, it.x, it.z, it.s, rgb(it.col), { h: 2.6, r: 1.8 }); break;
      case 'weed': weed(B, it); break;
      default: break;
    }
    if (g) {
      if (performance.now() - t0 > 1) yield;
      for (let r = g.next(); !r.done; r = g.next()) yield;
      t0 = performance.now();
    } else if (performance.now() - t0 > STEP_MS) { yield; t0 = performance.now(); }
  }
  if (blink) W.blinkAnim(B);
}

function* lotDrape(B, it) {
  const m = it.kind === 'pave' ? M.pave(B) : it.kind === 'dirt' ? M.dirt(B) : M.lot(B);
  yield* drapePieces(B.acc(m), B, it.poly, { lift: 0.06, uv: it.kind === 'pave' ? 4 : 6, step: 6 });
}

/** Paint on the drag strip: the start line, the finish, burnt rubber. */
function decal(B, it) {
  const S = B.net.surfaces(it.x, it.z, []);
  const s = S.find((q) => q.road);
  if (!s) return;
  const y = s.h + 0.025;
  const ln = B.acc(M.line(B));
  const r = s.road, i = s.i;
  const tx = r.TX[i], tz = r.TZ[i], lx = r.LX[i], lz = r.LZ[i];
  const hw = r.rt.hw - 0.3;
  const quad = (a0, a1, l0, l1, col) => {
    ln.col = col;
    const P = (a, l) => [it.x + tx * a + lx * l, y, it.z + tz * a + lz * l];
    ln.quadP(P(a0, l1), P(a0, l0), P(a1, l0), P(a1, l1));
  };
  if (it.kind === 'start' || it.kind === 'finish') {
    quad(-0.3, 0.3, -hw, hw, rgb('#e8e8e0'));
    if (it.kind === 'finish') for (let k = -6; k < 6; k++) quad(0.3, 0.9, k * 0.6 + (k % 2 ? 0 : 0.3), k * 0.6 + 0.3 + (k % 2 ? 0 : 0.3), rgb('#e8e8e0'));
    // two lanes' burnouts from the line on
    const dark = rgb('#0a0a0a');
    for (const l of [-1.9, 1.9]) for (const o of [-0.8, 0.8]) quad(0.6, it.kind === 'start' ? 34 : 6, l + o - 0.12, l + o + 0.12, dark);
  }
}

function carProp(B, it) {
  if (it.wreck) {
    car(B, it.x, it.z, it.ry, shade(rgb(it.col), 0.45));
    return;
  }
  car(B, it.x, it.z, it.ry, rgb(it.col), { lights: it.lights });
}

function prop(B, it) {
  const y = B.groundY(it.x, it.z);
  const p = B.near(M.paint(B));
  const seed = it.seed || ((it.x * 13 + it.z * 7) | 0);
  const rnd = (k) => W.hh(seed, k, 3);
  switch (it.kind) {
    case 'pallets': { let q = 0; pallets(B, it.x, y, it.z, it.ry || 0, Math.min(8, it.cnt || 4), () => rnd(10 + q++)); break; }
    case 'drums': {
      const cols = ['#1d4fa8', '#7a2a1a', '#2a5a2a', '#c8a020', '#3a3a3a'];
      const c = rgb(cols[Math.floor(rnd(1) * cols.length)]);
      for (let k = 0; k < Math.min(6, it.cnt || 3); k++) drum(p, it.x + (k % 3) * 0.65 - 0.65, y, it.z + Math.floor(k / 3) * 0.65, shade(c, 0.75 + rnd(k) * 0.35));
      break;
    }
    case 'skip': skip(B, it.x, it.z, it.ry || 0, rgb(rnd(2) < 0.5 ? '#2a5a3a' : '#c8a020')); break;
    case 'tyres': W.tyres(B, it.x, it.z, Math.min(7, it.cnt || 4)); break;
    case 'forklift': W.forklift(B, it.x, it.z, it.ry || 0); break;
    default: break;
  }
}

/** A corrugated sheet fence (the salvage yard's): green panels on posts. */
function solidFence(B, it) {
  const acc = B.acc(W.WM.metal(B));
  acc.col = rgb(it.tint || '#5a7a6a');
  const pts = it.pts;
  for (let k = 0; k < pts.length - 1; k++) {
    if (it.gaps?.includes(k)) {
      const [ax, az] = pts[k], [bx, bz] = pts[k + 1];
      // the gate: only the first 12 m of that side is open
      const len = Math.hypot(bx - ax, bz - az), ux = (bx - ax) / len, uz = (bz - az) / len;
      fencePanels(B, acc, [ax + ux * 12, az + uz * 12], [bx, bz]);
      continue;
    }
    fencePanels(B, acc, pts[k], pts[k + 1]);
  }
}

function fencePanels(B, acc, a, b) {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const n = Math.max(1, Math.round(len / 5));
  const st = B.acc(M.steel(B));
  st.col = rgb('#3a3c3e');
  for (let k = 0; k < n; k++) {
    const t0 = k / n, t1 = (k + 1) / n;
    const x0 = a[0] + (b[0] - a[0]) * t0, z0 = a[1] + (b[1] - a[1]) * t0, x1 = a[0] + (b[0] - a[0]) * t1, z1 = a[1] + (b[1] - a[1]) * t1;
    const y0 = B.groundY(x0, z0), y1 = B.groundY(x1, z1);
    const id = W.hh(k, x0 | 0, 5) < 0.3 ? 11 : W.hh(k, x0 | 0, 6) < 0.3 ? 15 : 0;
    const uv = tileUVm(id);
    acc.quadP([x0, y0 - 0.2, z0], [x1, y1 - 0.2, z1], [x1, y1 + 3, z1], [x0, y0 + 3, z0], uv);
    acc.quadP([x1, y1 - 0.2, z1], [x0, y0 - 0.2, z0], [x0, y0 + 3, z0], [x1, y1 + 3, z1], uv);
    st.box(x0, y0 - 0.3, z0, 0.15, 3.5, 0.15);
  }
}

const tileUVm = (id) => tileUV(METAL, id, 0, 0.1, 1, 0.42);

function weed(B, it) {
  const p = B.near(M.leaf(B));
  p.col = rgb(it.s > 0.9 ? '#4a5a2a' : '#5a6034');
  const { x, z, y, s } = it;
  for (let k = 0; k < 3; k++) {
    const a = k * 2.1 + x;
    W.blob(p, x + Math.cos(a) * 0.4 * s, y + 0.2 * s, z + Math.sin(a) * 0.4 * s, 0.45 * s);
  }
}

// ------------------------------------------------------------------ warm

function warm(B) {
  W.warmWorks(B);
}

void boxW; void glowBox;

export default { id: 'works', plan, scatter, warm, build };
