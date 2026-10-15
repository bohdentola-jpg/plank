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
    margin: 500, cell: 20, detail: 'sand', tile: 9, frameRise: 0, shrubs: 0.75, tumbleweeds: true,
    sand: '#c8ae88', soil: '#a88f72', red: '#bb8660', pave: '#86705a', dune: '#d9c29a', rock: '#9b5b3f', cap: '#cfb18f', talus: '#97765f',
    top: '#8e7458', wash: '#e4d6ba', lot: '#8f877c', shoulder: '#b9ab96',
    hills: 12, hummock: 1.6, dunes: 8, duneAt: 0.1, duneLen: 105, outcrops: 26, outcropAt: 0.5, outcropF: 0.0024, terrace: 6.5, follow: 120,
    bands: ['#fff1e2', '#c99a83', '#fff4dc'],
    veg: { creosote: 3200, bursage: 1600, grass: 2400, saguaro: 400, ocotillo: 110, barrel: 140, yucca: 60, juniper: 0, rock: 650, boulder: 170 },
    forms: { mesa: [7, 520, 1700], butte: [10, 170, 900], spire: [6, 140, 700] },
    mtn: '#6f7896', ranges: [[2950, 110, 330, 0.42, 3, false], [2700, 50, 170, 0.62, 9, true]],
  },
  redrock: {
    margin: 550, cell: 12, detail: 'red', tile: 8, frameRise: 0, shrubs: 0.55,
    sand: '#d29c78', soil: '#b47a58', red: '#a85a3a', pave: '#7e5a46', dune: '#dcae86', rock: '#a0462c', cap: '#dcb692', talus: '#8d5638',
    top: '#87604a', wash: '#ecd2ae', lot: '#8a7a6c', shoulder: '#b08d72',
    hills: 14, hummock: 1.8, dunes: 3, duneAt: 0.5, duneLen: 90, outcrops: 32, outcropAt: 0.3, outcropF: 0.003, terrace: 7, follow: 110,
    bands: ['#fff0e4', '#c2846c', '#fff6e6'],
    veg: { creosote: 1400, bursage: 900, grass: 1800, saguaro: 0, ocotillo: 30, barrel: 50, yucca: 200, juniper: 340, rock: 650, boulder: 300 },
    forms: { mesa: [6, 300, 1300], butte: [18, 70, 700], spire: [12, 55, 500] },
    mtn: '#4f3f6c', ranges: [[2950, 90, 260, 0.45, 5, true], [2650, 40, 150, 0.66, 13, true]],
  },
  salt: {
    margin: 1500, cell: 40, detail: 'salt', tile: 22, flat: true, floorY: -0.35, frameRise: 70, shrubs: 0, tumbleweeds: true,
    sand: '#efebe3', soil: '#e3ddd1', red: '#e9e2d6', pave: '#ddd6ca', dune: '#efebe3', rock: '#a3735a', cap: '#d8c2a6', talus: '#9b7c66',
    top: '#a07a60', wash: '#efebe3', lot: '#d9d3c8', shoulder: '#cfc9bf', shore: '#c7aa8a',
    hills: 0, hummock: 0, dunes: 0, outcrops: 0, follow: 0,
    bands: ['#fff0e6', '#caa090', '#fff4e8'],
    veg: {},
    forms: { mesa: [4, 1700, 2600], butte: [0, 0, 0], spire: [0, 0, 0] },
    mtn: '#4c4174', ranges: [[2950, 160, 420, 0.42, 21, false], [2600, 70, 230, 0.62, 27, false]],
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

/** Dunes + broad hills + terraced outcrops (big, away from the road) and hummocks (close).
 *  fbm here spans roughly ±0.3, so it is rescaled to ~±1 first. */
function reliefFn(L, seed) {
  if (L.flat) return () => 0;
  const nA = makeNoise2D(seed + 11), nB = makeNoise2D(seed + 23), nC = makeNoise2D(seed + 37), nD = makeNoise2D(seed + 41);
  const N = (n, x, z, o) => n.fbm(x, z, o) * 3.3;
  const duneMask = (x, z) => L.dunes > 0 ? smoothstep(L.duneAt, L.duneAt + 0.5, N(nB, x * 0.0007 + 5.2, z * 0.0007 - 1.7, 3)) : 0;
  const f = (x, z, kBig, kNear, kRock = kBig) => {
    let h = 0;
    if (kBig > 0) {
      let b = (N(nA, x * 0.0012, z * 0.0012, 4) + 0.7) * L.hills * 0.5;
      const m = duneMask(x, z);
      if (m > 0.001) {
        const u = (x * 0.93 + z * 0.37) / L.duneLen + N(nB, x * 0.0035, z * 0.0035, 2) * 0.6;
        const fr = u - Math.floor(u);
        const p = fr < 0.7 ? fr / 0.7 : (1 - fr) / 0.3;
        b += p * p * (3 - 2 * p) * m * L.dunes * (0.8 + 0.3 * N(nC, x * 0.002, z * 0.002, 2));
      }
      h += b * kBig;
    }
    if (kRock > 0 && L.outcrops > 0) {
      const o = N(nC, x * L.outcropF + 13.1, z * L.outcropF - 7.7, 4);
      if (o > L.outcropAt) {
        const raw = Math.min(1, (o - L.outcropAt) * 2.4) * L.outcrops;
        const lv = raw / L.terrace, fl = Math.floor(lv);
        h += (fl + smoothstep(0.72, 1, lv - fl)) * L.terrace * kRock;
      }
    }
    if (kNear > 0) h += N(nD, x * 0.012, z * 0.012, 3) * L.hummock * kNear;
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
    // narrow the slab into a promontory toward each mouth
    const taper = (k) => { const s = (i0 + k) * T.step; const e = Math.min(s - c.s0, c.s1 - s); return 0.18 + 0.82 * smoothstep(0, 170, e); };
    sides[side] = { Lin, Lout: sm.map((v, k) => Lin[k] + Math.max(v - Lin[k], 26) * taper(k)) };
  }
  const top = (s, side) => {
    const e = Math.min(s - c.s0, c.s1 - s);
    return ymax + c.h * (0.86 + 0.14 * (n.fbm(s * 0.003 + side * 5, 1.3, 2) + 0.5)) * (0.72 + 0.28 * smoothstep(0, 110, e));
  };
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
    h += P.relief(x, z, smoothstep(w0 + 22, w0 + 170, q.d) * fade, smoothstep(w0 + 4, w0 + 30, q.d) * fade, smoothstep(w0 + 20, w0 + 80, q.d) * fade);
    h += micro.fbm(x * 0.05, z * 0.05, 2) * 0.35 * smoothstep(w0 + 3, w0 + 16, q.d) * fade;
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
    // plain gritty band (canvas rows 0..40 → v 0.92..1) for mesa tops and ledges
    x.fillStyle = '#ddd2c6';
    x.fillRect(0, 0, S, 40);
    for (let i = 0; i < 900; i++) { const v = 150 + rng() * 90; x.fillStyle = `rgba(${v},${v * 0.95},${v * 0.9},0.5)`; x.fillRect(rng() * S, rng() * 40, 1 + rng() * 3, 1 + rng() * 2); }
    const img = x.getImageData(0, 0, S, S), d = img.data;
    for (let k = 0; k < d.length; k += 4) { const n = (rng() - 0.5) * 22; d[k] += n; d[k + 1] += n; d[k + 2] += n; }
    x.putImageData(img, 0, 0);
    return c;
  });
}

const TOP_V = (x, z) => 0.935 + 0.05 * (0.5 + 0.5 * Math.sin(x * 0.07 + z * 0.05));

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

