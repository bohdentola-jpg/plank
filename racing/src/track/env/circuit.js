// Circuit raceways — purpose-built tracks: mown grass runoff, red/white
// curbs, gravel traps, tire walls / armco / concrete with catch fences,
// grandstands full of people, pit building + garages + paddock, a start
// gantry with working lights, sponsor boards, a footbridge, marshal posts,
// braking boards, forests and distant hills. One LOOK preset per def.scenery.
import * as THREE from 'three';
import { glowMaterial } from '../build.js';
import { toTex } from '../textures.js';
import { smoothArray } from '../path.js';
import { GeoBuilder } from './common.js';
import { makeRng, makeNoise2D, hashString, clamp, smoothstep, lerp, nextFrame } from '../../core/util.js';

const DS = THREE.DoubleSide;
const BRANDS = ['KUROSHIO', 'RAZOR FUEL', 'NITRO-X', 'STATIC TIRES', 'MIDNIGHT 88.1'];
const TEAMS = ['#c8161e', '#1d4fa8', '#f0a818', '#1b1b1d', '#2f9a4a', '#e6e6e6', '#ff6a00', '#5a2a8a'];

// s = meters along the lap; side +1 = left of the driving direction, -1 = right.
// walls: [s0, s1, side, runoff past the road edge, kind (2 concrete)]
const LOOK = {
  redwood: {
    grass: '#6a9440', steep: '#7d7158', floor: '#3e5a2c', verge: '#6c9a42', gravel: '#efe6d2',
    far: ['#5e8048', '#3a5446'], mountains: 300,
    hills: { amp: 9, rise: 90, freq: 0.0032, infield: 0.25 },
    terrain: { margin: 520, cell: 13, flat: 26, blend: 44 },
    forest: { bias: 0.1, infield: 0.22, count: 2800, conifer: 1, coniferH: [20, 50], oakH: [8, 13] },
    seats: ['#2b5fb8', '#d6dce2'], roof: '#eef1f2', accent: '#1d5c34', building: '#e4e6e2',
    walls: [[150, 1170, -1, 3.6, 2], [195, 1090, 1, 7.5, 2]],
    pits: { lane: [182, 1010], garages: [330, 706], tower: 432 },
    stands: [[236, 724, 1, 12], [1150, 1262, 1, 9], [3380, 3545, 1, 9], [2860, 2990, -1, 8]],
    banks: [[1600, 1760, 1], [2040, 2200, -1]],
    bridge: 2620, parking: [[480, 1, 220, 80]],
  },
  crestwood: {
    grass: '#d8c174', steep: '#a8865c', floor: '#8a8248', verge: '#c8cc7c', gravel: '#ecd8ae',
    far: ['#a68a5a', '#6e5c66'], mountains: 220,
    hills: { amp: 16, rise: 120, freq: 0.0042, infield: 0.5 },
    terrain: { margin: 520, cell: 11, flat: 14, blend: 30 },
    forest: { bias: -0.06, infield: 0.7, count: 1800, conifer: 0.22, coniferH: [14, 24], oakH: [7, 13] },
    seats: ['#b42a2a', '#ebe5d8'], roof: '#f2ede2', accent: '#7a1f2b', building: '#f0eadd',
    walls: [[150, 470, -1, 3.4, 2], [175, 462, 1, 6.5, 2]],
    pits: { lane: [172, 470], garages: [205, 425], tower: 270 },
    stands: [[182, 452, 1, 10], [790, 905, -1, 8], [3175, 3335, -1, 9]],
    banks: [[1550, 1760, -1], [2975, 3160, -1], [600, 800, 1], [2120, 2260, 1]],
    bridge: 2700, parking: [[300, -1, 160, 70]],
  },
};
const lookFor = (def) => LOOK[def.scenery] || LOOK[def.id] || LOOK.redwood;
const rgb = (hex) => { const c = new THREE.Color(hex); return [c.r, c.g, c.b]; };

// ------------------------------------------------------------------ terrain

export function terrainOpts(def) {
  return { ...lookFor(def).terrain };
}

/** Far-field ground: follows the track's own elevation, rolls away into hills. */
export function natural(def, track) {
  bankBoost(def, track);
  const L = lookFor(def);
  const noise = makeNoise2D(hashString(def.id) % 9973);
  const field = trackField(track, L.terrain.margin + 300);
  const { amp, rise, freq, infield } = L.hills;
  const fn = (x, z) => {
    const f = field.at(x, z);
    const k = lerp(1, infield, f.inside);
    let h = f.y + noise.fbm(x * freq, z * freq, 4) * amp * smoothstep(30, 260, f.d) * k;
    h += smoothstep(160, 900, f.d) * (1 - f.inside) * rise * (0.3 + 0.9 * noise.ridged(x * freq * 0.33 + 31, z * freq * 0.33 - 17, 3));
    return h;
  };
  track._ct = { field, natural: fn, noise };
  return fn;
}

/** Extra banking from def.bankBoost [[s0, s1, rad]] — applied before the road is built. */
function bankBoost(def, track) {
  if (!def.bankBoost || track._ctBank) return;
  track._ctBank = true;
  for (const [s0, s1, rad] of def.bankBoost) {
    const k0 = Math.round(s0 / track.step), n = Math.round((s1 - s0) / track.step);
    let sum = 0;
    for (let k = 0; k <= n; k++) sum += track.Ks[track.idx(k0 + k)];
    const dir = -Math.sign(sum), ramp = Math.min(45, (s1 - s0) / 3);
    for (let k = 0; k <= n; k++) {
      const s = k * track.step;
      track.B[track.idx(k0 + k)] += dir * rad * smoothstep(0, ramp, Math.min(s, s1 - s0 - s));
    }
  }
}

/** Coarse lattice of (inverse-distance track height, distance to track, inside loop). */
function trackField(track, M) {
  const k = Math.max(1, Math.round(12 / track.step));
  const SX = [], SZ = [], SY = [];
  for (let i = 0; i < track.N; i += k) { SX.push(track.X[i]); SZ.push(track.Z[i]); SY.push(track.Y[i]); }
  const n = SX.length, C = 25, b = track.bounds;
  const x0 = b.minX - M, z0 = b.minZ - M;
  const nx = Math.ceil((b.maxX - b.minX + 2 * M) / C) + 1, nz = Math.ceil((b.maxZ - b.minZ + 2 * M) / C) + 1;
  const Y = new Float32Array(nx * nz), D = new Float32Array(nx * nz), I = new Float32Array(nx * nz);
  const inside = loopTest(track);
  for (let j = 0; j < nz; j++) {
    for (let i = 0; i < nx; i++) {
      const x = x0 + i * C, z = z0 + j * C;
      let ws = 0, wy = 0, dm = Infinity;
      for (let q = 0; q < n; q++) {
        const d2 = (x - SX[q]) ** 2 + (z - SZ[q]) ** 2;
        if (d2 < dm) dm = d2;
        const e = d2 + 900, w = 1 / (e * Math.sqrt(e));
        ws += w; wy += w * SY[q];
      }
      const o = j * nx + i;
      Y[o] = wy / ws; D[o] = Math.sqrt(dm); I[o] = inside(x, z) ? 1 : 0;
    }
  }
  const out = { y: 0, d: 0, inside: 0 };
  return {
    inside,
    at(x, z) {
      const fx = clamp((x - x0) / C, 0, nx - 1.001), fz = clamp((z - z0) / C, 0, nz - 1.001);
      const i = Math.floor(fx), j = Math.floor(fz), tx = fx - i, tz = fz - j, o = j * nx + i;
      const bl = (A) => (A[o] * (1 - tx) + A[o + 1] * tx) * (1 - tz) + (A[o + nx] * (1 - tx) + A[o + nx + 1] * tx) * tz;
      out.y = bl(Y); out.d = bl(D); out.inside = bl(I);
      out.d += Math.hypot(Math.max(0, x0 - x, x - x0 - (nx - 1) * C), Math.max(0, z0 - z, z - z0 - (nz - 1) * C));
      return out;
    },
  };
}

function loopTest(track) {
  const xs = [], zs = [];
  for (let i = 0; i < track.N; i += 4) { xs.push(track.X[i]); zs.push(track.Z[i]); }
  const n = xs.length;
  return (x, z) => {
    let c = false;
    for (let i = 0, j = n - 1; i < n; j = i++) {
      if ((zs[i] > z) !== (zs[j] > z) && x < ((xs[j] - xs[i]) * (z - zs[i])) / (zs[j] - zs[i]) + xs[i]) c = !c;
    }
    return c;
  };
}

// ------------------------------------------------------------------ textures

const TEX = new Map();
const once = (key, fn) => { if (!TEX.has(key)) TEX.set(key, fn()); return TEX.get(key); };
function cv(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; }
const FONT = '"Arial Black", Impact, "Helvetica Neue", Arial, sans-serif';

function text(x, s, px, py, size, col, o = {}) {
  let sz = size;
  const font = () => `${o.italic ? 'italic ' : ''}${o.w || 900} ${sz}px ${o.f || FONT}`;
  x.font = font();
  while (o.max && x.measureText(s).width > o.max && sz > 8) { sz -= 2; x.font = font(); }
  x.textAlign = o.align || 'center';
  x.textBaseline = 'middle';
  if (o.glow) { x.shadowColor = o.glow; x.shadowBlur = o.blur || 14; }
  if (o.stroke) { x.lineWidth = o.stroke; x.strokeStyle = o.sc || '#000'; x.lineJoin = 'round'; x.strokeText(s, px, py); }
  x.fillStyle = col;
  x.fillText(s, px, py);
  x.shadowBlur = 0;
}

function speckle(x, w, h, rng, n, cols, a0 = 0.15, a1 = 0.5, s0 = 1, s1 = 2) {
  for (let i = 0; i < n; i++) {
    x.fillStyle = cols[(rng() * cols.length) | 0];
    x.globalAlpha = a0 + rng() * (a1 - a0);
    const s = s0 + rng() * (s1 - s0);
    x.fillRect(rng() * w, rng() * h, s, s);
  }
  x.globalAlpha = 1;
}

/** Near-white grass detail (hue comes from vertex/material color); stripes = mowing bands. */
function grassTex(stripes) {
  return once('grass' + stripes, () => {
    const [c, x] = cv(256, 256);
    const rng = makeRng('ct-grass');
    x.fillStyle = '#d4d4d4';
    x.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 24; i++) {
      const px = rng() * 256, py = rng() * 256, r = 16 + rng() * 46, a = 0.05 + rng() * 0.08, lt = rng() < 0.5;
      for (const ox of [-256, 0, 256]) {
        for (const oy of [-256, 0, 256]) {
          const g = x.createRadialGradient(px + ox, py + oy, 0, px + ox, py + oy, r);
          g.addColorStop(0, lt ? `rgba(255,255,240,${a})` : `rgba(20,30,0,${a})`);
          g.addColorStop(1, 'rgba(0,0,0,0)');
          x.fillStyle = g;
          x.fillRect(px + ox - r, py + oy - r, r * 2, r * 2);
        }
      }
    }
    for (let i = 0; i < 11000; i++) {
      const v = (140 + rng() * 115) | 0;
      x.fillStyle = `rgba(${v},${Math.min(255, v + 10)},${v - 30},${0.2 + rng() * 0.45})`;
      x.fillRect(rng() * 256, rng() * 256, 1, 1 + rng() * 3);
    }
    if (stripes) { x.fillStyle = 'rgba(255,255,235,0.13)'; x.fillRect(0, 0, 256, 128); }
    return toTex(c);
  });
}

function gravelTex() {
  return once('gravel', () => {
    const [c, x] = cv(256, 256);
    const rng = makeRng('ct-gravel');
    x.fillStyle = '#cfc8ba';
    x.fillRect(0, 0, 256, 256);
    const cols = ['#8e8778', '#f0ebe0', '#a69d8c', '#6e685c', '#ddd6c6', '#b7ad99', '#c4b49a'];
    for (let i = 0; i < 9000; i++) {
      x.fillStyle = cols[(rng() * cols.length) | 0];
      x.globalAlpha = 0.35 + rng() * 0.55;
      x.beginPath();
      x.arc(rng() * 256, rng() * 256, 0.6 + rng() * 1.7, 0, 6.283);
      x.fill();
    }
    x.globalAlpha = 1;
    return toTex(c);
  });
}

