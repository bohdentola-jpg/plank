// PORT HALCYON — the canvas textures Downtown and Uptown are drawn with.
// Each painter draws once (cached by name); only warm()/build() call them
// (node can't draw). Facade tiles are a whole number of bays × storeys so the
// window shader (shaders.js) lines up with what's painted: canvas row 0 is
// the top of the texture (v = 1), storey 0 its bottom.
import { toTex } from '../../../track/textures.js';
import { makeRng } from '../../../core/util.js';

const cache = new Map();
const once = (k, fn) => { if (!cache.has(k)) cache.set(k, fn()); return cache.get(k); };

function cnv(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}
const clamp255 = (v) => Math.max(0, Math.min(255, Math.round(v)));
const rgb = (r, g, b, a = 1) => (a >= 1 ? `rgb(${clamp255(r)},${clamp255(g)},${clamp255(b)})` : `rgba(${clamp255(r)},${clamp255(g)},${clamp255(b)},${a})`);

function grain(x, w, h, rng, n, a = 0.08, size = 1) {
  for (let i = 0; i < n; i++) {
    x.fillStyle = rng() < 0.5 ? `rgba(255,255,255,${rng() * a})` : `rgba(0,0,0,${rng() * a})`;
    x.fillRect(rng() * w, rng() * h, size, size);
  }
}

/** Soft vertical grime streaks (rain-stained concrete). */
function streaks(x, w, h, rng, n, a = 0.12) {
  for (let i = 0; i < n; i++) {
    const sx = rng() * w, sw = 2 + rng() * 10, sy = rng() * h;
    const g = x.createLinearGradient(0, sy, 0, sy + h * 0.4);
    g.addColorStop(0, `rgba(0,0,0,${a})`);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = g;
    x.fillRect(sx, sy, sw, h * 0.4);
  }
}

/** Diagonal sky glints across glass, wrapping so the tile still tiles. */
function glints(x, W, H, rng, n, a = 0.1) {
  x.save();
  x.globalCompositeOperation = 'lighter';
  for (let k = 0; k < n; k++) {
    const sx = rng() * W, w = 24 + rng() * 90;
    for (const off of [-W, 0, W]) {
      const g = x.createLinearGradient(sx + off, 0, sx + off + w, 0);
      g.addColorStop(0, 'rgba(255,255,255,0)');
      g.addColorStop(0.5, `rgba(205,222,255,${a * (0.5 + rng())})`);
      g.addColorStop(1, 'rgba(255,255,255,0)');
      x.fillStyle = g;
      x.beginPath();
      // skewed by exactly W top to bottom: continuous across tiles both ways
      x.moveTo(sx + off, 0); x.lineTo(sx + off + w, 0); x.lineTo(sx + off + w - W, H); x.lineTo(sx + off - W, H);
      x.fill();
    }
  }
  x.restore();
}

// =====================================================================
// DOWNTOWN
// =====================================================================

/**
 * Curtain wall: 4 bays × 16 storeys (128 × 64 px a cell). Bright mullions,
 * a dark spandrel at each slab, two lites per bay. Neutral, to be tinted.
 * Window (for the shader): x 0.04–0.96, y 0.235–0.97.
 */
export const CURTAIN = { bays: 4, floors: 16, win: [0.04, 0.96, 0.235, 0.97] };
export function curtainTex() {
  return once('curtain', () => {
    const W = 512, H = 1024, BW = 128, FH = 64;
    const c = cnv(W, H), x = c.getContext('2d'), rng = makeRng('ct-curtain');
    x.fillStyle = '#b4bbc2';
    x.fillRect(0, 0, W, H);
    const spH = Math.round(FH * 0.22);
    for (let fy = 0; fy < 16; fy++) {
      const top = H - (fy + 1) * FH;
      const gTop = top + 2, gBot = top + FH - spH - 1;
      x.fillStyle = '#2f3a45';
      x.fillRect(0, top + FH - spH, W, spH);
      x.fillStyle = 'rgba(255,255,255,0.16)';
      x.fillRect(0, top + FH - spH, W, 1);
      x.fillStyle = 'rgba(0,0,0,0.4)';
      x.fillRect(0, top + FH - 2, W, 2);
      for (let bx = 0; bx < 4; bx++) {
        const x0 = bx * BW + 5, x1 = bx * BW + BW - 5;
        const t = 0.8 + rng() * 0.32;
        const g = x.createLinearGradient(0, gTop, 0, gBot);
        g.addColorStop(0, rgb(178 * t, 196 * t, 214 * t));
        g.addColorStop(0.5, rgb(118 * t, 136 * t, 156 * t));
        g.addColorStop(1, rgb(86 * t, 102 * t, 122 * t));
        x.fillStyle = g;
        x.fillRect(x0, gTop, x1 - x0, gBot - gTop);
        // blinds drawn down in a few offices (by day you see them)
        if (rng() < 0.18) { x.fillStyle = 'rgba(225,228,230,0.55)'; x.fillRect(x0, gTop, x1 - x0, (gBot - gTop) * (0.2 + rng() * 0.5)); }
        x.fillStyle = '#8f99a2';
        x.fillRect(bx * BW + 63, gTop, 2, gBot - gTop);
      }
    }
    glints(x, W, H, rng, 6, 0.09);
    x.fillStyle = '#d5dbe0';
    for (let bx = 0; bx <= 4; bx++) x.fillRect(bx * BW - 3, 0, 6, H);
    x.fillStyle = 'rgba(0,0,0,0.25)';
    for (let bx = 0; bx < 4; bx++) x.fillRect(bx * BW + 3, 0, 2, H);
    grain(x, W, H, rng, 9000, 0.05);
    return toTex(c);
  });
}

/**
 * Ribbon windows: opaque spandrel bands and continuous glass, mullions
 * every half bay. 4 bays × 16 storeys. Window: x 0–1, y 0.45–0.95.
 */
export const RIBBON = { bays: 4, floors: 16, win: [0.0, 1.0, 0.45, 0.95] };
export function ribbonTex() {
  return once('ribbon', () => {
    const W = 512, H = 1024, FH = 64;
    const c = cnv(W, H), x = c.getContext('2d'), rng = makeRng('ct-ribbon');
    for (let fy = 0; fy < 16; fy++) {
      const top = H - (fy + 1) * FH;
      const gTop = top + Math.round(FH * 0.05), gBot = top + Math.round(FH * 0.55);
      // the spandrel band (precast / panel)
      const t = 0.94 + rng() * 0.08;
      x.fillStyle = rgb(214 * t, 210 * t, 202 * t);
      x.fillRect(0, gBot, W, top + FH - gBot);
      x.fillStyle = 'rgba(0,0,0,0.28)';
      x.fillRect(0, gBot, W, 3);                    // shadow under the glass (recessed)
      x.fillStyle = 'rgba(255,255,255,0.25)';
      x.fillRect(0, top + FH - 2, W, 2);
      // panel joints
      x.fillStyle = 'rgba(0,0,0,0.12)';
      for (let k = 0; k < W; k += 128) x.fillRect(k, gBot, 1, top + FH - gBot);
      // the glass ribbon
      x.fillStyle = 'rgb(198,200,198)';
      x.fillRect(0, top, W, gTop - top);
      const g = x.createLinearGradient(0, gTop, 0, gBot);
      g.addColorStop(0, '#8a9aaa');
      g.addColorStop(1, '#4c5b6a');
      x.fillStyle = g;
      x.fillRect(0, gTop, W, gBot - gTop);
      for (let k = 0; k < 8; k++) {
        if (rng() < 0.2) { x.fillStyle = 'rgba(230,232,232,0.5)'; x.fillRect(k * 64, gTop, 64, (gBot - gTop) * (0.3 + rng() * 0.5)); }
      }
      x.fillStyle = '#3c434a';
      for (let k = 0; k <= 8; k++) x.fillRect(k * 64 - 1, gTop, 3, gBot - gTop);
    }
    glints(x, W, H, rng, 4, 0.06);
    streaks(x, W, H, rng, 14, 0.07);
    grain(x, W, H, rng, 9000, 0.05);
    return toTex(c);
  });
}

/**
 * Punched windows in stone / precast: 4 bays × 16 storeys, piers and
 * joints, deep reveals. Window: x 0.2–0.8, y 0.3–0.84.
 */
