// PORT HALCYON — WEST FARMS: the flat country between the ironworks and the
// sea. A patchwork of fields (wheat, corn, beans, alfalfa, plough, stubble
// with its bales), windbreaks of poplar along some of their edges,
// farmsteads down the gravel lanes (a white farmhouse with its porch light,
// a red gambrel barn, silos and grain bins, a machine shed, a water-pump
// windmill turning over its stock tank, the yard light on its pole). The
// railway runs along the north of Mill Rd to the Halcyon Grain Co. elevator
// (level crossings with lights that flash); the old airfield off the end of
// Mill Rd has its hangars, control tower and the wreck in the grass; the
// Starlite Drive-In's screen still glows down Drive-In Rd; and at the end of
// Holloway Track something has been drawn in the far wheat field.
import * as THREE from 'three';
import { litMat, glowColorMat, box, cylinder, cone, gable } from './builder.js';
import { concreteTexture, toTex } from '../../track/textures.js';
import { makeRng } from '../../core/util.js';
import { Acc } from '../build/geo.js';
import { ROAD } from './occ.js';
import { owns, toWorld, lin, mixc, hash2, rectPoly } from './westkit/util.js';
import { Fr, tube, lathe, beam, lattice2, gambrel, quonset, drapeUV, col, fence, wallAlong } from './westkit/geo.js';
import { bandAtlas, windowPane, corrugatedTex, roofTex, signAtlas, text, speckle, streaks, cvs, once } from './westkit/tex.js';
import { oak, poplar, bush, rock } from './westkit/veg.js';
import { pickup, sedan, tractor, hayRound, hayBlock, drum } from './westkit/props.js';
import { placeFoot, poleLamp, buildPole } from './westkit/race.js';

const ID = 'farmland';
const mine = (x, z) => owns(ID, x, z);
const WHITE = [1, 1, 1];
const STOREY = 3.2, BANDS = 6;   // atlas: 0 red boards + loft door, 1 red boards, 2 clapboard + windows, 3 clapboard, 4 hangar tin + clerestory, 5 snack bar
const RAIL_Z = 380, RAIL_X0 = -6200, RAIL_X1 = -4150;

// crops: [name, colour, texture ('rows' | 'meadow'), row metres, weight]
const CROPS = [
  ['wheat', '#c8a85a', 'rows', 1.2, 4], ['corn', '#5a7a2a', 'rows', 2.4, 3], ['beans', '#4a6a2c', 'rows', 2.0, 2],
  ['alfalfa', '#6a8a3a', 'meadow', 0, 2], ['plough', '#6a5240', 'rows', 1.6, 2], ['stubble', '#b09a5e', 'rows', 1.0, 3],
  ['sunflower', '#c8a82a', 'rows', 2.2, 1], ['pasture', '#5e7a34', 'meadow', 0, 2],
];

// ------------------------------------------------------------------ textures

function walls() {
  return bandAtlas('fm-walls', 512, 164, [
    // 0: red barn boards with the loft door and its white X
    (x, e, W, H, rng) => {
      barnBoards(x, W, H, rng);
      x.fillStyle = '#efe8dc'; x.fillRect(196, 20, 120, H - 20);
      x.fillStyle = '#8a2a1e'; x.fillRect(204, 28, 104, H - 28);
      x.strokeStyle = '#efe8dc'; x.lineWidth = 7;
      x.beginPath(); x.moveTo(204, 28); x.lineTo(308, H); x.moveTo(308, 28); x.lineTo(204, H); x.stroke();
    },
    // 1: red barn boards
    (x, e, W, H, rng) => barnBoards(x, W, H, rng),
    // 2: white clapboard with two windows (some lit)
    (x, e, W, H, rng) => { clapboard(x, W, H, rng); for (const wx of [86, 342]) windowPane(x, e, wx, 46, 84, 82, rng() < 0.55, rng, { frame: '#f6f2ea', panes: 4 }); },
    // 3: clapboard, a door
    (x, e, W, H, rng) => {
      clapboard(x, W, H, rng);
      x.fillStyle = '#f6f2ea'; x.fillRect(214, 26, 84, H - 26);
      x.fillStyle = '#3a4a5a'; x.fillRect(222, 34, 68, H - 34);
      windowPane(x, e, 230, 44, 52, 40, rng() < 0.6, rng, { frame: '#3a4a5a' });
    },
    // 4: hangar tin with a clerestory
    (x, e, W, H, rng) => {
      x.fillStyle = '#a8aca8'; x.fillRect(0, 0, W, H);
      for (let px = 0; px < W; px += 16) { const g = x.createLinearGradient(px, 0, px + 16, 0); g.addColorStop(0, 'rgba(0,0,0,0.25)'); g.addColorStop(0.4, 'rgba(255,255,255,0.2)'); g.addColorStop(1, 'rgba(0,0,0,0.25)'); x.fillStyle = g; x.fillRect(px, 0, 16, H); }
      streaks(x, W, H, rng, 26, '110,60,30', 0.4);
      for (let k = 0; k < 8; k++) { x.fillStyle = '#2a3036'; x.fillRect(8 + k * 64, 16, 52, 30); x.fillStyle = rng() < 0.3 ? '#0a0a0a' : '#5a6a70'; x.fillRect(12 + k * 64, 20, 44, 22); }
    },
    // 5: the drive-in's snack bar: a lit counter window, a menu board
    (x, e, W, H, rng) => {
      x.fillStyle = '#e8e0d0'; x.fillRect(0, 0, W, H);
      x.fillStyle = '#c8322a'; x.fillRect(0, 0, W, 22); x.fillRect(0, H - 10, W, 10);
      x.fillStyle = '#ffe8b0'; x.fillRect(40, 40, 300, 84);
      for (let k = 0; k < 6; k++) { x.fillStyle = ['#c8322a', '#2a6ac8', '#e8c22a'][k % 3]; x.fillRect(60 + k * 46, 96, 30, 22); }
      e.fillStyle = '#ffd890'; e.globalAlpha = 0.9; e.fillRect(40, 40, 300, 84); e.globalAlpha = 1;
      x.fillStyle = '#1a1a1a'; x.fillRect(370, 34, 110, 96);
      for (let k = 0; k < 6; k++) { x.fillStyle = '#f0e8d0'; x.fillRect(380, 44 + k * 14, 60 + (k % 3) * 10, 6); }
      e.fillStyle = '#ffe8c0'; e.globalAlpha = 0.6; e.fillRect(370, 34, 110, 96); e.globalAlpha = 1;
    },
  ]);
}

function barnBoards(x, W, H, rng) {
  x.fillStyle = '#9a2e22'; x.fillRect(0, 0, W, H);
  for (let px = 0; px < W; px += 20) {
    const t = 0.85 + rng() * 0.25;
    x.fillStyle = `rgb(${154 * t},${46 * t},${34 * t})`; x.fillRect(px, 0, 18, H);
    x.fillStyle = 'rgba(0,0,0,0.35)'; x.fillRect(px + 18, 0, 2, H);
  }
  streaks(x, W, H, rng, 30, '60,20,10', 0.25);
  speckle(x, W, H, rng, 1500, ['#e8d8c8', '#3a1a10'], 0.04, 0.15);
  x.fillStyle = '#efe8dc'; x.fillRect(0, 0, 8, H); x.fillRect(W - 8, 0, 8, H);
}

function clapboard(x, W, H, rng) {
  x.fillStyle = '#ece8de'; x.fillRect(0, 0, W, H);
  for (let y = 0; y < H; y += 12) { x.fillStyle = 'rgba(0,0,0,0.13)'; x.fillRect(0, y + 10, W, 2); x.fillStyle = 'rgba(255,255,255,0.4)'; x.fillRect(0, y, W, 1); }
  speckle(x, W, H, rng, 1200, ['#000', '#fff'], 0.03, 0.1);
  streaks(x, W, H, rng, 8, '90,80,60', 0.08);
}

/** Crop rows (greyscale, tinted per field): a ridge and furrow per 1/8 of v. */
function rowsTex() {
  return once('fm:rows', () => {
    const [c, x] = cvs(256, 256);
    const rng = makeRng('rows');
    x.fillStyle = '#9a9a9a'; x.fillRect(0, 0, 256, 256);
    for (let r = 0; r < 8; r++) {
      const y0 = r * 32;
      const g = x.createLinearGradient(0, y0, 0, y0 + 32);
      g.addColorStop(0, '#5a5a5a'); g.addColorStop(0.3, '#d8d8d8'); g.addColorStop(0.55, '#f0f0f0'); g.addColorStop(0.8, '#c8c8c8'); g.addColorStop(1, '#5a5a5a');
      x.fillStyle = g; x.fillRect(0, y0, 256, 32);
    }
    speckle(x, 256, 256, rng, 6000, ['#ffffff', '#606060', '#b0b0b0'], 0.1, 0.35, 1, 3);
    return toTex(c);
  });
}

/** Meadow (greyscale, tinted): clumps and flecks. */
function meadowTex() {
  return once('fm:meadow', () => {
    const [c, x] = cvs(256, 256);
    const rng = makeRng('meadow');
    x.fillStyle = '#b4b4b4'; x.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 40; i++) {
      const px = rng() * 256, py = rng() * 256, r = 10 + rng() * 30;
      const g = x.createRadialGradient(px, py, 0, px, py, r);
      const v = rng() < 0.5 ? '255,255,255' : '70,70,70';
      g.addColorStop(0, `rgba(${v},0.18)`); g.addColorStop(1, `rgba(${v},0)`);
      x.fillStyle = g; x.fillRect(px - r, py - r, r * 2, r * 2);
    }
    speckle(x, 256, 256, rng, 9000, ['#ffffff', '#606060', '#d8d8d8', '#8a8a8a'], 0.15, 0.45, 1, 2.5);
    return toTex(c);
  });
}

/** The drive-in's picture: a sunset over a desert road, a car, the title. */
function screenTex() {
  return once('fm:screen', () => {
    const [c, x] = cvs(512, 224);
    const g = x.createLinearGradient(0, 0, 0, 224);
    g.addColorStop(0, '#2a1a4a'); g.addColorStop(0.45, '#c84a5a'); g.addColorStop(0.62, '#ffb060'); g.addColorStop(0.63, '#3a2030'); g.addColorStop(1, '#1a1018');
    x.fillStyle = g; x.fillRect(0, 0, 512, 224);
    x.fillStyle = '#ffd890'; x.beginPath(); x.arc(256, 140, 40, Math.PI, 0); x.fill();
    x.fillStyle = '#2a1424';
    x.beginPath(); x.moveTo(0, 141); x.lineTo(110, 100); x.lineTo(170, 126); x.lineTo(230, 108); x.lineTo(300, 141); x.fill();
    x.beginPath(); x.moveTo(330, 141); x.lineTo(420, 96); x.lineTo(512, 120); x.lineTo(512, 141); x.fill();
    x.fillStyle = '#4a3040'; x.beginPath(); x.moveTo(236, 141); x.lineTo(276, 141); x.lineTo(420, 224); x.lineTo(92, 224); x.fill();
    x.fillStyle = '#ffd890'; for (let k = 0; k < 5; k++) x.fillRect(254, 150 + k * 15, 4, 8);
    // the car, from behind, its tail lights
    x.fillStyle = '#0a0a10'; x.fillRect(206, 176, 100, 34); x.fillRect(220, 160, 72, 20);
    x.fillStyle = '#ff2a2a'; x.fillRect(208, 184, 18, 8); x.fillRect(286, 184, 18, 8);
    text(x, 'MIDNIGHT RUN', 256, 44, 46, '#ffe8c8', { max: 440, glow: '#ff6a4a', blur: 10 });
    for (let y = 0; y < 224; y += 3) { x.fillStyle = 'rgba(0,0,0,0.12)'; x.fillRect(0, y, 512, 1); }
    return toTex(c, { repeat: false });
  });
}

