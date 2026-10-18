// PORT HALCYON — IRONWOOD PARK: the old Ironwood ironworks, closed and made
// into a grand prix circuit that winds between its giants. Two blast
// furnaces with their hot-blast stoves, dust catchers, skip inclines and
// cast houses stand in the infield; a column-guided gas holder, a flare
// that still burns and three smokestacks with blinking red lights stand
// round it; conveyor galleries and gas mains bridge the back straight and
// the esses; rusting sheds, ore and slag heaps and ladle cars on narrow
// rails fill the yards. The circuit itself: the brick engine-house pits on
// the main straight, steel-scaffold grandstands, sodium floodlights on
// lattice masts, gravel traps and tyre walls, concrete walls and catch
// fences. Foundry Lane runs in from the shore road to the ladle yard.
import * as THREE from 'three';
import { litMat, glowColorMat, box, cylinder, cone, sphere, gable } from './builder.js';
import { concreteTexture, toTex } from '../../track/textures.js';
import { makeRng } from '../../core/util.js';
import { toWorld, lin, hash2 } from './westkit/util.js';
import { Fr, tube, lathe, beam, lattice2, sawtooth, drapeUV, col } from './westkit/geo.js';
import { bandAtlas, windowPane, corrugatedTex, signAtlas, text, speckle, streaks, cvs, once } from './westkit/tex.js';
import { bush, rock, oak } from './westkit/veg.js';
import { drum, crate, pickup } from './westkit/props.js';
import {
  raceMats, lapSamples, lapAt, planRunoffs, planWall, placeFoot, planPitStraight, planStand, planMasts, planBoards, planMarshals,
  buildPaddock, buildPole,
  buildGravel, buildTyres, buildWall, buildStand, buildMast, buildGantry, buildStartLine, buildBoard, buildMarshal,
} from './westkit/race.js';

const BOX = { x0: -4400, z0: -995, x1: -3050, z1: -330 };
const LOOP = ['iw_l1', 'iw_l2', 'iw_l3', 'iw_l4'];
const WHITE = [1, 1, 1];
const STOREY = 3.2, BANDS = 6;   // atlas: 0 brick arches, 1 brick, 2 corrugated + clerestory, 3 pit garages, 4 control glass, 5 corrugated
const ST = { lamp: '#ffb25a', gravel: '#c4b49a', wall: '#cfc9bd', post: '#4a4e52', seats: ['#3a4048', '#c8a020', '#8a2a1a'], roof: '#6e6258', steel: '#7a3420', stand: 'steel', mast: '#5a4a40', mastKind: 'lattice', gantry: '#b8a690', marshal: '#d8d0c0' };

// ------------------------------------------------------------------ textures

function walls() {
  return bandAtlas('iron-walls', 512, 164, [
    // 0: red brick with tall arched windows (the engine house, the pits' upper floor)
    (x, e, W, H, rng) => {
      brick(x, W, H, rng, '#7a3a28');
      for (const wx of [70, 326]) {
        x.fillStyle = '#5a2a1c'; x.fillRect(wx - 8, 22, 132, 136);
        const lit = rng() < 0.5;
        const g = x.createLinearGradient(0, 30, 0, 150);
        g.addColorStop(0, lit ? '#ffd890' : '#1c242a'); g.addColorStop(1, lit ? '#e8a050' : '#141a1e');
        x.fillStyle = g;
        x.beginPath(); x.moveTo(wx, 150); x.lineTo(wx, 70); x.arc(wx + 58, 70, 58, Math.PI, 0); x.lineTo(wx + 116, 150); x.closePath(); x.fill();
        x.strokeStyle = '#2a1a12'; x.lineWidth = 4;
        for (let k = 1; k < 4; k++) { x.beginPath(); x.moveTo(wx + k * 29, 150); x.lineTo(wx + k * 29, 40); x.stroke(); }
        for (let k = 1; k < 4; k++) { x.beginPath(); x.moveTo(wx, 70 + k * 20); x.lineTo(wx + 116, 70 + k * 20); x.stroke(); }
        if (lit) { e.globalAlpha = 0.6; e.fillStyle = '#ffb860'; e.beginPath(); e.moveTo(wx, 150); e.lineTo(wx, 70); e.arc(wx + 58, 70, 58, Math.PI, 0); e.lineTo(wx + 116, 150); e.closePath(); e.fill(); e.globalAlpha = 1; }
      }
    },
    // 1: brick with pilasters
    (x, e, W, H, rng) => { brick(x, W, H, rng, '#7a3a28'); for (const px of [0, 256]) { x.fillStyle = 'rgba(40,16,10,0.35)'; x.fillRect(px, 0, 22, H); } },
    // 2: rusty corrugated with a clerestory of small panes (a few lit, a few broken)
    (x, e, W, H, rng) => {
      corr(x, W, H, rng);
      for (let k = 0; k < 8; k++) {
        const wx = 8 + k * 64, wy = 18;
        x.fillStyle = '#2a2420'; x.fillRect(wx, wy, 56, 34);
        for (let p = 0; p < 4; p++) {
          const r = rng();
          x.fillStyle = r < 0.12 ? '#e8c070' : r < 0.3 ? '#0c0c0c' : '#3a4a50';
          x.fillRect(wx + 2 + p * 13.5, wy + 2, 12, 30);
          if (r < 0.12) { e.fillStyle = '#ffb860'; e.globalAlpha = 0.7; e.fillRect(wx + 2 + p * 13.5, wy + 2, 12, 30); e.globalAlpha = 1; }
        }
      }
    },
    // 3: pit garages: two roller doors per 8 m, one usually up and lit
    (x, e, W, H, rng) => {
      x.fillStyle = '#3a3c40'; x.fillRect(0, 0, W, H);
      const teams = ['#c8161e', '#1d4fa8', '#f0a818', '#1b1b1d', '#2f9a4a', '#e6e6e6', '#ff6a00', '#5a2a8a'];
      for (const gx of [16, 272]) {
        const team = teams[Math.floor(rng() * teams.length)];
        x.fillStyle = team; x.fillRect(gx, 8, 224, 18);
        const open = rng() < 0.7;
        if (open) {
          const g = x.createLinearGradient(0, 34, 0, H);
          g.addColorStop(0, '#f4f0e6'); g.addColorStop(1, '#a8a49a');
          x.fillStyle = g; x.fillRect(gx + 6, 34, 212, H - 34);
          x.fillStyle = team; x.beginPath(); x.moveTo(gx + 40, H - 6); x.lineTo(gx + 60, H - 40); x.lineTo(gx + 160, H - 44); x.lineTo(gx + 190, H - 6); x.fill();
          x.fillStyle = '#111'; x.fillRect(gx + 50, H - 14, 26, 14); x.fillRect(gx + 150, H - 14, 26, 14);
          e.fillStyle = '#fff4dc'; e.globalAlpha = 0.85; e.fillRect(gx + 6, 34, 212, H - 34); e.globalAlpha = 1;
        } else {
          for (let y = 34; y < H; y += 8) { x.fillStyle = (y / 8) % 2 ? '#8e9094' : '#a2a4a8'; x.fillRect(gx + 6, y, 212, 8); }
        }
        x.fillStyle = '#1a1a1c'; x.fillRect(gx, 30, 4, H - 30); x.fillRect(gx + 220, 30, 4, H - 30);
      }
    },
    // 4: race control glazing (cool, lit)
    (x, e, W, H, rng) => {
      x.fillStyle = '#2a3a48'; x.fillRect(0, 0, W, H);
      for (let k = 0; k < 8; k++) {
        const lit = rng() < 0.75;
        const g = x.createLinearGradient(0, 10, 0, H - 10);
        g.addColorStop(0, lit ? '#cfe2ff' : '#3a5a78'); g.addColorStop(1, lit ? '#8aa8d0' : '#1a2a38');
        x.fillStyle = g; x.fillRect(k * 64 + 4, 10, 56, H - 20);
        if (lit) { e.fillStyle = '#a8c8ff'; e.globalAlpha = 0.7; e.fillRect(k * 64 + 4, 10, 56, H - 20); e.globalAlpha = 1; }
      }
      x.fillStyle = '#c8ccd0'; x.fillRect(0, 0, W, 8); x.fillRect(0, H - 8, W, 8);
    },
    // 5: plain rusty corrugated
    (x, e, W, H, rng) => corr(x, W, H, rng),
  ]);
}

function brick(x, W, H, rng, base) {
  x.fillStyle = base; x.fillRect(0, 0, W, H);
  for (let y = 0, r = 0; y < H; y += 8, r++) {
    for (let bx = (r % 2) * -12; bx < W; bx += 24) {
      const t = 0.8 + rng() * 0.4;
      x.fillStyle = `rgb(${120 * t},${58 * t},${40 * t})`;
      x.fillRect(bx + 1, y + 1, 22, 6);
    }
  }
  speckle(x, W, H, rng, 1200, ['#000', '#c8a080'], 0.05, 0.2);
  streaks(x, W, H, rng, 12, '20,12,8', 0.25);
}

function corr(x, W, H, rng) {
  x.fillStyle = '#8a6a52'; x.fillRect(0, 0, W, H);
  for (let px = 0; px < W; px += 12) {
    const g = x.createLinearGradient(px, 0, px + 12, 0);
    g.addColorStop(0, 'rgba(0,0,0,0.3)'); g.addColorStop(0.4, 'rgba(255,220,180,0.18)'); g.addColorStop(1, 'rgba(0,0,0,0.3)');
    x.fillStyle = g; x.fillRect(px, 0, 12, H);
  }
  streaks(x, W, H, rng, 30, '110,48,20', 0.45);
  for (let i = 0; i < 18; i++) { const px = rng() * W, py = rng() * H, r = 6 + rng() * 26; const g = x.createRadialGradient(px, py, 0, px, py, r); g.addColorStop(0, 'rgba(120,52,20,0.5)'); g.addColorStop(1, 'rgba(120,52,20,0)'); x.fillStyle = g; x.fillRect(px - r, py - r, r * 2, r * 2); }
}