/** World-space speckle of shrubs + their shadows (tile = 40 m); multiplies the ground. */
function shrubCanvas() {
  return cachedCanvas('shrubs', () => {
    const S = 512, c = cvs(S, S), x = c.getContext('2d');
    const rng = makeRng('shrubdots');
    x.fillStyle = '#fff';
    x.fillRect(0, 0, S, S);
    for (let i = 0; i < 260; i++) {
      const px = rng() * S, py = rng() * S, r = 2.5 + Math.pow(rng(), 2) * 6;
      wrapped(S, px, py, r + 6, (X, Y) => {
        x.fillStyle = 'rgba(90,80,66,0.18)';
        x.beginPath(); x.ellipse(X + r * 0.5, Y + r * 0.35, r * 1.1, r * 0.8, 0, 0, Math.PI * 2); x.fill();
      });
      const tone = rng() < 0.6 ? '112,118,76' : rng() < 0.5 ? '132,126,92' : '146,130,100';
      for (let k = 0; k < 3; k++) {
        const ox = (rng() - 0.5) * r, oy = (rng() - 0.5) * r, rr = r * (0.45 + rng() * 0.4);
        wrapped(S, px + ox, py + oy, rr, (X, Y) => {
          x.fillStyle = `rgba(${tone},0.85)`;
          x.beginPath(); x.arc(X, Y, rr, 0, Math.PI * 2); x.fill();
        });
      }
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

/** Standard material + world-space strata on steep faces + anti-tiling detail (+ shrub speckle). */
function desertMaterial(map, L, key, extra = {}, shrubs = null) {
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, map, roughness: 0.97, metalness: 0, envMapIntensity: 0.45, ...extra });
  const bands = L.bands.map((h) => col(h));
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uBandA = { value: bands[0] };
    sh.uniforms.uBandB = { value: bands[1] };
    sh.uniforms.uBandC = { value: bands[2] };
    if (shrubs) sh.uniforms.uShrub = { value: shrubs };
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vDWP;\nvarying float vDUp;' + (shrubs ? '\nattribute float dens;\nvarying float vDens;' : ''))
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvDWP = (modelMatrix * vec4(transformed, 1.0)).xyz;\nvDUp = normalize(mat3(modelMatrix) * objectNormal).y;' + (shrubs ? '\nvDens = dens;' : ''));
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\n' + STRATA + (shrubs ? '\nuniform sampler2D uShrub;\nvarying float vDens;' : ''))
      .replace('#include <map_fragment>', `#ifdef USE_MAP
        vec4 sampledDiffuseColor = texture2D(map, vMapUv);
        sampledDiffuseColor.rgb *= 0.74 + 0.32 * texture2D(map, vMapUv * 0.137 + vec2(0.37, 0.61)).g;
        diffuseColor *= sampledDiffuseColor;
      #endif`)
      .replace('#include <color_fragment>', '#include <color_fragment>\ndiffuseColor.rgb *= desertStrata(vDWP, vDUp);' +
        (shrubs ? '\ndiffuseColor.rgb *= mix(vec3(1.0), texture2D(uShrub, vDWP.xz / 40.0).rgb, vDens * smoothstep(25.0, 90.0, length(vDWP - cameraPosition)));' : ''));
  };
  m.customProgramCacheKey = () => 'desert-' + key + (shrubs ? '-s' : '');
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
function fanGeo(center, ring, wantN, c, top = false) {
  const n = ring.length;
  const pos = new Float32Array((n + 1) * 3), color = new Float32Array((n + 1) * 3), uv = new Float32Array((n + 1) * 2);
  pos.set([center.x, center.y, center.z], 0);
  for (let k = 0; k < n; k++) pos.set([ring[k].x, ring[k].y, ring[k].z], (k + 1) * 3);
  for (let k = 0; k <= n; k++) {
    const cc = k === 0 ? c : (ring[k - 1].c || c);
    color.set([cc.r, cc.g, cc.b], k * 3);
    const p = k === 0 ? center : ring[k - 1];
    uv.set(top ? [(p.x + p.z) / 30, TOP_V(p.x, p.z)] : [(p.x + p.z) / 20, p.y / 16], k * 2);
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
  if (!list.length) return [];
  const cell = opts.cell ?? 1400;
  const groups = new Map();
  for (const o of list) {
    const k = Math.floor(o.x / cell) * 65536 + Math.floor(o.z / cell);
    let g = groups.get(k);
    if (!g) groups.set(k, (g = []));
    g.push(o);
  }
  const out = [];
  for (const g of groups.values()) {
    const im = instanced(geo, mat, g, { shadow: !!opts.shadow, receive: opts.receive ?? true });
    im.name = opts.name || 'inst';
    out.push(world.add(im));
  }
  if (opts.maxDist) {
    // drop whole chunks once they are too far to matter
    for (const im of out) im.computeBoundingSphere();
    const lim = opts.maxDist;
    world.animators.push((dt, cam) => {
      for (const im of out) {
        const b = im.boundingSphere;
        im.visible = cam.position.distanceTo(b.center) - b.radius < lim;
      }
    });
  }
  return out;
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
  const shrubTex = L.shrubs ? canvasTex(shrubCanvas()) : null;
  const mat = desertMaterial(tex, L, 'ground', {}, shrubTex);
  P.groundMat = mat;
  const mesh = terr.mesh(mat, { flat: L.sand, steep: L.rock });
  recolor(mesh.geometry, P, world);
  tileTerrain(world, mesh, terr, 64);
  farFrame(world, P, mat, gw, gd);
}

/** Ground palette: sand/soil/pavement patches, red ground, pale dunes and washes, rock on steep faces.
 *  Returns the shrub density (0..1) for the speckle layer. */
function groundColor(P, x, y, z, ny, out) {
  const L = P.look;
  const C = P.cols || (P.cols = {
    sand: col(L.sand), soil: col(L.soil), red: col(L.red), pave: col(L.pave), dune: col(L.dune), rock: col(L.rock),
    wash: col(L.wash), lot: col(L.lot), top: col(L.top), shore: col(L.shore || L.sand),
    n1: makeNoise2D(P.seed + 101), n2: makeNoise2D(P.seed + 202), n3: makeNoise2D(P.seed + 303), n4: makeNoise2D(P.seed + 404),
  });
  if (L.flat) {
    const r = P.shoreR ? P.shoreR(x, z) : 0;
    out.copy(C.sand).lerp(C.soil, smoothstep(0.2, 0.6, C.n1.fbm(x * 0.004, z * 0.004, 3) + 0.3) * 0.6);
    out.lerp(C.shore, smoothstep(1.0, 1.4, r));
    out.multiplyScalar(0.97 + 0.05 * C.n3.fbm(x * 0.01, z * 0.01, 2));
    return 0;
  }
  const N = (n, xx, zz, o) => n.fbm(xx, zz, o) * 3.3;
  const a = N(C.n1, x * 0.004, z * 0.004, 3);
  out.copy(C.sand).lerp(C.soil, smoothstep(-0.4, 0.6, a));
  out.lerp(C.red, smoothstep(0.1, 0.9, N(C.n2, x * 0.0013 + 4, z * 0.0013, 3)) * 0.8);
  const pav = smoothstep(0.3, 1.0, N(C.n4, x * 0.009 + 2, z * 0.009, 3));
  out.lerp(C.pave, pav * 0.6);
  const dune = P.relief.duneMask(x, z);
  out.lerp(C.dune, dune * 0.85);
  // thin drainage rills: pale sand lines
  const rill = smoothstep(0.75, 0.95, 1 - Math.abs(N(C.n3, x * 0.0045 - 3, z * 0.0045 + 8, 3)) * 0.8);
  out.lerp(C.wash, rill * 0.45);
  let wash = 0, bank = 0;
  for (const W of P.washes) {
    const m = W.mask(x, z, 6);
    wash = Math.max(wash, m);
    bank = Math.max(bank, W.mask(x, z, 26) - m);
  }
  out.multiplyScalar(1 - bank * 0.22);
  out.lerp(C.wash, wash);
  if (P.stop) out.lerp(C.lot, smoothstep(0.55, 0.95, P.stop.mask(x, z)) * 0.85);
  const hRel = y - P.floorAt(x, z);
  out.lerp(C.top, smoothstep(12, 24, hRel) * 0.5);
  const steep = smoothstep(0.9, 0.66, ny);
  out.lerp(C.rock, steep);
  out.multiplyScalar(0.9 + 0.2 * smoothstep(-1, 1, N(C.n3, x * 0.02, z * 0.02, 2)));
  let dens = L.shrubs * (1 - dune * 0.85) * (1 - steep) * (1 - wash * 0.7) * (0.3 + 0.7 * smoothstep(-0.7, 0.7, N(C.n2, x * 0.006, z * 0.006 + 3, 2)));
  dens = Math.min(1, dens + rill * 0.35 * L.shrubs + bank * 0.9);
  return dens;
}

function recolor(g, P, world) {
  const pos = g.attributes.position, nor = g.attributes.normal, c = g.attributes.color;
  const dens = new Float32Array(pos.count);
  const tmp = new THREE.Color();
  if (P.look.flat) {
    const T = P.track;
    const cx = (T.bounds.minX + T.bounds.maxX) / 2, cz = (T.bounds.minZ + T.bounds.maxZ) / 2;
    P.shoreR = (x, z) => Math.hypot((x - cx) / 1300, (z - cz) / 1900);
  }
  for (let k = 0; k < pos.count; k++) {
    const x = pos.getX(k), y = pos.getY(k), z = pos.getZ(k);
    dens[k] = groundColor(P, x, y, z, nor.getY(k), tmp);
    const j = Math.sin(x * 12.9898 + z * 78.233) * 43758.5453;
    const f = 0.95 + (j - Math.floor(j)) * 0.1;
    c.setXYZ(k, tmp.r * f, tmp.g * f, tmp.b * f);
  }
  c.needsUpdate = true;
  g.setAttribute('dens', new THREE.BufferAttribute(dens, 1));
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
      for (const n of ['position', 'normal', 'uv', 'color', 'dens']) if (g.attributes[n]) tg.setAttribute(n, g.attributes[n]);
      tg.setIndex(new THREE.BufferAttribute(idx, 1));
      tg.boundingBox = box;
      tg.boundingSphere = box.getBoundingSphere(new THREE.Sphere());
      const m = new THREE.Mesh(tg, mesh.material);
      m.receiveShadow = true;
      m.name = 'terrain';
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
  m.name = 'frame';
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
  m.name = 'backdrop';
  m.position.y = P.meanY - 20;
  world.add(m);
  world.animators.push((dt, cam) => { m.position.x = cam.position.x; m.position.z = cam.position.z; });
}

// ------------------------------------------------------------------ road edges

/** stripMesh with a row stride (shoulders don't need a row every 2 m). Includes 'glow'. */
function edgeStrip(T, cols, stride) {
  const rowsI = [];
  const last = T.closed ? T.N : T.N - 1;
  for (let r = 0; r < last; r += stride) rowsI.push(r);
  rowsI.push(last);
  const nc = cols.length, R = rowsI.length;
  const pos = new Float32Array(R * nc * 3), uv = new Float32Array(R * nc * 2);
  rowsI.forEach((r, k) => {
    const i = T.idx(r);
    for (let c = 0; c < nc; c++) {
      const lat = cols[c].lat(i), q = k * nc + c;
      pos[q * 3] = T.X[i] + T.LX[i] * lat;
      pos[q * 3 + 1] = T.roadY(i, 0, clamp(lat, -T.W[i], T.W[i])) + cols[c].dy;
      pos[q * 3 + 2] = T.Z[i] + T.LZ[i] * lat;
      uv[q * 2] = cols[c].u; uv[q * 2 + 1] = r * T.step / 6;
    }
  });
  const idx = [];
  for (let k = 0; k < R - 1; k++) for (let c = 0; c < nc - 1; c++) { const a = k * nc + c, b = a + 1, d = a + nc, e = d + 1; idx.push(a, d, b, b, d, e); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  g.setAttribute('glow', new THREE.BufferAttribute(new Float32Array(R * nc * 3), 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

function roadEdges(world, P) {
  const T = P.track, sh = T.shoulder;
  const tex = canvasTex(gravelCanvas());
  const mat = glowMaterial(new THREE.MeshStandardMaterial({ map: tex, color: col(P.look.shoulder), roughness: 0.95 }));
  const W = (i) => T.W[i];
  const drop = P.look.flat ? 0.45 : 1.25;
  const left = edgeStrip(T, [
    { lat: W, dy: -0.012, u: 0 },
    { lat: (i) => W(i) + sh, dy: -0.06, u: sh / 3 },
    { lat: (i) => W(i) + sh + 4, dy: -drop, u: (sh + 4.2) / 3 },
  ], 2);
  const right = edgeStrip(T, [
    { lat: (i) => -W(i) - sh - 4, dy: -drop, u: (sh + 4.2) / 3 },
    { lat: (i) => -W(i) - sh, dy: -0.06, u: sh / 3 },
    { lat: (i) => -W(i), dy: -0.012, u: 0 },
  ], 2);
  const m = new THREE.Mesh(mergeGeos([left, right]), mat);
  m.receiveShadow = true;
  m.name = 'shoulders';
  world.add(m);
  world.glowMeshes.push(m);
}

// ------------------------------------------------------------------ canyon walls

function canyonWalls(world, P, mat) {
  const T = P.track, L = P.look;
  const cRock = col(L.rock), cCap = col(L.cap), cTalus = col(L.talus), cTop = col(L.top);
  const cLow = new THREE.Color().copy(cRock).multiplyScalar(0.78), cHigh = new THREE.Color().copy(cRock).lerp(cCap, 0.25);
  const boulders = [];
  const rng = makeRng('canyon' + P.def.id);
  const CH = 64; // rows per chunk
  for (const C of P.canyons) {
    const chunks = [];
    for (const side of [1, -1]) {
      const S = C.sides[side];
      const nz = (a, f, s) => C.noise.fbm(s * f + a * 17.3, side * 4.1 + a, 2) * 3.3;
      const rows = [], idxs = [];
      for (let i = C.i0; i <= C.i1; i++) {
        idxs.push(i);
        const k = i - C.i0, s = i * T.step;
        const Lin = S.Lin[k], Lout = S.Lout[k];
        const gy = T.Y[i] - 0.35;
        const top = C.top(s, side);
        const H = top - gy;
        // buttresses + alcoves along the face, bench widths, ragged rim
        const b1 = 1.2 * nz(1, 0.02, s) + 1.3 * Math.abs(Math.sin(s * 0.11 + nz(2, 0.01, s))) + 0.5 * nz(3, 0.09, s);
        const L1 = 3.5 + 2.2 * nz(4, 0.012, s), L2 = 2.2 + 1.4 * nz(5, 0.016, s);
        const j = (a) => 0.7 * nz(a, 0.07, s);
        const rim = 1.6 * nz(9, 0.035, s) - 1.2 * Math.abs(nz(10, 0.08, s));
        const streak = 0.78 + 0.22 * smoothstep(-0.6, 0.6, nz(11, 0.16, s));
        const rimL = Lin + b1 + L1 + L2 + 0.8 + j(19);
        const farL = Math.max(rimL + 9, Lout - 10), edgeL = Math.max(farL + 5, Lout - 3);
        const sec = [
          [Lin - 3.8, gy - 0.8, 0], [Lin - 2.2 + j(12) * 0.4, gy + 1.0, 0], [Lin - 0.6, gy + 2.8 + j(13), 0],
          [Lin + b1, gy + 0.1 * H, 1], [Lin + b1 + 0.4 + j(14), gy + 0.24 * H, 1], [Lin + b1 + 0.2 + j(15), gy + 0.36 * H, 1],
          [Lin + b1 + L1, gy + 0.37 * H + 0.4, 3], [Lin + b1 + L1 + 0.3 + j(16), gy + 0.55 * H, 4], [Lin + b1 + L1 + 0.6 + j(17), gy + 0.7 * H, 4],
          [Lin + b1 + L1 + 0.4 + j(18), gy + 0.79 * H, 4], [Lin + b1 + L1 + L2, gy + 0.8 * H + 0.3, 3], [rimL, top - 0.4 + rim, 2],
          [rimL + 6.2, top + 0.8 * nz(20, 0.02, s), 5], [farL, top + 1.5 * nz(21, 0.008, s), 5], [edgeL, top - 3, 2], [edgeL + 11, gy - 9, 0],
        ];
        rows.push(sec.map(([lat, y, tag], q) => {
          const t = clamp((y - gy) / H, 0, 1);
          let c;
          if (tag === 0) c = cTalus;
          else if (tag === 5) c = new THREE.Color().copy(cTop).multiplyScalar(0.85 + 0.3 * smoothstep(-1, 1, nz(22, 0.01, s + lat * 0.7)));
          else if (tag === 3) c = cTop;
          else if (tag === 2) c = new THREE.Color().copy(cHigh).lerp(cCap, 0.7);
          else c = new THREE.Color().copy(cLow).lerp(cHigh, t).multiplyScalar(streak);
          const px = T.X[i] + T.LX[i] * side * lat, pz = T.Z[i] + T.LZ[i] * side * lat;
          return { x: px, y, z: pz, c, u: s / 20, v: tag === 5 ? TOP_V(px, pz) : y / 16 };
        }));
        if (rng() < 0.2) {
          const bl = side * (Lin - 2.6 + (rng() - 0.5) * 2.4);
          const bx = T.X[i] + T.LX[i] * bl, bz = T.Z[i] + T.LZ[i] * bl, sc = 0.35 + Math.pow(rng(), 2.5) * 1.5;
          boulders.push({ x: bx, y: gy + 0.2 + rng() * 0.6, z: bz, s: sc, ry: rng() * 6, rx: rng() * 2, rz: rng() * 2 });
        }
      }
      // round each mesa end into a sloping nose: extra rows past the ends that shrink and drop
      for (const [end, dir] of [[0, -1], [rows.length - 1, 1]]) {
        const i = idxs[end], base = rows[end];
        const gy = T.Y[i] - 0.35;
        const cl = base.reduce((a, v) => a + ((v.x - T.X[i]) * T.LX[i] + (v.z - T.Z[i]) * T.LZ[i]) * side, 0) / base.length;
        const ext = [];
        for (const d of [7, 14, 21, 28]) {
          const f = d / 32;
          ext.push(base.map((v) => {
            const lat = ((v.x - T.X[i]) * T.LX[i] + (v.z - T.Z[i]) * T.LZ[i]) * side;
            const nl = cl + (lat - cl) * (1 - f * 0.75);
            const y = gy + (v.y - gy) * Math.pow(1 - f, 0.8) * (0.9 + 0.2 * rng());
            return { ...v, x: T.X[i] + T.TX[i] * d * dir + T.LX[i] * side * nl, z: T.Z[i] + T.TZ[i] * d * dir + T.LZ[i] * side * nl, y: Math.min(v.y, Math.max(y, gy - 1)) };
          }));
        }
        if (dir < 0) { rows.unshift(...ext.reverse()); idxs.unshift(...ext.map(() => i)); } else { rows.push(...ext); idxs.push(...ext.map(() => i)); }
      }
      const want = (r, c) => {
        const i = idxs[r];
        const p = rows[r][c], q2 = rows[r][c + 1];
        const dl = (q2.x - p.x) * T.LX[i] * side + (q2.z - p.z) * T.LZ[i] * side, dy = q2.y - p.y;
        return new THREE.Vector3(T.LX[i] * side * -dy, dl, T.LZ[i] * side * -dy);
      };
      for (let r0 = 0, ci = 0; r0 < rows.length - 1; r0 += CH, ci++) {
        const part = rows.slice(r0, Math.min(rows.length, r0 + CH + 1));
        (chunks[ci] = chunks[ci] || []).push(gridGeo(part, (r, c) => want(r0 + r, c)));
      }
      // mesa end caps
      for (const [r, dir, ci] of [[0, -1, 0], [rows.length - 1, 1, chunks.length - 1]]) {
        const ring = rows[r];
        const ctr = new THREE.Vector3();
        for (const v of ring) ctr.add(new THREE.Vector3(v.x, v.y, v.z));
        ctr.divideScalar(ring.length);
        const i = idxs[r];
        const pts = ring.map((v) => Object.assign(new THREE.Vector3(v.x, v.y, v.z), { c: v.c }));
        pts.push(Object.assign(pts[0].clone(), { c: ring[0].c }));
        chunks[ci].push(fanGeo(ctr, pts, new THREE.Vector3(T.TX[i] * dir, 0, T.TZ[i] * dir), cRock));
      }
    }
    for (const list of chunks) {
      const g = mergeGeos(list);
      if (!g) continue;
      const m = new THREE.Mesh(g, mat);
      m.castShadow = true;
      m.receiveShadow = true;
      m.name = 'canyon';
      world.add(m);
    }
  }
  const bg = jitter(new THREE.IcosahedronGeometry(1, 0), 0.5, 9, 0.75);
  scatter(world, bg, new THREE.MeshStandardMaterial({ color: col(L.talus).multiplyScalar(0.8), roughness: 0.95, flatShading: true }), boulders, { cell: 400, shadow: true, name: 'canyon-boulders', maxDist: 700 });
}

// ------------------------------------------------------------------ buttes + mesas

const FORM_LEVELS = {
  butte: [[1.8, -0.06, 0], [1.4, 0.08, 0], [1.12, 0.18, 0], [1.0, 0.22, 1], [0.98, 0.45, 1], [0.9, 0.48, 1], [0.88, 0.75, 1], [0.84, 0.78, 1], [0.82, 0.95, 2], [0.79, 1.0, 2]],
  mesa: [[1.3, -0.06, 0], [1.1, 0.12, 0], [1.0, 0.18, 1], [0.99, 0.5, 1], [0.93, 0.53, 1], [0.92, 0.9, 1], [0.9, 0.96, 2], [0.89, 1.0, 2]],
  spire: [[2.5, -0.05, 0], [1.75, 0.08, 0], [1.3, 0.16, 0], [1.06, 0.22, 1], [0.96, 0.42, 1], [0.88, 0.62, 1], [0.8, 0.8, 1], [0.88, 0.84, 2], [0.84, 0.95, 2], [0.7, 1.0, 2]],
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
      const ex = kind === 'mesa' ? 1.3 + rng() * 1.2 : kind === 'spire' ? 1.5 + rng() * 1.1 : 1 + rng() * 0.6;
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
      // (the nearest-road lookup only sees ~175 m round a point, and a big
      // mesa reaches much further: on a short loop the far side of the road
      // can be inside it, so check its whole footprint against the road)
      if (reach > 150) {
        let dd = Infinity;
        for (let k = 0; k < T.N; k += 3) { const ex = T.X[k] - x, ez = T.Z[k] - z; dd = Math.min(dd, ex * ex + ez * ez); }
        if (Math.sqrt(dd) < reach + fence + 12) continue;
      }
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
  let ox = 0, oz = 0;
  const lean = f.kind === 'spire' ? 0.08 : 0.03;
  for (const [k, yf, tag] of levels) {
    const row = [];
    if (tag > 0) { ox += (rng() - 0.5) * f.r * lean; oz += (rng() - 0.5) * f.r * lean; }
    const wob = [0, 1, 2].map(() => rng() * 6.283);
    for (let j = 0; j <= seg; j++) {
      const a = (j % seg) / seg * Math.PI * 2;
      const jit = j === seg ? row[0].jit : (rng() - 0.5) * (tag === 0 ? 0.14 : 0.09);
      const rr = f.r * (shape(a) + 0.07 * Math.sin(3 * a + wob[0]) + 0.05 * Math.sin(5 * a + wob[1])) * (k + jit);
      const lx = Math.cos(a) * rr * f.ex + ox, lz = Math.sin(a) * rr + oz;
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
  const ctr = new THREE.Vector3(f.x + ox * cr - oz * sr, baseY + f.H + 0.6, f.z + ox * sr + oz * cr);
  return [g, fanGeo(ctr, ring, new THREE.Vector3(0, 1, 0), cTop, true)];
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
  m.name = 'formations';
  world.add(m);
}

// ------------------------------------------------------------------ vegetation + rocks

/** Twiggy shrubs + dry grass as alpha-tested crossed quads (atlas: 4 cells of 256). */
function shrubAtlas() {
  return cachedCanvas('shrubAtlas', () => {
    const c = cvs(768, 512), x = c.getContext('2d');
    const rng = makeRng('shrubAtlas');
    const branch = (px, py, len, ang, w, depth, leaf) => {
      const ex = px + Math.cos(ang) * len, ey = py - Math.sin(ang) * len;
      x.strokeStyle = depth > 2 ? '#5a4a36' : '#6a5a42';
      x.lineWidth = w;
      x.beginPath(); x.moveTo(px, py); x.lineTo(ex, ey); x.stroke();
      if (depth <= 0) { leaf(ex, ey); return; }
      for (let k = 0; k < 2 + (rng() < 0.4 ? 1 : 0); k++) branch(ex, ey, len * (0.6 + rng() * 0.25), ang + (rng() - 0.5) * 1.1, w * 0.7, depth - 1, leaf);
      if (depth < 3) leaf(ex, ey);
    };
    const cell = (k) => [(k % 3) * 256, Math.floor(k / 3) * 256];
    // 0,1 creosote: a vase of thin stems from one crown, sparse small olive leaves
    for (const k of [0, 1]) {
      const [ox, oy] = cell(k);
      x.save(); x.beginPath(); x.rect(ox, oy, 256, 256); x.clip();
      const stems = 12 + k * 4;
      for (let t = 0; t < stems; t++) {
        const a = Math.PI / 2 + (t / (stems - 1) - 0.5) * 1.9 + (rng() - 0.5) * 0.2, len = 120 + rng() * 110;
        const bx = ox + 128 + (rng() - 0.5) * 16, by = oy + 254;
        const bend = (rng() - 0.5) * 0.5;
        const pts = [];
        for (let q = 0; q <= 8; q++) {
          const f = q / 8, aa = a + bend * f;
          pts.push([bx + Math.cos(aa) * len * f, by - Math.sin(aa) * len * f]);
        }
        x.strokeStyle = '#5e4e3c'; x.lineWidth = 2.2;
        x.beginPath(); pts.forEach(([px, py], q) => (q ? x.lineTo(px, py) : x.moveTo(px, py))); x.stroke();
        for (let q = 3; q <= 8; q++) {
          const [px, py] = pts[q];
          if (rng() < 0.5) { x.lineWidth = 1; x.beginPath(); x.moveTo(px, py); x.lineTo(px + (rng() - 0.5) * 30, py - rng() * 22); x.stroke(); }
          for (let m = 0; m < 4; m++) {
            x.fillStyle = rng() < 0.45 ? '#66693f' : rng() < 0.5 ? '#7a7a4e' : '#535a33';
            x.beginPath(); x.ellipse(px + (rng() - 0.5) * 22, py + (rng() - 0.5) * 18, 2.5 + rng() * 2.5, 1.6 + rng() * 1.4, rng() * 3, 0, Math.PI * 2); x.fill();
          }
        }
      }
      x.restore();
    }
    // 2 bursage: low silver-grey dome of twigs
    {
      const [ox, oy] = cell(2);
      x.save(); x.beginPath(); x.rect(ox, oy, 256, 256); x.clip();
      for (let t = 0; t < 12; t++) {
        branch(ox + 128 + (rng() - 0.5) * 40, oy + 252, 26 + rng() * 18, Math.PI / 2 + (rng() - 0.5) * 2.2, 3, 3, (lx, ly) => {
          for (let q = 0; q < 6; q++) {
            x.fillStyle = rng() < 0.5 ? '#9a9a7a' : '#b4b08c';
            x.beginPath(); x.arc(lx + (rng() - 0.5) * 12, ly + (rng() - 0.5) * 10, 2 + rng() * 3, 0, Math.PI * 2); x.fill();
          }
        });
      }
      x.restore();
    }
    // 3 dry bunchgrass
    {
      const [ox, oy] = cell(3);
      for (let t = 0; t < 70; t++) {
        const bx = ox + 128 + (rng() - 0.5) * 60, a = Math.PI / 2 + (rng() - 0.5) * 1.4, len = 60 + rng() * 120;
        x.strokeStyle = rng() < 0.5 ? '#c9b07a' : rng() < 0.5 ? '#a8925e' : '#d8c494';
        x.lineWidth = 1.5 + rng() * 1.5;
        x.beginPath(); x.moveTo(bx, oy + 254);
        x.quadraticCurveTo(bx + Math.cos(a) * len * 0.5, oy + 254 - Math.sin(a) * len * 0.6, bx + Math.cos(a) * len * 0.9 + (rng() - 0.5) * 20, oy + 254 - Math.sin(a) * len);
        x.stroke();
      }
    }
    // 4 juniper: twisted trunk, dense dark irregular crown
    {
      const [ox, oy] = cell(4);
      x.strokeStyle = '#5a4434'; x.lineCap = 'round';
      for (const [w, dx] of [[12, 0], [7, -18], [6, 20]]) {
        x.lineWidth = w;
        x.beginPath(); x.moveTo(ox + 128 + dx * 0.2, oy + 254); x.quadraticCurveTo(ox + 128 + dx, oy + 200, ox + 128 + dx * 1.6, oy + 150); x.stroke();
      }
      for (let t = 0; t < 260; t++) {
        const a = rng() * Math.PI * 2, r = Math.sqrt(rng());
        const px = ox + 128 + Math.cos(a) * r * 100, py = oy + 112 + Math.sin(a) * r * 82 - (1 - r) * 10;
        x.fillStyle = rng() < 0.5 ? '#3b5230' : rng() < 0.5 ? '#4a6238' : '#2e4226';
        x.beginPath(); x.ellipse(px, py, 6 + rng() * 9, 5 + rng() * 6, rng() * 3, 0, Math.PI * 2); x.fill();
      }
      for (let t = 0; t < 40; t++) { x.fillStyle = 'rgba(150,170,120,0.5)'; x.fillRect(ox + 40 + rng() * 176, oy + 40 + rng() * 120, 2, 2); }
    }
    return c;
  });
}

function crossQuads(w, h, cellK, planes = 3) {
  const gb = new GeoBuilder();
  const [u0, v0] = [(cellK % 3) / 3, 0.5 - Math.floor(cellK / 3) * 0.5];
  for (let k = 0; k < planes; k++) {
    const a = k / planes * Math.PI;
    const dx = Math.cos(a) * w / 2, dz = Math.sin(a) * w / 2;
    gb.quad(new THREE.Vector3(-dx, 0, -dz), new THREE.Vector3(dx, 0, dz), new THREE.Vector3(dx, h, dz), new THREE.Vector3(-dx, h, -dz), [u0, v0, u0 + 1 / 3, v0 + 0.5]);
  }
  const g = gb.build();
  // foliage lit like the ground it stands on
  const n = g.attributes.normal;
  for (let i = 0; i < n.count; i++) n.setXYZ(i, 0, 1, 0);
  return g;
}

function vegGeometries() {
  const G = {};
  const green = '#58703a', dark = '#3f5129';
  // saguaros: ribbed trunk + arms (variants by arm count)
  const saguaro = (arms, hs = 1) => {
    const gb = new GeoBuilder();
    const rings = [[0, 0.34], [3.4 * hs, 0.37], [6.8 * hs, 0.34], [7.6 * hs, 0.26], [8.05 * hs, 0.0]];
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
        const D = new THREE.Vector3(Math.cos(a0) * r1 * k0, y1, Math.sin(a0) * r1 * k0);
        gb.quad(B, A, D, C);
      }
    }
    setColor(gb, green, 0.95);
    for (const [ang, h, up] of arms) {
      const dx = Math.cos(ang), dz = Math.sin(ang);
      const V = (o, y) => new THREE.Vector3(dx * o, h + y, dz * o);
      tube(gb, [V(0.1, 0), V(0.75, 0.12), V(1.05, 0.8), V(1.05, up), V(1.05, up + 0.32)], [0.25, 0.25, 0.24, 0.22, 0.05], 5);
    }
    return gb.build(true);
  };
  G.saguaro = [
    saguaro([[0.4, 3.1, 2.3], [Math.PI + 0.3, 3.9, 1.9]]),
    saguaro([[1.2, 2.9, 2.6], [3.6, 3.6, 2.2], [5.4, 4.4, 1.6]]),
    saguaro([[2.2, 3.4, 2.0]]),
    saguaro([], 0.45),
  ];
  // creosote: loose clump of dark olive blobs
  {
    const gb = new GeoBuilder();
    const m = new THREE.Matrix4();
    const parts = [[0, 0.62, 0, 0.5], [0.45, 0.42, 0.18, 0.38], [-0.32, 0.45, 0.3, 0.4]];
    parts.forEach(([x, y, z, r], k) => {
      setColor(gb, k % 2 ? '#707848' : '#5f6a3a');
      const ico = jitter(new THREE.IcosahedronGeometry(r, 0), 0.4, k, 0.9);
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
  G.rock = jitter(new THREE.DodecahedronGeometry(1, 0), 0.45, 2, 0.7);
  G.boulder = jitter(new THREE.DodecahedronGeometry(1, 0), 0.55, 5, 0.7);
  return G;
}

function vegetation(world, P) {
  const T = P.track, L = P.look, terr = world.terrain;
  const counts = L.veg;
  if (!Object.keys(counts).length) return;
  const G = vegGeometries();
  const plantMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92, envMapIntensity: 0.3 });
  const rockMat = new THREE.MeshStandardMaterial({ color: col(L.talus).multiplyScalar(0.85), roughness: 0.95, flatShading: true, envMapIntensity: 0.3 });
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
      let x, z;
      if (P.washes.length && opts.banks && rng() < opts.banks) {
        const W = P.washes[Math.floor(rng() * P.washes.length)];
        const u = (rng() - 0.5) * 1000, v = W.mid(u) + (rng() < 0.5 ? -1 : 1) * (W.half(u) + 2 + rng() * 14);
        x = W.cx + W.ux * u + W.vx * v; z = W.cz + W.uz * u + W.vz * v;
      } else if (opts.cluster && list.length > 4 && rng() < opts.cluster) {
        // grow a stand around an existing plant
        const o = list[Math.floor(rng() * list.length)];
        const a = rng() * Math.PI * 2, r = 4 + rng() * opts.spread;
        x = o.x + Math.cos(a) * r; z = o.z + Math.sin(a) * r;
      } else {
        const s = rng() * T.length, side = rng() < 0.5 ? 1 : -1;
        const i = clamp(Math.round(s / T.step), 0, T.N - 1);
        const d = T.W[i] + opts.dMin + (opts.dMax - opts.dMin) * Math.pow(rng(), opts.pow ?? 1.6);
        x = T.X[i] + T.LX[i] * side * d + (rng() - 0.5) * 6; z = T.Z[i] + T.LZ[i] * side * d + (rng() - 0.5) * 6;
      }
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
    const all = place(counts.saguaro, { ...near, dMin: 7, s: [0.55, 1.25], minUp: 0.9, clear: 5, cluster: 0.55, spread: 40 });
    G.saguaro.forEach((g, k) => scatter(world, g, plantMat, all.filter((_, j) => j % 4 === k), { shadow: true, name: 'saguaro', maxDist: 1100, cell: 900 }));
  }
  const foliage = new THREE.MeshStandardMaterial({ map: canvasTex(shrubAtlas(), { repeat: false }), alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.95 });
  if (counts.creosote) {
    const all = place(counts.creosote, { ...near, s: [0.7, 1.5], pow: 1.9, banks: 0.18 });
    scatter(world, crossQuads(2.2, 1.9, 0), foliage, all.filter((_, j) => j % 2), { name: 'creosote', maxDist: 480, cell: 600 });
    scatter(world, crossQuads(2.0, 1.6, 1), foliage, all.filter((_, j) => !(j % 2)), { name: 'creosote', maxDist: 480, cell: 600 });
  }
  if (counts.bursage) scatter(world, crossQuads(1.3, 0.8, 2), foliage, place(counts.bursage, { ...near, dMin: 3, s: [0.7, 1.4] }), { name: 'bursage', maxDist: 380, cell: 600 });
  if (counts.grass) scatter(world, crossQuads(1.0, 0.75, 3, 2), foliage, place(counts.grass, { ...near, dMin: 1.5, dMax: 140, s: [0.6, 1.3], pow: 2.2 }), { name: 'grass', maxDist: 260, cell: 500 });
  if (counts.ocotillo) scatter(world, G.ocotillo, plantMat, place(counts.ocotillo, { ...near, dMin: 6, s: [0.8, 1.3] }), { name: 'ocotillo', maxDist: 750, cell: 900 });
  if (counts.barrel) scatter(world, G.barrel, plantMat, place(counts.barrel, { ...near, dMax: 120, s: [0.7, 1.4] }), { name: 'barrel', maxDist: 300, cell: 600 });
  if (counts.yucca) scatter(world, G.yucca, plantMat, place(counts.yucca, { ...near, s: [0.8, 1.5] }), { name: 'yucca', maxDist: 450, cell: 600 });
  if (counts.juniper) scatter(world, crossQuads(4.2, 4.4, 4), foliage, place(counts.juniper, { ...near, dMin: 8, s: [0.7, 1.5], minUp: 0.8, banks: 0.3 }), { name: 'juniper', maxDist: 1000, cell: 700 });
  if (counts.rock) scatter(world, G.rock, rockMat, place(counts.rock, { ...near, dMin: 2, s: [0.25, 0.8], sink: 0.35, minUp: 0.6, tilt: 0.8, wash: true }), { name: 'rocks', maxDist: 380, cell: 600 });
  if (counts.boulder) scatter(world, G.boulder, rockMat, place(counts.boulder, { ...near, dMin: 10, dMax: 420, s: [1.0, 2.6], sink: 0.45, minUp: 0.55, tilt: 0.6, clear: 6 }), { shadow: true, name: 'boulders', maxDist: 900, cell: 900 });
  void fence;
}

// ------------------------------------------------------------------ canvas helpers

function text(x, str, px, py, size, color, opts = {}) {
  x.font = `${opts.style || ''} ${opts.weight || 'bold'} ${size}px ${opts.font || 'Arial, Helvetica, sans-serif'}`;
  x.textAlign = opts.align || 'center';
  x.textBaseline = 'middle';
  x.fillStyle = color;
  const w = x.measureText(str).width;
  if (opts.maxW && w > opts.maxW) {
    x.save();
    x.translate(px, py);
    x.scale(opts.maxW / w, 1);
    if (opts.stroke) { x.lineWidth = opts.stroke[1]; x.strokeStyle = opts.stroke[0]; x.strokeText(str, 0, 0); }
    x.fillText(str, 0, 0);
    x.restore();
    return;
  }
  if (opts.stroke) { x.lineWidth = opts.stroke[1]; x.strokeStyle = opts.stroke[0]; x.strokeText(str, px, py); }
  x.fillText(str, px, py);
}

/** Sun, grit and the odd bullet hole. */
function weather(x, x0, y0, w, h, rng, amt = 1) {
  x.fillStyle = `rgba(255,245,225,${0.08 * amt})`;
  x.fillRect(x0, y0, w, h);
  for (let i = 0; i < w * h * 0.004 * amt; i++) {
    x.fillStyle = rng() < 0.5 ? `rgba(255,250,240,${rng() * 0.25})` : `rgba(40,30,20,${rng() * 0.25})`;
    x.fillRect(x0 + rng() * w, y0 + rng() * h, 1 + rng() * 2, 1 + rng() * 2);
  }
  for (let i = 0; i < 4 * amt; i++) {
    const px = x0 + rng() * w, len = h * (0.1 + rng() * 0.4);
    const g = x.createLinearGradient(0, y0, 0, y0 + len);
    g.addColorStop(0, 'rgba(110,60,30,0.3)');
    g.addColorStop(1, 'rgba(110,60,30,0)');
    x.fillStyle = g;
    x.fillRect(px, y0, 2 + rng() * 4, len);
  }
  if (rng() < 0.5 * amt) {
    const cx = x0 + w * (0.2 + rng() * 0.6), cy = y0 + h * (0.2 + rng() * 0.6);
    for (let i = 0; i < 3 + rng() * 5; i++) {
      const hx = cx + (rng() - 0.5) * w * 0.2, hy = cy + (rng() - 0.5) * h * 0.25;
      x.fillStyle = 'rgba(230,225,215,0.8)';
      x.beginPath(); x.arc(hx, hy, 3.2, 0, Math.PI * 2); x.fill();
      x.fillStyle = 'rgba(20,18,16,0.95)';
      x.beginPath(); x.arc(hx, hy, 1.8, 0, Math.PI * 2); x.fill();
    }
  }
}

// ------------------------------------------------------------------ roadside

const SIGN_CELLS = ['dip', 'dips', 'shield', 'limit65', 'services', 'winding', 'rocks', 'chevR', 'chevL', 'flood', 'park', 'mile0', 'mile1', 'mile2', 'mile3', 'mile4'];

/** 4×4 atlas of road signs. Returns the texture + pixel rects per kind. */
function signAtlas(milesFrom) {
  const S = 1024, c = cvs(S, S), x = c.getContext('2d');
  const rng = makeRng('signs');
  const cells = {};
  const at = (name) => { const k = SIGN_CELLS.indexOf(name); return [(k % 4) * 256, Math.floor(k / 4) * 256]; };
  const YEL = '#e9b52a', BLK = '#161514';
  const diamond = (name, draw) => {
    const [ox, oy] = at(name);
    x.save();
    x.translate(ox + 128, oy + 128);
    x.rotate(Math.PI / 4);
    x.fillStyle = BLK; x.fillRect(-89, -89, 178, 178);
    x.fillStyle = YEL; x.fillRect(-84, -84, 168, 168);
    x.strokeStyle = BLK; x.lineWidth = 5; x.strokeRect(-77, -77, 154, 154);
    x.restore();
    draw(ox + 128, oy + 128);
    weather(x, ox + 40, oy + 40, 176, 176, rng, 0.7);
    cells[name] = [ox + 2, oy + 2, 252, 252];
  };
  const rect = (name, w, h, bg, fg, draw, border = true) => {
    const [ox, oy] = at(name);
    const x0 = ox + (256 - w) / 2, y0 = oy + (256 - h) / 2;
    x.fillStyle = bg;
    x.beginPath(); x.roundRect(x0, y0, w, h, 10); x.fill();
    if (border) { x.strokeStyle = fg; x.lineWidth = 5; x.beginPath(); x.roundRect(x0 + 7, y0 + 7, w - 14, h - 14, 7); x.stroke(); }
    draw(x0, y0, w, h);
    weather(x, x0, y0, w, h, rng, 0.8);
    cells[name] = [x0, y0, w, h];
  };
  diamond('dip', (cx, cy) => text(x, 'DIP', cx, cy + 4, 62, BLK, { font: 'Arial Narrow, Arial, sans-serif' }));
  rect('dips', 236, 150, YEL, BLK, (x0, y0, w) => {
    text(x, 'DIPS', x0 + w / 2, y0 + 50, 52, BLK);
    text(x, 'NEXT 2 MILES', x0 + w / 2, y0 + 106, 30, BLK, { maxW: 200 });
  });
  {
    const [ox, oy] = at('shield');
    x.fillStyle = BLK; x.fillRect(ox + 28, oy + 28, 200, 200);
    x.fillStyle = '#f2f0ea';
    x.beginPath();
    x.moveTo(ox + 52, oy + 52); x.quadraticCurveTo(ox + 90, oy + 66, ox + 128, oy + 46); x.quadraticCurveTo(ox + 166, oy + 66, ox + 204, oy + 52);
    x.quadraticCurveTo(ox + 214, oy + 150, ox + 128, oy + 212); x.quadraticCurveTo(ox + 42, oy + 150, ox + 52, oy + 52);
    x.fill();
    text(x, '99', ox + 128, oy + 128, 96, BLK, { font: 'Arial Narrow, Arial, sans-serif' });
    weather(x, ox + 28, oy + 28, 200, 200, rng, 0.6);
    cells.shield = [ox + 28, oy + 28, 200, 200];
  }
  rect('limit65', 170, 222, '#f2f0ea', BLK, (x0, y0, w) => {
    text(x, 'SPEED', x0 + w / 2, y0 + 42, 34, BLK);
    text(x, 'LIMIT', x0 + w / 2, y0 + 78, 34, BLK);
    text(x, '65', x0 + w / 2, y0 + 150, 96, BLK, { font: 'Arial Narrow, Arial, sans-serif' });
  });
  rect('services', 250, 124, '#0f6a3c', '#e9efe9', (x0, y0, w) => {
    text(x, 'NEXT SERVICES', x0 + w / 2, y0 + 42, 30, '#eef3ee', { maxW: 220 });
    text(x, '82 MILES', x0 + w / 2, y0 + 88, 38, '#eef3ee');
  });
  diamond('winding', (cx, cy) => {
    x.strokeStyle = BLK; x.lineWidth = 14; x.lineCap = 'round';
    x.beginPath(); x.moveTo(cx - 10, cy + 62);
    x.bezierCurveTo(cx - 50, cy + 20, cx + 40, cy + 10, cx, cy - 20);
    x.bezierCurveTo(cx - 30, cy - 40, cx + 10, cy - 50, cx + 6, cy - 52);
    x.stroke();
    x.fillStyle = BLK; x.beginPath(); x.moveTo(cx - 10, cy - 78); x.lineTo(cx + 26, cy - 50); x.lineTo(cx - 14, cy - 40); x.fill();
  });
  diamond('rocks', (cx, cy) => {
    text(x, 'FALLING', cx, cy - 18, 30, BLK);
    text(x, 'ROCKS', cx, cy + 20, 34, BLK);
  });
  for (const [name, dir] of [['chevR', 1], ['chevL', -1]]) {
    rect(name, 150, 190, YEL, BLK, (x0, y0, w, h) => {
      x.fillStyle = BLK;
      x.beginPath();
      const cx = x0 + w / 2, cy = y0 + h / 2;
      x.moveTo(cx - 40 * dir, cy - 70); x.lineTo(cx + 34 * dir, cy); x.lineTo(cx - 40 * dir, cy + 70);
      x.lineTo(cx - 12 * dir, cy + 70); x.lineTo(cx + 62 * dir, cy); x.lineTo(cx - 12 * dir, cy - 70);
      x.fill();
    }, false);
  }
  diamond('flood', (cx, cy) => {
    text(x, 'FLOOD', cx, cy - 18, 38, BLK);
    text(x, 'AREA', cx, cy + 22, 38, BLK);
  });
  rect('park', 250, 140, '#5a3a24', '#e9dcc4', (x0, y0, w) => {
    text(x, 'RED ROCK', x0 + w / 2, y0 + 44, 40, '#efe4cc', { font: 'Georgia, serif', maxW: 220 });
    text(x, 'CANYON', x0 + w / 2, y0 + 86, 34, '#efe4cc', { font: 'Georgia, serif' });
    text(x, 'STATE PARK', x0 + w / 2, y0 + 118, 18, '#efe4cc', { maxW: 200 });
  });
  for (let k = 0; k < 5; k++) {
    rect('mile' + k, 110, 190, '#0f6a3c', '#e9efe9', (x0, y0, w) => {
      text(x, 'MILE', x0 + w / 2, y0 + 50, 30, '#eef3ee');
      text(x, String(milesFrom + k), x0 + w / 2, y0 + 120, 62, '#eef3ee', { font: 'Arial Narrow, Arial, sans-serif', maxW: 90 });
    });
  }
  const tex = canvasTex(c, { repeat: false });
  return { tex, cells };
}

const SIGN_SIZE = { dip: [1.3, 1.3], dips: [1.6, 1.0], shield: [0.8, 0.8], limit65: [0.85, 1.1], services: [2.6, 1.3], winding: [1.3, 1.3], rocks: [1.3, 1.3], chevR: [0.6, 0.76], chevL: [0.6, 0.76], flood: [1.3, 1.3], park: [3.6, 2.0], mile0: [0.5, 0.86] };

function roadside(world, P) {
  const T = P.track, def = P.def, terr = world.terrain;
  const rng = makeRng('roadside' + def.id);
  const face = new GeoBuilder(), post = new GeoBuilder();
  const miles = def.miles || [0, 1];
  const { tex, cells } = signAtlas(miles[1]);
  const list = (def.signs || []).map(([s, side, kind]) => ({ s, side, kind }));
  if (def.miles) for (let k = 0, s = miles[0]; s < T.length - 20 && k < 5; k++, s += 1609.34) list.push({ s, side: -1, kind: 'mile' + k });
  // chevrons on the outside of sharp corners
  for (let i = 0; i < T.N; i++) {
    const k = T.Ks[i];
    if (Math.abs(k) < 1 / 230) continue;
    const s = i * T.step;
    if (list.some((o) => o.chev && Math.abs(o.s - s) < 26)) continue;
    const side = k > 0 ? -1 : 1;
    list.push({ s, side, kind: side < 0 ? 'chevL' : 'chevR', chev: true, toe: 0.5 });
  }
  for (const o of list) {
    const i = clamp(Math.round(o.s / T.step), 0, T.N - 1);
    const size = SIGN_SIZE[o.kind] || SIGN_SIZE.mile0;
    let lat = o.side * (T.W[i] + T.shoulder + (o.chev ? 1.2 : 1.8) + (o.kind === 'park' ? 4 : 0));
    // keep signs in the open: pull them toward the road if a canyon wall is close
    for (const C of P.canyons) if (i >= C.i0 && i <= C.i1) lat = o.side * Math.min(Math.abs(lat), C.sides[o.side].Lin[i - C.i0] - 4.2);
    const x = T.X[i] + T.LX[i] * lat, z = T.Z[i] + T.LZ[i] * lat;
    const gy = Math.max(terr.heightAt(x, z), T.Y[i] - 0.4);
    // face oncoming traffic, toed in toward the road
    const toe = o.toe ?? 0.12;
    const nx = -T.TX[i] * Math.cos(toe) - T.LX[i] * o.side * Math.sin(toe), nz = -T.TZ[i] * Math.cos(toe) - T.LZ[i] * o.side * Math.sin(toe);
    const nl = Math.hypot(nx, nz);
    const [w, h] = size;
    const bottom = o.chev ? 1.0 : o.kind.startsWith('mile') ? 0.9 : o.kind === 'park' ? 0.6 : 1.7;
    const r = cells[o.kind];
    const uv = cellUV(r[0], r[1], r[2], r[3]);
    panel(face, x, gy + bottom, z, nx / nl, nz / nl, w, h, uv);
    setColor(post, '#77797c');
    panel(post, x - nx / nl * 0.03, gy + bottom, z - nz / nl * 0.03, -nx / nl, -nz / nl, w, h);
    const twin = w > 1.5;
    const rx = nz / nl, rz = -nx / nl;
    for (const k of twin ? [-0.35, 0.35] : [0]) {
      setColor(post, o.kind === 'park' ? '#5a4030' : '#8a8c8e');
      post.box(x + rx * w * k - nx / nl * 0.07, gy - 0.4, z + rz * w * k - nz / nl * 0.07, 0.08, bottom + h * 0.9 + 0.4, 0.08, Math.atan2(rx, rz));
    }
  }
  const faceMat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.55, metalness: 0.1, alphaTest: 0.5, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: world.at.lamps ? 0.12 : 0.0 });
  world.add(new THREE.Mesh(face.build(), faceMat));
  world.add(new THREE.Mesh(post.build(true), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, metalness: 0.4 })));

  // delineator posts: white, amber reflector on the right, white on the left
  const dl = [];
  for (let s = 8; s < T.length - 4; s += 0) {
    const i = clamp(Math.round(s / T.step), 0, T.N - 1);
    for (const side of [1, -1]) {
      if (P.stop && side === P.stop.side && Math.abs(s - P.stop.s) < 70) continue;
      const lat = side * (T.W[i] + T.shoulder + 0.4);
      const x = T.X[i] + T.LX[i] * lat, z = T.Z[i] + T.LZ[i] * lat;
      dl.push({ x, y: T.Y[i] - 0.25, z, ry: Math.atan2(T.TX[i], T.TZ[i]), rz: (rng() - 0.5) * 0.08, color: side > 0 ? '#ffffff' : '#ffd9a0' });
    }
    s += Math.abs(T.Ks[i]) > 1 / 500 ? 24 : 48;
  }
  const dg = new GeoBuilder();
  setColor(dg, '#e8e6e0'); dg.box(0, 0, 0, 0.09, 1.25, 0.05, 0);
  setColor(dg, '#ff9a1a', 1.4); dg.box(0, 1.0, -0.03, 0.07, 0.16, 0.012, 0);
  scatter(world, dg.build(true), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.4, emissive: 0x332200, emissiveIntensity: world.at.lamps ? 1 : 0 }), dl, { cell: 1600, name: 'delineators', maxDist: 700 });

  if (def.ads) billboards(world, P);
}

// ------------------------------------------------------------------ billboards

const ADS = ['RAZOR FUEL', 'BURGER BARN', 'KUROSHIO', 'LAST CHANCE MOTEL'];

function adAtlas() {
  return cachedCanvas('ads', () => {
    const S = 1024, c = cvs(S, S), x = c.getContext('2d');
    const rng = makeRng('ads');
    const H = 256;
    // 0 RAZOR FUEL
    {
      const y0 = 0;
      const g = x.createLinearGradient(0, y0, 0, y0 + H);
      g.addColorStop(0, '#1d0a0a'); g.addColorStop(1, '#4a0c0c');
      x.fillStyle = g; x.fillRect(0, y0, S, H);
      x.fillStyle = '#d4231c';
      x.beginPath(); x.moveTo(560, y0); x.lineTo(1024, y0); x.lineTo(1024, y0 + H); x.lineTo(420, y0 + H); x.fill();
      x.fillStyle = '#f2a01e';
      x.beginPath(); x.moveTo(520, y0); x.lineTo(560, y0); x.lineTo(420, y0 + H); x.lineTo(380, y0 + H); x.fill();
      text(x, 'RAZOR', 60, y0 + 92, 120, '#f4f1ea', { align: 'left', style: 'italic', weight: '900', stroke: ['#000', 6] });
      text(x, 'FUEL', 470, y0 + 92, 120, '#f2a01e', { align: 'left', style: 'italic', weight: '900', stroke: ['#000', 6] });
      text(x, 'RACE GAS · 104 OCTANE', 66, y0 + 178, 40, '#f4f1ea', { align: 'left', maxW: 560 });
      x.fillStyle = '#f2d21e'; x.fillRect(700, y0 + 196, 300, 48);
      text(x, 'NEXT EXIT  ►', 850, y0 + 221, 32, '#111', { maxW: 280 });
      // blade
      x.fillStyle = '#c9ced4'; x.fillRect(820, y0 + 40, 150, 70);
      x.fillStyle = '#333'; x.fillRect(850, y0 + 66, 90, 16);
      weather(x, 0, y0, S, H, rng, 2.2);
    }
    // 1 BURGER BARN
    {
      const y0 = 256;
      x.fillStyle = '#f3c531'; x.fillRect(0, y0, S, H);
      x.fillStyle = '#c12a1d'; x.fillRect(0, y0 + 200, S, 56);
      // barn
      x.fillStyle = '#b3261b';
      x.beginPath(); x.moveTo(40, y0 + 200); x.lineTo(40, y0 + 100); x.lineTo(120, y0 + 40); x.lineTo(200, y0 + 100); x.lineTo(200, y0 + 200); x.fill();
      x.strokeStyle = '#fff'; x.lineWidth = 6;
      x.strokeRect(85, y0 + 120, 70, 78);
      x.beginPath(); x.moveTo(85, y0 + 120); x.lineTo(155, y0 + 198); x.moveTo(155, y0 + 120); x.lineTo(85, y0 + 198); x.stroke();
      text(x, 'BURGER BARN', 610, y0 + 92, 112, '#b3261b', { weight: '900', stroke: ['#fff', 8], maxW: 760 });
      text(x, 'DOUBLE STACK  $2.99', 610, y0 + 162, 44, '#3a1a0a', { maxW: 700 });
      text(x, '14 MILES · EXIT 52 · OPEN LATE', 512, y0 + 228, 36, '#fff4d0', { maxW: 900 });
      weather(x, 0, y0, S, H, rng, 2.6);
      // peeling strips
      for (let i = 0; i < 6; i++) { x.fillStyle = 'rgba(230,222,205,0.9)'; x.fillRect(300 + rng() * 680, y0 + rng() * 200, 20 + rng() * 60, 8 + rng() * 26); }
    }
    // 2 KUROSHIO
    {
      const y0 = 512;
      x.fillStyle = '#101112'; x.fillRect(0, y0, S, H);
      x.strokeStyle = '#d61f2c'; x.lineWidth = 16;
      x.beginPath();
      for (let px = 0; px <= S; px += 8) x.lineTo(px, y0 + 196 + Math.sin(px / 60) * 14);
      x.stroke();
      // tire
      x.fillStyle = '#222'; x.beginPath(); x.arc(880, y0 + 110, 92, 0, Math.PI * 2); x.fill();
      x.fillStyle = '#555'; x.beginPath(); x.arc(880, y0 + 110, 50, 0, Math.PI * 2); x.fill();
      x.strokeStyle = '#000'; x.lineWidth = 8;
      for (let k = 0; k < 16; k++) { const a = k / 16 * Math.PI * 2; x.beginPath(); x.moveTo(880 + Math.cos(a) * 70, y0 + 110 + Math.sin(a) * 70); x.lineTo(880 + Math.cos(a) * 92, y0 + 110 + Math.sin(a) * 92); x.stroke(); }
      text(x, 'KUROSHIO', 400, y0 + 92, 118, '#f4f4f4', { weight: '900', maxW: 700 });
      text(x, 'PERFORMANCE TIRES', 400, y0 + 158, 40, '#d61f2c', { maxW: 640 });
      text(x, 'GRIP IS EVERYTHING', 400, y0 + 236, 30, '#f4f4f4', { maxW: 640 });
      weather(x, 0, y0, S, H, rng, 1.6);
    }
    // 3 LAST CHANCE MOTEL
    {
      const y0 = 768;
      x.fillStyle = '#2a9a98'; x.fillRect(0, y0, S, H);
      x.fillStyle = '#f15e8a';
      x.beginPath();
      for (let k = 0; k < 16; k++) { const a = k / 16 * Math.PI * 2, r = k % 2 ? 40 : 96; x.lineTo(150 + Math.cos(a) * r, y0 + 128 + Math.sin(a) * r); }
      x.fill();
      text(x, 'LAST CHANCE', 600, y0 + 76, 92, '#fff6d8', { style: 'italic', weight: '900', stroke: ['#13403f', 6], maxW: 700 });
      text(x, 'MOTEL', 600, y0 + 160, 76, '#f15e8a', { weight: '900', stroke: ['#fff', 5] });
      text(x, 'VACANCY · COLOR TV · POOL · EXIT NOW', 600, y0 + 226, 30, '#fff6d8', { maxW: 760 });
      weather(x, 0, y0, S, H, rng, 2.4);
    }
    return c;
  });
}

function billboards(world, P) {
  const T = P.track, terr = world.terrain;
  const tex = canvasTex(adAtlas(), { repeat: false });
  const face = new GeoBuilder(), frame = new GeoBuilder();
  const fence = P.def.fence ?? 32;
  for (const [s, side, ad] of P.def.ads) {
    const i = clamp(Math.round(s / T.step), 0, T.N - 1);
    const lat = side * (fence + 7);
    const x = T.X[i] + T.LX[i] * lat, z = T.Z[i] + T.LZ[i] * lat;
    const gy = terr.heightAt(x, z);
    const ang = 0.42;
    let nx = -T.TX[i] * Math.cos(ang) - T.LX[i] * side * Math.sin(ang), nz = -T.TZ[i] * Math.cos(ang) - T.LZ[i] * side * Math.sin(ang);
    const nl = Math.hypot(nx, nz); nx /= nl; nz /= nl;
    const w = 14, h = 3.5, legH = 5.2;
    const rx = nz, rz = -nx;
    panel(face, x, gy + legH, z, nx, nz, w, h, cellUV(0, ad * 256, 1024, 256));
    // back, frame, catwalk, legs, lamp arms
    setColor(frame, '#5b4a3a');
    panel(frame, x - nx * 0.25, gy + legH, z - nz * 0.25, -nx, -nz, w, h);
    const ry = Math.atan2(rx, rz);
    for (const k of [-0.36, 0, 0.36]) {
      setColor(frame, '#4d3d2e');
      frame.box(x + rx * w * k - nx * 0.4, gy - 0.6, z + rz * w * k - nz * 0.4, 0.34, legH + h + 0.4, 0.34, ry);
      setColor(frame, '#3c3c3e');
      frame.box(x + rx * w * k + nx * 0.6, gy + legH + h + 0.05, z + rz * w * k + nz * 0.6, 0.08, 0.08, 1.4, ry);
      frame.box(x + rx * w * k + nx * 1.25, gy + legH + h - 0.1, z + rz * w * k + nz * 1.25, 0.4, 0.18, 0.3, ry);
    }
    setColor(frame, '#55504a');
    frame.box(x + nx * 0.45, gy + legH - 0.18, z + nz * 0.45, 0.9, 0.12, w + 0.4, ry + Math.PI / 2);
    frame.box(x - nx * 0.3, gy + legH + h * 0.5, z - nz * 0.3, 0.12, 0.2, w + 0.3, ry + Math.PI / 2);
  }
  const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.75, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: world.at.lamps ? 0.5 : 0 });
  world.add(new THREE.Mesh(face.build(), mat));
  const fm = new THREE.Mesh(frame.build(true), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85 }));
  fm.castShadow = true;
  world.add(fm);
}

