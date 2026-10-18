// PORT HALCYON — OLD TOWN's atlases: its windows (tall French casements,
// louvred shutters, round-headed and dormer windows, carriage doors, the
// cathedral's lancets and rose, the clock dial) and its shopfronts (cafés,
// bakeries, bookshops, gold letters on painted boards). Each atlas is a day
// map and a night map: the night map is what glows when the lamps come on.
// Joinery is drawn pale so the window's vertex colour paints frames and
// shutters per building.
import { canvasPair, tileUV, grain, fitText, rrect } from './tex.js';

// ------------------------------------------------------------------ windows

const WW = 1024, WH = 1024;
/** Window tiles: name → [px, py, pw, ph] in the 1024² atlas. */
export const OTW = {
  w_dark: [0, 0, 128, 256], w_lace: [128, 0, 128, 256], w_lit: [256, 0, 128, 256], w_sheer: [384, 0, 128, 256],
  w_drape: [512, 0, 128, 256], w_dim: [640, 0, 128, 256], w_bal: [768, 0, 128, 256], w_ballit: [896, 0, 128, 256],
  s_dark: [0, 256, 256, 256], s_lit: [256, 256, 256, 256], s_drape: [512, 256, 256, 256], c_dark: [768, 256, 128, 256], c_lit: [896, 256, 128, 256],
  a_dark: [0, 512, 128, 256], a_lit: [128, 512, 128, 256], d_dark: [256, 512, 128, 128], d_lit: [256, 640, 128, 128],
  o_dark: [384, 512, 128, 128], o_lit: [384, 640, 128, 128], door: [512, 512, 128, 256], door_lit: [640, 512, 128, 256],
  lancet: [768, 512, 128, 256], lancet2: [896, 512, 128, 256],
  rose: [0, 768, 256, 256], clock: [256, 768, 256, 256], hall: [512, 768, 256, 256], portal: [768, 768, 256, 256],
};
export const otwUV = (name) => tileUV(WW, WH, ...OTW[name]);
/** Plain windows by how lit they are, for picking. */
export const OTW_SINGLE = { dark: ['w_dark', 'w_lace', 'w_dark', 'w_lace'], lit: ['w_lit', 'w_sheer', 'w_drape', 'w_dim', 'w_sheer'] };

const FRAME = '#efeee8';
const GLOW = ['#ffb459', '#ffc77a', '#ffa64d', '#ffd08e'];

function glass(x, gx, gy, gw, gh, rng) {
  const g = x.createLinearGradient(gx, gy, gx + gw * 0.3, gy + gh);
  g.addColorStop(0, '#4a5a6c');
  g.addColorStop(0.35, '#1c2532');
  g.addColorStop(1, '#151b24');
  x.fillStyle = g;
  x.fillRect(gx, gy, gw, gh);
  // a sky reflection across the panes
  x.save();
  x.beginPath(); x.rect(gx, gy, gw, gh); x.clip();
  x.fillStyle = 'rgba(190,215,240,0.13)';
  const s = gx + rng() * gw;
  x.beginPath(); x.moveTo(s, gy); x.lineTo(s + gw * 0.5, gy); x.lineTo(s - gw * 0.2, gy + gh); x.lineTo(s - gw * 0.7, gy + gh); x.fill();
  x.restore();
}

/** Curtains in the glass area (day map), and how they shape the glow (night map). */
function curtains(x, e, gx, gy, gw, gh, kind, lit, glowCol, rng) {
  if (lit) {
    const g = e.createRadialGradient(gx + gw * (0.35 + rng() * 0.3), gy + gh * 0.35, 4, gx + gw / 2, gy + gh / 2, gh * 0.75);
    g.addColorStop(0, '#fff0d0');
    g.addColorStop(0.35, glowCol);
    g.addColorStop(1, lit < 0.7 ? '#5a2e10' : '#a65a1c');
    e.globalAlpha = lit;
    e.fillStyle = g;
    e.fillRect(gx, gy, gw, gh);
    e.globalAlpha = 1;
  }
  if (kind === 'lace' || kind === 'sheer') {
    x.fillStyle = kind === 'lace' ? 'rgba(235,232,222,0.62)' : 'rgba(225,205,170,0.5)';
    x.fillRect(gx, gy, gw, gh);
    if (kind === 'lace') {
      x.fillStyle = 'rgba(255,255,255,0.35)';
      for (let yy = gy + 4; yy < gy + gh; yy += 9) for (let xx = gx + ((yy / 9) % 2) * 4; xx < gx + gw; xx += 8) x.fillRect(xx, yy, 2.5, 2.5);
    }
    if (lit) { e.fillStyle = 'rgba(255,220,170,0.25)'; e.fillRect(gx, gy, gw, gh); }
  } else if (kind === 'drape') {
    const dw = gw * 0.3;
    const col = rng() < 0.5 ? '#7a1f22' : '#5c3a1a';
    for (const [sx, dir] of [[gx, 1], [gx + gw - dw, -1]]) {
      x.fillStyle = col;
      x.fillRect(sx, gy, dw, gh);
      x.fillStyle = 'rgba(0,0,0,0.3)';
      for (let k = 0; k < 4; k++) x.fillRect(sx + (k + 0.5) * dw / 4, gy, 2, gh);
      e.fillStyle = lit ? 'rgba(150,40,20,0.9)' : '#000';
      e.fillRect(sx, gy, dw, gh);
      void dir;
    }
  }
}

