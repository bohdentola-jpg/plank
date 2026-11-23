// The Rusty Anchor (Lou Amarok's bar): dark weathered siding, small windows full
// of neon beer signs, a hanging anchor sign, an old anchor by the door and kegs
// out back. Interior: bar counter with stools, back bar with bottles and taps,
// dartboard with a throw line, pool table, tables, nautical junk on the walls.
import * as THREE from 'three';
import { makeCtx, finish, sign, sideFrame, porchLight, weather, rgb, LIGHT, PI, HALF_PI } from './common.js';
import { civic } from './civic.js';
import { addProp } from '../props.js';
import {
  floor, ceiling, partition, wallColliders, stool, counter, table, chair, wallPicture, shelf, flatScreen,
} from './furniture.js';
import { ceilingLamp } from './common.js';

/** Big old ship's anchor (stocked), standing on its crown, facing +z. */
export function anchorProp(b, key, color, s = 1) {
  b.push().scale(s);
  b.cylBetween(key, [0, 0.25, 0], [0, 2.1, 0], 0.07, { segs: 8, color });
  b.push().translate(0, 2.15, 0).rotateX(HALF_PI);
  b.lathe(key, 0, -0.04, 0, [[0.16, 0], [0.2, 0.04], [0.16, 0.08]], { segs: 10, color });
  b.pop();
  b.cylBetween(key, [-0.55, 1.85, 0], [0.55, 1.85, 0], 0.045, { segs: 6, color });
  const arc = [];
  for (let i = 0; i <= 10; i++) { const a = PI + (i / 10) * PI; arc.push([Math.cos(a) * 0.75, 0.75 + Math.sin(a) * 0.55, 0]); }
  b.tube(key, arc, 0.06, { segs: 6, color });
  for (const sx of [-1, 1]) {
    b.push().translate(sx * 0.75, 0.75, 0).rotateZ(sx * 0.6);
    b.poly(key, [[-0.16, 0, 0.03], [0.16, 0, 0.03], [0, 0.32, 0.03]], { color, want: [0, 0, 1] });
    b.poly(key, [[0.16, 0, -0.03], [-0.16, 0, -0.03], [0, 0.32, -0.03]], { color, want: [0, 0, -1] });
    b.pop();
  }
  b.pop();
}

