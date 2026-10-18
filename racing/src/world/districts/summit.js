// PORT HALCYON — THE SUMMIT: the snowy crown of the range. Ploughed snow
// banks along every road and red-and-white snow poles marking its edges,
// snow sheds roofing the deepest cuttings, snow-laden firs thinning out to
// bare rock and drifts up high. On the loop round the peak, the ski lodge
// (warm windows, a glowing A-frame, its lit sign) and the chairlift climbing
// the floodlit night-ski run; at the very top, at the end of the gravel
// corkscrew, the observatory: a great white dome, slit open and glowing,
// turning slowly. Down the north face a gravel trail ends at an ice cave.
import * as THREE from 'three';
import { litMat, plainMat, box, gable, cylinder, cone, sphere, drape, archWall } from './builder.js';
import { shoulderMat } from '../kit.js';
import { Acc } from '../build/geo.js';
import { lin, mixc, mulc, frame, roadField, cellRuns, isCountryRoad, lampTest, levelness, useGround, cellPoints, ownAcc, ownMesh } from './peaks/util.js';
import * as F from './peaks/flora.js';
import { bends, poles, cuts, drapeCut, eachOwnedSample } from './peaks/roadside.js';
import { cellUV, board, lampPost, railing } from './peaks/parts.js';
import { findBesideRoad, findFlat, exactGround, exactRange } from './peaks/sites.js';
import { usSignTex, lodgeTex, rockFaceTex } from './peaks/tex.js';

const PAL = {
  fir: lin('#1e3326'), snow: lin('#eef3f8'), bark: lin('#3e2c20'),
  rock: lin('#76746e'), rockDark: lin('#46443f'), white: lin('#e8ecf0'), offwhite: lin('#d4d8dc'),
  steel: lin('#3a3e44'), red: lin('#c8201e'), orange: lin('#ef6a12'), timber: lin('#5a3a22'), timberDark: lin('#3a2416'),
  roof: lin('#2c3036'), stone: lin('#7c7870'), yellow: lin('#f2c400'), paint: lin('#e0e0d8'), glass: lin('#20303c'),
  blue: lin('#2a5fae'), green: lin('#2e6a3a'), ice: lin('#a8d8f0'), seat: lin('#2a5aa0'),
};

function mats(B) {
  return {
    veg: B.mat('veg', () => litMat({ vertexColors: true, roughness: 0.9, flatShading: true }, { glow: 2.0 })),
    vegDark: B.mat('vegDark', () => plainMat({ vertexColors: true, roughness: 0.9, flatShading: true })),
    rock: B.mat('rock', () => litMat({ vertexColors: true, roughness: 0.95, flatShading: true })),
    rockDark: B.mat('rockDark', () => plainMat({ vertexColors: true, roughness: 0.95, flatShading: true })),
    props: B.mat('props', () => litMat({ vertexColors: true, roughness: 0.65, metalness: 0.1 })),
    snow: B.mat('snow', () => litMat({ color: 0xf0f4f8, roughness: 0.85, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }, { glow: 2.2 })),
    face: B.mat('face', () => litMat({ map: rockFaceTex(true), roughness: 0.95, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 })),
    signs: B.mat('signs', () => { const t = usSignTex(); return litMat({ map: t.map, emissive: 0xffffff, emissiveMap: t.emi, roughness: 0.55 }, { night: 1.0 }); }),
    lodge: B.mat('lodge', () => { const t = lodgeTex(); return litMat({ map: t.map, emissive: 0xffffff, emissiveMap: t.emi, roughness: 0.85 }, { night: 1.4 }); }),
    glowWarm: B.mat('glowWarm', () => litMat({ color: 0xf2dcb0, emissive: 0xffa040, roughness: 0.5 }, { night: 2.6 })),
    glowCold: B.mat('glowCold', () => litMat({ color: 0xdfe8f0, emissive: 0xcfe0ff, roughness: 0.4 }, { night: 2.4 })),
    concrete: B.mat('concrete', () => litMat({ color: 0x9a9890, roughness: 0.9 })),
    dome: B.mat('dome', () => plainMat({ color: 0xeef1f4, roughness: 0.35, metalness: 0.35, envMapIntensity: 0.9 })),
    slit: B.mat('slit', () => plainMat({ color: 0x281410, emissive: 0xff5a28, roughness: 0.8 }, { night: 2.6 })),
    iceGlow: B.mat('iceGlow', () => plainMat({ color: 0x9fd8ff, emissive: 0x4ab0ff, roughness: 0.2, metalness: 0.1, transparent: true, opacity: 0.92 }, { night: 1.8 })),
    beacon: B.mat('beacon', () => new THREE.MeshBasicMaterial({ color: new THREE.Color('#ff2020').multiplyScalar(3) })),
    lot: shoulderMat('asphaltlot'),
  };
}

// ------------------------------------------------------------------ plan

function plan(P) {
  observatory(P);
  lodgeAndLift(P);
  iceCave(P);
  for (const r of P.roads((q) => q.rt.id === 'mountain')) snowSheds(P, r);
  chainsSign(P);
}

