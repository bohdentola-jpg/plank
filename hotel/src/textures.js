// Every surface in the hotel, drawn into canvases at load time: corridor carpet,
// wallpaper, stucco, brick, the roadside marquee, the pool. No image files anywhere.
import * as THREE from 'three';

const COND = `'Arial Narrow', 'Helvetica Neue', Impact, sans-serif`;
const SANS = `'Helvetica Neue', Arial, Helvetica, sans-serif`;
const MONO = `'DejaVu Sans Mono', 'Courier New', monospace`;

export function mkCanvas(w, h) {
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  return cv;
}

export function tex(canvas, { repeat = null, srgb = true, aniso = 8 } = {}) {
  const t = new THREE.CanvasTexture(canvas);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(repeat[0], repeat[1]);
  }
  t.anisotropy = aniso;
  return t;
}

// ---------------------------------------------------------------- colour math
function chan(v) { return Math.max(0, Math.min(255, Math.round(v))); }

function hexOf(r, g, b) {
  return `#${((chan(r) << 16) | (chan(g) << 8) | chan(b)).toString(16).padStart(6, '0')}`;
}

function rgbOf(hex) {
  const n = parseInt(String(hex).slice(1), 16) || 0;
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function shade(hex, amt) {
  const [r, g, b] = rgbOf(hex);
  return hexOf(r + amt, g + amt, b + amt);
}

export function luminance(hex) {
  const [r, g, b] = rgbOf(hex);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

export function contrastText(hex) { return luminance(hex) > 0.55 ? '#16181d' : '#f6f6f4'; }

export function mix(hexA, hexB, t) {
  const k = Math.max(0, Math.min(1, t));
  const a = rgbOf(hexA), b = rgbOf(hexB);
  return hexOf(a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k);
}

// ---------------------------------------------------------------- grain + tiling
export function speckle(ctx, x, y, w, h, n, colors, rMin = 1, rMax = 2.6) {
  for (let i = 0; i < n; i++) {
    ctx.fillStyle = colors[(Math.random() * colors.length) | 0];
    ctx.globalAlpha = 0.06 + Math.random() * 0.10;
    const r = rMin + Math.random() * (rMax - rMin);
    ctx.fillRect(x + Math.random() * w, y + Math.random() * h, r, r);
  }
  ctx.globalAlpha = 1;
}

function flood(ctx, color, w, h) {
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, w, h);
}

// Run draw() at every wrapped offset, so a motif that runs off one edge of the
// tile comes back on the opposite edge and the seam disappears. Anything random
// inside a motif must be rolled BEFORE the call, or the nine copies disagree.
function wrap(ctx, S, draw) {
  for (let dx = -S; dx <= S; dx += S) {
    for (let dy = -S; dy <= S; dy += S) {
      ctx.save();
      ctx.translate(dx, dy);
      draw();
      ctx.restore();
    }
  }
}

// mulberry32 — small, fast, and the same every time for a given seed.
function rng(seed) {
  let s = ((seed | 0) * 1831565813 + 0x9e3779b9) >>> 0;
  return function next() {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Stable 0..1 from a grid cell, so brick and tile jitter agrees across the seam.
function hash2(a, b) {
  const n = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;
  return n - Math.floor(n);
}

function diamond(ctx, cx, cy, rx, ry) {
  ctx.beginPath();
  ctx.moveTo(cx, cy - ry);
  ctx.lineTo(cx + rx, cy);
  ctx.lineTo(cx, cy + ry);
  ctx.lineTo(cx - rx, cy);
  ctx.closePath();
}

// Eight-petal rosette: the little woven thing at every carpet lattice node.
// Alternating petal lengths keep it from reading as a plain plus sign.
function fleur(ctx, cx, cy, r, color, alpha = 0.8) {
  ctx.fillStyle = color;
  ctx.globalAlpha = alpha;
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4;
    const len = i % 2 ? r * 0.62 : r;
    ctx.beginPath();
    ctx.ellipse(cx + Math.cos(a) * len * 0.56, cy + Math.sin(a) * len * 0.56, len * 0.44, len * 0.19, a, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.26, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
}

// An unlit tube is cold glass, not a dim version of the colour it glows.
function deadTube(color) { return mix(color, '#2b2c31', 0.86); }

// One grass blade, plus its copy on the far edge when it hangs over one. Too
// small to justify the full nine passes wrap() makes.
function blade(ctx, S, x, y, dx, dy) {
  const xs = x < 4 ? [x, x + S] : (x > S - 4 ? [x, x - S] : [x]);
  const ys = y < 6 ? [y, y + S] : (y > S - 6 ? [y, y - S] : [y]);
  for (const px of xs) {
    for (const py of ys) {
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(px + dx, py + dy);
      ctx.stroke();
    }
  }
}

// The four-point twinkle every 1960s motel sign has at least two of.
function starburst(ctx, x, y, r, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4 - Math.PI / 2;
    const rad = i % 2 ? r * 0.26 : r;
    const px = x + Math.cos(a) * rad, py = y + Math.sin(a) * rad;
    if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py);
  }
  ctx.closePath();
  ctx.fill();
}

// ---------------------------------------------------------------- type fitting
// Step the font down until the string clears maxW. Returns the size it settled on.
function fitText(ctx, text, maxW, weight, family, start, min = 8) {
  let size = start;
  for (;;) {
    ctx.font = `${weight} ${size}px ${family}`;
    if (size <= min || ctx.measureText(text).width <= maxW) return size;
    size -= 2;
  }
}

// Last resort once the type is as small as we'll allow: lop the tail off.
function clipText(ctx, text, maxW) {
  let s = String(text);
  if (ctx.measureText(s).width <= maxW) return s;
  while (s.length > 2 && ctx.measureText(`${s}…`).width > maxW) s = s.slice(0, -1);
  return `${s}…`;
}

function wrapLines(ctx, text, maxW, maxLines = 4) {
  const words = String(text).split(/\s+/).filter(Boolean);
  const out = [];
  let line = '';
  for (const w of words) {
    const t = line ? `${line} ${w}` : w;
    if (line && ctx.measureText(t).width > maxW) { out.push(line); line = w; } else line = t;
    if (out.length >= maxLines) break;
  }
  if (line && out.length < maxLines) out.push(line);
  return out;
}

// Fake neon: fat translucent strokes stacked under a hot core. glow 0 = tube is dead.
function neonText(ctx, text, x, y, color, core = '#fff6e2', glow = 1) {
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  for (let i = 5; i >= 1; i--) {
    ctx.globalAlpha = glow * 0.09 * (i / 5);
    ctx.strokeStyle = color;
    ctx.lineWidth = i * 4.5;
    ctx.strokeText(text, x, y);
  }
  ctx.globalAlpha = 1;
  const dead = deadTube(color);
  ctx.strokeStyle = glow > 0.4 ? color : dead;
  ctx.lineWidth = 3;
  ctx.strokeText(text, x, y);
  ctx.fillStyle = glow > 0.4 ? core : shade(dead, 16);
  ctx.fillText(text, x, y);
}

// ---------------------------------------------------------------- floor coverings
export function carpetCanvas(base = '#6d1f2c', accent = '#c8a24c') {
  const S = 256, cv = mkCanvas(S, S), ctx = cv.getContext('2d');
  flood(ctx, base, S, S);
  for (let y = 0; y < S; y += 4) { // loom weave — 4/8 divide 256, so the rows meet at the seam
    ctx.fillStyle = shade(base, y % 8 ? 8 : -10);
    ctx.globalAlpha = 0.34;
    ctx.fillRect(0, y, S, 1.6);
  }
  ctx.globalAlpha = 1;
  const g = 64, lattice = mix(base, accent, 0.42);
  for (let r = -1; r <= S / g; r++) {
    for (let c = -1; c <= S / g; c++) {
      const cx = c * g + (r % 2 ? g / 2 : 0), cy = r * g;
      ctx.globalAlpha = 0.62;
      ctx.strokeStyle = lattice;
      ctx.lineWidth = 3;
      diamond(ctx, cx, cy, g * 0.5, g * 0.5);
      ctx.stroke();
      ctx.globalAlpha = 0.26;
      ctx.lineWidth = 2;
      diamond(ctx, cx, cy, g * 0.34, g * 0.34);
      ctx.stroke();
      ctx.globalAlpha = 1;
      fleur(ctx, cx, cy, g * 0.25, accent, 0.7);
    }
  }
  // panel rules straddling the seam, so the runner reads as one long piece
  ctx.fillStyle = shade(base, -28);
  ctx.globalAlpha = 0.3;
  wrap(ctx, S, () => { ctx.fillRect(0, -3, S, 6); ctx.fillRect(-3, 0, 6, S); });
  ctx.fillStyle = accent;
  ctx.globalAlpha = 0.2;
  wrap(ctx, S, () => { ctx.fillRect(0, -5, S, 1.2); ctx.fillRect(0, 3.8, S, 1.2); });
  ctx.globalAlpha = 1;
  speckle(ctx, 0, 0, S, S, 2400, [shade(base, -44), shade(base, 34), accent], 0.7, 1.8);
  return cv;
}

export function roomCarpetCanvas(base = '#7a6a55') {
  const S = 256, cv = mkCanvas(S, S), ctx = cv.getContext('2d');
  flood(ctx, base, S, S);
  for (let y = 0; y < S; y += 4) { // cut-pile rows
    ctx.fillStyle = shade(base, y % 8 ? 6 : -8);
    ctx.globalAlpha = 0.4;
    ctx.fillRect(0, y, S, 2);
  }
  ctx.globalAlpha = 1;
  for (let i = 0; i < 18; i++) { // traffic wear, so the floor isn't a flat swatch
    const x = Math.random() * S, y = Math.random() * S;
    const rx = 16 + Math.random() * 38, ry = 12 + Math.random() * 28, rot = Math.random() * Math.PI;
    ctx.fillStyle = Math.random() < 0.5 ? shade(base, -14) : shade(base, 11);
    ctx.globalAlpha = 0.16;
    wrap(ctx, S, () => { ctx.beginPath(); ctx.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2); ctx.fill(); });
  }
  const g = 32, dot = shade(base, -30);
  for (let r = 0; r <= S / g; r++) {
    for (let c = 0; c <= S / g; c++) {
      const cx = c * g + (r % 2 ? g / 2 : 0), cy = r * g;
      ctx.globalAlpha = 0.45;
      ctx.strokeStyle = dot;
      ctx.lineWidth = 1.4;
      diamond(ctx, cx, cy, 6, 6);
      ctx.stroke();
      ctx.globalAlpha = 0.3;
      ctx.fillStyle = shade(base, 22);
      ctx.fillRect(cx - 1, cy - 1, 2, 2);
    }
  }
  ctx.globalAlpha = 1;
  speckle(ctx, 0, 0, S, S, 3200, [shade(base, -38), shade(base, 30), shade(base, -12)], 0.7, 1.9);
  return cv;
}

// ---------------------------------------------------------------- walls
export function wallpaperCanvas(base = '#cdbb96', accent = '#8c7850') {
  const S = 256, cv = mkCanvas(S, S), ctx = cv.getContext('2d');
  flood(ctx, base, S, S);
  for (let x = 0; x < S; x += 32) { // 32px stripe period divides 256 exactly
    ctx.fillStyle = shade(base, 10);
    ctx.fillRect(x, 0, 16, S);
    ctx.fillStyle = shade(base, -14);
    ctx.fillRect(x + 15, 0, 2, S);
    ctx.fillStyle = shade(base, 18);
    ctx.fillRect(x + 30, 0, 1, S);
  }
  const rail = 194;
  let row = 0;
  for (let y = -20; y < rail - 12; y += 40, row++) { // damask dots on the wide stripes
    // start one step early and end one late, so motifs overhanging either edge
    // are drawn on both sides and the horizontal repeat is clean
    for (let x = (row % 2 ? 24 : 8) - 32; x <= S + 32; x += 32) {
      fleur(ctx, x, y, 8.5, accent, 0.5);
      ctx.strokeStyle = accent;
      ctx.globalAlpha = 0.3;
      ctx.lineWidth = 1.2;
      diamond(ctx, x, y, 13, 16);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
  }
  chairRail(ctx, S, rail, base, accent);
  speckle(ctx, 0, 0, S, S, 1100, [shade(base, -26), shade(base, 22)], 0.7, 1.6);
  return cv;
}

// Moulding, then flat wainscot with beads, then the baseboard along the bottom.
function chairRail(ctx, S, y, base, accent) {
  ctx.fillStyle = shade(base, -30);
  ctx.fillRect(0, y + 12, S, S - y - 12);
  for (let x = 0; x < S; x += 32) {
    ctx.fillStyle = shade(base, -44);
    ctx.fillRect(x + 15, y + 12, 2, S - y - 12);
    ctx.fillStyle = shade(base, -18);
    ctx.fillRect(x + 17, y + 12, 1.5, S - y - 12);
  }
  ctx.fillStyle = mix(accent, '#000000', 0.4);
  ctx.fillRect(0, y, S, 12);
  ctx.fillStyle = mix(accent, '#ffffff', 0.35);
  ctx.fillRect(0, y + 1.5, S, 3);
  ctx.fillStyle = mix(accent, '#000000', 0.6);
  ctx.fillRect(0, y + 10, S, 2.5);
  ctx.fillStyle = mix(base, '#ffffff', 0.55);
  ctx.fillRect(0, S - 14, S, 14);
  ctx.fillStyle = shade(base, -52);
  ctx.fillRect(0, S - 14, S, 2);
}

export function stuccoCanvas(base = '#ded3bc') {
  const S = 256, cv = mkCanvas(S, S), ctx = cv.getContext('2d');
  flood(ctx, base, S, S);
  for (let i = 0; i < 20; i++) { // broad float marks the light will catch
    const x = Math.random() * S, y = Math.random() * S;
    const rx = 24 + Math.random() * 44, ry = 16 + Math.random() * 30, rot = Math.random() * Math.PI;
    ctx.fillStyle = Math.random() < 0.5 ? shade(base, 13) : shade(base, -15);
    ctx.globalAlpha = 0.3;
    wrap(ctx, S, () => { ctx.beginPath(); ctx.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2); ctx.fill(); });
  }
  ctx.lineCap = 'round';
  for (let i = 0; i < 190; i++) { // trowel arcs, rolled up front so the copies match
    const x = Math.random() * S, y = Math.random() * S;
    const r = 7 + Math.random() * 20, a0 = Math.random() * Math.PI * 2;
    const up = Math.random() < 0.5;
    ctx.strokeStyle = up ? shade(base, 26) : shade(base, -30);
    ctx.globalAlpha = up ? 0.26 : 0.2;
    ctx.lineWidth = 2 + Math.random() * 4;
    wrap(ctx, S, () => { ctx.beginPath(); ctx.arc(x, y, r, a0, a0 + 1.7 + Math.PI * 0.2); ctx.stroke(); });
  }
  ctx.globalAlpha = 1;
  for (let i = 0; i < 60; i++) { // pinholes in the render
    const x = Math.random() * S, y = Math.random() * S, r = 1 + Math.random() * 2.2;
    ctx.fillStyle = shade(base, -52);
    ctx.globalAlpha = 0.34;
    wrap(ctx, S, () => { ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); });
  }
  ctx.globalAlpha = 1;
  speckle(ctx, 0, 0, S, S, 3000, [shade(base, -44), '#ffffff', shade(base, -18)], 0.7, 1.8);
  return cv;
}

