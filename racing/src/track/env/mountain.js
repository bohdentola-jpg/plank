// Mountain pass (touge): a road shelved into steep forested slopes. Cut rock,
// lattice-framed and shotcrete faces on the uphill side, white W-beam
// guardrail over the drop, cedar forest, chevrons and warning signs at the
// hairpins, sparse sodium lamps, a viewpoint lot with glowing vending
// machines, power lines, a rock shed, snowy peaks and layered far ranges.
import * as THREE from 'three';
import { stripMesh, glowMaterial } from '../build.js';
import { groundTexture, concreteTexture, toTex, glowTexture } from '../textures.js';
import { GeoBuilder, instanced } from './common.js';
import { makeNoise2D, makeRng, clamp, smoothstep, nextFrame } from '../../core/util.js';

const BENCH = 14;      // uphill side: terrain kept at road level this far from the centerline (hidden behind the cut face)
const RAIL = 1.0;      // guardrail face past the road edge (valley side)
const CUT = 1.5;       // foot of the cut face past the road edge (mountain side)

// ---------------------------------------------------------------- landform

/** C1 cubic through [[t, y], …], clamped at the ends. */
function spline(knots, t) {
  const n = knots.length;
  if (t <= knots[0][0]) return knots[0][1];
  if (t >= knots[n - 1][0]) return knots[n - 1][1];
  let k = 0;
  while (knots[k + 1][0] < t) k++;
  const [t0, y0] = knots[k], [t1, y1] = knots[k + 1];
  const h = t1 - t0;
  const slope = (j) => {
    const a = knots[Math.max(0, j - 1)], b = knots[Math.min(n - 1, j + 1)];
    return (b[1] - a[1]) / (b[0] - a[0]);
  };
  const m0 = slope(k) * h, m1 = slope(k + 1) * h;
  const u = (t - t0) / h, u2 = u * u, u3 = u2 * u;
  return (2 * u3 - 3 * u2 + 1) * y0 + (u3 - 2 * u2 + u) * m0 + (-2 * u3 + 3 * u2) * y1 + (u3 - u2) * m1;
}

/** The designed landform (def.land): a profile along an axis or around a peak, peaks, ridged relief, a rim at the grid edge. */
function makeLand(def, track) {
  const L = def.land || {};
  const noise = makeNoise2D('land' + (L.seed ?? def.id));
  const base = L.base || [[0, 0]], relief = L.relief || [[0, 30]], peaks = L.peaks || [];
  const [ax, az] = L.axis || [0, 1];
  const [cx, cz] = L.center || [0, 0];
  const tilt = L.tilt;
  const b = track.bounds, margin = L.margin ?? 620;
  const land = (x, z) => {
    const t = L.center ? Math.hypot(x - cx, z - cz) : x * ax + z * az;
    let h = spline(base, t);
    if (tilt) h += (x * tilt[0] + z * tilt[1]) * tilt[2];
    for (const [px, pz, ph, pr] of peaks) h += ph * Math.exp(-((x - px) ** 2 + (z - pz) ** 2) / (pr * pr));
    // spurs and gullies run down the fall line: ridged noise stretched along it
    const u = L.center ? Math.atan2(z - cz, x - cx) * 420 : x * az - z * ax;
    const amp = spline(relief, t);
    h += amp * ((noise.ridged(u / 300 + 3.7, t / 560, 3) - 0.73) * 4.2 + noise.fbm(x / 170 + 7.1, z / 170 - 3.3, 3) * 0.8);
    const ex = Math.max(b.minX - x, 0, x - b.maxX), ez = Math.max(b.minZ - z, 0, z - b.maxZ);
    h += 150 * smoothstep(margin * 0.4, margin, Math.hypot(ex, ez)) * (0.7 + 0.3 * noise(x / 300, z / 300));
    return h;
  };
  land.noise = noise;
  return land;
}

const gkey = (gx, gz) => (gx + 32768) * 65536 + (gz + 32768);

/**
 * Terrain model shared by natural() and build(): the landform corrected so it
 * passes through the road (inverse-distance blend of road-height residuals),
 * then carved — a bench at road level on the uphill side (the cut face mesh
 * hides it), an immediate drop on the valley side.
 */
