// DRIP LINE — the train. One-point-perspective interiors looking down the
// aisle toward the next car. Static geometry is baked per (car, size, stock)
// into offscreen canvases with the glass punched out; the tunnel behind the
// glass, swaying straps, flickering tubes, screens, sparkles and the hanging
// stock are drawn live every frame.
//
//   const L = carLayout(W, H, 'kicks');
//   drawCar(g, L, 'kicks', t, state);      // background (I draw W×H)
//   …draw NPCs at L.npc / L.npc2 and the player at L.player…
//   drawCarFront(g, L, 'kicks', t, state); // foreground props, near poles, straps, vignette
import {
  INK, shape, stroke, dot, text, drips, FONTS, mulberry32, hashStr, shade, tint, mix, rgba,
  makeCanvas, rrectPts, ellipsePts,
} from '../ink.js';
import { tag, throwup, piece, stickers } from './graffiti.js';
import { drawProduct } from './products.js';

export const CAR_KINDS = ['front', 'threads', 'kicks', 'lids', 'ice', 'arcade', 'capsules', 'ghost', 'cab', 'vault'];

// ---------------------------------------------------------------- world (meters)

const EYE = 1.5;               // camera height
const HALF = 1.5;              // half the car's width
const CEIL = 2.35;
const WALL_TOP = 2.14;         // the wall is vertical up to here, then a cove slopes to the ceiling
const COVE_X = 1.24;
const END_Z = 11;              // far end wall with the door to the next car
const NZ = 0.45;               // nearest geometry
const RAIL_X = 0.62, RAIL_Y = 2.02;
const SEAT_X = 1.02, SEAT_Y = 0.46, BACK_X = 1.4, BACK_Y = 0.95;
const WIN_Y0 = 0.98, WIN_Y1 = 1.86;
const AD_Y0 = 1.88, AD_Y1 = 2.12;
const DOORS = [[3.05, 4.45], [7.65, 9.05]];
const SECTIONS = [[NZ, 3.05], [4.45, 7.65], [9.05, END_Z]];
const HANG_Y0 = 1.66, HANG_Y1 = 2.1;
const SIGN_Z = 2.3, SIGN_W = 1.1, SIGN_Y0 = 2.06, SIGN_Y1 = 2.33;
const RAIL_SLOTS = [2.7, 3.7, 5.0, 6.6];

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const add3 = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul3 = (a, k) => [a[0] * k, a[1] * k, a[2] * k];

// ---------------------------------------------------------------- palettes

const STEEL = {
  wall: '#e7ddc4', wallSh: '#cdbf9e', pillar: '#ddd1b4', panel: '#d8ccae',
  frame: '#aab2bd', frameSh: '#7d8693',
  ceil: '#f0e9d8', cove: '#ddd3bb', ceilLine: '#cfc5ad',
  floor: '#2b333b', stud: '#3a454f', floorEdge: '#20262c',
  rail: '#e1e6ee', railSh: '#8f98a6',
  door: '#c4cbd4', doorSh: '#98a1ad', rubber: '#1a1b21',
  tube: '#fffbe6', tubeHalo: 'rgba(255,246,214,0.55)',
  strap: '#22212b', kick: '#2c2a33',
  end: '#d6cbb0',
  old: false,
};
const WOOD = {
  wall: '#6e4b2f', wallSh: '#4f3420', pillar: '#5b3c24', panel: '#7d5838',
  frame: '#c9a14a', frameSh: '#8a6a2a',
  ceil: '#7a5638', cove: '#664529', ceilLine: '#4f3420',
  floor: '#3e2a1c', stud: '#4c3424', floorEdge: '#2a1c12',
  rail: '#e0bd62', railSh: '#8a6a2a',
  door: '#6a4628', doorSh: '#4a301b', rubber: '#24170e',
  tube: '#fff0b8', tubeHalo: 'rgba(170,255,226,0.45)',
  strap: '#3a2616', kick: '#2a1c12',
  end: '#5e4029',
  old: true,
};

const KIND = {
  front: { n: 1, label: 'CONDUCTOR', seat: '#f07b2a', seat2: '#de6122', accent: '#2fb7a8', ring: '#ffd23f', words: ['DRIPLINE', 'ALLABOARD', 'NEKO', 'NOVA', 'RIZO', 'PUNCHIN'], spray: ['#ff4f9a', '#2fb7a8', '#ffd23f', '#7b5cff'] },
  threads: { n: 2, label: 'THREADS', seat: '#2fb7a8', seat2: '#24998d', accent: '#ff4f9a', ring: '#ff4f9a', words: ['FITS', 'DRIP', 'THREADZ', 'LUXE', 'VYBE', 'FRESH'], spray: ['#ff4f9a', '#ffd23f', '#7b5cff', '#ff8a3d'] },
  kicks: { n: 3, label: 'KICKS', seat: '#e8b73a', seat2: '#d4a028', accent: '#ff8a3d', ring: '#ff8a3d', words: ['KICKS', 'SOLE', 'LACEUP', 'ZEEK', 'MOTOR', 'JUMP'], spray: ['#ff4f9a', '#3ec7b0', '#7b5cff', '#e8453c'] },
  lids: { n: 4, label: 'LIDS', seat: '#e8453c', seat2: '#c93530', accent: '#3ec7b0', ring: '#3ec7b0', words: ['LIDS', 'CAPS', 'TOPS', 'RIZO', 'PEZ', 'BRIM'], spray: ['#ffd23f', '#3ec7b0', '#5aa0ff', '#fffaf0'] },
  ice: { n: 5, label: 'ICE', seat: '#3d6fe0', seat2: '#2f5bc4', accent: '#bff3ff', ring: '#ffd23f', words: ['ICE', 'SHINE', 'BLING', 'CHEZ', 'GLOW', 'FROST'], spray: ['#ffd23f', '#bff3ff', '#ff4f9a', '#fffaf0'] },
  arcade: { n: 6, label: 'ARCADE', seat: '#8a5cff', seat2: '#7448e6', accent: '#7ed957', ring: '#7ed957', words: ['1UP', 'PLAY', 'HISCORE', 'BLIP', 'GAMEON', 'COMBO'], spray: ['#7ed957', '#ffd23f', '#ff4f9a', '#3ec7b0'] },
  capsules: { n: 7, label: 'CAPSULES', seat: '#8fd14f', seat2: '#76b83b', accent: '#ffd23f', ring: '#ff4f9a', words: ['LUCK', 'PULL', 'RARE', 'MYTHIC', 'FOMO', 'SPIN'], spray: ['#ff4f9a', '#7b5cff', '#ffd23f', '#3ec7b0'] },
  ghost: { n: '?', label: 'LOST & FOUND', seat: '#9a7a4a', seat2: '#86683c', accent: '#9fffe0', ring: '#9fffe0', words: ['BOO', '1904', 'LASTTRAIN', 'GONE', 'ECHO'], spray: ['#9fffe0', '#e8fff6', '#c8a8ff'] },
  cab: { n: 0, label: 'CAB', seat: '#3a3f48', seat2: '#30343c', accent: '#ff4f9a', ring: '#ffd23f', words: ['DRIVER', 'NOVA', 'ZOOM', 'FULLSPEED'], spray: ['#ff4f9a', '#ffd23f', '#7ed957', '#5aa0ff'] },
  vault: { n: '$', label: 'THE VAULT', seat: '#3c4250', seat2: '#30353f', accent: '#ffd23f', ring: '#ffd23f', words: ['VAULT', 'MYTHIC', 'GOLD', 'PLUG', 'RICH'], spray: ['#ffd23f', '#fffaf0', '#ff4f9a', '#7ed957'] },
};

// throw-ups need short words; tags can be long
const SHORT = { front: ['DRIP', 'NOVA', 'RIZO'], threads: ['DRIP', 'FITS', 'LUXE'], kicks: ['SOLE', 'KICKS', 'JUMP'], lids: ['CAPS', 'LIDS', 'BRIM'], ice: ['SHINE', 'ICE', 'GLOW'], arcade: ['PLAY', '1UP', 'BLIP'], capsules: ['PULL', 'LUCK', 'RARE'], ghost: ['1904', 'BOO', 'GONE'], cab: ['ZOOM', 'NOVA', 'GO'], vault: ['GOLD', 'RICH', 'PLUG'] };

const ADS = [
  { title: 'MIND THE DRIP', sub: 'wet paint since 1987', bg: '#ffd23f', fg: INK },
  { title: 'FIT CHECK', sub: 'every car · every night', bg: '#ff4f9a', fg: '#fffaf0' },
  { title: 'LOST A CAPSULE?', sub: 'it is gone. let it go.', bg: '#3ec7b0', fg: INK },
  { title: 'DR. DRIP', sub: 'outfit therapy · car 2', bg: '#fffaf0', fg: INK },
  { title: 'NO SURFING', sub: 'stay inside the train', bg: '#e8453c', fg: '#fffaf0' },
  { title: 'TAG RESPONSIBLY', sub: 'the tag wall · car 6', bg: '#7ed957', fg: INK },
  { title: 'THE VAULT', sub: 'is not real. stop asking.', bg: '#2a2238', fg: '#ffd23f' },
  { title: 'NEXT STOP', sub: 'nowhere. we loop.', bg: '#5aa0ff', fg: INK },
  { title: 'KICKS 4 LIFE', sub: 'car 3 · fresh pairs daily', bg: '#ff8a3d', fg: INK },
  { title: 'SHINE ON', sub: 'ice · car 5', bg: '#bff3ff', fg: INK },
  { title: 'PUNCH IN', sub: 'daily. or else.', bg: '#7b5cff', fg: '#fffaf0' },
  { title: 'HOLD THE STRAP', sub: 'the floor is not your friend', bg: '#f4efe6', fg: INK },
];
const OLD_ADS = [
  { title: 'DR. PHANTOM', sub: 'tonic for the departed', bg: '#e8dcb8', fg: '#3a2414' },
  { title: 'LAST TRAIN', sub: 'midnight · 1904', bg: '#2a1c12', fg: '#e8d8a8' },
  { title: 'MIND THE GAP', sub: 'especially you', bg: '#c8b48a', fg: '#3a2414' },
  { title: 'SPECTRAL SOAP', sub: 'leaves no trace', bg: '#9fd8c0', fg: '#1d3a30' },
];

for (const k of Object.keys(KIND)) KIND[k].short = SHORT[k] || SHORT.front;

// ---------------------------------------------------------------- camera

function cameraFor(W, H) {
  const wide = W > H * 1.05;
  const f = H * (wide ? 0.58 : 0.56);
  // in portrait the vanishing point sits left of center: the player stands on
  // the left, so the right side of the car gets the room
  return { wide, f, cx: W * (wide ? 0.5 : 0.42), cy: H * 0.4, u: f / 470 };
}

// ---------------------------------------------------------------- primitives

function lwAt(L, s, k = 1) {
  return clamp(s * 0.021 * k, 0.9 * L.u, 3.2 * L.u);
}

function p2(L, p) {
  const q = L.P(p[0], p[1], p[2]);
  return [q[0], q[1]];
}

function quad3(g, L, pts3, o = {}) {
  const pts = pts3.map((p) => p2(L, p));
  let zs = 0;
  for (const p of pts3) zs += p[2];
  zs /= pts3.length;
  return shape(g, pts, {
    smooth: false, amp: 0.45 * L.u, seg: 10 * L.u, seed: 7,
    lw: lwAt(L, L.f / zs), ...o,
  });
}

function line3(g, L, a, b, o = {}) {
  const A = p2(L, a), B = p2(L, b);
  return stroke(g, [A, B], {
    lw: o.lw ?? lwAt(L, L.f / ((a[2] + b[2]) / 2)), color: o.color || INK,
    amp: o.amp ?? 0.35 * L.u, seed: o.seed ?? 3, seg: 10 * L.u, cap: o.cap,
  });
}

// A tapered tube between two 3D points (rails, poles, brackets).
function tube3(g, L, a, b, r, color, o = {}) {
  const A = L.P(...a), B = L.P(...b);
  const dx = B[0] - A[0], dy = B[1] - A[1];
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len, ny = dx / len;
  const ra = r * A[2], rb = r * B[2];
  const ol = (o.lw ?? 1.6) * L.u;
  const path = (k) => {
    g.beginPath();
    g.moveTo(A[0] + nx * (ra + k), A[1] + ny * (ra + k));
    g.lineTo(B[0] + nx * (rb + k), B[1] + ny * (rb + k));
    g.lineTo(B[0] - nx * (rb + k), B[1] - ny * (rb + k));
    g.lineTo(A[0] - nx * (ra + k), A[1] - ny * (ra + k));
    g.closePath();
  };
  path(ol);
  g.fillStyle = o.line || INK;
  g.fill();
  path(0);
  g.fillStyle = color;
  g.fill();
  // highlight
  g.strokeStyle = o.hi || rgba('#ffffff', 0.65);
  g.lineWidth = Math.max(0.6 * L.u, Math.min(ra, rb) * 0.45);
  g.beginPath();
  g.moveTo(A[0] + nx * ra * 0.35, A[1] + ny * ra * 0.35);
  g.lineTo(B[0] + nx * rb * 0.35, B[1] + ny * rb * 0.35);
  g.stroke();
}

// Flat content on a plane facing the camera at depth z; (x0, y1) is its top
// left corner in meters; content is drawn in centimeters.
function face(g, L, x0, y1, z, fn) {
  const [sx, sy, s] = L.P(x0, y1, z);
  g.save();
  g.translate(sx, sy);
  g.scale(s / 100, s / 100);
  fn(g);
  g.restore();
}

