// Koshkin's General Merchandise, est. 1911: a two-storey false-front Western
// storefront with big display windows, a covered boardwalk porch with a bench,
// a hand-painted sign (faded when run-down, crisp when restored) lit by
// gooseneck lamps. Interior: counter with an old brass register, stocked
// shelves and aisles, a pot-bellied stove, a back room.
import {
  makeCtx, finish, walls, wallFace, roofGable, sideFrame, porch, steps, gooseneck, sign, stovepipe, raisedFloor,
  porchLight, weather, rgb, LIGHT, PI, HALF_PI, windowCond, windowUnit, doorUnit,
} from './common.js';
import { addProp } from '../props.js';
import {
  floor, ceiling, partition, wallColliders, counter, shelf, woodStove, chair, desk, filingCabinet, cooler, wallPicture, rug, table,
} from './furniture.js';
import { ceilingLamp } from './common.js';

export function build(opts = {}) {
  const ctx = makeCtx('generalStore', opts);
  const b = ctx.b, r = ctx.rng, st = ctx.state, wear = ctx.wear;
  const W = 9.6, D = 15, fy = 0.55;
  const s1 = 3.7, s2 = 3.0;
  const wallTop = fy + s1 + s2;
  const frontTop = wallTop + 3.0;
  const pitch = 0.45;
  const yRidge = wallTop + (W / 2) * pitch;
  const body = weather(st > 0.5 ? '#e8dcc0' : '#c8b898', wear * 0.9);
  const trim = weather('#2f4a3a', wear * 0.7);
  const key = wear > 0.55 ? 'siding_lap_old' : 'siding_lap';
  const bodyC = key === 'siding_lap_old' ? weather('#d8d0c0', wear * 0.3) : body;
  ctx.footprint = { w: W + 1, d: D + 3.4 };
  const inner = ctx.wantInterior ? { key: 'plaster', color: '#e8dcc4', trim: '#6a4a2a', y0: fy, y1: fy + s1 } : null;

  // ---- side + back walls (front is the false front, built below)
  const sides = [[], [], [], []];
  for (const s of [1, 3]) {
    for (const t of [0.25, 0.55, 0.85]) sides[s].push({ kind: 'win', u: D * t, y: fy + s1 + 0.9, w: 0.85, h: 1.5, style: 'dh', light: ctx.lit(0.35), cond: windowCond(ctx), cell: 5 });
    sides[s].push({ kind: 'win', u: D * 0.78, y: fy + 1.2, w: 0.9, h: 1.3, style: 'dh', light: st > 0.3 ? [1, 0.85, 0.6] : LIGHT.off, cell: 4, cond: windowCond(ctx) });
  }
  sides[2].push({ kind: 'door', u: W * 0.3, y: fy, w: 0.9, h: 2.05, style: 'plank', color: weather('#6a4a2a', wear), id: 'back' });
  sides[2].push({ kind: 'win', u: W * 0.7, y: fy + s1 + 0.9, w: 0.85, h: 1.5, style: 'dh', light: ctx.lit(0.4), cond: windowCond(ctx), cell: 0 });
  walls(ctx, {
    W, D, y0: fy - 0.05, y1: wallTop, key, color: bodyC, trim, sides, gable: { axis: 'z', yRidge }, skip: [true, false, false, false],
    thick: 0.22, corner: 0.14, inner,
  });
  roofGable(ctx, { W, D, yEave: wallTop, pitch, axis: 'z', eave: 0.4, rake: 0.25, key: st > 0.4 ? 'metal_corr' : 'metal_corr_rust', color: '#ffffff', trim: weather('#d8d0c0', wear), wear, cz: -0.2 });

  // ---- false front
  b.push().translate(-W / 2, 0, D / 2);
  const fw = W + 0.6; // false front a bit wider than the body
  b.translate(-0.3, 0, 0);
  const openings = [];
  const doorOp = { kind: 'door', u: fw / 2, y: fy, w: 1.8, h: 2.45, style: 'store2', frame: weather('#2f4a3a', wear * 0.5), light: st > 0.3 ? LIGHT.warm : LIGHT.off, cell: 4, id: 'front', leaf: ctx.wantInterior ? 'leaf_front' : null };
  openings.push(doorOp);
  const dispL = { kind: 'win', u: fw / 2 - 2.55, y: fy + 0.55, w: 2.9, h: 2.3, style: 'store', gx: 2, transom: 0.55, light: st > 0.25 ? [1.0, 0.82, 0.58] : LIGHT.off, cell: 4, cond: wear > 0.75 ? 'boarded' : 'ok', sill: false, trim };
  const dispR = { ...dispL, u: fw / 2 + 2.55, cond: wear > 0.6 ? 'boarded' : 'ok' };
  openings.push(dispL, dispR);
  for (const u of [fw * 0.2, fw * 0.5, fw * 0.8]) openings.push({ kind: 'win', u, y: fy + s1 + 0.95, w: 0.9, h: 1.6, style: 'dh', light: ctx.lit(0.45), cond: windowCond(ctx), cell: 5 });
  const holes = openings.map((op) => ({ x0: op.u - (op.w ?? 0.9) / 2, x1: op.u + (op.w ?? 0.9) / 2, y0: op.y, y1: op.y + (op.h ?? 2.1) }));
  wallFace(b, key, [[0, fy - 0.05], [fw, fy - 0.05], [fw, frontTop], [0, frontTop]], holes, 0, { color: bodyC, vgrad: [fy, fy + 2.2, 0.82, 1] });
  // false front back side (seen above the roof from behind) + sides
  b.poly('paint', [[fw, wallTop - 0.5, -0.25], [0, wallTop - 0.5, -0.25], [0, frontTop, -0.25], [fw, frontTop, -0.25]], { color: rgb(bodyC, 0.8), want: [0, 0, -1] });
  for (const x of [0, fw]) b.poly('paint', [[x, fy, 0], [x, fy, -0.25], [x, frontTop, -0.25], [x, frontTop, 0]], { color: trim, want: [x === 0 ? -1 : 1, 0, 0] });
  const wall = { thick: 0.25, trim, inner: ctx.wantInterior ? { trim: '#6a4a2a' } : null, recess: 0.1 };
  for (const op of openings) {
    if (op.kind === 'door') doorUnit(ctx, op, wall);
    else windowUnit(ctx, op, wall);
  }
  // kickplate panels under the display windows
  for (const op of [dispL, dispR]) {
    b.boxMinMax('paint', op.u - op.w / 2, fy, 0, op.u + op.w / 2, op.y, 0.06, { color: trim });
    for (const k of [-0.25, 0.25]) b.boxMinMax('paint', op.u + k * op.w - 0.6, fy + 0.1, 0.06, op.u + k * op.w + 0.6, op.y - 0.1, 0.08, { color: rgb(trim, 1.2) });
  }
  // pilasters + storefront cornice + upper cornice with brackets
  for (const u of [0.15, fw - 0.15, fw / 2 - 1.05, fw / 2 + 1.05]) b.boxMinMax('paint', u - 0.15, fy, 0, u + 0.15, fy + s1 - 0.2, 0.1, { color: trim });
  b.boxMinMax('paint', -0.1, fy + s1 - 0.35, 0, fw + 0.1, fy + s1 - 0.05, 0.22, { color: trim });
  b.boxMinMax('paint', -0.25, frontTop - 0.15, 0, fw + 0.25, frontTop + 0.12, 0.5, { color: trim });
  b.boxMinMax('paint', -0.15, frontTop - 0.45, 0, fw + 0.15, frontTop - 0.15, 0.3, { color: rgb(bodyC, 0.95) });
  for (let i = 0; i <= 8; i++) {
    const u = 0.2 + ((fw - 0.4) * i) / 8;
    b.boxMinMax('paint', u - 0.07, frontTop - 0.55, 0, u + 0.07, frontTop - 0.15, 0.42, { color: trim });
  }
  for (const u of [0, fw]) b.boxMinMax('paint', u - 0.15, wallTop - 0.2, 0, u + 0.15, frontTop - 0.15, 0.15, { color: trim });
  // the sign
  const fade = Math.max(0, wear - 0.15) * 1.1;
  sign(ctx, 'koshkin_' + Math.round(fade * 4), fw / 2, frontTop - 1.55, 0.06, fw - 1.0, 1.75, {
    kind: 'paint', ppm: 110, bg: weather('#f2e8cc', fade * 0.5), border: '#2f4a3a', fade, seed: 3,
    lines: [
      { text: (ctx.name || "KOSHKIN'S").replace(/ GENERAL MDSE\.?/i, '').toUpperCase(), size: 0.46, y: 0.37, color: '#7a1f1a', font: '"Rockwell", "Clarendon", Georgia, serif', weight: 'bold', stroke: '#2a1a10', strokeW: 0.05, spacing: 0.03 },
      { text: 'GENERAL MERCHANDISE', size: 0.2, y: 0.74, color: '#2f4a3a', font: 'Georgia, "Times New Roman", serif', weight: 'bold', spacing: 0.12 },
    ],
  });
  sign(ctx, 'koshkin_est', fw / 2, frontTop - 0.3, 0.31, 2.2, 0.26, { kind: 'paint', ppm: 100, bg: rgbCss(rgb(bodyC, 0.95)), lines: [{ text: 'EST. 1911', size: 0.7, color: '#2f4a3a', font: 'Georgia, serif', weight: 'bold', spacing: 0.15 }] });
  sign(ctx, 'koshkin_ru', fw / 2 + 2.9, fy + s1 - 0.55, 0.23, 1.6, 0.28, { kind: 'paint', ppm: 100, bg: '#2f4a3a', lines: [{ text: 'ЛАВКА КОШКИНА', size: 0.55, color: '#e8d8a8', font: 'Georgia, serif', weight: 'bold' }], fade: fade * 0.7 });
  for (const u of [fw * 0.2, fw * 0.5, fw * 0.8]) gooseneck(ctx, u, frontTop - 0.45, 0.32, st > 0.35);
  // "OPEN" sign in the door glass
  if (st > 0.4) b.box('neon', fw / 2 - 0.45, fy + 1.55, -0.05, 0.5, 0.16, 0.01, { color: [5, 0.6, 0.3] });
  b.pop();

  // ---- porch / covered boardwalk with a bench
  const PD = 2.6;
  porch(ctx, 0, D / 2 + PD / 2, fw + 0.3, PD, fy, { wear, roof: true, roofKey: st > 0.4 ? 'metal_corr' : 'metal_corr_rust', roofColor: '#ffffff', postColor: weather('#e8e2d0', wear * 0.8), gap: 1.1, postH: s1 - 0.35, rail: true, key: 'wood_weathered', icicles: st > 0.3 ? 0.6 : 0 });
  steps(ctx, 0, D / 2 + PD, 0, { rise: fy, w: 2.0 });
  b.at(-2.9, fy, D / 2 + 0.55, PI);
  addProp(b, 'bench', { color: weather('#5a3a20', wear) }, r);
  b.pop();
  // ice chest on the porch
  b.push().translate(3.4, fy, D / 2 + 0.6);
  b.box('sheet_metal', 0, 0, 0, 1.3, 1.05, 0.75, { color: weather('#e8ecee', wear * 0.6) });
  b.box('sheet_metal', 0, 1.05, 0, 1.34, 0.08, 0.79, { color: '#c8ccce' });
  sign(ctx, 'ice_chest', 0, 0.6, 0.38, 0.9, 0.36, { kind: 'paint', ppm: 140, bg: '#1a4a8a', lines: [{ text: 'ICE', size: 0.8, color: '#ffffff', font: 'Arial Black, Arial, sans-serif', weight: 'bold' }] });
  b.pop();
  ctx.point('bench', -2.9, fy, D / 2 + 0.95, 0);
  ctx.point('porch', 0, fy, D / 2 + 1.3, PI);
  // foundation skirting + base
  raisedFloor(ctx, { W, D, floorY: fy, skirt: 'plywood', gaps: wear * 0.3, color: weather('#8a7a64', wear), trim });
  // side: propane cage + crates; back: stovepipe
  b.at(W / 2 + 0.8, 0, D / 4, -HALF_PI);
  addProp(b, 'propane', { count: 3 }, r);
  b.pop();
  b.at(-W / 2 - 1.2, 0, -D / 3, 0.3);
  addProp(b, 'pallet', {}, r);
  b.translate(0, 0.14, 0);
  addProp(b, 'crate', {}, r);
  b.pop();
  stovepipe(ctx, 1.2, wallTop + 1.2, -2.5, yRidge + 1.2);
  if (!ctx.wantInterior) ctx.col(0, 0, W, D, wallTop);
  ctx.doors.push({ id: 'front', x: 0, z: D / 2 + 0.1, rot: 0, w: 1.8, leadsTo: ctx.wantInterior ? 'interior' : 'exterior' });
  ctx.doors.push({ id: 'back', x: -W / 2 + W * 0.3 + 0.0, z: -D / 2 - 0.1, rot: PI, w: 0.9, leadsTo: ctx.wantInterior ? 'interior' : 'exterior' });
  ctx.point('door', 0, 0, D / 2 + PD + 1.2, PI);
  ctx.point('sign', 0, frontTop - 1.55, D / 2 + 0.1, 0);
  ctx.light(0, fy + s1 - 0.6, D / 2 + 1.4, 0xffc890, 1.4, 8);

  if (ctx.wantInterior) interior(ctx, { W, D, fy, s1 });
  return finish(ctx);
}

