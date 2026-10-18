// PORT HALCYON — HARBOR DOCKS: the container port. Terminal 3 behind its
// gate (a yard of container blocks worked by yellow rubber-tyred gantries,
// red-and-white ship-to-shore cranes along Berth Road with the KAITO
// HARMONY alongside), the Port Authority's office and its control tower,
// the empties depot along Harbor Boulevard, the intermodal rail yard (trains
// of boxes, a blue rail gantry, a level crossing) and the transit sheds on
// Dock Street, the harbour master and the tugs at the river mouth, the
// bunker tanks, the Harbor Lift Bridge in its green towers, and across the
// river the old brick bonded warehouses and the fish market. Lit white by
// the terminal's floods, sodium in the rail yard, warm in the old harbor.
import { makeRng } from '../../core/util.js';
import { litMat, box, cylinder, gable, hip, lattice, drape } from './builder.js';
import { C, col, frame, lbox, lbeam, tube, panel, seedOf, stringLights, groundStrip, truss, cmat, coneC, arcPanel, warmBuilders } from './coast/kit.js';
import { signAtlas, officeTexture, cladTexture, brickTexture, trackTexture } from './coast/tex.js';
import { portMats, stackBlock, stsCrane, stsPlan, rtgCrane, straddle, mast, quayEdge, hull, truck, fence, container, randomBox, tugBoat, CH, CW, C40 } from './coast/port.js';
import { waterAt, riverAt } from '../terrain.js';
import { RIVER } from '../map/base.js';
import { polyAtX, offsetLine, clipX, pieces, mid } from './coast/geo.js';

/** The river's water level near (x, z). */
function riverAtLevel(x, z) { const r = riverAt(x, z); return r ? r.y : 0.6; }

const Y0 = 3.0;   // the waterfront's level (quays, yard, roads)

// the quay's edge (the land polygon's coast here), east to west
const QUAY = [[-1236, 2294], [-1500, 2360], [-2000, 2420], [-2700, 2440], [-2800, 2456]];
// Harbor Boulevard's line (for the rail yard along its north side)
const BLVD = [[-2700, 1980], [-2000, 1930], [-1420, 1900]];

// ------------------------------------------------------------------ signs

const SIGNS = [
  { id: 'hpa', w: 1000, h: 84, text: 'HALCYON PORT AUTHORITY', style: 'letters', bg: '#d8d6ce', fg: '#1d3f6e', glow: '#8ab8ff' },
  { id: 'gate', w: 640, h: 150, text: 'TERMINAL 3', sub: 'ALL TRUCKS STOP · SHOW PASS', style: 'box', bg: '#1d4f8f', fg: '#ffffff', glow: '#2a62b8', fgGlow: '#ffffff' },
  { id: 'kaito', w: 1000, h: 110, text: 'KAITO LINES', style: 'letters', bg: '#1e2c4a', fg: '#e8e8e0' },
  { id: 'shipname', w: 520, h: 110, text: 'KAITO HARMONY', sub: 'HALCYON', style: 'letters', bg: '#1e2c4a', fg: '#e8e8e0' },
  { id: 'master', w: 620, h: 90, text: 'HARBOUR MASTER', style: 'letters', bg: '#e9e6dc', fg: '#1b2b44', glow: '#ffe2a0' },
  { id: 'box', w: 420, h: 150, text: 'THE BOX', style: 'neon', glow: '#ff2a8a', border: '#2ae0ff' },
  { id: 'rail', w: 800, h: 96, text: 'HALCYON INTERMODAL', style: 'paint', bg: '#20262e', fg: '#e8c84a' },
  { id: 'cold', w: 900, h: 100, text: 'HALCYON COLD STORAGE CO.', style: 'paint', bg: '#6e3424', fg: '#e8dcc0' },
  { id: 'bonded', w: 700, h: 90, text: 'CUSTOMS · BONDED STORE', style: 'paint', bg: '#2a4a3a', fg: '#efe8d0' },
  { id: 'fish', w: 560, h: 130, text: 'FISH MARKET', sub: 'OPEN 4 AM', style: 'neon', glow: '#2ae0ff', glow2: '#ff7a2a' },
  { id: 'towage', w: 360, h: 64, text: 'HALCYON TOWAGE', style: 'letters', bg: '#1a1a1a', fg: '#f0f0e8' },
  { id: 'berth4', w: 300, h: 120, text: 'BERTH 4', style: 'box', bg: '#e8e6dc', fg: '#1d3f6e', glow: '#ffffff' },
  { id: 'berth5', w: 300, h: 120, text: 'BERTH 5', style: 'box', bg: '#e8e6dc', fg: '#1d3f6e', glow: '#ffffff' },
  { id: 'danger', w: 520, h: 100, text: 'DANGER', sub: 'CONTAINER HANDLING AREA', style: 'paint', bg: '#d8a823', fg: '#111111' },
  { id: 'xbuck', w: 420, h: 64, text: 'RAILROAD CROSSING', style: 'paint', bg: '#f2f0e8', fg: '#111111' },
  { id: 'kestrel', w: 520, h: 90, text: 'KESTREL PETROLEUM', style: 'letters', bg: '#d8d8d2', fg: '#a8261e' },
  { id: 'empties', w: 640, h: 110, text: 'BAYSIDE EMPTIES', sub: 'DEPOT · STORAGE · REPAIRS', style: 'box', bg: '#f2b632', fg: '#1a1a1a', glow: '#ffcf60' },
  ...[3, 5, 7, 9, 11, 12, 14, 16, 18, 21].map((n) => ({ id: `shed${n}`, w: 250, h: 96, text: `SHED ${n}`, style: 'paint', bg: '#e8e2d0', fg: '#1a2a40' })),
  ...[1, 2, 3, 4, 5, 6, 7].map((n) => ({ id: `sts${n}`, w: 220, h: 84, text: `STS 0${n}`, style: 'letters', bg: '#e6e4de', fg: '#b03328' })),
];
const SHEDS = [3, 5, 7, 9, 11, 12, 14, 16, 18, 21];
// brick tones (vertex tints over the red brick): red, brown, sooty, plum, dark
const BRICKS = [[1, 0.97, 0.94], [0.86, 0.74, 0.62], [0.62, 0.58, 0.56], [0.78, 0.6, 0.66], [0.5, 0.44, 0.42], [1.05, 0.88, 0.74]];
// ground-floor bars and shops in the old warehouses
const SHOPS = ['oyster', 'sailors', 'tattoo', 'seafood', 'chandlery'];
SIGNS.push(
  { id: 'oyster', w: 520, h: 120, text: 'OYSTER BAR', style: 'neon', glow: '#2ae0ff', border: '#ff4a9a' },
  { id: 'sailors', w: 520, h: 120, text: "SAILORS' REST", sub: 'COLD BEER · POOL', style: 'neon', glow: '#ff5a2a', glow2: '#ffd84a' },
  { id: 'tattoo', w: 400, h: 120, text: 'TATTOO', style: 'neon', glow: '#ff2a3a', border: '#2ae0ff' },
  { id: 'seafood', w: 520, h: 120, text: 'SEAFOOD', sub: 'CRAB · CLAMS · CHOWDER', style: 'neon', glow: '#ffb02a', glow2: '#7aff4a' },
  { id: 'chandlery', w: 560, h: 110, text: 'SHIP CHANDLERY', sub: 'ROPE · PAINT · BRASS', style: 'paint', bg: '#1c3a5a', fg: '#e8e0c8' },
);

function hmats(B) {
  const M = portMats(B);
  M.sign = B.mat('sign', () => { const t = atlas(); return litMat({ map: t.map, emissive: 0xffffff, emissiveMap: t.emi, roughness: 0.6 }, { night: 1.25 }); });
  M.office = cmat(B, 'office', () => { const t = officeTexture(); return litMat({ map: t.map, emissive: 0xffffff, emissiveMap: t.emi, vertexColors: true, roughness: 0.55, envMapIntensity: 0.8 }, { night: 1.0 }); });
  M.clad = cmat(B, 'clad', () => { const t = cladTexture('shed'); return litMat({ map: t.map, emissive: 0xffffff, emissiveMap: t.emi, vertexColors: true, roughness: 0.6, metalness: 0.25 }, { night: 0.95 }); });
  M.brick = cmat(B, 'brick', () => { const t = brickTexture(); return litMat({ map: t.map, emissive: 0xffffff, emissiveMap: t.emi, vertexColors: true, roughness: 0.9 }, { night: 0.9 }); });
  M.track = B.mat('track', () => litMat({ map: trackTexture(), roughness: 0.95, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }, { shadow: false }));
  return M;
}
const atlas = () => signAtlas('harbor', SIGNS, 1024, 1024, 0.62);
const UV = () => atlas().uv;

// ------------------------------------------------------------------ the plan

export default {
  id: 'harbor',

  plan(P) {
    const S = { P, cranes: [], blocks: [] };
    planQuay(P);
    planShip(P, S);
    planCranes(P, S);
    planYard(P, S);
    planStrip(P, S);
    planRail(P, S);
    planLift(P, S);
    planRiver(P, S);
    planSheds(P, S);
    planOldHarbor(P, S);
    P.landmark({ id: 'hb_cranes', name: 'TERMINAL 3 CRANES', x: -2150, z: 2395, r: 300, kind: 'cranes' });
    P.landmark({ id: 'hb_ship', name: 'KAITO HARMONY', x: -2330, z: 2452, r: 160, kind: 'ship' });
    P.landmark({ id: 'hb_lift', name: 'HARBOR LIFT BRIDGE', x: -1222, z: 1877, r: 80, kind: 'bridge' });
    P.landmark({ id: 'hb_hpa', name: 'PORT CONTROL TOWER', x: -2170, z: 2010, r: 60, kind: 'building' });
    P.landmark({ id: 'hb_rail', name: 'HALCYON INTERMODAL', x: -2300, z: 1925, r: 300, kind: 'railyard' });
    P.landmark({ id: 'hb_master', name: 'HARBOUR MASTER', x: -1385, z: 1945, r: 60, kind: 'building' });
    if (S.den) P.landmark({ id: 'hb_box', name: 'THE BOX', x: S.den.x, z: S.den.z, r: 20, hidden: true, kind: 'hideout' });
  },

  *warm(B) {
    const M = hmats(B), uv = UV();
    yield;
    yield* warmBuilders(B, this, BUILD, M, uv);
  },

  *build(B, items) {
    const M = hmats(B);
    const uv = UV();
    let t0 = performance.now();
    for (const it of items) {
      const fn = BUILD[it.type];
      if (fn) {
        const r = fn(B, M, it, uv);
        if (r && r[Symbol.iterator]) { yield* r; yield; t0 = performance.now(); continue; }
      }
      if (performance.now() - t0 > 1) { yield; t0 = performance.now(); }
    }
  },
};

// ------------------------------------------------------------------ quay

function planQuay(P) {
  // the quay wall, its fenders and bollards along Berth Road's water
  for (const pc of pieces(QUAY, 110)) {
    const m = mid(pc);
    P.add({ type: 'quay', x: m[0], z: m[1], pts: pc, sea: 1 });
  }
}

// ------------------------------------------------------------------ the ship