export const PUNCHED = { bays: 4, floors: 16, win: [0.2, 0.8, 0.3, 0.84] };
export function punchedTex() {
  return once('punched', () => {
    const W = 512, H = 1024, BW = 128, FH = 64;
    const c = cnv(W, H), x = c.getContext('2d'), rng = makeRng('ct-punched');
    x.fillStyle = '#d2cbbf';
    x.fillRect(0, 0, W, H);
    // stone mottling
    for (let i = 0; i < 260; i++) {
      const px = rng() * W, py = rng() * H, r = 6 + rng() * 30;
      const g = x.createRadialGradient(px, py, 0, px, py, r);
      g.addColorStop(0, `rgba(${rng() < 0.5 ? '255,255,255' : '60,50,40'},0.06)`);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      x.fillStyle = g;
      x.fillRect(px - r, py - r, r * 2, r * 2);
    }
    // piers slightly proud: lighter vertical bands at bay edges
    x.fillStyle = 'rgba(255,255,255,0.08)';
    for (let bx = 0; bx <= 4; bx++) x.fillRect(bx * BW - 14, 0, 28, H);
    for (let fy = 0; fy < 16; fy++) {
      const top = H - (fy + 1) * FH;
      x.fillStyle = 'rgba(0,0,0,0.16)';
      x.fillRect(0, top + FH - 1, W, 1);           // the floor joint
      x.fillStyle = 'rgba(0,0,0,0.07)';
      x.fillRect(0, top + 31, W, 1);
      for (let bx = 0; bx < 4; bx++) {
        const x0 = bx * BW + Math.round(BW * 0.2), x1 = bx * BW + Math.round(BW * 0.8);
        const y0 = top + Math.round(FH * 0.16), y1 = top + Math.round(FH * 0.7);
        // the reveal (a frame of shadow), then the glass
        x.fillStyle = '#4b4f55';
        x.fillRect(x0 - 2, y0 - 2, x1 - x0 + 4, y1 - y0 + 4);
        const t = 0.85 + rng() * 0.3;
        const g = x.createLinearGradient(0, y0, 0, y1);
        g.addColorStop(0, rgb(120 * t, 138 * t, 156 * t));
        g.addColorStop(1, rgb(50 * t, 62 * t, 76 * t));
        x.fillStyle = g;
        x.fillRect(x0, y0, x1 - x0, y1 - y0);
        if (rng() < 0.22) { x.fillStyle = 'rgba(232,230,222,0.6)'; x.fillRect(x0, y0, x1 - x0, (y1 - y0) * (0.25 + rng() * 0.5)); }
        x.fillStyle = 'rgba(0,0,0,0.45)';
        x.fillRect(x0, y0, x1 - x0, 3);
        x.fillRect(x0, y0, 3, y1 - y0);
        x.fillStyle = '#6a6e74';
        x.fillRect((x0 + x1) / 2 - 1, y0, 2, y1 - y0);
        x.fillStyle = 'rgba(255,255,255,0.35)';
        x.fillRect(x0 - 4, y1 + 2, x1 - x0 + 8, 2);   // the sill
      }
    }
    streaks(x, W, H, rng, 26, 0.09);
    grain(x, W, H, rng, 12000, 0.06);
    return toTex(c);
  });
}

/**
 * Street level downtown: four rows, each 24 m × 6 m (texture v: row k spans
 * k/4 … (k+1)/4) — 3: a warm office lobby (marble, wood, a revolving door),
 * 2: a cool one (black stone, white light, a video wall), 1 and 0: runs of
 * four shops. map + emissive.
 */
export const LOBBY_ROWS = 4;
export function lobbyTex() {
  return once('lobby', () => {
    const W = 1024, H = 1024, RH = 256;
    const c = cnv(W, H), e = cnv(W, H), x = c.getContext('2d'), ex = e.getContext('2d');
    const rng = makeRng('ct-lobby');
    ex.fillStyle = '#000';
    ex.fillRect(0, 0, W, H);
    // canvas row r (from the top) is texture row 3 − r
    const lobby = (top, warm) => {
      const bot = top + RH, M = 128;
      x.fillStyle = warm ? '#1e2124' : '#141518';
      x.fillRect(0, top, W, RH);
      const gy0 = top + 20, gy1 = bot - 6;
      const g = x.createLinearGradient(0, gy0, 0, gy1);
      if (warm) { g.addColorStop(0, '#2c2a27'); g.addColorStop(0.62, '#4a453d'); g.addColorStop(0.63, '#6e685c'); g.addColorStop(1, '#5a554c'); }
      else { g.addColorStop(0, '#1c1e22'); g.addColorStop(0.62, '#2a2d33'); g.addColorStop(0.63, '#3c3f46'); g.addColorStop(1, '#25272c'); }
      x.fillStyle = g;
      x.fillRect(0, gy0, W, gy1 - gy0);
      const ge = ex.createLinearGradient(0, gy0, 0, gy1);
      const lc = warm ? '255,238,212' : '225,236,255';
      ge.addColorStop(0, `rgba(${lc},0.55)`); ge.addColorStop(0.35, `rgba(${lc},0.14)`); ge.addColorStop(0.62, 'rgba(50,50,55,0.08)'); ge.addColorStop(0.7, `rgba(${lc},0.3)`); ge.addColorStop(1, `rgba(${lc},0.12)`);
      ex.fillStyle = ge;
      ex.fillRect(0, gy0, W, gy1 - gy0);
      for (let k = 0; k < 24; k++) {
        const px = 20 + k * 42 + rng() * 6;
        x.fillStyle = '#fffaf0'; x.fillRect(px, gy0 + 4, warm ? 14 : 30, 3);
        ex.fillStyle = '#ffffff'; ex.fillRect(px - 2, gy0 + 3, warm ? 18 : 34, 5);
        const pg = ex.createRadialGradient(px + 7, gy1 - 30, 0, px + 7, gy1 - 30, 26);
        pg.addColorStop(0, `rgba(${lc},0.42)`); pg.addColorStop(1, 'rgba(0,0,0,0)');
        ex.fillStyle = pg; ex.fillRect(px - 20, gy1 - 56, 54, 52);
      }
      const desk = warm ? [200, '#2a1e16', '#d8d0c0'] : [560, '#0e0f12', '#c8d4e8'];
      x.fillStyle = desk[1]; x.fillRect(desk[0], top + 176, 180, 40);
      x.fillStyle = desk[2]; x.fillRect(desk[0] - 4, top + 172, 188, 6);
      ex.fillStyle = warm ? '#ffe8c0' : '#d8e8ff'; ex.fillRect(desk[0] - 4, top + 172, 188, 6);
      ex.fillStyle = '#000'; ex.fillRect(desk[0], top + 178, 180, 38);
      if (warm) {
        const art = x.createLinearGradient(640, 0, 800, 0);
        art.addColorStop(0, '#c23a2a'); art.addColorStop(0.5, '#2a6ac8'); art.addColorStop(1, '#e8c22a');
        x.fillStyle = art; x.fillRect(640, top + 60, 160, 90);
        ex.globalAlpha = 0.55; ex.fillStyle = art; ex.fillRect(640, top + 60, 160, 90); ex.globalAlpha = 1;
      } else {
        // a video wall of blue-green tiles
        for (let i = 0; i < 6; i++) for (let j = 0; j < 3; j++) {
          const col = `hsl(${190 + rng() * 40},70%,${30 + rng() * 30}%)`;
          x.fillStyle = col; x.fillRect(150 + i * 36, top + 50 + j * 34, 34, 32);
          ex.fillStyle = col; ex.fillRect(150 + i * 36, top + 50 + j * 34, 34, 32);
        }
      }
      for (const px of [70, 900]) {
        x.fillStyle = '#2e2a26'; x.fillRect(px, top + 196, 34, 34);
        x.fillStyle = '#2f5226'; x.beginPath(); x.arc(px + 17, top + 180, 22, 0, Math.PI * 2); x.fill();
        ex.fillStyle = '#000'; ex.fillRect(px - 6, top + 156, 46, 76);
      }
      for (const px of warm ? [430, 560, 820] : [120, 400, 760]) {
        x.fillStyle = 'rgba(15,13,12,0.9)';
        x.fillRect(px, top + 158, 14, 72); x.beginPath(); x.arc(px + 7, top + 150, 8, 0, Math.PI * 2); x.fill();
        ex.fillStyle = '#000'; ex.fillRect(px, top + 158, 14, 72); ex.beginPath(); ex.arc(px + 7, top + 150, 8, 0, Math.PI * 2); ex.fill();
      }
      // fascia, mullions, transom, the door
      x.fillStyle = warm ? '#16181b' : '#0a0b0d'; x.fillRect(0, top, W, 20);
      x.fillStyle = warm ? '#9aa2aa' : '#c8ccd2'; x.fillRect(0, top + 17, W, 2);
      ex.fillStyle = '#000'; ex.fillRect(0, top, W, 20);
      if (!warm) { ex.fillStyle = '#cfe0ff'; ex.fillRect(0, top + 17, W, 2); }
      for (let k = 0; k <= 8; k++) {
        x.fillStyle = '#121417'; x.fillRect(k * M - 5, gy0, 10, gy1 - gy0);
        ex.fillStyle = '#000'; ex.fillRect(k * M - 5, gy0, 10, gy1 - gy0);
      }
      x.fillStyle = '#121417'; x.fillRect(0, top + 128, W, 5);
      ex.fillStyle = '#000'; ex.fillRect(0, top + 128, W, 5);
      const dx = (warm ? 4 : 6) * M + 64;
      x.strokeStyle = '#0c0d0f'; x.lineWidth = 6;
      if (warm) { x.beginPath(); x.ellipse(dx, top + 196, 50, 58, 0, Math.PI, 0); x.stroke(); }
      else { x.strokeRect(dx - 50, top + 140, 100, 112); }
      x.fillStyle = '#0c0d0f'; x.fillRect(dx - 3, top + 140, 6, 110);
      ex.fillStyle = '#000'; ex.fillRect(dx - 3, top + 140, 6, 110);
      const gr = x.createLinearGradient(0, gy0, 0, gy1);
      gr.addColorStop(0, 'rgba(150,175,200,0.32)'); gr.addColorStop(0.5, 'rgba(90,110,130,0.12)'); gr.addColorStop(1, 'rgba(60,70,80,0.2)');
      x.fillStyle = gr; x.fillRect(0, gy0, W, gy1 - gy0);
      x.save(); x.globalAlpha = 0.16; x.fillStyle = '#ffffff';
      for (let k = 0; k < 6; k++) { const sx = rng() * W; x.beginPath(); x.moveTo(sx, gy0); x.lineTo(sx + 50, gy0); x.lineTo(sx - 40, gy1); x.lineTo(sx - 90, gy1); x.fill(); }
      x.restore();
    };
    const shops = (top, list) => {
      list.forEach((S, k) => {
        const x0 = k * 256, bot = top + RH;
        x.fillStyle = '#2a2826'; x.fillRect(x0, top, 256, RH);
        x.fillStyle = S.signBg; x.fillRect(x0 + 8, top + 8, 240, 52);
        x.font = 'bold 34px Arial, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
        x.fillStyle = S.sign; x.fillText(S.name, x0 + 128, top + 35, 224);
        ex.fillStyle = S.signBg; ex.globalAlpha = 0.45; ex.fillRect(x0 + 8, top + 8, 240, 52); ex.globalAlpha = 1;
        ex.font = 'bold 34px Arial, sans-serif'; ex.textAlign = 'center'; ex.textBaseline = 'middle';
        ex.fillStyle = S.glow || S.sign; ex.fillText(S.name, x0 + 128, top + 35, 224);
        const wy0 = top + 74, wy1 = bot - 10;
        x.fillStyle = S.back; x.fillRect(x0 + 10, wy0, 236, wy1 - wy0);
        for (let i = 0; i < 18; i++) {
          x.fillStyle = S.goods[Math.floor(rng() * S.goods.length)];
          x.fillRect(x0 + 16 + rng() * 150, wy0 + 40 + rng() * 110, 10 + rng() * 18, 8 + rng() * 22);
        }
        const ge = ex.createLinearGradient(0, wy0, 0, wy1);
        ge.addColorStop(0, S.light); ge.addColorStop(1, 'rgba(0,0,0,0.2)');
        ex.fillStyle = ge; ex.globalAlpha = 0.6; ex.fillRect(x0 + 10, wy0, 236, wy1 - wy0); ex.globalAlpha = 1;
        x.fillStyle = '#141414'; x.fillRect(x0 + 180, wy0, 6, wy1 - wy0); x.fillRect(x0 + 10, wy0, 236, 5);
        ex.fillStyle = '#000'; ex.fillRect(x0 + 180, wy0, 6, wy1 - wy0);
        x.fillStyle = '#b8b8b8'; x.fillRect(x0 + 196, wy0 + 90, 40, 5);
        x.fillStyle = '#3a3836'; x.fillRect(x0, top, 8, RH); x.fillRect(x0 + 248, top, 8, RH);
        ex.fillStyle = '#000'; ex.fillRect(x0, top, 8, RH); ex.fillRect(x0 + 248, top, 8, RH);
        x.save(); x.globalAlpha = 0.15; x.fillStyle = '#ffffff';
        const sx = x0 + 40 + rng() * 120;
        x.beginPath(); x.moveTo(sx, wy0); x.lineTo(sx + 30, wy0); x.lineTo(sx - 20, wy1); x.lineTo(sx - 50, wy1); x.fill();
        x.restore();
      });
    };
    lobby(0, true);
    lobby(RH, false);
    shops(2 * RH, [
      { name: 'CAFÉ', sign: '#f4e2c4', signBg: '#3b2316', back: '#9a6a44', light: '#ffcf8a', goods: ['#e8d8b8', '#7a4a2a', '#c89a5a'] },
      { name: 'PHARMACY', sign: '#ffffff', signBg: '#1f7a4a', back: '#e6ece8', light: '#f0fff6', goods: ['#e8483a', '#2a8ae8', '#f2f2f2', '#e8c22a'] },
      { name: 'HALCYON BANK', sign: '#ffffff', signBg: '#123a7a', back: '#cdd8e6', light: '#e8f2ff', goods: ['#2a3a5a', '#d8e0ea'] },
      { name: 'ELECTRONICS', sign: '#0c0c10', glow: '#ffd02a', signBg: '#ffd02a', back: '#2a3240', light: '#bfe0ff', goods: ['#2ae0ff', '#ff3a8a', '#7aff4a', '#ffffff'] },
    ]);
    shops(3 * RH, [
      { name: 'SUSHI', sign: '#ffffff', signBg: '#a8141c', back: '#c8a878', light: '#ffe0b0', goods: ['#f2f2f2', '#e8582a', '#2a2a2a'] },
      { name: 'DELI 24H', sign: '#1a1a1a', glow: '#ff5a3a', signBg: '#f2e8d0', back: '#e8e0c8', light: '#fff6dc', goods: ['#c8322a', '#e8c22a', '#3a9a4a', '#f2f2f2'] },
      { name: 'SHOES', sign: '#ffffff', signBg: '#1a1a1a', back: '#d8d0c8', light: '#fff2e0', goods: ['#1a1a1a', '#8a5a3a', '#e8e8e8', '#c8322a'] },
      { name: 'FITNESS', sign: '#0a0a0a', glow: '#7aff4a', signBg: '#7aff4a', back: '#2a2e34', light: '#d0f0ff', goods: ['#3a3a3a', '#7a7a7a', '#2ae0ff'] },
    ]);
    x.textAlign = 'left'; ex.textAlign = 'left';
    grain(x, W, H, rng, 14000, 0.05);
    return { map: toTex(c), emi: toTex(e) };
  });
}

