// PORT HALCYON — DRY LAKE. A salt flat as white and as flat as a table, and
// on it the DRY LAKE STRIP: a quarter mile of asphalt under a row of stadium
// floodlight masts that turn the night white. At the line: a start gantry,
// the christmas tree (its lights running a staging sequence), burnout rubber
// and launch tyre marks in both lanes; the timing tower (its control room
// lit), aluminium bleachers with a crowd, sponsor-wrapped barriers; distance
// boards (60 FT to 1/4 MILE), the finish gantry and its ET/MPH boards. South
// of the strip the pits: pop-up tents, haulers and race cars, fuel trailers,
// tyre stacks, string lights. Donut marks on the salt; out on the north
// shore, the old speed-trials shack.
import { box, cylinder, cone, gable, drape } from './builder.js';
import { MAT, paint, paintMix, obox, panel, flat, hcyl, disc, clock, reachOf, hash1, TAU } from './desertkit/kit.js';
import { uvOf, RD } from './desertkit/tex.js';
import { car, drumBarrel, tyres, crate, stringLights, mast, beacon, animUV, floodlight } from './desertkit/props.js';
import { cellGround, seedOf, buildScatter, shrubs } from './desertkit/scatter.js';
import { local, setPiece, lampAt } from './desertkit/place.js';

const START = 60;                 // m along the strip from dl_a to the start line
const QUARTER = 402.3;            // the quarter mile
const TEAM = ['#d4231c', '#2a5ad2', '#f2f2ee', '#e8b030', '#3a8a4a', '#7a3ab0', '#f07a2a', '#1a1a1c'];

export default {
  id: 'drylake',

  plan(P) {
    const r = P.net.byId.get('dl_strip');
    if (r) strip(P, r);
    shack(P);
  },

  scatter(S) {
    const G = cellGround(S);
    // the salt is bare; at its shore (where the ground rises) a little saltbush and grass
    shrubs(S, 14, (x, z) => (G.h(x, z) > 64.6 ? 0.55 : 0.0), [[1, 3], [2, 2]], { tint: '#f0ece0', s: [0.5, 1.0] });
    for (const [x, z] of S.points(60, { r: 3, density: (x, z) => (G.h(x, z) > 65 ? 0.4 : 0) })) {
      const y = G.h(x, z), s = S.range(0.5, 1.5);
      S.add({ type: 'rock', x, z, y, s, seed: seedOf(S), color: '#a89a88' });
    }
    // donut marks and skids out on the salt
    for (const [x, z] of S.points(90, { r: 12, density: () => 0.18 })) {
      if (G.h(x, z) > 64.6) continue;
      S.add({ type: 'donut', x, z, y: G.h(x, z), r: S.range(4, 8), turns: S.rng() < 0.5 ? 2 : 1, seed: seedOf(S) });
    }
  },

  warm(B) {
    for (const k of ['paint', 'metal', 'rock', 'plant', 'foliage', 'drag', 'tin', 'stucco', 'drift', 'neon', 'glass', 'lights', 'lot', 'roadsigns']) MAT[k](B);
  },

  *build(B, items) {
    const tick = clock(3);
    for (const it of items) {
      if (buildScatter(B, it)) { if (tick()) yield; continue; }
      switch (it.type) {
        case 'flood': floodMast(B, it); break;
        case 'tower': timingTower(B, it); break;
        case 'bleach': bleachers(B, it); break;
        case 'gantry': gantry(B, it); break;
        case 'tree': xmasTree(B, it); break;
        case 'board': distBoard(B, it); break;
        case 'scores': scoreBoards(B, it); break;
        case 'wall': barrierWall(B, it); break;
        case 'marks': yield* tyreMarks(B, it); break;
        case 'pit': pitStall(B, it); break;
        case 'fuel': fuelTrailer(B, it); break;
        case 'parked': car(B, it.x, B.groundY(it.x, it.z), it.z, it.ry, { kind: it.kind, color: it.color }); break;
        case 'cones': cones(B, it); break;
        case 'donut': donut(B, it); break;
        case 'shack': speedShack(B, it); break;
        case 'johns': johns(B, it); break;
        default: break;
      }
      if (tick()) yield;
    }
  },
};

// ================================================================== planning

/** A point in the strip's frame: u along it from the start line, v across (+ to its left, the north side). */
function frameOf(r) {
  return (u, v) => {
    const p = r.posAt(START + u, v);
    return { x: p.x, z: p.z, i: p.i, ry: Math.atan2(r.TX[p.i], r.TZ[p.i]), y: r.Y[p.i] };
  };
}

