// THE WORKS and EASTSIDE — what both packs build with: materials made once
// and shared by the two packs (through B.mat, so they're compiled at load),
// a local frame for placing things on a footprint, facades laid bay by bay
// from an atlas, roofs, and the street furniture both districts use.
import * as THREE from 'three';
import { litMat, plainMat, cylinder, cone, sphere } from '../builder.js';
import { concreteTexture, groundTexture } from '../../../track/textures.js';
import { plankTexture } from '../../kit.js';
import { tileUV } from './atlas.js';
import { chainlink, plainBrick } from './tex.js';

// ------------------------------------------------------------------ colours

const _c = new THREE.Color();
const COLS = new Map();
/** Hex → linear [r, g, b] for vertex colours (cached). */
export function rgb(hex) {
  let v = COLS.get(hex);
  if (!v) { _c.set(hex); v = [_c.r, _c.g, _c.b]; COLS.set(hex, v); }
  return v;
}
/** a × k (a tint made darker/lighter). */
export const shade = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
export const mixc = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
export const WHITE = [1, 1, 1];

// ------------------------------------------------------------------ materials

const SHARED = new Map();
/** A material both of these packs use (one instance, registered through either pack's B.mat). */
export function sharedMat(B, key, make) {
  return B.mat('ee:' + key, () => {
    if (!SHARED.has(key)) SHARED.set(key, make());
    return SHARED.get(key);
  });
}

export const M = {
  steel: (B) => sharedMat(B, 'steel', () => litMat({ color: 0xffffff, vertexColors: true, roughness: 0.55, metalness: 0.45, envMapIntensity: 0.6 })),
  paint: (B) => sharedMat(B, 'paint', () => litMat({ color: 0xffffff, vertexColors: true, roughness: 0.75, metalness: 0.05, envMapIntensity: 0.45 })),
  glossy: (B) => sharedMat(B, 'glossy', () => litMat({ color: 0xffffff, vertexColors: true, roughness: 0.32, metalness: 0.35, envMapIntensity: 1.0 })),
  glass: (B) => sharedMat(B, 'glass', () => litMat({ color: 0x0c1218, roughness: 0.12, metalness: 0.6, envMapIntensity: 1.3 })),
  dark: (B) => sharedMat(B, 'dark', () => litMat({ color: 0x0b0b0c, roughness: 0.9 }, { shadow: false })),
  concrete: (B) => sharedMat(B, 'concrete', () => litMat({ map: concreteTexture('#8d8c88', 'bridge'), vertexColors: true, roughness: 0.88, envMapIntensity: 0.35 })),
  wood: (B) => sharedMat(B, 'wood', () => litMat({ map: plankTexture(), vertexColors: true, roughness: 0.85 })),
  /** Unlit glow (lamp heads, bulbs, lit panels), vertex-coloured. */
  glow: (B) => sharedMat(B, 'glow', () => new THREE.MeshBasicMaterial({ vertexColors: true, color: new THREE.Color(1, 1, 1).multiplyScalar(2.6), toneMapped: true })),
  chain: (B) => sharedMat(B, 'chain', () => litMat({ map: chainlink(), alphaTest: 0.42, side: THREE.DoubleSide, roughness: 0.5, metalness: 0.55, envMapIntensity: 0.5 }, { shadow: false })),
  lot: (B) => sharedMat(B, 'lot', () => litMat({ map: groundTexture('asphaltlot'), roughness: 0.95, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }, { shadow: false })),
  dirt: (B) => sharedMat(B, 'dirt', () => litMat({ map: groundTexture('dirt'), roughness: 0.97, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }, { shadow: false })),
  pave: (B) => sharedMat(B, 'pave', () => litMat({ map: concreteTexture('#9a9890', 'pave'), roughness: 0.9, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }, { shadow: false })),
  /** Painted lines on lots and yards (drawn flat over a drape). */
  line: (B) => sharedMat(B, 'line', () => litMat({ color: 0xffffff, vertexColors: true, roughness: 0.6, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 }, { shadow: false })),
  bplain: (B) => sharedMat(B, 'bplain', () => litMat({ map: plainBrick(), vertexColors: true, roughness: 0.92, envMapIntensity: 0.3 })),
  trunk: (B) => sharedMat(B, 'trunk', () => litMat({ color: 0x4a3a2c, roughness: 0.92 })),
  leaf: (B) => sharedMat(B, 'leaf', () => litMat({ color: 0xffffff, vertexColors: true, roughness: 0.85, flatShading: true })),
};