// ------------------------------------------------------------------ poles, wires, fences

function telephone(world, P) {
  const T = P.track, cfg = P.def.poles, terr = world.terrain;
  const rng = makeRng('poles' + P.def.id);
  const off = cfg.offset ?? 9.5;
  const runs = [[]];
  for (let s = cfg.from; s < cfg.to; s += 50 + rng() * 8) {
    const skip = (cfg.skip || []).some(([a, b]) => s > a && s < b) || (P.stop && P.stop.side === cfg.side && Math.abs(s - P.stop.s) < 110);
    if (skip) { if (runs[runs.length - 1].length) runs.push([]); continue; }
    const i = clamp(Math.round(s / T.step), 0, T.N - 1);
    const lat = cfg.side * (T.W[i] + T.shoulder + off);
    const x = T.X[i] + T.LX[i] * lat, z = T.Z[i] + T.LZ[i] * lat;
    runs[runs.length - 1].push({ x, y: terr.heightAt(x, z) - 0.4, z, ry: Math.atan2(-T.LZ[i], T.LX[i]), rx: (rng() - 0.5) * 0.07, rz: (rng() - 0.5) * 0.07, s: 0.95 + rng() * 0.1 });
  }
  // pole: wooden post, two crossarms with insulators
  const gb = new GeoBuilder();
  setColor(gb, '#5e4c3c'); gb.cylinder(0, 0, 0, 0.15, 10, 6, 0.11);
  setColor(gb, '#4f4034');
  gb.box(0, 8.9, 0, 2.7, 0.14, 0.14, 0);
  gb.box(0, 7.75, 0, 1.6, 0.12, 0.12, 0);
  setColor(gb, '#4a3c30');
  for (const sx of [-1, 1]) {
    const brace = new THREE.BoxGeometry(0.06, 1.0, 0.06);
    brace.rotateZ(sx * 0.75);
    brace.translate(sx * 0.35, 8.55, 0.0);
    gb.geometry(brace, new THREE.Matrix4());
  }
  setColor(gb, '#6f8f86');
  const ins = [[-1.2, 9.0], [-0.45, 9.0], [1.2, 9.0], [-0.65, 7.84], [0.65, 7.84]];
  for (const [ix, iy] of ins) gb.cylinder(ix, iy, 0, 0.055, 0.2, 5, 0.04);
  const poleGeo = gb.build(true);
  const all = runs.flat();
  scatter(world, poleGeo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9 }), all, { cell: 1800, shadow: true, name: 'poles' });
  // sagging wires between consecutive poles
  const wp = [];
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), sc = new THREE.Vector3(), v = new THREE.Vector3();
  const tops = (o) => {
    e.set(o.rx, o.ry, o.rz); q.setFromEuler(e); sc.setScalar(o.s);
    m.compose(v.set(o.x, o.y, o.z), q, sc);
    return ins.map(([ix, iy]) => new THREE.Vector3(ix, iy + 0.2, 0).applyMatrix4(m));
  };
  for (const run of runs) {
    for (let k = 0; k < run.length - 1; k++) {
      const A = tops(run[k]), B = tops(run[k + 1]);
      const span = Math.hypot(run[k + 1].x - run[k].x, run[k + 1].z - run[k].z);
      for (let w = 0; w < A.length; w++) {
        const sag = span * (0.018 + rng() * 0.01) * (w > 2 ? 1.3 : 1);
        const n = 8;
        for (let j = 0; j < n; j++) {
          for (const t of [j / n, (j + 1) / n]) {
            wp.push(A[w].x + (B[w].x - A[w].x) * t, A[w].y + (B[w].y - A[w].y) * t - sag * 4 * t * (1 - t), A[w].z + (B[w].z - A[w].z) * t);
          }
        }
      }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(wp, 3));
  world.add(new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: 0x24211e })));
}

