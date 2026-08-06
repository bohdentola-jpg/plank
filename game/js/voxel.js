// voxel.js — the 3D model format and its mesh builder.
//
// A model is a box of voxels: size w × h × d (x right, y up, z forward),
// stored as a string with one base-36 character per cell — '.' for empty,
// otherwise an index into PALETTE_KEYS. Index order is x + y*w + z*w*h.
//
// Meshing emits only faces that touch air, welds them into one geometry with
// per-vertex colors, and bakes flat normals — chunky, unlit-looking solids
// that fit the pixelated look and stay cheap (one draw call per model).

import * as THREE from '../vendor/three.module.js';
import { PALETTE_KEYS, PALETTE_HEX, clamp } from './util.js';

export const MAX_DIM = 24;          // 24³ = 13,824 cells is plenty and stays fast
export const VOXEL_UNIT = 0.25;     // one voxel = 0.25 world units → a 16³ model is 4 units

export function emptyVoxels(w = 12, h = 12, d = 12) {
  w = clamp(w | 0, 1, MAX_DIM); h = clamp(h | 0, 1, MAX_DIM); d = clamp(d | 0, 1, MAX_DIM);
  return { w, h, d, data: '.'.repeat(w * h * d) };
}

export function voxIndex(v, x, y, z) { return x + y * v.w + z * v.w * v.h; }

export function getVox(v, x, y, z) {
  if (x < 0 || y < 0 || z < 0 || x >= v.w || y >= v.h || z >= v.d) return -1;
  const ch = v.data[voxIndex(v, x, y, z)];
  if (!ch || ch === '.') return -1;
  const i = parseInt(ch, 36);
  return Number.isFinite(i) && i >= 0 && i < PALETTE_KEYS.length ? i : -1;
}

// returns a new voxel object with one cell changed (data strings stay immutable
// so undo in the editor is just keeping old references)
export function setVox(v, x, y, z, paletteIndex) {
  if (x < 0 || y < 0 || z < 0 || x >= v.w || y >= v.h || z >= v.d) return v;
  const i = voxIndex(v, x, y, z);
  const ch = paletteIndex == null || paletteIndex < 0 ? '.' : paletteIndex.toString(36);
  if (v.data[i] === ch) return v;
  return { ...v, data: v.data.slice(0, i) + ch + v.data.slice(i + 1) };
}

export function isEmptyModel(v) {
  return !v || !v.data || !/[^.]/.test(v.data);
}

export function countVoxels(v) {
  let n = 0;
  for (const ch of v.data) if (ch !== '.') n++;
  return n;
}

export function resizeVoxels(v, w, h, d) {
  const out = emptyVoxels(w, h, d);
  let data = out.data.split('');
  for (let z = 0; z < Math.min(v.d, out.d); z++) {
    for (let y = 0; y < Math.min(v.h, out.h); y++) {
      for (let x = 0; x < Math.min(v.w, out.w); x++) {
        data[voxIndex(out, x, y, z)] = v.data[voxIndex(v, x, y, z)] || '.';
      }
    }
  }
  return { ...out, data: data.join('') };
}

export function validateVoxels(v) {
  if (!v || typeof v !== 'object') return emptyVoxels();
  const w = clamp(Math.floor(+v.w || 12), 1, MAX_DIM);
  const h = clamp(Math.floor(+v.h || 12), 1, MAX_DIM);
  const d = clamp(Math.floor(+v.d || 12), 1, MAX_DIM);
  let data = typeof v.data === 'string' ? v.data : '';
  // keep only legal characters
  data = data.replace(/[^0-9a-z.]/gi, '.').toLowerCase();
  data = data.slice(0, w * h * d).padEnd(w * h * d, '.');
  return { w, h, d, data };
}

// world-space size of a model at scale 1
export function voxelSize(v) {
  return { x: v.w * VOXEL_UNIT, y: v.h * VOXEL_UNIT, z: v.d * VOXEL_UNIT };
}

// ---------------------------------------------------------------- meshing

// Face definitions: [normal, four corner offsets] in voxel units. Corner order
// is counter-clockwise seen from outside, so the front face is the outward one —
// get this wrong and the solid renders inside-out and raycasts miss it.
const FACES = [
  { n: [1, 0, 0], c: [[1, 0, 0], [1, 1, 0], [1, 1, 1], [1, 0, 1]], shade: -8 },
  { n: [-1, 0, 0], c: [[0, 0, 0], [0, 0, 1], [0, 1, 1], [0, 1, 0]], shade: -14 },
  { n: [0, 1, 0], c: [[0, 1, 0], [0, 1, 1], [1, 1, 1], [1, 1, 0]], shade: 12 },
  { n: [0, -1, 0], c: [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]], shade: -26 },
  { n: [0, 0, 1], c: [[0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]], shade: -4 },
  { n: [0, 0, -1], c: [[0, 0, 0], [0, 1, 0], [1, 1, 0], [1, 0, 0]], shade: -18 },
];

