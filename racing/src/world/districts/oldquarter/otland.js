// PORT HALCYON — OLD TOWN's landmarks: ST. CECILIA'S (a Gothic cathedral:
// twin west towers, a rose over the portals, nave and aisles under flying
// buttresses, the transept, a lead spire over the crossing, the apse), the
// cathedral square with its carousel, the CLOCK TOWER over the market
// square and its stalls, the walled garden with its bandstand. Each is laid
// out in its own frame (x along the grid's streets across the river, z
// down it) from the plan item's origin.
import * as THREE from 'three';
import { box, cylinder, cone, sphere, prism, gable, drape } from '../builder.js';
import { frame, edgeFace, fquad, pyramid, catenary, cross, broadTree, bush } from './geo.js';
import { otwUV } from './ottex.js';
import { metalUV } from './tex.js';
import { lampPost, statue } from './riverbuild.js';
import { Acc } from '../../build/geo.js';

const LEAD = [0.36, 0.39, 0.45];
const CREAM = [0.86, 0.82, 0.74];

/** A face of a local frame: the plane at `c` on an axis ('x' or 'z'), facing sign. a runs left→right seen from outside. */
function lf(F, axis, sign, c, lo, hi) {
  if (axis === 'z') return sign > 0 ? edgeFace(F.X(lo, c), F.X(hi, c)) : edgeFace(F.X(hi, c), F.X(lo, c));
  return sign > 0 ? edgeFace(F.X(c, hi), F.X(c, lo)) : edgeFace(F.X(c, lo), F.X(c, hi));
}
/** A box in a frame (base centre lx, ly, lz; w along x, d along z). */
function lbox(acc, F, lx, ly, lz, w, h, d, o) {
  const p = F.P(lx, ly, lz);
  box(acc, p[0], p[1], p[2], w, h, d, F.ry, o);
}

// ------------------------------------------------------------------ the cathedral

/**
 * ST. CECILIA'S. it: { x, z (the west front's middle), g (ground), ry }.
 * x runs east from the west front to the apse (92 m), z across.
 */