/** A tall French casement: frame, two leaves of three panes, a transom. */
function french(x, e, px, py, pw, ph, rng, o = {}) {
  const lit = o.lit || 0, kind = o.curtain || 'none';
  // the opening's reveal (shadow round the joinery)
  x.fillStyle = '#2b2722';
  x.fillRect(px, py, pw, ph);
  const ix = px + 5, iy = py + 4, iw = pw - 10, ih = ph - 6;
  const arch = !!o.arch;
  const fw = 7;
  x.save();
  e.save();
  if (arch) {
    const r = iw / 2;
    for (const c of [x, e]) { c.beginPath(); c.moveTo(ix, iy + ih); c.lineTo(ix, iy + r); c.arc(ix + r, iy + r, r, Math.PI, 0); c.lineTo(ix + iw, iy + ih); c.closePath(); c.clip(); }
  }
  glass(x, ix, iy, iw, ih, rng);
  curtains(x, e, ix + fw, iy + fw, iw - 2 * fw, ih - 2 * fw, kind, lit, o.glow || GLOW[Math.floor(rng() * GLOW.length)], rng);
  // joinery
  x.fillStyle = FRAME;
  e.fillStyle = '#000';
  const bars = [[ix, iy, iw, fw], [ix, iy + ih - fw, iw, fw], [ix, iy, fw, ih], [ix + iw - fw, iy, fw, ih], [ix + iw / 2 - 3, iy, 6, ih], [ix, iy + ih * 0.25 - 3, iw, 6]];
  for (const f of [0.5, 0.75]) bars.push([ix, iy + ih * f - 1.5, iw, 3]);
  if (arch) bars.push([ix, iy + iw / 2 - 2, iw, 4]);
  for (const b of bars) { x.fillRect(...b); e.fillRect(...b); }
  // a slight shade under the top rail
  x.fillStyle = 'rgba(0,0,0,0.25)';
  x.fillRect(ix + fw, iy + fw, iw - 2 * fw, 4);
  x.restore();
  e.restore();
  if (o.balcon) railing(x, e, px + 2, py + ph * 0.66, pw - 4, ph * 0.32);
  grain(x, pw, ph, rng, 0);
}

/** A small wrought-iron railing drawn over the window (balconette). */
function railing(x, e, px, py, pw, ph) {
  x.fillStyle = '#1b1b1d';
  e.fillStyle = '#000';
  for (const c of [x, e]) {
    c.fillRect(px, py, pw, 5);
    c.fillRect(px, py + ph - 5, pw, 5);
    for (let k = 0; k <= 10; k++) c.fillRect(px + k * (pw - 3) / 10, py, 3, ph);
  }
  x.strokeStyle = '#1b1b1d';
  x.lineWidth = 2.5;
  for (let k = 0; k < 5; k++) { x.beginPath(); x.arc(px + (k + 0.5) * pw / 5, py + ph * 0.45, pw / 12, 0, Math.PI * 2); x.stroke(); }
}

/** Louvred shutters (a pair) in w × h, open (flat either side) or closed. */
function louvres(x, sx, sy, sw, sh) {
  x.fillStyle = '#e4e3dc';
  x.fillRect(sx, sy, sw, sh);
  x.fillStyle = 'rgba(0,0,0,0.28)';
  for (let yy = sy + 10; yy < sy + sh - 8; yy += 7) x.fillRect(sx + 5, yy, sw - 10, 2.5);
  x.fillStyle = 'rgba(255,255,255,0.3)';
  for (let yy = sy + 12; yy < sy + sh - 8; yy += 7) x.fillRect(sx + 5, yy, sw - 10, 1.2);
  // stiles and rails
  x.fillStyle = '#f4f3ee';
  x.fillRect(sx, sy, 5, sh); x.fillRect(sx + sw - 5, sy, 5, sh);
  x.fillRect(sx, sy, sw, 7); x.fillRect(sx, sy + sh / 2 - 3, sw, 6); x.fillRect(sx, sy + sh - 7, sw, 7);
  x.strokeStyle = 'rgba(0,0,0,0.35)';
  x.lineWidth = 1;
  x.strokeRect(sx + 0.5, sy + 0.5, sw - 1, sh - 1);
}

function shuttered(x, e, px, py, pw, ph, rng, o) {
  // the window in the middle, a shutter leaf open against the wall each side
  const lw = pw / 4;
  french(x, e, px + lw, py, pw / 2, ph, rng, o);
  for (const sx of [px + 2, px + pw - lw - 2]) {
    // (a soft shadow on the wall behind is part of the leaf's edge)
    louvres(x, sx, py + 6, lw, ph - 10);
    e.fillStyle = '#000';
    e.fillRect(sx, py, lw, ph);
  }
  // the tile's corners outside the leaves are wall: leave them the leaf colour
}

function closedShutters(x, e, px, py, pw, ph, rng, lit) {
  x.fillStyle = '#2b2722';
  x.fillRect(px, py, pw, ph);
  louvres(x, px + 4, py + 4, pw / 2 - 4, ph - 6);
  louvres(x, px + pw / 2, py + 4, pw / 2 - 4, ph - 6);
  if (lit) {
    // light through the slats
    for (let yy = py + 14; yy < py + ph - 10; yy += 7) {
      e.fillStyle = `rgba(255,${170 + (rng() * 40 | 0)},90,${0.55 + rng() * 0.3})`;
      e.fillRect(px + 10, yy, pw / 2 - 16, 2);
      e.fillRect(px + pw / 2 + 6, yy, pw / 2 - 16, 2);
    }
  }
}