// A box with its front face at depth z0 facing the camera, d meters deep.
function box3(g, L, b, o = {}) {
  const { x0, x1, y0, y1, z0 } = b;
  const z1 = z0 + (b.d ?? 0.4);
  const c = o.fill || '#888';
  const sd = o.seed ?? 11;
  if (y1 < EYE - 0.01) quad3(g, L, [[x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1]], { fill: o.top || tint(c, 0.16), seed: sd });
  if (y0 > EYE + 0.01) quad3(g, L, [[x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1]], { fill: o.bottom || shade(c, 0.3), seed: sd + 1 });
  if (x0 > 0.001) quad3(g, L, [[x0, y0, z0], [x0, y1, z0], [x0, y1, z1], [x0, y0, z1]], { fill: o.side || shade(c, 0.24), seed: sd + 2 });
  if (x1 < -0.001) quad3(g, L, [[x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [x1, y0, z1]], { fill: o.side || shade(c, 0.24), seed: sd + 3 });
  quad3(g, L, [[x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0]], { fill: c, seed: sd + 4 });
  if (o.front) face(g, L, x0, y1, z0, (gg) => o.front(gg, (x1 - x0) * 100, (y1 - y0) * 100));
}

// Rounded rectangle on a wall plane X = xw in (z, y) coordinates.
function wallRR(xw, z0, z1, y0, y1, r) {
  return rrectPts(z0, y0, z1 - z0, y1 - y0, r).map(([z, y]) => [xw, y, z]);
}

// ---------------------------------------------------------------- decals

let measureCtx = null;
function textWidth(str, size, font) {
  if (!measureCtx) measureCtx = makeCanvas(8, 8).getContext('2d');
  measureCtx.font = `${size}px ${font}`;
  return measureCtx.measureText(str).width;
}

const texCache = new Map();
function cachedTex(key, make) {
  let c = texCache.get(key);
  if (!c) {
    c = make();
    texCache.set(key, c);
    if (texCache.size > 220) texCache.delete(texCache.keys().next().value);
  }
  return c;
}

function makeTex(wcm, hcm, pxPerCm, draw) {
  const pp = Math.min(pxPerCm, 1800 / wcm, 1800 / hcm);
  const c = makeCanvas(Math.max(2, Math.round(wcm * pp)), Math.max(2, Math.round(hcm * pp)));
  const g = c.getContext('2d');
  g.scale(c.width / wcm, c.height / hcm);
  draw(g, wcm, hcm);
  return c;
}

// texture density for a decal whose nearest point is zNear, rounded so cars share textures
const ppFor = (L, zNear, K) => {
  const v = clamp(((L.f / Math.max(NZ, zNear)) * K) / 100, 0.25, 4);
  return Math.pow(2, Math.ceil(Math.log2(v) * 2) / 2);
};

// Map a texture onto a 3D parallelogram (O top-left, U = full width, V = full
// height, both 3D vectors) with perspective, by slicing it into thin strips
// along whichever edge recedes and mapping each strip affinely.
function mapPlane(g, L, O, U, V, tex) {
  const alongU = Math.abs(U[2]) >= Math.abs(V[2]);
  const D = alongU ? U : V;
  const E = alongU ? V : U;
  const A0 = L.P(...O), A1 = L.P(...add3(O, D));
  const n = clamp(Math.ceil(Math.hypot(A1[0] - A0[0], A1[1] - A0[1]) / (15 * L.u)), 1, 32);
  const tw = tex.width, th = tex.height;
  for (let i = 0; i < n; i++) {
    const t0 = i / n, t1 = (i + 1) / n;
    const q00 = add3(O, mul3(D, t0)), q10 = add3(O, mul3(D, t1));
    const a = L.P(...q00), b = L.P(...q10), c = L.P(...add3(q00, E)), d = L.P(...add3(q10, E));
    let sx0, sy0, sw, sh, m;
    if (alongU) {
      sx0 = t0 * tw; sy0 = 0; sw = (t1 - t0) * tw; sh = th;
      const ax = (b[0] - a[0]) / sw, ay = (b[1] - a[1]) / sw;
      const vx = (c[0] - a[0]) / th, vy = (c[1] - a[1]) / th;
      m = [ax, ay, vx, vy, a[0] - sx0 * ax, a[1] - sx0 * ay];
    } else {
      sx0 = 0; sy0 = t0 * th; sw = tw; sh = (t1 - t0) * th;
      const ex = (c[0] - a[0]) / tw, ey = (c[1] - a[1]) / tw;
      const dx = (b[0] - a[0]) / sh, dy = (b[1] - a[1]) / sh;
      m = [ex, ey, dx, dy, a[0] - sy0 * dx, a[1] - sy0 * dy];
    }
    const cw = Math.min(sw, tw - sx0), ch = Math.min(sh, th - sy0);
    if (cw <= 0 || ch <= 0) continue;
    const gx = b[0] - a[0], gy = b[1] - a[1];
    const gl = Math.hypot(gx, gy) || 1;
    const ox = (gx / gl) * 0.7, oy = (gy / gl) * 0.7;
    g.save();
    g.beginPath();
    g.moveTo(a[0] - ox, a[1] - oy);
    g.lineTo(b[0] + ox, b[1] + oy);
    g.lineTo(d[0] + ox, d[1] + oy);
    g.lineTo(c[0] - ox, c[1] - oy);
    g.closePath();
    g.clip();
    g.transform(...m);
    g.drawImage(tex, sx0, sy0, cw, ch, sx0, sy0, cw, ch);
    g.restore();
  }
}

// On a side wall (or any X plane), reading the way you'd read it from the aisle.
function xDecal(g, L, side, xw, zc, yc, wm, hm, tex) {
  if (side < 0) mapPlane(g, L, [xw, yc + hm / 2, zc - wm / 2], [0, 0, wm], [0, -hm, 0], tex);
  else mapPlane(g, L, [xw, yc + hm / 2, zc + wm / 2], [0, 0, -wm], [0, -hm, 0], tex);
}
function floorDecal(g, L, xc, zc, wm, hm, tex) {
  mapPlane(g, L, [xc - wm / 2, 0.002, zc + hm / 2], [wm, 0, 0], [0, 0, -hm], tex);
}
function ceilDecal(g, L, xc, zc, wm, hm, tex, y = CEIL) {
  mapPlane(g, L, [xc - wm / 2, y - 0.002, zc - hm / 2], [wm, 0, 0], [0, 0, hm], tex);
}

function tagTex(L, K, zNear, word, color, seed, size = 34) {
  const pp = ppFor(L, zNear, K);
  return cachedTex(`tag:${word}:${color}:${seed}:${size}:${pp}`, () => {
    const wcm = textWidth(word, size, FONTS.tag) * 1.15 + size * 0.8;
    const hcm = size * 1.9;
    return makeTex(wcm, hcm, pp, (g, w, h) => tag(g, w / 2, h * 0.6, { word, color, size, seed, rot: (mulberry32(seed)() - 0.5) * 0.2, alpha: 0.95 }));
  });
}
function throwTex(L, K, zNear, word, fill, seed, size = 40) {
  const pp = ppFor(L, zNear, K);
  return cachedTex(`thr:${word}:${fill}:${seed}:${size}:${pp}`, () => {
    const wcm = textWidth(word, size, FONTS.drip) * 1.25 + size;
    const hcm = size * 2;
    return makeTex(wcm, hcm, pp, (g, w, h) => throwup(g, w / 2, h * 0.66, { word, fill, size, seed, rot: (mulberry32(seed + 1)() - 0.5) * 0.12 }));
  });
}
function stickerTex(L, K, zNear, seed, n = 5) {
  const pp = ppFor(L, zNear, K);
  return cachedTex(`stk:${seed}:${n}:${pp}`, () => makeTex(70, 56, pp, (g, w, h) => stickers(g, w / 2, h / 2, n, seed)));
}
function adTex(L, K, zNear, ad, seed) {
  const pp = ppFor(L, zNear, K);
  return cachedTex(`ad:${ad.title}:${pp}`, () => makeTex(120, 30, pp, (g, w, h) => {
    shape(g, rrectPts(1, 1, w - 2, h - 2, 2), { fill: ad.bg, lw: 1.6, amp: 0.3, seed });
    const size = Math.min(14, (w * 0.9) / Math.max(4, textWidth(ad.title, 10, FONTS.sign) / 10));
    text(g, ad.title, w / 2, h * 0.55, { size, font: FONTS.sign, fill: ad.fg, lw: 0 });
    g.font = `7.5px ${FONTS.hand}`;
    g.fillStyle = ad.fg;
    g.textAlign = 'center';
    g.fillText(ad.sub, w / 2, h * 0.86, w - 8);
  }));
}

// ---------------------------------------------------------------- flat faces (centimeters)

function stickersCm(g, x, y, n, seed, k = 0.42) {
  g.save();
  g.translate(x, y);
  g.scale(k, k);
  stickers(g, 0, 0, n, seed);
  g.restore();
}

function signFace(g, w, h, num, label, accent) {
  shape(g, rrectPts(0, 0, w, h, 5), { fill: '#16141d', lw: 2.2, amp: 0.3, seed: 41 });
  const b = h - 9;
  shape(g, ellipsePts(4.5 + b / 2, h / 2, b / 2, b / 2), { fill: accent, lw: 1.8, amp: 0.3, seed: 42 });
  const ns = String(num);
  text(g, ns, 4.5 + b / 2, h / 2 + b * 0.22, { size: b * (ns.length > 1 ? 0.42 : 0.6), font: FONTS.sign, fill: INK, lw: 0 });
  const lab = String(label).toUpperCase();
  const x = b + 12;
  const avail = w - x - 5;
  const size = Math.min(h * 0.44, avail / Math.max(3.2, textWidth(lab, 10, FONTS.sign) / 10));
  text(g, lab, x, h * 0.78, { size, font: FONTS.sign, fill: '#f6f1e6', lw: 0, align: 'left' });
  const top = typeof num === 'number' && num > 0 ? `CAR ${num} · DRIP LINE` : 'DRIP LINE';
  text(g, top, x, h * 0.3, { size: h * 0.17, font: FONTS.sign, fill: rgba(accent, 0.95), lw: 0, align: 'left' });
}

function boardFace(g, w, h, seed) {
  shape(g, rrectPts(0, 0, w, h, 2), { fill: '#6e4a2c', lw: 2.2, amp: 0.4, seed });
  shape(g, rrectPts(3, 3, w - 6, h - 6, 1), { fill: '#c99a62', lw: 1.4, amp: 0.3, seed: seed + 1 });
  const r = mulberry32(seed);
  for (let i = 0; i < 150; i++) {
    g.fillStyle = rgba('#6e4a2c', 0.18 + r() * 0.25);
    g.fillRect(3 + r() * (w - 6), 3 + r() * (h - 6), 0.9, 0.9);
  }
  text(g, 'JOBS', w / 2, 12, { size: 9, font: FONTS.marker, fill: '#e8453c', lw: 0, rot: -0.03 });
  const notes = ['#ffd23f', '#ff8fc0', '#7ee0c8'];
  notes.forEach((c, i) => {
    const nx = 5 + i * ((w - 10) / 3) + (w - 10) / 6, ny = 26 + (i % 2) * 2;
    g.save();
    g.translate(nx, ny);
    g.rotate((i - 1) * 0.13);
    shape(g, rrectPts(-9, -9, 18, 17, 0.6), { fill: c, lw: 1.1, amp: 0.25, seed: seed + 5 + i });
    for (let l = 0; l < 3; l++) stroke(g, [[-6, -4 + l * 4], [5 - l * 2.4, -4 + l * 4]], { lw: 0.8, color: rgba(INK, 0.65), amp: 0.2, seed: seed + l });
    dot(g, 0, -8, 1.5, '#e8453c');
    g.restore();
  });
  stickersCm(g, w - 9, h - 7, 2, seed + 9);
}

function calendarFace(g, w, h, seed, accent) {
  shape(g, rrectPts(0, 0, w, h, 2), { fill: '#1d1838', lw: 2.2, amp: 0.4, seed });
  text(g, 'PUNCH IN', w / 2, 11, { size: 7.5, font: FONTS.sign, fill: '#ffd23f', lw: 0 });
  text(g, 'EVERY DAY', w / 2, 17, { size: 4, font: FONTS.sign, fill: rgba('#fffaf0', 0.8), lw: 0 });
  const bw = (w - 14) / 7;
  for (let i = 0; i < 7; i++) {
    const x = 7 + i * bw, y = 21;
    shape(g, rrectPts(x + 0.6, y, bw - 1.2, 12, 1.2), { fill: i < 4 ? accent : '#2e2856', lw: 1, amp: 0.2, seed: seed + i });
    text(g, String(i + 1), x + bw / 2, y + 5, { size: 3.4, font: FONTS.sign, fill: i < 4 ? INK : rgba('#fffaf0', 0.7), lw: 0 });
    if (i < 4) stroke(g, [[x + bw * 0.28, y + 8.4], [x + bw * 0.45, y + 10.2], [x + bw * 0.74, y + 6.6]], { lw: 1.1, color: INK, amp: 0.15, seed: seed + i });
  }
  text(g, 'DAY 7 = BIG ONE', w / 2, h - 4.5, { size: 3.6, font: FONTS.sign, fill: '#ff8fc0', lw: 0 });
  drips(g, 4, 2, w - 8, '#ffd23f', seed + 3, { count: 3, maxLen: 6, thick: 1.2, line: null });
}

function tagwallFace(g, w, h, seed) {
  shape(g, rrectPts(0, 0, w, h, 1.5), { fill: '#e9e2d4', lw: 2.2, amp: 0.6, seed });
  const r = mulberry32(seed);
  for (let i = 0; i < 90; i++) {
    g.fillStyle = r() < 0.5 ? rgba('#000000', 0.05) : rgba('#ffffff', 0.4);
    g.fillRect(r() * w, r() * h, 1 + r() * 3, 0.6 + r());
  }
  for (let i = 0; i < 5; i++) tag(g, 10 + r() * (w - 20), 14 + r() * (h - 18), { seed: seed + i, alpha: 0.16, size: 8 + r() * 5 });
  shape(g, rrectPts(w / 2 - 22, 3, 44, 9, 1), { fill: INK, lw: 0, amp: 0.2, seed: seed + 9 });
  text(g, 'TAG WALL', w / 2, 10, { size: 6, font: FONTS.sign, fill: '#7ed957', lw: 0, spacing: 1 });
  // a spray can doodle + a fresh drip
  g.save();
  g.translate(w - 12, h - 10);
  g.rotate(-0.4);
  shape(g, rrectPts(-3, -7, 6, 13, 1.5), { fill: '#ff4f9a', lw: 1, amp: 0.15, seed: seed + 3 });
  shape(g, rrectPts(-2, -10, 4, 3.5, 1), { fill: '#c8c8e0', lw: 0.9, amp: 0.1, seed: seed + 4 });
  g.restore();
  drips(g, 8, h * 0.35, 24, '#ff4f9a', seed + 5, { count: 3, maxLen: 9, thick: 1.3, line: null });
}

function crtFace(g, w, h, seed, title) {
  shape(g, rrectPts(0, 0, w, h, 6), { fill: '#2a2740', lw: 2.2, amp: 0.4, seed });
  shape(g, rrectPts(w * 0.07, 9, w * 0.86, h - 15, 5), { fill: '#05040c', lw: 1.6, amp: 0.3, seed: seed + 1 });
  shape(g, rrectPts(w / 2 - 22, 1.5, 44, 6.5, 2), { fill: '#e8453c', lw: 1, amp: 0.2, seed: seed + 2 });
  text(g, title, w / 2, 6.6, { size: 4.6, font: FONTS.sign, fill: '#ffd23f', lw: 0 });
  dot(g, w * 0.12, h - 3, 1.2, '#7ed957');
}

function readerFace(g, w, h, seed) {
  shape(g, rrectPts(0, 0, w, h, 3), { fill: '#2a2e46', lw: 1.8, amp: 0.3, seed });
  shape(g, rrectPts(2.5, 2.5, w - 5, h * 0.42, 1.5), { fill: '#0d1a12', lw: 1, amp: 0.2, seed: seed + 1 });
  text(g, 'PUNCH', w / 2, 2.5 + h * 0.2, { size: 3.4, font: FONTS.sign, fill: '#7ed957', lw: 0 });
  text(g, 'IN', w / 2, 2.5 + h * 0.36, { size: 3.4, font: FONTS.sign, fill: '#7ed957', lw: 0 });
  shape(g, rrectPts(3, h * 0.62, w - 6, 2.4, 0.6), { fill: '#0a0a12', lw: 0.8, amp: 0.1, seed: seed + 2 });
  stroke(g, [[4, h * 0.62 + 1.2], [w - 4, h * 0.62 + 1.2]], { lw: 0.6, color: '#ffd23f', amp: 0 });
}

function lockersFace(g, w, h, seed, accent) {
  const cols = 2;
  const cw = (w - 4) / cols;
  const colors = ['#4a5fb8', '#2fb7a8'];
  for (let i = 0; i < cols; i++) {
    const x = 2 + i * cw;
    shape(g, rrectPts(x + 0.6, 2, cw - 1.2, h - 4, 1), { fill: colors[i], lw: 1.4, amp: 0.25, seed: seed + i });
    for (let v = 0; v < 4; v++) stroke(g, [[x + cw * 0.25, 8 + v * 2.6], [x + cw * 0.75, 8 + v * 2.6]], { lw: 0.8, color: rgba(INK, 0.55), amp: 0.1 });
    shape(g, rrectPts(x + cw * 0.36, 20, cw * 0.28, 6, 1), { fill: '#fffaf0', lw: 0.8, amp: 0.1, seed: seed + 5 + i });
    text(g, String(17 + i), x + cw / 2, 24.6, { size: 3.6, font: FONTS.sign, fill: INK, lw: 0 });
    shape(g, ellipsePts(x + cw * 0.78, h * 0.55, 1.8, 2.4), { fill: '#ffd23f', lw: 0.8, amp: 0.1, seed: seed + 8 + i });
  }
  shape(g, rrectPts(w / 2 - 17, h - 12, 34, 7, 1), { fill: '#fffaf0', lw: 0.9, amp: 0.2, seed: seed + 11 });
  text(g, 'WARDROBE', w / 2, h - 7, { size: 4.4, font: FONTS.marker, fill: accent, lw: 0, rot: -0.04 });
  stickersCm(g, w * 0.3, h * 0.45, 3, seed + 12, 0.6);
  tag(g, w * 0.66, h * 0.38, { seed: seed + 13, size: 6, alpha: 0.9 });
}

// ---------------------------------------------------------------- the shell (passenger cars)

function drawCeiling(g, L, m, k, seed) {
  quad3(g, L, [[-COVE_X, CEIL, NZ], [COVE_X, CEIL, NZ], [COVE_X, CEIL, END_Z], [-COVE_X, CEIL, END_Z]], { fill: m.ceil, lw: 0, amp: 0 });
  for (const s of [-1, 1]) {
    quad3(g, L, [[s * HALF, WALL_TOP, NZ], [s * COVE_X, CEIL, NZ], [s * COVE_X, CEIL, END_Z], [s * HALF, WALL_TOP, END_Z]], { fill: m.cove, lw: 0, amp: 0 });
  }
  // panel seams across the ceiling
  for (let z = 1.2; z < END_Z; z += 1.6) line3(g, L, [-COVE_X, CEIL, z], [COVE_X, CEIL, z], { color: m.ceilLine, lw: 1 * L.u, amp: 0.2 * L.u });
  // vents down the middle
  for (let z = 2.4; z < END_Z - 0.5; z += 3.2) {
    quad3(g, L, [[-0.16, CEIL, z], [0.16, CEIL, z], [0.16, CEIL, z + 0.7], [-0.16, CEIL, z + 0.7]], { fill: shade(m.ceil, 0.12), lw: 1 * L.u, seed: seed + z * 10 });
    for (let j = 1; j < 6; j++) line3(g, L, [-0.13, CEIL, z + j * 0.11], [0.13, CEIL, z + j * 0.11], { color: rgba(INK, 0.4), lw: 0.8 * L.u, amp: 0 });
  }
  // light tubes: two strips with gaps, baked "on"; the live layer dims flickering ones
  if (!m.old) {
    for (const x of [-0.42, 0.42]) {
      for (let z = 0.9; z < END_Z - 0.5; z += 1.75) {
        const z1 = Math.min(END_Z - 0.3, z + 1.45);
        quad3(g, L, [[x - 0.2, CEIL - 0.002, z - 0.1], [x + 0.2, CEIL - 0.002, z - 0.1], [x + 0.2, CEIL - 0.002, z1 + 0.1], [x - 0.2, CEIL - 0.002, z1 + 0.1]], { fill: m.tubeHalo, lw: 0, amp: 0 });
        quad3(g, L, [[x - 0.11, CEIL - 0.01, z], [x + 0.11, CEIL - 0.01, z], [x + 0.11, CEIL - 0.01, z1], [x - 0.11, CEIL - 0.01, z1]], { fill: m.tube, lw: 1.3 * L.u, seed: seed + Math.round(z * 7 + x * 3) });
      }
    }
  }
  // corner lines
  for (const s of [-1, 1]) {
    line3(g, L, [s * COVE_X, CEIL, NZ], [s * COVE_X, CEIL, END_Z]);
    line3(g, L, [s * HALF, WALL_TOP, NZ], [s * HALF, WALL_TOP, END_Z]);
  }
}

function drawFloor(g, L, m, k, seed, stripes = true) {
  quad3(g, L, [[-HALF, 0, NZ], [HALF, 0, NZ], [HALF, 0, END_Z], [-HALF, 0, END_Z]], { fill: m.floor, lw: 0, amp: 0 });
  // stud grid (only what's on screen)
  g.fillStyle = m.stud;
  for (let z = 1.0; z < END_Z; z += m.old ? 0.3 : 0.2) {
    const s = L.f / z;
    if (m.old) {
      line3(g, L, [-HALF, 0, z], [HALF, 0, z], { color: m.floorEdge, lw: Math.max(0.6, 0.012 * s), amp: 0 });
      continue;
    }
    const r = Math.max(0.5, 0.018 * s);
    for (let x = -1.35; x <= 1.36; x += 0.2) {
      const q = L.P(x, 0, z);
      if (q[1] > L.H + 4 || q[0] < -4 || q[0] > L.W + 4) continue;
      g.beginPath();
      g.ellipse(q[0], q[1], r, r * 0.45, 0, 0, Math.PI * 2);
      g.fill();
    }
  }
  if (m.old) for (let x = -1.2; x <= 1.21; x += 0.3) line3(g, L, [x, 0, NZ], [x, 0, END_Z], { color: rgba(m.floorEdge, 0.6), lw: 0.8 * L.u, amp: 0 });
  // safety stripes at the side doors and the end door
  if (stripes && !m.old) {
    for (const [d0, d1] of DOORS) {
      for (const s of [-1, 1]) {
        quad3(g, L, [[s * 1.18, 0.001, d0], [s * HALF, 0.001, d0], [s * HALF, 0.001, d1], [s * 1.18, 0.001, d1]], { fill: '#ffd23f', lw: 1 * L.u, seed: seed + d0 * 9 + s });
        for (let z = d0 + 0.1; z < d1 - 0.05; z += 0.2) quad3(g, L, [[s * 1.2, 0.002, z], [s * 1.3, 0.002, z], [s * 1.3, 0.002, z + 0.07], [s * 1.2, 0.002, z + 0.07]], { fill: INK, lw: 0, amp: 0 });
      }
    }
    quad3(g, L, [[-0.55, 0.001, END_Z - 0.35], [0.55, 0.001, END_Z - 0.35], [0.55, 0.001, END_Z], [-0.55, 0.001, END_Z]], { fill: '#ffd23f', lw: 1 * L.u, seed: seed + 3 });
  }
  // floor/wall corners
  for (const s of [-1, 1]) line3(g, L, [s * HALF, 0, NZ], [s * HALF, 0, END_Z], { color: m.floorEdge });
}

function drawEndWall(g, L, m, kd, k, seed, opts = {}) {
  const z = END_Z;
  // wall + cove corners
  shape(g, [
    p2(L, [-HALF, 0, z]), p2(L, [HALF, 0, z]), p2(L, [HALF, WALL_TOP, z]), p2(L, [COVE_X, CEIL, z]),
    p2(L, [-COVE_X, CEIL, z]), p2(L, [-HALF, WALL_TOP, z]),
  ], { fill: m.end, lw: lwAt(L, L.f / z), smooth: false, amp: 0.3 * L.u, seed });
  if (opts.noDoor) return;
  // door
  box3(g, L, { x0: -0.48, x1: 0.48, y0: 0, y1: 2.06, z0: z - 0.001, d: 0 }, { fill: shade(m.door, 0.35), seed: seed + 1 });
  face(g, L, -0.42, 2.0, z - 0.002, (gg) => {
    shape(gg, rrectPts(0, 0, 84, 200, 3), { fill: m.door, lw: 2, amp: 0.3, seed: seed + 2 });
    // window onto the gangway / next car
    shape(gg, rrectPts(14, 26, 56, 70, 6), { fill: opts.window || '#2a2236', lw: 1.8, amp: 0.3, seed: seed + 3 });
    if (opts.glowNext) {
      const gr = gg.createRadialGradient(42, 60, 4, 42, 60, 46);
      gr.addColorStop(0, rgba(opts.glowNext, 0.85));
      gr.addColorStop(1, rgba(opts.glowNext, 0.1));
      gg.fillStyle = gr;
      gg.beginPath();
      gg.roundRect ? gg.roundRect(15, 27, 54, 68, 5) : gg.rect(15, 27, 54, 68);
      gg.fill();
      // the next car's door far away
      shape(gg, rrectPts(32, 44, 20, 46, 2), { fill: rgba('#1a1430', 0.55), lw: 1, amp: 0.2, seed: seed + 4 });
    }
    gg.fillStyle = rgba('#ffffff', 0.18);
    gg.beginPath();
    gg.moveTo(20, 30); gg.lineTo(34, 30); gg.lineTo(18, 80); gg.lineTo(16, 70); gg.fill();
    // handle + number plate + graffiti
    shape(gg, rrectPts(64, 110, 7, 26, 3), { fill: '#e1e6ee', lw: 1.4, amp: 0.2, seed: seed + 5 });
    shape(gg, rrectPts(26, 104, 32, 14, 2), { fill: '#16141d', lw: 1.2, amp: 0.2, seed: seed + 6 });
    text(gg, 'EXIT', 42, 114, { size: 8, font: FONTS.sign, fill: '#7ed957', lw: 0 });
    tag(gg, 40, 160, { word: kd.words[1] || 'DRIP', color: kd.spray[0], size: 18, seed: seed + 7, rot: -0.12 });
    stickersCm(gg, 20, 140, 3, seed + 8);
  });
  // big graffiti flanking the door
  face(g, L, -HALF, WALL_TOP, z - 0.003, (gg) => {
    throwup(gg, 47, 120, { word: kd.short[1], fill: kd.spray[1] || '#ffd23f', size: 22, seed: seed + 9, rot: -0.08 });
    tag(gg, 52, 52, { word: kd.words[2] || 'NOVA', color: kd.spray[2] || '#ff4f9a', size: 16, seed: seed + 10 });
    stickersCm(gg, 30, 175, 4, seed + 11);
  });
  face(g, L, 0.5, WALL_TOP, z - 0.003, (gg) => {
    throwup(gg, 50, 95, { word: kd.short[2], fill: kd.spray[3] || kd.spray[0], size: 20, seed: seed + 12, rot: 0.07 });
    tag(gg, 45, 160, { word: kd.words[4] || 'OKAY', color: kd.spray[0], size: 14, seed: seed + 13 });
    // a little route map strip
    shape(gg, rrectPts(10, 18, 80, 14, 2), { fill: '#16141d', lw: 1.2, amp: 0.2, seed: seed + 14 });
    stroke(gg, [[16, 25], [84, 25]], { lw: 2, color: '#ff4f9a', amp: 0 });
    for (let i = 0; i < 7; i++) dot(gg, 16 + i * 11.3, 25, i === (typeof kd.n === 'number' ? kd.n - 1 : 0) ? 2.6 : 1.8, i === (typeof kd.n === 'number' ? kd.n - 1 : 0) ? '#ffd23f' : '#fffaf0');
  });
}

function seatSegments(sec, skip) {
  // split a seat section around skipped z ranges (where props stand)
  let parts = [sec];
  for (const [s0, s1] of skip || []) {
    const next = [];
    for (const [a, b] of parts) {
      if (s1 <= a || s0 >= b) next.push([a, b]);
      else {
        if (s0 > a) next.push([a, s0]);
        if (s1 < b) next.push([s1, b]);
      }
    }
    parts = next;
  }
  return parts.filter(([a, b]) => b - a > 0.3);
}

function drawSideWall(g, L, m, kd, plan, side, k, seed) {
  const xw = side * HALF;
  const r = mulberry32(seed + (side > 0 ? 77 : 33));
  const ads = plan.old ? OLD_ADS : ADS;
  // far to near so nearer pieces overlap farther ones
  const runs = [];
  SECTIONS.forEach((sec, i) => runs.push({ type: 'sec', z0: sec[0], z1: sec[1], i }));
  DOORS.forEach((d, i) => runs.push({ type: 'door', z0: d[0], z1: d[1], i }));
  runs.sort((a, b) => b.z0 - a.z0);
  const glass = [];
  const panes = [];
  for (const run of runs) {
    const { z0, z1 } = run;
    // wall plane
    quad3(g, L, [[xw, 0, z0], [xw, WALL_TOP, z0], [xw, WALL_TOP, z1], [xw, 0, z1]], { fill: m.wall, lw: 0, amp: 0 });
    if (run.type === 'sec') {
      // window band: pillars + framed windows
      const span = z1 - z0 - 0.3;
      const n = Math.max(1, Math.round(span / 1.25));
      const wlen = span / n;
      for (let w = n - 1; w >= 0; w--) {
        const a = z0 + 0.15 + w * wlen + 0.07, b = a + wlen - 0.14;
        if (b < NZ + 0.05) continue;
        shape(g, wallRR(xw, Math.max(NZ, a - 0.04), b + 0.04, WIN_Y0 - 0.04, WIN_Y1 + 0.04, 0.09).map((p) => p2(L, p)), { fill: m.frame, shade: m.frameSh, sdx: 1.5 * L.u, sdy: 1.5 * L.u, lw: lwAt(L, L.f / ((a + b) / 2)), amp: 0.3 * L.u, seed: seed + w * 13 + run.i });
        glass.push(wallRR(xw, Math.max(NZ, a), b, WIN_Y0, WIN_Y1, 0.07).map((p) => p2(L, p)));
        panes.push({ z0: Math.max(NZ, a), z1: b });
      }
      // ad strip
      const an = Math.max(1, Math.floor((z1 - z0 - 0.2) / 1.0));
      const alen = (z1 - z0 - 0.2) / an;
      for (let a = 0; a < an; a++) {
        const za = z0 + 0.1 + a * alen;
        if (za + alen < NZ + 0.2) continue;
        const ad = ads[(hashStr(`${plan.kind}${side}${run.i}${a}`) >>> 0) % ads.length];
        const tex = adTex(L, k, Math.max(NZ, za), ad, hashStr(ad.title) % 997);
        xDecal(g, L, side, xw, za + alen / 2, (AD_Y0 + AD_Y1) / 2, alen - 0.06, AD_Y1 - AD_Y0, tex);
      }
      line3(g, L, [xw, AD_Y0 - 0.015, z0], [xw, AD_Y0 - 0.015, z1], { color: m.frameSh, lw: 1.2 * L.u });
    } else {
      // side door: frame, two leaves with windows, rubber seam
      const mid = (z0 + z1) / 2;
      quad3(g, L, [[xw, 0, z0], [xw, 2.04, z0], [xw, 2.04, z1], [xw, 0, z1]], { fill: shade(m.door, 0.3), seed: seed + 50 + run.i });
      for (const [a, b] of [[z0 + 0.04, mid - 0.01], [mid + 0.01, z1 - 0.04]]) {
        if (b < NZ) continue;
        quad3(g, L, [[xw, 0.02, Math.max(NZ, a)], [xw, 2.0, Math.max(NZ, a)], [xw, 2.0, b], [xw, 0.02, b]], { fill: m.door, shade: m.doorSh, sdx: 1.4 * L.u, sdy: 0, seed: seed + 60 + a * 10 });
        const wa = Math.max(NZ, a + 0.12), wb = b - 0.12;
        if (wb > wa + 0.05) glass.push(wallRR(xw, wa, wb, 1.02, 1.82, 0.06).map((p) => p2(L, p)));
      }
      line3(g, L, [xw, 0.02, mid], [xw, 2.0, mid], { color: m.rubber, lw: lwAt(L, L.f / mid, 1.4) });
    }
  }
  // punch the glass now, before anything is drawn in front of it
  g.save();
  g.globalCompositeOperation = 'destination-out';
  g.fillStyle = '#000';
  for (const pts of glass) {
    g.beginPath();
    pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
    g.closePath();
    g.fill();
  }
  g.restore();
  // glass: faint reflection, scratchiti, marker tags and stickers on the panes
  for (const pts of glass) {
    g.save();
    g.beginPath();
    pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
    g.closePath();
    g.clip();
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    for (const [x, y] of pts) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
    const gr = g.createLinearGradient(x0, y0, x1, y1);
    gr.addColorStop(0, plan.old ? 'rgba(160,255,220,0.10)' : 'rgba(170,200,255,0.10)');
    gr.addColorStop(0.5, 'rgba(255,255,255,0)');
    gr.addColorStop(1, 'rgba(255,255,255,0.05)');
    g.fillStyle = gr;
    g.fillRect(x0, y0, x1 - x0, y1 - y0);
    g.strokeStyle = 'rgba(235,240,255,0.4)';
    g.lineWidth = 0.9 * L.u;
    const sc = Math.max(1, Math.round((x1 - x0) / 30));
    for (let i = 0; i < sc; i++) {
      const sx = x0 + r() * (x1 - x0), sy = y0 + r() * (y1 - y0);
      const w = (x1 - x0) * (0.1 + r() * 0.15);
      g.beginPath();
      g.moveTo(sx, sy);
      for (let j = 1; j <= 4; j++) g.lineTo(sx + (w * j) / 4, sy + (r() - 0.5) * (y1 - y0) * 0.12);
      g.stroke();
    }
    g.restore();
  }
  // marker tags written on the glass
  const MARKER = plan.old ? ['#e8fff6', '#9fffe0'] : ['#fffaf0', '#ff8fc0', '#bff3ff', '#b8ff9a', '#ffd23f'];
  panes.forEach((pn, i) => {
    if (pn.z1 > 7.2 || r() < 0.35) return;
    const word = kd.words[(i + (side > 0 ? 3 : 0)) % kd.words.length];
    const tex = tagTex(L, k, pn.z0, word, MARKER[(i + (side > 0 ? 1 : 0)) % MARKER.length], seed + 140 + i * 3 + (side > 0 ? 1 : 0), 30);
    const wm = Math.min(0.95, (pn.z1 - pn.z0) * 0.82);
    xDecal(g, L, side, xw - side * 0.004, (pn.z0 + pn.z1) / 2, 1.38 + (r() - 0.5) * 0.2, wm, wm * 0.46, tex);
  });
  // graffiti on the door leaves and window pillars
  DOORS.forEach(([d0, d1], i) => {
    if (d1 < NZ + 0.3) return;
    const mid = (d0 + d1) / 2;
    const word = kd.words[(i * 2 + (side > 0 ? 1 : 0)) % kd.words.length];
    const short = (SHORT[plan.kind] || SHORT.front)[(i + (side > 0 ? 1 : 0)) % 3];
    const col = kd.spray[(i + (side > 0 ? 2 : 0)) % kd.spray.length];
    if (r() < 0.6) {
      const tex = throwTex(L, k, d0, short, col, seed + i * 5 + (side > 0 ? 3 : 0), 40);
      xDecal(g, L, side, xw - side * 0.003, mid, 0.62, 1.15, 0.58, tex);
    } else {
      const tex = tagTex(L, k, d0, word, col, seed + i * 5 + 1, 34);
      xDecal(g, L, side, xw - side * 0.003, mid, 0.7, 1.05, 0.5, tex);
    }
    const st = stickerTex(L, k, d0, seed + i * 7 + (side > 0 ? 2 : 0), 4);
    xDecal(g, L, side, xw - side * 0.003, d0 + 0.2, 1.4, 0.32, 0.26, st);
  });
  // tags over the ad strip
  for (let i = 0; i < 3; i++) {
    const z = 2 + r() * (END_Z - 3);
    const word = kd.words[(i + 3) % kd.words.length];
    const tex = tagTex(L, k, z - 0.5, word, kd.spray[(i + 1) % kd.spray.length], seed + 90 + i * 3 + side, 30);
    xDecal(g, L, side, xw - side * 0.004, z, AD_Y0 + 0.08, 0.95, 0.42, tex);
  }
  return glass;
}

function drawCove(g, L, m, kd, k, seed) {
  // tags along the sloped cove panels
  const r = mulberry32(seed + 5);
  for (const side of [-1, 1]) {
    for (let i = 0; i < 2; i++) {
      const z = 3 + i * 3.6 + r() * 1.5;
      const word = kd.words[(i + (side > 0 ? 2 : 0)) % kd.words.length];
      const tex = tagTex(L, k, z - 0.6, word, kd.spray[(i + 2) % kd.spray.length], seed + 30 + i + side * 7, 28);
      const w = 1.1, hm = 0.38;
      const O = side < 0 ? [-COVE_X, CEIL - 0.003, z - w / 2] : [COVE_X, CEIL - 0.003, z + w / 2];
      const U = side < 0 ? [0, 0, w] : [0, 0, -w];
      const V = side < 0 ? [-(HALF - COVE_X), -(CEIL - WALL_TOP), 0] : [HALF - COVE_X, -(CEIL - WALL_TOP), 0];
      // keep the tag within the cove by scaling V to its height
      mapPlane(g, L, O, U, mul3(V, hm / (CEIL - WALL_TOP) > 1 ? 1 : 1), tex);
    }
  }
}

function drawSeats(g, L, m, kd, plan, side, seed, K = 1) {
  const sx = side * SEAT_X, bx = side * BACK_X;
  const skip = side < 0 ? plan.skipLeft : plan.skipRight;
  const secs = [];
  for (const sec of SECTIONS) for (const part of seatSegments([sec[0] + 0.08, sec[1] - 0.08], skip)) secs.push(part);
  secs.sort((a, b) => b[0] - a[0]);
  for (const [a, b] of secs) {
    const n = Math.max(1, Math.round((b - a) / 0.47));
    const len = (b - a) / n;
    for (let i = n - 1; i >= 0; i--) {
      const z0 = Math.max(NZ, a + i * len + 0.015), z1 = a + (i + 1) * len - 0.015;
      if (z1 <= NZ + 0.02) continue;
      const c = i % 2 ? kd.seat2 : kd.seat;
      const sd = seed + Math.round(z0 * 31) + (side > 0 ? 500 : 0);
      // backrest against the wall
      quad3(g, L, [[bx, SEAT_Y, z0 + 0.02], [bx, BACK_Y, z0 + 0.05], [bx, BACK_Y, z1 - 0.05], [bx, SEAT_Y, z1 - 0.02]], { fill: shade(c, 0.1), shade: shade(c, 0.28), sdx: 0, sdy: 2 * L.u, seed: sd });
      // seat top
      quad3(g, L, [[sx, SEAT_Y, z0], [bx, SEAT_Y, z0], [bx, SEAT_Y, z1], [sx, SEAT_Y, z1]], { fill: tint(c, 0.14), seed: sd + 1 });
      // seat front
      quad3(g, L, [[sx, 0.14, z0], [sx, SEAT_Y, z0], [sx, SEAT_Y, z1], [sx, 0.14, z1]], { fill: c, shade: shade(c, 0.22), sdx: 0, sdy: -2 * L.u, seed: sd + 2 });
      // marker tag on the backrest now and then
      if (z0 < 6 && (hashStr(`${plan.kind}:${side}:${Math.round(z0 * 10)}`) % 3) === 0) {
        const word = kd.words[(Math.round(z0 * 7) + (side > 0 ? 1 : 0)) % kd.words.length];
        const col = ['#fffaf0', INK, '#ffd23f', '#ff4f9a'][hashStr(word + side) % 4];
        const tex = tagTex(L, K, z0, word, col === c ? '#fffaf0' : col, sd + 9, 28);
        const wm = (z1 - z0) * 0.9;
        xDecal(g, L, side, bx - side * 0.003, (z0 + z1) / 2, 0.72, wm, Math.min(0.34, wm * 0.46), tex);
      }
    }
    // dark kick recess under the bench
    quad3(g, L, [[sx + side * 0.08, 0.001, Math.max(NZ, a)], [sx + side * 0.08, 0.14, Math.max(NZ, a)], [sx + side * 0.08, 0.14, b], [sx + side * 0.08, 0.001, b]], { fill: m.kick, lw: 0, amp: 0 });
  }
}

function drawRails(g, L, m, front) {
  // grab rails along the car + brackets to the ceiling (background part only)
  for (const s of [-1, 1]) {
    const x = s * RAIL_X;
    const zNear = front ? NZ + 0.05 : 2.4;
    const zFar = END_Z - 0.35;
    if (!front) tube3(g, L, [x, RAIL_Y, zNear], [x, RAIL_Y, zFar], 0.017, m.rail, { hi: rgba('#ffffff', 0.7) });
    else tube3(g, L, [x, RAIL_Y, zNear], [x, RAIL_Y, 2.4], 0.017, m.rail, { hi: rgba('#ffffff', 0.7) });
    for (let z = 1.2; z < zFar; z += 1.6) {
      if (front ? z >= 2.4 : z < 2.4) continue;
      tube3(g, L, [x, RAIL_Y, z], [x, CEIL, z], 0.011, m.rail);
    }
  }
}

function drawPole(g, L, m, x, z, top = RAIL_Y) {
  tube3(g, L, [x, 0, z], [x, top, z], 0.021, m.rail, { hi: rgba('#ffffff', 0.75) });
  // stickers wrapped on the pole
  const q = L.P(x, 1.15, z);
  const s = q[2];
  const r = mulberry32(Math.round(z * 100 + x * 10));
  for (let i = 0; i < 2; i++) {
    const y = q[1] + (r() - 0.5) * s * 0.4;
    g.fillStyle = ['#ff4f9a', '#ffd23f', '#3ec7b0', '#7b5cff'][Math.floor(r() * 4)];
    g.fillRect(q[0] - s * 0.02, y, s * 0.04, s * 0.05);
  }
}

// ---------------------------------------------------------------- props

function hangWires(g, L, x0, x1, y1, z, m) {
  for (const x of [x0 + 0.06, x1 - 0.06]) line3(g, L, [x, y1, z], [x, CEIL, z], { color: m.frameSh, lw: 1 * L.u, amp: 0 });
}

function drawHang(g, L, p, m) {
  const x0 = p.x - p.w / 2, x1 = p.x + p.w / 2;
  hangWires(g, L, x0, x1, p.y1, p.z, m);
  face(g, L, x0, p.y1, p.z, (gg) => p.face(gg, p.w * 100, (p.y1 - p.y0) * 100));
}

function drawCarSign(g, L, kd, m, state, n, label) {
  const x0 = -SIGN_W / 2, x1 = SIGN_W / 2;
  hangWires(g, L, x0, x1, SIGN_Y1, SIGN_Z, m);
  face(g, L, x0, SIGN_Y1, SIGN_Z, (gg) => signFace(gg, SIGN_W * 100, (SIGN_Y1 - SIGN_Y0) * 100, n, label, kd.accent));
}

// counters that stand in the near-right foreground of each shop car
function drawCounter(g, L, p, kind, kd, seed) {
  const b = { x0: p.x0, x1: p.x1, y0: 0, y1: p.y1, z0: p.z, d: 0.5 };
  const w = (p.x1 - p.x0) * 100, h = p.y1 * 100;
  if (kind === 'threads') {
    box3(g, L, b, { fill: '#f4efe6', top: '#fffaf0', seed, front: (gg) => {
      shape(gg, rrectPts(0, 0, w, 6, 1), { fill: '#2a2238', lw: 1.4, amp: 0.2, seed: seed + 1 });
      for (let i = 0; i < 3; i++) stroke(gg, [[4, 14 + i * 9], [w - 4, 14 + i * 9]], { lw: 1.6, color: i === 1 ? '#ff4f9a' : rgba(INK, 0.25), amp: 0.2 });
      tag(gg, w * 0.5, h * 0.75, { word: 'DRIP', color: '#ff4f9a', size: 12, seed: seed + 2 });
    } });
    // stacks of folded tees on top
    const cols = ['#ffd23f', '#ff4f9a', '#3ec7b0', '#7b5cff', '#f4efe6', '#e8453c'];
    for (let s = 0; s < 3; s++) {
      const x = p.x0 + 0.06 + s * ((p.x1 - p.x0 - 0.12) / 3);
      for (let j = 0; j < 4; j++) box3(g, L, { x0: x, x1: x + 0.13, y0: p.y1 + j * 0.035, y1: p.y1 + (j + 1) * 0.035, z0: p.z + 0.12, d: 0.2 }, { fill: cols[(s * 2 + j) % cols.length], seed: seed + 10 + s * 5 + j });
    }
    face(g, L, p.x1 - 0.2, p.y1 + 0.2, p.z + 0.05, (gg) => {
      shape(gg, rrectPts(0, 0, 18, 12, 1), { fill: '#ffd23f', lw: 1, amp: 0.2, seed: seed + 30 });
      text(gg, 'NEW', 9, 6, { size: 4.5, font: FONTS.sign, fill: INK, lw: 0 });
      text(gg, 'DROP', 9, 10.6, { size: 4.5, font: FONTS.sign, fill: INK, lw: 0 });
    });
  } else if (kind === 'kicks') {
    // shoe boxes stacked into a bench, two pairs on top
    const cols = ['#ff8a3d', '#2a2238', '#e8453c', '#f4efe6'];
    for (let row = 0; row < 3; row++) {
      for (let i = 0; i < 2; i++) {
        const x0 = p.x0 + i * ((p.x1 - p.x0) / 2), x1 = x0 + (p.x1 - p.x0) / 2 - 0.01;
        box3(g, L, { x0, x1, y0: row * 0.26, y1: row * 0.26 + 0.25, z0: p.z, d: 0.34 }, { fill: cols[(row + i) % cols.length], seed: seed + row * 3 + i, front: (gg, fw, fh) => {
          stroke(gg, [[3, fh * 0.32], [fw - 3, fh * 0.32]], { lw: 1, color: rgba(INK, 0.5), amp: 0.1 });
          text(gg, 'SOLE', fw / 2, fh * 0.75, { size: fh * 0.3, font: FONTS.sign, fill: rgba('#fffaf0', 0.85), lw: 0 });
        } });
      }
    }
    face(g, L, p.x0 + 0.04, 0.78 + 0.22, p.z + 0.1, (gg) => {
      drawProduct(gg, { type: 'high', c: '#f4efe6', a: '#ff4f9a', s: '#f4efe6' }, 14, 13, 0.24, seed + 40);
      drawProduct(gg, { type: 'low', c: '#3ec7b0', a: '#ffd23f', s: '#f4efe6' }, 36, 15, 0.22, seed + 41);
    });
  } else if (kind === 'lids') {
    box3(g, L, b, { fill: '#2a2238', seed, front: (gg) => {
      text(gg, 'LIDS', w / 2, h * 0.5, { size: Math.min(18, h * 0.3), font: FONTS.sign, fill: '#3ec7b0', lw: 0 });
      stickersCm(gg, w * 0.28, h * 0.8, 3, seed + 3, 0.7);
    } });
    // two mannequin heads on stands wearing hats
    const heads = [{ x: p.x0 + 0.13, cap: { type: 'cap', c: '#ffd23f', a: '#2a2238' } }, { x: p.x1 - 0.13, cap: { type: 'beanie', c: '#ff4f9a', a: '#c93276' } }];
    for (const hd of heads) {
      line3(g, L, [hd.x, p.y1, p.z + 0.18], [hd.x, p.y1 + 0.08, p.z + 0.18], { color: '#c8c8e0', lw: lwAt(L, L.f / p.z, 1.5) });
      face(g, L, hd.x - 0.13, p.y1 + 0.36, p.z + 0.18, (gg) => {
        shape(gg, ellipsePts(13, 17, 10, 12), { fill: '#e8dccb', shade: '#cdbfa8', sdx: 1.5, sdy: 1.5, lw: 1.4, amp: 0.2, seed: seed + 50 });
        drawProduct(gg, hd.cap, 13, 8, 0.24, seed + 51);
      });
    }
  } else if (kind === 'ice') {
    // a glass jewelry case
    box3(g, L, { ...b, y1: p.y1 - 0.2 }, { fill: '#2a2238', seed, front: (gg, fw, fh) => {
      text(gg, 'ICE', fw / 2, fh * 0.62, { size: Math.min(20, fh * 0.42), font: FONTS.sign, fill: '#bff3ff', lw: 0 });
    } });
    box3(g, L, { x0: p.x0, x1: p.x1, y0: p.y1 - 0.2, y1: p.y1, z0: p.z, d: 0.5 }, { fill: 'rgba(191,243,255,0.28)', top: 'rgba(191,243,255,0.22)', side: 'rgba(160,220,240,0.3)', seed: seed + 2 });
    face(g, L, p.x0 + 0.04, p.y1 - 0.02, p.z + 0.25, (gg) => {
      const ww = (p.x1 - p.x0 - 0.08) * 100;
      drawProduct(gg, { type: 'chain', c: '#ffd23f', g: 'drop' }, ww * 0.28, 9, 0.3, seed + 60);
      drawProduct(gg, { type: 'grill', c: '#ffd23f', a: '#bff3ff' }, ww * 0.74, 10, 0.24, seed + 61);
      for (let i = 0; i < 5; i++) dot(gg, 4 + ((i * 37) % 100) / 100 * ww, 4 + (i % 3) * 5, 0.9, '#fffaf0');
    });
  } else if (kind === 'ghost') {
    box3(g, L, b, { fill: '#5a3a22', top: '#7a5434', seed, front: (gg) => {
      shape(gg, rrectPts(4, 4, w - 8, h - 8, 2), { fill: null, lw: 1.2, line: '#c9a14a', amp: 0.2, seed: seed + 1 });
      text(gg, 'LOST', w / 2, h * 0.45, { size: Math.min(13, h * 0.2), font: FONTS.sign, fill: '#e8d8a8', lw: 0 });
      text(gg, '& FOUND', w / 2, h * 0.65, { size: Math.min(9, h * 0.14), font: FONTS.sign, fill: '#e8d8a8', lw: 0 });
    } });
    // a brass bell + an old lantern on the counter
    face(g, L, p.x0 + 0.05, p.y1 + 0.24, p.z + 0.2, (gg) => {
      shape(gg, ellipsePts(8, 20, 7, 2), { fill: '#8a6a2a', lw: 1, amp: 0.1, seed: seed + 70 });
      shape(gg, [[2, 20], [3, 12], [8, 9], [13, 12], [14, 20]], { fill: '#e0bd62', lw: 1.2, amp: 0.2, seed: seed + 71 });
      drawProduct(gg, { type: 'lantern', c: '#9fffe0' }, 34, 12, 0.2, seed + 72);
    });
  }
}

function drawLockers(g, L, p, kd, seed) {
  box3(g, L, { x0: p.x0, x1: p.x1, y0: 0, y1: p.y1, z0: p.z, d: 0.45 }, { fill: '#3a4a8c', top: '#56689f', seed, front: (gg, w, h) => lockersFace(gg, w, h, seed, kd.accent) });
}

function drawReader(g, L, p, seed) {
  box3(g, L, { x0: p.x0, x1: p.x1, y0: p.y0, y1: p.y1, z0: p.z, d: 0.12 }, { fill: '#2a2e46', seed, front: (gg, w, h) => readerFace(gg, w, h, seed) });
}

function capsuleMachine(g, L, p, deluxe, seed) {
  const x0 = p.x0, x1 = p.x1, z = p.z;
  const w = x1 - x0;
  const base = deluxe ? '#d4a028' : '#e8453c';
  // stand + cabinet
  box3(g, L, { x0: x0 + w * 0.12, x1: x1 - w * 0.12, y0: 0, y1: 0.62, z0: z + 0.05, d: 0.3 }, { fill: shade(base, 0.25), seed });
  box3(g, L, { x0, x1, y0: 0.62, y1: 1.0, z0: z, d: 0.4 }, { fill: base, seed: seed + 1, front: (gg, fw, fh) => {
    shape(gg, rrectPts(fw * 0.12, 4, fw * 0.76, 10, 2), { fill: '#16141d', lw: 1.2, amp: 0.2, seed: seed + 2 });
    text(gg, deluxe ? 'DELUXE' : 'BASIC', fw / 2, 11.5, { size: Math.min(7, fw * 0.16), font: FONTS.sign, fill: deluxe ? '#ffd23f' : '#fffaf0', lw: 0 });
    shape(gg, ellipsePts(fw / 2, fh * 0.62, 6, 6), { fill: '#c8c8e0', lw: 1.3, amp: 0.2, seed: seed + 3 });
    stroke(gg, [[fw / 2 - 4, fh * 0.62], [fw / 2 + 4, fh * 0.62]], { lw: 1.6, color: INK, amp: 0 });
    shape(gg, rrectPts(fw / 2 - 7, fh - 9, 14, 7, 2), { fill: '#16141d', lw: 1.2, amp: 0.2, seed: seed + 4 });
    if (deluxe) for (let i = 0; i < 4; i++) dot(gg, 6 + i * (fw - 12) / 3, fh * 0.35, 1.4, '#fffaf0');
  } });
  // glass dome full of capsules (front-facing)
  const dw = w * (L.wide ? 1.08 : 1.0), dcx = (x0 + x1) / 2, dy = 1.0 + dw * 0.5;
  face(g, L, dcx - dw / 2, dy + dw / 2, z + 0.2, (gg) => {
    const R = dw * 50;
    shape(gg, ellipsePts(R, R, R, R), { fill: deluxe ? 'rgba(200,170,255,0.35)' : 'rgba(210,240,255,0.32)', lw: 2, amp: 0.3, seed: seed + 5 });
    const r = mulberry32(seed + 9);
    const cols = deluxe ? ['#ffd23f', '#b48cff', '#ff4f9a', '#9fffe0', '#fffaf0'] : ['#ff4f9a', '#3ec7b0', '#ffd23f', '#7b5cff', '#ff8a3d', '#7ed957'];
    gg.save();
    gg.beginPath();
    gg.arc(R, R, R * 0.92, 0, Math.PI * 2);
    gg.clip();
    for (let i = 0; i < 26; i++) {
      const a = r() * Math.PI * 2, d = Math.sqrt(r()) * R * 0.85;
      const cx = R + Math.cos(a) * d, cy = R + Math.abs(Math.sin(a)) * d * 0.9 + R * 0.1;
      const cr = R * 0.17;
      gg.fillStyle = INK;
      gg.beginPath(); gg.arc(cx, cy, cr + 0.9, 0, Math.PI * 2); gg.fill();
      gg.fillStyle = cols[i % cols.length];
      gg.beginPath(); gg.arc(cx, cy, cr, Math.PI, 0); gg.fill();
      gg.fillStyle = 'rgba(240,236,255,0.85)';
      gg.beginPath(); gg.arc(cx, cy, cr, 0, Math.PI); gg.fill();
    }
    gg.restore();
    gg.fillStyle = 'rgba(255,255,255,0.45)';
    gg.beginPath();
    gg.ellipse(R * 0.62, R * 0.5, R * 0.24, R * 0.12, -0.6, 0, Math.PI * 2);
    gg.fill();
    shape(gg, rrectPts(R * 0.7, -R * 0.12, R * 0.6, R * 0.18, R * 0.06), { fill: shade(base, 0.2), lw: 1.4, amp: 0.2, seed: seed + 7 });
  });
}

function clawMachine(g, L, p, seed) {
  const { x0, x1, z } = p;
  box3(g, L, { x0, x1, y0: 0, y1: 0.78, z0: z, d: 0.5 }, { fill: '#e8456b', seed, front: (gg, fw, fh) => {
    shape(gg, rrectPts(fw * 0.1, 8, fw * 0.3, 18, 2), { fill: '#2a2238', lw: 1.2, amp: 0.2, seed: seed + 1 });
    shape(gg, rrectPts(fw * 0.45, fh - 22, fw * 0.45, 16, 2), { fill: '#b82e52', lw: 1.2, amp: 0.2, seed: seed + 2 });
    text(gg, 'PRIZE', fw * 0.675, fh - 11, { size: 6, font: FONTS.sign, fill: '#fffaf0', lw: 0 });
  } });
  box3(g, L, { x0: x0 - 0.02, x1: x1 + 0.02, y0: 0.76, y1: 0.84, z0: z - 0.02, d: 0.54 }, { fill: '#ffd23f', seed: seed + 3 });
  // glass box
  box3(g, L, { x0, x1, y0: 0.84, y1: 1.52, z0: z, d: 0.5 }, { fill: 'rgba(42,34,82,0.92)', top: '#2a2252', side: 'rgba(42,34,82,0.9)', seed: seed + 4, front: (gg, fw, fh) => {
    const r = mulberry32(seed + 8);
    const cols = ['#ffd23f', '#ff4f9a', '#3ec7b0', '#5aa0ff', '#ff8a3d', '#b48cff'];
    for (let i = 0; i < 9; i++) {
      const cx = 6 + r() * (fw - 12), cy = fh - 6 - r() * 10, cr = 4.2;
      gg.fillStyle = INK; gg.beginPath(); gg.arc(cx, cy, cr + 0.8, 0, Math.PI * 2); gg.fill();
      gg.fillStyle = cols[i % cols.length]; gg.beginPath(); gg.arc(cx, cy, cr, Math.PI, 0); gg.fill();
      gg.fillStyle = 'rgba(240,236,255,0.85)'; gg.beginPath(); gg.arc(cx, cy, cr, 0, Math.PI); gg.fill();
    }
    stroke(gg, [[3, 6], [fw - 3, 6]], { lw: 1.4, color: '#c8c8e0', amp: 0 });
    gg.fillStyle = 'rgba(255,255,255,0.14)';
    gg.beginPath(); gg.moveTo(fw * 0.12, 0); gg.lineTo(fw * 0.3, 0); gg.lineTo(fw * 0.08, fh * 0.8); gg.lineTo(fw * 0.04, fh * 0.5); gg.fill();
  } });
  box3(g, L, { x0: x0 - 0.03, x1: x1 + 0.03, y0: 1.52, y1: 1.72, z0: z - 0.03, d: 0.56 }, { fill: '#e8456b', seed: seed + 5, front: (gg, fw, fh) => {
    shape(gg, rrectPts(3, 3, fw - 6, fh - 6, 3), { fill: '#2a1a3a', lw: 1.2, amp: 0.2, seed: seed + 6 });
    text(gg, 'THE GRABBER', fw / 2, fh * 0.66, { size: Math.min(8, (fw - 8) / 7.5), font: FONTS.sign, fill: '#ffd23f', lw: 0 });
  } });
}

function runnerCabinet(g, L, p, seed) {
  // a classic cabinet standing against a wall, seen at an angle
  const { x0, x1, z } = p;
  box3(g, L, { x0, x1, y0: 0, y1: 1.78, z0: z, d: 0.55 }, { fill: '#2b6cff', side: '#1d47b0', seed, front: (gg, fw, fh) => {
    shape(gg, rrectPts(4, 4, fw - 8, 22, 3), { fill: '#ffd23f', lw: 1.4, amp: 0.2, seed: seed + 1 });
    text(gg, 'TUNNEL', fw / 2, 13.5, { size: Math.min(9, fw * 0.17), font: FONTS.drip, fill: '#e8456b', lw: 1.2 });
    text(gg, 'RUN', fw / 2, 23, { size: Math.min(9, fw * 0.17), font: FONTS.drip, fill: '#e8456b', lw: 1.2 });
    shape(gg, rrectPts(6, 32, fw - 12, 52, 3), { fill: '#05040c', lw: 1.6, amp: 0.3, seed: seed + 2 });
    shape(gg, rrectPts(2, 92, fw - 4, 16, 2), { fill: '#1d47b0', lw: 1.4, amp: 0.2, seed: seed + 3 });
    dot(gg, fw * 0.3, 100, 2.4, '#ff4f9a');
    dot(gg, fw * 0.45, 100, 2.4, '#3ec7b0');
    stroke(gg, [[fw * 0.72, 102], [fw * 0.72, 95]], { lw: 1.4, color: INK, amp: 0 });
    dot(gg, fw * 0.72, 94, 2.4, '#ffd23f');
    shape(gg, rrectPts(fw * 0.3, 128, fw * 0.4, 20, 2), { fill: '#1d47b0', lw: 1.2, amp: 0.2, seed: seed + 4 });
    dot(gg, fw / 2, 135, 1.6, '#ffd23f');
    stickersCm(gg, fw * 0.5, 160, 3, seed + 5);
  } });
}

function shellTable(g, L, p, seed) {
  const { x0, x1, z } = p;
  box3(g, L, { x0, x1, y0: 0, y1: 0.74, z0: z, d: 0.45 }, { fill: '#c89a62', top: '#d8aa72', seed, front: (gg, fw, fh) => {
    stroke(gg, [[4, 10], [fw - 4, 10]], { lw: 1.2, color: rgba(INK, 0.4), amp: 0.2 });
    text(gg, 'FRAGILE', fw * 0.6, fh * 0.6, { size: Math.min(8, fw * 0.12), font: FONTS.sign, fill: rgba('#8a2a1a', 0.7), lw: 0, rot: -0.05 });
  } });
  // three cups
  const w = x1 - x0;
  for (let i = 0; i < 3; i++) {
    const cx = x0 + w * (0.22 + i * 0.28);
    face(g, L, cx - 0.06, 0.74 + 0.13, z + 0.2, (gg) => {
      shape(gg, [[0, 13], [2.2, 0], [9.8, 0], [12, 13]], { fill: '#d4473f', lw: 1.3, smooth: false, amp: 0.2, seed: seed + 3 + i });
      stroke(gg, [[1.4, 4], [10.6, 4]], { lw: 0.8, color: rgba('#fffaf0', 0.7), amp: 0 });
    });
  }
  // cardboard sign
  face(g, L, x1 - 0.2, 0.74 + 0.32, z + 0.05, (gg) => {
    shape(gg, rrectPts(0, 0, 24, 18, 1), { fill: '#c89a62', lw: 1.2, amp: 0.5, seed: seed + 9 });
    text(gg, 'SHELL', 12, 8, { size: 5, font: FONTS.marker, fill: INK, lw: 0 });
    text(gg, 'GAME', 12, 14.5, { size: 5, font: FONTS.marker, fill: INK, lw: 0 });
  });
}

function vaultPanel(g, L, p, seed) {
  face(g, L, p.x0, p.y1, END_Z - 0.004, (gg) => {
    const w = (p.x1 - p.x0) * 100, h = (p.y1 - p.y0) * 100;
    shape(gg, rrectPts(0, 0, w, h, 2), { fill: '#6a707c', lw: 2, amp: 0.3, seed });
    for (let i = 0; i < 4; i++) for (let j = 0; j < 7; j++) dot(gg, 6 + i * (w - 12) / 3, 8 + j * (h - 16) / 6, 1.1, rgba('#ffffff', 0.35));
    // a door outline you only notice if you look
    shape(gg, rrectPts(w * 0.18, h * 0.12, w * 0.64, h * 0.82, 3), { fill: null, lw: 0.8, line: rgba(INK, 0.45), amp: 0.2, seed: seed + 1 });
    throwup(gg, w / 2, h * 0.45, { word: 'PLUG', fill: '#ffd23f', size: Math.min(20, w * 0.3), seed: seed + 2, rot: -0.1 });
    tag(gg, w * 0.5, h * 0.72, { word: 'KNOCK', color: '#ff4f9a', size: Math.min(13, w * 0.2), seed: seed + 3 });
    shape(gg, rrectPts(w * 0.72, h * 0.52, 9, 12, 1), { fill: '#16141d', lw: 1, amp: 0.1, seed: seed + 4 });
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) dot(gg, w * 0.72 + 2 + i * 2.6, h * 0.52 + 2.5 + j * 3, 0.8, '#7ed957');
    stickersCm(gg, w * 0.3, h * 0.88, 3, seed + 5);
  });
}

