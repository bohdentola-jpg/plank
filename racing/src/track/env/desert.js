// Desert: sun-bleached two-lane blacktop, red-rock canyons and a dry-lake drag
// strip. Terrain = road-following floor + dunes + terraced outcrops (red rock
// and strata bands on steep faces, in the shader). Canyon walls are extruded
// rock slabs; buttes/mesas are merged; saguaros, creosote and boulders are
// instanced in spatial chunks; telephone poles carry sagging wires; a truck
// stop with neon and a water tower, billboards, fences and mile markers line
// Route 99; the drag strip gets a christmas tree, timing boards and a crowd.
import * as THREE from 'three';
import { stripMesh, glowMaterial } from '../build.js';
import { toTex } from '../textures.js';
import { GeoBuilder, instanced } from './common.js';
import { makeNoise2D, makeRng, clamp, smoothstep, hashString, nextFrame } from '../../core/util.js';

const col = (hex) => new THREE.Color(hex);

// ------------------------------------------------------------------ looks

const LOOKS = {
  mojave: {
    margin: 520, cell: 15, detail: 'sand', tile: 9, frameRise: 0,
    sand: '#d6b583', soil: '#b39370', red: '#bf8a5e', dune: '#e2c896', rock: '#a65d3d', cap: '#cfa985', talus: '#9a7356',
    top: '#94704f', wash: '#e6d4ae', lot: '#8f877c', shoulder: '#b4a48c',
    hills: 7, dunes: 7.5, duneAt: 0.0, duneLen: 105, outcrops: 24, outcropAt: 0.2, outcropF: 0.0022, terrace: 6.5, follow: 120,
    bands: ['#fff1e2', '#c99a83', '#fff4dc'],
    veg: { creosote: 1150, bursage: 520, saguaro: 380, ocotillo: 90, barrel: 120, yucca: 50, juniper: 0, rock: 520, boulder: 140 },
    forms: { mesa: [7, 520, 1700], butte: [10, 230, 1000], spire: [5, 180, 800] },
    mtn: '#7f88a6', ranges: [[2950, 110, 330, 0.3, 3, false], [2700, 50, 170, 0.5, 9, true]],
  },
  redrock: {
    margin: 600, cell: 10, detail: 'red', tile: 8, frameRise: 0,
    sand: '#c98c5c', soil: '#b06f47', red: '#a85634', dune: '#d8a06c', rock: '#a2442a', cap: '#dcb48e', talus: '#8d5236',
    top: '#8a5a3e', wash: '#dcb183', lot: '#8a7a6c', shoulder: '#b08a6c',
    hills: 9, dunes: 2.5, duneAt: 0.15, duneLen: 90, outcrops: 30, outcropAt: 0.14, outcropF: 0.0028, terrace: 7, follow: 110,
    bands: ['#fff0e4', '#c2846c', '#fff6e6'],
    veg: { creosote: 520, bursage: 300, saguaro: 0, ocotillo: 30, barrel: 40, yucca: 160, juniper: 300, rock: 560, boulder: 280 },
    forms: { mesa: [6, 300, 1300], butte: [18, 70, 700], spire: [12, 55, 500] },
    mtn: '#5b4a78', ranges: [[2950, 90, 260, 0.34, 5, true], [2650, 40, 150, 0.55, 13, true]],
  },
  salt: {
    margin: 1500, cell: 40, detail: 'salt', tile: 22, flat: true, floorY: -0.35, frameRise: 70,
    sand: '#efebe3', soil: '#e3ddd1', red: '#e9e2d6', dune: '#efebe3', rock: '#a3735a', cap: '#d8c2a6', talus: '#9b7c66',
    top: '#a07a60', wash: '#efebe3', lot: '#d9d3c8', shoulder: '#cfc9bf', shore: '#c7aa8a',
    hills: 0, dunes: 0, outcrops: 0, follow: 0,
    bands: ['#fff0e6', '#caa090', '#fff4e8'],
    veg: {},
    forms: { mesa: [4, 1700, 2600], butte: [0, 0, 0], spire: [0, 0, 0] },
    mtn: '#5c4f80', ranges: [[2950, 160, 420, 0.32, 21, false], [2600, 70, 230, 0.52, 27, false]],
  },
};

// ------------------------------------------------------------------ profile + plan

/** Vertical alignment from PVIs [s, y, R]: straight grades, parabolic vertical curves. */
export function pviProfile(pts) {
  const n = pts.length;
  const g = [];
  for (let k = 0; k < n - 1; k++) g.push((pts[k + 1][1] - pts[k][1]) / (pts[k + 1][0] - pts[k][0]));
  const curves = [];
  for (let k = 1; k < n - 1; k++) {
    const dg = g[k] - g[k - 1];
    const L = Math.min((pts[k][2] ?? 1500) * Math.abs(dg), pts[k][0] - pts[k - 1][0], pts[k + 1][0] - pts[k][0]);
    if (L > 0.01) curves.push({ s: pts[k][0], y: pts[k][1], L, g0: g[k - 1], dg });
  }
  return (s) => {
    for (const c of curves) {
      const t = s - c.s + c.L / 2;
      if (t >= 0 && t <= c.L) return c.y + c.g0 * (s - c.s) + c.dg * t * t / (2 * c.L);
    }
    let k = 0;
    while (k < n - 2 && s > pts[k + 1][0]) k++;
    return pts[k][1] + g[k] * (s - pts[k][0]);
  };
}

const PLANS = new WeakMap();

/** Everything placement-related, computed once per track (natural() runs first). */
export function plan(def, track) {
  let P = PLANS.get(track);
  if (P) return P;
  const T = track;
  const look = LOOKS[def.look] || LOOKS.mojave;
  P = { def, track: T, look, rng: makeRng('desert' + def.id), seed: hashString(def.id) & 0xffff };
  PLANS.set(track, P);
  // exact vertical alignment (Track's smoothing would round the crests away)
  if (def.profile) {
    const f = pviProfile(def.profile);
    for (let i = 0; i < T.N; i++) T.Y[i] = f(i * T.step);
  }
  // spatial hash of samples → nearest road point
  const cell = 50, map = new Map();
  for (let i = 0; i < T.N; i++) {
    const k = Math.floor(T.X[i] / cell) * 65536 + Math.floor(T.Z[i] / cell);
    let l = map.get(k);
    if (!l) map.set(k, (l = []));
    l.push(i);
  }
  P.near = (x, z, out = {}) => {
    const cx = Math.floor(x / cell), cz = Math.floor(z / cell);
    let best = -1, bd = Infinity;
    for (let dx = -3; dx <= 3; dx++) {
      for (let dz = -3; dz <= 3; dz++) {
        const l = map.get((cx + dx) * 65536 + cz + dz);
        if (!l) continue;
        for (let k = 0; k < l.length; k++) {
          const i = l[k], ex = T.X[i] - x, ez = T.Z[i] - z, d = ex * ex + ez * ez;
          if (d < bd) { bd = d; best = i; }
        }
      }
    }
    out.i = best;
    if (best < 0) { out.d = Infinity; out.lat = 0; return out; }
    const ex = x - T.X[best], ez = z - T.Z[best];
    out.lat = ex * T.LX[best] + ez * T.LZ[best];
    const lon = ex * T.TX[best] + ez * T.TZ[best];
    out.d = Math.abs(lon) > T.step ? Math.sqrt(bd) : Math.abs(out.lat);
    return out;
  };
  // terrain grid extents (mirrors Terrain's math)
  const o = terrainOpts(def), b = T.bounds;
  P.gx0 = b.minX - o.margin; P.gz0 = b.minZ - o.margin;
  P.gx1 = P.gx0 + Math.ceil((b.maxX - b.minX + o.margin * 2) / o.cell) * o.cell;
  P.gz1 = P.gz0 + Math.ceil((b.maxZ - b.minZ + o.margin * 2) / o.cell) * o.cell;
  P.edgeFade = (x, z) => smoothstep(0, 260, Math.min(x - P.gx0, P.gx1 - x, z - P.gz0, P.gz1 - z));
  floorField(P);
  P.canyons = (def.canyons || []).map((c) => canyonPlan(P, c));
  P.washes = (def.washes || []).map((w) => washPlan(P, w));
  P.stop = def.stop ? stopPlan(P, def.stop) : null;
  P.relief = reliefFn(look, P.seed);
  return P;
}

