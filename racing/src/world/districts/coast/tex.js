// PORT HALCYON — the coast's canvas textures, drawn once (in warm, never in
// plan): the container liveries, ship plating, the rail yard's track, the
// sheds' cladding, chain-link, and sign atlases (painted boards, lightboxes
// and neon, each with an emissive twin so they light up at night).
import { toTex } from '../../../track/textures.js';
import { makeRng } from '../../../core/util.js';

const cache = new Map();
const once = (k, fn) => { if (!cache.has(k)) cache.set(k, fn()); return cache.get(k); };
function cnv(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }

function speckle(x, x0, y0, w, h, rng, n, a = 0.18, size = 1) {
  for (let i = 0; i < n; i++) {
    x.fillStyle = rng() < 0.5 ? `rgba(255,255,255,${rng() * a})` : `rgba(0,0,0,${rng() * a})`;
    x.fillRect(x0 + rng() * w, y0 + rng() * h, size, size);
  }
}
function streaks(x, x0, y0, w, h, rng, n, rgb = '40,25,15', a = 0.25) {
  for (let i = 0; i < n; i++) {
    const sx = x0 + rng() * w, sy = y0 + rng() * h * 0.6, len = 10 + rng() * h * 0.5;
    const g = x.createLinearGradient(0, sy, 0, sy + len);
    g.addColorStop(0, `rgba(${rgb},${a * rng()})`);
    g.addColorStop(1, `rgba(${rgb},0)`);
    x.fillStyle = g;
    x.fillRect(sx, sy, 1 + rng() * 3, len);
  }
}

// ------------------------------------------------------------------ containers

// liveries: base, name, name colour, emblem (fictional lines). The last is
// plain white with grey lettering: it takes any colour from the vertices.
export const LIVERIES = [
  ['#3b7ca6', 'NORDSKY', '#eef2f5', 'star'],
  ['#8a3422', 'KAITO', '#efe9df', 'wave'],
  ['#787d81', 'PELAGIC', '#203c6a', 'ring'],
  ['#c4621f', 'HALCYON', '#fbf3e6', 'bird'],
  ['#2d5a40', 'CORVUS', '#ecefe8', 'tri'],
  ['#1f3157', 'OSTRANDER', '#e6ebf3', 'bar'],
  ['#b0892d', 'VANTERRA', '#1b1b1b', 'none'],
  ['#e9e7e1', 'TRITON', '#4a4c50', 'none'],
];
export const NEUTRAL = 7;

