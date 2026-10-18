// PORT HALCYON — OLD TOWN's corners and furniture: the retaining walls of
// the lane down to LE PETIT PORT, THE OLD MILL at the end of the towpath
// (its wheel turns in the race fed off the river), and the street
// furniture of the squares and quays — newspaper kiosks, Morris columns
// with their posters, cast-iron bollards, the bouquinistes' boxes on the
// parapets — and the cast-iron dress of the gas lamps along the streets.
import * as THREE from 'three';
import { box, cylinder, cone, sphere, gable } from '../builder.js';
import { Acc } from '../../build/geo.js';
import { quadFacing } from './riverbuild.js';
import { otwUV, otsgUV } from './ottex.js';
import { metalUV } from './tex.js';
import { frame, lantern } from './geo.js';

const IRON = [0.08, 0.1, 0.09];

// ------------------------------------------------------------------ the lane's walls

/**
 * The walls that hold the town up where the lane runs down below it: a
 * stone face towards the lane, a coping, an iron railing along the top and
 * a paved strip behind. it.runs: [{ pts: [[x, z, yLane, yTop, nx, nz]] }]
 * (n: the face's normal, towards the lane).
 */
export function portWalls(K, it) {
  const S = K.stone, N = K.near;
  for (const run of it.runs) {
    const pts = run.pts;
    let u = 0;
    for (let k = 0; k < pts.length - 1; k++) {
      const [ax, az, al, at, anx, anz] = pts[k], [bx, bz, bl, bt] = pts[k + 1];
      const len = Math.hypot(bx - ax, bz - az);
      if (len < 0.05) continue;
      const n = [anx, 0, anz];
      const o = (x, z, nx, nz, d) => [x - nx * d, z - nz * d];      // d back from the face (into the town)
      S.col = [0.8, 0.76, 0.68];
      quadFacing(S, [ax, al - 0.5, az], [bx, bl - 0.5, bz], [bx, bt + 0.12, bz], [ax, at + 0.12, az], n, [u / 2.4, (al - 0.5) / 2.4, (u + len) / 2.4, (at + 0.12) / 2.4]);
      // the coping (a little proud of the face) and the strip behind
      const [a2x, a2z] = o(ax, az, anx, anz, 0.5), [b2x, b2z] = o(bx, bz, anx, anz, 0.5);
      S.col = [0.9, 0.87, 0.8];
      quadFacing(S, [ax + anx * 0.08, at + 0.24, az + anz * 0.08], [bx + anx * 0.08, bt + 0.24, bz + anz * 0.08], [b2x, bt + 0.24, b2z], [a2x, at + 0.24, a2z], [0, 1, 0]);
      quadFacing(S, [ax + anx * 0.08, at + 0.1, az + anz * 0.08], [bx + anx * 0.08, bt + 0.1, bz + anz * 0.08], [bx + anx * 0.08, bt + 0.24, bz + anz * 0.08], [ax + anx * 0.08, at + 0.24, az + anz * 0.08], n);
      const [a3x, a3z] = o(ax, az, anx, anz, 2.6), [b3x, b3z] = o(bx, bz, anx, anz, 2.6);
      K.pave.col = [1, 1, 1];
      quadFacing(K.pave, [a2x, at + 0.06, a2z], [b2x, bt + 0.06, b2z], [b3x, bt + 0.06, b3z], [a3x, at + 0.06, a3z], [0, 1, 0], [u / 4, 0, (u + len) / 4, 0.55]);
      // the railing on the coping, both faces
      N.metal.col = [0.1, 0.11, 0.11];
      const r0 = [ax - anx * 0.25, at + 0.24, az - anz * 0.25], r1 = [bx - anx * 0.25, bt + 0.24, bz - anz * 0.25];
      const uv = metalUV(0, len, 2);
      quadFacing(N.metal, r0, r1, [r1[0], r1[1] + 1.0, r1[2]], [r0[0], r0[1] + 1.0, r0[2]], n, [u / 2, uv[1], (u + len) / 2, uv[3]]);
      u += len;
    }
  }
}

// ------------------------------------------------------------------ the mill

/**
 * THE OLD MILL: three storeys of rubble stone under a steep tiled roof, a
 * hoist dormer, the inn's board over the door; its wheel on the river side
 * (a mesh of its own, turned each frame), the flume that feeds it out of the
 * levee, the wheel pit and the tail race back into a culvert.
 * it: { x, z, g (ground), ry (local x along the river, +z towards it),
 * w, d, wheel: lx, levee: local z of the levee's land face, lit }.
 */
