// PORT HALCYON — HALCYON LAKE: a reservoir in the mountains behind the
// Halcyon Dam. The dam is the landmark: a curved concrete face dropping into
// the river gorge, the spillway pouring down its middle into a plunge pool,
// two art-deco intake towers standing in the lake on footbridges, gate piers
// and a hoist house on the crest, the powerhouse at the toe, a lit walkway
// along the crest and floodlights on the face at night. Round the shore: log
// cabins and A-frames with porch lights, the marina (docks, boats,
// boathouses, a bait shop), Pinecone Campground (tents, campers, campfires)
// down the camp road and, at its end, the fishing jetty at Heron Point.
// Dark pines everywhere, granite boulders on the shore.
import * as THREE from 'three';
import { litMat, plainMat, glowColorMat, box, cylinder, cone, sphere, gable } from './builder.js';
import { LAKE, LAKE_Y } from '../map/base.js';
import { plankTexture } from '../kit.js';
import { concreteTexture, toTex } from '../../track/textures.js';
import { makeRng } from '../../core/util.js';
import { owns, toWorld, lin, nearOnLine, rectPoly, hash2 } from './westkit/util.js';
import { Fr, tube, lathe, beam, quad2, wallAlong, fence, drapeUV, col, fan } from './westkit/geo.js';
import { bandAtlas, windowPane, roofTex, signAtlas, text, speckle, streaks, cvs, once } from './westkit/tex.js';
import { pine, fir, bush, rock, log as fallenLog } from './westkit/veg.js';
import { pickup, sedan, boat, picnicTable, bench, tent, camper, canoe, drum, crate } from './westkit/props.js';

const ID = 'lake';
const IRON = { x0: -4400, z0: -995, x1: -3050, z1: -330 };
const inIron = (x, z) => x > IRON.x0 - 12 && x < IRON.x1 + 12 && z > IRON.z0 - 12 && z < IRON.z1 + 12;
const mine = (x, z) => owns(ID, x, z) && !inIron(x, z);
const WHITE = [1, 1, 1];
const STOREY = 3;
const BANDS = 6;   // atlas: 0 logs+windows, 1 logs, 2 boards+windows, 3 boards+boat door, 4 deco concrete, 5 shopfront

// ------------------------------------------------------------------ textures

function wallAtlas() {
  return bandAtlas('lake-walls', 512, 160, [
    // 0: logs with two windows per 8 m
    (x, e, W, H, rng) => { logs(x, W, H, rng); for (const wx of [96, 352]) windowPane(x, e, wx, 52, 70, 64, rng() < 0.55, rng, { frame: '#d8cfb8', panes: 2 }); },
    // 1: plain logs
    (x, e, W, H, rng) => logs(x, W, H, rng),
    // 2: board and batten (light: tinted by the vertex colour) with windows
    (x, e, W, H, rng) => { boards(x, W, H, rng); for (const wx of [80, 336]) windowPane(x, e, wx, 50, 76, 66, rng() < 0.5, rng, { frame: '#f2efe6', panes: 3 }); },
    // 3: board and batten with a big boathouse door in the middle
    (x, e, W, H, rng) => {
      boards(x, W, H, rng);
      x.fillStyle = '#3a3026'; x.fillRect(150, 30, 212, H - 30);
      for (let k = 0; k < 7; k++) { x.fillStyle = k % 2 ? '#4a3c30' : '#423528'; x.fillRect(150, 30 + k * 18, 212, 18); }
      x.fillStyle = '#efe9da'; x.fillRect(144, 24, 224, 6); x.fillRect(144, 24, 6, H - 24); x.fillRect(362, 24, 6, H - 24);
      windowPane(x, e, 40, 50, 56, 56, rng() < 0.4, rng, { frame: '#f2efe6' });
      windowPane(x, e, 416, 50, 56, 56, rng() < 0.4, rng, { frame: '#f2efe6' });
    },
    // 4: art-deco concrete with tall ribbed windows (the dam's buildings)
    (x, e, W, H, rng) => {
      x.fillStyle = '#b9b4a8'; x.fillRect(0, 0, W, H);
      speckle(x, W, H, rng, 2500, ['#8a867c', '#d6d2c6'], 0.1, 0.3);
      for (let k = 0; k < 4; k++) {
        const wx = 24 + k * 128;
        x.fillStyle = '#9d988c'; x.fillRect(wx - 10, 0, 6, H);
        const lit = rng() < 0.5;
        const g = x.createLinearGradient(0, 14, 0, H - 14);
        g.addColorStop(0, lit ? '#dfeaff' : '#22303a'); g.addColorStop(1, lit ? '#a9c4e8' : '#1a242c');
        x.fillStyle = g; x.fillRect(wx + 8, 14, 80, H - 28);
        x.fillStyle = '#6e6a60';
        for (let r = 0; r < 4; r++) x.fillRect(wx + 8, 14 + r * (H - 28) / 4, 80, 3);
        x.fillRect(wx + 46, 14, 3, H - 28);
        if (lit) { e.fillStyle = '#b8ccf0'; e.globalAlpha = 0.5; e.fillRect(wx + 8, 14, 80, H - 28); e.globalAlpha = 1; }
      }
      streaks(x, W, H, rng, 14, '60,55,45', 0.12);
    },
    // 5: shopfront (the bait shop): a wide lit window, a door
    (x, e, W, H, rng) => {
      boards(x, W, H, rng);
      x.fillStyle = '#2a2420'; x.fillRect(40, 30, 300, 104);
      const g = x.createLinearGradient(0, 30, 0, 134);
      g.addColorStop(0, '#ffe2a8'); g.addColorStop(1, '#e8a860');
      x.fillStyle = g; x.fillRect(46, 36, 288, 92);
      for (let k = 0; k < 14; k++) { x.fillStyle = ['#c8322a', '#2a6ac8', '#e8c22a', '#3a9a4a'][k % 4]; x.fillRect(56 + k * 19, 96, 12, 26); }
      e.fillStyle = '#ffcc88'; e.globalAlpha = 0.9; e.fillRect(46, 36, 288, 92); e.globalAlpha = 1;
      text(x, 'OPEN', 120, 60, 26, '#ff3a3a'); text(e, 'OPEN', 120, 60, 26, '#ff6a6a', { glow: '#ff3a3a' });
      x.fillStyle = '#3a2a20'; x.fillRect(380, 40, 80, H - 40);
      x.fillStyle = '#ffd890'; x.fillRect(392, 52, 56, 50); e.fillStyle = '#ffcc88'; e.fillRect(392, 52, 56, 50);
    },
  ]);
}

function logs(x, W, H, rng) {
  const lh = 16;
  for (let y = 0; y < H; y += lh) {
    const t = 0.85 + rng() * 0.25;
    const g = x.createLinearGradient(0, y, 0, y + lh);
    g.addColorStop(0, `rgb(${120 * t},${82 * t},${52 * t})`);
    g.addColorStop(0.45, `rgb(${150 * t},${104 * t},${66 * t})`);
    g.addColorStop(1, `rgb(${70 * t},${46 * t},${30 * t})`);
    x.fillStyle = g;
    x.fillRect(0, y, W, lh);
    x.fillStyle = 'rgba(230,220,200,0.35)';
    x.fillRect(0, y + lh - 2, W, 2);           // chinking
    for (let k = 0; k < 6; k++) { x.fillStyle = 'rgba(40,24,12,0.25)'; x.fillRect(rng() * W, y + 3 + rng() * 8, 20 + rng() * 60, 1); }
  }
  // the log ends at the corners
  for (const cx of [0, W - 10]) for (let y = 0; y < H; y += lh) { x.fillStyle = '#c8a070'; x.beginPath(); x.arc(cx + 5, y + lh / 2, 6, 0, 6.283); x.fill(); }
}

function boards(x, W, H, rng) {
  x.fillStyle = '#d6d2c8';
  x.fillRect(0, 0, W, H);
  for (let px = 0; px < W; px += 32) {
    x.fillStyle = `rgba(0,0,0,${0.05 + rng() * 0.06})`; x.fillRect(px, 0, 32, H);
    x.fillStyle = '#ece9e2'; x.fillRect(px, 0, 6, H);
    x.fillStyle = 'rgba(0,0,0,0.25)'; x.fillRect(px + 6, 0, 2, H);
  }
  speckle(x, W, H, rng, 1500, ['#000', '#fff'], 0.03, 0.12);
  streaks(x, W, H, rng, 10, '60,50,40', 0.1);
}

