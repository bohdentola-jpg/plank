// NORTHSTAR 24 — the gleaming new corner store that doesn't belong here:
// a glass-and-steel box with spotless white panels, a white LED canopy, a cold
// cyan NORTHSTAR 24 neon logo, smart bollards and far too many security
// cameras (returned in `cameras`). It is always immaculate (state only dims
// the logo at 0). Interior: spotless aisles, coolers, register, coffee bar,
// back room with a wall of CCTV monitors.
import {
  makeCtx, finish, walls, roofFlat, sideFrame, sign, steps, weather, rgb, LIGHT, PI, HALF_PI,
} from './common.js';
import { addProp } from '../props.js';
import { getSignMaterial } from '../materials.js';
import {
  floor, ceiling, partition, wallColliders, counter, shelf, cooler, desk, chair, flatScreen, filingCabinet,
} from './furniture.js';
import { tubeLight } from './common.js';

const CYAN = [1.2, 7.5, 9.5];
const WHITE_LED = [7.5, 8.2, 9.0];

/** A security camera (bullet on a bracket, or a dome) facing yaw in its local frame; registers in ctx.cameras. */
export function secCam(ctx, x, y, z, yaw, o = {}) {
  const b = ctx.b;
  b.push().translate(x, y, z).rotateY(yaw);
  if (o.dome) {
    b.cyl('sheet_metal', 0, -0.04, 0, 0.12, 0.05, { segs: 12, color: '#f2f4f6' });
    b.sphere('glass_dark', 0, -0.04, 0, 0.1, { phiTop: HALF_PI, rings: 4, segs: 12, color: '#000' });
  } else {
    b.box('sheet_metal', 0, -0.03, -0.05, 0.06, 0.06, 0.12, { color: '#e8eaec' });
    b.beam('sheet_metal', [0, -0.02, 0.02], [0, -0.12, 0.2], 0.05, 0.05, { color: '#e8eaec' });
    b.push().translate(0, -0.16, 0.24).rotateX(0.35);
    b.box('sheet_metal', 0, -0.05, -0.12, 0.11, 0.1, 0.26, { color: '#f2f4f6' });
    b.box('sheet_metal', 0, 0.05, -0.12, 0.14, 0.02, 0.3, { color: '#f2f4f6' });
    b.cyl('glass_dark', 0, -0.0, 0.01, 0.035, 0.01, { segs: 8, color: '#000' });
    b.pop();
  }
  b.sphere('neon', o.dome ? 0.08 : 0.04, o.dome ? -0.06 : -0.13, o.dome ? 0.04 : 0.2, 0.009, { rings: 2, segs: 4, color: [6, 0.15, 0.1] });
  b.pop();
  ctx.camera(x, y - 0.15, z, yaw, o.pitch ?? -0.5, o.fov ?? (o.dome ? 90 : 60), o.range ?? 20, true);
}

/** Five-point star outline for logos. */
function starPts(cx, cy, R, r, n = 5) {
  const pts = [];
  for (let i = 0; i < n * 2; i++) {
    const a = HALF_PI + (i * PI) / n;
    const rr = i % 2 ? r : R;
    pts.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]);
  }
  return pts;
}