function fence(world, P) {
  const T = P.track, F = P.def.fence, terr = world.terrain;
  const rng = makeRng('fence' + P.def.id);
  const tposts = [], wposts = [], wires = [];
  const q = {};
  for (const side of [1, -1]) {
    let prev = null, k = 0;
    for (let s = 0; s < T.length; s += 6) {
      const i = clamp(Math.round(s / T.step), 0, T.N - 1);
      let ok = true;
      for (const C of P.canyons) if (i >= C.i0 - 3 && i <= C.i1 + 3 && C.sides[side].Lin[clamp(i - C.i0, 0, C.i1 - C.i0)] - 5 < F) ok = false;
      if (P.stop && P.stop.side === side && Math.abs(s - P.stop.s) < 92) ok = false;
      const x = T.X[i] + T.LX[i] * side * F, z = T.Z[i] + T.LZ[i] * side * F;
      if (ok) { P.near(x, z, q); if (q.d < F - 3) ok = false; }
      if (!ok) { prev = null; continue; }
      const y = terr.heightAt(x, z);
      const o = { x, y: y - 0.15, z, ry: rng() * 3, rx: (rng() - 0.5) * 0.1, rz: (rng() - 0.5) * 0.1 };
      (k++ % 5 === 0 ? wposts : tposts).push(o);
      if (prev) for (const h of [0.42, 0.78, 1.1]) wires.push(prev.x, prev.y + h, prev.z, x, y + h - 0.15, z);
      prev = { x, y: y - 0.15, z };
    }
  }
  const tg = new GeoBuilder();
  setColor(tg, '#4c5148'); tg.box(0, 0, 0, 0.05, 1.25, 0.05, 0, { top: false });
  const wg = new GeoBuilder();
  setColor(wg, '#6b5a48'); wg.cylinder(0, 0, 0, 0.07, 1.4, 5, 0.06);
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85 });
  scatter(world, tg.build(true), mat, tposts, { cell: 1200, name: 'fence-t', maxDist: 600 });
  scatter(world, wg.build(true), mat, wposts, { cell: 1200, name: 'fence-w', maxDist: 900 });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(wires, 3));
  world.add(new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: 0x5a5650, transparent: true, opacity: 0.7 })));
}

