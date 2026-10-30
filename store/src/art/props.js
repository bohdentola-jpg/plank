// Interactive and set-dressing props. Static parts are baked into the wall
// tiles; anything that moves (claw, screens, lights) is drawn live.
import {
  INK, shape, rect, rrect, ellipse, blob, stroke, tube, dot, text, drips, FONTS,
  mulberry32, shade, tint, mix, rgba, pathPts, measure,
} from '../ink.js';
import { Y, tag, throwup, piece, stickers, poster, POSTERS } from './station.js';
import { emblem } from './products.js';

const F = Y.FLOOR_BACK;

// ---------------------------------------------------------------- token booth

export function boothBack(g, x, w, seed = 1) {
  // body
  rect(g, x, 330, w, F - 330 + 4, { fill: '#3a3f5c', shade: '#2a2e46', sdx: 0, sdy: 6, lw: 3, amp: 0.4, seed });
  for (let i = 0; i < 3; i++) rect(g, x + 14 + i * ((w - 28) / 3), 346, (w - 28) / 3 - 10, 56, { fill: '#454b6c', lw: 2.2, amp: 0.3, seed: seed + 1 + i });
  // interior behind glass
  rect(g, x + 8, 252, w - 16, 80, { fill: '#2a2646', lw: 0, amp: 0, seed: seed + 5 });
  const lg = g.createLinearGradient(0, 252, 0, 332);
  lg.addColorStop(0, rgba('#ffe7a8', 0.35));
  lg.addColorStop(1, rgba('#ffe7a8', 0.05));
  g.fillStyle = lg;
  g.fillRect(x + 8, 252, w - 16, 80);
  // poster inside the booth
  rect(g, x + w - 52, 262, 30, 38, { fill: '#f4efe6', lw: 1.6, amp: 0.3, seed: seed + 6 });
  text(g, 'FARE', x + w - 37, 278, { size: 7, font: FONTS.sign, fill: INK, lw: 0 });
  text(g, '$2.90', x + w - 37, 290, { size: 7, font: FONTS.sign, fill: '#d4473f', lw: 0 });
  // cap + sign
  rrect(g, x - 8, 210, w + 16, 46, 6, { fill: '#2a2e46', lw: 3, seed: seed + 7 });
  rrect(g, x + 10, 216, w - 20, 32, 4, { fill: '#ff9a3c', lw: 2.6, seed: seed + 8 });
  text(g, 'TOKENS', x + w / 2, 241, { size: 24, font: FONTS.sign, fill: '#140f26', lw: 0, spacing: 2 });
}

export function boothFront(g, x, w, seed = 1) {
  // glass with reflections
  g.fillStyle = rgba('#bfe9ff', 0.16);
  g.fillRect(x + 8, 252, w - 16, 80);
  g.save();
  g.beginPath();
  g.rect(x + 8, 252, w - 16, 80);
  g.clip();
  g.fillStyle = rgba('#ffffff', 0.18);
  g.beginPath(); g.moveTo(x + 20, 252); g.lineTo(x + 50, 252); g.lineTo(x + 10, 332); g.lineTo(x - 20, 332); g.fill();
  g.beginPath(); g.moveTo(x + 64, 252); g.lineTo(x + 74, 252); g.lineTo(x + 34, 332); g.lineTo(x + 24, 332); g.fill();
  g.restore();
  // frame
  rect(g, x + 4, 248, w - 8, 8, { fill: '#2a2e46', lw: 3, amp: 0.3, seed });
  rect(g, x + 4, 248, 8, 88, { fill: '#2a2e46', lw: 3, amp: 0.3, seed: seed + 1 });
  rect(g, x + w - 12, 248, 8, 88, { fill: '#2a2e46', lw: 3, amp: 0.3, seed: seed + 2 });
  // speaking grill + tray
  ellipse(g, x + w * 0.27, 300, 12, 12, { fill: '#5a6080', lw: 2.4, seed: seed + 4 });
  for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) dot(g, x + w * 0.27 + i * 5, 300 + j * 5, 1.4, INK);
  rrect(g, x + w * 0.27 - 26, 326, 52, 12, 4, { fill: '#1d1a30', lw: 2.6, seed: seed + 5 });
  rect(g, x - 2, 330, w + 4, 8, { fill: '#545a7c', lw: 3, amp: 0.3, seed: seed + 6 });
}

// ---------------------------------------------------------------- turnstiles

export function turnstiles(g, x, n = 3, seed = 1) {
  for (let i = 0; i < n; i++) {
    const tx = x + i * 62;
    rrect(g, tx, 336, 34, F - 336 + 2, 6, { fill: '#9aa0b8', shade: '#6a7090', sdx: 3, sdy: 0, lw: 3, seed: seed + i });
    rrect(g, tx - 2, 330, 38, 12, 4, { fill: '#c8ccdc', lw: 2.6, seed: seed + 10 + i });
    // card reader
    rrect(g, tx + 6, 320, 22, 12, 2, { fill: '#2a2e46', lw: 2.2, seed: seed + 20 + i });
    stroke(g, [[tx + 9, 324], [tx + 25, 324]], { lw: 1.4, color: '#ffd23f' });
    dot(g, tx + 24, 329, 1.6, '#7ed957');
    // rotor arms
    ellipse(g, tx + 40, 362, 7, 7, { fill: '#c8ccdc', lw: 2.4, seed: seed + 30 + i });
    tube(g, [[tx + 40, 362], [tx + 66, 360]], '#d8dce8', 5, { lw: 2.4, seed: seed + 40 + i });
    tube(g, [[tx + 40, 362], [tx + 46, 384]], '#b8bcd0', 5, { lw: 2.4, seed: seed + 50 + i });
  }
}

