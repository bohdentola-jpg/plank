// PORT HALCYON — THE SHIPYARD: Halcyon Shipbuilding's yard, where ships are
// made rather than unloaded. Dry Dock No.1 out in the bay with a bulk
// carrier half built in it (its stern plated in red primer and grey, its bow
// still bare ribs in scaffolding) under BIG HALCYON, the yellow goliath crane
// with the yard's name on its girder; a hull high on Slipway 2 between two
// tower cranes; the ferry HALCYON STAR and a coast guard cutter fitting out
// under level-luffing cranes; a flooded dock with a trawler; the assembly
// halls with their doors open on the night shift (blue welding flicker
// inside and on the hull blocks in the yard); the steel stockyard, the gas
// store, the paint shop's striped stack; the old west end where the first
// slipways rot (the Boneyard), and past them, listing at the derelict quay,
// the wreck of the MARY KESTREL. Lit sodium orange, not the terminal's white.
import { makeRng } from '../../core/util.js';
import { litMat, box, cylinder, gable, lattice } from './builder.js';
import { C, col, frame, frame3, lbox, lbeam, fbox, tube, panel, seedOf, groundStrip, cmat, coneC, spark, arcPanel, catenary, beamLine, warmBuilders } from './coast/kit.js';
import { signAtlas, cladTexture, brickTexture, officeTexture, scaffoldTexture } from './coast/tex.js';
import { portMats, quayEdge, hull, hullFrames, container, randomBox, truck, mast, tugBoat, capUp } from './coast/port.js';
import { polyAtX, pieces, mid, frame2, shoreRuns } from './coast/geo.js';
import * as THREE from 'three';

const Y0 = 3.0;
const SODIUM = '#ffa040';
// the shore here (the quay wall), east to west
const QSY = [[-2800, 2456], [-3200, 2520], [-3700, 2620], [-4300, 2700], [-4900, 2720], [-5500, 2660], [-5700, 2648.6]];
const SLIP_X = -3460, DOCK1_X = -4050, DOCK2_X = -4800, FERRY_X = -3755, CUTTER_X = -4400;

// ------------------------------------------------------------------ signs

function interior(x, ex, x0, y0, w, h, rng) {
  // a hall's inside seen through its open door: lit bays, a hull block, a crane girder
  const g = x.createLinearGradient(0, y0, 0, y0 + h);
  g.addColorStop(0, '#3a3a36'); g.addColorStop(1, '#6a6458');
  x.fillStyle = g; x.fillRect(x0, y0, w, h);
  ex.fillStyle = '#000'; ex.fillRect(x0, y0, w, h);
  // the back wall's lights
  for (let k = 0; k < 6; k++) {
    const lx = x0 + 20 + k * (w - 40) / 5;
    x.fillStyle = '#fff4d8'; x.fillRect(lx - 10, y0 + 18, 20, 6);
    ex.fillStyle = '#fff0d0'; ex.globalAlpha = 0.9; ex.fillRect(lx - 12, y0 + 16, 24, 10);
    const gg = ex.createRadialGradient(lx, y0 + 22, 2, lx, y0 + 22, 60);
    gg.addColorStop(0, 'rgba(255,220,160,0.5)'); gg.addColorStop(1, 'rgba(255,220,160,0)');
    ex.fillStyle = gg; ex.fillRect(lx - 60, y0, 120, 90); ex.globalAlpha = 1;
  }
  // the overhead crane's girder
  x.fillStyle = '#d8b030'; x.fillRect(x0, y0 + 40, w, 14);
  x.fillStyle = '#222'; x.fillRect(x0 + w * 0.4, y0 + 54, 30, 18);
  // a hull block on the floor, in primer, with a glow under it
  x.fillStyle = '#8a3a2a';
  x.beginPath(); x.moveTo(x0 + w * 0.2, y0 + h - 10); x.lineTo(x0 + w * 0.28, y0 + h * 0.48); x.lineTo(x0 + w * 0.72, y0 + h * 0.48); x.lineTo(x0 + w * 0.8, y0 + h - 10); x.fill();
  x.strokeStyle = 'rgba(0,0,0,0.4)'; x.lineWidth = 2;
  for (let k = 1; k < 8; k++) { const px = x0 + w * (0.24 + k * 0.065); x.beginPath(); x.moveTo(px, y0 + h * 0.5); x.lineTo(px, y0 + h - 12); x.stroke(); }
  // the floor, lit
  x.fillStyle = '#8a857a'; x.fillRect(x0, y0 + h - 10, w, 10);
  ex.fillStyle = 'rgba(255,214,150,0.35)'; ex.fillRect(x0, y0 + h * 0.45, w, h * 0.55);
  // welding glare
  for (let k = 0; k < 3; k++) {
    const px = x0 + w * (0.3 + rng() * 0.4), py = y0 + h * (0.55 + rng() * 0.3);
    const gg = ex.createRadialGradient(px, py, 1, px, py, 26);
    gg.addColorStop(0, 'rgba(200,230,255,0.95)'); gg.addColorStop(1, 'rgba(120,170,255,0)');
    ex.fillStyle = gg; ex.fillRect(px - 26, py - 26, 52, 52);
  }
}

const SIGNS = [
  { id: 'hsb', w: 1000, h: 110, text: 'HALCYON SHIPBUILDING', style: 'letters', bg: '#e2b021', fg: '#14305a', glow: '#3a6ad0' },
  { id: 'gatesign', w: 760, h: 150, text: 'HALCYON SHIPBUILDING CO.', sub: 'MAIN GATE · EST. 1911', style: 'box', bg: '#14305a', fg: '#f0e6c8', glow: '#24508a', fgGlow: '#fff0c8' },
  { id: 'dock1', w: 520, h: 100, text: 'DRY DOCK No.1', style: 'paint', bg: '#b8b4aa', fg: '#14305a' },
  { id: 'dock2', w: 520, h: 100, text: 'DRY DOCK No.2', style: 'paint', bg: '#b8b4aa', fg: '#14305a' },
  { id: 'slip', w: 420, h: 100, text: 'SLIPWAY 2', style: 'paint', bg: '#b8b4aa', fg: '#14305a' },
  { id: 'hallA', w: 300, h: 110, text: 'HALL A', style: 'letters', bg: '#d6d6d2', fg: '#14305a', glow: '#fff0c0' },
  { id: 'hallB', w: 300, h: 110, text: 'HALL B', style: 'letters', bg: '#d6d6d2', fg: '#14305a', glow: '#fff0c0' },
  { id: 'hallC', w: 300, h: 110, text: 'HALL C', style: 'letters', bg: '#d6d6d2', fg: '#14305a', glow: '#fff0c0' },
  { id: 'hallD', w: 300, h: 110, text: 'HALL D', style: 'letters', bg: '#d6d6d2', fg: '#14305a', glow: '#fff0c0' },
  { id: 'hallE', w: 560, h: 110, text: 'ASSEMBLY HALL', style: 'letters', bg: '#d6d6d2', fg: '#14305a', glow: '#fff0c0' },
  { id: 'panel', w: 420, h: 110, text: 'PANEL LINE', style: 'letters', bg: '#d6d6d2', fg: '#14305a', glow: '#fff0c0' },
  { id: 'paintshop', w: 460, h: 110, text: 'PAINT SHOP', style: 'letters', bg: '#c4cbc0', fg: '#2a3a2a', glow: '#fff0c0' },
  { id: 'hot', w: 420, h: 100, text: 'DANGER', sub: 'HOT WORK · HARD HATS', style: 'paint', bg: '#e2b021', fg: '#111111' },
  { id: 'oxygen', w: 300, h: 80, text: 'OXYGEN', style: 'letters', bg: '#e8e8e4', fg: '#1d4f8f' },
  { id: 'argon', w: 300, h: 80, text: 'ARGON', style: 'letters', bg: '#e8e8e4', fg: '#2f6a3a' },
  { id: 'ferry', w: 700, h: 110, text: 'HALCYON STAR', style: 'letters', bg: '#f0eee8', fg: '#1d3f6e' },
  { id: 'cutter', w: 640, h: 120, text: 'HCG 12', sub: 'COAST GUARD', style: 'letters', bg: '#f0eee8', fg: '#1a1a1a' },
  { id: 'hulk', w: 560, h: 90, text: 'MARY KESTREL', style: 'letters', bg: '#5a3424', fg: '#b8a080' },
  { id: 'interior', w: 512, h: 256, style: 'custom', draw: interior },
];
const atlas = () => signAtlas('shipyard', SIGNS, 1024, 1024, 0.8);
const UV = () => atlas().uv;

function smats(B) {
  const M = portMats(B);
  M.sign = B.mat('sign', () => { const t = atlas(); return litMat({ map: t.map, emissive: 0xffffff, emissiveMap: t.emi, roughness: 0.6 }, { night: 1.2 }); });
  M.clad = cmat(B, 'clad', () => { const t = cladTexture('shed'); return litMat({ map: t.map, emissive: 0xffffff, emissiveMap: t.emi, vertexColors: true, roughness: 0.6, metalness: 0.25 }, { night: 0.95 }); });
  M.hallclad = B.mat('hallclad', () => { const t = cladTexture('hall'); return litMat({ map: t.map, emissive: 0xffffff, emissiveMap: t.emi, vertexColors: true, roughness: 0.6, metalness: 0.25 }, { night: 1.0 }); });
  M.brick = cmat(B, 'brick', () => { const t = brickTexture(); return litMat({ map: t.map, emissive: 0xffffff, emissiveMap: t.emi, vertexColors: true, roughness: 0.9 }, { night: 0.9 }); });
  M.office = cmat(B, 'office', () => { const t = officeTexture(); return litMat({ map: t.map, emissive: 0xffffff, emissiveMap: t.emi, vertexColors: true, roughness: 0.55, envMapIntensity: 0.8 }, { night: 1.0 }); });
  M.scaff = B.mat('scaff', () => litMat({ map: scaffoldTexture(), vertexColors: true, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.7, metalness: 0.3 }, { shadow: false }));
  return M;
}

// ------------------------------------------------------------------ the plan

export default {
  id: 'shipyard',

  plan(P) {
    const S = {};
    planShore(P, S);
    planDock1(P, S);
    planDock2(P, S);
    planSlip(P, S);
    planOutfit(P, S);
    planHalls(P, S);
    planBlocks(P, S);
    planNorth(P, S);
    planOldYard(P, S);
    planWreck(P, S);
    planMasts(P, S);
    P.landmark({ id: 'sy_goliath', name: 'BIG HALCYON', x: S.goliath?.x ?? DOCK1_X, z: S.goliath?.z ?? 2780, r: 60, kind: 'crane' });
    P.landmark({ id: 'sy_dock1', name: 'DRY DOCK No.1', x: DOCK1_X, z: 2760, r: 120, kind: 'dock' });
    P.landmark({ id: 'sy_slip', name: 'SLIPWAY 2', x: SLIP_X, z: 2540, r: 80, kind: 'slipway' });
    P.landmark({ id: 'sy_halls', name: 'THE ASSEMBLY HALLS', x: -4300, z: 2250, r: 300, kind: 'building' });
    P.landmark({ id: 'sy_star', name: 'HALCYON STAR', x: FERRY_X, z: 2645, r: 80, kind: 'ship' });
    P.landmark({ id: 'sy_boneyard', name: 'THE BONEYARD', x: -5230, z: 2640, r: 120, hidden: true, kind: 'yard' });
    if (S.wreck) P.landmark({ id: 'sy_wreck', name: 'WRECK OF THE MARY KESTREL', x: S.wreck.x, z: S.wreck.z, r: 60, hidden: true, kind: 'wreck' });
  },

  *warm(B) {
    const M = smats(B), uv = UV();
    yield;
    yield* warmBuilders(B, this, BUILD, M, uv);
  },

  *build(B, items) {
    const M = smats(B);
    const uv = UV();
    let t0 = performance.now();
    for (const it of items) {
      const fn = BUILD[it.type];
      if (fn) {
        const r = fn(B, M, it, uv);
        if (r && r[Symbol.iterator]) { yield* r; yield; t0 = performance.now(); continue; }
      }
      if (performance.now() - t0 > 1) { yield; t0 = performance.now(); }
    }
  },
};

/** A frame at the shore at x: origin on the quay edge, local z out to sea, local x along the shore (eastward). */
function shoreFrame(x) {
  const q = polyAtX(QSY, x);
  // walking the shore east → west the sea is on the left: (lx, lz)
  const ry = Math.atan2(q.lx, q.lz);
  return { q, ry, F: frame2(q.x, q.z, ry) };
}