// ------------------------------------------------------------------ frames and quads

/** A local frame on a footprint: (x, z) its centre, ry its turn, y its base (box() convention). */
export class Frame {
  constructor(x, z, ry = 0, y = 0) { this.set(x, z, ry, y); }
  set(x, z, ry = 0, y = 0) { this.x = x; this.z = z; this.ry = ry; this.y = y; this.c = Math.cos(ry); this.s = Math.sin(ry); return this; }
  /** Local (lx, ly, lz) → world [x, y, z]. */
  P(lx, ly, lz) { return [this.x + lx * this.c + lz * this.s, this.y + ly, this.z - lx * this.s + lz * this.c]; }
  X(lx, lz) { return this.x + lx * this.c + lz * this.s; }
  Z(lx, lz) { return this.z - lx * this.s + lz * this.c; }
  /** World direction of local (dx, dz). */
  dir(dx, dz) { return [dx * this.c + dz * this.s, -dx * this.s + dz * this.c]; }
}

/** A wall quad from local (ax, az) to (bx, bz) (facing (−dz, dx) of a→b), y0..y1 above the frame. */
export function wallQ(acc, F, ax, az, bx, bz, y0, y1, uv = [0, 0, 1, 1]) {
  acc.quadP(F.P(ax, y0, az), F.P(bx, y0, bz), F.P(bx, y1, bz), F.P(ax, y1, az), uv);
}
/** A flat quad (local corners, counter-clockwise seen from above with +z toward the viewer's bottom). */
export function flatQ(acc, F, x0, z0, x1, z1, y, up = true, uv = [0, 0, 1, 1]) {
  if (up) acc.quadP(F.P(x0, y, z1), F.P(x1, y, z1), F.P(x1, y, z0), F.P(x0, y, z0), uv);
  else acc.quadP(F.P(x0, y, z0), F.P(x1, y, z0), F.P(x1, y, z1), F.P(x0, y, z1), uv);
}
/**
 * A box in a frame: local centre-bottom (lx, ly, lz), size w (local x) × h × d,
 * turned a further `ry`. uv in metres / u. faces/top as builder.box.
 */