// ---------------------------------------------------------------- phone booth

export function phoneBack(g, x, seed = 1) {
  // pole
  rect(g, x + 36, 330, 14, F - 330 + 4, { fill: '#6a6290', lw: 3, amp: 0.3, seed });
  // box (after the reference: chunky lavender box with a lit header)
  rrect(g, x, 224, 86, 112, 10, { fill: '#a49ad6', shade: '#7c72b0', sdx: 4, sdy: 4, lw: 3.4, seed: seed + 1 });
  rrect(g, x + 6, 230, 74, 26, 6, { fill: '#c8c0f0', lw: 2.6, seed: seed + 2 });
  text(g, 'PHONE', x + 43, 251, { size: 19, font: FONTS.sign, fill: '#f6f2ff', lw: 4, line: '#140f26' });
  rrect(g, x + 10, 262, 66, 66, 6, { fill: '#5a5280', lw: 2.6, seed: seed + 3 });
  // keypad
  rrect(g, x + 18, 270, 26, 34, 3, { fill: '#c8c0f0', lw: 2.2, seed: seed + 4 });
  for (let r = 0; r < 4; r++) for (let c = 0; c < 3; c++) rect(g, x + 21 + c * 7.5, 273 + r * 7.5, 5, 5, { fill: '#5a5280', lw: 1, amp: 0, seed: seed + r * 3 + c });
  // cord
  stroke(g, pathPts([['M', x + 62, 312], ['C', x + 56, 330, x + 70, 330, x + 64, 316]]), { lw: 2, color: '#140f26' });
}

export function phoneHandset(g, x, t, ringing) {
  const shake = ringing ? Math.sin(t * 40) * 2 : 0;
  g.save();
  g.translate(x + 64 + shake, 290);
  g.rotate(ringing ? Math.sin(t * 40) * 0.08 : 0);
  blob(g, [['M', -6, -22], ['C', 4, -24, 8, -16, 6, -10], ['L', 4, 12], ['C', 6, 18, 2, 24, -6, 22], ['C', -10, 20, -10, 14, -6, 12], ['L', -4, -10], ['C', -10, -12, -12, -20, -6, -22], ['Z']], { fill: '#c8c0f0', lw: 2.6, seed: 4 });
  g.restore();
}

// ---------------------------------------------------------------- wanted poster

export function wantedFrame(g, x, seed = 1) {
  g.save();
  g.translate(x + 50, 280);
  g.rotate(-0.03);
  rect(g, -50, -66, 100, 132, { fill: '#f2e2b8', lw: 3, amp: 0.8, seed });
  text(g, 'WANTED', 0, -42, { size: 20, font: FONTS.sign, fill: '#8a2a1a', lw: 0 });
  text(g, 'DEAL OF THE DAY', 0, 52, { size: 9, font: FONTS.sign, fill: '#8a2a1a', lw: 0 });
  g.fillStyle = rgba('#f4ead0', 0.7);
  g.save(); g.translate(-44, -64); g.rotate(-0.5); g.fillRect(-12, -4, 24, 8); g.restore();
  g.save(); g.translate(44, -64); g.rotate(0.5); g.fillRect(-12, -4, 24, 8); g.restore();
  g.restore();
}

// ---------------------------------------------------------------- claw machine

export function clawBack(g, x, seed = 1) {
  const w = 124;
  // cabinet base
  rrect(g, x, 334, w, F - 334 + 4, 6, { fill: '#e8456b', shade: '#b82e52', sdx: 4, sdy: 4, lw: 3, seed });
  rrect(g, x + 14, 352, 22, 30, 3, { fill: '#2a2238', lw: 2.4, seed: seed + 1 });
  stroke(g, [[x + 25, 358], [x + 25, 374]], { lw: 2, color: '#ffd23f' });
  rrect(g, x + 50, 390, 60, 22, 3, { fill: '#b82e52', lw: 2.4, seed: seed + 2 });
  text(g, 'PRIZE', x + 80, 405, { size: 10, font: FONTS.sign, fill: '#fffaf0', lw: 0 });
  // control deck
  rrect(g, x - 6, 326, w + 12, 14, 4, { fill: '#ffd23f', lw: 3, seed: seed + 3 });
  // glass box interior
  rect(g, x + 4, 222, w - 8, 106, { fill: '#2a2252', lw: 3, amp: 0.3, seed: seed + 4 });
  // top marquee
  rrect(g, x - 6, 182, w + 12, 44, 8, { fill: '#e8456b', lw: 3, seed: seed + 5 });
  rrect(g, x + 2, 188, w - 4, 32, 6, { fill: '#2a1a3a', lw: 2.4, seed: seed + 6 });
  text(g, 'THE GRABBER', x + w / 2, 211, { size: 15, font: FONTS.sign, fill: '#ffd23f', lw: 3 });
}

