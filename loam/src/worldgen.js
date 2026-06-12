// The generator: one seed in, infinite world out. Continents and mountain
// ridges from layered simplex, biomes from a climate map, caves from the
// intersection of two 3D noise fields, ore veins by random walk. Pure — the
// same (seed, chunk) always produces the same bytes.
import { Noise2, Noise3, rng, hash3, clamp, smoothstep } from './util.js';
import { B } from './blocks.js';

export const CH = 16;        // chunk footprint
export const WORLD_H = 96;   // build height
export const SEA = 40;       // sea level

export const idx = (x, y, z) => x + (z << 4) + (y << 8);

export class WorldGen {
  constructor(seed) {
    this.seed = seed >>> 0;
    this.contN = new Noise2(this.seed ^ 0xA53A53);
    this.mtnN = new Noise2(this.seed ^ 0x1B21B2);
    this.roughN = new Noise2(this.seed ^ 0x5D65D6);
    this.tempN = new Noise2(this.seed ^ 0x7C47C4);
    this.moistN = new Noise2(this.seed ^ 0x3E83E8);
    this.caveA = new Noise3(this.seed ^ 0x991991);
    this.caveB = new Noise3(this.seed ^ 0x447447);
    this.cavernN = new Noise3(this.seed ^ 0x6F26F2);
  }

  heightAt(x, z) {
    const cont = this.contN.fbm(x / 230, z / 230, 4);
    const rough = this.roughN.fbm(x / 46, z / 46, 3) * 3.5;
    const ridge = this.mtnN.ridge(x / 170, z / 170, 4);          // ~0..1
    const mtn = smoothstep(0.62, 0.92, ridge) * (0.5 + cont * 0.5);
    const h = SEA - 5 + cont * 15 + rough + mtn * 36;
    return clamp(Math.round(h), 4, WORLD_H - 10);
  }

  biomeAt(x, z, h = this.heightAt(x, z)) {
    if (h < SEA - 1) return 'ocean';
    const temp = this.tempN.fbm(x / 340, z / 340, 3) - Math.max(0, h - SEA - 14) * 0.02;
    const moist = this.moistN.fbm(x / 290 + 100, z / 290 - 100, 3);
    if (h > 68) return h > 74 || temp < 0 ? 'peaks' : 'mountain';
    if (temp < -0.28) return 'snow';
    if (temp > 0.26 && moist < 0) return 'desert';
    if (moist > 0.1) return 'forest';
    return 'plains';
  }

  carved(x, y, z, h) {
    if (y <= 2 || y >= h) return false;
    if (h <= SEA + 1 && y > h - 6) return false; // keep ocean/beach floors sealed
    const a = this.caveA.fbm(x / 26, y / 17, z / 26, 3);
    const b = this.caveB.fbm(x / 26, y / 17, z / 26, 3);
    if (a > 0.26 && b > 0.26) return true;       // winding tunnels
    if (y < 28 && this.cavernN.fbm(x / 40, y / 22, z / 40, 3) > 0.46) return true;
    return false;
  }