/** Smooth ground level that follows the road from afar (IDW of road heights). */
function floorField(P) {
  const T = P.track;
  let mean = 0;
  for (let i = 0; i < T.N; i++) mean += T.Y[i];
  mean /= T.N;
  P.meanY = mean;
  if (P.look.flat) { P.floorAt = () => P.look.floorY; return; }
  const cell = 40, pad = 700;
  const x0 = P.gx0 - pad, z0 = P.gz0 - pad;
  const nx = Math.ceil((P.gx1 - P.gx0 + pad * 2) / cell) + 1, nz = Math.ceil((P.gz1 - P.gz0 + pad * 2) / cell) + 1;
  const F = new Float32Array(nx * nz);
  const R2 = 900 * 900, soft = 70 * 70;
  for (let j = 0; j < nz; j++) {
    for (let i = 0; i < nx; i++) {
      const x = x0 + i * cell, z = z0 + j * cell;
      let sw = 1e-16, sy = 1e-16 * mean;
      for (let k = 0; k < T.N; k += 4) {
        const dx = T.X[k] - x, dz = T.Z[k] - z, d2 = dx * dx + dz * dz;
        if (d2 > R2) continue;
        const t = 1 - d2 / R2;
        const w = t * t / ((d2 + soft) * (d2 + soft));
        sw += w; sy += w * T.Y[k];
      }
      F[j * nx + i] = sy / sw;
    }
  }
  P.floorAt = (x, z) => {
    const fx = clamp((x - x0) / cell, 0, nx - 1.001), fz = clamp((z - z0) / cell, 0, nz - 1.001);
    const i = Math.floor(fx), j = Math.floor(fz), tx = fx - i, tz = fz - j;
    const a = F[j * nx + i], bb = F[j * nx + i + 1], c = F[(j + 1) * nx + i], d = F[(j + 1) * nx + i + 1];
    return (a + (bb - a) * tx) * (1 - tz) + (c + (d - c) * tx) * tz;
  };
}

/** Dunes + broad hills + terraced outcrops (≥ ~0, in meters). */
function reliefFn(L, seed) {
  if (L.flat) return () => 0;
  const nA = makeNoise2D(seed + 11), nB = makeNoise2D(seed + 23), nC = makeNoise2D(seed + 37);
  const duneMask = (x, z) => L.dunes > 0 ? smoothstep(L.duneAt, L.duneAt + 0.22, nB.fbm(x * 0.0006 + 5.2, z * 0.0006 - 1.7, 3)) : 0;
  const f = (x, z) => {
    let h = nA.fbm(x * 0.0009, z * 0.0009, 3) * L.hills + L.hills * 0.4;
    const m = duneMask(x, z);
    if (m > 0.001) {
      const u = (x * 0.93 + z * 0.37) / L.duneLen + nB.fbm(x * 0.0035, z * 0.0035, 2) * 1.8;
      const fr = u - Math.floor(u);
      const p = fr < 0.7 ? fr / 0.7 : (1 - fr) / 0.3;
      h += p * p * (3 - 2 * p) * m * L.dunes * (0.75 + 0.5 * nC.fbm(x * 0.002, z * 0.002, 2));
    }
    if (L.outcrops > 0) {
      const o = nC.fbm(x * L.outcropF + 13.1, z * L.outcropF - 7.7, 4);
      if (o > L.outcropAt) {
        const raw = Math.min(1, (o - L.outcropAt) * 9) * L.outcrops;
        const lv = raw / L.terrace, fl = Math.floor(lv);
        h += (fl + smoothstep(0.72, 1, lv - fl)) * L.terrace;
      }
    }
    return h;
  };
  f.duneMask = duneMask;
  return f;
}

function canyonPlan(P, c) {
  const T = P.track;
  const n = makeNoise2D(P.seed + Math.round(c.s0));
  const i0 = clamp(Math.floor(c.s0 / T.step), 0, T.N - 1), i1 = clamp(Math.ceil(c.s1 / T.step), 0, T.N - 1);
  let ymax = -Infinity;
  for (let i = i0; i <= i1; i++) ymax = Math.max(ymax, T.Y[i]);
  const sides = {};
  const q = {};
  for (const side of [1, -1]) {
    const Lin = [], Lout = [];
    for (let i = i0; i <= i1; i++) {
      const s = i * T.step;
      const e = Math.min(s - c.s0, c.s1 - s);
      const flare = 46 * Math.pow(1 - smoothstep(0, 95, e), 2);
      Lin.push(T.W[i] + T.shoulder + c.gap + flare + n.fbm(s * 0.012, side * 3.7, 2) * 2.2);
      let lo = 150 + n.fbm(s * 0.004 + 9, side, 2) * 70;
      const k = T.Ks[i] * side; // > 0: this side is the inside of the turn
      if (k > 0) lo = Math.min(lo, 0.62 / k);
      // stay clear of other legs
      for (let L = 20; L < lo; L += 8) {
        P.near(T.X[i] + T.LX[i] * side * L, T.Z[i] + T.LZ[i] * side * L, q);
        let ds = Math.abs(q.i - i) * T.step;
        if (T.closed) ds = Math.min(ds, T.length - ds);
        if (q.i >= 0 && ds > 120 && q.d < T.W[q.i] + 30) { lo = L - 8; break; }
      }
      Lout.push(lo);
    }
    // moving minimum then blur, and keep a solid wall thickness
    const m = Lout.map((_, k) => Math.min(...Lout.slice(Math.max(0, k - 10), k + 11)));
    const sm = m.map((_, k) => { let a = 0, cnt = 0; for (let j = Math.max(0, k - 8); j <= Math.min(m.length - 1, k + 8); j++) { a += m[j]; cnt++; } return a / cnt; });
    sides[side] = { Lin, Lout: sm.map((v, k) => Math.max(v, Lin[k] + 26)) };
  }
  const top = (s, side) => ymax + c.h * (0.86 + 0.14 * (n.fbm(s * 0.003 + side * 5, 1.3, 2) + 0.5));
  return { ...c, i0, i1, sides, ymax, top, noise: n };
}

function washPlan(P, w) {
  const T = P.track;
  const i = clamp(Math.round(w.s / T.step), 0, T.N - 1);
  const a = w.angle || 0, ca = Math.cos(a), sa = Math.sin(a);
  const ux = T.LX[i] * ca - T.LZ[i] * sa, uz = T.LX[i] * sa + T.LZ[i] * ca;
  const W = { ...w, i, cx: T.X[i], cz: T.Z[i], ux, uz, vx: -uz, vz: ux };
  // offset of the channel center line at u (0 at the crossing)
  W.mid = (u) => 16 * Math.sin(u / 95) + 7 * Math.sin(u / 41 + 0.5) - 7 * Math.sin(0.5);
  W.half = (u) => w.w / 2 * (1 + 0.25 * Math.sin(u / 140));
  /** 1 on the bed, fading on the banks; 0 away from the wash. */
  W.mask = (x, z, bank = 14) => {
    const dx = x - W.cx, dz = z - W.cz;
    const u = dx * ux + dz * uz, v = dx * W.vx + dz * W.vz;
    if (Math.abs(u) > 1600) return 0;
    const dv = Math.abs(v - W.mid(u));
    return (1 - smoothstep(W.half(u), W.half(u) + bank, dv)) * (1 - smoothstep(1100, 1600, Math.abs(u)));
  };
  return W;
}

function stopPlan(P, st) {
  const T = P.track;
  const i = clamp(Math.round(st.s / T.step), 0, T.N - 1);
  const S = { ...st, i, x: T.X[i], z: T.Z[i], tx: T.TX[i], tz: T.TZ[i], lx: T.LX[i] * st.side, lz: T.LZ[i] * st.side, y: T.Y[i] - 0.35 };
  S.local = (x, z) => [(x - S.x) * S.tx + (z - S.z) * S.tz, (x - S.x) * S.lx + (z - S.z) * S.lz];
  S.mask = (x, z) => {
    const [a, b2] = S.local(x, z);
    return (1 - smoothstep(80, 105, Math.abs(a))) * smoothstep(-6, 2, b2) * (1 - smoothstep(72, 96, b2));
  };
  S.world = (a, b2) => [S.x + S.tx * a + S.lx * b2, S.z + S.tz * a + S.lz * b2];
  return S;
}

// ------------------------------------------------------------------ terrain hooks

export function terrainOpts(def) {
  const L = LOOKS[def.look] || LOOKS.mojave;
  return { margin: L.margin, cell: L.cell, flat: 4, blend: 16 };
}

export function natural(def, track) {
  const P = plan(def, track);
  const L = P.look, T = track;
  if (L.flat) {
    const n = makeNoise2D(P.seed + 5);
    const cx = (T.bounds.minX + T.bounds.maxX) / 2, cz = (T.bounds.minZ + T.bounds.maxZ) / 2;
    return (x, z) => {
      // the lake bed is dead flat; low alluvial shores rise near the grid edge
      const r = Math.hypot((x - cx) / 1300, (z - cz) / 1900);
      return L.floorY + smoothstep(1.0, 1.45, r) * (16 + 12 * n.fbm(x * 0.002, z * 0.002, 3));
    };
  }
  const micro = makeNoise2D(P.seed + 77);
  const q = {};
  return (x, z) => {
    P.near(x, z, q);
    let h = P.floorAt(x, z);
    const w0 = q.i >= 0 ? T.W[q.i] + T.shoulder : 8;
    if (q.i >= 0) h += (T.Y[q.i] - 0.35 - h) * (1 - smoothstep(18, L.follow, q.d));
    const fade = P.edgeFade(x, z);
    h += P.relief(x, z) * smoothstep(w0 + 10, w0 + 105, q.d) * fade;
    h += micro.fbm(x * 0.03, z * 0.03, 2) * 0.5 * smoothstep(w0 + 3, w0 + 22, q.d) * fade;
    for (const W of P.washes) h -= W.mask(x, z) * W.depth * fade;
    if (P.stop) {
      const m = P.stop.mask(x, z);
      if (m > 0) h += (P.stop.y - h) * m;
    }
    return h;
  };
}

