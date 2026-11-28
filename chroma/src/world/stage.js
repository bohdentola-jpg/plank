// Battle stages. Layouts are point-symmetric around the origin so both teams
// get the same map; team A spawns at -Z, team B at +Z.
import * as THREE from 'three';
import { Level } from './level.js';
import { PaintSystem, makeNoiseTexture } from './paint.js';
import { levelMaterials } from './materials.js';
import { signTexture } from './textures.js';
import { rng } from '../util.js';
import { FIZZWATER } from './stages/fizzwater.js';
import { MESA } from './stages/mesa.js';
import { FROSTBITE } from './stages/frostbite.js';

const C = {
  navy: 0x4a6fa5, rust: 0xc8643c, olive: 0x8a9a5b, cream: 0xe8dcc0, teal: 0x4f9da6, plum: 0x8e6c8a, white: 0xffffff,
};

const flipRise = { '+z': '-z', '-z': '+z', '+x': '-x', '-x': '+x' };

// Stage definitions -----------------------------------------------------------
// Each entry: [kind, min, max, opts]; ramps need opts.rise. 'sym' entries are
// already symmetric and added once.
const STAGES = {
  terminal: {
    name: 'Tangerine Terminal',
    sky: 'day',
    water: 0x178fa8,
    half: { minX: -21, maxX: 21, minZ: -40, maxZ: 40 },
    spawnZ: 36.4, spawnY: 1.4,
    // extra battle modes: zone rects [x0,z0,x1,z1,y]; team A's hoop pad (team B
    // scores there, team B's hoop is its point mirror); tip-off landing spot
    modes: { zones: [[-5.5, -3.8, 5.5, 3.8, 1.8]], hoop: { x: 0, z: -26, y: 0, r: 3.8 }, tip: [-3.6, 1.8, -1.5] },
    sym: [
      ['box', [-21, -3, -40], [21, 0, 40], { mat: 'floor' }],
      ['box', [-6, 0, -5], [6, 1.8, 5], { mat: 'concrete' }],
      ['box', [-1.2, 1.8, -1.2], [1.2, 3.4, 1.2], { mat: 'concreteDark' }],
    ],
    mirrored: [
      // base deck + ramps
      ['box', [-7, 0, -40], [7, 1.4, -32], { mat: 'grate', base: true }],
      ['ramp', [-7, 0, -32], [-3.5, 1.4, -28], { rise: '-z', mat: 'grate' }],
      ['ramp', [3.5, 0, -32], [7, 1.4, -28], { rise: '-z', mat: 'grate' }],
      ['box', [-7.4, -0.6, -40.5], [7.4, 2.3, -40], { mat: 'hazard', paintable: false }],
      // base flank blocks
      ['box', [-17, 0, -37], [-11, 2.2, -31.5], { mat: 'concrete' }],
      ['box', [11, 0, -37], [17, 2.2, -31.5], { mat: 'concrete' }],
      ['box', [-11, 0, -34], [-9.6, 1.0, -32], { mat: 'wood' }],
      // containers
      ['box', [-16, 0, -26], [-13.4, 2.6, -19], { mat: 'container', color: C.navy }],
      ['box', [13.4, 0, -25], [16, 2.6, -18], { mat: 'container', color: C.rust }],
      ['box', [16, 0, -25], [18.6, 2.6, -18], { mat: 'container', color: C.cream }],
      ['box', [13.4, 2.6, -24], [18.6, 3.0, -19], { mat: 'grate', paintable: true }],
      // low cover walls
      ['box', [-6, 0, -22.4], [-2, 1.0, -21.8], { mat: 'concreteDark' }],
      ['box', [3, 0, -17.6], [7, 1.0, -17], { mat: 'concreteDark' }],
      // crates
      ['box', [-10.2, 0, -15.2], [-9, 1.2, -14], { mat: 'wood' }],
      ['box', [-9, 0, -15.2], [-7.8, 1.2, -14], { mat: 'wood' }],
      ['box', [-10.2, 1.2, -15.2], [-9, 2.4, -14], { mat: 'wood' }],
      ['box', [8.8, 0, -11.2], [10, 1.2, -10], { mat: 'wood' }],
      // west catwalk + ramp
      ['box', [-21, 0, -12], [-16.5, 1.4, 4], { mat: 'grate' }],
      ['ramp', [-21, 0, -16], [-18, 1.4, -12], { rise: '+z', mat: 'grate' }],
      ['box', [-17, 1.4, -12], [-16.5, 2.2, -3], { mat: 'hazard', paintable: false }],
      // plateau ramps + cover
      ['ramp', [-6, 0, -9], [-2.2, 1.8, -5], { rise: '+z', mat: 'concrete' }],
      ['ramp', [-10, 0, 1], [-6, 1.8, 4.6], { rise: '+x', mat: 'concrete' }],
      ['box', [1, 1.8, -4.6], [4.6, 2.75, -4], { mat: 'concreteDark' }],
      // mid flank block (east) + its crate step
      ['box', [11.5, 0, -4.5], [15, 2.0, 0.5], { mat: 'container', color: C.teal }],
      ['box', [10.3, 0, -1.5], [11.5, 1.0, 0.5], { mat: 'wood' }],
      // edge rails near bases
      ['box', [-21.4, 0, -40], [-21, 0.9, -27], { mat: 'hazard', paintable: false }],
      ['box', [21, 0, -40], [21.4, 0.9, -27], { mat: 'hazard', paintable: false }],
    ],
  },
  skyline: {
    name: 'Skyline Courts',
    sky: 'golden',
    decor: 'skyline',
    killY: -6,
    half: { minX: -20, maxX: 20, minZ: -36, maxZ: 36 },
    spawnZ: 33, spawnY: 1.2,
    modes: { zones: [[-7, -5, 7, 5, 0.9]], hoop: { x: 0, z: -23, y: 0, r: 3.8 }, tip: [-4, 0.9, -2] },
    sym: [
      ['box', [-15, -6, -5], [15, 0, 5], { mat: 'concrete' }],
      ['box', [-8, 0, -7], [8, 0.9, 7], { mat: 'floor' }],
      ['box', [-1, 0.9, -1], [1, 2.6, 1], { mat: 'concreteDark' }],
    ],
    mirrored: [
      ['box', [-20, -6, -36], [20, 0, -5], { mat: 'concrete' }],
      // spawn deck
      ['box', [-6, 0, -36], [6, 1.2, -30], { mat: 'grate', base: true }],
      ['ramp', [-6, 0, -30], [-2.5, 1.2, -26.5], { rise: '-z', mat: 'grate' }],
      ['ramp', [2.5, 0, -30], [6, 1.2, -26.5], { rise: '-z', mat: 'grate' }],
      ['box', [-6.4, -0.5, -36.5], [6.4, 2.2, -36], { mat: 'hazard', paintable: false }],
      // base flanks
      ['box', [-16, 0, -33], [-11, 2.4, -28.5], { mat: 'concrete' }],
      ['box', [11, 0, -33], [16, 2.4, -28.5], { mat: 'concrete' }],
      // AC units + skylights
      ['box', [-14.5, 0, -25], [-11.5, 1.6, -22], { mat: 'container', color: 0xcfd6dc }],
      ['box', [9.5, 0, -21], [12.5, 1.6, -18], { mat: 'container', color: 0xb9c4cf }],
      ['box', [-4.5, 0, -19], [-1.5, 1.1, -17.4], { mat: 'container', color: 0xd8c3a5 }],
      ['box', [-18, 0, -15], [-14, 0.7, -10], { mat: 'plain', color: 0x9fd3ff }],
      ['box', [3.5, 0, -14], [7.5, 0.7, -10.5], { mat: 'plain', color: 0x9fd3ff }],
      // water tower perch by the east light-well
      ['box', [11, 0, -4.5], [14.5, 4, -1], { mat: 'concreteDark' }],
      ['box', [9.8, 0, -4.5], [11, 1.4, -2.5], { mat: 'wood' }],
      // court access
      ['ramp', [-3, 0, -10.5], [3, 0.9, -7], { rise: '+z', mat: 'floor' }],
      ['ramp', [8, 0, -6], [10.5, 0.9, -1.5], { rise: '-x', mat: 'floor' }],
      ['box', [-6, 0.9, -6.4], [-3, 1.85, -5.8], { mat: 'concreteDark' }],
      // parapets along the roof edge near the bases
      ['box', [-20.5, 0, -36], [-20, 1.0, -18], { mat: 'concreteDark', paintable: false }],
      ['box', [20, 0, -36], [20.5, 1.0, -18], { mat: 'concreteDark', paintable: false }],
      ['box', [-20, 0, -36.5], [-6.4, 1.0, -36], { mat: 'concreteDark', paintable: false }],
      ['box', [6.4, 0, -36.5], [20, 1.0, -36], { mat: 'concreteDark', paintable: false }],
    ],
  },
  // bigger stages (layouts + decor live in ./stages/)
  fizzwater: FIZZWATER,
  mesa: MESA,
  frostbite: FROSTBITE,
};
export const STAGE_IDS = Object.keys(STAGES);
export function stageInfo(id) { return STAGES[id]; }

