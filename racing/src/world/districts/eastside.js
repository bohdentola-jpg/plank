// PORT HALCYON — EASTSIDE: the suburbs east of downtown, out to the plains.
// Street after street of detached houses (ranches, colonials, bungalows,
// cape cods; clapboard in a dozen colours, brick, stucco), front lawns,
// driveways, picket fences and hedges, mailboxes, maples turning red and
// gold, porch lights and warm windows at night; courts that end in a bulb.
// EASTSIDE AVE is the strip: EASTGATE PLAZA, the gas station's canopy, the
// STARLITE DINER, BURGER BARN, BOWL-O-RAMA, the motel, the used-car lot,
// FOODTOWN. Landmarks: EASTSIDE HIGH's stadium (its light towers are on
// for Friday night), the WATER TOWER by the freeway with the town's name on
// it, ST. MARK'S. Hidden: the dirt lot BEHIND THE BLEACHERS, and the old
// STARLITE DRIVE-IN up on the bluff, where Lookout Rd ends over the town.
import { ROAD, ITEM, RESERVED } from './occ.js';
import { drape } from './builder.js';
import { frontLots } from './eastend/plan.js';
import * as H from './eastend/ehouse.js';
import * as E from './eastend/estuff.js';
import * as Fm from './eastend/farm.js';
import { M, rgb, shade, Frame, boxL, chainFence, glowBox, tree, car } from './eastend/kit.js';

const PI = Math.PI;
const AVE = -60;                                   // Eastside Ave (z)
const XS = [800, 1050, 1300, 1550, 1800, 2050, 2300];

const SIDING = ['#f4f2ec', '#f0e6c8', '#e8d890', '#b8c8a0', '#a8b8c8', '#c0d4e4', '#c8e0c8', '#e8c0a8', '#d8c4a0', '#c8c8c4', '#f2e8d8', '#9ab0b8'];
const BRICKT = ['#ffffff', '#f0e4dc', '#e4d8d0', '#fff0e4'];
const STUCCO = ['#f0e0c4', '#f4d8b8', '#e8d4b4', '#f2e8d4'];
const ROOFT = ['#5a5a5c', '#6a5448', '#3e3e40', '#7a7468', '#8a4a3a', '#4a5a4a', '#5a6470'];
const LEAVES = ['#c8501e', '#e0a020', '#b8281a', '#d87a1a', '#a8a028', '#6a8a2a', '#4a6a2a', '#e8c040', '#a83a1a', '#2a4a2a'];
const CARS = ['#7a1a14', '#1a2a4a', '#c8c4b8', '#2a2a2c', '#5a5a5e', '#3a4a2a', '#8a6a2a', '#e8e4d8', '#2a4a5a', '#6a2a4a', '#b8b0a0', '#3a5a8a'];

// ------------------------------------------------------------------ helpers

function ground(P, o, lift = 0.25) {
  const g = P.groundRange(o.x, o.z, o.w, o.d, o.ry);
  o.y0 = g.lo - 1.0;
  o.yb = g.hi + lift;
  return o;
}

/** A footprint (claimed, solid, on the far skyline): the plan item gets type and params from o. */
function solid(P, o, h, far = '#7a6a5a', lit = 0.12) {
  ground(P, o);
  P.claim(o.x, o.z, o.w, o.d, o.ry);
  const it = P.add({ map: 'building', ...o });
  P.collider({ kind: 'box', x: o.x, z: o.z, hx: o.w / 2, hz: o.d / 2, ry: o.ry, y0: o.y0, y1: o.yb + h });
  P.far({ x: o.x, z: o.z, y: o.y0, w: o.w, d: o.d, h: o.yb + h - o.y0, ry: o.ry, color: far, lit });
  return it;
}

function lamp(P, x, z, hy, color, radius, intensity = 1, halo = 1.2) {
  P.lamp({ x, z, hx: x, hz: z, hy, color, radius, intensity, halo });
}

/** A parking lot (claimed; stall lines; light poles with their lamps; a few cars). */
function parking(P, x, z, w, d, ry, o = {}) {
  if (!P.isFree(x, z, w, d, ry, { pad: 0, front: 1.6 })) return null;
  P.claim(x, z, w, d, ry);
  const F = new Frame(x, z, ry);
  const poles = [];
  for (let lx = -w / 2 + 12; lx < w / 2 - 6; lx += 28) for (let lz = -d / 2 + 9; lz < d / 2 - 4; lz += 30) poles.push([lx, lz]);
  for (const [lx, lz] of poles) {
    const px = F.X(lx, lz), pz = F.Z(lx, lz);
    P.collider({ kind: 'circle', x: px, z: pz, r: 0.3, y0: P.groundY(px, pz) - 1, y1: P.groundY(px, pz) + 10 });
    for (const sd of [-1, 1]) lamp(P, px + Math.cos(ry) * sd * 0.9, pz - Math.sin(ry) * sd * 0.9, P.groundY(px, pz) + 9.4, o.lampCol || '#e8eeff', 22, 0.95, 1.6);
  }
  const cars = [];
  const nc = Math.floor(w * d / (o.sparse ? 600 : 260));
  for (let k = 0; k < nc; k++) {
    const row = Math.floor(P.rng() * Math.max(1, Math.floor((d - 1) / 18) * 2));
    const zr = -d / 2 + 0.5 + Math.floor(row / 2) * 18 + (row % 2 ? 12.5 : 0) + 2.75;
    if (zr > d / 2 - 2.5) continue;
    const lx = -w / 2 + 2.35 + Math.floor(P.rng() * Math.max(1, (w - 3) / 2.7)) * 2.7;
    const flip = (row % 2) ? 0 : PI;
    cars.push([lx, zr, flip + (P.rng() - 0.5) * 0.06, P.pick(CARS)]);
    const cx = F.X(lx, zr), cz = F.Z(lx, zr);
    P.collider({ kind: 'box', x: cx, z: cz, hx: 0.9, hz: 2.2, ry: ry + flip, y0: P.groundY(cx, cz) - 1, y1: P.groundY(cx, cz) + 1.5 });
  }
  return P.add({ type: 'parking', x, z, w, d, ry, poles, cars, map: 'plaza' });
}

// ------------------------------------------------------------------ the plan

function plan(P) {
  const T = globalThis.__planTimes ? {} : null;
  let t = performance.now();
  const step = (name, fn) => { fn(P); if (T) { const n = performance.now(); T[name] = +(n - t).toFixed(1); t = n; } };
  step('strip', strip);
  step('campus', campus);
  step('park', park);
  step('tower', waterTower);
  step('wall', soundWall);
  step('bluff', bluff);
  step('bulbs', bulbs);
  step('houses', houses);
  step('plains', (P2) => Fm.planPlains(P2, { house, solid }));
  if (T) globalThis.__planTimes.eastside = T;
}

// ---- Eastside Ave: the strip