function observatory(P) {
  const n = P.net.nodes.get('ob_top');
  if (!n) return;
  const e = n.ends[0];
  // the dome stands just past the end of the road on the flattest ground
  // there (the peak is steep), facing it; the car park round the road's end
  let x = n.x - e.dx * 28, z = n.z - e.dz * 28;
  const site = findFlat(P, x, z, 24, 24, 34, { ry: Math.atan2(e.dx, e.dz), roadPad: true, step: 4, pull: 0.04, refine: 60, n: 6, noClaim: true });
  if (site) { x = site.x; z = site.z; }
  const ry = Math.atan2(n.x - x, n.z - z);   // +z back toward the road
  const g = exactRange(P, x, z, 21, 21, ry, 6);
  const y = g.hi + 0.3;                     // the drum's floor: clear of the ground all round
  P.claim(x, z, 40, 40, ry);
  P.add({ type: 'observatory', x, z, ry, y, lo: g.lo, nx: n.x, nz: n.z, ny: n.y, map: 'building' });
  P.collider({ kind: 'circle', x, z, r: 10, y0: g.lo - 3, y1: y + 20 });
  const L = frame(x, y, z, ry);
  const [ax, az] = L.xz(-15, 4);
  P.collider({ kind: 'box', x: ax, z: az, hx: 7, hz: 4.5, ry, y0: y - 3, y1: y + 7 });
  const [mx, mz] = L.xz(12, -6);
  const my = exactGround(P)(mx, mz);
  P.collider({ kind: 'circle', x: mx, z: mz, r: 0.5, y0: my - 3, y1: my + 30 });
  P.lamp({ x: mx, z: mz, y: my, hx: mx, hz: mz, hy: my + 28.6, color: '#ff2020', radius: 4, intensity: 0.4, halo: 3 });
  P.lamp({ x: n.x, z: n.z, y: n.y, hx: n.x, hz: n.z, hy: n.y + 6, color: '#e8eeff', radius: 18, intensity: 0.7, halo: 2 });
  P.far({ shape: 'cyl', x, z, y: y - 2, r: 9.6, h: 10, color: '#d8dce0', lit: 0.1 });
  P.far({ shape: 'cone', x, z, y: y + 8, r: 9.6, h: 8, color: '#e4e8ec' });
  P.far({ x: ax, z: az, y: y - 2, w: 14, d: 9, h: 7, ry, color: '#cfd3d8', lit: 0.3 });
  P.landmark({ id: 'observatory', name: 'SUMMIT OBSERVATORY', x, z, r: 30, kind: 'observatory' });
}

function lodgeAndLift(P) {
  const r = P.net.byId.get('sm_l1');
  if (!r) return;
  // the lodge beside the loop on its south-west side (inside the loop), its lot along the road
  const f = findBesideRoad(P, r, 44, 30, { s0: 120, s1: r.length * 0.55, step: 10, setback: 1.5, maxSpan: 9, maxDy: 5, sides: [1, -1], prefer: (q) => -P.groundY(q.x, q.z) * 0.02 });
  if (!f) return;
  const y = f.roadY;
  P.add({ type: 'lodge', x: f.x, z: f.z, ry: f.ry, w: f.w, d: f.d, y, map: 'building' });
  const L = frame(f.x, y, f.z, f.ry);
  const [lx, lz] = L.xz(-6, -8);
  P.collider({ kind: 'box', x: lx, z: lz, hx: 11, hz: 7, ry: f.ry, y0: y - 3, y1: y + 14 });
  for (const [ox, oz, col, rad, hy] of [[-6, -0.5, '#ffb060', 12, 4], [10, 6, '#ffe2b8', 22, 7.5], [-16, 6, '#ffe2b8', 22, 7.5]]) {
    const [px, pz] = L.xz(ox, oz);
    P.lamp({ x: px, z: pz, y, hx: px, hz: pz, hy: y + hy, color: col, radius: rad, intensity: 0.9, halo: hy > 5 ? 2.4 : 1.2 });
  }
  P.far({ x: lx, z: lz, y: y - 2, w: 22, d: 14, h: 14, ry: f.ry, color: '#4a3020', lit: 0.55 });
  P.landmark({ id: 'lodge', name: 'SUMMIT LODGE', x: f.x, z: f.z, r: 40, kind: 'lodge' });
  // the chairlift: from beside the lodge up the slope toward the peak
  const peak = P.net.nodes.get('ob_top');
  const [bx, bz] = L.xz(14, -10);
  let dx = (peak ? peak.x : bx) - bx, dz = (peak ? peak.z : bz - 400) - bz;
  const dl = Math.hypot(dx, dz) || 1;
  dx /= dl; dz /= dl;
  const len = Math.min(dl - 70, 520);
  if (len < 150) return;
  const tx = bx + dx * len, tz = bz + dz * len;
  const by = P.groundY(bx, bz), ty = P.groundY(tx, tz);
  P.add({ type: 'lift', x: bx, z: bz, tx, tz, by, ty, map: 'track' });
  // the run: a clear strip down the lift line and its floodlights, the top station
  P.claim((bx + tx) / 2 - dz * 9, (bz + tz) / 2 + dx * 9, 40, len, Math.atan2(dx, dz));
  P.claim(tx, tz, 18, 18, Math.atan2(dx, dz));
  // towers every ~60 m; floodlights down the run beside them
  const nT = Math.max(2, Math.round(len / 60));
  for (let k = 0; k <= nT; k++) {
    const t = k / nT;
    const px = bx + (tx - bx) * t, pz = bz + (tz - bz) * t;
    P.collider({ kind: 'circle', x: px, z: pz, r: 0.6, y0: P.groundY(px, pz) - 2, y1: P.groundY(px, pz) + 12 });
    if (k > 0 && k < nT) {
      const fx = px - dz * 22, fz = pz + dx * 22;
      const fy = P.groundY(fx, fz);
      P.add({ type: 'flood', x: fx, z: fz, y: fy, ry: Math.atan2(dz, -dx) });
      P.collider({ kind: 'circle', x: fx, z: fz, r: 0.3, y0: fy - 2, y1: fy + 11 });
      P.lamp({ x: fx, z: fz, y: fy, hx: fx + dz * 8, hz: fz - dx * 8, hy: fy + 10.5, color: '#eaf2ff', radius: 30, intensity: 0.85, halo: 3.0 });
    }
  }
  P.far({ shape: 'cyl', x: tx, z: tz, y: ty - 1, r: 4, h: 9, color: '#6a5040', lit: 0.4 });
}

