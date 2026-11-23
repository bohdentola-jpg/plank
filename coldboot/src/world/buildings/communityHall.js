// Parish Hall / community hall: a long front-gable hall with an entry porch.
// Interior: folding tables and chairs, a small stage with curtains and a podium,
// a kitchen behind a pass-through, coffee urns, a bulletin board.
import { makeCtx, finish, sign, weather, rgb, LIGHT, PI, HALF_PI } from './common.js';
import { civic } from './civic.js';
import { orthodoxCross } from '../props.js';
import { floor, ceiling, partition, wallColliders, table, chair, kitchen, wallPicture } from './furniture.js';
import { ceilingLamp, tubeLight } from './common.js';

export function build(opts = {}) {
  const ctx = makeCtx('communityHall', opts);
  const b = ctx.b, st = ctx.state, wear = ctx.wear;
  const W = 12, D = 20, fy = 0.5, sH = 3.6;
  ctx.footprint = { w: W + 2, d: D + 4 };
  const trim = weather('#f0ece2', wear * 0.4);
  const res = civic(ctx, {
    W, D, fy, storeys: 1, sH, key: wear > 0.6 ? 'siding_lap_old' : 'siding_lap', color: weather('#a8bca0', wear * 0.6), trim,
    roof: { type: 'gable', axis: 'z', pitch: 0.55, key: 'metal_corr_paint', color: weather('#2a4f78', wear * 0.5), icicles: 0.5 },
    win: { w: 1.0, h: 1.5, per: 3.0, style: 'dh', cell: 0, sill: 1.0, lit: (s, k, i) => (st > 0.2 && i % 2 === 0 ? [1.0, 0.86, 0.62] : LIGHT.off), sides: [false, true, false, true] },
    doors: [{ side: 0, u: W / 2, w: 1.8, h: 2.3, style: 'double', color: weather('#6a3020', wear * 0.4), id: 'front', main: true, leaf: ctx.wantInterior ? 'leaf_front' : null },
      { side: 2, u: W * 0.25, w: 0.95, style: 'steel', color: '#6a6a66', id: 'kitchen' }],
    extraOps: [[0, { kind: 'win', u: W / 2, y: fy + sH + 0.4, w: 1.0, h: 0.9, style: 'grid', gx: 2, gy: 2, light: LIGHT.off, cell: 0 }],
      [0, { kind: 'win', u: W * 0.2, y: fy + 1.0, w: 0.9, h: 1.4, style: 'dh', light: LIGHT.off, cell: 0 }], [0, { kind: 'win', u: W * 0.8, y: fy + 1.0, w: 0.9, h: 1.4, style: 'dh', light: LIGHT.off, cell: 0 }]],
    entry: { type: 'porch', w: 4.0, d: 2.2, h: 2.4, roofKey: 'metal_corr_paint', roofColor: weather('#2a4f78', wear * 0.5) },
    access: 'steps',
    inner: ctx.wantInterior ? { key: 'plaster', color: '#e8e0c8', trim: '#7a5a3a', y0: fy, y1: fy + sH } : null,
    noCollider: ctx.wantInterior,
  });
  b.push().translate(-W / 2, 0, D / 2);
  sign(ctx, 'hall_sign', W / 2, fy + sH + 0.05, 0.05, 3.2, 0.5, { kind: 'paint', ppm: 130, bg: '#f0ece2', border: '#2a4f78', fade: Math.max(0, wear - 0.3), lines: [{ text: (ctx.name || 'Parish Hall').toUpperCase(), size: 0.55, color: '#2a4f78', font: 'Georgia, serif', weight: 'bold', spacing: 0.1 }] });
  b.pop();
  // a small cross on the gable peak
  b.push().translate(0, res.yRidge + 0.15, D / 2 + 0.3);
  orthodoxCross(b, 'paint', 1.2, '#f0ece2', { t: 0.06 });
  b.pop();
  ctx.doors.push({ id: 'front', x: 0, z: D / 2 + 0.1, rot: 0, w: 1.8, leadsTo: ctx.wantInterior ? 'interior' : 'exterior' });
  ctx.point('door', 0, 0, D / 2 + 3.6, PI);
  if (ctx.wantInterior) interior(ctx, { W, D, fy, sH });
  return finish(ctx);
}