function setupLand(def, track) {
  if (track.mtn) return track.mtn;
  const land = makeLand(def, track);
  const { X, Z, Y, N } = track;
  // residuals every 8 m, hashed in 50 m cells
  const C = 50, R = 220, R2 = R * R, L2 = 38 * 38, W0 = 0.12, rc = Math.ceil(R / C);
  const sx = [], sz = [], sr = [];
  const grid = new Map();
  for (let i = 0; i < N; i += 4) {
    const k = sx.length;
    sx.push(X[i]); sz.push(Z[i]); sr.push(Y[i] - land(X[i], Z[i]));
    const key = gkey(Math.floor(X[i] / C), Math.floor(Z[i] / C));
    if (!grid.has(key)) grid.set(key, []);
    grid.get(key).push(k);
  }
  const corr = (x, z) => {
    const gx = Math.floor(x / C), gz = Math.floor(z / C);
    let sw = 0, swr = 0;
    for (let dx = -rc; dx <= rc; dx++) {
      for (let dz = -rc; dz <= rc; dz++) {
        const list = grid.get(gkey(gx + dx, gz + dz));
        if (!list) continue;
        for (const k of list) {
          const d2 = (sx[k] - x) ** 2 + (sz[k] - z) ** 2;
          if (d2 >= R2) continue;
          const q = 1 + d2 / L2, f = 1 - d2 / R2;
          const w = f * f / (q * q);
          sw += w; swr += w * sr[k];
        }
      }
    }
    return swr / (sw + W0);
  };
  const raw = (x, z) => land(x, z) + corr(x, z);
  // nearest full-resolution sample, 20 m cells, searched out to ~40 m
  const NC = 20;
  const ngrid = new Map();
  for (let i = 0; i < N; i++) {
    const key = gkey(Math.floor(X[i] / NC), Math.floor(Z[i] / NC));
    if (!ngrid.has(key)) ngrid.set(key, []);
    ngrid.get(key).push(i);
  }
  const nearest = (x, z) => {
    const gx = Math.floor(x / NC), gz = Math.floor(z / NC);
    let best = -1, bd = Infinity;
    for (let dx = -2; dx <= 2; dx++) {
      for (let dz = -2; dz <= 2; dz++) {
        const list = ngrid.get(gkey(gx + dx, gz + dz));
        if (!list) continue;
        for (const i of list) {
          const d = (X[i] - x) ** 2 + (Z[i] - z) ** 2;
          if (d < bd) { bd = d; best = i; }
        }
      }
    }
    return best;
  };
  const carved = (x, z) => {
    const h = raw(x, z);
    const n = nearest(x, z);
    if (n < 0) return h;
    const lat = (x - X[n]) * track.LX[n] + (z - Z[n]) * track.LZ[n];
    const lon = (x - X[n]) * track.TX[n] + (z - Z[n]) * track.TZ[n];
    const d = Math.abs(lon) > track.step * 3 ? Math.hypot(lat, lon) : Math.abs(lat);
    const W = track.W[n];
    const ry = Y[n] + clamp(lat, -W, W) * Math.tan(track.B[n]) - 0.35;
    const dz = h - ry;
    const m = dz > 0 ? smoothstep(W + BENCH, W + BENCH + 12, d) : smoothstep(W + 1.6, W + 5, d);
    return ry + dz * m;
  };
  track.mtn = { land, corr, raw, carved, nearest };
  return track.mtn;
}

export function natural(def, track) {
  return setupLand(def, track).carved;
}

export function terrainOpts(def) {
  return { margin: def.land?.margin ?? 620, cell: 10, flat: 1, blend: 2 };
}

// ---------------------------------------------------------------- textures

const texCache = new Map();

/** Cached canvas texture; draw(ctx, w, h, rng, wrap) where wrap(fn) repeats fn at ±w/±h so marks tile. */
function canvasTex(key, w, h, draw, opts = {}) {
  if (!texCache.has(key)) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const x = c.getContext('2d');
    const wrap = (fn) => { for (const dx of [-w, 0, w]) for (const dy of [-h, 0, h]) fn(dx, dy); };
    draw(x, w, h, makeRng(key), wrap);
    texCache.set(key, toTex(c, opts));
  }
  return texCache.get(key);
}

function speckle(x, w, h, rng, n, light, dark, size = 1.5) {
  for (let i = 0; i < n; i++) {
    x.fillStyle = rng() < 0.5 ? `rgba(${light},${rng() * 0.3})` : `rgba(${dark},${rng() * 0.3})`;
    const r = size * (0.5 + rng());
    x.fillRect(rng() * w, rng() * h, r, r);
  }
}

function blot(x, wrap, rng, w, h, n, color, r0, r1, a) {
  for (let i = 0; i < n; i++) {
    const px = rng() * w, py = rng() * h, r = r0 + rng() * (r1 - r0);
    wrap((dx, dy) => {
      const g = x.createRadialGradient(px + dx, py + dy, 0, px + dx, py + dy, r);
      g.addColorStop(0, `rgba(${color},${a})`);
      g.addColorStop(1, `rgba(${color},0)`);
      x.fillStyle = g;
      x.fillRect(px + dx - r, py + dy - r, r * 2, r * 2);
    });
  }
}

/** Neutral detail for vertex-colored ground (multiplies to ~0.9). */
function detailTex() {
  return canvasTex('mtn-detail', 256, 256, (x, w, h, rng, wrap) => {
    x.fillStyle = '#e4e4e4';
    x.fillRect(0, 0, w, h);
    blot(x, wrap, rng, w, h, 30, '0,0,0', 8, 40, 0.12);
    blot(x, wrap, rng, w, h, 14, '255,255,255', 8, 30, 0.1);
    speckle(x, w, h, rng, 9000, '255,255,255', '0,0,0', 1.6);
    for (let i = 0; i < 260; i++) { // twigs and needles
      x.strokeStyle = `rgba(${rng() < 0.5 ? '40,30,20' : '255,250,235'},${0.15 + rng() * 0.2})`;
      x.lineWidth = 1;
      const px = rng() * w, py = rng() * h, a = rng() * Math.PI, l = 3 + rng() * 9;
      x.beginPath(); x.moveTo(px, py); x.lineTo(px + Math.cos(a) * l, py + Math.sin(a) * l); x.stroke();
    }
  });
}

