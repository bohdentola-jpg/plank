// THE WORKS and EASTSIDE — the canvas textures (drawn once, at load, when a
// pack warms its materials). Facades are tile atlases (one wall bay a tile,
// see atlas.js) painted in neutral tones where a building's own colour is
// a vertex tint; signs, ghost signs and graffiti are named rectangles of a
// sign atlas with an emissive twin for what lights up at night.
import { makeRng } from '../../../core/util.js';
import { toTex } from '../../../track/textures.js';
import { BRICK, BK, METAL, MT, WSIGN } from './atlas.js';

const cache = new Map();
export const once = (k, f) => { if (!cache.has(k)) cache.set(k, f()); return cache.get(k); };
export function cnv(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }

// ------------------------------------------------------------------ helpers

export function speckle(x, x0, y0, w, h, rng, n, a = 0.2, size = 1, light = '255,255,255', dark = '0,0,0') {
  for (let i = 0; i < n; i++) {
    x.fillStyle = `rgba(${rng() < 0.5 ? light : dark},${rng() * a})`;
    x.fillRect(x0 + rng() * w, y0 + rng() * h, size, size);
  }
}
export function blot(x, px, py, r, rgba0, rgba1 = 'rgba(0,0,0,0)') {
  const g = x.createRadialGradient(px, py, 0, px, py, r);
  g.addColorStop(0, rgba0);
  g.addColorStop(1, rgba1);
  x.fillStyle = g;
  x.fillRect(px - r, py - r, r * 2, r * 2);
}
/** Streaks running down from the top of a rect (rain, rust, soot). */
export function streaks(x, x0, y0, w, h, rng, n, color, a = 0.25) {
  for (let i = 0; i < n; i++) {
    const sx = x0 + rng() * w, sw = 1 + rng() * 4, sh = h * (0.2 + rng() * 0.8);
    const sy = y0 + rng() * h * 0.3;
    const g = x.createLinearGradient(0, sy, 0, sy + sh);
    g.addColorStop(0, `rgba(${color},${a})`);
    g.addColorStop(1, `rgba(${color},0)`);
    x.fillStyle = g;
    x.fillRect(sx, sy, sw, sh);
  }
}
export const pick = (rng, a) => a[Math.floor(rng() * a.length) % a.length];
/** A neon colour's hot core: halfway to white. */
export function lighten(hex) {
  const v = parseInt(hex.slice(1), 16);
  const f = (c) => Math.round(c + (255 - c) * 0.5);
  return `rgb(${f((v >> 16) & 255)},${f((v >> 8) & 255)},${f(v & 255)})`;
}

/** Running-bond brick over a rect (neutral, to be tinted), courses `ch` px, bricks `bw` px. */
export function brickWall(x, x0, y0, w, h, rng, o = {}) {
  const ch = o.ch || 4, bw = o.bw || 8;
  const base = o.base ?? 168, vary = o.vary ?? 26;
  x.fillStyle = o.mortar || 'rgb(196,190,180)';
  x.fillRect(x0, y0, w, h);
  for (let y = y0, row = Math.round(y0 / ch); y < y0 + h; y += ch, row++) {
    const off = row % 2 ? bw / 2 : 0;
    for (let px = x0 - off; px < x0 + w; px += bw) {
      const t = base + (rng() - 0.5) * vary * 2 + (rng() < 0.06 ? -30 : 0);
      const warm = o.warm ?? 1;
      const k = o.rgb;
      x.fillStyle = k ? `rgb(${Math.round(t * k[0])},${Math.round(t * k[1])},${Math.round(t * k[2])})` : `rgb(${Math.round(t * (0.98 + 0.06 * warm))},${Math.round(t * 0.93)},${Math.round(t * (0.88 - 0.04 * warm))})`;
      const a = Math.max(x0, px), b = Math.min(x0 + w, px + bw - 1);
      if (b > a) x.fillRect(a, y, b - a, ch - 1);
    }
  }
}

/** A segmental (flat) arch path over an opening x0..x1 springing at ys, rising `rise`. */
function segArch(x, x0, x1, ys, rise) {
  const w = x1 - x0, R = (w * w / 4 + rise * rise) / (2 * rise), cx = (x0 + x1) / 2, cy = ys - rise + R;
  const a = Math.asin(Math.min(1, w / 2 / R));
  x.arc(cx, cy, R, -Math.PI / 2 - a, -Math.PI / 2 + a);
}

/** Steel-sash glazing: a grid of panes inside a rect; lit: 0 dark, 1 warm, 2 cool; broken: share of panes gone. */
function sash(x, ex, x0, y0, w, h, cols, rows, rng, o = {}) {
  const lit = o.lit || 0, broken = o.broken || 0;
  x.fillStyle = o.frame || '#23262a';
  x.fillRect(x0, y0, w, h);
  const pw = w / cols, ph = h / rows, fb = Math.max(1, o.bar ?? 1.5);
  // a light inside: the panes nearer the middle of a lit window brighter
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const px = x0 + c * pw + fb / 2, py = y0 + r * ph + fb / 2, qw = pw - fb, qh = ph - fb;
      if (rng() < broken) {
        x.fillStyle = '#060606';
        x.fillRect(px, py, qw, qh);
        // shards
        x.fillStyle = 'rgba(120,140,150,0.6)';
        x.beginPath(); x.moveTo(px, py); x.lineTo(px + qw * rng(), py); x.lineTo(px, py + qh * rng()); x.fill();
        continue;
      }
      if (lit) {
        const warm = lit === 1;
        const k = 0.75 + rng() * 0.25;
        x.fillStyle = warm ? `rgb(${Math.round(120 * k)},${Math.round(98 * k)},${Math.round(70 * k)})` : `rgb(${Math.round(96 * k)},${Math.round(116 * k)},${Math.round(100 * k)})`;
        x.fillRect(px, py, qw, qh);
        if (ex) {
          const dim = rng() < 0.12 ? 0.25 : 1;
          ex.fillStyle = warm ? `rgba(255,${Math.round(168 + rng() * 40)},${Math.round(90 + rng() * 40)},${(0.55 + rng() * 0.4) * dim})` : `rgba(${Math.round(200 + rng() * 30)},255,${Math.round(200 + rng() * 40)},${(0.5 + rng() * 0.35) * dim})`;
          ex.fillRect(px, py, qw, qh);
        }
      } else {
        // dark glass: the sky's reflection, grimy
        const t = 34 + rng() * 26 + (r / rows) * 14;
        x.fillStyle = `rgb(${Math.round(t * 0.8)},${Math.round(t * 0.92)},${Math.round(t * 1.08)})`;
        x.fillRect(px, py, qw, qh);
        if (rng() < 0.15) { x.fillStyle = 'rgba(200,215,230,0.18)'; x.fillRect(px, py, qw, qh * 0.5); }
      }
    }
  }
  // one glazing bar heavier every so often (the steel sash's mullions)
  x.fillStyle = 'rgba(0,0,0,0.4)';
  for (let c = 0; c <= cols; c += 2) x.fillRect(x0 + c * pw - 1, y0, 2, h);
}

// ------------------------------------------------------------------ THE WORKS: brick facades

