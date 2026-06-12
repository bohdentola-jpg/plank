// Things that exist between blocks: dropped items that bob, spin and fly to
// your pocket, and the little particle bursts when a block gives way.
import * as THREE from 'three';
import { BLOCKS, ITEMS, isBlock } from './blocks.js';
import { buildAtlas, tilesFor, itemIconCanvas, avgColor } from './textures.js';
import { SOLID } from './world.js';

const _geoCache = new Map();
const _texCache = new Map();

function atlasTexture() {
  if (_texCache.has('atlas')) return _texCache.get('atlas');
  const t = new THREE.CanvasTexture(buildAtlas().canvas);
  t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter;
  t.colorSpace = THREE.SRGBColorSpace;
  _texCache.set('atlas', t);
  return t;
}

// tiny cube with the block's own atlas tiles on each face
function blockGeo(id) {
  if (_geoCache.has(id)) return _geoCache.get(id);
  const a = buildAtlas();
  const t = tilesFor(id);
  const uvOf = (name) => {
    const [tx, ty] = a.index[name] || [0, 0];
    const e = 0.02;
    return [(tx + e) / a.cols, 1 - (ty + 1 - e) / a.rows, (tx + 1 - e) / a.cols, 1 - (ty + e) / a.rows];
  };
  const g = new THREE.BoxGeometry(0.3, 0.3, 0.3);
  const uvAttr = g.getAttribute('uv');
  const faceTiles = [t.side, t.side, t.top, t.bottom, t.front, t.side]; // +x,-x,+y,-y,+z,-z
  for (let f = 0; f < 6; f++) {
    const [u0, v0, u1, v1] = uvOf(faceTiles[f]);
    const base = f * 4;
    const us = [u0, u1, u0, u1], vs = [v1, v1, v0, v0];
    for (let i = 0; i < 4; i++) uvAttr.setXY(base + i, us[i], vs[i]);
  }
  uvAttr.needsUpdate = true;
  _geoCache.set(id, g);
  return g;
}

function itemTexture(iconName) {
  const k = 'i' + iconName;
  if (_texCache.has(k)) return _texCache.get(k);
  const t = new THREE.CanvasTexture(itemIconCanvas(iconName));
  t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter;
  t.colorSpace = THREE.SRGBColorSpace;
  _texCache.set(k, t);
  return t;
}

export function buildDropMesh(id) {
  if (isBlock(id) && !BLOCKS[id]?.cross) {
    const m = new THREE.Mesh(blockGeo(id), new THREE.MeshBasicMaterial({ map: atlasTexture() }));
    return m;
  }
  const icon = isBlock(id) ? null : ITEMS[id]?.icon;
  const tex = icon ? itemTexture(icon) : atlasTexture();
  const mat = new THREE.MeshBasicMaterial({ map: tex, alphaTest: 0.15, side: THREE.DoubleSide, transparent: true });
  const geo = new THREE.PlaneGeometry(0.36, 0.36);
  if (!icon && isBlock(id)) { // cross blocks (torch, flowers): their tile on a card
    const a = buildAtlas();
    const [tx, ty] = a.index[tilesFor(id).side] || [0, 0];
    const uv = geo.getAttribute('uv');
    for (let i = 0; i < 4; i++) {
      uv.setXY(i, (tx + uv.getX(i)) / a.cols, 1 - (ty + 1 - uv.getY(i)) / a.rows);
    }
  }
  return new THREE.Mesh(geo, mat);
}

export class Drops {
  constructor(world, scene) {
    this.world = world; this.scene = scene;
    this.list = [];
  }

  spawn(id, n, x, y, z, kick = true) {
    const mesh = buildDropMesh(id);
    mesh.position.set(x, y, z);
    this.scene.add(mesh);
    this.list.push({
      id, n, mesh, age: 0,
      x, y, z,
      vx: kick ? (Math.random() - 0.5) * 2.4 : 0,
      vy: kick ? 2.4 + Math.random() * 1.4 : 0,
      vz: kick ? (Math.random() - 0.5) * 2.4 : 0,
    });
  }