/** Riveted plate (greyscale, rust-streaked: tinted per structure). */
function plateTex() {
  return once('iron:plate', () => {
    const [c, x] = cvs(256, 256);
    const rng = makeRng('plate');
    x.fillStyle = '#b4b0aa'; x.fillRect(0, 0, 256, 256);
    speckle(x, 256, 256, rng, 5000, ['#8a8680', '#d0ccc6'], 0.1, 0.35);
    for (let y = 0; y < 256; y += 64) { x.fillStyle = 'rgba(0,0,0,0.35)'; x.fillRect(0, y, 256, 2); for (let k = 4; k < 256; k += 12) { x.fillStyle = 'rgba(0,0,0,0.4)'; x.fillRect(k, y + 5, 3, 3); } }
    for (let px = 0; px < 256; px += 128) { x.fillStyle = 'rgba(0,0,0,0.3)'; x.fillRect(px, 0, 2, 256); }
    streaks(x, 256, 256, rng, 30, '96,40,16', 0.5);
    for (let i = 0; i < 26; i++) { const px = rng() * 256, py = rng() * 256, r = 6 + rng() * 30; const g = x.createRadialGradient(px, py, 0, px, py, r); g.addColorStop(0, 'rgba(110,46,18,0.55)'); g.addColorStop(1, 'rgba(110,46,18,0)'); x.fillStyle = g; x.fillRect(px - r, py - r, r * 2, r * 2); }
    return toTex(c);
  });
}

/** Chimney brick (u round, v up, in metres / 4). */
function stackTex() {
  return once('iron:stack', () => {
    const [c, x] = cvs(256, 256);
    const rng = makeRng('stack');
    brick(x, 256, 256, rng, '#8a4230');
    for (let y = 0; y < 256; y += 64) { x.fillStyle = 'rgba(30,20,16,0.45)'; x.fillRect(0, y, 256, 5); }   // iron bands
    const g = x.createLinearGradient(0, 0, 0, 256);
    g.addColorStop(0, 'rgba(10,8,6,0.25)'); g.addColorStop(1, 'rgba(10,8,6,0)');
    x.fillStyle = g; x.fillRect(0, 0, 256, 256);
    return toTex(c);
  });
}

function signs() {
  return signAtlas('iron', [
    // 0 IRONWOOD PARK (rust letters, orange neon outline)
    (x, e, w, h) => {
      x.fillStyle = '#1e1a18'; x.fillRect(0, 0, w, h);
      text(x, 'IRONWOOD PARK', w / 2, 62, 66, '#c8682a', { max: w - 30, stroke: 3, sc: '#2a1206' });
      text(e, 'IRONWOOD PARK', w / 2, 62, 66, '#ff8a2a', { max: w - 30, glow: '#ff6a10', blur: 22 });
      x.fillStyle = '#c8682a'; x.fillRect(20, 104, w - 40, 6); e.fillStyle = '#ff7a20'; e.fillRect(20, 104, w - 40, 6);
    },
    // 1 PIT LANE
    (x, e, w, h) => {
      x.fillStyle = '#e8e4da'; x.fillRect(0, 0, w, h);
      text(x, 'PIT LANE', w / 2, h / 2, 72, '#1a1a1a', { max: w - 40 });
      e.globalAlpha = 0.35; e.fillStyle = '#e8e4da'; e.fillRect(0, 0, w, h); e.globalAlpha = 1;
    },
    // 2 IRONWOOD WORKS 1889 (cast plate)
    (x, e, w, h) => {
      x.fillStyle = '#3a2a22'; x.fillRect(0, 0, w, h);
      x.strokeStyle = '#8a6a4a'; x.lineWidth = 6; x.strokeRect(8, 8, w - 16, h - 16);
      text(x, 'IRONWOOD WORKS', w / 2, 54, 52, '#c8a070', { max: w - 40 });
      text(x, 'EST. 1889', w / 2, 98, 26, '#a88050', { w: 700 });
    },
    // 3 LADLE YARD — KEEP OUT
    (x, e, w, h) => {
      x.fillStyle = '#e8c21a'; x.fillRect(0, 0, w, h);
      for (let k = -2; k < 14; k++) { x.fillStyle = '#141414'; x.beginPath(); x.moveTo(k * 40, 0); x.lineTo(k * 40 + 20, 0); x.lineTo(k * 40 - 20, 24); x.lineTo(k * 40 - 40, 24); x.fill(); }
      text(x, 'LADLE YARD', w / 2, 66, 54, '#141414', { max: w - 40 });
      text(x, 'KEEP OUT · HOT METAL', w / 2, 108, 20, '#141414', { w: 700 });
    },
    // 4 the timing board / RACE CONTROL
    (x, e, w, h) => {
      x.fillStyle = '#101214'; x.fillRect(0, 0, w, h);
      text(x, 'RACE CONTROL', w / 2, h / 2, 56, '#ffcc40', { max: w - 40 });
      text(e, 'RACE CONTROL', w / 2, h / 2, 56, '#ffb020', { max: w - 40, glow: '#ff9a00' });
    },
  ]);
}
const signUV = (k) => signs().uv(k);