/** 1024² atlas: 8 livery rows × [40 ft side 640 px | 20 ft side 256 px | doors 128 px]. */
export function containerAtlas() {
  return once('containers', () => {
    const c = cnv(1024, 1024);
    const x = c.getContext('2d');
    const rng = makeRng('coast-containers');
    LIVERIES.forEach(([base, logo, lc, emb], r) => {
      const y0 = r * 128;
      const owner = (logo.slice(0, 3) + 'U').toUpperCase();
      const side = (x0, w, big) => {
        x.fillStyle = base;
        x.fillRect(x0, y0, w, 128);
        for (let k = 0; k < 4; k++) {
          x.fillStyle = rng() < 0.5 ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.08)';
          x.fillRect(x0 + rng() * w, y0 + 10 + rng() * 80, 20 + rng() * 60, 14 + rng() * 40);
        }
        // corrugation
        for (let px = x0 + 8; px < x0 + w - 8; px += 9) {
          x.fillStyle = 'rgba(255,255,255,0.12)';
          x.fillRect(px, y0, 2, 128);
          x.fillStyle = 'rgba(0,0,0,0.22)';
          x.fillRect(px + 5, y0, 2, 128);
        }
        const fs = big ? 52 : 30;
        x.font = `900 ${fs}px Arial Black, Arial, sans-serif`;
        x.textAlign = 'center';
        x.textBaseline = 'middle';
        x.fillStyle = lc;
        x.globalAlpha = 0.88;
        const cx = x0 + w / 2 + (emb !== 'none' ? fs * 0.45 : 0);
        x.fillText(logo, cx, y0 + 66, w - 70);
        const tw = Math.min(w - 70, x.measureText(logo).width);
        const ex = cx - tw / 2 - fs * 0.75, ey = y0 + 66;
        x.strokeStyle = lc;
        x.lineWidth = big ? 5 : 3;
        x.beginPath();
        if (emb === 'star') { for (let k = 0; k < 10; k++) { const a = k * Math.PI / 5 - Math.PI / 2, rr = k % 2 ? fs * 0.22 : fs * 0.5; x.lineTo(ex + Math.cos(a) * rr, ey + Math.sin(a) * rr); } x.closePath(); x.fill(); }
        if (emb === 'ring') { x.arc(ex, ey, fs * 0.42, 0, Math.PI * 2); x.stroke(); }
        if (emb === 'tri') { x.moveTo(ex, ey - fs * 0.45); x.lineTo(ex + fs * 0.45, ey + fs * 0.4); x.lineTo(ex - fs * 0.45, ey + fs * 0.4); x.closePath(); x.fill(); }
        if (emb === 'wave') { for (let k = 0; k < 3; k++) { x.moveTo(ex - fs * 0.5, ey - fs * 0.25 + k * fs * 0.25); x.bezierCurveTo(ex - fs * 0.2, ey - fs * 0.45 + k * fs * 0.25, ex + fs * 0.2, ey - fs * 0.05 + k * fs * 0.25, ex + fs * 0.5, ey - fs * 0.25 + k * fs * 0.25); } x.stroke(); }
        if (emb === 'bird') { x.moveTo(ex - fs * 0.5, ey); x.quadraticCurveTo(ex - fs * 0.2, ey - fs * 0.45, ex, ey); x.quadraticCurveTo(ex + fs * 0.2, ey - fs * 0.45, ex + fs * 0.5, ey); x.stroke(); }
        if (emb === 'bar') { x.fillRect(ex - fs * 0.5, ey - fs * 0.3, fs, fs * 0.18); x.fillRect(ex - fs * 0.5, ey + fs * 0.1, fs, fs * 0.18); }
        x.globalAlpha = 1;
        x.font = 'bold 11px Arial, sans-serif';
        x.textAlign = 'right';
        x.fillStyle = r === NEUTRAL || emb === 'none' ? '#202020' : '#e8e8e8';
        x.fillText(`${owner} ${Math.floor(100000 + rng() * 899999)} ${Math.floor(rng() * 10)}`, x0 + w - 14, y0 + 20);
        x.fillText(rng() < 0.5 ? '45G1' : '42G1', x0 + w - 14, y0 + 33);
        // weathering, rust at the bottom rail
        streaks(x, x0, y0, w, 128, rng, big ? 30 : 12, '70,40,20', 0.3);
        x.fillStyle = 'rgba(0,0,0,0.38)';
        x.fillRect(x0, y0, w, 6);
        x.fillRect(x0, y0 + 121, w, 7);
        x.fillStyle = 'rgba(0,0,0,0.3)';
        x.fillRect(x0, y0, 7, 128);
        x.fillRect(x0 + w - 7, y0, 7, 128);
        x.fillStyle = 'rgba(110,60,30,0.35)';
        x.fillRect(x0, y0 + 114, w, 7);
        speckle(x, x0, y0, w, 128, rng, w * 4, 0.16);
      };
      side(0, 640, true);
      side(640, 256, false);
      const d0 = 896;
      x.fillStyle = base;
      x.fillRect(d0, y0, 128, 128);
      for (let px = d0 + 8; px < d0 + 120; px += 6) { x.fillStyle = 'rgba(0,0,0,0.16)'; x.fillRect(px, y0, 2, 128); }
      x.fillStyle = 'rgba(0,0,0,0.6)';
      x.fillRect(d0 + 63, y0, 2, 128);
      x.fillStyle = 'rgba(200,200,195,0.75)';
      for (const bx of [22, 48, 80, 106]) { x.fillRect(d0 + bx, y0 + 6, 2, 116); x.fillRect(d0 + bx - 3, y0 + 60, 8, 4); }
      x.fillStyle = 'rgba(0,0,0,0.5)';
      for (const hy of [16, 48, 80, 110]) { x.fillRect(d0 + 7, y0 + hy, 5, 6); x.fillRect(d0 + 116, y0 + hy, 5, 6); }
      x.font = 'bold 9px Arial, sans-serif';
      x.textAlign = 'left';
      x.fillStyle = r === NEUTRAL || emb === 'none' ? '#202020' : '#e8e8e8';
      x.fillText(`${owner} ${Math.floor(100000 + rng() * 899999)}`, d0 + 70, y0 + 22);
      x.fillStyle = 'rgba(0,0,0,0.4)';
      x.fillRect(d0, y0, 128, 7);
      x.fillRect(d0, y0 + 121, 128, 7);
      x.fillRect(d0, y0, 8, 128);
      x.fillRect(d0 + 120, y0, 8, 128);
    });
    const t = toTex(c, { repeat: false });
    return t;
  });
}

/** uv rect of a livery's face: part 0 = 40 ft side, 1 = 20 ft side, 2 = doors, 3 = roof (a bit of side). */
export function contUV(row, part) {
  const v0 = 1 - (row + 1) / 8 + 0.004, v1 = 1 - row / 8 - 0.004;
  if (part === 0) return [0.004, v0, 0.621, v1];
  if (part === 1) return [0.629, v0, 0.871, v1];
  if (part === 2) return [0.879, v0, 0.996, v1];
  return [0.02, v0 + 0.03, 0.06, v1 - 0.03];
}

// ------------------------------------------------------------------ steel plate