function signs() {
  return signAtlas('farmland', [
    // 0 STARLITE DRIVE-IN marquee (neon on a dark board)
    (x, e, w, h) => {
      x.fillStyle = '#141a2a'; x.fillRect(0, 0, w, h);
      for (let k = 0; k < 18; k++) { const px = 20 + k * 27; x.fillStyle = '#ffe080'; x.beginPath(); x.arc(px, 10, 4, 0, 6.283); x.fill(); x.beginPath(); x.arc(px, h - 10, 4, 0, 6.283); x.fill(); e.fillStyle = '#ffd060'; e.beginPath(); e.arc(px, 10, 5, 0, 6.283); e.fill(); e.beginPath(); e.arc(px, h - 10, 5, 0, 6.283); e.fill(); }
      text(x, 'STARLITE', w / 2, 52, 62, '#ff5ab0', { max: w - 40, italic: true });
      text(x, 'DRIVE-IN', w / 2, 98, 30, '#5ae0ff', { w: 900 });
      text(e, 'STARLITE', w / 2, 52, 62, '#ff4aa8', { max: w - 40, italic: true, glow: '#ff2a90', blur: 18 });
      text(e, 'DRIVE-IN', w / 2, 98, 30, '#4ad8ff', { w: 900, glow: '#20b8ff', blur: 14 });
    },
    // 1 HALCYON GRAIN CO. (painted on the head house)
    (x, e, w, h) => {
      x.fillStyle = '#d8d0c0'; x.fillRect(0, 0, w, h);
      text(x, 'HALCYON GRAIN CO.', w / 2, 56, 54, '#2a3a6a', { max: w - 30 });
      text(x, 'EST. 1922', w / 2, 102, 22, '#8a2a22', { w: 700 });
      e.globalAlpha = 0.18; e.fillStyle = '#d8d0c0'; e.fillRect(0, 0, w, h); e.globalAlpha = 1;
    },
    // 2 HALCYON FIELD — CLOSED
    (x, e, w, h) => {
      x.fillStyle = '#e8e2d4'; x.fillRect(0, 0, w, h);
      x.fillStyle = '#c8261e'; x.fillRect(0, 0, w, 24);
      text(x, 'HALCYON FIELD', w / 2, 62, 50, '#1a2a4a', { max: w - 40 });
      text(x, 'AIRFIELD CLOSED · NO LANDING', w / 2, 104, 20, '#c8261e', { w: 900 });
    },
    // 3 RAILROAD CROSSING (crossbuck: white with black letters)
    (x, e, w, h) => {
      x.fillStyle = '#f4f4f0'; x.fillRect(0, 0, w, h);
      x.strokeStyle = '#141414'; x.lineWidth = 6; x.strokeRect(6, 6, w - 12, h - 12);
      text(x, 'RAILROAD', w / 2, h / 2, 70, '#141414', { max: w - 40 });
      e.globalAlpha = 0.3; e.fillStyle = '#f4f4f0'; e.fillRect(0, 0, w, h); e.globalAlpha = 1;
    },
    // 4 FRESH EGGS · HONEY (a hand-painted farm board)
    (x, e, w, h) => {
      x.fillStyle = '#e8dcc0'; x.fillRect(0, 0, w, h);
      text(x, 'FRESH EGGS · HONEY', w / 2, 52, 46, '#8a2a1e', { max: w - 40, f: 'Georgia, serif', w: 700 });
      text(x, 'SWEET CORN IN SEASON', w / 2, 100, 24, '#3a5a2a', { f: 'Georgia, serif', w: 700 });
    },
    // 5 NOW SHOWING (the marquee's lower board)
    (x, e, w, h) => {
      x.fillStyle = '#f4f0e4'; x.fillRect(0, 0, w, h);
      text(x, 'NOW SHOWING', w / 2, 30, 22, '#8a2a1e', { w: 900 });
      text(x, 'MIDNIGHT RUN · 9PM', w / 2, 82, 44, '#141414', { max: w - 30 });
      e.globalAlpha = 0.85; e.fillStyle = '#fff4dc'; e.fillRect(0, 0, w, h); e.globalAlpha = 1;
      text(e, 'MIDNIGHT RUN · 9PM', w / 2, 82, 44, '#2a2420', { max: w - 30 });
    },
  ]);
}
const signUV = (k) => signs().uv(k);

function mats(B) {
  return {
    wall: B.mat('wall', () => { const t = walls(); return litMat({ map: t.map, emissive: 0xffffff, emissiveMap: t.emi, vertexColors: true, roughness: 0.85 }, { night: 1.0 }); }),
    roof: B.mat('roof', () => litMat({ map: roofTex('seam'), vertexColors: true, roughness: 0.6, metalness: 0.3 })),
    tin: B.mat('tin', () => litMat({ map: corrugatedTex('farm', { rust: 26 }), vertexColors: true, roughness: 0.6, metalness: 0.35 })),
    conc: B.mat('conc', () => litMat({ map: concreteTexture('#b8b2a4', 'fmconc'), vertexColors: true, roughness: 0.92 })),
    rows: B.mat('rows', () => litMat({ map: rowsTex(), vertexColors: true, roughness: 0.95, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 })),
    meadow: B.mat('meadow', () => litMat({ map: meadowTex(), vertexColors: true, roughness: 0.95, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 })),
    leaf: B.mat('leaf', () => litMat({ vertexColors: true, flatShading: true, roughness: 0.9 })),
    trunk: B.mat('trunk', () => litMat({ vertexColors: true, roughness: 0.95 })),
    paint: B.mat('paint', () => litMat({ vertexColors: true, roughness: 0.7 })),
    sign: B.mat('sign', () => { const t = signs(); return litMat({ map: t.map, emissive: 0xffffff, emissiveMap: t.emi, roughness: 0.6 }, { night: 1.5 }); }),
    screen: B.mat('screen', () => { const t = screenTex(); return litMat({ map: t, emissive: 0xffffff, emissiveMap: t, roughness: 0.9 }, { night: 1.25 }); }),
    lamp: B.mat('lamp', () => glowColorMat('#ffc880', 3)),
    yard: B.mat('yard', () => glowColorMat('#e8f0ff', 3.4)),
    flood: B.mat('flood', () => glowColorMat('#ffe8c0', 4)),
    red: B.mat('red', () => glowColorMat('#ff2418', 4)),
    gravel: B.mat('gravel', () => litMat({ map: concreteTexture('#9a9286', 'fmgrav'), roughness: 0.95, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 })),
  };
}

// ------------------------------------------------------------------ helpers

function storey(acc, x, y, z, w, d, ry, k, faces = 'fblr') {
  box(acc, x, y, z, w, STOREY, d, ry, { u: 8, v: STOREY * BANDS, v0: k / BANDS, top: false, faces });
}

function signPanel(acc, F, lx, ly, lz, w, h, k) {
  const uv = signUV(k);
  acc.quadP(F.p(lx - w / 2, ly, lz), F.p(lx + w / 2, ly, lz), F.p(lx + w / 2, ly + h, lz), F.p(lx - w / 2, ly + h, lz), uv);
}

function pickCrop(u) {
  const tot = CROPS.reduce((a, c) => a + c[4], 0);
  let acc = 0;
  for (const c of CROPS) { acc += c[4] / tot; if (u <= acc) return c; }
  return CROPS[0];
}

/** A lot beside road r: → { x, z, ry, s, g } or null (see redwood). */
function roadside(P, r, s0, s1, sd, back, w, d, o = {}) {
  const reach = r.rt.hw + r.rt.shoulder + r.rt.walk;
  for (let s = s0; s <= s1; s += o.step || 10) {
    const p = r.posAt(s);
    const lx = r.LX[p.i], lz = r.LZ[p.i];
    const off = reach + back + d / 2;
    const x = p.x + lx * sd * off, z = p.z + lz * sd * off;
    const ry = Math.atan2(-lx * sd, -lz * sd);
    if (!mine(x, z) || !P.isFree(x, z, w, d, ry, { pad: o.pad ?? 2, roadPad: true })) continue;
    const g = P.groundRange(x, z, w, d, ry);
    if (g.hi - g.lo > (o.slope ?? 3)) continue;
    return { x, z, ry, s, g };
  }
  return null;
}

// ------------------------------------------------------------------ plan: the railway and the elevator

function planRailway(P) {
  // the line, west to east along z = RAIL_Z, in pieces; gaps (level crossings) where it meets a road
  const step = 4;
  let run = [];
  const flush = () => {
    if (run.length > 1) {
      for (let k = 0; k < run.length - 1; k += 15) {
        const pts = run.slice(k, Math.min(run.length, k + 16));
        if (pts.length < 2) continue;
        P.add({ type: 'rails', x: pts[0][0], z: pts[0][1], pts });
      }
    }
    run = [];
  };
  let crossing = null;
  for (let x = RAIL_X0 + 2; x <= RAIL_X1; x += step) {
    const z = RAIL_Z;
    const onRoad = P.occ.get(x, z) & ROAD;
    if (onRoad) {
      if (!crossing) { flush(); crossing = { x0: x }; }
      continue;
    }
    if (crossing) {
      // a level crossing: the rails across the road flush, crossbucks and flashers both sides
      const cx = (crossing.x0 + x) / 2;
      const n = P.net.nearest(cx, z, 40);
      const ry = n ? Math.atan2(n.road.TX[n.i], n.road.TZ[n.i]) : 0;
      P.add({ type: 'crossing', x: cx, z, x0: crossing.x0 - 2, x1: x + 2 });
      for (const sd of [-1, 1]) {
        const px = sd < 0 ? crossing.x0 - 5 : x + 5, pz = z + sd * 4.5;
        P.add({ type: 'flasher', x: px, z: pz, ry: ry + (sd < 0 ? 0 : Math.PI) });
        P.collider({ kind: 'circle', x: px, z: pz, r: 0.3, y0: P.groundY(px, pz) - 1, y1: P.groundY(px, pz) + 4 });
        P.lamp({ x: px, z: pz, hx: px, hz: pz, hy: P.groundY(px, pz) + 3, color: '#ff3020', radius: 6, intensity: 0.5, halo: 1.2 });
      }
      crossing = null;
    }
    if (!mine(x, z)) { flush(); continue; }
    run.push([x, z]);
    P.occ.markRect(x, z, step + 0.5, 5, 0, 4);       // (ITEM: nothing else stands on the line)
  }
  flush();
  // telegraph poles along its north side
  for (let x = RAIL_X0 + 20; x < RAIL_X1; x += 48) {
    const z = RAIL_Z - 7;
    if (!mine(x, z) || !P.isFree(x, z, 1, 1, 0, { pad: 0.2, roadPad: true })) continue;
    P.claim(x, z, 1, 1, 0);
    P.add({ type: 'tpole', x, z, x2: x + 48 });
    P.collider({ kind: 'circle', x, z, r: 0.25, y0: P.groundY(x, z) - 1, y1: P.groundY(x, z) + 8 });
  }
}