export function cathedral(K, it) {
  const F = frame(it.x, it.g, it.z, it.ry);
  const S = K.stone, R = K.slate, Wn = K.win;
  const g = it.g;
  S.col = CREAM;
  // the west towers, the front between them
  for (const zs of [-1, 1]) {
    lbox(S, F, 5.5, -1, zs * 11.5, 11, 49, 11, { u: 2.4 });
    // buttressed corners, a belfry stage, a balustrade, pinnacles and a stone spire
    for (const [cx, cz] of [[0, 6], [11, 6], [0, 17], [11, 17]]) {
      lbox(S, F, cx, -1, zs * cz, 1.6, 44, 1.6, { u: 2.4 });
      const p = F.P(cx, 48, zs * cz);
      cone(S, p[0], p[1], p[2], 0.9, 7, 6);
    }
    S.col = [CREAM[0] * 0.92, CREAM[1] * 0.92, CREAM[2] * 0.9];
    lbox(S, F, 5.5, 48, zs * 11.5, 12, 0.8, 12, { u: 2.4 });
    S.col = CREAM;
    const sp = F.P(5.5, 48.8, zs * 11.5);
    R.col = LEAD;
    pyramid(R, octagon(sp[0], sp[2], 4.2, F.ry), sp[1], 15, 2);
    K.glow.col = [1, 1, 1];
    box(K.glow, sp[0], sp[1] + 15, sp[2], 0.25, 1.4, 0.25, F.ry, { u: 1 });
    // belfry openings (dark) on the three outer faces, lancets lower down
    for (const [axis, sign, c, lo, hi] of [['x', -1, 0, zs > 0 ? 6 : -17, zs > 0 ? 17 : -6], ['z', zs, zs * 17, 0, 11], ['x', 1, 11, zs > 0 ? 6 : -17, zs > 0 ? 17 : -6]]) {
      const f = lf(F, axis, sign, c, lo, hi);
      if (axis === 'x' && sign > 0) continue;
      Wn.col = [1, 1, 1];
      for (const a of [f.len * 0.3, f.len * 0.7]) {
        fquad(Wn, f, a - 1.3, a + 1.3, g + 34, g + 45, 0.05, otwUV('a_dark'));
        fquad(Wn, f, a - 1.0, a + 1.0, g + 20, g + 27, 0.05, otwUV('lancet'));
      }
    }
    // a side portal at the foot of each tower
    const f = lf(F, 'x', -1, 0, zs > 0 ? 6 : -17, zs > 0 ? 17 : -6);
    Wn.col = [1, 1, 1];
    fquad(Wn, f, f.len / 2 - 2.6, f.len / 2 + 2.6, g, g + 7.5, 0.06, otwUV('portal'));
  }
  // the front between the towers: the great portal, a gallery, the rose, a gable
  lbox(S, F, 1.5, -1, 0, 3, 32, 12, { u: 2.4 });
  const front = lf(F, 'x', -1, 0, -6, 6);
  Wn.col = [1, 1, 1];
  fquad(Wn, front, 6 - 4, 6 + 4, g, g + 10, 0.06, otwUV('portal'));
  for (let k = 0; k < 6; k++) fquad(Wn, front, 0.6 + k * 1.8, 1.8 + k * 1.8, g + 12.2, g + 14.4, 0.05, otwUV('a_dark'));
  fquad(Wn, front, 6 - 5, 6 + 5, g + 16.5, g + 26.5, 0.07, otwUV('rose'));
  S.col = CREAM;
  const gp = F.P(1.5, 31, 0);
  gable(S, gp[0], gp[1], gp[2], 3, 12, 9, F.ry, { over: 0, u: 2.4, endAcc: S });
  // nave, aisles, transept, choir: walls, windows, roofs
  hall(K, F, g, 11, 58, 6, 26, 11);                 // nave
  hall(K, F, g, 70, 84, 6, 26, 11);                 // choir
  aisle(K, F, g, 11, 58, 1);
  aisle(K, F, g, 11, 58, -1);
  aisle(K, F, g, 70, 84, 1);
  aisle(K, F, g, 70, 84, -1);
  // the transept (its ridge across), rose windows in its ends
  S.col = CREAM;
  lbox(S, F, 64, -1, 0, 12, 27, 44, { u: 2.4, top: false });
  const tp = F.P(64, 26, 0);
  R.col = LEAD;
  gable(R, tp[0], tp[1], tp[2], 44, 12, 11, F.ry + Math.PI / 2, { over: 0.4, u: 2, endAcc: S });
  for (const zs of [1, -1]) {
    const f = lf(F, 'z', zs, zs * 22, 58, 70);
    Wn.col = [1, 1, 1];
    fquad(Wn, f, 6 - 4.2, 6 + 4.2, g + 14, g + 22.4, 0.06, otwUV('rose'));
    fquad(Wn, f, 6 - 2.4, 6 + 2.4, g, g + 7, 0.06, otwUV('portal'));
    for (const a of [2, 10]) fquad(Wn, f, a - 0.9, a + 0.9, g + 4, g + 11, 0.05, otwUV('lancet2'));
    S.col = CREAM;
    for (const cx of [58, 70]) lbox(S, F, cx, -1, zs * 22, 1.8, 30, 1.8, { u: 2.4 });
  }
  // the crossing: a lantern stage and the lead spire with its gold cross
  S.col = CREAM;
  lbox(S, F, 64, 26, 0, 12.4, 12, 12.4, { u: 2.4 });
  for (const [axis, sign, c] of [['x', -1, 57.8], ['x', 1, 70.2], ['z', 1, 6.2], ['z', -1, -6.2]]) {
    const f = axis === 'x' ? lf(F, 'x', sign, c, -6.2, 6.2) : lf(F, 'z', sign, c, 57.8, 70.2);
    Wn.col = [1, 1, 1];
    for (const a of [3.1, 6.2, 9.3]) fquad(Wn, f, a - 0.9, a + 0.9, g + 29, g + 36, 0.05, otwUV('lancet'));
  }
  const sb = F.P(64, 38, 0);
  R.col = LEAD;
  cylinder(R, sb[0], sb[1], sb[2], 5.6, 3, 8, { r2: 5.2 });
  cone(R, sb[0], sb[1] + 3, sb[2], 5.2, 60, 8);
  // little gabled lucarnes round the spire's foot
  for (let k = 0; k < 4; k++) {
    const a = F.ry + k * Math.PI / 2;
    const px = sb[0] + Math.sin(a) * 4.6, pz = sb[2] + Math.cos(a) * 4.6;
    box(R, px, sb[1] + 3, pz, 1.6, 2.6, 1.6, a, { u: 1 });
    cone(R, px, sb[1] + 5.6, pz, 1.2, 2.2, 4);
  }
  K.glow.col = [1, 1, 1];
  box(K.glow, sb[0], sb[1] + 62.5, sb[2], 0.3, 3.2, 0.3, F.ry, { u: 1 });
  box(K.glow, sb[0], sb[1] + 64.3, sb[2], 1.6, 0.3, 0.3, F.ry, { u: 1 });
  // the apse: a half decagon, its roof, chapels round it under a lean-to
  const apse = [];
  for (let k = 0; k <= 5; k++) { const a = -Math.PI / 2 + (k / 5) * Math.PI; apse.push(F.X(84 + Math.cos(a) * 6, Math.sin(a) * 6)); }
  S.col = CREAM;
  prism(S, apse, 0, 0, g - 1, g + 26, 0, { u: 2.4, top: false });
  const apex = F.P(84, 37, 0);
  R.col = LEAD;
  for (let k = 0; k < 5; k++) {
    const a = apse[k], b = apse[k + 1];
    const i0 = R.v(a[0], g + 26, a[1], 0, 0), i1 = R.v(b[0], g + 26, b[1], 1, 0), i2 = R.v(apex[0], apex[1], apex[2], 0.5, 3);
    R.tri(i0, i2, i1);
  }
  const amb = [];
  for (let k = 0; k <= 7; k++) { const a = -Math.PI / 2 + (k / 7) * Math.PI; amb.push(F.X(84 + Math.cos(a) * 12, Math.sin(a) * 12)); }
  S.col = CREAM;
  prism(S, amb, 0, 0, g - 1, g + 11, 0, { u: 2.4, top: false });
  R.col = LEAD;
  for (let k = 0; k < 7; k++) {
    const a = amb[k], b = amb[k + 1];
    const ia = F.X(84 + Math.cos(-Math.PI / 2 + (k / 7) * Math.PI) * 6, Math.sin(-Math.PI / 2 + (k / 7) * Math.PI) * 6);
    const ib = F.X(84 + Math.cos(-Math.PI / 2 + ((k + 1) / 7) * Math.PI) * 6, Math.sin(-Math.PI / 2 + ((k + 1) / 7) * Math.PI) * 6);
    R.quadP([b[0], g + 11, b[1]], [a[0], g + 11, a[1]], [ia[0], g + 15, ia[1]], [ib[0], g + 15, ib[1]], [0, 0, 2, 2]);
    // a lancet in each chapel
    const f = edgeFace(b, a);
    Wn.col = [1, 1, 1];
    fquad(Wn, f, f.len / 2 - 0.9, f.len / 2 + 0.9, g + 3, g + 9, 0.05, otwUV(k % 2 ? 'lancet' : 'lancet2'));
    const f2 = edgeFace(ib, ia);
    if (k > 0 && k < 6) fquad(Wn, f2, f2.len / 2 - 0.9, f2.len / 2 + 0.9, g + 16, g + 23, 0.05, otwUV('lancet'));
  }
  // flying buttresses down both sides
  for (const zs of [1, -1]) {
    for (const bx of [14, 19.5, 25, 30.5, 36, 41.5, 47, 52.5, 72.5, 78]) {
      S.col = CREAM;
      lbox(S, F, bx, -1, zs * 13.4, 1.4, 19, 1.8, { u: 2.4 });
      const pt = F.P(bx, 18, zs * 13.4);
      cone(S, pt[0], pt[1], pt[2], 0.85, 4.2, 4);
      const a = F.P(bx, 16.5, zs * 12.6), b = F.P(bx, 22.5, zs * 6.4);
      S.beam(a[0], a[1], a[2], b[0], b[1], b[2], 0.55, 0.85);
    }
  }
}

