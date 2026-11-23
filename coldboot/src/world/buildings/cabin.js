// The player's cabin on the shore (Koshkin's late brother's): a small log cabin
// on posts with a rusty steep roof, covered front porch, woodpile, fish rack,
// a skiff on blocks and an old snowmobile. Interior: bed, desk with the laptop
// (Lyosha's Night School), wood stove, wardrobe, shortwave radio, workbench,
// kitchen corner, table — and a smoke alarm that may not be just a smoke alarm.
import {
  makeCtx, finish, walls, roofGable, raisedFloor, porch, steps, stovepipe, porchLight, sideFrame,
  weather, rgb, LIGHT, PI, HALF_PI, windowCond, icicles,
} from './common.js';
import { addProp } from '../props.js';
import {
  floor, ceiling, wallColliders, bed, desk, laptop, woodStove, wardrobe, radio, workbench, kitchen, table, chair, rug,
  wallPicture,
} from './furniture.js';
import { ceilingLamp } from './common.js';

export function build(opts = {}) {
  const ctx = makeCtx('cabin', opts);
  const b = ctx.b, r = ctx.rng, st = ctx.state, wear = ctx.wear;
  const W = 6.0, D = 7.0, fy = 0.55;
  const wallTop = fy + 2.55;
  const pitch = 0.9;
  const yRidge = wallTop + (W / 2) * pitch;
  const logCol = weather('#c09a72', wear * 0.5);
  const trim = weather('#6a4a30', wear * 0.3);
  ctx.footprint = { w: W + 6, d: D + 5 };
  const inner = ctx.wantInterior ? { key: 'logs', color: '#d8b48a', trim: '#8a6a4a', y0: fy, y1: wallTop } : null;
  const sides = [[], [], [], []];
  sides[0].push({ kind: 'door', u: W * 0.35, y: fy, w: 0.9, h: 2.0, style: 'plank', color: weather('#7a5a3a', wear * 0.5), id: 'front', leaf: ctx.wantInterior ? 'leaf_front' : null, light: LIGHT.dim });
  sides[0].push({ kind: 'win', u: W * 0.75, y: fy + 0.95, w: 1.0, h: 1.0, style: 'grid', gx: 2, gy: 2, light: ctx.lit(0.85), cond: windowCond(ctx, -0.2), cell: 2, trim });
  sides[1].push({ kind: 'win', u: D * 0.6, y: fy + 0.95, w: 0.9, h: 1.0, style: 'grid', gx: 2, gy: 2, light: ctx.lit(0.85), cond: windowCond(ctx, -0.2), cell: 0, trim });
  sides[3].push({ kind: 'win', u: D * 0.45, y: fy + 0.95, w: 0.9, h: 1.0, style: 'grid', gx: 2, gy: 2, light: ctx.lit(0.7), cond: windowCond(ctx, -0.2), cell: 3, trim });
  sides[2].push({ kind: 'win', u: W * 0.3, y: fy + 1.25, w: 0.7, h: 0.7, style: 'fixed', light: ctx.lit(0.6), cond: windowCond(ctx, -0.2), cell: 3, trim });
  walls(ctx, {
    W, D, y0: fy - 0.05, y1: wallTop, key: 'logs', color: logCol, trim, sides, gable: { axis: 'x', yRidge }, thick: 0.25, corner: 0, bands: false, inner,
  });
  // log ends at the corners (alternating courses)
  const n = Math.floor((wallTop - fy) / 0.25);
  for (let i = 0; i < n; i++) {
    const y = fy + i * 0.25 + 0.12;
    for (const [x, z] of [[-W / 2, D / 2], [W / 2, D / 2], [W / 2, -D / 2], [-W / 2, -D / 2]]) {
      b.push().translate(x + Math.sign(x) * (i % 2 ? 0.0 : 0.12), y, z + Math.sign(z) * (i % 2 ? 0.12 : 0.0));
      if (i % 2) b.rotateZ(HALF_PI); else b.rotateX(HALF_PI);
      b.cyl('logs', 0, -0.2, 0, 0.125, 0.4, { segs: 8, color: logCol });
      b.pop();
    }
  }
  const roofKey = wear > 0.45 ? 'metal_corr_rust' : 'metal_corr_paint';
  roofGable(ctx, { W, D, yEave: wallTop, pitch, axis: 'x', eave: 0.6, rake: 0.5, key: roofKey, color: roofKey === 'metal_corr_rust' ? '#ffffff' : weather('#2f4a3a', wear * 0.6), trim, soffit: '#8a6a4a', icicles: 0.9 });
  raisedFloor(ctx, { W, D, floorY: fy, skirt: null, postKey: 'wood_raw' });
  // covered porch with steps
  porch(ctx, -W / 2 + W * 0.42, D / 2 + 1.0, W * 0.84, 2.0, fy, { wear, roof: true, roofKey, roofColor: roofKey === 'metal_corr_rust' ? '#ffffff' : '#2f4a3a', postColor: trim, postKey: 'logs', gap: 0.55, postH: 2.2, key: 'wood_weathered', railKey: 'wood_raw', railColor: '#8a6a4a', icicles: 0.6 });
  steps(ctx, -W / 2 + W * 0.35, D / 2 + 2.0, 0, { rise: fy, w: 1.0 });
  porchLight(ctx, -W / 2 + W * 0.35 + 0.7, fy + 2.05, D / 2 + 0.05, 0, st > 0.15);
  b.at(W * 0.12, fy, D / 2 + 1.3, 0.2);
  addProp(b, 'tires', { count: 0 }, r);
  b.pop();
  // stovepipe aligned with the interior stove (x = -1.6, z = -1.2)
  stovepipe(ctx, -1.6, yRidge - 1.2 * pitch + 0.15, -1.2, yRidge + 0.8, { brace: [0.0, -0.6, 0.9] });
  // yard: woodpile against the left wall, fish rack, skiff on blocks, snowmobile, chopping block, outhouse
  b.at(-W / 2 - 0.7, 0, -0.5, HALF_PI);
  addProp(b, 'woodpile', { len: 3.0, h: 1.4 }, r);
  b.pop();
  ctx.point('woodpile', -W / 2 - 1.6, 0, -0.5, HALF_PI);
  b.at(W / 2 + 3.2, 0, 0.5, HALF_PI);
  addProp(b, 'fishRack', { len: 3.0 }, r);
  b.pop();
  b.at(-W / 2 - 3.5, 0, D / 2 + 1.5, -0.4);
  b.box('wood_raw', 0, 0, 1.2, 0.3, 0.3, 0.6, { color: '#5a4a3a' });
  b.box('wood_raw', 0, 0, -1.2, 0.3, 0.3, 0.6, { color: '#5a4a3a' });
  b.translate(0, 0.28, 0);
  addProp(b, 'skiff', { color: weather('#b8bcbe', wear * 0.4) }, r);
  b.pop();
  b.at(W / 2 + 1.6, 0, D / 2 + 2.2, -0.6);
  addProp(b, 'snowmobile', { color: '#b8201a', rust: wear }, r);
  b.pop();
  ctx.point('snowmobile', W / 2 + 1.6, 0, D / 2 + 3.2, PI);
  // chopping block with the axe
  b.push().translate(-W / 2 - 1.8, 0, 1.6);
  b.cyl('wood_raw', 0, 0, 0, 0.3, 0.45, { segs: 10, color: '#8a6a44' });
  b.beam('wood_raw', [0.05, 0.45, 0], [0.45, 0.75, 0.1], 0.04, 0.03, { color: '#a88a5a' });
  b.box('metal', 0.03, 0.42, 0, 0.12, 0.08, 0.02, { color: '#5a5a5a', rz: -0.6 });
  b.pop();
  // outhouse out back
  b.push().translate(1.8, 0, -D / 2 - 4.0).rotateY(PI);
  b.box('wood_weathered', 0, 0, 0, 1.2, 2.1, 1.2, { color: '#8a7a68' });
  b.box('wood_weathered', 0, 0.05, 0.605, 0.7, 1.85, 0.03, { color: '#7a6a58' });
  b.box('metal_corr_rust', 0, 2.1, -0.05, 1.5, 0.04, 1.6, { color: '#ffffff', rx: 0.18 });
  b.cyl('neon', 0, 1.7, 0.62, 0.05, 0.01, { segs: 8, color: [0.02, 0.02, 0.02] }); // the moon cut-out (dark)
  b.pop();
  ctx.col(1.8, -D / 2 - 4.0, 1.2, 1.2, 2.2);
  if (!ctx.wantInterior) ctx.col(0, 0, W, D, wallTop);
  ctx.doors.push({ id: 'front', x: -W / 2 + W * 0.35, z: D / 2 + 0.1, rot: 0, w: 0.9, leadsTo: ctx.wantInterior ? 'interior' : 'exterior' });
  ctx.point('door', -W / 2 + W * 0.35, 0, D / 2 + 3.2, PI);
  ctx.point('porch', 0.5, fy, D / 2 + 1.0, PI);
  ctx.point('fishRack', W / 2 + 3.2, 0, 2.0, PI);
  ctx.point('skiff', -W / 2 - 3.5, 0, D / 2 + 3.2, PI);
  ctx.point('outhouse', 1.8, 0, -D / 2 - 2.7, PI);
  ctx.light(-W / 2 + W * 0.35 + 0.7, fy + 2.0, D / 2 + 0.4, 0xffb060, 1.3, 7);
  if (ctx.wantInterior) interior(ctx, { W, D, fy, wallTop });
  return finish(ctx);
}

