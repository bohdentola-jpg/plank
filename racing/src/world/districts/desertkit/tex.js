// PORT HALCYON — the desert kit's canvas textures (drawn once, at load, in
// warm(): never while driving). Shared by the four desert packs (Route 99 and
// the High Desert, Red Rock Canyon, Ghost Town, Dry Lake). Atlases carry a
// pixel-rect table (R.*) so the builders can map a panel to its piece.
import * as THREE from 'three';
import { toTex } from '../../../track/textures.js';
import { makeRng } from '../../../core/util.js';

const CACHE = new Map();
const once = (key, fn) => { if (!CACHE.has(key)) CACHE.set(key, fn()); return CACHE.get(key); };

function cv(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return { c, x: c.getContext('2d') };
}

/** Text with a max width (squeezed to fit), optional stroke. */
function text(x, str, px, py, size, color, o = {}) {
  x.save();
  x.font = `${o.style || ''} ${o.weight || 'bold'} ${size}px ${o.font || 'Arial, Helvetica, sans-serif'}`;
  x.textAlign = o.align || 'center';
  x.textBaseline = 'middle';
  const w = x.measureText(str).width;
  x.translate(px, py);
  if (o.maxW && w > o.maxW) x.scale(o.maxW / w, 1);
  if (o.glow) { x.shadowColor = o.glow; x.shadowBlur = o.blur ?? 14; }
  if (o.stroke) { x.lineWidth = o.stroke[1]; x.strokeStyle = o.stroke[0]; x.lineJoin = 'round'; x.strokeText(str, 0, 0); }
  if (o.outline) { x.lineWidth = o.outline; x.strokeStyle = color; x.lineJoin = 'round'; x.strokeText(str, 0, 0); }
  else { x.fillStyle = color; x.fillText(str, 0, 0); }
  x.restore();
}

/** Neon text: coloured tubes in the colour map, their glow (and a hot core) in the emissive map. */
function neon(x, e, str, px, py, size, color, o = {}) {
  text(x, str, px, py, size, color, { ...o, stroke: ['rgba(0,0,0,0.55)', Math.max(2, size * 0.08)] });
  if (e) {
    text(e, str, px, py, size, color, { ...o, glow: color, blur: o.blur ?? 18 });
    text(e, str, px, py, size, 'rgba(255,255,255,0.55)', { ...o, glow: color, blur: 4 });
  }
}

/** Sun, grit, rust streaks and the odd bullet hole. */
function weather(x, x0, y0, w, h, rng, amt = 1, holes = false) {
  x.save();
  x.beginPath(); x.rect(x0, y0, w, h); x.clip();
  x.fillStyle = `rgba(255,245,225,${0.07 * amt})`;
  x.fillRect(x0, y0, w, h);
  const n = Math.floor(w * h * 0.003 * amt);
  for (let i = 0; i < n; i++) {
    x.fillStyle = rng() < 0.5 ? `rgba(255,250,240,${rng() * 0.22})` : `rgba(40,30,20,${rng() * 0.22})`;
    x.fillRect(x0 + rng() * w, y0 + rng() * h, 1 + rng() * 2, 1 + rng() * 2);
  }
  for (let i = 0; i < 4 * amt; i++) {
    const px = x0 + rng() * w, len = h * (0.1 + rng() * 0.5);
    const g = x.createLinearGradient(0, y0, 0, y0 + len);
    g.addColorStop(0, 'rgba(110,60,30,0.28)');
    g.addColorStop(1, 'rgba(110,60,30,0)');
    x.fillStyle = g;
    x.fillRect(px, y0, 2 + rng() * 4, len);
  }
  if (holes && rng() < 0.7) {
    const cx = x0 + w * (0.2 + rng() * 0.6), cy = y0 + h * (0.2 + rng() * 0.6);
    for (let i = 0; i < 3 + rng() * 6; i++) {
      const hx = cx + (rng() - 0.5) * w * 0.25, hy = cy + (rng() - 0.5) * h * 0.3;
      x.fillStyle = 'rgba(230,225,215,0.85)';
      x.beginPath(); x.arc(hx, hy, 3, 0, 7); x.fill();
      x.fillStyle = 'rgba(20,18,16,0.95)';
      x.beginPath(); x.arc(hx, hy, 1.7, 0, 7); x.fill();
    }
  }
  x.restore();
}

function grain(x, x0, y0, w, h, rng, amount, a = 0.2) {
  const n = Math.floor(w * h * amount);
  for (let i = 0; i < n; i++) {
    x.fillStyle = rng() < 0.5 ? `rgba(255,255,255,${rng() * a})` : `rgba(0,0,0,${rng() * a})`;
    x.fillRect(x0 + rng() * w, y0 + rng() * h, 1, 1);
  }
}

const rr = (x, x0, y0, w, h, r) => { x.beginPath(); if (x.roundRect) x.roundRect(x0, y0, w, h, r); else x.rect(x0, y0, w, h); };

/** uv rect for quadP from a pixel rect [x, y, w, h] of an S×SH atlas (canvas y down). */
export function uvOf(r, S = 1024, SH = S) {
  return [(r[0] + 0.5) / S, 1 - (r[1] + r[3] - 0.5) / SH, (r[0] + r[2] - 0.5) / S, 1 - (r[1] + 0.5) / SH];
}

// ------------------------------------------------------------------ SIGNS (buildings, Route 99)

/** Pixel rects in the SIGNS atlas (1024²). */
export const R = {
  dinerWin: [0, 0, 512, 256], dinerSign: [512, 0, 512, 128], dinerDoor: [512, 128, 128, 128],
  office: [640, 128, 128, 128], vacancy: [768, 128, 256, 64], fascia: [768, 192, 256, 64],
  rocketPanel: [0, 256, 512, 256], motelSign: [512, 256, 512, 256],
  motelRoom: [0, 512, 512, 192], storeFront: [512, 512, 512, 192],
  towerBand: [0, 704, 1024, 128],
  price: [0, 832, 192, 192], pump: [192, 832, 96, 192], junkSign: [288, 832, 512, 128],
  canopyLight: [288, 960, 256, 64], shackWin: [544, 960, 128, 64], ctrlWin: [672, 960, 128, 64],
  silo: [800, 832, 224, 192],
};