export function brickCanvas(base = '#a35a3e') {
  const S = 256, cv = mkCanvas(S, S), ctx = cv.getContext('2d');
  flood(ctx, shade(base, -36), S, S); // mortar
  const gap = 3, px = 64, py = 16, bw = px - gap, bh = 13; // periods divide 256 evenly
  for (let row = -1; row <= S / py; row++) {
    const rk = ((row % (S / py)) + S / py) % (S / py);
    for (let col = -1; col <= S / px; col++) {
      const ck = ((col % (S / px)) + S / px) % (S / px);
      const x = col * px + (row % 2 ? -px / 2 : 0), y = row * py;
      ctx.fillStyle = shade(base, (hash2(ck, rk) - 0.5) * 30);
      ctx.fillRect(x, y, bw, bh);
      ctx.fillStyle = 'rgba(255,255,255,0.10)'; // sun on the top arris
      ctx.fillRect(x, y, bw, 1.5);
      ctx.fillStyle = 'rgba(0,0,0,0.16)';
      ctx.fillRect(x, y + bh - 1.5, bw, 1.5);
    }
  }
  speckle(ctx, 0, 0, S, S, 900, ['#000000', '#ffffff', shade(base, 40)], 0.7, 1.6);
  return cv;
}

export function tileCanvas(a = '#e9e6dd', b = '#c8d6d4') {
  const S = 128, cv = mkCanvas(S, S), ctx = cv.getContext('2d');
  const n = 4, t = S / n;
  flood(ctx, shade(mix(a, b, 0.5), -54), S, S); // grout
  for (let row = 0; row < n; row++) {
    for (let col = 0; col < n; col++) {
      const x = col * t + 1.5, y = row * t + 1.5, w = t - 3;
      ctx.fillStyle = shade((row + col) % 2 ? b : a, (hash2(col, row) - 0.5) * 14);
      ctx.fillRect(x, y, w, w);
      ctx.fillStyle = 'rgba(255,255,255,0.30)'; // glazed bevel
      ctx.fillRect(x, y, w, 2);
      ctx.fillRect(x, y, 2, w);
      ctx.fillStyle = 'rgba(0,0,0,0.16)';
      ctx.fillRect(x, y + w - 2, w, 2);
      ctx.fillRect(x + w - 2, y, 2, w);
    }
  }
  speckle(ctx, 0, 0, S, S, 420, [shade(a, -34), '#ffffff'], 0.6, 1.3);
  return cv;
}