function iceCave(P) {
  const n = P.net.nodes.get('sm_cave');
  if (!n) return;
  const e = n.ends[0];
  // the mouth faces back up the trail, a little past its end
  const ry = Math.atan2(e.dx, e.dz);
  const x = n.x - e.dx * 14, z = n.z - e.dz * 14;
  const y = n.y;
  P.claim(x, z, 30, 34, ry);
  P.add({ type: 'icecave', x, z, ry, y });
  const L = frame(x, y, z, ry);
  for (const [ox, oz, hx, hz] of [[-9, 0, 5, 3], [9, 0, 5, 3], [0, -16, 9, 2]]) {
    const [px, pz] = L.xz(ox, oz);
    P.collider({ kind: 'box', x: px, z: pz, hx, hz, ry, y0: y - 3, y1: y + 16 });
  }
  for (const s of [-1, 1]) {
    const [px, pz] = L.xz(s * 3.5, -12);
    P.collider({ kind: 'box', x: px, z: pz, hx: 0.6, hz: 12, ry, y0: y - 3, y1: y + 16 });
  }
  const [gx, gz] = L.xz(0, -11);
  P.lamp({ x: gx, z: gz, y, hx: gx, hz: gz, hy: y + 3, color: '#6ec0ff', radius: 16, intensity: 1.3, halo: 2.0 });
  P.landmark({ id: 'icecave', name: 'THE ICE CAVE', x, z, r: 20, kind: 'cave', hidden: true });
}

/** Snow sheds over the stretches cut deepest into the mountain on one side (and open on the other). */
function snowSheds(P, r) {
  void P.terrain;
  const reach = r.rt.hw + r.rt.shoulder + r.rt.walk;
  let run = null;
  const out = [];
  for (let i = 6; i < r.N - 6; i += 2) {
    const x = r.X[i], z = r.Z[i];
    let side = 0;
    if (P.inside(x, z, 10) && r.S[i] > r.trim0 + 30 && r.S[i] < r.length - r.trim1 - 30 && !(r.flags[i] & 3)) {
      const ey = r.Y[i];
      const hl = P.groundY(x + r.LX[i] * (reach + 9), z + r.LZ[i] * (reach + 9)) - ey;
      const hr = P.groundY(x - r.LX[i] * (reach + 9), z - r.LZ[i] * (reach + 9)) - ey;
      if (hl > 9 && hr < 3) side = 1; else if (hr > 9 && hl < 3) side = -1;
    }
    if (side && run && run.side === side) run.i1 = i;
    else {
      if (run && run.i1 - run.i0 >= 24) out.push(run);
      run = side ? { i0: i, i1: i, side } : null;
    }
  }
  if (run && run.i1 - run.i0 >= 24) out.push(run);
  for (const q of out) {
    const i0 = q.i0, i1 = Math.min(q.i1, q.i0 + 60);   // up to 120 m
    const im = (i0 + i1) >> 1;
    P.add({ type: 'shed', x: r.X[im], z: r.Z[im], road: r.ri, i0, i1, sd: q.side });
    for (let i = i0; i <= i1; i += 3) {
      const lat = -q.side * (reach + 1.4);
      P.collider({ kind: 'circle', x: r.X[i] + r.LX[i] * lat, z: r.Z[i] + r.LZ[i] * lat, r: 0.4, y0: r.Y[i] - 1, y1: r.Y[i] + 7 });
    }
    for (let i = i0 + 5; i < i1; i += 10) {
      P.lamp({ x: r.X[i], z: r.Z[i], y: r.Y[i], hx: r.X[i], hz: r.Z[i], hy: r.Y[i] + 5.6, color: '#ffd28a', radius: 12, intensity: 0.7, halo: 0.8 });
    }
  }
}

function chainsSign(P) {
  // where the Summit Road climbs into the district: CHAINS REQUIRED
  const r = P.net.byId.get('sm_climb');
  if (!r) return;
  for (let i = 0; i < r.N; i += 4) {
    if (!P.inside(r.X[i], r.Z[i], 30)) continue;
    const lat = r.rt.hw + r.rt.shoulder + 2.0;
    const x = r.X[i] + r.LX[i] * -lat, z = r.Z[i] + r.LZ[i] * -lat;
    P.add({ type: 'chains', x, z, y: r.Y[i], ry: Math.atan2(-r.TX[i], -r.TZ[i]) });
    P.collider({ kind: 'circle', x, z, r: 0.3, y0: r.Y[i] - 1, y1: r.Y[i] + 4 });
    break;
  }
}

// ------------------------------------------------------------------ scatter

const LIT = new Set(['fir', 'rock', 'crag']);

function scatter(S) {
  useGround(S);
  const field = roadField(S.net, S.cx, S.cz);
  const lit = lampTest(S);
  const add0 = S.add.bind(S);
  S.add = (it) => { if (LIT.has(it.type)) it.lit = lit(it.x, it.z); return add0(it); };
  for (const it of bends(S, { rMax: 60 })) S.add(it);
  for (const it of poles(S, 'spole', { every: 24, off: 1.1, both: true })) S.add(it);
  for (const it of cuts(S, 'face', { minRise: 3.5 })) S.add(it);
  // snow banks ploughed up along both edges of every road
  for (const run of cellRuns(S.net, S.cx, S.cz, isCountryRoad)) {
    if (!S.inside(run.road.X[run.i0], run.road.Z[run.i0])) continue;
    S.add({ type: 'bank', x: run.road.X[run.i0], z: run.road.Z[run.i0], road: run.road.ri, i0: run.i0, i1: run.i1 });
  }
  // firs, thinning with height (the tree line round 720 m), rocks and crags above
  for (const [x, z] of cellPoints(S, 9, { r: 1.8, density: (px, pz) => 0.5 + 0.5 * S.noise(px / 110, pz / 110) })) {
    const y = S.groundY(x, z);
    const tl = 720 + S.noise(x / 300, z / 300) * 40;
    if (y > tl) continue;
    const thin = y > tl - 120 ? (tl - y) / 120 : 1;
    const t = S.rng();
    if (S.rng() > 0.25 + 0.75 * thin) continue;
    const d = field.at(x, z);
    if (d < 4) continue;
    if (d < 34 && levelness(S.groundY, x, z) < 0.8) continue;
    const h = (8 + t * 9) * (0.6 + 0.4 * thin);
    S.add({ type: 'fir', x, z, y, h, t, snow: Math.min(1, 0.55 + (y - 500) / 300), lod: d > 70 ? 1 : 0 });
    if (d < 45) S.collider({ kind: 'circle', x, z, r: 0.5, y0: y - 1, y1: y + 6 });
  }
  for (const [x, z] of cellPoints(S, 34, { r: 3 })) {
    const y = S.groundY(x, z);
    const k = S.rng();
    if (k > 0.5) continue;
    const s = S.range(1, 3.2);
    const crag = y > 620 && k < 0.12;
    S.add({ type: crag ? 'crag' : 'rock', x, z, y, s: crag ? s * 3 : s, t: S.rng() });
    if (field.at(x, z) < 50 && s > 1.4) S.collider({ kind: 'circle', x, z, r: crag ? s * 1.2 : s * 0.5, y0: y - 1, y1: y + (crag ? s * 3 : s) });
  }
}