/** Cut rock: tilted strata, fractures, water stains, moss. 8 m tile. */
function rockTex() {
  return canvasTex('mtn-rock', 512, 512, (x, w, h, rng, wrap) => {
    x.fillStyle = '#7a7268';
    x.fillRect(0, 0, w, h);
    let y = 0;
    while (y < h) {
      const th = 10 + rng() * 46, tone = 92 + rng() * 52, ph = rng() * 6.28, amp = 3 + rng() * 6;
      x.fillStyle = `rgba(${tone | 0},${(tone - 7) | 0},${(tone - 15) | 0},0.6)`;
      x.beginPath();
      for (let k = 0; k <= 32; k++) x.lineTo(k * w / 32, y + Math.sin(k / 32 * 6.283 * 2 + ph) * amp);
      for (let k = 32; k >= 0; k--) x.lineTo(k * w / 32, y + th + Math.sin(k / 32 * 6.283 * 3 + ph) * amp);
      x.closePath();
      x.fill();
      x.strokeStyle = 'rgba(25,20,16,0.45)';
      x.lineWidth = 1.5;
      x.beginPath();
      for (let k = 0; k <= 32; k++) x.lineTo(k * w / 32, y + th + Math.sin(k / 32 * 6.283 * 3 + ph) * amp);
      x.stroke();
      y += th;
    }
    blot(x, wrap, rng, w, h, 26, '20,16,12', 20, 70, 0.3);
    blot(x, wrap, rng, w, h, 10, '200,190,170', 20, 60, 0.12);
    // blocky joints
    x.strokeStyle = 'rgba(18,14,10,0.6)';
    for (let i = 0; i < 46; i++) {
      const px = rng() * w, py = rng() * h, l = 20 + rng() * 70, a = Math.PI / 2 + (rng() - 0.5) * 0.7;
      x.lineWidth = 1 + rng() * 2;
      wrap((dx, dy) => { x.beginPath(); x.moveTo(px + dx, py + dy); x.lineTo(px + dx + Math.cos(a) * l, py + dy + Math.sin(a) * l); x.stroke(); });
    }
    // water stains running down, moss in the seams
    for (let i = 0; i < 22; i++) {
      const px = rng() * w, py = rng() * h * 0.6, ww = 4 + rng() * 14, hh = 60 + rng() * 200;
      const g = x.createLinearGradient(0, py, 0, py + hh);
      g.addColorStop(0, 'rgba(15,12,10,0.35)');
      g.addColorStop(1, 'rgba(15,12,10,0)');
      x.fillStyle = g;
      wrap((dx) => x.fillRect(px + dx, py, ww, hh));
    }
    blot(x, wrap, rng, w, h, 18, '52,70,30', 10, 40, 0.45);
    speckle(x, w, h, rng, 14000, '230,225,215', '0,0,0', 1.8);
  });
}

/** Lattice-frame slope protection: concrete grid (2 m cells) holding scrubby grass. 4 m tile. */
function latticeTex() {
  return canvasTex('mtn-lattice', 256, 256, (x, w, h, rng, wrap) => {
    x.fillStyle = '#3c4a2a';
    x.fillRect(0, 0, w, h);
    blot(x, wrap, rng, w, h, 40, '90,95,50', 6, 22, 0.5);
    blot(x, wrap, rng, w, h, 30, '30,24,16', 6, 20, 0.5);
    speckle(x, w, h, rng, 6000, '160,170,110', '10,12,6', 2);
    const bw = 20;
    for (const c of [0, 128]) {
      // shadow under the horizontal beam (v grows up the face), concrete on top
      wrap((dx, dy) => {
        x.fillStyle = 'rgba(0,0,0,0.45)';
        x.fillRect(0 + dx, c - bw / 2 - 7 + dy, w, 7);
        x.fillRect(c + bw / 2 + dx, 0 + dy, 6, h);
      });
    }
    for (const c of [0, 128]) {
      wrap((dx, dy) => {
        x.fillStyle = '#a8a59b';
        x.fillRect(0 + dx, c - bw / 2 + dy, w, bw);
        x.fillRect(c - bw / 2 + dx, 0 + dy, bw, h);
      });
    }
    // nodes, stains, chipped edges
    for (const cx of [0, 128]) for (const cy of [0, 128]) wrap((dx, dy) => { x.fillStyle = '#b5b2a8'; x.fillRect(cx - 13 + dx, cy - 13 + dy, 26, 26); });
    blot(x, wrap, rng, w, h, 20, '40,36,28', 6, 26, 0.3);
    speckle(x, w, h, rng, 5000, '230,230,220', '0,0,0', 1.5);
  });
}

/** Sprayed concrete with weep holes and rust-brown runs. 4 m tile. */
function shotcreteTex() {
  return canvasTex('mtn-shot', 256, 256, (x, w, h, rng, wrap) => {
    x.fillStyle = '#8f8d86';
    x.fillRect(0, 0, w, h);
    blot(x, wrap, rng, w, h, 40, '60,58,52', 8, 30, 0.3);
    blot(x, wrap, rng, w, h, 20, '190,188,180', 8, 26, 0.2);
    for (const [hx, hy] of [[64, 64], [192, 192]]) {
      wrap((dx, dy) => {
        const g = x.createLinearGradient(0, hy + dy, 0, hy + dy + 120);
        g.addColorStop(0, 'rgba(70,45,25,0.5)');
        g.addColorStop(1, 'rgba(70,45,25,0)');
        x.fillStyle = g;
        x.fillRect(hx - 5 + dx, hy + dy, 10, 120);
        x.fillStyle = '#1a1916';
        x.beginPath(); x.arc(hx + dx, hy + dy, 5, 0, Math.PI * 2); x.fill();
      });
    }
    x.strokeStyle = 'rgba(30,28,24,0.5)';
    for (let i = 0; i < 18; i++) {
      let px = rng() * w, py = rng() * h;
      x.lineWidth = 1;
      x.beginPath(); x.moveTo(px, py);
      for (let k = 0; k < 6; k++) { px += (rng() - 0.5) * 24; py += rng() * 18; x.lineTo(px, py); }
      x.stroke();
    }
    speckle(x, w, h, rng, 9000, '240,240,235', '0,0,0', 1.4);
  });
}