export function signsAtlas() {
  return once('signs', () => {
    const S = 1024;
    const A = cv(S, S), E = cv(S, S);
    const x = A.x, e = E.x;
    const rng = makeRng('dk-signs');
    x.fillStyle = '#333'; x.fillRect(0, 0, S, S);
    e.fillStyle = '#000'; e.fillRect(0, 0, S, S);
    // ---- diner window module (4 m × 2 m): two windows, booths, warm light
    {
      const [x0, y0, w, h] = R.dinerWin;
      x.fillStyle = '#c9ced3'; x.fillRect(x0, y0, w, h);
      for (let k = 0; k < 2; k++) {
        const wx = x0 + 14 + k * 248, wy = y0 + 18, ww = 228, wh = 210;
        const g = x.createLinearGradient(0, wy, 0, wy + wh);
        g.addColorStop(0, '#f7d9a0'); g.addColorStop(1, '#c98d50');
        x.fillStyle = g; x.fillRect(wx, wy, ww, wh);
        // ceiling lamps
        for (let q = 0; q < 3; q++) { x.fillStyle = '#fff6dc'; x.beginPath(); x.arc(wx + 40 + q * 75, wy + 26, 9, 0, 7); x.fill(); }
        // booths: red vinyl backs, a table, people
        x.fillStyle = '#a3241c'; x.fillRect(wx + 8, wy + wh - 90, 70, 80); x.fillRect(wx + ww - 78, wy + wh - 90, 70, 80);
        x.fillStyle = '#e8e2d0'; x.fillRect(wx + 70, wy + wh - 70, ww - 140, 10);
        x.fillStyle = 'rgba(40,24,14,0.7)';
        if (rng() < 0.8) { x.beginPath(); x.arc(wx + 60, wy + wh - 104, 16, 0, 7); x.fill(); x.fillRect(wx + 46, wy + wh - 90, 30, 40); }
        if (rng() < 0.6) { x.beginPath(); x.arc(wx + ww - 64, wy + wh - 100, 15, 0, 7); x.fill(); x.fillRect(wx + ww - 78, wy + wh - 86, 28, 36); }
        // chrome mullions + a reflection streak
        x.fillStyle = '#e8ecef'; x.fillRect(wx + ww / 2 - 4, wy, 8, wh);
        x.fillStyle = 'rgba(255,255,255,0.18)';
        x.beginPath(); x.moveTo(wx + 30, wy); x.lineTo(wx + 70, wy); x.lineTo(wx + 20, wy + wh); x.lineTo(wx - 20, wy + wh); x.fill();
        const ge = e.createLinearGradient(0, wy, 0, wy + wh);
        ge.addColorStop(0, '#ffd890'); ge.addColorStop(1, '#a86a30');
        e.fillStyle = ge; e.fillRect(wx, wy, ww, wh);
        e.fillStyle = '#000'; e.fillRect(wx + ww / 2 - 4, wy, 8, wh);
      }
      x.fillStyle = '#9aa2a8'; x.fillRect(x0, y0 + 236, w, 20);
      weather(x, x0, y0, w, h, rng, 0.5);
    }
    // ---- ROCKET DINER roof sign (neon script on a turquoise cabinet)
    {
      const [x0, y0, w, h] = R.dinerSign;
      x.fillStyle = '#103c44'; rr(x, x0 + 4, y0 + 4, w - 8, h - 8, 20); x.fill();
      x.strokeStyle = '#e8ecef'; x.lineWidth = 6; rr(x, x0 + 12, y0 + 12, w - 24, h - 24, 14); x.stroke();
      neon(x, e, 'Rocket', x0 + 190, y0 + 66, 86, '#ff4fa3', { style: 'italic', weight: '900', font: 'Georgia, serif', maxW: 300 });
      neon(x, e, 'DINER', x0 + 400, y0 + 66, 64, '#5af0ff', { weight: '900', maxW: 170 });
      weather(x, x0, y0, w, h, rng, 0.6);
    }
    // ---- diner door (glass door, chrome frame, OPEN)
    {
      const [x0, y0, w, h] = R.dinerDoor;
      x.fillStyle = '#d7dce0'; x.fillRect(x0, y0, w, h);
      x.fillStyle = '#f0c888'; x.fillRect(x0 + 22, y0 + 14, w - 44, h - 18);
      e.fillStyle = '#c08040'; e.fillRect(x0 + 22, y0 + 14, w - 44, h - 18);
      x.fillStyle = '#c4cace'; x.fillRect(x0 + w / 2 - 3, y0 + 14, 6, h - 18);
      x.fillStyle = '#aab0b5'; x.fillRect(x0 + 30, y0 + 74, w - 60, 6);
      neon(x, e, 'OPEN', x0 + w / 2, y0 + 40, 26, '#ff3355', { weight: '900' });
    }
    // ---- motel office door + OFFICE neon
    {
      const [x0, y0, w, h] = R.office;
      x.fillStyle = '#f1e4c8'; x.fillRect(x0, y0, w, h);
      x.fillStyle = '#e8c890'; x.fillRect(x0 + 14, y0 + 44, 50, 82);
      e.fillStyle = '#b07838'; e.fillRect(x0 + 14, y0 + 44, 50, 82);
      x.fillStyle = '#7a4a2a'; x.fillRect(x0 + 76, y0 + 44, 40, 84);
      neon(x, e, 'OFFICE', x0 + w / 2, y0 + 20, 26, '#5af0ff', { weight: '900', maxW: 112 });
    }
    // ---- VACANCY
    {
      const [x0, y0, w, h] = R.vacancy;
      x.fillStyle = '#1a1416'; x.fillRect(x0, y0, w, h);
      neon(x, e, 'VACANCY', x0 + w / 2, y0 + h / 2 + 2, 44, '#ff2f4f', { weight: '900', maxW: w - 24 });
    }
    // ---- RAZOR FUEL canopy fascia
    {
      const [x0, y0, w, h] = R.fascia;
      x.fillStyle = '#f2efe8'; x.fillRect(x0, y0, w, h);
      x.fillStyle = '#d4231c'; x.fillRect(x0, y0 + 44, w, 12);
      x.fillStyle = '#f2a01e'; x.fillRect(x0, y0 + 56, w, 6);
      text(x, 'RAZOR', x0 + 84, y0 + 24, 34, '#d4231c', { style: 'italic', weight: '900' });
      text(x, 'FUEL', x0 + 190, y0 + 24, 34, '#141414', { style: 'italic', weight: '900' });
      text(e, 'RAZOR', x0 + 84, y0 + 24, 34, '#ff4a3a', { style: 'italic', weight: '900', glow: '#ff3a2a', blur: 8 });
      e.fillStyle = 'rgba(255,240,220,0.35)'; e.fillRect(x0, y0, w, 42);
      weather(x, x0, y0, w, h, rng, 0.4);
    }
    // ---- rocket pylon panel: EAT / PIE / SHAKES / OPEN 24 HRS
    {
      const [x0, y0, w, h] = R.rocketPanel;
      x.fillStyle = '#1d6f73'; rr(x, x0 + 4, y0 + 4, w - 8, h - 8, 28); x.fill();
      x.strokeStyle = '#f2e6c8'; x.lineWidth = 8; rr(x, x0 + 14, y0 + 14, w - 28, h - 28, 22); x.stroke();
      neon(x, e, 'EAT', x0 + 140, y0 + 96, 120, '#ff3b30', { weight: '900' });
      neon(x, e, 'PIE · SHAKES', x0 + 360, y0 + 70, 40, '#ffe36a', { weight: '900', maxW: 250 });
      neon(x, e, 'BURGERS', x0 + 360, y0 + 122, 40, '#ffe36a', { weight: '900', maxW: 250 });
      neon(x, e, 'OPEN 24 HRS', x0 + w / 2, y0 + 196, 54, '#5af0ff', { weight: '900', maxW: 420 });
      weather(x, x0, y0, w, h, rng, 1);
    }
    // ---- STARLITE MOTEL panel
    {
      const [x0, y0, w, h] = R.motelSign;
      x.fillStyle = '#f2e7cf'; rr(x, x0 + 4, y0 + 4, w - 8, h - 8, 30); x.fill();
      x.fillStyle = '#2a9a98'; rr(x, x0 + 16, y0 + 16, w - 32, h - 32, 22); x.fill();
      neon(x, e, 'Starlite', x0 + w / 2, y0 + 92, 112, '#ff5aa8', { style: 'italic', weight: '900', font: 'Georgia, serif', maxW: 440 });
      neon(x, e, 'MOTEL', x0 + w / 2, y0 + 186, 76, '#fff3c0', { weight: '900', maxW: 330 });
      for (let k = 0; k < 12; k++) {
        const bx = x0 + 40 + k * 39;
        x.fillStyle = '#ffd27a'; x.beginPath(); x.arc(bx, y0 + 236, 6, 0, 7); x.fill();
        e.fillStyle = '#ffb040'; e.beginPath(); e.arc(bx, y0 + 236, 8, 0, 7); e.fill();
      }
      weather(x, x0, y0, w, h, rng, 0.9);
    }
    // ---- motel rooms: two rooms, 4 m each (door, window, AC unit, number)
    {
      const [x0, y0, w, h] = R.motelRoom;
      x.fillStyle = '#f0dcc0'; x.fillRect(x0, y0, w, h);
      for (let k = 0; k < 2; k++) {
        const rx = x0 + k * 256;
        const door = ['#2a8a88', '#d0506a'][k];
        x.fillStyle = door; x.fillRect(rx + 30, y0 + 40, 64, 150);
        x.fillStyle = '#e6c860'; x.beginPath(); x.arc(rx + 84, y0 + 118, 4, 0, 7); x.fill();
        text(x, String(4 + k), rx + 62, y0 + 66, 22, '#fff4d8', { weight: '900' });
        // window with curtains, lit in some rooms
        const lit = k === 0 || rng() < 0.5;
        x.fillStyle = lit ? '#f6cf8a' : '#2a2c34'; x.fillRect(rx + 120, y0 + 58, 110, 70);
        if (lit) { e.fillStyle = '#e09a50'; e.fillRect(rx + 120, y0 + 58, 110, 70); }
        x.fillStyle = lit ? '#c86a4a' : '#5a3a3a'; x.fillRect(rx + 120, y0 + 58, 26, 70); x.fillRect(rx + 204, y0 + 58, 26, 70);
        x.fillStyle = '#ddd'; x.fillRect(rx + 116, y0 + 54, 118, 5);
        // AC unit under the window
        x.fillStyle = '#c8c8c0'; x.fillRect(rx + 140, y0 + 140, 70, 36);
        x.strokeStyle = '#8a8a84'; x.lineWidth = 2;
        for (let q = 0; q < 6; q++) { x.beginPath(); x.moveTo(rx + 146, y0 + 146 + q * 5); x.lineTo(rx + 204, y0 + 146 + q * 5); x.stroke(); }
        // porch light by the door
        x.fillStyle = '#fff2c8'; x.fillRect(rx + 102, y0 + 70, 10, 14);
        e.fillStyle = '#ffd890'; e.fillRect(rx + 100, y0 + 68, 14, 18);
      }
      x.fillStyle = '#c86a4a'; x.fillRect(x0, y0, w, 14);
      weather(x, x0, y0, w, h, rng, 0.8);
    }
    // ---- gas station store: FOOD MART band, windows with shelves
    {
      const [x0, y0, w, h] = R.storeFront;
      x.fillStyle = '#e9e6de'; x.fillRect(x0, y0, w, h);
      x.fillStyle = '#d4231c'; x.fillRect(x0, y0, w, 46);
      text(x, 'FOOD MART · COLD BEER · ICE', x0 + w / 2, y0 + 24, 32, '#fff', { weight: '900', maxW: w - 30 });
      e.fillStyle = 'rgba(255,90,70,0.6)'; e.fillRect(x0, y0, w, 46);
      for (let k = 0; k < 3; k++) {
        const wx = x0 + 16 + k * 168, wy = y0 + 62, ww = 150, wh = 118;
        x.fillStyle = '#fbf3dc'; x.fillRect(wx, wy, ww, wh);
        for (let r = 0; r < 3; r++) for (let q = 0; q < 10; q++) {
          x.fillStyle = ['#c8322a', '#2a6ac8', '#e8c22a', '#3a9a4a', '#f2f2f2'][(q + r * 3 + k) % 5];
          x.fillRect(wx + 6 + q * 14, wy + 18 + r * 34, 10, 22);
        }
        e.fillStyle = '#d8ccb0'; e.fillRect(wx, wy, ww, wh);
        x.fillStyle = '#2a2a2a'; x.fillRect(wx - 3, wy - 3, ww + 6, 4);
        if (k === 1) { x.fillStyle = '#c8c8c8'; x.fillRect(wx + 40, wy + 4, 70, wh); e.fillStyle = '#c0b498'; e.fillRect(wx + 40, wy + 4, 70, wh); }
      }
      weather(x, x0, y0, w, h, rng, 0.6);
    }
    // ---- water tower band: DRY WELLS (twice round the tank)
    {
      const [x0, y0, w, h] = R.towerBand;
      x.fillStyle = '#b9c2c6'; x.fillRect(x0, y0, w, h);
      for (const px of [256, 768]) text(x, 'DRY WELLS', x0 + px, y0 + 66, 86, '#1f2a33', { weight: '900', maxW: 460 });
      weather(x, x0, y0, w, h, rng, 2.5, true);
    }
    // ---- price sign
    {
      const [x0, y0, w, h] = R.price;
      x.fillStyle = '#f2efe8'; x.fillRect(x0 + 4, y0 + 4, w - 8, h - 8);
      x.fillStyle = '#d4231c'; x.fillRect(x0 + 4, y0 + 4, w - 8, 52);
      text(x, 'RAZOR FUEL', x0 + w / 2, y0 + 30, 28, '#fff', { style: 'italic', weight: '900', maxW: w - 20 });
      [['REG', '1.89'], ['SUP', '2.09'], ['DSL', '1.99']].forEach(([a, b], k) => {
        const py = y0 + 84 + k * 38;
        x.fillStyle = '#111'; x.fillRect(x0 + 74, py - 16, 108, 32);
        text(x, a, x0 + 40, py, 22, '#222');
        text(x, b + '9', x0 + 128, py, 26, '#ff6a1e', { font: 'Courier New, monospace' });
        text(e, b + '9', x0 + 128, py, 26, '#ff6a1e', { font: 'Courier New, monospace', glow: '#ff5010', blur: 8 });
      });
      e.fillStyle = 'rgba(255,240,230,0.25)'; e.fillRect(x0 + 4, y0 + 4, w - 8, h - 8);
      weather(x, x0, y0, w, h, rng, 0.7);
    }
    // ---- pump face
    {
      const [x0, y0, w, h] = R.pump;
      x.fillStyle = '#ece9e2'; x.fillRect(x0, y0, w, h);
      x.fillStyle = '#d4231c'; x.fillRect(x0, y0, w, 40);
      x.fillStyle = '#1a1a1a'; x.fillRect(x0 + 12, y0 + 52, w - 24, 34);
      text(x, '08.42', x0 + w / 2, y0 + 69, 18, '#7aff7a', { font: 'Courier New, monospace' });
      e.fillStyle = '#30d050'; e.fillRect(x0 + 14, y0 + 56, w - 28, 26);
      x.fillStyle = '#333'; x.fillRect(x0 + 20, y0 + 104, w - 40, 70);
      weather(x, x0, y0, w, h, rng, 0.8);
    }
    // ---- BIG AL'S AUTO SALVAGE
    {
      const [x0, y0, w, h] = R.junkSign;
      x.fillStyle = '#e8c63a'; x.fillRect(x0, y0, w, h);
      x.fillStyle = '#1a1a1a'; x.fillRect(x0, y0 + h - 30, w, 30);
      text(x, "BIG AL'S", x0 + 130, y0 + 50, 56, '#b3261b', { weight: '900', style: 'italic', maxW: 230 });
      text(x, 'AUTO SALVAGE', x0 + 370, y0 + 50, 44, '#1a1a1a', { weight: '900', maxW: 240 });
      text(x, 'WE BUY JUNK CARS · PARTS · TOWING', x0 + w / 2, y0 + h - 15, 20, '#e8c63a', { weight: '900', maxW: w - 20 });
      weather(x, x0, y0, w, h, rng, 2.4, true);
    }
    // ---- canopy underside light panel
    {
      const [x0, y0, w, h] = R.canopyLight;
      x.fillStyle = '#d8d8d2'; x.fillRect(x0, y0, w, h);
      for (let k = 0; k < 4; k++) { x.fillStyle = '#fffbe8'; x.fillRect(x0 + 12 + k * 62, y0 + 12, 46, 40); e.fillStyle = '#fff6e0'; e.fillRect(x0 + 12 + k * 62, y0 + 12, 46, 40); }
    }
    // ---- shack window (dim) / control room windows (lit, cool)
    {
      const [x0, y0, w, h] = R.shackWin;
      x.fillStyle = '#6a5a48'; x.fillRect(x0, y0, w, h);
      x.fillStyle = '#e8b868'; x.fillRect(x0 + 20, y0 + 14, 88, 38);
      e.fillStyle = '#a06a28'; e.fillRect(x0 + 20, y0 + 14, 88, 38);
      x.fillStyle = '#3a2a1a'; x.fillRect(x0 + 62, y0 + 14, 4, 38); x.fillRect(x0 + 20, y0 + 31, 88, 4);
      const [c0, c1, cw, ch] = R.ctrlWin;
      x.fillStyle = '#d8dcde'; x.fillRect(c0, c1, cw, ch);
      for (let k = 0; k < 3; k++) {
        x.fillStyle = '#cfe6f2'; x.fillRect(c0 + 6 + k * 41, c1 + 12, 34, 30);
        e.fillStyle = '#9cc8e8'; e.fillRect(c0 + 6 + k * 41, c1 + 12, 34, 30);
      }
    }
    // ---- silo: blast door top (concrete, hazard stripes) for the lid
    {
      const [x0, y0, w, h] = R.silo;
      x.fillStyle = '#8a8880'; x.fillRect(x0, y0, w, h);
      grain(x, x0, y0, w, h, rng, 0.5, 0.25);
      for (let k = -8; k < 16; k++) {
        x.fillStyle = k % 2 ? '#e8c020' : '#1a1a1a';
        x.save(); x.beginPath(); x.rect(x0, y0, w, 22); x.clip();
        x.beginPath(); x.moveTo(x0 + k * 22, y0); x.lineTo(x0 + k * 22 + 22, y0); x.lineTo(x0 + k * 22 + 44, y0 + 22); x.lineTo(x0 + k * 22 + 22, y0 + 22); x.fill();
        x.restore();
      }
      text(x, 'NO STEP', x0 + w / 2, y0 + 70, 26, '#b02818', { weight: '900' });
      text(x, 'LF-09', x0 + w / 2, y0 + 130, 54, '#2a2a28', { weight: '900', font: 'Courier New, monospace' });
      weather(x, x0, y0, w, h, rng, 2.5);
    }
    return { map: toTex(A.c), emi: toTex(E.c) };
  });
}

