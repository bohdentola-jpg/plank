// Mesa Bazaar: a desert market climbing terraces on a mesa top at dusk.
import * as THREE from 'three';
import { rng } from '../../util.js';
import { decorGroup, spawnPads, setTeamColors, std, instanced, nameBoard, canvasTex, allEntries, edgePoints } from './common.js';

const K = {
  sand: 0xf4e6d2, sand2: 0xefe2cf, stone: 0xe6d4bb, band: 0xe0ccb0, clay: 0xc9754e, adobe: 0xf8eedf, adobe2: 0xf1e0c8, dark: 0x8a6a5a,
  teal: 0x4fa6a0, lapis: 0x6aa6dc, tile: 0xdcecee,
};

export const MESA = {
  name: 'Mesa Bazaar',
  sky: {
    zenith: 0x28337f, horizon: 0xff9e6a, ground: 0x5d4250, sun: 0xffc08f, sunDir: [-0.62, 0.22, 0.42],
    cloud: 0xffd9b8, cloudShade: 0xa85a7a, clouds: 0.6, sunI: 3.4, hemiSky: 0xe2c4dc, hemiGround: 0x6b4a4a, hemiI: 0.5,
    fog: 0xd8a2a0, fogD: 0.0024,
  },
  killY: -8,
  half: { minX: -30, maxX: 30, minZ: -58, maxZ: 58 },
  spawnZ: 54.5, spawnY: 2.0,
  // Zone Clash rects [x0,z0,x1,z1,y], Hue Hoops pad for team A's hoop + tip-off spot
  modes: { zones: [[-7.5, -6, 7.5, 6, 3.5]], hoop: { x: -2, z: -42, y: 0, r: 3.6 }, tip: [-5.5, 3.5, -3] },
  sym: [
    ['box', [-24, -4, -22], [24, 0, 22], { mat: 'tiles', color: K.tile }],
    // the big central terrace, a dais and the sun obelisk
    ['box', [-12, 0, -12], [12, 3.5, 12], { mat: 'concrete', color: K.sand2 }],
    ['box', [-3, 3.5, -3], [3, 4.5, 3], { mat: 'tiles', color: K.tile }],
    ['box', [-0.8, 4.5, -0.8], [0.8, 9, 0.8], { mat: 'concreteDark', color: K.lapis }],
  ],
  mirrored: [
    // mesa-top slabs (void beyond)
    ['box', [-18, -4, -58], [18, 0, -44], { mat: 'floor', color: K.sand }],
    ['box', [-26, -4, -44], [26, 0, -22], { mat: 'floor', color: K.sand }],
    ['box', [-30, -4, -22], [-24, 0, -6], { mat: 'floor', color: K.sand }],
    // spawn deck
    ['box', [-7, 0, -58], [7, 2.0, -50], { mat: 'wood', base: true }],
    ['ramp', [-7, 0, -50], [-3.5, 2.0, -45.5], { rise: '-z', mat: 'wood' }],
    ['ramp', [3.5, 0, -50], [7, 2.0, -45.5], { rise: '-z', mat: 'wood' }],
    ['box', [-7.4, -4, -58.4], [7.4, 2.9, -58], { mat: 'concreteDark', color: K.dark, paintable: false }],
    ['box', [-18.4, -4, -58], [-18, 0.9, -44], { mat: 'concreteDark', color: K.dark, paintable: false }],
    ['box', [18, -4, -58], [18.4, 0.9, -44], { mat: 'concreteDark', color: K.dark, paintable: false }],
    // gate towers either side of spawn
    ['box', [-17, 0, -57], [-11, 3.0, -51], { mat: 'concrete', color: K.stone }],
    ['ramp', [-17, 0, -51], [-13, 3.0, -44.5], { rise: '-z', mat: 'concrete', color: K.stone }],
    ['box', [11, 0, -57], [17, 3.0, -51], { mat: 'concrete', color: K.stone }],
    ['box', [12, 0, -51], [13.5, 1.0, -49.5], { mat: 'wood' }],
    ['box', [13.5, 0, -51], [15, 2.0, -49.5], { mat: 'wood' }],
    // lower bazaar: stall counters + a rooftop with a ramp
    ['box', [-14, 0, -34], [-10, 1.0, -32.6], { mat: 'wood' }],
    ['box', [-8, 0, -38], [-3, 1.0, -36.6], { mat: 'wood' }],
    ['box', [3, 0, -42], [8, 1.0, -40.6], { mat: 'wood' }],
    ['box', [16, 0, -37], [21, 1.0, -35.6], { mat: 'wood' }],
    ['box', [-26, 0, -42], [-20, 2.0, -32], { mat: 'concrete', color: K.adobe }],
    ['ramp', [-20, 0, -42], [-15.5, 2.0, -38], { rise: '-x', mat: 'concrete', color: K.stone }],
    // terrace bands climbing to the middle
    ['box', [-16, 0, -30], [16, 1.0, -20], { mat: 'concrete', color: K.band }],
    ['ramp', [-4, 0, -33], [4, 1.0, -30], { rise: '+z', mat: 'concrete', color: K.band }],
    ['box', [-12, 0, -20], [12, 2.5, -12], { mat: 'concrete', color: K.sand2 }],
    ['ramp', [-12, 1.0, -23.5], [-8, 2.5, -20], { rise: '+z', mat: 'concrete', color: K.sand2 }],
    ['ramp', [8, 1.0, -23.5], [12, 2.5, -20], { rise: '+z', mat: 'concrete', color: K.sand2 }],
    ['ramp', [-3, 2.5, -14.5], [3, 3.5, -12], { rise: '+z', mat: 'tiles', color: K.tile }],
    // central terrace cover
    ['box', [5, 3.5, -9], [8, 4.3, -6.5], { mat: 'concreteDark', color: K.teal }],
    ['box', [-8, 3.5, -9], [-4, 4.4, -8.4], { mat: 'concrete', color: K.stone }],
    // flank house: a side entrance onto the central terrace
    ['box', [-16, 0, -10], [-12, 2.5, -4], { mat: 'concrete', color: K.adobe2 }],
    ['ramp', [-21.5, 0, -10], [-16, 2.5, -4], { rise: '+x', mat: 'concrete', color: K.stone }],
    // flank street cover
    ['box', [-20, 0, -18], [-19, 2.6, -17], { mat: 'concreteDark', color: K.clay }],
    ['box', [16, 0, -18], [20, 1.0, -16.6], { mat: 'wood' }],
    ['box', [-23, 0, -3], [-21, 1.0, -1], { mat: 'concreteDark', color: K.teal }],
    ['box', [-16, 0, -17], [-13, 1.0, -16.4], { mat: 'concrete', color: K.stone }],
    // east lookout over the canyon
    ['box', [19, 0, -11], [24, 1.5, -5], { mat: 'concrete', color: K.stone }],
    ['ramp', [19, 0, -5], [24, 1.5, -1.5], { rise: '-z', mat: 'concrete', color: K.stone }],
    ['box', [22, 1.5, -10], [24, 2.5, -8], { mat: 'wood' }],
    // bale stack on the central terrace
    ['box', [-10.5, 3.5, -4], [-8.5, 4.5, 0], { mat: 'wood' }],
    // market hall (bazaar perch)
    ['box', [9, 0, -40], [14, 2.0, -34], { mat: 'concrete', color: K.adobe }],
    ['ramp', [4.5, 0, -40], [9, 2.0, -36], { rise: '+x', mat: 'concrete', color: K.stone }],
  ],
  decor: buildMesaDecor,
};

