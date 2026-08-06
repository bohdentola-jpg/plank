// Vegetation: low-poly species built in code, scattered per-chunk as
// InstancedMeshes with per-instance tint. What grows where comes from the
// biome tables in world.js; POIs keep a clear radius so ruins aren't
// swallowed by pines.

import * as THREE from 'three';
import { mulberry32, hashU32 } from './noise.js';
import { BIOMES } from './world.js';
import { CLEAR_R } from './poi.js';
import { CHUNK } from './terrain.js';

// ---- tiny geometry merger (color baked as vertex colors) --------------------
function bake(parts) {
  let vCount = 0, iCount = 0;
  const prepared = parts.map(({ geo, matrix, color }) => {
    const g = geo.index ? geo.toNonIndexed() : geo;
    const p = g.getAttribute('position');
    vCount += p.count; iCount += p.count;
    return { g, matrix, color: new THREE.Color(color) };
  });
  const pos = new Float32Array(vCount * 3);
  const nrm = new Float32Array(vCount * 3);
  const col = new Float32Array(vCount * 3);
  const nmat = new THREE.Matrix3();
  const v = new THREE.Vector3();
  let off = 0;
  for (const { g, matrix, color } of prepared) {
    const p = g.getAttribute('position'), n = g.getAttribute('normal');
    nmat.getNormalMatrix(matrix);
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i).applyMatrix4(matrix);
      pos[(off + i) * 3] = v.x; pos[(off + i) * 3 + 1] = v.y; pos[(off + i) * 3 + 2] = v.z;
      v.fromBufferAttribute(n, i).applyMatrix3(nmat).normalize();
      nrm[(off + i) * 3] = v.x; nrm[(off + i) * 3 + 1] = v.y; nrm[(off + i) * 3 + 2] = v.z;
      col[(off + i) * 3] = color.r; col[(off + i) * 3 + 1] = color.g; col[(off + i) * 3 + 2] = color.b;
    }
    off += p.count;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
  out.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return out;
}

const M = (x, y, z, rx = 0, ry = 0, rz = 0, s = 1) => {
  const m = new THREE.Matrix4();
  m.makeRotationFromEuler(new THREE.Euler(rx, ry, rz));
  m.scale(new THREE.Vector3(s, s, s));
  m.setPosition(x, y, z);
  return m;
};