export function mill(K, B, it, M) {
  // (a frame at y 0: heights below are absolute)
  const F = frame(it.x, 0, it.z, it.ry);
  const S = K.stone, N = K.near;
  const g = it.g, w = it.w, d = it.d;
  const hw = w / 2, hd = d / 2;
  const fl = [3.6, 3.0, 3.0], wallH = fl[0] + fl[1] + fl[2];
  const at = (lx, ly, lz) => F.P(lx, ly, lz);
  const W2 = (lx, lz) => { const p = F.P(lx, 0, lz); return [p[0], p[2]]; };
  // the walls (rubble: the ashlar darkened), quoins at the corners
  S.col = [0.66, 0.62, 0.55];
  const c = W2(0, 0);
  box(S, c[0], g - 0.6, c[1], w, wallH + 0.6, d, it.ry, { u: 2.4, top: false });
  S.col = [0.84, 0.8, 0.72];
  for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
    const q = W2(sx * (hw - 0.25), sz * (hd - 0.25));
    box(S, q[0], g - 0.2, q[1], 0.62, wallH + 0.2, 0.62, it.ry, { u: 2.4, top: false });
  }
  // the roof: steep tiles, ridge along the river; a chimney stack
  K.tile.col = [0.74, 0.42, 0.3];
  gable(K.tile, c[0], g + wallH, c[1], w, d, 5.6, it.ry, { over: 0.45, endAcc: S, u: 2 });
  const ch = W2(hw - 2.2, -1.2);
  S.col = [0.6, 0.56, 0.5];
  box(S, ch[0], g + wallH + 2, ch[1], 0.9, 5.2, 0.9, it.ry, { u: 1 });
  // windows: small and square, three floors, a few lit (it's an inn now)
  const rng = mulberry(Math.floor(it.x * 7 + it.z * 13));
  const win = K.win;
  const faces = [
    { a: [hw, hd], b: [-hw, hd], n: [0, 1] }, { a: [-hw, -hd], b: [hw, -hd], n: [0, -1] },
    { a: [hw, -hd], b: [hw, hd], n: [1, 0] }, { a: [-hw, hd], b: [-hw, -hd], n: [-1, 0] },
  ];
  for (const f of faces) {
    const len = Math.hypot(f.b[0] - f.a[0], f.b[1] - f.a[1]);
    const tx = (f.b[0] - f.a[0]) / len, tz = (f.b[1] - f.a[1]) / len;
    const nb = Math.max(2, Math.round(len / 3.2));
    for (let fi = 0; fi < 3; fi++) {
      const y0 = g + (fi === 0 ? 1.2 : fl[0] + (fi - 1) * 3 + 0.9);
      for (let k = 0; k < nb; k++) {
        const a = (k + 0.5) * len / nb;
        // the river face's ground floor is the wheel's; the end with the door keeps its middle
        if (f.n[1] === 1 && fi === 0) continue;
        if (f.n[0] === 1 && fi === 0 && Math.abs(a - len / 2) < 1.6) continue;
        const lx = f.a[0] + tx * a, lz = f.a[1] + tz * a;
        const ox = f.n[0] * 0.05, oz = f.n[1] * 0.05;
        const lit = rng() < it.lit;
        win.col = [0.42, 0.3, 0.2];
        const A = at(lx - tx * 0.5 + ox, y0, lz - tz * 0.5 + oz), Bq = at(lx + tx * 0.5 + ox, y0, lz + tz * 0.5 + oz);
        win.quadP(A, Bq, [Bq[0], y0 + 1.15, Bq[2]], [A[0], y0 + 1.15, A[2]], otwUV(lit ? 'd_lit' : 'd_dark'));
      }
    }
  }
  // the door on the downstream end, the inn's board over it, a lantern
  {
    const A = at(hw + 0.05, g, 0.8), Bq = at(hw + 0.05, g, -0.8);
    win.col = [0.36, 0.2, 0.12];
    win.quadP(A, Bq, [Bq[0], g + 2.8, Bq[2]], [A[0], g + 2.8, A[2]], otwUV('door_lit'));
    const s0 = at(hw + 0.12, g + 3.05, 2.6), s1 = at(hw + 0.12, g + 3.05, -2.6);
    K.sign.quadP(s0, s1, [s1[0], g + 4.0, s1[2]], [s0[0], g + 4.0, s0[2]], otsgUV('moulin'));
    const lp = at(hw + 0.5, g + 2.7, 1.5);
    N.paint.col = IRON;
    N.paint.beam(...at(hw, g + 3.0, 1.5), lp[0], lp[1] + 0.3, lp[2], 0.05, 0.05);
    K.glow.col = [1, 1, 1];
    box(K.glow, lp[0], lp[1] - 0.25, lp[2], 0.24, 0.36, 0.24, it.ry, { u: 1 });
  }
  // the hoist dormer on the land side, its beam and hook
  {
    const lz = -hd + 1.2, lx = -1.5;
    const p = W2(lx, lz);
    S.col = [0.66, 0.62, 0.55];
    box(S, p[0], g + wallH - 0.6, p[1], 2.2, 3.0, 2.2, it.ry, { u: 2.4, top: false });
    K.tile.col = [0.7, 0.4, 0.28];
    gable(K.tile, p[0], g + wallH + 2.4, p[1], 2.2, 2.4, 1.3, it.ry + Math.PI / 2, { over: 0.25, endAcc: S, u: 2 });
    win.col = [0.36, 0.24, 0.16];
    const A = at(lx + 0.65, g + wallH, -hd + 0.07), Bq = at(lx - 0.65, g + wallH, -hd + 0.07);
    win.quadP(Bq, A, [A[0], g + wallH + 1.9, A[2]], [Bq[0], g + wallH + 1.9, Bq[2]], otwUV('door'));
    N.paint.col = [0.3, 0.2, 0.12];
    N.paint.beam(...at(lx, g + wallH + 2.25, -hd + 1), ...at(lx, g + wallH + 2.25, -hd - 1.1), 0.18, 0.18);
    N.paint.col = IRON;
    N.paint.beam(...at(lx, g + wallH + 2.15, -hd - 1.0), ...at(lx, g + wallH + 0.9, -hd - 1.0), 0.03, 0.03);
  }
  // millstones leaning by the door, a bench
  for (const [lz, r] of [[2.6, 0.75], [3.4, 0.68]]) {
    const p = at(hw + 0.55, g + r, lz);
    S.col = [0.6, 0.58, 0.55];
    const ax = F.P(1, 0, 0), o = F.P(0, 0, 0);
    const ux = ax[0] - o[0], uz = ax[2] - o[2];
    const acc = S;
    // a disc standing on edge: its faces point along the wall's normal
    const seg = 10, th = 0.28;
    for (let q = 0; q < seg; q++) {
      const a0 = (q / seg) * Math.PI * 2, a1 = ((q + 1) / seg) * Math.PI * 2;
      const tz = F.P(0, 0, 1);
      const vx = tz[0] - o[0], vz = tz[2] - o[2];
      const pt = (a, off) => [p[0] + vx * Math.cos(a) * r + ux * off, p[1] + Math.sin(a) * r, p[2] + vz * Math.cos(a) * r + uz * off];
      quadFacing(acc, pt(a0, -th), pt(a1, -th), pt(a1, th), pt(a0, th), [vx * Math.cos((a0 + a1) / 2), Math.sin((a0 + a1) / 2), vz * Math.cos((a0 + a1) / 2)]);
      quadFacing(acc, pt(a0, th), pt(a1, th), [p[0] + ux * th, p[1], p[2] + uz * th], [p[0] + ux * th, p[1], p[2] + uz * th], [ux, 0, uz]);
    }
  }
  // the wheel pit (stone kerb, dark water), the flume out of the levee on trestles
  const wx = it.wheel, R = 2.7, ay = g + 2.25, wz = hd + 0.95;
  {
    S.col = [0.72, 0.68, 0.6];
    const x0 = wx - 3.4, x1 = wx + 3.4, z0 = hd + 0.1, z1 = hd + 1.9;
    for (const [a, b, n] of [[[x0, z1], [x1, z1], [0, 1]], [[x1, z0], [x1, z1], [1, 0]], [[x0, z1], [x0, z0], [-1, 0]]]) {
      const nn = F.P(n[0], 0, n[1]), o = F.P(0, 0, 0);
      quadFacing(S, at(a[0], g - 0.6, a[1]), at(b[0], g - 0.6, b[1]), at(b[0], g + 0.35, b[1]), at(a[0], g + 0.35, a[1]), [nn[0] - o[0], 0, nn[2] - o[2]]);
    }
    K.water.col = [0.7, 0.75, 0.8];
    quadFacing(K.water, at(x0, g - 0.25, z0), at(x1, g - 0.25, z0), at(x1, g - 0.25, z1), at(x0, g - 0.25, z1), [0, 1, 0]);
    // the tail race: a stone channel down along the levee's foot to a culvert
    const t0 = x1, t1 = x1 + 6.5, lv = it.levee;
    K.water.col = [0.8, 0.85, 0.9];
    quadFacing(K.water, at(t0, g - 0.3, z0 + 0.3), at(t1, g - 0.3, lv - 0.2), at(t1 + 1.2, g - 0.3, lv - 0.2), at(t0 + 0.2, g - 0.3, z1), [0, 1, 0]);
    win.col = [0.6, 0.6, 0.6];
    const cA = at(t1 + 1.3, g - 0.4, lv - 0.03), cB = at(t1 - 0.3, g - 0.4, lv - 0.03);
    const nn = F.P(0, 0, -1), o = F.P(0, 0, 0);
    quadFacing(win, cA, cB, [cB[0], g + 1.4, cB[2]], [cA[0], g + 1.4, cA[2]], [nn[0] - o[0], 0, nn[2] - o[2]], otwUV('a_dark'));
  }
  {
    // the flume: from a sluice in the levee's face to the wheel's upstream side
    const a = [wx - 7.4, lv0(it)], b = [wx - R - 0.15, wz];
    const y0 = g + 2.35, y1 = g + 2.2;
    const dx = b[0] - a[0], dz = b[1] - a[1], l = Math.hypot(dx, dz), px = -dz / l * 0.48, pz = dx / l * 0.48;
    const Pw = K.paint;
    Pw.col = [0.32, 0.22, 0.14];
    const c0 = (sx, y, t) => at(a[0] + dx * t + px * sx, y, a[1] + dz * t + pz * sx);
    const ya = (t) => y0 + (y1 - y0) * t;
    // floor (underside dark), the two sides (both faces)
    quadFacing(Pw, c0(-1, ya(0), 0), c0(1, ya(0), 0), c0(1, ya(1), 1), c0(-1, ya(1), 1), [0, -1, 0]);
    for (const sx of [-1, 1]) {
      const nn = F.P(px * sx, 0, pz * sx), o = F.P(0, 0, 0);
      const n = [nn[0] - o[0], 0, nn[2] - o[2]];
      quadFacing(Pw, c0(sx, ya(0), 0), c0(sx, ya(1), 1), c0(sx, ya(1) + 0.55, 1), c0(sx, ya(0) + 0.55, 0), n);
      quadFacing(Pw, c0(sx * 0.92, ya(0), 0), c0(sx * 0.92, ya(1), 1), c0(sx * 0.92, ya(1) + 0.55, 1), c0(sx * 0.92, ya(0) + 0.55, 0), [-n[0], 0, -n[2]]);
    }
    K.water.col = [0.85, 0.9, 0.95];
    quadFacing(K.water, c0(-0.9, ya(0) + 0.35, 0), c0(0.9, ya(0) + 0.35, 0), c0(0.9, ya(1) + 0.35, 1), c0(-0.9, ya(1) + 0.35, 1), [0, 1, 0]);
    // trestles
    N.paint.col = [0.3, 0.2, 0.12];
    for (const t of [0.35, 0.75]) {
      for (const sx of [-1, 1]) { const p = c0(sx, ya(t), t); N.paint.beam(p[0], g - 0.2, p[2], p[0], p[1], p[2], 0.16, 0.16); }
    }
    // the sluice gate in the levee face
    Pw.col = [0.26, 0.18, 0.12];
    const sp = c0(0, ya(0), 0);
    box(Pw, sp[0], ya(0) - 0.2, sp[2], 1.6, 1.6, 0.3, it.ry + Math.atan2(dx, dz), { u: 1 });
    // water spilling onto the wheel: a sheet down its upstream side to the pit
    K.water.col = [0.95, 0.97, 1];
    const sx0 = wx - R - 0.2;
    for (let q = 0; q < 3; q++) {
      const a0 = Math.PI * (1 + q / 6), a1 = Math.PI * (1 + (q + 1) / 6);
      const p0 = [wx + Math.cos(a0) * (R + 0.15), ay + Math.sin(a0) * (R + 0.15) + (q === 0 ? 0.25 : 0)], p1 = [wx + Math.cos(a1) * (R + 0.15), ay + Math.sin(a1) * (R + 0.15)];
      const nn = F.P(-1, 0, 0), o = F.P(0, 0, 0);
      quadFacing(K.water, at(p0[0], p0[1], wz - 0.55), at(p1[0], p1[1], wz - 0.55), at(p1[0], p1[1], wz + 0.55), at(p0[0], p0[1], wz + 0.55), [nn[0] - o[0], 0.3, nn[2] - o[2]]);
    }
    void sx0;
  }
  // the axle into the wall, its bearing block
  N.paint.col = [0.2, 0.18, 0.16];
  N.paint.beam(...at(wx, ay, hd - 0.1), ...at(wx, ay, wz + 0.95), 0.3, 0.3);
  // the wheel: its own mesh, turning
  const acc = new Acc(true);
  wheelGeo(acc, R, 1.3, 16);
  const mesh = new THREE.Mesh(acc.toGeometry(true), M.paint);
  mesh.matrixAutoUpdate = true;
  const wp = at(wx, ay, wz);
  mesh.position.set(wp[0], wp[1], wp[2]);
  // local z (the axle) along the wall's normal; local x along the wall
  const ax = F.P(0, 0, 1), o = F.P(0, 0, 0);
  const azx = ax[0] - o[0], azz = ax[2] - o[2];
  mesh.rotation.order = 'YXZ';
  mesh.rotation.y = Math.atan2(azx, azz);
  // the upstream side (local −x of the mill) goes down
  const lxw = [Math.cos(mesh.rotation.y), -Math.sin(mesh.rotation.y)];
  const up = F.P(-1, 0, 0);
  const spin = lxw[0] * (up[0] - o[0]) + lxw[1] * (up[2] - o[2]) > 0 ? -1 : 1;
  B.group.add(mesh);
  B.anim((t, dt, dist) => { if (dist < 320) mesh.rotation.z = spin * t * 0.55; });
}

