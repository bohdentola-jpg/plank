// Port Zarya School (K-12, Home of the Nanuqs): a long single-storey classroom
// wing in blue metal siding with a taller gym block, an entry canopy, a flag,
// a monument sign and a small playground (swings, slide, climbing frame, hoop).
import { makeCtx, finish, walls, roofGable, sign, flagpole, sideFrame, weather, rgb, LIGHT, PI, HALF_PI, windowCond } from './common.js';
import { civic, monumentSign } from './civic.js';
import { addProp } from '../props.js';

export function build(opts = {}) {
  const ctx = makeCtx('school', opts);
  const b = ctx.b, r = ctx.rng, st = ctx.state, wear = ctx.wear;
  const W = 34, D = 13, fy = 0.6, sH = 3.6;
  const blue = weather('#3a5f8c', wear * 0.6);
  const beige = weather('#d8ccb0', wear * 0.5);
  const trim = weather('#efece4', wear * 0.4);
  ctx.footprint = { w: W + 6, d: D + 30 };
  // classroom wing (front at +Z)
  civic(ctx, {
    W, D, fy, storeys: 1, sH, key: 'metal_corr_paint', color: blue, trim, corner: 0.15,
    roof: { type: 'gable', axis: 'x', pitch: 0.25, key: 'metal_corr_paint', color: weather('#5a5e62', wear * 0.4), icicles: 0.3 },
    win: { w: 2.2, h: 1.4, per: 3.6, style: 'slider', sill: 1.0, cell: 7, lit: (s, k, i) => (st > 0.2 && i % 3 === 1 ? LIGHT.office : LIGHT.off), sides: [true, false, true, true], margin: 2.0 },
    doors: [{ side: 0, u: W * 0.5, w: 1.9, h: 2.3, style: 'store2', frame: '#a8aeb0', id: 'front', main: true, light: st > 0.2 ? LIGHT.office : LIGHT.off, cell: 7 },
      { side: 3, u: D * 0.5, w: 0.95, style: 'steel', color: '#6a7a8a', id: 'side' }],
    entry: { type: 'canopy', w: 5.0, d: 3.2, h: 2.9, roofKey: 'sheet_metal', roofColor: trim },
    access: 'both',
  });
  // beige band under the windows (two-tone)
  for (const s of [0, 2]) {
    sideFrame(b, s, W, D);
    b.boxMinMax('sheet_metal', 0, fy - 0.05, 0.004, W, fy + 0.85, 0.02, { color: beige });
    b.pop();
  }
  // gym block behind, offset left
  const GW = 18, GD = 20, gx = -W / 2 + GW / 2 + 1.0, gz = -D / 2 - GD / 2 + 0.01;
  const gTop = fy + 7.2;
  const gs = [[], [], [], []];
  gs[3].push({ kind: 'door', u: GD * 0.3, y: fy, w: 1.8, h: 2.3, style: 'double', color: '#5a6a7a', id: 'gym' });
  for (let i = 0; i < 4; i++) gs[1].push({ kind: 'win', u: 3 + i * 4.5, y: fy + 4.8, w: 2.5, h: 1.2, style: 'grid', gx: 4, gy: 2, light: LIGHT.off, cell: 7, cond: windowCond(ctx) });
  for (let i = 0; i < 3; i++) gs[3].push({ kind: 'win', u: 8 + i * 4.5, y: fy + 4.8, w: 2.5, h: 1.2, style: 'grid', gx: 4, gy: 2, light: st > 0.4 && i === 1 ? LIGHT.office : LIGHT.off, cell: 7, cond: windowCond(ctx) });
  walls(ctx, { W: GW, D: GD, cx: gx, cz: gz, y0: fy - 0.05, y1: gTop, key: 'metal_corr_paint', color: beige, trim, sides: gs, skip: [true, false, false, false], gable: { axis: 'z', yRidge: gTop + (GW / 2) * 0.22 }, thick: 0.25, corner: 0.15 });
  roofGable(ctx, { W: GW, D: GD, cx: gx, cz: gz, yEave: gTop, pitch: 0.22, axis: 'z', eave: 0.4, rake: 0.3, key: 'metal_corr_paint', color: weather('#5a5e62', wear * 0.4) });
  b.box('concrete', gx, -0.1, gz, GW + 0.1, fy + 0.1, GD + 0.1, { color: '#8a8a86', skip: 't' });
  ctx.col(gx, gz, GW, GD, gTop);
  // mascot mural on the gym end wall (polar bear) — painted sign
  sideFrame(b, 1, GW, GD, gx, gz);
  sign(ctx, 'school_mural', GD * 0.5, fy + 2.2, 0.03, 8.0, 2.6, { kind: 'paint', ppm: 50, fade: wear * 0.8, seed: 7, draw: drawMural }, { back: false });
  b.pop();
  // sign over the entry + monument
  b.push().translate(-W / 2, 0, D / 2);
  sign(ctx, 'school_fascia', W / 2, fy + 3.35, 3.25, 5.0, 0.45, { kind: 'paint', ppm: 120, bg: '#f2f0ea', lines: [{ text: (ctx.name || 'Port Zarya School').toUpperCase(), size: 0.6, color: '#1e3a6a', font: 'Arial, Helvetica, sans-serif', weight: 'bold', spacing: 0.08 }] });
  b.pop();
  monumentSign(ctx, 'school_monument', W / 2 - 2, D / 2 + 6.5, 3.4, 1.0, {
    kind: 'paint', ppm: 110, bg: '#1e3a6a',
    lines: [{ text: 'PORT ZARYA SCHOOL', size: 0.3, y: 0.3, color: '#ffffff', font: 'Arial, sans-serif', weight: 'bold' }, { text: 'HOME OF THE NANUQS', size: 0.22, y: 0.62, color: '#e8c040', font: 'Arial, sans-serif', weight: 'bold' }, { text: 'WINTER BREAK DEC 20', size: 0.16, y: 0.86, color: '#d8e0e8', font: 'Arial, sans-serif' }],
  }, { rot: -0.3, board: '#1e3a6a', postKey: 'stone', postColor: '#8a8a86' });
  flagpole(ctx, -W / 2 + 6, D / 2 + 5.5, 9.0);
  // playground (to the right/back)
  const pgx = W / 2 - 6, pgz = -D / 2 - 9;
  b.push().translate(pgx, 0, pgz);
  playground(ctx, r, wear);
  b.pop();
  ctx.point('playground', pgx, 0, pgz + 4, PI);
  ctx.point('swings', pgx - 3, 0, pgz + 1.5, PI);
  ctx.doors.push({ id: 'front', x: 0, z: D / 2 + 0.1, rot: 0, w: 1.9, leadsTo: 'exterior' });
  ctx.doors.push({ id: 'gym', x: gx - GW / 2 - 0.1, z: gz - GD / 2 + GD * 0.3, rot: -HALF_PI, w: 1.8, leadsTo: 'exterior' });
  ctx.point('door', 0, 0, D / 2 + 5.0, PI);
  ctx.point('flag', -W / 2 + 6, 0, D / 2 + 6.3, PI);
  ctx.point('gymDoor', gx - GW / 2 - 1.2, 0, gz - GD / 2 + GD * 0.3, HALF_PI);
  return finish(ctx);
}