// ------------------------------------------------------------------ ROAD SIGNS (1024×512, map only)

/** Cells of the ROADSIGNS atlas: [x, y, w, h] in px; size: metres [w, h]. */
export const RS = {
  shield: [[0, 0, 128, 128], [0.9, 0.9]],
  limit: [[128, 0, 128, 128], [0.8, 1.0]],
  mile: [[256, 0, 128, 128], [0.45, 0.8]],
  dip: [[384, 0, 128, 128], [1.2, 1.2]],
  rocks: [[512, 0, 128, 128], [1.2, 1.2]],
  cattle: [[640, 0, 128, 128], [1.2, 1.2]],
  chevron: [[768, 0, 128, 128], [0.6, 0.75]],
  stop: [[896, 0, 128, 128], [0.9, 0.9]],
  park: [[0, 128, 256, 128], [4.2, 2.1]],
  ghost: [[256, 128, 256, 128], [2.6, 1.3]],
  drylake: [[512, 128, 256, 128], [2.6, 1.3]],
  services: [[768, 128, 256, 128], [3.0, 1.5]],
  lastExit: [[0, 256, 256, 128], [3.4, 1.7]],
  town: [[256, 256, 256, 128], [2.4, 1.2]],
  array: [[512, 256, 256, 128], [3.2, 1.6]],
  restricted: [[768, 256, 256, 128], [2.2, 1.1]],
  mine: [[0, 384, 256, 128], [1.8, 0.9]],
  camp: [[256, 384, 256, 128], [2.4, 1.2]],
  overlook: [[512, 384, 256, 128], [2.4, 1.2]],
  bootHill: [[768, 384, 256, 128], [1.8, 0.9]],
};

