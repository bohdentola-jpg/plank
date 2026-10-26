// Paints a player's 512² uniform atlas: jersey (front/back numbers with
// outlines, TV numbers on the shoulders, name on the back, sleeve trim,
// collar, side panels, yoke), pants with stripes and belt, socks with hoops,
// skin (arms, neck, face with eyes / brows / eye black / beard, scalp hair),
// gloves, cleats, eyes, hair and the small props. Regions come from layout.js.
import * as THREE from 'three';
import { R, SWATCH, ATLAS, pxOf, torsoU, headU, headV } from './layout.js';
import { drawNumber, numberWidth } from './numfont.js';
import { logoCanvas } from '../logos.js';
import { makeRng, hashString, shade, hexToRgb, rgbToHex } from '../../core/util.js';

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;

export function mix(a, b, t) {
  const A = hexToRgb(a), Bc = hexToRgb(b);
  return rgbToHex(lerp(A[0], Bc[0], t), lerp(A[1], Bc[1], t), lerp(A[2], Bc[2], t));
}
const lum = (hex) => { const [r, g, b] = hexToRgb(hex); return 0.299 * r + 0.587 * g + 0.114 * b; };

// ------------------------------------------------------------------ helpers

/** Fill a region-local rectangle (u0..u1, v0..v1), wrapping u across the seam. */
function rectL(ctx, rect, u0, v0, u1, v1, color) {
  ctx.fillStyle = color;
  const [x, y, w, h] = rect;
  const py0 = y + (1 - Math.max(v0, v1)) * h, py1 = y + (1 - Math.min(v0, v1)) * h;
  const draw = (a, b) => {
    const xa = x + clamp(a, 0, 1) * w, xb = x + clamp(b, 0, 1) * w;
    if (xb > xa) ctx.fillRect(xa, py0, xb - xa, py1 - py0);
  };
  if (u0 < 0) { draw(u0 + 1, 1); draw(0, u1); }
  else if (u1 > 1) { draw(u0, 1); draw(0, u1 - 1); }
  else draw(u0, u1);
}

function clipRect(ctx, rect) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(rect[0], rect[1], rect[2], rect[3]);
  ctx.clip();
}

let fabricTile = null, sheenTile = null, skinTile = null;
function tiles() {
  if (fabricTile) return;
  const rng = makeRng(77);
  // jersey mesh: a fine diamond weave with speckle
  fabricTile = document.createElement('canvas');
  fabricTile.width = fabricTile.height = 32;
  let x = fabricTile.getContext('2d');
  const img = x.createImageData(32, 32);
  for (let j = 0; j < 32; j++) {
    for (let i = 0; i < 32; i++) {
      const k = (j * 32 + i) * 4;
      const weave = ((i + j) % 3 === 0 ? 1 : 0) * 0.5 + ((i - j + 64) % 3 === 0 ? 1 : 0) * 0.5;
      const v = 128 + (weave - 0.4) * 46 + (rng() - 0.5) * 30;
      img.data[k] = img.data[k + 1] = img.data[k + 2] = clamp(v, 0, 255);
      img.data[k + 3] = 255;
    }
  }
  x.putImageData(img, 0, 0);
  // pants: smooth stretch fabric with faint vertical rib
  sheenTile = document.createElement('canvas');
  sheenTile.width = sheenTile.height = 32;
  x = sheenTile.getContext('2d');
  const img2 = x.createImageData(32, 32);
  for (let j = 0; j < 32; j++) {
    for (let i = 0; i < 32; i++) {
      const k = (j * 32 + i) * 4;
      const v = 128 + (i % 2 ? 7 : -7) + (rng() - 0.5) * 14;
      img2.data[k] = img2.data[k + 1] = img2.data[k + 2] = clamp(v, 0, 255);
      img2.data[k + 3] = 255;
    }
  }
  x.putImageData(img2, 0, 0);
  // skin: soft mottling
  skinTile = document.createElement('canvas');
  skinTile.width = skinTile.height = 64;
  x = skinTile.getContext('2d');
  x.fillStyle = 'rgb(128,128,128)';
  x.fillRect(0, 0, 64, 64);
  for (let i = 0; i < 90; i++) {
    const px = rng() * 64, py = rng() * 64, r = 2 + rng() * 6;
    const g = x.createRadialGradient(px, py, 0, px, py, r);
    const c = rng() < 0.5 ? '150,150,150' : '108,108,108';
    g.addColorStop(0, `rgba(${c},0.35)`);
    g.addColorStop(1, `rgba(${c},0)`);
    x.fillStyle = g;
    x.fillRect(px - r, py - r, r * 2, r * 2);
  }
}

/** Overlay a grey tile with 'overlay' blending over a region (keeps hue). */
function texture(ctx, rect, tile, alpha) {
  ctx.save();
  ctx.globalCompositeOperation = 'overlay';
  ctx.globalAlpha = alpha;
  ctx.fillStyle = ctx.createPattern(tile, 'repeat');
  ctx.fillRect(rect[0], rect[1], rect[2], rect[3]);
  ctx.restore();
}

/** Vertical (along v) shade band: darken a u-range softly. */
function shadeU(ctx, rect, uc, width, alpha, v0 = 0, v1 = 1, color = '0,0,0') {
  const [x, y, w, h] = rect;
  const py0 = y + (1 - v1) * h, py1 = y + (1 - v0) * h;
  for (const off of [-1, 0, 1]) {
    const cx = x + (uc + off) * w;
    const g = ctx.createLinearGradient(cx - width * w, 0, cx + width * w, 0);
    g.addColorStop(0, `rgba(${color},0)`);
    g.addColorStop(0.5, `rgba(${color},${alpha})`);
    g.addColorStop(1, `rgba(${color},0)`);
    ctx.fillStyle = g;
    ctx.fillRect(cx - width * w, py0, width * 2 * w, py1 - py0);
  }
}
/** Horizontal shade band at v (soft). */
function shadeV(ctx, rect, vc, height, alpha, color = '0,0,0') {
  const [x, y, w, h] = rect;
  const cy = y + (1 - vc) * h;
  const g = ctx.createLinearGradient(0, cy - height * h, 0, cy + height * h);
  g.addColorStop(0, `rgba(${color},0)`);
  g.addColorStop(0.5, `rgba(${color},${alpha})`);
  g.addColorStop(1, `rgba(${color},0)`);
  ctx.fillStyle = g;
  ctx.fillRect(x, cy - height * h, w, height * 2 * h);
}