/** Ship plating (neutral, tinted per vertex): strakes, butt welds, grime and rust runs. 16 m × 8 m. */
export function plateTexture() {
  return once('plate', () => {
    const W = 512, H = 256;
    const c = cnv(W, H), x = c.getContext('2d');
    const rng = makeRng('coast-plate');
    x.fillStyle = '#d6d6d2';
    x.fillRect(0, 0, W, H);
    for (let i = 0; i < 40; i++) {
      x.fillStyle = `rgba(${rng() < 0.5 ? '255,255,255' : '0,0,0'},${0.03 + rng() * 0.05})`;
      x.fillRect(rng() * W, rng() * H, 40 + rng() * 120, 20 + rng() * 60);
    }
    // strakes (horizontal seams) and butts (vertical seams), offset per strake
    x.fillStyle = 'rgba(0,0,0,0.28)';
    for (let y = 0; y < H; y += 64) x.fillRect(0, y, W, 2);
    for (let y = 0, k = 0; y < H; y += 64, k++) for (let px = (k % 2) * 96; px < W; px += 192) x.fillRect(px, y, 2, 64);
    // frame lines (faint, every 0.8 m)
    x.fillStyle = 'rgba(0,0,0,0.05)';
    for (let px = 0; px < W; px += 26) x.fillRect(px, 0, 1, H);
    streaks(x, 0, 0, W, H, rng, 60, '90,45,20', 0.35);
    streaks(x, 0, 0, W, H, rng, 30, '20,20,20', 0.25);
    speckle(x, 0, 0, W, H, rng, 9000, 0.12);
    return toTex(c);
  });
}

// ------------------------------------------------------------------ rail track

/** Rail track seen from above (ballast, sleepers, two rails): 3.2 m wide × 6.4 m along. */
export function trackTexture() {
  return once('track', () => {
    const W = 128, H = 256;
    const c = cnv(W, H), x = c.getContext('2d');
    const rng = makeRng('coast-track');
    x.fillStyle = '#5d5850';
    x.fillRect(0, 0, W, H);
    for (let i = 0; i < 2200; i++) {
      const v = 60 + rng() * 90;
      x.fillStyle = `rgb(${v + 6},${v},${v - 8})`;
      x.fillRect(rng() * W, rng() * H, 1 + rng() * 2.5, 1 + rng() * 2.5);
    }
    // sleepers every 0.64 m (16 px of 256 per 6.4 m... 25.6 px)
    for (let y = 4; y < H; y += 25.6) {
      x.fillStyle = '#3f3226';
      x.fillRect(14, y, W - 28, 9);
      x.fillStyle = 'rgba(0,0,0,0.3)';
      x.fillRect(14, y + 7, W - 28, 2);
    }
    // rails (1.435 m gauge on 3.2 m: centre ± 28.7 px)
    for (const rx of [64 - 29, 64 + 29]) {
      x.fillStyle = '#2b2622';
      x.fillRect(rx - 3, 0, 6, H);
      x.fillStyle = '#b8b4ae';
      x.fillRect(rx - 1.2, 0, 2.4, H);
    }
    return toTex(c);
  });
}

// ------------------------------------------------------------------ chain link

/** Chain-link fence with top rail (alpha): 3 m × 3 m tile. */
export function fenceTexture() {
  return once('fence', () => {
    const S = 128;
    const c = cnv(S, S), x = c.getContext('2d');
    x.clearRect(0, 0, S, S);
    x.strokeStyle = 'rgba(175,180,184,0.95)';
    x.lineWidth = 1.2;
    for (let k = -S; k < S * 2; k += 8) {
      x.beginPath(); x.moveTo(k, 0); x.lineTo(k + S, S); x.stroke();
      x.beginPath(); x.moveTo(k, S); x.lineTo(k + S, 0); x.stroke();
    }
    x.fillStyle = 'rgba(120,124,128,1)';
    x.fillRect(0, 0, S, 5);
    x.fillRect(0, S - 3, S, 3);
    x.fillRect(0, 0, 4, S);
    const t = toTex(c);
    return t;
  });
}

// ------------------------------------------------------------------ the beach town

/**
 * Art deco stucco (neutral, tinted per vertex): paired windows with dark
 * frames, three speed lines under each floor, some rooms lit. 12 m × 12 m
 * (three floors of 4 m).
 */