  genChunk(cx, cz) {
    const blocks = new Uint8Array(CH * CH * WORLD_H);
    const heights = new Int16Array(CH * CH);
    const x0 = cx * CH, z0 = cz * CH;

    for (let z = 0; z < CH; z++) {
      for (let x = 0; x < CH; x++) {
        const wx = x0 + x, wz = z0 + z;
        const h = this.heightAt(wx, wz);
        heights[x + z * CH] = h;
        const biome = this.biomeAt(wx, wz, h);
        const sandy = biome === 'desert' || h <= SEA + 1;

        for (let y = 0; y <= h; y++) {
          let b = B.stone;
          if (y === 0) b = B.bedrock;
          else if (y === 1 && hash3(this.seed, wx, wz, 9) < 0.7) b = B.bedrock;
          else if (y > h - 4 && sandy) b = y === h && biome === 'ocean' && hash3(this.seed, wx, wz, 3) < 0.35 ? B.gravel : B.sand;
          else if (y > h - 4 && y < h) b = B.dirt;
          else if (y === h) {
            if (biome === 'peaks') b = B.snow;
            else if (biome === 'mountain') b = hash3(this.seed, wx, wz, 4) < 0.4 ? B.stone : B.grass;
            else if (biome === 'snow') b = B.snowyGrass;
            else if (biome === 'ocean') b = B.gravel;
            else b = B.grass;
          }
          if (b !== B.bedrock && this.carved(wx, y, wz, h)) {
            b = y <= 8 ? B.lava : B.air;
          }
          blocks[idx(x, y, z)] = b;
        }
        // mountains read as rock under the turf
        if ((biome === 'mountain' || biome === 'peaks') && blocks[idx(x, h - 1, z)] === B.dirt) {
          for (let y = h - 3; y < h; y++) if (blocks[idx(x, y, z)] === B.dirt) blocks[idx(x, y, z)] = B.stone;
        }
        if (biome === 'desert') { // sandstone shelf so dunes don't sit on bare stone
          for (let y = h - 6; y <= h - 4; y++) if (y > 2 && blocks[idx(x, y, z)] === B.stone) blocks[idx(x, y, z)] = B.sandstone;
        }
        // water up to sea level, iced over in the cold
        for (let y = h + 1; y <= SEA; y++) {
          blocks[idx(x, y, z)] = y === SEA && biome === 'snow' ? B.ice : B.water;
        }
      }
    }

    this.placeOres(blocks, cx, cz);
    this.decorateInto(blocks, cx, cz);
    return blocks;
  }

  placeOres(blocks, cx, cz) {
    const r = rng(hash3(this.seed, cx, cz, 77) * 0xffffffff);
    const vein = (ore, yMin, yMax, size) => {
      let x = (r() * CH) | 0, z = (r() * CH) | 0;
      let y = yMin + ((r() * (yMax - yMin)) | 0);
      for (let i = 0; i < size; i++) {
        if (y > 1 && y < WORLD_H && blocks[idx(x, y, z)] === B.stone) blocks[idx(x, y, z)] = ore;
        x = clamp(x + ((r() * 3) | 0) - 1, 0, CH - 1);
        z = clamp(z + ((r() * 3) | 0) - 1, 0, CH - 1);
        y = clamp(y + ((r() * 3) | 0) - 1, 2, WORLD_H - 2);
      }
    };
    for (let i = 0; i < 16; i++) vein(B.coalOre, 8, 70, 5 + ((r() * 6) | 0));
    for (let i = 0; i < 9; i++) vein(B.ironOre, 4, 46, 4 + ((r() * 4) | 0));
    for (let i = 0; i < 3; i++) vein(B.goldOre, 3, 26, 3 + ((r() * 3) | 0));
    for (let i = 0; i < 2; i++) vein(B.diamondOre, 2, 14, 2 + ((r() * 3) | 0));
    for (let i = 0; i < 6; i++) vein(B.gravel, 10, 60, 6 + ((r() * 6) | 0));
  }

  // Trees can lean over chunk borders, so a chunk takes decoration writes
  // from itself and all eight neighbours — each runs its own deterministic
  // plan and we only keep the blocks that land inside this chunk.
  decorateInto(blocks, cx, cz) {
    const x0 = cx * CH, z0 = cz * CH;
    const put = (wx, wy, wz, id, soft = false) => {
      const x = wx - x0, z = wz - z0;
      if (x < 0 || x >= CH || z < 0 || z >= CH || wy < 1 || wy >= WORLD_H) return;
      const i = idx(x, wy, z);
      if (soft && blocks[i] !== B.air) return;
      if (!soft && blocks[i] !== B.air && blocks[i] !== B.leaves && blocks[i] !== B.spruceLeaves) return;
      blocks[i] = id;
    };
    for (let dz = -1; dz <= 1; dz++) {
      for (let dx = -1; dx <= 1; dx++) this.planDecorations(cx + dx, cz + dz, put);
    }
  }

