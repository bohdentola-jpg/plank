// terrain.js — the open world.
//
// The main map is one big continuous place. At the middle is the void: flat,
// blank white space with cardboard boxes, blaster stands and the ping pong
// table — the room every snaptic short happens in. Walk out of it in any
// direction and the world grows a landscape:
//
//        north      meadow → deep forest
//        east       dunes and cacti
//        south      the volcano, ash fields, lava
//        west       snowfield and pines
//        far out    the outer void — endless white with stray boxes
//
// Geography is deterministic from a seed, so every player in a lobby walks the
// same world without sending any of it over the network. Chunks mesh lazily on
// a budget and get thrown away behind you.

import * as THREE from '../vendor/three.module.js';
import { COLORS, clamp, lerp, smooth, hash2, shade } from './util.js';
import { voxelMaterial } from './voxel.js';

export const CHUNK = 48;           // world units per chunk edge
export const CELL = 3;             // world units per terrain quad
const CELLS = CHUNK / CELL;        // 16 quads per chunk edge

export const PLAZA_R = 72;         // flat blank void at the middle
const VOID_FADE = 46;              // blend distance out of the plaza
export const WORLD_R = 1500;       // past this it's the outer void forever

// the volcano is a real landmark at a fixed spot
const VOLCANO = { x: 40, z: 560, r: 210, peak: 104, craterR: 52 };
const LAVA_R = 38;                 // the lake is smaller than the crater

export const BIOMES = {
  void: { ground: COLORS.white, accent: 0xf2f2f2, fog: 0xffffff, rough: 0 },
  meadow: { ground: COLORS.grass, accent: 0x93b076, fog: 0xeef2ea, rough: 1 },
  forest: { ground: 0x74905f, accent: COLORS.leaf, fog: 0xe6ece3, rough: 1.5 },
  desert: { ground: COLORS.sand, accent: 0xe2d6b2, fog: 0xf6f1e4, rough: 1.2 },
  snow: { ground: COLORS.snow, accent: COLORS.ice, fog: 0xf4f7fa, rough: 1.1 },
  volcano: { ground: 0x7a6f6a, accent: COLORS.lava, fog: 0xe8dedb, rough: 2.4 },
  ash: { ground: COLORS.ash, accent: 0x585552, fog: 0xe4e1de, rough: 1.4 },
  outer: { ground: COLORS.white, accent: 0xf4f4f4, fog: 0xffffff, rough: 0 },
};

// ---------------------------------------------------------------- noise
function vnoise(x, y, seed) {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = x - xi, yf = y - yi;
  const a = hash2(xi, yi, seed), b = hash2(xi + 1, yi, seed);
  const c = hash2(xi, yi + 1, seed), d = hash2(xi + 1, yi + 1, seed);
  const u = smooth(xf), v = smooth(yf);
  return lerp(lerp(a, b, u), lerp(c, d, u), v);
}

function fbm(x, y, seed, octaves = 4, freq = 1, gain = 0.5) {
  let sum = 0, amp = 1, norm = 0;
  for (let i = 0; i < octaves; i++) {
    sum += vnoise(x * freq, y * freq, seed + i * 101) * amp;
    norm += amp;
    amp *= gain;
    freq *= 2;
  }
  return sum / norm;
}

// ---------------------------------------------------------------- geography
export class World {
  constructor(seed = 1337) {
    this.seed = seed | 0;
    this._h = new Map();     // height cache keyed by "gx,gz" on the CELL grid
  }

  // 0 in the plaza, 1 fully outside it
  outness(x, z) {
    const r = Math.hypot(x, z);
    return clamp((r - PLAZA_R) / VOID_FADE, 0, 1);
  }

  // how far into the outer void (0 inside the designed world, 1 fully outside)
  outerness(x, z) {
    const r = Math.hypot(x, z);
    return clamp((r - WORLD_R) / 260, 0, 1);
  }

  volcanoField(x, z) {
    const d = Math.hypot(x - VOLCANO.x, z - VOLCANO.z);
    return { d, t: clamp(1 - d / VOLCANO.r, 0, 1) };
  }

