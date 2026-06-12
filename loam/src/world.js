// The living world: chunk storage, block edits, and real voxel lighting —
// skylight pours down columns and floods sideways, torches flood outward,
// both as 0-15 levels BFS'd per chunk with border seeding from neighbours.
// Player edits are kept as per-chunk diffs so saves stay tiny.
import { CH, WORLD_H, SEA, idx, WorldGen } from './worldgen.js';
import { B, BLOCKS } from './blocks.js';

export { CH, WORLD_H, SEA, idx };

export const ckey = (cx, cz) => cx + ',' + cz;

// flat lookup tables: object property reads are too slow for light loops
const N_IDS = 64;
export const OPAQUE = new Uint8Array(N_IDS);
export const SOLID = new Uint8Array(N_IDS);
export const FLUID = new Uint8Array(N_IDS);
export const EMIT = new Uint8Array(N_IDS);
const ATTEN = new Uint8Array(N_IDS); // light cost to pass through (255 = wall)
for (const [id, b] of Object.entries(BLOCKS)) {
  OPAQUE[id] = b.opaque ? 1 : 0;
  SOLID[id] = b.solid ? 1 : 0;
  FLUID[id] = b.fluid ? 1 : 0;
  EMIT[id] = b.emit;
  ATTEN[id] = b.opaque ? 255 : (b.fluid || id == B.leaves || id == B.spruceLeaves || id == B.ice ? 3 : 1);
}

const LQ = new Int32Array(CH * CH * WORLD_H * 4); // shared BFS scratch

class Chunk {
  constructor(cx, cz, blocks) {
    this.cx = cx; this.cz = cz;
    this.blocks = blocks;
    this.light = new Uint8Array(blocks.length); // sky<<4 | block
    this.lightDirty = true;
    this.meshStale = true;
    this.hasMesh = false;
  }
}

export class World {
  constructor(seed, diffs = {}) {
    this.gen = new WorldGen(seed);
    this.seed = seed;
    this.chunks = new Map();
    this.diffs = diffs;
    this.genQueue = [];
    this._cc = null; // one-entry chunk cache: block reads cluster hard
    this._oldLight = new Uint8Array(CH * CH * WORLD_H);
  }

  chunkAt(cx, cz) {
    const c = this._cc;
    if (c && c.cx === cx && c.cz === cz) return c;
    const got = this.chunks.get(ckey(cx, cz)) || null;
    if (got) this._cc = got;
    return got;
  }

  ensureChunk(cx, cz) {
    let c = this.chunkAt(cx, cz);
    if (c) return c;
    const blocks = this.gen.genChunk(cx, cz);
    const diff = this.diffs[ckey(cx, cz)];
    if (diff) for (const i in diff) blocks[i] = diff[i];
    c = new Chunk(cx, cz, blocks);
    this.chunks.set(ckey(cx, cz), c);
    // fresh light pours over the borders of everyone nearby
    for (let dz = -1; dz <= 1; dz++) {
      for (let dx = -1; dx <= 1; dx++) {
        const n = this.chunkAt(cx + dx, cz + dz);
        if (n && n !== c) { n.lightDirty = true; }
      }
    }
    return c;
  }

  block(x, y, z) {
    if (y < 0) return B.bedrock;
    if (y >= WORLD_H) return B.air;
    const c = this.chunkAt(Math.floor(x / CH), Math.floor(z / CH));
    if (!c) return B.stone; // unloaded reads as rock: no holes, no walking off-map
    return c.blocks[idx(x & 15, y, z & 15)];
  }

  lightAt(x, y, z) {
    if (y >= WORLD_H) return 0xf0;
    if (y < 0) return 0;
    const c = this.chunkAt(Math.floor(x / CH), Math.floor(z / CH));
    if (!c) return 0;
    return c.light[idx(x & 15, y, z & 15)];
  }

