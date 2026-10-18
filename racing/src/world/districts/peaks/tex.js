// PORT HALCYON — the mountains' canvas textures, drawn once (in warm()) and
// shared by the four packs: Kaido's lattice-framed cut slopes, its sign
// atlas, vending machines, tea house walls, roof tiles and granite; the
// American-style sign atlas of the Summit, the Ridgeline and the Woods (with
// the lodge's and the radio station's lit signs); the lodge's timber walls;
// rock and snow faces; log cabin walls, log cribbing and corrugated iron;
// falling water.
import { toTex } from '../../../track/textures.js';
import { makeRng } from '../../../core/util.js';

const cache = new Map();
function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}
/** Cached texture: draw(ctx, w, h, rng) on a w × h canvas. */
function tex(key, w, h, draw, opts = {}) {
  if (!cache.has(key)) {
    const c = canvas(w, h);
    const x = c.getContext('2d');
    draw(x, w, h, makeRng('peaks:' + key));
    cache.set(key, toTex(c, opts));
  }
  return cache.get(key);
}

function speckle(x, w, h, rng, n, light, dark, size = 1.5, a = 0.3) {
  for (let i = 0; i < n; i++) {
    x.fillStyle = rng() < 0.5 ? `rgba(${light},${rng() * a})` : `rgba(${dark},${rng() * a})`;
    const r = size * (0.5 + rng());
    x.fillRect(rng() * w, rng() * h, r, r);
  }
}
function blot(x, rng, w, h, n, color, r0, r1, a) {
  for (let i = 0; i < n; i++) {
    const px = rng() * w, py = rng() * h, r = r0 + rng() * (r1 - r0);
    for (const dx of [-w, 0, w]) for (const dy of [-h, 0, h]) {
      const g = x.createRadialGradient(px + dx, py + dy, 0, px + dx, py + dy, r);
      g.addColorStop(0, `rgba(${color},${a})`);
      g.addColorStop(1, `rgba(${color},0)`);
      x.fillStyle = g;
      x.fillRect(px + dx - r, py + dy - r, r * 2, r * 2);
    }
  }
}

// ------------------------------------------------------------------ Kaido

/** Lattice-frame slope protection (法枠): a concrete grid holding scrub, 4 m a tile. */
export const latticeTex = () => tex('lattice', 256, 256, (x, w, h, rng) => {
  x.fillStyle = '#3a4528';
  x.fillRect(0, 0, w, h);
  blot(x, rng, w, h, 34, '96,104,52', 6, 22, 0.5);
  blot(x, rng, w, h, 26, '34,28,18', 6, 18, 0.5);
  speckle(x, w, h, rng, 7000, '170,180,110', '12,14,8', 2, 0.35);
  const bw = 22;
  for (const c of [0, 128]) {
    for (const d of [-w, 0, w]) {
      x.fillStyle = 'rgba(0,0,0,0.42)';
      x.fillRect(0, c - bw / 2 - 8 + d * 0, w, 8);
      x.fillRect(c + bw / 2 + d, 0, 6, h);
    }
  }
  for (const c of [0, 128]) {
    for (const d of [-w, 0, w]) {
      x.fillStyle = '#aaa79c';
      x.fillRect(0, c - bw / 2, w, bw);
      x.fillRect(c - bw / 2 + d, 0, bw, h);
    }
  }
  for (const cx of [0, 128, 256]) for (const cy of [0, 128, 256]) { x.fillStyle = '#b8b5aa'; x.fillRect(cx - 15, cy - 15, 30, 30); }
  // rust weep from the anchor heads, grime
  for (const cx of [0, 128, 256]) for (const cy of [0, 128, 256]) {
    const g = x.createLinearGradient(0, cy, 0, cy + 60);
    g.addColorStop(0, 'rgba(90,60,30,0.45)'); g.addColorStop(1, 'rgba(90,60,30,0)');
    x.fillStyle = g; x.fillRect(cx - 3, cy, 6, 60);
    x.fillStyle = '#4a4640'; x.fillRect(cx - 4, cy - 4, 8, 8);
  }
  blot(x, rng, w, h, 18, '40,36,28', 6, 26, 0.28);
  speckle(x, w, h, rng, 4000, '235,235,225', '0,0,0', 1.4, 0.25);
});