function dormer(x, e, px, py, pw, ph, rng, lit) {
  x.fillStyle = '#2b2722';
  x.fillRect(px, py, pw, ph);
  const ix = px + 14, iy = py + 8, iw = pw - 28, ih = ph - 12;
  x.save(); e.save();
  for (const c of [x, e]) { c.beginPath(); c.moveTo(ix, iy + ih); c.lineTo(ix, iy + iw / 2); c.arc(ix + iw / 2, iy + iw / 2, iw / 2, Math.PI, 0); c.lineTo(ix + iw, iy + ih); c.closePath(); c.clip(); }
  glass(x, ix, iy, iw, ih, rng);
  curtains(x, e, ix, iy, iw, ih, rng() < 0.5 ? 'lace' : 'none', lit ? 0.85 : 0, GLOW[1], rng);
  x.fillStyle = FRAME; e.fillStyle = '#000';
  for (const b of [[ix + iw / 2 - 3, iy, 6, ih], [ix, iy + ih * 0.55, iw, 4], [ix, iy + ih - 6, iw, 6], [ix, iy, 6, ih], [ix + iw - 6, iy, 6, ih]]) { x.fillRect(...b); e.fillRect(...b); }
  x.restore(); e.restore();
}

function oculus(x, e, px, py, pw, ph, rng, lit) {
  x.fillStyle = 'rgba(0,0,0,0)';
  const cx = px + pw / 2, cy = py + ph / 2, r = pw * 0.36;
  x.fillStyle = '#d6d2c6';
  x.beginPath(); x.arc(cx, cy, r + 10, 0, Math.PI * 2); x.fill();
  x.fillStyle = '#2b2722';
  x.beginPath(); x.arc(cx, cy, r + 2, 0, Math.PI * 2); x.fill();
  x.save(); e.save();
  for (const c of [x, e]) { c.beginPath(); c.arc(cx, cy, r, 0, Math.PI * 2); c.clip(); }
  glass(x, cx - r, cy - r, 2 * r, 2 * r, rng);
  if (lit) curtains(x, e, cx - r, cy - r, 2 * r, 2 * r, 'none', 0.9, GLOW[0], rng);
  x.fillStyle = FRAME; e.fillStyle = '#000';
  for (const b of [[cx - 2, cy - r, 4, 2 * r], [cx - r, cy - 2, 2 * r, 4]]) { x.fillRect(...b); e.fillRect(...b); }
  x.restore(); e.restore();
}

/** A tall residential door under a fanlight. */
function door(x, e, px, py, pw, ph, rng, lit) {
  x.fillStyle = '#2b2722';
  x.fillRect(px, py, pw, ph);
  const ix = px + 8, iw = pw - 16, iy = py + 6, ih = ph - 8;
  // fanlight
  x.save(); e.save();
  for (const c of [x, e]) { c.beginPath(); c.arc(ix + iw / 2, iy + iw / 2, iw / 2, Math.PI, 0); c.lineTo(ix + iw, iy + iw * 0.62); c.lineTo(ix, iy + iw * 0.62); c.closePath(); c.clip(); }
  glass(x, ix, iy, iw, iw * 0.62, rng);
  if (lit) { e.fillStyle = '#ffc070'; e.fillRect(ix, iy, iw, iw * 0.62); }
  x.strokeStyle = FRAME; x.lineWidth = 3;
  for (let k = 0; k < 6; k++) { const a = Math.PI + (k + 0.5) * Math.PI / 6; x.beginPath(); x.moveTo(ix + iw / 2, iy + iw * 0.6); x.lineTo(ix + iw / 2 + Math.cos(a) * iw, iy + iw / 2 + Math.sin(a) * iw); x.stroke(); }
  x.restore(); e.restore();
  // the leaves: panelled wood, painted (the vertex colour), brass knob
  const dy = iy + iw * 0.62 + 4, dh = ih - iw * 0.62 - 4;
  x.fillStyle = '#d9d6cc';
  x.fillRect(ix, dy, iw, dh);
  x.fillStyle = 'rgba(0,0,0,0.3)';
  x.fillRect(ix + iw / 2 - 1.5, dy, 3, dh);
  for (const [a, b] of [[0.06, 0.3], [0.38, 0.62], [0.7, 0.94]]) {
    for (const lx of [ix + 6, ix + iw / 2 + 5]) {
      x.strokeStyle = 'rgba(0,0,0,0.35)'; x.lineWidth = 2;
      x.strokeRect(lx, dy + dh * a, iw / 2 - 11, dh * (b - a));
    }
  }
  x.fillStyle = '#c9a24a';
  x.beginPath(); x.arc(ix + iw / 2, dy + dh * 0.5, 4, 0, Math.PI * 2); x.fill();
}