function planElevator(P) {
  const F = new Fr(-4330, 0, 344, 0);
  const at = (lx, lz) => [F.wx(lx, lz), F.wz(lx, lz)];
  // six concrete silos in two rows, the head house beside them
  const silos = [];
  for (const lz of [-5, 4.4]) for (const lx of [-14, -4.6, 4.8]) silos.push(at(lx, lz));
  if (!P.isFree(F.x - 5, F.z, 32, 22, 0, { pad: 0.5, roadPad: true })) return;
  P.claim(F.x - 5, F.z, 32, 22, 0);
  P.add({ type: 'silos', x: F.x - 5, z: F.z, silos, r: 4.6, h: 32, w: 30, d: 20, ry: 0, map: 'building' });
  for (const [x, z] of silos) P.collider({ kind: 'circle', x, z, r: 4.7, y0: P.groundY(x, z) - 2, y1: P.groundY(x, z) + 32 });
  for (const [x, z] of silos) P.far({ shape: 'cyl', x, z, y: P.groundY(x, z) - 1, r: 4.6, h: 33, color: '#c8c2b4' });
  const [hx, hz] = at(18, 0);
  placeFoot(P, { type: 'headhouse', x: hx, z: hz, ry: 0, w: 10, d: 14, h: 46, map: 'building' }, 48, { pad: 0, roadPad: true, color: '#c8c2b4', lit: 0.2 });
  const hy = P.groundY(hx, hz);
  P.lamp({ x: hx, z: hz, hx, hz, hy: hy + 49, color: '#ff2a1a', radius: 4, intensity: 0.7, halo: 2.6 });
  P.lamp({ x: hx + 6, z: hz, hx: hx + 6, hz, hy: hy + 20, color: '#ffd8a0', radius: 18, intensity: 0.8, halo: 1.4 });
  // steel bins and their dryer, the loading shed over the siding, the scale house by the road
  for (const [lx, lz, r] of [[-36, -8, 5.5], [-36, 8, 5.5], [-50, 0, 6.5]]) {
    const [x, z] = at(lx, lz);
    if (!P.isFree(x, z, r * 2 + 1, r * 2 + 1, 0, { pad: 0.3 })) continue;
    P.claim(x, z, r * 2 + 1, r * 2 + 1, 0);
    P.add({ type: 'bin', x, z, r, h: r * 1.9, w: r * 2, d: r * 2, ry: 0, map: 'building' });
    P.collider({ kind: 'circle', x, z, r: r + 0.2, y0: P.groundY(x, z) - 1, y1: P.groundY(x, z) + r * 2.6 });
    P.far({ shape: 'cyl', x, z, y: P.groundY(x, z) - 1, r, h: r * 1.9 + 1, color: '#a8aca8' });
  }
  const [sx, sz] = at(4, 30);
  P.add({ type: 'loadshed', x: sx, z: sz, ry: 0, w: 30, d: 9 });
  for (const lx of [-15, 15]) { const [x, z] = at(4 + lx, 30 - 4); P.collider({ kind: 'circle', x, z, r: 0.3, y0: P.groundY(x, z) - 1, y1: P.groundY(x, z) + 8 }); }
  // hopper cars on the siding
  const cars = [];
  for (let k = 0; k < 7; k++) {
    const [x, z] = at(-56 + k * 15.5, 36);
    if (P.occ.get(x, z) & ROAD) continue;
    cars.push([x, z]);
    P.collider({ kind: 'box', x, z, hx: 1.6, hz: 7, ry: Math.PI / 2, y0: P.groundY(x, z) - 1, y1: P.groundY(x, z) + 4.4 });
  }
  P.add({ type: 'hoppers', x: cars[0]?.[0] ?? F.x, z: RAIL_Z, cars });
  const [ox, oz] = at(32, -20);
  placeFoot(P, { type: 'office', x: ox, z: oz, ry: Math.PI, w: 9, d: 6, map: 'building' }, 5, { pad: 0.5, roadPad: true, color: '#d8d0c0', lit: 0.5 });
  for (const [lx, lz] of [[-30, 22], [30, 18], [40, -6]]) { const [x, z] = at(lx, lz); poleLamp(P, x, z, 10, '#e8f0ff', 22, 0.85, 'yard'); }
  P.landmark({ id: 'grainco', name: 'HALCYON GRAIN CO.', x: hx, z: hz, kind: 'elevator' });
}

// ------------------------------------------------------------------ plan: the farms

function planFarms(P) {
  const ids = ['fm_l1', 'fm_l2', 'fm_l3', 'fm_l4', 'fm_l5', 'fm_l6', 'fm_l8', 'fm_l10', 'fm_l11', 'ml_road2', 'ml_road3', 'ml_road4', 'fm_l7'];
  const roads = ids.map((id) => P.net.byId.get(id)).filter(Boolean);
  let n = 0;
  for (const r of roads) {
    for (let s0 = 70; s0 < r.length - 70; s0 += 260 + P.range(0, 160)) {
      const sd = P.rng() < 0.5 ? 1 : -1;
      const lot = roadside(P, r, s0, s0 + 120, sd, 8, 70, 56) || roadside(P, r, s0, s0 + 120, -sd, 8, 70, 56);
      if (!lot) continue;
      planFarmstead(P, lot, n++);
    }
  }
}

/** A farmstead on a 70 × 56 lot facing the road (local +z toward it). */
function planFarmstead(P, lot, k) {
  const F = new Fr(lot.x, 0, lot.z, lot.ry);
  P.claim(lot.x, lot.z, 70, 56, lot.ry);
  const at = (lx, lz) => [F.wx(lx, lz), F.wz(lx, lz)];
  const flip = P.rng() < 0.5 ? 1 : -1;
  const add = (it, h) => {
    const g = P.groundRange(it.x, it.z, it.w, it.d, it.ry);
    P.add(it);
    P.collider({ kind: 'box', x: it.x, z: it.z, hx: it.w / 2, hz: it.d / 2, ry: it.ry, y0: g.lo - 2, y1: g.hi + h });
    P.far({ x: it.x, z: it.z, y: g.lo - 1, w: it.w, d: it.d, h: g.hi - g.lo + h, ry: it.ry, color: it.farColor || '#8a3a2a', lit: it.lit ?? 0 });
    return g;
  };
  // the farmhouse near the road, its porch light
  const [hx, hz] = at(flip * 20, 16);
  const hg = add({ type: 'farmhouse', x: hx, z: hz, ry: lot.ry, w: 12, d: 9, seed: P.rng(), lit: 0.4, farColor: '#d8d4c8', map: 'building' }, 9);
  const [lx, lz] = at(flip * 20 - 3, 16 + 4.5 + 1.6);
  P.lamp({ x: lx, z: lz, hx: lx, hz: lz, hy: hg.hi + 3, color: '#ffc070', radius: 9, intensity: 0.85, halo: 1.1 });
  // the barn behind, its silo(s)
  const [bx, bz] = at(-flip * 10, -10);
  add({ type: 'barn', x: bx, z: bz, ry: lot.ry, w: 22, d: 14, seed: P.rng(), map: 'building' }, 12);
  const nsilo = 1 + (P.rng() < 0.5 ? 1 : 0);
  for (let j = 0; j < nsilo; j++) {
    const [sx, sz] = at(-flip * (24 + j * 7.5), -14);
    const h = P.range(14, 20);
    P.add({ type: 'silo', x: sx, z: sz, r: 3, h, tone: P.pick(['#c8c4bc', '#8aa0b4', '#c8b8a0']), w: 6, d: 6, ry: 0, map: 'building' });
    const gy = P.groundY(sx, sz);
    P.collider({ kind: 'circle', x: sx, z: sz, r: 3.1, y0: gy - 1, y1: gy + h + 3 });
    P.far({ shape: 'cyl', x: sx, z: sz, y: gy - 1, r: 3, h: h + 3, color: '#b8b4ac' });
  }
  // a machine shed (a quonset or an open-fronted pole barn)
  const [mx, mz] = at(flip * 22, -14);
  add({ type: 'shed', x: mx, z: mz, ry: lot.ry, w: 18, d: 12, kind: P.rng() < 0.5 ? 'quonset' : 'pole', farColor: '#9a9a96', map: 'building' }, 7);
  // the windmill and its tank, the yard light, a tractor, bales, a pickup
  const [wx, wz] = at(flip * -30, 12);
  P.add({ type: 'windmill', x: wx, z: wz, ry: lot.ry + P.range(-0.8, 0.8), h: P.range(10, 13), seed: P.rng() });
  P.collider({ kind: 'circle', x: wx, z: wz, r: 1.4, y0: P.groundY(wx, wz) - 1, y1: P.groundY(wx, wz) + 14 });
  const [yx, yz] = at(-flip * 2, 4);
  poleLamp(P, yx, yz, 9.5, '#dfe8ff', 24, 0.9, 'yard');
  const [tx, tz] = at(-flip * 8, 6);
  P.add({ type: 'tractor', x: tx, z: tz, ry: lot.ry + P.range(-1, 1), body: P.pick(['#2f7a3a', '#c83a22', '#2a5aa8', '#e8c22a']) });
  P.collider({ kind: 'box', x: tx, z: tz, hx: 1.3, hz: 2.3, ry: lot.ry, y0: P.groundY(tx, tz) - 1, y1: P.groundY(tx, tz) + 2.8 });
  if (P.rng() < 0.7) {
    const [px, pz] = at(flip * 9, 20);
    P.add({ type: 'pickup', x: px, z: pz, ry: lot.ry + Math.PI / 2 + P.range(-0.3, 0.3), body: P.pick(['#8a2a22', '#2a4a6a', '#e8e2d0', '#3a5a3a', '#6a6a62']) });
    P.collider({ kind: 'box', x: px, z: pz, hx: 1.0, hz: 2.6, ry: lot.ry + Math.PI / 2, y0: P.groundY(px, pz) - 1, y1: P.groundY(px, pz) + 2 });
  }
  const [qx, qz] = at(-flip * 26, 8);
  P.add({ type: 'bales', x: qx, z: qz, ry: lot.ry, n: 4 + Math.floor(P.rng() * 5), seed: P.rng() });
  P.collider({ kind: 'box', x: qx, z: qz, hx: 5, hz: 2, ry: lot.ry, y0: P.groundY(qx, qz) - 1, y1: P.groundY(qx, qz) + 2 });
  // the yard: gravel; a paddock fence; the farm stand sign at the road for one in three
  P.add({ type: 'yard', x: lot.x, z: lot.z, ry: lot.ry, w: 60, d: 46, map: 'yard' });
  P.add({ type: 'paddock', x: lot.x, z: lot.z, ry: lot.ry, w: 70, d: 56, flip });
  if (k % 3 === 0) {
    const [sx, sz] = at(flip * 30, 28.5);
    P.add({ type: 'sign', x: sx, z: sz, ry: lot.ry, slot: 4, w: 2.6, h: 0.65, post: 0.8, kind: 'posts' });
  }
}

/**
 * The fields: a patchwork on a jittered grid, each a rectangle turned to the
 * nearest road, its crop drawn in rows; poplar windbreaks along some edges,
 * bales on the stubble.
 */
function planFields(P) {
  const b = P.d.box;
  const G = 175;
  for (let z = b.z0 + G / 2; z < b.z1; z += G) {
    for (let x = b.x0 + G / 2; x < b.x1; x += G) {
      const cx = x + P.range(-25, 25), cz = z + P.range(-25, 25);
      if (!mine(cx, cz)) continue;
      const n = P.nearestRoad(cx, cz, 400);
      const ry = n ? n.ry + (P.rng() < 0.5 ? 0 : Math.PI / 2) : P.range(0, Math.PI);
      let placed = null;
      for (const [w, d] of [[160, 150], [140, 120], [110, 100], [80, 70]]) {
        if (P.isFree(cx, cz, w, d, ry, { pad: 5, roadPad: true })) { placed = [w, d]; break; }
      }
      if (!placed) continue;
      const [w, d] = placed;
      P.claim(cx, cz, w, d, ry);
      const crop = pickCrop(P.rng());
      P.add({ type: 'field', x: cx, z: cz, ry, w, d, crop: crop[0], tint: crop[1], tex: crop[2], seed: P.rng(), map: 'field' });
      // a windbreak along one long edge, now and then
      if (P.rng() < 0.22) {
        const sd = P.rng() < 0.5 ? 1 : -1;
        for (let lx = -w / 2 + 4; lx <= w / 2 - 4; lx += 7) {
          const [px, pz] = toWorld(cx, cz, ry, lx, sd * (d / 2 + 2.5));
          if (!mine(px, pz) || !P.isFree(px, pz, 2, 2, 0, { pad: 0.2, roadPad: true })) continue;
          P.claim(px, pz, 2, 2, 0);
          const y = P.groundY(px, pz), h = P.range(14, 20);
          P.add({ type: 'poplar', x: px, z: pz, y, h, t: P.rng() });
          P.collider({ kind: 'circle', x: px, z: pz, r: 0.4, y0: y - 1, y1: y + h });
        }
      }
      // round bales on the stubble
      if (crop[0] === 'stubble' || crop[0] === 'alfalfa') {
        const nb = 4 + Math.floor(P.rng() * 10);
        const pts = [];
        for (let j = 0; j < nb; j++) pts.push([P.range(-w / 2 + 8, w / 2 - 8), P.range(-d / 2 + 8, d / 2 - 8), P.range(0, Math.PI)]);
        P.add({ type: 'fieldbales', x: cx, z: cz, ry, pts });
        for (const [lx, lz] of pts) { const [px, pz] = toWorld(cx, cz, ry, lx, lz); P.collider({ kind: 'circle', x: px, z: pz, r: 0.9, y0: P.groundY(px, pz) - 1, y1: P.groundY(px, pz) + 1.5 }); }
      }
      // a windmill and stock tank in a pasture
      if (crop[0] === 'pasture' && P.rng() < 0.6) {
        const [px, pz] = toWorld(cx, cz, ry, P.range(-w / 4, w / 4), P.range(-d / 4, d / 4));
        P.add({ type: 'windmill', x: px, z: pz, ry: ry + P.range(-1, 1), h: P.range(9, 12), seed: P.rng() });
        P.collider({ kind: 'circle', x: px, z: pz, r: 1.4, y0: P.groundY(px, pz) - 1, y1: P.groundY(px, pz) + 13 });
        P.add({ type: 'cows', x: px + 12, z: pz + 6, n: 3 + Math.floor(P.rng() * 5), seed: P.rng() });
      }
    }
  }
}

