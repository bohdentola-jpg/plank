// models.js — the built-in things you can put in a world.
//
// Each entry knows its size (for collision and for the editor's ghost) and how
// to build its mesh. Everything is boxes; nothing is imported.

import * as THREE from '../vendor/three.module.js';
import { COLORS, shade, clamp } from './util.js';
import { boxGeo, flatMat, cardboardBox } from './render.js';
import { buildVoxelGeometry, voxelMaterial, voxelSize, validateVoxels } from './voxel.js';

const M = (size, solid, physical, build, label, group) =>
  ({ size, solid, physical, build, label: label, group: group || 'blocks' });

function group(...children) {
  const g = new THREE.Group();
  for (const c of children) g.add(c);
  return g;
}

function box(w, h, d, color, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(boxGeo(w, h, d), flatMat(color));
  m.position.set(x, y, z);
  return m;
}

export const BUILTIN = {
  // ---- cardboard, the currency of this world
  box: M({ x: 1.4, y: 1.4, z: 1.4 }, true, true, () => cardboardBox(1.4), 'box', 'props'),
  bigbox: M({ x: 2.4, y: 2.4, z: 2.4 }, true, true, () => cardboardBox(2.4), 'big box', 'props'),

  // ---- building blocks
  block: M({ x: 2, y: 2, z: 2 }, true, false, () => group(box(2, 2, 2, COLORS.lightgray)), 'block'),
  platform: M({ x: 6, y: 0.6, z: 6 }, true, false, () => group(
    box(6, 0.6, 6, COLORS.lightgray),
    box(6.06, 0.12, 6.06, shade(COLORS.lightgray, -18), 0, 0.24, 0),
  ), 'platform'),
  wall: M({ x: 6, y: 4, z: 0.6 }, true, false, () => group(
    box(6, 4, 0.6, shade(COLORS.lightgray, 6)),
    box(6.05, 0.2, 0.66, shade(COLORS.lightgray, -20), 0, 1.9, 0),
  ), 'wall'),
  pillar: M({ x: 1.2, y: 5, z: 1.2 }, true, false, () => group(
    box(1.2, 5, 1.2, COLORS.silver),
    box(1.7, 0.4, 1.7, shade(COLORS.silver, -14), 0, -2.3, 0),
    box(1.7, 0.4, 1.7, shade(COLORS.silver, -14), 0, 2.3, 0),
  ), 'pillar'),
  ramp: M({ x: 4, y: 2, z: 6 }, true, false, () => {
    const g = new THREE.Group();
    const steps = 6;
    for (let i = 0; i < steps; i++) {
      const h = 2 * (i + 1) / steps;
      g.add(box(4, h, 6 / steps, shade(COLORS.lightgray, -i * 2), 0, -1 + h / 2, 3 - (i + 0.5) * (6 / steps)));
    }
    return g;
  }, 'ramp'),
  ball: M({ x: 1.6, y: 1.6, z: 1.6 }, true, true, () => {
    const g = new THREE.Group();
    const mesh = new THREE.Mesh(new THREE.IcosahedronGeometry(0.8, 1), flatMat(COLORS.gray));
    g.add(mesh);
    return g;
  }, 'ball', 'props'),

  // ---- the void's furniture
  blasterstand: M({ x: 1.6, y: 2.4, z: 1.6 }, false, false, () => group(
    box(1.6, 0.3, 1.6, shade(COLORS.silver, -16), 0, -1.05, 0),
    box(0.4, 1.8, 0.4, COLORS.silver, 0, -0.15, 0),
    box(1.1, 0.2, 1.1, shade(COLORS.silver, -8), 0, 0.85, 0),
  ), 'blaster stand', 'special'),
  pongtable: M({ x: 9, y: 2.4, z: 5 }, true, false, () => {
    const g = new THREE.Group();
    const topY = 0.35;
    g.add(box(9, 0.3, 5, 0x7f9f8a, 0, topY, 0));
    g.add(box(9.05, 0.08, 5.05, COLORS.white, 0, topY + 0.19, 0));
    g.add(box(0.12, 0.9, 5.1, COLORS.white, 0, topY + 0.6, 0));
    for (const [dx, dz] of [[-4, -2], [4, -2], [-4, 2], [4, 2]]) {
      g.add(box(0.28, 1.9, 0.28, shade(COLORS.silver, -20), dx, -0.65, dz));
    }
    return g;
  }, 'ping pong table', 'special'),
  sign: M({ x: 2.6, y: 2.8, z: 0.3 }, false, false, () => group(
    box(0.24, 1.6, 0.24, shade(COLORS.silver, -14), 0, -0.6, 0),
    box(2.6, 1.4, 0.24, COLORS.cardboard, 0, 0.8, 0),
    box(1.8, 0.12, 0.3, shade(COLORS.cardboard, -30), 0, 1.1, 0),
    box(1.4, 0.12, 0.3, shade(COLORS.cardboard, -30), 0, 0.8, 0),
    box(1.6, 0.12, 0.3, shade(COLORS.cardboard, -30), 0, 0.5, 0),
  ), 'sign', 'special'),
  lamp: M({ x: 1, y: 4.4, z: 1 }, true, false, () => group(
    box(1, 0.3, 1, shade(COLORS.silver, -20), 0, -2.05, 0),
    box(0.24, 3.6, 0.24, COLORS.silver, 0, -0.2, 0),
    box(1.1, 0.5, 1.1, COLORS.white, 0, 1.9, 0),
  ), 'lamp', 'special'),
  door: M({ x: 2, y: 4, z: 0.4 }, true, false, () => group(
    box(2, 4, 0.4, shade(COLORS.brown, 14)),
    box(0.24, 0.24, 0.5, COLORS.silver, 0.6, 0, 0),
  ), 'door', 'special'),

  // ---- nature, for building your own biomes
  tree: M({ x: 4, y: 8, z: 4 }, true, false, () => group(
    box(0.9, 5, 0.9, COLORS.brown, 0, -1.5, 0),
    box(4, 2.6, 4, COLORS.leaf, 0, 1.8, 0),
    box(2.4, 1.6, 2.4, shade(COLORS.leaf, 14), 0, 3.4, 0),
  ), 'tree', 'nature'),
  pine: M({ x: 3.4, y: 9, z: 3.4 }, true, false, () => {
    const g = new THREE.Group();
    g.add(box(0.8, 5, 0.8, shade(COLORS.brown, -18), 0, -2, 0));
    for (let i = 0; i < 3; i++) {
      const s = 3.4 - i * 0.9;
      g.add(box(s, 1.7, s, shade(COLORS.leaf, -14 + i * 9), 0, -0.4 + i * 1.6, 0));
    }
    return g;
  }, 'pine', 'nature'),
  rock: M({ x: 2.2, y: 1.6, z: 2.2 }, true, false, () => group(
    box(2.2, 1.4, 2, COLORS.stone, 0, -0.1, 0),
    box(1.2, 0.8, 1.1, shade(COLORS.stone, -16), 0.5, 0.5, 0.3),
  ), 'rock', 'nature'),
  flower: M({ x: 0.6, y: 1.2, z: 0.6 }, false, false, () => group(
    box(0.14, 0.8, 0.14, 0x7fa068, 0, -0.2, 0),
    box(0.5, 0.34, 0.5, COLORS.red, 0, 0.36, 0),
  ), 'flower', 'nature'),
  cactus: M({ x: 1.4, y: 4, z: 1.4 }, true, false, () => group(
    box(1.1, 4, 1.1, 0x6f8f63),
    box(1.2, 0.8, 0.8, 0x6f8f63, 1.1, 0.4, 0),
    box(0.8, 1.6, 0.8, 0x6f8f63, 1.6, 1.1, 0),
  ), 'cactus', 'nature'),
  lavarock: M({ x: 2.4, y: 1.8, z: 2.4 }, true, false, () => group(
    box(2.4, 1.4, 2.2, 0x4b4245, 0, -0.2, 0),
    box(1.2, 0.3, 1.1, COLORS.lava, 0, 0.6, 0),
  ), 'lava rock', 'nature'),
};