/**
 * Kaido's sign atlas, 4 × 2 cells of 256: 0 chevrons →, 1 chevrons ←,
 * 2 hairpin right, 3 hairpin left, 4 speed 40, 5 falling rocks, 6 the pass's
 * blue route board, 7 delineator reflector + plain grey back.
 */
export const kaidoSignTex = () => tex('kaidoSigns', 1024, 512, (x) => {
  const cell = (k) => [(k % 4) * 256, Math.floor(k / 4) * 256];
  for (const [k, dir] of [[0, 1], [1, -1]]) {
    const [cx, cy] = cell(k);
    x.fillStyle = '#f2c400'; x.fillRect(cx, cy, 256, 256);
    x.fillStyle = '#121212';
    const m = (p) => cx + 128 + (p - 128) * dir;
    for (const o of [-48, 48]) {
      x.beginPath();
      x.moveTo(m(66 + o), cy + 34); x.lineTo(m(140 + o), cy + 128); x.lineTo(m(66 + o), cy + 222);
      x.lineTo(m(104 + o), cy + 222); x.lineTo(m(178 + o), cy + 128); x.lineTo(m(104 + o), cy + 34);
      x.closePath(); x.fill();
    }
    x.lineWidth = 10; x.strokeRect(cx + 5, cy + 5, 246, 246);
  }
  const diamond = (k) => {
    const [cx, cy] = cell(k);
    x.save(); x.translate(cx + 128, cy + 128); x.rotate(Math.PI / 4);
    x.fillStyle = '#121212'; x.fillRect(-88, -88, 176, 176);
    x.fillStyle = '#f5c800'; x.fillRect(-80, -80, 160, 160);
    x.restore();
    x.strokeStyle = '#121212'; x.fillStyle = '#121212'; x.lineWidth = 15;
    return [cx + 128, cy + 128];
  };
  for (const [k, dir] of [[2, 1], [3, -1]]) {
    const [cx, cy] = diamond(k);
    x.beginPath();
    x.moveTo(cx - 22 * dir, cy + 62); x.lineTo(cx - 22 * dir, cy - 18);
    x.arc(cx, cy - 18, 22, Math.PI, 0, dir < 0);
    x.lineTo(cx + 22 * dir, cy + 30);
    x.stroke();
    x.beginPath(); x.moveTo(cx + 22 * dir - 20, cy + 26); x.lineTo(cx + 22 * dir + 20, cy + 26); x.lineTo(cx + 22 * dir, cy + 58); x.closePath(); x.fill();
  }
  {
    const [cx, cy] = cell(4);
    x.fillStyle = '#d0201a'; x.beginPath(); x.arc(cx + 128, cy + 128, 118, 0, Math.PI * 2); x.fill();
    x.fillStyle = '#f4f4f0'; x.beginPath(); x.arc(cx + 128, cy + 128, 92, 0, Math.PI * 2); x.fill();
    x.fillStyle = '#1846a8'; x.font = 'bold 118px Arial, sans-serif'; x.textAlign = 'center';
    x.fillText('40', cx + 128, cy + 170);
  }
  {
    const [cx, cy] = diamond(5);
    x.beginPath(); x.moveTo(cx - 62, cy + 40); x.lineTo(cx - 62, cy - 30); x.lineTo(cx - 20, cy - 12); x.lineTo(cx - 34, cy + 40); x.closePath(); x.fill();
    for (const [px, py, r] of [[10, -24, 11], [26, 6, 9], [14, 34, 13], [44, 30, 7]]) { x.beginPath(); x.arc(cx + px, cy + py, r, 0, Math.PI * 2); x.fill(); }
    x.fillRect(cx - 62, cy + 44, 124, 8);
  }
  {
    // the blue route board: KAIDO PASS / 峠 with a white border
    const [cx, cy] = cell(6);
    x.fillStyle = '#1c4f9c'; x.fillRect(cx, cy, 256, 256);
    x.strokeStyle = '#f4f4f0'; x.lineWidth = 8; x.strokeRect(cx + 10, cy + 10, 236, 236);
    x.fillStyle = '#f4f4f0'; x.textAlign = 'center';
    x.font = 'bold 96px serif'; x.fillText('峠', cx + 128, cy + 116);
    x.font = 'bold 30px Arial, sans-serif'; x.fillText('KAIDO PASS', cx + 128, cy + 166);
    x.font = 'bold 22px Arial, sans-serif'; x.fillText('SUMMIT 7 km ↑', cx + 128, cy + 210);
  }
  {
    const [cx, cy] = cell(7);
    x.fillStyle = '#ff8a14'; x.beginPath(); x.arc(cx + 64, cy + 64, 52, 0, Math.PI * 2); x.fill();
    x.fillStyle = '#f4f6ff'; x.beginPath(); x.arc(cx + 192, cy + 64, 52, 0, Math.PI * 2); x.fill();
    x.fillStyle = '#7d8084'; x.fillRect(cx, cy + 128, 256, 128);
  }
}, { repeat: false });