function chains(g, L, seed) {
  // hazard tape, chains and a padlock across the far door
  face(g, L, -0.5, 1.9, END_Z - 0.01, (gg) => {
    for (const [ax, ay, bx, by] of [[0, 30, 100, 150], [100, 30, 0, 150]]) {
      gg.save();
      const dx = bx - ax, dy = by - ay, len = Math.hypot(dx, dy);
      gg.translate(ax, ay);
      gg.rotate(Math.atan2(dy, dx));
      shape(gg, rrectPts(0, -7, len, 14, 1), { fill: '#ffd23f', lw: 1.6, amp: 0.3, seed: seed + ax });
      gg.save();
      gg.beginPath(); gg.rect(0, -7, len, 14); gg.clip();
      gg.fillStyle = INK;
      for (let x = -14; x < len; x += 14) { gg.beginPath(); gg.moveTo(x, 7); gg.lineTo(x + 7, -7); gg.lineTo(x + 14, -7); gg.lineTo(x + 7, 7); gg.fill(); }
      gg.restore();
      gg.restore();
    }
    for (let i = 0; i < 9; i++) shape(gg, ellipsePts(8 + i * 10.5, 92 + Math.sin(i / 8 * Math.PI) * 10, 5, 3.4, (i % 2) * 1.2), { fill: null, lw: 2, line: '#9aa0b8', amp: 0.1, seed: seed + i });
    shape(gg, rrectPts(40, 98, 20, 18, 3), { fill: '#ffd23f', lw: 1.6, amp: 0.2, seed: seed + 20 });
    stroke(gg, [[44, 98], [44, 90], [56, 90], [56, 98]], { lw: 2.2, color: '#c8c8e0', amp: 0.1 });
    shape(gg, rrectPts(18, 124, 64, 20, 2), { fill: '#e8453c', lw: 1.6, amp: 0.3, seed: seed + 21 });
    text(gg, 'NO ENTRY', 50, 138, { size: 10, font: FONTS.sign, fill: '#fffaf0', lw: 0 });
  });
}