export function build(opts = {}) {
  const ctx = makeCtx('cornerStore', opts);
  const b = ctx.b, r = ctx.rng, st = ctx.state;
  const W = 18, D = 13, fy = 0.18, H = 4.6;
  const white = '#f4f6f8';
  ctx.footprint = { w: W + 2, d: D + 9 };
  const logoOn = st > 0.05;
  // ---- shell: white panels, glass front
  const sides = [[], [], [], []];
  const gw = W - 3.0;
  sides[0].push({ kind: 'win', u: W / 2 - 3.6, y: fy + 0.25, w: gw / 2 - 1.8, h: H - 0.9, style: 'store', gx: 3, light: LIGHT.cold, cell: 4, sill: false, casing: 0, sashColor: '#c8ced2', glass: 'glass_cold' });
  sides[0].push({ kind: 'win', u: W / 2 + 3.6, y: fy + 0.25, w: gw / 2 - 1.8, h: H - 0.9, style: 'store', gx: 3, light: LIGHT.cold, cell: 4, sill: false, casing: 0, sashColor: '#c8ced2', glass: 'glass_cold' });
  sides[0].push({ kind: 'door', u: W / 2, y: fy, w: 2.4, h: 2.6, style: 'store2', frame: '#c8ced2', glass: 'glass_cold', light: LIGHT.cold, cell: 4, id: 'front', casing: 0, leaf: ctx.wantInterior ? 'leaf_front' : null });
  sides[1].push({ kind: 'win', u: 2.4, y: fy + 0.25, w: 3.2, h: H - 0.9, style: 'store', gx: 2, light: LIGHT.cold, cell: 4, sill: false, casing: 0, sashColor: '#c8ced2', glass: 'glass_cold' });
  sides[3].push({ kind: 'win', u: D - 2.4, y: fy + 0.25, w: 3.2, h: H - 0.9, style: 'store', gx: 2, light: LIGHT.cold, cell: 4, sill: false, casing: 0, sashColor: '#c8ced2', glass: 'glass_cold' });
  sides[2].push({ kind: 'door', u: 3.0, y: fy, w: 0.95, h: 2.1, style: 'steel', color: '#d8dcde', light: LIGHT.off, id: 'service', casing: 0 });
  walls(ctx, {
    W, D, y0: fy - 0.02, y1: fy + H, key: 'sheet_metal', color: white, trim: '#d8dde0', sides, thick: 0.25, corner: 0.0, bands: false,
    recess: 0.05, casing: 0, grime: 0.03, glass: 'glass_cold',
    inner: ctx.wantInterior ? { key: 'plaster', color: '#f2f4f4', trim: '#d8dcde', y0: fy, y1: fy + 3.4 } : null,
  });
  // panel seams + black kick band + aluminium edge trims
  for (let s = 0; s < 4; s++) {
    const len = sideFrame(b, s, W, D);
    for (let u = 1.2; u < len - 0.2; u += 1.2) b.boxMinMax('sheet_metal', u - 0.008, fy + 0.4, 0.0, u + 0.008, fy + H, 0.006, { color: '#c8ced2' });
    b.boxMinMax('sheet_metal', -0.02, fy - 0.1, 0.0, len + 0.02, fy + 0.25, 0.03, { color: '#26282a' });
    b.boxMinMax('chrome', -0.03, fy + H - 0.08, 0, len + 0.03, fy + H + 0.6, 0.05, { color: '#d8dde0' });
    b.pop();
  }
  roofFlat(ctx, { W, D, y: fy + H, parapet: 0.6, key: 'sheet_metal', color: white, capColor: '#d8dde0', deckColor: '#8a8e90' });
  // rooftop HVAC + antennas + a satellite uplink dish
  b.box('sheet_metal', -4, fy + H, -2, 2.2, 1.1, 1.6, { color: '#d8dcde' });
  b.box('sheet_metal', 3, fy + H, -3, 1.6, 0.9, 1.4, { color: '#d8dcde' });
  for (const x of [-4.5, -3.5]) b.cyl('metal', x, fy + H + 1.1, -2, 0.35, 0.05, { segs: 12, color: '#5a5e60' });
  b.cylBetween('metal', [6.5, fy + H, -4.5], [6.5, fy + H + 3.5, -4.5], 0.03, { segs: 6, color: '#d8dcde' });
  b.at(6.0, fy + H, 3.6, PI * 0.8);
  addProp(b, 'satDish', { size: 1.1, mount: 'post' }, r);
  b.pop();

  // ---- LED canopy across the front, with a cyan edge strip and downlights
  const cz0 = D / 2, cd = 4.2, cy = fy + H - 0.3;
  b.box('sheet_metal', 0, cy, cz0 + cd / 2, W + 1.0, 1.0, cd, { color: white });
  b.box('neon', 0, cy + 0.015, cz0 + cd + 0.004, W + 1.0, 0.05, 0.01, { color: logoOn ? CYAN : [0.05, 0.1, 0.12] });
  b.box('neon', 0, cy + 0.965, cz0 + cd + 0.004, W + 1.0, 0.03, 0.01, { color: logoOn ? [0.6, 3.5, 4.5] : [0.05, 0.1, 0.12] });
  for (let i = 0; i < 7; i++) for (let j = 0; j < 2; j++) {
    b.box('neon', -W / 2 + 1.5 + i * ((W - 3) / 6), cy - 0.005, cz0 + 1.1 + j * 2.0, 0.6, 0.01, 0.6, { color: WHITE_LED });
  }
  for (const x of [-W / 2 + 0.6, W / 2 - 0.6]) b.cyl('sheet_metal', x, 0, cz0 + cd - 0.4, 0.14, cy, { segs: 12, color: '#e8eaec' });
  // the logo on the canopy fascia: NORTHSTAR 24 neon text + a star
  const logoKey = 'northstar_logo' + (logoOn ? '' : '_off');
  sign(ctx, logoKey, 0.9, cy + 0.5, cz0 + cd + 0.03, 10.0, 0.75, {
    kind: 'neon', glow: logoOn ? 5 : 0.25, ppm: 150,
    lines: [{ text: 'NORTHSTAR 24', size: 0.78, color: '#7ff4ff', font: '"Arial Black", "Helvetica Neue", Arial, sans-serif', weight: '900', spacing: 0.12, glowColor: '#40e0ff', glowBlur: 0.25 }],
  });
  const star = starPts(-4.9, cy + 0.5, 0.36, 0.15);
  b.poly('neon', star.map(([x, y]) => [x, y, cz0 + cd + 0.035]), { color: logoOn ? [3, 9, 12] : [0.05, 0.1, 0.12], want: [0, 0, 1] });
  // big wall logo on the side facing the street (+X) and a "24" lightbox on the left
  sideFrame(b, 1, W, D);
  sign(ctx, logoKey + '_side', D * 0.55, fy + H - 0.75, 0.06, 6.0, 0.6, {
    kind: 'neon', glow: logoOn ? 6 : 0.25, ppm: 140,
    lines: [{ text: 'NORTHSTAR 24', size: 0.75, color: '#7ff4ff', font: '"Arial Black", Arial, sans-serif', weight: '900', spacing: 0.1, glowColor: '#40e0ff', glowBlur: 0.25 }],
  });
  b.pop();
  sideFrame(b, 3, W, D);
  b.push().translate(D * 0.4, fy + H - 1.1, 0.12);
  const s2 = starPts(0, 0, 0.7, 0.28);
  b.poly('neon', s2.map(([x, y]) => [x, y, 0]), { color: logoOn ? [2.5, 8, 10] : [0.05, 0.1, 0.12], want: [0, 0, 1] });
  b.pop();
  b.pop();
  // promo screen by the door
  b.push().translate(W / 2 - 6.5, 0, D / 2 + 0.35);
  b.box('sheet_metal', 0, 0, 0, 1.0, 0.12, 0.4, { color: '#3a3d40' });
  b.box('sheet_metal', 0, 0.12, 0, 0.12, 1.2, 0.12, { color: '#3a3d40' });
  b.box('sheet_metal', 0, 1.3, 0, 1.1, 1.8, 0.1, { color: '#1a1c1e' });
  b.box('neon', 0, 1.35, 0.052, 1.0, 1.7, 0.005, { color: [1.0, 3.2, 4.2] });
  b.pop();

  // ---- forecourt: clean apron, parking lines, bollards, ice, ATM, bench, bin
  b.box('concrete', 0, -0.02, D / 2 + 2.2, W + 2.5, fy + 0.02, 4.4, { color: '#c8c8c4' });
  ctx.floor(0, D / 2 + 2.2, W + 2.5, 4.4, fy);
  b.box('asphalt', 0, -0.03, D / 2 + 7.2, W + 4, 0.03, 5.6, { color: '#6a6a6a', noSnow: false });
  for (let i = 0; i < 7; i++) b.box('paint', -W / 2 + 1.0 + i * 2.8, 0.005, D / 2 + 7.2, 0.12, 0.01, 4.8, { color: '#f0f0f0' });
  b.box('paint', -W / 2 + 1.0 + 2.8 * 3 + 1.4, 0.006, D / 2 + 7.2, 1.0, 0.012, 1.0, { color: '#2a5aa8' });
  for (let i = 0; i < 9; i++) {
    const x = -W / 2 + 1.0 + i * 2.0;
    if (Math.abs(x) < 1.6) continue;
    b.cyl('chrome', x, 0, D / 2 + 4.25, 0.1, 0.95, { segs: 12, color: '#d8dde0' });
    b.cyl('neon', x, 0.8, D / 2 + 4.25, 0.102, 0.03, { segs: 12, color: logoOn ? [0.8, 4, 5] : [0.05, 0.05, 0.05], caps: '' });
  }
  b.at(-W / 2 + 1.3, fy, D / 2 + 1.0, 0);
  b.box('sheet_metal', 0, 0, 0, 1.6, 1.1, 0.8, { color: '#e8eef4' });
  sign(ctx, 'ns_ice', 0, 0.6, 0.41, 1.2, 0.4, { kind: 'lightbox', ppm: 140, bg: '#e8f8ff', lines: [{ text: 'ICE', size: 0.8, color: '#0a6a9a', font: 'Arial Black, Arial, sans-serif', weight: 'bold' }], dayEmissive: 0.6, nightEmissive: 1.6 });
  b.pop();
  b.at(W / 2 - 1.2, fy, D / 2 + 0.6, 0);
  b.box('sheet_metal', 0, 0, 0, 0.8, 1.7, 0.7, { color: '#2a2d30' });
  b.box('neon', 0, 1.15, 0.352, 0.4, 0.3, 0.004, { color: [1, 3, 4] });
  b.box('sheet_metal', 0, 0.95, 0.38, 0.5, 0.06, 0.1, { color: '#1a1c1e' });
  b.pop();
  ctx.point('atm', W / 2 - 1.2, fy, D / 2 + 1.4, PI);
  b.at(-3.5, fy, D / 2 + 3.0, 0);
  b.box('chrome', 0, 0, 0, 1.6, 0.42, 0.45, { color: '#c8cdd0' });
  b.box('wood_dark', 0, 0.42, 0, 1.6, 0.05, 0.45, { color: '#c8a070' });
  b.pop();
  b.at(3.6, fy, D / 2 + 3.2, 0);
  b.cyl('sheet_metal', 0, 0, 0, 0.3, 0.95, { segs: 14, color: '#e8eaec' });
  b.cyl('sheet_metal', 0, 0.95, 0, 0.32, 0.12, { segs: 14, color: '#2a2d30' });
  b.pop();
  // propane exchange cage at the side
  b.at(W / 2 + 0.75, 0, -1.5, -HALF_PI);
  b.box('chainlink', 0, 0, 0, 2.0, 1.6, 0.8, { color: '#ffffff' });
  addProp(b, 'propane', { count: 4 }, r);
  b.pop();
  // dumpster enclosure at the back (spotless)
  b.at(-W / 2 + 3, 0, -D / 2 - 2.2, PI);
  addProp(b, 'dumpster', { color: '#3a3d40' }, r);
  b.pop();

  // ---- the cameras: corners, doors, canopy, rooftop PTZ, two pole cams
  const camY = fy + H - 0.2;
  secCam(ctx, -W / 2 - 0.05, camY, D / 2 + 0.05, -PI * 0.25 + PI, { dome: false, pitch: -0.45 });
  secCam(ctx, W / 2 + 0.05, camY, D / 2 + 0.05, PI * 0.25, { pitch: -0.45 });
  secCam(ctx, -W / 2 - 0.05, camY, -D / 2 - 0.05, -PI * 0.75 + PI * 0, { pitch: -0.45 });
  secCam(ctx, W / 2 + 0.05, camY, -D / 2 - 0.05, PI * 0.75, { pitch: -0.45 });
  secCam(ctx, -1.6, cy - 0.02, D / 2 + 0.6, 0, { dome: true, pitch: -0.7 });
  secCam(ctx, 1.6, cy - 0.02, D / 2 + 0.6, 0, { dome: true, pitch: -0.7 });
  secCam(ctx, -6, cy - 0.02, D / 2 + 3.4, 0.3, { dome: true, pitch: -0.6 });
  secCam(ctx, 6, cy - 0.02, D / 2 + 3.4, -0.3, { dome: true, pitch: -0.6 });
  secCam(ctx, 3.0, fy + 2.6, -D / 2 - 0.05, PI, { pitch: -0.6 });
  // rooftop PTZ on a mast
  b.cylBetween('sheet_metal', [-W / 2 + 1, fy + H, D / 2 - 1], [-W / 2 + 1, fy + H + 2.2, D / 2 - 1], 0.05, { segs: 8, color: '#e8eaec' });
  secCam(ctx, -W / 2 + 1, fy + H + 2.1, D / 2 - 1, PI * 0.15, { dome: true, range: 45, fov: 60, pitch: -0.25 });
  // pole cameras in the lot (on NORTHSTAR smart lights)
  for (const sx of [-1, 1]) {
    b.at(sx * (W / 2 + 0.5), 0, D / 2 + 9.6, PI);
    const out = addProp(b, 'smartLight', {}, r);
    b.pop();
    for (const l of out.lights) ctx.lights.push(l);
    for (const c of out.cameras) ctx.cameras.push(c);
  }
  // sodium-free: the canopy throws cold light down
  ctx.light(-4, cy - 0.4, D / 2 + 2.0, 0xe0f4ff, 2.6, 12);
  ctx.light(4, cy - 0.4, D / 2 + 2.0, 0xe0f4ff, 2.6, 12);
  ctx.light(0, fy + 2.5, D / 2 - 2, 0xe8f6ff, 2.0, 10);

  if (!ctx.wantInterior) ctx.col(0, 0, W, D, fy + H);
  ctx.doors.push({ id: 'front', x: 0, z: D / 2 + 0.1, rot: 0, w: 2.4, leadsTo: ctx.wantInterior ? 'interior' : 'exterior' });
  ctx.doors.push({ id: 'service', x: W / 2 - 3.0, z: -D / 2 - 0.1, rot: PI, w: 0.95, leadsTo: ctx.wantInterior ? 'interior' : 'exterior' });
  ctx.point('door', 0, fy, D / 2 + 2.0, PI);
  ctx.point('parking', 0, 0, D / 2 + 7.2, PI);
  ctx.point('promoScreen', W / 2 - 6.5, fy, D / 2 + 1.4, PI);
  if (ctx.wantInterior) interior(ctx, { W, D, fy });
  return finish(ctx);
}

