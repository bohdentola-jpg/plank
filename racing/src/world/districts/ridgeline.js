// PORT HALCYON — RIDGELINE: the windy crest east of the Summit. A line of
// big white wind turbines along the ridge, blades turning, their red lights
// blinking together at night (seen from all over town); on its own hill at
// the end of the gravel Tower Road, the 92.7 transmitter: a red-and-white
// lattice mast held by its guy wires, lights blinking up its height, the
// station's hut with THE UNDERGROUND's sign. Between them, golden tussock
// grass, grey rock fins along the spine, the odd wind-flagged krummholz pine,
// white delineator posts and a barbed-wire ranch fence beside the road, and
// the wind farm's substation humming behind its fence.
import * as THREE from 'three';
import { litMat, plainMat, box, gable, cylinder, cone, lattice, drape } from './builder.js';
import { shoulderMat } from '../kit.js';
import { Acc } from '../build/geo.js';
import { lin, mixc, mulc, frame, roadField, lampTest, levelness, useGround, cellPoints, ownAcc, ownMesh } from './peaks/util.js';
import * as F from './peaks/flora.js';
import { bends, poles, cuts, drapeCut, eachOwnedSample } from './peaks/roadside.js';
import { cellUV, board } from './peaks/parts.js';
import { findFlat } from './peaks/sites.js';
import { usSignTex, rockFaceTex } from './peaks/tex.js';
import { ZONES } from '../map/base.js';

const PAL = {
  krum: lin('#26402a'), krumHi: lin('#3e5a34'), krumBark: lin('#5a4a3a'), snag: lin('#9a9488'),
  grass: lin('#8a7440'), grassHi: lin('#b89a52'), grassTip: lin('#d8c27a'),
  rock: lin('#7a7468'), rockDark: lin('#4a463e'), white: lin('#eceef0'), offwhite: lin('#d6d8da'),
  steel: lin('#3a3e44'), red: lin('#c8201e'), orange: lin('#ff8a10'), concrete: lin('#8e8c86'),
  post: lin('#e8e8e2'), wood: lin('#6a5038'), wire: lin('#2a2a2a'), gravel: lin('#7a746a'), dish: lin('#d8dadc'),
  green: lin('#2e5a3a'), yellow: lin('#e8c020'),
};

function mats(B) {
  return {
    veg: B.mat('veg', () => litMat({ vertexColors: true, roughness: 0.92, flatShading: true }, { glow: 2.0 })),
    vegDark: B.mat('vegDark', () => plainMat({ vertexColors: true, roughness: 0.92, flatShading: true })),
    rock: B.mat('rock', () => litMat({ vertexColors: true, roughness: 0.95, flatShading: true })),
    rockDark: B.mat('rockDark', () => plainMat({ vertexColors: true, roughness: 0.95, flatShading: true })),
    props: B.mat('props', () => litMat({ vertexColors: true, roughness: 0.6, metalness: 0.15 })),
    turbine: B.mat('turbine', () => plainMat({ vertexColors: true, roughness: 0.4, metalness: 0.2, envMapIntensity: 0.8 })),
    face: B.mat('face', () => litMat({ map: rockFaceTex(false), roughness: 0.95, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 })),
    signs: B.mat('signs', () => { const t = usSignTex(); return litMat({ map: t.map, emissive: 0xffffff, emissiveMap: t.emi, roughness: 0.55 }, { night: 1.3 }); }),
    glowCold: B.mat('glowCold', () => litMat({ color: 0xdfe8f0, emissive: 0xd8e6ff, roughness: 0.4 }, { night: 2.4 })),
    beacon: B.mat('beacon', () => new THREE.MeshBasicMaterial({ color: new THREE.Color('#ff2020').multiplyScalar(3) })),
    reflector: B.mat('reflector', () => litMat({ color: 0xff8a20, emissive: 0xff7a10, roughness: 0.4 }, { night: 0.9 })),
    yard: shoulderMat('gravel'),
  };
}

// ------------------------------------------------------------------ plan

const RIDGE = ZONES.find((z) => z.id === 'ridge');

function plan(P) {
  windFarm(P);
  radioTower(P);
  substation(P);
}