function strip(P, r) {
  const F = frameOf(r);
  const W = r.rt.hw + r.rt.shoulder;          // to the edge of the paving (15)
  const ryAlong = F(0, 0).ry;                 // facing down the strip (east)
  // ---- the floodlight masts down both sides
  for (let u = -70; u <= 640; u += 105) {
    for (const v of [W + 18, -(W + 18)]) {
      const p = F(u + (v > 0 ? 0 : 52), v);
      if (!P.isFree(p.x, p.z, 4, 4, 0, { anywhere: true })) continue;
      const y = P.groundY(p.x, p.z);
      P.claim(p.x, p.z, 4, 4, 0);
      P.add({ type: 'flood', x: p.x, z: p.z, ry: p.ry + (v > 0 ? -Math.PI / 2 : Math.PI / 2), h: 26, map: 'building' });
      P.collider({ kind: 'box', x: p.x, z: p.z, hx: 1.4, hz: 1.4, ry: p.ry, y0: y - 1, y1: y + 26 });
      P.far({ shape: 'box', x: p.x, z: p.z, y, w: 1.4, d: 1.4, h: 26, ry: p.ry, color: '#8a8c8e' });
      P.far({ shape: 'box', x: p.x, z: p.z, y: y + 25, w: 5, d: 1.2, h: 2.6, ry: p.ry + Math.PI / 2, color: '#2a2c30' });
      // the light thrown on the strip and the salt
      const toward = v > 0 ? -1 : 1;
      const q = F(u + (v > 0 ? 0 : 52), v + toward * 14);
      P.lamp({ x: p.x, z: p.z, hx: q.x, hz: q.z, hy: y + 26, color: '#eef4ff', radius: 52, intensity: 1.15, halo: 4.6 });
    }
  }
  // ---- the start: the gantry over the line, the tree, the timing beams, rubber
  {
    const p = F(-2, 0);
    P.add({ type: 'gantry', x: p.x, z: p.z, ry: p.ry, span: W + 1.6, banner: 'banner', map: 'building' });
    for (const sd of [1, -1]) { const q = F(-2, sd * (W + 1.6)); P.collider({ kind: 'circle', x: q.x, z: q.z, r: 0.45, y0: p.y - 1, y1: p.y + 9 }); P.claim(q.x, q.z, 1.5, 1.5, 0); }
    P.far({ shape: 'box', x: p.x, z: p.z, y: p.y + 6.6, w: (W + 2) * 2, d: 0.6, h: 2.2, ry: p.ry + Math.PI / 2, color: '#141416' });
  }
  {
    const p = F(6, W - 1.2);
    P.add({ type: 'tree', x: p.x, z: p.z, ry: p.ry + Math.PI, y: p.y });
    P.collider({ kind: 'circle', x: p.x, z: p.z, r: 0.5, y0: p.y - 1, y1: p.y + 6 });
    P.lamp({ x: p.x, z: p.z, hx: p.x, hz: p.z, hy: p.y + 4.4, color: '#ffc040', radius: 8, intensity: 0.5, halo: 1.6 });
  }
  P.add({ type: 'marks', x: F(40, 0).x, z: F(40, 0).z, road: r.spec.id });
  // ---- the timing tower and the bleachers on the north side, sponsor walls along the edge
  {
    const p = F(8, W + 34);
    const st = { x: p.x, z: p.z, ry: p.ry - Math.PI / 2, w: 12, d: 12 };   // +z toward the strip (south)
    const y = setPiece(P, { type: 'tower', ...st, map: 'building' }, [{ x: 0, z: 0, w: 9, d: 9, h: 14 }],
      [{ shape: 'box', x: 0, z: 0, w: 8, d: 8, h: 9.5, color: '#d8d2c4', lit: 0.2 }, { shape: 'box', x: 0, z: 0, w: 9.6, d: 9.6, h: 3.2, dy: 9.6, color: '#2a3a48', lit: 0.8 }]);
    lampAt(P, st, y, 0, 6, 11, '#ffd8a0', 18, 0.7, 2.2);
    lampAt(P, st, y, 0, 6, 3, '#fff0d8', 10, 0.6, 1);
  }
  for (const [u0, len] of [[-60, 44], [-12, 44], [40, 36]]) {
    const p = F(u0 + len / 2, W + 20);
    const st = { x: p.x, z: p.z, ry: p.ry - Math.PI / 2, w: len, d: 9 };
    if (!P.isFree(st.x, st.z, st.w, st.d, st.ry, { anywhere: true })) continue;
    setPiece(P, { type: 'bleach', ...st, map: 'building' }, [{ x: 0, z: 0, w: len, d: 9, h: 5.5 }],
      [{ shape: 'box', x: 0, z: 0, w: len, d: 8, h: 5.2, color: '#a8acb0' }]);
  }
  for (const [u0, u1] of [[-55, 200]]) {
    for (const sd of [1, -1]) {
      for (let u = u0; u < u1; u += 6.2) {
        const p = F(u + 3, sd * (W + 1.2));
        P.add({ type: 'wall', x: p.x, z: p.z, ry: p.ry, y: p.y, side: sd, k: Math.round(u / 6.2) });
        P.claim(p.x, p.z, 6, 1.2, p.ry);
        P.collider({ kind: 'box', x: p.x, z: p.z, hx: 0.4, hz: 3.05, ry: p.ry, y0: p.y - 1, y1: p.y + 1.1 });
      }
    }
  }
  // ---- distance boards both sides, the finish gantry, the ET boards
  for (const [u, k] of [[18.3, 'd60'], [100.6, 'd330'], [201.2, 'd660'], [304.8, 'd1000'], [QUARTER, 'd1320']]) {
    for (const sd of [1, -1]) {
      const p = F(u, sd * (W + 6));
      if (!P.isFree(p.x, p.z, 3, 1, 0, { anywhere: true })) continue;
      P.claim(p.x, p.z, 3.4, 1.2, p.ry);
      P.add({ type: 'board', x: p.x, z: p.z, ry: p.ry + Math.PI, k });
      P.collider({ kind: 'box', x: p.x, z: p.z, hx: 1.7, hz: 0.4, ry: p.ry + Math.PI / 2, y0: p.y - 1, y1: p.y + 4 });
    }
  }
  {
    const p = F(QUARTER, 0);
    P.add({ type: 'gantry', x: p.x, z: p.z, ry: p.ry, span: W + 1.6, banner: 'finish', map: 'building' });
    for (const sd of [1, -1]) { const q = F(QUARTER, sd * (W + 1.6)); P.collider({ kind: 'circle', x: q.x, z: q.z, r: 0.45, y0: p.y - 1, y1: p.y + 9 }); P.claim(q.x, q.z, 1.5, 1.5, 0); }
    P.far({ shape: 'box', x: p.x, z: p.z, y: p.y + 6.6, w: (W + 2) * 2, d: 0.6, h: 2.2, ry: p.ry + Math.PI / 2, color: '#e8e8e8' });
    for (const sd of [1, -1]) {
      const q = F(QUARTER + 40, sd * (W + 10));
      if (!P.isFree(q.x, q.z, 8, 2, q.ry, { anywhere: true })) continue;
      P.claim(q.x, q.z, 8, 2, q.ry + Math.PI / 2);
      P.add({ type: 'scores', x: q.x, z: q.z, ry: q.ry + Math.PI, side: sd });
      P.collider({ kind: 'box', x: q.x, z: q.z, hx: 3.8, hz: 0.6, ry: q.ry + Math.PI / 2, y0: q.y - 1, y1: q.y + 9 });
      P.far({ shape: 'box', x: q.x, z: q.z, y: q.y + 4.8, w: 7.4, d: 0.5, h: 4, ry: q.ry + Math.PI / 2, color: '#121214', lit: 0.6 });
    }
  }
  // cones down both edges from the shutdown on
  P.add({ type: 'cones', x: F(QUARTER + 120, 0).x, z: F(QUARTER + 120, 0).z, road: r.spec.id, u0: QUARTER + 30, u1: r.length - START - 30, W });
  // ---- the pits on the south side: tents, haulers, race cars, fuel trailers, a parking field
  let k = 0;
  for (let u = -70; u < 330; u += 17) {
    const v = -(W + 24 + (k % 2) * 3);
    const p = F(u, v);
    const st = { x: p.x, z: p.z, ry: p.ry + Math.PI / 2, w: 14, d: 12 };   // +z toward the strip (north)
    k++;
    if (!P.isFree(st.x, st.z, st.w, st.d, st.ry, { anywhere: true })) continue;
    const y = setPiece(P, { type: 'pit', ...st, team: TEAM[k % TEAM.length], kind: k % 5, seed: k * 37 + 11, map: 'yard' },
      [{ x: -3, z: -3, w: 3.6, d: 8.5, h: 3.2 }, { x: 3.5, z: 1.5, w: 2.2, d: 4.8, h: 1.6 }],
      [{ shape: 'box', x: 1.5, z: 1.5, w: 6, d: 6, h: 3, color: TEAM[k % TEAM.length] }]);
    if (k % 2) lampAt(P, st, y, 1.5, 1.5, 2.6, '#ffe2b0', 10, 0.6, 0.9);
  }
  for (const u of [-40, 120, 260]) {
    const p = F(u, -(W + 44));
    const st = { x: p.x, z: p.z, ry: p.ry, w: 14, d: 4 };
    if (!P.isFree(st.x, st.z, st.w, st.d, st.ry, { anywhere: true })) continue;
    setPiece(P, { type: 'fuel', ...st, map: 'yard' }, [{ x: 0, z: 0, w: 13.5, d: 3, h: 3.6 }], [{ shape: 'cyl', x: 0, z: 0, r: 1.4, h: 3.4, color: '#e8e4da' }]);
  }
  {
    const p = F(-80, -(W + 20));
    const st = { x: p.x, z: p.z, ry: p.ry, w: 8, d: 2 };
    if (P.isFree(st.x, st.z, st.w, st.d, st.ry, { anywhere: true })) setPiece(P, { type: 'johns', ...st }, [{ x: 0, z: 0, w: 8, d: 1.6, h: 2.4 }]);
  }
  // the spectators' cars parked in rows out on the salt, north of the bleachers
  for (let row = 0; row < 3; row++) {
    for (let c = 0; c < 22; c++) {
      if (hash1(row, c, 5) < 0.3) continue;
      const p = F(-80 + c * 3.4, W + 52 + row * 8);
      if (!P.isFree(p.x, p.z, 2.2, 5, p.ry, { anywhere: true })) continue;
      const y = P.groundY(p.x, p.z);
      P.claim(p.x, p.z, 2.2, 5, p.ry);
      P.add({ type: 'parked', x: p.x, z: p.z, ry: p.ry + Math.PI / 2 + (row % 2 ? Math.PI : 0), kind: hash1(row, c, 6) < 0.3 ? 'pickup' : hash1(row, c, 7) < 0.2 ? 'van' : 'sedan', color: TEAM[Math.floor(hash1(row, c, 8) * TEAM.length)] });
      P.collider({ kind: 'box', x: p.x, z: p.z, hx: 1.0, hz: 2.4, ry: p.ry + Math.PI / 2, y0: y - 1, y1: y + 1.6 });
    }
  }
  const p0 = F(0, 0);
  P.landmark({ id: 'drylake_strip', name: 'DRY LAKE STRIP', x: p0.x, z: p0.z, r: 220, kind: 'strip' });
  void ryAlong;
}

