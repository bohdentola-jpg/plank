// PORT HALCYON — PIER 9: the amusement pier and the beach. Under the PIER 9
// arch the pier runs out into the bay, and beside it the fun pier on its
// piles: the Pier 9 Wheel (turning, ringed with chasing bulbs), the
// carousel, the Plunge drop tower, game booths. On the sand between Beach
// Boulevard and the boardwalk, the Comet (a white wooden roller coaster lit
// along every rail), Neptune's Arcade and the Crab Shack at the pier's foot,
// a row of pastel shacks and stands along the boardwalk under string
// lights, art deco hotels and a diner facing the beach, palms, lifeguard
// towers and umbrellas on the sand. Hidden: the Barnacle (a tiki bar down a
// back alley behind the shacks) and Smugglers' Cove (a surf shack and a
// bonfire at the far end of the beach, down the dune track).
import * as THREE from 'three';
import { makeRng } from '../../core/util.js';
import { litMat, box, cylinder, gable, lattice, drape } from './builder.js';
import { Acc } from '../build/geo.js';
import { roadLamps } from '../build/roads.js';
import { mats, cmat, C, col, frame, lbox, lbeam, tube, panel, seedOf, groundStrip, coneC, disc, bulb, stringLights, beamLine, palm, chaseBulb, spark } from './coast/kit.js';
import { signAtlas, decoTexture, shackTexture, shackUV, SHACK_KINDS } from './coast/tex.js';
import { frame2 } from './coast/geo.js';

const WARM = '#ffc27a';
const NEON = ['#ff3a8a', '#2ae0ff', '#ffd23a', '#7aff5a', '#c85aff', '#ff7a2a'];
const PASTEL = ['#f4b8c8', '#a8dce8', '#f8e0a0', '#b8e8c0', '#d8c0f0', '#ffc8a0', '#a8c8f0', '#f0f0e8'];

// ------------------------------------------------------------------ signs

const FOOD = [['tacos', 'TACOS'], ['corndogs', 'CORN DOGS'], ['icecream', 'ICE CREAM'], ['fries', 'FRIES'], ['lemonade', 'LEMONADE'], ['shavedice', 'SHAVED ICE'], ['fudge', 'FUDGE'], ['pizza', 'PIZZA'], ['churros', 'CHURROS']];
const SHOPS = [['surfshop', 'SURF SHOP'], ['tshirts', 'T-SHIRTS'], ['shades', 'SHADES'], ['toys', 'BEACH TOYS'], ['bait', 'BAIT & TACKLE'], ['souvenirs', 'SOUVENIRS'], ['psychic', 'PSYCHIC'], ['games', 'GAMES']];
const HOTELS = [['miramar', 'HOTEL MIRAMAR'], ['coronado', 'THE CORONADO'], ['haven', 'BEACH HAVEN'], ['palms', 'THE PALMS'], ['oceanview', 'OCEAN VIEW'], ['delmar', 'HOTEL DEL MAR']];

const SIGNS = [
  { id: 'pier9', w: 900, h: 210, text: 'PIER 9', sub: 'RIDES · ARCADE · FISHING', style: 'neon', glow: '#ff3a8a', glow2: '#2ae0ff', border: '#ffd23a' },
  { id: 'arcade', w: 860, h: 170, text: "NEPTUNE'S ARCADE", style: 'neon', glow: '#2ae0ff', border: '#ff3a8a' },
  { id: 'funzone', w: 420, h: 120, text: 'FUN ZONE', style: 'neon', glow: '#ffd23a' },
  { id: 'comet', w: 620, h: 150, text: 'THE COMET', style: 'neon', glow: '#ff4a3a', border: '#ffd23a' },
  { id: 'carousel', w: 440, h: 100, text: 'CAROUSEL', style: 'neon', glow: '#ffd23a' },
  { id: 'plunge', w: 480, h: 120, text: 'THE PLUNGE', style: 'neon', glow: '#7aff5a' },
  { id: 'crab', w: 620, h: 130, text: 'THE CRAB SHACK', sub: 'CHOWDER · OYSTERS · BEER', style: 'neon', glow: '#ff7a2a', glow2: '#2ae0ff' },
  { id: 'diner', w: 640, h: 140, text: 'SURF CITY DINER', style: 'neon', glow: '#ff3a8a', border: '#2ae0ff' },
  { id: 'barnacle', w: 520, h: 130, text: 'THE BARNACLE', sub: 'TIKI · RUM · LATE', style: 'neon', glow: '#2ae0ff', glow2: '#ff3a8a' },
  { id: 'cove', w: 520, h: 110, text: "SMUGGLERS' COVE", style: 'paint', bg: '#5a3a24', fg: '#f0e0c0' },
  { id: 'surfshack', w: 380, h: 90, text: 'SURF SHACK', sub: 'BOARDS · WAX · RENTALS', style: 'paint', bg: '#2a7ab8', fg: '#fff4d8' },
  { id: 'endpier', w: 560, h: 100, text: 'END OF PIER 9', sub: 'NO DIVING · NO FISHING OFF THE RAIL', style: 'paint', bg: '#f2eee4', fg: '#1d3f6e' },
  { id: 'tickets', w: 300, h: 80, text: 'TICKETS', style: 'neon', glow: '#ffd23a' },
  { id: 'lifeguard', w: 440, h: 100, text: 'LIFEGUARD HQ', sub: 'HALCYON BEACHES', style: 'box', bg: '#d8322a', fg: '#ffffff', glow: '#ff5a4a', fgGlow: '#ffffff' },
  ...FOOD.map(([id, t], k) => ({ id, w: 300, h: 72, text: t, style: k % 2 ? 'neon' : 'box', glow: NEON[k % NEON.length], bg: k % 2 ? null : PASTEL[k % PASTEL.length], fg: '#2a1a12', fgGlow: '#3a2010' })),
  ...SHOPS.map(([id, t], k) => ({ id, w: 300, h: 72, text: t, style: k % 2 ? 'box' : 'neon', glow: NEON[(k + 3) % NEON.length], bg: k % 2 ? PASTEL[(k + 2) % PASTEL.length] : null, fg: '#2a1a12', fgGlow: '#3a2010' })),
  ...HOTELS.map(([id, t], k) => ({ id, w: 460, h: 100, text: t, style: 'neon', glow: NEON[k % NEON.length] })),
];
const atlas = () => signAtlas('pier9', SIGNS, 1024, 1024, 0.74);
const UV = () => atlas().uv;

function pmats(B) {
  const M = mats(B);
  M.sign = B.mat('sign', () => { const t = atlas(); return litMat({ map: t.map, emissive: 0xffffff, emissiveMap: t.emi, roughness: 0.6 }, { night: 1.35 }); });
  M.deco = B.mat('deco', () => { const t = decoTexture(); return litMat({ map: t.map, emissive: 0xffffff, emissiveMap: t.emi, vertexColors: true, roughness: 0.8 }, { night: 1.0 }); });
  M.shack = B.mat('shack', () => { const t = shackTexture(); return litMat({ map: t.map, emissive: 0xffffff, emissiveMap: t.emi, roughness: 0.75 }, { night: 1.1 }); });
  return M;
}

// ------------------------------------------------------------------ the plan

export default {
  id: 'pier9',

  plan(P) {
    const S = { pier: P.net.byId.get('p9_pier') };
    // the pier's deck height at z (it runs due south from z = 1950)
    S.deckY = (z) => S.pier.posAt(Math.max(0, Math.min(S.pier.length, z - S.pier.a.z))).y;
    planPlatform(P, S);
    planTip(P, S);
    planArch(P, S);
    planFront(P, S);
    planComet(P, S);
    planBack(P, S);
    planHotels(P, S);
    planShacks(P, S);
    planStrings(P, S);
    planBeach(P, S);
    planPalms(P, S);
    planCove(P, S);
    P.landmark({ id: 'p9_wheel', name: 'PIER 9 WHEEL', x: S.wheel.x, z: S.wheel.z, r: 40, kind: 'ferris' });
    if (S.comet) P.landmark({ id: 'p9_comet', name: 'THE COMET', x: S.comet.x, z: S.comet.z, r: 120, kind: 'coaster' });
    P.landmark({ id: 'p9_arch', name: 'THE PIER 9 ARCH', x: 1200, z: 1966, r: 20, kind: 'arch' });
    if (S.arcade) P.landmark({ id: 'p9_arcade', name: "NEPTUNE'S ARCADE", x: S.arcade.x, z: S.arcade.z, r: 40, kind: 'building' });
    P.landmark({ id: 'p9_plunge', name: 'THE PLUNGE', x: S.drop.x, z: S.drop.z, r: 20, kind: 'ride' });
    if (S.barnacle) P.landmark({ id: 'p9_barnacle', name: 'THE BARNACLE', x: S.barnacle.x, z: S.barnacle.z, r: 30, hidden: true, kind: 'bar' });
    if (S.cove) P.landmark({ id: 'p9_cove', name: "SMUGGLERS' COVE", x: S.cove.x, z: S.cove.z, r: 40, hidden: true, kind: 'beach' });
  },

  scatter(S) {
    // beach grass in the dunes behind the sand, a few palms
    for (const [x, z] of S.points(16, { r: 2, density: (px, pz) => 0.35 + 0.3 * S.noise(px / 60, pz / 60) })) {
      const y = S.groundY(x, z);
      if (y < 2.2) continue;
      S.add({ type: 'grass', x, z, y, s: S.range(0.7, 1.4), t: S.rng() });
    }
  },

  warm(B) { pmats(B); UV(); },

  *build(B, items) {
    const M = pmats(B);
    const uv = UV();
    let t0 = performance.now();
    for (const it of items) {
      const fn = BUILD[it.type];
      if (fn) fn(B, M, it, uv);
      if (performance.now() - t0 > 2) { yield; t0 = performance.now(); }
    }
  },
};

// ------------------------------------------------------------------ the fun pier

const PX0 = 1206.6, PX1 = 1334, PZ0 = 1994, PZ1 = 2254;

