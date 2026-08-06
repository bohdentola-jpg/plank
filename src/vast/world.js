// The world model: seed → elevation, climate, biome, ground color at any
// (x,z) in meters. Pure logic (no THREE, no DOM) so it runs in node smoke
// tests and stays the single source of truth for meshes AND physics — the
// player walks on heightAt(), the same function the chunk mesh sampled.

import { hashU32, fbm, ridged, noise2, clamp, lerp, sstep } from './noise.js';

export const SEA_LEVEL = 0; // water plane height (y)

// Biome table: ground feel + what grows there. Colors live in colorAt(),
// which blends continuously — these ids drive flora, fauna, names, footsteps.
export const BIOMES = {
  ocean:      { label: 'Sea',        step: 'water', flora: [] },
  beach:      { label: 'Coast',      step: 'sand',  flora: [['palm', 3], ['rock', 1], ['grass', 2]] },
  plains:     { label: 'Plains',     step: 'grass', flora: [['broadleaf', 2], ['grass', 30], ['flower', 6], ['rock', 1]] },
  meadow:     { label: 'Meadow',     step: 'grass', flora: [['broadleaf', 1], ['grass', 24], ['flower', 18]] },
  steppe:     { label: 'Steppe',     step: 'dirt',  flora: [['deadtree', 1], ['grass', 12], ['rock', 3], ['shrub', 4]] },
  forest:     { label: 'Forest',     step: 'grass', flora: [['broadleaf', 8], ['conifer', 4], ['grass', 14], ['shrub', 3], ['rock', 1], ['flower', 2]] },
  deepforest: { label: 'Deep Wood',  step: 'grass', flora: [['broadleaf', 10], ['conifer', 9], ['shrub', 5], ['grass', 8], ['rock', 2]] },
  savanna:    { label: 'Savanna',    step: 'dirt',  flora: [['acacia', 3], ['grass', 18], ['shrub', 3], ['rock', 1]] },
  desert:     { label: 'Desert',     step: 'sand',  flora: [['cactus', 4], ['deadtree', 1], ['rock', 3], ['shrub', 1]] },
  swamp:      { label: 'Fen',        step: 'mud',   flora: [['deadtree', 5], ['reed', 14], ['broadleaf', 2], ['rock', 1]] },
  tundra:     { label: 'Tundra',     step: 'snow',  flora: [['deadtree', 2], ['rock', 5], ['shrub', 4], ['grass', 4]] },
  snow:       { label: 'High Snows', step: 'snow',  flora: [['snowpine', 5], ['rock', 4]] },
  rock:       { label: 'Crags',      step: 'rock',  flora: [['rock', 6], ['conifer', 1], ['shrub', 1]] },
};

export class World {
  constructor(seed = 7) {
    this.seed = seed >>> 0;
    const s = (n) => hashU32(this.seed + n * 0x9e3779b9);
    this.sCont = s(1);   // continents
    this.sWarpX = s(2);  // domain warp
    this.sWarpY = s(3);
    this.sMask = s(4);   // mountain regions
    this.sRidge = s(5);  // mountain ridges
    this.sHill = s(6);   // rolling hills
    this.sDet = s(7);    // fine detail
    this.sTemp = s(8);   // temperature
    this.sMoist = s(9);  // moisture
    this.sVar = s(10);   // color / meadow variation
  }

  // ---- elevation -----------------------------------------------------------
  heightAt(x, z) {
    // Domain warp keeps coastlines and ranges from looking like graph paper.
    const wx = x + 190 * fbm(this.sWarpX, x / 800, z / 800, 3);
    const wz = z + 190 * fbm(this.sWarpY, x / 800, z / 800, 3);

    const c = fbm(this.sCont, wx / 1500, wz / 1500, 4);       // continents [-1,1]
    const coast = sstep(-0.32, 0.2, c);                        // 0 deep sea → 1 inland
    let h = lerp(-34, 4.5, coast);

    // Mountain ranges only where the mask says so, ridged for crests.
    const mask = sstep(0.1, 0.55, fbm(this.sMask, x / 2400, z / 2400, 3)) * sstep(0.02, 0.3, c);
    if (mask > 0.01) {
      const r = ridged(this.sRidge, wx / 640, wz / 640, 5);
      h += mask * Math.pow(r, 1.6) * 110;
    }

    // Rolling hills + fine detail, damped out at sea.
    h += fbm(this.sHill, x / 150, z / 150, 4) * 7 * (0.25 + 0.75 * coast);
    h += fbm(this.sDet, x / 27, z / 27, 3) * 1.5 * (0.3 + 0.7 * coast);
    return h;
  }

  // Terrain gradient magnitude (rise per meter), by central difference.
  slopeAt(x, z, e = 1.5) {
    const dx = this.heightAt(x + e, z) - this.heightAt(x - e, z);
    const dz = this.heightAt(x, z + e) - this.heightAt(x, z - e);
    return Math.hypot(dx, dz) / (2 * e);
  }

  // ---- climate -------------------------------------------------------------
  tempAt(x, z, h) {
    if (h === undefined) h = this.heightAt(x, z);
    let t = 0.5 + 0.5 * fbm(this.sTemp, x / 2600, z / 2600, 3);
    t -= Math.max(0, h) * 0.0048; // altitude lapse
    return clamp(t, 0, 1);
  }

  moistAt(x, z) {
    return clamp(0.5 + 0.5 * fbm(this.sMoist, x / 1900, z / 1900, 3), 0, 1);
  }