// ------------------------------------------------------------------ build

const HEAVY = new Set(['observatory', 'lodge', 'lift', 'icecave', 'shed', 'bank', 'face', 'flood']);

function* build(B, items) {
  const m = mats(B);
  useGround(B);
  const vegL = B.acc(m.veg), vegD = ownAcc(m.vegDark), rockL = B.acc(m.rock), rockD = B.acc(m.rockDark);
  const V = (it) => (it.lit ? vegL : vegD), R = (it) => (it.lit ? rockL : rockD);
  let n = 0;
  for (const it of items) {
    switch (it.type) {
      case 'fir': F.snowFir(V(it), it.x, it.y, it.z, it.h, it.t, PAL, it.snow, it.lod); break;
      case 'rock': F.rock(R(it), it.x, it.y, it.z, it.s, 0.7, it.t, PAL.rock, PAL.rockDark, PAL.snow, 0.8); break;
      case 'crag': F.crag(R(it), it.x, it.y, it.z, it.s, it.t, PAL.rock, PAL.rockDark, PAL.snow); break;
      case 'chev': {
        const y = Math.max(B.groundY(it.x, it.z), it.y - 3);
        const props = B.near(m.props);
        props.col = PAL.steel;
        box(props, it.x, y - 0.4, it.z, 0.08, Math.max(1.7, it.y + 1.2 - y + 0.4), 0.08, it.ry);
        board(B.near(m.signs), it.x, Math.max(it.y, y) + 1.45, it.z, 0.6, 0.75, it.ry, cellUV(it.cell));
        break;
      }
      case 'spole': snowPole(B, m, it); break;
      case 'face': drapeCut(B, B.acc(m.face), it, { tile: 6, maxW: 30 }); break;
      case 'bank': snowBank(B, m, it); break;
      case 'shed': snowShed(B, m, it); break;
      case 'observatory': observatory3d(B, m, it); break;
      case 'lodge': lodge3d(B, m, it); break;
      case 'lift': lift3d(B, m, it); break;
      case 'flood': flood3d(B, m, it); break;
      case 'icecave': iceCave3d(B, m, it); break;
      case 'chains': {
        const y = B.groundY(it.x, it.z);
        const props = B.acc(m.props);
        props.col = PAL.steel;
        box(props, it.x, y - 0.5, it.z, 0.1, 3.3, 0.1, it.ry);
        board(B.acc(m.signs), it.x, y + 2.3, it.z, 1.3, 1.3, it.ry, cellUV(2), cellUV(7, 4, 2, 0.02));
        break;
      }
      default: break;
    }
    if (++n % 20 === 0 || HEAVY.has(it.type)) yield;
  }
  yield* ownMesh(B, vegD);
}

// ------------------------------------------------------------------ roadside

function snowPole(B, m, it) {
  const y = Math.max(B.groundY(it.x, it.z), it.y - 1.5);
  const acc = B.near(m.props);
  const h = 2.6;
  for (let k = 0; k < 5; k++) {
    acc.col = k % 2 ? PAL.white : PAL.red;
    box(acc, it.x, y - 0.3 + k * (h / 5) + (k ? 0.3 : 0), it.z, 0.07, h / 5 + (k ? 0 : 0.3), 0.07, it.ry);
  }
  acc.col = PAL.orange;
  box(acc, it.x, y + h, it.z, 0.09, 0.22, 0.09, it.ry);
}

/** The ploughed banks: a low white ridge outside both edges of the road along a run. */
function snowBank(B, m, it) {
  const r = B.net.roads[it.road];
  if (!r || r.flags[it.i0] & 3) return;
  const acc = B.acc(m.snow);
  const reach = r.rt.hw + r.rt.shoulder + r.rt.walk;
  const i1 = Math.min(r.N - 1, it.i1 + 1);
  for (const sd of [1, -1]) {
    const base = acc.count;
    const cols = [reach + 0.15, reach + 0.9, reach + 1.9, reach + 3.0];
    let rows = 0;
    for (let i = it.i0; i <= i1; i++) {
      if (r.S[i] < r.trim0 + 1 || r.S[i] > r.length - r.trim1 - 1 || (r.flags[i] & 3)) continue;
      const ey = r.roadY(i, 0, sd * r.rt.hw);
      const hh = 0.45 + 0.35 * (0.5 + 0.5 * Math.sin(r.S[i] * 0.21 + it.road)) + 0.2 * Math.sin(r.S[i] * 0.07);
      for (let c = 0; c < cols.length; c++) {
        const lat = sd * cols[c];
        const x = r.X[i] + r.LX[i] * lat, z = r.Z[i] + r.LZ[i] * lat;
        const gy = c === 0 ? ey : Math.max(B.groundY(x, z), ey - 2);
        const y = c === 0 ? ey - 0.05 : c === 3 ? gy - 0.05 : Math.max(gy, ey) + hh * (c === 1 ? 1 : 0.6);
        acc.v(x, y, z, cols[c] / 3, r.S[i] / 3);
      }
      rows++;
    }
    for (let k = 0; k < rows - 1; k++) {
      for (let c = 0; c < 3; c++) {
        const a = base + k * 4 + c, b = a + 1, d = a + 4, e = d + 1;
        if (sd > 0) { acc.tri(a, d, b); acc.tri(b, d, e); } else { acc.tri(a, b, d); acc.tri(b, e, d); }
      }
    }
  }
}