function windFarm(P) {
  const path = RIDGE ? RIDGE.path : [[1500, -3700], [4300, -2900]];
  const sites = [];
  // walk the crest; at each step look across it for the highest free spot
  for (let k = 0; k < path.length - 1; k++) {
    const [ax, az] = path[k], [bx, bz] = path[k + 1];
    const L = Math.hypot(bx - ax, bz - az), ux = (bx - ax) / L, uz = (bz - az) / L;
    for (let s = 0; s < L; s += 60) {
      const cx = ax + ux * s, cz = az + uz * s;
      let best = null;
      for (let o = -160; o <= 160; o += 20) {
        const x = cx - uz * o, z = cz + ux * o;
        if (!P.inside(x, z, 40)) continue;
        if (sites.some((q) => Math.hypot(q.x - x, q.z - z) < 240)) continue;
        if (!P.isFree(x, z, 16, 16, 0, { pad: 1, roadPad: true })) continue;
        const nr = P.nearestRoad(x, z, 60);
        if (nr && nr.d < 34) continue;
        const y = P.groundY(x, z);
        const score = y - Math.abs(o) * 0.08;
        if (!best || score > best.score) best = { x, z, y, score };
      }
      if (best) sites.push(best);
    }
  }
  let cx = 0, cz = 0;
  sites.forEach((q, k) => {
    const y = P.groundRange(q.x, q.z, 8, 8, 0).lo;
    P.claim(q.x, q.z, 12, 12, 0);
    // into the westerly wind, each a touch off (they yaw on their own)
    const ry = -Math.PI / 2 + Math.sin(k * 1.7) * 0.18;
    P.add({ type: 'turbine', x: q.x, z: q.z, y, ry, phase: k * 0.83, map: 'building' });
    P.collider({ kind: 'circle', x: q.x, z: q.z, r: 2.6, y0: y - 3, y1: y + 80 });
    P.far({ shape: 'cyl', x: q.x, z: q.z, y: y - 2, r: 2.0, r2: 1.3, h: 80, color: '#e4e6e8' });
    P.far({ x: q.x, z: q.z, y: y + 78, w: 9, d: 3.6, h: 3.6, ry, color: '#e0e2e4' });
    P.lamp({ x: q.x, z: q.z, y, hx: q.x, hz: q.z, hy: y + 82, color: '#ff2020', radius: 3, intensity: 0.2, halo: 4 });
    cx += q.x; cz += q.z;
  });
  if (sites.length) P.landmark({ id: 'windfarm', name: 'RIDGELINE WIND FARM', x: cx / sites.length, z: cz / sites.length, r: 400, kind: 'windfarm' });
}

function radioTower(P) {
  const n = P.net.nodes.get('tw_top');
  if (!n) return;
  const e = n.ends[0];
  // the mast just past the end of the road, the hut beside the turnaround
  const x = n.x - e.dx * 30, z = n.z - e.dz * 30;
  const y = P.groundY(x, z);
  const ry = Math.atan2(e.dx, e.dz);
  P.claim(x, z, 44, 44, 0);
  P.add({ type: 'mast', x, z, y, ry, nx: n.x, nz: n.z, ny: n.y, map: 'yard' });
  P.collider({ kind: 'circle', x, z, r: 2.5, y0: y - 3, y1: y + 140 });
  const L = frame(x, y, z, ry);
  const [hx, hz] = L.xz(13, 10);
  P.collider({ kind: 'box', x: hx, z: hz, hx: 4.4, hz: 3, ry, y0: y - 3, y1: y + 4 });
  // the guy anchors
  for (let k = 0; k < 3; k++) {
    const a = ry + (k / 3) * Math.PI * 2 + 0.5;
    const ax = x + Math.cos(a) * 62, az = z + Math.sin(a) * 62;
    P.collider({ kind: 'circle', x: ax, z: az, r: 1.2, y0: P.groundY(ax, az) - 2, y1: P.groundY(ax, az) + 2 });
  }
  for (const h of [48, 96, 140]) P.lamp({ x, z, y, hx: x, hz: z, hy: y + h, color: '#ff2020', radius: 3, intensity: 0.2, halo: h === 140 ? 5 : 3.5 });
  P.lamp({ x: hx, z: hz, y, hx, hz, hy: y + 4.6, color: '#ff4a8a', radius: 12, intensity: 1.0, halo: 1.6 });
  P.lamp({ x: n.x, z: n.z, y: n.y, hx: n.x, hz: n.z, hy: n.y + 6, color: '#dfe8ff', radius: 16, intensity: 0.7, halo: 2 });
  P.far({ shape: 'cone', x, z, y: y - 2, r: 3.5, h: 144, color: '#c84030' });
  P.far({ x: hx, z: hz, y: y - 2, w: 9, d: 6, h: 5, ry, color: '#7a7870', lit: 0.3 });
  P.landmark({ id: 'tower', name: 'THE 92.7 TOWER', x, z, r: 30, kind: 'tower', hidden: true });
}