// ---------------------------------------------------------------------------
function strataTex(r, cols, size = 256) {
  return canvasTex(size, size, (x, w, h) => {
    let y = 0;
    while (y < h) {
      const bh = 5 + r() * 24;
      x.fillStyle = cols[Math.floor(r() * cols.length)];
      x.fillRect(0, y, w, bh + 1);
      for (let i = 0; i < 50; i++) { x.fillStyle = `rgba(40,15,10,${r() * 0.1})`; x.fillRect(r() * w, y + r() * bh, 2 + r() * 12, 1 + r() * 2); }
      y += bh;
    }
    for (let i = 0; i < 36; i++) { x.fillStyle = `rgba(70,30,20,${0.04 + r() * 0.08})`; x.fillRect(r() * w, 0, 1 + r() * 3, h); }
  });
}

// Box whose UVs tile every `tile` metres (so one material fits any size)
function uvBox(w, h, d, tile) {
  const g = new THREE.BoxGeometry(w, h, d);
  const uv = g.attributes.uv;
  const sc = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
  for (let f = 0; f < 6; f++) for (let k = 0; k < 4; k++) {
    const i = f * 4 + k;
    uv.setXY(i, uv.getX(i) * sc[f][0] / tile, uv.getY(i) * sc[f][1] / tile);
  }
  return g;
}

