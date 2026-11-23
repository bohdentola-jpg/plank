// Holy Transfiguration — Russian Orthodox church (founded with the town, 1822):
// white clapboard nave, bell tower over the entrance with an open belfry and
// bells (a platform you can climb to), a central drum with a big onion dome,
// an apse with a small one, three-bar gold crosses. State: tarnished/peeling
// (0) → gilded main dome, fresh blue domes with gold stars (1).
// Interior: narthex with the ladder up the tower, nave with an iconostasis,
// candle stands, horos chandelier, analogion and benches.
import * as THREE from 'three';
import {
  makeCtx, finish, walls, roofGable, roofHip, sideFrame, wallFace, porchLight, steps, railing, icicles,
  weather, rgb, LIGHT, PI, HALF_PI, windowCond,
} from './common.js';
import { orthodoxCross } from '../props.js';
import { getSignMaterial } from '../materials.js';
import { floor, ceiling, wallColliders, bench, ladder, rug, partition } from './furniture.js';

const HP = HALF_PI;

/** Onion dome (lathe) at (x, y, z) with radius R and height H; returns the top y. */
export function onionDome(ctx, x, y, z, R, H, o = {}) {
  const b = ctx.b;
  const prof = [[0.8, 0], [0.93, 0.07], [1.0, 0.2], [0.99, 0.32], [0.9, 0.47], [0.72, 0.61], [0.48, 0.73], [0.27, 0.83], [0.13, 0.91], [0.06, 0.97], [0.035, 1.0]].map(([r, h]) => [r * R, h * H]);
  b.lathe(o.key || 'sheet_metal', x, y, z, prof, { segs: o.segs || 20, color: o.color || '#2b5d9b' });
  // neck ring at the base
  b.cyl(o.ringKey || 'sheet_metal', x, y - 0.12, z, R * 0.84, 0.16, { segs: o.segs || 20, color: o.ringColor || '#e8e4dc' });
  // gold stars painted on a blue dome
  if (o.stars) {
    const n = o.stars;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * PI * 2 + (i % 2) * 0.3;
      const t = 0.18 + (i % 3) * 0.14;
      const j = Math.floor(t * 10);
      const r = R * (prof[j][0] / R * (1 - (t * 10 - j)) + prof[j + 1][0] / R * (t * 10 - j)) + 0.015;
      b.sphere('gold', x + Math.sin(a) * r, y + t * H, z + Math.cos(a) * r, R * 0.05, { rings: 3, segs: 5, color: '#ffd27a' });
    }
  }
  // ball + cross
  const top = y + H;
  b.sphere(o.crossKey || 'gold', x, top + 0.08, z, R * 0.09, { rings: 5, segs: 10, color: o.crossColor || '#ffcf73' });
  b.push().translate(x, top + 0.12, z).rotateY(o.crossRot || 0);
  orthodoxCross(b, o.crossKey || 'gold', o.crossH || R * 1.1, o.crossColor || '#ffcf73', { t: (o.crossH || R * 1.1) * 0.055 });
  b.pop();
  return top + (o.crossH || R * 1.1);
}

/** Bronze bell hanging from (x, yTop, z), mouth radius r. */
function bell(ctx, x, yTop, z, r, color = '#8a6a3a') {
  const b = ctx.b;
  const h = r * 2.1;
  const prof = [[1.0, 0], [0.97, 0.04], [0.84, 0.1], [0.68, 0.24], [0.62, 0.46], [0.6, 0.66], [0.52, 0.84], [0.34, 0.96], [0.0, 1.0]].map(([rr, hh]) => [rr * r, hh * h]);
  b.lathe('gold_dull', x, yTop - h, z, prof, { segs: 14, color });
  // inside (dark) so the open mouth doesn't show through
  b.lathe('gold_dull', x, yTop - h + 0.01, z, prof.slice(0, 7).map(([rr, hh]) => [rr * 0.9, hh]).reverse(), { segs: 14, color: '#2a2016' });
  b.cyl('metal', x, yTop - h * 0.35 - 0.1, z, r * 0.12, h * 0.35, { segs: 6, color: '#2a2016' }); // clapper
  b.cyl('metal', x, yTop - 0.05, z, r * 0.15, 0.12, { segs: 8, color: '#3a3a3a' }); // crown
}