/** A snow shed: a back wall against the cutting, a concrete roof, pillars on the open side, snow on top. */
function snowShed(B, m, it) {
  const r = B.net.roads[it.road];
  if (!r) return;
  const con = B.acc(m.concrete), snow = B.acc(m.snow), glow = B.acc(m.glowWarm);
  const reach = r.rt.hw + r.rt.shoulder + r.rt.walk;
  const sd = it.sd, H = 6.2;
  const cutLat = sd * (reach + 1.0), openLat = -sd * (reach + 1.4);
  const P = (i, lat, dy) => [r.X[i] + r.LX[i] * lat, r.Y[i] + dy, r.Z[i] + r.LZ[i] * lat];
  for (let i = it.i0; i < it.i1; i += 2) {
    const j = Math.min(it.i1, i + 2);
    // the roof slab (underside, top, front fascia), the back wall (facing the road)
    const top = (k, lat) => P(k, lat, H);
    if (sd > 0) {
      con.quadP(P(i, openLat, H - 0.6), P(j, openLat, H - 0.6), P(j, cutLat, H - 0.6), P(i, cutLat, H - 0.6));
      con.quadP(top(i, cutLat), top(j, cutLat), top(j, openLat - 0.6 * -sd), top(i, openLat - 0.6 * -sd));
      con.quadP(P(j, cutLat, -1), P(i, cutLat, -1), P(i, cutLat, H), P(j, cutLat, H));
    } else {
      con.quadP(P(j, openLat, H - 0.6), P(i, openLat, H - 0.6), P(i, cutLat, H - 0.6), P(j, cutLat, H - 0.6));
      con.quadP(top(j, cutLat), top(i, cutLat), top(i, openLat - 0.6 * -sd), top(j, openLat - 0.6 * -sd));
      con.quadP(P(i, cutLat, -1), P(j, cutLat, -1), P(j, cutLat, H), P(i, cutLat, H));
    }
    const o2 = openLat - 0.6 * -sd;
    const fa = sd > 0 ? [P(j, o2, H - 0.6), P(i, o2, H - 0.6), P(i, o2, H + 0.1), P(j, o2, H + 0.1)] : [P(i, o2, H - 0.6), P(j, o2, H - 0.6), P(j, o2, H + 0.1), P(i, o2, H + 0.1)];
    con.quadP(...fa);
    // snow lying on the roof
    const s0 = sd > 0 ? [P(i, cutLat, H + 0.12), P(j, cutLat, H + 0.12), P(j, o2, H + 0.42), P(i, o2, H + 0.42)] : [P(j, cutLat, H + 0.12), P(i, cutLat, H + 0.12), P(i, o2, H + 0.42), P(j, o2, H + 0.42)];
    snow.quadP(...s0);
    // pillars on the open side every 6 m
    if (((i - it.i0) / 2) % 3 === 0) {
      const q = P(i, openLat, 0);
      box(con, q[0], r.Y[i] - 1, q[2], 0.6, H + 0.4, 0.6, Math.atan2(r.TX[i], r.TZ[i]));
    }
    // a strip light under the roof every 20 m
    if (((i - it.i0) / 2) % 5 === 2) {
      const q = P(i, 0, H - 0.68);
      box(glow, q[0], q[1], q[2], 0.3, 0.08, 1.4, Math.atan2(r.TX[i], r.TZ[i]));
    }
  }
}

// ------------------------------------------------------------------ the observatory

function observatory3d(B, m, it) {
  const { x, z, ry, y } = it;
  const L = frame(x, y, z, ry);
  const props = B.acc(m.props);
  const gy = (lx, lz) => { const q = L.xz(lx, lz); return B.groundY(q[0], q[1]); };
  // the car park round the end of the road
  const lot = [];
  for (let k = 0; k < 12; k++) { const a = (k / 12) * Math.PI * 2; lot.push([it.nx + Math.cos(a) * 16, it.nz + Math.sin(a) * 16]); }
  drape(B.acc(m.lot), B, lot, { lift: 0.06, uv: 6 });
  // the drum and the base ring
  const con = B.acc(m.concrete);
  const by = Math.min(y - 3, (it.lo ?? y) - 1);
  cylinder(con, x, by, z, 10.2, y + 1.2 - by, 20, { top: true });
  props.col = PAL.offwhite;
  cylinder(props, x, y + 1.2, z, 9.6, 7.6, 20);
  props.col = PAL.steel;
  cylinder(props, x, y + 8.6, z, 9.75, 0.4, 20, { top: true });
  // a door and a row of small lit windows round the drum
  const glow = B.acc(m.glowCold);
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2 + 0.2;
    box(glow, x + Math.cos(a) * 9.62, y + 5.4, z + Math.sin(a) * 9.62, 0.9, 0.7, 0.06, -a + Math.PI / 2);
  }
  // the dome turns: its own mesh, the slit glowing, the telescope peering out
  const dome = new Acc(false), slitA = new Acc(false), tube = new Acc(true);
  sphere(dome, 0, 0, 0, 9.5, 18, { dome: true });
  // the slit: a glowing band over the dome from its foot to past the crown
  const R = 9.56, hw = 1.25;
  for (let k = 0; k < 10; k++) {
    const t0 = (k / 10) * (Math.PI / 2 + 0.25), t1 = ((k + 1) / 10) * (Math.PI / 2 + 0.25);
    const P = (t, s) => [Math.cos(t) * R, Math.sin(t) * R, s * hw];
    slitA.quadP(P(t0, -1), P(t0, 1), P(t1, 1), P(t1, -1));
  }
  tube.col = lin('#1c2026');
  tube.beam(0, 1.5, 0, 7.2, 7.4, 0, 1.1, 1.1);
  tube.col = lin('#d0d4d8');
  tube.beam(-1.2, 0, 0, 0, 1.6, 0, 1.6, 1.6);
  const grp = new THREE.Group();
  grp.position.set(x, y + 9, z);
  grp.rotation.y = ry;
  const mk = (acc, mat) => { const msh = new THREE.Mesh(acc.toGeometry(false), mat); msh.castShadow = true; grp.add(msh); };
  mk(dome, m.dome); mk(slitA, m.slit); mk(tube, m.props);
  B.group.add(grp);
  B.anim((t) => { grp.rotation.y = ry + t * 0.035; });
  // the annex with its little dome, the mast with its red light
  const [ax, az] = L.xz(-15, 4);
  const ay = gy(-15, 4);
  const alo = Math.min(gy(-22, -0.5), gy(-8, -0.5), gy(-22, 8.5), gy(-8, 8.5), ay);
  props.col = PAL.offwhite;
  box(props, ax, alo - 1, az, 14, ay + 5.5 - (alo - 1), 9, ry);
  for (const lx of [-4.5, -1.5, 1.5, 4.5]) { const q = L.xz(-15 + lx, 8.55); box(glow, q[0], ay + 2.4, q[1], 1.6, 1.0, 0.06, ry); }
  sphere(B.acc(m.dome), ax, ay + 5.5, az, 3.2, 12, { dome: true });
  const [mx, mz] = L.xz(12, -6);
  const my = gy(12, -6);
  props.col = PAL.steel;
  cylinder(props, mx, my - 1, mz, 0.22, 29, 6, { r2: 0.1 });
  for (const h of [12, 20]) props.beam(mx, my + h, mz, mx + 1.4, my + h, mz, 0.08, 0.08);
  box(B.acc(m.beacon), mx, my + 28.4, mz, 0.36, 0.36, 0.36);
  // the board by the car park
  const sq = [it.nx + Math.sin(ry) * -14, it.nz + Math.cos(ry) * -14];
  const sy = B.groundY(sq[0], sq[1]);
  props.col = PAL.steel;
  box(props, sq[0], sy - 0.4, sq[1], 0.1, 2.6, 0.1, ry);
  board(B.acc(m.signs), sq[0], sy + 2.4, sq[1], 2.2, 2.2, ry + Math.PI, cellUV(5), cellUV(7, 4, 2, 0.02));
  B.anim(beaconBlink(m.beacon));
}