/** Sign atlas (4×2 cells of 256): chevrons R/L, hairpin R/L, winding, rockfall, 40 limit, route shield + reflectors. */
function signAtlas() {
  return canvasTex('mtn-signs', 1024, 512, (x) => {
    const cell = (k) => [(k % 4) * 256, Math.floor(k / 4) * 256];
    for (const [k, dir] of [[0, 1], [1, -1]]) {
      const [cx, cy] = cell(k);
      x.fillStyle = '#f2c400';
      x.fillRect(cx, cy, 256, 256);
      x.fillStyle = '#121212';
      const m = (px) => cx + 128 + (px - 128) * dir;
      for (const o of [-46, 46]) {
        x.beginPath();
        x.moveTo(m(66 + o), cy + 34); x.lineTo(m(140 + o), cy + 128); x.lineTo(m(66 + o), cy + 222);
        x.lineTo(m(104 + o), cy + 222); x.lineTo(m(178 + o), cy + 128); x.lineTo(m(104 + o), cy + 34);
        x.closePath(); x.fill();
      }
      x.lineWidth = 10;
      x.strokeRect(cx + 5, cy + 5, 246, 246);
    }
    const diamond = (k) => {
      const [cx, cy] = cell(k);
      x.save();
      x.translate(cx + 128, cy + 128);
      x.rotate(Math.PI / 4);
      x.fillStyle = '#121212';
      x.fillRect(-88, -88, 176, 176);
      x.fillStyle = '#f5c800';
      x.fillRect(-80, -80, 160, 160);
      x.restore();
      x.strokeStyle = '#121212';
      x.fillStyle = '#121212';
      x.lineWidth = 15;
      x.lineCap = 'butt';
      return [cx + 128, cy + 128];
    };
    for (const [k, dir] of [[2, 1], [3, -1]]) {
      const [cx, cy] = diamond(k);
      x.beginPath();
      x.moveTo(cx - 22 * dir, cy + 62); x.lineTo(cx - 22 * dir, cy - 18);
      x.arc(cx, cy - 18, 22, Math.PI, 0, dir < 0);
      x.lineTo(cx + 22 * dir, cy + 30);
      x.stroke();
      x.beginPath();
      x.moveTo(cx + 22 * dir - 20, cy + 26); x.lineTo(cx + 22 * dir + 20, cy + 26); x.lineTo(cx + 22 * dir, cy + 58);
      x.closePath(); x.fill();
    }
    {
      const [cx, cy] = diamond(4);
      x.beginPath();
      x.moveTo(cx - 10, cy + 64);
      x.bezierCurveTo(cx + 40, cy + 30, cx - 50, cy + 0, cx - 5, cy - 30);
      x.lineTo(cx + 6, cy - 38);
      x.stroke();
      x.beginPath();
      x.moveTo(cx - 16, cy - 30); x.lineTo(cx + 22, cy - 52); x.lineTo(cx + 18, cy - 14);
      x.closePath(); x.fill();
    }
    {
      const [cx, cy] = diamond(5);
      x.beginPath();
      x.moveTo(cx - 62, cy + 40); x.lineTo(cx - 62, cy - 30); x.lineTo(cx - 20, cy - 12); x.lineTo(cx - 34, cy + 40);
      x.closePath(); x.fill();
      for (const [px, py, r] of [[10, -24, 11], [26, 6, 9], [14, 34, 13], [44, 30, 7]]) { x.beginPath(); x.arc(cx + px, cy + py, r, 0, Math.PI * 2); x.fill(); }
      x.fillRect(cx - 62, cy + 44, 124, 8);
    }
    {
      const [cx, cy] = cell(6);
      x.fillStyle = '#d0201a';
      x.beginPath(); x.arc(cx + 128, cy + 128, 118, 0, Math.PI * 2); x.fill();
      x.fillStyle = '#f4f4f0';
      x.beginPath(); x.arc(cx + 128, cy + 128, 92, 0, Math.PI * 2); x.fill();
      x.fillStyle = '#1846a8';
      x.font = 'bold 118px Arial, sans-serif';
      x.textAlign = 'center';
      x.fillText('40', cx + 128, cy + 170);
    }
    {
      const [cx, cy] = cell(7);
      x.fillStyle = '#f2f2ee';
      x.beginPath();
      x.moveTo(cx + 8, cy + 30); x.quadraticCurveTo(cx + 88, cy + 4, cx + 168, cy + 30);
      x.lineTo(cx + 168, cy + 120); x.quadraticCurveTo(cx + 168, cy + 200, cx + 88, cy + 236);
      x.quadraticCurveTo(cx + 8, cy + 200, cx + 8, cy + 120);
      x.closePath(); x.fill();
      x.fillStyle = '#1a4fb0';
      x.beginPath();
      x.moveTo(cx + 18, cy + 38); x.quadraticCurveTo(cx + 88, cy + 16, cx + 158, cy + 38);
      x.lineTo(cx + 158, cy + 118); x.quadraticCurveTo(cx + 158, cy + 190, cx + 88, cy + 224);
      x.quadraticCurveTo(cx + 18, cy + 190, cx + 18, cy + 118);
      x.closePath(); x.fill();
      x.fillStyle = '#ffffff';
      x.textAlign = 'center';
      x.font = 'bold 30px Arial, sans-serif';
      x.fillText('ROUTE', cx + 88, cy + 74);
      x.font = 'bold 74px Arial, sans-serif';
      x.fillText('406', cx + 88, cy + 150);
      // reflectors (orange, white) and a plain gray patch for sign backs
      x.fillStyle = '#ff8a14';
      x.beginPath(); x.arc(cx + 214, cy + 40, 30, 0, Math.PI * 2); x.fill();
      x.fillStyle = '#f4f6ff';
      x.beginPath(); x.arc(cx + 214, cy + 112, 30, 0, Math.PI * 2); x.fill();
      x.fillStyle = '#7d8084';
      x.fillRect(cx + 184, cy + 168, 64, 80);
    }
  }, { repeat: false });
}