// Joystick + live claw + glass, drawn each frame. prizes: [{x,y,kind,color}]
export function clawLive(g, x, t, prizes, clawX = 0.5, glassOnly = false) {
  const w = 124;
  if (!glassOnly) {
    // prizes pile
    for (const p of prizes) prizeBall(g, x + 4 + p.x * (w - 8), 312 - p.y * 40, p, 0.62);
    // claw
    const cx = x + 14 + clawX * (w - 28);
    const sway = Math.sin(t * 1.4) * 2;
    stroke(g, [[x + 6, 228], [x + w - 6, 228]], { lw: 3, color: '#c8c8e0' });
    stroke(g, [[cx, 228], [cx + sway * 0.4, 254]], { lw: 1.8, color: '#c8c8e0' });
    rrect(g, cx - 8 + sway * 0.5, 252, 16, 9, 3, { fill: '#c8c8e0', lw: 2.2, seed: 3 });
    for (const d of [-1, 0, 1]) stroke(g, [[cx + sway * 0.5 + d * 4, 261], [cx + sway * 0.5 + d * 9, 270], [cx + sway * 0.5 + d * 5, 278]], { lw: 2.4, color: '#c8c8e0', seed: 5 + d });
  }
  // glass reflections
  g.fillStyle = rgba('#bfe9ff', 0.1);
  g.fillRect(x + 4, 222, w - 8, 106);
  g.fillStyle = rgba('#ffffff', 0.14);
  g.beginPath(); g.moveTo(x + 14, 222); g.lineTo(x + 34, 222); g.lineTo(x + 8, 300); g.lineTo(x + 6, 260); g.fill();
  // chaser lights on marquee
  for (let i = 0; i < 9; i++) {
    const on = (Math.floor(t * 8) + i) % 3 === 0;
    dot(g, x + 2 + i * ((w - 4) / 8), 184, 2.6, on ? '#ffd23f' : '#7a3050');
  }
  // joystick
  const jt = Math.sin(t * 0.7) * 0.2;
  stroke(g, [[x + 96, 330], [x + 96 + jt * 20, 312]], { lw: 3, color: '#2a2238' });
  ellipse(g, x + 96 + jt * 20, 310, 6, 6, { fill: '#ff4f9a', lw: 2.4, seed: 9 });
  ellipse(g, x + 72, 328, 6, 3, { fill: '#3ec7b0', lw: 2, seed: 10 });
}

export const PRIZE_COLORS = { tokens: '#ffd23f', sticker: '#ff4f9a', coupon: '#3ec7b0', freeze: '#5aa0ff', key: '#ff8a3d', rare: '#b48cff' };

export function prizeBall(g, x, y, p, s = 1) {
  const c = PRIZE_COLORS[p.kind] || '#c8c8e0';
  g.save();
  g.translate(x, y);
  g.scale(s, s);
  ellipse(g, 0, 0, 13, 13, { fill: c, shade: shade(c, 0.3), sdx: 2, sdy: 2, lw: 2.6, seed: Math.round(x) });
  g.fillStyle = rgba('#ffffff', 0.35);
  g.beginPath();
  g.ellipse(-3, -5, 6, 3, -0.4, 0, Math.PI * 2);
  g.fill();
  stroke(g, [[-13, 0], [13, 0]], { lw: 1.6, color: rgba('#140f26', 0.6), amp: 0.2 });
  if (p.kind === 'key') emblem(g, 'star', 0, 0, 0.4, '#fffaf0', 4);
  else if (p.kind === 'tokens') emblem(g, 'bolt', 0, 0, 0.42, '#140f26', 4);
  g.restore();
}

// ---------------------------------------------------------------- arcade cabinet

export function arcadeBack(g, x, title = 'RAT RACE', seed = 1) {
  const w = 100;
  blob(g, [['M', x, F + 4], ['L', x, 236], ['L', x + 8, 214], ['L', x + w - 8, 214], ['L', x + w, 236], ['L', x + w, F + 4], ['Z']], { fill: '#2b6cff', shade: '#1d47b0', sdx: 4, sdy: 0, lw: 3, seed });
  rrect(g, x + 6, 218, w - 12, 30, 4, { fill: '#ffd23f', lw: 2.6, seed: seed + 1 });
  text(g, title, x + w / 2, 240, { size: 16, font: FONTS.drip, fill: '#e8456b', lw: 3 });
  rect(g, x + 8, 254, w - 16, 70, { fill: '#0c0a18', lw: 3, amp: 0.3, seed: seed + 2 });
  // control panel
  blob(g, [['M', x - 4, 332], ['L', x + w + 4, 332], ['L', x + w, 352], ['L', x, 352], ['Z']], { fill: '#1d47b0', lw: 3, seed: seed + 3 });
  rrect(g, x + 30, 372, 40, 30, 3, { fill: '#1d47b0', lw: 2.4, seed: seed + 4 });
  dot(g, x + 50, 384, 3, '#ffd23f');
  text(g, '25¢', x + 50, 398, { size: 8, font: FONTS.sign, fill: '#ffd23f', lw: 0 });
}

export function arcadeLive(g, x, t) {
  const w = 100;
  // attract mode: running rat silhouette + scrolling ground
  g.save();
  g.beginPath();
  g.rect(x + 10, 256, w - 20, 66);
  g.clip();
  g.fillStyle = '#1a1440';
  g.fillRect(x + 10, 256, w - 20, 66);
  for (let i = 0; i < 6; i++) {
    const bx = x + 10 + ((i * 30 - t * 60) % 120 + 120) % 120 - 10;
    g.fillStyle = '#2b2a6a';
    g.fillRect(bx, 270, 14, 40);
  }
  g.fillStyle = '#3ec7b0';
  g.fillRect(x + 10, 310, w - 20, 3);
  const hop = Math.abs(Math.sin(t * 4)) * 14;
  g.fillStyle = '#ffd23f';
  g.beginPath();
  g.ellipse(x + 40, 302 - hop, 8, 6, 0, 0, Math.PI * 2);
  g.fill();
  g.fillRect(x + 46, 297 - hop, 6, 4);
  const ox = x + 10 + ((t * 70) % 120);
  g.fillStyle = '#e8456b';
  g.fillRect(x + 110 - (ox - x), 300, 8, 10);
  g.fillStyle = Math.floor(t * 2) % 2 ? '#fffaf0' : rgba('#fffaf0', 0.2);
  g.font = `8px ${FONTS.sign}`;
  g.textAlign = 'center';
  g.fillText('PRESS START', x + w / 2, 268);
  // scanlines
  g.fillStyle = rgba('#000000', 0.25);
  for (let yy = 256; yy < 322; yy += 3) g.fillRect(x + 10, yy, w - 20, 1);
  g.restore();
  // buttons
  dot(g, x + 28, 341, 4, Math.floor(t * 3) % 2 ? '#ff4f9a' : '#a03060');
  dot(g, x + 44, 341, 4, '#3ec7b0');
  stroke(g, [[x + 72, 344], [x + 72 + Math.sin(t * 2) * 4, 334]], { lw: 3, color: '#140f26' });
  dot(g, x + 72 + Math.sin(t * 2) * 4, 333, 4, '#ffd23f');
}