function planShip(P, S) {
  const q = polyAtX(QUAY, -2330);
  const L = 286, Bm = 40;
  // the quay runs east → west here: its left (lx, lz) is the sea
  const cx = q.x + q.lx * (2.6 + Bm / 2), cz = q.z + q.lz * (2.6 + Bm / 2);
  const ry = Math.atan2(-q.tz, q.tx);           // the ship's local x (bow) points west along the quay
  const F = frame(cx, 0, cz, ry);
  S.ship = { cx, cz, ry, L, Bm };
  P.add({ type: 'shiphull', x: cx, z: cz, ry, L, Bm });
  // the accommodation and the funnel near the stern (local x −)
  const hp = F(-L / 2 + 0.17 * L, 0, 0);
  P.add({ type: 'shiphouse', x: hp[0], z: hp[2], ry, Bm, deck: 11 });
  // cargo: bays of 40 ft boxes on hatch covers, two bays an item
  const bp = C40 + 0.45;
  const x0 = -L / 2 + 0.25 * L, x1 = -L / 2 + 0.9 * L;
  const nb = Math.floor((x1 - x0) / bp);
  for (let b = 0; b < nb; b += 2) {
    const n = Math.min(2, nb - b);
    const lx = x0 + (b + n / 2) * bp;
    const t = (lx + n * bp / 2 + L / 2) / L;
    const half = t < 0.62 ? Bm / 2 : Bm / 2 * Math.sqrt(Math.max(0, 1 - Math.pow((t - 0.62) / 0.38, 2.2)));
    const rows = Math.max(3, Math.min(13, Math.floor((half * 2 - 3) / (CW + 0.32))));
    const prof = Math.sin(Math.min(1, Math.max(0, (t - 0.2) / 0.75)) * Math.PI);
    const p = F(lx, 0, 0);
    P.add({ type: 'shipcargo', x: p[0], z: p[2], ry, rows, bays: n, len: C40, tmax: Math.max(3, Math.round(4 + prof * 3)), pal: 'mixed', y0: 11 + 1.7, deck: 11 });
  }
  // from afar: the hull, the box stacks, the white house
  P.far({ shape: 'box', x: cx, z: cz, y: -1, w: L, d: Bm * 0.92, h: 12, ry, color: '#1e2c4a' });
  const cols = ['#2f5d8a', '#a84a2a', '#5a7a4a'];
  for (let k = 0; k < 3; k++) {
    const p = F(x0 + (k + 0.5) * (x1 - x0) / 3, 0, 0);
    P.far({ shape: 'box', x: p[0], z: p[2], y: 12, w: (x1 - x0) / 3 - 2, d: Bm * 0.8, h: 12 + (k === 1 ? 4 : 0), ry, color: cols[k] });
  }
  P.far({ shape: 'box', x: hp[0], z: hp[2], y: 11, w: 16, d: 30, h: 27, ry, color: '#dcdad2', lit: 0.5 });
  // its lights: the deck floods, the masthead, port and starboard
  const top = F(-L / 2 + 0.17 * L, 38, 0);
  P.lamp({ x: top[0], z: top[2], hx: top[0], hy: top[1], hz: top[2], color: '#fff0d8', radius: 50, intensity: 0.9, halo: 5 });
  for (const t of [0.42, 0.66, 0.86]) {
    const p = F(-L / 2 + t * L, 30, 0);
    P.lamp({ x: p[0], z: p[2], hx: p[0], hy: p[1], hz: p[2], color: '#e8eeff', radius: 44, intensity: 0.8, halo: 3 });
  }
  for (const sd of [1, -1]) {
    const p = F(-L / 2 + 0.17 * L, 37, sd * (Bm / 2 + 0.5));
    P.lamp({ x: p[0], z: p[2], hx: p[0], hy: p[1], hz: p[2], color: sd > 0 ? '#20ff6a' : '#ff2a20', radius: 2, intensity: 0, halo: 2.2 });
  }
}

function shipHull(B, M, it, uv) {
  const F = frame(it.x, 0, it.z, it.ry);
  const acc = B.acc(M.plate);
  const L = it.L, Bm = it.Bm;
  const bands = [[-0.3, C('#7a2b22')], [0.8, C('#1a1a1c')], [10.3, C('#1e2c4a')], [null, C('#d8d8d0')]];
  hull(acc, F, L, Bm, -12.5, 11, bands, { deckCol: C('#3d4a44'), sheer: 2.8 });
  // the line's name along both sides, the ship's name and port on the stern
  const sg = B.acc(M.sign);
  for (const sd of [1, -1]) {
    const p = F(14, 5.6, sd * (Bm / 2 + 0.1));
    panel(sg, p[0], p[1], p[2], 70, 7.7, it.ry + (sd > 0 ? 0 : Math.PI), uv.kaito);
  }
  const st = F(-L / 2 - 0.1, 7.4, 0);
  panel(sg, st[0], st[1], st[2], 22, 4.7, it.ry - Math.PI / 2, uv.shipname);
  // bulwark at the bow, anchors, the forecastle's mast and its light
  const pa = B.acc(M.paint);
  col(pa, C('#d8d8d0'));
  const bow = F(L / 2 - 14, 13.8, 0);
  pa.beam(bow[0], bow[1], bow[2], bow[0], bow[1] + 8, bow[2], 0.4, 0.4);
  col(B.acc(M.glow), C('#ffffff', 3));
  B.acc(M.glow).box(bow[0], bow[1] + 8.2, bow[2], 0.5, 0.5, 0.5);
  col(pa, C('#1a1a1a'));
  for (const sd of [1, -1]) { const a = F(L / 2 - 9, 6.5, sd * (Bm / 2 - 3.8)); pa.box(a[0], a[1], a[2], 2.2, 2.6, 0.5, it.ry); }
  // mooring lines down to the quay (landward is local +z)
  col(pa, C('#1c1c1c'));
  for (const [t, dl] of [[0.03, -18], [0.1, 10], [0.88, -10], [0.97, 18]]) {
    const u = -L / 2 + t * L;
    const A = F(u, 11.6, Bm / 2 - 1.5), Bq = F(u + dl, Y0 + 0.9, Bm / 2 + 4.6);
    pa.beam(A[0], A[1], A[2], Bq[0], Bq[1], Bq[2], 0.14, 0.14);
  }
}

function shipHouse(B, M, it) {
  const F = frame(it.x, 0, it.z, it.ry);
  const h = B.acc(M.house), st = B.acc(M.paint), gl = B.acc(M.glow);
  const dk = it.deck, Bm = it.Bm;
  col(h, C('#f2f0ea'));
  lbox(h, F, it.ry, 0, dk, 0, 15, 23, 30, { u: 10, v: 10 });
  col(h, C('#e8e6de'));
  lbox(h, F, it.ry, 0.5, dk + 23, 0, 16, 3.4, Bm + 0.8, { u: 10, v: 10 });
  // the bridge's windows: a dark band, lit softly at night
  col(gl, C('#9ab8d8', 0.6));
  lbox(gl, F, it.ry, 8.55, dk + 24, 0, 0.06, 1.6, Bm * 0.9, {});
  col(st, C('#2a2c30'));
  lbox(st, F, it.ry, 0.5, dk + 26.4, 0, 16.4, 0.4, Bm + 1.2, {});
  // the mast with its radar and lights
  col(st, C('#d8d8d0'));
  const m = F(-2, dk + 26.8, 0);
  st.beam(m[0], m[1], m[2], m[0], m[1] + 9, m[2], 0.5, 0.5);
  const yard = F(-2, dk + 33, -4), yard2 = F(-2, dk + 33, 4);
  st.beam(yard[0], yard[1], yard[2], yard2[0], yard2[1], yard2[2], 0.3, 0.3);
  lbox(st, F, it.ry, -2, dk + 30, 0, 1.2, 0.4, 6, {});
  col(gl, C('#ffffff', 3));
  gl.box(m[0], m[1] + 9.1, m[2], 0.5, 0.5, 0.5);
  col(gl, C('#ff2a20', 3.5));
  const pl = F(0.5, dk + 25, -(Bm / 2 + 0.6)); gl.box(pl[0], pl[1], pl[2], 0.6, 0.6, 0.6);
  col(gl, C('#20ff6a', 3.5));
  const sl = F(0.5, dk + 25, Bm / 2 + 0.6); gl.box(sl[0], sl[1], sl[2], 0.6, 0.6, 0.6);
  // funnel (the line's red, a black top, the logo band)
  col(st, C('#a8261e'));
  lbox(st, F, it.ry, -12.5, dk, 0, 8, 25, 10, {});
  col(st, C('#e8e6de'));
  lbox(st, F, it.ry, -12.5, dk + 17, 0, 8.1, 3, 10.1, {});
  col(st, C('#151515'));
  lbox(st, F, it.ry, -12.5, dk + 25, 0, 8.2, 1.8, 10.2, {});
  // deck lights round the house
  col(gl, C('#fff1d0', 3));
  for (const sd of [1, -1]) for (const dy of [5, 11, 17]) { const p = F(7.6, dk + dy, sd * 14.6); gl.box(p[0], p[1], p[2], 0.4, 0.3, 0.4); }
}

function shipCargo(B, M, it) {
  const st = B.acc(M.paint);
  // hatch covers under the boxes
  const n = it.bays, bp = C40 + 0.45, rp = CW + 0.32;
  col(st, C('#3a4a44'));
  box(st, it.x, it.deck - 0.2, it.z, n * bp, 1.9, it.rows * rp + 0.6, it.ry, {});
  stackBlock(B, M, it);
  // lashing bridge posts between bays (rails and lights)
  const F = frame(it.x, it.deck, it.z, it.ry);
  col(st, C('#d8b830'));
  for (let b = 0; b <= n; b += n) {
    const lx = -n * bp / 2 + b * bp;
    for (const sd of [-1, 1]) lbox(st, F, it.ry, lx, 1.7, sd * (it.rows * rp / 2 + 0.3), 0.3, 6, 0.3, {});
  }
}

// ------------------------------------------------------------------ cranes

function planCranes(P, S) {
  const xs = [-2575, -2455, -2345, -2235, -2092, -1952, -1812];
  const ship = S.ship;
  xs.forEach((x, k) => {
    const q = polyAtX(QUAY, x);
    if (!q) return;
    // the waterside leg 3 m in from the edge: the crane's middle 18.25 m in
    const cx = q.x - q.lx * 18.3, cz = q.z - q.lz * 18.3;
    const ry = Math.atan2(q.lx, q.lz);            // local +z: out to sea
    const F = frame(cx, 0, cz, ry);
    for (const u of [-9, 9]) for (const w of [-15.25, 15.25]) {
      const p = F(u, 0, w);
      if (!P.isFree(p[0], p[2], 6.4, 1.8, ry, { pad: 0.2 })) return;
    }
    const overShip = ship && Math.abs(x - ship.cx) < ship.L / 2 - 20;
    const it = P.add({ type: 'sts', x: cx, z: cz, y0: P.groundY(cx, cz), ry, up: !overShip, tr: P.rng(), num: k + 1 });
    stsPlan(P, it);
    for (const u of [-9, 9]) for (const w of [-15.25, 15.25]) { const p = F(u, 0, w); P.claim(p[0], p[2], 6.4, 1.8, ry); }
    S.cranes.push(it);
  });
  // straddle carriers and trucks waiting on the apron between the cranes
  for (let k = 0; k < S.cranes.length - 1; k++) {
    const a = S.cranes[k], b = S.cranes[k + 1];
    const x = (a.x + b.x) / 2, z = (a.z + b.z) / 2;
    const ry = a.ry + (k % 2 ? 0 : 0.18);
    if (P.isFree(x, z, 13, 6, ry, { pad: 1 })) {
      P.add({ type: 'straddle', x, z, y0: P.groundY(x, z), ry, cargo: P.rng() < 0.6 });
      P.claim(x, z, 13, 6, ry);
      P.collider({ kind: 'box', x, z, hx: 6.2, hz: 2.8, ry, y0: Y0 - 1, y1: Y0 + 15 });
    }
  }
  // the berth numbers on posts at the quay
  for (const [x, id] of [[-2400, 'berth4'], [-1880, 'berth5']]) {
    const q = polyAtX(QUAY, x);
    const px = q.x - q.lx * 6, pz = q.z - q.lz * 6;
    P.add({ type: 'berthsign', x: px, z: pz, ry: Math.atan2(-q.lx, -q.lz), sign: id });
  }
}

// ------------------------------------------------------------------ the yard

