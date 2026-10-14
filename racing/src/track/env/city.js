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

  // ---- cross streets: side roads every block or two on the straights, closed
  // off with barricades (the race stays on the main drag)
  const crossings = [];
  const XLEN = 75;
  {
    let s = 70 + rng() * 50;
    while (s < track.length - 50) {
      let ok = Math.abs(track.deltaS(track.startS, s)) > 80;
      for (let d = -30; d <= 30 && ok; d += 5) if (Math.abs(track.Ks[track.posAt(s + d).i]) > 1 / 500) ok = false;
      if (!ok) { s += 15; continue; }
      const i = track.posAt(s).i;
      const sides = rng() < 0.55 ? [1, -1] : [rng() < 0.5 ? 1 : -1];
      const w = 11 + rng() * 3;
      for (const side of sides) {
        const tx = track.TX[i], tz = track.TZ[i];
        const lx = track.LX[i] * side, lz = track.LZ[i] * side;
        const off = track.W[i] + SIDEWALK;
        const bx = track.X[i] + lx * off, bz = track.Z[i] + lz * off;
        // the corridor must not run into another leg of the circuit
        let clear = true;
        for (let d = 10; d <= XLEN && clear; d += 10) {
          const x = bx + lx * d, z = bz + lz * d;
          const ri = track.nearestIndex(x, z, 1);
          if (ri >= 0 && Math.abs(track.deltaS(ri * track.step, s)) > 60 && track.distToRoad(x, z) < track.W[ri] + SIDEWALK + 6) clear = false;
        }
        if (!clear) continue;
        crossings.push({ s, i, side, w, tx, tz, lx, lz, bx, bz });
        for (let a = -w / 2 - 1.5; a <= w / 2 + 1.5; a += 2) {
          for (let d = 0; d <= XLEN; d += 2) occ.add(occKey(bx + tx * a + lx * d, bz + tz * a + lz * d));
        }
      }
      s += 150 + rng() * 130;
    }
  }
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
  // side-street blocks: buildings line the corridors and close off the view
  for (const c of crossings) {
    const ryC = Math.atan2(c.lx, c.lz) + Math.PI / 2; // local x along the side street
    for (const flank of [1, -1]) {
      let d = 26 + rng() * 6;
      while (d < XLEN - 6) {
        const fw = 14 + rng() * 14, fd = 12 + rng() * 10;
        const a = flank * (c.w / 2 + 1.8 + fd / 2);
        const x = c.bx + c.tx * a + c.lx * (d + fw / 2), z = c.bz + c.tz * a + c.lz * (d + fw / 2);
        const cells = footprintFree(x, z, c.lx, c.lz, c.tx * flank, c.tz * flank, fw, fd);
        if (cells) {
          for (const k of cells) occ.add(k);
          const h = 9 + rng() * 26;
          const st = rng() < 0.5 ? 'brick' : rng() < 0.5 ? 'stucco' : 'concrete';
          builders[`${st}${rng() < 0.5 ? 0 : 1}`].box(x, -0.3, z, fw, h + 0.25, fd, ryC, { uw: 14, uh: 40, top: false, v0: Math.floor(rng() * 4) * 0.25 });
          roofB.box(x, h - 0.05, z, fw + 0.4, 0.9, fd + 0.4, ryC, { uw: 8, uh: 8 });
        }
        d += fw + 1 + rng() * 3;
      }
    }
    // a tall block at the far end so the street doesn't open onto nothing
    const ex = c.bx + c.lx * (XLEN + 9), ez = c.bz + c.lz * (XLEN + 9);
    const ew = c.w + 24, h = 22 + rng() * 40;
    const cells = footprintFree(ex, ez, c.tx, c.tz, c.lx, c.lz, ew, 16);
    if (cells) {
      for (const k of cells) occ.add(k);
      const st = rng() < 0.5 ? 'concrete' : 'glass';
      builders[`${st}${rng() < 0.5 ? 0 : 1}`].box(ex, -0.3, ez, ew, h + 0.25, 16, Math.atan2(c.tx, c.tz) + Math.PI / 2, { uw: st === 'glass' ? 16 : 14, uh: st === 'glass' ? 48 : 40, top: false });
      roofB.box(ex, h - 0.05, ez, ew + 0.4, 0.9, 16.4, Math.atan2(c.tx, c.tz) + Math.PI / 2, { uw: 8, uh: 8 });
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
    const m = new THREE.Mesh(shopB[k].build(), new THREE.MeshStandardMaterial({ map: t.map, emissive: 0xffffff, emissiveMap: t.emi, emissiveIntensity: night ? 1.05 : 0.08, roughness: 0.5 }));
    world.add(m);
  }
  if (awningB.count) world.add(new THREE.Mesh(awningB.build(true), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8 })));
  if (crossings.length) buildSideStreets(world, track, crossings, XLEN, night, rng);
  world.crossings = crossings.map((c) => ({ s: c.s, side: c.side }));
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
    for (const c of crossings) {
      const j = track.idx(c.i - 5);
      const lat = c.side * (track.W[j] + 1.4);
      signals.push({ x: track.X[j] + track.LX[j] * lat, z: track.Z[j] + track.LZ[j] * lat, ry: 0, i: j, sd: c.side });
    }
    // batched: one static mesh for every pole/arm/head, one instanced mesh per
    // bulb color (lit bulbs are scaled to zero when off)
    const gb = new GeoBuilder();
    const o3 = new THREE.Object3D();
    const bulbM = [];
    for (const sg of signals) {
      o3.position.set(sg.x, track.Y[sg.i] + CURB_H, sg.z);
      o3.rotation.set(0, Math.atan2(-track.LX[sg.i] * sg.sd, -track.LZ[sg.i] * sg.sd), 0);
      o3.updateMatrix();
      const ry = o3.rotation.y;
      const L = (lx, ly, lz) => new THREE.Vector3(lx, ly, lz).applyMatrix4(o3.matrix);
      gb.setColor(0.18, 0.19, 0.21);
      const base = L(0, 0, 0);
      gb.cylinder(base.x, base.y, base.z, 0.14, 6, 8, 0.12);
      const arm = L(0, 5.8, 2.5);
      gb.box(arm.x, arm.y - 0.06, arm.z, 0.12, 0.12, 5, ry);
      gb.setColor(0.08, 0.08, 0.09);
      const head = L(0, 4.67, 2.2);
      gb.box(head.x, head.y, head.z, 0.45, 1.25, 0.35, ry);
      // lamps face the traffic coming down the road
      const tx = track.TX[sg.i], tz = track.TZ[sg.i];
      const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, Math.atan2(-tx, -tz), 0));
      for (let k = 0; k < 3; k++) {
        const bp = L(0, 5.68 - k * 0.38, 2.2).add(new THREE.Vector3(-tx * 0.19, 0, -tz * 0.19));
        bulbM.push(new THREE.Matrix4().compose(bp, q, new THREE.Vector3(1, 1, 1)));
      }
    }
    world.add(new THREE.Mesh(gb.build(true), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, metalness: 0.4 })));
    const n = signals.length;
    const disc = new THREE.CircleGeometry(0.13, 10);
    const offIM = new THREE.InstancedMesh(disc, new THREE.MeshStandardMaterial({ color: 0x151515, roughness: 0.4 }), n * 3);
    bulbM.forEach((m, k) => offIM.setMatrixAt(k, m));
    world.add(offIM);
    const cols = ['#ff2a1a', '#ffb21a', '#2aff8a'];
    const litIM = cols.map((c) => {
      const im = new THREE.InstancedMesh(disc, new THREE.MeshBasicMaterial({ color: new THREE.Color(c).multiplyScalar(5) }), n);
      im.frustumCulled = false;
      world.add(im);
      return im;
    });
    const phases = signals.map(() => rng() * 12);
    const zero = new THREE.Matrix4().makeScale(0, 0, 0);
    const lift = new THREE.Matrix4().makeTranslation(0, 0, 0);
    let t = 0;
    world.animators.push((dt) => {
      t += dt;
      for (let k = 0; k < n; k++) {
        const ph = (t + phases[k]) % 12;
        const st = ph < 5 ? 2 : ph < 6.5 ? 1 : 0; // green, amber, red
        for (let c = 0; c < 3; c++) {
          // bulb order top→bottom is red, amber, green
          litIM[c].setMatrixAt(k, c === st ? bulbM[k * 3 + c].clone().multiply(lift) : zero);
        }
      }
      for (const im of litIM) im.instanceMatrix.needsUpdate = true;
    });
    void lift;
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

