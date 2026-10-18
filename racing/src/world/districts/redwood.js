// PORT HALCYON — REDWOOD FOREST: the coast redwoods west of the lake. Giant
// trunks in deep red bark under crowns sixty to ninety metres up, younger
// trees and ferns below, fallen logs, mist lying in the hollows. Redwood
// Highway climbs through it past the ranger station at the forest's edge,
// under the fire lookout on its ridge, past the timber Redwood Lodge and its
// cabins to Redwood Raceway, cut into a clearing: a log-built pit building,
// timber grandstands, floodlights on wooden poles. Off the highway where it
// turns for the raceway, Grandfather Lane runs out to the Grandfather — a
// redwood so big the road goes through it.
import * as THREE from 'three';
import { litMat, glowColorMat, box, cylinder, cone, gable, hip } from './builder.js';
import { concreteTexture, toTex } from '../../track/textures.js';
import { makeRng } from '../../core/util.js';
import { owns, toWorld, lin, mixc, hash2 } from './westkit/util.js';
import { Fr, tube, lathe, beam, drapeUV, col, limb } from './westkit/geo.js';
import { bandAtlas, windowPane, roofTex, signAtlas, text, speckle, streaks, cvs, once, puffTex } from './westkit/tex.js';
import { redwood, fir, fern, log as fallenLog, rock, bicone } from './westkit/veg.js';
import { pickup, sedan, picnicTable, camper } from './westkit/props.js';
import {
  raceMats, lapSamples, planRunoffs, placeFoot, planPitStraight, planStand, planMasts, planBoards, planMarshals,
  buildGravel, buildTyres, buildWall, buildStand, buildMast, buildGantry, buildStartLine, buildBoard, buildMarshal, buildPaddock, buildPole,
} from './westkit/race.js';

const LOOP = ['rw_l1', 'rw_l2', 'rw_l3', 'rw_l4'];
const mine = (x, z) => owns('redwood', x, z);
const WHITE = [1, 1, 1];
const STOREY = 3.2, BANDS = 6;   // atlas: 0 logs + windows, 1 logs, 2 boards + windows, 3 boards + door, 4 fieldstone, 5 pit garages
const ST = { lamp: '#ffe0b0', gravel: '#b8a88a', wall: '#d6cebe', post: '#4a3a2c', seats: ['#2e5a34', '#8a3a24', '#c8b890'], roof: '#3e5236', steel: '#5a4030', stand: 'timber', mast: '#5a4030', mastKind: 'wood', gantry: '#6a5038', marshal: '#e8dcc0' };

// ------------------------------------------------------------------ textures

/** Redwood bark: deep red-brown, fibrous, furrowed (u round 2.4 m, v up 4 m). */
function barkTex() {
  return once('rw:bark', () => {
    const [c, x] = cvs(256, 512);
    const rng = makeRng('rwbark');
    x.fillStyle = '#7a3622'; x.fillRect(0, 0, 256, 512);
    // ridges: long vertical strips of varying red, wandering a little
    for (let i = 0; i < 70; i++) {
      const w = 3 + rng() * 12, px = rng() * 256;
      const t = rng();
      x.fillStyle = t < 0.3 ? '#8e4229' : t < 0.6 ? '#6a2c1a' : t < 0.85 ? '#a0503a' : '#9a6a58';
      x.globalAlpha = 0.5 + rng() * 0.4;
      let cx = px;
      for (let y = 0; y < 512; y += 16) { cx += (rng() - 0.5) * 3; x.fillRect(cx, y, w, 17); x.fillRect(cx - 256, y, w, 17); x.fillRect(cx + 256, y, w, 17); }
    }
    x.globalAlpha = 1;
    // deep furrows
    for (let i = 0; i < 26; i++) {
      let cx = rng() * 256;
      x.strokeStyle = 'rgba(30,10,4,0.75)'; x.lineWidth = 1.5 + rng() * 2.5;
      x.beginPath(); x.moveTo(cx, 0);
      for (let y = 0; y <= 512; y += 24) { cx += (rng() - 0.5) * 6; x.lineTo(cx, y); }
      x.stroke();
    }
    // stringy fibres
    for (let i = 0; i < 900; i++) {
      x.fillStyle = rng() < 0.5 ? 'rgba(170,90,60,0.35)' : 'rgba(40,14,6,0.3)';
      x.fillRect(rng() * 256, rng() * 512, 1, 6 + rng() * 22);
    }
    // grey lichen patches
    for (let i = 0; i < 10; i++) {
      const px = rng() * 256, py = rng() * 512, r = 6 + rng() * 18;
      const g = x.createRadialGradient(px, py, 0, px, py, r);
      g.addColorStop(0, 'rgba(150,150,130,0.35)'); g.addColorStop(1, 'rgba(150,150,130,0)');
      x.fillStyle = g; x.fillRect(px - r, py - r, r * 2, r * 2);
    }
    return toTex(c);
  });
}

function walls() {
  return bandAtlas('rw-walls', 512, 164, [
    // 0: redwood-stained logs, two windows
    (x, e, W, H, rng) => { logs(x, W, H, rng); for (const wx of [96, 352]) windowPane(x, e, wx, 50, 70, 70, rng() < 0.6, rng, { frame: '#e8dcc0', panes: 2 }); },
    // 1: logs
    (x, e, W, H, rng) => logs(x, W, H, rng),
    // 2: dark board and batten, windows
    (x, e, W, H, rng) => { boards(x, W, H, rng); for (const wx of [80, 336]) windowPane(x, e, wx, 48, 80, 70, rng() < 0.55, rng, { frame: '#e8e0c8', panes: 3 }); },
    // 3: board and batten, a door
    (x, e, W, H, rng) => {
      boards(x, W, H, rng);
      x.fillStyle = '#e8e0c8'; x.fillRect(206, 30, 100, H - 30);
      x.fillStyle = '#3a2416'; x.fillRect(214, 38, 84, H - 38);
      windowPane(x, e, 226, 50, 60, 40, rng() < 0.7, rng, { frame: '#3a2416' });
      windowPane(x, e, 60, 50, 70, 64, rng() < 0.4, rng, { frame: '#e8e0c8' });
      windowPane(x, e, 382, 50, 70, 64, rng() < 0.4, rng, { frame: '#e8e0c8' });
    },
    // 4: fieldstone
    (x, e, W, H, rng) => {
      x.fillStyle = '#5e5a52'; x.fillRect(0, 0, W, H);
      for (let y = 4; y < H; y += 26 + rng() * 8) {
        for (let px = -10; px < W; px += 30 + rng() * 26) {
          const w = 26 + rng() * 22, h = 18 + rng() * 8, t = 0.75 + rng() * 0.45;
          x.fillStyle = `rgb(${132 * t},${124 * t},${110 * t})`;
          x.beginPath(); x.ellipse(px + w / 2, y + h / 2, w / 2, h / 2, (rng() - 0.5) * 0.3, 0, 6.283); x.fill();
          x.fillStyle = 'rgba(255,255,255,0.08)'; x.beginPath(); x.ellipse(px + w / 2 - 3, y + h / 2 - 3, w / 3, h / 3, 0, 0, 6.283); x.fill();
        }
      }
      speckle(x, W, H, rng, 1200, ['#000', '#fff'], 0.04, 0.12);
    },
    // 5: pit garages: timber doors, most rolled up and lit, team colours over them
    (x, e, W, H, rng) => {
      boards(x, W, H, rng);
      const teams = ['#c8161e', '#1d4fa8', '#f0a818', '#1b1b1d', '#2f9a4a', '#e6e6e6', '#ff6a00', '#5a2a8a'];
      for (const gx of [16, 272]) {
        const team = teams[Math.floor(rng() * teams.length)];
        x.fillStyle = team; x.fillRect(gx, 10, 224, 16);
        if (rng() < 0.75) {
          const g = x.createLinearGradient(0, 32, 0, H);
          g.addColorStop(0, '#fff2d8'); g.addColorStop(1, '#b0a088');
          x.fillStyle = g; x.fillRect(gx + 6, 32, 212, H - 32);
          x.fillStyle = team; x.beginPath(); x.moveTo(gx + 40, H - 6); x.lineTo(gx + 62, H - 40); x.lineTo(gx + 160, H - 44); x.lineTo(gx + 190, H - 6); x.fill();
          x.fillStyle = '#111'; x.fillRect(gx + 50, H - 14, 26, 14); x.fillRect(gx + 150, H - 14, 26, 14);
          e.fillStyle = '#ffe8c0'; e.globalAlpha = 0.85; e.fillRect(gx + 6, 32, 212, H - 32); e.globalAlpha = 1;
        } else {
          for (let y = 32; y < H; y += 10) { x.fillStyle = (y / 10) % 2 ? '#6a4a30' : '#7a5838'; x.fillRect(gx + 6, y, 212, 10); }
        }
        x.fillStyle = '#2a1a10'; x.fillRect(gx, 28, 6, H - 28); x.fillRect(gx + 218, 28, 6, H - 28);
      }
    },
  ]);
}

