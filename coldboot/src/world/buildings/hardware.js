// Brubaker Hardware & Fuel (Hank's): a big tan metal building with roll-up doors,
// a store entrance under a canopy, a painted sign, a fuel island with two pumps
// under its own canopy, and a fenced yard of lumber, pallets and propane.
import { makeCtx, finish, walls, roofGable, sign, sideFrame, porchLight, weather, rgb, LIGHT, PI, HALF_PI, windowCond } from './common.js';
import { addProp } from '../props.js';
import { secCam } from './cornerStore.js';

export function build(opts = {}) {
  const ctx = makeCtx('hardware', opts);
  const b = ctx.b, r = ctx.rng, st = ctx.state, wear = ctx.wear;
  const W = 26, D = 18, H = 6.0, pitch = 0.2;
  ctx.footprint = { w: W + 20, d: D + 16 };
  const tan = weather('#b8a072', wear * 0.6), brown = weather('#5a3a24', wear * 0.4);
  const open = st > 0.15;
  const sides = [[], [], [], []];
  sides[0].push({ kind: 'door', u: 5.0, y: 0.15, w: 1.9, h: 2.3, style: 'store2', frame: '#8a8e90', id: 'front', light: open ? LIGHT.office : LIGHT.off, cell: 4 });
  sides[0].push({ kind: 'win', u: 8.4, y: 0.75, w: 3.6, h: 1.9, style: 'store', gx: 2, light: open ? [0.95, 0.9, 0.78] : LIGHT.off, cell: 4, sill: false, trim: '#8a8e90' });
  sides[0].push({ kind: 'win', u: 1.9, y: 0.75, w: 2.4, h: 1.9, style: 'store', gx: 2, light: open ? [0.95, 0.9, 0.78] : LIGHT.off, cell: 4, sill: false, trim: '#8a8e90' });
  // two roll-up doors (closed) on the front right
  const rollU = [15.2, 21.0];
  for (const u of rollU) sides[0].push({ kind: 'door', u, y: 0.05, w: 4.2, h: 4.4, open: true, casing: 0 });
  sides[1].push({ kind: 'door', u: D * 0.5, y: 0.05, w: 4.2, h: 4.4, open: true, casing: 0 });
  for (const s of [1, 3]) for (const u of [3, 15]) sides[s].push({ kind: 'win', u, y: 3.3, w: 1.5, h: 1.0, style: 'slider', light: open ? LIGHT.office : LIGHT.off, cell: 7, cond: windowCond(ctx) });
  walls(ctx, { W, D, y0: 0.0, y1: H, key: 'metal_corr_paint', color: tan, trim: brown, sides, gable: { axis: 'x', yRidge: H + (D / 2) * pitch }, thick: 0.25, corner: 0.15, bands: false, recess: 0.06 });
  roofGable(ctx, { W, D, yEave: H, pitch, axis: 'x', eave: 0.5, rake: 0.3, key: wear > 0.5 ? 'metal_corr_rust' : 'metal_corr_paint', color: wear > 0.5 ? '#ffffff' : weather('#5a3a24', wear * 0.5), trim: brown, icicles: 0.4 });
  b.box('concrete', 0, -0.1, 0, W + 0.2, 0.25, D + 0.2, { color: '#8a8a86', skip: 't' });
  ctx.col(0, 0, W, D, H);
  // roll-up door curtains (horizontal slats) inside the openings
  const rollup = (s, u) => {
    sideFrame(b, s, W, D);
    b.box('sheet_metal', u, 0.05, -0.12, 4.2, 4.4, 0.04, { color: weather('#d8d4c8', wear * 0.5) });
    for (let k = 0; k < 18; k++) b.box('sheet_metal', u, 0.15 + k * 0.24, -0.095, 4.2, 0.02, 0.01, { color: '#9a968a' });
    b.box('sheet_metal', u, 4.45, 0.0, 4.6, 0.4, 0.35, { color: brown });
    b.pop();
  };
  for (const u of rollU) rollup(0, u);
  rollup(1, D * 0.5);
  // store entrance canopy + light
  b.push().translate(-W / 2, 0, D / 2);
  b.box('sheet_metal', 5.0, 2.75, 1.0, 5.0, 0.25, 2.0, { color: brown });
  for (const x of [2.7, 7.3]) b.cyl('galv', x, 0, 1.85, 0.07, 2.75, { segs: 8, color: '#8a8e90' });
  b.box('neon', 5.0, 2.73, 1.0, 0.5, 0.02, 0.5, { color: open ? [5, 4.6, 3.8] : [0.05, 0.05, 0.05] });
  if (open) ctx.light(-W / 2 + 5.0, 2.4, D / 2 + 1.2, 0xffe8c0, 1.8, 9);
  // big painted sign across the front
  sign(ctx, 'brubaker_sign', W * 0.48, H - 0.75, 0.05, 15.0, 1.25, {
    kind: 'paint', ppm: 80, bg: '#f0e8d0', border: '#5a3a24', fade: Math.max(0, wear - 0.1), seed: 21,
    lines: [{ text: (ctx.name || 'BRUBAKER HARDWARE & FUEL').toUpperCase(), size: 0.56, y: 0.42, color: '#7a1f12', font: '"Arial Black", Arial, sans-serif', weight: '900', spacing: 0.03 }, { text: 'LUMBER · TOOLS · PROPANE · HEATING OIL · SNOWMACHINE PARTS', size: 0.2, y: 0.82, color: '#2a2a2a', font: 'Arial, sans-serif', weight: 'bold' }],
  });
  sign(ctx, 'brubaker_hours', 8.4, 3.1, 0.06, 1.6, 0.4, { kind: 'paint', ppm: 120, bg: '#2a2a2a', lines: [{ text: 'OPEN 7–7 · SUN 10–4', size: 0.45, color: '#f0e8d0', font: 'Arial, sans-serif' }] });
  b.pop();
  // fuel island in front: slab, two pumps, canopy on 4 posts, FUEL sign
  const fx = -4, fz = D / 2 + 8;
  b.box('concrete', fx, 0, fz, 3.2, 0.2, 8.0, { color: '#a8a8a2' });
  for (const z of [-1.8, 1.8]) { b.at(fx, 0.2, fz + z, HALF_PI); addProp(b, 'fuelPump', { color: weather('#e8e4dc', wear * 0.4) }, r); b.pop(); }
  for (const [x, z] of [[-1.3, -3.4], [1.3, -3.4], [-1.3, 3.4], [1.3, 3.4]]) b.cyl('galv', fx + x, 0.2, fz + z, 0.1, 4.6, { segs: 8, color: '#d8d8d0' });
  b.box('sheet_metal', fx, 4.8, fz, 5.5, 0.6, 9.5, { color: '#f0f0ea' });
  b.box('paint', fx, 4.8, fz, 5.52, 0.25, 9.52, { color: '#b8201a' });
  for (let i = 0; i < 3; i++) b.box('neon', fx, 4.79, fz - 3 + i * 3, 1.2, 0.02, 0.5, { color: open ? [6, 6, 5.4] : [0.05, 0.05, 0.05] });
  if (open) { ctx.light(fx, 4.4, fz - 1.5, 0xf8f4e8, 2.2, 12); ctx.light(fx, 4.4, fz + 2.5, 0xf8f4e8, 2.2, 12); }
  b.push().translate(fx + 2.76, 4.95, fz).rotateY(HALF_PI);
  sign(ctx, 'brubaker_fuel', 0, 0.12, 0.001, 3.0, 0.45, { kind: 'lightbox', ppm: 120, bg: '#f0f0ea', lines: [{ text: 'FUEL · HEATING OIL', size: 0.6, color: '#b8201a', font: 'Arial Black, Arial, sans-serif', weight: '900' }], dayEmissive: 0.2, nightEmissive: open ? 1.4 : 0.05 }, { back: false });
  b.pop();
  ctx.col(fx, fz, 3.2, 8.0, 1.0);
  ctx.point('fuelPump1', fx + 1.3, 0, fz - 1.8, -HALF_PI);
  ctx.point('fuelPump2', fx - 1.3, 0, fz + 1.8, HALF_PI);
  // fenced yard on the right side: lumber stacks, pallets, propane cage, gate
  const yx = W / 2 + 8, yz = -1;
  const yw = 13, yd = 16;
  for (let i = 0; i < 5; i++) {
    b.at(yx - yw / 2 + i * 3, 0, yz - yd / 2, 0);
    addProp(b, 'fenceChain', { len: 3, h: 2.1, end: i === 4, barbed: true }, r);
    b.pop();
  }
  for (const sx of [-1, 1]) for (let i = 0; i < 5; i++) {
    if (sx < 0 && i < 2) continue; // gate gap near the building
    b.at(yx + sx * (yw / 2 + 0.0), 0, yz - yd / 2 + i * 3.2, sx < 0 ? -HALF_PI : -HALF_PI);
    addProp(b, 'fenceChain', { len: 3.2, h: 2.1, end: i === 4, barbed: true }, r);
    b.pop();
  }
  for (let i = 0; i < 4; i++) {
    b.at(yx - yw / 2 + i * 3.3, 0, yz + yd / 2, 0);
    addProp(b, 'fenceChain', { len: 3.3, h: 2.1, end: i === 3, barbed: true }, r);
    b.pop();
  }
  // lumber stacks under a lean shelter
  for (let i = 0; i < 3; i++) {
    const lz = yz - yd / 2 + 2.5 + i * 3.6;
    b.box('wood_raw', yx + 2.5, 0.12, lz, 5.0, 0.12, 1.3, { color: '#7a6a56' });
    for (let k = 0; k < 6; k++) b.box('wood_raw', yx + 2.5, 0.24 + k * 0.16, lz, 4.8, 0.15, 1.2, { color: weather('#c8a878', 0.2 + r() * 0.2), uvRot: true });
    b.box('metal_corr', yx + 2.5, 1.5, lz, 5.4, 0.04, 1.8, { color: '#ffffff', rx: 0.1 });
  }
  b.at(yx - 3.5, 0, yz - 3, 0.3); addProp(b, 'pallet', {}, r); b.translate(0, 0.14, 0); addProp(b, 'pallet', {}, r); b.translate(0, 0.14, 0); addProp(b, 'pallet', {}, r); b.pop();
  b.at(yx - 3, 0, yz + 4, 0); b.box('chainlink', 0, 0, 0, 2.6, 1.8, 1.0, { color: '#ffffff' }); addProp(b, 'propane', { count: 5 }, r); b.pop();
  b.at(yx - 3.5, 0, yz + 0.8, 1.2); addProp(b, 'atv', {}, r); b.pop();
  ctx.col(yx, yz, yw, 0.3, 2.2);
  ctx.point('yard', yx, 0, yz, 0);
  ctx.point('yardGate', yx - yw / 2 - 1.0, 0, yz - yd / 2 + 3.0, HALF_PI);
  // a camera Hank bought after the break-in
  secCam(ctx, W / 2 + 0.05, H - 0.4, D / 2 + 0.05, PI * 0.3, { pitch: -0.5 });
  ctx.doors.push({ id: 'front', x: -W / 2 + 5.0, z: D / 2 + 0.1, rot: 0, w: 1.9, leadsTo: 'exterior' });
  ctx.point('door', -W / 2 + 5.0, 0, D / 2 + 2.6, PI);
  ctx.point('rollupDoor', -W / 2 + rollU[0], 0, D / 2 + 2.5, PI);
  void rgb; void porchLight;
  return finish(ctx);
}