// ---------------------------------------------------------------- vending machine

export function vending(g, x, seed = 1) {
  const w = 96;
  rrect(g, x, 244, w, F - 244 + 4, 5, { fill: '#d4473f', shade: '#a8302a', sdx: 4, sdy: 0, lw: 3, seed });
  rect(g, x + 8, 256, 58, 120, { fill: '#e8f4ff', lw: 2.6, amp: 0.3, seed: seed + 1 });
  const cols = ['#ff8a3d', '#ffd23f', '#3ec7b0', '#ff4f9a', '#7b5cff', '#7ed957'];
  for (let r = 0; r < 4; r++) {
    for (let i = 0; i < 3; i++) rrect(g, x + 13 + i * 17, 264 + r * 28, 13, 20, 2, { fill: cols[(r + i * 2) % 6], lw: 1.6, seed: seed + r * 3 + i });
    stroke(g, [[x + 10, 286 + r * 28], [x + 64, 286 + r * 28]], { lw: 1.6, color: '#8a9ab0' });
  }
  rect(g, x + 72, 262, 16, 40, { fill: '#2a2238', lw: 2, amp: 0.2, seed: seed + 20 });
  for (let r = 0; r < 4; r++) for (let c = 0; c < 2; c++) dot(g, x + 77 + c * 6, 270 + r * 8, 1.6, '#ffd23f');
  rrect(g, x + 10, 386, 54, 22, 3, { fill: '#2a2238', lw: 2.4, seed: seed + 21 });
  text(g, 'SNAX', x + 80, 330, { size: 9, font: FONTS.sign, fill: '#fffaf0', lw: 0, rot: -Math.PI / 2 });
}

// ---------------------------------------------------------------- legal wall

export function legalWall(g, x, w, seed = 1) {
  const top = 150, bot = F;
  // whitewashed concrete panel
  rect(g, x, top, w, bot - top, { fill: '#d8d0c4', lw: 3, amp: 0.8, seed });
  const r = mulberry32(seed);
  for (let i = 0; i < 260; i++) {
    g.fillStyle = r() < 0.5 ? rgba('#000000', 0.06) : rgba('#ffffff', 0.12);
    g.fillRect(x + r() * w, top + r() * (bot - top), 2 + r() * 6, 1 + r() * 3);
  }
  // old layered tags (faded)
  for (let i = 0; i < 9; i++) tag(g, x + 40 + r() * (w - 80), top + 40 + r() * 200, { seed: seed + 100 + i, alpha: 0.35, size: 22 + r() * 18 });
  // pieces
  piece(g, x + w * 0.28, top + 112, 'DRIP', { size: 64, fill: '#ff4f9a', fill2: '#ffd23f', seed: seed + 3, cloudColor: '#7b5cff' });
  throwup(g, x + w * 0.74, top + 92, { word: 'OKAY', fill: '#3ec7b0', size: 46, seed: seed + 4 });
  throwup(g, x + w * 0.62, top + 200, { word: 'RATZ', fill: '#ffd23f', size: 40, seed: seed + 5 });
  // header
  rrect(g, x + w / 2 - 120, top - 30, 240, 34, 4, { fill: '#140f26', lw: 3, seed: seed + 6 });
  text(g, 'LEGAL WALL', x + w / 2, top - 6, { size: 22, font: FONTS.sign, fill: '#7ed957', lw: 0, spacing: 3 });
  // "your tag here" frame (filled live with the player's best)
  rect(g, x + 30, top + 172, 200, 96, { fill: rgba('#ffffff', 0.35), lw: 2.4, amp: 0.6, seed: seed + 7 });
  g.setLineDash([6, 6]);
  g.strokeStyle = rgba('#140f26', 0.5);
  g.lineWidth = 2;
  g.strokeRect(x + 36, top + 178, 188, 84);
  g.setLineDash([]);
  // paint cans + drips at the foot
  drips(g, x + 10, bot - 40, w - 20, '#ff4f9a', seed + 8, { count: 6, maxLen: 20, thick: 3, line: null });
  for (let i = 0; i < 4; i++) {
    const cx = x + w - 130 + i * 22;
    const c = ['#ff4f9a', '#ffd23f', '#3ec7b0', '#7b5cff'][i];
    rrect(g, cx - 7, bot - 26, 14, 26, 4, { fill: c, lw: 2.2, seed: seed + 10 + i });
  }
}

// ---------------------------------------------------------------- doors

