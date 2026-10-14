// City at night: wet streets between blocks of brick, concrete and glass,
// shopfronts with neon, rooftop clutter, sodium street lamps, traffic lights,
// green gantry signs, billboards, and a skyline glowing on the horizon.
import * as THREE from 'three';
import { stripMesh, glowMaterial } from '../build.js';
import { concreteTexture, groundTexture, facadeTextures, shopfrontTextures, toTex, glowTexture } from '../textures.js';
import { GeoBuilder, streetLamps, signGantry, billboard, skyline, instanced } from './common.js';
import { makeRng, nextFrame } from '../../core/util.js';

const SIDEWALK = 4.6;
const CURB_H = 0.15;

export const terrain = false;

const ADS = [
  [['NITRO-X', 'ENERGY YOU CAN TASTE', 'NOW 30% MORE VOLTS'], ['#0a2a5a', '#fff', '#ffcc00']],
  [['KUROSHIO', 'PERFORMANCE TIRES', 'GRIP IS EVERYTHING'], ['#141414', '#fff', '#ff3a3a']],
  [['MIDNIGHT 88.1', 'THE UNDERGROUND SOUND', 'TUNE IN AFTER DARK'], ['#2a0a3a', '#fff', '#ff44aa']],
  [['RAZOR FUEL', 'RACE GAS · 104 OCTANE', 'FILL UP ON THE FAST LANE'], ['#3a0a0a', '#fff', '#ff8a00']],
  [['BURGER BARN', 'OPEN ALL NIGHT', 'DOUBLE STACK $2.99'], ['#5a1a00', '#ffe9a0', '#ffd000']],
  [['STATIC MOBILE', 'TEXT ALL NIGHT', 'FREE RINGTONES'], ['#003a3a', '#fff', '#00e0c0']],
];