export function decoTexture() {
  return once('deco', () => {
    const S = 256;
    const c = cnv(S, S), e = cnv(S, S);
    const x = c.getContext('2d'), ex = e.getContext('2d');
    const rng = makeRng('coast-deco');
    x.fillStyle = '#f2efe8';
    x.fillRect(0, 0, S, S);
    ex.fillStyle = '#000';
    ex.fillRect(0, 0, S, S);
    const fh = S / 3;
    for (let f = 0; f < 3; f++) {
      const y0 = f * fh;
      // speed lines
      x.fillStyle = 'rgba(0,0,0,0.12)';
      for (let k = 0; k < 3; k++) x.fillRect(0, y0 + fh - 10 + k * 3, S, 1.5);
      for (let k = 0; k < 4; k++) {
        const wx = k * 64 + 10, wy = y0 + 18, ww = 44, wh = 34;
        x.fillStyle = 'rgba(0,0,0,0.25)';
        x.fillRect(wx - 3, wy - 3, ww + 6, wh + 6);
        const lit = rng() < 0.45;
        x.fillStyle = lit ? (rng() < 0.6 ? '#ffe2a8' : '#ffc8d8') : '#22303c';
        x.fillRect(wx, wy, ww, wh);
        if (lit) { ex.fillStyle = '#ffd8a0'; ex.globalAlpha = 0.5 + rng() * 0.5; ex.fillRect(wx, wy, ww, wh); ex.globalAlpha = 1; }
        // the pair's mullion and a half-drawn blind
        x.fillStyle = '#e8e4da';
        x.fillRect(wx + ww / 2 - 1.5, wy, 3, wh);
        if (rng() < 0.4) { x.fillStyle = 'rgba(240,230,210,0.7)'; x.fillRect(wx, wy, ww, wh * (0.2 + rng() * 0.4)); }
      }
    }
    speckle(x, 0, 0, S, S, rng, 3000, 0.06);
    streaks(x, 0, 0, S, S, rng, 16, '120,110,100', 0.15);
    return { map: toTex(c), emi: toTex(e) };
  });
}

// shack fronts: awning stripes, what's inside
const SHACKS = [
  ['#d8322a', 'food'], ['#2a7ab8', 'shop'], ['#2f9a5a', 'food'], ['#f2b632', 'ice'],
  ['#e85a8a', 'shop'], ['#8a4ac8', 'food'], ['#ff7a2a', 'surf'], ['#1fa8a0', 'ice'],
  ['#d8322a', 'shop'], ['#2a7ab8', 'surf'], ['#f2b632', 'food'], ['#e85a8a', 'ice'],
];

/** 1024 × 512 atlas of beach-shack fronts (4 × 3 cells, each 8 m × 4.5 m): counters, awnings, goods. */
export function shackTexture() {
  return once('shacks', () => {
    const W = 1024, H = 512, cw = 256, ch = 144;
    const c = cnv(W, H), e = cnv(W, H);
    const x = c.getContext('2d'), ex = e.getContext('2d');
    const rng = makeRng('coast-shacks');
    x.fillStyle = '#f4f0e6';
    x.fillRect(0, 0, W, H);
    ex.fillStyle = '#000';
    ex.fillRect(0, 0, W, H);
    SHACKS.forEach(([aw, kind], k) => {
      const x0 = (k % 4) * cw, y0 = Math.floor(k / 4) * ch;
      // siding
      x.fillStyle = '#f2eee4';
      x.fillRect(x0, y0, cw, ch);
      x.fillStyle = 'rgba(0,0,0,0.08)';
      for (let y = y0 + 6; y < y0 + ch; y += 9) x.fillRect(x0, y, cw, 1.5);
      // the opening: counter hatch or a shop window and door
      const ox = x0 + 20, oy = y0 + 46, ow = cw - 40, oh = kind === 'food' || kind === 'ice' ? 54 : 86;
      const inside = { food: '#ffcf8a', ice: '#ffe8f0', shop: '#fff2d8', surf: '#e8f4ff' }[kind];
      x.fillStyle = inside;
      x.fillRect(ox, oy, ow, oh);
      // goods
      if (kind === 'food') {
        x.fillStyle = '#2a2a2a'; x.fillRect(ox + 10, oy + 6, ow - 20, 18);
        x.fillStyle = '#fff';
        for (let m = 0; m < 6; m++) x.fillRect(ox + 16 + m * 32, oy + 10, 22, 3);
        x.fillStyle = '#c8b8a0'; x.fillRect(ox, oy + oh - 8, ow, 8);
      } else if (kind === 'ice') {
        for (let m = 0; m < 8; m++) { x.fillStyle = ['#ff9ac8', '#9ae0ff', '#fff0a8', '#b8ff9a', '#d8a8ff'][m % 5]; x.fillRect(ox + 8 + m * 26, oy + oh - 22, 20, 14); }
        x.fillStyle = '#e04a7a'; x.fillRect(ox + 10, oy + 6, ow - 20, 12);
      } else if (kind === 'shop') {
        for (let m = 0; m < 7; m++) { x.fillStyle = ['#ff5a5a', '#5ab0ff', '#ffe05a', '#5aff9a', '#ffffff', '#ff9a3a'][m % 6]; x.fillRect(ox + 10 + m * 29, oy + 12, 22, 30); x.fillRect(ox + 10 + m * 29, oy + 48, 22, 26); }
      } else {
        for (let m = 0; m < 6; m++) { x.fillStyle = ['#ff7a2a', '#2ab8ff', '#ffe02a', '#ff4a8a', '#7aff4a', '#ffffff'][m]; x.beginPath(); x.ellipse(ox + 22 + m * 34, oy + oh / 2, 9, oh / 2 - 6, 0, 0, Math.PI * 2); x.fill(); }
      }
      ex.fillStyle = inside;
      ex.globalAlpha = 0.85;
      ex.fillRect(ox, oy, ow, oh);
      ex.globalAlpha = 1;
      // frame, counter
      x.strokeStyle = '#3a2a1c'; x.lineWidth = 4; x.strokeRect(ox, oy, ow, oh);
      x.fillStyle = '#7a5a3a'; x.fillRect(ox - 6, oy + oh, ow + 12, 8);
      // the striped awning over it
      for (let s = 0; s < 10; s++) {
        x.fillStyle = s % 2 ? '#f8f4ea' : aw;
        x.fillRect(x0 + 8 + s * (cw - 16) / 10, y0 + 22, (cw - 16) / 10 + 1, 20);
      }
      x.fillStyle = 'rgba(0,0,0,0.25)'; x.fillRect(x0 + 8, y0 + 40, cw - 16, 3);
      for (let s = 0; s < 10; s++) { x.fillStyle = s % 2 ? '#f8f4ea' : aw; x.beginPath(); x.arc(x0 + 8 + (s + 0.5) * (cw - 16) / 10, y0 + 42, (cw - 16) / 20, 0, Math.PI); x.fill(); }
      // bulbs along the eave
      for (let s = 0; s < 12; s++) {
        const bx = x0 + 12 + s * (cw - 24) / 11;
        x.fillStyle = '#fff3c8'; x.beginPath(); x.arc(bx, y0 + 12, 3, 0, Math.PI * 2); x.fill();
        ex.fillStyle = '#ffe8a0'; ex.beginPath(); ex.arc(bx, y0 + 12, 4.5, 0, Math.PI * 2); ex.fill();
      }
      x.fillStyle = 'rgba(0,0,0,0.12)'; x.fillRect(x0, y0 + ch - 8, cw, 8);
    });
    return { map: toTex(c, { repeat: false }), emi: toTex(e, { repeat: false }) };
  });
}