/**
 * LED screens: 2 × 4 ads of 512 × 256 (2:1), drawn bright, with an LED
 * pixel grid over them. screenMat cycles through them.
 */
export const SCREEN_ATLAS = { cols: 2, rows: 4 };
export function screensTex() {
  return once('screens', () => {
    const W = 1024, H = 1024, FW = 512, FH = 256;
    const c = cnv(W, H), x = c.getContext('2d');
    const rng = makeRng('ct-screens');
    const big = (t, px, py, size, col, font = 'Arial Black, Arial, sans-serif', style = '900 italic') => {
      x.font = `${style} ${size}px ${font}`; x.fillStyle = col; x.fillText(t, px, py);
    };
    const frames = [
      (ox, oy) => { // NITRO-X
        const g = x.createLinearGradient(ox, oy, ox + FW, oy + FH); g.addColorStop(0, '#0a2a7a'); g.addColorStop(1, '#02081e');
        x.fillStyle = g; x.fillRect(ox, oy, FW, FH);
        for (let k = 0; k < 9; k++) { x.fillStyle = `rgba(255,220,0,${0.15 + k * 0.06})`; x.beginPath(); x.moveTo(ox + 300 + k * 22, oy); x.lineTo(ox + 330 + k * 22, oy); x.lineTo(ox + 260 + k * 22, oy + FH); x.lineTo(ox + 230 + k * 22, oy + FH); x.fill(); }
        big('NITRO-X', ox + 24, oy + 120, 92, '#ffffff'); big('ENERGY YOU CAN TASTE', ox + 30, oy + 175, 30, '#ffd000', 'Arial, sans-serif', 'bold');
        x.fillStyle = '#ffd000'; x.fillRect(ox, oy + FH - 40, FW, 40); big('NOW 30% MORE VOLTS', ox + 30, oy + FH - 10, 26, '#0a2a7a', 'Arial, sans-serif', 'bold');
      },
      (ox, oy) => { // KUROSHIO
        x.fillStyle = '#0c0c0c'; x.fillRect(ox, oy, FW, FH);
        x.strokeStyle = '#ff2a2a'; x.lineWidth = 26; x.beginPath(); x.arc(ox + 410, oy + 128, 86, 0, Math.PI * 2); x.stroke();
        x.strokeStyle = '#333'; x.lineWidth = 10; for (let k = 0; k < 12; k++) { const a = k / 12 * Math.PI * 2; x.beginPath(); x.moveTo(ox + 410 + Math.cos(a) * 40, oy + 128 + Math.sin(a) * 40); x.lineTo(ox + 410 + Math.cos(a) * 70, oy + 128 + Math.sin(a) * 70); x.stroke(); }
        big('KUROSHIO', ox + 20, oy + 110, 70, '#ffffff'); big('PERFORMANCE TIRES', ox + 24, oy + 160, 28, '#ff3a3a', 'Arial, sans-serif', 'bold');
        big('GRIP IS EVERYTHING', ox + 24, oy + 215, 24, '#bbbbbb', 'Arial, sans-serif', 'italic bold');
      },
      (ox, oy) => { // MIDNIGHT 88.1
        const g = x.createLinearGradient(ox, oy, ox, oy + FH); g.addColorStop(0, '#3a0a5a'); g.addColorStop(1, '#ff3a8a');
        x.fillStyle = g; x.fillRect(ox, oy, FW, FH);
        x.fillStyle = 'rgba(255,255,255,0.9)'; x.beginPath(); x.arc(ox + 400, oy + 150, 60, 0, Math.PI * 2); x.fill();
        x.fillStyle = '#3a0a5a'; for (let k = 0; k < 5; k++) x.fillRect(ox + 330, oy + 150 + k * 14, 140, 6);
        big('MIDNIGHT', ox + 24, oy + 96, 64, '#ffffff'); big('88.1 FM', ox + 24, oy + 170, 70, '#ffe0f4');
        big('THE UNDERGROUND SOUND', ox + 26, oy + 222, 22, '#ffffff', 'Arial, sans-serif', 'bold');
      },
      (ox, oy) => { // HALCYON BANK
        x.fillStyle = '#0c1c3a'; x.fillRect(ox, oy, FW, FH);
        x.strokeStyle = '#d8b04a'; x.lineWidth = 4; x.strokeRect(ox + 14, oy + 14, FW - 28, FH - 28);
        x.fillStyle = '#d8b04a'; for (let k = 0; k < 5; k++) x.fillRect(ox + 52 + k * 22, oy + 70, 12, 90); x.beginPath(); x.moveTo(ox + 40, oy + 70); x.lineTo(ox + 102 + 60, oy + 70); x.lineTo(ox + 101, oy + 40); x.fill(); x.fillRect(ox + 40, oy + 160, 122, 10);
        big('HALCYON', ox + 190, oy + 112, 54, '#ffffff', 'Georgia, serif', 'bold'); big('BANK', ox + 190, oy + 170, 54, '#d8b04a', 'Georgia, serif', 'bold');
        big('BUILT ON TRUST SINCE 1888', ox + 40, oy + 222, 22, '#ffffff', 'Arial, sans-serif', 'bold');
      },
      (ox, oy) => { // stock ticker
        x.fillStyle = '#020604'; x.fillRect(ox, oy, FW, FH);
        x.strokeStyle = 'rgba(40,120,60,0.5)'; x.lineWidth = 1; for (let k = 0; k < 8; k++) { x.beginPath(); x.moveTo(ox, oy + 30 + k * 26); x.lineTo(ox + FW, oy + 30 + k * 26); x.stroke(); }
        x.strokeStyle = '#3aff6a'; x.lineWidth = 4; x.beginPath(); let py = oy + 170; x.moveTo(ox + 10, py);
        for (let k = 1; k < 30; k++) { py += (rng() - 0.42) * 22; py = Math.max(oy + 40, Math.min(oy + 200, py)); x.lineTo(ox + 10 + k * 17, py); } x.stroke();
        big('HCX ▲ 2.41%', ox + 20, oy + 60, 40, '#3aff6a', 'Arial, sans-serif', 'bold');
        x.fillStyle = '#101810'; x.fillRect(ox, oy + FH - 42, FW, 42);
        big('MRD 412.80 ▲  ORN 88.15 ▼  BAY 23.07 ▲', ox + 10, oy + FH - 12, 24, '#ffd040', 'Arial, sans-serif', 'bold');
      },
      (ox, oy) => { // STATIC MOBILE
        const g = x.createRadialGradient(ox + 380, oy + 120, 10, ox + 380, oy + 120, 300); g.addColorStop(0, '#00e0c0'); g.addColorStop(1, '#00302c');
        x.fillStyle = g; x.fillRect(ox, oy, FW, FH);
        x.fillStyle = '#111'; x.fillRect(ox + 350, oy + 30, 90, 190); x.fillStyle = '#8ef'; x.fillRect(ox + 360, oy + 50, 70, 110);
        x.fillStyle = '#333'; for (let k = 0; k < 9; k++) x.fillRect(ox + 362 + (k % 3) * 24, oy + 170 + Math.floor(k / 3) * 14, 18, 10);
        big('STATIC', ox + 24, oy + 100, 72, '#ffffff'); big('MOBILE', ox + 24, oy + 165, 52, '#003a34');
        big('TEXT ALL NIGHT', ox + 26, oy + 215, 26, '#ffffff', 'Arial, sans-serif', 'bold');
      },
      (ox, oy) => { // BURGER BARN
        x.fillStyle = '#b8160c'; x.fillRect(ox, oy, FW, FH);
        x.fillStyle = '#ffd000'; x.beginPath(); x.arc(ox + 400, oy + 118, 70, Math.PI, 0); x.fill();
        x.fillStyle = '#5a2a0a'; x.fillRect(ox + 330, oy + 122, 140, 26); x.fillStyle = '#4aa02a'; x.fillRect(ox + 326, oy + 116, 148, 8);
        x.fillStyle = '#ffd000'; x.fillRect(ox + 334, oy + 150, 132, 26);
        big('BURGER', ox + 24, oy + 96, 64, '#ffd000'); big('BARN', ox + 24, oy + 160, 64, '#ffffff');
        big('OPEN ALL NIGHT · $2.99', ox + 26, oy + 218, 26, '#ffffff', 'Arial, sans-serif', 'bold');
      },
      (ox, oy) => { // the city's own ad
        const g = x.createLinearGradient(ox, oy, ox, oy + FH); g.addColorStop(0, '#08102a'); g.addColorStop(0.7, '#3a2a6a'); g.addColorStop(1, '#ff7a4a');
        x.fillStyle = g; x.fillRect(ox, oy, FW, FH);
        x.fillStyle = '#05060c';
        let px = ox;
        while (px < ox + FW) { const w = 18 + rng() * 34, h = 40 + rng() * 120; x.fillRect(px, oy + FH - h, w, h); px += w + 2; }
        x.fillRect(ox + 250, oy + 40, 22, FH); x.fillRect(ox + 259, oy + 10, 4, 40);
        x.fillStyle = '#ffd890'; for (let k = 0; k < 120; k++) x.fillRect(ox + rng() * FW, oy + 120 + rng() * 130, 3, 3);
        big('PORT HALCYON', ox + 24, oy + 64, 48, '#ffffff'); big('THE CITY NEVER SLEEPS', ox + 26, oy + 100, 22, '#ffd890', 'Arial, sans-serif', 'bold');
      },
    ];
    frames.forEach((fn, k) => {
      const ox = (k % 2) * FW, oy = Math.floor(k / 2) * FH;
      x.save(); x.beginPath(); x.rect(ox, oy, FW, FH); x.clip();
      x.textAlign = 'left'; x.textBaseline = 'alphabetic';
      fn(ox, oy);
      x.restore();
    });
    // the LED pixel grid
    x.fillStyle = 'rgba(0,0,0,0.32)';
    for (let k = 0; k < W; k += 4) x.fillRect(k, 0, 1, H);
    for (let k = 0; k < H; k += 4) x.fillRect(0, k, W, 1);
    return toTex(c, { repeat: false });
  });
}