function strip(P) {
  const nf = AVE - 12.6, sf = AVE + 12.6;          // fronts on the avenue's two sides
  // west end: WELCOME TO EASTSIDE, and the motel
  P.add({ type: 'pylon', x: 760, z: sf + 3, ry: PI, h: 0.6, w: 7, sh: 1.3, key: 'water', pylon: true, col: '#8a4a3a' });
  P.collider({ kind: 'box', x: 760, z: sf + 3, hx: 3.8, hz: 0.5, ry: 0, y0: 4, y1: 9 });
  // BOWL-O-RAMA (north side, block 1)
  parking(P, 925, nf - 20, 220, 38, 0, { sparse: true });
  const bowl = solid(P, { type: 'bigbox', x: 925, z: nf - 62, w: 60, d: 40, ry: 0, h: 8.5, tint: '#e0d4c0', key: 'bowl', signW: 14, trim: '#7a1a3a', stores: [11, 14] }, 9.5, '#8a7a68', 0.05);
  lamp(P, 925, nf - 40, bowl.yb + 7, '#3ae0ff', 14, 0.8, 2.5);
  lamp(P, 925, nf - 40, bowl.yb + 4.4, '#fff2d8', 12, 0.9, 1.2);
  // the STARLITE MOTEL (south side, block 1)
  const motel = solid(P, { type: 'motel', x: 935, z: sf + 34, w: 66, d: 11, ry: PI, tint: '#e8d0a8' }, 8, '#8a7a68', 0.25);
  parking(P, 935, sf + 12, 160, 20, PI, { sparse: true, lampCol: '#ffd8a0' });
  P.add({ type: 'pylon', x: 860, z: sf + 3, ry: PI, h: 5.5, w: 4.4, sh: 2.8, key: 'motel' });
  P.collider({ kind: 'circle', x: 860, z: sf + 3, r: 0.6, y0: 4, y1: 14 });
  lamp(P, 860, sf + 2, motel.yb + 7, '#ff3a3a', 12, 0.8, 2.6);
  // HALCYON MOTORS (north, block 2): a lot full of cars, pennants
  {
    const x = 1175, z = nf - 26, w = 225, d = 50;
    if (P.isFree(x, z, w, d, 0, { pad: 0, front: 1.6 })) {
      P.claim(x, z, w, d, 0);
      const poles = [[-w / 2 + 2, d / 2 - 1], [-w / 4, d / 2 - 1], [0, d / 2 - 1], [w / 4, d / 2 - 1], [w / 2 - 2, d / 2 - 1]];
      const cars = [];
      for (let row = 0; row < 3; row++) for (let k = 0; k < 26; k++) {
        if (P.rng() < 0.12) continue;
        cars.push([-w / 2 + 8 + k * 8, d / 2 - 8 - row * 13, PI + 0.5, P.pick(['#c81e1e', '#e8e4d8', '#1a1a1a', '#e8c020', '#2a5ac8', '#5a5a5e', '#3a6a3a', '#8a2a4a'])]);
      }
      P.add({ type: 'parking', x, z, w, d, ry: 0, poles: [[-60, 0], [0, 0], [60, 0]], cars: cars.map(([a, b, c, e]) => [a, b, c - PI, e]), map: 'plaza', dense: true });
      for (const [lx] of [[-60], [0], [60]]) { lamp(P, x + lx - 0.9, z, 9.4 + P.groundY(x, z), '#f0f4ff', 24, 1.1, 1.6); lamp(P, x + lx + 0.9, z, 9.4 + P.groundY(x, z), '#f0f4ff', 24, 1.1, 1.6); }
      for (const [a, b] of cars) P.collider({ kind: 'box', x: x + a, z: z + b, hx: 1.6, hz: 2.4, ry: 0.5, y0: 4, y1: 7.5 });
      P.add({ type: 'dealer', x, z, ry: 0, w, d, office: [w / 2 - 14, -d / 2 + 6], poles });
      P.collider({ kind: 'box', x: x + w / 2 - 14, z: z - d / 2 + 6, hx: 5, hz: 3.5, ry: 0, y0: 4, y1: 10 });
    }
  }
  // BURGER BARN and a little strip (south, block 2)
  const burger = solid(P, { type: 'burger', x: 1090, z: sf + 26, w: 14, d: 10, ry: PI }, 7, '#a8281e', 0.2);
  P.add({ type: 'pylon', x: 1072, z: sf + 3, ry: PI, h: 6, w: 4.2, sh: 2.1, key: 'burger' });
  P.collider({ kind: 'circle', x: 1072, z: sf + 3, r: 0.6, y0: 4, y1: 14 });
  lamp(P, 1090, sf + 18, burger.yb + 3.5, '#ffe0a0', 12, 0.9, 1.2);
  parking(P, 1125, sf + 12, 40, 18, PI, { sparse: true });
  solid(P, { type: 'strip', x: 1215, z: sf + 38, w: 54, d: 16, ry: PI, stores: [12, 3, 0, 4, 13, 8, 7, 9, 2, 5].slice(0, 9), tint: '#e0d0b8', trim: '#2a4a6a' }, 6.5, '#8a7a68', 0.3);
  parking(P, 1215, sf + 13, 60, 22, PI);
  // EASTGATE PLAZA (north, block 3) and its pylon
  const plaza = solid(P, { type: 'strip', x: 1420, z: nf - 66, w: 96, d: 18, ry: 0, stores: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 4], tint: '#e8dcc8', trim: '#7a2a1e' }, 6.5, '#8a7a68', 0.3);
  parking(P, 1420, nf - 27, 210, 46, 0);
  P.add({ type: 'pylon', x: 1322, z: nf - 3, ry: 0, h: 5, w: 6.4, sh: 3.2, key: 'plaza', pylon: true, col: '#7a2a1e' });
  P.collider({ kind: 'box', x: 1322, z: nf - 3, hx: 3.6, hz: 0.6, ry: 0, y0: 4, y1: 14 });
  lamp(P, 1322, nf - 4.5, plaza.yb + 7, '#ffd040', 10, 0.8, 2.2);
  for (let k = 0; k < 4; k++) lamp(P, 1420 - 36 + k * 24, nf - 55, plaza.yb + 3.6, '#fff2d8', 10, 0.9, 1.0);
  // the STARLITE DINER (south, block 3)
  const diner = solid(P, { type: 'diner', x: 1360, z: sf + 22, w: 20, d: 8, ry: PI }, 8, '#c8ccd0', 0.6);
  parking(P, 1440, sf + 16, 90, 22, PI, { sparse: true, lampCol: '#ffe0b0' });
  lamp(P, 1360, sf + 16, diner.yb + 5, '#ff3a8a', 14, 0.9, 2.4);
  lamp(P, 1360, sf + 17, diner.yb + 2, '#ffd8a0', 10, 0.8, 1.0);
  // EASTGATE GAS (north-east corner of Eastside & Orchard)
  {
    const x = 1600, z = nf - 22, ry = 0;
    if (P.isFree(x, z, 50, 44, ry, { pad: 0, front: 1.6 })) {
      P.claim(x, z, 50, 44, ry);
      const it = P.add({ type: 'gas', x, z: z + 4, ry, cw: 26, cd: 14, store: [0, -16, 18, 9], map: 'plaza' });
      P.add({ type: 'lot', x, z, poly: [[x - 25, z - 22], [x + 25, z - 22], [x + 25, z + 22], [x - 25, z + 22]], kind: 'asphalt', map: 'plaza' });
      P.add({ type: 'parking', x, z, w: 50, d: 44, ry, poles: [], cars: [[-7, 4, 0.02, P.pick(CARS)], [7, 6, PI, P.pick(CARS)]], map: 'plaza', bare: true });
      const y = P.groundY(x, z);
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) P.collider({ kind: 'circle', x: x + sx * 7.8, z: z + 4 + sz * 3.1, r: 0.4, y0: y - 1, y1: y + 6 });
      for (const sx of [-1, 0, 1]) P.collider({ kind: 'box', x: x + sx * 7.8, z: z + 4, hx: 0.7, hz: 3.5, ry: 0, y0: y - 1, y1: y + 2 });
      P.collider({ kind: 'box', x, z: z - 12, hx: 9, hz: 4.5, ry: 0, y0: y - 1, y1: y + 6 });
      P.far({ x, z: z + 4, y: y + 5.2, w: 26, d: 14, h: 1.2, color: '#e8e4dc', lit: 0 });
      for (const [lx, lz] of [[-6, 0], [6, 0], [-6, 8], [6, 8]]) lamp(P, x + lx, z + lz, y + 5.1, '#f4f8ff', 20, 1.2, 0);
      P.add({ type: 'pylon', x: x + 22, z: nf - 3, ry: 0, h: 6.5, w: 5, sh: 3.2, key: 'gas' });
      P.collider({ kind: 'circle', x: x + 22, z: nf - 3, r: 0.6, y0: y - 1, y1: y + 12 });
      void it;
    }
  }
  // FOODTOWN (south of the avenue, block 4)
  const food = solid(P, { type: 'bigbox', x: 1676, z: sf + 74, w: 72, d: 46, ry: PI, h: 7.5, tint: '#e8e0d0', key: 'foodtown', signW: 22, trim: '#c81e1e', stores: [15, 4, 15, 6] }, 8, '#8a7a68', 0.05);
  parking(P, 1676, sf + 26, 200, 40, PI);
  lamp(P, 1676, food.z - 26, food.yb + 6, '#ff3a2a', 14, 0.8, 2.2);
  // a little strip of shops (north, block 4) and ST. MARK'S (north, block 5)
  solid(P, { type: 'strip', x: 1725, z: nf - 42, w: 42, d: 15, ry: 0, stores: [6, 10, 1, 12, 5, 9, 11], tint: '#d8c8b0', trim: '#2a5a3a' }, 6.5, '#8a7a68', 0.3);
  parking(P, 1725, nf - 16, 48, 26, 0, { sparse: true });
  const ch = solid(P, { type: 'church', x: 1862, z: nf - 34, w: 15, d: 30, ry: 0 }, 22, '#7a3a2a', 0.2);
  P.far({ shape: 'cone', x: 1862, z: ch.z + 17.2, y: ch.yb + 15.9, r: 2.7, h: 14, color: '#3a3c44' });
  P.collider({ kind: 'box', x: 1862, z: ch.z + 17.2, hx: 2.4, hz: 2.4, ry: 0, y0: ch.y0, y1: ch.yb + 40 });
  P.claim(1862, ch.z + 17.2, 5, 5, 0);
  P.add({ type: 'pylon', x: 1840, z: nf - 3, ry: 0, h: 0.4, w: 4.2, sh: 1.6, key: 'church', pylon: true, col: '#7a3a2a' });
  P.collider({ kind: 'box', x: 1840, z: nf - 3, hx: 2.4, hz: 0.5, ry: 0, y0: 4, y1: 30 });
  for (const sx of [-6, 6]) lamp(P, 1862 + sx, ch.z + 20, ch.yb + 2.5, '#ffe8c0', 12, 0.8, 0.8);
  parking(P, 1920, nf - 30, 60, 50, 0, { sparse: true, lampCol: '#ffe0b0' });
  P.landmark({ id: 'st_marks', name: "ST. MARK'S", x: 1862, z: ch.z, r: 30, kind: 'church' });
  P.landmark({ id: 'eastgate', name: 'EASTGATE PLAZA', x: 1420, z: nf - 40, r: 90, kind: 'mall' });
}