// ------------------------------------------------------------------ kit helpers

export const REF_KIT = {
  jersey: '#f2f2ee', numbers: '#111111', numberOutline: null, numberFont: 'block',
  sleeve: 'none', sleeveColors: [], collar: '#111111', sideColor: null,
  pants: '#141414', pantStripe: 'none', pantStripeColors: [], socks: '#121212', sockStripes: [],
  shoes: 'black', gloves: null, nameOnBack: false, ref: true,
};

function shoeColors(kit, team) {
  if (kit.shoes === 'white') return { upper: '#eeeeea', sole: '#d8d8d2', trim: team?.colors?.primary || '#222' };
  if (kit.shoes === 'team') {
    const c = lum(kit.jersey) > 0.8 ? (team?.colors?.primary || '#333') : kit.jersey;
    return { upper: c, sole: '#e6e6e0', trim: '#f4f4f4' };
  }
  return { upper: '#141416', sole: '#1c1c1e', trim: '#f2f2f2' };
}

// ------------------------------------------------------------------ painter

/**
 * Paint the atlas.
 *   o = { team, kit (object), player, look, landmarks: { vAtY, armV, legV }, ref (bool), helmetNumber (bool), shellColor }
 */
export function paintAtlas(canvas, o) {
  tiles();
  const ctx = canvas.getContext('2d');
  const { kit, player = {}, look = {}, landmarks: lm } = o;
  const team = o.team || {};
  const rng = makeRng(hashString((player.id || player.last || 'x') + ':' + (player.number ?? '')));
  const skin = look.skinHex || '#c08a63';
  const skinDark = shade(skin, -0.28), skinLight = shade(skin, 0.1);
  const num = String(player.number ?? '');
  ctx.save();
  ctx.fillStyle = '#808080';
  ctx.fillRect(0, 0, ATLAS, ATLAS);

  paintTorso(ctx, o, { kit, team, num, lm, rng, skin });
  paintArms(ctx, o, { kit, team, num, lm, rng, skin, skinDark, look });
  paintLegs(ctx, o, { kit, lm, skin, skinDark, look });
  paintHead(ctx, o, { skin, skinDark, skinLight, look, rng });
  paintHands(ctx, o, { kit, team, skin, skinDark, look });
  paintShoes(ctx, o, { kit, team, look });
  paintEyes(ctx, look);
  paintHair(ctx, look, rng);
  paintMisc(ctx, o, { kit, team, num });
  ctx.restore();
}

