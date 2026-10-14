// Highway: urban freeways after dark. Style 'interstate' is a divided freeway
// — jersey barriers, double-armed sodium median poles, wet shoulders — that
// climbs onto pier bents over a lit street grid and a river, runs a diamond
// interchange under overpasses and a flyover, and passes sound walls,
// billboards and pole signs toward a skyline glowing through the haze.
// Style 'expressway' is a Shuto-like elevated ring: one deck between high
// walls, towers alongside, a covered tube lit by tunnel lamps, a junction
// crossing overhead. Everything track-following is swept from cross-section
// profiles into per-chunk meshes so frustum culling keeps draw calls low.
import * as THREE from 'three';
import { glowMaterial } from '../build.js';
import { concreteTexture, groundTexture, facadeTextures, roadTextures, toTex, glowTexture, streakTexture } from '../textures.js';
import { GeoBuilder, instanced } from './common.js';
import { makeRng, clamp, smoothstep, nextFrame } from '../../core/util.js';

export const terrain = false;

const CHUNK = 640;        // m of main line per culling chunk
const SODIUM = '#ffa04a';
const P = 110;            // city block pitch (street centerline to centerline)
const CITY_LAMPS = [];    // lamp spots inside one block tile (tile-local meters)
for (const t of [P / 8, 3 * P / 8, 5 * P / 8, 7 * P / 8]) CITY_LAMPS.push([t, 7.8], [t, P - 7.8], [7.8, t], [P - 7.8, t]);

// ------------------------------------------------------------------ geometry

