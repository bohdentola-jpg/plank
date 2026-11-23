// KZRY 88.9 FM community radio: a small red shed-roofed building with an ON AIR
// light and a 36 m red-and-white lattice mast with blinking aviation lights
// and guy wires. Interior: studio console with mic arm, record crates,
// transmitter rack, a couch.
import { makeCtx, finish, sign, sideFrame, weather, rgb, LIGHT, PI, HALF_PI } from './common.js';
import { catenary } from '../geom.js';
import { civic } from './civic.js';
import { addProp } from '../props.js';
import {
  floor, ceiling, partition, wallColliders, desk, chair, sofa, serverRack, flatScreen, wallPicture, rug, shelf,
} from './furniture.js';
import { ceilingLamp } from './common.js';

/** Triangular lattice mast (face width fw) from y0 to top, red/white bands; returns top y. */
export function latticeMast(ctx, x, z, h, o = {}) {
  const b = ctx.b;
  const fw = o.fw ?? 0.7;
  const R = fw / Math.sqrt(3);
  const legs = [0, 1, 2].map((i) => { const a = (i / 3) * PI * 2 + 0.3; return [x + Math.cos(a) * R, z + Math.sin(a) * R]; });
  const band = o.band ?? 4.5;
  const seg = 0.9;
  const n = Math.ceil(h / seg);
  for (let k = 0; k < n; k++) {
    const y0 = k * seg, y1 = Math.min(h, y0 + seg);
    const col = Math.floor(y0 / band) % 2 === 0 ? (o.red || '#c8281e') : '#f0f0ea';
    for (let i = 0; i < 3; i++) {
      const [ax, az] = legs[i], [bx, bz] = legs[(i + 1) % 3];
      b.cylBetween('paint', [ax, y0, az], [ax, y1, az], 0.035, { segs: 5, caps: '', color: col });
      b.beam('paint', [ax, y0, az], [bx, y1, bz], 0.02, 0.02, { color: col });
      if (k % 3 === 0) b.beam('paint', [ax, y0, az], [bx, y0, bz], 0.02, 0.02, { color: col });
    }
  }
  b.box('concrete', x, -0.1, z, 1.4, 0.35, 1.4, { color: '#9a9a94' });
  // antennas at the top (FM bays)
  for (let i = 0; i < 3; i++) {
    const y = h - 1.0 - i * 1.6;
    b.push().translate(x + R + 0.25, y, z).rotateZ(HALF_PI);
    b.cyl('galv', 0, -0.25, 0, 0.02, 0.5, { segs: 4, color: '#c8ccce' });
    b.pop();
    b.cylBetween('galv', [x + R + 0.25, y - 0.4, z], [x + R + 0.25, y + 0.4, z], 0.015, { segs: 4, color: '#c8ccce' });
  }
  b.cylBetween('galv', [x, h, z], [x, h + 1.8, z], 0.03, { segs: 5, color: '#c8ccce' });
  // aviation lights: top (blinking) + mid
  b.sphere('neon_blink', x, h + 1.85, z, 0.09, { color: [9, 0.3, 0.15], rings: 4, segs: 8 });
  for (const yy of [h * 0.5]) for (const [lx, lz] of legs) b.sphere('neon_blink', lx, yy, lz, 0.06, { color: [7, 0.25, 0.1], rings: 3, segs: 6 });
  // guy wires at two levels to three anchors
  const anchors = [0, 1, 2].map((i) => { const a = (i / 3) * PI * 2 + 0.3; return [x + Math.cos(a) * h * 0.36, z + Math.sin(a) * h * 0.36]; });
  for (const [axx, azz] of anchors) {
    b.box('concrete', axx, -0.2, azz, 0.8, 0.4, 0.8, { color: '#9a9a94' });
    for (const yy of [h * 0.45, h * 0.88]) b.tube('metal', catenary([x, yy, z], [axx, 0.2, azz], 0.25, 6), 0.008, { segs: 3, color: '#7a7a7a' });
  }
  ctx.col(x, z, fw + 0.4, fw + 0.4, h);
  ctx.light(x, h + 1.85, z, 0xff2010, 1.2, 12);
  return h + 1.85;
}