/** The old speed-trials shack on the lakebed's north shore. */
function shack(P) {
  const r = P.net.byId.get('dl_n1');
  if (!r) return;
  const p = r.posAt(r.length - 40, -14);
  const st = { x: p.x, z: p.z, ry: Math.atan2(r.LX[p.i], r.LZ[p.i]), w: 14, d: 10 };
  if (!P.isFree(st.x, st.z, st.w, st.d, st.ry, { anywhere: true })) return;
  const y = setPiece(P, { type: 'shack', ...st, map: 'building' }, [{ x: -2, z: -1, w: 6.4, d: 4.6, h: 3.6 }],
    [{ shape: 'box', x: -2, z: -1, w: 6, d: 4.2, h: 3.4, color: '#8a7a68' }]);
  void y;
}

// ================================================================== building

function floodMast(B, it) {
  const { x, z, ry, h } = it;
  const y = B.groundY(x, z);
  const acc = B.acc(MAT.paint(B));
  paint(acc, '#9a9ca0');
  mast(acc, x, y - 0.3, z, h, 1.6, 0.55);
  paint(acc, '#6a6c70');
  box(acc, x, y - 0.4, z, 2.4, 0.6, 2.4, ry);
  // the head: a frame of six lamps aimed down at the strip
  const c = Math.cos(ry), s = Math.sin(ry);
  paint(acc, '#2a2c30');
  box(acc, x, y + h - 0.2, z, 5.2, 2.8, 0.5, ry);
  const g = B.acc(MAT.neon(B));
  paint(g, '#f4f8ff');
  for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) {
    const lx = -1.7 + i * 1.7, ly = 0.4 + j * 1.25;
    box(g, x + c * lx + s * 0.28, y + h - 0.2 + ly, z - s * lx + c * 0.28, 1.4, 1.0, 0.06, ry);
  }
  // a ladder, a beacon on top
  acc.beam(x + 0.7, y, z + 0.7, x + 0.45, y + h - 0.5, z + 0.45, 0.05, 0.4);
  beacon(B, x, y + h + 3.0, z, hash1(Math.round(x), Math.round(z)), 0.3);
}