/** Brick facade bays (see atlas.js BK): returns { map, emi }. */
export function brickAtlas() {
  return once('brick', () => {
    const A = BRICK;
    const c = cnv(A.W, A.H), e = cnv(A.W, A.H);
    const x = c.getContext('2d'), ex = e.getContext('2d');
    ex.fillStyle = '#000';
    ex.fillRect(0, 0, A.W, A.H);
    const rng = makeRng('works-brick');
    const T = A.tw, M = T / A.mw;            // px per tile, px per metre (32)
    // brick everywhere first (one running bond over the whole sheet: bays join seamlessly)
    brickWall(x, 0, 0, A.W, A.H, rng);
    const tile = (id) => [(id % 8) * T, Math.floor(id / 8) * T];
    const sill = (x0, x1, y) => { x.fillStyle = 'rgb(205,200,190)'; x.fillRect(x0 - 3, y, x1 - x0 + 6, 4); x.fillStyle = 'rgba(0,0,0,0.35)'; x.fillRect(x0 - 3, y + 4, x1 - x0 + 6, 2); };
    const voussoirs = (x0, x1, ys, rise, depth) => {
      // the arch's header bricks, radiating
      const w = x1 - x0, R = (w * w / 4 + rise * rise) / (2 * rise), cx = (x0 + x1) / 2, cy = ys - rise + R;
      const a = Math.asin(Math.min(1, w / 2 / R)) + 0.08;
      for (let t = -a; t < a; t += 0.045) {
        const ang = -Math.PI / 2 + t;
        const k = 150 + rng() * 40;
        x.strokeStyle = `rgb(${k},${k * 0.92},${k * 0.86})`;
        x.lineWidth = 2.2;
        x.beginPath();
        x.moveTo(cx + Math.cos(ang) * R, cy + Math.sin(ang) * R);
        x.lineTo(cx + Math.cos(ang) * (R + depth), cy + Math.sin(ang) * (R + depth));
        x.stroke();
      }
    };
    /** A segmental-arched sash window in a tile. */
    const archWin = (id, o = {}) => {
      const [tx, ty] = tile(id);
      const x0 = tx + 30, x1 = tx + 98, yTop = ty + 22, yBot = ty + 106, rise = 9;
      voussoirs(x0, x1, yTop + rise, rise, 8);
      x.save();
      x.beginPath();
      x.moveTo(x0, yBot); x.lineTo(x0, yTop + rise);
      segArch(x, x0, x1, yTop + rise, rise);
      x.lineTo(x1, yBot); x.closePath();
      x.clip();
      ex.save();
      ex.beginPath(); ex.moveTo(x0, yBot); ex.lineTo(x0, yTop + rise); segArch(ex, x0, x1, yTop + rise, rise); ex.lineTo(x1, yBot); ex.closePath(); ex.clip();
      if (o.bricked) {
        brickWall(x, x0, yTop - 2, x1 - x0, yBot - yTop + 2, rng, { base: 150, vary: 18 });
      } else if (o.boarded) {
        x.fillStyle = '#6e5a40';
        x.fillRect(x0, yTop, x1 - x0, yBot - yTop);
        for (let k = 0; k < 5; k++) { x.fillStyle = `rgba(${40 + rng() * 30},${30 + rng() * 20},20,0.5)`; x.fillRect(x0, yTop + k * 18 + rng() * 6, x1 - x0, 2); }
        x.fillStyle = 'rgba(0,0,0,0.3)';
        x.fillRect(x0 + (x1 - x0) / 2 - 1, yTop, 2, yBot - yTop);
        speckle(x, x0, yTop, x1 - x0, yBot - yTop, rng, 300, 0.3);
      } else {
        sash(x, o.lit ? ex : null, x0, yTop - 2, x1 - x0, yBot - yTop + 2, 4, 6, rng, { lit: o.lit, broken: o.broken || 0 });
        // an opening light (a pivoting pane, ajar)
        if (!o.lit && rng() < 0.5) { x.fillStyle = 'rgba(0,0,0,0.6)'; x.fillRect(x0 + 17, yTop + 46, 17, 13); }
        if (o.silhouette) { x.fillStyle = 'rgba(30,20,12,0.85)'; x.fillRect(x0 + 40, yBot - 34, 9, 32); x.beginPath(); x.arc(x0 + 44.5, yBot - 38, 5, 0, Math.PI * 2); x.fill(); ex.fillStyle = 'rgba(0,0,0,0.9)'; ex.fillRect(x0 + 40, yBot - 34, 9, 32); ex.beginPath(); ex.arc(x0 + 44.5, yBot - 38, 5, 0, Math.PI * 2); ex.fill(); }
      }
      x.restore();
      ex.restore();
      sill(x0, x1, yBot);
    };
    archWin(BK.win, {});
    archWin(BK.winLit, { lit: 1 });
    archWin(BK.winCool, { lit: 2 });
    archWin(BK.winBroken, { broken: 0.35 });
    archWin(BK.winBricked, { bricked: true });
    archWin(BK.winBoarded, { boarded: true });
    archWin(BK.win2, {});
    archWin(BK.winLit2, { lit: 1, silhouette: true });
    // pairs of narrow round-arched windows
    const pairWin = (id, lit) => {
      const [tx, ty] = tile(id);
      for (const ox of [22, 72]) {
        const x0 = tx + ox, x1 = x0 + 34, yTop = ty + 24, yBot = ty + 104;
        const r = 17;
        // header ring
        x.strokeStyle = 'rgb(176,170,160)';
        x.lineWidth = 5;
        x.beginPath(); x.arc(x0 + r, yTop + r, r + 3, Math.PI, 0); x.stroke();
        x.save();
        x.beginPath(); x.moveTo(x0, yBot); x.lineTo(x0, yTop + r); x.arc(x0 + r, yTop + r, r, Math.PI, 0); x.lineTo(x1, yBot); x.closePath(); x.clip();
        ex.save();
        ex.beginPath(); ex.moveTo(x0, yBot); ex.lineTo(x0, yTop + r); ex.arc(x0 + r, yTop + r, r, Math.PI, 0); ex.lineTo(x1, yBot); ex.closePath(); ex.clip();
        sash(x, lit ? ex : null, x0, yTop, 34, yBot - yTop, 2, 5, rng, { lit: lit && rng() < 0.85 ? 1 : 0 });
        x.restore();
        ex.restore();
        sill(x0, x1, yBot);
      }
    };
    pairWin(BK.pair, 0);
    pairWin(BK.pairLit, 1);
    // small square windows, a pair
    const smallWin = (id, lit) => {
      const [tx, ty] = tile(id);
      for (const ox of [20, 72]) {
        const x0 = tx + ox, y0 = ty + 44;
        x.fillStyle = 'rgb(200,195,186)';
        x.fillRect(x0 - 3, y0 - 6, 42, 6);
        sash(x, lit ? ex : null, x0, y0, 36, 40, 3, 3, rng, { lit: lit ? (rng() < 0.7 ? 1 : 2) : 0 });
        sill(x0, x0 + 36, y0 + 40);
      }
    };
    smallWin(BK.small, 0);
    smallWin(BK.smallLit, 1);
    {
      const [tx, ty] = tile(BK.oculus);
      x.strokeStyle = 'rgb(180,174,164)'; x.lineWidth = 7;
      x.beginPath(); x.arc(tx + 64, ty + 58, 26, 0, Math.PI * 2); x.stroke();
      x.save(); x.beginPath(); x.arc(tx + 64, ty + 58, 22, 0, Math.PI * 2); x.clip();
      sash(x, null, tx + 40, ty + 34, 48, 48, 3, 3, rng, {});
      x.restore();
    }
    // plain bays: a pilaster, a downpipe, a vent
    const pil = (id) => {
      const [tx, ty] = tile(id);
      x.fillStyle = 'rgba(0,0,0,0.18)'; x.fillRect(tx + 54, ty, 2, T); x.fillRect(tx + 76, ty, 2, T);
      x.fillStyle = 'rgba(255,255,255,0.07)'; x.fillRect(tx + 56, ty, 20, T);
    };
    pil(BK.pilaster);
    {
      const [tx, ty] = tile(BK.downpipe);
      x.fillStyle = '#3a3c3a'; x.fillRect(tx + 60, ty, 7, T);
      x.fillStyle = 'rgba(255,255,255,0.15)'; x.fillRect(tx + 61, ty, 2, T);
      for (let k = 10; k < T; k += 32) { x.fillStyle = '#2a2a28'; x.fillRect(tx + 57, ty + k, 13, 3); }
      streaks(x, tx + 48, ty, 30, T, rng, 6, '40,50,40', 0.3);
    }
    {
      const [tx, ty] = tile(BK.vent);
      x.fillStyle = '#4a4c4a'; x.fillRect(tx + 44, ty + 40, 40, 30);
      for (let k = 0; k < 30; k += 5) { x.fillStyle = 'rgba(0,0,0,0.6)'; x.fillRect(tx + 46, ty + 42 + k, 36, 2); }
      streaks(x, tx + 44, ty + 70, 40, 58, rng, 5, '20,20,20', 0.3);
    }
    // ---- ground floor (doors at the bottom of the tile)
    const lintel = (x0, x1, y) => { x.fillStyle = '#3c3e40'; x.fillRect(x0 - 4, y - 6, x1 - x0 + 8, 6); x.fillStyle = 'rgba(0,0,0,0.3)'; x.fillRect(x0 - 4, y, x1 - x0 + 8, 2); };
    const rollupDoor = (id, o = {}) => {
      const [tx, ty] = tile(id);
      const x0 = tx + 12, x1 = tx + 116, yT = ty + 18, yB = ty + T;
      lintel(x0, x1, yT);
      const openH = (o.open || 0) * (yB - yT);
      // slats
      for (let y = yT; y < yB - openH; y += 4) {
        const k = o.color || [122, 126, 130];
        const v = (y - yT) % 8 < 4 ? 1 : 0.86;
        x.fillStyle = `rgb(${Math.round(k[0] * v)},${Math.round(k[1] * v)},${Math.round(k[2] * v)})`;
        x.fillRect(x0, y, x1 - x0, 4);
        x.fillStyle = 'rgba(0,0,0,0.25)'; x.fillRect(x0, y + 3, x1 - x0, 1);
      }
      if (openH > 0) {
        const iy = yB - openH;
        if (o.lit) {
          x.fillStyle = '#8a6a44'; x.fillRect(x0, iy, x1 - x0, openH);
          const g = ex.createLinearGradient(0, iy, 0, yB);
          g.addColorStop(0, '#6a4a28'); g.addColorStop(1, '#f0b878');
          ex.fillStyle = g; ex.fillRect(x0, iy, x1 - x0, openH);
          // a car up on the lift, tools on the back wall
          x.fillStyle = 'rgba(25,20,16,0.9)'; ex.fillStyle = 'rgba(0,0,0,0.92)';
          const cy = iy + openH * 0.25;
          x.fillRect(x0 + 20, cy, 64, 14); ex.fillRect(x0 + 20, cy, 64, 14);
          x.fillRect(x0 + 32, cy - 8, 36, 8); ex.fillRect(x0 + 32, cy - 8, 36, 8);
          x.fillRect(x0 + 46, cy + 14, 6, yB - cy - 14); ex.fillRect(x0 + 46, cy + 14, 6, yB - cy - 14);
          for (let k = 0; k < 6; k++) { x.fillRect(x0 + 6 + k * 16, iy + 4, 3, 10); ex.fillRect(x0 + 6 + k * 16, iy + 4, 3, 10); }
        } else {
          x.fillStyle = '#0b0b0c'; x.fillRect(x0, iy, x1 - x0, openH);
        }
      }
      // grime at the foot, a dent
      streaks(x, x0, yT, x1 - x0, yB - yT, rng, 6, '30,25,20', 0.2);
      if (o.tags) tags(x, x0 + 4, yT + 30, x1 - x0 - 8, 50, rng, 3);
    };
    rollupDoor(BK.rollup, {});
    rollupDoor(BK.rollupOpen, { open: 0.92, lit: true });
    rollupDoor(BK.rollupTag, { tags: true, color: [108, 112, 104] });
    rollupDoor(BK.rollupHalf, { open: 0.4, color: [130, 118, 96] });
    {
      // personnel door, a wall lamp over it
      const [tx, ty] = tile(BK.door);
      const x0 = tx + 46, x1 = tx + 82, yT = ty + 50;
      lintel(x0, x1, yT);
      x.fillStyle = '#32424e'; x.fillRect(x0, yT, x1 - x0, T - (yT - ty));
      x.fillStyle = 'rgba(0,0,0,0.35)'; x.fillRect(x0 + 3, yT + 4, x1 - x0 - 6, 2); x.fillRect(x0 + 3, yT + 40, x1 - x0 - 6, 2);
      x.fillStyle = '#c8c8c0'; x.fillRect(x1 - 9, yT + 40, 4, 3);
      x.fillStyle = '#ffd890'; x.fillRect(tx + 58, ty + 32, 12, 6);
      ex.fillStyle = '#ffc070'; ex.fillRect(tx + 58, ty + 32, 12, 6);
      blot(ex, tx + 64, ty + 36, 26, 'rgba(255,170,90,0.35)');
      x.fillStyle = '#3a3a3a'; x.fillRect(tx + 56, ty + 30, 16, 3);
    }
    const barred = (id, lit) => {
      const [tx, ty] = tile(id);
      const x0 = tx + 26, x1 = tx + 102, y0 = ty + 40, y1 = ty + 100;
      lintel(x0, x1, y0);
      sash(x, lit ? ex : null, x0, y0, x1 - x0, y1 - y0, 4, 3, rng, { lit: lit ? 2 : 0 });
      x.fillStyle = '#1c1c1c';
      for (let k = x0 + 4; k < x1; k += 8) x.fillRect(k, y0, 2, y1 - y0);
      if (lit) { ex.fillStyle = '#000'; for (let k = x0 + 4; k < x1; k += 8) ex.fillRect(k, y0, 2, y1 - y0); }
      sill(x0, x1, y1);
    };
    barred(BK.barred, false);
    barred(BK.barredLit, true);
    {
      const [tx, ty] = tile(BK.carriage);
      const x0 = tx + 18, x1 = tx + 110, r = 46;
      x.fillStyle = 'rgb(180,172,160)';
      x.beginPath(); x.arc(tx + 64, ty + 34 + r, r + 6, Math.PI, 0); x.lineTo(x1 + 6, ty + T); x.lineTo(x0 - 6, ty + T); x.fill();
      x.fillStyle = '#080808';
      x.beginPath(); x.arc(tx + 64, ty + 34 + r, r, Math.PI, 0); x.lineTo(x1, ty + T); x.lineTo(x0, ty + T); x.fill();
    }
    {
      // office: a glazed door and a lit window
      const [tx, ty] = tile(BK.office);
      lintel(tx + 16, tx + 112, ty + 46);
      sash(x, ex, tx + 16, ty + 46, 56, 52, 3, 2, rng, { lit: 1 });
      sill(tx + 16, tx + 72, ty + 98);
      x.fillStyle = '#2a2c2e'; x.fillRect(tx + 80, ty + 46, 32, T - 46);
      x.fillStyle = '#c8b890'; x.fillRect(tx + 85, ty + 52, 22, 40);
      ex.fillStyle = 'rgba(255,200,130,0.8)'; ex.fillRect(tx + 85, ty + 52, 22, 40);
      x.fillStyle = '#e8e0c8'; x.font = 'bold 9px Arial, sans-serif'; x.fillText('OFFICE', tx + 20, ty + 40);
    }
    {
      // plinth: rusticated stone base
      const [tx, ty] = tile(BK.plinth);
      x.fillStyle = 'rgb(176,170,160)'; x.fillRect(tx, ty + 80, T, 48);
      for (let k = 0; k < 3; k++) { x.fillStyle = 'rgba(0,0,0,0.3)'; x.fillRect(tx, ty + 80 + k * 16, T, 2); }
      for (let k = 0; k < T; k += 32) { x.fillStyle = 'rgba(0,0,0,0.25)'; x.fillRect(tx + k + ((k / 32) % 2) * 16, ty + 80, 2, 48); }
      streaks(x, tx, ty + 80, T, 48, rng, 8, '30,30,30', 0.25);
    }
    {
      const [tx, ty] = tile(BK.archBricked);
      const r = 44;
      x.strokeStyle = 'rgb(176,168,158)'; x.lineWidth = 8;
      x.beginPath(); x.arc(tx + 64, ty + 40 + r, r, Math.PI, 0); x.stroke();
      x.save(); x.beginPath(); x.arc(tx + 64, ty + 40 + r, r - 4, Math.PI, 0); x.lineTo(tx + 64 + r - 4, ty + T); x.lineTo(tx + 64 - r + 4, ty + T); x.clip();
      brickWall(x, tx, ty, T, T, rng, { base: 140, vary: 16 });
      x.restore();
      tags(x, tx + 20, ty + 70, 88, 40, rng, 2);
    }
    {
      // a bar's front: a window full of neon
      const [tx, ty] = tile(BK.barFront);
      lintel(tx + 10, tx + 118, ty + 40);
      x.fillStyle = '#1a0c0c'; x.fillRect(tx + 10, ty + 40, 108, 70);
      ex.fillStyle = 'rgba(160,40,30,0.5)'; ex.fillRect(tx + 10, ty + 40, 108, 70);
      const neon = (s, px, py, col, size) => {
        for (const g of [x, ex]) {
          g.font = `bold ${size}px Arial, sans-serif`;
          g.lineWidth = 2;
          g.strokeStyle = col;
          g.shadowColor = col; g.shadowBlur = g === ex ? 10 : 0;
          g.strokeText(s, px, py);
          g.shadowBlur = 0;
        }
      };
      neon('BEER', tx + 18, ty + 68, '#ff3a5a', 20);
      neon('OPEN', tx + 66, ty + 98, '#3ae0ff', 18);
      x.fillStyle = '#2a1a14'; x.fillRect(tx + 10, ty + 110, 108, 18);
    }
    {
      const [tx, ty] = tile(BK.shutter);
      lintel(tx + 10, tx + 118, ty + 40);
      for (let y = ty + 40; y < ty + T; y += 3) { x.fillStyle = (y % 6) < 3 ? '#86888c' : '#727478'; x.fillRect(tx + 10, y, 108, 3); }
      tags(x, tx + 14, ty + 60, 100, 50, rng, 3);
    }
    {
      const [tx, ty] = tile(BK.steelDoor);
      lintel(tx + 40, tx + 88, ty + 48);
      x.fillStyle = '#2e4a6a'; x.fillRect(tx + 40, ty + 48, 48, T - 48);
      x.fillStyle = 'rgba(255,255,255,0.12)'; x.fillRect(tx + 63, ty + 48, 2, T - 48);
      x.fillStyle = '#d8d8d0'; x.font = 'bold 10px Arial, sans-serif'; x.fillText('NO', tx + 6, ty + 70); x.fillText('PARKING', tx + 92, ty + 70);
    }
    {
      const [tx, ty] = tile(BK.number);
      x.fillStyle = 'rgba(232,226,210,0.85)';
      x.font = '900 64px Arial Black, Arial, sans-serif';
      x.textAlign = 'center';
      x.fillText(String(2 + Math.floor(rng() * 7)), tx + 64, ty + 92);
      x.textAlign = 'left';
      speckle(x, tx + 30, ty + 40, 70, 60, rng, 300, 0.4, 2, '150,140,130', '60,50,40');
    }
    {
      const [tx, ty] = tile(BK.fireDoor);
      lintel(tx + 44, tx + 84, ty + 52);
      x.fillStyle = '#7a2a22'; x.fillRect(tx + 44, ty + 52, 40, T - 52);
      x.fillStyle = '#1a6a2a'; x.fillRect(tx + 52, ty + 36, 24, 9);
      ex.fillStyle = '#30ff60'; ex.fillRect(tx + 52, ty + 36, 24, 9);
      x.fillStyle = '#fff'; x.font = 'bold 8px Arial, sans-serif'; x.fillText('EXIT', tx + 55, ty + 44);
    }
    // ---- hall bays (two tiles tall: 4 m × 8 m)
    const hall = (col, o = {}) => {
      const tx = col * T, ty = 4 * T;
      if (o.pier) {
        x.fillStyle = 'rgba(0,0,0,0.22)'; x.fillRect(tx + 40, ty, 3, 2 * T); x.fillRect(tx + 86, ty, 3, 2 * T);
        x.fillStyle = 'rgba(255,255,255,0.08)'; x.fillRect(tx + 43, ty, 43, 2 * T);
        for (let k = 0; k < 4; k++) { x.fillStyle = 'rgba(255,255,255,0.10)'; x.fillRect(tx + 40, ty + 20 + k * 3, 49, 2); }
        return;
      }
      if (o.blind) {
        // a blind arch (recessed panel)
        x.fillStyle = 'rgba(0,0,0,0.25)';
        x.beginPath(); x.moveTo(tx + 28, ty + 2 * T - 10); x.lineTo(tx + 28, ty + 54); x.arc(tx + 64, ty + 54, 36, Math.PI, 0); x.lineTo(tx + 100, ty + 2 * T - 10); x.closePath(); x.fill();
        brickWall(x, tx + 32, ty + 58, 64, 2 * T - 72, rng, { base: 150 });
        if (o.louvre) for (let k = 0; k < 10; k++) { x.fillStyle = 'rgba(30,30,30,0.85)'; x.fillRect(tx + 34, ty + 70 + k * 9, 60, 5); }
        return;
      }
      const x0 = tx + 28, x1 = tx + 100, r = 36, yTop = ty + 18, yBot = ty + 2 * T - 26;
      if (o.door) {
        // a tall arched doorway: a roll-up below, a fanlight above
        x.fillStyle = 'rgb(176,168,158)';
        x.beginPath(); x.arc(tx + 64, yTop + r, r + 6, Math.PI, 0); x.lineTo(x1 + 6, ty + 2 * T); x.lineTo(x0 - 6, ty + 2 * T); x.fill();
        x.save(); x.beginPath(); x.moveTo(x0, ty + 2 * T); x.lineTo(x0, yTop + r); x.arc(tx + 64, yTop + r, r, Math.PI, 0); x.lineTo(x1, ty + 2 * T); x.closePath(); x.clip();
        sash(x, null, x0, yTop, x1 - x0, 92, 4, 4, rng, {});
        for (let y = ty + 120; y < ty + 2 * T; y += 4) { x.fillStyle = (y % 8) < 4 ? '#7a7e82' : '#6a6e72'; x.fillRect(x0, y, x1 - x0, 4); }
        x.fillStyle = '#3a3c3e'; x.fillRect(x0, ty + 112, x1 - x0, 8);
        x.restore();
        return;
      }
      x.fillStyle = 'rgb(178,170,160)';
      x.beginPath(); x.arc(tx + 64, yTop + r, r + 7, Math.PI, 0); x.lineTo(x1 + 7, yTop + r); x.fill();
      x.save();
      x.beginPath(); x.moveTo(x0, yBot); x.lineTo(x0, yTop + r); x.arc(tx + 64, yTop + r, r, Math.PI, 0); x.lineTo(x1, yBot); x.closePath(); x.clip();
      ex.save();
      ex.beginPath(); ex.moveTo(x0, yBot); ex.lineTo(x0, yTop + r); ex.arc(tx + 64, yTop + r, r, Math.PI, 0); ex.lineTo(x1, yBot); ex.closePath(); ex.clip();
      sash(x, o.lit ? ex : null, x0, yTop, x1 - x0, yBot - yTop, 5, 12, rng, { lit: o.lit, broken: o.broken || 0 });
      // the fanlight's radiating bars
      x.strokeStyle = '#23262a'; x.lineWidth = 2;
      for (let k = 1; k < 6; k++) { const a = Math.PI + (k / 6) * Math.PI; x.beginPath(); x.moveTo(tx + 64, yTop + r); x.lineTo(tx + 64 + Math.cos(a) * r, yTop + r + Math.sin(a) * r); x.stroke(); }
      x.restore();
      ex.restore();
      sill(x0, x1, yBot);
    };
    hall(0, {}); hall(1, { lit: 1 }); hall(2, { lit: 2 }); hall(3, { broken: 0.3 });
    hall(4, { pier: true }); hall(5, { blind: true }); hall(6, { blind: true, louvre: true }); hall(7, { door: true });
    // ---- parapets, plain
    const band = (id, kind) => {
      const [tx, ty] = tile(id);
      if (kind === 'cornice') {
        for (let k = 0; k < 4; k++) { x.fillStyle = `rgba(${k % 2 ? 0 : 255},${k % 2 ? 0 : 255},${k % 2 ? 0 : 255},${k % 2 ? 0.3 : 0.1})`; x.fillRect(tx, ty + 6 + k * 5, T, 4); }
        for (let k = 0; k < T; k += 8) { x.fillStyle = 'rgba(0,0,0,0.3)'; x.fillRect(tx + k, ty + 26, 4, 5); }
        x.fillStyle = 'rgb(200,196,188)'; x.fillRect(tx, ty, T, 6);
      } else if (kind === 'coping') {
        x.fillStyle = 'rgb(205,200,192)'; x.fillRect(tx, ty, T, 10);
        x.fillStyle = 'rgba(0,0,0,0.35)'; x.fillRect(tx, ty + 10, T, 3);
        for (let k = 0; k < T; k += 32) x.fillRect(tx + k, ty, 1, 10);
      } else if (kind === 'dentil') {
        x.fillStyle = 'rgb(200,196,188)'; x.fillRect(tx, ty, T, 8);
        for (let k = 0; k < T; k += 8) { x.fillStyle = 'rgb(186,180,170)'; x.fillRect(tx + k, ty + 10, 5, 7); x.fillStyle = 'rgba(0,0,0,0.35)'; x.fillRect(tx + k + 5, ty + 10, 3, 7); }
      } else if (kind === 'name') {
        x.fillStyle = 'rgb(206,200,188)'; x.fillRect(tx, ty + 40, T, 40);
        x.fillStyle = 'rgba(0,0,0,0.3)'; x.fillRect(tx, ty + 80, T, 3); x.fillRect(tx, ty + 38, T, 2);
      } else if (kind === 'anchors') {
        for (const ox of [32, 96]) {
          x.strokeStyle = '#2a2622'; x.lineWidth = 3;
          for (let a = 0; a < 4; a++) { const t = a * Math.PI / 4; x.beginPath(); x.moveTo(tx + ox - Math.cos(t) * 9, ty + 64 - Math.sin(t) * 9); x.lineTo(tx + ox + Math.cos(t) * 9, ty + 64 + Math.sin(t) * 9); x.stroke(); }
        }
      } else if (kind === 'sooty') {
        x.fillStyle = 'rgba(20,16,14,0.35)'; x.fillRect(tx, ty, T, T);
        streaks(x, tx, ty, T, T, rng, 10, '10,10,10', 0.3);
      } else if (kind === 'light') {
        x.fillStyle = 'rgba(255,250,240,0.12)'; x.fillRect(tx, ty, T, T);
      }
    };
    band(BK.cornice, 'cornice'); band(BK.coping, 'coping'); band(BK.dentil, 'dentil'); band(BK.nameBand, 'name');
    band(BK.anchors, 'anchors'); band(BK.sooty, 'sooty'); band(BK.plainLight, 'light');
    // ---- roof glazing (row 7): steel frames all over
    const glaze = (id, o = {}) => {
      const [tx, ty] = tile(id);
      if (o.louvre) {
        x.fillStyle = '#4a4c4e'; x.fillRect(tx, ty, T, T);
        for (let k = 0; k < T; k += 8) { x.fillStyle = 'rgba(0,0,0,0.55)'; x.fillRect(tx, ty + k, T, 4); }
        return;
      }
      if (o.metal) {
        x.fillStyle = '#6a6c70'; x.fillRect(tx, ty, T, T);
        for (let k = 0; k < T; k += 6) { x.fillStyle = 'rgba(255,255,255,0.08)'; x.fillRect(tx + k, ty, 2, T); x.fillStyle = 'rgba(0,0,0,0.18)'; x.fillRect(tx + k + 3, ty, 2, T); }
        return;
      }
      sash(x, o.lit ? ex : null, tx, ty, T, T, 6, o.rows || 4, rng, { lit: o.lit, broken: o.broken || 0, frame: '#2a2e30', bar: 3 });
    };
    glaze(BK.glaze, {}); glaze(BK.glazeLit, { lit: 1 }); glaze(BK.glazeCool, { lit: 2 }); glaze(BK.glazeBroken, { broken: 0.3 });
    glaze(BK.monitorLit, { lit: 1, rows: 2 }); glaze(BK.monitor, { rows: 2 }); glaze(BK.louvre, { louvre: true }); glaze(BK.metal, { metal: true });
    // soot and weather over the brick (not the glazing row)
    for (let i = 0; i < 70; i++) blot(x, rng() * A.W, rng() * 7 * T, 10 + rng() * 40, `rgba(${rng() < 0.7 ? '20,16,12' : '255,250,240'},${0.04 + rng() * 0.06})`);
    speckle(x, 0, 0, A.W, 7 * T, rng, 9000, 0.12);
    void M;
    return { map: toTex(c), emi: toTex(e) };
  });
}

