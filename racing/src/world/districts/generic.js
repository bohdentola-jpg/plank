// PORT HALCYON — the generic district pack: plain blocks of buildings along
// the streets in the towns, trees and rocks in the country. Every district
// starts with this (configured by its style) until it has its own pack; it
// is also the worked example of the pack API (plan → scatter → build).
import { facadeTextures, groundTexture, concreteTexture } from '../../track/textures.js';
import { litMat, plainMat, box, cylinder, cone, sphere } from './builder.js';

// how each style's generic version looks
const TOWN = {
  downtown: { h: [28, 110], w: [16, 30], d: [16, 30], styles: ['glass', 'concrete', 'dark'], fill: true, lit: 0.35, gap: [0, 2] },
  uptown: { h: [10, 34], w: [10, 20], d: [12, 22], styles: ['brick', 'stucco', 'concrete'], fill: false, lit: 0.3, gap: [0, 1] },
  chinatown: { h: [9, 22], w: [7, 14], d: [10, 18], styles: ['brick', 'stucco', 'dark'], fill: true, lit: 0.45, gap: [0, 0] },
  oldtown: { h: [9, 18], w: [8, 15], d: [10, 16], styles: ['brick', 'stucco'], fill: true, lit: 0.35, gap: [0, 0] },
  works: { h: [7, 16], w: [16, 34], d: [16, 30], styles: ['warehouse', 'brick', 'concrete'], fill: true, lit: 0.12, gap: [2, 8] },
  eastside: { h: [5, 12], w: [10, 16], d: [10, 14], styles: ['stucco', 'brick'], fill: false, lit: 0.3, gap: [4, 10], setback: [3, 7] },
  harbor: { h: [8, 16], w: [20, 40], d: [16, 30], styles: ['warehouse'], fill: false, lit: 0.1, gap: [6, 20], setback: [4, 10] },
  shipyard: { h: [10, 22], w: [24, 50], d: [18, 30], styles: ['warehouse'], fill: false, lit: 0.1, gap: [8, 24], setback: [4, 12] },
  pier9: { h: [5, 10], w: [8, 16], d: [8, 14], styles: ['stucco'], fill: false, lit: 0.4, gap: [3, 9], setback: [1, 4] },
  ghosttown: { h: [4, 8], w: [7, 12], d: [8, 14], styles: ['stucco'], fill: false, lit: 0.05, gap: [1, 5] },
};
const COUNTRY = {
  point: { trees: 18, kind: 'broad', rocks: 0.15 },
  bayshore: { trees: 22, kind: 'broad', rocks: 0.25 },
  crestwood: { trees: 20, kind: 'cypress', rocks: 0.05, houses: 0.15 },
  lake: { trees: 14, kind: 'pine', rocks: 0.2, houses: 0.08 },
  ironworks: { trees: 24, kind: 'broad', rocks: 0.1 },
  redwood: { trees: 11, kind: 'redwood', rocks: 0.1 },
  farmland: { trees: 60, kind: 'broad', rocks: 0.02, houses: 0.2 },
  wilds: { trees: 12, kind: 'pine', rocks: 0.3 },
  kaido: { trees: 12, kind: 'cedar', rocks: 0.25 },
  summit: { trees: 28, kind: 'pine', rocks: 0.5 },
  ridgeline: { trees: 40, kind: 'pine', rocks: 0.5 },
  desert: { trees: 30, kind: 'cactus', rocks: 0.6 },
  redrock: { trees: 40, kind: 'cactus', rocks: 0.8 },
  drylake: { trees: 80, kind: 'cactus', rocks: 0.3 },
  ghosttown: { trees: 50, kind: 'cactus', rocks: 0.5 },
};

const FLOOR = 3.5, BAY = 3;