function timingTower(B, it) {
  const { x, z, ry } = it;
  const c = Math.cos(ry), s = Math.sin(ry);
  const at = (lx, lz) => [x + lx * c + lz * s, z - lx * s + lz * c];
  const g = B.footY(x, z, 9, 9, ry);
  const y = g.hi;
  const st = B.acc(MAT.stucco(B)), pa = B.acc(MAT.paint(B)), dg = B.acc(MAT.drag(B)), metal = B.acc(MAT.metal(B));
  // two storeys of block, the glass control room on top, a red roof slab, an antenna
  paint(st, '#d8d2c4');
  box(st, x, g.lo - 0.4, z, 8, y - g.lo + 9.4, 8, ry, { u: 4 });
  paint(pa, '#2a3a48');
  box(pa, x, y + 9.0, z, 9.6, 3.4, 9.6, ry);
  for (let k = 0; k < 4; k++) {
    const a = ry + k * Math.PI / 2;
    const ca = Math.cos(a), sa = Math.sin(a);
    panel(dg, x + sa * 4.82, y + 9.2, z + ca * 4.82, a, 9.2, 2.9, uvOf(RD.towerWin));
  }
  paint(pa, '#9e2a22');
  box(pa, x, y + 12.4, z, 10.6, 0.4, 10.6, ry);
  paint(metal, '#c8ccd0');
  cylinder(metal, x + 3.5, y + 12.8, z - 3.5, 0.06, 7, 4);
  beacon(B, x + 3.5, y + 19.8, z - 3.5, 0.5, 0.3);
  // its sign on the strip side, the stair up the side, the door
  const [sx, sz] = at(0, 4.03);
  panel(dg, sx, y + 6.4, sz, ry, 7.6, 1.9, uvOf(RD.towerSign));
  paint(metal, '#a8acb0');
  for (let k = 0; k < 12; k++) { const [px, pz] = at(-4.6, -3.5 + k * 0.6); box(metal, px, y + k * 0.75, pz, 1.2, 0.08, 0.5, ry); }
  const [dx, dz] = at(1.5, 4.02);
  paint(pa, '#3a3a3c');
  panel(pa, dx, y, dz, ry, 1.1, 2.2);
  // sponsor banners on the walls
  const [bx, bz] = at(-4.03, 0);
  panel(dg, bx, y + 2.6, bz, ry - Math.PI / 2, 6.4, 2.1, uvOf(RD.sponsorA));
  const [b2x, b2z] = at(4.03, 0);
  panel(dg, b2x, y + 2.6, b2z, ry + Math.PI / 2, 6.4, 2.1, uvOf(RD.sponsorB));
}