/** Spray-paint tags over a rect (a few words in fat marker). */
export function tags(x, x0, y0, w, h, rng, n) {
  const words = ['KZ', 'SLAB', 'DUB', 'RYZ', 'NITRO', '88', 'MF', 'ZERO', 'HALO', 'KRANK', 'VEX', 'TANK', 'SKID', 'OSK'];
  const cols = ['#ff3d6e', '#46e8ff', '#e8f048', '#9a5bff', '#f2f2f2', '#ff8a2a', '#2aff8a', '#111111'];
  for (let i = 0; i < n; i++) {
    x.save();
    x.translate(x0 + rng() * w * 0.6, y0 + h * (0.4 + rng() * 0.6));
    x.rotate((rng() - 0.5) * 0.35);
    const s = 10 + rng() * 14;
    x.font = `italic 900 ${s}px Arial Black, Arial, sans-serif`;
    x.lineWidth = 2;
    const word = pick(rng, words), col = pick(rng, cols);
    if (rng() < 0.5) { x.strokeStyle = '#0a0a0a'; x.strokeText(word, 0, 0); }
    x.fillStyle = col;
    x.fillText(word, 0, 0);
    x.restore();
  }
}

// ------------------------------------------------------------------ THE WORKS: corrugated cladding

/** Corrugated cladding bays (see atlas.js MT), neutral light grey to be tinted: { map, emi }. */
export function metalAtlas() {
  return once('metal', () => {
    const A = METAL;
    const c = cnv(A.W, A.H), e = cnv(A.W, A.H);
    const x = c.getContext('2d'), ex = e.getContext('2d');
    ex.fillStyle = '#000';
    ex.fillRect(0, 0, A.W, A.H);
    const rng = makeRng('works-metal');
    const T = A.tw, TH = A.th, M = T / A.mw;          // 25.6 px a metre
    const Y = (ty, m) => ty + TH - m * M;             // metres up the bay → canvas y
    const tile = (id) => [(id % 8) * T, Math.floor(id / 8) * TH];
    const rollup = (tx, ty, o = {}) => {
      const x0 = tx + 0.4 * M, x1 = tx + 4.6 * M, top = Y(ty, o.h || 5);
      x.fillStyle = '#2a2b2d'; x.fillRect(x0 - 4, top - 10, x1 - x0 + 8, (o.h || 5) * M + 10);
      const openH = (o.open || 0) * (o.h || 5) * M;
      for (let y = top; y < Y(ty, 0) - openH; y += 4) {
        const v = (y - top) % 8 < 4 ? 1 : 0.85;
        const k = o.tone ?? 150;
        x.fillStyle = `rgb(${Math.round(k * v)},${Math.round(k * v * 1.01)},${Math.round(k * v * 1.03)})`;
        x.fillRect(x0, y, x1 - x0, 4);
        x.fillStyle = 'rgba(0,0,0,0.22)'; x.fillRect(x0, y + 3, x1 - x0, 1);
      }
      x.fillStyle = 'rgba(0,0,0,0.4)'; x.fillRect(x0, top - 9, x1 - x0, 8);
      if (openH > 0) {
        const iy = Y(ty, 0) - openH;
        if (o.lit) {
          x.fillStyle = '#7a6040'; x.fillRect(x0, iy, x1 - x0, openH);
          const g = ex.createLinearGradient(0, iy, 0, iy + openH);
          g.addColorStop(0, '#5a4024'); g.addColorStop(1, '#e8a868');
          ex.fillStyle = g; ex.fillRect(x0, iy, x1 - x0, openH);
          // pallets, racking inside
          for (let k = 0; k < 4; k++) {
            const pw = 10 + rng() * 16, ph = 8 + rng() * (openH * 0.6), px = x0 + 6 + rng() * (x1 - x0 - 30);
            x.fillStyle = 'rgba(30,20,10,0.85)'; x.fillRect(px, iy + openH - ph, pw, ph);
            ex.fillStyle = 'rgba(0,0,0,0.85)'; ex.fillRect(px, iy + openH - ph, pw, ph);
          }
          x.fillStyle = 'rgba(30,20,10,0.8)'; x.fillRect(x0, iy + 10, x1 - x0, 3);
          ex.fillStyle = 'rgba(0,0,0,0.8)'; ex.fillRect(x0, iy + 10, x1 - x0, 3);
        } else {
          x.fillStyle = '#0c0d0e'; x.fillRect(x0, iy, x1 - x0, openH);
        }
      }
    };
    const windows = (tx, ty, lit, rows) => {
      for (const [m0, m1] of rows) {
        for (let k = 0; k < 2; k++) {
          const wx = tx + (0.4 + k * 2.2) * M, wy = Y(ty, m1), ww = 2.0 * M, wh = (m1 - m0) * M;
          x.fillStyle = '#3a3c3e'; x.fillRect(wx - 2, wy - 2, ww + 4, wh + 4);
          const on = lit && rng() < 0.8;
          x.fillStyle = on ? '#9a8a68' : `rgb(${20 + rng() * 14},${24 + rng() * 14},${30 + rng() * 16})`;
          x.fillRect(wx, wy, ww, wh);
          x.fillStyle = 'rgba(0,0,0,0.5)'; x.fillRect(wx + ww / 2 - 1, wy, 2, wh);
          if (on) {
            const cool = rng() < 0.5;
            ex.fillStyle = cool ? '#d8f0ff' : '#ffd890';
            ex.globalAlpha = 0.45 + rng() * 0.4;
            ex.fillRect(wx, wy, ww, wh);
            ex.globalAlpha = 1;
            if (rng() < 0.5) { x.fillStyle = 'rgba(40,30,20,0.4)'; x.fillRect(wx, wy, ww, wh * 0.35); ex.fillStyle = 'rgba(0,0,0,0.5)'; ex.fillRect(wx, wy, ww, wh * 0.35); }
          }
        }
      }
    };
    for (let t = 0; t < 16; t++) {
      const [tx, ty] = tile(t);
      // the cladding: vertical ribs
      x.fillStyle = '#c4c2bc';
      x.fillRect(tx, ty, T, TH);
      for (let px = tx; px < tx + T; px += 5) {
        x.fillStyle = 'rgba(255,255,255,0.13)'; x.fillRect(px, ty, 2, TH);
        x.fillStyle = 'rgba(0,0,0,0.17)'; x.fillRect(px + 3, ty, 1.5, TH);
      }
      // a horizontal lap joint and the eaves
      x.fillStyle = 'rgba(0,0,0,0.22)'; x.fillRect(tx, Y(ty, 6.4), T, 2);
      x.fillStyle = 'rgba(0,0,0,0.45)'; x.fillRect(tx, ty, T, 3);
      if (t !== MT.plain && t !== MT.rusty && t !== MT.patched) {
        // a concrete plinth (1 m)
        x.fillStyle = '#868480'; x.fillRect(tx, Y(ty, 1), T, M);
        speckle(x, tx, Y(ty, 1), T, M, rng, 200, 0.3);
        x.fillStyle = 'rgba(0,0,0,0.4)'; x.fillRect(tx, Y(ty, 1), T, 2);
      }
      if (t === MT.rollup) rollup(tx, ty, {});
      if (t === MT.rollupOpen) rollup(tx, ty, { open: 0.9, lit: true });
      if (t === MT.rollupHalf) rollup(tx, ty, { open: 0.45, tone: 130 });
      if (t === MT.dock || t === MT.dockOpen) {
        // a dock door: the floor is at 1.2 m (the dock), black rubber seals round it
        x.fillStyle = '#181818'; x.fillRect(tx + 0.25 * M, Y(ty, 5.2), 4.5 * M, 4.2 * M);
        rollup(tx, ty - 1.2 * M, { h: 3.8, open: t === MT.dockOpen ? 0.85 : 0, lit: t === MT.dockOpen, tone: 140 });
        x.fillStyle = '#e0b020';
        for (let k = 0; k < 2; k++) x.fillRect(tx + (0.5 + k * 3.6) * M, Y(ty, 1.2), 0.4 * M, 1.0 * M);
        x.fillStyle = '#7c7a74'; x.fillRect(tx, Y(ty, 1.2), T, 1.2 * M);
      }
      if (t === MT.door) {
        x.fillStyle = '#34465a'; x.fillRect(tx + 1.8 * M, Y(ty, 2.2), 1.1 * M, 2.2 * M);
        x.fillStyle = '#ddd'; x.fillRect(tx + 2.7 * M, Y(ty, 1.1), 3, 3);
        x.fillStyle = '#ffd890'; x.fillRect(tx + 2.1 * M, Y(ty, 2.8), 12, 6);
        ex.fillStyle = '#ffc070'; ex.fillRect(tx + 2.1 * M, Y(ty, 2.8), 12, 6);
        blot(ex, tx + 2.35 * M, Y(ty, 2.7), 30, 'rgba(255,170,90,0.3)');
      }
      if (t === MT.office) { windows(tx, ty, true, [[1.3, 2.7], [4.4, 5.8]]); }
      if (t === MT.officeDark) windows(tx, ty, false, [[1.3, 2.7], [4.4, 5.8]]);
      if (t === MT.clerestory) windows(tx, ty, true, [[7.6, 8.6]]);
      if (t === MT.louvre) for (let k = 0; k < 2; k++) { x.fillStyle = '#5a5c5e'; x.fillRect(tx + (0.6 + k * 2.4) * M, Y(ty, 8.5), 1.8 * M, 1.6 * M); for (let y = 0; y < 1.6 * M; y += 4) { x.fillStyle = 'rgba(0,0,0,0.5)'; x.fillRect(tx + (0.6 + k * 2.4) * M, Y(ty, 8.5) + y, 1.8 * M, 2); } }
      if (t === MT.number) { x.fillStyle = 'rgba(30,36,48,0.8)'; x.font = '900 110px Arial Black, Arial, sans-serif'; x.textAlign = 'center'; x.fillText(String(1 + Math.floor(rng() * 12)), tx + 64, Y(ty, 4.2)); x.textAlign = 'left'; }
      if (t === MT.hazard) {
        for (let k = 0; k < T; k += 16) { x.fillStyle = '#d4a425'; x.beginPath(); x.moveTo(tx + k, Y(ty, 1.0)); x.lineTo(tx + k + 8, Y(ty, 1.0)); x.lineTo(tx + k + 16, Y(ty, 0.2)); x.lineTo(tx + k + 8, Y(ty, 0.2)); x.fill(); }
        x.fillStyle = '#c9c9c4'; x.font = 'bold 12px Arial, sans-serif'; x.fillText('NO PARKING', tx + 24, Y(ty, 3.2));
        x.fillText('FIRE LANE', tx + 30, Y(ty, 2.6));
      }
      if (t === MT.patched) {
        for (let k = 0; k < 4; k++) {
          const pw = 20 + rng() * 40, ph = 30 + rng() * 60, px = tx + rng() * (T - pw), py = ty + 20 + rng() * (TH - ph - 30);
          x.fillStyle = `rgb(${150 + rng() * 40},${140 + rng() * 40},${130 + rng() * 40})`;
          x.fillRect(px, py, pw, ph);
          for (let q = px; q < px + pw; q += 5) { x.fillStyle = 'rgba(0,0,0,0.15)'; x.fillRect(q + 3, py, 1.5, ph); }
          x.fillStyle = 'rgba(0,0,0,0.5)'; for (let q = 0; q < 4; q++) x.fillRect(px + 2 + q * pw / 4, py + 2, 2, 2);
        }
      }
      // weather: rust runs from the eaves and fixings, dirt splashed up from the ground
      const rust = t === MT.rusty ? 2.6 : 0.8;
      streaks(x, tx, ty, T, TH, rng, Math.round(10 * rust), '120,60,30', 0.22 * rust);
      for (let i = 0; i < 6 * rust; i++) blot(x, tx + rng() * T, ty + rng() * TH, 4 + rng() * 14, `rgba(110,55,25,${0.15 + rng() * 0.2})`);
      const g = x.createLinearGradient(0, Y(ty, 1.6), 0, Y(ty, 0));
      g.addColorStop(0, 'rgba(40,32,24,0)'); g.addColorStop(1, 'rgba(40,32,24,0.35)');
      x.fillStyle = g; x.fillRect(tx, Y(ty, 1.6), T, 1.6 * M);
      speckle(x, tx, ty, T, TH, rng, 900, 0.14);
    }
    return { map: toTex(c), emi: toTex(e) };
  });
}