// ------------------------------------------------------------------ textures

const CANVAS = new Map();
function cachedCanvas(key, fn) {
  if (!CANVAS.has(key)) CANVAS.set(key, fn());
  return CANVAS.get(key);
}
function cvs(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}

/** Draw fn at (x, y) and its wrapped copies so the tile repeats seamlessly. */
function wrapped(S, x, y, r, fn) {
  for (const ox of [-S, 0, S]) {
    for (const oy of [-S, 0, S]) {
      if (x + ox < -r || x + ox > S + r || y + oy < -r || y + oy > S + r) continue;
      fn(x + ox, y + oy);
    }
  }
}

/** Near-white ground detail (vertex colors carry the hue). kind: sand | red | salt. */
function detailCanvas(kind) {
  return cachedCanvas('detail|' + kind, () => {
    const S = 512, c = cvs(S, S), x = c.getContext('2d');
    const rng = makeRng('dt' + kind);
    const img = x.createImageData(S, S), d = img.data;
    if (kind === 'salt') {
      // polygonal crust: crack network between jittered cells (wrap-around)
      const G = 15, cs = S / G, pts = [];
      for (let j = 0; j < G; j++) for (let i = 0; i < G; i++) pts.push([(i + 0.15 + rng() * 0.7) * cs, (j + 0.15 + rng() * 0.7) * cs, 0.97 + rng() * 0.05]);
      for (let py = 0; py < S; py++) {
        for (let px = 0; px < S; px++) {
          const ci = Math.floor(px / cs), cj = Math.floor(py / cs);
          let f1 = 1e9, f2 = 1e9, tone = 1;
          for (let dj = -1; dj <= 1; dj++) {
            for (let di = -1; di <= 1; di++) {
              const ii = (ci + di + G) % G, jj = (cj + dj + G) % G;
              const p = pts[jj * G + ii];
              const qx = p[0] + (ci + di - ii) * cs, qy = p[1] + (cj + dj - jj) * cs;
              const dd = (qx - px) ** 2 + (qy - py) ** 2;
              if (dd < f1) { f2 = f1; f1 = dd; tone = p[2]; } else if (dd < f2) f2 = dd;
            }
          }
          const e = Math.sqrt(f2) - Math.sqrt(f1);
          let v = 242 * tone + (rng() - 0.5) * 9;
          if (e < 1.6) v -= 48 * (1 - e / 1.6);
          else if (e < 4.5) v += 9 * (1 - (e - 1.6) / 2.9);
          const k = (py * S + px) * 4;
          d[k] = v; d[k + 1] = v * 0.992; d[k + 2] = v * 0.975; d[k + 3] = 255;
        }
      }
      x.putImageData(img, 0, 0);
      // dirt specks + faint tire scuffs
      for (let i = 0; i < 700; i++) {
        x.fillStyle = `rgba(120,100,80,${0.08 + rng() * 0.2})`;
        x.fillRect(rng() * S, rng() * S, 1 + rng() * 1.5, 1 + rng() * 1.5);
      }
      return c;
    }
    const red = kind === 'red';
    for (let k = 0; k < S * S; k++) {
      const v = 226 + (rng() - 0.5) * 30;
      d[k * 4] = v; d[k * 4 + 1] = v * 0.985; d[k * 4 + 2] = v * 0.96; d[k * 4 + 3] = 255;
    }
    x.putImageData(img, 0, 0);
    // soft blotches
    for (let i = 0; i < 46; i++) {
      const r = 20 + rng() * 70, px = rng() * S, py = rng() * S, dark = rng() < 0.55;
      const a = 0.05 + rng() * 0.07;
      wrapped(S, px, py, r, (X, Y) => {
        const g = x.createRadialGradient(X, Y, 0, X, Y, r);
        g.addColorStop(0, dark ? `rgba(90,70,50,${a})` : `rgba(255,250,240,${a})`);
        g.addColorStop(1, 'rgba(0,0,0,0)');
        x.fillStyle = g;
        x.fillRect(X - r, Y - r, r * 2, r * 2);
      });
    }
    // wind ripples (sand)
    if (!red) {
      x.strokeStyle = 'rgba(255,250,235,0.16)';
      x.lineWidth = 1.2;
      for (let k = 0; k < 40; k++) {
        const y0 = k * S / 40;
        x.beginPath();
        for (let px = 0; px <= S; px += 8) x.lineTo(px, y0 + Math.sin(px / S * Math.PI * 4 + k) * 3);
        x.stroke();
      }
    }
    // pebbles
    const nP = red ? 2600 : 1500;
    for (let i = 0; i < nP; i++) {
      const px = rng() * S, py = rng() * S, r = 0.7 + Math.pow(rng(), 3) * (red ? 4.5 : 3);
      const t = rng();
      const fill = red ? (t < 0.5 ? '96,52,36' : t < 0.8 ? '140,90,66' : '70,60,55') : (t < 0.5 ? '120,100,80' : t < 0.8 ? '90,80,72' : '160,130,100');
      wrapped(S, px, py, r + 1, (X, Y) => {
        x.fillStyle = `rgba(${fill},${0.35 + rng() * 0.4})`;
        x.beginPath();
        x.ellipse(X, Y, r, r * (0.6 + rng() * 0.4), rng() * 3, 0, Math.PI * 2);
        x.fill();
        x.fillStyle = 'rgba(255,250,240,0.25)';
        x.fillRect(X - r * 0.4, Y - r * 0.5, Math.max(1, r * 0.5), 1);
      });
    }
    return c;
  });
}

/** Cliff face detail: strata lines, cracks, desert-varnish streaks (u along, v up). */
function rockCanvas() {
  return cachedCanvas('rock', () => {
    const S = 512, c = cvs(S, S), x = c.getContext('2d');
    const rng = makeRng('rockface');
    x.fillStyle = '#e4dbd2';
    x.fillRect(0, 0, S, S);
    let y = 0;
    while (y < S) {
      const h = 6 + rng() * 26, v = 200 + rng() * 50;
      x.fillStyle = `rgb(${v},${v * 0.97},${v * 0.94})`;
      x.fillRect(0, y, S, h);
      x.fillStyle = `rgba(60,40,30,${0.12 + rng() * 0.22})`;
      x.fillRect(0, y, S, 1 + rng() * 1.5);
      // cross-bedding
      x.strokeStyle = 'rgba(80,60,50,0.12)';
      for (let k = 0; k < 6; k++) {
        const x0 = rng() * S;
        x.beginPath(); x.moveTo(x0, y); x.lineTo(x0 + h * 2.5, y + h); x.stroke();
      }
      y += h;
    }
    // vertical cracks
    for (let i = 0; i < 26; i++) {
      let px = rng() * S, py = rng() * S;
      x.strokeStyle = `rgba(40,25,20,${0.25 + rng() * 0.3})`;
      x.lineWidth = 0.8 + rng() * 1.6;
      x.beginPath(); x.moveTo(px, py);
      for (let k = 0; k < 8; k++) { px += (rng() - 0.5) * 8; py += 8 + rng() * 14; x.lineTo(px, py); }
      x.stroke();
    }
    // varnish streaks running down from ledges
    for (let i = 0; i < 40; i++) {
      const px = rng() * S, w = 3 + rng() * 14, py = rng() * S * 0.7, len = 60 + rng() * 200;
      const g = x.createLinearGradient(0, py, 0, py + len);
      g.addColorStop(0, 'rgba(50,30,25,0.28)');
      g.addColorStop(1, 'rgba(50,30,25,0)');
      x.fillStyle = g;
      x.fillRect(px, py, w, len);
    }
    const img = x.getImageData(0, 0, S, S), d = img.data;
    for (let k = 0; k < d.length; k += 4) { const n = (rng() - 0.5) * 22; d[k] += n; d[k + 1] += n; d[k + 2] += n; }
    x.putImageData(img, 0, 0);
    return c;
  });
}

function gravelCanvas() {
  return cachedCanvas('gravel', () => {
    const S = 256, c = cvs(S, S), x = c.getContext('2d');
    const rng = makeRng('gravel');
    x.fillStyle = '#d8d0c4';
    x.fillRect(0, 0, S, S);
    for (let i = 0; i < 3600; i++) {
      const v = 120 + rng() * 120, r = 0.6 + rng() * 1.8;
      x.fillStyle = `rgba(${v},${v * 0.95},${v * 0.88},${0.4 + rng() * 0.5})`;
      x.fillRect(rng() * S, rng() * S, r, r);
    }
    // tire scuffs along the edge
    for (let i = 0; i < 5; i++) {
      x.fillStyle = 'rgba(60,55,50,0.08)';
      x.fillRect(rng() * S, 0, 6 + rng() * 10, S);
    }
    return c;
  });
}

function canvasTex(c, opts) {
  const t = toTex(c, opts);
  t.needsUpdate = true;
  return t;
}

// ------------------------------------------------------------------ materials