// ------------------------------------------------------------------ plan: the airfield, the drive-in, the crop circle

function planAirfield(P) {
  const r = P.net.byId.get('af_runway');
  if (!r) return;
  const at = (s, lat) => { const p = r.posAt(s); return [p.x + r.LX[p.i] * lat, p.z + r.LZ[p.i] * lat, Math.atan2(r.TX[p.i], r.TZ[p.i])]; };
  // the apron and its hangars on the south side of the runway's east half (the right: −lat)
  const reach = r.rt.hw + r.rt.shoulder;
  const [ax, az, ary] = at(650, -(reach + 34));
  if (P.isFree(ax, az, 170, 56, ary + Math.PI / 2, { pad: 0.5, roadPad: true })) {
    P.claim(ax, az, 170, 56, ary + Math.PI / 2);
    P.add({ type: 'apron', x: ax, z: az, ry: ary + Math.PI / 2, w: 170, d: 56, map: 'plaza' });
  }
  for (const [s, w] of [[580, 34], [640, 34], [700, 40]]) {
    const [hx, hz, hry] = at(s, -(reach + 34 + 28 + w / 2 - 4));
    placeFoot(P, { type: 'hangar', x: hx, z: hz, ry: hry + Math.PI / 2, w: 28, d: w, h: w * 0.45, seed: P.rng(), map: 'building' }, w * 0.48, { pad: 1, color: '#8a8e8a', lit: 0.05 });
  }
  const [tx, tz, tr] = at(520, -(reach + 40));
  if (placeFoot(P, { type: 'ctower', x: tx, z: tz, ry: tr - Math.PI / 2, w: 7, d: 7, h: 15, map: 'building' }, 20, { pad: 0.5, far: false })) {
    const gy = P.groundY(tx, tz);
    P.far({ x: tx, z: tz, y: gy - 1, w: 7, d: 7, h: 13, ry: tr, color: '#c8c2b4', lit: 0.1 });
    P.far({ x: tx, z: tz, y: gy + 12, w: 8.5, d: 8.5, h: 4, ry: tr, color: '#3a4a56', lit: 0.4 });
    P.lamp({ x: tx, z: tz, hx: tx, hz: tz, hy: gy + 18.4, color: '#ffe0a0', radius: 10, intensity: 0.8, halo: 2.8 });
    P.add({ type: 'beacon', x: tx, z: tz, y: gy + 18 });
  }
  const [fx, fz, fr] = at(760, -(reach + 22));
  if (P.isFree(fx, fz, 10, 4, fr, { pad: 0.5 })) {
    P.claim(fx, fz, 10, 4, fr);
    P.add({ type: 'fueltank', x: fx, z: fz, ry: fr });
    P.collider({ kind: 'box', x: fx, z: fz, hx: 5, hz: 1.8, ry: fr + Math.PI / 2, y0: P.groundY(fx, fz) - 1, y1: P.groundY(fx, fz) + 3.6 });
  }
  // the windsock, the edge lights, the sign at the taxiway
  const [wx, wz] = at(420, reach + 30);
  P.add({ type: 'windsock', x: wx, z: wz });
  for (let s = 30; s < r.length - 20; s += 60) {
    for (const sd of [1, -1]) { const [x, z] = at(s, sd * (reach + 1.5)); P.add({ type: 'edgelight', x, z, lit: hash2(x, z) < 0.18 }); }
  }
  const tw = P.net.byId.get('af_taxi');
  if (tw) {
    const p = tw.posAt(tw.length * 0.6);
    const off = tw.rt.hw + tw.rt.shoulder + 3;
    const x = p.x + tw.LX[p.i] * off, z = p.z + tw.LZ[p.i] * off;
    P.add({ type: 'sign', x, z, ry: Math.atan2(-tw.TX[p.i], -tw.TZ[p.i]) + 0.6, slot: 2, w: 4.4, h: 1.1, post: 1.4, kind: 'posts' });
  }
  // the wreck in the grass by the runway's west end
  const [kx, kz, kr] = at(150, reach + 38);
  if (P.isFree(kx, kz, 26, 22, kr, { pad: 0.5 })) {
    P.claim(kx, kz, 26, 22, kr);
    P.add({ type: 'wreck', x: kx, z: kz, ry: kr + 0.9 });
    P.collider({ kind: 'box', x: kx, z: kz, hx: 1.8, hz: 9, ry: kr + 0.9, y0: P.groundY(kx, kz) - 1, y1: P.groundY(kx, kz) + 4.5 });
    const [wx2, wz2] = toWorld(kx, kz, kr + 0.9, 7, 2);
    P.collider({ kind: 'box', x: wx2, z: wz2, hx: 6, hz: 1.6, ry: kr + 0.9, y0: P.groundY(wx2, wz2) - 1, y1: P.groundY(wx2, wz2) + 2.5 });
  }
}

function planDriveIn(P) {
  const r = P.net.byId.get('fm_l9');
  if (!r) return;
  const s = 120;
  const p = r.posAt(s);
  const reach = r.rt.hw + r.rt.shoulder;
  const W = 120, D = 112;                  // W along the road, D away from it
  const off = reach + 6 + D / 2;
  const cx = p.x + r.LX[p.i] * off, cz = p.z + r.LZ[p.i] * off;
  const ry = Math.atan2(-r.LX[p.i], -r.LZ[p.i]);     // local +z toward the road
  if (!P.isFree(cx, cz, W, D, ry, { pad: 0, roadPad: true })) return;
  P.claim(cx, cz, W, D, ry);
  const F = new Fr(cx, 0, cz, ry);
  P.add({ type: 'drivein', x: cx, z: cz, ry, w: W, d: D, map: 'plaza' });
  // the screen at the back, facing the lot (toward the road); its colliders
  const [sx, sz] = [F.wx(0, -D / 2 + 3), F.wz(0, -D / 2 + 3)];
  P.collider({ kind: 'box', x: sx, z: sz, hx: 19, hz: 2, ry, y0: P.groundY(sx, sz) - 1, y1: P.groundY(sx, sz) + 22 });
  const gy = P.groundY(sx, sz);
  P.far({ x: sx, z: sz, y: gy + 5, w: 36, d: 1.5, h: 17, ry, color: '#c8b8a8', lit: 1 });
  for (const k of [-1, 0, 1]) {
    const [lx, lz] = [F.wx(k * 12, -D / 2 + 12), F.wz(k * 12, -D / 2 + 12)];
    P.lamp({ x: lx, z: lz, hx: sx + (lx - sx) * 0.1, hz: sz + (lz - sz) * 0.1, hy: gy + 12, color: '#c8b0ff', radius: 22, intensity: 0.55, halo: 0 });
  }
  // the snack bar and projection booth in the middle of the lot
  const [bx, bz] = [F.wx(0, 20), F.wz(0, 20)];
  P.collider({ kind: 'box', x: bx, z: bz, hx: 8, hz: 5, ry, y0: P.groundY(bx, bz) - 1, y1: P.groundY(bx, bz) + 6 });
  P.lamp({ x: bx, z: bz, hx: F.wx(0, 26), hz: F.wz(0, 26), hy: P.groundY(bx, bz) + 3, color: '#ffd890', radius: 12, intensity: 0.9, halo: 0.8 });
  // the fence round it (a gap at the entrance), the marquee at the road
  const fenceLine = [[-W / 2, D / 2], [-W / 2, -D / 2], [W / 2, -D / 2], [W / 2, D / 2], [10, D / 2]];
  const pts = fenceLine.map(([lx, lz]) => [F.wx(lx, lz), F.wz(lx, lz)]);
  P.add({ type: 'dfence', x: pts[0][0], z: pts[0][1], pts });
  for (let k = 0; k < pts.length - 1; k++) {
    const a = pts[k], b = pts[k + 1];
    const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
    P.collider({ kind: 'box', x: (a[0] + b[0]) / 2, z: (a[1] + b[1]) / 2, hx: 0.15, hz: L / 2, ry: Math.atan2(b[0] - a[0], b[1] - a[1]), y0: P.groundY(a[0], a[1]) - 1, y1: P.groundY(a[0], a[1]) + 2 });
  }
  const [mx, mz] = [F.wx(-28, D / 2 + 3), F.wz(-28, D / 2 + 3)];
  P.add({ type: 'marquee', x: mx, z: mz, ry: ry + 0.3 });
  P.collider({ kind: 'box', x: mx, z: mz, hx: 0.6, hz: 0.6, ry, y0: P.groundY(mx, mz) - 1, y1: P.groundY(mx, mz) + 9 });
  P.lamp({ x: mx, z: mz, hx: mx, hz: mz, hy: P.groundY(mx, mz) + 7, color: '#ff6ab8', radius: 14, intensity: 0.9, halo: 2.6 });
}

function planCropCircle(P) {
  const r = P.net.byId.get('fm_cc');
  if (!r) return;
  const e = r.posAt(r.length);
  const ry = Math.atan2(r.TX[r.N - 1], r.TZ[r.N - 1]);
  // the wheat field beyond the track's end
  const F = new Fr(e.x, 0, e.z, ry);
  const cx = F.wx(0, 105), cz = F.wz(0, 105);
  const w = 190, d = 180;
  if (!P.isFree(cx, cz, w, d, ry, { pad: 0, roadPad: true })) return;
  P.claim(cx, cz, w, d, ry);
  P.add({ type: 'field', x: cx, z: cz, ry, w, d, crop: 'wheat', tint: '#d0ae5c', tex: 'rows', seed: 0.5, map: 'field' });
  P.add({ type: 'circle', x: cx, z: cz, ry, seed: P.rng() });
  P.landmark({ id: 'cropcircle', name: 'THE CROP CIRCLE', x: cx, z: cz, kind: 'mystery', hidden: true });
}

// ------------------------------------------------------------------ build: crops and fields

function buildField(B, M, it) {
  const poly = rectPoly(it.x, it.z, it.w, it.d, it.ry);
  const tex = it.tex === 'meadow' ? M.meadow : M.rows;
  const acc = B.acc(tex);
  const tint = mixc(lin(it.tint), lin('#ffffff'), 0.08);
  const v = 0.9 + it.seed * 0.2;
  // rows along the field's long side (local x): world angle of local x is −ry
  const crop = CROPS.find((c) => c[0] === it.crop);
  const row = crop?.[3] || 2;
  drapeUV(acc, B, poly, { lift: 0.04, step: 12, uv: row * 8, ang: -it.ry, col: [tint[0] * v, tint[1] * v, tint[2] * v] });
}

function buildCircle(B, M, it) {
  // flattened wheat (lighter, laid in a swirl): a big disc, rings, a trail of satellites
  const acc = B.acc(M.meadow);
  const c0 = lin('#e8d8a0');
  const F = new Fr(it.x, 0, it.z, it.ry);
  const ring = (cx, cz, r0, r1, seg) => {
    for (let k = 0; k < seg; k++) {
      const a0 = (k / seg) * Math.PI * 2, a1 = ((k + 1) / seg) * Math.PI * 2;
      const P = (r, a) => { const x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r; return [x, B.groundY(x, z) + 0.09, z]; };
      if (r0 <= 0.01) {
        const C = P(0, 0);
        const ia = acc.v(...C, 0.5, 0.5), ib = acc.v(...P(r1, a0), Math.cos(a0), Math.sin(a0)), ic = acc.v(...P(r1, a1), Math.cos(a1), Math.sin(a1));
        acc.tri(ia, ic, ib);
      } else {
        acc.quadP(P(r0, a1), P(r0, a0), P(r1, a0), P(r1, a1), [a1 * r0 / 3, r0 / 3, a0 * r0 / 3, r1 / 3]);
      }
    }
  };
  acc.col = c0;
  ring(it.x, it.z, 0, 16, 28);
  for (const [r0, r1] of [[22, 25], [31, 33], [39, 40.5]]) ring(it.x, it.z, r0, r1, 56);
  acc.col = mixc(c0, lin('#ffffff'), 0.1);
  // satellites spiralling out
  for (let k = 0; k < 7; k++) {
    const a = 0.6 + k * 0.62, d = 48 + k * 6.5, r = 6 - k * 0.6;
    ring(F.wx(Math.cos(a) * d, Math.sin(a) * d), F.wz(Math.cos(a) * d, Math.sin(a) * d), 0, r, 16);
  }
  // the three-pointed sign in the middle: spokes out to the third ring
  for (let k = 0; k < 3; k++) {
    const a = it.seed * 6.28 + (k * Math.PI * 2) / 3;
    const ca = Math.cos(a), sa = Math.sin(a), nx = -sa * 1.6, nz = ca * 1.6;
    const p0 = [it.x + ca * 16, it.z + sa * 16], p1 = [it.x + ca * 31, it.z + sa * 31];
    const y = (x, z) => B.groundY(x, z) + 0.09;
    acc.quadP([p0[0] - nx, y(p0[0], p0[1]), p0[1] - nz], [p0[0] + nx, y(p0[0], p0[1]), p0[1] + nz], [p1[0] + nx, y(p1[0], p1[1]), p1[1] + nz], [p1[0] - nx, y(p1[0], p1[1]), p1[1] - nz]);
  }
  acc.col = WHITE;
}