// ------------------------------------------------------------------ THE WORKS: signs, ghost signs, graffiti

/** Sign atlas (see atlas.js WSIGN): { map, emi }. */
export function worksSigns() {
  return once('wsigns', () => {
    const A = WSIGN;
    const c = cnv(A.W, A.H), e = cnv(A.W, A.H);
    const x = c.getContext('2d'), ex = e.getContext('2d');
    x.fillStyle = '#1a1a1a'; x.fillRect(0, 0, A.W, A.H);
    ex.fillStyle = '#000'; ex.fillRect(0, 0, A.W, A.H);
    const rng = makeRng('works-signs');
    const R = (k) => A[k];
    /** Neon text: a dim tube by day, a glow by night. */
    const neon = (s, cx, cy, size, col, o = {}) => {
      const font = o.font || `${o.italic ? 'italic ' : ''}bold ${size}px ${o.face || 'Arial, sans-serif'}`;
      for (const g of [x, ex]) {
        g.save();
        g.font = font; g.textAlign = 'center'; g.textBaseline = 'middle';
        g.lineJoin = 'round';
        if (g === ex) {
          g.shadowColor = col; g.shadowBlur = size * 0.35;
          g.globalAlpha = 0.75;
          g.lineWidth = size * 0.12; g.strokeStyle = col; g.strokeText(s, cx, cy, o.max);
          g.shadowBlur = 0;
          g.globalAlpha = 0.9;
          g.lineWidth = size * 0.045; g.strokeStyle = lighten(col); g.strokeText(s, cx, cy, o.max);
          g.globalAlpha = 1;
        } else {
          g.lineWidth = size * 0.12; g.strokeStyle = o.tube || col; g.strokeText(s, cx, cy, o.max);
          g.lineWidth = size * 0.04; g.strokeStyle = 'rgba(255,255,255,0.6)'; g.strokeText(s, cx, cy, o.max);
        }
        g.restore();
      }
    };
    const backing = (k, col = '#121314', frame = '#2a2c2e') => {
      const [x0, y0, w, h] = R(k);
      x.fillStyle = frame; x.fillRect(x0, y0, w, h);
      x.fillStyle = col; x.fillRect(x0 + 6, y0 + 6, w - 12, h - 12);
      return [x0, y0, w, h];
    };
    // THE RIVET (bar): red script, a cocktail glass
    {
      const [x0, y0, w, h] = backing('rivet', '#140808');
      neon('The Rivet', x0 + w * 0.45, y0 + h * 0.46, 70, '#ff2a3a', { italic: true, face: 'Georgia, serif', max: w * 0.75 });
      neon('COCKTAILS · LIVE MUSIC', x0 + w * 0.45, y0 + h * 0.84, 18, '#ffb040', { max: w * 0.7 });
      // a martini glass
      for (const g of [x, ex]) {
        g.save(); g.strokeStyle = '#3ae0ff'; g.lineWidth = g === ex ? 5 : 3; if (g === ex) { g.shadowColor = '#3ae0ff'; g.shadowBlur = 12; }
        const gx = x0 + w * 0.88, gy = y0 + h * 0.3;
        g.beginPath(); g.moveTo(gx - 26, gy); g.lineTo(gx + 26, gy); g.lineTo(gx, gy + 30); g.closePath(); g.moveTo(gx, gy + 30); g.lineTo(gx, gy + 62); g.moveTo(gx - 14, gy + 62); g.lineTo(gx + 14, gy + 62); g.stroke();
        g.restore();
      }
    }
    // body shop
    {
      const [x0, y0, w, h] = backing('body', '#0a0e14');
      neon("KRANK'S", x0 + w * 0.5, y0 + h * 0.36, 58, '#ff3ab0', { italic: true, face: 'Arial Black, Arial', max: w * 0.85 });
      neon('BODY & PAINT · CUSTOM', x0 + w * 0.5, y0 + h * 0.8, 24, '#3ae0ff', { max: w * 0.85 });
    }
    // ghost signs: faded paint on brick (painted over the brick, worn through)
    const ghost = (k, lines, bg, fg) => {
      const [x0, y0, w, h] = R(k);
      brickWall(x, x0, y0, w, h, rng, { base: 120, vary: 22 });
      x.save();
      x.globalAlpha = 0.72;
      x.fillStyle = bg; x.fillRect(x0 + 8, y0 + 8, w - 16, h - 16);
      x.fillStyle = fg;
      let yy = y0 + 14;
      for (const [txt, size, font] of lines) {
        x.font = font || `900 ${size}px Arial Black, Arial, sans-serif`;
        x.textAlign = 'center'; x.textBaseline = 'top';
        x.fillText(txt, x0 + w / 2, yy, w - 30);
        yy += size * 1.12;
      }
      x.restore();
      // worn: the brick shows through in blotches and along the mortar
      for (let i = 0; i < 260; i++) {
        const px = x0 + rng() * w, py = y0 + rng() * h, r = 1 + rng() * 5;
        x.fillStyle = `rgba(${100 + rng() * 40},${60 + rng() * 20},${45 + rng() * 15},${0.3 + rng() * 0.5})`;
        x.fillRect(px, py, r * 2, r);
      }
      for (let y = y0; y < y0 + h; y += 4) { x.fillStyle = 'rgba(80,60,50,0.25)'; x.fillRect(x0, y + 3, w, 1); }
      streaks(x, x0, y0, w, h, rng, 20, '30,24,20', 0.25);
    };
    ghost('ghostIron', [['HALCYON', 46], ['IRON WORKS', 52], ['CASTINGS · FORGINGS · EST. 1891', 18, 'bold 18px Georgia, serif']], '#2a3a2a', '#e8e0c4');
    ghost('ghostCold', [['PORT', 30], ['COLD STORAGE', 46], ['ICE  ·  FISH  ·  PRODUCE', 22, 'bold 22px Georgia, serif']], '#5a2a20', '#f0e6cc');
    ghost('ghostSoap', [['STAR', 34], ['SOAP CO.', 30]], '#1e2e4a', '#efe4c8');
    // the power station's name, cut in a stone band
    {
      const [x0, y0, w, h] = R('power');
      x.fillStyle = '#b8b0a2'; x.fillRect(x0, y0, w, h);
      speckle(x, x0, y0, w, h, rng, 2500, 0.2);
      x.fillStyle = '#4a4238'; x.font = 'bold 40px Georgia, serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
      x.fillText('HALCYON  POWER  &  LIGHT', x0 + w / 2, y0 + h * 0.52, w - 30);
      x.fillStyle = 'rgba(0,0,0,0.25)'; x.fillRect(x0, y0 + 4, w, 2); x.fillRect(x0, y0 + h - 6, w, 2);
      streaks(x, x0, y0, w, h, rng, 14, '30,26,20', 0.3);
    }
    // scrapyard board: white painted letters on a red board
    {
      const [x0, y0, w, h] = R('salvage');
      x.fillStyle = '#e8e2d0'; x.fillRect(x0, y0, w, h);
      x.fillStyle = '#9a1e16'; x.fillRect(x0 + 6, y0 + 6, w - 12, h - 12);
      x.fillStyle = '#f4ecd8'; x.font = '900 40px Arial Black, Arial'; x.textAlign = 'center'; x.textBaseline = 'middle';
      x.fillText('HALCYON SALVAGE', x0 + w / 2, y0 + h * 0.38, w - 30);
      x.font = 'bold 20px Arial'; x.fillText('WE BUY SCRAP · CARS · METAL', x0 + w / 2, y0 + h * 0.76, w - 40);
      streaks(x, x0, y0, w, h, rng, 12, '60,30,20', 0.3);
    }
    // lit boxes
    const box = (k, txt, bg, fg, sub) => {
      const [x0, y0, w, h] = R(k);
      x.fillStyle = '#222'; x.fillRect(x0, y0, w, h);
      x.fillStyle = bg; x.fillRect(x0 + 5, y0 + 5, w - 10, h - 10);
      ex.fillStyle = bg; ex.globalAlpha = 0.8; ex.fillRect(x0 + 5, y0 + 5, w - 10, h - 10); ex.globalAlpha = 1;
      for (const g of [x, ex]) {
        g.fillStyle = g === ex ? '#000' : fg;
        g.font = `900 ${Math.round(h * (sub ? 0.42 : 0.55))}px Arial Black, Arial`; g.textAlign = 'center'; g.textBaseline = 'middle';
        g.fillText(txt, x0 + w / 2, y0 + h * (sub ? 0.4 : 0.52), w - 20);
        if (sub) { g.font = `bold ${Math.round(h * 0.2)}px Arial`; g.fillText(sub, x0 + w / 2, y0 + h * 0.78, w - 20); }
      }
    };
    box('tires', 'TIRES', '#ffcc22', '#141414', 'USED · NEW · 24 HR');
    box('liquor', 'LIQUOR', '#f4f0e4', '#b3141a', 'BEER · WINE · ICE');
    box('parts', 'AUTO PARTS', '#1d4fa8', '#ffffff', 'MUFFLERS · BRAKES · TURBOS');
    {
      const [x0, y0, w, h] = backing('open', '#0a0a0a');
      neon('OPEN', x0 + w / 2, y0 + h / 2, 40, '#ff3a3a', { max: w - 20 });
    }
    // railroad crossbuck (white boards, black letters) on transparent-ish dark
    {
      const [x0, y0, w, h] = R('xing');
      x.fillStyle = '#101010'; x.fillRect(x0, y0, w, h);
      x.save(); x.translate(x0 + w / 2, y0 + h / 2);
      for (const a of [Math.PI / 4, -Math.PI / 4]) {
        x.save(); x.rotate(a);
        x.fillStyle = '#f2f2ee'; x.fillRect(-62, -11, 124, 22);
        x.strokeStyle = '#111'; x.lineWidth = 2; x.strokeRect(-62, -11, 124, 22);
        x.fillStyle = '#111'; x.font = 'bold 13px Arial'; x.textAlign = 'center'; x.textBaseline = 'middle';
        x.fillText(a > 0 ? 'RAILROAD' : 'CROSSING', 0, 1);
        x.restore();
      }
      x.restore();
    }
    {
      const [x0, y0, w, h] = R('danger');
      x.fillStyle = '#f2f0ea'; x.fillRect(x0, y0, w, h);
      x.fillStyle = '#111'; x.fillRect(x0 + 6, y0 + 6, w - 12, 34);
      x.fillStyle = '#d81e1e'; x.beginPath(); x.ellipse(x0 + w / 2, y0 + 23, 44, 13, 0, 0, Math.PI * 2); x.fill();
      x.fillStyle = '#fff'; x.font = 'bold 18px Arial'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('DANGER', x0 + w / 2, y0 + 24);
      x.fillStyle = '#111'; x.font = 'bold 15px Arial';
      x.fillText('KEEP OUT', x0 + w / 2, y0 + 62); x.fillText('HIGH', x0 + w / 2, y0 + 84); x.fillText('VOLTAGE', x0 + w / 2, y0 + 104);
      streaks(x, x0, y0, w, h, rng, 6, '90,60,30', 0.3);
    }
    // FOUNDRY down the chimney: white-glazed brick letters on dark brick
    {
      const [x0, y0, w, h] = R('stack');
      brickWall(x, x0, y0, w, h, rng, { base: 110, vary: 20 });
      x.fillStyle = '#e8e2d2'; x.font = '900 46px Arial Black, Arial'; x.textAlign = 'center'; x.textBaseline = 'middle';
      const word = 'FOUNDRY';
      for (let k = 0; k < word.length; k++) x.fillText(word[k], x0 + w / 2, y0 + 30 + k * (h - 50) / (word.length - 1));
      for (let y = y0; y < y0 + h; y += 4) { x.fillStyle = 'rgba(60,50,40,0.25)'; x.fillRect(x0, y + 3, w, 1); }
      streaks(x, x0, y0, w, h, rng, 12, '20,16,14', 0.3);
    }
    // girder plates: painted lettering on riveted steel
    const plate = (k, txt, bg, fg) => {
      const [x0, y0, w, h] = R(k);
      x.fillStyle = bg; x.fillRect(x0, y0, w, h);
      for (let px = x0 + 6; px < x0 + w; px += 12) { x.fillStyle = 'rgba(0,0,0,0.35)'; x.fillRect(px, y0 + 4, 3, 3); x.fillRect(px, y0 + h - 7, 3, 3); }
      x.fillStyle = fg; x.font = `900 ${Math.round(h * 0.42)}px Arial Black, Arial`; x.textAlign = 'center'; x.textBaseline = 'middle';
      x.fillText(txt, x0 + w / 2, y0 + h / 2, w - 20);
      streaks(x, x0, y0, w, h, rng, 16, '110,55,25', 0.35);
      speckle(x, x0, y0, w, h, rng, 800, 0.25);
    };
    plate('belt', 'P.H. BELT RY', '#2c3a34', '#d8d2c0');
    plate('lowline', 'LOW LINE', '#2a2e30', '#e4dcc4');
    plate('yard', 'PORT RAIL YARD', '#1d3a5a', '#f2ecd8');
    {
      const [x0, y0, w, h] = R('noentry');
      x.fillStyle = '#f4f2ea'; x.fillRect(x0, y0, w, h);
      x.fillStyle = '#c81e1e'; x.font = '900 26px Arial Black, Arial'; x.textAlign = 'center'; x.textBaseline = 'middle';
      x.fillText('PRIVATE', x0 + w / 2, y0 + h * 0.32, w - 16);
      x.fillStyle = '#111'; x.font = 'bold 15px Arial'; x.fillText('NO TRESPASSING', x0 + w / 2, y0 + h * 0.62); x.fillText('VIOLATORS PROSECUTED', x0 + w / 2, y0 + h * 0.84, w - 16);
      streaks(x, x0, y0, w, h, rng, 8, '90,60,30', 0.3);
    }
    {
      // a string of bare bulbs (warm), for over a door or under a canopy
      const [x0, y0, w, h] = R('bulb');
      x.fillStyle = '#0c0c0c'; x.fillRect(x0, y0, w, h);
      x.strokeStyle = '#333'; x.lineWidth = 2; x.beginPath(); x.moveTo(x0, y0 + 16);
      for (let k = 0; k <= 8; k++) x.lineTo(x0 + k * w / 8, y0 + 16 + Math.sin(k / 8 * Math.PI) * 12); x.stroke();
      for (let k = 0; k < 8; k++) {
        const bx = x0 + (k + 0.5) * w / 8, by = y0 + 30 + Math.sin((k + 0.5) / 8 * Math.PI) * 12;
        x.fillStyle = '#ffd890'; x.beginPath(); x.arc(bx, by, 6, 0, Math.PI * 2); x.fill();
        blot(ex, bx, by, 16, 'rgba(255,200,120,1)');
      }
    }
    // graffiti: a long precast wall of pieces
    {
      const [x0, y0, w, h] = R('graffiti');
      graffitiWall(x, x0, y0, w, h, rng);
    }
    {
      const [x0, y0, w, h] = R('graffiti2');
      x.fillStyle = '#8a8884'; x.fillRect(x0, y0, w, h);
      speckle(x, x0, y0, w, h, rng, 3000, 0.25);
      for (let k = 0; k < w; k += 96) { x.fillStyle = 'rgba(0,0,0,0.3)'; x.fillRect(x0 + k, y0, 2, h); }
      tags(x, x0, y0 + 10, w, h - 10, rng, 22);
      streaks(x, x0, y0, w, h, rng, 20, '30,30,30', 0.25);
    }
    return { map: toTex(c), emi: toTex(e) };
  });
}