function asphaltTex() {
  return once('asphalt', () => {
    const [c, x] = cv(256, 256);
    const rng = makeRng('ct-asph');
    x.fillStyle = '#4a4b4f';
    x.fillRect(0, 0, 256, 256);
    speckle(x, 256, 256, rng, 26000, ['#2c2d30', '#616266', '#3a3b3e', '#77787c'], 0.2, 0.6, 1, 1.6);
    for (let i = 0; i < 6; i++) { x.fillStyle = `rgba(0,0,0,${0.05 + rng() * 0.08})`; x.fillRect(rng() * 256, rng() * 256, 30 + rng() * 80, 20 + rng() * 60); }
    return toTex(c);
  });
}

/** Red/white curb: u across (0 = road side), v along the track. */
function curbTex() {
  return once('curb', () => {
    const [c, x] = cv(32, 128);
    const rng = makeRng('ct-curb');
    x.fillStyle = '#d0231f'; x.fillRect(0, 0, 32, 64);
    x.fillStyle = '#f1f0ea'; x.fillRect(0, 64, 32, 64);
    x.fillStyle = 'rgba(0,0,0,0.25)'; x.fillRect(0, 0, 32, 2); x.fillRect(0, 64, 32, 2);
    speckle(x, 32, 128, rng, 700, ['#000000', '#3a3a3a', '#ffffff'], 0.05, 0.3);
    const g = x.createLinearGradient(0, 0, 32, 0);
    g.addColorStop(0, 'rgba(10,10,10,0.35)');
    g.addColorStop(0.4, 'rgba(10,10,10,0)');
    x.fillStyle = g;
    x.fillRect(0, 0, 32, 128);
    return toTex(c);
  });
}

/** Tire wall: u along (4 stacks per 2.4 m), v 0..0.72 front face, 0.72..1 top. */
function tireTex() {
  return once('tires', () => {
    const [c, x] = cv(256, 128);
    const rng = makeRng('ct-tire');
    x.fillStyle = '#121214';
    x.fillRect(0, 0, 256, 128);
    const paint = ['#dcdcd6', '#1e1f22', '#c41c22', '#1e1f22'];
    const top = 36, rowH = (128 - top) / 3;
    for (let s = 0; s < 4; s++) {
      for (let r = 0; r < 3; r++) {
        const y0 = top + r * rowH;
        const g = x.createLinearGradient(0, y0, 0, y0 + rowH);
        const col = paint[s];
        g.addColorStop(0, '#0a0a0b'); g.addColorStop(0.25, col); g.addColorStop(0.75, col); g.addColorStop(1, '#0a0a0b');
        x.fillStyle = g;
        x.fillRect(s * 64 + 2, y0 + 1, 60, rowH - 2);
        x.fillStyle = 'rgba(0,0,0,0.35)';
        for (let t = 0; t < 6; t++) x.fillRect(s * 64 + 4 + t * 10, y0 + 4, 2, rowH - 8);
      }
      x.fillStyle = '#2a2b2e';
      x.beginPath(); x.ellipse(s * 64 + 32, 18, 30, 16, 0, 0, 6.283); x.fill();
      x.fillStyle = '#050505';
      x.beginPath(); x.ellipse(s * 64 + 32, 18, 15, 8, 0, 0, 6.283); x.fill();
    }
    speckle(x, 256, 128, rng, 900, ['#000', '#555', '#8a7a60'], 0.05, 0.3);
    return toTex(c);
  });
}

/** Armco W-beam: u along (4 m), v across the two beams. */
function armcoTex() {
  return once('armco', () => {
    const [c, x] = cv(128, 64);
    const rng = makeRng('ct-armco');
    const g = x.createLinearGradient(0, 0, 0, 64);
    const st = ['#8d949b', '#c9ced3', '#7b8288', '#c3c8cd', '#8d949b'];
    st.forEach((col, k) => g.addColorStop(k / (st.length - 1), col));
    x.fillStyle = g;
    x.fillRect(0, 0, 128, 64);
    x.fillStyle = 'rgba(0,0,0,0.45)';
    for (const y of [16, 48]) { x.fillRect(2, y - 2, 4, 4); x.fillRect(66, y - 2, 4, 4); }
    speckle(x, 128, 64, rng, 500, ['#6a4a30', '#3a3a3a', '#ffffff'], 0.05, 0.25);
    for (let i = 0; i < 6; i++) { x.fillStyle = 'rgba(110,70,40,0.18)'; x.fillRect(rng() * 128, 40 + rng() * 20, 2 + rng() * 6, 10 + rng() * 14); }
    return toTex(c);
  });
}

/** Concrete wall face with a sponsor band (v 0.5..1) + plain concrete (v 0..0.5). */
function wallTex() {
  return once('wall', () => {
    const [c, x] = cv(1280, 256);
    const rng = makeRng('ct-wall');
    x.fillStyle = '#c9c8c2';
    x.fillRect(0, 0, 1280, 256);
    speckle(x, 1280, 256, rng, 12000, ['#8a8984', '#e6e5e0', '#a5a49e'], 0.1, 0.45);
    const looks = [['#0c0c0e', '#ffffff', '#e0242c'], ['#ff7a00', '#111111', '#111111'], ['#0b2a6a', '#ffd400', '#ffffff'], ['#f4f4f2', '#1d4fa8', '#d0231f'], ['#1a0a2a', '#ff4fb0', '#40e0ff']];
    for (let k = 0; k < 5; k++) {
      const [bg, fg, ac] = looks[k];
      const x0 = k * 256;
      x.fillStyle = bg;
      x.fillRect(x0, 4, 256, 88);
      x.fillStyle = ac;
      x.fillRect(x0, 80, 256, 12);
      text(x, BRANDS[k], x0 + 128, 44, 46, fg, { italic: true, max: 236, glow: k === 4 ? '#ff4fb0' : null });
      x.fillStyle = 'rgba(0,0,0,0.5)';
      x.fillRect(x0, 0, 2, 96);
    }
    // grime at the foot of the wall + rubber kisses
    const g = x.createLinearGradient(0, 96, 0, 128);
    g.addColorStop(0, 'rgba(60,55,45,0)');
    g.addColorStop(1, 'rgba(60,55,45,0.45)');
    x.fillStyle = g;
    x.fillRect(0, 96, 1280, 32);
    for (let i = 0; i < 40; i++) { x.fillStyle = `rgba(10,10,10,${0.1 + rng() * 0.25})`; x.fillRect(rng() * 1280, 88 + rng() * 30, 20 + rng() * 90, 2 + rng() * 5); }
    x.fillStyle = 'rgba(0,0,0,0.3)';
    for (let k = 0; k < 10; k++) x.fillRect(k * 128, 128, 2, 128);
    return toTex(c);
  });
}

function fenceTex() {
  return once('fence', () => {
    const [c, x] = cv(64, 64);
    x.clearRect(0, 0, 64, 64);
    x.strokeStyle = 'rgba(70,74,78,0.95)';
    x.lineWidth = 2.2;
    for (let k = -64; k <= 64; k += 16) {
      x.beginPath(); x.moveTo(k, 0); x.lineTo(k + 64, 64); x.stroke();
      x.beginPath(); x.moveTo(k + 64, 0); x.lineTo(k, 64); x.stroke();
    }
    return toTex(c);
  });
}

/** One row of spectators (transparent gaps), ~16 people across. */
function crowdTex() {
  return once('crowd', () => {
    const [c, x] = cv(512, 128);
    const rng = makeRng('ct-crowd');
    const shirts = ['#c8252c', '#2a4f9a', '#e8e8e4', '#d8b81a', '#2f7a44', '#1b1b1d', '#3a3a40', '#5a6a7a', '#7a2a2a', '#f0f0f0', '#253045', '#8a8a8a', '#e06a1a'];
    const skin = ['#f1c7a5', '#d9a07a', '#b07850', '#7a4e32', '#e8b896'];
    for (let row = 0; row < 2; row++) {
      for (let k = 0; k < 16; k++) {
        if (rng() < 0.08) continue;
        const cx = k * 32 + 16 + (rng() - 0.5) * 6 + (row ? 16 : 0), by = row ? 128 : 112;
        const sh = shirts[(rng() * shirts.length) | 0];
        x.fillStyle = sh;
        x.beginPath();
        x.moveTo(cx - 13, by); x.lineTo(cx - 12, by - 46); x.quadraticCurveTo(cx, by - 54, cx + 12, by - 46); x.lineTo(cx + 13, by);
        x.fill();
        if (rng() < 0.18) {
          x.strokeStyle = sh; x.lineWidth = 6;
          x.beginPath(); x.moveTo(cx - 10, by - 44); x.lineTo(cx - 16, by - 80); x.moveTo(cx + 10, by - 44); x.lineTo(cx + 16, by - 80); x.stroke();
        }
        x.fillStyle = skin[(rng() * skin.length) | 0];
        x.beginPath(); x.arc(cx, by - 62, 9.5, 0, 6.283); x.fill();
        const hat = rng();
        x.fillStyle = hat < 0.3 ? shirts[(rng() * shirts.length) | 0] : '#2a1a10';
        x.beginPath(); x.arc(cx, by - 65, 9.8, Math.PI, 0); x.fill();
        if (hat < 0.3) x.fillRect(cx - 2, by - 66, 14, 3);
        if (rng() < 0.05) { x.fillStyle = TEAMS[(rng() * 4) | 0]; x.fillRect(cx + 4, by - 112, 26, 18); x.fillStyle = '#333'; x.fillRect(cx + 3, by - 112, 2, 50); }
      }
    }
    return toTex(c);
  });
}

/** Rubber streaks (u 0..0.5) and solid paint (u 0.5..1); v along the track. */
function decalTex() {
  return once('decal', () => {
    const [c, x] = cv(64, 256);
    const rng = makeRng('ct-decal');
    for (let y = 0; y < 256; y++) {
      const a = 0.25 + 0.3 * Math.sin(y * 0.07) * Math.sin(y * 0.023 + 1) + rng() * 0.15;
      const g = x.createLinearGradient(0, 0, 32, 0);
      g.addColorStop(0, 'rgba(8,8,8,0)');
      g.addColorStop(0.5, `rgba(8,8,8,${clamp(a, 0.05, 0.75)})`);
      g.addColorStop(1, 'rgba(8,8,8,0)');
      x.fillStyle = g;
      x.fillRect(0, y, 32, 1);
    }
    x.fillStyle = '#f4f4ef';
    x.fillRect(34, 0, 28, 256);
    return toTex(c, { aniso: 4 });
  });
}

// atlas slots (512x256): 0..4 brands, 5 track name, 6 alt brand, 7 = 4 braking boards (256x128)
function slotUV(k) {
  const u0 = (k % 2) * 0.5, v1 = 1 - (k >> 1) * 0.25;
  return [u0 + 0.003, v1 - 0.25 + 0.005, u0 + 0.497, v1 - 0.005];
}
function boardUV(j) {
  const u0 = 0.5 + (j % 2) * 0.25, v1 = 0.25 - (j >> 1) * 0.125;
  return [u0 + 0.004, v1 - 0.125 + 0.006, u0 + 0.246, v1 - 0.006];
}

