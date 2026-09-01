// Chunk-streamed terrain. Near chunks are 64m tiles with per-vertex colors,
// analytic normals (so lighting is seamless across chunk borders) and skirt
// rings (so streaming LOD never shows cracks). A second tier of big low-res
// far tiles carries the horizon out ~1.5km for the vista shots.
// Physics never touches these meshes — everyone walks on world.heightAt().

import * as THREE from 'three';
import { SEA_LEVEL } from './world.js';

export const CHUNK = 64;

const FAR_TILE = 320;
const FAR_RES = 10;
const FAR_RADIUS = 3; // tiles each side → ~2.2km square of horizon

export class Terrain {
  constructor(scene, world, opts = {}) {
    this.scene = scene;
    this.world = world;
    this.res = opts.res ?? 32;
    this.radius = opts.radius ?? 5;
    this.floraRadius = opts.floraRadius ?? 4;
    this.scatter = opts.scatter || null; // (cx, cz) → THREE.Group | null
    this.chunks = new Map();             // "cx,cz" → {mesh, flora, cx, cz}
    this.farTiles = new Map();
    this.mat = new THREE.MeshLambertMaterial({ vertexColors: true });
    this.buildQueue = [];
    this._makeWater();
  }

  setRadius(r) { this.radius = r; }

  // ---- height-grid chunk builder ------------------------------------------
  _buildGrid(originX, originZ, size, res) {
    const w = this.world;
    const step = size / res;
    const gw = res + 3; // one-vertex border for normal/slope differences
    const hs = new Float32Array(gw * gw);
    for (let gz = 0; gz < gw; gz++) {
      for (let gx = 0; gx < gw; gx++) {
        hs[gz * gw + gx] = w.heightAt(originX + (gx - 1) * step, originZ + (gz - 1) * step);
      }
    }
    return { hs, gw, step };
  }

