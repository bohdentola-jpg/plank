// Midnight Sun Diner (Dolly Finch's): red and stainless with big windows you can
// see the booths through, and a chrome-framed neon rooftop sign with a rising
// sun. Interior: booths along the windows, counter with stools, kitchen pass
// with heat lamps, pie case, coffee station, jukebox, checkerboard floor.
import { makeCtx, finish, sign, sideFrame, porchLight, weather, rgb, LIGHT, PI, HALF_PI } from './common.js';
import { civic } from './civic.js';
import { addProp } from '../props.js';
import {
  floor, ceiling, partition, wallColliders, booth, stool, counter, kitchen, wallPicture, chair,
} from './furniture.js';

export function build(opts = {}) {
  const ctx = makeCtx('diner', opts);
  const b = ctx.b, r = ctx.rng, st = ctx.state, wear = ctx.wear;
  const W = 15, D = 10, fy = 0.5, sH = 3.3;
  ctx.footprint = { w: W + 3, d: D + 6 };
  const red = weather('#b81c1c', wear * 0.6);
  const lit = st > 0.1;
  const glass = 'glass_clear';
  // front: big windows (clear) across the front, door at the right
  const winOps = [];
  for (let i = 0; i < 5; i++) winOps.push([0, { kind: 'win', u: 1.3 + i * 2.05, y: fy + 0.95, w: 1.8, h: 1.35, style: 'fixed', light: LIGHT.off, cell: 2, glass, sill: true, trim: '#d8dcdc', sashColor: '#d8dcdc', cond: wear > 0.85 && i % 2 ? 'boarded' : 'ok' }]);
  b.forceExterior = true; // the shell interior + front booths are seen through clear glass
  const res = civic(ctx, {
    W, D, fy, storeys: 1, sH, key: 'sheet_metal', color: weather('#eef0f0', wear * 0.3), trim: '#d8dcdc', corner: 0.1, grime: 0.08,
    roof: { type: 'flat', parapet: 0.7, parapetColor: red, capColor: '#e8eaea' },
    win: { sides: [false, true, false, false], w: 1.2, h: 1.0, per: 2.8, style: 'slider', sill: 1.2, cell: 3, lit: () => (lit ? LIGHT.warm : LIGHT.off) },
    doors: [{ side: 0, u: W - 2.2, w: 1.0, h: 2.15, style: 'glass', frame: '#d8dcdc', id: 'front', main: true, leaf: ctx.wantInterior ? 'leaf_front' : null, glass, light: LIGHT.off, cell: 2 },
      { side: 2, u: W * 0.25, w: 0.95, style: 'steel', color: '#6a6a66', id: 'kitchen' }],
    extraOps: winOps,
    entry: { type: 'canopy', w: 2.4, d: 1.6, h: 2.6, roofKey: 'sheet_metal', roofColor: red, posts: false },
    access: 'steps',
    inner: { key: 'plaster', color: '#f0e8d8', trim: '#b81c1c', y0: fy, y1: fy + 2.9 },
    noCollider: ctx.wantInterior,
  });
  // the classic diner look: red lower band + chrome stripes + red parapet band
  for (let s = 0; s < 4; s++) {
    const len = sideFrame(b, s, W, D);
    b.boxMinMax('paint_gloss', 0, fy - 0.05, 0.005, len, fy + 0.85, 0.03, { color: red });
    for (const y of [fy + 0.88, fy + 2.5, fy + 2.62]) b.boxMinMax('chrome', -0.02, y, 0.0, len + 0.02, y + 0.06, 0.05, { color: '#e8ecec' });
    b.pop();
  }
  // the booths you see through the windows + warm ceiling light (always built)
  const bz = D / 2 - 1.35;
  for (let i = 0; i < 5; i++) booth(ctx, -W / 2 + 1.3 + i * 2.05, fy, bz, HALF_PI, { w: 1.25, color: '#b01818', top: '#f0e4cc' });
  for (let i = 0; i < 5; i++) b.cyl('i:neon', -W / 2 + 1.3 + i * 2.05, fy + 2.85, bz, 0.22, 0.05, { segs: 10, color: lit ? [6, 4.8, 3.2] : [0.05, 0.05, 0.05] });
  floor(ctx, 0, 0, W - 0.5, D - 0.5, fy, 'tile', '#ffffff');
  checkerFloor(ctx, W - 0.6, D - 0.6, fy);
  ceiling(ctx, 0, 0, W - 0.5, D - 0.5, fy + 2.9, 'plaster', '#f4eee2');
  b.forceExterior = false;
  if (lit) {
    ctx.light(-3, fy + 2.4, bz, 0xffd8a0, 2.0, 8);
    ctx.light(3, fy + 2.4, bz, 0xffd8a0, 2.0, 8);
  }
  // rooftop neon sign: chrome frame on legs, red script, a rising sun of tubes
  const sy = fy + sH + 0.7;
  b.push().translate(-1.0, sy, D / 2 - 1.2);
  for (const x of [-3.2, 3.2]) b.box('metal', x, -0.7, -0.2, 0.12, 1.3, 0.12, { color: '#3a3a3a' });
  b.box('chrome', 0, 0.4, -0.05, 7.4, 2.0, 0.18, { color: '#d8dcdc' });
  b.box('paint_gloss', 0, 0.48, 0.05, 7.1, 1.8, 0.04, { color: '#1a1a22' });
  sign(ctx, 'diner_neon', 0, 0.75, 0.075, 6.6, 0.9, {
    kind: 'neon', glow: lit ? 5.5 : 0.15, ppm: 130,
    lines: [{ text: (ctx.name || 'Midnight Sun').replace(/ DINER$/i, '').replace(/\b\w/g, (c) => c.toUpperCase()).replace(/\B\w/g, (c) => c.toLowerCase()), size: 0.82, color: '#ff3a30', font: '"Brush Script MT", "Segoe Script", "Lucida Handwriting", cursive', weight: 'bold', glowColor: '#ff2010', glowBlur: 0.3 }],
  });
  sign(ctx, 'diner_neon2', 0, 0.02, 0.075, 4.0, 0.42, {
    kind: 'neon', glow: lit ? 5 : 0.15, ppm: 130,
    lines: [{ text: 'D I N E R', size: 0.8, color: '#ffffff', font: 'Arial Black, Arial, sans-serif', weight: '900', glowColor: '#80c0ff', glowBlur: 0.3 }],
  });
  // sun: half disc outline + rays (neon tubes) on top of the frame
  const sunC = [0, 1.45, 0.06], R = 0.75;
  const arc = [];
  for (let i = 0; i <= 12; i++) { const a = (i / 12) * PI; arc.push([sunC[0] + Math.cos(a) * R, sunC[1] + Math.sin(a) * R, sunC[2]]); }
  b.tube(lit ? 'neon' : 'paint', arc, 0.035, { segs: 5, color: lit ? [9, 4, 0.6] : '#5a3a1a' });
  for (let i = 0; i < 9; i++) {
    const a = 0.12 + (i / 8) * (PI - 0.24);
    b.cylBetween(lit ? 'neon_flicker' : 'paint', [Math.cos(a) * (R + 0.15), sunC[1] + Math.sin(a) * (R + 0.15), 0.06], [Math.cos(a) * (R + 0.55), sunC[1] + Math.sin(a) * (R + 0.55), 0.06], 0.03, { segs: 4, color: lit ? [9, 6, 0.8] : '#5a3a1a' });
  }
  b.pop();
  // OPEN 24 HRS neon in a window, menu board by the door
  b.push().translate(-W / 2, 0, D / 2);
  b.box('neon', 1.3, fy + 1.7, -0.25, 0.9, 0.22, 0.02, { color: lit ? [1, 2, 7] : [0.05, 0.05, 0.05] });
  sign(ctx, 'diner_open', 1.3 + 2.05, fy + 1.7, -0.24, 0.9, 0.3, { kind: 'neon', glow: lit ? 5 : 0.1, ppm: 200, lines: [{ text: 'OPEN', size: 0.8, color: '#ff4030', font: 'Arial Black, Arial, sans-serif', weight: '900' }] });
  sign(ctx, 'diner_menu', W - 3.4, fy + 1.4, 0.04, 0.8, 1.0, { kind: 'paint', ppm: 150, bg: '#1a1a1a', border: '#d8dcdc', draw: drawMenu });
  b.pop();
  // back: dumpster, grease barrel, propane
  b.at(W / 2 - 2.5, 0, -D / 2 - 1.6, PI);
  addProp(b, 'dumpster', { rust: wear }, r);
  b.pop();
  b.at(-W / 2 + 1.0, 0, -D / 2 - 1.0, 0);
  addProp(b, 'fuelDrum', { color: '#3a3a3a', rust: wear }, r);
  b.pop();
  ctx.doors.push({ id: 'front', x: W / 2 - 2.2, z: D / 2 + 0.1, rot: 0, w: 1.0, leadsTo: ctx.wantInterior ? 'interior' : 'exterior' });
  ctx.point('door', W / 2 - 2.2, 0, D / 2 + 2.8, PI);
  if (ctx.wantInterior) interior(ctx, { W, D, fy, bz });
  void res; void porchLight; void rgb;
  return finish(ctx);
}