function planPlatform(P, S) {
  // the deck, in pieces along the pier (one a cell's worth)
  for (let z = PZ0; z < PZ1 - 1; z += 65) {
    const z1 = Math.min(PZ1, z + 65);
    P.add({ type: 'platform', x: (PX0 + PX1) / 2, z: (z + z1) / 2, x0: PX0, x1: PX1, z0: z, z1, first: z === PZ0, last: z1 >= PZ1 });
  }
  P.far({ shape: 'box', x: (PX0 + PX1) / 2, z: (PZ0 + PZ1) / 2, y: -1, w: PX1 - PX0, d: PZ1 - PZ0, h: S.deckY(2120) + 1, ry: 0, color: '#6a5a48' });
  // railing lamps
  for (let z = PZ0 + 10; z < PZ1; z += 24) {
    const y = S.deckY(z);
    P.lamp({ x: PX1 - 0.5, z, hx: PX1 - 0.5, hy: y + 3.4, hz: z, color: WARM, radius: 14, intensity: 0.8, halo: 1.4 });
  }
  for (let x = PX0 + 20; x < PX1; x += 30) {
    for (const z of [PZ0 + 0.5, PZ1 - 0.5]) P.lamp({ x, z, hx: x, hy: S.deckY(z) + 3.4, hz: z, color: WARM, radius: 14, intensity: 0.8, halo: 1.4 });
  }
  // the wheel
  const wx = 1294, wz = 2152, wy = S.deckY(wz);
  S.wheel = { x: wx, z: wz };
  P.add({ type: 'wheel', x: wx, z: wz, y0: wy });
  const R = 26, hub = wy + 31;
  for (let k = 0; k < 10; k++) {
    const a = (k / 10) * Math.PI;
    const yy = hub - R + (k + 0.5) * (2 * R / 10);
    const half = Math.sqrt(Math.max(0, R * R - (yy - hub) ** 2));
    P.far({ shape: 'box', x: wx, z: wz, y: yy - R / 10, w: Math.max(2, half * 2), d: 4.4, h: 2 * R / 10, ry: 0, color: '#e8e4dc', lit: 0 });
    void a;
  }
  for (const sd of [-1, 1]) P.far({ shape: 'box', x: wx + sd * 9, z: wz, y: wy, w: 2, d: 9, h: 31, ry: 0, color: '#e8e4dc' });
  // a ring of far lights on the rim (the near wheel turns its own bulbs)
  for (let k = 0; k < 24; k++) {
    const a = (k / 24) * Math.PI * 2;
    P.lamp({ x: wx, z: wz, hx: wx + Math.cos(a) * R, hy: hub + Math.sin(a) * R, hz: wz, color: NEON[k % 3], radius: 1, intensity: 0, halo: 0 });
  }
  P.lamp({ x: wx, z: wz, hx: wx, hy: hub, hz: wz + 3, color: '#ffffff', radius: 1, intensity: 0, halo: 0 });
  // the carousel, the drop tower, the booths
  const cx = 1246, cz = 2030;
  P.add({ type: 'carousel', x: cx, z: cz, y0: S.deckY(cz) });
  P.lamp({ x: cx, z: cz, hx: cx, hy: S.deckY(cz) + 7, hz: cz, color: '#ffe0a0', radius: 18, intensity: 1.0, halo: 3 });
  P.far({ shape: 'cyl', x: cx, z: cz, y: S.deckY(cz), r: 10, h: 8, color: '#e85a6a', lit: 0.6 });
  const dx = 1306, dz = 2056;
  S.drop = { x: dx, z: dz };
  P.add({ type: 'drop', x: dx, z: dz, y0: S.deckY(dz) });
  P.far({ shape: 'cyl', x: dx, z: dz, y: S.deckY(dz), r: 1.6, h: 46, color: '#e8e4dc' });
  P.lamp({ x: dx, z: dz, hx: dx, hy: S.deckY(dz) + 47, hz: dz, color: '#7aff5a', radius: 1, intensity: 0, halo: 3 });
  P.lamp({ x: dx, z: dz, hx: dx, hy: S.deckY(dz) + 30, hz: dz, color: '#ff3a8a', radius: 1, intensity: 0, halo: 0 });
  for (let k = 0; k < 6; k++) {
    const bz = 2088 + k * 9.5;
    P.add({ type: 'booth', x: 1222, z: bz, y0: S.deckY(bz), ry: Math.PI / 2, w: 8, d: 5, k: (k * 5 + 2) % 12, sign: SHOPS[(k + 6) % SHOPS.length][0] });
  }
  for (let k = 0; k < 4; k++) {
    const bz = 2196 + k * 12;
    P.add({ type: 'booth', x: 1300, z: bz, y0: S.deckY(bz), ry: -Math.PI / 2, w: 9, d: 5, k: (k * 7 + 1) % 12, sign: FOOD[(k + 3) % FOOD.length][0] });
  }
  P.lamp({ x: 1240, z: 2110, hx: 1240, hy: S.deckY(2110) + 6, hz: 2110, color: '#ffd8a0', radius: 20, intensity: 0.9, halo: 2 });
  P.lamp({ x: 1290, z: 2215, hx: 1290, hy: S.deckY(2215) + 6, hz: 2215, color: '#ffd8a0', radius: 20, intensity: 0.9, halo: 2 });
}

function planTip(P, S) {
  const z = S.pier.b.z - 12;
  P.add({ type: 'tip', x: 1200, z, y0: S.deckY(z) });
  P.lamp({ x: 1200, z: z + 6, hx: 1200, hy: S.deckY(z) + 5, hz: z + 6, color: WARM, radius: 16, intensity: 0.8, halo: 1.6 });
}

function planArch(P, S) {
  const s = 15;
  const p = S.pier.posAt(s);
  P.add({ type: 'arch', x: p.x, z: p.z, y0: p.y, ry: p.heading });
  for (const lat of [-7.4, 7.4]) {
    const q = S.pier.posAt(s, lat);
    P.collider({ kind: 'circle', x: q.x, z: q.z, r: 0.6, y0: p.y - 1, y1: p.y + 11 });
  }
  P.lamp({ x: p.x, z: p.z, hx: p.x, hy: p.y + 9.5, hz: p.z, color: '#ff6aa8', radius: 22, intensity: 0.9, halo: 4 });
  P.far({ shape: 'box', x: p.x, z: p.z, y: p.y + 8, w: 16, d: 1, h: 3.5, ry: 0, color: '#e8e4dc', lit: 0.8 });
}

// ------------------------------------------------------------------ the arcade and the crab shack

function planFront(P, S) {
  // Neptune's Arcade west of the pier's approach, the Crab Shack east of it
  for (const [x, z, w, d, type] of [[1158, 1907, 52, 44, 'arcade'], [1240, 1912, 40, 30, 'crab']]) {
    if (!P.isFree(x, z, w, d, Math.PI, { roadPad: true })) continue;
    const g = P.groundRange(x, z, w, d, Math.PI);
    const h = type === 'arcade' ? 11 : 8.5;
    P.add({ type, x, z, w, d, ry: Math.PI, h, y0: g.lo - 0.5, y1: g.hi, map: 'building' });
    P.claim(x, z, w, d, Math.PI);
    P.collider({ kind: 'box', x, z, hx: w / 2, hz: d / 2, ry: Math.PI, y0: g.lo - 1, y1: g.hi + h + 4 });
    P.far({ shape: 'box', x, z, y: g.lo - 1, w, d, h: h + 2, ry: Math.PI, color: type === 'arcade' ? '#e8a8c0' : '#a8d8d8', lit: 0.5 });
    // its front faces south (the boardwalk): lamps along it
    for (const fx of [-w / 3, 0, w / 3]) P.lamp({ x: x + fx, z: z + d / 2 + 2, hx: x + fx, hy: g.hi + h - 1, hz: z + d / 2 + 3, color: type === 'arcade' ? '#ff6ad8' : '#ffb070', radius: 18, intensity: 0.9, halo: 0 });
    if (type === 'arcade') S.arcade = { x, z };
  }
}

// ------------------------------------------------------------------ the Comet

function planComet(P, S) {
  // on the sand between the boulevard and the boardwalk, along the boulevard
  const ry = Math.atan2(110 / 610, 1);   // local x runs east-north-east with Beach Blvd
  for (const [x, z] of [[1548, 1810], [1555, 1815], [1540, 1806], [1560, 1820], [1530, 1800]]) {
    if (!P.isFree(x, z, 216, 46, ry, { roadPad: true, pad: 1 })) continue;
    S.comet = { x, z };
    P.add({ type: 'comet', x, z, ry, A: 86, W: 30, y0: P.groundY(x, z), map: 'park', w: 216, d: 46 });
    P.claim(x, z, 216, 46, ry);
    P.collider({ kind: 'box', x, z, hx: 106, hz: 22, ry, y0: P.groundY(x, z) - 1, y1: P.groundY(x, z) + 26 });
    const F = frame2(x, z, ry);
    P.far({ shape: 'box', x, z, y: P.groundY(x, z), w: 200, d: 38, h: 11, ry, color: '#e8e4dc', lit: 0.3 });
    const lift = F(32, -15);
    P.far({ shape: 'box', x: lift[0], z: lift[1], y: P.groundY(x, z), w: 40, d: 4, h: 26, ry, color: '#e8e4dc', lit: 0.3 });
    // lights on the lift hill's crest, seen from across the bay
    for (const u of [20, 26, 32]) {
      const p = F(u, -15);
      P.lamp({ x: p[0], z: p[1], hx: p[0], hy: P.groundY(x, z) + 26.5, hz: p[1], color: '#fff0c8', radius: 1, intensity: 0, halo: 1.6 });
    }
    break;
  }
}

// ------------------------------------------------------------------ the back alley and the Barnacle

function planBack(P, S) {
  const r = P.net.byId.get('p9_alley');
  if (!r) return;
  const e = r.posAt(r.length - 6);
  const x = r.b.x + 19, z = r.b.z - 1;
  if (!P.isFree(x, z, 26, 22, 0, { pad: 0.5 })) return;
  S.barnacle = { x, z };
  P.add({ type: 'barnacle', x, z, y0: P.groundY(x, z), ry: Math.atan2(r.b.x - e.x, r.b.z - e.z) });
  P.claim(x, z, 26, 22, 0);
  P.collider({ kind: 'circle', x, z: z - 4, r: 4.2, y0: P.groundY(x, z) - 1, y1: P.groundY(x, z) + 6 });
  P.lamp({ x, z, hx: x, hy: P.groundY(x, z) + 3.6, hz: z + 3, color: '#ff9a5a', radius: 16, intensity: 1.0, halo: 2.2 });
  P.lamp({ x: x - 8, z: z + 6, hx: x - 8, hy: P.groundY(x, z) + 2.4, hz: z + 6, color: '#ffb060', radius: 10, intensity: 0.8, halo: 1.6 });
  P.lamp({ x: x + 8, z: z + 6, hx: x + 8, hy: P.groundY(x, z) + 2.4, hz: z + 6, color: '#ffb060', radius: 10, intensity: 0.8, halo: 1.6 });
}

// ------------------------------------------------------------------ hotels and the diner (the boulevard's north side)

function planHotels(P, S) {
  const lots = P.lots({
    roads: (r) => ['wf_seawall2', 'wf_beach1', 'wf_beach2'].includes(r.spec.id),
    sides: [1], width: [24, 46], depth: [18, 34], gap: [10, 30], setback: [3, 8], pad: 1, ends: 22, chance: 0.8,
  });
  let n = 0;
  for (const L of lots) {
    const g = P.groundRange(L.x, L.z, L.w, L.d, L.ry);
    const diner = n === 2;
    const floors = diner ? 1 : 2 + Math.floor(P.rng() * 3);
    const h = diner ? 5 : floors * 4;
    const tint = P.pick(PASTEL);
    const name = HOTELS[n % HOTELS.length][0];
    P.add({ type: diner ? 'diner' : 'hotel', x: L.x, z: L.z, w: L.w, d: L.d, ry: L.ry, h, floors, tint, name, y0: g.lo - 0.5, y1: g.hi, map: 'building' });
    P.collider({ kind: 'box', x: L.x, z: L.z, hx: L.w / 2, hz: L.d / 2, ry: L.ry, y0: g.lo - 1, y1: g.hi + h + 6 });
    P.far({ shape: 'box', x: L.x, z: L.z, y: g.lo - 1, w: L.w, d: L.d, h: h + 1.5, ry: L.ry, color: tint, lit: 0.5 });
    const c = Math.cos(L.ry), s = Math.sin(L.ry);
    const lz = L.d / 2 + 2;
    P.lamp({ x: L.x + lz * s, z: L.z + lz * c, hx: L.x + lz * s, hy: g.hi + 3.6, hz: L.z + lz * c, color: diner ? '#ff8ad8' : '#ffd8a0', radius: 16, intensity: 0.9, halo: 1.6 });
    n++;
  }
}

// ------------------------------------------------------------------ the shacks along the boardwalk