export async function build(world, def, track, progress) {
  const rng = makeRng('city' + def.id);
  const night = !!world.at.lamps;

  // walls sit at the building line
  for (let i = 0; i < track.N; i++) {
    track.WL[i] = track.W[i] + SIDEWALK - 0.2;
    track.WR[i] = track.W[i] + SIDEWALK - 0.2;
  }
  track.shoulder = SIDEWALK;
  track.offSurface = 'sidewalk';
  track.def.shoulderSurface = 'sidewalk';
  track.def.shoulderLift = CURB_H;

  // ---- ground
  const lot = groundTexture('asphaltlot');
  lot.repeat.set(220, 220);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(4000, 4000), new THREE.MeshStandardMaterial({ map: lot, color: 0x9a9a9a, roughness: 0.85 }));
  ground.rotation.x = -Math.PI / 2;
  const b = track.bounds;
  ground.position.set((b.minX + b.maxX) / 2, -0.3, (b.minZ + b.maxZ) / 2);
  ground.receiveShadow = true;
  world.add(ground);

  // ---- sidewalks + curbs
  const conc = concreteTexture('#7a7974', 'walk');
  const walkMat = glowMaterial(new THREE.MeshStandardMaterial({ map: conc, roughness: world.def.weather === 'wet' ? 0.45 : 0.85, envMapIntensity: 0.6 }));
  const curbMat = glowMaterial(new THREE.MeshStandardMaterial({ color: 0x8e8d88, roughness: 0.8 }));
  const W = (i) => track.W[i];
  const left = stripMesh(track, [
    { lat: (i) => W(i), dy: CURB_H, u: 0 },
    { lat: (i) => W(i) + SIDEWALK, dy: CURB_H, u: SIDEWALK / 4 },
  ], walkMat, 4);
  const right = stripMesh(track, [
    { lat: (i) => -W(i) - SIDEWALK, dy: CURB_H, u: 0 },
    { lat: (i) => -W(i), dy: CURB_H, u: SIDEWALK / 4 },
  ], walkMat, 4);
  const curbL = stripMesh(track, [{ lat: (i) => W(i), dy: 0, u: 0 }, { lat: (i) => W(i), dy: CURB_H, u: 1 }], curbMat, 4);
  const curbR = stripMesh(track, [{ lat: (i) => -W(i), dy: CURB_H, u: 0 }, { lat: (i) => -W(i), dy: 0, u: 1 }], curbMat, 4);
  const outerL = stripMesh(track, [{ lat: (i) => W(i) + SIDEWALK, dy: CURB_H, u: 0 }, { lat: (i) => W(i) + SIDEWALK, dy: -0.35, u: 1 }], curbMat, 4);
  const outerR = stripMesh(track, [{ lat: (i) => -W(i) - SIDEWALK, dy: -0.35, u: 0 }, { lat: (i) => -W(i) - SIDEWALK, dy: CURB_H, u: 1 }], curbMat, 4);
  for (const m of [left, right, curbL, curbR, outerL, outerR]) { world.add(m); world.glowMeshes.push(m); }
  progress(0.1, 'POURING SIDEWALKS');
  await nextFrame();

  // ---- buildings
  const styles = ['brick', 'concrete', 'glass', 'stucco', 'dark'];
  const builders = {};
  const mats = {};
  for (const st of styles) {
    for (const v of [0, 1]) {
      const key = `${st}${v}`;
      builders[key] = new GeoBuilder();
      const tx = facadeTextures(st, v + (def.id || ''));
      mats[key] = new THREE.MeshStandardMaterial({
        map: tx.map, emissive: 0xffffff, emissiveMap: tx.emi, emissiveIntensity: night ? 0.9 : 0.0,
        roughness: st === 'glass' ? 0.25 : 0.85, metalness: st === 'glass' ? 0.4 : 0.0, envMapIntensity: st === 'glass' ? 1.2 : 0.3,
      });
    }
  }
  const roofB = new GeoBuilder();
  const shopB = [new GeoBuilder(), new GeoBuilder(), new GeoBuilder()];
  const awningB = new GeoBuilder();
  const occ = new Set();
  const OCC = 4;
  const occKey = (x, z) => Math.floor(x / OCC) * 100000 + Math.floor(z / OCC);
  const footprintFree = (cx, cz, tx, tz, lx, lz, fw, fd) => {
    const cells = [];
    for (let a = -fw / 2; a <= fw / 2; a += OCC * 0.8) {
      for (let d = -fd / 2; d <= fd / 2; d += OCC * 0.8) {
        const x = cx + tx * a + lx * d, z = cz + tz * a + lz * d;
        const k = occKey(x, z);
        if (occ.has(k)) return null;
        cells.push(k);
        // keep clear of every road (incl. other legs of the circuit)
        const ri = track.nearestIndex(x, z, 1);
        if (ri >= 0 && track.distToRoad(x, z) < track.W[ri] + SIDEWALK + 0.6) return null;
      }
    }
    return cells;
  };
  const cx0 = (b.minX + b.maxX) / 2, cz0 = (b.minZ + b.maxZ) / 2;
  const spanR = Math.max(b.maxX - b.minX, b.maxZ - b.minZ) / 2;
  const blades = [];
  const antennas = [];
  let placed = 0;
  for (const side of [1, -1]) {
    let s = 0;
    while (s < track.length) {
      const fw = 12 + rng() * 22;
      const fd = 14 + rng() * 22;
      const p = track.posAt(s + fw / 2, 0);
      const i = p.i;
      const lat = side * (track.W[i] + SIDEWALK + 0.8 + fd / 2);
      const cx = track.X[i] + track.LX[i] * lat, cz = track.Z[i] + track.LZ[i] * lat;
      const tx = track.TX[i], tz = track.TZ[i];
      const lx = track.LX[i] * side, lz = track.LZ[i] * side;
      const cells = footprintFree(cx, cz, tx, tz, lx, lz, fw, fd);
      if (!cells) { s += 5; continue; }
      for (const k of cells) occ.add(k);
      // height: downtown core is tall
      const distC = Math.hypot(cx - cx0, cz - cz0) / spanR;
      const core = Math.max(0, 1 - distC);
      const tall = rng() < 0.25 + core * 0.4;
      const h = tall ? 30 + Math.pow(rng(), 1.5) * (60 + core * 110) : 7 + rng() * 16;
      const st = tall ? (rng() < 0.55 ? 'glass' : rng() < 0.5 ? 'concrete' : 'dark') : (rng() < 0.55 ? 'brick' : rng() < 0.5 ? 'stucco' : 'concrete');
      const key = `${st}${rng() < 0.5 ? 0 : 1}`;
      const ry = Math.atan2(tx, tz) + Math.PI / 2; // box local x along the street
      const gb = builders[key];
      const v0 = Math.floor(rng() * 4) * 0.25;
      gb.box(cx, -0.3, cz, fw, h + 0.25, fd, ry, { uw: st === 'glass' ? 16 : 14, uh: st === 'glass' ? 48 : 40, top: false, v0 });
      // roof cap + parapet
      roofB.box(cx, h - 0.05, cz, fw + 0.4, 0.9, fd + 0.4, ry, { uw: 8, uh: 8 });
      // rooftop clutter
      const nAc = Math.floor(rng() * 4);
      for (let k = 0; k < nAc; k++) {
        const ox = (rng() - 0.5) * fw * 0.6, oz = (rng() - 0.5) * fd * 0.6;
        roofB.box(cx + tx * ox + lx * oz, h + 0.8, cz + tz * ox + lz * oz, 2 + rng() * 3, 1.2 + rng() * 1.5, 2 + rng() * 2, ry, { uw: 4, uh: 4 });
      }
      if (!tall && rng() < 0.18) {
        // water tower
        const ox = (rng() - 0.5) * fw * 0.4, oz = (rng() - 0.5) * fd * 0.4;
        const wx = cx + tx * ox + lx * oz, wz = cz + tz * ox + lz * oz;
        roofB.cylinder(wx, h + 3.2, wz, 2.2, 4.2, 10, 2.2);
        for (const [dx, dz] of [[-1.4, -1.4], [1.4, -1.4], [-1.4, 1.4], [1.4, 1.4]]) roofB.box(wx + dx, h + 0.8, wz + dz, 0.25, 2.5, 0.25, 0);
        roofB.box(wx, h + 7.3, wz, 0.4, 0.8, 0.4, 0);
      }
      if (tall && rng() < 0.6) antennas.push([cx, h + 0.9, cz, 3 + rng() * 9]);
      // shopfront on the street face for low/mid buildings
      if (h < 40 || rng() < 0.5) {
        const fx = cx - lx * (fd / 2 + 0.02), fz = cz - lz * (fd / 2 + 0.02);
        const half = fw / 2 - 0.3;
        const A = new THREE.Vector3(fx - tx * half * side, 0.1, fz - tz * half * side);
        const B2 = new THREE.Vector3(fx + tx * half * side, 0.1, fz + tz * half * side);
        const sb = shopB[Math.floor(rng() * 3)];
        // face the road: winding so the normal points toward the street
        sb.quad(A, B2, new THREE.Vector3(B2.x, 4.3, B2.z), new THREE.Vector3(A.x, 4.3, A.z), [0, 0, Math.max(1, Math.round(fw / 10)), 1]);
        if (rng() < 0.45) {
          const ax = fx - lx * 0.9, az = fz - lz * 0.9;
          awningB.setColor(...[[0.6, 0.1, 0.1], [0.1, 0.3, 0.15], [0.12, 0.15, 0.4], [0.5, 0.35, 0.1]][Math.floor(rng() * 4)]);
          awningB.box(ax, 4.3, az, fw * 0.8, 0.35, 1.8, ry, { uw: 4, uh: 1 });
        }
        if (rng() < 0.22 && night) blades.push({ x: fx - lx * 0.7 + tx * (rng() - 0.5) * fw * 0.6, z: fz - lz * 0.7 + tz * (rng() - 0.5) * fw * 0.6, y: 6 + rng() * 5, ry });
      }
      placed++;
      s += fw + 0.5 + (rng() < 0.15 ? 6 + rng() * 10 : 0); // alleys
    }
  }
  for (const [key, gb] of Object.entries(builders)) {
    if (!gb.count) continue;
    const m = new THREE.Mesh(gb.build(), mats[key]);
    m.castShadow = !night;
    m.receiveShadow = true;
    world.add(m);
  }
  const roofTex = groundTexture('gravel');
  roofTex.repeat.set(1, 1);
  world.add(new THREE.Mesh(roofB.build(), new THREE.MeshStandardMaterial({ map: roofTex, color: 0x7a7a7a, roughness: 0.9 })));
  for (let k = 0; k < 3; k++) {
    if (!shopB[k].count) continue;
    const t = shopfrontTextures(`${def.id}${k}`);
    const m = new THREE.Mesh(shopB[k].build(), new THREE.MeshStandardMaterial({ map: t.map, emissive: 0xffffff, emissiveMap: t.emi, emissiveIntensity: night ? 1.6 : 0.1, roughness: 0.5 }));
    world.add(m);
  }
  if (awningB.count) world.add(new THREE.Mesh(awningB.build(true), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8 })));
  progress(0.55, 'RAISING THE SKYLINE');
  await nextFrame();

  // ---- vertical neon blade signs
  if (blades.length) {
    const words = ['HOTEL', 'BAR', 'CLUB', 'LIVE', 'EAT', 'GARAGE', 'NOODLE', 'JAZZ', 'MOTEL'];
    const cols = ['#ff2a6a', '#2ae0ff', '#ffb02a', '#7aff4a', '#c84aff'];
    const grp = new THREE.Group();
    for (const bl of blades) {
      const word = words[Math.floor(rng() * words.length)];
      const col = cols[Math.floor(rng() * cols.length)];
      const c = document.createElement('canvas');
      c.width = 64; c.height = 256;
      const x = c.getContext('2d');
      x.fillStyle = '#0a0a0c';
      x.fillRect(0, 0, 64, 256);
      x.fillStyle = col;
      x.font = 'bold 40px Arial';
      x.textAlign = 'center';
      x.shadowColor = col;
      x.shadowBlur = 8;
      const step = 230 / word.length;
      for (let k = 0; k < word.length; k++) x.fillText(word[k], 32, 40 + k * step);
      const tex = toTex(c, { repeat: false });
      const m = new THREE.Mesh(new THREE.BoxGeometry(0.25, 4.5, 1.2), new THREE.MeshStandardMaterial({ color: 0x111111, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 2.8, map: tex }));
      m.position.set(bl.x, bl.y, bl.z);
      m.rotation.y = bl.ry;
      grp.add(m);
      world.addStreak(bl.x, bl.y, bl.z, col, 0.9);
    }
    world.add(grp);
  }

  // ---- antennas with blinking aircraft lights
  if (antennas.length) {
    const gb = new GeoBuilder();
    const lights = [];
    for (const [x, y, z, h] of antennas) {
      gb.box(x, y, z, 0.3, h, 0.3, 0);
      lights.push({ x, y: y + h + 0.2, z, s: 0.6 });
    }
    world.add(new THREE.Mesh(gb.build(), new THREE.MeshStandardMaterial({ color: 0x555555, roughness: 0.6, metalness: 0.5 })));
    if (night) {
      const lm = new THREE.MeshBasicMaterial({ color: new THREE.Color('#ff2020').multiplyScalar(6) });
      const im = instanced(new THREE.SphereGeometry(0.35, 6, 4), lm, lights);
      world.add(im);
      let t = 0;
      world.animators.push((dt) => { t += dt; im.visible = (t % 1.6) < 0.8; });
    }
  }

  // ---- street lamps
  streetLamps(world, track, {
    spacing: 30, offset: 1.0, height: 8.5, radius: 18, intensity: 1.15, color: '#ffab52',
    groundY: (x, z, i) => track.Y[i] + CURB_H,
  });
  progress(0.7, 'HANGING SIGNS');
  await nextFrame();

  // ---- traffic lights at the start of corners
  {
    const signals = [];
    let lastS = -100;
    for (let i = 0; i < track.N; i++) {
      const k = Math.abs(track.K[i]);
      const s = i * track.step;
      if (k > 1 / 60 && s - lastS > 120) {
        lastS = s;
        const j = track.idx(i - 8);
        const sd = track.K[i] > 0 ? -1 : 1; // outside of the turn
        const lat = sd * (track.W[j] + 1.4);
        signals.push({ x: track.X[j] + track.LX[j] * lat, z: track.Z[j] + track.LZ[j] * lat, ry: Math.atan2(track.TX[j], track.TZ[j]), i: j, sd });
      }
    }
    const grp = new THREE.Group();
    const pole = new THREE.MeshStandardMaterial({ color: 0x2f3236, roughness: 0.6, metalness: 0.5 });
    const red = new THREE.MeshBasicMaterial({ color: new THREE.Color('#ff2a1a').multiplyScalar(5) });
    const amber = new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffb21a').multiplyScalar(5) });
    const green = new THREE.MeshBasicMaterial({ color: new THREE.Color('#2aff8a').multiplyScalar(5) });
    const off = new THREE.MeshStandardMaterial({ color: 0x151515, roughness: 0.4 });
    const lamps = [];
    for (const sg of signals) {
      const g = new THREE.Group();
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.14, 6, 6), pole);
      post.position.y = 3;
      g.add(post);
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 5), pole);
      arm.position.set(0, 5.8, 0);
      g.add(arm);
      const head = new THREE.Mesh(new THREE.BoxGeometry(0.45, 1.25, 0.35), new THREE.MeshStandardMaterial({ color: 0x1a1a1a }));
      head.position.set(0, 5.3, 2.2);
      g.add(head);
      const bulbs = [];
      for (let k = 0; k < 3; k++) {
        const bulb = new THREE.Mesh(new THREE.CircleGeometry(0.13, 10), off);
        bulb.position.set(0, 5.68 - k * 0.38, 2.2 - 0.18);
        bulb.rotation.y = Math.PI;
        g.add(bulb);
        bulbs.push(bulb);
      }
      g.position.set(sg.x, track.Y[sg.i] + CURB_H, sg.z);
      // arm reaches over the road: rotate so local +z points toward the centerline
      g.rotation.y = Math.atan2(-track.LX[sg.i] * sg.sd, -track.LZ[sg.i] * sg.sd);
      grp.add(g);
      lamps.push({ bulbs, phase: rng() * 12 });
    }
    world.add(grp);
    let t = 0;
    world.animators.push((dt) => {
      t += dt;
      for (const L of lamps) {
        const ph = (t + L.phase) % 12;
        const st = ph < 5 ? 2 : ph < 6.5 ? 1 : 0; // green, amber, red
        L.bulbs[0].material = st === 0 ? red : off;
        L.bulbs[1].material = st === 1 ? amber : off;
        L.bulbs[2].material = st === 2 ? green : off;
      }
    });
  }

  // ---- gantry signs on the long straights
  {
    const lines = def.signs || [
      [['I-9 NORTH', 'PORT HALCYON', '↑'], ['DOWNTOWN', 'EXIT 12', '→']],
      [['MAIN ST', 'NEXT LEFT', '←'], ['HARBOR', 'DOCKS', '↑']],
      [['5TH AVE', 'CIVIC CENTER', '→'], ['AIRPORT', '12 MI', '↑']],
    ];
    let k = 0;
    let runStart = -1;
    for (let i = 0; i < track.N; i++) {
      const straight = Math.abs(track.K[i]) < 1e-4;
      if (straight && runStart < 0) runStart = i;
      if ((!straight || i === track.N - 1) && runStart >= 0) {
        const len = (i - runStart) * track.step;
        if (len > 260 && k < lines.length) {
          signGantry(world, track, (runStart + (i - runStart) * 0.55) * track.step, lines[k]);
          k++;
        }
        runStart = -1;
      }
    }
  }

  // ---- billboards on rooftops near the road
  for (let k = 0; k < 8; k++) {
    const s = (k + 0.5) * track.length / 8 + rng() * 40;
    const p = track.posAt(s, 0);
    const sd = rng() < 0.5 ? 1 : -1;
    const lat = sd * (track.W[p.i] + SIDEWALK + 9);
    const x = track.X[p.i] + track.LX[p.i] * lat, z = track.Z[p.i] + track.LZ[p.i] * lat;
    const [lines, cols] = ADS[k % ADS.length];
    billboard(world, x, 14 + rng() * 10, z, p.heading + Math.PI + (sd > 0 ? 0.35 : -0.35), 12, 6, lines, cols, { legH: 3 });
  }

  // ---- manhole steam
  if (night) {
    const steamTex = glowTexture();
    const puffs = [];
    const grp = new THREE.Group();
    for (let k = 0; k < 10; k++) {
      const s = rng() * track.length;
      const p = track.posAt(s, (rng() - 0.5) * track.W[track.posAt(s).i]);
      for (let j = 0; j < 4; j++) {
        const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: steamTex, color: 0x9aa4b8, transparent: true, opacity: 0.18, depthWrite: false, fog: true }));
        sp.position.set(p.x, p.y + 0.5, p.z);
        sp.scale.setScalar(3);
        grp.add(sp);
        puffs.push({ sp, base: [p.x, p.y, p.z], t: j * 0.9 });
      }
    }
    world.add(grp);
    world.animators.push((dt) => {
      for (const pf of puffs) {
        pf.t = (pf.t + dt) % 3.6;
        const k = pf.t / 3.6;
        pf.sp.position.set(pf.base[0] + k * 0.8, pf.base[1] + 0.4 + k * 5, pf.base[2]);
        pf.sp.scale.setScalar(2 + k * 7);
        pf.sp.material.opacity = 0.22 * Math.sin(k * Math.PI);
      }
    });
  }

  // ---- skyline
  const sk = facadeTextures('dark', 'sky');
  sk.map.repeat.set(1, 1);
  skyline(world, cx0, cz0, spanR + 700, 70, { tex: sk, maxH: 260 });
  progress(1, 'CITY READY');
  void placed;
}

export default { terrain: false, build };