export function boxL(acc, F, lx, ly, lz, w, h, d, ry = 0, o = {}) {
  const c = Math.cos(F.ry + ry), s = Math.sin(F.ry + ry);
  const x = F.X(lx, lz), z = F.Z(lx, lz), y = F.y + ly;
  const P = (px, py, pz) => [x + px * c + pz * s, y + py, z - px * s + pz * c];
  const hw = w / 2, hd = d / 2, U = o.u || 1;
  const F2 = o.faces || 'fblr';
  const uv = o.uv;
  if (F2.includes('f')) acc.quadP(P(-hw, 0, hd), P(hw, 0, hd), P(hw, h, hd), P(-hw, h, hd), uv || [0, 0, w / U, h / U]);
  if (F2.includes('b')) acc.quadP(P(hw, 0, -hd), P(-hw, 0, -hd), P(-hw, h, -hd), P(hw, h, -hd), uv || [0, 0, w / U, h / U]);
  if (F2.includes('r')) acc.quadP(P(hw, 0, hd), P(hw, 0, -hd), P(hw, h, -hd), P(hw, h, hd), uv || [0, 0, d / U, h / U]);
  if (F2.includes('l')) acc.quadP(P(-hw, 0, -hd), P(-hw, 0, hd), P(-hw, h, hd), P(-hw, h, -hd), uv || [0, 0, d / U, h / U]);
  if (o.top !== false) acc.quadP(P(-hw, h, hd), P(hw, h, hd), P(hw, h, -hd), P(-hw, h, -hd), o.topUV || uv || [0, 0, w / U, d / U]);
  if (o.bottom) acc.quadP(P(-hw, 0, -hd), P(hw, 0, -hd), P(hw, 0, hd), P(-hw, 0, hd), uv || [0, 0, w / U, d / U]);
}
/** A box in world coordinates (base centre), colour col. */
export function boxW(acc, x, y, z, w, h, d, ry = 0, col = null, o = {}) {
  if (col) acc.col = col;
  const c = Math.cos(ry), s = Math.sin(ry);
  const P = (px, py, pz) => [x + px * c + pz * s, y + py, z - px * s + pz * c];
  const hw = w / 2, hd = d / 2, U = o.u || 1;
  const uv = o.uv;
  acc.quadP(P(-hw, 0, hd), P(hw, 0, hd), P(hw, h, hd), P(-hw, h, hd), uv || [0, 0, w / U, h / U]);
  acc.quadP(P(hw, 0, -hd), P(-hw, 0, -hd), P(-hw, h, -hd), P(hw, h, -hd), uv || [0, 0, w / U, h / U]);
  acc.quadP(P(hw, 0, hd), P(hw, 0, -hd), P(hw, h, -hd), P(hw, h, hd), uv || [0, 0, d / U, h / U]);
  acc.quadP(P(-hw, 0, -hd), P(-hw, 0, hd), P(-hw, h, hd), P(-hw, h, -hd), uv || [0, 0, d / U, h / U]);
  if (o.top !== false) acc.quadP(P(-hw, h, hd), P(hw, h, hd), P(hw, h, -hd), P(-hw, h, -hd), uv || [0, 0, w / U, d / U]);
}
/** A quad strip tube (n sides) between two world points. */
export function tube(acc, a, b, r, n = 6, r2 = r) {
  const dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2];
  const L = Math.hypot(dx, dy, dz) || 1;
  const t = [dx / L, dy / L, dz / L];
  let up = Math.abs(t[1]) > 0.9 ? [1, 0, 0] : [0, 1, 0];
  const s = [t[1] * up[2] - t[2] * up[1], t[2] * up[0] - t[0] * up[2], t[0] * up[1] - t[1] * up[0]];
  const sl = Math.hypot(s[0], s[1], s[2]) || 1;
  s[0] /= sl; s[1] /= sl; s[2] /= sl;
  up = [s[1] * t[2] - s[2] * t[1], s[2] * t[0] - s[0] * t[2], s[0] * t[1] - s[1] * t[0]];
  for (let k = 0; k < n; k++) {
    const a0 = (k / n) * Math.PI * 2, a1 = ((k + 1) / n) * Math.PI * 2;
    const o0 = [s[0] * Math.cos(a0) + up[0] * Math.sin(a0), s[1] * Math.cos(a0) + up[1] * Math.sin(a0), s[2] * Math.cos(a0) + up[2] * Math.sin(a0)];
    const o1 = [s[0] * Math.cos(a1) + up[0] * Math.sin(a1), s[1] * Math.cos(a1) + up[1] * Math.sin(a1), s[2] * Math.cos(a1) + up[2] * Math.sin(a1)];
    acc.quadP(
      [a[0] + o1[0] * r, a[1] + o1[1] * r, a[2] + o1[2] * r], [a[0] + o0[0] * r, a[1] + o0[1] * r, a[2] + o0[2] * r],
      [b[0] + o0[0] * r2, b[1] + o0[1] * r2, b[2] + o0[2] * r2], [b[0] + o1[0] * r2, b[1] + o1[1] * r2, b[2] + o1[2] * r2],
      [0, 0, 1, L],
    );
  }
}