export function door(g, x, kind, seed = 1) {
  const w = kind === 'maint' ? 112 : 92;
  const top = 236;
  rect(g, x - 8, top - 10, w + 16, F - top + 12, { fill: '#2a2840', lw: 3, amp: 0.4, seed });
  rect(g, x, top, w, F - top + 2, { fill: kind === 'maint' ? '#5a6a50' : '#6a3a3a', shade: kind === 'maint' ? '#3e4a38' : '#4a2626', sdx: 0, sdy: 5, lw: 3, amp: 0.4, seed: seed + 1 });
  rect(g, x + 10, top + 14, w - 20, 70, { fill: 'none', lw: 2, amp: 0.4, seed: seed + 2 });
  rect(g, x + 10, top + 100, w - 20, 70, { fill: 'none', lw: 2, amp: 0.4, seed: seed + 3 });
  ellipse(g, x + w - 16, top + 96, 5, 5, { fill: '#c8c8e0', lw: 2.2, seed: seed + 4 });
  if (kind === 'maint') {
    // hazard stripes + sign
    g.save();
    g.beginPath();
    g.rect(x - 8, top - 10, w + 16, 14);
    g.clip();
    for (let i = -2; i < 12; i++) {
      g.fillStyle = i % 2 ? '#ffd23f' : '#140f26';
      g.beginPath();
      g.moveTo(x - 8 + i * 14, top - 10); g.lineTo(x + 6 + i * 14, top - 10); g.lineTo(x - 8 + i * 14, top + 4); g.lineTo(x - 22 + i * 14, top + 4);
      g.fill();
    }
    g.restore();
    rrect(g, x + 8, top + 28, w - 16, 40, 3, { fill: '#ffd23f', lw: 2.6, seed: seed + 5 });
    text(g, 'AUTHORIZED', x + w / 2, top + 45, { size: 11, font: FONTS.sign, fill: INK, lw: 0 });
    text(g, 'PERSONNEL ONLY', x + w / 2, top + 60, { size: 8.5, font: FONTS.sign, fill: INK, lw: 0 });
    text(g, 'MAINTENANCE', x + w / 2, top + 132, { size: 10, font: FONTS.sign, fill: rgba('#fffaf0', 0.7), lw: 0 });
    // ladder icon
    stroke(g, [[x + w / 2 - 8, top + 142], [x + w / 2 - 8, top + 166]], { lw: 2, color: rgba('#fffaf0', 0.6) });
    stroke(g, [[x + w / 2 + 8, top + 142], [x + w / 2 + 8, top + 166]], { lw: 2, color: rgba('#fffaf0', 0.6) });
    for (let k = 0; k < 3; k++) stroke(g, [[x + w / 2 - 8, top + 148 + k * 7], [x + w / 2 + 8, top + 148 + k * 7]], { lw: 2, color: rgba('#fffaf0', 0.6) });
  } else {
    rrect(g, x + 10, top + 24, w - 20, 26, 3, { fill: '#f4efe6', lw: 2.4, seed: seed + 5 });
    text(g, 'EMPLOYEES', x + w / 2, top + 36, { size: 9.5, font: FONTS.sign, fill: '#d4473f', lw: 0 });
    text(g, 'ONLY', x + w / 2, top + 47, { size: 9.5, font: FONTS.sign, fill: '#d4473f', lw: 0 });
    // peephole slot
    rrect(g, x + w / 2 - 20, top + 62, 40, 12, 3, { fill: '#2a1414', lw: 2.4, seed: seed + 6 });
    text(g, 'KNOCK', x + w / 2, top + 132, { size: 13, font: FONTS.marker, fill: rgba('#f4efe6', 0.75), lw: 0, rot: -0.08 });
    stickers(g, x + w / 2, top + 160, 4, seed + 7);
  }
}

export function padlock(g, x, w, unlocked) {
  const cx = x + w - 18, cy = 340;
  stroke(g, pathPts([['M', cx - 6, cy], ['C', cx - 6, cy - (unlocked ? 18 : 12), cx + 6, cy - (unlocked ? 18 : 12), cx + 6, cy - (unlocked ? 6 : 0)]]), { lw: 3, color: '#c8c8e0' });
  rrect(g, cx - 9, cy - 2, 18, 16, 3, { fill: unlocked ? '#7ed957' : '#ffd23f', lw: 2.4, seed: 4 });
  dot(g, cx, cy + 6, 2, INK);
}

// ---------------------------------------------------------------- exits + ends

export function exitStairs(g, x, w, pal, seed = 1) {
  const top = 150;
  // opening with night-street glow
  rect(g, x, top, w, F - top + 4, { fill: '#1a1638', lw: 3, amp: 0.4, seed });
  const sky = g.createLinearGradient(0, top, 0, top + 160);
  sky.addColorStop(0, '#ff9a6a');
  sky.addColorStop(0.4, '#7a4aa0');
  sky.addColorStop(1, rgba('#1a1638', 0));
  g.fillStyle = sky;
  g.fillRect(x + 4, top + 4, w - 8, 160);
  // steps going up-left
  const steps = 10;
  for (let i = 0; i < steps; i++) {
    const sx = x + 20 + i * ((w - 40) / steps), sy = F - 12 - (steps - 1 - i) * 0 - i * 0;
    void sx; void sy;
  }
  for (let i = 0; i < steps; i++) {
    const t = i / steps;
    const sx = x + w - 30 - t * (w - 60);
    const sy = F - 6 - t * 220;
    rect(g, sx - 30, sy, 60, 10, { fill: mix('#6a5a8a', '#2a2448', t), lw: 2.4, amp: 0.3, seed: seed + i });
  }
  // handrail
  stroke(g, [[x + w - 20, F - 40], [x + 40, F - 250]], { lw: 5, color: '#c8c8e0', seed: seed + 20 });
  stroke(g, [[x + w - 20, F - 40], [x + 40, F - 250]], { lw: 1.6, seed: seed + 21 });
  // EXIT sign
  rrect(g, x + w / 2 - 50, top - 46, 100, 32, 4, { fill: '#1d6a3a', lw: 3, seed: seed + 22 });
  text(g, 'EXIT ↑', x + w / 2, top - 23, { size: 17, font: FONTS.sign, fill: '#f6f2ea', lw: 0 });
  text(g, 'STREET', x + w / 2, top + 30, { size: 12, font: FONTS.sign, fill: rgba('#ffe0c0', 0.8), lw: 0 });
}

