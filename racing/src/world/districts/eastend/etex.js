// EASTSIDE — the canvas textures: a house atlas (clapboard, brick and
// stucco bays: windows with shutters and curtains, front doors with porch
// lights, garage doors; school and church walls), asphalt shingles, the
// high school's football field, and a sign atlas (strip-mall storefronts,
// the diner's neon, the bowling pin, gas prices, the water tower's name,
// the scoreboard, the drive-in's marquee and screen).
import { makeRng } from '../../../core/util.js';
import { toTex } from '../../../track/textures.js';
import { HOUSE, HS, ESIGN } from './atlas.js';
import { once, cnv, speckle, blot, streaks, pick, lighten, brickWall } from './tex.js';

function shadeHex(hex, k) {
  const v = parseInt(hex.slice(1), 16);
  return `rgb(${Math.round(((v >> 16) & 255) * k)},${Math.round(((v >> 8) & 255) * k)},${Math.round((v & 255) * k)})`;
}

// ------------------------------------------------------------------ houses

/** Clapboard / brick / stucco house bays (see atlas.js HS), 3 m × 3 m a tile: { map, emi }. */
export function houseAtlas() {
  return once('house', () => {
    const A = HOUSE;
    const c = cnv(A.W, A.H), e = cnv(A.W, A.H);
    const x = c.getContext('2d'), ex = e.getContext('2d');
    ex.fillStyle = '#000'; ex.fillRect(0, 0, A.W, A.H);
    const rng = makeRng('es-house');
    const T = A.tw, M = T / A.mw;                      // 42.7 px a metre
    const tile = (id) => [(id % 8) * T, Math.floor(id / 8) * T];
    const Yb = (ty, m) => ty + T - m * M;              // metres above the tile's foot → canvas y
    const siding = (tx, ty) => {
      for (let y = ty; y < ty + T; y += 8) {
        const v = 208 + Math.round((rng() - 0.5) * 8);
        x.fillStyle = `rgb(${v},${v - 1},${v - 4})`; x.fillRect(tx, y, T, 8);
        x.fillStyle = 'rgba(255,255,255,0.35)'; x.fillRect(tx, y, T, 1);
        x.fillStyle = 'rgba(40,36,30,0.32)'; x.fillRect(tx, y + 6, T, 2);
      }
      speckle(x, tx, ty, T, T, rng, 300, 0.08);
    };
    const brick = (tx, ty) => brickWall(x, tx, ty, T, T, rng, { ch: 4, bw: 8, base: 150, vary: 24, rgb: [1.02, 0.6, 0.48], mortar: 'rgb(200,192,180)' });
    const stucco = (tx, ty) => {
      x.fillStyle = 'rgb(226,220,208)'; x.fillRect(tx, ty, T, T);
      speckle(x, tx, ty, T, T, rng, 2200, 0.1, 1, '255,255,255', '90,80,70');
      for (let i = 0; i < 6; i++) blot(x, tx + rng() * T, ty + rng() * T, 8 + rng() * 20, 'rgba(120,100,80,0.06)');
    };
    const shakes = (tx, ty) => {
      for (let y = ty; y < ty + T; y += 10) {
        for (let px = tx - ((y - ty) / 10 % 2) * 6; px < tx + T; px += 12) {
          const v = 150 + rng() * 50;
          x.fillStyle = `rgb(${Math.round(v)},${Math.round(v * 0.95)},${Math.round(v * 0.88)})`;
          x.fillRect(Math.max(tx, px), y, Math.min(11, tx + T - px), 9);
        }
        x.fillStyle = 'rgba(0,0,0,0.3)'; x.fillRect(tx, y + 9, T, 1);
      }
    };
    /** A double-hung window; lit 0 dark, 1 warm, 2 TV-blue. */
    const window = (tx, ty, o = {}) => {
      const w = (o.w || 1.0) * M, h = (o.h || 1.45) * M, cx = tx + (o.cx ?? 0.5) * T;
      const x0 = cx - w / 2, y1 = Yb(ty, o.sill ?? 0.95), y0 = y1 - h;
      x.fillStyle = o.trim || '#f6f4ee'; x.fillRect(x0 - 4, y0 - 5, w + 8, h + 10);
      if (o.shutters) {
        for (const sx of [x0 - 4 - 17, x0 + w + 4]) {
          x.fillStyle = o.shutters; x.fillRect(sx, y0 - 3, 15, h + 6);
          for (let k = y0; k < y0 + h; k += 4) { x.fillStyle = 'rgba(0,0,0,0.3)'; x.fillRect(sx + 2, k, 11, 1); }
        }
      }
      const lit = o.lit || 0;
      if (lit) {
        const warm = lit === 1;
        x.fillStyle = warm ? '#d8b888' : '#8aa0c8'; x.fillRect(x0, y0, w, h);
        const g = ex.createRadialGradient(cx, y0 + h * 0.55, 2, cx, y0 + h * 0.55, w * 0.8);
        g.addColorStop(0, warm ? 'rgba(255,214,150,1)' : 'rgba(150,190,255,1)');
        g.addColorStop(1, warm ? 'rgba(255,170,90,0.75)' : 'rgba(90,120,220,0.7)');
        ex.fillStyle = g; ex.fillRect(x0, y0, w, h);
        if (warm || rng() < 0.5) {
          x.fillStyle = pick(rng, ['#e8d8c0', '#c8a8a0', '#a8b8c8', '#e0c890']);
          x.fillRect(x0, y0, w * 0.22, h); x.fillRect(x0 + w * 0.78, y0, w * 0.22, h);
          ex.fillStyle = 'rgba(0,0,0,0.55)'; ex.fillRect(x0, y0, w * 0.22, h); ex.fillRect(x0 + w * 0.78, y0, w * 0.22, h);
        }
      } else {
        const g = x.createLinearGradient(0, y0, 0, y0 + h);
        g.addColorStop(0, '#5a6a7a'); g.addColorStop(0.5, '#28323c'); g.addColorStop(1, '#1a2028');
        x.fillStyle = g; x.fillRect(x0, y0, w, h);
        if (rng() < 0.5) { x.fillStyle = 'rgba(230,226,214,0.85)'; x.fillRect(x0, y0, w, h * (0.3 + rng() * 0.4)); }
      }
      x.fillStyle = o.trim || '#f6f4ee';
      x.fillRect(x0, y0 + h / 2 - 2, w, 4);
      if (o.panes !== false) {
        for (const [a, b] of [[y0, y0 + h / 2], [y0 + h / 2, y0 + h]]) { x.fillRect(x0 + w / 2 - 1, a, 2, b - a); x.fillRect(x0, (a + b) / 2 - 1, w, 2); }
        if (lit) { ex.fillStyle = 'rgba(0,0,0,0.8)'; ex.fillRect(x0, y0 + h / 2 - 2, w, 4); ex.fillRect(x0 + w / 2 - 1, y0, 2, h); }
      }
      if (o.bars) for (const f of o.bars) { x.fillStyle = o.trim || '#f6f4ee'; x.fillRect(x0 + w * f - 2, y0, 4, h); if (lit) { ex.fillStyle = '#000'; ex.fillRect(x0 + w * f - 2, y0, 4, h); } }
      x.fillStyle = 'rgba(0,0,0,0.3)'; x.fillRect(x0 - 5, y1 + 5, w + 10, 3);
    };
    const door = (tx, ty, o = {}) => {
      const w = 0.95 * M, h = 2.1 * M, cx = tx + T / 2, x0 = cx - w / 2, y0 = Yb(ty, 2.1);
      x.fillStyle = '#f6f4ee'; x.fillRect(x0 - 5, y0 - 6, w + 10, h + 6);
      x.fillStyle = o.color || pick(rng, ['#7a1e1e', '#1e3a5a', '#2a4a2a', '#1a1a1a', '#6a4a2a']);
      x.fillRect(x0, y0, w, h);
      x.fillStyle = 'rgba(0,0,0,0.25)';
      for (const [px, py, pw, ph] of [[0.15, 0.32, 0.3, 0.28], [0.55, 0.32, 0.3, 0.28], [0.15, 0.66, 0.3, 0.28], [0.55, 0.66, 0.3, 0.28]]) x.fillRect(x0 + w * px, y0 + h * py, w * pw, h * ph);
      x.fillStyle = o.lit ? '#e8c890' : '#3a4450';
      x.fillRect(x0 + w * 0.15, y0 + h * 0.06, w * 0.7, h * 0.18);
      if (o.lit) { ex.fillStyle = 'rgba(255,200,130,0.9)'; ex.fillRect(x0 + w * 0.15, y0 + h * 0.06, w * 0.7, h * 0.18); }
      x.fillStyle = '#d8c070'; x.fillRect(x0 + w * 0.82, y0 + h * 0.55, 3, 3);
      // a porch light beside it
      const lx = x0 + w + 12, ly = y0 + 18;
      x.fillStyle = '#2a2a2a'; x.fillRect(lx - 3, ly - 6, 6, 14);
      x.fillStyle = '#ffe0a0'; x.fillRect(lx - 2, ly - 4, 4, 9);
      ex.fillStyle = '#ffd890'; ex.fillRect(lx - 2, ly - 4, 4, 9);
      blot(ex, lx, ly, 18, 'rgba(255,190,110,0.45)');
      x.fillStyle = '#2a2a2a'; x.font = 'bold 9px Arial'; x.fillText(String(100 + Math.floor(rng() * 899)), x0 - 26, y0 + 30);
    };
    const garage = (tx, ty, o = {}) => {
      const half = o.half;
      const h = 2.2 * M, y0 = Yb(ty, 2.2);
      const x0 = half === 'L' ? tx + 0.35 * M : half === 'R' ? tx : tx + (T - 2.6 * M) / 2;
      const ww = half ? T - 0.35 * M : 2.6 * M;
      x.fillStyle = '#f6f4ee'; x.fillRect(half === 'R' ? x0 : x0 - 5, y0 - 6, ww + (half ? 5 : 10), h + 6);
      x.fillStyle = '#e6e2d8'; x.fillRect(x0, y0, ww, h);
      const rows = 4, cols = 4;
      for (let r = 0; r < rows; r++) {
        for (let k = 0; k < cols; k++) {
          const px = x0 + 4 + k * ((ww - 8) / cols), py = y0 + 4 + r * ((h - 8) / rows);
          const pw = (ww - 8) / cols - 5, ph = (h - 8) / rows - 6;
          if (o.windows && r === 0) { x.fillStyle = '#2a323c'; x.fillRect(px, py, pw, ph); continue; }
          x.fillStyle = 'rgba(0,0,0,0.12)'; x.fillRect(px, py + ph - 2, pw, 2);
          x.fillStyle = 'rgba(255,255,255,0.3)'; x.fillRect(px, py, pw, 2);
        }
        x.fillStyle = 'rgba(0,0,0,0.18)'; x.fillRect(x0, y0 + (r + 1) * (h / rows) - 1, ww, 2);
      }
    };
    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        const id = row * 8 + col, [tx, ty] = tile(id);
        if (row === 0 || row === 1) siding(tx, ty);
        else if (row === 2 || row === 5) brick(tx, ty);
        else if (row === 3 || row === 6) stucco(tx, ty);
        else if (row === 4) { if (id === HS.shingleSide) shakes(tx, ty); else siding(tx, ty); }
        else { x.fillStyle = '#d8d4cc'; x.fillRect(tx, ty, T, T); }
      }
    }
    const S = (id) => tile(id);
    const shut = () => pick(rng, ['#1e2e22', '#1a1a1a', '#22304a', '#4a1e1e']);
    window(...S(HS.win), { shutters: shut() });
    window(...S(HS.winLit), { shutters: shut(), lit: 1 });
    window(...S(HS.winTV), { lit: 2 });
    window(...S(HS.picture), { w: 2.3, h: 1.4, panes: false, bars: [0.28, 0.72] });
    window(...S(HS.pictureLit), { w: 2.3, h: 1.4, panes: false, bars: [0.28, 0.72], lit: 1 });
    window(...S(HS.small), { w: 0.6, h: 0.7, sill: 1.6, panes: false });
    window(...S(HS.smallLit), { w: 0.6, h: 0.7, sill: 1.6, panes: false, lit: 1 });
    door(...S(HS.door), {});
    door(...S(HS.doorLit), { lit: true });
    garage(...S(HS.garage), {});
    garage(...S(HS.garageWin), { windows: true });
    garage(...S(HS.garage2L), { half: 'L' });
    garage(...S(HS.garage2R), { half: 'R' });
    { const [tx, ty] = S(HS.vent); x.fillStyle = '#f6f4ee'; x.fillRect(tx + 54, ty + 50, 20, 14); for (let k = 0; k < 14; k += 3) { x.fillStyle = 'rgba(0,0,0,0.4)'; x.fillRect(tx + 56, ty + 51 + k, 16, 1); } }
    window(...S(HS.shutters), { shutters: shut() });
    // brick
    window(...S(HS.bWin), { trim: '#e8e4dc' });
    window(...S(HS.bWinLit), { trim: '#e8e4dc', lit: 1 });
    window(...S(HS.bPicture), { w: 2.3, h: 1.4, panes: false, bars: [0.28, 0.72], trim: '#e8e4dc' });
    window(...S(HS.bPictureLit), { w: 2.3, h: 1.4, panes: false, bars: [0.28, 0.72], trim: '#e8e4dc', lit: 1 });
    door(...S(HS.bDoor), {});
    garage(...S(HS.bGarage), {});
    window(...S(HS.bSmall), { w: 0.6, h: 0.7, sill: 1.6, panes: false, trim: '#e8e4dc' });
    // stucco: arched windows, terracotta trim
    const arched = (tx, ty, lit) => {
      window(tx, ty, { w: 1.1, h: 1.3, panes: false, trim: '#c87850', lit });
      const cx = tx + T / 2, w = 1.1 * M, y0 = Yb(ty, 0.95) - 1.3 * M;
      x.fillStyle = '#c87850'; x.beginPath(); x.arc(cx, y0, w / 2 + 4, Math.PI, 0); x.fill();
      x.fillStyle = lit ? '#d8b888' : '#28323c'; x.beginPath(); x.arc(cx, y0, w / 2, Math.PI, 0); x.fill();
      if (lit) { ex.fillStyle = 'rgba(255,200,130,0.9)'; ex.beginPath(); ex.arc(cx, y0, w / 2, Math.PI, 0); ex.fill(); }
    };
    window(...S(HS.sWin), { trim: '#c87850' });
    window(...S(HS.sWinLit), { trim: '#c87850', lit: 1 });
    arched(...S(HS.sArch), 0);
    arched(...S(HS.sArchLit), 1);
    door(...S(HS.sDoor), { color: '#5a3a22' });
    garage(...S(HS.sGarage), {});
    window(...S(HS.sSmall), { w: 0.6, h: 0.7, sill: 1.6, panes: false, trim: '#c87850' });
    // attic
    window(...S(HS.dormer), { w: 0.9, h: 1.1, sill: 0.8 });
    window(...S(HS.dormerLit), { w: 0.9, h: 1.1, sill: 0.8, lit: 1 });
    {
      const [tx, ty] = S(HS.gableVent);
      x.fillStyle = '#f6f4ee'; x.beginPath(); x.moveTo(tx + 64, ty + 34); x.lineTo(tx + 94, ty + 70); x.lineTo(tx + 34, ty + 70); x.fill();
      for (let k = 44; k < 70; k += 4) { x.fillStyle = 'rgba(0,0,0,0.35)'; x.fillRect(tx + 64 - (k - 34) * 0.8, ty + k, (k - 34) * 1.6, 1); }
    }
    window(...S(HS.attic), { w: 0.7, h: 0.9, sill: 1.1 });
    window(...S(HS.atticLit), { w: 0.7, h: 0.9, sill: 1.1, lit: 1 });
    { const [tx, ty] = S(HS.porchCeil); x.fillStyle = '#e8e4da'; x.fillRect(tx, ty, T, T); for (let k = 0; k < T; k += 6) { x.fillStyle = 'rgba(0,0,0,0.12)'; x.fillRect(tx, ty + k, T, 1); } }
    { const [tx, ty] = S(HS.lattice); x.fillStyle = '#2a2622'; x.fillRect(tx, ty, T, T); x.strokeStyle = '#f0ece2'; x.lineWidth = 3; for (let k = -T; k < 2 * T; k += 14) { x.beginPath(); x.moveTo(tx + k, ty); x.lineTo(tx + k + T, ty + T); x.stroke(); x.beginPath(); x.moveTo(tx + k + T, ty); x.lineTo(tx + k, ty + T); x.stroke(); } }
    // school: ribbon windows in brick
    const ribbon = (tx, ty, lit, y0m = 1.0, y1m = 2.4) => {
      const y0 = Yb(ty, y1m), y1 = Yb(ty, y0m);
      x.fillStyle = '#b8bcc0'; x.fillRect(tx, y0 - 3, T, y1 - y0 + 6);
      for (let k = 0; k < 4; k++) {
        const px = tx + k * 32 + 2, pw = 28;
        if (lit && rng() < 0.85) {
          x.fillStyle = '#c8d8e0'; x.fillRect(px, y0, pw, y1 - y0);
          ex.fillStyle = `rgba(${Math.round(200 + rng() * 40)},${Math.round(225 + rng() * 30)},255,${0.6 + rng() * 0.35})`; ex.fillRect(px, y0, pw, y1 - y0);
        } else {
          const g = x.createLinearGradient(0, y0, 0, y1); g.addColorStop(0, '#5a6a78'); g.addColorStop(1, '#202830');
          x.fillStyle = g; x.fillRect(px, y0, pw, y1 - y0);
        }
      }
    };
    ribbon(...S(HS.schoolWin), false);
    ribbon(...S(HS.schoolWinLit), true);
    {
      const [tx, ty] = S(HS.schoolDoor);
      x.fillStyle = '#b8bcc0'; x.fillRect(tx + 24, Yb(ty, 2.6), 80, 2.6 * M);
      for (const px of [28, 66]) { x.fillStyle = '#c8d8e0'; x.fillRect(tx + px, Yb(ty, 2.4), 34, 2.3 * M); ex.fillStyle = 'rgba(210,230,255,0.7)'; ex.fillRect(tx + px, Yb(ty, 2.4), 34, 2.3 * M); }
      x.fillStyle = '#1a6a2a'; x.fillRect(tx + 52, Yb(ty, 2.9), 24, 8); ex.fillStyle = '#30ff60'; ex.fillRect(tx + 52, Yb(ty, 2.9), 24, 8);
    }
    {
      const [tx, ty] = S(HS.gym);
      x.fillStyle = '#b8bcc0'; x.fillRect(tx, Yb(ty, 2.8), T, 0.7 * M);
      for (let k = 0; k < 4; k++) { x.fillStyle = '#c8d8e0'; x.fillRect(tx + k * 32 + 3, Yb(ty, 2.7), 26, 0.5 * M); ex.fillStyle = 'rgba(220,235,255,0.55)'; ex.fillRect(tx + k * 32 + 3, Yb(ty, 2.7), 26, 0.5 * M); }
    }
    // church: pointed lancets of stained glass
    const lancet = (tx, ty, lit) => {
      const cx = tx + T / 2, w = 0.9 * M, y1 = Yb(ty, 0.4), y0 = Yb(ty, 2.5);
      x.fillStyle = '#d8d0c0';
      x.beginPath(); x.moveTo(cx - w / 2 - 5, y1 + 4); x.lineTo(cx - w / 2 - 5, y0 + w / 2); x.quadraticCurveTo(cx - w / 2 - 5, y0 - 10, cx, y0 - 14); x.quadraticCurveTo(cx + w / 2 + 5, y0 - 10, cx + w / 2 + 5, y0 + w / 2); x.lineTo(cx + w / 2 + 5, y1 + 4); x.fill();
      const cols = ['#c8202a', '#2040c8', '#e8b020', '#20a040', '#8030b0'];
      x.save(); x.beginPath(); x.moveTo(cx - w / 2, y1); x.lineTo(cx - w / 2, y0 + w / 2); x.quadraticCurveTo(cx - w / 2, y0 - 6, cx, y0 - 10); x.quadraticCurveTo(cx + w / 2, y0 - 6, cx + w / 2, y0 + w / 2); x.lineTo(cx + w / 2, y1); x.clip();
      ex.save(); ex.beginPath(); ex.moveTo(cx - w / 2, y1); ex.lineTo(cx - w / 2, y0 + w / 2); ex.quadraticCurveTo(cx - w / 2, y0 - 6, cx, y0 - 10); ex.quadraticCurveTo(cx + w / 2, y0 - 6, cx + w / 2, y0 + w / 2); ex.lineTo(cx + w / 2, y1); ex.clip();
      for (let yy = y0 - 12; yy < y1; yy += 8) {
        for (let xx = cx - w / 2; xx < cx + w / 2; xx += 8) {
          const col = pick(rng, cols);
          x.fillStyle = lit ? col : shadeHex(col, 0.3);
          x.fillRect(xx, yy, 7, 7);
          if (lit) { ex.fillStyle = col; ex.globalAlpha = 0.8; ex.fillRect(xx, yy, 7, 7); ex.globalAlpha = 1; }
        }
      }
      x.restore(); ex.restore();
    };
    lancet(...S(HS.churchWin), false);
    lancet(...S(HS.churchWinLit), true);
    {
      const [tx, ty] = S(HS.churchDoor);
      const cx = tx + T / 2, w = 1.8 * M, y1 = ty + T, y0 = Yb(ty, 2.6);
      x.fillStyle = '#d8d0c0'; x.beginPath(); x.moveTo(cx - w / 2 - 5, y1); x.lineTo(cx - w / 2 - 5, y0 + 10); x.quadraticCurveTo(cx, y0 - 28, cx + w / 2 + 5, y0 + 10); x.lineTo(cx + w / 2 + 5, y1); x.fill();
      x.fillStyle = '#5a3420'; x.beginPath(); x.moveTo(cx - w / 2, y1); x.lineTo(cx - w / 2, y0 + 12); x.quadraticCurveTo(cx, y0 - 22, cx + w / 2, y0 + 12); x.lineTo(cx + w / 2, y1); x.fill();
      x.fillStyle = 'rgba(0,0,0,0.35)'; x.fillRect(cx - 1, y0, 2, y1 - y0);
      for (const sx of [-1, 1]) x.fillRect(cx + sx * w / 4, y0 + 30, 2, y1 - y0 - 34);
    }
    // shop walls
    { const [tx, ty] = S(HS.stuccoTrim); x.fillStyle = '#8a3a2a'; x.fillRect(tx, ty + 8, T, 10); }
    {
      const [tx, ty] = S(HS.rearDoor);
      x.fillStyle = '#6a6e72'; x.fillRect(tx + 44, Yb(ty, 2.1), 40, 2.1 * M);
      x.fillStyle = '#ffd890'; x.fillRect(tx + 58, Yb(ty, 2.5), 12, 6); ex.fillStyle = '#ffc070'; ex.fillRect(tx + 58, Yb(ty, 2.5), 12, 6);
    }
    const block = (tx, ty) => {
      x.fillStyle = '#b4b2ac'; x.fillRect(tx, ty, T, T);
      for (let y = 0; y < T; y += 8) { x.fillStyle = 'rgba(0,0,0,0.22)'; x.fillRect(tx, ty + y, T, 1); for (let k = ((y / 8) % 2) * 8; k < T; k += 16) x.fillRect(tx + k, ty + y, 1, 8); }
      speckle(x, tx, ty, T, T, rng, 600, 0.12);
    };
    block(...S(HS.block)); block(...S(HS.blockVent));
    { const [tx, ty] = S(HS.blockVent); x.fillStyle = '#5a5c5e'; x.fillRect(tx + 44, ty + 30, 40, 26); for (let k = 0; k < 26; k += 4) { x.fillStyle = 'rgba(0,0,0,0.5)'; x.fillRect(tx + 46, ty + 31 + k, 36, 2); } }
    { const [tx, ty] = S(HS.trimBand); x.fillStyle = '#f2eee4'; x.fillRect(tx, ty, T, T); x.fillStyle = '#1d4fa8'; x.fillRect(tx, ty + 40, T, 22); }
    { const [tx, ty] = S(HS.white); x.fillStyle = '#f0ede6'; x.fillRect(tx, ty, T, T); speckle(x, tx, ty, T, T, rng, 400, 0.06); }
    // a little grime at the foot of every wall
    for (let id = 0; id < 56; id++) {
      const [tx, ty] = tile(id);
      const g = x.createLinearGradient(0, ty + T - 18, 0, ty + T);
      g.addColorStop(0, 'rgba(40,36,30,0)'); g.addColorStop(1, 'rgba(40,36,30,0.22)');
      x.fillStyle = g; x.fillRect(tx, ty + T - 18, T, 18);
    }
    return { map: toTex(c), emi: toTex(e) };
  });
}