function checkerFloor(ctx, w, d, y) {
  const b = ctx.b, s = 0.5;
  const nx = Math.floor(w / s), nz = Math.floor(d / s);
  for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) {
    if ((i + j) % 2) continue;
    const x = -w / 2 + i * s, z = -d / 2 + j * s;
    b.poly('i:solid', [[x, y + 0.012, z + s], [x + s, y + 0.012, z + s], [x + s, y + 0.012, z], [x, y + 0.012, z]], { color: '#1a1a1c', want: [0, 1, 0] });
  }
}

function interior(ctx, { W, D, fy, bz }) {
  const b = ctx.b;
  const iw = W - 0.5, id = D - 0.5;
  for (let i = 0; i < 5; i++) ctx.point('booth' + (i + 1), -W / 2 + 1.3 + i * 2.05, fy, bz - 1.2, 0);
  // counter with stools along the kitchen partition
  const kz = -id / 2 + 2.6;
  partition(ctx, -iw / 2, kz - 0.9, iw / 2, kz - 0.9, fy, 2.9, { color: '#f0e8d8', doors: [{ at: iw - 1.2, w: 0.9, leaf: true, color: '#c8c8c4' }], trim: '#b81c1c' });
  // kitchen pass window: a gap in the partition is faked by a lit opening + heat lamps
  b.box('i:neon', -1.0, fy + 1.55, kz - 0.84, 2.4, 0.6, 0.01, { color: [3.2, 2.2, 1.2] });
  b.box('i:chrome', -1.0, fy + 1.2, kz - 0.75, 2.6, 0.04, 0.4, { color: '#d8dcdc' });
  for (const x of [-1.8, -1.0, -0.2]) { b.cyl('i:metal', x, fy + 2.0, kz - 0.75, 0.12, 0.12, { rTop: 0.05, segs: 10, color: '#3a3a3a', caps: 't' }); b.cyl('i:neon', x, fy + 1.99, kz - 0.75, 0.09, 0.01, { segs: 8, color: [8, 2.2, 0.6] }); }
  b.box('i:chrome', -1.0, fy + 2.2, kz - 0.7, 1.6, 0.05, 0.05, { color: '#c8cccc' }); // order rail
  for (let i = 0; i < 4; i++) b.box('i:paint', -1.6 + i * 0.4, fy + 2.06, kz - 0.68, 0.12, 0.16, 0.005, { color: '#fffef0' });
  ctx.point('kitchenPass', -1.0, fy, kz + 0.4, PI);
  counter(ctx, -0.4, fy, kz, 0, { w: 8.0, d: 0.6, h: 1.05, key: 'paint_gloss', color: '#b81c1c', top: '#e8e0d0', topKey: 'stone', panels: false, register: 'pos', regX: 3.4 });
  b.box('i:chrome', -0.4, fy + 0.1, kz + 0.31, 8.0, 0.08, 0.02, { color: '#d8dcdc' });
  for (let i = 0; i < 8; i++) {
    stool(ctx, -4.0 + i * 0.95, fy, kz + 0.75, { color: '#b01818' });
    ctx.point('stool' + (i + 1), -4.0 + i * 0.95, fy, kz + 0.75, PI);
  }
  ctx.point('counter', -0.4, fy, kz + 1.4, PI);
  ctx.point('register', 3.0, fy, kz + 1.3, PI);
  ctx.point('waitress', 0.5, fy, kz - 0.45, 0);
  // pie case + coffee station on the counter
  b.cyl('i:chrome', -3.2, fy + 1.05, kz, 0.3, 0.03, { segs: 14, color: '#d8dcdc' });
  b.sphere('i:glass_clear', -3.2, fy + 1.08, kz, 0.3, { phiBottom: HALF_PI, rings: 5, segs: 14 });
  b.cyl('i:plastic', -3.2, fy + 1.08, kz, 0.2, 0.08, { segs: 10, color: '#d8a050' });
  ctx.point('pieCase', -3.2, fy, kz + 1.2, PI);
  for (const x of [1.6, 2.1]) { b.box('i:chrome', x, fy + 1.05, kz - 0.1, 0.35, 0.5, 0.3, { color: '#c8cccc' }); b.cyl('i:glass_dark', x, fy + 1.07, kz + 0.05, 0.08, 0.18, { segs: 8, color: '#000' }); }
  // jukebox against the left wall: glowing arch
  b.push().translate(-iw / 2 + 0.35, fy, -0.2).rotateY(HALF_PI);
  b.box('i:wood_dark', 0, 0, 0, 0.9, 1.1, 0.6, { color: '#5a2a1a' });
  b.cyl('i:neon', 0, 1.1, -0.28, 0.45, 0.55, { thetaStart: -HALF_PI, thetaLen: PI, segs: 12, color: [6, 2.6, 0.8], caps: '' });
  b.box('i:neon', 0, 0.55, 0.305, 0.6, 0.35, 0.01, { color: [3, 3.5, 4.5] });
  b.box('i:chrome', 0, 0.2, 0.305, 0.7, 0.2, 0.02, { color: '#d8dcdc' });
  b.pop();
  ctx.light(-iw / 2 + 0.9, fy + 1.2, -0.2, 0xff9a50, 1.0, 4);
  ctx.point('jukebox', -iw / 2 + 1.2, fy, -0.2, -HALF_PI);
  // a table and chairs near the jukebox
  booth(ctx, iw / 2 - 1.2, fy, -0.2, 0, { w: 1.2, color: '#b01818' });
  // kitchen behind
  kitchen(ctx, 0.5, fy, -id / 2 + 0.35, 0, { w: 4.0, stove: true, fridge: true, color: '#d8d8d4', top: '#b8bcbe', uppers: false });
  ctx.point('kitchen', 0.5, fy, -id / 2 + 1.3, PI);
  wallPicture(ctx, 'diner_photo', iw / 2 - 0.02, fy + 1.8, 1.6, -HALF_PI, 0.8, 0.55, { draw: drawDinerPhoto }, { frame: '#d8dcdc', frameKey: 'i:chrome' });
  ctx.light(0, fy + 2.5, kz + 0.6, 0xffe0b0, 1.8, 8);
  ctx.light(0, fy + 2.4, -id / 2 + 1.2, 0xfff0d8, 1.2, 6);
  wallColliders(ctx, W, D, 0, 0, [{ side: 0, u: W - 2.2, w: 1.0 }, { side: 2, u: W * 0.25, w: 0.95 }], 3.3);
  ctx.point('door_in', W / 2 - 2.2, fy, D / 2 - 0.9, PI);
  ctx.doors.push({ id: 'front_in', x: W / 2 - 2.2, z: D / 2 - 0.6, rot: PI, w: 1.0, leadsTo: 'exterior' });
  void chair;
}