/**
 * Downtown's signs atlas: name → [x, y, w, h] in px of a 1024² canvas, laid
 * out by a pure function (build needs the rects without drawing).
 */
const DT_SIGNS = [
  ['meridian', 512, 96], ['plaza', 512, 96], ['helix', 384, 96], ['station', 384, 96], ['skypark', 256, 96],
  ['c0', 256, 80], ['c1', 256, 80], ['c2', 256, 80], ['c3', 256, 80], ['c4', 256, 80], ['c5', 256, 80], ['c6', 256, 80], ['c7', 256, 80],
  ['s_main', 256, 48], ['s_central', 256, 48], ['s_1st', 256, 48], ['s_5th', 256, 48], ['s_union', 256, 48], ['s_north', 256, 48], ['s_harbor', 256, 48], ['s_blank', 256, 48],
  ['subway', 256, 80], ['parkP', 128, 128], ['busstop', 96, 128], ['ad0', 128, 256], ['ad1', 128, 256], ['ad2', 128, 256], ['ad3', 128, 256],
  ['news', 256, 128], ['heli', 256, 256], ['stairs', 128, 256], ['grate', 128, 128], ['parking', 96, 320], ['crossing', 384, 96],
];
export const CORP = ['ORION CAPITAL', 'STERLING & HOLT', 'PACIFIC MUTUAL', 'BANK OF THE BAY', 'NORTHGATE', 'HALCYON TRUST', 'VANTAGE', 'ONE PLAZA'];
export const STREET_SIGN = { 'MAIN ST': 's_main', 'CENTRAL AVE': 's_central', '1ST AVE': 's_1st', '5TH AVE': 's_5th', 'UNION ST': 's_union', 'NORTH AVE': 's_north', 'HARBOR AVE': 's_harbor' };

function shelf(list, W) {
  const out = {};
  let px = 0, py = 0, rowH = 0;
  for (const [name, w, h] of list) {
    if (px + w > W) { px = 0; py += rowH; rowH = 0; }
    out[name] = [px, py, w, h];
    px += w; rowH = Math.max(rowH, h);
  }
  return out;
}
export const DT_SIGN_RECTS = shelf(DT_SIGNS, 1024);
/**
 * A sign atlas' glow map (one material for lit and unlit signs): the atlas,
 * with the named signs dimmed to their level (0: never lit, a painted
 * marking; 0.5: a street blade catching the light).
 */
export function glowOf(tex, rects, levels, key) {
  return once(key, () => {
    const src = tex.image, c = cnv(src.width, src.height), x = c.getContext('2d');
    x.drawImage(src, 0, 0);
    for (const [name, k] of Object.entries(levels)) {
      const r = rects[name];
      x.fillStyle = `rgba(0,0,0,${1 - k})`;
      x.fillRect(r[0], r[1], r[2], r[3]);
    }
    return toTex(c, { repeat: false });
  });
}