function paintTorso(ctx, o, { kit, team, num, lm, rng, skin }) {
  const T = R.TORSO;
  const v = lm.vAtY;
  const padded = !o.ref;
  clipRect(ctx, T);
  const vBeltLo = v(1.03), vBeltHi = v(1.064);
  // pants
  rectL(ctx, T, 0, 0, 1, vBeltLo + 0.01, kit.pants);
  texture(ctx, [T[0], T[1] + (1 - vBeltLo) * T[3], T[2], vBeltLo * T[3]], sheenTile, 0.35);
  // pant stripes at the hips (sides)
  pantStripesTorso(ctx, T, kit, vBeltLo);
  // jersey
  rectL(ctx, T, 0, vBeltHi - 0.005, 1, 1, kit.jersey);
  // side panels
  if (kit.sideColor) {
    for (const th of [90, -90]) {
      const u = torsoU(th);
      rectL(ctx, T, u - 0.03, vBeltHi, u + 0.03, v(1.4), kit.sideColor);
    }
  }
  const sc = kit.sleeveColors || [];
  // yoke / shoulder loops
  if (kit.sleeve === 'yoke' && sc[0]) {
    rectL(ctx, T, 0, v(1.47), 1, 1, sc[0]);
    if (sc[1]) rectL(ctx, T, 0, v(1.462), 1, v(1.47), sc[1]);
  }
  if (kit.sleeve === 'shoulder' && sc[0]) {
    // UCLA-style loops over each shoulder cap: bands in u around the shoulder, over the top
    for (const th of [90, -90]) {
      const u = torsoU(th);
      for (const [off, col] of [[0.045, sc[0]], [0.064, sc[1] || sc[0]]]) {
        rectL(ctx, T, u - off - 0.008, v(1.43), u - off + 0.008, 1, col);
        rectL(ctx, T, u + off - 0.008, v(1.43), u + off + 0.008, 1, col);
      }
    }
  }
  if (kit.sleeve === 'bolt' && sc[0]) {
    for (const th of [90, -90]) boltOnTorso(ctx, T, torsoU(th), v, sc[0], sc[1]);
  }
  // collar: band at the top + V-neck notch at the front
  const vCol = lm.vFromTop ? lm.vFromTop(padded ? 0.032 : 0.028) : v(1.577);
  rectL(ctx, T, 0, vCol, 1, 1, kit.collar || kit.jersey);
  {
    const uF = torsoU(0);
    const [cx, cyTop] = pxOf(T, uF, vCol);
    const [, cyBot] = pxOf(T, uF, v(padded ? 1.51 : 1.47));
    ctx.fillStyle = kit.collar || kit.jersey;
    ctx.beginPath();
    ctx.moveTo(cx - T[2] * 0.042, cyTop - 1);
    ctx.lineTo(cx, cyBot);
    ctx.lineTo(cx + T[2] * 0.042, cyTop - 1);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = shade(kit.collar || kit.jersey, -0.35);
    ctx.beginPath();
    ctx.moveTo(cx - T[2] * 0.028, cyTop - 1);
    ctx.lineTo(cx, cyBot - (cyBot - cyTop) * 0.28);
    ctx.lineTo(cx + T[2] * 0.028, cyTop - 1);
    ctx.closePath();
    ctx.fill();
  }
  // officials' stripes
  if (o.ref) {
    const n = 34;
    for (let i = 0; i < n; i++) if (i % 2 === 0) rectL(ctx, T, i / n, vBeltHi, (i + 1) / n, vCol, '#121212');
  }
  // fabric
  texture(ctx, [T[0], T[1], T[2], (1 - vBeltHi) * T[3]], fabricTile, 0.32);
  // baked shading: under the arms, under the pad edge, above the belt, collar
  shadeU(ctx, T, torsoU(90), 0.06, 0.2, vBeltHi, v(1.42));
  shadeU(ctx, T, torsoU(-90), 0.06, 0.2, vBeltHi, v(1.42));
  if (padded) shadeV(ctx, T, v(1.312), 0.025, 0.22);
  shadeV(ctx, T, vBeltHi + 0.006, 0.02, 0.25);
  shadeV(ctx, T, v(0.9), 0.04, 0.12);
  // belt
  rectL(ctx, T, 0, vBeltLo, 1, vBeltHi, '#121214');
  shadeV(ctx, T, (vBeltLo + vBeltHi) / 2, 0.012, 0.25, '255,255,255');
  // numbers
  if (!o.ref && num) {
    const font = kit.numberFont || 'block';
    const fill = kit.numbers, outline = kit.numberOutline;
    const pxPerM = T[2] / 1.25;      // ~ circumference of the chest
    const front = pxOf(T, torsoU(0), v(1.355));
    const [, fTop] = pxOf(T, 0, v(1.47)), [, fBot] = pxOf(T, 0, v(1.24));
    const fh = Math.min((fBot - fTop) * 0.98, 0.22 * pxPerM);
    drawNumber(ctx, num, front[0], front[1], fh, { style: font, fill, outline, ow: 0.075 });
    const back = pxOf(T, torsoU(180), v(1.3));
    const [, bTop] = pxOf(T, 0, v(1.43)), [, bBot] = pxOf(T, 0, v(1.17));
    const bh = Math.min((bBot - bTop) * 0.98, 0.26 * pxPerM);
    drawNumber(ctx, num, back[0], back[1], bh, { style: font, fill, outline, ow: 0.075 });
    // TV numbers on the shoulder tops (read from the side, upright toward the neck)
    if (padded) {
      const tvh = Math.max(9, (pxOf(T, 0, v(1.515))[1] - pxOf(T, 0, v(1.575))[1]) * 0.86);
      for (const th of [90, -90]) {
        const c = pxOf(T, torsoU(th), v(1.546));
        drawNumber(ctx, num, c[0], c[1], tvh, { style: font, fill, outline, ow: 0.08 });
      }
    }
    // name on the back
    if (kit.nameOnBack !== false && o.player?.last) {
      const name = o.player.last.toUpperCase();
      const c = pxOf(T, torsoU(180), v(padded ? 1.468 : 1.45));
      const nh = Math.max(8, fh * 0.26);
      const maxW = T[2] * 0.26;
      ctx.save();
      ctx.font = `bold ${nh * 1.32}px "Arial Narrow", "Roboto Condensed", Arial, "Helvetica Neue", "DejaVu Sans", sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      try { ctx.letterSpacing = `${Math.max(0.5, nh * 0.06)}px`; } catch { /* old canvas */ }
      const w = ctx.measureText(name).width;
      const sx = Math.min(1, maxW / Math.max(1, w));
      ctx.translate(c[0], c[1]);
      ctx.scale(sx * 0.92, 1);
      if (outline && font === 'college') {
        ctx.lineWidth = nh * 0.16;
        ctx.strokeStyle = outline;
        ctx.strokeText(name, 0, 0);
      }
      ctx.fillStyle = fill;
      ctx.fillText(name, 0, 0);
      ctx.restore();
    }
    // small team logo at the collar
    if (team.logo) {
      const c = pxOf(T, torsoU(0), v(padded ? 1.53 : 1.48));
      ctx.drawImage(logoCanvas(team, 64), c[0] - 6, c[1] - 6, 12, 12);
    }
  }
  ctx.restore();
}

function pantStripesTorso(ctx, T, kit, vTop) {
  const cols = kit.pantStripeColors || [];
  const style = kit.pantStripe;
  if (!style || style === 'none' || !cols.length) return;
  for (const th of [90, -90]) {
    const u = torsoU(th);
    stripeSet(ctx, T, u, 0, vTop, style, cols, 0.0105);
  }
}

/** Vertical stripes centred at u (region-local), widths in u units. */
function stripeSet(ctx, rect, u, v0, v1, style, cols, w) {
  if (style === 'single') rectL(ctx, rect, u - w, v0, u + w, v1, cols[0]);
  else if (style === 'double') {
    rectL(ctx, rect, u - w * 1.6, v0, u - w * 0.45, v1, cols[0]);
    rectL(ctx, rect, u + w * 0.45, v0, u + w * 1.6, v1, cols[0]);
    if (cols[1]) rectL(ctx, rect, u - w * 0.45, v0, u + w * 0.45, v1, cols[1]);
  } else if (style === 'triple') {
    rectL(ctx, rect, u - w * 1.9, v0, u + w * 1.9, v1, cols[1] || cols[0]);
    rectL(ctx, rect, u - w * 1.9, v0, u - w * 1.2, v1, cols[0]);
    rectL(ctx, rect, u - w * 0.4, v0, u + w * 0.4, v1, cols[2] || cols[0]);
    rectL(ctx, rect, u + w * 1.2, v0, u + w * 1.9, v1, cols[0]);
  } else if (style === 'bolt') {
    const [x, y, ww, h] = rect;
    ctx.fillStyle = cols[0];
    const segs = 6;
    ctx.beginPath();
    for (let i = 0; i <= segs; i++) {
      const vv = lerp(v1, v0, i / segs);
      const uu = u + (i % 2 ? w * 1.4 : -w * 1.4);
      ctx.lineTo(x + uu * ww - w * ww, y + (1 - vv) * h);
    }
    for (let i = segs; i >= 0; i--) {
      const vv = lerp(v1, v0, i / segs);
      const uu = u + (i % 2 ? w * 1.4 : -w * 1.4);
      ctx.lineTo(x + uu * ww + w * ww, y + (1 - vv) * h);
    }
    ctx.closePath();
    ctx.fill();
  }
}

function boltOnTorso(ctx, T, u, v, c0, c1) {
  const [x, y, w, h] = T;
  const P = (uu, yy) => [x + uu * w, y + (1 - v(yy)) * h];
  ctx.fillStyle = c0;
  ctx.beginPath();
  const pts = [[u - 0.06, 1.52], [u - 0.01, 1.48], [u - 0.025, 1.46], [u + 0.06, 1.42], [u + 0.012, 1.47], [u + 0.03, 1.49]];
  pts.forEach(([uu, yy], i) => { const p = P(uu, yy); if (i) ctx.lineTo(p[0], p[1]); else ctx.moveTo(p[0], p[1]); });
  ctx.closePath();
  ctx.fill();
  if (c1) { ctx.strokeStyle = c1; ctx.lineWidth = 1.5; ctx.stroke(); }
}

function sleeveTrim(ctx, A, kit, vEnd, vTop, mirror) {
  const sc = kit.sleeveColors || [];
  const style = kit.sleeve;
  const span = vTop - vEnd;
  if (style === 'stripes2' && sc.length) {
    rectL(ctx, A, 0, vEnd + span * 0.16, 1, vEnd + span * 0.25, sc[0]);
    rectL(ctx, A, 0, vEnd + span * 0.31, 1, vEnd + span * 0.4, sc[1] || sc[0]);
  } else if (style === 'stripes3' && sc.length) {
    rectL(ctx, A, 0, vEnd + span * 0.12, 1, vEnd + span * 0.19, sc[0]);
    rectL(ctx, A, 0, vEnd + span * 0.24, 1, vEnd + span * 0.31, sc[1] || sc[0]);
    rectL(ctx, A, 0, vEnd + span * 0.36, 1, vEnd + span * 0.43, sc[2] || sc[0]);
  } else if (style === 'cuff' && sc.length) {
    rectL(ctx, A, 0, vEnd, 1, vEnd + span * 0.2, sc[0]);
  } else if (style === 'bolt' && sc.length) {
    const [x, y, w, h] = A;
    ctx.fillStyle = sc[0];
    ctx.beginPath();
    const yy = (vv) => y + (1 - vv) * h;
    ctx.moveTo(x + w * 0.2, yy(vEnd + span * 0.9));
    ctx.lineTo(x + w * 0.55, yy(vEnd + span * 0.55));
    ctx.lineTo(x + w * 0.45, yy(vEnd + span * 0.5));
    ctx.lineTo(x + w * 0.8, yy(vEnd + span * 0.12));
    ctx.lineTo(x + w * 0.5, yy(vEnd + span * 0.42));
    ctx.lineTo(x + w * 0.6, yy(vEnd + span * 0.47));
    ctx.closePath();
    ctx.fill();
  } else if ((style === 'shoulder' || style === 'yoke') && sc.length) {
    rectL(ctx, A, 0, vEnd + span * 0.55, 1, vTop, sc[0]);
  }
  // hem
  rectL(ctx, A, 0, vEnd, 1, vEnd + span * 0.05, shade(kit.jersey, -0.2));
}

function paintArms(ctx, o, { kit, num, lm, rng, skin, skinDark, look }) {
  const av = lm.armV;
  const sleeves = look.sleeves || 'none';
  const sleeveCol = lum(kit.jersey) > 0.75 ? (o.team?.colors?.primary || '#222') : (rng() < 0.5 ? '#141414' : kit.jersey);
  for (const side of ['L', 'R']) {
    const A = side === 'L' ? R.ARM_L : R.ARM_R;
    clipRect(ctx, A);
    // skin everywhere first
    rectL(ctx, A, 0, 0, 1, 1, skin);
    texture(ctx, A, skinTile, 0.5);
    // muscle shading: inner arm darker, elbow crease
    shadeU(ctx, A, 0.0, 0.18, 0.18);
    shadeV(ctx, A, av(1.0), 0.02, 0.12);
    // compression sleeves
    const vSleeveEnd = o.ref ? av(0.55) : av(0.4);
    if (sleeves === 'long') rectL(ctx, A, 0, av(1.98), 1, vSleeveEnd + 0.01, sleeveCol);
    else if (sleeves === 'arm') rectL(ctx, A, 0, av(1.92), 1, av(0.55), sleeveCol);
    else if (sleeves === 'elbow') rectL(ctx, A, 0, av(1.28), 1, av(0.74), sleeveCol);
    if (sleeves !== 'none') texture(ctx, A, sheenTile, 0.25);
    // wristband / tape
    if (look.wristbands) rectL(ctx, A, 0, av(1.82), 1, av(1.95), side === 'L' ? '#f4f4f0' : (o.team?.colors?.secondary || '#f4f4f0'));
    if (look.armBand && side === 'R') rectL(ctx, A, 0, av(0.5), 1, av(0.58), '#f4f4f0');
    // jersey sleeve (the deltoid cap and the top of the upper arm)
    rectL(ctx, A, 0, vSleeveEnd, 1, 1, o.ref ? '#f2f2ee' : kit.jersey);
    if (o.ref) {
      for (let i = 0; i < 8; i++) if (i % 2 === 0) rectL(ctx, A, i / 8, vSleeveEnd, (i + 1) / 8, 1, '#121212');
      rectL(ctx, A, 0, vSleeveEnd, 1, vSleeveEnd + 0.012, '#121212');
    } else {
      sleeveTrim(ctx, A, kit, vSleeveEnd, av(0.02), side === 'R');
      texture(ctx, [A[0], A[1], A[2], (1 - vSleeveEnd) * A[3]], fabricTile, 0.3);
    }
    shadeV(ctx, A, vSleeveEnd - 0.01, 0.015, 0.2);
    ctx.restore();
  }
}

function paintLegs(ctx, o, { kit, lm, skin, skinDark, look }) {
  const L = R.LEG;
  const lv = lm.legV;
  clipRect(ctx, L);
  const vPantsEnd = lv(1.13);
  // skin base (knee gap for low socks), socks, pants
  rectL(ctx, L, 0, 0, 1, 1, skin);
  texture(ctx, L, skinTile, 0.4);
  const sockTop = look.socks === 'low' ? lv(1.5) : vPantsEnd + 0.01;
  rectL(ctx, L, 0, 0, 1, sockTop, kit.socks);
  texture(ctx, [L[0], L[1] + (1 - sockTop) * L[3], L[2], sockTop * L[3]], sheenTile, 0.3);
  // sock hoops near the top
  const hoops = kit.sockStripes || [];
  let hv = sockTop - 0.035;
  for (const c of hoops) {
    rectL(ctx, L, 0, hv - 0.022, 1, hv, c);
    hv -= 0.04;
  }
  // pants
  rectL(ctx, L, 0, vPantsEnd, 1, 1, kit.pants);
  texture(ctx, [L[0], L[1], L[2], (1 - vPantsEnd) * L[3]], sheenTile, 0.35);
  // pant stripe on the outer side (u = 0.5) down to the knee
  const cols = kit.pantStripeColors || [];
  if (kit.pantStripe && kit.pantStripe !== 'none' && cols.length) stripeSet(ctx, L, 0.5, lv(0.97), 1, kit.pantStripe, cols, 0.034);
  // hem + pad shading: knee pad, thigh pad outlines, inner leg
  rectL(ctx, L, 0, vPantsEnd, 1, vPantsEnd + 0.012, shade(kit.pants, -0.25));
  shadeU(ctx, L, 0.0, 0.16, 0.2, vPantsEnd, 1);
  shadeV(ctx, L, lv(1.0), 0.03, 0.08, '255,255,255');
  shadeV(ctx, L, lv(0.88), 0.012, 0.12);
  shadeV(ctx, L, lv(1.12), 0.012, 0.1);
  ctx.restore();
}

// ------------------------------------------------------------------ head / face

function hp(lam, phi) {
  return pxOf(R.HEAD, headU(lam), 0.1 + 0.9 * headV(phi));
}
// face landmarks in (λ, φ) degrees — must match body.js's head shape
export const FACE = {
  eye: [24.3, 4.6], brow: [23, 12.2], noseTip: [0, -12.5], mouth: [0, -28.7], chin: [0, -50],
};

function paintHead(ctx, o, { skin, skinDark, skinLight, look, rng }) {
  const H = R.HEAD;
  clipRect(ctx, H);
  rectL(ctx, H, 0, 0, 1, 1, skin);
  texture(ctx, H, skinTile, 0.55);
  const [x0, y0, W, Hh] = H;
  const P = hp;
  // soft facial shading (in pixel space around landmarks)
  const blob = (lam, phi, rx, ry, color, a) => {
    const [px, py] = P(lam, phi);
    ctx.save();
    ctx.translate(px, py);
    ctx.scale(rx, ry);
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
    g.addColorStop(0, `rgba(${color},${a})`);
    g.addColorStop(1, `rgba(${color},0)`);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, 1, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  };
  const sk = hexToRgb(skin).map((c) => Math.round(c * 255)).join(',');
  const dark = hexToRgb(skinDark).map((c) => Math.round(c * 255)).join(',');
  // eye sockets, under the brow, nose sides, under the nose and lip, cheek warmth, highlights
  for (const s of [1, -1]) {
    blob(s * 24, 5, 8, 5, dark, 0.26);
    blob(s * 22, 9.5, 9, 3, dark, 0.22);
    blob(s * 9, -7, 3.5, 8, dark, 0.2);
    blob(s * 36, -14, 11, 9, '190,80,70', 0.07);
    blob(s * 40, -3, 8, 6, '255,255,255', 0.05);
  }
  blob(0, -18, 6, 3, dark, 0.38);
  blob(0, -34.5, 8, 3, dark, 0.28);
  blob(0, -47, 15, 4, dark, 0.14);
  blob(0, 24, 26, 9, '255,255,255', 0.06);
  blob(0, -1, 2.5, 12, '255,255,255', 0.08);
  // lips
  {
    const [mx, my] = P(0, FACE.mouth[1]);
    const lipCol = mix(skin, '#7a3028', 0.32);
    ctx.fillStyle = lipCol;
    ctx.beginPath();
    ctx.ellipse(mx, my - 1.0, W * 0.038, Hh * 0.011, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(mx, my + 1.6, W * 0.034, Hh * 0.014, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = `rgba(${dark},0.95)`;
    ctx.lineWidth = 1.1;
    ctx.beginPath();
    ctx.moveTo(mx - W * 0.04, my + 0.4);
    ctx.quadraticCurveTo(mx, my + 1.0, mx + W * 0.04, my + 0.4);
    ctx.stroke();
  }
  // nostrils
  for (const s of [1, -1]) blob(s * 4.5, -16.5, 2.2, 1.6, '20,10,8', 0.55);
  // eyelids / lashes around the eyeballs, brows
  const brow = shade(look.hairColor || '#1b1612', -0.1);
  for (const s of [1, -1]) {
    const [ex, ey] = P(s * FACE.eye[0], FACE.eye[1]);
    ctx.strokeStyle = 'rgba(20,12,8,0.85)';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.ellipse(ex, ey, W * 0.045, Hh * 0.03, 0, Math.PI * 1.05, Math.PI * 1.95);
    ctx.stroke();
    ctx.strokeStyle = `rgba(${dark},0.6)`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.ellipse(ex, ey + 1, W * 0.04, Hh * 0.026, 0, Math.PI * 0.1, Math.PI * 0.9);
    ctx.stroke();
    // brow
    const [bx, by] = P(s * FACE.brow[0], FACE.brow[1]);
    ctx.strokeStyle = brow;
    ctx.lineCap = 'round';
    ctx.lineWidth = Hh * 0.024;
    ctx.beginPath();
    ctx.moveTo(bx - s * W * 0.05, by + 1.5);
    ctx.quadraticCurveTo(bx, by - 1.8, bx + s * W * 0.055, by + 1.0);
    ctx.stroke();
  }
  // eye black
  if (look.eyeBlack === 'stripe' || look.eyeBlack === 'sticker') {
    for (const s of [1, -1]) {
      const [ex, ey] = P(s * 25, -4);
      ctx.fillStyle = '#0c0c0e';
      if (look.eyeBlack === 'stripe') {
        ctx.save();
        ctx.translate(ex, ey);
        ctx.rotate(s * -0.08);
        ctx.fillRect(-W * 0.045, -Hh * 0.013, W * 0.09, Hh * 0.03);
        ctx.restore();
      } else {
        ctx.fillRect(ex - W * 0.04, ey - Hh * 0.016, W * 0.08, Hh * 0.036);
        ctx.fillStyle = 'rgba(255,255,255,0.35)';
        ctx.fillRect(ex - W * 0.03, ey - Hh * 0.006, W * 0.06, Hh * 0.01);
      }
    }
  }
  // beard
  const hc = look.hairColor || '#1b1612';
  const beard = look.beard || 'none';
  if (beard !== 'none') {
    ctx.save();
    const stub = beard === 'stubble';
    const col = stub ? `rgba(${hexToRgb(hc).map((c) => Math.round(c * 255)).join(',')},0.35)` : hc;
    ctx.fillStyle = col;
    const region = (pts) => {
      ctx.beginPath();
      pts.forEach(([l, p], i) => { const q = P(l, p); if (i) ctx.lineTo(q[0], q[1]); else ctx.moveTo(q[0], q[1]); });
      ctx.closePath();
      ctx.fill();
    };
    if (beard === 'full' || stub) {
      region([[-78, -2], [-60, -20], [-38, -30], [-22, -24], [0, -23], [22, -24], [38, -30], [60, -20], [78, -2], [88, -30], [60, -60], [0, -72], [-60, -60], [-88, -30]]);
    }
    if (beard === 'goatee' || beard === 'full') {
      region([[-15, -24], [0, -23], [15, -24], [17, -31], [10, -40], [12, -52], [0, -60], [-12, -52], [-10, -40], [-17, -31]]);
    }
    if (beard === 'chinstrap') {
      ctx.strokeStyle = hc;
      ctx.lineWidth = Hh * 0.03;
      ctx.beginPath();
      [[-80, -4], [-64, -36], [-36, -52], [0, -58], [36, -52], [64, -36], [80, -4]].forEach(([l, p], i) => { const q = P(l, p); if (i) ctx.lineTo(q[0], q[1]); else ctx.moveTo(q[0], q[1]); });
      ctx.stroke();
    }
    if (!stub) texture(ctx, H, fabricTile, 0.0);
    ctx.restore();
  }
  // scalp hair (for short styles this IS the hair; long styles get geometry on top)
  const hair = look.hair || 'short';
  if (hair !== 'bald') {
    const fade = hair === 'fade' || hair === 'mohawk';
    const a = hair === 'buzz' ? 0.7 : 1;
    ctx.save();
    ctx.globalAlpha = a;
    ctx.fillStyle = hc;
    // hairline polygon over the scalp (λ, φ)
    const line = [
      [-180, -40], [-150, -38], [-120, -22], [-100, -8], [-86, 2], [-78, -4], [-70, 12], [-52, 26], [-30, 34], [-12, 38], [0, 39],
      [12, 38], [30, 34], [52, 26], [70, 12], [78, -4], [86, 2], [100, -8], [120, -22], [150, -38], [180, -40], [180, 90], [-180, 90],
    ];
    ctx.beginPath();
    line.forEach(([l, p], i) => { const q = P(l, p); if (i) ctx.lineTo(q[0], q[1]); else ctx.moveTo(q[0], q[1]); });
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    if (fade) {
      // sides faded to skin
      for (const s of [1, -1]) {
        const [cx, cy] = P(s * 95, 0);
        const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, W * 0.2);
        g.addColorStop(0, skin);
        g.addColorStop(0.6, mix(skin, hc, 0.45));
        g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = g;
        ctx.fillRect(cx - W * 0.2, cy - W * 0.2, W * 0.4, W * 0.4);
      }
    }
    // texture strands
    ctx.save();
    ctx.globalCompositeOperation = 'source-atop';
    ctx.restore();
  }
  // neck strip (bottom 10%): plain skin with an Adam's apple shadow
  rectL(ctx, H, 0, 0, 1, 0.1, skin);
  shadeU(ctx, H, 0.5, 0.06, 0.12, 0.0, 0.1);
  ctx.restore();
}

function paintEyes(ctx, look) {
  const E = R.EYE;
  const [x, y, w, h] = E;
  ctx.save();
  ctx.fillStyle = '#d2cbbf';
  ctx.fillRect(x, y, w, h);
  const cx = x + w / 2, cy = y + h / 2;
  const g = ctx.createRadialGradient(cx, cy, w * 0.22, cx, cy, w * 0.5);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(1, 'rgba(90,50,40,0.45)');
  ctx.fillStyle = g;
  ctx.fillRect(x, y, w, h);
  const light = (look.skin ?? 0.5) < 0.25 && ['#b48c55', '#c9b28a', '#8a6a3d'].includes(look.hairColor);
  const iris = light ? '#3d5f72' : '#2c1a0f';
  ctx.fillStyle = iris;
  ctx.beginPath(); ctx.arc(cx, cy, w * 0.3, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = light ? '#5d8396' : '#4a2c18';
  ctx.beginPath(); ctx.arc(cx, cy + w * 0.04, w * 0.2, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#050303';
  ctx.beginPath(); ctx.arc(cx, cy, w * 0.12, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.beginPath(); ctx.arc(cx - w * 0.09, cy - h * 0.1, w * 0.05, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

function paintHair(ctx, look, rng) {
  const Hr = R.HAIR;
  const hc = look.hairColor || '#1b1612';
  ctx.save();
  ctx.fillStyle = hc;
  ctx.fillRect(Hr[0], Hr[1], Hr[2], Hr[3]);
  // strands / curls
  const light = shade(hc, 0.25), dark = shade(hc, -0.4);
  const curly = ['curly', 'twists', 'afro', 'dreads', 'braids'].includes(look.hair);
  for (let i = 0; i < 420; i++) {
    const px = Hr[0] + rng() * Hr[2], py = Hr[1] + rng() * Hr[3];
    ctx.strokeStyle = rng() < 0.5 ? light : dark;
    ctx.globalAlpha = 0.35;
    ctx.lineWidth = 1;
    ctx.beginPath();
    if (curly) ctx.arc(px, py, 1 + rng() * 1.6, 0, Math.PI * 2);
    else { ctx.moveTo(px, py); ctx.lineTo(px + (rng() - 0.5) * 2, py + 3 + rng() * 5); }
    ctx.stroke();
  }
  ctx.restore();
}

function paintHands(ctx, o, { kit, team, skin, skinDark, look }) {
  const Hd = R.HAND;
  clipRect(ctx, Hd);
  const gloved = look.gloves && !o.ref;
  if (gloved) {
    const gc = kit.gloves || '#222';
    const palm = lum(gc) > 0.7 ? '#cfcfc8' : mix(gc, '#9a9a96', 0.35);
    rectL(ctx, Hd, 0, 0, 1, 1, gc);
    // palm side (seam at the palm: u near 0 and 0.78), thumb inner side
    rectL(ctx, Hd, 0, 0, 0.1, 0.86, palm);
    rectL(ctx, Hd, 0.68, 0, 0.78, 0.86, palm);
    rectL(ctx, Hd, 0.8, 0, 0.88, 1, palm);
    // cuff band and a logo patch on the back of the hand
    rectL(ctx, Hd, 0, 0.84, 0.78, 1, shade(gc, -0.25));
    rectL(ctx, Hd, 0, 0.86, 0.78, 0.9, team?.colors?.secondary || '#888');
    const [lx, ly] = pxOf(Hd, 0.39, 0.62);
    ctx.fillStyle = lum(gc) > 0.6 ? (team?.colors?.primary || '#333') : '#e8e8e8';
    ctx.beginPath(); ctx.arc(lx, ly, 3.5, 0, Math.PI * 2); ctx.fill();
    // finger seams
    ctx.strokeStyle = shade(gc, -0.35);
    ctx.lineWidth = 1;
    for (const u of [0.3, 0.39, 0.48]) {
      const [a, b] = pxOf(Hd, u, 0.4), [, c] = pxOf(Hd, u, 0.0);
      ctx.beginPath(); ctx.moveTo(a, b); ctx.lineTo(a, c); ctx.stroke();
    }
    texture(ctx, Hd, sheenTile, 0.3);
  } else {
    rectL(ctx, Hd, 0, 0, 1, 1, skin);
    texture(ctx, Hd, skinTile, 0.5);
    rectL(ctx, Hd, 0, 0, 0.1, 0.84, mix(skin, '#e8c0b0', 0.25));
    rectL(ctx, Hd, 0.68, 0, 0.78, 0.84, mix(skin, '#e8c0b0', 0.25));
    // wrist tape
    rectL(ctx, Hd, 0, 0.8, 0.78, 1, '#f2f2ee');
    ctx.strokeStyle = `rgba(0,0,0,0.25)`;
    for (const u of [0.3, 0.39, 0.48]) {
      const [a, b] = pxOf(Hd, u, 0.4), [, c] = pxOf(Hd, u, 0.0);
      ctx.beginPath(); ctx.moveTo(a, b); ctx.lineTo(a, c); ctx.stroke();
    }
  }
  ctx.restore();
}

function paintShoes(ctx, o, { kit, team, look }) {
  const S = R.SHOE;
  clipRect(ctx, S);
  const c = shoeColors(o.ref ? REF_KIT : kit, team);
  rectL(ctx, S, 0, 0, 1, 1, c.upper);
  // sole: the bottom half around θ = 180 (u 0.62 … 0.88)
  rectL(ctx, S, 0.6, 0, 0.9, 1, c.sole);
  rectL(ctx, S, 0.59, 0, 0.61, 1, shade(c.sole, -0.3));
  rectL(ctx, S, 0.89, 0, 0.91, 1, shade(c.sole, -0.3));
  // side stripe (outside u≈0.5 and inside u≈0/1)
  for (const u of [0.47, 0.03]) {
    ctx.fillStyle = c.trim;
    const [ax, ay] = pxOf(S, u - 0.05, 0.15), [bx, by] = pxOf(S, u + 0.04, 0.72);
    ctx.beginPath();
    ctx.moveTo(ax, ay); ctx.lineTo(ax + 4, ay); ctx.lineTo(bx + 3, by); ctx.lineTo(bx - 1, by);
    ctx.closePath();
    ctx.fill();
  }
  // laces on top (u 0.25) over the instep
  rectL(ctx, S, 0.21, 0.42, 0.29, 0.66, shade(c.upper, lum(c.upper) > 0.5 ? -0.15 : 0.35));
  ctx.strokeStyle = lum(c.upper) > 0.5 ? '#bbbbb5' : '#e8e8e8';
  ctx.lineWidth = 1;
  for (let i = 0; i < 5; i++) {
    const [a, b] = pxOf(S, 0.21, 0.44 + i * 0.045), [cc] = pxOf(S, 0.29, 0.44 + i * 0.045);
    ctx.beginPath(); ctx.moveTo(a, b); ctx.lineTo(cc, b); ctx.stroke();
  }
  // high tops: white spat tape over the ankle
  if (look.shoes === 'high') rectL(ctx, S, 0, 0.08, 0.6, 0.45, '#f0f0ec');
  ctx.restore();
}

function paintMisc(ctx, o, { kit, team, num }) {
  const M = R.MISC;
  clipRect(ctx, M);
  const sw = (name, col) => {
    const [u, v] = SWATCH[name];
    rectL(ctx, M, u - 0.16, v - 0.24, u + 0.16, v + 0.24, col);
  };
  sw('towel', '#f6f6f2');
  sw('neckRoll', o.ref ? '#111' : kit.jersey);
  sw('warmer', o.team?.colors?.primary || '#222');
  sw('whistle', '#101012');
  sw('lanyard', '#101012');
  sw('tape', '#f2f2ee');
  ctx.restore();
  // helmet back number (decal on the back of the shell)
  if (o.helmetNumber && num) {
    const Hn = R.HNUM;
    clipRect(ctx, Hn);
    ctx.fillStyle = o.shellColor || '#ffffff';
    ctx.fillRect(Hn[0], Hn[1], Hn[2], Hn[3]);
    const st = o.team?.helmet?.stripeColors || [];
    const col = lum(o.shellColor || '#fff') > 0.6 ? (st[0] || '#111') : '#f4f4f4';
    drawNumber(ctx, num, Hn[0] + Hn[2] / 2, Hn[1] + Hn[3] / 2, Hn[3] * 0.7, { style: kit.numberFont, fill: col, outline: null });
    ctx.restore();
  }
  // officials' cap and flag
  const C = R.CAP;
  clipRect(ctx, C);
  ctx.fillStyle = o.capColor || '#f4f4f2';
  ctx.fillRect(C[0], C[1], C[2] * 0.7, C[3]);
  ctx.fillStyle = '#ffd21a';
  ctx.fillRect(C[0] + C[2] * 0.72, C[1], C[2] * 0.28, C[3]);
  ctx.restore();
}

// ------------------------------------------------------------------ shared masks

let roughTex = null, dirtTex = null;

/** Shared roughness map (G channel) in the atlas layout: skin, fabric, pants, shoes, gloves. */
export function roughnessTexture() {
  if (roughTex) return roughTex;
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const x = c.getContext('2d');
  const k = 128 / ATLAS;
  const put = (rect, r) => { x.fillStyle = `rgb(0,${Math.round(r * 255)},0)`; x.fillRect(rect[0] * k, rect[1] * k, rect[2] * k, rect[3] * k); };
  x.fillStyle = 'rgb(0,200,0)'; x.fillRect(0, 0, 128, 128);
  put(R.TORSO, 0.82); put(R.LEG, 0.62); put(R.HEAD, 0.55); put(R.ARM_L, 0.6); put(R.ARM_R, 0.6);
  put(R.HAND, 0.58); put(R.SHOE, 0.42); put(R.HAIR, 0.75); put(R.EYE, 0.15); put(R.HNUM, 0.3); put(R.MISC, 0.8); put(R.CAP, 0.8);
  roughTex = new THREE.CanvasTexture(c);
  roughTex.colorSpace = THREE.NoColorSpace;
  roughTex.userData.keep = true;
  return roughTex;
}

/**
 * Shared dirt mask in the atlas layout: R = grass stains, G = mud, B = threshold noise
 * (stains appear where noise < dirt level, so they grow through a game).
 */
export function dirtTexture() {
  if (dirtTex) return dirtTex;
  const S = 256, k = S / ATLAS;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const x = c.getContext('2d');
  x.fillStyle = '#000000';
  x.fillRect(0, 0, S, S);
  const rng = makeRng(99);
  const splat = (rect, u, v, ru, rv, ch, a = 1, n = 7) => {
    const [px, py] = pxOf(rect, u, v);
    for (let i = 0; i < n; i++) {
      const ox = (rng() - 0.5) * ru * rect[2] * 1.4, oy = (rng() - 0.5) * rv * rect[3] * 1.4;
      const r = (0.4 + rng() * 0.6) * Math.max(ru * rect[2], rv * rect[3]) * k;
      const g = x.createRadialGradient((px + ox) * k, (py + oy) * k, 0, (px + ox) * k, (py + oy) * k, r);
      g.addColorStop(0, `rgba(${ch === 'r' ? 255 : 0},${ch === 'g' ? 255 : 0},0,${a * (0.5 + rng() * 0.5)})`);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      x.fillStyle = g;
      x.globalCompositeOperation = 'lighter';
      x.fillRect((px + ox) * k - r, (py + oy) * k - r, r * 2, r * 2);
    }
    x.globalCompositeOperation = 'source-over';
  };
  // knees (front of the leg, u 0.25) and shins, thighs
  splat(R.LEG, 0.25, 0.47, 0.12, 0.08, 'r', 1, 9);
  splat(R.LEG, 0.25, 0.47, 0.1, 0.06, 'g', 0.9, 6);
  splat(R.LEG, 0.3, 0.7, 0.14, 0.1, 'r', 0.5, 6);
  splat(R.LEG, 0.35, 0.25, 0.12, 0.14, 'g', 0.6, 6);
  splat(R.LEG, 0.6, 0.85, 0.12, 0.1, 'r', 0.5, 5);
  // back of the jersey + seat of the pants, chest front, sides
  splat(R.TORSO, 0.875, 0.55, 0.12, 0.25, 'r', 0.6, 10);
  splat(R.TORSO, 0.875, 0.15, 0.1, 0.12, 'g', 0.8, 8);
  splat(R.TORSO, 0.375, 0.35, 0.1, 0.12, 'r', 0.5, 6);
  splat(R.TORSO, 0.375, 0.2, 0.12, 0.1, 'g', 0.6, 5);
  splat(R.TORSO, 0.6, 0.3, 0.06, 0.2, 'r', 0.4, 5);
  // elbows (back of the arm at the elbow) and forearms
  for (const A of [R.ARM_L, R.ARM_R]) {
    splat(A, 0.75, 0.48, 0.2, 0.07, 'r', 0.9, 6);
    splat(A, 0.7, 0.4, 0.2, 0.08, 'g', 0.6, 5);
  }
  splat(R.SHOE, 0.5, 0.5, 0.5, 0.5, 'g', 0.8, 10);
  splat(R.HAND, 0.4, 0.5, 0.5, 0.5, 'g', 0.4, 6);
  // threshold noise in B
  const img = x.getImageData(0, 0, S, S);
  for (let i = 0; i < S * S; i++) {
    const px = i % S, py = (i / S) | 0;
    const n = 0.5 + 0.25 * Math.sin(px * 0.31 + Math.sin(py * 0.21) * 2) * Math.cos(py * 0.27 + px * 0.05) + (rng() - 0.5) * 0.35;
    img.data[i * 4 + 2] = clamp(Math.round(n * 255), 0, 255);
    img.data[i * 4 + 3] = 255;
  }
  x.putImageData(img, 0, 0);
  dirtTex = new THREE.CanvasTexture(c);
  dirtTex.colorSpace = THREE.NoColorSpace;
  dirtTex.userData.keep = true;
  return dirtTex;
}

export { shoeColors, lum };
