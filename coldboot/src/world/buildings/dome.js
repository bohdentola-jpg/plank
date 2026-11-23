// The Dome: a Cold War radar station on Kettle Hill, now Northstar Dynamics.
// A big geodesic radome on a cylindrical tower, the old ops building with a
// sleek new glass entrance pavilion, barracks, satellite dishes, a helipad, a
// perimeter fence with barbed wire, a guard post with a boom barrier,
// floodlights and cameras everywhere. Interior: the gala hall (chandeliers,
// tables, stage, bar), the server room (rack rows) and the vault (round door,
// the drive on a pedestal).
import * as THREE from 'three';
import { makeCtx, finish, walls, roofFlat, roofGable, sign, sideFrame, steps, porchLight, weather, rgb, LIGHT, PI, HALF_PI, windowCond } from './common.js';
import { addProp } from '../props.js';
import { secCam } from './cornerStore.js';
import { latticeMast } from './radioStation.js';
import {
  floor, ceiling, partition, wallColliders, table, chair, counter, serverRack, flatScreen, wallPicture, rug, shelf,
} from './furniture.js';

const CYAN = [1.2, 7.5, 9.5];

export function build(opts = {}) {
  const ctx = makeCtx('dome', opts);
  const b = ctx.b, r = ctx.rng, st = ctx.state, wear = ctx.wear;
  ctx.footprint = { w: 96, d: 80 };
  const white = '#e8eaec', panel = '#d8dcde';
  // ---- radome on its tower (centre-back)
  const tx = 8, tz = -14, TR = 8, TH = 7;
  b.cyl('sheet_metal', tx, 0, tz, TR, TH, { segs: 24, smooth: false, color: panel, caps: '' });
  for (let k = 0; k < 24; k += 2) {
    const a = (k / 24) * PI * 2;
    b.box('sheet_metal', tx + Math.sin(a) * (TR + 0.02), 0, tz + Math.cos(a) * (TR + 0.02), 0.12, TH, 0.04, { color: '#b8bcbe', ry: a });
  }
  b.cyl('sheet_metal', tx, TH - 0.1, tz, TR + 0.25, 0.4, { segs: 24, color: '#c8ccce' });
  // geodesic sphere: flat facets with per-panel shading
  const geo = new THREE.IcosahedronGeometry(9.6, 3);
  geo.computeVertexNormals();
  const pos = geo.attributes.position;
  const keep = [], nrm = [], cols = [];
  const cy = TH + 5.3;
  for (let i = 0; i < pos.count; i += 3) {
    const y0 = Math.min(pos.getY(i), pos.getY(i + 1), pos.getY(i + 2));
    if (y0 + cy < TH - 0.3) continue;
    const ax = pos.getX(i), ay = pos.getY(i), az = pos.getZ(i);
    const bx = pos.getX(i + 1), by = pos.getY(i + 1), bz = pos.getZ(i + 1);
    const cx2 = pos.getX(i + 2), cy2 = pos.getY(i + 2), cz2 = pos.getZ(i + 2);
    const ux = bx - ax, uy = by - ay, uz = bz - az, vx = cx2 - ax, vy = cy2 - ay, vz = cz2 - az;
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const l = Math.hypot(nx, ny, nz); nx /= l; ny /= l; nz /= l;
    // outward facing (and wound to match)
    const mx = ax + bx + cx2, my = ay + by + cy2, mz = az + bz + cz2;
    let flip = nx * mx + ny * my + nz * mz < 0;
    if (flip) { nx = -nx; ny = -ny; nz = -nz; }
    const k = 0.9 + r() * 0.1 - (wear > 0.5 ? r() * 0.12 : 0);
    const tri = flip ? [[ax, ay, az], [cx2, cy2, cz2], [bx, by, bz]] : [[ax, ay, az], [bx, by, bz], [cx2, cy2, cz2]];
    for (const [x, y, z] of tri) {
      keep.push(x, y, z); nrm.push(nx, ny, nz); cols.push(k, k, k * 1.01);
    }
  }
  b.push().translate(tx, cy, tz);
  b.mesh('paint', keep, nrm, null, null, { colors: cols.map((v) => v * 0.92) });
  b.pop();
  geo.dispose();
  b.sphere('neon_blink', tx, cy + 9.7, tz, 0.15, { color: [9, 0.3, 0.15], rings: 4, segs: 8 });
  ctx.light(tx, cy + 9.8, tz, 0xff2010, 1.2, 14);
  ctx.col(tx, tz, TR * 2, TR * 2, cy + 9);
  ctx.point('domeBase', tx, 0, tz + TR + 1.5, PI);
  // ---- ops building (old, flat roof) west of the tower, with the gala hall inside
  const OW = 34, OD = 13, ox = -14, oz = -6, OH = 5.2, ofy = 0.3;
  const os = [[], [], [], []];
  for (let u = 3; u < OW - 2; u += 3.4) if (Math.abs(u - OW * 0.62) > 4.2) os[0].push({ kind: 'win', u, y: ofy + 1.3, w: 1.6, h: 1.8, style: 'grid', gx: 2, gy: 2, light: st > 0.1 ? [1.0, 0.86, 0.62] : LIGHT.off, cell: 7, cond: windowCond(ctx) });
  for (let u = 3; u < OW - 2; u += 3.4) os[2].push({ kind: 'win', u, y: ofy + 1.6, w: 1.2, h: 0.9, style: 'slider', light: LIGHT.off, cell: 7 });
  os[0].push({ kind: 'door', u: OW * 0.62, y: ofy, w: 2.0, h: 2.6, style: 'store2', frame: '#2a2d30', id: 'gala', glass: 'glass_cold', light: LIGHT.cold, cell: 7, leaf: ctx.wantInterior ? 'leaf_front' : null });
  os[3].push({ kind: 'door', u: OD * 0.5, y: ofy, w: 0.95, style: 'steel', color: '#7a7e80', id: 'service' });
  walls(ctx, { W: OW, D: OD, cx: ox, cz: oz, y0: ofy - 0.05, y1: ofy + OH, key: 'metal_corr_paint', color: weather(panel, wear * 0.5), trim: '#9aa0a4', sides: os, thick: 0.3, corner: 0.15, bands: false,
    inner: ctx.wantInterior ? { key: 'plaster', color: '#1c1e24', trim: '#2a2d30', y0: ofy, y1: ofy + OH - 0.6 } : null });
  roofFlat(ctx, { W: OW, D: OD, cx: ox, cz: oz, y: ofy + OH, parapet: 0.5, key: 'sheet_metal', color: panel, capColor: '#9aa0a4' });
  b.box('concrete', ox, -0.2, oz, OW + 0.2, ofy + 0.2, OD + 0.2, { color: '#8a8a86', skip: 't' });
  if (!ctx.wantInterior) ctx.col(ox, oz, OW, OD, ofy + OH);
  // the Northstar glass pavilion in front of the gala door
  const px = ox - OW / 2 + OW * 0.62, pz = oz + OD / 2 + 3.2;
  const PW = 9, PD = 6, PH = 4.2;
  for (const [x0, z0, x1, z1] of [[-PW / 2, PD / 2, PW / 2, PD / 2], [-PW / 2, -PD / 2, -PW / 2, PD / 2], [PW / 2, -PD / 2, PW / 2, PD / 2]]) {
    const len = Math.hypot(x1 - x0, z1 - z0), n = Math.round(len / 1.5);
    for (let i = 0; i <= n; i++) {
      const t = i / n, x = px + x0 + (x1 - x0) * t, z = pz + z0 + (z1 - z0) * t;
      b.box('metal', x, ofy, z, 0.1, PH, 0.1, { color: '#1a1c1e' });
    }
    if (z0 === z1) {
      b.poly('glass_cold', [[px + x0, ofy, pz + z0], [px + x1, ofy, pz + z1], [px + x1, ofy + PH, pz + z1], [px + x0, ofy + PH, pz + z0]], { color: [0.55, 0.75, 0.85], uv: [[0, 0], [0.25, 0], [0.25, 0.5], [0, 0.5]], want: [0, 0, 1] });
    } else {
      const sx = x0 < 0 ? -1 : 1;
      b.poly('glass_cold', [[px + x0, ofy, pz + z0], [px + x1, ofy, pz + z1], [px + x1, ofy + PH, pz + z1], [px + x0, ofy + PH, pz + z0]], { color: [0.55, 0.75, 0.85], uv: [[0, 0], [0.25, 0], [0.25, 0.5], [0, 0.5]], want: [sx, 0, 0] });
    }
  }
  b.box('sheet_metal', px, ofy + PH, pz + 0.6, PW + 2.4, 0.4, PD + 3.2, { color: '#1a1c1e' });
  b.box('neon', px, ofy + PH - 0.005, pz + 0.6, PW + 2.2, 0.01, 0.06, { color: CYAN });
  b.box('concrete', px, -0.2, pz + 1.0, PW + 3, ofy + 0.2, PD + 4, { color: '#c8c8c4' });
  ctx.floor(px, pz + 1.0, PW + 3, PD + 4, ofy);
  // sliding doors in the pavilion front (lit)
  b.poly('neon', [[px - 1.1, ofy, pz + PD / 2 + 0.02], [px + 1.1, ofy, pz + PD / 2 + 0.02], [px + 1.1, ofy + 2.4, pz + PD / 2 + 0.02], [px - 1.1, ofy + 2.4, pz + PD / 2 + 0.02]], { color: [1.4, 2.2, 2.6], want: [0, 0, 1] });
  sign(ctx, 'northstar_dyn', px, ofy + PH + 0.2, pz + PD / 2 + 2.21, 8.0, 0.5, {
    kind: 'neon', glow: 4.5, ppm: 150,
    lines: [{ text: (ctx.name || 'NORTHSTAR DYNAMICS').toUpperCase(), size: 0.7, color: '#d8f8ff', font: '"Arial Black", Arial, sans-serif', weight: '900', spacing: 0.15, glowColor: '#40e0ff', glowBlur: 0.2 }],
  });
  ctx.light(px, ofy + PH - 0.5, pz + 2, 0xd8f0ff, 2.4, 12);
  ctx.doors.push({ id: 'entrance', x: px, z: pz + PD / 2 + 0.1, rot: 0, w: 2.2, leadsTo: ctx.wantInterior ? 'interior' : 'exterior' });
  ctx.point('entrance', px, ofy, pz + PD / 2 + 2.5, PI);
  // ---- barracks (east of the tower)
  const BW = 24, BD = 9, bx = 26, bz = 4;
  const bs = [[], [], [], []];
  for (let u = 2.5; u < BW - 1; u += 3.2) bs[0].push({ kind: 'win', u, y: 1.3, w: 1.1, h: 1.1, style: 'slider', light: st > 0.2 && (u | 0) % 2 ? LIGHT.office : LIGHT.off, cell: 7, cond: windowCond(ctx) });
  bs[3].push({ kind: 'door', u: BD / 2, y: 0.4, w: 0.95, style: 'steel', color: '#7a7e80', id: 'barracks' });
  walls(ctx, { W: BW, D: BD, cx: bx, cz: bz, y0: 0.35, y1: 3.6, key: 'metal_corr_paint', color: weather('#c8c0a8', wear * 0.6), trim: '#8a8e90', sides: bs, gable: { axis: 'x', yRidge: 3.6 + (BD / 2) * 0.3 }, thick: 0.2, corner: 0.12, bands: false });
  roofGable(ctx, { W: BW, D: BD, cx: bx, cz: bz, yEave: 3.6, pitch: 0.3, axis: 'x', eave: 0.5, rake: 0.3, key: 'metal_corr', color: '#ffffff', trim: '#8a8e90', icicles: 0.3 });
  b.box('concrete', bx, -0.2, bz, BW, 0.6, BD, { color: '#8a8a86', skip: 't' });
  ctx.col(bx, bz, BW, BD, 3.6);
  // ---- dishes, mast, helipad
  for (const [x, z, s] of [[-32, -26, 6.0], [-20, -28, 4.5]]) {
    b.at(x, 0, z, PI * 0.85); addProp(b, 'satDish', { size: s, mount: 'post' }, r); b.pop();
  }
  latticeMast(ctx, 28, -16, 24, { red: '#c8281e' });
  const hpx = 30, hpz = 24;
  b.cyl('concrete', hpx, -0.05, hpz, 9, 0.12, { segs: 28, color: '#8a8e90' });
  b.push().translate(hpx, 0.075, hpz);
  b.lathe('paint', 0, 0, 0, [[7.6, 0], [8.0, 0]], { segs: 28, color: '#f0f0ea' });
  for (const sx of [-1, 1]) b.box('paint', sx * 1.4, 0.0, 0, 0.6, 0.01, 4.4, { color: '#f0f0ea' });
  b.box('paint', 0, 0.0, 0, 2.2, 0.01, 0.6, { color: '#f0f0ea' });
  for (let i = 0; i < 12; i++) { const a = (i / 12) * PI * 2; b.cyl('neon', Math.cos(a) * 8.5, 0, Math.sin(a) * 8.5, 0.1, 0.12, { segs: 6, color: [0.4, 3.5, 1.2] }); }
  b.pop();
  ctx.floor(hpx, hpz, 16, 16, 0.07);
  ctx.point('helipad', hpx, 0.07, hpz, PI);
  // ---- perimeter fence with barbed wire, gate + guard post at the front
  const FW = 92, FD = 76, fz0 = 34;
  fenceLine(ctx, -FW / 2, fz0, -6, fz0, r);
  fenceLine(ctx, 6, fz0, FW / 2, fz0, r);
  fenceLine(ctx, FW / 2, fz0, FW / 2, fz0 - FD, r);
  fenceLine(ctx, FW / 2, fz0 - FD, -FW / 2, fz0 - FD, r);
  fenceLine(ctx, -FW / 2, fz0 - FD, -FW / 2, fz0, r);
  ctx.col(-FW / 4 - 3, fz0, FW / 2 - 6, 0.25, 2.6);
  ctx.col(FW / 4 + 3, fz0, FW / 2 - 6, 0.25, 2.6);
  ctx.col(FW / 2, fz0 - FD / 2, 0.25, FD, 2.6);
  ctx.col(0, fz0 - FD, FW, 0.25, 2.6);
  ctx.col(-FW / 2, fz0 - FD / 2, 0.25, FD, 2.6);
  // guard booth + barrier arm + sign
  const gx = 8.5, gz = fz0 - 1.5;
  walls(ctx, { W: 2.6, D: 2.6, cx: gx, cz: gz, y0: 0.2, y1: 2.7, key: 'sheet_metal', color: white, trim: '#2a2d30', thick: 0.1, corner: 0.05, bands: false,
    sides: [0, 1, 2, 3].map((s) => [{ kind: 'win', u: 1.3, y: 1.1, w: 1.8, h: 1.2, style: 'fixed', light: LIGHT.cold, cell: 7, glass: 'glass_cold', sill: false, casing: 0 }]).map((a, s) => (s === 3 ? [...a.map((o) => ({ ...o, u: 1.8, w: 0.9 })), { kind: 'door', u: 0.6, y: 0.2, w: 0.8, h: 2.05, style: 'steel', color: '#2a2d30', id: 'guard' }] : a)) });
  b.box('sheet_metal', gx, 2.7, gz, 3.4, 0.3, 3.4, { color: '#1a1c1e' });
  b.box('neon', gx, 2.69, gz, 3.0, 0.01, 0.05, { color: CYAN });
  b.box('concrete', gx, -0.1, gz, 3.0, 0.3, 3.0, { color: '#a8a8a4' });
  ctx.col(gx, gz, 2.6, 2.6, 3);
  b.box('sheet_metal', 6.2, 0, fz0, 0.4, 1.1, 0.4, { color: '#e8e8e4' });
  b.push().translate(6.2, 0.95, fz0).rotateZ(0.0);
  for (let i = 0; i < 8; i++) b.box('paint', -0.4 - i * 0.75, 0, 0, 0.75, 0.1, 0.1, { color: i % 2 ? '#f0f0ea' : '#c81a1a' });
  b.pop();
  ctx.point('barrier', 2, 0, fz0 + 1.5, PI);
  ctx.point('guard', gx - 1.6, 0.2, gz, HALF_PI);
  ctx.point('gate', 0, 0, fz0 + 4, PI);
  ctx.doors.push({ id: 'gate', x: 0, z: fz0, rot: 0, w: 12, leadsTo: 'exterior' });
  b.push().translate(-9, 0, fz0 + 0.3);
  for (const sx of [-1.3, 1.3]) b.box('metal', sx, 0, 0, 0.1, 2.6, 0.1, { color: '#2a2d30' });
  sign(ctx, 'dome_gate_sign', 0, 1.9, 0.06, 3.0, 1.2, {
    kind: 'lightbox', ppm: 120, bg: '#0e1418', dayEmissive: 0.6, nightEmissive: 1.6,
    lines: [{ text: 'NORTHSTAR DYNAMICS', size: 0.2, y: 0.22, color: '#7ff4ff', font: 'Arial Black, Arial, sans-serif', weight: '900', spacing: 0.1 }, { text: 'KETTLE HILL FACILITY', size: 0.12, y: 0.42, color: '#d8e8f0', font: 'Arial, sans-serif' }, { text: 'AUTHORIZED PERSONNEL ONLY', size: 0.13, y: 0.66, color: '#ff6050', font: 'Arial, sans-serif', weight: 'bold' }, { text: 'ALL ACTIVITY IS RECORDED', size: 0.11, y: 0.84, color: '#d8e8f0', font: 'Arial, sans-serif' }],
  }, { back: true, board: '#1a1c1e' });
  b.pop();
  // floodlight + camera poles around the compound
  for (const [x, z, yaw] of [[-40, 30, 0.6], [40, 30, -0.6], [-40, -38, 2.4], [40, -38, -2.4], [12, 30, 0.1], [-20, 4, 0.2]]) {
    b.cyl('galv', x, 0, z, 0.1, 9, { segs: 8, color: '#a8aeb0' });
    b.push().translate(x, 8.8, z).rotateY(yaw);
    b.box('metal', 0, 0, 0.2, 0.7, 0.4, 0.3, { color: '#2a2d30', rx: 0.5 });
    b.box('neon', 0, -0.05, 0.37, 0.6, 0.3, 0.01, { color: [7, 7.5, 8], rx: 0.5 });
    b.pop();
    ctx.light(x + Math.sin(yaw) * 2, 8.0, z + Math.cos(yaw) * 2, 0xe8f4ff, 3.0, 30);
    secCam(ctx, x, 7.6, z, yaw, { dome: true, range: 35, pitch: -0.35 });
  }
  secCam(ctx, px - PW / 2 - 1.2, ofy + PH, pz + PD / 2 + 2.0, -0.3, { pitch: -0.6 });
  secCam(ctx, px + PW / 2 + 1.2, ofy + PH, pz + PD / 2 + 2.0, 0.3, { pitch: -0.6 });
  secCam(ctx, gx + 1.3, 2.6, gz + 1.3, 0.2, { pitch: -0.5 });
  // apron / road surface inside the gate
  b.box('asphalt', 0, -0.03, 14, 14, 0.04, 40, { color: '#6a6a6a' });
  ctx.point('road', 0, 0, 20, PI);
  if (ctx.wantInterior) interior(ctx, { ox, oz, OW, OD, OH, ofy, pz, PD });
  return finish(ctx);
}