// ------------------------------------------------------------------ shore

function planShore(P, S) {
  for (const pc of shoreRuns(QSY, [[SLIP_X - 18, SLIP_X + 18]], 110)) {
    const m = mid(pc);
    // the pieces run east → west: the sea is on their left
    P.add({ type: 'quay', x: m[0], z: m[1], pts: pc, sea: 1 });
  }
}

// ------------------------------------------------------------------ dry dock 1, the goliath, the hull in it

function planDock1(P, S) {
  const { q, ry, F } = shoreFrame(DOCK1_X);
  const W = 46, T = 6, Ld = 230;
  const c = F(0, Ld / 2);
  P.add({ type: 'dock', x: c[0], z: c[1], ox: q.x, oz: q.z, ry, W, T, Ld, top: Y0 + 0.6, sign: 'dock1' });
  for (const sd of [-1, 1]) {
    const w = F(sd * (W / 2 + T / 2), Ld / 2);
    P.far({ shape: 'box', x: w[0], z: w[1], y: -2, w: T, d: Ld, h: Y0 + 2.6, ry, color: '#8e8b84' });
    for (let k = 0; k < 5; k++) {
      const p = F(sd * (W / 2 + 2), 20 + k * 46);
      P.lamp({ x: p[0], z: p[1], hx: p[0], hy: Y0 + 10, hz: p[1], color: SODIUM, radius: 30, intensity: 0.9, halo: 2.4 });
    }
  }
  // the hull: bow to the land, its fore half still ribs
  const hc = F(0, 110);
  P.add({ type: 'yhull', x: hc[0], z: hc[1], y: Y0 - 1.2, ry: ry + Math.PI / 2, L: 186, Bm: 32, D: 18, open: [0.6, 1], scaff: true });
  P.far({ shape: 'box', x: hc[0], z: hc[1], y: Y0 - 1, w: 32, d: 186, h: 18, ry, color: '#7a3a2c' });
  // the goliath across the dock
  const gc = F(0, 128);
  S.goliath = { x: gc[0], z: gc[1] };
  P.add({ type: 'goliath', x: gc[0], z: gc[1], ry, span: W + T, top: Y0 + 0.6 });
  for (const sd of [-1, 1]) {
    for (const dz of [-14, 14]) {
      const p = F(sd * (W + T) / 2, 128 + dz);
      P.far({ shape: 'box', x: p[0], z: p[1], y: Y0, w: 3, d: 3, h: 66, ry, color: '#c99a1c' });
    }
    const t = F(sd * ((W + T) / 2 + 7), 128);
    P.lamp({ x: t[0], z: t[1], hx: t[0], hy: Y0 + 76, hz: t[1], color: '#ff2a18', radius: 2, intensity: 0, halo: 4.5 });
  }
  P.far({ shape: 'box', x: gc[0], z: gc[1], y: Y0 + 66, w: W + T + 16, d: 6, h: 7, ry, color: '#d4a520' });
  for (const dz of [100, 156]) {
    const p = F(0, dz);
    P.lamp({ x: p[0], z: p[1], hx: p[0], hy: Y0 + 64, hz: p[1], color: '#fff2d8', radius: 70, intensity: 1.0, halo: 2.5 });
  }
  // a block waiting at the dock head for the goliath
  for (const [lx, lz] of [[-20, -26], [16, -30]]) {
    const p = F(lx, lz);
    if (P.isFree(p[0], p[1], 18, 14, ry, { pad: 1 })) {
      P.add({ type: 'hblock', x: p[0], z: p[1], ry, w: 16, d: 12, h: 9, kind: lx < 0 ? 'side' : 'deck', y0: P.groundY(p[0], p[1]) });
      P.claim(p[0], p[1], 18, 14, ry);
      P.collider({ kind: 'box', x: p[0], z: p[1], hx: 8.5, hz: 6.5, ry, y0: Y0 - 1, y1: Y0 + 10 });
    }
  }
  const sp = F(0, -14);
  P.add({ type: 'boardsign', x: sp[0], z: sp[1], ry: ry + Math.PI, sign: 'dock1', w: 8, h: 1.55 });
  // the site cabins by the dock head, stacked two high, lit
  for (const [lx, lz] of [[-46, -40], [44, -52]]) {
    const p = F(lx, lz);
    if (!P.isFree(p[0], p[1], 14, 8, ry, { pad: 1, roadPad: true })) continue;
    const y0 = P.groundY(p[0], p[1]);
    P.add({ type: 'cabins', x: p[0], z: p[1], y0, ry });
    P.claim(p[0], p[1], 14, 8, ry);
    P.collider({ kind: 'box', x: p[0], z: p[1], hx: 6.5, hz: 3.6, ry, y0: y0 - 1, y1: y0 + 6 });
    P.lamp({ x: p[0], z: p[1], hx: p[0], hy: y0 + 6.5, hz: p[1], color: '#ffe0b0', radius: 20, intensity: 0.8, halo: 1.6 });
  }
  for (const lx of [-30, 30]) {
    const p = F(lx, -22);
    P.lamp({ x: p[0], z: p[1], hx: p[0], hy: Y0 + 9, hz: p[1], color: SODIUM, radius: 34, intensity: 0.9, halo: 2.4 });
    P.add({ type: 'oldlamp', x: p[0], z: p[1], tall: true });
  }
}

// ------------------------------------------------------------------ dry dock 2 (flooded, a trawler in it)

function planDock2(P, S) {
  const { q, ry, F } = shoreFrame(DOCK2_X);
  const W = 30, T = 5, Ld = 150;
  const c = F(0, Ld / 2);
  P.add({ type: 'dock', x: c[0], z: c[1], ox: q.x, oz: q.z, ry, W, T, Ld, top: Y0 + 0.6, flooded: true });
  for (const sd of [-1, 1]) {
    const w = F(sd * (W / 2 + T / 2), Ld / 2);
    P.far({ shape: 'box', x: w[0], z: w[1], y: -2, w: T, d: Ld, h: Y0 + 2.6, ry, color: '#8e8b84' });
    for (let k = 0; k < 3; k++) {
      const p = F(sd * (W / 2 + 2), 25 + k * 50);
      P.lamp({ x: p[0], z: p[1], hx: p[0], hy: Y0 + 10, hz: p[1], color: SODIUM, radius: 26, intensity: 0.8, halo: 2.2 });
    }
  }
  const t = F(0, 60);
  P.add({ type: 'trawler', x: t[0], z: t[1], ry: ry + Math.PI / 2 });
  const sp = F(0, -14);
  P.add({ type: 'boardsign', x: sp[0], z: sp[1], ry: ry + Math.PI, sign: 'dock2', w: 8, h: 1.55 });
}

// ------------------------------------------------------------------ slipway 2

function planSlip(P, S) {
  const { q, ry, F } = shoreFrame(SLIP_X);
  // local z: −135 (inland, raised high) … 0 (the quay edge, just over the
  // yard) … +45 (under the water)
  const z0 = -135, z1 = 45, yTop = Y0 + 9.5, yEdge = Y0 + 0.5, yEnd = -5;
  const c = F(0, (z0 + z1) / 2);
  P.add({ type: 'slipway', x: c[0], z: c[1], ox: q.x, oz: q.z, ry, z0, z1, yTop, yEdge, yEnd, w: 32 });
  // the land part is solid
  const lc = F(0, (z0 + 0) / 2);
  P.claim(lc[0], lc[1], 40, -z0 + 4, ry);
  P.collider({ kind: 'box', x: lc[0], z: lc[1], hx: 16.5, hz: -z0 / 2 + 1, ry, y0: Y0 - 1, y1: yTop + 2 });
  P.far({ shape: 'box', x: lc[0], z: lc[1], y: Y0 - 1, w: 33, d: -z0, h: 5, ry, color: '#8e8b84' });
  // the hull on it, bow up the slope
  const slope = (yTop - yEdge) / (0 - z0);
  const zc = -70, yRamp = yTop - (zc - z0) * slope;
  const hc = F(0, zc);
  P.add({ type: 'yhull', x: hc[0], z: hc[1], y: yRamp + 1.7, ry: ry + Math.PI / 2, pitch: Math.atan(slope), L: 128, Bm: 22, D: 13, open: [0.78, 1], scaff: true, slip: true });
  P.far({ shape: 'box', x: hc[0], z: hc[1], y: yRamp + 1, w: 22, d: 128, h: 14, ry, color: '#7a3a2c' });
  // two tower cranes, one each side, staggered
  for (const [lx, lz, flip] of [[-29, -95, 1], [29, -30, -1]]) {
    const p = F(lx, lz);
    const y0 = P.groundY(p[0], p[1]);
    P.add({ type: 'tower', x: p[0], z: p[1], y0, ry: flip > 0 ? ry + 0.3 : ry + Math.PI - 0.3, H: 54, jib: 52 });
    P.claim(p[0], p[1], 6, 6, ry);
    P.collider({ kind: 'box', x: p[0], z: p[1], hx: 2.5, hz: 2.5, ry, y0: y0 - 1, y1: y0 + 56 });
    P.far({ shape: 'box', x: p[0], z: p[1], y: y0, w: 2.2, d: 2.2, h: 58, ry, color: '#c99a1c' });
    P.lamp({ x: p[0], z: p[1], hx: p[0], hy: y0 + 62, hz: p[1], color: '#ff2a18', radius: 2, intensity: 0, halo: 3.5 });
    P.lamp({ x: p[0], z: p[1], hx: p[0] + 3, hy: y0 + 40, hz: p[1] + 3, color: SODIUM, radius: 52, intensity: 0.9, halo: 3 });
  }
  const sp = F(-22, z0 - 6);
  P.add({ type: 'boardsign', x: sp[0], z: sp[1], ry: ry + Math.PI, sign: 'slip', w: 7, h: 1.66 });
}

// ------------------------------------------------------------------ fitting out: the ferry and the cutter

function planOutfit(P, S) {
  for (const [x0, kind, L, Bm] of [[FERRY_X, 'ferry', 150, 25], [CUTTER_X, 'cutter', 92, 14]]) {
    const { q, ry, F } = shoreFrame(x0);
    const c = F(0, 2.6 + Bm / 2);
    // the ship's local x along the shore, its starboard (+z) to the quay
    P.add({ type: kind, x: c[0], z: c[1], ry: ry + Math.PI, L, Bm });
    P.far({ shape: 'box', x: c[0], z: c[1], y: -1, w: L, d: Bm, h: kind === 'ferry' ? 12 : 8, ry, color: kind === 'ferry' ? '#e8e6de' : '#d8d6ce' });
    P.far({ shape: 'box', x: c[0], z: c[1], y: kind === 'ferry' ? 11 : 7, w: L * 0.55, d: Bm * 0.8, h: kind === 'ferry' ? 12 : 7, ry, color: '#f0eee6', lit: 0.5 });
    P.lamp({ x: c[0], z: c[1], hx: c[0], hy: kind === 'ferry' ? 26 : 18, hz: c[1], color: '#fff0d0', radius: 40, intensity: 0.8, halo: 3 });
    // its luffing crane on the quay behind it
    const k = F(kind === 'ferry' ? -40 : 30, -12);
    const y0 = P.groundY(k[0], k[1]);
    P.add({ type: 'luffing', x: k[0], z: k[1], y0, ry, slew: kind === 'ferry' ? 0.5 : -0.4, paint: kind === 'ferry' ? 'grey' : 'blue' });
    P.claim(k[0], k[1], 12, 12, ry);
    for (const [a, b] of [[-5, -5], [5, -5], [-5, 5], [5, 5]]) {
      const p = frame2(k[0], k[1], ry)(a, b);
      P.collider({ kind: 'box', x: p[0], z: p[1], hx: 0.8, hz: 0.8, ry, y0: y0 - 1, y1: y0 + 10 });
    }
    P.far({ shape: 'box', x: k[0], z: k[1], y: y0, w: 5, d: 5, h: 30, ry, color: kind === 'ferry' ? '#9aa0a6' : '#2a5a9a' });
    P.lamp({ x: k[0], z: k[1], hx: k[0], hy: y0 + 36, hz: k[1], color: '#ff2a18', radius: 2, intensity: 0, halo: 3 });
  }
}

// ------------------------------------------------------------------ the halls