function octagon(x, z, r, ry) {
  const out = [];
  for (let k = 0; k < 8; k++) { const a = ry + (k / 8) * Math.PI * 2 + Math.PI / 8; out.push([x + Math.cos(a) * r, z - Math.sin(a) * r]); }
  return out;
}

/** A tall vessel (nave, choir): walls x0→x1, half width hw, height h, a steep roof; clerestory lancets. */
function hall(K, F, g, x0, x1, hw, h, rise) {
  const S = K.stone, R = K.slate;
  S.col = CREAM;
  lbox(S, F, (x0 + x1) / 2, -1, 0, x1 - x0, h + 1, 2 * hw, { u: 2.4, top: false });
  R.col = LEAD;
  const p = F.P((x0 + x1) / 2, h, 0);
  gable(R, p[0], p[1], p[2], x1 - x0, 2 * hw, rise, F.ry, { over: 0.3, u: 2, endAcc: S });
  for (const zs of [1, -1]) {
    const f = lf(F, 'z', zs, zs * hw, x0, x1);
    K.win.col = [1, 1, 1];
    for (let a = 2.75; a < f.len - 1; a += 5.5) fquad(K.win, f, a - 1.2, a + 1.2, g + 15.5, g + 23.5, 0.05, otwUV('lancet'));
  }
}