export function tunnelEnd(g, x, side, pal, seed = 1) {
  // the platform ends; dark tunnel mouth beyond a gate
  const dir = side === 'right' ? 1 : -1;
  const x0 = side === 'right' ? x : x - 240;
  g.fillStyle = '#07050f';
  g.fillRect(x0, Y.CEIL - 22, 240, F - Y.CEIL + 30);
  // arch outline
  stroke(g, [[x, F + 8], [x, Y.CEIL - 22]], { lw: 4, color: INK });
  // signal light
  rrect(g, x + dir * 60 - 10, 230, 20, 46, 4, { fill: '#1d1a30', lw: 2.6, seed });
  dot(g, x + dir * 60, 244, 5, '#7ed957');
  dot(g, x + dir * 60, 262, 5, '#3a2020');
  // gate
  for (let i = 0; i < 5; i++) stroke(g, [[x + dir * (8 + i * 10), F + 2], [x + dir * (8 + i * 10), F - 64]], { lw: 3, color: '#c8c8e0' });
  stroke(g, [[x + dir * 4, F - 64], [x + dir * 52, F - 64]], { lw: 4, color: '#c8c8e0' });
  rrect(g, x + dir * 30 - 34, F - 108, 68, 34, 3, { fill: '#d4473f', lw: 2.6, seed: seed + 1 });
  text(g, 'NO ENTRY', x + dir * 30, F - 86, { size: 11, font: FONTS.sign, fill: '#fffaf0', lw: 0 });
}

// ---------------------------------------------------------------- cups table

export function cupsTable(g, x, seed = 1) {
  // cardboard box with three cups on top
  rect(g, x - 44, 378, 88, F - 378 + 4, { fill: '#c89a62', shade: '#a07844', sdx: 0, sdy: 4, lw: 3, amp: 0.6, seed });
  stroke(g, [[x - 44, 392], [x + 44, 392]], { lw: 1.6, color: rgba('#140f26', 0.5) });
  text(g, 'FRAGILE', x, 410, { size: 9, font: FONTS.sign, fill: rgba('#8a2a1a', 0.7), lw: 0, rot: -0.06 });
  for (let i = -1; i <= 1; i++) {
    blob(g, [['M', x + i * 26 - 9, 378], ['L', x + i * 26 - 6, 360], ['L', x + i * 26 + 6, 360], ['L', x + i * 26 + 9, 378], ['Z']], { fill: '#d4473f', lw: 2.4, seed: seed + 2 + i });
  }
  // cardboard sign
  g.save();
  g.translate(x + 64, 372);
  g.rotate(0.08);
  rect(g, -26, -22, 52, 40, { fill: '#c89a62', lw: 2.4, amp: 0.8, seed: seed + 6 });
  text(g, 'FIND', 0, -6, { size: 11, font: FONTS.marker, fill: INK, lw: 0 });
  text(g, 'THE TOKEN', 0, 8, { size: 8, font: FONTS.marker, fill: INK, lw: 0 });
  g.restore();
}

// ---------------------------------------------------------------- cracked tiles

export function crackedTiles(g, x, y, broken) {
  if (broken) {
    rect(g, x - 26, y - 16, 52, 34, { fill: '#0a0716', lw: 3, amp: 1.2, seed: 77 });
    return;
  }
  const pts = [[x - 20, y - 14], [x - 4, y - 2], [x + 2, y - 16], [x + 8, y + 4], [x + 22, y - 6], [x + 6, y + 16], [x - 10, y + 6], [x - 22, y + 14]];
  for (let i = 0; i < pts.length; i++) stroke(g, [[x, y], pts[i]], { lw: 2, color: INK, amp: 0.5, smooth: false, seed: 80 + i });
}

export { poster, POSTERS, stickers };

// ---------------------------------------------------------------- bodega mural (ghost train clue)

export function mural(g, x, w, seed = 1) {
  throwup(g, x + w * 0.2, 250, { word: 'SKUM', fill: '#ff8a3d', size: 54, seed: seed + 1 });
  throwup(g, x + w * 0.52, 214, { word: 'NOVA', fill: '#b48cff', size: 50, seed: seed + 2, rot: 0.05 });
  piece(g, x + w * 0.8, 290, 'BOO', { size: 60, fill: '#9ad8c8', fill2: '#e8fff6', seed: seed + 3, cloudColor: '#3ec7b0' });
  // the clue, scrawled in white
  text(g, 'the last train', x + w * 0.42, 330, { size: 22, font: FONTS.tag, fill: '#f4efe6', lw: 0, rot: -0.05 });
  text(g, 'runs at midnight', x + w * 0.44, 358, { size: 22, font: FONTS.tag, fill: '#f4efe6', lw: 0, rot: -0.05 });
  // little ghost doodle
  blob(g, [['M', x + w * 0.66, 360], ['C', x + w * 0.66 - 4, 326, x + w * 0.66 + 30, 326, x + w * 0.66 + 26, 360], ['L', x + w * 0.66 + 20, 354], ['L', x + w * 0.66 + 13, 360], ['L', x + w * 0.66 + 6, 354], ['Z']], { fill: 'none', lw: 2.6, line: '#f4efe6', seed: seed + 4 });
  dot(g, x + w * 0.66 + 9, 342, 2, '#f4efe6');
  dot(g, x + w * 0.66 + 17, 342, 2, '#f4efe6');
  tag(g, x + 40, 380, { seed: seed + 5, size: 20 });
  tag(g, x + w - 60, 200, { seed: seed + 6, size: 24 });
  stickers(g, x + w * 0.3, 390, 3, seed + 7);
}