/** The dam's face: board-marked concrete in 16 m bays, lift joints, seepage and calcite streaks. */
function damTex() {
  return once('lake:damface', () => {
    const [c, x] = cvs(512, 512);
    const rng = makeRng('damface');
    x.fillStyle = '#a9a69e';
    x.fillRect(0, 0, 512, 512);
    speckle(x, 512, 512, rng, 16000, ['#8e8b84', '#c4c1b9', '#9d9a92'], 0.15, 0.45);
    // lift joints every 1.6 m (32 px/m), formwork board marks
    for (let y = 0; y < 512; y += 51) { x.fillStyle = 'rgba(40,38,34,0.35)'; x.fillRect(0, y, 512, 2); x.fillStyle = 'rgba(255,255,255,0.12)'; x.fillRect(0, y + 2, 512, 1); }
    for (let y = 0; y < 512; y += 9) { x.fillStyle = 'rgba(0,0,0,0.04)'; x.fillRect(0, y, 512, 1); }
    // the bay joint at the tile's edge
    x.fillStyle = 'rgba(30,28,24,0.55)'; x.fillRect(0, 0, 3, 512);
    // seepage (dark) and calcite (white) streaks running down
    for (let i = 0; i < 26; i++) {
      const sx = rng() * 512, w = 2 + rng() * 10, sy = rng() * 300, dark = rng() < 0.65;
      const g = x.createLinearGradient(0, sy, 0, 512);
      g.addColorStop(0, dark ? 'rgba(50,46,38,0.35)' : 'rgba(250,250,245,0.3)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      x.fillStyle = g; x.fillRect(sx, sy, w, 512 - sy);
    }
    // drain holes
    for (let k = 0; k < 6; k++) { x.fillStyle = '#2a2826'; x.fillRect(40 + k * 80, 120, 6, 6); x.fillRect(40 + k * 80, 380, 6, 6); }
    return toTex(c);
  });
}

/** White water: streaky foam that scrolls down the spillway. */
function foamTex() {
  return once('lake:foam', () => {
    const [c, x] = cvs(128, 256);
    const rng = makeRng('foam');
    x.fillStyle = 'rgba(200,220,235,0.55)';
    x.fillRect(0, 0, 128, 256);
    for (let i = 0; i < 700; i++) {
      const px = rng() * 128, py = rng() * 256, l = 8 + rng() * 40;
      x.fillStyle = `rgba(255,255,255,${0.3 + rng() * 0.6})`;
      x.fillRect(px, py, 1 + rng() * 3, l);
    }
    for (let i = 0; i < 40; i++) { x.fillStyle = 'rgba(120,150,170,0.35)'; x.fillRect(rng() * 128, rng() * 256, 2 + rng() * 6, 20 + rng() * 60); }
    return toTex(c);
  });
}

function signs() {
  return signAtlas('lake', [
    // 0 HALCYON MARINA
    (x, e, w, h) => {
      x.fillStyle = '#10243a'; x.fillRect(0, 0, w, h);
      x.strokeStyle = '#e8f0ff'; x.lineWidth = 6; x.strokeRect(8, 8, w - 16, h - 16);
      text(x, 'HALCYON MARINA', w / 2, 56, 54, '#e8f6ff', { max: w - 40 });
      text(x, 'BOATS · SLIPS · FUEL', w / 2, 100, 22, '#7ad0ff', { w: 700, f: 'Arial, sans-serif' });
      text(e, 'HALCYON MARINA', w / 2, 56, 54, '#9fe0ff', { max: w - 40, glow: '#40c0ff', blur: 18 });
      text(e, 'BOATS · SLIPS · FUEL', w / 2, 100, 22, '#40c0ff', { w: 700, f: 'Arial, sans-serif' });
    },
    // 1 BAIT TACKLE ICE
    (x, e, w, h) => {
      x.fillStyle = '#f0e6c8'; x.fillRect(0, 0, w, h);
      text(x, 'BAIT · TACKLE · ICE', w / 2, h / 2, 50, '#a82418', { max: w - 30 });
      e.globalAlpha = 0.5; e.fillStyle = '#f0e6c8'; e.fillRect(0, 0, w, h); e.globalAlpha = 1;
    },
    // 2 PINECONE CAMPGROUND (carved wood)
    (x, e, w, h) => {
      x.fillStyle = '#5a3a22'; x.fillRect(0, 0, w, h);
      for (let k = 0; k < 8; k++) { x.fillStyle = 'rgba(0,0,0,0.12)'; x.fillRect(0, k * 16, w, 2); }
      text(x, 'PINECONE', w / 2, 48, 60, '#f4e2b8', { max: w - 30, stroke: 4, sc: '#2a1a0c' });
      text(x, 'CAMPGROUND', w / 2, 100, 34, '#f4e2b8', { max: w - 30 });
      e.globalAlpha = 0.35; text(e, 'PINECONE', w / 2, 48, 60, '#ffd890', { max: w - 30 }); text(e, 'CAMPGROUND', w / 2, 100, 34, '#ffd890', { max: w - 30 }); e.globalAlpha = 1;
    },
    // 3 HALCYON DAM 1938 (bronze letters on concrete)
    (x, e, w, h) => {
      x.fillStyle = '#a9a69e'; x.fillRect(0, 0, w, h);
      text(x, 'HALCYON  DAM', w / 2, 58, 78, '#7a5a2a', { max: w - 20, stroke: 3, sc: '#3a2a10' });
      text(x, '· 1938 ·', w / 2, 110, 22, '#5a4220', { w: 700 });
      text(e, 'HALCYON  DAM', w / 2, 58, 78, '#ffd8a0', { max: w - 20, glow: '#ffb060', blur: 10 });
    },
    // 4 HERON POINT
    (x, e, w, h) => {
      x.fillStyle = '#2e4a3a'; x.fillRect(0, 0, w, h);
      x.strokeStyle = '#e8e2c8'; x.lineWidth = 5; x.strokeRect(10, 10, w - 20, h - 20);
      text(x, 'HERON POINT', w / 2, 54, 52, '#f2ead0', { max: w - 40 });
      text(x, 'NO WAKE · CATCH & RELEASE', w / 2, 98, 20, '#f2ead0', { w: 700, f: 'Arial, sans-serif' });
    },
    // 5 GAS DIESEL
    (x, e, w, h) => {
      x.fillStyle = '#c8261e'; x.fillRect(0, 0, w, h);
      text(x, 'GAS · DIESEL', w / 2, h / 2, 64, '#ffffff', { max: w - 30 });
      text(e, 'GAS · DIESEL', w / 2, h / 2, 64, '#ff9a8a', { max: w - 30, glow: '#ff3a2a' });
    },
    // 6 WELCOME TO HALCYON LAKE
    (x, e, w, h) => {
      const g = x.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, '#1d3a2a'); g.addColorStop(1, '#0e2018');
      x.fillStyle = g; x.fillRect(0, 0, w, h);
      x.fillStyle = '#e8e0c4';
      // a little pine and mountain silhouette
      x.beginPath(); x.moveTo(20, 110); x.lineTo(60, 40); x.lineTo(100, 110); x.fill();
      text(x, 'HALCYON LAKE', w / 2 + 40, 52, 50, '#f0e8cc', { max: w - 150 });
      text(x, 'ELEV. 1,710 FT · RESERVOIR', w / 2 + 40, 98, 20, '#c8d8b8', { w: 700, f: 'Arial, sans-serif' });
    },
    // 7 VACANCY (neon, the cabins office)
    (x, e, w, h) => {
      x.fillStyle = '#1a1414'; x.fillRect(0, 0, w, h);
      text(x, 'LAKESIDE CABINS', w / 2, 44, 40, '#ffe0b0', { max: w - 30 });
      text(x, 'VACANCY', w / 2, 96, 40, '#ff3a5a');
      text(e, 'LAKESIDE CABINS', w / 2, 44, 40, '#ffc880', { max: w - 30, glow: '#ff9a40' });
      text(e, 'VACANCY', w / 2, 96, 40, '#ff4a6a', { glow: '#ff2a4a', blur: 20 });
    },
  ]);
}

// ------------------------------------------------------------------ materials

function mats(B) {
  return {
    wall: B.mat('wall', () => { const t = wallAtlas(); return litMat({ map: t.map, emissive: 0xffffff, emissiveMap: t.emi, vertexColors: true, roughness: 0.85 }, { night: 1.0 }); }),
    roof: B.mat('roof', () => litMat({ map: roofTex('shingle'), vertexColors: true, roughness: 0.9 })),
    tin: B.mat('tin', () => litMat({ map: roofTex('seam'), vertexColors: true, roughness: 0.45, metalness: 0.35 })),
    deck: B.mat('deck', () => litMat({ map: plankTexture(), vertexColors: true, roughness: 0.9 })),
    paint: B.mat('paint', () => litMat({ vertexColors: true, roughness: 0.7 })),
    stone: B.mat('stone', () => litMat({ map: concreteTexture('#9a968c', 'lakestone'), vertexColors: true, roughness: 0.92 })),
    dam: B.mat('dam', () => litMat({ map: damTex(), roughness: 0.88 }, { glow: 2.2 })),
    leaf: B.mat('leaf', () => litMat({ vertexColors: true, flatShading: true, roughness: 0.9 })),
    bark: B.mat('bark', () => litMat({ vertexColors: true, roughness: 0.95 })),
    water: B.mat('water', () => new THREE.MeshStandardMaterial({ color: 0x0b2234, roughness: 0.1, metalness: 0.05, envMapIntensity: 1.1, transparent: true, opacity: 0.94 })),
    foam: B.mat('foam', () => { const t = foamTex(); return plainMat({ map: t, transparent: true, depthWrite: false, color: 0xffffff, emissive: 0x9ab8d0, emissiveMap: t, roughness: 0.4 }, { night: 0.55, shadow: false }); }),
    sign: B.mat('sign', () => { const t = signs(); return litMat({ map: t.map, emissive: 0xffffff, emissiveMap: t.emi, roughness: 0.6 }, { night: 1.6 }); }),
    lamp: B.mat('lamp', () => glowColorMat('#ffe2b0', 3.2)),
    cool: B.mat('cool', () => glowColorMat('#e6eeff', 3.4)),
    red: B.mat('red', () => glowColorMat('#ff2a1a', 4)),
    green: B.mat('green', () => glowColorMat('#30ff7a', 3)),
    fire: B.mat('fire', () => glowColorMat('#ff7a24', 3.2)),
    warmwin: B.mat('warmwin', () => glowColorMat('#ffc070', 1.6)),
  };
}
const signUV = (k) => signs().uv(k);

// ------------------------------------------------------------------ helpers

/** One storey of walls from atlas band k (no top). */
function storey(acc, x, y, z, w, d, ry, k, faces = 'fblr') {
  box(acc, x, y, z, w, STOREY, d, ry, { u: 8, v: STOREY * BANDS, v0: k / BANDS, top: false, faces });
}

/** A sign panel facing local +z of frame F at (lx, ly, lz), w × h, atlas slot k. */
function signPanel(acc, F, lx, ly, lz, w, h, k) {
  const uv = signUV(k);
  acc.quadP(F.p(lx - w / 2, ly, lz), F.p(lx + w / 2, ly, lz), F.p(lx + w / 2, ly + h, lz), F.p(lx - w / 2, ly + h, lz), uv);
}

/** Distance from (x, z) to the lake's edge (+ outside, − inside). */
function lakeDist(x, z) {
  let best = Infinity;
  for (let i = 0, j = LAKE.length - 1; i < LAKE.length; j = i++) {
    const r = nearOnLine([LAKE[j], LAKE[i]], x, z);
    if (r.d < best) best = r.d;
  }
  let inside = false;
  for (let i = 0, j = LAKE.length - 1; i < LAKE.length; j = i++) {
    const xi = LAKE[i][0], zi = LAKE[i][1], xj = LAKE[j][0], zj = LAKE[j][1];
    if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside;
  }
  return inside ? -best : best;
}

/** Point on the lake's edge nearest (x, z) and the outward normal into the lake. */
function shoreAt(x, z) {
  let best = null;
  for (let i = 0, j = LAKE.length - 1; i < LAKE.length; j = i++) {
    const r = nearOnLine([LAKE[j], LAKE[i]], x, z);
    if (!best || r.d < best.d) best = { ...r, a: LAKE[j], b: LAKE[i] };
  }
  const tx = best.b[0] - best.a[0], tz = best.b[1] - best.a[1], l = Math.hypot(tx, tz);
  // into the lake: whichever normal points at the lake's middle
  let nx = -tz / l, nz = tx / l;
  if ((-3350 - best.px) * nx + (-1750 - best.pz) * nz < 0) { nx = -nx; nz = -nz; }
  return { x: best.px, z: best.pz, nx, nz, tx: tx / l, tz: tz / l };
}

// ------------------------------------------------------------------ plan