function adobeTex(r) {
  const wins = [[40, 50], [160, 50], [40, 170], [160, 170]];
  const map = canvasTex(256, 256, (x, w, h) => {
    x.fillStyle = '#f3e4cf'; x.fillRect(0, 0, w, h);
    for (let i = 0; i < 400; i++) { x.fillStyle = `rgba(${r() < 0.5 ? '120,80,50' : '255,255,255'},${r() * 0.08})`; x.fillRect(r() * w, r() * h, 2 + r() * 8, 2 + r() * 8); }
    x.fillStyle = '#6d4a36';
    for (const [wx, wy] of wins) { x.beginPath(); x.roundRect(wx, wy, 56, 64, [28, 28, 2, 2]); x.fill(); }
  });
  const emissiveMap = canvasTex(256, 256, (x, w, h) => {
    x.fillStyle = '#000'; x.fillRect(0, 0, w, h);
    for (const [wx, wy] of wins) {
      if (r() < 0.55) { x.fillStyle = r() < 0.5 ? '#ffb45a' : '#ffd890'; x.beginPath(); x.roundRect(wx + 4, wy + 4, 48, 56, [24, 24, 2, 2]); x.fill(); }
    }
  });
  return { map, emissiveMap };
}

function stripeTex(a, b) {
  return canvasTex(128, 32, (x, w, h) => {
    for (let i = 0; i < 8; i++) { x.fillStyle = i % 2 ? b : a; x.fillRect(i * w / 8, 0, w / 8 + 1, h); }
    x.fillStyle = 'rgba(0,0,0,.12)'; x.fillRect(0, h - 5, w, 5);
  });
}

function palmGeometry() {
  // eight drooping fronds as one geometry, crown at the origin
  const pos = [];
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + (i % 2) * 0.2;
    const ca = Math.cos(a), sa = Math.sin(a);
    const L = 3.2;
    const pts = [[0, 0, 0], [L * 0.5, 0.35, 0.45], [L, -0.9, 0], [L * 0.5, 0.35, -0.45]];
    const P = pts.map(([u, y, w]) => [u * ca - w * sa, y, u * sa + w * ca]);
    pos.push(...P[0], ...P[1], ...P[2], ...P[0], ...P[2], ...P[3]);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  return g;
}