// ---- EASTSIDE HIGH and the stadium

function campus(P) {
  // the school, facing the street (z 270) across its lawn
  const sx = 1290, sz = 311, sw = 150, sd = 22;
  const school = solid(P, { type: 'school', x: sx, z: sz, w: sw, d: sd, ry: PI, lit: 0.22, gym: [-(1394 - sx), 48, 36, 9.5] }, 7.2, '#7a3a2a', 0.2);
  // the gym's footprint (behind the main block's east end)
  const gx = 1394, gz = sz + (36 - sd) / 2 * 1;
  P.claim(gx, gz + 2, 50, 38, 0);
  P.collider({ kind: 'box', x: gx, z: gz + 2, hx: 24, hz: 18, ry: 0, y0: school.y0, y1: school.yb + 10 });
  P.far({ x: gx, z: gz + 2, y: school.y0, w: 48, d: 36, h: school.yb + 10 - school.y0, color: '#7a3a2a', lit: 0.1 });
  P.add({ type: 'pylon', x: 1215, z: 283, ry: PI, h: 0.8, w: 4.6, sh: 2.3, key: 'mascot', pylon: true, col: '#7a3a2a' });
  P.collider({ kind: 'box', x: 1215, z: 283, hx: 2.6, hz: 0.5, ry: 0, y0: 4, y1: 10 });
  for (const lx of [-40, -10, 20, 50]) lamp(P, sx + lx, sz - 13, school.yb + 3, '#eef4ff', 10, 0.8, 0.9);
  // its front lawn stays open (and the park's edge along the street too)
  P.claim(sx, 289, 190, 20, 0);
  P.claim(978, 306, 372, 52, 0);
  // the lot off School Ln
  parking(P, 1244, 370, 108, 76, 0, { sparse: true });
  // the stadium: field, track, stands, the light towers (on: it's Friday night)
  const cx = 1405, cz = 455, y = P.groundY(cx, cz);
  P.claim(cx, cz - 3, 176, 124, 0);
  const towers = [[-75, -55], [75, -55], [-75, 56], [75, 56]];
  P.add({ type: 'stadium', x: cx, z: cz, ry: 0, y, towers, map: 'field' });
  for (const [lx, lz] of towers) {
    const tx = cx + lx, tz = cz + lz;
    P.collider({ kind: 'circle', x: tx, z: tz, r: 1.1, y0: y - 1, y1: y + 32 });
    P.far({ x: tx, z: tz, y, w: 1.4, d: 1.4, h: 30, color: '#6a6e74' });
    P.far({ x: tx, z: tz, y: y + 30, w: 7, d: 1, h: 3.6, color: '#f4f6ff', lit: 1 });
    // the bank of lights (a halo you see across town) and the light it throws on the field
    P.lamp({ x: tx, z: tz, hx: tx - lx * 0.03, hz: tz - lz * 0.03, hy: y + 31.8, color: '#f4f8ff', radius: 6, intensity: 0.1, halo: 9 });
  }
  for (const [lx, lz] of [[-40, -14], [0, -14], [40, -14], [-40, 14], [0, 14], [40, 14]]) P.lamp({ x: cx + lx, z: cz + lz, hx: cx + lx, hz: cz + lz, hy: y + 12, color: '#eef4ff', radius: 46, intensity: 0.75, halo: 0 });
  for (const [sz2, len, rows] of [[-1, 100, 12], [1, 70, 7]]) {
    const z = cz + sz2 * (48 + rows * 0.42);
    P.collider({ kind: 'box', x: cx, z, hx: len / 2, hz: rows * 0.43 + 0.4, ry: 0, y0: y - 1, y1: y + rows * 0.45 + 5 });
    P.far({ x: cx, z, y, w: len, d: rows * 0.85, h: rows * 0.45 + (sz2 < 0 ? 4.5 : 1.5), color: '#9a968c' });
  }
  P.collider({ kind: 'box', x: cx + 89, z: cz, hx: 0.6, hz: 4, ry: 0, y0: y - 1, y1: y + 11 });
  // the ballpark, west of the stadium
  P.claim(1238, 470, 84, 56, 0);
  P.add({ type: 'diamond', x: 1238, z: 497, ry: PI, y: P.groundY(1238, 490), map: 'field' });
  // tennis courts by Orchard Ave
  P.claim(1505, 365, 44, 62, 0);
  P.add({ type: 'courts', x: 1505, z: 365, w: 40, d: 58, ry: 0, map: 'field' });
  for (const [a, b] of [[[1485, 336], [1525, 336]], [[1525, 336], [1525, 394]], [[1525, 394], [1485, 394]], [[1485, 394], [1485, 336]]]) {
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    P.collider({ kind: 'box', x: (a[0] + b[0]) / 2, z: (a[1] + b[1]) / 2, hx: len / 2, hz: 0.15, ry: -Math.atan2(b[1] - a[1], b[0] - a[0]), y0: 4, y1: 9 });
  }
  // BEHIND THE BLEACHERS: the dirt lot off Back Lot Rd, cars nose to the stand
  P.claim(1410, 534, 176, 36, 0);
  P.add({ type: 'lot', x: 1410, z: 534, poly: [[1322, 516], [1498, 516], [1498, 552], [1322, 552]], kind: 'dirt', map: 'yard' });
  for (let k = 0; k < 6; k++) {
    const x = 1350 + k * 22 + P.rng() * 6, z = 527 + P.rng() * 4, ry = PI + (P.rng() - 0.5) * 0.4;
    P.add({ type: 'car', x, z, ry, col: P.pick(['#c81e1e', '#1a1a1a', '#e8c020', '#2a5ac8', '#e8e4d8', '#3a8a3a']), lights: P.rng() < 0.6 });
    P.collider({ kind: 'box', x, z, hx: 0.95, hz: 2.25, ry, y0: 4, y1: 7.6 });
  }
  P.add({ type: 'fire', x: 1415, z: 541 });
  P.collider({ kind: 'circle', x: 1415, z: 541, r: 0.45, y0: 4, y1: 7.5 });
  lamp(P, 1415, 541, y + 1.6, '#ff8a30', 11, 1.0, 2.0);
  P.landmark({ id: 'eastside_high', name: 'EASTSIDE HIGH', x: cx, z: cz, r: 110, kind: 'stadium' });
  P.landmark({ id: 'bleachers', name: 'BEHIND THE BLEACHERS', x: 1410, z: 534, r: 45, kind: 'hangout', hidden: true });
}

