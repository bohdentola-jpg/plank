// models.js — the built-in things you can put in a world.
//
// Every model is composed boxes, no imports — but composed with care: open
// flaps on the cardboard, painted lines on the pong table, a marquee on the
// arcade cabinet. Each entry knows its size (collision + editor ghost), its
// default behaviour flags, and sometimes a default boxscript so it does
// something the moment you place it.

import * as THREE from '../vendor/three.module.js';
import { COLORS, shade, clamp } from './util.js';
import { boxGeo, flatMat, cardboardBox } from './render.js';
import { buildVoxelGeometry, voxelMaterial, voxelSize, validateVoxels } from './voxel.js';
import { DOOR_SCRIPT, BRICKS_GAME } from './arcadegames.js';

function group(...children) {
  const g = new THREE.Group();
  for (const c of children) g.add(c);
  return g;
}

function box(w, h, d, color, x = 0, y = 0, z = 0, ry = 0) {
  const m = new THREE.Mesh(boxGeo(w, h, d), flatMat(color));
  m.position.set(x, y, z);
  if (ry) m.rotation.y = ry;
  return m;
}

function glowBox(w, h, d, color, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(boxGeo(w, h, d), new THREE.MeshBasicMaterial({ color }));
  m.position.set(x, y, z);
  return m;
}

const M = (size, solid, physical, build, label, group, extra = {}) =>
  ({ size, solid, physical, build, label, group: group || 'blocks', ...extra });