// ------------------------------------------------------------------ facades

/**
 * A facade along a wall from local (ax, az) to (bx, bz), facing (−dz, dx),
 * from y0 up: rows [{ h, tile(i, n, row) → id | null, v?: [fy0, fy1] (the
 * part of the tile used, from its bottom; default the bottom h of it, all
 * of it if the row is taller), tall?: true }], bays about o.bay (A.mw)
 * wide. A tall row's tile is the top of two (the one below it the bottom).
 * Returns the bay count.
 */
export function facade(acc, F, A, ax, az, bx, bz, y0, rows, o = {}) {
  const len = Math.hypot(bx - ax, bz - az);
  const n = Math.max(1, Math.round(len / (o.bay || A.mw)));
  const ux = (bx - ax) / n, uz = (bz - az) / n;
  const cols = A.W / A.tw;
  let y = y0;
  for (let r = 0; r < rows.length; r++) {
    const row = rows[r];
    if (row.h <= 0.01) continue;
    for (let i = 0; i < n; i++) {
      const id = row.tile(i, n, r);
      if (id === null || id === undefined) continue;
      const px0 = ax + ux * i, pz0 = az + uz * i, px1 = px0 + ux, pz1 = pz0 + uz;
      if (row.tall) {
        const hh = row.h / 2;
        wallQ(acc, F, px0, pz0, px1, pz1, y, y + hh, tileUV(A, id + cols));
        wallQ(acc, F, px0, pz0, px1, pz1, y + hh, y + row.h, tileUV(A, id));
      } else {
        const v = row.v || [0, Math.min(1, row.h / A.mh)];
        wallQ(acc, F, px0, pz0, px1, pz1, y, y + row.h, tileUV(A, id, 0, v[0], 1, v[1]));
      }
    }
    y += row.h;
  }
  return n;
}

/** A wall in plain bays of one tile (sub-rect) repeated along it: (ax,az)→(bx,bz), y0..y1. */
export function plainWall(acc, F, A, id, ax, az, bx, bz, y0, y1) {
  const len = Math.hypot(bx - ax, bz - az);
  const n = Math.max(1, Math.round(len / A.mw));
  const ux = (bx - ax) / n, uz = (bz - az) / n;
  const rows = Math.max(1, Math.round((y1 - y0) / A.mh));
  const rh = (y1 - y0) / rows;
  for (let r = 0; r < rows; r++) {
    for (let i = 0; i < n; i++) {
      const px0 = ax + ux * i, pz0 = az + uz * i;
      wallQ(acc, F, px0, pz0, px0 + ux, pz0 + uz, y0 + r * rh, y0 + (r + 1) * rh, tileUV(A, id));
    }
  }
}

/**
 * A gable end in an atlas wall: the triangle over the base from local
 * (ax, az) to (bx, bz) at height y, apex `rise` over the middle (facing
 * (−dz, dx) like a wall), split into strips a tile wide so the texture
 * keeps its scale across; its height stretches the tile to fit.
 */
