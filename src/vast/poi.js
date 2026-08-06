// Points of interest + named regions, laid out deterministically on the
// infinite plane. Pure logic (positions, types, names); the 3D structures
// themselves are built in structures.js. One POI candidate per grid cell,
// validated against the terrain so towers don't spawn in the surf.

import { hashU32, hash2, mulberry32 } from './noise.js';
import { poiName, regionName } from './names.js';
import { SEA_LEVEL } from './world.js';

export const CELL = 560;      // one POI candidate per 560m cell
export const REGION = 2240;   // named region size (4x4 cells)
export const DISCOVER_R = 46; // walk this close → discovered
export const CLEAR_R = 26;    // flora keeps out of this radius

// type → [weight, needsFlat]. Weights re-rolled per cell.
const TYPES = [
  ['shrine', 14, true],
  ['ruin', 18, false],
  ['camp', 16, true],
  ['stones', 12, false],
  ['tower', 12, false],
  ['village', 14, true],
  ['obelisk', 14, false],
];
const TOTAL_W = TYPES.reduce((s, t) => s + t[1], 0);

export class POIField {
  constructor(world) {
    this.world = world;
    this.seed = hashU32(world.seed ^ 0x9015);
    this.cache = new Map();   // cellKey → poi | null
    this.regionCache = new Map();
  }

  poiForCell(cx, cz) {
    const key = cx + ',' + cz;
    if (this.cache.has(key)) return this.cache.get(key);
    const poi = this._makePoi(cx, cz);
    this.cache.set(key, poi);
    if (this.cache.size > 4000) this.cache.clear(); // unbounded-walk guard
    return poi;
  }

  _makePoi(cx, cz) {
    const h32 = hash2(this.world.seed ^ 0xa11ce, cx, cz);
    if (h32 > 0.62) return null; // 62% of cells hold something
    const rng = mulberry32(hashU32((cx * 73856093) ^ (cz * 19349663) ^ this.world.seed));

    // roll type
    let roll = rng() * TOTAL_W, type = 'ruin', needsFlat = false;
    for (const [t, w, flat] of TYPES) {
      roll -= w;
      if (roll <= 0) { type = t; needsFlat = flat; break; }
    }

    // find a valid footing: jittered tries inside the cell
    for (let attempt = 0; attempt < 5; attempt++) {
      const x = (cx + 0.2 + rng() * 0.6) * CELL;
      const z = (cz + 0.2 + rng() * 0.6) * CELL;
      const h = this.world.heightAt(x, z);
      if (h < SEA_LEVEL + 1.2 || h > 78) continue;
      const slope = this.world.slopeAt(x, z, 4);
      if (slope > (needsFlat ? 0.22 : 0.45)) continue;
      const id = 'poi_' + cx + '_' + cz;
      return {
        id, type, x, z, y: h,
        name: poiName(hashU32((cx * 2654435761) ^ cz ^ this.world.seed), type),
        hasRelic: (type === 'ruin' || type === 'stones' || type === 'obelisk') && rng() < 0.85,
        variant: rng(),
      };
    }
    return null;
  }

  // All POIs whose cells intersect a circle around (x,z).
  poisNear(x, z, r) {
    const out = [];
    const c0x = Math.floor((x - r) / CELL), c1x = Math.floor((x + r) / CELL);
    const c0z = Math.floor((z - r) / CELL), c1z = Math.floor((z + r) / CELL);
    for (let cz = c0z; cz <= c1z; cz++) {
      for (let cx = c0x; cx <= c1x; cx++) {
        const p = this.poiForCell(cx, cz);
        if (p && Math.hypot(p.x - x, p.z - z) <= r) out.push(p);
      }
    }
    return out;
  }

  regionAt(x, z) {
    const rx = Math.floor(x / REGION), rz = Math.floor(z / REGION);
    const key = rx + ',' + rz;
    let region = this.regionCache.get(key);
    if (!region) {
      // Name the region after its dominant LAND biome — a region whose exact
      // center is offshore shouldn't be called "Sea" if it's mostly peaks.
      const votes = {};
      for (const [fx, fz] of [[0.5, 0.5], [0.25, 0.25], [0.75, 0.25], [0.25, 0.75], [0.75, 0.75]]) {
        const b = this.world.biomeAt((rx + fx) * REGION, (rz + fz) * REGION);
        votes[b] = (votes[b] || 0) + 1;
      }
      let biome = 'ocean', best = -1;
      for (const [b, n] of Object.entries(votes)) {
        const score = n + (b === 'ocean' ? -2.5 : 0);
        if (score > best) { best = score; biome = b; }
      }
      region = {
        id: 'rgn_' + key,
        name: regionName(hashU32((rx * 40503) ^ (rz * 63689) ^ this.world.seed), biome),
        biome,
      };
      this.regionCache.set(key, region);
      if (this.regionCache.size > 600) this.regionCache.clear();
    }
    return region;
  }
}