/** Arched-head window: rectangular hole incl. the arch, spandrels in siding, arch trim. */
function archedWindow(ctx, op, wall, sideKey, sideColor) {
  const b = ctx.b;
  const r = op.w / 2;
  const yS = op.y + op.h; // spring line
  const uc = op.u;
  const segs = 8;
  // spandrels (corner minus quarter disc), fan from each top corner
  for (const s of [-1, 1]) {
    const corner = [uc + s * r, yS + r, 0.001];
    for (let i = 0; i < segs; i++) {
      const a0 = (i / segs) * HP, a1 = ((i + 1) / segs) * HP;
      const p0 = [uc + s * Math.cos(a0) * r, yS + Math.sin(a0) * r, 0.001];
      const p1 = [uc + s * Math.cos(a1) * r, yS + Math.sin(a1) * r, 0.001];
      b.poly(sideKey, [corner, p0, p1], { color: sideColor, want: [0, 0, 1] });
      // reveal inside the arch
      const rec = wall.recess ?? 0.08;
      b.poly('paint', [[p0[0], p0[1], 0], [p1[0], p1[1], 0], [p1[0], p1[1], -rec], [p0[0], p0[1], -rec]], { color: wall.trim, want: [-s * Math.cos((a0 + a1) / 2), -Math.sin((a0 + a1) / 2), 0] });
    }
  }
  // arch trim ring
  const shp = new THREE.Shape();
  const t = 0.11;
  shp.moveTo(-r - t, 0);
  shp.absarc(0, 0, r + t, PI, 0, true);
  shp.lineTo(r, 0);
  shp.absarc(0, 0, r, 0, PI, false);
  shp.closePath();
  b.push().translate(uc, yS, 0.035);
  b.shape('paint', shp, { depth: 0.035, color: wall.trim, curveSegments: 10 });
  b.pop();
  // keystone
  b.box('paint', uc, yS + r - 0.02, 0.02, 0.16, 0.22, 0.06, { color: wall.trim });
}