/** uv of shack front k (0..11). */
export function shackUV(k) {
  const cw = 256 / 1024, ch = 144 / 512;
  const i = k % 4, j = Math.floor(k / 4);
  return [i * cw + 0.002, 1 - (j + 1) * ch + 0.002, (i + 1) * cw - 0.002, 1 - j * ch - 0.002];
}
export const SHACK_KINDS = SHACKS.map((s) => s[1]);

// ------------------------------------------------------------------ scaffolding

/** Scaffolding seen side on (alpha): standards, ledgers, braces, boards. 4 m × 4 m. */
export function scaffoldTexture() {
  return once('scaffold', () => {
    const S = 256;
    const c = cnv(S, S), x = c.getContext('2d');
    x.clearRect(0, 0, S, S);
    // boards (orange-brown) at each lift
    for (const y of [S / 2 - 6, S - 6]) {
      x.fillStyle = 'rgba(150,104,60,1)';
      x.fillRect(0, y - 5, S, 8);
      x.fillStyle = 'rgba(90,60,30,1)';
      x.fillRect(0, y + 2, S, 2);
    }
    x.fillStyle = 'rgba(180,184,186,1)';
    // standards every 2 m, ledgers every 2 m, a toe rail, a diagonal brace
    for (const px of [2, S / 2 + 2]) x.fillRect(px - 2, 0, 5, S);
    for (const py of [0, S / 2]) x.fillRect(0, py, S, 4);
    for (const py of [S / 4 + 6, S * 3 / 4 + 6]) x.fillRect(0, py, S, 3);
    x.strokeStyle = 'rgba(170,174,176,1)';
    x.lineWidth = 3;
    x.beginPath(); x.moveTo(4, S); x.lineTo(S / 2, S / 2); x.stroke();
    x.beginPath(); x.moveTo(S / 2 + 4, S / 2); x.lineTo(S, 0); x.stroke();
    return toTex(c);
  });
}

// ------------------------------------------------------------------ cladding

/**
 * Industrial cladding (neutral, tinted per vertex): profiled sheeting, a
 * band of high windows (some lit), a dado line. One tile = 12 m × 12 m.
 * Returns { map, emi }.
 */