export function build(opts = {}) {
  const ctx = makeCtx('radioStation', opts);
  const b = ctx.b, r = ctx.rng, st = ctx.state, wear = ctx.wear;
  const W = 9, D = 7, fy = 0.45, sH = 2.9;
  ctx.footprint = { w: 30, d: 32 };
  const trim = weather('#efece4', wear * 0.4);
  civic(ctx, {
    W, D, fy, storeys: 1, sH, key: wear > 0.6 ? 'siding_peel' : 'siding_panel', color: weather('#9a2a22', wear * 0.6), trim,
    roof: { type: 'shed', pitch: 0.12, high: 'front', key: 'metal_corr_paint', color: weather('#3a3e42', wear * 0.4), icicles: 0.4 },
    win: { w: 1.2, h: 1.0, per: 3.0, style: 'slider', sill: 1.1, cell: 2, lit: (s, k, i) => (st > 0.15 && i === 0 ? LIGHT.warm : LIGHT.off), sides: [true, true, false, true] },
    doors: [{ side: 0, u: W * 0.3, w: 0.95, style: 'steel', color: weather('#2a2a2a', wear * 0.3), id: 'front', main: true, leaf: ctx.wantInterior ? 'leaf_front' : null }],
    entry: { type: 'canopy', w: 2.2, d: 1.5, h: 2.5, roofKey: 'sheet_metal', roofColor: '#3a3e42', posts: false },
    access: 'steps',
    inner: ctx.wantInterior ? { key: 'plaster', color: '#2a2a30', trim: '#1a1a1a', y0: fy, y1: fy + 2.6 } : null,
    noCollider: ctx.wantInterior,
  });
  b.push().translate(-W / 2, 0, D / 2);
  // big call letters on the front + the ON AIR light over the door
  sign(ctx, 'kzry_sign', W * 0.68, fy + 2.4, 0.05, 4.2, 1.1, {
    kind: 'paint', ppm: 110, fade: Math.max(0, wear - 0.35), seed: 5, transparent: true,
    lines: [{ text: 'KZRY', size: 0.62, y: 0.38, color: '#f4f0e6', font: '"Arial Black", Arial, sans-serif', weight: '900', spacing: 0.08 }, { text: '88.9 FM · COMMUNITY RADIO', size: 0.22, y: 0.82, color: '#f4f0e6', font: 'Arial, sans-serif', weight: 'bold' }],
  });
  b.box('sheet_metal', W * 0.3, fy + 2.62, 1.52, 0.8, 0.26, 0.12, { color: '#1a1a1a' });
  sign(ctx, 'onair', W * 0.3, fy + 2.75, 1.59, 0.7, 0.2, { kind: 'neon', glow: st > 0.1 ? 6 : 0.2, ppm: 200, bg: '#000000', lines: [{ text: 'ON AIR', size: 0.8, color: '#ff3020', font: 'Arial Black, Arial, sans-serif', weight: '900' }] });
  b.pop();
  // the mast behind the building + a satellite dish + feed line
  const mx = 4.5, mz = -D / 2 - 4.0;
  const top = latticeMast(ctx, mx, mz, 36);
  b.tube('rubber', [[W / 2 - 1.5, fy + 2.0, -D / 2], [W / 2 - 1.5, fy + 2.0, -D / 2 - 1.5], [mx, 2.5, mz + 0.5], [mx, 34, mz + 0.4]], 0.03, { segs: 4, color: '#1a1a1a' });
  b.at(-W / 2 - 2.5, 0, -D / 2 - 1.5, PI * 0.7);
  addProp(b, 'satDish', { size: 2.4, mount: 'post' }, r);
  b.pop();
  ctx.doors.push({ id: 'front', x: -W / 2 + W * 0.3, z: D / 2 + 0.1, rot: 0, w: 0.95, leadsTo: ctx.wantInterior ? 'interior' : 'exterior' });
  ctx.point('door', -W / 2 + W * 0.3, 0, D / 2 + 3.0, PI);
  ctx.point('mastBase', mx, 0, mz + 1.5, PI);
  ctx.point('mastTop', mx, top, mz, 0);
  if (ctx.wantInterior) interior(ctx, { W, D, fy });
  return finish(ctx);
}

