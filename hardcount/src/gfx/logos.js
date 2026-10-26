// Team logos, drawn in code onto a 2D canvas. One function draws any team's
// emblem at any size, so the same art lands on helmets, the midfield paint,
// end zones, the scoreboard, menus and the score bug.
//
//   drawLogo(ctx, team, cx, cy, size, opts)   size = the logo's height in px
//     opts.mono: '#hex'  one-colour version (field paint)
//     opts.flat: true    no glossy highlight (paint, decals)
//   logoCanvas(team, px, opts)  → cached square canvas with the logo centred
//   logoTexture(team, px, opts) → cached THREE.CanvasTexture of logoCanvas
//
// team.logo = { emblem, fg, bg, ring }. STUB: a roundel with the abbreviation —
// the league pass replaces it with real emblems keeping these signatures.
import * as THREE from 'three';
import { vText } from '../core/font.js';

export function drawLogo(ctx, team, cx, cy, size, opts = {}) {
  const L = team.logo || {};
  const fg = opts.mono || L.fg || team.colors.secondary;
  const bg = opts.mono ? null : (L.bg || team.colors.primary);
  const ring = opts.mono || L.ring || '#ffffff';
  const r = size / 2;
  ctx.save();
  ctx.translate(cx, cy);
  if (bg) {
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.96, 0, Math.PI * 2);
    ctx.fillStyle = bg;
    ctx.fill();
  }
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.9, 0, Math.PI * 2);
  ctx.lineWidth = r * 0.1;
  ctx.strokeStyle = ring;
  ctx.stroke();
  const ab = team.abbr || '?';
  const fs = size * (ab.length > 2 ? 0.34 : 0.44);
  vText(ctx, ab, 0, fs / 2, fs, { align: 'center', color: fg, weight: 0.2, skew: -0.12 });
  ctx.restore();
}

const canvasCache = new Map();
const texCache = new Map();

export function logoCanvas(team, px = 256, opts = {}) {
  const key = `${team.id}:${px}:${opts.mono || ''}:${opts.flat ? 1 : 0}`;
  if (canvasCache.has(key)) return canvasCache.get(key);
  const c = document.createElement('canvas');
  c.width = c.height = px;
  drawLogo(c.getContext('2d'), team, px / 2, px / 2, px * 0.92, opts);
  canvasCache.set(key, c);
  return c;
}

export function logoTexture(team, px = 256, opts = {}) {
  const key = `${team.id}:${px}:${opts.mono || ''}:${opts.flat ? 1 : 0}`;
  if (texCache.has(key)) return texCache.get(key);
  const t = new THREE.CanvasTexture(logoCanvas(team, px, opts));
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  t.userData.keep = true;
  texCache.set(key, t);
  return t;
}