// ---------------------------------------------------------------- outside
export function asphaltCanvas(base = '#3c3d42') {
  const S = 256, cv = mkCanvas(S, S), ctx = cv.getContext('2d');
  flood(ctx, base, S, S);
  for (let i = 0; i < 16; i++) { // patched-over repairs, kept broad and faint
    const x = Math.random() * S, y = Math.random() * S;
    const rx = 34 + Math.random() * 56, ry = 24 + Math.random() * 40, rot = Math.random() * Math.PI;
    ctx.fillStyle = Math.random() < 0.5 ? shade(base, -12) : shade(base, 9);
    ctx.globalAlpha = 0.14;
    wrap(ctx, S, () => { ctx.beginPath(); ctx.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2); ctx.fill(); });
  }
  ctx.globalAlpha = 1;
  for (let i = 0; i < 260; i++) { // exposed aggregate
    const x = Math.random() * S, y = Math.random() * S, r = 0.7 + Math.random() * 1.6;
    ctx.fillStyle = ['#6f717a', '#8b8d93', '#1b1c20'][(Math.random() * 3) | 0];
    ctx.globalAlpha = 0.3 + Math.random() * 0.4;
    wrap(ctx, S, () => { ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); });
  }
  ctx.globalAlpha = 1;
  speckle(ctx, 0, 0, S, S, 2200, ['#15161a', '#787a82', '#54565e'], 0.7, 1.7);
  return cv;
}