/** Red obstruction lights blink together, all over the map (night only). */
function beaconBlink(mat) {
  return (t) => {
    const on = (t % 1.6) < 0.7;
    mat.color.setRGB(on ? 3 : 0.25, on ? 0.12 : 0.02, on ? 0.12 : 0.02);
  };
}

// ------------------------------------------------------------------ the lodge and the lift

function lodge3d(B, m, it) {
  const { x, z, ry, w, d, y } = it;
  const L = frame(x, y, z, ry);
  const props = B.acc(m.props), near = B.near(m.props);
  const gy = (lx, lz) => { const q = L.xz(lx, lz); return B.groundY(q[0], q[1]); };
  // the car park along the road, ploughed, with white bays
  const lot = [L.xz(-w / 2, 1), L.xz(w / 2, 1), L.xz(w / 2, d / 2), L.xz(-w / 2, d / 2)];
  drape(B.acc(m.lot), B, lot, { lift: 0.05, uv: 6 });
  near.col = PAL.paint;
  for (let k = 0; k < 9; k++) {
    const lx = -18 + k * 4.2;
    const a = L.xz(lx, 3), b = L.xz(lx, 9);
    const ya = B.groundY(a[0], a[1]) + 0.07, yb = B.groundY(b[0], b[1]) + 0.07;
    near.quadP([a[0] - 0.06 * L.c, ya, a[1] + 0.06 * L.s], [a[0] + 0.06 * L.c, ya, a[1] - 0.06 * L.s], [b[0] + 0.06 * L.c, yb, b[1] - 0.06 * L.s], [b[0] - 0.06 * L.c, yb, b[1] + 0.06 * L.s]);
  }
  // the lodge: a stone plinth, timber walls with big warm windows, a steep roof, the glazed A-frame
  const ly = Math.max(gy(-6, -8), gy(-16, -14), gy(4, -14), gy(-16, -2), gy(4, -2)) + 0.4;
  const llo = Math.min(gy(-16.5, -14.5), gy(4.5, -14.5), gy(-16.5, -1.5), gy(4.5, -1.5), gy(-6, -14.5), gy(-6, -1.5), gy(-16.5, -8), gy(4.5, -8));
  const [cx, cz] = L.xz(-6, -8);
  props.col = PAL.stone;
  box(props, cx, Math.min(ly - 4, llo - 0.6), cz, 21, ly + 0.4 - Math.min(ly - 4, llo - 0.6), 13, ry);
  box(B.acc(m.lodge), cx, ly + 0.4, cz, 20, 7.2, 12, ry, { u: 8, v: 4, top: false });
  props.col = PAL.timberDark;
  gable(props, cx, ly + 7.6, cz, 20, 12, 6.5, ry, { over: 1.4, u: 2 });
  // the A-frame: a tall glazed triangle on the front, glowing
  const Pf = frame(cx, ly, cz, ry);
  const glow = B.acc(m.glowWarm);
  const a0 = Pf(-5, 0.6, 6.25), a1 = Pf(5, 0.6, 6.25), apex = Pf(0, 12.8, 6.25);
  const gi = [glow.v(...a0, 0, 0), glow.v(...a1, 1, 0), glow.v(...apex, 0.5, 1)];
  glow.tri(gi[0], gi[1], gi[2]);
  props.col = PAL.timberDark;
  props.beam(...a0, ...apex, 0.5, 0.5);
  props.beam(...a1, ...apex, 0.5, 0.5);
  for (const lx of [-2.5, 0, 2.5]) { const b0 = Pf(lx, 0.6, 6.3), b1 = Pf(lx, 12.8 - Math.abs(lx) * 2.44, 6.3); props.beam(...b0, ...b1, 0.14, 0.14); }
  for (const h of [4.2, 8.2]) { const hw2 = 5 - h * (5 / 12.2); const c0 = Pf(-hw2, h, 6.3), c1 = Pf(hw2, h, 6.3); props.beam(...c0, ...c1, 0.14, 0.14); }
  // the A-frame's own roof wings
  props.col = PAL.roof;
  for (const e of [-1, 1]) {
    const r0 = Pf(e * 6.2, 0.2, 7.5), r1 = Pf(0, 13.6, 7.5), r2 = Pf(0, 13.6, 4.5), r3 = Pf(e * 6.2, 0.2, 4.5);
    if (e > 0) { props.quadP(r3, r0, r1, r2); props.quadP(r0, r3, r2, r1); } else { props.quadP(r0, r3, r2, r1); props.quadP(r3, r0, r1, r2); }
  }
  // the chimney
  props.col = PAL.stone;
  const ch = L.xz(-14, -9);
  box(props, ch[0], ly + 4, ch[1], 1.6, 9, 1.6, ry);
  // the deck along the front, its rail strung with lights
  props.col = PAL.timber;
  const dq = L.xz(-6, -0.8);
  box(props, dq[0], ly - 0.3, dq[1], 20, 0.3, 2.6, ry);
  const r0 = L.xz(-16, 0.4), r1 = L.xz(4, 0.4);
  railing(near, [r0[0], ly, r0[1]], [r1[0], ly, r1[1]], 1.0, PAL.timberDark, 2.0, 0.1);
  for (let k = 0; k < 14; k++) { const q = L.xz(-15.5 + k * 1.5, 0.45); box(glow, q[0], ly + 1.05 + Math.sin(k * 1.3) * 0.05, q[1], 0.12, 0.12, 0.12); }
  // the lit sign on two posts at the lot's edge
  const sq = L.xz(8, 13.5), sy = gy(8, 13.5);
  props.col = PAL.timberDark;
  for (const o of [-1.1, 1.1]) { const q = L.xz(8 + o, 13.5); box(props, q[0], sy - 0.4, q[1], 0.2, 3.6, 0.2, ry); }
  board(B.acc(m.signs), sq[0], sy + 2.4, sq[1], 2.6, 2.6, ry, cellUV(3), cellUV(7, 4, 2, 0.02));
  // lamp posts over the lot
  for (const lx of [10, -16]) {
    const q = L.xz(lx, 6);
    lampPost(props, glow, q[0], gy(lx, 6), q[1], 7.5, q[0] + Math.sin(ry) * 0.8, q[1] + Math.cos(ry) * 0.8, PAL.steel);
  }
  // skis in a rack, snowbanks round the lot
  near.col = PAL.red;
  for (let k = 0; k < 6; k++) { const q = L.xz(-2 + k * 0.35, -2.2); box(near, q[0], ly - 0.3, q[1], 0.08, 1.7, 0.04, ry + 0.1); }
  const snow = B.acc(m.snow);
  for (const [lx, lz, s] of [[-w / 2 + 1, 6, 2.2], [w / 2 - 1, 6, 2.4], [-8, 14.2, 1.6], [16, 14.2, 1.8]]) {
    const q = L.xz(lx, lz);
    sphere(snow, q[0], gy(lx, lz) - 0.4, q[1], s, 8, { dome: true, sy: 0.45 });
  }
}