export function build(opts = {}) {
  const ctx = makeCtx('church', opts);
  const b = ctx.b, r = ctx.rng;
  const st = ctx.state, wear = ctx.wear;
  const fy = 0.75;
  const white = weather('#f4f1ea', wear * 0.55);
  const trim = weather('#5f8fbf', wear * 0.6);
  const blue = weather('#2b5d9b', wear * 0.7);
  const roofBlue = weather('#2a4f78', wear * 0.6);
  const gilded = st >= 0.55;
  const goldKey = gilded ? 'gold' : 'gold_dull';
  const goldCol = gilded ? '#ffcf73' : weather('#8a7444', 0.3);
  const sidingKey = wear > 0.6 ? 'siding_peel' : 'siding_lap';
  const glassLight = (p) => (r() < p * (0.4 + 0.6 * st) ? [1.0, 0.78, 0.5] : LIGHT.off);

  // ---- nave
  const NW = 8.4, ND = 11, ncz = -1.2;
  const nz0 = ncz - ND / 2, nz1 = ncz + ND / 2;
  const wallTop = fy + 5.6;
  const pitch = 0.8;
  const yRidge = wallTop + (NW / 2) * pitch;
  const sides = [[], [], [], []];
  const archOps = [[], [], [], []];
  for (const s of [1, 3]) {
    for (const t of [0.2, 0.5, 0.8]) {
      const op = { kind: 'win', u: ND * t, y: fy + 1.5, w: 0.95, h: 2.3, style: 'grid', gx: 2, gy: 4, light: glassLight(0.75), cell: 2, cond: windowCond(ctx, -0.15) };
      const hole = { ...op, h: op.h + op.w / 2 };
      sides[s].push({ ...hole, style: 'grid', gy: 5, casing: 0, sill: true });
      archOps[s].push(op);
    }
  }
  for (const u of [1.15, NW - 1.15]) sides[0].push({ kind: 'win', u, y: fy + 2.2, w: 0.7, h: 1.4, style: 'grid', gx: 2, gy: 3, light: glassLight(0.5), cell: 2, cond: windowCond(ctx, -0.2) });
  if (ctx.wantInterior) sides[0].push({ kind: 'door', u: NW / 2, y: fy, w: 1.6, h: 2.6, style: 'double', color: '#6a4a2a', casing: 0 });
  walls(ctx, {
    W: NW, D: ND, cz: ncz, y0: fy - 0.05, y1: wallTop, key: sidingKey, color: white, trim, sides,
    gable: { axis: 'z', yRidge }, thick: 0.25, corner: 0.22, recess: 0.1,
    inner: ctx.wantInterior ? { key: 'plaster', color: '#dfe7ec', trim: '#e8e2d4', y0: fy, y1: wallTop } : null,
  });
  for (const s of [1, 3]) {
    sideFrame(b, s, NW, ND, 0, ncz);
    for (const op of archOps[s]) archedWindow(ctx, op, { trim, recess: 0.1 }, sidingKey, white);
    b.pop();
  }
  // eave frieze + cornice on the long sides
  for (const sx of [-1, 1]) b.box('paint', sx * (NW / 2 + 0.06), wallTop - 0.45, ncz, 0.12, 0.45, ND + 0.1, { color: trim });
  roofGable(ctx, { W: NW, D: ND, cz: ncz, yEave: wallTop, pitch, axis: 'z', eave: 0.55, rake: 0.4, key: 'metal_corr_paint', color: roofBlue, trim: white, wear, icicles: st > 0.3 ? 0.4 : 0 });
  ctx.col(0, ncz, NW, ND, yRidge);

  // ---- central drum + main onion dome
  const drumR = 1.55, drumY0 = yRidge - 1.0, drumH = 2.4;
  b.cyl(sidingKey, 0, drumY0, ncz, drumR, drumH, { segs: 8, smooth: false, color: white, caps: '' });
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * PI * 2 + PI / 8 + PI / 4 * 0;
    b.push().translate(0, drumY0 + 1.6, ncz).rotateY(a + PI / 8);
    const apo = drumR * Math.cos(PI / 8);
    b.poly('glass_warm', [[-0.28, -0.55, apo + 0.01], [0.28, -0.55, apo + 0.01], [0.28, 0.55, apo + 0.01], [-0.28, 0.55, apo + 0.01]], { color: glassLight(0.8), uv: [[0.5, 0], [0.75, 0], [0.75, 0.5], [0.5, 0.5]] });
    b.box('paint', 0, -0.62, apo + 0.02, 0.7, 0.07, 0.07, { color: trim });
    b.box('paint', 0, 0.55, apo + 0.02, 0.7, 0.1, 0.06, { color: trim });
    b.pop();
  }
  b.cyl('paint', 0, drumY0 + drumH, ncz, drumR + 0.16, 0.22, { segs: 8, smooth: false, color: trim });
  const domeCol = gilded ? '#ffcf73' : weather('#3a6a9a', wear * 0.8);
  onionDome(ctx, 0, drumY0 + drumH + 0.32, ncz, 1.85, 3.3, {
    key: gilded ? 'gold' : 'sheet_metal', color: domeCol, ringColor: trim, crossKey: goldKey, crossColor: goldCol, crossH: 2.2,
    stars: gilded ? 0 : st > 0.25 ? 16 : 0, segs: 24,
  });
  if (!gilded && wear > 0.5) {
    // tarnish streaks on the old dome
    for (let i = 0; i < 10; i++) {
      const a = r() * PI * 2;
      b.box('paint', Math.sin(a) * 1.82, drumY0 + drumH + 0.6 + r() * 0.8, ncz + Math.cos(a) * 1.82, 0.08, 0.6 + r() * 0.6, 0.02, { color: '#3a4a3a', ry: a });
    }
  }

  // ---- apse
  const AW = 5.0, AD = 2.6, acz = nz0 - AD / 2;
  walls(ctx, {
    W: AW, D: AD, cz: acz, y0: fy - 0.05, y1: fy + 4.2, key: sidingKey, color: white, trim,
    sides: [[], [{ kind: 'win', u: AD / 2, y: fy + 1.8, w: 0.6, h: 1.3, style: 'grid', gx: 2, gy: 3, light: glassLight(0.6), cell: 2 }], [{ kind: 'win', u: AW / 2, y: fy + 1.9, w: 0.6, h: 1.2, style: 'grid', gx: 2, gy: 3, light: glassLight(0.6), cell: 2 }], [{ kind: 'win', u: AD / 2, y: fy + 1.8, w: 0.6, h: 1.3, style: 'grid', gx: 2, gy: 3, light: glassLight(0.6), cell: 2 }]],
    skip: [true, false, false, false], thick: 0.22, corner: 0.18,
    inner: ctx.wantInterior ? { key: 'plaster', color: '#e8e0f0', trim: '#e8e2d4', y0: fy, y1: fy + 4.2 } : null,
  });
  const apseTop = roofHip(ctx, { W: AW, D: AD, cz: acz, yEave: fy + 4.2, pitch: 0.75, eave: 0.4, key: 'metal_corr_paint', color: roofBlue, trim: white });
  b.cyl('paint', 0, apseTop.yRidge - 0.3, acz, 0.4, 0.7, { segs: 8, smooth: false, color: white });
  onionDome(ctx, 0, apseTop.yRidge + 0.45, acz, 0.62, 1.15, { color: blue, ringColor: trim, crossKey: goldKey, crossColor: goldCol, crossH: 0.9, stars: st > 0.6 ? 8 : 0 });
  ctx.col(0, acz, AW, AD, fy + 4.2);

  // ---- bell tower over the entrance
  const TW = 3.8, tz = nz1 + TW / 2;
  const tTop = fy + 8.4; // enclosed part
  const tsides = [[{ kind: 'door', u: TW / 2, y: fy, w: 1.5, h: 2.45, style: 'double', color: weather('#7a4a2a', wear * 0.5), id: 'front', leaf: ctx.wantInterior ? 'leaf_front' : null, casing: 0 }], [], [], []];
  tsides[0].push({ kind: 'win', u: TW / 2, y: fy + 4.6, w: 0.7, h: 1.2, style: 'grid', gx: 2, gy: 3, light: glassLight(0.4), cell: 2 });
  for (const s of [1, 3]) tsides[s].push({ kind: 'win', u: TW / 2, y: fy + 5.2, w: 0.55, h: 1.0, style: 'grid', gx: 2, gy: 3, light: LIGHT.off, cell: 2 });
  walls(ctx, {
    W: TW, D: TW, cz: tz, y0: fy - 0.05, y1: tTop, key: sidingKey, color: white, trim, sides: tsides,
    skip: [false, false, true, false], thick: 0.25, corner: 0.22, recess: 0.12,
    inner: ctx.wantInterior ? { key: 'plaster', color: '#e2ded4', trim: '#e8e2d4', y0: fy, y1: fy + 3.4 } : null,
  });
  // entrance canopy (gable) on brackets + arch over the door
  b.push().translate(0, 0, tz + TW / 2);
  archedWindowHeadOnly(ctx, 0, fy + 2.45, 0.75, trim);
  b.pop();
  roofGable(ctx, { W: 2.4, D: 1.3, cx: 0, cz: tz + TW / 2 + 0.6, yEave: fy + 3.15, pitch: 0.9, axis: 'z', eave: 0.15, rake: 0.15, key: 'metal_corr_paint', color: roofBlue, trim: white });
  for (const sx of [-1, 1]) b.beam('paint', [sx * 1.1, fy + 2.5, tz + TW / 2], [sx * 1.1, fy + 3.1, tz + TW / 2 + 1.1], 0.1, 0.1, { color: white });
  porchLight(ctx, -1.05, fy + 2.0, tz + TW / 2 + 0.05, 0, st > 0.2);
  porchLight(ctx, 1.05, fy + 2.0, tz + TW / 2 + 0.05, 0, st > 0.2);
  // plinth + wide steps
  b.box('concrete', 0, 0, ncz, NW + 0.3, fy, ND + 0.3, { color: '#9a9a94', skip: 't' });
  b.box('concrete', 0, 0, tz, TW + 0.3, fy, TW + 0.3, { color: '#9a9a94', skip: 't' });
  b.box('concrete', 0, 0, acz, AW + 0.3, fy, AD + 0.3, { color: '#9a9a94', skip: 't' });
  const stp = steps(ctx, 0, tz + TW / 2 + 0.02, 0, { rise: fy, w: 2.6, solid: true, key: 'concrete', color: '#a8a8a2' });
  railing(ctx, [[-1.4, tz + TW / 2 + stp.run], [-1.4, tz + TW / 2]], 0.0, { key: 'metal', color: '#2a2a2a', h: 0.95 + fy * 0.5 });
  railing(ctx, [[1.4, tz + TW / 2 + stp.run], [1.4, tz + TW / 2]], 0.0, { key: 'metal', color: '#2a2a2a', h: 0.95 + fy * 0.5 });
  ctx.col(0, tz, TW, TW, tTop);

  // belfry: open stage with posts, balustrade, arcade, bells
  const bY = tTop; // platform level
  b.box('wood_raw', 0, bY - 0.2, tz, TW + 0.3, 0.22, TW + 0.3, { color: '#8a7a66' });
  b.box('paint', 0, bY - 0.35, tz, TW + 0.45, 0.18, TW + 0.45, { color: trim });
  const bTop = bY + 3.3;
  for (const [px, pz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) b.box('paint', px * (TW / 2 - 0.18), bY, tz + pz * (TW / 2 - 0.18), 0.36, bTop - bY, 0.36, { color: white });
  const h2 = TW / 2 - 0.36;
  railing(ctx, [[-h2, tz + TW / 2 - 0.18], [h2, tz + TW / 2 - 0.18]], bY, { key: 'paint', color: white, h: 1.0 });
  railing(ctx, [[-h2, tz - TW / 2 + 0.18], [h2, tz - TW / 2 + 0.18]], bY, { key: 'paint', color: white, h: 1.0 });
  railing(ctx, [[TW / 2 - 0.18, tz - h2], [TW / 2 - 0.18, tz + h2]], bY, { key: 'paint', color: white, h: 1.0 });
  railing(ctx, [[-TW / 2 + 0.18, tz - h2], [-TW / 2 + 0.18, tz + h2]], bY, { key: 'paint', color: white, h: 1.0 });
  // arcade panels with arched openings on each side
  for (let s = 0; s < 4; s++) {
    sideFrame(b, s, TW, TW, 0, tz);
    const shp = new THREE.Shape();
    shp.moveTo(0.18, 0); shp.lineTo(TW - 0.18, 0); shp.lineTo(TW - 0.18, 1.15); shp.lineTo(0.18, 1.15); shp.closePath();
    const hole = new THREE.Path();
    const rr = (TW - 0.36) / 2 - 0.12;
    hole.moveTo(TW / 2 - rr, 0); hole.lineTo(TW / 2 - rr, 0.35); hole.absarc(TW / 2, 0.35, rr, PI, 0, true); hole.lineTo(TW / 2 + rr, 0); hole.closePath();
    shp.holes.push(hole);
    b.push().translate(0, bTop - 1.15, 0.0);
    b.shape('paint', shp, { depth: 0.22, color: white, curveSegments: 12 });
    b.pop();
    b.box('paint', TW / 2, bTop - 0.05, 0.06, TW + 0.2, 0.18, 0.16, { color: trim });
    b.pop();
  }
  // beam + bells + ropes
  b.box('wood_raw', 0, bTop - 0.75, tz, TW - 0.4, 0.2, 0.2, { color: '#5a4a3a' });
  bell(ctx, 0, bTop - 0.75, tz, 0.46);
  bell(ctx, -1.0, bTop - 0.75, tz, 0.27, '#9a7a44');
  bell(ctx, 1.0, bTop - 0.75, tz, 0.2, '#9a7a44');
  bell(ctx, 0.55, bTop - 0.75, tz + 0.75, 0.15, '#9a7a44');
  for (const [x, zz] of [[0.15, 0.0], [-1.0, 0.1], [1.0, 0.1]]) b.cylBetween('fabric', [x, bTop - 1.5, tz + zz], [x * 0.6, bY + 1.0, tz + 0.9], 0.012, { segs: 4, color: '#c8b890' });
  // tent roof + small dome over the belfry
  const tr = roofHip(ctx, { W: TW + 0.2, D: TW + 0.2, cz: tz, yEave: bTop + 0.12, pitch: 0.95, eave: 0.35, key: 'metal_corr_paint', color: roofBlue, trim: white });
  b.cyl('paint', 0, tr.yRidge - 0.45, tz, 0.46, 0.95, { segs: 8, smooth: false, color: white });
  const towerTop = onionDome(ctx, 0, tr.yRidge + 0.6, tz, 0.78, 1.45, { color: blue, ringColor: trim, crossKey: goldKey, crossColor: goldCol, crossH: 1.4, stars: st > 0.6 ? 10 : 0 });
  if (st > 0.3) icicles(ctx, -TW / 2, TW / 2, bY - 0.35, tz + TW / 2 + 0.24, 0.6);

  ctx.footprint = { w: NW + 1.4, d: (tz + TW / 2 + stp.run) - (acz - AD / 2) + 1 };
  // doors / points
  const doorZ = tz + TW / 2 + stp.run + 0.4;
  ctx.doors.push({ id: 'front', x: 0, z: tz + TW / 2 + 0.1, rot: 0, w: 1.5, leadsTo: ctx.wantInterior ? 'interior' : 'exterior' });
  ctx.point('door', 0, 0, doorZ + 0.8, PI);
  ctx.point('steps', 0, fy, tz + TW / 2 + 0.6, PI);
  ctx.point('belfry', 0.6, bY, tz + 0.9, PI);
  ctx.point('bells', 0, bTop - 1.2, tz, 0);
  ctx.point('bellRope', 0.15, bY, tz + 0.7, PI);
  ctx.point('domeTop', 0, towerTop, tz, 0);
  ctx.point('relayMount', TW / 2 - 0.4, bY + 2.4, tz - TW / 2 + 0.4, -PI * 0.75); // where a relay antenna hides
  ctx.light(0, fy + 2.3, tz + TW / 2 + 0.6, 0xffc080, 1.8, 8);
  if (st > 0.5) ctx.light(0, bY + 1.6, tz, 0xffd8a0, 1.2, 6);

  if (ctx.wantInterior) interior(ctx, { fy, NW, ND, ncz, nz0, nz1, TW, tz, AW, AD, acz, wallTop, bY });
  else {
    // exterior-only: a hatch platform reachable from the ground (game teleports up the ladder)
    ctx.point('ladderBottom', 0, 0, tz + TW / 2 + stp.run + 0.6, PI);
  }
  return finish(ctx);
}