export const MODEL_GROUPS = ['props', 'blocks', 'nature', 'special'];

// ---------------------------------------------------------------- lookup
export function modelInfo(map, name) {
  const b = BUILTIN[name];
  if (b) return { name, size: b.size, solid: b.solid, physical: b.physical, builtin: b, label: b.label };
  const custom = map && map.models && Object.prototype.hasOwnProperty.call(map.models, name) ? map.models[name] : null;
  if (custom) {
    const vox = validateVoxels(custom.vox);
    return {
      name, size: voxelSize(vox),
      solid: custom.solid !== false,
      physical: !!custom.physical,
      custom, vox, label: name,
    };
  }
  return { name, size: { x: 1.4, y: 1.4, z: 1.4 }, solid: false, physical: false, missing: true, label: name };
}

// build a mesh for a model (a fresh Object3D each call)
export function buildModelMesh(map, name) {
  const info = modelInfo(map, name);
  if (info.builtin) {
    const obj = info.builtin.build();
    // built-ins are centred on their own origin; lift so the base sits at y=0
    obj.position.y += info.size.y / 2;
    const holder = new THREE.Group();
    holder.add(obj);
    return holder;
  }
  if (info.custom) {
    const geo = buildVoxelGeometry(info.vox);
    const mesh = new THREE.Mesh(geo, voxelMaterial());
    const holder = new THREE.Group();
    holder.add(mesh);
    return holder;
  }
  // missing model → a visible "?" placeholder so the builder notices
  const holder = new THREE.Group();
  const m = new THREE.Mesh(boxGeo(1.2, 1.2, 1.2), flatMat(COLORS.red));
  m.position.y = 0.6;
  holder.add(m);
  return holder;
}

// tint a whole model without touching the shared materials
export function tintMesh(obj, colorHex) {
  obj.traverse(o => {
    if (!o.isMesh) return;
    if (!o.userData.origMat) o.userData.origMat = o.material;
    if (colorHex == null) { o.material = o.userData.origMat; return; }
    o.material = flatMat(colorHex);
  });
}

export function setMeshOpacity(obj, opacity) {
  obj.traverse(o => {
    if (!o.isMesh) return;
    if (opacity >= 1) { if (o.userData.solidMat) o.material = o.userData.solidMat; return; }
    if (!o.userData.solidMat) o.userData.solidMat = o.material;
    const m = o.material.clone();
    m.transparent = true;
    m.opacity = clamp(opacity, 0, 1);
    m.depthWrite = false;
    o.material = m;
  });
}