/** Stained glass: a lancet (pointed) light of coloured quarries. */
function lancet(x, e, px, py, pw, ph, rng, warmish) {
  x.fillStyle = '#2b2722';
  x.fillRect(px, py, pw, ph);
  const ix = px + 14, iw = pw - 28, iy = py + 8, ih = ph - 12;
  const pal = warmish ? ['#c8322a', '#e0a020', '#2a4aa8', '#e8d070', '#7a2a8a'] : ['#2246b0', '#1a6aa0', '#c02a2a', '#e8b030', '#2a8a5a'];
  x.save(); e.save();
  for (const c of [x, e]) {
    c.beginPath(); c.moveTo(ix, iy + ih); c.lineTo(ix, iy + iw * 0.9);
    c.quadraticCurveTo(ix, iy, ix + iw / 2, iy); c.quadraticCurveTo(ix + iw, iy, ix + iw, iy + iw * 0.9);
    c.lineTo(ix + iw, iy + ih); c.closePath(); c.clip();
  }
  const q = 12;
  for (let yy = iy; yy < iy + ih; yy += q) {
    for (let xx = ix; xx < ix + iw; xx += q) {
      const c = pal[Math.floor(rng() * pal.length)];
      x.fillStyle = c; x.globalAlpha = 0.55; x.fillRect(xx, yy, q, q);
      e.fillStyle = c; e.globalAlpha = 0.75 + rng() * 0.25; e.fillRect(xx, yy, q, q);
    }
  }
  x.globalAlpha = 1; e.globalAlpha = 1;
  // a figure-ish medallion
  for (const c of [x, e]) { c.fillStyle = '#f0d890'; c.beginPath(); c.arc(ix + iw / 2, iy + ih * 0.42, iw * 0.28, 0, Math.PI * 2); c.fill(); }
  x.fillStyle = '#1a1612'; e.fillStyle = '#000';
  for (let yy = iy; yy < iy + ih; yy += q) { x.fillRect(ix, yy, iw, 2); e.fillRect(ix, yy, iw, 2); }
  for (let xx = ix; xx < ix + iw; xx += q) { x.fillRect(xx, iy, 2, ih); e.fillRect(xx, iy, 2, ih); }
  for (const b of [[ix, iy + ih * 0.66, iw, 5], [ix + iw / 2 - 2, iy + ih * 0.66, 4, ih * 0.34]]) { x.fillRect(...b); e.fillRect(...b); }
  x.restore(); e.restore();
}

function rose(x, e, px, py, S, rng) {
  const cx = px + S / 2, cy = py + S / 2, R = S * 0.47;
  x.fillStyle = '#b8ae9c';
  x.fillRect(px, py, S, S);
  x.fillStyle = '#2b2722';
  x.beginPath(); x.arc(cx, cy, R, 0, Math.PI * 2); x.fill();
  const pal = ['#2246b0', '#c02a2a', '#e8b030', '#1a6aa0', '#7a2a8a', '#2a8a5a'];
  const rings = [R * 0.22, R * 0.55, R * 0.92];
  for (let ri = 0; ri < rings.length; ri++) {
    const n = [6, 12, 24][ri];
    const r0 = ri ? rings[ri - 1] : 0, r1 = rings[ri];
    for (let k = 0; k < n; k++) {
      const a0 = (k / n) * Math.PI * 2, a1 = ((k + 1) / n) * Math.PI * 2;
      const c = pal[(k + ri * 2) % pal.length];
      for (const [ctx, al] of [[x, 0.6], [e, 0.9]]) {
        ctx.globalAlpha = al;
        ctx.fillStyle = c;
        ctx.beginPath(); ctx.moveTo(cx + Math.cos(a0) * r0, cy + Math.sin(a0) * r0);
        ctx.arc(cx, cy, r1 - 3, a0 + 0.02, a1 - 0.02);
        ctx.arc(cx, cy, r0 + 3, a1 - 0.02, a0 + 0.02, true);
        ctx.closePath(); ctx.fill();
        ctx.globalAlpha = 1;
      }
    }
  }
  for (const [ctx, col] of [[x, '#d8cfbd'], [e, '#000']]) {
    ctx.strokeStyle = col; ctx.lineWidth = 5;
    for (const r of rings) { ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke(); }
    ctx.lineWidth = 3;
    for (let k = 0; k < 12; k++) { const a = (k / 12) * Math.PI * 2; ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * rings[0], cy + Math.sin(a) * rings[0]); ctx.lineTo(cx + Math.cos(a) * R, cy + Math.sin(a) * R); ctx.stroke(); }
  }
  e.fillStyle = '#ffe9a0';
  e.beginPath(); e.arc(cx, cy, rings[0] * 0.5, 0, Math.PI * 2); e.fill();
  void rng;
}

function clockDial(x, e, px, py, S) {
  const cx = px + S / 2, cy = py + S / 2, R = S * 0.46;
  x.fillStyle = '#c9b98a';
  x.fillRect(px, py, S, S);
  x.fillStyle = '#20242a';
  x.beginPath(); x.arc(cx, cy, R, 0, Math.PI * 2); x.fill();
  x.fillStyle = '#f2ead2';
  x.beginPath(); x.arc(cx, cy, R * 0.86, 0, Math.PI * 2); x.fill();
  e.fillStyle = '#fff2c8';
  e.beginPath(); e.arc(cx, cy, R * 0.86, 0, Math.PI * 2); e.fill();
  const g = e.createRadialGradient(cx, cy, R * 0.1, cx, cy, R * 0.86);
  g.addColorStop(0, 'rgba(255,255,255,0.2)'); g.addColorStop(1, 'rgba(160,110,40,0.5)');
  e.fillStyle = g; e.beginPath(); e.arc(cx, cy, R * 0.86, 0, Math.PI * 2); e.fill();
  // gold ring and hour marks
  x.strokeStyle = '#c8a040'; x.lineWidth = 6;
  x.beginPath(); x.arc(cx, cy, R * 0.93, 0, Math.PI * 2); x.stroke();
  for (let k = 0; k < 60; k++) {
    const a = (k / 60) * Math.PI * 2, big = k % 5 === 0;
    for (const [ctx, col] of [[x, '#1a1a1a'], [e, '#000']]) {
      ctx.strokeStyle = col; ctx.lineWidth = big ? 7 : 2;
      ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * R * (big ? 0.66 : 0.76), cy + Math.sin(a) * R * (big ? 0.66 : 0.76)); ctx.lineTo(cx + Math.cos(a) * R * 0.84, cy + Math.sin(a) * R * 0.84); ctx.stroke();
    }
  }
  for (const [ctx, col] of [[x, '#1a1a1a'], [e, '#000']]) { ctx.fillStyle = col; ctx.beginPath(); ctx.arc(cx, cy, 8, 0, Math.PI * 2); ctx.fill(); }
}

