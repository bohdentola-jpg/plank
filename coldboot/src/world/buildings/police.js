// Port Zarya Police Department: a grey-blue single-storey station with a lit
// sign, a blue light over the door, a radio mast and a barred cell window.
// Interior: front desk + waiting chairs, the chief's office, one cell, radio desk.
import { makeCtx, finish, sign, sideFrame, weather, LIGHT, PI, HALF_PI } from './common.js';
import { civic } from './civic.js';
import { addProp } from '../props.js';
import { secCam } from './cornerStore.js';
import {
  floor, ceiling, partition, wallColliders, counter, chair, desk, filingCabinet, crtMonitor, radio, wallPicture, bench, flatScreen,
} from './furniture.js';
import { tubeLight } from './common.js';

export function build(opts = {}) {
  const ctx = makeCtx('police', opts);
  const b = ctx.b, r = ctx.rng, st = ctx.state, wear = ctx.wear;
  const W = 13, D = 10, fy = 0.4, sH = 3.1;
  ctx.footprint = { w: W + 4, d: D + 6 };
  const navy = '#1e2e4a';
  const trim = weather('#e8e8e4', wear * 0.3);
  const doorU = W * 0.5;
  civic(ctx, {
    W, D, fy, storeys: 1, sH, key: wear > 0.6 ? 'siding_peel' : 'siding_panel', color: weather('#8e9aa6', wear * 0.5), trim,
    roof: { type: 'hip', pitch: 0.35, key: 'metal_corr_paint', color: weather('#2a3a50', wear * 0.4) },
    win: { w: 1.1, h: 1.1, per: 2.8, style: 'slider', cell: 7, sill: 1.05, lit: (s, k, i) => (st > 0.1 && (s + i) % 2 === 0 ? LIGHT.office : LIGHT.off), sides: [true, true, true, false] },
    doors: [{ side: 0, u: doorU, w: 1.0, h: 2.15, style: 'glass', frame: '#7a8288', id: 'front', main: true, leaf: ctx.wantInterior ? 'leaf_front' : null, light: LIGHT.office, cell: 7 },
      { side: 2, u: W * 0.2, w: 0.95, style: 'steel', color: '#5a6068', id: 'sally' }],
    extraOps: [[3, { kind: 'win', u: D * 0.25, y: fy + 1.7, w: 0.6, h: 0.45, style: 'grid', gx: 4, gy: 1, light: LIGHT.dim, cell: 7 }]],
    entry: { type: 'canopy', w: 3.0, d: 1.8, h: 2.7, roofKey: 'sheet_metal', roofColor: '#e8e8e4', posts: false },
    access: 'steps',
    inner: ctx.wantInterior ? { key: 'plaster', color: '#d8dcd8', trim: '#8a8e90', y0: fy, y1: fy + 2.8 } : null,
    noCollider: ctx.wantInterior,
  });
  // lit sign + blue light
  b.push().translate(-W / 2, 0, D / 2);
  sign(ctx, 'police_sign', doorU, fy + 3.25, 1.85, 3.0, 0.45, {
    kind: 'lightbox', ppm: 160, bg: navy, dayEmissive: 0.3, nightEmissive: st > 0.1 ? 1.8 : 0.05,
    lines: [{ text: 'POLICE', size: 0.62, y: 0.5, color: '#ffffff', font: '"Arial Black", Arial, sans-serif', weight: '900', spacing: 0.2 }],
  });
  b.box('sheet_metal', doorU + 1.9, fy + 2.4, 0.08, 0.2, 0.3, 0.16, { color: '#2a2a2a' });
  b.sphere('neon', doorU + 1.9, fy + 2.75, 0.12, 0.09, { color: [0.4, 1.2, 7], rings: 4, segs: 8 });
  sign(ctx, 'police_plaque', doorU - 2.2, fy + 1.6, 0.03, 1.4, 0.4, { kind: 'paint', ppm: 150, bg: '#c8a040', lines: [{ text: 'PORT ZARYA POLICE DEPT.', size: 0.3, color: '#1a1a1a', font: 'Georgia, serif' }] });
  b.pop();
  // bars over the cell window (left side)
  sideFrame(b, 3, W, D);
  for (let i = 0; i < 6; i++) b.box('metal', D * 0.25 - 0.3 + i * 0.12, fy + 1.65, 0.05, 0.025, 0.55, 0.025, { color: '#2a2a2a' });
  b.pop();
  // radio mast on the roof + security camera
  b.cylBetween('galv', [W / 2 - 1.5, fy + sH, -D / 2 + 1.5], [W / 2 - 1.5, fy + sH + 9, -D / 2 + 1.5], 0.05, { segs: 6, color: '#b8bcbe' });
  b.cylBetween('galv', [W / 2 - 1.5, fy + sH + 9, -D / 2 + 1.5], [W / 2 - 1.5, fy + sH + 11, -D / 2 + 1.5], 0.015, { segs: 4, color: '#b8bcbe' });
  b.sphere('neon_blink', W / 2 - 1.5, fy + sH + 9.05, -D / 2 + 1.5, 0.06, { color: [8, 0.4, 0.2], rings: 3, segs: 6 });
  secCam(ctx, -W / 2 - 0.05, fy + sH - 0.25, D / 2 + 0.05, PI * 0.75 - PI, { pitch: -0.5 });
  secCam(ctx, W / 2 + 0.05, fy + sH - 0.25, D / 2 + 0.05, PI * 0.25, { pitch: -0.5 });
  // parking: reserved sign
  b.at(W / 2 + 1.5, 0, D / 2 + 2.0, -0.3);
  b.cyl('galv', 0, 0, 0, 0.03, 1.9, { segs: 6, color: '#9aa0a2' });
  sign(ctx, 'police_reserved', 0, 1.6, 0.04, 0.45, 0.6, { kind: 'paint', ppm: 160, bg: '#ffffff', border: '#1a1a1a', lines: [{ text: 'RESERVED', size: 0.16, y: 0.25, color: '#1a1a1a', font: 'Arial, sans-serif' }, { text: 'POLICE', size: 0.2, y: 0.55, color: '#1a3a7a', font: 'Arial, sans-serif' }, { text: 'VEHICLES', size: 0.14, y: 0.82, color: '#1a1a1a', font: 'Arial, sans-serif' }] });
  b.pop();
  ctx.doors.push({ id: 'front', x: -W / 2 + doorU, z: D / 2 + 0.1, rot: 0, w: 1.0, leadsTo: ctx.wantInterior ? 'interior' : 'exterior' });
  ctx.doors.push({ id: 'sally', x: W / 2 - W * 0.2, z: -D / 2 - 0.1, rot: PI, w: 0.95, leadsTo: ctx.wantInterior ? 'interior' : 'exterior' });
  ctx.point('door', -W / 2 + doorU, 0, D / 2 + 3.2, PI);
  ctx.point('parking', W / 2 + 1.5, 0, D / 2 + 3.5, PI);
  if (ctx.wantInterior) interior(ctx, { W, D, fy, sH });
  void addProp; void r;
  return finish(ctx);
}