/** Vending machine fronts (4 across, each 256 × 512), with the emissive twin. */
export function vendingTex() {
  const bodies = ['#c8202a', '#e8eef2', '#1f5fb8', '#2a8a4a'];
  const heads = ['DRINKS', 'COLD & HOT', 'SPORTS', '緑茶 TEA'];
  const draw = (emi) => (x, w, h, rng) => {
    for (let m = 0; m < 4; m++) {
      const ox = m * 256;
      x.fillStyle = emi ? '#000' : bodies[m];
      x.fillRect(ox, 0, 256, h);
      // the display window: three shelves of cans and bottles, lit from inside
      x.fillStyle = emi ? '#c8dcf0' : '#eef3f8';
      x.fillRect(ox + 16, 40, 224, 250);
      const cols = ['#d8262a', '#1a5ec8', '#f2c21a', '#2a9a4a', '#f4f4f4', '#e86a1a', '#7a3ab8', '#1a1a1a', '#c8a26a'];
      for (let r = 0; r < 3; r++) {
        for (let k = 0; k < 7; k++) {
          const px = ox + 24 + k * 31, py = 52 + r * 80;
          const tall = rng() < 0.4;
          x.fillStyle = cols[Math.floor(rng() * cols.length)];
          x.fillRect(px, py + (tall ? 0 : 14), 22, tall ? 52 : 38);
          x.fillStyle = 'rgba(255,255,255,0.5)';
          x.fillRect(px + 3, py + (tall ? 4 : 18), 4, tall ? 40 : 26);
          x.fillStyle = emi ? '#3a8aff' : '#2a6aff';
          x.fillRect(px + 4, py + 62, 14, 6);
        }
        x.fillStyle = emi ? '#202020' : '#9aa4ae';
        x.fillRect(ox + 16, 114 + r * 80, 224, 4);
      }
      x.textAlign = 'center';
      x.font = 'bold 24px Arial, sans-serif';
      x.fillStyle = emi ? (m === 1 ? '#7a8088' : '#ffffff') : (m === 1 ? '#c8202a' : 'rgba(255,255,255,0.9)');
      x.fillText(heads[m], ox + 128, 30);
      if (!emi) {
        x.fillStyle = '#1c1c1e'; x.fillRect(ox + 150, 306, 90, 120);
        x.fillStyle = '#5a5e64'; x.fillRect(ox + 160, 318, 30, 8); x.fillRect(ox + 160, 336, 30, 8); x.fillRect(ox + 202, 318, 26, 42);
        x.fillStyle = '#111'; x.fillRect(ox + 22, 444, 212, 50);
        x.fillStyle = '#333'; x.fillRect(ox + 28, 450, 200, 38);
        x.fillStyle = 'rgba(255,255,255,0.12)'; x.fillRect(ox + 16, 300, 120, 120);
      } else {
        x.fillStyle = '#ffcf6a'; x.fillRect(ox + 206, 320, 16, 6);
        x.fillStyle = '#55ff88'; x.fillRect(ox + 166, 330, 18, 10);
      }
    }
  };
  return { map: tex('vend', 1024, 512, draw(false)), emi: tex('vendE', 1024, 512, draw(true)) };
}

/**
 * Tea house / mountain hut walls (one tile = 6 m × 3 m): a dark timber frame,
 * white plaster panels, a shoji window glowing paper-gold, a noren'd door.
 */