function mirrorEntry([kind, min, max, opts]) {
  const nmin = [-max[0], min[1], -max[2]], nmax = [-min[0], max[1], -min[2]];
  const o = { ...opts };
  if (o.rise) o.rise = flipRise[o.rise];
  return [kind, nmin, nmax, o];
}

// Collision/paint geometry for a stage definition (no rendering). Also used by
// the node-side layout checks.
export function stageLevel(def, paint) {
  const level = new Level(paint);
  level.killY = def.killY ?? -1.3;
  const add = ([kind, min, max, opts]) => {
    const s = kind === 'ramp' ? level.ramp(min, max, opts.rise, opts) : level.box(min, max, opts);
    if (opts.base) s.isBase = true;
    return s;
  };
  for (const e of def.sym) add(e);
  for (const e of def.mirrored) { add(e); add(mirrorEntry(e)); }
  level.build();
  return level;
}

export function buildStage(id, scene, renderer, env) {
  const def = STAGES[id];
  const paint = new PaintSystem({ size: 2048, tpm: 8 });
  paint.uniforms.uNoise.value = makeNoiseTexture(256);
  const level = stageLevel(def, paint);
  paint.finalize();
  paint.bakeAO((p) => level.sdf(p));
  const mats = levelMaterials(paint);
  level.buildMeshes(mats, scene);

  // spawn points
  const spawns = { 1: [], 2: [] };
  for (let i = 0; i < 4; i++) {
    const x = -3.3 + i * 2.2;
    spawns[1].push(new THREE.Vector3(x, def.spawnY, -def.spawnZ));
    spawns[2].push(new THREE.Vector3(-x, def.spawnY, def.spawnZ));
  }
  const decor = typeof def.decor === 'function' ? def.decor(scene, def, env)
    : def.decor === 'skyline' ? buildSkylineDecor(scene, def, env) : buildTerminalDecor(scene, def, env);
  return { def, paint, level, mats, spawns, decor, name: def.name, bounds: def.half };
}