function substation(P) {
  const r = P.net.byId.get('rg_r3') || P.net.byId.get('rg_r2');
  if (!r) return;
  const mid = r.posAt(r.length * 0.5);
  const f = findFlat(P, mid.x, mid.z, 34, 24, 120, { roadPad: true, step: 12, pull: 0.03 });
  if (!f) return;
  const y = f.lo;
  P.add({ type: 'substation', x: f.x, z: f.z, ry: f.ry, y, w: f.w, d: f.d, map: 'yard' });
  P.collider({ kind: 'box', x: f.x, z: f.z, hx: f.w / 2, hz: f.d / 2, ry: f.ry, y0: y - 3, y1: y + 9 });
  const L = frame(f.x, y, f.z, f.ry);
  for (const [ox, oz] of [[-12, 8], [12, 8]]) {
    const [px, pz] = L.xz(ox, oz);
    P.lamp({ x: px, z: pz, y, hx: px, hz: pz, hy: y + 9, color: '#e8f0ff', radius: 22, intensity: 0.8, halo: 2.2 });
  }
  P.far({ x: f.x, z: f.z, y: y - 1, w: 34, d: 24, h: 8, ry: f.ry, color: '#5a5c60', lit: 0.1 });
}

// ------------------------------------------------------------------ scatter

const LIT = new Set(['krum', 'snag', 'rock', 'crag', 'tuss']);

function scatter(S) {
  useGround(S);
  const field = roadField(S.net, S.cx, S.cz);
  const lit = lampTest(S);
  const add0 = S.add.bind(S);
  S.add = (it) => { if (LIT.has(it.type)) it.lit = lit(it.x, it.z); return add0(it); };
  for (const it of bends(S, { rMax: 60 })) S.add(it);
  for (const it of poles(S, 'delin', { every: 22, off: 0.9, both: true })) S.add(it);
  for (const it of poles(S, 'fence', { every: 4.5, off: 9, side: -1, free: true, wires: true, filter: (r) => r.rt.id === 'mountain' })) S.add(it);
  for (const it of cuts(S, 'face', { minRise: 3.5 })) S.add(it);
  // tussock grass thick by the road and thinning away from it (scattered in a band along the roads)
  eachOwnedSample(S, (r, i) => {
    if (i % 3) return;
    const reach = r.rt.hw + r.rt.shoulder + r.rt.walk;
    for (let k = 0; k < 7; k++) {
      const sd = S.rng() < 0.5 ? 1 : -1, off = reach + 1.5 + Math.pow(S.rng(), 1.6) * 55, along = (S.rng() - 0.5) * 6;
      const x = r.X[i] + r.LX[i] * sd * off + r.TX[i] * along, z = r.Z[i] + r.LZ[i] * sd * off + r.TZ[i] * along;
      const s = S.range(0.7, 1.4), t = S.rng();
      if (x < S.x0 || x >= S.x1 || z < S.z0 || z >= S.z1 || !S.inside(x, z) || !S.free(x, z, 1.5, true)) continue;
      S.add({ type: 'tuss', x, z, y: S.groundY(x, z), s, t });
    }
  });
  // krummholz pines in the lee, snags, rock fins along the spine, boulders
  for (const [x, z] of cellPoints(S, 18, { r: 2, density: (px, pz) => 0.2 + 0.5 * (0.5 + 0.5 * S.noise(px / 150 + 4, pz / 150)) })) {
    const y = S.groundY(x, z);
    const t = S.rng();
    const d = field.at(x, z);
    if (d < 4) continue;
    if (d < 30 && levelness(S.groundY, x, z) < 0.8) continue;
    if (t < 0.12) S.add({ type: 'snag', x, z, y, h: 5 + t * 30, t });
    else S.add({ type: 'krum', x, z, y, h: 3 + t * 5, t });
    if (d < 40) S.collider({ kind: 'circle', x, z, r: 0.4, y0: y - 1, y1: y + 4 });
  }
  for (const [x, z] of cellPoints(S, 26, { r: 3 })) {
    const y = S.groundY(x, z);
    const k = S.rng(), s = S.range(1.2, 3.4), t = S.rng();
    const high = S.noise(x / 200 - 3, z / 200 + 8);
    if (k < 0.18 + Math.max(0, high) * 0.3) {
      S.add({ type: 'crag', x, z, y, s: s * 2.6, t });
      if (field.at(x, z) < 50) S.collider({ kind: 'circle', x, z, r: s * 1.1, y0: y - 1, y1: y + s * 2.6 });
    } else if (k < 0.5) {
      S.add({ type: 'rock', x, z, y, s, t });
      if (s > 1.6 && field.at(x, z) < 50) S.collider({ kind: 'circle', x, z, r: s * 0.5, y0: y - 1, y1: y + s });
    }
  }
}