function planShacks(P, S) {
  const lots = P.lots({
    roads: (r) => r.spec.id === 'p9_walk1' || r.spec.id === 'p9_walk2',
    sides: [1], width: [6.5, 11], depth: [6, 8.5], gap: [0.6, 3.5], setback: [0.4, 1.4], pad: 0.3, ends: 14,
  });
  let n = 0;
  const signs = [...FOOD.map((f) => f[0]), ...SHOPS.map((s) => s[0])];
  for (const L of lots) {
    const g = P.groundRange(L.x, L.z, L.w, L.d, L.ry);
    const k = (n * 7 + 3) % 12;
    const kind = SHACK_KINDS[k];
    const pool = kind === 'food' || kind === 'ice' ? FOOD.map((f) => f[0]) : SHOPS.map((s) => s[0]);
    const sign = pool[(n * 5 + 1) % pool.length];
    P.add({ type: 'shack', x: L.x, z: L.z, w: L.w, d: L.d, ry: L.ry, y0: g.lo - 0.3, y1: g.hi, k, sign, tint: P.pick(PASTEL), roof: P.pick(['flat', 'gable', 'flat']), map: 'building' });
    P.collider({ kind: 'box', x: L.x, z: L.z, hx: L.w / 2, hz: L.d / 2, ry: L.ry, y0: g.lo - 1, y1: g.hi + 5 });
    if (n % 3 === 0) P.far({ shape: 'box', x: L.x, z: L.z, y: g.lo, w: L.w, d: L.d, h: 4.5, ry: L.ry, color: P.pick(PASTEL), lit: 0.6 });
    n++;
  }
  void signs;
}

// ------------------------------------------------------------------ string lights along the boardwalk

function planStrings(P, S) {
  for (const id of ['p9_walk1', 'p9_walk2']) {
    const r = P.net.byId.get(id);
    const L = roadLamps(r);
    for (const sd of [1, -1]) {
      const side = L.filter((l) => l.side === sd);
      for (let k = 0; k < side.length - 1; k++) {
        const a = side[k], b = side[k + 1];
        P.add({ type: 'string', x: (a.x + b.x) / 2, z: (a.z + b.z) / 2, a: [a.hx, a.hy - 0.5, a.hz], b: [b.hx, b.hy - 0.5, b.hz], n: k });
      }
    }
    // zig-zags across the boardwalk every other pair
    const left = L.filter((l) => l.side === 1), right = L.filter((l) => l.side === -1);
    for (let k = 0; k < Math.min(left.length, right.length) - 1; k += 2) {
      const a = left[k], b = right[k + 1];
      P.add({ type: 'string', x: (a.x + b.x) / 2, z: (a.z + b.z) / 2, a: [a.hx, a.hy - 0.3, a.hz], b: [b.hx, b.hy - 0.3, b.hz], n: k + 100, across: true });
    }
  }
}

// ------------------------------------------------------------------ the beach

function planBeach(P, S) {
  // lifeguard towers on the sand, seaward of the boardwalk
  const towers = [[790, 1940, 0], [1065, 1966, 1], [1600, 1868, 2], [1690, 1840, 3]];
  for (const [x, z, k] of towers) {
    if (!P.isFree(x, z, 5, 5, 0, { roadPad: true })) continue;
    const y0 = P.groundY(x, z);
    P.add({ type: 'tower', x, z, y0, ry: Math.PI + (k % 2 ? 0.25 : -0.2), k });
    P.claim(x, z, 5, 5, 0);
    P.collider({ kind: 'box', x, z, hx: 2, hz: 2, ry: 0, y0: y0 - 1, y1: y0 + 6 });
    P.add({ type: 'umbrellas', x: x + 14, z: z - 2, n: 5 + k });
    P.add({ type: 'umbrellas', x: x - 16, z: z + 2, n: 4 + k });
  }
  // the lifeguard HQ and the parking lot at the west end, by the sea wall
  {
    const x = 560, z = 1918, w = 26, d = 14;
    if (P.isFree(x, z, w, d, Math.PI, { roadPad: true })) {
      const g = P.groundRange(x, z, w, d, Math.PI);
      P.add({ type: 'hq', x, z, w, d, ry: Math.PI, y0: g.lo - 0.5, y1: g.hi, map: 'building' });
      P.claim(x, z, w, d, Math.PI);
      P.collider({ kind: 'box', x, z, hx: w / 2, hz: d / 2, ry: Math.PI, y0: g.lo - 1, y1: g.hi + 14 });
      P.far({ shape: 'box', x, z, y: g.lo, w, d, h: 8, ry: 0, color: '#f0f0e8', lit: 0.4 });
      P.lamp({ x, z: z - d / 2 - 2, hx: x, hy: g.hi + 4, hz: z - d / 2 - 2, color: '#fff0d0', radius: 16, intensity: 0.8, halo: 1.4 });
    }
  }
  {
    const pts = [[392, 1806], [604, 1806], [604, 1872], [392, 1872]];
    let ok = true;
    for (const [x, z] of pts) if (!P.isFree(x, z, 2, 2, 0, { roadPad: true })) ok = false;
    if (ok) {
      P.add({ type: 'lot', x: 498, z: 1839, pts, map: 'yard' });
      P.claim(498, 1839, 212, 66, 0);
      for (let x = 420; x < 600; x += 60) {
        P.lamp({ x, z: 1839, hx: x, hy: P.groundY(x, 1839) + 7, hz: 1839, color: WARM, radius: 26, intensity: 0.8, halo: 2 });
        P.collider({ kind: 'circle', x, z: 1839, r: 0.25, y0: 0, y1: 10 });
      }
      S.lot = pts;
    }
  }
}

// ------------------------------------------------------------------ palms

function planPalms(P, S) {
  const add = (x, z, h) => {
    if (!P.isFree(x, z, 2, 2, 0, { pad: 0.2 })) return;
    const y = P.groundY(x, z);
    P.add({ type: 'palm', x, z, y, h, lean: P.range(0.05, 0.22), a: P.range(0, 6.28), seed: P.rng() });
    P.claim(x, z, 2, 2, 0);
    P.collider({ kind: 'circle', x, z, r: 0.42, y0: y - 1, y1: y + h });
  };
  // a row down each side of the boulevard
  for (const id of ['wf_seawall2', 'wf_beach1', 'wf_beach2']) {
    const r = P.net.byId.get(id);
    const reach = r.rt.hw + r.rt.walk + 1.6;
    for (let s = r.trim0 + 12; s < r.length - r.trim1 - 8; s += 21) {
      for (const sd of [1, -1]) {
        const p = r.posAt(s, sd * reach);
        if (p.z < 1722) continue;
        add(p.x, p.z, P.range(11, 15));
      }
    }
  }
  // round the parking lot
  if (S.lot) for (let x = 400; x < 600; x += 26) { add(x, 1800, P.range(9, 13)); add(x + 13, 1878, P.range(9, 13)); }
  // in clumps on the sand behind the shacks
  for (const [x, z] of P.points(38, { test: (x, z) => z > 1800 && z < 1900 && x > 700 && x < 1700, roadPad: true })) {
    if (P.rng() < 0.55) continue;
    for (let k = 0; k < 1 + Math.floor(P.rng() * 3); k++) add(x + P.range(-4, 4), z + P.range(-4, 4), P.range(8, 14));
  }
}

// ------------------------------------------------------------------ Smugglers' Cove

function planCove(P, S) {
  const r = P.net.byId.get('p9_cove');
  if (!r) return;
  const x = r.b.x + 18, z = r.b.z + 6;
  if (!P.isFree(x, z, 26, 18, 0, { pad: 0.5, water: false })) return;
  S.cove = { x, z };
  const y0 = P.groundY(x, z);
  P.add({ type: 'cove', x, z, y0, ry: -0.15 });
  P.claim(x, z, 26, 18, 0);
  P.collider({ kind: 'box', x: x - 5, z, hx: 4, hz: 3.5, ry: -0.15, y0: y0 - 1, y1: y0 + 6 });
  P.lamp({ x: x + 6, z: z + 4, hx: x + 6, hy: y0 + 1.6, hz: z + 4, color: '#ff8a3a', radius: 18, intensity: 1.2, halo: 3 });
  P.lamp({ x: x - 5, z, hx: x - 5, hy: y0 + 4, hz: z + 3.6, color: '#ffd8a0', radius: 10, intensity: 0.7, halo: 1.2 });
  for (const [dx, dz, h] of [[-12, -6, 12], [-14, 3, 10], [10, -8, 13], [2, -10, 11]]) {
    const px = x + dx, pz = z + dz;
    const y = P.groundY(px, pz);
    P.add({ type: 'palm', x: px, z: pz, y, h, lean: 0.25, a: 2.6, seed: P.rng() });
    P.collider({ kind: 'circle', x: px, z: pz, r: 0.42, y0: y - 1, y1: y + h });
  }
}

// ------------------------------------------------------------------ builders

const BUILD = {
  platform,
  wheel: ferrisWheel,
  carousel,
  drop: dropTower,
  booth,
  tip: pierTip,
  arch,
  arcade,
  crab,
  comet,
  barnacle,
  hotel,
  diner,
  shack,
  string(B, M, it) {
    const rng = makeRng(seedOf(it));
    const cols = it.across ? [C('#ff4a8a', 3), C('#ffd84a', 3), C('#4ae0ff', 3), C('#7aff5a', 3)] : [C('#fff0c8', 3), C('#ffd890', 3)];
    stringLights(B.near(M.paint), B.acc(M.glow), it.a, it.b, it.across ? 1.1 : 0.7, it.across ? 16 : 12, cols);
    void rng;
  },
  tower: guardTower,
  umbrellas,
  hq: lifeguardHQ,
  lot(B, M, it) {
    const dec = B.acc(M.decal);
    col(dec, C('#3e3f42'));
    drape(dec, B, it.pts, { lift: 0.05, step: 6, uv: 8 });
    col(dec, C('#e8e6dc'));
    for (let x = 400; x < 600; x += 3) {
      groundStrip(dec, B, [[x, 1812], [x, 1824]], 0.12, 0.08, 6);
      groundStrip(dec, B, [[x, 1854], [x, 1866]], 0.12, 0.08, 6);
    }
    // lamp posts down the middle
    const st = B.acc(M.paint), gl = B.acc(M.glow);
    for (let x = 420; x < 600; x += 60) {
      const y = B.groundY(x, 1839);
      col(st, C('#e8e4dc'));
      st.box(x, y, 1839, 0.2, 7, 0.2);
      col(gl, C('#ffd890', 3));
      gl.box(x, y + 6.8, 1839, 0.7, 0.4, 0.7);
    }
  },
  palm(B, M, it) {
    const rng = makeRng(seedOf(it));
    palm(B.acc(M.matte), B.acc(M.leaf), it.x, it.y, it.z, it.h, it.lean, Math.cos(it.a), Math.sin(it.a), rng);
  },
  cove,
  grass(B, M, it) {
    const lf = B.near(M.leaf);
    const rng = makeRng(`g${it.x.toFixed(1)}${it.z.toFixed(1)}`);
    col(lf, [0.55 + it.t * 0.15, 0.55 + it.t * 0.1, 0.3]);
    for (let k = 0; k < 5; k++) {
      const a = rng() * 6.28, r = rng() * 0.6;
      coneC(lf, it.x + Math.cos(a) * r, it.y - 0.05, it.z + Math.sin(a) * r, 0.18 * it.s, 0.9 * it.s * (0.7 + rng() * 0.6), 3);
    }
  },
};

// ------------------------------------------------------------------ the fun pier

function deckYOf(B) {
  const r = B.net.byId.get('p9_pier');
  return (z) => r.posAt(Math.max(0, Math.min(r.length, z - r.a.z))).y;
}