function planDam(P) {
  const r = P.net.byId.get('dam_road');
  if (!r) return;
  // the frame: origin on the road over the gorge, local x along the dam, +z downstream
  const p = r.posAt(130);
  const i = p.i;
  let nx = -r.LX[i], nz = -r.LZ[i];
  if (nz < 0) { nx = -nx; nz = -nz; }
  const ry = Math.atan2(nx, nz);
  const it = P.add({ type: 'dam', x: p.x, z: p.z, ry, y: 58, map: 'building' });
  const at = (lx, lz) => toWorld(p.x, p.z, ry, lx, lz);
  // the crest walls along both sides of the road (cars stay on the dam)
  for (const sd of [1, -1]) {
    const [cx, cz] = at(10, sd * 9.55);
    P.collider({ kind: 'box', x: cx, z: cz, hx: 136, hz: 0.35, ry, y0: 56, y1: 60 });
  }
  // lamps along the crest walls, the face's floodlights, the towers' beacons
  for (let lx = -118; lx <= 140; lx += 18) {
    for (const sd of [1, -1]) {
      const [lx2, lz2] = at(lx + (sd > 0 ? 9 : 0), sd * 9.55);
      P.lamp({ x: lx2, z: lz2, hx: lx2, hz: lz2, hy: 58.2 + 4.6, color: '#ffe6c4', radius: 15, intensity: 0.95, halo: 1.6 });
    }
  }
  // (floodlights at the toe and on the powerhouse roof, aimed up at the face)
  for (const [lx, lz, hy] of [[-34, 58, 33], [34, 62, 33], [12, 58, 37.4]]) {
    const [fx, fz] = at(lx, lz);
    const [hx, hz] = at(lx * 0.9, lz - 1);
    P.lamp({ x: fx, z: fz, hx, hz, hy, color: '#dfe8ff', radius: 52, intensity: 1.3, halo: 2.6 });
  }
  for (const [lx, lz] of [[-34, -56], [38, -54]]) {
    const [tx, tz] = at(lx, lz);
    P.lamp({ x: tx, z: tz, hx: tx, hz: tz, hy: 72, color: '#ff3020', radius: 6, intensity: 0.8, halo: 2.2 });
    P.far({ shape: 'cyl', x: tx, z: tz, y: 40, r: 5.5, h: 31, color: '#a8a49a', lit: 0 });
  }
  // the far view: the face, the hoist house over the spillway
  const [fx, fz] = at(0, 30);
  P.far({ x: fx, z: fz, y: 22, w: 110, d: 30, h: 36, ry, color: '#a9a69e', lit: 0 });
  const [hx, hz] = at(0, 35);
  P.far({ x: hx, z: hz, y: 58, w: 24, d: 9, h: 15, ry, color: '#b9b4a8', lit: 0.4 });
  // the river below the dam is the dam's: nothing else is planned in the gorge
  for (let lz = 12; lz < 80; lz += 10) for (let lx = -60; lx <= 60; lx += 10) { const [qx, qz] = at(lx, lz); P.claim(qx, qz, 10, 10, ry); }
  for (let lz = -60; lz < -10; lz += 10) for (let lx = -120; lx <= 140; lx += 10) { const [qx, qz] = at(lx, lz); P.claim(qx, qz, 10, 10, ry); }
  it.frame = { ry };
}

function planMarina(P) {
  const r = P.net.byId.get('lk_south2');
  if (!r) return;
  // along the shore road's lake side, x ≈ -3150 … -3330
  const parts = [];
  const at = (s, lat) => { const q = r.posAt(s); return { x: q.x + r.LX[q.i] * lat, z: q.z + r.LZ[q.i] * lat, ry: Math.atan2(r.LX[q.i], r.LZ[q.i]), i: q.i }; };
  // which side is the lake? (left: +L)
  const q0 = r.posAt(200);
  const side = lakeDist(q0.x + r.LX[q0.i] * 30, q0.z + r.LZ[q0.i] * 30) < lakeDist(q0.x - r.LX[q0.i] * 30, q0.z - r.LZ[q0.i] * 30) ? 1 : -1;
  const s0 = 150, s1 = 330;    // along lk_south2 (x ≈ -3150 … -3330)
  // the lot: a gravel/asphalt strip between the road and the bank
  const lot = [];
  for (let s = s0; s <= s1; s += 15) lot.push(at(s, side * 9.6));
  for (let s = s1; s >= s0; s -= 15) lot.push(at(s, side * (s > 280 ? 19 : 21)));
  P.add({ type: 'marinaLot', x: lot[0].x, z: lot[0].z, poly: lot.map((p) => [p.x, p.z]), map: 'plaza' });
  // the bait shop / office, facing the lot
  const o = at(175, side * 27);
  const oy = Math.atan2(-r.LX[o.i] * side, -r.LZ[o.i] * side);
  if (P.isFree(o.x, o.z, 13, 9, oy, { water: false })) {
    P.claim(o.x, o.z, 13, 9, oy);
    P.add({ type: 'shop', x: o.x, z: o.z, ry: oy, w: 13, d: 9, map: 'building' });
    P.collider({ kind: 'box', x: o.x, z: o.z, hx: 6.5, hz: 4.5, ry: oy, y0: P.groundY(o.x, o.z) - 3, y1: P.groundY(o.x, o.z) + 8 });
    P.far({ x: o.x, z: o.z, w: 13, d: 9, h: 7, ry: oy, color: '#5a7a8a', lit: 0.5 });
    const L = toWorld(o.x, o.z, oy, 3, 5.6);
    P.lamp({ x: L[0], z: L[1], hx: L[0], hz: L[1], hy: P.groundY(o.x, o.z) + 3.4, color: '#ffd29a', radius: 12, intensity: 0.9, halo: 1.3 });
    const sg = toWorld(o.x, o.z, oy, -1, 6.5);
    P.lamp({ x: sg[0], z: sg[1], hx: sg[0], hz: sg[1], hy: P.groundY(o.x, o.z) + 6.5, color: '#60c8ff', radius: 10, intensity: 0.7, halo: 2.4 });
  }
  // the piers: straight out from the shore into the lake
  for (const [s, len, kind] of [[225, 78, 'main'], [292, 46, 'fuel'], [178, 40, 'east']]) {
    const q = at(s, side * 20);
    const sh = shoreAt(q.x, q.z);
    parts.push({ type: 'pier', x: sh.x, z: sh.z, nx: sh.nx, nz: sh.nz, len, kind });
  }
  // boathouses along the shore west of the main pier
  for (const s of [248, 262, 276]) {
    const q = at(s, side * 20);
    const sh = shoreAt(q.x, q.z);
    const ry = Math.atan2(-sh.nx, -sh.nz);   // front (+z) faces the lake… we want the door to the lake: +z = into lake
    parts.push({ type: 'boathouse', x: sh.x + sh.nx * 3, z: sh.z + sh.nz * 3, ry: Math.atan2(sh.nx, sh.nz), tint: P.pick(['#8a2a22', '#2f5a3a', '#2a4a6a', '#6a5a3a']) });
    void ry;
  }
  for (const it of parts) {
    P.add({ ...it, map: it.type === 'pier' ? 'plaza' : 'building' });
    if (it.type === 'pier') {
      // dock lamps along it, a green light at the end
      for (let d = 10; d <= it.len; d += 16) {
        const x = it.x + it.nx * d, z = it.z + it.nz * d;
        P.lamp({ x, z, hx: x, hz: z, hy: LAKE_Y + 3.2, color: '#ffd8a0', radius: 9, intensity: 0.8, halo: 1.1 });
      }
      const ex = it.x + it.nx * (it.len + 1), ez = it.z + it.nz * (it.len + 1);
      if (it.kind === 'main') P.lamp({ x: ex, z: ez, hx: ex, hz: ez, hy: LAKE_Y + 5, color: '#30ff7a', radius: 6, intensity: 0.6, halo: 1.8 });
    } else {
      P.collider({ kind: 'box', x: it.x, z: it.z, hx: 5, hz: 8, ry: it.ry, y0: LAKE_Y - 3, y1: LAKE_Y + 8 });
      P.far({ x: it.x, z: it.z, y: LAKE_Y, w: 10, d: 16, h: 7, ry: it.ry, color: '#6a4a3a', lit: 0.2 });
    }
  }
  // the marina's sign at the lot's entrance
  const sgn = at(160, side * 11.5);
  P.add({ type: 'sign', x: sgn.x, z: sgn.z, ry: Math.atan2(-r.TX[sgn.i], -r.TZ[sgn.i]) + Math.PI / 2 * 0, slot: 0, w: 5.2, h: 1.3, post: 2.6, posts: 2 });
  P.collider({ kind: 'circle', x: sgn.x, z: sgn.z, r: 1.2, y0: 50, y1: 80 });
  P.landmark({ id: 'marina', name: 'HALCYON MARINA', x: at(225, side * 30).x, z: at(225, side * 30).z, kind: 'marina' });
  // claim the strip so nothing else builds there
  for (let s = s0; s <= s1; s += 10) { const q = at(s, side * 30); P.claim(q.x, q.z, 12, 40, q.ry); }
}