// ------------------------------------------------------------------ build

const HEAVY = new Set(['turbine', 'mast', 'substation', 'face', 'fence']);

function* build(B, items) {
  const m = mats(B);
  useGround(B);
  const vegL = B.acc(m.veg), vegD = ownAcc(m.vegDark), rockL = B.acc(m.rock), rockD = B.acc(m.rockDark);
  const V = (it) => (it.lit ? vegL : vegD), R = (it) => (it.lit ? rockL : rockD);
  const nearL = B.near(m.veg), nearD = B.near(m.vegDark), N = (it) => (it.lit ? nearL : nearD);
  let n = 0;
  for (const it of items) {
    switch (it.type) {
      case 'tuss': F.tussock(N(it), it.x, it.y, it.z, it.s, it.t, PAL); break;
      case 'krum': F.krummholz(V(it), it.x, it.y, it.z, it.h, it.t, PAL, 1, 0.15); break;
      case 'snag': F.snag(V(it), it.x, it.y, it.z, it.h, it.t, PAL.snag); break;
      case 'rock': F.rock(R(it), it.x, it.y, it.z, it.s, 0.75, it.t, PAL.rock, PAL.rockDark); break;
      case 'crag': F.crag(R(it), it.x, it.y, it.z, it.s, it.t, PAL.rock, PAL.rockDark); break;
      case 'chev': {
        const y = Math.max(B.groundY(it.x, it.z), it.y - 3);
        const props = B.near(m.props);
        props.col = PAL.steel;
        box(props, it.x, y - 0.4, it.z, 0.08, Math.max(1.7, it.y + 1.2 - y + 0.4), 0.08, it.ry);
        board(B.near(m.signs), it.x, Math.max(it.y, y) + 1.45, it.z, 0.6, 0.75, it.ry, cellUV(it.cell));
        break;
      }
      case 'delin': {
        const y = Math.max(B.groundY(it.x, it.z), it.y - 1.2);
        const props = B.near(m.props);
        props.col = PAL.post;
        box(props, it.x, y - 0.2, it.z, 0.12, 1.35, 0.12, it.ry);
        box(B.near(m.reflector), it.x, y + 0.92, it.z, 0.13, 0.14, 0.13, it.ry);
        break;
      }
      case 'fence': fencePost(B, m, it); break;
      case 'face': drapeCut(B, B.acc(m.face), it, { tile: 6, maxW: 30 }); break;
      case 'turbine': turbine(B, m, it); break;
      case 'mast': mast(B, m, it); break;
      case 'substation': substation3d(B, m, it); break;
      default: break;
    }
    if (++n % 30 === 0 || HEAVY.has(it.type)) yield;
  }
  yield* ownMesh(B, vegD);
}

