// Fizzwater Works: a soda bottling plant on a harbour pier at noon.
// Silos, conveyor lines, bottle crates and fizzy water all around.
import * as THREE from 'three';
import { rng } from '../../util.js';
import { decorGroup, spawnPads, setTeamColors, std, glow, instanced, nameBoard, canvasTex, allEntries, edgePoints } from './common.js';

const K = {
  cream: 0xf6efe2, red: 0xe5483c, mint: 0x86d9c6, blue: 0x3f8fd8, yellow: 0xf2c230, belt: 0x3a3f4a, silo: 0xeef3f4, silo2: 0xd7e9ee,
  pier: 0xece6dc, pave: 0xe4ecee, wing: 0xf1e8da,
};
const C = (c) => ({ mat: 'container', color: c });

export const FIZZWATER = {
  name: 'Fizzwater Works',
  sky: {
    zenith: 0x1764ee, horizon: 0xaee0ff, ground: 0x5f8eaa, sun: 0xfff6e2, sunDir: [0.22, 0.92, 0.3],
    cloud: 0xffffff, cloudShade: 0xc3d3ec, clouds: 0.55, sunI: 4.4, hemiSky: 0xd2ecff, hemiGround: 0x7d8a8c, hemiI: 0.38,
    fog: 0xc4e6fb, fogD: 0.0026,
  },
  water: 0x17a9c2,
  killY: -1.3,
  half: { minX: -29, maxX: 29, minZ: -57, maxZ: 57 },
  spawnZ: 53, spawnY: 1.6,
  // Zone Clash rects [x0,z0,x1,z1,y], Hue Hoops pad for team A's hoop + tip-off spot
  modes: { zones: [[-22.5, -7.5, -14.5, 3.5, 2.2], [14.5, -3.5, 22.5, 7.5, 2.2]], hoop: { x: 0, z: -41.5, y: 0, r: 4 }, tip: [-3.8, 2.2, -2.8] },
  sym: [
    ['box', [-23, -3, -20], [23, 0, 20], { mat: 'floor', color: K.pave }],
    // the Carbonator: raised deck with a CO2 tank on top (climbable perch)
    ['box', [-6, 0, -6], [6, 2.2, 6], { mat: 'tiles', color: 0xe6f4f0 }],
    ['box', [-1.5, 2.2, -1.5], [1.5, 5.2, 1.5], C(K.silo)],
  ],
  mirrored: [
    // pier slabs (water all around)
    ['box', [-19, -3, -57], [19, 0, -20], { mat: 'concrete', color: K.pier }],
    ['box', [-29, -3, -46], [-19, 0, -20], { mat: 'floor', color: K.wing }],
    ['box', [19, -3, -34], [27, 0, -20], { mat: 'floor', color: K.wing }],
    ['box', [-29, -3, -20], [-23, 0, 2], { mat: 'floor', color: K.wing }],
    // spawn deck
    ['box', [-8, 0, -57], [8, 1.6, -49], { mat: 'grate', base: true }],
    ['ramp', [-8, 0, -49], [-4.5, 1.6, -44.5], { rise: '-z', mat: 'grate' }],
    ['ramp', [4.5, 0, -49], [8, 1.6, -44.5], { rise: '-z', mat: 'grate' }],
    ['box', [-8.4, -1.2, -57.4], [8.4, 2.6, -57], { mat: 'hazard', paintable: false }],
    ['box', [-19.4, -1.2, -57], [-19, 0.9, -46], { mat: 'hazard', paintable: false }],
    ['box', [19, -1.2, -57], [19.4, 0.9, -35], { mat: 'hazard', paintable: false }],
    // bottling hall (west of spawn) with a crate staircase
    ['box', [-18, 0, -55], [-11, 2.6, -48], { mat: 'facade2', color: K.cream }],
    ['box', [-13, 0, -48], [-11.5, 1.0, -46.5], C(K.red)],
    ['box', [-14.5, 0, -48], [-13, 2.0, -46.5], C(K.blue)],
    // pallet dock (east of spawn)
    ['box', [11, 0, -55], [18, 1.0, -48], { mat: 'wood' }],
    ['box', [14, 1.0, -54], [17, 2.0, -51], C(K.yellow)],
    // west loading bay
    ['box', [-29, 0, -44], [-22, 1.6, -30], { mat: 'concrete', color: 0xe3dccf }],
    ['ramp', [-22, 0, -40], [-18, 1.6, -36], { rise: '-x', mat: 'concrete', color: 0xe3dccf }],
    ['box', [-27, 1.6, -38], [-25, 2.6, -36], C(K.red)],
    ['box', [-25.5, 1.6, -33.5], [-23, 2.6, -31.5], C(K.blue)],
    // syrup tanks on the west wing
    ['box', [-27.5, 0, -27.5], [-25.5, 1.8, -25.5], C(0xf3d9b0)],
    ['box', [-24, 0, -25], [-22, 2.4, -23], C(0xf6c5a8)],
    ['box', [-27.5, 0, -23], [-25.5, 1.2, -21], C(0xf3d9b0)],
    // conveyor line A + cover
    ['box', [-12, 0, -37], [3, 1.0, -34], { mat: 'plain', color: K.belt }],
    ['box', [5, 0, -40.6], [9, 1.1, -40], { mat: 'concreteDark' }],
    // shipping container in the east yard + crate steps
    ['box', [13, 0, -44], [15.6, 2.6, -38], C(K.blue)],
    ['box', [15.6, 0, -40], [17.1, 1.0, -38.5], C(K.red)],
    ['box', [15.6, 0, -41.5], [17.1, 2.0, -40], C(K.yellow)],
    // silo yard (east)
    ['box', [20, 0, -33], [25, 7.5, -28], C(K.silo)],
    ['box', [20, 0, -26], [25, 6.0, -21], C(K.silo2)],
    ['box', [12, 0, -33], [18, 2.2, -27], { mat: 'grate' }],
    ['ramp', [12, 0, -27], [16, 2.2, -22.5], { rise: '-z', mat: 'grate' }],
    ['box', [12, 2.2, -33], [15, 3.2, -30], { mat: 'concreteDark' }],
    // bottle washer (mid-lane line-of-sight blocker) with a ramp and a crate step
    ['box', [-4, 0, -29], [4, 2.0, -25], C(K.mint)],
    ['ramp', [-8.5, 0, -29], [-4, 2.0, -25], { rise: '+x', mat: 'grate' }],
    ['box', [4, 0, -28], [5.5, 1.0, -26.5], C(K.red)],
    // west crate stacks
    ['box', [-20, 0, -24], [-18, 1.0, -22], C(K.yellow)],
    ['box', [-18, 0, -24], [-16, 2.0, -22], C(K.red)],
    // mid: Carbonator ramps + cover
    ['ramp', [-6, 0, -11], [-1.5, 2.2, -6], { rise: '+z', mat: 'tiles', color: 0xe6f4f0 }],
    ['ramp', [6, 0, -1.5], [11, 2.2, 3], { rise: '-x', mat: 'tiles', color: 0xe6f4f0 }],
    ['box', [1.5, 2.2, -5.6], [5, 3.1, -5], { mat: 'concreteDark' }],
    ['box', [0, 0, -21], [3, 1.6, -19], { mat: 'concreteDark' }],
    // syrup deck (west mid) with two ramps
    ['box', [-23, 0, -8], [-14, 2.2, 4], C(K.mint)],
    ['ramp', [-23, 0, -12.5], [-19, 2.2, -8], { rise: '+z', mat: 'grate' }],
    ['ramp', [-18, 0, 4], [-14, 2.2, 8.5], { rise: '-z', mat: 'grate' }],
    // waterside container perch on the west strip
    ['box', [-28.6, 0, -17], [-26, 2.6, -11], C(K.red)],
    ['box', [-26, 0, -17], [-24.5, 1.0, -15.5], C(K.yellow)],
    ['box', [-26, 0, -15.5], [-24.5, 2.0, -14], C(K.blue)],
    // conveyor line B, crates, cover
    ['box', [-12, 0, -24], [-9, 1.0, -12], { mat: 'plain', color: K.belt }],
    ['box', [9, 0, -16], [11, 1.0, -14], C(K.red)],
    ['box', [11, 0, -16], [13, 2.0, -14], C(K.yellow)],
    ['box', [-5, 0, -16], [-1, 1.0, -15.4], { mat: 'concreteDark' }],
    ['box', [17, 0, -17], [20, 1.0, -14], { mat: 'wood' }],
    ['box', [18, 1.0, -16.5], [19.5, 2.0, -15], C(K.blue)],
  ],
  decor: buildFizzwaterDecor,
};

