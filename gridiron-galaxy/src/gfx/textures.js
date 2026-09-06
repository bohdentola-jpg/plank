// Everything painted onto canvases and handed to three.js: planets, fields, decals, skies, glows.
import * as THREE from '../../vendor/three.module.js';
import { makeRng, hashStr, shade, mix, hexToRgb, rgba, hsl, textOn } from '../util.js';

export function canvas(w, h) { const cv = document.createElement('canvas'); cv.width = w; cv.height = h; return { cv, ctx: cv.getContext('2d') }; }
function tex(cv, opts = {}) {
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  if (opts.repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; }
  return t;
}
export function speckle(ctx, w, h, rnd, count, color, alpha, rmin = 1, rmax = 3) {
  ctx.save(); ctx.globalAlpha = alpha; ctx.fillStyle = color;
  for (let i = 0; i < count; i++) { const r = rnd.range(rmin, rmax); ctx.beginPath(); ctx.arc(rnd() * w, rnd() * h, r, 0, Math.PI * 2); ctx.fill(); }
  ctx.restore();
}
export function blob(ctx, x, y, r, color, rnd, wob = 0.35) {
  ctx.fillStyle = color; ctx.beginPath();
  const n = 14; for (let i = 0; i <= n; i++) { const a = (i / n) * Math.PI * 2; const rr = r * (1 + (rnd() - 0.5) * wob); const px = x + Math.cos(a) * rr, py = y + Math.sin(a) * rr; i ? ctx.lineTo(px, py) : ctx.moveTo(px, py); }
  ctx.closePath(); ctx.fill();
}

// ---- toon shading ramp ----
let _grad = null;
export function gradientMap() {
  if (_grad) return _grad;
  const data = new Uint8Array([70, 70, 70, 255, 140, 140, 140, 255, 200, 200, 200, 255, 255, 255, 255, 255]);
  const t = new THREE.DataTexture(data, 4, 1, THREE.RGBAFormat); t.minFilter = t.magFilter = THREE.NearestFilter; t.needsUpdate = true;
  _grad = t; return t;
}

export function radialGlow(color, size = 256, inner = 0.0, power = 1) {
  const { cv, ctx } = canvas(size, size);
  const g = ctx.createRadialGradient(size / 2, size / 2, size * inner * 0.5, size / 2, size / 2, size / 2);
  const [r, gg, b] = hexToRgb(color);
  g.addColorStop(0, `rgba(${r},${gg},${b},1)`); g.addColorStop(0.35, `rgba(${r},${gg},${b},${0.55 * power})`); g.addColorStop(0.7, `rgba(${r},${gg},${b},${0.15 * power})`); g.addColorStop(1, `rgba(${r},${gg},${b},0)`);
  ctx.fillStyle = g; ctx.fillRect(0, 0, size, size);
  return tex(cv);
}
export function ringGlow(color, size = 256) {
  const { cv, ctx } = canvas(size, size); const c = size / 2;
  ctx.strokeStyle = color; ctx.lineWidth = size * 0.045; ctx.shadowColor = color; ctx.shadowBlur = size * 0.08;
  ctx.beginPath(); ctx.arc(c, c, size * 0.4, 0, Math.PI * 2); ctx.stroke();
  ctx.lineWidth = size * 0.02; ctx.strokeStyle = '#ffffff'; ctx.beginPath(); ctx.arc(c, c, size * 0.4, 0, Math.PI * 2); ctx.stroke();
  for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 + Math.PI / 4; ctx.fillStyle = color; ctx.beginPath(); ctx.moveTo(c + Math.cos(a) * size * 0.46, c + Math.sin(a) * size * 0.46); ctx.lineTo(c + Math.cos(a + 0.12) * size * 0.36, c + Math.sin(a + 0.12) * size * 0.36); ctx.lineTo(c + Math.cos(a - 0.12) * size * 0.36, c + Math.sin(a - 0.12) * size * 0.36); ctx.fill(); }
  return tex(cv);
}
export function starSprite() {
  const { cv, ctx } = canvas(64, 64);
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.25, 'rgba(255,255,255,0.8)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, 64, 64);
  return tex(cv);
}