function pedestal(g, L, x, z, seed) {
  box3(g, L, { x0: x - 0.16, x1: x + 0.16, y0: 0, y1: 1.18, z0: z, d: 0.32 }, { fill: '#2b2a36', top: '#45434f', seed, front: (gg, fw, fh) => {
    stroke(gg, [[2, 6], [fw - 2, 6]], { lw: 1.6, color: '#ffd23f', amp: 0 });
    stroke(gg, [[2, fh - 6], [fw - 2, fh - 6]], { lw: 1.6, color: '#ffd23f', amp: 0 });
  } });
}

function gasLamp(g, L, x, z, seed) {
  const top = L.P(x, CEIL, z);
  const bot = L.P(x, 2.12, z);
  stroke(g, [[top[0], top[1]], [bot[0], bot[1]]], { lw: 1 * L.u, color: '#3a2616', amp: 0 });
  face(g, L, x - 0.07, 2.12, z, (gg) => {
    shape(gg, rrectPts(0, 0, 14, 4, 1), { fill: '#c9a14a', lw: 1, amp: 0.1, seed });
    shape(gg, [[1, 4], [13, 4], [11, 16], [3, 16]], { fill: 'rgba(255,240,180,0.9)', lw: 1.2, smooth: false, amp: 0.1, seed: seed + 1 });
    shape(gg, rrectPts(2, 16, 10, 2.5, 1), { fill: '#c9a14a', lw: 1, amp: 0.1, seed: seed + 2 });
  });
}