function planCamp(P) {
  const r = P.net.byId.get('cg_road');
  if (!r) return;
  const L = r.length;
  // campsites along both sides of the camp road, between the shore road and the lake
  const sites = [];
  for (let s = 120; s < L - 120; s += P.range(22, 30)) {
    for (const sd of [1, -1]) {
      if (P.rng() < 0.18) continue;
      const q = r.posAt(s);
      const lat = sd * P.range(11, 15);
      const x = q.x + r.LX[q.i] * lat, z = q.z + r.LZ[q.i] * lat;
      const ry = Math.atan2(-r.LX[q.i] * sd, -r.LZ[q.i] * sd);
      if (!mine(x, z) || lakeDist(x, z) < 8) continue;
      if (!P.isFree(x, z, 12, 10, ry, { pad: 1 })) continue;
      P.claim(x, z, 12, 10, ry);
      const k = P.rng();
      const site = { type: 'campsite', x, z, ry, w: 12, d: 10, kind: k < 0.55 ? 'tent' : k < 0.85 ? 'camper' : 'rv', fire: P.rng() < 0.6, tint: P.pick(['#d86a2a', '#2a7ac8', '#3a9a4a', '#c8a22a', '#a83a5a']), car: P.pick(['#8a2a22', '#3a4a6a', '#5a5a52', '#2f4a3a', '#a8a090']), map: 'yard' };
      sites.push(site);
      P.add(site);
      const gy = P.groundY(x, z);
      if (site.kind !== 'tent') P.collider({ kind: 'box', x, z, hx: 2.2, hz: 4, ry, y0: gy - 1, y1: gy + 3.5 });
      if (site.fire) {
        const f = toWorld(x, z, ry, 3.2, -1.5);
        P.lamp({ x: f[0], z: f[1], hx: f[0], hz: f[1], hy: gy + 1.2, color: '#ff8a3a', radius: 9, intensity: 1.0, halo: 1.6 });
      }
    }
  }
  // the camp office and the restrooms by the entrance
  const q = r.posAt(80);
  for (const [s, w, d, type] of [[70, 11, 8, 'campoffice'], [230, 8, 6, 'restroom']]) {
    const qq = r.posAt(s);
    for (const sd of [1, -1]) {
      const lat = sd * (d / 2 + 6);
      const x = qq.x + r.LX[qq.i] * lat, z = qq.z + r.LZ[qq.i] * lat;
      const ry = Math.atan2(-r.LX[qq.i] * sd, -r.LZ[qq.i] * sd);
      if (!mine(x, z) || !P.isFree(x, z, w, d, ry, { pad: 1 })) continue;
      P.claim(x, z, w, d, ry);
      P.add({ type, x, z, ry, w, d, map: 'building' });
      const gy = P.groundY(x, z);
      P.collider({ kind: 'box', x, z, hx: w / 2, hz: d / 2, ry, y0: gy - 2, y1: gy + 6 });
      P.far({ x, z, w, d, h: 5, ry, color: '#6a4a30', lit: 0.4 });
      const l = toWorld(x, z, ry, 0, d / 2 + 1.2);
      P.lamp({ x: l[0], z: l[1], hx: l[0], hz: l[1], hy: gy + 3, color: '#ffc880', radius: 10, intensity: 0.85, halo: 1.2 });
      break;
    }
  }
  // the entrance sign
  const e = r.posAt(36);
  for (const sd of [1, -1]) {
    const x = e.x + r.LX[e.i] * sd * 7, z = e.z + r.LZ[e.i] * sd * 7;
    if (!P.isFree(x, z, 4, 2, 0, { pad: 0 })) continue;
    P.add({ type: 'sign', x, z, ry: Math.atan2(-r.TX[e.i], -r.TZ[e.i]), slot: 2, w: 4.4, h: 1.1, post: 1.6, posts: 2, wood: true });
    P.collider({ kind: 'circle', x, z, r: 1.2, y0: P.groundY(x, z) - 1, y1: P.groundY(x, z) + 4 });
    const gy = P.groundY(x, z);
    P.lamp({ x, z, hx: x, hz: z, hy: gy + 3.8, color: '#ffc880', radius: 8, intensity: 0.7, halo: 1 });
    break;
  }
  void q;
  // camp lamps (amber, on wooden posts) along the road
  for (let s = 60; s < L - 120; s += 55) {
    const qq = r.posAt(s);
    const x = qq.x + r.LX[qq.i] * 6.2, z = qq.z + r.LZ[qq.i] * 6.2;
    if (!P.isFree(x, z, 1, 1, 0, { pad: 0 })) continue;
    P.add({ type: 'campLamp', x, z });
    P.lamp({ x, z, hx: x, hz: z, hy: P.groundY(x, z) + 3.6, color: '#ffb060', radius: 13, intensity: 0.85, halo: 1.2 });
  }
  const mid = r.posAt(L * 0.55);
  void mid;
  // Heron Point: the fishing jetty at the road's end
  const end = r.posAt(L - 1);
  const sh = shoreAt(end.x, end.z);
  P.add({ type: 'jetty', x: sh.x, z: sh.z, nx: sh.nx, nz: sh.nz, len: 26, map: 'plaza' });
  const ex = sh.x + sh.nx * 24, ez = sh.z + sh.nz * 24;
  P.lamp({ x: ex, z: ez, hx: ex, hz: ez, hy: LAKE_Y + 3, color: '#ffc070', radius: 8, intensity: 0.9, halo: 1.3 });
  // the shack by the jetty
  const sx = sh.x - sh.nx * 12 + sh.tx * 8, sz = sh.z - sh.nz * 12 + sh.tz * 8;
  const sry = Math.atan2(sh.nx, sh.nz);
  if (P.isFree(sx, sz, 5, 4, sry, { pad: 0 })) {
    P.claim(sx, sz, 5, 4, sry);
    P.add({ type: 'shack', x: sx, z: sz, ry: sry, w: 5, d: 4, map: 'building' });
    const gy = P.groundY(sx, sz);
    P.collider({ kind: 'box', x: sx, z: sz, hx: 2.5, hz: 2, ry: sry, y0: gy - 1, y1: gy + 4 });
    const l = toWorld(sx, sz, sry, 1.4, 2.4);
    P.lamp({ x: l[0], z: l[1], hx: l[0], hz: l[1], hy: gy + 2.4, color: '#ffb050', radius: 7, intensity: 0.8, halo: 0.9 });
  }
  P.landmark({ id: 'heronpoint', name: 'HERON POINT', x: ex, z: ez, kind: 'fishing', hidden: true });
}

function planCabins(P) {
  const roads = ['lk_south1', 'lk_south3', 'lk_east', 'lk_north1', 'lk_north4', 'cw_road'];
  const lots = P.lots({
    roads: (r) => roads.includes(r.spec.id), width: [9, 13], depth: [8, 11], gap: [26, 70], setback: [5, 16], chance: 0.8, roadPad: true, pad: 3, ends: 30,
  });
  let n = 0;
  for (const L of lots) {
    const ld = lakeDist(L.x, L.z);
    const back = lakeDist(L.x - Math.sin(L.ry) * 25, L.z - Math.cos(L.ry) * 25);
    const lakeside = ld < 120 && back < ld;
    if (!mine(L.x, L.z) || (!lakeside && P.rng() < 0.6) || ld < 8) continue;
    const g = P.groundRange(L.x, L.z, L.w, L.d, L.ry);
    if (g.hi - g.lo > 4.5) continue;
    const k = P.rng();
    const kind = k < 0.5 ? 'log' : k < 0.78 ? 'aframe' : 'lodge';
    const h = kind === 'lodge' ? 7.5 : kind === 'aframe' ? 7 : 5.5;
    P.add({ type: 'cabin', kind, x: L.x, z: L.z, ry: L.ry, w: L.w, d: L.d, tint: P.pick(['#ffffff', '#e8dccb', '#c8b8a0']), roofTint: P.pick(['#3a5a3a', '#7a3a2a', '#4a4a4a', '#2a3a4a', '#5a4a3a']), lit: P.rng(), seed: P.rng(), canoe: lakeside && P.rng() < 0.5, truck: P.rng() < 0.45 ? P.pick(['#8a2a22', '#2a4a6a', '#e8e2d0', '#3a5a3a', '#6a6a62']) : null, map: 'building' });
    P.collider({ kind: 'box', x: L.x, z: L.z, hx: L.w / 2, hz: L.d / 2, ry: L.ry, y0: g.lo - 1, y1: g.hi + h });
    P.far({ x: L.x, z: L.z, y: g.lo - 1, w: L.w, d: L.d, h: g.hi - g.lo + h - 1.5, ry: L.ry, color: kind === 'log' ? '#6a4a30' : '#7a6a58', lit: 0.4 });
    const pl = toWorld(L.x, L.z, L.ry, L.w * 0.25, L.d / 2 + 1.6);
    P.lamp({ x: pl[0], z: pl[1], hx: pl[0], hz: pl[1], hy: g.hi + 2.9, color: '#ffc070', radius: 9, intensity: 0.85, halo: 1.1 });
    n++;
  }
  return n;
}

function planExtras(P) {
  // the welcome sign at the foot of the dam road (River Road side)
  const r = P.net.byId.get('lk_south1');
  if (r) {
    const q = r.posAt(90);
    for (const sd of [-1, 1]) {
      const lat = sd * 13;
      const x = q.x + r.LX[q.i] * lat, z = q.z + r.LZ[q.i] * lat;
      if (!mine(x, z) || !P.isFree(x, z, 7, 2, 0, { pad: 0 }) || lakeDist(x, z) < 6) continue;
      P.add({ type: 'sign', x, z, ry: Math.atan2(r.TX[q.i], r.TZ[q.i]) + Math.PI, slot: 6, w: 6.4, h: 1.6, post: 1.4, posts: 2, wood: true });
      P.collider({ kind: 'box', x, z, hx: 3.4, hz: 0.4, ry: Math.atan2(r.TX[q.i], r.TZ[q.i]), y0: P.groundY(x, z) - 1, y1: P.groundY(x, z) + 4 });
      break;
    }
  }
  // boats out on the water, buoys, a swimming float
  const pts = [[-3350, -1300], [-3800, -1600], [-2900, -1500], [-3100, -1900], [-3600, -2200], [-2700, -1250], [-4000, -1450]];
  for (const [x, z] of pts) {
    const k = P.rng();
    P.add({ type: 'boatOut', x: x + P.range(-60, 60), z: z + P.range(-60, 60), ry: P.range(0, 6.28), kind: k < 0.4 ? 'sail' : k < 0.8 ? 'motor' : 'row', tint: P.pick(['#f2f2ee', '#e8e2d0', '#2a4a6a', '#c8a22a']) });
  }
  for (let k = 0; k < 10; k++) {
    const t = k / 10;
    const x = -3150 + Math.cos(t * 6.283) * 40 - 0, z = -1220 + Math.sin(t * 6.283) * 30;
    P.add({ type: 'buoy', x, z, red: k % 2 === 0 });
  }
}

// ------------------------------------------------------------------ scatter

function scatter(S) {
  const steep = (x, z) => {
    const e = 3;
    const hx = S.groundY(x + e, z) - S.groundY(x - e, z), hz = S.groundY(x, z + e) - S.groundY(x, z - e);
    return Math.hypot(hx, hz) / (2 * e);
  };
  // pines, thick on the hills, thinning toward the water
  const dens = (x, z) => {
    if (inIron(x, z)) return 0;
    const n = S.noise(x / 140, z / 140);
    return 0.42 + 0.5 * n;
  };
  for (const [x, z] of S.points(9, { r: 2.6, density: dens })) {
    if (inIron(x, z)) continue;
    const y = S.groundY(x, z);
    if (y > 560 || y < LAKE_Y + 0.8) continue;
    const sl = steep(x, z);
    if (sl > 1.35) continue;
    const ld = lakeDist(x, z);
    if (ld < 4 || (ld < 22 && S.rng() < 0.6)) continue;
    const t = S.rng();
    const tall = y > 300 ? 0.75 : 1;
    if (t < 0.22) {
      const h = S.range(16, 28) * tall;
      S.add({ type: 'fir', x, z, y, h, t: S.rng() });
    } else {
      const h = S.range(8, 20) * tall;
      S.add({ type: 'pine', x, z, y, h, t: S.rng() });
    }
    S.collider({ kind: 'circle', x, z, r: 0.5, y0: y - 1, y1: y + 10 });
  }
  // bushes and boulders, granite on the shore
  for (const [x, z] of S.points(16, { r: 2 })) {
    if (inIron(x, z)) continue;
    const y = S.groundY(x, z);
    if (y < LAKE_Y + 0.4 || y > 600) continue;
    const ld = lakeDist(x, z);
    const u = S.rng();
    if (ld < 30 && u < 0.45) {
      const s = S.range(0.6, 2.2);
      S.add({ type: 'rock', x, z, y, s, t: S.rng() });
      if (s > 1.1) S.collider({ kind: 'circle', x, z, r: s * 0.85, y0: y - 1, y1: y + s * 1.2 });
    } else if (u < 0.25) {
      S.add({ type: 'bush', x, z, y, s: S.range(0.7, 1.6), t: S.rng() });
    } else if (u > 0.97 && steep(x, z) < 0.4) {
      S.add({ type: 'log', x, z, y, L: S.range(7, 14), r: S.range(0.35, 0.6), ang: S.range(0, 3.14), t: S.rng() });
    }
  }
  // reeds where the shore is low
  for (const [x, z] of S.points(7, { r: 1.5 })) {
    const ld = lakeDist(x, z);
    if (ld < -6 || ld > 3) continue;
    if (S.noise(x / 50, z / 50) < 0.1) continue;
    S.add({ type: 'reeds', x, z, y: LAKE_Y, t: S.rng() });
  }
}

// ------------------------------------------------------------------ build

