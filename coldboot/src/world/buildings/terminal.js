// Port Zarya airstrip terminal (PZY): a run-down corrugated-metal shack with a
// flickering PORT ZARYA PZY sign, a windsock, fuel drums and a baggage cart.
// Interior: check-in counter with a baggage scale, benches, an oil heater,
// a notice board and a weather screen.
import { makeCtx, finish, sign, sideFrame, porchLight, weather, rgb, LIGHT, PI, HALF_PI } from './common.js';
import { civic } from './civic.js';
import { addProp } from '../props.js';
import { floor, ceiling, wallColliders, counter, bench, crtMonitor, wallPicture, chair } from './furniture.js';
import { tubeLight } from './common.js';

/** Windsock on a pole (orange/white striped cone). */
export function windsock(ctx, x, z, h = 6.5, yaw = 0.6) {
  const b = ctx.b;
  b.cyl('galv', x, 0, z, 0.06, h, { segs: 8, color: '#c8ccce' });
  b.box('concrete', x, -0.1, z, 0.7, 0.25, 0.7, { color: '#9a9a94' });
  b.push().translate(x, h - 0.05, z).rotateY(yaw);
  b.push().rotateZ(HALF_PI * 0.0);
  b.cyl('galv', 0, 0, 0, 0.36, 0.04, { segs: 12, caps: '', color: '#c8ccce' });
  b.pop();
  // the sock: frustum along +x, drooping slightly, 5 bands
  const L = 2.4;
  for (let i = 0; i < 5; i++) {
    const t0 = i / 5, t1 = (i + 1) / 5;
    const r0 = 0.36 - t0 * 0.2, r1 = 0.36 - t1 * 0.2;
    b.push().translate(t0 * L, -t0 * t0 * 0.35, 0).rotateZ(-HALF_PI - 0.12 - t0 * 0.1);
    b.cyl('fabric', 0, 0, 0, r0, (L / 5) * 1.01, { rTop: r1, segs: 10, caps: '', color: i % 2 ? '#f0f0ea' : '#e8501a' });
    b.pop();
  }
  b.pop();
}

