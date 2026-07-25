// From level data to a room you can stand in.
//
// Three jobs, in order:
//   1. GEOMETRY  every floor, wall, ceiling, riser and water surface merged into
//      one buffer per material, so a 20,000-cell level is a dozen draw calls.
//   2. LIGHT      the level's fixtures are baked into a per-cell irradiance field
//      with real occlusion (a 2D DDA across the grid, so light stops at walls),
//      then written into each vertex's `abake` attribute. This is what makes the
//      place look lit rather than ambient-washed, at zero runtime cost.
//   3. LIVE       a small pool of real point lights follows the player so nearby
//      fixtures flicker, catch normal maps and throw highlights; plus water
//      animation, caustics, fixture meshes, props, and the queries that the
//      player, the entities and the scares all ask the world.

import * as THREE from 'three';
import { C, WALKABLE, WET, OPAQUE, climbable } from './kit.js';
import { material, tileScale, simple, waterTexture, waterNormal, causticTexture } from './textures.js';
import { buildProp } from './props.js';
import { gridClear, clamp01, lerp, rng, Noise2 } from './util.js';

const POOL_SIZE = 7;            // real point lights alive at once
const BAKE_GAIN = 3.2;          // baked irradiance → what the eye expects after tone mapping
const HALF_H = 1.15;            // height of a HALF cell (counters, cubicle rows)

// A growing set of triangles for one material.
class MeshBuf {
  constructor(name) {
    this.name = name;
    this.pos = [];
    this.nor = [];
    this.uv = [];
    this.bake = [];
  }

  // Quad from four corners, counter-clockwise seen from the front face.
  quad(a, b, c, d, n, uvs, bakes) {
    const { pos, nor, uv, bake } = this;
    for (const [p, i] of [[a, 0], [b, 1], [c, 2], [a, 0], [c, 2], [d, 3]]) {
      pos.push(p[0], p[1], p[2]);
      nor.push(n[0], n[1], n[2]);
      uv.push(uvs[i][0], uvs[i][1]);
      const bk = bakes[i];
      bake.push(bk[0], bk[1], bk[2]);
    }
  }

  build() {
    if (!this.pos.length) return null;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.setAttribute('abake', new THREE.Float32BufferAttribute(this.bake, 3));
    g.computeBoundingSphere();
    return g;
  }
}

export class World {
  constructor(data, scene, opts = {}) {
    this.data = data;
    this.scene = scene;
    this.cell = data.cell;
    this.w = data.w;
    this.h = data.h;
    this.cells = data.cells;
    this.floorYs = data.floorYs;
    this.ceilYs = data.ceilYs;
    this.rules = data.rules;
    this.quality = opts.quality ?? 1;
    this.group = new THREE.Group();
    this.group.name = 'level';
    scene.add(this.group);

    this.lights = data.lights.map((l, i) => ({
      ...l,
      i,
      phase: (i * 2.399) % 6.283,
      out: 0,                 // seconds of forced darkness left
      live: null,             // assigned pool light, if any
    }));
    this.noise = new Noise2(1234);
    this.time = 0;
    this.waterY = data.waterLevel;
    this.disposables = [];

    this._bakeField();
    this._buildGeometry();
    this._buildWater();
    this._buildFixtures();
    this._buildProps();
    this._buildSky();
    this._buildLightPool();
    this._buildColliders();
    this._buildHides();
    this._buildArrows(opts.arrows ?? 0);
  }

  // ------------------------------------------------------------------ indexing
  idx(cx, cz) { return cz * this.w + cx; }
  inside(cx, cz) { return cx >= 0 && cz >= 0 && cx < this.w && cz < this.h; }
  code(cx, cz) { return this.inside(cx, cz) ? this.cells[this.idx(cx, cz)] : C.VOID; }
  isOpenCell(cx, cz) { return WALKABLE.has(this.code(cx, cz)); }
  isOpaque(cx, cz) { return OPAQUE.has(this.code(cx, cz)); }
  cellFloor(cx, cz) { return this.inside(cx, cz) ? this.floorYs[this.idx(cx, cz)] : 0; }
  cellCeil(cx, cz) { return this.inside(cx, cz) ? this.ceilYs[this.idx(cx, cz)] : this.data.wallH; }

  toCell(x, z) { return [Math.round(x / this.cell), Math.round(z / this.cell)]; }
  toWorld(cx, cz) { return [cx * this.cell, cz * this.cell]; }

  codeAtWorld(x, z) {
    const [cx, cz] = this.toCell(x, z);
    return this.code(cx, cz);
  }

  floorAtWorld(x, z) {
    // bilinear across the four nearest cell centres, so ramps are smooth
    const fx = x / this.cell, fz = z / this.cell;
    const x0 = Math.floor(fx), z0 = Math.floor(fz);
    const tx = fx - x0, tz = fz - z0;
    const at = (cx, cz) => {
      if (!this.inside(cx, cz)) return this.cellFloor(Math.max(0, Math.min(this.w - 1, cx)), Math.max(0, Math.min(this.h - 1, cz)));
      return this.cellFloor(cx, cz);
    };
    const a = at(x0, z0), b = at(x0 + 1, z0), c = at(x0, z0 + 1), d = at(x0 + 1, z0 + 1);
    return lerp(lerp(a, b, tx), lerp(c, d, tx), tz);
  }