function buildDam(B, M, it) {
  const ry = it.ry;
  const F = new Fr(it.x, 0, it.z, ry);
  const stone = B.acc(M.stone), dam = B.acc(M.dam), paint = B.acc(M.paint);
  const Y = 58, TOP = 58.15;
  const zc = (lx) => 40 + (lx * lx) / 450;              // the face's top edge: an arch, concave seen from below
  const zf = (lx, y) => zc(lx) + 0.08 * (Y - y) + 4 * ((Y - y) / 36) ** 3;   // the face going down to the toe
  const SPAN = 66;
  // --- the face: a grid over x and height (wound to face downstream, +z)
  const xs = [];
  for (let lx = -SPAN; lx <= SPAN; lx += 6) xs.push(lx);
  const ys = [TOP, 56, 53, 50, 46, 42, 38, 34, 30, 26.5, 23, 20];
  const vid = [];
  for (let a = 0; a < xs.length; a++) {
    vid.push([]);
    for (let b = 0; b < ys.length; b++) {
      const lx = xs[a], y = ys[b];
      const [wx, , wz] = F.p(lx, 0, zf(lx, y));
      vid[a].push(dam.v(wx, y, wz, lx / 16, y / 16));
    }
  }
  for (let a = 0; a < xs.length - 1; a++) {
    for (let b = 0; b < ys.length - 1; b++) {
      dam.tri(vid[a][b], vid[a + 1][b + 1], vid[a + 1][b]);
      dam.tri(vid[a][b], vid[a][b + 1], vid[a + 1][b + 1]);
    }
  }
  // --- the crest: a platform from the road's walls out to the face's edge, a walk beyond
  col(stone, lin('#c9c5ba'));
  const edgeZ = (lx) => (Math.abs(lx) <= SPAN ? zc(lx) + 0.3 : 13);
  for (let lx = -126; lx < 146; lx += 6) {
    const x0 = lx, x1 = Math.min(146, lx + 6);
    const za = edgeZ(x0), zb = edgeZ(x1);
    stone.quadP(F.p(x1, TOP, 9.9), F.p(x0, TOP, 9.9), F.p(x0, TOP, za), F.p(x1, TOP, zb), [x1 / 4, 0, x0 / 4, za / 4]);
  }
  // the dam's flanks: solid walls closing the body at the ends of the face
  for (const sx of [-1, 1]) {
    const lx = sx * SPAN, z1 = zc(lx) + 0.3;
    const A = F.p(lx, 18, 9.9), Bq = F.p(lx, 18, z1), C = F.p(lx, TOP, z1), D = F.p(lx, TOP, 9.9);
    if (sx > 0) stone.quadP(A, Bq, C, D, [0, 0, (z1 - 9.9) / 4, 10]); else stone.quadP(Bq, A, D, C, [0, 0, (z1 - 9.9) / 4, 10]);
  }
  // the crest walls along the road (both sides), with a cap
  for (const sd of [1, -1]) {
    F.box(stone, 10, Y - 0.6, sd * 9.55, 272, 1.75, 0.5, { u: 4, v: 4 });
    F.box(stone, 10, Y + 1.15, sd * 9.55, 272, 0.12, 0.75, { u: 4 });
  }
  // a low rail along the face's edge
  col(paint, lin('#3a3f44'));
  for (let lx = -SPAN; lx < SPAN; lx += 6) {
    const a = F.p(lx, TOP + 1.0, zc(lx) + 0.4), b = F.p(lx + 6, TOP + 1.0, zc(lx + 6) + 0.4);
    beam(paint, a, b, 0.08, 0.08);
    const pp = F.p(lx, TOP, zc(lx) + 0.4);
    beam(paint, pp, [pp[0], TOP + 1.05, pp[2]], 0.08, 0.08);
  }
  // --- lamp posts on the crest walls (art deco: a fluted post, a glass globe)
  const glow = B.acc(M.lamp);
  col(paint, lin('#2c3236'));
  for (let lx = -118; lx <= 140; lx += 18) {
    for (const sd of [1, -1]) {
      const px = lx + (sd > 0 ? 9 : 0);
      const [x, , z] = F.p(px, 0, sd * 9.55);
      cylinder(paint, x, Y + 1.27, z, 0.16, 3.4, 8, { r2: 0.11 });
      cylinder(paint, x, Y + 1.2, z, 0.32, 0.4, 8, { top: true });
      sphere(glow, x, Y + 5.0, z, 0.36, 8);
      cylinder(paint, x, Y + 5.32, z, 0.18, 0.2, 6, { top: true });
    }
  }
  // --- the spillway: gate piers at the face's top, a hoist house across their tops
  const pz = zc(0) - 5;
  col(stone, lin('#bcb8ad'));
  for (const lx of [-10.5, -3.5, 3.5, 10.5]) F.box(stone, lx, Y - 1, pz, 1.6, 9.5, 10.4, { u: 4, v: 4 });
  const wall = B.acc(M.wall);
  col(wall, WHITE);
  storey(wall, F.wx(0, pz), Y + 8.5, F.wz(0, pz), 24, 7.5, ry, 4);
  storey(wall, F.wx(0, pz), Y + 11.5, F.wz(0, pz), 24, 7.5, ry, 4);
  col(stone, lin('#a8a498'));
  F.box(stone, 0, Y + 14.5, pz, 25.2, 0.6, 8.6, { u: 4 });
  F.box(stone, 0, Y + 15.1, pz, 6, 2.2, 4, { u: 4 });
  // the lettering on the face beside the spillway
  const sacc = B.acc(M.sign);
  const uv = signUV(3);
  const segs = 6, x0 = -46, x1 = -14;
  for (let k = 0; k < segs; k++) {
    const a = x0 + (x1 - x0) * (k / segs), b = x0 + (x1 - x0) * ((k + 1) / segs);
    const ua = uv[0] + (uv[2] - uv[0]) * (k / segs), ub = uv[0] + (uv[2] - uv[0]) * ((k + 1) / segs);
    const yt = 56.6, yb = 52.6;
    const pa0 = F.p(b, yb, zf(b, yb) + 0.25), pa1 = F.p(a, yb, zf(a, yb) + 0.25), pa2 = F.p(a, yt, zf(a, yt) + 0.25), pa3 = F.p(b, yt, zf(b, yt) + 0.25);
    // seen from downstream local x runs left to right
    sacc.quadP(pa1, pa0, pa3, pa2, [ua, uv[1], ub, uv[3]]);
  }
  // the water: a sheet down the spillway's middle (scrolling), white water at the foot
  const foam = B.acc(M.foam);
  const fys = [57.2, 54, 50, 46, 42, 38, 34, 30, 26.5, 25.1];
  for (let a = -9; a < 9; a += 3) {
    for (let b = 0; b < fys.length - 1; b++) {
      const y0 = fys[b], y1 = fys[b + 1];
      const p00 = F.p(a, y0, zf(a, y0) + 0.35), p10 = F.p(a + 3, y0, zf(a + 3, y0) + 0.35);
      const p01 = F.p(a, y1, zf(a, y1) + 0.35), p11 = F.p(a + 3, y1, zf(a + 3, y1) + 0.35);
      foam.quadP(p01, p11, p10, p00, [a / 6, (58 - y1) / 8, (a + 3) / 6, (58 - y0) / 8]);
      void p11;
    }
  }
  // the plunge pool: water from the toe to where the river begins, foam where it lands
  const water = B.acc(M.water);
  const pool = [];
  for (let lx = -40; lx <= 40; lx += 8) pool.push(F.p(lx, 25.03, zf(lx, 24) - 1));
  for (let lx = 40; lx >= -40; lx -= 8) pool.push(F.p(lx * 0.6, 25.03, 66.9));
  const tri = THREE.ShapeUtils.triangulateShape(pool.map((p) => new THREE.Vector2(p[0], p[2])), []);
  const ids = pool.map((p) => water.v(p[0], p[1], p[2], p[0] / 40, p[2] / 40));
  for (const t of tri) {
    const a = pool[t[0]], b = pool[t[1]], c = pool[t[2]];
    const ny = (b[2] - a[2]) * (c[0] - a[0]) - (b[0] - a[0]) * (c[2] - a[2]);
    if (ny > 0) water.tri(ids[t[0]], ids[t[1]], ids[t[2]]); else water.tri(ids[t[0]], ids[t[2]], ids[t[1]]);
  }
  for (let a = -16; a < 16; a += 4) {
    const z0 = zf(a, 25) - 0.5, z1 = z0 + 16 + Math.abs(a) * 0.3;
    foam.quadP(F.p(a + 4, 25.12, z0), F.p(a, 25.12, z0), F.p(a, 25.12, z1), F.p(a + 4, 25.12, z1), [0, 0, 1, 2]);
  }
  // --- the powerhouse at the toe (east of the spillway), transformers on its roof
  const ph = { lx: 27, lz: 58 };
  col(wall, WHITE);
  for (let k = 0; k < 4; k++) storey(wall, F.wx(ph.lx, ph.lz), 23.5 + k * STOREY, F.wz(ph.lx, ph.lz), 18, 12, ry, 4);
  col(stone, lin('#b9b4a8'));
  F.box(stone, ph.lx, 23.5 + 12, ph.lz, 19, 0.8, 13, { u: 4 });
  col(paint, lin('#5a5f62'));
  for (const dx of [-5, 0, 5]) F.box(paint, ph.lx + dx, 36.3, ph.lz + 2, 2.4, 2.2, 2, { u: 2 });
  col(paint, lin('#8a8f92'));
  for (const dx of [-5, 0, 5]) cylinder(paint, F.wx(ph.lx + dx, ph.lz - 1.5), 36.3, F.wz(ph.lx + dx, ph.lz - 1.5), 0.25, 3.2, 6);
  // --- the floodlights at the toe, aimed up at the face
  const cool = B.acc(M.cool);
  col(paint, lin('#2a2e32'));
  for (const [lx, lz, hy] of [[-34, 58, 33], [34, 62, 33], [12, 58, 37.4]]) {
    const [x, , z] = F.p(lx, 0, lz);
    const gy = lx === 12 ? 36.3 : B.groundY(x, z);
    cylinder(paint, x, gy - 0.5, z, 0.14, hy - gy, 6);
    F.box(cool, lx, hy - 0.4, lz - 0.6, 1.6, 0.9, 0.3, {}, 0);
  }
  // --- the intake towers in the lake, footbridges to the crest wall
  for (const [lx, lz] of [[-34, -56], [38, -54]]) {
    const [x, , z] = F.p(lx, 0, lz);
    col(stone, lin('#c4c0b5'));
    lathe(stone, x, 38, z, [[6.2, 0], [5.6, 4], [5.4, 26], [5.9, 27], [5.9, 28.6], [4.6, 28.6]], 12, { u: 4, top: true });
    // the control house on top: a drum with tall windows, a dome
    col(wall, WHITE);
    const R = 3.6, H = 5.4;
    for (let k = 0; k < 12; k++) {
      const a0 = (k / 12) * Math.PI * 2, a1 = ((k + 1) / 12) * Math.PI * 2;
      const pA = [x + Math.cos(a1) * R, z + Math.sin(a1) * R], pB = [x + Math.cos(a0) * R, z + Math.sin(a0) * R];
      const v0 = 4 / BANDS, v1 = 5 / BANDS;
      wall.quadP([pA[0], 66.6, pA[1]], [pB[0], 66.6, pB[1]], [pB[0], 66.6 + H, pB[1]], [pA[0], 66.6 + H, pA[1]], [(k + 1) * 0.25, v0, k * 0.25, v1]);
    }
    col(stone, lin('#a8a498'));
    sphere(stone, x, 72, z, 4.0, 10, { dome: true, sy: 0.6 });
    cylinder(stone, x, 74.3, z, 0.25, 1.2, 6);
    sphere(B.acc(M.red), x, 75.8, z, 0.32, 6);
    // the footbridge from the crest wall
    const a = F.p(lx, Y + 0.2, -9.9), b = F.p(lx, Y + 0.2, lz + 5.2);
    const L = Math.hypot(b[0] - a[0], b[2] - a[2]);
    col(paint, lin('#3a4044'));
    F.box(paint, lx, Y - 0.2, (lz + 5.2 - 9.9) / 2, 2.6, 0.4, L, { u: 2 });
    for (const sx of [-1.25, 1.25]) {
      beam(paint, F.p(lx + sx, Y + 1.2, -9.9), F.p(lx + sx, Y + 1.2, lz + 5.2), 0.08, 0.08);
      for (let d = 0; d <= L; d += 3) { const q = F.p(lx + sx, Y + 0.2, -9.9 - d); beam(paint, q, [q[0], Y + 1.2, q[2]], 0.06, 0.06); }
    }
    // a truss under the deck
    beam(paint, F.p(lx, Y - 0.4, -9.9), F.p(lx, Y - 2.6, (lz - 9.9) / 2), 0.3, 0.3);
    beam(paint, F.p(lx, Y - 2.6, (lz - 9.9) / 2), F.p(lx, Y - 0.4, lz + 5.2), 0.3, 0.3);
  }
  // the upstream face of the dam: riprap down to the water (the ground under it)
  const rip = [];
  for (let lx = -120; lx <= 140; lx += 20) rip.push([F.wx(lx, -10), F.wz(lx, -10)]);
  for (let lx = 140; lx >= -120; lx -= 20) rip.push([F.wx(lx, -44), F.wz(lx, -44)]);
  drapeUV(stone, B, rip, { lift: 0.12, step: 6, uv: 3, ang: ry, col: lin('#8a867c') });
  col(stone, WHITE); col(paint, WHITE); col(wall, WHITE);
}