function interior(ctx, { W, D, fy }) {
  const b = ctx.b;
  const iw = W - 0.5, id = D - 0.5, ch = 2.8;
  floor(ctx, 0, 0, iw, id, fy, 'linoleum', '#c8c8c0');
  ceiling(ctx, 0, 0, iw, id, fy + ch, 'plaster', '#e8e8e4');
  for (const [x, z] of [[-3, 2.5], [2, 2.5], [-3, -2], [2, -2]]) tubeLight(ctx, x, fy + ch, z, 1.2);
  // lobby (front) | front desk counter across, offices behind
  const lz = D / 2 - 3.2; // counter line
  counter(ctx, 1.4, fy, lz, 0, { w: 4.0, d: 0.6, h: 1.05, key: 'wood_dark', color: '#6a5040', register: null });
  b.box('i:glass_clear', 1.4, fy + 1.05, lz, 4.0, 0.6, 0.02, { color: '#ffffff' });
  partition(ctx, -iw / 2, lz - 0.05, -0.7, lz - 0.05, fy, ch, { color: '#c8ccc8', doors: [{ at: 1.2, w: 0.9, leaf: true, color: '#6a6a66' }] });
  crtMonitor(ctx, 0.6, fy + 1.05, lz - 0.1, PI);
  ctx.point('frontDesk', 1.4, fy, lz + 0.8, PI);
  ctx.point('deskOfficer', 1.4, fy, lz - 0.8, 0);
  for (let i = 0; i < 3; i++) chair(ctx, -iw / 2 + 0.6 + i * 0.6, fy, D / 2 - 1.0, PI * 0.0 + PI, { folding: true, color: '#3a4a6a' });
  ctx.point('waiting', -iw / 2 + 1.2, fy, D / 2 - 1.6, 0);
  wallPicture(ctx, 'police_board', iw / 2 - 0.02, fy + 1.6, D / 2 - 1.5, -HALF_PI, 1.2, 0.8, { draw: drawWanted }, { frame: '#5a5a5a' });
  // chief's office (back right) with a door
  const oz = -0.6;
  partition(ctx, 0.6, oz, iw / 2, oz, fy, ch, { color: '#c8ccc8', doors: [{ at: 1.0, w: 0.9, leaf: true, color: '#6a5040' }] });
  partition(ctx, 0.6, oz, 0.6, -id / 2, fy, ch, { color: '#c8ccc8' });
  desk(ctx, 3.4, fy, -2.9, 0, { w: 1.6 });
  chair(ctx, 3.4, fy, -3.6, 0, { color: '#2a2a2a' });
  chair(ctx, 3.0, fy, -1.9, PI, { color: '#6a5040' });
  crtMonitor(ctx, 3.0, fy + 0.74, -3.1, 0);
  filingCabinet(ctx, iw / 2 - 0.35, fy, -1.6, -HALF_PI);
  filingCabinet(ctx, iw / 2 - 0.35, fy, -2.2, -HALF_PI);
  wallPicture(ctx, 'police_map', 2.2, fy + 1.6, -id / 2 + 0.01, 0, 1.4, 0.9, { draw: drawTownMap }, { frame: '#3a3a3a' });
  ctx.point('chiefOffice', 3.0, fy, -1.2, PI);
  ctx.point('chiefDesk', 3.4, fy, -2.2, PI);
  // the cell (back left): bars with a door
  const cx0 = -iw / 2, cx1 = -iw / 2 + 2.6, cz1 = -id / 2 + 2.6;
  partition(ctx, cx1, -id / 2, cx1, oz, fy, ch, { color: '#c8ccc8' });
  for (let x = cx0 + 0.1; x < cx1 - 0.05; x += 0.13) {
    if (x > cx0 + 1.5 && x < cx0 + 2.3) continue; // door opening
    b.cyl('i:metal', x, fy, cz1, 0.016, ch - 0.05, { segs: 6, color: '#3a3e42' });
  }
  b.box('i:metal', (cx0 + cx1) / 2, fy + ch - 0.12, cz1, cx1 - cx0, 0.08, 0.08, { color: '#3a3e42' });
  b.box('i:metal', (cx0 + cx1) / 2, fy + 1.0, cz1, cx1 - cx0, 0.05, 0.05, { color: '#3a3e42' });
  // the cell door (ajar)
  b.push().translate(cx0 + 1.5, fy, cz1).rotateY(-0.5);
  for (let i = 0; i < 6; i++) b.cyl('i:metal', 0.07 + i * 0.13, 0, 0, 0.016, 2.1, { segs: 6, color: '#3a3e42' });
  b.box('i:metal', 0.4, 2.0, 0, 0.85, 0.06, 0.06, { color: '#3a3e42' });
  b.box('i:metal', 0.4, 1.0, 0, 0.85, 0.05, 0.05, { color: '#3a3e42' });
  b.pop();
  ctx.colliders.push({ x: (cx0 + cx0 + 1.5) / 2, z: cz1, w: 1.5, d: 0.1, rot: 0, h: ch });
  ctx.colliders.push({ x: (cx0 + 2.3 + cx1) / 2, z: cz1, w: cx1 - cx0 - 2.3, d: 0.1, rot: 0, h: ch });
  // bunk + toilet in the cell
  b.box('i:metal', cx0 + 1.2, fy + 0.45, -id / 2 + 0.45, 1.9, 0.06, 0.75, { color: '#6a6e72' });
  b.box('i:fabric', cx0 + 1.2, fy + 0.51, -id / 2 + 0.45, 1.8, 0.08, 0.7, { color: '#7a7a5a' });
  b.box('i:chrome', cx0 + 2.2, fy, -id / 2 + 1.9, 0.4, 0.45, 0.5, { color: '#c8cccc' });
  ctx.point('cell', cx0 + 1.2, fy, -id / 2 + 1.4, PI);
  ctx.point('cellDoor', cx0 + 1.9, fy, cz1 + 0.6, PI);
  // radio desk + coffee in the bullpen
  desk(ctx, -1.6, fy, -0.2, PI, { w: 1.6 });
  radio(ctx, -1.6, fy + 0.74, -0.35, PI);
  flatScreen(ctx, -1.0, fy + 0.9, -0.4, PI, { w: 0.5, h: 0.3 });
  chair(ctx, -1.6, fy, 0.5, PI, { color: '#2a2a2a' });
  ctx.point('radio', -1.6, fy, 0.9, PI);
  b.box('i:sheet_metal', -0.4, fy, lz - 1.0, 0.6, 0.9, 0.5, { color: '#6a6e72' });
  b.cyl('i:glass_dark', -0.4, fy + 0.92, lz - 1.0, 0.08, 0.2, { segs: 8, color: '#000' });
  // evidence locker
  filingCabinet(ctx, -0.1, fy, -id / 2 + 0.35, 0, { color: '#4a5a4a', drawers: 5 });
  ctx.point('evidence', -0.1, fy, -id / 2 + 1.1, PI);
  wallColliders(ctx, W, D, 0, 0, [{ side: 0, u: W * 0.5, w: 1.0 }, { side: 2, u: W * 0.2, w: 0.95 }], 3.5);
  ctx.point('door_in', 0, fy, D / 2 - 0.9, PI);
  ctx.doors.push({ id: 'front_in', x: 0, z: D / 2 - 0.6, rot: PI, w: 1.0, leadsTo: 'exterior' });
  ctx.light(0, fy + 2.5, 2.5, 0xf0f4f0, 1.5, 9);
  ctx.light(3, fy + 2.5, -2.5, 0xfff0d8, 1.0, 6);
  ctx.light(-3.5, fy + 2.5, -3.0, 0xe8f0e8, 0.6, 5);
  void bench;
}