function cobweb(g, L, x, y, z, flip, s = 0.45) {
  const c = L.P(x, y, z);
  const k = c[2] * s;
  g.save();
  g.strokeStyle = 'rgba(230,255,245,0.35)';
  g.lineWidth = 0.8 * L.u;
  const sx = flip ? -1 : 1;
  for (let i = 0; i <= 4; i++) {
    const a = (i / 4) * (Math.PI / 2);
    g.beginPath();
    g.moveTo(c[0], c[1]);
    g.lineTo(c[0] + sx * Math.cos(a) * k, c[1] + Math.sin(a) * k);
    g.stroke();
  }
  for (let r = 1; r <= 3; r++) {
    g.beginPath();
    for (let i = 0; i <= 4; i++) {
      const a = (i / 4) * (Math.PI / 2);
      const x2 = c[0] + sx * Math.cos(a) * k * r / 3.3, y2 = c[1] + Math.sin(a) * k * r / 3.3;
      i ? g.lineTo(x2, y2) : g.moveTo(x2, y2);
    }
    g.stroke();
  }
  g.restore();
}

// ---------------------------------------------------------------- plans (where things go, per car)

// portrait vs landscape positions: the player always stands left; the right
// side of the frame holds the shop's main prop; signs hang up top above heads
function pos(L, p, l) { return L.wide ? l : p; }

function planFor(L, kind) {
  const w = L.wide;
  const plan = {
    kind, geom: 'car', old: kind === 'ghost',
    player: [-0.36, 2.25],
    npc: pos(L, [0.5, 4.2], [0.6, 4.2]),
    npc2: null,
    props: [], slots: [], skipLeft: [], skipRight: [],
    nearPoles: w ? [[0.62, 2.0], [-0.62, 1.45]] : [],
    farPoles: [[-0.62, 6.05], [0.62, 6.05], [-0.62, 10.0], [0.62, 10.0]],
    nextDoor: true,
  };
  const nearR = pos(L, { x0: 0.65, x1: 1.15, z: 2.9 }, { x0: 1.0, x1: 1.45, z: 2.4 });
  const hangL = pos(L, { x: -0.5, z: 2.6, w: 0.72 }, { x: -0.95, z: 2.6, w: 0.8 });
  const hangR = pos(L, { x: 0.62, z: 2.6, w: 0.72 }, { x: 0.95, z: 2.6, w: 0.8 });
  const railSlots = () => {
    for (const z of RAIL_SLOTS) for (const s of [1, -1]) plan.slots.push({ X: s * RAIL_X, Y: 1.7, Z: z, hang: true, size: 0.5 });
  };
  if (kind === 'front') {
    plan.props.push({ type: 'hang', id: 'calendar', layer: 'back', ...hangL, y0: HANG_Y0, y1: HANG_Y1, faceKind: 'calendar' });
    plan.props.push({ type: 'hang', id: 'board', layer: 'back', ...hangR, y0: HANG_Y0, y1: HANG_Y1, faceKind: 'board' });
    const lockers = w ? { x0: 1.0, x1: 1.45, z: 2.4, y1: 1.55 } : { ...nearR, y1: 1.15 };
    plan.props.push({ type: 'lockers', id: 'lockers', layer: 'front', ...lockers });
    const reader = w ? { x0: 0.53, x1: 0.71, y0: 1.02, y1: 1.24, z: 1.97 } : { x0: nearR.x0 + 0.05, x1: nearR.x0 + 0.29, y0: 1.15, y1: 1.4, z: nearR.z + 0.08 };
    plan.props.push({ type: 'reader', id: 'reader', layer: 'front', ...reader });
    if (w) plan.skipRight.push([2.0, 2.95]);
  } else if (['threads', 'kicks', 'lids', 'ice'].includes(kind)) {
    railSlots();
    const c = w ? { ...nearR, y1: 0.95 } : { ...nearR, y1: 0.85 };
    plan.props.push({ type: 'counter', id: 'display', layer: 'front', ...c, y0: 0 });
    if (w) plan.skipRight.push([2.0, 2.95]);
    if (kind === 'ice') plan.disco = [0, 2.1, 4.8];
  } else if (kind === 'arcade') {
    if (w) {
      // landscape: the claw on the left in front of the tag wall, Eight's shell
      // table on the right, Joy mid-aisle by the runner cabinet (all clear of the player)
      plan.npc = [0.45, 5.0];
      plan.npc2 = [1.17, 3.1];
      plan.props.push({ type: 'claw', id: 'claw', layer: 'front', x0: -1.45, x1: -1.0, z: 2.4 });
      plan.props.push({ type: 'shell', id: 'shell', layer: 'front', x0: 0.75, x1: 1.45, z: 2.5, anchorY: 0.5 });
      plan.props.push({ type: 'runner', layer: 'back', x0: 1.0, x1: 1.45, z: 6.2 });
      plan.props.push({ type: 'hang', id: 'tagwall', layer: 'back', x: -0.9, z: 3.4, w: 0.8, y0: HANG_Y0, y1: HANG_Y1, faceKind: 'tagwall' });
      plan.skipLeft.push([2.0, 3.0]);
      plan.skipRight.push([2.1, 3.5], [5.9, 6.9]);
      plan.nearPoles = [];
    } else {
      // portrait: everything lives right of the player, farthest nearest the center:
      // Joy at the back, Eight behind his table mid-aisle, the claw in the near corner
      plan.npc = [0.33, 7.4];
      plan.npc2 = [0.72, 4.6];
      plan.props.push({ type: 'shell', id: 'shell', layer: 'front', x0: 0.4, x1: 1.05, z: 4.15, anchorY: 0.5 });
      plan.props.push({ type: 'claw', id: 'claw', layer: 'front', x0: 0.88, x1: 1.34, z: 2.8 });
      plan.props.push({ type: 'hang', id: 'tagwall', layer: 'back', ...hangL, y0: HANG_Y0 - 0.05, y1: HANG_Y1, faceKind: 'tagwall' });
      plan.skipRight.push([2.6, 3.4], [4.1, 4.7]);
    }
    plan.props.push({ type: 'crt', id: 'runner', layer: 'back', ...hangR, y0: HANG_Y0, y1: HANG_Y1 });
  } else if (kind === 'capsules') {
    if (w) {
      plan.props.push({ type: 'capsule', id: 'basic', layer: 'front', x0: 0.98, x1: 1.42, z: 2.4, deluxe: false });
      plan.props.push({ type: 'capsule', id: 'deluxe', layer: 'front', x0: -1.42, x1: -0.98, z: 2.4, deluxe: true });
      plan.nearPoles = [[0.62, 1.9]];
      plan.skipLeft.push([2.0, 3.0]);
      plan.skipRight.push([2.0, 3.0]);
    } else {
      plan.props.push({ type: 'capsule', id: 'basic', layer: 'front', x0: 0.6, x1: 0.95, z: 2.9, deluxe: false });
      plan.props.push({ type: 'capsule', id: 'deluxe', layer: 'front', x0: 0.98, x1: 1.33, z: 2.9, deluxe: true });
    }
    plan.props.push({ type: 'vault', id: 'vault', layer: 'back', x0: -1.42, x1: -0.56, y0: 0.1, y1: 1.95 });
  } else if (kind === 'ghost') {
    railSlots();
    plan.props.push({ type: 'counter', id: 'display', layer: 'front', ...(w ? { ...nearR, y1: 0.95 } : { ...nearR, y1: 0.85 }), y0: 0 });
    if (w) plan.skipRight.push([2.0, 2.95]);
    plan.nextDoor = false;
    plan.farPoles = [[-0.62, 6.05], [0.62, 6.05]];
  } else if (kind === 'vault') {
    plan.geom = 'vault';
    plan.nextDoor = false;
    plan.nearPoles = [];
    plan.farPoles = [];
    const spots = w
      ? [[1.0, 2.7, 1.72], [-1.0, 2.7, 1.72], [1.02, 4.0, 1.74], [-1.02, 4.0, 1.74], [-0.25, 5.4, 1.78], [0.75, 5.5, 1.78]]
      : [[0.95, 2.9, 1.86], [1.05, 4.4, 1.9], [1.0, 6.0, 1.9], [0.3, 6.0, 1.9], [-0.55, 6.1, 1.92], [-1.05, 4.6, 1.92]];
    for (const [X, Z, Y] of spots) plan.slots.push({ X, Y, Z, hang: false, float: true, size: w ? 0.5 : 0.42, pedestal: true });
  } else if (kind === 'cab') {
    plan.geom = 'cab';
    plan.player = null;
    plan.npc = null;
    plan.nextDoor = false;
    plan.nearPoles = [];
    plan.farPoles = [];
  }
  return plan;
}

// ---------------------------------------------------------------- layout

const layouts = new Map();

export function carLayout(W, H, kind) {
  const key = `${kind}:${Math.round(W)}x${Math.round(H)}`;
  const hit = layouts.get(key);
  if (hit) return hit;
  const cam = cameraFor(W, H);
  const { f, cx, cy } = cam;
  const P = (X, Y, Z) => [cx + (f * X) / Z, cy - (f * (Y - EYE)) / Z, f / Z];
  const L = { W, H, f, cx, cy, P, u: cam.u, wide: cam.wide, kind };
  const plan = planFor(L, kind);
  L.plan = plan;
  const anchor = (xz) => {
    if (!xz) return null;
    const [x, y, s] = P(xz[0], 0, xz[1]);
    return { x, y, s };
  };
  L.player = anchor(plan.player);
  L.npc = anchor(plan.npc);
  L.npc2 = anchor(plan.npc2);
  // hotspots
  const hs = [];
  const push = (id, r, label, at = null) => {
    const rr = clipRect(L, r);
    if (rr[2] < 4 || rr[3] < 4) return;
    // the anchor is where the name tag goes: top-center unless the plan says otherwise,
    // kept inside the rect and far enough from the screen edges for a tag to fit
    let ax = at ? at[0] : rr[0] + rr[2] / 2, ay = at ? at[1] : rr[1];
    const m = 56 * L.u;
    ax = clamp(clamp(ax, rr[0] + 4, rr[0] + rr[2] - 4), Math.min(m, W / 2), Math.max(W - m, W / 2));
    ay = clamp(ay, rr[1], rr[1] + rr[3]);
    hs.push({ id, rect: rr, label, anchor: [ax, ay] });
  };
  const kd = KIND[kind] || KIND.threads;
  const LABELS = {
    npc: { front: 'SIGNAL', threads: 'DRIPPY', kicks: 'LACE', lids: 'CONE', ice: 'MIRA', arcade: 'JOY', capsules: 'PLUG', ghost: 'STATIC', vault: 'PLUG' }[kind] || 'TALK',
  };
  for (const [id, a] of [['npc', L.npc], ['npc2', L.npc2]]) {
    if (!a) continue;
    push(id, [a.x - 0.35 * a.s, a.y - 1.78 * a.s, 0.7 * a.s, 1.82 * a.s], id === 'npc2' ? 'EIGHT' : LABELS.npc);
  }
  const PROP_LABEL = { calendar: 'STREAK', board: 'JOBS', lockers: 'WARDROBE', reader: 'PUNCH IN', display: kd.label, tagwall: 'TAG WALL', runner: 'TUNNEL RUN', claw: 'THE GRABBER', shell: 'SHELL GAME', basic: 'BASIC CAPSULE', deluxe: 'DELUXE CAPSULE', vault: '???' };
  for (const p of plan.props) {
    if (!p.id) continue;
    let at = null;
    if (p.anchorY != null) {
      const q = P(((p.x0 ?? p.x) + (p.x1 ?? p.x)) / 2, p.anchorY, p.z);
      at = [q[0], q[1]];
    }
    push(p.id, propRect(L, p), PROP_LABEL[p.id] || p.id.toUpperCase(), at);
  }
  if (plan.slots.length) {
    // the hanging stock, one rect per side (plus the counter, already pushed)
    for (const s of [1, -1]) {
      const pts = [];
      for (const sl of plan.slots) {
        if (Math.sign(sl.X || 1) !== s && !(sl.X === 0 && s === 1)) continue;
        const h = sl.size / 2;
        pts.push([sl.X - h, sl.Y - h - (sl.hang ? 0.05 : 0), sl.Z], [sl.X + h, sl.Y + h + (sl.hang ? 0.28 : 0), sl.Z]);
      }
      if (pts.length) push('display', bboxOf(L, pts), kd.label);
    }
  }
  if (plan.nextDoor) {
    const r = bboxOf(L, [[-0.48, 0, END_Z], [0.48, 2.06, END_Z]]);
    const mw = 70 * L.u, mh = 104 * L.u;
    const cxr = r[0] + r[2] / 2, bot = r[1] + r[3];
    const ww = Math.max(r[2], mw), hh = Math.max(r[3], mh);
    push('door-next', [cxr - ww / 2, bot - hh, ww, hh], 'NEXT CAR');
  }
  if (plan.geom === 'cab') {
    push('window', bboxOf(L, [[-0.95, 1.05, 1.85], [0.95, 1.98, 1.85]]), 'WINDOW');
    push('console', bboxOf(L, [[-0.9, 0.95, 1.2], [0.15, 1.05, 1.75]]), 'CONTROLS');
    push('lockbox', propRect(L, cabLockbox(L)), 'LOCKBOX');
  }
  // hit-test order: characters first (people tap faces), then smaller things before bigger ones
  const prio = (h) => (h.id === 'npc' || h.id === 'npc2' ? 0 : 1);
  hs.sort((a, b) => prio(a) - prio(b) || a.rect[2] * a.rect[3] - b.rect[2] * b.rect[3]);
  L.hotspots = hs;
  // geometry the live layers need
  L.straps = [];
  if (plan.geom === 'car') {
    // straps are drawn live on top of the baked car, so keep them off anything that hangs
    const keepOut = plan.props.filter((p) => p.type === 'hang' || p.type === 'crt').map((p) => propRect(L, p));
    keepOut.push(bboxOf(L, [[-SIGN_W / 2, SIGN_Y0, SIGN_Z], [SIGN_W / 2, SIGN_Y1, SIGN_Z]]));
    const hit = (r, x0, y0, x1, y1) => x1 > r[0] - 4 && x0 < r[0] + r[2] + 4 && y1 > r[1] - 4 && y0 < r[1] + r[3] + 4;
    for (const s of [-1, 1]) for (let z = 1.55; z < 6.6; z += 0.55) {
      if (plan.slots.some((sl) => sl.hang && Math.abs(sl.X - s * RAIL_X) < 0.05 && Math.abs(sl.Z - z) < 0.32)) continue;
      const top = P(s * RAIL_X, RAIL_Y, z), bot = P(s * RAIL_X, RAIL_Y - 0.33, z);
      const rr = 0.09 * top[2];
      if (keepOut.some((r) => hit(r, top[0] - rr, top[1], top[0] + rr, bot[1]))) continue;
      L.straps.push({ X: s * RAIL_X, Z: z, front: z < 2.15 });
    }
  }
  L.tubes = [];
  if (plan.geom === 'car' && !plan.old) {
    const r = mulberry32(hashStr(kind) + 3);
    for (const x of [-0.42, 0.42]) for (let z = 0.9; z < END_Z - 0.5; z += 1.75) {
      const z1 = Math.min(END_Z - 0.3, z + 1.45);
      L.tubes.push({ pts: [[x - 0.11, CEIL - 0.01, z], [x + 0.11, CEIL - 0.01, z], [x + 0.11, CEIL - 0.01, z1], [x - 0.11, CEIL - 0.01, z1]].map((p) => p2(L, p)), flicker: r() < 0.16, ph: r() * 100 });
    }
  }
  L.spots = computeSpots(L, plan);
  layouts.set(key, L);
  if (layouts.size > 24) layouts.delete(layouts.keys().next().value);
  return L;
}