function buildMesaDecor(scene, def, env) {
  const group = decorGroup(scene);
  const r = rng(907);
  const anim = [];
  spawnPads(group, def);
  const entries = allEntries(def);
  const boxGeo = new THREE.BoxGeometry(1, 1, 1);
  const rockCols = ['#b06a4c', '#c2835c', '#a35d45', '#cf9a72', '#985442', '#bb7552', '#d8ae86'];
  const rockMap = strataTex(r, rockCols);
  const rock = std(0xffffff, 0.95, 0, { map: rockMap });
  const gold = std(0xf2c14e, 0.3, 0.8, { emissive: 0x5a3a08, emissiveIntensity: 0.4 });
  const darkWood = std(0x5a3c2c, 0.8, 0);

  // ---- the mesa: cliff skirts under every slab, outcrops below the rim, canyon floor
  const slabs = entries.filter((e) => e.kind === 'box' && e.min[1] <= -3.5);
  const bottom = -64;
  for (const s of slabs) {
    const w = s.max[0] - s.min[0] + 0.12, d = s.max[2] - s.min[2] + 0.12, h = -0.25 - bottom;
    const m = new THREE.Mesh(uvBox(w, h, d, 14), rock);
    m.position.set((s.min[0] + s.max[0]) / 2, bottom + h / 2, (s.min[2] + s.max[2]) / 2);
    m.receiveShadow = true;
    group.add(m);
  }
  // shelves beyond the bases for the town
  for (const side of [-1, 1]) {
    const m = new THREE.Mesh(uvBox(96, -0.4 - bottom, 40, 14), rock);
    m.position.set(0, (bottom - 0.4) / 2, side * 78.6);
    group.add(m);
    const top = new THREE.Mesh(new THREE.BoxGeometry(96, 0.3, 40), std(0xe8d2b4, 1, 0));
    top.position.set(0, -0.45, side * 78.6); top.receiveShadow = true;
    group.add(top);
  }
  const edges = edgePoints(def, { spacing: 3, floorBottom: -3.5 });
  const outcrops = [];
  for (const e of edges) {
    if (Math.abs(e.z) > 58 || r() < 0.35) continue;
    const out = 0.6 + r() * 2.2, sz = 2 + r() * 4;
    outcrops.push({ p: [e.x + e.nx * out * 0.6, -4 - r() * 14 - sz, e.z + e.nz * out * 0.6], s: [sz * (0.8 + r() * 0.6), sz * (1.4 + r() * 1.6), sz * (0.8 + r() * 0.6)], ry: r() * Math.PI, rx: (r() - 0.5) * 0.4, c: [0xb8603e, 0xc97a4e, 0xa9533a, 0xd08a5a][Math.floor(r() * 4)] });
  }
  instanced(group, new THREE.IcosahedronGeometry(1, 0), std(0xffffff, 0.95, 0, { flatShading: true }), outcrops);
  const pebbles = edges.filter(() => r() < 0.6).map((e) => ({ p: [e.x + e.nx * (0.35 + r() * 0.5), -0.5 - r() * 0.8, e.z + e.nz * (0.35 + r() * 0.5)], s: 0.4 + r() * 0.6, ry: r() * 6, rx: r() * 6 }));
  instanced(group, new THREE.DodecahedronGeometry(1, 0), std(0xc77a50, 0.95, 0), pebbles);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(2400, 2400), std(0x9a5a40, 1, 0));
  floor.rotation.x = -Math.PI / 2; floor.position.y = bottom;
  group.add(floor);
  // a river winding along the canyon floor
  const riverPts = [];
  for (let i = 0; i <= 40; i++) riverPts.push(new THREE.Vector3(Math.sin(i * 0.45) * 60 + 90, bottom + 0.4, -600 + i * 30));
  const river = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(riverPts), 160, 6, 6, false), std(0x5aa6c8, 0.1, 0.2, { emissive: 0x1a3e58, emissiveIntensity: 0.4 }));
  river.scale.y = 0.08; river.position.y = bottom * 0.92;
  group.add(river);

  // ---- distant buttes and mesas
  const buttes = [];
  for (let i = 0; i < 26; i++) {
    const a = (i / 26) * Math.PI * 2 + r() * 0.15;
    const d = 150 + r() * 320;
    const w = 20 + r() * 60, h = 50 + r() * 90;
    buttes.push({ p: [Math.cos(a) * d, bottom + h / 2, Math.sin(a) * d], s: [w, h, w * (0.6 + r() * 0.8)], ry: r() * Math.PI });
  }
  instanced(group, new THREE.CylinderGeometry(0.5, 0.62, 1, 7), rock, buttes);
  const caps = buttes.map((b) => ({ p: [b.p[0], b.p[1] + b.s[1] / 2 + 0.6, b.p[2]], s: [b.s[0] * 1.02, 1.2, b.s[2] * 1.02], ry: b.ry }));
  instanced(group, new THREE.CylinderGeometry(0.5, 0.5, 1, 7), std(0xd9a070, 0.95, 0), caps);
  // eroded upper tiers on some buttes
  const tiers = buttes.filter((_, i) => i % 3 === 0).map((b) => ({ p: [b.p[0], b.p[1] + b.s[1] / 2 + b.s[1] * 0.12, b.p[2]], s: [b.s[0] * 0.45, b.s[1] * 0.24, b.s[2] * 0.45], ry: b.ry + 0.5 }));
  instanced(group, new THREE.CylinderGeometry(0.5, 0.62, 1, 7), rock, tiers);

  // ---- market awnings over the stall counters (front faces the middle)
  const counters = entries.filter((e) => e.opts.mat === 'wood' && e.max[1] - e.min[1] <= 1.01 && e.max[2] - e.min[2] < 1.6 && e.max[0] - e.min[0] >= 3);
  const awnMats = [['#2f8f8a', '#f6f0e2'], ['#d2483c', '#f6f0e2'], ['#e8a820', '#fbf3df'], ['#3f6fb0', '#f6f0e2']].map(([a, b]) => std(0xffffff, 0.85, 0, { map: stripeTex(a, b), side: THREE.DoubleSide }));
  const awnGeo = new THREE.PlaneGeometry(1, 1); awnGeo.rotateX(-Math.PI / 2);
  const awnItems = awnMats.map(() => []), posts = [];
  counters.forEach((e, i) => {
    const [x0, , z0] = e.min, [x1, , z1] = e.max;
    const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, len = x1 - x0;
    const back = cz < 0 ? z0 : z1, dir = cz < 0 ? 1 : -1;
    const depth = z1 - z0 + 0.7;
    awnItems[i % awnMats.length].push({ p: [cx, 2.75, back + dir * depth / 2], s: [len + 0.4, 1, depth], rx: 0.18 * dir });
    for (const x of [x0 + 0.1, x1 - 0.1]) posts.push({ p: [x, 1.5, back - dir * 0.08], s: [0.12, 3, 0.12] });
  });
  awnMats.forEach((m, i) => instanced(group, awnGeo, m, awnItems[i], { shadow: true }));
  instanced(group, boxGeo, darkWood, posts);

  // ---- lantern strings along the canyon edges
  const poleSpots = edges.filter((e, i) => i % 4 === 0 && Math.abs(e.z) < 57).map((e) => ({ x: e.x + e.nx * 0.45, z: e.z + e.nz * 0.45, nx: e.nx, nz: e.nz }));
  instanced(group, new THREE.CylinderGeometry(0.08, 0.1, 5.4, 6), darkWood, poleSpots.map((p) => ({ p: [p.x, 2.2, p.z] })));
  const linePos = [], lanterns = [];
  const lanternCols = [0xffa040, 0xff6a3a, 0xffd060, 0xff8fb0, 0x7fe0d0];
  for (let i = 0; i < poleSpots.length; i++) for (let j = i + 1; j < poleSpots.length; j++) {
    const a = poleSpots[i], b = poleSpots[j];
    const d = Math.hypot(a.x - b.x, a.z - b.z);
    if (d < 6 || d > 14 || a.nx !== b.nx || a.nz !== b.nz) continue;
    const n = Math.floor(d / 1.5);
    let prev = null;
    for (let k = 0; k <= n; k++) {
      const t = k / n;
      const p = [a.x + (b.x - a.x) * t, 4.8 - Math.sin(t * Math.PI) * 1.1, a.z + (b.z - a.z) * t];
      if (prev) linePos.push(...prev, ...p);
      prev = p;
      if (k > 0 && k < n) lanterns.push({ p: [p[0], p[1] - 0.35, p[2]], c: lanternCols[Math.floor(r() * lanternCols.length)], ph: r() * 6 });
    }
  }
  const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.Float32BufferAttribute(linePos, 3));
  group.add(new THREE.LineSegments(lg, new THREE.LineBasicMaterial({ color: 0x3a2a22 })));
  const lanternMesh = instanced(group, new THREE.CylinderGeometry(0.17, 0.13, 0.42, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(2.2, 2.2, 2.2) }), lanterns);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e3 = new THREE.Euler(), v = new THREE.Vector3(), one = new THREE.Vector3(1, 1, 1);
  anim.push((t) => {
    if (!lanternMesh) return;
    lanterns.forEach((L, i) => {
      const sw = Math.sin(t * 1.6 + L.ph) * 0.12;
      q.setFromEuler(e3.set(sw, 0, sw * 0.6));
      v.set(L.p[0], L.p[1] + Math.abs(sw) * 0.2, L.p[2]);
      lanternMesh.setMatrixAt(i, m4.compose(v, q, one));
    });
    lanternMesh.instanceMatrix.needsUpdate = true;
  });

  // ---- braziers on the central terrace corners + the gate towers
  const brazierSpots = [[11.3, 3.5, 11.3], [-11.3, 3.5, 11.3], [11.3, 3.5, -11.3], [-11.3, 3.5, -11.3]];
  for (const tw of entries.filter((e) => e.kind === 'box' && e.opts.color === K.stone && e.min[1] === 0 && e.max[1] >= 3)) {
    const x = tw.min[0] < 0 ? tw.min[0] + 0.6 : tw.max[0] - 0.6, z = tw.min[2] < 0 ? tw.min[2] + 0.6 : tw.max[2] - 0.6;
    brazierSpots.push([x, tw.max[1], z]);
  }
  const flames = [];
  const flameMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(3.2, 1.5, 0.45) });
  const flameGeo = new THREE.ConeGeometry(0.32, 0.9, 8);
  instanced(group, new THREE.CylinderGeometry(0.08, 0.16, 0.9, 6), darkWood, brazierSpots.map(([x, y, z]) => ({ p: [x, y + 0.45, z] })));
  instanced(group, new THREE.CylinderGeometry(0.45, 0.25, 0.3, 10), gold, brazierSpots.map(([x, y, z]) => ({ p: [x, y + 1.0, z] })));
  for (const [x, y, z] of brazierSpots) {
    const fl = new THREE.Mesh(flameGeo, flameMat);
    fl.position.set(x, y + 1.55, z); group.add(fl);
    flames.push(fl);
  }
  anim.push((t) => flames.forEach((f, i) => {
    const k = 1 + Math.sin(t * 11 + i * 1.7) * 0.12 + Math.sin(t * 17 + i) * 0.08;
    f.scale.set(1 / k, k, 1 / k);
  }));
  for (const y of [5.0, 8.4]) {
    const band = new THREE.Mesh(new THREE.BoxGeometry(1.75, 0.22, 1.75), gold);
    band.position.set(0, y, 0); group.add(band);
  }

  // ---- the town on the shelves behind each base
  const { map: adobeMap, emissiveMap } = adobeTex(r);
  const adobe = std(0xffffff, 0.9, 0, { map: adobeMap, emissive: 0xffffff, emissiveMap, emissiveIntensity: 0.9 });
  const houses = [], domes = [];
  const houseTints = [0xffffff, 0xf7e7d4, 0xf0d8c0, 0xfff4e8, 0xe8d0b8];
  for (const side of [-1, 1]) {
    for (let i = 0; i < 18; i++) {
      const w = 5 + r() * 6, h = 4 + r() * 7, d = 5 + r() * 6;
      const x = -42 + (i % 9) * 10.5 + (r() - 0.5) * 3, z = side * (66 + Math.floor(i / 9) * 13 + r() * 5);
      if (Math.abs(x) < 15 && Math.abs(z) < 74) continue; // keep the gate clear
      houses.push({ p: [x, -0.3 + h / 2, z], s: [w, h, d], c: houseTints[i % houseTints.length] });
      if (r() < 0.45) domes.push({ p: [x, -0.3 + h, z], s: Math.min(w, d) * 0.42, c: r() < 0.5 ? 0x4fa6a0 : 0xf6efe4 });
    }
  }
  instanced(group, boxGeo, adobe, houses, { receive: true });
  instanced(group, new THREE.SphereGeometry(1, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), std(0xffffff, 0.5, 0.2), domes);
  const towerSpots = [[-30, -70], [30, 70], [26, -84], [-26, 84]];
  instanced(group, new THREE.CylinderGeometry(1.4, 1.8, 22, 10), std(0xf4e6d2, 0.8, 0), towerSpots.map(([x, z]) => ({ p: [x, 10.7, z] })));
  instanced(group, new THREE.CylinderGeometry(2.2, 2.2, 2.4, 10), adobe, towerSpots.map(([x, z]) => ({ p: [x, 22.4, z] })));
  instanced(group, new THREE.ConeGeometry(2.3, 3.4, 10), std(0x4fa6a0, 0.4, 0.3), towerSpots.map(([x, z]) => ({ p: [x, 25.3, z] })));
  // palms + pots
  const palmSpots = [];
  for (let i = 0; i < 16; i++) palmSpots.push({ x: (r() - 0.5) * 84, z: (r() < 0.5 ? -1 : 1) * (62 + r() * 28), h: 6 + r() * 5, lean: (r() - 0.5) * 0.3 });
  instanced(group, new THREE.CylinderGeometry(0.22, 0.32, 1, 7), std(0x8a6444, 0.9, 0), palmSpots.map((p) => ({ p: [p.x, p.h / 2 - 0.3, p.z], s: [1, p.h, 1], rz: p.lean })));
  instanced(group, palmGeometry(), std(0x5f9a4c, 0.8, 0, { side: THREE.DoubleSide }), palmSpots.map((p) => ({ p: [p.x - Math.sin(p.lean) * p.h * 0.5, p.h - 0.4, p.z], ry: r() * 6, s: 1 + r() * 0.3 })));
  const potPts = [[0, 0], [0.35, 0], [0.55, 0.25], [0.6, 0.55], [0.45, 0.85], [0.28, 0.95], [0.32, 1.05], [0, 1.05]].map(([a, b]) => new THREE.Vector2(a, b));
  const pots = [];
  for (let i = 0; i < 40; i++) {
    const side = r() < 0.5 ? -1 : 1;
    pots.push({ p: [(r() - 0.5) * 30, -0.3, side * (59.4 + r() * 3)], s: 0.7 + r() * 0.9, c: [0xc9754e, 0xd8935e, 0x4fa6a0, 0xe8d2b4][i % 4] });
  }
  instanced(group, new THREE.LatheGeometry(potPts, 12), std(0xffffff, 0.8, 0), pots);

  // ---- grand gates with the stage name, behind each spawn
  for (const side of [-1, 1]) {
    const g = new THREE.Group();
    for (const x of [-12, 12]) {
      const pillar = new THREE.Mesh(uvBox(3, 16, 3, 6), std(0xf2e2c8, 0.85, 0, { map: rockMap }));
      pillar.position.set(x, 7.7, 0); pillar.castShadow = true; g.add(pillar);
      const cap = new THREE.Mesh(new THREE.BoxGeometry(3.8, 0.8, 3.8), gold); cap.position.set(x, 16, 0); g.add(cap);
    }
    const lintel = new THREE.Mesh(new THREE.BoxGeometry(28, 2, 2.6), std(0xd9b48a, 0.8, 0)); lintel.position.set(0, 15.4, 0); g.add(lintel);
    const board = nameBoard(def.name, { w: 18, h: 4.5, accent: '#f2c14e', bg: '#2a2350', fg: '#ffe2b0', frame: 0x3a2a22, legH: 0, size: 96 });
    board.position.set(0, 10.4, 0.2); g.add(board);
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 2.4, 0.4, 28), gold);
    disc.rotation.x = Math.PI / 2; disc.position.set(0, 19.2, 0); g.add(disc);
    g.position.set(0, -0.3, side * 63);
    g.rotation.y = side < 0 ? 0 : Math.PI;
    group.add(g);
  }

  // ---- hot-air balloons drifting over the canyon
  const balloonTex = canvasTex(256, 128, (x, w, h) => {
    const cols = ['#e5483c', '#f2c14e', '#4fa6a0', '#f6efe4', '#3f6fb0', '#e07a3a'];
    for (let i = 0; i < 12; i++) { x.fillStyle = cols[i % cols.length]; x.fillRect(i * w / 12, 0, w / 12 + 1, h); }
  });
  const balloonMat = std(0xffffff, 0.7, 0, { map: balloonTex });
  const burnerMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 1.6, 0.5) });
  const envGeo = new THREE.SphereGeometry(5, 18, 14);
  const balloons = [];
  for (let i = 0; i < 6; i++) {
    const b = new THREE.Group();
    const shell = new THREE.Mesh(envGeo, balloonMat);
    shell.scale.set(1, 1.2, 1); b.add(shell);
    const basket = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.2, 1.6), darkWood); basket.position.y = -8.5; b.add(basket);
    const burner = new THREE.Mesh(new THREE.SphereGeometry(0.4, 8, 6), burnerMat); burner.position.y = -6.8; b.add(burner);
    b.userData = { a: (i / 6) * Math.PI * 2 + 0.5, d: 110 + r() * 120, h: 18 + r() * 30, ph: r() * 6, burner };
    group.add(b);
    balloons.push(b);
  }
  anim.push((t) => balloons.forEach((b) => {
    const u = b.userData, a = u.a + t * 0.006;
    b.position.set(Math.cos(a) * u.d, u.h + Math.sin(t * 0.25 + u.ph) * 3, Math.sin(a) * u.d * 1.2);
    b.rotation.y = t * 0.05 + u.ph;
    u.burner.visible = Math.sin(t * 2.3 + u.ph) > 0.2;
  }));

  return {
    group,
    update(t) { for (const f of anim) f(t); },
    setTeamColors: (a, b) => setTeamColors(group, a, b),
  };
}