function fencePost(B, m, it) {
  const y = B.groundY(it.x, it.z);
  const acc = B.near(m.props);
  acc.col = PAL.wood;
  box(acc, it.x, y - 0.2, it.z, 0.12, 1.45, 0.12, it.ry);
  if (it.nx === undefined) return;
  const ny = B.groundY(it.nx, it.nz);
  acc.col = PAL.wire;
  for (const h of [0.45, 0.8, 1.15]) acc.beam(it.x, y + h, it.z, it.nx, ny + h, it.nz, 0.02, 0.02);
}

// ------------------------------------------------------------------ the turbines

function turbine(B, m, it) {
  const { x, z, y, ry } = it;
  const tw = B.acc(m.turbine);
  tw.col = PAL.white;
  // a concrete foot, the tapered tower, a green band near the base
  const props = B.acc(m.props);
  props.col = PAL.concrete;
  cylinder(props, x, y - 1.5, z, 3.6, 2.0, 12, { top: true });
  tw.col = PAL.green;
  cylinder(tw, x, y + 0.5, z, 2.2, 4, 14, { r2: 2.16 });
  tw.col = PAL.white;
  cylinder(tw, x, y + 4.5, z, 2.16, 74, 14, { r2: 1.35 });
  // the nacelle, facing into the wind
  const H = y + 79;
  const P = frame(x, H, z, ry);
  const c = P(0, 0, 1.5);
  box(tw, c[0], H - 1.6, c[2], 3.6, 3.4, 10, ry);
  const bq = P(0, 1.85, -1.5);
  box(B.acc(m.beacon), bq[0], bq[1], bq[2], 0.5, 0.35, 0.5, ry);
  // the rotor: its own mesh, turning
  const rot = new Acc(true);
  rot.col = PAL.white;
  // a spinner nose (pointing along +z local) and three blades in the local x-y plane
  const nose = [];
  for (let k = 0; k < 8; k++) { const a = (k / 8) * Math.PI * 2; nose.push(rot.v(Math.cos(a) * 1.7, Math.sin(a) * 1.7, 0)); }
  const tip = rot.v(0, 0, 3.2);
  for (let k = 0; k < 8; k++) rot.tri(nose[k], nose[(k + 1) % 8], tip);
  for (let b = 0; b < 3; b++) {
    const a = (b / 3) * Math.PI * 2;
    const ca = Math.cos(a), sa = Math.sin(a);
    const Q = (r, w, d) => [ca * r - sa * w, sa * r + ca * w, d];
    // root to tip, a flat twisted blade with a little thickness
    const pts = [[1.4, 1.3, 0.35], [8, 1.6, 0.3], [24, 0.95, 0.18], [38, 0.3, 0.06]];
    for (let k = 0; k < pts.length - 1; k++) {
      const [r0, w0, t0] = pts[k], [r1, w1, t1] = pts[k + 1];
      const tw0 = k * 0.12, tw1 = (k + 1) * 0.12;
      const a0 = Q(r0, -w0, t0 + tw0 * w0), b0 = Q(r0, w0, -t0 - tw0 * w0), a1 = Q(r1, -w1, t1 + tw1 * w1), b1 = Q(r1, w1, -t1 - tw1 * w1);
      rot.quadP(a0, b0, b1, a1);
      rot.quadP(b0, a0, a1, b1);
    }
  }
  const mesh = new THREE.Mesh(rot.toGeometry(false), m.turbine);
  const hubPos = P(0, 0, 7.0);
  mesh.position.set(hubPos[0], H, hubPos[2]);
  mesh.rotation.order = 'YXZ';
  mesh.rotation.y = ry;
  B.group.add(mesh);
  const w = 1.05 + Math.sin(it.phase * 3.1) * 0.12;
  B.anim((t, dt, d) => { if (d < 900) mesh.rotation.z = it.phase + t * w; });
  B.anim(beaconBlink(m.beacon));
}

/** Red obstruction lights blink together (the whole farm, the mast). */
function beaconBlink(mat) {
  return (t) => {
    const on = (t % 2.0) < 0.9;
    mat.color.setRGB(on ? 3 : 0.2, on ? 0.1 : 0.01, on ? 0.1 : 0.01);
  };
}

// ------------------------------------------------------------------ the 92.7 tower