// ------------------------------------------------------------------ build: the railway and the elevator

function buildRails(B, M, it) {
  const paint = B.acc(M.paint), conc = B.acc(M.gravel);
  const pts = it.pts;
  // ballast: a low bank under the sleepers
  for (let k = 0; k < pts.length - 1; k++) {
    const a = pts[k], b = pts[k + 1];
    const ya = B.groundY(a[0], a[1]), yb = B.groundY(b[0], b[1]);
    const Wb = 1.9, Wt = 1.3;
    conc.quadP([a[0], ya + 0.02, a[1] + Wb], [b[0], yb + 0.02, b[1] + Wb], [b[0], yb + 0.3, b[1] + Wt], [a[0], ya + 0.3, a[1] + Wt]);
    conc.quadP([b[0], yb + 0.02, b[1] - Wb], [a[0], ya + 0.02, a[1] - Wb], [a[0], ya + 0.3, a[1] - Wt], [b[0], yb + 0.3, b[1] - Wt]);
    conc.quadP([a[0], ya + 0.3, a[1] + Wt], [b[0], yb + 0.3, b[1] + Wt], [b[0], yb + 0.3, b[1] - Wt], [a[0], ya + 0.3, a[1] - Wt]);
    // sleepers every 0.8 m (as a few long strips: cheaper, reads the same)
    col(paint, lin('#3a2e24'));
    for (let d = 0.4; d < 4; d += 0.8) {
      const x = a[0] + (b[0] - a[0]) * (d / 4), z = a[1], y = ya + (yb - ya) * (d / 4);
      box(paint, x, y + 0.28, z, 0.24, 0.12, 2.5, 0, { u: 1, faces: 'lr' });
    }
    // rails
    col(paint, lin('#7a6e66'));
    for (const o of [-0.72, 0.72]) beam(paint, [a[0], ya + 0.47, a[1] + o], [b[0], yb + 0.47, b[1] + o], 0.08, 0.14);
  }
  col(paint, WHITE);
}

function buildCrossing(B, M, it) {
  // the rails flush across the road: dark strips on its surface
  const paint = B.acc(M.paint);
  col(paint, lin('#5a524c'));
  for (const o of [-0.72, 0.72]) {
    for (let x = it.x0; x < it.x1; x += 2) {
      const x1 = Math.min(it.x1, x + 2);
      const ya = B.groundY(x, it.z + o) + 0.035, yb = B.groundY(x1, it.z + o) + 0.035;
      paint.quadP([x, ya, it.z + o + 0.06], [x1, yb, it.z + o + 0.06], [x1, yb, it.z + o - 0.06], [x, ya, it.z + o - 0.06]);
    }
  }
  col(paint, WHITE);
}

function buildFlasher(B, M, it, anims) {
  const F = new Fr(it.x, B.groundY(it.x, it.z), it.z, it.ry);
  const paint = B.acc(M.paint), sign = B.acc(M.sign);
  col(paint, lin('#e8e8e4'));
  F.box(paint, 0, -0.3, 0, 0.16, 4.3, 0.16, { u: 1 });
  // the crossbuck: two boards crossed
  const uv = signUV(3);
  for (const a of [0.6, -0.6]) {
    const c = Math.cos(a), s = Math.sin(a);
    const P = (lx, ly) => F.p(lx * c - ly * s, 3.6 + lx * s + ly * c, 0.1);
    sign.quadP(P(-1.2, -0.15), P(1.2, -0.15), P(1.2, 0.15), P(-1.2, 0.15), uv);
    const Q = (lx, ly) => F.p(-(lx * c - ly * s), 3.6 + lx * s + ly * c, -0.1);
    sign.quadP(Q(-1.2, -0.15), Q(1.2, -0.15), Q(1.2, 0.15), Q(-1.2, 0.15), uv);
  }
  // the lamps: a black yoke and two red lights that take turns
  col(paint, lin('#1a1a1a'));
  F.box(paint, 0, 2.3, 0.12, 1.5, 0.5, 0.2, { u: 1 });
  const g = new THREE.SphereGeometry(0.17, 6, 4);
  const lamps = [-0.5, 0.5].map((lx) => {
    const m = new THREE.Mesh(g, M.red);
    const p = F.p(lx, 2.55, 0.28);
    m.position.set(p[0], p[1], p[2]);
    m.matrixAutoUpdate = true;
    B.group.add(m);
    return m;
  });
  anims.push((t) => { const on = Math.floor(t * 1.6) % 2; lamps[0].visible = on === 0; lamps[1].visible = on === 1; });
  col(paint, WHITE);
}

function buildTelegraph(B, M, it) {
  const trunk = B.acc(M.trunk), paint = B.acc(M.paint);
  const gy = B.groundY(it.x, it.z), gy2 = B.groundY(it.x2, it.z);
  trunk.col = lin('#5a4a3a');
  cylinder(trunk, it.x, gy - 0.3, it.z, 0.13, 8.3, 5, { r2: 0.1 });
  box(trunk, it.x, gy + 7.2, it.z, 0.16, 0.16, 2.2, 0, { u: 1 });
  trunk.col = WHITE;
  col(paint, lin('#1a1a1a'));
  for (const o of [-0.9, 0, 0.9]) {
    const a = [it.x, gy + 7.35, it.z + o], b = [it.x2, gy2 + 7.35, it.z + o];
    const m = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2 - 0.6, a[2]];
    beam(paint, a, m, 0.025, 0.025); beam(paint, m, b, 0.025, 0.025);
  }
  col(paint, WHITE);
}

function buildSilos(B, M, it) {
  const conc = B.acc(M.conc);
  col(conc, lin('#d8d2c4'));
  for (const [x, z] of it.silos) {
    const gy = B.groundY(x, z);
    lathe(conc, x, gy - 1, z, [[it.r, 0], [it.r, it.h + 1], [it.r * 0.96, it.h + 1.4]], 14, { u: 3, v: 3, top: true });
  }
  // the gallery across their tops
  const a = it.silos[0], b = it.silos[2];
  const gy = B.groundY(a[0], a[1]);
  col(conc, lin('#c8c0b0'));
  box(conc, (a[0] + b[0]) / 2 + 4, gy + it.h + 0.4, (a[1] + it.silos[3][1]) / 2, Math.hypot(b[0] - a[0], b[1] - a[1]) + 16, 3.2, 3, 0, { u: 3 });
  col(conc, WHITE);
}

function buildHeadhouse(B, M, it) {
  const F = new Fr(it.x, 0, it.z, it.ry);
  const g = B.footY(it.x, it.z, it.w, it.d, it.ry);
  const conc = B.acc(M.conc), tin = B.acc(M.tin), paint = B.acc(M.paint);
  col(conc, lin('#d8d2c4'));
  F.box(conc, 0, g.lo - 1, 0, it.w, it.h - 6 + (g.hi - g.lo) + 1, it.d, { u: 3 });
  col(tin, lin('#a8aca8'));
  F.box(tin, 0, g.hi + it.h - 6, 0, it.w + 1, 6, it.d - 2, { u: 3 });
  gable(tin, it.x, g.hi + it.h, it.z, it.w + 1.4, it.d - 1.6, 2.2, it.ry, { over: 0.3, alongZ: true, endAcc: tin });
  // lit windows up the stair tower, the company's name
  const win = B.acc(M.lamp);
  for (let k = 0; k < 9; k++) F.box(win, it.w / 2 - 1.2, g.hi + 4 + k * 4.4, it.d / 2 + 0.02, 0.8, 1.2, 0.05, { u: 1, top: false });
  signPanel(B.acc(M.sign), F, -0.8, g.hi + it.h - 15, it.d / 2 + 0.05, 8.2, 2.05, 1);
  signPanel(B.acc(M.sign), new Fr(it.x, 0, it.z, it.ry + Math.PI), 0, g.hi + it.h - 15, it.d / 2 + 0.05, 8.2, 2.05, 1);
  // the spouts down to the silos
  col(paint, lin('#8a8e8a'));
  for (let k = 0; k < 3; k++) {
    const a = F.p(-it.w / 2, it.h - 8 + g.hi, -3 + k * 3), b = [it.x - 22 + k * 9.4, g.hi + 33.5, it.z + (k % 2 ? 4.4 : -5)];
    tube(paint, a, b, 0.22, 5);
  }
  col(conc, WHITE); col(tin, WHITE); col(paint, WHITE);
}

function buildBin(B, M, it) {
  const tin = B.acc(M.tin), paint = B.acc(M.paint);
  const gy = B.groundY(it.x, it.z);
  col(tin, lin('#c8ccc8'));
  lathe(tin, it.x, gy - 0.3, it.z, [[it.r, 0], [it.r, it.h], [it.r * 0.2, it.h + it.r * 0.55], [0.4, it.h + it.r * 0.6]], 16, { u: 2.2, v: 3 });
  col(paint, lin('#6a6e6a'));
  cylinder(paint, it.x, gy + it.h + it.r * 0.6, it.z, 0.4, 0.8, 6, { top: true });
  for (let k = 0; k < 6; k++) beam(paint, [it.x + it.r + 0.1, gy + k * (it.h / 6), it.z], [it.x + it.r + 0.1, gy + (k + 1) * (it.h / 6), it.z], 0.06, 0.06);
  col(tin, WHITE); col(paint, WHITE);
}

function buildLoadShed(B, M, it) {
  const F = new Fr(it.x, 0, it.z, it.ry);
  const paint = B.acc(M.paint), tin = B.acc(M.tin);
  const gy = B.groundY(it.x, it.z);
  col(paint, lin('#4a4e52'));
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) F.box(paint, sx * it.w / 2, gy - 0.3, sz * it.d / 2, 0.3, 8.6, 0.3, { u: 1 });
  col(tin, lin('#a0a4a0'));
  F.box(tin, 0, gy + 8, 0, it.w + 0.6, 0.3, it.d + 0.6, { u: 3 });
  gable(tin, it.x, gy + 8.3, it.z, it.w + 1, it.d + 1, 1.4, it.ry, { over: 0.2, endAcc: tin });
  col(paint, WHITE); col(tin, WHITE);
}

function buildHoppers(B, M, it) {
  const paint = B.acc(M.paint);
  for (const [x, z] of it.cars) {
    const gy = B.groundY(x, z);
    const F = new Fr(x, gy, z, Math.PI / 2);
    col(paint, lin('#1a1a1a'));
    for (const lz of [-4.6, 4.6]) F.box(paint, 0, 0.3, lz, 2.2, 0.9, 2.6, { u: 1 });
    col(paint, lin(hash2(x, z) < 0.5 ? '#8a5a3a' : '#4a5a6a'));
    F.box(paint, 0, 1.2, 0, 2.9, 3.2, 13, { u: 2 });
    // the hopper chutes under it
    for (const lz of [-3, 0, 3]) {
      const A = F.p(-1.4, 1.2, lz - 1.2), Bq = F.p(1.4, 1.2, lz - 1.2), C = F.p(0, 0.5, lz);
      paint.tri(paint.v(...A), paint.v(...Bq), paint.v(...C));
    }
  }
  col(paint, WHITE);
}

// ------------------------------------------------------------------ build: the farms