// ---- EASTSIDE PARK (between the campus and downtown)

function park(P) {
  P.claim(955, 418, 160, 96, 0);
  P.add({ type: 'pond', x: 955, z: 418, rx: 64, rz: 38, ry: 0.15, map: 'water' });
  P.add({ type: 'playground', x: 812, z: 322, ry: 0.3 });
  P.claim(812, 322, 26, 16, 0.3);
  P.collider({ kind: 'box', x: 812, z: 322, hx: 12, hz: 4, ry: 0.3, y0: 4, y1: 8 });
  P.add({ type: 'gazebo', x: 1062, z: 335 });
  P.claim(1062, 335, 10, 10, 0);
  P.collider({ kind: 'circle', x: 1062, z: 335, r: 4.4, y0: 4, y1: 10 });
  // paths round the pond, benches and lamps along them
  const ring = [];
  for (let k = 0; k <= 24; k++) { const a = (k / 24) * PI * 2; ring.push([955 + Math.cos(a) * 76, 418 + Math.sin(a) * 50]); }
  P.add({ type: 'path', x: 955, z: 418, pts: ring, w: 3 });
  for (let k = 0; k < 12; k++) {
    const a = (k / 12) * PI * 2 + 0.13, x = 955 + Math.cos(a) * 80, z = 418 + Math.sin(a) * 54;
    if (k % 2) { P.add({ type: 'bench', x, z, ry: -a + PI / 2 }); P.collider({ kind: 'circle', x, z, r: 0.8, y0: 4, y1: 7 }); }
    else { P.add({ type: 'plamp', x, z }); P.collider({ kind: 'circle', x, z, r: 0.2, y0: 4, y1: 10 }); lamp(P, x, z, P.groundY(x, z) + 3.75, '#ffe2b0', 10, 0.85, 1.1); }
  }
  P.landmark({ id: 'eastside_park', name: 'EASTSIDE PARK', x: 955, z: 418, r: 90, kind: 'park' });
}

// ---- the water tower, by the freeway

function waterTower(P) {
  const x = 1870, z = -482, y = P.groundY(x, z), h = 30;
  if (!P.isFree(x, z, 22, 22, 0, { pad: 0 })) return;
  P.claim(x, z, 22, 22, 0);
  P.add({ type: 'wtower', x, z, y, h, faces: [PI / 2, -PI / 2], map: 'building' });
  for (let k = 0; k < 6; k++) { const a = (k / 6) * PI * 2; P.collider({ kind: 'circle', x: x + Math.cos(a) * 9.7, z: z + Math.sin(a) * 9.7, r: 0.6, y0: y - 1, y1: y + h }); }
  P.collider({ kind: 'circle', x, z, r: 1.0, y0: y - 1, y1: y + h });
  P.far({ shape: 'cyl', x, z, y: y + h - 4.5, r: 7.8, h: 11, color: '#c8ccd0' });
  P.far({ shape: 'cyl', x, z, y, r: 5, r2: 1.2, h: h - 4.4, color: '#8a8e94' });
  P.lamp({ x, z, hx: x, hz: z + 1, hy: y + h + 6.5 + 3.3, color: '#ff2a18', radius: 1.5, intensity: 0.2, halo: 4.5 });
  for (const [dx, dz] of [[-10, 12], [10, 12], [0, -14]]) P.lamp({ x: x + dx, z: z + dz, hx: x + dx * 0.6, hz: z + dz * 0.6, hy: y + 1.5, color: '#fff0d0', radius: 14, intensity: 0.7, halo: 1.0 });
  P.landmark({ id: 'water_tower', name: 'EASTSIDE WATER TOWER', x, z, r: 30, kind: 'tower' });
}

// ---- the freeway's sound wall (along the houses north of the first street)

function soundWall(P) {
  for (const r of P.net.roads) {
    if (r.rt.id !== 'freeway') continue;
    const off = r.rt.hw + r.rt.shoulder + 4.0;
    let run = [];
    const flush = () => {
      if (run.length >= 3) {
        for (let a = 0; a < run.length - 1; a += 11) {
          const pts = run.slice(a, a + 12);
          const m = pts[pts.length >> 1];
          P.add({ type: 'swall', x: m[0], z: m[1], pts, h: 4.6 });
        }
        for (let k = 0; k < run.length - 1; k++) {
          const [ax, az] = run[k], [bx, bz] = run[k + 1];
          const len = Math.hypot(bx - ax, bz - az);
          P.collider({ kind: 'box', x: (ax + bx) / 2, z: (az + bz) / 2, hx: len / 2, hz: 0.3, ry: -Math.atan2(bz - az, bx - ax), y0: P.groundY(ax, az) - 1, y1: P.groundY(ax, az) + 4.6 });
          P.claim((ax + bx) / 2, (az + bz) / 2, len, 1.2, -Math.atan2(bz - az, bx - ax));
        }
      }
      run = [];
    };
    for (let s = (r.trim0 || 0) + 10; s < r.length - (r.trim1 || 0) - 10; s += 8) {
      const p = r.posAt(s);
      const i = p.i;
      if (r.flags[i] & 4) { flush(); continue; }
      // the south side (larger z)
      const k = r.LZ[i] < 0 ? -1 : 1;
      const x = p.x + r.LX[i] * k * off, z = p.z + r.LZ[i] * k * off;
      const ok = x > 1100 && x < 2280 && P.inside(x, z) && !P.occ.hitDisc(x, z, 1.0, ROAD | ITEM);
      if (ok) run.push([x, z]); else flush();
    }
    flush();
  }
}

// ---- up on the bluff: the old drive-in, the lookout