  snowLine(x, z) {
    return 52 + 18 * noise2(this.sVar, x / 900, z / 900);
  }

  isWater(x, z) {
    return this.heightAt(x, z) < SEA_LEVEL + 0.12;
  }

  // ---- biome ---------------------------------------------------------------
  biomeAt(x, z, h, slope) {
    if (h === undefined) h = this.heightAt(x, z);
    if (h < SEA_LEVEL + 0.12) return 'ocean';
    const t = this.tempAt(x, z, h);
    const m = this.moistAt(x, z);
    if (slope === undefined) slope = this.slopeAt(x, z);
    const snowLine = this.snowLine(x, z);

    if (h < 2.4 && slope < 0.45 && t > 0.28) return 'beach';
    if (h > snowLine) return 'snow';
    if (t < 0.24) return h > snowLine - 14 ? 'snow' : 'tundra';
    if (slope > 0.85 || (h > 40 && slope > 0.55)) return 'rock';
    if (t > 0.68 && m < 0.34) return 'desert';
    if (t > 0.6 && m < 0.5) return 'savanna';
    if (m > 0.74 && h < 9 && t > 0.45) return 'swamp';
    if (m > 0.62) return 'deepforest';
    if (m > 0.45) return 'forest';
    if (m < 0.3) return 'steppe';
    // Flower meadows pool in pockets of the plains.
    return noise2(this.sVar, x / 260, z / 260) > 0.45 ? 'meadow' : 'plains';
  }

  // ---- ground color --------------------------------------------------------
  // Continuous blend (no hard biome borders). Returns [r,g,b] in 0..1.
  colorAt(x, z, h, slope) {
    if (h === undefined) h = this.heightAt(x, z);
    if (slope === undefined) slope = this.slopeAt(x, z);
    const t = this.tempAt(x, z, h);
    const m = this.moistAt(x, z);
    const vr = noise2(this.sVar, x / 45, z / 45) * 0.5 + 0.5; // micro grain

    let r, g, b;
    if (h < SEA_LEVEL + 0.15) {
      // Seabed: sandy shallows → deep basalt.
      const d = sstep(0, 22, SEA_LEVEL - h);
      r = lerp(0.72, 0.1, d); g = lerp(0.66, 0.16, d); b = lerp(0.47, 0.2, d);
    } else {
      // Grass field: dry gold ↔ lush green by moisture, warmth shifts hue.
      const lush = clamp(m * 1.15 - Math.max(0, t - 0.72) * 0.6, 0, 1);
      r = lerp(0.62, 0.24, lush); g = lerp(0.58, 0.46, lush); b = lerp(0.33, 0.2, lush);
      // Desert sand takes over where hot + dry (fully, wherever the biome
      // classifier would already say "desert").
      const sand = sstep(0.64, 0.7, t) * sstep(0.38, 0.32, m);
      r = lerp(r, 0.82, sand); g = lerp(g, 0.7, sand); b = lerp(b, 0.46, sand);
      // Swamp mire.
      const mire = sstep(0.68, 0.8, m) * sstep(11, 5, h) * sstep(0.38, 0.5, t);
      r = lerp(r, 0.3, mire); g = lerp(g, 0.36, mire); b = lerp(b, 0.22, mire);
      // Beach ring.
      const beach = sstep(2.6, 1.2, h) * sstep(0.5, 0.3, slope) * sstep(0.24, 0.32, t);
      r = lerp(r, 0.76, beach); g = lerp(g, 0.7, beach); b = lerp(b, 0.5, beach);
      // Exposed rock on steep faces and high crags.
      const rock = Math.max(sstep(0.55, 1.0, slope), sstep(34, 52, h) * sstep(0.35, 0.6, slope));
      r = lerp(r, 0.46, rock); g = lerp(g, 0.42, rock); b = lerp(b, 0.4, rock);
      // Cold: tundra pales, then snow above the line (fuzzy edge).
      const cold = sstep(0.3, 0.18, t);
      r = lerp(r, 0.66, cold * 0.7); g = lerp(g, 0.66, cold * 0.7); b = lerp(b, 0.58, cold * 0.7);
      const snow = Math.max(sstep(this.snowLine(x, z) - 3, this.snowLine(x, z) + 4, h), sstep(0.17, 0.1, t)) * sstep(1.15, 0.75, slope);
      r = lerp(r, 0.93, snow); g = lerp(g, 0.95, snow); b = lerp(b, 0.99, snow);
    }
    // Grain so plains don't render as flat paint.
    const gr = 0.92 + 0.08 * vr;
    return [clamp(r * gr, 0, 1), clamp(g * gr, 0, 1), clamp(b * gr, 0, 1)];
  }

  // Deterministic "good" spawn: walkable grass near (0,0), searched outward.
  findSpawn() {
    for (let ring = 0; ring < 40; ring++) {
      const rad = 40 + ring * 90;
      for (let i = 0; i < 14; i++) {
        const a = (i / 14) * Math.PI * 2 + ring * 0.7;
        const x = Math.round(Math.cos(a) * rad), z = Math.round(Math.sin(a) * rad);
        const h = this.heightAt(x, z);
        if (h < 3 || h > 26) continue;
        if (this.slopeAt(x, z) > 0.35) continue;
        const b = this.biomeAt(x, z, h);
        if (b === 'plains' || b === 'meadow' || b === 'forest' || b === 'steppe' || b === 'savanna') {
          return { x, z };
        }
      }
    }
    return { x: 0, z: 0 };
  }
}