export function cladTexture(kind = 'shed') {
  return once('clad:' + kind, () => {
    const W = 512, H = 512;
    const c = cnv(W, H), e = cnv(W, H);
    const x = c.getContext('2d'), ex = e.getContext('2d');
    const rng = makeRng('coast-clad' + kind);
    x.fillStyle = '#d8d8d4';
    x.fillRect(0, 0, W, H);
    ex.fillStyle = '#000';
    ex.fillRect(0, 0, W, H);
    // profiled sheet: ribs every 0.25 m (10.7 px)
    for (let px = 0; px < W; px += 10.67) {
      x.fillStyle = 'rgba(255,255,255,0.22)';
      x.fillRect(px, 0, 2, H);
      x.fillStyle = 'rgba(0,0,0,0.16)';
      x.fillRect(px + 5, 0, 3, H);
    }
    // sheet joints
    x.fillStyle = 'rgba(0,0,0,0.25)';
    for (let y = 0; y < H; y += 128) x.fillRect(0, y, W, 2);
    // dado (a darker band at the bottom 1.2 m: splash zone)
    x.fillStyle = 'rgba(40,40,40,0.25)';
    x.fillRect(0, H - 52, W, 52);
    // window band at 8.5–10 m (y px: 12 m = 512 → 42.7 px/m)
    const wy0 = H - Math.round(10.2 * 42.67), wy1 = H - Math.round(8.4 * 42.67);
    const n = kind === 'hall' ? 8 : 6;
    for (let k = 0; k < n; k++) {
      const w = W / n;
      const x0 = k * w + 6, x1 = (k + 1) * w - 6;
      const lit = rng() < (kind === 'hall' ? 0.75 : 0.45);
      x.fillStyle = lit ? '#e8d9a8' : '#28323a';
      x.fillRect(x0, wy0, x1 - x0, wy1 - wy0);
      x.fillStyle = 'rgba(0,0,0,0.5)';
      for (let m = x0; m < x1; m += 18) x.fillRect(m, wy0, 2, wy1 - wy0);
      x.fillRect(x0, wy0 + (wy1 - wy0) / 2, x1 - x0, 2);
      if (lit) {
        ex.fillStyle = kind === 'hall' ? '#ffe2a8' : '#ffd890';
        ex.globalAlpha = 0.55 + rng() * 0.45;
        ex.fillRect(x0, wy0, x1 - x0, wy1 - wy0);
        ex.globalAlpha = 1;
      }
    }
    streaks(x, 0, 0, W, H, rng, 70, '60,40,25', 0.3);
    speckle(x, 0, 0, W, H, rng, 6000, 0.1);
    return { map: toTex(c), emi: toTex(e) };
  });
}

// ------------------------------------------------------------------ signs

/**
 * A sign atlas: each spec { id, w, h (px), text, sub?, style: 'neon'|'box'|
 * 'paint'|'letters', bg, fg, glow?, font? } drawn into a W×H canvas (shelf
 * packed) with an emissive twin. → { map, emi, uv: { id: [u0, v0, u1, v1] } }.
 */
export function signAtlas(key, specs0, W = 1024, H = 1024, scale = 1) {
  return once('signs:' + key, () => {
    const specs = scale === 1 ? specs0 : specs0.map((s) => ({ ...s, w: Math.round(s.w * scale), h: Math.round(s.h * scale) }));
    const c = cnv(W, H), e = cnv(W, H);
    const x = c.getContext('2d'), ex = e.getContext('2d');
    x.fillStyle = '#202020';
    x.fillRect(0, 0, W, H);
    ex.fillStyle = '#000';
    ex.fillRect(0, 0, W, H);
    const rng = makeRng('signs' + key);
    const uv = {};
    const order = [...specs].sort((a, b) => b.h - a.h);
    let sx = 0, sy = 0, shelf = 0;
    for (const s of order) {
      if (sx + s.w > W) { sx = 0; sy += shelf + 2; shelf = 0; }
      const x0 = sx, y0 = sy;
      sx += s.w + 2;
      shelf = Math.max(shelf, s.h);
      if (y0 + s.h > H) { console.warn('sign atlas full', key, s.id); continue; }
      uv[s.id] = [(x0 + 1) / W, 1 - (y0 + s.h - 1) / H, (x0 + s.w - 1) / W, 1 - (y0 + 1) / H];
      drawSign(x, ex, x0, y0, s, rng);
    }
    return { map: toTex(c, { repeat: false }), emi: toTex(e, { repeat: false }), uv };
  });
}

function fitFont(x, text, font, size, maxW) {
  let fs = size;
  x.font = `${font.replace('$', fs)}`;
  while (fs > 8 && x.measureText(text).width > maxW) { fs -= 2; x.font = `${font.replace('$', fs)}`; }
  return fs;
}

