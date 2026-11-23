// City of Port Zarya — City Hall: two storeys, hip roof, a columned portico,
// tall council-chamber windows, US + Alaska flag poles, a monument sign and a
// NORTHSTAR camera over the door. Interior: reception, council chamber (long
// dais table, public seating, podium, flags), mayor's office with a wall safe,
// stairs up.
import { makeCtx, finish, sign, flagpole, sideFrame, weather, rgb, LIGHT, PI, HALF_PI } from './common.js';
import { civic, monumentSign } from './civic.js';
import { secCam } from './cornerStore.js';
import { getSignMaterial } from '../materials.js';
import {
  floor, ceiling, partition, wallColliders, table, chair, desk, filingCabinet, wallSafe, wallPicture, rug, sofa, counter, crtMonitor,
} from './furniture.js';
import { ceilingLamp, tubeLight } from './common.js';

export function build(opts = {}) {
  const ctx = makeCtx('cityHall', opts);
  const b = ctx.b, st = ctx.state, wear = ctx.wear;
  const W = 17, D = 12.5, fy = 0.6, sH = 3.4;
  ctx.footprint = { w: W + 10, d: D + 9 };
  const trim = weather('#f2f0ea', wear * 0.4);
  const body = weather('#6f8296', wear * 0.6);
  const chamberWin = (s) => s === 1;
  const res = civic(ctx, {
    W, D, fy, storeys: 2, sH, key: wear > 0.62 ? 'siding_peel' : 'siding_lap', color: body, trim,
    roof: { type: 'hip', pitch: 0.4, key: 'roof_shingle', color: weather('#3a3a3e', wear * 0.4), eave: 0.6 },
    win: {
      w: 1.0, h: 1.5, per: 2.5, style: 'dh', cell: 7, sill: 0.95,
      lit: (s, k, i) => (st > 0.15 && (k === 0 || (i + s) % 3 === 0) ? LIGHT.office : LIGHT.off),
      skip: (s, k, i, u) => chamberWin(s) && k === 0,
    },
    doors: [{ side: 0, u: W / 2, w: 1.8, h: 2.4, style: 'double', color: weather('#2a3a2a', wear * 0.4), id: 'front', main: true, leaf: ctx.wantInterior ? 'leaf_front' : null },
      { side: 2, u: W * 0.8, w: 0.95, style: 'steel', color: '#6a6a66', id: 'back' }],
    extraOps: [0, 1, 2, 3].map((i) => [1, { kind: 'win', u: 2.2 + i * 2.7, y: fy + 0.75, w: 1.4, h: 2.3, style: 'grid', gx: 2, gy: 4, light: st > 0.1 ? [1.0, 0.92, 0.75] : LIGHT.off, cell: 7 }]),
    entry: { type: 'canopy', w: 5.4, d: 2.8, h: 3.0, roofKey: 'sheet_metal', roofColor: trim, postColor: trim },
    access: 'both',
    inner: ctx.wantInterior ? { key: 'plaster', color: '#e8e2d2', trim: '#6a4a30', y0: fy, y1: fy + sH } : null,
    noCollider: ctx.wantInterior,
  });
  // portico: round columns + pediment
  b.push().translate(-W / 2, 0, D / 2);
  for (const k of [-1, -0.36, 0.36, 1]) {
    const x = W / 2 + k * 2.4;
    b.cyl('paint', x, fy, 2.6, 0.16, 3.0, { segs: 12, color: trim });
    b.box('paint', x, fy, 2.6, 0.42, 0.12, 0.42, { color: trim });
    b.box('paint', x, fy + 2.88, 2.6, 0.42, 0.12, 0.42, { color: trim });
  }
  b.push().translate(W / 2, fy + 3.22, 2.78);
  b.poly('paint', [[-2.8, 0, 0], [2.8, 0, 0], [0, 1.0, 0]], { color: trim, want: [0, 0, 1] });
  for (const s of [-1, 1]) b.poly('paint', [[0, 1.0, 0], [s * 2.8, 0, 0], [s * 2.8, 0, -2.8], [0, 1.0, -2.8]], { color: weather('#4a4e52', wear * 0.4), want: [s * 0.35, 1, 0] });
  b.pop();
  sign(ctx, 'cityhall_fascia', W / 2, fy + 3.1, 2.82, 4.6, 0.32, { kind: 'paint', ppm: 140, bg: '#f2f0ea', lines: [{ text: 'CITY HALL', size: 0.7, color: '#1e2e3e', font: 'Georgia, "Times New Roman", serif', weight: 'bold', spacing: 0.3 }] });
  b.pop();
  // flags: US + Alaska
  flagpole(ctx, -W / 2 - 1.8, D / 2 + 3.2, 9.5);
  flagpole(ctx, -W / 2 - 3.6, D / 2 + 3.2, 8.5, { flag: 'ak' });
  monumentSign(ctx, 'cityhall_monument', W / 2 + 3.0, D / 2 + 4.0, 3.2, 0.9, {
    kind: 'paint', ppm: 120, bg: '#1e2e3e', fade: Math.max(0, wear - 0.4),
    lines: [{ text: ctx.name || 'CITY OF PORT ZARYA', size: 0.34, y: 0.36, color: '#f2e8c8', font: 'Georgia, serif', weight: 'bold' }, { text: 'Founded 1822 · Incorporated 1971', size: 0.2, y: 0.74, color: '#c8d0d8', font: 'Georgia, serif' }],
  }, { rot: -0.5, board: '#1e2e3e', postKey: 'stone', postColor: '#7a7a76' });
  // NORTHSTAR camera over the door (they paid for it) + at the corner
  secCam(ctx, -1.2, fy + sH + 0.2, D / 2 + 0.05, 0, { dome: false, pitch: -0.55 });
  secCam(ctx, W / 2 + 0.05, fy + 2 * sH - 0.3, D / 2 + 0.05, PI * 0.3, { pitch: -0.5 });
  ctx.doors.push({ id: 'front', x: 0, z: D / 2 + 0.1, rot: 0, w: 1.8, leadsTo: ctx.wantInterior ? 'interior' : 'exterior' });
  ctx.point('door', 0, 0, D / 2 + 5.0, PI);
  ctx.point('flag', -W / 2 - 2.7, 0, D / 2 + 4.2, PI);
  ctx.point('chamberWindow', W / 2 + 1.5, 0, 0, -HALF_PI);
  if (ctx.wantInterior) interior(ctx, { W, D, fy, sH });
  void res; void sideFrame;
  return finish(ctx);
}

