// Paints a player's 512² uniform atlas: jersey (front/back numbers with
// outlines, TV numbers on the shoulders, name on the back, sleeve trim,
// collar, side panels, yoke), pants with stripes and belt, socks with hoops,
// skin (arms, neck, face with eyes / brows / eye black / beard, scalp hair),
// gloves, cleats, eyes, hair and the small props. Regions come from layout.js.
import * as THREE from 'three';
import { R, SWATCH, ATLAS_W, ATLAS_H, SLEEVE_HEM, HAND_U, FACE_LAM, FACE_PHI, pxOf, torsoU, headU, headV, headLam, headPhi } from './layout.js';
import { eyeContours } from './body.js';
import { drawNumber, numberWidth } from './numfont.js';
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
 * A skin tone as an albedo: the palette's palest tones are swatches, far brighter than skin
 * reflects, and under stadium light they bleach to white. Compress the top of the range
 * (keeping the hue, a little warmer) so fair skin stays skin.
 */
export function skinAlbedo(hex) {
  const [r, g, b] = hexToRgb(hex);
  const L = (0.299 * r + 0.587 * g + 0.114 * b) * 255;
  if (L <= 138) return hex;
  const k = (138 + (L - 138) * 0.42) / L;
  return rgbToHex(Math.min(1, r * k * 1.03), g * k, b * k * 0.97);
}

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
  const skin = skinAlbedo(look.skinHex || '#c08a63');
  const skinDark = shade(skin, -0.28);
  const num = String(player.number ?? '');
  ctx.save();
  ctx.fillStyle = '#808080';
  ctx.fillRect(0, 0, ATLAS_W, ATLAS_H);

  paintTorso(ctx, o, { kit, team, num, lm, rng, skin });
  paintArms(ctx, o, { kit, team, num, lm, rng, skin, skinDark, look });
  paintLegs(ctx, o, { kit, lm, skin, skinDark, look });
  paintHead(ctx, o, { skin, look });
  paintFace(ctx, o, { skin, look, rng });
  paintHands(ctx, o, { kit, team, skin, skinDark, look });
  paintShoes(ctx, o, { kit, team, look });
  paintEyes(ctx, look, rng);
  paintHair(ctx, look, rng);
  paintMisc(ctx, o, { kit, team, num });
  ctx.restore();
  // pad every region with its own edge pixels, so filtering and mipmaps at a wrap seam (the
  // back of the head, the hair) never pull in the grey between regions
  for (const rect of Object.values(R)) bleed(ctx, canvas, rect, 2);
}