export const BUILTIN = {
  // ================================================== cardboard
  box: M({ x: 1.4, y: 1.4, z: 1.4 }, true, true, () => cardboardBox(1.4), 'box', 'props'),
  bigbox: M({ x: 2.4, y: 2.4, z: 2.4 }, true, true, () => cardboardBox(2.4), 'big box', 'props'),
  crates: M({ x: 2.8, y: 2.6, z: 2.6 }, true, false, () => {
    const g = new THREE.Group();
    const a = cardboardBox(1.5); a.position.set(-0.6, -0.55, -0.4); g.add(a);
    const b = cardboardBox(1.3); b.position.set(0.75, -0.65, 0.35); b.rotation.y = 0.35; g.add(b);
    const c = cardboardBox(1.2); c.position.set(-0.15, 0.7, -0.1); c.rotation.y = -0.2; g.add(c);
    return g;
  }, 'box pile', 'props'),
  barrel: M({ x: 1.5, y: 2, z: 1.5 }, true, true, () => {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.72, 0.72, 1.9, 10), flatMat(0x8b9299));
    g.add(body);
    for (const y of [-0.62, 0.62]) {
      const ring = new THREE.Mesh(new THREE.CylinderGeometry(0.78, 0.78, 0.14, 10), flatMat(0x6d747b));
      ring.position.y = y;
      g.add(ring);
    }
    return g;
  }, 'barrel', 'props'),
  cone: M({ x: 1, y: 1.5, z: 1 }, false, true, () => group(
    box(1, 0.18, 1, 0xc9754f, 0, -0.66, 0),
    box(0.62, 0.5, 0.62, 0xd98a5f, 0, -0.36, 0),
    box(0.5, 0.3, 0.5, 0xefe6da, 0, 0.04, 0),
    box(0.38, 0.5, 0.38, 0xd98a5f, 0, 0.44, 0),
  ), 'traffic cone', 'props'),
  ball: M({ x: 1.6, y: 1.6, z: 1.6 }, true, true, () => {
    const g = new THREE.Group();
    g.add(new THREE.Mesh(new THREE.IcosahedronGeometry(0.8, 1), flatMat(0xb9bdc1)));
    const stripe = new THREE.Mesh(new THREE.CylinderGeometry(0.81, 0.81, 0.22, 12), flatMat(0xc4685c));
    g.add(stripe);
    return g;
  }, 'ball', 'props'),
  trampoline: M({ x: 3, y: 0.9, z: 3 }, true, false, () => group(
    box(3, 0.24, 3, 0x4a4e52, 0, 0.3, 0),
    box(2.4, 0.1, 2.4, 0x6f7fd9, 0, 0.44, 0),
    box(0.22, 0.7, 0.22, 0x9aa0a6, -1.3, -0.1, -1.3),
    box(0.22, 0.7, 0.22, 0x9aa0a6, 1.3, -0.1, -1.3),
    box(0.22, 0.7, 0.22, 0x9aa0a6, -1.3, -0.1, 1.3),
    box(0.22, 0.7, 0.22, 0x9aa0a6, 1.3, -0.1, 1.3),
  ), 'trampoline', 'props', { bouncy: 22 }),

  // ================================================== building
  block: M({ x: 2, y: 2, z: 2 }, true, false, () => group(
    box(2, 2, 2, 0xcfcfcf),
    box(2.04, 0.2, 2.04, 0xbdbdbd, 0, 0.9, 0),
    box(2.04, 0.2, 2.04, 0xbdbdbd, 0, -0.9, 0),
  ), 'block'),
  platform: M({ x: 6, y: 0.6, z: 6 }, true, false, () => group(
    box(6, 0.44, 6, 0xd2d2d2, 0, -0.08, 0),
    box(6.1, 0.16, 6.1, 0xbdbdbd, 0, 0.22, 0),
    box(5.4, 0.02, 5.4, 0xdedede, 0, 0.31, 0),
  ), 'platform'),
  wall: M({ x: 6, y: 4, z: 0.6 }, true, false, () => {
    const g = new THREE.Group();
    g.add(box(6, 4, 0.5, 0xd6d6d6));
    // brick seams
    for (let r = 0; r < 4; r++) {
      g.add(box(6.04, 0.06, 0.54, 0xc2c2c2, 0, -1.5 + r, 0));
    }
    g.add(box(6.06, 0.24, 0.6, 0xbdbdbd, 0, 1.94, 0));
    return g;
  }, 'wall'),
  pillar: M({ x: 1.2, y: 5, z: 1.2 }, true, false, () => group(
    box(1.05, 5, 1.05, 0xc7cacd),
    box(1.55, 0.4, 1.55, 0xb2b6ba, 0, -2.3, 0),
    box(1.4, 0.26, 1.4, 0xb9bdc1, 0, -2.0, 0),
    box(1.4, 0.26, 1.4, 0xb9bdc1, 0, 2.0, 0),
    box(1.55, 0.4, 1.55, 0xb2b6ba, 0, 2.3, 0),
  ), 'pillar'),
  ramp: M({ x: 4, y: 2, z: 6 }, true, false, () => {
    const g = new THREE.Group();
    const steps = 8;
    for (let i = 0; i < steps; i++) {
      const h = 2 * (i + 1) / steps;
      g.add(box(4, h, 6 / steps, shade(0xd2d2d2, -i), 0, -1 + h / 2, 3 - (i + 0.5) * (6 / steps)));
    }
    return g;
  }, 'ramp'),
  fence: M({ x: 4, y: 1.6, z: 0.3 }, true, false, () => {
    const g = new THREE.Group();
    for (const x of [-1.85, 0, 1.85]) g.add(box(0.22, 1.6, 0.22, 0xb0b4b8, x, 0, 0));
    g.add(box(4, 0.2, 0.14, 0xc2c6ca, 0, 0.55, 0));
    g.add(box(4, 0.2, 0.14, 0xc2c6ca, 0, -0.15, 0));
    return g;
  }, 'fence'),
  arch: M({ x: 5, y: 5, z: 1 }, true, false, () => group(
    box(1, 5, 1, 0xc7cacd, -2, 0, 0),
    box(1, 5, 1, 0xc7cacd, 2, 0, 0),
    box(5.2, 1, 1.06, 0xb9bdc1, 0, 2, 0),
    box(3.2, 0.5, 1.1, 0xcfd2d5, 0, 1.35, 0),
  ), 'arch'),

  // ================================================== the void's furniture
  blasterstand: M({ x: 1.8, y: 2.6, z: 1.8 }, false, false, () => {
    const g = new THREE.Group();
    g.add(box(1.8, 0.24, 1.8, 0xaeb2b6, 0, -1.18, 0));
    g.add(box(1.4, 0.18, 1.4, 0xbcc0c4, 0, -0.98, 0));
    g.add(box(0.38, 1.5, 0.38, 0xc7cacd, 0, -0.2, 0));
    g.add(box(1.2, 0.16, 1.2, 0xb2b6ba, 0, 0.6, 0));
    g.add(glowBox(1.26, 0.05, 1.26, 0xe8f0d8, 0, 0.7, 0));   // the "take me" shelf light
    return g;
  }, 'blaster stand', 'special'),
  pongtable: M({ x: 9, y: 2.4, z: 5 }, true, false, () => {
    const g = new THREE.Group();
    const topY = 0.38;
    g.add(box(9, 0.26, 5, 0x6e9480, 0, topY, 0));
    // painted lines: border + centre
    const line = 0xe9efe9;
    g.add(box(9, 0.03, 0.12, line, 0, topY + 0.145, -2.42));
    g.add(box(9, 0.03, 0.12, line, 0, topY + 0.145, 2.42));
    g.add(box(0.12, 0.03, 5, line, -4.42, topY + 0.145, 0));
    g.add(box(0.12, 0.03, 5, line, 4.42, topY + 0.145, 0));
    g.add(box(9, 0.03, 0.08, line, 0, topY + 0.145, 0));
    // net: posts + mesh strip
    g.add(box(0.1, 1, 0.12, 0x9aa0a6, 0, topY + 0.4, -2.56));
    g.add(box(0.1, 1, 0.12, 0x9aa0a6, 0, topY + 0.4, 2.56));
    g.add(box(0.06, 0.7, 5.1, 0xdadada, 0, topY + 0.52, 0));
    g.add(box(0.08, 0.1, 5.1, 0xf2f2f2, 0, topY + 0.85, 0));
    // frame + angled legs
    g.add(box(8.6, 0.2, 4.6, 0x5d7f6d, 0, topY - 0.2, 0));
    for (const [dx, dz] of [[-3.7, -1.9], [3.7, -1.9], [-3.7, 1.9], [3.7, 1.9]]) {
      g.add(box(0.26, 1.9, 0.26, 0x8a8f94, dx, -0.72, dz));
    }
    g.add(box(7.4, 0.2, 0.24, 0x8a8f94, 0, -1.4, -1.9));
    g.add(box(7.4, 0.2, 0.24, 0x8a8f94, 0, -1.4, 1.9));
    return g;
  }, 'ping pong table', 'special'),
  sign: M({ x: 2.8, y: 3, z: 0.4 }, false, false, () => group(
    box(0.26, 1.8, 0.26, 0x9c8a70, 0, -0.6, 0),
    box(0.7, 0.14, 0.7, 0x8a7a62, 0, -1.42, 0),
    box(2.8, 1.5, 0.22, COLORS.cardboard, 0, 0.95, 0),
    box(2.9, 0.14, 0.26, shade(COLORS.cardboard, -34), 0, 1.72, 0),
    box(2.9, 0.14, 0.26, shade(COLORS.cardboard, -34), 0, 0.18, 0),
    box(2, 0.14, 0.24, 0x8d7350, 0, 1.28, 0),
    box(1.5, 0.14, 0.24, 0x8d7350, -0.2, 0.95, 0),
    box(1.75, 0.14, 0.24, 0x8d7350, -0.05, 0.62, 0),
  ), 'sign', 'special'),
  lamp: M({ x: 1.2, y: 4.6, z: 1.2 }, true, false, () => group(
    box(1.2, 0.24, 1.2, 0xaab0b5, 0, -2.18, 0),
    box(0.5, 0.2, 0.5, 0xb8bdc2, 0, -2.0, 0),
    box(0.26, 3.9, 0.26, 0xc2c6ca, 0, -0.05, 0),
    box(0.7, 0.12, 0.7, 0xb2b6ba, 0, 1.9, 0),
    glowBox(0.95, 0.65, 0.95, 0xfff6dd, 0, 2.15, 0),
    box(1.1, 0.14, 1.1, 0x9aa0a6, 0, 2.5, 0),
  ), 'lamp', 'special', { lit: true }),
  bench: M({ x: 3.4, y: 1.5, z: 1.2 }, true, false, () => group(
    box(3.4, 0.18, 1.1, 0xb59a76, 0, -0.06, 0),
    box(3.4, 0.14, 0.2, 0xa88c68, 0, -0.14, 0.56),
    box(3.4, 0.7, 0.16, 0xb59a76, 0, 0.36, -0.54),
    box(0.24, 0.7, 1.0, 0x8a8f94, -1.45, -0.4, 0),
    box(0.24, 0.7, 1.0, 0x8a8f94, 1.45, -0.4, 0),
  ), 'bench', 'special'),
  door: M({ x: 2.2, y: 4.2, z: 0.5 }, true, false, () => group(
    box(2.2, 4.2, 0.3, 0xb2b6ba),
    box(1.8, 3.8, 0.4, 0x9c8a70, 0, -0.06, 0),
    box(1.35, 1.4, 0.46, 0x8d7c64, 0, 0.85, 0),
    box(1.35, 1.4, 0.46, 0x8d7c64, 0, -0.9, 0),
    box(0.22, 0.22, 0.55, 0xd8c07a, 0.62, -0.1, 0),
  ), 'door', 'special', { defaultScript: DOOR_SCRIPT }),
  flag: M({ x: 1.4, y: 4.6, z: 1.4 }, false, false, () => group(
    box(1.2, 0.3, 1.2, 0xb2b6ba, 0, -2.12, 0),
    box(0.2, 4.4, 0.2, 0xc7cacd, 0, 0, 0),
    box(1.5, 0.9, 0.1, 0x8fae85, 0.85, 1.7, 0),
    box(1.5, 0.14, 0.12, 0x7a9a70, 0.85, 1.32, 0),
  ), 'flag', 'special'),

  // ================================================== the arcade
  arcade: M({ x: 2.2, y: 3.6, z: 1.8 }, true, false, () => {
    const g = new THREE.Group();
    const body = 0x4c5157, trim = 0x3a3e43;
    g.add(box(2.2, 3.1, 1.6, body, 0, -0.25, 0));
    g.add(box(2.28, 0.24, 1.68, trim, 0, -1.68, 0));
    // side art stripe
    g.add(box(0.06, 2.6, 1.3, 0x6f7fd9, -1.11, -0.2, -0.05));
    g.add(box(0.06, 2.6, 1.3, 0x6f7fd9, 1.11, -0.2, -0.05));
    // marquee with a glowing face
    g.add(box(2.3, 0.62, 1.2, trim, 0, 1.5, -0.1));
    g.add(glowBox(2.14, 0.42, 0.06, 0xd8e6f2, 0, 1.5, 0.51));
    // screen bezel + the screen itself (a canvas texture lands here)
    g.add(box(1.9, 1.5, 0.2, trim, 0, 0.55, 0.72));
    const screen = new THREE.Mesh(
      boxGeo(1.62, 1.22, 0.04),
      new THREE.MeshBasicMaterial({ color: 0x101014 }),
    );
    screen.position.set(0, 0.55, 0.84);
    screen.userData.screenSurface = true;
    g.add(screen);
    // control deck: ledge, joystick, two buttons
    g.add(box(2.1, 0.24, 0.9, 0x565b61, 0, -0.42, 0.95, 0));
    g.add(box(0.12, 0.34, 0.12, 0x2f3337, -0.45, -0.2, 0.95));
    g.add(box(0.3, 0.12, 0.3, 0xc4685c, -0.45, -0.04, 0.95));
    g.add(box(0.26, 0.1, 0.26, 0xd8bc66, 0.3, -0.26, 0.98));
    g.add(box(0.26, 0.1, 0.26, 0x7ba368, 0.72, -0.26, 0.98));
    // coin slot
    g.add(box(0.5, 0.3, 0.06, trim, 0, -1.1, 0.81));
    g.add(glowBox(0.1, 0.16, 0.08, 0xe8d8a0, 0, -1.1, 0.83));
    return g;
  }, 'arcade cabinet', 'special', { screen: true, defaultScript: BRICKS_GAME }),

  // ================================================== nature
  tree: M({ x: 4.4, y: 8.5, z: 4.4 }, true, false, () => group(
    box(0.9, 4.5, 0.9, 0x9c8a70, 0, -2, 0),
    box(0.5, 1.2, 0.5, 0x8d7c64, 0.55, -1.4, 0.2, 0.5),
    box(4.4, 2.4, 4, COLORS.leaf, 0.1, 0.7, 0),
    box(3.2, 1.8, 3.4, shade(COLORS.leaf, 12), -0.4, 2.3, 0.2),
    box(1.8, 1.2, 1.8, shade(COLORS.leaf, 22), 0.4, 3.4, -0.2),
  ), 'tree', 'nature'),
  pine: M({ x: 3.6, y: 9, z: 3.6 }, true, false, () => {
    const g = new THREE.Group();
    g.add(box(0.7, 4.5, 0.7, shade(0x9c8a70, -24), 0, -2.2, 0));
    let y = -0.9;
    for (let i = 0; i < 4; i++) {
      const s = 3.6 - i * 0.8;
      g.add(box(s, 1.35, s, shade(COLORS.leaf, -16 + i * 8), 0, y, 0));
      y += 1.25;
    }
    g.add(box(0.5, 0.7, 0.5, shade(COLORS.leaf, 16), 0, y - 0.2, 0));
    return g;
  }, 'pine', 'nature'),
  bush: M({ x: 2.4, y: 1.6, z: 2.4 }, true, false, () => group(
    box(2.4, 1.2, 2.2, shade(COLORS.leaf, -6), 0, -0.15, 0),
    box(1.6, 0.9, 1.7, shade(COLORS.leaf, 8), 0.3, 0.35, 0.1),
    box(1.1, 0.6, 1, shade(COLORS.leaf, 18), -0.5, 0.3, -0.3),
  ), 'bush', 'nature'),
  rock: M({ x: 2.6, y: 1.8, z: 2.6 }, true, false, () => group(
    box(2.4, 1.5, 2.1, COLORS.stone, 0, -0.15, 0),
    box(1.4, 1, 1.3, shade(COLORS.stone, -16), 0.6, 0.4, 0.4, 0.4),
    box(0.9, 0.6, 0.9, shade(COLORS.stone, 10), -0.7, 0.55, -0.4, 0.7),
  ), 'rock', 'nature'),
  mushroom: M({ x: 1.3, y: 1.4, z: 1.3 }, false, false, () => group(
    box(0.36, 0.9, 0.36, 0xe0d8c8, 0, -0.25, 0),
    box(1.3, 0.5, 1.3, 0xc4685c, 0, 0.35, 0),
    box(0.9, 0.2, 0.9, 0xd88a80, 0, 0.65, 0),
    box(0.28, 0.14, 0.28, 0xf0e8dc, -0.35, 0.63, 0.3),
    box(0.22, 0.12, 0.22, 0xf0e8dc, 0.4, 0.62, -0.25),
  ), 'mushroom', 'nature'),
  flower: M({ x: 0.7, y: 1.3, z: 0.7 }, false, false, () => group(
    box(0.12, 0.85, 0.12, 0x7fa068, 0, -0.22, 0),
    box(0.3, 0.1, 0.5, 0x8fae85, 0.15, -0.4, 0),
    box(0.5, 0.32, 0.5, 0xc4685c, 0, 0.36, 0),
    box(0.24, 0.36, 0.24, 0xd8bc66, 0, 0.38, 0),
  ), 'flower', 'nature'),
  cactus: M({ x: 2.2, y: 4.2, z: 1.4 }, true, false, () => group(
    box(1, 4.2, 1, 0x6f8f63),
    box(1.06, 0.3, 1.06, 0x62815a, 0, 1.4, 0),
    box(1.06, 0.3, 1.06, 0x62815a, 0, 0.1, 0),
    box(0.9, 0.7, 0.7, 0x6f8f63, 0.95, 0.1, 0),
    box(0.7, 1.5, 0.7, 0x6f8f63, 1.05, 1.0, 0),
    box(0.66, 0.24, 0.66, 0x62815a, 1.05, 0.6, 0),
  ), 'cactus', 'nature'),
  lavarock: M({ x: 2.6, y: 2, z: 2.6 }, true, false, () => group(
    box(2.5, 1.5, 2.3, 0x4b4245, 0, -0.2, 0),
    box(1.5, 1.1, 1.4, 0x3d3639, 0.5, 0.35, 0.3, 0.5),
    glowBox(1, 0.16, 0.9, COLORS.lava, 0, 0.62, 0),
    glowBox(0.4, 0.1, 1.6, shade(COLORS.lava, 30), -0.6, 0.3, 0.2),
  ), 'lava rock', 'nature'),
};