function bluff(P) {
  const x = 2882, z = 212, ry = -PI / 2;          // the screen's face to the west
  const y = P.groundY(x, z);
  if (!P.isFree(x + 3, z, 10, 34, 0, { pad: 0 })) return;
  P.claim(x + 3, z, 10, 34, 0);
  P.claim(2846, z, 48, 62, 0);
  P.add({ type: 'drivein', x, z, ry, gate: [80, 50, 0.3], map: 'yard' });
  P.collider({ kind: 'box', x: x + 3, z, hx: 4, hz: 16, ry: 0, y0: y - 1, y1: y + 18 });
  P.far({ x: x + 1, z, y: y + 3.5, w: 1.2, d: 30, h: 13.5, color: '#b8bcc0', lit: 0 });
  // abandoned cars facing the screen, a few still parked by the lookout
  for (const [cx, cz, cry] of [[2836, 196, PI / 2 + 0.1], [2848, 236, PI / 2 - 0.05], [2826, 220, PI / 2]]) {
    P.add({ type: 'car', x: cx, z: cz, ry: cry, col: '#3a3430', wreck: true });
    P.collider({ kind: 'box', x: cx, z: cz, hx: 0.95, hz: 2.25, ry: cry, y0: y - 1, y1: y + 2 });
  }
  for (const [cx, cz, cry, c] of [[2812, 306, -PI / 2 + 0.2, '#c81e1e'], [2818, 318, -PI / 2 - 0.15, '#e8e4d8']]) {
    P.add({ type: 'car', x: cx, z: cz, ry: cry, col: c, lights: true });
    P.collider({ kind: 'box', x: cx, z: cz, hx: 0.95, hz: 2.25, ry: cry, y0: y - 3, y1: y + 2 });
  }
  // the lookout's rail and a coin telescope
  P.add({ type: 'lookout', x: 2800, z: 300, ry: PI / 2 });
  P.landmark({ id: 'drive_in', name: 'STARLITE DRIVE-IN', x: 2850, z: 230, r: 60, kind: 'lookout', hidden: true });
}

// ---- the bulbs at the end of every court

function bulbs(P) {
  for (const n of P.net.nodes.values()) {
    if (n.kind !== 'dead' || !n.id.startsWith('xe_c')) continue;
    const e = n.ends[0];
    // the bulb sits a little past the end, round on the road's line
    const cx = n.x + e.dx * -4, cz = n.z + e.dz * -4;
    P.occ.markDisc(cx, cz, 15.5, ITEM);
    const pts = [];
    for (let k = 0; k < 16; k++) { const a = (k / 16) * PI * 2; pts.push([cx + Math.cos(a) * 13, cz + Math.sin(a) * 13]); }
    P.add({ type: 'bulb', x: cx, z: cz, pts, map: 'plaza' });
    // an island in the middle (a tree, a lamp)
    P.collider({ kind: 'circle', x: cx, z: cz, r: 2.6, y0: P.groundY(cx, cz) - 1, y1: P.groundY(cx, cz) + 6 });
    lamp(P, cx, cz, P.groundY(cx, cz) + 5.2, '#ffd8a0', 16, 0.9, 1.4);
  }
}

// ---- the houses

const OLD = (x, z) => x < 1320 && z < 280;           // the older streets near downtown: bungalows, colonials

function houses(P) {
  const lots = frontLots(P, {
    roads: (r) => (r.rt.id === 'street' || r.rt.id === 'avenue') && r.spec.id !== 'i9_eastside' && !r.spec.id.startsWith('c_'),
    width: (P2) => P2.range(21, 29), depth: [30, 42], gap: [0, 2.5], setback: 0, pad: 0.2, ends: 2,
  });
  for (const L of lots) house(P, L);
}