function drawWanted(g, W, H) {
  g.fillStyle = '#9a7a54'; g.fillRect(0, 0, W, H);
  for (let i = 0; i < 6; i++) {
    const x = (i % 3) * W / 3 + 8, y = Math.floor(i / 3) * H / 2 + 8;
    g.fillStyle = '#f4f0e4'; g.fillRect(x, y, W / 3 - 16, H / 2 - 16);
    g.fillStyle = '#2a2a2a'; g.font = `bold ${H * 0.06}px Arial`; g.fillText(i === 0 ? 'WANTED' : i === 4 ? 'MISSING' : 'NOTICE', x + 6, y + H * 0.08);
    g.fillStyle = '#7a7a7a'; g.fillRect(x + 10, y + H * 0.12, W / 3 - 36, H * 0.18);
  }
}

function drawTownMap(g, W, H) {
  g.fillStyle = '#e8e4d4'; g.fillRect(0, 0, W, H);
  g.fillStyle = '#9ab8d0'; g.fillRect(0, H * 0.75, W, H * 0.25);
  g.strokeStyle = '#4a4a4a'; g.lineWidth = 3;
  g.beginPath(); g.moveTo(0, H * 0.7); g.lineTo(W, H * 0.68); g.moveTo(W / 2, H * 0.7); g.lineTo(W / 2, 0); g.moveTo(0, H * 0.45); g.lineTo(W, H * 0.44); g.moveTo(W * 0.1, H * 0.25); g.lineTo(W * 0.8, H * 0.24); g.stroke();
  g.fillStyle = '#c81a1a';
  for (const [x, y] of [[0.52, 0.47], [0.62, 0.3], [0.35, 0.6], [0.8, 0.15]]) { g.beginPath(); g.arc(W * x, H * y, 5, 0, Math.PI * 2); g.fill(); }
  g.strokeStyle = '#c81a1a'; g.lineWidth = 2; g.beginPath(); g.moveTo(W * 0.62, H * 0.3); g.lineTo(W * 0.95, H * 0.05); g.stroke();
}