function buildMarinaLot(B, M, it) {
  const acc = B.acc(M.stone);
  drapeUV(acc, B, it.poly, { lift: 0.08, step: 5, uv: 4, col: lin('#5f5d58') });
  col(acc, WHITE);
}

function buildPier(B, M, it) {
  const deck = B.acc(M.deck), paint = B.acc(M.paint);
  const ang = Math.atan2(it.nx, it.nz);
  const W = it.kind === 'main' ? 3.2 : 2.6;
  const y = LAKE_Y + 0.65;
  const F = new Fr(it.x, 0, it.z, ang);   // local +z into the lake
  col(deck, lin('#c8b8a0'));
  // the gangway from the bank (down from the bank's height to the deck)
  const bankY = B.groundY(it.x - it.nx * 10, it.z - it.nz * 10);
  const g0 = F.p(0, bankY + 0.2, -10), g1 = F.p(0, y + 0.2, 1);
  const gl = Math.hypot(g1[0] - g0[0], g1[2] - g0[2]);
  F.box(deck, 0, Math.min(bankY, y), (1 - 10) / 2, 2.2, 0.01, gl, { u: 2, top: false });
  deck.quadP(F.p(-1.1, y + 0.2, 1), F.p(1.1, y + 0.2, 1), F.p(1.1, bankY + 0.2, -10), F.p(-1.1, bankY + 0.2, -10), [0, 0, 1, gl / 2]);
  col(paint, lin('#4a4a46'));
  for (const sx of [-1.1, 1.1]) beam(paint, F.p(sx, bankY + 1.1, -10), F.p(sx, y + 1.1, 1), 0.07, 0.07);
  // the main deck
  F.box(deck, 0, y, it.len / 2 + 1, W, 0.25, it.len, { u: 2 });
  // pilings
  col(paint, lin('#5a4a3a'));
  for (let d = 2; d <= it.len + 1; d += 4) for (const sx of [-W / 2 - 0.15, W / 2 + 0.15]) {
    const [px, , pz] = F.p(sx, 0, d);
    cylinder(paint, px, LAKE_Y - 3, pz, 0.16, 4.4, 6, { top: true });
  }
  // finger piers and boats in the slips
  if (it.kind !== 'fuel') {
    for (let d = 12, k = 0; d < it.len - 4; d += 11, k++) {
      for (const sd of [-1, 1]) {
        col(deck, lin('#bfae95'));
        F.box(deck, sd * (W / 2 + 4.5), y - 0.05, d, 9, 0.22, 1.4, { u: 2 });
        const hk = hash2(it.x + d, it.z + sd, 7);
        if (hk < 0.72) {
          const kind = hk < 0.25 ? 'sail' : hk < 0.6 ? 'motor' : 'row';
          const hull = ['#f2f2ee', '#e8e2d0', '#f2f2ee', '#2a4a6a', '#8a2a22'][Math.floor(hk * 50) % 5];
          const [bx, , bz] = F.p(sd * (W / 2 + 4.5), 0, d + 3.4 * (k % 2 ? 1 : -1) * 0 + 3.5);
          boat(paint, bx, LAKE_Y, bz, ang + Math.PI / 2 * sd, kind, hull, { stripe: ['#2a5a9a', '#c83a2a', '#2a7a4a'][Math.floor(hk * 30) % 3] });
        }
      }
    }
  }
  // dock lamps
  const glow = B.acc(M.lamp);
  col(paint, lin('#2a2c2e'));
  for (let d = 10; d <= it.len; d += 16) {
    const [px, , pz] = F.p(0, 0, d);
    void px; void pz;
    const q = [it.x + it.nx * d, it.z + it.nz * d];
    cylinder(paint, q[0], y + 0.2, q[1], 0.07, 2.6, 6);
    box(glow, q[0], y + 2.75, q[1], 0.32, 0.4, 0.32, 0, { u: 1 });
  }
  if (it.kind === 'main') {
    const q = [it.x + it.nx * (it.len + 1), it.z + it.nz * (it.len + 1)];
    cylinder(paint, q[0], y, q[1], 0.12, 4.2, 6);
    sphere(B.acc(M.green), q[0], y + 4.5, q[1], 0.3, 6);
  }
  if (it.kind === 'fuel') {
    // the fuel shed and pumps at the end
    const e = it.len - 3;
    col(paint, lin('#e8e2d6'));
    F.box(paint, 0, y + 0.2, e, 3, 2.4, 3, { u: 2 });
    col(paint, lin('#c8261e'));
    F.box(paint, 0, y + 2.6, e, 3.4, 0.2, 3.4, { u: 2 });
    for (const sx of [-1.1, 1.1]) { col(paint, lin('#d8d4c8')); F.box(paint, sx, y + 0.2, e - 2.4, 0.5, 1.4, 0.4, { u: 1 }); }
    const sacc = B.acc(M.sign);
    const S = F.sub(0, y + 2.85, e - 1.75, 0);
    S.y = 0;
    signPanel(sacc, new Fr(F.wx(0, e - 1.72), 0, F.wz(0, e - 1.72), ang + Math.PI), 0, y + 2.85, 0, 3.2, 0.8, 5);
    void S;
  }
  col(deck, WHITE); col(paint, WHITE);
}

function buildBoathouse(B, M, it) {
  const F = new Fr(it.x, 0, it.z, it.ry);   // local +z into the lake
  const wall = B.acc(M.wall), roof = B.acc(M.tin), paint = B.acc(M.paint), deck = B.acc(M.deck);
  const w = 9, d = 16;
  const y0 = LAKE_Y + 0.7;
  // piles under it
  col(paint, lin('#4a3a2c'));
  for (let lz = -d / 2; lz <= d / 2; lz += 4) for (const lx of [-w / 2, w / 2]) {
    const [px, , pz] = F.p(lx, 0, lz);
    cylinder(paint, px, Math.min(B.groundY(px, pz), LAKE_Y) - 2, pz, 0.18, y0 + 2 - Math.min(B.groundY(px, pz), LAKE_Y), 6);
  }
  col(deck, lin('#b8a68c'));
  F.box(deck, 0, y0 - 0.3, -d / 2 + 2, w + 1.6, 0.3, 4, { u: 2 });
  // walls: the lake end has the boat door (band 3), the sides windows (band 2)
  const tint = lin(it.tint);
  col(wall, tint);
  storey(wall, it.x, y0, it.z, w, d, it.ry, 2, 'lr');
  storey(wall, it.x, y0, it.z, w, d, it.ry, 3, 'fb');
  // gable roof (ridge along local z: the long way)
  col(roof, lin('#6a6e70'));
  gable(roof, it.x, y0 + STOREY, it.z, w, d, 2.6, it.ry, { over: 0.5, alongZ: true, endAcc: deck });
  col(wall, WHITE); col(roof, WHITE); col(paint, WHITE); col(deck, WHITE);
}

function buildShop(B, M, it) {
  const F = new Fr(it.x, 0, it.z, it.ry);
  const g = B.footY(it.x, it.z, it.w, it.d, it.ry);
  const y0 = g.hi + 0.3;
  const wall = B.acc(M.wall), roof = B.acc(M.roof), stone = B.acc(M.stone), paint = B.acc(M.paint), deck = B.acc(M.deck);
  col(stone, lin('#7a766e'));
  F.box(stone, 0, g.lo - 1, 0, it.w, y0 - g.lo + 1, it.d, { u: 2 });
  col(wall, lin('#9fc4d8'));
  storey(wall, it.x, y0, it.z, it.w, it.d, it.ry, 5, 'f');
  storey(wall, it.x, y0, it.z, it.w, it.d, it.ry, 2, 'blr');
  col(roof, lin('#3a4a5a'));
  gable(roof, it.x, y0 + STOREY, it.z, it.w, it.d, 2.4, it.ry, { over: 0.6, endAcc: deck });
  // the porch along the front, its roof, the signs
  col(deck, lin('#a89478'));
  F.box(deck, 0, y0 - 0.25, it.d / 2 + 1.4, it.w, 0.25, 2.8, { u: 2 });
  col(paint, lin('#e8e4d8'));
  for (const lx of [-it.w / 2 + 0.3, -it.w / 6, it.w / 6, it.w / 2 - 0.3]) F.box(paint, lx, y0, it.d / 2 + 2.6, 0.18, 2.7, 0.18, { u: 1 });
  col(roof, lin('#3a4a5a'));
  roof.quadP(F.p(-it.w / 2, y0 + 2.7, it.d / 2 + 2.9), F.p(it.w / 2, y0 + 2.7, it.d / 2 + 2.9), F.p(it.w / 2, y0 + 3.1, it.d / 2), F.p(-it.w / 2, y0 + 3.1, it.d / 2));
  const sacc = B.acc(M.sign);
  signPanel(sacc, F, 0, y0 + STOREY + 0.4, it.d / 2 + 0.55, 7.6, 1.9, 0);
  signPanel(sacc, F, 0, y0 + 2.75, it.d / 2 + 2.95, 6, 0.36, 1);
  // ice chest, drums, a canoe rack
  col(paint, lin('#e8f0f4'));
  F.box(paint, it.w / 2 - 1.2, y0, it.d / 2 + 1.6, 1.4, 1.0, 0.8, { u: 1 });
  drum(paint, F.wx(-it.w / 2 - 1, it.d / 2 - 1), g.lo, F.wz(-it.w / 2 - 1, it.d / 2 - 1), '#3a6a9a');
  canoe(paint, F.wx(-it.w / 2 - 2.2, 0), g.lo + 0.9, F.wz(-it.w / 2 - 2.2, 0), it.ry, '#c83a2a');
  canoe(paint, F.wx(-it.w / 2 - 2.2, 0), g.lo + 1.5, F.wz(-it.w / 2 - 2.2, 0), it.ry, '#2a8a5a');
  col(wall, WHITE); col(roof, WHITE); col(stone, WHITE); col(paint, WHITE); col(deck, WHITE);
}