function house(P, L) {
  const old = OLD(L.x, L.z), r = P.rng();
  let style = old ? (r < 0.4 ? 'bungalow' : r < 0.75 ? 'colonial' : r < 0.9 ? 'cape' : 'ranch') : (r < 0.45 ? 'ranch' : r < 0.65 ? 'colonial' : r < 0.82 ? 'cape' : 'bungalow');
  if (L.farm) style = r < 0.7 ? 'colonial' : 'cape';
  const wr = P.rng();
  const wall = L.farm ? 'siding' : style === 'ranch' ? (wr < 0.45 ? 'siding' : wr < 0.8 ? 'brick' : 'stucco') : (wr < 0.78 ? 'siding' : 'brick');
  const tint = L.farm ? P.pick(['#f4f2ec', '#f2ece0', '#efe6cf', '#e9e6de']) : wall === 'siding' ? P.pick(SIDING) : wall === 'brick' ? P.pick(BRICKT) : P.pick(STUCCO);
  const s = P.rng() < 0.5 ? 1 : -1;                  // the garage side
  const o = {
    type: 'home', x: L.x, z: L.z, w: L.w, d: L.d, ry: L.ry, style, wall, tint,
    roofTint: P.pick(ROOFT), trim: P.rng() < 0.8 ? '#f2f0ea' : P.pick(['#e8dcc0', '#2a3a2a', '#5a2a1e']),
    lit: 0.22 + P.rng() * 0.3, shutters: wall === 'siding' && P.rng() < 0.6, fh: 2.9, floors: 1,
    garIn: null, wing: null, back: null, porch: null, dormers: 0, chimney: 0, pic: -1,
  };
  const fy = P.range(8, 11.5);
  let hw, hd;
  if (style === 'ranch') {
    hw = P.range(15, Math.min(19, L.w - 5)); hd = P.range(9, 10.5);
    o.roof = P.rng() < 0.6 ? 'hip' : 'gable'; o.rise = P.range(1.9, 2.4);
    const n = Math.max(1, Math.round(hw / 3));
    o.garIn = s > 0 ? [n - 2, n - 1] : [0, 1];
    o.door = s > 0 ? Math.max(0, Math.floor((n - 2) / 2) - 0) : Math.min(n - 1, 2 + Math.floor((n - 2) / 2));
    o.pic = s > 0 ? Math.max(0, o.door - 1) : Math.min(n - 1, o.door + 1);
    if (P.rng() < 0.35) o.porch = { w: 7, d: 2.2, x: -hw / 2 + (o.door + 0.5) * (hw / n) };
  } else if (style === 'colonial') {
    hw = P.range(11, Math.min(13.5, L.w - 9)); hd = P.range(8.5, 10);
    o.floors = 2; o.roof = 'gable'; o.rise = P.range(2.9, 3.5);
    const n = Math.max(1, Math.round(hw / 3));
    o.door = Math.floor(n / 2);
    if (P.rng() < 0.5 || L.farm) o.porch = { w: hw * 0.9, d: 2.4, x: 0 };
    if (L.w - hw > 9.5 && P.rng() < 0.75) o.wing = { w: 6.6, d: 7.2, doors: 2 };
  } else if (style === 'cape') {
    hw = P.range(10, Math.min(12.5, L.w - 8)); hd = P.range(8, 9);
    o.roof = 'gable'; o.rise = P.range(3.8, 4.4); o.fh = 2.8;
    const n = Math.max(1, Math.round(hw / 3));
    o.door = Math.floor(n / 2);
    o.dormers = P.rng() < 0.75 ? 2 : 0;
    if (L.w - hw > 9.5 && P.rng() < 0.5) o.wing = { w: 6.2, d: 7, doors: 1, rise: 1.6 };
  } else {
    hw = P.range(9, Math.min(11, L.w - 8)); hd = P.range(12, 14);
    o.roof = 'gableZ'; o.rise = P.range(3.4, 4.2); o.fh = 3.0;
    const n = Math.max(1, Math.round(hw / 3));
    o.door = s > 0 ? 0 : n - 1;
    o.porch = { w: hw, d: 2.6, x: 0 };
    if (L.d > 34 && P.rng() < 0.75) o.back = { w: 6.2, d: 6.4, doors: 1, rise: 1.4 };
  }
  hd = Math.min(hd, L.d - fy - 6);
  if (hd < 7) return;
  o.chimney = P.rng() < 0.45 ? (P.rng() < 0.5 ? 1 : -1) : 0;
  o.hw = hw; o.hd = hd;
  // across the lot: the house (and its wing) centred in what's left by the drive
  const wingW = o.wing ? o.wing.w : 0;
  const total = hw + wingW;
  const slack = L.w - total - 2.4 - (o.back ? 3.6 : 0);
  if (slack < 0) return;
  const bare = !o.garIn && !o.wing && !o.back;
  const cx = -s * (o.back ? 1.8 : bare ? Math.min(2.2, slack / 2) : 0) + (bare ? 0 : (P.rng() - 0.5) * slack * 0.5);
  o.hx = cx - s * wingW / 2;
  o.hz = L.d / 2 - fy - hd / 2;
  const front = o.hz + hd / 2;
  const n = Math.max(1, Math.round(hw / 3)), bw = hw / n;
  const doorX = o.hx - hw / 2 + (o.door + 0.5) * bw;
  o.walkX = doorX;
  if (o.garIn) o.drive = { x: o.hx + s * (hw / 2 - bw), w: 5.6, z1: front };
  if (o.wing) {
    o.wing.x = o.hx + s * (hw / 2 + o.wing.w / 2);
    o.wing.z = front - o.wing.d / 2 + 0.4;
    o.drive = { x: o.wing.x, w: o.wing.doors === 2 ? 5.6 : 3.2, z1: front + 0.4 };
  }
  if (o.back) {
    o.back.x = o.hx + s * (hw / 2 + 2.2);
    o.back.z = -L.d / 2 + o.back.d / 2 + 2;
    o.drive = { x: o.back.x, w: 3, z1: o.back.z + o.back.d / 2 };
    if (Math.abs(o.back.x) + o.back.w / 2 > L.w / 2 - 0.5) o.back.x = s * (L.w / 2 - 0.6 - o.back.w / 2);
  }
  if (!o.drive) o.drive = { x: o.hx + s * (hw / 2 + 2), w: 3, z1: front - 2 };
  if (o.porch) o.walkX = o.hx + (o.porch.x ?? 0) + (o.door === 0 ? -1 : 1) * 0 + (doorX - o.hx - (o.porch.x ?? 0));
  if (Math.abs(o.walkX - o.drive.x) < o.drive.w / 2 + 1.4) o.walkX = undefined;
  const fr = P.rng();
  o.fence = fr < 0.24 ? 'picket' : fr < 0.38 ? 'hedge' : null;
  o.back_fence = P.rng() < 0.5;
  o.mailbox = o.drive.x - s * (o.drive.w / 2 + 0.9);
  if (Math.abs(o.mailbox) > L.w / 2 - 0.5) o.mailbox = o.drive.x + s * (o.drive.w / 2 + 0.9);
  o.mailCol = P.pick(['#1a1a1a', '#1a1a1a', '#f2f0ea', '#2a4a7a', '#7a1a14']);
  o.lawn = P.pick(['#ffffff', '#f0f4e0', '#e8f0d8', '#fff8d8', '#d8e8c8']);
  // trees: one out front (away from the drive and walk), one or two out back
  const trees = [];
  const tx = -s * (L.w / 2 - 4.5) + (P.rng() - 0.5) * 2;
  if (P.rng() < 0.85 && Math.abs(tx - o.drive.x) > o.drive.w / 2 + 2.5 && (o.walkX === undefined || Math.abs(tx - o.walkX) > 2.5)) trees.push([tx, L.d / 2 - 3.2 - P.rng() * 2, P.range(0.85, 1.25), P.pick(LEAVES)]);
  for (let k = 0; k < (P.rng() < 0.6 ? 2 : 1); k++) trees.push([(P.rng() - 0.5) * (L.w - 6), -L.d / 2 + 3 + P.rng() * Math.max(1, o.hz - hd / 2 + L.d / 2 - 7), P.range(0.9, 1.4), P.pick(LEAVES)]);
  o.trees = trees;
  // out back
  const extras = [];
  const backZ = (o.hz - hd / 2 + (-L.d / 2)) / 2;
  if (o.hz - hd / 2 + L.d / 2 > 10) {
    const er = P.rng();
    if (er < 0.24) extras.push({ k: 'pool', x: (P.rng() - 0.5) * (L.w - 12), z: backZ });
    else if (er < 0.42) extras.push({ k: 'shed', x: -s * (L.w / 2 - 3), z: -L.d / 2 + 2.6, tint: P.pick(SIDING) });
    else if (er < 0.54) extras.push({ k: 'swing', x: (P.rng() - 0.5) * (L.w - 10), z: backZ, col: P.pick(['#c82a2a', '#2a6ac8', '#e8c020', '#2a9a4a']) });
    else if (er < 0.6) extras.push({ k: 'tramp', x: (P.rng() - 0.5) * (L.w - 10), z: backZ });
  }
  if ((o.garIn || o.wing) && P.rng() < 0.16) extras.push('hoop');
  o.extras = extras;
  // the footprint, ground, colliders, lights
  ground(P, o, 0.45);
  const F = new Frame(L.x, L.z, L.ry);
  const top = o.yb + o.floors * o.fh;
  const hx = F.X(o.hx, o.hz), hz = F.Z(o.hx, o.hz);
  const pd = o.porch ? o.porch.d : 0;
  P.collider({ kind: 'box', x: F.X(o.hx, o.hz + pd / 2), z: F.Z(o.hx, o.hz + pd / 2), hx: hw / 2 + (o.chimney ? 0.9 : 0), hz: hd / 2 + pd / 2, ry: L.ry, y0: o.y0, y1: top + o.rise });
  P.far({ x: hx, z: hz, y: o.y0, w: hw, d: hd, h: top + o.rise * 0.5 - o.y0, ry: L.ry, color: '#' + hex3(shade(rgbL(tint), 0.55)), lit: 0.25 });
  for (const g of [o.wing, o.back]) {
    if (!g) continue;
    const gx = F.X(g.x, g.z), gz = F.Z(g.x, g.z);
    P.collider({ kind: 'box', x: gx, z: gz, hx: g.w / 2, hz: g.d / 2, ry: L.ry, y0: o.y0, y1: o.yb + 4.6 });
  }
  for (const [lx, lz] of trees) P.collider({ kind: 'circle', x: F.X(lx, lz), z: F.Z(lx, lz), r: 0.35, y0: o.y0, y1: o.yb + 6 });
  P.collider({ kind: 'circle', x: F.X(o.mailbox, L.d / 2 - 0.6), z: F.Z(o.mailbox, L.d / 2 - 0.6), r: 0.22, y0: o.y0, y1: o.yb + 1.2 });
  if (o.fence === 'picket' || o.fence === 'hedge') {
    const gaps = [[o.drive.x - o.drive.w / 2 - 0.3, o.drive.x + o.drive.w / 2 + 0.3]];
    if (o.walkX !== undefined) gaps.push([o.walkX - 0.9, o.walkX + 0.9]);
    for (const [a, b] of H.cutRuns(-L.w / 2 + 0.3, L.w / 2 - 0.3, gaps)) {
      const mx = (a + b) / 2, z = L.d / 2 - (o.fence === 'hedge' ? 0.9 : 0.4);
      P.collider({ kind: 'box', x: F.X(mx, z), z: F.Z(mx, z), hx: (b - a) / 2, hz: o.fence === 'hedge' ? 0.55 : 0.1, ry: L.ry, y0: o.y0, y1: o.yb + 1.4 });
    }
  }
  // the porch light (and a light over some garages)
  const lx = doorX + 0.75, lz = front + 0.5;
  P.lamp({ x: F.X(lx, lz), z: F.Z(lx, lz), hy: o.yb + 2.25, color: '#ffcf80', radius: 7.5, intensity: 0.85, halo: 0.9 });
  if (o.drive && P.rng() < 0.2) { const gz = (o.drive.z1 ?? front) + 0.5; P.lamp({ x: F.X(o.drive.x, gz), z: F.Z(o.drive.x, gz), hy: o.yb + 2.8, color: '#ffe4b0', radius: 9, intensity: 0.7, halo: 0.9 }); }
  P.add(o);
}