function platform(B, M, it) {
  const yAt = deckYOf(B);
  const wd = B.acc(M.wood), st = B.acc(M.paint), gl = B.acc(M.glow), pile = B.acc(M.matte);
  const { x0, x1, z0, z1 } = it;
  const step = 6.5;
  col(wd, C('#b49a7c'));
  for (let z = z0; z < z1 - 0.01; z += step) {
    const za = z, zb = Math.min(z1, z + step);
    const ya = yAt(za) + 0.02, yb = yAt(zb) + 0.02;
    wd.quadP([x0, ya, za], [x0, yb, zb], [x1, yb, zb], [x1, ya, za], [x0 / 4, za / 4, x1 / 4, zb / 4]);
    // the outer fascia (east) and the underside
    wd.quadP([x1, ya - 1.3, za], [x1, ya, za], [x1, yb, zb], [x1, yb - 1.3, zb], [0, 0, 0.4, (zb - za) / 4]);
    wd.quadP([x0, ya - 1.3, za], [x1, ya - 1.3, za], [x1, yb - 1.3, zb], [x0, yb - 1.3, zb], [0, 0, 1, 1]);
  }
  // fascia at the ends
  for (const [z, last] of [[z0, it.first], [z1, it.last]]) {
    if (!last) continue;
    const y = yAt(z) + 0.02;
    if (z === z0) wd.quadP([x1, y - 1.3, z], [x0, y - 1.3, z], [x0, y, z], [x1, y, z]);
    else wd.quadP([x0, y - 1.3, z], [x1, y - 1.3, z], [x1, y, z], [x0, y, z]);
  }
  // piles under it
  col(pile, C('#4a3a2c'));
  for (let z = z0 + 4; z < z1; z += 11) for (let x = x0 + 5; x < x1; x += 12) cylinder(pile, x, -6, z, 0.3, yAt(z) + 4.7, 6);
  // the railing round the outside: white posts, two rails; lamp posts with globes
  col(st, C('#f0ece4'));
  const rail = (ax, az, bx, bz) => {
    const L = Math.hypot(bx - ax, bz - az);
    const n = Math.max(1, Math.round(L / 3));
    for (let k = 0; k <= n; k++) {
      const x = ax + (bx - ax) * k / n, z = az + (bz - az) * k / n;
      st.box(x, yAt(z), z, 0.12, 1.15, 0.12);
    }
    for (const h of [0.6, 1.12]) {
      for (let k = 0; k < n; k++) {
        const xa = ax + (bx - ax) * k / n, za = az + (bz - az) * k / n, xb = ax + (bx - ax) * (k + 1) / n, zb = az + (bz - az) * (k + 1) / n;
        st.beam(xa, yAt(za) + h, za, xb, yAt(zb) + h, zb, 0.08, 0.08);
      }
    }
  };
  rail(x1 - 0.3, z0, x1 - 0.3, z1);
  if (it.first) rail(x0 + 1, z0 + 0.3, x1, z0 + 0.3);
  if (it.last) rail(x0 + 1, z1 - 0.3, x1, z1 - 0.3);
  for (let z = PZ0 + 10; z < PZ1; z += 24) {
    if (z < z0 || z >= z1) continue;
    const y = yAt(z);
    col(st, C('#2a4a6a'));
    st.box(x1 - 0.5, y, z, 0.16, 3.2, 0.16);
    col(gl, C('#ffe8b0', 2.6));
    gl.box(x1 - 0.5, y + 3.2, z, 0.5, 0.5, 0.5);
  }
  for (let x = PX0 + 20; x < PX1; x += 30) {
    for (const [z, on] of [[PZ0 + 0.5, it.first], [PZ1 - 0.5, it.last]]) {
      if (!on) continue;
      const y = yAt(z);
      col(st, C('#2a4a6a'));
      st.box(x, y, z, 0.16, 3.2, 0.16);
      col(gl, C('#ffe8b0', 2.6));
      gl.box(x, y + 3.2, z, 0.5, 0.5, 0.5);
    }
  }
  // benches facing out to sea along the east rail
  const nb = B.near(M.wood);
  col(nb, C('#8a6a4a'));
  for (let z = z0 + 6; z < z1 - 4; z += 16) { const y = yAt(z); nb.box(x1 - 2.2, y + 0.45, z, 0.6, 0.08, 2.2); nb.box(x1 - 2.5, y + 0.5, z, 0.1, 0.6, 2.2); }
}

function ferrisWheel(B, M, it) {
  const { x, z, y0 } = it;
  const R = 26, hubY = y0 + 31, N = 20;
  const st = B.acc(M.steel), gl = B.acc(M.glow), pa = B.acc(M.paint);
  // the two A-frames either side of the wheel, the axle, the boarding deck
  col(st, C('#e8e4dc'));
  for (const sz of [-4.2, 4.2]) {
    for (const sx of [-1, 1]) st.beam(x + sx * 15, y0, z + sz * 1.6, x + sx * 0.6, hubY - 0.6, z + sz, 1.0, 1.0);
    st.beam(x - 9, y0 + 12, z + sz * 1.35, x + 9, y0 + 12, z + sz * 1.35, 0.5, 0.5);
  }
  col(st, C('#c8c4bc'));
  tube(st, x, hubY, z - 5, x, hubY, z + 5, 1.1, 10);
  col(pa, C('#2a4a6a'));
  box(pa, x, y0, z + 7, 12, 2.4, 6, 0, {});
  col(pa, C('#e8e4dc'));
  box(pa, x, y0 + 2.4, z + 7, 12.4, 0.2, 6.4, 0, {});
  // the turning wheel: built about its hub, two rims, spokes and ties, its bulbs
  const wa = new Acc(true), ga = new Acc(true), ca = new Acc(true);
  const rim = 48;
  wa.col = C('#f0ece4');
  for (const sz of [-2.2, 2.2]) {
    for (let k = 0; k < rim; k++) {
      const a0 = (k / rim) * Math.PI * 2, a1 = ((k + 1) / rim) * Math.PI * 2;
      wa.beam(Math.cos(a0) * R, Math.sin(a0) * R, sz, Math.cos(a1) * R, Math.sin(a1) * R, sz, 0.45, 0.45);
      wa.beam(Math.cos(a0) * (R - 2.2), Math.sin(a0) * (R - 2.2), sz, Math.cos(a1) * (R - 2.2), Math.sin(a1) * (R - 2.2), sz, 0.3, 0.3);
    }
    for (let k = 0; k < N; k++) {
      const a = (k / N) * Math.PI * 2, b = ((k + 0.5) / N) * Math.PI * 2;
      wa.beam(Math.cos(a) * 1.2, Math.sin(a) * 1.2, sz * 0.4, Math.cos(a) * R, Math.sin(a) * R, sz, 0.22, 0.22);
      wa.beam(Math.cos(a) * (R - 2.2), Math.sin(a) * (R - 2.2), sz, Math.cos(b) * R, Math.sin(b) * R, sz, 0.16, 0.16);
    }
  }
  for (let k = 0; k < N; k++) {
    const a = (k / N) * Math.PI * 2;
    wa.beam(Math.cos(a) * R, Math.sin(a) * R, -2.2, Math.cos(a) * R, Math.sin(a) * R, 2.2, 0.3, 0.3);
  }
  // bulbs: chasing round both rims, steady white down the spokes
  const nb = 64;
  for (const sz of [-2.45, 2.45]) {
    for (let k = 0; k < nb; k++) {
      const a = (k / nb) * Math.PI * 2;
      chaseBulb(ca, Math.cos(a) * (R + 0.35), Math.sin(a) * (R + 0.35), sz, 0.38, C(NEON[Math.floor(k / 2) % 3], 3.4), k);
    }
  }
  ga.col = C('#fff4dc', 2.8);
  for (let k = 0; k < N; k++) {
    const a = (k / N) * Math.PI * 2;
    for (let r = 4; r < R - 1; r += 2.6) for (const sz of [-2.45, 2.45]) ga.box(Math.cos(a) * r, Math.sin(a) * r - 0.14, sz * (0.4 + 0.6 * r / R), 0.26, 0.26, 0.26);
  }
  const g = new THREE.Group();
  g.position.set(x, hubY, z);
  g.add(new THREE.Mesh(wa.toGeometry(false), M.steel), new THREE.Mesh(ga.toGeometry(false), M.glow), new THREE.Mesh(ca.toGeometry(false), M.chase));
  for (const m of g.children) { m.matrixAutoUpdate = false; m.updateMatrix(); }
  // the gondolas: hung from the rim's outside, kept upright
  const cab = new Acc(true), cabG = new Acc(true);
  cab.col = [1, 1, 1];
  cab.beam(0, 0, 0, 0, -1.2, 0, 0.12, 0.12);
  cab.box(0, -3.4, 0, 2.2, 2.0, 2.6);
  cab.col = [0.85, 0.85, 0.85];
  cab.box(0, -1.4, 0, 2.6, 0.25, 3.0);
  cabG.col = C('#ffe8c0', 1.6);
  cabG.box(0, -2.7, 0, 2.24, 0.7, 2.64, 0, 1, false);
  const gm = new THREE.InstancedMesh(cab.toGeometry(true), M.paint, N);
  const gw = new THREE.InstancedMesh(cabG.toGeometry(false), M.glow, N);
  const tint = new THREE.Color();
  for (let k = 0; k < N; k++) { tint.set(PASTEL[k % 6]); gm.setColorAt(k, tint); }
  gm.frustumCulled = false; gw.frustumCulled = false;
  B.group.add(g, gm, gw);
  const mtx = new THREE.Matrix4();
  const spin = 0.065, phase = (it.n % 10) * 0.6;
  const place = (t) => {
    const a = t * spin + phase;
    g.rotation.z = a;
    g.updateMatrix();
    for (let k = 0; k < N; k++) {
      const ang = a + (k / N) * Math.PI * 2;
      mtx.makeTranslation(x + Math.cos(ang) * (R + 0.4), hubY + Math.sin(ang) * (R + 0.4), z);
      gm.setMatrixAt(k, mtx);
      gw.setMatrixAt(k, mtx);
    }
    gm.instanceMatrix.needsUpdate = true;
    gw.instanceMatrix.needsUpdate = true;
  };
  g.matrixAutoUpdate = false;
  place(0);
  B.anim((t, dt, d) => { if (d < 700) place(t); });
  // the ticket booth on the deck
  col(pa, C('#e85a8a'));
  box(pa, x - 12, y0, z + 9, 3, 2.6, 2.4, 0, {});
  col(gl, C('#ffe8b0', 1.4));
  box(gl, x - 12, y0 + 1, z + 10.22, 2.2, 0.9, 0.04, 0, {});
}