  ceilAtWorld(x, z) {
    const [cx, cz] = this.toCell(x, z);
    return this.cellCeil(cx, cz);
  }

  // solid for movement: walls, glass, half-height furniture rows, and the void
  solidAtWorld(x, z, atY = null) {
    const [cx, cz] = this.toCell(x, z);
    const c = this.code(cx, cz);
    if (c === C.HALF) {
      if (atY === null) return true;
      return atY < this.cellFloor(cx, cz) + HALF_H;
    }
    return !WALKABLE.has(c);
  }

  waterDepthAt(x, z) {
    const [cx, cz] = this.toCell(x, z);
    const c = this.code(cx, cz);
    if (!WET.has(c)) return 0;
    const surf = this.waterY ?? 0;
    return Math.max(0, surf - this.cellFloor(cx, cz));
  }

  isDeepAt(x, z) { return this.codeAtWorld(x, z) === C.DEEP; }

  sightClear(ax, az, bx, bz) {
    return gridClear((cx, cz) => this.isOpaque(cx, cz), ax, az, bx, bz, this.cell);
  }

  // Can a body walk from one cell to its neighbour (used by entity pathing)?
  walkStep(cx, cz, nx, nz) {
    if (!this.isOpenCell(nx, nz)) return false;
    return climbable(this.code(cx, cz), this.code(nx, nz), this.cellFloor(cx, cz), this.cellFloor(nx, nz));
  }

  nearestGlass(x, z, r) {
    const [px, pz] = this.toCell(x, z);
    const rc = Math.ceil(r / this.cell);
    let best = null, bd = Infinity;
    for (let dz = -rc; dz <= rc; dz++) {
      for (let dx = -rc; dx <= rc; dx++) {
        if (this.code(px + dx, pz + dz) !== C.GLASS) continue;
        const d = Math.hypot(dx, dz);
        if (d < bd) { bd = d; best = [px + dx, pz + dz]; }
      }
    }
    if (!best) return null;
    const [wx, wz] = this.toWorld(best[0], best[1]);
    return { x: wx, z: wz };
  }

  // ------------------------------------------------------------------ light bake
  // Per-cell irradiance at ankle height (floors) and just under the ceiling.
  // Occlusion is a 2D ray march: light does not turn corners, which is most of
  // why the place reads as rooms rather than a lit soup.
  _bakeField() {
    const n = this.w * this.h;
    this.floorLight = new Float32Array(n * 3);
    this.ceilLight = new Float32Array(n * 3);
    // bucket lights by coarse grid for quick lookup
    const B = 8;
    this.bw = Math.ceil(this.w / B);
    this.bh = Math.ceil(this.h / B);
    this.buckets = Array.from({ length: this.bw * this.bh }, () => []);
    for (const l of this.lights) {
      if (!l.bake || l.dead) continue;
      const rc = Math.ceil(l.radius);
      const bx0 = Math.max(0, Math.floor((l.x - rc) / B)), bx1 = Math.min(this.bw - 1, Math.floor((l.x + rc) / B));
      const bz0 = Math.max(0, Math.floor((l.z - rc) / B)), bz1 = Math.min(this.bh - 1, Math.floor((l.z + rc) / B));
      for (let bz = bz0; bz <= bz1; bz++) {
        for (let bx = bx0; bx <= bx1; bx++) this.buckets[bz * this.bw + bx].push(l);
      }
    }
    const dark = this.rules?.dark;
    const gain = dark ? 0.25 : 1;
    for (let cz = 0; cz < this.h; cz++) {
      for (let cx = 0; cx < this.w; cx++) {
        const i = this.idx(cx, cz);
        if (!WALKABLE.has(this.cells[i]) && this.cells[i] !== C.HALF) continue;
        const fy = this.floorYs[i], cy = this.ceilYs[i];
        const f = this.sample(cx, cz, fy + 0.05, 0, 1, 0, gain);
        const c = this.sample(cx, cz, cy - 0.05, 0, -1, 0, gain);
        this.floorLight[i * 3] = f[0]; this.floorLight[i * 3 + 1] = f[1]; this.floorLight[i * 3 + 2] = f[2];
        this.ceilLight[i * 3] = c[0]; this.ceilLight[i * 3 + 1] = c[1]; this.ceilLight[i * 3 + 2] = c[2];
      }
    }
  }