function bleachers(B, it) {
  const { x, z, ry, w } = it;
  const c = Math.cos(ry), s = Math.sin(ry);
  const at = (lx, lz) => [x + lx * c + lz * s, z - lx * s + lz * c];
  const y = B.groundY(x, z);
  const metal = B.acc(MAT.metal(B)), pa = B.acc(MAT.paint(B));
  // eight rows stepping up away from the strip (+z faces the strip)
  for (let r = 0; r < 8; r++) {
    const lz = 3.6 - r * 0.95, h = 0.5 + r * 0.6;
    const [px, pz] = at(0, lz);
    paint(metal, '#b8bcc0');
    box(metal, px, y + h - 0.08, pz, w, 0.08, 0.5, ry);
    paint(metal, '#9a9ea2');
    box(metal, px, y + h - 0.5, pz + 0, w, 0.06, 0.3, ry);
  }
  // the frame underneath, a back rail
  paint(pa, '#6a6e72');
  for (let k = 0; k <= Math.round(w / 4); k++) {
    const lx = -w / 2 + k * (w / Math.round(w / 4));
    for (const lz of [3.6, -3.05]) { const [px, pz] = at(lx, lz); const hh = lz > 0 ? 0.5 : 0.5 + 7 * 0.6; box(pa, px, y - 0.2, pz, 0.1, hh + 0.2, 0.1, ry); }
    const [ax, az] = at(lx, 3.6), [bx, bz] = at(lx, -3.05);
    pa.beam(ax, y + 0.4, az, bx, y + 4.6, bz, 0.08, 0.08);
  }
  const [rx, rz] = at(0, -3.1);
  paint(metal, '#c8ccd0');
  box(metal, rx, y + 5.1, rz, w, 0.06, 0.06, ry);
  // a solid back (sponsor-wrapped) and ends
  const [kx, kz] = at(0, -3.35);
  const tn = B.acc(MAT.tin(B));
  paint(tn, '#b8bcc0');
  box(tn, kx, y - 0.2, kz, w + 0.2, 5.4, 0.08, ry, { u: 4 });
  for (const sd of [1, -1]) { const [ex, ez] = at(sd * (w / 2 + 0.05), 0.2); tn.quadP(...endTri(ex, ez, y, ry, sd)); }
  const dg = B.acc(MAT.drag(B));
  for (let k = 0; k < Math.floor(w / 9); k++) { const [px, pz] = at(-w / 2 + 4.5 + k * 9, -3.4); panel(dg, px, y + 2.2, pz, ry + Math.PI, 8.4, 2.1, uvOf(k % 2 ? RD.sponsorA : RD.sponsorB)); }
  // the crowd: torsos and heads in their shirts, sparse
  const crowd = B.near(MAT.paint(B));
  for (let r = 0; r < 8; r++) {
    for (let k = 0; k < w / 0.7; k++) {
      if (hash1(it.n, r, k) < 0.66) continue;
      const lx = -w / 2 + 0.4 + k * 0.7 + (hash1(it.n, r, k + 1) - 0.5) * 0.2, lz = 3.6 - r * 0.95 - 0.1;
      const [px, pz] = at(lx, lz);
      const py = y + 0.5 + r * 0.6;
      paint(crowd, TEAM[Math.floor(hash1(it.n, k, r + 2) * TEAM.length)]);
      box(crowd, px, py, pz, 0.42, 0.62, 0.26, ry);
      paint(crowd, hash1(it.n, k, r) < 0.5 ? '#c08a68' : '#7a5a40');
      box(crowd, px, py + 0.64, pz, 0.2, 0.22, 0.2, ry);
    }
  }
}

/** A bleacher's end: a quad from the low front to the high back (the stepped side seen end-on). */
function endTri(x, z, y, ry, sd) {
  const c = Math.cos(ry), s = Math.sin(ry);
  const P = (lz, h) => [x + lz * s, y + h, z + lz * c];
  return sd > 0 ? [P(3.9, -0.2), P(-3.35, -0.2), P(-3.35, 5.2), P(3.9, 0.6)] : [P(-3.35, -0.2), P(3.9, -0.2), P(3.9, 0.6), P(-3.35, 5.2)];
}

function gantry(B, it) {
  const { x, z, ry, span } = it;
  const c = Math.cos(ry), s = Math.sin(ry);
  const y = B.groundY(x, z);
  const pa = B.acc(MAT.paint(B)), dg = B.acc(MAT.drag(B));
  // posts either side (across the strip: local x of ry is ... the strip runs along local z)
  const lx = Math.cos(ry), lz = -Math.sin(ry);   // local x (across the strip)
  paint(pa, '#5a5d61');
  for (const sd of [1, -1]) box(pa, x + lx * sd * span, y - 0.4, z + lz * sd * span, 0.6, 9.2, 0.6, ry);
  box(pa, x, y + 8.6, z, span * 2 + 0.8, 0.5, 0.5, ry);
  const wbn = span * 2 - 2;
  const r = it.banner === 'finish' ? RD.finish : RD.banner;
  panel(dg, x - s * 0.3, y + 5.8, z - c * 0.3, ry + Math.PI, wbn, wbn / 8, uvOf(r));
  panel(dg, x - s * 0.25, y + 5.8, z - c * 0.25, ry, wbn, wbn / 8, uvOf(r));
  // a row of lamps along the beam (lighting the line)
  const g = B.acc(MAT.neon(B));
  paint(g, '#fff8e8');
  for (let k = -3; k <= 3; k++) box(g, x + lx * k * span / 3.5, y + 8.45, z + lz * k * span / 3.5, 0.6, 0.1, 0.35, ry);
  // the timing beams at the line (red eyes on white posts)
  if (it.banner !== 'finish') {
    const nr = B.near(MAT.paint(B));
    for (const sd of [1, -1]) {
      for (const k of [0, 6]) {
        const px = x + lx * sd * (span - 1.2) + s * (2 + k), pz = z + lz * sd * (span - 1.2) + c * (2 + k);
        paint(nr, '#e8e6e0'); box(nr, px, y, pz, 0.25, 0.9, 0.25, ry);
        paint(nr, '#d4231c'); box(nr, px, y + 0.6, pz, 0.18, 0.12, 0.3, ry);
      }
    }
    // the start line itself, painted across the strip
    const la = B.acc(MAT.lot(B));
    paint(la, '#f4f2ea');
    flat(la, x + s * 2, B.groundY(x + s * 2, z + c * 2) + 0.16, z + c * 2, span * 2 - 2, 0.35, ry);
  } else {
    const la = B.acc(MAT.lot(B));
    paint(la, '#f4f2ea');
    flat(la, x, B.groundY(x, z) + 0.16, z, span * 2 - 2, 0.5, ry);
  }
}

