// The cast. Every critter is drawn live with the ink renderer, facing right,
// feet at (0,0), roughly 95 units tall for a rat. `p` carries pose state:
//   { t, walk (0..1 phase or null), facing, boil, blink, talk, look, pose, scale }
import {
  INK, shape, ellipse, rrect, blob, stroke, tube, dot, text, FONTS,
  pathPts, ellipsePts, shade, tint, mix, rgba, mulberry32,
} from '../ink.js';

const PINK = '#ff8fb8';
const PINK_D = '#e0679a';
const EYE_W = '#fffaf0';
const LID = 0.36;

// Boil: switch the wobble seed a few times a second so lines "live".
export function boilSeed(base, t, fps = 7, variants = 3) {
  return base * 13 + (Math.floor(t * fps) % variants) * 101;
}

// ---------------------------------------------------------------- shared parts

function eye(ctx, x, y, rx, ry, o) {
  const { lidColor, look = 0, blink = 0, seed, lid = LID, pupil = INK, bag = true, glint = true } = o;
  if (bag) stroke(ctx, [[x - rx * 0.9, y + ry * 0.95], [x, y + ry * 1.35], [x + rx * 0.8, y + ry * 0.9]], { lw: 1.6, color: rgba('#3a2a66', 0.75), amp: 0.2, seed });
  const closed = blink > 0.5;
  if (closed) {
    stroke(ctx, [[x - rx, y + 1], [x, y + ry * 0.35], [x + rx, y]], { lw: 2.6, seed });
    return;
  }
  shape(ctx, ellipsePts(x, y, rx, ry), { fill: EYE_W, lw: 2.4, amp: 0.25, seed });
  dot(ctx, x + rx * 0.25 + look * rx * 0.3, y + ry * 0.12, Math.min(rx, ry) * 0.5, pupil);
  if (glint) dot(ctx, x + rx * 0.05 + look * rx * 0.3, y - ry * 0.12, Math.min(rx, ry) * 0.16, '#ffffff');
  if (lid > 0) {
    // heavy lid: the "seen it all" subway look
    const ly = y - ry + ry * 2 * lid;
    shape(ctx, [[x - rx * 1.25, y - ry * 1.4], [x + rx * 1.25, y - ry * 1.4], [x + rx * 1.15, ly], [x, ly + ry * 0.12], [x - rx * 1.15, ly]], {
      fill: lidColor, lw: 0, amp: 0, smooth: true,
    });
    stroke(ctx, [[x - rx * 1.05, ly + 0.5], [x, ly + ry * 0.14], [x + rx * 1.05, ly]], { lw: 2.4, seed: seed + 3, amp: 0.2 });
  }
}

function shoe(ctx, x, y, o) {
  const { color = '#f4efe6', sole = '#e8456b', seed, len = 17, h = 8.5 } = o;
  blob(ctx, [
    ['M', x - len * 0.42, y],
    ['L', x + len * 0.62, y],
    ['C', x + len * 0.75, y - h * 0.2, x + len * 0.7, y - h * 0.85, x + len * 0.25, y - h * 0.95],
    ['C', x + len * 0.05, y - h * 1.3, x - len * 0.35, y - h * 1.25, x - len * 0.42, y - h * 0.8],
    ['Z'],
  ], { fill: color, shade: shade(color, 0.22), sdx: 1.5, sdy: 1.5, lw: 2.4, amp: 0.35, seed });
  stroke(ctx, [[x - len * 0.4, y - 2.2], [x + len * 0.62, y - 2.2]], { color: sole, lw: 2.2, amp: 0.2, seed: seed + 1 });
}

function whiskers(ctx, x, y, dir, seed, color = INK) {
  for (let i = 0; i < 3; i++) {
    const a = -0.32 + i * 0.3;
    stroke(ctx, [[x, y + i * 1.4], [x + Math.cos(a) * 15 * dir, y + i * 1.4 + Math.sin(a) * 15]], { lw: 1.3, color, amp: 0.4, seed: seed + i });
  }
}

// ---------------------------------------------------------------- hats

export const HATS = ['none', 'beanie', 'cap', 'bucket', 'fedora'];

function hat(ctx, kind, color, seed, o = {}) {
  const band = o.band || shade(color, 0.35);
  if (kind === 'beanie') {
    blob(ctx, [
      ['M', -15, -73],
      ['C', -18, -88, -6, -98, 6, -97],
      ['C', 18, -96, 24, -86, 22, -74],
      ['Z'],
    ], { fill: color, shade: shade(color, 0.25), sdx: 2, sdy: 2, lw: 3, seed });
    for (let i = -10; i <= 18; i += 5) stroke(ctx, [[i, -91 + Math.abs(i - 4) * 0.12], [i + 0.5, -78]], { lw: 1.2, color: rgba('#1a1236', 0.35), amp: 0.3, seed: seed + i });
    rrect(ctx, -17, -79, 41, 9, 4, { fill: band, lw: 3, seed: seed + 2 });
    ellipse(ctx, 5, -99, 5.5, 5, { fill: tint(color, 0.25), lw: 2.6, seed: seed + 4 });
  } else if (kind === 'cap') {
    blob(ctx, [
      ['M', -14, -73],
      ['C', -16, -88, -4, -95, 6, -94],
      ['C', 17, -93, 22, -84, 21, -74],
      ['Z'],
    ], { fill: color, shade: shade(color, 0.25), sdx: 2, sdy: 2, lw: 3, seed });
    blob(ctx, [
      ['M', 14, -77],
      ['C', 24, -80, 36, -78, 40, -74],
      ['C', 36, -71, 24, -71, 14, -72],
      ['Z'],
    ], { fill: band, lw: 3, seed: seed + 1 });
    dot(ctx, 5, -94, 2.2, band);
  } else if (kind === 'bucket') {
    blob(ctx, [
      ['M', -12, -76],
      ['C', -13, -90, -2, -95, 5, -95],
      ['C', 13, -95, 21, -90, 20, -76],
      ['Z'],
    ], { fill: color, shade: shade(color, 0.25), sdx: 2, sdy: 2, lw: 3, seed });
    blob(ctx, [
      ['M', -21, -70],
      ['C', -14, -79, 24, -79, 30, -71],
      ['C', 22, -73, -12, -73, -21, -70],
      ['Z'],
    ], { fill: band, lw: 3, seed: seed + 1 });
  } else if (kind === 'fedora') {
    blob(ctx, [
      ['M', -25, -74],
      ['C', -14, -81, 22, -82, 35, -75],
      ['C', 24, -71, -14, -70, -25, -74],
      ['Z'],
    ], { fill: shade(color, 0.12), lw: 3, seed: seed + 1 });
    blob(ctx, [
      ['M', -12, -77],
      ['C', -13, -90, -6, -97, 4, -95],
      ['C', 8, -92, 10, -96, 14, -96],
      ['C', 22, -94, 23, -86, 22, -77],
      ['Z'],
    ], { fill: color, shade: shade(color, 0.22), sdx: 2, sdy: 2, lw: 3, seed });
    rrect(ctx, -12.5, -82, 35, 5.5, 2, { fill: band, lw: 2.4, seed: seed + 2 });
  }
}

// ---------------------------------------------------------------- the rat

export const RAT_FUR = {
  lavender: '#b8b0d8',
  slate: '#8a86a8',
  cocoa: '#a77d62',
  snow: '#ece6f2',
  midnight: '#56507a',
  sand: '#d9bc8f',
};

export const HOODIES = ['#2a2238', '#e8456b', '#3ec7b0', '#ffc93d', '#7b5cff', '#ff8a3d', '#5aa0ff', '#7ed957', '#f4efe6'];

export const DEFAULT_LOOK = { fur: 'lavender', hoodie: '#e8456b', hat: 'beanie', hatColor: '#3ec7b0', shoe: '#f4efe6' };