function buildFarmhouse(B, M, it) {
  const F = new Fr(it.x, 0, it.z, it.ry);
  const g = B.footY(it.x, it.z, it.w, it.d, it.ry);
  const wall = B.acc(M.wall), roof = B.acc(M.roof), conc = B.acc(M.conc), paint = B.acc(M.paint);
  const y0 = g.hi + 0.6;
  col(conc, lin('#9a968c'));
  F.box(conc, 0, g.lo - 0.8, 0, it.w, y0 - g.lo + 0.8, it.d, { u: 2 });
  col(wall, it.seed < 0.7 ? WHITE : lin('#f0e8c8'));
  storey(wall, it.x, y0, it.z, it.w, it.d, it.ry, 3, 'f');
  storey(wall, it.x, y0, it.z, it.w, it.d, it.ry, 2, 'blr');
  storey(wall, it.x, y0 + STOREY, it.z, it.w, it.d, it.ry, 2);
  col(roof, lin(it.seed < 0.4 ? '#4a4e56' : it.seed < 0.7 ? '#6a2a24' : '#3a4a3a'));
  col(paint, lin('#f0ece4'));
  gable(roof, it.x, y0 + 2 * STOREY, it.z, it.w, it.d, 3.6, it.ry, { over: 0.5, endAcc: B.acc(M.wall) });
  // the porch across the front
  col(paint, lin('#a8a49a'));
  F.box(paint, 0, y0 - 0.3, it.d / 2 + 1.5, it.w, 0.3, 3, { u: 2 });
  col(paint, lin('#f4f2ec'));
  for (const lx of [-it.w / 2 + 0.2, -it.w / 6, it.w / 6, it.w / 2 - 0.2]) F.box(paint, lx, y0, it.d / 2 + 2.8, 0.18, 2.6, 0.18, { u: 1 });
  beam(paint, F.p(-it.w / 2, y0 + 0.9, it.d / 2 + 2.9), F.p(it.w / 2, y0 + 0.9, it.d / 2 + 2.9), 0.08, 0.08);
  col(roof, lin('#5a5e62'));
  roof.quadP(F.p(-it.w / 2 - 0.2, y0 + 2.6, it.d / 2 + 3.2), F.p(it.w / 2 + 0.2, y0 + 2.6, it.d / 2 + 3.2), F.p(it.w / 2 + 0.2, y0 + 3.1, it.d / 2), F.p(-it.w / 2 - 0.2, y0 + 3.1, it.d / 2));
  col(conc, lin('#8a6a5a'));
  F.box(conc, it.w / 2 - 2, y0 + STOREY, -it.d * 0.2, 1.1, STOREY + 4.4, 1.1, { u: 1 });
  box(B.acc(M.lamp), F.wx(-3, it.d / 2 + 0.15), y0 + 2.2, F.wz(-3, it.d / 2 + 0.15), 0.22, 0.3, 0.22, it.ry, { u: 1 });
  col(wall, WHITE); col(roof, WHITE); col(conc, WHITE); col(paint, WHITE);
}

function buildBarn(B, M, it) {
  const F = new Fr(it.x, 0, it.z, it.ry);
  const g = B.footY(it.x, it.z, it.w, it.d, it.ry);
  const wall = B.acc(M.wall), roof = B.acc(M.roof), conc = B.acc(M.conc);
  const y0 = g.hi + 0.2;
  col(conc, lin('#8a867c'));
  F.box(conc, 0, g.lo - 0.8, 0, it.w + 0.3, y0 - g.lo + 0.8, it.d + 0.3, { u: 2 });
  col(wall, WHITE);
  // the gable ends (local ±x) carry the loft doors: the barn's ridge runs along local z
  storey(wall, it.x, y0, it.z, it.w, it.d, it.ry, 1, 'fb');
  storey(wall, it.x, y0, it.z, it.w, it.d, it.ry, 0, 'lr');
  storey(wall, it.x, y0 + STOREY, it.z, it.w, it.d, it.ry, 1);
  col(roof, lin(it.seed < 0.5 ? '#5a5e62' : '#7a3a2e'));
  gambrel(roof, wall, it.x, y0 + 2 * STOREY, it.z, it.w, it.d, it.ry, { over: 0.5, kneeH: 3.6, ridgeH: 2.4 });
  // the big sliding doors on the front, the cupola on the ridge
  const paint = B.acc(M.paint);
  col(paint, lin('#efe8dc'));
  F.box(paint, -3, y0, it.d / 2 + 0.03, 5.6, 4.6, 0.12, { u: 1 });
  F.box(paint, 3, y0, it.d / 2 + 0.03, 5.6, 4.6, 0.12, { u: 1 });
  col(paint, lin('#8a2a1e'));
  F.box(paint, -3, y0 + 0.3, it.d / 2 + 0.1, 5.0, 4.0, 0.06, { u: 1 });
  F.box(paint, 3, y0 + 0.3, it.d / 2 + 0.1, 5.0, 4.0, 0.06, { u: 1 });
  col(wall, WHITE);
  const top = y0 + 2 * STOREY + 3.6 + 2.4;
  col(paint, lin('#efe8dc'));
  F.box(paint, 0, top - 0.6, 0, 2, 2, 2, { u: 1 });
  col(roof, lin('#5a5e62'));
  gable(roof, it.x, top + 1.4, it.z, 2.4, 2.4, 1, it.ry, { over: 0.2 });
  col(roof, WHITE); col(conc, WHITE); col(paint, WHITE);
}

function buildSilo(B, M, it) {
  const conc = B.acc(M.conc), roof = B.acc(M.roof);
  const gy = B.groundY(it.x, it.z);
  col(conc, lin(it.tone));
  lathe(conc, it.x, gy - 0.5, it.z, [[it.r, 0], [it.r, it.h + 0.5]], 12, { u: 2.5, v: 3 });
  col(roof, lin('#9aa0a4'));
  lathe(roof, it.x, gy + it.h, it.z, [[it.r + 0.15, 0], [it.r * 0.7, it.r * 0.5], [0.1, it.r * 0.8]], 12, { u: 2 });
  col(conc, WHITE); col(roof, WHITE);
}

function buildShed(B, M, it) {
  const F = new Fr(it.x, 0, it.z, it.ry);
  const g = B.footY(it.x, it.z, it.w, it.d, it.ry);
  const tin = B.acc(M.tin), paint = B.acc(M.paint), conc = B.acc(M.conc);
  col(conc, lin('#8a867c'));
  F.box(conc, 0, g.lo - 0.6, 0, it.w, g.hi - g.lo + 0.8, it.d, { u: 2 });
  if (it.kind === 'quonset') {
    col(tin, lin('#b8bcb8'));
    quonset(tin, B.acc(M.paint), it.x, g.hi + 0.2, it.z, it.d, it.w, it.ry + Math.PI / 2, { seg: 9, rise: it.w * 0.42 });
    col(paint, lin('#2a2a2a'));
    F.box(paint, 0, g.hi + 0.2, it.d / 2 + 0.05, 6, 4.2, 0.1, { u: 1 });
  } else {
    // an open-fronted pole barn: posts, a back wall, a shed roof; machinery inside
    col(paint, lin('#6a5038'));
    for (let k = 0; k <= 4; k++) F.box(paint, -it.w / 2 + (k * it.w) / 4, g.hi, it.d / 2 - 0.3, 0.3, 5.2, 0.3, { u: 1 });
    col(tin, lin('#b0aaa0'));
    F.box(tin, 0, g.hi, -it.d / 2 + 0.2, it.w, 4.2, 0.2, { u: 3 });
    for (const sx of [-1, 1]) F.box(tin, sx * it.w / 2, g.hi, 0, 0.2, 4.2, it.d, { u: 3 });
    tin.quadP(F.p(-it.w / 2 - 0.4, g.hi + 5.3, it.d / 2 + 0.6), F.p(it.w / 2 + 0.4, g.hi + 5.3, it.d / 2 + 0.6), F.p(it.w / 2 + 0.4, g.hi + 4.3, -it.d / 2 - 0.4), F.p(-it.w / 2 - 0.4, g.hi + 4.3, -it.d / 2 - 0.4), [0, 0, it.w / 3, it.d / 3]);
    tractor(paint, F.wx(-4, 0), g.hi, F.wz(-4, 0), it.ry, '#c83a22');
    col(paint, lin('#c8a020'));
    F.box(paint, 4, g.hi, 0, 3.2, 1.6, 6, { u: 2 });
  }
  col(tin, WHITE); col(paint, WHITE); col(conc, WHITE);
}

/** A water-pump windmill: a steel lattice tower, a wheel of blades that turns, its tail, the tank at its foot. */
function buildWindmill(B, M, it, anims) {
  const gy = B.groundY(it.x, it.z);
  const paint = B.acc(M.paint), conc = B.acc(M.conc);
  const F = new Fr(it.x, gy, it.z, it.ry);
  const h = it.h;
  col(paint, lin('#8a8e92'));
  const legs = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
  for (const [sx, sz] of legs) beam(paint, F.p(sx * 1.6, -0.4, sz * 1.6), F.p(sx * 0.35, h, sz * 0.35), 0.1, 0.1);
  for (let k = 1; k < 5; k++) {
    const y = (k / 5) * h, hh = 1.6 + (0.35 - 1.6) * (k / 5);
    for (let e = 0; e < 4; e++) { const [ax, az] = legs[e], [bx, bz] = legs[(e + 1) % 4]; beam(paint, F.p(ax * hh, y, az * hh), F.p(bx * hh, y, bz * hh), 0.05, 0.05); }
  }
  // the head, the tail vane
  col(paint, lin('#5a5e62'));
  F.box(paint, 0, h, 0, 0.5, 0.5, 1.4, { u: 1 });
  beam(paint, F.p(0, h + 0.25, -0.4), F.p(0, h + 0.4, -3.4), 0.08, 0.08);
  col(paint, lin('#d8d4c8'));
  const T = [F.p(0, h - 0.3, -2.2), F.p(0, h - 0.3, -3.8), F.p(0, h + 1.2, -3.8), F.p(0, h + 0.7, -2.2)];
  paint.quadP(T[0], T[1], T[2], T[3]); paint.quadP(T[1], T[0], T[3], T[2]);
  // the stock tank
  col(conc, lin('#8a9094'));
  lathe(conc, F.wx(2.6, 1), gy - 0.3, F.wz(2.6, 1), [[1.6, 0], [1.6, 0.9], [1.45, 0.9], [1.45, 0.4]], 12, { u: 2 });
  col(paint, lin('#3a5a6a'));
  cylinder(paint, F.wx(2.6, 1), gy + 0.5, F.wz(2.6, 1), 1.45, 0.02, 12, { top: true });
  col(paint, WHITE); col(conc, WHITE);
  // the wheel: its own mesh, turning on the head's axis (local +z)
  const a = new Acc(true);
  const R = 1.5 + it.h * 0.05;
  a.col = lin('#c8c4b8');
  const n = 18;
  for (let k = 0; k < n; k++) {
    const t0 = (k / n) * Math.PI * 2, t1 = t0 + 0.22;
    const r0 = 0.35;
    const p = (r, t, z) => [Math.cos(t) * r, Math.sin(t) * r, z];
    a.quadP(p(r0, t0, 0), p(R, t0, 0.15), p(R, t1, 0.15), p(r0, t1, 0));
    a.quadP(p(r0, t1, 0), p(R, t1, 0.15), p(R, t0, 0.15), p(r0, t0, 0));
  }
  a.col = lin('#5a5e62');
  for (let k = 0; k < 8; k++) { const t = (k / 8) * Math.PI * 2; const q = [Math.cos(t), Math.sin(t)]; a.quadP([q[0] * 0.3, q[1] * 0.3, 0.05], [q[0] * R, q[1] * R, 0.12], [q[0] * R, q[1] * R, 0.2], [q[0] * 0.3, q[1] * 0.3, 0.13]); }
  const mesh = new THREE.Mesh(a.toGeometry(true), M.paint);
  const hp = F.p(0, h + 0.3, 0.9);
  mesh.position.set(hp[0], hp[1], hp[2]);
  mesh.rotation.order = 'YXZ';
  mesh.rotation.y = it.ry;
  mesh.matrixAutoUpdate = true;
  B.group.add(mesh);
  const speed = 1.2 + it.seed * 1.6;
  anims.push((t, dt, d) => { if (d < 700) mesh.rotation.z = -t * speed; });
}

