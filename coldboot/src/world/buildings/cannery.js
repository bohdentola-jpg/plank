// Zarya Seafoods cannery: a big corrugated industrial shed on pilings at the
// shore — land side (+Z) with loading doors and the office annex, sea side
// (−Z) with a pile-supported dock, bollards and a pedestal crane. Local y = 0
// is the shore/dock ground; the pilings run down 6 m to the water and below.
import { makeCtx, finish, walls, roofGable, roofShed, sign, sideFrame, porchLight, steps, weather, rgb, LIGHT, PI, HALF_PI, windowCond } from './common.js';
import { addProp } from '../props.js';
import { secCam } from './cornerStore.js';

export function build(opts = {}) {
  const ctx = makeCtx('cannery', opts);
  const b = ctx.b, r = ctx.rng, st = ctx.state, wear = ctx.wear;
  const W = 56, D = 24, H = 9.5, fy = 0.6, pitch = 0.18;
  const dockD = 9;
  ctx.footprint = { w: W + 6, d: D + dockD + 6 };
  const rusty = wear > 0.4;
  const body = rusty ? weather('#c8ccd0', 0.4) : weather('#7f9cb4', wear * 0.6);
  const trim = weather('#2a3a4a', wear * 0.4);
  const sides = [[], [], [], []];
  // land side: 3 roll-up doors + personnel door; sea side: 3 doors to the dock
  for (const u of [10, 22, 34]) sides[0].push({ kind: 'door', u, y: fy, w: 4.5, h: 4.6, open: true, casing: 0 });
  sides[0].push({ kind: 'door', u: 44, y: fy, w: 0.95, h: 2.1, style: 'steel', color: '#5a6068', id: 'staff' });
  for (const u of [12, 28, 44]) sides[2].push({ kind: 'door', u, y: fy, w: 4.5, h: 4.6, open: true, casing: 0 });
  // clerestory windows high up
  for (const s of [0, 2]) for (let u = 4; u < W - 3; u += 4.2) sides[s].push({ kind: 'win', u, y: fy + 6.6, w: 2.6, h: 1.1, style: 'grid', gx: 4, gy: 1, light: st > 0.25 && (u | 0) % 3 === 0 ? LIGHT.office : LIGHT.off, cell: 7, cond: windowCond(ctx, 0.1) });
  for (const s of [1, 3]) sides[s].push({ kind: 'win', u: D / 2, y: fy + 6.0, w: 3.0, h: 1.4, style: 'grid', gx: 4, gy: 2, light: LIGHT.off, cell: 7, cond: windowCond(ctx) });
  walls(ctx, { W, D, y0: fy - 0.05, y1: fy + H, key: rusty ? 'metal_corr_rust' : 'metal_corr_paint', color: rusty ? '#ffffff' : body, trim, sides, gable: { axis: 'x', yRidge: fy + H + (D / 2) * pitch }, thick: 0.25, corner: 0.2, bands: false, recess: 0.06, grime: 0.25 });
  roofGable(ctx, { W, D, yEave: fy + H, pitch, axis: 'x', eave: 0.6, rake: 0.4, key: rusty ? 'metal_corr_rust' : 'metal_corr', color: '#ffffff', trim, icicles: 0.2 });
  // floor deck + pilings (timber, creosote) under the whole shed and dock
  b.box('wood_weathered', 0, fy - 0.35, 0, W, 0.35, D, { color: '#5a524a', skip: 't' });
  pilings(ctx, -W / 2, W / 2, -D / 2 - dockD, D / 2, 4.0, 4.0, fy - 0.35);
  ctx.col(0, 0, W, D, fy + H);
  ctx.floor(0, 0, W, D, fy);
  // roll-up door curtains (two partly open with light spilling)
  const doorFill = (s, u, k) => {
    sideFrame(b, s, W, D);
    const openH = k === 1 && st > 0.3 ? 2.6 : 0;
    b.box('sheet_metal', u, fy + openH, -0.12, 4.5, 4.6 - openH, 0.04, { color: weather('#d8d4c8', wear * 0.5) });
    for (let j = 0; j < 18 - openH * 4; j++) b.box('sheet_metal', u, fy + openH + 0.15 + j * 0.25, -0.095, 4.5, 0.02, 0.01, { color: '#9a968a' });
    b.box('sheet_metal', u, fy + 4.65, 0.0, 4.9, 0.45, 0.4, { color: trim });
    if (openH > 0) {
      b.poly('neon', [[u - 2.2, fy, -1.5], [u + 2.2, fy, -1.5], [u + 2.2, fy + openH, -1.5], [u - 2.2, fy + openH, -1.5]], { color: [1.4, 1.3, 1.1], want: [0, 0, 1] });
      const p = b.P(u, fy + 1.5, 1.0);
      ctx.light(p[0], p[1], p[2], 0xf0f0e0, 1.8, 10);
    }
    b.pop();
  };
  [10, 22, 34].forEach((u, k) => doorFill(0, u, k));
  [12, 28, 44].forEach((u, k) => doorFill(2, u, k + 1));
  // big painted name on the land side
  b.push().translate(-W / 2, 0, D / 2);
  sign(ctx, 'zarya_seafoods', W / 2 - 4, fy + 5.6, 0.04, 22, 1.8, {
    kind: 'paint', ppm: 50, transparent: true, fade: Math.max(0.2, wear), seed: 31,
    lines: [{ text: (ctx.name || 'ZARYA SEAFOODS').toUpperCase(), size: 0.72, y: 0.45, color: '#f2f0e8', font: '"Arial Black", Arial, sans-serif', weight: '900', spacing: 0.1 }, { text: 'PORT ZARYA · ALASKA · EST. 1949', size: 0.2, y: 0.9, color: '#f2f0e8', font: 'Arial, sans-serif', weight: 'bold', spacing: 0.15 }],
  });
  b.pop();
  // office annex (two storey) on the land side, right end
  const ax = W / 2 - 5, az = D / 2 + 3.5, aw = 9, ad = 7;
  const as = [[], [], [], []];
  as[0].push({ kind: 'door', u: 2.0, y: fy, w: 0.95, h: 2.1, style: 'glass', frame: '#8a8e90', id: 'office', light: st > 0.2 ? LIGHT.office : LIGHT.off, cell: 7 });
  for (const u of [4.5, 7.0]) as[0].push({ kind: 'win', u, y: fy + 1.0, w: 1.4, h: 1.2, style: 'slider', light: st > 0.2 ? LIGHT.office : LIGHT.off, cell: 7 });
  for (const u of [2.0, 4.5, 7.0]) as[0].push({ kind: 'win', u, y: fy + 3.9, w: 1.4, h: 1.2, style: 'slider', light: st > 0.3 && u > 4 ? LIGHT.office : LIGHT.off, cell: 7 });
  as[1].push({ kind: 'win', u: ad / 2, y: fy + 3.9, w: 1.4, h: 1.2, style: 'slider', light: LIGHT.off, cell: 7 });
  walls(ctx, { W: aw, D: ad, cx: ax, cz: az, y0: fy - 0.05, y1: fy + 6.0, key: 'siding_panel', color: weather('#d8d0b8', wear * 0.6), trim, sides: as, skip: [false, false, true, false], thick: 0.2, corner: 0.12 });
  roofShed(ctx, { W: aw, D: ad, cx: ax, cz: az, yLow: fy + 6.0, yHigh: fy + 6.7, high: 'back', key: 'metal_corr', color: '#ffffff', trim, eave: 0.4, rake: 0.3 });
  b.box('concrete', ax, -0.1, az, aw, fy + 0.1, ad, { color: '#8a8a86', skip: 't' });
  steps(ctx, ax - aw / 2 + 2.0, az + ad / 2, 0, { rise: fy, w: 1.4, solid: true, key: 'concrete', color: '#9a9a94' });
  ctx.col(ax, az, aw, ad, fy + 6);
  porchLight(ctx, ax - aw / 2 + 2.8, fy + 2.3, az + ad / 2 + 0.03, 0, st > 0.15);
  // vents + stack on the roof
  for (const x of [-18, -6, 6]) { b.cyl('galv', x, fy + H + 1.6, -2, 0.5, 1.2, { segs: 12, color: '#a8aeb0' }); b.cyl('galv', x, fy + H + 2.8, -2, 0.75, 0.3, { segs: 12, rTop: 0.1, color: '#9aa0a2' }); }
  b.cyl('metal_rust', 18, fy + H, -4, 0.45, 7.5, { segs: 10, color: '#ffffff' });
  // the dock on the sea side
  const dz = -D / 2 - dockD / 2;
  b.box('wood_weathered', 0, fy - 0.3, dz, W, 0.3, dockD, { color: '#8a8278', uvRot: true });
  ctx.floor(0, dz, W, dockD, fy);
  b.box('wood_raw', 0, fy - 0.55, -D / 2 - dockD + 0.15, W, 0.3, 0.3, { color: '#4a3a2a' }); // fender beam
  for (let x = -W / 2 + 3; x < W / 2; x += 6) {
    b.push().translate(x, fy, -D / 2 - dockD + 0.6);
    addProp(b, 'bollard', {}, r);
    b.pop();
    b.cyl('rubber', x + 3, fy - 0.9, -D / 2 - dockD - 0.05, 0.25, 0.7, { segs: 10, color: '#121212' });
  }
  // pedestal crane with a boom over the water
  crane(ctx, -W / 2 + 8, -D / 2 - dockD + 2.5, fy, wear);
  ctx.point('crane', -W / 2 + 8 + 2.5, fy, -D / 2 - dockD + 2.5, -HALF_PI);
  // totes + pallets + a forklift-shaped pile of crab pots on the dock
  for (let i = 0; i < 8; i++) { b.at(-6 + (i % 4) * 1.4, fy, dz - 1 + Math.floor(i / 4) * 1.2, 0); addProp(b, 'tote', {}, r); b.pop(); }
  for (let i = 0; i < 3; i++) { b.at(10 + i * 2.3, fy + (i === 2 ? 0.9 : 0), dz + 1.5, 0.1 * i); addProp(b, 'crabPot', {}, r); b.pop(); }
  // railings at the dock ends + lights on poles
  for (const x of [-W / 2 + 0.1, W / 2 - 0.1]) b.box('metal', x, fy, dz, 0.08, 1.0, dockD, { color: '#e8c020' });
  for (const x of [-W / 3, 0, W / 3]) {
    b.cyl('galv', x, fy, -D / 2 - 0.5, 0.07, 6.0, { segs: 8, color: '#a8aeb0' });
    b.box('metal', x, fy + 5.9, -D / 2 - 0.9, 0.35, 0.18, 0.7, { color: '#3a3a3a' });
    b.box('neon', x, fy + 5.89, -D / 2 - 1.0, 0.3, 0.01, 0.5, { color: st > 0.2 ? [7, 4.4, 1.6] : [0.05, 0.05, 0.05] });
    if (st > 0.2) ctx.light(x, fy + 5.6, -D / 2 - 1.4, 0xffb060, 2.2, 16);
  }
  secCam(ctx, W / 2 + 0.05, fy + H - 0.5, -D / 2 - 0.05, PI * 0.75, { pitch: -0.5 });
  ctx.doors.push({ id: 'staff', x: -W / 2 + 44, z: D / 2 + 0.1, rot: 0, w: 0.95, leadsTo: 'exterior' });
  ctx.doors.push({ id: 'office', x: ax - aw / 2 + 2.0, z: az + ad / 2 + 0.1, rot: 0, w: 0.95, leadsTo: 'exterior' });
  ctx.point('door', ax - aw / 2 + 2.0, 0, az + ad / 2 + 2.0, PI);
  [10, 22, 34].forEach((u, i) => ctx.point('loadingDoor' + (i + 1), -W / 2 + u, 0, D / 2 + 2.5, PI));
  ctx.point('dock', 0, fy, dz, PI);
  ctx.point('office', ax - aw / 2 + 2.0, fy, az + ad / 2 + 1.0, PI);
  return finish(ctx);
}