function interior(ctx, { W, D, fy, wallTop }) {
  const b = ctx.b;
  const iw = W - 0.5, id = D - 0.5;
  floor(ctx, 0, 0, iw, id, fy, 'floor_wood', '#c8a078');
  ceiling(ctx, 0, 0, iw, id, wallTop, 'wood_raw', '#a88a64');
  for (let i = -2; i <= 2; i++) b.box('i:wood_raw', 0, wallTop - 0.18, i * 1.3, iw, 0.18, 0.14, { color: '#7a5a3a' }); // beams
  // bed in the back-right corner, wardrobe next to it
  bed(ctx, iw / 2 - 0.6, fy, -id / 2 + 1.1, 0, { w: 1.0, blanket: '#5a2a3a' });
  ctx.point('bed', iw / 2 - 1.4, fy, -id / 2 + 1.3, HALF_PI);
  wardrobe(ctx, iw / 2 - 0.35, fy, 0.4, -HALF_PI, { color: '#6a4a2a' });
  ctx.point('wardrobe', iw / 2 - 1.1, fy, 0.4, HALF_PI);
  // desk with the laptop under the right-side window, radio on it
  desk(ctx, iw / 2 - 0.4, fy, D * 0.6 - D / 2 + 0.0, -HALF_PI, { w: 1.3, d: 0.6 });
  laptop(ctx, iw / 2 - 0.45, fy + 0.74, D * 0.6 - D / 2 + 0.2, -HALF_PI);
  radio(ctx, iw / 2 - 0.35, fy + 0.74, D * 0.6 - D / 2 - 0.4, -HALF_PI);
  chair(ctx, iw / 2 - 1.0, fy, D * 0.6 - D / 2 + 0.1, -HALF_PI, { color: '#5a4030' });
  ctx.point('desk', iw / 2 - 1.2, fy, D * 0.6 - D / 2 + 0.1, HALF_PI);
  ctx.point('laptop', iw / 2 - 0.45, fy + 0.76, D * 0.6 - D / 2 + 0.2, -HALF_PI);
  ctx.point('radio', iw / 2 - 0.35, fy + 0.76, D * 0.6 - D / 2 - 0.4, -HALF_PI);
  // desk lamp
  b.cyl('i:metal', iw / 2 - 0.4, fy + 0.74, D * 0.6 - D / 2 + 0.55, 0.07, 0.02, { segs: 8, color: '#2a3a2a' });
  b.beam('i:metal', [iw / 2 - 0.4, fy + 0.76, D * 0.6 - D / 2 + 0.55], [iw / 2 - 0.5, fy + 1.15, D * 0.6 - D / 2 + 0.45], 0.015, 0.015, { color: '#2a3a2a' });
  b.cyl('i:metal', iw / 2 - 0.55, fy + 1.05, D * 0.6 - D / 2 + 0.42, 0.09, 0.1, { rTop: 0.04, segs: 10, color: '#2a4a3a', caps: 't' });
  b.cyl('i:neon', iw / 2 - 0.55, fy + 1.045, D * 0.6 - D / 2 + 0.42, 0.07, 0.008, { segs: 8, color: [6, 4.6, 2.6], caps: 'b' });
  ctx.light(iw / 2 - 0.6, fy + 1.0, D * 0.6 - D / 2 + 0.4, 0xffcf8a, 1.0, 4);
  // wood stove on the left with the pipe up through the roof
  woodStove(ctx, -1.6, fy, -1.2, HALF_PI, { pipe: wallTop - fy - 0.76 + 0.3 });
  ctx.point('stove', -0.6, fy, -1.2, -HALF_PI);
  // workbench along the back wall (left), kitchen corner front-left
  workbench(ctx, -iw / 2 + 1.1, fy, -id / 2 + 0.4, 0, { w: 1.9 });
  ctx.point('workbench', -iw / 2 + 1.1, fy, -id / 2 + 1.2, PI);
  kitchen(ctx, -iw / 2 + 0.33, fy, 1.55, HALF_PI, { w: 1.8, uppers: true, stove: false, color: '#b8a888' });
  ctx.point('kitchen', -iw / 2 + 1.1, fy, 1.55, -HALF_PI);
  // kettle + mug on the counter
  b.cyl('i:metal', -iw / 2 + 0.35, fy + 0.92, 1.0, 0.09, 0.16, { rTop: 0.06, segs: 10, color: '#c8401a' });
  b.cyl('i:plastic', -iw / 2 + 0.4, fy + 0.92, 2.1, 0.04, 0.09, { segs: 8, color: '#e8e2d0' });
  // table + 2 chairs, rug
  rug(ctx, 0.3, fy, 0.9, 2.2, 1.6, '#6a2a2a');
  table(ctx, 0.3, fy, 0.9, 0, { w: 1.0, d: 0.8, color: '#a88058' });
  chair(ctx, 0.3, fy, 0.25, 0, { color: '#6a4a2a' });
  chair(ctx, 0.3, fy, 1.55, PI, { color: '#6a4a2a' });
  ctx.point('table', 0.3, fy, 0.0, 0);
  // parkas on hooks by the door, boots
  b.box('i:wood_raw', -W / 2 + W * 0.35 - 1.0, fy + 1.7, D / 2 - 0.3, 0.8, 0.08, 0.05, { color: '#6a4a2a' });
  for (let i = 0; i < 3; i++) b.box('i:fabric', -W / 2 + W * 0.35 - 1.3 + i * 0.3, fy + 0.9, D / 2 - 0.42, 0.25, 0.8, 0.18, { color: ['#c86a1a', '#2a3a5a', '#4a5a3a'][i] });
  for (let i = 0; i < 2; i++) b.box('i:rubber', -W / 2 + W * 0.35 - 1.2 + i * 0.3, fy, D / 2 - 0.45, 0.14, 0.35, 0.28, { color: '#1a1a1a' });
  // old map of the strait + a calendar
  wallPicture(ctx, 'cabin_map', 0.3, fy + 1.55, -id / 2 + 0.01, 0, 1.1, 0.75, { draw: drawMap }, { frame: '#5a3a20' });
  // ceiling lamp + the smoke alarm (day 7: there's a camera in it)
  ceilingLamp(ctx, 0.3, wallTop - 0.18, 0.9, { drop: 0.4, shade: '#e8d8b0', glow: [6, 4.8, 3.2] });
  b.cyl('i:plastic', 0.9, wallTop - 0.22, -0.6, 0.075, 0.035, { segs: 12, color: '#f0eee8' });
  b.sphere('i:neon', 0.93, wallTop - 0.235, -0.57, 0.006, { rings: 2, segs: 4, color: [0.3, 3, 0.3] });
  ctx.point('smokeAlarm', 0.9, wallTop - 0.24, -0.6, 0);
  wallColliders(ctx, W, D, 0, 0, [{ side: 0, u: W * 0.35, w: 0.9 }], 3);
  ctx.point('door_in', -W / 2 + W * 0.35, fy, D / 2 - 0.9, PI);
  ctx.point('window', W * 0.25, fy, D / 2 - 0.7, 0);
  ctx.doors.push({ id: 'front_in', x: -W / 2 + W * 0.35, z: D / 2 - 0.6, rot: PI, w: 0.9, leadsTo: 'exterior' });
  void icicles; void sideFrame; void rgb;
}

