// PORT HALCYON — HALCYON POINT: the island at the mouth of the bay. Halcyon
// Light at its south tip (a white tower with a red band on a knuckle of
// rock, its beam sweeping the water at night) and the keeper's house and
// fog signal behind it; the marina on the north shore (pontoons, yachts,
// the yacht club up on its piles, a rock breakwater with its harbour
// lights); St. Elmo's chapel and the Point Store where the lanes meet;
// clapboard cottages along Point Road behind dry-stone walls; wind-bent
// cypress over the whole island, rocks round its shore. Hidden: Battery
// Halcyon (a wartime gun battery off the gravel Battery Road) and Blueglow
// Cove (down the cove trail: a boathouse, a sea arch, and surf that glows
// blue at night).
import * as THREE from 'three';
import { makeRng } from '../../core/util.js';
import { U } from '../kit.js';
import { litMat, box, cylinder, gable, sphere, drape } from './builder.js';
import { Acc } from '../build/geo.js';
import { mats, C, col, frame, frame3, lbox, tube, panel, seedOf, groundStrip, coneC, windTree, mixC, warmBuilders } from './coast/kit.js';
import { signAtlas } from './coast/tex.js';
import { homeMats, rockLump, rockPile, stoneWall, picket, cottage, car, lampPost, blob } from './coast/home.js';

const WIND = [0.8, -0.6];                 // the south-westerly: trees lean north-east
const TINTS = ['#f4f2ec', '#dfe8ee', '#f0e6c8', '#e8d6d0', '#d8e4d0', '#cfd8e4', '#f6f0e0', '#e4dccc'];
const ROOFS = ['#3a3e44', '#5a3a2e', '#2e3a44', '#4a4a46', '#6a3a2a', '#2a3a30'];

// ------------------------------------------------------------------ signs

const SIGNS = [
  { id: 'club', w: 820, h: 120, text: 'HALCYON POINT YACHT CLUB', style: 'box', bg: '#f4f2ea', fg: '#1d3a5a', glow: '#fff4dc', fgGlow: '#1d3a5a' },
  { id: 'marina', w: 560, h: 120, text: 'MARINA', sub: 'VISITOR BERTHS · FUEL · ICE', style: 'paint', bg: '#1d3a5a', fg: '#f4f2ea' },
  { id: 'fuel', w: 240, h: 90, text: 'FUEL', style: 'box', bg: '#e8c23a', fg: '#1d1d1d', glow: '#ffe08a', fgGlow: '#2a2010' },
  { id: 'store', w: 620, h: 130, text: 'POINT STORE', sub: 'GROCERIES · BAIT · ICE · GAS', style: 'paint', bg: '#7a2a1d', fg: '#f6eedc' },
  { id: 'open', w: 220, h: 90, text: 'OPEN', style: 'neon', glow: '#ff3a3a' },
  { id: 'chapel', w: 560, h: 110, text: "ST. ELMO'S CHAPEL", sub: 'FOR ALL WHO SAIL', style: 'paint', bg: '#f2efe6', fg: '#2a2a2a' },
  { id: 'light', w: 560, h: 120, text: 'HALCYON LIGHT', sub: 'ESTABLISHED 1889', style: 'paint', bg: '#f4f2ea', fg: '#8a2a20' },
  { id: 'battery', w: 620, h: 150, text: 'BATTERY HALCYON', sub: '1942 · KEEP OUT', style: 'paint', bg: '#4a5038', fg: '#e8e4d0' },
  { id: 'danger', w: 440, h: 130, text: 'DANGER', sub: 'UNSTABLE STRUCTURES', style: 'paint', bg: '#c8302a', fg: '#ffffff' },
  { id: 'cove', w: 500, h: 110, text: 'BLUEGLOW COVE', style: 'paint', bg: '#24323e', fg: '#9ae8ff' },
  { id: 'boats', w: 440, h: 100, text: 'BOATS FOR HIRE', sub: 'ASK AT THE HUT', style: 'paint', bg: '#f2e6c8', fg: '#2a4a6a' },
  { id: 'point', w: 660, h: 130, text: 'HALCYON POINT', sub: 'PLEASE DRIVE SLOWLY', style: 'paint', bg: '#2a4a3a', fg: '#f4f0e0' },
];
const atlas = () => signAtlas('point', SIGNS, 1024, 1024, 0.8);
const UV = () => atlas().uv;

/** The lighthouse's beam: additive, no fog (it is the light in the fog), night only. */
function lightBeamMat() {
  const m = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false });
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uNight = U.night;
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uNight;')
      .replace('#include <opaque_fragment>', 'outgoingLight *= uNight * uNight;\n#include <opaque_fragment>');
  };
  m.customProgramCacheKey = () => 'point-beam';
  m.userData.castShadow = false;
  return m;
}

function pmats(B) {
  const M = mats(B);
  Object.assign(M, homeMats(B));
  M.sign = B.mat('sign', () => { const t = atlas(); return litMat({ map: t.map, emissive: 0xffffff, emissiveMap: t.emi, roughness: 0.6 }, { night: 1.3 }); });
  M.lbeam = B.mat('lbeam', lightBeamMat);
  return M;
}

// ------------------------------------------------------------------ the plan

export default {
  id: 'point',

  plan(P) {
    const S = {};
    planLight(P, S);
    planKeeper(P, S);
    planMarina(P, S);
    planVillage(P, S);
    planBattery(P, S);
    planCove(P, S);
    planCottages(P, S);
    planWalls(P, S);
    P.landmark({ id: 'pt_light', name: 'HALCYON LIGHT', x: S.light.x, z: S.light.z, r: 40, kind: 'lighthouse' });
    P.landmark({ id: 'pt_marina', name: 'HALCYON POINT MARINA', x: 1505, z: 2930, r: 80, kind: 'marina' });
    if (S.chapel) P.landmark({ id: 'pt_chapel', name: "ST. ELMO'S CHAPEL", x: S.chapel.x, z: S.chapel.z, r: 20, kind: 'church' });
    if (S.battery) P.landmark({ id: 'pt_battery', name: 'BATTERY HALCYON', x: S.battery.x, z: S.battery.z, r: 50, hidden: true, kind: 'ruin' });
    if (S.cove) P.landmark({ id: 'pt_cove', name: 'BLUEGLOW COVE', x: S.cove.x, z: S.cove.z, r: 50, hidden: true, kind: 'beach' });
  },

  scatter(S) {
    // wind-bent cypress in clumps, gorse and grass on the tops, rocks round the shore
    for (const [x, z] of S.points(15, { r: 2.4, density: (px, pz) => 0.08 + 0.85 * Math.max(0, S.noise(px / 140, pz / 140) * 0.9 + 0.25) })) {
      const y = S.groundY(x, z);
      if (y < 3.5) continue;
      const h = S.range(6, 12.5);
      S.add({ type: 'tree', x, z, y, h, t: S.rng() });
      S.collider({ kind: 'circle', x, z, r: 0.5, y0: y - 1, y1: y + h });
    }
    for (const [x, z] of S.points(13, { r: 1.5, density: (px, pz) => 0.15 + 0.5 * Math.max(0, S.noise(px / 60 + 7, pz / 60)) })) {
      const y = S.groundY(x, z);
      if (y < 3) continue;
      S.add({ type: 'gorse', x, z, y, s: S.range(0.7, 1.5), t: S.rng() });
    }
    // (rocks only where the sea reaches the cell)
    let sea = false;
    for (let i = 0; i <= 8 && !sea; i++) for (let j = 0; j <= 8; j++) if (!S.land(S.x0 + i * 32, S.z0 + j * 32)) { sea = true; break; }
    if (!sea) return;
    for (const [x, z] of S.points(10, { r: 1.2 })) {
      const y = S.groundY(x, z);
      if (y < 0.15 || y > 4.5) continue;
      if (S.rng() > 0.55) continue;
      const s = S.range(0.6, 2.8) * (y < 1.2 ? 1.2 : 0.8);
      S.add({ type: 'rock', x, z, y, s, t: S.rng() });
      if (s > 1.2) S.collider({ kind: 'circle', x, z, r: s * 0.85, y0: y - 1, y1: y + s * 1.2 });
    }
  },

  *warm(B) {
    const M = pmats(B), uv = UV();
    yield;
    yield* warmBuilders(B, this, BUILD, M, uv);
  },

  *build(B, items) {
    const M = pmats(B);
    const uv = UV();
    let t0 = performance.now();
    for (const it of items) {
      const fn = BUILD[it.type];
      if (fn) {
        // (a big piece builds in slices: its builder yields between them)
        const r = fn(B, M, it, uv);
        if (r && r[Symbol.iterator]) { yield* r; yield; t0 = performance.now(); continue; }
      }
      if (performance.now() - t0 > 1) { yield; t0 = performance.now(); }
    }
  },
};

/** A free footprint near (x0, z0), searched in rings out to maxR; turned to face its nearest road. */
function findFree(P, x0, z0, w, d, o = {}, maxR = 40) {
  for (let r = 0; r <= maxR; r += 4) {
    const n = r ? Math.max(6, Math.round(2 * Math.PI * r / 5)) : 1;
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2;
      const x = x0 + Math.cos(a) * r, z = z0 + Math.sin(a) * r;
      let ry = o.ry;
      if (ry === undefined) { const nr = P.nearestRoad(x, z, 140); ry = nr ? nr.ry : 0; }
      if (P.isFree(x, z, w, d, ry, { pad: o.pad ?? 1, roadPad: true, water: o.water })) return { x, z, ry };
    }
  }
  return null;
}

// ------------------------------------------------------------------ the light

function planLight(P, S) {
  // on the knuckle of rock running down to the island's south tip
  const x = 1572, z = 3741;
  const g = P.groundRange(x, z, 9, 9, 0);
  const yb = g.hi + 1.2;
  P.claim(x, z, 16, 16, 0);
  P.add({ type: 'light', x, z, yb, y0: g.lo - 1.5 });
  P.collider({ kind: 'circle', x, z, r: 5.6, y0: g.lo - 1.5, y1: yb + 36 });
  P.far({ shape: 'cyl', x, z, y: g.lo - 1, r: 3.5, r2: 2.6, h: yb + 26 - g.lo + 1, color: '#e8e4dc' });
  P.far({ shape: 'cyl', x, z, y: yb + 26, r: 2.5, h: 6, color: '#b8b0a0' });
  P.far({ shape: 'cone', x, z, y: yb + 32, r: 2.2, h: 2.4, color: '#7a2a20' });
  // the light: a bright point far off, a big glow round the lantern close to
  P.lamp({ x, z, hx: x, hy: yb + 30.5, hz: z, color: new THREE.Color(2.6, 2.4, 1.9), radius: 6, intensity: 0, halo: 10 });
  // a lamp over the door
  P.lamp({ x: x - 2, z: z - 7, hx: x - 1.8, hy: yb + 2.6, hz: z - 6.6, color: '#ffd8a0', radius: 7, intensity: 0.5, halo: 1.0 });
  S.light = { x, z, yb };
}

function planKeeper(P, S) {
  // the keeper's house, the fog signal and the oil store in a walled yard
  // between the road's end and the light
  const f = findFree(P, 1552, 3712, 30, 17, { pad: 0.5 }, 24);
  if (!f) return;
  const { x, z, ry } = f;
  P.claim(x, z, 30, 17, ry);
  const g = P.groundRange(x, z, 30, 17, ry);
  const y1 = P.groundY(x, z) + 0.4;
  P.add({ type: 'keeper', x, z, ry, y0: g.lo - 1, y1 });
  const F = frame(x, 0, z, ry);
  const put = (lx, lz, w, d, h) => { const p = F(lx, 0, lz); P.collider({ kind: 'box', x: p[0], z: p[2], hx: w / 2, hz: d / 2, ry, y0: g.lo - 1, y1: y1 + h }); };
  put(-6, -1, 12, 8, 10);
  put(5.5, -2, 7, 5, 5);
  put(11, 3, 3, 3, 3);
  // the yard wall (a gap at the front gate)
  for (const [lx, lz, w, d] of [[-8.5, 8.3, 13, 0.6], [8.5, 8.3, 13, 0.6], [9.5, -8.3, 11, 0.6], [-7.5, -8.3, 15, 0.6], [-14.8, 0, 0.6, 17], [14.8, 0, 0.6, 17]]) put(lx, lz, w, d, 1.2);
  const fp = F(-6, 0, -1);
  P.far({ x: fp[0], z: fp[2], y: g.lo - 1, w: 12, d: 8, h: y1 - g.lo + 9.5, ry, color: '#e8e4dc', lit: 0.3 });
  const lp = F(-7.5, 0, 4.2);
  P.lamp({ x: lp[0], z: lp[2], hx: lp[0], hy: y1 + 2.5, hz: lp[2], color: '#ffd29a', radius: 12, intensity: 0.8, halo: 1.2 });
  const gp = F(0, 0, 9.5);
  P.lamp({ x: gp[0], z: gp[2], hx: gp[0], hy: y1 + 2.2, hz: gp[2], color: '#ffd29a', radius: 10, intensity: 0.7, halo: 1.1 });
  // the path down to the light
  const lt = S.light;
  const back = F(2, 0, -8.5);
  P.add({ type: 'lpath', x: (back[0] + lt.x) / 2, z: (back[2] + lt.z) / 2, pts: [[back[0], back[2]], [(back[0] * 0.55 + lt.x * 0.45), (back[2] * 0.55 + lt.z * 0.45) + 2], [lt.x - 2.5, lt.z - 5.5]] });
  S.keeper = { x, z, ry };
}