  // Irradiance at a point with a normal, in cell coordinates.
  sample(cx, cz, y, nx, ny, nz, gain = 1) {
    const out = [0, 0, 0];
    const bx = Math.min(this.bw - 1, Math.max(0, Math.floor(cx / 8)));
    const bz = Math.min(this.bh - 1, Math.max(0, Math.floor(cz / 8)));
    const list = this.buckets[bz * this.bw + bx];
    if (!list) return out;
    const px = cx * this.cell, pz = cz * this.cell;
    for (const l of list) {
      const lx = l.x * this.cell, lz = l.z * this.cell;
      const ly = l.y !== null && l.y !== undefined ? l.y : this.cellCeil(Math.round(l.x), Math.round(l.z)) - 0.18;
      const dx = lx - px, dy = ly - y, dz = lz - pz;
      const dist = Math.hypot(dx, dy, dz);
      const rad = l.radius * this.cell * 0.5 + l.radius * 0.5;
      if (dist > rad) continue;
      const dot = (dx * nx + dy * ny + dz * nz) / (dist || 1);
      const facing = 0.22 + 0.78 * Math.max(0, dot);
      if (facing <= 0.02) continue;
      // shadow: skip the march for very close lights, march the grid otherwise
      if (dist > this.cell * 1.4 && !gridClear((qx, qz) => this.isOpaque(qx, qz), px, pz, lx, lz, this.cell)) continue;
      // A fitting hangs a hand's width under the ceiling, and at that range inverse
      // falloff blows the tile it is mounted on to white while the floor three metres
      // down stays brown. Give every source a minimum throw so the room lights the
      // way a room does.
      const atten = Math.pow(1 - Math.max(dist, 1.15) / rad, 1.7);
      const e = atten * facing * l.intensity * gain * BAKE_GAIN * (l.on ? 1 : 0.05);
      const col = new THREE.Color(l.color);
      out[0] += col.r * e;
      out[1] += col.g * e;
      out[2] += col.b * e;
    }
    // Soft knee: two fixtures overlapping should read brighter, not blown out.
    for (let k = 0; k < 3; k++) out[k] = out[k] / (1 + out[k] * 0.5);
    return out;
  }

  // Bilinear read of a baked field, for vertices between cell centres.
  fieldAt(field, x, z) {
    const fx = x / this.cell, fz = z / this.cell;
    const x0 = Math.floor(fx), z0 = Math.floor(fz);
    const tx = fx - x0, tz = fz - z0;
    const g = (cx, cz) => {
      if (!this.inside(cx, cz)) return [0, 0, 0];
      const i = this.idx(cx, cz) * 3;
      return [field[i], field[i + 1], field[i + 2]];
    };
    const a = g(x0, z0), b = g(x0 + 1, z0), c = g(x0, z0 + 1), d = g(x0 + 1, z0 + 1);
    return [0, 1, 2].map((k) => lerp(lerp(a[k], b[k], tx), lerp(c[k], d[k], tx), tz));
  }