  planDecorations(cx, cz, put) {
    const r = rng(hash3(this.seed, cx, cz, 31) * 0xffffffff);
    const x0 = cx * CH, z0 = cz * CH;
    const pick = () => [x0 + ((r() * CH) | 0), z0 + ((r() * CH) | 0)];
    // biome sampled at chunk centre decides the planting plan
    const biome = this.biomeAt(x0 + 8, z0 + 8);
    const trees = { forest: 7, plains: 1, snow: 3, mountain: 1 }[biome] || 0;

    for (let i = 0; i < trees + (r() < 0.5 ? 1 : 0); i++) {
      const [wx, wz] = pick();
      const h = this.heightAt(wx, wz);
      const ground = this.biomeAt(wx, wz, h);
      if (h <= SEA + 1 || ground === 'desert' || ground === 'peaks' || ground === 'ocean') continue;
      if (this.carved(wx, h, wz, h + 2)) continue; // no trees over cave mouths
      if (ground === 'snow' || ground === 'mountain') this.spruce(put, wx, h, wz, r);
      else this.oak(put, wx, h, wz, r);
    }
    if (biome === 'desert') {
      for (let i = 0; i < 3; i++) {
        const [wx, wz] = pick();
        const h = this.heightAt(wx, wz);
        if (this.biomeAt(wx, wz, h) !== 'desert' || h <= SEA + 1) continue;
        const tall = 1 + ((r() * 3) | 0);
        for (let y = 1; y <= tall; y++) put(wx, h + y, wz, B.cactus, true);
      }
    }
    if (biome === 'plains' || biome === 'forest') {
      const n = biome === 'plains' ? 14 : 8;
      for (let i = 0; i < n; i++) {
        const [wx, wz] = pick();
        const h = this.heightAt(wx, wz);
        if (h <= SEA + 1 || this.biomeAt(wx, wz, h) !== biome) continue;
        const roll = r();
        put(wx, h + 1, wz, roll < 0.72 ? B.tallgrass : roll < 0.88 ? B.dandelion : B.poppy, true);
      }
    }
  }

  oak(put, x, y, z, r) {
    const trunk = 4 + ((r() * 2) | 0);
    for (let i = 1; i <= trunk; i++) put(x, y + i, z, B.log);
    const top = y + trunk;
    for (let dy = -2; dy <= 2; dy++) {
      const rad = dy < 0 ? 2 : dy < 2 ? 2 - dy : 0;
      for (let dx = -rad; dx <= rad; dx++) {
        for (let dz = -rad; dz <= rad; dz++) {
          if (Math.abs(dx) === rad && Math.abs(dz) === rad && r() < 0.5) continue;
          if (dx === 0 && dz === 0 && dy < 1) continue;
          put(x + dx, top + dy + 1, z + dz, B.leaves, true);
        }
      }
    }
  }

  spruce(put, x, y, z, r) {
    const trunk = 5 + ((r() * 3) | 0);
    for (let i = 1; i <= trunk; i++) put(x, y + i, z, B.spruceLog);
    for (let layer = 0; layer < trunk - 1; layer++) {
      const ly = y + trunk - layer;
      const rad = layer === 0 ? 0 : 1 + ((layer / 2) | 0);
      for (let dx = -rad; dx <= rad; dx++) {
        for (let dz = -rad; dz <= rad; dz++) {
          if (Math.abs(dx) === rad && Math.abs(dz) === rad && rad > 1) continue;
          if (dx === 0 && dz === 0 && layer > 0) continue;
          put(x + dx, ly, z + dz, B.spruceLeaves, true);
        }
      }
    }
    put(x, y + trunk + 1, z, B.spruceLeaves, true);
  }

  // first comfortable spot near the origin: dry land, no cliff edge
  findSpawn() {
    for (let ring = 0; ring < 40; ring++) {
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2 + ring;
        const x = Math.round(Math.sin(a) * ring * 9), z = Math.round(Math.cos(a) * ring * 9);
        const h = this.heightAt(x, z);
        const biome = this.biomeAt(x, z, h);
        if (h > SEA + 1 && h < 64 && biome !== 'ocean' && !this.carved(x, h, z, h + 2)) {
          return { x: x + 0.5, y: h + 2, z: z + 0.5 };
        }
      }
    }
    return { x: 0.5, y: 70, z: 0.5 };
  }
}