// ------------------------------------------------------------------ the marina

const MX = 1505, MZ0 = 2978, MZ1 = 2878;

function planMarina(P, S) {
  // the pontoons: a walkway out from the beach, fingers either side, a T at the end
  P.add({ type: 'pontoons', x: MX, z: (MZ0 + MZ1) / 2 });
  P.far({ x: MX, z: (MZ0 + MZ1) / 2, y: -0.4, w: 3, d: MZ0 - MZ1, h: 1, ry: 0, color: '#8a7a68' });
  for (let k = 0, z = MZ0 - 14; z > MZ1; z -= 24, k++) {
    const sd = k % 2 ? 1 : -1;
    P.lamp({ x: MX + sd * 1.1, z, hx: MX + sd * 1.1, hy: 3.3, hz: z, color: '#ffe2b0', radius: 11, intensity: 0.8, halo: 1.1 });
  }
  for (const x of [1462, 1548]) P.lamp({ x, z: MZ1 - 1, hx: x, hy: 3.3, hz: MZ1 - 1, color: '#ffe2b0', radius: 11, intensity: 0.8, halo: 1.1 });
  // boats in the berths (some empty), the big ones on the T
  const kinds = ['sail', 'sail', 'motor', 'sail', 'fish', 'motor', 'sail', 'cat'];
  for (let k = 0; k < 8; k++) {
    const zf = MZ0 - 12 - k * 11;
    for (const sd of [-1, 1]) {
      if (P.rng() < 0.22) continue;
      const kind = P.pick(kinds);
      const L = kind === 'motor' ? P.range(9, 11.5) : kind === 'fish' ? P.range(8, 9.5) : kind === 'cat' ? 9 : P.range(8.5, 10.5);
      const bx = MX + sd * (1.6 + L / 2 + 0.4), bz = zf - 5.5;
      const bow = P.rng() < 0.6 ? -sd : sd;
      P.add({ type: 'boat', x: bx, z: bz, ry: bow > 0 ? Math.PI / 2 : -Math.PI / 2, kind, L, s: P.rng() });
      if (kind === 'sail' || kind === 'cat') P.lamp({ x: bx, z: bz, hx: bx, hy: L * 1.25 + 1.05, hz: bz, color: '#fff4e0', radius: 3, intensity: 0, halo: 0.5 });
    }
  }
  for (const [bx, L, kind] of [[1470, 17, 'yacht'], [1532, 15, 'sail']]) {
    const bz = MZ1 - 1.5 - 2.6;
    P.add({ type: 'boat', x: bx, z: bz, ry: Math.PI / 2, kind, L, s: P.rng() });
    if (kind === 'sail') P.lamp({ x: bx, z: bz, hx: bx, hy: L * 1.25 + 1.05, hz: bz, color: '#fff4e0', radius: 3, intensity: 0, halo: 0.5 });
  }
  // the breakwater: two arms of rock round the basin, a light on each end
  // (red to starboard coming in, green to port)
  const W = [[1418, 3010], [1410, 2950], [1416, 2890], [1440, 2852], [1476, 2838]];
  const E = [[1600, 2988], [1598, 2924], [1584, 2866], [1548, 2843]];
  for (const pts of [W, E]) {
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i], b = pts[i + 1];
      P.add({ type: 'mole', x: (a[0] + b[0]) / 2, z: (a[1] + b[1]) / 2, a, b, last: i === pts.length - 2 });
      const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
      P.collider({ kind: 'box', x: (a[0] + b[0]) / 2, z: (a[1] + b[1]) / 2, hx: L / 2, hz: 4, ry: -Math.atan2(b[1] - a[1], b[0] - a[0]), y0: -3, y1: 3 });
    }
  }
  for (const [p, c] of [[W[W.length - 1], '#ff2a1a'], [E[E.length - 1], '#2aff5a']]) {
    P.add({ type: 'navlight', x: p[0], z: p[1], c });
    P.lamp({ x: p[0], z: p[1], hx: p[0], hy: 6.2, hz: p[1], color: c, radius: 6, intensity: 0, halo: 1.6 });
  }
  // the yacht club up on its piles, its veranda over the beach
  const cx = 1538, cz = 3014;
  const cg = P.groundRange(cx, cz, 22, 12, Math.PI);
  const cy = P.groundY(cx, cz + 6) + 0.3;
  P.claim(cx, cz, 22, 18, Math.PI);
  P.add({ type: 'club', x: cx, z: cz, ry: Math.PI, y0: cg.lo - 1, y1: cy });
  P.collider({ kind: 'box', x: cx, z: cz + 1, hx: 11, hz: 7, ry: 0, y0: cg.lo - 1, y1: cy + 9 });
  P.far({ x: cx, z: cz, y: cg.lo - 1, w: 22, d: 12, h: cy - cg.lo + 8, ry: 0, color: '#e8e6e0', lit: 0.5 });
  P.lamp({ x: cx, z: cz - 9, hx: cx, hy: cy + 3, hz: cz - 9, color: '#ffd8a0', radius: 16, intensity: 1.0, halo: 1.6 });
  P.lamp({ x: cx - 9, z: cz + 8, hx: cx - 9, hy: cy + 3, hz: cz + 8, color: '#ffd8a0', radius: 12, intensity: 0.8, halo: 1.2 });
  // the stairs down to the pontoons, the slipway, boats laid up on the beach
  P.add({ type: 'mstairs', x: 1516, z: 2992, ax: 1527, az: 3005.5, ya: cy, bx: MX + 1.5, bz: MZ0 + 0.5 });
  P.add({ type: 'slip', x: 1462, z: 2996 });
  for (const [bx, bz, a] of [[1442, 3014, 0.3], [1480, 3000, -0.2]]) {
    const y = P.groundY(bx, bz);
    P.add({ type: 'laidup', x: bx, z: bz, y, ry: a, s: P.rng() });
    P.collider({ kind: 'box', x: bx, z: bz, hx: 1.6, hz: 4.5, ry: a, y0: y - 1, y1: y + 4 });
  }
  // a sign and a few cars at the end of the lane
  const lane = P.net.byId.get('pt_marina');
  if (lane) {
    const p = lane.posAt(Math.max(8, lane.length - 40));
    const sx = p.x + lane.LX[p.i] * 9, sz = p.z + lane.LZ[p.i] * 9;
    const sry = Math.atan2(-lane.LX[p.i], -lane.LZ[p.i]);
    P.add({ type: 'msign', x: sx, z: sz, ry: sry });
    P.collider({ kind: 'box', x: sx, z: sz, hx: 1.6, hz: 0.2, ry: sry, y0: P.groundY(sx, sz) - 1, y1: P.groundY(sx, sz) + 3 });
    for (let k = 0; k < 4; k++) {
      const q = lane.posAt(lane.length - 14 - k * 6);
      const px = q.x - lane.LX[q.i] * 8.8, pz = q.z - lane.LZ[q.i] * 8.8;
      const ry = Math.atan2(lane.LX[q.i], lane.LZ[q.i]);
      if (!P.isFree(px, pz, 2.2, 4.8, ry, { pad: 0.3 })) continue;
      P.claim(px, pz, 2.2, 4.8, ry);
      P.add({ type: 'car', x: px, z: pz, ry, s: P.rng() });
      P.collider({ kind: 'box', x: px, z: pz, hx: 1, hz: 2.3, ry, y0: P.groundY(px, pz) - 1, y1: P.groundY(px, pz) + 1.6 });
    }
  }
}

// ------------------------------------------------------------------ chapel, store

function planVillage(P, S) {
  // the store where the lanes meet, with its pump out front
  // (the footprint: the store at its left, the pump and its lamp at its right)
  let f = findFree(P, 1612, 3098, 24, 14, { pad: 1 }, 30);
  if (f) {
    const g = P.groundRange(f.x, f.z, 24, 14, f.ry);
    P.claim(f.x, f.z, 24, 14, f.ry);
    P.add({ type: 'store', x: f.x, z: f.z, ry: f.ry, y0: g.lo - 1, y1: g.hi + 0.3 });
    const F = frame(f.x, 0, f.z, f.ry);
    const sp = F(-4, 0, -1);
    P.collider({ kind: 'box', x: sp[0], z: sp[2], hx: 7, hz: 5, ry: f.ry, y0: g.lo - 1, y1: g.hi + 8 });
    const pp = F(7.5, 0, 3);
    P.collider({ kind: 'circle', x: pp[0], z: pp[2], r: 0.8, y0: g.lo - 1, y1: g.hi + 3 });
    P.far({ x: sp[0], z: sp[2], y: g.lo - 1, w: 14, d: 10, h: g.hi - g.lo + 8, ry: f.ry, color: '#7a3a2a', lit: 0.4 });
    const lp = F(-4, 0, 6);
    P.lamp({ x: lp[0], z: lp[2], hx: lp[0], hy: g.hi + 3.2, hz: lp[2], color: '#ffd29a', radius: 16, intensity: 1, halo: 1.4 });
    const pl = F(8.5, 0, 4.5);
    P.lamp({ x: pl[0], z: pl[2], hx: pl[0], hy: g.hi + 3.4, hz: pl[2], color: '#e8f0ff', radius: 10, intensity: 0.7, halo: 1 });
    S.store = f;
  }
  // St. Elmo's: a white wooden chapel with a spire, facing Point Road
  f = findFree(P, 1424, 3142, 12, 24, { pad: 1 }, 40);
  if (f) {
    const g = P.groundRange(f.x, f.z, 11, 20, f.ry);
    P.claim(f.x, f.z, 13, 24, f.ry);
    P.add({ type: 'chapel', x: f.x, z: f.z, ry: f.ry, y0: g.lo - 1, y1: g.hi + 0.4 });
    P.collider({ kind: 'box', x: f.x, z: f.z, hx: 5.5, hz: 10, ry: f.ry, y0: g.lo - 1, y1: g.hi + 20 });
    P.far({ x: f.x, z: f.z, y: g.lo - 1, w: 9, d: 16, h: g.hi - g.lo + 9, ry: f.ry, color: '#e8e6e0', lit: 0.2 });
    const F = frame(f.x, 0, f.z, f.ry);
    const sp = F(0, 0, 7.5);
    P.far({ shape: 'cone', x: sp[0], z: sp[2], y: g.hi + 11, r: 2.2, h: 8, color: '#3a3e44' });
    const lp = F(0, 0, 13.5);
    P.lamp({ x: lp[0], z: lp[2], hx: lp[0], hy: g.hi + 2.6, hz: lp[2], color: '#ffd8a0', radius: 8, intensity: 0.45, halo: 1.0 });
    S.chapel = f;
  }
  // the island's sign at the end of the bridge
  const r = P.net.byId.get('pt_r1');
  if (r) {
    const p = r.posAt(60);
    const sx = p.x - r.LX[p.i] * 10, sz = p.z - r.LZ[p.i] * 10;
    const sry = Math.atan2(r.TX[p.i], r.TZ[p.i]) + Math.PI;
    P.add({ type: 'ptsign', x: sx, z: sz, ry: sry });
    P.collider({ kind: 'box', x: sx, z: sz, hx: 2.3, hz: 0.25, ry: sry, y0: P.groundY(sx, sz) - 1, y1: P.groundY(sx, sz) + 3 });
  }
}

// ------------------------------------------------------------------ the battery

function planBattery(P, S) {
  // two gun pits looking out to sea, the magazine between them under its
  // turf, the fire control tower behind: off Battery Road, in the trees
  const x = 1372, z = 3338, ry = Math.atan2(-1, 0.3);
  const F = frame(x, 0, z, ry);
  const parts = [
    // [lx, lz, w, d, h, kind]
    [-30, 9, 17, 17, 2, 'pit'], [30, 9, 17, 17, 2, 'pit'],
    [0, -4, 22, 12, 4, 'magazine'], [0, -22, 7, 7, 13, 'tower'],
  ];
  for (const [lx, lz, w, d] of parts) {
    const p = F(lx, 0, lz);
    if (!P.isFree(p[0], p[2], w, d, ry, { pad: 1, roadPad: true })) return;
  }
  const g = P.groundRange(x, z, 70, 40, ry);
  for (const [lx, lz, w, d, h, kind] of parts) {
    const p = F(lx, 0, lz);
    P.claim(p[0], p[2], w, d, ry);
    const y = P.groundY(p[0], p[2]);
    P.add({ type: 'battery', part: kind, x: p[0], z: p[2], ry, y, lx });
    if (kind === 'pit') P.collider({ kind: 'circle', x: p[0], z: p[2], r: 8, y0: y - 2, y1: y + 1.4 });
    else P.collider({ kind: 'box', x: p[0], z: p[2], hx: w / 2 - 1, hz: d / 2 - 1, ry, y0: y - 2, y1: y + h });
  }
  const tp = F(0, 0, -22);
  P.far({ x: tp[0], z: tp[2], y: g.lo - 1, w: 7, d: 7, h: P.groundY(tp[0], tp[2]) - g.lo + 12, ry, color: '#8a8678' });
  // dragon's teeth along the way in, the sign, one caged bulb over the magazine door
  const sp = F(-6, 0, -36);
  P.add({ type: 'battery', part: 'teeth', x: sp[0], z: sp[2], ry, y: P.groundY(sp[0], sp[2]) });
  for (let k = 0; k < 7; k++) {
    const q = F(-24 + k * 4, 0, -36);
    P.collider({ kind: 'circle', x: q[0], z: q[2], r: 0.9, y0: q[1] - 1, y1: P.groundY(q[0], q[2]) + 1.4 });
  }
  const sg = F(18, 0, -40);
  P.add({ type: 'battery', part: 'sign', x: sg[0], z: sg[2], ry, y: P.groundY(sg[0], sg[2]) });
  P.collider({ kind: 'box', x: sg[0], z: sg[2], hx: 1.4, hz: 0.2, ry, y0: P.groundY(sg[0], sg[2]) - 1, y1: P.groundY(sg[0], sg[2]) + 3 });
  const lp = F(0, 0, -10.6);
  P.lamp({ x: lp[0], z: lp[2], hx: lp[0], hy: P.groundY(lp[0], lp[2]) + 2.6, hz: lp[2], color: '#ffb870', radius: 10, intensity: 0.6, halo: 0.9 });
  S.battery = { x, z };
}