function carousel(B, M, it, uv) {
  const { x, z, y0 } = it;
  const pa = B.acc(M.paint), wd = B.acc(M.wood), sg = B.acc(M.sign);
  // the fixed plinth and its little fence
  col(wd, C('#9a7a5a'));
  cylinder(wd, x, y0, z, 9.6, 0.5, 16, { top: true });
  col(pa, C('#e8d8a8'));
  for (let k = 0; k < 24; k++) { const a = k / 24 * Math.PI * 2; pa.box(x + Math.cos(a) * 10.4, y0, z + Math.sin(a) * 10.4, 0.12, 1.0, 0.12); }
  // the turning part: floor, the gilt centre, horses on poles, the striped canopy, its bulbs
  const t = new Acc(true), g2 = new Acc(true), ch = new Acc(true);
  t.col = C('#c8a86a');
  cylinder(t, 0, 0.5, 0, 9, 0.3, 16, { top: true });
  t.col = C('#e8c860');
  cylinder(t, 0, 0.8, 0, 1.4, 6.4, 10);
  t.col = C('#f0e0c8');
  for (let k = 0; k < 16; k++) {
    const a = (k / 16) * Math.PI * 2;
    const t0 = k / 16;
    t.col = [[0.95, 0.9, 0.82], [0.35, 0.22, 0.15], [0.9, 0.85, 0.75], [0.2, 0.18, 0.18]][k % 4];
    for (const rr of [5.2, 7.6]) {
      const px = Math.cos(a + (rr > 6 ? 0.2 : 0)) * rr, pz = Math.sin(a + (rr > 6 ? 0.2 : 0)) * rr;
      const up = 1.6 + 0.5 * Math.sin(t0 * 12 + rr);
      const ry = -(a + (rr > 6 ? 0.2 : 0)) + Math.PI / 2;
      // body, neck and head, legs
      const F = frame(px, up, pz, ry);
      const b = F(0, 0, 0);
      t.box(b[0], b[1], b[2], 0.45, 0.6, 1.6, ry);
      const n = F(0, 0.4, 0.75);
      t.box(n[0], n[1], n[2], 0.32, 0.8, 0.35, ry);
      const h = F(0, 1.05, 0.95);
      t.box(h[0], h[1], h[2], 0.3, 0.32, 0.6, ry);
      for (const [lx, lz] of [[-0.15, -0.6], [0.15, -0.6], [-0.15, 0.6], [0.15, 0.6]]) { const l = F(lx, -0.6, lz); t.box(l[0], l[1], l[2], 0.12, 0.6, 0.12, ry); }
    }
  }
  t.col = C('#e8c860');
  for (let k = 0; k < 32; k++) {
    const a = (k / 32) * Math.PI * 2 + (k % 2 ? 0.2 : 0);
    const rr = k % 2 ? 7.6 : 5.2;
    t.beam(Math.cos(a) * rr, 0.8, Math.sin(a) * rr, Math.cos(a) * rr, 6.8, Math.sin(a) * rr, 0.08, 0.08);
  }
  // the canopy: a striped cone, its valance
  const seg = 16;
  for (let k = 0; k < seg; k++) {
    const a0 = (k / seg) * Math.PI * 2, a1 = ((k + 1) / seg) * Math.PI * 2;
    t.col = k % 2 ? C('#f4f0e6') : C('#d8322a');
    const A = t.v(Math.cos(a1) * 9.6, 7, Math.sin(a1) * 9.6), Bv = t.v(Math.cos(a0) * 9.6, 7, Math.sin(a0) * 9.6), T = t.v(0, 10.4, 0);
    t.tri(A, Bv, T);
    t.quadP([Math.cos(a1) * 9.6, 6.1, Math.sin(a1) * 9.6], [Math.cos(a0) * 9.6, 6.1, Math.sin(a0) * 9.6], [Math.cos(a0) * 9.6, 7, Math.sin(a0) * 9.6], [Math.cos(a1) * 9.6, 7, Math.sin(a1) * 9.6]);
    t.col = C('#2a2a2a');
    t.quadP([Math.cos(a0) * 9.5, 6.1, Math.sin(a0) * 9.5], [Math.cos(a1) * 9.5, 6.1, Math.sin(a1) * 9.5], [Math.cos(a1) * 9.5, 7, Math.sin(a1) * 9.5], [Math.cos(a0) * 9.5, 7, Math.sin(a0) * 9.5]);
  }
  t.col = C('#e8c860');
  coneC(t, 0, 10.4, 0, 0.5, 1.4, 6);
  for (let k = 0; k < 48; k++) {
    const a = (k / 48) * Math.PI * 2;
    chaseBulb(ch, Math.cos(a) * 9.75, 6.55, Math.sin(a) * 9.75, 0.26, C(k % 2 ? '#fff0c0' : '#ffb0d0', 3.2), k);
  }
  g2.col = C('#fff0c8', 2.4);
  for (let k = 0; k < 16; k++) { const a = (k / 16) * Math.PI * 2; g2.box(Math.cos(a) * 4, 6.6, Math.sin(a) * 4, 0.3, 0.3, 0.3); }
  const grp = new THREE.Group();
  grp.position.set(x, y0, z);
  grp.add(new THREE.Mesh(t.toGeometry(true), M.paint), new THREE.Mesh(g2.toGeometry(false), M.glow), new THREE.Mesh(ch.toGeometry(false), M.chase));
  for (const m of grp.children) { m.matrixAutoUpdate = false; m.updateMatrix(); }
  B.group.add(grp);
  B.anim((tt, dt, d) => { if (d < 500) grp.rotation.y = -tt * 0.45; });
  // its sign on a post, facing the pier's road
  col(pa, C('#2a4a6a'));
  pa.box(x - 10.8, y0, z - 6, 0.2, 4.6, 0.2);
  panel(sg, x - 10.8, y0 + 4.4, z - 6, 4.4, 1.0, -Math.PI / 2, uv.carousel, true);
}

function dropTower(B, M, it, uv) {
  const { x, z, y0 } = it;
  const H = 46;
  const st = B.acc(M.steel), gl = B.acc(M.glow), ch = B.acc(M.chase), sg = B.acc(M.sign), pa = B.acc(M.paint);
  col(pa, C('#2a4a6a'));
  cylinder(pa, x, y0, z, 4, 1.2, 12, { top: true });
  col(st, C('#ecebe6'));
  cylinder(st, x, y0 + 1.2, z, 1.4, H - 4, 12, { r2: 1.2 });
  col(st, C('#d8322a'));
  cylinder(st, x, y0 + H - 4, z, 2.4, 4, 12, { top: true });
  // chaser lights up two sides of the mast
  for (let k = 0; k < 40; k++) {
    const y = y0 + 3 + k * 1.05;
    chaseBulb(ch, x + 1.45, y, z, 0.28, C(k % 2 ? '#7aff5a' : '#ffffff', 3.2), k);
    chaseBulb(ch, x - 1.45, y, z, 0.28, C(k % 2 ? '#ff3a8a' : '#ffffff', 3.2), k);
  }
  col(gl, C('#7aff5a', 3));
  gl.box(x, y0 + H + 0.3, z, 0.7, 0.7, 0.7);
  // the sign on the plinth
  panel(sg, x, y0 + 2.4, z + 4.05, 5, 1.25, 0, uv.plunge, true);
  // the ring of seats: rises slowly, hangs, drops
  const r = new Acc(true);
  r.col = C('#2a2a2e');
  cylinder(r, 0, 0, 0, 2.2, 1.2, 12, { top: true });
  for (let k = 0; k < 10; k++) {
    const a = (k / 10) * Math.PI * 2;
    r.col = C(PASTEL[k % PASTEL.length]);
    r.box(Math.cos(a) * 2.7, -0.4, Math.sin(a) * 2.7, 0.9, 1.6, 0.9, -a);
  }
  const rg = new Acc(true);
  rg.col = C('#ffe8b0', 2.2);
  for (let k = 0; k < 12; k++) { const a = (k / 12) * Math.PI * 2; rg.box(Math.cos(a) * 2.25, 1.25, Math.sin(a) * 2.25, 0.2, 0.2, 0.2); }
  const grp = new THREE.Group();
  grp.add(new THREE.Mesh(r.toGeometry(true), M.paint), new THREE.Mesh(rg.toGeometry(false), M.glow));
  for (const m of grp.children) { m.matrixAutoUpdate = false; m.updateMatrix(); }
  grp.position.set(x, y0 + 3, z);
  B.group.add(grp);
  const ph = (it.n % 7) * 3.1;
  B.anim((t, dt, d) => {
    if (d > 700) return;
    const c = (t + ph) % 22;
    let y;
    if (c < 12) y = 3 + (c / 12) * (H - 9);        // up
    else if (c < 15) y = H - 6;                     // the wait at the top
    else if (c < 16.6) { const k = (c - 15) / 1.6; y = H - 6 - (H - 9) * k * k; } // the drop
    else y = 3;
    grp.position.y = y0 + y;
  });
}

function booth(B, M, it, uv) {
  const { x, z, ry, w, d } = it;
  const y0 = it.y0;
  const F = frame(x, y0, z, ry);
  const wd = B.acc(M.wood), sh = B.acc(M.shack), pa = B.acc(M.paint), sg = B.acc(M.sign);
  col(wd, C(PASTEL[(it.k + 2) % PASTEL.length]));
  lbox(wd, F, ry, 0, 0, 0, w, 3.6, d, { u: 3, faces: 'blr' });
  const f = F(0, 1.8, d / 2 + 0.02);
  panel(sh, f[0], f[1], f[2], w, 3.6, ry, shackUV(it.k));
  col(pa, C('#f0ece4'));
  lbox(pa, F, ry, 0, 3.6, 0, w + 0.4, 0.3, d + 0.4, {});
  const s = F(0, 4.4, d / 2 - 0.2);
  panel(sg, s[0], s[1], s[2], Math.min(w - 0.6, 4), Math.min(w - 0.6, 4) * 72 / 300, ry, uv[it.sign], true);
}

function pierTip(B, M, it, uv) {
  const r = B.net.byId.get('p9_pier');
  const { x, z, y0 } = it;
  const wd = B.acc(M.wood), pa = B.acc(M.paint), gl = B.acc(M.glow), sg = B.acc(M.sign);
  // the bait shack beside the road's end, a lamp, the sign across the end
  const sx = x + 9.5;
  col(wd, C('#5a7a8a'));
  box(wd, sx, y0 - 0.2, z - 4, 6, 3.4, 5, 0, { u: 3 });
  col(pa, C('#f0ece4'));
  box(pa, sx, y0 + 3.2, z - 4, 6.6, 0.25, 5.6, 0, {});
  col(gl, C('#ffd890', 1.6));
  box(gl, sx - 3.02, y0 + 1.4, z - 4, 0.04, 1.0, 3, 0, {});
  const e = r.posAt(r.length - 2);
  col(pa, C('#2a4a6a'));
  for (const lat of [-4, 4]) { const p = r.posAt(r.length - 2, lat); pa.box(p.x, e.y, p.z, 0.2, 3.2, 0.2); }
  panel(sg, e.x, e.y + 2.6, e.z + 0.1, 8, 8 * 100 / 560, Math.PI, uv.endpier, true);
  col(pa, C('#2a4a6a'));
  pa.box(x + 6.6, y0, z + 2, 0.16, 4.4, 0.16);
  col(gl, C('#ffe8b0', 2.6));
  gl.box(x + 6.6, y0 + 4.4, z + 2, 0.5, 0.5, 0.5);
}

function arch(B, M, it, uv) {
  const r = B.net.byId.get('p9_pier');
  const st = B.acc(M.steel), sg = B.acc(M.sign), ch = B.acc(M.chase), pa = B.acc(M.paint);
  const y0 = it.y0;
  const s = 15;
  const L = r.posAt(s, -7.4), R = r.posAt(s, 7.4);
  // two posts, an arc over the road, the neon on it
  col(pa, C('#3a7ab8'));
  for (const p of [L, R]) { box(pa, p.x, y0 - 0.5, p.z, 1.1, 1.2, 1.1, it.ry, {}); cylinder(pa, p.x, y0 + 0.7, p.z, 0.32, 8.6, 8); }
  col(st, C('#e8e4dc'));
  const n = 12;
  const pts = [];
  for (let k = 0; k <= n; k++) {
    const t = k / n;
    pts.push([L.x + (R.x - L.x) * t, y0 + 8.8 + Math.sin(t * Math.PI) * 2.6, L.z + (R.z - L.z) * t]);
  }
  for (let k = 0; k < n; k++) st.beam(...pts[k], ...pts[k + 1], 0.4, 0.4);
  st.beam(L.x, y0 + 8.4, L.z, R.x, y0 + 8.4, R.z, 0.3, 0.3);
  // the sign, both ways (it faces the land, and the pier)
  const c = r.posAt(s);
  panel(sg, c.x, y0 + 9.9, c.z, 11.6, 11.6 * 210 / 900, it.ry + Math.PI, uv.pier9, true);
  // chaser bulbs along the arc
  for (let k = 0; k <= 36; k++) {
    const t = k / 36;
    const px = L.x + (R.x - L.x) * t, pz = L.z + (R.z - L.z) * t, py = y0 + 9.25 + Math.sin(t * Math.PI) * 2.6;
    chaseBulb(ch, px, py, pz, 0.3, C(['#ff3a8a', '#ffd23a', '#2ae0ff'][k % 3], 3.4), k);
  }
}