/** The christmas tree: a post, a black face with the staging and amber lights, green and red. Runs its sequence. */
function xmasTree(B, it) {
  const { x, z, ry } = it;
  const y = B.groundY(x, z);
  const c = Math.cos(ry), s = Math.sin(ry);
  const pa = B.acc(MAT.paint(B)), dg = B.acc(MAT.drag(B)), L = B.acc(MAT.lights(B));
  paint(pa, '#9a9a96');
  box(pa, x, y - 0.2, z, 0.9, 0.5, 0.9, ry);
  paint(pa, '#2a2a2c');
  box(pa, x, y + 0.3, z, 0.18, 2.6, 0.18, ry);
  paint(pa, '#141416');
  box(pa, x, y + 2.8, z, 1.1, 3.4, 0.45, ry);
  panel(dg, x + s * 0.235, y + 2.85, z + c * 0.235, ry, 1.0, 3.3, uvOf(RD.tree));
  // the lights: two columns. (phase.x: on from fract(x) to floor(x)/100 of an 8 s cycle; mode 100.125)
  const rows = [
    [3.0, '#ffe8a0', 0.05, 99], [2.75, '#ffe8a0', 0.15, 99],
    [2.3, '#ffa020', 0.50, 62], [1.9, '#ffa020', 0.56, 62], [1.5, '#ffa020', 0.62, 62],
    [1.05, '#3aff6a', 0.64, 92], [0.65, '#ff2a1a', 0.93, 99],
  ];
  for (const [h, col, a, b] of rows) {
    for (const sd of [-1, 1]) {
      const k0 = L.count;
      paint(L, col);
      const px = x + c * sd * 0.24 + s * 0.27, pz = z - s * sd * 0.24 + c * 0.27;
      box(L, px, y + 2.8 + h - 0.12, pz, 0.26, 0.24, 0.06, ry);
      animUV(L, k0, b + a, 100.125);
    }
  }
}

function distBoard(B, it) {
  const { x, z, ry } = it;
  const y = B.groundY(x, z);
  const c = Math.cos(ry), s = Math.sin(ry);
  const pa = B.acc(MAT.paint(B));
  paint(pa, '#3c3e41');
  for (const k of [-1.2, 1.2]) box(pa, x + c * k, y - 0.3, z - s * k, 0.16, 3.2, 0.16, ry);
  paint(pa, '#141416');
  box(pa, x - s * 0.06, y + 1.4, z - c * 0.06, 3.4, 1.8, 0.1, ry);
  panel(B.acc(MAT.drag(B)), x, y + 1.45, z, ry, 3.2, 1.6, uvOf(RD[it.k]));
}

function scoreBoards(B, it) {
  const { x, z, ry } = it;
  const y = B.groundY(x, z);
  const c = Math.cos(ry), s = Math.sin(ry);
  const pa = B.acc(MAT.paint(B));
  paint(pa, '#3c3e41');
  for (const k of [-2.6, 2.6]) box(pa, x + c * k, y - 0.3, z - s * k, 0.3, 7, 0.3, ry);
  paint(pa, '#121214');
  box(pa, x - s * 0.15, y + 4.6, z - c * 0.15, 7.6, 4.2, 0.3, ry);
  panel(B.acc(MAT.drag(B)), x + s * 0.01, y + 4.75, z + c * 0.01, ry, 7.2, 3.6, uvOf(it.side > 0 ? RD.boardL : RD.boardR));
}

function barrierWall(B, it) {
  const { x, z, ry, side, k } = it;
  const y = B.groundY(x, z);
  const st = B.acc(MAT.stucco(B));
  // a concrete jersey section, its strip-side face wrapped in a sponsor banner
  paint(st, '#c8c4bc');
  box(st, x, y - 0.1, z, 0.6, 0.35, 6.1, ry, { u: 4 });
  box(st, x, y + 0.25, z, 0.35, 0.85, 6.1, ry, { u: 4 });
  const fx = Math.cos(ry) * -side, fz = -Math.sin(ry) * -side;  // toward the strip
  const ra = Math.atan2(fx, fz);
  const r = k % 3 === 0 ? RD.sponsorA : k % 3 === 1 ? RD.wall : RD.sponsorB;
  panel(B.acc(MAT.drag(B)), x + fx * 0.19, y + 0.2, z + fz * 0.19, ra, 5.9, 0.9, uvOf(r));
}