const STRATA = /* glsl */`
varying vec3 vDWP; varying float vDUp;
uniform vec3 uBandA; uniform vec3 uBandB; uniform vec3 uBandC;
float dsH(float n) { return fract(sin(n * 127.1) * 43758.5453); }
vec3 desertStrata(vec3 p, float up) {
  float steep = 1.0 - smoothstep(0.62, 0.86, up);
  if (steep <= 0.0) return vec3(1.0);
  float y = p.y + sin(p.x * 0.011 + sin(p.z * 0.009) * 2.0) * 2.4 + sin(p.z * 0.017 + p.x * 0.004) * 1.4;
  float b = y / 2.7;
  float fb = floor(b), t = fract(b);
  vec3 c = mix(uBandA, uBandB, dsH(fb));
  c = mix(c, uBandC, step(0.84, dsH(fb + 31.7)));
  c *= 0.84 + 0.16 * smoothstep(0.0, 0.1, t) * smoothstep(1.0, 0.86, t);
  float st = sin(p.x * 0.7 + p.z * 0.55 + sin(y * 0.15) * 2.0) * 0.5 + 0.5;
  c *= 1.0 - 0.18 * smoothstep(0.55, 1.0, st);
  return mix(vec3(1.0), c, steep);
}`;

/** Standard material + world-space strata on steep faces + anti-tiling detail. */
function desertMaterial(map, L, key, extra = {}) {
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, map, roughness: 0.97, metalness: 0, envMapIntensity: 0.45, ...extra });
  const bands = L.bands.map((h) => col(h));
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uBandA = { value: bands[0] };
    sh.uniforms.uBandB = { value: bands[1] };
    sh.uniforms.uBandC = { value: bands[2] };
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vDWP;\nvarying float vDUp;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvDWP = (modelMatrix * vec4(transformed, 1.0)).xyz;\nvDUp = normalize(mat3(modelMatrix) * objectNormal).y;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\n' + STRATA)
      .replace('#include <map_fragment>', `#ifdef USE_MAP
        vec4 sampledDiffuseColor = texture2D(map, vMapUv);
        sampledDiffuseColor.rgb *= 0.74 + 0.32 * texture2D(map, vMapUv * 0.137 + vec2(0.37, 0.61)).g;
        diffuseColor *= sampledDiffuseColor;
      #endif`)
      .replace('#include <color_fragment>', '#include <color_fragment>\ndiffuseColor.rgb *= desertStrata(vDWP, vDUp);');
  };
  m.customProgramCacheKey = () => 'desert-' + key;
  return m;
}

// ------------------------------------------------------------------ geometry utils

/** Concatenate geometries that share the same attribute set. */
function mergeGeos(list) {
  list = list.filter((g) => g && g.attributes.position.count);
  if (!list.length) return null;
  const names = Object.keys(list[0].attributes).filter((n) => list.every((g) => g.attributes[n]));
  const out = new THREE.BufferGeometry();
  let total = 0;
  for (const g of list) total += g.attributes.position.count;
  for (const n of names) {
    const size = list[0].attributes[n].itemSize;
    const arr = new Float32Array(total * size);
    let off = 0;
    for (const g of list) { arr.set(g.attributes[n].array.subarray(0, g.attributes[n].count * size), off); off += g.attributes[n].count * size; }
    out.setAttribute(n, new THREE.BufferAttribute(arr, size));
  }
  const idx = [];
  let base = 0;
  for (const g of list) {
    const n = g.attributes.position.count;
    if (g.index) for (let i = 0; i < g.index.count; i++) idx.push(g.index.getX(i) + base);
    else for (let i = 0; i < n; i++) idx.push(base + i);
    base += n;
  }
  out.setIndex(total > 65535 ? new THREE.Uint32BufferAttribute(idx, 1) : new THREE.Uint16BufferAttribute(idx, 1));
  return out;
}