export function teaWallTex() {
  const draw = (emi) => (x, w, h, rng) => {
    x.fillStyle = emi ? '#000' : '#e6e0d2';
    x.fillRect(0, 0, w, h);
    if (!emi) { speckle(x, w, h, rng, 2500, '255,255,255', '90,80,60', 1.5, 0.2); blot(x, rng, w, h, 8, '120,100,70', 10, 40, 0.12); }
    const post = (px) => { if (!emi) { x.fillStyle = '#3a2618'; x.fillRect(px - 7, 0, 14, h); } };
    // sill and lintel beams
    if (!emi) { x.fillStyle = '#3a2618'; x.fillRect(0, h - 26, w, 26); x.fillRect(0, 40, w, 12); x.fillStyle = '#2a1a10'; x.fillRect(0, 0, w, 10); }
    // shoji window (left half)
    const wx0 = 40, wx1 = 230, wy0 = 70, wy1 = 168;
    x.fillStyle = emi ? '#ffcf7a' : '#efe3c4';
    x.fillRect(wx0, wy0, wx1 - wx0, wy1 - wy0);
    if (emi) { x.globalAlpha = 0.5; x.fillStyle = '#ff9a40'; x.fillRect(wx0, wy0 + 50, wx1 - wx0, wy1 - wy0 - 50); x.globalAlpha = 1; }
    x.fillStyle = emi ? '#3a2410' : '#5a3a22';
    for (let k = 0; k <= 6; k++) x.fillRect(wx0 + k * ((wx1 - wx0) / 6) - 2, wy0, 4, wy1 - wy0);
    for (let k = 0; k <= 4; k++) x.fillRect(wx0, wy0 + k * ((wy1 - wy0) / 4) - 2, wx1 - wx0, 4);
    // a silhouette behind the paper
    if (emi) { x.fillStyle = 'rgba(60,30,10,0.55)'; x.beginPath(); x.ellipse(150, 120, 16, 20, 0, 0, Math.PI * 2); x.fill(); x.fillRect(132, 136, 36, 40); }
    // door with noren (right half)
    const dx0 = 300, dx1 = 420;
    x.fillStyle = emi ? '#ffb860' : '#d8c6a0';
    x.fillRect(dx0, 56, dx1 - dx0, h - 82);
    if (!emi) { x.fillStyle = '#2b2a5a'; x.fillRect(dx0 - 6, 56, dx1 - dx0 + 12, 64); x.fillStyle = '#e8e0d0'; x.font = 'bold 30px serif'; x.textAlign = 'center'; x.fillText('茶', (dx0 + dx1) / 2, 100); x.fillStyle = 'rgba(0,0,0,0.3)'; for (let k = 1; k < 4; k++) x.fillRect(dx0 - 6 + k * (dx1 - dx0 + 12) / 4, 56, 3, 64); }
    else { x.fillStyle = '#000'; x.fillRect(dx0 - 6, 56, dx1 - dx0 + 12, 64); }
    post(10); post(256); post(290); post(430); post(502);
  };
  return { map: tex('teaWall', 512, 256, draw(false)), emi: tex('teaWallE', 512, 256, draw(true)) };
}

/** Kawara roof tiles: blue-grey ribbed rows, 2 m a tile. */
export const tileTex = () => tex('kawara', 256, 256, (x, w, h, rng) => {
  x.fillStyle = '#3d434b'; x.fillRect(0, 0, w, h);
  for (let px = 0; px < w; px += 16) {
    const g = x.createLinearGradient(px, 0, px + 16, 0);
    g.addColorStop(0, '#2a2f36'); g.addColorStop(0.5, '#59616b'); g.addColorStop(1, '#2a2f36');
    x.fillStyle = g; x.fillRect(px, 0, 16, h);
  }
  for (let py = 0; py < h; py += 32) { x.fillStyle = 'rgba(10,12,16,0.6)'; x.fillRect(0, py, w, 4); }
  speckle(x, w, h, rng, 3000, '200,210,220', '0,0,0', 1.2, 0.2);
  blot(x, rng, w, h, 10, '20,24,20', 10, 40, 0.25);
});