function adAtlas(name, accent) {
  return once('atlas' + name, () => {
    const [c, x] = cv(1024, 1024);
    const rng = makeRng('ct-atlas' + name);
    const slot = (k, fn) => {
      x.save();
      x.translate((k % 2) * 512, (k >> 1) * 256);
      x.beginPath(); x.rect(0, 0, 512, 256); x.clip();
      fn();
      x.restore();
    };
    const vgrad = (a, b) => { const g = x.createLinearGradient(0, 0, 0, 256); g.addColorStop(0, a); g.addColorStop(1, b); return g; };
    slot(0, () => {
      x.fillStyle = vgrad('#26262a', '#050506'); x.fillRect(0, 0, 512, 256);
      x.fillStyle = '#e0242c';
      x.beginPath(); x.moveTo(0, 182); x.bezierCurveTo(150, 140, 320, 226, 512, 160); x.lineTo(512, 196); x.bezierCurveTo(320, 262, 150, 178, 0, 216); x.fill();
      text(x, 'KUROSHIO', 256, 96, 92, '#ffffff', { italic: true, max: 480 });
      text(x, 'PERFORMANCE TIRES', 256, 236, 24, '#ffffff', { w: 700, f: 'Arial, sans-serif' });
    });
    slot(1, () => {
      x.fillStyle = vgrad('#ff8a10', '#e05a00'); x.fillRect(0, 0, 512, 256);
      x.fillStyle = '#111';
      for (let k = 0; k < 7; k++) { x.beginPath(); x.moveTo(330 + k * 30, 0); x.lineTo(360 + k * 30, 0); x.lineTo(300 + k * 30, 256); x.lineTo(270 + k * 30, 256); x.fill(); }
      text(x, 'RAZOR', 170, 84, 96, '#111111', { italic: true, max: 300 });
      text(x, 'FUEL', 170, 164, 80, '#ffffff', { italic: true, stroke: 8, sc: '#111', max: 300 });
      x.fillStyle = '#111'; x.fillRect(0, 210, 512, 46);
      text(x, 'RACE GAS · 104 OCTANE', 256, 233, 24, '#ff8a10', { w: 700, f: 'Arial, sans-serif' });
    });
    slot(2, () => {
      const g = x.createRadialGradient(256, 128, 10, 256, 128, 300);
      g.addColorStop(0, '#1d5ad8'); g.addColorStop(1, '#06143a');
      x.fillStyle = g; x.fillRect(0, 0, 512, 256);
      x.fillStyle = 'rgba(255,255,255,0.08)';
      for (let k = 0; k < 18; k++) { x.beginPath(); x.moveTo(256, 128); const a = k / 18 * 6.283; x.lineTo(256 + Math.cos(a) * 400, 128 + Math.sin(a) * 400); x.lineTo(256 + Math.cos(a + 0.12) * 400, 128 + Math.sin(a + 0.12) * 400); x.fill(); }
      x.fillStyle = '#ffd400';
      x.beginPath(); x.moveTo(60, 30); x.lineTo(100, 30); x.lineTo(80, 110); x.lineTo(110, 110); x.lineTo(50, 226); x.lineTo(66, 134); x.lineTo(36, 134); x.fill();
      text(x, 'NITRO-X', 290, 110, 104, '#ffd400', { italic: true, stroke: 10, sc: '#04102c', max: 380 });
      text(x, 'ENERGY DRINK', 290, 200, 30, '#ffffff', { w: 700, f: 'Arial, sans-serif' });
    });
    slot(3, () => {
      x.fillStyle = '#f6f6f3'; x.fillRect(0, 0, 512, 256);
      x.fillStyle = '#d0231f'; x.fillRect(0, 150, 512, 20);
      text(x, 'STATIC', 256, 88, 110, '#1d4fa8', { italic: true, max: 470 });
      text(x, 'TIRES', 256, 212, 52, '#1b1b1b', { max: 300 });
      x.fillStyle = '#1b1b1b';
      for (let k = 0; k < 16; k++) { x.fillRect(k * 32, 242, 18, 14); }
    });
    slot(4, () => {
      x.fillStyle = vgrad('#2a0a40', '#07020e'); x.fillRect(0, 0, 512, 256);
      for (let k = 0; k < 60; k++) { x.fillStyle = `rgba(255,255,255,${rng() * 0.8})`; x.fillRect(rng() * 512, rng() * 256, 2, 2); }
      text(x, 'MIDNIGHT', 256, 100, 92, '#ff4fb0', { italic: true, glow: '#ff4fb0', blur: 22, max: 480 });
      text(x, '88.1 FM', 256, 190, 64, '#40e0ff', { glow: '#40e0ff', blur: 16, max: 400 });
    });
    slot(5, () => {
      x.fillStyle = accent; x.fillRect(0, 0, 512, 256);
      x.strokeStyle = '#ffffff'; x.lineWidth = 10; x.strokeRect(12, 12, 488, 232);
      const [a, b] = name.split(' ');
      text(x, a, 256, 100, 96, '#ffffff', { max: 460 });
      text(x, b || '', 256, 190, 54, '#ffe9a8', { max: 440 });
    });
    slot(6, () => {
      x.fillStyle = vgrad('#e0242c', '#a80e14'); x.fillRect(0, 0, 512, 256);
      text(x, 'KUROSHIO', 256, 100, 92, '#ffffff', { italic: true, max: 480 });
      text(x, 'GRIP IS EVERYTHING', 256, 196, 34, '#111111', { w: 900, max: 460 });
    });
    // braking boards + chevron
    ['300', '200', '100'].forEach((t, j) => {
      x.save();
      x.translate(512 + (j % 2) * 256, 768 + (j >> 1) * 128);
      x.fillStyle = '#f4f4f0'; x.fillRect(0, 0, 256, 128);
      x.strokeStyle = '#111'; x.lineWidth = 10; x.strokeRect(6, 6, 244, 116);
      text(x, t, 128, 68, 96, '#111111', { max: 230 });
      x.restore();
    });
    x.save();
    x.translate(768, 896);
    x.fillStyle = '#d0231f'; x.fillRect(0, 0, 256, 128);
    x.fillStyle = '#ffffff';
    for (let k = 0; k < 3; k++) { const ox = 40 + k * 64; x.beginPath(); x.moveTo(ox, 20); x.lineTo(ox + 40, 64); x.lineTo(ox, 108); x.lineTo(ox + 22, 108); x.lineTo(ox + 62, 64); x.lineTo(ox + 22, 20); x.fill(); }
    x.restore();
    return toTex(c);
  });
}

/** Pit building: 2 garage bays (v .5..1), glazing (v .25..5), name sign (v 0..25). */
function facadeTex(name, accent) {
  return once('facade' + name, () => {
    const [c, x] = cv(1024, 512);
    const rng = makeRng('ct-fac');
    for (let b = 0; b < 2; b++) {
      const x0 = b * 512;
      x.fillStyle = '#d9dbd6'; x.fillRect(x0, 0, 512, 256);
      speckle(x, 512, 256, rng, 1500, ['#999', '#fff'], 0.05, 0.2);
      x.fillStyle = '#9a9c98'; x.fillRect(x0, 236, 512, 20);
      if (b === 0) {
        const g = x.createLinearGradient(0, 40, 0, 236);
        g.addColorStop(0, '#2a2c30'); g.addColorStop(0.2, '#5a5e64'); g.addColorStop(0.3, '#1e2024'); g.addColorStop(1, '#3c3e42');
        x.fillStyle = g; x.fillRect(x0 + 40, 40, 432, 196);
        x.fillStyle = 'rgba(255,250,235,0.85)'; x.fillRect(x0 + 60, 50, 392, 8);
        x.fillStyle = '#16171a';
        x.beginPath(); x.moveTo(x0 + 140, 236); x.lineTo(x0 + 160, 196); x.lineTo(x0 + 230, 180); x.lineTo(x0 + 320, 182); x.lineTo(x0 + 372, 205); x.lineTo(x0 + 380, 236); x.fill();
        x.fillStyle = '#b8bcc2'; for (let k = 0; k < 3; k++) x.fillRect(x0 + 60 + k * 140, 150, 60, 86);
      } else {
        x.fillStyle = '#b6b9bd'; x.fillRect(x0 + 40, 40, 432, 196);
        x.fillStyle = 'rgba(0,0,0,0.18)';
        for (let y = 44; y < 236; y += 10) x.fillRect(x0 + 40, y, 432, 2);
      }
      x.fillStyle = 'rgba(0,0,0,0.35)'; x.fillRect(x0 + 36, 36, 440, 4); x.fillRect(x0 + 36, 36, 4, 200); x.fillRect(x0 + 472, 36, 4, 200);
    }
    // glazing band
    const gg = x.createLinearGradient(0, 256, 0, 384);
    gg.addColorStop(0, '#5a7c98'); gg.addColorStop(0.5, '#1e3448'); gg.addColorStop(1, '#2c4a62');
    x.fillStyle = gg; x.fillRect(0, 256, 1024, 128);
    for (let k = 0; k < 6; k++) { x.fillStyle = `rgba(255,255,255,${0.06 + rng() * 0.08})`; x.beginPath(); const ox = rng() * 1024; x.moveTo(ox, 256); x.lineTo(ox + 60, 256); x.lineTo(ox - 20, 384); x.lineTo(ox - 80, 384); x.fill(); }
    x.fillStyle = '#e8eaec';
    for (let k = 0; k <= 16; k++) x.fillRect(k * 64 - 3, 256, 6, 128);
    x.fillRect(0, 256, 1024, 6); x.fillRect(0, 316, 1024, 4); x.fillRect(0, 378, 1024, 6);
    // name sign
    x.fillStyle = accent; x.fillRect(0, 384, 1024, 128);
    x.fillStyle = '#ffffff'; x.fillRect(0, 384, 1024, 6); x.fillRect(0, 506, 1024, 6);
    text(x, name, 512, 448, 84, '#ffffff', { max: 980 });
    return toTex(c);
  });
}

// ------------------------------------------------------------------ geometry helpers

/** Indexed triangle accumulator for ribbons/sweeps. */
class Acc {
  constructor() { this.p = []; this.uv = []; this.idx = []; }
  get n() { return this.p.length / 3; }
  /** Quad a→b→c→d (counter-clockwise seen from the front), uv per corner. */
  quad(pts, uvs) {
    const o = this.n;
    for (let k = 0; k < 4; k++) { this.p.push(pts[k].x, pts[k].y, pts[k].z); this.uv.push(uvs[k][0], uvs[k][1]); }
    this.idx.push(o, o + 1, o + 2, o, o + 2, o + 3);
  }
  mesh(mat, opts = {}) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.setIndex(this.n > 65535 ? new THREE.Uint32BufferAttribute(this.idx, 1) : new THREE.Uint16BufferAttribute(this.idx, 1));
    g.computeVertexNormals();
    if (opts.glow) g.setAttribute('glow', new THREE.BufferAttribute(new Float32Array(this.n * 3), 3));
    const m = new THREE.Mesh(g, mat);
    m.receiveShadow = opts.receive !== false;
    m.castShadow = !!opts.cast;
    return m;
  }
}

/**
 * Ribbon over samples k0..k1 (unwrapped, inclusive) on one side.
 * cols: [{ d(i) outward distance, y(i, x, z), u }]; v = s / vLen (alongU swaps u/v).
 */
function ribbon(acc, T, side, k0, k1, cols, vLen, alongU = false, stride = 1) {
  const base = acc.n, nc = cols.length;
  const ks = [];
  for (let k = k0; k < k1; k += stride) ks.push(k);
  ks.push(k1);
  for (const k of ks) {
    const i = T.idx(k), s = k * T.step;
    for (const col of cols) {
      const d = side * col.d(i);
      const x = T.X[i] + T.LX[i] * d, z = T.Z[i] + T.LZ[i] * d;
      acc.p.push(x, col.y(i, x, z), z);
      const u = typeof col.u === 'function' ? col.u(i) : col.u;
      if (alongU) acc.uv.push(side > 0 ? s / vLen : -s / vLen, u); else acc.uv.push(u, s / vLen);
    }
  }
  const rows = ks.length;
  for (let r = 0; r < rows - 1; r++) {
    for (let c = 0; c < nc - 1; c++) {
      const a = base + r * nc + c, b = a + nc;
      if (side > 0) acc.idx.push(a, b, b + 1, a, b + 1, a + 1);
      else acc.idx.push(a, b + 1, b, a, a + 1, b + 1);
    }
  }
}