  // returns ids picked up this frame (for the pickup pop sound)
  update(dt, player, inv, dayFactor) {
    const picked = [];
    for (let i = this.list.length - 1; i >= 0; i--) {
      const d = this.list[i];
      d.age += dt;
      // physics: a featherweight point with a floor
      d.vy -= 16 * dt;
      if (this.world.fluidAt(d.x, d.y, d.z)) { d.vy += 24 * dt; d.vy *= 1 - 3 * dt; d.vx *= 1 - 2 * dt; d.vz *= 1 - 2 * dt; }
      let nx = d.x + d.vx * dt, ny = d.y + d.vy * dt, nz = d.z + d.vz * dt;
      if (SOLID[this.world.block(Math.floor(nx), Math.floor(d.y), Math.floor(d.z))]) { nx = d.x; d.vx = 0; }
      if (SOLID[this.world.block(Math.floor(nx), Math.floor(d.y), Math.floor(nz))]) { nz = d.z; d.vz = 0; }
      if (SOLID[this.world.block(Math.floor(nx), Math.floor(ny), Math.floor(nz))]) {
        if (d.vy < 0) ny = Math.floor(ny) + 1.001;
        d.vy = 0; d.vx *= 0.6; d.vz *= 0.6;
      }
      d.x = nx; d.y = ny; d.z = nz;

      // magnet + pickup
      if (player && !player.dead && d.age > 0.4) {
        const px = player.pos.x - d.x, py = player.pos.y + 0.8 - d.y, pz = player.pos.z - d.z;
        const dist = Math.hypot(px, py, pz);
        if (dist < 2.2) {
          const pull = 14 * dt / Math.max(dist, 0.3);
          d.vx += px * pull; d.vy += py * pull; d.vz += pz * pull;
        }
        if (dist < 0.85) {
          const leftover = inv.add(d.id, d.n);
          if (leftover < d.n) {
            picked.push(d.id);
            if (leftover === 0) { this._remove(i); continue; }
            d.n = leftover;
          }
        }
      }
      if (d.age > 240 || d.y < -12) { this._remove(i); continue; }

      d.mesh.position.set(d.x, d.y + 0.18 + Math.sin(d.age * 2.4) * 0.06, d.z);
      d.mesh.rotation.y = d.age * 1.6;
      const l = this.world.lightAt(Math.floor(d.x), Math.floor(d.y + 0.4), Math.floor(d.z));
      const f = Math.max(((l >> 4) & 15) * dayFactor, l & 15) / 15;
      const k = 0.25 + 0.75 * f;
      d.mesh.material.color.setScalar(k * k); // squared ≈ undo sRGB encode, matches chunk shader
    }
    return picked;
  }

  _remove(i) {
    const d = this.list[i];
    this.scene.remove(d.mesh);
    d.mesh.material.dispose();
    this.list.splice(i, 1);
  }

  clear() { while (this.list.length) this._remove(this.list.length - 1); }
}

export class Particles {
  constructor(scene, max = 800) {
    this.max = max;
    this.pos = new Float32Array(max * 3);
    this.col = new Float32Array(max * 3);
    this.vel = new Float32Array(max * 3);
    this.life = new Float32Array(max);
    this.n = 0;
    this.geo = new THREE.BufferGeometry();
    this.geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    this.geo.setAttribute('color', new THREE.BufferAttribute(this.col, 3));
    this.mat = new THREE.PointsMaterial({ size: 0.14, vertexColors: true, sizeAttenuation: true });
    this.points = new THREE.Points(this.geo, this.mat);
    this.points.frustumCulled = false;
    scene.add(this.points);
  }

  burst(x, y, z, rgb, n = 20, spread = 2.6) {
    for (let i = 0; i < n && this.n < this.max; i++) {
      const j = this.n++;
      this.pos[j * 3] = x + (Math.random() - 0.5) * 0.6;
      this.pos[j * 3 + 1] = y + (Math.random() - 0.5) * 0.6;
      this.pos[j * 3 + 2] = z + (Math.random() - 0.5) * 0.6;
      this.vel[j * 3] = (Math.random() - 0.5) * spread;
      this.vel[j * 3 + 1] = Math.random() * spread * 0.9 + 0.6;
      this.vel[j * 3 + 2] = (Math.random() - 0.5) * spread;
      const f = 0.75 + Math.random() * 0.45;
      this.col[j * 3] = rgb[0] * f; this.col[j * 3 + 1] = rgb[1] * f; this.col[j * 3 + 2] = rgb[2] * f;
      this.life[j] = 0.45 + Math.random() * 0.35;
    }
  }

  blockBurst(id, x, y, z, n = 22) { this.burst(x + 0.5, y + 0.5, z + 0.5, avgColor(id), n); }

  update(dt) {
    for (let i = this.n - 1; i >= 0; i--) {
      this.life[i] -= dt;
      if (this.life[i] <= 0) { // swap-remove
        const last = --this.n;
        for (let k = 0; k < 3; k++) {
          this.pos[i * 3 + k] = this.pos[last * 3 + k];
          this.vel[i * 3 + k] = this.vel[last * 3 + k];
          this.col[i * 3 + k] = this.col[last * 3 + k];
        }
        this.life[i] = this.life[last];
        continue;
      }
      this.vel[i * 3 + 1] -= 9 * dt;
      this.pos[i * 3] += this.vel[i * 3] * dt;
      this.pos[i * 3 + 1] += this.vel[i * 3 + 1] * dt;
      this.pos[i * 3 + 2] += this.vel[i * 3 + 2] * dt;
    }
    this.geo.setDrawRange(0, this.n);
    this.geo.attributes.position.needsUpdate = true;
    this.geo.attributes.color.needsUpdate = true;
  }
}