export function gableStrips(acc, F, A, id, ax, az, bx, bz, y, rise) {
  const len = Math.hypot(bx - ax, bz - az);
  const n = Math.max(1, Math.round(len / A.mw));
  const H = (t) => rise * (1 - Math.abs(2 * t - 1));
  const span = Math.max(A.mh, rise);
  for (let k = 0; k < n; k++) {
    const t0 = k / n, t1 = (k + 1) / n;
    const cuts = t0 < 0.5 && t1 > 0.5 ? [t0, 0.5, t1] : [t0, t1];
    const uv = tileUV(A, id);
    for (let q = 0; q < cuts.length - 1; q++) {
      const s0 = cuts[q], s1 = cuts[q + 1];
      const u0 = uv[0] + (uv[2] - uv[0]) * (s0 - t0) / (t1 - t0), u1 = uv[0] + (uv[2] - uv[0]) * (s1 - t0) / (t1 - t0);
      const h0 = H(s0), h1 = H(s1);
      const vt = (h) => uv[1] + (uv[3] - uv[1]) * (h / span);
      const ia = acc.v(...F.P(ax + (bx - ax) * s0, y, az + (bz - az) * s0), u0, uv[1]);
      const ib = acc.v(...F.P(ax + (bx - ax) * s1, y, az + (bz - az) * s1), u1, uv[1]);
      const ic = acc.v(...F.P(ax + (bx - ax) * s1, y + h1, az + (bz - az) * s1), u1, vt(h1));
      const idd = acc.v(...F.P(ax + (bx - ax) * s0, y + h0, az + (bz - az) * s0), u0, vt(h0));
      if (h0 < 1e-3) acc.tri(ia, ib, ic);
      else if (h1 < 1e-3) acc.tri(ia, ib, idd);
      else acc.quad(ia, ib, ic, idd);
    }
  }
}

/** A gable-end triangle in a wall plane: base from local (ax,az) to (bx,bz) at y, apex `rise` over the middle; uv from a tile. */
export function gableTri(acc, F, ax, az, bx, bz, y, rise, uv) {
  const mx = (ax + bx) / 2, mz = (az + bz) / 2;
  const a = acc.v(...F.P(ax, y, az), uv[0], uv[1]);
  const b = acc.v(...F.P(bx, y, bz), uv[2], uv[1]);
  const t = acc.v(...F.P(mx, y + rise, mz), (uv[0] + uv[2]) / 2, uv[3]);
  acc.tri(a, b, t);
}

/** A sloped quad (a roof plane) in a frame: corners (local x, y, z), uv. */
export function slope(acc, F, p0, p1, p2, p3, uv = [0, 0, 1, 1]) {
  acc.quadP(F.P(...p0), F.P(...p1), F.P(...p2), F.P(...p3), uv);
}

// ------------------------------------------------------------------ fences

/**
 * Chain-link along a polyline of world [x, z] points (ground-following),
 * posts every ~3 m, h tall (razor wire included). gaps: indices of
 * segments left open (gates).
 */
export function chainFence(B, pts, h = 3, o = {}) {
  const fm = B.near(M.chain(B)), pm = B.near(M.steel(B));
  pm.col = o.post || rgb('#5a5e62');
  let u = 0;
  for (let k = 0; k < pts.length - 1; k++) {
    const [ax, az] = pts[k], [bx, bz] = pts[k + 1];
    const len = Math.hypot(bx - ax, bz - az);
    if (len < 0.1) continue;
    if (o.gaps && o.gaps.includes(k)) { u += len; continue; }
    const n = Math.max(1, Math.round(len / 3));
    for (let i = 0; i < n; i++) {
      const t0 = i / n, t1 = (i + 1) / n;
      const x0 = ax + (bx - ax) * t0, z0 = az + (bz - az) * t0, x1 = ax + (bx - ax) * t1, z1 = az + (bz - az) * t1;
      const y0 = B.groundY(x0, z0), y1 = B.groundY(x1, z1);
      const seg = len / n;
      fm.quadP([x0, y0 + 0.05, z0], [x1, y1 + 0.05, z1], [x1, y1 + h, z1], [x0, y0 + h, z0], [u / 2.6, 0, (u + seg) / 2.6, 1]);
      u += seg;
      pm.cyl(x0, y0 - 0.3, z0, 0.045, h + 0.3, 5);
    }
    pm.cyl(bx, B.groundY(bx, bz) - 0.3, bz, 0.05, h + 0.3, 5);
  }
}

// ------------------------------------------------------------------ lights

/** Lamp heads: a glowing box (world), colour hex. */
export function glowBox(B, x, y, z, w, h, d, ry, hex, near = false) {
  const g = near ? B.near(M.glow(B)) : B.acc(M.glow(B));
  g.col = rgb(hex);
  g.box(x, y, z, w, h, d, ry);
}