function planYard(P, S) {
  const x0 = -2604, x1 = -1496;
  const zRows = [2092, 2126, 2160, 2194, 2228, 2262, 2296];
  const bp = C40 + 0.45, rp = CW + 0.32;
  let denDone = false;
  zRows.forEach((zc, k) => {
    let x = x0 + P.range(0, 14);
    let nBlock = 0;
    while (x < x1 - 60) {
      const bays = P.pick([9, 11, 12, 13, 14, 16]);
      let len = bays * bp;
      if (x + len > x1) break;
      const rows = k === 0 || k === 6 ? 5 : P.pick([6, 6, 6, 7]);
      const w = rows * rp;
      const cx = x + len / 2;
      // what's stacked where: reefers in the north-east, empties of one line in the west, the rest mixed
      let pal = 'mixed', tmax = P.pick([4, 4, 5, 5, 3]);
      if (k <= 1 && cx > -1900) { pal = 'reefer'; tmax = 3; }
      else if (k >= 2 && k <= 3 && cx < -2350) { pal = 'line'; tmax = P.pick([5, 6]); }
      // the hideout: a gap in a block, closed on three sides
      const den = !denDone && k === 3 && nBlock >= 1 && bays >= 11;
      if (P.isFree(cx, zc, len, w, 0, { pad: 0.5 })) {
        if (den) {
          denDone = true;
          // west part, the den (3 bays, its back filled), east part
          const a = Math.floor((bays - 3) / 2);
          const parts = [[0, a], [a + 3, bays]];
          for (const [b0, b1] of parts) {
            const n = b1 - b0;
            const px = x + (b0 + n / 2) * bp;
            addBlock(P, S, px, zc, n, rows, pal, tmax, P.pick([0, 3, 5]));
          }
          // the den's back wall: two rows of boxes, three high
          const dx = x + (a + 1.5) * bp;
          const backZ = zc + (rows * rp) / 2 - rp;
          P.add({ type: 'stack', x: dx, z: backZ, ry: 0, rows: 2, bays: 3, len: C40, tmax: 3, pal: 'mixed', full: true });
          P.collider({ kind: 'box', x: dx, z: backZ, hx: 3 * bp / 2, hz: rp, ry: 0, y0: Y0 - 1, y1: Y0 + 3 * CH });
          const dz = zc - rp;
          S.den = { x: dx, z: dz };
          P.add({ type: 'den', x: dx, z: dz, w: 3 * bp, d: (rows - 2) * rp });
          P.lamp({ x: dx, z: dz, hx: dx, hy: Y0 + 4.2, hz: dz, color: '#ff9a5a', radius: 16, intensity: 1.0, halo: 2.5 });
          P.claim(cx, zc, len, w, 0);
        } else {
          addBlock(P, S, cx, zc, bays, rows, pal, tmax, P.rng() * 8 | 0);
          P.claim(cx, zc, len, w, 0);
        }
        // a yard gantry over it (and its truck lane on the north side)
        if (P.rng() < 0.7) {
          const gx = cx + (P.rng() - 0.5) * (len - 16);
          const gz = zc - 2.5;
          P.add({ type: 'rtg', x: gx, z: gz, y0: P.groundY(gx, gz), ry: 0, span: 23.6, h: tmax * CH + 7.5, paint: k % 3 === 2 ? 'blue' : 'yellow' });
          for (const sz of [-11.8, 11.8]) {
            P.collider({ kind: 'box', x: gx, z: gz + sz, hx: 4.4, hz: 0.8, ry: 0, y0: Y0 - 1, y1: Y0 + tmax * CH + 8 });
            P.claim(gx, gz + sz, 9, 1.8, 0);
          }
          P.far({ shape: 'box', x: gx, z: gz, y: Y0 + tmax * CH + 7, w: 7, d: 25, h: 2, ry: 0, color: k % 3 === 2 ? '#2a5a9a' : '#c89a1e' });
          // a truck under it, being loaded
          if (P.rng() < 0.6) {
            const tx = gx + (P.rng() - 0.5) * 6, tz = zc - 11.2, ry = P.rng() < 0.5 ? 0 : Math.PI;
            P.add({ type: 'truck', x: tx, z: tz, ry, box: P.rng() < 0.7 });
            P.collider({ kind: 'box', x: tx, z: tz, hx: 8.2, hz: 1.3, ry, y0: Y0 - 1, y1: Y0 + 4.2 });
          }
        }
      }
      x += len + P.range(16, 26);
      nBlock++;
    }
  });
  // floodlight masts in the aisles between the block rows
  for (let k = 0; k < zRows.length - 1; k++) {
    const z = zRows[k] + 17;
    for (let x = -2560 + (k % 2) * 110; x < -1520; x += 220) {
      if (!P.isFree(x, z, 2.5, 2.5, 0, { pad: 0.3 })) continue;
      const y0 = P.groundY(x, z);
      P.add({ type: 'mast', x, z, y0, h: 32, color: '#e4ecff' });
      P.lamp({ x, z, hx: x, hy: y0 + 31, hz: z, color: '#e4ecff', radius: 62, intensity: 1.1, halo: 10 });
      P.collider({ kind: 'circle', x, z, r: 0.9, y0: y0 - 1, y1: y0 + 32 });
      P.far({ shape: 'cyl', x, z, y: y0, r: 0.6, r2: 0.3, h: 32, color: '#7a7d80' });
      P.claim(x, z, 2.5, 2.5, 0);
    }
  }
}

function addBlock(P, S, cx, zc, bays, rows, pal, tmax, line) {
  const bp = C40 + 0.45, rp = CW + 0.32;
  const len = bays * bp, w = rows * rp;
  const y0 = P.groundY(cx, zc);
  P.add({ type: 'stack', x: cx, z: zc, ry: 0, rows, bays, len: C40, tmax, pal, line, map: 'yard', w: len, d: w });
  P.collider({ kind: 'box', x: cx, z: zc, hx: len / 2 + 0.2, hz: w / 2 + 0.2, ry: 0, y0: y0 - 1, y1: y0 + tmax * CH });
  const FAR = { mixed: ['#7a5a48', '#4a6a8a', '#8a4a3a', '#5a6a4a'], reefer: ['#d8d8d2'], line: ['#c4621f', '#3b7ca6', '#8a3422', '#2d5a40', '#1f3157'] };
  const fc = pal === 'line' ? FAR.line[line % 5] : P.pick(FAR[pal] || FAR.mixed);
  P.far({ shape: 'box', x: cx, z: zc, y: y0, w: len, d: w, h: tmax * CH * 0.92, ry: 0, color: fc });
  S.blocks.push({ x: cx, z: zc, len, w });
}

// ------------------------------------------------------------------ the strip by the boulevard

function planStrip(P, S) {
  // the Port Authority and its control tower, west of the gate
  {
    const x = -2196, z = 2004, w = 50, d = 30, ry = 0;
    if (P.isFree(x, z, w + 24, d + 26, ry, { roadPad: true })) {
      const g = P.groundRange(x, z, w, d, ry);
      P.add({ type: 'office', x, z, w, d, ry, floors: 5, y0: g.lo - 0.5, y1: g.hi, map: 'building' });
      P.claim(x, z, w + 24, d + 26, ry);
      P.collider({ kind: 'box', x, z, hx: w / 2, hz: d / 2, ry, y0: g.lo - 1, y1: g.hi + 40 });
      P.far({ shape: 'box', x, z, y: g.lo - 1, w, d, h: g.hi - g.lo + 21, ry, color: '#d0cec6', lit: 0.4 });
      P.far({ shape: 'box', x: x + 17, z: z + 8, y: g.lo - 1, w: 9, d: 9, h: 40, ry, color: '#bcbab2', lit: 0.2 });
      P.far({ shape: 'box', x: x + 17, z: z + 8, y: g.lo + 39, w: 13, d: 13, h: 4.5, ry, color: '#3a5a7a', lit: 0.9 });
      P.lamp({ x: x, z: z - d / 2 - 5, hx: x, hy: g.hi + 5, hz: z - d / 2 - 4, color: '#f0f2ff', radius: 22, intensity: 0.9, halo: 2 });
      P.lamp({ x: x + 17, z: z + 8, hx: x + 17, hy: g.lo + 46, hz: z + 8, color: '#ff2a18', radius: 2, intensity: 0, halo: 3 });
      // its car park, the flagpoles
      P.add({ type: 'lot', x: x - 30, z: z, pts: [[x - w / 2 - 22, z - d / 2 - 10], [x - w / 2 - 2, z - d / 2 - 10], [x - w / 2 - 2, z + d / 2 + 10], [x - w / 2 - 22, z + d / 2 + 10]], map: 'yard' });
    }
  }
  // the gate canopy over Terminal Gate road
  {
    const r = P.net.byId.get('hb_gate');
    const p = r.posAt(r.length * 0.5);
    P.add({ type: 'gate', x: p.x, z: p.z, ry: p.heading, y0: p.y });
    for (const lat of [-13.6, 13.6]) for (const dz of [-6, 6]) {
      const c = r.posAt(r.length * 0.5 + dz, lat);
      P.collider({ kind: 'circle', x: c.x, z: c.z, r: 0.5, y0: p.y - 1, y1: p.y + 9 });
    }
    for (const lat of [-16.5, 16.5]) {
      const c = r.posAt(r.length * 0.5, lat);
      P.collider({ kind: 'box', x: c.x, z: c.z, hx: 1.6, hz: 2.2, ry: p.heading, y0: p.y - 1, y1: p.y + 3 });
    }
    P.lamp({ x: p.x, z: p.z, hx: p.x, hy: p.y + 7, hz: p.z, color: '#f4f6ff', radius: 26, intensity: 1.2, halo: 0 });
    P.far({ shape: 'box', x: p.x, z: p.z, y: p.y + 7, w: 31, d: 16, h: 1.4, ry: p.heading, color: '#1d4f8f' });
  }
  // the empties depot east of the gate: walls of one line's boxes, six high
  const rp = CW + 0.32, bp = C40 + 0.45;
  for (const [zc, rows] of [[1968, 4], [2012, 5]]) {
    let x = -1966;
    while (x < -1560) {
      const bays = P.pick([6, 7, 8, 9]);
      const len = bays * bp;
      if (x + len > -1505) break;
      const cx = x + len / 2;
      const w = rows * rp;
      if (P.isFree(cx, zc, len, w, 0, { pad: 0.5, roadPad: true })) {
        const tmax = P.pick([5, 6, 6, 7]);
        addBlock(P, S, cx, zc, bays, rows, 'line', tmax, P.rng() * 8 | 0);
        P.claim(cx, zc, len, w, 0);
      }
      x += len + P.range(10, 18);
    }
  }
  P.add({ type: 'emptiessign', x: -1955, z: 1944, ry: Math.PI });
  // the security fence along the terminal's north side and its east side
  const fpts = [[-2612, 2046], [-2014, 2046]], fpts2 = [[-1986, 2046], [-1466, 2046], [-1466, 2318]];
  for (const pts of [fpts, fpts2]) {
    for (const pc of pieces(pts, 90)) {
      const m = mid(pc);
      P.add({ type: 'fence', x: m[0], z: m[1], pts: pc });
      for (let i = 0; i < pc.length - 1; i++) {
        const a = pc[i], b = pc[i + 1];
        const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
        P.collider({ kind: 'box', x: (a[0] + b[0]) / 2, z: (a[1] + b[1]) / 2, hx: L / 2, hz: 0.15, ry: Math.atan2(-(b[1] - a[1]), b[0] - a[0]), y0: Y0 - 1, y1: Y0 + 3 });
      }
    }
  }
}

// ------------------------------------------------------------------ the rail yard

