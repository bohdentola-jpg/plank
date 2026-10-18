// PORT HALCYON — CRESTWOOD HILLS: wine country on the plateau above the
// lake's north-east shore. Vineyard blocks cover the slopes, their rows
// running down the fall line, low dry-stone walls along the lanes, Italian
// cypress in lines along the drives, olive groves on the stony ground to the
// west. Crestwood Winery's château stands at the end of its cypress avenue
// (Winery Rd, off the pass road) with its tower, barrel hall and tasting
// terrace; up Via Serena on the hill to the west is Villa Serena. Stone
// farmhouses (cascine) sit along Crestwood Rd. Crestwood Circuit runs round
// the middle of it all: a cream-and-terracotta pit building on the long
// straight, classic grandstands with white sail roofs.
import * as THREE from 'three';
import { litMat, glowColorMat, box, cylinder, cone, gable, hip } from './builder.js';
import { concreteTexture } from '../../track/textures.js';
import { makeRng } from '../../core/util.js';
import { owns, toWorld, lin, mixc, hash2, rectPoly } from './westkit/util.js';
import { Fr, tube, lathe, beam, drapeUV, col, wallAlong, stringLights } from './westkit/geo.js';
import { bandAtlas, windowPane, roofTex, signAtlas, text, speckle, streaks, cvs, once } from './westkit/tex.js';
import { cypress, olive, oak, bush, rock } from './westkit/veg.js';
import { pickup, sedan, tractor } from './westkit/props.js';
import { toTex } from '../../track/textures.js';
import {
  raceMats, lapSamples, planRunoffs, placeFoot, planPitStraight, planStand, planMasts, planBoards, planMarshals,
  buildGravel, buildTyres, buildWall, buildStand, buildMast, buildGantry, buildStartLine, buildBoard, buildMarshal, buildPaddock, buildPole,
} from './westkit/race.js';

const ID = 'crestwood';
const mine = (x, z) => owns(ID, x, z);
const LOOP = ['cw_l0', 'cw_l1', 'cw_l2', 'cw_l3'];
const WHITE = [1, 1, 1];
const STOREY = 3.4, BANDS = 6;   // atlas: 0 stucco + shutters, 1 stucco, 2 stone + arched windows, 3 stone, 4 pit garages, 5 stone + cellar arches
const ST = { lamp: '#fff2dc', gravel: '#d8ccb0', wall: '#e8e2d4', post: '#5a5e62', seats: ['#b8282a', '#e8e4dc', '#b8282a'], roof: '#f4f1ea', steel: '#c8c2b8', stand: 'classic', mast: '#c8c8c4', mastKind: 'pole', gantry: '#e0dcd4', marshal: '#e8e0d0' };

// ------------------------------------------------------------------ textures

function walls() {
  return bandAtlas('cw-walls', 512, 172, [
    // 0: stucco with shuttered windows (some lit)
    (x, e, W, H, rng) => { stucco(x, W, H, rng); for (const wx of [70, 326]) shutters(x, e, wx, 46, 116, 92, rng() < 0.55, rng); },
    // 1: plain stucco with a band
    (x, e, W, H, rng) => { stucco(x, W, H, rng); x.fillStyle = 'rgba(120,80,50,0.18)'; x.fillRect(0, H - 14, W, 14); },
    // 2: dressed stone with tall arched windows
    (x, e, W, H, rng) => {
      stone(x, W, H, rng);
      for (const wx of [80, 336]) {
        const lit = rng() < 0.5;
        x.fillStyle = '#d8ccb4'; x.beginPath(); x.moveTo(wx - 8, H - 18); x.lineTo(wx - 8, 74); x.arc(wx + 48, 74, 56, Math.PI, 0); x.lineTo(wx + 104, H - 18); x.fill();
        const g = x.createLinearGradient(0, 30, 0, H - 24);
        g.addColorStop(0, lit ? '#ffe0a0' : '#283038'); g.addColorStop(1, lit ? '#e8a858' : '#1a2026');
        x.fillStyle = g; x.beginPath(); x.moveTo(wx, H - 24); x.lineTo(wx, 74); x.arc(wx + 48, 74, 48, Math.PI, 0); x.lineTo(wx + 96, H - 24); x.fill();
        x.fillStyle = '#3a3026'; x.fillRect(wx + 46, 30, 4, H - 54); x.fillRect(wx, 96, 96, 4);
        if (lit) { e.fillStyle = '#ffb860'; e.globalAlpha = 0.75; e.beginPath(); e.moveTo(wx, H - 24); e.lineTo(wx, 74); e.arc(wx + 48, 74, 48, Math.PI, 0); e.lineTo(wx + 96, H - 24); e.fill(); e.globalAlpha = 1; }
      }
    },
    // 3: dressed stone
    (x, e, W, H, rng) => stone(x, W, H, rng),
    // 4: pit garages under terracotta trim
    (x, e, W, H, rng) => {
      stucco(x, W, H, rng);
      const teams = ['#c8161e', '#1d4fa8', '#f0a818', '#1b1b1d', '#2f9a4a', '#e6e6e6', '#ff6a00', '#5a2a8a'];
      x.fillStyle = '#b4583a'; x.fillRect(0, 0, W, 12);
      for (const gx of [18, 274]) {
        const team = teams[Math.floor(rng() * teams.length)];
        x.fillStyle = team; x.fillRect(gx, 18, 220, 14);
        if (rng() < 0.72) {
          const g = x.createLinearGradient(0, 36, 0, H);
          g.addColorStop(0, '#fbf6ea'); g.addColorStop(1, '#b8b2a4');
          x.fillStyle = g; x.fillRect(gx + 6, 36, 208, H - 36);
          x.fillStyle = team; x.beginPath(); x.moveTo(gx + 40, H - 6); x.lineTo(gx + 62, H - 42); x.lineTo(gx + 160, H - 46); x.lineTo(gx + 190, H - 6); x.fill();
          x.fillStyle = '#111'; x.fillRect(gx + 50, H - 14, 26, 14); x.fillRect(gx + 150, H - 14, 26, 14);
          e.fillStyle = '#fff4e0'; e.globalAlpha = 0.85; e.fillRect(gx + 6, 36, 208, H - 36); e.globalAlpha = 1;
        } else {
          for (let y = 36; y < H; y += 9) { x.fillStyle = (y / 9) % 2 ? '#9a9890' : '#aeaca4'; x.fillRect(gx + 6, y, 208, 9); }
        }
      }
    },
    // 5: stone with cellar arches (dark, a lantern in each)
    (x, e, W, H, rng) => {
      stone(x, W, H, rng);
      for (const wx of [40, 296]) {
        x.fillStyle = '#c8bca4'; x.beginPath(); x.moveTo(wx - 8, H); x.lineTo(wx - 8, 96); x.arc(wx + 88, 96, 96, Math.PI, 0); x.lineTo(wx + 184, H); x.fill();
        x.fillStyle = '#2a2018'; x.beginPath(); x.moveTo(wx, H); x.lineTo(wx, 96); x.arc(wx + 88, 96, 88, Math.PI, 0); x.lineTo(wx + 176, H); x.fill();
        for (let k = 0; k < 6; k++) { x.fillStyle = '#4a3220'; x.fillRect(wx + 8 + k * 28, 100, 24, H - 100); x.fillStyle = '#3a2618'; x.fillRect(wx + 8 + k * 28, 100, 24, 4); }
        x.fillStyle = '#ffd890'; x.fillRect(wx + 84, 40, 10, 14); e.fillStyle = '#ffc070'; e.fillRect(wx + 82, 38, 14, 18);
      }
    },
  ]);
}

function stucco(x, W, H, rng) {
  x.fillStyle = '#ece0c8'; x.fillRect(0, 0, W, H);
  speckle(x, W, H, rng, 3000, ['#d8c8a8', '#fff6e4', '#c8b494'], 0.15, 0.4);
  for (let i = 0; i < 12; i++) {
    const px = rng() * W, py = rng() * H, r = 10 + rng() * 40;
    const g = x.createRadialGradient(px, py, 0, px, py, r);
    g.addColorStop(0, 'rgba(180,150,110,0.18)'); g.addColorStop(1, 'rgba(180,150,110,0)');
    x.fillStyle = g; x.fillRect(px - r, py - r, r * 2, r * 2);
  }
  streaks(x, W, H, rng, 8, '120,100,70', 0.1);
}