export function roadSignsAtlas() {
  return once('roadsigns', () => {
    const W = 1024, H = 512;
    const { c, x } = cv(W, H);
    const rng = makeRng('dk-roadsigns');
    x.fillStyle = '#555'; x.fillRect(0, 0, W, H);
    const YEL = '#e9b52a', BLK = '#161514', GRN = '#0f6a3c', BRN = '#5a3a24', WHT = '#f2f0ea';
    const cell = (k) => RS[k][0];
    const plate = (k, bg, fg, draw, border = true, radius = 10) => {
      const [x0, y0, w, h] = cell(k);
      x.fillStyle = bg; rr(x, x0 + 3, y0 + 3, w - 6, h - 6, radius); x.fill();
      if (border) { x.strokeStyle = fg; x.lineWidth = 4; rr(x, x0 + 8, y0 + 8, w - 16, h - 16, radius * 0.7); x.stroke(); }
      draw(x0, y0, w, h);
      weather(x, x0, y0, w, h, rng, 0.9, rng() < 0.4);
    };
    const diamond = (k, draw) => {
      const [x0, y0, w, h] = cell(k);
      x.save(); x.translate(x0 + w / 2, y0 + h / 2); x.rotate(Math.PI / 4);
      x.fillStyle = BLK; x.fillRect(-44, -44, 88, 88);
      x.fillStyle = YEL; x.fillRect(-41, -41, 82, 82);
      x.strokeStyle = BLK; x.lineWidth = 3; x.strokeRect(-36, -36, 72, 72);
      x.restore();
      draw(x0 + w / 2, y0 + h / 2);
      weather(x, x0 + 20, y0 + 20, w - 40, h - 40, rng, 0.7, rng() < 0.5);
    };
    // Route 99 shield
    {
      const [x0, y0] = cell('shield');
      x.fillStyle = BLK; x.fillRect(x0 + 8, y0 + 8, 112, 112);
      x.fillStyle = WHT;
      x.beginPath();
      x.moveTo(x0 + 20, y0 + 20); x.quadraticCurveTo(x0 + 42, y0 + 30, x0 + 64, y0 + 18); x.quadraticCurveTo(x0 + 86, y0 + 30, x0 + 108, y0 + 20);
      x.quadraticCurveTo(x0 + 114, y0 + 78, x0 + 64, y0 + 112); x.quadraticCurveTo(x0 + 14, y0 + 78, x0 + 20, y0 + 20);
      x.fill();
      text(x, '99', x0 + 64, y0 + 64, 52, BLK, { font: 'Arial Narrow, Arial, sans-serif', weight: '900' });
      weather(x, x0 + 8, y0 + 8, 112, 112, rng, 0.6);
    }
    plate('limit', WHT, BLK, (x0, y0, w) => {
      text(x, 'SPEED', x0 + w / 2, y0 + 26, 20, BLK); text(x, 'LIMIT', x0 + w / 2, y0 + 46, 20, BLK);
      text(x, '65', x0 + w / 2, y0 + 88, 54, BLK, { font: 'Arial Narrow, Arial, sans-serif', weight: '900' });
    });
    plate('mile', GRN, WHT, (x0, y0, w) => { text(x, 'MILE', x0 + w / 2, y0 + 34, 22, WHT); text(x, '42', x0 + w / 2, y0 + 82, 48, WHT, { weight: '900' }); });
    diamond('dip', (cx, cy) => text(x, 'DIP', cx, cy + 2, 32, BLK, { weight: '900' }));
    diamond('rocks', (cx, cy) => { text(x, 'FALLING', cx, cy - 10, 15, BLK, { weight: '900' }); text(x, 'ROCKS', cx, cy + 10, 17, BLK, { weight: '900' }); });
    diamond('cattle', (cx, cy) => {
      x.fillStyle = BLK;
      x.fillRect(cx - 22, cy - 8, 38, 18); x.fillRect(cx + 14, cy - 14, 12, 10);
      for (const lx of [-20, -12, 6, 13]) x.fillRect(cx + lx, cy + 8, 4, 14);
    });
    plate('chevron', YEL, BLK, (x0, y0, w, h) => {
      x.fillStyle = BLK; const cx = x0 + w / 2, cy = y0 + h / 2;
      x.beginPath(); x.moveTo(cx - 24, cy - 40); x.lineTo(cx + 20, cy); x.lineTo(cx - 24, cy + 40); x.lineTo(cx - 6, cy + 40); x.lineTo(cx + 38, cy); x.lineTo(cx - 6, cy - 40); x.fill();
    }, false);
    {
      const [x0, y0, w, h] = cell('stop');
      x.fillStyle = '#b8161e';
      x.beginPath();
      for (let k = 0; k < 8; k++) { const a = (k + 0.5) / 8 * Math.PI * 2; x.lineTo(x0 + w / 2 + Math.cos(a) * 58, y0 + h / 2 + Math.sin(a) * 58); }
      x.fill();
      text(x, 'STOP', x0 + w / 2, y0 + h / 2 + 2, 34, WHT, { weight: '900' });
      weather(x, x0 + 8, y0 + 8, w - 16, h - 16, rng, 1, true);
    }
    plate('park', BRN, '#e9dcc4', (x0, y0, w) => {
      text(x, 'RED ROCK CANYON', x0 + w / 2, y0 + 42, 30, '#efe4cc', { font: 'Georgia, serif', weight: 'bold', maxW: 220 });
      text(x, 'STATE PARK', x0 + w / 2, y0 + 80, 22, '#efe4cc', { font: 'Georgia, serif', maxW: 200 });
      text(x, 'THE RED ARCH  4 MI', x0 + w / 2, y0 + 106, 14, '#efe4cc', { maxW: 200 });
    });
    plate('ghost', BRN, '#e9dcc4', (x0, y0, w) => {
      text(x, '◄ GHOST TOWN', x0 + w / 2, y0 + 44, 30, '#efe4cc', { font: 'Georgia, serif', weight: 'bold', maxW: 220 });
      text(x, 'HISTORIC SITE · 1 MI', x0 + w / 2, y0 + 86, 18, '#efe4cc', { maxW: 210 });
    });
    plate('drylake', GRN, WHT, (x0, y0, w) => {
      text(x, 'DRY LAKE STRIP', x0 + w / 2, y0 + 44, 28, WHT, { weight: '900', maxW: 220 });
      text(x, 'LAKEBED RD ►', x0 + w / 2, y0 + 86, 22, WHT, { maxW: 210 });
    });
    plate('services', GRN, WHT, (x0, y0, w) => {
      text(x, 'NEXT SERVICES', x0 + w / 2, y0 + 44, 26, WHT, { weight: '900', maxW: 220 });
      text(x, '82 MILES', x0 + w / 2, y0 + 86, 32, WHT, { weight: '900' });
    });
    plate('lastExit', GRN, WHT, (x0, y0, w) => {
      text(x, 'END I-9', x0 + w / 2, y0 + 40, 30, WHT, { weight: '900' });
      text(x, 'ROUTE 99 · DRY WELLS', x0 + w / 2, y0 + 84, 20, WHT, { maxW: 220 });
    });
    plate('town', GRN, WHT, (x0, y0, w) => {
      text(x, 'DRY WELLS', x0 + w / 2, y0 + 44, 32, WHT, { weight: '900', maxW: 220 });
      text(x, 'POP. 41 · ELEV 2860', x0 + w / 2, y0 + 86, 20, WHT, { maxW: 210 });
    });
    plate('array', '#e8e8e2', '#2a4a8a', (x0, y0, w) => {
      text(x, 'HIGH DESERT', x0 + w / 2, y0 + 32, 24, '#2a4a8a', { weight: '900', maxW: 220 });
      text(x, 'RADIO OBSERVATORY', x0 + w / 2, y0 + 60, 18, '#2a4a8a', { weight: '900', maxW: 220 });
      x.fillStyle = '#b02818'; x.fillRect(x0 + 20, y0 + 78, w - 40, 30);
      text(x, 'RADIO QUIET ZONE · NO PHONES', x0 + w / 2, y0 + 93, 13, WHT, { weight: '900', maxW: w - 50 });
    });
    plate('restricted', WHT, '#b02818', (x0, y0, w) => {
      x.fillStyle = '#b02818'; x.fillRect(x0 + 12, y0 + 14, w - 24, 34);
      text(x, 'WARNING', x0 + w / 2, y0 + 31, 24, WHT, { weight: '900' });
      text(x, 'RESTRICTED AREA', x0 + w / 2, y0 + 66, 22, BLK, { weight: '900', maxW: 220 });
      text(x, 'USE OF DEADLY FORCE AUTHORIZED', x0 + w / 2, y0 + 96, 12, BLK, { weight: '900', maxW: 220 });
    });
    plate('mine', '#8a6a4a', '#2a1a10', (x0, y0, w) => {
      text(x, 'DANGER', x0 + w / 2, y0 + 40, 34, '#7a1a10', { weight: '900', font: 'Georgia, serif' });
      text(x, 'OLD MINE · KEEP OUT', x0 + w / 2, y0 + 84, 20, '#2a1a10', { weight: '900', maxW: 220 });
    }, true, 2);
    plate('camp', BRN, '#e9dcc4', (x0, y0, w) => {
      text(x, 'REDROCK CAMP', x0 + w / 2, y0 + 44, 28, '#efe4cc', { font: 'Georgia, serif', weight: 'bold', maxW: 220 });
      text(x, 'NO FIRES OUTSIDE RINGS', x0 + w / 2, y0 + 86, 16, '#efe4cc', { maxW: 210 });
    });
    plate('overlook', BRN, '#e9dcc4', (x0, y0, w) => {
      text(x, 'ARCH OVERLOOK', x0 + w / 2, y0 + 44, 28, '#efe4cc', { font: 'Georgia, serif', weight: 'bold', maxW: 220 });
      text(x, 'SCENIC VIEW ►', x0 + w / 2, y0 + 86, 18, '#efe4cc', { maxW: 210 });
    });
    plate('bootHill', '#7a6a58', '#2a1a10', (x0, y0, w) => {
      text(x, 'BOOT HILL', x0 + w / 2, y0 + 50, 36, '#2a1a10', { font: 'Georgia, serif', weight: 'bold', maxW: 220 });
      text(x, 'REST IN PEACE', x0 + w / 2, y0 + 92, 16, '#2a1a10', { maxW: 200 });
    }, true, 2);
    return toTex(c);
  });
}

// ------------------------------------------------------------------ ADS (billboards, 1024², 8 of 512×256)

export const ADS = 8;
export function adRect(k) { return [(k % 2) * 512, Math.floor(k / 2) * 256, 512, 256]; }