// Blade fan for grass tufts / reeds — cheap triangles, no texture.
function bladeFan(blades, h, spread, taper = 0.06) {
  const pos = [], nrm = [];
  for (let i = 0; i < blades; i++) {
    const a = (i / blades) * Math.PI * 2 + i * 0.7;
    const dx = Math.cos(a) * spread, dz = Math.sin(a) * spread;
    const bh = h * (0.7 + 0.3 * ((i * 37) % 10) / 10);
    pos.push(-taper, 0, 0, taper, 0, 0, dx, bh, dz);
    for (let k = 0; k < 3; k++) nrm.push(0, 0.35, 0.95);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
  return g;
}

export function makeFloraLib() {
  const cyl = (r0, r1, h, seg = 6) => new THREE.CylinderGeometry(r0, r1, h, seg);
  const cone = (r, h, seg = 7) => new THREE.ConeGeometry(r, h, seg);
  const ball = (r, d = 1) => new THREE.IcosahedronGeometry(r, d);
  const BARK = '#5d4630', BARKD = '#4a3826', LEAF = '#33622c', DARKLEAF = '#274d24';

  const defs = {
    conifer: {
      shadow: true,
      geo: bake([
        { geo: cyl(0.13, 0.2, 1.6), matrix: M(0, 0.8, 0), color: BARKD },
        { geo: cone(1.5, 2.4), matrix: M(0, 2.2, 0), color: '#2b5228' },
        { geo: cone(1.15, 2.0), matrix: M(0, 3.5, 0), color: '#30602c' },
        { geo: cone(0.75, 1.6), matrix: M(0, 4.7, 0), color: '#387033' },
      ]),
    },
    snowpine: {
      shadow: true,
      geo: bake([
        { geo: cyl(0.13, 0.2, 1.4), matrix: M(0, 0.7, 0), color: BARKD },
        { geo: cone(1.4, 2.2), matrix: M(0, 2.0, 0), color: '#4a6b52' },
        { geo: cone(1.05, 1.9), matrix: M(0, 3.2, 0), color: '#9fb8a8' },
        { geo: cone(0.68, 1.5), matrix: M(0, 4.3, 0), color: '#dfe9e4' },
      ]),
    },
    broadleaf: {
      shadow: true,
      geo: bake([
        { geo: cyl(0.16, 0.26, 2.0), matrix: M(0, 1.0, 0), color: BARK },
        { geo: ball(1.5), matrix: M(0, 3.0, 0), color: LEAF },
        { geo: ball(1.1), matrix: M(0.9, 2.5, 0.4), color: DARKLEAF },
        { geo: ball(1.0), matrix: M(-0.8, 2.7, -0.4), color: '#3d7233' },
      ]),
    },
    acacia: {
      shadow: true,
      geo: bake([
        { geo: cyl(0.12, 0.2, 2.8), matrix: M(0.15, 1.4, 0, 0, 0, 0.12), color: BARK },
        { geo: cyl(2.3, 1.7, 0.45, 9), matrix: M(0.35, 3.0, 0), color: '#5c6e2e' },
      ]),
    },
    palm: {
      shadow: true,
      geo: (() => {
        const parts = [
          { geo: cyl(0.14, 0.22, 1.4), matrix: M(0.0, 0.7, 0, 0, 0, 0.1), color: '#6b5638' },
          { geo: cyl(0.12, 0.15, 1.4), matrix: M(0.22, 1.9, 0, 0, 0, 0.22), color: '#75603f' },
          { geo: cyl(0.1, 0.13, 1.3), matrix: M(0.55, 3.0, 0, 0, 0, 0.3), color: '#7d684a' },
        ];
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * Math.PI * 2;
          parts.push({
            geo: new THREE.BoxGeometry(1.9, 0.05, 0.4),
            matrix: M(0.75 + Math.cos(a) * 0.85, 3.75 - 0.18 * (i % 3), Math.sin(a) * 0.85, 0, -a, -0.45),
            color: i % 2 ? '#3f7a35' : '#4c8a3e',
          });
        }
        return bake(parts);
      })(),
    },
    cactus: {
      shadow: true,
      geo: bake([
        { geo: cyl(0.3, 0.34, 2.4, 8), matrix: M(0, 1.2, 0), color: '#3f7047' },
        { geo: cyl(0.16, 0.18, 1.0, 6), matrix: M(0.52, 1.6, 0, 0, 0, 0.9), color: '#457a4d' },
        { geo: cyl(0.16, 0.18, 0.8, 6), matrix: M(-0.48, 1.2, 0, 0, 0, -0.9), color: '#38663f' },
      ]),
    },
    deadtree: {
      shadow: true,
      geo: bake([
        { geo: cyl(0.12, 0.24, 2.6), matrix: M(0, 1.3, 0, 0, 0, 0.06), color: '#6e6257' },
        { geo: cyl(0.05, 0.1, 1.5), matrix: M(0.45, 2.5, 0, 0, 0, -0.8), color: '#665b50' },
        { geo: cyl(0.04, 0.09, 1.2), matrix: M(-0.4, 2.1, 0.1, 0.3, 0, 0.9), color: '#75695d' },
      ]),
    },
    shrub: {
      shadow: false,
      geo: bake([
        { geo: ball(0.55), matrix: M(0, 0.4, 0), color: '#3a5c2e' },
        { geo: ball(0.4), matrix: M(0.35, 0.3, 0.2), color: '#456b36' },
      ]),
    },
    rock: {
      shadow: true,
      geo: bake([
        { geo: ball(0.7, 0), matrix: M(0, 0.25, 0, 0.4, 0.8, 0.2, 1), color: '#7a7570' },
        { geo: ball(0.45, 0), matrix: M(0.5, 0.15, 0.25, 0.9, 0.2, 0.5, 1), color: '#6e6a66' },
      ]),
    },
    grass: { shadow: false, twoSided: true, geo: (() => {
      const g = bladeFan(5, 0.55, 0.3);
      const col = new Float32Array(g.getAttribute('position').count * 3);
      for (let i = 0; i < col.length; i += 3) { col[i] = 0.42; col[i + 1] = 0.58; col[i + 2] = 0.28; }
      g.setAttribute('color', new THREE.BufferAttribute(col, 3));
      return g;
    })() },
    reed: { shadow: false, twoSided: true, geo: (() => {
      const g = bladeFan(4, 1.5, 0.18, 0.04);
      const col = new Float32Array(g.getAttribute('position').count * 3);
      for (let i = 0; i < col.length; i += 3) { col[i] = 0.45; col[i + 1] = 0.55; col[i + 2] = 0.33; }
      g.setAttribute('color', new THREE.BufferAttribute(col, 3));
      return g;
    })() },
    flower: { shadow: false, twoSided: true, geo: (() => {
      const stem = bladeFan(3, 0.4, 0.12);
      const scol = new Float32Array(stem.getAttribute('position').count * 3);
      for (let i = 0; i < scol.length; i += 3) { scol[i] = 0.35; scol[i + 1] = 0.55; scol[i + 2] = 0.25; }
      stem.setAttribute('color', new THREE.BufferAttribute(scol, 3));
      const bloom = bake([
        { geo: new THREE.BoxGeometry(0.16, 0.05, 0.16), matrix: M(0, 0.45, 0), color: '#ffffff' },
      ]);
      // merge stem + bloom manually
      const a = stem.getAttribute('position'), b = bloom.getAttribute('position');
      const pos = new Float32Array((a.count + b.count) * 3);
      pos.set(a.array, 0); pos.set(b.array, a.count * 3);
      const an = stem.getAttribute('normal'), bn = bloom.getAttribute('normal');
      const nrm = new Float32Array((a.count + b.count) * 3);
      nrm.set(an.array, 0); nrm.set(bn.array, a.count * 3);
      const ac = stem.getAttribute('color'), bc = bloom.getAttribute('color');
      const col = new Float32Array((a.count + b.count) * 3);
      col.set(ac.array, 0); col.set(bc.array, a.count * 3);
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      g.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
      g.setAttribute('color', new THREE.BufferAttribute(col, 3));
      return g;
    })() },
  };

  const lib = {};
  for (const [name, def] of Object.entries(defs)) {
    def.geo.computeBoundingSphere();
    lib[name] = {
      geo: def.geo,
      mat: new THREE.MeshLambertMaterial({
        vertexColors: true,
        side: def.twoSided ? THREE.DoubleSide : THREE.FrontSide,
      }),
      shadow: !!def.shadow,
    };
  }
  return lib;
}