/** A floodlight mast: pole to h, a cross-bar with `heads` lamps aimed along ry. */
export function floodMast(B, x, z, h, heads, ry, hex = '#ffa040') {
  const y = B.groundY(x, z);
  const st = B.acc(M.steel(B));
  st.col = rgb('#4a4e52');
  st.cyl(x, y - 0.4, z, 0.16, h + 0.4, 6, 0.11);
  const c = Math.cos(ry), s = Math.sin(ry);
  const bw = Math.max(1, heads) * 0.9;
  st.beam(x - c * bw / 2, y + h, z + s * bw / 2, x + c * bw / 2, y + h, z - s * bw / 2, 0.14, 0.14);
  for (let k = 0; k < heads; k++) {
    const t = heads === 1 ? 0 : (k / (heads - 1) - 0.5) * bw;
    const hx = x + c * t + s * 0.35, hz = z - s * t + c * 0.35;
    st.box(hx, y + h - 0.05, hz, 0.7, 0.5, 0.35, ry);
    glowBox(B, hx + s * 0.18, y + h + 0.02, hz + c * 0.18, 0.56, 0.36, 0.04, ry, hex);
  }
}

/** A wall pack (a small lamp over a door) facing along local +z of frame F at (lx, ly, lz). */
export function wallPack(B, F, lx, ly, lz, hex = '#ffb060') {
  const st = B.near(M.steel(B));
  st.col = rgb('#2a2c2e');
  boxL(st, F, lx, ly, lz + 0.12, 0.4, 0.3, 0.24);
  const g = B.near(M.glow(B));
  g.col = rgb(hex);
  boxL(g, F, lx, ly - 0.02, lz + 0.25, 0.3, 0.12, 0.04);
}

// ------------------------------------------------------------------ street props

/** An oil drum (r 0.3, h 0.9) at world (x, y, z), colour. */
export function drum(acc, x, y, z, col) {
  acc.col = col;
  acc.cyl(x, y, z, 0.3, 0.9, 7);
  acc.col = shade(col, 0.7);
  acc.cyl(x, y + 0.88, z, 0.3, 0.02, 7, 0.27);
  // top
  const c = acc.v(x, y + 0.9, z), ring = [];
  for (let k = 0; k <= 7; k++) { const a = (k / 7) * Math.PI * 2; ring.push(acc.v(x + Math.cos(a) * 0.27, y + 0.9, z + Math.sin(a) * 0.27)); }
  for (let k = 0; k < 7; k++) acc.tri(c, ring[k + 1], ring[k]);
}

/** A pallet stack (1.2 × 1.0, n high) at world (x, y, z) turned ry. */
export function pallets(B, x, y, z, ry, n, rng) {
  const w = B.near(M.wood(B));
  for (let k = 0; k < n; k++) {
    const yy = y + k * 0.15, rr = ry + (rng() - 0.5) * 0.12;
    w.col = shade(rgb('#b89a70'), 0.75 + rng() * 0.35);
    boxW(w, x, yy, z, 1.2, 0.14, 1.0, rr, null, { u: 1 });
  }
}

/** A dumpster (skip) at world (x, z) turned ry, colour. */
export function skip(B, x, z, ry, col) {
  const y = B.groundY(x, z);
  const p = B.near(M.paint(B));
  p.col = col;
  const F = new Frame(x, z, ry, y);
  boxL(p, F, 0, 0.15, 0, 3.4, 1.25, 1.8);
  p.col = shade(col, 0.6);
  slope(p, F, [-1.75, 1.4, 0.95], [1.75, 1.4, 0.95], [1.75, 1.6, -0.95], [-1.75, 1.6, -0.95]);
  p.col = rgb('#222');
  for (const sx of [-1.4, 1.4]) for (const sz of [-0.7, 0.7]) boxL(p, F, sx, 0, sz, 0.18, 0.15, 0.18);
}