function buildCabin(B, M, it) {
  const F = new Fr(it.x, 0, it.z, it.ry);
  const g = B.footY(it.x, it.z, it.w, it.d, it.ry);
  const y0 = g.hi + 0.45;
  const wall = B.acc(M.wall), roof = B.acc(M.roof), stone = B.acc(M.stone), paint = B.acc(M.paint), deck = B.acc(M.deck);
  const w = it.w, d = it.d;
  // stone footing
  col(stone, lin('#7d786e'));
  F.box(stone, 0, g.lo - 0.8, 0, w, y0 - g.lo + 0.8, d, { u: 2 });
  const tint = lin(it.tint);
  col(wall, tint);
  if (it.kind === 'aframe') {
    // an A-frame: the roof down to the ground, a glazed gable front, a deck
    const rise = 6.8, ov = 0.4;
    col(roof, lin(it.roofTint));
    const hw = w / 2 + ov, hd = d / 2;
    roof.quadP(F.p(-hw, y0 - 0.3, hd + 0.6), F.p(-hw, y0 - 0.3, -hd - 0.6), F.p(0, y0 + rise, -hd - 0.6), F.p(0, y0 + rise, hd + 0.6));
    roof.quadP(F.p(hw, y0 - 0.3, -hd - 0.6), F.p(hw, y0 - 0.3, hd + 0.6), F.p(0, y0 + rise, hd + 0.6), F.p(0, y0 + rise, -hd - 0.6));
    // the gable ends: back in logs (band 1), front in glass (lit warm or dark)
    const ends = (lz, glass) => {
      const k = glass ? 0 : 1;
      const v0 = k / BANDS, v1 = v0 + 1 / BANDS;
      const A = F.p(lz > 0 ? -w / 2 : w / 2, y0, lz), Bp = F.p(lz > 0 ? w / 2 : -w / 2, y0, lz), T = F.p(0, y0 + rise - 0.4, lz);
      const ia = wall.v(...A, 0, v0), ib = wall.v(...Bp, w / 8, v0), it2 = wall.v(...T, w / 16, v1 + (rise - 3.4) / (STOREY * BANDS));
      wall.tri(ia, ib, it2);
    };
    ends(d / 2, true); ends(-d / 2, false);
    // big triangle of glass on the front: lit panes
    const gl = B.acc(it.lit > 0.35 ? M.warmwin : M.paint);
    if (gl.c) gl.col = lin('#1a2028');
    const gA = F.p(-w / 2 + 1.2, y0 + 0.4, d / 2 + 0.05), gB = F.p(w / 2 - 1.2, y0 + 0.4, d / 2 + 0.05), gT = F.p(0, y0 + rise - 1.6, d / 2 + 0.05);
    const a = gl.v(...gA), b = gl.v(...gB), c = gl.v(...gT);
    gl.tri(a, b, c);
    if (gl.c) gl.col = WHITE;
    col(deck, lin('#a08a6a'));
    F.box(deck, 0, y0 - 0.25, d / 2 + 1.8, w + 1, 0.25, 3.4, { u: 2 });
    col(paint, lin('#6a5038'));
    for (const lx of [-w / 2, w / 2]) F.box(paint, lx, y0, d / 2 + 3.4, 0.1, 1.0, 0.1, { u: 1 });
    beam(paint, F.p(-w / 2, y0 + 1.0, d / 2 + 3.4), F.p(w / 2, y0 + 1.0, d / 2 + 3.4), 0.08, 0.08);
  } else {
    const storeys = it.kind === 'lodge' ? 2 : 1;
    for (let k = 0; k < storeys; k++) {
      storey(wall, it.x, y0 + k * STOREY, it.z, w, d, it.ry, 0, 'fb');
      storey(wall, it.x, y0 + k * STOREY, it.z, w, d, it.ry, k ? 0 : 1, 'lr');
    }
    const top = y0 + storeys * STOREY;
    col(roof, lin(it.roofTint));
    col(deck, scaleTint(tint, 0.8));
    gable(roof, it.x, top, it.z, w, d, it.kind === 'lodge' ? 3.4 : 2.6, it.ry, { over: 0.7, endAcc: deck });
    // the porch: deck, posts, a shed roof
    col(deck, lin('#a08a6a'));
    F.box(deck, 0, y0 - 0.25, d / 2 + 1.3, w, 0.25, 2.6, { u: 2 });
    col(paint, lin('#5a4030'));
    for (const lx of [-w / 2 + 0.2, 0, w / 2 - 0.2]) F.box(paint, lx, y0, d / 2 + 2.45, 0.2, 2.5, 0.2, { u: 1 });
    col(roof, lin(it.roofTint));
    roof.quadP(F.p(-w / 2 - 0.3, y0 + 2.5, d / 2 + 2.8), F.p(w / 2 + 0.3, y0 + 2.5, d / 2 + 2.8), F.p(w / 2 + 0.3, y0 + 2.95, d / 2), F.p(-w / 2 - 0.3, y0 + 2.95, d / 2));
    // a door
    col(paint, lin('#4a3020'));
    F.box(paint, -w * 0.12, y0, d / 2 + 0.02, 1.0, 2.1, 0.08, { u: 1 });
    // the stone chimney at one end
    col(stone, lin('#8a8478'));
    const sx = (it.seed < 0.5 ? -1 : 1) * (w / 2 + 0.5);
    F.box(stone, sx, g.lo - 0.5, -d * 0.15, 1.4, top - g.lo + 4.0, 1.4, { u: 2 });
    if (it.kind === 'lodge') {
      // a balcony on the upper storey
      col(deck, lin('#a08a6a'));
      F.box(deck, 0, y0 + STOREY - 0.2, d / 2 + 0.9, w * 0.7, 0.2, 1.8, { u: 2 });
      col(paint, lin('#5a4030'));
      beam(paint, F.p(-w * 0.35, y0 + STOREY + 0.9, d / 2 + 1.8), F.p(w * 0.35, y0 + STOREY + 0.9, d / 2 + 1.8), 0.08, 0.08);
    }
  }
  // the porch light
  const pl = toWorld(it.x, it.z, it.ry, w * 0.25, d / 2 + 0.15);
  box(B.acc(M.lamp), pl[0], g.hi + 2.6, pl[1], 0.22, 0.3, 0.22, it.ry, { u: 1 });
  // a woodpile, a canoe, a pickup
  col(paint, lin('#7a5a3a'));
  F.box(paint, -(it.seed < 0.5 ? -1 : 1) * (w / 2 + 0.8), g.lo, -d * 0.2, 1.0, 1.1, 3, { u: 1 });
  if (it.canoe) canoe(paint, F.wx(w / 2 + 2, -1), g.lo + 0.05, F.wz(w / 2 + 2, -1), it.ry + 0.2, it.seed < 0.5 ? '#c83a2a' : '#2a6a8a');
  if (it.truck) {
    const t = toWorld(it.x, it.z, it.ry, -w / 2 - 3.5, d / 2 + 2);
    const ty = B.groundY(t[0], t[1]);
    pickup(paint, t[0], ty, t[1], it.ry + Math.PI + 0.15, it.truck);
  }
  col(wall, WHITE); col(roof, WHITE); col(stone, WHITE); col(paint, WHITE); col(deck, WHITE);
}

const scaleTint = (c, k) => [c[0] * k, c[1] * k, c[2] * k];

function buildCampsite(B, M, it, anims) {
  const F = new Fr(it.x, 0, it.z, it.ry);
  const paint = B.near(M.paint);
  const gy = B.groundY(it.x, it.z);
  // the pad (packed gravel)
  const st = B.acc(M.stone);
  drapeUV(st, B, [F.p(-5.5, 0, -4.5), F.p(5.5, 0, -4.5), F.p(5.5, 0, 4.5), F.p(-5.5, 0, 4.5)].map((p) => [p[0], p[2]]), { lift: 0.07, step: 4, uv: 3, col: lin('#8a7a62') });
  col(st, WHITE);
  if (it.kind === 'tent') tent(paint, F.wx(-1.5, -1), B.groundY(F.wx(-1.5, -1), F.wz(-1.5, -1)), F.wz(-1.5, -1), it.ry + 0.3, it.tint);
  else {
    const ca = B.acc(M.paint);
    camper(ca, B.acc(M.warmwin), F.wx(-2, 0), gy, F.wz(-2, 0), it.ry + Math.PI / 2, it.kind === 'rv' ? '#e8e2d0' : '#d8d2c2', it.tint);
  }
  picnicTable(paint, F.wx(2.5, 2.2), B.groundY(F.wx(2.5, 2.2), F.wz(2.5, 2.2)), F.wz(2.5, 2.2), it.ry + 0.4);
  sedan(B.acc(M.paint), F.wx(-1, 3.8), B.groundY(F.wx(-1, 3.8), F.wz(-1, 3.8)), F.wz(-1, 3.8), it.ry + Math.PI / 2 + 0.1, it.car);
  // the fire ring
  const fx = F.wx(3.2, -1.5), fz = F.wz(3.2, -1.5), fy = B.groundY(fx, fz);
  col(paint, lin('#6a6460'));
  for (let k = 0; k < 7; k++) { const a = k / 7 * 6.283; box(paint, fx + Math.cos(a) * 0.7, fy - 0.05, fz + Math.sin(a) * 0.7, 0.35, 0.28, 0.3, a, { u: 1 }); }
  col(paint, WHITE);
  if (it.fire) {
    // a flame (its own mesh: it flickers)
    const g = new THREE.BufferGeometry();
    const p = [], ix = [];
    const ring = (y, r, n) => { const s = p.length / 3; for (let k = 0; k < n; k++) { const a = k / n * 6.283; p.push(Math.cos(a) * r, y, Math.sin(a) * r); } return s; };
    const b0 = ring(0, 0.45, 6), top = p.length / 3; p.push(0, 1.3, 0);
    for (let k = 0; k < 6; k++) ix.push(b0 + k, top, b0 + (k + 1) % 6);
    g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
    g.setIndex(ix);
    const mesh = new THREE.Mesh(g, M.fire);
    mesh.position.set(fx, fy, fz);
    mesh.matrixAutoUpdate = true;
    B.group.add(mesh);
    const ph = hash2(fx, fz) * 10;
    anims.push((t, dt, d) => { if (d > 260) return; const k = 0.8 + 0.25 * Math.sin(t * 13 + ph) + 0.12 * Math.sin(t * 29 + ph * 2); mesh.scale.set(1, k, 1); mesh.rotation.y = t * 0.7 + ph; });
    col(paint, lin('#3a2a1a'));
    for (let k = 0; k < 3; k++) { const a = k * 2.1; box(paint, fx, fy, fz, 1.0, 0.16, 0.16, a, { u: 1 }); }
    col(paint, WHITE);
  }
}