function mats(B) {
  const R = raceMats(B, ST);
  return {
    ...R,
    wall: B.mat('wall', () => { const t = walls(); return litMat({ map: t.map, emissive: 0xffffff, emissiveMap: t.emi, vertexColors: true, roughness: 0.85 }, { night: 1.0 }); }),
    plate: B.mat('plate', () => litMat({ map: plateTex(), vertexColors: true, roughness: 0.8, metalness: 0.25 })),
    corr: B.mat('corr', () => litMat({ map: corrugatedTex('iron', { rust: 40 }), vertexColors: true, roughness: 0.75, metalness: 0.2 })),
    stack: B.mat('stack', () => litMat({ map: stackTex(), vertexColors: true, roughness: 0.9 })),
    conc: B.mat('conc', () => litMat({ map: concreteTexture('#8f8b84', 'ironc'), vertexColors: true, roughness: 0.92 })),
    sign: B.mat('sign', () => { const t = signs(); return litMat({ map: t.map, emissive: 0xffffff, emissiveMap: t.emi, roughness: 0.6 }, { night: 1.6 }); }),
    leaf: B.mat('leaf', () => litMat({ vertexColors: true, flatShading: true, roughness: 0.9 })),
    bark: B.mat('bark', () => litMat({ vertexColors: true, roughness: 0.95 })),
    flame: B.mat('flame', () => glowColorMat('#ff8a20', 3.6)),
    hot: B.mat('hot', () => glowColorMat('#ff5a10', 2.2)),
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

/** Round things (furnaces, stoves, holders, stacks): a square claimed, a circle collider, a far cylinder. */
function placeRound(P, it, r, h, o = {}) {
  if (!P.isFree(it.x, it.z, r * 2 + 2, r * 2 + 2, 0, { pad: o.pad ?? 0.5, roadPad: true })) return null;
  P.claim(it.x, it.z, r * 2 + 2, r * 2 + 2, 0);
  it.w = it.d = r * 2; it.ry = 0;
  if (!it.map) it.map = 'building';
  P.add(it);
  const gy = P.groundY(it.x, it.z);
  P.collider({ kind: 'circle', x: it.x, z: it.z, r: r + 0.5, y0: gy - 2, y1: gy + h });
  if (o.far !== false) P.far({ shape: 'cyl', x: it.x, z: it.z, y: gy - 1, r, r2: o.r2 ?? r, h: h + 1, color: o.color || '#5a463a', lit: 0 });
  return it;
}

// ------------------------------------------------------------------ plan

function planCircuit(P) {
  const lap = lapSamples(P.net, LOOP, 4);
  if (!lap.samples.length) return null;
  const L = lap.length;
  // the main straight runs east along z −950: iw_l4's last stretch, then iw_l1's first
  const S0 = L - 210, S1 = L + 120;
  const { mid } = planPitStraight(P, lap, { S0, S1, side: -1, type: 'pits', w: 170, d: 18, h: 17, mid: (S0 + S1) / 2 - 10, color: '#6a3a28', lamp: ST.lamp, start: S0 + 120 });
  // grandstands opposite the pits, split round the gate road; one outside the
  // first corner behind its gravel; one outside the hairpin at the west end
  planStand(P, lap, S0 + 80, 1, { w: 140, d: 22, h: 13, tiers: 11, gap: 3.4, wall: 11.2 });
  planStand(P, lap, L + 87, 1, { w: 70, d: 22, h: 13, tiers: 11, gap: 3.4, wall: 11.2 });
  planStand(P, lap, 205, 1, { w: 50, d: 16, h: 9, tiers: 8, gap: 24, wall: false, roadPad: true });
  const hp = lap.samples.reduce((best, p) => (p.x < best.x ? p : best), lap.samples[0]);
  planStand(P, lap, hp.s, hp.k > 0 ? -1 : 1, { w: 70, d: 18, h: 10, tiers: 9, gap: 26, wall: false, roadPad: true });
  // run-off: gravel and tyre walls, catch fences behind them; then the
  // floodlights, the braking boards, the marshals
  planRunoffs(P, lap, { w: [12, 26], kmin: 1 / 220, fence: 2.4 });
  planMasts(P, lap, 105, 28, ST.lamp);
  planBoards(P, lap);
  planMarshals(P, lap, 250);
  void mid;
  return lap;
}

/**
 * Pipes and galleries on trestles: legs every `every` m along pts where
 * the ground is free (none on the track: the span bridges it), claimed,
 * solid; the run split into short items so each cell builds its own part.
 */
function planOverhead(P, type, pts, o) {
  const legs = [];
  let y = -Infinity;
  for (let k = 0; k < pts.length - 1; k++) {
    const a = pts[k], b = pts[k + 1];
    const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const n = Math.max(1, Math.round(L / o.every));
    for (let j = k === 0 ? 0 : 1; j <= n; j++) {
      const t = j / n, x = a[0] + (b[0] - a[0]) * t, z = a[1] + (b[1] - a[1]) * t;
      y = Math.max(y, P.groundY(x, z) + o.h);
      if (!P.isFree(x, z, o.leg, o.leg, 0, { pad: 0.2, roadPad: true })) continue;
      P.claim(x, z, o.leg, o.leg, 0);
      legs.push([x, z]);
    }
  }
  for (const [x, z] of legs) {
    const gy = P.groundY(x, z);
    P.collider({ kind: 'box', x, z, hx: o.leg / 2, hz: o.leg / 2, ry: 0, y0: gy - 1, y1: y });
  }
  // split into pieces of about 60 m, each with its legs
  for (let k = 0; k < pts.length - 1; k++) {
    const a = pts[k], b = pts[k + 1];
    const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const n = Math.max(1, Math.round(L / 60));
    for (let j = 0; j < n; j++) {
      const p = [a[0] + (b[0] - a[0]) * (j / n), a[1] + (b[1] - a[1]) * (j / n)];
      const q = [a[0] + (b[0] - a[0]) * ((j + 1) / n), a[1] + (b[1] - a[1]) * ((j + 1) / n)];
      const last = k === pts.length - 2 && j === n - 1;
      const mine = legs.filter(([x, z]) => {
        const t = ((x - a[0]) * (b[0] - a[0]) + (z - a[1]) * (b[1] - a[1])) / (L * L);
        const off = Math.abs((x - a[0]) * (b[1] - a[1]) - (z - a[1]) * (b[0] - a[0])) / L;
        return off < 0.5 && t >= j / n - 1e-6 && (t < (j + 1) / n - 1e-6 || (last && t <= 1 + 1e-6));
      });
      P.add({ type, x: p[0], z: p[1], a: p, b: q, y, r: o.r, legs: mine, elbow: j === 0 && k > 0 });
    }
  }
  return y;
}

/** An inclined conveyor gallery from a [x, z, h above ground] to b, on trestles, split into pieces. */
function planConveyor(P, a, b, w) {
  const ya = P.groundY(a[0], a[1]) + a[2], yb = P.groundY(b[0], b[1]) + b[2];
  const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const n = Math.max(1, Math.round(L / 60));
  const legs = [];
  const m = Math.max(2, Math.round(L / 24));
  for (let k = 1; k < m; k++) {
    const t = k / m, x = a[0] + (b[0] - a[0]) * t, z = a[1] + (b[1] - a[1]) * t;
    if (!P.isFree(x, z, 2.6, 2.6, 0, { pad: 0.2, roadPad: true })) continue;
    P.claim(x, z, 2.6, 2.6, 0);
    legs.push([x, z, ya + (yb - ya) * t]);
    const gy = P.groundY(x, z);
    P.collider({ kind: 'box', x, z, hx: 1.3, hz: 1.3, ry: 0, y0: gy - 1, y1: ya + (yb - ya) * t });
  }
  for (let j = 0; j < n; j++) {
    const t0 = j / n, t1 = (j + 1) / n;
    const p = [a[0] + (b[0] - a[0]) * t0, a[1] + (b[1] - a[1]) * t0, ya + (yb - ya) * t0];
    const q = [a[0] + (b[0] - a[0]) * t1, a[1] + (b[1] - a[1]) * t1, ya + (yb - ya) * t1];
    const mine = legs.filter(([x, z]) => {
      const t = ((x - a[0]) * (b[0] - a[0]) + (z - a[1]) * (b[1] - a[1])) / (L * L);
      return t >= t0 && (t < t1 || (j === n - 1 && t <= 1));
    });
    P.add({ type: 'conveyor', x: p[0], z: p[1], a: p, b: q, w, legs: mine });
  }
}

function planWorks(P) {
  // two blast furnaces in the infield: three stoves each, a dust catcher, a
  // cast house, and a skip incline up from the stockhouse by the back straight
  const furnaces = [{ x: -3800, z: -740, h: 44 }, { x: -3640, z: -712, h: 48 }];
  const stockhouses = [];
  for (const f of furnaces) {
    if (!placeRound(P, { type: 'furnace', x: f.x, z: f.z, h: f.h }, 9.5, f.h + 16, { color: '#4a3a30', r2: 4 })) continue;
    for (let k = 0; k < 3; k++) placeRound(P, { type: 'stove', x: f.x - 26 + k * 12, z: f.z - 34, h: 34 + (k % 2) * 3 }, 4.8, 40, { color: '#6a5a50' });
    placeRound(P, { type: 'catcher', x: f.x + 22, z: f.z - 6 }, 4.5, 30, { color: '#5a4a40' });
    placeFoot(P, { type: 'shed', x: f.x - 2, z: f.z + 24, ry: 0, w: 24, d: 14, h: 10, kind: 'cast', map: 'building' }, 14, { color: '#5a4434' });
    const sx = f.x + 4, sz = f.z + 64;
    if (placeFoot(P, { type: 'stockhouse', x: sx, z: sz, ry: 0, w: 16, d: 12, h: 14, map: 'building' }, 16, { color: '#5a4a3a' })) {
      P.add({ type: 'skip', x: f.x, z: f.z, x1: sx, z1: sz - 6, h: f.h });
      stockhouses.push([sx, sz]);
    }
    // the hot-blast main from the stoves round to the bustle pipe
    P.add({ type: 'pipe', x: f.x - 26, z: f.z - 28.5, pts: [[f.x - 30, f.z - 28.5, 14], [f.x + 3, f.z - 28.5, 14], [f.x + 3, f.z - 12, 13]], r: 1.1 });
    const gy = P.groundY(f.x, f.z);
    P.lamp({ x: f.x + 11, z: f.z + 4, hx: f.x + 11, hz: f.z + 4, hy: gy + 20, color: '#ffa040', radius: 24, intensity: 0.9, halo: 1.2 });
    P.lamp({ x: f.x, z: f.z, hx: f.x, hz: f.z, hy: gy + f.h + 21, color: '#ff3020', radius: 4, intensity: 0.6, halo: 2.4 });
    P.far({ shape: 'cyl', x: f.x + 2, z: f.z, y: gy + f.h, r: 1.6, h: 16, color: '#3a3430' });
  }
  // a boiler house and its chimney by the paddock; the gas holder and its
  // flare, the blowing-engine house, the rolling mill across the back straight
  placeFoot(P, { type: 'shed', x: -3945, z: -786, ry: 0, w: 30, d: 16, h: 10, kind: 'boiler', map: 'building' }, 14, { color: '#6a3828', lit: 0.2 });
  placeRound(P, { type: 'holder', x: -4050, z: -425, h: 40, r: 26 }, 27.6, 46, { color: '#5a6058' });
  placeRound(P, { type: 'flare', x: -3990, z: -380, h: 46 }, 1.6, 50, { color: '#3a3430', far: false });
  P.lamp({ x: -3990, z: -380, hx: -3990, hz: -380, hy: P.groundY(-3990, -380) + 49, color: '#ff8a30', radius: 34, intensity: 1.2, halo: 6 });
  for (const [x, z, h] of [[-3520, -430, 88], [-3945, -812, 74], [-4330, -880, 66]]) {
    if (!placeRound(P, { type: 'stack', x, z, h, r: 3.6 }, 4.8, h, { color: '#6a3a2a', r2: 2.4 })) continue;
    const gy = P.groundY(x, z);
    P.lamp({ x, z, hx: x, hz: z, hy: gy + h + 1.5, color: '#ff2a1a', radius: 5, intensity: 0.9, halo: 3.0 });
  }
  placeFoot(P, { type: 'shed', x: -3450, z: -470, ry: 0, w: 120, d: 34, h: 15, kind: 'mill', map: 'building' }, 19, { color: '#5a4434', lit: 0.1 });
  placeFoot(P, { type: 'engine', x: -3880, z: -392, ry: Math.PI, w: 46, d: 18, h: 12, map: 'building' }, 17, { color: '#6a3828', lit: 0.3 });
  placeFoot(P, { type: 'shed', x: -4200, z: -420, ry: 0, w: 40, d: 28, h: 12, kind: 'plain', map: 'building' }, 15, { color: '#5a4434' });
  placeFoot(P, { type: 'shed', x: -3300, z: -600, ry: 0.1, w: 44, d: 26, h: 12, kind: 'plain', map: 'building' }, 15, { color: '#5a4434' });
  // the coke ovens out west, with their quench tower; the stack above is theirs
  if (placeFoot(P, { type: 'coke', x: -4318, z: -770, ry: Math.PI / 2, w: 104, d: 15, h: 9, map: 'building' }, 14, { color: '#5a3426', lit: 0.05 })) {
    placeFoot(P, { type: 'quench', x: -4318, z: -700, ry: 0, w: 9, d: 9, h: 24, map: 'building' }, 26, { color: '#6a6660' });
  }
  // conveyor galleries from the ore yard (south) over the back straight to the stockhouses
  const towers = [[-3812, -468], [-3608, -458]];
  for (let k = 0; k < Math.min(2, stockhouses.length); k++) {
    const [tx, tz] = towers[k], [sx, sz] = stockhouses[k];
    if (!placeFoot(P, { type: 'tower', x: tx, z: tz, ry: 0, w: 7, d: 7, h: 12, map: 'building' }, 14, { color: '#5a4a3a' })) continue;
    planConveyor(P, [tx, tz - 3.5, 9.5], [sx, sz + 6, 11], 3.4);
  }
  // narrow-gauge rails through the yard: ladle cars and ore wagons
  planRails(P, [[-4150, -480], [-4000, -484], [-3900, -480], [-3842, -478]], 6);
  // gas mains on trestles: from the first dust catcher over the back straight
  // to the holder; from the coke ovens over the esses to the stoves
  planOverhead(P, 'gasmain', [[-3778, -752], [-3758, -752], [-3758, -522], [-3990, -522], [-4034, -462]], { every: 16, h: 14, leg: 2.4, r: 1.5 });
  planOverhead(P, 'gasmain', [[-4302, -722], [-4040, -722], [-3836, -722], [-3836, -764]], { every: 16, h: 13, leg: 2.4, r: 1.2 });
  // ore, coal and slag in the yards
  for (const [x, z, r, kind] of [[-3880, -440, 16, 'ore'], [-3700, -398, 14, 'coal'], [-3600, -380, 12, 'ore'], [-4330, -620, 16, 'slag'], [-4320, -480, 12, 'slag'], [-3350, -380, 14, 'coal'], [-4150, -365, 13, 'slag']]) {
    const w = r * 1.7;
    if (!P.isFree(x, z, w, w, 0, { pad: 1, roadPad: true })) continue;
    P.claim(x, z, w, w, 0);
    P.add({ type: 'heap', x, z, r, kind, t: P.rng(), w, d: w, ry: 0, map: 'yard' });
    const gy = P.groundY(x, z);
    P.collider({ kind: 'circle', x, z, r: r * 0.78, y0: gy - 1, y1: gy + r * 0.5 });
  }
  // the works' signs at the gate road, the circuit's over it
  P.add({ type: 'sign', x: -3745, z: -1004, ry: 0.78, slot: 2, w: 5.5, h: 1.4, post: 2.2 });
  P.add({ type: 'sign', x: -3762, z: -977, ry: 0.78 + Math.PI, slot: 0, w: 8, h: 2, post: 5.5 });
  P.lamp({ x: -3762, z: -977, hx: -3762, hz: -977, hy: P.groundY(-3762, -977) + 7, color: '#ff8a30', radius: 12, intensity: 0.7, halo: 2.5 });
}

/** Rails along pts (claimed, so nothing stands on them), in pieces; `cars` wagons along them. */
function planRails(P, pts, cars) {
  let n = 0;
  for (let k = 0; k < pts.length - 1; k++) {
    const a = pts[k], b = pts[k + 1];
    const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const ry = Math.atan2(b[0] - a[0], b[1] - a[1]);
    const mx = (a[0] + b[0]) / 2, mz = (a[1] + b[1]) / 2;
    if (!P.isFree(mx, mz, 3, L, ry, { pad: 0, roadPad: true })) continue;
    P.claim(mx, mz, 3, L, ry);
    const list = [];
    for (let d = 12; d < L - 8 && n < cars; d += 24 + P.rng() * 18) {
      list.push({ d, kind: P.rng() < 0.55 ? 'ladle' : 'wagon' });
      const x = a[0] + (b[0] - a[0]) * (d / L), z = a[1] + (b[1] - a[1]) * (d / L);
      const gy = P.groundY(x, z);
      P.collider({ kind: 'box', x, z, hx: 1.3, hz: 4.8, ry, y0: gy - 1, y1: gy + 3.5 });
      n++;
    }
    P.add({ type: 'rails', x: a[0], z: a[1], a, b, cars: list });
  }
}

function planYard(P) {
  const r = P.net.byId.get('iy_lane');
  if (!r) return;
  const e = r.posAt(r.length - 1);
  // the ladle yard round Foundry Lane's end: a gantry crane, the loco shed,
  // the last torpedo car (still warm), scrap
  const cx = e.x - 30, cz = e.z + 10;
  placeFoot(P, { type: 'shed', x: cx - 20, z: cz - 30, ry: 0.2, w: 30, d: 14, h: 9, kind: 'loco', map: 'building' }, 11, { color: '#5a4434' });
  P.add({ type: 'gantrycrane', x: cx, z: cz + 6, ry: 0.2, w: 34, h: 13 });
  for (const dx of [-17, 17]) { const [x, z] = toWorld(cx, cz + 6, 0.2, dx, 0); P.collider({ kind: 'box', x, z, hx: 0.8, hz: 4, ry: 0.2, y0: P.groundY(x, z) - 1, y1: P.groundY(x, z) + 14 }); }
  for (let k = 0; k < 7; k++) {
    const x = cx - 10 + P.range(-24, 24), z = cz + P.range(-10, 30);
    if (!P.isFree(x, z, 6, 6, 0, { pad: 0.5 })) continue;
    P.claim(x, z, 6, 6, 0);
    P.add({ type: 'scrap', x, z, t: P.rng() });
    P.collider({ kind: 'circle', x, z, r: 2.4, y0: P.groundY(x, z) - 1, y1: P.groundY(x, z) + 3 });
  }
  P.add({ type: 'loco', x: cx - 20, z: cz - 14, ry: 0.2 + Math.PI / 2 });
  P.collider({ kind: 'box', x: cx - 20, z: cz - 14, hx: 1.5, hz: 5, ry: 0.2 + Math.PI / 2, y0: P.groundY(cx - 20, cz - 14) - 1, y1: P.groundY(cx - 20, cz - 14) + 4 });
  P.add({ type: 'ladle', x: cx + 8, z: cz + 22, ry: 0.2, hot: true });
  P.collider({ kind: 'box', x: cx + 8, z: cz + 22, hx: 1.4, hz: 5, ry: 0.2, y0: P.groundY(cx + 8, cz + 22) - 1, y1: P.groundY(cx + 8, cz + 22) + 4 });
  P.add({ type: 'sign', x: e.x + 6, z: e.z - 8, ry: Math.atan2(-r.TX[e.i], -r.TZ[e.i]), slot: 3, w: 4, h: 1, post: 1.4 });
  const ly = P.groundY(cx, cz);
  P.lamp({ x: cx, z: cz + 6, hx: cx, hz: cz + 6, hy: ly + 12, color: '#ffa848', radius: 22, intensity: 0.8, halo: 1.6 });
  P.lamp({ x: cx + 8, z: cz + 22, hx: cx + 8, hz: cz + 22, hy: ly + 4.5, color: '#ff6a20', radius: 9, intensity: 0.9, halo: 1.0 });
  P.landmark({ id: 'ladleyard', name: 'LADLE YARD', x: cx, z: cz, kind: 'industry', hidden: true });
}

// ------------------------------------------------------------------ build: the works

function buildFurnace(B, M, it) {
  const gy = B.groundY(it.x, it.z);
  const plate = B.acc(M.plate), conc = B.acc(M.conc), paint = B.acc(M.paint), hot = B.acc(M.hot);
  const x = it.x, z = it.z, H = it.h;
  col(conc, lin('#8a867e'));
  box(conc, x, gy - 1, z, 22, 3, 22, 0, { u: 4 });
  // hearth, bosh, stack, top cone
  col(plate, lin('#6a4a38'));
  lathe(plate, x, gy + 2, z, [[7.2, 0], [7.2, 8], [8.4, 12], [8.4, 14.5], [6.4, H * 0.62], [5.0, H * 0.86], [5.0, H * 0.9], [3.2, H], [3.2, H + 3]], 14, { u: 4, v: 4, top: true });
  // the bustle pipe round the bosh and the tuyere stocks
  col(plate, lin('#5a3e30'));
  const by = gy + 2 + 11;
  for (let k = 0; k < 14; k++) {
    const a0 = (k / 14) * Math.PI * 2, a1 = ((k + 1) / 14) * Math.PI * 2;
    tube(plate, [x + Math.cos(a0) * 10.5, by, z + Math.sin(a0) * 10.5], [x + Math.cos(a1) * 10.5, by, z + Math.sin(a1) * 10.5], 0.9, 7);
    if (k % 2 === 0) tube(plate, [x + Math.cos(a0) * 10.2, by - 0.4, z + Math.sin(a0) * 10.2], [x + Math.cos(a0) * 7.6, by - 3.2, z + Math.sin(a0) * 7.6], 0.3, 5);
  }
  // the glow of the taphole at its foot
  box(hot, x, gy + 2.2, z + 7.4, 1.2, 0.9, 0.3, 0, { u: 1 });
  // platforms with railings at three levels, columns down to the ground
  col(paint, lin('#3a3632'));
  for (const fy of [16, H * 0.58, H * 0.9]) {
    const yy = gy + 2 + fy;
    const rr = fy < 20 ? 10 : 7.5;
    cylinder(paint, x, yy, z, rr, 0.35, 12, { top: true });
    for (let k = 0; k < 12; k++) {
      const a0 = (k / 12) * Math.PI * 2, a1 = ((k + 1) / 12) * Math.PI * 2;
      beam(paint, [x + Math.cos(a0) * rr, yy + 1.1, z + Math.sin(a0) * rr], [x + Math.cos(a1) * rr, yy + 1.1, z + Math.sin(a1) * rr], 0.07, 0.07);
    }
  }
  for (let k = 0; k < 4; k++) {
    const a = k * Math.PI / 2 + Math.PI / 4;
    lattice2(paint, [x + Math.cos(a) * 9.4, gy, z + Math.sin(a) * 9.4], [x + Math.cos(a) * 8, gy + H * 0.9, z + Math.sin(a) * 8], 0.9, { bar: 0.09, bay: 2.5 });
  }
  // four uptakes from the top joining into the downcomer to the dust catcher
  col(plate, lin('#5e4436'));
  const ty = gy + 2 + H + 3;
  for (let k = 0; k < 4; k++) {
    const a = k * Math.PI / 2;
    tube(plate, [x + Math.cos(a) * 2.6, ty - 2, z + Math.sin(a) * 2.6], [x + Math.cos(a) * 1.8, ty + 9, z + Math.sin(a) * 1.8], 0.7, 7);
  }
  tube(plate, [x, ty + 9, z], [x + 4, ty + 11, z - 1], 1.1, 8, { caps: true });
  tube(plate, [x + 4, ty + 11, z - 1], [x + 22, gy + 26, z - 6], 1.1, 8, { caps: true });
  // the top: a charging house
  col(plate, lin('#4e3a30'));
  box(plate, x, ty + 1, z, 7, 6, 7, 0, { u: 4 });
}

function buildStove(B, M, it) {
  const gy = B.groundY(it.x, it.z);
  const plate = B.acc(M.plate);
  col(plate, lin('#7a6a5e'));
  lathe(plate, it.x, gy - 0.5, it.z, [[4.8, 0], [4.8, it.h - 3.5], [4.2, it.h - 1.5], [3.0, it.h - 0.3], [1.2, it.h + 0.4], [0, it.h + 0.6]], 12, { u: 4, v: 4 });
  col(plate, lin('#5a4a40'));
  tube(plate, [it.x, gy + 14, it.z + 4.4], [it.x, gy + 14, it.z + 5.6], 0.8, 8);
  const paint = B.acc(M.paint);
  col(paint, lin('#3a3632'));
  cylinder(paint, it.x, gy + it.h * 0.5, it.z, 5.6, 0.3, 12, { top: true });
  col(paint, WHITE);
}

function buildCatcher(B, M, it) {
  const gy = B.groundY(it.x, it.z);
  const plate = B.acc(M.plate), paint = B.acc(M.paint);
  col(plate, lin('#6a5446'));
  lathe(plate, it.x, gy + 8, it.z, [[0.6, 0], [4.5, 5], [4.5, 16], [2.5, 19], [1.2, 20]], 10, { u: 4, top: true });
  col(paint, lin('#3a3632'));
  for (let k = 0; k < 4; k++) { const a = k * Math.PI / 2 + Math.PI / 4; beam(paint, [it.x + Math.cos(a) * 3.8, gy, it.z + Math.sin(a) * 3.8], [it.x + Math.cos(a) * 3.8, gy + 13, it.z + Math.sin(a) * 3.8], 0.5, 0.5); }
  col(paint, WHITE);
}

function buildSkip(B, M, it) {
  // a truss incline from the stockhouse up to the furnace top
  const gy0 = B.groundY(it.x1, it.z1), gy1 = B.groundY(it.x, it.z);
  const paint = B.acc(M.paint), corr = B.acc(M.corr);
  col(paint, lin('#5a3424'));
  const a = [it.x1, gy0 + 2, it.z1], b = [it.x + 1, gy1 + it.h + 4, it.z + 6];
  lattice2(paint, a, b, 2.6, { bar: 0.14, bay: 4 });
  // trestles under it
  for (const t of [0.3, 0.6]) {
    const px = a[0] + (b[0] - a[0]) * t, pz = a[2] + (b[2] - a[2]) * t, py = a[1] + (b[1] - a[1]) * t;
    lattice2(paint, [px, B.groundY(px, pz) - 0.5, pz], [px, py - 1.3, pz], 1.6, { bar: 0.1 });
  }
  col(paint, WHITE); col(corr, WHITE);
}

function buildPipe(B, M, it) {
  const plate = B.acc(M.plate), paint = B.acc(M.paint);
  col(plate, lin('#6a5446'));
  const gy = B.groundY(it.pts[0][0], it.pts[0][1]);
  for (let k = 0; k < it.pts.length - 1; k++) {
    const p = it.pts[k], q = it.pts[k + 1];
    tube(plate, [p[0], gy + p[2], p[1]], [q[0], gy + q[2], q[1]], it.r, 8);
  }
  col(paint, lin('#3a3632'));
  for (const p of it.pts.slice(1)) beam(paint, [p[0], B.groundY(p[0], p[1]) - 0.5, p[1]], [p[0], gy + p[2] - it.r, p[1]], 0.5, 0.5);
  col(plate, WHITE); col(paint, WHITE);
}

/** A piece of gas main from a to b at height y, on its trestles; a fat elbow where it turns. */
function buildGasMain(B, M, it) {
  const plate = B.acc(M.plate), paint = B.acc(M.paint);
  const A = [it.a[0], it.y, it.a[1]], Bq = [it.b[0], it.y, it.b[1]];
  col(plate, lin('#6e5444'));
  tube(plate, A, Bq, it.r, 9, { u: 3 });
  // a smaller pipe riding on top, and the walkway beside it
  col(plate, lin('#4e4440'));
  tube(plate, [A[0], A[1] + it.r + 0.55, A[2]], [Bq[0], Bq[1] + it.r + 0.55, Bq[2]], it.r * 0.4, 6);
  if (it.elbow) {
    col(plate, lin('#5e4a3c'));
    cylinder(plate, A[0], A[1] - it.r * 1.3, A[2], it.r * 1.35, it.r * 2.6, 9, { top: true });
  }
  col(paint, lin('#3e3430'));
  for (const [x, z] of it.legs) {
    const gy = B.groundY(x, z);
    lattice2(paint, [x, gy - 0.5, z], [x, it.y - it.r - 0.3, z], 1.8, { bar: 0.11, w2: 1.2 });
    // the saddle under the pipe
    const dx = Bq[0] - A[0], dz = Bq[2] - A[2], L = Math.hypot(dx, dz) || 1;
    const nx = -dz / L, nz = dx / L;
    beam(paint, [x - nx * 1.6, it.y - it.r - 0.25, z - nz * 1.6], [x + nx * 1.6, it.y - it.r - 0.25, z + nz * 1.6], 0.3, 0.4);
  }
  col(plate, WHITE); col(paint, WHITE);
}

/** A piece of conveyor gallery (a cladded, sloping box on a truss) from a to b ([x, z, y]). */
function buildConveyor(B, M, it) {
  const corr = B.acc(M.corr), paint = B.acc(M.paint);
  const A = [it.a[0], it.a[2], it.a[1]], Bq = [it.b[0], it.b[2], it.b[1]];
  const dx = Bq[0] - A[0], dz = Bq[2] - A[2], L = Math.hypot(dx, dz);
  const ry = Math.atan2(dx, dz);
  const w = it.w, H = 2.8;
  const c = Math.cos(ry), s = Math.sin(ry);
  const side = (lx) => [lx * c, -lx * s];
  const corners = [[-w / 2, 0], [w / 2, 0], [w / 2, H], [-w / 2, H]];
  col(corr, lin('#8a6a52'));
  for (let k = 0; k < 4; k++) {
    const [ax, ay] = corners[k], [bx, by] = corners[(k + 1) % 4];
    const sa = side(ax), sb = side(bx);
    const p0 = [A[0] + sa[0], A[1] + ay, A[2] + sa[1]], p1 = [A[0] + sb[0], A[1] + by, A[2] + sb[1]];
    const q0 = [Bq[0] + sa[0], Bq[1] + ay, Bq[2] + sa[1]], q1 = [Bq[0] + sb[0], Bq[1] + by, Bq[2] + sb[1]];
    corr.quadP(q0, p0, p1, q1, [L / 3, 0, 0, (k % 2 ? H : w) / 3]);
  }
  // a strip of small lit windows along each side (the walkway inside)
  const fl = B.acc(M.hot);
  for (const sx of [-1, 1]) {
    const o = side(sx * (w / 2 + 0.03));
    for (let d = 3; d < L - 2; d += 7) {
      const t = d / L;
      const x = A[0] + dx * t + o[0], z = A[2] + dz * t + o[1], y = A[1] + (Bq[1] - A[1]) * t + 1.5;
      box(fl, x, y, z, 0.05, 0.35, 0.8, ry, { u: 1 });
    }
  }
  // the truss under it, the trestles
  col(paint, lin('#5a3424'));
  lattice2(paint, [A[0], A[1] - 1.3, A[2]], [Bq[0], Bq[1] - 1.3, Bq[2]], 2.4, { bar: 0.12, bay: 4 });
  for (const [x, z, y] of it.legs) {
    const gy = B.groundY(x, z);
    lattice2(paint, [x, gy - 0.5, z], [x, y - 2.5, z], 2.4, { bar: 0.12, w2: 1.4 });
  }
  col(corr, WHITE); col(paint, WHITE);
}

/** The ore yard's transfer tower: a steel frame, a clad house on top. */
function buildTower(B, M, it) {
  const g = B.footY(it.x, it.z, it.w, it.d, it.ry);
  const F = new Fr(it.x, 0, it.z, it.ry);
  const paint = B.acc(M.paint), corr = B.acc(M.corr), conc = B.acc(M.conc);
  col(conc, lin('#7a766e'));
  F.box(conc, 0, g.lo - 1, 0, it.w, g.hi - g.lo + 1.3, it.d, { u: 3 });
  col(paint, lin('#5a3424'));
  for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) beam(paint, F.p(sx * (it.w / 2 - 0.4), g.hi, sz * (it.d / 2 - 0.4)), F.p(sx * (it.w / 2 - 0.4), g.hi + it.h - 4, sz * (it.d / 2 - 0.4)), 0.4, 0.4);
  for (const y of [it.h * 0.33, it.h * 0.66]) {
    beam(paint, F.p(-it.w / 2 + 0.4, g.hi + y, -it.d / 2 + 0.4), F.p(it.w / 2 - 0.4, g.hi + y, it.d / 2 - 0.4), 0.2, 0.2);
    beam(paint, F.p(it.w / 2 - 0.4, g.hi + y, -it.d / 2 + 0.4), F.p(-it.w / 2 + 0.4, g.hi + y, it.d / 2 - 0.4), 0.2, 0.2);
  }
  col(corr, lin('#7a5e4a'));
  F.box(corr, 0, g.hi + it.h - 4, 0, it.w, 4, it.d, { u: 3 });
  gable(corr, it.x, g.hi + it.h, it.z, it.w + 0.4, it.d + 0.4, 1.2, it.ry, { over: 0.2, endAcc: corr });
  col(paint, WHITE); col(corr, WHITE); col(conc, WHITE);
}

/** The stockhouse at the skip's foot: bins under a clad shed. */
function buildStockhouse(B, M, it) {
  const g = B.footY(it.x, it.z, it.w, it.d, it.ry);
  const F = new Fr(it.x, 0, it.z, it.ry);
  const corr = B.acc(M.corr), conc = B.acc(M.conc);
  col(conc, lin('#76726a'));
  F.box(conc, 0, g.lo - 1, 0, it.w + 0.4, g.hi - g.lo + 5, it.d + 0.4, { u: 3 });
  col(corr, lin('#86664e'));
  F.box(corr, 0, g.hi + 4, 0, it.w, it.h - 4, it.d, { u: 3 });
  gable(corr, it.x, g.hi + it.h, it.z, it.w + 0.6, it.d + 0.6, 2.2, it.ry, { over: 0.3, alongZ: true, endAcc: corr });
  col(corr, WHITE); col(conc, WHITE);
}

/** The coke-oven battery: a long brick block of ovens, doors down both sides, the collecting main on top, its coal tower. */
function buildCoke(B, M, it) {
  const g = B.footY(it.x, it.z, it.w, it.d, it.ry);
  const F = new Fr(it.x, 0, it.z, it.ry);
  const wall = B.acc(M.wall), paint = B.acc(M.paint), plate = B.acc(M.plate), conc = B.acc(M.conc);
  const base = g.hi;
  col(conc, lin('#6e6a62'));
  F.box(conc, 0, g.lo - 1, 0, it.w + 2, base - g.lo + 2.2, it.d + 6, { u: 3 });
  col(wall, lin('#c8b0a0'));
  for (let k = 0; k < 2; k++) storey(wall, it.x, base + 1.2 + k * STOREY, it.z, it.w, it.d, it.ry, 1);
  col(conc, lin('#5a5650'));
  F.box(conc, 0, base + 1.2 + 2 * STOREY, 0, it.w + 0.4, 0.8, it.d + 0.4, { u: 3 });
  // the oven doors: dark iron slabs, every 2.6 m on both faces
  col(paint, lin('#1e1a18'));
  for (let x = -it.w / 2 + 3; x < it.w / 2 - 2; x += 2.6) {
    for (const sz of [1, -1]) F.box(paint, x, base + 1.4, sz * (it.d / 2 + 0.15), 1.2, 5.6, 0.3, { u: 1 });
  }
  // buckstays between them, the charging rails on top, the ascension pipes, the collecting main
  col(paint, lin('#3a3230'));
  for (let x = -it.w / 2 + 1.7; x < it.w / 2 - 1; x += 2.6) {
    for (const sz of [1, -1]) F.box(paint, x, base + 1.2, sz * (it.d / 2 + 0.25), 0.3, 7.6, 0.3, { u: 1 });
  }
  const top = base + 2 + 2 * STOREY;
  for (const lz of [-3, 3]) beam(paint, F.p(-it.w / 2, top + 0.15, lz), F.p(it.w / 2, top + 0.15, lz), 0.15, 0.2);
  col(plate, lin('#4a3a30'));
  for (let x = -it.w / 2 + 3; x < it.w / 2 - 2; x += 5.2) tube(plate, F.p(x, top, -it.d / 2 + 1.5), F.p(x, top + 3.2, -it.d / 2 + 1.5), 0.35, 6);
  tube(plate, F.p(-it.w / 2, top + 3.4, -it.d / 2 + 1.5), F.p(it.w / 2, top + 3.4, -it.d / 2 + 1.5), 0.9, 8, { caps: true });
  // the larry car on its rails, the coal tower at the north end
  col(paint, lin('#6a5a30'));
  F.box(paint, it.w * 0.18, top + 0.3, 0, 6, 3.2, 7, { u: 2 });
  const corr = B.acc(M.corr);
  col(corr, lin('#6e5644'));
  F.box(corr, -it.w / 2 - 6, base - 0.5, 0, 12, 26, 12, { u: 3 });
  gable(corr, F.wx(-it.w / 2 - 6, 0), base + 25.5, F.wz(-it.w / 2 - 6, 0), 12.6, 12.6, 2.4, it.ry, { over: 0.3, endAcc: corr });
  col(wall, WHITE); col(paint, WHITE); col(plate, WHITE); col(conc, WHITE); col(corr, WHITE);
}

/** The quench tower: a tall open-topped timber-and-concrete chimney the coke cars steamed under. */
function buildQuench(B, M, it) {
  const g = B.footY(it.x, it.z, it.w, it.d, it.ry);
  const F = new Fr(it.x, 0, it.z, it.ry);
  const conc = B.acc(M.conc), paint = B.acc(M.paint);
  col(conc, lin('#8a867c'));
  F.box(conc, 0, g.lo - 1, 0, it.w + 4, g.hi - g.lo + 9, it.d + 2, { u: 3 });
  col(conc, lin('#9a968c'));
  lathe(conc, it.x, g.hi + 8, it.z, [[it.w / 2, 0], [it.w / 2 - 1, it.h - 10], [it.w / 2 - 0.6, it.h - 8]], 4, { u: 3, a0: Math.PI / 4, a1: Math.PI * 2 + Math.PI / 4 });
  col(paint, lin('#141414'));
  cylinder(paint, it.x, g.hi + it.h - 8.1, it.z, it.w / 2 - 1.1, 0.2, 4, { top: true });
  col(conc, WHITE); col(paint, WHITE);
}

function buildHolder(B, M, it) {
  const gy = B.groundY(it.x, it.z);
  const plate = B.acc(M.plate), paint = B.acc(M.paint);
  const r = it.r, h = it.h;
  // the bell (the holder itself), its crown
  col(plate, lin('#7a8478'));
  lathe(plate, it.x, gy - 0.5, it.z, [[r, 0], [r, h * 0.82], [r * 0.92, h * 0.86], [r * 0.5, h * 0.92], [0.1, h * 0.94]], 18, { u: 4, v: 4 });
  // the guide frame: lattice columns round it, three rings of girders
  col(paint, lin('#6a2e22'));
  const n = 12, R = r + 1.6;
  for (let k = 0; k < n; k++) {
    const a = (k / n) * Math.PI * 2;
    lattice2(paint, [it.x + Math.cos(a) * R, gy - 0.5, it.z + Math.sin(a) * R], [it.x + Math.cos(a) * R, gy + h + 4, it.z + Math.sin(a) * R], 1.2, { bar: 0.1, bay: 3 });
  }
  for (const fy of [h * 0.35, h * 0.7, h + 3.6]) {
    for (let k = 0; k < n; k++) {
      const a0 = (k / n) * Math.PI * 2, a1 = ((k + 1) / n) * Math.PI * 2;
      lattice2(paint, [it.x + Math.cos(a0) * R, gy + fy, it.z + Math.sin(a0) * R], [it.x + Math.cos(a1) * R, gy + fy, it.z + Math.sin(a1) * R], 0.8, { bar: 0.08, bay: 3 });
    }
  }
  col(plate, WHITE); col(paint, WHITE);
}

function buildStack(B, M, it, anims) {
  const gy = B.groundY(it.x, it.z);
  const stack = B.acc(M.stack), paint = B.acc(M.paint);
  col(stack, WHITE);
  lathe(stack, it.x, gy - 1, it.z, [[it.r + 1.2, 0], [it.r + 1.2, 6], [it.r, 8], [it.r * 0.62, it.h - 3], [it.r * 0.7, it.h - 1.5], [it.r * 0.7, it.h]], 12, { u: 4, v: 4 });
  // the sooty crown
  col(paint, lin('#1c1a18'));
  cylinder(paint, it.x, gy + it.h - 2.4, it.z, it.r * 0.72, 2.4, 12);
  col(paint, WHITE);
  // the aviation light (blinks)
  const g = new THREE.SphereGeometry(0.45, 6, 4);
  const m = new THREE.Mesh(g, M.red);
  m.position.set(it.x, gy + it.h + 0.8, it.z);
  m.matrixAutoUpdate = true;
  B.group.add(m);
  const ph = hash2(it.x, it.z) * 3;
  anims.push((t, dt, d) => { m.visible = ((t + ph) % 1.6) < 0.9; });
}

function buildFlare(B, M, it, anims) {
  const gy = B.groundY(it.x, it.z);
  const paint = B.acc(M.paint);
  col(paint, lin('#3a3430'));
  lattice2(paint, [it.x, gy - 0.5, it.z], [it.x, gy + it.h - 2, it.z], 2.2, { bar: 0.12, w2: 0.8 });
  cylinder(paint, it.x, gy, it.z, 0.5, it.h, 8);
  col(paint, WHITE);
  // the flame: two cones that lick and sway
  const g = new THREE.ConeGeometry(1.2, 6, 7, 1, true);
  g.translate(0, 3, 0);
  const g2 = new THREE.ConeGeometry(0.7, 4, 6, 1, true);
  g2.translate(0, 2, 0);
  const m1 = new THREE.Mesh(g, M.flame), m2 = new THREE.Mesh(g2, M.hot);
  for (const m of [m1, m2]) { m.position.set(it.x, gy + it.h, it.z); m.matrixAutoUpdate = true; B.group.add(m); }
  anims.push((t, dt, d) => {
    if (d > 900) return;
    const k = 1 + 0.28 * Math.sin(t * 9.1) + 0.14 * Math.sin(t * 23.7);
    m1.scale.set(1 + 0.1 * Math.sin(t * 7), k, 1 + 0.1 * Math.cos(t * 6));
    m1.rotation.z = 0.12 * Math.sin(t * 1.7);
    m2.scale.set(1, 1.1 + 0.3 * Math.sin(t * 13 + 1), 1);
    m2.rotation.z = 0.1 * Math.sin(t * 2.1 + 1);
  });
}

function buildShed(B, M, it) {
  const g = B.footY(it.x, it.z, it.w, it.d, it.ry);
  const y0 = g.lo - 0.3;
  const F = new Fr(it.x, 0, it.z, it.ry);
  const wall = B.acc(M.wall), corr = B.acc(M.corr), conc = B.acc(M.conc), paint = B.acc(M.paint);
  col(conc, lin('#7a766e'));
  F.box(conc, 0, g.lo - 1, 0, it.w + 0.4, g.hi - g.lo + 1.3, it.d + 0.4, { u: 3 });
  const base = g.hi + 0.3;
  const nst = Math.max(2, Math.round(it.h / STOREY));
  const brickish = it.kind === 'boiler' || it.kind === 'loco';
  col(wall, lin(it.kind === 'cast' ? '#ffffff' : brickish ? '#f0e4dc' : '#e8dcd0'));
  for (let k = 0; k < nst; k++) storey(wall, it.x, base + k * STOREY, it.z, it.w, it.d, it.ry, brickish ? (k === nst - 1 ? 0 : 1) : (k === nst - 1 ? 2 : 5));
  const top = base + nst * STOREY;
  col(corr, lin(brickish ? '#4a4644' : '#7a5e4a'));
  if (it.kind === 'mill') {
    sawtooth(corr, B.acc(M.wall), it.x, top, it.z, it.w, it.d, it.ry, 5, 4, { u: 3 });
  } else {
    gable(corr, it.x, top, it.z, it.w, it.d, it.d * 0.22, it.ry, { over: 0.4, alongZ: false, endAcc: corr });
    // a monitor (raised vent) along the ridge
    if (it.kind === 'cast') { F.box(corr, 0, top + it.d * 0.22 - 0.4, 0, it.w * 0.8, 2, 3, { u: 3 }); }
  }
  // big doors (dark) on the long faces
  col(paint, lin('#2a2420'));
  for (const sz of [1, -1]) F.box(paint, -it.w * 0.2, base, sz * (it.d / 2 + 0.02), 6, 6, 0.1, { u: 2 });
  col(wall, WHITE); col(corr, WHITE); col(conc, WHITE); col(paint, WHITE);
}

function buildEngineHouse(B, M, it) {
  const g = B.footY(it.x, it.z, it.w, it.d, it.ry);
  const F = new Fr(it.x, 0, it.z, it.ry);
  const wall = B.acc(M.wall), corr = B.acc(M.corr), conc = B.acc(M.conc);
  col(conc, lin('#6e6a62'));
  F.box(conc, 0, g.lo - 1, 0, it.w + 0.6, g.hi - g.lo + 1.4, it.d + 0.6, { u: 3 });
  const base = g.hi + 0.4;
  col(wall, WHITE);
  for (let k = 0; k < 3; k++) storey(wall, it.x, base + k * STOREY, it.z, it.w, it.d, it.ry, k < 2 ? 0 : 1);
  col(corr, lin('#3a3a3c'));
  gable(corr, it.x, base + 3 * STOREY, it.z, it.w, it.d, 4.5, it.ry, { over: 0.6, endAcc: B.acc(M.stack) });
  const sacc = B.acc(M.sign);
  signPanel(sacc, F, 0, base + 3 * STOREY - 1.6, it.d / 2 + 0.06, 9, 2.2, 2);
  col(wall, WHITE); col(corr, WHITE); col(conc, WHITE);
}

function buildHeap(B, M, it) {
  const gy = B.groundY(it.x, it.z);
  const acc = B.acc(M.paint);
  const colr = it.kind === 'ore' ? '#7a3a24' : it.kind === 'coal' ? '#1e1c1c' : '#5e5a56';
  col(acc, lin(colr));
  const r = it.r, h = r * (it.kind === 'slag' ? 0.42 : 0.5);
  lathe(acc, it.x, gy - 0.6, it.z, [[r, 0], [r * 0.82, h * 0.45], [r * 0.45, h * 0.85], [r * 0.12, h], [0, h + 0.2]], 9, { u: 3 });
  col(acc, WHITE);
}

/** A piece of narrow-gauge track from a to b, sleepers and rails on the ground, its cars on it. */
function buildRails(B, M, it) {
  const paint = B.near(M.paint);
  const a = it.a, b = it.b;
  const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const tx = (b[0] - a[0]) / L, tz = (b[1] - a[1]) / L, lx = tz, lz = -tx;
  const ry = Math.atan2(tx, tz);
  col(paint, lin('#4a3a2c'));
  for (let d = 0.8; d < L; d += 1.6) {
    const x = a[0] + tx * d, z = a[1] + tz * d, y = B.groundY(x, z);
    box(paint, x, y - 0.06, z, 1.7, 0.16, 0.26, ry + Math.PI / 2, { u: 1, faces: 'fb' });
  }
  col(paint, lin('#6a5a50'));
  for (const o of [-0.5, 0.5]) {
    for (let d = 0; d < L - 0.01; d += 8) {
      const d1 = Math.min(L, d + 8);
      const p = [a[0] + tx * d + lx * o, 0, a[1] + tz * d + lz * o], q = [a[0] + tx * d1 + lx * o, 0, a[1] + tz * d1 + lz * o];
      p[1] = B.groundY(p[0], p[2]) + 0.17; q[1] = B.groundY(q[0], q[2]) + 0.17;
      beam(paint, p, q, 0.08, 0.12);
    }
  }
  for (const c of it.cars) {
    const x = a[0] + tx * c.d, z = a[1] + tz * c.d, y = B.groundY(x, z);
    if (c.kind === 'ladle') ladle(paint, x, y, z, ry);
    else {
      col(paint, lin('#2a2624'));
      box(paint, x, y + 0.2, z, 1.9, 0.7, 6, ry, { u: 2 });
      col(paint, lin('#5a3a28'));
      box(paint, x, y + 0.9, z, 2.3, 1.5, 6.2, ry, { u: 2 });
      col(paint, lin(hash2(x, z) < 0.5 ? '#7a3a24' : '#1e1c1c'));
      box(paint, x, y + 2.4, z, 2.0, 0.45, 5.8, ry, { u: 2 });
    }
  }
  col(paint, WHITE);
}

/** A torpedo ladle car: a long bellied vessel on bogies. */
function ladle(acc, x, y, z, ry) {
  const c = Math.cos(ry), s = Math.sin(ry);
  const P = (lz) => [x + lz * s, z + lz * c];
  col(acc, lin('#2a2624'));
  for (const lz of [-3.2, 3.2]) { const [bx, bz] = P(lz); box(acc, bx, y + 0.2, bz, 2.2, 0.8, 2.4, ry, { u: 1 }); }
  col(acc, lin('#5e4a3e'));
  const [ax, az] = P(-4.6), [bx, bz] = P(4.6);
  tube(acc, [ax, y + 2.1, az], [bx, y + 2.1, bz], 0.9, 8, { r2: 0.9, caps: true });
  const [mx, mz] = P(-2.2), [nx, nz] = P(2.2);
  tube(acc, [mx, y + 2.1, mz], [nx, y + 2.1, nz], 1.6, 9, { caps: true });
  col(acc, lin('#1a1816'));
  cylinder(acc, x, y + 3.5, z, 0.6, 0.5, 7, { top: true });
}

function buildGantryCrane(B, M, it) {
  const paint = B.acc(M.paint);
  const F = new Fr(it.x, B.groundY(it.x, it.z), it.z, it.ry);
  col(paint, lin('#c8a020'));
  for (const sx of [-1, 1]) {
    for (const sz of [-3.5, 3.5]) lattice2(paint, F.p(sx * it.w / 2, -0.5, sz), F.p(sx * it.w / 2, it.h, sz), 0.9, { bar: 0.1 });
    lattice2(paint, F.p(sx * it.w / 2, it.h, -3.5), F.p(sx * it.w / 2, it.h, 3.5), 0.9, { bar: 0.1 });
  }
  for (const sz of [-1.5, 1.5]) lattice2(paint, F.p(-it.w / 2 - 3, it.h + 0.6, sz), F.p(it.w / 2 + 3, it.h + 0.6, sz), 1.4, { bar: 0.12 });
  col(paint, lin('#3a3632'));
  F.box(paint, 4, it.h - 0.6, 0, 3, 2.4, 4, { u: 2 });
  beam(paint, F.p(4, it.h - 0.6, 0), F.p(4, it.h - 7, 0), 0.06, 0.06);
  col(paint, lin('#5e4a3e'));
  F.box(paint, 4, it.h - 8.6, 0, 1.6, 1.6, 1.6, { u: 1 });
  col(paint, WHITE);
}

function buildLoco(B, M, it) {
  const gy = B.groundY(it.x, it.z);
  const acc = B.acc(M.paint);
  const F = new Fr(it.x, gy, it.z, it.ry);
  col(acc, lin('#1e1c1a'));
  F.box(acc, 0, 0.3, 0, 2.6, 1.0, 9, { u: 2 });
  for (const lz of [-2.6, -0.8, 1.0, 2.8]) for (const sx of [-1.2, 1.2]) {
    const a = F.p(sx - 0.15, 0.75, lz), b = F.p(sx + 0.15, 0.75, lz);
    tube(acc, a, b, 0.72, 10, { caps: true });
  }
  col(acc, lin('#3a2e28'));
  tube(acc, F.p(0, 2.3, -2.6), F.p(0, 2.3, 4.2), 1.15, 10, { caps: true });
  F.box(acc, 0, 1.3, -3.8, 2.8, 2.8, 2.6, { u: 2 });
  col(acc, lin('#141414'));
  cylinder(acc, F.wx(0, 3.4), gy + 3.2, F.wz(0, 3.4), 0.35, 1.2, 7, { r2: 0.45 });
  col(acc, lin('#7a3a24'));
  F.box(acc, 0, 4.1, -3.8, 3.0, 0.15, 3.0, { u: 2 });
  col(acc, WHITE);
}

function buildScrap(B, M, it) {
  const gy = B.groundY(it.x, it.z);
  const acc = B.near(M.paint);
  const rng = makeRng('scrap' + it.x + it.z);
  for (let k = 0; k < 9; k++) {
    col(acc, lin(['#6a4a38', '#4a3a30', '#7a5a46', '#3a3a3a', '#8a6a52'][k % 5]));
    const a = rng() * 6.28, r = rng() * 2.4;
    if (rng() < 0.5) box(acc, it.x + Math.cos(a) * r, gy - 0.3 + rng() * 0.8, it.z + Math.sin(a) * r, 0.8 + rng() * 2, 0.4 + rng() * 1.4, 0.6 + rng() * 2, rng() * 3, { u: 1 });
    else tube(acc, [it.x + Math.cos(a) * r, gy + 0.3, it.z + Math.sin(a) * r], [it.x + Math.cos(a + 1) * (r + 2), gy + 0.3 + rng() * 1.5, it.z + Math.sin(a + 1) * (r + 2)], 0.15 + rng() * 0.3, 5);
  }
  col(acc, WHITE);
}

function buildSign(B, M, it) {
  const F = new Fr(it.x, 0, it.z, it.ry);
  const gy = B.groundY(it.x, it.z);
  const paint = B.acc(M.paint);
  col(paint, lin('#3a3632'));
  for (const sx of [-1, 1]) F.box(paint, sx * (it.w / 2 - 0.3), gy - 0.5, 0, 0.25, it.post + it.h + 0.6, 0.25, { u: 1 });
  F.box(paint, 0, gy + it.post - 0.15, -0.1, it.w + 0.3, it.h + 0.3, 0.15, { u: 1 });
  signPanel(B.acc(M.sign), F, 0, gy + it.post, 0, it.w, it.h, it.slot);
  signPanel(B.acc(M.sign), new Fr(it.x, 0, it.z, it.ry + Math.PI), 0, gy + it.post, 0.2, it.w, it.h, it.slot);
  col(paint, WHITE);
}

// ------------------------------------------------------------------ build: the circuit's buildings

function buildPits(B, M, it) {
  const g = B.footY(it.x, it.z, it.w, it.d, it.ry);
  const F = new Fr(it.x, 0, it.z, it.ry);
  const wall = B.acc(M.wall), conc = B.acc(M.conc), corr = B.acc(M.corr), paint = B.acc(M.paint);
  const base = g.hi + 0.2;
  col(conc, lin('#6e6a62'));
  F.box(conc, 0, g.lo - 1, 0, it.w, base - g.lo + 1, it.d, { u: 3 });
  // ground floor: garages toward the pit lane (front), brick behind
  col(wall, WHITE);
  storey(wall, it.x, base, it.z, it.w, it.d, it.ry, 3, 'f');
  storey(wall, it.x, base, it.z, it.w, it.d, it.ry, 1, 'blr');
  // first floor: arched brick windows; a steel-and-glass hospitality strip on top
  storey(wall, it.x, base + STOREY, it.z, it.w, it.d, it.ry, 0);
  const sF = F.sub(0, 0, -1.5);
  storey(wall, sF.x, base + 2 * STOREY, sF.z, it.w - 6, it.d - 3, it.ry, 4);
  col(conc, lin('#8a8680'));
  F.box(conc, 0, base + 2 * STOREY - 0.25, 0, it.w + 0.6, 0.35, it.d + 0.8, { u: 3 });
  F.box(conc, 0, base + 3 * STOREY, -1.5, it.w - 5.4, 0.5, it.d - 2.4, { u: 3 });
  // a balcony rail along the first-floor roof terrace
  col(paint, lin('#2a2c2e'));
  beam(paint, F.p(-it.w / 2, base + 2 * STOREY + 1.1, it.d / 2 + 0.3), F.p(it.w / 2, base + 2 * STOREY + 1.1, it.d / 2 + 0.3), 0.08, 0.08);
  // steel trusses carrying the canopy over the pit lane
  col(paint, lin('#7a3420'));
  for (let k = 0; k <= 10; k++) {
    const lx = -it.w / 2 + (it.w * k) / 10;
    beam(paint, F.p(lx, base + STOREY + 0.5, it.d / 2), F.p(lx, base + STOREY - 0.2, it.d / 2 + 6), 0.25, 0.4);
  }
  col(corr, lin('#5e4c40'));
  corr.quadP(F.p(-it.w / 2, base + STOREY - 0.1, it.d / 2 + 6.2), F.p(it.w / 2, base + STOREY - 0.1, it.d / 2 + 6.2), F.p(it.w / 2, base + STOREY + 0.6, it.d / 2), F.p(-it.w / 2, base + STOREY + 0.6, it.d / 2), [0, 0, it.w / 3, 2]);
  corr.quadP(F.p(it.w / 2, base + STOREY - 0.1, it.d / 2 + 6.2), F.p(-it.w / 2, base + STOREY - 0.1, it.d / 2 + 6.2), F.p(-it.w / 2, base + STOREY + 0.6, it.d / 2), F.p(it.w / 2, base + STOREY + 0.6, it.d / 2), [0, 0, it.w / 3, 2]);
  // the race control tower at the west end
  const tx = -it.w / 2 + 7;
  col(wall, WHITE);
  for (let k = 0; k < 2; k++) storey(wall, F.wx(tx, 0), base + (3 + k) * STOREY, F.wz(tx, 0), 12, 12, it.ry, 4);
  col(conc, lin('#8a8680'));
  F.box(conc, tx, base + 5 * STOREY, 0, 13, 0.6, 13, { u: 3 });
  // signs: the circuit's name along the roof, RACE CONTROL, PIT LANE
  const sacc = B.acc(M.sign);
  signPanel(sacc, F, 0, base + 3 * STOREY + 0.5, it.d / 2 - 1.4, 22, 5.5, 0);
  signPanel(sacc, F, tx, base + 5 * STOREY + 0.6, 6.6, 9, 2.2, 4);
  signPanel(sacc, new Fr(it.x, 0, it.z, it.ry + Math.PI), 0, base + 3 * STOREY + 0.5, it.d / 2 + 0.06, 22, 5.5, 0);
  col(wall, WHITE); col(conc, WHITE); col(corr, WHITE); col(paint, WHITE);
}

// ------------------------------------------------------------------ scatter

function scatter(S) {
  // brownfield: pioneer birches and bushes in the yards, rubble, weeds
  const inBox = (x, z) => x > BOX.x0 && x < BOX.x1 && z > BOX.z0 && z < BOX.z1;
  for (const [x, z] of S.points(18, { r: 3, density: (px, pz) => 0.25 + 0.35 * S.noise(px / 120, pz / 120) })) {
    if (!inBox(x, z)) continue;
    const y = S.groundY(x, z);
    const u = S.rng();
    if (u < 0.35 && S.free(x, z, 9)) {
      S.add({ type: 'birch', x, z, y, s: S.range(0.6, 1.1), t: S.rng() });
      S.collider({ kind: 'circle', x, z, r: 0.35, y0: y - 1, y1: y + 6 });
    } else if (u < 0.75) S.add({ type: 'bush', x, z, y, s: S.range(0.6, 1.4), t: S.rng() });
    else if (u < 0.9) S.add({ type: 'rubble', x, z, y, s: S.range(0.5, 1.4), t: S.rng() });
    else S.add({ type: 'drums', x, z, y, t: S.rng() });
  }
}

// ------------------------------------------------------------------ the pack

export default {
  id: 'ironworks',

  plan(P) {
    planCircuit(P);
    planWorks(P);
    planYard(P);
  },

  scatter,

  warm(B) { mats(B); },

  *build(B, items) {
    const M = mats(B);
    const anims = B.out.anims;
    let n = 0;
    for (const it of items) {
      switch (it.type) {
        case 'r-gravel': buildGravel(B, M, it); break;
        case 'r-tyres': buildTyres(B, M, it); break;
        case 'r-wall': buildWall(B, M, it, ST); break;
        case 'stand': buildStand(B, M, { ...it, kind: 'steel' }, ST); yield; break;
        case 'r-mast': buildMast(B, M, it, ST); break;
        case 'r-gantry': buildGantry(B, M, it, ST); break;
        case 'r-start': buildStartLine(B, M, it); break;
        case 'r-board': buildBoard(B, M, it); break;
        case 'r-marshal': buildMarshal(B, M, it, ST); break;
        case 'pits': buildPits(B, M, it); yield; break;
        case 'r-paddock': buildPaddock(B, M, it); break;
        case 'furnace': buildFurnace(B, M, it); yield; break;
        case 'stove': buildStove(B, M, it); break;
        case 'catcher': buildCatcher(B, M, it); break;
        case 'skip': buildSkip(B, M, it); break;
        case 'pipe': buildPipe(B, M, it); break;
        case 'gasmain': buildGasMain(B, M, it); yield; break;
        case 'conveyor': buildConveyor(B, M, it); yield; break;
        case 'holder': buildHolder(B, M, it); yield; break;
        case 'stack': buildStack(B, M, it, anims); break;
        case 'flare': buildFlare(B, M, it, anims); break;
        case 'shed': buildShed(B, M, it); break;
        case 'engine': buildEngineHouse(B, M, it); break;
        case 'heap': buildHeap(B, M, it); break;
        case 'rails': buildRails(B, M, it); yield; break;
        case 'gantrycrane': buildGantryCrane(B, M, it); break;
        case 'loco': buildLoco(B, M, it); break;
        case 'ladle': {
          const y = B.groundY(it.x, it.z);
          ladle(B.acc(M.paint), it.x, y, it.z, it.ry);
          col(B.acc(M.paint), WHITE);
          if (it.hot) box(B.acc(M.hot), it.x, y + 3.98, it.z, 0.9, 0.04, 0.9, it.ry, { u: 1, faces: '' });
          break;
        }
        case 'tower': buildTower(B, M, it); break;
        case 'stockhouse': buildStockhouse(B, M, it); break;
        case 'coke': buildCoke(B, M, it); yield; break;
        case 'quench': buildQuench(B, M, it); break;
        case 'r-pole': buildPole(B, M, it); break;
        case 'scrap': buildScrap(B, M, it); break;
        case 'sign': buildSign(B, M, it); break;
        case 'birch': {
          const bark = B.acc(M.bark), leaf = B.acc(M.leaf);
          bark.col = lin('#d8d4c8');
          cylinder(bark, it.x, it.y - 0.3, it.z, 0.16 * it.s + 0.08, 7 * it.s, 5, { r2: 0.06 });
          leaf.col = lin(it.t < 0.5 ? '#6a7a3a' : '#7a8a42');
          sphere(leaf, it.x, it.y + 6 * it.s, it.z, 2.0 * it.s, 6, { sy: 1.3 });
          bark.col = WHITE; leaf.col = WHITE;
          break;
        }
        case 'bush': bush(B.near(M.leaf), it.x, it.y, it.z, it.s, it.t, '#5a6a32'); break;
        case 'rubble': rock(B.near(M.conc), it.x, it.y, it.z, it.s, it.t, '#8a8478'); break;
        case 'drums': { const p = B.near(M.paint); drum(p, it.x, it.y - 0.1, it.z, it.t < 0.5 ? '#7a3a24' : '#3a5a7a'); drum(p, it.x + 0.7, it.y - 0.1, it.z + 0.2, '#5a4a3a'); break; }
        default: break;
      }
      if (++n % 16 === 0) yield;
    }
  },
};

void cone; void crate; void pickup; void oak; void text; void windowPane; void lapAt; void planWall; void hash2;