// ------------------------------------------------------------------ truck stop

/** Atlas for the diner + gas station (color + matching emissive layer for neon/lit glass). */
function stopAtlas() {
  return cachedCanvas('stop', () => {
    const S = 1024;
    const c = cvs(S, S), x = c.getContext('2d');
    const e = cvs(S, S), ex = e.getContext('2d');
    const rng = makeRng('stop');
    ex.fillStyle = '#000'; ex.fillRect(0, 0, S, S);
    // diner front (0,0,1024,224): stucco, chrome band, big windows, door
    x.fillStyle = '#e9dcc2'; x.fillRect(0, 0, S, 224);
    x.fillStyle = '#b8352a'; x.fillRect(0, 178, S, 46);
    x.fillStyle = '#d8d8d4'; x.fillRect(0, 172, S, 8);
    x.fillStyle = '#2aa3a0'; x.fillRect(0, 0, S, 26);
    text(x, 'BREAKFAST · LUNCH · DINNER · PIE', 512, 13, 18, '#fff6e0', { maxW: 900 });
    for (let k = 0; k < 9; k++) {
      const wx = 22 + k * 112, door = k === 4;
      x.fillStyle = '#c9c9c4'; x.fillRect(wx - 4, 44, 100, door ? 136 : 118);
      const g = x.createLinearGradient(0, 48, 0, 160);
      g.addColorStop(0, '#5a6a78'); g.addColorStop(1, '#2a3038');
      x.fillStyle = g; x.fillRect(wx, 48, 92, door ? 130 : 110);
      ex.fillStyle = '#5a4020'; ex.fillRect(wx, 48, 92, door ? 130 : 110);
      x.fillStyle = 'rgba(255,230,180,0.25)'; x.fillRect(wx, 110, 92, 48);
      x.strokeStyle = 'rgba(255,255,255,0.35)'; x.lineWidth = 3;
      x.beginPath(); x.moveTo(wx + 10, 150); x.lineTo(wx + 50, 56); x.stroke();
      if (door) { text(x, 'OPEN', wx + 46, 90, 22, '#ff4060'); ex.fillStyle = '#ff2a50'; ex.font = 'bold 22px Arial'; ex.textAlign = 'center'; ex.textBaseline = 'middle'; ex.fillText('OPEN', wx + 46, 90); }
    }
    weather(x, 0, 0, S, 224, rng, 1.5);
    // canopy fascia (0,224,1024,96): RAZOR FUEL stripes
    x.fillStyle = '#f2efe8'; x.fillRect(0, 224, S, 96);
    x.fillStyle = '#d4231c'; x.fillRect(0, 290, S, 18);
    x.fillStyle = '#f2a01e'; x.fillRect(0, 308, S, 8);
    for (const px of [256, 768]) {
      text(x, 'RAZOR', px - 70, 258, 46, '#d4231c', { style: 'italic', weight: '900' });
      text(x, 'FUEL', px + 92, 258, 46, '#141414', { style: 'italic', weight: '900' });
    }
    weather(x, 0, 224, S, 96, rng, 0.8);
    // pole sign (0,320,512,256): STARDUST DINER + EAT arrow, neon
    {
      x.fillStyle = '#1d6f73'; x.beginPath(); x.roundRect(4, 324, 504, 248, 30); x.fill();
      x.strokeStyle = '#f2e6c8'; x.lineWidth = 8; x.beginPath(); x.roundRect(14, 334, 484, 228, 24); x.stroke();
      const neon = (str, px, py, size, colr, style = 'italic') => {
        text(x, str, px, py, size, colr, { style, weight: '900' });
        ex.shadowColor = colr; ex.shadowBlur = 14;
        text(ex, str, px, py, size, colr, { style, weight: '900' });
        ex.shadowBlur = 0;
      };
      neon('Stardust', 256, 392, 78, '#ff5aa8');
      neon('DINER', 256, 470, 74, '#ffe36a', 'normal');
      // arrow with bulbs
      x.fillStyle = '#f2e6c8'; x.fillRect(40, 520, 380, 26);
      x.beginPath(); x.moveTo(420, 506); x.lineTo(470, 533); x.lineTo(420, 560); x.fill();
      for (let k = 0; k < 14; k++) {
        x.fillStyle = '#ffd27a'; x.beginPath(); x.arc(56 + k * 27, 533, 6, 0, 7); x.fill();
        ex.fillStyle = '#ffb040'; ex.beginPath(); ex.arc(56 + k * 27, 533, 7, 0, 7); ex.fill();
      }
      neon('EAT', 120, 533, 0, '#ff3b30');
      weather(x, 4, 324, 504, 248, rng, 1.2);
    }
    // price sign (512,320,256,256)
    {
      const ox = 512, oy = 320;
      x.fillStyle = '#f2efe8'; x.fillRect(ox + 6, oy + 6, 244, 244);
      x.fillStyle = '#d4231c'; x.fillRect(ox + 6, oy + 6, 244, 70);
      text(x, 'RAZOR FUEL', ox + 128, oy + 42, 36, '#fff', { style: 'italic', weight: '900', maxW: 220 });
      const rows = [['REG', '1.89'], ['SUP', '2.09'], ['DSL', '1.99']];
      rows.forEach(([a, b], k) => {
        const py = oy + 108 + k * 52;
        x.fillStyle = '#111'; x.fillRect(ox + 96, py - 22, 140, 44);
        text(x, a, ox + 52, py, 30, '#222');
        text(x, b + '⁹', ox + 166, py, 34, '#ff5a1e', { font: 'Courier New, monospace' });
        ex.fillStyle = '#ff5a1e'; ex.font = 'bold 34px Courier New, monospace'; ex.textAlign = 'center'; ex.textBaseline = 'middle'; ex.fillText(b + '⁹', ox + 166, py);
      });
      weather(x, ox + 6, oy + 6, 244, 244, rng, 1);
    }
    // pump front (768,320,128,256)
    {
      const ox = 768, oy = 320;
      x.fillStyle = '#ece9e2'; x.fillRect(ox, oy, 128, 256);
      x.fillStyle = '#d4231c'; x.fillRect(ox, oy, 128, 52);
      x.fillStyle = '#1a1a1a'; x.fillRect(ox + 18, oy + 70, 92, 50);
      text(x, '08.42', ox + 64, oy + 95, 26, '#7aff7a', { font: 'Courier New, monospace' });
      ex.fillStyle = '#3aff5a'; ex.fillRect(ox + 22, oy + 80, 84, 30);
      x.fillStyle = '#333'; x.fillRect(ox + 30, oy + 140, 68, 90);
      weather(x, ox, oy, 128, 256, rng, 1);
    }
    // ICE chest front (896,320,128,128) and REST ROOMS (896,448,128,128)
    x.fillStyle = '#e8eef2'; x.fillRect(896, 320, 128, 128);
    text(x, 'ICE', 960, 384, 54, '#1a5ab0', { weight: '900' });
    x.fillStyle = '#7a5a40'; x.fillRect(896, 448, 128, 128);
    text(x, 'REST', 960, 495, 26, '#f0e6d0');
    text(x, 'ROOMS', 960, 528, 26, '#f0e6d0');
    // water tower band (0,576,1024,128)
    x.fillStyle = '#9fa7ab'; x.fillRect(0, 576, S, 128);
    for (const px of [256, 768]) text(x, 'DRY WELLS', px, 640, 70, '#20282f', { weight: '900', maxW: 460 });
    weather(x, 0, 576, S, 128, rng, 2.5);
    // diner side wall (0,704,512,160)
    x.fillStyle = '#e9dcc2'; x.fillRect(0, 704, 512, 160);
    x.fillStyle = '#b8352a'; x.fillRect(0, 832, 512, 32);
    for (let k = 0; k < 3; k++) { x.fillStyle = '#2f3840'; x.fillRect(40 + k * 160, 740, 100, 60); ex.fillStyle = '#4a3418'; ex.fillRect(40 + k * 160, 740, 100, 60); }
    weather(x, 0, 704, 512, 160, rng, 1.2);
    // trailer side (512,704,512,160): KUROSHIO
    x.fillStyle = '#e7e7e4'; x.fillRect(512, 704, 512, 160);
    x.fillStyle = '#d61f2c'; x.fillRect(512, 800, 512, 14);
    text(x, 'KUROSHIO', 768, 756, 70, '#111', { weight: '900', maxW: 460 });
    text(x, 'PERFORMANCE TIRES', 768, 836, 24, '#111', { maxW: 400 });
    weather(x, 512, 704, 512, 160, rng, 1.5);
    // rooftop sign (0,864,512,160): neon EAT + OPEN 24 HRS
    x.fillStyle = '#20262c'; x.fillRect(0, 864, 512, 160);
    x.shadowBlur = 0;
    text(x, 'EAT', 150, 944, 110, '#ff3b30', { weight: '900' });
    text(x, 'OPEN', 380, 916, 44, '#5ad8ff', { weight: '900' });
    text(x, '24 HRS', 380, 970, 44, '#5ad8ff', { weight: '900' });
    ex.shadowBlur = 16; ex.shadowColor = '#ff3b30';
    text(ex, 'EAT', 150, 944, 110, '#ff3b30', { weight: '900' });
    ex.shadowColor = '#5ad8ff';
    text(ex, 'OPEN', 380, 916, 44, '#5ad8ff', { weight: '900' });
    text(ex, '24 HRS', 380, 970, 44, '#5ad8ff', { weight: '900' });
    ex.shadowBlur = 0;
    // canopy underside light panel (512,864,512,160)
    x.fillStyle = '#d8d8d2'; x.fillRect(512, 864, 512, 160);
    for (let k = 0; k < 4; k++) { x.fillStyle = '#fffbe8'; x.fillRect(540 + k * 120, 900, 90, 90); ex.fillStyle = '#fff4d0'; ex.fillRect(540 + k * 120, 900, 90, 90); }
    return { c, e };
  });
}