function planRail(P, S) {
  const OFFS = [22, 26.5, 31, 35.5, 40, 44.5];
  const xa = -2650, xb = -1522, gap = [-2013, -1987];
  const lines = OFFS.map((d) => offsetLine(BLVD, d));
  // claim the whole yard (so nothing else is put on the tracks)
  for (const pc of pieces(clipX(offsetLine(BLVD, 33), xa, xb), 60)) {
    const a = pc[0], b = pc[pc.length - 1];
    const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
    P.claim((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, L, 30, Math.atan2(-(b[1] - a[1]), b[0] - a[0]));
  }
  lines.forEach((ln, k) => {
    for (const [p0, p1] of [[xa + (k % 2) * 30, gap[0]], [gap[1], xb - (k % 3) * 25]]) {
      const pts = clipX(ln, p0, p1);
      if (pts.length < 2) continue;
      for (const pc of pieces(pts, 100)) {
        const m = mid(pc);
        P.add({ type: 'track', x: m[0], z: m[1], pts: pc });
      }
      // buffer stops at the far ends
      const e = p0 < -2400 ? pts[0] : pts[pts.length - 1];
      if (p0 < -2400 || p1 > -1700) P.add({ type: 'buffer', x: e[0], z: e[1], dir: p0 < -2400 ? -1 : 1, ry: Math.atan2(-(pts[1][1] - pts[0][1]), pts[1][0] - pts[0][0]) });
    }
  });
  // trains of boxes on four of the tracks
  const trains = [[1, -2600, -2060, true], [2, -2520, -2030, false], [3, -1960, -1560, true], [4, -2440, -2120, false], [2, -1940, -1640, false]];
  for (const [k, xs, xe, loco] of trains) {
    const pts = clipX(lines[k], xs, xe);
    if (pts.length < 2) continue;
    const a = pts[0], b = pts[pts.length - 1];
    const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const n = Math.floor(L / 20.6);
    // in runs of four wagons an item
    for (let c = 0; c < n; c += 4) {
      const t = (c + Math.min(4, n - c) / 2) * 20.6 / L;
      P.add({ type: 'train', x: a[0] + (b[0] - a[0]) * t, z: a[1] + (b[1] - a[1]) * t, ax: a[0], az: a[1], bx: b[0], bz: b[1], c0: c, c1: Math.min(n, c + 4), loco: loco && c === 0 });
    }
    const ry = Math.atan2(-(b[1] - a[1]), b[0] - a[0]);
    P.collider({ kind: 'box', x: (a[0] + b[0]) / 2, z: (a[1] + b[1]) / 2, hx: L / 2, hz: 1.6, ry, y0: Y0 - 1, y1: Y0 + 8 });
    P.far({ shape: 'box', x: (a[0] + b[0]) / 2, z: (a[1] + b[1]) / 2, y: Y0, w: L, d: 2.6, h: 6.4, ry, color: P.pick(['#6a4a3a', '#3a5a7a', '#7a6a4a']) });
  }
  // the rail-mounted gantries over tracks 1–4
  for (const x of [-2330, -1760]) {
    const c = polyAtX(offsetLine(BLVD, 33.25), x);
    const ry = Math.atan2(-c.tz, c.tx);
    P.add({ type: 'rmg', x: c.x, z: c.z, y0: P.groundY(c.x, c.z), ry, span: 18 });
    for (const sd of [-9, 9]) P.collider({ kind: 'box', x: c.x + c.lx * sd, z: c.z + c.lz * sd, hx: 4.5, hz: 0.8, ry, y0: Y0 - 1, y1: Y0 + 26 });
    P.far({ shape: 'box', x: c.x, z: c.z, y: Y0 + 23, w: 8, d: 30, h: 2.5, ry, color: '#2a5a9a' });
    P.far({ shape: 'box', x: c.x + c.lx * 9, z: c.z + c.lz * 9, y: Y0, w: 2, d: 2, h: 24, ry, color: '#2a5a9a' });
    P.far({ shape: 'box', x: c.x - c.lx * 9, z: c.z - c.lz * 9, y: Y0, w: 2, d: 2, h: 24, ry, color: '#2a5a9a' });
  }
  // sodium masts along the yard's north edge, the crossing's signals
  for (let x = -2600; x < -1550; x += 150) {
    if (Math.abs(x + 2000) < 40) continue;
    const c = polyAtX(offsetLine(BLVD, 51), x);
    const y0 = P.groundY(c.x, c.z);
    P.add({ type: 'mast', x: c.x, z: c.z, y0, h: 26, color: '#ffa040', heads: 6 });
    P.lamp({ x: c.x, z: c.z, hx: c.x, hy: y0 + 25, hz: c.z, color: '#ffa040', radius: 56, intensity: 1.1, halo: 9 });
    P.collider({ kind: 'circle', x: c.x, z: c.z, r: 0.9, y0: y0 - 1, y1: y0 + 26 });
  }
  const rr = P.net.byId.get('hb_rail');
  for (const [d, sd] of [[17.5, 1], [49, -1]]) {
    const c = polyAtX(offsetLine(BLVD, d), -2000);
    // on the near side of the road for each way's traffic
    const lat = sd > 0 ? 9.9 : -9.9;
    const x = c.x + lat, z = c.z;
    P.add({ type: 'xing', x, z, ry: sd > 0 ? 0 : Math.PI, y0: P.groundY(x, z) });
    P.collider({ kind: 'circle', x, z, r: 0.25, y0: Y0 - 1, y1: Y0 + 5 });
    void rr;
  }
  P.add({ type: 'railsign', x: -2420, z: polyAtX(offsetLine(BLVD, 49.5), -2420).z, ry: 0 });
}

// ------------------------------------------------------------------ the lift bridge

function planLift(P, S) {
  const r = P.net.byId.get('wf_lift');
  // the river span: the samples over water
  let i0 = -1, i1 = -1;
  for (let i = 0; i < r.N; i++) if (waterAt(r.X[i], r.Z[i])) { if (i0 < 0) i0 = i; i1 = i; }
  if (i0 < 0) return;
  const s0 = r.S[i0] - 4, s1 = r.S[i1] + 4;
  const a = r.posAt(s0), b = r.posAt(s1), m = r.posAt((s0 + s1) / 2);
  S.lift = { s0, s1 };
  P.add({ type: 'lift', x: m.x, z: m.z, s0, s1 });
  for (const s of [s0 - 3, s1 + 3]) {
    for (const lat of [-14, 14]) {
      const p = r.posAt(s, lat);
      P.collider({ kind: 'box', x: p.x, z: p.z, hx: 1.5, hz: 1.5, ry: p.heading, y0: -4, y1: 48 });
      P.far({ shape: 'box', x: p.x, z: p.z, y: -2, w: 2.6, d: 2.6, h: 44, ry: p.heading, color: '#3d6b55' });
    }
    const p = r.posAt(s);
    P.far({ shape: 'box', x: p.x, z: p.z, y: 40, w: 31, d: 4, h: 4, ry: p.heading, color: '#3d6b55' });
    const t = r.posAt(s, 14);
    P.lamp({ x: t.x, z: t.z, hx: t.x, hy: 46.5, hz: t.z, color: '#ff2a18', radius: 2, intensity: 0, halo: 3 });
    const f = r.posAt(s, -14);
    P.lamp({ x: f.x, z: f.z, hx: f.x, hy: 46.5, hz: f.z, color: '#ff2a18', radius: 2, intensity: 0, halo: 3 });
  }
  // floods on the span, the navigation lights under it
  P.lamp({ x: a.x, z: a.z, hx: m.x, hy: m.y + 12, hz: m.z, color: '#e6f0ff', radius: 30, intensity: 0.9, halo: 0 });
  for (const lat of [-6, 6]) {
    const p = r.posAt((s0 + s1) / 2, lat);
    P.lamp({ x: p.x, z: p.z, hx: p.x, hy: m.y - 2.2, hz: p.z, color: lat < 0 ? '#ff2a20' : '#20ff6a', radius: 2, intensity: 0, halo: 2 });
  }
  void b;
}

const GREEN = C('#3d6b55'), GREEN2 = C('#2f5546');

function liftBridge(B, M, it) {
  const r = B.net.byId.get('wf_lift');
  const st = B.acc(M.paint), cc = B.acc(M.conc), gl = B.acc(M.glow), bl = B.acc(M.blink);
  const { s0, s1 } = it;
  const yAt = (s) => r.posAt(s).y;
  const TOP = 44;
  // the two towers
  for (const s of [s0 - 3, s1 + 3]) {
    const p = r.posAt(s);
    for (const lat of [-14, 14]) {
      const q = r.posAt(s, lat);
      // its pier
      col(cc, C('#8a877f'));
      box(cc, q.x, -3, q.z, 4.2, p.y + 1.4, 4.2, q.heading, { u: 3 });
      col(st, GREEN);
      lattice(st, [q.x, p.y - 1.6, q.z], [q.x, TOP, q.z], 2.6, { bar: 0.32, bay: 2.8 });
      // the counterweight inside
      col(cc, C('#9a968c'));
      box(cc, q.x, TOP - 18, q.z, 1.9, 7, 1.9, q.heading, { u: 2 });
      // the sheave on top (its axle across the road: it turns along it)
      col(st, GREEN2);
      const A = r.posAt(s, lat - 0.6), Bq = r.posAt(s, lat + 0.6);
      tube(st, A.x, TOP + 2.6, A.z, Bq.x, TOP + 2.6, Bq.z, 2.4, 10);
      // ropes down to the span's corner
      col(st, C('#2a2a2a'));
      const c = r.posAt(s > it.s0 ? s1 : s0, lat * 0.95);
      st.beam(q.x, TOP + 0.5, q.z, c.x, c.y + 8, c.z, 0.12, 0.12);
      // obstruction light
      col(bl, C('#ff2a18', 5));
      bl.box(q.x, TOP + 5.3, q.z, 0.6, 0.6, 0.6);
    }
    // the top truss across the road and the machinery house
    const L = r.posAt(s, -14), R = r.posAt(s, 14);
    col(st, GREEN);
    truss(st, [L.x, TOP - 3.5, L.z], [R.x, TOP - 3.5, R.z], [L.x, TOP, L.z], [R.x, TOP, R.z], 10, 0.5, 0.3);
    const L2 = r.posAt(s - 1.2, -14), R2 = r.posAt(s - 1.2, 14);
    truss(st, [L2.x, TOP - 3.5, L2.z], [R2.x, TOP - 3.5, R2.z], [L2.x, TOP, L2.z], [R2.x, TOP, R2.z], 10, 0.5, 0.3);
    col(st, C('#c8c6be'));
    box(st, p.x, TOP, p.z, 30, 4, 4, p.heading, {});
    col(st, C('#7a2a22'));
    box(st, p.x, TOP + 4, p.z, 31, 0.5, 4.6, p.heading, {});
    col(gl, C('#ffe2a8', 1.6));
    for (const lat of [-9, -3, 3, 9]) { const w = r.posAt(s + 2.02, lat); gl.box(w.x, TOP + 1.6, w.z, 1.2, 1.0, 0.06, p.heading); }
    // a portal beam over the road at the tower's foot
    const L3 = r.posAt(s, -14), R3 = r.posAt(s, 14);
    col(st, GREEN);
    st.beam(L3.x, p.y + 9, L3.z, R3.x, p.y + 9, R3.z, 1.2, 1.6);
  }
  // the lift span: a through truss along both edges, braced over the top
  const n = 8;
  for (const lat of [-13.2, 13.2]) {
    const a0 = r.posAt(s0, lat), a1 = r.posAt(s1, lat);
    col(st, GREEN);
    truss(st, [a0.x, yAt(s0) + 0.4, a0.z], [a1.x, yAt(s1) + 0.4, a1.z], [a0.x, yAt(s0) + 7.6, a0.z], [a1.x, yAt(s1) + 7.6, a1.z], n, 0.7, 0.45);
    for (let k = 0; k <= n; k++) {
      const s = s0 + (s1 - s0) * k / n, q = r.posAt(s, lat);
      st.beam(q.x, yAt(s) + 0.3, q.z, q.x, yAt(s) + 7.7, q.z, 0.5, 0.5);
    }
  }
  for (let k = 0; k <= n; k += 2) {
    const s = s0 + (s1 - s0) * k / n;
    const L = r.posAt(s, -13.2), R = r.posAt(s, 13.2);
    st.beam(L.x, yAt(s) + 7.5, L.z, R.x, yAt(s) + 7.5, R.z, 0.45, 0.6);
  }
  // navigation lights under the span's middle
  const mm = (s0 + s1) / 2;
  col(gl, C('#ff2a20', 4));
  const nl = r.posAt(mm, -6); gl.box(nl.x, yAt(mm) - 2.2, nl.z, 0.5, 0.5, 0.5);
  col(gl, C('#20ff6a', 4));
  const nr = r.posAt(mm, 6); gl.box(nr.x, yAt(mm) - 2.2, nr.z, 0.5, 0.5, 0.5);
}

// ------------------------------------------------------------------ the river mouth

function riverBank(z, side) {
  // a point on the river's bank at z (side −1 west, +1 east) and its direction downstream
  const P0 = RIVER.path;
  for (let i = 0; i < P0.length - 1; i++) {
    const a = P0[i], b = P0[i + 1];
    if (z >= a[1] && z <= b[1]) {
      const t = (z - a[1]) / (b[1] - a[1]);
      const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
      const tx = (b[0] - a[0]) / L, tz = (b[1] - a[1]) / L;
      const cx = a[0] + (b[0] - a[0]) * t;
      // east of the flow is its left: (tz, −tx)
      return { x: cx + side * tz * (RIVER.width / 2 + 0.3), z: z - side * tx * (RIVER.width / 2 + 0.3), tx, tz };
    }
  }
  return null;
}

function planRiver(P, S) {
  // the embankment walls along both banks, south of the bridge to the sea and north of it
  for (const side of [-1, 1]) {
    for (const [za, zb] of [[1452, 1858], [1898, side < 0 ? 2250 : 2226]]) {
      const pts = [];
      for (let z = za; z <= zb; z += 40) { const q = riverBank(z, side); if (q) pts.push([q.x, q.z]); }
      const q = riverBank(zb, side); if (q) pts.push([q.x, q.z]);
      for (const pc of pieces(pts, 120)) {
        const m = mid(pc);
        // walking downstream (south) the west bank has the water on its left
        P.add({ type: 'riverwall', x: m[0], z: m[1], pts: pc, sea: side < 0 ? 1 : -1 });
      }
    }
  }
  // the harbour master's office and its signal tower
  {
    const x = -1386, z = 1946, w = 34, d = 20, ry = 0;
    if (P.isFree(x, z, w, d, ry, { roadPad: true })) {
      const g = P.groundRange(x, z, w, d, ry);
      P.add({ type: 'master', x, z, w, d, ry, y0: g.lo - 0.5, y1: g.hi, map: 'building' });
      P.claim(x, z, w + 6, d + 6, ry);
      P.collider({ kind: 'box', x, z, hx: w / 2, hz: d / 2, ry, y0: g.lo - 1, y1: g.hi + 30 });
      P.far({ shape: 'box', x, z, y: g.lo - 1, w, d, h: 14, ry, color: '#e8e6dc', lit: 0.45 });
      P.far({ shape: 'box', x: x + 12, z: z + 3, y: g.lo - 1, w: 6, d: 6, h: 27, ry, color: '#e8e6dc', lit: 0.2 });
      P.lamp({ x: x, z: z - d / 2 - 3, hx: x, hy: g.hi + 4, hz: z - d / 2 - 2, color: '#ffd7a0', radius: 18, intensity: 0.9, halo: 1.6 });
      P.lamp({ x: x + 12, z: z + 3, hx: x + 12, hy: g.hi + 27, hz: z + 3, color: '#ffe8b0', radius: 4, intensity: 0, halo: 4 });
    }
  }
  // bunker tanks behind their bund, south of it
  {
    const tanks = [[-1414, 2150, 13, 16], [-1360, 2160, 11, 14], [-1408, 2212, 12, 17], [-1352, 2218, 10, 12]];
    const placed = [];
    for (const [x, z, r, h] of tanks) {
      if (!P.isFree(x, z, 2 * r + 2, 2 * r + 2, 0, { pad: 1 })) continue;
      const y0 = P.groundY(x, z);
      P.add({ type: 'tank', x, z, r, h, y0 });
      P.claim(x, z, 2 * r + 2, 2 * r + 2, 0);
      P.collider({ kind: 'circle', x, z, r: r + 0.3, y0: y0 - 1, y1: y0 + h + 3 });
      P.far({ shape: 'cyl', x, z, y: y0 - 0.5, r, h: h + 0.5, color: '#d6d6d0' });
      placed.push([x, z, r]);
    }
    if (placed.length) {
      let xa = Infinity, xb = -Infinity, za = Infinity, zb = -Infinity;
      for (const [x, z, r] of placed) { xa = Math.min(xa, x - r - 5); xb = Math.max(xb, x + r + 5); za = Math.min(za, z - r - 5); zb = Math.max(zb, z + r + 5); }
      P.add({ type: 'bund', x: (xa + xb) / 2, z: (za + zb) / 2, xa, xb, za, zb });
      P.lamp({ x: xa, z: za, hx: xa + 2, hy: Y0 + 9, hz: za + 2, color: '#ffb060', radius: 30, intensity: 0.9, halo: 2.4 });
      P.lamp({ x: xb, z: zb, hx: xb - 2, hy: Y0 + 9, hz: zb - 2, color: '#ffb060', radius: 30, intensity: 0.9, halo: 2.4 });
    }
  }
  // the tugs at their jetty on the west bank, below the bridge
  for (const [z, name] of [[1985, 0], [2042, 1], [2098, 2]]) {
    const q = riverBank(z, -1);
    if (!q) continue;
    // 7 m out from the bank, along the flow
    const ex = q.tz, ez = -q.tx;           // east (into the river)
    const x = q.x + ex * 7.5, zz = q.z + ez * 7.5;
    P.add({ type: 'tug', x, z: zz, ry: Math.atan2(-q.tz, q.tx) + (name === 1 ? Math.PI : 0), num: name });
    P.far({ shape: 'box', x, z: zz, y: 0, w: 9, d: 30, h: 9, ry: Math.atan2(q.tx, q.tz), color: '#2a2a2a' });
    P.lamp({ x, z: zz, hx: x, hy: 10, hz: zz, color: '#ffe0a8', radius: 14, intensity: 0.7, halo: 1.5 });
  }
  const j0 = riverBank(1960, -1), j1 = riverBank(2128, -1);
  if (j0 && j1) P.add({ type: 'jetty', x: (j0.x + j1.x) / 2, z: (j0.z + j1.z) / 2, ax: j0.x, az: j0.z, bx: j1.x, bz: j1.z });
}

// ------------------------------------------------------------------ the sheds on Dock Street

function planSheds(P, S) {
  const lots = P.lots({
    roads: (r) => r.spec.id === 'hb_dock1' || r.spec.id === 'hb_dock2' || r.spec.id === 'hb_rail',
    width: [46, 96], depth: [28, 56], gap: [14, 34], setback: [7, 14], pad: 2, ends: 14,
  });
  let n = 0;
  for (const L of lots) {
    const g = P.groundRange(L.x, L.z, L.w, L.d, L.ry);
    const h = Math.round(P.range(9, 14));
    const num = SHEDS[n++ % SHEDS.length];
    const tint = P.pick(['#a8bccb', '#cfc6ae', '#93a593', '#b4806a', '#d4d4d0', '#7d8c9a', '#c0a070']);
    const c = Math.cos(L.ry), s = Math.sin(L.ry);
    const trucks = [];
    if (L.setback >= 7.5) {
      for (const sd of [-1, 1]) {
        if (P.rng() < 0.45) continue;
        const lx = sd * L.w * 0.22, lz = L.d / 2 + 5.6;
        trucks.push({ lx, flip: P.rng() < 0.5 });
        P.collider({ kind: 'box', x: L.x + lx * c + lz * s, z: L.z - lx * s + lz * c, hx: 8.2, hz: 1.3, ry: L.ry, y0: g.lo - 1, y1: g.hi + 4.2 });
      }
    }
    P.add({ type: 'shed', x: L.x, z: L.z, w: L.w, d: L.d, ry: L.ry, h, y0: g.lo - 0.5, y1: g.hi, num, tint, roof: P.pick(['gable', 'gable', 'saw']), trucks, map: 'building' });
    P.collider({ kind: 'box', x: L.x, z: L.z, hx: L.w / 2, hz: L.d / 2 + 1.5, ry: L.ry, y0: g.lo - 1, y1: g.hi + h + 4 });
    P.far({ shape: 'box', x: L.x, z: L.z, y: g.lo - 1, w: L.w, d: L.d, h: h + 2 + g.hi - g.lo, ry: L.ry, color: tint, lit: 0.08 });
    // sodium wall packs over the doors
    for (const f of [-0.3, 0.3]) {
      const c = Math.cos(L.ry), s = Math.sin(L.ry);
      const lx = f * L.w, lz = L.d / 2 + 1.2;
      const x = L.x + lx * c + lz * s, z = L.z - lx * s + lz * c;
      P.lamp({ x, z, hx: x, hy: g.hi + 7, hz: z, color: '#ffae58', radius: 20, intensity: 0.9, halo: 1.8 });
    }
  }
}

// ------------------------------------------------------------------ the old harbor (east of the river)

function planOldHarbor(P, S) {
  const lots = P.lots({
    roads: (r) => r.spec.id === 'wf_lift',
    width: [24, 42], depth: [18, 30], gap: [0, 3], setback: [0, 0.6], pad: -0.6, ends: 20,
  });
  let fish = false;
  for (const L of lots) {
    // keep clear of the lift bridge's towers
    if (S.lift) {
      const r = P.net.byId.get('wf_lift');
      if (L.s > S.lift.s0 - 30 && L.s < S.lift.s1 + 30) continue;
      void r;
    }
    const g = P.groundRange(L.x, L.z, L.w, L.d, L.ry);
    if (!fish && L.side < 0 && L.x > -1150) {
      fish = true;
      P.add({ type: 'market', x: L.x, z: L.z, w: L.w, d: L.d, ry: L.ry, y0: g.lo - 0.5, y1: g.hi, map: 'building' });
      P.collider({ kind: 'box', x: L.x, z: L.z, hx: L.w / 2, hz: L.d / 2, ry: L.ry, y0: g.lo - 1, y1: g.hi + 10 });
      P.far({ shape: 'box', x: L.x, z: L.z, y: g.lo - 1, w: L.w, d: L.d, h: 9, ry: L.ry, color: '#8aa8a0', lit: 0.3 });
      continue;
    }
    const h = P.pick([2, 3, 3, 4, 4, 5]) * 4.5;
    const shop = L.w > 26 && P.rng() < 0.45 ? P.pick(SHOPS) : null;
    P.add({ type: 'bonded', x: L.x, z: L.z, w: L.w, d: L.d, ry: L.ry, h, y0: g.lo - 0.5, y1: g.hi, sign: shop ? null : P.pick([null, null, 'cold', 'bonded']), tint: P.pick(BRICKS), roof: P.rng() < 0.3 ? 'gable' : 'flat', shop, map: 'building' });
    P.collider({ kind: 'box', x: L.x, z: L.z, hx: L.w / 2, hz: L.d / 2, ry: L.ry, y0: g.lo - 1, y1: g.hi + h + 2 });
    P.far({ shape: 'box', x: L.x, z: L.z, y: g.lo - 1, w: L.w, d: L.d, h: h + 1 + g.hi - g.lo, ry: L.ry, color: '#7a3b2a', lit: 0.18 });
    const c = Math.cos(L.ry), s = Math.sin(L.ry);
    const x = L.x + (L.d / 2 + 0.8) * s, z = L.z + (L.d / 2 + 0.8) * c;
    P.lamp({ x, z, hx: x, hy: g.hi + 4.4, hz: z, color: '#ffc27a', radius: 14, intensity: 0.8, halo: 1.4 });
  }
  // more of them behind, east of the river up to Old Town
  const fill = P.fill({ spacing: 44, width: [26, 44], depth: [20, 34], pad: 3, test: (x, z) => x > -1225 && z < 1830 && z > 1470 });
  for (const L of fill) {
    const g = P.groundRange(L.x, L.z, L.w, L.d, L.ry);
    const h = P.pick([2, 2, 3, 3, 4]) * 4.5;
    P.add({ type: 'bonded', x: L.x, z: L.z, w: L.w, d: L.d, ry: L.ry, h, y0: g.lo - 0.5, y1: g.hi, sign: P.pick([null, null, null, 'cold']), tint: P.pick(BRICKS), roof: P.rng() < 0.4 ? 'gable' : 'flat', map: 'building' });
    P.collider({ kind: 'box', x: L.x, z: L.z, hx: L.w / 2, hz: L.d / 2, ry: L.ry, y0: g.lo - 1, y1: g.hi + h + 2 });
    P.far({ shape: 'box', x: L.x, z: L.z, y: g.lo - 1, w: L.w, d: L.d, h: h + 1 + g.hi - g.lo, ry: L.ry, color: '#743828', lit: 0.12 });
  }
}

// ------------------------------------------------------------------ builders

const BUILD = {
  quay(B, M, it) { quayEdge(B, M, { pts: it.pts, sea: it.sea }); },
  riverwall(B, M, it) {
    const r = riverAtLevel(it.x, it.z);
    quayEdge(B, M, { pts: it.pts, sea: it.sea, wallBottom: r - 2.4, waterY: r, line: false, fenders: 0, bollards: 34, wallC: '#8e8270' });
  },
  shiphull: shipHull,
  shiphouse: shipHouse,
  shipcargo: shipCargo,
  sts(B, M, it, uv) {
    stsCrane(B, M, it);
    // the crane's number on its machinery house, both sides
    const F = frame(it.x, it.y0, it.z, it.ry);
    const sg = B.acc(M.sign);
    for (const sd of [1, -1]) {
      const p = F(sd * 5.53, 52.4, -22.5);
      panel(sg, p[0], p[1], p[2], 6.5, 2.5, it.ry + sd * Math.PI / 2, uv[`sts${it.num}`]);
    }
  },
  rtg(B, M, it) { rtgCrane(B, M, it); },
  straddle(B, M, it) { straddle(B, M, it); },
  mast(B, M, it) { mast(B, M, it); },
  stack(B, M, it) {
    stackBlock(B, M, it);
    if (!it.w) return;
    // the block's footprint painted on the yard
    const dec = B.acc(M.decal);
    col(dec, C('#d8d4c4', 0.9));
    const w = it.w + 1.2, d = it.d + 1.2;
    for (const [ax, az, bx, bz] of [[-w / 2, -d / 2, w / 2, -d / 2], [-w / 2, d / 2, w / 2, d / 2]]) groundStrip(dec, B, [[it.x + ax, it.z + az], [it.x + bx, it.z + bz]], 0.18, 0.04, 8);
  },
  den,
  truck(B, M, it) { truck(B, M, it.x, B.groundY(it.x, it.z), it.z, it.ry, makeRng(seedOf(it)), it.box); },
  berthsign(B, M, it, uv) {
    const st = B.acc(M.paint), sg = B.acc(M.sign);
    const y = B.groundY(it.x, it.z);
    col(st, C('#3a3c40'));
    for (const d of [-1.4, 1.4]) { const c = Math.cos(it.ry), s = Math.sin(it.ry); st.box(it.x + d * c, y, it.z - d * s, 0.18, 4.2, 0.18); }
    panel(sg, it.x, y + 3.6, it.z, 3.2, 1.3, it.ry, uv[it.sign], true);
  },
  emptiessign(B, M, it, uv) {
    const st = B.acc(M.paint), sg = B.acc(M.sign);
    const y = B.groundY(it.x, it.z);
    col(st, C('#3a3c40'));
    st.box(it.x, y, it.z, 0.4, 7, 0.4);
    panel(sg, it.x, y + 6.6, it.z - 0.25, 7.2, 1.25, it.ry, uv.empties, true);
  },
  office: portOffice,
  gate: gateCanopy,
  lot(B, M, it) {
    const dec = B.acc(M.decal);
    col(dec, C('#3e3f42'));
    drape(dec, B, it.pts, { lift: 0.05, step: 6, uv: 8 });
    col(dec, C('#d8d6cc'));
    const [a, b, c] = it.pts;
    for (let z = Math.min(a[1], c[1]) + 3; z < Math.max(a[1], c[1]) - 2; z += 2.6) groundStrip(dec, B, [[a[0] + 1, z], [a[0] + 6, z]], 0.12, 0.08, 6);
    void b;
  },
  fence(B, M, it) { fence(B, M, it.pts, 2.6, true); },
  track: trackPiece,
  buffer(B, M, it) {
    const st = B.acc(M.paint);
    const y = B.groundY(it.x, it.z);
    col(st, C('#c8322a'));
    box(st, it.x, y, it.z, 1.2, 1.4, 3.2, it.ry, {});
    col(st, C('#e8e4d8'));
    box(st, it.x, y + 1.0, it.z, 1.25, 0.2, 3.25, it.ry, {});
  },
  train: trainPiece,
  rmg: rmgCrane,
  xing: crossing,
  railsign(B, M, it, uv) {
    const st = B.acc(M.paint), sg = B.acc(M.sign);
    const y = B.groundY(it.x, it.z);
    col(st, C('#2a2c30'));
    for (const d of [-5, 5]) st.box(it.x + d, y, it.z, 0.3, 5.5, 0.3);
    panel(sg, it.x, y + 4.6, it.z, 12, 1.45, it.ry, uv.rail, true);
  },
  lift: liftBridge,
  master: harbourMaster,
  tank: bunkerTank,
  bund(B, M, it) {
    const cc = B.acc(M.conc);
    col(cc, C('#9a978e'));
    const y = B.groundY(it.x, it.z);
    const { xa, xb, za, zb } = it;
    box(cc, (xa + xb) / 2, y - 0.5, za, xb - xa, 1.7, 0.6, 0, { u: 3 });
    box(cc, (xa + xb) / 2, y - 0.5, zb, xb - xa, 1.7, 0.6, 0, { u: 3 });
    box(cc, xa, y - 0.5, (za + zb) / 2, 0.6, 1.7, zb - za, 0, { u: 3 });
    box(cc, xb, y - 0.5, (za + zb) / 2, 0.6, 1.7, zb - za, 0, { u: 3 });
  },
  tug,
  jetty(B, M, it) {
    const wd = B.acc(M.wood), st = B.acc(M.paint);
    const L = Math.hypot(it.bx - it.ax, it.bz - it.az);
    const ry = Math.atan2(it.bx - it.ax, it.bz - it.az);
    const ex = Math.cos(ry), ez = -Math.sin(ry);       // across (local x)
    col(wd, C('#b8a088'));
    const cx = (it.ax + it.bx) / 2 + ex * 2.2, cz = (it.az + it.bz) / 2 + ez * 2.2;
    box(wd, cx, 2.0, cz, 3.6, 0.4, L, ry, { u: 2 });
    col(st, C('#3a3028'));
    for (let k = 0; k <= L; k += 6) {
      const t = k / L;
      for (const o of [0.6, 3.8]) {
        const x = it.ax + (it.bx - it.ax) * t + ex * o, z = it.az + (it.bz - it.az) * t + ez * o;
        cylinder(st, x, -2, z, 0.22, 4.6, 6);
      }
    }
  },
  market: fishMarket,
  bonded: bondedStore,
  shed: transitShed,
};

// ------------------------------------------------------------------ the hideout

function den(B, M, it) {
  const y = B.groundY(it.x, it.z);
  const mt = B.near(M.matte), st = B.near(M.paint), gl = B.acc(M.glow), sg = B.acc(M.sign);
  const uv = UV();
  const F = frame(it.x, y, it.z, 0);
  // a box on its own: the lounge, doors open; a sofa, a table, an oil drum fire
  const rng = makeRng(seedOf(it));
  const L = randomBox(rng);
  const c0 = F(-8, 0, 2.6);
  container(B.acc(M.cont), c0[0], c0[1], c0[2], 0, L.row, L.tint);
  col(mt, C('#5a2a2a'));
  lbox(mt, F, 0, 3, 0, 1.5, 3.2, 0.45, 1.0, {});
  lbox(mt, F, 0, 3, 0.45, 2.0, 3.2, 0.5, 0.25, {});
  lbox(mt, F, 0, 1.5, 0, 1.5, 0.3, 0.8, 1.0, {});
  lbox(mt, F, 0, 4.6, 0, 1.5, 0.3, 0.8, 1.0, {});
  col(mt, C('#3a2a1c'));
  lbox(mt, F, 0, 3, 0, -0.2, 1.6, 0.45, 0.8, {});
  col(st, C('#3a3a3a'));
  const dr = F(6, 0, -1);
  cylinder(st, dr[0], dr[1], dr[2], 0.32, 0.9, 8);
  col(gl, C('#ff8a2a', 3));
  coneC(gl, dr[0], dr[1] + 0.9, dr[2], 0.3, 0.8, 6);
  // a television on a crate
  col(st, C('#222'));
  lbox(st, F, 0, 3, 0, -3.4, 0.8, 0.8, 0.5, {});
  lbox(st, F, 0, 3, 0.8, -3.4, 1.0, 0.7, 0.3, {});
  col(gl, C('#6ab0ff', 1.8));
  lbox(gl, F, 0, 3, 0.86, -3.24, 0.85, 0.55, 0.02, {});
  // the neon over it all, on the back wall, and string lights across
  const n = F(0, 4.6, it.d / 2 - 0.1);
  panel(sg, n[0], n[1], n[2], 5.6, 2.0, Math.PI, uv.box);
  const wire = B.near(M.paint);
  for (const dz of [-3, 1.5]) stringLights(wire, gl, F(-it.w / 2 + 1, 5.6, dz), F(it.w / 2 - 1, 5.6, dz), 0.9, 22, [C('#ff4a8a', 3), C('#ffd84a', 3), C('#4ae0ff', 3)]);
}

// ------------------------------------------------------------------ buildings

function portOffice(B, M, it, uv) {
  const { x, z, w, d, ry } = it;
  const F = frame(x, 0, z, ry);
  const of = B.acc(M.office), cc = B.acc(M.conc), st = B.acc(M.paint), gl = B.acc(M.glow), sg = B.acc(M.sign);
  const H = it.floors * 4, base = it.y1;
  // ground floor: a recessed glass lobby band under the offices
  col(cc, C('#b8b6ae'));
  box(cc, x, it.y0, z, w, base - it.y0 + 0.4, d, ry, { u: 4 });
  col(of, [1, 1, 1]);
  box(of, x, base + 0.4, z, w, H, d, ry, { u: 16, v: 16, top: false });
  col(cc, C('#c8c6be'));
  box(cc, x, base + 0.4 + H, z, w + 0.6, 1.0, d + 0.6, ry, { u: 4 });
  // roof plant
  col(st, C('#8a8d90'));
  lbox(st, F, ry, -10, base + H + 1.4, 3, 9, 2.4, 7, {});
  lbox(st, F, ry, 4, base + H + 1.4, -5, 6, 1.8, 5, {});
  // entrance canopy (north, towards the boulevard: local −z)
  col(cc, C('#e0ded6'));
  lbox(cc, F, ry, -6, base + 3.4, -d / 2 - 2.5, 12, 0.5, 5, {});
  col(gl, C('#fff6e0', 1.6));
  lbox(gl, F, ry, -6, base + 3.36, -d / 2 - 2.5, 10, 0.05, 3.5, { top: false, bottom: true });
  // the name along the top of the north face
  const s = F(0, base + H - 1.2, -d / 2 - 0.08);
  panel(sg, s[0], s[1], s[2], w * 0.86, (w * 0.86) * 84 / 1000, ry + Math.PI, uv.hpa);
  // port control: a shaft up to a glass cab
  const tx = 17, tz = 8, TH = 40;
  col(cc, C('#d2d0c8'));
  lbox(cc, F, ry, tx, base + H + 1.4, tz, 8, TH - H - 1.4, 8, { u: 4 });
  col(cc, C('#c8c6be'));
  lbox(cc, F, ry, tx, base + TH, tz, 13.5, 0.8, 13.5, { u: 4 });
  col(gl, C('#bfe0ff', 1.4));
  lbox(gl, F, ry, tx, base + TH + 0.8, tz, 12.6, 3.2, 12.6, { top: false });
  col(st, C('#2a2c30'));
  for (const [a, b] of [[-6.3, -6.3], [6.3, -6.3], [-6.3, 6.3], [6.3, 6.3]]) lbox(st, F, ry, tx + a, base + TH + 0.8, tz + b, 0.4, 3.2, 0.4, {});
  col(cc, C('#c8c6be'));
  lbox(cc, F, ry, tx, base + TH + 4.0, tz, 14, 0.7, 14, { u: 4 });
  // radar on top
  col(st, C('#d8d8d0'));
  const rp = F(tx, base + TH + 4.7, tz);
  st.beam(rp[0], rp[1], rp[2], rp[0], rp[1] + 3, rp[2], 0.3, 0.3);
  lbox(st, F, ry, tx, base + TH + 7.7, tz, 5, 0.5, 0.6, {}, 0.6);
  col(B.acc(M.blink), C('#ff2a18', 5));
  B.acc(M.blink).box(rp[0], rp[1] + 3.2, rp[2], 0.5, 0.5, 0.5);
  // flagpoles at the door
  const mt = B.acc(M.matte);
  for (let k = 0; k < 3; k++) {
    const p = F(-14 + k * 3, base, -d / 2 - 7);
    col(st, C('#d0d0d0'));
    st.box(p[0], p[1], p[2], 0.12, 11, 0.12);
    col(mt, C(['#1d4f8f', '#e8e6de', '#c8322a'][k]));
    const fl = frame(p[0], p[1] + 9, p[2], ry);
    mt.quadP(fl(0.06, 0, 0), fl(2.6, 0, 0), fl(2.6, 1.6, 0), fl(0.06, 1.6, 0));
    mt.quadP(fl(2.6, 0, 0), fl(0.06, 0, 0), fl(0.06, 1.6, 0), fl(2.6, 1.6, 0));
  }
}

function gateCanopy(B, M, it, uv) {
  const r = B.net.byId.get('hb_gate');
  const st = B.acc(M.paint), gl = B.acc(M.glow), sg = B.acc(M.sign), cc = B.acc(M.conc);
  const y = it.y0;
  const F = frame(it.x, y, it.z, it.ry);
  const ry = it.ry;
  // columns, the roof, its lit underside
  col(st, C('#d8d6ce'));
  for (const lat of [-13.6, 13.6]) for (const dz of [-6, 6]) lbox(st, F, ry, lat, 0, dz, 0.7, 7.4, 0.7, {});
  col(st, C('#1d4f8f'));
  lbox(st, F, ry, 0, 7.4, 0, 31, 1.4, 16, {});
  col(st, C('#e8e6de'));
  lbox(st, F, ry, 0, 8.8, 0, 31.4, 0.3, 16.4, {});
  col(gl, C('#f4f8ff', 2.2));
  for (const lat of [-10, -5, 0, 5, 10]) lbox(gl, F, ry, lat, 7.36, 0, 1.2, 0.05, 13, { top: false, bottom: true });
  // the sign both ways
  for (const sd of [1, -1]) {
    const p = F(0, 8.1, sd * 8.06);
    panel(sg, p[0], p[1], p[2], 6.4, 1.5, ry + (sd > 0 ? 0 : Math.PI), uv.gate);
  }
  // guard booths either side, boom barriers raised
  for (const lat of [-16.5, 16.5]) {
    col(cc, C('#d8d6ce'));
    lbox(cc, F, ry, lat, 0, 0, 3.2, 2.8, 4.4, {});
    col(gl, C('#ffe8c0', 1.3));
    lbox(gl, F, ry, lat - Math.sign(lat) * 1.61, 1.1, 0, 0.04, 1.2, 3.4, {});
    col(st, C('#3a3c40'));
    lbox(st, F, ry, lat, 2.8, 0, 3.6, 0.3, 4.8, {});
    const b0 = F(lat - Math.sign(lat) * 2.2, 1.0, -7.5);
    const b1 = F(lat - Math.sign(lat) * 3.4, 7.2, -7.5);
    col(st, C('#e8e6de'));
    st.beam(b0[0], b0[1], b0[2], b1[0], b1[1], b1[2], 0.18, 0.18);
    col(st, C('#c8322a'));
    const bm = [(b0[0] + b1[0]) / 2, (b0[1] + b1[1]) / 2, (b0[2] + b1[2]) / 2];
    st.beam(bm[0], bm[1] - 0.6, bm[2], bm[0], bm[1] + 0.6, bm[2], 0.2, 0.2);
  }
  void r;
}

function transitShed(B, M, it, uv) {
  const { x, z, w, d, ry, h } = it;
  const F = frame(x, 0, z, ry);
  const cl = B.acc(M.clad), st = B.acc(M.paint), cc = B.acc(M.conc), gl = B.acc(M.glow), sg = B.acc(M.sign);
  const base = it.y1;
  const tint = C(it.tint);
  col(cc, C('#8e8b84'));
  box(cc, x, it.y0, z, w, base - it.y0 + 0.3, d, ry, { u: 4 });
  col(cl, tint);
  box(cl, x, base + 0.3, z, w, h, d, ry, { u: 12, v: 12, top: false });
  // the roof
  const roofC = C(it.roof === 'saw' ? '#5a5e62' : '#6a6e72');
  col(st, roofC);
  if (it.roof === 'saw') {
    // sawtooth: north lights along the shed
    const n = Math.max(3, Math.round(d / 9));
    for (let k = 0; k < n; k++) {
      const z0 = -d / 2 + k * d / n, z1 = z0 + d / n;
      const a = F(-w / 2, base + 0.3 + h, z0), b = F(w / 2, base + 0.3 + h, z0), c = F(w / 2, base + 0.3 + h + 3, z1), e = F(-w / 2, base + 0.3 + h + 3, z1);
      st.quadP(b, a, e, c);
      // the glazed upstand (lit at night)
      const a2 = F(-w / 2, base + 0.3 + h, z1), b2 = F(w / 2, base + 0.3 + h, z1);
      col(gl, C('#ffe6b0', 0.9));
      gl.quadP(a2, b2, c, e);
    }
    col(cl, tint);
    for (const sx of [-1, 1]) for (let k = 0; k < n; k++) {
      const z0 = -d / 2 + k * d / n, z1 = z0 + d / n;
      const A = cl.v(...F(sx * w / 2, base + 0.3 + h, z0), 0, 0), Bv = cl.v(...F(sx * w / 2, base + 0.3 + h, z1), 1, 0), Cv = cl.v(...F(sx * w / 2, base + 0.3 + h + 3, z1), 1, 0.25);
      if (sx > 0) cl.tri(A, Cv, Bv); else cl.tri(A, Bv, Cv);
    }
  } else {
    gable(st, x, base + 0.3 + h, z, w, d, Math.min(4.5, d * 0.12), ry, { over: 0.6, endAcc: cl, alongZ: false });
  }
  // the loading dock along the front with its roller doors, lamps and trucks
  col(cc, C('#9a978f'));
  lbox(cc, F, ry, 0, base - 0.4, d / 2 + 1.5, w - 2, 1.6, 3, { u: 3 });
  const nd = Math.max(2, Math.floor(w / 11));
  const rng = makeRng(seedOf(it));
  for (let k = 0; k < nd; k++) {
    const lx = -w / 2 + (k + 0.5) * w / nd;
    col(st, C(rng() < 0.2 ? '#c8a22a' : '#4a4e52'));
    lbox(st, F, ry, lx, base + 1.2, d / 2 + 0.05, 4.2, 4.6, 0.12, {});
    col(gl, C('#ffc070', 2.6));
    lbox(gl, F, ry, lx, base + 6.5, d / 2 + 0.3, 0.6, 0.25, 0.5, {});
  }
  // a truck or two alongside the dock (parked along it, inside the lot)
  for (const t of it.trucks || []) {
    const p = F(t.lx, 0, d / 2 + 5.6);
    truck(B, M, p[0], B.groundY(p[0], p[2]), p[2], ry + (t.flip ? Math.PI : 0), rng, rng() < 0.8);
  }
  // the shed's number big on the front, high up
  const s = F(w * 0.32, base + h - 2.2, d / 2 + 0.1);
  panel(sg, s[0], s[1], s[2], 6.4, 2.45, ry, uv[`shed${it.num}`]);
}

function bondedStore(B, M, it, uv) {
  const { x, z, w, d, ry, h } = it;
  const F = frame(x, 0, z, ry);
  const br = B.acc(M.brick), cc = B.acc(M.conc), st = B.acc(M.paint), gl = B.acc(M.glow), sg = B.acc(M.sign);
  const base = it.y1;
  const k = it.tint;
  col(br, k);
  box(br, x, it.y0, z, w, base - it.y0 + h, d, ry, { u: 12, v: 9, top: false, v0: -(base - it.y0) / 9 });
  const dk = [k[0] * 0.85, k[1] * 0.82, k[2] * 0.8];
  if (it.roof === 'gable') {
    // a pitched slate roof, gable ends in brick
    col(st, C('#3c3f44'));
    gable(st, x, base + h, z, w, d, Math.min(6, d * 0.32), ry, { over: 0.5, endAcc: br, alongZ: false });
  } else {
    // parapet and coping, a flat roof
    col(cc, C('#6a655c'));
    box(cc, x, base + h, z, w + 0.4, 0.3, d + 0.4, ry, { u: 4 });
    col(br, dk);
    for (const sd of [-1, 1]) lbox(br, F, ry, 0, base + h + 0.3, sd * (d / 2 - 0.2), w, 1.2, 0.4, { u: 12, v: 9 });
    for (const sd of [-1, 1]) lbox(br, F, ry, sd * (w / 2 - 0.2), base + h + 0.3, 0, 0.4, 1.2, d, { u: 12, v: 9 });
  }
  // hoist housings (lucarnes) over the loading bays, with their beams
  const n = Math.max(1, Math.floor(w / 14));
  for (let q = 0; q < n; q++) {
    const lx = -w / 2 + (q + 0.5) * w / n;
    if (it.shop && Math.abs(lx) < w * 0.3) continue;
    col(br, k);
    if (it.roof !== 'gable') {
      lbox(br, F, ry, lx, base + h - 3, d / 2 - 1, 4, 4.4, 2.6, { u: 12, v: 9 });
      col(st, C('#3a3a38'));
      gable(st, ...F(lx, base + h + 1.4, d / 2 - 1), 4, 2.6, 1.4, ry + Math.PI / 2, { over: 0.3 });
    }
    col(st, C('#3a3a38'));
    lbox(st, F, ry, lx, base + h - 0.4, d / 2 + 1.2, 0.3, 0.3, 2.4, {});
    // loading doors down the front
    col(st, C(['#2e4a3a', '#5a2a22', '#2a3a4a'][(it.n + q) % 3]));
    for (let fl = 0; fl < Math.round(h / 4.5); fl++) lbox(st, F, ry, lx, base + 0.2 + fl * 4.5, d / 2 + 0.05, 2.4, 3.2, 0.1, {});
  }
  if (it.shop) {
    // a bar or a shop on the ground floor: lit glass, an awning, its neon over the door
    const sw = Math.min(14, w * 0.5);
    col(gl, C(it.shop === 'chandlery' ? '#ffe2b0' : '#ffb070', 1.1));
    lbox(gl, F, ry, 0, base + 0.5, d / 2 + 0.06, sw, 2.8, 0.04, { top: false });
    col(st, C('#1a1a1a'));
    for (let m = -sw / 2; m <= sw / 2 + 0.01; m += sw / 4) lbox(st, F, ry, m, base + 0.5, d / 2 + 0.1, 0.18, 2.8, 0.06, {});
    col(B.acc(M.matte), C(['#a8261e', '#1d4f8f', '#2f6a3a', '#c8a22a'][it.n % 4]));
    lbox(B.acc(M.matte), F, ry, 0, base + 3.4, d / 2 + 0.9, sw + 1, 0.2, 1.8, {});
    const s = F(0, base + 4.6, d / 2 + 0.12);
    const sh = it.shop === 'tattoo' ? 1.5 : 1.25;
    panel(sg, s[0], s[1], s[2], sh * (it.shop === 'tattoo' ? 400 : it.shop === 'chandlery' ? 560 : 520) / (it.shop === 'chandlery' ? 110 : 120), sh, ry, uv[it.shop]);
  }
  if (it.sign) {
    const s = F(0, base + h - 1.5, d / 2 + 0.1);
    const sw = Math.min(w * 0.85, 22);
    panel(sg, s[0], s[1], s[2], sw, sw * (it.sign === 'cold' ? 100 / 900 : 90 / 700), ry, uv[it.sign]);
  }
  col(gl, C('#ffc27a', 2.4));
  const lp = F(0, base + 4.2, d / 2 + 0.5);
  gl.box(lp[0], lp[1], lp[2], 0.5, 0.5, 0.5);
}

function fishMarket(B, M, it, uv) {
  const { x, z, w, d, ry } = it;
  const F = frame(x, 0, z, ry);
  const cl = B.acc(M.clad), st = B.acc(M.paint), gl = B.acc(M.glow), sg = B.acc(M.sign), cc = B.acc(M.conc);
  const base = it.y1, h = 5.5;
  col(cc, C('#9a978f'));
  box(cc, x, it.y0, z, w, base - it.y0 + 0.3, d, ry, { u: 4 });
  col(cl, C('#e8ece6'));
  box(cl, x, base + 0.3, z, w, h, d, ry, { u: 12, v: 12, top: false });
  // a barrel roof (teal), along the building
  const n = 10, R = d / 2 + 0.6, rise = 3.8;
  col(st, C('#3a8a86'));
  for (let k = 0; k < n; k++) {
    const a0 = Math.PI * k / n, a1 = Math.PI * (k + 1) / n;
    const z0 = -Math.cos(a0) * R, y0 = Math.sin(a0) * rise, z1 = -Math.cos(a1) * R, y1 = Math.sin(a1) * rise;
    const y = base + 0.3 + h;
    st.quadP(F(w / 2 + 0.5, y + y0, z0), F(-w / 2 - 0.5, y + y0, z0), F(-w / 2 - 0.5, y + y1, z1), F(w / 2 + 0.5, y + y1, z1));
  }
  // its end walls (lunettes), lit glazing
  for (const sx of [-1, 1]) {
    for (let k = 0; k < n; k++) {
      const a0 = Math.PI * k / n, a1 = Math.PI * (k + 1) / n;
      const y = base + 0.3 + h;
      const A = F(sx * w / 2, y, -Math.cos(a0) * (d / 2)), Bq = F(sx * w / 2, y + Math.sin(a0) * rise * 0.95, -Math.cos(a0) * (d / 2)), Cq = F(sx * w / 2, y + Math.sin(a1) * rise * 0.95, -Math.cos(a1) * (d / 2)), D = F(sx * w / 2, y, -Math.cos(a1) * (d / 2));
      col(gl, C('#ffe0a0', 1.2));
      if (sx > 0) gl.quadP(D, A, Bq, Cq); else gl.quadP(A, D, Cq, Bq);
    }
  }
  // the neon on the street side, awning, lamps
  const s = F(0, base + h - 0.6, d / 2 + 0.15);
  panel(sg, s[0], s[1], s[2], 9, 9 * 130 / 560, ry, uv.fish);
  col(st, C('#2a6a8a'));
  lbox(st, F, ry, 0, base + 3.2, d / 2 + 1.3, w - 4, 0.25, 2.6, {});
  col(gl, C('#ffe2b0', 2));
  for (let k = -2; k <= 2; k++) lbox(gl, F, ry, k * w / 6, base + 3.18, d / 2 + 2.2, 0.6, 0.05, 0.3, { top: false, bottom: true });
}

function harbourMaster(B, M, it, uv) {
  const { x, z, w, d, ry } = it;
  const F = frame(x, 0, z, ry);
  const hs = B.acc(M.house), st = B.acc(M.paint), gl = B.acc(M.glow), sg = B.acc(M.sign), cc = B.acc(M.conc);
  const base = it.y1, H = 11.5;
  col(cc, C('#8a877f'));
  box(cc, x, it.y0, z, w, base - it.y0 + 0.5, d, ry, { u: 4 });
  col(hs, C('#f4f2ea'));
  box(hs, x, base + 0.5, z, w, H, d, ry, { u: 10, v: 10, top: false });
  col(st, C('#2a4a3e'));
  hip(st, x, base + 0.5 + H, z, w, d, 3.2, ry, { over: 0.7 });
  // the signal tower: a square shaft, the clock, the lantern
  const tx = 12, tz = 3, TH = 24;
  col(hs, C('#f4f2ea'));
  lbox(hs, F, ry, tx, base + 0.5, tz, 6, TH, 6, { u: 10, v: 10 });
  col(st, C('#2a4a3e'));
  lbox(st, F, ry, tx, base + 0.5 + TH, tz, 7, 0.6, 7, {});
  col(gl, C('#ffe8b0', 1.6));
  lbox(gl, F, ry, tx, base + 1.1 + TH, tz, 4.4, 2.4, 4.4, { top: false });
  col(st, C('#2a4a3e'));
  coneC(st, ...F(tx, base + 3.5 + TH, tz), 3.4, 2.8, 4);
  // the signal mast with its yard and flags
  col(st, C('#e8e6de'));
  const m0 = F(-w / 2 - 6, base, -d / 2 - 4);
  st.beam(m0[0], m0[1], m0[2], m0[0], m0[1] + 18, m0[2], 0.3, 0.3);
  const ya = frame(m0[0], m0[1] + 14, m0[2], ry);
  const y0p = ya(-4, 0, 0), y1p = ya(4, 0, 0);
  st.beam(y0p[0], y0p[1], y0p[2], y1p[0], y1p[1], y1p[2], 0.18, 0.18);
  const mt = B.acc(M.matte);
  const flags = ['#d8261e', '#f2d02a', '#1d4f8f', '#f4f4ee', '#2a8a4a'];
  for (let k = 0; k < 5; k++) {
    const fx = -3.6 + k * 1.8;
    const fl = frame(...ya(fx, -0.2, 0), ry);
    col(mt, C(flags[k]));
    mt.quadP(fl(-0.6, -1.1, 0), fl(0.6, -1.1, 0), fl(0.6, 0, 0), fl(-0.6, 0, 0));
    mt.quadP(fl(0.6, -1.1, 0), fl(-0.6, -1.1, 0), fl(-0.6, 0, 0), fl(0.6, 0, 0));
  }
  // the name over the door (north, the road side)
  const s = F(-3, base + 8.6, -d / 2 - 0.08);
  panel(sg, s[0], s[1], s[2], 16, 16 * 90 / 620, ry + Math.PI, uv.master);
  col(gl, C('#ffd9a0', 2.2));
  const dl = F(-3, base + 4, -d / 2 - 0.4);
  gl.box(dl[0], dl[1], dl[2], 0.45, 0.45, 0.45);
}

function bunkerTank(B, M, it, uv) {
  const st = B.acc(M.paint), sg = B.acc(M.sign), gl = B.acc(M.glow);
  const { x, z, r, h, y0 } = it;
  col(st, C('#dcdcd6'));
  cylinder(st, x, y0 - 0.3, z, r, h + 0.3, 16);
  col(st, C('#a8261e'));
  cylinder(st, x, y0 + h * 0.62, z, r + 0.04, 1.4, 16);
  col(st, C('#c8c8c2'));
  coneC(st, x, y0 + h, z, r + 0.2, r * 0.18, 16);
  // the spiral stair (a straight run up the side here) and the rail round the top
  col(st, C('#5a5c5e'));
  const a0 = (it.n % 6), a1 = a0 + 1.3;
  const P0 = [x + Math.cos(a0) * (r + 0.6), y0, z + Math.sin(a0) * (r + 0.6)], P1 = [x + Math.cos(a1) * (r + 0.6), y0 + h, z + Math.sin(a1) * (r + 0.6)];
  st.beam(P0[0], P0[1], P0[2], P1[0], P1[1], P1[2], 0.9, 0.12);
  for (let k = 0; k < 16; k++) {
    const a = k / 16 * Math.PI * 2, b = (k + 1) / 16 * Math.PI * 2;
    st.beam(x + Math.cos(a) * r, y0 + h + 1.1, z + Math.sin(a) * r, x + Math.cos(b) * r, y0 + h + 1.1, z + Math.sin(b) * r, 0.06, 0.06);
  }
  // the company's name round the tank
  for (const a of [Math.PI / 2, -Math.PI / 2 + 0.4]) arcPanel(sg, x, y0 + h * 0.4, z, r + 0.08, a, r * 1.5, r * 1.5 * 90 / 520, uv.kestrel, 8);
  col(gl, C('#ff2a18', 3));
  gl.box(x, y0 + h + r * 0.18 + 0.4, z, 0.4, 0.4, 0.4);
}

function tug(B, M, it, uv) {
  tugBoat(B, M, it.x, it.z, it.ry, 0.85, uv.towage, M.sign);
}

// ------------------------------------------------------------------ the rail yard

function trackPiece(B, M, it) {
  const tr = B.acc(M.track);
  groundStrip(tr, B, it.pts, 3.2, 0.06, 6, 6.4);
  const rl = B.near(M.paint);
  col(rl, C('#9a968e'));
  for (const off of [-0.72, 0.72]) {
    const pts = it.pts;
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i], b = pts[i + 1];
      const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
      const lx = (b[1] - a[1]) / L * off, lz = -(b[0] - a[0]) / L * off;
      const n = Math.max(1, Math.ceil(L / 8));
      for (let k = 0; k < n; k++) {
        const t0 = k / n, t1 = (k + 1) / n;
        const x0 = a[0] + (b[0] - a[0]) * t0 + lx, z0 = a[1] + (b[1] - a[1]) * t0 + lz;
        const x1 = a[0] + (b[0] - a[0]) * t1 + lx, z1 = a[1] + (b[1] - a[1]) * t1 + lz;
        rl.beam(x0, B.groundY(x0, z0) + 0.2, z0, x1, B.groundY(x1, z1) + 0.2, z1, 0.08, 0.16);
      }
    }
  }
}