/** Side-street pavement (crosswalk, stop line, center line) and the barricades. */
function buildSideStreets(world, track, crossings, len, night, rng) {
  const wet = world.def.weather !== 'dry';
  const c = document.createElement('canvas');
  c.width = 256; c.height = 1024;
  const x = c.getContext('2d');
  x.fillStyle = '#2b2c2f';
  x.fillRect(0, 0, 256, 1024);
  for (let i = 0; i < 9000; i++) {
    x.fillStyle = rng() < 0.5 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.12)';
    x.fillRect(rng() * 256, rng() * 1024, 2, 2);
  }
  // v = 0 at the main road: zebra crosswalk, stop line, then the center line
  x.fillStyle = 'rgba(232,230,220,0.85)';
  for (let k = 0; k < 7; k++) x.fillRect(14 + k * 34, 1024 - 70, 20, 56);
  x.fillRect(128, 1024 - 98, 118, 10);
  x.fillStyle = 'rgba(230,180,40,0.8)';
  x.fillRect(122, 0, 5, 1024 - 110);
  x.fillRect(131, 0, 5, 1024 - 110);
  const tex = toTex(c, { repeat: false });
  const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: wet ? 0.38 : 0.85, envMapIntensity: wet ? 0.9 : 0.3 });
  const gb = new GeoBuilder();
  const bar = new GeoBuilder();
  const lamps = [];
  for (const cr of crossings) {
    const y = track.Y[cr.i] + 0.02;
    const hw = cr.w / 2;
    const P = (a, d) => new THREE.Vector3(cr.bx + cr.tx * a + cr.lx * d, y, cr.bz + cr.tz * a + cr.lz * d);
    // winding: normal must point up whichever side we're on
    const A = P(-hw, 0), B = P(hw, 0), C2 = P(hw, len), D = P(-hw, len);
    const up = new THREE.Vector3().subVectors(B, A).cross(new THREE.Vector3().subVectors(D, A)).y > 0;
    if (up) gb.quad(A, B, C2, D, [0, 0, 1, 1]); else gb.quad(B, A, D, C2, [1, 0, 0, 1]);
    // barricades: three striped sawhorses across the mouth, amber lamps on top
    const ry = Math.atan2(cr.tx, cr.tz) + Math.PI / 2;
    for (let k = 0; k < 3; k++) {
      const a = -hw + 1.6 + k * ((cr.w - 3.2) / 2) + (rng() - 0.5) * 0.6;
      const d = 1.2 + (rng() - 0.5) * 0.5;
      const bx = cr.bx + cr.tx * a + cr.lx * d, bz = cr.bz + cr.tz * a + cr.lz * d;
      const yb = track.Y[cr.i] + 0.15;
      bar.setColor(1, 1, 1);
      bar.box(bx, yb + 0.62, bz, 2.0, 0.3, 0.07, ry, { uFit: true, uh: 0.3, topUv: [0, 0, 0.01, 0.01] });
      bar.setColor(0.85, 0.85, 0.85);
      for (const e of [-0.8, 0.8]) bar.box(bx + cr.tx * e, yb, bz + cr.tz * e, 0.08, 0.92, 0.5, ry, { uw: 1, uh: 1, topUv: [0.99, 0.99, 1, 1] });
      lamps.push({ x: bx + cr.tx * 0.85, y: yb + 0.92, z: bz + cr.tz * 0.85 });
    }
  }
  world.add(new THREE.Mesh(gb.build(), mat));
  // striped board texture (orange/white diagonals with ROAD CLOSED)
  const bc = document.createElement('canvas');
  bc.width = 256; bc.height = 40;
  const bx2 = bc.getContext('2d');
  bx2.fillStyle = '#f2f2ee';
  bx2.fillRect(0, 0, 256, 40);
  bx2.fillStyle = '#ff6a14';
  for (let k = -2; k < 16; k++) { bx2.beginPath(); bx2.moveTo(k * 24, 40); bx2.lineTo(k * 24 + 12, 40); bx2.lineTo(k * 24 + 32, 0); bx2.lineTo(k * 24 + 20, 0); bx2.fill(); }
  bx2.fillStyle = '#f2f2ee';
  bx2.fillRect(78, 6, 100, 28);
  bx2.fillStyle = '#111';
  bx2.font = 'bold 15px Arial';
  bx2.textAlign = 'center';
  bx2.fillText('ROAD CLOSED', 128, 26);
  const bt = toTex(bc, { repeat: false });
  world.add(new THREE.Mesh(bar.build(true), new THREE.MeshStandardMaterial({ map: bt, vertexColors: true, roughness: 0.6 })));
  if (night && lamps.length) {
    const lm = new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffb21a').multiplyScalar(5) });
    const im = instanced(new THREE.SphereGeometry(0.11, 8, 6), lm, lamps);
    world.add(im);
    let t = 0;
    world.animators.push((dt) => { t += dt; im.visible = (t % 1.0) < 0.5; });
  }
}

export default { terrain: false, build };