  setBlock(x, y, z, id, record = true) {
    if (y < 1 || y >= WORLD_H) return false;
    const cx = Math.floor(x / CH), cz = Math.floor(z / CH);
    const c = this.chunkAt(cx, cz);
    if (!c) return false;
    const i = idx(x & 15, y, z & 15);
    if (c.blocks[i] === id) return false;
    c.blocks[i] = id;
    if (record) {
      const k = ckey(cx, cz);
      (this.diffs[k] ??= {})[i] = id;
    }
    for (let dz = -1; dz <= 1; dz++) {
      for (let dx = -1; dx <= 1; dx++) {
        const n = this.chunkAt(cx + dx, cz + dz);
        if (n) n.lightDirty = true;
      }
    }
    // a change on a border face must remesh the neighbour it touches
    const lx = x & 15, lz = z & 15;
    c.meshStale = true;
    if (lx === 0) this._stale(cx - 1, cz);
    if (lx === 15) this._stale(cx + 1, cz);
    if (lz === 0) this._stale(cx, cz - 1);
    if (lz === 15) this._stale(cx, cz + 1);
    return true;
  }

  _stale(cx, cz) { const n = this.chunkAt(cx, cz); if (n) n.meshStale = true; }

  solidAt(x, y, z) { return SOLID[this.block(Math.floor(x), Math.floor(y), Math.floor(z))] === 1; }
  fluidAt(x, y, z) { return FLUID[this.block(Math.floor(x), Math.floor(y), Math.floor(z))] === 1; }

  surfaceY(x, z) {
    for (let y = WORLD_H - 1; y > 0; y--) {
      const b = this.block(x, y, z);
      if (b !== B.air && SOLID[b]) return y;
    }
    return SEA;
  }

  // ---------------------------------------------------------- lighting
  relight(c) {
    const { blocks, light } = c;
    this._oldLight.set(light);
    light.fill(0);
    this._lightChannel(c, 4);  // sky
    this._lightChannel(c, 0);  // torches & lava
    c.lightDirty = false;
    const old = this._oldLight;
    for (let i = 0; i < light.length; i++) {
      if (light[i] !== old[i]) { c.meshStale = true; return true; }
    }
    return false;
  }

  _lightChannel(c, shift) {
    const { blocks, light } = c;
    const mask = 15 << shift, inv = ~mask & 0xff;
    let qt = 0;
    const push = (x, y, z, lvl) => { if (qt < LQ.length) LQ[qt++] = x | (z << 4) | (y << 8) | (lvl << 17); };

    if (shift === 4) {
      // skylight: full strength falls straight down until something blocks it
      for (let z = 0; z < CH; z++) {
        for (let x = 0; x < CH; x++) {
          let lvl = 15;
          for (let y = WORLD_H - 1; y >= 0 && lvl > 0; y--) {
            const i = idx(x, y, z);
            const cost = ATTEN[blocks[i]];
            if (cost > 15) break;
            if (cost > 1) lvl = Math.max(0, lvl - cost);
            light[i] = (light[i] & inv) | (lvl << shift);
            if (lvl > 1) push(x, y, z, lvl);
          }
        }
      }
    } else {
      for (let y = 0; y < WORLD_H; y++) {
        for (let z = 0; z < CH; z++) {
          for (let x = 0; x < CH; x++) {
            const i = idx(x, y, z);
            const e = EMIT[blocks[i]];
            if (e > 0) { light[i] = (light[i] & inv) | (e << shift); push(x, y, z, e); }
          }
        }
      }
    }

    // borders: light walks in from whatever neighbours already worked out
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const n = this.chunkAt(c.cx + dx, c.cz + dz);
      if (!n) continue;
      for (let t = 0; t < CH; t++) {
        for (let y = 0; y < WORLD_H; y++) {
          const nx = dx === 1 ? 0 : dx === -1 ? 15 : t;
          const nz = dz === 1 ? 0 : dz === -1 ? 15 : t;
          const v = (n.light[idx(nx, y, nz)] >> shift) & 15;
          if (v <= 1) continue;
          const mx = dx === 1 ? 15 : dx === -1 ? 0 : t;
          const mz = dz === 1 ? 15 : dz === -1 ? 0 : t;
          const i = idx(mx, y, mz);
          const cost = ATTEN[c.blocks[i]];
          if (cost > 15) continue;
          const nl = v - cost;
          if (nl > ((light[i] >> shift) & 15)) {
            light[i] = (light[i] & inv) | (nl << shift);
            push(mx, y, mz, nl);
          }
        }
      }
    }