export function build(opts = {}) {
  const ctx = makeCtx('bar', opts);
  const b = ctx.b, r = ctx.rng, st = ctx.state, wear = ctx.wear;
  const W = 13, D = 11, fy = 0.35, sH = 3.0;
  ctx.footprint = { w: W + 4, d: D + 6 };
  const open = st > 0.1;
  const res = civic(ctx, {
    W, D, fy, storeys: 1, sH, key: wear > 0.4 ? 'siding_lap_old' : 'siding_lap', color: wear > 0.4 ? weather('#8a6a5a', 0.2) : weather('#5a2a22', wear * 0.5), trim: weather('#2a2a28', wear * 0.3),
    roof: { type: 'gable', axis: 'x', pitch: 0.4, key: wear > 0.3 ? 'metal_corr_rust' : 'metal_corr', color: '#ffffff', icicles: 0.6 },
    win: { w: 0.9, h: 0.65, per: 2.6, sill: 1.35, style: 'fixed', cell: 6, lit: () => (open ? [0.8, 0.5, 0.35] : LIGHT.off), sides: [true, true, false, true] },
    doors: [{ side: 0, u: W * 0.62, w: 0.95, h: 2.1, style: 'steel', color: weather('#1a2a3a', wear * 0.3), id: 'front', main: true, leaf: ctx.wantInterior ? 'leaf_front' : null, light: open ? [0.9, 0.5, 0.3] : LIGHT.off },
      { side: 2, u: W * 0.25, w: 0.95, style: 'steel', color: '#4a4a48', id: 'back' }],
    entry: { type: 'canopy', w: 2.0, d: 1.3, h: 2.5, roofKey: 'metal_corr_rust', roofColor: '#ffffff', posts: false },
    access: 'steps',
    inner: ctx.wantInterior ? { key: 'wood_panel', color: '#8a6a4a', trim: '#3a2a1a', y0: fy, y1: fy + 2.8 } : null,
    noCollider: ctx.wantInterior,
  });
  // neon beer signs in the windows (generic, no brands)
  const neons = [['BEER', '#ff3a2a'], ['OPEN', '#30a0ff'], ['ON TAP', '#ffb020'], ['COLD BEER', '#40ff80'], ['LIVE DARTS', '#ff40c0']];
  let ni = 0;
  for (const s of [0, 1, 3]) {
    const ops = res.sides[s].filter((o) => o.kind === 'win');
    sideFrame(b, s, W, D);
    for (const op of ops) {
      const [t, c] = neons[ni++ % neons.length];
      sign(ctx, 'bar_neon_' + t, op.u, op.y + op.h / 2, -0.05, op.w * 0.85, op.h * 0.55, { kind: 'neon', glow: open ? 5 : 0.12, ppm: 180, flicker: t === 'BEER' ? 1 : 0, lines: [{ text: t, size: 0.7, color: c, font: '"Arial Black", Arial, sans-serif', weight: '900', glowColor: c, glowBlur: 0.25 }] });
    }
    b.pop();
  }
  // hanging sign on a bracket by the door
  b.push().translate(-W / 2 + W * 0.62 + 1.2, fy + 2.75, D / 2);
  b.box('metal', 0, 0, 0.5, 0.05, 0.05, 1.0, { color: '#1a1a1a' });
  b.beam('metal', [0, -0.4, 0.02], [0, -0.02, 0.6], 0.03, 0.03, { color: '#1a1a1a' });
  for (const dz of [0.15, 0.85]) b.cylBetween('metal', [0, 0, dz], [0, -0.25, dz], 0.008, { segs: 3, color: '#1a1a1a' });
  b.push().translate(0, -0.85, 0.5).rotateY(HALF_PI);
  sign(ctx, 'rusty_anchor_sign', 0, 0, 0.02, 1.0, 1.15, { kind: 'paint', ppm: 140, bg: '#1e2a36', border: '#c8a050', fade: wear * 0.7, seed: 9, draw: drawAnchorSign }, { back: true, board: '#3a2a1a', boardT: 0.03 });
  b.pop();
  b.pop();
  // name painted across the front above the windows
  b.push().translate(-W / 2, 0, D / 2);
  sign(ctx, 'rusty_anchor_front', W * 0.3, fy + 2.62, 0.03, 5.4, 0.55, { kind: 'paint', ppm: 110, fade: Math.max(0.15, wear), seed: 4, transparent: true, lines: [{ text: (ctx.name || 'THE RUSTY ANCHOR').toUpperCase(), size: 0.72, color: '#e8d8b0', font: 'Georgia, "Times New Roman", serif', weight: 'bold', spacing: 0.06 }] });
  // the old anchor leaning beside the door
  b.push().translate(W * 0.62 - 1.4, 0, 1.2).rotateY(0.2).rotateZ(0.12);
  anchorProp(b, 'metal_rust', '#ffffff', 0.85);
  b.pop();
  b.pop();
  porchLight(ctx, -W / 2 + W * 0.62 - 0.75, fy + 2.2, D / 2 + 0.05, 0, open);
  // kegs + crates + a dumpster out back, a bench with an ashtray can
  for (let i = 0; i < 4; i++) {
    b.cyl('chrome', -W / 2 + 1.5 + (i % 2) * 0.48, (i > 1 ? 0.6 : 0), -D / 2 - 0.7, 0.21, 0.58, { segs: 12, color: '#c8cccc' });
  }
  b.at(W / 2 - 2.0, 0, -D / 2 - 1.6, PI);
  addProp(b, 'dumpster', { rust: wear }, r);
  b.pop();
  b.at(-W / 2 - 1.0, 0, D / 2 - 1.5, HALF_PI);
  addProp(b, 'bench', { color: '#3a2a1a' }, r);
  b.pop();
  ctx.point('smokingBench', -W / 2 - 1.5, 0, D / 2 - 1.5, HALF_PI);
  ctx.doors.push({ id: 'front', x: -W / 2 + W * 0.62, z: D / 2 + 0.1, rot: 0, w: 0.95, leadsTo: ctx.wantInterior ? 'interior' : 'exterior' });
  ctx.doors.push({ id: 'back', x: W / 2 - W * 0.25, z: -D / 2 - 0.1, rot: PI, w: 0.95, leadsTo: ctx.wantInterior ? 'interior' : 'exterior' });
  ctx.point('door', -W / 2 + W * 0.62, 0, D / 2 + 2.6, PI);
  if (ctx.wantInterior) interior(ctx, { W, D, fy });
  return finish(ctx);
}