function playground(ctx, r, wear) {
  const b = ctx.b;
  const red = weather('#c8302a', wear * 0.6), yel = weather('#e8b820', wear * 0.6), grn = weather('#2a8a4a', wear * 0.6), steel = '#9aa0a4';
  // swing set: A-frames + beam + 3 swings
  for (const x of [-4.6, -1.4]) {
    b.beam('galv', [x, 0, -0.9], [x, 2.4, 0], 0.07, 0.07, { color: steel });
    b.beam('galv', [x, 0, 0.9], [x, 2.4, 0], 0.07, 0.07, { color: steel });
  }
  b.cylBetween('galv', [-4.7, 2.4, 0], [-1.3, 2.4, 0], 0.05, { segs: 8, color: red });
  for (const x of [-4.0, -3.0, -2.0]) {
    for (const dx of [-0.2, 0.2]) b.cylBetween('metal', [x + dx, 2.38, 0], [x + dx, 0.55, 0.05 * (r() - 0.5)], 0.008, { segs: 3, color: '#5a5a5a' });
    b.box('rubber', x, 0.5, 0, 0.5, 0.04, 0.2, { color: '#1a1a1a' });
  }
  // climbing frame with a slide
  b.push().translate(1.8, 0, 0);
  for (const [x, z] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) b.cyl('galv', x, 0, z, 0.05, 2.6, { segs: 8, color: yel });
  b.box('wood_raw', 0, 1.45, 0, 2.1, 0.06, 2.1, { color: '#a88a5a' });
  b.box('sheet_metal', 0, 2.6, 0, 2.4, 0.06, 2.4, { color: grn, rx: 0 });
  b.poly('sheet_metal', [[-1.2, 2.66, -1.2], [1.2, 2.66, -1.2], [0, 3.3, 0]], { color: grn, want: [0, 0.3, -1] });
  b.poly('sheet_metal', [[1.2, 2.66, 1.2], [-1.2, 2.66, 1.2], [0, 3.3, 0]], { color: grn, want: [0, 0.3, 1] });
  b.poly('sheet_metal', [[1.2, 2.66, -1.2], [1.2, 2.66, 1.2], [0, 3.3, 0]], { color: rgb(grn, 0.85), want: [1, 0.3, 0] });
  b.poly('sheet_metal', [[-1.2, 2.66, 1.2], [-1.2, 2.66, -1.2], [0, 3.3, 0]], { color: rgb(grn, 0.85), want: [-1, 0.3, 0] });
  // slide down to +x
  b.poly('plastic', [[1.0, 1.5, -0.3], [3.4, 0.2, -0.3], [3.4, 0.2, 0.3], [1.0, 1.5, 0.3]], { color: red, want: [0.5, 1, 0] });
  for (const z of [-0.33, 0.33]) b.beam('plastic', [1.0, 1.55, z], [3.4, 0.25, z], 0.05, 0.25, { color: red });
  // ladder side
  for (let i = 0; i < 5; i++) b.cylBetween('galv', [-1, 0.3 + i * 0.28, -0.4], [-1, 0.3 + i * 0.28, 0.4], 0.02, { segs: 4, color: steel });
  b.pop();
  ctx.floor(1.8, 0, 2.0, 2.0, 1.48);
  // basketball hoop
  b.push().translate(6, 0, 4).rotateY(-HALF_PI);
  b.cyl('galv', 0, 0, -0.9, 0.08, 3.2, { segs: 8, color: steel });
  b.beam('galv', [0, 3.0, -0.9], [0, 3.1, -0.15], 0.06, 0.06, { color: steel });
  b.box('sheet_metal', 0, 2.75, -0.1, 1.5, 1.05, 0.04, { color: '#e8e8e4' });
  b.box('paint', 0, 2.92, -0.075, 0.55, 0.42, 0.01, { color: '#c8302a' });
  b.push().translate(0, 3.05, 0.15).rotateX(HALF_PI);
  b.cyl('metal', 0, -0.012, 0, 0.23, 0.024, { segs: 14, color: '#d85a1a', caps: '' });
  b.pop();
  b.pop();
  // seesaw
  b.box('galv', -3, 0, 4.0, 0.2, 0.45, 0.3, { color: steel });
  b.box('wood_raw', -3, 0.42, 4.0, 3.2, 0.05, 0.25, { color: yel, rz: 0.16 });
  // chain-link fence along the back
  for (let i = 0; i < 6; i++) {
    b.push().translate(-7 + i * 3, 0, -4);
    addProp(b, 'fenceChain', { len: 3, h: 1.5, end: i === 5 }, r);
    b.pop();
  }
}