function interior(ctx, { W, D, fy, sH }) {
  const b = ctx.b;
  const iw = W - 0.5, id = D - 0.5, ch = sH - 0.25;
  floor(ctx, 0, 0, iw, id, fy, 'carpet', '#5a6a7a');
  ceiling(ctx, 0, 0, iw, id, fy + ch, 'plaster', '#ecebe4');
  // corridor runs front→back in the middle-left; chamber on the right half
  const px = 1.2; // chamber partition x
  partition(ctx, px, D / 2 - 0.25, px, -id / 2, fy, ch, { color: '#d8d2c2', doors: [{ at: 2.2, w: 1.6, h: 2.3 }] });
  // mayor's office back-left
  const mz = -0.8;
  partition(ctx, -iw / 2, mz, px - 2.4, mz, fy, ch, { color: '#d8d2c2', doors: [{ at: 1.6, w: 0.95, leaf: true, color: '#5a3a20' }] });
  partition(ctx, px - 2.4, mz, px - 2.4, -id / 2, fy, ch, { color: '#d8d2c2' });
  // ---- council chamber
  const cxm = (px + iw / 2) / 2;
  b.box('i:wood_dark', cxm, fy, -id / 2 + 1.5, iw / 2 - px - 0.6, 0.3, 2.4, { color: '#6a4424' }); // dais
  ctx.floor(cxm, -id / 2 + 1.5, iw / 2 - px - 0.6, 2.4, fy + 0.3);
  table(ctx, cxm, fy + 0.3, -id / 2 + 1.3, 0, { w: 6.4, d: 0.9, color: '#7a5232' });
  b.box('i:wood_dark', cxm, fy + 0.3, -id / 2 + 1.75, 6.4, 0.75, 0.05, { color: '#6a4424' }); // modesty panel
  const seats = ['Hennessey', 'Finch', 'Brubaker', 'Aqpik', 'Moody', 'Pruitt'];
  seats.forEach((n, i) => {
    const x = cxm - 2.75 + i * 1.1;
    chair(ctx, x, fy + 0.3, -id / 2 + 0.6, 0, { color: '#2a2a2a' });
    b.box('i:gold_dull', x, fy + 1.05, -id / 2 + 1.6, 0.4, 0.08, 0.04, { color: '#c8a050' });
    b.cylBetween('i:metal', [x + 0.15, fy + 1.05, -id / 2 + 1.45], [x + 0.2, fy + 1.35, -id / 2 + 1.6], 0.006, { segs: 3, color: '#1a1a1a' });
    ctx.point('councilSeat' + (i + 1), x, fy + 0.3, -id / 2 + 0.6, 0);
  });
  ctx.point('councilTable', cxm, fy, -id / 2 + 3.0, PI);
  // flags on stands + city seal
  for (const [dx, col] of [[-3.6, '#b22234'], [3.6, '#0f204b']]) {
    b.cyl('i:gold', cxm + dx, fy + 0.3, -id / 2 + 0.4, 0.02, 2.2, { segs: 6, color: '#d8b050' });
    b.box('i:fabric', cxm + dx + 0.25, fy + 1.4, -id / 2 + 0.4, 0.5, 0.9, 0.02, { color: col });
  }
  wallPicture(ctx, 'city_seal', cxm, fy + 2.3, -id / 2 + 0.02, 0, 0.9, 0.9, { draw: drawSeal }, { frame: '#5a3a20' });
  // podium + public seating rows
  b.push().translate(cxm, fy, -id / 2 + 3.6);
  b.box('i:wood_dark', 0, 0, 0, 0.6, 1.15, 0.45, { color: '#5a3a20' });
  b.cylBetween('i:metal', [0.1, 1.15, 0], [0.12, 1.45, -0.2], 0.008, { segs: 3, color: '#1a1a1a' });
  b.pop();
  ctx.point('podium', cxm, fy, -id / 2 + 4.2, PI);
  for (let row = 0; row < 4; row++) for (let i = 0; i < 6; i++) chair(ctx, cxm - 2.5 + i * 1.0 - (i > 2 ? -0.4 : 0.4), fy, -id / 2 + 5.0 + row * 0.95, PI, { folding: true, color: '#3a4a5a' });
  ctx.point('publicSeats', cxm, fy, -id / 2 + 6.4, PI);
  ctx.point('chamber', cxm, fy, 0, PI);
  // ---- reception / clerk counter in the lobby
  counter(ctx, -2.6, fy, D / 2 - 3.2, 0, { w: 3.0, color: '#6a4a30', register: null });
  crtMonitor(ctx, -2.2, fy + 0.95, D / 2 - 3.35, PI);
  ctx.point('reception', -2.6, fy, D / 2 - 2.2, PI);
  ctx.point('clerk', -2.6, fy, D / 2 - 4.0, 0);
  // stairs up (to the closed upper floor) along the left wall
  const sx = -iw / 2 + 0.6, sz0 = D / 2 - 1.2;
  for (let i = 0; i < 16; i++) b.box('i:wood_dark', sx, fy + i * 0.2, sz0 - 1.0 - i * 0.26, 1.0, 0.2, 0.28, { color: '#6a4424' });
  ctx.ramp(sx, sz0 - 1.0 - 7.5 * 0.26, 1.0, 16 * 0.26, fy, fy + 3.2, PI);
  ctx.point('stairs', sx, fy, sz0 - 0.4, PI);
  // ---- mayor's office
  const ox = (-iw / 2 + px - 2.4) / 2, oz = (mz - id / 2) / 2;
  desk(ctx, ox, fy, oz - 0.6, 0, { w: 1.8, d: 0.85, color: '#5a3018' });
  chair(ctx, ox, fy, oz - 1.4, 0, { color: '#3a1a10' });
  for (const dx of [-0.5, 0.5]) chair(ctx, ox + dx, fy, oz + 0.4, PI, { color: '#5a3a20' });
  filingCabinet(ctx, -iw / 2 + 0.35, fy, oz + 1.0, HALF_PI);
  sofa(ctx, px - 2.4 - 0.5, fy, oz + 0.6, -HALF_PI, { w: 1.6, color: '#5a2a22' });
  rug(ctx, ox, fy, oz, 2.4, 1.8, '#5a1a1a');
  // the wall safe behind a painting (the painting is hinged open a little)
  const safeX = ox + 0.9, safeY = fy + 1.25, safeZ = -id / 2 + 0.02;
  wallSafe(ctx, safeX, safeY, safeZ, 0);
  b.push().translate(safeX - 0.45, safeY + 0.25, safeZ + 0.03).rotateY(-0.35);
  b.box('i:wood_dark', 0.45, -0.4, 0, 0.9, 0.8, 0.03, { color: '#4a3020' });
  b.pop();
  wallPicture(ctx, 'mayor_painting', safeX + 0.45 * Math.cos(0.35) - 0.45, safeY + 0.25, safeZ + 0.06 + 0.45 * Math.sin(0.35), -0.35, 0.8, 0.6, { draw: drawPainting }, { frame: '#b08a40', frameKey: 'i:gold_dull' });
  ctx.point('mayorOffice', ox, fy, mz - 0.8, PI);
  ctx.point('mayorDesk', ox, fy, oz - 1.4, PI);
  ctx.point('safe', safeX, fy, safeZ + 0.8, PI);
  // lights
  for (const z of [-3, 0.5, 3.5]) tubeLight(ctx, cxm, fy + ch, z, 1.6, { rot: true });
  ceilingLamp(ctx, ox, fy + ch, oz, { drop: 0.3, shade: '#e8d8b0', glow: [6, 5, 3.4] });
  ceilingLamp(ctx, -2.6, fy + ch, D / 2 - 2.5, { drop: 0.3, shade: '#e8d8b0', glow: [6, 5, 3.4] });
  ctx.light(cxm, fy + 2.6, -1, 0xf4f0e0, 2.0, 10);
  wallColliders(ctx, W, D, 0, 0, [{ side: 0, u: W / 2, w: 1.8 }, { side: 2, u: W * 0.8, w: 0.95 }], 2 * sH);
  ctx.point('door_in', 0, fy, D / 2 - 1.0, PI);
  ctx.doors.push({ id: 'front_in', x: 0, z: D / 2 - 0.6, rot: PI, w: 1.8, leadsTo: 'exterior' });
  void getSignMaterial; void rgb;
}