/** Contiguous runs [k0, k1] (inclusive, unwrapped) where pred(i) holds. */
function runs(T, pred) {
  const N = T.N, out = [];
  let start = 0;
  while (start < N && pred(start)) start++;
  if (start === N) return [[0, N]];
  let r0 = -1;
  for (let k = start; k <= start + N; k++) {
    const on = k < start + N && pred(T.idx(k));
    if (on && r0 < 0) r0 = k;
    if (!on && r0 >= 0) { out.push([r0, k - 1]); r0 = -1; }
  }
  return out;
}

/** Quad facing horizontal normal (nx, nz), centered at (cx, cz), bottom at y. */
function faceQuad(gb, cx, y, cz, nx, nz, w, h, uvr) {
  const rx = nz * w / 2, rz = -nx * w / 2;
  const V = (a, b, c) => new THREE.Vector3(a, b, c);
  gb.quad(V(cx - rx, y, cz - rz), V(cx + rx, y, cz + rz), V(cx + rx, y + h, cz + rz), V(cx - rx, y + h, cz - rz), uvr);
}

/** Geometry merged per ~400 m cell so whole regions frustum-cull (and skip the shadow pass). */
class Chunks {
  constructor(size = 400) { this.size = size; this.map = new Map(); }
  at(x, z) {
    const k = Math.floor(x / this.size) * 4096 + Math.floor(z / this.size);
    let g = this.map.get(k);
    if (!g) { g = new GeoBuilder(); this.map.set(k, g); }
    return g;
  }
  meshes(mat, color, cast) {
    const out = [];
    for (const g of this.map.values()) {
      if (!g.count) continue;
      const m = new THREE.Mesh(g.build(color), mat);
      m.castShadow = cast;
      m.receiveShadow = true;
      out.push(m);
    }
    return out;
  }
}

/** Coloured box in a local frame (ez = away from the track), merged into its chunk. */
function boxF(ch, f, lx, lz, y, w, h, d, col) {
  const x = f.x + f.ex[0] * lx + f.ez[0] * lz, z = f.z + f.ex[1] * lx + f.ez[1] * lz;
  ch.at(x, z).setColor(...col).box(x, y, z, w, h, d, f.ry, { top: true });
}
const VF = (f, lx, y, lz) => new THREE.Vector3(f.x + f.ex[0] * lx + f.ez[0] * lz, y, f.z + f.ex[1] * lx + f.ez[1] * lz);

// ------------------------------------------------------------------ layout analysis

function analyzeCorners(T) {
  const N = T.N, st = T.step;
  const line = T.computeRacingLine(1.12);
  // add an acceleration limit (the line's profile only brakes)
  const v = Float32Array.from(line.speed);
  for (let pass = 0; pass < 2; pass++) for (let i = 0; i < N; i++) { const j = T.idx(i + 1); v[j] = Math.min(v[j], Math.sqrt(v[i] * v[i] + 9 * st)); }
  let start = 0;
  while (start < N && Math.abs(T.K[start]) > 1e-6) start++;
  const list = [];
  let run = null;
  for (let k = 0; k <= N; k++) {
    const kk = k < N ? T.K[T.idx(start + k)] : 0;
    const sg = Math.abs(kk) < 1e-6 ? 0 : Math.sign(kk);
    if (run && sg !== run.sign) { run.i1 = start + k; list.push(run); run = null; }
    if (!run && sg) run = { i0: start + k, sign: sg, kmax: 0, apex: start + k };
    if (run && Math.abs(kk) > run.kmax) { run.kmax = Math.abs(kk); run.apex = start + k; }
  }
  for (const c of list) {
    c.r = 1 / c.kmax;
    c.len = (c.i1 - c.i0) * st;
    c.angle = c.len * c.kmax;
    let vmin = 99, vin = v[T.idx(c.i0 - 1)];
    for (let k = c.i0; k < c.i1; k++) vmin = Math.min(vmin, v[T.idx(k)]);
    for (let k = c.i0 - 1; k > c.i0 - 260 / st && Math.abs(T.K[T.idx(k)]) < 1e-6; k--) vin = Math.max(vin, v[T.idx(k)]);
    c.vmin = vmin;
    c.vin = Math.min(vin, 72);
    c.sev = clamp((c.vin - vmin) / 38, 0, 1);
    c.fast = clamp((vmin - 20) / 24, 0, 1);
    c.s0 = c.i0 * st; c.s1 = c.i1 * st;
  }
  return list;
}

/** Walls (WL/WR), curbs, gravel traps and barrier kinds from the corner list. */
function layoutRunoff(T, corners, L) {
  const N = T.N, st = T.step, W = T.W, sh = T.shoulder;
  const mk = () => [new Float32Array(N), new Float32Array(N)];
  const want = mk(), cap = mk(), tire = mk(), grav = mk(), zone = mk();
  const curb = [new Uint8Array(N), new Uint8Array(N)];
  want[0].fill(8); want[1].fill(8); cap[0].fill(99); cap[1].fill(99);
  const span = (k0, k1, fn) => { for (let k = Math.floor(k0); k <= Math.ceil(k1); k++) fn(T.idx(k)); };
  for (const c of corners) {
    if (c.angle < 0.15) continue;
    const out = c.sign > 0 ? 1 : 0, inn = 1 - out;
    const big = clamp(c.angle / 1.1, 0.4, 1);
    const run = 9 + 15 * Math.max(c.sev, c.fast * 0.9) * big;
    const pre = (15 + 70 * c.sev) / st, post = (25 + 45 * c.fast) / st;
    span(c.i0 - pre * 0.7, c.i1 + post, (i) => { want[out][i] = Math.max(want[out][i], run); });
    if (run > 13) span(c.i0 - pre * 0.3, c.i1 + post * 0.7, (i) => { tire[out][i] = 1; });
    if (c.sev > 0.25 || c.fast > 0.3) span(c.i0 - pre * 0.2, c.i1 + post * 0.6, (i) => { grav[out][i] = 1; });
    span(c.i0, c.i1, (i) => { cap[inn][i] = Math.min(cap[inn][i], 5.5); });
    const n = c.i1 - c.i0, half = Math.max(9 / st, n * 0.3);
    span(c.apex - half, c.apex + half, (i) => { curb[inn][i] = 1; });
    span(c.apex + n * 0.1, c.i1 + 16 / st, (i) => { curb[out][i] = 1; });
    if (c.r < 80) span(c.i0 - 14 / st, c.i0 + n * 0.25, (i) => { curb[out][i] = 1; });
  }
  for (const [s0, s1, side, d, kind] of L.walls) {
    const q = side > 0 ? 0 : 1;
    span(s0 / st, s1 / st, (i) => { want[q][i] = d; cap[q][i] = d; zone[q][i] = kind; tire[q][i] = 0; grav[q][i] = 0; });
  }
  const dist = [null, null];
  for (const q of [0, 1]) {
    const side = q ? -1 : 1;
    const a = smoothArray(want[q], 10, true, 2);
    const cp = smoothArray(cap[q], 5, true, 2);
    for (let i = 0; i < N; i++) {
      let v = Math.min(a[i], cp[i]);
      const k = T.Ks[i] * side;
      if (k > 1e-4) v = Math.min(v, 0.85 / k - W[i] - 2);
      a[i] = Math.max(sh + 1.4, v);
    }
    // every wall point must belong to its own leg of the track
    for (let i = 0; i < N; i++) {
      for (let t = 0; t < 60 && a[i] > sh + 1.4; t++) {
        const d = side * (W[i] + a[i]);
        const j = T.nearestIndex(T.X[i] + T.LX[i] * d, T.Z[i] + T.LZ[i] * d, 2);
        let dj = Math.abs(j - i);
        dj = Math.min(dj, N - dj);
        if (j < 0 || dj * st < 70) break;
        a[i] = Math.max(sh + 1.4, a[i] - 0.75);
      }
    }
    const sm = smoothArray(a, 3, true, 1);
    for (let i = 0; i < N; i++) sm[i] = Math.min(sm[i], a[i] + 0.25);
    dist[q] = sm;
  }
  const gIn = mk(), gOut = mk(), kind = [new Uint8Array(N), new Uint8Array(N)];
  for (const q of [0, 1]) {
    const g = smoothArray(grav[q], 6, true, 2);
    const t = smoothArray(tire[q], 4, true, 1);
    for (let i = 0; i < N; i++) {
      const inner = W[i] + sh + 2.2, outer = W[i] + dist[q][i] - 1.6;
      const w = (outer - inner) * smoothstep(0.05, 0.6, g[i]);
      if (w > 1.5) { gIn[q][i] = inner; gOut[q][i] = inner + w; }
      kind[q][i] = zone[q][i] || (t[i] > 0.5 ? 1 : 0);
    }
    dropShortRuns(T, kind[q], 15);
  }
  for (let i = 0; i < N; i++) {
    T.curb[i] = curb[0][i] | curb[1][i];
    T.WL[i] = W[i] + dist[0][i];
    T.WR[i] = W[i] + dist[1][i];
  }
  return { dist, gIn, gOut, kind, curb };
}

/** Replace runs shorter than minLen samples with the value before them. */
function dropShortRuns(T, arr, minLen) {
  const N = T.N;
  let start = 0;
  while (start < N && arr[start] === arr[T.idx(start - 1)]) start++;
  if (start === N) return;
  for (let k = start; k < start + N;) {
    const v = arr[T.idx(k)];
    let n = 0;
    while (n < N && k + n < start + N && arr[T.idx(k + n)] === v) n++;
    if (n < minLen) { const prev = arr[T.idx(k - 1)]; for (let m = 0; m < n; m++) arr[T.idx(k + m)] = prev; }
    k += n;
  }
}

/** Gravel traps feel like gravel: wrap the track's ground query. */
function installSurfaces(T, lay) {
  const base = Object.getPrototypeOf(T).ground;
  const { gIn, gOut } = lay;
  T.ground = function ground(x, z, hint, out) {
    const g = base.call(this, x, z, hint, out);
    if (g.surface === 'grass') {
      const q = g.lat > 0 ? 0 : 1, a = Math.abs(g.lat);
      if (gOut[q][g.i] > 0 && a > gIn[q][g.i] && a < gOut[q][g.i]) g.surface = 'gravel';
    }
    return g;
  };
}

/** Flatten the heightfield under a pad (before the terrain mesh is built). */
function flatten(terrain, f, lx0, lx1, lz0, lz1, h, fall = 10) {
  const cx = (lx0 + lx1) / 2, cz = (lz0 + lz1) / 2, hw = (lx1 - lx0) / 2, hd = (lz1 - lz0) / 2;
  const ox = f.x + f.ex[0] * cx + f.ez[0] * cz, oz = f.z + f.ex[1] * cx + f.ez[1] * cz;
  const r = Math.hypot(hw, hd) + fall, cell = terrain.cell;
  const i0 = Math.max(0, Math.floor((ox - r - terrain.x0) / cell)), i1 = Math.min(terrain.nx - 1, Math.ceil((ox + r - terrain.x0) / cell));
  const j0 = Math.max(0, Math.floor((oz - r - terrain.z0) / cell)), j1 = Math.min(terrain.nz - 1, Math.ceil((oz + r - terrain.z0) / cell));
  for (let j = j0; j <= j1; j++) {
    for (let i = i0; i <= i1; i++) {
      const px = terrain.x0 + i * cell - ox, pz = terrain.z0 + j * cell - oz;
      const u = Math.abs(px * f.ex[0] + pz * f.ex[1]) - hw, v = Math.abs(px * f.ez[0] + pz * f.ez[1]) - hd;
      const w = 1 - smoothstep(0, fall, Math.max(u, v, 0));
      if (w <= 0) continue;
      const q = j * terrain.nx + i;
      const k = w * smoothstep(0, 0.12, terrain.roadMask[q]);
      terrain.H[q] += (h - terrain.H[q]) * k;
    }
  }
}

// ------------------------------------------------------------------ build