// Per-species placement rules (keeps palms off mountaintops).
const RULES = {
  conifer: { minH: 1.4, maxH: 60, maxSlope: 0.55, s: [0.8, 1.5] },
  snowpine: { minH: 1.4, maxH: 90, maxSlope: 0.6, s: [0.8, 1.4] },
  broadleaf: { minH: 1.4, maxH: 45, maxSlope: 0.5, s: [0.8, 1.5] },
  acacia: { minH: 1.4, maxH: 35, maxSlope: 0.35, s: [0.9, 1.3] },
  palm: { minH: 0.8, maxH: 7, maxSlope: 0.35, s: [0.85, 1.25] },
  cactus: { minH: 1.2, maxH: 40, maxSlope: 0.4, s: [0.7, 1.4] },
  deadtree: { minH: 0.6, maxH: 55, maxSlope: 0.5, s: [0.7, 1.3] },
  shrub: { minH: 0.8, maxH: 55, maxSlope: 0.6, s: [0.7, 1.6] },
  rock: { minH: -2, maxH: 95, maxSlope: 1.4, s: [0.5, 2.2] },
  grass: { minH: 0.5, maxH: 55, maxSlope: 0.75, s: [0.8, 1.6] },
  reed: { minH: 0.1, maxH: 1.6, maxSlope: 0.4, s: [0.9, 1.5] },
  flower: { minH: 0.6, maxH: 40, maxSlope: 0.5, s: [0.8, 1.4] },
};

const ATTEMPTS = 105;

export function makeScatterer(world, poiField, lib) {
  const dummy = new THREE.Object3D();
  const tint = new THREE.Color();
  const FLOWER_TINTS = [0xffffff, 0xffd857, 0xff8fb2, 0xb9a2ff, 0xff7a5c];

  return function scatter(cx, cz) {
    const rng = mulberry32(hashU32((cx * 341873) ^ (cz * 132897) ^ world.seed ^ 0xf10a));
    const x0 = cx * CHUNK, z0 = cz * CHUNK;
    const clear = poiField.poisNear(x0 + CHUNK / 2, z0 + CHUNK / 2, CHUNK * 0.75 + CLEAR_R);

    // gather placements per species
    const placed = {};
    for (let i = 0; i < ATTEMPTS; i++) {
      const x = x0 + rng() * CHUNK, z = z0 + rng() * CHUNK;
      const h = world.heightAt(x, z);
      if (h < 0.1) continue;
      const slope = world.slopeAt(x, z);
      const biome = world.biomeAt(x, z, h, slope);
      const table = BIOMES[biome].flora;
      if (!table.length) continue;
      let total = 0;
      for (const [, w] of table) total += w;
      let roll = rng() * total, species = table[0][0];
      for (const [name, w] of table) { roll -= w; if (roll <= 0) { species = name; break; } }
      const rule = RULES[species];
      if (!rule || h < rule.minH || h > rule.maxH || slope > rule.maxSlope) continue;
      let blocked = false;
      for (const p of clear) {
        if ((p.x - x) * (p.x - x) + (p.z - z) * (p.z - z) < CLEAR_R * CLEAR_R) { blocked = true; break; }
      }
      if (blocked) continue;
      (placed[species] || (placed[species] = [])).push({
        x, z, h,
        s: rule.s[0] + rng() * (rule.s[1] - rule.s[0]),
        rot: rng() * Math.PI * 2,
        v: rng(),
      });
    }

    const keys = Object.keys(placed);
    if (!keys.length) return null;
    const group = new THREE.Group();
    for (const species of keys) {
      const list = placed[species];
      const { geo, mat, shadow } = lib[species];
      const im = new THREE.InstancedMesh(geo, mat, list.length);
      im.castShadow = shadow;
      for (let i = 0; i < list.length; i++) {
        const p = list[i];
        dummy.position.set(p.x, p.h - 0.06, p.z);
        dummy.rotation.set(0, p.rot, 0);
        dummy.scale.setScalar(p.s);
        dummy.updateMatrix();
        im.setMatrixAt(i, dummy.matrix);
        if (species === 'flower') tint.setHex(FLOWER_TINTS[(p.v * FLOWER_TINTS.length) | 0]);
        else tint.setScalar(0.82 + p.v * 0.3);
        im.setColorAt(i, tint);
      }
      im.instanceMatrix.needsUpdate = true;
      if (im.instanceColor) im.instanceColor.needsUpdate = true;
      im.computeBoundingSphere();
      group.add(im);
    }
    return group;
  };
}