/** Granite: dressed blocks with dark joints and lichen, 2 m a tile. */
export const stoneTex = () => tex('granite', 256, 256, (x, w, h, rng) => {
  x.fillStyle = '#8b8780'; x.fillRect(0, 0, w, h);
  const rows = 5;
  for (let r = 0; r < rows; r++) {
    let px = r % 2 ? -40 : 0;
    const rh = h / rows;
    while (px < w) {
      const bw = 50 + rng() * 60;
      const t = 118 + rng() * 40;
      x.fillStyle = `rgb(${t},${t - 4},${t - 10})`;
      x.fillRect(px + 2, r * rh + 2, bw - 4, rh - 4);
      x.fillStyle = 'rgba(255,255,255,0.08)'; x.fillRect(px + 4, r * rh + 4, bw - 8, 5);
      px += bw;
    }
  }
  speckle(x, w, h, rng, 9000, '230,228,220', '30,28,24', 1.3, 0.35);
  blot(x, rng, w, h, 12, '70,90,50', 5, 18, 0.35);
});

// ------------------------------------------------------------------ the American mountains

/**
 * Sign atlas for the Summit, the Ridgeline and the Woods (4 × 2 cells of
 * 256, map + emissive): 0 yellow chevron →, 1 chevron ←, 2 CHAINS REQUIRED,
 * 3 the lodge's lit sign, 4 the 92.7 THE UNDERGROUND station board, 5 the
 * observatory board, 6 brown forest sign (NORTH WOODS / logging), 7 snow-pole
 * reflector + grey back.
 */