function bboxOf(L, pts3) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const p of pts3) {
    const q = L.P(p[0], p[1], p[2]);
    x0 = Math.min(x0, q[0]); y0 = Math.min(y0, q[1]); x1 = Math.max(x1, q[0]); y1 = Math.max(y1, q[1]);
  }
  return [x0, y0, x1 - x0, y1 - y0];
}

function clipRect(L, r) {
  const X0 = Math.max(0, r[0]), Y0 = Math.max(0, r[1]);
  const X1 = Math.min(L.W, r[0] + r[2]), Y1 = Math.min(L.H, r[1] + r[3]);
  return [X0, Y0, Math.max(0, X1 - X0), Math.max(0, Y1 - Y0)];
}

function cabLockbox(L) {
  return L.wide ? { type: 'lockbox', x0: 0.6, x1: 1.0, y0: 1.0, y1: 1.3, z: 1.3 } : { type: 'lockbox', x0: 0.25, x1: 0.62, y0: 1.0, y1: 1.28, z: 1.35 };
}

function propRect(L, p) {
  switch (p.type) {
    case 'hang':
    case 'crt':
      return bboxOf(L, [[p.x - p.w / 2, p.y0, p.z], [p.x + p.w / 2, p.y1, p.z]]);
    case 'lockers':
      return bboxOf(L, [[p.x0, 0, p.z], [p.x1, p.y1, p.z], [p.x0, p.y1, p.z + 0.45]]);
    case 'reader':
      return bboxOf(L, [[p.x0, p.y0, p.z], [p.x1, p.y1, p.z]]);
    case 'counter':
      return bboxOf(L, [[p.x0, 0, p.z], [p.x1, p.y1 + 0.32, p.z], [p.x0, p.y1, p.z + 0.5]]);
    case 'capsule':
      return bboxOf(L, [[p.x0 - 0.04, 0, p.z], [p.x1 + 0.04, 1.06 + (p.x1 - p.x0) * 1.1, p.z]]);
    case 'claw':
      return bboxOf(L, [[p.x0, 0, p.z], [p.x1, 1.72, p.z]]);
    case 'runner':
      return bboxOf(L, [[p.x0, 0, p.z], [p.x1, 1.78, p.z], [p.x0, 1.78, p.z + 0.55]]);
    case 'shell':
      return bboxOf(L, [[p.x0, 0, p.z], [p.x1, 1.06, p.z]]);
    case 'vault':
      return bboxOf(L, [[p.x0, p.y0, END_Z], [p.x1, p.y1, END_Z]]);
    case 'lockbox':
      return bboxOf(L, [[p.x0, p.y0, p.z], [p.x1, p.y1, p.z]]);
    default:
      return [0, 0, 0, 0];
  }
}

function computeSpots(L, plan) {
  if (plan.geom === 'cab') {
    return [[-0.6, 1.0, 1.25], [-0.2, 1.0, 1.4], [0.75, 1.0, 1.32]].map(([X, Y, Z]) => {
      const [x, y, s] = L.P(X, Y, Z);
      return { x, y, s };
    }).filter((p) => p.x > 8 && p.x < L.W - 8 && p.y > 120 * L.u && p.y < L.H - 100 * L.u);
  }
  const cands = [];
  for (const Z of [2.3, 2.7, 3.3, 4.0, 4.6, 5.8, 7.0, 8.2, 9.6, 10.4]) {
    for (const X of [-1.15, -0.7, -0.25, 0.1, 0.25, 0.45, 0.7, 1.15]) cands.push([X, 0.02, Z]);
  }
  for (const Z of [5.2, 6.4, 9.6]) for (const s of [-1, 1]) cands.push([s * 1.2, SEAT_Y + 0.02, Z]);
  // exclusions: player, npcs, front props, HUD bands
  const ex = [];
  const fig = (a) => a && ex.push([a.x - 0.45 * a.s, a.y - 1.8 * a.s, 0.9 * a.s, 1.85 * a.s]);
  fig(L.player); fig(L.npc); fig(L.npc2);
  for (const p of plan.props) if (p.layer === 'front') ex.push(propRect(L, p));
  const inside = (x, y, r) => x > r[0] - 6 && x < r[0] + r[2] + 6 && y > r[1] - 6 && y < r[1] + r[3] + 6;
  const top = 118 * L.u, bot = L.H - (L.wide ? 60 : 110) * L.u;
  const ok = [];
  const r = mulberry32(hashStr(plan.kind) + 11);
  for (const c of cands) {
    if (plan.geom === 'vault' && c[2] > 6.0) continue;
    const [x, y, s] = L.P(...c);
    if (x < 14 || x > L.W - 14 || y < top || y > bot) continue;
    if (ex.some((rr) => inside(x, y, rr))) continue;
    ok.push({ x, y, s, k: r() });
  }
  ok.sort((a, b) => a.k - b.k);
  const out = [];
  for (const p of ok) {
    if (out.some((q) => Math.hypot(q.x - p.x, q.y - p.y) < 34 * L.u)) continue;
    out.push({ x: p.x, y: p.y, s: p.s });
    if (out.length >= 8) break;
  }
  return out;
}

// ---------------------------------------------------------------- baking

const bakes = new Map();

function scaleOf(g) {
  const m = g.getTransform();
  return Math.hypot(m.a, m.b) || 1;
}

// only what's baked goes in the key (display, glow and free are drawn live)
function stateKey(kind, state = {}) {
  const l = state.locked && state.locked.next ? 1 : 0;
  return `${l}|${state.number ?? ''}|${state.label ?? ''}`;
}

function getBake(L, kind, state, K0) {
  // bake at exactly the destination density: the per-frame blit stays 1:1
  // (a scaled blit every frame costs far more than a sharper bake once)
  const K = Math.max(0.5, Math.min(4, K0));
  const key = `${kind}:${L.W}x${L.H}@${K.toFixed(2)}:${stateKey(kind, state)}`;
  let b = bakes.get(key);
  if (!b) {
    b = { back: bakeBack(L, kind, state || {}, K), front: bakeFront(L, kind, state || {}, K) };
    bakes.set(key, b);
    while (bakes.size > 6) bakes.delete(bakes.keys().next().value);
  }
  return b;
}

function canvasFor(L, K) {
  const c = makeCanvas(Math.ceil(L.W * K), Math.ceil(L.H * K));
  const g = c.getContext('2d');
  g.scale(K, K);
  return [c, g];
}

function bakeBack(L, kind, state, K) {
  const [c, g] = canvasFor(L, K);
  const plan = L.plan;
  const kd = KIND[kind] || KIND.threads;
  const m = plan.old ? WOOD : STEEL;
  const seed = hashStr(kind) % 9973;
  const glass = [];
  if (plan.geom === 'cab') {
    bakeCab(g, L, kd, K, seed, glass);
  } else if (plan.geom === 'vault') {
    bakeVault(g, L, kd, K, seed);
  } else {
    // background beyond the door window etc.
    g.fillStyle = '#05040a';
    g.fillRect(0, 0, L.W, L.H);
    drawCeiling(g, L, m, K, seed);
    drawFloor(g, L, m, K, seed);
    const glowNext = kind === 'capsules' ? (state.locked && state.locked.next ? null : '#9fffe0') : kind === 'ghost' ? null : '#ffe7a8';
    drawEndWall(g, L, m, kd, K, seed, { glowNext, window: kind === 'capsules' ? '#05040a' : '#2a2236', noDoor: !plan.nextDoor && kind !== 'ghost' });
    if (kind === 'ghost') drawPorthole(g, L, seed);
    for (const side of [1, -1]) glass.push(...drawSideWall(g, L, m, kd, plan, side, K, seed));
    drawCove(g, L, m, kd, K, seed);
    // floor + ceiling graffiti
    const r = mulberry32(seed + 17);
    for (let i = 0; i < 2; i++) {
      const z = i === 0 ? 3.9 + r() * 0.5 : 6.2 + r() * 1.2;
      const word = i === 0 ? (SHORT[kind] || SHORT.front)[0] : kd.words[(i + 1) % kd.words.length];
      const tex = i === 0 ? throwTex(L, K, z - 0.4, word, kd.spray[i % kd.spray.length], seed + 70 + i, 44) : tagTex(L, K, z - 0.4, word, kd.spray[(i + 2) % kd.spray.length], seed + 70 + i, 36);
      ceilDecal(g, L, (r() - 0.5) * 0.4, z, i === 0 ? 1.15 : 1.0, i === 0 ? 0.5 : 0.42, tex);
    }
    if (!plan.old) {
      const st = stickerTex(L, K, 4, seed + 80, 6);
      floorDecal(g, L, 0.55, 5.5, 0.5, 0.4, st);
      const tex = tagTex(L, K, 6, kd.words[0], kd.spray[3 % kd.spray.length], seed + 81, 30);
      floorDecal(g, L, -0.35, 7.2, 1.0, 0.45, tex);
    }
    for (const side of [1, -1]) drawSeats(g, L, m, kd, plan, side, seed, K);
    // grab rails + brackets (behind the player), far poles
    drawRails(g, L, m, false);
    const farPoles = plan.farPoles.slice().sort((a, b) => b[1] - a[1]);
    for (const [x, z] of farPoles) drawPole(g, L, m, x, z);
    if (plan.old) {
      for (let z = 2.2; z < END_Z; z += 2.6) for (const x of [-0.5, 0.5]) gasLamp(g, L, x, z, seed + Math.round(z * 10));
      cobweb(g, L, -COVE_X, CEIL, END_Z - 0.01, false, 0.5);
      cobweb(g, L, COVE_X, CEIL, END_Z - 0.01, true, 0.5);
      cobweb(g, L, -HALF, WALL_TOP, 6.2, false);
      cobweb(g, L, HALF, WALL_TOP, 3.9, true);
    }
    // back props (far to near)
    const back = plan.props.filter((p) => p.layer === 'back').sort((a, b) => (b.z ?? END_Z) - (a.z ?? END_Z));
    for (const p of back) drawProp(g, L, p, kind, kd, m, seed, state);
    // pedestal-free slots get their hooks drawn live; the car sign hangs nearest
    drawCarSign(g, L, kd, m, state, state.number ?? kd.n, state.label ?? kd.label);
    if (kind === 'capsules' && state.locked && state.locked.next) chains(g, L, seed + 300);
    // gentle light falloff toward the far end
    const gr = g.createRadialGradient(L.cx, L.cy, 4, L.cx, L.cy, Math.max(L.W, L.H) * 0.22);
    gr.addColorStop(0, plan.old ? 'rgba(20,40,30,0.35)' : 'rgba(30,24,50,0.22)');
    gr.addColorStop(1, 'rgba(30,24,50,0)');
    g.fillStyle = gr;
    g.fillRect(0, 0, L.W, L.H);
    if (plan.old) {
      g.fillStyle = 'rgba(120,255,210,0.08)';
      g.fillRect(0, 0, L.W, L.H);
    }
  }
  // glass path for the live tunnel (screen space)
  const path = new Path2D();
  for (const pts of glass) {
    pts.forEach(([x, y], i) => (i ? path.lineTo(x, y) : path.moveTo(x, y)));
    path.closePath();
  }
  L.glass = path;
  L.hasGlass = glass.length > 0;
  return c;
}

function drawPorthole(g, L, seed) {
  face(g, L, -0.35, 1.85, END_Z - 0.01, (gg) => {
    shape(gg, ellipsePts(35, 35, 33, 33), { fill: '#c9a14a', lw: 2, amp: 0.3, seed });
    shape(gg, ellipsePts(35, 35, 26, 26), { fill: '#0a1612', lw: 1.6, amp: 0.2, seed: seed + 1 });
    const gr = gg.createRadialGradient(35, 35, 2, 35, 35, 26);
    gr.addColorStop(0, 'rgba(160,255,220,0.35)');
    gr.addColorStop(1, 'rgba(160,255,220,0)');
    gg.fillStyle = gr;
    gg.beginPath(); gg.arc(35, 35, 26, 0, Math.PI * 2); gg.fill();
    for (let i = 0; i < 8; i++) dot(gg, 35 + Math.cos(i * 0.785) * 30, 35 + Math.sin(i * 0.785) * 30, 1.4, '#8a6a2a');
  });
}

function drawProp(g, L, p, kind, kd, m, seed, state) {
  const sd = seed + Math.round((p.x0 ?? p.x ?? 0) * 100 + (p.z ?? 0) * 10);
  switch (p.type) {
    case 'hang': {
      const faceFn = p.faceKind === 'board' ? (gg, w, h) => boardFace(gg, w, h, sd)
        : p.faceKind === 'calendar' ? (gg, w, h) => calendarFace(gg, w, h, sd, kd.accent)
          : (gg, w, h) => tagwallFace(gg, w, h, sd);
      drawHang(g, L, { ...p, face: faceFn }, m);
      break;
    }
    case 'crt':
      drawHang(g, L, { ...p, face: (gg, w, h) => crtFace(gg, w, h, sd, 'TUNNEL RUN') }, m);
      break;
    case 'lockers': drawLockers(g, L, p, kd, sd); break;
    case 'reader': drawReader(g, L, p, sd); break;
    case 'counter': drawCounter(g, L, p, kind, kd, sd); break;
    case 'capsule': capsuleMachine(g, L, p, p.deluxe, sd); break;
    case 'claw': clawMachine(g, L, p, sd); break;
    case 'runner': runnerCabinet(g, L, p, sd); break;
    case 'shell': shellTable(g, L, p, sd); break;
    case 'vault': vaultPanel(g, L, p, sd); break;
    default: break;
  }
}

function bakeFront(L, kind, state, K) {
  const [c, g] = canvasFor(L, K);
  const plan = L.plan;
  const kd = KIND[kind] || KIND.threads;
  const m = plan.old ? WOOD : STEEL;
  const seed = hashStr(kind) % 9973;
  // near rail stubs + near poles
  if (plan.geom === 'car') drawRails(g, L, m, true);
  const items = [];
  for (const [x, z] of plan.nearPoles) items.push({ z, draw: () => drawPole(g, L, m, x, z, RAIL_Y) });
  for (const p of plan.props) if (p.layer === 'front') items.push({ z: p.z ?? 1, draw: () => drawProp(g, L, p, kind, kd, m, seed, state) });
  items.sort((a, b) => b.z - a.z);
  for (const it of items) it.draw();
  // vignette
  const gr = g.createRadialGradient(L.W * 0.5, L.H * 0.48, Math.min(L.W, L.H) * 0.35, L.W * 0.5, L.H * 0.5, Math.hypot(L.W, L.H) * 0.62);
  gr.addColorStop(0, 'rgba(10,6,24,0)');
  gr.addColorStop(1, plan.old ? 'rgba(4,18,14,0.6)' : 'rgba(10,6,24,0.5)');
  g.fillStyle = gr;
  g.fillRect(0, 0, L.W, L.H);
  return c;
}

// ---------------------------------------------------------------- cab + vault geometry