function drawSign(x, ex, x0, y0, s, rng) {
  const { w, h } = s;
  const font = s.font || '900 $px Arial Black, Arial, sans-serif';
  const cx = x0 + w / 2;
  const lines = s.sub ? [[s.text, h * 0.5, h * 0.42], [s.sub, h * 0.82, h * 0.2]] : [[s.text, h * 0.56, h * 0.62]];
  x.save(); ex.save();
  x.beginPath(); x.rect(x0, y0, w, h); x.clip();
  ex.beginPath(); ex.rect(x0, y0, w, h); ex.clip();
  x.textAlign = ex.textAlign = 'center';
  x.textBaseline = ex.textBaseline = 'middle';
  if (s.style === 'custom') {
    s.draw(x, ex, x0, y0, w, h, rng);
  } else if (s.style === 'neon') {
    x.fillStyle = s.bg || '#15121a';
    x.fillRect(x0, y0, w, h);
    x.strokeStyle = 'rgba(255,255,255,0.08)';
    x.lineWidth = 2;
    x.strokeRect(x0 + 3, y0 + 3, w - 6, h - 6);
    for (const [t, ly, size] of lines) {
      const col = t === s.sub && s.glow2 ? s.glow2 : s.glow || s.fg || '#ff3a8a';
      const fs = fitFont(x, t, font, Math.round(size), w * 0.9);
      ex.font = x.font;
      // the tube: a pale core, the colour round it
      x.lineWidth = Math.max(2, fs * 0.09);
      x.strokeStyle = col;
      x.strokeText(t, cx, y0 + ly);
      x.lineWidth = Math.max(1, fs * 0.03);
      x.strokeStyle = 'rgba(255,255,255,0.7)';
      x.strokeText(t, cx, y0 + ly);
      ex.shadowColor = col;
      ex.shadowBlur = Math.max(6, fs * 0.35);
      ex.lineWidth = Math.max(3, fs * 0.12);
      ex.strokeStyle = col;
      ex.strokeText(t, cx, y0 + ly);
      ex.shadowBlur = 0;
      ex.lineWidth = Math.max(1, fs * 0.04);
      ex.strokeStyle = '#ffffff';
      ex.strokeText(t, cx, y0 + ly);
    }
    if (s.border) {
      x.strokeStyle = s.border; x.lineWidth = 4; x.strokeRect(x0 + 8, y0 + 8, w - 16, h - 16);
      ex.shadowColor = s.border; ex.shadowBlur = 10; ex.strokeStyle = s.border; ex.lineWidth = 5; ex.strokeRect(x0 + 8, y0 + 8, w - 16, h - 16); ex.shadowBlur = 0;
    }
  } else if (s.style === 'box' || s.style === 'paint' || s.style === 'letters') {
    if (s.style !== 'letters' || s.bg) {
      x.fillStyle = s.bg || '#f2efe6';
      x.fillRect(x0, y0, w, h);
    }
    if (s.style === 'box' || s.style === 'paint') {
      x.strokeStyle = 'rgba(0,0,0,0.35)';
      x.lineWidth = 3;
      x.strokeRect(x0 + 2, y0 + 2, w - 4, h - 4);
    }
    const fonts = [];
    for (const [t, ly, size] of lines) {
      fitFont(x, t, font, Math.round(size), w * 0.9);
      fonts.push(x.font);
      x.fillStyle = s.fg || '#151515';
      x.fillText(t, cx, y0 + ly);
    }
    if (s.style === 'box') {
      // backlit: the panel glows, the letters (opaque film) less
      ex.fillStyle = s.glow || s.bg || '#ffffff';
      ex.globalAlpha = 0.8;
      ex.fillRect(x0, y0, w, h);
      ex.globalAlpha = 1;
      lines.forEach(([t, ly], k) => { ex.font = fonts[k]; ex.fillStyle = s.fgGlow || 'rgba(0,0,0,0.85)'; ex.fillText(t, cx, y0 + ly); });
    } else if (s.style === 'letters' && s.glow) {
      // lit letters (floodlit / backlit channel letters)
      lines.forEach(([t, ly], k) => { ex.font = fonts[k]; ex.fillStyle = s.glow; ex.fillText(t, cx, y0 + ly); });
    }
    if (s.style === 'paint') {
      streaks(x, x0, y0, w, h, rng, Math.round(w / 12), '50,30,20', 0.25);
      speckle(x, x0, y0, w, h, rng, w * h / 60, 0.12);
    }
  }
  x.restore(); ex.restore();
}

// ------------------------------------------------------------------ facades

/** Window grid helper: draws a window and (if lit) its glow. */
function win(x, ex, wx, wy, ww, wh, lit, rng, warm = '#f2d49a', cool = '#cfe0f4', dark = null) {
  const isWarm = rng() < 0.7;
  x.fillStyle = lit ? (isWarm ? warm : cool) : (dark || `rgb(${20 + rng() * 18},${26 + rng() * 18},${36 + rng() * 22})`);
  x.fillRect(wx, wy, ww, wh);
  if (lit) {
    ex.fillStyle = isWarm ? '#ffcf8a' : '#a8c8ff';
    ex.globalAlpha = 0.45 + rng() * 0.55;
    ex.fillRect(wx, wy, ww, wh);
    ex.globalAlpha = 1;
    if (rng() < 0.35) { x.fillStyle = 'rgba(0,0,0,0.3)'; x.fillRect(wx, wy, ww, wh * 0.35); }
  }
}