    // flood fill inside the chunk
    let qh = 0;
    while (qh < qt) {
      const v = LQ[qh++];
      const x = v & 15, z = (v >> 4) & 15, y = (v >> 8) & 511, lvl = (v >> 17) & 15;
      const i = idx(x, y, z);
      if (((light[i] >> shift) & 15) !== lvl) continue; // stale entry
      for (let d = 0; d < 6; d++) {
        const nx = x + (d === 0 ? 1 : d === 1 ? -1 : 0);
        const ny = y + (d === 2 ? 1 : d === 3 ? -1 : 0);
        const nz = z + (d === 4 ? 1 : d === 5 ? -1 : 0);
        if (nx < 0 || nx > 15 || nz < 0 || nz > 15 || ny < 0 || ny >= WORLD_H) continue;
        const i2 = idx(nx, ny, nz);
        const cost = ATTEN[blocks[i2]];
        if (cost > 15) continue;
        const nl = lvl - cost;
        if (nl <= 0) continue;
        if (((light[i2] >> shift) & 15) >= nl) continue;
        light[i2] = (light[i2] & inv) | (nl << shift);
        if (qt < LQ.length) LQ[qt++] = nx | (nz << 4) | (ny << 8) | (nl << 17);
      }
    }
  }

  // ---------------------------------------------------------- streaming
  // Generate, light, and surface mesh-ready chunks around the player within
  // a per-frame millisecond budget. Returns chunks wanting fresh meshes.
  update(px, pz, dist, budgetMs = 8) {
    const t0 = performance.now();
    const pcx = Math.floor(px / CH), pcz = Math.floor(pz / CH);

    const qKey = ckey(pcx, pcz) + ':' + dist;
    if (this._qFor !== qKey) {
      this._qFor = qKey;
      this.genQueue.length = 0;
      for (let dz = -dist; dz <= dist; dz++) {
        for (let dx = -dist; dx <= dist; dx++) {
          if (dx * dx + dz * dz > dist * dist + 2) continue;
          if (!this.chunks.has(ckey(pcx + dx, pcz + dz))) this.genQueue.push([pcx + dx, pcz + dz, dx * dx + dz * dz]);
        }
      }
      this.genQueue.sort((a, b) => a[2] - b[2]);
    }
    while (this.genQueue.length && performance.now() - t0 < budgetMs) {
      const [cx, cz] = this.genQueue.shift();
      if (!this.chunks.has(ckey(cx, cz))) this.ensureChunk(cx, cz);
    }

    // relight pass (cheap per chunk, budgeted)
    for (const c of this.chunks.values()) {
      if (performance.now() - t0 > budgetMs * 1.6) break;
      if (c.lightDirty) this.relight(c);
    }

    // mesh-ready chunks: lit, with all four neighbours present
    const out = [];
    for (const c of this.chunks.values()) {
      if (!c.meshStale || c.lightDirty) continue;
      if (!this.chunkAt(c.cx + 1, c.cz) || !this.chunkAt(c.cx - 1, c.cz)) continue;
      if (!this.chunkAt(c.cx, c.cz + 1) || !this.chunkAt(c.cx, c.cz - 1)) continue;
      out.push(c);
    }
    const d2 = (c) => (c.cx - pcx) ** 2 + (c.cz - pcz) ** 2;
    out.sort((a, b) => d2(a) - d2(b));

    // drop far chunks
    const removed = [];
    for (const [k, c] of this.chunks) {
      const dd = Math.max(Math.abs(c.cx - pcx), Math.abs(c.cz - pcz));
      if (dd > dist + 2) {
        removed.push(k);
        this.chunks.delete(k);
        if (this._cc === c) this._cc = null;
      }
    }
    return { mesh: out, removed };
  }

  pendingWork() { return this.genQueue.length; }
}