export const MODEL_GROUPS = ['props', 'blocks', 'nature', 'special'];

// ---------------------------------------------------------------- lookup
export function modelInfo(map, name) {
  const b = BUILTIN[name];
  if (b) {
    return {
      name, size: b.size, solid: b.solid, physical: b.physical,
      builtin: b, label: b.label,
      defaultScript: b.defaultScript || null,
      screen: !!b.screen, bouncy: b.bouncy || 0, lit: !!b.lit,
    };
  }
  const custom = map && map.models && Object.prototype.hasOwnProperty.call(map.models, name) ? map.models[name] : null;
  if (custom) {
    const vox = validateVoxels(custom.vox);
    return {
      name, size: voxelSize(vox),
      solid: custom.solid !== false,
      physical: !!custom.physical,
      custom, vox, label: name,
      defaultScript: null, screen: false, bouncy: 0, lit: false,
    };
  }
  return {
    name, size: { x: 1.4, y: 1.4, z: 1.4 }, solid: false, physical: false,
    missing: true, label: name, defaultScript: null, screen: false, bouncy: 0, lit: false,
  };
}

export function buildModelMesh(map, name) {
  const info = modelInfo(map, name);
  const holder = new THREE.Group();
  if (info.builtin) {
    const obj = info.builtin.build();
    obj.position.y += info.size.y / 2;   // base sits on y=0
    holder.add(obj);
    return holder;
  }
  if (info.custom) {
    holder.add(new THREE.Mesh(buildVoxelGeometry(info.vox), voxelMaterial()));
    return holder;
  }
  const m = box(1.2, 1.2, 1.2, 0xc4685c, 0, 0.6, 0);
  holder.add(m);
  return holder;
}

export function tintMesh(obj, colorHex) {
  obj.traverse(o => {
    if (!o.isMesh) return;
    if (!o.userData.origMat) o.userData.origMat = o.material;
    if (colorHex == null) { o.material = o.userData.origMat; return; }
    if (o.material && o.material.isMeshBasicMaterial) return;   // keep glow parts glowing
    if (o.userData.screenSurface) return;                        // never tint the screen
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

// find the mesh that acts as a cabinet's display
export function findScreenSurface(obj) {
  let found = null;
  obj.traverse(o => { if (!found && o.userData && o.userData.screenSurface) found = o; });
  return found;
}