/** The levee face's local z for the flume's start (it.levee, kept off the wall a little). */
const lv0 = (it) => it.levee - 0.1;

/** A water wheel in its own frame: the wheel in local x/y, the axle along z. */
function wheelGeo(acc, R, W, n) {
  const hz = W / 2;
  // two rims (both faces each), the paddles between them, spokes to the hub
  for (const zz of [-hz, hz]) {
    for (let k = 0; k < n; k++) {
      const a0 = (k / n) * Math.PI * 2, a1 = ((k + 1) / n) * Math.PI * 2;
      const o0 = [Math.cos(a0) * R, Math.sin(a0) * R], o1 = [Math.cos(a1) * R, Math.sin(a1) * R];
      const i0 = [Math.cos(a0) * (R - 0.32), Math.sin(a0) * (R - 0.32)], i1 = [Math.cos(a1) * (R - 0.32), Math.sin(a1) * (R - 0.32)];
      acc.col = [0.3, 0.2, 0.13];
      quadFacing(acc, [i0[0], i0[1], zz], [i1[0], i1[1], zz], [o1[0], o1[1], zz], [o0[0], o0[1], zz], [0, 0, zz > 0 ? 1 : -1]);
      quadFacing(acc, [i0[0], i0[1], zz - Math.sign(zz) * 0.1], [i1[0], i1[1], zz - Math.sign(zz) * 0.1], [o1[0], o1[1], zz - Math.sign(zz) * 0.1], [o0[0], o0[1], zz - Math.sign(zz) * 0.1], [0, 0, zz > 0 ? -1 : 1]);
      // the rim's outer band
      acc.col = [0.24, 0.16, 0.1];
      quadFacing(acc, [o0[0], o0[1], zz - Math.sign(zz) * 0.1], [o1[0], o1[1], zz - Math.sign(zz) * 0.1], [o1[0], o1[1], zz], [o0[0], o0[1], zz], [Math.cos((a0 + a1) / 2), Math.sin((a0 + a1) / 2), 0]);
    }
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2 + 0.2;
      acc.col = [0.28, 0.19, 0.12];
      acc.beam(Math.cos(a) * 0.3, Math.sin(a) * 0.3, zz * 0.85, Math.cos(a) * (R - 0.3), Math.sin(a) * (R - 0.3), zz * 0.85, 0.14, 0.1);
    }
  }
  for (let k = 0; k < n; k++) {
    const a = (k / n) * Math.PI * 2;
    const ca = Math.cos(a), sa = Math.sin(a);
    const p0 = [ca * (R - 0.75), sa * (R - 0.75)], p1 = [ca * (R + 0.08), sa * (R + 0.08)];
    acc.col = [0.36, 0.25, 0.16];
    const tn = [-sa, ca, 0];
    quadFacing(acc, [p0[0], p0[1], -hz], [p1[0], p1[1], -hz], [p1[0], p1[1], hz], [p0[0], p0[1], hz], tn);
    const e = 0.05;
    quadFacing(acc, [p0[0] - tn[0] * e, p0[1] - tn[1] * e, -hz], [p1[0] - tn[0] * e, p1[1] - tn[1] * e, -hz], [p1[0] - tn[0] * e, p1[1] - tn[1] * e, hz], [p0[0] - tn[0] * e, p0[1] - tn[1] * e, hz], [-tn[0], -tn[1], 0]);
  }
  // the hub
  acc.col = [0.18, 0.15, 0.12];
  for (let k = 0; k < 8; k++) {
    const a0 = (k / 8) * Math.PI * 2, a1 = ((k + 1) / 8) * Math.PI * 2;
    const r = 0.42;
    quadFacing(acc, [Math.cos(a0) * r, Math.sin(a0) * r, -hz * 0.9], [Math.cos(a1) * r, Math.sin(a1) * r, -hz * 0.9], [Math.cos(a1) * r, Math.sin(a1) * r, hz * 0.9], [Math.cos(a0) * r, Math.sin(a0) * r, hz * 0.9], [Math.cos((a0 + a1) / 2), Math.sin((a0 + a1) / 2), 0]);
  }
}

