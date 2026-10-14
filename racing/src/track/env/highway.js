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
import { concreteTexture, groundTexture, facadeTextures, toTex, glowTexture, streakTexture } from '../textures.js';
import { GeoBuilder, instanced } from './common.js';
import { makeRng, clamp, smoothstep, nextFrame } from '../../core/util.js';

export const terrain = false;

const CHUNK = 640;        // m of main line per culling chunk
const SODIUM = '#ffa04a';
const P = 110;            // city block pitch (street centerline to centerline)
const CITY_LAMPS = [];    // lamp spots inside one block tile (tile-local meters), staggered across streets
for (let k = 0; k < 4; k++) {
  const a = (P * (k + 0.25)) / 4, b = (P * (k + 0.75)) / 4;
  CITY_LAMPS.push([a, 7.8], [b, P - 7.8], [7.8, b], [P - 7.8, a]);
}

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
      const u = sy ? (side < 0 ? -s : s) / uS : (o.mirror ? Math.min(pl[k], tot - pl[k]) : o.flip ? tot - pl[k] : pl[k]) / uS;
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
  [[0, 0], [0.13, 0.28], [0.21, 0.81]],
  [[0.21, 0.81], [0.39, 0.81]],
  [[0.39, 0.81], [0.6, 0]],
];
const MEDIAN = [
  [[0, 0], [0.18, 0.3], [0.3, 1.07]],
  [[0.3, 1.07], [0.5, 1.07]],
  [[0.5, 1.07], [0.62, 0.3], [0.8, 0]],
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
/** Per-pixel grain (ImageData — much faster than thousands of fillRects). */
function speckle(x, w, h, rng, amt, strength = 0.22) {
  const img = x.getImageData(0, 0, w, h), d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    if (rng() > amt) continue;
    const k = 1 + (rng() * 2 - 1) * strength;
    d[i] *= k; d[i + 1] *= k; d[i + 2] *= k;
  }
  x.putImageData(img, 0, 0);
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
    speckle(x, W, H, rng, 0.9, 0.3);
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

/** Sound/retaining wall panels: 64 m × 8 m, grime, water stains, graffiti. */
function wallTex() {
  return cached('hw-wall', () => {
    const W = 2048, H = 256;
    const c = cvs(W, H), x = c.getContext('2d');
    const rng = makeRng('soundwall');
    x.fillStyle = '#8c8981';
    x.fillRect(0, 0, W, H);
    for (let px = 0; px < W; px += 5) { x.fillStyle = `rgba(0,0,0,${0.04 + rng() * 0.08})`; x.fillRect(px, 0, 2, H); }
    speckle(x, W, H, rng, 0.6, 0.25);
    for (let i = 0; i < 50; i++) blot(x, rng() * W, rng() * H, 20 + rng() * 60, `rgba(${rng() < 0.6 ? '40,36,30' : '160,150,130'},0.14)`);
    // panel joints every 4 m, horizontal course at ~2.5 m
    for (let px = 0; px < W; px += 128) {
      x.fillStyle = 'rgba(25,24,22,0.7)'; x.fillRect(px, 0, 5, H);
      x.fillStyle = 'rgba(255,255,255,0.09)'; x.fillRect(px + 5, 0, 3, H);
    }
    x.fillStyle = 'rgba(20,20,20,0.35)';
    x.fillRect(0, H - 82, W, 3);
    // water stains from the top
    for (let i = 0; i < 140; i++) {
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
    for (let i = 0; i < 14; i++) {
      const w = words[Math.floor(rng() * words.length)];
      const px = 40 + (i + rng() * 0.6) * (W - 260) / 14, py = H - 30 - rng() * 70;
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
    for (let i = 0; i < 26; i++) {
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
    speckle(x, W, H, rng, 0.5, 0.2);
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
    speckle(x, S, S, rng, 0.7, 0.35);
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
    ex.fillStyle = 'rgba(255,140,60,0.09)';
    ex.fillRect(0, 0, S, 10 * k); ex.fillRect(0, S - 10 * k, S, 10 * k);
    ex.fillRect(0, 10 * k, 10 * k, S - 20 * k); ex.fillRect(S - 10 * k, 10 * k, 10 * k, S - 20 * k);
    for (const [lx, lz] of CITY_LAMPS) blot(ex, lx * k, (P - lz) * k, 12 * k, 'rgba(255,150,70,0.5)');
    for (const [lx, lz] of CITY_LAMPS) blot(ex, lx * k, (P - lz) * k, 4.5 * k, 'rgba(255,190,120,0.3)');
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

/** Black-on-yellow curve chevron pointing 'L' or 'R'. */
function drawChevron(at, r, dir) {
  const x = at.x;
  const { px, py, w, h } = r;
  x.fillStyle = '#f2c518';
  x.fillRect(px, py, w, h);
  x.fillStyle = '#111';
  const sg = dir === 'L' ? -1 : 1, cx = px + w / 2, cy = py + h / 2;
  x.beginPath();
  x.moveTo(cx - sg * w * 0.28, cy - h * 0.38);
  x.lineTo(cx + sg * w * 0.22, cy);
  x.lineTo(cx - sg * w * 0.28, cy + h * 0.38);
  x.lineTo(cx - sg * w * 0.05, cy + h * 0.38);
  x.lineTo(cx + sg * w * 0.45, cy);
  x.lineTo(cx - sg * w * 0.05, cy - h * 0.38);
  x.closePath();
  x.fill();
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
  void rng;
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
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
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

/** Wet-road reflection column: soft at both ends (v = 1 is the end nearest the viewer). */
function softStreakTex() {
  return cached('hw-streak', () => {
    const W = 32, H = 256;
    const c = cvs(W, H), x = c.getContext('2d');
    const img = x.createImageData(W, H), d = img.data;
    for (let py = 0; py < H; py++) {
      const t = py / (H - 1); // 0 = viewer end, 1 = under the light
      const along = smoothstep(0, 0.45, t) * smoothstep(1, 0.8, t);
      for (let px = 0; px < W; px++) {
        const u = (px / (W - 1)) * 2 - 1;
        const a = along * Math.exp(-u * u * 4.5);
        const k = (py * W + px) * 4;
        d[k] = d[k + 1] = d[k + 2] = 255;
        d[k + 3] = Math.round(a * 255);
      }
    }
    x.putImageData(img, 0, 0);
    return toTex(c, { repeat: false });
  });
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

// ------------------------------------------------------------------ props

/** Light pole geometries (local +x = arm direction, base at the origin). */
function poleGeo(kind) {
  const A = new Acc();
  if (kind === 'double') {
    cyl(A, 0, 0, 0, 0.24, 0.4, 8, 0.22, true);
    cyl(A, 0, 0, 0, 0.17, 12.5, 8, 0.1);
    for (const sd of [-1, 1]) {
      beam(A, [0, 11.6, 0], [sd * 1.5, 12.3, 0], 0.11, 0.11);
      beam(A, [sd * 1.45, 12.3, 0], [sd * 3.6, 12.48, 0], 0.09, 0.09);
    }
  } else if (kind === 'single') {
    cyl(A, 0, 0, 0, 0.2, 0.35, 8, 0.2, true);
    cyl(A, 0, 0, 0, 0.14, 9.7, 8, 0.09);
    beam(A, [0, 9.0, 0], [1.1, 9.6, 0], 0.09, 0.09);
    beam(A, [1.05, 9.6, 0], [2.65, 9.72, 0], 0.08, 0.08);
  } else {
    cyl(A, 0, 0, 0, 0.12, 8.4, 6, 0.08);
    beam(A, [0, 8.2, 0], [1.4, 8.45, 0], 0.07, 0.07);
  }
  return A.geometry();
}

const ryFor = (dx, dz) => Math.atan2(-dz, dx); // instance rotation mapping local +x → (dx, dz)
const inS = (ranges, s) => !!ranges && ranges.some(([a, b]) => s >= a && s <= b);
const nearAny = (s, list, d) => list.some((q) => Math.abs(q - s) < d);

// ------------------------------------------------------------------ build

export async function build(world, def, track, progress) {
  const cfg = def.hw || {};
  const T0 = performance.now(); const tlog = (l) => console.log('[hw] ' + l + ' ' + Math.round(performance.now() - T0));
  const xway = cfg.style === 'expressway';
  const lit = !!world.at.lamps;
  const wet = def.weather === 'wet' || def.weather === 'rain';
  const shadows = def.time === 'dusk' || !lit;
  const rng = makeRng('hw' + def.id);
  const G = cfg.ground ?? 0, GY = G - 0.3;
  const fogD = def.fogD ?? world.at.fogD;
  const F = mainFrame(track, 200);
  const X = xway
    ? { shR: 1.2, shL: 1.0, wall: 0.5, pole: 40, deck: 2.4 }
    : { shR: 3, shL: 1.6, bar: 0.6, med: 0.8, oppGap: 1.6, oppW: 16, oppSh: 3, pole: 48, deck: 2.0 };
  const W = (a) => F.W[a];
  const oR = (a) => F.W[a] + X.shR;            // right barrier face (= WR)
  const oL = (a) => F.W[a] + X.shL;            // median barrier / left wall face (= WL)
  const oMed = (a) => oL(a) + X.med / 2;
  const oO0 = (a) => oL(a) + X.med + X.oppGap; // opposite carriageway, inner edge
  const oO1 = (a) => oO0(a) + X.oppW;
  const oO2 = (a) => oO1(a) + X.oppSh;
  const extR = xway ? (a) => oR(a) + X.wall : (a) => oR(a) + X.bar;
  const extL = xway ? (a) => oL(a) + X.wall : (a) => oO2(a) + X.bar;

  // ---- gameplay: walls at the shoulders' outer edges
  for (let i = 0; i < track.N; i++) {
    track.WL[i] = track.W[i] + X.shL;
    track.WR[i] = track.W[i] + X.shR;
  }
  track.shoulder = Math.max(X.shL, X.shR);
  track.offSurface = 'road';
  def.shoulderSurface = 'road';
  def.shoulderLift = 0;

  // ---- materials
  const sh = shoulderTex(wet);
  const verge = groundTexture(xway ? 'gravel' : 'grass');
  const signAt = new Atlas(2048, 2048, 56);
  const adAt = new Atlas(1024, 1024, 36);
  const signTex = toTex(signAt.c, { repeat: false });
  const adTex = toTex(adAt.c, { repeat: false });
  const panelMat = glowMaterial(new THREE.MeshStandardMaterial({ map: panelTex(), color: xway ? 0x9aa6a2 : 0x8a8f8c, roughness: 0.6, metalness: 0.35, envMapIntensity: 0.5 }), 1.4);
  const MATS = {
    road: { mat: world.roadMat, glow: true },
    shoulder: { mat: glowMaterial(new THREE.MeshStandardMaterial({ map: sh.map, roughnessMap: sh.rough, roughness: 1, envMapIntensity: wet ? 1.4 : 0.35 }), 3.2), glow: true },
    conc: { mat: glowMaterial(new THREE.MeshStandardMaterial({ map: concreteTexture('#8f8c85', 'hw'), roughness: 0.85, envMapIntensity: 0.3 }), 1.5), glow: true, cast: true },
    wall: { mat: glowMaterial(new THREE.MeshStandardMaterial({ map: wallTex(), roughness: 0.9, envMapIntensity: 0.25 }), 1.5), glow: true, cast: true },
    panel: { mat: panelMat, glow: true, cast: true },
    verge: { mat: glowMaterial(new THREE.MeshStandardMaterial({ map: verge, color: xway ? 0x8a8a86 : 0x6f7466, roughness: 0.95 }), 1.6), glow: true },
    steel: { mat: new THREE.MeshStandardMaterial({ color: 0x858a90, roughness: 0.45, metalness: 0.75 }), cast: true },
    glowy: { mat: new THREE.MeshBasicMaterial({ vertexColors: true }) },
    sign: { mat: new THREE.MeshStandardMaterial({ map: signTex, emissive: 0xffffff, emissiveMap: signTex, emissiveIntensity: lit ? 0.42 : 0, roughness: 0.55 }) },
    ads: { mat: new THREE.MeshStandardMaterial({ map: adTex, emissive: 0xffffff, emissiveMap: adTex, emissiveIntensity: lit ? 1.05 : 0, roughness: 0.6 }) },
    water: { mat: new THREE.MeshStandardMaterial({ color: 0x070b12, roughness: 0.32, metalness: 0.5, envMapIntensity: 0.45 }) },
  };
  for (const t of [verge]) t.repeat.set(1, 1);
  tlog('materials');

  // ---- accumulation bins: class × chunk/feature key → one mesh each
  const bins = new Map();
  const bin = (cls, key) => {
    const k = cls + '|' + key;
    let A = bins.get(k);
    if (!A) { A = new Acc(cls === 'glowy'); A.cls = cls; bins.set(k, A); }
    return A;
  };
  const R = Math.max(8, Math.round(CHUNK / F.step));
  const ck = (j) => 'm' + Math.floor(j / R);
  const sweepM = (cls, ja, jb, st, side, base, pts, o) => {
    for (let a = ja; a < jb;) {
      const c = Math.floor(a / R), b = Math.min(jb, (c + 1) * R);
      sweep(bin(cls, 'm' + c), F, rowsOf(a, b, st), side, base, pts, o);
      a = b;
    }
  };

  /** Interpolated main-line point at s (extensions included) and lateral offset. */
  const MP = (s, lat = 0) => {
    let f = s / F.step + F.E;
    if (F.closed) f = ((f % F.N) + F.N) % F.N;
    else f = clamp(f, 0, F.N - 1.001);
    const j = Math.floor(f), t = f - j;
    const a = F.at(j), b = F.at(j + 1);
    const L = (arr) => arr[a] + (arr[b] - arr[a]) * t;
    const lx = L(F.LX), lz = L(F.LZ), w = L(F.W);
    return { x: L(F.X) + lx * lat, z: L(F.Z) + lz * lat, y: L(F.Y) + clamp(lat, -w, w) * Math.tan(L(F.B)), yc: L(F.Y), tx: L(F.TX), tz: L(F.TZ), lx, lz, a: t < 0.5 ? a : b, j: t < 0.5 ? j : j + 1 };
  };
  const mainProj = (x, z) => {
    let best = 0, bd = Infinity;
    for (let j = 0; j < F.N; j += 6) {
      const d = (F.X[j] - x) ** 2 + (F.Z[j] - z) ** 2;
      if (d < bd) { bd = d; best = j; }
    }
    for (let j = best - 6; j <= best + 6; j++) {
      const a = F.at(j), d = (F.X[a] - x) ** 2 + (F.Z[a] - z) ** 2;
      if (d < bd) { bd = d; best = a; }
    }
    const dx = x - F.X[best], dz = z - F.Z[best];
    return { a: best, lat: dx * F.LX[best] + dz * F.LZ[best], lon: dx * F.TX[best] + dz * F.TZ[best] };
  };
  const inCorridor = (x, z, pad = 0) => {
    const q = mainProj(x, z);
    return Math.abs(q.lon) < F.step * 3 + pad && q.lat > -(extR(q.a) + pad) && q.lat < extL(q.a) + pad;
  };

  // ---- river / canal
  const rv = cfg.river ? { ...cfg.river, lo: cfg.river.at - cfg.river.w / 2, hi: cfg.river.at + cfg.river.w / 2 } : null;
  const across = (x, z) => (rv.axis === 'x' ? z : x);
  const inRiver = (x, z, pad = 0) => !!rv && across(x, z) > rv.lo - pad && across(x, z) < rv.hi + pad;
  const WATER = G - 2.4;
  const groundAt = (x, z) => (inRiver(x, z, 0.5) ? G - 6 : GY);

  // ---- sections
  const hAt = (a) => F.Y[a] - G;
  const bridgeAt = (a) => hAt(a) >= 6.5 || inRiver(F.X[a], F.Z[a], 40);
  const fillAt = (a) => !bridgeAt(a) && hAt(a) >= 1.0;
  const gradeAt = (a) => !bridgeAt(a) && hAt(a) < 1.0;

  // ---- lights
  const heads = [], halos = [], wstreaks = [], blinkers = [];
  const poles = { double: [], single: [], city: [] };
  const lamp = (x, y, z, ry, color, o = {}) => {
    const c = new THREE.Color(color);
    if (o.head !== false) heads.push({ x, y, z, ry, color: c.clone().multiplyScalar(lit ? (o.hi ?? 5) : 0.4) });
    if (lit) halos.push({ x, y: y - 0.2, z, c: c.clone().multiplyScalar(o.halo ?? 0.5), s: o.size ?? 4.5, f: o.f ?? 0.5 });
    if (o.bake === false || !lit) return;
    if (o.streak === false) world.lamps.push({ x, y, z, color: c, radius: o.r ?? 28, intensity: o.i ?? 1 });
    else world.addLamp(x, y, z, color, o.r ?? 28, o.i ?? 1);
  };
  const keep = new KeepOut(24);
  const poleSkip = [
    ...(cfg.signs || []).map((g) => g.s), ...(cfg.overpasses || []).map((o) => o.s),
    ...(cfg.interchange ? [cfg.interchange.s] : []), ...(cfg.crossings || []).map((c) => c.s),
  ];

  /** Wall across the deck where a viaduct ends on a fill (or the ground). */
  const abutment = (Fx, j, dir, latA, latB, depth, A) => {
    const a = Fx.at(j);
    const P3 = (lat, y) => [Fx.X[a] + Fx.LX[a] * lat, y, Fx.Z[a] + Fx.LZ[a] * lat];
    const yA = Fx.y(a, latA) - depth, yB = Fx.y(a, latB) - depth;
    const pa = P3(latA, 0), pb = P3(latB, 0);
    const gA = groundAt(pa[0], pa[2]), gB = groundAt(pb[0], pb[2]);
    const uv = [0, 0, (latB - latA) / 8, (yA - gA) / 8];
    if (dir > 0) A.quad(P3(latA, gA), P3(latB, gB), P3(latB, yB), P3(latA, yA), uv);
    else A.quad(P3(latB, gB), P3(latA, gA), P3(latA, yA), P3(latB, yB), uv);
  };

  /** Pier bent under the main deck at s: cap beam + columns at the given lats. */
  const bent = (s, lats, r) => {
    const p = MP(s, 0), a = p.a;
    const Lv = [F.LX[a], 0, F.LZ[a]], T = [F.TX[a], 0, F.TZ[a]];
    const capR = extR(a) - 0.5, capL = extL(a) - 0.5;
    const yb = Math.min(F.y(a, -capR), F.y(a, capL)) - X.deck;
    const cl = (capL - capR) / 2;
    const A = bin('conc', ck(p.j));
    obox(A, [F.X[a] + Lv[0] * cl, yb - 0.8, F.Z[a] + Lv[2] * cl], Lv, UP, T, (capL + capR) / 2, 0.8, 1.1, 2);
    for (const lat of lats) {
      const x = F.X[a] + Lv[0] * lat, z = F.Z[a] + Lv[2] * lat;
      const gy = groundAt(x, z);
      cyl(A, x, gy, z, r, yb - 1.6 - gy, 8, r * 0.9);
    }
  };

  // ------------------------------------------------------------ main line
  const vS = 12;
  const SOUND = (top) => [
    [[0, GY, 1], [0, top, 1]],
    [[0, top, 1], [0.35, top, 1]],
    [[0.35, top, 1], [0.35, GY, 1]],
  ];
  const all = F.last;
  if (!xway) {
    if (F.E) {
      const prof = [[(a) => -F.W[a], 0], [(a) => F.W[a], 0]];
      sweepM('road', 0, F.E, 1, 0, 0, prof, { uS: 2 * F.W[0], vS });
      sweepM('road', F.E + track.N - 1, all, 1, 0, 0, prof, { uS: 2 * F.W[F.N - 1], vS });
    }
    sweepM('shoulder', 0, all, 2, -1, W, [[0, 0], [X.shR, 0]], { uS: 3, vS });
    sweepM('shoulder', 0, all, 2, 1, W, [[0, 0], [X.shL, 0]], { uS: 3, vS });
    sweepM('shoulder', 0, all, 4, 1, (a) => oL(a) + X.med, [[0, 0], [X.oppGap, 0]], { uS: 3, vS, flip: true });
    sweepM('shoulder', 0, all, 4, 1, oO1, [[0, 0], [X.oppSh, 0]], { uS: 3, vS });
    sweepM('road', 0, all, 2, 1, oO0, [[0, 0], [X.oppW, 0]], { uS: X.oppW, vS });
    for (const p of JERSEY) {
      sweepM('conc', 0, all, 4, -1, oR, p, { uS: 1.5, vS: 6 });
      sweepM('conc', 0, all, 4, 1, oO2, p, { uS: 1.5, vS: 6 });
    }
    for (const p of MEDIAN) sweepM('conc', 0, all, 4, 1, oL, p, { uS: 1.5, vS: 6 });
    // verges, sound walls, retaining walls, viaducts
    for (const [ja, jb] of runsOf(F, (a) => gradeAt(a) && inS(cfg.soundWalls, F.s(a)))) {
      for (const sd of [-1, 1]) {
        const base = sd < 0 ? extR : extL;
        sweepM('verge', ja, jb, 4, sd, base, [[0, -0.06], [7, -0.16]], { uS: 6, vS: 6 });
        for (const p of SOUND(G + 4.9)) sweepM('wall', ja, jb, 4, sd, (a) => base(a) + 7, p, { uv: 'sy', uS: 64, vS: 8, y0: GY });
      }
    }
    for (const [ja, jb] of runsOf(F, (a) => gradeAt(a) && !inS(cfg.soundWalls, F.s(a)))) {
      for (const sd of [-1, 1]) {
        const vw = (a) => (inS(cfg.wideVerge, F.s(a)) ? 75 : 26);
        sweepM('verge', ja, jb, 4, sd, sd < 0 ? extR : extL, [[0, -0.06], [vw, -0.2]], { uS: 6, vS: 6 });
      }
    }
    for (const [ja, jb] of runsOf(F, fillAt)) {
      for (const sd of [-1, 1]) sweepM('wall', ja, jb, 4, sd, sd < 0 ? extR : extL, [[0, 0], [0.25, (a, x, z) => groundAt(x, z)]], { uv: 'sy', uS: 64, vS: 8, y0: GY });
    }
    for (const [ja, jb] of runsOf(F, bridgeAt)) {
      for (const sd of [-1, 1]) for (const p of FASCIA(X.deck)) sweepM('conc', ja, jb, 4, sd, sd < 0 ? extR : extL, p, { uS: 2, vS: 6 });
      sweepM('conc', ja, jb, 4, 0, 0, [[(a) => extL(a) + 0.1, -X.deck], [(a) => -(extR(a) + 0.1), -X.deck]], { uS: 8, vS: 8 });
      if (ja > 0) abutment(F, ja, 1, -(extR(F.at(ja)) + 0.1), extL(F.at(ja)) + 0.1, X.deck, bin('conc', ck(ja)));
      if (jb < all) abutment(F, jb, -1, -(extR(F.at(jb)) + 0.1), extL(F.at(jb)) + 0.1, X.deck, bin('conc', ck(jb)));
      for (let s = Math.ceil((F.s(ja) + 14) / 38) * 38; s < F.s(jb) - 14; s += 38) {
        if (nearAny(s, poleSkip, 4)) continue;
        const a = MP(s).a;
        bent(s, [-3, oMed(a), oO0(a) + X.oppW / 2 + 3], 1.0);
      }
    }
    // reflectors on the barrier faces
    const gl = bin('glowy', 'refl');
    const cW = lit ? [2.2, 2.2, 2.0] : [0.5, 0.5, 0.45], cA = lit ? [2.8, 1.6, 0.3] : [0.6, 0.4, 0.1];
    for (let s = F.s(0) + 8; s < F.s(all) - 8; s += 16) {
      const p = MP(s), a = p.a;
      const T = [F.TX[a], 0, F.TZ[a]];
      for (const [lat, y, face, col] of [[-(oR(a) + 0.13), F.y(a, -W(a)) + 0.45, 1, cW], [oL(a) + 0.19, F.y(a, W(a)) + 0.5, -1, cA]]) {
        const c = [F.X[a] + F.LX[a] * lat, y, F.Z[a] + F.LZ[a] * lat];
        const e = face > 0 ? [-T[0] * 0.14, 0, -T[2] * 0.14] : [T[0] * 0.14, 0, T[2] * 0.14];
        gl.quad([c[0] - e[0], y - 0.06, c[2] - e[2]], [c[0] + e[0], y - 0.06, c[2] + e[2]], [c[0] + e[0], y + 0.06, c[2] + e[2]], [c[0] - e[0], y + 0.06, c[2] - e[2]], [0, 0, 1, 1], col);
      }
    }
    // double-armed sodium poles on the median
    for (let s = F.s(0) + 25; s < F.s(all) - 25; s += X.pole) {
      if (nearAny(s, poleSkip, 16)) continue;
      const a = MP(s).a;
      const lat = oMed(a);
      const y = F.y(a, lat) + 1.07;
      const ry = ryFor(F.LX[a], F.LZ[a]);
      poles.double.push({ x: F.X[a] + F.LX[a] * lat, y, z: F.Z[a] + F.LZ[a] * lat, ry });
      for (const sd of [-1, 1]) {
        const hl = lat + sd * 3.75;
        lamp(F.X[a] + F.LX[a] * hl, y + 12.32, F.Z[a] + F.LZ[a] * hl, ry, SODIUM, { r: 30, i: 1.35 });
      }
      // overlapping cones between poles: fill light only (no extra reflections)
      if (lit) {
        const f = MP(s + X.pole / 2, -2);
        world.lamps.push({ x: f.x, y: f.y + 11, z: f.z, color: new THREE.Color(SODIUM), radius: 30, intensity: 0.45 });
      }
    }
  } else {
    sweepM('shoulder', 0, all, 2, -1, W, [[0, 0], [X.shR, 0]], { uS: 3, vS });
    sweepM('shoulder', 0, all, 2, 1, W, [[0, 0], [X.shL, 0]], { uS: 3, vS });
    const PAR = [
      [[0, 0], [0.04, 0.12], [0.04, 1.25]],
      [[0.04, 1.25], [0.5, 1.25]],
      [[0.5, 1.25], [0.5, -0.35]],
      [[0.5, -0.35], [0.32, -0.5], [0.32, -X.deck]],
    ];
    for (const sd of [-1, 1]) for (const p of PAR) sweepM('conc', 0, all, 4, sd, sd < 0 ? oR : oL, p, { uS: 2, vS: 6 });
    sweepM('conc', 0, all, 4, 0, 0, [[(a) => oL(a) + 0.32, -X.deck], [(a) => -(oR(a) + 0.32), -X.deck]], { uS: 8, vS: 8 });
    // sound barrier panels on the parapets
    for (const [ja, jb] of runsOf(F, (a) => inS(cfg.highWalls, F.s(a)) && !inS(cfg.tubes, F.s(a)))) {
      for (const sd of [-1, 1]) {
        for (const p of [[[0.1, 1.25], [0.1, 3.6]], [[0.1, 3.6], [0.42, 3.6]], [[0.42, 3.6], [0.42, 1.25]]]) {
          sweepM('panel', ja, jb, 4, sd, sd < 0 ? oR : oL, p, { uv: 'sy', uS: 8, vS: 8 });
        }
      }
    }
    // covered tube: walls up to a roof, sodium tunnel lamps
    for (const [ja, jb] of runsOf(F, (a) => inS(cfg.tubes, F.s(a)))) {
      for (const sd of [-1, 1]) {
        const base = sd < 0 ? oR : oL;
        sweepM('conc', ja, jb, 4, sd, base, [[0.04, 1.25], [0.04, 6.6]], { uS: 4, vS: 6 });
        sweepM('panel', ja, jb, 4, sd, base, [[0.5, 7.3], [0.5, 1.25]], { uv: 'sy', uS: 8, vS: 8 });
      }
      sweepM('conc', ja, jb, 4, 0, 0, [[(a) => oL(a) + 0.04, 6.6], [(a) => -(oR(a) + 0.04), 6.6]], { uS: 8, vS: 8 });
      sweepM('panel', ja, jb, 4, 0, 0, [[(a) => -(oR(a) + 0.5), 7.3], [(a) => oL(a) + 0.5, 7.3]], { uS: 8, vS: 8 });
      for (const [j, dir] of [[ja, -1], [jb, 1]]) {
        const a = F.at(j);
        const T = [F.TX[a], 0, F.TZ[a]], Lv = [F.LX[a], 0, F.LZ[a]];
        const cl = (oL(a) - oR(a)) / 2;
        const c = [F.X[a] + Lv[0] * cl + T[0] * dir * 0.6, F.Y[a] + 7.9, F.Z[a] + Lv[2] * cl + T[2] * dir * 0.6];
        obox(bin('conc', ck(j)), c, Lv, UP, T, (oL(a) + oR(a)) / 2 + 0.9, 1.3, 0.6, 2);
        // chevron band over the mouth
        const yb = F.Y[a] + 6.7, w = (oL(a) + oR(a)) / 2;
        for (let k = -6; k < 6; k++) {
          const l0 = cl + (k / 6) * w, l1 = cl + ((k + 0.5) / 6) * w;
          const p0 = [F.X[a] + Lv[0] * l0 + T[0] * dir * 1.22, F.Z[a] + Lv[2] * l0 + T[2] * dir * 1.22];
          const p1 = [F.X[a] + Lv[0] * l1 + T[0] * dir * 1.22, F.Z[a] + Lv[2] * l1 + T[2] * dir * 1.22];
          const col = lit ? [2.4, 1.8, 0.2] : [0.8, 0.6, 0.05];
          const q = [[p0[0], yb, p0[1]], [p1[0], yb, p1[1]], [p1[0], yb + 0.45, p1[1]], [p0[0], yb + 0.45, p0[1]]];
          if (dir < 0) bin('glowy', 'tube').quad(q[1], q[0], q[3], q[2], [0, 0, 1, 1], col);
          else bin('glowy', 'tube').quad(q[0], q[1], q[2], q[3], [0, 0, 1, 1], col);
        }
      }
      for (let s = F.s(ja) + 4; s < F.s(jb) - 2; s += 8) {
        const p = MP(s), a = p.a;
        for (const sd of [-1, 1]) {
          const lat = sd * ((sd < 0 ? oR(a) : oL(a)) - 0.08);
          const x = F.X[a] + F.LX[a] * lat, z = F.Z[a] + F.LZ[a] * lat, y = F.y(a, lat) + 5.4;
          obox(bin('glowy', 'tube'), [x, y, z], [F.LX[a], 0, F.LZ[a]], UP, [F.TX[a], 0, F.TZ[a]], 0.1, 0.09, 0.7, 1, lit ? [4.5, 2.4, 0.8] : [0.5, 0.3, 0.1]);
          lamp(x - F.LX[a] * sd * 0.3, y - 0.2, z - F.LZ[a] * sd * 0.3, 0, '#ff9840', { head: false, r: 10, i: 0.55, halo: 0.35, size: 2.2 });
        }
      }
    }
    // single-column piers with hammerhead caps
    for (let s = 16; s < track.length - 8; s += 32) {
      if (nearAny(s, poleSkip, 3)) continue;
      bent(s, [0], 1.45);
    }
    // chevron boards on the outside parapet of the tight curves
    const chev = { L: signAt.alloc(0.9, 1.1), R: signAt.alloc(0.9, 1.1) };
    drawChevron(signAt, chev.L, 'L');
    drawChevron(signAt, chev.R, 'R');
    for (let s = 10; s < track.length - 5; s += 20) {
      const a = MP(s).a;
      if (Math.abs(track.K[a]) < 1 / 420 || inS(cfg.tubes, s)) continue;
      const sd = track.K[a] > 0 ? -1 : 1;
      const lat = sd * ((sd < 0 ? oR(a) : oL(a)) + 0.27);
      const y = F.y(a, lat) + 1.45;
      const at = (l, dy) => [F.X[a] + F.LX[a] * (lat + l), y + dy, F.Z[a] + F.LZ[a] * (lat + l)];
      bin('sign', 'signs').quad(at(0.45, 0), at(-0.45, 0), at(-0.45, 1.1), at(0.45, 1.1), chev[sd < 0 ? 'L' : 'R'].uv);
      for (const l of [-0.3, 0.3]) beam(bin('steel', ck(a)), at(l, -0.22), at(l, 0.6), 0.06, 0.06);
    }
    // parapet-top poles, alternating sides
    let k = 0;
    for (let s = 20; s < track.length - 10; s += X.pole / 2, k++) {
      if (inS(cfg.tubes, s) || nearAny(s, poleSkip, 14)) continue;
      const sd = k % 2 ? 1 : -1;
      const a = MP(s).a;
      const lat = sd * ((sd < 0 ? oR(a) : oL(a)) + 0.27);
      const y = F.y(a, lat) + 1.25;
      const ry = ryFor(-sd * F.LX[a], -sd * F.LZ[a]);
      poles.single.push({ x: F.X[a] + F.LX[a] * lat, y, z: F.Z[a] + F.LZ[a] * lat, ry });
      const hl = lat - sd * 2.8;
      lamp(F.X[a] + F.LX[a] * hl, y + 9.62, F.Z[a] + F.LZ[a] * hl, ry, cfg.lampColor || '#ffb768', { r: 26, i: 1.05 });
    }
  }
  // corridor keep-out: everything that must stay clear of buildings and piers
  keep.add(F, (a) => extL(a) + (xway ? 3 : gradeAt(a) ? (inS(cfg.wideVerge, F.s(a)) ? 76 : 28) : 4), (a) => extR(a) + (xway ? 3 : gradeAt(a) ? (inS(cfg.wideVerge, F.s(a)) ? 76 : 28) : 4), 2, 0);
  tlog("0.15, 'POURING CONCRE");
  progress(0.15, 'POURING CONCRETE');
  await nextFrame();

  // ------------------------------------------------------------ secondary roads
  let roadId = 1;
  const PARAPET = [[[0, 0], [0, 1.05]], [[0, 1.05], [0.3, 1.05]], [[0.3, 1.05], [0.3, 0]]];
  /**
   * A road on its own centerline: ramps, cross streets, overpasses, flyovers.
   * pts: [[x, z, y, halfWidth], …]. o: { key, surf, texW, walk, barrier,
   * kind(Fp, a) → 'grade'|'fill'|'bridge', lamps: { sp, both, side }, piers, deck }
   */
  const pathRoad = (pts, o) => {
    const Fp = pathFrame(pts);
    const id = roadId++;
    const key = o.key, last = Fp.last, rows = rowsOf(0, last, 1), rows2 = rowsOf(0, last, 2);
    const edge = o.walk ?? 0, deck = o.deck ?? 1.8;
    const par = o.barrier === 'parapet';
    const bw = par ? 0.3 : 0.6;
    const ext = (a) => Fp.W[a] + edge + bw;
    const C = bin('conc', key);
    sweep(bin('road', key), Fp, rows, 0, 0, [[(a) => -Fp.W[a], 0], [(a) => Fp.W[a], 0]], { uS: o.texW ?? 2 * F.W[0], vS: 12, mirror: !!o.mirror });
    for (const sd of [-1, 1]) {
      if (edge) sweep(C, Fp, rows, sd, (a) => Fp.W[a], [[0, 0], [0, 0.18], [edge, 0.18]], { uS: 2, vS: 4 });
      for (const p of par ? PARAPET : JERSEY) sweep(C, Fp, rows2, sd, (a) => Fp.W[a] + edge, p, { uS: 1.5, vS: 6 });
    }
    const kindAt = (a) => {
      if (o.kind) return o.kind(Fp, a);
      const h = Fp.Y[a] - groundAt(Fp.X[a], Fp.Z[a]);
      return h >= 6.5 ? 'bridge' : h > 0.6 ? 'fill' : 'grade';
    };
    for (const [ja, jb] of runsOf(Fp, (a) => kindAt(a) === 'fill')) {
      for (const sd of [-1, 1]) sweep(bin('wall', key), Fp, rowsOf(ja, jb, 2), sd, ext, [[0, 0], [0.2, (a, x, z) => groundAt(x, z)]], { uv: 'sy', uS: 64, vS: 8, y0: GY });
    }
    for (const [ja, jb] of runsOf(Fp, (a) => kindAt(a) === 'bridge')) {
      const rr = rowsOf(ja, jb, 2);
      for (const sd of [-1, 1]) for (const p of FASCIA(deck)) sweep(C, Fp, rr, sd, ext, p, { uS: 2, vS: 6 });
      sweep(C, Fp, rr, 0, 0, [[(a) => ext(a) + 0.1, -deck], [(a) => -(ext(a) + 0.1), -deck]], { uS: 8, vS: 8 });
      if (ja > 0) abutment(Fp, ja, 1, -(ext(ja) + 0.1), ext(ja) + 0.1, deck, C);
      if (jb < last) abutment(Fp, jb, -1, -(ext(jb) + 0.1), ext(jb) + 0.1, deck, C);
      if (o.piers === false) continue;
      const sp = o.pierSp ?? 30;
      let lastS = -1e9;
      for (let j = ja + 2; j < jb - 2; j++) {
        const s = Fp.S[j];
        if (s - lastS < sp) continue;
        const x = Fp.X[j], z = Fp.Z[j];
        if (inCorridor(x, z, 2.5) || keep.blocked(x, z, 2.5, id)) continue;
        lastS = s;
        const Lv = [Fp.LX[j], 0, Fp.LZ[j]], T = [Fp.TX[j], 0, Fp.TZ[j]];
        const yb = Fp.Y[j] - deck;
        obox(C, [x, yb - 0.7, z], Lv, UP, T, ext(j) - 0.4, 0.7, 0.9, 2);
        const gy = groundAt(x, z);
        cyl(C, x, gy, z, o.pierR ?? 1.1, yb - 1.4 - gy, 8, (o.pierR ?? 1.1) * 0.9);
      }
    }
    if (o.lamps) {
      let lastS = -1e9;
      for (let j = 1; j < last - 1; j++) {
        if (Fp.S[j] - lastS < o.lamps.sp || Fp.W[j] < 2) continue;
        lastS = Fp.S[j];
        for (const sd of o.lamps.both ? [-1, 1] : [o.lamps.side ?? 1]) {
          const lat = sd * (ext(j) - bw / 2);
          const x = Fp.X[j] + Fp.LX[j] * lat, z = Fp.Z[j] + Fp.LZ[j] * lat, y = Fp.Y[j] + (par ? 1.05 : 0.81);
          const ry = ryFor(-sd * Fp.LX[j], -sd * Fp.LZ[j]);
          poles.single.push({ x, y, z, ry });
          const hl = lat - sd * 2.75;
          lamp(Fp.X[j] + Fp.LX[j] * hl, y + 9.6, Fp.Z[j] + Fp.LZ[j] * hl, ry, o.lamps.color || SODIUM, { r: 24, i: 1.0, streak: !!o.lamps.streak });
        }
      }
    }
    keep.add(Fp, (a) => ext(a) + 1.5, (a) => ext(a) + 1.5, 1, id);
    return Fp;
  };

  /** Straight road crossing over the main line at s: deck `clear` m above, ramps down to grade. */
  const overpass = (ov) => {
    const p = MP(ov.s), a = p.a;
    const ang = ((ov.angle ?? 90) * Math.PI) / 180;
    const dx = F.TX[a] * Math.cos(ang) + F.LX[a] * Math.sin(ang), dz = F.TZ[a] * Math.cos(ang) + F.LZ[a] * Math.sin(ang);
    const cl = (extL(a) - extR(a)) / 2;
    const cx = F.X[a] + F.LX[a] * cl, cz = F.Z[a] + F.LZ[a] * cl;
    const half = (extL(a) + extR(a)) / 2 / Math.max(0.4, Math.sin(ang));
    const top = F.Y[a] + (ov.clear ?? 8.4);
    const flat = half + (ov.flat ?? 24), ramp = ov.ramp ?? 230, len = flat + ramp + 60;
    const pts = [];
    for (let t = -len; t <= len; t += 4) {
      const k = smoothstep(flat + ramp, flat, Math.abs(t));
      const y = GY + 0.35 + (top - GY - 0.35) * k * k * (3 - 2 * k);
      pts.push([cx + dx * t, cz + dz * t, y, 8]);
    }
    pathRoad(pts, {
      key: 'ov' + Math.round(ov.s), walk: ov.walk ?? 1.8, barrier: 'parapet', deck: 2.0,
      kind: (Fp, j) => (inCorridor(Fp.X[j], Fp.Z[j], 3) ? 'bridge' : Fp.Y[j] - GY > 0.9 ? 'fill' : 'grade'),
      lamps: { sp: 32, both: true },
    });
    // lamps under the deck light the lanes below
    if (lit) {
      for (const lat of xway ? [-3, 3] : [-4, 4, oO0(a) + 4, oO0(a) + 12]) {
        const q = MP(ov.s, lat);
        lamp(q.x, top - 2.3, q.z, 0, '#ffd7a0', { head: false, r: 15, i: 0.7, halo: 0.25, size: 2 });
      }
    }
  };

  if (!xway) {
    for (const ov of cfg.overpasses || []) overpass(ov);
    // diamond interchange: cross street over the freeway, four ramps up to it
    if (cfg.interchange) {
      const ic = cfg.interchange, sx = ic.s;
      overpass({ s: sx, angle: 90, clear: 8.4, flat: 80, ramp: 240, walk: 2 });
      const top = MP(sx).yc + 8.4;
      const rw = 3.6;
      for (const sd of [-1, 1]) {
        for (const dir of [-1, 1]) {
          const pts = [];
          const n = 135;
          for (let k = 0; k <= n; k++) {
            const t = k / n;
            const s = sx + dir * (560 - 549 * t);
            const a = MP(s).a;
            const w = rw * smoothstep(0, 0.16, t);
            const swing = 42 * smoothstep(0.22, 1, t);
            const lat = sd * ((sd < 0 ? extR(a) : extL(a)) + 0.62 + 0.6 + w + swing);
            const q = MP(s, lat);
            const y = q.y + (top - q.y) * smoothstep(0.18, 0.96, t);
            pts.push([q.x, q.z, y, w]);
          }
          if (dir > 0) pts.reverse();
          pathRoad(pts, { key: 'ic', mirror: true, texW: 16, lamps: { sp: 46, side: sd * dir } });
        }
      }
    }
    // flyover sweeping across both carriageways
    if (cfg.flyover) {
      const fo = cfg.flyover;
      const a = MP(fo.s).a;
      const A0 = MP(fo.s - 400, extL(a) + 300), A1 = MP(fo.s, (extL(a) - extR(a)) / 2), A2 = MP(fo.s + 400, -(extR(a) + 300));
      const C1 = [2 * A1.x - (A0.x + A2.x) / 2, 2 * A1.z - (A0.z + A2.z) / 2];
      const raw = [];
      for (let k = 0; k <= 400; k++) {
        const t = k / 400, u = 1 - t;
        raw.push([u * u * A0.x + 2 * u * t * C1[0] + t * t * A2.x, u * u * A0.z + 2 * u * t * C1[1] + t * t * A2.z]);
      }
      let L = 0;
      const cum = [0];
      for (let k = 1; k < raw.length; k++) { L += Math.hypot(raw[k][0] - raw[k - 1][0], raw[k][1] - raw[k - 1][1]); cum.push(L); }
      const top = MP(fo.s).yc + (fo.h ?? 17);
      const pts = [];
      let k = 0;
      for (let s = 0; s <= L; s += 4) {
        while (k < cum.length - 2 && cum[k + 1] < s) k++;
        const f = (s - cum[k]) / Math.max(1e-6, cum[k + 1] - cum[k]);
        const x = raw[k][0] + (raw[k + 1][0] - raw[k][0]) * f, z = raw[k][1] + (raw[k + 1][1] - raw[k][1]) * f;
        const e = smoothstep(L / 2 - 160, L / 2 - 420, Math.abs(s - L / 2));
        pts.push([x, z, GY + 0.35 + (top - GY - 0.35) * e * e * (3 - 2 * e), 4]);
      }
      pathRoad(pts, { key: 'fly', mirror: true, texW: 16, barrier: 'parapet', pierR: 1.25, pierSp: 34, lamps: { sp: 38, both: true } });
    }
  } else {
    // a higher expressway crossing over the ring
    for (const cr of cfg.crossings || []) {
      const p = MP(cr.s), a = p.a;
      const ang = (cr.angle * Math.PI) / 180;
      const dx = F.TX[a] * Math.cos(ang) + F.LX[a] * Math.sin(ang), dz = F.TZ[a] * Math.cos(ang) + F.LZ[a] * Math.sin(ang);
      const top = F.Y[a] + (cr.h ?? 15);
      const len = cr.len ?? 1100;
      const pts = [];
      for (let t = -len; t <= len; t += 4) {
        const e = smoothstep(len, len - 380, Math.abs(t));
        pts.push([p.x + dx * t, p.z + dz * t, GY + 0.35 + (top - GY - 0.35) * e * e * (3 - 2 * e), 6]);
      }
      pathRoad(pts, { key: 'cr' + cr.s, texW: 12, barrier: 'parapet', deck: 2.4, pierR: 1.5, pierSp: 36, lamps: { sp: 40, both: true, color: cfg.lampColor || '#ffb768' } });
    }
    // exit ramps peeling off beyond the wall and dropping to the street
    for (const ex of cfg.exits || []) {
      const sd = ex.side ?? -1;
      const pts = [];
      const n = Math.round(ex.len / 4);
      for (let k = 0; k <= n; k++) {
        const t = k / n;
        const s = ex.s + t * ex.len * 0.62;
        const w = 3.4 * smoothstep(0, 0.12, t);
        const a = MP(s).a;
        const swing = 120 * Math.pow(smoothstep(0.1, 1, t), 1.6);
        const lat = sd * ((sd < 0 ? extR(a) : extL(a)) + 0.35 + 0.3 + w + swing);
        const q = MP(s, lat);
        const y = q.y + (GY + 0.35 - q.y) * smoothstep(0.15, 1, t);
        pts.push([q.x, q.z, y, w]);
      }
      pathRoad(pts, { key: 'ex' + ex.s, mirror: true, texW: 12, barrier: 'parapet', deck: 1.8, pierR: 1.0, pierSp: 26, lamps: { sp: 40, side: sd, color: cfg.lampColor || '#ffb768' } });
    }
  }
  tlog("0.3, 'HANGING SIGNS')");
  progress(0.3, 'HANGING SIGNS');
  await nextFrame();

  // ------------------------------------------------------------ gantry signs
  const signsA = bin('sign', 'signs');
  const lightA = bin('glowy', 'signlights');
  for (const g of cfg.signs || []) {
    const p = MP(g.s), a = p.a;
    const Lv = [F.LX[a], 0, F.LZ[a]], T = [F.TX[a], 0, F.TZ[a]];
    const yc = F.Y[a];
    const at = (lat, dy, ds = 0) => [F.X[a] + Lv[0] * lat + T[0] * ds, yc + dy, F.Z[a] + Lv[2] * lat + T[2] * ds];
    const st = bin('steel', ck(p.j));
    const bridged = !xway && !gradeAt(a);
    const latR = xway ? -(oR(a) + 0.27) : bridged ? -(oR(a) + 0.42) : -(extR(a) + 1.1);
    const baseR = (xway ? 1.25 : bridged ? 0.81 : -0.1) + F.y(a, latR) - yc;
    const latL = g.kind === 'cant' ? -0.6 : xway ? oL(a) + 0.27 : oMed(a);
    const baseL = (xway ? 1.25 : 1.07) + F.y(a, latL) - yc;
    const dyB = 6.75, dyT = 8.15, d = 0.5;
    for (const ds of [-d, d]) for (const dy of [dyB, dyT]) beam(st, at(latR, dy, ds), at(latL, dy, ds), 0.13, 0.13);
    const span = latL - latR, nSeg = Math.max(2, Math.round(Math.abs(span) / 1.8));
    for (let k = 0; k <= nSeg; k++) {
      const lat = latR + (span * k) / nSeg;
      for (const ds of [-d, d]) beam(st, at(lat, dyB, ds), at(lat, dyT, ds), 0.07, 0.07);
      beam(st, at(lat, dyB, -d), at(lat, dyB, d), 0.06, 0.06);
      beam(st, at(lat, dyT, -d), at(lat, dyT, d), 0.06, 0.06);
      if (k < nSeg) {
        const lat2 = latR + (span * (k + 1)) / nSeg;
        for (const ds of [-d, d]) beam(st, at(lat, k % 2 ? dyB : dyT, ds), at(lat2, k % 2 ? dyT : dyB, ds), 0.05, 0.05);
      }
    }
    for (const [lat, base] of g.kind === 'cant' ? [[latR, baseR]] : [[latR, baseR], [latL, baseL]]) {
      for (const ds of [-d, d]) beam(st, at(lat, base, ds), at(lat, dyT + 0.3, ds), 0.26, 0.26);
      beam(st, at(lat, base + 1.5, -d), at(lat, base + 1.5, d), 0.12, 0.12);
      beam(st, at(lat, dyB - 0.6, -d), at(lat, dyB - 0.6, d), 0.12, 0.12);
      obox(st, at(lat, base + 0.03, 0), Lv, UP, T, 0.5, 0.03, 0.9);
    }
    if (g.kind === 'cant') beam(st, at(latR, dyB - 1.6, 0), at(latR + span * 0.45, dyB, 0), 0.14, 0.14);
    const n = g.panels.length;
    const l0 = g.kind === 'cant' ? -0.4 : W(a) - 0.2, l1 = -W(a) + (g.kind === 'cant' ? 0.4 : 0.2);
    const ds = -d - 0.25;
    g.panels.forEach((pn, k) => {
      const lc = l0 + ((l1 - l0) * (k + 0.5)) / n;
      const hw = pn.w / 2, bot = 5.35, top = bot + pn.h;
      const r = signAt.alloc(pn.w, pn.h);
      drawPanel(signAt, r, { ...pn, kind: xway ? 'C' : 'I' });
      signsA.quad(at(lc + hw, bot, ds), at(lc - hw, bot, ds), at(lc - hw, top, ds), at(lc + hw, top, ds), r.uv);
      st.quad(at(lc - hw, bot, ds + 0.05), at(lc + hw, bot, ds + 0.05), at(lc + hw, top, ds + 0.05), at(lc - hw, top, ds + 0.05), [0, 0, pn.w / 2, pn.h / 2]);
      if (pn.exit) {
        const tw = 2.7, th = 0.82;
        const tr = signAt.alloc(tw, th + 0.2);
        drawTab(signAt, tr, 'EXIT ' + pn.exit);
        const tc = lc - hw + tw / 2 + 0.2;
        signsA.quad(at(tc + tw / 2, top - 0.2, ds), at(tc - tw / 2, top - 0.2, ds), at(tc - tw / 2, top + th, ds), at(tc + tw / 2, top + th, ds), tr.uv);
        st.quad(at(tc - tw / 2, top - 0.2, ds + 0.05), at(tc + tw / 2, top - 0.2, ds + 0.05), at(tc + tw / 2, top + th, ds + 0.05), at(tc - tw / 2, top + th, ds + 0.05));
      }
      obox(st, at(lc, bot - 0.2, ds + 0.2), Lv, UP, T, hw + 0.2, 0.04, 0.5);
      for (const f of [-0.27, 0.27]) {
        const lat = lc + f * pn.w;
        obox(lightA, at(lat, bot - 0.42, ds - 0.75), Lv, UP, T, 0.32, 0.07, 0.14, 1, lit ? [3.2, 3.3, 3.6] : [0.3, 0.3, 0.3]);
        beam(st, at(lat, bot - 0.36, ds - 0.75), at(lat, bot - 0.2, ds + 0.2), 0.05, 0.05);
        const q = at(lat, bot - 0.6, ds - 0.8);
        lamp(q[0], q[1], q[2], 0, '#dfe8ff', { head: false, r: 12, i: 0.5, halo: 0.22, size: 2.2 });
      }
    });
  }
  signTex.needsUpdate = true;
  tlog("0.4, 'ZONING THE CITY");
  progress(0.4, 'ZONING THE CITY');
  await nextFrame();

  // ------------------------------------------------------------ ground, river
  let bMinX = Infinity, bMinZ = Infinity, bMaxX = -Infinity, bMaxZ = -Infinity;
  for (let j = 0; j < F.N; j++) {
    bMinX = Math.min(bMinX, F.X[j]); bMaxX = Math.max(bMaxX, F.X[j]);
    bMinZ = Math.min(bMinZ, F.Z[j]); bMaxZ = Math.max(bMaxZ, F.Z[j]);
  }
  const cityR = cfg.cityR ?? 700;
  const skyMax = cfg.skyline?.max ?? cityR + 2200;
  const margin = Math.max(cfg.margin ?? 1500, skyMax + 700);
  const gx0 = Math.floor((bMinX - margin) / P) * P, gz0 = Math.floor((bMinZ - margin) / P) * P;
  const gx1 = Math.ceil((bMaxX + margin) / P) * P, gz1 = Math.ceil((bMaxZ + margin) / P) * P;
  {
    const tile = cityTile();
    const gm = new THREE.MeshStandardMaterial({
      map: tile.map, emissiveMap: tile.emi, emissive: 0xffffff, emissiveIntensity: lit ? (def.time === 'dusk' ? 0.8 : 1.1) : 0,
      roughness: wet ? 0.6 : 0.92, envMapIntensity: wet ? 0.5 : 0.15, polygonOffset: true, polygonOffsetFactor: 2, polygonOffsetUnits: 2,
    });
    let rects = [[gx0, gz0, gx1, gz1]];
    if (rv) rects = rv.axis === 'x' ? [[gx0, gz0, gx1, rv.lo], [gx0, rv.hi, gx1, gz1]] : [[gx0, gz0, rv.lo, gz1], [rv.hi, gz0, gx1, gz1]];
    const A = new Acc();
    for (const [x0, z0, x1, z1] of rects) A.quad([x0, GY, z1], [x1, GY, z1], [x1, GY, z0], [x0, GY, z0], [(x0 - gx0) / P, (z1 - gz0) / P, (x1 - gx0) / P, (z0 - gz0) / P]);
    const ground = new THREE.Mesh(A.geometry(), gm);
    ground.receiveShadow = true;
    world.add(ground);
  }
  if (rv) {
    const A = bin('water', 'river'), Q = bin('wall', 'quay');
    const lo = rv.lo, hi = rv.hi;
    if (rv.axis === 'x') {
      A.quad([gx0, WATER, hi], [gx1, WATER, hi], [gx1, WATER, lo], [gx0, WATER, lo]);
      Q.quad([gx0, WATER - 1, lo], [gx1, WATER - 1, lo], [gx1, GY, lo], [gx0, GY, lo], [0, 0, (gx1 - gx0) / 64, 0.3]);
      Q.quad([gx1, WATER - 1, hi], [gx0, WATER - 1, hi], [gx0, GY, hi], [gx1, GY, hi], [0, 0, (gx1 - gx0) / 64, 0.3]);
    } else {
      A.quad([lo, WATER, gz1], [hi, WATER, gz1], [hi, WATER, gz0], [lo, WATER, gz0]);
      Q.quad([lo, WATER - 1, gz1], [lo, WATER - 1, gz0], [lo, GY, gz0], [lo, GY, gz1], [0, 0, (gz1 - gz0) / 64, 0.3]);
      Q.quad([hi, WATER - 1, gz0], [hi, WATER - 1, gz1], [hi, GY, gz1], [hi, GY, gz0], [0, 0, (gz1 - gz0) / 64, 0.3]);
    }
    // embankment lamps, reflected as long columns on the water
    const span0 = rv.axis === 'x' ? gx0 : gz0, span1 = rv.axis === 'x' ? gx1 : gz1;
    const col = new THREE.Color('#ffc27a');
    for (let t = span0 + 20; t < span1 - 20; t += 30) {
      for (const [edge, out] of [[lo, -1], [hi, 1]]) {
        const u = edge + out * 2.5;
        const x = rv.axis === 'x' ? t : u, z = rv.axis === 'x' ? u : t;
        if (keep.blocked(x, z, 3) || inCorridor(x, z, 6)) continue;
        const dToRoute = Math.abs(t - (rv.axis === 'x' ? MP(0).x : MP(0).z));
        void dToRoute;
        lamp(x, GY + 4.6, z, 0, '#ffc27a', { r: 12, i: 0.7, halo: 0.6, size: 3.2, bake: false, hi: 4 });
        poles.city.push({ x, y: GY, z, ry: ryFor(rv.axis === 'x' ? 0 : -out, rv.axis === 'x' ? -out : 0), sy: 0.55 });
        if (lit) wstreaks.push({ x: rv.axis === 'x' ? x : x - out * 5, z: rv.axis === 'x' ? z - out * 5 : z, c: col.clone().multiplyScalar(0.55), s: 1 });
      }
    }
    // older street bridges across the water
    for (const bx of rv.bridges || []) {
      const pts = [];
      for (let t = rv.lo - 90; t <= rv.hi + 90; t += 4) {
        const k = smoothstep(rv.lo - 90, rv.lo - 20, t) * smoothstep(rv.hi + 90, rv.hi + 20, t);
        const arch = Math.sin(clamp((t - rv.lo) / (rv.hi - rv.lo), 0, 1) * Math.PI) * 2.2;
        const y = GY + 0.35 + (G + 1.6 + arch - GY - 0.35) * k;
        pts.push(rv.axis === 'x' ? [bx, t, y, F.W[0]] : [t, bx, y, F.W[0]]);
      }
      const Fp = pathRoad(pts, { key: 'br' + bx, walk: 2.2, barrier: 'parapet', deck: 1.4, pierR: 1.6, pierSp: 36, kind: (Fp2, j) => (inRiver(Fp2.X[j], Fp2.Z[j], 4) ? 'bridge' : 'fill') });
      // lamps along both rails, reflected below
      for (let j = 0; j <= Fp.last; j += 6) {
        if (!inRiver(Fp.X[j], Fp.Z[j], 10)) continue;
        for (const sd of [-1, 1]) {
          const lat = sd * (F.W[0] + 2.4);
          const x = Fp.X[j] + Fp.LX[j] * lat, z = Fp.Z[j] + Fp.LZ[j] * lat;
          lamp(x, Fp.Y[j] + 5.2, z, 0, '#ffd9a0', { r: 12, i: 0.8, halo: 0.6, size: 3, hi: 4, streak: false });
          poles.city.push({ x, y: Fp.Y[j] + 1.05, z, ry: ryFor(-sd * Fp.LX[j], -sd * Fp.LZ[j]), sy: 0.6 });
          if (lit) wstreaks.push({ x, z, c: new THREE.Color('#ffd9a0').multiplyScalar(0.5), s: 0.9 });
        }
      }
    }
    // the freeway's own lights mirrored in the river
    if (lit) {
      for (let s = F.s(0); s < F.s(all); s += xway ? X.pole / 2 : X.pole / 2) {
        const p = MP(s, xway ? 0 : 6);
        if (inRiver(p.x, p.z, -6)) wstreaks.push({ x: p.x, z: p.z, c: new THREE.Color(SODIUM).multiplyScalar(0.6), s: 1.2 });
      }
    }
  }
  tlog("0.5, 'RAISING THE CIT");
  progress(0.5, 'RAISING THE CITY');
  await nextFrame();

  // ------------------------------------------------------------ city blocks
  const route = [];
  for (let j = 0; j <= all; j += 10) { const a = F.at(j); route.push([F.X[a], F.Z[a], F.s(j)]); }
  const nearRoute = (x, z) => {
    let bd = Infinity, bs = 0;
    for (const r of route) {
      const d = (r[0] - x) ** 2 + (r[1] - z) ** 2;
      if (d < bd) { bd = d; bs = r[2]; }
    }
    return [Math.sqrt(bd), bs];
  };
  const FAC = {};
  const fac = (st, v) => {
    const k = st + v;
    if (!FAC[k]) {
      const tx = facadeTextures(st, v + (def.id || ''));
      FAC[k] = {
        gb: new GeoBuilder(),
        mat: new THREE.MeshStandardMaterial({
          map: tx.map, emissive: 0xffffff, emissiveMap: tx.emi, emissiveIntensity: lit ? (def.time === 'dusk' ? 0.75 : 0.95) : 0,
          roughness: st === 'glass' ? 0.3 : 0.85, metalness: st === 'glass' ? 0.4 : 0, envMapIntensity: st === 'glass' ? 1.1 : 0.3,
        }),
      };
    }
    return FAC[k].gb;
  };
  const UVS = { glass: [24, 56], dark: [18, 40], concrete: [18, 40], brick: [18, 40], stucco: [18, 40], warehouse: [28, 40] };
  const roofB = new GeoBuilder();
  const antennas = [];
  const crownA = bin('glowy', 'crowns');
  const occ = new Set();
  const OCC = 5;
  /** Footprint (center, axes, size) clear of roads, water and other buildings? Marks it if so. */
  const claim = (cx, cz, ux, uz, w, d) => {
    const cells = [];
    for (let a = -w / 2; a <= w / 2 + 0.01; a += Math.min(4.5, w / 2)) {
      for (let b = -d / 2; b <= d / 2 + 0.01; b += Math.min(4.5, d / 2)) {
        const x = cx + ux * a - uz * b, z = cz + uz * a + ux * b;
        if (keep.blocked(x, z, 1.5) || inRiver(x, z, 4)) return false;
        const k = Math.floor(x / OCC) * 100003 + Math.floor(z / OCC);
        if (occ.has(k)) return false;
        cells.push(k);
      }
    }
    for (const k of cells) occ.add(k);
    return true;
  };
  /** A building: stacked tiers for towers, roof clutter, crown lights, masts. */
  const building = (cx, cz, ry, w, d, h, st, opts = {}) => {
    const v = 0;
    const [uw, uh] = UVS[st];
    const tiers = opts.tiers ?? 1;
    let y = GY, ww = w, dd = d;
    for (let t = 0; t < tiers; t++) {
      const th = t === tiers - 1 ? h - (y - GY) : h * (0.55 - t * 0.12);
      fac(st, v).box(cx, y, cz, ww, th + 0.3, dd, ry, { uw, uh, top: false, v0: Math.floor(rng() * 4) * 0.25 });
      y += th;
      roofB.box(cx, y - 0.05, cz, ww + 0.5, 0.8, dd + 0.5, ry, { uw: 8, uh: 8 });
      ww *= 0.78; dd *= 0.78;
    }
    const ca = Math.cos(ry), sa = Math.sin(ry);
    const nAc = h < 60 ? Math.floor(rng() * 2.6) : 0;
    for (let k = 0; k < nAc; k++) {
      const ox = (rng() - 0.5) * ww * 0.6, oz = (rng() - 0.5) * dd * 0.6;
      roofB.box(cx + ox * ca + oz * sa, y + 0.7, cz - ox * sa + oz * ca, 2 + rng() * 3, 1.2 + rng() * 1.6, 2 + rng() * 2.5, ry, { uw: 4, uh: 4 });
    }
    if (opts.water && rng() < 0.3) {
      const wx = cx + (rng() - 0.5) * ww * 0.4, wz = cz + (rng() - 0.5) * dd * 0.4;
      roofB.cylinder(wx, y + 3.2, wz, 2.2, 4.2, 10, 2.2);
      for (const [ox, oz] of [[-1.4, -1.4], [1.4, -1.4], [-1.4, 1.4], [1.4, 1.4]]) roofB.box(wx + ox, y + 0.7, wz + oz, 0.25, 2.6, 0.25, 0);
    }
    if (h > 55 && rng() < 0.65) antennas.push([cx, y + 0.7, cz, 4 + rng() * (h > 140 ? 26 : 10)]);
    if (h > 70 && rng() < 0.45 && lit) {
      const cols = [[2.6, 2.6, 2.8], [0.6, 1.8, 3.2], [3.0, 0.5, 0.6], [0.6, 2.8, 1.2], [3, 2, 0.6]];
      const col = cols[Math.floor(rng() * cols.length)];
      const yb = y - 1.6;
      const hx = ww / 2 / 0.78 + 0.02, hz = dd / 2 / 0.78 + 0.02;
      const Lx = [ca, 0, -sa], Lz = [sa, 0, ca];
      // emissive band around the top tier
      for (const [nx, nz, half, oth] of [[Lz, Lx, hx, hz], [Lx, Lz, hz, hx]]) {
        for (const sg of [-1, 1]) {
          const c = [cx + nx[0] * oth * sg, yb, cz + nx[2] * oth * sg];
          const e = [nz[0] * half * sg, 0, nz[2] * half * sg];
          crownA.quad([c[0] - e[0], yb, c[2] - e[2]], [c[0] + e[0], yb, c[2] + e[2]], [c[0] + e[0], yb + 0.6, c[2] + e[2]], [c[0] - e[0], yb + 0.6, c[2] - e[2]], [0, 0, 1, 1], col);
        }
      }
    }
  };
  const zoneOf = (x, z, s) => {
    for (const c of cfg.downtown || []) {
      const dd = Math.hypot(x - c[0], z - c[1]);
      if (dd < c[2]) return { type: 'tower', core: 1 - dd / c[2], hMax: c[3] ?? 240 };
    }
    for (const zr of cfg.zones || []) if (s >= zr[0] && s <= zr[1]) return { type: zr[2], core: 0 };
    return { type: cfg.zone || 'mid', core: 0 };
  };
  const pickStyle = (tall) => (tall ? (rng() < 0.5 ? 'glass' : rng() < 0.5 ? 'dark' : 'concrete') : rng() < 0.45 ? 'brick' : rng() < 0.5 ? 'stucco' : 'concrete');

  // towers lining an elevated road (expressway canyon)
  for (const [s0, s1, hMin, hMax] of cfg.frontage || []) {
    for (const sd of [1, -1]) {
      let s = s0;
      while (s < s1) {
        const fw = 18 + rng() * 22, fd = 18 + rng() * 20;
        const p = MP(s + fw / 2), a = p.a;
        const lat = sd * ((sd < 0 ? extR(a) : extL(a)) + 4 + rng() * 6 + fd / 2);
        const q = MP(s + fw / 2, lat);
        const ux = F.TX[a], uz = F.TZ[a];
        if (claim(q.x, q.z, ux, uz, fw, fd)) {
          const h = hMin + Math.pow(rng(), 1.4) * (hMax - hMin);
          const st = h > 60 ? (rng() < 0.55 ? 'glass' : rng() < 0.5 ? 'dark' : 'concrete') : pickStyle(false);
          building(q.x, q.z, Math.atan2(ux, uz) + Math.PI / 2, fw, fd, h, st, { tiers: h > 90 && rng() < 0.5 ? 2 : 1, water: h < 40 });
          s += fw + 1 + (rng() < 0.2 ? 8 + rng() * 14 : 0);
        } else s += 6;
      }
    }
  }
  tlog("0.6, 'RAISING THE CIT");
  progress(0.6, 'RAISING THE CITY');
  await nextFrame();

  const lampCol = new THREE.Color(SODIUM);
  for (let bx = gx0; bx < gx1; bx += P) {
    for (let bz = gz0; bz < gz1; bz += P) {
      const [dist, s] = nearRoute(bx + P / 2, bz + P / 2);
      if (dist > cityR + 260) continue;
      // street lamps (pools are painted into the ground tile)
      if (lit && dist < (cfg.lampR ?? 640)) {
        const elevated = bridgeAt(MP(s).a);
        CITY_LAMPS.forEach(([lx, lz], li) => {
          const x = bx + lx, z = bz + lz;
          if ((dist > 330 && li % 2) || keep.blocked(x, z, 2) || inRiver(x, z, 3)) return;
          halos.push({ x, y: GY + 8.5, z, c: lampCol.clone().multiplyScalar(0.42), s: 3.4, f: 0.5 });
          if (dist < 150 && elevated) {
            const dx = lz < 10 ? 0 : lz > P - 10 ? 0 : lx < 10 ? -1 : 1, dz = lz < 10 ? -1 : lz > P - 10 ? 1 : 0;
            poles.city.push({ x, y: GY, z, ry: ryFor(dx, dz) });
            heads.push({ x: x + dx * 1.45, y: GY + 8.4, z: z + dz * 1.45, ry: ryFor(dx, dz), color: lampCol.clone().multiplyScalar(4) });
          }
        });
        if (dist < 420 && rng() < 0.6) {
          const c = rng() < 0.5 ? new THREE.Color('#ff2a1a') : new THREE.Color('#2aff8a');
          const x = bx + 9, z = bz + 9;
          if (!keep.blocked(x, z, 2) && !inRiver(x, z, 3)) halos.push({ x, y: GY + 5.2, z, c: c.multiplyScalar(0.7), s: 1.6, f: 0.5 });
        }
      }
      if (dist > cityR) continue;
      const z0 = zoneOf(bx + P / 2, bz + P / 2, s);
      const lo = 11.5, hi = P - 11.5, span = hi - lo;
      if (z0.type === 'tower') {
        const n = rng() < 0.5 ? 1 : 2;
        for (let k = 0; k < n; k++) {
          const w = 26 + rng() * 18, d = 26 + rng() * 18;
          const cx = bx + (n === 1 ? P / 2 : lo + span * (k ? 0.73 : 0.27)), cz = bz + P / 2 + (rng() - 0.5) * (span - d) * 0.8;
          const ww = n === 1 ? w : Math.min(w, span / 2 - 2);
          if (!claim(cx, cz, 1, 0, ww, d)) continue;
          const h = 50 + Math.pow(rng(), 1.3) * (z0.hMax - 50) * (0.35 + 0.65 * z0.core);
          building(cx, cz, 0, ww, d, h, pickStyle(true), { tiers: h > 110 ? 2 + (rng() < 0.4 ? 1 : 0) : 1 });
        }
      } else if (z0.type === 'suburb') {
        for (const row of [0, 1]) {
          for (let k = 0; k < 5; k++) {
            if (rng() < 0.15) continue;
            const w = 10 + rng() * 4, d = 9 + rng() * 3;
            const cx = bx + lo + span * (k + 0.5) / 5, cz = bz + (row ? hi - d / 2 - 2 : lo + d / 2 + 2);
            if (!claim(cx, cz, 1, 0, w, d)) continue;
            building(cx, cz, 0, w, d, 5 + rng() * 3.5, rng() < 0.6 ? 'stucco' : 'brick');
          }
        }
      } else if (z0.type === 'industrial' || z0.type === 'commercial') {
        const big = z0.type === 'industrial';
        const w = big ? 50 + rng() * 30 : 55 + rng() * 15, d = big ? 30 + rng() * 15 : 35 + rng() * 10;
        const cx = bx + P / 2 + (rng() - 0.5) * (span - w) * 0.8, cz = bz + P / 2 + (rng() - 0.5) * (span - d) * 0.8;
        if (claim(cx, cz, 1, 0, w, d)) building(cx, cz, 0, w, d, big ? 8 + rng() * 6 : 7 + rng() * 3, big ? 'warehouse' : rng() < 0.5 ? 'concrete' : 'stucco');
        if (!big && rng() < 0.7) {
          const px = bx + lo + 8, pz = bz + hi - 8;
          if (claim(px, pz, 1, 0, 12, 12)) building(px, pz, 0, 12, 12, 4.5, 'stucco');
        }
      } else {
        for (let q = 0; q < 4; q++) {
          if (rng() < 0.18) continue;
          const qx = bx + lo + (q % 2 ? 0.75 : 0.25) * span, qz = bz + lo + (q > 1 ? 0.75 : 0.25) * span;
          const w = 22 + rng() * 18, d = 22 + rng() * 18;
          if (!claim(qx, qz, 1, 0, w, d)) continue;
          const tall = rng() < 0.18;
          const h = tall ? 35 + rng() * 45 : 9 + rng() * 22;
          building(qx, qz, 0, w, d, h, pickStyle(tall), { water: !tall });
        }
      }
    }
  }
  for (const k of Object.keys(FAC)) {
    if (!FAC[k].gb.count) continue;
    const m = new THREE.Mesh(FAC[k].gb.build(), FAC[k].mat);
    m.receiveShadow = true;
    m.castShadow = shadows;
    world.add(m);
  }
  const roofTex = groundTexture('gravel');
  world.add(new THREE.Mesh(roofB.build(), new THREE.MeshStandardMaterial({ map: roofTex, color: 0x6e6e6e, roughness: 0.9 })));
  if (antennas.length) {
    const A = new Acc();
    for (const [x, y, z, h] of antennas) {
      cyl(A, x, y, z, 0.22, h, 5, 0.08);
      blinkers.push({ x, y: y + h + 0.3, z });
    }
    world.add(new THREE.Mesh(A.geometry(), MATS.steel.mat));
  }
  tlog("0.72, 'LIGHTING THE S");
  progress(0.72, 'LIGHTING THE SKYLINE');
  await nextFrame();

  // ------------------------------------------------------------ skyline in the haze
  {
    const gb = new GeoBuilder();
    const cxm = (bMinX + bMaxX) / 2, czm = (bMinZ + bMaxZ) / 2;
    const spanR = Math.max(bMaxX - bMinX, bMaxZ - bMinZ) / 2;
    const sk = cfg.skyline || {};
    const dMin = sk.min ?? cityR + 250, dMax = skyMax;
    let placed = 0;
    for (let k = 0; k < 4000 && placed < (sk.n ?? 110); k++) {
      const ang = rng() * Math.PI * 2, r = rng() * (spanR + dMax);
      const x = cxm + Math.cos(ang) * r, z = czm + Math.sin(ang) * r;
      const [dist] = nearRoute(x, z);
      if (dist < dMin || dist > dMax || inRiver(x, z, 30)) continue;
      const w = 22 + rng() * 40, d = 22 + rng() * 40;
      const h = 40 + Math.pow(rng(), 2.2) * (sk.hMax ?? 200);
      gb.box(x, GY, z, w, h, d, rng() * Math.PI, { uw: 20, uh: 44, top: false });
      if (h > 120 && lit) blinkers.push({ x, y: GY + h + 2, z, far: true });
      placed++;
    }
    for (const [x0, z0, r0, n, hMax] of cfg.far || []) {
      for (let k = 0; k < n; k++) {
        const a = rng() * Math.PI * 2, r = Math.sqrt(rng()) * r0;
        const x = x0 + Math.cos(a) * r, z = z0 + Math.sin(a) * r;
        const core = 1 - r / r0;
        const w = 25 + rng() * 30, d = 25 + rng() * 30;
        const h = 50 + Math.pow(rng(), 1.5) * hMax * (0.4 + 0.6 * core);
        gb.box(x, GY, z, w, h, d, Math.floor(rng() * 4) * 0.4, { uw: 20, uh: 44, top: false });
        if (h > 110 && lit) blinkers.push({ x, y: GY + h + 2, z, far: true });
      }
    }
    const tex = facadeTextures('dark', 'sky' + def.id);
    const tex2 = facadeTextures('glass', 'sky' + def.id);
    void tex2;
    const mat = weakFog(new THREE.MeshStandardMaterial({ map: tex.map, emissive: 0xffffff, emissiveMap: tex.emi, emissiveIntensity: lit ? 1.7 : 0, color: 0x8890a0, roughness: 0.8 }), sk.fog ?? 0.42);
    if (gb.count) world.add(new THREE.Mesh(gb.build(), mat));
  }

  // ------------------------------------------------------------ billboards & pole signs
  {
    const n = cfg.ads ?? 8;
    const face = bin('ads', 'ads');
    for (let k = 0; k < n; k++) {
      const s = ((k + 0.5) * track.length) / n + (rng() - 0.5) * 100;
      const sd = k % 2 ? 1 : -1;
      const p = MP(s), a = p.a;
      const off = (sd < 0 ? extR(a) : extL(a)) + (xway ? 9 : gradeAt(a) && inS(cfg.soundWalls, s) ? 14 : 30) + rng() * 8;
      const q = MP(s, sd * off);
      if (keep.blocked(q.x, q.z, 3) || inRiver(q.x, q.z, 3) || inCorridor(q.x, q.z, 2)) continue;
      const ad = ADS[k % ADS.length];
      const r = adAt.alloc(14, 4.8);
      drawAd(adAt, r, ad, rng);
      // face the oncoming traffic, turned toward the road
      const nx = -F.TX[a] - sd * F.LX[a] * 0.5, nz = -F.TZ[a] - sd * F.LZ[a] * 0.5, nl = Math.hypot(nx, nz);
      const nn = [nx / nl, 0, nz / nl];
      const e1 = [nn[2], 0, -nn[0]]; // up × n
      const yb = Math.max(F.Y[a] + 7.5, GY + 11);
      const c = [q.x, yb + 2.4, q.z];
      const hw = 7, hh = 2.4;
      face.quad([c[0] - e1[0] * hw, yb, c[2] - e1[2] * hw], [c[0] + e1[0] * hw, yb, c[2] + e1[2] * hw], [c[0] + e1[0] * hw, yb + 4.8, c[2] + e1[2] * hw], [c[0] - e1[0] * hw, yb + 4.8, c[2] - e1[2] * hw], r.uv);
      const st = bin('steel', 'ads');
      obox(st, [c[0] - nn[0] * 0.25, c[1], c[2] - nn[2] * 0.25], e1, UP, [-nn[0], 0, -nn[2]], hw + 0.25, hh + 0.25, 0.2);
      obox(st, [c[0] + nn[0] * 0.4, yb - 0.25, c[2] + nn[2] * 0.4], e1, UP, [-nn[0], 0, -nn[2]], hw, 0.05, 0.6);
      const gy = groundAt(q.x, q.z);
      cyl(st, q.x - nn[0] * 0.6, gy, q.z - nn[2] * 0.6, 0.55, yb - gy, 10, 0.45);
      for (let f = -0.75; f <= 0.76; f += 0.5) {
        const lx = c[0] + e1[0] * hw * f + nn[0] * 1.1, lz = c[2] + e1[2] * hw * f + nn[2] * 1.1;
        obox(bin('glowy', 'ads'), [lx, yb - 0.15, lz], e1, UP, [-nn[0], 0, -nn[2]], 0.25, 0.1, 0.18, 1, lit ? [3, 3, 2.6] : [0.3, 0.3, 0.3]);
      }
    }
    for (const ps of cfg.poleSigns || []) {
      const p = MP(ps.s), a = p.a;
      const q = MP(ps.s, ps.side * ((ps.side < 0 ? extR(a) : extL(a)) + ps.off));
      if (keep.blocked(q.x, q.z, 2) || inCorridor(q.x, q.z, 2)) continue;
      const ad = POLE_ADS[ps.ad % POLE_ADS.length];
      const r = adAt.alloc(6, 3.6);
      drawPoleAd(adAt, r, ad);
      const h = ps.h ?? 22;
      const ux = F.TX[a], uz = F.TZ[a];
      const e1 = [uz, 0, -ux];
      const yb = GY + h;
      const c = [q.x, yb + 1.8, q.z];
      for (const sg of [-1, 1]) {
        const o = [ux * sg * 0.42, 0, uz * sg * 0.42];
        const e = [e1[0] * sg * 3, 0, e1[2] * sg * 3];
        face.quad([c[0] + o[0] + e[0], yb, c[2] + o[2] + e[2]], [c[0] + o[0] - e[0], yb, c[2] + o[2] - e[2]], [c[0] + o[0] - e[0], yb + 3.6, c[2] + o[2] - e[2]], [c[0] + o[0] + e[0], yb + 3.6, c[2] + o[2] + e[2]], sg < 0 ? r.uv : [r.uv[2], r.uv[1], r.uv[0], r.uv[3]]);
      }
      const st = bin('steel', 'ads');
      obox(st, c, e1, UP, [ux, 0, uz], 3.08, 1.86, 0.4);
      cyl(st, q.x, GY, q.z, 0.45, h, 10, 0.4);
      if (lit) halos.push({ x: c[0], y: c[1], z: c[2], c: new THREE.Color(ad[3]).multiplyScalar(0.35), s: 9, f: 0.4 });
    }
    adTex.needsUpdate = true;
  }
  tlog("0.85, 'WIRING THE LAM");
  progress(0.85, 'WIRING THE LAMPS');
  await nextFrame();

  // ------------------------------------------------------------ city glow on the horizon
  if (lit) {
    const geo = new THREE.CylinderGeometry(2900, 2900, 460, 48, 1, true);
    geo.translate(0, 190, 0);
    const dusk = def.time === 'dusk';
    const mat = new THREE.ShaderMaterial({
      side: THREE.BackSide, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
      uniforms: { col: { value: new THREE.Color(cfg.glow || (dusk ? '#ff6a58' : '#ff8a3a')).multiplyScalar(dusk ? 0.1 : 0.2) } },
      vertexShader: 'varying float vY; void main(){ vY = uv.y; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: 'uniform vec3 col; varying float vY; void main(){ gl_FragColor = vec4(col * pow(1.0 - vY, 2.4), 1.0); }',
    });
    const dome = new THREE.Mesh(geo, mat);
    dome.frustumCulled = false;
    world.add(dome);
    world.animators.push((dt, cam) => dome.position.set(cam.position.x, GY, cam.position.z));
  }

  // ------------------------------------------------------------ oncoming traffic beyond the median
  if (!xway && (cfg.oncoming ?? 36) > 0) {
    const n = cfg.oncoming ?? 36;
    const lane0 = F.W[0] + X.shL + X.med + X.oppGap;
    const geo = new THREE.BoxGeometry(1.85, 1.2, 4.4);
    geo.translate(0, 0.85, 0);
    const bodies = new THREE.InstancedMesh(geo, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.35, metalness: 0.6 }), n);
    const paints = ['#1b1d22', '#6a6e75', '#2a3550', '#5a1a1a', '#c8c8c8', '#20302a', '#3a3a3e'];
    for (let k = 0; k < n; k++) bodies.setColorAt(k, new THREE.Color(paints[k % paints.length]));
    bodies.frustumCulled = false;
    world.add(bodies);
    const white = new THREE.Color(1, 0.94, 0.82).multiplyScalar(0.95), red = new THREE.Color(1, 0.08, 0.04).multiplyScalar(0.6);
    const lights = lit ? haloMesh(Array.from({ length: n * 4 }, (_, k) => ({ x: 0, y: -999, z: 0, c: k % 4 < 2 ? white : red, s: k % 4 < 2 ? 1.5 : 0.8, f: 0.5 })), fogD) : null;
    if (lights) world.add(lights);
    const cars = Array.from({ length: n }, (_, k) => ({ s: 0, lat: lane0 + 2 + 4 * (k % 4), v: 22 + rng() * 8 + (k % 4) * 2.5 }));
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), pv = new THREE.Vector3(), one = new THREE.Vector3(1, 1, 1), yAx = new THREE.Vector3(0, 1, 0);
    const r0 = -260, span = 1600;
    let init = false;
    world.animators.push((dt, cam) => {
      const cs = F.s(mainProj(cam.position.x, cam.position.z).a);
      if (!init) { cars.forEach((c, k) => { c.s = cs + r0 + (span * (k + rng())) / n; }); init = true; }
      const ip = lights?.geometry.attributes.ipos;
      cars.forEach((c, k) => {
        c.s -= c.v * Math.min(dt, 0.1);
        if (c.s < cs + r0) c.s += span;
        else if (c.s > cs + r0 + span) c.s -= span;
        const p = MP(c.s, c.lat);
        q.setFromAxisAngle(yAx, Math.atan2(-p.tx, -p.tz));
        m4.compose(pv.set(p.x, p.y, p.z), q, one);
        bodies.setMatrixAt(k, m4);
        if (!ip) return;
        for (let h = 0; h < 4; h++) {
          const fwd = h < 2 ? -2.25 : 2.25, side = h % 2 ? 0.68 : -0.68;
          ip.setXYZ(k * 4 + h, p.x + p.tx * fwd + p.lx * side, p.y + 0.72, p.z + p.tz * fwd + p.lz * side);
        }
      });
      bodies.instanceMatrix.needsUpdate = true;
      if (ip) ip.needsUpdate = true;
    });
  }

  // ------------------------------------------------------------ flush
  const cull = [];
  for (const A of bins.values()) {
    if (!A.ix.length) continue;
    const M = MATS[A.cls];
    const g = A.geometry();
    if (M.glow) g.setAttribute('glow', new THREE.BufferAttribute(new Float32Array(A.n * 3), 3));
    g.computeBoundingSphere();
    const m = new THREE.Mesh(g, M.mat);
    m.receiveShadow = true;
    m.castShadow = !!M.cast && shadows;
    world.add(m);
    if (M.glow) world.glowMeshes.push(m);
    if (g.boundingSphere.radius < 1500) cull.push(m);
  }
  // wet-road streaks are built after this returns, as quads facing down
  // (back-face culled): show both sides here, a little softer
  if (wet) {
    let done = false;
    world.animators.push(() => {
      if (done || !world.streakMat) return;
      world.streakMat.side = THREE.DoubleSide;
      world.streakMat.uniforms.strength.value = 1.0;
      world.streakMat.uniforms.map.value = softStreakTex();
      world.streakMat.needsUpdate = true;
      done = true;
    });
  }
  // past the fog everything is invisible anyway: skip far chunks entirely
  const cullD = cfg.cullD ?? 1350;
  world.animators.push((dt, cam) => {
    for (const m of cull) {
      const b = m.geometry.boundingSphere;
      m.visible = cam.position.distanceTo(b.center) - b.radius < cullD;
    }
  });
  const steel = MATS.steel.mat;
  if (poles.double.length) world.add(instanced(poleGeo('double'), steel, poles.double, { shadow: shadows }));
  if (poles.single.length) world.add(instanced(poleGeo('single'), steel, poles.single, { shadow: shadows }));
  if (poles.city.length) world.add(instanced(poleGeo('city'), steel, poles.city));
  if (heads.length) world.add(instanced(new THREE.BoxGeometry(0.85, 0.2, 0.42), new THREE.MeshBasicMaterial({ color: 0xffffff }), heads));
  if (halos.length) world.add(haloMesh(halos, fogD));
  if (wstreaks.length) waterStreaks(world, wstreaks, WATER);
  if (blinkers.length && lit) {
    const near = blinkers.filter((b) => !b.far), far = blinkers.filter((b) => b.far);
    const red = new THREE.Color('#ff2a1a');
    const ims = [];
    if (near.length) ims.push(instanced(new THREE.SphereGeometry(0.4, 6, 4), new THREE.MeshBasicMaterial({ color: red.clone().multiplyScalar(6) }), near));
    const farH = haloMesh(far.map((b) => ({ x: b.x, y: b.y, z: b.z, c: red.clone().multiplyScalar(0.9), s: 5, f: 0.18 })), fogD);
    ims.push(farH);
    for (const m of ims) world.add(m);
    let t = 0;
    world.animators.push((dt) => { t += dt; const on = t % 1.6 < 0.8; for (const m of ims) m.visible = on; });
  }
  tlog("1, 'HIGHWAY READY');");
  progress(1, 'HIGHWAY READY');
}

export default { terrain: false, build };