function fenceLine(ctx, x0, z0, x1, z1, r) {
  const b = ctx.b;
  const len = Math.hypot(x1 - x0, z1 - z0), n = Math.max(1, Math.round(len / 3.2));
  const rot = Math.atan2(-(z1 - z0), x1 - x0);
  for (let i = 0; i < n; i++) {
    b.push().translate(x0 + ((x1 - x0) * i) / n, 0, z0 + ((z1 - z0) * i) / n).rotateY(rot);
    addProp(b, 'fenceChain', { len: len / n, h: 2.4, barbed: true, end: i === n - 1 }, r);
    b.pop();
  }
}

function interior(ctx, { ox, oz, OW, OD, OH, ofy, pz, PD }) {
  const b = ctx.b, r = ctx.rng;
  const x0 = ox - OW / 2 + 0.3, x1 = ox + OW / 2 - 0.3, z0 = oz - OD / 2 + 0.3, z1 = oz + OD / 2 - 0.3;
  const ch = OH - 0.6;
  // pavilion lobby floor
  floor(ctx, ox - OW / 2 + OW * 0.62, pz, 8.6, PD - 0.4, ofy, 'tile', '#e8ecee');
  ceiling(ctx, ox - OW / 2 + OW * 0.62, pz, 8.6, PD - 0.4, ofy + 4.0, 'plaster', '#f0f2f4');
  ctx.point('lobby', ox - OW / 2 + OW * 0.62, ofy, pz, PI);
  // gala hall: x from x0 to xs
  const xs = ox + 4.0;
  floor(ctx, (x0 + xs) / 2, oz, xs - x0, z1 - z0, ofy, 'floor_wood', '#5a3a28');
  ceiling(ctx, (x0 + xs) / 2, oz, xs - x0, z1 - z0, ofy + ch, 'plaster', '#14161c');
  partition(ctx, xs, z1, xs, z0, ofy, ch, { color: '#1c1e24', doors: [{ at: (z1 - z0) * 0.7, w: 1.2, leaf: true, color: '#2a2d30' }] });
  const gc = (x0 + xs) / 2;
  // chandeliers (crystal tiers) + tables
  for (const x of [gc - 6, gc, gc + 6]) {
    b.cylBetween('i:chrome', [x, ofy + ch, oz], [x, ofy + ch - 0.6, oz], 0.01, { segs: 4, color: '#d8dcdc' });
    for (const [rr, yy] of [[0.9, ch - 0.7], [0.6, ch - 0.95], [0.3, ch - 1.15]]) {
      b.cyl('i:chrome', x, ofy + yy, oz, rr, 0.04, { segs: 16, color: '#e8ecec', caps: '' });
      for (let k = 0; k < 10; k++) { const a = (k / 10) * PI * 2; b.sphere('i:neon', x + Math.cos(a) * rr, ofy + yy - 0.1, oz + Math.sin(a) * rr, 0.035, { rings: 2, segs: 4, color: [7, 6.6, 5.6] }); }
    }
    ctx.light(x, ofy + ch - 1.2, oz, 0xfff0d8, 2.4, 12);
  }
  for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) {
    const x = gc - 6 + i * 6, z = oz - 2.4 + j * 4.2;
    table(ctx, x, ofy, z, 0, { round: true, w: 1.6, key: 'solid', color: '#e8e4dc', cloth: null });
    b.cyl('i:fabric', x, ofy + 0.02, z, 0.86, 0.74, { segs: 16, color: '#f4f2ee' });
    b.cyl('i:glass_clear', x, ofy + 0.76, z, 0.06, 0.25, { segs: 8 });
    b.sphere('i:neon', x, ofy + 0.85, z, 0.05, { rings: 3, segs: 6, color: [6, 4, 2] });
    for (let k = 0; k < 6; k++) { const a = (k / 6) * PI * 2; chair(ctx, x + Math.cos(a) * 1.15, ofy, z + Math.sin(a) * 1.15, -a - HALF_PI, { color: '#d8c8a0', key: 'gold_dull' }); }
    ctx.point('table' + (i * 2 + j + 1), x, ofy, z + 1.4, PI);
  }
  // stage at the west end with the AURORA screen
  b.box('i:wood_dark', x0 + 1.6, ofy, oz, 3.2, 0.5, z1 - z0, { color: '#1a1a1e' });
  ctx.floor(x0 + 1.6, oz, 3.2, z1 - z0, ofy + 0.5);
  flatScreen(ctx, x0 + 0.1, ofy + 2.6, oz, HALF_PI, { w: 4.0, h: 2.2, stand: false, screen: [0.5, 2.6, 3.2] });
  wallPicture(ctx, 'aurora_logo', x0 + 0.16, ofy + 2.6, oz, HALF_PI, 3.6, 1.9, { kind: 'paint', draw: drawAuroraSlide }, { frame: false });
  b.push().translate(x0 + 2.4, ofy + 0.5, oz + 1.5);
  b.box('i:sheet_metal', 0, 0, 0, 0.5, 1.1, 0.4, { color: '#e8eaec' });
  b.pop();
  ctx.point('stage', x0 + 1.6, ofy + 0.5, oz, HALF_PI);
  ctx.point('podium', x0 + 2.4, ofy + 0.5, oz + 1.0, -HALF_PI);
  // bar along the north wall
  counter(ctx, gc + 3, ofy, z0 + 0.8, 0, { w: 5.0, d: 0.6, h: 1.08, key: 'sheet_metal', color: '#1a1c1e', top: '#e8e8e6', topKey: 'stone', panels: false });
  b.box('i:neon', gc + 3, ofy + 0.1, z0 + 1.11, 5.0, 0.03, 0.02, { color: CYAN });
  shelf(ctx, gc + 3, ofy, z0 + 0.2, 0, { w: 4.6, h: 2.0, d: 0.3, levels: 4, key: 'sheet_metal', color: '#1a1c1e', palette: ['#e8d8a0', '#3a8a2a', '#c8a050', '#e8e8e0', '#2a4a8a'], sparse: 0.05 });
  ctx.point('bar', gc + 3, ofy, z0 + 1.8, PI);
  ctx.point('galaHall', gc, ofy, oz + 3, PI);
  rug(ctx, gc, ofy, oz, 14, 7, '#1a2a4a');
  // ---- server room (xs → xv) with rack rows, cold light, raised floor
  const xv = x1 - 4.2;
  floor(ctx, (xs + xv) / 2, oz, xv - xs, z1 - z0, ofy + 0.3, 'diamond_plate', '#b8c0c8');
  ceiling(ctx, (xs + xv) / 2, oz, xv - xs, z1 - z0, ofy + ch, 'plaster', '#1a1e24');
  for (let row = 0; row < 3; row++) for (let k = 0; k < 6; k++) serverRack(ctx, xs + 1.6 + row * 2.4, ofy + 0.3, z0 + 1.4 + k * 0.65, HALF_PI);
  for (let row = 0; row < 3; row++) b.box('i:neon', xs + 1.6 + row * 2.4 + 1.2, ofy + ch - 0.02, oz, 0.2, 0.02, z1 - z0 - 1, { color: [1.2, 3.2, 5.0] });
  ctx.light((xs + xv) / 2, ofy + 2.6, oz, 0x60b0ff, 2.2, 10);
  ctx.point('serverRoom', xs + 1.0, ofy + 0.3, z1 - 1.2, HALF_PI);
  ctx.point('racks', xs + 2.8, ofy + 0.3, oz, HALF_PI);
  partition(ctx, xv, z0, xv, z1, ofy, ch, { color: '#3a3e44' });
  // the vault door (round, steel) in the partition + the vault behind
  const vz = oz;
  b.push().translate(xv - 0.1, ofy + 1.25, vz).rotateZ(HALF_PI);
  b.cyl('i:chrome', 0, -0.25, 0, 1.15, 0.25, { segs: 24, color: '#8a9098' });
  b.cyl('i:chrome', 0, -0.32, 0, 0.95, 0.07, { segs: 24, color: '#a8b0b8' });
  for (let k = 0; k < 12; k++) { const a = (k / 12) * PI * 2; b.cyl('i:chrome', Math.cos(a) * 1.05, -0.3, Math.sin(a) * 1.05, 0.04, 0.06, { segs: 6, color: '#c8d0d8' }); }
  b.pop();
  b.push().translate(xv - 0.45, ofy + 1.25, vz).rotateZ(HALF_PI);
  for (let k = 0; k < 3; k++) b.box('i:chrome', 0, 0, 0, 0.9, 0.05, 0.08, { color: '#d8dce0', ry: (k * PI) / 3 });
  b.cyl('i:chrome', 0, -0.05, 0, 0.1, 0.1, { segs: 10, color: '#d8dce0' });
  b.pop();
  b.box('i:neon', xv - 0.12, ofy + 2.6, vz + 1.4, 0.02, 0.2, 0.3, { color: [0.3, 4, 0.6] });
  ctx.point('vaultDoor', xv - 1.4, ofy + 0.3, vz, HALF_PI);
  floor(ctx, (xv + x1) / 2, oz, x1 - xv, z1 - z0, ofy, 'concrete', '#6a6e72');
  ceiling(ctx, (xv + x1) / 2, oz, x1 - xv, z1 - z0, ofy + ch, 'concrete', '#3a3e42');
  b.box('i:chrome', (xv + x1) / 2, ofy, vz, 0.6, 1.0, 0.6, { color: '#2a2d30' });
  b.box('i:glass_clear', (xv + x1) / 2, ofy + 1.0, vz, 0.5, 0.4, 0.5, { color: '#ffffff' });
  b.box('i:neon', (xv + x1) / 2, ofy + 1.05, vz, 0.12, 0.03, 0.06, { color: [1.0, 5.0, 6.0] });
  for (const dz of [-3, 3]) b.box('i:sheet_metal', x1 - 0.4, ofy, vz + dz, 0.6, 2.0, 1.6, { color: '#4a4e52' });
  ctx.light((xv + x1) / 2, ofy + 2.4, vz, 0xa0e0ff, 1.2, 6);
  ctx.point('vault', (xv + x1) / 2 - 1.0, ofy, vz, HALF_PI);
  ctx.point('drive', (xv + x1) / 2, ofy + 1.1, vz, 0);
  ctx.colLocal((xv + x1) / 2, vz, 0.6, 0.6, 1.4);
  // walls: the ops building with the gala door + service door, lobby glass walls
  wallColliders(ctx, OW, OD, ox, oz, [{ side: 0, u: OW * 0.62, w: 2.0 }, { side: 3, u: OD * 0.5, w: 0.95 }], OH);
  // the vault partition gets a gap only where the round door is (closed by default)
  ctx.point('door_in', ox - OW / 2 + OW * 0.62, ofy, pz + PD / 2 - 1.0, PI);
  ctx.doors.push({ id: 'entrance_in', x: ox - OW / 2 + OW * 0.62, z: pz + PD / 2 - 0.6, rot: PI, w: 2.2, leadsTo: 'exterior' });
}

function drawAuroraSlide(g, W, H) {
  const gr = g.createLinearGradient(0, 0, W, H);
  gr.addColorStop(0, '#04121c'); gr.addColorStop(1, '#0a2a3a');
  g.fillStyle = gr; g.fillRect(0, 0, W, H);
  g.strokeStyle = 'rgba(80,240,200,0.8)'; g.lineWidth = H * 0.02;
  for (let i = 0; i < 3; i++) { g.beginPath(); g.moveTo(0, H * (0.3 + i * 0.08)); g.bezierCurveTo(W * 0.3, H * (0.1 + i * 0.1), W * 0.6, H * (0.5 + i * 0.05), W, H * (0.25 + i * 0.08)); g.stroke(); }
  g.fillStyle = '#e8fcff'; g.font = `900 ${H * 0.18}px Arial Black, Arial`; g.textAlign = 'center';
  g.fillText('AURORA', W / 2, H * 0.7);
  g.font = `${H * 0.06}px Arial`; g.fillStyle = '#7ff4ff';
  g.fillText('GRID STABILITY FOR A RESILIENT WORLD · NORTHSTAR DYNAMICS', W / 2, H * 0.84);
}