export function adsAtlas() {
  return once('ads', () => {
    const S = 1024;
    const { c, x } = cv(S, S);
    const rng = makeRng('dk-ads');
    const ad = (k, draw) => {
      const [x0, y0, w, h] = adRect(k);
      x.save(); x.beginPath(); x.rect(x0, y0, w, h); x.clip();
      draw(x0, y0, w, h);
      weather(x, x0, y0, w, h, rng, 1.8 + rng(), rng() < 0.4);
      // peeling strips
      if (rng() < 0.6) for (let i = 0; i < 4; i++) { x.fillStyle = 'rgba(232,224,206,0.92)'; x.fillRect(x0 + rng() * w, y0 + rng() * h, 10 + rng() * 40, 4 + rng() * 14); }
      x.restore();
    };
    // 0 ROCKET DINER
    ad(0, (x0, y0, w, h) => {
      const g = x.createLinearGradient(0, y0, 0, y0 + h); g.addColorStop(0, '#1b2a5a'); g.addColorStop(1, '#e86a3a');
      x.fillStyle = g; x.fillRect(x0, y0, w, h);
      // rocket
      x.save(); x.translate(x0 + 92, y0 + 128); x.rotate(-0.5);
      x.fillStyle = '#e8ecef'; x.beginPath(); x.ellipse(0, 0, 26, 78, 0, 0, 7); x.fill();
      x.fillStyle = '#d4231c'; x.beginPath(); x.moveTo(-26, 30); x.lineTo(-48, 76); x.lineTo(-12, 60); x.fill(); x.beginPath(); x.moveTo(26, 30); x.lineTo(48, 76); x.lineTo(12, 60); x.fill();
      x.fillStyle = '#5af0ff'; x.beginPath(); x.arc(0, -20, 11, 0, 7); x.fill();
      x.fillStyle = '#ffb02a'; x.beginPath(); x.moveTo(-14, 70); x.lineTo(0, 120); x.lineTo(14, 70); x.fill();
      x.restore();
      text(x, 'ROCKET DINER', x0 + 316, y0 + 62, 60, '#fff4d8', { style: 'italic', weight: '900', stroke: ['#1b1b30', 6], maxW: 340 });
      text(x, 'BLAST OFF WITH OUR PIE', x0 + 316, y0 + 126, 26, '#ffe36a', { weight: '900', maxW: 330 });
      x.fillStyle = '#d4231c'; x.fillRect(x0 + 160, y0 + 176, 330, 52);
      text(x, 'EXIT NOW · OPEN 24 HRS', x0 + 325, y0 + 202, 26, '#fff', { weight: '900', maxW: 310 });
    });
    // 1 STARLITE MOTEL
    ad(1, (x0, y0, w, h) => {
      x.fillStyle = '#2a9a98'; x.fillRect(x0, y0, w, h);
      x.fillStyle = '#f15e8a';
      x.beginPath();
      for (let k = 0; k < 10; k++) { const a = k / 10 * Math.PI * 2 - Math.PI / 2, r = k % 2 ? 30 : 74; x.lineTo(x0 + 92 + Math.cos(a) * r, y0 + 116 + Math.sin(a) * r); }
      x.fill();
      text(x, 'Starlite', x0 + 330, y0 + 70, 74, '#fff6d8', { style: 'italic', weight: '900', font: 'Georgia, serif', stroke: ['#13403f', 6], maxW: 330 });
      text(x, 'MOTEL', x0 + 330, y0 + 140, 54, '#f15e8a', { weight: '900', stroke: ['#fff', 4] });
      text(x, 'COLOR TV · POOL · VACANCY', x0 + w / 2, y0 + 212, 26, '#fff6d8', { weight: '900', maxW: 480 });
    });
    // 2 RAZOR FUEL
    ad(2, (x0, y0, w, h) => {
      const g = x.createLinearGradient(0, y0, 0, y0 + h); g.addColorStop(0, '#1d0a0a'); g.addColorStop(1, '#4a0c0c');
      x.fillStyle = g; x.fillRect(x0, y0, w, h);
      x.fillStyle = '#d4231c'; x.beginPath(); x.moveTo(x0 + 300, y0); x.lineTo(x0 + w, y0); x.lineTo(x0 + w, y0 + h); x.lineTo(x0 + 220, y0 + h); x.fill();
      text(x, 'RAZOR', x0 + 30, y0 + 76, 76, '#f4f1ea', { align: 'left', style: 'italic', weight: '900', stroke: ['#000', 5] });
      text(x, 'FUEL', x0 + 290, y0 + 76, 76, '#f2a01e', { align: 'left', style: 'italic', weight: '900', stroke: ['#000', 5] });
      text(x, 'RACE GAS · 104 OCTANE', x0 + 34, y0 + 150, 30, '#f4f1ea', { align: 'left', maxW: 440 });
      x.fillStyle = '#f2d21e'; x.fillRect(x0 + 300, y0 + 194, 196, 44);
      text(x, 'NEXT EXIT ►', x0 + 398, y0 + 216, 26, '#111', { weight: '900', maxW: 180 });
    });
    // 3 KUROSHIO TIRES
    ad(3, (x0, y0, w, h) => {
      x.fillStyle = '#101112'; x.fillRect(x0, y0, w, h);
      x.strokeStyle = '#d61f2c'; x.lineWidth = 12;
      x.beginPath(); for (let px = 0; px <= w; px += 8) x.lineTo(x0 + px, y0 + 200 + Math.sin(px / 40) * 10); x.stroke();
      x.fillStyle = '#222'; x.beginPath(); x.arc(x0 + 430, y0 + 100, 70, 0, 7); x.fill();
      x.fillStyle = '#555'; x.beginPath(); x.arc(x0 + 430, y0 + 100, 38, 0, 7); x.fill();
      text(x, 'KUROSHIO', x0 + 190, y0 + 70, 66, '#f4f4f4', { weight: '900', maxW: 340 });
      text(x, 'PERFORMANCE TIRES', x0 + 190, y0 + 124, 26, '#d61f2c', { weight: '900', maxW: 340 });
      text(x, 'GRIP IS EVERYTHING', x0 + w / 2, y0 + 236, 22, '#f4f4f4', { maxW: 400 });
    });
    // 4 BIG AL'S
    ad(4, (x0, y0, w, h) => {
      x.fillStyle = '#e8c63a'; x.fillRect(x0, y0, w, h);
      x.fillStyle = '#1a1a1a'; x.fillRect(x0, y0 + 180, w, 76);
      // a wrecked car silhouette
      x.fillStyle = '#7a3a2a'; x.beginPath(); x.moveTo(x0 + 30, y0 + 170); x.lineTo(x0 + 60, y0 + 130); x.lineTo(x0 + 150, y0 + 120); x.lineTo(x0 + 190, y0 + 150); x.lineTo(x0 + 200, y0 + 172); x.fill();
      x.fillStyle = '#111'; x.beginPath(); x.arc(x0 + 70, y0 + 172, 16, 0, 7); x.arc(x0 + 170, y0 + 172, 16, 0, 7); x.fill();
      text(x, "BIG AL'S", x0 + 350, y0 + 60, 70, '#b3261b', { weight: '900', style: 'italic', maxW: 300 });
      text(x, 'WE BUY JUNK CARS', x0 + 350, y0 + 130, 34, '#1a1a1a', { weight: '900', maxW: 300 });
      text(x, 'CASH PAID · TOWING · 2 MI', x0 + w / 2, y0 + 218, 30, '#e8c63a', { weight: '900', maxW: 460 });
    });
    // 5 RED ROCK CANYON
    ad(5, (x0, y0, w, h) => {
      const g = x.createLinearGradient(0, y0, 0, y0 + h); g.addColorStop(0, '#f0a060'); g.addColorStop(1, '#ffe0a0');
      x.fillStyle = g; x.fillRect(x0, y0, w, h);
      // the arch
      x.fillStyle = '#a0462c';
      x.beginPath(); x.moveTo(x0 + 20, y0 + h); x.lineTo(x0 + 40, y0 + 120); x.quadraticCurveTo(x0 + 140, y0 + 20, x0 + 240, y0 + 120); x.lineTo(x0 + 260, y0 + h);
      x.lineTo(x0 + 210, y0 + h); x.lineTo(x0 + 205, y0 + 140); x.quadraticCurveTo(x0 + 140, y0 + 70, x0 + 75, y0 + 140); x.lineTo(x0 + 70, y0 + h); x.fill();
      text(x, 'SEE THE', x0 + 390, y0 + 50, 30, '#5a2010', { weight: '900' });
      text(x, 'RED ARCH', x0 + 390, y0 + 104, 60, '#7a1a10', { weight: '900', font: 'Georgia, serif', maxW: 230 });
      text(x, 'RED ROCK CANYON', x0 + 390, y0 + 160, 26, '#5a2010', { weight: '900', maxW: 230 });
      text(x, 'STATE PARK · NEXT LEFT', x0 + 390, y0 + 210, 20, '#5a2010', { weight: '900', maxW: 230 });
    });
    // 6 DRY LAKE DRAGS
    ad(6, (x0, y0, w, h) => {
      x.fillStyle = '#141416'; x.fillRect(x0, y0, w, h);
      for (let i = 0; i < 16; i++) for (let j = 0; j < 4; j++) { x.fillStyle = (i + j) % 2 ? '#eee' : '#111'; x.fillRect(x0 + i * 32, y0 + h - 64 + j * 16, 32, 16); }
      text(x, 'DRY LAKE', x0 + w / 2, y0 + 58, 72, '#f2a01e', { style: 'italic', weight: '900', stroke: ['#000', 6], maxW: 470 });
      text(x, 'DRAGS', x0 + w / 2, y0 + 128, 62, '#f4f1ea', { style: 'italic', weight: '900', maxW: 470 });
      text(x, 'SATURDAY NIGHT · 1/4 MILE', x0 + w / 2, y0 + 176, 24, '#d4231c', { weight: '900', maxW: 470 });
    });
    // 7 LAST CHANCE SALOON / GHOST TOWN
    ad(7, (x0, y0, w, h) => {
      x.fillStyle = '#d9c39a'; x.fillRect(x0, y0, w, h);
      x.strokeStyle = '#5a3a24'; x.lineWidth = 10; x.strokeRect(x0 + 10, y0 + 10, w - 20, h - 20);
      text(x, 'VISIT A REAL', x0 + w / 2, y0 + 48, 30, '#5a3a24', { font: 'Georgia, serif', weight: 'bold' });
      text(x, 'GHOST TOWN', x0 + w / 2, y0 + 110, 76, '#3a1a10', { font: 'Georgia, serif', weight: 'bold', maxW: 460 });
      text(x, 'LAST CHANCE SALOON · BOOT HILL', x0 + w / 2, y0 + 172, 22, '#5a3a24', { weight: '900', maxW: 450 });
      text(x, 'IF YOU DARE · NEXT RIGHT', x0 + w / 2, y0 + 210, 22, '#7a1a10', { weight: '900', maxW: 450 });
    });
    return toTex(c);
  });
}

// ------------------------------------------------------------------ STRATA (layered sandstone, 512²)

/** Banded sandstone: u along the face, v up (one tile = 16 m tall, 16 m along). Tinted by vertex colour. */
export function strataTexture() {
  return once('strata', () => {
    const S = 512;
    const { c, x } = cv(S, S);
    const rng = makeRng('dk-strata');
    x.fillStyle = '#e4d6c8'; x.fillRect(0, 0, S, S);
    let y = 0;
    while (y < S) {
      const h = 8 + rng() * 34, v = 186 + rng() * 64;
      x.fillStyle = `rgb(${v},${v * 0.93},${v * 0.86})`;
      x.fillRect(0, y, S, h);
      // a darker parting line at the top of each bed
      x.fillStyle = `rgba(60,30,20,${0.18 + rng() * 0.3})`;
      x.fillRect(0, y, S, 1.5 + rng() * 2);
      // cross-bedding
      x.strokeStyle = 'rgba(90,50,40,0.13)'; x.lineWidth = 1;
      for (let k = 0; k < 7; k++) { const x0 = rng() * S; x.beginPath(); x.moveTo(x0, y); x.lineTo(x0 + h * 2.6, y + h); x.stroke(); }
      y += h;
    }
    // vertical joints and cracks
    for (let i = 0; i < 30; i++) {
      let px = rng() * S, py = rng() * S;
      x.strokeStyle = `rgba(40,20,14,${0.2 + rng() * 0.3})`; x.lineWidth = 0.8 + rng() * 1.6;
      x.beginPath(); x.moveTo(px, py);
      for (let k = 0; k < 8; k++) { px += (rng() - 0.5) * 8; py += 6 + rng() * 14; x.lineTo(px, py); }
      x.stroke();
    }
    // desert varnish streaking down from ledges
    for (let i = 0; i < 46; i++) {
      const px = rng() * S, w = 3 + rng() * 16, py = rng() * S * 0.8, len = 50 + rng() * 220;
      const g = x.createLinearGradient(0, py, 0, py + len);
      g.addColorStop(0, 'rgba(40,22,18,0.3)'); g.addColorStop(1, 'rgba(40,22,18,0)');
      x.fillStyle = g; x.fillRect(px, py, w, len);
    }
    const img = x.getImageData(0, 0, S, S), d = img.data;
    for (let k = 0; k < d.length; k += 4) { const n = (rng() - 0.5) * 20; d[k] += n; d[k + 1] += n; d[k + 2] += n; }
    x.putImageData(img, 0, 0);
    return toTex(c);
  });
}

// ------------------------------------------------------------------ FOLIAGE (512², 4 cells of 256)