function rgbCss(c) {
  const f = (v) => Math.round(Math.pow(Math.max(0, Math.min(1, v)), 1 / 2.2) * 255);
  return `rgb(${f(c[0])},${f(c[1])},${f(c[2])})`;
}

function interior(ctx, { W, D, fy, s1 }) {
  const b = ctx.b, r = ctx.rng;
  const iw = W - 0.45, id = D - 0.45;
  floor(ctx, 0, 0, iw, id, fy, 'floor_wood', '#d8b088');
  ceiling(ctx, 0, 0, iw, id, fy + s1, 'plaster', '#c8c0a8');
  // pressed-tin ceiling grid
  for (let i = -3; i <= 3; i++) b.box('i:solid', i * 1.3, fy + s1 - 0.03, 0, 0.05, 0.03, id, { color: '#a8a088' });
  // wainscot
  for (const sx of [-1, 1]) b.box('i:wood_panel', sx * (iw / 2 - 0.01), fy, 0, 0.02, 1.0, id, { color: '#8a6040' });
  // back room partition at z = -D/2 + 3.6 with a door
  const pz = -D / 2 + 3.6;
  partition(ctx, -iw / 2, pz, iw / 2, pz, fy, s1, { doors: [{ at: iw * 0.7, w: 0.9, leaf: true, color: '#6a4a2a' }], color: '#d8ccb0', trim: '#6a4a2a' });
  // counter + old register on the right, glass display case in front of it
  counter(ctx, iw / 2 - 1.1, fy, 1.6, -HALF_PI, { w: 3.6, register: 'old', regX: -0.9 });
  ctx.point('counter', iw / 2 - 2.0, fy, 1.6, HALF_PI);
  ctx.point('register', iw / 2 - 1.1, fy + 0.95, 0.7, 0);
  ctx.point('clerk', iw / 2 - 0.45, fy, 1.6, -HALF_PI);
  // display case
  b.push().translate(iw / 2 - 1.1, fy, 4.2);
  b.box('i:wood_dark', 0, 0, 0, 0.65, 0.6, 1.6, { color: '#6a4424' });
  b.box('i:glass_dark', 0, 0.6, 0, 0.6, 0.35, 1.55, { color: [0.02, 0.02, 0.02] });
  for (let i = 0; i < 6; i++) b.box('i:plastic', (r() - 0.5) * 0.3, 0.62, -0.6 + i * 0.24, 0.12, 0.05, 0.15, { color: ['#c8a040', '#8a2a2a', '#2a4a8a'][i % 3] });
  b.pop();
  ctx.point('display', iw / 2 - 2.0, fy, 4.2, HALF_PI);
  // shelves along the left wall, two double aisles in the middle
  shelf(ctx, -iw / 2 + 0.3, fy, 0.5, HALF_PI, { w: 7.0, h: 2.3, d: 0.5, levels: 6 });
  shelf(ctx, -iw / 2 + 0.3, fy, -4.4, HALF_PI, { w: 2.2, h: 2.3, d: 0.5, levels: 6 });
  shelf(ctx, -1.6, fy, 0.2, HALF_PI, { w: 5.0, h: 1.6, d: 0.4, levels: 4, double: true });
  shelf(ctx, 0.6, fy, -0.6, HALF_PI, { w: 3.6, h: 1.6, d: 0.4, levels: 4, double: true });
  ctx.point('shelfL', -iw / 2 + 1.2, fy, 0.5, -HALF_PI);
  ctx.point('aisle1', -0.5, fy, 0.2, 0);
  ctx.point('aisle2', 1.6, fy, -0.6, 0);
  // pot-bellied stove with two chairs, pickle barrel, cracker barrel
  const sx = -0.4, sz = 4.6;
  b.push().translate(sx, fy, sz);
  b.box('i:stone', 0, 0, 0, 1.0, 0.05, 1.0, { color: '#6a6a66' });
  b.lathe('i:metal', 0, 0.05, 0, [[0.2, 0], [0.32, 0.25], [0.36, 0.5], [0.3, 0.8], [0.18, 0.95], [0.12, 1.0]], { segs: 12, color: '#1a1a1a' });
  b.box('i:neon', 0, 0.35, 0.33, 0.16, 0.12, 0.01, { color: [6, 2.2, 0.5] });
  b.cyl('i:metal', 0, 1.0, 0, 0.08, s1 - 1.0, { segs: 8, color: '#1a1a1a', caps: '' });
  b.pop();
  ctx.light(sx, fy + 0.5, sz + 0.5, 0xff8a3a, 1.3, 5);
  chair(ctx, sx - 1.0, fy, sz + 0.3, 0.9, { color: '#6a4a2a' });
  chair(ctx, sx + 1.0, fy, sz + 0.4, -1.0, { color: '#6a4a2a' });
  ctx.colLocal(sx, sz, 0.8, 0.8, 1.2);
  ctx.point('stove', sx, fy, sz + 1.1, PI);
  for (const [bx, bz] of [[1.6, 4.4], [2.1, 3.9]]) {
    b.lathe('i:wood_raw', bx, fy, bz, [[0.25, 0], [0.3, 0.35], [0.25, 0.7], [0.0, 0.71]], { segs: 10, color: '#8a6a44' });
  }
  // cooler at the back wall of the shop
  cooler(ctx, 2.2, fy, pz + 0.55, 0, { w: 2.3, color: '#d8d8d0' });
  ctx.point('cooler', 2.2, fy, pz + 1.6, PI);
  // back room: boxes, a desk, filing cabinet, old safe
  desk(ctx, -iw / 2 + 1.2, fy, -D / 2 + 1.0, 0, { w: 1.4 });
  chair(ctx, -iw / 2 + 1.2, fy, -D / 2 + 1.7, PI);
  filingCabinet(ctx, -iw / 2 + 2.4, fy, -D / 2 + 0.55, 0);
  for (let i = 0; i < 7; i++) b.box('i:osb', 1.0 + (i % 3) * 0.7, fy + Math.floor(i / 3) * 0.5, -D / 2 + 0.8 + (i % 2) * 0.1, 0.6, 0.48, 0.5, { color: '#c8a070', ry: (r() - 0.5) * 0.2 });
  ctx.point('backroom', 0, fy, -D / 2 + 2.0, 0);
  ctx.point('backroomDesk', -iw / 2 + 1.2, fy, -D / 2 + 1.8, PI);
  // posters / old photos
  wallPicture(ctx, 'koshkin_photo', -iw / 2 + 0.02, fy + 2.4, 3.6, HALF_PI, 0.7, 0.5, { draw: drawOldPhoto });
  wallPicture(ctx, 'koshkin_notice', iw / 2 - 0.02, fy + 1.7, -1.5, -HALF_PI, 0.8, 1.0, { draw: drawNotices }, { frame: '#8a6a4a' });
  ctx.point('noticeBoard', iw / 2 - 0.8, fy, -1.5, HALF_PI);
  rug(ctx, 0, fy, 5.4, 1.4, 1.0, '#6a2a1a');
  // lights
  for (const z of [-3.0, 0.5, 4.0]) ceilingLamp(ctx, 0, fy + s1, z, { shade: '#2a4a3a', drop: 0.5 });
  ctx.colliders = ctx.colliders.filter((c) => !(Math.abs(c.w - W) < 0.01 && Math.abs(c.d - D) < 0.01));
  wallColliders(ctx, W, D, 0, 0, [{ side: 0, u: W / 2, w: 1.8 }, { side: 2, u: W * 0.3, w: 0.9 }], s1);
  ctx.point('door_in', 0, fy, D / 2 - 1.0, PI);
  ctx.doors.push({ id: 'front_in', x: 0, z: D / 2 - 0.6, rot: PI, w: 1.8, leadsTo: 'exterior' });
  void table;
}