function interior(ctx, { W, D, fy }) {
  const b = ctx.b, r = ctx.rng;
  const iw = W - 0.5, id = D - 0.5, ch = 3.4;
  floor(ctx, 0, 0, iw, id, fy, 'concrete', '#d8dcdc');
  ceiling(ctx, 0, 0, iw, id, fy + ch, 'plaster', '#f4f6f6');
  // LED troffers
  for (let i = 0; i < 5; i++) for (let j = 0; j < 3; j++) b.box('i:neon', -6 + i * 3, fy + ch - 0.02, -3.2 + j * 3.2, 1.2, 0.02, 0.6, { color: [2.6, 2.8, 3.0] });
  // back room partition (z = -D/2 + 3.2) with a door
  const pz = -D / 2 + 3.4;
  partition(ctx, -iw / 2, pz, iw / 2, pz, fy, ch, { doors: [{ at: iw - 2.8, w: 0.95 }], color: '#eef0f0', trim: '#d8dcde' });
  // coolers along the back wall of the shop, coffee bar on the left wall
  cooler(ctx, -2.0, fy, pz + 0.45, 0, { w: 9.0, color: '#f0f2f4', glow: [6, 6.6, 7] });
  ctx.point('coolers', -2.0, fy, pz + 1.6, PI);
  b.push().translate(-iw / 2 + 0.45, fy, -0.5).rotateY(HALF_PI);
  b.box('i:sheet_metal', 0, 0, 0, 3.0, 0.92, 0.7, { color: '#2a2d30' });
  b.box('i:stone', 0, 0.92, 0, 3.05, 0.04, 0.74, { color: '#e8e8e6' });
  for (let i = 0; i < 3; i++) {
    b.box('i:sheet_metal', -1.0 + i * 0.75, 0.96, -0.1, 0.4, 0.55, 0.4, { color: '#1a1c1e' });
    b.box('i:neon', -1.0 + i * 0.75, 1.32, 0.105, 0.16, 0.08, 0.004, { color: [0.6, 3.0, 4.0] });
  }
  b.box('i:neon', 0, 2.2, -0.33, 2.6, 0.5, 0.01, { color: [1.0, 3.0, 3.8] });
  b.pop();
  ctx.colLocal(-iw / 2 + 0.45, -0.5, 0.75, 3.0, 1.0);
  ctx.point('coffee', -iw / 2 + 1.4, fy, -0.5, -HALF_PI);
  // three double aisles of white shelving
  const aisles = [-3.6, 0.0, 3.6];
  aisles.forEach((x, i) => {
    shelf(ctx, x, fy, 0.6, HALF_PI, { w: 5.4, h: 1.7, d: 0.42, levels: 5, double: true, key: 'sheet_metal', color: '#f4f6f8', palette: ['#c81a2a', '#1a6ad8', '#f0f0f0', '#2aa84a', '#f0b020', '#7a2ad8', '#1a1a1a'], sparse: 0.02 });
    ctx.point('aisle' + (i + 1), x + 1.0, fy, 0.6, 0);
    // aisle header sign
    b.box('i:neon', x, fy + 2.5, 0.6, 1.2, 0.3, 0.04, { color: [1.2, 4, 5] });
  });
  // register counter by the door with a POS + acrylic shield + gum rack
  counter(ctx, iw / 2 - 2.2, fy, D / 2 - 2.6, PI, { w: 3.2, register: 'pos', key: 'sheet_metal', color: '#f0f2f4', top: '#d8dcde', topKey: 'stone', panels: false });
  b.box('i:glass_clear', iw / 2 - 2.6, fy + 0.95, D / 2 - 2.9, 1.0, 0.7, 0.02, { color: '#ffffff' });
  shelf(ctx, iw / 2 - 2.2, fy, D / 2 - 4.0, 0, { w: 2.8, h: 2.2, d: 0.35, levels: 6, key: 'sheet_metal', color: '#2a2d30', palette: ['#e8c020', '#c81a2a', '#f0f0f0', '#1a6ad8'], sparse: 0.0 });
  ctx.point('register', iw / 2 - 2.2, fy, D / 2 - 1.8, PI);
  ctx.point('clerk', iw / 2 - 2.2, fy, D / 2 - 3.3, 0);
  flatScreen(ctx, iw / 2 - 0.05, fy + 2.4, D / 2 - 3.5, -HALF_PI, { w: 1.2, h: 0.7, stand: false, screen: [0.6, 2.6, 3.2] });
  // back room: CCTV wall, desk, chair, racks of stock
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) flatScreen(ctx, -iw / 2 + 1.3 + i * 0.85, fy + 1.3 + j * 0.52, -D / 2 + 0.3, 0, { w: 0.78, h: 0.46, stand: false, screen: [0.4 + r() * 0.3, 1.2 + r() * 0.6, 1.2 + r() * 0.4] });
  desk(ctx, -iw / 2 + 2.1, fy, -D / 2 + 1.2, 0, { w: 2.4, key: 'sheet_metal', color: '#d8dcde' });
  chair(ctx, -iw / 2 + 2.1, fy, -D / 2 + 1.9, PI, { folding: true, color: '#1a1a1a' });
  ctx.point('monitors', -iw / 2 + 2.1, fy, -D / 2 + 2.0, PI);
  ctx.point('office', -iw / 2 + 2.1, fy, -D / 2 + 1.7, PI);
  filingCabinet(ctx, -iw / 2 + 4.0, fy, -D / 2 + 0.5, 0, { color: '#d8dcde' });
  for (let i = 0; i < 3; i++) shelf(ctx, 1.5 + i * 2.2, fy, -D / 2 + 0.6, 0, { w: 2.0, h: 2.2, d: 0.6, levels: 4, key: 'sheet_metal', color: '#8a8e90', palette: ['#c8a070', '#b89060', '#d8b080'], sparse: 0.1 });
  ctx.point('storage', 3.7, fy, -D / 2 + 2.0, PI);
  ctx.point('backroom', 1.0, fy, -D / 2 + 2.2, 0);
  ctx.light(-2, fy + 3.0, 1.5, 0xf0f8ff, 1.4, 12);
  ctx.light(4, fy + 3.0, 1.5, 0xf0f8ff, 1.3, 12);
  ctx.light(-3, fy + 3.0, -D / 2 + 1.6, 0xd8ecff, 1.2, 6);
  wallColliders(ctx, W, D, 0, 0, [{ side: 0, u: W / 2, w: 2.4 }, { side: 2, u: 3.0, w: 0.95 }], 4.6);
  ctx.point('door_in', 0, fy, D / 2 - 1.0, PI);
  ctx.doors.push({ id: 'front_in', x: 0, z: D / 2 - 0.6, rot: PI, w: 2.4, leadsTo: 'exterior' });
  void tubeLight; void getSignMaterial; void rgb; void weather; void steps;
}