export function grassCanvas(base = '#3d7038') {
  const S = 256, cv = mkCanvas(S, S), ctx = cv.getContext('2d');
  flood(ctx, base, S, S);
  for (let i = 0; i < 34; i++) { // dry and lush patches, stretched so they read as mow
    const x = Math.random() * S, y = Math.random() * S;
    const rx = 16 + Math.random() * 44, ry = 8 + Math.random() * 20, rot = Math.random() * Math.PI;
    ctx.fillStyle = Math.random() < 0.45 ? shade(base, 18) : mix(base, '#9d8f4a', 0.3);
    ctx.globalAlpha = 0.12;
    wrap(ctx, S, () => { ctx.beginPath(); ctx.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2); ctx.fill(); });
  }
  ctx.globalAlpha = 1;
  ctx.lineWidth = 1;
  for (let i = 0; i < 3400; i++) { // blades
    ctx.strokeStyle = Math.random() < 0.5 ? shade(base, 26) : shade(base, -26);
    ctx.globalAlpha = 0.22;
    blade(ctx, S, Math.random() * S, Math.random() * S, Math.random() * 3 - 1.5, -2 - Math.random() * 3.5);
  }
  ctx.globalAlpha = 1;
  speckle(ctx, 0, 0, S, S, 700, [shade(base, -34), '#c9c26a'], 0.7, 1.5);
  return cv;
}