/** Shrub cells: 0 creosote, 1 bursage/saltbush, 2 dry bunchgrass, 3 sage/rabbitbrush. */
export function foliageTexture() {
  return once('foliage', () => {
    const S = 512;
    const { c, x } = cv(S, S);
    const rng = makeRng('dk-foliage');
    x.clearRect(0, 0, S, S);
    const cell = (k) => [(k % 2) * 256, Math.floor(k / 2) * 256];
    // 0 creosote: a vase of thin stems, sparse olive leaves
    {
      const [ox, oy] = cell(0);
      x.save(); x.beginPath(); x.rect(ox, oy, 256, 256); x.clip();
      for (let t = 0; t < 16; t++) {
        const a = Math.PI / 2 + (t / 15 - 0.5) * 1.9 + (rng() - 0.5) * 0.2, len = 120 + rng() * 110;
        const bx = ox + 128 + (rng() - 0.5) * 16, by = oy + 254, bend = (rng() - 0.5) * 0.5;
        const pts = [];
        for (let q = 0; q <= 8; q++) { const f = q / 8, aa = a + bend * f; pts.push([bx + Math.cos(aa) * len * f, by - Math.sin(aa) * len * f]); }
        x.strokeStyle = '#5e4e3c'; x.lineWidth = 2.4;
        x.beginPath(); pts.forEach(([px, py], q) => (q ? x.lineTo(px, py) : x.moveTo(px, py))); x.stroke();
        for (let q = 3; q <= 8; q++) {
          const [px, py] = pts[q];
          for (let m = 0; m < 5; m++) {
            x.fillStyle = rng() < 0.45 ? '#66693f' : rng() < 0.5 ? '#7a7a4e' : '#535a33';
            x.beginPath(); x.ellipse(px + (rng() - 0.5) * 24, py + (rng() - 0.5) * 18, 3 + rng() * 2.5, 2 + rng() * 1.4, rng() * 3, 0, 7); x.fill();
          }
        }
      }
      x.restore();
    }
    // 1 bursage: low silver-grey dome of twigs
    {
      const [ox, oy] = cell(1);
      x.save(); x.beginPath(); x.rect(ox, oy, 256, 256); x.clip();
      for (let t = 0; t < 420; t++) {
        const a = Math.PI * (0.05 + rng() * 0.9), r = Math.sqrt(rng());
        const px = ox + 128 + Math.cos(a) * r * 118, py = oy + 252 - Math.sin(a) * r * 150;
        x.fillStyle = rng() < 0.5 ? '#9a9a7a' : rng() < 0.5 ? '#b4b08c' : '#7d7a60';
        x.beginPath(); x.arc(px, py, 2.5 + rng() * 4, 0, 7); x.fill();
      }
      x.strokeStyle = '#6a5a46'; x.lineWidth = 2;
      for (let t = 0; t < 14; t++) { x.beginPath(); x.moveTo(ox + 128 + (rng() - 0.5) * 30, oy + 254); x.lineTo(ox + 128 + (rng() - 0.5) * 200, oy + 254 - rng() * 120); x.stroke(); }
      x.restore();
    }
    // 2 dry bunchgrass
    {
      const [ox, oy] = cell(2);
      for (let t = 0; t < 80; t++) {
        const bx = ox + 128 + (rng() - 0.5) * 60, a = Math.PI / 2 + (rng() - 0.5) * 1.4, len = 60 + rng() * 130;
        x.strokeStyle = rng() < 0.5 ? '#c9b07a' : rng() < 0.5 ? '#a8925e' : '#d8c494';
        x.lineWidth = 1.5 + rng() * 1.5;
        x.beginPath(); x.moveTo(bx, oy + 254);
        x.quadraticCurveTo(bx + Math.cos(a) * len * 0.5, oy + 254 - Math.sin(a) * len * 0.6, bx + Math.cos(a) * len * 0.9 + (rng() - 0.5) * 20, oy + 254 - Math.sin(a) * len);
        x.stroke();
      }
    }
    // 3 sage / rabbitbrush: grey-green feathery clump, yellow tips
    {
      const [ox, oy] = cell(3);
      x.save(); x.beginPath(); x.rect(ox, oy, 256, 256); x.clip();
      for (let t = 0; t < 26; t++) {
        const a = Math.PI / 2 + (rng() - 0.5) * 1.6, len = 80 + rng() * 130;
        const bx = ox + 128 + (rng() - 0.5) * 30, by = oy + 254;
        const ex = bx + Math.cos(a) * len, ey = by - Math.sin(a) * len;
        x.strokeStyle = '#7a7058'; x.lineWidth = 1.8;
        x.beginPath(); x.moveTo(bx, by); x.lineTo(ex, ey); x.stroke();
        for (let m = 0; m < 14; m++) {
          const f = 0.4 + rng() * 0.6;
          x.fillStyle = rng() < 0.6 ? '#8f9a78' : '#a8ae8c';
          x.beginPath(); x.ellipse(bx + (ex - bx) * f + (rng() - 0.5) * 16, by + (ey - by) * f + (rng() - 0.5) * 10, 4, 2.4, rng() * 3, 0, 7); x.fill();
        }
        x.fillStyle = '#d8c050'; x.beginPath(); x.arc(ex, ey, 3 + rng() * 3, 0, 7); x.fill();
      }
      x.restore();
    }
    const t = toTex(c);
    t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
    return t;
  });
}

// ------------------------------------------------------------------ TIN (corrugated, 256²: 4 m wide, 4 m tall)

export function tinTexture() {
  return once('tin', () => {
    const S = 256;
    const { c, x } = cv(S, S);
    const rng = makeRng('dk-tin');
    for (let px = 0; px < S; px++) {
      const v = 170 + Math.sin(px / S * Math.PI * 2 * 24) * 40;
      x.fillStyle = `rgb(${v},${v},${v * 0.98})`;
      x.fillRect(px, 0, 1, S);
    }
    // sheet laps and rust
    for (const py of [0, 128]) { x.fillStyle = 'rgba(40,30,20,0.35)'; x.fillRect(0, py, S, 3); }
    for (let i = 0; i < 26; i++) {
      const px = rng() * S, py = rng() * S, w = 8 + rng() * 40, h = 20 + rng() * 120;
      const g = x.createLinearGradient(0, py, 0, py + h);
      g.addColorStop(0, `rgba(${120 + rng() * 40},${50 + rng() * 20},20,${0.3 + rng() * 0.4})`);
      g.addColorStop(1, 'rgba(120,50,20,0)');
      x.fillStyle = g; x.fillRect(px, py, w, h);
    }
    grain(x, 0, 0, S, S, rng, 0.5, 0.25);
    return toTex(c);
  });
}

// ------------------------------------------------------------------ DRIFT (soft sand / rubber, 256² alpha)

export function driftTexture() {
  return once('drift', () => {
    const S = 256;
    const { c, x } = cv(S, S);
    const rng = makeRng('dk-drift');
    x.clearRect(0, 0, S, S);
    for (let i = 0; i < 80; i++) {
      const px = 20 + rng() * (S - 40), py = 30 + rng() * (S - 60), rx = 12 + rng() * 50, ry = 3 + rng() * 12;
      const g = x.createRadialGradient(px, py, 0, px, py, rx);
      g.addColorStop(0, `rgba(255,255,255,${0.3 + rng() * 0.45})`);
      g.addColorStop(1, 'rgba(255,255,255,0)');
      x.fillStyle = g;
      x.save(); x.translate(px, py); x.scale(1, ry / rx); x.translate(-px, -py);
      x.fillRect(px - rx, py - rx, rx * 2, rx * 2);
      x.restore();
    }
    // fade the tile's edges out
    const img = x.getImageData(0, 0, S, S), d = img.data;
    for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) {
      const e = Math.min(i, S - 1 - i, j, S - 1 - j) / 24;
      if (e < 1) d[(j * S + i) * 4 + 3] *= Math.max(0, e);
    }
    x.putImageData(img, 0, 0);
    const t = toTex(c);
    t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
    return t;
  });
}

// ------------------------------------------------------------------ STUCCO (256², white, tinted)

export function stuccoTexture() {
  return once('stucco', () => {
    const S = 256;
    const { c, x } = cv(S, S);
    const rng = makeRng('dk-stucco');
    x.fillStyle = '#e8e4dc'; x.fillRect(0, 0, S, S);
    for (let i = 0; i < 5000; i++) {
      const v = 200 + rng() * 55;
      x.fillStyle = `rgba(${v},${v},${v * 0.97},0.5)`;
      x.fillRect(rng() * S, rng() * S, 1 + rng() * 2, 1 + rng() * 2);
    }
    for (let i = 0; i < 14; i++) {
      const px = rng() * S, py = rng() * S, r = 10 + rng() * 40;
      const g = x.createRadialGradient(px, py, 0, px, py, r);
      g.addColorStop(0, 'rgba(120,100,80,0.10)'); g.addColorStop(1, 'rgba(120,100,80,0)');
      x.fillStyle = g; x.fillRect(px - r, py - r, r * 2, r * 2);
    }
    // grime at the foot (v 0 is the bottom: canvas bottom rows)
    const g = x.createLinearGradient(0, S, 0, S - 60);
    g.addColorStop(0, 'rgba(110,90,70,0.35)'); g.addColorStop(1, 'rgba(110,90,70,0)');
    x.fillStyle = g; x.fillRect(0, S - 60, S, 60);
    return toTex(c);
  });
}

// ------------------------------------------------------------------ WOOD (weathered vertical boards, 256×512: 2 m × 4 m)