const shipyardRdZ = (x) => (x < -4200 ? 2080 + (x + 5300) * (40 / 1100) : 2120);
const dryDockRdZ = (x) => (x < -4200 ? 2470 + (x + 4950) * 0.04 : 2500 - (x + 4200) * 0.1412);

function planHalls(P, S) {
  const halls = [
    ['hallA', -4995, 58, 150, 28, '#c4ccd2'], ['hallB', -4840, 58, 150, 28, '#d2d0c8'], ['hallC', -4685, 58, 150, 30, '#b8c4be'],
    ['panel', -4440, 38, 200, 17, '#d8d8d2'], ['hallD', -3965, 66, 170, 32, '#c2cad4'], ['hallE', -3700, 84, 175, 40, '#e0ded6'],
  ];
  S.halls = [];
  for (const [sign, x, w, L0, h, tint] of halls) {
    const zN = shipyardRdZ(x) + 12.2 + 16;
    for (let L = L0; L >= 100; L -= 10) {
      const z = zN + L / 2;
      if (z + L / 2 > dryDockRdZ(x) - 12.2 - 30) continue;
      if (!P.isFree(x, z, w, L, 0, { roadPad: true, pad: 2 })) continue;
      const g = P.groundRange(x, z, w, L, 0);
      const it = P.add({ type: 'hall', x, z, w, L, d: L, ry: 0, h, sign, tint, y0: g.lo - 0.5, y1: g.hi, map: 'building' });
      P.claim(x, z, w + 4, L + 4, 0);
      P.collider({ kind: 'box', x, z, hx: w / 2, hz: L / 2, ry: 0, y0: g.lo - 1, y1: g.hi + h + 6 });
      P.far({ shape: 'box', x, z, y: g.lo - 1, w, d: L, h: h + 4, ry: 0, color: tint, lit: 0.15 });
      // floods over the doors at the south end
      for (const dx of [-w * 0.32, w * 0.32]) P.lamp({ x: x + dx, z: z + L / 2 + 1, hx: x + dx, hy: g.hi + 8, hz: z + L / 2 + 9, color: SODIUM, radius: 26, intensity: 0.6, halo: 2.2 });
      S.halls.push(it);
      break;
    }
  }
}

// ------------------------------------------------------------------ the block yard

function planBlocks(P, S) {
  const kinds = ['bottom', 'side', 'deck', 'bow', 'side', 'bottom'];
  // the block yard: the strip between the halls' doors and Dry Dock Road
  let south = 0;
  for (const h of S.halls || []) south = Math.max(south, h.z + h.L / 2);
  const hallEnd = () => south + 24;
  let n = 0;
  for (const [x, z] of P.points(40, { test: (x, z) => x > -5150 && x < -3460 && z > hallEnd(x) && z < dryDockRdZ(x) - 16 })) {
    const ry = (P.rng() - 0.5) * 0.3;
    const w = P.range(12, 18), d = P.range(10, 15);
    if (P.rng() < 0.5) continue;
    if (!P.isFree(x, z, w + 3, d + 3, ry, { roadPad: true, pad: 3 })) continue;
    const y0 = P.groundY(x, z);
    const h = P.range(5, 10);
    P.add({ type: 'hblock', x, z, ry, w, d, h, kind: kinds[n++ % kinds.length], y0, sparks: P.rng() < 0.45 });
    P.claim(x, z, w + 3, d + 3, ry);
    P.collider({ kind: 'box', x, z, hx: w / 2 + 0.3, hz: d / 2 + 0.3, ry, y0: y0 - 1, y1: y0 + h + 1.5 });
    P.far({ shape: 'box', x, z, y: y0, w, d, h: h + 1.2, ry, color: P.pick(['#8a3a2a', '#7a7d80', '#5a6a4a']) });
  }
}

// ------------------------------------------------------------------ north of Shipyard Road

function planNorth(P, S) {
  // the gatehouse and its rooftop sign at the east end, facing the road
  {
    const x = -3180, z = 2082, w = 46, d = 16, ry = 0;
    if (P.isFree(x, z, w, d, ry, { roadPad: true })) {
      const g = P.groundRange(x, z, w, d, ry);
      P.add({ type: 'gatehouse', x, z, w, d, ry, y0: g.lo - 0.5, y1: g.hi, map: 'building' });
      P.claim(x, z, w + 4, d + 4, ry);
      P.collider({ kind: 'box', x, z, hx: w / 2, hz: d / 2, ry, y0: g.lo - 1, y1: g.hi + 16 });
      P.far({ shape: 'box', x, z, y: g.lo - 1, w, d, h: 11, ry, color: '#7a3b2a', lit: 0.4 });
      P.lamp({ x, z: z + d / 2 + 1, hx: x, hy: g.hi + 13, hz: z + d / 2 + 2, color: '#ffe0b0', radius: 24, intensity: 0.9, halo: 0 });
    }
  }
  // the drawing office behind it
  {
    const x = -3330, z = 2040, w = 70, d = 18, ry = 0;
    if (P.isFree(x, z, w, d, ry, { roadPad: true })) {
      const g = P.groundRange(x, z, w, d, ry);
      P.add({ type: 'drawoffice', x, z, w, d, ry, y0: g.lo - 0.5, y1: g.hi, map: 'building' });
      P.claim(x, z, w + 4, d + 4, ry);
      P.collider({ kind: 'box', x, z, hx: w / 2, hz: d / 2, ry, y0: g.lo - 1, y1: g.hi + 14 });
      P.far({ shape: 'box', x, z, y: g.lo - 1, w, d, h: 13, ry, color: '#c8c6be', lit: 0.45 });
    }
  }
  // the gas store
  {
    const x = -3560, z = 2068;
    if (P.isFree(x, z, 26, 16, 0, { roadPad: true })) {
      const y0 = P.groundY(x, z);
      P.add({ type: 'gas', x, z, y0, w: 26, d: 16 });
      P.claim(x, z, 26, 16, 0);
      P.collider({ kind: 'box', x, z, hx: 13, hz: 8, ry: 0, y0: y0 - 1, y1: y0 + 15 });
      for (let k = 0; k < 4; k++) P.far({ shape: 'cyl', x: x - 9 + k * 6, z, y: y0, r: 1.9, h: 14, color: '#e8e8e4' });
      P.lamp({ x, z: z + 9, hx: x, hy: y0 + 6, hz: z + 9, color: '#ffe8c0', radius: 16, intensity: 0.8, halo: 1.4 });
    }
  }
  // the paint shop and its striped stack
  {
    const x = -3880, z = 1985, w = 48, d = 96, ry = 0;
    if (P.isFree(x, z, w, d, ry, { roadPad: true, pad: 2 })) {
      const g = P.groundRange(x, z, w, d, ry);
      P.add({ type: 'paintshop', x, z, w, d, ry, h: 22, y0: g.lo - 0.5, y1: g.hi, map: 'building' });
      P.claim(x, z, w + 4, d + 4, ry);
      P.collider({ kind: 'box', x, z, hx: w / 2, hz: d / 2, ry, y0: g.lo - 1, y1: g.hi + 26 });
      P.collider({ kind: 'circle', x: x + w / 2 + 6, z: z - d / 2 + 10, r: 2.6, y0: g.lo - 1, y1: g.hi + 64 });
      P.far({ shape: 'box', x, z, y: g.lo - 1, w, d, h: 24, ry, color: '#8a9a8a', lit: 0.1 });
      P.far({ shape: 'cyl', x: x + w / 2 + 6, z: z - d / 2 + 10, y: g.lo - 1, r: 2.6, r2: 1.8, h: 64, color: '#b8463a' });
      P.lamp({ x: x + w / 2 + 6, z: z - d / 2 + 10, hx: x + w / 2 + 6, hy: g.lo + 64, hz: z - d / 2 + 10, color: '#ff2a18', radius: 2, intensity: 0, halo: 3.5 });
    }
  }
  // the steel stockyard: plate stacks in rows under an overhead gantry
  {
    const x0 = -4880, x1 = -4330, zc = 1960;
    for (let x = x0; x < x1; x += 60) {
      for (const dz of [-34, -12, 12, 34]) {
        const px = x + P.range(-4, 4), pz = zc + dz;
        if (!P.isFree(px, pz, 16, 6, 0, { roadPad: true, pad: 1 })) continue;
        const y0 = P.groundY(px, pz);
        const n = 4 + Math.floor(P.rng() * 4);
        // (count, not n: the planner numbers every item with its own n)
        P.add({ type: 'plates', x: px, z: pz, y0, count: n, kind: P.rng() < 0.3 ? 'profiles' : 'plates' });
        P.claim(px, pz, 16, 6, 0);
        P.collider({ kind: 'box', x: px, z: pz, hx: 7, hz: 2.2, ry: 0, y0: y0 - 1, y1: y0 + n * 0.5 + 1 });
      }
    }
    for (const x of [-4720, -4480]) {
      if (!P.isFree(x, zc, 4, 92, 0, { roadPad: true })) continue;
      const y0 = P.groundY(x, zc);
      P.add({ type: 'portal', x, z: zc, y0, span: 88 });
      for (const dz of [-45, 45]) P.collider({ kind: 'box', x, z: zc + dz, hx: 3.5, hz: 0.8, ry: 0, y0: y0 - 1, y1: y0 + 16 });
      P.far({ shape: 'box', x, z: zc, y: y0 + 14, w: 3, d: 92, h: 2, ry: 0, color: '#c99a1c' });
    }
    for (let x = x0 + 30; x < x1; x += 140) {
      const y0 = P.groundY(x, zc);
      P.lamp({ x, z: zc, hx: x, hy: y0 + 18, hz: zc, color: SODIUM, radius: 44, intensity: 0.9, halo: 3 });
    }
  }
  // sheds along the road's north side (stores, the canteen, the pipe shop)
  const lots = P.lots({
    roads: (r) => r.spec.id === 'sy_road1' || r.spec.id === 'sy_road2',
    sides: [1], width: [30, 60], depth: [20, 34], gap: [16, 40], setback: [5, 12], pad: 3, ends: 20, chance: 0.75,
  });
  for (const L of lots) {
    const g = P.groundRange(L.x, L.z, L.w, L.d, L.ry);
    const h = Math.round(P.range(7, 12));
    const tint = P.pick(['#b8b0a0', '#9aa8a0', '#a8a8a8', '#b49a80', '#8e9aa8']);
    P.add({ type: 'store', x: L.x, z: L.z, w: L.w, d: L.d, ry: L.ry, h, tint, y0: g.lo - 0.5, y1: g.hi, map: 'building' });
    P.collider({ kind: 'box', x: L.x, z: L.z, hx: L.w / 2, hz: L.d / 2, ry: L.ry, y0: g.lo - 1, y1: g.hi + h + 3 });
    P.far({ shape: 'box', x: L.x, z: L.z, y: g.lo - 1, w: L.w, d: L.d, h: h + 2, ry: L.ry, color: tint, lit: 0.1 });
    const c = Math.cos(L.ry), s = Math.sin(L.ry);
    const lx = 0, lz = L.d / 2 + 1;
    P.lamp({ x: L.x + lx * c + lz * s, z: L.z - lx * s + lz * c, hx: L.x + lx * c + lz * s, hy: g.hi + 6, hz: L.z - lx * s + lz * c, color: SODIUM, radius: 18, intensity: 0.85, halo: 1.6 });
  }
}

// ------------------------------------------------------------------ the old west end (the Boneyard)