/** Big wild-style pieces on precast concrete panels. */
function graffitiWall(x, x0, y0, w, h, rng) {
  x.fillStyle = '#7e7c78'; x.fillRect(x0, y0, w, h);
  speckle(x, x0, y0, w, h, rng, 9000, 0.25);
  for (let k = 0; k < w; k += 128) { x.fillStyle = 'rgba(0,0,0,0.35)'; x.fillRect(x0 + k, y0, 3, h); x.fillStyle = 'rgba(255,255,255,0.08)'; x.fillRect(x0 + k + 3, y0, 2, h); }
  const pieces = ['NITRO', 'KRUSH', 'MF', 'ZER0', 'DRIFT'];
  const pal = [['#ff3d6e', '#ffd23a', '#2a1060'], ['#46e8ff', '#ffffff', '#102a60'], ['#9aff3a', '#ff6a1a', '#1a1a1a'], ['#ff8a2a', '#fff26a', '#5a1010'], ['#c25bff', '#46e8ff', '#140a30']];
  let px = x0 + 10;
  for (let i = 0; i < pieces.length && px < x0 + w - 60; i++) {
    const word = pieces[i], [fill, hi, out] = pal[i % pal.length];
    const size = h * (0.42 + rng() * 0.14);
    x.save();
    x.translate(px, y0 + h * 0.62);
    x.rotate((rng() - 0.5) * 0.12);
    x.font = `italic 900 ${size}px Arial Black, Impact, Arial, sans-serif`;
    x.lineJoin = 'round';
    const tw = x.measureText(word).width;
    // a cloud behind (the background colour)
    x.fillStyle = out;
    x.beginPath();
    for (let k = 0; k < 9; k++) { const cx = (k / 8) * tw, r = size * (0.32 + rng() * 0.18); x.moveTo(cx + r, -size * 0.3); x.arc(cx, -size * 0.3, r, 0, Math.PI * 2); }
    x.fill();
    // 3D drop
    x.fillStyle = '#0c0c0c';
    x.fillText(word, 6, 6);
    x.lineWidth = size * 0.14; x.strokeStyle = '#0c0c0c'; x.strokeText(word, 0, 0);
    // fill with a fade, highlights
    const g = x.createLinearGradient(0, -size * 0.8, 0, size * 0.1);
    g.addColorStop(0, hi); g.addColorStop(1, fill);
    x.fillStyle = g; x.fillText(word, 0, 0);
    x.lineWidth = 2; x.strokeStyle = '#ffffff'; x.globalAlpha = 0.6; x.strokeText(word, -1, -1); x.globalAlpha = 1;
    // drips
    for (let k = 0; k < 6; k++) { x.fillStyle = fill; x.fillRect(rng() * tw, 0, 2, 6 + rng() * 22); }
    // stars and arrows
    x.fillStyle = '#ffffff';
    for (let k = 0; k < 3; k++) { const sx = rng() * tw, sy = -size * (0.6 + rng() * 0.3); x.fillRect(sx - 6, sy - 1, 12, 2); x.fillRect(sx - 1, sy - 6, 2, 12); }
    x.restore();
    px += tw + 30 + rng() * 40;
  }
  tags(x, x0, y0 + 10, w, h * 0.3, rng, 10);
  tags(x, x0, y0 + h * 0.75, w, h * 0.25, rng, 8);
  streaks(x, x0, y0, w, h, rng, 26, '30,30,30', 0.22);
}