function buildSmallHouse(B, M, it, band, roofHex, tint) {
  const F = new Fr(it.x, 0, it.z, it.ry);
  const g = B.footY(it.x, it.z, it.w, it.d, it.ry);
  const y0 = g.hi + 0.3;
  const wall = B.acc(M.wall), roof = B.acc(M.roof), stone = B.acc(M.stone), deck = B.acc(M.deck);
  col(stone, lin('#7d786e'));
  F.box(stone, 0, g.lo - 0.8, 0, it.w, y0 - g.lo + 0.8, it.d, { u: 2 });
  col(wall, lin(tint));
  storey(wall, it.x, y0, it.z, it.w, it.d, it.ry, band);
  col(roof, lin(roofHex));
  col(deck, lin('#8a7058'));
  gable(roof, it.x, y0 + STOREY, it.z, it.w, it.d, 2.2, it.ry, { over: 0.6, endAcc: deck });
  box(B.acc(M.lamp), F.wx(0, it.d / 2 + 0.2), y0 + 2.4, F.wz(0, it.d / 2 + 0.2), 0.25, 0.3, 0.25, it.ry, { u: 1 });
  col(wall, WHITE); col(roof, WHITE); col(stone, WHITE); col(deck, WHITE);
  return { F, y0 };
}

function buildJetty(B, M, it) {
  const deck = B.acc(M.deck), paint = B.acc(M.paint);
  const ang = Math.atan2(it.nx, it.nz);
  const F = new Fr(it.x, 0, it.z, ang);
  const y = LAKE_Y + 0.55;
  col(deck, lin('#a89880'));
  F.box(deck, 0, y, it.len / 2 - 2, 1.8, 0.2, it.len, { u: 2 });
  F.box(deck, 0, y, it.len - 4, 5, 0.2, 3, { u: 2 });
  col(paint, lin('#4a3a2c'));
  for (let d = -1; d <= it.len - 2; d += 3) for (const sx of [-1, 1]) { const [px, , pz] = F.p(sx, 0, d); cylinder(paint, px, LAKE_Y - 2.5, pz, 0.12, 3.4, 5); }
  // a lantern post at the end, a bench, rods leaning on the rail, a rowboat tied up
  const [lx, , lz] = F.p(1.8, 0, it.len - 3);
  cylinder(paint, lx, y + 0.2, lz, 0.08, 2.6, 5);
  box(B.acc(M.lamp), lx, y + 2.7, lz, 0.28, 0.36, 0.28, ang, { u: 1 });
  bench(paint, F.wx(-1.4, it.len - 3.5), y + 0.2, F.wz(-1.4, it.len - 3.5), ang + Math.PI);
  col(paint, lin('#2a2a2a'));
  for (const sx of [-1.6, -0.6]) beam(paint, F.p(sx, y + 0.2, it.len - 2.6), F.p(sx * 1.3, y + 3.2, it.len + 1.5), 0.03, 0.03);
  boat(paint, F.wx(3.2, it.len - 8), LAKE_Y, F.wz(3.2, it.len - 8), ang + 0.1, 'row', '#3a6a5a');
  // the sign at the root
  const sacc = B.acc(M.sign);
  const [sx, , sz] = F.p(-2.4, 0, -3);
  const sy = B.groundY(sx, sz);
  col(paint, lin('#4a3a2c'));
  for (const o of [-0.9, 0.9]) { const q = F.p(-2.4 + o, 0, -3); box(paint, q[0], sy - 0.3, q[2], 0.12, 2.0, 0.12, ang, { u: 1 }); }
  signPanel(sacc, new Fr(sx, 0, sz, ang + Math.PI), 0, sy + 1.1, -0.08, 2.4, 0.6, 4);
  col(deck, WHITE); col(paint, WHITE);
}

function buildSign(B, M, it) {
  const F = new Fr(it.x, 0, it.z, it.ry);
  const gy = B.groundY(it.x, it.z);
  const paint = B.acc(M.paint);
  col(paint, lin(it.wood ? '#5a3a22' : '#2e3438'));
  const n = it.posts || 2;
  for (let k = 0; k < n; k++) {
    const lx = n === 1 ? 0 : -it.w / 2 + 0.3 + (it.w - 0.6) * (k / (n - 1));
    F.box(paint, lx, gy - 0.5, 0, 0.2, it.post + it.h + 0.6, 0.2, { u: 1 }, 0);
  }
  F.box(paint, 0, gy + it.post - 0.1, -0.08, it.w + 0.3, it.h + 0.2, 0.14, { u: 2 });
  signPanel(B.acc(M.sign), F, 0, gy + it.post, 0.0, it.w, it.h, it.slot);
  // and its back
  signPanel(B.acc(M.sign), new Fr(it.x, 0, it.z, it.ry + Math.PI), 0, gy + it.post, 0.17, it.w, it.h, it.slot);
  col(paint, WHITE);
}

function buildReeds(B, M, it) {
  const acc = B.near(M.leaf);
  const n = 5 + Math.floor(it.t * 5);
  for (let k = 0; k < n; k++) {
    const a = it.t * 40 + k * 2.4, r = 0.3 + ((k * 0.37 + it.t) % 1) * 1.2;
    const x = it.x + Math.cos(a) * r, z = it.z + Math.sin(a) * r;
    const h = 0.9 + ((k * 0.61 + it.t * 3) % 1) * 1.1;
    acc.col = lin(k % 3 ? '#5a6a2e' : '#7a7a3a');
    const lx = 0.06, b0 = acc.v(x - lx, it.y - 0.3, z), b1 = acc.v(x + lx, it.y - 0.3, z), tp = acc.v(x + Math.cos(a) * 0.2, it.y + h, z + Math.sin(a) * 0.2);
    acc.tri(b0, b1, tp); acc.tri(b1, b0, tp);
  }
  acc.col = WHITE;
}

export default {
  id: 'lake',

  plan(P) {
    planDam(P);
    planMarina(P);
    planCamp(P);
    planCabins(P);
    planExtras(P);
    // the lakeside cabins' office (a VACANCY sign on the south shore road)
    const r = P.net.byId.get('lk_south1');
    if (r) {
      const q = r.posAt(300);
      for (const sd of [1, -1]) {
        const lat = sd * 22;
        const x = q.x + r.LX[q.i] * lat, z = q.z + r.LZ[q.i] * lat;
        const ry = Math.atan2(-r.LX[q.i] * sd, -r.LZ[q.i] * sd);
        if (!mine(x, z) || lakeDist(x, z) < 10 || !P.isFree(x, z, 11, 8, ry, { pad: 1 })) continue;
        P.claim(x, z, 11, 8, ry);
        P.add({ type: 'cabinOffice', x, z, ry, w: 11, d: 8, map: 'building' });
        const gy = P.groundY(x, z);
        P.collider({ kind: 'box', x, z, hx: 5.5, hz: 4, ry, y0: gy - 2, y1: gy + 7 });
        P.far({ x, z, w: 11, d: 8, h: 6, ry, color: '#6a4a30', lit: 0.5 });
        const s = toWorld(x, z, ry, 0, 4 + 5);
        P.add({ type: 'sign', x: s[0], z: s[1], ry, slot: 7, w: 4.2, h: 1.1, post: 3.2, posts: 1 });
        P.lamp({ x: s[0], z: s[1], hx: s[0], hz: s[1], hy: gy + 4.2, color: '#ff4a6a', radius: 9, intensity: 0.7, halo: 2.2 });
        P.collider({ kind: 'circle', x: s[0], z: s[1], r: 0.5, y0: gy - 1, y1: gy + 5 });
        break;
      }
    }
  },

  scatter,

  warm(B) { mats(B); },

  *build(B, items) {
    const M = mats(B);
    let n = 0;
    for (const it of items) {
      switch (it.type) {
        case 'pine': pine(B.acc(M.bark), B.acc(M.leaf), it.x, it.y, it.z, it.h, it.t); break;
        case 'fir': fir(B.acc(M.bark), B.acc(M.leaf), it.x, it.y, it.z, it.h, it.t, { bark: '#46392e' }); break;
        case 'bush': bush(B.near(M.leaf), it.x, it.y, it.z, it.s, it.t, '#34502a'); break;
        case 'rock': rock(B.acc(M.stone), it.x, it.y, it.z, it.s, it.t, '#9a968e'); break;
        case 'log': fallenLog(B.near(M.bark), B.near(M.leaf), it.x, it.y, it.z, it.L, it.r, it.ang, it.t); break;
        case 'reeds': buildReeds(B, M, it); break;
        case 'dam': buildDam(B, M, it); yield; break;
        case 'marinaLot': buildMarinaLot(B, M, it); break;
        case 'pier': buildPier(B, M, it); break;
        case 'boathouse': buildBoathouse(B, M, it); break;
        case 'shop': buildShop(B, M, it); break;
        case 'cabin': buildCabin(B, M, it); break;
        case 'campsite': buildCampsite(B, M, it, B.out.anims); break;
        case 'campoffice': { const { F, y0 } = buildSmallHouse(B, M, it, 0, '#3a5a3a', '#ffffff'); signPanel(B.acc(M.sign), F, 0, y0 + STOREY + 0.2, it.d / 2 + 0.45, 4.6, 1.15, 2); break; }
        case 'restroom': buildSmallHouse(B, M, it, 2, '#5a4a3a', '#8a6a4a'); break;
        case 'cabinOffice': buildSmallHouse(B, M, it, 0, '#7a3a2a', '#ffffff'); break;
        case 'shack': buildSmallHouse(B, M, it, 2, '#4a4a4a', '#7a8a7a'); break;
        case 'jetty': buildJetty(B, M, it); break;
        case 'sign': buildSign(B, M, it); break;
        case 'campLamp': {
          const gy = B.groundY(it.x, it.z), p = B.acc(M.paint);
          col(p, lin('#4a3424')); box(p, it.x, gy - 0.4, it.z, 0.22, 4.0, 0.22, 0, { u: 1 }); col(p, WHITE);
          box(B.acc(M.lamp), it.x, gy + 3.4, it.z, 0.3, 0.4, 0.3, 0, { u: 1 });
          break;
        }
        case 'boatOut': boat(B.acc(M.paint), it.x, LAKE_Y, it.z, it.ry, it.kind, it.tint); break;
        case 'buoy': {
          const p = B.near(M.paint);
          col(p, lin(it.red ? '#c8261e' : '#e8e8e0'));
          cylinder(p, it.x, LAKE_Y - 0.4, it.z, 0.35, 1.0, 7, { top: true });
          col(p, WHITE);
          break;
        }
        default: break;
      }
      if (++n % 24 === 0) yield;
    }
  },
};