export function usSignTex() {
  const draw = (emi) => (x) => {
    const cell = (k) => [(k % 4) * 256, Math.floor(k / 4) * 256];
    x.fillStyle = '#000'; x.fillRect(0, 0, 1024, 512);
    x.textAlign = 'center';
    for (const [k, dir] of [[0, 1], [1, -1]]) {
      const [cx, cy] = cell(k);
      x.fillStyle = emi ? '#000' : '#f5c400'; x.fillRect(cx, cy, 256, 256);
      x.fillStyle = emi ? '#000' : '#141414';
      const m = (p) => cx + 128 + (p - 128) * dir;
      x.beginPath();
      x.moveTo(m(70), cy + 40); x.lineTo(m(160), cy + 128); x.lineTo(m(70), cy + 216);
      x.lineTo(m(120), cy + 216); x.lineTo(m(210), cy + 128); x.lineTo(m(120), cy + 40);
      x.closePath(); x.fill();
    }
    {
      const [cx, cy] = cell(2);
      x.fillStyle = emi ? '#000' : '#f2f2ee'; x.fillRect(cx, cy, 256, 256);
      x.strokeStyle = '#111'; x.lineWidth = 8; if (!emi) x.strokeRect(cx + 8, cy + 8, 240, 240);
      x.fillStyle = emi ? '#000' : '#111'; x.font = 'bold 44px Arial, sans-serif';
      x.fillText('CHAINS', cx + 128, cy + 96); x.fillText('REQUIRED', cx + 128, cy + 148);
      x.font = 'bold 26px Arial, sans-serif'; x.fillText('BEYOND THIS POINT', cx + 128, cy + 200);
    }
    {
      // the lodge's sign: warm neon script on dark wood
      const [cx, cy] = cell(3);
      x.fillStyle = emi ? '#000' : '#3a2416'; x.fillRect(cx, cy, 256, 256);
      x.fillStyle = emi ? '#ffb24a' : '#f0c27a';
      if (emi) { x.shadowColor = '#ff9a2a'; x.shadowBlur = 18; }
      x.font = 'italic bold 54px Georgia, serif'; x.fillText('Summit', cx + 128, cy + 104);
      x.font = 'bold 40px Georgia, serif'; x.fillText('LODGE', cx + 128, cy + 158);
      x.font = 'bold 20px Arial, sans-serif'; x.fillText('★ OPEN NIGHTS ★', cx + 128, cy + 210);
      x.shadowBlur = 0;
    }
    {
      // 92.7 THE UNDERGROUND
      const [cx, cy] = cell(4);
      x.fillStyle = emi ? '#000' : '#141018'; x.fillRect(cx, cy, 256, 256);
      x.fillStyle = emi ? '#ff2a6a' : '#ff4a7a';
      if (emi) { x.shadowColor = '#ff2a6a'; x.shadowBlur = 20; }
      x.font = 'italic 900 92px Arial Black, Arial, sans-serif'; x.fillText('92.7', cx + 128, cy + 116);
      x.fillStyle = emi ? '#2ae0ff' : '#5ae8ff';
      if (emi) x.shadowColor = '#2ae0ff';
      x.font = 'bold 30px Arial, sans-serif'; x.fillText('THE UNDERGROUND', cx + 128, cy + 168);
      x.font = 'bold 18px Arial, sans-serif'; x.fillText('TRANSMITTER · NO ENTRY', cx + 128, cy + 214);
      x.shadowBlur = 0;
    }
    {
      const [cx, cy] = cell(5);
      x.fillStyle = emi ? '#000' : '#16223a'; x.fillRect(cx, cy, 256, 256);
      x.fillStyle = emi ? '#9cc4ff' : '#dfe8ff';
      if (emi) { x.shadowColor = '#7ab0ff'; x.shadowBlur = 14; }
      x.font = 'bold 30px Arial, sans-serif'; x.fillText('HALCYON PEAK', cx + 128, cy + 70);
      x.fillText('OBSERVATORY', cx + 128, cy + 108);
      x.font = 'bold 20px Arial, sans-serif'; x.fillText('ELEV 2,610 FT', cx + 128, cy + 150);
      x.font = 'bold 20px Arial, sans-serif'; x.fillText('DIM YOUR LIGHTS', cx + 128, cy + 200);
      x.shadowBlur = 0;
    }
    {
      // brown forest-service board
      const [cx, cy] = cell(6);
      x.fillStyle = emi ? '#000' : '#5b3a22'; x.fillRect(cx, cy, 256, 256);
      x.strokeStyle = emi ? '#000' : '#e8d8a8'; x.lineWidth = 6; x.strokeRect(cx + 10, cy + 10, 236, 236);
      x.fillStyle = emi ? '#000' : '#f0e2b6'; x.font = 'bold 32px Georgia, serif';
      x.fillText('NORTH WOODS', cx + 128, cy + 76);
      x.font = 'bold 22px Georgia, serif'; x.fillText('TIMBER CO. · EST 1931', cx + 128, cy + 116);
      x.font = 'bold 24px Arial, sans-serif'; x.fillText('LOG TRUCKS', cx + 128, cy + 170); x.fillText('ENTERING', cx + 128, cy + 202);
    }
    {
      const [cx, cy] = cell(7);
      x.fillStyle = emi ? '#ffe090' : '#ff9a1a'; x.fillRect(cx + 16, cy + 16, 96, 96);
      x.fillStyle = emi ? '#fff0f0' : '#e02020'; x.fillRect(cx + 144, cy + 16, 96, 96);
      x.fillStyle = emi ? '#000' : '#7d8084'; x.fillRect(cx, cy + 128, 256, 128);
    }
  };
  return { map: tex('usSigns', 1024, 512, draw(false), { repeat: false }), emi: tex('usSignsE', 1024, 512, draw(true), { repeat: false }) };
}

/**
 * Lodge walls (one tile = 8 m × 4 m): dark-stained board and batten, a
 * big gridded window glowing warm, a stone wainscot.
 */