function logs(x, W, H, rng) {
  const lh = 18;
  for (let y = 0; y < H; y += lh) {
    const t = 0.82 + rng() * 0.25;
    const g = x.createLinearGradient(0, y, 0, y + lh);
    g.addColorStop(0, `rgb(${110 * t},${58 * t},${36 * t})`);
    g.addColorStop(0.45, `rgb(${146 * t},${80 * t},${50 * t})`);
    g.addColorStop(1, `rgb(${62 * t},${32 * t},${20 * t})`);
    x.fillStyle = g; x.fillRect(0, y, W, lh);
    x.fillStyle = 'rgba(220,206,180,0.3)'; x.fillRect(0, y + lh - 2, W, 2);
    for (let k = 0; k < 6; k++) { x.fillStyle = 'rgba(30,14,6,0.25)'; x.fillRect(rng() * W, y + 3 + rng() * 9, 20 + rng() * 60, 1); }
  }
  for (const cx of [0, W - 12]) for (let y = 0; y < H; y += lh) { x.fillStyle = '#b8805a'; x.beginPath(); x.arc(cx + 6, y + lh / 2, 7, 0, 6.283); x.fill(); x.strokeStyle = 'rgba(80,40,20,0.6)'; x.lineWidth = 1; x.stroke(); }
}

function boards(x, W, H, rng) {
  x.fillStyle = '#5a3a26'; x.fillRect(0, 0, W, H);
  for (let px = 0; px < W; px += 32) {
    x.fillStyle = `rgba(0,0,0,${0.05 + rng() * 0.1})`; x.fillRect(px, 0, 32, H);
    x.fillStyle = '#6e4a32'; x.fillRect(px, 0, 6, H);
    x.fillStyle = 'rgba(0,0,0,0.35)'; x.fillRect(px + 6, 0, 2, H);
  }
  speckle(x, W, H, rng, 1500, ['#000', '#c89a70'], 0.03, 0.12);
  streaks(x, W, H, rng, 8, '20,10,4', 0.15);
}

function signs() {
  const carved = (x, w, h) => {
    const g = x.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#6a4428'); g.addColorStop(1, '#4a2e1a');
    x.fillStyle = g; x.fillRect(0, 0, w, h);
    for (let k = 0; k < 14; k++) { x.fillStyle = 'rgba(30,16,8,0.25)'; x.fillRect(0, k * 9 + 2, w, 1); }
    x.strokeStyle = '#2a180c'; x.lineWidth = 8; x.strokeRect(4, 4, w - 8, h - 8);
  };
  return signAtlas('redwood', [
    // 0 REDWOOD FOREST — STATE PARK
    (x, e, w, h) => { carved(x, w, h); text(x, 'REDWOOD FOREST', w / 2, 52, 50, '#e8d29a', { max: w - 50 }); text(x, 'STATE PARK', w / 2, 98, 26, '#d8c08a', { w: 700 }); text(e, 'REDWOOD FOREST', w / 2, 52, 50, '#6a5a3a', { max: w - 50 }); },
    // 1 REDWOOD LODGE
    (x, e, w, h) => { carved(x, w, h); text(x, 'REDWOOD LODGE', w / 2, 56, 52, '#f0d8a0', { max: w - 50 }); text(x, 'DINING · ROOMS · BAR', w / 2, 100, 20, '#d8c08a', { w: 700 }); text(e, 'REDWOOD LODGE', w / 2, 56, 52, '#ffb860', { max: w - 50, glow: '#ff9a30', blur: 18 }); },
    // 2 RANGER STATION
    (x, e, w, h) => { carved(x, w, h); text(x, 'RANGER STATION', w / 2, 52, 46, '#f0c860', { max: w - 50 }); text(x, 'INFORMATION · PERMITS', w / 2, 98, 20, '#d8c08a', { w: 700 }); text(e, 'RANGER STATION', w / 2, 52, 46, '#5a4a2a', { max: w - 50 }); },
    // 3 THE GRANDFATHER — DRIVE-THRU TREE
    (x, e, w, h) => { carved(x, w, h); text(x, 'THE GRANDFATHER', w / 2, 50, 46, '#f0dca8', { max: w - 50 }); text(x, 'DRIVE-THRU TREE · 2,400 YEARS', w / 2, 96, 20, '#e0c890', { w: 700 }); text(e, 'THE GRANDFATHER', w / 2, 50, 46, '#8a6a3a', { max: w - 50 }); },
    // 4 REDWOOD RACEWAY
    (x, e, w, h) => {
      x.fillStyle = '#1e3a24'; x.fillRect(0, 0, w, h);
      x.fillStyle = '#e8dcc0'; x.fillRect(10, 10, w - 20, 4); x.fillRect(10, h - 14, w - 20, 4);
      text(x, 'REDWOOD RACEWAY', w / 2, h / 2, 54, '#f2ead8', { max: w - 40 });
      text(e, 'REDWOOD RACEWAY', w / 2, h / 2, 54, '#fff0d0', { max: w - 40, glow: '#ffd890', blur: 12 });
    },
    // 5 CURIO SHOP · OPEN
    (x, e, w, h) => { carved(x, w, h); text(x, 'CURIO SHOP', w / 2 - 50, h / 2, 48, '#f0dca8', { max: 300 }); text(x, 'OPEN', w - 90, h / 2, 34, '#ff4a3a'); text(e, 'OPEN', w - 90, h / 2, 34, '#ff5a40', { glow: '#ff2a1a', blur: 16 }); },
    // 6 GRANDFATHER LN (a road sign)
    (x, e, w, h) => {
      x.fillStyle = '#1f6a3a'; x.fillRect(0, 0, w, h);
      x.strokeStyle = '#f2f2ee'; x.lineWidth = 6; x.strokeRect(8, 8, w - 16, h - 16);
      text(x, 'GRANDFATHER LN', w / 2, h / 2, 52, '#f2f2ee', { max: w - 50 });
      e.globalAlpha = 0.25; e.fillStyle = '#f2f2ee'; text(e, 'GRANDFATHER LN', w / 2, h / 2, 52, '#ffffff', { max: w - 50 }); e.globalAlpha = 1;
    },
    // 7 FIRE DANGER TODAY: a half dial
    (x, e, w, h) => {
      carved(x, w, h);
      text(x, 'FIRE DANGER', 140, 44, 34, '#f0dca8', { max: 230 });
      text(x, 'TODAY IS', 140, 90, 24, '#e0c890', { w: 700 });
      const cx = 380, cy = 112, r = 92;
      const cols = ['#2f8a3a', '#2a5fa8', '#e8c21a', '#e87a1a', '#c8261e'];
      for (let k = 0; k < 5; k++) { x.fillStyle = cols[k]; x.beginPath(); x.moveTo(cx, cy); x.arc(cx, cy, r, Math.PI + (k * Math.PI) / 5, Math.PI + ((k + 1) * Math.PI) / 5); x.fill(); }
      x.strokeStyle = '#1a1a1a'; x.lineWidth = 6; x.beginPath(); x.moveTo(cx, cy); x.lineTo(cx - r * 0.8 * Math.cos(0.3), cy - r * 0.8 * Math.sin(0.3)); x.stroke();
    },
  ]);
}
const signUV = (k) => signs().uv(k);