// ---------------------------------------------------------------- sewer

export function ladder(g, x, seed = 1) {
  // hole in the vault + ladder up to it
  ellipse(g, x, -10, 46, 16, { fill: '#000000', lw: 3, seed });
  const lg = g.createLinearGradient(0, -30, 0, 120);
  lg.addColorStop(0, rgba('#fff0c0', 0.35));
  lg.addColorStop(1, rgba('#fff0c0', 0));
  g.fillStyle = lg;
  g.beginPath(); g.moveTo(x - 40, -10); g.lineTo(x + 40, -10); g.lineTo(x + 70, 420); g.lineTo(x - 70, 420); g.fill();
  stroke(g, [[x - 20, -8], [x - 20, F + 2]], { lw: 5, color: '#8a8aa0', seed: seed + 1 });
  stroke(g, [[x + 20, -8], [x + 20, F + 2]], { lw: 5, color: '#8a8aa0', seed: seed + 2 });
  for (let yy = 10; yy < F; yy += 26) stroke(g, [[x - 20, yy], [x + 20, yy]], { lw: 4, color: '#6a6a80', seed: seed + yy });
  text(g, '↑ BODEGA BLVD', x + 30, 120, { size: 11, font: FONTS.sign, fill: rgba('#e8ffe0', 0.7), lw: 0, align: 'left' });
}

export function sewerPipe(g, x, seed = 1) {
  ellipse(g, x, 240, 42, 42, { fill: '#3a4a40', shade: '#26342c', sdx: 4, sdy: 4, lw: 3.4, seed });
  ellipse(g, x, 240, 30, 30, { fill: '#08100c', lw: 2.6, seed: seed + 1 });
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    dot(g, x + Math.cos(a) * 36, 240 + Math.sin(a) * 36, 2, rgba('#ffffff', 0.18));
  }
  drips(g, x - 30, 268, 60, '#5aa060', seed + 2, { count: 4, maxLen: 30, thick: 3 });
}

export function wallEnd(g, x) {
  g.fillStyle = '#081008';
  g.fillRect(x, -400, 400, 1500);
  stroke(g, [[x, -400], [x, F + 40]], { lw: 4, color: INK });
}

export function stallBack(g, x, w, seed = 1) {
  // a market stall made of crates, a stolen bench, a tarp roof and stolen bulbs
  const top = 200;
  // tarp roof
  blob(g, [['M', x - 20, top], ['L', x + w + 20, top - 10], ['L', x + w + 40, top + 40], ['C', x + w * 0.66, top + 26, x + w * 0.33, top + 50, x - 30, top + 34], ['Z']], { fill: '#2e6a7a', shade: '#1e4a58', sdx: 0, sdy: 6, lw: 3, seed });
  stroke(g, [[x, top + 30], [x, F]], { lw: 6, color: '#6a4a2a', seed: seed + 1 });
  stroke(g, [[x + w, top + 28], [x + w, F]], { lw: 6, color: '#6a4a2a', seed: seed + 2 });
  // back wall of goods: TV, gold, shelves of loot
  rect(g, x + 20, top + 50, w - 40, F - top - 50, { fill: '#1a2a20', lw: 0, amp: 0, seed: seed + 3 });
  rrect(g, x + w - 130, top + 60, 100, 76, 6, { fill: '#3a3a4a', lw: 3, seed: seed + 4 });
  rect(g, x + w - 120, top + 68, 74, 56, { fill: '#202830', lw: 2.4, amp: 0.2, seed: seed + 5 });
  for (let i = 0; i < 3; i++) {
    const ry = top + 90 + i * 46;
    rrect(g, x + 30, ry, w - 190, 7, 2, { fill: '#7a5a3a', lw: 2.4, seed: seed + 10 + i });
    for (let k = 0; k < 5; k++) {
      const c = ['#ffd23f', '#7ed957', '#ff4f9a', '#3ec7b0', '#ffd23f'][(k + i) % 5];
      ellipse(g, x + 52 + k * ((w - 230) / 4), ry - 9, 8, 8, { fill: c, lw: 2, seed: seed + 20 + i * 5 + k });
    }
  }
  // sign
  rrect(g, x + w / 2 - 110, top - 64, 220, 46, 6, { fill: '#140f26', lw: 3, seed: seed + 30 });
  text(g, "BIG AL'S", x + w / 2, top - 30, { size: 30, font: FONTS.drip, fill: '#7ed957', lw: 3 });
}

export function stallLive(g, x, w, t) {
  const top = 200;
  // TV static
  g.save();
  g.beginPath();
  g.rect(x + w - 120, top + 68, 74, 56);
  g.clip();
  for (let i = 0; i < 60; i++) {
    g.fillStyle = Math.random() < 0.5 ? rgba('#ffffff', 0.5) : rgba('#7ed957', 0.35);
    g.fillRect(x + w - 120 + Math.random() * 74, top + 68 + Math.random() * 56, 3, 2);
  }
  g.restore();
  // string lights
  const n = 12;
  for (let i = 0; i <= n; i++) {
    const lx = x + (w / n) * i;
    const ly = top + 34 + Math.sin((i / n) * Math.PI) * 18;
    const on = (Math.floor(t * 3) + i) % 4 !== 0;
    dot(g, lx, ly, 4, on ? ['#ffd23f', '#7ed957', '#ff4f9a'][i % 3] : '#2a2a2a');
    if (on) {
      g.save();
      g.globalCompositeOperation = 'lighter';
      dot(g, lx, ly, 10, rgba(['#ffd23f', '#7ed957', '#ff4f9a'][i % 3], 0.18));
      g.restore();
    }
  }
}