function drawMap(g, W, H) {
  g.fillStyle = '#d8ccaa'; g.fillRect(0, 0, W, H);
  g.fillStyle = '#9ab8c8';
  g.fillRect(W * 0.35, 0, W * 0.3, H);
  g.fillStyle = '#c8b890';
  g.beginPath(); g.moveTo(0, 0); g.lineTo(W * 0.38, 0); g.lineTo(W * 0.3, H * 0.4); g.lineTo(W * 0.36, H); g.lineTo(0, H); g.fill();
  g.beginPath(); g.moveTo(W, 0); g.lineTo(W * 0.62, 0); g.lineTo(W * 0.7, H * 0.5); g.lineTo(W * 0.64, H); g.lineTo(W, H); g.fill();
  g.fillStyle = '#7a1a1a';
  g.beginPath(); g.arc(W * 0.33, H * 0.6, W * 0.012, 0, Math.PI * 2); g.fill();
  g.beginPath(); g.arc(W * 0.69, H * 0.35, W * 0.012, 0, Math.PI * 2); g.fill();
  g.strokeStyle = '#7a1a1a'; g.setLineDash([6, 5]); g.lineWidth = 2;
  g.beginPath(); g.moveTo(W * 0.33, H * 0.6); g.lineTo(W * 0.69, H * 0.35); g.stroke();
  g.fillStyle = '#2a2a2a'; g.font = `${H * 0.06}px Georgia, serif`;
  g.fillText('PORT ZARYA', W * 0.06, H * 0.64); g.fillText('БЕЛЫЙ МЫС', W * 0.72, H * 0.3);
  g.fillText('BERING STRAIT', W * 0.38, H * 0.92);
}