function planOldYard(P, S) {
  // two derelict slipways down to the water
  for (const x of [-5140, -5300]) {
    const { q, ry, F } = shoreFrame(x);
    const c = F(0, -30);
    if (!P.isFree(c[0], c[1], 22, 70, ry, { roadPad: true })) continue;
    P.add({ type: 'oldslip', x: c[0], z: c[1], ox: q.x, oz: q.z, ry, w: 18 });
    P.claim(c[0], c[1], 22, 70, ry);
  }
  // a derelict luffing crane with its jib down, rust on everything
  {
    const { ry, F } = shoreFrame(-5220);
    const k = F(0, -12);
    const y0 = P.groundY(k[0], k[1]);
    if (P.isFree(k[0], k[1], 12, 12, ry, {})) {
      P.add({ type: 'luffing', x: k[0], z: k[1], y0, ry, slew: 2.4, paint: 'rust', luff: 0.12 });
      P.claim(k[0], k[1], 12, 12, ry);
      P.collider({ kind: 'box', x: k[0], z: k[1], hx: 5.5, hz: 5.5, ry, y0: y0 - 1, y1: y0 + 10 });
      P.far({ shape: 'box', x: k[0], z: k[1], y: y0, w: 5, d: 5, h: 26, ry, color: '#7a4a30' });
    }
  }
  // scrap heaps and cut-up hull sections
  for (const [x, z] of P.points(42, { test: (x, z) => x < -4980 && z > 2470 && z < 2640 })) {
    if (P.rng() < 0.6) continue;
    if (!P.isFree(x, z, 14, 12, 0, { roadPad: true, pad: 2 })) continue;
    const y0 = P.groundY(x, z);
    P.add({ type: 'scrap', x, z, y0, r: P.range(4, 7) });
    P.claim(x, z, 14, 12, 0);
    P.collider({ kind: 'circle', x, z, r: 5, y0: y0 - 1, y1: y0 + 4 });
  }
  for (const [x, lz] of [[-5060, -36], [-5180, -40], [-5300, -30], [-5400, -50]]) {
    const lamp = shoreFrame(x).F(8, lz);
    if (!P.isFree(lamp[0], lamp[1], 1, 1, 0, { roadPad: true })) continue;
    P.lamp({ x: lamp[0], z: lamp[1], hx: lamp[0] + 1.2, hy: Y0 + 6, hz: lamp[1], color: '#ff9a40', radius: 26, intensity: 0.8, halo: 1.8 });
    P.add({ type: 'oldlamp', x: lamp[0], z: lamp[1] });
    P.collider({ kind: 'circle', x: lamp[0], z: lamp[1], r: 0.2, y0: Y0 - 1, y1: Y0 + 6 });
  }
}

// ------------------------------------------------------------------ the wreck

function planWreck(P, S) {
  const { q, ry, F } = shoreFrame(-5560);
  // alongside the derelict quay, listing away from it, settled on the bottom
  const c = F(0, 3 + 8 + 2);
  S.wreck = { x: c[0], z: c[1] };
  P.add({ type: 'hulk', x: c[0], z: c[1], ry: ry + Math.PI, L: 104, Bm: 16 });
  P.far({ shape: 'box', x: c[0], z: c[1], y: -1, w: 104, d: 14, h: 6, ry, color: '#5a3a28' });
  // a lone lamp on the old quay, flickering orange
  const l = F(14, -5);
  P.lamp({ x: l[0], z: l[1], hx: l[0], hy: Y0 + 6, hz: l[1], color: '#ff9a40', radius: 22, intensity: 0.8, halo: 1.8 });
  P.add({ type: 'oldlamp', x: l[0], z: l[1] });
  // the buoy marking her (its light seen from across the water)
  const bx = c[0] + Math.cos(ry + Math.PI) * (-104 / 2 - 14), bz = c[1] - Math.sin(ry + Math.PI) * (-104 / 2 - 14);
  P.lamp({ x: bx, z: bz, hx: bx, hy: 3.6, hz: bz, color: '#3aff6a', radius: 1, intensity: 0, halo: 2.6 });
}

// ------------------------------------------------------------------ masts

function planMasts(P, S) {
  const spots = [];
  for (let x = -5150; x < -3150; x += 180) {
    spots.push([x, shipyardRdZ(x) + 20], [x + 90, dryDockRdZ(x + 90) + 22]);
  }
  for (const [x, z] of spots) {
    if (!P.isFree(x, z, 2.5, 2.5, 0, { pad: 0.3, roadPad: true })) continue;
    const y0 = P.groundY(x, z);
    P.add({ type: 'mast', x, z, y0, h: 26, color: SODIUM, heads: 6 });
    P.lamp({ x, z, hx: x, hy: y0 + 25, hz: z, color: SODIUM, radius: 56, intensity: 1.0, halo: 9 });
    P.collider({ kind: 'circle', x, z, r: 0.9, y0: y0 - 1, y1: y0 + 26 });
    P.claim(x, z, 2.5, 2.5, 0);
  }
}

// ------------------------------------------------------------------ builders

const BUILD = {
  quay(B, M, it) { quayEdge(B, M, { pts: it.pts, sea: it.sea, wallC: '#868278' }); },
  mast(B, M, it) { mast(B, M, it); },
  dock: dryDock,
  goliath,
  yhull: yardHull,
  slipway,
  tower: towerCrane,
  luffing: luffingCrane,
  ferry,
  cutter,
  trawler,
  hall,
  hblock: hullBlock,
  boardsign(B, M, it, uv) {
    const st = B.acc(M.paint), sg = B.acc(M.sign);
    const y = B.groundY(it.x, it.z);
    const c = Math.cos(it.ry), s = Math.sin(it.ry);
    col(st, C('#3a3c40'));
    for (const d of [-it.w * 0.4, it.w * 0.4]) st.box(it.x + d * c, y, it.z - d * s, 0.2, 3.4 + it.h, 0.2);
    panel(sg, it.x, y + 3.2 + it.h / 2, it.z, it.w, it.h, it.ry, uv[it.sign], true);
  },
  gatehouse,
  drawoffice: drawOffice,
  gas: gasStore,
  paintshop: paintShop,
  plates,
  portal: portalCrane,
  store,
  oldslip: oldSlip,
  scrap,
  hulk,
  oldlamp(B, M, it) {
    const st = B.acc(M.paint), gl = B.acc(M.glow);
    const y = B.groundY(it.x, it.z);
    const H = it.tall ? 9 : 6;
    col(st, C(it.tall ? '#4a4c50' : '#3a2a20'));
    st.box(it.x, y, it.z, 0.22, H, 0.22);
    st.box(it.x + 0.6, y + H - 0.1, it.z, 1.4, 0.15, 0.15);
    col(gl, C('#ff9a40', 2.6));
    gl.box(it.x + 1.2, y + H - 0.4, it.z, 0.5, 0.3, 0.4);
  },
  cabins(B, M, it) {
    const hs = B.acc(M.house), st = B.acc(M.paint);
    const F = frame(it.x, it.y0, it.z, it.ry);
    const cols = ['#d8d4c8', '#7aa0c0', '#e8d8a0', '#a8c0a0'];
    for (let k = 0; k < 4; k++) {
      col(hs, C(cols[(k + it.n) % 4]));
      lbox(hs, F, it.ry, k % 2 ? 3.2 : -3.2, k < 2 ? 0 : 2.8, 0, 6.2, 2.7, 2.6, { u: 10, v: 10 });
    }
    col(st, C('#4a4c50'));
    const a = F(6.4, 0, 1.6), b = F(3, 2.8, 1.6);
    st.beam(a[0], a[1], a[2], b[0], b[1], b[2], 1.0, 0.12);
  },
};

// ------------------------------------------------------------------ docks

function dryDock(B, M, it, uv) {
  const F = frame(it.ox, 0, it.oz, it.ry);
  const cc = B.acc(M.conc), st = B.acc(M.paint), gl = B.acc(M.glow), dec = B.acc(M.decal);
  const { W, T, Ld, top } = it;
  const bed = -12;
  // the two walls, their slime line and their copings
  for (const sd of [-1, 1]) {
    col(cc, C('#9a978f'));
    lbox(cc, F, it.ry, sd * (W / 2 + T / 2), bed, Ld / 2, T, top - bed, Ld, { u: 4 });
    col(cc, C('#3c4a3a'));
    lbox(cc, F, it.ry, sd * (W / 2 + T / 2), -1.2, Ld / 2, T + 0.08, 2.1, Ld + 0.08, { u: 4, top: false });
    // an altar (step) along the inside face
    col(cc, C('#8a877f'));
    lbox(cc, F, it.ry, sd * (W / 2 - 0.7), it.flooded ? -3 : 0.4, Ld / 2, 1.4, it.flooded ? 4.4 : 1.6, Ld - 8, { u: 4 });
    // the crane rails on the copings
    col(dec, C('#2a2a2a'));
    for (const o of [-1.2, 1.2]) {
      const a = F(sd * (W / 2 + T / 2) + o, top + 0.03, 2), b = F(sd * (W / 2 + T / 2) + o, top + 0.03, Ld - 4);
      dec.quadP([a[0] - 0.15, a[1], a[2]], [a[0] + 0.15, a[1], a[2]], [b[0] + 0.15, b[1], b[2]], [b[0] - 0.15, b[1], b[2]]);
      dec.quadP([b[0] - 0.15, b[1], b[2]], [b[0] + 0.15, b[1], b[2]], [a[0] + 0.15, a[1], a[2]], [a[0] - 0.15, a[1], a[2]]);
    }
    // lamp posts and bollards along the wall
    for (let k = 0; k < Math.floor(Ld / 46); k++) {
      const p = F(sd * (W / 2 + 2), top, 20 + k * 46);
      col(st, C('#4a4c50'));
      st.box(p[0], p[1], p[2], 0.25, 7, 0.25);
      col(gl, C('#ffb060', 3));
      gl.box(p[0], p[1] + 6.8, p[2], 0.8, 0.35, 0.5);
      const b = F(sd * (W / 2 + T - 0.8), top, 32 + k * 46);
      col(st, C('#2c2d30'));
      cylinder(st, b[0], b[1], b[2], 0.3, 0.6, 8, { top: true });
    }
  }
  if (!it.flooded) {
    // the dry floor and the keel blocks
    col(cc, C('#77746c'));
    lbox(cc, F, it.ry, 0, bed, (Ld - 6) / 2, W, 0.4 - bed, Ld - 6, { u: 4 });
    col(st, C('#6a5a48'));
    for (let z = 14; z < Ld - 20; z += 3.2) {
      lbox(st, F, it.ry, 0, 0.4, z, 2.2, 1.4, 1.2, {});
      if (Math.round(z / 3.2) % 3 === 0) for (const sd of [-1, 1]) lbox(st, F, it.ry, sd * 9, 0.4, z, 1.6, 1.6, 1.2, {});
    }
    // ladders down the walls (lit)
    col(gl, C('#ffb060', 1.6));
    for (const sd of [-1, 1]) for (const z of [30, 120, 200]) { const p = F(sd * (W / 2 - 0.05), 2, z); gl.box(p[0], p[1], p[2], 0.08, 0.3, 0.3); }
  }
  // the caisson gate at the seaward end
  col(st, C('#5a3a2e'));
  lbox(st, F, it.ry, 0, bed, Ld - 3, W + T * 2, top - bed + 0.4, 5, {});
  col(st, C('#e2b021'));
  lbox(st, F, it.ry, 0, top + 0.4, Ld - 3, W + T * 2, 0.15, 5.2, {});
  col(st, C('#d8d8d2'));
  for (const sd of [-1, 1]) {
    const a = F(-(W / 2 + T), top + 1.4, Ld - 3 + sd * 2.4), b = F(W / 2 + T, top + 1.4, Ld - 3 + sd * 2.4);
    st.beam(a[0], a[1], a[2], b[0], b[1], b[2], 0.08, 0.08);
  }
  // a tug in the flooded dock
  if (it.flooded) {
    const t = F(-4, 0, 118);
    tugBoat(B, M, t[0], t[2], it.ry + Math.PI / 2, 0.0);
  }
}

// ------------------------------------------------------------------ the goliath

const YEL = C('#e3b322'), DK = C('#25262a');