export async function build(world, def, track, progress) {
  const L = lookFor(def);
  const T = track, N = T.N, st = T.step;
  const terrain = world.terrain;
  const rng = makeRng('circuit' + def.id);
  const night = !!world.at.lamps;
  T.shoulder = def.shoulder ?? 1.5;
  T.offSurface = 'grass';
  const sh = T.shoulder;
  const ct = T._ct || {};
  const noise = ct.noise || makeNoise2D(7);
  const field = ct.field;

  // ---- layout: corners → walls, curbs, gravel
  const corners = analyzeCorners(T);
  const lay = layoutRunoff(T, corners, L);
  installSurfaces(T, lay);
  const wall = (i, side) => (side > 0 ? T.WL[i] : T.WR[i]);
  const edgeY = (i, side) => T.roadY(i, 0, side * T.W[i]);
  const tH = (x, z) => terrain.heightAt(x, z);
  const vergeDy = (e) => (e <= sh ? -0.03 * (e / sh) : e <= sh + 6 ? -0.03 - 0.28 * ((e - sh) / 6) : -0.31 - 0.24 * Math.min(1, (e - sh - 6) / 3));
  const frame = (s, side, d) => {
    const p = T.posAt(s, side * d), i = p.i;
    const ez = [T.LX[i] * side, T.LZ[i] * side];
    return { x: p.x, z: p.z, i, s, side, ez, ex: [ez[1], -ez[0]], ry: Math.atan2(ez[0], ez[1]) };
  };
  const sIdx = (s) => T.idx(Math.round(s / st));
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  // occupancy grid (8 m cells) keeps props and trees apart
  const occ = new Set();
  const OC = 8;
  const occKey = (x, z) => Math.floor(x / OC) * 100003 + Math.floor(z / OC);
  const occupy = (f, lx0, lx1, lz0, lz1) => {
    for (let a = lx0; a <= lx1 + 0.01; a += OC * 0.6) {
      for (let b = lz0; b <= lz1 + 0.01; b += OC * 0.6) occ.add(occKey(f.x + f.ex[0] * a + f.ez[0] * b, f.z + f.ex[1] * a + f.ez[1] * b));
    }
  };
  const isFree = (x, z) => !occ.has(occKey(x, z));
  progress(0.08, 'MARKING OUT THE RUNOFF');

  // ---- plan the big structures first so the ground can be graded under them
  const pads = [];
  const standMods = [];
  for (const [s0, s1, side, tiers] of L.stands) {
    const n = Math.max(1, Math.round((s1 - s0) / 12.5)), step = (s1 - s0) / n;
    for (let m = 0; m < n; m++) {
      const s = s0 + (m + 0.5) * step, i = sIdx(s);
      const f = frame(s, side, wall(i, side) + 2.4);
      const depth = 1.4 + tiers * 0.85 + 0.6;
      const gy = Math.min(edgeY(i, side) - 0.35, tH(f.x, f.z));
      standMods.push({ f, tiers, gy, w: step + 0.02 });
      pads.push([f, -step / 2 - 1, step / 2 + 1, -1, depth + 2, gy]);
      occupy(f, -step / 2, step / 2, -2, depth + 4);
    }
  }
  const P = L.pits;
  const pitSide = -1;
  const pitBays = [];
  for (let s = P.garages[0]; s + 12 <= P.garages[1] + 0.1; s += 12) {
    const i = sIdx(s + 6);
    const f = frame(s + 6, pitSide, wall(i, pitSide) + 12.9);
    const gy = edgeY(i, pitSide);
    pitBays.push({ f, gy, s });
    pads.push([f, -6.5, 6.5, -1, 70, gy - 0.35]);
    occupy(f, -6, 6, -14, 75);
  }
  for (let s = P.lane[0]; s <= P.lane[1]; s += 10) occupy(frame(s, pitSide, wall(sIdx(s), pitSide)), -5, 5, 0, 14);
  const lots = [];
  for (const [s, side, len, deep] of L.parking) {
    const i = sIdx(s);
    const f = frame(s, side, wall(i, side) + (side > 0 ? 34 : 80));
    const gy = tH(f.x, f.z);
    lots.push({ f, len, deep, gy });
    pads.push([f, -len / 2 - 4, len / 2 + 4, -4, deep + 4, gy]);
    occupy(f, -len / 2, len / 2, 0, deep);
  }
  for (const [f, a, b, c, d, h] of pads) flatten(terrain, f, a, b, c, d, h);

  // ---- terrain: grass with macro variation and darker forest floor, split into tiles
  const forestN = makeNoise2D(hashString(def.id + 'forest') % 9973);
  const forestAt = (x, z) => smoothstep(0.02, 0.22, forestN.fbm(x * 0.0045, z * 0.0045, 3) + L.forest.bias);
  {
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, map: grassTex(false), roughness: 1, envMapIntensity: 0.3 });
    const tm = terrain.mesh(mat, { flat: L.grass, steep: L.steep });
    const g = tm.geometry, uv = g.attributes.uv, pos = g.attributes.position, col = g.attributes.color;
    const sx = (terrain.nx - 1) * terrain.cell / 7, sz = (terrain.nz - 1) * terrain.cell / 7;
    for (let k = 0; k < uv.count; k++) uv.setXY(k, uv.getX(k) * sx, uv.getY(k) * sz);
    const ff = new THREE.Color(L.floor);
    for (let k = 0; k < col.count; k++) {
      const x = pos.getX(k), z = pos.getZ(k);
      const d = field ? field.at(x, z).d : 200;
      const m = 0.9 + 0.22 * noise.fbm(x * 0.011 + 5, z * 0.011 - 3, 3);
      const f = forestAt(x, z) * smoothstep(40, 110, d) * 0.8;
      col.setXYZ(k, lerp(col.getX(k) * m, ff.r, f), lerp(col.getY(k) * m, ff.g, f), lerp(col.getZ(k) * m, ff.b, f));
    }
    for (const t of tiles(tm, terrain.nx, terrain.nz, 3, 2)) world.add(t);
    g.dispose();
  }
  progress(0.18, 'MOWING THE INFIELD');
  await nextFrame();

  // ---- ground ribbons: mown verges, curbs, gravel traps, pit lane, paddock
  const gmat = (m) => (night ? glowMaterial(m, 1.5) : m);
  const glowMesh = (m) => { if (night) world.glowMeshes.push(m); return world.add(m); };
  {
    const verge = new Acc();
    for (const side of [1, -1]) {
      const lim = (i, d) => { const k = T.Ks[i] * side; return k > 1e-4 ? Math.min(d, 0.92 / k) : d; };
      const dys = [0, -0.03, -0.17, -0.31, -0.55];
      ribbon(verge, T, side, 0, N, [0, sh, sh + 3, sh + 6, sh + 9].map((e, c) => ({ d: (i) => lim(i, T.W[i] + e), y: (i) => edgeY(i, side) + dys[c], u: e / 4 })), 12);
    }
    glowMesh(verge.mesh(gmat(new THREE.MeshStandardMaterial({ map: grassTex(true), color: L.verge, roughness: 1, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 })), { glow: night }));

    const curbs = new Acc();
    for (const q of [0, 1]) {
      const side = q ? -1 : 1;
      for (const [k0, k1] of runs(T, (i) => lay.curb[q][i])) {
        ribbon(curbs, T, side, k0, k1 + 1, [[-0.05, 0.004, 0], [0.25, 0.06, 0.2], [1.1, 0.06, 0.8], [1.4, -0.02, 1]].map(([e, dy, u]) => ({ d: (i) => T.W[i] + e, y: (i) => edgeY(i, side) + dy, u })), 2.4);
      }
    }
    if (curbs.n) glowMesh(curbs.mesh(gmat(new THREE.MeshStandardMaterial({ map: curbTex(), roughness: 0.65, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 })), { glow: night }));

    const gravel = new Acc();
    for (const q of [0, 1]) {
      const side = q ? -1 : 1;
      for (const [k0, k1] of runs(T, (i) => lay.gOut[q][i] > 0)) {
        ribbon(gravel, T, side, k0, k1, [0, 0.5, 1].map((f) => {
          const d = (i) => lerp(lay.gIn[q][i], lay.gOut[q][i], f);
          return { d, y: (i, x, z) => Math.max(edgeY(i, side) + vergeDy(d(i) - T.W[i]), tH(x, z)) + 0.035, u: (i) => d(i) / 5 };
        }), 5);
      }
    }
    if (gravel.n) glowMesh(gravel.mesh(gmat(new THREE.MeshStandardMaterial({ map: gravelTex(), color: L.gravel, roughness: 1, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 })), { glow: night }));

    // pit lane (tapers into the pit wall at both ends), paddock and car parks
    const apron = new Acc();
    const taper = (i) => {
      let s = T.S[i];
      if (s < P.lane[0] - 50) s += T.length;
      return smoothstep(P.lane[0], P.lane[0] + 70, s) * (1 - smoothstep(P.lane[1] - 70, P.lane[1], s));
    };
    const pw = (i) => wall(i, pitSide) + 0.38;
    const pout = (i) => pw(i) + 0.05 + 12.6 * taper(i);
    ribbon(apron, T, pitSide, Math.round(P.lane[0] / st), Math.round(P.lane[1] / st), [
      { d: pw, y: (i) => edgeY(i, pitSide) + 0.02, u: 0 },
      { d: (i) => lerp(pw(i), pout(i), 0.5), y: (i) => edgeY(i, pitSide) + 0.02, u: 0.8 },
      { d: pout, y: (i) => edgeY(i, pitSide) + 0.02, u: 1.6 },
      { d: (i) => pout(i) + 0.05, y: (i) => edgeY(i, pitSide) - 0.6, u: 1.7 },
    ], 8);
    const flatGrid = (f, lx0, lx1, lz0, lz1, y) => {
      const nx = Math.max(2, Math.ceil((lx1 - lx0) / 8) + 1), nz = Math.max(2, Math.ceil((lz1 - lz0) / 8) + 1);
      for (let b = 0; b < nz - 1; b++) {
        for (let a = 0; a < nx - 1; a++) {
          const c = [[a, b], [a, b + 1], [a + 1, b + 1], [a + 1, b]].map(([p, q]) => VF(f, lerp(lx0, lx1, p / (nx - 1)), y, lerp(lz0, lz1, q / (nz - 1))));
          apron.quad(c, c.map((v) => [v.x / 8, v.z / 8]));
        }
      }
    };
    for (const bay of pitBays) flatGrid(bay.f, -6.02, 6.02, 17.5, 66, bay.gy - 0.27);
    for (const lot of lots) flatGrid(lot.f, -lot.len / 2, lot.len / 2, 0, lot.deep, lot.gy + 0.08);
    glowMesh(apron.mesh(gmat(new THREE.MeshStandardMaterial({ map: asphaltTex(), roughness: 0.92, side: DS, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 })), { glow: night }));
  }
  progress(0.3, 'BOLTING THE ARMCO');

  // ---- barriers at the wall line: concrete + ads, tire walls, armco; catch fences
  const props = new Chunks(420);
  const faces = new GeoBuilder();
  const crowd = new GeoBuilder();
  const facade = new GeoBuilder();
  const C = {
    conc: rgb('#bdbcb6'), steel: rgb('#6a7178'), dark: rgb('#2a2c30'), white: rgb('#f2f2ee'), roof: rgb(L.roof),
    seatA: rgb(L.seats[0]), seatB: rgb(L.seats[1]), bld: rgb(L.building), orange: rgb('#ff7a1a'), yellow: rgb('#ffd21a'),
    green: rgb('#2a9a48'), blue: rgb('#1d4fa8'), black: rgb('#151517'),
  };
  {
    const conc = new Acc(), tires = new Acc(), armco = new Acc(), fence = new Acc();
    for (const q of [0, 1]) {
      const side = q ? -1 : 1;
      const by = new Float32Array(N);
      for (let i = 0; i < N; i++) {
        const d = side * wall(i, side);
        by[i] = Math.max(edgeY(i, side) + vergeDy(wall(i, side) - T.W[i]), tH(T.X[i] + T.LX[i] * d, T.Z[i] + T.LZ[i] * d));
      }
      const sweep = (acc, k0, k1, pts, uLen, stride = 1) => {
        ribbon(acc, T, side, k0, k1, pts.map(([dl, dy, v]) => ({ d: (i) => wall(i, side) + dl, y: (i) => by[i] + dy, u: v })), uLen, true, stride);
      };
      for (const [k0, k1] of runs(T, (i) => lay.kind[q][i] === 2)) {
        sweep(conc, k0, k1 + 1, [[0, -0.3, 0.5], [0, 0.32, 0.625], [0, 1.05, 0.985]], 40);
        sweep(conc, k0, k1 + 1, [[0, 1.05, 0.06], [0.32, 1.05, 0.14]], 40, 2);
        sweep(conc, k0, k1 + 1, [[0.32, 1.05, 0.2], [0.32, -0.3, 0.45]], 40, 2);
        sweep(fence, k0, k1 + 1, [[0.16, 1.05, 0], [0.16, 4.3, 3.25]], 1.1, 2);
        sweep(armco, k0, k1 + 1, [[0.1, 4.3, 0.2], [0.22, 4.3, 0.8]], 4, 2);
      }
      for (const [k0, k1] of runs(T, (i) => lay.kind[q][i] === 1)) {
        sweep(tires, k0, k1 + 1, [[0, -0.2, 0], [0.02, 0.4, 0.36], [0, 0.85, 0.72]], 2.4);
        sweep(tires, k0, k1 + 1, [[0, 0.85, 0.74], [0.9, 0.85, 0.99]], 2.4, 2);
        sweep(tires, k0, k1 + 1, [[0.9, 0.85, 0.72], [0.9, -0.2, 0]], 2.4, 2);
        sweep(fence, k0, k1 + 1, [[1.05, 0, 0], [1.05, 3.8, 3.8]], 1.1, 2);
        sweep(armco, k0, k1 + 1, [[1.0, 3.8, 0.2], [1.12, 3.8, 0.8]], 4, 2);
      }
      for (const [k0, k1] of runs(T, (i) => lay.kind[q][i] === 0)) {
        sweep(armco, k0, k1 + 1, [[0.02, 0.33, 0], [0, 0.47, 0.25], [0.02, 0.61, 0.5], [0.02, 0.63, 0.5], [0, 0.77, 0.75], [0.02, 0.91, 1]], 4, 2);
        sweep(armco, k0, k1 + 1, [[0.09, 0.91, 1], [0.09, 0.33, 0]], 4, 2);
      }
      // posts: armco 4 m apart, catch-fence uprights 4 m apart
      for (let s = 0; s < T.length; s += 4) {
        const i = sIdx(s), kd = lay.kind[q][i];
        const f = frame(s, side, wall(i, side) + (kd === 0 ? 0.16 : kd === 2 ? 0.16 : 1.05));
        if (kd === 0) boxF(props, f, 0, 0, by[i] - 0.2, 0.1, 1.1, 0.14, C.steel);
        else boxF(props, f, 0, 0, by[i] + (kd === 2 ? 1.05 : 0), 0.09, kd === 2 ? 3.3 : 3.85, 0.09, C.steel);
      }
    }
    if (conc.n) world.add(conc.mesh(new THREE.MeshStandardMaterial({ map: wallTex(), roughness: 0.85, envMapIntensity: 0.4 }), { cast: !night }));
    if (tires.n) world.add(tires.mesh(new THREE.MeshStandardMaterial({ map: tireTex(), roughness: 0.95, envMapIntensity: 0.2 })));
    if (armco.n) world.add(armco.mesh(new THREE.MeshStandardMaterial({ map: armcoTex(), roughness: 0.4, metalness: 0.6, side: DS })));
    const fm = fence.mesh(new THREE.MeshStandardMaterial({ map: fenceTex(), transparent: true, depthWrite: false, side: DS, roughness: 0.6, metalness: 0.3 }));
    fm.renderOrder = 2;
    world.add(fm);
  }
  progress(0.42, 'RAISING THE GRANDSTANDS');
  await nextFrame();

  // ---- grandstands: stepped concrete tiers, a crowd on every row, cantilever roof
  const atlas = adAtlas(def.name, L.accent);
  standMods.forEach(({ f, tiers, gy, w }, n) => {
    const run = 0.85, rise = 0.5, podium = 2.0;
    boxF(props, f, 0, 0.7, gy - 1, w, podium + 1, 1.4, C.conc);
    for (let k = 0; k < tiers; k++) {
      const z0 = 1.4 + k * run, top = podium + (k + 1) * rise;
      boxF(props, f, 0, z0 + run / 2, gy - 1, w, top + 1, run, k % 2 ? C.seatA : C.seatB);
      if (rng() < 0.94) {
        const u0 = rng() * 4;
        const a = VF(f, w / 2, gy + top - 0.05, z0 + 0.3), b = VF(f, -w / 2, gy + top - 0.05, z0 + 0.3);
        crowd.quad(a, b, b.clone().setY(gy + top + 1.0), a.clone().setY(gy + top + 1.0), [u0, 0, u0 + w / 8.8, 1]);
      }
    }
    const back = 1.4 + tiers * run, topY = podium + tiers * rise;
    boxF(props, f, 0, back + 0.2, gy - 1, w, topY + 5.2, 0.4, C.conc);
    const r0 = VF(f, -w / 2, gy + topY + 4.2, back + 0.4), r1 = VF(f, w / 2, gy + topY + 4.2, back + 0.4);
    const r2 = VF(f, w / 2, gy + topY + 3.3, -0.4), r3 = VF(f, -w / 2, gy + topY + 3.3, -0.4);
    const rb = props.at(f.x, f.z).setColor(...C.roof);
    rb.quad(r0, r1, r2, r3);
    rb.quad(r3.clone().setY(r3.y - 0.35), r2.clone().setY(r2.y - 0.35), r2, r3);
    boxF(props, f, w / 2 - 0.2, back - 0.3, gy, 0.3, topY + 4.2, 0.3, C.steel);
    const p = VF(f, 0, 0, -0.03);
    faceQuad(faces, p.x, gy + 0.45, p.z, -f.ez[0], -f.ez[1], Math.min(w - 0.4, 3.2), 1.4, slotUV(n % 7));
  });
  progress(0.5, 'OPENING THE PIT LANE');

  // ---- pit building: garages, glazed hospitality floor, race control, paddock trucks
  pitBays.forEach((bay, b) => {
    const { f, gy } = bay;
    const team = rgb(TEAMS[b % TEAMS.length]);
    boxF(props, f, 0, 9, gy - 0.6, 12.02, 6.8, 18, C.bld);
    boxF(props, f, 0, 9.4, gy + 6.2, 12.02, 4.2, 15.2, C.bld);
    boxF(props, f, 0, 8.6, gy + 10.4, 12.04, 0.5, 21, C.roof);
    boxF(props, f, 0, 0.9, gy + 6.2, 12.04, 0.25, 2.0, C.conc);
    boxF(props, f, 0, -0.08, gy + 5.0, 10.6, 0.7, 0.16, team);
    const a = VF(f, 6, gy, -0.03), bb = VF(f, -6, gy, -0.03);
    facade.quad(a, bb, bb.clone().setY(gy + 6), a.clone().setY(gy + 6), [(b % 2) * 0.5 + 0.002, 0.5, (b % 2) * 0.5 + 0.498, 0.998]);
    const g0 = VF(f, 6, gy + 6.45, 1.78), g1 = VF(f, -6, gy + 6.45, 1.78);
    facade.quad(g0, g1, g1.clone().setY(gy + 10.3), g0.clone().setY(gy + 10.3), [(b % 2) * 0.5, 0.25, (b % 2) * 0.5 + 0.5, 0.5]);
    // team stand on the pit wall
    const fw = frame(bay.s + 6, pitSide, wall(f.i, pitSide) + 0.4);
    boxF(props, fw, 0, 1.2, gy, 3.4, 0.9, 1.6, C.dark);
    boxF(props, fw, 0, 1.2, gy + 3.0, 4.0, 0.15, 2.4, team);
    boxF(props, fw, -1.8, 1.2, gy, 0.12, 3.0, 0.12, C.steel);
    boxF(props, fw, 1.8, 1.2, gy, 0.12, 3.0, 0.12, C.steel);
    // paddock: transporters + motorhomes
    if (b % 2 === 0) {
      boxF(props, f, 0, 30, gy - 0.3, 2.6, 4.1, 13.6, rgb(TEAMS[(b / 2) % TEAMS.length]));
      boxF(props, f, 0, 38.4, gy - 0.3, 2.5, 3.3, 2.6, C.white);
      boxF(props, f, 5, 46, gy - 0.3, 2.5, 3.4, 11, C.white);
    }
  });
  {
    const ti = sIdx(P.tower);
    const tf = frame(P.tower, pitSide, wall(ti, pitSide) + 12.9);
    const ty = edgeY(ti, pitSide);
    boxF(props, tf, 0, 9, ty + 10.9, 26, 7.5, 13, C.bld);
    boxF(props, tf, 0, 9, ty + 18.4, 28, 0.5, 15, C.roof);
    const ga = VF(tf, 13, ty + 12, 2.47), gb = VF(tf, -13, ty + 12, 2.47);
    facade.quad(ga, gb, gb.clone().setY(ty + 15.6), ga.clone().setY(ty + 15.6), [0, 0.25, 1, 0.5]);
    const sa = VF(tf, 13, ty + 15.8, 2.46), sb = VF(tf, -13, ty + 15.8, 2.46);
    facade.quad(sa, sb, sb.clone().setY(ty + 18.3), sa.clone().setY(ty + 18.3), [0, 0.003, 1, 0.247]);
  }

  // ---- start/finish gantry with working lights
  const lights = [];
  {
    const s = T.startS, i = sIdx(s), y0 = T.Y[i];
    boxF(props, frame(s, 1, T.WL[i] + 1.4), 0, 0, y0 - 0.5, 1.1, 10.2, 1.1, C.steel);
    boxF(props, frame(s, -1, T.WR[i] + 1.4), 0, 0, y0 - 0.5, 1.1, 10.2, 1.1, C.steel);
    boxF(props, frame(s, 1, (T.WL[i] - T.WR[i]) / 2), 0, 0, y0 + 7.4, 1.6, 1.4, T.WL[i] + T.WR[i] + 2.8, C.steel);
    const c0 = frame(s, 1, 0);
    boxF(props, c0, 0, 0, y0 + 5.5, 0.55, 1.9, 5.4, C.black);
    boxF(props, c0, 0, 0, y0 + 8.8, 0.5, 3.6, 14.4, C.dark);
    const tx = T.TX[i], tz = T.TZ[i];
    for (const sg of [-1, 1]) faceQuad(faces, c0.x + tx * sg * 0.27, y0 + 8.9, c0.z + tz * sg * 0.27, tx * sg, tz * sg, 14, 3.4, slotUV(5));
    for (let col = 0; col < 5; col++) {
      const lat = (col - 2) * 1.0;
      for (let r = 0; r < 3; r++) lights.push({ x: c0.x + T.LX[i] * lat - tx * 0.3, y: y0 + 6.95 - r * 0.42, z: c0.z + T.LZ[i] * lat - tz * 0.3, red: r < 2, col });
    }
    const geo = new THREE.CylinderGeometry(0.17, 0.17, 0.1, 12);
    geo.rotateX(Math.PI / 2);
    const im = new THREE.InstancedMesh(geo, new THREE.MeshBasicMaterial({ color: 0xffffff }), lights.length);
    const m4 = new THREE.Matrix4(), q4 = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, Math.atan2(tx, tz), 0)), one = V(1, 1, 1);
    const redOn = new THREE.Color(5, 0.25, 0.15), redOff = new THREE.Color(0.08, 0.012, 0.01);
    const grnOn = new THREE.Color(0.3, 5, 0.8), grnOff = new THREE.Color(0.01, 0.06, 0.02);
    lights.forEach((l, k) => { im.setMatrixAt(k, m4.compose(V(l.x, l.y, l.z), q4, one)); im.setColorAt(k, l.red ? redOff : grnOff); });
    world.add(im);
    let last = '';
    world.animators.push(() => {
      // countdown: a column of reds per beat; lights out + greens at the start
      const sim = globalThis.__game?.screen?.session?.sim;
      let lit = 0, go = false;
      if (sim?.state === 'countdown') lit = clamp(Math.floor((3 - sim.countdown) / 0.6) + 1, 0, 5);
      else if (sim?.state === 'racing' && sim.raceTime < 3) go = true;
      const key = lit + '|' + go;
      if (key === last) return;
      last = key;
      lights.forEach((l, k) => im.setColorAt(k, l.red ? (l.col < lit ? redOn : redOff) : go ? grnOn : grnOff));
      im.instanceColor.needsUpdate = true;
    });
  }

  // ---- footbridge with a sponsor panel each way
  if (L.bridge) {
    const s = L.bridge, i = sIdx(s), y0 = T.Y[i];
    const dL = T.WL[i] + 7, dR = T.WR[i] + 7;
    const c0 = frame(s, 1, (dL - dR) / 2);
    boxF(props, c0, 0, 0, y0 + 6.9, 3.2, 0.8, dL + dR, C.bld);
    boxF(props, c0, 0, 0, y0 + 10.1, 3.6, 0.3, dL + dR, C.roof);
    for (const [sd, d] of [[1, dL], [-1, dR]]) {
      const ft = frame(s, sd, d + 2.4);
      boxF(props, ft, 0, 0, y0 - 1, 4.8, 11.4, 4.8, C.bld);
      boxF(props, ft, 0, 0, y0 + 10.4, 5.4, 0.3, 5.4, C.roof);
      occupy(ft, -4, 4, -4, 4);
    }
    const tx = T.TX[i], tz = T.TZ[i];
    faceQuad(faces, c0.x - tx * 1.62, y0 + 7.7, c0.z - tz * 1.62, -tx, -tz, dL + dR - 1, 2.4, slotUV(0));
    faceQuad(faces, c0.x + tx * 1.62, y0 + 7.7, c0.z + tz * 1.62, tx, tz, dL + dR - 1, 2.4, slotUV(2));
    for (const sg of [-1, 1]) boxF(props, { ...c0, x: c0.x + tx * sg * 1.5, z: c0.z + tz * sg * 1.5 }, 0, 0, y0 + 9.95, 0.12, 0.12, dL + dR, C.steel);
  }
  progress(0.6, 'HANGING THE BANNERS');

  // ---- sponsor boards (braking zones + straights), braking boards, chevrons, marshal posts
  const board = (s, side, off, w, h, legH, slot, yaw = 0.35) => {
    const i = sIdx(s);
    const f = frame(s, side, wall(i, side) + off);
    if (!isFree(f.x, f.z)) return;
    const gy = tH(f.x, f.z);
    const tx = T.TX[i], tz = T.TZ[i], lx = -f.ez[0], lz = -f.ez[1];
    let nx = -tx * Math.cos(yaw) + lx * Math.sin(yaw), nz = -tz * Math.cos(yaw) + lz * Math.sin(yaw);
    const l = Math.hypot(nx, nz);
    nx /= l; nz /= l;
    faceQuad(faces, f.x, gy + legH, f.z, nx, nz, w, h, slotUV(slot));
    const ry = Math.atan2(nx, nz), g = props.at(f.x, f.z).setColor(...C.dark);
    g.box(f.x - nx * 0.18, gy + legH - 0.15, f.z - nz * 0.18, w + 0.3, h + 0.3, 0.25, ry);
    for (const sg of [-0.32, 0.32]) g.box(f.x - nx * 0.3 + nz * sg * w, gy - 0.5, f.z - nz * 0.3 - nx * sg * w, 0.3, legH + 0.5, 0.3, ry);
    occ.add(occKey(f.x, f.z));
  };
  let slotK = 0;
  for (const c of corners) {
    const side = -c.sign;
    if (c.sev > 0.45) {
      board(c.s0 - 130, side, 5, 12, 6, 4.5, slotK++ % 7);
      board(c.s0 - 45, side, 4, 8, 4, 3, slotK++ % 7, 0.55);
    }
    if (c.sev > 0.5) {
      [300, 200, 100].forEach((D, j) => {
        const s = c.s0 - D, i = sIdx(s);
        if (Math.abs(T.K[i]) > 1 / 300) return;
        const f = frame(s, side, wall(i, side) + 0.7), gy = tH(f.x, f.z);
        boxF(props, f, 0, 0, gy - 0.3, 0.12, 1.6, 0.12, C.steel);
        faceQuad(faces, f.x, gy + 1.2, f.z, -T.TX[i], -T.TZ[i], 1.5, 0.75, boardUV(j));
      });
    }
    if (c.r < 40 && c.angle > 1) {
      for (let k = -1; k <= 1; k++) {
        const s = c.apex * st + k * 9, i = sIdx(s);
        const f = frame(s, side, wall(i, side) + 0.6), gy = tH(f.x, f.z);
        faceQuad(faces, f.x, gy + 1.0, f.z, -f.ez[0], -f.ez[1], 2.4, 1.2, boardUV(3));
      }
    }
  }
  for (let s = 150; s < T.length - 100; s += 230) {
    if (Math.abs(T.Ks[sIdx(s)]) > 1 / 500) continue;
    board(s, Math.floor(s / 230) % 2 ? 1 : -1, 7 + rng() * 6, 10, 5, 3.5, slotK++ % 7, 0.25);
  }
  corners.forEach((c, n) => {
    if (c.angle < 0.4) return;
    const s = c.s1 + 18, side = -c.sign, i = sIdx(s);
    const f = frame(s, side, wall(i, side) + 3.2);
    if (!isFree(f.x, f.z)) return;
    const gy = tH(f.x, f.z);
    boxF(props, f, 0, 1.2, gy - 0.3, 2.4, 2.5, 2.0, C.white);
    boxF(props, f, 0, 1.2, gy + 2.2, 2.9, 0.18, 2.6, C.orange);
    boxF(props, f, 0.6, 0.0, gy + 0.9, 1.6, 0.12, 0.06, C.orange);
    boxF(props, f, -1.6, 0.4, gy - 0.3, 0.07, 3.6, 0.07, C.steel);
    boxF(props, f, -1.95, 0.4, gy + 2.6, 0.7, 0.5, 0.03, [C.yellow, C.green, C.blue][n % 3]);
    occ.add(occKey(f.x, f.z));
  });

  // ---- rubber in the braking zones, grid boxes, pit lane line
  {
    const dec = new Acc();
    const line = T.line;
    for (const c of corners) {
      if (c.sev < 0.35) continue;
      for (let m = 0; m < 6; m++) {
        const len = 25 + rng() * 55, endS = c.s0 + (rng() - 0.3) * 20, j = (rng() - 0.5) * 1.6;
        const k0 = Math.round((endS - len) / st), k1 = Math.round(endS / st);
        for (const w of [-0.8, 0.8]) {
          const off = (i) => clamp(line.off[i] + j + w, -T.W[i] + 0.5, T.W[i] - 0.5);
          ribbon(dec, T, 1, k0, k1, [-0.12, 0.12].map((e, ci) => ({ d: (i) => off(i) + e, y: (i) => T.roadY(i, 0, off(i) + e) + 0.012, u: ci * 0.5 })), 9);
        }
      }
    }
    const paint = (s0, s1, lat0, lat1) => {
      const P3 = (s, lt) => { const p = T.posAt(s, lt); return V(p.x, p.y + 0.012, p.z); };
      dec.quad([P3(s0, lat0), P3(s1, lat0), P3(s1, lat1), P3(s0, lat1)], [[0.55, 0], [0.55, 0.2], [0.95, 0.2], [0.95, 0]]);
    };
    for (let k = 0; k < 12; k++) {
      const row = k >> 1, col = k & 1;
      const s = T.startS - 8 - row * 8.5 - col * 3;
      const lat = (col ? -1 : 1) * Math.min(T.W[sIdx(s)] * 0.42, 3.4);
      paint(s + 2.4, s + 2.6, lat - 1.2, lat + 1.2);
      paint(s + 1.2, s + 2.6, lat - 1.2, lat - 1.05);
      paint(s + 1.2, s + 2.6, lat + 1.05, lat + 1.2);
    }
    ribbon(dec, T, pitSide, Math.round((P.lane[0] + 60) / st), Math.round((P.lane[1] - 60) / st), [6.8, 7.0].map((e, ci) => ({ d: (i) => wall(i, pitSide) + e, y: (i) => edgeY(i, pitSide) + 0.035, u: 0.52 + ci * 0.46 })), 4);
    const dm = dec.mesh(new THREE.MeshStandardMaterial({ map: decalTex(), transparent: true, depthWrite: false, roughness: 0.85, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 }));
    dm.renderOrder = 1;
    world.add(dm);
  }
  progress(0.7, 'SEATING THE CROWD');
  await nextFrame();

  // ---- spectators on the grass banks (crowd cards), gazebos, parked cars
  const cars = [];
  for (const [s0, s1, side] of L.banks || []) {
    for (let r = 0; r < 6; r++) {
      for (let s = s0; s < s1; s += 9) {
        if (rng() < 0.12 + r * 0.05) continue;
        const i = sIdx(s), d = wall(i, side) + 4.5 + r * 2.6 + rng() * 0.6;
        const fa = frame(s, side, d), fb = frame(s + 9, side, d + (rng() - 0.5) * 0.8);
        if (!isFree(fa.x, fa.z)) continue;
        const a = V(fa.x, tH(fa.x, fa.z) - 0.1, fa.z), b = V(fb.x, tH(fb.x, fb.z) - 0.1, fb.z);
        const [l, rr] = side > 0 ? [a, b] : [b, a];
        const u0 = rng() * 4;
        crowd.quad(l, rr, rr.clone().setY(rr.y + 1.05), l.clone().setY(l.y + 1.05), [u0, 0, u0 + 9 / 8.8, 1]);
      }
    }
    for (let s = s0 + 8; s < s1; s += 26 + rng() * 20) {
      const f = frame(s, side, wall(sIdx(s), side) + 20 + rng() * 6);
      const gy = tH(f.x, f.z);
      boxF(props, f, 0, 0, gy, 0.08, 2.4, 0.08, C.steel);
      props.at(f.x, f.z).setColor(...rgb(TEAMS[(rng() * 6) | 0])).cylinder(f.x, gy + 2.1, f.z, 1.8, 0.6, 8, 0.05);
    }
  }
  for (const lot of lots) {
    for (let a = -lot.len / 2 + 3; a < lot.len / 2 - 3; a += 2.9) {
      for (let b = 6; b < lot.deep - 4; b += 7) {
        if (rng() < 0.25) continue;
        const v = VF(lot.f, a, 0, b + (rng() - 0.5) * 0.4);
        cars.push({ x: v.x, y: lot.gy + 0.08, z: v.z, ry: lot.f.ry + (Math.floor(b / 7) % 2 ? Math.PI : 0) + (rng() - 0.5) * 0.08, color: TEAMS[(rng() * TEAMS.length) | 0] });
      }
    }
  }
  if (cars.length) {
    const g = new GeoBuilder();
    g.setColor(1, 1, 1).box(0, 0.25, 0, 1.8, 0.75, 4.3, 0);
    g.setColor(0.12, 0.13, 0.15).box(0, 1.0, -0.2, 1.6, 0.55, 2.2, 0);
    world.add(instancedColor(g.build(true), cars, true));
  }

  // ---- merge: props per region (cast shadows), sponsor faces, crowds, facades
  const propMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.75, metalness: 0.05, side: DS });
  for (const m of props.meshes(propMat, true, !night)) world.add(m);
  world.add(new THREE.Mesh(faces.build(), new THREE.MeshStandardMaterial({ map: atlas, roughness: 0.55, emissive: 0xffffff, emissiveMap: atlas, emissiveIntensity: night ? 0.5 : 0, side: DS })));
  if (crowd.count) world.add(new THREE.Mesh(crowd.build(), new THREE.MeshStandardMaterial({ map: crowdTex(), alphaTest: 0.5, roughness: 0.9, side: DS })));
  if (facade.count) {
    const ft = facadeTex(def.name, L.accent);
    world.add(new THREE.Mesh(facade.build(), new THREE.MeshStandardMaterial({ map: ft, roughness: 0.45, metalness: 0.15, emissive: 0xffffff, emissiveMap: ft, emissiveIntensity: night ? 0.35 : 0, side: DS })));
  }
  progress(0.8, L.forest.conifer > 0.5 ? 'PLANTING REDWOODS' : 'PLANTING OAKS');
  await nextFrame();

  // ---- trees: forest away from the track, scattered in the infield; LOD by distance, chunked
  {
    const F = L.forest;
    const x0 = terrain.x0 + 30, z0 = terrain.z0 + 30;
    const x1 = terrain.x0 + (terrain.nx - 1) * terrain.cell - 30, z1 = terrain.z0 + (terrain.nz - 1) * terrain.cell - 30;
    const cand = [];
    for (let z = z0; z < z1; z += 12) {
      for (let x = x0; x < x1; x += 12) {
        const px = x + (rng() - 0.5) * 11, pz = z + (rng() - 0.5) * 11;
        const fd = field ? field.at(px, pz) : { d: 200, inside: 0 };
        const d = fd.d;
        if (d < 18) continue;
        let p = forestAt(px, pz) * (fd.inside > 0.5 ? F.infield : 1);
        p *= d < 250 ? 1 : d < 450 ? 0.55 : 0.3;
        p = Math.max(p, d < 140 ? 0.05 : 0);
        if (rng() > p) continue;
        cand.push([px, pz, d]);
      }
    }
    cand.sort((a, b) => a[2] - b[2]);
    const sets = new Map();
    let count = 0;
    for (const [px, pz, d] of cand) {
      if (count >= F.count) break;
      if (!isFree(px, pz)) continue;
      if (d < 80) {
        const j = T.nearestIndex(px, pz, 2);
        if (j < 0) continue;
        const lat = (px - T.X[j]) * T.LX[j] + (pz - T.Z[j]) * T.LZ[j];
        if (Math.abs(lat) < (lat > 0 ? T.WL[j] : T.WR[j]) + 7) continue;
      }
      const y = tH(px, pz) - 0.3, con = rng() < F.conifer;
      const h = con ? lerp(F.coniferH[0], F.coniferH[1], rng() ** 1.4) : lerp(F.oakH[0], F.oakH[1], rng());
      const wf = con ? 0.15 + rng() * 0.05 : 0.5 + rng() * 0.2;
      const lod = d < 160 ? 0 : 1, cs = lod ? 1100 : 550;
      const key = `${con ? 'c' : 'o'}${lod}|${Math.floor(px / cs)}|${Math.floor(pz / cs)}`;
      if (!sets.has(key)) sets.set(key, []);
      sets.get(key).push({ x: px, y, z: pz, ry: rng() * 6.28, sx: h * wf, sy: h, sz: h * wf, color: tint(rng, 0.78, 1.08, 0.06) });
      count++;
    }
    const tmat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92, side: DS, envMapIntensity: 0.25 });
    const geos = { c0: coniferGeo(L, 0), c1: coniferGeo(L, 1), o0: oakGeo(0), o1: oakGeo(1) };
    for (const [key, list] of sets) world.add(instancedColor(geos[key.slice(0, 2)], list, false, tmat));
  }

  // ---- distant hills beyond the terrain grid
  world.add(farRing(terrain, L, ct.natural || (() => 0), noise));
  progress(1, 'CIRCUIT READY');
}