function buildBales(B, M, it) {
  const paint = B.near(M.paint);
  const rng = makeRng('bales' + it.x.toFixed(1));
  const F = new Fr(it.x, 0, it.z, it.ry);
  for (let k = 0; k < it.n; k++) {
    const lx = -4 + (k % 4) * 2.2, lz = Math.floor(k / 4) * 1.8 - 1;
    const x = F.wx(lx, lz), z = F.wz(lx, lz);
    if (it.seed < 0.5) hayRound(paint, x, B.groundY(x, z) - 0.05, z, it.ry + Math.PI / 2, 0.75, rng() < 0.5 ? '#c8a54e' : '#b8984a');
    else { hayBlock(paint, x, B.groundY(x, z), z, it.ry); hayBlock(paint, x, B.groundY(x, z) + 0.45, z, it.ry + 0.1); }
  }
}

function buildFieldBales(B, M, it) {
  const paint = B.acc(M.paint);
  const F = new Fr(it.x, 0, it.z, it.ry);
  for (const [lx, lz, a] of it.pts) {
    const x = F.wx(lx, lz), z = F.wz(lx, lz);
    hayRound(paint, x, B.groundY(x, z) - 0.05, z, a, 0.8, '#c4a24c');
  }
}

function buildCows(B, M, it) {
  const paint = B.near(M.paint);
  const rng = makeRng('cows' + it.x.toFixed(1));
  for (let k = 0; k < it.n; k++) {
    const x = it.x + (rng() - 0.5) * 24, z = it.z + (rng() - 0.5) * 18, a = rng() * 6.28;
    const y = B.groundY(x, z);
    const F = new Fr(x, y, z, a);
    const hide = rng() < 0.5 ? '#1e1c1a' : rng() < 0.5 ? '#6a3a24' : '#e8e4dc';
    col(paint, lin('#2a2624'));
    for (const [lx, lz] of [[-0.35, 0.7], [0.35, 0.7], [-0.35, -0.7], [0.35, -0.7]]) F.box(paint, lx, 0, lz, 0.18, 0.8, 0.18, { u: 1 });
    col(paint, lin(hide));
    F.box(paint, 0, 0.75, 0, 0.9, 0.75, 2.0, { u: 1 });
    F.box(paint, 0, 1.0, 1.15, 0.5, 0.5, 0.6, { u: 1 });
    if (hide === '#1e1c1a') { col(paint, lin('#e8e4dc')); F.box(paint, 0.46, 0.95, -0.2, 0.02, 0.4, 0.8, { u: 1 }); }
  }
  col(paint, WHITE);
}

function buildYard(B, M, it) {
  drapeUV(B.acc(M.gravel), B, rectPoly(it.x, it.z, it.w * 0.62, it.d * 0.55, it.ry), { lift: 0.05, step: 8, uv: 4 });
}

function buildPaddockFence(B, M, it) {
  const trunk = B.acc(M.trunk), paint = B.acc(M.paint);
  const F = new Fr(it.x, 0, it.z, it.ry);
  // round the back half of the lot (the front is the yard, open to the road)
  const pts = [[-it.w / 2, 4], [-it.w / 2, -it.d / 2], [it.w / 2, -it.d / 2], [it.w / 2, 4]].map(([lx, lz]) => [F.wx(lx, lz), F.wz(lx, lz)]);
  trunk.col = lin('#8a7a62');
  col(paint, lin('#6a6460'));
  fence(trunk, paint, pts, (x, z) => B.groundY(x, z), { every: 3.5, post: [0.14, 1.3], rails: [[0.6, 0.03], [1.0, 0.03], [1.25, 0.03]], wire: true });
  trunk.col = WHITE; col(paint, WHITE);
}

// ------------------------------------------------------------------ build: the airfield, the drive-in

function buildApron(B, M, it) {
  drapeUV(B.acc(M.conc), B, rectPoly(it.x, it.z, it.w, it.d, it.ry), { lift: 0.06, step: 10, uv: 8, col: lin('#c8c4b8') });
  const paint = B.acc(M.paint);
  col(paint, lin('#e8d050'));
  const F = new Fr(it.x, 0, it.z, it.ry);
  for (let k = -3; k <= 3; k++) {
    const lx = k * 22;
    for (let j = 0; j < 6; j++) {
      const lz = -it.d / 2 + 6 + j * 8;
      const x = F.wx(lx, lz), z = F.wz(lx, lz);
      box(paint, x, B.groundY(x, z) + 0.04, z, 0.3, 0.04, 4, it.ry, { u: 1, faces: '' });
    }
  }
  col(paint, WHITE);
}

function buildHangar(B, M, it) {
  const F = new Fr(it.x, 0, it.z, it.ry);
  const g = B.footY(it.x, it.z, it.w, it.d, it.ry);
  const tin = B.acc(M.tin), wall = B.acc(M.wall), paint = B.acc(M.paint);
  // an arched hangar: the vault along local z (it.d), its doors on the front (+z)
  col(tin, lin('#a8aca8'));
  quonset(tin, false, it.x, g.hi, it.z, it.d, it.w, it.ry + Math.PI / 2, { seg: 12, rise: it.h });
  // the gable fronts: tin with the doors (half open on one)
  col(wall, WHITE);
  for (const sz of [1, -1]) {
    const ids = [];
    const c = wall.v(...F.p(0, g.hi, sz * it.d / 2), 0.25, 4 / BANDS);
    for (let k = 0; k <= 12; k++) { const a = Math.PI * (k / 12); ids.push(wall.v(...F.p(Math.cos(a) * it.w / 2, g.hi + Math.sin(a) * it.h, sz * it.d / 2), 0.25 + Math.cos(a) * 0.2, (4 + Math.sin(a) * 0.9) / BANDS)); }
    for (let k = 0; k < 12; k++) { if (sz > 0) wall.tri(c, ids[k], ids[k + 1]); else wall.tri(c, ids[k + 1], ids[k]); }
  }
  col(paint, lin('#1a1c1e'));
  F.box(paint, it.seed < 0.5 ? -4 : 4, g.hi, it.d / 2 + 0.05, it.w * 0.45, it.h * 0.62, 0.1, { u: 1 });
  col(paint, lin('#c8261e'));
  F.box(paint, 0, g.hi + it.h * 0.72, it.d / 2 + 0.06, it.w * 0.3, 1.2, 0.06, { u: 1 });
  col(tin, WHITE); col(wall, WHITE); col(paint, WHITE);
}

function buildCtower(B, M, it) {
  const F = new Fr(it.x, 0, it.z, it.ry);
  const g = B.footY(it.x, it.z, it.w, it.d, it.ry);
  const conc = B.acc(M.conc), paint = B.acc(M.paint), win = B.acc(M.lamp);
  col(conc, lin('#d8d0c0'));
  F.box(conc, 0, g.lo - 1, 0, it.w, it.h - 3 + (g.hi - g.lo) + 1, it.d, { u: 3 });
  // the cab: dark glass, sloped, a few panes still lit, a gallery
  const y = g.hi + it.h - 3;
  col(paint, lin('#2a3238'));
  F.box(paint, 0, y, 0, it.w + 1.6, 3.2, it.d + 1.6, { u: 2, top: false });
  F.box(win, -1.5, y + 0.6, (it.d + 1.6) / 2 + 0.02, 2.2, 1.6, 0.04, { u: 1, top: false });
  col(conc, lin('#c8c0b0'));
  F.box(conc, 0, y - 0.3, 0, it.w + 3, 0.3, it.d + 3, { u: 2 });
  F.box(conc, 0, y + 3.2, 0, it.w + 2.2, 0.4, it.d + 2.2, { u: 2 });
  col(paint, lin('#3a3a3a'));
  cylinder(paint, it.x, y + 3.6, it.z, 0.06, 2.4, 4);
  col(conc, WHITE); col(paint, WHITE);
}

function buildBeacon(B, M, it, anims) {
  const g = new THREE.CylinderGeometry(0.35, 0.35, 0.5, 8);
  const m = new THREE.Mesh(g, M.flood);
  m.position.set(it.x, it.y + 0.3, it.z);
  m.matrixAutoUpdate = true;
  B.group.add(m);
  anims.push((t) => { m.visible = (t % 4) < 0.25 || ((t % 4) > 0.5 && (t % 4) < 0.75); });
}

function buildWreck(B, M, it) {
  // a twin-engined airliner of the old kind: fuselage on its belly, broken behind the wing, one wing torn off
  const paint = B.acc(M.paint);
  const gy = B.groundY(it.x, it.z);
  const F = new Fr(it.x, gy, it.z, it.ry);
  col(paint, lin('#b8bcbc'));
  tube(paint, F.p(0, 1.6, 9.5), F.p(0, 1.5, 2), 1.5, 10, { r2: 1.6, caps: true });
  tube(paint, F.p(0.1, 1.45, 1.6), F.p(0.6, 1.2, -6), 1.5, 10, { r2: 0.7, caps: true });
  col(paint, lin('#a8aaaa'));
  tube(paint, F.p(0, 1.6, 9.5), F.p(0, 1.4, 11.2), 1.5, 10, { r2: 0.5, caps: true });
  // the tail fin (leaning), the stabiliser
  const T = [F.p(0.6, 1.8, -5.6), F.p(0.7, 1.8, -3.2), F.p(1.4, 5.0, -6.4), F.p(1.2, 5.0, -7.0)];
  paint.quadP(T[0], T[1], T[2], T[3]); paint.quadP(T[1], T[0], T[3], T[2]);
  col(paint, lin('#b0b2b2'));
  for (const sx of [-1, 1]) { const S = [F.p(0.6, 1.5, -5.2), F.p(0.6, 1.5, -6.6), F.p(0.6 + sx * 4.2, 1.3, -6.8), F.p(0.6 + sx * 4.2, 1.3, -6.0)]; paint.quadP(S[0], S[1], S[2], S[3]); paint.quadP(S[1], S[0], S[3], S[2]); }
  // the right wing still on, an engine; the left one torn off lying beside
  col(paint, lin('#b8bcbc'));
  const wing = (A, Bq, C, D) => { paint.quadP(A, Bq, C, D); paint.quadP(Bq, A, D, C); };
  wing(F.p(1.3, 0.9, 6), F.p(1.3, 0.9, 2.2), F.p(13, 0.2, 3.6), F.p(13, 0.2, 5.4));
  col(paint, lin('#5a5e60'));
  tube(paint, F.p(4.6, 1.0, 7.2), F.p(4.6, 1.0, 3.2), 0.8, 8, { caps: true });
  col(paint, lin('#a0a4a4'));
  wing(F.p(-5, 0.15, 7), F.p(-5.5, 0.15, 3), F.p(-14, 0.2, 2.2), F.p(-13.5, 0.2, 4.6));
  // the windows: a dark band; rust where the paint's gone
  col(paint, lin('#1a1e22'));
  F.box(paint, 1.48, 1.9, 6, 0.04, 0.4, 5.5, { u: 1 });
  F.box(paint, -1.48, 1.9, 6, 0.04, 0.4, 5.5, { u: 1 });
  col(paint, lin('#6a3a24'));
  F.box(paint, 0, 0.2, 2.0, 2.6, 1.2, 0.6, { u: 1 });
  col(paint, WHITE);
}