function drawSeal(g, W, H) {
  g.fillStyle = '#1e2e4a'; g.beginPath(); g.arc(W / 2, H / 2, W * 0.48, 0, Math.PI * 2); g.fill();
  g.strokeStyle = '#d8b050'; g.lineWidth = W * 0.03; g.beginPath(); g.arc(W / 2, H / 2, W * 0.42, 0, Math.PI * 2); g.stroke();
  g.fillStyle = '#d8b050'; g.font = `bold ${H * 0.07}px Georgia, serif`; g.textAlign = 'center';
  g.fillText('CITY OF PORT ZARYA', W / 2, H * 0.28); g.fillText('1822', W / 2, H * 0.8);
  g.fillStyle = '#e8e8e0';
  g.beginPath(); g.moveTo(W * 0.3, H * 0.62); g.lineTo(W * 0.5, H * 0.38); g.lineTo(W * 0.7, H * 0.62); g.fill();
  g.fillStyle = '#5a8ab8'; g.fillRect(W * 0.28, H * 0.62, W * 0.44, H * 0.06);
}

function drawPainting(g, W, H) {
  const gr = g.createLinearGradient(0, 0, 0, H);
  gr.addColorStop(0, '#2a3a5a'); gr.addColorStop(0.6, '#c87a4a'); gr.addColorStop(1, '#2a2a3a');
  g.fillStyle = gr; g.fillRect(0, 0, W, H);
  g.fillStyle = '#1a1a22';
  g.beginPath(); g.moveTo(0, H * 0.75); g.lineTo(W * 0.3, H * 0.55); g.lineTo(W * 0.55, H * 0.7); g.lineTo(W * 0.8, H * 0.5); g.lineTo(W, H * 0.65); g.lineTo(W, H); g.lineTo(0, H); g.fill();
}