/** Rubber: burnout patches behind the line, launch marks fading down both lanes. */
function* tyreMarks(B, it) {
  const r = B.net.byId.get(it.road);
  if (!r) return;
  const acc = B.acc(MAT.drift(B));
  const lane = r.rt.hw * 0.5;
  const strip = (u0, u1, v, w, dark) => {
    const n = Math.max(2, Math.round((u1 - u0) / 3));
    const base = acc.count;
    for (let k = 0; k <= n; k++) {
      const u = u0 + (k / n) * (u1 - u0);
      const p = r.posAt(START + u, 0), i = p.i;
      acc.col = [0.02, 0.02, 0.02];
      for (const [lat, uu] of [[v - w / 2, 0], [v + w / 2, 1]]) acc.v(p.x + r.LX[i] * lat, r.roadY(i, p.t, lat) + 0.03, p.z + r.LZ[i] * lat, uu, 0.1 + 0.8 * (k / n) * (1 - dark) + dark * 0.1);
    }
    for (let k = 0; k < n; k++) { const q = base + k * 2; acc.tri(q, q + 2, q + 1); acc.tri(q + 1, q + 2, q + 3); }
  };
  for (const sd of [1, -1]) {
    const v0 = sd * lane;
    strip(-34, -6, v0, 3.4, 0);
    for (const t of [-0.85, 0.85]) { strip(-2, 70, v0 + t, 0.55, 0); strip(-2, 160, v0 + t, 0.45, 0.3); }
  }
  yield;
}

function pitStall(B, it) {
  const { x, z, ry, team, kind, seed } = it;
  const c = Math.cos(ry), s = Math.sin(ry);
  const at = (lx, lz) => [x + lx * c + lz * s, z - lx * s + lz * c];
  const y = B.groundY(x, z);
  const pa = B.acc(MAT.paint(B)), nr = B.near(MAT.paint(B)), dg = B.acc(MAT.drag(B));
  // the hauler or the pickup and trailer, parked at the back
  const [hx, hz] = at(-3, -3);
  if (kind % 2) {
    paint(pa, team);
    box(pa, hx, y + 1.0, hz, 2.5, 3.0, 7.5, ry);
    paint(pa, '#e8e4da');
    box(pa, hx, y + 1.9, hz, 2.52, 0.4, 7.4, ry);
    paint(pa, '#1a1a1a');
    for (const lz of [-2.2, -1.2]) for (const sd of [-1, 1]) { const [wx, wz] = at(-3 + sd * 1.0, -3 + lz); hcyl(pa, wx, y + 0.45, wz, 0.45, 0.35, ry, 8, true); }
  } else {
    car(B, hx, y, hz, ry, { kind: 'pickup', color: team, near: false });
    const [tx, tz] = at(-3, -9);
    paint(pa, '#3c3e41'); box(pa, tx, y + 0.5, tz, 2.2, 0.2, 5, ry);
  }
  // the pop-up canopy over the race car
  const [cx, cz] = at(1.5, 1.5);
  paint(pa, '#cfcfcf');
  for (const [a, b] of [[-2.9, -2.9], [2.9, -2.9], [2.9, 2.9], [-2.9, 2.9]]) { const [px, pz] = at(1.5 + a, 1.5 + b); box(pa, px, y, pz, 0.07, 2.5, 0.07, ry); }
  paint(pa, team);
  box(pa, cx, y + 2.5, cz, 6.2, 0.2, 6.2, ry);
  cone(pa, cx, y + 2.7, cz, 4.3, 0.7, 4);
  if (hash1(seed, 1) < 0.5) { const [px, pz] = at(1.5, 4.62); panel(dg, px, y + 2.1, pz, ry, 6.0, 0.6, uvOf(RD.tent)); }
  // the race car under it (a dragster or a door car), tyres, tools, a cart
  const [rx, rz] = at(1.5, 1.5);
  if (kind === 2) {
    // a rail dragster: long and thin, big tyres at the back
    paint(nr, team);
    obox(nr, rx, y + 0.35, rz, 0.8, 0.5, 6.4, ry + Math.PI / 2, 0, 0);
    paint(nr, '#141414');
    const [bx, bz] = at(1.5 - 2.6, 1.5);
    hcyl(nr, bx + s * 0.9, y + 0.6, bz + c * 0.9, 0.6, 0.6, ry + Math.PI / 2 + Math.PI / 2, 10, true);
    hcyl(nr, bx - s * 0.9, y + 0.6, bz - c * 0.9, 0.6, 0.6, ry + Math.PI, 10, true);
  } else {
    car(B, rx, y, rz, ry + Math.PI / 2, { kind: kind === 4 ? 'coupe' : 'sedan', color: team, fins: false });
  }
  tyres(nr, ...at(4, -2).flatMap((v, i) => (i === 0 ? [v, y] : [v])), 4);
  const [tx2, tz2] = at(5, -4);
  paint(nr, '#c8322a'); box(nr, tx2, y, tz2, 1.1, 1.0, 0.6, ry);
  const [dx, dz] = at(-1, 5);
  drumBarrel(nr, dx, y, dz, '#2f5a8a');
  // string lights along the front of the stall
  if (hash1(seed, 2) < 0.7) {
    const [ax, az] = at(-5, 4.6), [bx2, bz2] = at(5, 4.6);
    stringLights(B, [ax, y + 2.6, az], [bx2, y + 2.6, bz2], 0.3, 0.9, ['#ffcf7a', '#ff6a6a', '#7affb0', '#7ab4ff']);
  }
}