/** A tall round-headed window (town hall, chapel), lit in many panes. */
function hallWindow(x, e, px, py, S, rng) {
  x.fillStyle = '#d0c7b4';
  x.fillRect(px, py, S, S);
  french(x, e, px + S * 0.22, py + 6, S * 0.56, S - 8, rng, { arch: true, lit: 0.95, curtain: 'sheer', glow: '#ffc880' });
}

/** A pointed portal: twin doors under a carved tympanum. */
function portal(x, e, px, py, S, rng) {
  x.fillStyle = '#c8bfae';
  x.fillRect(px, py, S, S);
  const cx = px + S / 2;
  // receding orders (arches)
  for (let k = 0; k < 4; k++) {
    const w = S * (0.92 - k * 0.1), top = py + 6 + k * 8;
    x.fillStyle = k % 2 ? '#b3a994' : '#d8cfbd';
    x.beginPath(); x.moveTo(cx - w / 2, py + S); x.lineTo(cx - w / 2, top + w * 0.5);
    x.quadraticCurveTo(cx - w / 2, top, cx, top); x.quadraticCurveTo(cx + w / 2, top, cx + w / 2, top + w * 0.5);
    x.lineTo(cx + w / 2, py + S); x.closePath(); x.fill();
    x.strokeStyle = 'rgba(0,0,0,0.25)'; x.lineWidth = 2; x.stroke();
  }
  // tympanum with a medallion, lintel, doors
  const dw = S * 0.5, ty = py + S * 0.42;
  x.fillStyle = '#9e9582'; x.fillRect(cx - dw / 2, ty, dw, 10);
  x.fillStyle = '#e2c878';
  x.beginPath(); x.arc(cx, ty - S * 0.12, S * 0.08, 0, Math.PI * 2); x.fill();
  e.fillStyle = 'rgba(255,200,110,0.6)';
  e.beginPath(); e.arc(cx, ty - S * 0.12, S * 0.08, 0, Math.PI * 2); e.fill();
  x.fillStyle = '#3a2416'; x.fillRect(cx - dw / 2, ty + 10, dw, py + S - ty - 10);
  x.fillStyle = 'rgba(0,0,0,0.4)'; x.fillRect(cx - 2, ty + 10, 4, py + S - ty - 10);
  x.fillStyle = '#6a6a6a';
  for (let k = 0; k < 6; k++) { x.fillRect(cx - dw / 2 + 6, ty + 24 + k * 18, dw / 2 - 14, 3); x.fillRect(cx + 8, ty + 24 + k * 18, dw / 2 - 14, 3); }
  void rng;
}

/** The window atlas: { map, emi }. */
export function otWindows() {
  return canvasPair('ot-windows', WW, WH, (x, e, w, h, rng) => {
    x.fillStyle = '#2b2722';
    x.fillRect(0, 0, w, h);
    const T = OTW;
    const at = (n) => T[n];
    french(x, e, ...at('w_dark'), rng, {});
    french(x, e, ...at('w_lace'), rng, { curtain: 'lace' });
    french(x, e, ...at('w_lit'), rng, { lit: 1 });
    french(x, e, ...at('w_sheer'), rng, { lit: 0.95, curtain: 'sheer' });
    french(x, e, ...at('w_drape'), rng, { lit: 1, curtain: 'drape' });
    french(x, e, ...at('w_dim'), rng, { lit: 0.5, curtain: 'lace', glow: '#e08a3a' });
    french(x, e, ...at('w_bal'), rng, { curtain: 'lace', balcon: true });
    french(x, e, ...at('w_ballit'), rng, { lit: 1, curtain: 'sheer', balcon: true });
    shuttered(x, e, ...at('s_dark'), rng, {});
    shuttered(x, e, ...at('s_lit'), rng, { lit: 1, curtain: 'sheer' });
    shuttered(x, e, ...at('s_drape'), rng, { lit: 0.9, curtain: 'drape' });
    closedShutters(x, e, ...at('c_dark'), rng, false);
    closedShutters(x, e, ...at('c_lit'), rng, true);
    french(x, e, ...at('a_dark'), rng, { arch: true, curtain: 'lace' });
    french(x, e, ...at('a_lit'), rng, { arch: true, lit: 1, curtain: 'sheer' });
    dormer(x, e, ...at('d_dark'), rng, false);
    dormer(x, e, ...at('d_lit'), rng, true);
    oculus(x, e, ...at('o_dark'), rng, false);
    oculus(x, e, ...at('o_lit'), rng, true);
    door(x, e, ...at('door'), rng, false);
    door(x, e, ...at('door_lit'), rng, true);
    lancet(x, e, ...at('lancet'), rng, false);
    lancet(x, e, ...at('lancet2'), rng, true);
    rose(x, e, T.rose[0], T.rose[1], 256, rng);
    clockDial(x, e, T.clock[0], T.clock[1], 256);
    hallWindow(x, e, T.hall[0], T.hall[1], 256, rng);
    portal(x, e, T.portal[0], T.portal[1], 256, rng);
  });
}