/** Plain brick, tiling (4 m × 4 m a repeat), neutral to be tinted: chimneys, piers, walls. */
export function plainBrick() {
  return once('bplain', () => {
    const S = 256, c = cnv(S, S), x = c.getContext('2d');
    const rng = makeRng('works-bplain');
    brickWall(x, 0, 0, S, S, rng, { ch: 8, bw: 16, base: 166, vary: 24 });
    for (let i = 0; i < 18; i++) blot(x, rng() * S, rng() * S, 10 + rng() * 30, `rgba(20,16,12,${0.04 + rng() * 0.06})`);
    speckle(x, 0, 0, S, S, rng, 2500, 0.12);
    return toTex(c);
  });
}

// ------------------------------------------------------------------ shared: fences, ground

/** Chain-link with razor wire on top (alpha): v 0..1 is the whole fence (0.8 mesh, 0.2 wire). */
export function chainlink() {
  return once('chainlink', () => {
    const S = 256, c = cnv(S, S), x = c.getContext('2d');
    x.clearRect(0, 0, S, S);
    const top = 56;
    // razor wire: overlapping coils
    x.strokeStyle = 'rgba(176,180,186,1)';
    x.lineWidth = 1.6;
    for (let k = -40; k < S + 40; k += 22) { x.beginPath(); x.ellipse(k, 26, 24, 20, 0.3, 0, Math.PI * 2); x.stroke(); }
    x.strokeStyle = 'rgba(120,124,130,1)';
    for (let k = -30; k < S + 40; k += 22) { x.beginPath(); x.ellipse(k, 28, 22, 18, -0.3, 0, Math.PI * 2); x.stroke(); }
    // the mesh
    x.strokeStyle = 'rgba(150,156,162,0.95)';
    x.lineWidth = 1.4;
    for (let k = -S; k < 2 * S; k += 10) {
      x.beginPath(); x.moveTo(k, top); x.lineTo(k + (S - top), S); x.stroke();
      x.beginPath(); x.moveTo(k + (S - top), top); x.lineTo(k, S); x.stroke();
    }
    // top rail and bottom wire
    x.fillStyle = 'rgba(110,114,118,1)';
    x.fillRect(0, top - 5, S, 6);
    x.fillRect(0, S - 4, S, 4);
    return toTex(c);
  });
}