function arcade(B, M, it, uv) {
  const { x, z, w, d, ry, h } = it;
  const F = frame(x, 0, z, ry);
  const dc = B.acc(M.deco), pa = B.acc(M.paint), gl = B.acc(M.glow), ch = B.acc(M.chase), sg = B.acc(M.sign), st = B.acc(M.steel);
  const base = it.y1;
  // a pink deco block, a stepped parapet, the glass front all lit
  col(dc, C('#f4b8c8'));
  box(dc, x, it.y0, z, w, base - it.y0 + h, d, ry, { u: 12, v: 12, top: false, v0: -(base - it.y0) / 12 });
  col(pa, C('#f8e8ee'));
  box(pa, x, base + h, z, w + 0.4, 0.6, d + 0.4, ry, {});
  lbox(pa, F, ry, 0, base + h + 0.6, d / 2 - 2, w * 0.5, 3.2, 4, {});
  lbox(pa, F, ry, 0, base + h + 3.8, d / 2 - 2, w * 0.25, 2.2, 4, {});
  // the front: glazing, game glow, doors
  col(gl, C('#c870ff', 1.2));
  lbox(gl, F, ry, 0, base + 0.3, d / 2 + 0.04, w - 6, 4.2, 0.04, {});
  col(gl, C('#40e0ff', 1.6));
  for (let k = -5; k <= 5; k++) lbox(gl, F, ry, k * (w - 8) / 11, base + 1.2, d / 2 + 0.08, 1.6, 1.2, 0.02, {});
  col(pa, C('#2a2a3a'));
  for (let k = -6; k <= 6; k++) lbox(pa, F, ry, k * (w - 6) / 12, base + 0.3, d / 2 + 0.1, 0.18, 4.2, 0.1, {});
  // the marquee: neon name, chaser bulbs round it
  const sw = w * 0.82, shh = sw * 170 / 860;
  const s = F(0, base + 4.6 + shh / 2 + 0.3, d / 2 + 0.12);
  panel(sg, s[0], s[1], s[2], sw, shh, ry, uv.arcade);
  let k = 0;
  for (let t = 0; t <= 1.0001; t += 1 / 40) { const p = F(-sw / 2 - 0.4 + (sw + 0.8) * t, base + 4.5, d / 2 + 0.3); chaseBulb(ch, p[0], p[1], p[2], 0.3, C('#ffe8a0', 3.2), k++); }
  for (let t = 0; t <= 1.0001; t += 1 / 40) { const p = F(-sw / 2 - 0.4 + (sw + 0.8) * t, base + 4.9 + shh + 0.4, d / 2 + 0.3); chaseBulb(ch, p[0], p[1], p[2], 0.3, C('#ffe8a0', 3.2), k++); }
  // FUN ZONE down the side facing the pier road
  const f = F(w / 2 + 0.12, base + h * 0.6, 0);
  panel(sg, f[0], f[1], f[2], 9, 9 * 120 / 420, ry + Math.PI / 2, uv.funzone);
  // King Neptune's trident on the roof
  col(st, C('#e8c050'));
  const tp = F(0, base + h + 6, d / 2 - 2);
  st.beam(tp[0], tp[1], tp[2], tp[0], tp[1] + 9, tp[2], 0.5, 0.5);
  const T = frame(tp[0], tp[1] + 9, tp[2], ry);
  for (const dx of [-1.6, 0, 1.6]) { const a = T(dx, 0, 0), b = T(dx, 2.6, 0); st.beam(a[0], a[1], a[2], b[0], b[1], b[2], 0.35, 0.35); }
  const a = T(-1.6, 0, 0), b = T(1.6, 0, 0); st.beam(a[0], a[1], a[2], b[0], b[1], b[2], 0.35, 0.35);
  col(gl, C('#ffd23a', 2.4));
  for (const dx of [-1.6, 0, 1.6]) { const p = T(dx, 2.9, 0); gl.box(p[0], p[1], p[2], 0.4, 0.5, 0.4); }
}

function crab(B, M, it, uv) {
  const { x, z, w, d, ry, h } = it;
  const F = frame(x, 0, z, ry);
  const wd = B.acc(M.wood), pa = B.acc(M.paint), gl = B.acc(M.glow), sg = B.acc(M.sign);
  const base = it.y1;
  // weathered shingle and blue trim, a deck in front with a rail
  col(wd, C('#8aa8b0'));
  box(wd, x, it.y0, z, w, base - it.y0 + h, d, ry, { u: 3, top: false });
  col(pa, C('#2a4a6a'));
  gable(pa, x, base + h, z, w, d, 3.2, ry, { over: 0.7, endAcc: wd });
  col(gl, C('#ffc070', 1.3));
  for (let k = -3; k <= 3; k++) lbox(gl, F, ry, k * (w - 6) / 7, base + 1.2, d / 2 + 0.04, (w - 8) / 8, 2.2, 0.04, {});
  col(wd, C('#7a5a3a'));
  lbox(wd, F, ry, 0, base - 0.2, d / 2 + 3, w, 0.5, 6, { u: 3 });
  col(pa, C('#f0ece4'));
  for (let k = 0; k <= 10; k++) lbox(pa, F, ry, -w / 2 + k * w / 10, base + 0.3, d / 2 + 5.8, 0.12, 1.0, 0.12, {});
  lbox(pa, F, ry, 0, base + 1.25, d / 2 + 5.8, w, 0.1, 0.12, {});
  const s = F(0, base + h - 1.5, d / 2 + 0.1);
  panel(sg, s[0], s[1], s[2], w * 0.8, w * 0.8 * 130 / 620, ry, uv.crab);
  // a giant crab on the roof ridge
  col(pa, C('#e8402a'));
  const c = F(0, base + h + 3.4, 0);
  box(pa, c[0], c[1], c[2], 3.2, 1.2, 2.4, ry, {});
  for (const sd of [-1, 1]) {
    const cl = F(sd * 2.6, base + h + 4.2, 1.2);
    box(pa, cl[0], cl[1], cl[2], 1.4, 0.9, 1.6, ry + sd * 0.4, {});
    for (let k = 0; k < 3; k++) { const l0 = F(sd * 1.4, base + h + 3.6, -0.8 + k * 0.8), l1 = F(sd * 2.8, base + h + 3.1, -1 + k * 0.9); pa.beam(l0[0], l0[1], l0[2], l1[0], l1[1], l1[2], 0.25, 0.25); }
  }
}

// ------------------------------------------------------------------ the Comet

function cometPath(A, W) {
  // a stadium: west along v = +W/2, the west turn, east along v = −W/2, the east turn
  const R = W / 2;
  const L1 = 2 * A, L2 = Math.PI * R;
  const total = 2 * L1 + 2 * L2;
  const at = (s) => {
    s = ((s % total) + total) % total;
    if (s < L1) return [A - s, R, -1, 0];
    s -= L1;
    if (s < L2) { const a = Math.PI / 2 + s / R; return [-A + Math.cos(a) * R, Math.sin(a) * R, -Math.sin(a), Math.cos(a)]; }
    s -= L2;
    if (s < L1) return [-A + s, -R, 1, 0];
    s -= L1;
    const a = -Math.PI / 2 + s / R;
    return [A + Math.cos(a) * R, Math.sin(a) * R, -Math.sin(a), Math.cos(a)];
  };
  // the height along it: the station, the lift, the big drop, hills down the back, the turns
  const H = [[0, 3.5], [22, 3.5], [78, 25], [86, 25], [118, 2.8], [150, 17], [176, 7], [L1 + L2 * 0.5, 9], [L1 + L2, 9], [L1 + L2 + 30, 3], [L1 + L2 + 66, 13.5], [L1 + L2 + 100, 3.2], [L1 + L2 + 130, 9], [2 * L1 + L2 - 6, 4], [2 * L1 + L2 + L2 * 0.5, 6], [total, 3.5]];
  const hAt = (s) => {
    for (let k = 0; k < H.length - 1; k++) {
      const [s0, h0] = H[k], [s1, h1] = H[k + 1];
      if (s >= s0 && s <= s1) { const t = (s - s0) / (s1 - s0 || 1); return h0 + (h1 - h0) * (t * t * (3 - 2 * t)); }
    }
    return 3.5;
  };
  return { at, hAt, total };
}