/** Split the terrain plane into tiles so off-screen parts are culled. */
function tiles(mesh, nx, nz, tx, tz) {
  const g = mesh.geometry, out = [];
  const A = { position: 3, normal: 3, color: 3, uv: 2 };
  for (let a = 0; a < tx; a++) {
    for (let b = 0; b < tz; b++) {
      const ix0 = Math.floor((a * (nx - 1)) / tx), ix1 = Math.floor(((a + 1) * (nx - 1)) / tx);
      const iy0 = Math.floor((b * (nz - 1)) / tz), iy1 = Math.floor(((b + 1) * (nz - 1)) / tz);
      const w = ix1 - ix0 + 1, h = iy1 - iy0 + 1;
      const ng = new THREE.BufferGeometry();
      for (const [name, size] of Object.entries(A)) {
        const src = g.attributes[name].array, dst = new Float32Array(w * h * size);
        for (let iy = iy0; iy <= iy1; iy++) {
          for (let ix = ix0; ix <= ix1; ix++) {
            const si = (iy * nx + ix) * size, di = ((iy - iy0) * w + (ix - ix0)) * size;
            for (let c = 0; c < size; c++) dst[di + c] = src[si + c];
          }
        }
        ng.setAttribute(name, new THREE.BufferAttribute(dst, size));
      }
      const idx = [];
      for (let iy = 0; iy < h - 1; iy++) {
        for (let ix = 0; ix < w - 1; ix++) {
          const p = iy * w + ix, q = p + w;
          idx.push(p, q, p + 1, q, q + 1, p + 1);
        }
      }
      ng.setIndex(idx);
      const m = new THREE.Mesh(ng, mesh.material);
      m.receiveShadow = true;
      out.push(m);
    }
  }
  return out;
}