/** A generic pack for one style (each style's stub file makes its own). */
export function makeGeneric(style) {
  const town = TOWN[style], country = COUNTRY[style];
  return {
    id: `generic-${style}`,

    plan(P) {
      if (town) {
        const lots = P.lots({ width: town.w, depth: town.d, gap: town.gap, setback: town.setback || [0, 0.5], pad: town.gap[1] > 0 ? 0.4 : -0.6 });
        if (town.fill) lots.push(...P.fill({ spacing: 18, width: town.w, depth: town.d, pad: 0.4 }));
        for (const L of lots) {
          // taller near the middle of the district for downtown
          const h = Math.round(P.range(town.h[0], town.h[1]) / FLOOR) * FLOOR;
          const style = P.pick(town.styles);
          const g = P.groundRange(L.x, L.z, L.w, L.d, L.ry);
          const it = P.add({ type: 'block', x: L.x, z: L.z, w: L.w, d: L.d, ry: L.ry, h, style, v: Math.floor(P.rng() * 2), y0: g.lo - 1.5, y1: g.hi });
          P.collider({ kind: 'box', x: L.x, z: L.z, hx: L.w / 2, hz: L.d / 2, ry: L.ry, y0: it.y0, y1: g.hi + h });
          P.far({ x: L.x, z: L.z, y: g.lo - 1, w: L.w, d: L.d, h: h + (g.hi - g.lo) + 1, ry: L.ry, color: FAR_COLOR[style], lit: town.lit });
        }
      }
      if (country?.houses) {
        const lots = P.lots({ width: [9, 13], depth: [8, 11], gap: [30, 120], setback: [6, 14], chance: country.houses, roadPad: true });
        for (const L of lots) {
          const g = P.groundRange(L.x, L.z, L.w, L.d, L.ry);
          P.add({ type: 'house', x: L.x, z: L.z, w: L.w, d: L.d, ry: L.ry, h: 3.2, y0: g.lo - 1, y1: g.hi });
          P.collider({ kind: 'box', x: L.x, z: L.z, hx: L.w / 2, hz: L.d / 2, ry: L.ry, y0: g.lo - 1, y1: g.hi + 7 });
          P.far({ x: L.x, z: L.z, y: g.lo - 1, w: L.w, d: L.d, h: g.hi - g.lo + 6, ry: L.ry, color: '#8a7a68', lit: 0.3 });
          P.lamp({ x: L.x, z: L.z, hx: L.x + Math.sin(L.ry) * (L.d / 2 + 1), hz: L.z + Math.cos(L.ry) * (L.d / 2 + 1), hy: g.hi + 3, color: '#ffc880', radius: 9, intensity: 0.8, halo: 1.2 });
        }
      }
    },

    scatter(S) {
      if (!country) return;
      for (const [x, z] of S.points(country.trees, { r: 2.5, density: (px, pz) => 0.55 + 0.45 * S.noise(px / 90, pz / 90) })) {
        const y = S.groundY(x, z);
        if (y > 640) continue;
        const kind = country.kind;
        const s = S.range(0.75, 1.3);
        S.add({ type: 'tree', kind, x, z, y, s, t: S.rng() });
        const r = kind === 'redwood' ? 1.6 * s : kind === 'cactus' ? 0.35 : 0.45 * s;
        S.collider({ kind: 'circle', x, z, r, y0: y - 1, y1: y + 8 });
      }
      for (const [x, z] of S.points(40, { r: 3 })) {
        if (S.rng() > country.rocks) continue;
        const y = S.groundY(x, z);
        const s = S.range(0.6, 2.6);
        S.add({ type: 'rock', x, z, y, s, t: S.rng() });
        if (s > 1.2) S.collider({ kind: 'circle', x, z, r: s * 0.9, y0: y - 1, y1: y + s * 1.4 });
      }
    },

    warm(B) {
      if (town) for (const st of town.styles) for (const v of [0, 1]) facadeMat(B, st, v);
      if (town || country?.houses) { roofMat(B); darkMat(B); }
      if (country) {
        const pal = TREE[country.kind];
        B.mat(`trunk:${country.kind}`, () => litMat({ color: pal.trunk, roughness: 0.9 }));
        B.mat(`leaf:${country.kind}`, () => litMat({ color: pal.leaf, roughness: 0.85, flatShading: true }));
        rockMat(B);
      }
    },

    *build(B, items) {
      let n = 0;
      for (const it of items) {
        if (it.type === 'block') block(B, it);
        else if (it.type === 'house') house(B, it);
        else if (it.type === 'tree') tree(B, it);
        else if (it.type === 'rock') rock(B, it);
        if (++n % 40 === 0) yield;
      }
    },
  };
}

const FAR_COLOR = { glass: '#2c3a48', concrete: '#77736c', dark: '#34343a', brick: '#6a3a2c', stucco: '#9b8f7a', warehouse: '#5d6266' };

function facadeMat(B, style, v) {
  return B.mat(`facade:${style}:${v}`, () => {
    const t = facadeTextures(style, `g${v}`);
    return litMat({ map: t.map, emissive: 0xffffff, emissiveMap: t.emi, roughness: style === 'glass' ? 0.3 : 0.85, metalness: style === 'glass' ? 0.35 : 0, envMapIntensity: style === 'glass' ? 1.1 : 0.35 }, { night: 0.9 });
  });
}
const roofMat = (B) => B.mat('roof', () => plainMat({ map: concreteTexture('#55534f', 'roof'), roughness: 0.95 }));
const darkMat = (B) => B.mat('dark', () => litMat({ color: 0x3a3a3c, roughness: 0.8 }));

function block(B, it) {
  const { x, z, w, d, ry, h, style, v } = it;
  const y0 = it.y0, top = it.y1 + h;
  // the facade tiles every 6 bays × 12 storeys
  box(B.acc(facadeMat(B, style, v)), x, y0, z, w, top - y0, d, ry, { u: BAY * 6, v: FLOOR * 12, top: false, v0: -(it.y1 - y0) / (FLOOR * 12) });
  box(B.acc(roofMat(B)), x, top, z, w, 0.4, d, ry, { u: 8 });
  // a parapet and something on the roof
  const c = Math.cos(ry), s = Math.sin(ry);
  const k = B.rng();
  if (k < 0.6) box(B.acc(darkMat(B)), x + (k - 0.3) * w * 0.6 * c, top + 0.4, z - (k - 0.3) * w * 0.6 * s, Math.min(6, w * 0.3), 2.4, Math.min(5, d * 0.3), ry, { u: 2 });
  if (h > 40 && k > 0.4) cylinder(B.acc(darkMat(B)), x - 3 * s, top + 0.4, z - 3 * c, 1.8, 3.5, 8, { top: true });
}