export function woodCanvas(base = '#7c4f2a') {
  const S = 256, cv = mkCanvas(S, S), ctx = cv.getContext('2d');
  flood(ctx, base, S, S);
  ctx.lineCap = 'round';
  for (let i = 0; i < 130; i++) { // grain, kept clear of the top and bottom edges
    const y = 8 + Math.random() * (S - 16), amp = 1.5 + Math.random() * 3.5;
    const k = 1 + ((Math.random() * 3) | 0); // whole cycles across the tile, so it wraps
    const f = (k * Math.PI * 2) / S, ph = Math.random() * Math.PI * 2;
    ctx.strokeStyle = Math.random() < 0.35 ? shade(base, 22) : shade(base, -26);
    ctx.globalAlpha = 0.12 + Math.random() * 0.2;
    ctx.lineWidth = 0.7 + Math.random() * 2.2;
    ctx.beginPath();
    ctx.moveTo(0, y + Math.sin(ph) * amp);
    for (let x = 8; x <= S; x += 8) ctx.lineTo(x, y + Math.sin(x * f + ph) * amp);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  for (let k = 0; k < 2; k++) { // a knot or two
    const x = 40 + Math.random() * (S - 80), y = 30 + Math.random() * (S - 60);
    for (let r = 3; r < 17; r += 2.4) {
      ctx.strokeStyle = shade(base, -34);
      ctx.globalAlpha = 0.3;
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.ellipse(x, y, r, r * 0.55, 0.4, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
  ctx.globalAlpha = 1;
  ctx.fillStyle = shade(base, -50); // plank joints, one on the seam so it tiles
  wrap(ctx, S, () => { ctx.fillRect(0, -1.5, S, 3); });
  ctx.fillRect(0, S / 2 - 1.5, S, 3);
  ctx.fillStyle = shade(base, 26);
  ctx.globalAlpha = 0.5;
  ctx.fillRect(0, S / 2 + 1.5, S, 1.5);
  ctx.globalAlpha = 1;
  return cv;
}

export function marbleCanvas(base = '#efece3', vein = '#98a2ac') {
  const S = 256, cv = mkCanvas(S, S), ctx = cv.getContext('2d');
  flood(ctx, base, S, S);
  for (let i = 0; i < 26; i++) { // cloudy mottling
    const x = Math.random() * S, y = Math.random() * S;
    const rx = 20 + Math.random() * 48, ry = 12 + Math.random() * 30, rot = Math.random() * Math.PI;
    ctx.fillStyle = Math.random() < 0.5 ? shade(base, -13) : shade(base, 9);
    ctx.globalAlpha = 0.2;
    wrap(ctx, S, () => { ctx.beginPath(); ctx.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2); ctx.fill(); });
  }
  ctx.globalAlpha = 1;
  for (let v = 0; v < 7; v++) {
    const pts = [];
    // Real veining runs one dominant way. Kept shallow so a vein never travels
    // more than a tile vertically — wrap() only reaches one tile out.
    const drift = (Math.random() - 0.5) * 0.9;
    const bold = v < 2;
    let x = -40, y = Math.random() * S;
    while (x < S + 40) {
      pts.push([x, y]);
      const step = 10 + Math.random() * 16;
      x += step;
      y += drift * step + (Math.random() - 0.5) * 15;
    }
    const dy = 3 + Math.random() * 5; // rolled here, not inside wrap(), or the copies split
    ctx.lineCap = 'round';
    ctx.strokeStyle = bold ? shade(vein, -34) : vein;
    ctx.globalAlpha = bold ? 0.4 : 0.2;
    ctx.lineWidth = bold ? 1.8 + Math.random() * 1.6 : 0.6 + Math.random() * 0.7;
    wrap(ctx, S, () => { smoothPath(ctx, pts, 0); ctx.stroke(); });
    ctx.globalAlpha = bold ? 0.16 : 0.09; // hairline shadowing the main vein
    ctx.lineWidth = 0.7;
    wrap(ctx, S, () => { smoothPath(ctx, pts, dy); ctx.stroke(); });
  }
  ctx.globalAlpha = 1;
  speckle(ctx, 0, 0, S, S, 900, [shade(base, -22), '#ffffff'], 0.6, 1.4);
  return cv;
}

function smoothPath(ctx, pts, dy) {
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1] + dy);
  for (let i = 1; i < pts.length - 1; i++) {
    const mx = (pts[i][0] + pts[i + 1][0]) / 2, my = (pts[i][1] + pts[i + 1][1]) / 2 + dy;
    ctx.quadraticCurveTo(pts[i][0], pts[i][1] + dy, mx, my);
  }
}

// ---------------------------------------------------------------- room dressing
export function bedCanvas(color = '#b6c3cd', accent = '#7d2233') {
  const S = 256, cv = mkCanvas(S, S), ctx = cv.getContext('2d');
  flood(ctx, color, S, S);
  ctx.strokeStyle = shade(color, -24); // quilted diagonals
  ctx.globalAlpha = 0.45;
  ctx.lineWidth = 1;
  for (let i = -S; i < S * 2; i += 26) {
    ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i + S, S); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(i, S); ctx.lineTo(i + S, 0); ctx.stroke();
  }
  ctx.globalAlpha = 1;
  ctx.fillStyle = mix(color, '#ffffff', 0.74); // turned-down sheet at the head
  ctx.fillRect(0, 0, S, 34);
  ctx.fillStyle = shade(color, -40);
  ctx.globalAlpha = 0.45;
  ctx.fillRect(0, 34, S, 3);
  ctx.globalAlpha = 1;
  const y0 = S - 76; // runner across the foot
  ctx.fillStyle = accent;
  ctx.fillRect(0, y0, S, 62);
  ctx.fillStyle = mix(accent, '#000000', 0.4);
  ctx.fillRect(0, y0, S, 3);
  ctx.fillRect(0, y0 + 59, S, 3);
  ctx.fillStyle = mix(accent, '#ffffff', 0.4);
  for (let x = 10; x < S; x += 32) ctx.fillRect(x, y0 + 28, 14, 3);
  const g = ctx.createLinearGradient(0, 0, S, 0); // rolled edges catch shadow
  g.addColorStop(0, 'rgba(0,0,0,0.28)');
  g.addColorStop(0.16, 'rgba(0,0,0,0)');
  g.addColorStop(0.84, 'rgba(0,0,0,0)');
  g.addColorStop(1, 'rgba(0,0,0,0.28)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, S, S);
  speckle(ctx, 0, 0, S, S, 1000, [shade(color, -26), shade(color, 24)], 0.8, 1.6);
  return cv;
}

const ART_PALETTES = [
  ['#c94f3d', '#e3a13a', '#2f6d6a', '#243b5a', '#efe3c8'],
  ['#7b3f61', '#d1746a', '#e8c56b', '#3b6b78', '#f2ece0'],
  ['#2f4858', '#33658a', '#86bbd8', '#f6ae2d', '#f26419'],
  ['#4a5d3a', '#8aa06b', '#d9cfa3', '#b0552f', '#2c2a22'],
  ['#5b4b8a', '#9d86c9', '#e8d3a9', '#c26b52', '#31303a'],
];

export function artCanvas(seed = 0) {
  const W = 128, H = 160, cv = mkCanvas(W, H), ctx = cv.getContext('2d');
  const r = rng(seed);
  const gold = r() < 0.55;
  ctx.fillStyle = gold ? '#8f6d2c' : '#2a251f'; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = gold ? '#dcb968' : '#463d33'; ctx.fillRect(3, 3, W - 6, H - 6);
  ctx.fillStyle = gold ? '#6b5119' : '#171410'; ctx.fillRect(9, 9, W - 18, H - 18);
  ctx.fillStyle = ['#efe9dc', '#e7e0d1', '#dad6ca'][(r() * 3) | 0];
  ctx.fillRect(11, 11, W - 22, H - 22);
  const x = 19, y = 19, w = W - 38, h = H - 38;
  const pal = ART_PALETTES[(r() * ART_PALETTES.length) | 0];
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  ctx.fillStyle = pal[4];
  ctx.fillRect(x, y, w, h);
  const kind = (r() * 3) | 0;
  if (kind === 0) artLandscape(ctx, r, pal, x, y, w, h);
  else if (kind === 1) artAbstract(ctx, r, pal, x, y, w, h);
  else artStill(ctx, r, pal, x, y, w, h);
  ctx.restore();
  ctx.strokeStyle = 'rgba(0,0,0,0.35)'; // inner shadow under the mat
  ctx.lineWidth = 2;
  ctx.strokeRect(x - 1, y - 1, w + 2, h + 2);
  ctx.fillStyle = 'rgba(255,255,255,0.10)'; // glass
  ctx.beginPath();
  ctx.moveTo(x, y + h * 0.62);
  ctx.lineTo(x + w * 0.72, y);
  ctx.lineTo(x + w, y);
  ctx.lineTo(x, y + h);
  ctx.closePath();
  ctx.fill();
  return cv;
}

function artLandscape(ctx, r, pal, x, y, w, h) {
  const g = ctx.createLinearGradient(0, y, 0, y + h);
  g.addColorStop(0, pal[3]);
  g.addColorStop(0.55, pal[1]);
  g.addColorStop(1, pal[4]);
  ctx.fillStyle = g;
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = pal[0]; // low sun
  ctx.beginPath();
  ctx.arc(x + w * (0.25 + r() * 0.5), y + h * 0.42, 5 + r() * 8, 0, Math.PI * 2);
  ctx.fill();
  for (let i = 0; i < 3; i++) { // ridgelines, hazier further back
    const top = y + h * (0.46 + i * 0.11);
    ctx.fillStyle = mix(pal[i % 3], pal[4], 0.4 - i * 0.16);
    ctx.beginPath();
    ctx.moveTo(x, y + h);
    for (let px = x; px <= x + w; px += w / 6) ctx.lineTo(px, top + Math.sin(px * 0.09 + i * 2 + r()) * 7);
    ctx.lineTo(x + w, y + h);
    ctx.closePath();
    ctx.fill();
  }
  ctx.fillStyle = mix(pal[3], '#000000', 0.35); // foreground bank
  ctx.fillRect(x, y + h * 0.84, w, h * 0.16);
}

function artAbstract(ctx, r, pal, x, y, w, h) {
  for (let i = 0; i < 7; i++) {
    ctx.fillStyle = pal[(r() * 4) | 0];
    ctx.globalAlpha = 0.55 + r() * 0.45;
    if (r() < 0.4) {
      ctx.beginPath();
      ctx.arc(x + r() * w, y + r() * h, 6 + r() * 22, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.fillRect(x + r() * w * 0.7, y + r() * h * 0.8, 10 + r() * w * 0.5, 8 + r() * h * 0.35);
    }
  }
  ctx.globalAlpha = 1;
  ctx.lineCap = 'round';
  for (let i = 0; i < 4; i++) { // gesture strokes over the blocks
    ctx.strokeStyle = i % 2 ? pal[4] : pal[3];
    ctx.globalAlpha = 0.8;
    ctx.lineWidth = 1.5 + r() * 4;
    ctx.beginPath();
    ctx.moveTo(x + r() * w, y + r() * h);
    ctx.quadraticCurveTo(x + r() * w, y + r() * h, x + r() * w, y + r() * h);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

function artStill(ctx, r, pal, x, y, w, h) {
  const tableY = y + h * 0.68;
  ctx.fillStyle = mix(pal[3], '#000000', 0.25);
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = mix(pal[0], '#000000', 0.4); // table
  ctx.fillRect(x, tableY, w, h);
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath();
  ctx.ellipse(x + w * 0.5, tableY + 4, w * 0.3, 4, 0, 0, Math.PI * 2);
  ctx.fill();
  const cx = x + w * (0.4 + r() * 0.2), vh = h * (0.22 + r() * 0.14);
  ctx.fillStyle = pal[2]; // vase
  ctx.beginPath();
  ctx.moveTo(cx - 7, tableY - vh);
  ctx.quadraticCurveTo(cx - 18, tableY - vh * 0.4, cx - 11, tableY);
  ctx.lineTo(cx + 11, tableY);
  ctx.quadraticCurveTo(cx + 18, tableY - vh * 0.4, cx + 7, tableY - vh);
  ctx.closePath();
  ctx.fill();
  for (let i = 0; i < 4; i++) { // blooms
    ctx.fillStyle = pal[(r() * 3) | 0];
    ctx.beginPath();
    ctx.arc(cx + (r() - 0.5) * 34, tableY - vh - 4 - r() * 20, 4 + r() * 5, 0, Math.PI * 2);
    ctx.fill();
  }
  for (let i = 0; i < 3; i++) { // fruit
    ctx.fillStyle = pal[(r() * 2) | 0];
    ctx.beginPath();
    ctx.arc(x + w * (0.15 + r() * 0.7), tableY + 6 + r() * 8, 4 + r() * 4, 0, Math.PI * 2);
    ctx.fill();
  }
}

export function tvCanvas(on = false) {
  const W = 128, H = 96, cv = mkCanvas(W, H), ctx = cv.getContext('2d');
  if (!on) {
    flood(ctx, '#0d0f12', W, H);
    ctx.fillStyle = 'rgba(180,200,220,0.06)'; // dead glass catching the window
    ctx.beginPath();
    ctx.moveTo(0, H * 0.75);
    ctx.lineTo(W * 0.55, 0);
    ctx.lineTo(W * 0.82, 0);
    ctx.lineTo(0, H);
    ctx.closePath();
    ctx.fill();
    speckle(ctx, 0, 0, W, H, 260, ['#2a3038', '#05070a'], 0.6, 1.4);
    return cv;
  }
  flood(ctx, '#6a6f76', W, H);
  for (let y = 0; y < H; y++) { // noise bars: runs of grey across each scanline
    let x = 0;
    while (x < W) {
      const run = 2 + Math.random() * 14;
      const v = 40 + Math.random() * 190;
      ctx.fillStyle = `rgb(${v | 0},${(v * 0.98) | 0},${Math.min(255, v * 1.04) | 0})`;
      ctx.fillRect(x, y, run, 1);
      x += run;
    }
  }
  for (let i = 0; i < 5; i++) { // torn hold bands
    ctx.fillStyle = Math.random() < 0.5 ? 'rgba(255,255,255,0.24)' : 'rgba(0,0,0,0.3)';
    ctx.fillRect(0, Math.random() * H, W, 1 + Math.random() * 5);
  }
  ctx.fillStyle = 'rgba(0,0,0,0.22)';
  for (let y = 0; y < H; y += 2) ctx.fillRect(0, y, W, 1);
  const g = ctx.createRadialGradient(W / 2, H / 2, H * 0.2, W / 2, H / 2, H * 0.85);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(1, 'rgba(0,0,0,0.5)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  return cv;
}

// ---------------------------------------------------------------- signage
export function signCanvas(name, { face = '#f3e7cf', ink = '#8f1d2c', lit = true, sub = 'NO VACANCY' } = {}) {
  const W = 512, H = 192, cv = mkCanvas(W, H), ctx = cv.getContext('2d');
  const bg = lit ? face : shade(face, -74);
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, shade(bg, 16));
  g.addColorStop(0.5, bg);
  g.addColorStop(1, shade(bg, -24));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  speckle(ctx, 0, 0, W, H, 1200, [shade(bg, -30), shade(bg, 26)], 0.8, 2.2);
  const line = lit ? ink : shade(ink, -44);
  ctx.strokeStyle = line;
  ctx.lineWidth = 7;
  ctx.strokeRect(9, 9, W - 18, H - 18);
  ctx.lineWidth = 2;
  ctx.strokeRect(21, 21, W - 42, H - 42);
  const label = String(name || 'MOTEL').toUpperCase();
  const size = fitText(ctx, label, W - 132, '900', COND, 68, 22);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = line;
  ctx.fillText(clipText(ctx, label, W - 132), W / 2, 68);
  starburst(ctx, 44, 68, size * 0.24, line);
  starburst(ctx, W - 44, 68, size * 0.24, line);
  ctx.fillRect(72, 104, W - 144, 4);
  ctx.fillRect(72, 111, W - 144, 1.5);
  ctx.font = `700 36px ${COND}`;
  neonText(ctx, String(sub).toUpperCase(), W / 2, 146, lit ? '#e8443f' : '#6a3033', '#fff3e0', lit ? 1 : 0);
  return cv;
}

export function vacancyCanvas(lit = true, vacant = true) {
  const W = 256, H = 96, cv = mkCanvas(W, H), ctx = cv.getContext('2d');
  flood(ctx, '#141317', W, H);
  speckle(ctx, 0, 0, W, H, 500, ['#000000', '#3a3a42'], 0.7, 1.8);
  ctx.strokeStyle = lit ? '#4a4650' : '#2c2a30';
  ctx.lineWidth = 4;
  ctx.strokeRect(6, 6, W - 12, H - 12);
  const tube = vacant ? '#4fe08c' : '#ff4a63';
  ctx.strokeStyle = lit ? tube : deadTube(tube); // tube outline around the plate
  ctx.globalAlpha = lit ? 0.55 : 0.9;
  ctx.lineWidth = 2;
  ctx.strokeRect(14, 14, W - 28, H - 28);
  ctx.globalAlpha = 1;
  const text = vacant ? 'VACANCY' : 'NO VACANCY';
  fitText(ctx, text, W - 48, '900', COND, 54, 18);
  neonText(ctx, text, W / 2, H / 2 + 2, tube, '#fdfff4', lit ? 1 : 0);
  ctx.fillStyle = lit ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0)';
  ctx.fillRect(0, 0, W, H * 0.4);
  for (const x of [16, W - 16]) { // mounting bolts
    ctx.fillStyle = '#6a6a72';
    ctx.beginPath();
    ctx.arc(x, H / 2, 3, 0, Math.PI * 2);
    ctx.fill();
  }
  return cv;
}

const PLATE_METAL = [
  { hi: '#d3cec0', mid: '#8f8a7c', lo: '#4c4941' }, // tier 1: tarnished pewter
  { hi: '#f1de9f', mid: '#b8933d', lo: '#5e4915' }, // tier 2: honest brass
  { hi: '#fff5c8', mid: '#dfb63d', lo: '#7d5d10' }, // tier 3: polished gold
];

// Rolled sheet with a bevel: gradient down the face, brushing across it.
function brushedMetal(ctx, W, H, m) {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, m.hi);
  g.addColorStop(0.42, m.mid);
  g.addColorStop(0.62, shade(m.mid, 22));
  g.addColorStop(1, m.lo);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  for (let i = 0; i < 220; i++) {
    const y = Math.random() * H, x = Math.random() * W;
    ctx.strokeStyle = Math.random() < 0.5 ? m.hi : m.lo;
    ctx.globalAlpha = 0.06 + Math.random() * 0.08;
    ctx.lineWidth = 0.6 + Math.random();
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + 8 + Math.random() * 40, y + (Math.random() - 0.5) * 1.2);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.fillRect(0, 0, W, 2); ctx.fillRect(0, 0, 2, H);
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.fillRect(0, H - 2, W, 2); ctx.fillRect(W - 2, 0, 2, H);
}

function slotScrew(ctx, x, y, m) {
  ctx.fillStyle = shade(m.lo, 18);
  ctx.beginPath();
  ctx.arc(x, y, 2.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = shade(m.lo, -30);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x - 2, y); ctx.lineTo(x + 2, y);
  ctx.stroke();
}

export function doorPlateCanvas(label = '101', tier = 2) {
  const W = 96, H = 64, cv = mkCanvas(W, H), ctx = cv.getContext('2d');
  const m = PLATE_METAL[Math.max(0, Math.min(2, (tier | 0) - 1))];
  brushedMetal(ctx, W, H, m);
  ctx.strokeStyle = shade(m.lo, -14);
  ctx.lineWidth = 1;
  ctx.strokeRect(7.5, 7.5, W - 15, H - 15);
  fitText(ctx, String(label).toUpperCase(), W - 30, '700', COND, 38, 12);
  const text = clipText(ctx, String(label).toUpperCase(), W - 30);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = 'rgba(255,255,255,0.45)'; // engraved: dark cut, light lower lip
  ctx.fillText(text, W / 2, H / 2 + 2.2);
  ctx.fillStyle = shade(m.lo, -26);
  ctx.fillText(text, W / 2, H / 2 + 1);
  slotScrew(ctx, 12, H / 2, m);
  slotScrew(ctx, W - 12, H / 2, m);
  return cv;
}

export function ledCanvas(lines = []) {
  const W = 256, H = 128, cv = mkCanvas(W, H), ctx = cv.getContext('2d');
  flood(ctx, '#0b0a07', W, H);
  ctx.fillStyle = '#1b1509'; // unlit dot matrix behind everything
  for (let y = 3; y < H; y += 4) {
    for (let x = 3; x < W; x += 4) ctx.fillRect(x, y, 2, 2);
  }
  const rows = (Array.isArray(lines) ? lines : [lines]).slice(0, 5).map((s) => String(s).toUpperCase());
  const step = H / (rows.length + 1);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (let i = 0; i < rows.length; i++) {
    const y = step * (i + 1);
    fitText(ctx, rows[i], W - 22, '700', MONO, Math.min(24, step * 0.62), 8);
    const text = clipText(ctx, rows[i], W - 22);
    ctx.fillStyle = 'rgba(255,168,32,0.16)'; // bloom
    for (const d of [-2, 2]) ctx.fillText(text, W / 2 + d, y);
    ctx.fillStyle = 'rgba(255,150,20,0.22)';
    ctx.fillText(text, W / 2, y + 2);
    ctx.fillStyle = '#ffb534';
    ctx.fillText(text, W / 2, y);
  }
  ctx.fillStyle = 'rgba(0,0,0,0.3)'; // scanlines + bezel shadow
  for (let y = 0; y < H; y += 3) ctx.fillRect(0, y, W, 1);
  ctx.strokeStyle = 'rgba(0,0,0,0.65)';
  ctx.lineWidth = 6;
  ctx.strokeRect(3, 3, W - 6, H - 6);
  return cv;
}

// A disc with rays behind it — half the posters in a motel lobby are this.
function sunburst(ctx, cx, cy, r, color) {
  ctx.fillStyle = color;
  ctx.globalAlpha = 0.28;
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(a) * r * 3.2, cy + Math.sin(a) * r * 3.2);
    ctx.lineTo(cx + Math.cos(a + 0.16) * r * 3.2, cy + Math.sin(a + 0.16) * r * 3.2);
    ctx.closePath();
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
}

function waves(ctx, x0, x1, y, n, color) {
  ctx.strokeStyle = color;
  ctx.globalAlpha = 0.5;
  ctx.lineWidth = 3;
  for (let i = 0; i < n; i++) {
    ctx.beginPath();
    ctx.moveTo(x0, y + i * 9);
    for (let x = x0; x <= x1; x += 12) ctx.lineTo(x, y + i * 9 + Math.sin(x * 0.14 + i) * 3.5);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

export function posterCanvas(text = 'HEATED POOL', bg = '#1d5f70') {
  const W = 192, H = 256, cv = mkCanvas(W, H), ctx = cv.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, shade(bg, 26));
  g.addColorStop(1, shade(bg, -34));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  const ink = contrastText(bg), warm = mix(ink, '#f0b432', 0.55);
  sunburst(ctx, W / 2, 96, 38, warm);
  waves(ctx, 14, W - 14, 150, 3, ink);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const size = fitText(ctx, String(text).toUpperCase(), W - 28, '900', COND, 30, 11);
  const rows = wrapLines(ctx, String(text).toUpperCase(), W - 28, 3);
  const lh = size + 4; // leading follows the fitted size, so 3 wrapped lines still
  ctx.fillStyle = ink; // centre in the clear band between the waves and the rule
  for (let i = 0; i < rows.length; i++) ctx.fillText(rows[i], W / 2, 201 + (i - (rows.length - 1) / 2) * lh);
  ctx.fillRect(30, 228, W - 60, 2);
  ctx.font = `700 11px ${SANS}`;
  ctx.fillText('AAA APPROVED · FREE ICE', W / 2, 242);
  ctx.strokeStyle = ink;
  ctx.globalAlpha = 0.7;
  ctx.lineWidth = 3;
  ctx.strokeRect(7, 7, W - 14, H - 14);
  ctx.globalAlpha = 1;
  return cv;
}

// ---------------------------------------------------------------- sky + water
// Four stops per anchor hour: zenith, upper, lower, horizon.
const SKY_KEYS = [
  { h: 0.0, a: '#04070f', b: '#080d20', c: '#0d1530', d: '#141b38' },
  { h: 4.5, a: '#080e22', b: '#151d40', c: '#3b3459', d: '#6d4b5c' },
  { h: 6.5, a: '#2b4a86', b: '#5d7bb4', c: '#c98f74', d: '#f4c295' },
  { h: 9.0, a: '#2f6fc4', b: '#5e97d8', c: '#9cc2e8', d: '#d5e5f4' },
  { h: 13.0, a: '#1f66c8', b: '#4b8ede', c: '#8fbdec', d: '#cfe3f5' },
  { h: 17.5, a: '#2a63ad', b: '#6a87c3', c: '#c79a76', d: '#ecc189' },
  { h: 19.5, a: '#13224e', b: '#3d3663', c: '#a4543f', d: '#e2823f' },
  { h: 21.0, a: '#070c22', b: '#121a3a', c: '#31284c', d: '#5a3548' },
  { h: 24.0, a: '#04070f', b: '#080d20', c: '#0d1530', d: '#141b38' },
];

function skyAt(hour) {
  const h = (((Number(hour) || 0) % 24) + 24) % 24;
  let i = 0;
  while (i < SKY_KEYS.length - 2 && SKY_KEYS[i + 1].h <= h) i++;
  const p = SKY_KEYS[i], q = SKY_KEYS[i + 1];
  const t = (h - p.h) / (q.h - p.h);
  return { h, a: mix(p.a, q.a, t), b: mix(p.b, q.b, t), c: mix(p.c, q.c, t), d: mix(p.d, q.d, t) };
}

export function skyCanvas(hour = 12) {
  const W = 512, H = 256, cv = mkCanvas(W, H), ctx = cv.getContext('2d');
  const k = skyAt(hour);
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, k.a);
  g.addColorStop(0.42, k.b);
  g.addColorStop(0.76, k.c);
  g.addColorStop(1, k.d);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  const dark = Math.max(0, Math.min(1, 1 - luminance(k.b) * 3.4));
  if (dark > 0.02) { // the same stars every hour, just fading in
    const r = rng(20250726);
    for (let i = 0; i < 380; i++) {
      const x = r() * W, y = r() * H * 0.78, big = r() < 0.07;
      ctx.globalAlpha = dark * (0.25 + r() * 0.7) * (1 - y / (H * 0.9));
      ctx.fillStyle = r() < 0.14 ? '#ffe6bd' : '#ffffff';
      ctx.fillRect(x, y, big ? 2 : 1, big ? 2 : 1);
    }
    ctx.globalAlpha = 1;
  }
  const up = k.h > 5.6 && k.h < 19.6;
  const t = up ? (k.h - 5.6) / 14 : ((k.h + 24 - 19.6) % 24) / 10;
  const sx = t * W, sy = H * (0.86 - Math.sin(Math.max(0, Math.min(1, t)) * Math.PI) * 0.7);
  const glow = ctx.createRadialGradient(sx, sy, 2, sx, sy, up ? 96 : 48);
  glow.addColorStop(0, up ? 'rgba(255,246,214,0.95)' : 'rgba(226,232,246,0.85)');
  glow.addColorStop(0.18, up ? 'rgba(255,226,160,0.42)' : 'rgba(200,214,240,0.24)');
  glow.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(sx - 110, sy - 110, 220, 220);
  for (let i = 0; i < 9; i++) { // flat clouds stacked on the horizon
    ctx.fillStyle = mix(k.c, dark > 0.5 ? '#0a0e1c' : '#ffffff', 0.34);
    ctx.globalAlpha = 0.3;
    ctx.beginPath();
    ctx.ellipse(Math.random() * W, H * (0.7 + Math.random() * 0.26), 60 + Math.random() * 150, 4 + Math.random() * 8, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  return cv;
}

export function poolWaterCanvas(t = 0) {
  const S = 128, cv = mkCanvas(S, S), ctx = cv.getContext('2d');
  const ph = ((Number(t) || 0) % 1 + 1) % 1;
  flood(ctx, '#1f7f9c', S, S);
  ctx.strokeStyle = 'rgba(10,60,80,0.35)'; // pool tile reading through
  ctx.lineWidth = 1.5;
  for (let i = 0; i <= S; i += 32) {
    ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, S); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(S, i); ctx.stroke();
  }
  const r = rng(4242);
  ctx.lineCap = 'round';
  for (let i = 0; i < 34; i++) { // caustic cells drifting on the phase
    const px = r() * S, py = r() * S, off = r(), spin = 0.6 + r() * 0.9;
    const a = (ph + off) * Math.PI * 2;
    const x = px + Math.cos(a) * 7, y = py + Math.sin(a * spin) * 7;
    const rad = 7 + r() * 9 + Math.sin(a) * 2.5;
    const al = 0.28 + 0.22 * (0.5 + 0.5 * Math.sin(a * 2));
    ctx.strokeStyle = 'rgba(190,245,255,0.5)';
    ctx.globalAlpha = al;
    ctx.lineWidth = 1.6 + 1.6 * (0.5 + 0.5 * Math.cos(a));
    wrap(ctx, S, () => { ctx.beginPath(); ctx.arc(x, y, rad, a, a + 3.4); ctx.stroke(); });
    ctx.globalAlpha = al * 0.6;
    wrap(ctx, S, () => { ctx.beginPath(); ctx.arc(x, y, rad * 0.55, a + 2, a + 5.2); ctx.stroke(); });
  }
  ctx.globalAlpha = 1;
  ctx.strokeStyle = 'rgba(255,255,255,0.13)'; // surface ripple, 3 whole cycles wide
  ctx.lineWidth = 1.4;
  const f = (3 * Math.PI * 2) / S;
  for (let i = 0; i < 8; i++) {
    const y0 = (i * S) / 8;
    ctx.beginPath();
    for (let x = 0; x <= S; x += 8) ctx.lineTo(x, y0 + Math.sin(x * f + ph * Math.PI * 2 + i) * 3);
    ctx.stroke();
  }
  speckle(ctx, 0, 0, S, S, 500, ['#bff0ff', '#0d5a72'], 0.6, 1.5);
  return cv;
}