export function stallFront(g, x, w, seed = 1) {
  // crate counter
  for (let i = 0; i < 3; i++) {
    const cx = x + 30 + i * ((w - 60) / 3);
    const cw = (w - 60) / 3 - 6;
    rect(g, cx, 370, cw, F - 370 + 4, { fill: '#a07a4a', shade: '#7a5a34', sdx: 0, sdy: 4, lw: 3, amp: 0.5, seed: seed + i });
    stroke(g, [[cx + 4, 382], [cx + cw - 4, 382]], { lw: 2, color: rgba('#140f26', 0.5) });
    stroke(g, [[cx + 4, 404], [cx + cw - 4, 404]], { lw: 2, color: rgba('#140f26', 0.5) });
    text(g, ['FRAGILE', 'GOLD', 'DO NOT OPEN'][i], cx + cw / 2, 397, { size: 9, font: FONTS.sign, fill: rgba('#3a1a0a', 0.7), lw: 0 });
  }
  rrect(g, x + 20, 362, w - 40, 12, 3, { fill: '#c8a070', lw: 3, seed: seed + 9 });
  // gold pile on the counter
  for (let i = 0; i < 7; i++) ellipse(g, x + w * 0.66 + (i % 4) * 12, 356 - Math.floor(i / 4) * 8, 7, 4, { fill: '#ffd23f', lw: 2, seed: seed + 20 + i });
}

// ---------------------------------------------------------------- ghost station

export function ticketBack(g, x, w, seed = 1) {
  // ornate brass-and-wood ticket office, 1904
  const top = 200;
  blob(g, [['M', x, top + 30], ['Q', x + w / 2, top - 30, x + w, top + 30], ['L', x + w, top + 44], ['L', x, top + 44], ['Z']], { fill: '#6a4a2a', shade: '#4a3018', sdx: 0, sdy: 4, lw: 3, seed });
  text(g, 'LOST & FOUND', x + w / 2, top + 30, { size: 18, font: FONTS.sign, fill: '#ffd98a', lw: 0, spacing: 2 });
  rect(g, x + 10, top + 44, w - 20, F - top - 44, { fill: '#203a3e', lw: 3, amp: 0.3, seed: seed + 1 });
  // shelves of lost things
  for (let i = 0; i < 2; i++) {
    const ry = top + 110 + i * 54;
    rrect(g, x + 24, ry, w - 48, 6, 2, { fill: '#8a6a3a', lw: 2.4, seed: seed + 2 + i });
    for (let k = 0; k < 6; k++) {
      const kx = x + 44 + k * ((w - 88) / 5);
      if ((k + i) % 3 === 0) rrect(g, kx - 10, ry - 22, 20, 22, 3, { fill: '#7a5a3a', lw: 2, seed: seed + 10 + k });
      else if ((k + i) % 3 === 1) ellipse(g, kx, ry - 10, 10, 10, { fill: rgba('#bff8ec', 0.6), lw: 2, seed: seed + 20 + k });
      else blob(g, [['M', kx - 12, ry], ['C', kx - 12, ry - 26, kx + 12, ry - 26, kx + 12, ry], ['Z']], { fill: '#2a2238', lw: 2, seed: seed + 30 + k });
    }
  }
  // brass columns
  for (const cx of [x + 6, x + w - 6]) rect(g, cx - 8, top + 30, 16, F - top - 26, { fill: '#c8a050', shade: '#8a6a2a', sdx: 3, sdy: 0, lw: 3, amp: 0.3, seed: seed + cx });
}

export function ticketFront(g, x, w, seed = 1) {
  rect(g, x + 14, 366, w - 28, F - 366 + 4, { fill: '#5a3a1e', shade: '#3a2410', sdx: 0, sdy: 5, lw: 3, amp: 0.4, seed });
  for (let i = 0; i < 4; i++) rect(g, x + 30 + i * ((w - 60) / 4), 378, (w - 60) / 4 - 10, 34, { fill: 'none', lw: 2, line: '#c8a050', amp: 0.3, seed: seed + 1 + i });
  rrect(g, x + 6, 358, w - 12, 12, 3, { fill: '#c8a050', lw: 3, seed: seed + 9 });
  // lantern on the counter
  rrect(g, x + w - 70, 326, 22, 32, 5, { fill: rgba('#bff8ec', 0.7), lw: 2.4, seed: seed + 10 });
  rrect(g, x + w - 72, 322, 26, 6, 2, { fill: '#3a3456', lw: 2, seed: seed + 11 });
}

export function bellPost(g, x, seed = 1) {
  rect(g, x - 5, 260, 10, F - 260 + 4, { fill: '#c8a050', lw: 3, amp: 0.3, seed });
  blob(g, [['M', x - 18, 262], ['C', x - 18, 228, x + 18, 228, x + 18, 262], ['L', x + 22, 266], ['L', x - 22, 266], ['Z']], { fill: '#d8b050', shade: '#a07a2a', sdx: 3, sdy: 2, lw: 3, seed: seed + 1 });
  rrect(g, x - 34, 300, 68, 30, 3, { fill: '#203a3e', lw: 2.4, seed: seed + 2 });
  text(g, 'RING FOR', x, 313, { size: 8, font: FONTS.sign, fill: '#e8fff6', lw: 0 });
  text(g, 'LAST TRAIN', x, 324, { size: 8, font: FONTS.sign, fill: '#e8fff6', lw: 0 });
}