function tint(rng, a, b, hue) {
  const v = a + rng() * (b - a);
  return new THREE.Color(v * (1 + (rng() - 0.5) * hue), v, v * (1 - (rng() - 0.5) * hue));
}

/** InstancedMesh from {x,y,z,ry,s|sx,sy,sz,color}: vertex colors × instance colors. */
function instancedColor(geo, list, noShadow, material) {
  const mat = material || new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7 });
  const im = new THREE.InstancedMesh(geo, mat, list.length);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3(), sc = new THREE.Vector3();
  const col = new THREE.Color();
  list.forEach((o, k) => {
    q.setFromEuler(e.set(0, o.ry || 0, 0));
    sc.set(o.sx ?? o.s ?? 1, o.sy ?? o.s ?? 1, o.sz ?? o.s ?? 1);
    im.setMatrixAt(k, m.compose(v.set(o.x, o.y, o.z), q, sc));
    im.setColorAt(k, o.color instanceof THREE.Color ? o.color : col.set(o.color || '#ffffff'));
  });
  im.instanceMatrix.needsUpdate = true;
  im.instanceColor.needsUpdate = true;
  im.castShadow = false;
  im.receiveShadow = !noShadow;
  return im;
}

/** Cone of `seg` triangles (no degenerate quads), radius r at y up to y + h. */
function cone(g, y, h, r, seg, hex) {
  const c = rgb(hex);
  const nrm = (a) => { const l = Math.hypot(h, r); return [Math.cos(a) * h / l, r / l, Math.sin(a) * h / l]; };
  for (let k = 0; k < seg; k++) {
    const a0 = (k / seg) * Math.PI * 2, a1 = ((k + 1) / seg) * Math.PI * 2, am = (a0 + a1) / 2;
    const o = g.count;
    for (const [p, n, u] of [
      [[Math.cos(a1) * r, y, Math.sin(a1) * r], nrm(a1), [(k + 1) / seg, 0]],
      [[Math.cos(a0) * r, y, Math.sin(a0) * r], nrm(a0), [k / seg, 0]],
      [[0, y + h, 0], nrm(am), [(k + 0.5) / seg, 1]],
    ]) {
      g.p.push(...p); g.n.push(...n); g.uv.push(...u); g.c.push(...c);
    }
    g.idx.push(o, o + 1, o + 2);
  }
}