function bakeCab(g, L, kd, K, seed, glass) {
  const W2 = 1.2, CH = 2.2, FZ = 1.85;
  g.fillStyle = '#05040a';
  g.fillRect(0, 0, L.W, L.H);
  // ceiling, floor, side walls
  quad3(g, L, [[-W2, CH, NZ], [W2, CH, NZ], [W2, CH, FZ], [-W2, CH, FZ]], { fill: '#3a3f48', lw: 0, amp: 0 });
  quad3(g, L, [[-W2, 0, NZ], [W2, 0, NZ], [W2, 0, FZ], [-W2, 0, FZ]], { fill: '#24272d', lw: 0, amp: 0 });
  for (const s of [-1, 1]) quad3(g, L, [[s * W2, 0, NZ], [s * W2, CH, NZ], [s * W2, CH, FZ], [s * W2, 0, FZ]], { fill: '#454b56', seed: seed + s });
  // ceiling details: panel seams, a cable tray, the dome light, a tag
  for (let z = 0.8; z < FZ; z += 0.35) line3(g, L, [-W2, CH, z], [W2, CH, z], { color: '#30343c', lw: 1 * L.u, amp: 0.2 * L.u });
  for (const x of [-0.75, 0.75]) quad3(g, L, [[x - 0.1, CH - 0.004, NZ], [x + 0.1, CH - 0.004, NZ], [x + 0.1, CH - 0.004, FZ], [x - 0.1, CH - 0.004, FZ]], { fill: '#2b2f36', lw: 1.2 * L.u, seed: seed + 80 + x * 10 });
  const dome = rrectPts(-0.2, 1.12, 0.4, 0.3, 0.12).map(([x, z]) => p2(L, [x, CH - 0.006, z]));
  shape(g, dome, { fill: '#fff4cf', lw: lwAt(L, L.f / 1.2, 1.2), amp: 0.3 * L.u, seed: seed + 82 });
  {
    const tex = throwTex(L, K, 1.3, 'ZOOM', '#ffd23f', seed + 83, 40);
    ceilDecal(g, L, L.wide ? 0.5 : 0.28, 1.6, 0.56, 0.24, tex, CH);
    const st = stickerTex(L, K, 1.3, seed + 84, 6);
    ceilDecal(g, L, L.wide ? -0.5 : -0.32, 1.55, 0.36, 0.28, st, CH);
  }
  // front wall around the big window
  shape(g, [p2(L, [-W2, 0, FZ]), p2(L, [W2, 0, FZ]), p2(L, [W2, CH, FZ]), p2(L, [-W2, CH, FZ])], { fill: '#4a505c', smooth: false, lw: lwAt(L, L.f / FZ), amp: 0.3 * L.u, seed: seed + 3 });
  const win = rrectPts(-0.95, 1.05, 1.9, 0.93, 0.12).map(([x, y]) => p2(L, [x, y, FZ]));
  shape(g, rrectPts(-1.0, 1.0, 2.0, 1.03, 0.14).map(([x, y]) => p2(L, [x, y, FZ])), { fill: '#2a2e36', lw: lwAt(L, L.f / FZ), amp: 0.3 * L.u, seed: seed + 4 });
  g.save();
  g.globalCompositeOperation = 'destination-out';
  g.beginPath();
  win.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
  g.closePath();
  g.fill();
  g.restore();
  glass.push(win);
  // wiper + scratches on the glass
  g.save();
  g.beginPath();
  win.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
  g.closePath();
  g.clip();
  const wp = L.P(0.55, 1.07, FZ), wq = L.P(0.05, 1.8, FZ);
  g.strokeStyle = INK; g.lineWidth = 4 * L.u;
  g.beginPath(); g.moveTo(wp[0], wp[1]); g.lineTo(wq[0], wq[1]); g.stroke();
  g.strokeStyle = 'rgba(235,240,255,0.25)'; g.lineWidth = 1 * L.u;
  const r = mulberry32(seed);
  for (let i = 0; i < 6; i++) {
    const a = L.P(-0.9 + r() * 1.8, 1.1 + r() * 0.8, FZ);
    g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(a[0] + 30 * L.u * r(), a[1] + 10 * L.u * (r() - 0.5)); g.stroke();
  }
  g.restore();
  // graffiti on the cab walls + signs
  for (const side of [-1, 1]) {
    const tex = throwTex(L, K, 0.8, side < 0 ? 'ZOOM' : 'NOVA', side < 0 ? '#ff4f9a' : '#7ed957', seed + 10 + side, 40);
    xDecal(g, L, side, side * W2 - side * 0.003, 1.15, 1.6, 0.8, 0.4, tex);
    const st = stickerTex(L, K, 0.9, seed + 20 + side, 5);
    xDecal(g, L, side, side * W2 - side * 0.003, 1.5, 1.1, 0.35, 0.28, st);
  }
  face(g, L, L.wide ? -0.9 : -0.55, 2.15, FZ - 0.003, (gg) => {
    shape(gg, rrectPts(0, 0, 50, 9, 1.5), { fill: '#e8453c', lw: 1.4, amp: 0.2, seed: seed + 30 });
    text(gg, 'DRIVER ONLY', 25, 6.5, { size: 5.2, font: FONTS.sign, fill: '#fffaf0', lw: 0 });
  });
  face(g, L, L.wide ? 0.45 : 0.2, 2.15, FZ - 0.003, (gg) => {
    tag(gg, 22, 7, { word: 'FULLSPEED', color: '#ffd23f', size: 7, seed: seed + 31 });
  });
  // the console: a slanted desk full of buttons and levers
  const cz0 = 1.2, cz1 = 1.8;
  quad3(g, L, [[-1.15, 0, cz0], [1.15, 0, cz0], [1.15, 0.95, cz0], [-1.15, 0.95, cz0]], { fill: '#2b2f36', seed: seed + 40 });
  quad3(g, L, [[-1.15, 0.95, cz0], [1.15, 0.95, cz0], [1.15, 1.05, cz1], [-1.15, 1.05, cz1]], { fill: '#3a3f48', shade: '#30343c', sdx: 0, sdy: 2 * L.u, seed: seed + 41 });
  // buttons/gauges on the desk (front-facing approximations along the slope)
  const r2 = mulberry32(seed + 5);
  for (let i = 0; i < 14; i++) {
    const X = -1.0 + r2() * 1.25, Zp = cz0 + 0.08 + r2() * (cz1 - cz0 - 0.16);
    const Y = 0.95 + (Zp - cz0) / (cz1 - cz0) * 0.1 + 0.005;
    const q = L.P(X, Y, Zp);
    const rr = 0.022 * q[2];
    g.fillStyle = INK; g.beginPath(); g.ellipse(q[0], q[1], rr + 1.2 * L.u, (rr + 1.2 * L.u) * 0.55, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = ['#e8453c', '#ffd23f', '#7ed957', '#5aa0ff', '#fffaf0'][i % 5];
    g.beginPath(); g.ellipse(q[0], q[1], rr, rr * 0.55, 0, 0, Math.PI * 2); g.fill();
  }
  // gauges on the console front
  face(g, L, -0.95, 0.9, cz0 - 0.004, (gg) => {
    for (let i = 0; i < 3; i++) {
      const cx = 14 + i * 26;
      shape(gg, ellipsePts(cx, 14, 10, 10), { fill: '#fffaf0', lw: 1.6, amp: 0.2, seed: seed + 50 + i });
      stroke(gg, [[cx, 14], [cx + Math.cos(-0.6 - i * 0.7) * 7, 14 + Math.sin(-0.6 - i * 0.7) * 7]], { lw: 1.4, color: '#e8453c', amp: 0 });
    }
    text(gg, 'SPEED', 40, 33, { size: 5, font: FONTS.sign, fill: rgba('#fffaf0', 0.7), lw: 0 });
    stickersCm(gg, 120, 20, 3, seed + 60);
    tag(gg, 150, 60, { word: 'DRIPLINE', color: '#ff4f9a', size: 14, seed: seed + 61 });
  });
  // the throttle lever
  const lv = L.P(-0.55, 1.0, 1.5), lt = L.P(-0.62, 1.32, 1.45);
  g.strokeStyle = INK; g.lineWidth = 9 * L.u; g.lineCap = 'round';
  g.beginPath(); g.moveTo(lv[0], lv[1]); g.lineTo(lt[0], lt[1]); g.stroke();
  g.strokeStyle = '#c8c8e0'; g.lineWidth = 5 * L.u;
  g.beginPath(); g.moveTo(lv[0], lv[1]); g.lineTo(lt[0], lt[1]); g.stroke();
  dot(g, lt[0], lt[1], 9 * L.u, INK);
  dot(g, lt[0], lt[1], 6.5 * L.u, '#e8453c');
  // lockbox
  const lb = cabLockbox(L);
  box3(g, L, { x0: lb.x0, x1: lb.x1, y0: lb.y0, y1: lb.y1, z0: lb.z, d: 0.25 }, { fill: '#5a606b', top: '#727885', seed: seed + 70, front: (gg, fw, fh) => {
    for (let i = 0; i < 4; i++) dot(gg, 4 + i * (fw - 8) / 3, 4, 1, rgba('#ffffff', 0.4));
    shape(gg, rrectPts(fw / 2 - 5, fh * 0.35, 10, 10, 2), { fill: '#ffd23f', lw: 1.2, amp: 0.2, seed: seed + 71 });
    stroke(gg, [[fw / 2 - 3, fh * 0.35], [fw / 2 - 3, fh * 0.2], [fw / 2 + 3, fh * 0.2], [fw / 2 + 3, fh * 0.35]], { lw: 1.4, color: '#c8c8e0', amp: 0 });
    shape(gg, rrectPts(4, fh - 9, fw - 8, 6, 1), { fill: '#e8453c', lw: 0.8, amp: 0.1, seed: seed + 72 });
    text(gg, 'DO NOT OPEN', fw / 2, fh - 4.6, { size: 3.6, font: FONTS.sign, fill: '#fffaf0', lw: 0 });
  } });
}

function bakeVault(g, L, kd, K, seed) {
  const FZ = 6.4, VH = 2.45, VW = 1.5;
  g.fillStyle = '#05040a';
  g.fillRect(0, 0, L.W, L.H);
  const steel = '#4a5262', steelSh = '#353b47';
  quad3(g, L, [[-VW, VH, NZ], [VW, VH, NZ], [VW, VH, FZ], [-VW, VH, FZ]], { fill: '#2a2e38', lw: 0, amp: 0 });
  quad3(g, L, [[-VW, 0, NZ], [VW, 0, NZ], [VW, 0, FZ], [-VW, 0, FZ]], { fill: '#30343c', lw: 0, amp: 0 });
  // diamond-plate floor
  for (let z = 0.8; z < FZ; z += 0.25) for (let x = -1.4; x < 1.45; x += 0.25) {
    const q = L.P(x + ((Math.round(z * 4) % 2) * 0.125), 0, z);
    if (q[1] > L.H + 4 || q[0] < -4 || q[0] > L.W + 4) continue;
    const s = q[2];
    g.fillStyle = 'rgba(255,255,255,0.08)';
    g.save(); g.translate(q[0], q[1]); g.rotate(0.6); g.fillRect(-0.04 * s, -0.008 * s, 0.08 * s, 0.016 * s); g.restore();
  }
  for (const s of [-1, 1]) {
    quad3(g, L, [[s * VW, 0, NZ], [s * VW, VH, NZ], [s * VW, VH, FZ], [s * VW, 0, FZ]], { fill: steel, seed: seed + s });
    // walls of safe-deposit boxes, far to near
    const cols = [];
    for (let z = 0.75; z < FZ - 0.2; z += 0.42) cols.push(z);
    cols.reverse();
    for (const z of cols) {
      for (let y = 0.22; y < VH - 0.25; y += 0.34) {
        const z0 = z + 0.03, z1 = z + 0.39, y0 = y + 0.03, y1 = y + 0.31;
        const k = hashStr(`box${s}${z.toFixed(2)}${y.toFixed(2)}`);
        const open = k % 23 === 0;
        quad3(g, L, [[s * VW, y0, z0], [s * VW, y1, z0], [s * VW, y1, z1], [s * VW, y0, z1]], { fill: open ? '#14161c' : k % 5 === 0 ? '#5a6274' : '#566072', shade: open ? null : steelSh, sdx: 1.2 * L.u, sdy: 1.2 * L.u, lw: lwAt(L, L.f / z, 0.8), seed: seed + k % 997 });
        if (open) continue;
        const kh = L.P(s * VW, y0 + 0.12, (z0 + z1) / 2);
        dot(g, kh[0], kh[1], Math.max(0.8, 0.014 * kh[2]), '#1a1c22');
        const pl = L.P(s * VW, y1 - 0.05, (z0 + z1) / 2);
        g.fillStyle = '#c9a14a';
        g.fillRect(pl[0] - 0.025 * pl[2], pl[1] - 0.012 * pl[2], 0.05 * pl[2], 0.024 * pl[2]);
      }
    }
  }
  // far wall with the big piece
  shape(g, [p2(L, [-VW, 0, FZ]), p2(L, [VW, 0, FZ]), p2(L, [VW, VH, FZ]), p2(L, [-VW, VH, FZ])], { fill: '#353a46', smooth: false, lw: lwAt(L, L.f / FZ), amp: 0.3 * L.u, seed: seed + 5 });
  face(g, L, -VW, VH, FZ - 0.004, (gg) => {
    const w = VW * 200, h = VH * 100;
    for (let i = 1; i < 4; i++) stroke(gg, [[i * w / 4, 0], [i * w / 4, h]], { lw: 1.6, color: '#2c313c', amp: 0.2 });
    piece(gg, w / 2, h * 0.42, 'VAULT', { size: 54, fill: '#d4a028', fill2: '#fff2b0', seed: seed + 6, cloudColor: '#ff4f9a', rot: -0.04 });
    tag(gg, w * 0.2, h * 0.75, { word: 'PLUG', color: '#7ed957', size: 22, seed: seed + 7 });
    tag(gg, w * 0.8, h * 0.78, { word: 'MYTHIC', color: '#ff4f9a', size: 20, seed: seed + 8 });
    stickersCm(gg, w * 0.5, h * 0.86, 5, seed + 9);
  });
  // side-wall graffiti
  for (const side of [-1, 1]) {
    const tex = tagTex(L, K, 2.5, side < 0 ? 'RICH' : 'GOLD', side < 0 ? '#ffd23f' : '#fffaf0', seed + 20 + side, 34);
    xDecal(g, L, side, side * VW - side * 0.003, 3.2, 1.95, 1.0, 0.45, tex);
  }
  // stacks of gold bars in the far corners
  for (const [x, z] of [[-1.15, 5.5], [1.12, 5.6]]) {
    const bars = [[0, 0, 0], [0.24, 0, 0], [0.12, 0.09, 0], [0, 0, 0.32], [0.24, 0, 0.32], [0.12, 0.09, 0.32], [0.12, 0.18, 0.16]];
    bars.sort((a, b) => b[2] - a[2] || a[1] - b[1]);
    for (const [dx, dy, dz] of bars) {
      box3(g, L, { x0: x - 0.12 + dx - 0.11, x1: x - 0.12 + dx + 0.11, y0: dy, y1: dy + 0.09, z0: z + dz, d: 0.28 }, { fill: '#e8b830', top: '#ffd96a', side: '#b8861a', seed: seed + Math.round((dx + dy + dz) * 100) });
    }
  }
  // spotlight cans on the ceiling
  for (const sl of L.plan.slots) {
    const q = L.P(sl.X, VH - 0.01, sl.Z);
    dot(g, q[0], q[1], Math.max(2, 0.06 * q[2]), INK);
    dot(g, q[0], q[1], Math.max(1.2, 0.04 * q[2]), '#fff6c8');
  }
  // pedestals (far to near)
  const peds = L.plan.slots.slice().sort((a, b) => b.Z - a.Z);
  for (const sl of peds) pedestal(g, L, sl.X, sl.Z, seed + Math.round(sl.Z * 10));
  // corner lines
  for (const s of [-1, 1]) {
    line3(g, L, [s * VW, 0, NZ], [s * VW, 0, FZ]);
    line3(g, L, [s * VW, VH, NZ], [s * VW, VH, FZ]);
  }
}

// ---------------------------------------------------------------- live layers

function drawTunnel(g, L, t, kind) {
  const old = L.plan.old;
  g.fillStyle = old ? '#06100c' : '#0a0915';
  g.fillRect(0, 0, L.W, L.H);
  const V = old ? 6 : 13;
  for (const side of [-1, 1]) {
    const X = side * 2.35;
    // the tunnel wall, faintly lit at lamp height
    const a0 = L.P(X, 1.75, NZ + 0.3), a1 = L.P(X, 0.95, NZ + 0.3), b0 = L.P(X, 1.75, END_Z + 2), b1 = L.P(X, 0.95, END_Z + 2);
    g.fillStyle = old ? 'rgba(60,140,110,0.10)' : 'rgba(70,64,120,0.22)';
    g.beginPath(); g.moveTo(a0[0], a0[1]); g.lineTo(b0[0], b0[1]); g.lineTo(b1[0], b1[1]); g.lineTo(a1[0], a1[1]); g.closePath(); g.fill();
    // passing tunnel ribs
    g.strokeStyle = old ? 'rgba(140,255,210,0.12)' : 'rgba(150,150,190,0.2)';
    g.lineWidth = 1.3 * L.u;
    for (let k = 0; k < 14; k++) {
      const z = NZ + ((k * 2.6 + V * t) % (14 * 2.6));
      if (z > END_Z + 2) continue;
      const a = L.P(X, 0.75, z), b = L.P(X, 2.05, z);
      g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke();
    }
    // cable runs
    g.strokeStyle = old ? 'rgba(140,255,210,0.1)' : 'rgba(120,110,160,0.25)';
    for (const y of [1.0, 1.62]) {
      const a = L.P(X, y, NZ), b = L.P(X, y, END_Z + 1);
      g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke();
    }
    // lamps streaking by
    g.save();
    g.globalCompositeOperation = 'lighter';
    g.lineCap = 'round';
    const span = 30;
    for (let k = 0; k < 7; k++) {
      const z = 1.6 + ((k * (span / 7) + V * t + (side > 0 ? 3.1 : 0)) % span);
      if (z > END_Z + 3) continue;
      const y = 1.33 + ((k * 37) % 5) * 0.06;
      const a = L.P(X, y, z), b = L.P(X, y, Math.max(1.2, z - 0.35 - z * 0.05));
      const s = L.f / z;
      g.strokeStyle = old ? 'rgba(140,255,210,0.2)' : 'rgba(255,170,80,0.22)';
      g.lineWidth = Math.min(0.12 * s, 26 * L.u);
      g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke();
      g.strokeStyle = old ? 'rgba(220,255,240,0.85)' : 'rgba(255,236,196,0.95)';
      g.lineWidth = Math.min(0.028 * s, 7 * L.u);
      g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke();
    }
    // a station's tiles flashing past every ~20 s
    const st = (t % 20) / 20;
    if (!old && st < 0.09) {
      const k = st / 0.09;
      g.fillStyle = `rgba(255,248,220,${0.25 * Math.sin(k * Math.PI)})`;
      g.fillRect(0, 0, L.W, L.H);
    }
    g.restore();
  }
}

function drawCabTunnel(g, L, t) {
  g.fillStyle = '#05040a';
  g.fillRect(0, 0, L.W, L.H);
  const V = 14;
  const cyT = 0.75;   // tunnel center height (cab coords)
  // rails converging to the vanishing point
  g.strokeStyle = 'rgba(200,200,230,0.55)';
  g.lineWidth = 1.4 * L.u;
  for (const x of [-0.72, 0.72]) {
    const a = L.P(x, -1.1, 6), b = L.P(x, -1.1, 400);
    g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke();
  }
  // tunnel rings rushing at you
  g.save();
  g.lineJoin = 'round';
  for (let k = 0; k < 12; k++) {
    const z = 60 - ((k * 5 + V * t) % 60);
    if (z < 2.2) continue;
    const s = L.f / z;
    const c = L.P(0, cyT, z);
    const rw = 2.5 * s, rh = 2.4 * s;
    const a = Math.min(1, (60 - z) / 25) * Math.min(1, z / 6);
    g.strokeStyle = `rgba(110,100,150,${0.55 * a})`;
    g.lineWidth = Math.max(1, 0.08 * s);
    g.beginPath();
    g.moveTo(c[0] - rw, c[1] + rh * 0.75);
    g.lineTo(c[0] - rw, c[1] - rh * 0.1);
    g.quadraticCurveTo(c[0] - rw, c[1] - rh, c[0], c[1] - rh);
    g.quadraticCurveTo(c[0] + rw, c[1] - rh, c[0] + rw, c[1] - rh * 0.1);
    g.lineTo(c[0] + rw, c[1] + rh * 0.75);
    g.stroke();
    // lamps on every other ring
    if (k % 2 === 0) {
      g.save();
      g.globalCompositeOperation = 'lighter';
      const lr = Math.max(1.5, 0.09 * s);
      for (const sx of [-1, 1]) {
        const lx = c[0] + sx * rw * 0.98, ly = c[1] - rh * 0.15;
        const gr = g.createRadialGradient(lx, ly, 0.5, lx, ly, lr * 5);
        gr.addColorStop(0, `rgba(255,214,140,${0.8 * a})`);
        gr.addColorStop(1, 'rgba(255,214,140,0)');
        g.fillStyle = gr;
        g.fillRect(lx - lr * 5, ly - lr * 5, lr * 10, lr * 10);
      }
      g.restore();
    }
    // signals now and then
    if (k % 5 === 1) {
      const sx = c[0] + rw * 0.85, sy = c[1] + rh * 0.2;
      dot(g, sx, sy, Math.max(1.5, 0.07 * s), (Math.floor(t * 0.5 + k) % 3) ? '#7ed957' : '#e8453c');
    }
  }
  g.restore();
  // headlight glow on the tracks
  const hp = L.P(0, -1.1, 9);
  const gr = g.createRadialGradient(hp[0], hp[1], 2, hp[0], hp[1], 160 * L.u);
  gr.addColorStop(0, 'rgba(255,240,200,0.22)');
  gr.addColorStop(1, 'rgba(255,240,200,0)');
  g.fillStyle = gr;
  g.fillRect(0, 0, L.W, L.H);
}

function drawStraps(g, L, t, front, kind) {
  const m = L.plan.old ? WOOD : STEEL;
  const kd = KIND[kind] || KIND.threads;
  for (const st of L.straps) {
    if (st.front !== front) continue;
    const th = 0.11 * Math.sin(t * 1.8 + st.Z * 1.3 + st.X) + 0.04 * Math.sin(t * 3.7 + st.Z);
    const len = 0.22;
    const top = L.P(st.X, RAIL_Y, st.Z);
    const bx = st.X + Math.sin(th) * len, by = RAIL_Y - Math.cos(th) * len;
    const bot = L.P(bx, by, st.Z);
    const s = top[2];
    g.lineCap = 'round';
    g.strokeStyle = INK;
    g.lineWidth = 0.03 * s + 2 * L.u;
    g.beginPath(); g.moveTo(top[0], top[1]); g.lineTo(bot[0], bot[1]); g.stroke();
    g.strokeStyle = m.strap;
    g.lineWidth = 0.03 * s;
    g.beginPath(); g.moveTo(top[0], top[1]); g.lineTo(bot[0], bot[1]); g.stroke();
    const rr = 0.045 * s;
    const ry = bot[1] + rr * 0.9;
    g.strokeStyle = INK;
    g.lineWidth = 0.016 * s + 2 * L.u;
    g.beginPath(); g.ellipse(bot[0], ry, rr, rr * 0.85, 0, 0, Math.PI * 2); g.stroke();
    g.strokeStyle = kd.ring;
    g.lineWidth = 0.016 * s;
    g.beginPath(); g.ellipse(bot[0], ry, rr, rr * 0.85, 0, 0, Math.PI * 2); g.stroke();
  }
}

const sprites = new Map();
function spriteFor(art, px, seed) {
  const b = Math.max(8, Math.round(px / 6) * 6);
  const key = `${b}:${seed}:${JSON.stringify(art)}`;
  let c = sprites.get(key);
  if (!c) {
    c = makeCanvas(b, b);
    const g = c.getContext('2d');
    g.scale(b / 110, b / 110);
    g.translate(55, 55);
    drawProduct(g, art, 0, 0, 1, seed);
    sprites.set(key, c);
    if (sprites.size > 160) sprites.delete(sprites.keys().next().value);
  }
  return c;
}

function drawSlots(g, L, t, state, K) {
  const arts = (state && state.display) || [];
  const m = L.plan.old ? WOOD : STEEL;
  const slots = L.plan.slots;
  // far first
  const order = slots.map((s, i) => [s, i]).sort((a, b) => b[0].Z - a[0].Z);
  for (const [sl, i] of order) {
    const raw = arts[i];
    const art = raw && (raw.art || raw);
    if (art && !art.type) continue;
    const hook = L.P(sl.X, RAIL_Y, sl.Z);
    const s = hook[2];
    const size = sl.size * s;
    if (sl.hang) {
      const th = art ? 0.07 * Math.sin(t * 1.5 + i * 1.7) : 0;
      g.save();
      g.translate(hook[0], hook[1]);
      g.rotate(th);
      const drop = (RAIL_Y - sl.Y) * s - size / 2;
      // hanger / lace / hook depending on the car
      g.strokeStyle = INK;
      g.lineWidth = Math.max(1, 0.012 * s) + 1.2 * L.u;
      g.lineCap = 'round';
      if (L.kind === 'kicks') {
        g.beginPath(); g.moveTo(0, 0); g.lineTo(-size * 0.12, drop + size * 0.2); g.moveTo(0, 0); g.lineTo(size * 0.12, drop + size * 0.2); g.stroke();
      } else {
        g.beginPath(); g.moveTo(0, 0); g.lineTo(0, drop + size * 0.08); g.stroke();
        if (L.kind === 'threads' || L.kind === 'ghost') {
          g.strokeStyle = L.kind === 'ghost' ? '#c9a14a' : '#c8c8e0';
          g.lineWidth = Math.max(1, 0.01 * s);
          g.beginPath();
          g.moveTo(-size * 0.36, drop + size * 0.16);
          g.lineTo(0, drop + size * 0.02);
          g.lineTo(size * 0.36, drop + size * 0.16);
          g.stroke();
        }
      }
      if (art) {
        const spr = spriteFor(art, size * K, 7 + i);
        g.drawImage(spr, -size / 2, drop, size, size);
      } else {
        // empty hook
        dot(g, 0, drop + size * 0.1, Math.max(1.5, 0.02 * s), m.rail);
      }
      g.restore();
    } else if (art) {
      const c = L.P(sl.X, sl.Y, sl.Z);
      const bob = sl.float ? Math.sin(t * 1.4 + i) * 0.03 * c[2] : 0;
      // spotlight + shadow for the vault
      if (sl.pedestal) {
        g.save();
        g.globalCompositeOperation = 'lighter';
        const top = L.P(sl.X, 2.44, sl.Z), base = L.P(sl.X, 1.18, sl.Z);
        void top;
        const gr = g.createLinearGradient(0, top[1], 0, base[1]);
        gr.addColorStop(0, 'rgba(255,240,190,0.35)');
        gr.addColorStop(1, 'rgba(255,240,190,0.04)');
        g.fillStyle = gr;
        g.beginPath();
        g.moveTo(top[0] - 0.05 * c[2], top[1]);
        g.lineTo(top[0] + 0.05 * c[2], top[1]);
        g.lineTo(base[0] + 0.3 * c[2], base[1]);
        g.lineTo(base[0] - 0.3 * c[2], base[1]);
        g.fill();
        g.restore();
      }
      const spr = spriteFor(art, c[2] * sl.size * K, 7 + i);
      g.drawImage(spr, c[0] - (c[2] * sl.size) / 2, c[1] - (c[2] * sl.size) / 2 + bob, c[2] * sl.size, c[2] * sl.size);
    }
  }
}

function drawTubesFlicker(g, L, t) {
  for (const tb of L.tubes) {
    if (!tb.flicker) continue;
    const f = Math.sin(t * 13 + tb.ph) + Math.sin(t * 29 + tb.ph * 2) + Math.sin(t * 0.8 + tb.ph);
    if (f < 1.3) continue;
    g.fillStyle = 'rgba(60,54,70,0.92)';
    g.beginPath();
    tb.pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
    g.closePath();
    g.fill();
  }
}

function drawDisco(g, L, t) {
  const [X, Y, Z] = L.plan.disco;
  const c = L.P(X, Y, Z);
  const top = L.P(X, CEIL, Z);
  const r = 0.17 * c[2];
  g.strokeStyle = INK; g.lineWidth = 1.2 * L.u;
  g.beginPath(); g.moveTo(top[0], top[1]); g.lineTo(c[0], c[1] - r); g.stroke();
  g.fillStyle = INK; g.beginPath(); g.arc(c[0], c[1], r + 1.6 * L.u, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#c8d0e0'; g.beginPath(); g.arc(c[0], c[1], r, 0, Math.PI * 2); g.fill();
  g.save();
  g.beginPath(); g.arc(c[0], c[1], r, 0, Math.PI * 2); g.clip();
  const n = 6;
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
    const ph = (i * 7 + j * 3 + Math.floor(t * 6)) % 5;
    g.fillStyle = ph === 0 ? '#ffffff' : ph === 1 ? '#bff3ff' : ph === 2 ? '#9aa6bd' : '#dfe6f2';
    g.fillRect(c[0] - r + (i * 2 * r) / n + 0.5, c[1] - r + (j * 2 * r) / n + 0.5, (2 * r) / n - 1, (2 * r) / n - 1);
  }
  g.restore();
  // light spots sweeping the car
  g.save();
  g.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 14; i++) {
    const a = t * 0.7 + i * 0.45;
    const side = i % 2 ? 1 : -1;
    const z = 2.5 + ((i * 0.9 + t * 0.6) % 7.5);
    const y = 0.4 + ((Math.sin(a) + 1) / 2) * 1.6;
    const q = L.P(side * HALF, y, z);
    const rr = 0.05 * q[2];
    g.fillStyle = i % 3 ? 'rgba(191,243,255,0.4)' : 'rgba(255,210,63,0.4)';
    g.beginPath(); g.ellipse(q[0], q[1], rr * 0.6, rr, 0, 0, Math.PI * 2); g.fill();
  }
  g.restore();
}