/** uv rect [u0, v0, u1, v1] of a sign in an atlas of S px (canvas y down → v up). */
export function signUV(rects, name, S = 1024) {
  const r = rects[name];
  return [(r[0] + 1) / S, 1 - (r[1] + r[3] - 1) / S, (r[0] + r[2] - 1) / S, 1 - (r[1] + 1) / S];
}

export function dtSignsTex() {
  return once('dtsigns', () => {
    const S = 1024, c = cnv(S, S), x = c.getContext('2d'), rng = makeRng('ct-dtsigns');
    x.fillStyle = '#000'; x.fillRect(0, 0, S, S);
    const R = DT_SIGN_RECTS;
    const text = (name, t, font, fg, bg, o = {}) => {
      const [px, py, w, h] = R[name];
      x.fillStyle = bg; x.fillRect(px, py, w, h);
      if (o.border) { x.strokeStyle = o.border; x.lineWidth = 3; x.strokeRect(px + 3, py + 3, w - 6, h - 6); }
      x.font = font; x.fillStyle = fg; x.textAlign = 'center'; x.textBaseline = 'middle';
      x.fillText(t, px + w / 2, py + h / 2 + (o.dy || 0), w - 16);
    };
    text('meridian', 'MERIDIAN', 'bold 70px Arial, sans-serif', '#eef4ff', '#0b0f16');
    text('plaza', 'HALCYON PLAZA', 'bold 62px Georgia, serif', '#f2efe6', '#15181c');
    text('helix', 'THE HELIX', 'bold 64px Arial, sans-serif', '#bff4ff', '#06141a');
    text('station', 'PLAZA STATION', 'bold 48px Arial, sans-serif', '#ffffff', '#1f6a3a');
    text('skypark', 'SKYPARK', 'bold 56px Arial Black, Arial, sans-serif', '#ffffff', '#1a4ab8');
    CORP.forEach((n, k) => text('c' + k, n, 'bold 40px Arial, sans-serif', ['#e8f0ff', '#ffffff', '#cfe8ff', '#ffe9c0'][k % 4], '#06080c'));
    for (const [n, k] of Object.entries(STREET_SIGN)) text(k, n, 'bold 32px Arial, sans-serif', '#ffffff', '#106a3a', { border: '#ffffff' });
    text('s_blank', '', 'bold 32px Arial', '#fff', '#106a3a', { border: '#ffffff' });
    // subway: dark green, white letters, coloured line bullets
    {
      const [px, py, w, h] = R.subway;
      x.fillStyle = '#0d3a22'; x.fillRect(px, py, w, h);
      x.font = 'bold 40px Arial, sans-serif'; x.fillStyle = '#fff'; x.textAlign = 'left'; x.textBaseline = 'middle';
      x.fillText('SUBWAY', px + 14, py + h / 2);
      [['#e8322a', '1'], ['#2a9a4a', '4'], ['#f2c21a', 'N']].forEach(([col, t], k) => {
        x.fillStyle = col; x.beginPath(); x.arc(px + 186 + k * 24, py + h / 2, 11, 0, Math.PI * 2); x.fill();
        x.fillStyle = col === '#f2c21a' ? '#000' : '#fff'; x.font = 'bold 15px Arial'; x.textAlign = 'center'; x.fillText(t, px + 186 + k * 24, py + h / 2 + 1);
      });
    }
    // parking P, bus stop, the vertical PARKING blade
    {
      const [px, py, w, h] = R.parkP;
      x.fillStyle = '#1f4fc0'; x.fillRect(px, py, w, h);
      x.strokeStyle = '#fff'; x.lineWidth = 5; x.strokeRect(px + 8, py + 8, w - 16, h - 16);
      x.font = 'bold 96px Arial, sans-serif'; x.fillStyle = '#fff'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('P', px + w / 2, py + h / 2 + 4);
    }
    {
      const [px, py, w, h] = R.busstop;
      x.fillStyle = '#f4f4f0'; x.fillRect(px, py, w, h);
      x.fillStyle = '#c8241c'; x.fillRect(px, py, w, 40);
      x.font = 'bold 22px Arial'; x.fillStyle = '#fff'; x.textAlign = 'center'; x.fillText('BUS', px + w / 2, py + 21);
      x.fillStyle = '#1a1a1a'; x.fillRect(px + 18, py + 56, 60, 34); x.fillStyle = '#8ad'; x.fillRect(px + 24, py + 62, 48, 14);
      x.fillStyle = '#1a1a1a'; x.beginPath(); x.arc(px + 30, py + 94, 6, 0, 7); x.arc(px + 66, py + 94, 6, 0, 7); x.fill();
      x.font = 'bold 18px Arial'; x.fillText('STOP', px + w / 2, py + 116);
    }
    {
      const [px, py, w, h] = R.parking;
      x.fillStyle = '#1f4fc0'; x.fillRect(px, py, w, h);
      x.font = 'bold 40px Arial'; x.fillStyle = '#fff'; x.textAlign = 'center'; x.textBaseline = 'middle';
      'PARK'.split('').forEach((ch, k) => x.fillText(ch, px + w / 2, py + 52 + k * 64));
    }
    // posters for the bus shelters
    const posters = [['#0a0a0a', '#ff3a3a', 'NIGHT', 'RUN'], ['#f2e8d8', '#1a1a1a', 'SILK', 'NO.5'], ['#0a2a5a', '#ffd000', 'NITRO', 'X'], ['#2a0a3a', '#ff5ad8', 'FM', '88.1']];
    posters.forEach(([bg, fg, a, b], k) => {
      const [px, py, w, h] = R['ad' + k];
      const g = x.createLinearGradient(px, py, px, py + h); g.addColorStop(0, bg); g.addColorStop(1, '#000');
      x.fillStyle = g; x.fillRect(px, py, w, h);
      x.fillStyle = fg; x.beginPath(); x.arc(px + w / 2, py + 100, 38 + rng() * 10, 0, Math.PI * 2); x.fill();
      x.font = 'bold 34px Arial Black, Arial'; x.textAlign = 'center'; x.fillText(a, px + w / 2, py + 180, w - 10);
      x.font = 'bold 26px Arial'; x.fillText(b, px + w / 2, py + 220, w - 10);
    });
    // a newsstand's rack: rows of covers
    {
      const [px, py, w, h] = R.news;
      x.fillStyle = '#3a2a1a'; x.fillRect(px, py, w, h);
      for (let r = 0; r < 3; r++) for (let k = 0; k < 9; k++) {
        x.fillStyle = ['#e8322a', '#f2f2f2', '#2a6ae8', '#f2c21a', '#1a1a1a', '#e85ab8', '#3aa04a'][Math.floor(rng() * 7)];
        x.fillRect(px + 6 + k * 27, py + 8 + r * 40, 23, 32);
        x.fillStyle = 'rgba(0,0,0,0.5)'; x.fillRect(px + 8 + k * 27, py + 12 + r * 40, 19, 4);
      }
    }
    // the helipad: an H in a circle, edge markings
    {
      const [px, py, w, h] = R.heli;
      x.fillStyle = '#3a3d40'; x.fillRect(px, py, w, h);
      x.strokeStyle = '#f2f2ee'; x.lineWidth = 10; x.strokeRect(px + 10, py + 10, w - 20, h - 20);
      x.strokeStyle = '#f2c21a'; x.lineWidth = 12; x.beginPath(); x.arc(px + w / 2, py + h / 2, 92, 0, Math.PI * 2); x.stroke();
      x.font = 'bold 140px Arial'; x.fillStyle = '#f2f2ee'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('H', px + w / 2, py + h / 2 + 6);
    }
    // subway stairs seen from above (steps going down into the dark)
    {
      const [px, py, w, h] = R.stairs;
      const g = x.createLinearGradient(0, py, 0, py + h); g.addColorStop(0, '#8a8a86'); g.addColorStop(1, '#0a0a0a');
      x.fillStyle = g; x.fillRect(px, py, w, h);
      x.fillStyle = 'rgba(255,255,255,0.35)'; for (let k = 0; k < 14; k++) x.fillRect(px + 6, py + 6 + k * 17, w - 12, 3);
    }
    // a cast-iron tree grate
    {
      const [px, py, w, h] = R.grate;
      x.fillStyle = '#2a2826'; x.fillRect(px, py, w, h);
      x.strokeStyle = '#4a4744'; x.lineWidth = 3;
      for (let r = 12; r < 64; r += 9) { x.beginPath(); x.arc(px + w / 2, py + h / 2, r, 0, Math.PI * 2); x.stroke(); }
      x.fillStyle = '#3a3226'; x.beginPath(); x.arc(px + w / 2, py + h / 2, 12, 0, Math.PI * 2); x.fill();
    }
    text('crossing', 'HALCYON CROSSING', 'bold 40px Arial, sans-serif', '#ffffff', '#c8102e');
    x.textAlign = 'left';
    return toTex(c, { repeat: false });
  });
}