// ------------------------------------------------------------------ the cove

const NETS = [[1236, 3601], [1240, 3597.5], [1244, 3594]], COVESIGN = [1212, 3571];
const SURF = [[1148, 3540], [1168, 3560], [1186, 3580], [1202, 3600], [1214, 3620], [1232, 3640], [1250, 3660], [1266, 3680], [1284, 3700]];

function planCove(P, S) {
  const r = P.net.byId.get('pt_cove');
  if (!r) return;
  // the boathouse at the back of the beach, its slip into the water
  const bx = 1243, bz = 3616, bry = -1.1;
  if (!P.isFree(bx, bz, 8, 7, bry, { pad: 0.5, roadPad: true })) return;
  P.claim(bx, bz, 8, 7, bry);
  const by = P.groundRange(bx, bz, 8, 7, bry);
  P.add({ type: 'boathouse', x: bx, z: bz, ry: bry, y0: by.lo - 0.8, y1: by.hi + 0.25 });
  P.collider({ kind: 'box', x: bx, z: bz, hx: 4, hz: 3.5, ry: bry, y0: by.lo - 1, y1: by.hi + 6 });
  P.lamp({ x: bx, z: bz, hx: bx - 2.6, hy: by.hi + 3, hz: bz - 2.4, color: '#ffc070', radius: 12, intensity: 0.9, halo: 1.3 });
  // the sea arch off the beach
  P.add({ type: 'arch', x: 1178, z: 3618, ry: 0.75 });
  for (const s of [-1, 1]) P.collider({ kind: 'circle', x: 1178 + Math.cos(0.75) * 5.5 * s, z: 3618 - Math.sin(0.75) * 5.5 * s, r: 3.4, y0: -4, y1: 10 });
  P.far({ x: 1178, z: 3618, y: -1, w: 16, d: 6, h: 10, ry: 0.75, color: '#4a4640' });
  // the beach: the glowing surf, driftwood, a boat on the sand, the sign
  P.add({ type: 'surf', x: 1220, z: 3610 });
  P.add({ type: 'beachkit', x: 1212, z: 3596 });
  P.collider({ kind: 'circle', x: COVESIGN[0], z: COVESIGN[1], r: 0.3, y0: 0, y1: 4 });
  for (const [x, z] of NETS) P.collider({ kind: 'circle', x, z, r: 0.25, y0: 0, y1: 4 });
  P.collider({ kind: 'box', x: 1226, z: 3598, hx: 0.8, hz: 2.2, ry: 0.5, y0: 0, y1: 2.5 });
  // rocks at either end
  for (const [x, z, s] of [[1166, 3532, 3.2], [1158, 3550, 2.4], [1268, 3668, 3.0], [1282, 3678, 2.2], [1250, 3655, 1.8]]) {
    P.add({ type: 'boulder', x, z, s, seed: P.rng() });
    P.collider({ kind: 'circle', x, z, r: s, y0: -2, y1: P.groundY(x, z) + s * 1.4 });
  }
  S.cove = { x: 1215, z: 3605 };
}

// ------------------------------------------------------------------ cottages

function planCottages(P, S) {
  const ids = new Set(['pt_r1', 'pt_r2', 'pt_r3', 'pt_r4']);
  const lots = P.lots({ roads: (r) => ids.has(r.spec.id), width: [10, 13], depth: [8, 10], gap: [26, 90], setback: [6, 11], sides: [1, -1], ends: 30, pad: 3, roadPad: true, chance: 0.55 });
  for (const L of lots) {
    const g = P.groundRange(L.x, L.z, L.w, L.d, L.ry);
    if (g.hi - g.lo > 3.2) continue;
    const floors = P.rng() < 0.35 ? 2 : 1;
    {
      const c0 = Math.cos(L.ry), s0 = Math.sin(L.ry), fz = L.d / 2 + L.setback / 2;
      P.claim(L.x + fz * s0, L.z + fz * c0, L.w + 3, L.setback, L.ry);
    }
    const it = P.add({ type: 'cottage', x: L.x, z: L.z, ry: L.ry, w: L.w - 1, d: L.d - 1, y0: g.lo - 0.8, y1: g.hi + 0.35, floors, setback: L.setback, tint: P.pick(TINTS), roofC: P.pick(ROOFS), porch: P.rng() < 0.6, chimney: P.rng() < 0.7, dormers: floors === 1 && P.rng() < 0.6, car: P.rng() < 0.5 });
    P.collider({ kind: 'box', x: L.x, z: L.z, hx: L.w / 2 - 0.5, hz: L.d / 2 - 0.5, ry: L.ry, y0: g.lo - 1, y1: g.hi + floors * 3.2 + 4 });
    P.far({ x: L.x, z: L.z, y: g.lo - 1, w: L.w - 1, d: L.d - 1, h: g.hi - g.lo + floors * 3.2 + 3, ry: L.ry, color: it.tint, lit: 0.3 });
    const c = Math.cos(L.ry), s = Math.sin(L.ry);
    // the picket fence (a gap at the gate) and the mailbox: solid
    {
      const w = L.w - 1, d = L.d - 1;
      const fz = d / 2 + Math.max(2.5, L.setback * 0.65), gx = -w * 0.18;
      const at = (lx, lz) => [L.x + lx * Math.cos(L.ry) + lz * Math.sin(L.ry), L.z - lx * Math.sin(L.ry) + lz * Math.cos(L.ry)];
      const y = g.lo;
      for (const [a, b] of [[-w / 2 - 1.5, gx - 0.8], [gx + 0.8, w / 2 + 1.5]]) {
        const c = at((a + b) / 2, fz);
        P.collider({ kind: 'box', x: c[0], z: c[1], hx: (b - a) / 2, hz: 0.12, ry: L.ry, y0: y - 1, y1: g.hi + 1.1 });
      }
      const mb = at(gx + 1.6, fz + 0.6);
      P.collider({ kind: 'circle', x: mb[0], z: mb[1], r: 0.25, y0: y - 1, y1: g.hi + 1.4 });
    }
    // the porch light
    const lx = -(L.w - 1) * 0.18, lz = (L.d - 1) / 2 + 0.4;
    const hx = L.x + lx * c + lz * s, hz = L.z - lx * s + lz * c;
    P.lamp({ x: hx, z: hz, hx, hy: g.hi + 0.35 + 2.6, hz, color: '#ffcf8a', radius: 9, intensity: 0.7, halo: 0.9 });
    // the car in the drive
    if (it.car) {
      const ox = L.w / 2 + 2.2, oz = L.d * 0.2;
      const px = L.x + ox * c + oz * s, pz = L.z - ox * s + oz * c;
      if (P.isFree(px, pz, 2.4, 5, L.ry, { pad: 0.2, roadPad: true })) {
        P.claim(px, pz, 2.4, 5, L.ry);
        P.collider({ kind: 'box', x: px, z: pz, hx: 1, hz: 2.3, ry: L.ry, y0: g.lo - 1, y1: g.hi + 1.6 });
        it.carAt = [px, pz];
      }
    }
  }
}

// ------------------------------------------------------------------ dry-stone walls

function planWalls(P, S) {
  // along the island's roads, a field's width back, broken by gates and
  // wherever something stands
  for (const id of ['pt_r1', 'pt_r2', 'pt_r3', 'pt_r4', 'pt_spine']) {
    const r = P.net.byId.get(id);
    if (!r) continue;
    const off = r.rt.hw + r.rt.shoulder + 4.5;
    for (const sd of [1, -1]) {
      let run = [];
      const flush = () => {
        if (run.length >= 5) {
          const m = run[Math.floor(run.length / 2)];
          P.add({ type: 'wall', x: m[0], z: m[1], pts: run });
          for (let i = 0; i < run.length - 1; i += 2) {
            const a = run[i], b = run[Math.min(run.length - 1, i + 2)];
            const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
            if (L < 0.5) continue;
            const y = P.groundY(a[0], a[1]);
            P.collider({ kind: 'box', x: (a[0] + b[0]) / 2, z: (a[1] + b[1]) / 2, hx: L / 2, hz: 0.45, ry: -Math.atan2(b[1] - a[1], b[0] - a[0]), y0: y - 1, y1: y + 1.2 });
          }
        }
        run = [];
      };
      let gate = 40 + P.rng() * 60;
      for (let s = r.trim0 + 24; s < r.length - r.trim1 - 24; s += 4) {
        const p = r.posAt(s);
        const x = p.x + r.LX[p.i] * off * sd, z = p.z + r.LZ[p.i] * off * sd;
        const y = P.groundY(x, z);
        const ok = y > 4 && P.isFree(x, z, 1.4, 1.4, 0, { pad: 0.6, roadPad: false }) && P.noise(x / 300, z / 300) > -0.35;
        gate -= 4;
        if (!ok || gate < 0) {
          flush();
          if (gate < 0) gate = 40 + P.rng() * 90;
          continue;
        }
        run.push([x, z]);
        if (run.length > 16) { flush(); }
      }
      flush();
    }
  }
}

// ------------------------------------------------------------------ builders