function truckStop(world, P) {
  const st = P.stop, T = P.track;
  const night = !!world.at.lamps;
  const atlas = stopAtlas();
  const map = canvasTex(atlas.c, { repeat: false }), emi = canvasTex(atlas.e, { repeat: false });
  const tex = new GeoBuilder(), plain = new GeoBuilder();
  const gy = st.y + 0.02;
  // local frame: a along the road, b away from it
  const W2 = (a, b, y) => { const [x, z] = st.world(a, b); return new THREE.Vector3(x, y, z); };
  const out = [st.lx, st.lz], along = [st.tx, st.tz];
  const ry = Math.atan2(st.lx, st.lz); // box local z = outward, local x = ±along
  const box = (a, b, y, w, h, d, hex, k = 1) => { setColor(plain, hex, k); const p = W2(a, b, y); plain.box(p.x, p.y, p.z, w, h, d, ry); };
  const uvA = (x0, y0, w, h) => cellUV(x0, y0, w, h);
  // textured upright face: centered at (a, b), facing n (unit xz), width w along the face
  const faceAt = (a, b, y, nx, nz, w, h, uv) => { const p = W2(a, b, y); panel(tex, p.x, p.y, p.z, nx, nz, w, h, uv); };
  const towardRoad = [-out[0], -out[1]];
  // ---- canopy over two pump islands
  const ca = -30, cb = 24, cw = 22, cd = 12;
  for (const a of [ca - 8, ca, ca + 8]) for (const b of [cb - 4.5, cb + 4.5]) box(a, b, gy, 0.42, 5.4, 0.42, '#d9d6cf');
  box(ca, cb, gy + 5.4, cw, 1.0, cd, '#ecebe6');
  faceAt(ca, cb - cd / 2 - 0.02, gy + 5.4, towardRoad[0], towardRoad[1], cw, 1.0, uvA(0, 224, 1024, 96));
  faceAt(ca, cb + cd / 2 + 0.02, gy + 5.4, out[0], out[1], cw, 1.0, uvA(0, 224, 1024, 96));
  for (const sgn of [-1, 1]) faceAt(ca + sgn * (cw / 2 + 0.02), cb, gy + 5.4, along[0] * sgn, along[1] * sgn, cd, 1.0, uvA(0, 224, 512, 96));
  // underside light panel
  {
    const p0 = W2(ca - cw / 2 + 1, cb - cd / 2 + 1, gy + 5.38), p1 = W2(ca + cw / 2 - 1, cb - cd / 2 + 1, gy + 5.38);
    const p2 = W2(ca + cw / 2 - 1, cb + cd / 2 - 1, gy + 5.38), p3 = W2(ca - cw / 2 + 1, cb + cd / 2 - 1, gy + 5.38);
    const n = new THREE.Vector3().subVectors(p1, p0).cross(new THREE.Vector3().subVectors(p3, p0));
    if (n.y > 0) tex.quad(p0, p3, p2, p1, uvA(512, 864, 512, 160)); else tex.quad(p0, p1, p2, p3, uvA(512, 864, 512, 160));
  }
  for (const b of [cb - 2.6, cb + 2.6]) {
    box(ca, b, gy, 13, 0.22, 1.3, '#bdb8ae');
    for (const a of [ca - 4, ca, ca + 4]) {
      box(a, b, gy + 0.22, 0.7, 1.9, 0.55, '#e5e2db');
      for (const sgn of [-1, 1]) faceAt(a, b + sgn * 0.29, gy + 0.3, out[0] * sgn, out[1] * sgn, 0.66, 1.75, uvA(768, 320, 128, 256));
      box(a, b, gy + 2.12, 0.8, 0.14, 0.62, '#d4231c');
    }
  }
  // ---- diner
  const da = 20, db = 36, dw = 28, dd = 12, dh = 4.6;
  box(da, db, gy, dw, dh, dd, '#e9dcc2');
  faceAt(da, db - dd / 2 - 0.03, gy, towardRoad[0], towardRoad[1], dw, dh, uvA(0, 0, 1024, 224));
  for (const sgn of [-1, 1]) faceAt(da + sgn * (dw / 2 + 0.03), db, gy, along[0] * sgn, along[1] * sgn, dd, dh, uvA(0, 704, 512, 160));
  box(da, db, gy + dh, dw + 0.6, 0.55, dd + 0.6, '#b8352a');
  box(da, db - dd / 2 - 1.4, gy + dh - 0.9, dw + 0.4, 0.22, 2.8, '#2aa3a0'); // awning
  for (const [a, b] of [[da - 8, db + 2], [da + 3, db + 3], [da + 9, db - 1]]) box(a, b, gy + dh + 0.55, 2.4, 1.3, 1.8, '#9a9a96');
  // rooftop EAT / OPEN 24 HRS sign
  box(da - 6, db - 2, gy + dh + 0.55, 0.12, 3.6, 0.12, '#444');
  box(da + 2, db - 2, gy + dh + 0.55, 0.12, 3.6, 0.12, '#444');
  box(da - 2, db - 2.05, gy + dh + 1.2, 9.2, 3.0, 0.3, '#20262c');
  faceAt(da - 2, db - 2.25, gy + dh + 1.2, towardRoad[0], towardRoad[1], 9, 2.9, uvA(0, 864, 512, 160));
  // ice chest + restroom door
  box(da - 9, db - dd / 2 - 0.6, gy, 2.2, 1.4, 1.0, '#e8eef2');
  faceAt(da - 9, db - dd / 2 - 1.12, gy, towardRoad[0], towardRoad[1], 2.1, 1.35, uvA(896, 320, 128, 128));
  faceAt(da + dw / 2 + 0.05, db + 3, gy, along[0], along[1], 1.2, 2.2, uvA(896, 448, 128, 128));
  // ---- tall pole sign + price sign (face the approaching traffic)
  const facing = (ang) => {
    const nx = -along[0] * Math.cos(ang) - out[0] * Math.sin(ang), nz = -along[1] * Math.cos(ang) - out[1] * Math.sin(ang);
    const l = Math.hypot(nx, nz);
    return [nx / l, nz / l];
  };
  {
    const [nx, nz] = facing(0.5);
    const p = W2(-6, 17, gy);
    setColor(plain, '#7d8287');
    for (const k of [-1.6, 1.6]) plain.box(p.x + nz * k, gy, p.z - nx * k, 0.4, 16.5, 0.4, 0);
    setColor(plain, '#1d6f73');
    plain.box(p.x, gy + 12, p.z, 8.4, 4.4, 0.6, Math.atan2(nz, -nx));
    panel(tex, p.x + nx * 0.32, gy + 12.05, p.z + nz * 0.32, nx, nz, 8.2, 4.1, uvA(0, 320, 512, 256));
    panel(tex, p.x - nx * 0.32, gy + 12.05, p.z - nz * 0.32, -nx, -nz, 8.2, 4.1, uvA(0, 320, 512, 256));
    if (night) world.addLamp(p.x + nx * 3, gy + 13, p.z + nz * 3, '#ff7ab0', 22, 0.8);
  }
  {
    const [nx, nz] = facing(0.35);
    const p = W2(-56, 16.5, gy);
    setColor(plain, '#8a8e92');
    plain.box(p.x, gy, p.z, 0.35, 8.6, 0.35, 0);
    panel(tex, p.x + nx * 0.2, gy + 5.4, p.z + nz * 0.2, nx, nz, 3.1, 3.1, uvA(512, 320, 256, 256));
    setColor(plain, '#d4231c');
    panel(plain, p.x - nx * 0.05, gy + 5.4, p.z - nz * 0.05, -nx, -nz, 3.1, 3.1);
  }
  // ---- water tower
  {
    const p = W2(58, 54, gy);
    setColor(plain, '#6d7174');
    for (const [dx, dz] of [[-3, -3], [3, -3], [-3, 3], [3, 3]]) {
      const leg = new THREE.CylinderGeometry(0.2, 0.26, 17, 6);
      leg.translate(0, 8.5, 0);
      leg.rotateZ(-dx * 0.016); leg.rotateX(dz * 0.016);
      plain.geometry(leg, new THREE.Matrix4().makeTranslation(p.x + dx, gy, p.z + dz));
    }
    for (const y of [5, 10.5]) {
      plain.box(p.x, gy + y, p.z - 3, 6.2, 0.15, 0.15, 0);
      plain.box(p.x, gy + y, p.z + 3, 6.2, 0.15, 0.15, 0);
      plain.box(p.x - 3, gy + y, p.z, 0.15, 0.15, 6.2, 0);
      plain.box(p.x + 3, gy + y, p.z, 0.15, 0.15, 6.2, 0);
    }
    setColor(plain, '#97a0a4');
    plain.cylinder(p.x, gy + 17, p.z, 4.6, 1.4, 16, 4.6);
    plain.cylinder(p.x, gy + 24, p.z, 4.6, 2.2, 16, 0.3);
    plain.cylinder(p.x, gy + 16.4, p.z, 2.0, 0.6, 12, 4.6);
    // band with the town name wraps the tank
    const seg = 24;
    for (let j = 0; j < seg; j++) {
      const a0 = j / seg * Math.PI * 2, a1 = (j + 1) / seg * Math.PI * 2;
      const A = new THREE.Vector3(p.x + Math.cos(a0) * 4.62, gy + 18.4, p.z + Math.sin(a0) * 4.62);
      const B = new THREE.Vector3(p.x + Math.cos(a1) * 4.62, gy + 18.4, p.z + Math.sin(a1) * 4.62);
      const uA = 1 - (j / seg * 2) % 1, uB = uA - 2 / seg;
      tex.quad(B, A, new THREE.Vector3(A.x, gy + 24, A.z), new THREE.Vector3(B.x, gy + 24, B.z), [uB, 1 - 704 / 1024, uA, 1 - 576 / 1024]);
    }
  }
  // ---- parked rigs: semi (KUROSHIO trailer), pickup, sedan
  {
    const a0 = 40, b0 = 21;
    box(a0, b0, gy + 1.3, 14, 3.0, 2.6, '#e7e7e4');
    faceAt(a0, b0 - 1.32, gy + 1.3, towardRoad[0], towardRoad[1], 14, 3.0, uvA(512, 704, 512, 160));
    box(a0 - 9.4, b0, gy + 0.9, 3.4, 2.4, 2.5, '#9e2a22');
    box(a0 - 11.6, b0, gy + 0.8, 1.6, 1.5, 2.3, '#9e2a22');
    box(a0 - 9.1, b0, gy + 3.3, 2.2, 0.6, 2.3, '#9e2a22');
    for (const a of [a0 - 11.4, a0 - 8.6, a0 + 3.6, a0 + 5.0, a0 + 6.4]) for (const sb of [-1, 1]) box(a, b0 + sb * 1.1, gy, 1.0, 1.0, 0.45, '#1b1b1c');
    box(a0 - 11.3, b0 - 0.6, gy + 2.3, 0.14, 2.4, 0.14, '#cfcfcf');
  }
  const car = (a, b, len, hex, cab) => {
    box(a, b, gy + 0.35, len, 0.75, 1.8, hex);
    box(a + (cab ? -len * 0.12 : 0), b, gy + 1.1, len * (cab ? 0.32 : 0.5), 0.6, 1.66, hex, 0.85);
    box(a + (cab ? -len * 0.12 : 0), b, gy + 1.15, len * (cab ? 0.3 : 0.47), 0.42, 1.7, '#2a3036');
    for (const ka of [-0.32, 0.32]) for (const sb of [-1, 1]) box(a + ka * len, b + sb * 0.8, gy, 0.66, 0.66, 0.3, '#151515');
  };
  car(6, 22, 5.2, '#4f6a7a', true);
  car(28, 23, 4.6, '#c9b07a', false);
  car(-16, 37, 4.8, '#7a3a2a', true);
  // ---- clutter: drums, tires, dumpster, phone booth
  const rng = makeRng('stopclutter');
  for (let k = 0; k < 7; k++) { setColor(plain, ['#2f5a8a', '#8a2a20', '#3a6a3a'][k % 3]); const p = W2(36 + (k % 3) * 0.75, 44 + Math.floor(k / 3) * 0.75, gy); plain.cylinder(p.x, gy, p.z, 0.3, 0.9, 8, 0.3); }
  for (let k = 0; k < 5; k++) { setColor(plain, '#1a1a1a'); const p = W2(-44 + rng() * 2, 40 + rng() * 2, gy); plain.cylinder(p.x, gy + k * 0.26, p.z, 0.38, 0.25, 10, 0.38); }
  box(36, 46, gy, 2.0, 1.4, 1.4, '#2f5a3a');
  box(-4, 30, gy, 1.0, 2.3, 1.0, '#a8b2b8');
  box(-4, 30, gy + 2.3, 1.1, 0.2, 1.1, '#3a5a8a');
  // ---- fan palms by the diner
  for (const [a, b, h] of [[2, 31, 10], [36.5, 30, 12], [41, 32, 9]]) {
    const p = W2(a, b, gy);
    setColor(plain, '#7a6650');
    tube(plain, [new THREE.Vector3(p.x, gy, p.z), new THREE.Vector3(p.x + 0.3, gy + h * 0.5, p.z + 0.2), new THREE.Vector3(p.x + 0.5, gy + h, p.z + 0.3)], [0.32, 0.26, 0.22], 6);
    const top = new THREE.Vector3(p.x + 0.5, gy + h, p.z + 0.3);
    setColor(plain, '#6b5a40');
    plain.cylinder(top.x, top.y - 1.4, top.z, 0.5, 1.4, 6, 0.75);
    for (let k = 0; k < 12; k++) {
      const ang = k / 12 * Math.PI * 2 + rng() * 0.3, droop = 0.25 + rng() * 0.35;
      const fr = new THREE.BoxGeometry(0.85, 0.06, 3.0);
      fr.translate(0, 0, 1.5);
      fr.rotateX(droop);
      fr.rotateY(ang);
      setColor(plain, k % 2 ? '#4f6a34' : '#5c7a3c');
      plain.geometry(fr, new THREE.Matrix4().makeTranslation(top.x, top.y, top.z));
    }
  }
  const tm = new THREE.Mesh(tex.build(), new THREE.MeshStandardMaterial({ map, emissive: 0xffffff, emissiveMap: emi, emissiveIntensity: night ? 2.2 : 0.55, roughness: 0.6, side: THREE.DoubleSide }));
  world.add(tm);
  const pm = new THREE.Mesh(plain.build(true), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7, metalness: 0.15 }));
  pm.castShadow = true;
  pm.receiveShadow = true;
  world.add(pm);
  if (night) {
    for (const a of [ca - 6, ca + 6]) for (const b of [cb - 3, cb + 3]) { const p = W2(a, b, gy + 5); world.addLamp(p.x, p.y, p.z, '#fff2d8', 16, 1.1); }
    const p = W2(da, db - dd / 2 - 3, gy + 3);
    world.addLamp(p.x, p.y, p.z, '#ffc070', 18, 0.9);
  }
}

// ------------------------------------------------------------------ finish gantry + tumbleweeds