function trainPiece(B, M, it) {
  const rng = makeRng(seedOf(it));
  const st = B.acc(M.paint), gl = B.acc(M.glow), cont = B.acc(M.cont);
  const L = Math.hypot(it.bx - it.ax, it.bz - it.az);
  const tx = (it.bx - it.ax) / L, tz = (it.bz - it.az) / L;
  const ry = Math.atan2(-tz, tx);
  for (let c = it.c0; c < it.c1; c++) {
    const s = (c + 0.5) * 20.6;
    const x = it.ax + tx * s, z = it.az + tz * s;
    const y = B.groundY(x, z) + 0.2;
    const F = frame(x, y, z, ry);
    if (it.loco && c === it.c0) {
      // the locomotive: a long hood, the cab at the front end, lit
      col(st, C('#1d3557'));
      lbox(st, F, ry, 0, 1.2, 0, 20, 3.4, 2.9, {});
      col(st, C('#f2c230'));
      lbox(st, F, ry, 9.2, 1.2, 0, 1.6, 3.4, 3.0, {});
      col(st, C('#1d3557'));
      lbox(st, F, ry, 6.5, 4.6, 0, 4.4, 1.1, 3.0, {});
      col(st, C('#2a2a2a'));
      lbox(st, F, ry, 0, 0.2, 0, 20.4, 1.0, 2.6, {});
      for (const u of [-7, 7]) lbox(st, F, ry, u, 0, 0, 3.6, 0.9, 2.8, {});
      col(gl, C('#ffe6b0', 1.4));
      lbox(gl, F, ry, 6.5, 3.4, 0, 3.6, 0.9, 3.04, { top: false });
      col(gl, C('#ffffff', 4));
      const hl = F(10.05, 3.8, 0); gl.box(hl[0], hl[1], hl[2], 0.1, 0.4, 0.7, ry);
      continue;
    }
    // a well car: the frame, and one or two boxes (double-stacked)
    col(st, C('#5a4636'));
    lbox(st, F, ry, 0, 0.3, 0, 19.6, 0.9, 2.7, {});
    col(st, C('#2a2a2a'));
    for (const u of [-8, 8]) lbox(st, F, ry, u, 0, 0, 2.6, 0.7, 2.6, {});
    if (rng() < 0.08) continue;
    const L1 = randomBox(rng);
    container(cont, ...F(-0.2, 1.1, 0), ry, L1.row, L1.tint);
    if (rng() < 0.65) { const L2 = randomBox(rng); container(cont, ...F(0.2, 1.1 + CH, 0), ry, L2.row, L2.tint); }
  }
}