function drawScreens(g, L, t, kind) {
  for (const p of L.plan.props) {
    if (p.type === 'crt') {
      // TUNNEL RUN attract mode on the hanging screen
      const x0 = p.x - p.w / 2;
      const [sx, sy, s] = L.P(x0, p.y1, p.z);
      const k = s / 100;
      const w = p.w * 100, h = (p.y1 - p.y0) * 100;
      const X0 = sx + w * 0.07 * k + 1, Y0 = sy + 9 * k + 1, Wd = w * 0.86 * k - 2, Ht = (h - 15) * k - 2;
      g.save();
      g.beginPath(); g.rect(X0, Y0, Wd, Ht); g.clip();
      g.fillStyle = '#100c26'; g.fillRect(X0, Y0, Wd, Ht);
      for (let i = 0; i < 6; i++) {
        const bx = X0 + (((i * Wd) / 4 - t * Wd * 0.6) % (Wd * 1.5) + Wd * 1.5) % (Wd * 1.5) - Wd * 0.25;
        g.fillStyle = '#2b2a6a';
        g.fillRect(bx, Y0 + Ht * 0.2, Wd * 0.08, Ht * 0.62);
      }
      g.fillStyle = '#3ec7b0'; g.fillRect(X0, Y0 + Ht * 0.82, Wd, Ht * 0.04);
      const hop = Math.abs(Math.sin(t * 4)) * Ht * 0.25;
      g.fillStyle = '#ffd23f';
      g.beginPath(); g.ellipse(X0 + Wd * 0.3, Y0 + Ht * 0.74 - hop, Wd * 0.05, Ht * 0.08, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = Math.floor(t * 2) % 2 ? '#fffaf0' : 'rgba(255,250,240,0.15)';
      g.font = `${Math.max(6, Ht * 0.16)}px ${FONTS.sign}`;
      g.textAlign = 'center';
      g.fillText('PRESS START', X0 + Wd / 2, Y0 + Ht * 0.18);
      g.fillStyle = 'rgba(0,0,0,0.25)';
      for (let y = Y0; y < Y0 + Ht; y += 3) g.fillRect(X0, y, Wd, 1);
      g.restore();
    } else if (p.type === 'runner') {
      const [sx, sy, s] = L.P(p.x0, 1.78, p.z);
      const k = s / 100;
      const fw = (p.x1 - p.x0) * 100;
      const X0 = sx + 6 * k + 1, Y0 = sy + 32 * k + 1, Wd = (fw - 12) * k - 2, Ht = 52 * k - 2;
      g.save();
      g.beginPath(); g.rect(X0, Y0, Wd, Ht); g.clip();
      g.fillStyle = '#100c26'; g.fillRect(X0, Y0, Wd, Ht);
      g.fillStyle = '#3ec7b0'; g.fillRect(X0, Y0 + Ht * 0.8, Wd, Ht * 0.05);
      const hop = Math.abs(Math.sin(t * 4)) * Ht * 0.25;
      g.fillStyle = '#ffd23f'; g.beginPath(); g.ellipse(X0 + Wd * 0.35, Y0 + Ht * 0.72 - hop, Wd * 0.07, Ht * 0.07, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = Math.floor(t * 2) % 2 ? '#fffaf0' : 'rgba(255,250,240,0.2)';
      g.font = `${Math.max(5, Ht * 0.14)}px ${FONTS.sign}`;
      g.textAlign = 'center';
      g.fillText('INSERT TOKEN', X0 + Wd / 2, Y0 + Ht * 0.22);
      g.restore();
    }
  }
}

function drawMachineLights(g, L, t, kind, state, layer) {
  for (const p of L.plan.props) {
    if ((p.layer || 'back') !== layer) continue;
    if (p.type === 'claw') {
      const n = 9;
      for (let i = 0; i < n; i++) {
        const on = (Math.floor(t * 8) + i) % 3 === 0;
        const x = p.x0 - 0.03 + ((p.x1 - p.x0 + 0.06) * i) / (n - 1);
        const q = L.P(x, 1.73, p.z - 0.03);
        dot(g, q[0], q[1], Math.max(1.2, 0.012 * q[2]), on ? '#ffd23f' : '#7a3050');
      }
    } else if (p.type === 'capsule') {
      const dw = (p.x1 - p.x0) * (L.wide ? 1.08 : 1.0), cx = (p.x0 + p.x1) / 2, cyy = 1.0 + dw * 0.5;
      g.save();
      g.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 3; i++) {
        const ph = (t * 0.9 + i * 0.37 + (p.deluxe ? 0.5 : 0)) % 1;
        if (ph > 0.3) continue;
        const a = i * 2.1 + Math.floor(t * 0.9 + i * 0.37) * 1.3;
        const q = L.P(cx + Math.cos(a) * dw * 0.3, cyy + Math.sin(a) * dw * 0.3, p.z + 0.2);
        const sz = Math.sin((ph / 0.3) * Math.PI) * 0.05 * q[2];
        g.fillStyle = '#fffaf0';
        g.beginPath();
        g.moveTo(q[0], q[1] - sz); g.lineTo(q[0] + sz * 0.25, q[1] - sz * 0.25); g.lineTo(q[0] + sz, q[1]); g.lineTo(q[0] + sz * 0.25, q[1] + sz * 0.25);
        g.lineTo(q[0], q[1] + sz); g.lineTo(q[0] - sz * 0.25, q[1] + sz * 0.25); g.lineTo(q[0] - sz, q[1]); g.lineTo(q[0] - sz * 0.25, q[1] - sz * 0.25);
        g.fill();
      }
      g.restore();
      if (!p.deluxe && state && state.free) {
        // FREE DAILY PULL neon above the basic machine
        const on = Math.floor(t * 2.5) % 4 !== 0;
        const q = L.P(cx, 1.0 + dw + 0.16, p.z + 0.1);
        const s = q[2];
        g.save();
        g.font = `${0.07 * s}px ${FONTS.sign}`;
        g.textAlign = 'center';
        g.textBaseline = 'middle';
        g.lineJoin = 'round';
        const bw = Math.max(g.measureText('FREE DAILY PULL').width + 0.06 * s, 0.3 * s);
        g.fillStyle = INK;
        g.fillRect(q[0] - bw / 2, q[1] - 0.06 * s, bw, 0.12 * s);
        if (on) {
          g.globalCompositeOperation = 'lighter';
          g.fillStyle = 'rgba(126,217,87,0.3)';
          g.fillRect(q[0] - bw / 2 - 0.02 * s, q[1] - 0.08 * s, bw + 0.04 * s, 0.16 * s);
          g.globalCompositeOperation = 'source-over';
        }
        g.fillStyle = on ? '#b8ff9a' : '#3a5a30';
        g.fillText('FREE DAILY PULL', q[0], q[1] + 0.004 * s);
        g.restore();
      }
    } else if (p.type === 'reader') {
      const on = Math.floor(t * 2) % 2 === 0;
      const q = L.P(p.x1 - 0.03, p.y1 - 0.03, p.z - 0.005);
      dot(g, q[0], q[1], Math.max(1.2, 0.012 * q[2]), on ? '#7ed957' : '#2a4a2a');
    }
  }
}

function drawGhostFx(g, L, t) {
  // floating dust motes + an occasional dim-out
  const r = mulberry32(7);
  g.save();
  g.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 40; i++) {
    const x = (r() * L.W + Math.sin(t * 0.3 + i) * 20 * L.u) % L.W;
    const y = (r() * L.H - t * (6 + r() * 10) * L.u + L.H * 10) % L.H;
    g.fillStyle = `rgba(200,255,235,${0.15 + 0.15 * Math.sin(t * 2 + i)})`;
    g.fillRect(x, y, 1.6 * L.u, 1.6 * L.u);
  }
  g.restore();
}

function drawGlows(g, L, t, state) {
  if (!state || !state.glow) return;
  for (const h of L.hotspots) {
    const v = state.glow[h.id];
    if (!v) continue;
    const pulse = 0.55 + 0.45 * Math.sin(t * 4);
    const [x, y, w, hh] = h.rect;
    g.save();
    g.globalCompositeOperation = 'lighter';
    g.strokeStyle = `rgba(255,210,63,${0.55 * v * pulse})`;
    g.lineWidth = 7 * L.u;
    g.beginPath();
    if (g.roundRect) g.roundRect(x - 3, y - 3, w + 6, hh + 6, 10 * L.u); else g.rect(x - 3, y - 3, w + 6, hh + 6);
    g.stroke();
    g.strokeStyle = `rgba(255,250,220,${0.8 * v * pulse})`;
    g.lineWidth = 2 * L.u;
    g.stroke();
    g.restore();
  }
}

// ---------------------------------------------------------------- public draw

// Optional: bake a car ahead of time (behind a fade, or while idle) so the
// first drawCar() of that car is cheap. Same arguments as drawCar.
export function prewarmCar(g, L, kind, state = {}) {
  getBake(L, kind, state, scaleOf(g));
}

export function drawCar(g, L, kind, t, state = {}) {
  const K = scaleOf(g);
  const b = getBake(L, kind, state, K);
  if (L.hasGlass) {
    g.save();
    g.clip(L.glass);
    if (L.plan.geom === 'cab') drawCabTunnel(g, L, t);
    else drawTunnel(g, L, t, kind);
    g.restore();
  }
  g.drawImage(b.back, 0, 0, L.W, L.H);
  if (L.plan.geom === 'car') {
    drawTubesFlicker(g, L, t);
    drawStraps(g, L, t, false, kind);
  }
  if (L.plan.disco) drawDisco(g, L, t);
  drawScreens(g, L, t, kind);
  drawSlots(g, L, t, state, K);
  drawMachineLights(g, L, t, kind, state, 'back');
}

export function drawCarFront(g, L, kind, t, state = {}) {
  const K = scaleOf(g);
  const b = getBake(L, kind, state, K);
  g.drawImage(b.front, 0, 0, L.W, L.H);
  if (L.plan.geom === 'car') drawStraps(g, L, t, true, kind);
  drawMachineLights(g, L, t, kind, state, 'front');
  if (L.plan.old) {
    drawGhostFx(g, L, t);
    const f = Math.sin(t * 7.3) + Math.sin(t * 2.1 + 1) + Math.sin(t * 17);
    if (f > 2.1) {
      g.fillStyle = 'rgba(2,12,10,0.35)';
      g.fillRect(0, 0, L.W, L.H);
    }
  }
  drawGlows(g, L, t, state);
}