function finishGantry(world, P) {
  const T = P.track;
  const atlas = dragAtlas();
  const map = canvasTex(atlas.c, { repeat: false });
  const plain = new GeoBuilder(), tex = new GeoBuilder();
  const p = T.posAt(T.finishS), i = p.i;
  const w = T.W[i] + T.shoulder + 1.2;
  const fx = T.TX[i], fz = T.TZ[i];
  setColor(plain, '#5a5d61');
  for (const sd of [-1, 1]) plain.box(p.x + T.LX[i] * sd * w, p.y - 0.4, p.z + T.LZ[i] * sd * w, 0.45, 8.6, 0.45, p.heading);
  plain.box(p.x, p.y + 7.6, p.z, w * 2 + 0.6, 0.6, 0.5, p.heading);
  const uv = cellUV(0, 128, 1024, 128, 1024, 512);
  panel(tex, p.x - fx * 0.3, p.y + 5.5, p.z - fz * 0.3, -fx, -fz, w * 2 - 1, (w * 2 - 1) / 8, uv);
  panel(tex, p.x - fx * 0.25, p.y + 5.5, p.z - fz * 0.25, fx, fz, w * 2 - 1, (w * 2 - 1) / 8, uv);
  const pm = new THREE.Mesh(plain.build(true), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, metalness: 0.4 }));
  pm.castShadow = true;
  world.add(pm);
  world.add(new THREE.Mesh(tex.build(), new THREE.MeshStandardMaterial({ map, roughness: 0.7, side: THREE.DoubleSide })));
}

/** A few tumbleweeds that keep blowing across the road ahead of the camera. */
function tumbleweeds(world, P, count = 7) {
  const T = P.track, terr = world.terrain;
  const rng = makeRng('tumble' + P.def.id);
  const shapes = [];
  for (let k = 0; k < count; k++) {
    const pts = [];
    for (let j = 0; j < 70; j++) {
      const u = rng() * 2 - 1, a = rng() * Math.PI * 2, r = 0.3 + rng() * 0.22;
      pts.push(new THREE.Vector3(Math.sqrt(1 - u * u) * Math.cos(a) * r, u * r * 0.85, Math.sqrt(1 - u * u) * Math.sin(a) * r));
    }
    const seg = [];
    for (let j = 0; j < pts.length; j++) {
      // twigs: link each point to two random near neighbours
      const near = pts.map((q, m) => [q.distanceToSquared(pts[j]), m]).sort((a, b) => a[0] - b[0]);
      for (const [, m] of [near[1 + Math.floor(rng() * 3)], near[2 + Math.floor(rng() * 4)]]) seg.push(pts[j], pts[m]);
    }
    shapes.push(seg);
  }
  const n = shapes.reduce((a, sh) => a + sh.length, 0);
  const pos = new Float32Array(n * 3);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const lines = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: 0x6e5638 }));
  lines.frustumCulled = false;
  world.add(lines);
  const wind = new THREE.Vector2(0.82, 0.57).normalize();
  const st = shapes.map(() => ({ x: 0, z: 0, y: 0, vx: 0, vz: 0, ph: rng() * 6, q: new THREE.Quaternion(), live: false, size: 0.8 + rng() * 0.6 }));
  const proj = {}, axis = new THREE.Vector3(), dq = new THREE.Quaternion(), v = new THREE.Vector3();
  let hint = -1;
  const spawn = (o, cam) => {
    const pr = T.project(cam.position.x, cam.position.z, hint, proj);
    hint = pr.i;
    const s = pr.s + 30 + rng() * 220;
    const ps = T.posAt(s);
    // start on the upwind side so it rolls across the road
    const side = (wind.x * T.LX[ps.i] + wind.y * T.LZ[ps.i]) > 0 ? -1 : 1;
    const q2 = T.posAt(s, side * (T.W[ps.i] + 8 + rng() * 26));
    o.x = q2.x; o.z = q2.z;
    const sp = 3.5 + rng() * 4.5;
    o.vx = wind.x * sp; o.vz = wind.y * sp;
    o.live = true;
  };
  world.animators.push((dt, cam) => {
    dt = Math.min(dt, 0.1);
    let k = 0;
    st.forEach((o, j) => {
      if (!o.live || Math.hypot(o.x - cam.position.x, o.z - cam.position.z) > 320) spawn(o, cam);
      o.x += o.vx * dt; o.z += o.vz * dt;
      o.ph += dt * Math.hypot(o.vx, o.vz) * 0.9;
      const gy = terr ? terr.heightAt(o.x, o.z) : 0;
      const pr = T.project(o.x, o.z, -1, proj);
      const onRoad = Math.abs(pr.lat) < T.W[pr.i] + T.shoulder + 1;
      const ground = onRoad ? T.roadY(pr.i, pr.t, clamp(pr.lat, -T.W[pr.i], T.W[pr.i])) : gy;
      o.y = ground + 0.45 * o.size + Math.abs(Math.sin(o.ph * 0.5)) * 0.7;
      axis.set(o.vz, 0, -o.vx).normalize();
      dq.setFromAxisAngle(axis, -dt * Math.hypot(o.vx, o.vz) / (0.45 * o.size));
      o.q.premultiply(dq);
      for (const p of shapes[j]) {
        v.copy(p).multiplyScalar(o.size).applyQuaternion(o.q);
        pos[k++] = o.x + v.x; pos[k++] = o.y + v.y; pos[k++] = o.z + v.z;
      }
    });
    g.attributes.position.needsUpdate = true;
  });
}

// ------------------------------------------------------------------ dry wash

function sandDriftCanvas() {
  return cachedCanvas('drift', () => {
    const c = cvs(256, 256), x = c.getContext('2d');
    const rng = makeRng('drift');
    for (let i = 0; i < 70; i++) {
      const px = rng() * 256, py = 40 + rng() * 176, rx = 12 + rng() * 60, ry = 4 + rng() * 16;
      const g = x.createRadialGradient(px, py, 0, px, py, rx);
      g.addColorStop(0, `rgba(226,190,150,${0.35 + rng() * 0.4})`);
      g.addColorStop(1, 'rgba(226,190,150,0)');
      x.fillStyle = g;
      x.save(); x.translate(px, py); x.scale(1, ry / rx); x.translate(-px, -py);
      x.fillRect(px - rx, py - rx, rx * 2, rx * 2);
      x.restore();
    }
    return c;
  });
}

function washDressing(world, P) {
  const T = P.track, terr = world.terrain;
  const rng = makeRng('wash' + P.def.id);
  const q = {};
  for (const W of P.washes) {
    const cobbles = [], wood = new GeoBuilder();
    for (let k = 0; k < 900; k++) {
      const u = (rng() - 0.5) * 900, v = W.mid(u) + (rng() - 0.5) * W.half(u) * 1.8;
      const x = W.cx + W.ux * u + W.vx * v, z = W.cz + W.uz * u + W.vz * v;
      if (x < P.gx0 + 20 || x > P.gx1 - 20 || z < P.gz0 + 20 || z > P.gz1 - 20) continue;
      P.near(x, z, q);
      if (q.d < T.W[q.i] + T.shoulder + 2) continue;
      const sc = 0.15 + Math.pow(rng(), 3) * 1.1;
      cobbles.push({ x, y: terr.heightAt(x, z) - sc * 0.3, z, s: sc, ry: rng() * 6, rx: rng(), rz: rng(), color: new THREE.Color().setScalar(0.85 + rng() * 0.3) });
      if (k % 45 === 0) {
        // bleached driftwood snag
        setColor(wood, '#b8a690');
        const a = rng() * 6.28, len = 2 + rng() * 3, y = terr.heightAt(x, z) + 0.15;
        tube(wood, [new THREE.Vector3(x, y, z), new THREE.Vector3(x + Math.cos(a) * len * 0.5, y + 0.25, z + Math.sin(a) * len * 0.5), new THREE.Vector3(x + Math.cos(a + 0.4) * len, y + 0.1, z + Math.sin(a + 0.4) * len)], [0.12, 0.08, 0.03], 4);
      }
    }
    const cg = jitter(new THREE.IcosahedronGeometry(1, 0), 0.35, 4, 0.6);
    scatter(world, cg, new THREE.MeshStandardMaterial({ color: col('#c8b6a0'), roughness: 0.9, flatShading: true }), cobbles, { name: 'cobbles', cell: 500, maxDist: 400 });
    // flood depth gauge in the dip
    const i = W.i;
    for (const side of [1, -1]) {
      const lat = side * (T.W[i] + T.shoulder + 1.2);
      const a = i * T.step + side * 9;
      const p = T.posAt(a, lat);
      const gy = p.y - 0.3;
      for (let k = 0; k < 8; k++) {
        setColor(wood, k % 2 ? '#1a1a1a' : '#f0eee8');
        wood.box(p.x, gy + k * 0.3, p.z, 0.16, 0.3, 0.06, p.heading);
      }
    }
    if (wood.count) world.add(new THREE.Mesh(wood.build(true), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85 })));
    // sand washed across the asphalt in the dip
    const tex = canvasTex(sandDriftCanvas(), { repeat: false });
    const dg = new GeoBuilder();
    const s0 = i * T.step - 16, s1 = i * T.step + 16;
    for (let s = s0; s < s1; s += 4) {
      const a0 = T.posAt(s), a1 = T.posAt(s + 4);
      const w0 = T.W[a0.i] + 0.6, w1 = T.W[a1.i] + 0.6;
      const P0 = T.posAt(s, -w0), P1 = T.posAt(s, w0), P2 = T.posAt(s + 4, w1), P3 = T.posAt(s + 4, -w1);
      const v0 = (s - s0) / (s1 - s0), v1 = (s + 4 - s0) / (s1 - s0);
      dg.quad(new THREE.Vector3(P0.x, P0.y + 0.02, P0.z), new THREE.Vector3(P1.x, P1.y + 0.02, P1.z), new THREE.Vector3(P2.x, P2.y + 0.02, P2.z), new THREE.Vector3(P3.x, P3.y + 0.02, P3.z), [0, v0, 1, v1]);
    }
    const dm = new THREE.Mesh(dg.build(), new THREE.MeshStandardMaterial({ map: tex, transparent: true, depthWrite: false, roughness: 1, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 }));
    dm.renderOrder = 1;
    world.add(dm);
  }
}

// ------------------------------------------------------------------ drag strip

function dragAtlas() {
  return cachedCanvas('drag', () => {
    const S = 1024;
    const c = cvs(S, 512), x = c.getContext('2d');
    const e = cvs(S, 512), ex = e.getContext('2d');
    const rng = makeRng('drag');
    ex.fillStyle = '#000'; ex.fillRect(0, 0, S, 512);
    // start banner (0,0,1024,128)
    x.fillStyle = '#141416'; x.fillRect(0, 0, S, 128);
    x.fillStyle = '#d4231c'; x.fillRect(0, 0, S, 14); x.fillRect(0, 114, S, 14);
    text(x, 'DRY LAKE DRAGS', 512, 66, 78, '#f4f1ea', { style: 'italic', weight: '900', maxW: 760 });
    text(x, 'EST. 1958', 120, 66, 26, '#f2a01e');
    text(x, 'RAZOR FUEL', 905, 66, 30, '#f2a01e', { style: 'italic', weight: '900' });
    weather(x, 0, 0, S, 128, rng, 1);
    // finish banner (0,128,1024,128): checkers + FINISH
    for (let i = 0; i < 64; i++) for (let j = 0; j < 8; j++) { x.fillStyle = (i + j) % 2 ? '#111' : '#eee'; x.fillRect(i * 16, 128 + j * 16, 16, 16); }
    x.fillStyle = '#f4f1ea'; x.fillRect(312, 140, 400, 104);
    text(x, 'FINISH', 512, 194, 84, '#111', { weight: '900' });
    weather(x, 0, 128, S, 128, rng, 0.8);
    // scoreboards (0,256,512,256) left lane / (512,256,512,256) right lane
    const board = (ox, lane, et, mph) => {
      x.fillStyle = '#0c0c0e'; x.fillRect(ox, 256, 512, 256);
      x.strokeStyle = '#f2a01e'; x.lineWidth = 6; x.strokeRect(ox + 8, 264, 496, 240);
      text(x, lane, ox + 256, 296, 30, '#f4f1ea');
      for (const [str, py, sz] of [[et, 370, 84], [mph, 462, 70]]) {
        text(x, str, ox + 256, py, sz, '#ff8a1e', { font: 'Courier New, monospace', weight: '900' });
        ex.shadowColor = '#ff6a00'; ex.shadowBlur = 10;
        text(ex, str, ox + 256, py, sz, '#ff8a1e', { font: 'Courier New, monospace', weight: '900' });
        ex.shadowBlur = 0;
      }
      text(ex, lane, ox + 256, 296, 30, '#806040');
    };
    board(0, 'LEFT LANE', '8.912', '156.43');
    board(512, 'RIGHT LANE', '9.047', '151.80');
    return { c, e };
  });
}