function mulberry(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ------------------------------------------------------------------ street furniture

/** A newspaper kiosk: green panels, the lit band, a domed roof with a finial. */
export function kiosk(K, x, y, z, ry) {
  const P = K.paint;
  const c = Math.cos(ry), s = Math.sin(ry);
  const L = (lx, lz) => [x + lx * c + lz * s, z - lx * s + lz * c];
  P.col = [0.13, 0.27, 0.19];
  box(P, x, y, z, 2.6, 2.3, 1.9, ry, { u: 1 });
  // the counter opening (lit), magazines on show
  const front = (lx0, lx1, y0, y1, uvAcc, uv) => {
    const A = L(lx0, 0.97), Bq = L(lx1, 0.97);
    uvAcc.quadP([A[0], y0, A[1]], [Bq[0], y0, Bq[1]], [Bq[0], y1, Bq[1]], [A[0], y1, A[1]], uv);
  };
  K.win.col = [1, 1, 1];
  front(-1.0, 1.0, y + 0.9, y + 2.0, K.win, otwUV('d_lit'));
  // the band all round under the roof
  for (const [lx0, lz0, lx1, lz1] of [[-1.35, 1.0, 1.35, 1.0], [1.35, -1.0, -1.35, -1.0], [1.35, 1.0, 1.35, -1.0], [-1.35, -1.0, -1.35, 1.0]]) {
    const A = L(lx0, lz0), Bq = L(lx1, lz1);
    K.sign.quadP([A[0], y + 2.3, A[1]], [Bq[0], y + 2.3, Bq[1]], [Bq[0], y + 2.75, Bq[1]], [A[0], y + 2.75, A[1]], otsgUV('journaux'));
  }
  P.col = [0.15, 0.3, 0.21];
  box(P, x, y + 2.75, z, 3.0, 0.14, 2.3, ry, { u: 1 });
  K.slate.col = [0.3, 0.46, 0.4];
  gable(K.slate, x, y + 2.89, z, 3.0, 2.3, 0.9, ry, { over: 0.15, u: 2 });
  P.col = [0.75, 0.62, 0.3];
  cylinder(P, x, y + 3.75, z, 0.06, 0.5, 4);
  sphere(P, x, y + 4.3, z, 0.12, 5);
}

/** A Morris column: plinth, the poster drum (glows), a fringed cap, a little dome. */
export function morris(K, x, y, z, ry) {
  const P = K.paint;
  P.col = [0.13, 0.26, 0.18];
  cylinder(P, x, y, z, 0.78, 0.5, 8, { top: false });
  // eight poster panels round the drum
  const r = 0.66, seg = 8;
  for (let k = 0; k < seg; k++) {
    const a0 = ry + (k / seg) * Math.PI * 2, a1 = ry + ((k + 1) / seg) * Math.PI * 2;
    const A = [x + Math.cos(a1) * r, z + Math.sin(a1) * r], Bq = [x + Math.cos(a0) * r, z + Math.sin(a0) * r];
    K.sign.quadP([A[0], y + 0.5, A[1]], [Bq[0], y + 0.5, Bq[1]], [Bq[0], y + 2.9, Bq[1]], [A[0], y + 2.9, A[1]], otsgUV('p' + (k % 4)));
  }
  P.col = [0.13, 0.26, 0.18];
  cylinder(P, x, y + 2.9, z, 0.8, 0.35, 8, { top: false });
  cylinder(P, x, y + 3.25, z, 0.8, 0.12, 8, { r2: 0.55, top: false });
  K.slate.col = [0.24, 0.4, 0.32];
  sphere(K.slate, x, y + 3.3, z, 0.6, 8, { sy: 0.9 });
  P.col = [0.75, 0.62, 0.3];
  cylinder(P, x, y + 3.85, z, 0.05, 0.45, 4);
}

/** A cast-iron bollard (close up only). */
export function bollard(K, x, y, z) {
  const N = K.near.paint;
  N.col = IRON;
  cylinder(N, x, y, z, 0.13, 0.75, 6, { r2: 0.1 });
  cylinder(N, x, y + 0.75, z, 0.14, 0.08, 6);
  sphere(N, x, y + 0.86, z, 0.1, 5);
}

/** A bouquiniste's box on a parapet: green, its lid shut, or propped open on its books. */
export function bookBox(K, x, y, z, ry, open) {
  const N = K.near;
  N.paint.col = [0.13, 0.28, 0.2];
  box(N.paint, x, y, z, 1.9, 0.55, 0.62, ry, { u: 1 });
  const c = Math.cos(ry), s = Math.sin(ry);
  if (!open) {
    box(N.paint, x, y + 0.55, z, 1.95, 0.1, 0.66, ry, { u: 1 });
    return;
  }
  // the books (a colour band), the lid stood up behind them
  N.leaf.col = [[0.6, 0.2, 0.15], [0.2, 0.3, 0.5], [0.75, 0.62, 0.3]][Math.floor(Math.abs(x * 3 + z)) % 3];
  box(N.leaf, x, y + 0.55, z, 1.8, 0.06, 0.55, ry, { u: 1 });
  const bx = x - s * 0.34, bz = z - c * 0.34;
  N.paint.col = [0.13, 0.28, 0.2];
  box(N.paint, bx, y + 0.55, bz, 1.95, 0.7, 0.06, ry, { u: 1 });
}

/**
 * A road's gas lamp, dressed: the fluted cast-iron base, a ladder bar, the
 * lantern's cage round its glass and a cap with a finial (close up only).
 */
export function gasLamp(K, L) {
  const N = K.near.paint;
  N.col = IRON;
  const x = L.x, y = L.y, z = L.z, hy = L.hy;
  // (a hundred-odd of these a cell: kept to some eighty vertices each)
  cylinder(N, x, y, z, 0.2, 1.2, 6, { r2: 0.1 });
  const a = L.ry || 0, ca = Math.cos(a), sa = Math.sin(a);
  N.beam(x - ca * 0.42, hy - 1.55, z + sa * 0.42, x + ca * 0.42, hy - 1.55, z - sa * 0.42, 0.05, 0.05);
  cylinder(N, x, hy - 0.95, z, 0.1, 0.2, 4, { r2: 0.27 });
  // the cap: a pyramid square to the glass, a finial
  const r = 0.34, y0 = hy - 0.2, y1 = hy + 0.2;
  for (const [ax, az, bx, bz] of [[-1, 1, 1, 1], [1, 1, 1, -1], [1, -1, -1, -1], [-1, -1, -1, 1]]) {
    const i0 = N.v(x + ax * r, y0, z + az * r), i1 = N.v(x + bx * r, y0, z + bz * r), i2 = N.v(x, y1, z);
    N.tri(i0, i1, i2);
  }
  cylinder(N, x, y1 - 0.02, z, 0.03, 0.24, 3);
}

export { lantern };