/** Copy a region's outermost pixels outward by n. */
function bleed(ctx, canvas, [x, y, w, h], n) {
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(canvas, x, y, 1, h, x - n, y, n, h);
  ctx.drawImage(canvas, x + w - 1, y, 1, h, x + w, y, n, h);
  ctx.drawImage(canvas, x - n, y, w + 2 * n, 1, x - n, y - n, w + 2 * n, n);
  ctx.drawImage(canvas, x - n, y + h - 1, w + 2 * n, 1, x - n, y + h, w + 2 * n, n);
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
  // collar: a band at the top (the geometry dips it into the V at the front, so the trim
  // follows the V by itself)
  const vCol = lm.vFromTop ? lm.vFromTop(padded ? 0.032 : 0.03) : v(1.577);   // includes the 6 mm skirt
  rectL(ctx, T, 0, vCol, 1, 1, kit.collar || kit.jersey);
  // the inside of the collar (the skirt that turns in under the neck)
  if (lm.vFromTop) rectL(ctx, T, 0, lm.vFromTop(0.0032), 1, 1, shade(kit.collar || kit.jersey, -0.72));
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
    drawNumber(ctx, num, front[0], front[1], fh, { style: font, fill, outline, ow: 0.05 });
    const back = pxOf(T, torsoU(180), v(1.3));
    const [, bTop] = pxOf(T, 0, v(1.43)), [, bBot] = pxOf(T, 0, v(1.17));
    const bh = Math.min((bBot - bTop) * 0.98, 0.26 * pxPerM);
    drawNumber(ctx, num, back[0], back[1], bh, { style: font, fill, outline, ow: 0.05 });
    // TV numbers on the shoulder tops (read from the side, upright toward the neck)
    if (padded) {
      const tvh = Math.max(9, (pxOf(T, 0, v(1.515))[1] - pxOf(T, 0, v(1.575))[1]) * 0.86);
      for (const th of [90, -90]) {
        const c = pxOf(T, torsoU(th), v(1.546));
        drawNumber(ctx, num, c[0], c[1], tvh, { style: font, fill, outline, ow: 0.065 });
      }
    }
    // name on the back
    if (kit.nameOnBack !== false && o.player?.last) {
      const name = o.player.last.toUpperCase();
      const c = pxOf(T, torsoU(180), v(padded ? 1.468 : 1.45));
      const nh = Math.max(8, fh * 0.26);
      const maxW = T[2] * 0.2;           // the back curves away beyond ~a fifth of the chest round
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
  }
  // officials: position letter on a white panel between the shoulder blades
  if (o.ref && o.refLetter) {
    const c = pxOf(T, torsoU(180), v(1.345));
    const [, top] = pxOf(T, 0, v(1.45)), [, bot] = pxOf(T, 0, v(1.24));
    const h = bot - top;
    ctx.fillStyle = '#121212';
    ctx.fillRect(c[0] - h * 0.5 - 1, top - 1, h + 2, h + 2);
    ctx.fillStyle = '#f2f2ee';
    ctx.fillRect(c[0] - h * 0.5, top, h, h);
    ctx.font = `900 ${Math.round(h * 0.96)}px "Arial Black", "Helvetica Neue", Arial, "DejaVu Sans", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#121212';
    ctx.fillText(o.refLetter, c[0], c[1] + h * 0.04);
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
    // the jersey sleeve ends at the hem the geometry steps down at
    const vSleeveEnd = av(SLEEVE_HEM);
    if (sleeves === 'long') rectL(ctx, A, 0, av(1.98), 1, vSleeveEnd + 0.01, sleeveCol);
    else if (sleeves === 'arm') rectL(ctx, A, 0, av(1.92), 1, av(0.55), sleeveCol);
    else if (sleeves === 'elbow') rectL(ctx, A, 0, av(1.28), 1, av(0.74), sleeveCol);
    if (sleeves !== 'none') texture(ctx, A, sheenTile, 0.25);
    // wristband / tape
    if (look.wristbands) rectL(ctx, A, 0, av(1.82), 1, av(1.95), side === 'L' ? '#f4f4f0' : (o.team?.colors?.secondary || '#f4f4f0'));
    if (look.armBand && side === 'R') rectL(ctx, A, 0, av(0.62), 1, av(0.7), '#f4f4f0');
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
  eye: [24.3, 4.6], brow: [23, 12.2], noseTip: [0, -16.3], noseBase: [0, -21.1], mouth: [0, -32.3], chin: [0, -57],
  mouthCorner: [23.7, -32.3], wing: [9.1, -18.4], cheek: [37, -3.4],
};
// the lower face's (λ, φ) outlines (beards) were drawn for a shorter face: stretch them down to it
const lf = (phi) => (phi < -8 ? -8 + (phi + 8) * 1.12 : phi);

// The skin's mottling: 3D value noise on the head's directions, so the head and the face
// textures (and the head's back seam) all agree. Computed once, shared by every player.
function hash3(i, j, k) {
  let h = (i * 374761393 + j * 668265263 + k * 1440662683) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
function vnoise3(x, y, z) {
  const i = Math.floor(x), j = Math.floor(y), k = Math.floor(z);
  const fx = x - i, fy = y - j, fz = z - k;
  const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy), sz = fz * fz * (3 - 2 * fz);
  const l = (a, b, t) => a + (b - a) * t;
  return l(
    l(l(hash3(i, j, k), hash3(i + 1, j, k), sx), l(hash3(i, j + 1, k), hash3(i + 1, j + 1, k), sx), sy),
    l(l(hash3(i, j, k + 1), hash3(i + 1, j, k + 1), sx), l(hash3(i, j + 1, k + 1), hash3(i + 1, j + 1, k + 1), sx), sy),
    sz,
  );
}
function skinNoiseAt(lam, phi) {
  const la = lam * Math.PI / 180, ph = phi * Math.PI / 180;
  const x = Math.cos(ph) * Math.sin(la), y = Math.sin(ph), z = Math.cos(ph) * Math.cos(la);
  return (vnoise3(x * 8, y * 8, z * 8) - 0.5) * 0.55 + (vnoise3(x * 24 + 5, y * 24, z * 24) - 0.5) * 0.35 + (vnoise3(x * 70, y * 70 + 3, z * 70) - 0.5) * 0.3;
}
// per region: for every pixel its (λ, φ) and the noise there
let skinFields = null;
function skinField(rect, toLP) {
  const [, , w, h] = rect;
  const lam = new Float32Array(w * h), phi = new Float32Array(w * h), n = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const [l, p] = toLP((x + 0.5) / w, 1 - (y + 0.5) / h);
      lam[i] = l; phi[i] = p;
      n[i] = skinNoiseAt(l, p);
    }
  }
  return { lam, phi, n };
}
function fields() {
  if (skinFields) return skinFields;
  skinFields = {
    // the head region: v 0 … 0.1 is the neck strip, then headV over the rest
    head: skinField(R.HEAD, (u, v) => (v < 0.1 ? [headLam(u), -90 - (0.1 - v) * 60] : [headLam(u), headPhi((v - 0.1) / 0.9)])),
    face: skinField(R.FACE, (u, v) => [-FACE_LAM + u * 2 * FACE_LAM, FACE_PHI[0] + v * (FACE_PHI[1] - FACE_PHI[0])]),
  };
  return skinFields;
}

const gauss2 = (dl, dp, rl, rp) => Math.exp(-((dl / rl) ** 2) - ((dp / rp) ** 2));
/**
 * The skin itself, pixel by pixel: the player's tone, mottled, warmer over the cheeks, nose
 * and ears, lighter across the forehead, shadowed under the eyes, and the beard's shadow
 * across the jaw and the upper lip (heavier with stubble).
 */
function paintSkin(ctx, rect, F, skin, look) {
  const [x0, y0, w, h] = rect;
  const img = ctx.createImageData(w, h);
  const [sr, sg, sb] = hexToRgb(skin).map((c) => c * 255);
  const L = 0.299 * sr + 0.587 * sg + 0.114 * sb;          // 0 … 255
  const light = clamp((L - 60) / 150, 0, 1);              // 1 pale … 0 very dark
  const beard = look.beard || 'none';
  const shadowAmt = beard === 'stubble' ? 0.16 : beard === 'none' ? 0.05 : 0.08;
  const D = F.lam.length;
  for (let i = 0; i < D; i++) {
    const l = F.lam[i], p = F.phi[i], al = Math.abs(l);
    let r = sr, g = sg, b = sb;
    // mottling
    const m = 1 + F.n[i] * (0.09 + 0.05 * light);
    r *= m; g *= m; b *= m;
    // warmth: cheeks, nose, ears (more visible on lighter skin)
    const warm = (0.55 * gauss2(al - 36, p + 14, 15, 11) + 0.4 * gauss2(l, p + 15, 6, 9) + 0.5 * gauss2(al - 90, p + 3, 9, 13)) * (0.25 + 0.75 * light);
    r += warm * 22; g -= warm * 8; b -= warm * 6;
    // forehead a touch lighter, temples and under the eyes a touch darker
    const fore = gauss2(l, p - 30, 38, 13);
    r += fore * 7; g += fore * 6; b += fore * 3;
    const under = gauss2(al - 24, p + 3.5, 8.5, 3.2) * 0.07 + gauss2(al - 68, p - 8, 14, 14) * 0.05;
    r *= 1 - under; g *= 1 - under * 1.1; b *= 1 - under * 0.8;
    // the beard's shadow: jaw, chin and upper lip, cooler on pale skin
    if (p < -4) {
      // below a line from the sideburns (±80°, −4°) down to the mouth's corners (±26°, −30°)
      const edge = -4 - (80 - Math.min(80, Math.max(26, al))) * (26 / 54);
      const jaw = sstepA(edge, edge - 7, p) * (1 - sstepA(82, 94, al)) * (1 - 0.8 * gauss2(l, p + 32, 22, 4.5)) * (1 - gauss2(l, p + 18, 12, 7));
      const lip = gauss2(l, p + 27, 17, 3.2);
      const k = shadowAmt * Math.max(jaw, lip * 0.9);
      r *= 1 - k * 1.15; g *= 1 - k * 1.0; b *= 1 - k * (0.75 - 0.25 * light);
    }
    const o = i * 4;
    img.data[o] = clamp(r, 0, 255); img.data[o + 1] = clamp(g, 0, 255); img.data[o + 2] = clamp(b, 0, 255); img.data[o + 3] = 255;
  }
  ctx.putImageData(img, x0, y0);
}
const sstepA = (a, b, v) => { const t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

/** The scalp's hairline (λ, φ), shared by the head and the face textures. */
const HAIRLINE = [
  [-180, -40], [-150, -38], [-120, -22], [-100, -8], [-86, 2], [-78, -4], [-70, 12], [-52, 26], [-30, 34], [-12, 38], [0, 39],
  [12, 38], [30, 34], [52, 26], [70, 12], [78, -4], [86, 2], [100, -8], [120, -22], [150, -38], [180, -40], [180, 90], [-180, 90],
];
/** A (λ, φ) polygon, its edges cut into short steps (so a non-linear mapping bends them right). */
function lpPath(ctx, pts, map, step = 2) {
  ctx.beginPath();
  for (let i = 0; i < pts.length; i++) {
    const [l0, p0] = pts[i], [l1, p1] = pts[(i + 1) % pts.length];
    const n = Math.max(1, Math.ceil(Math.hypot(l1 - l0, p1 - p0) / step));
    for (let k = 0; k < n; k++) {
      const [x, y] = map(l0 + ((l1 - l0) * k) / n, p0 + ((p1 - p0) * k) / n);
      if (i === 0 && k === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
  }
  ctx.closePath();
}
function paintScalpHair(ctx, look, map) {
  const hair = look.hair || 'short';
  if (hair === 'bald') return;
  const hc = look.hairColor || '#1b1612';
  ctx.save();
  ctx.globalAlpha = hair === 'buzz' ? 0.7 : 1;
  ctx.fillStyle = hc;
  ctx.filter = 'blur(0.7px)';
  lpPath(ctx, HAIRLINE, map);
  ctx.fill();
  ctx.restore();
}

/** The head region: skin, the scalp's hair, the ears' colours, the neck strip. */
function paintHead(ctx, o, { skin, look }) {
  const H = R.HEAD;
  clipRect(ctx, H);
  paintSkin(ctx, H, fields().head, skin, look);
  const [, , W] = H;
  const sk = hexToRgb(skin).map((c) => Math.round(c * 255));
  const dark = sk.map((c) => Math.round(c * 0.62)).join(',');
  // the ears (body.js maps them round (±86°, −3°), where the face patch hides the head): the rim
  // catches the light, the bowl and the canal go dark, a little redder
  for (const s of [1, -1]) {
    for (const [l, p, rx, ry, col, a] of [[86, -2, 6.5, 6.5, dark, 0.35], [86, 0, 3, 3.6, '40,18,14', 0.45], [87, -1, 1.4, 1.8, '15,6,5', 0.7]]) {
      const [cx, cy] = hp(s * l, p);
      const rr = Math.max(1, rx * W * 1.55 / 360);
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, rr * 1.6);
      g.addColorStop(0, `rgba(${col},${a})`);
      g.addColorStop(1, `rgba(${col},0)`);
      ctx.fillStyle = g;
      ctx.fillRect(cx - rr * 1.6, cy - rr * 2.2, rr * 3.2, rr * 4.4);
    }
  }
  paintScalpHair(ctx, look, hp);
  if (look.hair === 'fade' || look.hair === 'mohawk') {
    // sides faded to skin
    const hc = look.hairColor || '#1b1612';
    for (const s of [1, -1]) {
      const [cx, cy] = hp(s * 105, 0);
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, W * 0.2);
      g.addColorStop(0, skin);
      g.addColorStop(0.6, mix(skin, hc, 0.45));
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.fillRect(cx - W * 0.2, cy - W * 0.2, W * 0.4, W * 0.4);
    }
  }
  // neck strip (bottom 10%): in the jaw's shadow at the top, an Adam's apple shadow
  {
    const [x0, y0, w, h] = H;
    // (the neck shows below the jaw over v 0 … ~0.056 of it; the rest is inside the head)
    const g = ctx.createLinearGradient(0, y0 + h * 0.935, 0, y0 + h * 0.98);
    g.addColorStop(0, `rgba(${dark},0.42)`);
    g.addColorStop(1, `rgba(${dark},0)`);
    ctx.fillStyle = g;
    ctx.fillRect(x0, y0 + h * 0.9, w, h * 0.08);
  }
  shadeU(ctx, H, 0.5, 0.06, 0.12, 0.0, 0.1);
  ctx.restore();
}

/**
 * The face up close (R.FACE, drawn in (λ, φ) degrees): eyes and lids traced on the lids the
 * geometry builds, brows hair by hair, the nose and mouth shaded to the head's shape, lips,
 * facial hair stroke by stroke, eye black, the hairline.
 */
function paintFace(ctx, o, { skin, look, rng }) {
  const Fr = R.FACE;
  clipRect(ctx, Fr);
  paintSkin(ctx, Fr, fields().face, skin, look);
  // degrees → pixels: λ −FACE_LAM … FACE_LAM across, φ FACE_PHI[1] at the top … FACE_PHI[0]
  const sx = Fr[2] / (2 * FACE_LAM), sy = Fr[3] / (FACE_PHI[1] - FACE_PHI[0]);
  ctx.setTransform(sx, 0, 0, -sy, Fr[0] + FACE_LAM * sx, Fr[1] + FACE_PHI[1] * sy);
  const F = o.look?.face || null;
  const [sr, sg, sb] = hexToRgb(skin).map((c) => Math.round(c * 255));
  const L = 0.299 * sr + 0.587 * sg + 0.114 * sb;
  const light = clamp((L - 60) / 150, 0, 1);
  const rgb = (f) => [sr, sg, sb].map((c) => Math.round(c * f)).join(',');
  const dark = rgb(0.6), deep = rgb(0.38);
  const blob = (l, p, rl, rp, col, a) => {
    ctx.save();
    ctx.translate(l, p);
    ctx.scale(rl, rp);
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
    g.addColorStop(0, `rgba(${col},${a})`);
    g.addColorStop(1, `rgba(${col},0)`);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, 1, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  };
  const poly = (pts, close = false) => {
    ctx.beginPath();
    pts.forEach(([l, p], i) => (i ? ctx.lineTo(l, p) : ctx.moveTo(l, p)));
    if (close) ctx.closePath();
  };
  const smooth = (pts) => {
    // a Catmull-Rom curve through the points, as quadratic pieces
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length - 1; i++) {
      const mx = (pts[i][0] + pts[i + 1][0]) / 2, my = (pts[i][1] + pts[i + 1][1]) / 2;
      ctx.quadraticCurveTo(pts[i][0], pts[i][1], mx, my);
    }
    const e = pts[pts.length - 1];
    ctx.lineTo(e[0], e[1]);
  };
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // ---- shading to the shape: sockets under the brow, the nose's sides and the shadow beneath
  // it, the hollows under the cheekbones, the jaw's underside; light on the brow bone, the
  // bridge and tip of the nose, the cheekbones, the chin
  for (const s of [1, -1]) {
    blob(s * 21, 8.5, 10, 4.2, dark, 0.3);         // under the brow, into the socket
    blob(s * 13.5, 5, 4.5, 4.5, deep, 0.22);      // the inner corner, beside the bridge
    blob(s * 7, -6, 3.2, 11, dark, 0.2);           // the nose's side
    blob(s * 10.5, -18.5, 3.8, 3.2, dark, 0.3);   // round the wing
    blob(s * 40, -22, 10, 8, dark, 0.1);           // under the cheekbone
    blob(s * 36, -2, 10, 6, '255,255,255', 0.07);  // the cheekbone
    blob(s * 22, 16.5, 11, 3.2, '255,255,255', 0.05);
    blob(s * 60, -52, 20, 14, dark, 0.14);         // the jaw's underside
    blob(s * 18, -40, 7, 6, dark, 0.07);           // beside the chin
  }
  blob(0, -2, 2.8, 12, '255,255,255', 0.08);       // the bridge
  blob(0, -15.6, 3.6, 2.8, '255,255,255', 0.12);   // the tip
  blob(0, -21.6, 7.5, 2.2, deep, 0.45);            // under the nose
  blob(0, -55, 11, 5, '255,255,255', 0.06);        // the chin
  blob(0, -63, 24, 6, dark, 0.14);
  blob(0, 22, 26, 8, '255,255,255', 0.05);         // the forehead

  // ---- nose: the creases round the wings, the nostrils, the philtrum below
  ctx.strokeStyle = `rgba(${deep},0.32)`;
  ctx.lineWidth = 0.9;
  for (const s of [1, -1]) {
    ctx.filter = 'blur(0.6px)';
    smooth([[s * 6.5, -14.5], [s * 12.2, -16.5], [s * 13.6, -19.5], [s * 11, -22], [s * 6.8, -21.6]]);
    ctx.stroke();
    ctx.filter = 'none';
    // the nostril: a dark kidney under the tip
    ctx.fillStyle = `rgba(${rgb(0.22)},0.85)`;
    ctx.save();
    ctx.translate(s * 5.4, -21.2);
    ctx.rotate(s * -0.35);
    ctx.beginPath();
    ctx.ellipse(0, 0, 2.3, 1.15, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  for (const s of [1, -1]) blob(s * 1.6, -26, 1.1, 3.6, dark, 0.18);   // the philtrum's ridges' shade
  // the folds from the nose's wings toward the mouth's corners
  ctx.strokeStyle = `rgba(${dark},0.2)`;
  ctx.lineWidth = 1.3;
  ctx.filter = 'blur(0.8px)';
  for (const s of [1, -1]) { smooth([[s * 14, -19], [s * 19, -24], [s * 23, -29.5], [s * 25.5, -34]]); ctx.stroke(); }
  ctx.filter = 'none';

  // ---- mouth: a cupid's bow on the darker upper lip, a fuller lower lip with a catch of light,
  // the line between them darkest at the corners
  {
    const lipBase = light > 0.5 ? mix(skin, '#b45a50', 0.45) : mix(skin, '#5a2a22', 0.35 + 0.15 * (1 - light));
    const upperLip = shade(lipBase, -0.16), lowerLip = shade(lipBase, 0.02);
    const cw = FACE.mouthCorner[0], my = FACE.mouth[1];
    ctx.fillStyle = upperLip;
    ctx.beginPath();
    ctx.moveTo(-cw, my);
    ctx.bezierCurveTo(-cw * 0.62, my + 1.6, -cw * 0.3, my + 3.3, -cw * 0.1, my + 3.0);
    ctx.quadraticCurveTo(0, my + 2.6, cw * 0.1, my + 3.0);
    ctx.bezierCurveTo(cw * 0.3, my + 3.3, cw * 0.62, my + 1.6, cw, my);
    ctx.quadraticCurveTo(0, my - 0.4, -cw, my);
    ctx.fill();
    ctx.fillStyle = lowerLip;
    ctx.beginPath();
    ctx.moveTo(-cw * 0.92, my - 0.2);
    ctx.bezierCurveTo(-cw * 0.65, my - 3.6, cw * 0.65, my - 3.6, cw * 0.92, my - 0.2);
    ctx.quadraticCurveTo(0, my - 0.6, -cw * 0.92, my - 0.2);
    ctx.fill();
    blob(0, my - 2.2, cw * 0.38, 0.9, '255,255,255', 0.16);
    blob(0, my + 3.6, cw * 0.5, 0.8, '255,255,255', 0.06);   // the lip's upper edge catching light
    ctx.strokeStyle = `rgba(${rgb(0.3)},0.9)`;
    ctx.lineWidth = 0.55;
    smooth([[-cw, my - 0.45], [-cw * 0.5, my + 0.05], [0, my + 0.2], [cw * 0.5, my + 0.05], [cw, my - 0.45]]);
    ctx.stroke();
    for (const s of [1, -1]) blob(s * cw * 0.98, my + 0.1, 1.4, 1.1, deep, 0.3);
    blob(0, my - 7, cw * 0.36, 1.4, dark, 0.16);              // the crease under the lower lip
  }

  // ---- eyes: under the eyeball, a dark almond (what far players show); the lids' skin a little
  // darker, the crease above, the lash lines on the margins, the inner corners
  for (const s of [1, -1]) {
    const C = eyeContours(s, F);
    ctx.fillStyle = `rgba(${rgb(0.3)},1)`;
    poly([...C.upper, ...C.lower.slice().reverse()], true);
    ctx.fill();
    ctx.fillStyle = 'rgba(222,214,204,0.9)';
    ctx.save();
    ctx.translate(s * FACE.eye[0], FACE.eye[1] + 0.3);
    ctx.scale(6.5, 2.1);
    ctx.beginPath(); ctx.arc(0, 0, 1, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    ctx.fillStyle = 'rgba(30,18,10,1)';
    ctx.beginPath(); ctx.ellipse(s * FACE.eye[0], FACE.eye[1] + 0.3, 2.6, 2.3, 0, 0, Math.PI * 2); ctx.fill();
    // the upper lid's skin (between the margin and the crease) in a little shadow
    ctx.fillStyle = `rgba(${dark},0.25)`;
    poly([...C.upper, ...C.crease.slice().reverse()], true);
    ctx.fill();
    ctx.strokeStyle = `rgba(${deep},0.45)`;
    ctx.lineWidth = 0.75;
    smooth(C.crease.slice(2, -1));
    ctx.stroke();
    // lashes: the upper line heavy, flicking past the outer corner; the lower one fine
    ctx.strokeStyle = 'rgba(14,9,7,0.95)';
    ctx.lineWidth = 1.15;
    smooth(C.upper);
    ctx.stroke();
    const oc = C.upper[C.upper.length - 1], pc = C.upper[C.upper.length - 3];
    ctx.lineWidth = 0.75;
    ctx.beginPath(); ctx.moveTo(oc[0], oc[1]); ctx.lineTo(oc[0] + (oc[0] - pc[0]) * 0.6, oc[1] + 0.9); ctx.stroke();
    ctx.strokeStyle = `rgba(${rgb(0.35)},0.75)`;
    ctx.lineWidth = 0.5;
    smooth(C.lower);
    ctx.stroke();
    // the inner corner: a pink fold
    const ic = C.upper[0];
    blob(ic[0] + s * 0.6, ic[1], 1.4, 1.1, '196,110,104', 0.65);
  }

  // ---- brows, hair by hair: up and out at the inner end, outward along the arch, down at the tail
  const bc = shade(look.hairColor || '#1b1612', -0.15);
  const browRgb = hexToRgb(bc).map((c) => Math.round(c * 255));
  const fb = F?.brow || 0;
  for (const s of [1, -1]) {
    // the brow's spine: t 0 (inner) … 1 (tail): λ, φ, half thickness
    const at = (t) => [s * (9 + 30 * t), 11.2 + 3.6 * Math.sin(Math.PI * Math.min(1, t * 1.25)) * (1 - 0.15 * t) - 1.6 * t * t + 0.6 * fb, lerp(1.55, 0.55, t * t)];
    // a soft base first, so the hairs read as a brow and not a scatter
    ctx.fillStyle = `rgba(${browRgb.join(',')},0.35)`;
    ctx.beginPath();
    for (let k = 0; k <= 20; k++) { const [l, p, w] = at(k / 20); if (k) ctx.lineTo(l, p + w); else ctx.moveTo(l, p + w); }
    for (let k = 20; k >= 0; k--) { const [l, p, w] = at(k / 20); ctx.lineTo(l, p - w * 0.9); }
    ctx.closePath();
    ctx.fill();
    for (let k = 0; k < 150; k++) {
      const t = rng() ** 0.85;
      const [l, p, w] = at(t);
      const off = (rng() * 2 - 1) * w;
      // hair direction (degrees in the λ–φ plane): steep at the inner end, flattening, then down
      const ang = (t < 0.15 ? 62 - 200 * t : t < 0.65 ? 24 - 24 * (t - 0.15) : 12 - 70 * (t - 0.65)) * Math.PI / 180;
      const len = 1.1 + rng() * 1.3;
      const c = browRgb.map((v) => clamp(Math.round(v * (0.8 + rng() * 0.5)), 0, 255)).join(',');
      ctx.strokeStyle = `rgba(${c},${0.5 + rng() * 0.45})`;
      ctx.lineWidth = 0.28 + rng() * 0.16;
      ctx.beginPath();
      ctx.moveTo(l, p + off);
      ctx.lineTo(l + s * Math.cos(ang) * len, p + off + Math.sin(ang) * len);
      ctx.stroke();
    }
  }

  // ---- facial hair, stroke by stroke over a soft base (stubble: a shadow and fine dots).
  // The mouth stays clear; strokes start inside the outline and run past it, so edges are hair.
  const hc = look.hairColor || '#1b1612';
  const hrgb = hexToRgb(hc).map((c) => Math.round(c * 255));
  const beard = look.beard || 'none';
  const cw = FACE.mouthCorner[0], my = FACE.mouth[1];
  const MOUTH = [[-cw - 1.5, my + 0.4], [-cw * 0.5, my + 4.4], [0, my + 4.1], [cw * 0.5, my + 4.4], [cw + 1.5, my + 0.4], [cw * 0.5, my - 4.6], [0, my - 5], [-cw * 0.5, my - 4.6]];
  const patch = (outline, n, dirAt, { holes = [MOUTH], base = 0.5, alpha = 0.85 } = {}) => {
    const out = outline.map(([l, p]) => [l, lf(p)]);
    ctx.save();
    ctx.filter = 'blur(1px)';
    ctx.fillStyle = `rgba(${hrgb.join(',')},${base})`;
    ctx.beginPath();
    for (const ring of [out, ...holes]) ring.forEach(([l, p], i) => (i ? ctx.lineTo(l, p) : ctx.moveTo(l, p)));
    ctx.fill('evenodd');
    ctx.filter = 'none';
    let lo = 1e9, hi = -1e9, bo = 1e9, to = -1e9;
    for (const [l, p] of out) { lo = Math.min(lo, l); hi = Math.max(hi, l); bo = Math.min(bo, p); to = Math.max(to, p); }
    for (let k = 0, tries = 0; k < n && tries < n * 6; tries++) {
      const l = lo + rng() * (hi - lo), p = bo + rng() * (to - bo);
      if (!inPoly(out, l, p) || holes.some((hh) => inPoly(hh, l, p))) continue;
      k++;
      const a = dirAt(l, p) + (rng() - 0.5) * 0.5;
      const len = 1 + rng() * 1.5;
      const c = hrgb.map((v) => clamp(Math.round(v * (0.7 + rng() * 0.7)), 0, 255)).join(',');
      ctx.strokeStyle = `rgba(${c},${alpha * (0.55 + rng() * 0.45)})`;
      ctx.lineWidth = 0.28 + rng() * 0.25;
      ctx.beginPath();
      ctx.moveTo(l, p);
      ctx.lineTo(l + Math.cos(a) * len, p + Math.sin(a) * len);
      ctx.stroke();
    }
    ctx.restore();
  };
  // hair grows down the jaw and chin, down and out across the upper lip
  const growth = (l, p) => (p > my - 1 && Math.abs(l) < cw + 2 ? -Math.PI / 2 - Math.sign(l) * 0.55 : -Math.PI / 2 - Math.sign(l) * Math.min(0.75, Math.abs(l) / 85));
  // the mustache over the upper lip, and the chin's patch, joined at the mouth's corners
  const GOATEE = [[-cw - 2, my - 1], [-cw * 0.7, my + 4.6], [-3, my + 6.6], [0, my + 6.2], [3, my + 6.6], [cw * 0.7, my + 4.6], [cw + 2, my - 1],
    [cw * 0.82, my - 9], [cw * 0.66, -55], [cw * 0.35, -61], [0, -62.5], [-cw * 0.35, -61], [-cw * 0.66, -55], [-cw * 0.82, my - 9]];
  const FULL = [[-82, -3], [-74, -14], [-56, -24], [-36, -28], [-cw - 1, my + 3], [-cw * 0.7, my + 4.8], [-3, my + 6.8], [3, my + 6.8], [cw * 0.7, my + 4.8], [cw + 1, my + 3], [36, -28], [56, -24], [74, -14], [82, -3],
    [90, -24], [84, -42], [66, -58], [36, -70], [0, -75], [-36, -70], [-66, -58], [-84, -42], [-90, -24]];
  if (beard === 'full') patch(FULL, 2600, growth, { base: 0.6 });
  if (beard === 'goatee') patch(GOATEE, 1100, growth, { base: 0.5 });
  if (beard === 'chinstrap') {
    // a narrow band along the jawline, ear to ear, under the chin
    const C0 = [[-84, -4], [-74, -26], [-60, -44], [-36, -58], [0, -63], [36, -58], [60, -44], [74, -26], [84, -4]];
    const band = [...C0.map(([l, p]) => [l * 1.025, p + 2.6]), ...C0.slice().reverse().map(([l, p]) => [l * 0.965, p - 2.6])];
    patch(band, 1100, growth, { holes: [], base: 0.45 });
  }
  if (beard === 'stubble') {
    const out = FULL.map(([l, p]) => [l, lf(p)]);
    ctx.save();
    ctx.filter = 'blur(1.5px)';
    ctx.fillStyle = `rgba(${hrgb.join(',')},0.16)`;
    ctx.beginPath();
    for (const ring of [out, MOUTH]) ring.forEach(([l, p], i) => (i ? ctx.lineTo(l, p) : ctx.moveTo(l, p)));
    ctx.fill('evenodd');
    ctx.filter = 'none';
    for (let k = 0; k < 3200; k++) {
      const l = -90 + rng() * 180, p = -78 + rng() * 76;
      if (!inPoly(out, l, p) || inPoly(MOUTH, l, p)) continue;
      ctx.fillStyle = `rgba(${hrgb.join(',')},${0.22 + rng() * 0.25})`;
      ctx.fillRect(l, p, 0.36, 0.36);
    }
    ctx.restore();
  }

  // ---- eye black
  if (look.eyeBlack === 'stripe' || look.eyeBlack === 'sticker') {
    for (const s of [1, -1]) {
      ctx.fillStyle = '#0c0c0e';
      ctx.save();
      ctx.translate(s * 25, -5.5);
      if (look.eyeBlack === 'stripe') {
        // greasepaint: a smudged bar
        ctx.rotate(s * 0.06);
        ctx.filter = 'blur(0.6px)';
        ctx.beginPath(); ctx.ellipse(0, 0, 9.5, 2.1, 0, 0, Math.PI * 2); ctx.fill();
        ctx.filter = 'none';
      } else {
        ctx.fillRect(-8.5, -2.4, 17, 4.6);
        ctx.fillStyle = 'rgba(255,255,255,0.3)';
        ctx.fillRect(-6.5, -0.5, 13, 1.3);
      }
      ctx.restore();
    }
  }

  // ---- the hairline (and sideburns), the same polygon as on the head
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const map = (l, p) => [Fr[0] + (l + FACE_LAM) * sx, Fr[1] + (FACE_PHI[1] - p) * sy];
  paintScalpHair(ctx, look, map);
  ctx.restore();
}
/** Is (l, p) inside the polygon (ray casting)? */
function inPoly(pts, l, p) {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [li, pi] = pts[i], [lj, pj] = pts[j];
    if ((pi > p) !== (pj > p) && l < ((lj - li) * (p - pi)) / (pj - pi) + li) inside = !inside;
  }
  return inside;
}
/** A (λ, φ) polygon path in the current (degree) transform. */
function lpPathRaw(ctx, pts) {
  ctx.beginPath();
  pts.forEach(([l, p], i) => (i ? ctx.lineTo(l, p) : ctx.moveTo(l, p)));
  ctx.closePath();
}

/**
 * An eyeball, front-on (R.EYE; u 0 the inner corner, 1 the outer): the white, warmer and
 * a little red toward the corners, the iris with its fibres and dark rim, the pupil, a
 * catch-light, and the upper lid's shadow across the top.
 */
function paintEyes(ctx, look, rng) {
  const [x, y, w, h] = R.EYE;
  ctx.save();
  ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
  const px = (u) => x + u * w, py = (v) => y + (1 - v) * h;
  ctx.fillStyle = '#dcd3c6';
  ctx.fillRect(x, y, w, h);
  // the white darkens and warms toward the corners and the edges
  let g = ctx.createRadialGradient(px(0.5), py(0.52), w * 0.1, px(0.5), py(0.52), w * 0.56);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(1, 'rgba(110,64,54,0.62)');
  ctx.fillStyle = g;
  ctx.fillRect(x, y, w, h);
  g = ctx.createRadialGradient(px(0.06), py(0.52), 0, px(0.06), py(0.52), w * 0.2);
  g.addColorStop(0, 'rgba(200,110,105,0.55)');
  g.addColorStop(1, 'rgba(200,110,105,0)');
  ctx.fillStyle = g;
  ctx.fillRect(x, y, w, h);
  // a few fine vessels toward the corners
  ctx.strokeStyle = 'rgba(170,60,55,0.28)';
  ctx.lineWidth = 0.6;
  for (let k = 0; k < 8; k++) {
    const side = k % 2 ? 0.1 : 0.9, vv = 0.42 + rng() * 0.2;
    ctx.beginPath(); ctx.moveTo(px(side), py(vv));
    ctx.quadraticCurveTo(px(side + (0.5 - side) * 0.35), py(vv + (rng() - 0.5) * 0.08), px(side + (0.5 - side) * (0.45 + rng() * 0.15)), py(0.52 + (rng() - 0.5) * 0.1));
    ctx.stroke();
  }
  // the iris: colour by the player (most dark brown; lighter skin may run to hazel, green, blue, grey)
  const pale = (look.skin ?? 0.5) < 0.35;
  const IRIS = [['#3a2414', '#5a3a22'], ['#2b1a10', '#4a2d18'], ['#4d3a1e', '#7a6032'], ['#3d4f2c', '#62784a'], ['#33546b', '#5f87a3'], ['#55606a', '#8a96a0']];
  const pick = pale ? IRIS[Math.floor(rng() * IRIS.length)] : IRIS[Math.floor(rng() * 2)];
  const cx = px(0.5), cy = py(0.52), ir = w * 0.23;
  g = ctx.createRadialGradient(cx, cy, ir * 0.25, cx, cy, ir);
  g.addColorStop(0, pick[1]);
  g.addColorStop(0.75, pick[0]);
  g.addColorStop(1, shade(pick[0], -0.45));
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(cx, cy, ir, 0, Math.PI * 2); ctx.fill();
  // fibres
  ctx.strokeStyle = 'rgba(255,240,220,0.13)';
  ctx.lineWidth = 0.6;
  for (let k = 0; k < 36; k++) {
    const a = (k / 36) * Math.PI * 2 + rng() * 0.1;
    ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * ir * 0.38, cy + Math.sin(a) * ir * 0.38); ctx.lineTo(cx + Math.cos(a) * ir * 0.9, cy + Math.sin(a) * ir * 0.9); ctx.stroke();
  }
  // the pupil, the catch-light
  ctx.fillStyle = '#060404';
  ctx.beginPath(); ctx.arc(cx, cy, ir * 0.36, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.8)';
  ctx.beginPath(); ctx.arc(cx - ir * 0.32, cy - ir * 0.36, ir * 0.13, 0, Math.PI * 2); ctx.fill();
  // the upper lid's shadow across the top of the eye, a softer one under the lower lid
  g = ctx.createLinearGradient(0, py(0.76), 0, py(0.58));
  g.addColorStop(0, 'rgba(40,22,16,0.75)');
  g.addColorStop(1, 'rgba(40,22,16,0)');
  ctx.fillStyle = g;
  ctx.fillRect(x, py(0.8), w, py(0.58) - py(0.8));
  g = ctx.createLinearGradient(0, py(0.3), 0, py(0.4));
  g.addColorStop(0, 'rgba(60,30,24,0.4)');
  g.addColorStop(1, 'rgba(60,30,24,0)');
  ctx.fillStyle = g;
  ctx.fillRect(x, py(0.4), w, py(0.28) - py(0.4));
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

function paintHands(ctx, o, { kit, team, skin, look }) {
  const Hd = R.HAND;
  clipRect(ctx, Hd);
  // the strips body.js maps the palm, the fingers and the thumb to (u 0 = the palm side,
  // 0.5 = the back / the nails; v 1 = wrist or knuckle … 0 = fingertips)
  const sub = ([a, b]) => [Hd[0] + a * Hd[2], Hd[1], (b - a) * Hd[2], Hd[3]];
  const Pm = sub(HAND_U.palm), Fg = sub(HAND_U.finger), Th = sub(HAND_U.thumb);
  const creases = (R2, vs, color, w0 = 0.3, w1 = 0.7) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    for (const v of vs) {
      const [a, yv] = pxOf(R2, w0, v), [b] = pxOf(R2, w1, v);
      ctx.beginPath(); ctx.moveTo(a, yv); ctx.lineTo(b, yv); ctx.stroke();
    }
  };
  const gloved = look.gloves && !o.ref;
  if (gloved) {
    const gc = kit.gloves || '#222';
    const palm = lum(gc) > 0.7 ? '#cfcfc8' : mix(gc, '#9a9a96', 0.35);
    rectL(ctx, Hd, 0, 0, 1, 1, gc);
    // the tacky grip: the palm, the inside of every finger, the thumb's pad
    rectL(ctx, Pm, -0.17, 0, 0.17, 0.8, palm);
    rectL(ctx, Fg, -0.2, 0, 0.2, 1, palm);
    rectL(ctx, Th, -0.22, 0, 0.22, 1, palm);
    // cuff band with a team stripe round it
    rectL(ctx, Pm, 0, 0.8, 1, 1, shade(gc, -0.25));
    rectL(ctx, Pm, 0, 0.84, 1, 0.88, team?.colors?.secondary || '#888');
    // logo on the back of the hand, stitched knuckle panels on the fingers
    const [lx, ly] = pxOf(Pm, 0.5, 0.5);
    ctx.fillStyle = mix(gc, lum(gc) > 0.6 ? (team?.colors?.primary || '#333') : '#e8e8e8', 0.7);
    ctx.beginPath(); ctx.ellipse(lx, ly, 2.6, 3.4, 0, 0, Math.PI * 2); ctx.fill();
    creases(Pm, [0.16], shade(gc, -0.4), 0.3, 0.7);
    creases(Fg, [0.5, 0.23], shade(gc, -0.4), 0.3, 0.7);
    creases(Th, [0.52], shade(gc, -0.4), 0.32, 0.68);
    texture(ctx, Hd, sheenTile, 0.3);
  } else {
    rectL(ctx, Hd, 0, 0, 1, 1, skin);
    texture(ctx, Hd, skinTile, 0.5);
    const palmSkin = mix(skin, '#e8c0b0', 0.25);
    rectL(ctx, Pm, -0.15, 0, 0.15, 0.78, palmSkin);
    rectL(ctx, Fg, -0.16, 0, 0.16, 1, palmSkin);
    rectL(ctx, Th, -0.18, 0, 0.18, 1, palmSkin);
    // wrist tape
    rectL(ctx, Pm, 0, 0.8, 1, 1, '#f2f2ee');
    // knuckles and joint creases (darker across the back, lines in the palm side), nails
    const crease = `rgba(0,0,0,${lum(skin) > 0.5 ? 0.2 : 0.3})`;
    creases(Pm, [0.12, 0.16], crease, 0.36, 0.64);
    creases(Fg, [0.47, 0.49, 0.22], crease, 0.34, 0.66);
    creases(Fg, [0.47, 0.22], 'rgba(0,0,0,0.18)', -0.1, 0.1);
    creases(Th, [0.5, 0.24], crease, 0.34, 0.66);
    const nail = mix(skin, '#f1d6cf', 0.55);
    rectL(ctx, Fg, 0.37, 0.025, 0.63, 0.15, nail);
    rectL(ctx, Fg, 0.37, 0.025, 0.63, 0.05, mix(nail, '#ffffff', 0.4));
    rectL(ctx, Th, 0.35, 0.025, 0.65, 0.18, nail);
    rectL(ctx, Th, 0.35, 0.025, 0.65, 0.055, mix(nail, '#ffffff', 0.4));
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
  const k = 128 / ATLAS_W;
  c.width = 128; c.height = ATLAS_H * k;
  const x = c.getContext('2d');
  const put = (rect, r) => { x.fillStyle = `rgb(0,${Math.round(r * 255)},0)`; x.fillRect(rect[0] * k, rect[1] * k, rect[2] * k, rect[3] * k); };
  x.fillStyle = 'rgb(0,200,0)'; x.fillRect(0, 0, c.width, c.height);
  put(R.TORSO, 0.82); put(R.LEG, 0.62); put(R.HEAD, 0.55); put(R.ARM_L, 0.6); put(R.ARM_R, 0.6);
  put(R.HAND, 0.58); put(R.SHOE, 0.42); put(R.HAIR, 0.75); put(R.HNUM, 0.3); put(R.MISC, 0.8); put(R.CAP, 0.8);
  put(R.FACE, 0.5); put(R.EYE, 0.08);
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
  const S = 256, k = S / ATLAS_W, SH = ATLAS_H * k;
  const c = document.createElement('canvas');
  c.width = S; c.height = SH;
  const x = c.getContext('2d');
  x.fillStyle = '#000000';
  x.fillRect(0, 0, S, SH);
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
  const img = x.getImageData(0, 0, S, SH);
  for (let i = 0; i < S * SH; i++) {
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