function archedWindowHeadOnly(ctx, u, y, r, trim) {
  const b = ctx.b;
  const shp = new THREE.Shape();
  const t = 0.14;
  shp.moveTo(-r - t, 0);
  shp.absarc(0, 0, r + t, PI, 0, true);
  shp.lineTo(r, 0);
  shp.absarc(0, 0, r, 0, PI, false);
  shp.closePath();
  b.push().translate(u, y, 0.03);
  b.shape('paint', shp, { depth: 0.05, color: trim, curveSegments: 10 });
  b.pop();
  // tympanum with a painted icon
  const key = 'church_tympanum';
  b.materials.set('sign:' + key, getSignMaterial(key, { kind: 'paint', w: 1.5, h: 0.75, ppm: 128, draw: drawTympanum }));
  const pts = [];
  for (let i = 0; i <= 10; i++) { const a = (i / 10) * PI; pts.push([u + Math.cos(a) * r, y + Math.sin(a) * r, 0.006]); }
  pts.reverse();
  b.poly('sign:' + key, pts.map((p) => p), { uv: pts.map((p) => [(p[0] - u + r) / (2 * r), (p[1] - y) / r]), want: [0, 0, 1] });
}

function drawTympanum(g, W, H) {
  g.fillStyle = '#1e3f6e';
  g.fillRect(0, 0, W, H);
  g.fillStyle = '#d8b050';
  g.beginPath(); g.arc(W / 2, H * 0.55, H * 0.2, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#8a1a1a';
  g.beginPath(); g.moveTo(W / 2 - H * 0.25, H); g.lineTo(W / 2, H * 0.6); g.lineTo(W / 2 + H * 0.25, H); g.fill();
  g.fillStyle = '#e8c8a0';
  g.beginPath(); g.arc(W / 2, H * 0.58, H * 0.08, 0, Math.PI * 2); g.fill();
}

// ------------------------------------------------------------------ interior

let iconAtlas = null;
function iconMaterialKey(b) {
  const key = 'icons_atlas';
  b.materials.set('i:sign:' + key, getSignMaterial(key, { kind: 'paint', w: 4, h: 2, ppm: 128, draw: drawIcons }));
  iconAtlas = 'i:sign:' + key;
  return iconAtlas;
}

/** 4×2 atlas of stylised icons: gold ground, haloed figures in red/blue/green robes. */
function drawIcons(g, W, H) {
  const cw = W / 4, ch = H / 2;
  const robes = [['#8a1a1a', '#1e3f6e'], ['#1e3f6e', '#8a1a1a'], ['#2a5a3a', '#8a5a1a'], ['#6a1a3a', '#1e3f6e'], ['#1e3f6e', '#c8a040'], ['#8a1a1a', '#2a5a3a'], ['#5a3a1a', '#8a1a1a'], ['#1e3f6e', '#6a1a3a']];
  for (let k = 0; k < 8; k++) {
    const x = (k % 4) * cw, y = Math.floor(k / 4) * ch;
    g.save();
    g.translate(x, y);
    const gr = g.createLinearGradient(0, 0, 0, ch);
    gr.addColorStop(0, '#e8c060');
    gr.addColorStop(1, '#b8862a');
    g.fillStyle = '#3a2010';
    g.fillRect(0, 0, cw, ch);
    g.fillStyle = gr;
    g.fillRect(cw * 0.06, ch * 0.04, cw * 0.88, ch * 0.92);
    // halo
    g.fillStyle = '#f8dc80';
    g.beginPath(); g.arc(cw / 2, ch * 0.3, cw * 0.17, 0, Math.PI * 2); g.fill();
    g.strokeStyle = '#8a5a1a'; g.lineWidth = 2; g.stroke();
    // robe + mantle
    const [r1, r2] = robes[k];
    g.fillStyle = r1;
    g.beginPath(); g.moveTo(cw * 0.22, ch * 0.96); g.quadraticCurveTo(cw * 0.25, ch * 0.45, cw / 2, ch * 0.4); g.quadraticCurveTo(cw * 0.75, ch * 0.45, cw * 0.78, ch * 0.96); g.fill();
    g.fillStyle = r2;
    g.beginPath(); g.moveTo(cw * 0.3, ch * 0.96); g.quadraticCurveTo(cw * 0.36, ch * 0.55, cw * 0.62, ch * 0.5); g.lineTo(cw * 0.7, ch * 0.96); g.fill();
    // face, hair
    g.fillStyle = '#7a4a2a';
    g.beginPath(); g.ellipse(cw / 2, ch * 0.3, cw * 0.085, ch * 0.075, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#d8a878';
    g.beginPath(); g.ellipse(cw / 2, ch * 0.315, cw * 0.065, ch * 0.06, 0, 0, Math.PI * 2); g.fill();
    // hand + book
    g.fillStyle = '#d8a878';
    g.beginPath(); g.arc(cw * 0.42, ch * 0.62, cw * 0.03, 0, Math.PI * 2); g.fill();
    if (k % 2) { g.fillStyle = '#5a1a1a'; g.fillRect(cw * 0.52, ch * 0.58, cw * 0.14, ch * 0.16); g.fillStyle = '#d8b050'; g.fillRect(cw * 0.55, ch * 0.61, cw * 0.08, ch * 0.1); }
    // inscription
    g.fillStyle = '#8a1a1a';
    g.font = `bold ${ch * 0.06}px Georgia, serif`;
    g.textAlign = 'center';
    g.fillText(['IC XC', 'MP ΘY', 'Ο ΑΓ', 'Ο ΑΓ', 'IC XC', 'Ο ΑΓ', 'MP ΘY', 'Ο ΑΓ'][k], cw / 2, ch * 0.13);
    g.restore();
  }
}

function iconQuad(b, key, k, x0, y0, x1, y1, z) {
  const cu = (k % 4) / 4, cv = 1 - (Math.floor(k / 4) + 1) / 2;
  b.poly(key, [[x0, y0, z], [x1, y0, z], [x1, y1, z], [x0, y1, z]], { uv: [[cu, cv], [cu + 0.25, cv], [cu + 0.25, cv + 0.5], [cu, cv + 0.5]], want: [0, 0, 1] });
}

function interior(ctx, d) {
  const b = ctx.b, r = ctx.rng;
  const { fy, NW, ND, ncz, nz0, nz1, TW, tz, AW, AD, acz, wallTop, bY } = d;
  // floors + ceilings
  floor(ctx, 0, ncz, NW - 0.5, ND - 0.5, fy, 'floor_wood', '#c89a6a');
  floor(ctx, 0, tz, TW - 0.5, TW - 0.5, fy, 'floor_wood', '#a87a50');
  floor(ctx, 0, acz, AW - 0.44, AD + 0.2, fy + 0.3, 'carpet', '#7a1a1a');
  ceiling(ctx, 0, ncz, NW - 0.5, ND - 0.5, wallTop, 'plaster', '#3a5a8a');
  ceiling(ctx, 0, acz, AW - 0.44, AD, fy + 4.2, 'plaster', '#3a5a8a');
  ceiling(ctx, 0, tz, TW - 0.5, TW - 0.5, fy + 3.4, 'plaster', '#d8d2c4');
  // gold stars on the blue vault
  for (let i = 0; i < 40; i++) b.box('i:gold', (r() - 0.5) * (NW - 1), wallTop - 0.012, ncz + (r() - 0.5) * (ND - 1), 0.07, 0.01, 0.07, { color: '#ffd27a', ry: r() });
  // narthex: inner partition already = nave front wall (with passage); the ladder up the tower
  const lx = -TW / 2 + 0.55, lz = tz - TW / 2 + 0.45;
  ladder(ctx, lx, fy, lz, fy + 3.4 + 0.05, 0);
  // hatch in the narthex ceiling and a second ladder up to the belfry inside the tower
  b.box('i:wood_raw', lx, fy + 3.38, lz + 0.2, 0.8, 0.04, 0.8, { color: '#3a2a1a' });
  ctx.point('ladderBottom', lx, fy, lz + 0.6, PI);
  ctx.point('ladderTop', lx + 0.4, bY, lz + 0.7, PI);
  ctx.point('narthex', 0, fy, tz + 0.6, PI);
  ctx.point('door_in', 0, fy, tz + TW / 2 - 0.8, PI);
  // carpet runner
  rug(ctx, 0, fy, ncz + 1.0, 1.4, ND - 3.0, '#7a1a1a');
  // ---- iconostasis across the nave near the apse
  const iz = nz0 + 0.6;
  const ik = iconMaterialKey(b);
  const iw = NW - 0.6, ih = 3.6;
  b.box('i:wood_dark', 0, fy, iz, iw, 0.4, 0.3, { color: '#5a3a20' });
  // frame grid
  const panels = [[-3.3, -2.45], [-1.55, -0.85], [0.85, 1.55], [2.45, 3.3]];
  for (const [x0, x1] of panels) {
    b.box('i:wood_dark', (x0 + x1) / 2, fy + 0.4, iz, x1 - x0, ih - 0.4, 0.2, { color: '#6a4424' });
  }
  for (const x of [-3.35, -2.4, -1.6, -0.8, 0.8, 1.6, 2.4, 3.35]) b.box('i:gold', x, fy + 0.4, iz + 0.11, 0.1, ih - 0.4, 0.06, { color: '#e8b850' });
  b.box('i:gold', 0, fy + ih - 0.1, iz + 0.11, iw, 0.14, 0.08, { color: '#e8b850' });
  b.box('i:gold', 0, fy + 2.35, iz + 0.11, iw, 0.08, 0.06, { color: '#e8b850' });
  // icons: lower tier (Christ, Theotokos, saints), upper tier (feasts)
  let k = 0;
  for (const [x0, x1] of panels) {
    iconQuad(b, ik, k % 8, x0 + 0.08, fy + 0.65, x1 - 0.08, fy + 2.25, iz + 0.105);
    iconQuad(b, ik, (k + 4) % 8, x0 + 0.1, fy + 2.5, x1 - 0.1, fy + 3.35, iz + 0.105);
    k++;
  }
  // royal doors (centre) + deacon doors
  b.box('i:gold', 0, fy + 0.4, iz + 0.05, 1.5, 2.3, 0.08, { color: '#d8a848' });
  iconQuad(b, ik, 4, -0.68, fy + 1.1, -0.04, fy + 2.4, iz + 0.095);
  iconQuad(b, ik, 1, 0.04, fy + 1.1, 0.68, fy + 2.4, iz + 0.095);
  for (const x of [-2.0, 2.0]) {
    b.box('i:wood_dark', x, fy + 0.4, iz + 0.05, 0.75, 2.0, 0.06, { color: '#7a5030' });
    iconQuad(b, ik, x < 0 ? 6 : 7, x - 0.3, fy + 0.8, x + 0.3, fy + 2.2, iz + 0.085);
  }
  // cross on top
  b.push().translate(0, fy + ih, iz + 0.05);
  orthodoxCross(b, 'i:gold', 0.9, '#e8b850', { t: 0.06 });
  b.pop();
  // lampada (red vigil lamp) before the Christ icon
  b.cylBetween('i:gold', [-1.2, fy + 3.4, iz + 0.6], [-1.2, fy + 2.5, iz + 0.6], 0.005, { segs: 3, color: '#d8a848' });
  b.sphere('i:neon', -1.2, fy + 2.45, iz + 0.6, 0.06, { color: [5, 0.6, 0.3], rings: 4, segs: 8 });
  ctx.light(-1.2, fy + 2.4, iz + 0.8, 0xff5030, 0.8, 4);
  // holy table behind the royal doors (in the apse)
  b.box('i:fabric', 0, fy + 0.3, acz + 0.1, 1.2, 1.0, 1.2, { color: '#d8c890' });
  b.box('i:gold', 0, fy + 1.3, acz + 0.1, 0.35, 0.4, 0.2, { color: '#e8b850' });
  ctx.colLocal(0, iz, iw, 0.4, ih);
  ctx.point('iconostasis', 0, fy, iz + 1.4, PI);
  ctx.point('royalDoors', 0, fy, iz + 0.9, PI);
  ctx.point('altar', 0, fy + 0.3, acz + 0.8, PI);
  // candle stands with lit candles
  for (const sx of [-1, 1]) {
    const cx = sx * 1.9, cz = iz + 1.6;
    b.cyl('i:gold', cx, fy, cz, 0.06, 1.0, { segs: 8, color: '#c89a48' });
    b.cyl('i:gold', cx, fy, cz, 0.25, 0.05, { segs: 10, color: '#c89a48' });
    b.cyl('i:gold', cx, fy + 1.0, cz, 0.38, 0.06, { segs: 14, rTop: 0.42, color: '#d8a848' });
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * PI * 2, rr = 0.1 + (i % 3) * 0.1;
      const ch = 0.12 + r() * 0.15;
      b.cyl('i:plastic', cx + Math.cos(a) * rr, fy + 1.06, cz + Math.sin(a) * rr, 0.008, ch, { segs: 4, color: '#e8d8a0' });
      b.sphere('i:neon', cx + Math.cos(a) * rr, fy + 1.08 + ch, cz + Math.sin(a) * rr, 0.012, { rings: 2, segs: 4, color: [8, 4, 1.2], sx: 0.6 });
    }
    ctx.light(cx, fy + 1.4, cz, 0xffa040, 1.2, 5);
    ctx.point(sx < 0 ? 'candlesL' : 'candlesR', cx, fy, cz + 0.6, PI);
  }
  // analogion (lectern) with an icon
  b.push().translate(0, fy, ncz + 0.6);
  for (const s of [-1, 1]) b.beam('i:wood_dark', [s * 0.25, 0, 0.25], [s * 0.05, 1.1, 0], 0.04, 0.04, { color: '#6a4424' });
  for (const s of [-1, 1]) b.beam('i:wood_dark', [s * 0.25, 0, -0.25], [s * 0.05, 1.1, 0], 0.04, 0.04, { color: '#6a4424' });
  b.push().translate(0, 1.15, 0).rotateX(-0.5);
  b.box('i:fabric', 0, -0.02, 0, 0.5, 0.04, 0.45, { color: '#8a1a1a' });
  iconQuad(b, ik, 5, -0.17, -0.22, 0.17, 0.2, 0.03);
  b.pop();
  b.pop();
  ctx.point('analogion', 0, fy, ncz + 1.3, PI);
  // horos chandelier
  const chY = wallTop - 0.6;
  b.cylBetween('i:gold', [0, wallTop, ncz], [0, chY - 0.4, ncz], 0.012, { segs: 4, color: '#c89a48' });
  for (const [rr, yy, n] of [[1.1, chY - 0.4, 12], [0.6, chY - 0.1, 8]]) {
    b.push().translate(0, yy, ncz).rotateX(HP);
    b.cyl('i:gold', 0, -0.03, 0, rr, 0.06, { segs: 24, color: '#d8a848', caps: '' });
    b.pop();
    for (let i = 0; i < n; i++) {
      const a = (i / n) * PI * 2;
      b.cyl('i:plastic', Math.cos(a) * rr, yy + 0.03, ncz + Math.sin(a) * rr, 0.012, 0.12, { segs: 4, color: '#f0e8d0' });
      b.sphere('i:neon', Math.cos(a) * rr, yy + 0.18, ncz + Math.sin(a) * rr, 0.025, { rings: 2, segs: 4, color: [7, 4.6, 2.2], sx: 0.7 });
    }
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * PI * 2;
      b.cylBetween('i:gold', [0, chY - 0.4 + 0.5, ncz], [Math.cos(a) * rr, yy, ncz + Math.sin(a) * rr], 0.008, { segs: 3, color: '#c89a48' });
    }
  }
  ctx.light(0, chY - 0.5, ncz, 0xffcf8a, 2.6, 12);
  ctx.point('chandelier', 0, fy, ncz, 0);
  // benches along the walls (for the elderly) + kliros lectern
  for (const sx of [-1, 1]) for (const zz of [ncz - 1.5, ncz + 1.8]) bench(ctx, sx * (NW / 2 - 0.55), fy, zz, -sx * HP, { w: 2.0, color: '#6a4a2a' });
  b.push().translate(NW / 2 - 1.3, fy, iz + 2.2);
  b.box('i:wood_dark', 0, 0, 0, 0.6, 1.15, 0.5, { color: '#6a4424' });
  b.pop();
  ctx.point('kliros', NW / 2 - 1.3, fy, iz + 2.9, PI);
  // colliders: nave walls with the passage from the narthex, tower walls with the front door
  wallColliders(ctx, NW, ND, 0, ncz, [{ side: 0, u: NW / 2, w: 1.6 }], 6);
  wallColliders(ctx, TW, TW, 0, tz, [{ side: 0, u: TW / 2, w: 1.5 }, { side: 2, u: TW / 2, w: 1.6 }], 4);
  ctx.colliders = ctx.colliders.filter((c) => !(Math.abs(c.w - NW) < 0.01 && Math.abs(c.d - ND) < 0.01) && !(Math.abs(c.w - TW) < 0.01 && Math.abs(c.d - TW) < 0.01));
  ctx.doors.push({ id: 'front_in', x: 0, z: tz + TW / 2 - 0.6, rot: PI, w: 1.5, leadsTo: 'exterior' });
  ctx.light(0, fy + 2.8, tz, 0xffd8a8, 1.2, 5);
  void partition;
}