function mast(B, m, it) {
  const { x, z, y, ry } = it;
  const L = frame(x, y, z, ry);
  const props = B.acc(m.props);
  const gy = (lx, lz) => { const q = L.xz(lx, lz); return B.groundY(q[0], q[1]); };
  // the turnaround and yard: gravel
  const yard = [L.xz(-16, -16), L.xz(16, -16), L.xz(16, 18), L.xz(-16, 18)];
  drape(B.acc(m.yard), B, yard, { lift: 0.05, uv: 5 });
  // a concrete pad and the lattice mast in red and white bands, narrowing as it climbs
  props.col = PAL.concrete;
  box(props, x, y - 1, z, 5, 1.4, 5, ry);
  const H = 140, seg = 7;
  for (let k = 0; k < seg; k++) {
    const y0 = y + 0.4 + (k / seg) * H, y1 = y + 0.4 + ((k + 1) / seg) * H;
    const w = 2.6 - k * 0.18;
    props.col = k % 2 ? PAL.white : PAL.red;
    lattice(props, [x, y0, z], [x, y1, z], w, { bay: 3.2, bar: 0.14 });
  }
  props.col = PAL.red;
  cylinder(props, x, y + H, z, 0.2, 8, 6);
  // the blinking lights up its height
  const bea = B.acc(m.beacon);
  for (const h of [48, 96, 140, 148]) box(bea, x, y + h, z, 0.6, 0.45, 0.6);
  B.anim(beaconBlink(m.beacon));
  // guy wires: three ways, three heights, to anchors on the ground
  props.col = PAL.wire;
  for (let k = 0; k < 3; k++) {
    const a = ry + (k / 3) * Math.PI * 2 + 0.5;
    const ax = x + Math.cos(a) * 62, az = z + Math.sin(a) * 62, ay = B.groundY(ax, az);
    for (const h of [45, 90, 132]) props.beam(x, y + h, z, ax, ay + 0.6, az, 0.05, 0.05);
    props.col = PAL.concrete;
    box(props, ax, ay - 1, az, 2, 1.8, 2, a);
    props.col = PAL.wire;
  }
  // a microwave dish on the mast
  props.col = PAL.dish;
  const dq = L.xz(0, 1.8);
  cylinder(props, dq[0], y + 60, dq[1], 1.3, 0.6, 12, { top: true });
  // the transmitter hut with the station's lit sign, an AC unit and a fence round the yard
  const [hx, hz] = L.xz(13, 10);
  const hy = gy(13, 10);
  props.col = PAL.concrete;
  box(props, hx, hy - 1, hz, 8.8, 4.4, 6, ry);
  props.col = PAL.steel;
  box(props, hx, hy + 3.4, hz, 9.4, 0.3, 6.6, ry);
  const fq = L.xz(13, 13.05);
  board(B.acc(m.signs), fq[0], hy + 2.2, fq[1], 3.0, 3.0, ry, cellUV(4), cellUV(7, 4, 2, 0.02));
  const lq = L.xz(9.5, 13.2);
  box(B.acc(m.glowCold), lq[0], hy + 2.6, lq[1], 0.5, 0.3, 0.3, ry);
  props.col = PAL.offwhite;
  const ac = L.xz(18.6, 10);
  box(props, ac[0], hy - 0.5, ac[1], 1.4, 1.5, 1.4, ry);
  // the fence: posts and three wires round the yard (a gate gap toward the road)
  const corners = [[-15, -15], [15, -15], [15, 17], [3, 17], [-3, 17], [-15, 17]];
  const near = B.near(m.props);
  for (let k = 0; k < corners.length - 1; k++) {
    if (k === 3) continue;
    const a = corners[k], b = corners[(k + 1) % corners.length];
    const A = L.xz(a[0], a[1]), Bq = L.xz(b[0], b[1]);
    const n = Math.max(1, Math.round(Math.hypot(b[0] - a[0], b[1] - a[1]) / 3));
    near.col = PAL.steel;
    for (let q = 0; q <= n; q++) {
      const t = q / n;
      const px = A[0] + (Bq[0] - A[0]) * t, pz = A[1] + (Bq[1] - A[1]) * t;
      box(near, px, B.groundY(px, pz) - 0.3, pz, 0.08, 2.4, 0.08, ry);
    }
    for (const h of [0.6, 1.3, 2.0]) near.beam(A[0], B.groundY(A[0], A[1]) + h, A[1], Bq[0], B.groundY(Bq[0], Bq[1]) + h, Bq[1], 0.03, 0.03);
  }
  const closing = [corners[5], corners[0]];
  const A = L.xz(closing[0][0], closing[0][1]), Bq = L.xz(closing[1][0], closing[1][1]);
  for (const h of [0.6, 1.3, 2.0]) near.beam(A[0], B.groundY(A[0], A[1]) + h, A[1], Bq[0], B.groundY(Bq[0], Bq[1]) + h, Bq[1], 0.03, 0.03);
}