function dragStrip(world, P) {
  const T = P.track, terr = world.terrain;
  const night = !!world.at.lamps;
  const rng = makeRng('drag' + P.def.id);
  const s0 = T.startS, s1 = T.finishS, W = T.W[0];
  // local frame: a = s along the strip, b = lateral (+ left)
  const at = (a, b) => { const p = T.posAt(a, b); return [p.x, p.z, p.heading]; };
  const gyAt = (x, z) => terr.heightAt(x, z);
  const plain = new GeoBuilder(), tex = new GeoBuilder();
  const atlas = dragAtlas();
  const map = canvasTex(atlas.c, { repeat: false }), emi = canvasTex(atlas.e, { repeat: false });
  const hd = T.posAt(0).heading;
  const fx = Math.sin(hd), fz = Math.cos(hd);           // forward
  const lx = fz, lz = -fx;                              // left
  const box = (a, b, y, w, h, d, hex, k = 1) => { const [x, z] = at(a, b); setColor(plain, hex, k); plain.box(x, y, z, w, h, d, hd); };
  const uvD = (x0, y0, w, h) => cellUV(x0, y0, w, h, 1024, 512);
  // ---- overhead start + finish gantries
  const gantry = (a, uv, label) => {
    for (const sd of [-1, 1]) box(a, sd * (W + 2.2), 0, 0.45, 8.2, 0.45, '#5a5d61');
    box(a, 0, 7.6, (W + 2.4) * 2, 0.6, 0.5, '#5a5d61');
    box(a, 0, 7.2, (W + 2.4) * 2, 0.3, 0.25, '#3c3e41');
    const [x, z] = at(a - 0.3, 0);
    panel(tex, x, 5.4, z, -fx, -fz, 15, 1.9, uv);
    panel(tex, x + fx * 0.05, 5.4, z + fz * 0.05, fx, fz, 15, 1.9, uv);
    void label;
  };
  gantry(s0 - 3, uvD(0, 0, 1024, 128), 'start');
  gantry(s1, uvD(0, 128, 1024, 128), 'finish');
  // timing beams at the line + finish
  for (const a of [s0, s1]) for (const sd of [-1, 1]) { box(a, sd * (W + 0.9), 0, 0.25, 0.9, 0.25, '#e8e6e0'); box(a, sd * (W + 0.9), 0.6, 0.18, 0.12, 0.3, '#d4231c'); }
  // ---- christmas tree on the left shoulder, just past the line
  const tree = { a: s0 + 4, b: W + 1.9 };
  {
    box(tree.a, tree.b, 0, 0.9, 0.3, 0.9, '#9a9a96');
    box(tree.a, tree.b, 0.3, 0.16, 3.0, 0.16, '#2a2a2c');
    box(tree.a, tree.b, 2.9, 1.0, 3.3, 0.4, '#141416');
    box(tree.a, tree.b, 6.2, 0.12, 0.6, 0.12, '#2a2a2c');
  }
  const bulbs = { pre: [], stage: [], a1: [], a2: [], a3: [], green: [], red: [] };
  {
    const [x, z] = at(tree.a, tree.b);
    const yRow = { pre: 5.95, stage: 5.65, a1: 5.15, a2: 4.6, a3: 4.05, green: 3.5, red: 3.08 };
    for (const [k, y] of Object.entries(yRow)) {
      for (const sd of [-1, 1]) {
        const r = k === 'pre' || k === 'stage' ? 0.1 : 0.19;
        const g = new THREE.CircleGeometry(r, 12);
        g.rotateY(hd + Math.PI);
        const bx = x + lx * sd * 0.24 - fx * 0.21, bz = z + lz * sd * 0.24 - fz * 0.21;
        g.translate(bx, y, bz);
        bulbs[k].push(g);
      }
    }
  }
  const BULB = { pre: '#ffd76a', stage: '#ffd76a', a1: '#ffaa22', a2: '#ffaa22', a3: '#ffaa22', green: '#3aff6a', red: '#ff2a1a' };
  const bulbMats = {};
  for (const [k, list] of Object.entries(bulbs)) {
    const m = new THREE.MeshBasicMaterial({ color: col(BULB[k]).multiplyScalar(0.08) });
    bulbMats[k] = m;
    world.add(new THREE.Mesh(mergeGeos(list), m));
  }
  const setBulb = (k, on) => bulbMats[k].color.copy(col(BULB[k])).multiplyScalar(on ? 7 : 0.07);
  let demo = 0;
  world.animators.push((dt) => {
    demo += dt;
    const ses = window.__game?.screen?.session;
    let st = { pre: 1, stage: 1, a1: 0, a2: 0, a3: 0, green: 0, red: 0 };
    if (ses && ses.track === T) {
      // race state lives on session.sim (older builds kept it on the session)
      const sim = ses.sim || ses;
      if (sim.state === 'countdown') {
        const c = sim.countdown ?? 3;
        st = { pre: 1, stage: 1, a1: c <= 3, a2: c <= 2, a3: c <= 1, green: 0, red: 0 };
      } else if (sim.state === 'racing' || sim.state === 'finished' || sim.state === 'done') {
        st = { pre: 0, stage: 0, a1: 0, a2: 0, a3: 0, green: (sim.raceTime ?? 0) < 6, red: 0 };
      }
    } else {
      const c = demo % 8;
      st = { pre: 1, stage: c > 1, a1: c > 3, a2: c > 4, a3: c > 5, green: c > 6, red: 0 };
    }
    for (const k of Object.keys(bulbs)) setBulb(k, !!st[k]);
  });
  // ---- scoreboards past the finish, facing the runs
  for (const [sd, ox] of [[1, 0], [-1, 512]]) {
    const a = s1 + 30, b = sd * (W + 8);
    for (const k of [-2.2, 2.2]) box(a + 0.4, b + k, 0, 0.3, 5.2, 0.3, '#3c3e41');
    box(a + 0.3, b, 5.0, 7.4, 4.0, 0.4, '#121214');
    const [x, z] = at(a, b);
    panel(tex, x - fx * 0.02, 5.2, z - fz * 0.02, -fx, -fz, 7.0, 3.5, uvD(ox, 256, 512, 256));
  }
  // ---- timing tower (right side at the line)
  {
    const a = s0 + 2, b = -(W + 12);
    box(a, b, 0, 4.4, 3.0, 4.4, '#d8d2c4');
    box(a, b, 3.0, 4.0, 2.6, 4.0, '#2a3a48');
    box(a, b, 5.6, 4.8, 0.3, 4.8, '#9e2a22');
    box(a + 1.8, b + 1.8, 5.9, 0.08, 4, 0.08, '#888');
  }
  // ---- bleachers + crowd (left, behind the line)
  const people = [];
  const shirt = ['#d23a2a', '#2a5ad2', '#f2f2ee', '#2a2a2c', '#e8b030', '#3a8a4a', '#7a3ab0', '#f07a2a'];
  for (const a0 of [s0 - 70, s0 - 34]) {
    const b0 = W + 15;
    for (let r = 0; r < 6; r++) {
      box(a0, b0 + 1 + r * 0.9, r * 0.5, 0.35, 0.08, 30, '#a8acb0', 1.1);
      box(a0, b0 + 1.5 + r * 0.9, 0, 0.12, r * 0.5 + 0.45, 30, '#7a7e82');
      for (let k = 0; k < 30; k += 0.7 + rng() * 0.8) {
        if (rng() < 0.4) continue;
        const [x, z] = at(a0 - 15 + k, b0 + 1 + r * 0.9);
        people.push({ x, y: r * 0.5 - 0.55, z, ry: hd + Math.PI / 2 + (rng() - 0.5) * 0.6, s: 0.95 + rng() * 0.1, color: col(shirt[Math.floor(rng() * shirt.length)]) });
      }
    }
    for (const k of [-15, 0, 15]) box(a0 + k, b0 + 3.3, 0, 5.4, 3.0, 0.12, '#7a7e82');
  }
  // ---- pits: trucks, RVs, vans, trailers on both sides + standing crowd
  const paint = ['#c9c4b8', '#8a1f1a', '#1f3f6a', '#e0dcd2', '#2a2a2c', '#5a6a3a', '#b8862a', '#4a4e54', '#d8d8d4'];
  const vehicle = (a, b, kind) => {
    const c = paint[Math.floor(rng() * paint.length)];
    const len = { pickup: 5.4, van: 5.0, rv: 9.5, hauler: 8.0, semi: 15 }[kind];
    const ang = (rng() - 0.5) * 0.25;
    const [x, z] = at(a, b);
    const ry = hd + Math.PI / 2 + ang;
    const ca = Math.cos(ry), sa = Math.sin(ry);
    const P2 = (u, v) => [x + u * ca + v * sa, z - u * sa + v * ca];
    const add = (u, v, y, w, h, d, hex, k = 1) => { const [px, pz] = P2(u, v); setColor(plain, hex, k); plain.box(px, y, pz, w, h, d, ry); };
    if (kind === 'pickup') {
      add(0, 0, 0.45, len, 0.85, 1.95, c);
      add(-0.5, 0, 1.3, 1.9, 0.75, 1.85, c, 0.92); add(-0.5, 0, 1.36, 1.8, 0.55, 1.9, '#20262c');
    } else if (kind === 'van') {
      add(0, 0, 0.45, len, 1.75, 1.95, c); add(1.6, 0, 1.2, 1.2, 0.7, 1.98, '#20262c');
    } else if (kind === 'rv') {
      add(0, 0, 0.5, len, 2.7, 2.4, '#e8e4da'); add(0, 0, 1.2, len + 0.02, 0.3, 2.42, c);
      add(len / 2 - 0.8, 0, 2.1, 1.2, 0.8, 2.44, '#20262c');
      add(-1, 0, 3.2, 2.4, 0.4, 1.6, '#cfcfcf');
    } else if (kind === 'hauler') {
      add(0, 0, 0.6, len, 0.25, 2.3, '#3c3e41');
      add(0.5, 0, 0.85, 4.4, 1.1, 1.85, paint[Math.floor(rng() * paint.length)]);
      add(0.2, 0, 1.6, 2.2, 0.55, 1.75, '#20262c');
    } else {
      add(-2, 0, 1.2, 12, 3.6, 2.5, c); add(5.4, 0, 0.9, 2.8, 2.7, 2.4, '#8a1f1a');
    }
    for (const u of [-len * 0.32, len * 0.32]) for (const v of [-0.9, 0.9]) add(u, v, 0, 0.7, 0.7, 0.3, '#151515');
  };
  const spots = [];
  for (let a = s0 - 110; a < s1 + 60; a += 9 + rng() * 9) {
    for (const sd of [1, -1]) {
      if (sd > 0 && a > s0 - 90 && a < s0 + 2) continue; // bleachers
      if (sd < 0 && Math.abs(a - s0) < 12) continue; // tower
      if (rng() < 0.18) continue;
      const b = sd * (W + 14 + rng() * 14);
      spots.push([a, b]);
      const r = rng();
      vehicle(a, b, r < 0.42 ? 'pickup' : r < 0.6 ? 'van' : r < 0.78 ? 'rv' : r < 0.94 ? 'hauler' : 'semi');
      // a few people hanging around each rig
      for (let k = 0; k < 3; k++) {
        if (rng() < 0.45) continue;
        const [x, z] = at(a + (rng() - 0.5) * 6, b - sd * (2.5 + rng() * 3));
        people.push({ x, y: 0, z, ry: hd + (rng() - 0.5) * 3, s: 0.92 + rng() * 0.14, color: col(shirt[Math.floor(rng() * shirt.length)]) });
      }
    }
  }
  // pop-up canopies + porta-johns + light towers
  const canopyCols = ['#d4231c', '#2a5ad2', '#f2f2ee', '#e8b030', '#3a8a4a'];
  for (let k = 0; k < 9; k++) {
    const [a, b] = spots[Math.floor(rng() * spots.length)];
    const sd = Math.sign(b), ca = a + 6, cb = b - sd * 4.5;
    for (const u of [-1.4, 1.4]) for (const v of [-1.4, 1.4]) box(ca + u, cb + v, 0, 0.06, 2.4, 0.06, '#cfcfcf');
    box(ca, cb, 2.4, 3.1, 0.35, 3.1, canopyCols[k % canopyCols.length]);
  }
  for (let k = 0; k < 5; k++) box(s0 - 95 + k * 1.6, -(W + 34), 0, 1.3, 2.3, 1.3, '#2f6ab0');
  const towers = [[s0 + 18, W + 6.5], [s0 + 18, -(W + 6.5)], [s1 - 30, W + 6.5], [s1 - 30, -(W + 6.5)]];
  const heads = [];
  for (const [a, b] of towers) {
    box(a, b, 0, 1.6, 0.9, 3.2, '#e0c020');
    box(a, b, 0.9, 0.2, 8.5, 0.2, '#8a8c8e');
    box(a, b, 9.2, 2.6, 0.25, 0.25, '#5a5c5e');
    const [x, z] = at(a, b);
    for (const k of [-0.9, -0.3, 0.3, 0.9]) {
      heads.push({ x: x + lx * k, y: 9.6, z: z + lz * k, ry: hd, s: 1 });
      if (night) world.addLamp(x + lx * k - Math.sign(b) * lx * 6, 9.4, z + lz * k - Math.sign(b) * lz * 6, '#fff4dc', 34, 0.7);
    }
  }
  scatter(world, new THREE.BoxGeometry(0.55, 0.45, 0.25), new THREE.MeshStandardMaterial({ color: 0x222222, emissive: col('#fff4dc'), emissiveIntensity: night ? 3 : 0.4 }), heads, { name: 'lamps' });
  // people: torso (instance-tinted) + legs/head
  {
    const body = new GeoBuilder();
    setColor(body, '#ffffff'); body.box(0, 0.86, 0, 0.44, 0.6, 0.26, 0);
    const legs = new GeoBuilder();
    setColor(legs, '#2a3550'); legs.box(-0.1, 0, 0, 0.16, 0.86, 0.2, 0); legs.box(0.1, 0, 0, 0.16, 0.86, 0.2, 0);
    setColor(legs, '#c08a68'); legs.box(0, 1.47, 0, 0.21, 0.24, 0.22, 0);
    setColor(legs, '#3a2a20'); legs.box(0, 1.68, 0, 0.23, 0.07, 0.24, 0);
    const pm = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8 });
    scatter(world, body.build(true), pm, people, { name: 'crowd' });
    scatter(world, legs.build(true), pm, people.map((o) => ({ ...o, color: null })), { name: 'crowd2' });
  }
  // cones along both edges + a staging line between the lanes
  {
    const cg = new GeoBuilder();
    setColor(cg, '#f25a12'); cg.cylinder(0, 0.05, 0, 0.17, 0.62, 8, 0.03);
    setColor(cg, '#f2f2ee'); cg.cylinder(0, 0.32, 0, 0.115, 0.12, 8, 0.095);
    setColor(cg, '#222'); cg.box(0, 0, 0, 0.4, 0.05, 0.4, 0);
    const cones = [];
    for (let a = s0 - 60; a < T.length - 40; a += 12) for (const sd of [-1, 1]) { const [x, z] = at(a, sd * (W + 1.3)); cones.push({ x, y: 0, z, ry: rng() * 3 }); }
    for (let a = s0 - 48; a < s0 - 10; a += 6) { const [x, z] = at(a, 0); cones.push({ x, y: 0, z, ry: rng() * 3 }); }
    for (let k = 0; k < 14; k++) { const [x, z] = at(T.length - 60 + k * 3, (k - 7) * 1.5); cones.push({ x, y: 0, z, ry: rng() * 3 }); }
    scatter(world, cg.build(true), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6 }), cones, { name: 'cones', cell: 400 });
  }
  // launch rubber + burnout box: dark decals on the lanes
  {
    const dg = new GeoBuilder();
    const quadOn = (a0, a1, b, w, k) => {
      const [x0, z0] = at(a0, b), [x1, z1] = at(a1, b);
      const A = new THREE.Vector3(x0 - lx * w / 2, 0.012, z0 - lz * w / 2), B = new THREE.Vector3(x0 + lx * w / 2, 0.012, z0 + lz * w / 2);
      const C = new THREE.Vector3(x1 + lx * w / 2, 0.012, z1 + lz * w / 2), D = new THREE.Vector3(x1 - lx * w / 2, 0.012, z1 - lz * w / 2);
      dg.setColor(k, k, k);
      dg.quad(A, D, C, B);
    };
    for (const lane of [-1, 1]) {
      const b = lane * W * 0.38;
      for (const t of [-0.8, 0.8]) quadOn(s0 - 2, s0 + 140, b + t, 0.5, 1);
      quadOn(s0 - 32, s0 - 12, b, 3.2, 0.6);
    }
    const g = dg.build(true);
    // fade the rubber out along the run via vertex alpha in uv.y
    const m = new THREE.MeshBasicMaterial({ color: 0x0a0a0a, transparent: true, opacity: 0.38, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 });
    const mesh = new THREE.Mesh(g, m);
    mesh.renderOrder = 1;
    world.add(mesh);
  }
  // misc flags
  for (const [a, b] of [[s0 - 6, -(W + 6)], [s0 - 6, W + 6], [s1 + 4, W + 6]]) {
    box(a, b, 0, 0.1, 6.5, 0.1, '#cfcfcf');
    const [x, z] = at(a, b);
    setColor(plain, '#d4231c');
    panel(plain, x + fx * 0.8, 5.2, z + fz * 0.8, lx, lz, 1.6, 1.0);
    panel(plain, x + fx * 0.8, 5.2, z + fz * 0.8, -lx, -lz, 1.6, 1.0);
  }
  void gyAt;
  const pm = new THREE.Mesh(plain.build(true), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7, metalness: 0.15 }));
  pm.castShadow = true;
  pm.receiveShadow = true;
  pm.name = 'dragstrip';
  world.add(pm);
  world.add(new THREE.Mesh(tex.build(), new THREE.MeshStandardMaterial({ map, emissive: 0xffffff, emissiveMap: emi, emissiveIntensity: night ? 2.2 : 1.1, roughness: 0.6, side: THREE.DoubleSide })));
}

// ------------------------------------------------------------------ build

export async function build(world, def, track, progress) {
  const P = plan(def, track);
  const T = track;
  T.shoulder = def.shoulder ?? 1.4;
  T.offSurface = def.offSurface || 'sand';
  const tm = [], t0 = performance.now();
  const mark = (k) => tm.push(k + ' ' + Math.round(performance.now() - t0));

  buildGround(world, P); mark('ground');
  backdrop(world, P);
  progress(0.15, 'BAKING THE SAND');
  await nextFrame();

  roadEdges(world, P); mark('edges');
  const rockTex = canvasTex(rockCanvas());
  const rockMat = desertMaterial(rockTex, P.look, 'rock'); mark('rocktex');
  if (P.canyons.length) canyonWalls(world, P, rockMat); mark('canyon');
  formations(world, P, rockMat); mark('forms');
  progress(0.35, 'RAISING BUTTES');
  await nextFrame();

  vegetation(world, P); mark('veg');
  progress(0.6, 'PLANTING SAGUAROS');
  await nextFrame();

  if (P.stop) truckStop(world, P); mark('stop');
  if (def.type === 'drag') dragStrip(world, P); mark('drag');
  if (P.washes.length) washDressing(world, P); mark('wash');
  if (def.type === 'sprint') finishGantry(world, P);
  if (P.look.tumbleweeds) tumbleweeds(world, P);
  if (def.poles) telephone(world, P); mark('poles');
  if (def.fence && !P.look.flat) fence(world, P); mark('fence');
  roadside(world, P); mark('roadside');
  progress(0.75, 'STRINGING THE WIRES');
  await nextFrame();

  setWalls(P);
  progress(1, 'DESERT READY');
  if (window.__desertTiming) console.log('desert build', tm.join(', '));
}

/** Collision walls: right-of-way fence in the open, rock in canyons. */
function setWalls(P) {
  const T = P.track;
  const fence = P.def.type === 'drag' ? T.W[0] + 9 : P.def.fence ?? 32;
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
  if (P.stop) {
    const st = P.stop, arr = st.side > 0 ? T.WL : T.WR;
    for (let i = 0; i < T.N; i++) {
      const k = 1 - smoothstep(62, 100, Math.abs(i * T.step - st.s));
      if (k > 0) arr[i] = Math.min(arr[i], arr[i] + (15 - arr[i]) * k);
    }
  }
  for (let i = 0; i < T.N; i++) {
    T.WL[i] = Math.max(T.WL[i], T.W[i] + T.shoulder + 0.8);
    T.WR[i] = Math.max(T.WR[i], T.W[i] + T.shoulder + 0.8);
  }
}

export default { natural, terrainOpts, build };