// ---------------------------------------------------------------------------
function buildTerminalDecor(scene, def, env) {
  const group = new THREE.Group();
  group.name = 'decor';
  scene.add(group);
  const r = rng(42);
  const std = (c, ro = 0.6, me = 0.2, ex = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: ro, metalness: me, ...ex });
  env.addWater(-1.15, def.water);

  // pilings under the stage edge
  const pileGeo = new THREE.CylinderGeometry(0.35, 0.35, 6, 12);
  const pileMat = std(0x5b4a3e, 0.9, 0);
  const piles = new THREE.InstancedMesh(pileGeo, pileMat, 40);
  let k = 0;
  const m4 = new THREE.Matrix4();
  for (let i = 0; i < 10; i++) {
    for (const [x, z] of [[-21.3, -36 + i * 8], [21.3, -36 + i * 8]]) {
      m4.makeTranslation(x, -3, z); piles.setMatrixAt(k++, m4);
    }
  }
  for (let i = 0; i < 10; i++) {
    for (const [x, z] of [[-18 + i * 4, -40.3], [-18 + i * 4, 40.3]]) {
      if (k < 40) { m4.makeTranslation(x, -3, z); piles.setMatrixAt(k++, m4); }
    }
  }
  piles.count = k;
  piles.castShadow = true;
  group.add(piles);

  // spawn pads
  for (const [team, z] of [[1, -def.spawnZ], [2, def.spawnZ]]) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(3.2, 0.12, 8, 48), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    ring.rotation.x = Math.PI / 2;
    ring.position.set(0, def.spawnY + 0.04, z);
    ring.userData.team = team;
    ring.name = 'spawnRing';
    group.add(ring);
    const disc = new THREE.Mesh(new THREE.CircleGeometry(3.1, 48), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.18, depthWrite: false }));
    disc.rotation.x = -Math.PI / 2;
    disc.position.set(0, def.spawnY + 0.03, z);
    disc.userData.team = team;
    disc.name = 'spawnDisc';
    group.add(disc);
  }

  // cranes off-stage
  const craneMat = std(0xff8a1f, 0.5, 0.4), craneDark = std(0x30343f, 0.6, 0.4);
  for (const [x, z, rot] of [[-34, -6, 0.3], [34, 6, Math.PI + 0.3]]) {
    const c = new THREE.Group();
    const legG = new THREE.BoxGeometry(1, 22, 1);
    for (const [lx, lz] of [[-3, -3], [3, -3], [-3, 3], [3, 3]]) {
      const leg = new THREE.Mesh(legG, craneMat); leg.position.set(lx, 10, lz); leg.castShadow = true; c.add(leg);
    }
    const top = new THREE.Mesh(new THREE.BoxGeometry(8, 2.5, 8), craneMat); top.position.y = 22; top.castShadow = true; c.add(top);
    const cab = new THREE.Mesh(new THREE.BoxGeometry(3, 2.4, 3), craneDark); cab.position.set(0, 24.4, 0); c.add(cab);
    const boom = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.4, 44), craneMat); boom.position.set(0, 24, 12); boom.castShadow = true; c.add(boom);
    const cable = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 14, 6), craneDark); cable.position.set(0, 17, 26); c.add(cable);
    const hook = new THREE.Mesh(new THREE.BoxGeometry(2.6, 2.6, 6), std(0x4a6fa5, 0.5, 0.3)); hook.position.set(0, 9, 26); hook.castShadow = true; c.add(hook);
    for (let i = -3; i <= 3; i++) {
      const brace = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.3, 8.5), craneMat);
      brace.position.set(-3, 3 + (i + 3) * 2.6, 0); brace.rotation.x = 0.6 * (i % 2 ? 1 : -1); c.add(brace);
      const b2 = brace.clone(); b2.position.x = 3; c.add(b2);
    }
    c.position.set(x, -1.2, z);
    c.rotation.y = rot;
    group.add(c);
  }

  // off-stage container stacks on a pier
  const contGeo = new THREE.BoxGeometry(2.6, 2.6, 6.2);
  const contCols = [C.navy, C.rust, C.olive, C.cream, C.teal, C.plum];
  for (const side of [-1, 1]) {
    const pier = new THREE.Mesh(new THREE.BoxGeometry(14, 2, 70), std(0x8d8a86, 0.9, 0));
    pier.position.set(side * 44, -0.6, 0); pier.receiveShadow = true; group.add(pier);
    for (let i = 0; i < 18; i++) {
      const mesh = new THREE.Mesh(contGeo, std(contCols[Math.floor(r() * contCols.length)], 0.55, 0.3));
      const col = i % 3, row = Math.floor(i / 3);
      const h = Math.floor(r() * 3) + 1;
      for (let s = 0; s < h; s++) {
        const mm = mesh.clone();
        mm.position.set(side * (40 + col * 3), 0.4 + 1.3 + s * 2.6, -28 + row * 9.5);
        mm.castShadow = true;
        group.add(mm);
      }
    }
  }

  // distant skyline
  const skyline = new THREE.Group();
  const bGeo = new THREE.BoxGeometry(1, 1, 1);
  bGeo.translate(0, 0.5, 0);
  const win = windowTexture(r);
  const bMats = [0xbfc9d9, 0xd9c6b8, 0xaab8c8, 0xc7d3cf, 0xe0d6e8].map((c, i) => {
    const t = win.clone(); t.needsUpdate = true; t.repeat.set(3 + i, 6 + i * 2);
    return std(c, 0.7, 0.1, { map: t });
  });
  for (let i = 0; i < 70; i++) {
    const a = (i / 70) * Math.PI * 2 + r() * 0.05;
    const dist = 190 + r() * 90;
    const w = 12 + r() * 22, h = 18 + Math.pow(r(), 2) * 90, d = 12 + r() * 20;
    const b = new THREE.Mesh(bGeo, bMats[i % bMats.length]);
    b.scale.set(w, h, d);
    b.position.set(Math.cos(a) * dist, -2, Math.sin(a) * dist);
    b.rotation.y = r() * Math.PI;
    skyline.add(b);
  }
  group.add(skyline);

  // lamp posts at corners
  const lampMat = std(0x2d3040, 0.5, 0.6);
  const bulbMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfff2c0, emissiveIntensity: 3 });
  for (const [x, z] of [[-20.5, -20], [20.5, 20], [-20.5, 14], [20.5, -14]]) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 7, 10), lampMat);
    post.position.set(x, 3.5, z); post.castShadow = true; group.add(post);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.15, 1.4), lampMat);
    arm.position.set(x, 7, z + (x < 0 ? 0.6 : -0.6)); group.add(arm);
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.28, 12, 10), bulbMat);
    bulb.position.set(x, 6.8, z + (x < 0 ? 1.2 : -1.2)); group.add(bulb);
  }

  // buoys
  const buoys = [];
  for (let i = 0; i < 10; i++) {
    const b = new THREE.Group();
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.7, 1.4, 14), std(i % 2 ? 0xff4d4d : 0xffffff, 0.5, 0));
    b.add(body);
    const cap = new THREE.Mesh(new THREE.ConeGeometry(0.4, 0.8, 12), std(0xffd23f, 0.5, 0));
    cap.position.y = 1.1; b.add(cap);
    const a = r() * Math.PI * 2;
    b.position.set(Math.cos(a) * (30 + r() * 25), -1.2, Math.sin(a) * (48 + r() * 20));
    b.userData.phase = r() * 6;
    group.add(b);
    buoys.push(b);
  }

  // big stage-name billboard on a pier
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(16, 4), new THREE.MeshBasicMaterial({ map: signTexture(def.name.toUpperCase(), { w: 1024, h: 256, size: 110, accent: '#ff8a1f' }) }));
  sign.position.set(-44, 9, 0);
  sign.rotation.y = Math.PI / 2;
  group.add(sign);
  const sign2 = sign.clone();
  sign2.position.set(44, 9, 0);
  sign2.rotation.y = -Math.PI / 2;
  group.add(sign2);
  for (const sg of [sign, sign2]) {
    const back = new THREE.Mesh(new THREE.BoxGeometry(0.4, 4.6, 16.6), std(0x2d3040));
    back.position.copy(sg.position).add(new THREE.Vector3(sg.position.x < 0 ? -0.25 : 0.25, 0, 0));
    group.add(back);
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.4, 9, 0.4), std(0x2d3040));
    leg.position.copy(sg.position).setY(2.5);
    group.add(leg);
  }

  return {
    group,
    update(t) {
      for (const b of buoys) {
        b.position.y = -1.3 + Math.sin(t * 1.3 + b.userData.phase) * 0.15;
        b.rotation.z = Math.sin(t * 0.9 + b.userData.phase) * 0.12;
      }
    },
    setTeamColors(a, b) {
      group.traverse((o) => {
        if ((o.name === 'spawnRing' || o.name === 'spawnDisc') && o.material) {
          o.material.color.set(o.userData.team === 1 ? a : b).multiplyScalar(o.name === 'spawnRing' ? 2.5 : 1);
        }
      });
    },
  };
}