// ---- planets ----
export function planetTexture(look, seed) {
  const W = 512, H = 256; const { cv, ctx } = canvas(W, H);
  const rnd = makeRng(hashStr(seed)); const [c0, c1, c2] = look.colors;
  const fill = (c) => { ctx.fillStyle = c; ctx.fillRect(0, 0, W, H); };
  const blobs = (n, color, rmin, rmax, wob = 0.4) => { for (let i = 0; i < n; i++) blob(ctx, rnd() * W, rnd() * H, rnd.range(rmin, rmax), color, rnd, wob); };
  const bands = (colors, count) => { for (let i = 0; i < count; i++) { const y = (i / count) * H, hgt = H / count; ctx.fillStyle = colors[i % colors.length]; ctx.beginPath(); ctx.moveTo(0, y); for (let x = 0; x <= W; x += 16) ctx.lineTo(x, y + Math.sin(x / 40 + i) * 5 + Math.sin(x / 13 + i * 3) * 2); ctx.lineTo(W, y + hgt); ctx.lineTo(0, y + hgt); ctx.closePath(); ctx.fill(); } };
  const craters = (n, base) => { for (let i = 0; i < n; i++) { const x = rnd() * W, y = rnd() * H, r = rnd.range(4, 22); ctx.fillStyle = shade(base, -0.25); ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill(); ctx.fillStyle = shade(base, -0.1); ctx.beginPath(); ctx.arc(x + r * 0.15, y + r * 0.15, r * 0.75, 0, 7); ctx.fill(); ctx.fillStyle = shade(base, 0.2); ctx.beginPath(); ctx.arc(x, y, r, Math.PI * 1.1, Math.PI * 1.9); ctx.lineWidth = 2; ctx.strokeStyle = shade(base, 0.25); ctx.stroke(); } };
  const caps = (color) => { ctx.fillStyle = color; blob(ctx, W * 0.5, 0, W * 0.6, color, rnd, 0.2); ctx.save(); ctx.translate(0, H); blob(ctx, W * 0.5, 0, W * 0.6, color, rnd, 0.2); ctx.restore(); ctx.fillRect(0, 0, W, 14); ctx.fillRect(0, H - 14, W, 14); };
  const clouds = (alpha = 0.55) => { ctx.save(); ctx.globalAlpha = alpha; for (let i = 0; i < 26; i++) { const y = rnd() * H, x = rnd() * W, len = rnd.range(30, 110); for (let k = 0; k < 6; k++) { ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.ellipse(x + rnd.range(-len / 2, len / 2), y + rnd.range(-6, 6), rnd.range(10, 26), rnd.range(5, 11), 0, 0, 7); ctx.fill(); } } ctx.restore(); };
  const glowdots = (n, color) => { ctx.save(); ctx.shadowColor = color; ctx.shadowBlur = 8; for (let i = 0; i < n; i++) { ctx.fillStyle = color; ctx.globalAlpha = rnd.range(0.4, 1); ctx.fillRect(rnd() * W, rnd() * H, rnd.range(1, 4), rnd.range(1, 4)); } ctx.restore(); };
  const cracks = (n, color, width = 2, glow = false) => { ctx.save(); ctx.strokeStyle = color; ctx.lineWidth = width; if (glow) { ctx.shadowColor = color; ctx.shadowBlur = 10; } for (let i = 0; i < n; i++) { let x = rnd() * W, y = rnd() * H; ctx.beginPath(); ctx.moveTo(x, y); for (let k = 0; k < 8; k++) { x += rnd.range(-30, 30); y += rnd.range(-20, 20); ctx.lineTo(x, y); } ctx.stroke(); } ctx.restore(); };
  switch (look.type) {
    case 'earth': fill(c0); blobs(9, c1, 30, 70, 0.6); blobs(14, shade(c1, -0.2), 8, 25, 0.6); blobs(6, '#c9b98a', 6, 14); caps('#f4f8ff'); clouds(0.6); break;
    case 'moon': fill(c0); blobs(10, c1, 20, 60, 0.5); craters(40, c0); speckle(ctx, W, H, rnd, 600, c2, 0.3, 0.5, 1.5); break;
    case 'rocky': fill(c0); blobs(12, c1, 20, 70, 0.6); blobs(20, shade(c0, -0.15), 5, 30); if (look.caps) caps(look.caps); if (look.spots) blobs(30, c1, 4, 12, 0.2); if (look.hex) { ctx.strokeStyle = shade(c0, -0.35); ctx.lineWidth = 3; for (let y = 0; y < H + 20; y += 22) for (let x = 0; x < W + 20; x += 26) { const ox = (Math.floor(y / 22) % 2) * 13; ctx.beginPath(); for (let k = 0; k < 6; k++) { const a = Math.PI / 3 * k + Math.PI / 6; const px = x + ox + Math.cos(a) * 13, py = y + Math.sin(a) * 13; k ? ctx.lineTo(px, py) : ctx.moveTo(px, py); } ctx.closePath(); ctx.stroke(); } } if (look.lines) { for (let y = 0; y < H; y += 9) { ctx.fillStyle = rnd.pick([c0, c1, c2, shade(c0, -0.3)]); ctx.fillRect(0, y, W, 6); } } if (look.fog) clouds(0.35); if (look.flowers) { speckle(ctx, W, H, rnd, 300, '#ff7bac', 0.8, 1.5, 3.5); speckle(ctx, W, H, rnd, 200, '#ffe66d', 0.8, 1, 2.5); } speckle(ctx, W, H, rnd, 400, shade(c0, 0.2), 0.2, 0.5, 2); break;
    case 'gas': bands([c0, c1, c2, shade(c0, -0.1), c1], 14); ctx.save(); ctx.globalAlpha = 0.25; blobs(10, '#ffffff', 10, 30, 0.8); ctx.restore(); break;
    case 'ice': fill(c0); blobs(12, c1, 20, 60, 0.5); cracks(30, '#ffffff', 1.5); blobs(6, c2, 20, 50, 0.4); caps('#ffffff'); break;
    case 'lava': fill(c0); blobs(14, shade(c0, 0.1), 20, 60); cracks(40, c1, 2.5, true); blobs(8, c1, 8, 22, 0.6); blobs(5, c2, 4, 10, 0.5); break;
    case 'ocean': fill(c0); blobs(14, shade(c0, 0.25), 20, 60, 0.6); blobs(10, c1, 10, 30, 0.6); blobs(5, '#e8d8a8', 4, 12); clouds(0.4); break;
    case 'desert': bands([c0, c1, c2, c0], 10); for (let i = 0; i < 40; i++) { ctx.strokeStyle = shade(c1, -0.2); ctx.lineWidth = 2; ctx.beginPath(); const y = rnd() * H, x = rnd() * W; ctx.moveTo(x, y); ctx.quadraticCurveTo(x + 30, y - 10, x + 60, y); ctx.stroke(); } break;
    case 'swirl': fill(c1); ctx.lineWidth = 18; for (let i = 0; i < 8; i++) { ctx.strokeStyle = i % 2 ? c0 : c2; ctx.beginPath(); for (let x = -40; x <= W + 40; x += 8) ctx.lineTo(x, i * 34 + Math.sin(x / 50 + i) * 14); ctx.stroke(); } speckle(ctx, W, H, rnd, 120, '#ffffff', 0.7, 2, 5); break;
    case 'crystal': fill(c0); for (let i = 0; i < 60; i++) { ctx.fillStyle = rnd.pick([c0, c1, c2, shade(c1, 0.3)]); ctx.globalAlpha = 0.85; ctx.beginPath(); const x = rnd() * W, y = rnd() * H, r = rnd.range(15, 50); for (let k = 0; k < 5; k++) { const a = k / 5 * 7 + rnd(); ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r); } ctx.closePath(); ctx.fill(); } ctx.globalAlpha = 1; break;
    case 'metal': fill(c0); ctx.strokeStyle = shade(c0, 0.25); ctx.lineWidth = 2; for (let y = 0; y < H; y += 32) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); } for (let x = 0; x < W; x += 48) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); } if (look.lights) { glowdots(700, c1); glowdots(500, c2); } if (look.junk) { blobs(30, c1, 5, 25, 0.8); blobs(20, c2, 3, 12, 0.8); } if (look.gears) { for (let i = 0; i < 14; i++) { const x = rnd() * W, y = rnd() * H, r = rnd.range(8, 22); ctx.fillStyle = c1; ctx.beginPath(); for (let k = 0; k < 16; k++) { const a = k / 16 * Math.PI * 2; const rr = k % 2 ? r : r * 0.78; ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); } ctx.closePath(); ctx.fill(); ctx.fillStyle = c0; ctx.beginPath(); ctx.arc(x, y, r * 0.35, 0, 7); ctx.fill(); } } break;
    case 'jungle': fill(c0); blobs(16, c1, 20, 60, 0.6); blobs(12, c2, 8, 30, 0.6); cracks(10, '#3a86ff', 3); if (look.flowers) { speckle(ctx, W, H, rnd, 400, '#ff7bac', 0.9, 1.5, 3.5); speckle(ctx, W, H, rnd, 250, '#ffe66d', 0.9, 1, 2.5); } clouds(0.35); break;
    case 'cheese': fill(c0); blobs(10, c2, 20, 60, 0.4); for (let i = 0; i < 40; i++) { const x = rnd() * W, y = rnd() * H, r = rnd.range(5, 20); ctx.fillStyle = shade(c1, -0.35); ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill(); ctx.fillStyle = shade(c1, -0.15); ctx.beginPath(); ctx.arc(x - r * 0.15, y - r * 0.15, r * 0.7, 0, 7); ctx.fill(); } break;
    case 'asteroid': fill(c0); blobs(20, c1, 10, 50, 0.8); craters(30, c0); blobs(10, c2, 5, 20, 0.8); break;
    case 'bubble': fill(c0); ctx.globalAlpha = 0.7; for (let i = 0; i < 60; i++) { const x = rnd() * W, y = rnd() * H, r = rnd.range(6, 30); ctx.strokeStyle = rnd.pick([c1, c2, '#ffffff']); ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.stroke(); ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(x - r * 0.4, y - r * 0.4, r * 0.2, 0, 7); ctx.fill(); } ctx.globalAlpha = 1; break;
    case 'disco': for (let y = 0; y < H; y += 16) for (let x = 0; x < W; x += 16) { ctx.fillStyle = hsl(rnd() * 360, 0.9, rnd.range(0.45, 0.75)); ctx.fillRect(x, y, 15, 15); } break;
    case 'goo': fill(c1); blobs(30, c0, 15, 60, 0.7); blobs(20, c2, 5, 25, 0.7); ctx.globalAlpha = 0.5; blobs(15, '#ffffff', 3, 9, 0.3); ctx.globalAlpha = 1; break;
    case 'pizza': fill(c1); blobs(30, c2, 20, 60, 0.6); blobs(10, c0, 15, 40, 0.5); for (let i = 0; i < 26; i++) { const x = rnd() * W, y = rnd() * H, r = rnd.range(8, 16); ctx.fillStyle = '#b8282a'; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill(); ctx.fillStyle = '#8a1a1c'; for (let k = 0; k < 4; k++) { ctx.beginPath(); ctx.arc(x + rnd.range(-r * .6, r * .6), y + rnd.range(-r * .6, r * .6), 2, 0, 7); ctx.fill(); } } break;
    case 'ringworld': fill(c2); ctx.strokeStyle = c1; ctx.lineWidth = 3; for (let y = 8; y < H; y += 24) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); } glowdots(400, c1); break;
    case 'void': fill(c0); for (let i = 0; i < 12; i++) { ctx.strokeStyle = rnd.pick([c1, c2]); ctx.lineWidth = rnd.range(2, 8); ctx.globalAlpha = 0.5; ctx.beginPath(); for (let x = 0; x <= W; x += 8) ctx.lineTo(x, i * 22 + Math.sin(x / 30 + i) * 12); ctx.stroke(); } ctx.globalAlpha = 1; glowdots(200, '#ffffff'); break;
    case 'clock': fill(c0); ctx.strokeStyle = shade(c0, -0.3); ctx.lineWidth = 2; for (let i = 0; i < 10; i++) { const x = rnd() * W, y = rnd() * H, r = rnd.range(14, 34); ctx.fillStyle = c1; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill(); ctx.stroke(); ctx.strokeStyle = c2; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + r * 0.6, y - r * 0.3); ctx.moveTo(x, y); ctx.lineTo(x - r * 0.2, y - r * 0.7); ctx.stroke(); } break;
    case 'ship': fill(c0); ctx.strokeStyle = c1; ctx.lineWidth = 2; for (let y = 0; y < H; y += 20) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); } glowdots(300, c1); break;
    default: fill(c0); blobs(10, c1, 20, 60); break;
  }
  // lighting vignette on the poles for a rounder look
  const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, 'rgba(0,0,0,0.35)'); g.addColorStop(0.2, 'rgba(0,0,0,0)'); g.addColorStop(0.8, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.35)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  return tex(cv);
}
export function ringTexture(colors) {
  const { cv, ctx } = canvas(256, 16); const rnd = makeRng(7);
  for (let x = 0; x < 256; x++) { const t = x / 256; const a = t < 0.08 || t > 0.95 ? 0 : (0.35 + rnd() * 0.5) * Math.sin(t * Math.PI); ctx.fillStyle = rgba(colors[x % 2 ? 0 : 1], a); ctx.fillRect(x, 0, 1, 16); }
  return tex(cv);
}