function house(B, it) {
  const { x, z, w, d, ry } = it;
  const wall = B.mat('housewall', () => litMat({ color: 0xc9b89a, roughness: 0.9 }));
  const roof = B.mat('houseroof', () => litMat({ color: 0x5a3a2c, roughness: 0.85 }));
  box(B.acc(wall), x, it.y0, z, w, it.y1 - it.y0 + it.h, d, ry, { u: 3 });
  const acc = B.acc(roof);
  const c = Math.cos(ry), s = Math.sin(ry);
  const y = it.y1 + it.h, hw = w / 2 + 0.4, hd = d / 2 + 0.4, rise = 2.4;
  const P = (lx, ly, lz) => [x + lx * c + lz * s, y + ly, z - lx * s + lz * c];
  acc.quadP(P(-hw, 0, hd), P(hw, 0, hd), P(hw, rise, 0), P(-hw, rise, 0));
  acc.quadP(P(hw, 0, -hd), P(-hw, 0, -hd), P(-hw, rise, 0), P(hw, rise, 0));
  const wa = B.acc(wall);
  const t1 = [wa.v(...P(w / 2, 0, d / 2)), wa.v(...P(w / 2, 0, -d / 2)), wa.v(...P(w / 2, rise, 0))];
  wa.tri(t1[0], t1[1], t1[2]);
  const t2 = [wa.v(...P(-w / 2, 0, -d / 2)), wa.v(...P(-w / 2, 0, d / 2)), wa.v(...P(-w / 2, rise, 0))];
  wa.tri(t2[0], t2[1], t2[2]);
}

const TREE = {
  broad: { trunk: 0x4a3a2a, leaf: 0x3d5a2a },
  cypress: { trunk: 0x4a3a2a, leaf: 0x2f4a2a },
  pine: { trunk: 0x4a3626, leaf: 0x2a4026 },
  cedar: { trunk: 0x5a3a26, leaf: 0x24382a },
  redwood: { trunk: 0x7a3e26, leaf: 0x2e4a2a },
  cactus: { trunk: 0x4f6e3a, leaf: 0x4f6e3a },
};

function tree(B, it) {
  const { x, z, y, s, kind } = it;
  const pal = TREE[kind];
  const trunk = B.mat(`trunk:${kind}`, () => litMat({ color: pal.trunk, roughness: 0.9 }));
  const leaf = B.mat(`leaf:${kind}`, () => litMat({ color: pal.leaf, roughness: 0.85, flatShading: true }));
  if (kind === 'cactus') {
    cylinder(B.acc(leaf), x, y - 0.2, z, 0.32 * s, 3.2 * s, 7, { top: true });
    if (it.t > 0.4) { cylinder(B.acc(leaf), x + 0.5 * s, y + 1.4 * s, z, 0.22 * s, 1.3 * s, 6, { top: true }); }
    return;
  }
  if (kind === 'broad') {
    cylinder(B.acc(trunk), x, y - 0.3, z, 0.28 * s, 3.4 * s, 6);
    sphere(B.acc(leaf), x, y + 4.6 * s, z, 2.6 * s, 7, { sy: 0.85 });
    return;
  }
  if (kind === 'cypress') {
    cylinder(B.acc(trunk), x, y - 0.3, z, 0.2 * s, 1.2 * s, 5);
    cone(B.acc(leaf), x, y + 0.6 * s, z, 1.2 * s, 9 * s, 7);
    return;
  }
  if (kind === 'redwood') {
    cylinder(B.acc(trunk), x, y - 0.5, z, 1.5 * s, 34 * s, 9, { r2: 0.7 * s });
    for (let k = 0; k < 4; k++) cone(B.acc(leaf), x, y + (16 + k * 6) * s, z, (6 - k) * s, 9 * s, 8);
    return;
  }
  // pine / cedar: a trunk and two or three stacked cones
  const hgt = kind === 'cedar' ? 14 : 11;
  cylinder(B.acc(trunk), x, y - 0.3, z, 0.3 * s, hgt * 0.4 * s, 6);
  for (let k = 0; k < 3; k++) cone(B.acc(leaf), x, y + (2 + k * hgt * 0.22) * s, z, (3.2 - k * 0.8) * s, hgt * 0.5 * s, 7);
}

const rockMat = (B) => B.mat('rock', () => litMat({ map: groundTexture('gravel'), color: 0x8a8278, roughness: 0.95, flatShading: true }));
function rock(B, it) {
  const m = rockMat(B);
  sphere(B.acc(m), it.x, it.y - it.s * 0.3, it.z, it.s, 6, { sy: 0.7 });
}