function drawOldPhoto(g, W, H) {
  g.fillStyle = '#e8dcc0'; g.fillRect(0, 0, W, H);
  g.fillStyle = '#6a5a44'; g.fillRect(W * 0.06, H * 0.08, W * 0.88, H * 0.84);
  g.fillStyle = '#a8987a'; g.fillRect(W * 0.06, H * 0.08, W * 0.88, H * 0.4);
  g.fillStyle = '#4a3a2a';
  g.fillRect(W * 0.2, H * 0.35, W * 0.6, H * 0.4);
  g.fillRect(W * 0.18, H * 0.3, W * 0.64, H * 0.08);
  for (let i = 0; i < 5; i++) { g.fillStyle = '#2a2018'; g.fillRect(W * (0.25 + i * 0.1), H * 0.62, W * 0.04, H * 0.2); g.beginPath(); g.arc(W * (0.27 + i * 0.1), H * 0.6, W * 0.025, 0, Math.PI * 2); g.fill(); }
  g.fillStyle = '#e8dcc0'; g.font = `${H * 0.08}px Georgia, serif`; g.textAlign = 'center'; g.fillText('KOSHKIN & SONS  1911', W / 2, H * 0.94);
}

function drawNotices(g, W, H) {
  g.fillStyle = '#b08a5a'; g.fillRect(0, 0, W, H);
  const cols = ['#fff8e0', '#e8f0ff', '#ffe8e8', '#f0ffe8', '#fffacd'];
  for (let i = 0; i < 9; i++) {
    const x = (i % 3) * W / 3 + W * 0.03, y = Math.floor(i / 3) * H / 3 + H * 0.03;
    g.fillStyle = cols[i % cols.length];
    g.fillRect(x, y, W / 3 - W * 0.06, H / 3 - H * 0.08);
    g.fillStyle = '#333';
    for (let l = 0; l < 4; l++) g.fillRect(x + W * 0.02, y + H * 0.04 + l * H * 0.04, (W / 3 - W * 0.12) * (0.5 + ((i + l) % 3) * 0.2), H * 0.012);
    g.fillStyle = '#c81a1a'; g.beginPath(); g.arc(x + W * 0.13, y + H * 0.01, W * 0.012, 0, Math.PI * 2); g.fill();
  }
}