function goliath(B, M, it, uv) {
  const F = frame(it.x, 0, it.z, it.ry);
  const st = B.acc(M.steel), gl = B.acc(M.glow), bl = B.acc(M.blink), sg = B.acc(M.sign);
  const S = it.span / 2, top = it.top, GY = top + 66, GH = 7;
  const ry = it.ry;
  for (const sd of [-1, 1]) {
    // the bogies on the rails and the sill beam
    col(st, DK);
    lbox(st, F, ry, sd * S, top, 0, 3.2, 2.4, 42, {});
    for (const dz of [-18, -10, 10, 18]) lbox(st, F, ry, sd * S, top, dz, 3.6, 3.0, 4, {});
    // the legs: an A down each side
    col(st, YEL);
    for (const dz of [-16, 16]) lbeam(st, F, [sd * S, top + 2.4, dz], [sd * S, GY, dz * 0.22], 2.8, 2.8);
    lbeam(st, F, [sd * S, top + 18, -12.4], [sd * S, top + 18, 12.4], 1.4, 1.4);
    lbeam(st, F, [sd * S, top + 42, -7.2], [sd * S, top + 42, 7.2], 1.2, 1.2);
    lbeam(st, F, [sd * S, top + 18, -12.4], [sd * S, top + 42, 7.2], 0.9, 0.9);
    // the stair tower up one leg (lit landings)
    if (sd > 0) {
      col(st, C('#9a9c9e'));
      lbox(st, F, ry, sd * (S + 2.6), top + 2.4, -6, 2.2, GY - top - 2.4, 2.2, {});
      col(gl, C('#ffd890', 2));
      for (let y = top + 10; y < GY; y += 12) { const p = F(sd * (S + 3.75), y, -6); gl.box(p[0], p[1], p[2], 0.1, 0.4, 0.4); }
    }
  }
  // the girder (overhanging the legs) with hazard stripes at its ends
  col(st, YEL);
  lbox(st, F, ry, 0, GY, 0, 2 * S + 16, GH, 6.4, {});
  for (const sd of [-1, 1]) {
    for (let k = 0; k < 6; k++) {
      col(st, k % 2 ? YEL : DK);
      lbox(st, F, ry, sd * (S + 8 - 0.65 - k * 1.3), GY - 0.03, 0, 1.3, GH + 0.06, 6.46, {});
    }
  }
  // its handrails, the two trolleys, the hooks on their ropes
  col(st, C('#d8d8d2'));
  for (const dz of [-3.1, 3.1]) {
    const a = F(-S - 7, GY + GH + 1.1, dz), b = F(S + 7, GY + GH + 1.1, dz);
    st.beam(a[0], a[1], a[2], b[0], b[1], b[2], 0.07, 0.07);
  }
  for (const [tx, hy] of [[-S * 0.45, top + 22], [S * 0.3, top + 34]]) {
    col(st, C('#3a5a8a'));
    lbox(st, F, ry, tx, GY + GH, 0, 9, 4, 7.4, {});
    col(st, C('#2a2a2a'));
    for (const dz of [-1.6, 1.6]) lbeam(st, F, [tx, GY, dz], [tx, hy + 2.4, dz * 0.6], 0.09, 0.09);
    col(st, YEL);
    lbox(st, F, ry, tx, hy, 0, 2.6, 2.4, 2.0, {});
    col(st, DK);
    lbox(st, F, ry, tx, hy - 1.4, 0, 0.6, 1.4, 0.6, {});
  }
  // the yard's name along both faces of the girder
  for (const sd of [-1, 1]) {
    const p = F(0, GY + GH / 2, sd * 3.24);
    panel(sg, p[0], p[1], p[2], 2 * S * 0.86, 2 * S * 0.86 * 110 / 1000, ry + (sd > 0 ? 0 : Math.PI), uv.hsb);
  }
  // floods under the girder, obstruction lights at its ends and top
  col(gl, C('#fff2d8', 2.2));
  for (let k = -3; k <= 3; k++) lbox(gl, F, ry, k * S / 3.5, GY - 0.3, 0, 1.2, 0.3, 1.0, { top: false, bottom: true });
  col(bl, C('#ff2a18', 5));
  for (const sd of [-1, 1]) { const p = F(sd * (S + 7), GY + GH + 0.8, 0); bl.box(p[0], p[1], p[2], 0.7, 0.7, 0.7); }
}

// ------------------------------------------------------------------ hulls under construction

function yardHull(B, M, it) {
  const rng = makeRng(seedOf(it));
  const F = frame3(it.x, it.y, it.z, it.ry, it.pitch || 0, 0);
  const pl = B.acc(M.plate);
  const L = it.L, Bm = it.Bm, D = it.D;
  const bands = [[D * 0.42, C('#8a3a2a')], [null, C('#878a8d')]];
  const h = hull(pl, F, L, Bm, 0, D, bands, { open: it.open, jitter: rng, bottom: true, deckCol: C('#5d6064'), sheer: 1.6 });
  // the bare frames of the unfinished part
  const st = B.acc(M.paint);
  col(st, C('#7a4632'));
  hullFrames(st, F, h, L, 0, it.open[0], it.open[1], 3.2, 0.42);
  // the inner bottom and a couple of bulkheads showing in the open part
  col(st, C('#8a8d90'));
  const xa = h.xOf(it.open[0]), xb = h.xOf(Math.min(1, it.open[0] + 0.2));
  fbox(st, F, (xa + xb) / 2, 1.2, 0, xb - xa, 0.3, Bm - 6, 2);
  fbox(st, F, xa + 0.2, 0, 0, 0.4, D, Bm - 0.4, 2, 'fbt');
  // scaffolding along both sides of the plated part
  if (it.scaff) {
    const sc = B.acc(M.scaff);
    col(sc, [1, 1, 1]);
    const x0 = h.xOf(0.05), x1 = h.xOf(it.open[0] + 0.08);
    for (const sd of [-1, 1]) {
      const z = sd * (Bm / 2 + 1.3);
      sc.quadP(F(x0, 0.3, z), F(x1, 0.3, z), F(x1, D + 1.6, z), F(x0, D + 1.6, z), [x0 / 4, 0, x1 / 4, (D + 1.3) / 4]);
    }
    // round the bow's ribs too
    const xb0 = h.xOf(it.open[0] + 0.02), xb1 = h.xOf(0.97);
    for (const sd of [-1, 1]) {
      const z0 = sd * (h.hb(it.open[0] + 0.02) + 1.3), z1 = sd * (h.hb(0.97) + 1.3);
      sc.quadP(F(xb0, 0.3, z0), F(xb1, 0.3, z1), F(xb1, D + 2, z1), F(xb0, D + 1.6, z0), [xb0 / 4, 0, xb1 / 4, (D + 1.5) / 4]);
    }
  }
  // welders at work along the seam and inside the ribs
  const fl = B.acc(M.flicker);
  for (let k = 0; k < 9; k++) {
    const t = it.open[0] - 0.02 + rng() * (it.open[1] - it.open[0]) * 0.8;
    const sd = rng() < 0.5 ? -1 : 1;
    const p = F(h.xOf(t), 1 + rng() * (D - 2), sd * (h.hb(t) - 0.4));
    spark(fl, p[0], p[1], p[2], 0.45, rng());
  }
  // work lights strung along the scaffold
  const gl = B.acc(M.glow);
  col(gl, C('#ffd890', 2.4));
  for (let x = h.xOf(0.08); x < h.xOf(it.open[0]); x += 12) for (const sd of [-1, 1]) { const p = F(x, D + 1.9, sd * (Bm / 2 + 1.3)); gl.box(p[0], p[1], p[2], 0.35, 0.25, 0.35); }
}

// ------------------------------------------------------------------ the slipway

function slipway(B, M, it, uv) {
  const F = frame(it.ox, 0, it.oz, it.ry);
  const cc = B.acc(M.conc), st = B.acc(M.paint), wd = B.acc(M.wood);
  const { z0, z1, yTop, yEdge, yEnd, w } = it;
  const yAt = (z) => (z <= 0 ? yTop + (z - z0) * (yEdge - yTop) / (0 - z0) : yEdge + z * (yEnd - yEdge) / z1);
  const n = 12;
  const zs = [];
  for (let k = 0; k <= n; k++) zs.push(z0 + (0 - z0) * k / n);
  for (let k = 1; k <= 3; k++) zs.push(z1 * k / 3);
  for (let k = 0; k < zs.length - 1; k++) {
    const za = zs[k], zb = zs[k + 1];
    const ya = yAt(za), yb = yAt(zb);
    const P = (x, y, z) => F(x, y, z);
    // the sloped top
    col(cc, C('#9a978f'));
    cc.quadP(P(w / 2, ya, za), P(-w / 2, ya, za), P(-w / 2, yb, zb), P(w / 2, yb, zb), [0, za / 4, w / 4, zb / 4]);
    // its sides down to the ground (or the sea bed)
    const ga = za < 0 ? Y0 - 1 : -10, gb = zb < 0 ? Y0 - 1 : -10;
    for (const sd of [-1, 1]) {
      const A = P(sd * w / 2, ga, za), Bq = P(sd * w / 2, gb, zb), Cq = P(sd * w / 2, yb, zb), D = P(sd * w / 2, ya, za);
      if (sd > 0) cc.quadP(Bq, A, D, Cq, [0, 0, 1, 1]); else cc.quadP(A, Bq, Cq, D, [0, 0, 1, 1]);
    }
    // the two launch ways (greased timber)
    col(wd, C('#6a5038'));
    for (const lx of [-6, 6]) {
      wd.quadP(P(lx + 1.2, ya + 0.35, za), P(lx - 1.2, ya + 0.35, za), P(lx - 1.2, yb + 0.35, zb), P(lx + 1.2, yb + 0.35, zb), [0, za / 4, 1, zb / 4]);
    }
  }
  // the head wall
  col(cc, C('#8e8b84'));
  lbox(cc, F, it.ry, 0, Y0 - 1, z0 - 0.5, w, yTop - Y0 + 1, 1, { u: 4 });
  // cradle stands under the hull
  col(st, C('#5a4a3a'));
  for (let z = z0 + 10; z < -6; z += 6) {
    const y = yAt(z);
    for (const lx of [-6, 6]) lbox(st, F, it.ry, lx, y + 0.35, z, 2.4, 1.6, 1.2, {});
  }
}

// ------------------------------------------------------------------ cranes

function towerCrane(B, M, it) {
  const st = B.acc(M.steel), cc = B.acc(M.conc), gl = B.acc(M.glow), bl = B.acc(M.blink);
  const y0 = it.y0, H = it.H, J = it.jib;
  const F = frame(it.x, y0, it.z, it.ry);
  col(cc, C('#8e8b84'));
  box(cc, it.x, y0 - 0.5, it.z, 6, 1.5, 6, it.ry, { u: 3 });
  col(st, YEL);
  lattice(st, [it.x, y0 + 1, it.z], [it.x, y0 + H, it.z], 2.2, { bar: 0.22, bay: 2.4 });
  // the slewing unit, the cab, the tower head
  col(st, DK);
  lbox(st, F, it.ry, 0, H, 0, 3.4, 2.2, 3.4, {});
  col(st, YEL);
  lbox(st, F, it.ry, 2.4, H - 1.2, 1.6, 2.2, 2.6, 2.4, {});
  col(gl, C('#ffe6b0', 1.4));
  lbox(gl, F, it.ry, 3.52, H - 0.6, 1.6, 0.04, 1.3, 2.0, {});
  col(st, YEL);
  lattice(st, F(0, H + 2.2, 0), F(0, H + 10, 0), 1.6, { bar: 0.16, bay: 2 });
  // the jib (out along local x) and the counter-jib with its weights
  lattice(st, F(1, H + 2.6, 0), F(J, H + 2.6, 0), 1.5, { bar: 0.16, bay: 2.6 });
  lattice(st, F(-1, H + 2.6, 0), F(-15, H + 2.6, 0), 1.6, { bar: 0.18, bay: 2.6 });
  col(cc, C('#9a978f'));
  lbox(cc, F, it.ry, -12.5, H + 0.4, 0, 4, 2.8, 2.6, {});
  // ties from the top
  col(st, C('#3a3a3a'));
  lbeam(st, F, [0, H + 10, 0], [J * 0.62, H + 3.4, 0], 0.08);
  lbeam(st, F, [0, H + 10, 0], [-14, H + 3.4, 0], 0.08);
  // the trolley and hook
  const tx = J * (0.45 + (it.n % 5) * 0.08);
  col(st, DK);
  lbox(st, F, it.ry, tx, H + 1.4, 0, 2, 0.8, 1.6, {});
  const hy = H * (0.35 + (it.n % 3) * 0.12);
  lbeam(st, F, [tx, H + 1.4, -0.3], [tx, hy + 1, -0.3], 0.05);
  lbeam(st, F, [tx, H + 1.4, 0.3], [tx, hy + 1, 0.3], 0.05);
  col(st, YEL);
  lbox(st, F, it.ry, tx, hy, 0, 1, 1, 1, {});
  col(bl, C('#ff2a18', 5));
  const tp = F(0, H + 10.4, 0); bl.box(tp[0], tp[1], tp[2], 0.5, 0.5, 0.5);
  const je = F(J, H + 3.4, 0); bl.box(je[0], je[1], je[2], 0.4, 0.4, 0.4);
  col(gl, C('#fff2d8', 3.5));
  for (const x of [8, 20, 32]) { const p = F(x, H + 1.7, 0); gl.box(p[0], p[1], p[2], 0.8, 0.25, 0.6); }
}