export function lodgeTex() {
  const draw = (emi) => (x, w, h, rng) => {
    x.fillStyle = emi ? '#000' : '#4a2e1c'; x.fillRect(0, 0, w, h);
    if (!emi) {
      for (let px = 0; px < w; px += 24) { x.fillStyle = 'rgba(0,0,0,0.35)'; x.fillRect(px, 0, 6, h); x.fillStyle = 'rgba(255,220,180,0.06)'; x.fillRect(px + 6, 0, 3, h); }
      speckle(x, w, h, rng, 3000, '200,150,100', '0,0,0', 1.4, 0.2);
      // stone wainscot
      x.fillStyle = '#6e6a64'; x.fillRect(0, h - 40, w, 40);
      for (let k = 0; k < 40; k++) { x.fillStyle = `rgba(${rng() < 0.5 ? '255,255,255' : '0,0,0'},0.15)`; x.fillRect(rng() * w, h - 40 + rng() * 34, 20 + rng() * 30, 10 + rng() * 8); }
    }
    // two windows per tile
    for (const wx of [40, 296]) {
      const ww = 176, wy = 54, wh = 120;
      x.fillStyle = emi ? '#ffbe6a' : '#f2d29a';
      x.fillRect(wx, wy, ww, wh);
      if (emi) {
        const g = x.createLinearGradient(0, wy, 0, wy + wh);
        g.addColorStop(0, 'rgba(255,140,40,0.0)'); g.addColorStop(1, 'rgba(255,110,30,0.6)');
        x.fillStyle = g; x.fillRect(wx, wy, ww, wh);
        x.fillStyle = 'rgba(40,20,10,0.6)'; x.fillRect(wx + 30 + rng() * 80, wy + 50, 26, 70);
      }
      x.fillStyle = emi ? '#000' : '#2a1a10';
      for (let k = 0; k <= 4; k++) x.fillRect(wx + k * ww / 4 - 3, wy, 6, wh);
      for (let k = 0; k <= 3; k++) x.fillRect(wx, wy + k * wh / 3 - 3, ww, 6);
    }
  };
  return { map: tex('lodge', 512, 256, draw(false)), emi: tex('lodgeE', 512, 256, draw(true)) };
}

/** Rock face with strata (cut slopes on the Ridgeline), 6 m a tile; snowy for the Summit. */
export function rockFaceTex(snowy = false) {
  return tex(snowy ? 'rockSnow' : 'rockFace', 256, 256, (x, w, h, rng) => {
    x.fillStyle = snowy ? '#7a7874' : '#76695a'; x.fillRect(0, 0, w, h);
    let y = 0;
    while (y < h) {
      const th = 10 + rng() * 30, tone = (snowy ? 96 : 92) + rng() * 50;
      x.fillStyle = snowy ? `rgba(${tone | 0},${tone | 0},${(tone + 4) | 0},0.75)` : `rgba(${(tone + 10) | 0},${(tone - 2) | 0},${(tone - 16) | 0},0.75)`;
      x.fillRect(0, y, w, th);
      x.fillStyle = 'rgba(15,12,10,0.55)'; x.fillRect(0, y + th - 2, w, 2);
      y += th;
    }
    for (let i = 0; i < 40; i++) {
      const px = rng() * w, py = rng() * h, l = 20 + rng() * 60;
      x.strokeStyle = 'rgba(10,8,6,0.6)'; x.lineWidth = 1 + rng() * 2;
      x.beginPath(); x.moveTo(px, py); x.lineTo(px + (rng() - 0.5) * 20, py + l); x.stroke();
    }
    if (snowy) {
      // snow lying on every ledge
      y = 0;
      while (y < h) { x.fillStyle = 'rgba(240,244,250,0.85)'; x.fillRect(0, y, w, 3 + rng() * 6); y += 18 + rng() * 26; }
      blot(x, rng, w, h, 20, '245,248,252', 6, 26, 0.6);
    } else blot(x, rng, w, h, 14, '70,80,40', 6, 20, 0.3);
    speckle(x, w, h, rng, 8000, '235,230,220', '0,0,0', 1.5, 0.3);
  });
}

// ------------------------------------------------------------------ the North Woods