  // which biome rules this spot
  biomeAt(x, z) {
    if (this.outerness(x, z) > 0.55) return 'outer';
    if (this.outness(x, z) < 0.18) return 'void';
    const { t } = this.volcanoField(x, z);
    if (t > 0.06) return 'volcano';

    // warped angular layout: each direction has its own land, borders wiggle
    const warp = (fbm(x * 0.0018, z * 0.0018, this.seed + 7, 3) - 0.5) * 1.7;
    const ang = Math.atan2(z, x) + warp * 0.6;
    const deg = ((ang * 180 / Math.PI) + 360) % 360;
    const r = Math.hypot(x, z);
    const patch = fbm(x * 0.004, z * 0.004, this.seed + 21, 3);

    // 0° = east, 90° = south (+z), 180° = west, 270° = north (−z)
    if (deg >= 40 && deg < 140) return 'ash';   // south: ash flats up to the cone
    if (deg >= 140 && deg < 230) return 'snow';               // west
    if (deg >= 230 && deg < 320) {
      // north: meadow near the plaza, forest deeper out
      const forestness = clamp((r - 190) / 420, 0, 1) + (patch - 0.5) * 0.7;
      return forestness > 0.42 ? 'forest' : 'meadow';
    }
    return 'desert';   // east
  }

  // terrain height at any point (world units)
  heightAt(x, z) {
    const gx = Math.round(x / CELL), gz = Math.round(z / CELL);
    const key = gx + ',' + gz;
    const hit = this._h.get(key);
    if (hit !== undefined) return hit;
    const h = this._height(gx * CELL, gz * CELL);
    if (this._h.size > 200000) this._h.clear();
    this._h.set(key, h);
    return h;
  }

  _height(x, z) {
    const out = this.outness(x, z);
    if (out <= 0) return 0;
    const outer = this.outerness(x, z);

    // rolling base terrain
    const base = (fbm(x * 0.0026, z * 0.0026, this.seed, 4) - 0.5) * 34;
    const detail = (fbm(x * 0.012, z * 0.012, this.seed + 3, 3) - 0.5) * 6;
    const ridges = Math.pow(1 - Math.abs(fbm(x * 0.0055, z * 0.0055, this.seed + 11, 2) * 2 - 1), 2) * 16;

    const b = this.biomeAt(x, z);
    let h = base + detail * (BIOMES[b] ? BIOMES[b].rough : 1);
    if (b === 'forest') h += ridges * 0.5;
    if (b === 'snow') h += ridges * 0.8;
    if (b === 'desert') h += Math.sin(x * 0.02 + fbm(x * 0.003, z * 0.003, this.seed + 5, 2) * 9) * 5;
    if (b === 'ash') h = h * 0.5 - 2;

    // the volcano cone with a crater
    const { d, t } = this.volcanoField(x, z);
    if (t > 0) {
      const cone = Math.pow(t, 1.6) * VOLCANO.peak;
      let vh = cone;
      if (d < VOLCANO.craterR) {
        const ct = 1 - d / VOLCANO.craterR;
        vh -= Math.pow(ct, 1.15) * 74;    // scoop the crater below the lava line
      }
      h = lerp(h, Math.max(h, vh), clamp(t * 2.2, 0, 1));
    }

    h *= out;                       // flatten into the plaza
    h *= (1 - outer);               // and flatten again far out
    return h;
  }

  // the surface of the lava lake sitting in the crater
  lavaLevel() { return VOLCANO.peak - 56; }
  volcanoCenter() { return { x: VOLCANO.x, z: VOLCANO.z }; }

  isLava(x, y, z) {
    const { d } = this.volcanoField(x, z);
    return d < LAVA_R && y <= this.lavaLevel() + 0.5;
  }

  groundColor(x, z) {
    const b = this.biomeAt(x, z);
    const info = BIOMES[b] || BIOMES.void;
    let c = info.ground;
    // dapple so big flat areas don't look dead
    const n = fbm(x * 0.06, z * 0.06, this.seed + 31, 2);
    c = shade(c, Math.round((n - 0.5) * 26));
    const { d } = this.volcanoField(x, z);
    if (b === 'volcano' && d < LAVA_R + 16) {
      // just the shoreline catches the light off the lake
      const glow = clamp(1 - Math.abs(d - LAVA_R) / 16, 0, 1);
      c = mix(shade(c, -26), COLORS.lava, glow * 0.5);
    }
    if (b === 'void' || b === 'outer') c = shade(COLORS.white, Math.round((n - 0.5) * 10));
    return c;
  }
}