// ---------------------------------------------------------------------------
function brickFacade(r) {
  return canvasTex(256, 256, (x, w, h) => {
    x.fillStyle = '#c9765a'; x.fillRect(0, 0, w, h);
    for (let j = 0; j < 64; j++) for (let i = 0; i < 16; i++) {
      const k = 0.85 + r() * 0.25;
      x.fillStyle = `rgb(${201 * k | 0},${118 * k | 0},${90 * k | 0})`;
      x.fillRect(i * 16 + (j % 2) * 8, j * 4, 15, 3);
    }
    // two tall industrial windows
    for (const wx of [24, 152]) {
      x.fillStyle = '#e8e2d6'; x.fillRect(wx - 6, 40, 92, 176);
      x.fillStyle = '#3d5f7e'; x.fillRect(wx, 46, 80, 164);
      x.fillStyle = 'rgba(180,225,255,.55)';
      for (let j = 0; j < 6; j++) for (let i = 0; i < 4; i++) if (r() < 0.5) x.fillRect(wx + 2 + i * 20, 48 + j * 27, 16, 23);
      x.fillStyle = '#e8e2d6';
      for (let i = 1; i < 4; i++) x.fillRect(wx + i * 20 - 2, 46, 3, 164);
      for (let j = 1; j < 6; j++) x.fillRect(wx, 46 + j * 27 - 2, 80, 3);
    }
  });
}