const BUILD = {
  light: lighthouse,
  keeper,
  lpath(B, M, it) {
    const dc = B.acc(M.decal), pa = B.acc(M.paint);
    col(dc, C('#a8a090'));
    groundStrip(dc, B, it.pts, 1.6, 0.06, 2);
    col(pa, C('#f4f2ec'));
    for (let i = 0; i < it.pts.length - 1; i++) {
      const a = it.pts[i], b = it.pts[i + 1];
      const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
      const n = Math.max(1, Math.round(L / 3));
      const lx = -(b[1] - a[1]) / L * 1.1, lz = (b[0] - a[0]) / L * 1.1;
      let prev = null;
      for (let k = 0; k <= n; k++) {
        const x = a[0] + (b[0] - a[0]) * k / n + lx, z = a[1] + (b[1] - a[1]) * k / n + lz;
        const y = B.groundY(x, z);
        pa.box(x, y - 0.2, z, 0.1, 1.2, 0.1);
        if (prev) pa.beam(prev[0], prev[1] + 0.95, prev[2], x, y + 0.95, z, 0.06, 0.06);
        prev = [x, y, z];
      }
    }
  },
  pontoons,
  boat(B, M, it) {
    const F = frame(it.x, 0, it.z, it.ry);
    boatModel(B, M, F, it.ry, it.kind, it.L, makeRng(seedOf(it)), false);
  },
  laidup(B, M, it) {
    // a boat on its cradle on the beach
    const rng = makeRng(seedOf(it));
    const pa = B.acc(M.paint);
    col(pa, C('#3a3a3e'));
    const F0 = frame(it.x, it.y, it.z, it.ry);
    for (const lz of [-2.5, 0, 2.5]) for (const s of [-1, 1]) lbox(pa, F0, it.ry, s * 1.0, -0.3, lz, 0.18, 1.6, 0.18, {}, 0);
    const F = frame3(it.x, it.y + 1.35, it.z, it.ry, 0, 0.03);
    boatModel(B, M, F, it.ry, rng() < 0.5 ? 'sail' : 'motor', 8.5, rng, true);
  },
  mole,
  navlight(B, M, it) {
    const pa = B.acc(M.paint), bl = B.acc(M.blink), cn = B.acc(M.conc);
    col(cn, C('#9a968c'));
    cylinder(cn, it.x, -0.5, it.z, 1.6, 3.4, 10, { top: true });
    const red = it.c === '#ff2a1a';
    for (let k = 0; k < 3; k++) {
      col(pa, k % 2 ? C('#f4f2ec') : C(red ? '#c8301f' : '#2a8a3a'));
      cylinder(pa, it.x, 2.9 + k * 0.8, it.z, 0.55, 0.8, 8, { top: k === 2 });
    }
    col(bl, C(it.c, 3));
    bl.box(it.x, 5.4, it.z, 0.45, 0.6, 0.45);
  },
  club,
  mstairs(B, M, it) {
    // timber steps down the bank from the club's veranda to the beach
    const wd = B.acc(M.wood), pa = B.acc(M.paint);
    const ya = it.ya, yb = 0.75;
    const L = Math.hypot(it.bx - it.ax, it.bz - it.az);
    const n = Math.ceil(L / 1.4);
    const ry = Math.atan2(it.bx - it.ax, it.bz - it.az);
    col(wd, C('#9a8a76'));
    col(pa, C('#e8e4dc'));
    for (let k = 0; k <= n; k++) {
      const t = k / n;
      const x = it.ax + (it.bx - it.ax) * t, z = it.az + (it.bz - it.az) * t;
      const y = Math.max(B.groundY(x, z) + 0.15, ya + (yb - ya) * t);
      box(wd, x, y - 0.12, z, 2, 0.12, 1.45, ry, { u: 2 });
      if (k % 2 === 0) for (const s of [-1, 1]) {
        const px = x + Math.cos(ry) * s * 1.05, pz = z - Math.sin(ry) * s * 1.05;
        pa.box(px, B.groundY(px, pz) - 0.3, pz, 0.12, y - B.groundY(px, pz) + 1.3, 0.12);
      }
    }
    for (const s of [-1, 1]) {
      const ox = Math.cos(ry) * s * 1.05, oz = -Math.sin(ry) * s * 1.05;
      pa.beam(it.ax + ox, ya + 1.0, it.az + oz, it.bx + ox, yb + 1.0, it.bz + oz, 0.08, 0.08);
    }
  },
  slip(B, M, it) {
    const cn = B.acc(M.conc);
    col(cn, C('#8a8780'));
    groundStrip(cn, B, [[1462, 3018], [1462, 2985], [1462, 2966]], 6, 0.08, 3, 3);
    const pa = B.acc(M.paint);
    col(pa, C('#2a2a2e'));
    for (const z of [3016, 2996]) pa.box(1458.4, B.groundY(1458.4, z) - 0.2, z, 0.3, 0.9, 0.3);
  },
  msign(B, M, it, uv) {
    const pa = B.acc(M.paint), sg = B.acc(M.sign);
    const y = B.groundY(it.x, it.z);
    col(pa, C('#e8e4dc'));
    const c = Math.cos(it.ry), s = Math.sin(it.ry);
    for (const o of [-1.4, 1.4]) pa.box(it.x + o * c, y - 0.3, it.z - o * s, 0.14, 2.9, 0.14);
    panel(sg, it.x, y + 1.9, it.z, 3.4, 3.4 * 120 / 560, it.ry, uv.marina, true);
  },
  car(B, M, it) {
    car(B, M, it.x, B.groundY(it.x, it.z), it.z, it.ry, makeRng(seedOf(it)), false);
  },
  store,
  chapel,
  ptsign(B, M, it, uv) {
    const wd = B.acc(M.wood), sg = B.acc(M.sign);
    const y = B.groundY(it.x, it.z);
    col(wd, C('#5a4a3a'));
    const c = Math.cos(it.ry), s = Math.sin(it.ry);
    for (const o of [-2, 2]) box(wd, it.x + o * c, y - 0.3, it.z - o * s, 0.22, 2.9, 0.22, it.ry, { u: 1 });
    box(wd, it.x, y + 2.4, it.z, 4.8, 0.2, 0.3, it.ry, { u: 1 });
    panel(sg, it.x, y + 1.6, it.z, 4.4, 4.4 * 130 / 660, it.ry, uv.point, true);
  },
  battery,
  boathouse,
  arch: seaArch,
  surf,
  beachkit,
  boulder(B, M, it) {
    const rng = makeRng(seedOf(it));
    rockPile(B.acc(M.rock), B, it.x, it.z, it.s, 4, rng, [0.42, 0.4, 0.37]);
  },
  cottage(B, M, it) {
    const rng = makeRng(seedOf(it));
    cottage(B, M, M, { ...it, tint: C(it.tint), roofC: C(it.roofC) }, rng);
    // the picket fence along the front, a gap at the path; the path; the mailbox
    const F = frame(it.x, 0, it.z, it.ry);
    const fz = it.d / 2 + Math.max(2.5, it.setback * 0.65);
    const gx = -it.w * 0.18;
    const fl = [[-it.w / 2 - 1.5, fz], [gx - 0.8, fz]], fr = [[gx + 0.8, fz], [it.w / 2 + 1.5, fz]];
    const pc = B.near(M.paint);
    for (const run of [fl, fr]) picket(pc, B, run.map(([a, b]) => { const p = F(a, 0, b); return [p[0], p[2]]; }), 1.0);
    const dc = B.acc(M.decal);
    col(dc, C('#b8b0a0'));
    const p0 = F(gx, 0, it.d / 2 + 0.3), p1 = F(gx, 0, fz + 0.5);
    groundStrip(dc, B, [[p0[0], p0[2]], [p1[0], p1[2]]], 1.2, 0.05, 2);
    const mb = F(gx + 1.6, 0, fz + 0.6);
    const my = B.groundY(mb[0], mb[2]);
    col(pc, C('#4a3a2a'));
    pc.box(mb[0], my - 0.2, mb[2], 0.1, 1.3, 0.1);
    col(pc, C(['#2a3a5a', '#c8c4bc', '#a8322a'][it.n % 3]));
    pc.box(mb[0], my + 1.05, mb[2], 0.3, 0.3, 0.5, it.ry);
    // shrubs by the walls
    const lf = B.near(M.leaf);
    for (let k = 0; k < 4; k++) {
      const p = F((rng() - 0.5) * it.w, 0, it.d / 2 + 0.9);
      col(lf, [0.12 + rng() * 0.08, 0.25 + rng() * 0.1, 0.1]);
      blob(lf, p[0], B.groundY(p[0], p[2]) + 0.3, p[2], 0.6 + rng() * 0.4, 0.8, rng);
    }
    if (it.carAt) car(B, M, it.carAt[0], B.groundY(it.carAt[0], it.carAt[1]), it.carAt[1], it.ry, rng, true);
  },
  wall(B, M, it) {
    stoneWall(B.acc(M.rock), B, it.pts, 1.0, 0.75, makeRng(seedOf(it)));
  },
  tree(B, M, it) {
    const rng = makeRng(`pt${it.x.toFixed(1)},${it.z.toFixed(1)}`);
    const k = 0.85 + it.t * 0.3;
    windTree(B.acc(M.matte), B.acc(M.leaf), it.x, it.y, it.z, it.h, WIND[0], WIND[1], rng, [0.1 * k, 0.2 * k, 0.12 * k]);
  },
  gorse(B, M, it) {
    const lf = B.near(M.leaf);
    const rng = makeRng(`pg${it.x.toFixed(1)},${it.z.toFixed(1)}`);
    const bloom = it.t < 0.45;
    for (let k = 0; k < 3; k++) {
      const a = rng() * 6.28, r = rng() * 0.8 * it.s;
      const c = bloom && k === 0 ? [0.55, 0.45, 0.08] : [0.16 + rng() * 0.06, 0.24 + rng() * 0.08, 0.09];
      col(lf, c);
      blob(lf, it.x + Math.cos(a) * r, it.y + 0.1, it.z + Math.sin(a) * r, (0.55 + rng() * 0.35) * it.s, 0.75, rng);
    }
  },
  rock(B, M, it) {
    const rng = makeRng(`pr${it.x.toFixed(1)},${it.z.toFixed(1)}`);
    const wet = it.y < 1;
    rockLump(B.acc(M.rock), it.x, it.y, it.z, it.s * (0.9 + rng() * 0.5), it.s * (0.5 + rng() * 0.4), it.s * (0.8 + rng() * 0.4), rng, it.t * 6.28, wet ? [0.36, 0.35, 0.33] : [0.52, 0.5, 0.46]);
  },
};

// ------------------------------------------------------------------ the lighthouse

function lighthouse(B, M, it, uv) {
  const { x, z, yb } = it;
  const rng = makeRng(seedOf(it));
  const pa = B.acc(M.paint), cn = B.acc(M.conc), gl = B.acc(M.glow), rk = B.acc(M.rock), st = B.acc(M.steel), sg = B.acc(M.sign);
  // the knuckle of rock it stands on, the masonry plinth
  for (let k = 0; k < 11; k++) {
    const a = (k / 11) * Math.PI * 2 + rng() * 0.4, r = 6.2 + rng() * 2.8;
    const px = x + Math.cos(a) * r, pz = z + Math.sin(a) * r;
    const s = 1.6 + rng() * 1.8;
    rockLump(rk, px, B.groundY(px, pz), pz, s * 1.2, Math.min(s, yb - B.groundY(px, pz) + 0.8), s, rng, rng() * 6, [0.46, 0.44, 0.41]);
  }
  col(cn, C('#bdb6a8'));
  cylinder(cn, x, it.y0, z, 5.8, yb - it.y0, 8, { top: true, r2: 5.4, u: 2 });
  col(cn, C('#9a948a'));
  cylinder(cn, x, yb - 0.25, z, 5.6, 0.3, 8, { top: true });
  // the tower: white, a red band, tapering
  const H = 26;
  const rAt = (h) => 3.3 - 0.85 * h / H;
  // (painted steel: a lamp at its foot would bake it white all the way up)
  for (const [h0, h1, c] of [[0, 13, '#f4f2ec'], [13, 17.5, '#b8301f'], [17.5, H, '#f4f2ec']]) {
    col(st, C(c, 0.85));
    cylinder(st, x, yb + h0, z, rAt(h0), h1 - h0, 18, { r2: rAt(h1) });
  }
  // little windows up the tower, a stair's worth of light
  col(gl, C('#ffd29a', 1.2));
  for (const [h, a] of [[6, 2.2], [11, 0.4], [20, 3.6], [23.5, 1.4]]) {
    const r = rAt(h) + 0.02;
    gl.box(x + Math.cos(a) * r, yb + h, z + Math.sin(a) * r, 0.5, 0.9, 0.5, -a);
  }
  // the entrance: a little gabled porch toward the keeper's house
  const da = Math.atan2(-4.6, -1);   // door faces north-west, up the path
  const ex = x + Math.cos(da) * 3.6, ez = z + Math.sin(da) * 3.6;
  const ery = Math.atan2(Math.cos(da), Math.sin(da));
  col(pa, C('#f4f2ec'));
  box(pa, ex, yb, ez, 2.6, 2.8, 2.4, ery, {});
  col(pa, C('#8a2a20'));
  gable(pa, ex, yb + 2.8, ez, 2.6, 2.4, 0.9, ery + Math.PI / 2, { over: 0.25 });
  col(pa, C('#5a1d18'));
  box(pa, ex + Math.cos(da) * 1.22, yb, ez + Math.sin(da) * 1.22, 1.0, 2.1, 0.06, ery, {});
  // the gallery: a deck on corbels, a railing round it
  const gy = yb + H;
  col(pa, C('#2e2e30'));
  cylinder(pa, x, gy, z, 3.75, 0.35, 18, { top: true, bottom: true });
  for (let k = 0; k < 12; k++) {
    const a = (k / 12) * Math.PI * 2;
    const r = 2.55;
    pa.beam(x + Math.cos(a) * (r - 0.1), gy - 1.1, z + Math.sin(a) * (r - 0.1), x + Math.cos(a) * 3.5, gy, z + Math.sin(a) * 3.5, 0.3, 0.3);
  }
  col(st, C('#2a2a2c'));
  const posts = 20;
  for (let k = 0; k < posts; k++) {
    const a0 = (k / posts) * Math.PI * 2, a1 = ((k + 1) / posts) * Math.PI * 2;
    const r = 3.6;
    st.box(x + Math.cos(a0) * r, gy + 0.35, z + Math.sin(a0) * r, 0.07, 1.05, 0.07);
    st.beam(x + Math.cos(a0) * r, gy + 1.38, z + Math.sin(a0) * r, x + Math.cos(a1) * r, gy + 1.38, z + Math.sin(a1) * r, 0.07, 0.07);
    st.beam(x + Math.cos(a0) * r, gy + 0.85, z + Math.sin(a0) * r, x + Math.cos(a1) * r, gy + 0.85, z + Math.sin(a1) * r, 0.04, 0.04);
  }
  // the watch room, its portholes
  col(st, C('#f4f2ec', 0.85));
  cylinder(st, x, gy + 0.35, z, 2.45, 2.1, 14, {});
  col(gl, C('#ffd8a0', 1.4));
  for (let k = 0; k < 4; k++) { const a = (k / 4) * Math.PI * 2 + 0.4; gl.box(x + Math.cos(a) * 2.47, gy + 1.1, z + Math.sin(a) * 2.47, 0.45, 0.45, 0.45, -a); }
  // the lantern: a dark parapet, the glass (lit), its astragals, the red dome
  col(pa, C('#3a1a16'));
  cylinder(pa, x, gy + 2.45, z, 2.15, 0.65, 14, { top: true });
  col(gl, C('#fff0c8', 2.6));
  cylinder(gl, x, gy + 3.1, z, 1.95, 3.0, 12, {});
  col(gl, C('#fffaf0', 4));
  cylinder(gl, x, gy + 3.9, z, 0.7, 1.3, 8, { top: true, bottom: true });
  col(st, C('#2a1a18'));
  for (let k = 0; k < 12; k++) {
    const a = (k / 12) * Math.PI * 2;
    st.box(x + Math.cos(a) * 1.98, gy + 3.1, z + Math.sin(a) * 1.98, 0.1, 3.0, 0.1, -a);
  }
  st.beam(x - 1.98, gy + 4.6, z, x + 1.98, gy + 4.6, z, 0.06, 0.06);
  col(pa, C('#8a2a20'));
  sphere(pa, x, gy + 6.1, z, 2.2, 14, { dome: true, sy: 0.9 });
  col(pa, C('#2a2a2c'));
  sphere(pa, x, gy + 8.2, z, 0.38, 8, {});
  tube(pa, x, gy + 8.4, z, x, gy + 10.4, z, 0.04, 4);
  // the sign at the foot of the path
  const sx = x - 3.5, sz = z - 9.5, sy = B.groundY(sx, sz);
  col(pa, C('#e8e4dc'));
  pa.box(sx - 1.3, sy - 0.3, sz, 0.12, 2.5, 0.12);
  pa.box(sx + 1.3, sy - 0.3, sz, 0.12, 2.5, 0.12);
  panel(sg, sx, sy + 1.7, sz, 3.0, 3.0 * 120 / 560, Math.PI + 0.3, uv.light, true);
  // the beam: two sweeps of light either side, turning (built about the lamp)
  const bm = new Acc(true);
  const base = [1.0, 0.92, 0.72];
  const stations = [[1.5, 0.45, 0.9], [26, 1.9, 0.6], [100, 6, 0.24], [260, 15, 0.0]];
  for (const dir of [1, -1]) {
    for (let p = 0; p < 3; p++) {
      const a = (p / 3) * Math.PI;
      const ca = Math.cos(a), sa = Math.sin(a);
      for (let i = 0; i < stations.length - 1; i++) {
        const [x0, r0, k0] = stations[i], [x1, r1, k1] = stations[i + 1];
        const c0 = [base[0] * k0 * 0.55, base[1] * k0 * 0.55, base[2] * k0 * 0.55], c1 = [base[0] * k1 * 0.55, base[1] * k1 * 0.55, base[2] * k1 * 0.55];
        // edge (dark) → axis (bright) → edge (dark)
        const ring = (xx, r, side) => [dir * xx, ca * r * side, sa * r * side];
        for (const side of [-1, 1]) {
          bm.col = [0, 0, 0];
          const e0 = bm.v(...ring(x0, r0, side)), e1 = bm.v(...ring(x1, r1, side));
          bm.col = c0;
          const m0 = bm.v(dir * x0, 0, 0);
          bm.col = c1;
          const m1 = bm.v(dir * x1, 0, 0);
          bm.tri(e0, e1, m1);
          bm.tri(e0, m1, m0);
        }
      }
    }
  }
  const mesh = new THREE.Mesh(bm.toGeometry(false), M.lbeam);
  mesh.frustumCulled = false;
  mesh.renderOrder = 6;
  const grp = new THREE.Group();
  grp.position.set(x, gy + 4.55, z);
  grp.add(mesh);
  B.group.add(grp);
  const ph = (it.n % 5) * 0.7;
  B.anim((t) => { grp.rotation.y = t * 0.52 + ph; });
}