/** An aisle along a vessel: walls to 12 m, a lean-to roof up to the clerestory, lancets. */
function aisle(K, F, g, x0, x1, zs) {
  const S = K.stone, R = K.slate;
  S.col = CREAM;
  lbox(S, F, (x0 + x1) / 2, -1, zs * 9, x1 - x0, 13, 6, { u: 2.4, top: false });
  R.col = LEAD;
  const a = F.P(x0, 12, zs * 12.4), b = F.P(x1, 12, zs * 12.4), c = F.P(x1, 15.5, zs * 6), d = F.P(x0, 15.5, zs * 6);
  if (zs > 0) R.quadP(a, b, c, d, [0, 0, (x1 - x0) / 2, 3.5]); else R.quadP(b, a, d, c, [0, 0, (x1 - x0) / 2, 3.5]);
  const f = lf(F, 'z', zs, zs * 12, x0, x1);
  K.win.col = [1, 1, 1];
  for (let q = 2.75; q < f.len - 1; q += 5.5) fquad(K.win, f, q - 1.0, q + 1.0, g + 3, g + 9.5, 0.05, otwUV(Math.floor(q / 5.5) % 2 ? 'lancet' : 'lancet2'));
}

// ------------------------------------------------------------------ squares

/** A paved square (drape) with an edge kerb. it.poly: world [x, z]. */
export function paved(K, B, poly, mat = 'pave') {
  drape(K[mat], B, poly, { lift: 0.07, step: 6, uv: 3 });
}

/** A stone fountain: a round basin, a column, a bowl, water glinting. */
export function fountain(K, x, y, z, r = 5) {
  const S = K.stone;
  S.col = [0.84, 0.8, 0.72];
  cylinder(S, x, y - 0.3, z, r, 1.0, 14, { u: 2 });
  cylinder(S, x, y + 0.7, z, r + 0.25, 0.14, 14, { top: false });
  K.water.col = [1, 1, 1];
  cylinder(K.water, x, y + 0.45, z, r - 0.3, 0.01, 14, { top: true });
  S.col = [0.86, 0.82, 0.75];
  cylinder(S, x, y + 0.4, z, 0.55, 3.2, 8, { r2: 0.4 });
  cylinder(S, x, y + 3.2, z, 0.25, 0.4, 8, { r2: 1.8 });
  cylinder(S, x, y + 3.6, z, 1.8, 0.25, 10, { top: true });
  cylinder(S, x, y + 3.85, z, 0.3, 1.2, 6, { r2: 0.12 });
  K.water.col = [1, 1, 1];
  cone(K.water, x, y + 3.6, z, 1.7, 0.9, 10);
}