function stone(x, W, H, rng) {
  x.fillStyle = '#b8a888'; x.fillRect(0, 0, W, H);
  for (let y = 0, r = 0; y < H; y += 22, r++) {
    for (let px = (r % 2) * -24; px < W; px += 48) {
      const t = 0.85 + rng() * 0.25;
      x.fillStyle = `rgb(${196 * t},${180 * t},${148 * t})`;
      x.fillRect(px + 2, y + 2, 44, 18);
    }
  }
  speckle(x, W, H, rng, 2000, ['#7a6a50', '#e8dcc4'], 0.1, 0.3);
}

function shutters(x, e, wx, wy, ww, wh, lit, rng) {
  x.fillStyle = '#d8ccb0'; x.fillRect(wx - 6, wy - 6, ww + 12, wh + 12);
  const g = x.createLinearGradient(0, wy, 0, wy + wh);
  g.addColorStop(0, lit ? '#ffe2a8' : '#2a3036'); g.addColorStop(1, lit ? '#e8a860' : '#1c2226');
  x.fillStyle = g; x.fillRect(wx, wy, ww, wh);
  x.fillStyle = '#3a3026'; x.fillRect(wx + ww / 2 - 2, wy, 4, wh); x.fillRect(wx, wy + wh / 2 - 2, ww, 4);
  if (lit) { e.fillStyle = '#ffc070'; e.globalAlpha = 0.7; e.fillRect(wx, wy, ww, wh); e.globalAlpha = 1; }
  // green shutters, open
  const sc = rng() < 0.5 ? '#3e5a3a' : '#5a6a4a';
  for (const sx of [wx - 34, wx + ww + 6]) {
    x.fillStyle = sc; x.fillRect(sx, wy - 4, 28, wh + 8);
    x.fillStyle = 'rgba(0,0,0,0.25)'; for (let k = 0; k < 9; k++) x.fillRect(sx + 2, wy + k * (wh / 9), 24, 2);
  }
}

/** Vineyard ground: dry soil with the vine rows (rows along u: 4 rows per repeat). */
function vineTex() {
  return once('cw:vines', () => {
    const [c, x] = cvs(256, 256);
    const rng = makeRng('vines');
    x.fillStyle = '#8a7356'; x.fillRect(0, 0, 256, 256);
    speckle(x, 256, 256, rng, 5000, ['#6e5a42', '#a08868', '#7a6448'], 0.2, 0.5);
    for (let r = 0; r < 4; r++) {
      const y0 = r * 64 + 18;
      x.fillStyle = 'rgba(60,48,34,0.35)'; x.fillRect(0, y0 - 6, 256, 40);
      for (let i = 0; i < 160; i++) {
        const px = rng() * 256, py = y0 + 2 + rng() * 24, s = 3 + rng() * 7;
        x.fillStyle = ['#3e5a24', '#4e6a2a', '#5a7a30', '#36501e'][(rng() * 4) | 0];
        x.beginPath(); x.arc(px, py, s, 0, 6.283); x.fill();
      }
    }
    return toTex(c);
  });
}

function signs() {
  return signAtlas('crestwood', [
    // 0 CRESTWOOD WINERY (cream on deep red, gold rules)
    (x, e, w, h) => {
      x.fillStyle = '#5a1a1e'; x.fillRect(0, 0, w, h);
      x.strokeStyle = '#c8a050'; x.lineWidth = 4; x.strokeRect(10, 10, w - 20, h - 20);
      text(x, 'CRESTWOOD', w / 2, 50, 50, '#f0e2c0', { max: w - 60, f: 'Georgia, "Times New Roman", serif', w: 700 });
      text(x, 'WINERY · EST. 1891', w / 2, 96, 22, '#c8a050', { f: 'Georgia, serif', w: 400 });
      text(e, 'CRESTWOOD', w / 2, 50, 50, '#ffe0a0', { max: w - 60, f: 'Georgia, "Times New Roman", serif', w: 700, glow: '#ffb050', blur: 10 });
    },
    // 1 VILLA SERENA (a brass plaque)
    (x, e, w, h) => {
      const g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#c8a860'); g.addColorStop(1, '#8a6a30');
      x.fillStyle = g; x.fillRect(0, 0, w, h);
      text(x, 'VILLA SERENA', w / 2, h / 2, 54, '#3a2810', { max: w - 60, f: 'Georgia, serif', w: 700 });
      e.globalAlpha = 0.25; e.fillStyle = '#c8a860'; e.fillRect(0, 0, w, h); e.globalAlpha = 1;
    },
    // 2 CRESTWOOD CIRCUIT
    (x, e, w, h) => {
      x.fillStyle = '#f4f1ea'; x.fillRect(0, 0, w, h);
      x.fillStyle = '#b8282a'; x.fillRect(0, h - 22, w, 22);
      text(x, 'CRESTWOOD CIRCUIT', w / 2, 52, 50, '#7a1a1a', { max: w - 40, italic: true });
      e.globalAlpha = 0.4; e.fillStyle = '#f4f1ea'; e.fillRect(0, 0, w, h - 22); e.globalAlpha = 1;
      text(e, 'CRESTWOOD CIRCUIT', w / 2, 52, 50, '#b82a2a', { max: w - 40, italic: true });
    },
    // 3 TASTING ROOM · OPEN
    (x, e, w, h) => {
      x.fillStyle = '#2a1a14'; x.fillRect(0, 0, w, h);
      text(x, 'TASTING ROOM', w / 2 - 60, h / 2, 46, '#f0e2c0', { max: 330, f: 'Georgia, serif', w: 700 });
      text(x, 'OPEN', w - 80, h / 2, 34, '#ffb050'); text(e, 'OPEN', w - 80, h / 2, 34, '#ffa040', { glow: '#ff8a20', blur: 16 });
      text(e, 'TASTING ROOM', w / 2 - 60, h / 2, 46, '#a08060', { max: 330, f: 'Georgia, serif', w: 700 });
    },
    // 4 WINERY RD road sign
    (x, e, w, h) => {
      x.fillStyle = '#5a1a1e'; x.fillRect(0, 0, w, h);
      x.strokeStyle = '#f0e2c0'; x.lineWidth = 6; x.strokeRect(8, 8, w - 16, h - 16);
      text(x, 'WINERY RD  →', w / 2, h / 2, 50, '#f0e2c0', { max: w - 40 });
      e.globalAlpha = 0.3; text(e, 'WINERY RD  →', w / 2, h / 2, 50, '#ffffff', { max: w - 40 }); e.globalAlpha = 1;
    },
    // 5 PIT LANE / RACE CONTROL
    (x, e, w, h) => {
      x.fillStyle = '#7a1a1a'; x.fillRect(0, 0, w, h);
      text(x, 'RACE CONTROL', w / 2, h / 2, 56, '#f4f1ea', { max: w - 40 });
      text(e, 'RACE CONTROL', w / 2, h / 2, 56, '#ffe8d0', { max: w - 40, glow: '#ff8060', blur: 10 });
    },
  ]);
}
const signUV = (k) => signs().uv(k);