/** Log cabin walls (one tile = 6 m × 3 m): stacked logs, chinking, a lit four-pane window. */
export function logWallTex() {
  const draw = (emi) => (x, w, h, rng) => {
    x.fillStyle = emi ? '#000' : '#6a4a2c'; x.fillRect(0, 0, w, h);
    if (!emi) {
      const lh = 20;
      for (let y = 0; y < h; y += lh) {
        const g = x.createLinearGradient(0, y, 0, y + lh);
        g.addColorStop(0, '#4a3018'); g.addColorStop(0.35, '#8a6440'); g.addColorStop(0.8, '#6a4a2c'); g.addColorStop(1, '#2a1a0c');
        x.fillStyle = g; x.fillRect(0, y, w, lh);
        x.fillStyle = 'rgba(220,210,180,0.5)'; x.fillRect(0, y + lh - 2, w, 2);
      }
      speckle(x, w, h, rng, 3000, '200,160,110', '20,10,0', 1.5, 0.25);
    }
    const wx = 170, wy = 70, ww = 170, wh = 100;
    x.fillStyle = emi ? '#ffc070' : '#e8c890'; x.fillRect(wx, wy, ww, wh);
    if (emi) { x.fillStyle = 'rgba(255,120,40,0.5)'; x.fillRect(wx, wy + 50, ww, 50); }
    x.fillStyle = emi ? '#000' : '#e8e2d2'; x.fillRect(wx - 8, wy - 8, ww + 16, 8); x.fillRect(wx - 8, wy + wh, ww + 16, 8); x.fillRect(wx - 8, wy, 8, wh); x.fillRect(wx + ww, wy, 8, wh);
    x.fillRect(wx + ww / 2 - 3, wy, 6, wh); x.fillRect(wx, wy + wh / 2 - 3, ww, 6);
  };
  return { map: tex('logWall', 512, 256, draw(false)), emi: tex('logWallE', 512, 256, draw(true)) };
}

/** Log cribbing (timber retaining walls on the logging roads' cuts), 3 m a tile. */
export const cribTex = () => tex('crib', 256, 256, (x, w, h, rng) => {
  x.fillStyle = '#3c3326'; x.fillRect(0, 0, w, h);
  blot(x, rng, w, h, 20, '70,80,40', 8, 24, 0.5);
  for (let y = 0; y < h; y += 32) {
    const g = x.createLinearGradient(0, y, 0, y + 22);
    g.addColorStop(0, '#5a4026'); g.addColorStop(0.4, '#8a6a46'); g.addColorStop(1, '#3a2814');
    x.fillStyle = g; x.fillRect(0, y, w, 22);
  }
  for (let px = 16; px < w; px += 64) for (let y = 22; y < h; y += 32) {
    x.fillStyle = '#7a5a38'; x.beginPath(); x.ellipse(px, y + 5, 9, 7, 0, 0, Math.PI * 2); x.fill();
    x.strokeStyle = 'rgba(40,24,10,0.8)'; x.lineWidth = 1.5; x.beginPath(); x.ellipse(px, y + 5, 5, 4, 0, 0, Math.PI * 2); x.stroke();
  }
  speckle(x, w, h, rng, 5000, '200,170,120', '0,0,0', 1.4, 0.25);
});

/** Corrugated iron (sawmill, sheds): rusty ribs, 3 m a tile. */
export const ironTex = () => tex('iron', 256, 256, (x, w, h, rng) => {
  x.fillStyle = '#6a6e70'; x.fillRect(0, 0, w, h);
  for (let px = 0; px < w; px += 12) {
    const g = x.createLinearGradient(px, 0, px + 12, 0);
    g.addColorStop(0, '#4a4e50'); g.addColorStop(0.5, '#8a8e90'); g.addColorStop(1, '#4a4e50');
    x.fillStyle = g; x.fillRect(px, 0, 12, h);
  }
  blot(x, rng, w, h, 26, '130,70,30', 8, 40, 0.45);
  for (let i = 0; i < 30; i++) {
    const px = rng() * w, py = rng() * h * 0.5;
    const g = x.createLinearGradient(0, py, 0, py + 80);
    g.addColorStop(0, 'rgba(110,55,20,0.5)'); g.addColorStop(1, 'rgba(110,55,20,0)');
    x.fillStyle = g; x.fillRect(px, py, 4, 80);
  }
  speckle(x, w, h, rng, 4000, '220,220,210', '0,0,0', 1.2, 0.25);
});

/** Falling water: vertical streaks of white over dark green-blue (scrolled for the fall). */
export const fallTex = () => tex('fall', 128, 256, (x, w, h, rng) => {
  x.fillStyle = '#5a7a86'; x.fillRect(0, 0, w, h);
  for (let i = 0; i < 260; i++) {
    const px = rng() * w, py = rng() * h, l = 20 + rng() * 80;
    x.fillStyle = `rgba(240,250,255,${0.15 + rng() * 0.5})`;
    x.fillRect(px, py, 1 + rng() * 3, l);
    if (py + l > h) x.fillRect(px, py - h, 1 + rng() * 3, l);
  }
});