/** Asphalt shingles, neutral (vertex-tinted), 4 m a repeat. */
export function shingles() {
  return once('shingles', () => {
    const S = 256, c = cnv(S, S), x = c.getContext('2d');
    const rng = makeRng('es-shingles');
    x.fillStyle = '#7a7a78'; x.fillRect(0, 0, S, S);
    for (let y = 0, row = 0; y < S; y += 8, row++) {
      for (let px = (row % 2) * 8 - 16; px < S; px += 16) {
        const v = 150 + rng() * 60 - (rng() < 0.08 ? 40 : 0);
        x.fillStyle = `rgb(${Math.round(v)},${Math.round(v)},${Math.round(v * 0.98)})`;
        x.fillRect(px, y, 15, 7);
      }
      x.fillStyle = 'rgba(0,0,0,0.42)'; x.fillRect(0, y + 7, S, 1);
    }
    speckle(x, 0, 0, S, S, rng, 5000, 0.15);
    for (let i = 0; i < 12; i++) blot(x, rng() * S, rng() * S, 10 + rng() * 30, 'rgba(30,40,20,0.08)');
    return toTex(c);
  });
}

/** A high school football field (u along its length, 120 yd × 53 yd). */
export function footballField() {
  return once('field', () => {
    const W = 1024, H = 512, c = cnv(W, H), x = c.getContext('2d');
    const rng = makeRng('es-field');
    const yd = W / 120;
    for (let k = 0; k < 24; k++) { x.fillStyle = k % 2 ? '#3f7a2c' : '#478a32'; x.fillRect(k * 5 * yd, 0, 5 * yd + 1, H); }
    speckle(x, 0, 0, W, H, rng, 9000, 0.12, 1, '120,180,90', '20,40,10');
    for (const [x0, flip] of [[0, false], [110 * yd, true]]) {
      x.fillStyle = '#1d2f6a'; x.fillRect(x0, 0, 10 * yd, H);
      x.save(); x.translate(x0 + 5 * yd, H / 2); x.rotate(flip ? Math.PI / 2 : -Math.PI / 2);
      x.fillStyle = '#e8b830'; x.font = '900 52px Arial Black, Arial'; x.textAlign = 'center'; x.textBaseline = 'middle';
      x.fillText('EAGLES', 0, 0); x.restore();
    }
    x.fillStyle = '#f2f2ec';
    for (let k = 10; k <= 110; k += 5) x.fillRect(k * yd - 1.5, 6, 3, H - 12);
    for (let k = 11; k < 110; k++) { x.fillRect(k * yd - 1, 6, 2, 10); x.fillRect(k * yd - 1, H - 16, 2, 10); x.fillRect(k * yd - 1, H * 0.38, 2, 8); x.fillRect(k * yd - 1, H * 0.62 - 8, 2, 8); }
    x.strokeStyle = '#f2f2ec'; x.lineWidth = 6; x.strokeRect(3, 3, W - 6, H - 6);
    x.font = 'bold 34px Arial'; x.textAlign = 'center'; x.textBaseline = 'middle';
    const nums = [10, 20, 30, 40, 50, 40, 30, 20, 10];
    nums.forEach((n, k) => { const px = (20 + k * 10) * yd; x.fillText(String(n), px, H * 0.2); x.save(); x.translate(px, H * 0.8); x.rotate(Math.PI); x.fillText(String(n), 0, 0); x.restore(); });
    x.fillStyle = '#e8b830'; x.beginPath(); x.arc(60 * yd, H / 2, 46, 0, Math.PI * 2); x.fill();
    x.fillStyle = '#1d2f6a'; x.beginPath(); x.arc(60 * yd, H / 2, 40, 0, Math.PI * 2); x.fill();
    x.fillStyle = '#e8b830'; x.font = '900 40px Arial Black'; x.fillText('E', 60 * yd, H / 2 + 2);
    return toTex(c);
  });
}