  // ------------------------------------------------------------------ geometry
  _buildGeometry() {
    const d = this.data;
    const S = this.cell;
    const bufs = new Map();
    const buf = (name) => {
      if (!bufs.has(name)) bufs.set(name, new MeshBuf(name));
      return bufs.get(name);
    };
    const openSky = d.openSky;

    for (let cz = 0; cz < this.h; cz++) {
      for (let cx = 0; cx < this.w; cx++) {
        const i = this.idx(cx, cz);
        const code = this.cells[i];
        const walk = WALKABLE.has(code);
        if (!walk && code !== C.HALF) continue;
        const fy = this.floorYs[i], cy = this.ceilYs[i];
        const x0 = cx * S - S / 2, x1 = cx * S + S / 2;
        const z0 = cz * S - S / 2, z1 = cz * S + S / 2;
        const fMat = d.matF[i], cMat = d.matC[i], wMat = d.matW[i];

        // ---- floor (a PIT has none: that's the point of a pit)
        if (code !== C.PIT) {
          const t = tileScale(fMat);
          const fb = buf(fMat);
          const bk = [[x0, z0], [x1, z0], [x1, z1], [x0, z1]].map(([px, pz]) => this.fieldAt(this.floorLight, px, pz));
          fb.quad(
            [x0, fy, z1], [x1, fy, z1], [x1, fy, z0], [x0, fy, z0],
            [0, 1, 0],
            [[x0 * t, z1 * t], [x1 * t, z1 * t], [x1 * t, z0 * t], [x0 * t, z0 * t]],
            [bk[3], bk[2], bk[1], bk[0]],
          );
        }

        // ---- HALF cells: a solid block you can see over. It still needs the
        // ceiling drawn above it, or the level has a hole in its roof.
        if (code === C.HALF) {
          if (!openSky && cMat !== 'void') {
            const tc = tileScale(cMat);
            const cb2 = buf(cMat);
            const bkc = [[x0, z0], [x1, z0], [x1, z1], [x0, z1]].map(([px, pz]) => this.fieldAt(this.ceilLight, px, pz));
            cb2.quad(
              [x0, cy, z0], [x1, cy, z0], [x1, cy, z1], [x0, cy, z1],
              [0, -1, 0],
              [[x0 * tc, z0 * tc], [x1 * tc, z0 * tc], [x1 * tc, z1 * tc], [x0 * tc, z1 * tc]],
              [bkc[0], bkc[1], bkc[2], bkc[3]],
            );
          }
          const t = tileScale(wMat);
          const top = fy + HALF_H;
          const tb = buf(wMat);
          const bkTop = [[x0, z0], [x1, z0], [x1, z1], [x0, z1]].map(([px, pz]) => this.fieldAt(this.floorLight, px, pz));
          tb.quad(
            [x0, top, z1], [x1, top, z1], [x1, top, z0], [x0, top, z0],
            [0, 1, 0],
            [[x0 * t, z1 * t], [x1 * t, z1 * t], [x1 * t, z0 * t], [x0 * t, z0 * t]],
            [bkTop[3], bkTop[2], bkTop[1], bkTop[0]],
          );
          for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            if (!this.isOpenCell(cx + dx, cz + dz)) continue;
            this._wallQuad(tb, cx, cz, dx, dz, fy, top, wMat, true);
          }
          continue;
        }

        // ---- ceiling
        if (!openSky && cMat !== 'void') {
          const t = tileScale(cMat);
          const cb = buf(cMat);
          const bk = [[x0, z0], [x1, z0], [x1, z1], [x0, z1]].map(([px, pz]) => this.fieldAt(this.ceilLight, px, pz));
          cb.quad(
            [x0, cy, z0], [x1, cy, z0], [x1, cy, z1], [x0, cy, z1],
            [0, -1, 0],
            [[x0 * t, z0 * t], [x1 * t, z0 * t], [x1 * t, z1 * t], [x0 * t, z1 * t]],
            [bk[0], bk[1], bk[2], bk[3]],
          );
        }

        // ---- walls, one per solid neighbour, drawn facing this cell
        for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nc = this.code(cx + dx, cz + dz);
          if (WALKABLE.has(nc)) {
            const nIdx = this.idx(cx + dx, cz + dz);
            const nWallMat = d.matW[nIdx] || wMat;
            // a riser where the floor steps up into the neighbour
            const nfy = this.cellFloor(cx + dx, cz + dz);
            if (nfy > fy + 0.02) this._riserQuad(buf(nWallMat), cx, cz, dx, dz, fy, nfy);
            // and a bulkhead where the ceiling steps up — without this, a room
            // that goes cathedral-tall next to a normal one is open to the void
            // Two faces, not one: from the low side you see the underside of the
            // bulkhead, and from inside the tall room you see the wall carrying
            // on above the doorway. Miss the second and the taller room has a
            // hole in it.
            const ncy = this.cellCeil(cx + dx, cz + dz);
            if (!openSky && ncy > cy + 0.02) {
              this._wallQuad(buf(nWallMat), cx, cz, dx, dz, cy, ncy, nWallMat, true);
              this._wallQuad(buf(nWallMat), cx + dx, cz + dz, -dx, -dz, cy, ncy, nWallMat, true);
            }
            continue;
          }
          if (nc === C.HALF) continue;   // the HALF cell draws its own sides
          const nWall = this.inside(cx + dx, cz + dz) ? d.matW[this.idx(cx + dx, cz + dz)] : wMat;
          const mName = nc === C.GLASS ? 'glass' : nWall;
          // run the wall from the lowest floor to the highest ceiling of every
          // walkable cell touching this wall block — no seams at the top
          let top = cy, bottom = fy;
          for (const [ex, ez] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            const qx = cx + dx + ex, qz = cz + dz + ez;
            if (!WALKABLE.has(this.code(qx, qz))) continue;
            top = Math.max(top, this.cellCeil(qx, qz));
            bottom = Math.min(bottom, this.cellFloor(qx, qz));
          }
          this._wallQuad(buf(mName), cx, cz, dx, dz, bottom, top, mName, false);
        }
      }
    }

    this.meshes = [];
    for (const [name, b] of bufs) {
      const geo = b.build();
      if (!geo) continue;
      const mesh = new THREE.Mesh(geo, material(name));
      mesh.matrixAutoUpdate = false;
      mesh.frustumCulled = true;
      this.group.add(mesh);
      this.meshes.push(mesh);
      this.disposables.push(geo);
    }
  }

  // A wall face on the boundary of cell (cx,cz) toward (dx,dz), facing inward.
  _wallQuad(b, cx, cz, dx, dz, y0, y1, matName, isHalf) {
    const S = this.cell;
    const t = tileScale(matName);
    const ex = cx * S + dx * S / 2, ez = cz * S + dz * S / 2;
    // corners of the face
    const px = dz !== 0 ? S / 2 : 0, pz = dx !== 0 ? S / 2 : 0;
    const a = [ex - px, y0, ez - pz];
    const bb = [ex + px, y0, ez + pz];
    const c = [ex + px, y1, ez + pz];
    const dd = [ex - px, y1, ez - pz];
    const n = [-dx, 0, -dz];
    const uSpan = S * t, vSpan = (y1 - y0) * t;
    const u0 = ((dx !== 0 ? cz : cx) * S) * t;
    const bkLo = this.fieldAt(this.floorLight, cx * S + dx * S * 0.35, cz * S + dz * S * 0.35);
    const bkHi = this.fieldAt(isHalf ? this.floorLight : this.ceilLight, cx * S + dx * S * 0.35, cz * S + dz * S * 0.35);
    const mid = [0, 1, 2].map((k) => (bkLo[k] * 0.55 + bkHi[k] * 0.45));
    // wind the quad so it faces the open cell
    if (dx + dz > 0) {
      b.quad(a, bb, c, dd, n, [[u0, 0], [u0 + uSpan, 0], [u0 + uSpan, vSpan], [u0, vSpan]], [bkLo, bkLo, mid, mid]);
    } else {
      b.quad(bb, a, dd, c, n, [[u0 + uSpan, 0], [u0, 0], [u0, vSpan], [u0 + uSpan, vSpan]], [bkLo, bkLo, mid, mid]);
    }
  }

  // The little vertical face where one walkable cell is higher than its neighbour.
  _riserQuad(b, cx, cz, dx, dz, y0, y1) {
    this._wallQuad(b, cx, cz, dx, dz, y0, y1, b.name, true);
  }

  // ------------------------------------------------------------------ water
  _buildWater() {
    const wet = [];
    for (let cz = 0; cz < this.h; cz++) {
      for (let cx = 0; cx < this.w; cx++) {
        if (WET.has(this.cells[this.idx(cx, cz)])) wet.push([cx, cz]);
      }
    }
    if (!wet.length) { this.water = null; return; }
    const surf = this.waterY ?? 0;
    const S = this.cell;
    const pos = [], uv = [], nor = [], bake = [];
    const cpos = [], cuv = [], cnor = [], cbake = [];
    for (const [cx, cz] of wet) {
      const i = this.idx(cx, cz);
      const x0 = cx * S - S / 2, x1 = cx * S + S / 2, z0 = cz * S - S / 2, z1 = cz * S + S / 2;
      const bk = this.fieldAt(this.floorLight, cx * S, cz * S);
      for (const [p, u] of [
        [[x0, surf, z1], [x0 * 0.25, z1 * 0.25]], [[x1, surf, z1], [x1 * 0.25, z1 * 0.25]],
        [[x1, surf, z0], [x1 * 0.25, z0 * 0.25]], [[x0, surf, z1], [x0 * 0.25, z1 * 0.25]],
        [[x1, surf, z0], [x1 * 0.25, z0 * 0.25]], [[x0, surf, z0], [x0 * 0.25, z0 * 0.25]],
      ]) {
        pos.push(p[0], p[1], p[2]);
        uv.push(u[0], u[1]);
        nor.push(0, 1, 0);
        bake.push(bk[0], bk[1], bk[2]);
      }
      // caustics land on the floor of the pool, a hair above the tile
      const fy = this.floorYs[i] + 0.02;
      for (const [p, u] of [
        [[x0, fy, z1], [x0 * 0.3, z1 * 0.3]], [[x1, fy, z1], [x1 * 0.3, z1 * 0.3]],
        [[x1, fy, z0], [x1 * 0.3, z0 * 0.3]], [[x0, fy, z1], [x0 * 0.3, z1 * 0.3]],
        [[x1, fy, z0], [x1 * 0.3, z0 * 0.3]], [[x0, fy, z0], [x0 * 0.3, z0 * 0.3]],
      ]) {
        cpos.push(p[0], p[1], p[2]);
        cuv.push(u[0], u[1]);
        cnor.push(0, 1, 0);
        cbake.push(bk[0], bk[1], bk[2]);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    const wtex = waterTexture();
    const wnor = waterNormal();
    this.waterMat = new THREE.MeshStandardMaterial({
      map: wtex, normalMap: wnor, transparent: true, opacity: 0.72,
      roughness: 0.06, metalness: 0.1, side: THREE.DoubleSide,
      color: 0xbfe8f0, envMapIntensity: 0.6,
    });
    this.waterMat.normalScale = new THREE.Vector2(0.6, 0.6);
    const mesh = new THREE.Mesh(geo, this.waterMat);
    mesh.renderOrder = 2;
    this.group.add(mesh);
    this.water = mesh;
    this.disposables.push(geo);

    const cgeo = new THREE.BufferGeometry();
    cgeo.setAttribute('position', new THREE.Float32BufferAttribute(cpos, 3));
    cgeo.setAttribute('normal', new THREE.Float32BufferAttribute(cnor, 3));
    cgeo.setAttribute('uv', new THREE.Float32BufferAttribute(cuv, 2));
    this.causticMat = new THREE.MeshBasicMaterial({
      map: causticTexture(), transparent: true, opacity: 0.3,
      blending: THREE.AdditiveBlending, depthWrite: false,
    });
    const caustics = new THREE.Mesh(cgeo, this.causticMat);
    caustics.renderOrder = 1;
    this.group.add(caustics);
    this.caustics = caustics;
    this.disposables.push(cgeo);
  }

  // ------------------------------------------------------------------ fixtures
  _buildFixtures() {
    const S = this.cell;
    const shaftMat = simple(0xfff4d8, { emissive: 0xfff0c0, emissiveIntensity: 0.9, opacity: 0.10, bake: false });
    shaftMat.blending = THREE.AdditiveBlending;
    shaftMat.depthWrite = false;
    this.fixtureMeshes = [];
    for (const l of this.lights) {
      if (l.fixture === 'none') continue;
      const cx = Math.round(l.x), cz = Math.round(l.z);
      const ceil = this.cellCeil(cx, cz);
      const floor = this.cellFloor(cx, cz);
      if (l.fixture === 'sun') {
        // a shaft of light with no window at the top of it
        const hgt = Math.max(2, ceil - floor);
        const cone = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 2.6, hgt, 10, 1, true), shaftMat);
        cone.position.set(l.x * S, floor + hgt / 2, l.z * S);
        this.group.add(cone);
        this.disposables.push(cone.geometry);
        continue;
      }
      const nameMap = {
        tube: 'tube', panel: 'panelLight', bulb: 'bulb', cage: 'cageLight',
        lamp: 'lamp', flood: 'floodlight', poolLight: 'poolLight',
      };
      const propName = nameMap[l.fixture] || 'tube';
      const rec = {
        name: propName, px: l.x * S, pz: l.z * S, rot: l.rot || 0,
        dead: l.dead || !l.on, y: l.y !== null && l.y !== undefined ? l.y : null,
      };
      const g = buildProp(rec, floor, ceil);
      this.group.add(g);
      this.fixtureMeshes.push({ g, light: l });
      g.traverse((o) => { if (o.geometry) this.disposables.push(o.geometry); });
    }
  }

  // ------------------------------------------------------------------ props
  _buildProps() {
    const S = this.cell;
    for (const p of this.data.props) {
      const cx = Math.round(p.x), cz = Math.round(p.z);
      const rec = { ...p, px: p.x * S, pz: p.z * S };
      let g;
      try {
        g = buildProp(rec, this.cellFloor(cx, cz), this.cellCeil(cx, cz));
      } catch { continue; }
      // props sit in the same baked light as the floor they stand on
      const bk = this.fieldAt(this.floorLight, p.x * S, p.z * S);
      g.traverse((o) => {
        if (!o.isMesh) return;
        if (!o.geometry.getAttribute('abake')) {
          const n = o.geometry.getAttribute('position').count;
          const arr = new Float32Array(n * 3);
          for (let i = 0; i < n; i++) { arr[i * 3] = bk[0]; arr[i * 3 + 1] = bk[1]; arr[i * 3 + 2] = bk[2]; }
          o.geometry.setAttribute('abake', new THREE.BufferAttribute(arr, 3));
        }
        this.disposables.push(o.geometry);
      });
      this.group.add(g);
    }
  }

  // ------------------------------------------------------------------ sky
  _buildSky() {
    const s = this.data.sky;
    if (!this.data.openSky || !s) { this.sky = null; return; }
    const cv = document.createElement('canvas');
    cv.width = 32; cv.height = 256;
    const ctx = cv.getContext('2d');
    const grad = ctx.createLinearGradient(0, 0, 0, 256);
    grad.addColorStop(0, `#${(s.top ?? 0x101828).toString(16).padStart(6, '0')}`);
    grad.addColorStop(1, `#${(s.bottom ?? 0x2a3240).toString(16).padStart(6, '0')}`);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 32, 256);
    if (s.stars) {
      const R = rng(77);
      for (let i = 0; i < 260; i++) {
        const y = R() * 200;
        ctx.fillStyle = `rgba(255,255,240,${0.25 + R() * 0.6})`;
        ctx.fillRect(R() * 32, y, 1, 1);
      }
    }
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    const size = Math.max(this.w, this.h) * this.cell;
    const dome = new THREE.Mesh(
      new THREE.SphereGeometry(size * 0.85, 20, 12),
      new THREE.MeshBasicMaterial({ map: tex, side: THREE.BackSide, fog: false, depthWrite: false }),
    );
    dome.position.set((this.w * this.cell) / 2, 0, (this.h * this.cell) / 2);
    this.scene.add(dome);
    this.sky = dome;
    this.disposables.push(dome.geometry);
    if (s.sun) {
      const sun = new THREE.DirectionalLight(s.sun, s.sunIntensity ?? 0.5);
      sun.position.set(size * 0.4, size * 0.6, size * 0.2);
      this.scene.add(sun);
      this.sunLight = sun;
    }
  }

  // ------------------------------------------------------------------ live light
  _buildLightPool() {
    this.pool = [];
    const n = Math.max(3, Math.round(POOL_SIZE * this.quality));
    for (let i = 0; i < n; i++) {
      const pl = new THREE.PointLight(0xffffff, 0, 10, 2);
      pl.visible = false;
      this.scene.add(pl);
      this.pool.push(pl);
    }
  }

  _buildColliders() {
    const S = this.cell;
    // Straight cell→world conversion. This used to pad every box by half a cell on
    // each side "for the body", which turned a 1.4-cell cabinet into a 7.7-metre
    // invisible block — enough to seal a corridor with nothing visible in it. The
    // player's own radius probes handle clearance; the box is the box.
    this.colliders = this.data.colliders.map((c) => ({
      x0: c.x0 * S, x1: c.x1 * S,
      z0: c.z0 * S, z1: c.z1 * S,
      y0: c.y0, y1: c.y1,
    }));
  }

  // ------------------------------------------------------------------ hiding
  // Each floor's cover, with a prop to make it read from across the room and a
  // collider so you cannot stand inside it by accident.
  _buildHides() {
    const S = this.cell;
    const PROP = {
      locker: 'lockers', cubicle: 'cubicle', gurney: 'gurney', shelf: 'archiveShelf',
      crate: 'crateStack', stall: 'bathStall', car: 'car', water: null,
      drift: 'snowDrift', wheat: 'wheatPatch', vent: 'ventFloor', tent: 'tent',
      curtain: 'bathStall', crawl: 'pipeRun',
    };
    this.hides = (this.data.hides || []).map((h) => {
      const wx = h.x * S, wz = h.z * S;
      const y = this.floorAtWorld(wx, wz);
      const propName = PROP[h.kind];
      if (propName) {
        try {
          const g = buildProp({ name: propName, px: wx, pz: wz, rot: h.rot || 0, y: null, len: 4, height: 2 }, y, this.cellCeil(h.x, h.z));
          const bk = this.fieldAt(this.floorLight, wx, wz);
          g.traverse((o) => {
            if (!o.isMesh || o.geometry.getAttribute('abake')) return;
            const n = o.geometry.getAttribute('position').count;
            const arr = new Float32Array(n * 3);
            for (let i = 0; i < n; i++) { arr[i * 3] = bk[0]; arr[i * 3 + 1] = bk[1]; arr[i * 3 + 2] = bk[2]; }
            o.geometry.setAttribute('abake', new THREE.BufferAttribute(arr, 3));
            this.disposables.push(o.geometry);
          });
          this.group.add(g);
        } catch { /* the kind has no prop; the spot still works */ }
      }
      return { ...h, wx, wz, y, kind: h.kind };
    });
  }

  nearestHide(x, z, r = 2.4) {
    let best = null, bd = r;
    for (const h of this.hides) {
      const d = Math.hypot(h.wx - x, h.wz - z);
      if (d < bd) { bd = d; best = h; }
    }
    return best;
  }

  // ------------------------------------------------------------------ arrows
  // Somebody who got out chalked the way. The route is the real breadth-first
  // path from the spawn to the lift, marked every few cells — enough to keep you
  // moving, never enough to tell you what is between you and it.
  _buildArrows(extra = 0) {
    const S = this.cell;
    const d = this.data;
    const lift = (d.exits || []).find((e) => e.kind === 'elevator') || d.exits?.[0];
    if (!lift) { this.arrows = []; return; }
    // flood from the lift so every cell knows its distance to the way out
    const dist = new Int32Array(this.w * this.h).fill(-1);
    const q = new Int32Array(this.w * this.h);
    let head = 0, tail = 0;
    const start = this.idx(Math.round(lift.x), Math.round(lift.z));
    dist[start] = 0;
    q[tail++] = start;
    while (head < tail) {
      const i = q[head++];
      const cx = i % this.w, cz = (i / this.w) | 0;
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = cx + dx, nz = cz + dz;
        if (!this.inside(nx, nz)) continue;
        const j = this.idx(nx, nz);
        // This floods OUT from the lift, but the player walks IN — so the step has to
        // be walkable in their direction, j → i. Traversal is not symmetric (you drop
        // off a loading bank, you do not climb back up it), and testing the wrong way
        // round hands the player a route that ends at a ledge with an arrow on it.
        if (dist[j] !== -1 || !this.isOpenCell(nx, nz)) continue;
        if (!this.walkStep(nx, nz, cx, cz)) continue;
        dist[j] = dist[i] + 1;
        q[tail++] = j;
      }
    }
    this.liftDist = dist;

    // Mark the whole floor, not just the one route: whoever came through here was
    // lost too, and chalked as they went. Every cell whose distance to the lift is a
    // multiple of `every` is a candidate, thinned so the marks read as occasional
    // rather than as a painted line — so wherever you are, walking a little in any
    // direction finds a mark, and the mark points down the gradient.
    const every = Math.max(3, 8 - extra * 2);
    const gap = Math.max(2, Math.round(every * 0.8));
    const taken = new Uint8Array(this.w * this.h);
    const marks = [];
    const spacedOut = (cx, cz) => {
      for (let z = Math.max(0, cz - gap); z <= Math.min(this.h - 1, cz + gap); z++) {
        for (let x = Math.max(0, cx - gap); x <= Math.min(this.w - 1, cx + gap); x++) {
          if (taken[this.idx(x, z)]) return false;
        }
      }
      return true;
    };
    const cand = [];
    for (let cz = 1; cz < this.h - 1; cz++) {
      for (let cx = 1; cx < this.w - 1; cx++) {
        const here = dist[this.idx(cx, cz)];
        if (here >= 2 && here % every === 0) cand.push(cz * this.w + cx);
      }
    }
    // Take candidates in a strided order rather than row by row, so hitting the cap
    // thins the marks everywhere instead of leaving half the floor unmarked.
    const CAP = 220;
    const stride = cand.length ? (cand.length % 7 ? 7 : 11) : 1;
    for (let n = 0, k = 0; n < cand.length && marks.length < CAP; n++) {
      k = (k + stride) % cand.length;
      const i = cand[k];
      const cx = i % this.w, cz = (i / this.w) | 0;
      const step = this.downhill(cx, cz);
      if (!step || !spacedOut(cx, cz)) continue;
      taken[i] = 1;
      marks.push([cx, cz, step[0], step[1]]);
    }

    this.arrows = [];
    for (const [cx, cz, dx, dz] of marks) {
      const wx = cx * S, wz = cz * S;
      // chalkArrow is drawn pointing along its own +X (the head sits at u≈1), so the
      // yaw that aims it at (dx, dz) is atan2(-dz, dx) — not the -Z convention the
      // rest of the props use. Get this wrong and every mark points at a wall.
      const rot = Math.atan2(-dz, dx);
      try {
        const g = buildProp({ name: 'chalkArrow', px: wx, pz: wz, rot, y: null }, this.floorAtWorld(wx, wz), 3);
        // chalk lifts itself out of the dark a little, or it may as well not be there
        g.traverse((o) => { if (o.isMesh) { o.material.emissive?.setHex?.(0x6a6a5e); this.disposables.push(o.geometry); } });
        this.group.add(g);
        this.arrows.push({ x: wx, z: wz, rot, step: [dx, dz] });
      } catch { /* no arrow, no harm */ }
    }
  }

  // Which way is the lift from here: the neighbour that is closer to it AND that a
  // body can actually step to. Skip the second half of that and the mark on the floor
  // ends up pointing at the face of a loading bank you cannot climb — the flood is
  // happy to route through the drop, a person is not.
  downhill(cx, cz) {
    const dist = this.liftDist;
    if (!dist || !this.inside(cx, cz)) return null;
    const here = dist[this.idx(cx, cz)];
    if (here < 0) return null;
    let step = null, best = here;
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = cx + dx, nz = cz + dz;
      if (!this.inside(nx, nz)) continue;
      const v = dist[this.idx(nx, nz)];
      if (v < 0 || v >= best) continue;
      if (!this.walkStep(cx, cz, nx, nz)) continue;
      best = v; step = [dx, dz];
    }
    return step;
  }

  // Which way is the lift from here, for the FLOOR PLAN powerup.
  liftBearing(x, z) {
    if (!this.liftDist) return null;
    const [cx, cz] = this.toCell(x, z);
    const here = this.liftDist[this.idx(cx, cz)];
    if (here < 0) return null;
    const dir = this.downhill(cx, cz);
    if (!dir) return { angle: 0, dist: here };
    return { angle: Math.atan2(-dir[0], -dir[1]), dist: here - 1 };
  }

  // ------------------------------------------------------------------ runtime
  douse(x, z, radius, secs) {
    const [cx, cz] = this.toCell(x, z);
    for (const l of this.lights) {
      if (Math.hypot(l.x - cx, l.z - cz) <= radius) l.out = Math.max(l.out, secs);
    }
  }

  killNearestLight(x, z) {
    const [cx, cz] = this.toCell(x, z);
    let best = null, bd = Infinity;
    for (const l of this.lights) {
      if (l.dead || !l.on) continue;
      const d = Math.hypot(l.x - cx, l.z - cz);
      if (d < bd) { bd = d; best = l; }
    }
    if (best) { best.dead = true; best.out = 1e6; }
    return best;
  }

  // Brightness of the room where the player is standing — the smilers care.
  lightAt(x, z) {
    const [cx, cz] = this.toCell(x, z);
    if (!this.inside(cx, cz)) return 0;
    const i = this.idx(cx, cz) * 3;
    const base = (this.floorLight[i] + this.floorLight[i + 1] + this.floorLight[i + 2]) / 3;
    return base;
  }

  update(dt, player) {
    this.time += dt;
    const t = this.time;

    // ---- flicker + forced darkness
    for (const l of this.lights) {
      if (l.out > 0) l.out -= dt;
      let level = l.dead || l.out > 0 ? 0 : 1;
      if (level && l.flicker > 0) {
        const n = this.noise.at(t * (2 + l.flicker * 8) + l.phase, l.phase);
        const dying = l.flicker > 0.5;
        level = dying
          ? (n > 0.15 - l.flicker * 0.3 ? 1 : 0.04) * (0.7 + 0.3 * Math.sin(t * 60 + l.phase))
          : 1 - Math.max(0, -n) * l.flicker * 1.4;
      }
      l.level = Math.max(0, level);
    }

    // ---- fixture meshes follow their light's state
    for (const { g, light } of this.fixtureMeshes) {
      const lvl = light.level ?? 1;
      g.traverse((o) => {
        if (o.isMesh && o.material?.emissive && o.material.emissiveIntensity !== undefined) {
          if (o.material.userData.glow === undefined) {
            o.material.userData.glow = o.material.emissiveIntensity;
          }
          const base = o.material.userData.glow;
          if (base > 0.5) o.material.emissiveIntensity = base * lvl;
        }
      });
    }

    // ---- assign the pool to the nearest live fixtures
    const [pcx, pcz] = this.toCell(player.x, player.z);
    const near = [];
    for (const l of this.lights) {
      if ((l.level ?? 1) <= 0.02) { l.live = null; continue; }
      const d = Math.hypot(l.x - pcx, l.z - pcz);
      if (d > l.radius + 8) { l.live = null; continue; }
      near.push([d - (l.dynamic ? 6 : 0), l]);
    }
    near.sort((a, b) => a[0] - b[0]);
    for (let i = 0; i < this.pool.length; i++) {
      const pl = this.pool[i];
      const pick = near[i];
      if (!pick) { pl.visible = false; pl.intensity = 0; continue; }
      const l = pick[1];
      const cx = Math.round(l.x), cz = Math.round(l.z);
      const y = l.y !== null && l.y !== undefined ? l.y : this.cellCeil(cx, cz) - 0.2;
      pl.position.set(l.x * this.cell, y, l.z * this.cell);
      pl.color.setHex(l.color);
      pl.distance = l.radius * this.cell * 0.5 + l.radius * 0.5;
      pl.intensity = l.intensity * (l.level ?? 1) * 2.2;
      pl.visible = true;
    }

    // ---- water and caustics drift
    if (this.waterMat) {
      this.waterMat.map.offset.set(t * 0.012, t * 0.008);
      this.waterMat.normalMap.offset.set(Math.sin(t * 0.09) * 0.05 + t * 0.02, Math.cos(t * 0.07) * 0.05);
    }
    if (this.causticMat) {
      this.causticMat.map.offset.set(Math.sin(t * 0.13) * 0.08, t * 0.03);
      this.causticMat.opacity = 0.22 + Math.sin(t * 0.8) * 0.07;
    }
  }

  dispose() {
    this.scene.remove(this.group);
    if (this.sky) this.scene.remove(this.sky);
    if (this.sunLight) this.scene.remove(this.sunLight);
    for (const pl of this.pool) this.scene.remove(pl);
    for (const g of this.disposables) g.dispose?.();
    this.disposables = [];
  }
}