/** Geometry accumulator: positions, uvs, optional colors, indices. */
class Acc {
  constructor(colors = false) { this.p = []; this.uv = []; this.ix = []; this.c = colors ? [] : null; }
  get n() { return this.p.length / 3; }
  v(x, y, z, u, w, col) {
    this.p.push(x, y, z);
    this.uv.push(u, w);
    if (this.c) this.c.push(col ? col[0] : 1, col ? col[1] : 1, col ? col[2] : 1);
  }
  /** Quad a,b,c,d counter-clockwise seen from the front; uv rect [u0,v0,u1,v1]. */
  quad(a, b, c, d, r = [0, 0, 1, 1], col) {
    const n = this.n;
    this.v(a[0], a[1], a[2], r[0], r[1], col);
    this.v(b[0], b[1], b[2], r[2], r[1], col);
    this.v(c[0], c[1], c[2], r[2], r[3], col);
    this.v(d[0], d[1], d[2], r[0], r[3], col);
    this.ix.push(n, n + 1, n + 2, n, n + 2, n + 3);
  }
  geometry() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    if (this.c) g.setAttribute('color', new THREE.Float32BufferAttribute(this.c, 3));
    g.setIndex(this.n > 65535 ? new THREE.Uint32BufferAttribute(this.ix, 1) : new THREE.Uint16BufferAttribute(this.ix, 1));
    g.computeVertexNormals();
    return g;
  }
}

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const unit = (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const UP = [0, 1, 0];

/** Box around center c with right-handed axes (ax × ay = az) and half sizes. */
function obox(A, c, ax, ay, az, hx, hy, hz, uvm = 1, col) {
  const P3 = (sx, sy, sz) => [
    c[0] + ax[0] * sx * hx + ay[0] * sy * hy + az[0] * sz * hz,
    c[1] + ax[1] * sx * hx + ay[1] * sy * hy + az[1] * sz * hz,
    c[2] + ax[2] * sx * hx + ay[2] * sy * hy + az[2] * sz * hz,
  ];
  const fx = 2 * hx / uvm, fy = 2 * hy / uvm, fz = 2 * hz / uvm;
  A.quad(P3(1, -1, 1), P3(1, -1, -1), P3(1, 1, -1), P3(1, 1, 1), [0, 0, fz, fy], col);
  A.quad(P3(-1, -1, -1), P3(-1, -1, 1), P3(-1, 1, 1), P3(-1, 1, -1), [0, 0, fz, fy], col);
  A.quad(P3(-1, -1, 1), P3(1, -1, 1), P3(1, 1, 1), P3(-1, 1, 1), [0, 0, fx, fy], col);
  A.quad(P3(1, -1, -1), P3(-1, -1, -1), P3(-1, 1, -1), P3(1, 1, -1), [0, 0, fx, fy], col);
  A.quad(P3(-1, 1, 1), P3(1, 1, 1), P3(1, 1, -1), P3(-1, 1, -1), [0, 0, fx, fz], col);
  A.quad(P3(-1, -1, -1), P3(1, -1, -1), P3(1, -1, 1), P3(-1, -1, 1), [0, 0, fx, fz], col);
}

/** Square-section beam from p0 to p1. */
function beam(A, p0, p1, w, h, uvm = 1, col) {
  const d = sub(p1, p0);
  const len = Math.hypot(d[0], d[1], d[2]);
  const az = [d[0] / len, d[1] / len, d[2] / len];
  let ax = cross(UP, az);
  if (Math.hypot(ax[0], ax[1], ax[2]) < 1e-4) ax = cross([1, 0, 0], az);
  ax = unit(ax);
  const ay = cross(az, ax);
  obox(A, [(p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2, (p0[2] + p1[2]) / 2], ax, ay, az, w / 2, h / 2, len / 2, uvm, col);
}

/** Vertical prism/cylinder (smooth sides), optional top cap. */
function cyl(A, x, y0, z, r0, h, seg = 8, r1 = r0, cap = false, uvm = 2) {
  const v0 = A.n;
  for (let k = 0; k <= seg; k++) {
    const a = (k / seg) * Math.PI * 2, ca = Math.cos(a), sa = Math.sin(a);
    const u = (k / seg) * Math.PI * 2 * r0 / uvm;
    A.v(x + ca * r0, y0, z + sa * r0, u, 0);
    A.v(x + ca * r1, y0 + h, z + sa * r1, u, h / uvm);
  }
  for (let k = 0; k < seg; k++) {
    const b0 = v0 + k * 2, t0 = b0 + 1, b1 = b0 + 2, t1 = b0 + 3;
    A.ix.push(b1, b0, t0, b1, t0, t1);
  }
  if (cap) {
    const c = A.n;
    A.v(x, y0 + h, z, 0.5, 0.5);
    for (let k = 0; k <= seg; k++) {
      const a = (k / seg) * Math.PI * 2;
      A.v(x + Math.cos(a) * r1, y0 + h, z + Math.sin(a) * r1, 0.5 + Math.cos(a) * 0.5, 0.5 + Math.sin(a) * 0.5);
    }
    for (let k = 0; k < seg; k++) A.ix.push(c, c + k + 2, c + k + 1);
  }
}

// ------------------------------------------------------------------ frames

/**
 * The main line as a frame list, extended straight past a sprint's ends so the
 * freeway visibly continues. j = frame row, a = data index (wraps on loops).
 */
function mainFrame(track, ext) {
  const N = track.N, E = track.closed ? 0 : ext, M = N + 2 * E, step = track.step;
  const A = () => new Float32Array(M);
  const F = { N: M, E, step, closed: track.closed, X: A(), Z: A(), TX: A(), TZ: A(), LX: A(), LZ: A(), Y: A(), B: A(), W: A() };
  for (let j = 0; j < M; j++) {
    const i = clamp(j - E, 0, N - 1), d = (j - E - i) * step;
    F.X[j] = track.X[i] + track.TX[i] * d; F.Z[j] = track.Z[i] + track.TZ[i] * d;
    F.TX[j] = track.TX[i]; F.TZ[j] = track.TZ[i]; F.LX[j] = track.LX[i]; F.LZ[j] = track.LZ[i];
    F.Y[j] = track.Y[i]; F.B[j] = d ? 0 : track.B[i]; F.W[j] = track.W[i];
  }
  F.last = track.closed ? M : M - 1;
  F.at = track.closed ? (j) => ((j % M) + M) % M : (j) => clamp(j, 0, M - 1);
  F.s = (j) => (j - E) * step;
  F.y = (a, lat) => F.Y[a] + clamp(lat, -F.W[a], F.W[a]) * Math.tan(F.B[a]);
  return F;
}

/** A secondary road's frame from dense samples [[x, z, y, halfWidth], …]. */
function pathFrame(pts) {
  const n = pts.length;
  const A = () => new Float32Array(n);
  const F = { N: n, E: 0, closed: false, X: A(), Z: A(), TX: A(), TZ: A(), LX: A(), LZ: A(), Y: A(), W: A(), S: A() };
  for (let j = 0; j < n; j++) {
    F.X[j] = pts[j][0]; F.Z[j] = pts[j][1]; F.Y[j] = pts[j][2]; F.W[j] = pts[j][3];
    if (j) F.S[j] = F.S[j - 1] + Math.hypot(F.X[j] - F.X[j - 1], F.Z[j] - F.Z[j - 1]);
  }
  for (let j = 0; j < n; j++) {
    const a = Math.max(0, j - 1), b = Math.min(n - 1, j + 1);
    const tx = F.X[b] - F.X[a], tz = F.Z[b] - F.Z[a], l = Math.hypot(tx, tz) || 1;
    F.TX[j] = tx / l; F.TZ[j] = tz / l; F.LX[j] = F.TZ[j]; F.LZ[j] = -F.TX[j];
  }
  F.last = n - 1;
  F.at = (j) => clamp(j, 0, n - 1);
  F.s = (j) => F.S[clamp(j, 0, n - 1)];
  F.y = (a) => F.Y[a];
  return F;
}

function rowsOf(a, b, st) {
  const r = [];
  for (let j = a; j < b; j += st) r.push(j);
  r.push(b);
  return r;
}

/** Contiguous row ranges where pred(a, j) holds, padded one row each side. */
function runsOf(F, pred, ja = 0, jb = F.last) {
  const out = [];
  let st = -1;
  for (let j = ja; j <= jb; j++) {
    const on = pred(F.at(j), j);
    if (on && st < 0) st = j;
    else if (!on && st >= 0) { out.push([Math.max(ja, st - 1), j]); st = -1; }
  }
  if (st >= 0) out.push([Math.max(ja, st - 1), jb]);
  return out.filter(([a, b]) => b > a);
}

/**
 * Sweep a cross-section along frame rows. Profiles are authored for the LEFT
 * side, inner → outer and up/over the top: [o, y, abs?] where o is the
 * outward offset from base(a) and y is relative to the road surface at that
 * lat (flat past the edges), absolute when abs is set, or a function
 * (a, x, z) → y. side −1 mirrors and reverses (faces keep pointing the same
 * way relative to the road); side 0 takes o as a raw lat, in winding order.
 * Face normal = tangent × (next profile point − this one).
 */
function sweep(A, F, rows, side, base, pts, o = {}) {
  const np = pts.length, uS = o.uS ?? 1, vS = o.vS ?? 4, sy = o.uv === 'sy', y0 = o.y0 ?? 0;
  const v0 = A.n;
  const px = new Float64Array(np), py = new Float64Array(np), pz = new Float64Array(np), pl = new Float64Array(np);
  for (const j of rows) {
    const a = F.at(j), s = F.s(j);
    const b0 = typeof base === 'function' ? base(a) : base;
    for (let k = 0; k < np; k++) {
      const q = pts[k];
      const off = b0 + (typeof q[0] === 'function' ? q[0](a) : q[0]);
      const lat = side === 0 ? off : side * off;
      const x = F.X[a] + F.LX[a] * lat, z = F.Z[a] + F.LZ[a] * lat;
      const y = typeof q[1] === 'function' ? q[1](a, x, z) : q[2] ? q[1] : F.y(a, lat) + q[1];
      px[k] = x; py[k] = y; pz[k] = z;
      pl[k] = k ? pl[k - 1] + Math.hypot(x - px[k - 1], y - py[k - 1], z - pz[k - 1]) : 0;
    }
    const tot = pl[np - 1];
    for (let kk = 0; kk < np; kk++) {
      const k = side < 0 ? np - 1 - kk : kk;
      const u = sy ? (side < 0 ? -s : s) / uS : (o.flip ? tot - pl[k] : pl[k]) / uS;
      const v = sy ? (py[k] - y0) / vS : s / vS;
      A.v(px[k], py[k], pz[k], u, v, o.col);
    }
  }
  for (let r = 0; r < rows.length - 1; r++) {
    for (let k = 0; k < np - 1; k++) {
      const a = v0 + r * np + k, b = a + 1, d = a + np, e = d + 1;
      A.ix.push(a, d, b, b, d, e);
    }
  }
}

// cross-section profiles (left side, inner → outer)
const JERSEY = [
  [[0, 0], [0.05, 0.08], [0.16, 0.33], [0.21, 0.81]],
  [[0.21, 0.81], [0.39, 0.81]],
  [[0.39, 0.81], [0.44, 0.33], [0.55, 0.08], [0.6, 0]],
];
const MEDIAN = [
  [[0, 0], [0.06, 0.08], [0.21, 0.33], [0.3, 1.07]],
  [[0.3, 1.07], [0.5, 1.07]],
  [[0.5, 1.07], [0.59, 0.33], [0.74, 0.08], [0.8, 0]],
];
const FASCIA = (d) => [
  [[0, 0], [0.3, 0]],
  [[0.3, 0], [0.3, -0.5]],
  [[0.3, -0.5], [0.1, -0.62], [0.1, -d]],
];

/** Spatial hash of road corridors: is a point clear of every road? */
class KeepOut {
  constructor(cell = 24) { this.cell = cell; this.m = new Map(); }
  key(cx, cz) { return (cx + 30000) * 60000 + (cz + 30000); }
  /** Register a frame's rows (every `st`) with left/right half extents. */
  add(F, wl, wr, st = 2, id = 0) {
    const c = this.cell;
    for (let j = 0; j <= F.last; j += st) {
      const a = F.at(j);
      const e = { x: F.X[a], z: F.Z[a], tx: F.TX[a], tz: F.TZ[a], lx: F.LX[a], lz: F.LZ[a], wl: wl(a), wr: wr(a), h: F.step ? F.step * st * 0.5 + 0.5 : st * 2.5, id };
      const R = Math.max(e.wl, e.wr) + e.h + 12;
      const x0 = Math.floor((e.x - R) / c), x1 = Math.floor((e.x + R) / c);
      const z0 = Math.floor((e.z - R) / c), z1 = Math.floor((e.z + R) / c);
      for (let cx = x0; cx <= x1; cx++) {
        for (let cz = z0; cz <= z1; cz++) {
          const k = this.key(cx, cz);
          let l = this.m.get(k);
          if (!l) this.m.set(k, l = []);
          l.push(e);
        }
      }
    }
  }
  blocked(x, z, r = 0, skip = -1) {
    const l = this.m.get(this.key(Math.floor(x / this.cell), Math.floor(z / this.cell)));
    if (!l) return false;
    for (const e of l) {
      if (e.id === skip) continue;
      const dx = x - e.x, dz = z - e.z;
      if (Math.abs(dx * e.tx + dz * e.tz) > e.h + r) continue;
      const lat = dx * e.lx + dz * e.lz;
      if (lat < e.wl + r && lat > -e.wr - r) return true;
    }
    return false;
  }
}

// ------------------------------------------------------------------ textures

const memo = new Map();
const cached = (k, fn) => { if (!memo.has(k)) memo.set(k, fn()); return memo.get(k); };
function cvs(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}
function speckle(x, w, h, rng, amt, light = '220,220,220', dark = '0,0,0', size = 1) {
  const n = Math.floor(w * h * amt);
  for (let i = 0; i < n; i++) {
    x.fillStyle = `rgba(${rng() < 0.5 ? light : dark},${rng() * 0.22})`;
    x.fillRect(rng() * w, rng() * h, size, size);
  }
}
function blot(x, px, py, r, rgba) {
  const g = x.createRadialGradient(px, py, 0, px, py, r);
  g.addColorStop(0, rgba);
  g.addColorStop(1, rgba.replace(/[\d.]+\)$/, '0)'));
  x.fillStyle = g;
  x.fillRect(px - r, py - r, r * 2, r * 2);
}

/** Shoulder asphalt (u: 3 m from the road edge, v: 12 m) with a rumble strip. */
function shoulderTex(wet) {
  return cached('hw-shoulder' + wet, () => {
    const W = 128, H = 512;
    const c = cvs(W, H), x = c.getContext('2d');
    const r = cvs(W, H), rx = r.getContext('2d');
    const rng = makeRng('shoulder');
    x.fillStyle = '#37383b';
    x.fillRect(0, 0, W, H);
    rx.fillStyle = `rgb(0,${wet ? 85 : 210},0)`;
    rx.fillRect(0, 0, W, H);
    speckle(x, W, H, rng, 1.1);
    for (let i = 0; i < 9; i++) blot(x, rng() * W, rng() * H, 10 + rng() * 30, 'rgba(0,0,0,0.25)');
    for (let i = 0; i < 4; i++) { x.fillStyle = 'rgba(70,70,74,0.35)'; x.fillRect(rng() * W, rng() * H, 20 + rng() * 40, 30 + rng() * 60); }
    // milled rumble strip 0.25–0.7 m out from the edge line
    for (let v = 0; v < H; v += H / 40) {
      x.fillStyle = 'rgba(8,8,10,0.6)';
      x.fillRect(W * 0.085, v, W * 0.15, 4);
      rx.fillStyle = 'rgba(0,200,0,0.5)';
      rx.fillRect(W * 0.085, v, W * 0.15, 4);
    }
    // debris along the outer edge
    for (let i = 0; i < 160; i++) { x.fillStyle = `rgba(${rng() < 0.5 ? '120,110,90' : '20,20,20'},${0.3 + rng() * 0.4})`; x.fillRect(W * (0.7 + rng() * 0.3), rng() * H, 1 + rng() * 2, 1 + rng() * 2); }
    if (wet) for (let i = 0; i < 6; i++) blot(rx, W * (0.4 + rng() * 0.6), rng() * H, 14 + rng() * 26, 'rgba(0,10,0,1)');
    return { map: toTex(c), rough: toTex(r, { srgb: false }) };
  });
}

/** Sound/retaining wall panels: 32 m × 8 m, grime, water stains, graffiti. */
function wallTex() {
  return cached('hw-wall', () => {
    const W = 1024, H = 256;
    const c = cvs(W, H), x = c.getContext('2d');
    const rng = makeRng('soundwall');
    x.fillStyle = '#8c8981';
    x.fillRect(0, 0, W, H);
    for (let px = 0; px < W; px += 5) { x.fillStyle = `rgba(0,0,0,${0.04 + rng() * 0.08})`; x.fillRect(px, 0, 2, H); }
    speckle(x, W, H, rng, 0.5);
    for (let i = 0; i < 26; i++) blot(x, rng() * W, rng() * H, 20 + rng() * 60, `rgba(${rng() < 0.6 ? '40,36,30' : '160,150,130'},0.14)`);
    // panel joints every 4 m, horizontal course at ~2.5 m
    for (let px = 0; px < W; px += 128) {
      x.fillStyle = 'rgba(25,24,22,0.7)'; x.fillRect(px, 0, 5, H);
      x.fillStyle = 'rgba(255,255,255,0.09)'; x.fillRect(px + 5, 0, 3, H);
    }
    x.fillStyle = 'rgba(20,20,20,0.35)';
    x.fillRect(0, H - 82, W, 3);
    // water stains from the top
    for (let i = 0; i < 70; i++) {
      const sx = rng() * W, len = 30 + rng() * 150;
      const g = x.createLinearGradient(0, 0, 0, len);
      g.addColorStop(0, 'rgba(30,28,22,0.35)'); g.addColorStop(1, 'rgba(30,28,22,0)');
      x.fillStyle = g;
      x.fillRect(sx, 0, 1 + rng() * 5, len);
    }
    // road spray along the bottom
    const g = x.createLinearGradient(0, H, 0, H * 0.55);
    g.addColorStop(0, 'rgba(18,16,12,0.7)'); g.addColorStop(1, 'rgba(18,16,12,0)');
    x.fillStyle = g;
    x.fillRect(0, H * 0.55, W, H * 0.45);
    // graffiti tags
    const words = ['KRS', 'NOVA', 'DUSK', 'ZERO', 'KAOS', 'MIDNITE', 'HALCYON', 'VANDL', 'SK8', 'RIOT', 'BLVD', 'ONE'];
    const cols = ['#d23a8a', '#3ab0e0', '#f0d040', '#e05a2a', '#60d060', '#f4f4f4', '#9a5ae0', '#ff7a2a'];
    for (let i = 0; i < 9; i++) {
      const w = words[Math.floor(rng() * words.length)];
      const px = 40 + rng() * (W - 220), py = H - 30 - rng() * 70;
      const sz = 26 + rng() * 26;
      x.save();
      x.translate(px, py);
      x.rotate((rng() - 0.5) * 0.25);
      x.font = `italic bold ${sz}px "Liberation Sans", Arial, sans-serif`;
      x.lineJoin = 'round';
      x.lineWidth = sz * 0.22;
      x.strokeStyle = rng() < 0.5 ? '#141414' : cols[Math.floor(rng() * cols.length)];
      x.strokeText(w, 0, 0);
      x.fillStyle = cols[Math.floor(rng() * cols.length)];
      x.fillText(w, 0, 0);
      x.lineWidth = 1.5;
      x.strokeStyle = 'rgba(255,255,255,0.6)';
      x.strokeText(w, 0, 0);
      x.restore();
    }
    // scrawls
    x.lineWidth = 2;
    for (let i = 0; i < 14; i++) {
      x.strokeStyle = cols[Math.floor(rng() * cols.length)];
      x.globalAlpha = 0.7;
      x.beginPath();
      let px = rng() * W, py = H - 20 - rng() * 60;
      x.moveTo(px, py);
      for (let k = 0; k < 6; k++) { px += 6 + rng() * 14; py += (rng() - 0.5) * 22; x.lineTo(px, py); }
      x.stroke();
    }
    x.globalAlpha = 1;
    return toTex(c);
  });
}

/** Corrugated metal cladding (tube exteriors, sign backs). 8 m × 8 m. */
function panelTex() {
  return cached('hw-panel', () => {
    const W = 256, H = 256;
    const c = cvs(W, H), x = c.getContext('2d');
    const rng = makeRng('panel');
    x.fillStyle = '#7d8580';
    x.fillRect(0, 0, W, H);
    for (let px = 0; px < W; px += 4) { x.fillStyle = px % 8 ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.16)'; x.fillRect(px, 0, 2, H); }
    for (let py = 0; py < H; py += 64) { x.fillStyle = 'rgba(20,22,22,0.6)'; x.fillRect(0, py, W, 3); }
    speckle(x, W, H, rng, 0.4);
    for (let i = 0; i < 30; i++) {
      const sx = rng() * W, len = 20 + rng() * 120;
      const g = x.createLinearGradient(0, 0, 0, len);
      g.addColorStop(0, 'rgba(90,50,20,0.35)'); g.addColorStop(1, 'rgba(90,50,20,0)');
      x.fillStyle = g;
      x.fillRect(sx, rng() * H, 2 + rng() * 3, len);
    }
    return toTex(c);
  });
}

/** One city block tile (P × P m): streets on the edges, lamp pools in the emissive map. */
function cityTile() {
  return cached('hw-city', () => {
    const S = 512, k = S / P;
    const c = cvs(S, S), x = c.getContext('2d');
    const e = cvs(S, S), ex = e.getContext('2d');
    const rng = makeRng('citytile');
    x.fillStyle = '#27282a';
    x.fillRect(0, 0, S, S);
    speckle(x, S, S, rng, 0.5);
    // lot interiors: parking rows, patches
    for (let i = 0; i < 18; i++) { x.fillStyle = `rgba(${rng() < 0.5 ? '60,60,62' : '18,18,20'},0.35)`; x.fillRect(12 * k + rng() * 70 * k, 12 * k + rng() * 70 * k, (6 + rng() * 22) * k, (6 + rng() * 22) * k); }
    x.strokeStyle = 'rgba(200,200,190,0.25)';
    x.lineWidth = 1;
    for (let i = 0; i < 24; i++) { const px = (20 + i * 2.8) * k; x.beginPath(); x.moveTo(px, 60 * k); x.lineTo(px, 66 * k); x.stroke(); }
    const band = (a, b, col) => {
      x.fillStyle = col;
      x.fillRect(0, a * k, S, (b - a) * k); x.fillRect(0, S - b * k, S, (b - a) * k);
      x.fillRect(a * k, 0, (b - a) * k, S); x.fillRect(S - b * k, 0, (b - a) * k, S);
    };
    band(7, 10, '#4b4b4c');
    band(0, 7, '#2f3033');
    // curbs
    x.fillStyle = '#6a6a68';
    band(6.85, 7.15, '#6a6a68');
    // re-darken intersections (corner squares)
    for (const [cx, cz] of [[0, 0], [S - 10 * k, 0], [0, S - 10 * k], [S - 10 * k, S - 10 * k]]) { x.fillStyle = '#2e2f32'; x.fillRect(cx, cz, 10 * k, 10 * k); }
    speckle(x, S, S, rng, 0.25);
    // markings: double yellow on the tile edges (street centers), dashed lanes, crosswalks
    x.fillStyle = 'rgba(214,170,48,0.8)';
    x.fillRect(10 * k, 0, S - 20 * k, 0.12 * k); x.fillRect(10 * k, S - 0.12 * k, S - 20 * k, 0.12 * k);
    x.fillRect(0, 10 * k, 0.12 * k, S - 20 * k); x.fillRect(S - 0.12 * k, 10 * k, 0.12 * k, S - 20 * k);
    x.fillStyle = 'rgba(230,230,220,0.6)';
    for (let t = 14; t < P - 14; t += 9) {
      x.fillRect(t * k, 3.5 * k, 3 * k, 0.12 * k); x.fillRect(t * k, S - 3.5 * k, 3 * k, 0.12 * k);
      x.fillRect(3.5 * k, t * k, 0.12 * k, 3 * k); x.fillRect(S - 3.5 * k, t * k, 0.12 * k, 3 * k);
    }
    for (let t = 0.6; t < 6.5; t += 1.2) {
      x.fillRect(t * k, 10.5 * k, 0.6 * k, 2.6 * k); x.fillRect(t * k, S - 13.1 * k, 0.6 * k, 2.6 * k);
      x.fillRect(S - (t + 0.6) * k, 10.5 * k, 0.6 * k, 2.6 * k); x.fillRect(S - (t + 0.6) * k, S - 13.1 * k, 0.6 * k, 2.6 * k);
      x.fillRect(10.5 * k, t * k, 2.6 * k, 0.6 * k); x.fillRect(S - 13.1 * k, t * k, 2.6 * k, 0.6 * k);
      x.fillRect(10.5 * k, S - (t + 0.6) * k, 2.6 * k, 0.6 * k); x.fillRect(S - 13.1 * k, S - (t + 0.6) * k, 2.6 * k, 0.6 * k);
    }
    // emissive: sodium pools under every lamp + faint street wash
    ex.fillStyle = '#000';
    ex.fillRect(0, 0, S, S);
    ex.globalCompositeOperation = 'lighter';
    for (const [lx, lz] of CITY_LAMPS) blot(ex, lx * k, (P - lz) * k, 14 * k, 'rgba(255,150,70,0.55)');
    for (const [lx, lz] of CITY_LAMPS) blot(ex, lx * k, (P - lz) * k, 5 * k, 'rgba(255,190,120,0.35)');
    ex.globalCompositeOperation = 'source-over';
    return { map: toTex(c), emi: toTex(e) };
  });
}

/** Shelf-packed canvas atlas (signs, ads). */
class Atlas {
  constructor(W, H, ppm) {
    this.W = W; this.H = H; this.ppm = ppm;
    this.c = cvs(W, H);
    this.x = this.c.getContext('2d');
    this.cx = 2; this.cy = 2; this.rowH = 0;
  }
  alloc(wm, hm) {
    const w = Math.ceil(wm * this.ppm), h = Math.ceil(hm * this.ppm);
    if (this.cx + w > this.W - 2) { this.cx = 2; this.cy += this.rowH + 4; this.rowH = 0; }
    const r = { px: this.cx, py: this.cy, w, h };
    this.cx += w + 4;
    this.rowH = Math.max(this.rowH, h);
    r.uv = [r.px / this.W, 1 - (r.py + h) / this.H, (r.px + w) / this.W, 1 - r.py / this.H];
    return r;
  }
}

const SIGN_FONT = '"Liberation Sans", Arial, sans-serif';

function roundRect(x, px, py, w, h, r) {
  x.beginPath();
  x.moveTo(px + r, py);
  x.arcTo(px + w, py, px + w, py + h, r);
  x.arcTo(px + w, py + h, px, py + h, r);
  x.arcTo(px, py + h, px, py, r);
  x.arcTo(px, py, px + w, py, r);
  x.closePath();
}

/** Text squeezed to fit maxW, condensed like highway lettering. */
function signText(x, str, cx, cy, size, maxW, color = '#f4f6f2', weight = 'bold') {
  x.save();
  x.font = `${weight} ${size}px ${SIGN_FONT}`;
  const w = x.measureText(str).width * 0.84;
  const sq = Math.min(0.84, 0.84 * maxW / Math.max(1, w));
  x.translate(cx, cy);
  x.scale(sq, 1);
  x.fillStyle = color;
  x.textAlign = 'center';
  x.textBaseline = 'middle';
  x.fillText(str, 0, 0);
  x.restore();
}

/** Interstate shield (red crown band, blue body) centered at cx, cy with height h. */
function shield(x, cx, cy, h, num, kind = 'I') {
  const w = h * 0.92;
  const path = (s) => {
    const hw = (w / 2) * s, hh = (h / 2) * s;
    x.beginPath();
    x.moveTo(cx - hw, cy - hh * 0.78);
    x.quadraticCurveTo(cx - hw * 0.5, cy - hh * 1.08, cx, cy - hh * 0.86);
    x.quadraticCurveTo(cx + hw * 0.5, cy - hh * 1.08, cx + hw, cy - hh * 0.78);
    x.bezierCurveTo(cx + hw * 1.04, cy + hh * 0.2, cx + hw * 0.62, cy + hh * 0.72, cx, cy + hh);
    x.bezierCurveTo(cx - hw * 0.62, cy + hh * 0.72, cx - hw * 1.04, cy + hh * 0.2, cx - hw, cy - hh * 0.78);
    x.closePath();
  };
  if (kind === 'C') {
    // expressway route badge: rounded hexagon
    x.fillStyle = '#f4f4f0';
    roundRect(x, cx - w / 2, cy - h / 2, w, h, h * 0.18);
    x.fill();
    x.fillStyle = '#1a4fa0';
    roundRect(x, cx - w / 2 + h * 0.07, cy - h / 2 + h * 0.07, w - h * 0.14, h - h * 0.14, h * 0.14);
    x.fill();
    signText(x, num, cx, cy + h * 0.03, h * 0.58, w * 0.8);
    return;
  }
  path(1);
  x.fillStyle = '#f4f4f0';
  x.fill();
  x.save();
  path(0.88);
  x.clip();
  x.fillStyle = '#1b3f9a';
  x.fillRect(cx - w, cy - h, w * 2, h * 2);
  x.fillStyle = '#c4202a';
  x.fillRect(cx - w, cy - h, w * 2, h * 0.27 + h / 2 - h * 0.05);
  x.restore();
  x.fillStyle = '#f4f4f0';
  x.fillRect(cx - w * 0.46, cy - h * 0.25, w * 0.92, h * 0.035);
  signText(x, 'INTERSTATE', cx, cy - h * 0.34, h * 0.11, w * 0.62);
  signText(x, num, cx, cy + h * 0.14, h * 0.48, w * 0.7);
}

function arrow(x, cx, cy, size, dir, color = '#f4f6f2') {
  x.save();
  x.translate(cx, cy);
  x.rotate({ down: Math.PI, up: 0, upright: Math.PI / 4, upleft: -Math.PI / 4, right: Math.PI / 2, left: -Math.PI / 2 }[dir] ?? 0);
  x.fillStyle = color;
  const s = size;
  x.beginPath();
  x.moveTo(0, -s * 0.5);
  x.lineTo(s * 0.32, -s * 0.12);
  x.lineTo(s * 0.1, -s * 0.12);
  x.lineTo(s * 0.1, s * 0.5);
  x.lineTo(-s * 0.1, s * 0.5);
  x.lineTo(-s * 0.1, -s * 0.12);
  x.lineTo(-s * 0.32, -s * 0.12);
  x.closePath();
  x.fill();
  x.restore();
}

/**
 * Draw one guide sign panel into an atlas rect. p: { w, h, lines, sub, shield,
 * dir, arrow, only, kind: 'C' for expressway badges, color }.
 */
function drawPanel(at, r, p) {
  const x = at.x, k = at.ppm;
  const { px, py, w, h } = r;
  const green = p.color || '#0b6a3a';
  x.fillStyle = green;
  roundRect(x, px, py, w, h, 0.22 * k);
  x.fill();
  x.strokeStyle = '#eef2ee';
  x.lineWidth = 0.07 * k;
  roundRect(x, px + 0.1 * k, py + 0.1 * k, w - 0.2 * k, h - 0.2 * k, 0.16 * k);
  x.stroke();
  // light grime
  const g = x.createLinearGradient(0, py, 0, py + h);
  g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(10,20,10,0.25)');
  x.fillStyle = g;
  x.fillRect(px, py, w, h);
  let top = py + 0.28 * k;
  let bottom = py + h - 0.22 * k;
  if (p.only) {
    const bh = 0.62 * k;
    x.fillStyle = '#f2c518';
    x.fillRect(px + 0.18 * k, py + h - 0.18 * k - bh, w - 0.36 * k, bh);
    signText(x, 'EXIT ONLY', px + w / 2, py + h - 0.18 * k - bh / 2, 0.42 * k, w * 0.8, '#111');
    bottom -= bh + 0.06 * k;
  }
  let left = px + 0.3 * k, right = px + w - 0.3 * k;
  if (p.shield) {
    const sh = Math.min(1.5 * k, (bottom - top) * 0.62);
    const scx = left + sh * 0.55;
    shield(x, scx, top + sh * 0.55, sh, p.shield, p.kind);
    if (p.dir) signText(x, p.dir, scx, top + sh * 1.22, 0.36 * k, sh * 1.2);
    left = scx + sh * 0.6;
  }
  if (p.arrow === 'upright' || p.arrow === 'right' || p.arrow === 'left') {
    const as = Math.min(1.1 * k, (bottom - top) * 0.7);
    if (p.arrow === 'left') { arrow(x, left + as * 0.4, (top + bottom) / 2, as, p.arrow); left += as * 0.85; }
    else { arrow(x, right - as * 0.4, (top + bottom) / 2, as, p.arrow); right -= as * 0.85; }
  }
  const lines = p.lines || [];
  let avail = bottom - top;
  if (p.arrow === 'down' || p.arrow === 'down2') avail -= 0.8 * k;
  if (p.sub) avail -= 0.55 * k;
  const lh = Math.min(0.7 * k, avail / Math.max(1, lines.length));
  let y = top + lh / 2;
  for (const ln of lines) {
    signText(x, ln, (left + right) / 2, y, lh * 0.82, right - left);
    y += lh;
  }
  if (p.sub) { signText(x, p.sub, (left + right) / 2, y + 0.2 * k, 0.46 * k, right - left); y += 0.55 * k; }
  if (p.arrow === 'down' || p.arrow === 'down2') {
    const n = p.arrow === 'down2' ? 2 : 1;
    for (let i = 0; i < n; i++) arrow(x, px + w * (n === 1 ? 0.5 : 0.3 + i * 0.4), bottom - 0.38 * k, 0.72 * k, 'down');
  }
}

/** Exit number tab that sits on top of a panel. */
function drawTab(at, r, txt) {
  const x = at.x, k = at.ppm;
  x.fillStyle = '#0b6a3a';
  roundRect(x, r.px, r.py, r.w, r.h + 0.2 * k, 0.16 * k);
  x.fill();
  x.strokeStyle = '#eef2ee';
  x.lineWidth = 0.06 * k;
  roundRect(x, r.px + 0.08 * k, r.py + 0.08 * k, r.w - 0.16 * k, r.h, 0.12 * k);
  x.stroke();
  signText(x, txt, r.px + r.w / 2, r.py + r.h * 0.55, r.h * 0.6, r.w * 0.86);
}

const ADS = [
  ['NITRO-X', 'ENERGY YOU CAN TASTE', '#0a2a5a', '#ffcc00'],
  ['KUROSHIO TIRES', 'GRIP IS EVERYTHING', '#141414', '#ff3a3a'],
  ['MIDNIGHT 88.1', 'THE UNDERGROUND SOUND', '#2a0a3a', '#ff44aa'],
  ['RAZOR FUEL', 'RACE GAS · 104 OCTANE', '#3a0a0a', '#ff8a00'],
  ['HALCYON BANK', 'MONEY NEVER SLEEPS', '#06324a', '#36d0ff'],
  ['STATIC MOBILE', 'TEXT ALL NIGHT', '#003a3a', '#00e0c0'],
  ['BURGER BARN', 'NEXT EXIT · OPEN 24H', '#5a1a00', '#ffd000'],
  ['VOLTA MOTORS', 'THE NEW GT IS HERE', '#101418', '#e8e8e8'],
  ['KAIJU COLA', 'MONSTER REFRESHMENT', '#4a0010', '#ff2a4a'],
  ['ORBIT AIR', 'FLY BEYOND THE CITY', '#0a1f4a', '#7ab0ff'],
];
const POLE_ADS = [['GAS', '24 HRS', '#c81e1e', '#ffffff'], ['MOTEL', 'VACANCY', '#1a1a5a', '#ff4a8a'], ['DINER', 'EAT', '#0a4a2a', '#ffe14a'], ['BURGER', 'BARN', '#8a2a00', '#ffd000'], ['TIRES', 'OIL', '#1a1a1a', '#ffb000'], ['LIQUOR', 'BEER', '#2a0a3a', '#30e0ff']];

function drawAd(at, r, ad, rng) {
  const x = at.x;
  const { px, py, w, h } = r;
  const g = x.createLinearGradient(px, py, px + w, py + h);
  g.addColorStop(0, ad[2]);
  g.addColorStop(1, '#000');
  x.fillStyle = g;
  x.fillRect(px, py, w, h);
  x.fillStyle = ad[3];
  x.fillRect(px, py + h * 0.82, w, h * 0.18);
  // product blob
  blot(x, px + w * 0.82, py + h * 0.42, h * 0.42, `rgba(255,255,255,0.18)`);
  x.save();
  x.font = `italic 900 ${Math.round(h * 0.34)}px ${SIGN_FONT}`;
  x.fillStyle = '#fff';
  x.textBaseline = 'middle';
  const tw = x.measureText(ad[0]).width;
  const sq = Math.min(1, (w * 0.9) / tw);
  x.translate(px + w * 0.05, py + h * 0.36);
  x.scale(sq, 1);
  x.fillText(ad[0], 0, 0);
  x.restore();
  x.font = `bold ${Math.round(h * 0.13)}px ${SIGN_FONT}`;
  x.fillStyle = '#eee';
  x.textBaseline = 'middle';
  x.fillText(ad[1], px + w * 0.05, py + h * 0.66, w * 0.9);
  x.fillStyle = '#000';
  x.font = `bold ${Math.round(h * 0.1)}px ${SIGN_FONT}`;
  x.fillText('WWW.' + ad[0].split(' ')[0] + '.COM', px + w * 0.05, py + h * 0.91, w * 0.9);
  speckle(x, w, h, rng, 0.02);
}

function drawPoleAd(at, r, ad) {
  const x = at.x;
  const { px, py, w, h } = r;
  x.fillStyle = ad[2];
  x.fillRect(px, py, w, h);
  x.strokeStyle = ad[3];
  x.lineWidth = h * 0.06;
  x.strokeRect(px + h * 0.06, py + h * 0.06, w - h * 0.12, h - h * 0.12);
  signText(x, ad[0], px + w / 2, py + h * 0.42, h * 0.42, w * 0.8, ad[3], '900');
  signText(x, ad[1], px + w / 2, py + h * 0.76, h * 0.2, w * 0.8, '#fff');
}

// ------------------------------------------------------------------ lights

/** One draw call for every lamp halo: camera-facing quads with their own haze. */
function haloMesh(list, fogD) {
  const base = new THREE.PlaneGeometry(1, 1);
  const g = new THREE.InstancedBufferGeometry();
  g.index = base.index;
  g.setAttribute('position', base.attributes.position);
  g.setAttribute('uv', base.attributes.uv);
  const n = list.length;
  const ip = new Float32Array(n * 3), ic = new Float32Array(n * 3), is = new Float32Array(n * 2);
  list.forEach((h, k) => {
    ip[k * 3] = h.x; ip[k * 3 + 1] = h.y; ip[k * 3 + 2] = h.z;
    ic[k * 3] = h.c.r; ic[k * 3 + 1] = h.c.g; ic[k * 3 + 2] = h.c.b;
    is[k * 2] = h.s; is[k * 2 + 1] = h.f ?? 0.55;
  });
  g.setAttribute('ipos', new THREE.InstancedBufferAttribute(ip, 3));
  g.setAttribute('icol', new THREE.InstancedBufferAttribute(ic, 3));
  g.setAttribute('isz', new THREE.InstancedBufferAttribute(is, 2));
  g.instanceCount = n;
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { map: { value: glowTexture() }, fogD: { value: fogD } },
    vertexShader: `
      attribute vec3 ipos; attribute vec3 icol; attribute vec2 isz;
      uniform float fogD; varying vec2 vUv; varying vec3 vCol;
      void main(){
        vec4 mv = modelViewMatrix * vec4(ipos, 1.0);
        float d = max(-mv.z, 0.1);
        float sz = max(isz.x, d * 0.006);
        mv.xy += position.xy * sz;
        vUv = uv;
        float f = exp(-pow(fogD * d * isz.y, 2.0));
        vCol = icol * f * (0.45 + 0.55 * isz.x / sz);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `
      uniform sampler2D map; varying vec2 vUv; varying vec3 vCol;
      void main(){ float a = texture2D(map, vUv).a; gl_FragColor = vec4(vCol * a * a, 1.0); }`,
  });
  const m = new THREE.Mesh(g, mat);
  m.frustumCulled = false;
  m.renderOrder = 2;
  return m;
}

/** Light columns on water under each source (like the wet-road streaks). */
function waterStreaks(world, src, wy) {
  const base = new THREE.PlaneGeometry(1, 1);
  base.translate(0, 0.5, 0);
  const g = new THREE.InstancedBufferGeometry();
  g.index = base.index;
  g.setAttribute('position', base.attributes.position);
  g.setAttribute('uv', base.attributes.uv);
  const n = src.length;
  const ip = new Float32Array(n * 3), ic = new Float32Array(n * 3), is = new Float32Array(n);
  src.forEach((s, k) => {
    ip[k * 3] = s.x; ip[k * 3 + 1] = wy + 0.03; ip[k * 3 + 2] = s.z;
    ic[k * 3] = s.c.r; ic[k * 3 + 1] = s.c.g; ic[k * 3 + 2] = s.c.b;
    is[k] = s.s;
  });
  g.setAttribute('ipos', new THREE.InstancedBufferAttribute(ip, 3));
  g.setAttribute('icol', new THREE.InstancedBufferAttribute(ic, 3));
  g.setAttribute('isz', new THREE.InstancedBufferAttribute(is, 1));
  g.instanceCount = n;
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { map: { value: streakTexture() }, camPos: { value: new THREE.Vector3() }, t: { value: 0 } },
    vertexShader: `
      attribute vec3 ipos; attribute vec3 icol; attribute float isz;
      uniform vec3 camPos; uniform float t; varying vec2 vUv; varying vec3 vCol; varying float vFade;
      void main(){
        vec3 toCam = camPos - ipos; toCam.y = 0.0;
        float dist = length(toCam);
        vec3 dir = toCam / max(dist, 0.001);
        vec3 side = vec3(dir.z, 0.0, -dir.x);
        float len = min(dist * 0.5, 60.0) * isz;
        float wob = sin(t * 1.7 + ipos.x * 0.3 + position.y * 9.0) * 0.35;
        vec3 p = ipos + side * (position.x + wob) * 2.2 * isz + dir * (position.y * len);
        vUv = uv; vCol = icol; vFade = (1.0 - smoothstep(250.0, 700.0, dist));
        gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
      }`,
    fragmentShader: `
      uniform sampler2D map; varying vec2 vUv; varying vec3 vCol; varying float vFade;
      void main(){ float a = texture2D(map, vUv).a; gl_FragColor = vec4(vCol * a * vFade * 1.6, 1.0); }`,
  });
  const m = new THREE.Mesh(g, mat);
  m.frustumCulled = false;
  m.renderOrder = 3;
  world.add(m);
  world.animators.push((dt, cam) => { mat.uniforms.camPos.value.copy(cam.position); mat.uniforms.t.value += dt; });
}

/** Fog that thins out with distance — for the skyline far off in the haze. */
function weakFog(mat, k) {
  mat.onBeforeCompile = (sh) => {
    sh.fragmentShader = sh.fragmentShader.replace('#include <fog_fragment>', `
      #ifdef USE_FOG
        float fogFactor = 1.0 - exp( - fogDensity * fogDensity * vFogDepth * vFogDepth * ${(k * k).toFixed(4)} );
        gl_FragColor.rgb = mix( gl_FragColor.rgb, fogColor, fogFactor );
      #endif`);
  };
  mat.customProgramCacheKey = () => 'hw-weakfog' + k;
  return mat;
}