export function build(opts = {}) {
  const ctx = makeCtx('terminal', opts);
  const b = ctx.b, r = ctx.rng, st = ctx.state, wear = ctx.wear;
  const W = 13, D = 7.5, fy = 0.35, sH = 3.0;
  ctx.footprint = { w: W + 12, d: D + 8 };
  const rusty = wear > 0.35;
  civic(ctx, {
    W, D, fy, storeys: 1, sH, key: rusty ? 'metal_corr_rust' : 'metal_corr_paint', color: rusty ? '#ffffff' : weather('#7a96a8', wear * 0.6), trim: weather('#d8d8d0', wear * 0.6), corner: 0.12,
    roof: { type: 'gable', axis: 'x', pitch: 0.28, key: rusty ? 'metal_corr_rust' : 'metal_corr', color: '#ffffff', icicles: 0.5, eave: 0.4 },
    win: { w: 1.4, h: 1.0, per: 3.2, style: 'slider', sill: 1.1, cell: 7, lit: (s, k, i) => (st > 0.1 && i % 2 === 0 ? LIGHT.soft : LIGHT.off), sides: [true, false, true, true] },
    doors: [{ side: 0, u: W * 0.35, w: 0.95, style: 'steel', color: weather('#c8c8c0', wear * 0.5), id: 'front', main: true, leaf: ctx.wantInterior ? 'leaf_front' : null, light: LIGHT.dim },
      { side: 2, u: W * 0.6, w: 1.6, h: 2.2, style: 'double', color: weather('#8a8a84', wear * 0.5), id: 'airside' }],
    entry: { type: 'canopy', w: 2.6, d: 1.6, h: 2.5, roofKey: rusty ? 'metal_corr_rust' : 'metal_corr', roofColor: '#ffffff', posts: true, postKey: 'galv', postColor: '#9aa0a2' },
    access: 'steps', skirt: null,
    inner: ctx.wantInterior ? { key: 'siding_panel', color: '#b8c0b0', trim: '#6a6a66', y0: fy, y1: fy + 2.7 } : null,
    noCollider: ctx.wantInterior,
  });
  // the sign on the roof edge: flickering when run-down
  b.push().translate(-W / 2, 0, D / 2);
  b.box('metal', W * 0.6, fy + sH + 0.05, 0.25, 4.6, 0.95, 0.18, { color: '#2a2e32' });
  for (const x of [W * 0.6 - 2.0, W * 0.6 + 2.0]) b.beam('metal', [x, fy + sH - 0.2, 0.02], [x, fy + sH + 0.5, 0.25], 0.05, 0.05, { color: '#2a2e32' });
  sign(ctx, 'pzy_sign_' + (st > 0.7 ? 'ok' : 'flk'), W * 0.6, fy + sH + 0.52, 0.345, 4.3, 0.75, {
    kind: 'neon', glow: st > 0.05 ? 4.5 : 0.1, ppm: 150, flicker: st > 0.7 ? 0 : 1,
    lines: [{ text: (ctx.name || 'PORT ZARYA  PZY').toUpperCase(), size: 0.62, color: '#ffd890', font: '"Arial Narrow", Arial, sans-serif', weight: 'bold', spacing: 0.08, glowColor: '#ffa040', glowBlur: 0.25 }],
  });
  b.pop();
  porchLight(ctx, -W / 2 + W * 0.35 + 0.8, fy + 2.15, D / 2 + 0.05, 0, st > 0.1);
  windsock(ctx, W / 2 + 6, -D / 2 - 3, 6.5, 0.8);
  // weather station on the roof: anemometer + vane
  b.cylBetween('galv', [-W / 2 + 1.5, fy + sH + 0.3, 0], [-W / 2 + 1.5, fy + sH + 2.6, 0], 0.025, { segs: 5, color: '#c8ccce' });
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * PI * 2;
    b.cylBetween('galv', [-W / 2 + 1.5, fy + sH + 2.6, 0], [-W / 2 + 1.5 + Math.cos(a) * 0.22, fy + sH + 2.6, Math.sin(a) * 0.22], 0.008, { segs: 3, color: '#c8ccce' });
    b.sphere('plastic', -W / 2 + 1.5 + Math.cos(a) * 0.24, fy + sH + 2.6, Math.sin(a) * 0.24, 0.04, { rings: 2, segs: 5, color: '#e8e8e0' });
  }
  // outside: bench, baggage cart, drums, propane
  b.at(-W / 2 + 1.6, 0, D / 2 + 1.2, PI);
  addProp(b, 'bench', { color: '#4a3a2a' }, r);
  b.pop();
  b.push().translate(W / 2 + 2.0, 0, 1.0).rotateY(0.3);
  b.box('metal', 0, 0.45, 0, 1.2, 0.08, 2.2, { color: '#3a5a8a' });
  for (const sx of [-1, 1]) for (const sz of [-0.8, 0.8]) { b.push().translate(sx * 0.55, 0.2, sz).rotateZ(HALF_PI); b.cyl('rubber', 0, -0.06, 0, 0.2, 0.12, { segs: 10, color: '#161616' }); b.pop(); }
  for (let i = 0; i < 3; i++) b.box('fabric', (r() - 0.5) * 0.5, 0.53, -0.6 + i * 0.6, 0.55, 0.35, 0.45, { color: ['#2a3a5a', '#5a2a2a', '#3a4a3a'][i] });
  b.pop();
  for (let i = 0; i < 3; i++) { b.at(-W / 2 - 1.0, 0, -1.6 + i * 0.66, 0); addProp(b, 'fuelDrum', { color: '#1a4a8a', rust: wear, tipped: i === 2 && wear > 0.5 }, r); b.pop(); }
  ctx.doors.push({ id: 'front', x: -W / 2 + W * 0.35, z: D / 2 + 0.1, rot: 0, w: 0.95, leadsTo: ctx.wantInterior ? 'interior' : 'exterior' });
  ctx.doors.push({ id: 'airside', x: W / 2 - W * 0.6, z: -D / 2 - 0.1, rot: PI, w: 1.6, leadsTo: ctx.wantInterior ? 'interior' : 'exterior' });
  ctx.point('door', -W / 2 + W * 0.35, 0, D / 2 + 3.0, PI);
  ctx.point('gate', W / 2 - W * 0.6, 0, -D / 2 - 2.0, 0);
  ctx.point('windsock', W / 2 + 6, 0, -D / 2 - 1.5, PI);
  if (ctx.wantInterior) interior(ctx, { W, D, fy });
  return finish(ctx);
}