function drawMural(g, W, H) {
  const gr = g.createLinearGradient(0, 0, 0, H);
  gr.addColorStop(0, '#2a4a7a'); gr.addColorStop(0.6, '#6a8ab8'); gr.addColorStop(1, '#e8eef4');
  g.fillStyle = gr; g.fillRect(0, 0, W, H);
  // northern lights band
  g.fillStyle = 'rgba(80,230,160,0.5)';
  g.beginPath(); g.moveTo(0, H * 0.25); g.bezierCurveTo(W * 0.3, H * 0.05, W * 0.6, H * 0.45, W, H * 0.15); g.lineTo(W, H * 0.3); g.bezierCurveTo(W * 0.6, H * 0.55, W * 0.3, H * 0.2, 0, H * 0.4); g.fill();
  // polar bear
  g.fillStyle = '#f4f2ec';
  g.beginPath(); g.ellipse(W * 0.32, H * 0.68, W * 0.16, H * 0.14, 0, 0, Math.PI * 2); g.fill();
  g.beginPath(); g.ellipse(W * 0.47, H * 0.6, W * 0.06, H * 0.08, -0.3, 0, Math.PI * 2); g.fill();
  for (const x of [0.2, 0.28, 0.36, 0.42]) g.fillRect(W * x, H * 0.72, W * 0.035, H * 0.2);
  g.fillStyle = '#1a1a1a'; g.beginPath(); g.arc(W * 0.5, H * 0.58, H * 0.012, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#1e3a6a'; g.font = `bold ${H * 0.2}px Arial Black, Arial, sans-serif`; g.textAlign = 'center';
  g.fillText('NANUQS', W * 0.75, H * 0.72);
}