  _buildMesh(originX, originZ, size, res, yOffset = 0) {
    const w = this.world;
    const { hs, gw, step } = this._buildGrid(originX, originZ, size, res);
    const n = res + 1;
    const skirtDepth = Math.max(2.5, size * 0.02);
    const vertCount = n * n + n * 4;
    const pos = new Float32Array(vertCount * 3);
    const nrm = new Float32Array(vertCount * 3);
    const col = new Float32Array(vertCount * 3);

    const H = (gx, gz) => hs[(gz + 1) * gw + (gx + 1)];
    let vi = 0;
    for (let gz = 0; gz < n; gz++) {
      for (let gx = 0; gx < n; gx++) {
        const x = gx * step, z = gz * step, h = H(gx, gz);
        pos[vi * 3] = x; pos[vi * 3 + 1] = h + yOffset; pos[vi * 3 + 2] = z;
        // analytic-ish normal from the height grid (matches neighbors exactly)
        const hl = H(gx - 1, gz), hr = H(gx + 1, gz), ht = H(gx, gz - 1), hb = H(gx, gz + 1);
        const nx = hl - hr, ny = 2 * step, nz = ht - hb;
        const il = 1 / Math.hypot(nx, ny, nz);
        nrm[vi * 3] = nx * il; nrm[vi * 3 + 1] = ny * il; nrm[vi * 3 + 2] = nz * il;
        const slope = Math.hypot(hr - hl, hb - ht) / (2 * step);
        const c = w.colorAt(originX + x, originZ + z, h, slope);
        col[vi * 3] = c[0]; col[vi * 3 + 1] = c[1]; col[vi * 3 + 2] = c[2];
        vi++;
      }
    }

    // Skirts: copies of the 4 edges, dropped straight down. Normals/colors
    // duplicate the edge so the wall is invisible — it only hides cracks.
    const edge = [];
    for (let gx = 0; gx < n; gx++) edge.push([gx, 0]);
    for (let gx = 0; gx < n; gx++) edge.push([gx, res]);
    for (let gz = 0; gz < n; gz++) edge.push([0, gz]);
    for (let gz = 0; gz < n; gz++) edge.push([res, gz]);
    const skirtStart = n * n;
    for (let i = 0; i < edge.length; i++) {
      const [gx, gz] = edge[i];
      const src = gz * n + gx, dst = skirtStart + i;
      pos[dst * 3] = pos[src * 3];
      pos[dst * 3 + 1] = pos[src * 3 + 1] - skirtDepth;
      pos[dst * 3 + 2] = pos[src * 3 + 2];
      nrm[dst * 3] = nrm[src * 3]; nrm[dst * 3 + 1] = nrm[src * 3 + 1]; nrm[dst * 3 + 2] = nrm[src * 3 + 2];
      col[dst * 3] = col[src * 3]; col[dst * 3 + 1] = col[src * 3 + 1]; col[dst * 3 + 2] = col[src * 3 + 2];
    }

    const idx = [];
    for (let gz = 0; gz < res; gz++) {
      for (let gx = 0; gx < res; gx++) {
        const a = gz * n + gx, b = a + 1, c = a + n, d = c + 1;
        idx.push(a, c, b, b, c, d);
      }
    }
    // skirt quads per edge run
    const runs = [
      { off: 0, main: (i) => i, flip: false },                    // north (gz=0)
      { off: n, main: (i) => res * n + i, flip: true },           // south
      { off: 2 * n, main: (i) => i * n, flip: true },             // west
      { off: 3 * n, main: (i) => i * n + res, flip: false },      // east
    ];
    for (const r of runs) {
      for (let i = 0; i < res; i++) {
        const m0 = r.main(i), m1 = r.main(i + 1);
        const s0 = skirtStart + r.off + i, s1 = skirtStart + r.off + i + 1;
        if (r.flip) idx.push(m0, s0, m1, m1, s0, s1);
        else idx.push(m0, m1, s0, s0, m1, s1);
      }
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    geo.setIndex(idx);
    const mesh = new THREE.Mesh(geo, this.mat);
    mesh.position.set(originX, 0, originZ);
    mesh.receiveShadow = true;
    mesh.matrixAutoUpdate = false;
    mesh.updateMatrix();
    return mesh;
  }

  // ---- streaming ------------------------------------------------------------
  update(px, pz, budgetMs = 6, dt = 0.016) {
    const pcx = Math.floor(px / CHUNK), pcz = Math.floor(pz / CHUNK);
    const R = this.radius;

    // enqueue missing chunks, nearest first
    this.buildQueue.length = 0;
    for (let dz = -R; dz <= R; dz++) {
      for (let dx = -R; dx <= R; dx++) {
        if (dx * dx + dz * dz > (R + 0.5) * (R + 0.5)) continue;
        const cx = pcx + dx, cz = pcz + dz, key = cx + ',' + cz;
        const rec = this.chunks.get(key);
        if (!rec) this.buildQueue.push([dx * dx + dz * dz, cx, cz]);
        else this._syncFlora(rec, dx * dx + dz * dz);
      }
    }
    this.buildQueue.sort((a, b) => a[0] - b[0]);

    // Build until the budget would be EXCEEDED by another build (predicted
    // from a rolling average), not merely reached — the first chunk is always
    // built so streaming can't starve.
    const t0 = performance.now();
    let built = 0;
    for (const [d2, cx, cz] of this.buildQueue) {
      if (built > 0 && performance.now() - t0 + (this._buildCost || 2) > budgetMs) break;
      const s0 = performance.now();
      const mesh = this._buildMesh(cx * CHUNK, cz * CHUNK, CHUNK, this.res);
      const cost = performance.now() - s0;
      this._buildCost = this._buildCost === undefined ? cost : this._buildCost * 0.8 + cost * 0.2;
      this.scene.add(mesh);
      const rec = { mesh, flora: null, cx, cz };
      this.chunks.set(cx + ',' + cz, rec);
      this._syncFlora(rec, d2);
      built++;
      if (built >= 6) break;
    }

    // unload strays
    for (const [key, rec] of this.chunks) {
      const dx = rec.cx - pcx, dz = rec.cz - pcz;
      if (dx * dx + dz * dz > (R + 1.6) * (R + 1.6)) {
        this._disposeChunk(rec);
        this.chunks.delete(key);
      }
    }

    this._updateFarTiles(px, pz);
    this._updateWater(px, pz, dt);
  }

  _syncFlora(rec, d2) {
    const want = d2 <= this.floraRadius * this.floraRadius;
    if (want && !rec.flora && this.scatter) {
      const g = this.scatter(rec.cx, rec.cz);
      if (g) { this.scene.add(g); }
      rec.flora = g || 'none';
    } else if (!want && rec.flora && rec.flora !== 'none') {
      this._disposeFlora(rec.flora);
      rec.flora = null;
    }
  }

  _disposeFlora(group) {
    this.scene.remove(group);
    group.traverse((o) => { if (o.isInstancedMesh) o.dispose(); });
  }

  _disposeChunk(rec) {
    this.scene.remove(rec.mesh);
    rec.mesh.geometry.dispose();
    if (rec.flora && rec.flora !== 'none') this._disposeFlora(rec.flora);
  }

  // Blocking pre-generation for game start (loading screen covers it).
  pregenerate(px, pz, rings = 2) {
    const pcx = Math.floor(px / CHUNK), pcz = Math.floor(pz / CHUNK);
    for (let dz = -rings; dz <= rings; dz++) {
      for (let dx = -rings; dx <= rings; dx++) {
        const cx = pcx + dx, cz = pcz + dz, key = cx + ',' + cz;
        if (this.chunks.has(key)) continue;
        const mesh = this._buildMesh(cx * CHUNK, cz * CHUNK, CHUNK, this.res);
        this.scene.add(mesh);
        const rec = { mesh, flora: null, cx, cz };
        this.chunks.set(key, rec);
        this._syncFlora(rec, dx * dx + dz * dz);
      }
    }
    this._updateFarTiles(px, pz);
  }

  // ---- far horizon tier ------------------------------------------------------
  _updateFarTiles(px, pz) {
    const tx = Math.floor(px / FAR_TILE), tz = Math.floor(pz / FAR_TILE);
    const wanted = new Set();
    let builtOne = false;
    for (let dz = -FAR_RADIUS; dz <= FAR_RADIUS; dz++) {
      for (let dx = -FAR_RADIUS; dx <= FAR_RADIUS; dx++) {
        const key = (tx + dx) + ',' + (tz + dz);
        wanted.add(key);
        if (!this.farTiles.has(key) && !builtOne) {
          const mesh = this._buildMesh((tx + dx) * FAR_TILE, (tz + dz) * FAR_TILE, FAR_TILE, FAR_RES, -1.6);
          mesh.receiveShadow = false;
          this.scene.add(mesh);
          this.farTiles.set(key, mesh);
          builtOne = true; // cheap, but still 1/frame
        }
      }
    }
    for (const [key, mesh] of this.farTiles) {
      if (!wanted.has(key)) {
        this.scene.remove(mesh);
        mesh.geometry.dispose();
        this.farTiles.delete(key);
      }
    }
  }

  // ---- water -----------------------------------------------------------------
  _makeWater() {
    const RES = 48, SIZE = 2600;
    const geo = new THREE.PlaneGeometry(SIZE, SIZE, RES, RES);
    geo.rotateX(-Math.PI / 2);
    this.waterMat = new THREE.MeshLambertMaterial({
      color: 0x1c5d7c, transparent: true, opacity: 0.78, depthWrite: false,
      emissive: 0x06222e,
    });
    this.water = new THREE.Mesh(geo, this.waterMat);
    this.water.renderOrder = 2;
    this.water.position.y = SEA_LEVEL;
    this.scene.add(this.water);
    this._waveT = 0;
  }

  _updateWater(px, pz, dt = 0.016) {
    this._waveT += dt;
    this.water.position.x = px;
    this.water.position.z = pz;
    const posAttr = this.water.geometry.attributes.position;
    const t = this._waveT;
    for (let i = 0; i < posAttr.count; i++) {
      const wx = posAttr.getX(i) + px, wz = posAttr.getZ(i) + pz;
      posAttr.setY(i, Math.sin(wx * 0.06 + t * 1.1) * 0.14 + Math.cos(wz * 0.05 + t * 0.8) * 0.12);
    }
    posAttr.needsUpdate = true;
  }

  chunkCount() { return this.chunks.size; }

  dispose() {
    for (const rec of this.chunks.values()) this._disposeChunk(rec);
    this.chunks.clear();
    for (const mesh of this.farTiles.values()) { this.scene.remove(mesh); mesh.geometry.dispose(); }
    this.farTiles.clear();
    this.scene.remove(this.water);
    this.water.geometry.dispose();
  }
}