function interior(ctx, { W, D, fy }) {
  const b = ctx.b, r = ctx.rng;
  const iw = W - 0.5, id = D - 0.5, ch = 2.6;
  floor(ctx, 0, 0, iw, id, fy, 'carpet', '#3a3a44');
  ceiling(ctx, 0, 0, iw, id, fy + ch, 'plaster', '#2a2a2e');
  // acoustic panels
  for (let i = 0; i < 6; i++) b.box('i:fabric', -iw / 2 + 0.8 + i * 1.3, fy + 1.0, -id / 2 + 0.03, 1.1, 1.1, 0.05, { color: i % 2 ? '#3a4a6a' : '#5a3a3a' });
  // studio console: desk + mixer + mic arm + monitors
  const cx = 0.5, cz = -id / 2 + 1.0;
  desk(ctx, cx, fy, cz, 0, { w: 2.6, d: 0.9, color: '#3a3a3a', key: 'solid' });
  b.push().translate(cx, fy + 0.76, cz + 0.05).rotateX(-0.15);
  b.box('i:plastic', 0, 0, 0, 1.3, 0.06, 0.55, { color: '#2a2c30' });
  for (let i = 0; i < 12; i++) {
    b.box('i:plastic', -0.58 + i * 0.105, 0.06, 0.12, 0.02, 0.02, 0.16, { color: '#111' });
    b.box('i:plastic', -0.58 + i * 0.105, 0.07, 0.12 + (r() - 0.5) * 0.12, 0.04, 0.025, 0.03, { color: '#e8e8e0' });
    for (let k = 0; k < 3; k++) b.cyl('i:plastic', -0.58 + i * 0.105, 0.06, -0.1 - k * 0.07, 0.015, 0.02, { segs: 6, color: ['#c83a2a', '#2a8a4a', '#e8c040'][k] });
  }
  b.box('i:neon', 0.55, 0.07, -0.2, 0.1, 0.005, 0.18, { color: [0.4, 4, 0.6] });
  b.pop();
  b.cylBetween('i:metal', [cx - 0.9, fy + 0.78, cz - 0.3], [cx - 0.7, fy + 1.4, cz + 0.1], 0.012, { segs: 4, color: '#2a2a2a' });
  b.cylBetween('i:metal', [cx - 0.7, fy + 1.4, cz + 0.1], [cx - 0.4, fy + 1.25, cz + 0.45], 0.012, { segs: 4, color: '#2a2a2a' });
  b.cyl('i:metal', cx - 0.4, fy + 1.12, cz + 0.45, 0.04, 0.15, { segs: 8, color: '#3a3a3a' });
  flatScreen(ctx, cx + 0.8, fy + 0.95, cz - 0.25, 0, { w: 0.5, h: 0.3, screen: [0.6, 1.4, 2.2] });
  flatScreen(ctx, cx + 0.2, fy + 0.95, cz - 0.3, 0, { w: 0.5, h: 0.3, screen: [1.0, 1.6, 1.0] });
  chair(ctx, cx - 0.2, fy, cz + 0.9, PI, { color: '#1a1a1a' });
  ctx.point('console', cx - 0.2, fy, cz + 1.1, PI);
  ctx.point('mic', cx - 0.4, fy + 1.15, cz + 0.45, PI);
  // ON AIR sign inside
  b.box('i:neon', cx, fy + 2.2, -id / 2 + 0.06, 0.6, 0.18, 0.02, { color: [6, 0.6, 0.3] });
  ctx.point('onAir', cx, fy + 2.2, -id / 2 + 0.6, PI);
  // transmitter rack against the right wall
  serverRack(ctx, iw / 2 - 0.55, fy, -1.0, -HALF_PI);
  serverRack(ctx, iw / 2 - 0.55, fy, -0.3, -HALF_PI);
  ctx.point('transmitter', iw / 2 - 1.5, fy, -0.65, HALF_PI);
  // record crates + shelf of vinyl
  shelf(ctx, -iw / 2 + 0.3, fy, -0.2, HALF_PI, { w: 2.4, h: 1.8, d: 0.4, levels: 5, color: '#5a4030', palette: ['#1a1a1a', '#2a2a2a', '#c8302a', '#e8d8b0', '#2a4a8a'], sparse: 0.0 });
  ctx.point('records', -iw / 2 + 1.1, fy, -0.2, -HALF_PI);
  sofa(ctx, -1.2, fy, id / 2 - 0.7, PI, { w: 1.8, color: '#6a3a2a' });
  ctx.point('couch', -1.2, fy, id / 2 - 1.3, 0);
  rug(ctx, -0.8, fy, 1.0, 2.2, 1.6, '#4a2a5a');
  wallPicture(ctx, 'kzry_poster', iw / 2 - 0.02, fy + 1.6, 1.8, -HALF_PI, 0.6, 0.85, { draw: drawPoster }, { frame: '#1a1a1a' });
  ceilingLamp(ctx, 0, fy + ch, 0, { drop: 0.25, shade: '#1a1a1a', glow: [6, 4, 2.4] });
  ctx.light(cx, fy + 1.6, cz + 0.8, 0xffb080, 1.2, 5);
  wallColliders(ctx, W, D, 0, 0, [{ side: 0, u: W * 0.3, w: 0.95 }], 3.0);
  ctx.point('door_in', -W / 2 + W * 0.3, fy, D / 2 - 0.9, PI);
  ctx.doors.push({ id: 'front_in', x: -W / 2 + W * 0.3, z: D / 2 - 0.6, rot: PI, w: 0.95, leadsTo: 'exterior' });
  void partition; void rgb;
}

function drawPoster(g, W, H) {
  g.fillStyle = '#1a1a2a'; g.fillRect(0, 0, W, H);
  g.fillStyle = '#e83a2a'; g.font = `900 ${H * 0.16}px Arial Black, Arial`; g.textAlign = 'center';
  g.fillText('KZRY', W / 2, H * 0.3);
  g.fillStyle = '#f0e8d0'; g.font = `bold ${H * 0.08}px Arial`; g.fillText('88.9 FM', W / 2, H * 0.42);
  g.strokeStyle = '#50e0a0'; g.lineWidth = 3;
  for (let i = 0; i < 4; i++) { g.beginPath(); g.arc(W / 2, H * 0.7, W * (0.08 + i * 0.07), Math.PI * 1.15, Math.PI * 1.85); g.stroke(); }
  g.fillStyle = '#f0e8d0'; g.font = `${H * 0.05}px Arial`; g.fillText('THE VOICE OF THE STRAIT', W / 2, H * 0.92);
}