/** Rail bed: ballast with timber sleepers across (u: 3.2 m across the track, v: 4.8 m along). */
export function railbed() {
  return once('railbed', () => {
    const W = 128, H = 192, c = cnv(W, H), x = c.getContext('2d');
    const rng = makeRng('railbed');
    x.fillStyle = '#5c5850'; x.fillRect(0, 0, W, H);
    for (let i = 0; i < 2600; i++) { const t = 60 + rng() * 80; x.fillStyle = `rgb(${t},${t * 0.95},${t * 0.88})`; x.fillRect(rng() * W, rng() * H, 1 + rng() * 2, 1 + rng() * 2); }
    // sleepers every 0.6 m (24 px), 2.6 m long of 3.2 m
    for (let y = 4; y < H; y += 24) {
      x.fillStyle = `rgb(${52 + rng() * 14},${40 + rng() * 10},${30 + rng() * 8})`;
      x.fillRect(W * 0.09, y, W * 0.82, 9);
      x.fillStyle = 'rgba(0,0,0,0.35)'; x.fillRect(W * 0.09, y + 8, W * 0.82, 2);
      for (let k = 0; k < 3; k++) { x.fillStyle = 'rgba(0,0,0,0.25)'; x.fillRect(W * 0.12 + rng() * W * 0.7, y + 2, 6, 1); }
    }
    // rust dust where the rails run
    for (const u of [0.28, 0.72]) { x.fillStyle = 'rgba(110,60,30,0.35)'; x.fillRect(W * u - 4, 0, 8, H); }
    return toTex(c);
  });
}