function luffingCrane(B, M, it) {
  const st = B.acc(M.steel), gl = B.acc(M.glow), bl = B.acc(M.blink);
  const F = frame(it.x, it.y0, it.z, it.ry);
  const paint = it.paint === 'blue' ? C('#2a5a9a') : it.paint === 'rust' ? C('#7a4a30') : C('#9aa0a6');
  const trim = it.paint === 'rust' ? C('#5a3a28') : C('#e2b021');
  // the portal on its rails: four legs, braced
  for (const [a, b] of [[-5, -5], [5, -5], [-5, 5], [5, 5]]) {
    col(st, DK);
    lbox(st, F, it.ry, a, 0, b, 2.6, 1.0, 1.4, {});
    col(st, paint);
    lbeam(st, F, [a, 1, b], [a * 0.45, 10, b * 0.45], 1.0, 1.0);
  }
  lbox(st, F, it.ry, 0, 9.4, 0, 6, 1.2, 6, {});
  // the pedestal and the slewing house, turned toward the work
  const s = it.slew;
  const G = frame(...F(0, 0, 0), it.ry + s);
  col(st, paint);
  lbox(st, G, it.ry + s, 0, 10.6, 0, 3.6, 13, 3.6, {});
  lbox(st, G, it.ry + s, -1, 23.6, 0, 9, 5.6, 6.2, {});
  col(st, trim);
  lbox(st, G, it.ry + s, -1, 29.2, 0, 9.2, 0.4, 6.4, {});
  col(gl, C('#ffe6b0', 1.5));
  lbox(gl, G, it.ry + s, 3.52, 25, 0, 0.04, 1.6, 4.6, {});
  // the jib: up at an angle out over the water (local +z after the slew), and its counterweight
  const luff = it.luff ?? 0.62;
  const jl = 40;
  const jx = 0, jy = 26, jz = 2.6;
  const tipY = jy + Math.sin(luff) * jl, tipZ = jz + Math.cos(luff) * jl;
  col(st, paint);
  lattice(st, G(jx, jy, jz), G(jx, tipY, tipZ), 1.6, { bar: 0.2, bay: 2.6 });
  col(st, trim);
  lbox(st, G, it.ry + s, 0, 24.5, -5.8, 4, 3.4, 3.4, {});
  // the A-frame and the luffing ropes
  col(st, paint);
  lbeam(st, G, [-1.6, 29.4, -1], [0, 36, 0], 0.5);
  lbeam(st, G, [1.6, 29.4, -1], [0, 36, 0], 0.5);
  col(st, C('#2a2a2a'));
  lbeam(st, G, [0, 36, 0], [0, tipY, tipZ], 0.08);
  // the hook hanging off the tip
  const hy = Math.max(4, tipY - 22);
  lbeam(st, G, [0, tipY, tipZ], [0, hy + 1, tipZ], 0.06);
  col(st, YEL);
  lbox(st, G, it.ry + s, 0, hy, tipZ, 1.2, 1.2, 1.2, {});
  if (it.paint !== 'rust') {
    col(bl, C('#ff2a18', 5));
    const t = G(0, tipY + 0.4, tipZ); bl.box(t[0], t[1], t[2], 0.45, 0.45, 0.45);
    col(gl, C('#fff2d8', 3.5));
    const fpt = G(0, tipY - 1, tipZ - 1); gl.box(fpt[0], fpt[1], fpt[2], 0.9, 0.3, 0.7);
  }
}

function portalCrane(B, M, it) {
  const st = B.acc(M.steel), gl = B.acc(M.glow);
  const F = frame(it.x, it.y0, it.z, 0);
  const S = it.span / 2, H = 14;
  for (const sd of [-1, 1]) {
    col(st, DK);
    lbox(st, F, 0, 0, 0, sd * S, 7, 1, 1.4, {});
    col(st, YEL);
    for (const dx of [-3, 3]) lbox(st, F, 0, dx, 1, sd * S, 0.9, H - 1, 0.9, {});
    lbox(st, F, 0, 0, H - 1, sd * S, 7, 1, 1, {});
  }
  col(st, YEL);
  for (const dx of [-1.6, 1.6]) lbox(st, F, 0, dx, H, 0, 1, 1.6, 2 * S + 1, {});
  col(st, C('#3a5a8a'));
  lbox(st, F, 0, 0, H + 1.6, (it.n % 7) * 6 - 18, 4.4, 1.6, 3.6, {});
  col(gl, C('#fff2d8', 3));
  for (const dz of [-S * 0.5, 0, S * 0.5]) lbox(gl, F, 0, 0, H - 0.2, dz, 1, 0.2, 0.7, { top: false, bottom: true });
}

// ------------------------------------------------------------------ ships fitting out

function ferry(B, M, it, uv) {
  const F = frame(it.x, 0, it.z, it.ry);
  const pl = B.acc(M.plate), hs = B.acc(M.house), st = B.acc(M.paint), gl = B.acc(M.glow), sg = B.acc(M.sign);
  const L = it.L, Bm = it.Bm;
  const h = hull(pl, F, L, Bm, -6, 8, [[-0.3, C('#8a2a22')], [1.6, C('#1d3f6e')], [2.4, C('#f0eee8')], [3.0, C('#2a7ab8')], [null, C('#f0eee8')]], { deckCol: C('#6a7a78'), sheer: 2.2 });
  void h;
  // three decks of cabins stepped back from the bow, the bridge on top
  col(hs, C('#f4f2ec'));
  lbox(hs, F, it.ry, -12, 8, 0, L * 0.62, 5, Bm - 1.2, { u: 10, v: 10 });
  lbox(hs, F, it.ry, -16, 13, 0, L * 0.5, 5, Bm - 3, { u: 10, v: 10 });
  lbox(hs, F, it.ry, -6, 18, 0, L * 0.24, 4, Bm - 5, { u: 10, v: 10 });
  col(gl, C('#bcd8f0', 0.8));
  lbox(gl, F, it.ry, -6 + L * 0.12 + 0.02, 18.8, 0, 0.04, 1.6, Bm - 6, {});
  // the funnel: blue with the yard's gold band
  col(st, C('#1d3f6e'));
  lbox(st, F, it.ry, -L * 0.3, 18, 0, 9, 9, 6, {});
  col(st, C('#e2b021'));
  lbox(st, F, it.ry, -L * 0.3, 23, 0, 9.1, 1.4, 6.1, {});
  // lifeboats along the upper deck, both sides
  col(st, C('#f07a1a'));
  for (let k = 0; k < 4; k++) for (const sd of [-1, 1]) lbox(st, F, it.ry, -40 + k * 14, 14.2, sd * (Bm / 2 - 1.2), 8, 2.2, 2.4, {});
  // the name on the bow, both sides; deck lights
  for (const sd of [1, -1]) {
    const p = F(L * 0.3, 4.6, sd * (Bm / 2 + 0.08));
    panel(sg, p[0], p[1], p[2], 18, 18 * 110 / 700, it.ry + (sd > 0 ? 0 : Math.PI), uv.ferry);
  }
  col(gl, C('#fff0c8', 2.4));
  for (let x = -L * 0.4; x < L * 0.35; x += 9) for (const sd of [-1, 1]) { const p = F(x, 12.6, sd * (Bm / 2 - 0.4)); gl.box(p[0], p[1], p[2], 0.3, 0.25, 0.3); }
  // a gangway to the quay
  col(st, C('#9aa0a6'));
  const a = F(-10, 9, Bm / 2), b = F(-16, Y0 + 0.4, Bm / 2 + 6);
  st.beam(a[0], a[1], a[2], b[0], b[1], b[2], 1.2, 0.25);
}

function cutter(B, M, it, uv) {
  const F = frame(it.x, 0, it.z, it.ry);
  const pl = B.acc(M.plate), hs = B.acc(M.house), st = B.acc(M.paint), gl = B.acc(M.glow), sg = B.acc(M.sign);
  const L = it.L, Bm = it.Bm;
  hull(pl, F, L, Bm, -4.6, 5, [[-0.3, C('#4a4a4c')], [null, C('#f0eee8')]], { deckCol: C('#7a7d80'), sheer: 2.4 });
  // the racing stripe on the bow (red and blue bars)
  for (const sd of [1, -1]) {
    for (const [o, c] of [[0, '#c8322a'], [2.6, '#1d3f6e']]) {
      const x0 = L * 0.04 + o, z = sd * (Bm / 2 + 0.05);
      col(st, C(c));
      const q = [F(x0, -0.2, z), F(x0 + 1.8, -0.2, z), F(x0 + 5.4, 4.8, z), F(x0 + 3.6, 4.8, z)];
      if (sd > 0) st.quadP(q[0], q[1], q[2], q[3]); else st.quadP(q[1], q[0], q[3], q[2]);
    }
    const p = F(-L * 0.14, 2.4, sd * (Bm / 2 + 0.08));
    panel(sg, p[0], p[1], p[2], 11, 11 * 120 / 640, it.ry + (sd > 0 ? 0 : Math.PI), uv.cutter);
  }
  // superstructure, bridge, mast with radar
  col(hs, C('#f2f0ea'));
  lbox(hs, F, it.ry, -4, 5, 0, 26, 4, Bm - 2, { u: 10, v: 10 });
  lbox(hs, F, it.ry, 1, 9, 0, 12, 3.4, Bm - 3, { u: 10, v: 10 });
  col(gl, C('#bcd8f0', 0.9));
  lbox(gl, F, it.ry, 7.02, 10.2, 0, 0.04, 1.4, Bm - 4, {});
  col(st, C('#e8e8e4'));
  const m = F(-2, 12.4, 0);
  st.beam(m[0], m[1], m[2], m[0], m[1] + 9, m[2], 0.5, 0.5);
  lbox(st, F, it.ry, -2, 18, 0, 0.8, 0.5, 5, {});
  col(gl, C('#ffffff', 3));
  gl.box(m[0], m[1] + 9.2, m[2], 0.4, 0.4, 0.4);
  col(gl, C('#3a7aff', 3));
  gl.box(m[0], m[1] + 8.4, m[2] + 0.4, 0.35, 0.35, 0.35);
}

function trawler(B, M, it) {
  const F = frame(it.x, 0, it.z, it.ry);
  const pl = B.acc(M.plate), hs = B.acc(M.house), st = B.acc(M.paint), gl = B.acc(M.glow);
  hull(pl, F, 34, 9, -3.6, 2.8, [[-0.2, C('#8a2a22')], [null, C('#2a6a5a')]], { deckCol: C('#7a6a5a'), sheer: 2.2 });
  col(hs, C('#e8e4d8'));
  lbox(hs, F, it.ry, 4, 2.8, 0, 8, 3.4, 6.4, { u: 10, v: 10 });
  col(gl, C('#ffe2b0', 1.3));
  lbox(gl, F, it.ry, 8.02, 4.2, 0, 0.04, 1.2, 5.6, {});
  // the gantry over the stern and the boom
  col(st, C('#c8a22a'));
  for (const sd of [-1, 1]) lbeam(st, F, [-13, 2.8, sd * 3.6], [-13, 9.5, sd * 3.6], 0.4);
  lbeam(st, F, [-13, 9.5, -3.6], [-13, 9.5, 3.6], 0.4);
  lbeam(st, F, [6, 3, 0], [-6, 12, 0], 0.3);
  col(gl, C('#ffffff', 3));
  const m = F(4, 9.6, 0); gl.box(m[0], m[1], m[2], 0.3, 0.3, 0.3);
}

// ------------------------------------------------------------------ halls