// ------------------------------------------------------------------ the keeper's yard

function keeper(B, M, it, uv) {
  const { x, z, ry, y1 } = it;
  const rng = makeRng(seedOf(it));
  const F = frame(x, y1, z, ry);
  const pa = B.acc(M.paint), cn = B.acc(M.conc), cl = B.acc(M.clap), gl = B.acc(M.glow);
  // the keeper's house: two storeys, red roof, a porch to the yard
  const hp = F(-6, 0, -1);
  cottage(B, M, M, { x: hp[0], z: hp[2], ry, w: 12, d: 8, y0: it.y0, y1, floors: 2, tint: C('#f6f4ee'), roofC: C('#8a2a20'), porch: true, chimney: true, n: 1 }, rng);
  // the fog signal house: flat roofed, its two horns to the sea
  const fp = F(5.5, 0, -2);
  col(cn, C('#a8a296'));
  box(cn, fp[0], it.y0, fp[2], 7.3, y1 - it.y0, 5.3, ry, { u: 2 });
  col(cl, C('#f6f4ee'));
  box(cl, fp[0], y1, fp[2], 7, 3.6, 5, ry, { u: 16, v: 3.6, top: false });
  col(pa, C('#8a2a20'));
  box(pa, fp[0], y1 + 3.6, fp[2], 7.6, 0.4, 5.6, ry, {});
  col(pa, C('#2a2a2c'));
  for (const lx of [4, 7]) {
    const a = F(lx, 4.4, -2.5), b = F(lx, 4.9, -6.5);
    tube(pa, a[0], a[1], a[2], b[0], b[1], b[2], 0.18, 8, 0.75);
    lbox(pa, F, ry, lx, 4.0, -2.0, 0.5, 0.6, 0.5, {});
  }
  // the oil store: a stone hut with a round roof
  const op = F(11, 0, 3);
  col(cn, C('#c8c2b4'));
  box(cn, op[0], it.y0, op[2], 3, y1 - it.y0 + 2.4, 3, ry, { u: 2 });
  col(pa, C('#8a2a20'));
  sphere(pa, op[0], y1 + 2.4, op[2], 1.8, 8, { dome: true, sy: 0.5 });
  // the yard wall, whitewashed, the gate posts
  col(cn, C('#eceae2'));
  const wall = [[[-15, 8.3], [-2, 8.3]], [[2, 8.3], [15, 8.3]], [[15, 8.3], [15, -8.3]], [[15, -8.3], [4, -8.3]], [[0, -8.3], [-15, -8.3]], [[-15, -8.3], [-15, 8.3]]];
  for (const [a, b] of wall) {
    const n = Math.max(1, Math.round(Math.hypot(b[0] - a[0], b[1] - a[1]) / 3));
    for (let k = 0; k < n; k++) {
      const pa0 = [a[0] + (b[0] - a[0]) * (k + 0.5) / n, a[1] + (b[1] - a[1]) * (k + 0.5) / n];
      const p = F(pa0[0], 0, pa0[1]);
      const gy = B.groundY(p[0], p[2]);
      const L = Math.hypot(b[0] - a[0], b[1] - a[1]) / n;
      const along = Math.abs(b[0] - a[0]) > 0.1;
      box(cn, p[0], gy - 0.4, p[2], along ? L + 0.05 : 0.5, 1.6, along ? 0.5 : L + 0.05, ry, { u: 2 });
    }
  }
  for (const lx of [-2.2, 2.2]) {
    const p = F(lx, 0, 8.3);
    const gy = B.groundY(p[0], p[2]);
    box(cn, p[0], gy - 0.4, p[2], 0.8, 2.2, 0.8, ry, { u: 2 });
    col(gl, C('#ffd29a', 2.4));
    gl.box(p[0], gy + 1.8, p[2], 0.4, 0.45, 0.4);
    col(cn, C('#eceae2'));
  }
  // the flagstaff
  const fs = F(-1, 0, 5);
  col(pa, C('#f4f2ec'));
  tube(pa, fs[0], y1 - 0.5, fs[2], fs[0], y1 + 11, fs[2], 0.1, 6, 0.06);
  col(pa, C('#1d3a6a'));
  const fq = F(-1, 0, 5);
  box(pa, fq[0] + 1.0 * Math.cos(ry), y1 + 9.8, fq[2] - 1.0 * Math.sin(ry), 2, 1.2, 0.03, ry, {});
  // the board at the gate
  const sp = F(4.5, 0, 9.5);
  const sy = B.groundY(sp[0], sp[2]);
  col(pa, C('#e8e4dc'));
  pa.box(sp[0], sy - 0.3, sp[2], 0.12, 2.4, 0.12);
  panel(B.acc(M.sign), sp[0], sy + 1.8, sp[2], 2.6, 2.6 * 120 / 560, ry, uv.light, true);
}

// ------------------------------------------------------------------ the marina

function pontoons(B, M, it) {
  const wd = B.acc(M.wood), pa = B.acc(M.paint), gl = B.acc(M.glow), st = B.near(M.paint);
  const deck = 0.62;
  const floatC = C('#3a3c40');
  const run = (x0, z0, x1, z1, w) => {
    const L = Math.hypot(x1 - x0, z1 - z0), ry = Math.atan2(x1 - x0, z1 - z0);
    const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
    col(pa, floatC);
    box(pa, cx, -0.35, cz, w - 0.3, deck - 0.22 + 0.35, L, ry, {});
    col(wd, C('#a89878'));
    box(wd, cx, deck - 0.22, cz, w, 0.22, L, ry, { u: 2 });
  };
  // the walkway, the T, the fingers
  run(MX, MZ0 + 2, MX, MZ1, 3);
  run(1452, MZ1, 1560, MZ1, 3);
  for (let k = 0; k < 8; k++) {
    const zf = MZ0 - 12 - k * 11;
    for (const sd of [-1, 1]) run(MX + sd * 1.5, zf, MX + sd * 12.5, zf, 1.3);
  }
  // cleats along the edges, lamp posts
  col(st, C('#c8c4bc'));
  for (let z = MZ0 - 4; z > MZ1; z -= 5.5) for (const sd of [-1, 1]) st.box(MX + sd * 1.35, deck, z, 0.18, 0.12, 0.45);
  for (let k = 0, z = MZ0 - 14; z > MZ1; z -= 24, k++) {
    const sd = k % 2 ? 1 : -1;
    lampPost(pa, gl, MX + sd * 1.1, deck, z, 2.6, '#ffe2b0', '#e8e4dc');
  }
  for (const x of [1462, 1548]) lampPost(pa, gl, x, deck, MZ1 - 1, 2.6, '#ffe2b0', '#e8e4dc');
  // the fuel berth on the T's east end: a hut, a pump, the sign
  const hx = 1554, hz = MZ1 + 0.2;
  col(pa, C('#f2efe6'));
  box(pa, hx, deck, hz, 3.2, 2.5, 2.4, 0, {});
  col(pa, C('#1d3a5a'));
  box(pa, hx, deck + 2.5, hz, 3.6, 0.25, 2.8, 0, {});
  col(gl, C('#ffe2b0', 1.6));
  box(gl, hx, deck + 1.1, hz - 1.22, 1.6, 0.9, 0.04, 0, {});
  col(pa, C('#c82a1d'));
  box(pa, hx - 2.4, deck, hz - 0.6, 0.6, 1.5, 0.4, 0, {});
  panel(B.acc(M.sign), hx, deck + 3.1, hz - 1.3, 1.9, 1.9 * 90 / 240, Math.PI, UV().fuel, true);
}

/**
 * A boat about frame F (its waterline at local y 0, bow to local +z):
 * sail (sloop), cat (catamaran), motor (cruiser), yacht (a big motor
 * yacht), fish (a little trawler).
 */