function rgbL(hex) { return rgb(hex); }
function hex3(c) {
  const f = (v) => Math.round(Math.pow(Math.max(0, Math.min(1, v)), 1 / 2.2) * 255).toString(16).padStart(2, '0');
  return f(c[0]) + f(c[1]) + f(c[2]);
}

// ------------------------------------------------------------------ scatter

const inOrchard = (x, z) => x > 2345 && x < 2770 && z > -380 && z < 1120 && !(x > 2780 && z > 150 && z < 340);

function scatter(S) {
  // orchard rows up the bluff: small round apple trees, 8 m apart in rows 6 m apart
  if (S.x1 > 2345 && S.x0 < 2770) {
    for (let z = Math.ceil(S.z0 / 6) * 6; z < S.z1; z += 6) {
      for (let x = Math.ceil(S.x0 / 8) * 8 + ((z / 6) % 2) * 4; x < S.x1; x += 8) {
        if (!inOrchard(x, z) || S.noise(x / 160, z / 160) < -0.15) continue;
        if (!S.inside(x, z) || !S.free(x, z, 2.2, true)) continue;
        const y = S.groundY(x, z);
        S.add({ type: 'apple', x, z, y, s: S.range(0.85, 1.1) });
        S.collider({ kind: 'circle', x, z, r: 0.3, y0: y - 1, y1: y + 4 });
      }
    }
  }
  Fm.scatterWindbreaks(S);
  // trees in the open: thicker in the park, a lone one here and there out on the plains
  for (const [x, z] of S.points(13, { r: 2.5, density: (px, pz) => density(px, pz, S) })) {
    if (inOrchard(x, z)) continue;
    const y = S.groundY(x, z);
    const conifer = S.rng() < (z < -620 ? 0.4 : 0.18);
    const s = S.range(0.8, 1.35);
    S.add({ type: 'tree', x, z, y, s, col: conifer ? '#2a4a2a' : S.pick(LEAVES) });
    S.collider({ kind: 'circle', x, z, r: 0.4 * s, y0: y - 1, y1: y + 7 });
  }
}

function density(x, z, S) {
  const n = S.noise(x / 120, z / 120);
  if (Fm.inPlains(x, z)) return 0.012;                                   // the farmland (its windbreaks are planted on the section lines)
  if (x > 720 && x < 1170 && z > 280 && z < 555) return 0.55 + 0.3 * n;   // the park
  if (x > 1500 && x < 1540) return 0.7;                                   // the green strip by Orchard Ave
  if (x < 800) return 0.6;                                                // between downtown and Eastside
  return 0.22 + 0.15 * n;
}

// ------------------------------------------------------------------ build

const COST = { home: 1.4, strip: 4, bigbox: 4, motel: 3, gas: 3, diner: 2, burger: 2, school: 8, stadium: 14, diamond: 3, pond: 3, wtower: 5, swall: 2, drivein: 6, barn: 2, parking: 3, church: 4, dealer: 3, path: 2, field: 3, bins: 1, mshed: 1, windmill: 1, bstack: 0.6 };

function* build(B, items) {
  let n = 0, blink = false;
  for (const it of items) {
    n += COST[it.type] ?? 0.3;
    switch (it.type) {
      case 'home': H.home(B, it); break;
      case 'strip': E.strip(B, it); break;
      case 'bigbox': E.bigbox(B, it); break;
      case 'motel': E.motel(B, it); break;
      case 'gas': E.gas(B, it); break;
      case 'diner': E.diner(B, it); break;
      case 'burger': E.burger(B, it); break;
      case 'dealer': E.dealer(B, it); break;
      case 'church': E.church(B, it); break;
      case 'school': E.school(B, it); break;
      case 'stadium': E.stadium(B, it); break;
      case 'diamond': E.diamond(B, it); break;
      case 'courts': courts(B, it); break;
      case 'pond': E.pond(B, it); break;
      case 'playground': E.playground(B, it.x, it.z, it.ry); break;
      case 'gazebo': E.gazebo(B, it.x, it.z); break;
      case 'bench': E.bench(B, it.x, it.z, it.ry); break;
      case 'plamp': E.parkLamp(B, it.x, it.z); break;
      case 'path': path(B, it); break;
      case 'wtower': E.wtower(B, it); blink = true; break;
      case 'swall': E.soundwall(B, it); break;
      case 'drivein': E.drivein(B, it); break;
      case 'lookout': lookout(B, it); break;
      case 'barn': E.barn(B, it); break;
      case 'pylon': E.pylon(B, it); break;
      case 'parking': if (!it.bare) E.parking(B, it); else for (const c of it.cars) car(B, it.x + c[0], it.z + c[1], it.ry + c[2], rgb(c[3])); break;
      case 'bulb': bulb(B, it); break;
      case 'lot': drape(B.acc(it.kind === 'dirt' ? M.dirt(B) : M.lot(B)), B, it.poly, { lift: 0.05, uv: 5, step: 6 }); break;
      case 'car': car(B, it.x, it.z, it.ry, it.wreck ? shade(rgb(it.col), 0.45) : rgb(it.col), { lights: it.lights }); break;
      case 'fire': fire(B, it.x, it.z); blink = true; break;
      case 'tree': tree(B, it.x, it.z, it.s, rgb(it.col), { kind: it.col === '#2a4a2a' ? 'cone' : undefined }); break;
      case 'apple': apple(B, it); break;
      case 'field': Fm.fieldB(B, it); break;
      case 'poplar': Fm.poplar(B, it); break;
      case 'bins': Fm.bins(B, it); break;
      case 'mshed': Fm.mshed(B, it); break;
      case 'windmill': Fm.windmill(B, it); break;
      case 'ylight': Fm.ylight(B, it); break;
      case 'bstack': Fm.bstack(B, it); break;
      default: break;
    }
    if (n >= 7) { n = 0; yield; }
  }
  if (blink) {
    const bl = H.HM.blink(B);
    B.anim((t) => { const k = (t % 1.6) < 0.8 ? 1 : 0.06; bl.color.setRGB(3 * k, 0.24 * k, 0.12 * k); });
  }
}

/** The court's turnaround: an asphalt disc with a kerb and a planted island. */
function bulb(B, it) {
  drape(B.acc(M.lot(B)), B, it.pts, { lift: 0.07, uv: 6, step: 5 });
  const cm = B.acc(M.concrete(B));
  cm.col = rgb('#c8c4b8');
  for (let k = 0; k < it.pts.length; k++) {
    const [ax, az] = it.pts[k], [bx, bz] = it.pts[(k + 1) % it.pts.length];
    const ya = B.groundY(ax, az), yb2 = B.groundY(bx, bz);
    cm.quadP([ax, ya - 0.2, az], [bx, yb2 - 0.2, bz], [bx, yb2 + 0.16, bz], [ax, ya + 0.16, az]);
  }
  const y = B.groundY(it.x, it.z);
  cm.cyl(it.x, y - 0.2, it.z, 2.6, 0.45, 12);
  const lawn = B.acc(H.HM.lawn(B));
  lawn.col = [1, 1, 1];
  const isl = [];
  for (let k = 0; k < 12; k++) { const a = (k / 12) * PI * 2; isl.push([it.x + Math.cos(a) * 2.5, it.z + Math.sin(a) * 2.5]); }
  drape(lawn, B, isl, { lift: 0.25, uv: 3, step: 5 });
  tree(B, it.x + 0.6, it.z, 1.0, rgb(LEAVES[(it.n * 7) % LEAVES.length]));
  const st = B.acc(M.steel(B));
  st.col = rgb('#3a3c40');
  st.cyl(it.x - 1.2, y, it.z, 0.1, 5.2, 6, 0.08);
  glowBox(B, it.x - 1.2, y + 5.1, it.z, 0.5, 0.3, 0.5, 0, '#ffd8a0');
}