// ------------------------------------------------------------------ shopfronts

/** Shopfront kinds (one 256² tile each, ~4.8 m × 4.4 m of street front). */
export const OTS = [
  { name: 'CAFÉ', frame: '#1f4a3a', kind: 'cafe', lit: 1 },
  { name: 'BOULANGERIE', frame: '#e8e0c8', kind: 'bread', lit: 1, dark: true },
  { name: 'BRASSERIE', frame: '#6a1a1c', kind: 'cafe', lit: 1 },
  { name: 'PHARMACIE', frame: '#2a5a3a', kind: 'pharma', lit: 1 },
  { name: 'LIBRAIRIE', frame: '#1c2a4a', kind: 'books', lit: 0.8 },
  { name: 'ÉPICERIE', frame: '#7a4a1a', kind: 'grocer', lit: 0.9 },
  { name: 'ANTIQUITÉS', frame: '#3a2a20', kind: 'antique', lit: 0.5 },
  { name: 'FLEURS', frame: '#5a6a3a', kind: 'flowers', lit: 0.8 },
  { name: 'CAVE À VIN', frame: '#4a1a2a', kind: 'wine', lit: 0.7 },
  { name: '', frame: '#2c4a3c', kind: 'shut', lit: 0 },
  { name: '', frame: '#4a4a4c', kind: 'grille', lit: 0 },
  { name: '', frame: '#3a2a1e', kind: 'carriage', lit: 0 },
  { name: 'HORLOGERIE', frame: '#202020', kind: 'clocks', lit: 0.6 },
  { name: 'PÂTISSERIE', frame: '#e8b8c0', kind: 'cakes', lit: 1, dark: true },
  { name: 'TABAC', frame: '#7a1418', kind: 'tabac', lit: 0.9 },
  { name: 'BISTRO', frame: '#1a1a1a', kind: 'cafe', lit: 1 },
];
export const otsUV = (i) => tileUV(1024, 1024, (i % 4) * 256, Math.floor(i / 4) * 256, 256, 256, 2);

const pickc = (rng, a) => a[Math.floor(rng() * a.length)];

function interior(x, e, kind, ax, ay, aw, ah, lit, rng) {
  // back wall and floor
  const warm = kind === 'pharma' ? '#d8efe0' : kind === 'wine' ? '#5a2a20' : '#c99a62';
  x.fillStyle = lit ? warm : '#141618';
  x.fillRect(ax, ay, aw, ah);
  x.fillStyle = 'rgba(0,0,0,0.3)';
  x.fillRect(ax, ay + ah * 0.78, aw, ah * 0.22);
  if (kind === 'cafe') {
    // pendant globes, a bar, little round tables and chairs
    for (let k = 0; k < 3; k++) { x.fillStyle = '#fff2c0'; x.beginPath(); x.arc(ax + (k + 0.5) * aw / 3, ay + 14, 6, 0, Math.PI * 2); x.fill(); }
    x.fillStyle = '#4a2a16'; x.fillRect(ax, ay + ah * 0.48, aw * 0.5, ah * 0.3);
    x.fillStyle = '#c8b070'; x.fillRect(ax, ay + ah * 0.48, aw * 0.5, 4);
    for (let k = 0; k < 4; k++) { const tx = ax + 10 + rng() * (aw - 24); x.fillStyle = '#2a1a10'; x.fillRect(tx, ay + ah * 0.66, 18, 4); x.fillRect(tx + 8, ay + ah * 0.66, 3, 20); }
    for (let k = 0; k < 3; k++) { x.fillStyle = 'rgba(30,15,8,0.7)'; x.fillRect(ax + rng() * (aw - 14), ay + ah * 0.45, 10, 30); }
  } else if (kind === 'bread' || kind === 'cakes') {
    for (let r = 0; r < 3; r++) {
      x.fillStyle = '#6a4a2a'; x.fillRect(ax + 4, ay + 20 + r * 30, aw - 8, 4);
      for (let k = 0; k < aw / 13; k++) { x.fillStyle = kind === 'bread' ? pickc(rng, ['#c8862e', '#a8641e', '#e0a850']) : pickc(rng, ['#f0a0b8', '#f8e0a0', '#a06040', '#f4f0e8']); x.beginPath(); x.ellipse(ax + 9 + k * 13, ay + 14 + r * 30, 6, 4, 0, 0, Math.PI * 2); x.fill(); }
    }
    x.fillStyle = '#e8e0d0'; x.fillRect(ax + 6, ay + ah * 0.62, aw - 12, ah * 0.16);
  } else if (kind === 'books' || kind === 'antique' || kind === 'clocks') {
    for (let r = 0; r < 4; r++) {
      x.fillStyle = '#3a2416'; x.fillRect(ax + 2, ay + 8 + r * 24 + 18, aw - 4, 3);
      for (let k = 0; k < aw / 6; k++) { x.fillStyle = pickc(rng, kind === 'books' ? ['#7a2a1a', '#2a3a6a', '#2a5a3a', '#8a6a2a', '#5a2a4a', '#c8b890'] : ['#6a5a4a', '#8a7a5a', '#4a3a2a', '#a08a5a']); x.fillRect(ax + 3 + k * 6, ay + 8 + r * 24 + rng() * 4, 5, 16); }
    }
    if (kind === 'clocks') for (let k = 0; k < 4; k++) { x.fillStyle = '#e8dcb8'; x.beginPath(); x.arc(ax + 14 + rng() * (aw - 28), ay + 20 + rng() * (ah - 50), 7, 0, Math.PI * 2); x.fill(); }
  } else if (kind === 'grocer' || kind === 'flowers') {
    for (let r = 0; r < 3; r++) {
      for (let k = 0; k < aw / 9; k++) {
        x.fillStyle = kind === 'flowers' ? pickc(rng, ['#e83a5a', '#f8e040', '#f0f0f0', '#c040c0', '#ff8a30', '#3a8a3a']) : pickc(rng, ['#e83a2a', '#f8a020', '#9ac040', '#f0e050', '#7a3a1a', '#3a8a3a']);
        x.beginPath(); x.arc(ax + 5 + k * 9 + rng() * 3, ay + ah * 0.4 + r * 18 + rng() * 5, 4.5, 0, Math.PI * 2); x.fill();
      }
    }
    x.fillStyle = '#7a5a3a'; x.fillRect(ax, ay + ah * 0.75, aw, 6);
  } else if (kind === 'wine') {
    for (let r = 0; r < 5; r++) for (let k = 0; k < aw / 7; k++) { x.fillStyle = pickc(rng, ['#2a0a10', '#3a4a1a', '#1a1a1a']); x.fillRect(ax + 3 + k * 7, ay + 10 + r * 19, 4, 14); }
  } else if (kind === 'pharma') {
    for (let r = 0; r < 4; r++) for (let k = 0; k < aw / 10; k++) { x.fillStyle = pickc(rng, ['#ffffff', '#3a8aca', '#e8e8e8', '#5ab060']); x.fillRect(ax + 3 + k * 10, ay + 12 + r * 22, 7, 12); }
  } else if (kind === 'tabac') {
    for (let r = 0; r < 4; r++) for (let k = 0; k < aw / 8; k++) { x.fillStyle = pickc(rng, ['#e8e8e8', '#c82a2a', '#2a4ac8', '#e8c82a']); x.fillRect(ax + 3 + k * 8, ay + 10 + r * 20, 6, 12); }
  }
  if (lit) {
    const g = e.createLinearGradient(0, ay, 0, ay + ah);
    const c = kind === 'pharma' ? '#c8ffd8' : kind === 'wine' ? '#ff8a50' : '#ffc070';
    g.addColorStop(0, c);
    g.addColorStop(1, 'rgba(120,60,20,0.6)');
    e.globalAlpha = lit;
    e.fillStyle = g;
    e.fillRect(ax, ay, aw, ah);
    e.globalAlpha = 1;
  }
}