function lift3d(B, m, it) {
  const { x: bx, z: bz, tx, tz } = it;
  const props = B.acc(m.props);
  const dx = tx - bx, dz = tz - bz, len = Math.hypot(dx, dz);
  const ux = dx / len, uz = dz / len, px = -uz, pz = ux;
  const ry = Math.atan2(ux, uz);
  const nT = Math.max(2, Math.round(len / 60));
  const tops = [];
  for (let k = 0; k <= nT; k++) {
    const t = k / nT;
    const x = bx + dx * t, z = bz + dz * t, y = B.groundY(x, z);
    const H = k === 0 || k === nT ? 5.5 : 10;
    props.col = PAL.steel;
    cylinder(props, x, y - 1, z, 0.35, H + 1, 8, { r2: 0.28 });
    props.beam(x - px * 2.6, y + H, z - pz * 2.6, x + px * 2.6, y + H, z + pz * 2.6, 0.3, 0.3);
    props.col = PAL.yellow;
    for (const s of [-2.2, 2.2]) box(props, x + px * s, y + H - 0.35, z + pz * s, 0.25, 0.35, 1.2, ry);
    tops.push([x, y + H - 0.3, z]);
  }
  // the stations: a roofed bullwheel at each end
  for (const [k, cx2, cz2] of [[0, bx, bz], [nT, tx, tz]]) {
    const y = B.groundY(cx2, cz2);
    props.col = PAL.timberDark;
    box(props, cx2, y - 0.5, cz2, 8, 3.2, 6, ry);
    props.col = PAL.red;
    gable(props, cx2, y + 6.2, cz2, 9, 7.5, 1.6, ry, { over: 0.6 });
    props.col = PAL.steel;
    cylinder(props, cx2, y + 5.0, cz2, 2.4, 0.4, 14, { top: true, bottom: true });
    for (const s of [-1.6, 1.6]) box(props, cx2 + px * s, y + 2.6, cz2 + pz * s, 0.4, 3.6, 0.4, ry);
    void k;
  }
  // the haul rope, up one side and down the other
  const ropes = B.acc(m.props);
  ropes.col = lin('#1a1a1a');
  for (const s of [-2.2, 2.2]) {
    for (let k = 0; k < tops.length - 1; k++) {
      const a = tops[k], b = tops[k + 1];
      ropes.beam(a[0] + px * s, a[1], a[2] + pz * s, b[0] + px * s, b[1], b[2] + pz * s, 0.06, 0.06);
    }
  }
  // the chairs: one instanced mesh, carried round the loop
  const chair = new Acc(true);
  chair.col = PAL.steel;
  chair.beam(0, 0, 0, 0, -2.2, 0, 0.06, 0.06);
  chair.beam(-0.9, -2.2, 0, 0.9, -2.2, 0, 0.06, 0.06);
  chair.col = PAL.seat;
  box(chair, 0, -2.6, 0.1, 1.9, 0.12, 0.6);
  box(chair, 0, -2.6, -0.2, 1.9, 0.7, 0.08);
  chair.col = PAL.steel;
  chair.beam(-0.9, -2.2, 0, -0.9, -2.6, 0, 0.05, 0.05);
  chair.beam(0.9, -2.2, 0, 0.9, -2.6, 0, 0.05, 0.05);
  const geo = chair.toGeometry(false);
  const spacing = 16;
  const loop = 2 * len;
  const N = Math.floor(loop / spacing);
  const mesh = new THREE.InstancedMesh(geo, m.props, N);
  mesh.frustumCulled = false;
  B.group.add(mesh);
  const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), V = new THREE.Vector3(), S1 = new THREE.Vector3(1, 1, 1), Yax = new THREE.Vector3(0, 1, 0);
  const at = (s) => {
    // up the right side (s < len), down the left
    const up = s < len;
    const d = up ? s : loop - s;
    const t = d / len * nT, k = Math.min(nT - 1, Math.floor(t)), f = t - k;
    const a = tops[k], b = tops[k + 1];
    const side = up ? 2.2 : -2.2;
    V.set(a[0] + (b[0] - a[0]) * f + px * side, a[1] + (b[1] - a[1]) * f - Math.sin(f * Math.PI) * 0.6, a[2] + (b[2] - a[2]) * f + pz * side);
    Q.setFromAxisAngle(Yax, ry + (up ? 0 : Math.PI));
    M.compose(V, Q, S1);
  };
  const place = (t) => {
    for (let k = 0; k < N; k++) { at(((k * spacing + t * 2.2) % loop + loop) % loop); mesh.setMatrixAt(k, M); }
    mesh.instanceMatrix.needsUpdate = true;
  };
  place(0);
  B.anim((t, dt, dist) => { if (dist < 700) place(t); });
}