/** Unit conifer (height 1, crown radius 1). lod 0: trunk + three cones; lod 1: one cone. */
function coniferGeo(L, lod) {
  const g = new GeoBuilder();
  const cols = L.forest.conifer > 0.5 ? ['#1c3a1e', '#24482a', '#2f5a30'] : ['#26401f', '#2e4c24', '#3a5a2a'];
  if (lod) {
    cone(g, 0.08, 0.92, 0.92, 6, cols[1]);
    return g.build(true);
  }
  g.setColor(...rgb('#5a3424')).cylinder(0, 0, 0, 0.13, 0.42, 4, 0.07);
  [[0.16, 0.5, 1.0], [0.38, 0.46, 0.76], [0.6, 0.4, 0.5]].forEach(([y, h, r], k) => cone(g, y, h, r, 7, cols[k]));
  return g.build(true);
}

/** Unit broadleaf (height 1, crown radius ~1). lod 0: trunk + lumpy canopy; lod 1: one blob. */
function oakGeo(lod) {
  const g = new GeoBuilder();
  g.setColor(...rgb('#4a3424')).cylinder(0, 0, 0, 0.1, 0.5, lod ? 3 : 4, 0.07);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion();
  const blobs = lod ? [[0, 0.64, 0, 0.95, 0.4, '#3a4a20']] : [[0, 0.62, 0, 0.85, 0.36, '#3a4a20'], [0.32, 0.76, 0.18, 0.55, 0.26, '#46582a']];
  const geo = lod ? new THREE.OctahedronGeometry(1, 0) : new THREE.IcosahedronGeometry(1, 0);
  for (const [x, y, z, r, ry, c] of blobs) {
    g.setColor(...rgb(c));
    g.geometry(geo, m.compose(new THREE.Vector3(x, y, z), q, new THREE.Vector3(r, ry, r)));
  }
  return g.build(true);
}

/** Ring of hills from the terrain edge out toward the horizon. */
function farRing(terrain, L, nat, noise) {
  const cx = terrain.x0 + (terrain.nx - 1) * terrain.cell / 2, cz = terrain.z0 + (terrain.nz - 1) * terrain.cell / 2;
  const hx = (terrain.nx - 1) * terrain.cell / 2, hz = (terrain.nz - 1) * terrain.cell / 2;
  const segs = 200, R = [-30, 50, 180, 420, 800, 1250, 1700];
  const pos = [], col = [], idx = [];
  const c0 = new THREE.Color(L.grass), c1 = new THREE.Color(L.far[0]), c2 = new THREE.Color(L.far[1]), tmp = new THREE.Color();
  for (let a = 0; a <= segs; a++) {
    const ang = (a / segs) * Math.PI * 2, dx = Math.cos(ang), dz = Math.sin(ang);
    const r0 = Math.min(hx / Math.max(1e-6, Math.abs(dx)), hz / Math.max(1e-6, Math.abs(dz)));
    for (let k = 0; k < R.length; k++) {
      const x = cx + dx * (r0 + R[k]), z = cz + dz * (r0 + R[k]);
      const h = k === 0 ? terrain.heightAt(x, z) - 1.2 : nat(x, z) + L.mountains * smoothstep(0, 1500, R[k]) * (0.25 + 0.75 * noise.ridged(x * 0.0011 + 7, z * 0.0011 - 3, 4));
      pos.push(x, h, z);
      const t = clamp(R[k] / 1400, 0, 1);
      tmp.copy(c0).lerp(c1, smoothstep(0, 0.35, t)).lerp(c2, smoothstep(0.35, 1, t));
      const sh = 0.85 + 0.25 * noise.fbm(x * 0.004, z * 0.004, 2);
      col.push(tmp.r * sh, tmp.g * sh, tmp.b * sh);
    }
  }
  const n = R.length;
  for (let a = 0; a < segs; a++) {
    for (let k = 0; k < n - 1; k++) {
      const o = a * n + k, p = o + n;
      idx.push(o, p, p + 1, o, p + 1, o + 1);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return new THREE.Mesh(g, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, side: DS }));
}

export default { natural, terrainOpts, build };