function drawMenu(g, W, H) {
  g.fillStyle = '#1a1a1a'; g.fillRect(0, 0, W, H);
  g.fillStyle = '#ffd850'; g.font = `bold ${H * 0.08}px Arial`; g.textAlign = 'center'; g.fillText("TODAY'S SPECIALS", W / 2, H * 0.12);
  g.fillStyle = '#f0f0f0'; g.font = `${H * 0.055}px Arial`; g.textAlign = 'left';
  const items = ['Reindeer sausage & eggs  12', 'Halibut & chips  18', 'Sourdough hotcakes  9', 'Chowder (cup/bowl)  6/9', 'Pie of the day  5', 'Coffee — bottomless  2'];
  items.forEach((t, i) => g.fillText(t, W * 0.08, H * (0.26 + i * 0.12)));
}

function drawDinerPhoto(g, W, H) {
  g.fillStyle = '#2a2a3a'; g.fillRect(0, 0, W, H);
  g.fillStyle = '#e8b04a'; g.beginPath(); g.arc(W / 2, H * 0.8, H * 0.4, PI, 0); g.fill();
  g.fillStyle = '#1a2a3a'; g.fillRect(0, H * 0.8, W, H * 0.2);
  g.fillStyle = '#f0e8d0'; g.font = `bold ${H * 0.12}px Georgia, serif`; g.textAlign = 'center'; g.fillText('SINCE 1958', W / 2, H * 0.25);
}