// ------------------------------------------------------------------ the substation

function substation3d(B, m, it) {
  const { x, z, ry, y, w, d } = it;
  const L = frame(x, y, z, ry);
  const props = B.acc(m.props);
  const gy = (lx, lz) => { const q = L.xz(lx, lz); return B.groundY(q[0], q[1]); };
  drape(B.acc(m.yard), B, [L.xz(-w / 2, -d / 2), L.xz(w / 2, -d / 2), L.xz(w / 2, d / 2), L.xz(-w / 2, d / 2)], { lift: 0.05, uv: 5 });
  // transformers, insulator stacks on gantries, a control house, lights on poles
  for (const lx of [-9, 0, 9]) {
    const q = L.xz(lx, -3), qy = gy(lx, -3);
    props.col = PAL.green;
    box(props, q[0], qy - 0.3, q[1], 4, 3.4, 3, ry);
    props.col = PAL.steel;
    for (const o of [-1.2, 0, 1.2]) { const r = L.xz(lx + o, -3); cylinder(props, r[0], qy + 3.1, r[1], 0.18, 1.6, 6); }
  }
  props.col = PAL.steel;
  for (const lx of [-14, 14]) for (const lz of [-9, 5]) { const q = L.xz(lx, lz); box(props, q[0], gy(lx, lz) - 0.5, q[1], 0.4, 9, 0.4, ry); }
  for (const lz of [-9, 5]) { const a = L.xz(-14, lz), b = L.xz(14, lz); props.beam(a[0], gy(-14, lz) + 8.3, a[1], b[0], gy(14, lz) + 8.3, b[1], 0.35, 0.35); }
  props.col = PAL.concrete;
  const h = L.xz(0, 8);
  box(props, h[0], gy(0, 8) - 0.5, h[1], 8, 4, 5, ry);
  const gl = L.xz(0, 10.55);
  box(B.acc(m.glowCold), gl[0], gy(0, 8) + 1.6, gl[1], 2.2, 1.0, 0.06, ry);
  for (const ox of [-12, 12]) {
    const q = L.xz(ox, 8), qy = gy(ox, 8);
    props.col = PAL.steel;
    cylinder(props, q[0], qy - 0.4, q[1], 0.12, 9.4, 6);
    box(B.acc(m.glowCold), q[0], qy + 8.8, q[1], 0.9, 0.25, 0.5, ry);
  }
  // the fence round it
  const near = B.near(m.props);
  near.col = PAL.steel;
  const cs = [[-w / 2, -d / 2], [w / 2, -d / 2], [w / 2, d / 2], [-w / 2, d / 2]];
  for (let k = 0; k < 4; k++) {
    const a = L.xz(...cs[k]), b = L.xz(...cs[(k + 1) % 4]);
    const n = Math.round(Math.hypot(b[0] - a[0], b[1] - a[1]) / 3);
    for (let q = 0; q <= n; q++) { const t = q / n, px = a[0] + (b[0] - a[0]) * t, pz = a[1] + (b[1] - a[1]) * t; box(near, px, B.groundY(px, pz) - 0.3, pz, 0.08, 2.5, 0.08, ry); }
    for (const hh of [0.7, 1.5, 2.2]) near.beam(a[0], B.groundY(a[0], a[1]) + hh, a[1], b[0], B.groundY(b[0], b[1]) + hh, b[1], 0.03, 0.03);
  }
}

export default {
  id: 'ridgeline',
  plan,
  scatter,
  warm(B) { mats(B); },
  build,
};

void mixc; void mulc; void gable;