function labelTex(text, bg, fg) {
  return canvasTex(512, 128, (x, w, h) => {
    x.fillStyle = bg; x.fillRect(0, 0, w, h);
    x.fillStyle = 'rgba(255,255,255,.9)'; x.fillRect(0, 10, w, 6); x.fillRect(0, h - 16, w, 6);
    x.font = '76px Bungee, "Arial Black", Impact, sans-serif';
    x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillStyle = fg;
    x.fillText(text, w / 4, h / 2 + 4); x.fillText(text, w * 3 / 4, h / 2 + 4);
  });
}

function bottleGeometry(h) {
  const pts = [[0, 0], [0.78, 0], [0.9, 0.05], [0.95, 0.15], [0.95, 0.55], [0.88, 0.64], [0.45, 0.8], [0.3, 0.9], [0.3, 0.97], [0.34, 0.98], [0.34, 1], [0, 1]];
  return new THREE.LatheGeometry(pts.map(([rr, y]) => new THREE.Vector2(rr * h * 0.18, y * h)), 28);
}

function buildFizzwaterDecor(scene, def, env) {
  const group = decorGroup(scene);
  const r = rng(311);
  const anim = [];
  env.addWater(-1.15, def.water);
  spawnPads(group, def);
  const entries = allEntries(def);
  const steel = std(0x8d98a6, 0.4, 0.7), dark = std(0x2d3040, 0.6, 0.4), white = std(0xf7f7f2, 0.5, 0.1), red = std(K.red, 0.45, 0.1), yellow = std(K.yellow, 0.5, 0.2);

  // ---- pilings + tyre bumpers along the pier edges
  const edges = edgePoints(def, { spacing: 3.2 });
  instanced(group, new THREE.CylinderGeometry(0.3, 0.34, 4.2, 10), std(0x6b5646, 0.9, 0), edges.map((e) => ({ p: [e.x + e.nx * 0.28, -2.2, e.z + e.nz * 0.28] })));
  instanced(group, new THREE.TorusGeometry(0.42, 0.16, 8, 16), std(0x24262c, 0.9, 0),
    edges.filter((_, i) => i % 3 === 1).map((e) => ({ p: [e.x + e.nx * 0.2, -0.9, e.z + e.nz * 0.2], ry: Math.atan2(e.nx, e.nz) })));

  // ---- fizz: bubbles popping up all over the harbour
  const bubN = 220;
  const bubbles = new THREE.InstancedMesh(new THREE.SphereGeometry(0.16, 8, 6), new THREE.MeshStandardMaterial({ color: 0xe9fbff, roughness: 0.05, transparent: true, opacity: 0.75, envMapIntensity: 1.4 }), bubN);
  const bubData = [];
  for (let i = 0; i < bubN; i++) {
    const near = i < 140;
    let x, z;
    if (near) {
      const e = edges[Math.floor(r() * edges.length)];
      const d = 0.8 + r() * 7;
      x = e.x + e.nx * d + (r() - 0.5) * 3; z = e.z + e.nz * d + (r() - 0.5) * 3;
    } else {
      const a = r() * Math.PI * 2, d = 40 + r() * 50;
      x = Math.cos(a) * d; z = Math.sin(a) * d * 1.4;
    }
    bubData.push({ x, z, ph: r(), sp: 0.35 + r() * 0.5, s: 0.5 + r() * 1.1 });
  }
  group.add(bubbles);
  const m4 = new THREE.Matrix4(), q0 = new THREE.Quaternion(), v0 = new THREE.Vector3(), s0 = new THREE.Vector3();
  anim.push((t) => {
    for (let i = 0; i < bubN; i++) {
      const b = bubData[i];
      const f = (t * b.sp + b.ph) % 1;
      const sc = b.s * (f < 0.8 ? 0.4 + f : (1 - f) * 6);
      v0.set(b.x + Math.sin(t * 2 + i) * 0.1, -1.18 + f * 0.35, b.z);
      m4.compose(v0, q0, s0.set(sc, sc, sc));
      bubbles.setMatrixAt(i, m4);
    }
    bubbles.instanceMatrix.needsUpdate = true;
  });

  // ---- conveyors: end drums + yellow side rails
  const belts = entries.filter((e) => e.opts.color === K.belt);
  const drumGeo = new THREE.CylinderGeometry(0.5, 0.5, 1, 16);
  const drums = [], rails = [];
  for (const e of belts) {
    const [x0, , z0] = e.min, [x1, y1, z1] = e.max;
    const alongX = x1 - x0 > z1 - z0;
    const wdt = alongX ? z1 - z0 : x1 - x0, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
    for (const end of [0, 1]) {
      if (alongX) drums.push({ p: [end ? x1 : x0, y1 - 0.5, cz], rx: Math.PI / 2, s: [1, wdt + 0.1, 1] });
      else drums.push({ p: [cx, y1 - 0.5, end ? z1 : z0], rz: Math.PI / 2, s: [1, wdt + 0.1, 1] });
    }
    for (const side of [-1, 1]) {
      if (alongX) rails.push({ p: [cx, y1 - 0.12, cz + side * (wdt / 2 + 0.07)], s: [x1 - x0, 0.22, 0.12] });
      else rails.push({ p: [cx + side * (wdt / 2 + 0.07), y1 - 0.12, cz], s: [0.12, 0.22, z1 - z0] });
    }
  }
  instanced(group, drumGeo, steel, drums, { shadow: true });
  instanced(group, new THREE.BoxGeometry(1, 1, 1), yellow, rails);

  // ---- silos: red bands, corner pipes, ladders; CO2 tank pipes + gauge
  const silos = entries.filter((e) => e.opts.mat === 'container' && e.max[1] - e.min[1] > 4);
  const bands = [], pipes = [], rungs = [], ladderRails = [];
  for (const e of silos) {
    const [x0, y0, z0] = e.min, [x1, y1, z1] = e.max;
    const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, wx = x1 - x0, wz = z1 - z0;
    for (const yb of [y1 - 0.5, y0 + 0.8]) bands.push({ p: [cx, yb, cz], s: [wx + 0.08, 0.28, wz + 0.08] });
    const hgt = y1 - y0;
    for (const [px, pz] of [[x0 - 0.18, z0 - 0.18], [x1 + 0.18, z1 + 0.18]]) pipes.push({ p: [px, y0 + hgt / 2, pz], s: [1, hgt, 1] });
    // ladder on the face that looks at the middle lane
    const fx = cx < 0 ? x1 + 0.08 : x0 - 0.08;
    if (hgt > 5) {
      for (const dz of [-0.35, 0.35]) ladderRails.push({ p: [fx, y0 + hgt / 2, cz + dz], s: [0.06, hgt, 0.06] });
      for (let y = y0 + 0.4; y < y1; y += 0.45) rungs.push({ p: [fx, y, cz], s: [0.05, 0.05, 0.7] });
    }
  }
  const boxGeo = new THREE.BoxGeometry(1, 1, 1);
  instanced(group, boxGeo, red, bands);
  instanced(group, new THREE.CylinderGeometry(0.14, 0.14, 1, 8), steel, pipes, { shadow: true });
  instanced(group, boxGeo, dark, [...rungs, ...ladderRails]);
  // pressure gauges on the central tank
  for (const s of [1, -1]) {
    const g = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 0.1, 20), white);
    g.rotation.x = Math.PI / 2; g.position.set(0.6 * s, 4.4, 1.56 * s); g.rotation.y = s < 0 ? Math.PI : 0;
    group.add(g);
    const needle = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.26, 0.02), red);
    needle.position.set(0.6 * s, 4.4, 1.62 * s);
    group.add(needle);
    anim.push((t) => { needle.rotation.z = Math.sin(t * 1.7 + s) * 0.9; });
  }

  // ---- lamp posts on the pier edge
  const lampSpots = edges.filter((_, i) => i % 9 === 4);
  instanced(group, new THREE.CylinderGeometry(0.1, 0.14, 6.5, 8), dark, lampSpots.map((e) => ({ p: [e.x + e.nx * 0.5, 2.1, e.z + e.nz * 0.5] })));
  instanced(group, new THREE.SphereGeometry(0.3, 12, 8), glow(0xfff2c0, 2.5), lampSpots.map((e) => ({ p: [e.x + e.nx * 0.5, 5.5, e.z + e.nz * 0.5] })));

  // ---- factory buildings behind each base, with stacks, steam and signage
  const facade = brickFacade(r);
  for (const side of [-1, 1]) {
    const fz = side * 74;
    const f = new THREE.Group();
    const t = facade.clone(); t.needsUpdate = true; t.repeat.set(7, 2);
    const body = new THREE.Mesh(new THREE.BoxGeometry(56, 15, 22), std(0xffffff, 0.85, 0, { map: t }));
    body.position.set(0, 6.5, 0); body.receiveShadow = true; f.add(body);
    // sawtooth roof
    const tooth = new THREE.CylinderGeometry(2.6, 2.6, 22, 3, 1);
    tooth.rotateX(Math.PI / 2);
    for (let i = 0; i < 9; i++) {
      const m = new THREE.Mesh(tooth, std(i % 2 ? 0x9aa7b4 : 0xb7c3cc, 0.6, 0.3));
      m.position.set(-24 + i * 6, 15.2, 0); m.rotation.z = Math.PI / 2 * 0.333; f.add(m);
    }
    // glass carbonation columns with rising bubbles
    for (const cx of [-31, 31]) {
      const col = new THREE.Mesh(new THREE.CylinderGeometry(3, 3, 20, 24, 1, true), new THREE.MeshStandardMaterial({ color: 0x9fe8d0, roughness: 0.05, transparent: true, opacity: 0.45, side: THREE.DoubleSide, depthWrite: false }));
      col.position.set(cx, 9, 4); f.add(col);
      const liquid = new THREE.Mesh(new THREE.CylinderGeometry(2.7, 2.7, 16, 20), std(0x6ed9a2, 0.2, 0, { emissive: 0x1f6b48, emissiveIntensity: 0.3 }));
      liquid.position.set(cx, 7, 4); f.add(liquid);
      for (const yy of [-1, 19.4]) { const cap = new THREE.Mesh(new THREE.CylinderGeometry(3.2, 3.2, 0.8, 24), steel); cap.position.set(cx, yy, 4); f.add(cap); }
    }
    // smoke stacks + steam puffs
    for (const sx of [-12, 14]) {
      const stack = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.6, 16, 16), white);
      stack.position.set(sx, 21, -4); f.add(stack);
      for (const yy of [17, 25]) { const b = new THREE.Mesh(new THREE.CylinderGeometry(1.45, 1.5, 1.4, 16), red); b.position.set(sx, yy, -4); f.add(b); }
      const puffMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, transparent: true, opacity: 0.8, depthWrite: false });
      const puffs = [];
      for (let i = 0; i < 6; i++) { const p = new THREE.Mesh(new THREE.SphereGeometry(1.6, 12, 8), puffMat); f.add(p); puffs.push(p); }
      anim.push((tt) => puffs.forEach((p, i) => {
        const k = (tt * 0.16 + i / puffs.length) % 1;
        p.position.set(sx + k * 6, 29.5 + k * 12, -4 + k * 3);
        p.scale.setScalar(0.5 + k * 2.4);
        p.visible = k < 0.97;
      }));
    }
    // brand sign over the arena-facing facade
    const board = nameBoard(def.name, { w: 26, h: 6.5, accent: '#e5483c', bg: '#fff6e6', fg: '#e5483c', frame: 0xe5483c, legH: 0, size: 84 });
    board.position.set(0, 16.5, 11.3);
    f.add(board);
    f.position.set(0, -1.2, fz);
    f.rotation.y = side < 0 ? 0 : Math.PI;
    group.add(f);
    // bottle conveyor gantry between the factory and the pier
    const gz = side * 61;
    const gantry = new THREE.Mesh(new THREE.BoxGeometry(48, 0.6, 1.6), steel);
    gantry.position.set(0, 4.2, gz); gantry.castShadow = true; group.add(gantry);
    const legs = [];
    for (let x = -22; x <= 22; x += 8) for (const dz of [-0.6, 0.6]) legs.push({ p: [x, 1.5, gz + dz], s: [0.25, 5.4, 0.25] });
    instanced(group, boxGeo, steel, legs);
    const bottleGeo = bottleGeometry(0.9);
    const bottleMat = new THREE.MeshStandardMaterial({ color: 0x5fd08a, roughness: 0.08, metalness: 0.1, transparent: true, opacity: 0.85 });
    const nB = 26;
    const line = new THREE.InstancedMesh(bottleGeo, bottleMat, nB);
    group.add(line);
    anim.push((tt) => {
      for (let i = 0; i < nB; i++) {
        let x = ((i / nB) * 48 + tt * 2.2 * side) % 48;
        if (x < 0) x += 48;
        v0.set(x - 24, 4.5, gz);
        line.setMatrixAt(i, m4.compose(v0, q0, s0.set(1, 1, 1)));
      }
      line.instanceMatrix.needsUpdate = true;
    });
  }

  // ---- giant landmark bottles on their own piers
  const glass = new THREE.MeshStandardMaterial({ color: 0x5fd08a, roughness: 0.06, metalness: 0.05, transparent: true, opacity: 0.55, depthWrite: false, envMapIntensity: 1.5 });
  const soda = std(0x9cf0b8, 0.25, 0, { emissive: 0x2a8c55, emissiveIntensity: 0.25 });
  const label = labelTex('FIZZ', '#e5483c', '#ffffff');
  const bigBottles = [];
  for (const side of [-1, 1]) {
    const b = new THREE.Group();
    const H = 24;
    const shell = new THREE.Mesh(bottleGeometry(H), glass);
    const inner = new THREE.Mesh(new THREE.CylinderGeometry(H * 0.162, H * 0.162, H * 0.5, 24), soda);
    inner.position.y = H * 0.27;
    b.add(inner, shell);
    const lab = new THREE.Mesh(new THREE.CylinderGeometry(H * 0.18 * 0.96, H * 0.18 * 0.96, 5, 28, 1, true), std(0xffffff, 0.5, 0, { map: label }));
    lab.position.y = 8.2; b.add(lab);
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(H * 0.065, H * 0.065, 1.0, 20), red);
    cap.position.y = H + 0.3; b.add(cap);
    const base = new THREE.Mesh(new THREE.BoxGeometry(14, 2.4, 14), std(0x8d8a86, 0.9, 0));
    base.position.y = -1.6; b.add(base);
    b.position.set(side * 50, -0.4, side * -14);
    group.add(b);
    bigBottles.push(b);
  }
  anim.push((t) => bigBottles.forEach((b, i) => { b.rotation.y = t * 0.15 + i * Math.PI; }));

  // ---- cargo boats tied up off the wings, bobbing
  const boats = [];
  for (const side of [-1, 1]) {
    const bt = new THREE.Group();
    const hull = new THREE.Mesh(new THREE.BoxGeometry(9, 3, 30), std(0x2f5d8c, 0.6, 0.2));
    hull.position.y = 0.3; bt.add(hull);
    const bow = new THREE.Mesh(new THREE.CylinderGeometry(4.5, 4.5, 3, 3, 1, false, 0, Math.PI), std(0x2f5d8c, 0.6, 0.2));
    bow.rotation.y = Math.PI / 2; bow.scale.set(1, 1, 1.4); bow.position.set(0, 0.3, 15); bt.add(bow);
    const deck = new THREE.Mesh(new THREE.BoxGeometry(8.6, 0.3, 30), std(0xb0503c, 0.8, 0));
    deck.position.y = 1.9; bt.add(deck);
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(7, 4, 5), white);
    cabin.position.set(0, 4, -11.5); bt.add(cabin);
    const cratePlaces = [];
    for (let i = 0; i < 14; i++) cratePlaces.push({ p: [-2.6 + (i % 3) * 2.6, 3.1 + Math.floor(i / 9) * 2.2, -6 + Math.floor((i % 9) / 3) * 6], s: [2.4, 2.2, 5.6], c: [K.red, K.yellow, K.blue, K.mint][i % 4] });
    instanced(bt, boxGeo, std(0xffffff, 0.55, 0.3), cratePlaces);
    bt.position.set(side * -40, -1.3, side * 33);
    bt.userData.ph = side;
    group.add(bt);
    boats.push(bt);
  }
  // little sailboats further out
  for (let i = 0; i < 6; i++) {
    const sb = new THREE.Group();
    const hull = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.8, 5), white); sb.add(hull);
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 6, 6), dark); mast.position.y = 3.2; sb.add(mast);
    const sailG = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0.6, -2), new THREE.Vector3(0, 6, 0.2), new THREE.Vector3(0, 0.6, 1.8)]);
    sailG.computeVertexNormals();
    const sail = new THREE.Mesh(sailG, std([0xffffff, 0xffd23f, 0xff6b5b][i % 3], 0.8, 0, { side: THREE.DoubleSide }));
    sb.add(sail);
    const a = (i / 6) * Math.PI * 2 + 0.4;
    sb.position.set(Math.cos(a) * 90, -1.1, Math.sin(a) * 120);
    sb.rotation.y = r() * Math.PI * 2;
    sb.userData.ph = r() * 6;
    group.add(sb);
    boats.push(sb);
  }
  anim.push((t) => boats.forEach((b) => {
    b.position.y = -1.25 + Math.sin(t * 1.1 + b.userData.ph) * 0.18;
    b.rotation.z = Math.sin(t * 0.8 + b.userData.ph) * 0.04;
  }));

  // ---- seagulls circling overhead
  const gullMat = std(0xffffff, 0.7, 0, { side: THREE.DoubleSide });
  const wingG = new THREE.PlaneGeometry(1.1, 0.35); wingG.translate(0.55, 0, 0);
  const gulls = [];
  for (let i = 0; i < 9; i++) {
    const g = new THREE.Group();
    const w1 = new THREE.Mesh(wingG, gullMat), w2 = new THREE.Mesh(wingG, gullMat);
    w2.scale.x = -1;
    w1.rotation.x = w2.rotation.x = -Math.PI / 2;
    g.add(w1, w2);
    g.userData = { w1, w2, rad: 18 + r() * 40, h: 14 + r() * 14, sp: (0.12 + r() * 0.12) * (r() < 0.5 ? 1 : -1), ph: r() * 6, cz: (r() - 0.5) * 60 };
    group.add(g);
    gulls.push(g);
  }
  anim.push((t) => gulls.forEach((g) => {
    const u = g.userData, a = t * u.sp + u.ph;
    g.position.set(Math.cos(a) * u.rad, u.h + Math.sin(t * 0.7 + u.ph) * 1.5, u.cz + Math.sin(a) * u.rad);
    g.rotation.y = -a + (u.sp > 0 ? 0 : Math.PI);
    const flap = Math.sin(t * 6 + u.ph) * 0.5;
    u.w1.rotation.z = flap; u.w2.rotation.z = -flap;
  }));

  // ---- lighthouse on a far breakwater, with a sweeping beam
  const lh = new THREE.Group();
  const stripes = canvasTex(64, 256, (x, w, h) => { for (let i = 0; i < 8; i++) { x.fillStyle = i % 2 ? '#ffffff' : '#e5483c'; x.fillRect(0, i * h / 8, w, h / 8); } });
  const tower = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 3.4, 26, 20), std(0xffffff, 0.6, 0, { map: stripes }));
  tower.position.y = 13; lh.add(tower);
  const lamp = new THREE.Mesh(new THREE.CylinderGeometry(2, 2, 3, 16), glow(0xfff1b0, 4));
  lamp.position.y = 27.5; lh.add(lamp);
  const roof = new THREE.Mesh(new THREE.ConeGeometry(2.8, 2.5, 16), red); roof.position.y = 30.2; lh.add(roof);
  const beam = new THREE.Mesh(new THREE.ConeGeometry(5, 60, 20, 1, true), new THREE.MeshBasicMaterial({ color: 0xfff6c8, transparent: true, opacity: 0.12, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending }));
  beam.geometry.translate(0, -30, 0); beam.rotation.z = Math.PI / 2;
  const beamPivot = new THREE.Group(); beamPivot.position.y = 27.5; beamPivot.add(beam); lh.add(beamPivot);
  const breakwater = new THREE.Mesh(new THREE.BoxGeometry(70, 3, 7), std(0x9b9a96, 0.95, 0));
  breakwater.position.set(30, -1.5, 0); lh.add(breakwater);
  lh.position.set(-150, -1.2, 170);
  group.add(lh);
  anim.push((t) => { beamPivot.rotation.y = t * 0.8; });

  // ---- distant harbour town + green hills
  const town = [];
  const townCols = [0xf4e1c1, 0xf7c8b5, 0xc9e3f0, 0xfff2d6, 0xd9efe0, 0xf2d0d0];
  for (let i = 0; i < 80; i++) {
    const a = Math.PI * 0.15 + (i / 80) * Math.PI * 1.7 + r() * 0.03;
    const d = 250 + r() * 80;
    const w = 10 + r() * 16, h = 6 + Math.pow(r(), 2.5) * 34, dd = 10 + r() * 14;
    town.push({ p: [Math.cos(a) * d, -1 + h / 2, Math.sin(a) * d], s: [w, h, dd], ry: r() * Math.PI, c: townCols[i % townCols.length] });
  }
  const townMat = std(0xffffff, 0.8, 0.05, { map: canvasTex(64, 64, (x) => { x.fillStyle = '#fff'; x.fillRect(0, 0, 64, 64); x.fillStyle = '#7d9bbd'; for (let j = 0; j < 4; j++) for (let i = 0; i < 4; i++) x.fillRect(i * 16 + 4, j * 16 + 5, 8, 7); }) });
  townMat.map.repeat.set(3, 4);
  instanced(group, boxGeo, townMat, town);
  const hills = [];
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    hills.push({ p: [Math.cos(a) * 420, -20, Math.sin(a) * 420], s: [90 + r() * 80, 50 + r() * 40, 60 + r() * 40], c: [0x7fb071, 0x6ea566, 0x8fbf7a][i % 3] });
  }
  instanced(group, new THREE.SphereGeometry(1, 20, 12), std(0xffffff, 1, 0), hills);

  // ---- buoys
  const buoys = [];
  for (let i = 0; i < 12; i++) {
    const b = new THREE.Group();
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.7, 1.4, 14), std(i % 2 ? K.red : 0xffffff, 0.5, 0)); b.add(body);
    const cap = new THREE.Mesh(new THREE.ConeGeometry(0.4, 0.8, 12), yellow); cap.position.y = 1.1; b.add(cap);
    const a = r() * Math.PI * 2;
    b.position.set(Math.cos(a) * (36 + r() * 25), -1.2, Math.sin(a) * (62 + r() * 20));
    b.userData.ph = r() * 6;
    group.add(b); buoys.push(b);
  }
  anim.push((t) => buoys.forEach((b) => { b.position.y = -1.3 + Math.sin(t * 1.3 + b.userData.ph) * 0.15; b.rotation.z = Math.sin(t * 0.9 + b.userData.ph) * 0.12; }));

  return {
    group,
    update(t) { for (const f of anim) f(t); },
    setTeamColors: (a, b) => setTeamColors(group, a, b),
  };
}