function rmgCrane(B, M, it) {
  const st = B.acc(M.paint), gl = B.acc(M.glow);
  const F = frame(it.x, it.y0, it.z, it.ry), ry = it.ry;
  const S = it.span / 2, H = 22;
  const blue = C('#2a5a9a'), white = C('#e2e0da');
  for (const w of [-S, S]) {
    col(st, C('#2a2a2a'));
    for (const u of [-4, 4]) lbox(st, F, ry, u, 0, w, 2.6, 1.2, 1.4, {});
    col(st, blue);
    lbox(st, F, ry, 0, 1.2, w, 9.6, 1.0, 1.2, {});
    for (const u of [-4, 4]) lbox(st, F, ry, u, 2.2, w, 1.0, H - 2.2, 1.0, {});
    lbeam(st, F, [-4, 3, w], [4, H - 1.5, w], 0.4);
  }
  // two box girders spanning the tracks, cantilevered out both sides
  col(st, white);
  for (const u of [-2.4, 2.4]) lbox(st, F, ry, u, H, 0, 1.2, 2.0, 2 * S + 16, {});
  col(st, blue);
  lbox(st, F, ry, 0, H + 2, 0, 6, 2.2, 5, {});
  col(st, C('#22252a'));
  lbox(st, F, ry, 3.4, H - 3, 2, 2, 2.4, 2, {});
  col(gl, C('#ffe6b0', 1.4));
  lbox(gl, F, ry, 4.42, H - 2.4, 2, 0.04, 1.1, 1.8, {});
  col(gl, C('#fff4dc', 3.2));
  for (const w of [-S, 0, S]) lbox(gl, F, ry, 0, H - 0.22, w, 1.2, 0.2, 0.8, { top: false, bottom: true });
  col(st, C('#e2b021'));
  lbox(st, F, ry, 0, 9, -3, 2.4, 0.5, 12.4, {});
}