function buildDriveIn(B, M, it) {
  const F = new Fr(it.x, 0, it.z, it.ry);
  // the lot: gravel, ramps in arcs facing the screen, speaker posts
  drapeUV(B.acc(M.gravel), B, rectPoly(it.x, it.z, it.w, it.d, it.ry), { lift: 0.05, step: 8, uv: 4 });
  const paint = B.acc(M.paint), conc = B.acc(M.conc);
  const sy = -it.d / 2 + 3;              // the screen's line (local z)
  for (let row = 0; row < 6; row++) {
    const R = 28 + row * 10;
    col(conc, lin('#9a948a'));
    for (let a = -0.85; a < 0.85; a += 0.07) {
      const a1 = Math.min(0.85, a + 0.07);
      const P = (ang, dr, up) => { const lx = Math.sin(ang) * (R + dr), lz = sy + Math.cos(ang) * (R + dr); const x = F.wx(lx, lz), z = F.wz(lx, lz); return [x, B.groundY(x, z) + up, z]; };
      // a hump: the ramp that tips the cars' noses up
      conc.quadP(P(a1, -1.6, 0.03), P(a, -1.6, 0.03), P(a, 0, 0.45), P(a1, 0, 0.45));
      conc.quadP(P(a1, 0, 0.45), P(a, 0, 0.45), P(a, 1.2, 0.03), P(a1, 1.2, 0.03));
    }
    col(paint, lin('#4a4e52'));
    for (let a = -0.8; a <= 0.8; a += 0.16) {
      const lx = Math.sin(a) * (R + 2.4), lz = sy + Math.cos(a) * (R + 2.4);
      const x = F.wx(lx, lz), z = F.wz(lx, lz), y = B.groundY(x, z);
      box(paint, x, y - 0.2, z, 0.1, 1.3, 0.1, 0, { u: 1 });
      box(paint, x, y + 0.95, z, 0.3, 0.25, 0.18, it.ry, { u: 1 });
    }
  }
  // a few cars in for the late show
  const cols = ['#8a2a22', '#e8e2d0', '#2a4a6a', '#1e1e20', '#5a7a8a', '#c8a020'];
  for (let k = 0; k < 9; k++) {
    const row = k % 5, a = -0.6 + ((k * 0.37) % 1.2);
    const R = 28 + row * 10 + 3.2;
    const lx = Math.sin(a) * R, lz = sy + Math.cos(a) * R;
    const x = F.wx(lx, lz), z = F.wz(lx, lz);
    sedan(paint, x, B.groundY(x, z) + 0.2, z, it.ry + Math.PI + a, cols[k % cols.length]);
  }
  // the screen: a tall frame of timber and steel, the picture facing the lot
  const W = 34, H = 15, y0 = B.groundY(F.wx(0, sy), F.wz(0, sy)) + 6;
  col(paint, lin('#d8d0c4'));
  F.box(paint, 0, y0 - 6.5, sy - 0.6, W + 2, 6.5, 1.0, { u: 2 });
  col(paint, lin('#5a5048'));
  for (let k = 0; k <= 6; k++) beam(paint, F.p(-W / 2 + (k * W) / 6, y0 - 6.5, sy - 3.5), F.p(-W / 2 + (k * W) / 6, y0 + H + 1, sy - 0.8), 0.3, 0.3);
  col(paint, lin('#e8e2d8'));
  F.box(paint, 0, y0 - 0.4, sy - 0.75, W + 1.6, H + 1.4, 0.5, { u: 2 });
  B.acc(M.screen).quadP(F.p(-W / 2, y0, sy - 0.48), F.p(W / 2, y0, sy - 0.48), F.p(W / 2, y0 + H, sy - 0.48), F.p(-W / 2, y0 + H, sy - 0.48), [0, 0, 1, 1]);
  // the snack bar and projection booth
  const wall = B.acc(M.wall), roof = B.acc(M.roof);
  const bx = F.wx(0, 20), bz = F.wz(0, 20), by = B.groundY(bx, bz) + 0.2;
  col(wall, WHITE);
  storey(wall, bx, by, bz, 16, 10, it.ry + Math.PI, 5);
  col(roof, lin('#c8322a'));
  F.box(roof, 0, by + STOREY, 20, 17, 0.4, 11, { u: 2 });
  col(wall, lin('#e8e0d0'));
  storey(wall, F.wx(0, 22), by + STOREY + 0.4, F.wz(0, 22), 5, 4, it.ry + Math.PI, 5, 'lrb');
  const lamp = B.acc(M.lamp);
  F.box(lamp, 0, by + STOREY + 1.9, 20 - 0.05, 1.2, 0.8, 0.1, { u: 1, top: false });
  col(wall, WHITE); col(roof, WHITE); col(paint, WHITE); col(conc, WHITE);
}

function buildDriveFence(B, M, it) {
  const trunk = B.acc(M.trunk), paint = B.acc(M.paint);
  trunk.col = lin('#7a6a54');
  col(paint, lin('#8a7a62'));
  fence(trunk, paint, it.pts, (x, z) => B.groundY(x, z), { every: 3, post: [0.15, 2.0], rails: [[0.5, 0.14], [1.2, 0.14], [1.85, 0.14]] });
  trunk.col = WHITE; col(paint, WHITE);
}

function buildMarquee(B, M, it) {
  const F = new Fr(it.x, B.groundY(it.x, it.z), it.z, it.ry);
  const paint = B.acc(M.paint), sign = B.acc(M.sign);
  col(paint, lin('#2a2c30'));
  F.box(paint, 0, -0.5, 0, 0.6, 9.5, 0.6, { u: 1 });
  // the star on top, the board, the NOW SHOWING letters
  col(paint, lin('#1a1e2a'));
  F.box(paint, 0, 6.0, -0.1, 9.2, 3.0, 0.4, { u: 1 });
  signPanel(sign, F, 0, 6.2, 0.12, 8.8, 2.2, 0);
  signPanel(sign, new Fr(F.x, F.y, F.z, it.ry + Math.PI), 0, 6.2, 0.32, 8.8, 2.2, 0);
  F.box(paint, 0, 3.6, -0.1, 7.6, 2.2, 0.3, { u: 1 });
  signPanel(sign, F, 0, 3.7, 0.06, 7.2, 1.9, 5);
  signPanel(sign, new Fr(F.x, F.y, F.z, it.ry + Math.PI), 0, 3.7, 0.26, 7.2, 1.9, 5);
  const lamp = B.acc(M.lamp);
  for (let k = 0; k < 5; k++) { const a = (k / 5) * Math.PI * 2 + Math.PI / 2; F.box(lamp, Math.cos(a) * 0.9, 9.6 + Math.sin(a) * 0.9, 0, 0.35, 0.35, 0.3, { u: 1 }); }
  F.box(lamp, 0, 9.5, 0, 0.7, 0.7, 0.35, { u: 1 });
  col(paint, WHITE);
}

function buildSign(B, M, it) {
  const F = new Fr(it.x, 0, it.z, it.ry);
  const gy = B.groundY(it.x, it.z);
  const paint = B.acc(M.paint);
  col(paint, lin('#5a4a3a'));
  for (const sx of [-1, 1]) F.box(paint, sx * (it.w / 2 - 0.2), gy - 0.4, 0, 0.16, it.post + it.h + 0.5, 0.16, { u: 1 });
  const sacc = B.acc(M.sign);
  signPanel(sacc, F, 0, gy + it.post, 0.05, it.w, it.h, it.slot);
  signPanel(sacc, new Fr(it.x, 0, it.z, it.ry + Math.PI), 0, gy + it.post, 0.05, it.w, it.h, it.slot);
  col(paint, WHITE);
}

// ------------------------------------------------------------------ scatter

function scatter(S) {
  // field-edge oaks, bushes along the tracks, the odd stone; nothing in the fields
  for (const [x, z] of S.points(30, { r: 5, density: (px, pz) => 0.2 + 0.25 * S.noise(px / 300, pz / 300) })) {
    const y = S.groundY(x, z);
    const u = S.rng();
    if (u < 0.35) { S.add({ type: 'oak', x, z, y, s: S.range(1.0, 1.7), t: S.rng() }); S.collider({ kind: 'circle', x, z, r: 0.6, y0: y - 1, y1: y + 6 }); }
    else if (u < 0.85) S.add({ type: 'bush', x, z, y, s: S.range(0.6, 1.4), t: S.rng() });
    else S.add({ type: 'rock', x, z, y, s: S.range(0.4, 0.9), t: S.rng() });
  }
}

// ------------------------------------------------------------------ the pack

export default {
  id: ID,

  plan(P) {
    planRailway(P);
    planElevator(P);
    planAirfield(P);
    planDriveIn(P);
    planCropCircle(P);
    planFarms(P);
    planFields(P);
  },

  scatter,

  warm(B) { mats(B); },

  *build(B, items) {
    const M = mats(B);
    const anims = B.out.anims;
    let n = 0;
    for (const it of items) {
      switch (it.type) {
        case 'field': buildField(B, M, it); break;
        case 'circle': buildCircle(B, M, it); break;
        case 'rails': buildRails(B, M, it); break;
        case 'crossing': buildCrossing(B, M, it); break;
        case 'flasher': buildFlasher(B, M, it, anims); break;
        case 'tpole': buildTelegraph(B, M, it); break;
        case 'silos': buildSilos(B, M, it); yield; break;
        case 'headhouse': buildHeadhouse(B, M, it); break;
        case 'bin': buildBin(B, M, it); break;
        case 'loadshed': buildLoadShed(B, M, it); break;
        case 'hoppers': buildHoppers(B, M, it); break;
        case 'office': buildFarmhouse(B, M, { ...it, seed: 0.9 }); break;
        case 'farmhouse': buildFarmhouse(B, M, it); break;
        case 'barn': buildBarn(B, M, it); break;
        case 'silo': buildSilo(B, M, it); break;
        case 'shed': buildShed(B, M, it); break;
        case 'windmill': buildWindmill(B, M, it, anims); break;
        case 'bales': buildBales(B, M, it); break;
        case 'fieldbales': buildFieldBales(B, M, it); break;
        case 'cows': buildCows(B, M, it); break;
        case 'yard': buildYard(B, M, it); break;
        case 'paddock': buildPaddockFence(B, M, it); break;
        case 'tractor': tractor(B.acc(M.paint), it.x, B.groundY(it.x, it.z), it.z, it.ry, it.body); break;
        case 'pickup': pickup(B.acc(M.paint), it.x, B.groundY(it.x, it.z), it.z, it.ry, it.body); break;
        case 'poplar': poplar(B.acc(M.trunk), B.acc(M.leaf), it.x, it.y, it.z, it.h, it.t); break;
        case 'oak': oak(B.acc(M.trunk), B.acc(M.leaf), it.x, it.y, it.z, it.s, it.t); break;
        case 'bush': bush(B.near(M.leaf), it.x, it.y, it.z, it.s, it.t, '#4e6a2c'); break;
        case 'rock': rock(B.near(M.conc), it.x, it.y, it.z, it.s, it.t, '#9a958a'); break;
        case 'apron': buildApron(B, M, it); break;
        case 'hangar': buildHangar(B, M, it); break;
        case 'ctower': buildCtower(B, M, it); break;
        case 'beacon': buildBeacon(B, M, it, anims); break;
        case 'fueltank': {
          const p = B.acc(M.paint), gy = B.groundY(it.x, it.z), F = new Fr(it.x, gy, it.z, it.ry);
          col(p, lin('#d8d8d0'));
          tube(p, F.p(-4.5, 1.9, 0), F.p(4.5, 1.9, 0), 1.6, 10, { caps: true });
          col(p, lin('#6a6a62'));
          for (const lx of [-3, 0, 3]) F.box(p, lx, -0.3, 0, 0.4, 0.9, 2.4, { u: 1 });
          col(p, WHITE);
          break;
        }
        case 'windsock': {
          const p = B.acc(M.paint), gy = B.groundY(it.x, it.z);
          col(p, lin('#d8d8d0'));
          cylinder(p, it.x, gy - 0.3, it.z, 0.07, 6.3, 5);
          col(p, lin('#ff6a1a'));
          tube(p, [it.x, gy + 5.8, it.z], [it.x + 2.6, gy + 5.0, it.z + 1.0], 0.45, 7, { r2: 0.22 });
          col(p, WHITE);
          break;
        }
        case 'edgelight': {
          const gy = B.groundY(it.x, it.z);
          box(B.near(M.paint), it.x, gy - 0.1, it.z, 0.25, 0.5, 0.25, 0, { u: 1 });
          if (it.lit) box(B.near(M.lamp), it.x, gy + 0.4, it.z, 0.22, 0.18, 0.22, 0, { u: 1 });
          break;
        }
        case 'wreck': buildWreck(B, M, it); break;
        case 'drivein': buildDriveIn(B, M, it); yield; break;
        case 'dfence': buildDriveFence(B, M, it); break;
        case 'marquee': buildMarquee(B, M, it); break;
        case 'sign': buildSign(B, M, it); break;
        case 'r-pole': buildPole(B, M, { ...it, kind: it.kind === 'yard' ? 'steel' : it.kind }); if (it.kind === 'yard') box(B.near(M.yard), it.x, B.groundY(it.x, it.z) + it.h - 0.14, it.z, 0.8, 0.06, 0.36, 0, { u: 1, faces: '', top: false, bottom: true }); break;
        default: break;
      }
      if (++n % 20 === 0) yield;
    }
  },
};

void cone; void windowPane; void text; void wallAlong; void lattice2; void drum; void speckle;
