// Small Boat Harbor: a gangway from the shore down to a floating main dock with
// finger piers, steel piles, dock lights, fishing boats and skiffs in the slips,
// and a harbormaster's shack on the shore. Local y = 0 is SEA LEVEL (the water
// surface); the shore end (−Z) is the bulkhead at y = shoreY.
import { makeCtx, finish, walls, roofShed, sign, porchLight, weather, rgb, LIGHT, PI, HALF_PI } from './common.js';
import { addProp } from '../props.js';

const BOAT_NAMES = ['MARGARET ROSE II', 'NORTHERN DAWN', 'ZARYA', 'SEA OTTER', 'AURORA BELLE', 'KAYAK ISLAND', 'LUCKY STRIKE', 'ST. NICHOLAS', 'BERING STAR', 'NANUQ'];

export function build(opts = {}) {
  const ctx = makeCtx('harbor', opts);
  const b = ctx.b, r = ctx.rng, st = ctx.state, wear = ctx.wear;
  const L = 72, fz = 6; // main float along x at z = fz
  const shoreY = ctx.o.shoreY ?? 2.8, shoreZ = -20;
  const deckY = 0.55;
  ctx.footprint = { w: L + 8, d: 48 };
  const plank = (x, z, w, d, y = deckY, o = {}) => {
    b.box('wood_weathered', x, y - 0.06, z, w, 0.06, d, { color: weather('#9a9488', wear * 0.4 + r() * 0.1), uvRot: o.rot });
    // pontoon floats under the deck
    b.box('plastic', x, y - 0.5, z, w - 0.1, 0.44, d - 0.15, { color: '#2a2a2a' });
    b.box('wood_raw', x, y - 0.25, z + d / 2 - 0.05, w, 0.2, 0.1, { color: '#5a4a3a' });
    b.box('wood_raw', x, y - 0.25, z - d / 2 + 0.05, w, 0.2, 0.1, { color: '#5a4a3a' });
    ctx.floor(x, z, w, d, y);
  };
  // main float + fingers
  plank(0, fz, L, 3.0);
  const fingers = [];
  for (let i = 0; i < 7; i++) {
    const x = -L / 2 + 6 + i * 10;
    plank(x, fz + 1.5 + 6.0, 1.6, 12.0, deckY, { rot: true });
    fingers.push(x);
    // cleats
    for (const zz of [fz + 4, fz + 10]) for (const sx of [-1, 1]) b.box('metal', x + sx * 0.7, deckY, zz, 0.08, 0.06, 0.3, { color: '#2a2a2a' });
  }
  // steel piles with caps
  for (let i = 0; i <= 8; i++) {
    const x = -L / 2 + i * 9;
    for (const zz of [fz - 1.8, fz + 1.8]) {
      if (zz > fz && i % 2) continue;
      b.cyl('galv', x, -6, zz, 0.2, 10.8, { segs: 10, color: weather('#8a8e88', wear * 0.6), caps: '' });
      b.cyl('plastic', x, 4.8, zz, 0.24, 0.3, { rTop: 0.05, segs: 10, color: '#e8e4dc' });
    }
  }
  for (const x of fingers) b.cyl('galv', x, -6, fz + 13.8, 0.18, 10.2, { segs: 8, color: weather('#8a8e88', wear * 0.6), caps: '' });
  // gangway from the shore bulkhead down to the float (a ramp)
  const gx = -L / 2 + 14, gz0 = shoreZ + 1, gz1 = fz - 1.5;
  const gl = gz1 - gz0;
  b.push().translate(gx, 0, 0);
  b.poly('diamond_plate', [[-0.8, shoreY, gz0], [0.8, shoreY, gz0], [0.8, deckY, gz1], [-0.8, deckY, gz1]], { color: '#c8ccce', want: [0, 1, 0.1] });
  b.poly('metal', [[0.8, shoreY - 0.25, gz0], [-0.8, shoreY - 0.25, gz0], [-0.8, deckY - 0.25, gz1], [0.8, deckY - 0.25, gz1]], { color: '#6a6e70', want: [0, -1, -0.1] });
  for (const sx of [-0.85, 0.85]) {
    b.beam('galv', [sx, shoreY + 1.0, gz0], [sx, deckY + 1.0, gz1], 0.05, 0.05, { color: '#c8ccce' });
    b.beam('galv', [sx, shoreY - 0.1, gz0], [sx, deckY - 0.1, gz1], 0.05, 0.25, { color: '#9aa0a2' });
    for (let k = 0; k <= 8; k++) { const t = k / 8; b.box('galv', sx, shoreY + (deckY - shoreY) * t - 0.05, gz0 + gl * t, 0.04, 1.05, 0.04, { color: '#c8ccce' }); }
  }
  b.pop();
  ctx.ramp(gx, (gz0 + gz1) / 2, 1.6, gl, deckY, shoreY, PI);
  // shore bulkhead + apron (timber wall) + the harbormaster shack
  b.box('wood_raw', 0, -3, shoreZ, L + 6, shoreY + 3, 0.6, { color: '#3a2e24' });
  b.box('concrete', 0, shoreY - 0.3, shoreZ - 3, L + 6, 0.3, 6, { color: '#8a8a86' });
  ctx.floor(0, shoreZ - 3, L + 6, 6, shoreY);
  ctx.col(0, shoreZ, L + 6, 0.6, shoreY + 1);
  const hx = -L / 2 + 6, hz = shoreZ - 3.5;
  b.push().translate(0, shoreY, 0);
  walls(ctx, { W: 4.5, D: 3.5, cx: hx, cz: hz, y0: 0, y1: 2.5, key: 'siding_panel', color: weather('#2f5a7a', wear * 0.6), trim: '#e8e4da', thick: 0.15, corner: 0.1,
    sides: [[{ kind: 'door', u: 1.0, y: 0.05, w: 0.9, h: 2.05, style: 'steel', color: '#e8e4da', id: 'harbormaster' }, { kind: 'win', u: 3.0, y: 1.0, w: 1.2, h: 1.0, style: 'slider', light: st > 0.2 ? LIGHT.warm : LIGHT.off, cell: 7 }], [{ kind: 'win', u: 1.75, y: 1.0, w: 1.0, h: 0.9, style: 'slider', light: st > 0.2 ? LIGHT.warm : LIGHT.off, cell: 7 }], [], []] });
  roofShed(ctx, { W: 4.5, D: 3.5, cx: hx, cz: hz, yLow: 2.5, yHigh: 3.0, high: 'back', key: 'metal_corr', color: '#ffffff', trim: '#e8e4da', eave: 0.3, rake: 0.2, icicles: 0.6 });
  porchLight(ctx, hx - 2.25 + 1.7, 2.1, hz + 1.78, 0, st > 0.15);
  sign(ctx, 'harbor_sign', hx, 2.85, hz + 1.85, 4.2, 0.45, { kind: 'paint', ppm: 130, bg: '#f2f0e8', border: '#2f5a7a', lines: [{ text: (ctx.name || 'SMALL BOAT HARBOR').toUpperCase(), size: 0.5, color: '#2f5a7a', font: 'Arial, sans-serif', weight: 'bold', spacing: 0.08 }] });
  b.pop();
  ctx.col(hx, hz, 4.5, 3.5, shoreY + 3);
  ctx.point('harbormaster', hx - 2.25 + 1.0, shoreY, hz + 2.6, PI);
  // dock lights along the main float
  for (let i = 0; i < 5; i++) {
    const x = -L / 2 + 8 + i * 15;
    b.cyl('galv', x, deckY, fz - 1.3, 0.05, 3.6, { segs: 6, color: '#a8aeb0' });
    b.box('metal', x, deckY + 3.55, fz - 1.3, 0.3, 0.2, 0.3, { color: '#2a2a2a' });
    b.box('neon', x, deckY + 3.53, fz - 1.3, 0.2, 0.02, 0.2, { color: st > 0.15 ? [7, 4.2, 1.4] : [0.05, 0.05, 0.05] });
    if (st > 0.15 && i % 2 === 0) ctx.light(x, deckY + 3.2, fz - 1.3, 0xffb060, 2.0, 14);
  }
  // boats in the slips (fishing boats + skiffs), tied up between fingers
  let n = 0;
  for (let i = 0; i < fingers.length - 1; i++) {
    const x = (fingers[i] + fingers[i + 1]) / 2;
    if (r() < 0.25) continue;
    b.push().translate(x, -0.85, fz + 8.0).rotateY(PI + (r() - 0.5) * 0.06);
    if (r() < 0.7) addProp(b, 'fishingBoat', { L: 10 + r() * 2.5, name: BOAT_NAMES[(n++ + ctx.seed) % BOAT_NAMES.length], lit: r() < 0.3 }, r);
    else { b.translate(0, 0.55, 0); addProp(b, 'skiff', {}, r); }
    b.pop();
  }
  // a skiff tied along the main float
  b.push().translate(L / 2 - 10, 0.05, fz - 2.8).rotateY(HALF_PI);
  addProp(b, 'skiff', { color: '#2a4a6a' }, r);
  b.pop();
  // life ring stands + a fish cleaning table on the float
  for (const x of [-L / 2 + 20, L / 2 - 16]) {
    b.box('galv', x, deckY, fz + 1.2, 0.08, 1.4, 0.08, { color: '#a8aeb0' });
    b.push().translate(x, deckY + 1.15, fz + 1.25).rotateX(HALF_PI);
    b.lathe('plastic', 0, -0.05, 0, [[0.18, 0], [0.28, 0.03], [0.3, 0.05], [0.28, 0.07], [0.18, 0.1]], { segs: 14, color: '#e8501a' });
    b.pop();
  }
  b.box('chrome', 4, deckY, fz - 0.9, 2.0, 0.9, 0.7, { color: '#c8cccc' });
  b.cyl('galv', 4.8, deckY + 0.9, fz - 1.1, 0.02, 0.4, { segs: 4, color: '#c8cccc' });
  ctx.point('cleaningTable', 4, deckY, fz + 0.2, PI);
  ctx.point('gangwayTop', gx, shoreY, gz0 - 1.0, 0);
  ctx.point('gangwayBottom', gx, deckY, gz1 + 0.8, PI);
  fingers.forEach((x, i) => ctx.point('slip' + (i + 1), x + 0.9, deckY, fz + 6, -HALF_PI));
  ctx.doors.push({ id: 'harbormaster', x: hx - 2.25 + 1.0, z: hz + 1.75 + 0.1, rot: 0, w: 0.9, leadsTo: 'exterior' });
  return finish(ctx);
}