function boatModel(B, M, F, ry, kind, L, rng, dry) {
  const pa = B.acc(M.paint), gl = B.acc(M.glow), wd = B.acc(M.wood), mt = B.acc(M.matte);
  const Bw = kind === 'yacht' ? L * 0.26 : kind === 'cat' ? L * 0.55 : L * 0.33;
  const fb = kind === 'yacht' ? 1.6 : kind === 'fish' ? 1.2 : 0.95;
  const hullC = kind === 'fish' ? C(rng() < 0.5 ? '#2a5a8a' : '#a83a2a') : C(rng() < 0.82 ? '#f4f4f0' : rng() < 0.5 ? '#1d2a44' : '#2a4a3a');
  if (kind === 'cat') {
    for (const s of [-1, 1]) hullShape(pa, (a, b, c) => F(a + s * Bw * 0.38, b, c), L, Bw * 0.22, fb, hullC, C('#e8e6e0'), dry);
    col(pa, C('#eeece6'));
    lbox(pa, F, ry, 0, fb - 0.1, -L * 0.08, Bw * 0.95, 0.3, L * 0.62, {});
    lbox(pa, F, ry, 0, fb + 0.2, -L * 0.12, Bw * 0.55, 1.1, L * 0.3, {});
    col(gl, C('#ffd8a0', rng() < 0.4 ? 1.3 : 0.08));
    lbox(gl, F, ry, 0, fb + 0.65, -L * 0.12 + L * 0.15 + 0.01, Bw * 0.45, 0.4, 0.04, {});
  } else hullShape(pa, F, L, Bw, fb, hullC, C(kind === 'fish' ? '#8a8478' : '#e8e2d4'), dry);
  if (kind === 'sail' || kind === 'cat') {
    // the coachroof, the mast, the boom with its sail cover, the stays
    if (kind === 'sail') {
      col(pa, C('#f0eee8'));
      lbox(pa, F, ry, 0, fb - 0.05, -L * 0.05, Bw * 0.55, 0.65, L * 0.32, {});
      col(gl, C('#ffd8a0', rng() < 0.35 ? 1.3 : 0.06));
      for (const s of [-1, 1]) lbox(gl, F, ry, s * Bw * 0.276, fb + 0.25, -L * 0.05, 0.03, 0.22, L * 0.2, {});
      col(wd, C('#9a7a5a'));
      lbox(wd, F, ry, 0, fb - 0.02, -L * 0.36, Bw * 0.6, 0.08, L * 0.2, { u: 1 });
    }
    const mh = L * 1.25;
    const mz = kind === 'cat' ? 0 : L * 0.08;
    col(pa, C('#c8ccd0'));
    const m0 = F(0, fb, mz), m1 = F(0, fb + mh, mz);
    tube(pa, m0[0], m0[1], m0[2], m1[0], m1[1], m1[2], 0.09, 5, 0.06);
    const b1 = F(0, fb + 1.6, mz - L * 0.42);
    const b0 = F(0, fb + 1.6, mz);
    pa.beam(b0[0], b0[1], b0[2], b1[0], b1[1], b1[2], 0.1, 0.12);
    col(mt, C(rng() < 0.6 ? '#1d3a6a' : '#3a3a3e'));
    const sc0 = F(0, fb + 1.75, mz - 0.3), sc1 = F(0, fb + 1.75, mz - L * 0.4);
    mt.beam(sc0[0], sc0[1], sc0[2], sc1[0], sc1[1], sc1[2], 0.4, 0.5);
    col(pa, C('#8a8e92'));
    const bow = F(0, fb + 0.2, L * 0.49), stern = F(0, fb + 0.2, -L * 0.48);
    pa.beam(m1[0], m1[1], m1[2], bow[0], bow[1], bow[2], 0.025, 0.025);
    pa.beam(m1[0], m1[1], m1[2], stern[0], stern[1], stern[2], 0.025, 0.025);
    col(gl, C('#fff8e8', 3));
    gl.box(m1[0], m1[1], m1[2], 0.2, 0.2, 0.2);
  } else if (kind === 'motor' || kind === 'yacht') {
    // the saloon, its windows, a flybridge
    const big = kind === 'yacht';
    col(pa, C('#f6f6f2'));
    lbox(pa, F, ry, 0, fb, -L * 0.06, Bw * 0.78, big ? 2.2 : 1.6, L * 0.48, {});
    if (big) lbox(pa, F, ry, 0, fb + 2.2, -L * 0.12, Bw * 0.66, 1.8, L * 0.32, {});
    col(pa, C('#1d2228'));
    lbox(pa, F, ry, 0, fb + 0.55, -L * 0.06, Bw * 0.8, 0.7, L * 0.44, {});
    if (big) lbox(pa, F, ry, 0, fb + 2.6, -L * 0.12, Bw * 0.68, 0.7, L * 0.28, {});
    col(gl, C('#ffd8a0', rng() < 0.5 ? 1.4 : 0.08));
    for (const s of [-1, 1]) lbox(gl, F, ry, s * Bw * 0.405, fb + 0.6, -L * 0.1, 0.03, 0.55, L * 0.3, {});
    // the radar arch / the flybridge rail
    col(pa, C('#e8e8e4'));
    const ty = fb + (big ? 4.0 : 1.6);
    const a0 = F(-Bw * 0.3, ty, -L * 0.22), a1 = F(-Bw * 0.3, ty + 1.2, -L * 0.18), a2 = F(Bw * 0.3, ty + 1.2, -L * 0.18), a3 = F(Bw * 0.3, ty, -L * 0.22);
    pa.beam(a0[0], a0[1], a0[2], a1[0], a1[1], a1[2], 0.15, 0.15);
    pa.beam(a1[0], a1[1], a1[2], a2[0], a2[1], a2[2], 0.15, 0.15);
    pa.beam(a2[0], a2[1], a2[2], a3[0], a3[1], a3[2], 0.15, 0.15);
    col(gl, C('#fff8e8', 2.4));
    gl.box(a1[0] * 0.5 + a2[0] * 0.5, a1[1] + 0.1, a1[2] * 0.5 + a2[2] * 0.5, 0.18, 0.18, 0.18);
  } else if (kind === 'fish') {
    // the wheelhouse forward, a gantry aft, floats and a net
    col(pa, C('#f0eee8'));
    lbox(pa, F, ry, 0, fb, L * 0.12, Bw * 0.6, 1.9, L * 0.25, {});
    col(pa, C('#c8302a'));
    lbox(pa, F, ry, 0, fb + 1.9, L * 0.12, Bw * 0.66, 0.15, L * 0.29, {});
    col(gl, C('#ffe0a0', rng() < 0.6 ? 1.6 : 0.1));
    lbox(gl, F, ry, 0, fb + 1.1, L * 0.12 + L * 0.125 + 0.01, Bw * 0.5, 0.55, 0.04, {});
    col(pa, C('#3a3a3e'));
    for (const s of [-1, 1]) { const a = F(s * Bw * 0.4, fb, -L * 0.4), b = F(s * Bw * 0.25, fb + 3.4, -L * 0.34); pa.beam(a[0], a[1], a[2], b[0], b[1], b[2], 0.14, 0.14); }
    const g0 = F(-Bw * 0.25, fb + 3.4, -L * 0.34), g1 = F(Bw * 0.25, fb + 3.4, -L * 0.34);
    pa.beam(g0[0], g0[1], g0[2], g1[0], g1[1], g1[2], 0.14, 0.14);
    col(mt, C('#5a6a4a'));
    lbox(mt, F, ry, 0, fb, -L * 0.25, Bw * 0.5, 0.6, L * 0.2, {});
    col(pa, C('#ff7a1a'));
    for (let k = 0; k < 4; k++) { const p = F((k - 1.5) * 0.5, fb + 0.75, -L * 0.25); pa.box(p[0], p[1], p[2], 0.3, 0.3, 0.3); }
  }
}

/** A hull: deck outline at freeboard fb, a narrower keel line under the water, a transom. */
function hullShape(pa, F, L, Bw, fb, hullC, deckC, dry) {
  const zs = [-0.5, -0.3, 0, 0.22, 0.36, 0.46, 0.5];
  const ws = [0.86, 0.96, 1, 0.94, 0.74, 0.42, 0.03];
  const lo = dry ? -1.0 : -0.5;
  const T = zs.map((t, i) => [ws[i] * Bw / 2, fb + (t > 0.2 ? (t - 0.2) * 1.1 : 0), t * L]);
  const Bt = zs.map((t, i) => [ws[i] * Bw / 2 * 0.42, lo, t * L * (t > 0 ? 0.92 : 0.96)]);
  col(pa, hullC);
  for (let i = 0; i < zs.length - 1; i++) {
    const t0 = T[i], t1 = T[i + 1], b0 = Bt[i], b1 = Bt[i + 1];
    pa.quadP(F(b1[0], b1[1], b1[2]), F(b0[0], b0[1], b0[2]), F(t0[0], t0[1], t0[2]), F(t1[0], t1[1], t1[2]));
    pa.quadP(F(-b0[0], b0[1], b0[2]), F(-b1[0], b1[1], b1[2]), F(-t1[0], t1[1], t1[2]), F(-t0[0], t0[1], t0[2]));
  }
  // the boot top: a dark band at the waterline
  if (!dry) {
    col(pa, C('#1d2a3a'));
    for (let i = 0; i < zs.length - 1; i++) {
      const k0 = ws[i] * Bw / 2 * 0.86, k1 = ws[i + 1] * Bw / 2 * 0.86;
      const z0 = zs[i] * L * 0.97, z1 = zs[i + 1] * L * 0.97;
      pa.quadP(F(k1 + 0.02, -0.1, z1), F(k0 + 0.02, -0.1, z0), F(k0 + 0.02, 0.14, z0), F(k1 + 0.02, 0.14, z1));
      pa.quadP(F(-k0 - 0.02, -0.1, z0), F(-k1 - 0.02, -0.1, z1), F(-k1 - 0.02, 0.14, z1), F(-k0 - 0.02, 0.14, z0));
    }
    col(pa, hullC);
  }
  // the transom
  pa.quadP(F(Bt[0][0], lo, Bt[0][2]), F(-Bt[0][0], lo, Bt[0][2]), F(-T[0][0], fb, T[0][2]), F(T[0][0], fb, T[0][2]));
  // the deck
  col(pa, deckC);
  for (let i = 0; i < zs.length - 1; i++) {
    const t0 = T[i], t1 = T[i + 1];
    pa.quadP(F(-t1[0], t1[1], t1[2]), F(t1[0], t1[1], t1[2]), F(t0[0], t0[1], t0[2]), F(-t0[0], t0[1], t0[2]));
  }
}

function* mole(B, M, it) {
  // big rocks tipped in a bank, the crest higher (built in slices)
  const rng = makeRng(seedOf(it));
  const rk = B.acc(M.rock);
  const [ax, az] = it.a, [bx, bz] = it.b;
  const L = Math.hypot(bx - ax, bz - az);
  const n = Math.ceil(L / 4.4);
  const nx = -(bz - az) / L, nz = (bx - ax) / L;
  for (let k = 0; k <= n; k++) {
    if (k && k % 6 === 0) yield;
    const t = k / n;
    const x = ax + (bx - ax) * t, z = az + (bz - az) * t;
    for (const o of [-2.8, 0, 2.8]) {
      const px = x + nx * (o + (rng() - 0.5)), pz = z + nz * (o + (rng() - 0.5));
      const top = o === 0 ? 2.4 : 1.2;
      const s = 2.0 + rng() * 1.0;
      rockLump(rk, px, top - s * 0.3, pz, s * 1.15, s * 0.85, s, rng, rng() * 6, o === 0 ? [0.55, 0.53, 0.5] : [0.4, 0.39, 0.37], 6, 3);
    }
  }
  if (it.last) rockLump(rk, bx, 1.6, bz, 3.4, 2.4, 3.4, rng, 0, [0.5, 0.48, 0.45]);
}

function* club(B, M, it, uv) {
  const { x, z, ry, y1 } = it;
  const rng = makeRng(seedOf(it));
  const F = frame(x, y1, z, ry);
  const pa = B.acc(M.paint), wd = B.acc(M.wood), cl = B.acc(M.clap), gl = B.acc(M.glow), rf = B.acc(M.matte);
  // piles under the whole thing (the bank drops away to the beach)
  col(pa, C('#5a4e42'));
  for (let lx = -10; lx <= 10; lx += 4) for (const lz of [-5.5, 0, 5.5, 8.5, 11]) {
    const p = F(lx, 0, lz);
    const gy = B.groundY(p[0], p[2]);
    if (gy > y1 - 0.3) continue;
    pa.box(p[0], gy - 0.5, p[2], 0.35, y1 - gy + 0.5, 0.35);
  }
  yield;
  // the clubhouse: white boards, a green roof, a cupola
  col(cl, C('#f6f4ee'));
  box(cl, x, y1, z, 20, 3.6, 10, ry, { u: 16, v: 3.6, top: false });
  col(pa, C('#e8e6e0'));
  box(pa, x, y1 - 0.4, z, 20.3, 0.4, 10.3, ry, {});
  col(rf, C('#2a4a3a'));
  gable(rf, x, y1 + 3.6, z, 20, 10, 3.2, ry, { over: 0.6, endAcc: cl });
  col(cl, C('#f6f4ee'));
  box(cl, x, y1 + 5.6, z, 2.2, 2.0, 2.2, ry, { u: 16, v: 3.6 });
  col(rf, C('#2a4a3a'));
  coneC(rf, x, y1 + 7.6, z, 1.7, 1.6, 4);
  col(pa, C('#c8a24a'));
  tube(pa, x, y1 + 9.2, z, x, y1 + 10.4, z, 0.04, 4);
  const vp = F(0.6, 10.2, 0);
  pa.box(vp[0], vp[1], vp[2], 1.0, 0.25, 0.05, ry);
  // the veranda over the beach (local +z), its rail, string lights
  col(wd, C('#a89a86'));
  lbox(wd, F, ry, 0, -0.3, 8.2, 20, 0.3, 6.4, { u: 2 });
  col(pa, C('#f4f2ec'));
  for (let lx = -10; lx <= 10; lx += 2.5) lbox(pa, F, ry, lx, 0, 11.3, 0.12, 1.1, 0.12, {});
  for (const lz of [11.3]) { const a = F(-10, 1.05, lz), b = F(10, 1.05, lz); pa.beam(a[0], a[1], a[2], b[0], b[1], b[2], 0.1, 0.1); }
  for (const lx of [-10, 10]) { const a = F(lx, 1.05, 5), b = F(lx, 1.05, 11.3); pa.beam(a[0], a[1], a[2], b[0], b[1], b[2], 0.1, 0.1); }
  for (const lx of [-9.8, 0, 9.8]) lbox(pa, F, ry, lx, 0, 11.1, 0.16, 3.0, 0.16, {});
  const sl = B.acc(M.glow);
  col(sl, C('#fff0c8', 2.6));
  for (let k = 0; k < 24; k++) {
    const t = (k + 0.5) / 24;
    const lx = -9.8 + 19.6 * t;
    const p = F(lx, 2.9 - Math.sin(t * Math.PI * 3) ** 2 * 0.5, 11.1);
    sl.box(p[0], p[1], p[2], 0.14, 0.14, 0.14);
  }
  yield;
  // tables and umbrellas on the veranda
  for (let k = 0; k < 4; k++) {
    const lx = -7 + k * 4.6, lz = 8.8;
    const p = F(lx, 0, lz);
    col(pa, C('#e8e4dc'));
    pa.box(p[0], y1, p[2], 0.08, 2.4, 0.08);
    col(rf, C(k % 2 ? '#1d3a5a' : '#f4f2ec'));
    coneC(rf, p[0], y1 + 2.0, p[2], 1.6, 0.6, 8);
    col(wd, C('#8a7a66'));
    box(wd, p[0], y1 + 0.7, p[2], 1.0, 0.06, 1.0, ry, { u: 1 });
  }
  // the sign on the roof's front, the flagstaff with its yard and signal flags
  panel(B.acc(M.sign), ...F(0, 2.85, 5.08), 8, 8 * 120 / 820, ry, uv.club, false);
  const fs = F(7.5, 0, 10.6);
  col(pa, C('#f4f2ec'));
  tube(pa, fs[0], y1, fs[2], fs[0], y1 + 12, fs[2], 0.1, 6, 0.06);
  const ya = F(5.5, 9, 10.6), yb2 = F(9.5, 9, 10.6);
  pa.beam(ya[0], ya[1], ya[2], yb2[0], yb2[1], yb2[2], 0.06, 0.06);
  const flags = ['#d8302a', '#f4d82a', '#1d4a8a', '#f4f2ec', '#2a8a4a', '#1d1d22'];
  for (let k = 0; k < 6; k++) {
    col(pa, C(flags[(k + it.n) % 6]));
    const t = (k + 0.5) / 6;
    const p = F(5.5 + 4 * t, 8.6 - Math.sin(t * Math.PI) * 0.8, 10.6);
    pa.box(p[0], p[1], p[2], 0.6, 0.6, 0.02, ry);
  }
  // windows lit through the boards (the texture's), a door to the veranda
  col(pa, C('#1d3a5a'));
  lbox(pa, F, ry, -1.2, 0, 5.03, 1.2, 2.3, 0.06, {});
  lbox(pa, F, ry, 1.2, 0, 5.03, 1.2, 2.3, 0.06, {});
  col(gl, C('#ffd8a0', 1.6));
  lbox(gl, F, ry, 0, 0.3, 5.06, 3.6, 1.6, 0.04, {});
  void rng; void wd;
}

