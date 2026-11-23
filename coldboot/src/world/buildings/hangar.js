// Tolliver Air hangar: a front-gable metal hangar with big sliding doors (one
// leaf pulled open), a lean-to office, painted name, apron, fuel drums.
import { makeCtx, finish, walls, roofGable, roofShed, sign, sideFrame, porchLight, steps, weather, rgb, LIGHT, PI, HALF_PI, windowCond } from './common.js';
import { addProp } from '../props.js';
import { windsock } from './terminal.js';

export function build(opts = {}) {
  const ctx = makeCtx('hangar', opts);
  const b = ctx.b, r = ctx.rng, st = ctx.state, wear = ctx.wear;
  const W = 20, D = 18, H = 6.0, pitch = 0.25;
  ctx.footprint = { w: W + 10, d: D + 10 };
  const rusty = wear > 0.55;
  const key = rusty ? 'metal_corr_rust' : 'metal_corr_paint';
  const col = rusty ? '#ffffff' : weather('#e8e4da', wear * 0.6);
  const trim = weather('#b8301e', wear * 0.6);
  const yR = H + (W / 2) * pitch;
  // front: a big door opening (14 m × 5 m) closed by two sliding leaves
  const DW = 14, DH = 5.0;
  const sides = [[{ kind: 'door', u: W / 2, y: 0.05, w: DW, h: DH, open: true, casing: 0 }], [], [], []];
  for (const s of [1, 3]) for (const u of [4, 9, 14]) sides[s].push({ kind: 'win', u, y: 3.6, w: 1.6, h: 0.8, style: 'grid', gx: 3, gy: 1, light: st > 0.3 ? LIGHT.office : LIGHT.off, cell: 7, cond: windowCond(ctx) });
  walls(ctx, { W, D, y0: 0, y1: H, key, color: col, trim, sides, gable: { axis: 'z', yRidge: yR }, thick: 0.2, corner: 0.15, bands: false });
  roofGable(ctx, { W, D, yEave: H, pitch, axis: 'z', eave: 0.4, rake: 0.3, key: rusty ? 'metal_corr_rust' : 'metal_corr', color: '#ffffff', trim, icicles: 0.3 });
  b.box('concrete', 0, -0.1, 0, W + 0.2, 0.15, D + 0.2, { color: '#8a8a86', skip: 't' });
  ctx.col(0, 0, W, D, H);
  // door track + two leaves: left one closed, right one slid open
  b.box('metal', 0, DH + 0.05, D / 2 + 0.15, W + 4, 0.18, 0.18, { color: '#3a3a3a' });
  b.box(key, -DW / 4, 0.05, D / 2 + 0.12, DW / 2, DH, 0.08, { color: rusty ? '#ffffff' : weather('#d8d4ca', wear * 0.6) });
  b.box(key, DW / 2 + 1.2, 0.05, D / 2 + 0.22, DW / 2, DH, 0.08, { color: rusty ? '#ffffff' : weather('#d8d4ca', wear * 0.6) });
  // dark interior visible through the open half + a work light
  b.poly('paint', [[0, 0.05, D / 2 - 2], [DW / 2, 0.05, D / 2 - 2], [DW / 2, DH, D / 2 - 2], [0, DH, D / 2 - 2]], { color: '#0e0e10', want: [0, 0, 1] });
  b.box('concrete', DW / 4, 0.0, D / 2 - 1.0, DW / 2, 0.06, 2.0, { color: '#5a5a58' });
  if (st > 0.2) {
    b.box('neon', DW / 4, DH - 0.2, D / 2 - 1.5, 3.0, 0.05, 0.2, { color: [5, 5, 4.5] });
    ctx.light(DW / 4, DH - 0.5, D / 2 - 0.5, 0xf0f0e0, 2.0, 12);
  }
  // painted name on the front gable
  b.push().translate(-W / 2, 0, D / 2);
  sign(ctx, 'tolliver_sign', W / 2, H + 0.8, 0.05, 9.0, 1.1, {
    kind: 'paint', ppm: 90, transparent: true, fade: Math.max(0, wear - 0.2), seed: 11,
    lines: [{ text: (ctx.name || 'TOLLIVER AIR').toUpperCase(), size: 0.62, y: 0.4, color: '#b8301e', font: '"Arial Black", Arial, sans-serif', weight: '900', spacing: 0.08 }, { text: 'CHARTERS · FLIGHT LESSONS · FREIGHT', size: 0.22, y: 0.85, color: '#2a2a2a', font: 'Arial, sans-serif', weight: 'bold' }],
  });
  b.pop();
  // lean-to office on the left side with a door + window
  const ow = 4.0, od = 7.0, ox = -W / 2 - ow / 2;
  const os = [[], [], [], []];
  os[0].push({ kind: 'door', u: 1.2, y: 0.35, w: 0.9, h: 2.05, style: 'steel', color: '#5a5a58', id: 'office', light: LIGHT.dim });
  os[0].push({ kind: 'win', u: 2.9, y: 1.3, w: 1.1, h: 1.0, style: 'slider', light: st > 0.2 ? LIGHT.warm : LIGHT.off, cell: 7 });
  os[3].push({ kind: 'win', u: od / 2, y: 1.3, w: 1.1, h: 1.0, style: 'slider', light: st > 0.2 ? LIGHT.warm : LIGHT.off, cell: 2 });
  walls(ctx, { W: ow, D: od, cx: ox, cz: D / 2 - od / 2 - 1.0, y0: 0, y1: 2.9, key: 'siding_panel', color: weather('#8a2a20', wear * 0.6), trim: '#e8e4da', sides: os, skip: [false, true, false, false], thick: 0.15, corner: 0.1, shed: null });
  roofShed(ctx, { W: ow, D: od, cx: ox, cz: D / 2 - od / 2 - 1.0, yLow: 2.9, yHigh: 3.6, high: 'back', key: 'metal_corr', color: '#ffffff', trim: '#e8e4da', eave: 0.3, rake: 0.2 });
  b.box('concrete', ox, -0.1, D / 2 - od / 2 - 1.0, ow, 0.45, od, { color: '#8a8a86' });
  steps(ctx, ox - ow / 2 + 1.2, D / 2 - 1.0 + 0.0, 0, { rise: 0.35, w: 1.0, solid: true, key: 'concrete', color: '#9a9a94' });
  porchLight(ctx, ox - ow / 2 + 1.9, 2.4, D / 2 - 0.97, 0, st > 0.2);
  ctx.col(ox, D / 2 - od / 2 - 1.0, ow, od, 3.0);
  // apron, drums, windsock, tie-downs
  b.box('asphalt', 0, -0.02, D / 2 + 8, W + 6, 0.03, 16, { color: '#7a7a78' });
  for (let i = 0; i < 4; i++) { b.at(W / 2 + 1.2, 0, D / 2 - 2 - i * 0.66, 0); addProp(b, 'fuelDrum', { color: i % 2 ? '#c8a020' : '#1a4a8a', rust: wear }, r); b.pop(); }
  for (const x of [-6, 6]) b.box('metal', x, 0, D / 2 + 9, 0.15, 0.08, 0.15, { color: '#c8c020' });
  windsock(ctx, -W / 2 - 4, D / 2 + 10, 6.0, 0.9);
  ctx.doors.push({ id: 'office', x: ox - ow / 2 + 1.2, z: D / 2 - 1.0 + 0.1, rot: 0, w: 0.9, leadsTo: 'exterior' });
  ctx.doors.push({ id: 'hangar', x: DW / 4, z: D / 2 + 0.3, rot: 0, w: DW / 2, leadsTo: 'exterior' });
  ctx.point('door', ox - ow / 2 + 1.2, 0, D / 2 + 1.5, PI);
  ctx.point('hangarDoor', DW / 4, 0, D / 2 + 2.0, PI);
  ctx.point('apron', 0, 0, D / 2 + 8, PI);
  ctx.point('helicopter', DW / 4, 0, D / 2 + 6, PI);
  ctx.floor(DW / 4, D / 2 - 1.0, DW / 2, 2.0, 0.06);
  void rgb; void sideFrame; void HALF_PI;
  return finish(ctx);
}