function drawAnchorSign(g, W, H) {
  g.fillStyle = '#1e2a36'; g.fillRect(0, 0, W, H);
  g.fillStyle = '#c8a050'; g.font = `bold ${H * 0.12}px Georgia, serif`; g.textAlign = 'center';
  g.fillText('THE', W / 2, H * 0.14);
  g.fillText('RUSTY ANCHOR', W / 2, H * 0.93, W * 0.92);
  g.strokeStyle = '#b8642a'; g.lineWidth = W * 0.05; g.lineCap = 'round';
  g.beginPath(); g.moveTo(W / 2, H * 0.22); g.lineTo(W / 2, H * 0.72); g.stroke();
  g.beginPath(); g.moveTo(W * 0.3, H * 0.3); g.lineTo(W * 0.7, H * 0.3); g.stroke();
  g.beginPath(); g.arc(W / 2, H * 0.52, W * 0.28, Math.PI * 0.15, Math.PI * 0.85); g.stroke();
  g.beginPath(); g.arc(W / 2, H * 0.2, W * 0.05, 0, Math.PI * 2); g.stroke();
}

function drawDartboard(g, W, H) {
  const cx = W / 2, cy = H / 2, R = W * 0.48;
  g.fillStyle = '#1a1a1a'; g.beginPath(); g.arc(cx, cy, R, 0, Math.PI * 2); g.fill();
  const rings = [[0.78, 0.74], [0.5, 0.46]];
  for (let i = 0; i < 20; i++) {
    const a0 = (i / 20) * Math.PI * 2 - Math.PI / 20, a1 = a0 + Math.PI / 10;
    g.fillStyle = i % 2 ? '#e8dcc0' : '#1a1a1a';
    g.beginPath(); g.moveTo(cx, cy); g.arc(cx, cy, R * 0.78, a0, a1); g.fill();
    for (const [o, inn] of rings) {
      g.fillStyle = i % 2 ? '#c81a1a' : '#1a8a3a';
      g.beginPath(); g.arc(cx, cy, R * o, a0, a1); g.arc(cx, cy, R * inn, a1, a0, true); g.fill();
    }
  }
  g.fillStyle = '#1a8a3a'; g.beginPath(); g.arc(cx, cy, R * 0.09, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#c81a1a'; g.beginPath(); g.arc(cx, cy, R * 0.04, 0, Math.PI * 2); g.fill();
}

function interior(ctx, { W, D, fy }) {
  const b = ctx.b, r = ctx.rng;
  const iw = W - 0.5, id = D - 0.5, ch = 2.8;
  floor(ctx, 0, 0, iw, id, fy, 'floor_wood', '#8a6040');
  ceiling(ctx, 0, 0, iw, id, fy + ch, 'wood_raw', '#5a4030');
  // bar counter along the back with the back bar
  const bz = -id / 2 + 2.0;
  counter(ctx, -0.8, fy, bz, 0, { w: 6.4, d: 0.65, h: 1.08, key: 'wood_dark', color: '#4a2a18', top: '#2a1a10' });
  b.box('i:chrome', -0.8, fy + 0.12, bz + 0.34, 6.4, 0.05, 0.05, { color: '#b8a070' }); // foot rail
  for (let i = 0; i < 6; i++) {
    stool(ctx, -3.6 + i * 1.1, fy, bz + 0.8, { color: '#2a1a12' });
    ctx.point('stool' + (i + 1), -3.6 + i * 1.1, fy, bz + 0.8, PI);
  }
  // taps
  for (let i = 0; i < 5; i++) { b.cyl('i:chrome', -1.2 + i * 0.16, fy + 1.08, bz - 0.1, 0.02, 0.3, { segs: 6, color: '#d8d8d0' }); b.box('i:plastic', -1.2 + i * 0.16, fy + 1.38, bz - 0.1, 0.035, 0.12, 0.035, { color: ['#c81a1a', '#1a1a1a', '#e8c040', '#2a6aa8', '#1a1a1a'][i] }); }
  // back bar: shelves with glowing bottles + mirror
  b.box('i:wood_dark', -0.8, fy, -id / 2 + 0.35, 6.0, 0.9, 0.55, { color: '#3a2214' });
  b.box('i:chrome', -0.8, fy + 1.1, -id / 2 + 0.02, 5.6, 1.2, 0.02, { color: '#8a9aa0' });
  for (let l = 0; l < 3; l++) {
    b.box('i:wood_dark', -0.8, fy + 1.05 + l * 0.45, -id / 2 + 0.2, 5.6, 0.03, 0.3, { color: '#3a2214' });
    for (let k = 0; k < 22; k++) {
      const c = ['#3a8a2a', '#8a4a1a', '#c8a050', '#e8e8e0', '#4a1a1a', '#2a4a8a'][(r() * 6) | 0];
      const x = -3.4 + k * 0.24 + (r() - 0.5) * 0.05;
      b.cyl('i:glass_clear', x, fy + 1.08 + l * 0.45, -id / 2 + 0.2, 0.04, 0.28, { segs: 6, color: c });
      b.cyl('i:neon', x, fy + 1.08 + l * 0.45, -id / 2 + 0.2, 0.032, 0.2, { segs: 6, color: rgb(c, 0.9) });
    }
  }
  b.box('i:neon', -0.8, fy + 1.04, -id / 2 + 0.3, 5.6, 0.02, 0.02, { color: [4, 2.2, 1.0] });
  flatScreen(ctx, -0.8, fy + 2.3, -id / 2 + 0.05, 0, { w: 0.9, h: 0.5, stand: false, screen: [0.6, 1.4, 0.8] });
  ctx.point('barCounter', -0.8, fy, bz + 1.4, PI);
  ctx.point('bartender', -0.8, fy, bz - 0.8, 0);
  // dartboard on the left wall + oche (throw line) 2.37 m away
  const dz = 1.2;
  wallPicture(ctx, 'dartboard', -iw / 2 + 0.03, fy + 1.73, dz, HALF_PI, 0.45, 0.45, { draw: drawDartboard }, { frame: '#1a1a1a' });
  b.box('i:wood_dark', -iw / 2 + 0.03, fy + 1.1, dz, 0.04, 1.4, 1.2, { color: '#2a1a12' });
  b.box('i:paint', -iw / 2 + 0.03 + 2.37, fy + 0.004, dz, 0.04, 0.012, 0.6, { color: '#e8c040' });
  wallPicture(ctx, 'dart_scores', -iw / 2 + 0.03, fy + 1.6, dz + 1.0, HALF_PI, 0.5, 0.65, { draw: drawScores }, { frame: '#1a1a1a' });
  ctx.point('dartboard', -iw / 2 + 0.6, fy, dz, -HALF_PI);
  ctx.point('dartLine', -iw / 2 + 0.03 + 2.37, fy, dz, -HALF_PI);
  // pool table with a low lamp
  const px = 2.6, pz = 1.6;
  b.push().translate(px, fy, pz);
  b.box('i:wood_dark', 0, 0.65, 0, 2.6, 0.14, 1.5, { color: '#4a2a18' });
  b.box('i:fabric', 0, 0.79, 0, 2.3, 0.02, 1.2, { color: '#1a6a3a' });
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.box('i:wood_dark', sx * 1.1, 0, sz * 0.6, 0.15, 0.65, 0.15, { color: '#3a2014' });
  for (let i = 0; i < 9; i++) b.sphere('i:plastic', (r() - 0.5) * 1.8, 0.83, (r() - 0.5) * 0.9, 0.028, { rings: 3, segs: 6, color: ['#e8e8e0', '#e8c020', '#1a4a9a', '#c81a1a', '#5a1a8a', '#e86a1a', '#1a7a3a', '#7a1a1a', '#1a1a1a'][i] });
  b.beam('i:wood_raw', [-0.8, 0.82, 0.3], [0.6, 0.85, 0.5], 0.015, 0.015, { color: '#c8a070' });
  b.pop();
  b.box('i:metal', px, fy + 1.75, pz, 1.6, 0.18, 0.4, { color: '#1a4a2a' });
  b.box('i:neon', px, fy + 1.745, pz, 1.4, 0.01, 0.3, { color: [5, 4.2, 2.8] });
  b.cylBetween('i:metal', [px - 0.6, fy + 1.9, pz], [px - 0.6, fy + 2.8, pz], 0.006, { segs: 3, color: '#1a1a1a' });
  b.cylBetween('i:metal', [px + 0.6, fy + 1.9, pz], [px + 0.6, fy + 2.8, pz], 0.006, { segs: 3, color: '#1a1a1a' });
  ctx.colLocal(px, pz, 2.6, 1.5, 0.85);
  ctx.light(px, fy + 1.5, pz, 0xffe0b0, 1.6, 5);
  ctx.point('poolTable', px, fy, pz + 1.3, PI);
  // tables
  for (const [x, z] of [[-2.8, 3.0], [-0.8, 3.4], [0.2, 1.4]]) {
    table(ctx, x, fy, z, 0, { round: true, w: 0.8, color: '#4a2a18' });
    for (let k = 0; k < 3; k++) { const a = k * 2.1 + 0.4; chair(ctx, x + Math.sin(a) * 0.65, fy, z + Math.cos(a) * 0.65, a + PI, { color: '#3a2214' }); }
  }
  ctx.point('table1', -2.8, fy, 3.7, PI);
  ctx.point('table2', -0.8, fy, 4.1, PI);
  // nautical junk: nets, a life ring, buoys on the walls
  b.box('i:fabric', iw / 2 - 0.05, fy + 1.6, -1.0, 0.04, 1.2, 2.2, { color: '#4a5a3a' });
  b.push().translate(iw / 2 - 0.08, fy + 1.9, 1.5).rotateZ(HALF_PI);
  b.lathe('i:plastic', 0, -0.06, 0, [[0.2, 0], [0.3, 0.04], [0.32, 0.06], [0.3, 0.08], [0.2, 0.12]], { segs: 14, color: '#e8e4dc' });
  b.pop();
  for (let i = 0; i < 4; i++) b.sphere('i:plastic', iw / 2 - 0.15, fy + 2.3, -2.4 + i * 0.4, 0.12, { rings: 4, segs: 8, color: ['#e86a1a', '#e8e4dc', '#c81a1a', '#e8c020'][i] });
  // neon OPEN sign and lights
  ceilingLamp(ctx, -2.0, fy + ch, 2.5, { drop: 0.5, shade: '#2a1a12', glow: [6, 3.6, 1.8] });
  ceilingLamp(ctx, -0.8, fy + ch, bz + 0.3, { drop: 0.6, shade: '#5a1a12', glow: [6, 3.0, 1.4], intensity: 1.6 });
  wallColliders(ctx, W, D, 0, 0, [{ side: 0, u: W * 0.62, w: 0.95 }, { side: 2, u: W * 0.25, w: 0.95 }], 3.0);
  ctx.point('door_in', -W / 2 + W * 0.62, fy, D / 2 - 0.9, PI);
  ctx.point('backDoor', W / 2 - W * 0.25, fy, -D / 2 + 0.9, 0);
  ctx.doors.push({ id: 'front_in', x: -W / 2 + W * 0.62, z: D / 2 - 0.6, rot: PI, w: 0.95, leadsTo: 'exterior' });
  void partition; void shelf; void THREE;
}

function drawScores(g, W, H) {
  g.fillStyle = '#1a2a1a'; g.fillRect(0, 0, W, H);
  g.strokeStyle = '#e8e8e0'; g.lineWidth = 2;
  g.beginPath(); g.moveTo(W / 2, H * 0.12); g.lineTo(W / 2, H); g.moveTo(0, H * 0.12); g.lineTo(W, H * 0.12); g.stroke();
  g.fillStyle = '#e8e8e0'; g.font = `${H * 0.08}px Arial`; g.textAlign = 'center';
  g.fillText('LOU', W * 0.25, H * 0.09); g.fillText('RAY', W * 0.75, H * 0.09);
  for (let i = 0; i < 5; i++) { g.fillText(String(501 - i * 87), W * 0.25, H * (0.24 + i * 0.13)); g.fillText(String(501 - i * 61), W * 0.75, H * (0.24 + i * 0.13)); }
}