/** Vending machine front (map + emissive), 256×512. */
function vendingTex(body, seed) {
  const key = `mtn-vend|${body}|${seed}`;
  const draw = (emi) => (x, w, h, rng) => {
    x.fillStyle = emi ? '#000' : body;
    x.fillRect(0, 0, w, h);
    // display window: three shelves of cans and bottles
    x.fillStyle = emi ? '#d8e6f4' : '#eef3f8';
    x.fillRect(18, 34, 220, 252);
    const cols = ['#d8262a', '#1a5ec8', '#f2c21a', '#2a9a4a', '#f4f4f4', '#e86a1a', '#7a3ab8', '#1a1a1a', '#c8a26a'];
    for (let r = 0; r < 3; r++) {
      for (let k = 0; k < 7; k++) {
        const cx = 26 + k * 30, cy = 46 + r * 82;
        const c = cols[Math.floor(rng() * cols.length)];
        x.fillStyle = emi ? c : c;
        const tall = rng() < 0.4;
        x.fillRect(cx, cy + (tall ? 0 : 14), 22, tall ? 52 : 38);
        x.fillStyle = 'rgba(255,255,255,0.5)';
        x.fillRect(cx + 3, cy + (tall ? 4 : 18), 4, tall ? 40 : 26);
        x.fillStyle = emi ? '#2a6aff' : '#3a7aff';
        x.fillRect(cx + 4, cy + 62, 14, 7);
      }
      x.fillStyle = emi ? '#202020' : '#9aa4ae';
      x.fillRect(18, 112 + r * 82, 220, 4);
    }
    if (!emi) {
      x.fillStyle = 'rgba(255,255,255,0.85)';
      x.font = 'bold 22px Arial, sans-serif';
      x.textAlign = 'center';
      x.fillText(seed, 128, 26);
      x.fillStyle = '#1c1c1e';
      x.fillRect(150, 300, 88, 120);
      x.fillStyle = '#5a5e64';
      x.fillRect(160, 312, 30, 8); x.fillRect(160, 330, 30, 8); x.fillRect(200, 312, 26, 40);
      x.fillStyle = '#111';
      x.fillRect(24, 440, 208, 50);
      x.fillStyle = '#333';
      x.fillRect(30, 446, 196, 38);
    } else {
      x.fillStyle = '#ffcf6a';
      x.fillRect(206, 314, 16, 6);
      x.fillStyle = '#404040';
      x.font = 'bold 22px Arial, sans-serif';
      x.textAlign = 'center';
      x.fillText(seed, 128, 26);
    }
  };
  return { map: canvasTex(key, 256, 512, draw(false)), emi: canvasTex(key + 'e', 256, 512, draw(true)) };
}

// ---------------------------------------------------------------- geometry helpers

/** Indexed grid mesh from rows of vertices [[x,y,z,u,v], …] (one run). */
class Ribbon {
  constructor() { this.p = []; this.uv = []; this.c = []; this.idx = []; }
  get count() { return this.p.length / 3; }
  run(rows, color) {
    if (rows.length < 2) return;
    const np = rows[0].length, base = this.count;
    for (const row of rows) {
      for (const v of row) {
        this.p.push(v[0], v[1], v[2]);
        this.uv.push(v[3], v[4]);
        const c = v[5] || color || [1, 1, 1];
        this.c.push(c[0], c[1], c[2]);
      }
    }
    for (let r = 0; r < rows.length - 1; r++) {
      for (let k = 0; k < np - 1; k++) {
        const a = base + r * np + k, b = a + 1, c = a + np, d = c + 1;
        this.idx.push(a, c, b, b, c, d);
      }
    }
  }
  build() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.c, 3));
    g.setIndex(this.idx);
    g.computeVertexNormals();
    return g;
  }
}

/** Contiguous runs [i0, i1] where pred(i) holds (wraps on closed tracks). */
function runsOf(track, pred) {
  const N = track.N, out = [];
  let start = -1;
  for (let i = 0; i < N; i++) {
    if (pred(i) && start < 0) start = i;
    if ((!pred(i) || i === N - 1) && start >= 0) { out.push([start, pred(i) ? i : i - 1]); start = -1; }
  }
  if (track.closed && out.length > 1 && out[0][0] === 0 && out[out.length - 1][1] === N - 1) {
    const last = out.pop();
    out[0] = [last[0], out[0][1] + N];
  }
  return out;
}