function mix(a, b, t) {
  const ar = (a >> 16) & 255, ag = (a >> 8) & 255, ab = a & 255;
  const br = (b >> 16) & 255, bg = (b >> 8) & 255, bb = b & 255;
  return (Math.round(lerp(ar, br, t)) << 16) | (Math.round(lerp(ag, bg, t)) << 8) | Math.round(lerp(ab, bb, t));
}

// ---------------------------------------------------------------- props
// Scatter is deterministic per chunk: same seed, same trees, for everyone.
const PROP_KINDS = {
  meadow: [['flower', 10], ['rock', 2], ['tree', 1.2], ['grasstuft', 8]],
  forest: [['tree', 9], ['pine', 2], ['rock', 2], ['grasstuft', 3], ['flower', 1], ['mushroom', 1.5]],
  desert: [['cactus', 3], ['rock', 3], ['deadbush', 2]],
  snow: [['pine', 5], ['snowrock', 3], ['iceshard', 2]],
  volcano: [['obsidian', 3], ['rock', 2], ['vent', 1]],
  ash: [['deadtree', 2], ['ashrock', 3], ['vent', 0.6]],
  void: [],
  outer: [['strayboxes', 0.5]],
};

// Each prop is a little box list: [x, y, z, w, h, d, color] in local units.
function propBoxes(kind, r1, r2) {
  const B = [];
  const push = (x, y, z, w, h, d, c) => B.push([x, y, z, w, h, d, c]);
  switch (kind) {
    case 'tree': {
      const th = 5 + r1 * 5;
      push(0, th / 2, 0, 0.9, th, 0.9, COLORS.brown);
      const cr = 2.4 + r2 * 1.6;
      push(0, th + cr * 0.35, 0, cr * 2, cr * 1.3, cr * 2, COLORS.leaf);
      push(0, th + cr * 1.05, 0, cr * 1.2, cr * 0.8, cr * 1.2, shade(COLORS.leaf, 12));
      break;
    }
    case 'pine': {
      const th = 6 + r1 * 6;
      push(0, th / 2, 0, 0.8, th, 0.8, shade(COLORS.brown, -18));
      for (let i = 0; i < 3; i++) {
        const s = 3.4 - i * 0.9;
        push(0, th * 0.5 + i * th * 0.24, 0, s, th * 0.3, s, shade(COLORS.leaf, -14 + i * 8));
      }
      break;
    }
    case 'deadtree': {
      const th = 4 + r1 * 4;
      push(0, th / 2, 0, 0.7, th, 0.7, shade(COLORS.ash, 18));
      push(1, th * 0.8, 0, 2, 0.5, 0.5, shade(COLORS.ash, 10));
      push(-0.8, th * 0.6, 0.4, 1.6, 0.45, 0.45, shade(COLORS.ash, 10));
      break;
    }
    case 'cactus': {
      const th = 2.6 + r1 * 3.4;
      push(0, th / 2, 0, 1.1, th, 1.1, 0x6f8f63);
      if (r2 > 0.45) { push(1.1, th * 0.62, 0, 1.2, 0.8, 0.8, 0x6f8f63); push(1.6, th * 0.8, 0, 0.8, 1.4, 0.8, 0x6f8f63); }
      break;
    }
    case 'flower': {
      const c = [COLORS.red, COLORS.yellow, COLORS.pink, COLORS.purple, COLORS.white][Math.floor(r2 * 5) % 5];
      push(0, 0.35, 0, 0.14, 0.7, 0.14, 0x7fa068);
      push(0, 0.78, 0, 0.42, 0.3, 0.42, c);
      break;
    }
    case 'grasstuft': {
      push(0, 0.28, 0, 0.5, 0.55, 0.5, shade(COLORS.grass, -16));
      push(0.3, 0.2, 0.2, 0.35, 0.4, 0.35, shade(COLORS.grass, -6));
      break;
    }
    case 'rock': {
      const s = 0.8 + r1 * 1.8;
      push(0, s * 0.4, 0, s, s * 0.8, s * 0.9, COLORS.stone);
      push(s * 0.35, s * 0.2, s * 0.2, s * 0.6, s * 0.4, s * 0.5, shade(COLORS.stone, -14));
      break;
    }
    case 'snowrock': {
      const s = 0.9 + r1 * 1.6;
      push(0, s * 0.4, 0, s, s * 0.8, s, shade(COLORS.stone, -6));
      push(0, s * 0.85, 0, s * 1.05, s * 0.22, s * 1.05, COLORS.snow);
      break;
    }
    case 'ashrock': {
      const s = 0.8 + r1 * 1.4;
      push(0, s * 0.35, 0, s, s * 0.7, s, shade(COLORS.ash, -10));
      break;
    }
    case 'obsidian': {
      const s = 1 + r1 * 2.2;
      push(0, s * 0.6, 0, s * 0.7, s * 1.2, s * 0.7, 0x565059);
      push(0, s * 1.15, 0, s * 0.4, s * 0.3, s * 0.4, 0x6b636e);
      break;
    }
    case 'iceshard': {
      const s = 1.4 + r1 * 2.6;
      push(0, s * 0.55, 0, 0.7, s, 0.7, COLORS.ice);
      break;
    }
    case 'mushroom': {
      push(0, 0.35, 0, 0.22, 0.7, 0.22, 0xe0d8c8);
      push(0, 0.75, 0, 0.85, 0.35, 0.85, 0xc4685c);
      push(0, 0.95, 0, 0.55, 0.14, 0.55, 0xd88a80);
      break;
    }
    case 'deadbush': {
      push(0, 0.5, 0, 1.1, 0.9, 1.1, 0xa89877);
      break;
    }
    case 'vent': {
      push(0, 0.35, 0, 1.8, 0.6, 1.8, shade(COLORS.ash, -22));
      push(0, 0.75, 0, 1, 0.3, 1, COLORS.lava);
      break;
    }
    case 'strayboxes': {
      const n = 1 + Math.floor(r1 * 3);
      for (let i = 0; i < n; i++) {
        const s = 1.4;
        push((i - n / 2) * 1.7, s / 2 + i * 0.05, (r2 - 0.5) * 3, s, s, s, COLORS.cardboard);
      }
      break;
    }
  }
  return B;
}