/** A ship's (or a tug's) white accommodation block: rows of windows. 10 m × 10 m (4 decks). */
export function deckhouseTexture() {
  return once('deckhouse', () => {
    const S = 256;
    const c = cnv(S, S), e = cnv(S, S);
    const x = c.getContext('2d'), ex = e.getContext('2d');
    const rng = makeRng('coast-deckhouse');
    x.fillStyle = '#e4e2da';
    x.fillRect(0, 0, S, S);
    ex.fillStyle = '#000';
    ex.fillRect(0, 0, S, S);
    for (let r = 0; r < 4; r++) {
      const y = r * 64;
      x.fillStyle = 'rgba(0,0,0,0.16)';
      x.fillRect(0, y + 60, S, 4);
      for (let k = 0; k < 7; k++) win(x, ex, 12 + k * 35, y + 22, 20, 18, rng() < 0.5, rng, '#f4e2b0');
    }
    streaks(x, 0, 0, S, S, rng, 30, '90,60,40', 0.25);
    speckle(x, 0, 0, S, S, rng, 3000, 0.08);
    return { map: toTex(c), emi: toTex(e) };
  });
}

/** A 1970s port office: white concrete spandrels, ribbon windows. 16 m × 16 m (4 floors of 4 m). */
export function officeTexture() {
  return once('office', () => {
    const S = 256;
    const c = cnv(S, S), e = cnv(S, S);
    const x = c.getContext('2d'), ex = e.getContext('2d');
    const rng = makeRng('coast-office');
    x.fillStyle = '#d8d6ce';
    x.fillRect(0, 0, S, S);
    ex.fillStyle = '#000';
    ex.fillRect(0, 0, S, S);
    for (let f = 0; f < 4; f++) {
      const y0 = f * 64 + 26, h = 34;
      const floorLit = rng() < 0.55;
      for (let k = 0; k < 8; k++) {
        const lit = floorLit ? rng() < 0.8 : rng() < 0.12;
        win(x, ex, k * 32 + 1, y0, 30, h, lit, rng, '#f0e2c0', '#d8e8ff', '#1d2a38');
      }
      x.fillStyle = '#5a5e62';
      for (let k = 0; k <= 8; k++) x.fillRect(k * 32 - 1, y0, 3, h);
      x.fillStyle = 'rgba(0,0,0,0.18)';
      x.fillRect(0, y0 + h, S, 3);
    }
    streaks(x, 0, 0, S, S, rng, 40, '60,55,50', 0.25);
    return { map: toTex(c), emi: toTex(e) };
  });
}

/** Old bonded warehouse brick: two floors of tall arched windows. 12 m × 9 m. */
export function brickTexture() {
  return once('brick', () => {
    const W = 512, H = 384;
    const c = cnv(W, H), e = cnv(W, H);
    const x = c.getContext('2d'), ex = e.getContext('2d');
    const rng = makeRng('coast-brick');
    x.fillStyle = '#7a3b2a';
    x.fillRect(0, 0, W, H);
    ex.fillStyle = '#000';
    ex.fillRect(0, 0, W, H);
    // courses
    for (let y = 0; y < H; y += 6) {
      for (let px = (y / 6) % 2 ? -7 : 0; px < W; px += 14) {
        const t = rng();
        x.fillStyle = `rgba(${t < 0.5 ? '40,15,8' : '160,90,60'},${0.1 + rng() * 0.18})`;
        x.fillRect(px + 1, y + 1, 12, 4);
      }
    }
    x.fillStyle = 'rgba(30,14,8,0.4)';
    for (let y = 0; y < H; y += 6) x.fillRect(0, y, W, 1);
    // two floors (4.5 m = 192 px), four bays (3 m = 128 px)
    for (let f = 0; f < 2; f++) {
      const y0 = f * 192;
      x.fillStyle = '#b8a890';
      x.fillRect(0, y0 + 186, W, 6);
      for (let k = 0; k < 4; k++) {
        const wx = k * 128 + 34, ww = 60, wy = y0 + 40, wh = 110;
        x.fillStyle = '#c8b8a0';
        x.beginPath(); x.arc(wx + ww / 2, wy + 4, ww / 2 + 6, Math.PI, 0); x.fill();
        const lit = rng() < (f === 0 ? 0.3 : 0.18);
        x.fillStyle = lit ? '#e8c27a' : '#1e2428';
        x.beginPath(); x.arc(wx + ww / 2, wy + 4, ww / 2, Math.PI, 0); x.fill();
        x.fillRect(wx, wy + 4, ww, wh);
        if (lit) { ex.fillStyle = '#ffbf70'; ex.globalAlpha = 0.6; ex.fillRect(wx, wy - 26, ww, wh + 30); ex.globalAlpha = 1; }
        x.fillStyle = 'rgba(30,30,30,0.85)';
        for (let m = 1; m < 3; m++) x.fillRect(wx + m * ww / 3, wy - 26, 2, wh + 30);
        for (let m = 1; m < 5; m++) x.fillRect(wx, wy + m * wh / 5, ww, 2);
        x.fillStyle = '#c8b8a0';
        x.fillRect(wx - 4, wy + wh + 2, ww + 8, 8);
      }
    }
    streaks(x, 0, 0, W, H, rng, 80, '20,10,5', 0.3);
    speckle(x, 0, 0, W, H, rng, 9000, 0.12);
    return { map: toTex(c), emi: toTex(e) };
  });
}