function fuelTrailer(B, it) {
  const { x, z, ry } = it;
  const y = B.groundY(x, z);
  const metal = B.acc(MAT.metal(B)), pa = B.acc(MAT.paint(B));
  paint(metal, '#e8e4da');
  hcyl(metal, x, y + 1.9, z, 1.35, 11, ry + Math.PI / 2 * 0, 14, true);
  paint(pa, '#d4231c');
  const c = Math.cos(ry), s = Math.sin(ry);
  for (const k of [-3, 0, 3]) cylinder(pa, x + c * k, y + 1.9 - 1.38, z - s * k, 1.39, 0.25, 14, { top: false });
  paint(pa, '#3c3e41');
  box(pa, x, y + 0.45, z, 11.6, 0.2, 2.2, ry);
  paint(pa, '#141414');
  for (const k of [3.5, 4.6]) for (const sd of [-1, 1]) hcyl(pa, x + c * k + s * sd * 0.95, y + 0.45, z - s * k + c * sd * 0.95, 0.45, 0.35, ry + Math.PI / 2, 8, true);
  // the cab of the tractor in front
  paint(pa, '#2a5ad2');
  box(pa, x - c * 7.2, y + 0.6, z + s * 7.2, 3.0, 2.6, 2.4, ry);
}

function cones(B, it) {
  const r = B.net.byId.get(it.road);
  if (!r) return;
  const nr = B.near(MAT.paint(B));
  for (let u = it.u0; u < it.u1; u += 12) {
    for (const sd of [1, -1]) {
      const p = r.posAt(START + u, sd * (it.W + 0.8));
      if (Math.floor(p.x / 256) !== B.cx || Math.floor(p.z / 256) !== B.cz) continue;
      const y = r.Y[p.i];
      paint(nr, '#f25a12'); cylinder(nr, p.x, y, p.z, 0.17, 0.62, 8, { r2: 0.03 });
      paint(nr, '#f2f2ee'); cylinder(nr, p.x, y + 0.28, p.z, 0.12, 0.12, 8, { r2: 0.095 });
    }
  }
}

function donut(B, it) {
  const acc = B.acc(MAT.drift(B));
  acc.col = [0.03, 0.03, 0.03];
  const n = 26 * it.turns;
  const base = acc.count;
  for (let k = 0; k <= n; k++) {
    const a = (k / 26) * TAU + hash1(it.seed, 1);
    const rr = it.r * (1 + (k / n) * 0.25 * (it.turns - 1)) + Math.sin(a * 3 + it.seed) * 0.4;
    for (const [d, u] of [[-0.35, 0], [0.35, 1]]) acc.v(it.x + Math.cos(a) * (rr + d), it.y + 0.04, it.z + Math.sin(a) * (rr + d), u, 0.2 + 0.6 * (k / n));
  }
  for (let k = 0; k < n; k++) { const q = base + k * 2; acc.tri(q, q + 2, q + 1); acc.tri(q + 1, q + 2, q + 3); }
}

function speedShack(B, it) {
  const c = Math.cos(it.ry), s = Math.sin(it.ry);
  const at = (lx, lz) => [it.x + lx * c + lz * s, it.z - lx * s + lz * c];
  const [sx, sz] = at(-2, -1);
  const g = B.footY(sx, sz, 6, 4.2, it.ry);
  const tin = B.acc(MAT.tin(B)), pa = B.acc(MAT.paint(B));
  paintMix(tin, '#9a948a', '#8a5a3a', 0.5);
  box(tin, sx, g.lo - 0.3, sz, 6, g.hi - g.lo + 3.0, 4.2, it.ry, { u: 4 });
  paint(tin, '#7a5a40');
  obox(tin, sx, g.hi + 2.8, sz, 6.6, 0.1, 4.8, it.ry, -0.12, 0);
  // the timing stand: a platform on stilts, a wind sock, a painted board
  const [px, pz] = at(4, 1);
  paint(pa, '#7a6a58');
  for (const [a, b] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) { const [qx, qz] = at(4 + a, 1 + b); box(pa, qx, g.lo, qz, 0.15, 3.2, 0.15, it.ry); }
  box(pa, px, g.lo + 3.2, pz, 2.6, 0.15, 2.6, it.ry);
  paint(pa, '#d8d4c8');
  cylinder(pa, px + 2, g.lo, pz, 0.05, 6, 4);
  paint(pa, '#f07a2a');
  hcyl(pa, px + 2.6, g.lo + 5.8, pz, 0.25, 1.2, it.ry + 0.4, 6, false);
  const [bx, bz] = at(-2, 1.12);
  panel(B.acc(MAT.drag(B)), bx, g.hi + 1.2, bz, it.ry, 4, 1.0, uvOf(RD.wall));
  void disc; void gable; void drape; void crate; void floodlight; void reachOf;
}

function johns(B, it) {
  const c = Math.cos(it.ry), s = Math.sin(it.ry);
  const pa = B.near(MAT.paint(B));
  for (let k = 0; k < 5; k++) {
    const lx = -3.2 + k * 1.6;
    const px = it.x + lx * c, pz = it.z - lx * s;
    const py = B.groundY(px, pz);
    paint(pa, '#2f6ab0'); box(pa, px, py, pz, 1.3, 2.3, 1.3, it.ry);
    paint(pa, '#e8e8e8'); box(pa, px, py + 2.3, pz, 1.35, 0.15, 1.35, it.ry);
  }
}