// ---------------------------------------------------------------- chunks
export class TerrainStreamer {
  constructor(world, scene, opts = {}) {
    this.world = world;
    this.scene = scene;
    this.radius = opts.radius || 7;              // chunks in each direction
    this.chunks = new Map();                      // "cx,cz" → {mesh, props}
    this.queue = [];
    this.budgetPerFrame = opts.budget || 2;
    this.mat = voxelMaterial();
    this.group = new THREE.Group();
    this.group.name = 'terrain';
    scene.add(this.group);
    this.lava = null;
    this.buildLava();
  }

  buildLava() {
    const w = this.world;
    const c = w.volcanoCenter();
    const geo = new THREE.CircleGeometry(LAVA_R, 24);
    geo.rotateX(-Math.PI / 2);
    const mat = new THREE.MeshBasicMaterial({ color: COLORS.lava });
    this.lava = new THREE.Mesh(geo, mat);
    this.lava.position.set(c.x, w.lavaLevel(), c.z);
    this.group.add(this.lava);
  }

  keyOf(cx, cz) { return cx + ',' + cz; }

  // Ask for the chunks around a world position; queue what's missing, drop the rest.
  update(px, pz, dt) {
    const ccx = Math.floor(px / CHUNK), ccz = Math.floor(pz / CHUNK);
    const R = this.radius;
    const want = new Set();
    for (let dz = -R; dz <= R; dz++) {
      for (let dx = -R; dx <= R; dx++) {
        if (dx * dx + dz * dz > (R + 0.4) * (R + 0.4)) continue;
        const cx = ccx + dx, cz = ccz + dz;
        const key = this.keyOf(cx, cz);
        want.add(key);
        if (!this.chunks.has(key) && !this.queued(key)) {
          this.queue.push({ key, cx, cz, d: dx * dx + dz * dz });
        }
      }
    }
    // nearest first
    this.queue.sort((a, b) => a.d - b.d);
    let made = 0;
    while (this.queue.length && made < this.budgetPerFrame) {
      const job = this.queue.shift();
      if (!want.has(job.key)) continue;
      this.build(job.cx, job.cz);
      made++;
    }
    for (const [key, ch] of this.chunks) {
      if (want.has(key)) continue;
      this.group.remove(ch.mesh);
      ch.mesh.geometry.dispose();
      if (ch.props) { this.group.remove(ch.props); ch.props.geometry.dispose(); }
      this.chunks.delete(key);
    }
  }