function mats(B) {
  const R = raceMats(B, ST);
  return {
    ...R,
    bark: B.mat('bark', () => litMat({ map: barkTex(), vertexColors: true, roughness: 0.95 })),
    leaf: B.mat('leaf', () => litMat({ vertexColors: true, flatShading: true, roughness: 0.9 })),
    fern: B.mat('fern', () => litMat({ vertexColors: true, side: THREE.DoubleSide, roughness: 0.9 }, { shadow: false })),
    wall: B.mat('wall', () => { const t = walls(); return litMat({ map: t.map, emissive: 0xffffff, emissiveMap: t.emi, vertexColors: true, roughness: 0.85 }, { night: 1.0 }); }),
    roof: B.mat('roof', () => litMat({ map: roofTex('shingle'), vertexColors: true, roughness: 0.9 })),
    stone: B.mat('stone', () => litMat({ map: concreteTexture('#8a8478', 'rwstone'), vertexColors: true, roughness: 0.95 })),
    sign: B.mat('sign', () => { const t = signs(); return litMat({ map: t.map, emissive: 0xffffff, emissiveMap: t.emi, roughness: 0.7 }, { night: 1.4 }); }),
    lamp: B.mat('lamp', () => glowColorMat('#ffc070', 3)),
    win: B.mat('win', () => glowColorMat('#ffb860', 1.6)),
    mist: B.mat('mist', () => {
      const m = litMat({ map: puffTex(), color: 0xc8d2d6, emissive: 0x8a98a4, transparent: true, opacity: 0.55, depthWrite: false, side: THREE.DoubleSide, roughness: 1 }, { night: 0.18, shadow: false });
      m.userData.castShadow = false;
      return m;
    }),
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

/**
 * A lot beside a road: at s (searching s0..s1 in steps) on side sd, set back
 * `back` m from its reach, w × d facing the road. → { x, z, ry, s } or null.
 */
function roadside(P, r, s0, s1, sd, back, w, d, o = {}) {
  const reach = r.rt.hw + r.rt.shoulder + r.rt.walk;
  for (let s = s0; s <= s1; s += o.step || 8) {
    const p = r.posAt(s);
    const lx = r.LX[p.i], lz = r.LZ[p.i];
    const off = reach + back + d / 2;
    const x = p.x + lx * sd * off, z = p.z + lz * sd * off;
    const ry = Math.atan2(-lx * sd, -lz * sd);          // its front (+z) toward the road
    if (!mine(x, z) || !P.isFree(x, z, w, d, ry, { pad: o.pad ?? 1, roadPad: true })) continue;
    const g = P.groundRange(x, z, w, d, ry);
    if (g.hi - g.lo > (o.slope ?? 5)) continue;
    return { x, z, ry, s, g };
  }
  return null;
}

// ------------------------------------------------------------------ plan

function planCircuit(P) {
  const lap = lapSamples(P.net, LOOP, 4);
  if (!lap.samples.length) return;
  // the main straight runs west along z −3080 from rw_a; the pits on its
  // right (north: the infield), the big stand across from them
  const { mid } = planPitStraight(P, lap, { S0: 14, S1: 350, side: -1, type: 'pits', w: 150, d: 16, h: 13, mid: 180, color: '#5a3a28', lamp: ST.lamp, poleKind: 'wood', start: 150 });
  planStand(P, lap, 190, 1, { w: 170, d: 24, h: 14, tiers: 12, gap: 3.4, wall: 11.2, kind: 'timber', color: '#5a4030' });
  const hp = lap.samples.reduce((b, p) => (p.x < b.x ? p : b), lap.samples[0]);
  planStand(P, lap, hp.s, hp.k > 0 ? -1 : 1, { w: 64, d: 18, h: 10, tiers: 9, gap: 24, wall: false, roadPad: true, kind: 'timber', color: '#5a4030' });
  // and a small one on the back straight's outside
  planStand(P, lap, 616 + 760, 1, { w: 60, d: 14, h: 8, tiers: 7, gap: 20, wall: false, roadPad: true, kind: 'timber', color: '#5a4030' });
  planRunoffs(P, lap, { w: [10, 22], kmin: 1 / 200, fence: 2.4 });
  planMasts(P, lap, 95, 24, ST.lamp, { kind: 'wood', radius: 40, intensity: 1.05 });
  planBoards(P, lap);
  planMarshals(P, lap, 230);
  // the raceway's sign at the gate
  const gate = P.net.byId.get('rw_gate');
  if (gate) {
    const p = gate.posAt(gate.length * 0.35);
    const sd = 1, off = gate.rt.hw + gate.rt.shoulder + gate.rt.walk + 3;
    const x = p.x + gate.LX[p.i] * sd * off, z = p.z + gate.LZ[p.i] * sd * off;
    P.add({ type: 'sign', x, z, ry: Math.atan2(-gate.TX[p.i], -gate.TZ[p.i]) + 0.5, slot: 4, w: 7, h: 1.75, post: 3.2, kind: 'logs' });
    P.lamp({ x, z, hx: x, hz: z, hy: P.groundY(x, z) + 6, color: '#ffe0b0', radius: 10, intensity: 0.8, halo: 1.2 });
  }
  void mid;
}

function planHighway(P) {
  const rh1 = P.net.byId.get('rh_1'), rh2 = P.net.byId.get('rh_2'), rh3 = P.net.byId.get('rh_3');
  if (!rh1 || !rh2 || !rh3) return;
  // the forest's gate: a carved sign on log posts where the highway enters it
  {
    let s = 0;
    for (; s < rh1.length; s += 6) { const p = rh1.posAt(s); if (mine(p.x, p.z) && P.inside(p.x, p.z, 30)) break; }
    s += 30;
    const p = rh1.posAt(s);
    for (const sd of [1, -1]) {
      const off = rh1.rt.hw + rh1.rt.shoulder + rh1.rt.walk + 7;
      const x = p.x + rh1.LX[p.i] * sd * off, z = p.z + rh1.LZ[p.i] * sd * off;
      const ry = Math.atan2(-rh1.TX[p.i], -rh1.TZ[p.i]) + sd * 0.35;
      if (!P.isFree(x, z, 8, 2, ry, { pad: 0.5, roadPad: false })) continue;
      P.claim(x, z, 8, 2, ry);
      P.add({ type: 'sign', x, z, ry, slot: 0, w: 7.2, h: 1.8, post: 1.6, kind: 'gate' });
      P.collider({ kind: 'box', x, z, hx: 4.4, hz: 0.6, ry, y0: P.groundY(x, z) - 1, y1: P.groundY(x, z) + 4 });
      for (const k of [-1, 1]) {
        const [lx, lz] = toWorld(x, z, ry, k * 2.5, 2.5);
        P.lamp({ x: lx, z: lz, hx: x, hz: z, hy: P.groundY(x, z) + 2.4, color: '#ffd8a0', radius: 8, intensity: 0.8, halo: 0.6 });
      }
      break;
    }
    // the ranger station just past it
    const lot = roadside(P, rh1, s + 40, s + 260, -1, 8, 15, 10) || roadside(P, rh1, s + 40, s + 260, 1, 8, 15, 10);
    if (lot) {
      const it = placeFoot(P, { type: 'ranger', x: lot.x, z: lot.z, ry: lot.ry, w: 15, d: 10, seed: P.rng(), map: 'building' }, 8, { pad: 0.5, color: '#5a4030', lit: 0.4 });
      if (it) {
        const [lx, lz] = toWorld(lot.x, lot.z, lot.ry, -3, 10 / 2 + 2);
        P.lamp({ x: lx, z: lz, hx: lx, hz: lz, hy: lot.g.hi + 3, color: '#ffc070', radius: 12, intensity: 0.85, halo: 1.2 });
        const [fx, fz] = toWorld(lot.x, lot.z, lot.ry, 8, 10 / 2 + 6);
        P.collider({ kind: 'circle', x: fx, z: fz, r: 0.3, y0: P.groundY(fx, fz) - 1, y1: P.groundY(fx, fz) + 10 });
        const [sx, sz] = toWorld(lot.x, lot.z, lot.ry, -6, 10 / 2 + 7.5);
        P.add({ type: 'sign', x: sx, z: sz, ry: lot.ry, slot: 2, w: 4.4, h: 1.1, post: 1.0, kind: 'posts' });
        const [dx, dz] = toWorld(lot.x, lot.z, lot.ry, 3, 10 / 2 + 7.5);
        P.add({ type: 'sign', x: dx, z: dz, ry: lot.ry, slot: 7, w: 3.2, h: 0.8, post: 0.9, kind: 'posts' });
      }
    }
  }
  // the fire lookout on the ridge above the highway (the highest ground near it)
  {
    let best = null;
    for (let s = 60; s < rh2.length - 60; s += 30) {
      const p = rh2.posAt(s);
      for (const sd of [1, -1]) {
        for (const off of [50, 80, 110, 140]) {
          const x = p.x + rh2.LX[p.i] * sd * off, z = p.z + rh2.LZ[p.i] * sd * off;
          if (!P.inside(x, z, 20) || !mine(x, z) || !P.isFree(x, z, 12, 12, 0, { pad: 1, roadPad: true })) continue;
          const y = P.groundY(x, z);
          const g = P.groundRange(x, z, 12, 12, 0);
          if (g.hi - g.lo > 6) continue;
          if (!best || y > best.y) best = { x, z, y };
        }
      }
    }
    if (best) {
      const it = placeFoot(P, { type: 'lookout', x: best.x, z: best.z, ry: 0.3, w: 12, d: 12, h: 22, map: 'building' }, 28, { pad: 0.5, far: false });
      if (it) {
        P.far({ x: best.x, z: best.z, y: best.y - 1, w: 5, d: 5, h: 22, ry: 0.3, color: '#4a3a2a', lit: 0 });
        P.far({ x: best.x, z: best.z, y: best.y + 21.5, w: 7.5, d: 7.5, h: 4, ry: 0.3, color: '#6a5038', lit: 0.9 });
        P.lamp({ x: best.x, z: best.z, hx: best.x, hz: best.z, hy: best.y + 23.5, color: '#ffc070', radius: 18, intensity: 1.0, halo: 3.0 });
        P.lamp({ x: best.x, z: best.z, hx: best.x, hz: best.z, hy: best.y + 31, color: '#ff3020', radius: 3, intensity: 0.6, halo: 2.2 });
      }
    }
  }
  // Redwood Lodge: on the highway's last stretch before the raceway, with its cabins
  {
    let lodge = null;
    for (const [r, sd] of [[rh3, -1], [rh3, 1], [rh2, 1], [rh2, -1]]) {
      const lot = roadside(P, r, 60, r.length - 60, sd, 22, 36, 18, { slope: 7 });
      if (!lot) continue;
      lodge = placeFoot(P, { type: 'lodge', x: lot.x, z: lot.z, ry: lot.ry, w: 36, d: 18, seed: P.rng(), map: 'building' }, 14, { pad: 1, color: '#5a3a26', lit: 0.5 });
      if (!lodge) continue;
      // its car park in front, toward the road
      const [cx, cz] = toWorld(lot.x, lot.z, lot.ry, 0, 18 / 2 + 11);
      if (P.isFree(cx, cz, 34, 16, lot.ry, { pad: 0.2, roadPad: false })) {
        P.claim(cx, cz, 34, 16, lot.ry);
        P.add({ type: 'carpark', x: cx, z: cz, ry: lot.ry, w: 34, d: 16, cars: 5, seed: P.rng(), map: 'plaza' });
        for (let k = 0; k < 5; k++) {
          const [px, pz] = toWorld(cx, cz, lot.ry, -14 + k * 7, -3);
          const gy = P.groundY(px, pz);
          if (hash2(px, pz) < 0.75) P.collider({ kind: 'box', x: px, z: pz, hx: 1.0, hz: 2.3, ry: lot.ry, y0: gy - 1, y1: gy + 1.8 });
        }
        for (const k of [-1, 1]) { const [lx, lz] = toWorld(cx, cz, lot.ry, k * 15, 6); poleLampWood(P, lx, lz); }
      }
      for (const k of [-1, 0, 1]) {
        const [lx, lz] = toWorld(lot.x, lot.z, lot.ry, k * 11, 18 / 2 + 2.2);
        P.lamp({ x: lx, z: lz, hx: lx, hz: lz, hy: lot.g.hi + 3.2, color: '#ffc070', radius: 12, intensity: 0.9, halo: 1.0 });
      }
      const [sx, sz] = toWorld(lot.x, lot.z, lot.ry, 20, 18 / 2 + 21);
      P.add({ type: 'sign', x: sx, z: sz, ry: lot.ry + 0.4, slot: 1, w: 5.6, h: 1.4, post: 1.6, kind: 'logs' });
      P.lamp({ x: sx, z: sz, hx: sx, hz: sz, hy: P.groundY(sx, sz) + 4, color: '#ffc070', radius: 8, intensity: 0.8, halo: 1.4 });
      // cabins in the trees round it
      for (let k = 0; k < 7; k++) {
        const a = P.range(0, Math.PI * 2), dist = P.range(40, 90);
        const x = lot.x + Math.cos(a) * dist, z = lot.z + Math.sin(a) * dist;
        const ry = Math.atan2(lot.x - x, lot.z - z) + P.range(-0.4, 0.4);
        if (!mine(x, z)) continue;
        const it = placeFoot(P, { type: 'cabin', x, z, ry, w: 8, d: 7, seed: P.rng(), lit: P.rng(), map: 'building' }, 6, { pad: 3, color: '#5a3a26', lit: 0.4 });
        if (!it) continue;
        const [lx, lz] = toWorld(x, z, ry, 2, 7 / 2 + 1.5);
        P.lamp({ x: lx, z: lz, hx: lx, hz: lz, hy: P.groundY(x, z) + 2.8, color: '#ffc070', radius: 8, intensity: 0.8, halo: 1.0 });
      }
      P.landmark({ id: 'redwoodlodge', name: 'REDWOOD LODGE', x: lot.x, z: lot.z, kind: 'lodge' });
      break;
    }
  }
  // a few giants planned along the highway (seen from far, solid)
  for (const r of [rh1, rh2, rh3]) {
    for (let s = 20; s < r.length - 20; s += 34) {
      const p = r.posAt(s);
      for (const sd of [1, -1]) {
        if (P.rng() < 0.35) continue;
        const off = r.rt.hw + r.rt.shoulder + r.rt.walk + P.range(7, 16);
        const x = p.x + r.LX[p.i] * sd * off, z = p.z + r.LZ[p.i] * sd * off;
        if (!mine(x, z) || !P.isFree(x, z, 6, 6, 0, { pad: 0.5, roadPad: true })) continue;
        P.claim(x, z, 6, 6, 0);
        const h = P.range(62, 92), rr = P.range(2.0, 3.2), y = P.groundY(x, z);
        P.add({ type: 'giant', x, z, y, h, r: rr, t: P.rng() });
        P.collider({ kind: 'circle', x, z, r: rr * 1.35, y0: y - 1, y1: y + 40 });
        P.far({ shape: 'cone', x, z, y: y + h * 0.4, r: h * 0.1 + 3, h: h * 0.62, color: '#1e3424' });
      }
    }
  }
}

function poleLampWood(P, x, z) {
  if (!P.isFree(x, z, 1.2, 1.2, 0, { pad: 0.2 })) return;
  P.claim(x, z, 1.2, 1.2, 0);
  const gy = P.groundY(x, z);
  P.add({ type: 'r-pole', x, z, h: 6.5, kind: 'wood' });
  P.collider({ kind: 'circle', x, z, r: 0.3, y0: gy - 1, y1: gy + 6.5 });
  P.lamp({ x, z, hx: x, hz: z, hy: gy + 6.8, color: '#ffd8a0', radius: 16, intensity: 0.85, halo: 1.4 });
}

/** The Grandfather: a giant on Grandfather Lane with the lane through its trunk; the clearing at the lane's end. */
function planGrandfather(P) {
  const r = P.net.byId.get('rw_tree');
  if (!r) return;
  const s = 205;
  const p = r.posAt(s);
  const ry = Math.atan2(r.TX[p.i], r.TZ[p.i]);       // local +z along the lane
  const R0 = 7.6, TW = 3.5;
  const y = p.y;
  P.add({ type: 'grandfather', x: p.x, z: p.z, y, ry, R0, tw: TW, th: 5.4, h: 96 });
  P.claim(p.x, p.z, R0 * 2 + 6, R0 * 2 + 6, ry);
  const Lz = Math.sqrt(R0 * R0 - TW * TW);
  for (const sx of [-1, 1]) {
    const [cx, cz] = toWorld(p.x, p.z, ry, sx * (TW + R0) / 2, 0);
    P.collider({ kind: 'box', x: cx, z: cz, hx: (R0 - TW) / 2, hz: Lz, ry, y0: y - 2, y1: y + 96 });
  }
  P.far({ shape: 'cyl', x: p.x, z: p.z, y: y - 1, r: R0 * 0.8, r2: 2, h: 60, color: '#5a2a1a' });
  P.far({ shape: 'cone', x: p.x, z: p.z, y: y + 44, r: 14, h: 52, color: '#1e3424' });
  // the lane's sign at the highway, the tree's own sign before it
  const r0 = r.posAt(18);
  {
    const off = r.rt.hw + r.rt.shoulder + 2.5;
    const x = r0.x + r.LX[r0.i] * off, z = r0.z + r.LZ[r0.i] * off;
    P.add({ type: 'sign', x, z, ry: Math.atan2(-r.TX[r0.i], -r.TZ[r0.i]) + Math.PI / 2, slot: 6, w: 2.6, h: 0.65, post: 2.4, kind: 'pole' });
  }
  {
    const q = r.posAt(s - 34);
    const off = r.rt.hw + r.rt.shoulder + 3.5;
    const x = q.x + r.LX[q.i] * off, z = q.z + r.LZ[q.i] * off;
    P.add({ type: 'sign', x, z, ry: Math.atan2(-r.TX[q.i], -r.TZ[q.i]) + 0.45, slot: 3, w: 4.8, h: 1.2, post: 1.2, kind: 'posts' });
    P.lamp({ x, z, hx: x, hz: z, hy: P.groundY(x, z) + 3, color: '#ffc880', radius: 8, intensity: 0.7, halo: 0.8 });
  }
  // lanterns either side of the tunnel
  for (const sz of [-1, 1]) {
    const [lx, lz] = toWorld(p.x, p.z, ry, 0, sz * (Lz + 1));
    P.lamp({ x: lx, z: lz, hx: lx, hz: lz, hy: y + 5.8, color: '#ffc070', radius: 10, intensity: 0.8, halo: 0.8 });
  }
  // the clearing at the lane's end: the curio shop, picnic tables, a camper
  const e = r.posAt(r.length - 12);
  const sd = -1;
  const ery = Math.atan2(r.TX[e.i], r.TZ[e.i]);
  const off = r.rt.hw + r.rt.shoulder + 9;
  const sx = e.x + r.LX[e.i] * sd * off, sz2 = e.z + r.LZ[e.i] * sd * off;
  const shopRy = Math.atan2(-r.LX[e.i] * sd, -r.LZ[e.i] * sd);
  const shop = placeFoot(P, { type: 'curio', x: sx, z: sz2, ry: shopRy, w: 12, d: 9, seed: P.rng(), map: 'building' }, 7, { pad: 0.5, color: '#5a3a26', lit: 0.5 });
  if (shop) {
    const [lx, lz] = toWorld(sx, sz2, shopRy, 0, 9 / 2 + 2);
    P.lamp({ x: lx, z: lz, hx: lx, hz: lz, hy: P.groundY(sx, sz2) + 3, color: '#ffc070', radius: 12, intensity: 0.9, halo: 1.2 });
  }
  for (let k = 0; k < 4; k++) {
    const [tx, tz] = toWorld(e.x, e.z, ery, -sd * (r.rt.hw + 7 + (k % 2) * 6), -10 - Math.floor(k / 2) * 9);
    if (!P.isFree(tx, tz, 3, 3, 0, { pad: 0.5 })) continue;
    P.claim(tx, tz, 3, 3, 0);
    P.add({ type: 'picnic', x: tx, z: tz, ry: ery + k, y: P.groundY(tx, tz) });
  }
  {
    const [cx, cz] = toWorld(e.x, e.z, ery, sd * (r.rt.hw + 3), -22);
    if (P.isFree(cx, cz, 3, 7, ery, { pad: 0.3 })) {
      P.claim(cx, cz, 3, 7, ery);
      P.add({ type: 'camper', x: cx, z: cz, ry: ery + 0.1 });
      P.collider({ kind: 'box', x: cx, z: cz, hx: 1.2, hz: 3.1, ry: ery + 0.1, y0: P.groundY(cx, cz) - 1, y1: P.groundY(cx, cz) + 3 });
    }
  }
  P.landmark({ id: 'grandfather', name: 'THE GRANDFATHER', x: p.x, z: p.z, kind: 'tree', hidden: true });
}

// ------------------------------------------------------------------ build: trees

/** The Grandfather: a trunk 15 m across with a tunnel through it, its crown 90 m up. */
function buildGrandfather(B, M, it) {
  const bark = B.acc(M.bark), leaf = B.acc(M.leaf);
  const { x, z, R0, tw, th, h } = it;
  const y = B.groundY(x, z);
  const F = new Fr(x, y, z, it.ry);
  // world angle p ↔ the lane's frame: lateral = cos(p + ry)
  const al = Math.acos(tw / R0);
  bark.col = lin('#ffffff');
  const low = [[R0 + 1.6, -1.6], [R0 + 0.6, 0.4], [R0, 1.6], [R0, th]];
  lathe(bark, x, y, z, low, 9, { u: 2.4, v: 4, a0: -it.ry - al, a1: -it.ry + al });
  lathe(bark, x, y, z, low, 9, { u: 2.4, v: 4, a0: Math.PI - it.ry - al, a1: Math.PI - it.ry + al });
  // above the tunnel: the whole trunk, a long taper
  lathe(bark, x, y, z, [[R0, th], [R0 * 0.94, 16], [R0 * 0.78, h * 0.3], [R0 * 0.6, h * 0.52], [R0 * 0.4, h * 0.74], [R0 * 0.18, h * 0.93], [0.1, h]], 16, { u: 2.4, v: 4 });
  // the tunnel: cut wood, walls and a low vault
  const Lz = Math.sqrt(R0 * R0 - tw * tw);
  bark.col = lin('#d8a080');
  bark.quadP(F.p(tw, 0, -Lz), F.p(tw, 0, Lz), F.p(tw, th - 1, Lz), F.p(tw, th - 1, -Lz), [0, 0, 2 * Lz / 2.4, (th - 1) / 4]);
  bark.quadP(F.p(-tw, 0, Lz), F.p(-tw, 0, -Lz), F.p(-tw, th - 1, -Lz), F.p(-tw, th - 1, Lz), [0, 0, 2 * Lz / 2.4, (th - 1) / 4]);
  bark.quadP(F.p(tw, th - 1, -Lz), F.p(tw, th - 1, Lz), F.p(tw * 0.5, th, Lz), F.p(tw * 0.5, th, -Lz), [0, 0, 2 * Lz / 2.4, 0.3]);
  bark.quadP(F.p(-tw * 0.5, th, -Lz), F.p(-tw * 0.5, th, Lz), F.p(-tw, th - 1, Lz), F.p(-tw, th - 1, -Lz), [0, 0, 2 * Lz / 2.4, 0.3]);
  bark.quadP(F.p(-tw * 0.5, th, Lz), F.p(-tw * 0.5, th, -Lz), F.p(tw * 0.5, th, -Lz), F.p(tw * 0.5, th, Lz), [0, 0, 2 * Lz / 2.4, 0.4]);
  // the portal's charred rim
  bark.col = lin('#3a2016');
  for (const sz of [-1, 1]) {
    const zz = sz * (Lz + 0.05);
    for (const sx of [-1, 1]) F.box(bark, sx * (tw + 0.15), 0, zz, 0.3, th - 0.9, 0.2, { u: 1 });
    F.box(bark, 0, th - 0.15, zz, tw * 2 + 0.6, 0.3, 0.2, { u: 1 });
  }
  // buttress roots on the diagonals
  bark.col = lin('#c8a090');
  for (const [a, b] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
    const d = Math.SQRT1_2;
    limb(bark, [F.p(a * d * (R0 - 1), 5, b * d * (R0 - 1)), F.p(a * d * (R0 + 1.5), 1.2, b * d * (R0 + 1.5)), F.p(a * d * (R0 + 4.5), -0.6, b * d * (R0 + 4.5))], 1.7, 0.5, 6);
  }
  // burls and a few dead limbs
  bark.col = lin('#b88a78');
  for (let k = 0; k < 6; k++) {
    const a = k * 1.9 + 0.4, yy = 14 + k * 9;
    const rr = R0 * (1 - yy / h * 0.9);
    tube(bark, [x + Math.cos(a) * rr * 0.8, y + yy, z + Math.sin(a) * rr * 0.8], [x + Math.cos(a) * (rr + 5), y + yy + 2, z + Math.sin(a) * (rr + 5)], 0.4, 5, { r2: 0.1 });
  }
  // the crown: big dark clumps from half way up
  const dark = lin('#1c3622'), lite = lin('#2e5230');
  const c0 = h * 0.5;
  for (let k = 0; k < 13; k++) {
    const f = k / 13;
    const yy = y + c0 + (h - c0) * f * 0.92;
    const a = k * 2.39 + 0.7;
    const rr = (1 - f) * 13 + 4;
    const off = R0 * 0.5 * (1 - f) + 3 + (1 - f) * 6;
    leaf.col = mixc(dark, lite, ((k * 0.37) % 1) * 0.8);
    bicone(leaf, x + Math.cos(a) * off, yy - rr * 0.35, z + Math.sin(a) * off, rr, rr * 0.9, rr * 0.35, 8);
  }
  leaf.col = mixc(dark, lite, 0.5);
  cone(leaf, x, y + h * 0.88, z, 6, h * 0.16, 7);
  bark.col = WHITE; leaf.col = WHITE;
  // lanterns on posts either side
  const lamp = B.acc(M.lamp), paint = B.acc(M.paint);
  for (const sz of [-1, 1]) {
    const px = F.wx(tw + 1.4, sz * (Lz + 1)), pz = F.wz(tw + 1.4, sz * (Lz + 1));
    col(paint, lin('#3a2a1e'));
    box(paint, px, B.groundY(px, pz) - 0.4, pz, 0.22, 3.4, 0.22, it.ry, { u: 1 });
    box(lamp, px, B.groundY(px, pz) + 2.9, pz, 0.35, 0.45, 0.35, it.ry, { u: 1 });
  }
  col(paint, WHITE);
}

// ------------------------------------------------------------------ build: buildings

function buildRanger(B, M, it) {
  const F = new Fr(it.x, 0, it.z, it.ry);
  const g = B.footY(it.x, it.z, it.w, it.d, it.ry);
  const y0 = g.hi + 0.5;
  const wall = B.acc(M.wall), roof = B.acc(M.roof), stone = B.acc(M.stone), paint = B.acc(M.paint);
  col(stone, lin('#8a8478'));
  F.box(stone, 0, g.lo - 1, 0, it.w + 0.4, y0 - g.lo + 1, it.d + 0.4, { u: 2 });
  col(wall, lin('#c8d0b8'));
  storey(wall, it.x, y0, it.z, it.w, it.d, it.ry, 3, 'f');
  storey(wall, it.x, y0, it.z, it.w, it.d, it.ry, 2, 'blr');
  col(roof, lin('#3e5236'));
  col(paint, lin('#4a3a2a'));
  gable(roof, it.x, y0 + STOREY, it.z, it.w, it.d, 2.6, it.ry, { over: 0.8, endAcc: paint });
  // the porch along the front
  col(paint, lin('#7a5a3a'));
  F.box(paint, 0, y0 - 0.3, it.d / 2 + 1.4, it.w - 1, 0.3, 2.8, { u: 2 });
  col(paint, lin('#4a3424'));
  for (const lx of [-it.w / 2 + 1, -2, 2, it.w / 2 - 1]) F.box(paint, lx, y0, it.d / 2 + 2.6, 0.24, 2.6, 0.24, { u: 1 });
  col(roof, lin('#3e5236'));
  roof.quadP(F.p(-it.w / 2 + 0.4, y0 + 2.6, it.d / 2 + 3), F.p(it.w / 2 - 0.4, y0 + 2.6, it.d / 2 + 3), F.p(it.w / 2 - 0.4, y0 + 3.0, it.d / 2), F.p(-it.w / 2 + 0.4, y0 + 3.0, it.d / 2));
  // the chimney, the flagpole, the ranger's pickup
  col(stone, lin('#7a746a'));
  F.box(stone, it.w / 2 - 2, g.lo, -it.d * 0.2, 1.4, y0 - g.lo + STOREY + 4.2, 1.4, { u: 2 });
  const fx = F.wx(8, it.d / 2 + 6), fz = F.wz(8, it.d / 2 + 6), fy = B.groundY(fx, fz);
  col(paint, lin('#d8d8d0'));
  cylinder(paint, fx, fy - 0.3, fz, 0.07, 10.3, 6, { r2: 0.05 });
  col(paint, lin('#c82a22'));
  box(paint, fx + 0.9 * Math.cos(it.ry), fy + 8.6, fz - 0.9 * Math.sin(it.ry), 1.8, 1.1, 0.04, it.ry, { u: 1 });
  const px = F.wx(-it.w / 2 - 4, it.d / 2 + 4), pz = F.wz(-it.w / 2 - 4, it.d / 2 + 4);
  pickup(paint, px, B.groundY(px, pz), pz, it.ry + Math.PI / 2 + 0.1, '#3a5a3a');
  box(B.acc(M.lamp), F.wx(-3, it.d / 2 + 0.2), y0 + 2.3, F.wz(-3, it.d / 2 + 0.2), 0.25, 0.3, 0.25, it.ry, { u: 1 });
  col(wall, WHITE); col(roof, WHITE); col(stone, WHITE); col(paint, WHITE);
}

function buildLodge(B, M, it) {
  const F = new Fr(it.x, 0, it.z, it.ry);
  const g = B.footY(it.x, it.z, it.w, it.d, it.ry);
  const wall = B.acc(M.wall), roof = B.acc(M.roof), stone = B.acc(M.stone), paint = B.acc(M.paint), win = B.acc(M.win);
  // a fieldstone base storey, two of logs above
  const y0 = g.hi + 0.3;
  col(stone, lin('#8a8478'));
  F.box(stone, 0, g.lo - 1, 0, it.w + 0.6, y0 - g.lo + 1, it.d + 0.6, { u: 2 });
  col(wall, WHITE);
  storey(wall, it.x, y0, it.z, it.w, it.d, it.ry, 4);
  storey(wall, it.x, y0 + STOREY, it.z, it.w, it.d, it.ry, 0);
  storey(wall, it.x, y0 + 2 * STOREY, it.z, it.w, it.d, it.ry, 0, 'fb');
  storey(wall, it.x, y0 + 2 * STOREY, it.z, it.w, it.d, it.ry, 1, 'lr');
  const top = y0 + 3 * STOREY;
  col(roof, lin('#4a3a2e'));
  col(paint, lin('#5a3a26'));
  gable(roof, it.x, top, it.z, it.w, it.d, 6.5, it.ry, { over: 1.2, endAcc: paint });
  // dormers on the front slope
  for (const lx of [-11, 11]) {
    col(wall, WHITE);
    storey(wall, F.wx(lx, it.d / 2 - 2.5), top, F.wz(lx, it.d / 2 - 2.5), 4, 3, it.ry, 0, 'f');
    col(roof, lin('#4a3a2e'));
    gable(roof, F.wx(lx, it.d / 2 - 3), top + STOREY, F.wz(lx, it.d / 2 - 3), 4, 4, 1.4, it.ry, { over: 0.3, alongZ: true, endAcc: paint });
  }
  // the entrance pavilion: an A-frame of glass and timber
  const ez = it.d / 2 + 4;
  const ew = 12, eh = 11;
  col(roof, lin('#4a3a2e'));
  const hw = ew / 2 + 0.6;
  roof.quadP(F.p(-hw, y0 + 1.5, ez + 4.4), F.p(-hw, y0 + 1.5, it.d / 2 - 2), F.p(0, y0 + eh, it.d / 2 - 2), F.p(0, y0 + eh, ez + 4.4), [0, 0, 6, 4]);
  roof.quadP(F.p(hw, y0 + 1.5, it.d / 2 - 2), F.p(hw, y0 + 1.5, ez + 4.4), F.p(0, y0 + eh, ez + 4.4), F.p(0, y0 + eh, it.d / 2 - 2), [0, 0, 6, 4]);
  const gA = F.p(-ew / 2, y0, ez + 4), gB = F.p(ew / 2, y0, ez + 4), gT = F.p(0, y0 + eh - 1.2, ez + 4);
  const a = win.v(...gA), b = win.v(...gB), c = win.v(...gT);
  win.tri(a, b, c);
  col(paint, lin('#3a2416'));
  for (const lx of [-3, 0, 3]) beam(paint, F.p(lx, y0, ez + 4.08), F.p(lx, y0 + eh - 1.2 - Math.abs(lx) * (eh - 1.2) / (ew / 2), ez + 4.08), 0.2, 0.2);
  beam(paint, F.p(-ew / 2 + 1.5, y0 + 3.2, ez + 4.08), F.p(ew / 2 - 1.5, y0 + 3.2, ez + 4.08), 0.2, 0.2);
  // its sides in logs
  col(wall, WHITE);
  for (const sx of [-1, 1]) {
    const A = F.p(sx * ew / 2, y0, ez + 4), Bp = F.p(sx * ew / 2, y0, it.d / 2);
    const C = F.p(sx * ew / 2, y0 + 1.5, it.d / 2), D = F.p(sx * ew / 2, y0 + 1.5, ez + 4);
    const v1 = 1 / BANDS + 1.5 / (STOREY * BANDS);
    if (sx > 0) wall.quadP(A, Bp, C, D, [0, 1 / BANDS, 0.5, v1]); else wall.quadP(Bp, A, D, C, [0, 1 / BANDS, 0.5, v1]);
  }
  // chimneys at the ends, a porch along the front
  col(stone, lin('#7e786c'));
  for (const sx of [-1, 1]) F.box(stone, sx * (it.w / 2 + 0.9), g.lo - 0.5, 0, 2.2, top - g.lo + 9, 3.0, { u: 2 });
  col(paint, lin('#6a4a30'));
  F.box(paint, 0, y0 - 0.3, it.d / 2 + 1.6, it.w - 2, 0.3, 3.2, { u: 2 });
  col(paint, lin('#4a3020'));
  for (let k = 0; k <= 8; k++) {
    const lx = -it.w / 2 + 1 + k * (it.w - 2) / 8;
    if (Math.abs(lx) < ew / 2 + 0.5) continue;
    F.box(paint, lx, y0, it.d / 2 + 3, 0.3, 3.0, 0.3, { u: 1 });
  }
  col(roof, lin('#4a3a2e'));
  for (const sx of [-1, 1]) {
    const x0 = sx * (ew / 2 + 0.6), x1 = sx * (it.w / 2 - 0.6);
    const pts = sx > 0 ? [x0, x1] : [x1, x0];
    roof.quadP(F.p(pts[0], y0 + 3.0, it.d / 2 + 3.4), F.p(pts[1], y0 + 3.0, it.d / 2 + 3.4), F.p(pts[1], y0 + 3.6, it.d / 2), F.p(pts[0], y0 + 3.6, it.d / 2), [0, 0, 4, 1]);
  }
  // lanterns by the door
  for (const sx of [-1, 1]) box(B.acc(M.lamp), F.wx(sx * (ew / 2 + 0.8), it.d / 2 + 3.1), y0 + 2.4, F.wz(sx * (ew / 2 + 0.8), it.d / 2 + 3.1), 0.3, 0.4, 0.3, it.ry, { u: 1 });
  col(wall, WHITE); col(roof, WHITE); col(stone, WHITE); col(paint, WHITE);
}

function buildCabin(B, M, it) {
  const F = new Fr(it.x, 0, it.z, it.ry);
  const g = B.footY(it.x, it.z, it.w, it.d, it.ry);
  const y0 = g.hi + 0.5;
  const wall = B.acc(M.wall), roof = B.acc(M.roof), stone = B.acc(M.stone), paint = B.acc(M.paint);
  col(stone, lin('#7d786e'));
  F.box(stone, 0, g.lo - 0.8, 0, it.w, y0 - g.lo + 0.8, it.d, { u: 2 });
  col(wall, it.seed < 0.5 ? WHITE : lin('#e0d0c0'));
  storey(wall, it.x, y0, it.z, it.w, it.d, it.ry, it.lit > 0.3 ? 0 : 1, 'fb');
  storey(wall, it.x, y0, it.z, it.w, it.d, it.ry, 1, 'lr');
  col(roof, lin(it.seed < 0.33 ? '#3e5236' : it.seed < 0.66 ? '#5a3a2a' : '#4a4a46'));
  col(paint, lin('#5a3a26'));
  gable(roof, it.x, y0 + STOREY, it.z, it.w, it.d, 2.4, it.ry, { over: 0.7, endAcc: paint });
  col(paint, lin('#7a5a3a'));
  F.box(paint, 0, y0 - 0.25, it.d / 2 + 1.1, it.w, 0.25, 2.2, { u: 2 });
  col(paint, lin('#4a3020'));
  for (const lx of [-it.w / 2 + 0.2, it.w / 2 - 0.2]) F.box(paint, lx, y0, it.d / 2 + 2.1, 0.2, 2.4, 0.2, { u: 1 });
  col(roof, lin('#4a3a2e'));
  roof.quadP(F.p(-it.w / 2 - 0.2, y0 + 2.4, it.d / 2 + 2.4), F.p(it.w / 2 + 0.2, y0 + 2.4, it.d / 2 + 2.4), F.p(it.w / 2 + 0.2, y0 + 2.8, it.d / 2), F.p(-it.w / 2 - 0.2, y0 + 2.8, it.d / 2));
  col(stone, lin('#8a8478'));
  F.box(stone, (it.seed < 0.5 ? -1 : 1) * (it.w / 2 + 0.5), g.lo - 0.5, -it.d * 0.1, 1.3, y0 - g.lo + STOREY + 3.6, 1.3, { u: 2 });
  box(B.acc(M.lamp), F.wx(2, it.d / 2 + 0.15), y0 + 2.3, F.wz(2, it.d / 2 + 0.15), 0.22, 0.3, 0.22, it.ry, { u: 1 });
  col(wall, WHITE); col(roof, WHITE); col(stone, WHITE); col(paint, WHITE);
}

function buildCurio(B, M, it) {
  buildCabin(B, M, { ...it, lit: 1 });
  const F = new Fr(it.x, 0, it.z, it.ry);
  const g = B.footY(it.x, it.z, it.w, it.d, it.ry);
  const y0 = g.hi + 0.5;
  signPanel(B.acc(M.sign), F, 0, y0 + STOREY + 0.1, it.d / 2 + 0.7, 5.2, 1.3, 5);
  // the carved bear by the door (a stump and some lumps of redwood)
  const bark = B.acc(M.bark);
  const bx = F.wx(it.w / 2 + 2, it.d / 2 + 2.5), bz = F.wz(it.w / 2 + 2, it.d / 2 + 2.5), by = B.groundY(bx, bz);
  bark.col = lin('#c08a6a');
  cylinder(bark, bx, by - 0.2, bz, 0.7, 0.9, 8, { top: true });
  bark.col = lin('#6a3a24');
  lathe(bark, bx, by + 0.7, bz, [[0.45, 0], [0.55, 0.7], [0.42, 1.5], [0.3, 1.8], [0, 1.95]], 7, { u: 1 });
  lathe(bark, bx, by + 2.4, bz, [[0.05, 0], [0.32, 0.12], [0.3, 0.45], [0, 0.6]], 7, { u: 1 });
  bark.col = WHITE;
}

/** The fire lookout: a timber tower 22 m tall, its glazed cab on top lit at night. */
function buildLookout(B, M, it) {
  const g = B.footY(it.x, it.z, it.w, it.d, it.ry);
  const F = new Fr(it.x, g.lo, it.z, it.ry);
  const paint = B.acc(M.paint), roof = B.acc(M.roof), win = B.acc(M.win);
  const H = it.h, b0 = 4.6, b1 = 2.7;
  col(paint, lin('#5a4030'));
  const legs = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
  for (const [sx, sz] of legs) beam(paint, F.p(sx * b0, -0.6, sz * b0), F.p(sx * b1, H, sz * b1), 0.34, 0.34);
  // X-bracing in four bays, girts at each level
  const lv = [0, 0.27, 0.52, 0.76, 1].map((f) => f * H);
  const half = (y) => b0 + (b1 - b0) * (y / H);
  col(paint, lin('#6a4c36'));
  for (let k = 0; k < lv.length - 1; k++) {
    const ya = lv[k] + 0.3, yb = lv[k + 1];
    const ha = half(ya), hb = half(yb);
    for (let e = 0; e < 4; e++) {
      const [ax, az] = legs[e], [bx, bz] = legs[(e + 1) % 4];
      beam(paint, F.p(ax * ha, ya, az * ha), F.p(bx * hb, yb, bz * hb), 0.14, 0.14);
      beam(paint, F.p(bx * ha, ya, bz * ha), F.p(ax * hb, yb, az * hb), 0.14, 0.14);
      beam(paint, F.p(ax * hb, yb, az * hb), F.p(bx * hb, yb, bz * hb), 0.18, 0.18);
    }
  }
  // the zig-zag stair inside the frame
  col(paint, lin('#7a5a40'));
  for (let k = 0; k < 8; k++) {
    const ya = (k / 8) * H, yb = ((k + 1) / 8) * H;
    const s = k % 2 ? 1 : -1;
    beam(paint, F.p(-1.2 * s, ya, 0.6), F.p(1.2 * s, yb, 0.6), 0.9, 0.12);
  }
  // the cab: a deck with a rail, a glazed room, a hip roof, an aerial with a red light
  col(paint, lin('#7a5a40'));
  F.box(paint, 0, H, 0, 8.2, 0.35, 8.2, { u: 2 });
  col(paint, lin('#4a3424'));
  for (const [sx, sz] of legs) F.box(paint, sx * 4, H + 0.35, sz * 4, 0.14, 1.1, 0.14, { u: 1 });
  for (let e = 0; e < 4; e++) {
    const [ax, az] = legs[e], [bx, bz] = legs[(e + 1) % 4];
    beam(paint, F.p(ax * 4, H + 1.4, az * 4), F.p(bx * 4, H + 1.4, bz * 4), 0.1, 0.1);
  }
  col(paint, lin('#5a4030'));
  F.box(paint, 0, H + 0.35, 0, 5.6, 1.1, 5.6, { u: 2 });
  F.box(win, 0, H + 1.45, 0, 5.5, 1.8, 5.5, { u: 2, top: false });
  col(paint, lin('#3a2a1e'));
  for (const [sx, sz] of legs) F.box(paint, sx * 2.75, H + 1.45, sz * 2.75, 0.18, 1.8, 0.18, { u: 1 });
  col(roof, lin('#3e5236'));
  hip(roof, it.x, g.lo + H + 3.25, it.z, 6.2, 6.2, 1.6, it.ry, { over: 0.5 });
  col(paint, lin('#8a8a8a'));
  cylinder(paint, it.x, g.lo + H + 4.6, it.z, 0.05, 3.6, 4);
  box(B.acc(M.red), it.x, g.lo + H + 8.2, it.z, 0.25, 0.25, 0.25, it.ry, { u: 1 });
  col(paint, WHITE); col(roof, WHITE);
}

/** The Redwood pits: logs below, garages to the lane, a timber gallery above, race control at the east end. */
function buildPits(B, M, it) {
  const F = new Fr(it.x, 0, it.z, it.ry);
  const g = B.footY(it.x, it.z, it.w, it.d, it.ry);
  const wall = B.acc(M.wall), roof = B.acc(M.roof), stone = B.acc(M.stone), paint = B.acc(M.paint);
  const base = g.hi + 0.2;
  col(stone, lin('#7e786c'));
  F.box(stone, 0, g.lo - 1, 0, it.w, base - g.lo + 1, it.d, { u: 2 });
  col(wall, WHITE);
  storey(wall, it.x, base, it.z, it.w, it.d, it.ry, 5, 'f');
  storey(wall, it.x, base, it.z, it.w, it.d, it.ry, 1, 'blr');
  storey(wall, it.x, base + STOREY, it.z, it.w, it.d, it.ry, 0);
  const top = base + 2 * STOREY;
  col(roof, lin('#3e5236'));
  col(paint, lin('#5a3a26'));
  gable(roof, it.x, top, it.z, it.w, it.d, 3.2, it.ry, { over: 0.8, endAcc: paint });
  // the first-floor gallery on timber brackets over the lane
  col(paint, lin('#6a4a30'));
  F.box(paint, 0, base + STOREY - 0.3, it.d / 2 + 2.2, it.w, 0.3, 4.4, { u: 2 });
  col(paint, lin('#4a3020'));
  for (let k = 0; k <= 12; k++) {
    const lx = -it.w / 2 + (it.w * k) / 12;
    beam(paint, F.p(lx, base + 0.6, it.d / 2 + 0.1), F.p(lx, base + STOREY - 0.3, it.d / 2 + 4.2), 0.24, 0.24);
    F.box(paint, lx, base + STOREY, it.d / 2 + 4.3, 0.12, 1.1, 0.12, { u: 1 });
  }
  beam(paint, F.p(-it.w / 2, base + STOREY + 1.1, it.d / 2 + 4.3), F.p(it.w / 2, base + STOREY + 1.1, it.d / 2 + 4.3), 0.1, 0.12);
  // race control: a timber tower at the end nearer the start
  const tx = it.w / 2 - 7;
  col(wall, WHITE);
  storey(wall, F.wx(tx, 0), top, F.wz(tx, 0), 10, 10, it.ry, 0);
  storey(wall, F.wx(tx, 0), top + STOREY, F.wz(tx, 0), 10, 10, it.ry, 2);
  col(roof, lin('#3e5236'));
  hip(roof, F.wx(tx, 0), top + 2 * STOREY, F.wz(tx, 0), 11.4, 11.4, 2.2, it.ry, { over: 0.4 });
  const sacc = B.acc(M.sign);
  signPanel(sacc, F, -10, top + 0.4, it.d / 2 + 0.9, 18, 4.5, 4);
  signPanel(sacc, new Fr(it.x, 0, it.z, it.ry + Math.PI), 0, top + 0.4, it.d / 2 + 0.9, 18, 4.5, 4);
  col(wall, WHITE); col(roof, WHITE); col(stone, WHITE); col(paint, WHITE);
}

function buildCarpark(B, M, it) {
  const F = new Fr(it.x, 0, it.z, it.ry);
  const poly = [F.p(-it.w / 2, 0, -it.d / 2), F.p(it.w / 2, 0, -it.d / 2), F.p(it.w / 2, 0, it.d / 2), F.p(-it.w / 2, 0, it.d / 2)].map((p) => [p[0], p[2]]);
  drapeUV(B.acc(M.gravel), B, poly, { lift: 0.06, step: 6, uv: 3 });
  const paint = B.acc(M.paint);
  const cols = ['#8a2a22', '#2a4a6a', '#e8e2d0', '#3a5a3a', '#6a6a62', '#1e1e20'];
  for (let k = 0; k < it.cars; k++) {
    const [px, pz] = toWorld(it.x, it.z, it.ry, -14 + k * 7, -3);
    if (hash2(px, pz) >= 0.75) continue;
    const kind = hash2(px, pz, 2);
    if (kind < 0.5) sedan(paint, px, B.groundY(px, pz), pz, it.ry + Math.PI, cols[k % cols.length]);
    else pickup(paint, px, B.groundY(px, pz), pz, it.ry + Math.PI, cols[(k + 2) % cols.length]);
  }
  col(paint, WHITE);
}

function buildSign(B, M, it) {
  const F = new Fr(it.x, 0, it.z, it.ry);
  const gy = B.groundY(it.x, it.z);
  const paint = B.acc(M.paint), bark = B.acc(M.bark), stone = B.acc(M.stone);
  if (it.kind === 'gate') {
    // a carved board on two big log posts over a stone base
    col(stone, lin('#8a8478'));
    F.box(stone, 0, gy - 0.6, 0, it.w + 1.6, 1.2, 1.2, { u: 2 });
    bark.col = lin('#d8a888');
    for (const sx of [-1, 1]) cylinder(bark, F.wx(sx * (it.w / 2 + 0.3), 0), gy, F.wz(sx * (it.w / 2 + 0.3), 0), 0.38, it.post + it.h + 0.8, 8, { top: true });
    beam(bark, F.p(-it.w / 2 - 0.9, gy + it.post + it.h + 0.5, 0), F.p(it.w / 2 + 0.9, gy + it.post + it.h + 0.5, 0), 0.5, 0.5, { caps: true });
    bark.col = WHITE;
  } else if (it.kind === 'pole') {
    col(paint, lin('#8a8a86'));
    cylinder(paint, it.x, gy - 0.3, it.z, 0.06, it.post + it.h + 0.3, 5);
  } else {
    col(paint, lin(it.kind === 'logs' ? '#5a3a26' : '#4a3424'));
    for (const sx of [-1, 1]) F.box(paint, sx * (it.w / 2 - 0.2), gy - 0.4, 0, 0.26, it.post + it.h + 0.5, 0.26, { u: 1 });
  }
  col(paint, lin('#3a2416'));
  F.box(paint, 0, gy + it.post - 0.1, -0.09, it.w + 0.2, it.h + 0.2, 0.14, { u: 1 });
  const sacc = B.acc(M.sign);
  signPanel(sacc, F, 0, gy + it.post, 0, it.w, it.h, it.slot);
  signPanel(sacc, new Fr(it.x, 0, it.z, it.ry + Math.PI), 0, gy + it.post, 0.18, it.w, it.h, it.slot);
  col(paint, WHITE);
}

function buildMist(B, M, it) {
  const acc = B.acc(M.mist);
  const y = it.y + it.lift;
  const c = Math.cos(it.ry), s = Math.sin(it.ry);
  // a low bank: a wide sheet near the ground and two crossed veils
  const W = it.w, H = it.h;
  acc.quadP([it.x - W * 0.6, y - H * 0.35, it.z - W * 0.6], [it.x + W * 0.6, y - H * 0.35, it.z - W * 0.6], [it.x + W * 0.6, y - H * 0.35, it.z + W * 0.6], [it.x - W * 0.6, y - H * 0.35, it.z + W * 0.6], [0, 0, 1, 1]);
  for (const [a, b] of [[c, -s], [s, c]]) {
    acc.quadP([it.x - a * W / 2, y - H / 2, it.z - b * W / 2], [it.x + a * W / 2, y - H / 2, it.z + b * W / 2], [it.x + a * W / 2, y + H / 2, it.z + b * W / 2], [it.x - a * W / 2, y + H / 2, it.z - b * W / 2], [0, 0.05, 1, 0.95]);
  }
}

// ------------------------------------------------------------------ scatter

function scatter(S) {
  const near = (x, z) => S.net.nearest(x, z, 80);
  const clear = (x, z, circuit, road) => {
    const n = near(x, z);
    if (!n) return false;
    return n.road.rt.id === 'circuit' ? n.d < circuit : n.d < road;
  };
  // the giants, 30 m apart where the noise is kind
  for (const [x, z] of S.points(30, { r: 7, density: (px, pz) => 0.5 + 0.5 * S.noise(px / 260, pz / 260) })) {
    if (clear(x, z, 50, 15)) continue;
    const y = S.groundY(x, z);
    const h = S.range(56, 92), r = S.range(1.6, 3.0);
    S.add({ type: 'giant', x, z, y, h, r, t: S.rng() });
    S.collider({ kind: 'circle', x, z, r: r * 1.3, y0: y - 1, y1: y + 30 });
  }
  // the understory: younger redwoods and firs
  for (const [x, z] of S.points(17, { r: 3, density: (px, pz) => 0.3 + 0.35 * S.noise(px / 140 + 7, pz / 140) })) {
    if (clear(x, z, 42, 9)) continue;
    const y = S.groundY(x, z);
    S.add({ type: 'fir', x, z, y, h: S.range(16, 34), t: S.rng() });
    S.collider({ kind: 'circle', x, z, r: 0.6, y0: y - 1, y1: y + 10 });
  }
  // the floor: ferns, fallen giants, stumps, mossy rocks
  for (const [x, z] of S.points(8, { r: 1.4, density: (px, pz) => 0.45 + 0.4 * S.noise(px / 60, pz / 60 + 3) })) {
    if (clear(x, z, 28, 0)) continue;
    const y = S.groundY(x, z);
    const u = S.rng();
    if (u < 0.86) S.add({ type: 'fern', x, z, y, s: S.range(0.8, 1.7), t: S.rng() });
    else if (u < 0.9 && S.free(x, z, 9)) {
      const L = S.range(14, 30), r = S.range(0.8, 1.6), ang = S.range(0, Math.PI);
      S.add({ type: 'log', x, z, y, L, r, ang, t: S.rng() });
      S.collider({ kind: 'box', x, z, hx: L / 2, hz: r, ry: Math.PI / 2 - ang, y0: y - 1, y1: y + r * 1.8 });
    } else if (u < 0.95) {
      const r = S.range(1.0, 2.2);
      S.add({ type: 'stump', x, z, y, r, t: S.rng() });
      S.collider({ kind: 'circle', x, z, r: r * 1.1, y0: y - 1, y1: y + 2.5 });
    } else {
      const s = S.range(0.7, 2.0);
      S.add({ type: 'rock', x, z, y, s, t: S.rng() });
      if (s > 1.2) S.collider({ kind: 'circle', x, z, r: s * 0.9, y0: y - 1, y1: y + s });
    }
  }
  // mist lying in the trees (away from the raceway's lights)
  for (const [x, z] of S.points(64, { r: 3, clear: false, density: (px, pz) => 0.35 + 0.45 * S.noise(px / 300 + 11, pz / 300) })) {
    if (clear(x, z, 70, 10)) continue;
    S.add({ type: 'mist', x, z, y: S.groundY(x, z), lift: S.range(2.5, 6), w: S.range(26, 44), h: S.range(6, 11), ry: S.range(0, Math.PI) });
  }
}

// ------------------------------------------------------------------ the pack

export default {
  id: 'redwood',

  plan(P) {
    planCircuit(P);
    planGrandfather(P);
    planHighway(P);
  },

  scatter,

  warm(B) { mats(B); },

  *build(B, items) {
    const M = mats(B);
    let n = 0;
    for (const it of items) {
      switch (it.type) {
        case 'giant': redwood(B.acc(M.bark), B.acc(M.leaf), it.x, it.y, it.z, it.h, it.r, it.t, { leaf: '#1e3a24', leaf2: '#2e5230' }); break;
        case 'fir': fir(B.acc(M.bark), B.acc(M.leaf), it.x, it.y, it.z, it.h, it.t, { bark: '#c8a090' }); break;
        case 'fern': fern(B.near(M.fern), it.x, it.y, it.z, it.s, it.t, it.t < 0.5 ? '#3f6a28' : '#4f7a2e'); break;
        case 'log': fallenLog(B.acc(M.bark), B.acc(M.leaf), it.x, it.y, it.z, it.L, it.r, it.ang, it.t); break;
        case 'stump': {
          const bark = B.acc(M.bark);
          bark.col = lin('#c89a80');
          lathe(bark, it.x, it.y - 0.5, it.z, [[it.r * 1.4, 0], [it.r * 1.05, 0.8], [it.r, 1.4 + it.t * 1.6]], 9, { u: 2.4, v: 4, top: true });
          bark.col = WHITE;
          break;
        }
        case 'rock': rock(B.near(M.stone), it.x, it.y, it.z, it.s, it.t, '#7a7a6e'); break;
        case 'mist': buildMist(B, M, it); break;
        case 'grandfather': buildGrandfather(B, M, it); yield; break;
        case 'ranger': buildRanger(B, M, it); break;
        case 'lodge': buildLodge(B, M, it); yield; break;
        case 'cabin': buildCabin(B, M, it); break;
        case 'curio': buildCurio(B, M, it); break;
        case 'lookout': buildLookout(B, M, it); break;
        case 'carpark': buildCarpark(B, M, it); break;
        case 'sign': buildSign(B, M, it); break;
        case 'picnic': picnicTable(B.acc(M.paint), it.x, it.y, it.z, it.ry, '#6a4a30'); break;
        case 'camper': camper(B.acc(M.paint), B.acc(M.lamp), it.x, B.groundY(it.x, it.z), it.z, it.ry, '#e8e2d0', '#2a6a4a'); break;
        case 'pits': buildPits(B, M, it); yield; break;
        case 'r-gravel': buildGravel(B, M, it); break;
        case 'r-tyres': buildTyres(B, M, it); break;
        case 'r-wall': buildWall(B, M, it, ST); break;
        case 'stand': buildStand(B, M, { ...it, kind: 'timber' }, ST); yield; break;
        case 'r-mast': buildMast(B, M, { ...it, kind: 'wood' }, ST); break;
        case 'r-gantry': buildGantry(B, M, it, ST); break;
        case 'r-start': buildStartLine(B, M, it); break;
        case 'r-board': buildBoard(B, M, it); break;
        case 'r-marshal': buildMarshal(B, M, it, ST); break;
        case 'r-paddock': buildPaddock(B, M, it); break;
        case 'r-pole': buildPole(B, M, it); break;
        default: break;
      }
      if (++n % 24 === 0) yield;
    }
  },
};

void glowColorMat; void text; void streaks; void sedan;