function comet(B, M, it, uv) {
  const { A, W, ry } = it;
  const F = frame(it.x, 0, it.z, ry);
  const { at, hAt, total } = cometPath(A, W);
  const wood = B.acc(M.matte), track = B.acc(M.wood), st = B.acc(M.paint), gl = B.acc(M.glow), sg = B.acc(M.sign);
  const pt = (s, lat = 0) => {
    const [u, v, tu, tv] = at(s);
    // lateral: left of the direction in the (u, v) plane
    const p = F(u + -tv * lat, 0, v + tu * lat);
    return p;
  };
  const yAt = (s) => it.y0 + hAt(s);
  // bents every 4 m: two white posts to the track, X braces, ledgers to the last bent
  let prev = null;
  for (let s = 0; s < total; s += 4) {
    const top = yAt(s) - 0.5;
    const a = pt(s, -1.3), b = pt(s, 1.3);
    const ga = B.groundY(a[0], a[2]), gb = B.groundY(b[0], b[2]);
    col(wood, C('#f0ece2'));
    wood.beam(a[0], ga - 0.2, a[2], a[0], top, a[2], 0.3, 0.3);
    wood.beam(b[0], gb - 0.2, b[2], b[0], top, b[2], 0.3, 0.3);
    wood.beam(a[0], top, a[2], b[0], top, b[2], 0.26, 0.3);
    col(wood, C('#e2ddd0'));
    for (let y = Math.max(ga, gb) + 1; y < top - 2.5; y += 4.5) {
      wood.beam(a[0], y, a[2], b[0], Math.min(top, y + 4), b[2], 0.14, 0.14);
      wood.beam(b[0], y, b[2], a[0], Math.min(top, y + 4), a[2], 0.14, 0.14);
    }
    if (prev) {
      for (const [p, q] of [[prev.a, a], [prev.b, b]]) {
        const h = Math.min(prev.top, top);
        for (let y = Math.min(ga, gb) + 2.5; y < h - 1; y += 6) wood.beam(p[0], y, p[2], q[0], y, q[2], 0.12, 0.12);
      }
    }
    prev = { a, b, top };
  }
  // the track: a dark bed, two rails, bulbs along both edges
  const step = 2;
  for (let s = 0; s < total; s += step) {
    const s1 = Math.min(total, s + step);
    const a0 = pt(s, -1.25), a1 = pt(s, 1.25), b0 = pt(s1, -1.25), b1 = pt(s1, 1.25);
    const y0 = yAt(s), y1 = yAt(s1);
    col(track, C('#5a4a3a'));
    track.quadP([a1[0], y0, a1[2]], [a0[0], y0, a0[2]], [b0[0], y1, b0[2]], [b1[0], y1, b1[2]], [0, s / 3, 1, s1 / 3]);
    track.quadP([a0[0], y0 - 0.25, a0[2]], [a1[0], y0 - 0.25, a1[2]], [b1[0], y1 - 0.25, b1[2]], [b0[0], y1 - 0.25, b0[2]], [0, s / 3, 1, s1 / 3]);
    col(st, C('#9a9c9e'));
    for (const lat of [-0.65, 0.65]) { const p = pt(s, lat), q = pt(s1, lat); st.beam(p[0], y0 + 0.12, p[2], q[0], y1 + 0.12, q[2], 0.12, 0.14); }
  }
  col(gl, C('#fff2c8', 2.8));
  for (let s = 0; s < total; s += 3) {
    for (const lat of [-1.45, 1.45]) { const p = pt(s, lat); gl.box(p[0], yAt(s) + 0.1, p[2], 0.2, 0.2, 0.2); }
  }
  // the train cresting the lift
  for (let k = 0; k < 5; k++) {
    const s = 82 - k * 2.6;
    const p = pt(s);
    const [, , tu, tv] = at(s);
    const ryc = ry + Math.atan2(tv, tu) * -1;
    col(st, C(k ? '#d8322a' : '#f2c230'));
    st.box(p[0], yAt(s) + 0.3, p[2], 2.2, 1.1, 1.8, ryc + Math.PI / 2);
  }
  // the station at the start of the north straight
  const stn = pt(10, 0);
  col(st, C('#d8322a'));
  for (const [s, lat] of [[1, -4.4], [1, 4.4], [19, -4.4], [19, 4.4]]) { const p = pt(s, lat); st.box(p[0], it.y0, p[2], 0.3, 7.4, 0.3); }
  col(st, C('#f0ece2'));
  box(st, stn[0], it.y0 + 7.4, stn[2], 22, 0.6, 10, ry, {});
  col(st, C('#d8322a'));
  gable(st, stn[0], it.y0 + 8, stn[2], 22, 10, 2, ry, { over: 0.4 });
  col(B.acc(M.wood), C('#9a7a5a'));
  box(B.acc(M.wood), stn[0], it.y0, stn[2] - 0 , 20, 3.3, 3, ry, { u: 2 });
  // the name: on the station, and big on the lift hill facing the boulevard
  const sp = F(-A + 12, 0, 0);
  void sp;
  const n1 = pt(10, 0);
  panel(sg, n1[0], it.y0 + 10.8, n1[2], 9, 9 * 150 / 620, ry, uv.comet, true);
  const lt = pt(60, 0);
  panel(sg, lt[0], yAt(60) + 3.5, lt[2], 12, 12 * 150 / 620, ry + Math.PI, uv.comet, true);
  col(st, C('#f0ece2'));
  for (const d of [-4, 4]) { const p = pt(60 + d, 0); st.beam(p[0], yAt(60 + d), p[2], p[0], yAt(60) + 2, p[2], 0.2, 0.2); }
}

// ------------------------------------------------------------------ the Barnacle (hidden)

function barnacle(B, M, it, uv) {
  const { x, z, y0 } = it;
  const pa = B.acc(M.paint), wd = B.acc(M.wood), lf = B.acc(M.leaf), gl = B.acc(M.glow), fl = B.acc(M.flicker), sg = B.acc(M.sign), mt = B.acc(M.matte);
  // the thatched hut (a straw cone on bamboo poles) and its bar
  col(mt, C('#8a6a3a'));
  for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI * 2; mt.beam(x + Math.cos(a) * 3.6, y0, z - 4 + Math.sin(a) * 3.6, x + Math.cos(a) * 3.6, y0 + 3, z - 4 + Math.sin(a) * 3.6, 0.2, 0.2); }
  col(lf, C('#c8a860'));
  coneC(lf, x, y0 + 2.8, z - 4, 5.2, 3.6, 10);
  col(lf, C('#a8884a'));
  coneC(lf, x, y0 + 2.6, z - 4, 5.4, -0.6, 10);
  col(wd, C('#6a4a2a'));
  for (let k = 0; k < 5; k++) { const a = Math.PI * 0.2 + k / 5 * Math.PI * 0.8; wd.box(x + Math.cos(a) * 2.6, y0, z - 4 + Math.sin(a) * 2.6, 1.8, 1.1, 0.5, -a + Math.PI / 2); }
  col(gl, C('#ffb070', 1.6));
  gl.box(x, y0 + 2.2, z - 4, 1.4, 0.4, 1.4);
  // tiki torches round the yard (flickering flames), picnic tables
  for (const [dx, dz] of [[-8, 6], [8, 6], [-10, -2], [10, -2]]) {
    col(mt, C('#5a3a20'));
    mt.beam(x + dx, y0, z + dz, x + dx, y0 + 2.2, z + dz, 0.14, 0.14);
    col(gl, C('#ff8a2a', 3));
    gl.box(x + dx, y0 + 2.35, z + dz, 0.22, 0.4, 0.22);
    spark(fl, x + dx, y0 + 2.5, z + dz, 0.3, (dx + dz + 20) / 40, [3.4, 1.6, 0.4]);
  }
  col(wd, C('#8a6a4a'));
  for (const [dx, dz] of [[-4, 6], [4, 7], [0, 10]]) { wd.box(x + dx, y0 + 0.7, z + dz, 2.4, 0.08, 1.0); wd.box(x + dx, y0 + 0.4, z + dz - 0.9, 2.4, 0.06, 0.35); wd.box(x + dx, y0 + 0.4, z + dz + 0.9, 2.4, 0.06, 0.35); }
  // string lights between the palms and the hut, the neon on a board
  stringLights(B.near(M.paint), gl, [x - 9, y0 + 3.6, z + 9], [x + 1, y0 + 3.4, z - 4], 0.8, 12, [C('#ff4a8a', 3), C('#4ae0ff', 3), C('#ffd84a', 3)]);
  stringLights(B.near(M.paint), gl, [x + 9, y0 + 3.6, z + 9], [x - 1, y0 + 3.4, z - 4], 0.8, 12, [C('#4ae0ff', 3), C('#ffd84a', 3), C('#ff4a8a', 3)]);
  col(pa, C('#3a2a1a'));
  pa.box(x - 2.6, y0, z + 1, 0.2, 3.6, 0.2);
  pa.box(x + 2.6, y0, z + 1, 0.2, 3.6, 0.2);
  panel(sg, x, y0 + 3.2, z + 1.05, 5.2, 5.2 * 130 / 520, it.ry, uv.barnacle, true);
  for (const [dx, dz] of [[-9, 9], [9, 9]]) palm(B.acc(M.matte), lf, x + dx, B.groundY(x + dx, z + dz), z + dz, 9, 0.15, 0.5, -0.8, makeRng(`bp${dx}`));
}

// ------------------------------------------------------------------ hotels, the diner

function hotel(B, M, it, uv) {
  const { x, z, w, d, ry, h } = it;
  const F = frame(x, 0, z, ry);
  const dc = B.acc(M.deco), pa = B.acc(M.paint), gl = B.acc(M.glow), sg = B.acc(M.sign);
  const base = it.y1;
  const tint = C(it.tint);
  col(dc, tint);
  box(dc, x, it.y0, z, w, base - it.y0 + h, d, ry, { u: 12, v: 12, top: false, v0: -(base - it.y0) / 12 });
  // a stepped deco crown over the middle, rounded-ish corners (pilasters), a parapet
  col(pa, [tint[0] * 1.05, tint[1] * 1.05, tint[2] * 1.05]);
  box(pa, x, base + h, z, w + 0.3, 0.8, d + 0.3, ry, {});
  lbox(pa, F, ry, 0, base + h + 0.8, d / 2 - 2, w * 0.36, 2.4, 4, {});
  lbox(pa, F, ry, 0, base + h + 3.2, d / 2 - 2, w * 0.18, 1.8, 4, {});
  for (const sd of [-1, 1]) lbox(pa, F, ry, sd * (w / 2 - 0.8), base, d / 2 + 0.2, 1.6, h + 0.8, 0.6, {});
  // the canopy over the door, lit underneath
  col(pa, C('#2a4a6a'));
  lbox(pa, F, ry, 0, base + 3.2, d / 2 + 1.6, 7, 0.3, 3.2, {});
  col(gl, C('#fff0d0', 2));
  lbox(gl, F, ry, 0, base + 3.18, d / 2 + 1.6, 6, 0.04, 2.4, { top: false, bottom: true });
  col(gl, C('#ffe0b0', 1.4));
  lbox(gl, F, ry, 0, base + 0.3, d / 2 + 0.05, 4, 2.6, 0.04, {});
  // the name: a vertical blade sign on the corner, and along the crown
  const bl = F(w / 2 - 2.4, base + h - 0.5, d / 2 + 1.4);
  col(pa, C('#1a1a24'));
  box(pa, bl[0], bl[1] - h * 0.55, bl[2], 0.5, h * 0.75, 0.5, ry, {});
  const c = F(0, base + h + 2, d / 2 + 0.06);
  panel(sg, c[0], c[1], c[2], w * 0.34, w * 0.34 * 100 / 460, ry, uv[it.name]);
  const bs = F(w / 2 - 2.4, base + h * 0.55, d / 2 + 1.7);
  const bw = Math.min(h * 0.7, 9);
  // the blade: the name turned on end
  const T = frame(bs[0], bs[1], bs[2], ry + Math.PI / 2);
  const q = (a, b) => T(a, b, 0);
  const u = uv[it.name];
  const s0 = bw / 2, s1 = bw * 100 / 460 / 2;
  sg.quadP(q(-s1, -s0), q(s1, -s0), q(s1, s0), q(-s1, s0), [u[0], u[3], u[2], u[1]]);
  sg.quadP(q(s1, -s0), q(-s1, -s0), q(-s1, s0), q(s1, s0), [u[0], u[3], u[2], u[1]]);
}

function diner(B, M, it, uv) {
  const { x, z, w, d, ry } = it;
  const F = frame(x, 0, z, ry);
  const st = B.acc(M.steel), pa = B.acc(M.paint), gl = B.acc(M.glow), sg = B.acc(M.sign), ch = B.acc(M.chase);
  const base = it.y1, h = 4.6;
  // a chrome-and-teal diner car: rounded roof, a band of windows
  col(pa, C('#e8e4dc'));
  box(pa, x, it.y0, z, w, base - it.y0 + 1.2, d, ry, {});
  col(st, C('#c8ccd0'));
  lbox(st, F, ry, 0, base + 1.2, 0, w, 0.6, d, {});
  col(pa, C('#3ab8b0'));
  lbox(pa, F, ry, 0, base + 3.4, 0, w, 1.2, d, {});
  col(gl, C('#ffe8c0', 1.5));
  lbox(gl, F, ry, 0, base + 1.8, 0, w + 0.06, 1.6, d + 0.06, { top: false });
  col(st, C('#d8dce0'));
  const n = 8;
  for (let k = 0; k < n; k++) {
    const a0 = (k / n) * Math.PI, a1 = ((k + 1) / n) * Math.PI;
    const P = (lx, a) => F(lx, base + h + Math.sin(a) * 1.4, -Math.cos(a) * d / 2);
    st.quadP(P(w / 2, a0), P(-w / 2, a0), P(-w / 2, a1), P(w / 2, a1));
  }
  // the big sign on legs on the roof, chasers round it
  const sw = w * 0.7, sh2 = sw * 140 / 640;
  const s = F(0, base + h + 2.6 + sh2 / 2, 0.3);
  panel(sg, s[0], s[1], s[2], sw, sh2, ry, uv.diner, true);
  col(st, C('#3a3a40'));
  for (const sd of [-1, 1]) lbox(st, F, ry, sd * sw * 0.4, base + h + 1, 0.3, 0.2, 1.8, 0.2, {});
  let k = 0;
  for (let t = 0; t <= 1.0001; t += 1 / 30) { const p = F(-sw / 2 + sw * t, base + h + 2.4, 0.5); chaseBulb(ch, p[0], p[1], p[2], 0.24, C('#ff9ad8', 3.2), k++); }
}