/** A carousel: platform, striped canopy, bulbs round the rim; its horses turn (B.group). */
export function carousel(K, B, x, y, z, M) {
  const P = K.paint, N = K.near;
  P.col = [0.55, 0.12, 0.14];
  cylinder(P, x, y - 0.2, z, 6.4, 0.8, 16, { top: true });
  P.col = [0.92, 0.82, 0.5];
  cylinder(P, x, y, z, 0.6, 5.6, 8);
  // the canopy: alternating red and cream segments
  for (let k = 0; k < 16; k++) {
    const a0 = (k / 16) * Math.PI * 2, a1 = ((k + 1) / 16) * Math.PI * 2;
    P.col = k % 2 ? [0.92, 0.88, 0.76] : [0.72, 0.1, 0.12];
    const r = 6.8, y0 = y + 4.6, y1 = y + 7.4;
    P.quadP([x + Math.cos(a1) * r, y0, z + Math.sin(a1) * r], [x + Math.cos(a0) * r, y0, z + Math.sin(a0) * r], [x, y1, z], [x, y1, z]);
    P.quadP([x + Math.cos(a0) * r, y0 - 0.6, z + Math.sin(a0) * r], [x + Math.cos(a1) * r, y0 - 0.6, z + Math.sin(a1) * r], [x + Math.cos(a1) * r, y0, z + Math.sin(a1) * r], [x + Math.cos(a0) * r, y0, z + Math.sin(a0) * r]);
    // underside
    P.col = [0.3, 0.06, 0.08];
    P.quadP([x + Math.cos(a0) * r, y0, z + Math.sin(a0) * r], [x + Math.cos(a1) * r, y0, z + Math.sin(a1) * r], [x, y0 + 1.2, z], [x, y0 + 1.2, z]);
    K.glow.col = [1, 1, 1];
    const bx = x + Math.cos(a0) * r, bz = z + Math.sin(a0) * r;
    cross(K.glow, bx, y0 - 0.75, bz, 0.12, 0.24);
  }
  P.col = [0.92, 0.8, 0.4];
  sphere(P, x, y + 7.4, z, 0.5, 6);
  // the turning ring: poles and horses, its own mesh spun each frame
  const acc = new Acc(true);
  for (let k = 0; k < 12; k++) {
    const a = (k / 12) * Math.PI * 2;
    const hx = Math.cos(a) * 4.4, hz = Math.sin(a) * 4.4;
    acc.col = [0.9, 0.78, 0.4];
    cylinder(acc, hx, 0.6, hz, 0.05, 3.9, 4);
    acc.col = k % 3 === 0 ? [0.95, 0.94, 0.9] : k % 3 === 1 ? [0.35, 0.22, 0.14] : [0.2, 0.2, 0.22];
    const bob = (k % 2) * 0.35;
    box(acc, hx, 1.2 + bob, hz, 0.4, 0.7, 1.5, -a, { u: 1 });
    box(acc, hx + Math.cos(a + Math.PI / 2) * 0.62, 1.7 + bob, hz + Math.sin(a + Math.PI / 2) * 0.62, 0.3, 0.75, 0.36, -a, { u: 1 });
    void N;
  }
  const mesh = new THREE.Mesh(acc.toGeometry(true), M.paint);
  mesh.position.set(x, y, z);
  mesh.matrixAutoUpdate = true;
  B.group.add(mesh);
  B.anim((t, dt, d) => { if (d < 400) mesh.rotation.y = t * 0.35; });
}