  queued(key) { return this.queue.some(j => j.key === key); }

  // instantly generate everything around a point (used before the first frame)
  prime(px, pz, radius = 3) {
    const ccx = Math.floor(px / CHUNK), ccz = Math.floor(pz / CHUNK);
    for (let dz = -radius; dz <= radius; dz++) {
      for (let dx = -radius; dx <= radius; dx++) {
        const cx = ccx + dx, cz = ccz + dz;
        if (!this.chunks.has(this.keyOf(cx, cz))) this.build(cx, cz);
      }
    }
  }

  build(cx, cz) {
    const w = this.world;
    const x0 = cx * CHUNK, z0 = cz * CHUNK;
    const pos = [], nor = [], col = [];
    const _c = new THREE.Color();

    // one flat-shaded quad pair per cell, colored from the biome
    for (let j = 0; j < CELLS; j++) {
      for (let i = 0; i < CELLS; i++) {
        const ax = x0 + i * CELL, az = z0 + j * CELL;
        const bx = ax + CELL, bz = az + CELL;
        const h00 = w.heightAt(ax, az), h10 = w.heightAt(bx, az);
        const h01 = w.heightAt(ax, bz), h11 = w.heightAt(bx, bz);
        const c = w.groundColor(ax + CELL / 2, az + CELL / 2);
        _c.setHex(c);
        const v00 = [ax, h00, az], v10 = [bx, h10, az], v01 = [ax, h01, bz], v11 = [bx, h11, bz];
        for (const tri of [[v00, v01, v11], [v00, v11, v10]]) {
          const n = triNormal(tri[0], tri[1], tri[2]);
          for (const v of tri) {
            pos.push(v[0], v[1], v[2]);
            nor.push(n[0], n[1], n[2]);
            col.push(_c.r, _c.g, _c.b);
          }
        }
      }
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    geo.computeBoundingSphere();
    const mesh = new THREE.Mesh(geo, this.mat);
    mesh.frustumCulled = true;
    this.group.add(mesh);

    const props = this.buildProps(cx, cz);
    if (props) this.group.add(props);
    this.chunks.set(this.keyOf(cx, cz), { mesh, props });
  }

  buildProps(cx, cz) {
    const w = this.world;
    const x0 = cx * CHUNK, z0 = cz * CHUNK;
    const midB = w.biomeAt(x0 + CHUNK / 2, z0 + CHUNK / 2);
    const kinds = PROP_KINDS[midB] || [];
    if (!kinds.length) return null;

    const total = kinds.reduce((s, k) => s + k[1], 0);
    const tries = Math.round(total * 2.2);
    const pos = [], nor = [], col = [];
    const _c = new THREE.Color();
    let any = false;

    for (let t = 0; t < tries; t++) {
      const r0 = hash2(cx * 71 + t, cz * 131 + t * 7, w.seed + 900);
      const rx = hash2(cx * 17 + t * 3, cz * 29 + t, w.seed + 901);
      const rz = hash2(cx * 37 + t, cz * 53 + t * 5, w.seed + 902);
      const x = x0 + rx * CHUNK, z = z0 + rz * CHUNK;
      const b = w.biomeAt(x, z);
      if (b !== midB) continue;
      // pick a kind by weight
      let pickT = r0 * total, kind = null;
      for (const [k, weight] of kinds) { pickT -= weight; if (pickT <= 0) { kind = k; break; } }
      if (!kind) continue;
      // density: skip most tries so scatter feels natural
      if (hash2(cx * 91 + t, cz * 13 + t, w.seed + 903) > 0.55) continue;
      const y = w.heightAt(x, z);
      if (w.isLava(x, y, z)) continue;
      const slope = Math.abs(w.heightAt(x + CELL, z) - y) + Math.abs(w.heightAt(x, z + CELL) - y);
      if (slope > 6) continue;                      // nothing grows on cliffs
      const r1 = hash2(cx + t * 11, cz + t * 3, w.seed + 904);
      const r2 = hash2(cx + t * 5, cz + t * 19, w.seed + 905);
      const yaw = r2 * Math.PI * 2;
      for (const [bx, by, bz, bw, bh, bd, bc] of propBoxes(kind, r1, r2)) {
        const s = Math.sin(yaw), co = Math.cos(yaw);
        const wx = x + bx * co - bz * s;
        const wz = z + bx * s + bz * co;
        _c.setHex(bc);
        pushBox(pos, nor, col, _c, wx, y + by, wz, bw, bh, bd, yaw);
        any = true;
      }
    }
    if (!any) return null;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    geo.computeBoundingSphere();
    return new THREE.Mesh(geo, this.mat);
  }

  // props are decoration, but the tall ones should block you
  solidPropsNear() { return []; }

  dispose() {
    for (const [, ch] of this.chunks) {
      this.group.remove(ch.mesh);
      ch.mesh.geometry.dispose();
      if (ch.props) { this.group.remove(ch.props); ch.props.geometry.dispose(); }
    }
    this.chunks.clear();
    this.queue.length = 0;
    if (this.lava) { this.lava.geometry.dispose(); this.lava.material.dispose(); }
    this.scene.remove(this.group);
  }
}

function triNormal(a, b, c) {
  const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
  const vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
  let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
  const len = Math.hypot(nx, ny, nz) || 1;
  return [nx / len, ny / len, nz / len];
}

// counter-clockwise from outside, same rule as the voxel mesher
const CUBE_FACES = [
  { n: [0, 1, 0], v: [[-1, 1, -1], [-1, 1, 1], [1, 1, 1], [1, 1, -1]], s: 14 },
  { n: [0, -1, 0], v: [[-1, -1, -1], [1, -1, -1], [1, -1, 1], [-1, -1, 1]], s: -28 },
  { n: [0, 0, 1], v: [[-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1]], s: -4 },
  { n: [0, 0, -1], v: [[-1, -1, -1], [-1, 1, -1], [1, 1, -1], [1, -1, -1]], s: -18 },
  { n: [1, 0, 0], v: [[1, -1, -1], [1, 1, -1], [1, 1, 1], [1, -1, 1]], s: -8 },
  { n: [-1, 0, 0], v: [[-1, -1, -1], [-1, -1, 1], [-1, 1, 1], [-1, 1, -1]], s: -14 },
];

// append a yaw-rotated box (centred at cx,cy,cz) to raw arrays
export function pushBox(pos, nor, col, color, cx, cy, cz, w, h, d, yaw = 0) {
  const hx = w / 2, hy = h / 2, hz = d / 2;
  const s = Math.sin(yaw), co = Math.cos(yaw);
  const rot = (x, z) => [x * co - z * s, x * s + z * co];
  const r = color.r, g = color.g, b = color.b;
  for (const f of CUBE_FACES) {
    const sh = f.s / 255;
    const cr = clamp(r + sh, 0, 1), cg = clamp(g + sh, 0, 1), cb = clamp(b + sh, 0, 1);
    const [nx, nz] = rot(f.n[0], f.n[2]);
    const quad = f.v.map(v => {
      const [x, z] = rot(v[0] * hx, v[2] * hz);
      return [cx + x, cy + v[1] * hy, cz + z];
    });
    for (const [i, j, k] of [[0, 1, 2], [0, 2, 3]]) {
      for (const idx of [i, j, k]) {
        pos.push(quad[idx][0], quad[idx][1], quad[idx][2]);
        nor.push(nx, f.n[1], nz);
        col.push(cr, cg, cb);
      }
    }
  }
}