/** Retroreflective sign material: brightens toward the viewer like headlights catching it. */
function retroMaterial(world, map, strength = 2.4) {
  const m = new THREE.MeshStandardMaterial({ map, roughness: 0.6, metalness: 0, alphaTest: 0.5 });
  const k = world.at.headlights ? strength : 0;
  m.onBeforeCompile = (sh) => {
    sh.fragmentShader = sh.fragmentShader.replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
      { float rd = length(vViewPosition); float rf = max(dot(normal, vViewPosition / max(rd, 0.001)), 0.0);
        totalEmissiveRadiance += diffuseColor.rgb * ${k.toFixed(2)} * rf * rf * (1.0 - smoothstep(30.0, 190.0, rd)); }`);
  };
  m.customProgramCacheKey = () => 'mtn-retro' + k;
  return m;
}

/** Quad helper: center c, right vector r (half width), up vector u (half height); faces r × u. */
function board(gb, c, r, u, uvr) {
  const V = (a, b) => new THREE.Vector3(c.x + r.x * a + u.x * b, c.y + r.y * a + u.y * b, c.z + r.z * a + u.z * b);
  gb.quad(V(-1, -1), V(1, -1), V(1, 1), V(-1, 1), uvr);
}

const CELL = (k, inset = 0.02) => {
  const cx = (k % 4) / 4, cy = 1 - (Math.floor(k / 4) + 1) / 2;
  return [cx + inset / 4, cy + inset / 2, cx + (1 - inset) / 4, cy + (1 - inset) / 2];
};

// ---------------------------------------------------------------- road sides

/**
 * Per side: 1 = cut face (terrain rises), 0 = guardrail. Smoothed with
 * hysteresis and a minimum run length. Also the cut face height per sample.
 */
function classifySides(track, M) {
  const N = track.N;
  const res = {};
  for (const sd of [1, -1]) {
    const rise = new Float32Array(N), riseFar = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      const W = track.W[i], ey = track.roadY(i, 0, sd * W);
      const at = (off) => M.raw(track.X[i] + track.LX[i] * sd * (W + off), track.Z[i] + track.LZ[i] * sd * (W + off)) - ey;
      rise[i] = Math.max(at(8), at(BENCH) - 1.5);
      riseFar[i] = at(BENCH + 12);
    }
    const sm = smooth(rise, 4, track.closed), smF = smooth(riseFar, 6, track.closed);
    const cls = new Uint8Array(N);
    let st = sm[0] > 2 ? 1 : 0;
    for (let i = 0; i < N; i++) {
      if (st === 0 && sm[i] > 2.6) st = 1;
      else if (st === 1 && sm[i] < 1.2) st = 0;
      cls[i] = st;
    }
    // drop runs shorter than 28 m
    for (let pass = 0; pass < 2; pass++) {
      let i = 0;
      while (i < N) {
        let j = i;
        while (j + 1 < N && cls[j + 1] === cls[i]) j++;
        if ((j - i + 1) * track.step < 28 && !(i === 0 && j === N - 1)) {
          const v = i > 0 ? cls[i - 1] : (j + 1 < N ? cls[j + 1] : cls[i]);
          for (let k = i; k <= j; k++) cls[k] = v;
        }
        i = j + 1;
      }
    }
    const H = new Float32Array(N);
    for (let i = 0; i < N; i++) H[i] = clamp(0.55 * smF[i] + 2.2, 2.4, 13);
    res[sd] = { cls, H: smooth(H, 5, track.closed), rise: sm };
  }
  return res;
}

function smooth(a, r, closed) {
  const n = a.length, out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    let s = 0, c = 0;
    for (let k = -r; k <= r; k++) {
      let j = i + k;
      if (closed) j = (j + n) % n; else if (j < 0 || j >= n) continue;
      s += a[j]; c++;
    }
    out[i] = s / c;
  }
  return out;
}

export async function build(world, def, track, progress) {
  const M = setupLand(def, track);
  const rng = makeRng('mtn' + def.id);
  const N = track.N;
  const sides = classifySides(track, M);
  const shed = shedInfo(def, track, sides);
  const lot = lotInfo(def, track, sides);
  // ---- walls follow the side treatment (eased so steps don't snag)
  for (const sd of [1, -1]) {
    const cls = sides[sd].cls;
    const off = new Float32Array(N);
    for (let i = 0; i < N; i++) off[i] = shed && shed.has(i) ? RAIL : cls[i] ? CUT : RAIL;
    const offS = smooth(off, 3, track.closed);
    const arr = sd > 0 ? track.WL : track.WR;
    for (let i = 0; i < N; i++) arr[i] = track.W[i] + offS[i];
  }
  track.shoulder = def.shoulder ?? 1.5;
  track.offSurface = def.offSurface || 'dirt';
  const ctx = { world, def, track, M, sides, shed, lot, rng, night: !!world.at.lamps };
  ctx.wallOf = (sd, i) => (sd > 0 ? track.WL[i] : track.WR[i]);
  ctx.edgeY = (sd, i) => track.roadY(i, 0, sd * track.W[i]);
  ctx.P = (i, lat, y) => [track.X[i] + track.LX[i] * lat, y, track.Z[i] + track.LZ[i] * lat];
  progress(0.05, 'SURVEYING THE CUTS');
  await nextFrame();

  if (lot) flattenLot(ctx);
  buildTerrain(ctx);
  progress(0.15, 'GRADING THE SLOPES');
  await nextFrame();
  buildShoulders(ctx);
  buildRails(ctx);
  progress(0.25, 'BOLTING GUARDRAIL');
  await nextFrame();
  buildFaces(ctx);
  if (shed) buildShed(ctx);
  progress(0.4, 'CUTTING ROCK');
  await nextFrame();
  buildForest(ctx);
  progress(0.65, 'PLANTING CEDARS');
  await nextFrame();
  buildSigns(ctx);
  buildLamps(ctx);
  buildPoles(ctx);
  if (lot) buildLot(ctx);
  progress(0.85, 'LIGHTING THE PASS');
  await nextFrame();
  farRanges(ctx);
  if (def.land?.town && ctx.night) townLights(ctx);
  progress(1, 'PASS READY');
}

// ---------------------------------------------------------------- terrain

function buildTerrain(ctx) {
  const { world, track, M, def } = ctx;
  const terrain = world.terrain;
  const tMat = new THREE.MeshStandardMaterial({ vertexColors: true, map: detailTex(), roughness: 0.97, metalness: 0 });
  ctx.tMat = tMat;
  const tMesh = terrain.mesh(tMat, { flat: '#334026', steep: '#5d574e' });
  const g = tMesh.geometry;
  const nx = terrain.nx, nz = terrain.nz;
  const pos = g.attributes.position;
  // per cell, the diagonal through the lower pair: the surface sags rather than bulging over the road shelf
  const idx = [];
  for (let j = 0; j < nz - 1; j++) {
    for (let i = 0; i < nx - 1; i++) {
      const a = j * nx + i, b = (j + 1) * nx + i, c = b + 1, d = a + 1;
      if (pos.getY(a) + pos.getY(c) < pos.getY(b) + pos.getY(d)) idx.push(a, b, c, a, c, d);
      else idx.push(a, b, d, b, c, d);
    }
  }
  g.setIndex(idx);
  g.computeVertexNormals();
  terrainColors(g, track, M, def);
  const uv = g.attributes.uv;
  const tw = (nx - 1) * terrain.cell / 9, th = (nz - 1) * terrain.cell / 9;
  for (let k = 0; k < uv.count; k++) uv.setXY(k, uv.getX(k) * tw, uv.getY(k) * th);
  world.add(tMesh);
}

// ---------------------------------------------------------------- shoulders + guardrail

function buildShoulders(ctx) {
  const { world, track, sides, wallOf } = ctx;
  const shMat = glowMaterial(new THREE.MeshStandardMaterial({ map: concreteTexture('#8a8780', 'mtn-gutter'), vertexColors: true, roughness: 0.92 }));
  const skirtMat = new THREE.MeshStandardMaterial({ color: 0x2c2a26, roughness: 1, side: THREE.DoubleSide });
  for (const sd of [1, -1]) {
    const cls = sides[sd].cls;
    const inner = { lat: (i) => sd * track.W[i], dy: 0.005, u: 0, flat: true };
    const outer = { lat: (i) => sd * (wallOf(sd, i) + 0.35), dy: (i) => (cls[i] ? -0.06 : 0.0), u: 0.5, flat: true };
    const m = stripMesh(track, sd > 0 ? [inner, outer] : [outer, inner], shMat, 4);
    const col = new Float32Array(m.geometry.attributes.position.count * 3);
    for (let r = 0; r < col.length / 6; r++) {
      const i = track.idx(r);
      const c = cls[i] && !(ctx.shed && ctx.shed.has(i)) ? [0.78, 0.77, 0.73] : [0.36, 0.36, 0.37];
      col.set(c, r * 6); col.set(c, r * 6 + 3);
    }
    m.geometry.setAttribute('color', new THREE.BufferAttribute(col, 3));
    world.add(m);
    world.glowMeshes.push(m);
    const skirt = stripMesh(track, [
      { lat: (i) => sd * (wallOf(sd, i) + 0.35), dy: -4, u: 0, flat: true },
      { lat: (i) => sd * (wallOf(sd, i) + 0.35), dy: 0, u: 1, flat: true },
    ], skirtMat, 4);
    world.add(skirt);
  }
}

function buildRails(ctx) {
  const { world, track, sides, wallOf, edgeY, P, shed, lot } = ctx;
  const rb = new Ribbon();
  const beam = [[0.1, 0.46], [0.0, 0.51], [0.0, 0.59], [0.07, 0.635], [0.0, 0.68], [0.0, 0.76], [0.1, 0.81]];
  const posts = [];
  ctx.railPosts = [];
  for (const sd of [1, -1]) {
    const cls = sides[sd].cls;
    const skip = (i) => (shed && shed.has(i)) || (lot && lot.side === sd && lot.has(i));
    for (const [a, b] of runsOf(track, (i) => !cls[i] && !skip(i))) {
      const rows = [];
      for (let r = a; r <= b; r++) {
        const i = track.idx(r);
        const fl = Math.max(0, 1 - Math.min(r - a, b - r) / 3);
        const lat0 = wallOf(sd, i) + fl * fl * 0.7;
        const y0 = edgeY(sd, i) - fl * 0.25;
        rows.push(beam.map(([dl, dy], k) => [...P(i, sd * (lat0 + dl), y0 + dy), r * track.step / 4, k / 6]));
        if ((r - a) % 2 === 0) {
          const [x, , z] = P(i, sd * (lat0 + 0.22), 0);
          posts.push({ x, y: y0 - 0.4, z });
          ctx.railPosts.push({ i, sd, x, y: y0, z, n: r - a });
        }
      }
      rb.run(sd > 0 ? rows : rows.map((row) => row.slice().reverse()));
    }
  }
  const railMat = new THREE.MeshStandardMaterial({ color: 0xdedbd2, roughness: 0.42, metalness: 0.35, side: THREE.DoubleSide });
  const rail = new THREE.Mesh(rb.build(), railMat);
  rail.castShadow = true;
  rail.receiveShadow = true;
  world.add(rail);
  const postGeo = new THREE.CylinderGeometry(0.07, 0.07, 1.25, 6);
  postGeo.translate(0, 0.625, 0);
  world.add(instanced(postGeo, new THREE.MeshStandardMaterial({ color: 0xc9c6bd, roughness: 0.5, metalness: 0.3 }), posts));
}

// ---------------------------------------------------------------- cut faces

function buildFaces(ctx) {
  const { world, track, def, sides, M, rng, wallOf, edgeY, P, shed } = ctx;
  const terrain = world.terrain;
  const kinds = [new Ribbon(), new Ribbon(), new Ribbon()];
  const cover = new Ribbon();
  const fn = M.land.noise;
  for (const sd of [1, -1]) {
    const { cls, H } = sides[sd];
    for (const [a, b] of runsOf(track, (i) => cls[i] && !(shed && shed.has(i)))) {
      const kind = (b - a) * track.step > 60 ? Math.floor(rng() * 3) : 0;
      const faceRows = [], coverRows = [];
      for (let r = a; r <= b; r++) {
        const i = track.idx(r);
        const s = r * track.step;
        const taper = smoothstep(0, 5, Math.min(r - a, b - r));
        const n1 = fn(s / 9 + sd * 3, 1.3), n2 = fn(s / 5 + 7, 2.1 + sd);
        const h = (H[i] * (kind === 0 ? 0.85 + 0.3 * (n1 + 0.5) : 1)) * (0.25 + 0.75 * taper);
        const lat0 = wallOf(sd, i);
        const y0 = edgeY(sd, i);
        const j = (k) => (kind === 0 ? fn(s / 4 + k * 1.7, k + sd * 5) * 0.5 : 0);
        const lean = kind === 1 ? 0.75 : kind === 2 ? 0.55 : 0.32;
        const prof = [[-0.05, -0.9], [0, 0], [h * lean * 0.3 + j(1), h * 0.3], [h * lean * 0.62 + j(2), h * 0.62], [h * lean * 0.9 + j(3), h * 0.9], [h * lean + 0.2, h]];
        let v = 0;
        faceRows.push(prof.map(([dl, dy], k) => {
          if (k) v += Math.hypot(dl - prof[k - 1][0], dy - prof[k - 1][1]);
          return [...P(i, sd * (lat0 + dl), y0 + dy), s / 4, v / 4];
        }));
        coverRows.push(coverRow(ctx, i, sd, lat0 + h * lean + 0.2, y0 + h, n2));
      }
      const flip = (rows) => (sd > 0 ? rows : rows.map((row) => row.slice().reverse()));
      kinds[kind].run(flip(faceRows));
      cover.run(flip(coverRows));
    }
  }
  const mats = [
    new THREE.MeshStandardMaterial({ map: rockTex(), color: 0xb0a89c, roughness: 0.95 }),
    new THREE.MeshStandardMaterial({ map: latticeTex(), roughness: 0.9 }),
    new THREE.MeshStandardMaterial({ map: shotcreteTex(), roughness: 0.88 }),
  ];
  kinds.forEach((kb, k) => {
    if (!kb.count) return;
    const m = new THREE.Mesh(kb.build(), mats[k]);
    m.receiveShadow = true;
    m.castShadow = true;
    world.add(m);
  });
  if (cover.count) {
    const m = new THREE.Mesh(cover.build(), ctx.tMat);
    m.receiveShadow = true;
    world.add(m);
  }
  void terrain; void def;
}

/** Ground from a crest (lat, y) back to where the carved terrain meets the landform again. */
function coverRow(ctx, i, sd, crest, yTop, wob = 0) {
  const { world, track, def, P } = ctx;
  const terrain = world.terrain;
  const far = track.W[i] + BENCH + 12.5;
  const [fx, , fz] = P(i, sd * far, 0);
  const yFar = terrain.heightAt(fx, fz) - 0.6;
  const row = [];
  const NCV = 6;
  for (let k = 0; k <= NCV; k++) {
    const t = k / NCV;
    const lat = crest + (far - crest) * t;
    const [x, , z] = P(i, sd * lat, 0);
    const e = t * t * (3 - 2 * t);
    let y = yTop * (1 - e) + yFar * e + wob * 0.8 * Math.sin(t * Math.PI);
    if (k < NCV) y = Math.max(y, terrain.heightAt(x, z) + 0.4);
    row.push([x, y, z, x / 9, z / 9, coverColor(t, y, def)]);
  }
  return row;
}

/** Inside the rock shed (def.shed = [s0, s1])? */
function inShed(def, track, i) {
  if (!def.shed) return false;
  const s = i * track.step;
  return s >= def.shed[0] && s <= def.shed[1];
}

// ---------------------------------------------------------------- colors

const COL = {
  forest: new THREE.Color('#2f3b22'), forest2: new THREE.Color('#3a4526'), autumn: new THREE.Color('#5c4526'),
  rock: new THREE.Color('#5f5a52'), fill: new THREE.Color('#5a4f39'), snow: new THREE.Color('#dfe4ea'),
  gravel: new THREE.Color('#45423c'), grass: new THREE.Color('#4a5530'),
};
const _c = new THREE.Color();

function coverColor(t, y, def) {
  _c.copy(COL.rock).lerp(COL.forest2, smoothstep(0.15, 0.6, t));
  const snow = def.land?.snow;
  if (snow && y > snow) _c.lerp(COL.snow, smoothstep(snow, snow + 60, y) * 0.8);
  return [_c.r, _c.g, _c.b];
}

function terrainColors(g, track, M, def) {
  const pos = g.attributes.position, nor = g.attributes.normal;
  const col = new Float32Array(pos.count * 3);
  const noise = M.land.noise;
  const snow = def.land?.snow ?? 1e9;
  const autumn = def.time === 'dusk' || def.time === 'sunset';
  for (let k = 0; k < pos.count; k++) {
    const x = pos.getX(k), y = pos.getY(k), z = pos.getZ(k);
    const ny = nor.getY(k);
    const n1 = noise(x / 90 + 11, z / 90 - 4), n2 = noise(x / 23, z / 23 + 9);
    _c.copy(COL.forest).lerp(COL.forest2, clamp(0.5 + n1 * 1.4, 0, 1));
    if (autumn) _c.lerp(COL.autumn, smoothstep(0.15, 0.45, noise(x / 160 - 3, z / 160 + 5)) * 0.8);
    // near the road: fill slopes of earth and dry grass, gravel bench
    const i = M.nearest(x, z);
    if (i >= 0) {
      const d = Math.hypot(x - track.X[i], z - track.Z[i]) - track.W[i];
      const below = y < track.Y[i] - 1.5;
      if (below) _c.lerp(COL.fill, smoothstep(26, 6, d) * 0.75);
      else _c.lerp(COL.grass, smoothstep(30, 10, d) * 0.5);
      _c.lerp(COL.gravel, smoothstep(5, 1.5, d));
    }
    const steep = smoothstep(0.8, 0.6, ny + n2 * 0.08);
    _c.lerp(COL.rock, steep);
    const sn = smoothstep(snow - 40, snow + 30, y + n1 * 60) * (1 - smoothstep(0.72, 0.5, ny) * 0.7);
    _c.lerp(COL.snow, sn);
    const j = 0.9 + n2 * 0.2;
    col[k * 3] = _c.r * j; col[k * 3 + 1] = _c.g * j; col[k * 3 + 2] = _c.b * j;
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
}

export default { natural, terrainOpts, build };