/** A market stall: a trestle of produce under a striped pitched canopy. */
export function stall(K, x, y, z, ry, w, d, col, rng) {
  const P = K.paint, N = K.near;
  const c = Math.cos(ry), s = Math.sin(ry);
  const W = (lx, lz) => [x + lx * c + lz * s, z - lx * s + lz * c];
  N.paint.col = [0.3, 0.2, 0.12];
  for (const [lx, lz] of [[-w / 2, -d / 2], [w / 2, -d / 2], [-w / 2, d / 2], [w / 2, d / 2]]) {
    const p = W(lx, lz);
    box(N.paint, p[0], y, p[1], 0.1, 2.4, 0.1, ry, { u: 1, top: false });
  }
  P.col = [0.45, 0.32, 0.2];
  const t = W(0, d * 0.15);
  box(P, t[0], y, t[1], w - 0.2, 0.9, d * 0.6, ry, { u: 1 });
  // produce on the table
  const prod = [[0.85, 0.15, 0.1], [0.95, 0.7, 0.1], [0.4, 0.65, 0.2], [0.9, 0.45, 0.1], [0.6, 0.2, 0.5], [0.95, 0.9, 0.7]];
  for (let k = 0; k < 4; k++) {
    N.leaf.col = prod[Math.floor(rng() * prod.length)];
    const p = W(-w / 2 + 0.5 + k * (w - 1) / 3, d * 0.15);
    box(N.leaf, p[0], y + 0.9, p[1], (w - 1.2) / 4, 0.22, d * 0.5, ry, { u: 1 });
  }
  // the canopy: two slopes in stripes, both sides of each
  const n = 4;
  for (let k = 0; k < n; k++) {
    const a0 = -w / 2 - 0.2 + (k / n) * (w + 0.4), a1 = -w / 2 - 0.2 + ((k + 1) / n) * (w + 0.4);
    const cc = k % 2 ? [0.94, 0.92, 0.86] : col;
    for (const side of [1, -1]) {
      const e0 = W(a0, side * (d / 2 + 0.3)), e1 = W(a1, side * (d / 2 + 0.3)), r0 = W(a0, 0), r1 = W(a1, 0);
      P.col = cc;
      const A = [e0[0], y + 2.3, e0[1]], Bq = [e1[0], y + 2.3, e1[1]], C = [r1[0], y + 2.9, r1[1]], D = [r0[0], y + 2.9, r0[1]];
      if (side > 0) { P.quadP(Bq, A, D, C); P.col = [cc[0] * 0.5, cc[1] * 0.5, cc[2] * 0.5]; P.quadP(A, Bq, C, D); } else { P.quadP(A, Bq, C, D); P.col = [cc[0] * 0.5, cc[1] * 0.5, cc[2] * 0.5]; P.quadP(Bq, A, D, C); }
    }
  }
}

/** A clipped lime: a straight trunk and a box-cut crown. */
export function clippedTree(K, x, y, z, ry, s = 1) {
  K.paint.col = [0.36, 0.3, 0.24];
  cylinder(K.paint, x, y - 0.2, z, 0.18 * s, 3.2 * s, 5);
  K.leaf.col = [0.24, 0.38, 0.18];
  box(K.leaf, x, y + 2.8 * s, z, 3.2 * s, 2.8 * s, 3.2 * s, ry, { u: 1 });
}

/** A bench: cast-iron ends, wooden slats. */
export function bench(K, x, y, z, ry) {
  const N = K.near;
  const c = Math.cos(ry), s = Math.sin(ry);
  N.paint.col = [0.42, 0.28, 0.16];
  box(N.paint, x, y + 0.42, z, 1.8, 0.06, 0.45, ry, { u: 1 });
  const bk = [x - s * 0.22, z - c * 0.22];
  box(N.paint, bk[0], y + 0.55, bk[1], 1.8, 0.4, 0.05, ry, { u: 1 });
  N.paint.col = [0.08, 0.1, 0.09];
  for (const e of [-0.8, 0.8]) box(N.paint, x + c * e, y, z - s * e, 0.06, 0.95, 0.5, ry, { u: 1 });
}

// ------------------------------------------------------------------ the clock tower

/**
 * THE CLOCK TOWER: a brick shaft on a stone base, the clock stage (four lit
 * dials), the open belfry, a gallery, an octagonal lantern and a slate
 * spire with a gilt finial. Its hands turn (B.anim). it: { x, z, g, ry }.
 */