/** Granite pavers for the plaza: 9.6 m a tile, running bond, charcoal bands. */
export function graniteTex() {
  return once('granite', () => {
    const S = 512, c = cnv(S, S), x = c.getContext('2d'), rng = makeRng('ct-granite');
    x.fillStyle = '#4a4946';
    x.fillRect(0, 0, S, S);
    const pw = 64, ph = 32;
    for (let r = 0; r < S / ph; r++) {
      const band = r % 8 === 0;
      const off = (r % 2) * pw / 2;
      for (let k = -1; k <= S / pw; k++) {
        const t = band ? 0.55 + rng() * 0.06 : 0.92 + rng() * 0.16;
        x.fillStyle = rgb(170 * t, 168 * t, 162 * t);
        x.fillRect(k * pw + off + 1, r * ph + 1, pw - 2, ph - 2);
      }
    }
    grain(x, S, S, rng, 26000, 0.12);
    return toTex(c);
  });
}

// =====================================================================
// UPTOWN
// =====================================================================

/**
 * Rowhouse masonry (brownstone / brick, tinted per house): 2 bays × 4
 * storeys, 256 × 256 px a cell; tall sash windows with stone lintels and
 * sills. Window: x 0.27–0.73, y 0.2–0.8.
 */
export const ROW = { bays: 2, floors: 4, win: [0.27, 0.73, 0.2, 0.8] };
export function rowhouseTex() {
  return once('rowhouse', () => {
    const W = 512, H = 1024, BW = 256, FH = 256;
    const c = cnv(W, H), x = c.getContext('2d'), rng = makeRng('ct-row');
    x.fillStyle = '#d9cfc2';
    x.fillRect(0, 0, W, H);
    // coursing (brick-sized, faint) and mottling
    for (let y = 0; y < H; y += 8) {
      x.fillStyle = 'rgba(70,50,40,0.09)';
      x.fillRect(0, y, W, 1);
      for (let k = (y / 8) % 2 ? 0 : 16; k < W; k += 32) x.fillRect(k, y, 1, 8);
    }
    for (let i = 0; i < 2600; i++) {
      const t = rng() < 0.5 ? 255 : 40;
      x.fillStyle = `rgba(${t},${t * 0.9},${t * 0.8},${rng() * 0.07})`;
      x.fillRect(rng() * W, rng() * H, 12, 8);
    }
    for (let fy = 0; fy < 4; fy++) {
      const top = H - (fy + 1) * FH;
      for (let bx = 0; bx < 2; bx++) {
        const x0 = bx * BW + Math.round(BW * 0.27), x1 = bx * BW + Math.round(BW * 0.73);
        const y0 = top + Math.round(FH * 0.2), y1 = top + Math.round(FH * 0.8);
        // the lintel (a stone hood) and the sill
        x.fillStyle = '#e8dfd2';
        x.fillRect(x0 - 16, y0 - 26, x1 - x0 + 32, 20);
        x.fillStyle = 'rgba(0,0,0,0.3)'; x.fillRect(x0 - 16, y0 - 6, x1 - x0 + 32, 4);
        x.fillStyle = '#e8dfd2'; x.fillRect(x0 - 10, y1 + 2, x1 - x0 + 20, 10);
        x.fillStyle = 'rgba(0,0,0,0.35)'; x.fillRect(x0 - 10, y1 + 12, x1 - x0 + 20, 4);
        // the frame (dark painted wood), the glass
        x.fillStyle = '#231e1b'; x.fillRect(x0 - 6, y0 - 6, x1 - x0 + 12, y1 - y0 + 12);
        const t = 0.85 + rng() * 0.3;
        const g = x.createLinearGradient(0, y0, 0, y1);
        g.addColorStop(0, rgb(96 * t, 108 * t, 122 * t)); g.addColorStop(1, rgb(38 * t, 44 * t, 54 * t));
        x.fillStyle = g; x.fillRect(x0, y0, x1 - x0, y1 - y0);
        // curtains seen by day
        if (rng() < 0.6) {
          const cc = ['rgba(200,190,170,0.7)', 'rgba(150,60,50,0.6)', 'rgba(220,215,200,0.7)', 'rgba(90,110,80,0.6)'][Math.floor(rng() * 4)];
          x.fillStyle = cc; x.fillRect(x0, y0, (x1 - x0) * 0.22, y1 - y0); x.fillRect(x1 - (x1 - x0) * 0.22, y0, (x1 - x0) * 0.22, y1 - y0);
        }
        // sashes: the meeting rail and muntins
        x.fillStyle = '#e4ddd0';
        x.fillRect(x0, (y0 + y1) / 2 - 3, x1 - x0, 6);
        x.fillRect((x0 + x1) / 2 - 2, y0, 4, y1 - y0);
        x.fillStyle = 'rgba(255,255,255,0.12)';
        x.beginPath(); x.moveTo(x0 + 10, y0); x.lineTo(x0 + 40, y0); x.lineTo(x0 + 10, y0 + 60); x.fill();
      }
    }
    streaks(x, W, H, rng, 18, 0.06);
    grain(x, W, H, rng, 14000, 0.06);
    return toTex(c);
  });
}

/**
 * Art deco: continuous stone piers, recessed windows, chevron spandrels;
 * 4 bays × 16 storeys (128 × 64 px). Window: x 0.2–0.8, y 0.3–0.92.
 */
export const DECO = { bays: 4, floors: 16, win: [0.2, 0.8, 0.3, 0.92] };
export function decoTex() {
  return once('deco', () => {
    const W = 512, H = 1024, BW = 128, FH = 64;
    const c = cnv(W, H), x = c.getContext('2d'), rng = makeRng('ct-deco');
    x.fillStyle = '#c9c0b0';
    x.fillRect(0, 0, W, H);
    for (let fy = 0; fy < 16; fy++) {
      const top = H - (fy + 1) * FH;
      for (let bx = 0; bx < 4; bx++) {
        const x0 = bx * BW + Math.round(BW * 0.2), x1 = bx * BW + Math.round(BW * 0.8);
        const wy0 = top + Math.round(FH * 0.08), wy1 = top + Math.round(FH * 0.7);
        // the recessed panel (spandrel + window), a shade darker
        x.fillStyle = '#9f9686';
        x.fillRect(x0 - 4, top, x1 - x0 + 8, FH);
        // chevrons in the spandrel
        x.strokeStyle = 'rgba(255,245,225,0.35)'; x.lineWidth = 2;
        for (let k = 0; k < 3; k++) {
          const yy = wy1 + 6 + k * 5;
          x.beginPath();
          for (let s = 0; s <= 6; s++) x.lineTo(x0 + (x1 - x0) * s / 6, yy + (s % 2 ? 4 : 0));
          x.stroke();
        }
        const t = 0.85 + rng() * 0.3;
        const g = x.createLinearGradient(0, wy0, 0, wy1);
        g.addColorStop(0, rgb(110 * t, 122 * t, 134 * t)); g.addColorStop(1, rgb(44 * t, 50 * t, 60 * t));
        x.fillStyle = '#2a2622'; x.fillRect(x0 - 1, wy0 - 1, x1 - x0 + 2, wy1 - wy0 + 2);
        x.fillStyle = g; x.fillRect(x0 + 1, wy0 + 1, x1 - x0 - 2, wy1 - wy0 - 2);
        x.fillStyle = '#2a2622';
        x.fillRect(x0, (wy0 + wy1) / 2, x1 - x0, 2);
        x.fillRect((x0 + x1) / 2 - 1, wy0, 2, wy1 - wy0);
        if (rng() < 0.45) { x.fillStyle = 'rgba(214,200,170,0.55)'; x.fillRect(x0 + 1, wy0 + 1, (x1 - x0) * 0.2, wy1 - wy0 - 2); x.fillRect(x1 - (x1 - x0) * 0.2 - 1, wy0 + 1, (x1 - x0) * 0.2, wy1 - wy0 - 2); }
      }
    }
    // the piers: light, with a highlight and a shadow edge (relief)
    for (let bx = 0; bx <= 4; bx++) {
      const px = bx * BW;
      x.fillStyle = '#d8cfbf'; x.fillRect(px - 20, 0, 40, H);
      x.fillStyle = 'rgba(255,255,255,0.22)'; x.fillRect(px - 20, 0, 4, H);
      x.fillStyle = 'rgba(0,0,0,0.22)'; x.fillRect(px + 16, 0, 4, H);
    }
    streaks(x, W, H, rng, 20, 0.07);
    grain(x, W, H, rng, 14000, 0.06);
    return toTex(c);
  });
}

/**
 * Classical limestone (hotels, the grand apartment houses on the park):
 * ashlar joints, windows with alternating pediments; 4 bays × 8 storeys
 * (128 × 128 px). Window: x 0.28–0.72, y 0.2–0.78.
 */