// opts: { look, t, walk, boil, blink, talk, pose, carry, look: eye look }
export function drawRat(ctx, x, y, p = {}) {
  const look = p.look || DEFAULT_LOOK;
  const fur = RAT_FUR[look.fur] || look.fur || RAT_FUR.lavender;
  const furD = shade(fur, 0.3);
  const hoodie = look.hoodie || '#e8456b';
  const t = p.t || 0;
  const sd = p.boil ?? 11;
  const facing = p.facing || 1;
  const sc = p.scale || 1;
  const pose = p.pose || (p.walk != null ? 'walk' : 'idle');
  const ph = p.walk ?? 0;
  const sw = Math.sin(ph * Math.PI * 2);
  const run = p.run ? 1.35 : 1;

  let bob = 0, legA = 0, legB = 0, armA = 0, armB = 0, lean = 0;
  if (pose === 'walk') {
    bob = -Math.abs(Math.sin(ph * Math.PI * 2)) * 3 * run;
    legA = sw * 0.62 * run;
    legB = -sw * 0.62 * run;
    armA = -sw * 0.7;
    armB = sw * 0.7;
    lean = 0.05 * run;
  } else if (pose === 'jump') {
    legA = 0.5; legB = -0.35; armA = -1.9; armB = -1.5; lean = 0.03;
  } else if (pose === 'fall') {
    legA = -0.25; legB = 0.4; armA = -2.4; armB = -2.1;
  } else if (pose === 'cheer') {
    bob = -Math.abs(Math.sin(t * 9)) * 6;
    armA = -2.6; armB = -2.5;
  } else {
    bob = Math.sin(t * 2.2) * 0.9;
  }

  ctx.save();
  ctx.translate(x, y);
  ctx.scale(facing * sc, sc);

  // shadow
  if (!p.noShadow) {
    ctx.fillStyle = 'rgba(10,6,24,0.35)';
    ctx.beginPath();
    ctx.ellipse(2, 0, 24, 4.5, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.translate(0, bob);
  ctx.rotate(lean);

  // tail
  const tw = Math.sin(t * 3.1) * 5 + (pose === 'walk' ? sw * 4 : 0);
  tube(ctx, pathPts([
    ['M', -12, -22],
    ['C', -28, -16, -34, -6 + tw * 0.3, -44, -10 + tw * 0.4],
    ['C', -54, -14, -58, -26 + tw, -52, -34 + tw],
  ], 6), PINK, 4.2, { lw: 2.6, seed: sd + 1 });

  // far leg + shoe
  const leg = (ang, near) => {
    const hx = near ? 5 : -4, hy = -19;
    const fx = hx + Math.sin(ang) * 15, fy = hy + Math.cos(ang) * 15 - (pose === 'walk' && ang < -0.1 ? Math.sin(-ang) * 2 : 0);
    tube(ctx, [[hx, hy], [fx, fy]], near ? fur : furD, 6, { lw: 2.6, seed: sd + (near ? 30 : 20) });
    shoe(ctx, fx + 3, Math.min(0, fy + 5), { color: near ? look.shoe || '#f4efe6' : shade(look.shoe || '#f4efe6', 0.18), seed: sd + (near ? 31 : 21) });
  };
  leg(legB, false);

  // far arm
  const arm = (ang, near) => {
    const sx = near ? 3 : -5, sy = -44;
    const ex = sx + Math.sin(ang) * 10, ey = sy + Math.cos(ang) * 10;
    const hx = ex + Math.sin(ang * 1.15 + 0.35) * 10, hy = ey + Math.cos(ang * 1.15 + 0.35) * 10;
    tube(ctx, [[sx, sy], [ex, ey], [hx, hy]], near ? hoodie : shade(hoodie, 0.28), 8, { lw: 2.6, seed: sd + (near ? 50 : 40) });
    ellipse(ctx, hx + 1, hy + 2, 4.2, 4, { fill: near ? fur : furD, lw: 2.4, seed: sd + (near ? 51 : 41) });
  };
  if (!p.pocket) arm(armB, false);

  // near leg
  leg(legA, true);

  // body (hoodie)
  blob(ctx, [
    ['M', -13, -46],
    ['C', -17, -38, -17, -25, -15, -15],
    ['C', -6, -13, 7, -13, 15, -15],
    ['C', 17, -25, 15, -38, 10, -47],
    ['C', 4, -51, -8, -51, -13, -46],
    ['Z'],
  ], { fill: hoodie, shade: shade(hoodie, 0.3), sdx: 3, sdy: 2.5, lw: 3, seed: sd + 2 });
  // pocket + strings
  stroke(ctx, [[-7, -24], [-5, -31], [8, -31], [10, -24]], { lw: 2, color: rgba('#140f26', 0.7), seed: sd + 3 });
  stroke(ctx, [[3, -47], [2, -39]], { lw: 1.6, color: '#fff6e6', seed: sd + 4 });
  stroke(ctx, [[7, -47], [7.5, -40]], { lw: 1.6, color: '#fff6e6', seed: sd + 5 });
  if (look.graphic) dot(ctx, 2, -36, 3.2, look.graphic);
  // hood bunched behind the neck
  ellipse(ctx, -11, -48, 9, 6.5, { fill: shade(hoodie, 0.12), lw: 3, seed: sd + 6, rot: -0.3 });

  // head
  const hb = pose === 'walk' ? Math.sin(ph * Math.PI * 4 + 0.6) * 0.8 : 0;
  ctx.save();
  ctx.translate(0, hb);
  // far ear
  ellipse(ctx, 6, -85, 10, 10.5, { fill: furD, lw: 3, seed: sd + 7 });
  ellipse(ctx, 6.5, -84.5, 5.5, 6, { fill: PINK_D, lw: 0, seed: sd + 8 });
  blob(ctx, [
    ['M', -13, -58],
    ['C', -18, -66, -16, -80, -4, -83],
    ['C', 6, -86, 14, -80, 20, -74],
    ['C', 26, -70, 31, -67, 33, -64],
    ['C', 34.5, -60, 30, -57, 25, -56],
    ['C', 16, -53, 4, -51, -4, -52],
    ['C', -9, -53, -12, -55, -13, -58],
    ['Z'],
  ], { fill: fur, shade: shade(fur, 0.22), sdx: 2.5, sdy: 3, lw: 3, seed: sd + 9 });
  // muzzle tint
  ellipse(ctx, 20, -61, 9, 5, { fill: tint(fur, 0.35), lw: 0, amp: 0.3, seed: sd + 10, rot: 0.2 });
  // near ear
  ellipse(ctx, -6, -81, 12, 12.5, { fill: fur, lw: 3, seed: sd + 11 });
  ellipse(ctx, -5.5, -80.5, 7, 7.5, { fill: PINK, lw: 0, seed: sd + 12 });
  // eye
  eye(ctx, 13, -70, 5.2, 6.2, { lidColor: fur, blink: p.blink || 0, look: p.lookDir || 0, seed: sd + 13, lid: p.lid ?? LID });
  // nose
  ellipse(ctx, 32.5, -63.5, 4.3, 3.9, { fill: PINK, lw: 2.4, seed: sd + 14 });
  dot(ctx, 31.5, -65, 1.2, '#ffffff');
  // teeth + mouth
  const mouth = p.talk ? Math.max(0, Math.sin(t * 22)) * 3 : 0;
  if (mouth > 0.4) ellipse(ctx, 22, -55.5 + mouth * 0.3, 4, 1.4 + mouth * 0.6, { fill: '#5a1a3a', lw: 2, seed: sd + 15 });
  rrect(ctx, 23.5, -56.5 + mouth * 0.4, 3.2, 4, 0.8, { fill: '#fffaf0', lw: 1.6, amp: 0.1, seed: sd + 16 });
  stroke(ctx, [[25, -56], [18, -55.2]], { lw: 1.6, seed: sd + 17 });
  whiskers(ctx, 27, -61, 1, sd + 18);
  // hat
  if (look.hat && look.hat !== 'none') hat(ctx, look.hat, look.hatColor || '#3ec7b0', sd + 19);
  ctx.restore();

  // near arm
  if (!p.pocket) arm(armA, true);

  ctx.restore();
}

// ---------------------------------------------------------------- shopkeepers + NPCs
// Shopkeepers are drawn standing; behind a counter only the top shows.

export function drawPigeon(ctx, x, y, p = {}) {
  // Coco Coo — runway pigeon, beret + silk scarf + shades pushed up.
  const t = p.t || 0, sd = p.boil ?? 21;
  const bob = Math.sin(t * 2.4) * 1.2;
  const peck = p.talk ? Math.sin(t * 9) * 1.5 : 0;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale((p.facing || 1) * (p.scale || 1), p.scale || 1);
  ctx.translate(0, bob);
  // legs
  stroke(ctx, [[-4, -14], [-6, 0]], { lw: 3.2, color: '#ff8a5c', seed: sd });
  stroke(ctx, [[5, -14], [6, 0]], { lw: 3.2, color: '#ff8a5c', seed: sd + 1 });
  stroke(ctx, [[-11, 0], [0, 0]], { lw: 3, color: '#ff8a5c', seed: sd + 2 });
  stroke(ctx, [[1, 0], [12, 0]], { lw: 3, color: '#ff8a5c', seed: sd + 3 });
  // tail feathers
  blob(ctx, [['M', -18, -30], ['L', -40, -16], ['L', -36, -10], ['L', -14, -18], ['Z']], { fill: '#5d6b8f', lw: 3, seed: sd + 4 });
  // body
  blob(ctx, [
    ['M', -20, -34],
    ['C', -24, -16, -6, -10, 8, -12],
    ['C', 20, -14, 24, -28, 20, -44],
    ['C', 16, -58, -14, -56, -20, -34],
    ['Z'],
  ], { fill: '#8d9bc0', shade: '#6a779e', sdx: 3, sdy: 3, lw: 3, seed: sd + 5 });
  // wing
  blob(ctx, [['M', -16, -40], ['C', -20, -28, -10, -18, 6, -22], ['C', -2, -28, -4, -38, -16, -40], ['Z']], { fill: '#6f7da4', lw: 2.6, seed: sd + 6 });
  stroke(ctx, [[-12, -32], [-2, -26]], { lw: 1.6, color: rgba('#140f26', 0.6), seed: sd + 7 });
  // iridescent neck
  blob(ctx, [['M', -2, -54], ['C', 10, -60, 20, -54, 20, -44], ['C', 12, -40, 2, -42, -6, -46], ['Z']], { fill: '#4fae93', lw: 0, seed: sd + 8 });
  blob(ctx, [['M', 0, -50], ['C', 8, -54, 16, -50, 18, -44], ['C', 10, -42, 4, -44, 0, -50], ['Z']], { fill: '#9a5cc9', lw: 0, alpha: 0.7, seed: sd + 9 });
  // scarf
  blob(ctx, [['M', -6, -48], ['C', 4, -42, 16, -42, 22, -47], ['L', 23, -42], ['C', 14, -36, 0, -37, -7, -43], ['Z']], { fill: '#ff4f9a', lw: 2.6, seed: sd + 10 });
  blob(ctx, [['M', 14, -41], ['L', 20, -26], ['L', 13, -27], ['L', 10, -40], ['Z']], { fill: '#ff4f9a', shade: '#c93276', sdx: 1.5, sdy: 1.5, lw: 2.6, seed: sd + 11 });
  // head
  ctx.save();
  ctx.translate(peck * 0.5, peck * 0.3);
  ellipse(ctx, 8, -64, 13, 12, { fill: '#8d9bc0', shade: '#6a779e', sdx: 2, sdy: 2, lw: 3, seed: sd + 12 });
  // beak
  blob(ctx, [['M', 18, -66], ['L', 30, -62], ['L', 18, -59], ['Z']], { fill: '#3a3550', lw: 2.4, seed: sd + 13 });
  ellipse(ctx, 18.5, -66.5, 3, 2, { fill: '#f4efe6', lw: 1.6, seed: sd + 14 });
  // eye
  ellipse(ctx, 11, -67, 4.4, 4.6, { fill: '#ff9a3c', lw: 2.2, seed: sd + 15 });
  dot(ctx, 12, -67, 1.8, INK);
  stroke(ctx, [[6, -71.5], [15, -71]], { lw: 2.6, seed: sd + 16 });
  // beret
  blob(ctx, [['M', -6, -72], ['C', -6, -84, 16, -86, 24, -76], ['C', 18, -72, 4, -70, -6, -72], ['Z']], { fill: '#2a2238', shade: '#1a1430', lw: 3, seed: sd + 17 });
  stroke(ctx, [[10, -82], [11, -88]], { lw: 2.6, seed: sd + 18 });
  // shades on head
  rrect(ctx, -2, -77, 9, 5, 2, { fill: '#ff4f9a', lw: 2, seed: sd + 19 });
  rrect(ctx, 9, -78, 9, 5, 2, { fill: '#ff4f9a', lw: 2, seed: sd + 20 });
  ctx.restore();
  ctx.restore();
}

export function drawBigCheese(ctx, x, y, p = {}) {
  // Big Cheese — a heavyweight rat, gold chains, backwards snapback, toothpick.
  const t = p.t || 0, sd = p.boil ?? 31;
  const bob = Math.sin(t * 1.8) * 1.2;
  const fur = '#9c93bf';
  ctx.save();
  ctx.translate(x, y);
  ctx.scale((p.facing || 1) * (p.scale || 1), p.scale || 1);
  ctx.translate(0, bob);
  tube(ctx, pathPts([['M', -22, -24], ['C', -40, -20, -48, -6, -60, -14], ['C', -66, -20, -64, -30, -58, -34]]), PINK, 5, { lw: 2.6, seed: sd });
  tube(ctx, [[-8, -18], [-10, -2]], shade(fur, 0.3), 8, { lw: 2.6, seed: sd + 1 });
  tube(ctx, [[8, -18], [9, -2]], fur, 8, { lw: 2.6, seed: sd + 2 });
  shoe(ctx, -7, 0, { color: '#ffc93d', sole: '#2a2238', seed: sd + 3, len: 19 });
  shoe(ctx, 12, 0, { color: '#ffc93d', sole: '#2a2238', seed: sd + 4, len: 19 });
  // big body in a tracksuit
  blob(ctx, [
    ['M', -22, -50],
    ['C', -32, -40, -30, -20, -22, -14],
    ['C', -8, -10, 12, -10, 24, -14],
    ['C', 32, -22, 30, -42, 20, -54],
    ['C', 10, -60, -12, -60, -22, -50],
    ['Z'],
  ], { fill: '#2b6cff', shade: '#1d47b0', sdx: 3, sdy: 3, lw: 3, seed: sd + 5 });
  stroke(ctx, [[-20, -48], [-24, -16]], { lw: 3, color: '#f4efe6', seed: sd + 6 });
  stroke(ctx, [[2, -56], [2, -14]], { lw: 2, color: rgba('#140f26', 0.6), seed: sd + 7 });
  // gold chains
  stroke(ctx, pathPts([['M', -10, -56], ['Q', 2, -34, 14, -56]]), { lw: 3.4, color: '#ffd23f', seed: sd + 8 });
  stroke(ctx, pathPts([['M', -14, -55], ['Q', 2, -24, 18, -55]]), { lw: 3.4, color: '#ffd23f', seed: sd + 9 });
  ellipse(ctx, 2, -30, 6.5, 6.5, { fill: '#ffd23f', shade: '#d49a12', sdx: 1.5, sdy: 1.5, lw: 2.4, seed: sd + 10 });
  text(ctx, '$', 2, -26.5, { size: 9, font: FONTS.sign, fill: INK, lw: 0 });
  // arms crossed-ish
  tube(ctx, [[-18, -46], [-6, -34], [12, -38]], '#2b6cff', 10, { lw: 2.6, seed: sd + 11 });
  ellipse(ctx, 14, -38, 5, 5, { fill: fur, lw: 2.4, seed: sd + 12 });
  // head
  ellipse(ctx, 6, -88, 11, 11.5, { fill: shade(fur, 0.3), lw: 3, seed: sd + 13 });
  blob(ctx, [
    ['M', -16, -60],
    ['C', -22, -70, -18, -86, -4, -88],
    ['C', 8, -90, 16, -84, 22, -78],
    ['C', 28, -74, 33, -71, 35, -67],
    ['C', 36, -62, 32, -59, 26, -58],
    ['C', 16, -54, 2, -52, -6, -54],
    ['C', -12, -55, -15, -57, -16, -60],
    ['Z'],
  ], { fill: fur, shade: shade(fur, 0.22), sdx: 2.5, sdy: 3, lw: 3, seed: sd + 14 });
  ellipse(ctx, -8, -86, 12.5, 13, { fill: fur, lw: 3, seed: sd + 15 });
  ellipse(ctx, -7.5, -85.5, 7.5, 8, { fill: PINK, lw: 0, seed: sd + 16 });
  eye(ctx, 13, -73, 5, 5.6, { lidColor: fur, blink: p.blink || 0, seed: sd + 17, lid: 0.45 });
  ellipse(ctx, 34.5, -66, 4.6, 4.2, { fill: PINK, lw: 2.4, seed: sd + 18 });
  stroke(ctx, [[27, -58], [19, -57]], { lw: 1.6, seed: sd + 19 });
  stroke(ctx, [[22, -57], [34, -52]], { lw: 2, color: '#e8c38a', seed: sd + 20 });
  rrect(ctx, 26, -59, 3.2, 4.2, 0.8, { fill: '#ffd23f', lw: 1.6, amp: 0.1, seed: sd + 21 });
  whiskers(ctx, 29, -63, 1, sd + 22);
  // backwards snapback
  blob(ctx, [['M', -14, -80], ['C', -14, -96, 14, -100, 22, -82], ['Z']], { fill: '#ffd23f', shade: '#d49a12', sdx: 2, sdy: 2, lw: 3, seed: sd + 23 });
  blob(ctx, [['M', -12, -82], ['C', -20, -84, -28, -82, -32, -78], ['C', -26, -76, -18, -77, -10, -79], ['Z']], { fill: '#2a2238', lw: 3, seed: sd + 24 });
  ctx.restore();
}

export function drawRoach(ctx, x, y, p = {}) {
  // Roachie — six legs, six sneakers, zero regrets.
  const t = p.t || 0, sd = p.boil ?? 41;
  const bob = Math.sin(t * 3) * 1;
  const shell = '#8a4b2a';
  ctx.save();
  ctx.translate(x, y);
  ctx.scale((p.facing || 1) * (p.scale || 1), p.scale || 1);
  ctx.translate(0, bob);
  const kicks = ['#ff4f9a', '#3ec7b0', '#ffd23f', '#7b5cff', '#ff8a3d', '#f4efe6'];
  // legs + sneakers: two standing, four waving
  tube(ctx, [[-6, -20], [-9, -4]], '#5a2e18', 4.5, { lw: 2.4, seed: sd });
  tube(ctx, [[6, -20], [8, -4]], '#5a2e18', 4.5, { lw: 2.4, seed: sd + 1 });
  shoe(ctx, -8, 0, { color: kicks[0], seed: sd + 2, len: 15, h: 7.5 });
  shoe(ctx, 10, 0, { color: kicks[1], seed: sd + 3, len: 15, h: 7.5 });
  const wave = Math.sin(t * 4) * 0.25;
  const armShoe = (sx, sy, ex, ey, c, s) => {
    tube(ctx, [[sx, sy], [(sx + ex) / 2, (sy + ey) / 2 - 4], [ex, ey]], '#5a2e18', 4, { lw: 2.4, seed: s });
    ctx.save();
    ctx.translate(ex, ey);
    ctx.rotate(-0.6);
    shoe(ctx, 0, 6, { color: c, seed: s + 1, len: 13, h: 6.5 });
    ctx.restore();
  };
  armShoe(-12, -40, -30, -54 + wave * 20, kicks[2], sd + 4);
  armShoe(-12, -32, -32, -34 - wave * 16, kicks[3], sd + 6);
  // shell body
  blob(ctx, [
    ['M', -16, -18],
    ['C', -22, -36, -18, -60, 0, -62],
    ['C', 18, -60, 22, -36, 16, -18],
    ['C', 8, -12, -8, -12, -16, -18],
    ['Z'],
  ], { fill: shell, shade: shade(shell, 0.35), sdx: 3, sdy: 3, lw: 3, seed: sd + 8 });
  stroke(ctx, [[0, -60], [0, -16]], { lw: 2.2, color: rgba('#140f26', 0.7), seed: sd + 9 });
  shape(ctx, ellipsePts(-6, -48, 3, 7, 0.2), { fill: rgba('#fff6e6', 0.35), lw: 0, seed: sd + 10 });
  armShoe(12, -40, 30, -50 - wave * 20, kicks[4], sd + 11);
  armShoe(12, -32, 32, -30 + wave * 16, kicks[5], sd + 13);
  // head
  ellipse(ctx, 2, -70, 12, 10, { fill: '#6b3a20', shade: '#4a2412', sdx: 2, sdy: 2, lw: 3, seed: sd + 15 });
  eye(ctx, -2, -71, 4.2, 5, { lidColor: '#6b3a20', blink: p.blink || 0, seed: sd + 16, lid: 0.2, bag: false });
  eye(ctx, 9, -71, 4.2, 5, { lidColor: '#6b3a20', blink: p.blink || 0, seed: sd + 17, lid: 0.2, bag: false });
  stroke(ctx, [[0, -63], [6, -63.5]], { lw: 1.8, seed: sd + 18 });
  // antennae
  const aw = Math.sin(t * 2.6) * 4;
  stroke(ctx, pathPts([['M', -2, -79], ['Q', -10, -98, -22 + aw, -104]]), { lw: 2, seed: sd + 19 });
  stroke(ctx, pathPts([['M', 6, -79], ['Q', 14, -98, 26 - aw, -102]]), { lw: 2, seed: sd + 20 });
  // backwards cap
  blob(ctx, [['M', -9, -76], ['C', -10, -88, 12, -90, 14, -76], ['Z']], { fill: '#ff4f9a', lw: 2.6, seed: sd + 21 });
  ctx.restore();
}

export function drawRaccoon(ctx, x, y, p = {}) {
  // Rascal — graffiti raccoon, bandana, paint-splattered overalls, spray can.
  const t = p.t || 0, sd = p.boil ?? 51;
  const bob = Math.sin(t * 2) * 1;
  const fur = '#8c8aa0';
  const shake = p.shake ? Math.sin(t * 30) * 2.5 : 0;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale((p.facing || 1) * (p.scale || 1), p.scale || 1);
  ctx.translate(0, bob);
  // ringed tail
  const tw = Math.sin(t * 2.4) * 3;
  tube(ctx, pathPts([['M', -14, -24], ['C', -30, -24, -40, -34 + tw, -44, -50 + tw]]), '#6e6c84', 13, { lw: 3, seed: sd });
  for (let i = 0; i < 3; i++) {
    const k = 0.35 + i * 0.22;
    const tx = -14 + (-44 + 14) * k, ty = -24 + (-50 - -24 + tw) * k * k;
    ellipse(ctx, tx, ty, 6, 3.5, { fill: '#2a2238', lw: 0, rot: 0.9, seed: sd + 1 + i });
  }
  tube(ctx, [[-6, -18], [-7, -3]], shade(fur, 0.3), 7, { lw: 2.6, seed: sd + 5 });
  tube(ctx, [[6, -18], [7, -3]], fur, 7, { lw: 2.6, seed: sd + 6 });
  shoe(ctx, -5, 0, { color: '#2a2238', sole: '#ffd23f', seed: sd + 7 });
  shoe(ctx, 10, 0, { color: '#2a2238', sole: '#ffd23f', seed: sd + 8 });
  // overalls
  blob(ctx, [
    ['M', -15, -46],
    ['C', -19, -36, -18, -24, -16, -15],
    ['C', -6, -12, 8, -12, 16, -15],
    ['C', 18, -26, 17, -38, 13, -47],
    ['C', 4, -52, -8, -52, -15, -46],
    ['Z'],
  ], { fill: '#3e6fd8', shade: '#2a4ea0', sdx: 3, sdy: 2.5, lw: 3, seed: sd + 9 });
  const splat = mulberry32(sd);
  for (let i = 0; i < 6; i++) dot(ctx, -12 + splat() * 26, -44 + splat() * 28, 1.2 + splat() * 2, ['#ff4f9a', '#ffd23f', '#3ec7b0'][i % 3]);
  rrect(ctx, -9, -40, 18, 12, 2, { fill: '#3e6fd8', lw: 2.2, seed: sd + 10 });
  // arm with can
  tube(ctx, [[8, -44], [16, -33 + shake], [24, -38 + shake]], fur, 6.5, { lw: 2.6, seed: sd + 11 });
  rrect(ctx, 20, -55 + shake, 10, 18, 3, { fill: '#ff4f9a', shade: '#c93276', sdx: 1.5, sdy: 1.5, lw: 2.4, seed: sd + 12 });
  rrect(ctx, 22.5, -59 + shake, 5, 5, 1.5, { fill: '#f4efe6', lw: 2, seed: sd + 13 });
  // head
  ellipse(ctx, -10, -84, 7, 8, { fill: fur, lw: 3, seed: sd + 14 });
  ellipse(ctx, 12, -85, 7, 8, { fill: fur, lw: 3, seed: sd + 15 });
  dot(ctx, -10, -83, 3.5, '#2a2238');
  dot(ctx, 12, -84, 3.5, '#2a2238');
  blob(ctx, [
    ['M', -16, -62],
    ['C', -22, -72, -16, -84, 0, -84],
    ['C', 14, -84, 22, -76, 24, -70],
    ['C', 30, -68, 34, -66, 34, -63],
    ['C', 33, -58, 26, -56, 18, -55],
    ['C', 8, -53, -10, -54, -16, -62],
    ['Z'],
  ], { fill: fur, shade: shade(fur, 0.22), sdx: 2.5, sdy: 3, lw: 3, seed: sd + 16 });
  // mask
  blob(ctx, [['M', -10, -72], ['C', -2, -78, 14, -78, 24, -70], ['C', 18, -64, 10, -66, 6, -68], ['C', 0, -64, -8, -64, -10, -72], ['Z']], { fill: '#2a2238', lw: 0, seed: sd + 17 });
  eye(ctx, 2, -71, 4, 4.6, { lidColor: '#2a2238', blink: p.blink || 0, seed: sd + 18, lid: 0.3, bag: false });
  eye(ctx, 15, -71, 4, 4.6, { lidColor: '#2a2238', blink: p.blink || 0, seed: sd + 19, lid: 0.3, bag: false });
  ellipse(ctx, 33, -63.5, 3.8, 3.4, { fill: INK, lw: 2, seed: sd + 20 });
  stroke(ctx, [[27, -57], [20, -56]], { lw: 1.6, seed: sd + 21 });
  // bandana
  blob(ctx, [['M', -16, -60], ['C', -6, -50, 14, -50, 24, -58], ['L', 22, -52], ['C', 10, -42, -6, -44, -16, -54], ['Z']], { fill: '#e8456b', lw: 2.6, seed: sd + 22 });
  for (let i = 0; i < 4; i++) dot(ctx, -8 + i * 8, -52, 1.2, '#f4efe6');
  ctx.restore();
}

export function drawBat(ctx, x, y, p = {}) {
  // DJ Echo — bat DJ, giant ears, giant headphones, fangs.
  const t = p.t || 0, sd = p.boil ?? 61;
  const nod = Math.sin(t * Math.PI * 2 * 1.47) * 2.2; // ~88 bpm
  const body = '#4a3a6e';
  ctx.save();
  ctx.translate(x, y);
  ctx.scale((p.facing || 1) * (p.scale || 1), p.scale || 1);
  tube(ctx, [[-5, -18], [-6, -3]], shade(body, 0.3), 5, { lw: 2.4, seed: sd });
  tube(ctx, [[5, -18], [6, -3]], body, 5, { lw: 2.4, seed: sd + 1 });
  shoe(ctx, -4, 0, { color: '#f4efe6', sole: '#7b5cff', seed: sd + 2, len: 15 });
  shoe(ctx, 9, 0, { color: '#f4efe6', sole: '#7b5cff', seed: sd + 3, len: 15 });
  // folded wings like a cape
  blob(ctx, [['M', -14, -50], ['L', -30, -18], ['L', -22, -22], ['L', -18, -12], ['L', -10, -18], ['L', -4, -14], ['L', 0, -40], ['Z']], { fill: '#2a2040', lw: 3, seed: sd + 4 });
  blob(ctx, [
    ['M', -12, -48],
    ['C', -16, -36, -14, -22, -12, -16],
    ['C', -4, -13, 6, -13, 13, -16],
    ['C', 15, -26, 14, -40, 10, -48],
    ['C', 4, -52, -6, -52, -12, -48],
    ['Z'],
  ], { fill: '#1f1830', shade: '#140f26', lw: 3, seed: sd + 5 });
  text(ctx, 'ECHO', 0, -28, { size: 7, font: FONTS.sign, fill: '#3ec7b0', lw: 0 });
  ctx.save();
  ctx.translate(0, nod);
  // ears
  blob(ctx, [['M', -12, -70], ['L', -26, -104], ['L', -2, -78], ['Z']], { fill: body, lw: 3, seed: sd + 6 });
  blob(ctx, [['M', -12, -74], ['L', -21, -96], ['L', -6, -79], ['Z']], { fill: PINK_D, lw: 0, seed: sd + 7 });
  blob(ctx, [['M', 10, -76], ['L', 22, -108], ['L', 22, -76], ['Z']], { fill: body, lw: 3, seed: sd + 8 });
  blob(ctx, [['M', 13, -78], ['L', 20, -100], ['L', 20, -78], ['Z']], { fill: PINK_D, lw: 0, seed: sd + 9 });
  ellipse(ctx, 4, -66, 17, 15, { fill: body, shade: shade(body, 0.3), sdx: 2, sdy: 2, lw: 3, seed: sd + 10 });
  ellipse(ctx, 14, -63, 7, 5, { fill: tint(body, 0.2), lw: 0, seed: sd + 11 });
  // shades
  rrect(ctx, -6, -72, 12, 7, 3, { fill: '#140f26', lw: 2.2, seed: sd + 12 });
  rrect(ctx, 8, -72, 12, 7, 3, { fill: '#140f26', lw: 2.2, seed: sd + 13 });
  stroke(ctx, [[6, -69], [8, -69]], { lw: 2, seed: sd + 14 });
  dot(ctx, -2, -70, 1.4, '#3ec7b0');
  dot(ctx, 12, -70, 1.4, '#3ec7b0');
  // fangs + nose
  ellipse(ctx, 19, -62, 2.6, 2, { fill: PINK, lw: 1.6, seed: sd + 15 });
  stroke(ctx, [[10, -57], [18, -57.5]], { lw: 1.8, seed: sd + 16 });
  blob(ctx, [['M', 11, -57], ['L', 12.5, -53], ['L', 14, -57], ['Z']], { fill: '#fffaf0', lw: 1.4, seed: sd + 17 });
  // headphones
  stroke(ctx, pathPts([['M', -14, -64], ['C', -16, -90, 24, -92, 22, -64]]), { lw: 5, color: '#3ec7b0', seed: sd + 18 });
  stroke(ctx, pathPts([['M', -14, -64], ['C', -16, -90, 24, -92, 22, -64]]), { lw: 1.6, seed: sd + 19 });
  rrect(ctx, -19, -70, 9, 14, 4, { fill: '#3ec7b0', shade: '#2a9484', sdx: 1.5, sdy: 1.5, lw: 2.6, seed: sd + 20 });
  rrect(ctx, 18, -70, 9, 14, 4, { fill: '#3ec7b0', shade: '#2a9484', sdx: 1.5, sdy: 1.5, lw: 2.6, seed: sd + 21 });
  ctx.restore();
  ctx.restore();
}

export function drawCat(ctx, x, y, p = {}) {
  // Mr. Whiskers — retired bodega cat. Deli paper hat, apron, zero urgency.
  const t = p.t || 0, sd = p.boil ?? 71;
  const fur = '#f0a050';
  const stripe = '#c8742e';
  const breathe = Math.sin(t * 1.6) * 1.2;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale((p.facing || 1) * (p.scale || 1), p.scale || 1);
  const sw = Math.sin(t * 1.3) * 8;
  tube(ctx, pathPts([['M', -16, -18], ['C', -34, -16, -38, -34, -34 + sw * 0.4, -50 + sw * 0.2]]), fur, 8, { lw: 3, seed: sd });
  tube(ctx, [[-7, -16], [-8, -2]], shade(fur, 0.25), 8, { lw: 2.6, seed: sd + 1 });
  tube(ctx, [[7, -16], [8, -2]], fur, 8, { lw: 2.6, seed: sd + 2 });
  ellipse(ctx, -7, -1, 7, 4, { fill: '#fff6e6', lw: 2.4, seed: sd + 3 });
  ellipse(ctx, 10, -1, 7, 4, { fill: '#fff6e6', lw: 2.4, seed: sd + 4 });
  // round body
  ellipse(ctx, 0, -34 + breathe * 0.4, 21, 22 + breathe * 0.3, { fill: fur, shade: shade(fur, 0.22), sdx: 3, sdy: 3, lw: 3, seed: sd + 5 });
  blob(ctx, [['M', -12, -50], ['L', 14, -50], ['L', 17, -14], ['L', -15, -14], ['Z']], { fill: '#fff6e6', lw: 2.6, seed: sd + 6 });
  stroke(ctx, [[-12, -48], [-16, -58]], { lw: 2, seed: sd + 7 });
  stroke(ctx, [[14, -48], [18, -58]], { lw: 2, seed: sd + 8 });
  text(ctx, 'DELI', 1, -38, { size: 8, font: FONTS.sign, fill: '#e8456b', lw: 0 });
  // paws on belly
  ellipse(ctx, -12, -24, 5.5, 5, { fill: fur, lw: 2.4, seed: sd + 9 });
  ellipse(ctx, 14, -24, 5.5, 5, { fill: fur, lw: 2.4, seed: sd + 10 });
  // head
  blob(ctx, [['M', -18, -66], ['L', -16, -88], ['L', -4, -74], ['Z']], { fill: fur, lw: 3, seed: sd + 11 });
  blob(ctx, [['M', 12, -74], ['L', 22, -88], ['L', 22, -66], ['Z']], { fill: fur, lw: 3, seed: sd + 12 });
  ellipse(ctx, 2, -64, 20, 16, { fill: fur, shade: shade(fur, 0.2), sdx: 2, sdy: 2, lw: 3, seed: sd + 13 });
  for (let i = 0; i < 3; i++) stroke(ctx, [[-6 + i * 6, -79], [-5 + i * 6, -72]], { lw: 2.2, color: stripe, seed: sd + 14 + i });
  ellipse(ctx, 4, -57, 9, 6, { fill: '#fff6e6', lw: 0, seed: sd + 17 });
  eye(ctx, -6, -65, 4.4, 4.4, { lidColor: fur, blink: p.blink || 0, seed: sd + 18, lid: 0.55, bag: false, pupil: '#2a6e3a' });
  eye(ctx, 12, -65, 4.4, 4.4, { lidColor: fur, blink: p.blink || 0, seed: sd + 19, lid: 0.55, bag: false, pupil: '#2a6e3a' });
  blob(ctx, [['M', 1, -60], ['L', 7, -60], ['L', 4, -57], ['Z']], { fill: PINK, lw: 1.6, seed: sd + 20 });
  stroke(ctx, pathPts([['M', 0, -54], ['Q', 4, -51, 4, -55], ['Q', 4, -51, 8, -54]]), { lw: 1.6, seed: sd + 21 });
  for (let i = 0; i < 2; i++) {
    stroke(ctx, [[-8, -57 + i * 3], [-24, -59 + i * 5]], { lw: 1.2, seed: sd + 22 + i });
    stroke(ctx, [[16, -57 + i * 3], [32, -59 + i * 5]], { lw: 1.2, seed: sd + 24 + i });
  }
  // paper deli hat
  blob(ctx, [['M', -14, -76], ['L', -10, -88], ['L', 18, -88], ['L', 20, -76], ['Z']], { fill: '#fffaf0', shade: '#e6dccb', sdx: 2, sdy: 2, lw: 2.6, seed: sd + 26 });
  stroke(ctx, [[-12, -80], [19, -80]], { lw: 2, color: '#e8456b', seed: sd + 27 });
  ctx.restore();
}

export function drawWeasel(ctx, x, y, p = {}) {
  // Three-Cup Charlie — weasel hustler. Trench coat, flat cap, toothpick.
  const t = p.t || 0, sd = p.boil ?? 81;
  const fur = '#c99a6a';
  const lean = Math.sin(t * 1.4) * 0.03;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale((p.facing || 1) * (p.scale || 1), p.scale || 1);
  ctx.rotate(lean);
  tube(ctx, pathPts([['M', -10, -18], ['C', -24, -14, -30, -4, -40, -6]]), fur, 6, { lw: 2.6, seed: sd });
  tube(ctx, [[-5, -16], [-6, -3]], shade(fur, 0.3), 5, { lw: 2.4, seed: sd + 1 });
  tube(ctx, [[5, -16], [6, -3]], fur, 5, { lw: 2.4, seed: sd + 2 });
  shoe(ctx, -4, 0, { color: '#5a3a22', sole: '#2a2238', seed: sd + 3, len: 16 });
  shoe(ctx, 9, 0, { color: '#5a3a22', sole: '#2a2238', seed: sd + 4, len: 16 });
  // long trench
  blob(ctx, [
    ['M', -10, -64],
    ['C', -16, -50, -18, -30, -16, -12],
    ['C', -6, -10, 8, -10, 16, -12],
    ['C', 16, -32, 14, -52, 10, -64],
    ['C', 4, -68, -6, -68, -10, -64],
    ['Z'],
  ], { fill: '#b88a4a', shade: '#8a6230', sdx: 3, sdy: 3, lw: 3, seed: sd + 5 });
  stroke(ctx, [[2, -66], [6, -14]], { lw: 2, color: rgba('#140f26', 0.6), seed: sd + 6 });
  stroke(ctx, [[-8, -40], [12, -40]], { lw: 3, color: '#6a4820', seed: sd + 7 });
  for (let i = 0; i < 3; i++) dot(ctx, 9, -56 + i * 10, 1.5, INK);
  // long neck + head
  blob(ctx, [['M', -6, -64], ['C', -6, -74, 8, -76, 10, -64], ['Z']], { fill: fur, lw: 3, seed: sd + 8 });
  blob(ctx, [
    ['M', -12, -78],
    ['C', -14, -90, 0, -94, 12, -90],
    ['C', 22, -88, 30, -84, 34, -80],
    ['C', 33, -76, 26, -74, 16, -73],
    ['C', 4, -71, -10, -72, -12, -78],
    ['Z'],
  ], { fill: fur, shade: shade(fur, 0.2), sdx: 2, sdy: 2.5, lw: 3, seed: sd + 9 });
  ellipse(ctx, 18, -77, 8, 3.5, { fill: '#f4e2c8', lw: 0, seed: sd + 10 });
  ellipse(ctx, -6, -92, 5, 5, { fill: fur, lw: 2.6, seed: sd + 11 });
  eye(ctx, 12, -84, 3.6, 3.2, { lidColor: fur, blink: p.blink || 0, seed: sd + 12, lid: 0.5, bag: false, look: 0.6 });
  ellipse(ctx, 34, -80.5, 3, 2.6, { fill: INK, lw: 1.6, seed: sd + 13 });
  stroke(ctx, [[22, -74.5], [38, -70]], { lw: 1.8, color: '#e8c38a', seed: sd + 14 });
  // flat cap
  blob(ctx, [['M', -12, -88], ['C', -10, -98, 14, -100, 22, -92], ['L', 30, -89], ['C', 18, -86, -2, -85, -12, -88], ['Z']], { fill: '#5a5a6e', shade: '#3e3e52', sdx: 1.5, sdy: 1.5, lw: 3, seed: sd + 15 });
  ctx.restore();
}

export function drawTortoise(ctx, x, y, p = {}) {
  // Shelly — token booth clerk since 1971. Reading glasses, cardigan, patience.
  const t = p.t || 0, sd = p.boil ?? 91;
  const skin = '#9cbf6e';
  const breathe = Math.sin(t * 1.1) * 0.8;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale((p.facing || 1) * (p.scale || 1), p.scale || 1);
  // shell
  blob(ctx, [['M', -30, -16], ['C', -34, -50, -8, -66, 10, -58], ['C', 22, -52, 20, -30, 12, -16], ['Z']], { fill: '#5e7a3a', shade: '#465e2a', sdx: 3, sdy: 3, lw: 3, seed: sd });
  for (const [cx, cy] of [[-16, -40], [-2, -48], [-20, -24], [2, -30]]) shape(ctx, ellipsePts(cx, cy, 6, 5), { fill: '#7a9a4a', lw: 2, seed: sd + cx });
  // cardigan front
  blob(ctx, [['M', 2, -52], ['C', 16, -52, 22, -34, 18, -16], ['L', 0, -16], ['Z']], { fill: '#d96a4a', shade: '#b0503a', sdx: 2, sdy: 2, lw: 3, seed: sd + 1 });
  for (let i = 0; i < 3; i++) dot(ctx, 6, -44 + i * 9, 1.6, '#ffd23f');
  // neck + head
  tube(ctx, pathPts([['M', 8, -50], ['Q', 14, -62, 22, -66 + breathe]]), skin, 11, { lw: 3, seed: sd + 2 });
  ctx.save();
  ctx.translate(0, breathe);
  blob(ctx, [['M', 12, -70], ['C', 12, -84, 34, -86, 40, -74], ['C', 42, -66, 34, -60, 24, -61], ['C', 16, -62, 12, -64, 12, -70], ['Z']], { fill: skin, shade: shade(skin, 0.22), sdx: 2, sdy: 2, lw: 3, seed: sd + 3 });
  for (let i = 0; i < 3; i++) stroke(ctx, [[14 + i * 2, -64 + i * 1.5], [20 + i * 2, -63 + i * 1.5]], { lw: 1.2, color: rgba('#140f26', 0.5), seed: sd + 4 + i });
  eye(ctx, 28, -73, 3.6, 3.8, { lidColor: skin, blink: p.blink || 0, seed: sd + 7, lid: 0.6, bag: true });
  // reading glasses
  shape(ctx, ellipsePts(28, -72.5, 6, 5.2), { fill: rgba('#bfe9ff', 0.25), lw: 2, seed: sd + 8 });
  stroke(ctx, [[22, -73], [14, -75]], { lw: 1.6, seed: sd + 9 });
  stroke(ctx, pathPts([['M', 30, -64], ['Q', 34, -62, 38, -65]]), { lw: 1.6, seed: sd + 10 });
  ctx.restore();
  ctx.restore();
}

export function drawMoth(ctx, x, y, p = {}) {
  // Madame Mothra — back-room fortune teller. Fuzzy, feathery antennae, shawl.
  const t = p.t || 0, sd = p.boil ?? 101;
  const fuzz = '#d9c7a8';
  const flutter = Math.sin(t * 5) * 0.08;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale((p.facing || 1) * (p.scale || 1), p.scale || 1);
  // wings
  ctx.save();
  ctx.rotate(-flutter);
  blob(ctx, [['M', -4, -50], ['C', -40, -86, -60, -40, -34, -22], ['C', -20, -16, -8, -30, -4, -50], ['Z']], { fill: '#9a7ab8', shade: '#7a5a98', sdx: 3, sdy: 3, lw: 3, seed: sd });
  ellipse(ctx, -30, -50, 7, 7, { fill: '#ffd23f', lw: 2.4, seed: sd + 1 });
  dot(ctx, -30, -50, 3, INK);
  ctx.restore();
  ctx.save();
  ctx.rotate(flutter);
  blob(ctx, [['M', 4, -50], ['C', 40, -86, 60, -40, 34, -22], ['C', 20, -16, 8, -30, 4, -50], ['Z']], { fill: '#9a7ab8', shade: '#7a5a98', sdx: 3, sdy: 3, lw: 3, seed: sd + 2 });
  ellipse(ctx, 30, -50, 7, 7, { fill: '#ffd23f', lw: 2.4, seed: sd + 3 });
  dot(ctx, 30, -50, 3, INK);
  ctx.restore();
  // shawl body
  blob(ctx, [['M', -14, -54], ['C', -22, -34, -20, -16, -14, -6], ['C', -4, -2, 6, -2, 14, -6], ['C', 20, -16, 22, -34, 14, -54], ['C', 6, -60, -6, -60, -14, -54], ['Z']], { fill: '#6a2a7a', shade: '#4a1a5a', sdx: 3, sdy: 3, lw: 3, seed: sd + 4 });
  for (let i = 0; i < 5; i++) dot(ctx, -12 + i * 6, -8, 1.8, '#ffd23f');
  // fuzzy head
  ellipse(ctx, 0, -68, 15, 14, { fill: fuzz, shade: shade(fuzz, 0.2), sdx: 2, sdy: 2, lw: 3, seed: sd + 5, amp: 1.6 });
  eye(ctx, -5, -69, 5, 6, { lidColor: fuzz, blink: p.blink || 0, seed: sd + 6, lid: 0.3, bag: false, pupil: '#6a2a7a' });
  eye(ctx, 7, -69, 5, 6, { lidColor: fuzz, blink: p.blink || 0, seed: sd + 7, lid: 0.3, bag: false, pupil: '#6a2a7a' });
  stroke(ctx, pathPts([['M', -2, -59], ['Q', 1, -57, 4, -59]]), { lw: 1.6, seed: sd + 8 });
  // feathery antennae
  for (const dir of [-1, 1]) {
    const pts = pathPts([['M', dir * 4, -80], ['Q', dir * 10, -98, dir * 24, -104]]);
    stroke(ctx, pts, { lw: 2, seed: sd + 9 + dir });
    for (let i = 1; i < pts.length; i += 1) {
      const [px, py] = pts[i];
      stroke(ctx, [[px, py], [px + dir * 3, py - 5]], { lw: 1.2, seed: sd + 20 + i });
      stroke(ctx, [[px, py], [px + dir * 5, py + 1]], { lw: 1.2, seed: sd + 30 + i });
    }
  }
  // head scarf
  blob(ctx, [['M', -15, -72], ['C', -12, -86, 12, -86, 15, -72], ['C', 8, -78, -8, -78, -15, -72], ['Z']], { fill: '#ff4f9a', lw: 2.6, seed: sd + 12 });
  ctx.restore();
}

export function drawGator(ctx, x, y, p = {}) {
  // Big Al — runs the sewer market. Fur coat, gold tooth, shades indoors.
  const t = p.t || 0, sd = p.boil ?? 111;
  const skin = '#4f9a4a';
  const breathe = Math.sin(t * 1.2) * 1.2;
  const jaw = p.talk ? Math.max(0, Math.sin(t * 14)) * 4 : 0;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale((p.facing || 1) * (p.scale || 1), p.scale || 1);
  // tail
  tube(ctx, pathPts([['M', -20, -20], ['C', -44, -16, -60, -4, -80, -6]]), skin, 14, { lw: 3, seed: sd });
  tube(ctx, [[-10, -18], [-12, -2]], shade(skin, 0.3), 11, { lw: 3, seed: sd + 1 });
  tube(ctx, [[10, -18], [12, -2]], skin, 11, { lw: 3, seed: sd + 2 });
  shoe(ctx, -9, 0, { color: '#f4efe6', sole: '#ffd23f', seed: sd + 3, len: 22, h: 10 });
  shoe(ctx, 15, 0, { color: '#f4efe6', sole: '#ffd23f', seed: sd + 4, len: 22, h: 10 });
  // fur coat
  blob(ctx, [
    ['M', -28, -70],
    ['C', -40, -50, -38, -24, -30, -10],
    ['C', -10, -4, 14, -4, 32, -10],
    ['C', 40, -26, 38, -54, 26, -72],
    ['C', 12, -80, -14, -80, -28, -70],
    ['Z'],
  ], { fill: '#e8d6b8', shade: '#c4ae8a', sdx: 3, sdy: 3, lw: 3, seed: sd + 5, amp: 2.2 });
  blob(ctx, [['M', -6, -74], ['L', 10, -74], ['L', 8, -12], ['L', -4, -12], ['Z']], { fill: '#2a2238', lw: 2.6, seed: sd + 6 });
  stroke(ctx, pathPts([['M', -10, -74], ['Q', 2, -46, 14, -74]]), { lw: 4, color: '#ffd23f', seed: sd + 7 });
  ellipse(ctx, 2, -48, 7, 7, { fill: '#ffd23f', shade: '#d49a12', sdx: 1.5, sdy: 1.5, lw: 2.4, seed: sd + 8 });
  text(ctx, 'A', 2, -44.5, { size: 9, font: FONTS.sign, fill: INK, lw: 0 });
  ctx.save();
  ctx.translate(0, breathe);
  // head: long snout
  blob(ctx, [
    ['M', -16, -78],
    ['C', -20, -96, -2, -104, 12, -100],
    ['C', 30, -98, 52, -94, 62, -90],
    ['C', 66, -88, 66, -84, 60, -83],
    ['L', 10, -82],
    ['C', 0, -80, -14, -74, -16, -78],
    ['Z'],
  ], { fill: skin, shade: shade(skin, 0.25), sdx: 2.5, sdy: 2.5, lw: 3, seed: sd + 9 });
  // lower jaw
  blob(ctx, [['M', -12, -76], ['L', 58, -80 + jaw * 0.2], ['C', 60, -74 + jaw, 50, -72 + jaw, 40, -72 + jaw], ['L', -8, -70], ['Z']], { fill: '#6ab55a', lw: 3, seed: sd + 10 });
  // teeth
  for (let i = 0; i < 7; i++) {
    const tx = 14 + i * 6.5;
    blob(ctx, [['M', tx, -82.5], ['L', tx + 2.6, -78], ['L', tx + 5, -82.5], ['Z']], { fill: i === 3 ? '#ffd23f' : '#fffaf0', lw: 1.4, seed: sd + 11 + i, amp: 0.1 });
  }
  dot(ctx, 58, -92, 2, INK);
  // eye ridge + shades
  ellipse(ctx, 8, -100, 9, 7, { fill: skin, lw: 3, seed: sd + 20 });
  rrect(ctx, 0, -104, 18, 8, 3, { fill: '#140f26', lw: 2.4, seed: sd + 21 });
  dot(ctx, 5, -101, 1.5, '#ff4f9a');
  for (let i = 0; i < 4; i++) dot(ctx, 22 + i * 9, -96 + (i % 2), 1.4, shade(skin, 0.35));
  ctx.restore();
  ctx.restore();
}

export function drawGhost(ctx, x, y, p = {}) {
  // The Conductor — ran the last train out of Old Hall in 1904. Still running it.
  const t = p.t || 0, sd = p.boil ?? 121;
  const float = Math.sin(t * 1.7) * 4;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale((p.facing || 1) * (p.scale || 1), p.scale || 1);
  ctx.translate(0, float - 8);
  const glow = ctx.createRadialGradient(0, -50, 4, 0, -50, 70);
  glow.addColorStop(0, 'rgba(120,255,220,0.35)');
  glow.addColorStop(1, 'rgba(120,255,220,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(-70, -120, 140, 140);
  const wav = Math.sin(t * 4) * 3;
  blob(ctx, [
    ['M', -20, -60],
    ['C', -24, -40, -24, -14, -22, 2],
    ['L', -14, -4 + wav],
    ['L', -6, 4],
    ['L', 2, -4 - wav],
    ['L', 10, 4],
    ['L', 18, -4 + wav],
    ['L', 22, 2],
    ['C', 24, -20, 24, -44, 20, -60],
    ['C', 10, -80, -10, -80, -20, -60],
    ['Z'],
  ], { fill: 'rgba(190,255,236,0.82)', shade: 'rgba(120,210,200,0.6)', sdx: 3, sdy: 3, lw: 3, line: '#1d4a4a', seed: sd });
  // uniform vest
  blob(ctx, [['M', -14, -48], ['L', 14, -48], ['L', 12, -18], ['L', -12, -18], ['Z']], { fill: 'rgba(40,90,110,0.75)', lw: 2.4, line: '#1d4a4a', seed: sd + 1 });
  for (let i = 0; i < 3; i++) dot(ctx, 0, -42 + i * 8, 1.6, '#ffd23f');
  // pocket watch chain
  stroke(ctx, pathPts([['M', -10, -30], ['Q', -2, -24, 8, -32]]), { lw: 1.6, color: '#ffd23f', seed: sd + 2 });
  eye(ctx, -6, -62, 3.6, 4.6, { lidColor: 'rgba(190,255,236,1)', blink: p.blink || 0, seed: sd + 3, lid: 0.25, bag: false, pupil: '#1d4a4a' });
  eye(ctx, 7, -62, 3.6, 4.6, { lidColor: 'rgba(190,255,236,1)', blink: p.blink || 0, seed: sd + 4, lid: 0.25, bag: false, pupil: '#1d4a4a' });
  // walrus mustache
  blob(ctx, [['M', 0, -55], ['C', -8, -58, -16, -54, -16, -48], ['C', -10, -52, -4, -51, 0, -52], ['C', 4, -51, 10, -52, 16, -48], ['C', 16, -54, 8, -58, 0, -55], ['Z']], { fill: '#e8f8f2', lw: 2.2, line: '#1d4a4a', seed: sd + 5 });
  // conductor cap
  blob(ctx, [['M', -16, -72], ['C', -16, -86, 16, -86, 16, -72], ['Z']], { fill: '#24506a', lw: 2.6, line: '#1d4a4a', seed: sd + 6 });
  blob(ctx, [['M', -18, -72], ['L', 22, -72], ['L', 24, -68], ['L', -12, -68], ['Z']], { fill: '#163648', lw: 2.4, line: '#1d4a4a', seed: sd + 7 });
  rrect(ctx, -5, -82, 10, 6, 1, { fill: '#ffd23f', lw: 1.6, line: '#1d4a4a', seed: sd + 8 });
  ctx.restore();
}

// ---------------------------------------------------------------- ambient rats

// A commuter rat in a suit reading the paper, a sleeper, pizza rat.
export function drawCommuter(ctx, x, y, p = {}) {
  const look = { fur: p.fur || 'slate', hoodie: p.suit || '#3a3f5c', hat: p.hat || 'fedora', hatColor: p.hatColor || '#4a4560', shoe: '#2a2238' };
  drawRat(ctx, x, y, { ...p, look, pocket: true });
  if (p.paper) {
    const sd = p.boil ?? 131;
    ctx.save();
    ctx.translate(x, y + (p.bob || 0));
    ctx.scale(p.facing || 1, 1);
    rrect(ctx, 6, -62, 26, 32, 1.5, { fill: '#efe6d2', shade: '#d6c9ad', sdx: 2, sdy: 2, lw: 2.4, seed: sd, rot: 0 });
    for (let i = 0; i < 6; i++) stroke(ctx, [[9, -56 + i * 4.5], [29, -56 + i * 4.5]], { lw: 1.2, color: rgba('#140f26', 0.45), seed: sd + i, amp: 0.3 });
    text(ctx, 'NEWS', 19, -57, { size: 5.5, font: FONTS.sign, fill: INK, lw: 0 });
    ctx.restore();
  }
}

export function drawPizza(ctx, x, y, s = 1, seed = 141) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  blob(ctx, [['M', 0, 0], ['L', 34, -10], ['C', 38, -4, 38, 4, 34, 10], ['Z']], { fill: '#ffcf5a', shade: '#e8a83a', sdx: 2, sdy: 2, lw: 2.6, seed });
  blob(ctx, [['M', 32, -11], ['C', 39, -5, 39, 5, 32, 11], ['L', 36, 12], ['C', 42, 5, 42, -5, 36, -12], ['Z']], { fill: '#c8742e', lw: 2.4, seed: seed + 1 });
  for (const [px, py] of [[14, -1], [24, -4], [24, 4]]) ellipse(ctx, px, py, 3, 2.6, { fill: '#e8456b', lw: 1.6, seed: seed + px });
  ctx.restore();
}

// ---------------------------------------------------------------- portraits

// Head-and-shoulders portrait for dialogue boxes and the HUD wallet.
// `who` is a cast key; draws into the full canvas.
export const CAST = {
  rat: { draw: drawRat, frame: [-40, -112, 90, 100] },
  pigeon: { draw: drawPigeon, frame: [-34, -100, 76, 86] },
  cheese: { draw: drawBigCheese, frame: [-40, -112, 90, 100] },
  roach: { draw: drawRoach, frame: [-40, -112, 84, 92] },
  raccoon: { draw: drawRaccoon, frame: [-34, -104, 84, 92] },
  bat: { draw: drawBat, frame: [-36, -112, 80, 98] },
  cat: { draw: drawCat, frame: [-36, -98, 80, 84] },
  weasel: { draw: drawWeasel, frame: [-26, -108, 76, 84] },
  tortoise: { draw: drawTortoise, frame: [-10, -96, 64, 80] },
  moth: { draw: drawMoth, frame: [-46, -112, 92, 100] },
  gator: { draw: drawGator, frame: [-34, -118, 110, 104] },
  ghost: { draw: drawGhost, frame: [-36, -104, 76, 92] },
  commuter: { draw: drawCommuter, frame: [-40, -112, 90, 100] },
};

export function drawPortrait(canvas, who, opts = {}) {
  const g = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  g.clearRect(0, 0, W, H);
  const c = CAST[who] || CAST.rat;
  const [fx, fy, fw, fh] = c.frame;
  const s = Math.min(W / fw, H / fh);
  g.save();
  g.translate((W - fw * s) / 2 - fx * s, (H - fh * s) / 2 - fy * s);
  g.scale(s, s);
  c.draw(g, 0, 0, { t: opts.t || 0, boil: opts.boil, talk: opts.talk, blink: opts.blink, look: opts.look, facing: 1 });
  g.restore();
}

// ---------------------------------------------------------------- ambient extras

export function drawSleeper(ctx, x, y, p = {}) {
  // a commuter asleep on the bench, hat over the eyes, Zzz handled by the stage
  const t = p.t || 0;
  const breathe = Math.sin(t * 1.4) * 1.2;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(-1.45);
  ctx.translate(0, breathe * 0.3);
  drawRat(ctx, 0, 0, { t: 0, look: { fur: 'slate', hoodie: '#3a5a8c', hat: 'fedora', hatColor: '#2a2238', shoe: '#f4efe6' }, blink: 1, pocket: true, noShadow: true, boil: p.boil });
  ctx.restore();
}

export function drawBusker(ctx, x, y, p = {}) {
  // rat with a saxophone
  const t = p.t || 0;
  const sway = Math.sin(t * 2.6) * 0.06;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(sway);
  drawRat(ctx, 0, 0, { t, look: { fur: 'sand', hoodie: '#2a2238', hat: 'bucket', hatColor: '#ff8a3d', shoe: '#ffd23f' }, pocket: true, blink: p.blink, boil: p.boil, lid: 0.7 });
  ctx.save();
  ctx.scale(p.facing || 1, 1);
  // sax
  tube(ctx, pathPts([['M', 26, -58], ['C', 30, -44, 22, -34, 18, -24], ['C', 14, -12, 26, -10, 32, -16]]), '#ffd23f', 6, { lw: 2.4, seed: 7 });
  ellipse(ctx, 33, -18, 6, 5, { fill: '#ffd23f', lw: 2.4, seed: 8 });
  for (let i = 0; i < 3; i++) dot(ctx, 20 + i * 2, -40 + i * 7, 1.6, INK);
  tube(ctx, [[2, -44], [12, -36], [20, -40]], '#2a2238', 7, { lw: 2.4, seed: 9 });
  ctx.restore();
  ctx.restore();
}

export function drawGhostRat(ctx, x, y, p = {}) {
  const t = p.t || 0;
  ctx.save();
  ctx.globalAlpha *= 0.55 + Math.sin(t * 2) * 0.1;
  ctx.translate(0, Math.sin(t * 1.5) * 3 - 4);
  drawRat(ctx, x, y, { t, look: { fur: '#bff8ec', hoodie: '#5a8a8e', hat: 'fedora', hatColor: '#2a5a5e', shoe: '#bff8ec' }, pocket: true, blink: p.blink, boil: p.boil, facing: p.facing, noShadow: true });
  ctx.restore();
}

export function drawPizzaRat(ctx, x, y, p = {}) {
  const f = p.facing || 1;
  ctx.save();
  ctx.translate(x - f * 16, y - 8);
  ctx.scale(-f, 1);
  ctx.rotate(0.12);
  drawPizza(ctx, 0, 0, 1.1, 141);
  ctx.restore();
  drawRat(ctx, x, y, { ...p, look: { fur: 'midnight', hoodie: '#ff8a3d', hat: 'none', shoe: '#f4efe6' } });
}