function interior(ctx, { W, D, fy, sH }) {
  const b = ctx.b;
  const iw = W - 0.5, id = D - 0.5;
  floor(ctx, 0, 0, iw, id, fy, 'floor_wood', '#c8a880');
  ceiling(ctx, 0, 0, iw, id, fy + sH, 'plaster', '#efe8d8');
  // stage at the back with curtains + podium
  const sz = -id / 2 + 1.6, sh = 0.6;
  b.box('i:wood_dark', 0, fy, sz, iw, sh, 3.2, { color: '#7a5030' });
  ctx.floor(0, sz, iw, 3.2, fy + sh);
  for (let i = 0; i < 3; i++) b.box('i:wood_dark', 0, fy + (sh * i) / 3, sz + 1.6 + 0.3 * (3 - i) - 0.15, 2.2, sh / 3, 0.3, { color: '#8a6040' });
  ctx.ramp(0, sz + 1.6 + 0.45, 2.2, 0.9, fy, fy + sh, PI);
  for (const sx of [-1, 1]) for (let k = 0; k < 6; k++) b.box('i:fabric', sx * (iw / 2 - 0.35 - k * 0.12), fy + sh, sz + 1.5, 0.12, sH - sh - 0.2, 0.08 + (k % 2) * 0.05, { color: '#7a1a24' });
  b.box('i:fabric', 0, fy + sH - 0.55, sz + 1.55, iw, 0.45, 0.1, { color: '#6a141c' });
  b.push().translate(0, fy + sh, sz + 0.6);
  b.box('i:wood_dark', 0, 0, 0, 0.6, 1.1, 0.45, { color: '#5a3a20' });
  b.poly('i:wood_dark', [[-0.32, 1.1, 0.25], [0.32, 1.1, 0.25], [0.32, 1.25, -0.2], [-0.32, 1.25, -0.2]], { color: '#6a4424', want: [0, 1, 0.5] });
  b.cylBetween('i:metal', [0.1, 1.2, 0], [0.12, 1.5, 0.2], 0.008, { segs: 4, color: '#2a2a2a' });
  b.pop();
  ctx.point('stage', 0, fy + sh, sz, 0);
  ctx.point('podium', 0, fy + sh, sz + 0.1, 0);
  // kitchen at the back-left behind a partition with a pass-through window
  const kx = -iw / 2 + 3.2;
  partition(ctx, kx, sz + 1.6, kx, sz + 5.6, fy, sH, { color: '#d8ccb0' });
  partition(ctx, -iw / 2, sz + 5.6, kx, sz + 5.6, fy, sH, { color: '#d8ccb0', doors: [{ at: 0.9, w: 0.9, leaf: true, color: '#6a4a2a' }] });
  kitchen(ctx, -iw / 2 + 0.35, fy, sz + 3.6, HALF_PI, { w: 3.0, stove: true, fridge: false, color: '#c8c0a8' });
  b.box('i:wood_dark', kx + 0.1, fy + 0.95, sz + 3.6, 0.3, 0.05, 1.8, { color: '#8a6040' });
  ctx.point('kitchen', -iw / 2 + 1.4, fy, sz + 3.6, -HALF_PI);
  ctx.point('kitchenPass', kx + 0.8, fy, sz + 3.6, -HALF_PI);
  // folding tables with chairs, coffee table with urns
  for (let row = 0; row < 3; row++) {
    for (const x of [-1.6, 2.4]) {
      const z = -1.0 + row * 2.6;
      table(ctx, x, fy, z, 0, { w: 2.4, d: 0.76, key: 'solid', color: '#d8d4c8', cloth: row === 1 ? '#f0ece4' : null });
      for (const s of [-1, 1]) for (let k = -1; k <= 1; k++) chair(ctx, x + k * 0.75, fy, z + s * 0.62, s > 0 ? PI : 0, { folding: true, color: '#5a4a3a' });
    }
  }
  ctx.point('tables', 0.4, fy, 1.6, PI);
  table(ctx, iw / 2 - 0.6, fy, -1.0, HALF_PI, { w: 1.8, d: 0.6, key: 'solid', color: '#d8d4c8', cloth: '#e8e0d0' });
  for (const z of [-1.4, -0.7]) { b.cyl('i:chrome', iw / 2 - 0.6, fy + 0.75, z, 0.15, 0.45, { segs: 10, color: '#c8cccc' }); b.cyl('i:plastic', iw / 2 - 0.6, fy + 1.2, z, 0.08, 0.06, { segs: 8, color: '#1a1a1a' }); }
  ctx.point('coffee', iw / 2 - 1.3, fy, -1.0, HALF_PI);
  wallPicture(ctx, 'hall_board', iw / 2 - 0.02, fy + 1.6, 2.5, -HALF_PI, 1.4, 0.9, { draw: drawBoard }, { frame: '#6a4a2a' });
  ctx.point('bulletinBoard', iw / 2 - 0.9, fy, 2.5, HALF_PI);
  for (const z of [-4, 0, 4]) ceilingLamp(ctx, 0, fy + sH, z, { drop: 0.6, shade: '#e8e0c8', glow: [6, 5, 3.6] });
  wallColliders(ctx, W, D, 0, 0, [{ side: 0, u: W / 2, w: 1.8 }, { side: 2, u: W * 0.25, w: 0.95 }], sH);
  ctx.point('door_in', 0, fy, D / 2 - 1.0, PI);
  ctx.doors.push({ id: 'front_in', x: 0, z: D / 2 - 0.6, rot: PI, w: 1.8, leadsTo: 'exterior' });
  void tubeLight; void rgb;
}

function drawBoard(g, W, H) {
  g.fillStyle = '#a8845a'; g.fillRect(0, 0, W, H);
  const items = [['FISH FRY', '#fff8d8'], ['BINGO TUES', '#d8f0ff'], ['SNOWMACHINE RACE', '#ffe0d8'], ['COUNCIL MTG 7PM', '#e8ffd8'], ['CHOIR', '#fff'], ['LOST DOG', '#ffe8a8']];
  items.forEach(([t, c], i) => {
    const x = (i % 3) * W / 3 + 6, y = Math.floor(i / 3) * H / 2 + 6;
    g.fillStyle = c; g.fillRect(x, y, W / 3 - 12, H / 2 - 14);
    g.fillStyle = '#2a2a2a'; g.font = `bold ${H * 0.07}px Arial`; g.fillText(t, x + 4, y + H * 0.1, W / 3 - 20);
    for (let l = 0; l < 3; l++) g.fillRect(x + 4, y + H * 0.17 + l * H * 0.06, (W / 3 - 24) * 0.8, 2);
  });
}
