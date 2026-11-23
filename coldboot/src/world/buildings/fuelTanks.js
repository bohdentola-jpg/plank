// Tank farm: white vertical fuel tanks inside a gravel containment berm and a
// chain-link fence with barbed wire, caged ladders, top railings, a pipe
// manifold, a small pump house and warning signs. Rust streaks when run-down.
import { makeCtx, finish, walls, roofShed, sign, weather, rgb, LIGHT, PI, HALF_PI } from './common.js';
import { addProp } from '../props.js';

export function build(opts = {}) {
  const ctx = makeCtx('fuelTanks', opts);
  const b = ctx.b, r = ctx.rng, st = ctx.state, wear = ctx.wear;
  const tanks = [[-9, -6, 4.2, 8.5], [1, -6, 4.2, 8.5], [10, -6.5, 3.2, 7.0], [-9, 5, 3.6, 7.5], [1.5, 5, 3.6, 7.5]];
  const W = 34, D = 28;
  ctx.footprint = { w: W + 2, d: D + 2 };
  const white = weather('#eeeeea', wear * 0.35);
  // berm (sloped gravel dike) + gravel floor
  b.box('gravel', 0, -0.05, 0, W - 3, 0.08, D - 3, { color: '#a8a49a' });
  const bh = 1.2;
  for (const [x, z, w, d, rot] of [[0, -D / 2 + 1.5, W - 1, 3, 0], [0, D / 2 - 1.5, W - 1, 3, PI], [-W / 2 + 1.5, 0, D - 1, 3, -HALF_PI], [W / 2 - 1.5, 0, D - 1, 3, HALF_PI]]) {
    b.push().translate(x, 0, z).rotateY(rot);
    b.poly('gravel', [[-w / 2, 0, -d / 2], [w / 2, 0, -d / 2], [w / 2, bh, 0], [-w / 2, bh, 0]], { color: '#9a968c', want: [0, 1, -1] });
    b.poly('gravel', [[w / 2, 0, d / 2], [-w / 2, 0, d / 2], [-w / 2, bh, 0], [w / 2, bh, 0]], { color: '#9a968c', want: [0, 1, 1] });
    b.pop();
  }
  // tanks
  tanks.forEach(([x, z, R, H], i) => {
    b.cyl(wear > 0.5 ? 'metal_paint_rust' : 'sheet_metal', x, 0, z, R, H, { segs: 28, color: wear > 0.5 ? weather('#ffffff', 0.1) : white, caps: '' });
    // shallow cone roof
    b.cyl('sheet_metal', x, H, z, R + 0.05, 0.6, { rTop: 0.4, segs: 28, color: rgb(white, 0.95), caps: 't' });
    // weld seams / courses
    for (let k = 1; k < 4; k++) b.cyl('sheet_metal', x, (H * k) / 4 - 0.02, z, R + 0.012, 0.04, { segs: 28, color: rgb(white, 0.88), caps: '' });
    // rust streaks from the top
    if (wear > 0.3) for (let k = 0; k < Math.floor(wear * 10); k++) {
      const a = r() * PI * 2;
      b.push().translate(x + Math.sin(a) * (R + 0.015), 0, z + Math.cos(a) * (R + 0.015)).rotateY(a);
      b.box('paint', 0, H - 0.2 - (1 + r() * 4), 0, 0.06 + r() * 0.1, 1 + r() * 4, 0.005, { color: '#7a4a2a' });
      b.pop();
    }
    // concrete ring foundation
    b.cyl('concrete', x, -0.1, z, R + 0.4, 0.3, { segs: 28, color: '#8a8a86' });
    // caged ladder up the side facing +x, top railing
    const lx = x + R + 0.1;
    for (const dz of [-0.25, 0.25]) b.box('galv', lx, 0.3, z + dz, 0.05, H - 0.1, 0.05, { color: '#a8aeb0' });
    for (let y = 0.6; y < H; y += 0.3) b.box('galv', lx, y, z, 0.03, 0.03, 0.5, { color: '#a8aeb0' });
    for (let y = 2.4; y < H + 0.8; y += 0.6) {
      b.push().translate(lx + 0.35, y, z).rotateY(HALF_PI).rotateX(HALF_PI);
      b.cyl('galv', 0, -0.02, 0, 0.38, 0.04, { segs: 8, thetaStart: -HALF_PI * 1.2, thetaLen: PI * 1.2, color: '#a8aeb0', caps: '' });
      b.pop();
    }
    for (let k = 0; k < 16; k++) {
      const a0 = (k / 16) * PI * 2, a1 = ((k + 1) / 16) * PI * 2;
      const rr = R - 0.15;
      b.cylBetween('galv', [x + Math.cos(a0) * rr, H + 0.55 + 1.0, z + Math.sin(a0) * rr], [x + Math.cos(a1) * rr, H + 0.55 + 1.0, z + Math.sin(a1) * rr], 0.025, { segs: 4, caps: '', color: '#e8c020' });
      if (k % 2 === 0) b.cylBetween('galv', [x + Math.cos(a0) * rr, H + 0.4, z + Math.sin(a0) * rr], [x + Math.cos(a0) * rr, H + 1.55, z + Math.sin(a0) * rr], 0.02, { segs: 4, caps: '', color: '#e8c020' });
    }
    // number stencil
    b.push().translate(x, 2.6, z).rotateY(-0.6);
    sign(ctx, 'tank_no_' + (i + 1), 0, 0, R + 0.02, 1.0, 1.0, { kind: 'paint', ppm: 100, transparent: true, lines: [{ text: String(i + 1), size: 0.9, color: '#2a3a5a', font: 'Arial Black, Arial, sans-serif', weight: '900' }] }, { back: false });
    b.pop();
    ctx.col(x, z, R * 2, R * 2, H);
    ctx.point('tank' + (i + 1), lx + 0.8, 0, z, -HALF_PI);
    // pipe from the tank base to the manifold
    b.cylBetween('metal', [x + (i % 2 ? -1 : 1) * R * 0.5, 0.5, z + (z < 0 ? R : -R)], [x, 0.5, 0], 0.08, { segs: 8, color: '#8a8e90' });
    b.box('metal', x, 0.0, 0, 0.2, 0.5, 0.2, { color: '#5a5a58' });
  });
  // manifold along the centre line + pump house
  b.cylBetween('metal', [-W / 2 + 3, 0.5, 0], [W / 2 - 6, 0.5, 0], 0.12, { segs: 8, color: '#8a8e90' });
  for (let x = -W / 2 + 3; x < W / 2 - 6; x += 3) b.box('metal', x, 0, 0, 0.15, 0.5, 0.6, { color: '#5a5a58' });
  const px = W / 2 - 5, pz = 2.5;
  walls(ctx, { W: 4, D: 3.2, cx: px, cz: pz, y0: 0, y1: 2.6, key: 'metal_corr_paint', color: weather('#c8c0a8', wear * 0.6), trim: '#8a8e90', sides: [[{ kind: 'door', u: 1.2, y: 0, w: 0.9, h: 2.05, style: 'steel', color: '#7a7e80', id: 'pump' }], [], [], [{ kind: 'win', u: 1.6, y: 1.2, w: 0.8, h: 0.6, style: 'fixed', light: st > 0.2 ? LIGHT.dim : LIGHT.off, cell: 7 }]], thick: 0.12, corner: 0.06, bands: false });
  roofShed(ctx, { W: 4, D: 3.2, cx: px, cz: pz, yLow: 2.6, yHigh: 3.0, high: 'back', key: 'metal_corr', color: '#ffffff', trim: '#8a8e90', eave: 0.25, rake: 0.15 });
  b.box('neon', px - 2 + 1.2, 2.35, pz + 1.65, 0.12, 0.12, 0.08, { color: st > 0.1 ? [5, 4, 2.5] : [0.05, 0.05, 0.05] });
  if (st > 0.1) ctx.light(px - 0.8, 2.3, pz + 2.0, 0xffd0a0, 1.2, 7);
  ctx.col(px, pz, 4, 3.2, 3);
  ctx.point('pumpHouse', px - 0.8, 0, pz + 2.6, PI);
  // fence + barbed wire around, gate at the front-left
  const fw = W - 0.4, fd = D - 0.4;
  const runs = [[-fw / 2, fd / 2, fw, 0], [fw / 2, -fd / 2, fw, PI], [fw / 2, fd / 2, fd, HALF_PI], [-fw / 2, -fd / 2, fd, -HALF_PI]];
  for (const [sx, sz, len, rot] of runs) {
    const n = Math.round(len / 3);
    for (let i = 0; i < n; i++) {
      const isGate = rot === 0 && (i === 1 || i === 2);
      b.push().translate(sx, 0, sz).rotateY(rot).translate(i * (len / n), 0, 0);
      if (isGate) {
        if (i === 1) { b.cyl('galv', 0, -0.3, 0, 0.06, 2.6, { segs: 8, color: '#a8aeb0' }); b.cyl('galv', 2 * (len / n), -0.3, 0, 0.06, 2.6, { segs: 8, color: '#a8aeb0' }); b.push().rotateY(-0.4); addProp(b, 'fenceChain', { len: len / n, h: 2.0 }, r); b.pop(); }
      } else addProp(b, 'fenceChain', { len: len / n, h: 2.1, barbed: true, end: i === n - 1 }, r);
      b.pop();
    }
  }
  // colliders for the fence runs (gate gap = front segments 1–2)
  const seg = len3(fw);
  ctx.col(-fw / 2 + seg / 2, fd / 2, seg, 0.2, 2.3);
  ctx.col((-fw / 2 + 3 * seg + fw / 2) / 2, fd / 2, fw - 3 * seg, 0.2, 2.3);
  ctx.col(0, -fd / 2, fw, 0.2, 2.3);
  ctx.col(-fw / 2, 0, 0.2, fd, 2.3);
  ctx.col(fw / 2, 0, 0.2, fd, 2.3);
  // signs on the fence
  const signSpec = (t1, t2, c) => ({ kind: 'paint', ppm: 140, bg: '#ffffff', border: '#1a1a1a', lines: [{ text: t1, size: 0.34, y: 0.3, color: c, font: 'Arial Black, Arial, sans-serif', weight: '900' }, { text: t2, size: 0.22, y: 0.72, color: '#1a1a1a', font: 'Arial, sans-serif', weight: 'bold' }] });
  b.push().translate(fw / 2 * 0.2, 1.4, fd / 2 + 0.05);
  sign(ctx, 'tanks_danger', 0, 0, 0, 1.0, 0.6, signSpec('DANGER', 'FLAMMABLE · NO SMOKING', '#c81a1a'), { back: true });
  b.pop();
  b.push().translate(-fw / 2 + 4.6, 1.5, fd / 2 + 0.05);
  sign(ctx, 'tanks_owner', 0, 0, 0, 1.2, 0.6, signSpec('ZARYA FUEL', 'EMERGENCY: 911 · VHF 16', '#2a3a6a'), { back: true });
  b.pop();
  // floodlights on poles
  for (const [x, z] of [[-W / 2 + 1, -D / 2 + 1], [W / 2 - 1, D / 2 - 1]]) {
    b.cyl('galv', x, 0, z, 0.08, 7.0, { segs: 8, color: '#a8aeb0' });
    b.box('metal', x, 6.9, z, 0.5, 0.3, 0.3, { color: '#3a3a3a', rx: 0.4 });
    b.box('neon', x, 6.85, z + 0.12, 0.42, 0.22, 0.02, { color: st > 0.15 ? [7, 7, 6] : [0.05, 0.05, 0.05], rx: 0.4 });
    if (st > 0.15) ctx.light(x, 6.6, z, 0xf4f0e0, 2.6, 22);
  }
  ctx.doors.push({ id: 'gate', x: -fw / 2 + 2 * seg, z: fd / 2, rot: 0, w: 2 * seg, leadsTo: 'exterior' });
  ctx.point('gate', -fw / 2 + 2 * seg, 0, fd / 2 + 1.5, PI);
  // the berm at the gate: up the outer slope, down the inner one
  ctx.ramp(-fw / 2 + 2 * seg, D / 2 - 0.75, 2 * seg, 1.5, 0, bh, PI);
  ctx.ramp(-fw / 2 + 2 * seg, D / 2 - 2.25, 2 * seg, 1.5, 0, bh, 0);
  ctx.point('ladder', tanks[0][0] + tanks[0][2] + 0.8, 0, tanks[0][1], -HALF_PI);
  return finish(ctx);
}

function len3(fw) { return fw / Math.round(fw / 3); }