// ------------------------------------------------------------------ stores and signs

/** Storefronts, signs and lettering (see atlas.js ESIGN): { map, emi }. */
export function eastSigns() {
  return once('esigns', () => {
    const A = ESIGN;
    const c = cnv(A.W, A.H), e = cnv(A.W, A.H);
    const x = c.getContext('2d'), ex = e.getContext('2d');
    x.fillStyle = '#202020'; x.fillRect(0, 0, A.W, A.H);
    ex.fillStyle = '#000'; ex.fillRect(0, 0, A.W, A.H);
    const rng = makeRng('es-signs');
    const R = (k) => A[k];
    const text = (g, s, cx, cy, size, col, o = {}) => {
      g.save();
      g.font = o.font || `${o.italic ? 'italic ' : ''}900 ${size}px ${o.face || 'Arial Black, Arial'}`;
      g.textAlign = 'center'; g.textBaseline = 'middle';
      if (o.stroke) { g.lineWidth = o.stroke; g.strokeStyle = o.strokeCol || '#000'; g.strokeText(s, cx, cy, o.max); }
      g.fillStyle = col; g.fillText(s, cx, cy, o.max);
      g.restore();
    };
    const neon = (s, cx, cy, size, col, o = {}) => {
      const font = `${o.italic ? 'italic ' : ''}bold ${size}px ${o.face || 'Arial, sans-serif'}`;
      for (const g of [x, ex]) {
        g.save(); g.font = font; g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineJoin = 'round';
        if (g === ex) {
          g.shadowColor = col; g.shadowBlur = size * 0.3; g.globalAlpha = 0.75;
          g.lineWidth = size * 0.11; g.strokeStyle = col; g.strokeText(s, cx, cy, o.max);
          g.shadowBlur = 0; g.globalAlpha = 0.9; g.lineWidth = size * 0.04; g.strokeStyle = lighten(col); g.strokeText(s, cx, cy, o.max);
        } else {
          g.lineWidth = size * 0.1; g.strokeStyle = col; g.strokeText(s, cx, cy, o.max);
        }
        g.restore();
      }
    };
    /** A lit box: its face glows (dark letters), or (darkFace) its letters glow. */
    const litBox = (x0, y0, w, h, face, txt, ink, o = {}) => {
      x.fillStyle = '#1a1a1a'; x.fillRect(x0, y0, w, h);
      x.fillStyle = face; x.fillRect(x0 + 3, y0 + 3, w - 6, h - 6);
      const size = o.size || h * 0.55;
      if (o.darkFace) {
        text(x, txt, x0 + w / 2, y0 + h / 2 + 1, size, ink, { max: w - 12, italic: o.italic, face: o.face });
        text(ex, txt, x0 + w / 2, y0 + h / 2 + 1, size, ink, { max: w - 12, italic: o.italic, face: o.face });
      } else {
        ex.fillStyle = face; ex.globalAlpha = 0.8; ex.fillRect(x0 + 3, y0 + 3, w - 6, h - 6); ex.globalAlpha = 1;
        text(x, txt, x0 + w / 2, y0 + h / 2 + 1, size, ink, { max: w - 12, italic: o.italic, face: o.face });
        text(ex, txt, x0 + w / 2, y0 + h / 2 + 1, size, '#000', { max: w - 12, italic: o.italic, face: o.face });
      }
    };
    // ---- storefronts: 6 m × 4.5 m each, a sign band over a lit shop window
    const STORES = [
      ['VIDEO WORLD', '#1d3fa8', '#ffe040', 'video'], ['DONUTS', '#f2b8c8', '#a8203a', 'food'], ['NAILS', '#2a1a2a', '#ff5ad8', 'neon'], ['PIZZA', '#c8201a', '#ffffff', 'food'],
      ['DRY CLEAN', '#f0f0e8', '#1d3fa8', 'clean'], ['LIQUOR', '#f4f0e4', '#b3141a', 'store'], ['CHINA WOK', '#c8201a', '#ffd040', 'food'], ['HARDWARE', '#e86a1a', '#ffffff', 'store'],
      ['TANNING', '#1a1a1a', '#ffb02a', 'neon'], ['PET SHOP', '#2a8a4a', '#ffffff', 'store'], ['SUBS', '#2a6a2a', '#ffe040', 'food'], ['GAMES', '#1a1a2a', '#3ae0ff', 'video'],
      ['BARBER', '#f4f0e4', '#c8201a', 'clean'], ['FOR LEASE', '#d8d4c8', '#5a5a5a', 'dark'], ['VIDEO', '#c8201a', '#ffffff', 'video'], ['CARDS & GIFTS', '#7a2a6a', '#ffffff', 'store'],
    ];
    for (let k = 0; k < 16; k++) {
      const x0 = (k % 8) * 128, y0 = Math.floor(k / 8) * 96;
      const [name, face, ink, kind] = STORES[k];
      x.fillStyle = '#d8d0c0'; x.fillRect(x0, y0, 128, 96);
      if (kind === 'neon') { x.fillStyle = '#1a1a1a'; x.fillRect(x0 + 6, y0 + 4, 116, 22); neon(name, x0 + 64, y0 + 15, 17, ink, { max: 106 }); }
      else litBox(x0 + 6, y0 + 4, 116, 22, face, name, ink, { size: 15 });
      const dark = kind === 'dark';
      const gy0 = y0 + 34, gy1 = y0 + 92;
      x.fillStyle = dark ? '#14181c' : kind === 'food' ? '#c89060' : kind === 'clean' ? '#e8eef0' : kind === 'video' ? '#3a3a6a' : '#e8e0c8';
      x.fillRect(x0 + 6, gy0, 116, gy1 - gy0);
      if (!dark) {
        const g = ex.createLinearGradient(0, gy0, 0, gy1);
        g.addColorStop(0, kind === 'video' ? 'rgba(160,170,255,0.9)' : 'rgba(255,240,210,0.95)');
        g.addColorStop(1, 'rgba(255,220,170,0.5)');
        ex.fillStyle = g; ex.fillRect(x0 + 6, gy0, 116, gy1 - gy0);
        for (let q = 0; q < 6; q++) {
          const px = x0 + 10 + rng() * 100, ph = 6 + rng() * 20;
          x.fillStyle = `rgba(${Math.round(40 + rng() * 80)},${Math.round(30 + rng() * 60)},${Math.round(30 + rng() * 60)},0.85)`; x.fillRect(px, gy1 - ph, 6 + rng() * 10, ph);
          ex.fillStyle = 'rgba(0,0,0,0.75)'; ex.fillRect(px, gy1 - ph, 6, ph);
        }
        if (rng() < 0.7) { x.fillStyle = '#ff2a2a'; x.font = 'bold 9px Arial'; x.fillText('OPEN', x0 + 16, gy0 + 12); ex.fillStyle = '#ff3a3a'; ex.font = 'bold 9px Arial'; ex.fillText('OPEN', x0 + 16, gy0 + 12); }
      } else {
        x.fillStyle = '#f2eee4'; x.fillRect(x0 + 40, gy0 + 14, 46, 22);
        x.fillStyle = '#b3261e'; x.font = 'bold 8px Arial'; x.fillText('FOR LEASE', x0 + 43, gy0 + 28);
      }
      x.fillStyle = '#3a3c40';
      for (const mx of [6, 44, 84, 120]) x.fillRect(x0 + mx, gy0, 2, gy1 - gy0);
      x.fillRect(x0 + 6, gy0, 116, 2);
      x.fillStyle = '#2a2c30'; x.fillRect(x0 + 84, gy0 + 8, 2, gy1 - gy0 - 8); x.fillRect(x0 + 6, gy1 - 4, 116, 4);
      ex.fillStyle = '#000'; for (const mx of [6, 44, 84, 120]) ex.fillRect(x0 + mx, gy0, 2, gy1 - gy0);
    }
    // ---- the diner
    {
      const [x0, y0, w, h] = R('dinerSign');
      x.fillStyle = '#101418'; x.fillRect(x0, y0, w, h);
      neon('Starlite', x0 + w * 0.42, y0 + h * 0.42, 64, '#ff3a8a', { italic: true, face: 'Georgia, serif', max: w * 0.7 });
      neon('DINER', x0 + w * 0.42, y0 + h * 0.84, 26, '#3ae0ff', { max: w * 0.5 });
      for (const g of [x, ex]) {
        g.save(); g.translate(x0 + w * 0.88, y0 + h * 0.42); g.strokeStyle = '#ffd040'; g.lineWidth = g === ex ? 5 : 3; if (g === ex) { g.shadowColor = '#ffd040'; g.shadowBlur = 10; }
        g.beginPath(); for (let k = 0; k < 10; k++) { const r = k % 2 ? 14 : 34, a = -Math.PI / 2 + k * Math.PI / 5; g.lineTo(Math.cos(a) * r, Math.sin(a) * r); } g.closePath(); g.stroke(); g.restore();
      }
    }
    // ---- BOWL-O-RAMA
    {
      const [x0, y0, w, h] = R('bowl');
      x.fillStyle = '#121216'; x.fillRect(x0, y0, w, h);
      for (const g of [x, ex]) {
        g.save(); g.translate(x0 + w * 0.3, y0 + h * 0.5);
        g.fillStyle = g === ex ? 'rgba(255,255,255,0.85)' : '#f4f2ea';
        g.beginPath(); g.ellipse(0, -60, 18, 22, 0, 0, Math.PI * 2); g.ellipse(0, 30, 34, 64, 0, 0, Math.PI * 2); g.fill();
        g.fillStyle = g === ex ? 'rgba(255,40,40,1)' : '#d81e1e'; g.fillRect(-20, -34, 40, 8); g.fillRect(-24, -20, 48, 8);
        g.restore();
      }
      neon('BOWL', x0 + w * 0.72, y0 + h * 0.3, 40, '#3ae0ff', { max: w * 0.5 });
      neon('O', x0 + w * 0.72, y0 + h * 0.5, 34, '#ff3a8a');
      neon('RAMA', x0 + w * 0.72, y0 + h * 0.7, 36, '#ffb02a', { max: w * 0.5 });
    }
    // ---- gas prices (2004)
    {
      const [x0, y0, w, h] = R('gas');
      x.fillStyle = '#1a1a1a'; x.fillRect(x0, y0, w, h);
      litBox(x0 + 6, y0 + 6, w - 12, 40, '#c8201a', 'EASTGATE GAS', '#ffffff', { size: 26 });
      const rows = [['REG', '1.89'], ['PLUS', '1.99'], ['SUPER', '2.09']];
      rows.forEach(([n, p], k) => {
        const yy = y0 + 54 + k * 24;
        x.fillStyle = '#f4f2ea'; x.fillRect(x0 + 10, yy, 90, 20);
        text(x, n, x0 + 55, yy + 10, 13, '#1a1a1a');
        x.fillStyle = '#0a0a0a'; x.fillRect(x0 + 110, yy, 136, 20);
        text(x, p, x0 + 178, yy + 10, 18, '#ff3a2a', { font: 'bold 18px Courier New, monospace' });
        text(ex, p, x0 + 178, yy + 10, 18, '#ff3a2a', { font: 'bold 18px Courier New, monospace' });
        ex.fillStyle = 'rgba(255,255,255,0.6)'; ex.fillRect(x0 + 10, yy, 90, 20);
      });
    }
    // ---- EASTGATE PLAZA pylon
    {
      const [x0, y0, w, h] = R('plaza');
      x.fillStyle = '#1a1a1a'; x.fillRect(x0, y0, w, h);
      litBox(x0 + 4, y0 + 4, w - 8, 44, '#1d2f6a', 'EASTGATE PLAZA', '#ffd040', { size: 26, darkFace: true });
      ['VIDEO WORLD', 'DONUTS', 'CHINA WOK', 'HARDWARE'].forEach((t, k) => litBox(x0 + 4 + (k % 2) * (w / 2 - 4), y0 + 52 + Math.floor(k / 2) * 36, w / 2 - 4, 34, '#f4f2ea', t, '#1a1a1a', { size: 14 }));
    }
    {
      const [x0, y0, w, h] = R('water');
      x.fillStyle = '#c8ccd0'; x.fillRect(x0, y0, w, h);
      text(x, 'EASTSIDE', x0 + w / 2, y0 + h / 2 + 2, 70, '#1d2f6a', { max: w - 20 });
    }
    {
      const [x0, y0, w, h] = R('school');
      x.fillStyle = '#7a3a2a'; x.fillRect(x0, y0, w, h);
      text(x, 'EASTSIDE HIGH SCHOOL', x0 + w / 2, y0 + h / 2 + 2, 30, '#e8e0c8', { max: w - 16, font: 'bold 30px Georgia, serif' });
    }
    {
      const [x0, y0, w, h] = R('scoreboard');
      x.fillStyle = '#0c0c10'; x.fillRect(x0, y0, w, h);
      x.fillStyle = '#1d2f6a'; x.fillRect(x0, y0, w, 26); text(x, 'EAGLES', x0 + w / 2, y0 + 13, 18, '#e8b830');
      for (const [lab, val, px] of [['HOME', '21', 0.25], ['GUEST', '14', 0.75]]) {
        text(x, lab, x0 + w * px, y0 + 42, 14, '#f2f2ec');
        text(ex, lab, x0 + w * px, y0 + 42, 14, '#c8c8c8');
        text(x, val, x0 + w * px, y0 + 84, 40, '#ff3a2a', { font: 'bold 40px Courier New, monospace' });
        text(ex, val, x0 + w * px, y0 + 84, 40, '#ff4a2a', { font: 'bold 40px Courier New, monospace' });
      }
      text(x, '4TH  0:42', x0 + w / 2, y0 + 115, 13, '#ffd040');
      text(ex, '4TH  0:42', x0 + w / 2, y0 + 115, 13, '#ffd040');
    }
    {
      const [x0, y0, w, h] = R('burger');
      x.fillStyle = '#7a1e1a'; x.fillRect(x0, y0, w, h);
      x.fillStyle = '#f4ead0'; x.fillRect(x0 + 6, y0 + 6, w - 12, h - 12);
      ex.fillStyle = 'rgba(255,240,200,0.7)'; ex.fillRect(x0 + 6, y0 + 6, w - 12, h - 12);
      text(x, 'BURGER', x0 + w / 2, y0 + 40, 40, '#b81e1a', { max: w - 20 }); text(ex, 'BURGER', x0 + w / 2, y0 + 40, 40, '#000', { max: w - 20 });
      text(x, 'BARN', x0 + w / 2, y0 + 82, 40, '#b81e1a'); text(ex, 'BARN', x0 + w / 2, y0 + 82, 40, '#000');
      text(x, 'DRIVE-THRU · OPEN LATE', x0 + w / 2, y0 + 113, 12, '#1a1a1a'); text(ex, 'DRIVE-THRU · OPEN LATE', x0 + w / 2, y0 + 113, 12, '#000');
    }
    {
      const [x0, y0, w, h] = R('motel');
      x.fillStyle = '#121418'; x.fillRect(x0, y0, w, h);
      neon('MOTEL', x0 + w / 2, y0 + 44, 50, '#ff3a3a', { max: w - 20 });
      neon('VACANCY', x0 + w / 2, y0 + 100, 30, '#3aff8a', { max: w - 30 });
      neon('COLOR TV', x0 + w / 2, y0 + 138, 18, '#ffb02a', { max: w - 30 });
    }
    {
      const [x0, y0, w, h] = R('church');
      x.fillStyle = '#f2eee4'; x.fillRect(x0, y0, w, h);
      ex.fillStyle = 'rgba(255,250,235,0.55)'; ex.fillRect(x0, y0, w, h);
      text(x, "ST. MARK'S", x0 + w / 2, y0 + 26, 26, '#1d2f6a', { font: 'bold 26px Georgia, serif' });
      text(x, 'SUNDAY 9 & 11 · ALL WELCOME', x0 + w / 2, y0 + 60, 13, '#1a1a1a', { max: w - 16 });
      text(x, 'FALL BAKE SALE SAT', x0 + w / 2, y0 + 80, 13, '#1a1a1a', { max: w - 16 });
    }
    {
      const [x0, y0, w, h] = R('canopy');
      x.fillStyle = '#f4f2ea'; x.fillRect(x0, y0, w, h);
      x.fillStyle = '#c8201a'; x.fillRect(x0, y0 + h * 0.55, w, h * 0.3);
      ex.fillStyle = 'rgba(255,255,255,0.7)'; ex.fillRect(x0, y0, w, h * 0.55);
      ex.fillStyle = 'rgba(255,40,30,0.8)'; ex.fillRect(x0, y0 + h * 0.55, w, h * 0.3);
      text(x, 'EASTGATE', x0 + w / 2, y0 + h * 0.3, 22, '#c8201a'); text(ex, 'EASTGATE', x0 + w / 2, y0 + h * 0.3, 22, '#000');
    }
    {
      const [x0, y0, w, h] = R('dealer');
      x.fillStyle = '#f4f2ea'; x.fillRect(x0, y0, w, h);
      x.fillStyle = '#1d4fa8'; x.fillRect(x0, y0, w, 12); x.fillRect(x0, y0 + h - 12, w, 12);
      text(x, 'HALCYON MOTORS', x0 + w / 2, y0 + 38, 32, '#1d4fa8', { max: w - 20 });
      text(x, 'USED CARS · 0% APR · WE FINANCE', x0 + w / 2, y0 + 70, 18, '#c8201a', { max: w - 20 });
      ex.fillStyle = 'rgba(255,255,255,0.4)'; ex.fillRect(x0, y0, w, h);
      text(ex, 'HALCYON MOTORS', x0 + w / 2, y0 + 38, 32, '#000', { max: w - 20 });
    }
    {
      const [x0, y0, w, h] = R('menu');
      x.fillStyle = '#2a1a14'; x.fillRect(x0, y0, w, h);
      x.fillStyle = '#f2e6c8'; x.fillRect(x0 + 6, y0 + 6, w - 12, h - 12);
      ex.fillStyle = 'rgba(255,240,200,0.85)'; ex.fillRect(x0 + 6, y0 + 6, w - 12, h - 12);
      for (let k = 0; k < 6; k++) { x.fillStyle = '#5a2a1a'; x.fillRect(x0 + 14, y0 + 16 + k * 17, 120 + rng() * 60, 6); x.fillStyle = '#b81e1a'; x.fillRect(x0 + w - 50, y0 + 16 + k * 17, 30, 6); }
      ex.fillStyle = 'rgba(0,0,0,0.6)'; for (let k = 0; k < 6; k++) ex.fillRect(x0 + 14, y0 + 16 + k * 17, 150, 6);
    }
    {
      const [x0, y0, w, h] = R('driveIn');
      x.fillStyle = '#e8e2d0'; x.fillRect(x0, y0, w, h);
      x.fillStyle = '#7a1e1a'; x.fillRect(x0, y0, w, 34);
      text(x, 'STARLITE', x0 + w / 2, y0 + 18, 24, '#f4e8c8', { font: 'italic bold 26px Georgia, serif' });
      text(x, 'DRIVE-IN', x0 + w / 2, y0 + 50, 18, '#1a1a1a');
      text(x, 'CL  SED', x0 + w / 2, y0 + 80, 26, '#1a1a1a');
      text(x, 'TH NKS F R 40 YE RS', x0 + w / 2, y0 + 108, 13, '#1a1a1a', { max: w - 10 });
      streaks(x, x0, y0, w, h, rng, 14, '60,40,20', 0.35);
    }
    {
      const [x0, y0, w, h] = R('foodtown');
      x.fillStyle = '#1a1a1a'; x.fillRect(x0, y0, w, h);
      neon('FOODTOWN', x0 + w / 2, y0 + h * 0.48, 66, '#ff3a2a', { max: w - 40 });
    }
    {
      const [x0, y0, w] = R('mascot');
      x.fillStyle = '#1d2f6a'; x.fillRect(x0, y0, w, 128);
      text(x, 'GO', x0 + w / 2, y0 + 30, 30, '#e8b830');
      text(x, 'EAGLES', x0 + w / 2, y0 + 80, 48, '#e8b830', { max: w - 16 });
    }
    {
      const [x0, y0, w, h] = R('screen');
      x.fillStyle = '#c8ccd0'; x.fillRect(x0, y0, w, h);
      const g = ex.createLinearGradient(0, y0, 0, y0 + h); g.addColorStop(0, 'rgba(150,170,220,0.6)'); g.addColorStop(1, 'rgba(90,110,170,0.5)');
      ex.fillStyle = g; ex.fillRect(x0, y0, w, h);
      ex.fillStyle = 'rgba(255,250,220,0.9)'; ex.beginPath(); ex.arc(x0 + w * 0.75, y0 + h * 0.3, 14, 0, Math.PI * 2); ex.fill();
      ex.fillStyle = 'rgba(10,10,20,0.9)'; ex.fillRect(x0 + w * 0.2, y0 + h * 0.62, w * 0.45, h * 0.18); ex.fillRect(x0 + w * 0.28, y0 + h * 0.52, w * 0.25, h * 0.12);
      x.fillStyle = 'rgba(0,0,0,0.25)'; for (let k = 0; k < 8; k++) x.fillRect(x0, y0 + k * h / 8, w, 1);
      streaks(x, x0, y0, w, h, rng, 10, '60,60,60', 0.25);
    }
    {
      const [x0, y0, w, h] = R('stripe');
      for (let k = 0; k < w; k += 32) { x.fillStyle = (k / 32) % 2 ? '#f4f2ea' : '#c8201a'; x.fillRect(x0 + k, y0, 32, h); }
    }
    {
      const [x0, y0, w, h] = R('pool');
      x.fillStyle = '#3aa8d8'; x.fillRect(x0, y0, w, h);
      for (let i = 0; i < 60; i++) { x.strokeStyle = `rgba(255,255,255,${0.15 + rng() * 0.25})`; x.lineWidth = 1.5; x.beginPath(); const px = x0 + rng() * w, py = y0 + rng() * h; x.moveTo(px, py); x.quadraticCurveTo(px + 10, py - 6, px + 20, py + 2); x.stroke(); }
      const g = ex.createRadialGradient(x0 + w / 2, y0 + h / 2, 10, x0 + w / 2, y0 + h / 2, w * 0.6); g.addColorStop(0, 'rgba(80,220,255,0.9)'); g.addColorStop(1, 'rgba(30,120,200,0.5)');
      ex.fillStyle = g; ex.fillRect(x0, y0, w, h);
    }
    {
      const [x0, y0] = R('house');
      x.fillStyle = '#f2eee4'; x.fillRect(x0, y0, 128, 80);
      x.fillStyle = '#c8201a'; x.fillRect(x0, y0, 128, 18);
      text(x, 'FOR SALE', x0 + 64, y0 + 10, 12, '#ffffff');
      text(x, 'HALCYON REALTY', x0 + 64, y0 + 40, 12, '#1a1a1a');
      text(x, '555-0142', x0 + 64, y0 + 62, 14, '#c8201a');
    }
    {
      const [x0, y0] = R('flag');
      for (let k = 0; k < 16; k++) {
        const px = x0 + k * 32;
        x.fillStyle = pick(rng, ['#c8201a', '#1d4fa8', '#f4f2ea', '#e8b830', '#2a8a4a']);
        x.beginPath(); x.moveTo(px, y0); x.lineTo(px + 30, y0); x.lineTo(px + 15, y0 + 40); x.fill();
      }
      x.fillStyle = '#1d2f6a'; x.fillRect(x0, y0 + 60, 200, 100);
      for (let k = 0; k < 7; k++) { x.fillStyle = k % 2 ? '#f4f2ea' : '#c8201a'; x.fillRect(x0 + 200, y0 + 60 + k * 100 / 7, 300, 100 / 7 + 0.5); }
    }
    return { map: toTex(c), emi: toTex(e) };
  });
}