export function clockTower(K, B, it, M) {
  const F = frame(it.x, it.g, it.z, it.ry);
  const S = K.stone, Br = K.brick, R = K.slate, Wn = K.win;
  const g = it.g, w = 8.4;
  S.col = [0.82, 0.78, 0.7];
  lbox(S, F, 0, -1, 0, w + 0.8, 5.5, w + 0.8, { u: 2.4 });
  Br.col = [0.95, 0.85, 0.8];
  lbox(Br, F, 0, 4.5, 0, w, 24, w, { u: 2, top: false });
  S.col = [0.86, 0.82, 0.74];
  for (const [cx, cz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) lbox(S, F, cx * (w / 2 - 0.3), 4.5, cz * (w / 2 - 0.3), 0.9, 24, 0.9, { u: 2.4 });
  // the clock stage, a cornice, the belfry, the gallery
  lbox(S, F, 0, 28.5, 0, w + 0.6, 7, w + 0.6, { u: 2.4 });
  lbox(S, F, 0, 35.5, 0, w + 1.2, 0.5, w + 1.2, { u: 2.4 });
  lbox(S, F, 0, 36, 0, w, 6.5, w, { u: 2.4 });
  lbox(S, F, 0, 42.5, 0, w + 1.4, 0.6, w + 1.4, { u: 2.4 });
  const faces = [lf(F, 'z', 1, w / 2 + 0.3, -w / 2 - 0.3, w / 2 + 0.3), lf(F, 'z', -1, -w / 2 - 0.3, -w / 2 - 0.3, w / 2 + 0.3), lf(F, 'x', 1, w / 2 + 0.3, -w / 2 - 0.3, w / 2 + 0.3), lf(F, 'x', -1, -w / 2 - 0.3, -w / 2 - 0.3, w / 2 + 0.3)];
  const dials = [];
  for (const f of faces) {
    Wn.col = [1, 1, 1];
    fquad(Wn, f, f.len / 2 - 2.6, f.len / 2 + 2.6, g + 29.4, g + 34.6, 0.06, otwUV('clock'));
    dials.push(f);
    // belfry openings
    for (const a of [f.len * 0.3, f.len * 0.7]) fquad(Wn, f, a - 0.9, a + 0.9, g + 37, g + 41.8, -0.24, otwUV('a_dark'));
    // shuttered windows up the shaft
    for (const y of [10, 17, 23]) fquad(Wn, f, f.len / 2 - 0.6, f.len / 2 + 0.6, g + y, g + y + 2.4, -0.26, otwUV(y === 17 ? 'a_lit' : 'a_dark'));
  }
  // gallery balustrade (iron), the lantern, the spire
  for (const f of faces) {
    K.metal.col = [0.12, 0.12, 0.13];
    fquad(K.metal, f, -0.4, f.len + 0.4, g + 43.1, g + 44.1, 0.4, metalUV(0, f.len + 0.8, 2));
  }
  const top = F.P(0, 43.1, 0);
  S.col = [0.86, 0.82, 0.74];
  cylinder(S, top[0], top[1], top[2], 3.0, 5, 8, { u: 2.4 });
  for (let k = 0; k < 8; k++) {
    // (on the octagon's own faces: cylinder() puts its corners at k·45°)
    const th = ((k + 0.5) / 8) * Math.PI * 2;
    const ox = Math.cos(th), oz = Math.sin(th), tx = Math.sin(th), tz = -Math.cos(th);
    const cx = top[0] + ox * 2.95, cz = top[2] + oz * 2.95;
    Wn.col = [1, 1, 1];
    Wn.quadP([cx - tx * 0.55, top[1] + 1, cz - tz * 0.55], [cx + tx * 0.55, top[1] + 1, cz + tz * 0.55], [cx + tx * 0.55, top[1] + 4, cz + tz * 0.55], [cx - tx * 0.55, top[1] + 4, cz - tz * 0.55], otwUV('a_lit'));
  }
  R.col = [0.34, 0.42, 0.44];
  cylinder(R, top[0], top[1] + 5, top[2], 3.3, 0.4, 8, { top: false });
  sphere(R, top[0], top[1] + 6.4, top[2], 2.6, 8, { sy: 1.1 });
  cone(R, top[0], top[1] + 8.5, top[2], 1.0, 6.5, 8);
  K.glow.col = [1, 1, 1];
  box(K.glow, top[0], top[1] + 14.8, top[2], 0.22, 1.6, 0.22, it.ry, { u: 1 });
  sphere(K.glow, top[0], top[1] + 15.2, top[2], 0.35, 6);
  // the hands: one little mesh, its vertices set each frame
  clockHands(B, dials, g + 32, M);
}

function clockHands(B, dials, yc, M) {
  const n = dials.length * 2;
  const pos = new Float32Array(n * 4 * 3);
  const idx = [];
  for (let k = 0; k < n; k++) idx.push(k * 4, k * 4 + 1, k * 4 + 2, k * 4, k * 4 + 2, k * 4 + 3);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const nrm = new Float32Array(n * 4 * 3);
  g.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
  g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(n * 4 * 3).fill(0.06), 3));
  g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(n * 4 * 2), 2));
  g.setAttribute('glow', new THREE.BufferAttribute(new Float32Array(n * 4 * 3), 3));
  g.setIndex(idx);
  const mesh = new THREE.Mesh(g, M.paint);
  mesh.frustumCulled = false;
  B.group.add(mesh);
  const set = (k, f, ang, len, wd) => {
    const cx = f.len / 2;
    const ux = Math.sin(ang), uy = Math.cos(ang);
    const pts = [[-wd, -0.3], [wd, -0.3], [wd, len], [-wd, len]].map(([a, b]) => f.P(cx + a * uy + b * ux, yc + b * uy - a * ux, 0.1));
    for (let q = 0; q < 4; q++) { pos.set(pts[q], (k * 4 + q) * 3); nrm.set([f.nx, 0, f.nz], (k * 4 + q) * 3); }
  };
  let last = -1;
  B.anim((t, dt, d) => {
    if (d > 500) return;
    const m = Math.floor((t / 60 + 23 * 60 + 41) % 720 * 4) / 4;
    if (m === last) return;
    last = m;
    dials.forEach((f, i) => {
      set(i * 2, f, (m / 60) * Math.PI * 2, 2.1, 0.07);
      set(i * 2 + 1, f, (m / 720) * Math.PI * 2, 1.4, 0.1);
    });
    g.attributes.position.needsUpdate = true;
    g.attributes.normal.needsUpdate = true;
    g.computeBoundingSphere();
  });
}

