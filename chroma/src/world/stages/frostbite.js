// Frostbite Park: a winter skate park on a frozen lake shore.
import * as THREE from 'three';
import { rng } from '../../util.js';
import { decorGroup, spawnPads, setTeamColors, std, instanced, nameBoard, canvasTex, allEntries, edgePoints } from './common.js';

const K = {
  snow: 0xf4f8ff, ice: 0xcfe9f7, park: 0xe6ecf2, deck: 0xd3e0ee, ramp: 0xb3d2ec, bowl: 0x9fc4e4, dark: 0x9aa6b8, hut: 0xc85a4a, lift: 0x5c87b8,
};

export const FROSTBITE = {
  name: 'Frostbite Park',
  sky: {
    zenith: 0x3f78c8, horizon: 0xd8ecfa, ground: 0x7d93a8, sun: 0xfff4ea, sunDir: [0.5, 0.42, -0.36],
    cloud: 0xffffff, cloudShade: 0xaebdd6, clouds: 0.7, sunI: 3.8, hemiSky: 0xdcecff, hemiGround: 0x8796a8, hemiI: 0.45,
    fog: 0xd9e9f6, fogD: 0.0036,
  },
  water: 0x1d4560,
  killY: -1.3,
  half: { minX: -28, maxX: 28, minZ: -56, maxZ: 56 },
  spawnZ: 52, spawnY: 1.6,
  // Zone Clash rects [x0,z0,x1,z1,y], Hue Hoops pad for team A's hoop + tip-off spot
  modes: { zones: [[-6, -15, 6, -9.5, 0], [-6, 9.5, 6, 15, 0]], hoop: { x: 0, z: -40, y: 0, r: 3.6 }, tip: [-2.5, 2.0, -2.0] },
  sym: [
    ['box', [-22, -3, -14], [22, 0, 14], { mat: 'plain', color: K.ice }],
    // central funbox + grind box
    ['box', [-4, 0, -4], [4, 2.0, 4], { mat: 'concrete', color: K.deck }],
    ['box', [-0.6, 2.0, -2.5], [0.6, 2.5, 2.5], { mat: 'concreteDark' }],
  ],
  mirrored: [
    // lake-shore slabs
    ['box', [-18, -3, -56], [18, 0, -40], { mat: 'floor', color: K.snow }],
    ['box', [-26, -3, -40], [26, 0, -14], { mat: 'concrete', color: K.park }],
    ['box', [-28, -3, -14], [-22, 0, 4], { mat: 'plain', color: K.ice }],
    // spawn deck
    ['box', [-7, 0, -56], [7, 1.6, -48], { mat: 'grate', base: true }],
    ['ramp', [-7, 0, -48], [-3.5, 1.6, -44.5], { rise: '-z', mat: 'grate' }],
    ['ramp', [3.5, 0, -48], [7, 1.6, -44.5], { rise: '-z', mat: 'grate' }],
    ['box', [-7.4, -1.2, -56.4], [7.4, 2.6, -56], { mat: 'hazard', paintable: false }],
    ['box', [-18.4, -1.2, -56], [-18, 0.9, -40], { mat: 'hazard', paintable: false }],
    ['box', [18, -1.2, -56], [18.4, 0.9, -40], { mat: 'hazard', paintable: false }],
    // warming hut + stair set to its roof
    ['box', [-17, 0, -54], [-11, 2.6, -48], { mat: 'wood', color: K.hut }],
    ['box', [-11, 0, -46], [-8.5, 0.5, -44.8], { mat: 'concrete', color: K.deck }],
    ['box', [-11, 0, -47.2], [-8.5, 1.0, -46], { mat: 'concrete', color: K.deck }],
    ['box', [-11, 0, -48.4], [-8.5, 1.5, -47.2], { mat: 'concrete', color: K.deck }],
    ['box', [-11, 0, -49.6], [-8.5, 2.0, -48.4], { mat: 'concrete', color: K.deck }],
    ['box', [-11, 0, -52], [-8.5, 2.5, -49.6], { mat: 'concrete', color: K.deck }],
    // judges' tower (east of spawn)
    ['box', [12, 0, -54], [17, 3.0, -49], { mat: 'concreteDark' }],
    ['box', [11, 0, -49], [12.5, 1.0, -47.5], { mat: 'wood' }],
    ['box', [12.5, 0, -49], [14, 2.0, -47.5], { mat: 'wood' }],
    // the bowl (open to the east)
    ['ramp', [-20, 0, -35.5], [-12, 1.6, -32], { rise: '-z', mat: 'concrete', color: K.bowl }],
    ['ramp', [-20, 0, -26], [-12, 1.6, -22.5], { rise: '+z', mat: 'concrete', color: K.bowl }],
    ['ramp', [-23.5, 0, -32], [-20, 1.6, -26], { rise: '-x', mat: 'concrete', color: K.bowl }],
    ['box', [-23.5, 0, -35.5], [-20, 1.6, -32], { mat: 'concrete', color: K.bowl }],
    ['box', [-23.5, 0, -26], [-20, 1.6, -22.5], { mat: 'concrete', color: K.bowl }],
    // quarter pipe + deck by the east shore
    ['ramp', [17, 0, -34], [21, 1.6, -24], { rise: '+x', mat: 'concrete', color: K.ramp }],
    ['box', [21, 0, -34], [26, 1.6, -24], { mat: 'concrete', color: K.deck }],
    ['box', [23.5, 1.6, -33], [26, 2.6, -30], { mat: 'wood' }],
    // grind ledges + snow banks
    ['box', [-6, 0, -30], [2, 0.5, -29.3], { mat: 'concreteDark' }],
    ['box', [4, 0, -38], [10, 0.5, -37.3], { mat: 'concreteDark' }],
    ['box', [6, 0, -22], [10, 1.2, -20.5], { mat: 'plain', color: K.snow }],
    ['box', [-8, 0, -18], [-4, 1.0, -16.8], { mat: 'plain', color: K.snow }],
    // spine
    ['ramp', [-17.2, 0, -18], [-15, 1.0, -8], { rise: '+x', mat: 'concrete', color: K.ramp }],
    ['ramp', [-15, 0, -18], [-12.8, 1.0, -8], { rise: '-x', mat: 'concrete', color: K.ramp }],
    // funbox ramps
    ['ramp', [-4, 0, -8.5], [4, 2.0, -4], { rise: '+z', mat: 'concrete', color: K.ramp }],
    ['ramp', [4, 0, -4], [8.5, 2.0, 4], { rise: '-x', mat: 'concrete', color: K.ramp }],
    // picnic deck
    ['box', [14, 0, -12], [20, 1.0, -6], { mat: 'wood' }],
    // lift station perch on the west ice ledge, reached by a stair set
    ['box', [-28, 0, -12], [-23, 3.2, -6], { mat: 'concrete', color: K.lift }],
    ['box', [-28, 0, -1.5], [-25.5, 0.5, -0.6], { mat: 'concreteDark' }],
    ['box', [-28, 0, -2.4], [-25.5, 1.0, -1.5], { mat: 'concreteDark' }],
    ['box', [-28, 0, -3.3], [-25.5, 1.5, -2.4], { mat: 'concreteDark' }],
    ['box', [-28, 0, -4.2], [-25.5, 2.0, -3.3], { mat: 'concreteDark' }],
    ['box', [-28, 0, -5.1], [-25.5, 2.5, -4.2], { mat: 'concreteDark' }],
    ['box', [-28, 0, -6], [-25.5, 3.0, -5.1], { mat: 'concreteDark' }],
    // ledge platform in the middle lane
    ['box', [-3, 0, -27], [5, 1.4, -24], { mat: 'concrete', color: K.deck }],
    ['ramp', [5, 0, -27], [8.5, 1.4, -24], { rise: '-x', mat: 'concrete', color: K.ramp }],
    ['box', [-4.2, 0, -26.2], [-3, 0.7, -24.8], { mat: 'concreteDark' }],
    // rink rails, kicker and snow banks
    ['box', [-12, 0, -6], [-11.4, 0.5, 2], { mat: 'concreteDark' }],
    ['ramp', [10, 0, -12], [13, 0.8, -9], { rise: '+x', mat: 'concrete', color: K.ramp }],
    ['box', [-10, 0, -12], [-7, 1.2, -10.8], { mat: 'plain', color: K.snow }],
  ],
  decor: buildFrostbiteDecor,
};

