// Cape lighthouse: an octagonal white tower with a red gallery and lantern room
// on a rocky point, the keeper's shed beside it. The lamp glows; a light beam
// mesh (group.userData.beam) can be spun by the game.
import * as THREE from 'three';
import { makeCtx, finish, walls, roofGable, sign, porchLight, steps, weather, rgb, LIGHT, PI, HALF_PI, windowCond } from './common.js';

export function build(opts = {}) {
  const ctx = makeCtx('lighthouse', opts);
  const b = ctx.b, r = ctx.rng, st = ctx.state, wear = ctx.wear;
  ctx.footprint = { w: 24, d: 22 };
  const white = weather('#f2f0ea', wear * 0.6), red = weather('#b8281e', wear * 0.6);
  // rocky base: a few big boulders + a concrete pad
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * PI * 2 + r() * 0.4, d = 4.5 + r() * 3.5;
    const g = new THREE.IcosahedronGeometry(1.2 + r() * 1.6, 1);
    const p = g.attributes.position;
    for (let k = 0; k < p.count; k++) p.setXYZ(k, p.getX(k) * (1 + (r() - 0.5) * 0.4), p.getY(k) * (0.55 + r() * 0.2), p.getZ(k) * (1 + (r() - 0.5) * 0.4));
    const ng = g.index ? g.toNonIndexed() : g; ng.computeVertexNormals();
    const uv = ng.attributes.uv, pp = ng.attributes.position;
    for (let k = 0; k < uv.count; k++) uv.setXY(k, pp.getX(k) + pp.getZ(k) * 0.5, pp.getY(k));
    b.push().translate(Math.cos(a) * d, 0.1, Math.sin(a) * d).rotateY(r() * 3);
    b.geom('rock', ng, { color: '#9a9a96' });
    b.pop();
    g.dispose(); if (ng !== g) ng.dispose();
  }
  b.cyl('concrete', 0, -0.2, 0, 3.4, 0.5, { segs: 8, smooth: false, color: '#a8a8a2' });
  ctx.floor(0, 0, 4.6, 4.6, 0.3);
  // octagonal tapered tower
  const H = 12, R0 = 2.1, R1 = 1.55;
  b.cyl(wear > 0.6 ? 'plaster' : 'plaster', 0, 0.3, 0, R0, H, { rTop: R1, segs: 8, smooth: false, color: white, caps: '' });
  // door + small windows up the shaft (on facets)
  const facet = (y, h, w, light, kind) => {
    const rr = R0 + (R1 - R0) * (y / H) - 0.02;
    const apo = rr * Math.cos(PI / 8);
    if (kind === 'door') {
      b.box('paint', 0, 0.3, apo, 0.95, 2.1, 0.06, { color: red });
      b.box('paint', 0, 2.4, apo + 0.03, 1.2, 0.15, 0.1, { color: white });
    } else {
      b.poly('glass_warm', [[-w / 2, y, apo + 0.01], [w / 2, y, apo + 0.01], [w / 2, y + h, apo + 0.01], [-w / 2, y + h, apo + 0.01]], { color: light, uv: [[0, 0], [0.25, 0], [0.25, 0.5], [0, 0.5]] });
      b.box('paint', 0, y - 0.06, apo + 0.03, w + 0.16, 0.06, 0.1, { color: red });
    }
  };
  facet(0.3, 2.1, 0.95, null, 'door');
  b.push().rotateY(PI / 4 * 2);
  facet(4.5, 0.8, 0.5, st > 0.3 ? LIGHT.dim : LIGHT.off);
  b.pop();
  b.push().rotateY(PI / 4 * 5);
  facet(8.0, 0.8, 0.5, LIGHT.off);
  b.pop();
  // gallery deck + railing (red), lantern room (glass + mullions), dome cap
  const gy = H + 0.3;
  b.cyl('paint', 0, gy, 0, 2.55, 0.22, { segs: 8, smooth: false, color: red });
  for (let k = 0; k < 8; k++) {
    const a0 = (k / 8) * PI * 2 + PI / 8, a1 = ((k + 1) / 8) * PI * 2 + PI / 8;
    const rr = 2.45;
    b.cylBetween('metal', [Math.sin(a0) * rr, gy + 1.05, Math.cos(a0) * rr], [Math.sin(a1) * rr, gy + 1.05, Math.cos(a1) * rr], 0.03, { segs: 4, caps: '', color: red });
    b.cylBetween('metal', [Math.sin(a0) * rr, gy + 0.55, Math.cos(a0) * rr], [Math.sin(a1) * rr, gy + 0.55, Math.cos(a1) * rr], 0.02, { segs: 4, caps: '', color: red });
    b.cyl('metal', Math.sin(a0) * rr, gy + 0.2, Math.cos(a0) * rr, 0.03, 0.88, { segs: 4, color: red });
  }
  ctx.floor(0, 0, 4.6, 4.6, gy + 0.22);
  const ly = gy + 0.22;
  b.cyl('paint', 0, ly, 0, 1.3, 0.6, { segs: 8, smooth: false, color: red });
  b.cyl('glass_cold', 0, ly + 0.6, 0, 1.2, 1.7, { segs: 8, smooth: false, color: [0.3, 0.35, 0.4], caps: '', uvScale: [0.02, 0.02] });
  for (let k = 0; k < 8; k++) { const a = (k / 8) * PI * 2; b.box('metal', Math.sin(a) * 1.21, ly + 0.6, Math.cos(a) * 1.21, 0.06, 1.7, 0.06, { color: '#1a1a1a', ry: a }); }
  b.cyl('paint', 0, ly + 2.3, 0, 1.4, 0.15, { segs: 8, smooth: false, color: red });
  b.lathe('sheet_metal', 0, ly + 2.45, 0, [[1.4, 0], [1.2, 0.35], [0.8, 0.7], [0.3, 0.9], [0.0, 0.95]], { segs: 16, color: red });
  b.sphere('sheet_metal', 0, ly + 3.55, 0, 0.18, { rings: 5, segs: 8, color: '#2a2a2a' });
  b.cylBetween('metal', [0, ly + 3.7, 0], [0, ly + 4.6, 0], 0.012, { segs: 3, color: '#2a2a2a' });
  // the lamp (lens) — bright
  const on = st > 0.05;
  b.cyl('neon', 0, ly + 1.1, 0, 0.42, 0.7, { segs: 12, color: on ? [9, 8.4, 6.5] : [0.08, 0.08, 0.08] });
  if (on) ctx.light(0, ly + 1.45, 0, 0xfff4d8, 5, 45);
  ctx.col(0, 0, R0 * 2, R0 * 2, H);
  // beam: an additive cone the game can spin (group.userData.beam)
  if (on) {
    const cone = new THREE.ConeGeometry(4.5, 60, 16, 1, true);
    cone.translate(0, -30, 0);
    cone.rotateZ(HALF_PI);
    const mat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.35, 0.33, 0.28), transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false });
    const beam = new THREE.Mesh(cone, mat);
    beam.name = 'beam';
    beam.position.set(0, ly + 1.45, 0);
    beam.rotation.y = 0.6;
    ctx.extra.push(beam);
    ctx.beam = beam;
  }
  // keeper's shed
  const sx = 6.5, sz = 2.0;
  const ss = [[{ kind: 'door', u: 1.2, y: 0.35, w: 0.9, h: 2.0, style: 'plank', color: red, id: 'shed' }, { kind: 'win', u: 3.0, y: 1.2, w: 0.8, h: 0.8, style: 'grid', gx: 2, gy: 2, light: st > 0.3 ? LIGHT.warm : LIGHT.off, cell: 2, cond: windowCond(ctx) }], [], [], []];
  walls(ctx, { W: 4.2, D: 3.6, cx: sx, cz: sz, y0: 0.3, y1: 2.7, key: wear > 0.5 ? 'siding_peel' : 'siding_lap', color: white, trim: red, sides: ss, gable: { axis: 'x', yRidge: 2.7 + 1.8 * 0.7 }, thick: 0.15, corner: 0.1 });
  roofGable(ctx, { W: 4.2, D: 3.6, cx: sx, cz: sz, yEave: 2.7, pitch: 0.7, axis: 'x', eave: 0.35, rake: 0.25, key: 'metal_corr_paint', color: red, trim: white, icicles: 0.5 });
  b.box('concrete', sx, 0, sz, 4.3, 0.35, 3.7, { color: '#9a9a94' });
  porchLight(ctx, sx - 2.1 + 1.9, 2.2, sz + 1.82, 0, st > 0.2);
  ctx.col(sx, sz, 4.2, 3.6, 3);
  ctx.doors.push({ id: 'tower', x: 0, z: R0 * Math.cos(PI / 8) + 0.1, rot: 0, w: 0.95, leadsTo: 'exterior' });
  ctx.doors.push({ id: 'shed', x: sx - 2.1 + 1.2, z: sz + 1.9, rot: 0, w: 0.9, leadsTo: 'exterior' });
  ctx.point('door', 0, 0.3, 3.4, PI);
  ctx.point('gallery', 0, gy + 0.22, 2.1, PI);
  ctx.point('lamp', 0, ly + 1.45, 0, 0);
  ctx.point('shed', sx - 0.9, 0.3, sz + 2.8, PI);
  void sign; void steps; void rgb;
  const res = finish(ctx);
  if (ctx.beam) res.group.userData.beam = ctx.beam;
  return res;
}