export function woodTexture() {
  return once('wood', () => {
    const W = 256, H = 512;
    const { c, x } = cv(W, H);
    const rng = makeRng('dk-wood');
    let px = 0;
    while (px < W) {
      const bw = 20 + Math.floor(rng() * 12);
      const t = 170 + rng() * 50;
      x.fillStyle = `rgb(${t},${t * 0.93},${t * 0.84})`;
      x.fillRect(px, 0, bw, H);
      // grain streaks
      for (let k = 0; k < 40; k++) {
        x.fillStyle = `rgba(${rng() < 0.5 ? '70,55,40' : '235,225,210'},${rng() * 0.25})`;
        x.fillRect(px + rng() * bw, rng() * H, 1, 20 + rng() * 120);
      }
      // knots, nail heads at the rails
      if (rng() < 0.6) { x.fillStyle = 'rgba(60,40,28,0.55)'; x.beginPath(); x.ellipse(px + bw / 2, rng() * H, 3, 6, 0, 0, 7); x.fill(); }
      for (const ny of [60, 300]) { x.fillStyle = 'rgba(40,25,15,0.8)'; x.fillRect(px + 4, ny, 3, 3); x.fillRect(px + bw - 7, ny, 3, 3); }
      // gap
      x.fillStyle = 'rgba(20,14,10,0.9)'; x.fillRect(px + bw - 2, 0, 2, H);
      // split ends at the bottom
      if (rng() < 0.4) { x.fillStyle = 'rgba(20,14,10,0.7)'; x.fillRect(px + 3 + rng() * (bw - 8), H - 40 - rng() * 60, 1.5, 60); }
      px += bw;
    }
    const g = x.createLinearGradient(0, H, 0, H - 120);
    g.addColorStop(0, 'rgba(80,60,40,0.45)'); g.addColorStop(1, 'rgba(80,60,40,0)');
    x.fillStyle = g; x.fillRect(0, H - 120, W, 120);
    return toTex(c);
  });
}

// ------------------------------------------------------------------ GHOST TOWN signs (1024×512 + emissive)

/** Painted signboards and windows for the ghost town. */
export const RG = {
  saloon: [0, 0, 512, 128], store: [512, 0, 512, 96], hotel: [512, 96, 512, 96],
  sheriff: [0, 128, 256, 64], bank: [256, 128, 256, 64], assay: [0, 192, 256, 64], livery: [256, 192, 256, 64],
  barber: [512, 192, 256, 64], undertaker: [768, 192, 256, 64], post: [0, 256, 256, 64], smith: [256, 256, 256, 64],
  winDark: [512, 256, 128, 128], winBroken: [640, 256, 128, 128], winBoard: [768, 256, 128, 128], winLit: [896, 256, 128, 128],
  doors: [0, 320, 128, 192], doorPlain: [128, 320, 128, 192], wanted: [256, 320, 96, 128], church: [352, 320, 160, 192],
  mineCo: [512, 384, 512, 128],
};

export function ghostAtlas() {
  return once('ghost', () => {
    const W = 1024, H = 512;
    const A = cv(W, H), E = cv(W, H);
    const x = A.x, e = E.x;
    const rng = makeRng('dk-ghost');
    x.fillStyle = '#6a5a48'; x.fillRect(0, 0, W, H);
    e.fillStyle = '#000'; e.fillRect(0, 0, W, H);
    const board = (r, bg, fg, str, size, o = {}) => {
      const [x0, y0, w, h] = r;
      x.fillStyle = bg; x.fillRect(x0 + 2, y0 + 2, w - 4, h - 4);
      // plank seams
      for (let py = y0 + 2 + h / 3; py < y0 + h - 4; py += h / 3) { x.fillStyle = 'rgba(30,20,10,0.4)'; x.fillRect(x0 + 2, py, w - 4, 2); }
      x.strokeStyle = fg; x.lineWidth = 3; x.strokeRect(x0 + 8, y0 + 8, w - 16, h - 16);
      text(x, str, x0 + w / 2, y0 + h / 2 + (o.dy || 0), size, fg, { font: o.font || 'Georgia, "Times New Roman", serif', weight: 'bold', maxW: w - 30 });
      if (o.sub) text(x, o.sub, x0 + w / 2, y0 + h - 18, 16, fg, { font: 'Georgia, serif', maxW: w - 40 });
      weather(x, x0, y0, w, h, rng, 2.2, rng() < 0.5);
      // flaking paint
      for (let i = 0; i < 30; i++) { x.fillStyle = `rgba(${bg === '#2a2a26' ? '120,110,96' : '90,72,56'},${0.3 + rng() * 0.5})`; x.fillRect(x0 + rng() * w, y0 + rng() * h, 3 + rng() * 14, 2 + rng() * 5); }
    };
    board(RG.saloon, '#2a2a26', '#e8d8a8', 'LAST CHANCE SALOON', 52, { dy: -10, sub: 'WHISKEY · CARDS · ROOMS' });
    board(RG.store, '#d8ccb0', '#3a2a1a', 'GENERAL STORE', 48);
    board(RG.hotel, '#7a2a20', '#efe0c0', 'GRAND HOTEL', 48);
    board(RG.sheriff, '#d8ccb0', '#2a1a10', 'SHERIFF', 36);
    board(RG.bank, '#2a3a2a', '#e8d8a8', 'BANK', 38);
    board(RG.assay, '#d8ccb0', '#3a2a1a', 'ASSAY OFFICE', 30);
    board(RG.livery, '#7a5a3a', '#efe0c0', 'LIVERY STABLE', 30);
    board(RG.barber, '#efe8d8', '#7a1a10', 'BARBER', 34);
    board(RG.undertaker, '#2a2a26', '#d8d0c0', 'UNDERTAKER', 32);
    board(RG.post, '#d8ccb0', '#2a3a6a', 'POST OFFICE', 30);
    board(RG.smith, '#5a4a3a', '#efe0c0', 'BLACKSMITH', 30);
    board(RG.mineCo, '#3a2a1a', '#e8c890', 'SILVER QUEEN MINING CO.', 40, { dy: -8, sub: 'EST. 1879' });
    // windows: dark, broken, boarded, lit (faint candle)
    const win = (r, kind) => {
      const [x0, y0, w, h] = r;
      x.fillStyle = '#5a4a38'; x.fillRect(x0, y0, w, h);
      const wx = x0 + 18, wy = y0 + 12, ww = w - 36, wh = h - 24;
      x.fillStyle = kind === 'lit' ? '#c88a40' : '#16130f'; x.fillRect(wx, wy, ww, wh);
      if (kind === 'lit') {
        const g = e.createRadialGradient(wx + ww / 2, wy + wh * 0.6, 4, wx + ww / 2, wy + wh * 0.6, ww * 0.7);
        g.addColorStop(0, '#ffb050'); g.addColorStop(1, '#4a2008');
        e.fillStyle = g; e.fillRect(wx, wy, ww, wh);
      }
      if (kind === 'broken') {
        x.fillStyle = 'rgba(160,170,170,0.35)';
        x.beginPath(); x.moveTo(wx, wy); x.lineTo(wx + ww * 0.6, wy); x.lineTo(wx + ww * 0.2, wy + wh * 0.5); x.fill();
        x.beginPath(); x.moveTo(wx + ww, wy + wh); x.lineTo(wx + ww * 0.5, wy + wh); x.lineTo(wx + ww, wy + wh * 0.4); x.fill();
      } else if (kind === 'dark') {
        x.fillStyle = 'rgba(120,130,130,0.18)'; x.fillRect(wx + 6, wy + 6, ww * 0.3, wh - 12);
      }
      x.fillStyle = '#3a2c20';
      x.fillRect(wx + ww / 2 - 3, wy, 6, wh); x.fillRect(wx, wy + wh / 2 - 3, ww, 6);
      x.fillRect(x0 + 12, y0 + 6, w - 24, 6); x.fillRect(x0 + 12, y0 + h - 12, w - 24, 6);
      if (kind === 'board') {
        for (let k = 0; k < 3; k++) {
          x.save(); x.translate(x0 + w / 2, y0 + 30 + k * 34); x.rotate((rng() - 0.5) * 0.4);
          x.fillStyle = `rgb(${150 + rng() * 40},${130 + rng() * 30},${100 + rng() * 30})`; x.fillRect(-w / 2 + 6, -9, w - 12, 18);
          x.fillStyle = '#2a1a10'; x.fillRect(-w / 2 + 12, -2, 3, 3); x.fillRect(w / 2 - 15, -2, 3, 3);
          x.restore();
        }
      }
      weather(x, x0, y0, w, h, rng, 1.2);
    };
    win(RG.winDark, 'dark'); win(RG.winBroken, 'broken'); win(RG.winBoard, 'board'); win(RG.winLit, 'lit');
    // saloon batwing doors
    {
      const [x0, y0, w, h] = RG.doors;
      x.fillStyle = '#100c08'; x.fillRect(x0, y0, w, h);
      x.fillStyle = '#7a5a3a';
      x.fillRect(x0 + 8, y0 + 60, w / 2 - 10, 80); x.fillRect(x0 + w / 2 + 2, y0 + 60, w / 2 - 10, 80);
      x.fillStyle = '#5a3a24';
      for (let k = 0; k < 4; k++) { x.fillRect(x0 + 14 + k * 12, y0 + 70, 6, 60); x.fillRect(x0 + w / 2 + 8 + k * 12, y0 + 70, 6, 60); }
      const g = e.createLinearGradient(0, y0, 0, y0 + h);
      g.addColorStop(0, '#3a1a06'); g.addColorStop(1, '#000');
      e.fillStyle = g; e.fillRect(x0, y0, w, 58);
    }
    {
      const [x0, y0, w, h] = RG.doorPlain;
      x.fillStyle = '#4a3a2a'; x.fillRect(x0, y0, w, h);
      x.fillStyle = '#6a5440'; x.fillRect(x0 + 14, y0 + 12, w - 28, h - 12);
      x.strokeStyle = '#3a2a1c'; x.lineWidth = 3;
      x.strokeRect(x0 + 24, y0 + 24, w - 48, 60); x.strokeRect(x0 + 24, y0 + 100, w - 48, 70);
      x.fillStyle = '#a08050'; x.beginPath(); x.arc(x0 + w - 32, y0 + 100, 4, 0, 7); x.fill();
      weather(x, x0, y0, w, h, rng, 1.5);
    }
    {
      const [x0, y0, w, h] = RG.wanted;
      x.fillStyle = '#e8dcc0'; x.fillRect(x0 + 6, y0 + 6, w - 12, h - 12);
      text(x, 'WANTED', x0 + w / 2, y0 + 22, 16, '#2a1a10', { font: 'Georgia, serif', weight: 'bold' });
      x.fillStyle = '#6a5a48'; x.fillRect(x0 + 24, y0 + 34, w - 48, 52);
      text(x, '$500', x0 + w / 2, y0 + 104, 18, '#2a1a10', { font: 'Georgia, serif', weight: 'bold' });
      weather(x, x0, y0, w, h, rng, 1.5);
    }
    // church: arched window with a faint cold glow
    {
      const [x0, y0, w, h] = RG.church;
      x.fillStyle = '#d8d0c0'; x.fillRect(x0, y0, w, h);
      x.fillStyle = '#1a2028';
      x.beginPath(); x.moveTo(x0 + 40, y0 + h - 20); x.lineTo(x0 + 40, y0 + 80); x.arc(x0 + w / 2, y0 + 80, w / 2 - 40, Math.PI, 0); x.lineTo(x0 + w - 40, y0 + h - 20); x.fill();
      e.fillStyle = '#183040';
      e.beginPath(); e.moveTo(x0 + 40, y0 + h - 20); e.lineTo(x0 + 40, y0 + 80); e.arc(x0 + w / 2, y0 + 80, w / 2 - 40, Math.PI, 0); e.lineTo(x0 + w - 40, y0 + h - 20); e.fill();
      x.fillStyle = '#d8d0c0'; x.fillRect(x0 + w / 2 - 3, y0 + 40, 6, h - 60); x.fillRect(x0 + 40, y0 + 110, w - 80, 6);
      weather(x, x0, y0, w, h, rng, 1.6);
    }
    return { map: toTex(A.c), emi: toTex(E.c) };
  });
}