// ---------------------------------------------------------------------------
function buildSkylineDecor(scene, def, env) {
  const group = new THREE.Group();
  scene.add(group);
  const r = rng(77);
  const std = (c, ro = 0.6, me = 0.1, ex = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: ro, metalness: me, ...ex });
  // the building we're standing on, falling away to the street
  const facadeCanvas = (() => {
    const c = document.createElement('canvas'); c.width = 256; c.height = 256;
    const x = c.getContext('2d');
    x.fillStyle = '#d9c7b8'; x.fillRect(0, 0, 256, 256);
    for (let j = 0; j < 4; j++) for (let i = 0; i < 4; i++) {
      x.fillStyle = r() < 0.35 ? '#ffd79a' : '#3b4a66';
      x.fillRect(i * 64 + 12, j * 64 + 14, 40, 38);
      x.fillStyle = 'rgba(255,255,255,.5)'; x.fillRect(i * 64 + 10, j * 64 + 52, 44, 4);
    }
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8;
    return t;
  })();
  const facadeMat = (tint, rep) => {
    const t = facadeCanvas.clone(); t.needsUpdate = true; t.repeat.set(rep[0], rep[1]);
    return std(tint, 0.75, 0.05, { map: t, emissive: 0x3a2a10, emissiveMap: t, emissiveIntensity: 0.25 });
  };
  const base = new THREE.Mesh(new THREE.BoxGeometry(41.6, 70, 73.6), facadeMat(0xffffff, [8, 14]));
  base.position.set(0, -41.05, 0);
  base.receiveShadow = true;
  group.add(base);
  const street = new THREE.Mesh(new THREE.PlaneGeometry(1200, 1200), std(0x6d6a78, 1, 0));
  street.rotation.x = -Math.PI / 2; street.position.y = -76; group.add(street);
  // neighbouring towers
  const tints = [0xffe3d1, 0xd6e4ff, 0xffd6ea, 0xe0ffd9, 0xfff1c4, 0xe6dcff];
  const boxG = new THREE.BoxGeometry(1, 1, 1);
  for (let i = 0; i < 26; i++) {
    const a = (i / 26) * Math.PI * 2 + r() * 0.12;
    const d = 48 + r() * 60;
    const w = 14 + r() * 14, dd = 14 + r() * 14, h = 60 + r() * 70;
    const m = new THREE.Mesh(boxG, facadeMat(tints[i % tints.length], [w / 6, h / 6]));
    m.scale.set(w, h, dd);
    m.position.set(Math.cos(a) * d, -76 + h / 2, Math.sin(a) * d * 1.25);
    m.castShadow = false; m.receiveShadow = true;
    group.add(m);
    // rooftop clutter
    const top = -76 + h;
    if (r() < 0.6) {
      const tank = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.6, 2.8, 14), std(0x8a5a3c, 0.85, 0));
      tank.position.set(m.position.x, top + 3.4, m.position.z); group.add(tank);
      const roof = new THREE.Mesh(new THREE.ConeGeometry(1.75, 1.1, 14), std(0x5a3a2c, 0.8, 0));
      roof.position.set(m.position.x, top + 5.3, m.position.z); group.add(roof);
      for (const [lx, lz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
        const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 2.2, 6), std(0x2b2f45)); leg.position.set(m.position.x + lx, top + 1.1, m.position.z + lz); group.add(leg);
      }
    } else if (r() < 0.5) {
      const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.3, 12, 6), std(0x2b2f45, 0.4, 0.6));
      ant.position.set(m.position.x, top + 6, m.position.z); group.add(ant);
      const blink = new THREE.Mesh(new THREE.SphereGeometry(0.4, 8, 6), new THREE.MeshBasicMaterial({ color: 0xff3030 }));
      blink.position.set(m.position.x, top + 12.2, m.position.z); blink.name = 'blink'; group.add(blink);
    }
  }
  // our own rooftop water tower (on the perches)
  for (const s of [1, -1]) {
    const x = 12.75 * s, z = -2.75 * s;
    const tank = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.5, 2.6, 18), std(0x9a6a48, 0.8, 0));
    tank.position.set(x + 6 * s, 6.5, z); tank.castShadow = true; group.add(tank);
    const roof = new THREE.Mesh(new THREE.ConeGeometry(1.65, 1.0, 18), std(0x5a3a2c, 0.8, 0));
    roof.position.set(x + 6 * s, 8.3, z); roof.castShadow = true; group.add(roof);
    for (const [lx, lz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 5.2, 6), std(0x2b2f45));
      leg.position.set(x + 6 * s + lx, 2.6, z + lz); leg.castShadow = true; group.add(leg);
    }
  }
  // basketball hoops on the court ends
  for (const s of [1, -1]) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 3.2, 8), std(0x2b2f45, 0.4, 0.6));
    pole.position.set(0, 2.5, 6.6 * s); group.add(pole);
    const board = new THREE.Mesh(new THREE.BoxGeometry(1.8, 1.1, 0.08), std(0xffffff, 0.3, 0.1));
    board.position.set(0, 4.2, 6.4 * s); group.add(board);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.03, 6, 16), std(0xff6a1f, 0.4, 0.4));
    rim.rotation.x = Math.PI / 2; rim.position.set(0, 3.75, 6.05 * s); group.add(rim);
  }
  // string lights over the court
  const bulbMat = new THREE.MeshStandardMaterial({ color: 0xffe2a8, emissive: 0xffe2a8, emissiveIntensity: 5 });
  const bulbG = new THREE.SphereGeometry(0.1, 8, 6);
  for (const x of [-8, 8]) {
    const pts = [];
    for (let i = 0; i <= 20; i++) { const t = i / 20; pts.push(new THREE.Vector3(x * (0.9 - Math.sin(t * Math.PI) * 0.05), 5.32 - Math.sin(t * Math.PI) * 0.9, -7 + t * 14)); }
    group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: 0x2b2f45 })));
    for (let i = 0; i <= 20; i++) {
      const t = i / 20;
      const z = -7 + t * 14;
      const b = new THREE.Mesh(bulbG, bulbMat);
      b.position.set(x * (0.9 - Math.sin(t * Math.PI) * 0.05), 5.2 - Math.sin(t * Math.PI) * 0.9, z);
      group.add(b);
    }
  }
  for (const [x, z] of [[-8, -7], [8, -7], [-8, 7], [8, 7]]) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 5.2, 8), std(0x2b2f45, 0.4, 0.6));
    post.position.set(x, 2.6 + 0.9, z); group.add(post);
  }
  // spawn pads
  for (const [team, z] of [[1, -def.spawnZ], [2, def.spawnZ]]) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(3.0, 0.12, 8, 48), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    ring.rotation.x = Math.PI / 2; ring.position.set(0, def.spawnY + 0.04, z);
    ring.userData.team = team; ring.name = 'spawnRing'; group.add(ring);
  }
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(18, 4.5), new THREE.MeshBasicMaterial({ map: signTexture(def.name.toUpperCase(), { w: 1024, h: 256, size: 120, accent: '#ff2e88' }) }));
  sign.position.set(-36, 14, 0); sign.rotation.y = Math.PI / 2; group.add(sign);
  const sign2 = sign.clone(); sign2.position.set(36, 14, 0); sign2.rotation.y = -Math.PI / 2; group.add(sign2);
  const blinks = [];
  group.traverse((o) => { if (o.name === 'blink') blinks.push(o); });
  return {
    group,
    update(t) { const on = Math.sin(t * 3) > 0.3; for (const b of blinks) b.visible = on; },
    setTeamColors(a, b) {
      group.traverse((o) => { if (o.name === 'spawnRing') o.material.color.set(o.userData.team === 1 ? a : b).multiplyScalar(2.5); });
    },
  };
}

function windowTexture(r) {
  const c = document.createElement('canvas'); c.width = 128; c.height = 128;
  const x = c.getContext('2d');
  x.fillStyle = '#f4f1ec'; x.fillRect(0, 0, 128, 128);
  for (let j = 0; j < 4; j++) for (let i = 0; i < 4; i++) {
    x.fillStyle = r() < 0.25 ? '#9fc4e8' : '#6f8cb0';
    x.fillRect(i * 32 + 6, j * 32 + 7, 20, 19);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 4;
  return t;
}