const _col = new THREE.Color();

// Build a BufferGeometry for a voxel model, centred on x/z and resting on y=0.
export function buildVoxelGeometry(v, opts = {}) {
  v = validateVoxels(v);
  const unit = opts.unit || VOXEL_UNIT;
  const ox = -(v.w * unit) / 2;
  const oy = 0;
  const oz = -(v.d * unit) / 2;

  const pos = [];
  const nor = [];
  const col = [];

  for (let z = 0; z < v.d; z++) {
    for (let y = 0; y < v.h; y++) {
      for (let x = 0; x < v.w; x++) {
        const pi = getVox(v, x, y, z);
        if (pi < 0) continue;
        const base = PALETTE_HEX[pi] ?? 0x9a9a9a;
        for (const f of FACES) {
          if (getVox(v, x + f.n[0], y + f.n[1], z + f.n[2]) >= 0) continue;   // hidden
          // shade each face a little so form reads without smooth lighting
          const r0 = ((base >> 16) & 255) + f.shade;
          const g0 = ((base >> 8) & 255) + f.shade;
          const b0 = (base & 255) + f.shade;
          _col.setRGB(
            clamp(r0, 0, 255) / 255,
            clamp(g0, 0, 255) / 255,
            clamp(b0, 0, 255) / 255,
          );
          const q = f.c.map(c => [
            ox + (x + c[0]) * unit,
            oy + (y + c[1]) * unit,
            oz + (z + c[2]) * unit,
          ]);
          // two triangles per quad
          for (const [a, b, c] of [[0, 1, 2], [0, 2, 3]]) {
            for (const idx of [a, b, c]) {
              pos.push(q[idx][0], q[idx][1], q[idx][2]);
              nor.push(f.n[0], f.n[1], f.n[2]);
              col.push(_col.r, _col.g, _col.b);
            }
          }
        }
      }
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  geo.computeBoundingSphere();
  geo.computeBoundingBox();
  return geo;
}

// The one material every voxel model and terrain chunk shares.
let SHARED_MAT = null;
export function voxelMaterial() {
  if (!SHARED_MAT) {
    SHARED_MAT = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
  }
  return SHARED_MAT;
}

let GHOST_MAT = null;
export function ghostMaterial() {
  if (!GHOST_MAT) {
    GHOST_MAT = new THREE.MeshLambertMaterial({
      vertexColors: true, flatShading: true, transparent: true, opacity: 0.45, depthWrite: false,
    });
  }
  return GHOST_MAT;
}

// ---------------------------------------------------------------- shapes
// Handy generators so a new model isn't a blank box.
export function starterShape(kind, w = 12, h = 12, d = 12) {
  let v = emptyVoxels(w, h, d);
  const gray = PALETTE_KEYS.indexOf('gray');
  const card = PALETTE_KEYS.indexOf('cardboard');
  const leaf = PALETTE_KEYS.indexOf('leaf');
  const brown = PALETTE_KEYS.indexOf('brown');
  const set = (x, y, z, c) => { v = setVox(v, x, y, z, c); };

  if (kind === 'cube') {
    for (let z = 2; z < d - 2; z++) for (let y = 0; y < h - 4; y++) for (let x = 2; x < w - 2; x++) set(x, y, z, gray);
  } else if (kind === 'box') {
    for (let z = 1; z < d - 1; z++) for (let y = 0; y < h - 1; y++) for (let x = 1; x < w - 1; x++) set(x, y, z, card);
  } else if (kind === 'ball') {
    const r = Math.min(w, h, d) / 2 - 1;
    const cx = w / 2, cy = r + 0.5, cz = d / 2;
    for (let z = 0; z < d; z++) for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      if (Math.hypot(x + 0.5 - cx, y + 0.5 - cy, z + 0.5 - cz) <= r) set(x, y, z, gray);
    }
  } else if (kind === 'tree') {
    const cx = (w >> 1), cz = (d >> 1);
    for (let y = 0; y < Math.floor(h * 0.45); y++) { set(cx, y, cz, brown); set(cx - 1, y, cz, brown); }
    const top = Math.floor(h * 0.45);
    for (let y = top; y < h; y++) {
      const r = Math.max(0.8, (h - y) * 0.55);
      for (let z = 0; z < d; z++) for (let x = 0; x < w; x++) {
        if (Math.hypot(x - cx, z - cz) <= r) set(x, y, z, leaf);
      }
    }
  } else if (kind === 'pillar') {
    for (let y = 0; y < h; y++) for (let z = cxHalf(d) - 1; z <= cxHalf(d); z++) for (let x = cxHalf(w) - 1; x <= cxHalf(w); x++) set(x, y, z, gray);
  }
  return v;
}

function cxHalf(n) { return n >> 1; }