// ------------------------------------------------------------------ DRAG STRIP (1024² + emissive)

export const RD = {
  banner: [0, 0, 1024, 128], finish: [0, 128, 1024, 128],
  boardL: [0, 256, 512, 256], boardR: [512, 256, 512, 256],
  towerWin: [0, 512, 512, 128], towerSign: [512, 512, 512, 128],
  d60: [0, 640, 256, 128], d330: [256, 640, 256, 128], d660: [512, 640, 256, 128], d1000: [768, 640, 256, 128],
  d1320: [0, 768, 256, 128], sponsorA: [256, 768, 384, 128], sponsorB: [640, 768, 384, 128],
  tree: [0, 896, 128, 128], wall: [128, 896, 512, 128], tent: [640, 896, 384, 128],
};

export function dragAtlas() {
  return once('drag', () => {
    const S = 1024;
    const A = cv(S, S), E = cv(S, S);
    const x = A.x, e = E.x;
    const rng = makeRng('dk-drag');
    x.fillStyle = '#222'; x.fillRect(0, 0, S, S);
    e.fillStyle = '#000'; e.fillRect(0, 0, S, S);
    {
      const [x0, y0, w, h] = RD.banner;
      x.fillStyle = '#141416'; x.fillRect(x0, y0, w, h);
      x.fillStyle = '#d4231c'; x.fillRect(x0, y0, w, 14); x.fillRect(x0, y0 + h - 14, w, 14);
      text(x, 'DRY LAKE STRIP', x0 + w / 2, y0 + 66, 78, '#f4f1ea', { style: 'italic', weight: '900', maxW: 700 });
      text(x, 'EST. 1958', x0 + 110, y0 + 66, 26, '#f2a01e', { weight: '900' });
      text(x, '1/4 MILE', x0 + 920, y0 + 66, 30, '#f2a01e', { weight: '900' });
      e.fillStyle = 'rgba(255,240,220,0.08)'; e.fillRect(x0, y0 + 14, w, h - 28);
      text(e, 'DRY LAKE STRIP', x0 + w / 2, y0 + 66, 78, '#a09890', { style: 'italic', weight: '900', maxW: 700 });
      weather(x, x0, y0, w, h, rng, 0.8);
    }
    {
      const [x0, y0, w, h] = RD.finish;
      for (let i = 0; i < 64; i++) for (let j = 0; j < 8; j++) { x.fillStyle = (i + j) % 2 ? '#111' : '#eee'; x.fillRect(x0 + i * 16, y0 + j * 16, 16, 16); }
      x.fillStyle = '#f4f1ea'; x.fillRect(x0 + 312, y0 + 12, 400, 104);
      text(x, 'FINISH', x0 + w / 2, y0 + 66, 84, '#111', { weight: '900' });
      e.fillStyle = 'rgba(255,255,255,0.12)'; e.fillRect(x0, y0, w, h);
    }
    const board = (r, lane, et, mph) => {
      const [x0, y0, w, h] = r;
      x.fillStyle = '#0c0c0e'; x.fillRect(x0, y0, w, h);
      x.strokeStyle = '#f2a01e'; x.lineWidth = 6; x.strokeRect(x0 + 8, y0 + 8, w - 16, h - 16);
      text(x, lane, x0 + w / 2, y0 + 40, 30, '#f4f1ea', { weight: '900' });
      text(e, lane, x0 + w / 2, y0 + 40, 30, '#8a7050', { weight: '900' });
      for (const [str, py, sz] of [[et, 114, 84], [mph, 206, 70]]) {
        text(x, str, x0 + w / 2, y0 + py, sz, '#ff8a1e', { font: 'Courier New, monospace', weight: '900' });
        text(e, str, x0 + w / 2, y0 + py, sz, '#ff8a1e', { font: 'Courier New, monospace', weight: '900', glow: '#ff6a00', blur: 12 });
      }
    };
    board(RD.boardL, 'LEFT LANE', '8.912', '156.43');
    board(RD.boardR, 'RIGHT LANE', '9.047', '151.80');
    {
      const [x0, y0, w, h] = RD.towerWin;
      x.fillStyle = '#d8d2c4'; x.fillRect(x0, y0, w, h);
      for (let k = 0; k < 4; k++) {
        const wx = x0 + 10 + k * 125;
        const g = x.createLinearGradient(0, y0 + 14, 0, y0 + 110);
        g.addColorStop(0, '#2a3a48'); g.addColorStop(1, '#5a7088');
        x.fillStyle = g; x.fillRect(wx, y0 + 14, 116, 96);
        e.fillStyle = k === 2 ? '#305060' : '#c8a060'; e.fillRect(wx, y0 + 14, 116, 96);
        x.fillStyle = 'rgba(30,20,10,0.6)'; x.beginPath(); x.arc(wx + 40 + rng() * 40, y0 + 70, 12, 0, 7); x.fill(); x.fillRect(wx + 30 + rng() * 40, y0 + 80, 26, 30);
        x.fillStyle = 'rgba(255,255,255,0.15)'; x.fillRect(wx + 10, y0 + 14, 20, 96);
      }
    }
    {
      const [x0, y0, w, h] = RD.towerSign;
      x.fillStyle = '#9e2a22'; x.fillRect(x0, y0, w, h);
      text(x, 'TIMING · TOWER', x0 + w / 2, y0 + 44, 44, '#f4f1ea', { weight: '900', maxW: w - 40 });
      text(x, 'NO PIT ACCESS · CREW ONLY', x0 + w / 2, y0 + 96, 26, '#f2d21e', { weight: '900', maxW: w - 40 });
      text(e, 'TIMING · TOWER', x0 + w / 2, y0 + 44, 44, '#ffd8c8', { weight: '900', maxW: w - 40, glow: '#ff6040', blur: 8 });
    }
    const dist = (r, big, small) => {
      const [x0, y0, w, h] = r;
      x.fillStyle = '#f4f1ea'; x.fillRect(x0 + 4, y0 + 4, w - 8, h - 8);
      x.fillStyle = '#141416'; x.fillRect(x0 + 10, y0 + 10, w - 20, h - 20);
      text(x, big, x0 + w / 2, y0 + 56, 58, '#f2a01e', { weight: '900', maxW: w - 30 });
      text(x, small, x0 + w / 2, y0 + 104, 22, '#f4f1ea', { weight: '900', maxW: w - 30 });
      text(e, big, x0 + w / 2, y0 + 56, 58, '#f2a01e', { weight: '900', maxW: w - 30, glow: '#f28000', blur: 6 });
    };
    dist(RD.d60, '60 FT', 'REACTION');
    dist(RD.d330, '330 FT', 'INCREMENT');
    dist(RD.d660, '1/8', 'MILE · 660 FT');
    dist(RD.d1000, '1000 FT', 'INCREMENT');
    dist(RD.d1320, '1/4', 'MILE · FINISH');
    {
      const [x0, y0, w, h] = RD.sponsorA;
      x.fillStyle = '#d4231c'; x.fillRect(x0, y0, w, h);
      text(x, 'RAZOR', x0 + 120, y0 + 64, 60, '#fff', { style: 'italic', weight: '900' });
      text(x, 'FUEL', x0 + 286, y0 + 64, 60, '#141414', { style: 'italic', weight: '900' });
      weather(x, x0, y0, w, h, rng, 0.7);
    }
    {
      const [x0, y0, w, h] = RD.sponsorB;
      x.fillStyle = '#101112'; x.fillRect(x0, y0, w, h);
      text(x, 'KUROSHIO', x0 + w / 2, y0 + 54, 58, '#f4f4f4', { weight: '900', maxW: w - 30 });
      text(x, 'PERFORMANCE TIRES', x0 + w / 2, y0 + 100, 22, '#d61f2c', { weight: '900' });
      weather(x, x0, y0, w, h, rng, 0.7);
    }
    {
      const [x0, y0, w, h] = RD.tree;
      x.fillStyle = '#121214'; x.fillRect(x0, y0, w, h);
      x.fillStyle = '#2a2a2c';
      for (let k = 0; k < 7; k++) { x.beginPath(); x.arc(x0 + 40, y0 + 12 + k * 16, 6, 0, 7); x.arc(x0 + 88, y0 + 12 + k * 16, 6, 0, 7); x.fill(); }
    }
    {
      const [x0, y0, w, h] = RD.wall;
      for (let k = 0; k < 8; k++) { x.fillStyle = k % 2 ? '#d4231c' : '#f2efe8'; x.fillRect(x0 + k * 64, y0, 64, h); }
      text(x, 'DRY LAKE STRIP', x0 + w / 2, y0 + h / 2, 40, '#141416', { weight: '900', style: 'italic', maxW: w - 40 });
      weather(x, x0, y0, w, h, rng, 1.2);
    }
    {
      const [x0, y0, w, h] = RD.tent;
      for (let k = 0; k < 6; k++) { x.fillStyle = k % 2 ? '#f2efe8' : '#2a5ad2'; x.fillRect(x0 + k * 64, y0, 64, h); }
      text(x, 'PIT 7', x0 + w / 2, y0 + h / 2, 50, '#141416', { weight: '900' });
    }
    return { map: toTex(A.c), emi: toTex(E.c) };
  });
}
