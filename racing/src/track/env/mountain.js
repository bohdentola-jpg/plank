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
  const roadDist = (x, z) => {
    const gx = Math.floor(x / C), gz = Math.floor(z / C);
    let bd = R2;
    for (let dx = -rc; dx <= rc; dx++) {
      for (let dz = -rc; dz <= rc; dz++) {
        const list = grid.get(gkey(gx + dx, gz + dz));
        if (list) for (const k of list) bd = Math.min(bd, (sx[k] - x) ** 2 + (sz[k] - z) ** 2);
      }
    }
    return Math.sqrt(bd);
  };
  track.mtn = { land, corr, raw, carved, nearest, roadDist };
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

/** Cut rock: strata, blocky joints with lit and shadowed facets, water stains, moss. 8 m tile. */
function rockTex() {
  return canvasTex('mtn-rock', 512, 512, (x, w, h, rng, wrap) => {
    x.fillStyle = '#6e675e';
    x.fillRect(0, 0, w, h);
    let y = 0;
    while (y < h) {
      const th = 14 + rng() * 52, tone = 78 + rng() * 70, ph = rng() * 6.28, amp = 3 + rng() * 7;
      x.fillStyle = `rgba(${tone | 0},${(tone - 8) | 0},${(tone - 17) | 0},0.7)`;
      x.beginPath();
      for (let k = 0; k <= 32; k++) x.lineTo(k * w / 32, y + Math.sin(k / 32 * 6.283 * 2 + ph) * amp);
      for (let k = 32; k >= 0; k--) x.lineTo(k * w / 32, y + th + Math.sin(k / 32 * 6.283 * 3 + ph) * amp);
      x.closePath();
      x.fill();
      x.strokeStyle = 'rgba(20,16,12,0.65)';
      x.lineWidth = 2.5;
      x.beginPath();
      for (let k = 0; k <= 32; k++) x.lineTo(k * w / 32, y + th + Math.sin(k / 32 * 6.283 * 3 + ph) * amp);
      x.stroke();
      y += th;
    }
    // blocks: lit top-left facets, shadowed bottom-right
    for (let i = 0; i < 70; i++) {
      const px = rng() * w, py = rng() * h, bw = 24 + rng() * 70, bh = 18 + rng() * 50;
      wrap((dx, dy) => {
        x.fillStyle = 'rgba(205,195,180,0.16)';
        x.beginPath(); x.moveTo(px + dx, py + dy); x.lineTo(px + dx + bw, py + dy + 6); x.lineTo(px + dx + bw * 0.8, py + dy + bh * 0.4); x.lineTo(px + dx + 4, py + dy + bh * 0.5); x.closePath(); x.fill();
        x.fillStyle = 'rgba(10,8,6,0.32)';
        x.beginPath(); x.moveTo(px + dx + 4, py + dy + bh * 0.5); x.lineTo(px + dx + bw * 0.8, py + dy + bh * 0.4); x.lineTo(px + dx + bw * 0.9, py + dy + bh); x.lineTo(px + dx, py + dy + bh * 0.95); x.closePath(); x.fill();
      });
    }
    x.strokeStyle = 'rgba(12,10,8,0.75)';
    for (let i = 0; i < 60; i++) {
      const px = rng() * w, py = rng() * h, l = 30 + rng() * 90, a = Math.PI / 2 + (rng() - 0.5) * 0.9;
      x.lineWidth = 1.5 + rng() * 3;
      wrap((dx, dy) => { x.beginPath(); x.moveTo(px + dx, py + dy); x.lineTo(px + dx + Math.cos(a) * l, py + dy + Math.sin(a) * l); x.stroke(); });
    }
    for (let i = 0; i < 26; i++) {
      const px = rng() * w, py = rng() * h * 0.6, ww = 4 + rng() * 16, hh = 60 + rng() * 220;
      const g = x.createLinearGradient(0, py, 0, py + hh);
      g.addColorStop(0, 'rgba(12,10,8,0.42)');
      g.addColorStop(1, 'rgba(12,10,8,0)');
      x.fillStyle = g;
      wrap((dx) => x.fillRect(px + dx, py, ww, hh));
    }
    blot(x, wrap, rng, w, h, 22, '46,64,26', 10, 44, 0.5);
    speckle(x, w, h, rng, 16000, '230,225,215', '0,0,0', 1.8);
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
    for (let i = 0; i < N; i++) H[i] = clamp(0.45 * smF[i] + 2.0, 2.2, 10.5);
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
  const beam = [[0.1, 0.46], [0.0, 0.53], [0.07, 0.635], [0.0, 0.74], [0.1, 0.81]];
  const posts = [];
  ctx.railPosts = [];
  for (const sd of [1, -1]) {
    const cls = sides[sd].cls;
    const skip = (i) => (shed && shed.has(i)) || (lot && lot.side === sd && lot.has(i));
    for (const [a, b] of runsOf(track, (i) => !cls[i] && !skip(i))) {
      const rows = [];
      for (let r = a; r <= b; r++) {
        const i = track.idx(r);
        if ((r - a) % 2 && r > a + 3 && r < b - 3 && Math.abs(track.K[i]) < 1 / 60) continue;
        const fl = Math.max(0, 1 - Math.min(r - a, b - r) / 3);
        const lat0 = wallOf(sd, i) + fl * fl * 0.7;
        const y0 = edgeY(sd, i) - fl * 0.25;
        rows.push(beam.map(([dl, dy], k) => [...P(i, sd * (lat0 + dl), y0 + dy), r * track.step / 4, k / 4]));
        if ((r - a) % 2 === 0 || r === b) {
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
  const postGeo = new THREE.CylinderGeometry(0.07, 0.07, 1.25, 5, 1, true);
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
      const q = rng(), kind = (b - a) * track.step > 60 ? (q < 0.5 ? 0 : q < 0.75 ? 1 : 2) : 0;
      const faceRows = [], coverRows = [];
      for (let r = a; r <= b; r++) {
        if ((r - a) % 2 && r < b - 2 && r > a + 2) continue;
        const i = track.idx(r);
        const s = r * track.step;
        const ea = shed && shed.has(track.idx(a - 1)) ? 9 : r - a, eb = shed && shed.has(track.idx(b + 1)) ? 9 : b - r;
        const taper = smoothstep(0, 5, Math.min(ea, eb));
        const n1 = fn(s / 9 + sd * 3, 1.3), n2 = fn(s / 5 + 7, 2.1 + sd);
        const portal = shed && Math.min(Math.abs(i - shed.i0), Math.abs(i - shed.i1)) < 8;
        const slow = fn(s / 38 + sd * 2.7, 4.2 + kind);
        const h = (portal ? Math.max(H[i], 9) : H[i]) * (0.78 + 0.5 * (slow + 0.4)) * (kind === 0 ? 0.9 + 0.25 * (n1 + 0.5) : 1) * (0.25 + 0.75 * taper);
        const lat0 = wallOf(sd, i);
        const y0 = edgeY(sd, i);
        const j = (k) => (kind === 0 ? fn(s / 2.6 + k * 1.7, k + sd * 5) * 0.9 + fn(s / 11 + k, 3 - sd) * 0.8 : 0);
        const tone = 0.62 + 0.4 * clamp(fn(s / 13 + 5, sd * 1.9 + kind) + 0.5, 0, 1);
        const moss = kind !== 2 ? smoothstep(0.1, 0.35, fn(s / 21 - 3, 7 + sd)) : 0;
        const rc = (k, n) => {
          const t = k / (n - 1), d = (0.72 + 0.28 * t) * tone;
          return [d * (1 - moss * 0.25), d * (1 - moss * 0.05), d * (1 - moss * 0.35)];
        };
        const lean = kind === 1 ? 0.7 : kind === 2 ? 0.5 : 0.3;
        // tall cuts get a bench halfway up
        const bench = smoothstep(6, 8, h) * 1.4;
        const hb = h * 0.5, xb = h * lean * 0.5;
        const prof = [[-0.05, -0.9], [0, 0], [xb * 0.5 + j(1), hb * 0.5], [xb + j(2), hb], [xb + bench, hb + 0.1 * bench], [xb + bench + h * lean * 0.25 + j(3), hb + h * 0.25], [h * lean + bench + 0.2, h]];
        let v = 0;
        faceRows.push(prof.map(([dl, dy], k) => {
          if (k) v += Math.hypot(dl - prof[k - 1][0], dy - prof[k - 1][1]);
          return [...P(i, sd * (lat0 + dl), y0 + dy), s / 4, v / 4, rc(k, prof.length)];
        }));
        coverRows.push(coverRow(ctx, i, sd, lat0 + h * lean + bench + 0.2, y0 + h, n2));
      }
      const flip = (rows) => (sd > 0 ? rows : rows.map((row) => row.slice().reverse()));
      kinds[kind].run(flip(faceRows));
      cover.run(flip(coverRows));
    }
  }
  const mats = [
    new THREE.MeshStandardMaterial({ map: rockTex(), color: 0x9c958a, vertexColors: true, roughness: 0.95 }),
    new THREE.MeshStandardMaterial({ map: latticeTex(), color: 0xc8c8c8, vertexColors: true, roughness: 0.9 }),
    new THREE.MeshStandardMaterial({ map: shotcreteTex(), color: 0xb4b4b4, vertexColors: true, roughness: 0.88 }),
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


// ---------------------------------------------------------------- rock shed

/** def.shed = [s0, s1]: a concrete gallery against the mountain side. */
function shedInfo(def, track, sides) {
  if (!def.shed) return null;
  const i0 = Math.round(def.shed[0] / track.step), i1 = Math.round(def.shed[1] / track.step);
  let rl = 0, rr = 0;
  for (let i = i0; i <= i1; i++) { rl += sides[1].rise[i]; rr += sides[-1].rise[i]; }
  const sd = rl >= rr ? 1 : -1;
  for (let i = i0 - 10; i <= i1 + 10; i++) sides[sd].cls[track.idx(i)] = 1;
  for (let i = i0; i <= i1; i++) sides[-sd].cls[track.idx(i)] = 0;
  return { i0, i1, sd, has: (i) => i >= i0 && i <= i1 };
}

function buildShed(ctx) {
  const { world, track, shed, wallOf, edgeY, P } = ctx;
  const sd = shed.sd;
  const ROOF = 6.4;
  const mat = new THREE.MeshStandardMaterial({ map: concreteTexture('#a29f96', 'mtn-shed'), roughness: 0.85, flatShading: true, side: THREE.DoubleSide });
  const wall = new Ribbon(), roof = new Ribbon(), para = new Ribbon(), cover = new Ribbon();
  const gb = new GeoBuilder();
  const fix = new GeoBuilder();
  const wallRows = [], roofRows = [], paraRows = [], coverRows = [];
  let caps = [];
  for (let r = shed.i0; r <= shed.i1; r++) {
    const i = track.idx(r);
    const s = r * track.step;
    const latM = wallOf(sd, i), latV = wallOf(-sd, i);
    const yM = edgeY(sd, i), yV = edgeY(-sd, i);
    const yU = yM + ROOF, yUv = yV + ROOF - 0.3;
    wallRows.push([[...P(i, sd * latM, yM - 0.6), s / 4, 0], [...P(i, sd * latM, yU + 0.2), s / 4, ROOF / 4]]);
    const sec = [[sd * (latM + 0.8), yU + 1.2], [sd * latM, yU], [-sd * (latV + 0.75), yUv], [-sd * (latV + 0.75), yUv + 1.1], [sd * (latM + 0.8), yU + 1.2]];
    const row = sec.map(([lat, y], k) => [...P(i, lat, y), s / 4, k * 0.6]);
    roofRows.push(row);
    if (r === shed.i0 || r === shed.i1) caps.push(row);
    paraRows.push([[-0.0, -0.4], [0, 0.95], [0.3, 0.95], [0.3, -0.6]].map(([dl, dy], k) => [...P(i, -sd * (latV + dl), yV + dy), s / 4, k * 0.3]));
    coverRows.push(coverRow(ctx, i, sd, latM + 0.8, yU + 1.2, 0));
    const k = r - shed.i0;
    if (k % 3 === 0) {
      const [x, , z] = P(i, -sd * (latV + 0.45), 0);
      gb.box(x, yV - 0.6, z, 0.75, ROOF + 0.5, 0.75, Math.atan2(track.TX[i], track.TZ[i]), { uw: 4, uh: 4 });
    }
    if (k % 6 === 3) {
      const [x, , z] = P(i, sd * 1.0, 0);
      const y = track.roadY(i, 0, sd * 1.0) + ROOF - 0.15;
      fix.box(x, y - 0.18, z, 0.5, 0.18, 1.1, Math.atan2(track.TX[i], track.TZ[i]));
      world.addLamp(x, y - 0.3, z, '#ffaa4a', 12, 1.6);
    }
  }
  const flip = (rows) => (sd > 0 ? rows : rows.map((row) => row.slice().reverse()));
  wall.run(flip(wallRows));
  roof.run(roofRows);
  para.run(paraRows);
  cover.run(flip(coverRows));
  for (const rb of [wall, roof, para]) {
    const m = new THREE.Mesh(rb.build(), mat);
    m.castShadow = true;
    m.receiveShadow = true;
    world.add(m);
  }
  for (const row of caps) {
    const v = row.map((p) => new THREE.Vector3(p[0], p[1], p[2]));
    gb.quad(v[0], v[1], v[2], v[3]);
  }
  const pm = new THREE.Mesh(gb.build(), mat);
  pm.castShadow = true;
  world.add(pm);
  const cm = new THREE.Mesh(cover.build(), ctx.tMat);
  cm.receiveShadow = true;
  world.add(cm);
  if (fix.count) world.add(new THREE.Mesh(fix.build(), new THREE.MeshStandardMaterial({ color: 0x222222, emissive: new THREE.Color('#ffaa4a'), emissiveIntensity: ctx.night ? 2.4 : 0.6 })));
}

// ---------------------------------------------------------------- viewpoint lot

/** def.viewpoint = { s, len, depth }: a paved lookout beside the road on the valley side. */
function lotInfo(def, track, sides) {
  const v = def.viewpoint;
  if (!v) return null;
  const i0 = Math.round((v.s - v.len / 2) / track.step), i1 = Math.round((v.s + v.len / 2) / track.step);
  let rl = 0, rr = 0;
  for (let i = i0; i <= i1; i++) { rl += sides[1].rise[track.idx(i)]; rr += sides[-1].rise[track.idx(i)]; }
  const sd = v.side ?? (rl <= rr ? 1 : -1);
  for (let i = i0 - 6; i <= i1 + 6; i++) sides[sd].cls[track.idx(i)] = 0;
  return { i0, i1, sd, side: sd, depth: v.depth ?? 18, has: (i) => i >= i0 && i <= i1 };
}

/** Level the terrain grid under the lot (the embankment falls away from its edges). */
function flattenLot(ctx) {
  const { world, track, lot, M } = ctx;
  const T = world.terrain;
  for (let j = 0; j < T.nz; j++) {
    for (let k = 0; k < T.nx; k++) {
      const x = T.x0 + k * T.cell, z = T.z0 + j * T.cell;
      const i = M.nearest(x, z);
      if (i < 0) continue;
      const lat = ((x - track.X[i]) * track.LX[i] + (z - track.Z[i]) * track.LZ[i]) * lot.sd;
      if (lat < 0) continue;
      const ds = Math.max(lot.i0 - i, 0, i - lot.i1) * track.step;
      const out = Math.max(ds, lat - track.W[i] - lot.depth);
      const m = 1 - smoothstep(4, 16, out);
      if (m <= 0) continue;
      const y = track.roadY(i, 0, lot.sd * track.W[i]) - 0.4;
      const q = j * T.nx + k;
      T.H[q] += (y - T.H[q]) * m;
    }
  }
}

function lotTex() {
  return canvasTex('mtn-lot', 128, 128, (x, w, h, rng) => {
    x.fillStyle = '#3a3b3d';
    x.fillRect(0, 0, w, h);
    speckle(x, w, h, rng, 4000, '200,200,200', '0,0,0', 1.3);
    x.fillStyle = 'rgba(225,225,215,0.8)';
    x.fillRect(0, h * 0.08, 4, h * 0.8);
  });
}

function buildLot(ctx) {
  const { world, track, lot, P, edgeY, wallOf, night, def } = ctx;
  const sd = lot.sd;
  const surf = new Ribbon();
  const rows = [];
  for (let r = lot.i0; r <= lot.i1; r++) {
    const i = track.idx(r);
    const y = edgeY(sd, i) + 0.02;
    const row = [];
    for (let k = 0; k <= 4; k++) {
      const lat = wallOf(sd, i) + 0.35 + (lot.depth - RAIL - 0.35) * k / 4;
      row.push([...P(i, sd * lat, y), r * track.step / 2.5, (lat - track.W[i] - RAIL - 0.6) / 5.5]);
    }
    rows.push(row);
  }
  surf.run(sd > 0 ? rows : rows.map((row) => row.slice().reverse()));
  const g = surf.build();
  g.setAttribute('glow', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 3), 3));
  const lt = lotTex();
  const lm = new THREE.Mesh(g, glowMaterial(new THREE.MeshStandardMaterial({ map: lt, roughness: 0.9 })));
  lm.receiveShadow = true;
  world.add(lm);
  world.glowMeshes.push(lm);

  // local frame helpers: (s along the lot, d meters out from the road edge)
  const at = (s, d) => {
    const i = track.idx(Math.round(s / track.step));
    const [x, , z] = P(i, sd * (track.W[i] + d), 0);
    return { x, z, y: edgeY(sd, i), i, ry: Math.atan2(track.TX[i], track.TZ[i]) };
  };
  const s0 = lot.i0 * track.step, s1 = lot.i1 * track.step;
  const col = new GeoBuilder();
  const C = (hex) => { const c = new THREE.Color(hex); col.setColor(c.r, c.g, c.b); };
  // road-side curb with white bollards; railing along the drop
  for (let s = s0; s <= s1; s += 2.5) {
    const a = at(s, RAIL + 0.15);
    C('#9a978f');
    col.box(a.x, a.y - 0.1, a.z, 0.35, 0.3, 2.5, a.ry);
    if (Math.round((s - s0) / 2.5) % 2 === 0) { C('#e8e8e2'); col.cylinder(a.x, a.y, a.z, 0.09, 0.85, 6); }
    const o = at(s, lot.depth + 0.2);
    C('#cfcbc0');
    col.box(o.x, o.y - 0.2, o.z, 0.12, 1.25, 0.12, o.ry);
    col.box(o.x, o.y + 0.95, o.z, 0.08, 0.08, 2.5, o.ry);
    col.box(o.x, o.y + 0.5, o.z, 0.06, 0.06, 2.5, o.ry);
  }
  // rest hut with vending machines in front, at the far end
  const hutS = s1 - 6, hut = at(hutS, lot.depth - 4.2);
  C('#8e8b84');
  col.box(hut.x, hut.y, hut.z, 6.5, 3.1, 4.0, hut.ry);
  C('#4a4744');
  col.box(hut.x, hut.y + 3.1, hut.z, 7.4, 0.25, 4.8, hut.ry);
  const win = new GeoBuilder();
  {
    // lit window + door on the face toward the lot start
    const i = hut.i;
    const tx = track.TX[i], tz = track.TZ[i];
    const lx = track.LX[i] * sd, lz = track.LZ[i] * sd;
    const fx = hut.x - tx * 3.27, fz = hut.z - tz * 3.27;
    const V = (dl, y) => new THREE.Vector3(fx + lx * dl, hut.y + y, fz + lz * dl);
    win.quad(V(-1.6, 1.0), V(-0.2, 1.0), V(-0.2, 2.1), V(-1.6, 2.1));
    C('#222222');
    col.quad(V(0.6, 0.0), V(1.6, 0.0), V(1.6, 2.2), V(0.6, 2.2));
  }
  // vending machines (front faces the road)
  const vend = [new GeoBuilder(), new GeoBuilder()];
  for (let k = 0; k < 3; k++) {
    const a = at(hutS - 1.2 + k * 1.15, lot.depth - 7.0);
    const i = a.i;
    const fwd = [-track.LX[i] * sd, -track.LZ[i] * sd];
    const ry = Math.atan2(fwd[0], fwd[1]);
    vendBox(vend[k % 2], a.x, a.y, a.z, ry);
    if (k === 1) world.addLamp(a.x + fwd[0] * 1.2, a.y + 1.5, a.z + fwd[1] * 1.2, '#e6f0ff', 9, night ? 1.7 : 0.3);
  }
  ['#c8202a', '#e8eef2'].forEach((body, k) => {
    const t = vendingTex(body, k ? 'COLD & HOT' : 'DRINKS');
    const m = new THREE.Mesh(vend[k].build(), new THREE.MeshStandardMaterial({ map: t.map, emissive: 0xffffff, emissiveMap: t.emi, emissiveIntensity: night ? 1.5 : 0.15, roughness: 0.5 }));
    world.add(m);
  });
  // kei truck in a stall, nose to the view
  {
    const a = at((s0 + s1) / 2 - 4, lot.depth - 5.5);
    const i = a.i;
    keiTruck(col, a.x, a.y, a.z, Math.atan2(track.LX[i] * sd, track.LZ[i] * sd), C);
  }
  // roadside shrine: torii, hokora, two stone lanterns
  {
    const a = at(s0 + 6, lot.depth - 4.5);
    const i = a.i;
    const ry = Math.atan2(-track.LX[i] * sd, -track.LZ[i] * sd);
    shrine(col, a.x, a.y, a.z, ry, C, (x, y, z) => world.addLamp(x, y, z, '#ffb070', 4, night ? 0.9 : 0));
  }
  const pm = new THREE.Mesh(col.build(true), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.75, metalness: 0.05 }));
  pm.castShadow = true;
  pm.receiveShadow = true;
  world.add(pm);
  if (win.count) world.add(new THREE.Mesh(win.build(), new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffd9a0').multiplyScalar(night ? 1.6 : 0.5) })));
  // one lamp over the lot
  lampPost(ctx, [{ s: (s0 + s1) / 2 + 8, sd, off: lot.depth - 1.0, color: def.lampColor || '#ffb35a' }]);
  void def;
}

/** Vending machine body (1.0 × 1.83 × 0.8) with the textured front toward ry. */
function vendBox(gb, x, y, z, ry) {
  const c = Math.cos(ry), s = Math.sin(ry);
  const P = (lx, ly, lz) => new THREE.Vector3(x + lx * c + lz * s, y + ly, z - lx * s + lz * c);
  const w = 0.5, d = 0.4, h = 1.83;
  const plain = [0.02, 0.95, 0.06, 0.98];
  gb.quad(P(-w, 0, d), P(w, 0, d), P(w, h, d), P(-w, h, d), [0, 0, 1, 1]);
  gb.quad(P(w, 0, -d), P(-w, 0, -d), P(-w, h, -d), P(w, h, -d), plain);
  gb.quad(P(w, 0, d), P(w, 0, -d), P(w, h, -d), P(w, h, d), plain);
  gb.quad(P(-w, 0, -d), P(-w, 0, d), P(-w, h, d), P(-w, h, -d), plain);
  gb.quad(P(-w, h, d), P(w, h, d), P(w, h, -d), P(-w, h, -d), plain);
}

/** Cab-over kei pickup, nose along ry. */
function keiTruck(gb, x, y, z, ry, C) {
  const c = Math.cos(ry), s = Math.sin(ry);
  const at = (lx, lz) => [x + lx * c + lz * s, z - lx * s + lz * c];
  const box = (lx, ly, lz, w, h, d) => { const [px, pz] = at(lx, lz); gb.box(px, y + ly, pz, w, h, d, ry); };
  C('#ecebe6');
  box(0, 0.45, 1.0, 1.4, 1.25, 1.3);       // cab
  box(0, 0.62, -0.75, 1.4, 0.1, 2.0);      // bed floor
  box(0.66, 0.72, -0.75, 0.06, 0.32, 2.0); // gates
  box(-0.66, 0.72, -0.75, 0.06, 0.32, 2.0);
  box(0, 0.72, -1.72, 1.4, 0.32, 0.06);
  box(0, 0.72, 0.31, 1.4, 0.55, 0.06);
  C('#1b1e22');
  box(0, 1.15, 1.66, 1.25, 0.5, 0.02);     // windshield
  box(0.71, 1.2, 1.05, 0.02, 0.4, 0.8);    // side windows
  box(-0.71, 1.2, 1.05, 0.02, 0.4, 0.8);
  box(0, 0.3, 1.66, 1.42, 0.16, 0.06);     // bumper
  C('#111111');
  for (const [lx, lz] of [[0.6, 1.05], [-0.6, 1.05], [0.6, -1.1], [-0.6, -1.1]]) box(lx, 0, lz, 0.2, 0.52, 0.52);
  C('#ff9a20');
  box(0.55, 0.62, 1.67, 0.18, 0.1, 0.02);
  box(-0.55, 0.62, 1.67, 0.18, 0.1, 0.02);
}

/** Small roadside shrine facing ry: torii, hokora on a stone base, two stone lanterns. */
function shrine(gb, x, y, z, ry, C, light) {
  const c = Math.cos(ry), s = Math.sin(ry);
  const at = (lx, lz) => [x + lx * c + lz * s, z - lx * s + lz * c];
  const box = (lx, ly, lz, w, h, d) => { const [px, pz] = at(lx, lz); gb.box(px, y + ly, pz, w, h, d, ry); };
  const cyl = (lx, ly, lz, r, h, seg = 8, r2 = r) => { const [px, pz] = at(lx, lz); gb.cylinder(px, y + ly, pz, r, h, seg, r2); };
  // torii (in front, toward the lot)
  C('#c2381f');
  cyl(-0.95, 0, 2.6, 0.12, 2.5);
  cyl(0.95, 0, 2.6, 0.12, 2.5);
  box(0, 1.95, 2.6, 2.2, 0.14, 0.14);
  box(0, 2.38, 2.6, 2.7, 0.16, 0.26);
  C('#1a1614');
  box(0, 2.54, 2.6, 2.9, 0.1, 0.3);
  // hokora
  C('#8d8a82');
  box(0, 0, 0, 1.3, 0.55, 1.0);
  C('#5a3a22');
  box(0, 0.55, 0, 0.8, 0.75, 0.65);
  C('#2a2522');
  box(0, 1.3, 0, 1.15, 0.12, 0.95);
  box(0, 1.42, 0, 0.75, 0.12, 0.85);
  C('#e8e2d0');
  box(0, 0.75, 0.33, 0.3, 0.4, 0.02);
  // stone lanterns
  for (const sx of [-1.7, 1.7]) {
    C('#8f8c84');
    box(sx, 0, 1.4, 0.55, 0.22, 0.55);
    cyl(sx, 0.22, 1.4, 0.12, 0.75, 8);
    box(sx, 0.97, 1.4, 0.48, 0.1, 0.48);
    C('#d8c79a');
    box(sx, 1.07, 1.4, 0.34, 0.32, 0.34);
    C('#86837b');
    cyl(sx, 1.39, 1.4, 0.42, 0.3, 4, 0.04);
    box(sx, 1.68, 1.4, 0.08, 0.14, 0.08);
    const [lx, lz] = at(sx, 1.4);
    light(lx, y + 1.2, lz);
  }
}

// ---------------------------------------------------------------- forest

function coniferGeo() {
  const p = [], c = [];
  const col = (hex, k = 1) => { const q = new THREE.Color(hex); return [q.r * k, q.g * k, q.b * k]; };
  const tri = (a, b, d, ca, cb, cd) => { p.push(...a, ...b, ...d); c.push(...ca, ...cb, ...cd); };
  const trunk = col('#3a2a1e');
  for (let k = 0; k < 3; k++) {
    const a0 = k / 3 * Math.PI * 2, a1 = (k + 1) / 3 * Math.PI * 2;
    const A = [Math.cos(a0) * 0.36, -0.8, Math.sin(a0) * 0.36], B = [Math.cos(a1) * 0.36, -0.8, Math.sin(a1) * 0.36];
    const C2 = [Math.cos(a1) * 0.2, 3.4, Math.sin(a1) * 0.2], D = [Math.cos(a0) * 0.2, 3.4, Math.sin(a0) * 0.2];
    tri(A, C2, B, trunk, trunk, trunk);
    tri(A, D, C2, trunk, trunk, trunk);
  }
  const lo = col('#132018'), hi = col('#31482a');
  for (const [yb, ya, r, ph] of [[2.4, 9.2, 3.0, 0], [5.8, 12.2, 2.35, 0.4], [9.0, 14.8, 1.55, 0.9]]) {
    const seg = 8;
    const rad = (k) => r * (k % 2 ? 0.78 : 1.0 + ((k * 7) % 3) * 0.06);
    const drop = (k) => (k % 2 ? 0.1 : -0.45);
    for (let k = 0; k < seg; k++) {
      const a0 = (k + ph) / seg * Math.PI * 2, a1 = (k + 1 + ph) / seg * Math.PI * 2;
      const B0 = [Math.cos(a0) * rad(k), yb + drop(k), Math.sin(a0) * rad(k)], B1 = [Math.cos(a1) * rad(k + 1), yb + drop(k + 1), Math.sin(a1) * rad(k + 1)];
      tri(B0, [0, ya, 0], B1, lo, hi, lo);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(c, 3));
  g.computeVertexNormals();
  return g;
}

/** Far-LOD conifer: one jagged cone. */
function coniferFarGeo() {
  const p = [], c = [];
  const lo = new THREE.Color('#132018'), hi = new THREE.Color('#2c4226');
  for (let k = 0; k < 6; k++) {
    const a0 = k / 6 * Math.PI * 2, a1 = (k + 1) / 6 * Math.PI * 2;
    p.push(Math.cos(a0) * 2.9, 1.2, Math.sin(a0) * 2.9, 0, 14.8, 0, Math.cos(a1) * 2.9, 1.2, Math.sin(a1) * 2.9);
    c.push(lo.r, lo.g, lo.b, hi.r, hi.g, hi.b, lo.r, lo.g, lo.b);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(c, 3));
  g.computeVertexNormals();
  return g;
}

/** Far-LOD broadleaf: two crossed leaf cards. */
function broadleafFarGeo() {
  const g = new THREE.BufferGeometry();
  const cy = 5.6, R = 3.1, H = 3.2;
  const p = [], uv = [], n = [];
  for (const a of [0.3, 0.3 + Math.PI / 2]) {
    const dx = Math.cos(a) * R, dz = Math.sin(a) * R;
    const v = [[-dx, cy - H, -dz, 0, 0.06], [dx, cy - H, dz, 1, 0.06], [dx, cy + H, dz, 1, 1], [-dx, cy + H, -dz, 0, 1]];
    for (const k of [0, 1, 2, 0, 2, 3]) { p.push(v[k][0], v[k][1], v[k][2]); uv.push(v[k][3], v[k][4]); n.push(0, 1, 0); }
  }
  g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(n, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  return g;
}

/** Grayscale leafy crown (tinted per instance) with a trunk-bark patch in the corner. */
function leafTex() {
  return canvasTex('mtn-leaf', 256, 256, (x, w, h, rng) => {
    for (let i = 0; i < 1400; i++) {
      const a = rng() * Math.PI * 2, r = Math.pow(rng(), 0.6) * 0.47;
      const wob = 1 + 0.12 * Math.sin(a * 5 + 1.3) + 0.08 * Math.sin(a * 9);
      const px = 128 + Math.cos(a) * r * 256 * wob, py = 124 + Math.sin(a) * r * 236 * wob;
      const v = Math.round(clamp(95 + (1 - py / 256) * 120 + (rng() - 0.5) * 70 - r * 60, 40, 255));
      x.fillStyle = `rgb(${v},${v},${Math.round(v * 0.92)})`;
      x.beginPath();
      x.ellipse(px, py, 4 + rng() * 6, 3 + rng() * 4, rng() * 3.14, 0, Math.PI * 2);
      x.fill();
    }
    x.strokeStyle = 'rgba(40,30,22,0.8)';
    for (let i = 0; i < 7; i++) {
      x.lineWidth = 2 + rng() * 2;
      x.beginPath(); x.moveTo(128, 250); x.lineTo(128 + (rng() - 0.5) * 140, 120 + rng() * 80); x.stroke();
    }
    x.clearRect(0, 236, 256, 20);
    x.fillStyle = '#5a4634';
    x.fillRect(0, 240, 18, 16);
  }, { repeat: false });
}

function broadleafGeo() {
  const p = [], n = [], uv = [];
  const quad = (A, B, C, D, uvr, nf) => {
    for (const [v, t] of [[A, [uvr[0], uvr[1]]], [B, [uvr[2], uvr[1]]], [C, [uvr[2], uvr[3]]], [A, [uvr[0], uvr[1]]], [C, [uvr[2], uvr[3]]], [D, [uvr[0], uvr[3]]]]) {
      p.push(...v); uv.push(...t); n.push(...nf(v));
    }
  };
  const bark = [0.005, 0.005, 0.065, 0.055];
  for (let k = 0; k < 4; k++) {
    const a0 = k / 4 * Math.PI * 2, a1 = (k + 1) / 4 * Math.PI * 2;
    const A = [Math.cos(a0) * 0.26, -0.8, Math.sin(a0) * 0.26], B = [Math.cos(a1) * 0.26, -0.8, Math.sin(a1) * 0.26];
    const C2 = [Math.cos(a1) * 0.14, 4.6, Math.sin(a1) * 0.14], D = [Math.cos(a0) * 0.14, 4.6, Math.sin(a0) * 0.14];
    const mid = (a0 + a1) / 2;
    quad(A, B, C2, D, bark, () => [Math.cos(mid), 0, Math.sin(mid)]);
  }
  const cy = 6.2, R = 3.1, Hh = 2.9;
  const sph = (v) => { const d = [v[0], (v[1] - cy) * 0.8 + 1.2, v[2]]; const l = Math.hypot(...d) || 1; return d.map((q) => q / l); };
  for (let k = 0; k < 3; k++) {
    const a = k / 3 * Math.PI + 0.3;
    const dx = Math.cos(a) * R, dz = Math.sin(a) * R;
    quad([-dx, cy - Hh, -dz], [dx, cy - Hh, dz], [dx, cy + Hh, dz], [-dx, cy + Hh, -dz], [0, 0.06, 1, 1], sph);
  }
  quad([-R, cy + 0.6, -R], [R, cy + 0.6, -R], [R, cy + 0.6, R], [-R, cy + 0.6, R], [0, 0.06, 1, 1], () => [0, 1, 0]);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(n, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  return g;
}

function buildForest(ctx) {
  const { world, track, def, M, sides, lot, shed } = ctx;
  const T = world.terrain;
  const rng = makeRng('forest' + def.id);
  const noise = M.land.noise;
  const snow = def.land?.snow ?? 1e9;
  const autumn = def.time === 'dusk' || def.time === 'sunset';
  const leafCols = (autumn ? ['#b5541a', '#962a14', '#c0901e', '#4d5e24', '#7a3c1c', '#a8661c'] : ['#3d5222', '#4a5e26', '#2f4420']).map((h) => new THREE.Color(h));
  const CH = 450;
  const chunks = new Map();
  const b = track.bounds;
  const SP = 7.5, REACH = 190;
  for (let z = b.minZ - REACH; z < b.maxZ + REACH; z += SP) {
    for (let x = b.minX - REACH; x < b.maxX + REACH; x += SP) {
      const px = x + (rng() - 0.5) * SP * 0.95, pz = z + (rng() - 0.5) * SP * 0.95;
      const r1 = rng(), r2 = rng(), r3 = rng();
      const dr = M.roadDist(px, pz);
      if (dr >= REACH) continue;
      const dens = dr < 70 ? 0.8 : dr < 130 ? 0.4 : 0.14;
      const patch = noise(px / 140 + 4.4, pz / 140 - 8.1);
      if (r1 > dens * (0.75 + patch * 0.9)) continue;
      if (dr < 50) {
        const i = M.nearest(px, pz);
        if (i >= 0) {
          const lat = (px - track.X[i]) * track.LX[i] + (pz - track.Z[i]) * track.LZ[i];
          const sd = lat > 0 ? 1 : -1;
          const al = Math.hypot(px - track.X[i], pz - track.Z[i]);
          const lim = sides[sd].cls[i] || (shed && shed.has(i)) ? track.W[i] + BENCH + 13 : track.W[i] + RAIL + 4.2;
          if (al < lim) continue;
          if (lot && lot.side === sd && i >= lot.i0 - 8 && i <= lot.i1 + 8 && al < track.W[i] + lot.depth + 6) continue;
        }
      }
      const y = T.heightAt(px, pz);
      const n = T.normalAt(px, pz);
      if (n[1] < 0.6) continue;
      if (y > snow - 70 + patch * 60) continue;
      const leafy = noise(px / 210 - 1.7, pz / 210 + 2.9) + (r2 - 0.5) * 0.5 > (autumn ? 0.05 : 0.2);
      const key = `${Math.floor(px / CH)},${Math.floor(pz / CH)}`;
      if (!chunks.has(key)) chunks.set(key, [[], []]);
      if (leafy) {
        const c = leafCols[Math.floor(r3 * leafCols.length)];
        chunks.get(key)[1].push({ x: px, y: y - 0.2, z: pz, ry: r2 * 6.28, s: 0.8 + r3 * 0.45, color: c });
      } else {
        const k = 0.8 + r3 * 0.35;
        chunks.get(key)[0].push({ x: px, y: y - 0.3, z: pz, ry: r2 * 6.28, sx: 0.8 + r1 * 0.4, sy: 0.75 + r2 * 0.6, sz: 0.8 + r1 * 0.4, color: new THREE.Color(k, k * (0.95 + r1 * 0.1), k * 0.95) });
      }
    }
  }
  const geos = [coniferGeo(), broadleafGeo()], far = [coniferFarGeo(), broadleafFarGeo()];
  const mats = [
    new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92, side: THREE.DoubleSide }),
    new THREE.MeshStandardMaterial({ map: leafTex(), alphaTest: 0.42, roughness: 0.9, side: THREE.DoubleSide }),
  ];
  const shadows = world.sun?.castShadow;
  let count = 0;
  // one LOD per chunk: full trees near the camera, single cones / two cards beyond ~320 m
  for (const [key, lists] of chunks) {
    const [gx, gz] = key.split(',').map(Number);
    const cx = (gx + 0.5) * CH, cz = (gz + 0.5) * CH;
    const near = new THREE.Group(), farG = new THREE.Group();
    lists.forEach((list, k) => {
      if (!list.length) return;
      count += list.length;
      const local = list.map((o) => ({ ...o, x: o.x - cx, z: o.z - cz }));
      near.add(instanced(geos[k], mats[k], local, { shadow: false, receive: true }));
      farG.add(instanced(far[k], mats[k], local, { receive: true }));
    });
    const lod = new THREE.LOD();
    lod.position.set(cx, 0, cz);
    lod.addLevel(near, 0);
    lod.addLevel(farG, 320 + CH * 0.5);
    world.add(lod);
  }
  ctx.treeCount = count;
}

// ---------------------------------------------------------------- signs

const UV_REF_W = [0.9297, 0.2227, 0.9883, 0.3398];
const UV_REF_O = [0.9297, 0.3633, 0.9883, 0.4805];
const UV_BACK = [0.935, 0.03, 0.985, 0.16];
const UV_SHIELD = [0.7578, 0.039, 0.9141, 0.492];

/** Corners of the track: { i0, i1, imax, r, dir } with dir > 0 for left turns. Close same-hand arcs merge. */
function corners(track) {
  const N = track.N, out = [];
  let i = 0;
  while (i < N) {
    if (Math.abs(track.K[i]) > 1 / 90) {
      const dir = Math.sign(track.K[i]);
      let j = i, kmax = Math.abs(track.K[i]), imax = i;
      while (j + 1 < N && (Math.abs(track.K[j + 1]) > 1 / 90 && Math.sign(track.K[j + 1]) === dir)) {
        j++;
        if (Math.abs(track.K[j]) > kmax) { kmax = Math.abs(track.K[j]); imax = j; }
      }
      const prev = out[out.length - 1];
      if (prev && prev.dir === dir && (i - prev.i1) * track.step < 24) {
        prev.i1 = j;
        if (1 / kmax < prev.r) { prev.r = 1 / kmax; prev.imax = imax; }
        prev.imax = Math.round((prev.i0 + prev.i1) / 2);
      } else out.push({ i0: i, i1: j, imax, r: 1 / kmax, dir });
      i = j + 1;
    } else i++;
  }
  return out;
}

function buildSigns(ctx) {
  const { world, track, def, sides, wallOf, edgeY, P, lot, shed } = ctx;
  const gb = new GeoBuilder();
  const posts = [];
  const up = new THREE.Vector3(0, 1, 0);
  const addBoard = (x, y, z, fx, fz, w, h, uvr) => {
    const F = new THREE.Vector3(fx, 0, fz).normalize();
    const r = new THREE.Vector3().crossVectors(up, F).multiplyScalar(w / 2);
    const u = up.clone().multiplyScalar(h / 2);
    board(gb, new THREE.Vector3(x, y, z), r, u, uvr);
    board(gb, new THREE.Vector3(x - F.x * 0.025, y, z - F.z * 0.025), r.clone().negate(), u, UV_BACK);
  };
  const facing = (i, x, z, back = 26) => {
    const p = track.posAt(i * track.step - back, 0);
    return [p.x - x, p.z - z];
  };
  const blocked = (i) => (lot && i >= lot.i0 - 3 && i <= lot.i1 + 3) || (shed && i >= shed.i0 - 2 && i <= shed.i1 + 2);
  /** Post-mounted sign at s on side sd: bottom edge h0 above the road edge. */
  const roadSign = (s, sd, uvr, w, h, h0 = 1.6) => {
    if (!track.closed && (s < 5 || s > track.length - 5)) return;
    const i = track.idx(Math.round(s / track.step));
    if (blocked(i)) return;
    const lat = sd * (wallOf(sd, i) + (sides[sd].cls[i] ? 0.15 : 0.55));
    const [x, , z] = P(i, lat, 0);
    const y = edgeY(sd, i);
    const [fx, fz] = facing(i, x, z, 40);
    addBoard(x, y + h0 + h / 2, z, fx, fz, w, h, uvr);
    posts.push({ x, y: y - 0.3, z, sy: (h0 + h * 0.85 + 0.3) / 2.5 });
  };
  const cs = corners(track);
  ctx.corners = cs;
  const hairpins = cs.filter((c) => c.r < 30);
  for (const c of cs) {
    const out = -c.dir;
    if (c.r < 55) {
      const sp = clamp(c.r * 0.45, 5.5, 11);
      const sA = (c.i0 - 5) * track.step, sB = (c.i1 + 1) * track.step;
      for (let s = sA; s <= sB; s += sp) {
        const i = track.idx(Math.round(s / track.step));
        if (blocked(i)) continue;
        const cut = sides[out].cls[i];
        const lat = out * (wallOf(out, i) + (cut ? 0.1 : 0.32));
        const [x, , z] = P(i, lat, 0);
        const y = edgeY(out, i);
        const [fx, fz] = facing(i, x, z, Math.min(30, c.r * 1.2 + 8));
        addBoard(x, y + 1.45, z, fx, fz, 0.5, 0.7, CELL(c.dir > 0 ? 1 : 0));
        posts.push({ x, y: y - 0.3, z, sy: 1.4 / 2.5 });
      }
    }
    if (c.r < 30) roadSign(c.i0 * track.step - 115, 1, CELL(c.dir > 0 ? 3 : 2), 0.9, 0.9, 1.5);
  }
  // series of hairpins → winding-road warning before the first one
  for (let k = 0; k + 2 < hairpins.length; k++) {
    if ((hairpins[k + 2].i0 - hairpins[k].i0) * track.step < 1000 && (k === 0 || (hairpins[k].i0 - hairpins[k - 1].i0) * track.step > 1000)) {
      roadSign(hairpins[k].i0 * track.step - 190, 1, CELL(4), 0.9, 0.9, 1.5);
    }
  }
  // falling rocks before the tallest cut runs
  const tall = [];
  for (const sd of [1, -1]) {
    for (const [a, b] of runsOf(track, (i) => sides[sd].cls[i])) {
      if ((b - a) * track.step < 70) continue;
      let hs = 0;
      for (let r = a; r <= b; r++) hs += sides[sd].H[track.idx(r)];
      tall.push({ a, h: hs / (b - a + 1) });
    }
  }
  tall.sort((p, q) => q.h - p.h).slice(0, 3).forEach((t) => roadSign(t.a * track.step - 50, 1, CELL(5), 0.9, 0.9, 1.5));
  // speed limit + route shield
  roadSign(track.startS + 70, 1, UV_SHIELD, 0.62, 0.86, 1.7);
  for (const f of [0.12, 0.55]) roadSign(track.startS + f * track.length + 20, 1, CELL(6), 0.75, 0.75, 1.6);
  // delineators on every tenth guardrail post
  for (const p of ctx.railPosts || []) {
    if (p.n % 10 !== 5) continue;
    const [fx, fz] = facing(p.i, p.x, p.z, 30);
    const F = new THREE.Vector3(fx, 0, fz).normalize();
    const r = new THREE.Vector3().crossVectors(up, F).multiplyScalar(0.07);
    board(gb, new THREE.Vector3(p.x + F.x * 0.08, p.y + 0.93, p.z + F.z * 0.08), r, up.clone().multiplyScalar(0.07), p.sd > 0 ? UV_REF_W : UV_REF_O);
  }
  // curve mirrors on the outside of the hairpins
  const mirrors = new GeoBuilder();
  const mpost = [];
  for (const c of hairpins) {
    const out = -c.dir;
    const i = c.imax;
    if (blocked(i)) continue;
    const lat = out * (wallOf(out, i) + 0.45);
    const [x, , z] = P(i, lat, 0);
    const y = edgeY(out, i);
    mpost.push({ x, y: y - 0.3, z });
    const [fx, fz] = facing(i, x, z, -8);
    const F = new THREE.Vector3(fx, 0, fz).normalize();
    const r = new THREE.Vector3().crossVectors(up, F);
    const cx = x + F.x * 0.12, cz = z + F.z * 0.12, cy = y + 3.35;
    for (let k = 0; k < 12; k++) {
      const a0 = k / 12 * Math.PI * 2, a1 = (k + 1) / 12 * Math.PI * 2;
      const V = (a, rad) => new THREE.Vector3(cx + r.x * Math.cos(a) * rad, cy + Math.sin(a) * rad, cz + r.z * Math.cos(a) * rad);
      mirrors.quad(V(a0, 0.42), V(a1, 0.42), V(a1, 0.001), V(a0, 0.001));
    }
  }
  const sm = new THREE.Mesh(gb.build(), retroMaterial(world, signAtlas()));
  world.add(sm);
  const pipe = new THREE.CylinderGeometry(0.045, 0.045, 2.5, 6);
  pipe.translate(0, 1.25, 0);
  if (posts.length) world.add(instanced(pipe, new THREE.MeshStandardMaterial({ color: 0x9a9da0, roughness: 0.45, metalness: 0.6 }), posts));
  if (mpost.length) {
    const op = new THREE.CylinderGeometry(0.06, 0.06, 3.4, 6);
    op.translate(0, 1.7, 0);
    world.add(instanced(op, new THREE.MeshStandardMaterial({ color: 0xff6a10, roughness: 0.5 }), mpost));
    world.add(new THREE.Mesh(mirrors.build(), new THREE.MeshStandardMaterial({ color: 0xb8c4cc, metalness: 1, roughness: 0.08, side: THREE.DoubleSide })));
  }
  void def;
}

// ---------------------------------------------------------------- lamps

/** Arm lamps: list of { s, sd, off (m past the road edge), color }. */
function lampPost(ctx, list) {
  const { world, track, P, edgeY, night } = ctx;
  if (!list.length) return;
  const poles = [], heads = [], halos = [];
  for (const L of list) {
    const i = track.idx(Math.round(L.s / track.step));
    const sd = L.sd;
    const [x, , z] = P(i, sd * (track.W[i] + L.off), 0);
    const y = edgeY(sd, i);
    const ry = Math.atan2(-track.LX[i] * sd, -track.LZ[i] * sd);
    poles.push({ x, y: y - 0.3, z, ry });
    const reach = 2.6;
    const hx = x - track.LX[i] * sd * reach, hz = z - track.LZ[i] * sd * reach;
    heads.push({ x: hx, y: y + 8.55, z: hz, ry });
    halos.push(hx, y + 8.3, hz);
    world.addLamp(hx, y + 8.2, hz, L.color, 22, 1.35);
  }
  const gb = new GeoBuilder();
  gb.cylinder(0, 0, 0, 0.13, 9.0, 7, 0.08);
  gb.box(0, 8.85, 1.25, 0.1, 0.1, 2.7, 0, { top: true });
  gb.box(0, 8.3, 0.2, 0.06, 0.55, 0.06, 0);
  const pm = new THREE.MeshStandardMaterial({ color: 0x8c8f92, roughness: 0.55, metalness: 0.5 });
  world.add(instanced(gb.build(), pm, poles));
  const color = list[0].color;
  const hm = new THREE.MeshStandardMaterial({ color: 0x222222, emissive: new THREE.Color(color), emissiveIntensity: night ? 3.4 : 0.2 });
  world.add(instanced(new THREE.BoxGeometry(0.5, 0.18, 0.85), hm, heads));
  if (night) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(halos, 3));
    const fogged = (ctx.def.fogD ?? 0) > 0.003;
    world.add(new THREE.Points(g, new THREE.PointsMaterial({
      map: glowTexture(), color: new THREE.Color(color).multiplyScalar(fogged ? 0.32 : 0.75), size: fogged ? 11 : 6.5,
      sizeAttenuation: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: !fogged,
    })));
  }
}

function buildLamps(ctx) {
  const { track, def, sides } = ctx;
  const color = def.lampColor || '#ffb057';
  const list = [];
  for (const c of ctx.corners || []) {
    if (c.r >= 30) continue;
    const sd = -c.dir;
    list.push({ s: c.imax * track.step, sd, off: (sides[sd].cls[c.imax] ? CUT : RAIL) + 0.45, color });
  }
  for (const s of def.lamps || []) {
    const i = track.idx(Math.round(s / track.step));
    const sd = sides[1].cls[i] && !sides[-1].cls[i] ? -1 : 1;
    list.push({ s, sd, off: (sides[sd].cls[i] ? CUT : RAIL) + 0.45, color });
  }
  lampPost(ctx, list);
}

// ---------------------------------------------------------------- power lines

function buildPoles(ctx) {
  const { world, track, def, sides, wallOf, P, edgeY } = ctx;
  const T = world.terrain;
  const tops = [];
  for (const [s0, s1] of def.poles || []) {
    let prev = null;
    for (let s = s0; s <= s1; s += 41) {
      const i = track.idx(Math.round(s / track.step));
      let sd = !sides[-1].cls[i] ? -1 : !sides[1].cls[i] ? 1 : 0;
      if (!sd || (ctx.lot && ctx.lot.has(i)) || (ctx.shed && ctx.shed.has(i))) { prev = null; continue; }
      const lat = sd * (wallOf(sd, i) + 1.7);
      const [x, , z] = P(i, lat, 0);
      const gy = Math.min(T.heightAt(x, z), edgeY(sd, i)) - 0.5;
      const top = edgeY(sd, i) + 9.6;
      const tx = track.TX[i], tz = track.TZ[i];
      const pole = { x, z, gy, top, lx: track.LX[i], lz: track.LZ[i], ry: Math.atan2(tx, tz) };
      tops.push(pole);
      if (prev) prev.next = pole;
      prev = pole;
    }
  }
  if (!tops.length) return;
  const shaft = new THREE.CylinderGeometry(0.11, 0.17, 1, 7);
  shaft.translate(0, 0.5, 0);
  const conc = new THREE.MeshStandardMaterial({ color: 0x8d8b85, roughness: 0.8 });
  world.add(instanced(shaft, conc, tops.map((p) => ({ x: p.x, y: p.gy, z: p.z, sy: p.top - p.gy }))));
  const arm = new GeoBuilder();
  arm.box(0, -0.75, 0, 2.2, 0.12, 0.12, 0);
  for (const dx of [-0.95, 0, 0.95]) arm.cylinder(dx, -0.63, 0, 0.05, 0.16, 6);
  arm.box(0, -1.6, 0, 1.4, 0.1, 0.1, 0);
  arm.cylinder(0.8, -2.6, 0.2, 0.32, 0.9, 8);
  world.add(instanced(arm.build(), new THREE.MeshStandardMaterial({ color: 0x6d6a66, roughness: 0.7, metalness: 0.3 }), tops.map((p) => ({ x: p.x, y: p.top, z: p.z, ry: p.ry + Math.PI / 2 }))));
  const seg = [];
  for (const p of tops) {
    const q = p.next;
    if (!q) continue;
    for (const [dl, dy] of [[-0.95, -0.47], [0, -0.47], [0.95, -0.47], [0.6, -1.5]]) {
      const ax = p.x + p.lx * dl, az = p.z + p.lz * dl, ay = p.top + dy;
      const bx = q.x + q.lx * dl, bz = q.z + q.lz * dl, by = q.top + dy;
      const n = 8;
      for (let k = 0; k < n; k++) {
        const t0 = k / n, t1 = (k + 1) / n;
        const sag = (t) => 4 * t * (1 - t) * 0.9;
        seg.push(ax + (bx - ax) * t0, ay + (by - ay) * t0 - sag(t0), az + (bz - az) * t0);
        seg.push(ax + (bx - ax) * t1, ay + (by - ay) * t1 - sag(t1), az + (bz - az) * t1);
      }
    }
  }
  const lg = new THREE.BufferGeometry();
  lg.setAttribute('position', new THREE.Float32BufferAttribute(seg, 3));
  world.add(new THREE.LineSegments(lg, new THREE.LineBasicMaterial({ color: 0x0c0c0e })));
}

// ---------------------------------------------------------------- far ranges + town

/** Layered silhouette ranges that drift with the camera (parallax), fog-free so they read as aerial perspective. */
function farRanges(ctx) {
  const { world, track, def } = ctx;
  const at = world.at;
  const b = track.bounds;
  const cx = (b.minX + b.maxX) / 2, cz = (b.minZ + b.maxZ) / 2;
  const noise = makeNoise2D('ranges' + def.id);
  const fog = new THREE.Color(at.fog), hor = new THREE.Color(at.sky[2]), glow = new THREE.Color(at.glowHorizon);
  const sunAz = Math.atan2(world.sunDir.z, world.sunDir.x);
  const night = !at.sun || at.moon;
  const snowC = new THREE.Color(night ? '#3c4862' : '#9a8a9c');
  const yb = Math.min(...track.Y) - 160;
  const layers = [
    { R: 1750, f: 0.5, lo: 240, hi: 470, k: 0.0, freq: 3.1 },
    { R: 2150, f: 0.7, lo: 290, hi: 620, k: 0.35, freq: 2.3 },
    { R: 2600, f: 0.86, lo: 360, hi: 780, k: 0.7, freq: 1.7 },
  ];
  const meshes = [];
  layers.forEach((L, li) => {
    const SEG = 220;
    const p = [], c = [], idx = [];
    for (let k = 0; k <= SEG; k++) {
      const a = k / SEG * Math.PI * 2;
      const nx = Math.cos(a) * L.freq, nz = Math.sin(a) * L.freq;
      const ridge = noise.ridged(nx + li * 9, nz - li * 4, 4);
      const hgt = L.lo + (L.hi - L.lo) * clamp((ridge - 0.45) * 1.9, 0, 1.15) + noise.fbm(nx * 3, nz * 3, 2) * 50;
      const toward = Math.pow(Math.max(0, Math.cos(a - sunAz)), 3);
      // hazy toward the foot, darker silhouette above; farther layers fade toward the horizon
      // aerial perspective: each layer sits a little closer to the horizon sky than the fogged terrain
      const haze = fog.clone().lerp(hor, 0.08 + L.k * 0.3).lerp(glow, toward * 0.2);
      const top = fog.clone().multiplyScalar(night ? 0.9 + li * 0.12 : 0.92).lerp(hor, L.k * 0.26).lerp(glow, toward * (0.05 + L.k * 0.2));
      const x = Math.cos(a) * L.R, z = Math.sin(a) * L.R;
      const snowy = smoothstep(L.hi * 0.8, L.hi, hgt) * (li > 0 ? 0.22 : 0);
      for (const [y, col] of [[yb, haze], [yb + hgt * 0.75, top], [yb + hgt, top.clone().lerp(snowC, snowy)]]) {
        p.push(x, y, z);
        c.push(col.r, col.g, col.b);
      }
      if (k < SEG) {
        const o = k * 3;
        idx.push(o, o + 3, o + 1, o + 1, o + 3, o + 4, o + 1, o + 4, o + 2, o + 2, o + 4, o + 5);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(c, 3));
    g.setIndex(idx);
    const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, fog: false, side: THREE.DoubleSide }));
    m.frustumCulled = false;
    m.renderOrder = -5 + li * -1;
    m.userData.f = L.f;
    world.add(m);
    meshes.push(m);
  });
  world.animators.push((dt, cam) => {
    for (const m of meshes) m.position.set(cx + (cam.position.x - cx) * m.userData.f, 0, cz + (cam.position.z - cz) * m.userData.f);
  });
}

/** Village lights on the valley floor: def.land.town = [[x, z, radius, count], …]. */
function townLights(ctx) {
  const { world, def } = ctx;
  const T = world.terrain;
  const rng = makeRng('town' + def.id);
  const p = [], c = [];
  const warm = [new THREE.Color('#ffc078'), new THREE.Color('#ffe2b0'), new THREE.Color('#d8e8ff'), new THREE.Color('#ff9a50')];
  for (const [x0, z0, rad, n] of def.land.town) {
    for (let k = 0; k < n; k++) {
      const a = rng() * Math.PI * 2, r = Math.sqrt(rng()) * rad;
      const x = x0 + Math.cos(a) * r, z = z0 + Math.sin(a) * r;
      p.push(x, T.heightAt(x, z) + 3 + rng() * 4, z);
      const col = warm[Math.floor(rng() * warm.length)];
      const k2 = 0.6 + rng() * 0.8;
      c.push(col.r * k2, col.g * k2, col.b * k2);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(c, 3));
  world.add(new THREE.Points(g, new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, vertexColors: true,
    vertexShader: `varying vec3 vC; void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.0); float d = -mv.z;
      vC = color * exp(-pow(d * 0.00055, 2.0)) * 1.4; gl_PointSize = clamp(2600.0 / d, 1.0, 3.0); gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `varying vec3 vC; void main(){ vec2 q = gl_PointCoord - 0.5; float a = 1.0 - smoothstep(0.2, 0.5, length(q)); gl_FragColor = vec4(vC * a, 1.0); }`,
  })));
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