function flood3d(B, m, it) {
  const props = B.acc(m.props);
  props.col = PAL.steel;
  cylinder(props, it.x, it.y - 0.5, it.z, 0.14, 11, 6, { r2: 0.1 });
  const q = [it.x + Math.sin(it.ry) * 0.6, it.z + Math.cos(it.ry) * 0.6];
  box(props, q[0], it.y + 10.2, q[1], 1.4, 0.7, 0.4, it.ry);
  box(B.acc(m.glowCold), q[0] + Math.sin(it.ry) * 0.21, it.y + 10.25, q[1] + Math.cos(it.ry) * 0.21, 1.2, 0.55, 0.04, it.ry);
}

// ------------------------------------------------------------------ the ice cave

function iceCave3d(B, m, it) {
  const { x, z, ry, y } = it;
  const L = frame(x, y, z, ry);
  const face = B.acc(m.face), rocks = B.acc(m.rock);
  // the mouth: a rock wall with an arch in it, facing the trail
  archWall(face, x, y - 1, z, 22, 15, 3, 7, 3.5, ry, { u: 6 });
  // the passage behind: walls, a vaulted roof, the back wall
  const Pp = frame(x, y - 1, z, ry);
  const depth = 22, hw = 3.5;
  const quad = (a, b, c, d) => face.quadP(a, b, c, d, [0, 0, 2, 2]);
  quad(Pp(-hw, 0, -1.5), Pp(-hw, 0, -depth), Pp(-hw, 5, -depth), Pp(-hw, 5, -1.5));
  quad(Pp(hw, 0, -depth), Pp(hw, 0, -1.5), Pp(hw, 5, -1.5), Pp(hw, 5, -depth));
  quad(Pp(-hw, 5, -1.5), Pp(-hw, 5, -depth), Pp(0, 7.6, -depth), Pp(0, 7.6, -1.5));
  quad(Pp(0, 7.6, -1.5), Pp(0, 7.6, -depth), Pp(hw, 5, -depth), Pp(hw, 5, -1.5));
  quad(Pp(hw, 0, -depth), Pp(-hw, 0, -depth), Pp(-hw, 8, -depth), Pp(hw, 8, -depth));
  // ice: glowing blue formations at the back, icicles hanging from the arch
  const ice = B.acc(m.iceGlow);
  for (const [lx, lz, h, r] of [[-1.6, -20, 4.5, 1.2], [1.2, -19, 3.2, 0.9], [0, -21, 6, 1.5], [2.4, -16, 2.2, 0.6], [-2.6, -14, 1.6, 0.5]]) {
    const q = Pp(lx, 0, lz);
    cone(ice, q[0], q[1], q[2], r, h, 6);
  }
  for (let k = 0; k < 9; k++) {
    const lx = -3 + k * 0.75, q = Pp(lx, 0, 0.6);
    const hang = 6.6 - Math.abs(lx) * 0.45, len = 0.8 + ((k * 7) % 5) * 0.3;
    const b = ice.count;
    ice.v(q[0] - 0.12, y - 1 + hang, q[2]); ice.v(q[0] + 0.12, y - 1 + hang, q[2]); ice.v(q[0], y - 1 + hang - len, q[2] + 0.05);
    ice.tri(b, b + 2, b + 1); ice.tri(b, b + 1, b + 2);
  }
  // an icy floor inside
  const fl = [L.xz(-hw, -1), L.xz(hw, -1), L.xz(hw, -depth), L.xz(-hw, -depth)];
  drape(ice, B, fl, { lift: 0.08, uv: 3 });
  // boulders heaped round the mouth to bed it into the hillside
  for (const [lx, lz, s] of [[-13, -2, 7], [13, -3, 7.5], [-9, -12, 9], [9, -12, 9], [0, -20, 10], [-16, 4, 4], [16, 3, 4.5], [0, -8, 8]]) {
    const q = L.xz(lx, lz);
    F.rock(rocks, q[0], B.groundY(q[0], q[1]), q[1], s * 1.6, 0.9, (lx * 7 + lz) % 1 + 0.5, PAL.rock, PAL.rockDark, PAL.snow, 0.7);
  }
}

export default {
  id: 'summit',
  plan,
  scatter,
  warm(B) { mats(B); },
  build,
};

void mixc; void mulc; void eachOwnedSample; void findFlat; void cone;