function crossing(B, M, it, uv) {
  const st = B.acc(M.paint), bl = B.acc(M.blink), sg = B.acc(M.sign);
  const y = it.y0;
  const F = frame(it.x, y, it.z, it.ry);
  col(st, C('#e8e6de'));
  lbox(st, F, it.ry, 0, 0, 0, 0.2, 4.4, 0.2, {});
  col(st, C('#1a1a1a'));
  lbox(st, F, it.ry, 0, 3.2, 0.1, 1.6, 0.5, 0.15, {});
  // twin red lamps that blink, the crossbuck over them
  col(bl, C('#ff2a18', 4));
  for (const u of [-0.6, 0.6]) { const p = F(u, 3.45, 0.2); bl.box(p[0], p[1], p[2], 0.34, 0.34, 0.1); }
  for (const a of [Math.PI / 4, -Math.PI / 4]) {
    const c = F(0, 4.15, 0.12);
    const fr = frame(c[0], c[1], c[2], it.ry);
    const ca = Math.cos(a), sa = Math.sin(a);
    const P = (lx, ly) => fr(lx * ca - ly * sa, lx * sa + ly * ca, 0);
    sg.quadP(P(-1.4, -0.11), P(1.4, -0.11), P(1.4, 0.11), P(-1.4, 0.11), uv.xbuck);
  }
}