export const STONE = { bays: 4, floors: 8, win: [0.28, 0.72, 0.2, 0.78] };
export function stoneTex() {
  return once('stone', () => {
    const W = 512, H = 1024, BW = 128, FH = 128;
    const c = cnv(W, H), x = c.getContext('2d'), rng = makeRng('ct-stone');
    x.fillStyle = '#d6cebf';
    x.fillRect(0, 0, W, H);
    for (let y = 0; y < H; y += 32) {
      x.fillStyle = 'rgba(80,70,55,0.18)'; x.fillRect(0, y, W, 1);
      for (let k = ((y / 32) % 2) * 64; k < W; k += 128) x.fillRect(k, y, 1, 32);
    }
    for (let i = 0; i < 1800; i++) {
      x.fillStyle = `rgba(${rng() < 0.5 ? '255,250,240' : '70,60,50'},${rng() * 0.06})`;
      x.fillRect(rng() * W, rng() * H, 20, 12);
    }
    for (let fy = 0; fy < 8; fy++) {
      const top = H - (fy + 1) * FH;
      for (let bx = 0; bx < 4; bx++) {
        const x0 = bx * BW + Math.round(BW * 0.28), x1 = bx * BW + Math.round(BW * 0.72);
        const y0 = top + Math.round(FH * 0.22), y1 = top + Math.round(FH * 0.8);
        // the architrave, a pediment (triangular on even floors), the sill
        x.fillStyle = '#ece5d8'; x.fillRect(x0 - 7, y0 - 7, x1 - x0 + 14, y1 - y0 + 14);
        if (fy % 2 === 0) { x.beginPath(); x.moveTo(x0 - 12, y0 - 10); x.lineTo((x0 + x1) / 2, y0 - 26); x.lineTo(x1 + 12, y0 - 10); x.fill(); }
        else { x.fillRect(x0 - 12, y0 - 18, x1 - x0 + 24, 9); }
        x.fillStyle = 'rgba(0,0,0,0.28)'; x.fillRect(x0 - 12, y0 - 10, x1 - x0 + 24, 3);
        x.fillStyle = '#ece5d8'; x.fillRect(x0 - 10, y1 + 7, x1 - x0 + 20, 7);
        x.fillStyle = '#26221f'; x.fillRect(x0 - 2, y0 - 2, x1 - x0 + 4, y1 - y0 + 4);
        const t = 0.85 + rng() * 0.3;
        const g = x.createLinearGradient(0, y0, 0, y1);
        g.addColorStop(0, rgb(104 * t, 116 * t, 130 * t)); g.addColorStop(1, rgb(40 * t, 46 * t, 56 * t));
        x.fillStyle = g; x.fillRect(x0, y0, x1 - x0, y1 - y0);
        x.fillStyle = '#e8e2d6'; x.fillRect(x0, y0 + (y1 - y0) * 0.55, x1 - x0, 4); x.fillRect((x0 + x1) / 2 - 2, y0, 4, y1 - y0);
        if (rng() < 0.55) { x.fillStyle = 'rgba(210,190,150,0.6)'; x.fillRect(x0, y0, (x1 - x0) * 0.25, y1 - y0); x.fillRect(x1 - (x1 - x0) * 0.25, y0, (x1 - x0) * 0.25, y1 - y0); }
      }
    }
    streaks(x, W, H, rng, 16, 0.06);
    grain(x, W, H, rng, 12000, 0.05);
    return toTex(c);
  });
}

/** Plain ashlar (the museum's walls, the arch, plinths): 8 m a tile. */
export function ashlarTex() {
  return once('ashlar', () => {
    const S = 512, c = cnv(S, S), x = c.getContext('2d'), rng = makeRng('ct-ashlar');
    x.fillStyle = '#d3cab8';
    x.fillRect(0, 0, S, S);
    for (let r = 0; r < 16; r++) {
      const off = (r % 2) * 64;
      for (let k = -1; k < 5; k++) {
        const t = 0.94 + rng() * 0.1;
        x.fillStyle = rgb(214 * t, 205 * t, 188 * t);
        x.fillRect(k * 128 + off + 1, r * 32 + 1, 126, 30);
      }
    }
    for (let i = 0; i < 900; i++) {
      x.fillStyle = `rgba(${rng() < 0.5 ? '255,250,240' : '60,50,40'},${rng() * 0.05})`;
      x.fillRect(rng() * S, rng() * S, 18, 10);
    }
    streaks(x, S, S, rng, 14, 0.06);
    grain(x, S, S, rng, 9000, 0.05);
    return toTex(c);
  });
}

/**
 * Uptown's street level: two rows of four 6 m × 4.5 m shopfronts (painted
 * wood, gilt lettering, warm windows). map + emissive.
 */
export function boutiqueTex() {
  return once('boutique', () => {
    const W = 1024, H = 512, SW = 256;
    const c = cnv(W, H), e = cnv(W, H), x = c.getContext('2d'), ex = e.getContext('2d');
    const rng = makeRng('ct-boutique');
    ex.fillStyle = '#000'; ex.fillRect(0, 0, W, H);
    const SHOPS = [
      ['BAKERY', '#2c4a32', '#ffd9a0', ['#e8c890', '#c8884a', '#f2e8d8']],
      ['FLORIST', '#5a1f2a', '#ffe0c0', ['#e8486a', '#f2d24a', '#5aa04a', '#ffffff']],
      ['JEWELERS', '#111418', '#fff0d0', ['#f2d890', '#e8e8f0']],
      ['BOOKS', '#1f2c4a', '#ffd090', ['#8a2a1a', '#2a4a7a', '#c8a050', '#3a5a3a']],
      ['TAILOR', '#2a2a2a', '#ffe2b0', ['#3a3a4a', '#8a7a6a', '#d8d0c0']],
      ['WINE & SPIRITS', '#4a1a1a', '#ffcf80', ['#5a1a2a', '#2a3a1a', '#c8a050']],
      ['CAFÉ', '#1d3a3a', '#ffcf8a', ['#f2e8d8', '#7a4a2a', '#c89a5a']],
      ['GALLERY', '#e8e4dc', '#fff8ec', ['#c23a2a', '#2a6ac8', '#e8c22a', '#1a1a1a']],
    ];
    SHOPS.forEach(([name, frame, light, goods], k) => {
      const x0 = (k % 4) * SW, top = Math.floor(k / 4) * 256, bot = top + 256;
      x.fillStyle = frame; x.fillRect(x0, top, SW, 256);
      // fascia with gilt letters
      x.fillStyle = 'rgba(0,0,0,0.25)'; x.fillRect(x0 + 10, top + 12, SW - 20, 50);
      x.font = 'bold 30px Georgia, "Times New Roman", serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
      x.fillStyle = name === 'GALLERY' ? '#1a1a1a' : '#e8c46a'; x.fillText(name, x0 + SW / 2, top + 38, SW - 36);
      ex.font = 'bold 30px Georgia, "Times New Roman", serif'; ex.textAlign = 'center'; ex.textBaseline = 'middle';
      ex.fillStyle = '#ffd890'; ex.globalAlpha = 0.7; ex.fillText(name, x0 + SW / 2, top + 38, SW - 36); ex.globalAlpha = 1;
      // display window (left), door (right) with a transom
      const wy0 = top + 76, wy1 = bot - 30;
      x.fillStyle = '#b8a07a'; x.fillRect(x0 + 16, wy0, 160, wy1 - wy0);
      const g = x.createLinearGradient(0, wy0, 0, wy1); g.addColorStop(0, light); g.addColorStop(1, '#6a5038');
      x.fillStyle = g; x.globalAlpha = 0.55; x.fillRect(x0 + 16, wy0, 160, wy1 - wy0); x.globalAlpha = 1;
      for (let i = 0; i < 14; i++) {
        x.fillStyle = goods[Math.floor(rng() * goods.length)];
        x.fillRect(x0 + 24 + rng() * 130, wy0 + 50 + rng() * 80, 8 + rng() * 16, 8 + rng() * 18);
      }
      const ge = ex.createLinearGradient(0, wy0, 0, wy1); ge.addColorStop(0, light); ge.addColorStop(1, 'rgba(60,40,20,0.4)');
      ex.fillStyle = ge; ex.globalAlpha = 0.75; ex.fillRect(x0 + 16, wy0, 160, wy1 - wy0); ex.globalAlpha = 1;
      x.fillStyle = 'rgba(20,14,10,0.9)'; x.fillRect(x0 + 190, wy0 + 30, 52, wy1 - wy0 - 30);
      x.fillStyle = light; x.globalAlpha = 0.5; x.fillRect(x0 + 196, wy0 + 36, 40, 60); x.globalAlpha = 1;
      ex.fillStyle = light; ex.globalAlpha = 0.5; ex.fillRect(x0 + 196, wy0 + 36, 40, 60); ex.globalAlpha = 1;
      x.fillStyle = light; x.globalAlpha = 0.6; x.fillRect(x0 + 190, wy0, 52, 24); x.globalAlpha = 1;
      ex.fillStyle = light; ex.globalAlpha = 0.6; ex.fillRect(x0 + 190, wy0, 52, 24); ex.globalAlpha = 1;
      // mullions, stall riser, pilasters
      x.fillStyle = frame; x.fillRect(x0 + 16, wy0 + 60, 160, 4); x.fillRect(x0 + 94, wy0, 4, wy1 - wy0);
      x.fillStyle = 'rgba(0,0,0,0.3)'; x.fillRect(x0 + 10, wy1, SW - 20, bot - wy1);
      x.fillStyle = 'rgba(255,255,255,0.1)'; x.fillRect(x0, top, 8, 256); x.fillRect(x0 + SW - 8, top, 8, 256);
      x.save(); x.globalAlpha = 0.13; x.fillStyle = '#fff';
      const sx = x0 + 30 + rng() * 100; x.beginPath(); x.moveTo(sx, wy0); x.lineTo(sx + 26, wy0); x.lineTo(sx - 24, wy1); x.lineTo(sx - 50, wy1); x.fill();
      x.restore();
    });
    x.textAlign = 'left'; ex.textAlign = 'left';
    grain(x, W, H, rng, 6000, 0.05);
    return { map: toTex(c), emi: toTex(e) };
  });
}