// ------------------------------------------------------------------ the garden

/** A railing round a polygon (iron on a stone kerb), gaps for gates (centre of each side). */
export function railingRound(K, poly, y, h = 1.6, gate = 3.2) {
  for (let k = 0; k < poly.length; k++) {
    const f = edgeFace(poly[k], poly[(k + 1) % poly.length]);
    const parts = [[0, f.len / 2 - gate / 2], [f.len / 2 + gate / 2, f.len]];
    for (const [a0, a1] of parts) {
      K.stone.col = [0.8, 0.77, 0.7];
      fquad(K.stone, f, a0, a1, y - 0.3, y + 0.35, 0.18, [a0 / 2, 0, a1 / 2, 0.3]);
      K.stone.quadP(f.P(a0, y + 0.35, 0.18), f.P(a1, y + 0.35, 0.18), f.P(a1, y + 0.35, -0.18), f.P(a0, y + 0.35, -0.18));
      K.metal.col = [0.1, 0.12, 0.11];
      fquad(K.metal, f, a0, a1, y + 0.35, y + 0.35 + h, 0, metalUV(1, a1 - a0, 2.4));
    }
    // gate piers
    for (const a of [f.len / 2 - gate / 2, f.len / 2 + gate / 2]) {
      const p = f.P(a, y, 0);
      K.stone.col = [0.84, 0.8, 0.72];
      box(K.stone, p[0], y - 0.3, p[2], 0.6, 2.6, 0.6, f.ry, { u: 1 });
      cone(K.stone, p[0], y + 2.3, p[2], 0.4, 0.6, 4);
    }
  }
}

/** A bandstand: an octagonal stone base, iron columns, a pagoda-ish zinc roof, bulbs. */
export function bandstand(K, x, y, z) {
  const S = K.stone, P = K.paint;
  S.col = [0.82, 0.78, 0.7];
  cylinder(S, x, y - 0.2, z, 5.2, 1.3, 8, { top: true });
  P.col = [0.16, 0.3, 0.22];
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2 + Math.PI / 8;
    cylinder(P, x + Math.cos(a) * 4.6, y + 1.1, z + Math.sin(a) * 4.6, 0.12, 3.4, 5);
  }
  P.col = [0.2, 0.36, 0.28];
  cylinder(P, x, y + 4.5, z, 5.6, 0.4, 8, { top: false });
  K.slate.col = [0.36, 0.5, 0.46];
  cone(K.slate, x, y + 4.9, z, 5.8, 2.6, 8);
  cone(K.slate, x, y + 7.3, z, 1.2, 1.6, 8);
  K.glow.col = [1, 1, 1];
  for (let k = 0; k < 16; k++) {
    const a = (k / 16) * Math.PI * 2;
    cross(K.glow, x + Math.cos(a) * 5.55, y + 4.32, z + Math.sin(a) * 5.55, 0.1, 0.2);
  }
}

export { catenary, broadTree, bush, lampPost, statue, gable };