// ------------------------------------------------------------------ store, chapel

function store(B, M, it, uv) {
  const { ry, y1 } = it;
  const F0 = frame(it.x, y1, it.z, ry);
  const c0 = F0(-4, 0, -1);
  const x = c0[0], z = c0[2];
  const F = frame(x, y1, z, ry);
  const pa = B.acc(M.paint), cl = B.acc(M.clap), cn = B.acc(M.conc), wd = B.acc(M.wood), gl = B.acc(M.glow), rf = B.acc(M.matte), sg = B.acc(M.sign);
  col(cn, C('#8a8478'));
  box(cn, x, it.y0, z, 14.3, y1 - it.y0, 10.3, ry, { u: 2 });
  col(cl, C('#b8483a'));
  box(cl, x, y1, z, 14, 4, 10, ry, { u: 16, v: 4, top: false });
  // the false front over the porch, carrying the sign
  lbox(cl, F, ry, 0, 4, 4.9, 14, 2.4, 0.3, { u: 16, v: 4 });
  col(rf, C('#4a4a46'));
  gable(rf, x, y1 + 4, z, 14, 10, 2.2, ry, { over: 0.3, alongZ: true });
  panel(sg, ...F(0, 5.15, 5.08), 11, 11 * 130 / 620, ry, uv.store, false);
  // the porch: deck, posts, a lean-to roof, a bench, the ice chest
  col(wd, C('#9a8a76'));
  lbox(wd, F, ry, 0, -0.3, 6.6, 14, 0.3, 3.2, { u: 2 });
  col(pa, C('#f2efe6'));
  for (const lx of [-6.8, -2.3, 2.3, 6.8]) lbox(pa, F, ry, lx, 0, 8.0, 0.16, 3.0, 0.16, {});
  col(rf, C('#4a4a46'));
  const r0 = [F(-7.2, 3.0, 8.4), F(7.2, 3.0, 8.4), F(7.2, 3.6, 5.0), F(-7.2, 3.6, 5.0)];
  rf.quadP(r0[0], r0[1], r0[2], r0[3]);
  rf.quadP(r0[1], r0[0], r0[3], r0[2]);
  col(pa, C('#f4f4f0'));
  lbox(pa, F, ry, 5.2, 0, 6.0, 1.6, 1.0, 0.9, {});
  col(wd, C('#7a6a56'));
  lbox(wd, F, ry, -4.6, 0.45, 6.0, 2.2, 0.08, 0.5, { u: 1 });
  // shop windows and the door, lit; the OPEN sign
  col(gl, C('#ffe2b0', 1.9));
  lbox(gl, F, ry, -4, 0.8, 5.03, 4, 1.9, 0.04, {});
  lbox(gl, F, ry, 4, 0.8, 5.03, 3, 1.9, 0.04, {});
  col(pa, C('#3a2a1e'));
  lbox(pa, F, ry, 0.8, 0, 5.03, 1.2, 2.3, 0.06, {});
  panel(sg, ...F(-4, 2.3, 5.1), 1.2, 1.2 * 90 / 220, ry, uv.open, false);
  // the gas pump beside it under its lamp
  const pp = F0(7.5, 0, 3);
  const py = B.groundY(pp[0], pp[2]);
  col(cn, C('#a8a49a'));
  box(cn, pp[0], py - 0.2, pp[2], 1.6, 0.35, 2.8, ry, { u: 2 });
  col(pa, C('#c8302a'));
  box(pa, pp[0], py + 0.15, pp[2], 0.55, 1.8, 0.8, ry, {});
  col(gl, C('#fff4dc', 2));
  box(gl, pp[0], py + 1.95, pp[2], 0.5, 0.5, 0.7, ry, {});
  col(pa, C('#3a3a3e'));
  const lp = F0(8.5, 0, 4.5);
  tube(pa, lp[0], py, lp[2], lp[0], py + 3.6, lp[2], 0.07, 5);
  col(gl, C('#e8f0ff', 2.4));
  gl.box(lp[0], py + 3.4, lp[2], 0.5, 0.25, 0.5);
}

function chapel(B, M, it, uv) {
  const { x, z, ry, y1 } = it;
  const F = frame(x, y1, z, ry);
  const pa = B.acc(M.paint), cl = B.acc(M.clap), cn = B.acc(M.conc), gl = B.acc(M.glow), rf = B.acc(M.matte);
  col(cn, C('#8a8478'));
  box(cn, x, it.y0, z, 9.3, y1 - it.y0, 16.3, ry, { u: 2 });
  // the nave: white boards, a steep roof, tall lancet windows (stained glass, lit)
  col(cl, C('#f6f4ee'));
  box(cl, x, y1, z, 9, 4.6, 16, ry, { u: 16, v: 4.6, top: false });
  col(rf, C('#3a3e44'));
  gable(rf, x, y1 + 4.6, z, 9, 16, 4.2, ry, { over: 0.4, alongZ: true, endAcc: cl });
  const glass = ['#ff6a4a', '#4a8aff', '#ffd84a', '#6aff8a', '#c86aff'];
  for (const s of [-1, 1]) {
    for (let k = 0; k < 4; k++) {
      const lz = -6 + k * 3.6;
      col(gl, C(glass[(k + (s > 0 ? 2 : 0)) % glass.length], 1.5));
      lbox(gl, F, ry, s * 4.52, 1.2, lz, 0.05, 2.4, 0.9, {});
      col(pa, C('#f6f4ee'));
      const p = F(s * 4.55, 3.6, lz);
      coneC(pa, p[0], p[1], p[2], 0.55, 0.6, 4);
    }
  }
  // the tower and spire over the door (local +z), a bell, a cross
  col(cl, C('#f6f4ee'));
  lbox(cl, F, ry, 0, 0, 7.6, 3.6, 10.5, 3.6, { u: 16, v: 4.6 });
  col(pa, C('#2a2a2e'));
  for (const [a, b] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) lbox(pa, F, ry, a * 1.82, 8.2, 7.6 + b * 1.82, a ? 0.05 : 1.6, 1.8, a ? 1.6 : 0.05, {});
  col(gl, C('#ffd8a0', 1.2));
  lbox(gl, F, ry, 0, 8.6, 7.6, 1.2, 0.9, 1.2, {});
  col(rf, C('#3a3e44'));
  const sp = F(0, 10.5, 7.6);
  coneC(rf, sp[0], sp[1], sp[2], 2.6, 7.5, 4);
  col(pa, C('#d8c88a'));
  const ct = F(0, 18, 7.6);
  pa.box(ct[0], ct[1], ct[2], 0.12, 1.6, 0.12, ry);
  pa.box(ct[0], ct[1] + 1.0, ct[2], 0.8, 0.12, 0.12, ry);
  // the door, steps, the board
  col(pa, C('#6a2a1d'));
  lbox(pa, F, ry, 0, 0, 9.43, 1.6, 2.8, 0.06, {});
  col(cn, C('#b8b2a6'));
  lbox(cn, F, ry, 0, -0.6, 10.2, 3, 0.6, 1.6, {});
  col(gl, C('#ffd8a0', 1.8));
  lbox(gl, F, ry, 0, 3.2, 9.45, 0.7, 0.7, 0.05, {});
  const bp = F(-4.5, 0, 12.5);
  const by = B.groundY(bp[0], bp[2]);
  col(pa, C('#3a2e24'));
  pa.box(bp[0] - 1.3 * Math.cos(ry), by - 0.3, bp[2] + 1.3 * Math.sin(ry), 0.12, 2.3, 0.12);
  pa.box(bp[0] + 1.3 * Math.cos(ry), by - 0.3, bp[2] - 1.3 * Math.sin(ry), 0.12, 2.3, 0.12);
  panel(B.acc(M.sign), bp[0], by + 1.5, bp[2], 2.8, 2.8 * 110 / 560, ry, uv.chapel, true);
}

// ------------------------------------------------------------------ the battery

function battery(B, M, it, uv) {
  const { x, z, ry } = it;
  const y = B.groundY(x, z);
  const rng = makeRng(seedOf(it));
  const F = frame(x, y, z, ry);
  const cn = B.acc(M.conc), pa = B.acc(M.paint), lf = B.acc(M.leaf), rk = B.acc(M.rock);
  const CON = C('#9a978c');
  if (it.part === 'pit') {
    // the pit: an apron, a ring parapet open at the back, the gun on its pivot
    const gy0 = B.groundY(x, z);
    col(cn, mixC(CON, [0.3, 0.32, 0.26], 0.25));
    const ring = [];
    for (let k = 0; k < 16; k++) { const a = -(k / 16) * Math.PI * 2; ring.push([x + Math.cos(a) * 7, z + Math.sin(a) * 7]); }
    drape(cn, B, ring, { lift: 0.06, step: 4, uv: 3 });
    for (let k = 0; k < 16; k++) {
      const a0 = (k / 16) * Math.PI * 2, a1 = ((k + 1) / 16) * Math.PI * 2;
      const mid = (a0 + a1) / 2;
      // the gap faces inland (local -z)
      const along = Math.cos(mid) * Math.sin(ry) + Math.sin(mid) * Math.cos(ry);
      if (along < -0.85) continue;
      col(cn, CON);
      const r0 = 7.0, r1 = 7.9;
      const P0 = [x + Math.cos(a0) * r0, z + Math.sin(a0) * r0], P1 = [x + Math.cos(a1) * r0, z + Math.sin(a1) * r0];
      const Q0 = [x + Math.cos(a0) * r1, z + Math.sin(a0) * r1], Q1 = [x + Math.cos(a1) * r1, z + Math.sin(a1) * r1];
      const gm = B.groundY((P0[0] + Q1[0]) / 2, (P0[1] + Q1[1]) / 2);
      const yt = Math.max(gy0, gm) + 1.3, yb = gm - 0.5;
      cn.quadP([P0[0], yb, P0[1]], [P1[0], yb, P1[1]], [P1[0], yt, P1[1]], [P0[0], yt, P0[1]]);
      cn.quadP([Q1[0], yb, Q1[1]], [Q0[0], yb, Q0[1]], [Q0[0], yt, Q0[1]], [Q1[0], yt, Q1[1]]);
      cn.quadP([P1[0], yt, P1[1]], [Q1[0], yt, Q1[1]], [Q0[0], yt, Q0[1]], [P0[0], yt, P0[1]]);
    }
    // the gun: a pivot, a shield, a long barrel over the parapet
    const gunC = C('#4a5038');
    col(pa, C('#3a3a34'));
    cylinder(pa, x, gy0 + 0.05, z, 2.3, 0.7, 12, { top: true });
    const train = (it.lx > 0 ? 0.25 : -0.3) + (rng() - 0.5) * 0.3;
    const G = frame3(x, gy0 + 0.75, z, ry + train, 0, 0);
    col(pa, gunC);
    const sh = [G(-1.6, 0, -1.2), G(1.6, 0, -1.2), G(1.4, 2.4, 0.4), G(-1.4, 2.4, 0.4)];
    pa.quadP(sh[0], sh[1], sh[2], sh[3]);
    pa.quadP(sh[1], sh[0], sh[3], sh[2]);
    lbox(pa, (a, b, c) => G(a, b, c), ry + train, 0, 0, -2.2, 2.4, 1.9, 2.2, {});
    const el = 0.12 + rng() * 0.08;
    const b0 = G(0, 1.25, -0.2), b1 = G(0, 1.25 + Math.sin(el) * 10.5, 10.5 * Math.cos(el));
    col(pa, mixC(gunC, [0.42, 0.24, 0.12], 0.35));
    tube(pa, b0[0], b0[1], b0[2], b1[0], b1[1], b1[2], 0.3, 8, 0.2);
    // rust stains, turf creeping onto the apron
    col(lf, [0.2, 0.28, 0.12]);
    for (let k = 0; k < 6; k++) { const a = rng() * 6.28, r = 4.5 + rng() * 2, px = x + Math.cos(a) * r, pz = z + Math.sin(a) * r; blob(lf, px, B.groundY(px, pz) - 0.05, pz, 0.8 + rng() * 0.7, 0.4, rng); }
  } else if (it.part === 'magazine') {
    // the magazine under its turf: a concrete face to the back, a mound over it
    col(cn, CON);
    lbox(cn, F, ry, 0, -1.5, -4.2, 20, 4.4, 1.0, { u: 2 });
    for (const s of [-1, 1]) lbox(cn, F, ry, s * 10.5, -1.5, -2.5, 1.0, 3.6, 4.4, { u: 2 });
    col(pa, C('#1a1a18'));
    for (const lx of [-5, 5]) lbox(pa, F, ry, lx, 0, -4.75, 2.2, 2.4, 0.1, {});
    col(pa, C('#5a3a24'));
    lbox(pa, F, ry, -5 + 0.6, 0, -4.8, 1.0, 2.3, 0.08, {});
    col(B.acc(M.glow), C('#ffb870', 1.6));
    lbox(B.acc(M.glow), F, ry, 0, 2.5, -4.85, 0.3, 0.35, 0.3, {});
    col(lf, [0.24, 0.32, 0.15]);
    for (let k = 0; k < 7; k++) {
      const p = F(-9 + k * 3, 1.5, 0.5 + (rng() - 0.5) * 2);
      blob(lf, p[0], p[1], p[2], 3.6 + rng() * 0.8, 0.6, rng, 7);
    }
    // the stencil over the door, the danger board
    panel(B.acc(M.sign), ...F(0, 3.0, -4.8), 4.2, 4.2 * 150 / 620, ry + Math.PI, uv.battery, false);
  } else if (it.part === 'tower') {
    // the fire control tower: a stalk, an observation room with its slit
    col(cn, CON);
    lbox(cn, F, ry, 0, -1.0, 0, 4.4, 9.2, 4.4, { u: 2 });
    lbox(cn, F, ry, 0, 8.2, 0, 6.4, 2.6, 6.4, { u: 2 });
    col(pa, C('#141414'));
    lbox(pa, F, ry, 0, 9.1, 3.22, 5.6, 0.55, 0.05, {});
    for (const s of [-1, 1]) lbox(pa, F, ry, s * 3.22, 9.1, 0.6, 0.05, 0.55, 3.6, {});
    col(cn, mixC(CON, [0.2, 0.2, 0.2], 0.2));
    lbox(cn, F, ry, 0, 10.8, 0, 7.0, 0.4, 7.0, { u: 2 });
    // the ladder up its back
    col(pa, C('#5a3a24'));
    for (const s of [-0.35, 0.35]) lbox(pa, F, ry, s, 0, -2.3, 0.08, 8.2, 0.08, {});
    for (let k = 0; k < 16; k++) lbox(pa, F, ry, 0, 0.4 + k * 0.5, -2.3, 0.7, 0.05, 0.05, {});
    // ivy up one side
    col(lf, [0.14, 0.24, 0.1]);
    for (let k = 0; k < 5; k++) { const p = F(-2.3, 1 + k * 1.6, (rng() - 0.5) * 3); blob(lf, p[0], p[1], p[2], 0.9 + rng() * 0.5, 1.2, rng); }
  } else if (it.part === 'teeth') {
    // dragon's teeth: a row of concrete pyramids across the old approach
    col(cn, CON);
    for (let k = 0; k < 7; k++) {
      const p = F(-18 + k * 4 + (rng() - 0.5), 0, (rng() - 0.5) * 1.2);
      const gy = B.groundY(p[0], p[2]);
      box(cn, p[0], gy - 0.4, p[2], 1.4, 0.6, 1.4, ry + rng() * 0.3, { u: 2 });
      coneC(cn, p[0], gy + 0.2, p[2], 1.0, 1.2, 4);
    }
    rockPile(rk, B, x + 12, z, 1.6, 3, rng);
  } else if (it.part === 'sign') {
    col(pa, C('#3a3a34'));
    const c = Math.cos(ry), s = Math.sin(ry);
    for (const o of [-1.2, 1.2]) pa.box(x + o * c, y - 0.3, z - o * s, 0.12, 2.6, 0.12);
    panel(B.acc(M.sign), x, y + 1.8, z - 0.08, 2.6, 2.6 * 130 / 440, ry + Math.PI, uv.danger, true);
  }
}