function hall(B, M, it, uv) {
  const rng = makeRng(seedOf(it));
  const { x, z, w, L, h, ry } = it;
  const F = frame(x, 0, z, ry);
  const cl = B.acc(M.hallclad), st = B.acc(M.paint), gl = B.acc(M.glow), sg = B.acc(M.sign), cc = B.acc(M.conc);
  const base = it.y1, tint = C(it.tint);
  col(cc, C('#8e8b84'));
  box(cc, x, it.y0, z, w, base - it.y0 + 0.3, L, ry, { u: 4 });
  // the long walls and the back
  col(cl, tint);
  box(cl, x, base + 0.3, z, w, h, L, ry, { u: 12, v: 12, top: false, faces: 'blr' });
  // the south end round its door
  const dw = w * 0.62, dh = h * 0.78, y = base + 0.3;
  const P = (lx, ly) => F(lx, y + ly, L / 2);
  const face = (x0, x1, y0, y1) => cl.quadP(P(x0, y0), P(x1, y0), P(x1, y1), P(x0, y1), [x0 / 12, y0 / 12, x1 / 12, y1 / 12]);
  face(-w / 2, -dw / 2, 0, h);
  face(dw / 2, w / 2, 0, h);
  face(-dw / 2, dw / 2, dh, h);
  // the door leaves slid aside (outside the wall, in front of it)
  col(st, C('#5a6066'));
  for (const sd of [-1, 1]) lbox(st, F, ry, sd * (dw / 2 + dw / 8 - 1), y, L / 2 + 0.6, dw / 4, dh, 0.4, {});
  col(st, C('#e2b021'));
  for (const sd of [-1, 1]) lbox(st, F, ry, sd * (dw / 2 + dw / 8 - 1), y + dh - 0.6, L / 2 + 0.85, dw / 4, 0.6, 0.06, {});
  // the inside: dark reveals back to a lit picture of the shop floor
  const din = 9;
  col(cc, C('#3a3834'));
  for (const sd of [-1, 1]) {
    const a = F(sd * dw / 2, y, L / 2), b = F(sd * dw / 2, y, L / 2 - din), c = F(sd * dw / 2, y + dh, L / 2 - din), d = F(sd * dw / 2, y + dh, L / 2);
    if (sd > 0) cc.quadP(b, a, d, c, [0, 0, 1, 1]); else cc.quadP(a, b, c, d, [0, 0, 1, 1]);
  }
  cc.quadP(F(dw / 2, y + dh, L / 2), F(-dw / 2, y + dh, L / 2), F(-dw / 2, y + dh, L / 2 - din), F(dw / 2, y + dh, L / 2 - din), [0, 0, 1, 1]);
  const ip = F(0, y + dh / 2, L / 2 - din);
  panel(sg, ip[0], ip[1], ip[2], dw, dh, ry, uv.interior);
  // the floor inside lit
  col(gl, C('#ffd8a0', 0.5));
  gl.quadP(F(-dw / 2, y + 0.05, L / 2), F(dw / 2, y + 0.05, L / 2), F(dw / 2, y + 0.05, L / 2 - din), F(-dw / 2, y + 0.05, L / 2 - din));
  // welding just inside the door
  const fl = B.acc(M.flicker);
  for (let k = 0; k < 4; k++) { const p = F((rng() - 0.5) * dw * 0.7, y + 1 + rng() * 4, L / 2 - din + 1 + rng() * 3); spark(fl, p[0], p[1], p[2], 0.5, rng()); }
  // the roof: a low gable with a glazed ridge
  col(st, C('#5c6064'));
  gable(st, x, y + h, z, w, L, Math.min(6, w * 0.12), ry, { over: 0.6, endAcc: cl, alongZ: true });
  col(gl, C('#ffe6b0', 0.8));
  const r0 = F(0, y + h + Math.min(6, w * 0.12) + 0.2, -L / 2 + 4), r1 = F(0, y + h + Math.min(6, w * 0.12) + 0.2, L / 2 - 4);
  gl.beam(r0[0], r0[1], r0[2], r1[0], r1[1], r1[2], 2.4, 0.3);
  // the hall's name over the door
  const sw = it.sign === 'hallE' ? 30 : it.sign === 'panel' ? 16 : 12;
  const s = F(0, y + dh + (h - dh) / 2, L / 2 + 0.08);
  panel(sg, s[0], s[1], s[2], sw, sw * 110 / (it.sign === 'hallE' ? 560 : it.sign === 'panel' ? 420 : 300), ry, uv[it.sign]);
  // floodlights over the door
  col(gl, C('#ffb060', 3));
  for (const sd of [-1, 1]) {
    const p = F(sd * w * 0.32, y + 7.6, L / 2 + 0.6);
    gl.box(p[0], p[1], p[2], 1.2, 0.5, 0.6);
    col(st, C('#3a3c40'));
    const a = F(sd * w * 0.32, y + 8.1, L / 2 + 0.1), b = F(sd * w * 0.32, y + 8.1, L / 2 + 1.2);
    st.beam(a[0], a[1], a[2], b[0], b[1], b[2], 0.15, 0.15);
    col(gl, C('#ffb060', 3));
  }
  // a hot-work warning by the door
  const hw = F(dw / 2 + 4, y + 2.5, L / 2 + 0.08);
  panel(sg, hw[0], hw[1], hw[2], 3.4, 0.8, ry, uv.hot);
}

function hullBlock(B, M, it) {
  const rng = makeRng(seedOf(it));
  const { w, d, h, ry } = it;
  const y0 = it.y0;
  const F = frame(it.x, y0, it.z, ry);
  const st = B.acc(M.paint), pl = B.acc(M.plate);
  const prim = rng() < 0.5 ? C('#8a3a2a') : rng() < 0.5 ? C('#7a7d80') : C('#5d6e4e');
  // stands
  col(st, C('#3a3a3c'));
  for (const [a, b] of [[-w / 3, -d / 3], [w / 3, -d / 3], [-w / 3, d / 3], [w / 3, d / 3]]) lbox(st, F, ry, a, 0, b, 1.2, 1.2, 1.2, {});
  const yb = 1.2;
  col(pl, prim);
  if (it.kind === 'bottom') {
    // a double-bottom unit: a flat plated box, its side open on the floors
    fbox(pl, F, 0, yb, 0, w, 0.3, d, 4, 'fblrtu');
    fbox(pl, F, 0, yb + h * 0.4, 0, w, 0.3, d, 4, 'fblrtu');
    col(st, prim);
    for (let k = 0; k <= 6; k++) lbox(st, F, ry, -w / 2 + k * w / 6, yb + 0.3, 0, 0.2, h * 0.4 - 0.3, d, {});
  } else if (it.kind === 'side') {
    // a side-shell unit: the curved shell and its frames
    const n = 6;
    for (let k = 0; k < n; k++) {
      const a0 = (k / n) * Math.PI / 2, a1 = ((k + 1) / n) * Math.PI / 2;
      const P = (lx, a) => F(lx, yb + Math.sin(a) * h, -d / 2 + (1 - Math.cos(a)) * d * 0.7);
      pl.quadP(P(w / 2, a0), P(-w / 2, a0), P(-w / 2, a1), P(w / 2, a1), [0, a0, w / 4, a1]);
      pl.quadP(P(-w / 2, a0), P(w / 2, a0), P(w / 2, a1), P(-w / 2, a1), [0, a0, w / 4, a1]);
    }
    col(st, prim);
    for (let k = 0; k <= 5; k++) {
      const lx = -w / 2 + k * w / 5;
      for (let j = 0; j < 4; j++) {
        const a0 = j / 4 * Math.PI / 2, a1 = (j + 1) / 4 * Math.PI / 2;
        lbeam(st, F, [lx, yb + Math.sin(a0) * h, -d / 2 + (1 - Math.cos(a0)) * d * 0.7 + 0.8], [lx, yb + Math.sin(a1) * h, -d / 2 + (1 - Math.cos(a1)) * d * 0.7 + 0.8], 0.25, 0.25);
      }
    }
  } else if (it.kind === 'deck') {
    // a deck unit: a plate on deep beams, a hatch coaming
    fbox(pl, F, 0, yb + h * 0.55, 0, w, 0.35, d, 4, 'fblrtu');
    col(st, prim);
    for (let k = 0; k <= 4; k++) lbox(st, F, ry, 0, yb, -d / 2 + k * d / 4, w, h * 0.55, 0.3, {});
    lbox(st, F, ry, 0, yb + h * 0.55 + 0.35, 0, w * 0.6, 1.4, d * 0.5, {});
  } else {
    // a bow section: a wedge with a bulb
    const P = (lx, ly, lz) => F(lx, yb + ly, lz);
    const q2 = (a, b, c, e) => { pl.quadP(a, b, c, e); pl.quadP(b, a, e, c); };
    q2(P(-w / 2, 0, -d / 2), P(w / 2, 0, 0), P(w / 2, h, 0), P(-w / 2, h, -d / 2));
    q2(P(w / 2, 0, 0), P(-w / 2, 0, d / 2), P(-w / 2, h, d / 2), P(w / 2, h, 0));
    q2(P(-w / 2, 0, d / 2), P(-w / 2, 0, -d / 2), P(-w / 2, h, -d / 2), P(-w / 2, h, d / 2));
    const t0 = pl.v(...P(-w / 2, h, d / 2)), t1 = pl.v(...P(-w / 2, h, -d / 2)), t2 = pl.v(...P(w / 2, h, 0));
    pl.tri(t0, t2, t1); pl.tri(t0, t1, t2);
  }
  if (it.sparks) {
    const fl = B.acc(M.flicker);
    for (let k = 0; k < 2; k++) { const p = F((rng() - 0.5) * w, yb + rng() * h, (rng() < 0.5 ? -1 : 1) * (d / 2 + 0.3)); spark(fl, p[0], p[1], p[2], 0.42, rng()); }
  }
}

// ------------------------------------------------------------------ buildings

function gatehouse(B, M, it, uv) {
  const { x, z, w, d, ry } = it;
  const F = frame(x, 0, z, ry);
  const br = B.acc(M.brick), st = B.acc(M.paint), cc = B.acc(M.conc), gl = B.acc(M.glow), sg = B.acc(M.sign);
  const base = it.y1, H = 9;
  col(br, [0.95, 0.9, 0.86]);
  box(br, x, it.y0, z, w, base - it.y0 + H, d, ry, { u: 12, v: 9, top: false, v0: -(base - it.y0) / 9 });
  col(cc, C('#c8bca8'));
  box(cc, x, base + H, z, w + 0.6, 0.6, d + 0.6, ry, { u: 4 });
  // a clock tower over the arch
  col(br, [0.9, 0.85, 0.8]);
  lbox(br, F, ry, 0, base + H, 0, 7, 7, 7, { u: 12, v: 9 });
  col(st, C('#2a4a3e'));
  coneC(st, ...F(0, base + H + 7, 0), 5.2, 4, 4);
  col(gl, C('#fff0c8', 1.4));
  for (const sd of [-1, 1]) { const p = F(0, base + H + 4.4, sd * 3.52); gl.box(p[0], p[1], p[2], 2.6, 2.6, 0.04, ry); }
  // the lit rooftop sign along the front (local +z faces the road)
  const s = F(0, base + H + 2.6, d / 2 - 1);
  col(st, C('#2a2c30'));
  for (const dx of [-14, 0, 14]) lbox(st, F, ry, dx, base + H + 0.6, d / 2 - 1.2, 0.3, 1.2, 0.3, {});
  panel(sg, s[0], s[1], s[2], 30, 30 * 150 / 760, ry, uv.gatesign);
  col(gl, C('#ffd9a0', 2.2));
  for (const dx of [-12, 12]) { const p = F(dx, base + 3.4, d / 2 + 0.4); gl.box(p[0], p[1], p[2], 0.45, 0.45, 0.45); }
}

function drawOffice(B, M, it) {
  const { x, z, w, d, ry } = it;
  const of = B.acc(M.office), cc = B.acc(M.conc), st = B.acc(M.paint);
  const base = it.y1, H = 12;
  col(cc, C('#a8a49a'));
  box(cc, x, it.y0, z, w, base - it.y0 + 0.4, d, ry, { u: 4 });
  col(of, C('#e8dcc4'));
  box(of, x, base + 0.4, z, w, H, d, ry, { u: 16, v: 16, top: false });
  col(cc, C('#b8b2a4'));
  box(cc, x, base + 0.4 + H, z, w + 0.5, 0.8, d + 0.5, ry, { u: 4 });
  col(st, C('#7a7d80'));
  lbox(st, frame(x, 0, z, ry), ry, w * 0.3, base + H + 1.2, 0, 6, 2, 5, {});
}