/** A parked car (low poly: body, cabin, wheels) at world (x, z), turned ry (+z its nose). */
export function car(B, x, z, ry, col, o = {}) {
  const y = (o.y ?? B.groundY(x, z));
  const F = new Frame(x, z, ry, y);
  const L = o.len || 4.4, W = o.wid || 1.75;
  const body = B.near(M.glossy(B));
  body.col = col;
  boxL(body, F, 0, 0.32, 0, W, 0.62, L);
  // cabin: a tapered box (glass)
  const g = B.near(M.glass(B));
  const cl = L * 0.48, cz = -L * 0.05;
  const hw = W / 2 - 0.08, ht = 0.95 + 0.32, hb = 0.94;
  const P = (lx, ly, lz) => F.P(lx, ly, lz);
  g.quadP(P(-hw, hb, cz + cl / 2), P(hw, hb, cz + cl / 2), P(hw - 0.12, ht + 0.3, cz + cl / 2 - 0.45), P(-hw + 0.12, ht + 0.3, cz + cl / 2 - 0.45));
  g.quadP(P(hw, hb, cz - cl / 2), P(-hw, hb, cz - cl / 2), P(-hw + 0.12, ht + 0.3, cz - cl / 2 + 0.35), P(hw - 0.12, ht + 0.3, cz - cl / 2 + 0.35));
  g.quadP(P(hw, hb, cz + cl / 2), P(hw, hb, cz - cl / 2), P(hw - 0.12, ht + 0.3, cz - cl / 2 + 0.35), P(hw - 0.12, ht + 0.3, cz + cl / 2 - 0.45));
  g.quadP(P(-hw, hb, cz - cl / 2), P(-hw, hb, cz + cl / 2), P(-hw + 0.12, ht + 0.3, cz + cl / 2 - 0.45), P(-hw + 0.12, ht + 0.3, cz - cl / 2 + 0.35));
  body.quadP(P(-hw + 0.12, ht + 0.3, cz + cl / 2 - 0.45), P(hw - 0.12, ht + 0.3, cz + cl / 2 - 0.45), P(hw - 0.12, ht + 0.3, cz - cl / 2 + 0.35), P(-hw + 0.12, ht + 0.3, cz - cl / 2 + 0.35));
  // wheels
  const t = B.near(M.paint(B));
  t.col = rgb('#141414');
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) boxL(t, F, sx * (W / 2 - 0.12), 0, sz * L * 0.32, 0.26, 0.62, 0.62);
  if (o.lights) {
    const gl = B.near(M.glow(B));
    gl.col = rgb('#ff2a1a');
    for (const sx of [-1, 1]) boxL(gl, F, sx * (W / 2 - 0.25), 0.7, -L / 2 - 0.02, 0.32, 0.12, 0.04);
  }
}

/** A street tree: trunk and a lumpy crown; leaf colour col. Returns the crown radius. */
export function tree(B, x, z, s, col, o = {}) {
  const y = B.groundY(x, z);
  const tr = B.acc(M.trunk(B));
  const lf = B.acc(M.leaf(B));
  const h = (o.h || 3.2) * s;
  tr.cyl(x, y - 0.3, z, 0.18 * s, h + 0.3, 5, 0.12 * s);
  lf.col = col;
  const r = (o.r || 2.4) * s;
  if (o.kind === 'cone') { cone(lf, x, y + h * 0.5, z, r * 0.8, r * 3, 7); return r; }
  sphere(lf, x, y + h + r * 0.55, z, r, 6, { sy: 0.85 });
  lf.col = shade(col, 0.85);
  sphere(lf, x + r * 0.45, y + h + r * 0.25, z - r * 0.3, r * 0.62, 5, { sy: 0.9 });
  return r;
}

export { cylinder, cone, sphere, plainMat };