/** A concrete path along a polyline (draped). */
function path(B, it) {
  const pv = B.acc(M.pave(B));
  for (let k = 0; k < it.pts.length - 1; k++) {
    const [ax, az] = it.pts[k], [bx, bz] = it.pts[k + 1];
    const len = Math.hypot(bx - ax, bz - az), lx = -(bz - az) / len * it.w / 2, lz = (bx - ax) / len * it.w / 2;
    drape(pv, B, [[ax - lx, az - lz], [bx - lx, bz - lz], [bx + lx, bz + lz], [ax + lx, az + lz]], { lift: 0.06, uv: 3, step: 8 });
  }
}

/** Tennis courts: green with white lines, a chain-link cage. */
function courts(B, it) {
  const F = new Frame(it.x, it.z, it.ry, 0);
  const W = (lx, lz) => [F.X(lx, lz), F.Z(lx, lz)];
  const pv = B.acc(M.line(B));
  pv.col = rgb('#3a6a4a');
  const y = B.groundY(it.x, it.z) + 0.08;
  const P = (lx, lz, dy = 0) => { const [x, z] = W(lx, lz); return [x, y + dy, z]; };
  pv.quadP(P(-it.w / 2, it.d / 2), P(it.w / 2, it.d / 2), P(it.w / 2, -it.d / 2), P(-it.w / 2, -it.d / 2));
  pv.col = rgb('#f0f0ea');
  for (const cz of [-14, 14]) {
    for (const [x0, z0, x1, z1] of [[-5.5, cz - 11.9, 5.5, cz - 11.8], [-5.5, cz + 11.8, 5.5, cz + 11.9], [-5.5, cz - 11.9, -5.4, cz + 11.9], [5.4, cz - 11.9, 5.5, cz + 11.9], [-4.1, cz - 6.4, 4.1, cz - 6.3], [-4.1, cz + 6.3, 4.1, cz + 6.4], [-0.05, cz - 6.4, 0.05, cz + 6.4]]) {
      pv.quadP(P(x0, z1, 0.01), P(x1, z1, 0.01), P(x1, z0, 0.01), P(x0, z0, 0.01));
    }
    const st = B.near(M.steel(B));
    st.col = rgb('#1a1a1a');
    const a = P(-6.2, cz, 0), b = P(6.2, cz, 0);
    st.box((a[0] + b[0]) / 2, y, (a[2] + b[2]) / 2, 12.4, 0.95, 0.04, it.ry);
  }
  chainFence(B, [W(-it.w / 2, -it.d / 2), W(it.w / 2, -it.d / 2), W(it.w / 2, it.d / 2), W(-it.w / 2, it.d / 2), W(-it.w / 2, -it.d / 2)], 3.2, { gaps: [3] });
}

/** The lookout: a low rail along the bluff's edge, a coin-op telescope. */
function lookout(B, it) {
  const F = new Frame(it.x, it.z, it.ry, B.groundY(it.x, it.z));
  const st = B.near(M.steel(B));
  st.col = rgb('#5a5c60');
  for (let k = -5; k <= 5; k++) { const p = F.P(k * 3, 0, 0); st.box(p[0], B.groundY(p[0], p[2]) - 0.2, p[2], 0.1, 1.2, 0.1); }
  const a = F.P(-15, 0, 0), b = F.P(15, 0, 0);
  st.beam(a[0], B.groundY(a[0], a[2]) + 0.95, a[2], b[0], B.groundY(b[0], b[2]) + 0.95, b[2], 0.06, 0.06);
  const p = F.P(2, 0, -1.2), y = B.groundY(p[0], p[2]);
  st.col = rgb('#2a6a4a');
  st.box(p[0], y, p[2], 0.15, 1.1, 0.15);
  st.box(p[0], y + 1.1, p[2], 0.35, 0.4, 0.7, it.ry);
}

function fire(B, x, z) {
  const y = B.groundY(x, z);
  const p = B.near(M.paint(B));
  p.col = rgb('#3a2a20');
  p.cyl(x, y, z, 0.3, 0.9, 7);
  const g = B.near(M.glow(B));
  g.col = rgb('#ff8a2a');
  g.box(x, y + 0.9, z, 0.45, 0.35, 0.45);
}

/** An apple tree: a short trunk, a round crown, a few red apples (all shared corners: ~34 vertices). */
const LEAF_A = rgb('#4a6a2a'), LEAF_B = rgb('#6a7a2a'), FRUIT = rgb('#c8201a');
function apple(B, it) {
  const { x, y, z } = it, s = it.s, sp = (it.x * 0.37 + it.z * 0.61) % 6.283;
  const tr = B.acc(M.trunk(B));
  const t0 = tr.count;
  for (let k = 0; k < 4; k++) {
    const a = sp + (k * Math.PI) / 2;
    tr.v(x + Math.cos(a) * 0.14 * s, y - 0.2, z + Math.sin(a) * 0.14 * s, k / 4, 0);
    tr.v(x + Math.cos(a) * 0.09 * s, y + 1.3 * s, z + Math.sin(a) * 0.09 * s, k / 4, 1);
  }
  for (let k = 0; k < 4; k++) {
    const b0 = t0 + k * 2, b1 = t0 + ((k + 1) % 4) * 2;
    tr.quad(b1, b0, b0 + 1, b1 + 1);
  }
  // the crown: a squat six-sided lathe (pole, two rings, pole)
  const lf = B.acc(M.leaf(B));
  lf.col = ((it.x * 3 + it.z) | 0) % 5 === 0 ? LEAF_B : LEAF_A;
  const r = 1.75 * s, cy = y + 2.25 * s, c0 = lf.count;
  lf.v(x, cy + 1.25 * s, z);
  for (const [ry, rr] of [[0.55, 1], [-0.6, 0.92]]) {
    for (let k = 0; k < 6; k++) {
      const a = sp + (k * Math.PI) / 3 + (ry < 0 ? Math.PI / 6 : 0);
      lf.v(x + Math.cos(a) * r * rr, cy + ry * s, z + Math.sin(a) * r * rr);
    }
  }
  lf.v(x, cy - 1.2 * s, z);
  const U = (k) => c0 + 1 + (k % 6), L = (k) => c0 + 7 + (k % 6), bot = c0 + 13;
  for (let k = 0; k < 6; k++) {
    lf.tri(c0, U(k + 1), U(k));
    lf.tri(L(k + 1), L(k), U(k + 1));
    lf.tri(U(k + 1), L(k), U(k));
    lf.tri(bot, L(k), L(k + 1));
  }
  // three apples: small tetrahedra on the crown's skin
  lf.col = FRUIT;
  for (let k = 0; k < 3; k++) {
    const a = sp + k * 2.1, h = cy + (k === 1 ? 0.35 : -0.55) * s;
    const ax = x + Math.cos(a) * r * 1.02, az = z + Math.sin(a) * r * 1.02, q = 0.2;
    const f0 = lf.count;
    lf.v(ax, h + q, az);
    lf.v(ax + q, h - q * 0.5, az + q * 0.6);
    lf.v(ax - q, h - q * 0.5, az + q * 0.6);
    lf.v(ax, h - q * 0.5, az - q);
    lf.tri(f0, f0 + 2, f0 + 1); lf.tri(f0, f0 + 1, f0 + 3); lf.tri(f0, f0 + 3, f0 + 2); lf.tri(f0 + 1, f0 + 2, f0 + 3);
  }
}

// ------------------------------------------------------------------ warm

function warm(B) {
  for (const k of Object.keys(H.HM)) H.HM[k](B);
  for (const k of Object.keys(M)) M[k](B);
}

void RESERVED; void boxL;

export default { id: 'eastside', plan, scatter, warm, build };