// ---- stadium sky ----
export function skyTexture(theme, night) {
  const { cv, ctx } = canvas(64, 512);
  const g = ctx.createLinearGradient(0, 0, 0, 512);
  g.addColorStop(0, theme.sky[0]); g.addColorStop(0.55, theme.sky[1]); g.addColorStop(1, theme.sky[2]);
  ctx.fillStyle = g; ctx.fillRect(0, 0, 64, 512);
  if (night) { const rnd = makeRng(99); for (let i = 0; i < 160; i++) { ctx.fillStyle = `rgba(255,255,255,${rnd.range(0.3, 1)})`; ctx.fillRect(rnd() * 64, rnd() * 260, rnd() > 0.85 ? 2 : 1, rnd() > 0.85 ? 2 : 1); } }
  const t = tex(cv); t.wrapS = THREE.RepeatWrapping; return t;
}

// ---- decals ----
export function numberTexture(num, color = '#ffffff', outline = '#111122') {
  const { cv, ctx } = canvas(256, 256);
  ctx.font = 'bold 190px "Arial Black", "Arial Rounded MT Bold", Impact, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.lineWidth = 22; ctx.strokeStyle = outline; ctx.lineJoin = 'round'; ctx.strokeText(String(num), 128, 140);
  ctx.fillStyle = color; ctx.fillText(String(num), 128, 140);
  return tex(cv);
}
export function emblemTexture(team) {
  const { cv, ctx } = canvas(256, 256); const [p, s] = team.colors;
  ctx.fillStyle = s; ctx.beginPath(); ctx.arc(128, 128, 120, 0, 7); ctx.fill();
  ctx.fillStyle = p; ctx.beginPath(); ctx.arc(128, 128, 100, 0, 7); ctx.fill();
  ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 8; ctx.beginPath(); ctx.arc(128, 128, 110, 0, 7); ctx.stroke();
  const letters = (team.short || team.name).replace(/[^A-Z]/g, '').slice(0, 2) || 'GG';
  ctx.font = `bold ${letters.length > 1 ? 120 : 150}px "Arial Black", Impact, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.lineWidth = 14; ctx.strokeStyle = '#111122'; ctx.strokeText(letters, 128, 138); ctx.fillStyle = '#ffffff'; ctx.fillText(letters, 128, 138);
  return tex(cv);
}
export function labelTexture(text, color = '#ffffff', bg = null, w = 512, h = 128, font = 'bold 80px "Arial Black", Impact, sans-serif') {
  const { cv, ctx } = canvas(w, h);
  if (bg) { ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h); }
  ctx.font = font; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.lineWidth = 10; ctx.strokeStyle = '#111122'; ctx.lineJoin = 'round'; ctx.strokeText(text, w / 2, h / 2 + 4);
  ctx.fillStyle = color; ctx.fillText(text, w / 2, h / 2 + 4);
  return tex(cv);
}

// ---- the field ----
// World: x across [-W/2, W/2], z along [0, L]. Texture covers field + apron.
export const FIELD = { W: 30, L: 70, EZ: 10, APRON: 3 };
export function fieldTexture(surface, homeTeam, awayTeam, opts = {}) {
  const PPY = 32; const { W, L, EZ, APRON } = FIELD;
  const tw = (W + APRON * 2) * PPY, th = (L + APRON * 2) * PPY;
  const { cv, ctx } = canvas(tw, th); const rnd = makeRng(hashStr(surface.type + surface.base));
  const X = (x) => (x + W / 2 + APRON) * PPY, Z = (z) => (z + APRON) * PPY; // canvas y grows with world z (plane is rotated -90deg about x)
  const apron = shade(surface.base, -0.35);
  ctx.fillStyle = apron; ctx.fillRect(0, 0, tw, th);
  // base + stripes
  for (let z = 0; z < L; z += 5) { ctx.fillStyle = ((z / 5) % 2 === 0) ? surface.base : surface.stripe; ctx.fillRect(X(-W / 2), Z(z), W * PPY, 5 * PPY + 1); }
  // surface detail
  ctx.save(); ctx.beginPath(); ctx.rect(X(-W / 2), Z(0), W * PPY, L * PPY); ctx.clip();
  switch (surface.type) {
    case 'grass': speckle(ctx, tw, th, rnd, 9000, shade(surface.base, 0.18), 0.18, 1, 3); speckle(ctx, tw, th, rnd, 6000, shade(surface.base, -0.25), 0.15, 1, 3); break;
    case 'turf': speckle(ctx, tw, th, rnd, 12000, shade(surface.base, 0.12), 0.12, 0.6, 1.4); break;
    case 'dust': case 'sand': speckle(ctx, tw, th, rnd, 14000, shade(surface.base, -0.3), 0.2, 0.8, 2.5); speckle(ctx, tw, th, rnd, 6000, shade(surface.base, 0.25), 0.2, 0.8, 2); break;
    case 'ice': ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 2; for (let i = 0; i < 60; i++) { let x = rnd() * tw, y = rnd() * th; ctx.beginPath(); ctx.moveTo(x, y); for (let k = 0; k < 5; k++) { x += rnd.range(-80, 80); y += rnd.range(-80, 80); ctx.lineTo(x, y); } ctx.stroke(); } speckle(ctx, tw, th, rnd, 3000, '#ffffff', 0.25, 1, 3); break;
    case 'metal': ctx.strokeStyle = shade(surface.base, -0.3); ctx.lineWidth = 3; for (let x = 0; x < tw; x += 4 * PPY) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, th); ctx.stroke(); } for (let y = 0; y < th; y += 4 * PPY) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(tw, y); ctx.stroke(); } ctx.fillStyle = shade(surface.base, 0.3); for (let x = 12; x < tw; x += 4 * PPY) for (let y = 12; y < th; y += 4 * PPY) { ctx.beginPath(); ctx.arc(x, y, 4, 0, 7); ctx.fill(); } break;
    case 'wood': for (let y = 0; y < th; y += 1.2 * PPY) { ctx.fillStyle = rnd.chance(0.5) ? shade(surface.base, rnd.range(-0.12, 0.12)) : 'transparent'; ctx.fillRect(0, y, tw, 1.2 * PPY - 3); } ctx.strokeStyle = shade(surface.base, -0.4); ctx.lineWidth = 2; for (let y = 0; y < th; y += 1.2 * PPY) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(tw, y); ctx.stroke(); } break;
    case 'goo': for (let i = 0; i < 250; i++) blob(ctx, rnd() * tw, rnd() * th, rnd.range(10, 50), rgba(shade(surface.base, rnd.range(-0.2, 0.3)), 0.6), rnd, 0.6); break;
    case 'glass': ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 2; for (let x = 0; x < tw; x += 3 * PPY) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, th); ctx.stroke(); } for (let y = 0; y < th; y += 3 * PPY) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(tw, y); ctx.stroke(); } break;
    default: speckle(ctx, tw, th, rnd, 5000, shade(surface.base, 0.15), 0.12, 1, 2.5);
  }
  ctx.restore();
  // end zones
  const ez = (z0, team, flip) => {
    ctx.fillStyle = team.colors[0]; ctx.fillRect(X(-W / 2), Z(z0), W * PPY, EZ * PPY);
    ctx.save(); ctx.beginPath(); ctx.rect(X(-W / 2), Z(z0), W * PPY, EZ * PPY); ctx.clip();
    ctx.fillStyle = rgba(team.colors[1], 0.25); for (let i = -2; i < 8; i++) { ctx.beginPath(); ctx.moveTo(X(-W / 2) + i * 6 * PPY, Z(z0)); ctx.lineTo(X(-W / 2) + (i + 2) * 6 * PPY, Z(z0)); ctx.lineTo(X(-W / 2) + (i + 4) * 6 * PPY, Z(z0 + EZ)); ctx.lineTo(X(-W / 2) + (i + 2) * 6 * PPY, Z(z0 + EZ)); ctx.fill(); }
    ctx.restore();
    // letters run across the field; their tops point away from midfield so the attacking offense reads them
    ctx.save(); ctx.translate(X(0), Z(z0 + EZ / 2)); ctx.rotate(flip ? Math.PI : 0);
    ctx.font = `bold ${5.2 * PPY}px "Arial Black", Impact, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.lineWidth = 14; ctx.strokeStyle = shade(team.colors[1], -0.4); ctx.strokeText(team.short, 0, 0); ctx.fillStyle = textOn(team.colors[0]) === '#ffffff' ? '#ffffff' : team.colors[1]; ctx.fillText(team.short, 0, 0);
    ctx.restore();
  };
  ez(0, homeTeam, false); ez(L - EZ, awayTeam, true);
  // lines
  ctx.strokeStyle = surface.line; ctx.fillStyle = surface.line;
  const line = (z, w) => { ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(X(-W / 2), Z(z)); ctx.lineTo(X(W / 2), Z(z)); ctx.stroke(); };
  for (let z = EZ; z <= L - EZ; z += 5) line(z, z === EZ || z === L - EZ ? 8 : 4);
  ctx.lineWidth = 6; ctx.strokeRect(X(-W / 2), Z(0), W * PPY, L * PPY); // boundary
  // hash marks
  ctx.lineWidth = 3; for (let z = EZ + 1; z < L - EZ; z++) { if (z % 5 === 0) continue; for (const hx of [-W / 2 + 0.6, -6, 6, W / 2 - 0.6]) { ctx.beginPath(); ctx.moveTo(X(hx - 0.5), Z(z)); ctx.lineTo(X(hx + 0.5), Z(z)); ctx.stroke(); } }
  // numbers (10, 20, 20, 10 with 25 midfield)
  ctx.font = `bold ${2.6 * PPY}px "Arial Black", Impact, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const nums = [[EZ + 10, '10'], [EZ + 20, '20'], [L - EZ - 20, '20'], [L - EZ - 10, '10']];
  for (const [z, s] of nums) for (const side of [-1, 1]) { ctx.save(); ctx.translate(X(side * 9.5), Z(z)); ctx.rotate(side > 0 ? -Math.PI / 2 : Math.PI / 2); ctx.lineWidth = 6; ctx.strokeStyle = shade(surface.base, -0.5); ctx.strokeText(s, 0, 0); ctx.fillStyle = surface.line; ctx.fillText(s, 0, 0); ctx.restore(); }
  // midfield emblem
  const mid = L / 2; ctx.save(); ctx.translate(X(0), Z(mid)); ctx.rotate(Math.PI / 2);
  const r = 4.2 * PPY; ctx.fillStyle = homeTeam.colors[1]; ctx.beginPath(); ctx.arc(0, 0, r, 0, 7); ctx.fill();
  ctx.fillStyle = homeTeam.colors[0]; ctx.beginPath(); ctx.arc(0, 0, r * 0.82, 0, 7); ctx.fill();
  ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 6; ctx.beginPath(); ctx.arc(0, 0, r * 0.9, 0, 7); ctx.stroke();
  const letters = (homeTeam.short || 'GG').replace(/[^A-Z]/g, '').slice(0, 2);
  ctx.font = `bold ${3.4 * PPY}px "Arial Black", Impact, sans-serif`; ctx.lineWidth = 8; ctx.strokeStyle = '#111122'; ctx.strokeText(letters, 0, 6); ctx.fillStyle = '#ffffff'; ctx.fillText(letters, 0, 6);
  ctx.restore();
  const t = tex(cv); return t;
}