function interior(ctx, { W, D, fy }) {
  const b = ctx.b;
  const iw = W - 0.5, id = D - 0.5, ch = 2.7;
  floor(ctx, 0, 0, iw, id, fy, 'linoleum', '#a8a090');
  ceiling(ctx, 0, 0, iw, id, fy + ch, 'plaster', '#d8d4c8');
  tubeLight(ctx, -2.5, fy + ch, 0, 1.2);
  tubeLight(ctx, 2.5, fy + ch, 0, 1.2, { color: [1.2, 1.3, 1.25] }); // one dead tube
  // counter + scale
  counter(ctx, iw / 2 - 1.8, fy, -0.4, PI * 0.5, { w: 2.6, d: 0.7, h: 1.05, key: 'solid', color: '#6a7a8a', top: '#c8c0a8', panels: false, register: null });
  crtMonitor(ctx, iw / 2 - 1.6, fy + 1.05, -0.8, -HALF_PI);
  b.box('i:sheet_metal', iw / 2 - 2.8, fy, 1.4, 0.8, 0.18, 0.6, { color: '#8a8e90' });
  b.box('i:sheet_metal', iw / 2 - 2.8, fy + 0.18, 1.12, 0.3, 1.0, 0.06, { color: '#6a6e70' });
  b.box('i:neon', iw / 2 - 2.8, fy + 1.05, 1.15, 0.18, 0.08, 0.005, { color: [4, 0.6, 0.3] });
  ctx.point('counter', iw / 2 - 2.9, fy, -0.4, HALF_PI);
  ctx.point('agent', iw / 2 - 0.8, fy, -0.4, -HALF_PI);
  ctx.point('scale', iw / 2 - 2.8, fy, 2.0, PI);
  // benches back to back
  for (const z of [0.6, -0.9]) {
    bench(ctx, -2.6, fy, z, z > 0 ? PI : 0, { w: 2.6, color: '#3a5a8a', back: true });
  }
  ctx.point('bench1', -2.6, fy, 1.2, PI);
  ctx.point('bench2', -2.6, fy, -1.5, 0);
  // Toyo oil heater + its vent, notice board, weather CRT on a bracket
  b.box('i:sheet_metal', -iw / 2 + 0.4, fy, -2.4, 0.4, 0.6, 0.7, { color: '#d8d4c8' });
  b.box('i:neon', -iw / 2 + 0.605, fy + 0.25, -2.4, 0.005, 0.1, 0.3, { color: [5, 1.8, 0.4] });
  b.cylBetween('i:metal', [-iw / 2 + 0.3, fy + 0.5, -2.4], [-iw / 2 - 0.1, fy + 0.5, -2.4], 0.04, { segs: 6, color: '#8a8a84' });
  ctx.light(-iw / 2 + 0.8, fy + 0.4, -2.4, 0xff8a40, 0.8, 3);
  ctx.point('stove', -iw / 2 + 1.2, fy, -2.4, -HALF_PI);
  wallPicture(ctx, 'pzy_notices', -iw / 2 + 0.02, fy + 1.6, 0.8, HALF_PI, 1.3, 0.9, { draw: drawNotices }, { frame: '#5a4a3a' });
  ctx.point('notices', -iw / 2 + 0.9, fy, 0.8, -HALF_PI);
  crtMonitor(ctx, 0.8, fy + 2.0, -id / 2 + 0.25, 0, { screen: [0.3, 1.2, 2.0] });
  b.box('i:metal', 0.8, fy + 1.95, -id / 2 + 0.15, 0.3, 0.05, 0.3, { color: '#2a2a2a' });
  ctx.point('weatherScreen', 0.8, fy, -id / 2 + 1.2, PI);
  // vending machine (old)
  b.box('i:sheet_metal', 3.6, fy, -id / 2 + 0.45, 0.9, 1.85, 0.75, { color: '#8a1a1a' });
  b.box('i:neon', 3.45, fy + 1.0, -id / 2 + 0.83, 0.45, 0.7, 0.01, { color: [2.2, 2.4, 2.6] });
  ctx.light(0, fy + 2.3, 0, 0xe8f0e0, 1.2, 8);
  wallColliders(ctx, W, D, 0, 0, [{ side: 0, u: W * 0.35, w: 0.95 }, { side: 2, u: W * 0.6, w: 1.6 }], 3.0);
  ctx.point('door_in', -W / 2 + W * 0.35, fy, D / 2 - 0.9, PI);
  ctx.doors.push({ id: 'front_in', x: -W / 2 + W * 0.35, z: D / 2 - 0.6, rot: PI, w: 0.95, leadsTo: 'exterior' });
  void chair; void rgb;
}

function drawNotices(g, W, H) {
  g.fillStyle = '#9a7a54'; g.fillRect(0, 0, W, H);
  const t = [['TOLLIVER AIR', 'Charters · Lessons'], ['NO FIREARMS', 'beyond this point'], ['WEATHER HOLD', 'Check with agent'], ['FISH TOTES', 'tag before loading'], ['LOST & FOUND', 'ask Wade']];
  t.forEach(([a, c], i) => {
    const x = (i % 3) * W / 3 + 6, y = Math.floor(i / 3) * H / 2 + 6;
    g.fillStyle = ['#fff8e0', '#ffe0d8', '#e0f0ff', '#f0ffe0', '#fff'][i]; g.fillRect(x, y, W / 3 - 12, H / 2 - 14);
    g.fillStyle = '#2a2a2a'; g.font = `bold ${H * 0.075}px Arial`; g.fillText(a, x + 4, y + H * 0.1, W / 3 - 20);
    g.font = `${H * 0.06}px Arial`; g.fillText(c, x + 4, y + H * 0.2, W / 3 - 20);
  });
}