function mats(B) {
  const R = raceMats(B, ST);
  return {
    ...R,
    wall: B.mat('wall', () => { const t = walls(); return litMat({ map: t.map, emissive: 0xffffff, emissiveMap: t.emi, vertexColors: true, roughness: 0.85 }, { night: 1.0 }); }),
    roof: B.mat('roof', () => litMat({ map: roofTex('tile'), vertexColors: true, roughness: 0.85 })),
    stone: B.mat('stone', () => litMat({ map: concreteTexture('#a8987c', 'cwstone'), vertexColors: true, roughness: 0.95 })),
    vines: B.mat('vines', () => litMat({ map: vineTex(), roughness: 0.95, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 })),
    vine: B.mat('vine', () => litMat({ vertexColors: true, side: THREE.DoubleSide, roughness: 0.9 }, { shadow: false })),
    leaf: B.mat('leaf', () => litMat({ vertexColors: true, flatShading: true, roughness: 0.9 })),
    trunk: B.mat('trunk', () => litMat({ vertexColors: true, roughness: 0.95 })),
    sign: B.mat('sign', () => { const t = signs(); return litMat({ map: t.map, emissive: 0xffffff, emissiveMap: t.emi, roughness: 0.6 }, { night: 1.4 }); }),
    lamp: B.mat('lamp', () => glowColorMat('#ffc880', 3)),
    win: B.mat('win', () => glowColorMat('#ffb860', 1.5)),
    pool: B.mat('pool', () => litMat({ color: 0x3aa8c8, emissive: 0x2a9ac0, roughness: 0.15, metalness: 0.1 }, { night: 0.9 })),
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

/** A roadside lot (see redwood): → { x, z, ry, s, g } or null. */
function roadside(P, r, s0, s1, sd, back, w, d, o = {}) {
  const reach = r.rt.hw + r.rt.shoulder + r.rt.walk;
  for (let s = s0; s <= s1; s += o.step || 8) {
    const p = r.posAt(s);
    const lx = r.LX[p.i], lz = r.LZ[p.i];
    const off = reach + back + d / 2;
    const x = p.x + lx * sd * off, z = p.z + lz * sd * off;
    const ry = Math.atan2(-lx * sd, -lz * sd);
    if (!mine(x, z) || !P.isFree(x, z, w, d, ry, { pad: o.pad ?? 1, roadPad: true })) continue;
    const g = P.groundRange(x, z, w, d, ry);
    if (g.hi - g.lo > (o.slope ?? 5)) continue;
    return { x, z, ry, s, g };
  }
  return null;
}

/** A line of cypress beside road r from s0 to s1 every `every` m on side(s) sds. */
function cypressLine(P, r, s0, s1, sds, every, off = 2.6) {
  const reach = r.rt.hw + r.rt.shoulder + r.rt.walk;
  for (let s = s0; s <= s1; s += every) {
    const p = r.posAt(s);
    for (const sd of sds) {
      const x = p.x + r.LX[p.i] * sd * (reach + off), z = p.z + r.LZ[p.i] * sd * (reach + off);
      if (!mine(x, z) || !P.isFree(x, z, 1.6, 1.6, 0, { pad: 0.2, roadPad: false })) continue;
      P.claim(x, z, 1.6, 1.6, 0);
      const y = P.groundY(x, z), h = P.range(11, 16);
      P.add({ type: 'cypress', x, z, y, h, t: P.rng() });
      P.collider({ kind: 'circle', x, z, r: 0.7, y0: y - 1, y1: y + h });
    }
  }
}

// ------------------------------------------------------------------ plan

function planCircuit(P) {
  const lap = lapSamples(P.net, LOOP, 4);
  if (!lap.samples.length) return;
  // the main straight runs north along x −1460 (cw_l0's end, cw_l1's start);
  // the pits on its left (west: the infield), the main stand across from them
  planPitStraight(P, lap, { S0: 372, S1: 655, side: 1, type: 'pits', w: 140, d: 16, h: 14, mid: 512, color: '#d8c8a8', lamp: ST.lamp, start: 470 });
  planStand(P, lap, 505, -1, { w: 130, d: 20, h: 12, tiers: 10, gap: 3.4, wall: 11.2, kind: 'classic', color: '#e8e2d4' });
  // the hairpin at the top (cw_l1's 170° left) and the carousel (cw_l3's long left)
  const hp = lap.samples.reduce((b, p) => (p.z < b.z ? p : b), lap.samples[0]);
  planStand(P, lap, hp.s, hp.k > 0 ? -1 : 1, { w: 60, d: 16, h: 9, tiers: 8, gap: 22, wall: false, roadPad: true, kind: 'classic', color: '#e8e2d4' });
  const cr = lap.samples.reduce((b, p) => (p.x < b.x ? p : b), lap.samples[0]);
  planStand(P, lap, cr.s, cr.k > 0 ? -1 : 1, { w: 70, d: 16, h: 9, tiers: 8, gap: 24, wall: false, roadPad: true, kind: 'classic', color: '#e8e2d4' });
  planRunoffs(P, lap, { w: [12, 26], kmin: 1 / 220, fence: 2.4 });
  planMasts(P, lap, 100, 22, ST.lamp, { kind: 'pole', radius: 42, intensity: 1.05 });
  planBoards(P, lap);
  planMarshals(P, lap, 240);
  // the circuit's sign at its gate
  const gate = P.net.byId.get('cw_gate');
  if (gate) {
    const p = gate.posAt(gate.length * 0.55);
    const off = gate.rt.hw + gate.rt.shoulder + gate.rt.walk + 3;
    const x = p.x + gate.LX[p.i] * off, z = p.z + gate.LZ[p.i] * off;
    P.add({ type: 'sign', x, z, ry: Math.atan2(-gate.TX[p.i], -gate.TZ[p.i]) + 0.5, slot: 2, w: 6.4, h: 1.6, post: 2.2, kind: 'piers' });
    P.lamp({ x, z, hx: x, hz: z, hy: P.groundY(x, z) + 4.5, color: '#fff0d8', radius: 10, intensity: 0.8, halo: 1.0 });
  }
}

function planWinery(P) {
  const r = P.net.byId.get('cw_winery');
  if (!r) return;
  const e = r.posAt(r.length);
  const t = { x: r.TX[r.N - 1], z: r.TZ[r.N - 1] };
  const ry = Math.atan2(t.x, t.z);                // looking up the drive: local +z ahead
  const F = new Fr(e.x, 0, e.z, ry);
  // the forecourt: gravel, a fountain, walled
  const fc = F.sub(0, 0, 18);
  P.claim(fc.x, fc.z, 40, 34, ry);
  P.add({ type: 'court', x: fc.x, z: fc.z, ry, w: 40, d: 34, map: 'plaza' });
  P.collider({ kind: 'circle', x: fc.x, z: fc.z, r: 2.4, y0: P.groundY(fc.x, fc.z) - 1, y1: P.groundY(fc.x, fc.z) + 1.4 });
  // the château across the far side of it, facing back down the drive; its tower on the left
  const hx = F.wx(0, 18 + 17 + 9), hz = F.wz(0, 18 + 17 + 9);
  const house = placeFoot(P, { type: 'chateau', x: hx, z: hz, ry: ry + Math.PI, w: 34, d: 16, seed: P.rng(), map: 'building' }, 16, { pad: 0.3, roadPad: false, color: '#d8c8a8', lit: 0.5 });
  if (house) {
    const tx = F.wx(-21, 18 + 17 + 9), tz = F.wz(-21, 18 + 17 + 9);
    if (placeFoot(P, { type: 'tower', x: tx, z: tz, ry: ry + Math.PI, w: 8, d: 8, h: 26, map: 'building' }, 33, { pad: 0, roadPad: false, far: false })) {
      const gy = P.groundY(tx, tz);
      P.far({ x: tx, z: tz, y: gy - 1, w: 8, d: 8, h: 27, ry, color: '#c8b494', lit: 0.3 });
      P.far({ shape: 'cone', x: tx, z: tz, y: gy + 26, r: 5.4, h: 6, color: '#9a4a30' });
      P.lamp({ x: tx, z: tz, hx: tx, hz: tz, hy: gy + 23, color: '#ffc070', radius: 14, intensity: 1.0, halo: 3.2 });
    }
    for (const k of [-1, 0, 1]) {
      const [lx, lz] = toWorld(hx, hz, ry + Math.PI, k * 10, 16 / 2 + 1.5);
      P.lamp({ x: lx, z: lz, hx: lx, hz: lz, hy: P.groundY(lx, lz) + 3.4, color: '#ffc880', radius: 12, intensity: 0.9, halo: 1.0 });
    }
  }
  // the barrel hall along its right, the tasting room and terrace on its left
  const bx = F.wx(29, 18), bz = F.wz(29, 18);
  placeFoot(P, { type: 'barrel', x: bx, z: bz, ry: ry - Math.PI / 2, w: 40, d: 14, seed: P.rng(), map: 'building' }, 10, { pad: 0.3, roadPad: false, color: '#b8a888', lit: 0.2 });
  const qx = F.wx(-27, 12), qz = F.wz(-27, 12);
  if (placeFoot(P, { type: 'tasting', x: qx, z: qz, ry: ry + Math.PI / 2, w: 18, d: 10, seed: P.rng(), map: 'building' }, 8, { pad: 0.3, roadPad: false, color: '#d8c8a8', lit: 0.6 })) {
    P.lamp({ x: F.wx(-18, 12), z: F.wz(-18, 12), hx: F.wx(-18, 12), hz: F.wz(-18, 12), hy: P.groundY(qx, qz) + 3, color: '#ffd080', radius: 14, intensity: 0.9, halo: 0.8 });
  }
  // lanterns round the court, the sign at its gate
  for (const [lx, lz] of [[-16, 6], [16, 6], [-16, 30], [16, 30]]) {
    const x = F.wx(lx, lz), z = F.wz(lx, lz);
    P.lamp({ x, z, hx: x, hz: z, hy: P.groundY(x, z) + 3.2, color: '#ffc880', radius: 11, intensity: 0.8, halo: 1.0 });
    P.add({ type: 'lantern', x, z });
  }
  const sx = F.wx(-9, 0.5), sz = F.wz(-9, 0.5);
  P.add({ type: 'sign', x: sx, z: sz, ry: ry + Math.PI, slot: 0, w: 5.2, h: 1.3, post: 1.4, kind: 'piers' });
  // the cypress avenue up the drive, the pass road's sign
  cypressLine(P, r, 40, r.length - 4, [1, -1], 11);
  const p0 = r.posAt(22);
  {
    const off = r.rt.hw + r.rt.shoulder + 3;
    const x = p0.x - r.LX[p0.i] * off, z = p0.z - r.LZ[p0.i] * off;
    P.add({ type: 'sign', x, z, ry: Math.atan2(-r.TX[p0.i], -r.TZ[p0.i]) - 1.0, slot: 4, w: 2.8, h: 0.7, post: 1.6, kind: 'pole' });
  }
}

function planVilla(P) {
  const r = P.net.byId.get('cw_villa');
  if (!r) return;
  const e = r.posAt(r.length);
  const ye = e.y;
  const ry0 = Math.atan2(r.TX[r.N - 1], r.TZ[r.N - 1]);
  // turn round the lane's end for the spot where the house and its terrace sit level with it
  let best = null;
  for (let k = -9; k <= 9; k++) {
    const ry = ry0 + k * 0.35;
    const F = new Fr(e.x, 0, e.z, ry);
    const vx = F.wx(0, 30), vz = F.wz(0, 30), tx = F.wx(0, 14), tz = F.wz(0, 14);
    if (!mine(vx, vz) || !P.isFree(vx, vz, 26, 14, ry, { pad: 0.3 }) || !P.isFree(tx, tz, 30, 14, ry, { pad: 0.2 })) continue;
    const g = P.groundRange(vx, vz, 26, 14, ry), gt = P.groundRange(tx, tz, 30, 14, ry);
    const score = Math.max(0, g.hi - (ye + 3)) * 2 + Math.max(0, ye - 6 - g.lo) + Math.max(0, gt.hi - (ye + 2)) * 2;
    if (!best || score < best.score) best = { ry, F, vx, vz, tx, tz, g, score };
  }
  if (!best) return;
  const { ry, F, vx, vz, tx, tz } = best;
  const base = Math.max(ye + 0.8, best.g.lo + 0.3);
  // the villa on its terrace, facing back down the lane; the pool in front
  const villa = placeFoot(P, { type: 'villa', x: vx, z: vz, ry: ry + Math.PI, w: 26, d: 14, base, seed: P.rng(), map: 'building' }, 12, { pad: 0.3, roadPad: false, color: '#d8a868', lit: 0.6 });
  if (!villa) return;
  P.far({ shape: 'cone', x: vx, z: vz, y: base + 7, r: 4, h: 3, color: '#9a4a30' });
  P.claim(tx, tz, 30, 14, ry);
  P.add({ type: 'terrace', x: tx, z: tz, ry: ry + Math.PI, w: 30, d: 14, y: base, map: 'plaza' });
  P.collider({ kind: 'box', x: tx, z: tz, hx: 15, hz: 7, ry, y0: Math.min(base, P.groundRange(tx, tz, 30, 14, ry).lo) - 2, y1: base + 1.2 });
  for (const [lx, lz] of [[-12, 8], [12, 8], [-12, 20], [12, 20]]) {
    const x = F.wx(lx, lz), z = F.wz(lx, lz);
    P.lamp({ x, z, hx: x, hz: z, hy: base + 2.6, color: '#ffc880', radius: 10, intensity: 0.8, halo: 0.9 });
  }
  for (const sx of [-1, 1]) {
    const x = F.wx(sx * 4.5, 1), z = F.wz(sx * 4.5, 1);
    P.collider({ kind: 'box', x, z, hx: 0.6, hz: 0.6, ry, y0: P.groundY(x, z) - 1, y1: P.groundY(x, z) + 2.6 });
  }
  P.add({ type: 'sign', x: F.wx(4.5, 1.6), z: F.wz(4.5, 1.6), ry: ry + Math.PI, slot: 1, w: 1.6, h: 0.4, post: 1.3, kind: 'plaque' });
  P.add({ type: 'gate', x: e.x, z: e.z, ry, y: ye });
  // cypress along the lane's last stretch, an olive grove round the house
  cypressLine(P, r, r.length - 160, r.length - 10, [1, -1], 9, 2.2);
  for (let k = 0; k < 60; k++) {
    const a = P.range(0, Math.PI * 2), d = P.range(26, 70);
    const x = vx + Math.cos(a) * d, z = vz + Math.sin(a) * d;
    if (!mine(x, z) || !P.isFree(x, z, 4, 4, 0, { pad: 1, roadPad: true })) continue;
    P.claim(x, z, 4, 4, 0);
    const y = P.groundY(x, z), s = P.range(0.9, 1.4);
    P.add({ type: 'olive', x, z, y, s, t: P.rng() });
    P.collider({ kind: 'circle', x, z, r: 0.5, y0: y - 1, y1: y + 4 });
  }
  P.landmark({ id: 'villaserena', name: 'VILLA SERENA', x: vx, z: vz, kind: 'villa', hidden: true });
}

/** Stone farmhouses (cascine) along Crestwood Rd, each with its barn wing. */
function planFarms(P) {
  const roads = ['cw_road', 'cr_road1', 'cw_winery', 'lk_north4'].map((id) => P.net.byId.get(id)).filter(Boolean);
  let n = 0;
  for (const r of roads) {
    for (const sd of [1, -1]) {
      for (let s0 = 60; s0 < r.length - 60 && n < 6; s0 += 170) {
        const lot = roadside(P, r, s0, s0 + 90, sd, 12, 26, 12, { slope: 6 });
        if (!lot) continue;
        const it = placeFoot(P, { type: 'cascina', x: lot.x, z: lot.z, ry: lot.ry, w: 26, d: 12, seed: P.rng(), map: 'building' }, 10, { pad: 2, color: '#c8b494', lit: 0.35 });
        if (!it) continue;
        const [lx, lz] = toWorld(lot.x, lot.z, lot.ry, -6, 12 / 2 + 1.2);
        P.lamp({ x: lx, z: lz, hx: lx, hz: lz, hy: lot.g.hi + 3, color: '#ffc070', radius: 10, intensity: 0.85, halo: 1.0 });
        const [tx, tz] = toWorld(lot.x, lot.z, lot.ry, 17, 4);
        if (P.isFree(tx, tz, 3, 5, lot.ry, { pad: 0.3 })) {
          P.claim(tx, tz, 3, 5, lot.ry);
          P.add({ type: 'tractor', x: tx, z: tz, ry: lot.ry + 0.4 });
          P.collider({ kind: 'box', x: tx, z: tz, hx: 1.2, hz: 2.2, ry: lot.ry + 0.4, y0: P.groundY(tx, tz) - 1, y1: P.groundY(tx, tz) + 2.6 });
        }
        n++;
        s0 += 200;
      }
    }
  }
}

/** Dry-stone walls along the lanes, behind their cypress: solid, in pieces. */
function planStoneWalls(P) {
  for (const [id, sds, s0, cut] of [['cw_winery', [1, -1], 30, 40], ['cw_villa', [1], 60, 30], ['cw_road', [1, -1], 40, 40], ['cr_road1', [1, -1], 60, 60]]) {
    const r = P.net.byId.get(id);
    if (!r) continue;
    const reach = r.rt.hw + r.rt.shoulder + r.rt.walk;
    for (const sd of sds) {
      let run = [];
      const flush = () => {
        if (run.length > 2) {
          for (let k = 0; k < run.length - 1; k += 8) {
            const pts = run.slice(k, Math.min(run.length, k + 9));
            if (pts.length < 2) continue;
            P.add({ type: 'swall', x: pts[0][0], z: pts[0][1], pts });
            for (let j = 0; j < pts.length - 1; j++) {
              const a = pts[j], b = pts[j + 1], L = Math.hypot(b[0] - a[0], b[1] - a[1]);
              const gy = P.groundY(a[0], a[1]);
              P.collider({ kind: 'box', x: (a[0] + b[0]) / 2, z: (a[1] + b[1]) / 2, hx: 0.35, hz: L / 2 + 0.1, ry: Math.atan2(b[0] - a[0], b[1] - a[1]), y0: gy - 1, y1: gy + 1.1 });
            }
          }
        }
        run = [];
      };
      for (let s = s0; s < r.length - cut; s += 6) {
        const p = r.posAt(s);
        const off = reach + 5;
        const x = p.x + r.LX[p.i] * sd * off, z = p.z + r.LZ[p.i] * sd * off;
        if (!mine(x, z) || !P.isFree(x, z, 1.2, 1.2, 0, { pad: 0, roadPad: true })) { flush(); continue; }
        P.claim(x, z, 1.2, 1.2, 0);
        run.push([x, z]);
      }
      flush();
    }
  }
}

/** Cypress along the main roads in clumps, the circuit's gate road lined. */
function planRoadTrees(P) {
  for (const id of ['cw_road', 'cr_road1', 'lk_north4', 'cw_gate']) {
    const r = P.net.byId.get(id);
    if (!r) continue;
    if (id === 'cw_gate') { cypressLine(P, r, 20, r.length - 20, [1, -1], 10); continue; }
    for (let s = 40; s < r.length - 40; s += 120) cypressLine(P, r, s, s + 40, [P.rng() < 0.5 ? 1 : -1], 8, 3);
  }
}

/**
 * The vineyards: blocks on a grid over whatever ground is left, their rows
 * running down the fall line (across the slope where it's flat, along the
 * nearest road), kept clear of the circuit.
 */
function planVineyards(P) {
  const b = P.d.box;
  const G = 92;
  for (let z = b.z0 + G / 2; z < b.z1; z += G) {
    for (let x = b.x0 + G / 2; x < b.x1; x += G) {
      const cx = x + P.range(-10, 10), cz = z + P.range(-10, 10);
      if (!mine(cx, cz)) continue;
      // the slope here
      const h = (px, pz) => P.groundY(px, pz);
      const gx = (h(cx + 12, cz) - h(cx - 12, cz)) / 24, gz = (h(cx, cz + 12) - h(cx, cz - 12)) / 24;
      let a = Math.atan2(gz, gx);
      if (Math.hypot(gx, gz) < 0.02) { const n = P.nearestRoad(cx, cz, 300); a = n ? -n.ry : 0; }
      if (Math.hypot(gx, gz) > 0.32) continue;          // too steep: leave it wild
      let placed = null;
      for (const [L, W] of [[80, 76], [66, 60], [50, 46]]) {
        if (!P.isFree(cx, cz, L, W, -a, { pad: 4, roadPad: true })) continue;
        // stay well clear of the circuit (its run-off and walls)
        let near = false;
        for (const [lx, lz] of [[0, 0], [-L / 2, -W / 2], [L / 2, -W / 2], [L / 2, W / 2], [-L / 2, W / 2], [0, W / 2], [0, -W / 2], [L / 2, 0], [-L / 2, 0]]) {
          const [px, pz] = toWorld(cx, cz, -a, lx, lz);
          const n = P.net.nearest(px, pz, 80);
          if (n && n.road.rt.id === 'circuit' && n.d < 26) { near = true; break; }
        }
        if (near) continue;
        placed = { L, W };
        break;
      }
      if (!placed) continue;
      P.claim(cx, cz, placed.L, placed.W, -a);
      P.add({ type: 'vineyard', x: cx, z: cz, ry: -a, w: placed.L, d: placed.W, ang: a, seed: P.rng(), map: 'field' });
    }
  }
}

// ------------------------------------------------------------------ build

function buildVineyard(B, M, it) {
  const poly = rectPoly(it.x, it.z, it.w, it.d, it.ry);
  drapeUV(B.acc(M.vines), B, poly, { lift: 0.05, step: 8, uv: 10.4, ang: it.ang });
  // the rows themselves, near: a leafy fin per row on the ground, over the painted rows
  const acc = B.near(M.vine);
  const F = new Fr(it.x, 0, it.z, it.ry);
  const Lc = -it.x * Math.sin(it.ang) + it.z * Math.cos(it.ang);
  const first = -it.d / 2 + ((((1.3 - Lc + it.d / 2) % 2.6) + 2.6) % 2.6);
  const c0 = lin('#3e5a24'), c1 = lin('#5a7a32');
  for (let k = 0; ; k++) {
    const lz = first + k * 2.6;
    if (lz > it.d / 2 - 0.4) break;
    const segs = Math.max(1, Math.round((it.w - 2) / 8));
    let prev = null;
    acc.col = mixc(c0, c1, hash2(it.x + k, it.z) * 0.8);
    for (let j = 0; j <= segs; j++) {
      const lx = -it.w / 2 + 1 + (j / segs) * (it.w - 2);
      const x = F.wx(lx, lz), z = F.wz(lx, lz), y = B.groundY(x, z);
      if (prev) acc.quadP([prev[0], prev[1] + 0.35, prev[2]], [x, y + 0.35, z], [x, y + 1.55, z], [prev[0], prev[1] + 1.55, prev[2]], [0, 0, 1, 1]);
      prev = [x, y, z];
    }
  }
  acc.col = WHITE;
}

/** The château: three storeys of stucco over a stone ground floor, a hipped tile roof. */
function buildChateau(B, M, it) {
  const F = new Fr(it.x, 0, it.z, it.ry);
  const g = B.footY(it.x, it.z, it.w, it.d, it.ry);
  const wall = B.acc(M.wall), roof = B.acc(M.roof), stone = B.acc(M.stone), paint = B.acc(M.paint);
  const y0 = g.hi + 0.3;
  col(stone, lin('#b0a080'));
  F.box(stone, 0, g.lo - 1, 0, it.w + 0.8, y0 - g.lo + 1, it.d + 0.8, { u: 2 });
  col(wall, WHITE);
  storey(wall, it.x, y0, it.z, it.w, it.d, it.ry, 2);
  storey(wall, it.x, y0 + STOREY, it.z, it.w, it.d, it.ry, 0);
  storey(wall, it.x, y0 + 2 * STOREY, it.z, it.w, it.d, it.ry, 0);
  const top = y0 + 3 * STOREY;
  col(stone, lin('#c8b898'));
  F.box(stone, 0, top - 0.2, 0, it.w + 0.8, 0.5, it.d + 0.8, { u: 2 });
  col(roof, lin('#c8704a'));
  hip(roof, it.x, top + 0.3, it.z, it.w + 0.4, it.d + 0.4, 5.2, it.ry, { over: 0.6 });
  // the central portico: four stone columns, a balcony over it
  col(stone, lin('#d8c8a8'));
  for (const lx of [-4.5, -1.5, 1.5, 4.5]) cylinder(stone, F.wx(lx, it.d / 2 + 2.6), y0, F.wz(lx, it.d / 2 + 2.6), 0.34, STOREY + 0.4, 8, { u: 1 });
  F.box(stone, 0, y0 + STOREY + 0.4, it.d / 2 + 1.5, 11, 0.45, 3.4, { u: 2 });
  col(paint, lin('#2a2420'));
  beam(paint, F.p(-5.4, y0 + STOREY + 1.8, it.d / 2 + 3.1), F.p(5.4, y0 + STOREY + 1.8, it.d / 2 + 3.1), 0.08, 0.08);
  col(paint, lin('#3a2a1e'));
  F.box(paint, 0, y0, it.d / 2 + 0.03, 2.4, 3.0, 0.1, { u: 1 });
  // chimneys
  col(stone, lin('#c0b090'));
  for (const sx of [-1, 1]) F.box(stone, sx * (it.w / 2 - 4), top + 2, 0, 1.4, 5.4, 1.4, { u: 2 });
  col(wall, WHITE); col(roof, WHITE); col(stone, WHITE); col(paint, WHITE);
}

/** The winery's tower: stone, a lit belfry, a tiled pyramid roof, a weathervane. */
function buildTower(B, M, it) {
  const F = new Fr(it.x, 0, it.z, it.ry);
  const g = B.footY(it.x, it.z, it.w, it.d, it.ry);
  const wall = B.acc(M.wall), roof = B.acc(M.roof), stone = B.acc(M.stone), paint = B.acc(M.paint), win = B.acc(M.win);
  const y0 = g.hi + 0.3;
  col(stone, lin('#b0a080'));
  F.box(stone, 0, g.lo - 1, 0, it.w + 0.6, y0 - g.lo + 1, it.d + 0.6, { u: 2 });
  col(wall, WHITE);
  const n = Math.round((it.h - 5) / STOREY);
  for (let k = 0; k < n; k++) storey(wall, it.x, y0 + k * STOREY, it.z, it.w, it.d, it.ry, k % 3 === 2 ? 2 : 3);
  const by = y0 + n * STOREY;
  // the belfry: open arches (corner piers, a glowing core), a cornice
  col(stone, lin('#d0c0a0'));
  for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) F.box(stone, sx * (it.w / 2 - 0.6), by, sz * (it.d / 2 - 0.6), 1.2, 4.2, 1.2, { u: 1 });
  F.box(win, 0, by + 0.2, 0, it.w - 2.6, 3.4, it.d - 2.6, { u: 2 });
  col(stone, lin('#c8b898'));
  F.box(stone, 0, by + 4.2, 0, it.w + 0.8, 0.6, it.d + 0.8, { u: 2 });
  col(roof, lin('#b8603e'));
  hip(roof, it.x, by + 4.8, it.z, it.w + 0.4, it.d + 0.4, 6, it.ry, { over: 0.4 });
  col(paint, lin('#2a2a2a'));
  cylinder(paint, it.x, by + 10.6, it.z, 0.06, 2.4, 4);
  F.box(paint, 0.4, by + 12.4, 0, 1.0, 0.4, 0.04, { u: 1 });
  col(wall, WHITE); col(roof, WHITE); col(stone, WHITE); col(paint, WHITE);
}

function buildBarrel(B, M, it) {
  const F = new Fr(it.x, 0, it.z, it.ry);
  const g = B.footY(it.x, it.z, it.w, it.d, it.ry);
  const wall = B.acc(M.wall), roof = B.acc(M.roof), stone = B.acc(M.stone);
  const y0 = g.hi + 0.2;
  col(stone, lin('#a89878'));
  F.box(stone, 0, g.lo - 1, 0, it.w + 0.4, y0 - g.lo + 1, it.d + 0.4, { u: 2 });
  col(wall, WHITE);
  storey(wall, it.x, y0, it.z, it.w, it.d, it.ry, 5, 'f');
  storey(wall, it.x, y0, it.z, it.w, it.d, it.ry, 3, 'blr');
  storey(wall, it.x, y0 + STOREY, it.z, it.w, it.d, it.ry, 3);
  col(roof, lin('#c06a46'));
  col(stone, lin('#b8a888'));
  gable(roof, it.x, y0 + 2 * STOREY, it.z, it.w, it.d, 3.2, it.ry, { over: 0.6, endAcc: stone });
  // barrels stacked by the doors
  const paint = B.acc(M.paint);
  for (let k = 0; k < 6; k++) {
    const lx = -it.w / 2 + 6 + k * 6;
    const x = F.wx(lx, it.d / 2 + 1.2), z = F.wz(lx, it.d / 2 + 1.2), y = B.groundY(x, z);
    col(paint, lin('#7a4a2a'));
    tube(paint, toArr(F, lx - 0.6, y + 0.55 - F.y, it.d / 2 + 1.2), toArr(F, lx + 0.6, y + 0.55 - F.y, it.d / 2 + 1.2), 0.55, 8, { r2: 0.55, caps: true });
  }
  col(wall, WHITE); col(roof, WHITE); col(stone, WHITE); col(paint, WHITE);
}

const toArr = (F, lx, ly, lz) => F.p(lx, ly, lz);

function buildTasting(B, M, it) {
  const F = new Fr(it.x, 0, it.z, it.ry);
  const g = B.footY(it.x, it.z, it.w, it.d, it.ry);
  const wall = B.acc(M.wall), roof = B.acc(M.roof), stone = B.acc(M.stone), paint = B.acc(M.paint);
  const y0 = g.hi + 0.3;
  col(stone, lin('#b0a080'));
  F.box(stone, 0, g.lo - 1, 0, it.w + 0.4, y0 - g.lo + 1, it.d + 0.4, { u: 2 });
  col(wall, WHITE);
  storey(wall, it.x, y0, it.z, it.w, it.d, it.ry, 2, 'f');
  storey(wall, it.x, y0, it.z, it.w, it.d, it.ry, 1, 'blr');
  col(roof, lin('#c8704a'));
  hip(roof, it.x, y0 + STOREY, it.z, it.w + 0.6, it.d + 0.6, 2.4, it.ry, { over: 0.5 });
  signPanel(B.acc(M.sign), F, 0, y0 + STOREY - 0.9, it.d / 2 + 0.06, 4.4, 1.1, 3);
  // the terrace: a stone floor, a pergola with vines, string lights under it
  const tz = it.d / 2 + 5;
  col(stone, lin('#c8b898'));
  F.box(stone, 0, y0 - 0.3, tz, it.w, 0.3, 9, { u: 2 });
  col(paint, lin('#6a5038'));
  for (const lx of [-it.w / 2 + 0.5, -it.w / 6, it.w / 6, it.w / 2 - 0.5]) {
    F.box(paint, lx, y0, tz + 4.2, 0.24, 2.8, 0.24, { u: 1 });
    beam(paint, F.p(lx, y0 + 2.8, it.d / 2), F.p(lx, y0 + 2.8, tz + 4.4), 0.2, 0.24);
  }
  for (let k = 0; k <= 8; k++) beam(paint, F.p(-it.w / 2, y0 + 3.0, it.d / 2 + 0.5 + k * 1.1), F.p(it.w / 2, y0 + 3.0, it.d / 2 + 0.5 + k * 1.1), 0.1, 0.1);
  col(paint, lin('#4e6a2a'));
  for (let k = 0; k < 5; k++) F.box(paint, -it.w / 2 + 2 + k * 3.4, y0 + 3.1, tz, 2.6, 0.25, 7, { u: 1 });
  const lamp = B.acc(M.lamp);
  for (const lz of [it.d / 2 + 1.5, tz, tz + 3.5]) stringLights(lamp, paint, F.p(-it.w / 2 + 0.5, y0 + 2.7, lz), F.p(it.w / 2 - 0.5, y0 + 2.7, lz), 9, 0.35, 0.1);
  // tables
  col(paint, lin('#e8e0d0'));
  for (let k = 0; k < 4; k++) {
    const x = F.wx(-it.w / 2 + 2.5 + k * 4.3, tz + 0.5), z = F.wz(-it.w / 2 + 2.5 + k * 4.3, tz + 0.5);
    cylinder(paint, x, y0, z, 0.6, 0.75, 8, { top: true });
  }
  col(wall, WHITE); col(roof, WHITE); col(stone, WHITE); col(paint, WHITE);
}

function buildCourt(B, M, it) {
  const poly = rectPoly(it.x, it.z, it.w, it.d, it.ry);
  drapeUV(B.acc(M.gravel), B, poly, { lift: 0.06, step: 6, uv: 3 });
  // the fountain: a round basin, a column, water
  const gy = B.groundY(it.x, it.z);
  const stone = B.acc(M.stone), pool = B.acc(M.pool);
  col(stone, lin('#d0c0a0'));
  lathe(stone, it.x, gy - 0.3, it.z, [[2.6, 0], [2.6, 0.75], [2.3, 0.75], [2.3, 0.5]], 14, { u: 2 });
  cylinder(stone, it.x, gy, it.z, 0.35, 1.8, 8, { u: 1 });
  lathe(stone, it.x, gy + 1.8, it.z, [[0.2, 0], [1.0, 0.3], [1.1, 0.45]], 10, { u: 1 });
  cylinder(pool, it.x, gy + 0.62, it.z, 2.3, 0.01, 14, { top: true });
  // low walls along its sides, gate piers at the drive
  const F = new Fr(it.x, 0, it.z, it.ry);
  col(stone, lin('#b8a888'));
  for (const sx of [-1, 1]) {
    const pts = [[F.wx(sx * it.w / 2, -it.d / 2), F.wz(sx * it.w / 2, -it.d / 2)], [F.wx(sx * it.w / 2, it.d / 2), F.wz(sx * it.w / 2, it.d / 2)]];
    wallAlong(stone, pts, (x, z) => B.groundY(x, z) - 0.4, (x, z) => B.groundY(x, z) + 1.1, { u: 2, both: true });
    F.box(stone, sx * 4, B.groundY(F.wx(sx * 4, -it.d / 2), F.wz(sx * 4, -it.d / 2)) - 0.3, -it.d / 2, 1.2, 2.9, 1.2, { u: 1 });
  }
  col(stone, WHITE);
}

function buildVilla(B, M, it) {
  const F = new Fr(it.x, 0, it.z, it.ry);
  const g = B.footY(it.x, it.z, it.w, it.d, it.ry);
  const wall = B.acc(M.wall), roof = B.acc(M.roof), stone = B.acc(M.stone), paint = B.acc(M.paint);
  const y0 = it.base ?? g.hi + 0.3;
  col(stone, lin('#a89070'));
  F.box(stone, 0, g.lo - 1.5, 0, it.w + 1, y0 - g.lo + 1.5, it.d + 1, { u: 2 });
  col(wall, lin('#f0c890'));
  storey(wall, it.x, y0, it.z, it.w, it.d, it.ry, 0);
  storey(wall, it.x, y0 + STOREY, it.z, it.w, it.d, it.ry, 0);
  col(roof, lin('#c06a46'));
  hip(roof, it.x, y0 + 2 * STOREY, it.z, it.w + 0.6, it.d + 0.6, 3.6, it.ry, { over: 0.8 });
  // the loggia: arches across the front of the upper floor (piers and a deep shade)
  col(stone, lin('#e8d0a8'));
  for (let k = 0; k <= 5; k++) F.box(stone, -it.w / 2 + 3 + k * (it.w - 6) / 5, y0 + STOREY, it.d / 2 + 0.4, 0.7, STOREY - 0.4, 0.7, { u: 1 });
  F.box(stone, 0, y0 + 2 * STOREY - 0.5, it.d / 2 + 0.4, it.w - 5, 0.5, 0.8, { u: 2 });
  col(paint, lin('#3a2a20'));
  F.box(paint, 0, y0 + STOREY, it.d / 2 - 0.02, it.w - 6.4, STOREY - 0.5, 0.05, { u: 2 });
  // a little belvedere on the roof
  col(wall, lin('#f0c890'));
  storey(wall, F.wx(-it.w / 4, 0), y0 + 2 * STOREY + 1.6, F.wz(-it.w / 4, 0), 5, 5, it.ry, 0);
  col(roof, lin('#c06a46'));
  hip(roof, F.wx(-it.w / 4, 0), y0 + 3 * STOREY + 1.6, F.wz(-it.w / 4, 0), 5.6, 5.6, 1.6, it.ry, { over: 0.4 });
  col(wall, WHITE); col(roof, WHITE); col(stone, WHITE); col(paint, WHITE);
}

/** The villa's terrace: paving at the house's level, a retaining wall, a pool that glows at night. */
function buildTerrace(B, M, it) {
  const F = new Fr(it.x, 0, it.z, it.ry);
  const stone = B.acc(M.stone), pool = B.acc(M.pool);
  const y = it.y + 0.3;
  col(stone, lin('#d8c8a8'));
  F.box(stone, 0, Math.min(y - 3, B.footY(it.x, it.z, it.w, it.d, it.ry).lo - 1), 0, it.w, y - Math.min(y - 3, B.footY(it.x, it.z, it.w, it.d, it.ry).lo - 1), it.d, { u: 2 });
  col(stone, lin('#c8b898'));
  for (const [lx, lz, w, d] of [[0, it.d / 2, it.w, 0.5], [-it.w / 2, 0, 0.5, it.d], [it.w / 2, 0, 0.5, it.d]]) F.box(stone, lx, y, lz, w, 0.9, d, { u: 2 });
  col(stone, lin('#f4ecdc'));
  F.box(stone, -6, y - 0.05, 0.5, 11, 0.12, 5.6, { u: 2 });
  F.box(pool, -6, y + 0.02, 0.5, 10, 0.1, 4.6, { u: 2, faces: '' });
  col(stone, WHITE);
  // loungers
  const paint = B.acc(M.paint);
  col(paint, lin('#f2f0ea'));
  for (let k = 0; k < 3; k++) F.box(paint, 4 + k * 2.4, y, 1, 0.8, 0.4, 2, { u: 1 });
  col(paint, WHITE);
}

function buildGate(B, M, it) {
  const F = new Fr(it.x, it.y, it.z, it.ry);
  const stone = B.acc(M.stone), paint = B.acc(M.paint);
  col(stone, lin('#c8b898'));
  for (const sx of [-1, 1]) {
    F.box(stone, sx * 4.5, -0.5, 1, 1.2, 3.1, 1.2, { u: 1 });
    F.box(stone, sx * 4.5, 2.6, 1, 1.5, 0.3, 1.5, { u: 1 });
  }
  col(paint, lin('#1e1e1e'));
  // the iron gates, standing open
  for (const sx of [-1, 1]) {
    for (let k = 0; k < 7; k++) F.box(paint, sx * 3.75, 0, 1.4 + k * 0.52, 0.06, 2.0 + Math.sin((k / 6) * Math.PI) * 0.4, 0.06, { u: 1 });
    beam(paint, F.p(sx * 3.75, 1.9, 1.2), F.p(sx * 3.75, 1.9, 4.6), 0.06, 0.06);
    beam(paint, F.p(sx * 3.75, 0.3, 1.2), F.p(sx * 3.75, 0.3, 4.6), 0.06, 0.06);
  }
  col(stone, WHITE); col(paint, WHITE);
}

function buildCascina(B, M, it) {
  const F = new Fr(it.x, 0, it.z, it.ry);
  const g = B.footY(it.x, it.z, it.w, it.d, it.ry);
  const wall = B.acc(M.wall), roof = B.acc(M.roof), stone = B.acc(M.stone), paint = B.acc(M.paint);
  const y0 = g.hi + 0.3;
  // the house (two storeys, stucco on stone) on the left, the barn wing (stone, arched) on the right
  const hw = 14, bw = it.w - hw;
  const hx = -it.w / 2 + hw / 2, bxl = it.w / 2 - bw / 2;
  col(stone, lin('#a89878'));
  F.box(stone, 0, g.lo - 1, 0, it.w + 0.4, y0 - g.lo + 1, it.d + 0.4, { u: 2 });
  col(wall, it.seed < 0.5 ? WHITE : lin('#f0dcc0'));
  storey(wall, F.wx(hx, 0), y0, F.wz(hx, 0), hw, it.d, it.ry, 3);
  storey(wall, F.wx(hx, 0), y0 + STOREY, F.wz(hx, 0), hw, it.d, it.ry, 0);
  col(wall, WHITE);
  storey(wall, F.wx(bxl, 0), y0, F.wz(bxl, 0), bw, it.d - 1, it.ry, 5, 'f');
  storey(wall, F.wx(bxl, 0), y0, F.wz(bxl, 0), bw, it.d - 1, it.ry, 3, 'blr');
  col(roof, lin(it.seed < 0.5 ? '#c06a46' : '#a85a3a'));
  col(stone, lin('#b8a888'));
  gable(roof, F.wx(hx, 0), y0 + 2 * STOREY, F.wz(hx, 0), hw, it.d, 2.8, it.ry, { over: 0.6, endAcc: stone });
  gable(roof, F.wx(bxl, 0), y0 + STOREY, F.wz(bxl, 0), bw, it.d - 1, 2.2, it.ry, { over: 0.6, endAcc: stone });
  // a pergola by the door, a bench
  col(paint, lin('#6a5038'));
  for (const lx of [hx - 3, hx + 3]) F.box(paint, lx, y0, it.d / 2 + 3, 0.2, 2.6, 0.2, { u: 1 });
  beam(paint, F.p(hx - 3.4, y0 + 2.6, it.d / 2 + 3), F.p(hx + 3.4, y0 + 2.6, it.d / 2 + 3), 0.18, 0.18);
  for (const lx of [hx - 3, hx, hx + 3]) beam(paint, F.p(lx, y0 + 2.7, it.d / 2), F.p(lx, y0 + 2.7, it.d / 2 + 3.3), 0.14, 0.14);
  col(paint, lin('#4e6a2a'));
  F.box(paint, hx, y0 + 2.8, it.d / 2 + 1.6, 6.6, 0.25, 3.2, { u: 1 });
  box(B.acc(M.lamp), F.wx(hx - 2.2, it.d / 2 + 0.15), y0 + 2.4, F.wz(hx - 2.2, it.d / 2 + 0.15), 0.22, 0.3, 0.22, it.ry, { u: 1 });
  col(wall, WHITE); col(roof, WHITE); col(stone, WHITE); col(paint, WHITE);
}

/** The Crestwood pits: cream stucco, garages under a terracotta trim, an arcade above, a loggia tower for race control. */
function buildPits(B, M, it) {
  const F = new Fr(it.x, 0, it.z, it.ry);
  const g = B.footY(it.x, it.z, it.w, it.d, it.ry);
  const wall = B.acc(M.wall), roof = B.acc(M.roof), stone = B.acc(M.stone), paint = B.acc(M.paint);
  const base = g.hi + 0.2;
  col(stone, lin('#b8a888'));
  F.box(stone, 0, g.lo - 1, 0, it.w, base - g.lo + 1, it.d, { u: 2 });
  col(wall, WHITE);
  storey(wall, it.x, base, it.z, it.w, it.d, it.ry, 4, 'f');
  storey(wall, it.x, base, it.z, it.w, it.d, it.ry, 1, 'blr');
  storey(wall, it.x, base + STOREY, it.z, it.w, it.d, it.ry, 0);
  const top = base + 2 * STOREY;
  col(roof, lin('#c06a46'));
  hip(roof, it.x, top, it.z, it.w + 0.4, it.d + 0.4, 2.6, it.ry, { over: 0.7 });
  // the white canopy over the lane on slim posts
  col(paint, lin('#f4f1ea'));
  F.box(paint, 0, base + STOREY - 0.25, it.d / 2 + 3, it.w, 0.25, 6, { u: 2 });
  col(paint, lin('#c8c2b8'));
  for (let k = 0; k <= 10; k++) F.box(paint, -it.w / 2 + 0.3 + k * (it.w - 0.6) / 10, base, it.d / 2 + 5.8, 0.18, STOREY - 0.25, 0.18, { u: 1 });
  // race control: a loggia tower at the end nearer the start
  const tx = -it.w / 2 + 7;
  col(wall, WHITE);
  for (let k = 0; k < 2; k++) storey(wall, F.wx(tx, 0), top + k * STOREY, F.wz(tx, 0), 10, 10, it.ry, k ? 2 : 0);
  col(roof, lin('#c06a46'));
  hip(roof, F.wx(tx, 0), top + 2 * STOREY, F.wz(tx, 0), 11, 11, 2.6, it.ry, { over: 0.4 });
  const sacc = B.acc(M.sign);
  signPanel(sacc, F, tx, top + 2 * STOREY - 1.0, 5.1, 7, 1.75, 5);
  signPanel(sacc, F, 12, top - 0.2, it.d / 2 + 0.75, 16, 4, 2);
  signPanel(sacc, new Fr(it.x, 0, it.z, it.ry + Math.PI), 0, top - 0.2, it.d / 2 + 0.75, 16, 4, 2);
  col(wall, WHITE); col(roof, WHITE); col(stone, WHITE); col(paint, WHITE);
}

function buildSign(B, M, it) {
  const F = new Fr(it.x, 0, it.z, it.ry);
  const gy = B.groundY(it.x, it.z);
  const paint = B.acc(M.paint), stone = B.acc(M.stone);
  if (it.kind === 'piers') {
    col(stone, lin('#c8b898'));
    for (const sx of [-1, 1]) F.box(stone, sx * (it.w / 2 + 0.5), gy - 0.4, 0, 1.0, it.post + it.h + 0.8, 1.0, { u: 1 });
    F.box(stone, 0, gy + it.post + it.h + 0.2, 0, it.w + 2.2, 0.4, 1.1, { u: 1 });
    col(stone, WHITE);
  } else if (it.kind === 'pole') {
    col(paint, lin('#8a8a86'));
    cylinder(paint, it.x, gy - 0.3, it.z, 0.06, it.post + it.h + 0.3, 5);
  } else if (it.kind !== 'plaque') {
    col(paint, lin('#4a3a2c'));
    for (const sx of [-1, 1]) F.box(paint, sx * (it.w / 2 - 0.2), gy - 0.4, 0, 0.2, it.post + it.h + 0.5, 0.2, { u: 1 });
  }
  const sacc = B.acc(M.sign);
  signPanel(sacc, F, 0, gy + it.post, it.kind === 'plaque' ? -0.04 : 0, it.w, it.h, it.slot);
  if (it.kind !== 'plaque') signPanel(sacc, new Fr(it.x, 0, it.z, it.ry + Math.PI), 0, gy + it.post, 0.12, it.w, it.h, it.slot);
  col(paint, WHITE);
}

// ------------------------------------------------------------------ scatter

function scatter(S) {
  // between the blocks: the odd oak, olive and bush, broom on the banks, stones
  for (const [x, z] of S.points(26, { r: 4, density: (px, pz) => 0.25 + 0.3 * S.noise(px / 200, pz / 200) })) {
    const n = S.net.nearest(x, z, 80);
    if (n && n.road.rt.id === 'circuit' && n.d < 30) continue;
    const y = S.groundY(x, z);
    const u = S.rng();
    if (u < 0.22) { S.add({ type: 'oak', x, z, y, s: S.range(0.9, 1.4), t: S.rng() }); S.collider({ kind: 'circle', x, z, r: 0.5, y0: y - 1, y1: y + 5 }); }
    else if (u < 0.45) { S.add({ type: 'olive', x, z, y, s: S.range(0.8, 1.2), t: S.rng() }); S.collider({ kind: 'circle', x, z, r: 0.45, y0: y - 1, y1: y + 4 }); }
    else if (u < 0.85) S.add({ type: 'bush', x, z, y, s: S.range(0.5, 1.2), t: S.rng() });
    else S.add({ type: 'rock', x, z, y, s: S.range(0.4, 1.0), t: S.rng() });
  }
}

// ------------------------------------------------------------------ the pack

export default {
  id: ID,

  plan(P) {
    planCircuit(P);
    planWinery(P);
    planVilla(P);
    planFarms(P);
    planRoadTrees(P);
    planStoneWalls(P);
    planVineyards(P);
  },

  scatter,

  warm(B) { mats(B); },

  *build(B, items) {
    const M = mats(B);
    let t0 = performance.now();
    for (const it of items) {
      switch (it.type) {
        case 'vineyard': buildVineyard(B, M, it); break;
        case 'cypress': cypress(B.acc(M.trunk), B.acc(M.leaf), it.x, it.y, it.z, it.h, it.t); break;
        case 'olive': olive(B.acc(M.trunk), B.acc(M.leaf), it.x, it.y, it.z, it.s, it.t); break;
        case 'oak': oak(B.acc(M.trunk), B.acc(M.leaf), it.x, it.y, it.z, it.s, it.t, { leaf: '#4a5a2a', leaf2: '#5e6e34' }); break;
        case 'bush': bush(B.near(M.leaf), it.x, it.y, it.z, it.s, it.t, '#5a6a34'); break;
        case 'rock': rock(B.near(M.stone), it.x, it.y, it.z, it.s, it.t, '#b8ac94'); break;
        case 'chateau': buildChateau(B, M, it); yield; t0 = performance.now(); break;
        case 'tower': buildTower(B, M, it); break;
        case 'barrel': buildBarrel(B, M, it); break;
        case 'tasting': buildTasting(B, M, it); break;
        case 'court': buildCourt(B, M, it); break;
        case 'lantern': {
          const gy = B.groundY(it.x, it.z), paint = B.acc(M.paint);
          col(paint, lin('#2a2a2a'));
          cylinder(paint, it.x, gy - 0.3, it.z, 0.07, 3.3, 5);
          box(B.acc(M.lamp), it.x, gy + 2.95, it.z, 0.32, 0.42, 0.32, 0, { u: 1 });
          col(paint, WHITE);
          break;
        }
        case 'villa': buildVilla(B, M, it); break;
        case 'terrace': buildTerrace(B, M, it); break;
        case 'gate': buildGate(B, M, it); break;
        case 'swall': {
          const stone = B.acc(M.stone);
          col(stone, lin('#b4a688'));
          const gy = (x, z) => B.groundY(x, z);
          wallAlong(stone, it.pts, (x, z) => gy(x, z) - 0.3, (x, z) => gy(x, z) + 0.95, { u: 2, both: true });
          for (let k = 0; k < it.pts.length - 1; k++) {
            const a = it.pts[k], b = it.pts[k + 1];
            beam(stone, [a[0], gy(a[0], a[1]) + 1.0, a[1]], [b[0], gy(b[0], b[1]) + 1.0, b[1]], 0.55, 0.12);
          }
          col(stone, WHITE);
          break;
        }
        case 'cascina': buildCascina(B, M, it); break;
        case 'tractor': tractor(B.acc(M.paint), it.x, B.groundY(it.x, it.z), it.z, it.ry, '#c83a22'); break;
        case 'sign': buildSign(B, M, it); break;
        case 'pits': buildPits(B, M, it); yield; t0 = performance.now(); break;
        case 'r-gravel': buildGravel(B, M, it); break;
        case 'r-tyres': buildTyres(B, M, it); break;
        case 'r-wall': buildWall(B, M, it, ST); break;
        case 'stand': yield* buildStand(B, M, { ...it, kind: 'classic' }, ST); yield; t0 = performance.now(); break;
        case 'r-mast': buildMast(B, M, { ...it, kind: 'pole' }, ST); break;
        case 'r-gantry': buildGantry(B, M, it, ST); break;
        case 'r-start': buildStartLine(B, M, it); break;
        case 'r-board': buildBoard(B, M, it); break;
        case 'r-marshal': buildMarshal(B, M, it, ST); break;
        case 'r-paddock': buildPaddock(B, M, it); break;
        case 'r-pole': buildPole(B, M, it); break;
        default: break;
      }
      // (a step stays short: yield every few milliseconds)
      if (performance.now() - t0 > 3) { yield; t0 = performance.now(); }
    }
  },
};

void cone; void windowPane; void pickup; void sedan;