// ------------------------------------------------------------------ the cove

function boathouse(B, M, it, uv) {
  const { x, z, ry, y1 } = it;
  const rng = makeRng(seedOf(it));
  const F = frame(x, y1, z, ry);
  const wd = B.acc(M.wood), pa = B.acc(M.paint), gl = B.acc(M.glow), rf = B.acc(M.matte), nr = B.near(M.paint);
  // piles, the shed of weathered boards, its doors to the water (local +z)
  col(pa, C('#3a3028'));
  for (const [a, b] of [[-3.6, -3], [3.6, -3], [-3.6, 3], [3.6, 3], [0, 3], [0, -3]]) {
    const p = F(a, 0, b);
    pa.box(p[0], B.groundY(p[0], p[2]) - 0.5, p[2], 0.3, y1 - B.groundY(p[0], p[2]) + 0.5, 0.3);
  }
  col(wd, C('#8a7e70'));
  box(wd, x, y1, z, 7.6, 3.4, 6.4, ry, { u: 2.5 });
  col(rf, C('#4a4e52'));
  gable(rf, x, y1 + 3.4, z, 7.6, 6.4, 1.9, ry, { over: 0.4, alongZ: true, endAcc: wd });
  col(pa, C('#2a3a4a'));
  lbox(pa, F, ry, 0, 0, 3.23, 3.4, 2.8, 0.06, {});
  col(gl, C('#ffc070', 1.8));
  lbox(gl, F, ry, -2.6, 1.5, 3.24, 0.9, 0.8, 0.04, {});
  // the lantern by the door, buoys and floats hung on the wall
  const lp = F(-2.6, 2.5, 3.6);
  col(gl, C('#ffc070', 3));
  gl.box(lp[0], lp[1], lp[2], 0.3, 0.4, 0.3);
  const buoy = ['#ff5a1a', '#f4f2ec', '#ffd23a', '#2a8aff'];
  for (let k = 0; k < 6; k++) {
    col(nr, C(buoy[k % 4]));
    const p = F(3.85, 0.8 + (k % 3) * 0.7, -2 + Math.floor(k / 3) * 1.2);
    sphere(nr, p[0], p[1], p[2], 0.25, 6, {});
  }
  // the slip down to the water
  col(wd, C('#6a5e50'));
  const s0 = F(0, 0, 3.4), s1 = F(0, 0, 14);
  groundStrip(wd, B, [[s0[0], s0[2]], [s1[0], s1[2]]], 3, 0.15, 2, 2);
  // the sign over the doors
  panel(B.acc(M.sign), ...F(0, 3.05, 3.3), 3.2, 3.2 * 100 / 440, ry, uv.boats, false);
  void rng;
}

function seaArch(B, M, it) {
  const rng = makeRng(seedOf(it));
  const rk = B.acc(M.rock);
  const F = frame(it.x, 0, it.z, it.ry);
  const dark = [0.3, 0.29, 0.27], mid = [0.4, 0.38, 0.35], top = [0.5, 0.48, 0.44];
  for (const s of [-1, 1]) {
    const stack = [[0, -0.5, 4.2, 3.2, 3.8, dark], [0.3, 2.4, 3.6, 2.6, 3.2, mid], [0.6, 4.8, 3.2, 2.4, 2.9, mid], [0.9, 7.0, 3.0, 2.0, 2.6, top]];
    for (const [ox, y, sx, sy, sz, c] of stack) {
      const p = F(s * (5.5 - ox), y, (rng() - 0.5) * 0.6);
      rockLump(rk, p[0], p[1], p[2], sx, sy, sz, rng, rng() * 6, c);
    }
  }
  for (const [lx, y, sx] of [[-3, 9.0, 3.2], [0, 9.6, 3.4], [3, 9.0, 3.2], [0, 10.8, 2.6]]) {
    const p = F(lx, y, 0);
    rockLump(rk, p[0], p[1], p[2], sx, 1.8, 2.6, rng, rng() * 6, top);
  }
  // a little scrub on its crown, a gull or two
  const lf = B.acc(M.leaf);
  col(lf, [0.2, 0.3, 0.14]);
  const cp = F(0.5, 11.6, 0);
  sphere(lf, cp[0], cp[1], cp[2], 1.4, 6, { sy: 0.4 });
  const pa = B.near(M.paint);
  col(pa, C('#f4f4f0'));
  for (const lx of [-1.5, 2]) { const p = F(lx, 11.9, 0.3); pa.box(p[0], p[1], p[2], 0.25, 0.25, 0.45, it.ry + lx); }
}

function surf(B, M, it) {
  // the surf that glows: soft blue patches along the waterline and round
  // the arch, each on its own slow beat (night only)
  const ps = B.acc(M.pulse);
  const rng = makeRng(seedOf(it));
  const patch = (x, z, len, wid, ang, k, seed) => {
    const ca = Math.cos(ang), sa = Math.sin(ang);
    const P = (u, v) => [x + ca * u - sa * v, 0.06, z + sa * u + ca * v];
    const c = [0.1 * k, 0.65 * k, 1.0 * k];
    const g = [];
    for (let i = 0; i < 3; i++) {
      const row = [];
      for (let j = 0; j < 3; j++) {
        const edge = i === 1 && j === 1;
        ps.col = edge ? c : [0, 0, 0];
        row.push(ps.v(...P((i - 1) * len / 2, (j - 1) * wid / 2), seed, 0));
      }
      g.push(row);
    }
    for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) { ps.tri(g[i][j], g[i + 1][j], g[i + 1][j + 1]); ps.tri(g[i][j], g[i + 1][j + 1], g[i][j + 1]); }
  };
  for (let i = 0; i < SURF.length - 1; i++) {
    const a = SURF[i], b = SURF[i + 1];
    const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const ang = Math.atan2(b[1] - a[1], b[0] - a[0]);
    const nx = -Math.sin(ang), nz = Math.cos(ang);   // seaward (to the right going south-east)
    for (let k = 0; k < 3; k++) {
      const t = (k + rng()) / 3;
      const off = 2 + rng() * 7;
      patch(a[0] + (b[0] - a[0]) * t + nx * off, a[1] + (b[1] - a[1]) * t + nz * off, L * 0.6, 3 + rng() * 3, ang, 1.4 + rng(), rng());
    }
  }
  for (let k = 0; k < 10; k++) {
    const a = rng() * Math.PI * 2, r = 4 + rng() * 9;
    patch(1178 + Math.cos(a) * r, 3618 + Math.sin(a) * r, 4 + rng() * 4, 2 + rng() * 2, rng() * 3, 1.2 + rng(), rng());
  }
}

function beachkit(B, M, it, uv) {
  const rng = makeRng(seedOf(it));
  const pa = B.acc(M.paint), wd = B.acc(M.wood), nr = B.near(M.paint), mt = B.near(M.matte);
  // a rowing boat pulled up the sand, another on a mooring
  const by = B.groundY(1226, 3598);
  const F1 = frame3(1226, by + 0.45, 3598, 0.5 + Math.PI, 0.06, 0.12);
  hullShape(pa, F1, 4.4, 1.5, 0.55, C('#2a6a8a'), C('#a89a86'), true);
  col(wd, C('#8a7a66'));
  for (const lz of [-0.6, 0.6]) { const p = F1(0, 0.35, lz); box(wd, p[0], p[1], p[2], 1.3, 0.08, 0.3, 0.5 + Math.PI, { u: 1 }); }
  const F2 = frame(1186, 0, 3596, 2.2);
  hullShape(pa, F2, 4.2, 1.5, 0.55, C('#d8d4c8'), C('#8a7a66'), false);
  col(pa, C('#ff5a1a'));
  sphere(pa, 1180, 0.2, 3590, 0.45, 8, {});
  // lobster pots stacked by the boathouse, nets on poles, driftwood
  col(mt, C('#6a5a40'));
  for (let k = 0; k < 7; k++) {
    const x = 1234 + (k % 3) * 1.0, z = 3604 + Math.floor(k / 3) * 0.2, y = B.groundY(x, z) + Math.floor(k / 3) * 0.75;
    mt.box(x, y, z, 0.9, 0.7, 0.7, 0.75);
  }
  col(nr, C('#4a3a2a'));
  for (const [x, z] of NETS) nr.box(x, B.groundY(x, z) - 0.3, z, 0.12, 2.4, 0.12);
  col(mt, C('#3a4a3a'));
  for (const [a, b] of [[NETS[0], NETS[1]], [NETS[1], NETS[2]]]) {
    const ya = B.groundY(a[0], a[1]) + 1.9, yb = B.groundY(b[0], b[1]) + 1.9;
    mt.quadP([a[0], ya - 1.3, a[1]], [b[0], yb - 1.3, b[1]], [b[0], yb, b[1]], [a[0], ya, a[1]]);
    mt.quadP([b[0], yb - 1.3, b[1]], [a[0], ya - 1.3, a[1]], [a[0], ya, a[1]], [b[0], yb, b[1]]);
  }
  col(wd, C('#b8ab98'));
  for (let k = 0; k < 5; k++) {
    const x = 1198 + rng() * 40, z = 3570 + rng() * 60;
    const y = B.groundY(x, z);
    if (y < 0.3) continue;
    box(wd, x, y - 0.1, z, 3 + rng() * 3, 0.4, 0.45, rng() * 3, { u: 2 });
  }
  // the sign at the foot of the trail
  col(pa, C('#3a3028'));
  const sx = COVESIGN[0], sz = COVESIGN[1], sy = B.groundY(sx, sz);
  pa.box(sx, sy - 0.3, sz, 0.14, 2.4, 0.14);
  panel(B.acc(M.sign), sx, sy + 1.9, sz + 0.1, 2.6, 2.6 * 110 / 500, -2.2, uv.cove, true);
}

export { boatModel, hullShape };