/** Uptown's signs atlas (marquee, blade sign, hotel and museum names, awnings, street signs). */
const UT_SIGNS = [
  ['orpheum', 128, 512], ['marquee', 512, 128], ['marquee2', 384, 128], ['royale', 512, 96], ['belmont', 512, 96], ['astoria', 512, 96],
  ['museum', 512, 96], ['banner0', 96, 320], ['banner1', 96, 320], ['banner2', 96, 320],
  ['aw0', 128, 128], ['aw1', 128, 128], ['aw2', 128, 128], ['aw3', 128, 128], ['aw4', 128, 128],
  ['u_park', 256, 48], ['u_madison', 256, 48], ['u_lincoln', 256, 48], ['u_terrace', 256, 48], ['u_concourse', 256, 48], ['u_blank', 256, 48],
  ['victory', 512, 80], ['plaque', 128, 96], ['canopy0', 256, 64], ['canopy1', 256, 64], ['canopy2', 256, 64], ['mews', 256, 64],
];
export const UT_SIGN_RECTS = shelf(UT_SIGNS, 1024);
export const UT_STREET_SIGN = { 'PARK BLVD': 'u_park', 'MADISON BLVD': 'u_madison', 'LINCOLN BLVD': 'u_lincoln', 'TERRACE AVE': 'u_terrace', 'GRAND CONCOURSE': 'u_concourse' };
export const AWNINGS = 5;

export function utSignsTex() {
  return once('utsigns', () => {
    const S = 1024, c = cnv(S, S), x = c.getContext('2d'), rng = makeRng('ct-utsigns');
    x.fillStyle = '#000'; x.fillRect(0, 0, S, S);
    const R = UT_SIGN_RECTS;
    const text = (name, t, font, fg, bg, o = {}) => {
      const [px, py, w, h] = R[name];
      x.fillStyle = bg; x.fillRect(px, py, w, h);
      if (o.border) { x.strokeStyle = o.border; x.lineWidth = 3; x.strokeRect(px + 4, py + 4, w - 8, h - 8); }
      x.font = font; x.fillStyle = fg; x.textAlign = 'center'; x.textBaseline = 'middle';
      x.fillText(t, px + w / 2, py + h / 2 + (o.dy || 0), w - 20);
    };
    // the Orpheum's blade: red, gold-edged, letters down it
    {
      const [px, py, w, h] = R.orpheum;
      x.fillStyle = '#9a0e14'; x.fillRect(px, py, w, h);
      x.strokeStyle = '#ffd36a'; x.lineWidth = 6; x.strokeRect(px + 6, py + 6, w - 12, h - 12);
      x.font = 'bold 62px Georgia, serif'; x.fillStyle = '#fff4d0'; x.textAlign = 'center'; x.textBaseline = 'middle';
      'ORPHEUM'.split('').forEach((ch, k) => x.fillText(ch, px + w / 2, py + 44 + k * 68));
    }
    text('marquee', 'TONIGHT · MIDNIGHT FREQUENCY', 'bold 34px Arial, sans-serif', '#141414', '#fbf6e4', { border: '#141414' });
    text('marquee2', 'GALA PREMIERE 8 PM', 'bold 36px Arial, sans-serif', '#141414', '#fbf6e4', { border: '#141414' });
    text('royale', 'THE ROYALE', 'bold 64px Georgia, serif', '#ffe6a8', '#2a0e12');
    text('belmont', 'HOTEL BELMONT', 'bold 56px Georgia, serif', '#ffffff', '#0e2a1e');
    text('astoria', 'THE ASTORIA', 'bold 60px Georgia, serif', '#ffe9b8', '#12182a');
    text('museum', 'CITY  MUSEUM', 'bold 70px Georgia, serif', '#5a5246', '#d3cab8');
    [['#9a1a1a', 'MODERN MASTERS'], ['#1a3a7a', 'ANCIENT WORLDS'], ['#1f5a3a', 'THE GILDED AGE']].forEach(([bg, t], k) => {
      const [px, py, w, h] = R['banner' + k];
      x.fillStyle = bg; x.fillRect(px, py, w, h);
      x.save(); x.translate(px + w / 2, py + h / 2); x.rotate(-Math.PI / 2);
      x.font = 'bold 30px Georgia, serif'; x.fillStyle = '#fff'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(t, 0, 0, h - 30);
      x.restore();
    });
    // awnings: stripes (and plain)
    [['#1f5a3a', '#f2ede0'], ['#8a1a22', '#f2ede0'], ['#1a2a4a', '#1a2a4a'], ['#5a1f3a', '#5a1f3a'], ['#2a2a2a', '#c8a050']].forEach(([a, b], k) => {
      const [px, py, w, h] = R['aw' + k];
      for (let s = 0; s < 8; s++) { x.fillStyle = s % 2 ? b : a; x.fillRect(px + s * w / 8, py, w / 8, h); }
      x.fillStyle = 'rgba(0,0,0,0.25)'; x.fillRect(px, py + h - 14, w, 14);
    });
    for (const [n, k] of Object.entries(UT_STREET_SIGN)) text(k, n, 'bold 30px Georgia, serif', '#ffffff', '#1a2a4a', { border: '#d8c890' });
    text('u_blank', '', 'bold 30px Georgia', '#fff', '#1a2a4a', { border: '#d8c890' });
    text('victory', 'TO THE MEN WHO BUILT THE CITY', 'bold 34px Georgia, serif', '#4a4234', '#d3cab8');
    {
      const [px, py, w, h] = R.plaque;
      x.fillStyle = '#6a5a2a'; x.fillRect(px, py, w, h);
      x.strokeStyle = '#e8c870'; x.lineWidth = 4; x.strokeRect(px + 6, py + 6, w - 12, h - 12);
      x.fillStyle = '#e8c870'; for (let k = 0; k < 4; k++) x.fillRect(px + 20, py + 26 + k * 14, w - 40, 5);
    }
    text('canopy0', 'TWO PARK ROW', 'bold 30px Georgia, serif', '#e8d8a8', '#1f3a2a');
    text('canopy1', 'THE DAKOTA', 'bold 30px Georgia, serif', '#e8d8a8', '#3a1a1a');
    text('canopy2', '900 MADISON', 'bold 30px Georgia, serif', '#e8d8a8', '#1a1f3a');
    text('mews', 'BELGRAVE MEWS', 'bold 30px Georgia, serif', '#1a1a1a', '#e8e0cc', { border: '#1a1a1a' });
    void rng;
    x.textAlign = 'left';
    return toTex(c, { repeat: false });
  });
}

/** Pond water: dark green-black with ripples, glints and lily pads (tiles). */
export function pondTex() {
  return once('pond', () => {
    const S = 256, c = cnv(S, S), x = c.getContext('2d'), rng = makeRng('ct-pond');
    const g = x.createLinearGradient(0, 0, S, S); g.addColorStop(0, '#1c3234'); g.addColorStop(1, '#14262a');
    x.fillStyle = g; x.fillRect(0, 0, S, S);
    for (let i = 0; i < 70; i++) {
      const px = rng() * S, py = rng() * S, w = 10 + rng() * 40;
      x.strokeStyle = `rgba(170,200,210,${0.06 + rng() * 0.12})`; x.lineWidth = 1 + rng();
      for (const ox of [-S, 0, S]) for (const oy of [-S, 0, S]) { x.beginPath(); x.ellipse(px + ox, py + oy, w, w * 0.3, 0, 0, Math.PI * 2); x.stroke(); }
    }
    for (let i = 0; i < 14; i++) {
      const px = rng() * S, py = rng() * S, r = 4 + rng() * 6;
      for (const ox of [-S, 0, S]) for (const oy of [-S, 0, S]) {
        x.fillStyle = '#3a6a2a'; x.beginPath(); x.arc(px + ox, py + oy, r, 0.3, Math.PI * 2); x.lineTo(px + ox, py + oy); x.fill();
      }
    }
    return toTex(c);
  });
}

/** Hexagonal park pavers (the paths and the bandstand's circle). */
export function hexTex() {
  return once('hexpave', () => {
    // 10 hexes across, 17 rows of pairs down: the pattern's own period, so it tiles
    const S = 480, c = cnv(S, S), x = c.getContext('2d'), rng = makeRng('ct-hex');
    x.fillStyle = '#3c3a36'; x.fillRect(0, 0, S, S);
    const r = 16, hh = S / 17;
    for (let row = -1; row < 2 * 17 + 2; row++) {
      for (let col = -1; col < 11; col++) {
        const cx = col * r * 3 + (row % 2 ? r * 1.5 : 0), cy = row * hh / 2;
        const t = 0.85 + rng() * 0.25;
        x.fillStyle = rgb(118 * t, 112 * t, 102 * t);
        x.beginPath();
        for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI * 2; x.lineTo(cx + Math.cos(a) * (r - 1.5), cy + Math.sin(a) * (r - 1.5)); }
        x.fill();
      }
    }
    grain(x, S, S, rng, 16000, 0.1);
    return toTex(c);
  });
}