/** Indexed grid geometry from rows of points; orient faces toward wantN(row, col). */
function gridGeo(rows, wantN) {
  const R = rows.length, C = rows[0].length;
  const pos = new Float32Array(R * C * 3), color = new Float32Array(R * C * 3), uv = new Float32Array(R * C * 2);
  for (let r = 0; r < R; r++) {
    for (let c = 0; c < C; c++) {
      const v = rows[r][c], k = r * C + c;
      pos[k * 3] = v.x; pos[k * 3 + 1] = v.y; pos[k * 3 + 2] = v.z;
      color[k * 3] = v.c.r; color[k * 3 + 1] = v.c.g; color[k * 3 + 2] = v.c.b;
      uv[k * 2] = v.u; uv[k * 2 + 1] = v.v;
    }
  }
  // decide winding from one well-formed quad
  const P = (k) => new THREE.Vector3(pos[k * 3], pos[k * 3 + 1], pos[k * 3 + 2]);
  let flip = false;
  {
    const r = Math.floor(R / 2), c = Math.floor((C - 1) / 2);
    const a = P(r * C + c), b = P(r * C + c + 1), d = P((r + 1 < R ? r + 1 : r - 1) * C + c);
    const n = new THREE.Vector3().subVectors(b, a).cross(new THREE.Vector3().subVectors(d, a));
    if (r + 1 >= R) n.negate();
    flip = n.dot(wantN(r, c)) < 0;
  }
  const idx = [];
  for (let r = 0; r < R - 1; r++) {
    for (let c = 0; c < C - 1; c++) {
      const a = r * C + c, b = a + 1, d = a + C, e = d + 1;
      if (!flip) idx.push(a, b, d, b, e, d);
      else idx.push(a, d, b, b, d, e);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.BufferAttribute(color, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** Fan cap over a closed/open outline; normal hint picks the winding. */
function fanGeo(center, ring, wantN, c) {
  const n = ring.length;
  const pos = new Float32Array((n + 1) * 3), color = new Float32Array((n + 1) * 3), uv = new Float32Array((n + 1) * 2);
  pos.set([center.x, center.y, center.z], 0);
  for (let k = 0; k < n; k++) pos.set([ring[k].x, ring[k].y, ring[k].z], (k + 1) * 3);
  for (let k = 0; k <= n; k++) {
    const cc = k === 0 ? c : (ring[k - 1].c || c);
    color.set([cc.r, cc.g, cc.b], k * 3);
    const p = k === 0 ? center : ring[k - 1];
    uv.set([p.x / 14, p.z / 14], k * 2);
  }
  const idx = [];
  const a = ring[0], b = ring[1];
  const nn = new THREE.Vector3().subVectors(a, center).cross(new THREE.Vector3().subVectors(b, center));
  const flip = nn.dot(wantN) < 0;
  for (let k = 0; k < n - 1; k++) idx.push(0, flip ? k + 2 : k + 1, flip ? k + 1 : k + 2);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.BufferAttribute(color, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** Instanced meshes split into spatial chunks so the frustum can cull them. */
function scatter(world, geo, mat, list, opts = {}) {
  if (!list.length) return;
  const cell = opts.cell ?? 1400;
  const groups = new Map();
  for (const o of list) {
    const k = Math.floor(o.x / cell) * 65536 + Math.floor(o.z / cell);
    let g = groups.get(k);
    if (!g) groups.set(k, (g = []));
    g.push(o);
  }
  for (const g of groups.values()) world.add(instanced(geo, mat, g, { shadow: !!opts.shadow, receive: opts.receive ?? true }));
}

/** Tube through points with per-point radius (for cactus arms, pipes). */
function tube(gb, pts, radii, seg) {
  const rings = [];
  for (let k = 0; k < pts.length; k++) {
    const a = pts[Math.max(0, k - 1)], b = pts[Math.min(pts.length - 1, k + 1)];
    const t = new THREE.Vector3().subVectors(b, a).normalize();
    const ref = Math.abs(t.y) > 0.9 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0);
    const n = new THREE.Vector3().crossVectors(ref, t).normalize();
    const bn = new THREE.Vector3().crossVectors(t, n);
    const ring = [];
    for (let j = 0; j < seg; j++) {
      const ang = j / seg * Math.PI * 2;
      ring.push(pts[k].clone().addScaledVector(n, Math.cos(ang) * radii[k]).addScaledVector(bn, Math.sin(ang) * radii[k]));
    }
    rings.push(ring);
  }
  for (let k = 0; k < rings.length - 1; k++) {
    for (let j = 0; j < seg; j++) {
      const j2 = (j + 1) % seg;
      const a = rings[k][j], b = rings[k][j2], c = rings[k + 1][j2], d = rings[k + 1][j];
      // outward winding: check against the radial direction
      const mid = new THREE.Vector3().add(a).add(b).add(c).add(d).multiplyScalar(0.25);
      const axis = new THREE.Vector3().addVectors(pts[k], pts[k + 1]).multiplyScalar(0.5);
      const n = new THREE.Vector3().subVectors(b, a).cross(new THREE.Vector3().subVectors(d, a));
      if (n.dot(mid.sub(axis)) < 0) gb.quad(a, d, c, b); else gb.quad(a, b, c, d);
    }
  }
}

/** Position-hashed vertex jitter (keeps shared corners welded on non-indexed polyhedra). */
function jitter(g, amt, seed = 1, squash = 1) {
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const h = Math.sin(Math.round(x * 1000) * 0.0127 + Math.round(y * 1000) * 0.0311 + Math.round(z * 1000) * 0.0173 + seed) * 43758.5453;
    const f = 1 + ((h - Math.floor(h)) - 0.5) * amt;
    p.setXYZ(i, x * f, y * f * squash, z * f);
  }
  g.computeVertexNormals();
  return g;
}

function setColor(gb, hex, k = 1) {
  const c = col(hex);
  gb.setColor(c.r * k, c.g * k, c.b * k);
  return gb;
}

/** Upright panel quad with bottom-center at (x, y, z), facing direction (nx, nz). */
function panel(gb, x, y, z, nx, nz, w, h, uv = [0, 0, 1, 1]) {
  const rx = nz, rz = -nx; // viewer's right when looking at the face
  const a = new THREE.Vector3(x - rx * w / 2, y, z - rz * w / 2);
  const b = new THREE.Vector3(x + rx * w / 2, y, z + rz * w / 2);
  gb.quad(a, b, new THREE.Vector3(b.x, y + h, b.z), new THREE.Vector3(a.x, y + h, a.z), uv);
}

/** Atlas cell → uv rect (canvas y down, texture v up). */
function cellUV(x0, y0, w, h, S = 1024, SH = S) {
  return [x0 / S, 1 - (y0 + h) / SH, (x0 + w) / S, 1 - y0 / SH];
}

// ------------------------------------------------------------------ ground

function buildGround(world, P) {
  const terr = world.terrain, L = P.look;
  const tex = canvasTex(detailCanvas(L.detail));
  const gw = (terr.nx - 1) * terr.cell, gd = (terr.nz - 1) * terr.cell;
  tex.repeat.set(gw / L.tile, gd / L.tile);
  const mat = desertMaterial(tex, L, 'ground');
  P.groundMat = mat;
  const mesh = terr.mesh(mat, { flat: L.sand, steep: L.rock });
  recolor(mesh.geometry, P, world);
  tileTerrain(world, mesh, terr, 64);
  farFrame(world, P, mat, gw, gd);
}

/** Ground palette: sand/soil patches, red ground, pale dunes and washes, rock on steep faces. */
function groundColor(P, x, y, z, ny, out) {
  const L = P.look;
  const C = P.cols || (P.cols = {
    sand: col(L.sand), soil: col(L.soil), red: col(L.red), dune: col(L.dune), rock: col(L.rock),
    wash: col(L.wash), lot: col(L.lot), top: col(L.top), shore: col(L.shore || L.sand),
    n1: makeNoise2D(P.seed + 101), n2: makeNoise2D(P.seed + 202), n3: makeNoise2D(P.seed + 303),
  });
  const a = C.n1.fbm(x * 0.0026, z * 0.0026, 3) * 0.5 + 0.5;
  out.copy(C.sand).lerp(C.soil, smoothstep(0.4, 0.72, a));
  out.lerp(C.red, smoothstep(0.5, 0.8, C.n2.fbm(x * 0.0011 + 4, z * 0.0011, 2) * 0.5 + 0.5) * 0.75);
  if (L.flat) {
    // tire-darkened salt near the strip, warm shores far out
    const r = P.shoreR ? P.shoreR(x, z) : 0;
    out.lerp(C.shore, smoothstep(1.0, 1.4, r));
    out.multiplyScalar(0.97 + 0.05 * C.n3.fbm(x * 0.01, z * 0.01, 2));
    return out;
  }
  out.lerp(C.dune, P.relief.duneMask(x, z) * 0.85);
  for (const W of P.washes) out.lerp(C.wash, W.mask(x, z, 6) * 0.9);
  if (P.stop) out.lerp(C.lot, smoothstep(0.55, 0.95, P.stop.mask(x, z)) * 0.85);
  // high terraces get a darker, scrubby top; steep faces turn to red rock
  const hRel = y - P.floorAt(x, z);
  out.lerp(C.top, smoothstep(10, 22, hRel) * 0.6);
  out.lerp(C.rock, smoothstep(0.9, 0.66, ny));
  out.multiplyScalar(0.94 + 0.12 * (C.n3.fbm(x * 0.02, z * 0.02, 2) + 0.5));
  return out;
}

function recolor(g, P, world) {
  const pos = g.attributes.position, nor = g.attributes.normal, c = g.attributes.color;
  const tmp = new THREE.Color();
  if (P.look.flat) {
    const T = P.track;
    const cx = (T.bounds.minX + T.bounds.maxX) / 2, cz = (T.bounds.minZ + T.bounds.maxZ) / 2;
    P.shoreR = (x, z) => Math.hypot((x - cx) / 1300, (z - cz) / 1900);
  }
  for (let k = 0; k < pos.count; k++) {
    const x = pos.getX(k), y = pos.getY(k), z = pos.getZ(k);
    groundColor(P, x, y, z, nor.getY(k), tmp);
    const j = Math.sin(x * 12.9898 + z * 78.233) * 43758.5453;
    const f = 0.95 + (j - Math.floor(j)) * 0.1;
    c.setXYZ(k, tmp.r * f, tmp.g * f, tmp.b * f);
  }
  c.needsUpdate = true;
  void world;
}

/** Split the terrain into tiles that share its vertex buffers (frustum culling). */
function tileTerrain(world, mesh, terr, T) {
  const g = mesh.geometry, nx = terr.nx, nz = terr.nz;
  const pos = g.attributes.position;
  for (let tz = 0; tz < nz - 1; tz += T) {
    for (let tx = 0; tx < nx - 1; tx += T) {
      const ex = Math.min(tx + T, nx - 1), ez = Math.min(tz + T, nz - 1);
      const idx = new Uint32Array((ex - tx) * (ez - tz) * 6);
      let k = 0;
      for (let iy = tz; iy < ez; iy++) {
        for (let ix = tx; ix < ex; ix++) {
          const a = ix + nx * iy, b = ix + nx * (iy + 1), c = ix + 1 + nx * (iy + 1), d = ix + 1 + nx * iy;
          idx[k++] = a; idx[k++] = b; idx[k++] = d; idx[k++] = b; idx[k++] = c; idx[k++] = d;
        }
      }
      const box = new THREE.Box3();
      const v = new THREE.Vector3();
      for (let iy = tz; iy <= ez; iy++) for (let ix = tx; ix <= ex; ix++) box.expandByPoint(v.fromBufferAttribute(pos, ix + nx * iy));
      const tg = new THREE.BufferGeometry();
      for (const n of ['position', 'normal', 'uv', 'color']) tg.setAttribute(n, g.attributes[n]);
      tg.setIndex(new THREE.BufferAttribute(idx, 1));
      tg.boundingBox = box;
      tg.boundingSphere = box.getBoundingSphere(new THREE.Sphere());
      const m = new THREE.Mesh(tg, mesh.material);
      m.receiveShadow = true;
      world.add(m);
    }
  }
}

/** Ground beyond the terrain grid out to the horizon: the grid edge extruded outward. */
function farFrame(world, P, mat, gw, gd) {
  const terr = world.terrain, nx = terr.nx, nz = terr.nz, cell = terr.cell;
  const loop = [];
  for (let i = 0; i < nx - 1; i++) loop.push([i, 0]);
  for (let j = 0; j < nz - 1; j++) loop.push([nx - 1, j]);
  for (let i = nx - 1; i > 0; i--) loop.push([i, nz - 1]);
  for (let j = nz - 1; j > 0; j--) loop.push([0, j]);
  const cx = terr.x0 + gw / 2, cz = terr.z0 + gd / 2;
  const n = loop.length;
  // smoothed edge heights for the outer rings
  const hb = loop.map(([i, j]) => terr.H[j * nx + i]);
  const hs = hb.map((_, k) => { let a = 0; for (let d = -12; d <= 12; d++) a += hb[(k + d + n) % n]; return a / 25; });
  const rings = [0, 500, 4300];
  const pos = new Float32Array(n * rings.length * 3), color = new Float32Array(n * rings.length * 3), uv = new Float32Array(n * rings.length * 2);
  const tmp = new THREE.Color();
  for (let r = 0; r < rings.length; r++) {
    for (let k = 0; k < n; k++) {
      const [i, j] = loop[k];
      let x = terr.x0 + i * cell, z = terr.z0 + j * cell;
      let y = r === 0 ? hb[k] : hs[k] + (r === 2 ? P.look.frameRise : 0);
      if (r > 0) {
        const dx = x - cx, dz = z - cz, l = Math.hypot(dx, dz);
        x += dx / l * rings[r]; z += dz / l * rings[r];
      }
      const q = (r * n + k);
      pos[q * 3] = x; pos[q * 3 + 1] = y; pos[q * 3 + 2] = z;
      groundColor(P, x, y, z, 1, tmp);
      color[q * 3] = tmp.r; color[q * 3 + 1] = tmp.g; color[q * 3 + 2] = tmp.b;
      uv[q * 2] = (x - terr.x0) / gw; uv[q * 2 + 1] = 1 - (z - terr.z0) / gd;
    }
  }
  const idx = [];
  for (let r = 0; r < rings.length - 1; r++) {
    for (let k = 0; k < n; k++) {
      const a = r * n + k, b = r * n + (k + 1) % n, c = (r + 1) * n + (k + 1) % n, d = (r + 1) * n + k;
      idx.push(a, b, c, a, c, d);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.BufferAttribute(color, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  // make sure faces point up
  if (g.attributes.normal.getY(n + 1) < 0) {
    for (let k = 0; k < idx.length; k += 3) { const t = idx[k + 1]; idx[k + 1] = idx[k + 2]; idx[k + 2] = t; }
    g.setIndex(idx);
    g.computeVertexNormals();
  }
  const m = new THREE.Mesh(g, mat);
  m.receiveShadow = true;
  world.add(m);
}

/** Camera-following silhouettes of distant ranges (no fog: painted haze). */
function backdrop(world, P) {
  const at = world.at, L = P.look;
  const hor = col(at.sky[2]), fog = col(at.fog), tone = col(L.mtn);
  const M = 240;
  const pos = [], cc = [], idx = [];
  let base = 0;
  for (const [R, hMin, hMax, mix, seed, mesa] of L.ranges) {
    const n = makeNoise2D(P.seed + seed);
    const top = new THREE.Color().copy(hor).lerp(tone, mix);
    const bot = new THREE.Color().copy(fog).lerp(tone, mix * 0.55);
    for (let j = 0; j <= M; j++) {
      const a = j / M * Math.PI * 2;
      const px = Math.cos(a), pz = Math.sin(a);
      let h = n.ridged(px * 2.2 + 7, pz * 2.2 - 3, 4);
      h = smoothstep(0.25, 0.95, h) * 0.75 + n.fbm(px * 5 + 1, pz * 5, 2) * 0.25 + 0.15;
      if (mesa) h = Math.min(h, 0.55 + n.fbm(px * 1.3, pz * 1.3, 2) * 0.3) + (h > 0.5 ? 0.02 : 0);
      const y = hMin + (hMax - hMin) * clamp(h, 0, 1);
      pos.push(px * R, y, pz * R, px * R, -260, pz * R);
      cc.push(top.r, top.g, top.b, bot.r, bot.g, bot.b);
    }
    for (let j = 0; j < M; j++) {
      const a = base + j * 2;
      idx.push(a, a + 1, a + 2, a + 2, a + 1, a + 3);
    }
    base += (M + 1) * 2;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(cc, 3));
  g.setIndex(idx);
  const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, fog: false, side: THREE.DoubleSide }));
  m.frustumCulled = false;
  m.renderOrder = -5;
  m.position.y = P.meanY - 20;
  world.add(m);
  world.animators.push((dt, cam) => { m.position.x = cam.position.x; m.position.z = cam.position.z; });
}

// ------------------------------------------------------------------ road edges

function roadEdges(world, P) {
  const T = P.track, sh = T.shoulder;
  const tex = canvasTex(gravelCanvas());
  const mat = glowMaterial(new THREE.MeshStandardMaterial({ map: tex, color: col(P.look.shoulder), roughness: 0.95 }));
  const W = (i) => T.W[i];
  const drop = P.look.flat ? 0.45 : 1.25;
  const left = stripMesh(T, [
    { lat: W, dy: -0.012, u: 0, flat: true },
    { lat: (i) => W(i) + sh, dy: -0.06, u: sh / 3, flat: true },
    { lat: (i) => W(i) + sh + 4, dy: -drop, u: (sh + 4.2) / 3, flat: true },
  ], mat, 6);
  const right = stripMesh(T, [
    { lat: (i) => -W(i) - sh - 4, dy: -drop, u: (sh + 4.2) / 3, flat: true },
    { lat: (i) => -W(i) - sh, dy: -0.06, u: sh / 3, flat: true },
    { lat: (i) => -W(i), dy: -0.012, u: 0, flat: true },
  ], mat, 6);
  const m = new THREE.Mesh(mergeGeos([left.geometry, right.geometry]), mat);
  m.receiveShadow = true;
  world.add(m);
  world.glowMeshes.push(m);
}

// ------------------------------------------------------------------ canyon walls

function canyonWalls(world, P, mat) {
  const T = P.track, L = P.look;
  const cRock = col(L.rock), cCap = col(L.cap), cTalus = col(L.talus), cTop = col(L.top);
  const geos = [];
  for (const C of P.canyons) {
    for (const side of [1, -1]) {
      const S = C.sides[side];
      const idxs = [];
      for (let i = C.i0; i <= C.i1; i += 2) idxs.push(i);
      if (idxs[idxs.length - 1] !== C.i1) idxs.push(C.i1);
      const rows = [];
      const n = (a, f, s) => C.noise.fbm(s * f + a * 17.3, side * 4.1 + a, 2);
      for (const i of idxs) {
        const k = i - C.i0, s = i * T.step;
        const Lin = S.Lin[k], Lout = S.Lout[k];
        const gy = T.Y[i] - 0.35;
        const top = C.top(s, side);
        const H = top - gy;
        const sec = [
          [Lin - 3.6, gy - 0.8, 0],
          [Lin - 1.1 + n(1, 0.05, s) * 0.8, gy + 2.4 + n(2, 0.04, s) * 1.2, 0],
          [Lin + n(3, 0.03, s) * 0.9, gy + 0.09 * H + 2.2, 1],
          [Lin + 0.8 + n(4, 0.02, s) * 2.2, gy + 0.36 * H, 1],
          [Lin + 2.8 + n(4, 0.02, s) * 2.2, gy + 0.38 * H + 0.4, 1],
          [Lin + 3.3 + n(5, 0.025, s) * 2.4, gy + 0.68 * H, 1],
          [Lin + 5.4 + n(5, 0.025, s) * 2.4, gy + 0.7 * H + 0.4, 2],
          [Lin + 6.0 + n(6, 0.03, s) * 2.0, top - 0.5, 2],
          [Lin + 10 + n(7, 0.02, s) * 3, top + n(8, 0.01, s) * 1.5, 3],
          [Lout - 10, top + n(9, 0.008, s) * 2.5, 3],
          [Lout - 3, top - 3, 2],
          [Lout + 8, gy - 9, 0],
        ];
        rows.push(sec.map(([lat, y, tag], j) => {
          const lx = T.LX[i] * side * lat, lz = T.LZ[i] * side * lat;
          const t = (y - gy) / H;
          const c = tag === 0 ? cTalus : tag === 3 ? cTop : tag === 2 ? new THREE.Color().copy(cRock).lerp(cCap, 0.75) : new THREE.Color().copy(cRock).multiplyScalar(0.82 + 0.25 * t);
          return { x: T.X[i] + lx, y, z: T.Z[i] + lz, c, u: s / 14, v: j < 8 ? y / 11 : lat / 14 };
        }));
      }
      const want = (r, c) => {
        const i = idxs[r];
        const p = rows[r][c], q2 = rows[r][c + 1];
        const dl = (q2.x - p.x) * T.LX[i] * side + (q2.z - p.z) * T.LZ[i] * side, dy = q2.y - p.y;
        return new THREE.Vector3(T.LX[i] * side * -dy, dl, T.LZ[i] * side * -dy);
      };
      geos.push(gridGeo(rows, want));
      // mesa end caps
      for (const [r, dir] of [[0, -1], [rows.length - 1, 1]]) {
        const ring = rows[r];
        const ctr = new THREE.Vector3();
        for (const v of ring) ctr.add(new THREE.Vector3(v.x, v.y, v.z));
        ctr.divideScalar(ring.length);
        const i = idxs[r];
        const pts = ring.map((v) => Object.assign(new THREE.Vector3(v.x, v.y, v.z), { c: v.c }));
        pts.push(pts[0].clone());
        pts[pts.length - 1].c = ring[0].c;
        geos.push(fanGeo(ctr, pts, new THREE.Vector3(T.TX[i] * dir, 0, T.TZ[i] * dir), cRock));
      }
    }
  }
  const g = mergeGeos(geos);
  if (!g) return;
  const m = new THREE.Mesh(g, mat);
  m.castShadow = true;
  m.receiveShadow = true;
  world.add(m);
}

// ------------------------------------------------------------------ buttes + mesas

const FORM_LEVELS = {
  butte: [[1.75, -0.08, 0], [1.32, 0.1, 0], [1.08, 0.2, 0], [1.0, 0.24, 1], [0.97, 0.55, 1], [0.86, 0.58, 1], [0.84, 0.88, 1], [0.8, 0.95, 2], [0.78, 1.0, 2]],
  mesa: [[1.3, -0.06, 0], [1.1, 0.12, 0], [1.0, 0.18, 1], [0.99, 0.5, 1], [0.93, 0.53, 1], [0.92, 0.9, 1], [0.9, 0.96, 2], [0.89, 1.0, 2]],
  spire: [[2.6, -0.05, 0], [1.6, 0.12, 0], [1.08, 0.2, 1], [0.94, 0.6, 1], [0.8, 0.84, 1], [0.96, 0.87, 2], [0.92, 1.0, 2]],
};

function placeForms(P) {
  const T = P.track, L = P.look, rng = makeRng('forms' + P.def.id);
  const out = [];
  const q = {};
  const fence = P.def.fence ?? 32;
  for (const kind of ['mesa', 'butte', 'spire']) {
    const [count, dMin, dMax] = L.forms[kind];
    let made = 0;
    for (let tries = 0; tries < count * 60 && made < count; tries++) {
      const s = rng() * T.length, side = rng() < 0.5 ? 1 : -1;
      const d = dMin + (dMax - dMin) * Math.pow(rng(), 1.3);
      const i = clamp(Math.round(s / T.step), 0, T.N - 1);
      const x = T.X[i] + T.LX[i] * side * d, z = T.Z[i] + T.LZ[i] * side * d;
      const r = kind === 'mesa' ? 110 + rng() * 200 : kind === 'butte' ? 26 + rng() * 50 : 8 + rng() * 14;
      const ex = kind === 'mesa' ? 1.3 + rng() * 1.2 : 1 + rng() * 0.6;
      const reach = r * ex * (kind === 'spire' ? 2.6 : 1.75);
      P.near(x, z, q);
      if (q.d < reach + fence + 12) continue;
      // keep clear of the far side too: sample the footprint rim
      let bad = false;
      for (let a = 0; a < 6.28 && !bad; a += 0.8) {
        P.near(x + Math.cos(a) * reach, z + Math.sin(a) * reach, q);
        if (q.d < fence + 10) bad = true;
      }
      if (bad || out.some((f) => Math.hypot(f.x - x, f.z - z) < (f.reach + reach) * 0.9)) continue;
      const H = kind === 'mesa' ? 45 + rng() * 70 : kind === 'butte' ? 40 + rng() * 60 : 30 + rng() * 50;
      out.push({ kind, x, z, r, ex, rot: rng() * Math.PI, H, reach, seed: rng() * 1000 });
      made++;
    }
  }
  return out;
}

function formationGeo(f, baseY, L) {
  const rng = makeRng('f' + f.seed);
  const levels = FORM_LEVELS[f.kind];
  const seg = clamp(Math.round(f.r * f.ex * 0.35), 12, 30);
  const ph = [0, 1, 2, 3].map(() => rng() * 6.283);
  const shape = (a) => 1 + 0.16 * Math.sin(2 * a + ph[0]) + 0.1 * Math.sin(3 * a + ph[1]) + 0.06 * Math.sin(5 * a + ph[2]) + 0.04 * Math.sin(7 * a + ph[3]);
  const cr = Math.cos(f.rot), sr = Math.sin(f.rot);
  const cRock = col(L.rock), cCap = col(L.cap), cTalus = col(L.talus), cTop = col(L.top);
  const rows = [];
  const perim = Math.round(f.r * f.ex * 6.28 / 14);
  for (const [k, yf, tag] of levels) {
    const row = [];
    for (let j = 0; j <= seg; j++) {
      const a = (j % seg) / seg * Math.PI * 2;
      const jit = j === seg ? row[0].jit : (rng() - 0.5) * (tag === 0 ? 0.12 : 0.07);
      const rr = f.r * shape(a) * (k + jit);
      const lx = Math.cos(a) * rr * f.ex, lz = Math.sin(a) * rr;
      const y = baseY + f.H * yf + (tag === 1 ? (rng() - 0.5) * 1.2 : 0);
      const c = tag === 0 ? cTalus : tag === 2 ? new THREE.Color().copy(cRock).lerp(cCap, 0.8) : new THREE.Color().copy(cRock).multiplyScalar(0.85 + 0.2 * yf);
      row.push({ x: f.x + lx * cr - lz * sr, y, z: f.z + lx * sr + lz * cr, c, u: j / seg * perim, v: y / 11, jit });
    }
    rows.push(row);
  }
  const g = gridGeo(rows, (r, c) => {
    const p = rows[r][c];
    return new THREE.Vector3(p.x - f.x, 0, p.z - f.z);
  });
  const topRow = rows[rows.length - 1];
  const ring = topRow.map((v) => Object.assign(new THREE.Vector3(v.x, v.y, v.z), { c: cTop }));
  const ctr = new THREE.Vector3(f.x, baseY + f.H + 0.6, f.z);
  return [g, fanGeo(ctr, ring, new THREE.Vector3(0, 1, 0), cTop)];
}

function formations(world, P, mat) {
  const terr = world.terrain, L = P.look;
  const list = placeForms(P);
  P.forms = list;
  const geos = [];
  for (const f of list) {
    let y = P.floorAt(f.x, f.z);
    if (f.x > P.gx0 && f.x < P.gx1 && f.z > P.gz0 && f.z < P.gz1) {
      y = Infinity;
      for (let a = 0; a < 6.28; a += 0.7) y = Math.min(y, terr.heightAt(f.x + Math.cos(a) * f.r, f.z + Math.sin(a) * f.r));
    }
    geos.push(...formationGeo(f, y - 3, L));
  }
  const g = mergeGeos(geos);
  if (!g) return;
  const m = new THREE.Mesh(g, mat);
  m.receiveShadow = true;
  m.castShadow = true;
  world.add(m);
}

// ------------------------------------------------------------------ vegetation + rocks

function vegGeometries() {
  const G = {};
  const green = '#58703a', dark = '#3f5129';
  // saguaros: ribbed trunk + arms (variants by arm count)
  const saguaro = (arms) => {
    const gb = new GeoBuilder();
    const rings = [[0, 0.34], [2.2, 0.37], [4.6, 0.36], [6.8, 0.34], [7.6, 0.26], [8.05, 0.0]];
    const seg = 8;
    for (let r = 0; r < rings.length - 1; r++) {
      const [y0, r0] = rings[r], [y1, r1] = rings[r + 1];
      for (let j = 0; j < seg; j++) {
        const a0 = j / seg * Math.PI * 2, a1 = (j + 1) / seg * Math.PI * 2;
        const k0 = j % 2 ? 0.86 : 1, k1 = (j + 1) % 2 ? 0.86 : 1;
        setColor(gb, j % 2 ? dark : green, r === rings.length - 2 ? 1.15 : 1);
        const A = new THREE.Vector3(Math.cos(a0) * r0 * k0, y0, Math.sin(a0) * r0 * k0);
        const B = new THREE.Vector3(Math.cos(a1) * r0 * k1, y0, Math.sin(a1) * r0 * k1);
        const C = new THREE.Vector3(Math.cos(a1) * r1 * k1, y1, Math.sin(a1) * r1 * k1);
        const D = new THREE.Vector3(Math.cos(a0) * r0 * k0 * (r1 / r0 || 0), y1, Math.sin(a0) * r0 * k0 * (r1 / r0 || 0));
        gb.quad(B, A, D, C);
      }
    }
    setColor(gb, green, 0.95);
    for (const [ang, h, up] of arms) {
      const dx = Math.cos(ang), dz = Math.sin(ang);
      const V = (o, y) => new THREE.Vector3(dx * o, h + y, dz * o);
      tube(gb, [V(0.1, 0), V(0.55, 0.05), V(0.95, 0.35), V(1.05, 0.9), V(1.05, up), V(1.05, up + 0.32)], [0.25, 0.25, 0.25, 0.24, 0.22, 0.04], 5);
    }
    return gb.build(true);
  };
  G.saguaro = [
    saguaro([[0.4, 3.1, 2.3], [Math.PI + 0.3, 3.9, 1.9]]),
    saguaro([[1.2, 2.9, 2.6], [3.6, 3.6, 2.2], [5.4, 4.4, 1.6]]),
    saguaro([[2.2, 3.4, 2.0]]),
    saguaro([]),
  ];
  // creosote: loose clump of dark olive blobs
  {
    const gb = new GeoBuilder();
    const m = new THREE.Matrix4();
    const parts = [[0, 0.55, 0, 0.75], [0.55, 0.45, 0.2, 0.55], [-0.4, 0.5, 0.35, 0.6], [0.1, 0.42, -0.5, 0.5]];
    parts.forEach(([x, y, z, r], k) => {
      setColor(gb, k % 2 ? '#56602f' : '#4a5528');
      const ico = jitter(new THREE.IcosahedronGeometry(r, 0), 0.35, k, 0.8);
      gb.geometry(ico, m.makeTranslation(x, y, z));
    });
    G.creosote = gb.build(true);
  }
  {
    const gb = new GeoBuilder();
    setColor(gb, '#8d8a66');
    gb.geometry(jitter(new THREE.IcosahedronGeometry(0.5, 0), 0.3, 3, 0.62), new THREE.Matrix4().makeTranslation(0, 0.22, 0));
    G.bursage = gb.build(true);
  }
  {
    // ocotillo: thin whips fanning out of one base
    const gb = new GeoBuilder();
    const rng = makeRng('ocotillo');
    for (let k = 0; k < 9; k++) {
      const a = k / 9 * Math.PI * 2 + rng() * 0.4, lean = 0.12 + rng() * 0.3, len = 3 + rng() * 1.6;
      const tip = new THREE.Vector3(Math.cos(a) * Math.sin(lean) * len, Math.cos(lean) * len, Math.sin(a) * Math.sin(lean) * len);
      setColor(gb, rng() < 0.5 ? '#5d5b3b' : '#4f5a33');
      tube(gb, [new THREE.Vector3(0, 0, 0), tip.clone().multiplyScalar(0.5), tip], [0.06, 0.045, 0.015], 3);
    }
    G.ocotillo = gb.build(true);
  }
  {
    const gb = new GeoBuilder();
    setColor(gb, '#5f7034');
    gb.cylinder(0, 0, 0, 0.34, 0.6, 8, 0.3);
    setColor(gb, '#c8a03a');
    gb.cylinder(0, 0.6, 0, 0.3, 0.12, 8, 0.08);
    G.barrel = gb.build(true);
  }
  {
    // yucca: spiky rosette on a short trunk
    const gb = new GeoBuilder();
    const rng = makeRng('yucca');
    setColor(gb, '#6a5a44');
    gb.cylinder(0, 0, 0, 0.12, 0.7, 5, 0.1);
    for (let k = 0; k < 14; k++) {
      const a = rng() * Math.PI * 2, lean = 0.2 + rng() * 0.9, len = 0.7 + rng() * 0.4;
      const base = new THREE.Vector3(0, 0.7, 0);
      const tip = base.clone().add(new THREE.Vector3(Math.cos(a) * Math.sin(lean) * len, Math.cos(lean) * len, Math.sin(a) * Math.sin(lean) * len));
      setColor(gb, rng() < 0.5 ? '#6e7a40' : '#7d8650');
      tube(gb, [base, tip], [0.05, 0.005], 3);
    }
    G.yucca = gb.build(true);
  }
  {
    // juniper: dark rounded crown on a twisted trunk
    const gb = new GeoBuilder();
    setColor(gb, '#5a4636');
    tube(gb, [new THREE.Vector3(0, 0, 0), new THREE.Vector3(0.2, 0.8, 0.1), new THREE.Vector3(0.05, 1.5, -0.1)], [0.16, 0.12, 0.08], 5);
    const m = new THREE.Matrix4();
    [[0, 2.1, 0, 1.15], [0.6, 1.7, 0.3, 0.8], [-0.5, 1.8, -0.2, 0.85]].forEach(([x, y, z, r], k) => {
      setColor(gb, k ? '#3c5232' : '#34492c');
      gb.geometry(jitter(new THREE.IcosahedronGeometry(r, 0), 0.3, k + 7, 0.85), m.makeTranslation(x, y, z));
    });
    G.juniper = gb.build(true);
  }
  G.rock = jitter(new THREE.DodecahedronGeometry(1, 0), 0.45, 2, 0.7);
  G.boulder = jitter(new THREE.IcosahedronGeometry(1, 0), 0.4, 5, 0.85);
  return G;
}

function vegetation(world, P) {
  const T = P.track, L = P.look, terr = world.terrain;
  const counts = L.veg;
  if (!Object.keys(counts).length) return;
  const G = vegGeometries();
  const plantMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92, envMapIntensity: 0.3 });
  const rockMat = new THREE.MeshStandardMaterial({ color: col(L.talus).multiplyScalar(1.15), roughness: 0.95, flatShading: true, envMapIntensity: 0.3 });
  const rng = makeRng('veg' + P.def.id);
  const q = {};
  const fence = P.def.fence ?? 32;
  const ok = (x, z, clear, opts) => {
    if (x < P.gx0 + 30 || x > P.gx1 - 30 || z < P.gz0 + 30 || z > P.gz1 - 30) return false;
    P.near(x, z, q);
    if (q.i >= 0) {
      if (q.d < T.W[q.i] + T.shoulder + clear) return false;
      for (const C of P.canyons) {
        if (q.i >= C.i0 - 20 && q.i <= C.i1 + 20) {
          const k = clamp(q.i - C.i0, 0, C.i1 - C.i0);
          const S = C.sides[q.lat > 0 ? 1 : -1];
          if (Math.abs(q.lat) > S.Lin[k] - 5 && Math.abs(q.lat) < S.Lout[k] + 10) return false;
        }
      }
    }
    if (P.stop && P.stop.mask(x, z) > 0.02) return false;
    if (!opts.wash) for (const W of P.washes) if (W.mask(x, z) > 0.25) return false;
    for (const f of P.forms || []) if (Math.hypot(f.x - x, f.z - z) < f.reach * 0.92) return false;
    const n = terr.normalAt(x, z);
    return n[1] > (opts.minUp ?? 0.86);
  };
  const place = (count, opts) => {
    const list = [];
    for (let t = 0; t < count * 4 && list.length < count; t++) {
      const s = rng() * T.length, side = rng() < 0.5 ? 1 : -1;
      const i = clamp(Math.round(s / T.step), 0, T.N - 1);
      const d = T.W[i] + opts.dMin + (opts.dMax - opts.dMin) * Math.pow(rng(), opts.pow ?? 1.6);
      const x = T.X[i] + T.LX[i] * side * d + (rng() - 0.5) * 6, z = T.Z[i] + T.LZ[i] * side * d + (rng() - 0.5) * 6;
      if (!ok(x, z, opts.clear ?? 3, opts)) continue;
      const sc = opts.s[0] + (opts.s[1] - opts.s[0]) * rng();
      const v = 0.85 + rng() * 0.3;
      list.push({
        x, z, y: terr.heightAt(x, z) - (opts.sink ?? 0.05) * sc, ry: rng() * Math.PI * 2, s: sc,
        rx: opts.tilt ? (rng() - 0.5) * opts.tilt : 0, rz: opts.tilt ? (rng() - 0.5) * opts.tilt : 0,
        color: new THREE.Color(v * (0.95 + rng() * 0.1), v, v * (0.92 + rng() * 0.1)),
      });
    }
    return list;
  };
  const near = { dMin: 4, dMax: 320 };
  if (counts.saguaro) {
    const all = place(counts.saguaro, { ...near, dMin: 7, s: [0.55, 1.25], minUp: 0.9, clear: 5 });
    G.saguaro.forEach((g, k) => scatter(world, g, plantMat, all.filter((_, j) => j % 4 === k), { shadow: true }));
  }
  if (counts.creosote) scatter(world, G.creosote, plantMat, place(counts.creosote, { ...near, s: [0.7, 1.6] }));
  if (counts.bursage) scatter(world, G.bursage, plantMat, place(counts.bursage, { ...near, dMin: 3, s: [0.7, 1.5] }));
  if (counts.ocotillo) scatter(world, G.ocotillo, plantMat, place(counts.ocotillo, { ...near, dMin: 6, s: [0.8, 1.3] }));
  if (counts.barrel) scatter(world, G.barrel, plantMat, place(counts.barrel, { ...near, dMax: 120, s: [0.7, 1.4] }));
  if (counts.yucca) scatter(world, G.yucca, plantMat, place(counts.yucca, { ...near, s: [0.8, 1.5] }));
  if (counts.juniper) scatter(world, G.juniper, plantMat, place(counts.juniper, { ...near, dMin: 8, s: [0.8, 1.7], minUp: 0.8 }), { shadow: true });
  if (counts.rock) scatter(world, G.rock, rockMat, place(counts.rock, { ...near, dMin: 2, s: [0.25, 0.8], sink: 0.35, minUp: 0.6, tilt: 0.8, wash: true }));
  if (counts.boulder) scatter(world, G.boulder, rockMat, place(counts.boulder, { ...near, dMin: 10, dMax: 420, s: [1.2, 3.6], sink: 0.4, minUp: 0.55, tilt: 0.6, clear: 6 }), { shadow: true });
  void fence;
}

// ------------------------------------------------------------------ build

export async function build(world, def, track, progress) {
  const P = plan(def, track);
  const T = track;
  T.shoulder = def.shoulder ?? 1.4;
  T.offSurface = def.offSurface || 'sand';

  buildGround(world, P);
  backdrop(world, P);
  progress(0.15, 'BAKING THE SAND');
  await nextFrame();

  roadEdges(world, P);
  const rockTex = canvasTex(rockCanvas());
  const rockMat = desertMaterial(rockTex, P.look, 'rock');
  if (P.canyons.length) canyonWalls(world, P, rockMat);
  formations(world, P, rockMat);
  progress(0.35, 'RAISING BUTTES');
  await nextFrame();

  vegetation(world, P);
  progress(0.6, 'PLANTING SAGUAROS');
  await nextFrame();

  setWalls(P);
  progress(1, 'DESERT READY');
}

/** Collision walls: right-of-way fence in the open, rock in canyons. */
function setWalls(P) {
  const T = P.track;
  const fence = P.def.fence ?? 32;
  for (let i = 0; i < T.N; i++) {
    T.WL[i] = Math.max(T.W[i] + 8, fence);
    T.WR[i] = Math.max(T.W[i] + 8, fence);
  }
  for (const C of P.canyons) {
    for (let i = C.i0; i <= C.i1; i++) {
      const k = i - C.i0;
      T.WL[i] = Math.min(T.WL[i], C.sides[1].Lin[k] - 3);
      T.WR[i] = Math.min(T.WR[i], C.sides[-1].Lin[k] - 3);
    }
  }
  for (let i = 0; i < T.N; i++) {
    T.WL[i] = Math.max(T.WL[i], T.W[i] + T.shoulder + 0.8);
    T.WR[i] = Math.max(T.WR[i], T.W[i] + T.shoulder + 0.8);
  }
}

export default { natural, terrainOpts, build };