function shopTile(x, e, i, rng) {
  const S = 256, px = (i % 4) * S, py = Math.floor(i / 4) * S;
  const o = OTS[i];
  const fr = o.frame;
  x.fillStyle = fr;
  x.fillRect(px, py, S, S);
  const signH = 46, pil = 16, kick = 22;
  const ay = py + signH + 10, ah = S - signH - 10 - kick;
  if (o.kind === 'shut') {
    // closed wooden shutters, panelled
    for (let k = 0; k < 4; k++) {
      const sx = px + pil + k * (S - 2 * pil) / 4;
      x.fillStyle = '#2f5a48'; x.fillRect(sx + 2, ay, (S - 2 * pil) / 4 - 4, ah + kick - 4);
      x.strokeStyle = 'rgba(0,0,0,0.35)'; x.lineWidth = 2;
      x.strokeRect(sx + 8, ay + 8, (S - 2 * pil) / 4 - 16, ah * 0.4);
      x.strokeRect(sx + 8, ay + ah * 0.5, (S - 2 * pil) / 4 - 16, ah * 0.4);
    }
  } else if (o.kind === 'grille') {
    for (let yy = ay; yy < py + S - 6; yy += 7) { x.fillStyle = (yy / 7) % 2 ? '#6e7074' : '#86888c'; x.fillRect(px + pil, yy, S - 2 * pil, 7); }
    x.save(); x.translate(px + 60, ay + 100); x.rotate(-0.12);
    x.font = 'italic bold 38px Arial'; x.fillStyle = pickc(rng, ['#d83a5a', '#3ab0d8', '#e8c83a']);
    x.fillText(pickc(rng, ['MIMI', 'ZOE', 'K-OS', 'PAX']), 0, 0); x.restore();
  } else if (o.kind === 'carriage') {
    // a carriage door in a round arch, the stone round it
    x.fillStyle = '#cbbfa8'; x.fillRect(px, py, S, S);
    const cx = px + S / 2, r = S * 0.36;
    x.fillStyle = '#3a2414';
    x.beginPath(); x.moveTo(cx - r, py + S); x.lineTo(cx - r, py + S * 0.42); x.arc(cx, py + S * 0.42, r, Math.PI, 0); x.lineTo(cx + r, py + S); x.closePath(); x.fill();
    x.strokeStyle = '#a89c84'; x.lineWidth = 10;
    x.beginPath(); x.arc(cx, py + S * 0.42, r + 5, Math.PI, 0); x.stroke();
    x.fillStyle = 'rgba(0,0,0,0.45)'; x.fillRect(cx - 2, py + S * 0.3, 4, S * 0.7);
    for (let k = 0; k < 5; k++) { x.strokeStyle = 'rgba(0,0,0,0.3)'; x.lineWidth = 2; x.strokeRect(cx - r + 10, py + S * 0.5 + k * 22, r - 16, 16); x.strokeRect(cx + 6, py + S * 0.5 + k * 22, r - 16, 16); }
    x.fillStyle = '#c9a24a'; x.beginPath(); x.arc(cx - 10, py + S * 0.68, 4, 0, Math.PI * 2); x.arc(cx + 10, py + S * 0.68, 4, 0, Math.PI * 2); x.fill();
    return;
  } else {
    // windows either side of a door
    const doorW = 52, dl = rng() < 0.5;
    const dx = dl ? px + pil + 6 : px + S - pil - 6 - doorW;
    const wx0 = dl ? dx + doorW + 8 : px + pil + 4, wx1 = dl ? px + S - pil - 4 : dx - 8;
    interior(x, e, o.kind, wx0, ay, wx1 - wx0, ah, o.lit, rng);
    interior(x, e, o.kind, dx, ay, doorW, ah + kick - 2, o.lit * 0.9, rng);
    // glazing bars and the door frame
    x.fillStyle = fr;
    const nb = Math.max(2, Math.round((wx1 - wx0) / 60));
    for (let k = 0; k <= nb; k++) x.fillRect(wx0 - 3 + k * (wx1 - wx0) / nb, ay, 6, ah);
    x.fillRect(wx0, ay + ah * 0.22, wx1 - wx0, 4);
    x.fillRect(dx - 3, ay, 6, ah + kick); x.fillRect(dx + doorW - 3, ay, 6, ah + kick);
    x.fillRect(dx, ay + ah * 0.2, doorW, 5);
    e.fillStyle = '#000';
    for (let k = 0; k <= nb; k++) e.fillRect(wx0 - 3 + k * (wx1 - wx0) / nb, ay, 6, ah);
    e.fillRect(wx0, ay + ah * 0.22, wx1 - wx0, 4);
    // gold lettering in the transom
    if (o.kind === 'cafe' && rng() < 0.9) fitText(x, o.name === 'CAFÉ' ? 'VINS · BIÈRES' : 'DÉJEUNER', (wx0 + wx1) / 2, ay + ah * 0.12, wx1 - wx0 - 10, 'bold 15px Georgia, serif', '#e8c870');
    // reflections
    x.fillStyle = 'rgba(255,255,255,0.10)';
    x.beginPath(); x.moveTo(wx0 + 20, ay); x.lineTo(wx0 + 50, ay); x.lineTo(wx0 + 10, ay + ah); x.lineTo(wx0 - 20, ay + ah); x.fill();
  }
  // pilasters, kick plate, cornice
  const dk = 'rgba(0,0,0,0.25)';
  x.fillStyle = fr; x.fillRect(px, py, pil, S); x.fillRect(px + S - pil, py, pil, S);
  x.fillStyle = dk; x.fillRect(px + pil - 3, py, 3, S); x.fillRect(px + S - pil, py, 3, S);
  if (o.kind !== 'shut' && o.kind !== 'grille') { x.fillStyle = fr; x.fillRect(px, py + S - kick, S, kick); x.fillStyle = dk; x.fillRect(px, py + S - kick, S, 3); }
  // the sign board: painted, with gilt serif letters (lit at night)
  x.fillStyle = fr; x.fillRect(px, py, S, signH + 8);
  x.fillStyle = 'rgba(255,255,255,0.12)'; x.fillRect(px, py + 3, S, 3);
  x.fillStyle = 'rgba(0,0,0,0.3)'; x.fillRect(px, py + signH + 4, S, 4);
  if (o.name) {
    const gold = o.dark ? '#5a3a1a' : '#e8c46a';
    fitText(x, o.name, px + S / 2, py + signH / 2 + 4, S - 40, 'bold 30px Georgia, "Times New Roman", serif', gold, o.dark ? null : 'rgba(60,40,10,0.6)', 2);
    if (o.lit > 0.4) fitText(e, o.name, px + S / 2, py + signH / 2 + 4, S - 40, 'bold 30px Georgia, "Times New Roman", serif', o.dark ? '#8a5a20' : '#e0a040');
  }
  if (o.kind === 'pharma') {
    // the green cross (it glows)
    for (const [ctx, c] of [[x, '#30c060'], [e, '#40ff80']]) { ctx.fillStyle = c; ctx.fillRect(px + 14, py + 10, 30, 10); ctx.fillRect(px + 24, py + 0, 10, 30); }
  }
  if (o.kind === 'tabac') {
    for (const [ctx, c] of [[x, '#c8202a'], [e, '#ff3030']]) { ctx.fillStyle = c; ctx.beginPath(); ctx.moveTo(px + 30, py + 4); ctx.lineTo(px + 44, py + 26); ctx.lineTo(px + 30, py + 48); ctx.lineTo(px + 16, py + 26); ctx.fill(); }
  }
}

/** The shopfront atlas: { map, emi }, 16 fronts (see OTS). */
export function otShops() {
  return canvasPair('ot-shops', 1024, 1024, (x, e, w, h, rng) => {
    for (let i = 0; i < OTS.length; i++) shopTile(x, e, i, rng);
    grain(x, w, h, rng, 20000, 0.08, 1.5);
  });
}

void rrect;