// ---------------------------------------------------------------------------
function pineGeometry() {
  // three stacked cones + a snow cap, merged by hand (one draw call per forest)
  const parts = [[2.2, 3.2, 1.6], [1.7, 2.8, 3.4], [1.1, 2.4, 5.0]];
  const pos = [], col = [];
  const green = new THREE.Color(0x2f5d4a), snow = new THREE.Color(0xf2f7ff);
  for (const [rad, h, y] of parts) {
    const g = new THREE.ConeGeometry(rad, h, 9, 1, true).toNonIndexed();
    g.translate(0, y, 0);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      pos.push(p.getX(i), p.getY(i), p.getZ(i));
      const c = p.getY(i) > y + h * 0.18 ? snow : green;
      col.push(c.r, c.g, c.b);
    }
  }
  const trunk = new THREE.CylinderGeometry(0.25, 0.32, 1.6, 6).toNonIndexed();
  trunk.translate(0, 0.8, 0);
  const tp = trunk.attributes.position, brown = new THREE.Color(0x5a3c2c);
  for (let i = 0; i < tp.count; i++) { pos.push(tp.getX(i), tp.getY(i), tp.getZ(i)); col.push(brown.r, brown.g, brown.b); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.computeVertexNormals();
  return g;
}

function buildFrostbiteDecor(scene, def, env) {
  const group = decorGroup(scene);
  const r = rng(1203);
  const anim = [];
  env.addWater(-1.15, def.water);
  spawnPads(group, def);
  const entries = allEntries(def);
  const boxGeo = new THREE.BoxGeometry(1, 1, 1);
  const snowMat = std(0xf4f8ff, 0.9, 0);
  const iceMat = std(0xcfeaf7, 0.15, 0.05, { envMapIntensity: 1.3 });
  const metal = std(0xb8c2cc, 0.3, 0.85);
  const dark = std(0x2b3140, 0.6, 0.4);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), v = new THREE.Vector3(), s3 = new THREE.Vector3();

  // ---- icicles hanging off every slab edge into the dark water
  const edges = edgePoints(def, { spacing: 0.9 });
  const icicles = edges.filter(() => r() < 0.75).map((e) => {
    const L = 0.3 + r() * 0.9;
    const j = (r() - 0.5) * 0.6;
    return { p: [e.x + e.nx * 0.08 + e.nz * j, -0.02 - L / 2, e.z + e.nz * 0.08 + e.nx * j], s: [1, L, 1], rx: Math.PI };
  });
  instanced(group, new THREE.ConeGeometry(0.09, 1, 5), iceMat, icicles);
  // snow lips along the slab edges
  const lipItems = edgePoints(def, { spacing: 2.2 }).map((e) => ({ p: [e.x + e.nx * 0.05, -0.05, e.z + e.nz * 0.05], s: [e.nx ? 0.35 : 2.3, 0.28, e.nz ? 0.35 : 2.3] }));
  instanced(group, boxGeo, snowMat, lipItems);

  // ---- coping rails on the skate ramps that meet a deck
  const copings = [];
  for (const e of entries) {
    if (e.kind !== 'ramp' || e.opts.mat !== 'concrete') continue;
    const [x0, , z0] = e.min, [x1, y1, z1] = e.max;
    const rise = e.opts.rise;
    if (rise === '+z' || rise === '-z') copings.push({ p: [(x0 + x1) / 2, y1 + 0.02, rise === '+z' ? z1 : z0], rz: Math.PI / 2, s: [1, x1 - x0, 1] });
    else copings.push({ p: [rise === '+x' ? x1 : x0, y1 + 0.02, (z0 + z1) / 2], rx: Math.PI / 2, s: [1, z1 - z0, 1] });
  }
  instanced(group, new THREE.CylinderGeometry(0.07, 0.07, 1, 8), metal, copings);

  // ---- warming huts: chimney + smoke, snow trim on the roof
  const huts = entries.filter((e) => e.opts.color === K.hut);
  for (const h of huts) {
    const [x0, , z0] = h.min, [x1, y1, z1] = h.max;
    const back = z0 < 0 ? z0 - 0.45 : z1 + 0.45;
    const cx = x0 < 0 ? x0 + 1.4 : x1 - 1.4;
    const chim = new THREE.Mesh(new THREE.BoxGeometry(0.9, y1 + 1.8, 0.9), std(0x8a5a48, 0.9, 0));
    chim.position.set(cx, (y1 + 1.8) / 2, back); chim.castShadow = true; group.add(chim);
    const puffMat = new THREE.MeshStandardMaterial({ color: 0xe8eef4, roughness: 1, transparent: true, opacity: 0.75, depthWrite: false });
    const puffs = [];
    for (let i = 0; i < 5; i++) { const p = new THREE.Mesh(new THREE.SphereGeometry(0.5, 10, 8), puffMat); group.add(p); puffs.push(p); }
    anim.push((t) => puffs.forEach((p, i) => {
      const k = (t * 0.22 + i / puffs.length) % 1;
      p.position.set(cx + k * 1.5, y1 + 2 + k * 5, back + Math.sin(t + i) * 0.3);
      p.scale.setScalar(0.4 + k * 2.2);
      p.visible = k < 0.95;
    }));
    // snow trim on the roof edges and a glowing window on the side facing the middle
    const w = x1 - x0, d = z1 - z0;
    for (const [px, pz, sx, sz] of [[(x0 + x1) / 2, z0 - 0.08, w + 0.3, 0.3], [(x0 + x1) / 2, z1 + 0.08, w + 0.3, 0.3], [x0 - 0.08, (z0 + z1) / 2, 0.3, d], [x1 + 0.08, (z0 + z1) / 2, 0.3, d]]) {
      const trim = new THREE.Mesh(boxGeo, snowMat);
      trim.scale.set(sx, 0.3, sz); trim.position.set(px, y1 + 0.02, pz); group.add(trim);
    }
  }

  // ---- lamp posts + string lights along the shore edges
  const lampSpots = edgePoints(def, { spacing: 3 }).filter((_, i) => i % 6 === 2).map((e) => ({ x: e.x + e.nx * 0.45, z: e.z + e.nz * 0.45, nx: e.nx, nz: e.nz }));
  instanced(group, new THREE.CylinderGeometry(0.09, 0.12, 5.6, 8), dark, lampSpots.map((p) => ({ p: [p.x, 1.7, p.z] })));
  instanced(group, new THREE.SphereGeometry(0.26, 10, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(2.6, 2.3, 1.7) }), lampSpots.map((p) => ({ p: [p.x, 4.6, p.z] })));
  const linePos = [], bulbs = [];
  for (let i = 0; i < lampSpots.length; i++) for (let j = i + 1; j < lampSpots.length; j++) {
    const a = lampSpots[i], b = lampSpots[j];
    const d = Math.hypot(a.x - b.x, a.z - b.z);
    if (d < 8 || d > 22 || a.nx !== b.nx || a.nz !== b.nz) continue;
    const n = Math.floor(d / 1.2);
    let prev = null;
    for (let k = 0; k <= n; k++) {
      const t = k / n;
      const p = [a.x + (b.x - a.x) * t, 4.4 - Math.sin(t * Math.PI) * 1.2, a.z + (b.z - a.z) * t];
      if (prev) linePos.push(...prev, ...p);
      prev = p;
      if (k > 0 && k < n) bulbs.push({ p: [p[0], p[1] - 0.12, p[2]], c: [0xffe0a0, 0x9fe0ff, 0xff9fb8, 0xb8ffb0][k % 4] });
    }
  }
  const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.Float32BufferAttribute(linePos, 3));
  group.add(new THREE.LineSegments(lg, new THREE.LineBasicMaterial({ color: 0x2b3140 })));
  const bulbMesh = instanced(group, new THREE.SphereGeometry(0.1, 8, 6), new THREE.MeshBasicMaterial({ color: new THREE.Color(2.4, 2.4, 2.4) }), bulbs);
  anim.push((t) => { if (bulbMesh) bulbMesh.material.color.setScalar(2.0 + Math.sin(t * 2.2) * 0.5); });

  // ---- ice floes drifting on the dark water
  const floes = [];
  const hb = def.half;
  while (floes.length < 40) {
    const a = r() * Math.PI * 2, d = 36 + r() * 70;
    const f = { x: Math.cos(a) * d, z: Math.sin(a) * d * 1.35, s: 1.5 + r() * 4, ry: r() * 6, ph: r() * 6 };
    if (Math.abs(f.x) < hb.maxX + 5 + f.s && Math.abs(f.z) < hb.maxZ + 5 + f.s) continue; // keep clear of the park
    floes.push(f);
  }
  const floeMesh = new THREE.InstancedMesh(new THREE.CylinderGeometry(1, 1.1, 0.5, 7), std(0xeaf6ff, 0.35, 0), floes.length);
  group.add(floeMesh);
  anim.push((t) => {
    floes.forEach((f, i) => {
      q.setFromAxisAngle(v.set(0, 1, 0), f.ry + t * 0.01);
      v.set(f.x + Math.sin(t * 0.05 + f.ph) * 2, -1.12 + Math.sin(t * 0.9 + f.ph) * 0.06, f.z);
      floeMesh.setMatrixAt(i, m4.compose(v, q, s3.set(f.s, 1, f.s * 0.8)));
    });
    floeMesh.instanceMatrix.needsUpdate = true;
  });

  // ---- snowy shore ring with pine forest, cabins and mountains
  const shore = [];
  for (let i = 0; i < 22; i++) {
    const a = (i / 22) * Math.PI * 2;
    const d = 130 + r() * 30;
    shore.push({ p: [Math.cos(a) * d, -1.6, Math.sin(a) * d * 1.25], s: [60 + r() * 30, 3, 40 + r() * 20], ry: -a });
  }
  instanced(group, new THREE.CylinderGeometry(0.5, 0.6, 1, 10), snowMat, shore, { receive: true });
  const pines = [];
  for (let i = 0; i < 260; i++) {
    const a = r() * Math.PI * 2, d = 128 + r() * 50;
    const s = 1.2 + r() * 1.6;
    pines.push({ p: [Math.cos(a) * d, -0.2, Math.sin(a) * d * 1.25], s, ry: r() * 6 });
  }
  instanced(group, pineGeometry(), std(0xffffff, 0.85, 0, { vertexColors: true }), pines);
  const cabins = [];
  for (let i = 0; i < 10; i++) {
    const a = r() * Math.PI * 2, d = 120 + r() * 10;
    cabins.push({ p: [Math.cos(a) * d, 1.4, Math.sin(a) * d * 1.25], s: [6, 4, 5], ry: -a, c: [0xc85a4a, 0x7a5a48, 0x4a6fa5][i % 3] });
  }
  instanced(group, boxGeo, std(0xffffff, 0.85, 0), cabins);
  instanced(group, new THREE.ConeGeometry(4.6, 2.6, 4), snowMat, cabins.map((c) => ({ p: [c.p[0], 4.6, c.p[2]], ry: c.ry + Math.PI / 4, s: [1, 1, 0.8] })));
  const mtn = [], caps = [];
  for (let i = 0; i < 18; i++) {
    const a = (i / 18) * Math.PI * 2 + r() * 0.2;
    const d = 380 + r() * 160, h = 90 + r() * 140, w = 90 + r() * 80;
    mtn.push({ p: [Math.cos(a) * d, -2 + h / 2, Math.sin(a) * d], s: [w, h, w], ry: r() * 6 });
    caps.push({ p: [Math.cos(a) * d, -2 + h * 0.82, Math.sin(a) * d], s: [w * 0.37, h * 0.37, w * 0.37], ry: r() * 6 });
  }
  instanced(group, new THREE.ConeGeometry(0.5, 1, 7), std(0x6f8299, 0.95, 0, { flatShading: true }), mtn);
  instanced(group, new THREE.ConeGeometry(0.505, 1, 7), std(0xf4f8ff, 0.8, 0, { flatShading: true }), caps);

  // ---- ski lift climbing a far slope
  const liftA = new THREE.Vector3(150, 2, -120), liftB = new THREE.Vector3(250, 95, -300);
  const towerPts = [];
  for (let i = 0; i <= 8; i++) towerPts.push(liftA.clone().lerp(liftB, i / 8));
  instanced(group, boxGeo, dark, towerPts.map((p) => ({ p: [p.x, p.y - 4, p.z], s: [0.8, 12, 0.8] })));
  const cable = new THREE.BufferGeometry().setFromPoints([liftA.clone().setY(liftA.y + 2), liftB.clone().setY(liftB.y + 2)]);
  group.add(new THREE.Line(cable, new THREE.LineBasicMaterial({ color: 0x2b3140 })));
  const nChairs = 18;
  const chairs = new THREE.InstancedMesh(new THREE.BoxGeometry(2, 1.6, 1.4), std(0xe5483c, 0.6, 0.2), nChairs);
  group.add(chairs);
  const dir = liftB.clone().sub(liftA);
  anim.push((t) => {
    for (let i = 0; i < nChairs; i++) {
      const k = (i / nChairs + t * 0.01) % 1;
      v.copy(liftA).addScaledVector(dir, k);
      v.y += 0.6;
      chairs.setMatrixAt(i, m4.makeTranslation(v.x, v.y, v.z));
    }
    chairs.instanceMatrix.needsUpdate = true;
  });

  // ---- islands behind each base with the park sign and snowmen
  for (const side of [-1, 1]) {
    const isl = new THREE.Mesh(new THREE.CylinderGeometry(16, 18, 3, 12), snowMat);
    isl.position.set(0, -1.6, side * 82); group.add(isl);
    const board = nameBoard(def.name, { w: 20, h: 5, accent: '#5fc8ff', bg: '#1d2b4a', fg: '#eaf6ff', frame: 0x2b3140, legH: 4, size: 96 });
    board.position.set(0, -0.1, side * 78);
    board.rotation.y = side < 0 ? 0 : Math.PI;
    group.add(board);
    instanced(group, pineGeometry(), std(0xffffff, 0.85, 0, { vertexColors: true }), [[-11, 4], [11, 3], [-7, 9], [8, 10], [0, 12]].map(([x, z]) => ({ p: [x, -0.1, side * (82 + z * 0.6)], s: 1.1 + r() * 0.5 })));
  }
  const snowmen = [[-9, 0, -76], [9, 0, 76], [60, -0.6, -40], [-60, -0.6, 40]];
  for (const [x, y, z] of snowmen) {
    const sm = new THREE.Group();
    for (const [rad, hy] of [[0.9, 0.8], [0.65, 2.0], [0.45, 2.9]]) { const b = new THREE.Mesh(new THREE.SphereGeometry(rad, 14, 10), snowMat); b.position.y = hy; sm.add(b); }
    const nose = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.45, 6), std(0xff8a1f, 0.6, 0)); nose.rotation.x = Math.PI / 2; nose.position.set(0, 2.95, 0.55); sm.add(nose);
    const hat = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.5, 12), dark); hat.position.y = 3.5; sm.add(hat);
    const scarf = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.1, 6, 14), std(0xe5483c, 0.8, 0)); scarf.rotation.x = Math.PI / 2; scarf.position.y = 2.45; sm.add(scarf);
    sm.position.set(x, y, z);
    sm.lookAt(0, y, 0);
    group.add(sm);
  }

  // ---- falling snow around the park
  const N = 1800;
  const sp = new Float32Array(N * 3), seeds = new Float32Array(N);
  for (let i = 0; i < N; i++) { sp[i * 3] = (r() - 0.5) * 140; sp[i * 3 + 1] = r() * 40; sp[i * 3 + 2] = (r() - 0.5) * 180; seeds[i] = r() * 6; }
  const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(sp, 3));
  const flake = canvasTex(32, 32, (x) => { const g = x.createRadialGradient(16, 16, 0, 16, 16, 16); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.5, 'rgba(255,255,255,.8)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 32, 32); }, { repeat: false });
  const snowPts = new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xffffff, size: 0.3, map: flake, transparent: true, opacity: 0.95, depthWrite: false }));
  snowPts.frustumCulled = false;
  group.add(snowPts);
  let lastT = null;
  anim.push((t) => {
    const dt = lastT === null ? 0 : Math.min(0.1, Math.max(0, t - lastT));
    lastT = t;
    for (let i = 0; i < N; i++) {
      let y = sp[i * 3 + 1] - dt * (1.2 + (seeds[i] % 1) * 0.8);
      if (y < -1.2) y += 41;
      sp[i * 3 + 1] = y;
      sp[i * 3] += Math.sin(t * 0.7 + seeds[i]) * dt * 0.4;
    }
    sg.attributes.position.needsUpdate = true;
  });

  return {
    group,
    update(t) { for (const f of anim) f(t); },
    setTeamColors: (a, b) => setTeamColors(group, a, b),
  };
}