function gasStore(B, M, it, uv) {
  const st = B.acc(M.paint), sg = B.acc(M.sign), cc = B.acc(M.conc);
  const { x, z, y0 } = it;
  col(cc, C('#9a978f'));
  box(cc, x, y0 - 0.4, z, it.w, 0.6, it.d, 0, { u: 4 });
  for (let k = 0; k < 4; k++) {
    const cx = x - 9 + k * 6;
    col(st, C('#ecece8'));
    cylinder(st, cx, y0 + 0.2, z, 1.9, 12.4, 12);
    col(st, k % 2 ? C('#2f6a3a') : C('#1d4f8f'));
    cylinder(st, cx, y0 + 7, z, 1.92, 1.2, 12);
    col(st, C('#d8d8d4'));
    coneC(st, cx, y0 + 12.6, z, 1.9, 1.2, 12);
    arcPanel(sg, cx, y0 + 4.5, z, 1.95, Math.PI / 2, 3.2, 0.85, k % 2 ? uv.argon : uv.oxygen, 6);
  }
  // pipework along them
  col(st, C('#8a8d90'));
  st.beam(x - 11, y0 + 2, z - 2.4, x + 11, y0 + 2, z - 2.4, 0.25, 0.25);
}

function paintShop(B, M, it, uv) {
  const { x, z, w, d, ry, h } = it;
  const F = frame(x, 0, z, ry);
  const cl = B.acc(M.clad), st = B.acc(M.steel), sg = B.acc(M.sign), cc = B.acc(M.conc), bl = B.acc(M.blink), gl = B.acc(M.glow);
  const base = it.y1;
  col(cc, C('#8e8b84'));
  box(cc, x, it.y0, z, w, base - it.y0 + 0.3, d, ry, { u: 4 });
  col(cl, C('#a8b8a4'));
  box(cl, x, base + 0.3, z, w, h, d, ry, { u: 12, v: 12, top: false });
  col(B.acc(M.paint), C('#5c6064'));
  gable(B.acc(M.paint), x, base + 0.3 + h, z, w, d, 3, ry, { over: 0.5, endAcc: cl, alongZ: true });
  // extract fans on the roof
  col(B.acc(M.paint), C('#8a8d90'));
  for (let k = -2; k <= 2; k++) cylinder(B.acc(M.paint), ...F(w * 0.2, base + h + 1.5, k * d / 6), 1.2, 2.4, 8, { top: true });
  // the striped stack
  const sx = w / 2 + 6, sz = -d / 2 + 10;
  const p = F(sx, it.y0, sz);
  for (let k = 0; k < 8; k++) {
    col(st, k % 2 ? C('#e8e6de') : C('#b8463a'));
    cylinder(st, p[0], p[1] + k * 8, p[2], 2.6 - k * 0.1, 8, 12, { r2: 2.5 - k * 0.1 });
  }
  col(st, C('#222'));
  cylinder(st, p[0], p[1] + 64, p[2], 1.8, 0.6, 12, { top: true });
  col(bl, C('#ff2a18', 5));
  bl.box(p[0], p[1] + 65, p[2], 0.6, 0.6, 0.6);
  const s = F(0, base + h - 2.6, d / 2 + 0.08);
  panel(sg, s[0], s[1], s[2], 14, 14 * 110 / 460, ry, uv.paintshop);
  col(gl, C('#ffb060', 3));
  for (const dx of [-w * 0.3, w * 0.3]) { const q = F(dx, base + 6, d / 2 + 0.5); gl.box(q[0], q[1], q[2], 0.8, 0.4, 0.5); }
}

function store(B, M, it) {
  const { x, z, w, d, ry, h } = it;
  const F = frame(x, 0, z, ry);
  const cl = B.acc(M.clad), st = B.acc(M.paint), cc = B.acc(M.conc), gl = B.acc(M.glow);
  const base = it.y1;
  col(cc, C('#8e8b84'));
  box(cc, x, it.y0, z, w, base - it.y0 + 0.3, d, ry, { u: 4 });
  col(cl, C(it.tint));
  box(cl, x, base + 0.3, z, w, h, d, ry, { u: 12, v: 12, top: false });
  col(st, C('#6a6e72'));
  gable(st, x, base + 0.3 + h, z, w, d, Math.min(3.5, d * 0.14), ry, { over: 0.5, endAcc: cl });
  col(st, C('#4a4e52'));
  const n = Math.max(1, Math.floor(w / 14));
  for (let k = 0; k < n; k++) lbox(st, F, ry, -w / 2 + (k + 0.5) * w / n, base + 0.3, d / 2 + 0.05, 4.2, 4.4, 0.1, {});
  col(gl, C('#ffb060', 2.6));
  const p = F(0, base + 5.6, d / 2 + 0.3); gl.box(p[0], p[1], p[2], 0.6, 0.25, 0.5);
}

function plates(B, M, it) {
  const rng = makeRng(seedOf(it));
  const st = B.acc(M.paint);
  const { x, z, y0 } = it;
  if (it.kind === 'profiles') {
    // bundles of angle bars on A-frame racks
    col(st, C('#4a4c50'));
    for (const dx of [-5, 0, 5]) { lbeam(st, frame(x, y0, z, 0), [dx, 0, -2], [dx, 2.6, 0], 0.2); lbeam(st, frame(x, y0, z, 0), [dx, 0, 2], [dx, 2.6, 0], 0.2); }
    for (let k = 0; k < it.count; k++) {
      col(st, [0.45 + rng() * 0.15, 0.25 + rng() * 0.08, 0.15]);
      st.box(x, y0 + 1 + k * 0.32, z - 1.6 + (k % 3) * 1.1, 13, 0.3, 0.8);
    }
    return;
  }
  for (let s = 0; s < 2; s++) {
    const cx = x + (s ? 3.6 : -3.6);
    for (let k = 0; k < it.count; k++) {
      const r = 0.42 + rng() * 0.18;
      col(st, [r, r * 0.55, r * 0.35]);
      st.box(cx + (rng() - 0.5) * 0.4, y0 + 0.2 + k * 0.42, z + (rng() - 0.5) * 0.3, 6.2, 0.38, 3.8, (rng() - 0.5) * 0.06);
    }
    col(st, C('#3a3a3a'));
    for (const dx of [-2.4, 2.4]) st.box(cx + dx, y0, z, 0.4, 0.2, 4.2);
  }
}

// ------------------------------------------------------------------ the boneyard

function oldSlip(B, M, it) {
  const F = frame(it.ox, 0, it.oz, it.ry);
  const cc = B.acc(M.conc), st = B.acc(M.paint), lf = B.acc(M.leaf);
  const rng = makeRng(seedOf(it));
  const w = it.w;
  // a ramp from the yard down into the water, cracked and stained
  const z0 = -70, z1 = 30, yTop = Y0 + 0.4, yEnd = -4;
  const yAt = (z) => yTop + (z - z0) * (yEnd - yTop) / (z1 - z0);
  for (let k = 0; k < 8; k++) {
    const za = z0 + (z1 - z0) * k / 8, zb = z0 + (z1 - z0) * (k + 1) / 8;
    col(cc, C(k % 2 ? '#6e6a62' : '#76726a'));
    cc.quadP(F(w / 2, yAt(za), za), F(-w / 2, yAt(za), za), F(-w / 2, yAt(zb), zb), F(w / 2, yAt(zb), zb), [0, za / 4, w / 4, zb / 4]);
    for (const sd of [-1, 1]) {
      const A = F(sd * w / 2, za < 0 ? Y0 - 1 : -9, za), Bq = F(sd * w / 2, zb < 0 ? Y0 - 1 : -9, zb), Cq = F(sd * w / 2, yAt(zb), zb), D = F(sd * w / 2, yAt(za), za);
      if (sd > 0) cc.quadP(Bq, A, D, Cq); else cc.quadP(A, Bq, Cq, D);
    }
  }
  // rusted rails and a cradle frame left standing
  col(st, C('#6a3a22'));
  for (const lx of [-4, 4]) { const a = F(lx, yAt(z0) + 0.15, z0), b = F(lx, yAt(z1 - 4) + 0.15, z1 - 4); st.beam(a[0], a[1], a[2], b[0], b[1], b[2], 0.3, 0.3); }
  for (let k = 0; k < 4; k++) {
    const zz = z0 + 12 + k * 7, y = yAt(zz);
    lbeam(st, F, [-6, y, zz], [-3, y + 3.5, zz], 0.35);
    lbeam(st, F, [6, y, zz], [3, y + 3.5, zz], 0.35);
  }
  // weeds through the cracks
  for (let k = 0; k < 14; k++) {
    const lx = (rng() - 0.5) * w, lz = z0 + rng() * 60;
    const p = F(lx, yAt(lz), lz);
    col(lf, [0.25 + rng() * 0.1, 0.36 + rng() * 0.1, 0.16]);
    coneC(lf, p[0], p[1], p[2], 0.5 + rng() * 0.5, 0.6 + rng() * 0.8, 5);
  }
}

function scrap(B, M, it) {
  const rng = makeRng(seedOf(it));
  const st = B.acc(M.paint);
  const { x, z, y0, r } = it;
  for (let k = 0; k < 16; k++) {
    const a = rng() * Math.PI * 2, d = rng() * r * 0.8;
    const rr = 0.35 + rng() * 0.2;
    col(st, [rr, rr * 0.55, rr * 0.35]);
    const h = 0.6 + rng() * 2.4 * (1 - d / r);
    st.box(x + Math.cos(a) * d, y0 - 0.3 + rng() * h * 0.5, z + Math.sin(a) * d, 1 + rng() * 4, 0.3 + rng() * 1.6, 0.6 + rng() * 3, rng() * Math.PI);
  }
}

function hulk(B, M, it, uv) {
  const rng = makeRng(seedOf(it));
  // settled on the bottom by the stern, listing 14° away from the quay
  const F = frame3(it.x, -5.4, it.z, it.ry, 0.045, -0.24);
  const pl = B.acc(M.plate), st = B.acc(M.paint), sg = B.acc(M.sign);
  const L = it.L, Bm = it.Bm;
  const rust = C('#8a4e30');
  const h = hull(pl, F, L, Bm, -5, 7, [[1.2, C('#5a3020')], [5.6, rust], [null, C('#9a6040')]], { open: [0.42, 0.56], jitter: rng, deckCol: C('#5a4030'), sheer: 2 });
  // the hole: bare ribs where the plating fell away
  col(st, C('#5a3020'));
  hullFrames(st, F, h, L, -5, 0.42, 0.56, 2.6, 0.32);
  // what's left of the house aft, the funnel down on its side, a mast leaning
  col(st, C('#8a6a50'));
  fbox(st, F, -L * 0.32, 7, 0, 12, 7, Bm - 3, 2);
  col(st, C('#3a2a22'));
  fbox(st, F, -L * 0.32 + 6.02, 10.5, 0, 0.1, 1.4, Bm - 5, 2, 'r');
  col(st, C('#5a2a1c'));
  const f0 = F(-L * 0.42, 9, 2), f1 = F(-L * 0.47, 8.4, 6.5);
  tube(st, f0[0], f0[1], f0[2], f1[0], f1[1], f1[2], 1.6, 8);
  col(st, C('#6a5a4a'));
  const m0 = F(L * 0.25, 7, 0), m1 = F(L * 0.25 + 3, 18, -3);
  st.beam(m0[0], m0[1], m0[2], m1[0], m1[1], m1[2], 0.45, 0.45);
  // a forward mast with its derrick, still standing
  col(st, C('#7a6a5a'));
  const fm0 = F(L * 0.36, 7, 0), fm1 = F(L * 0.36, 19, 0.6);
  st.beam(fm0[0], fm0[1], fm0[2], fm1[0], fm1[1], fm1[2], 0.5, 0.5);
  const db = F(L * 0.3, 9, -1), dt = F(L * 0.36, 17, 0.4);
  st.beam(db[0], db[1], db[2], dt[0], dt[1], dt[2], 0.3, 0.3);
  // the wreck buoy off her stern: green, its light blinking
  const bx = it.x + Math.cos(it.ry) * (-L / 2 - 14), bz = it.z - Math.sin(it.ry) * (-L / 2 - 14);
  col(st, C('#2a8a4a'));
  cylinder(st, bx, -0.6, bz, 1.0, 1.6, 8, { top: true });
  coneC(st, bx, 1.0, bz, 0.7, 2.2, 6);
  col(B.acc(M.glow), C('#3aff6a', 3.5));
  B.acc(M.glow).box(bx, 3.4, bz, 0.4, 0.4, 0.4);
  // her name, faded, on the bow
  for (const sd of [1]) {
    const p = F(L * 0.33, 4.6, sd * (h.hb(0.83) + 0.1));
    panel(sg, p[0], p[1], p[2], 11, 11 * 90 / 560, it.ry + (sd > 0 ? 0 : Math.PI), uv.hulk);
  }
}

export { shoreFrame };