// ------------------------------------------------------------------ the shacks

function shack(B, M, it, uv) {
  const { x, z, w, d, ry } = it;
  const F = frame(x, 0, z, ry);
  const wd = B.acc(M.wood), sh = B.acc(M.shack), pa = B.acc(M.paint), sg = B.acc(M.sign);
  const base = it.y1;
  const H = 4.5;
  col(wd, C(it.tint));
  box(wd, x, it.y0, z, w, base - it.y0 + H, d, ry, { u: 3, top: false, faces: 'blr', v0: 0 });
  // the front: the shack picture (counter, awning, goods)
  const f = F(0, base + H / 2, d / 2 + 0.02);
  panel(sh, f[0], f[1], f[2], w, H, ry, shackUV(it.k));
  col(wd, C(it.tint));
  if (base - it.y0 > 0.05) lbox(wd, F, ry, 0, it.y0 - 0, d / 2 - 0.05, w, base - it.y0, 0.1, { u: 3 });
  // the roof and the sign on it
  col(pa, C('#f4f0e6'));
  if (it.roof === 'gable') gable(pa, x, base + H, z, w, d, 1.6, ry, { over: 0.4, endAcc: wd });
  else { box(pa, x, base + H, z, w + 0.3, 0.35, d + 0.3, ry, {}); }
  const sw = Math.min(w - 0.8, 4.6);
  const s = F(0, base + H + (it.roof === 'gable' ? 0.9 : 0.85), d / 2 + 0.25);
  panel(sg, s[0], s[1], s[2], sw, sw * 72 / 300, ry, uv[it.sign], true);
}

// ------------------------------------------------------------------ the beach

function guardTower(B, M, it) {
  const { x, z, y0, ry, k } = it;
  const F = frame(x, y0, z, ry);
  const wd = B.acc(M.wood), pa = B.acc(M.paint), gl = B.acc(M.glow);
  const cols = ['#4ab0d8', '#f2b632', '#e85a8a', '#5ac87a'];
  // stilts, the deck, the cabin with its windows all round, the ramp
  col(pa, C('#e8e4dc'));
  for (const [a, b] of [[-1.4, -1.4], [1.4, -1.4], [-1.4, 1.4], [1.4, 1.4]]) lbox(pa, F, ry, a, -0.4, b, 0.25, 2.8, 0.25, {});
  col(wd, C('#b8a088'));
  lbox(wd, F, ry, 0, 2.3, 0.6, 4, 0.2, 4.4, { u: 2 });
  col(pa, C(cols[k % cols.length]));
  lbox(pa, F, ry, 0, 2.5, 0, 3, 2.2, 3, {});
  col(pa, C('#f4f0e6'));
  lbox(pa, F, ry, 0, 4.7, 0, 3.6, 0.3, 3.6, {});
  col(gl, C('#ffe8c0', 0.8));
  lbox(gl, F, ry, 0, 3.4, 1.52, 2.4, 0.9, 0.04, {});
  col(wd, C('#a89078'));
  const r0 = F(0, 2.4, 2.8), r1 = F(0, 0, 7.2);
  wd.beam(r0[0], r0[1], r0[2], r1[0], r1[1], r1[2], 1.3, 0.15);
  // the flag
  col(pa, C('#d8d8d8'));
  const fp = F(1.6, 4.9, -1.6);
  pa.beam(fp[0], fp[1], fp[2], fp[0], fp[1] + 2.4, fp[2], 0.06, 0.06);
  col(pa, C(k % 2 ? '#d8322a' : '#f2d23a'));
  const fl = frame(fp[0], fp[1] + 2.4, fp[2], ry);
  pa.quadP(fl(0, -0.7, 0), fl(1.1, -0.7, 0), fl(1.1, 0, 0), fl(0, 0, 0));
  pa.quadP(fl(1.1, -0.7, 0), fl(0, -0.7, 0), fl(0, 0, 0), fl(1.1, 0, 0));
}

function umbrellas(B, M, it) {
  const rng = makeRng(seedOf(it));
  const pa = B.near(M.paint), mt = B.near(M.matte);
  for (let k = 0; k < it.n; k++) {
    const x = it.x + (rng() - 0.5) * 18, z = it.z + (rng() - 0.5) * 10;
    const y = B.groundY(x, z);
    if (y < 0.7) continue;
    const c1 = C(PASTEL[Math.floor(rng() * PASTEL.length)]), c2 = C(['#d8322a', '#2a7ab8', '#f2b632', '#2f9a5a', '#f4f0e6'][Math.floor(rng() * 5)]);
    const tilt = (rng() - 0.5) * 0.3;
    col(pa, C('#e8e4dc'));
    pa.beam(x, y - 0.2, z, x + tilt, y + 2.3, z, 0.06, 0.06);
    const seg = 8;
    for (let s = 0; s < seg; s++) {
      const a0 = (s / seg) * Math.PI * 2, a1 = ((s + 1) / seg) * Math.PI * 2;
      pa.col = s % 2 ? c1 : c2;
      const A = pa.v(x + tilt + Math.cos(a1) * 1.4, y + 1.9, z + Math.sin(a1) * 1.4), Bv = pa.v(x + tilt + Math.cos(a0) * 1.4, y + 1.9, z + Math.sin(a0) * 1.4), T = pa.v(x + tilt, y + 2.45, z);
      pa.tri(A, Bv, T);
      pa.tri(Bv, A, T);
    }
    // a towel or two
    col(mt, C(PASTEL[Math.floor(rng() * PASTEL.length)]));
    const ta = rng() * Math.PI, tx = x + 1.6, tz = z + 0.6;
    const ca = Math.cos(ta), sa = Math.sin(ta);
    const P = (a, b) => [tx + a * ca + b * sa, B.groundY(tx, tz) + 0.04, tz - a * sa + b * ca];
    mt.quadP(P(-0.8, 0.45), P(0.8, 0.45), P(0.8, -0.45), P(-0.8, -0.45));
  }
}

function lifeguardHQ(B, M, it, uv) {
  const { x, z, w, d, ry } = it;
  const F = frame(x, 0, z, ry);
  const pa = B.acc(M.paint), wd = B.acc(M.wood), gl = B.acc(M.glow), sg = B.acc(M.sign), dc = B.acc(M.deco);
  const base = it.y1;
  col(dc, C('#f4f0e6'));
  box(dc, x, it.y0, z, w, base - it.y0 + 7.5, d, ry, { u: 12, v: 12, top: false, v0: -(base - it.y0) / 12 });
  col(pa, C('#d8322a'));
  box(pa, x, base + 7.5, z, w + 0.4, 0.5, d + 0.4, ry, {});
  // the lookout on the roof: glass all round, a flag mast
  col(pa, C('#f4f0e6'));
  lbox(pa, F, ry, -w / 4, base + 8, 0, 6, 0.4, 6, {});
  col(gl, C('#bfe0ff', 1.2));
  lbox(gl, F, ry, -w / 4, base + 8.4, 0, 5.6, 2.2, 5.6, { top: false });
  col(pa, C('#d8322a'));
  lbox(pa, F, ry, -w / 4, base + 10.6, 0, 6.4, 0.4, 6.4, {});
  const s = F(w / 6, base + 5.4, -d / 2 - 0.08);
  panel(sg, s[0], s[1], s[2], 9, 9 * 100 / 440, ry + Math.PI, uv.lifeguard, true);
  col(wd, C('#b8a088'));
  lbox(wd, F, ry, 0, base - 0.1, d / 2 + 2, w - 2, 0.3, 4, { u: 2 });
}

// ------------------------------------------------------------------ Smugglers' Cove (hidden)

function cove(B, M, it, uv) {
  const { x, z, y0, ry } = it;
  const F = frame(x, y0, z, ry);
  const wd = B.acc(M.wood), pa = B.acc(M.paint), gl = B.acc(M.glow), fl = B.acc(M.flicker), sg = B.acc(M.sign), mt = B.acc(M.matte), lf = B.acc(M.leaf);
  // the shack on stilts: weathered planks, a tin roof, a lamp at the door
  col(pa, C('#3a2a20'));
  for (const [a, b] of [[-8.5, -2.6], [-1.5, -2.6], [-8.5, 2.6], [-1.5, 2.6]]) lbox(pa, F, ry, a, -0.6, b, 0.3, 1.8, 0.3, {});
  col(wd, C('#8a7a68'));
  lbox(wd, F, ry, -5, 1.2, 0, 7, 3, 5.2, { u: 3 });
  col(pa, C('#6a6e72'));
  gable(pa, ...F(-5, 4.2, 0), 7, 5.2, 1.2, ry, { over: 0.5 });
  col(gl, C('#ffc070', 1.6));
  lbox(gl, F, ry, -5, 2.0, 2.62, 1.6, 1.2, 0.04, {});
  col(wd, C('#7a6a58'));
  lbox(wd, F, ry, -5, 1.0, 3.6, 7, 0.2, 2.2, { u: 2 });
  // surfboards leaning on it, a rack
  const boards = ['#ff7a2a', '#2ab8ff', '#ffe02a', '#ff4a8a', '#f4f0e6'];
  for (let k = 0; k < 5; k++) {
    col(pa, C(boards[k]));
    const b0 = F(-8.6 + k * 0.8, 0, 3.4), b1 = F(-8.9 + k * 0.8, 2.6, 3.0);
    pa.beam(b0[0], b0[1], b0[2], b1[0], b1[1], b1[2], 0.55, 0.08);
  }
  // the bonfire in its ring of stones, driftwood logs to sit on
  const fp = F(6, 0, 4);
  col(mt, C('#5a5650'));
  for (let k = 0; k < 9; k++) { const a = k / 9 * Math.PI * 2; mt.box(fp[0] + Math.cos(a) * 1.2, fp[1] - 0.1, fp[2] + Math.sin(a) * 1.2, 0.5, 0.35, 0.4, a); }
  col(gl, C('#ff7a1a', 3.4));
  coneC(gl, fp[0], fp[1], fp[2], 0.8, 1.6, 6);
  col(gl, C('#ffd23a', 3.6));
  coneC(gl, fp[0], fp[1], fp[2], 0.4, 1.0, 5);
  for (let k = 0; k < 4; k++) spark(fl, fp[0] + (k - 1.5) * 0.3, fp[1] + 1.2 + k * 0.3, fp[2], 0.35, k / 4, [3.6, 1.4, 0.3]);
  col(mt, C('#8a7a68'));
  for (const [dx, dz, a] of [[3, 6, 0.3], [9, 2, 1.4], [5, 0.5, -0.5]]) { const p = F(dx, 0, dz); mt.box(p[0], p[1], p[2], 3, 0.45, 0.5, ry + a); }
  // the sign on a post facing the track, a hammock
  const sp = F(-2, 0, -6);
  col(pa, C('#3a2a20'));
  pa.box(sp[0], sp[1] - 0.2, sp[2], 0.2, 2.8, 0.2);
  panel(sg, sp[0], sp[1] + 2.4, sp[2], 4.2, 4.2 * 110 / 520, ry + Math.PI, uv.cove, true);
  const ss = F(-5, 3.2, 2.66);
  panel(sg, ss[0], ss[1], ss[2], 3.4, 3.4 * 90 / 380, ry, uv.surfshack, true);
  void lf;
}

export { cometPath };