/** Timber pilings on a grid (with cross bracing) from yTop down to −6 m. */
export function pilings(ctx, x0, x1, z0, z1, sx, sz, yTop, depth = 6.5) {
  const b = ctx.b;
  for (let x = x0 + 0.4; x <= x1 - 0.3; x += sx) {
    for (let z = z0 + 0.4; z <= z1 - 0.3; z += sz) {
      b.cyl('wood_raw', x, -depth, z, 0.17, yTop + depth, { segs: 7, color: '#3a2e24', caps: 't' });
    }
  }
  for (let x = x0 + 0.4; x <= x1 - 0.3; x += sx) b.beam('wood_raw', [x, -2.4, z0 + 0.4], [x, yTop - 0.3, z1 - 0.4], 0.08, 0.2, { color: '#3a2e24' });
}

function crane(ctx, x, z, y, wear) {
  const b = ctx.b;
  const col = weather('#e8b820', wear * 0.6);
  b.cyl('metal', x, y, z, 0.6, 1.0, { segs: 12, color: '#3a3a3a' });
  b.cyl('sheet_metal', x, y + 1.0, z, 0.45, 3.6, { segs: 12, color: col });
  b.box('sheet_metal', x, y + 4.6, z, 1.6, 1.4, 1.4, { color: col });
  b.box('glass_dark', x + 0.81, y + 5.0, z, 0.02, 0.6, 1.0, { color: '#000' });
  // boom reaching over the water (−z), luffed up
  b.beam('sheet_metal', [x, y + 5.0, z], [x, y + 13.0, z - 9.0], 0.35, 0.35, { color: col });
  b.tube('metal', [[x, y + 6.0, z + 0.7], [x, y + 13.2, z - 9.0]], 0.02, { segs: 3, color: '#2a2a2a' });
  b.tube('metal', [[x, y + 12.9, z - 9.0], [x, y + 4.0, z - 9.0]], 0.015, { segs: 3, color: '#2a2a2a' });
  b.box('metal', x, y + 3.6, z - 9.0, 0.3, 0.4, 0.3, { color: '#c8401a' });
  b.box('sheet_metal', x, y + 4.4, z + 1.0, 1.2, 0.9, 0.8, { color: '#3a3a3a' }); // counterweight
  ctx.col(x, z, 1.4, 1.4, 6);
}
