// PORT HALCYON — building OLD TOWN's river: the quays (a stone wall down
// into the water, a parapet, a paved quay top, steps down to landings,
// ladders, riverside lamps), the bridges dressed in stone over the road's
// decks (spandrels and vaults, piers with cutwaters, a balustrade of
// turned balusters, pedestals with lamps, statues on the Grand Bridge),
// and the boats moored along the walls.
import { box, prism, cylinder, cone, sphere } from '../builder.js';
import { natural } from '../../terrain.js';
import { ROAD } from '../occ.js';
import { bankPt, WALL_D, TOP_W, bridgeLayout, archY, riverPt } from './river.js';
import { otwUV } from './ottex.js';
import { metalUV } from './tex.js';
import { lantern, catenary, cross } from './geo.js';

/** A quad wound to face (nx, ny, nz). */
export function quadFacing(acc, A, B, C, D, n, uv) {
  const ux = B[0] - A[0], uy = B[1] - A[1], uz = B[2] - A[2];
  const vx = C[0] - B[0], vy = C[1] - B[1], vz = C[2] - B[2];
  const cx = uy * vz - uz * vy, cy = uz * vx - ux * vz, cz = ux * vy - uy * vx;
  if (cx * n[0] + cy * n[1] + cz * n[2] >= 0) acc.quadP(A, B, C, D, uv);
  else acc.quadP(B, A, D, C, uv ? [uv[2], uv[1], uv[0], uv[3]] : undefined);
}

/** A triangle (its own vertices) wound to face n. */
export function triFacing(acc, A, B, C, n) {
  const ux = B[0] - A[0], uy = B[1] - A[1], uz = B[2] - A[2];
  const vx = C[0] - A[0], vy = C[1] - A[1], vz = C[2] - A[2];
  const cx = uy * vz - uz * vy, cy = uz * vx - ux * vz, cz = ux * vy - uy * vx;
  const i0 = acc.v(A[0], A[1], A[2], 0, 0), i1 = acc.v(B[0], B[1], B[2], 1, 0), i2 = acc.v(C[0], C[1], C[2], 0.5, 1);
  if (cx * n[0] + cy * n[1] + cz * n[2] >= 0) acc.tri(i0, i1, i2); else acc.tri(i0, i2, i1);
}

// ------------------------------------------------------------------ quays

/**
 * One stretch of quay. it: { side, s0, s1, steps: [s], lamps: [s], ladders }.
 * (Heights come from the land as it lies behind the quay: never a
 * neighbouring cell's terrain grid.)
 */
export function quay(K, B, it) {
  const { side } = it;
  const S = K.stone, N = K.near;
  const occ = B.D.occ;
  const step = 2;
  const n = Math.max(1, Math.round((it.s1 - it.s0) / step));
  const pts = [];
  for (let k = 0; k <= n; k++) {
    const s = it.s0 + (it.s1 - it.s0) * k / n;
    const b = bankPt(s, side, WALL_D);
    const gx = b.bx + b.ox * (TOP_W + 0.8), gz = b.bz + b.oz * (TOP_W + 0.8);
    const yg = natural(gx, gz);
    const top = Math.max(yg, b.yw + 0.6);
    // a road over the quay here (a bridge's abutment)?
    let road = false;
    for (const d of [-1, 1.5, 4]) if (occ.get(b.bx + b.ox * d, b.bz + b.oz * d) & ROAD) road = true;
    const stepGap = it.steps.some((q) => Math.abs(q - s) < 1.3);
    pts.push({ s, b, top, yg, road, stepGap });
  }
  const at = (p, d, y) => [p.b.bx + p.b.ox * d, y, p.b.bz + p.b.oz * d];
  const toLand = (p) => [p.b.ox, 0, p.b.oz], toWater = (p) => [-p.b.ox, 0, -p.b.oz];
  const stoneCol = [0.86, 0.82, 0.74];
  for (let k = 0; k < n; k++) {
    const p = pts[k], q = pts[k + 1];
    const u0 = p.s / 2.4, u1 = q.s / 2.4;
    S.col = stoneCol;
    // the wall down into the river
    const pt = p.road ? Math.min(p.top, p.b.yw + 1.4) : p.top + (p.stepGap ? 0 : 0.85);
    const qt = q.road ? Math.min(q.top, q.b.yw + 1.4) : q.top + (q.stepGap ? 0 : 0.85);
    quadFacing(S, at(p, 0, p.b.yw - 3.2), at(q, 0, q.b.yw - 3.2), at(q, 0, qt), at(p, 0, pt), toWater(p), [u0, (p.b.yw - 3.2) / 2.4, u1, pt / 2.4]);
    if (p.road || q.road) continue;
    // the paved quay top, its edge on the land side
    K.pave.col = [1, 1, 1];
    const pv0 = p.stepGap || q.stepGap ? 0.45 : 1.6;
    quadFacing(K.pave, at(p, pv0, p.top + 0.02), at(q, pv0, q.top + 0.02), at(q, TOP_W, q.top + 0.02), at(p, TOP_W, p.top + 0.02), [0, 1, 0], [u0 * 2.4 / 4, 0, u1 * 2.4 / 4, TOP_W / 4]);
    quadFacing(S, at(p, TOP_W, Math.min(p.yg, p.top) - 0.6), at(q, TOP_W, Math.min(q.yg, q.top) - 0.6), at(q, TOP_W, q.top + 0.02), at(p, TOP_W, p.top + 0.02), toLand(p), [u0, 0, u1, 0.5]);
    if (p.stepGap || q.stepGap) continue;
    // the parapet: a stone bench along its land side, the wall, a coping on top
    S.col = [0.84, 0.8, 0.72];
    quadFacing(S, at(p, 1.6, p.top), at(q, 1.6, q.top), at(q, 1.6, q.top + 0.45), at(p, 1.6, p.top + 0.45), toLand(p), [u0, 0, u1, 0.2]);
    quadFacing(S, at(p, 0.58, p.top + 0.45), at(q, 0.58, q.top + 0.45), at(q, 1.6, q.top + 0.45), at(p, 1.6, p.top + 0.45), [0, 1, 0], [u0, 0, u1, 0.4]);
    quadFacing(S, at(p, 0.58, p.top + 0.45), at(q, 0.58, q.top + 0.45), at(q, 0.58, q.top + 0.85), at(p, 0.58, p.top + 0.85), toLand(p), [u0, 0, u1, 0.17]);
    S.col = [0.92, 0.89, 0.82];
    quadFacing(S, at(p, -0.1, p.top + 0.85), at(q, -0.1, q.top + 0.85), at(q, 0.58, q.top + 0.85), at(p, 0.58, p.top + 0.85), [0, 1, 0], [u0, 0, u1, 0.3]);
    quadFacing(S, at(p, -0.1, p.top + 0.72), at(q, -0.1, q.top + 0.72), at(q, -0.1, q.top + 0.85), at(p, -0.1, p.top + 0.85), toWater(p), [u0, 0, u1, 0.06]);
    quadFacing(S, at(p, 0.58, p.top + 0.72), at(q, 0.58, q.top + 0.72), at(q, 0.58, q.top + 0.85), at(p, 0.58, p.top + 0.85), toLand(p), [u0, 0, u1, 0.06]);
  }
  // steps down to a landing at the water
  for (const s of it.steps) {
    const p = bankPt(s, side, WALL_D);
    const top = pts.reduce((a, q) => (Math.abs(q.s - s) < Math.abs(a.s - s) ? q : a), pts[0]).top;
    const drop = top - (p.yw + 0.35);
    if (drop < 0.4) continue;
    const nst = Math.max(3, Math.round(drop / 0.24));
    const run = 0.32, width = 1.5;
    const ry = Math.atan2(-p.tz, p.tx);
    S.col = [0.8, 0.77, 0.7];
    for (let k = 0; k < nst; k++) {
      const yk = top - (k + 1) * (drop / nst);
      const along = 1.3 + (k + 0.5) * run;
      const cx = p.bx + p.tx * along - p.ox * width / 2, cz = p.bz + p.tz * along - p.oz * width / 2;
      box(S, cx, p.yw - 1.2, cz, run, yk - (p.yw - 1.2), width, ry, { u: 1, faces: 'fbr' });
    }
    // the landing
    const la = 1.3 + nst * run + 1.2;
    box(S, p.bx + p.tx * la - p.ox * width / 2, p.yw - 1.2, p.bz + p.tz * la - p.oz * width / 2, 2.4, 1.55, width, ry, { u: 1 });
    // mooring rings and a lamp-lit niche
    N.paint.col = [0.15, 0.15, 0.16];
    cylinder(N.paint, p.bx + p.tx * la - p.ox * 0.4, p.yw + 0.35, p.bz + p.tz * la - p.oz * 0.4, 0.12, 0.45, 5, { top: true });
  }
  // ladders down the wall now and then
  for (const s of it.ladders || []) {
    const p = bankPt(s, side, WALL_D - 0.06);
    const top = pts[Math.min(pts.length - 1, Math.max(0, Math.round((s - it.s0) / step)))].top;
    const A = [p.bx - p.tx * 0.3, p.yw - 0.5, p.bz - p.tz * 0.3], Bq = [p.bx + p.tx * 0.3, p.yw - 0.5, p.bz + p.tz * 0.3];
    N.metal.col = [0.12, 0.12, 0.13];
    const uv = metalUV(3, 0.6, 0.6);
    quadFacing(N.metal, A, Bq, [Bq[0], top + 0.8, Bq[2]], [A[0], top + 0.8, A[2]], [-p.ox, 0, -p.oz], [0, uv[1], 0.25, uv[3]]);
  }
  // riverside lamps on the quay top
  for (const s of it.lamps || []) {
    const p = bankPt(s, side, WALL_D + 2.3);
    const top = pts.reduce((a, q) => (Math.abs(q.s - s) < Math.abs(a.s - s) ? q : a), pts[0]).top;
    lampPost(K, p.bx, top, p.bz, 'double', Math.atan2(-p.tz, p.tx));
  }
}

// ------------------------------------------------------------------ lamps & statues

/**
 * Old Town's cast-iron lamp posts: 'double' (two lanterns on a crossarm),
 * 'triple' (a candelabra), 'single'. Lantern glass glows.
 */
export function lampPost(K, x, y, z, kind = 'single', ry = 0, h = 4.3) {
  const N = K.near;
  const P = K.paint;
  P.col = [0.08, 0.1, 0.09];
  // a fluted base, the shaft, a collar
  cylinder(P, x, y, z, 0.2, 0.9, 6, { r2: 0.13 });
  cylinder(P, x, y + 0.9, z, 0.085, h - 0.9, 5, { r2: 0.065 });
  N.paint.col = [0.08, 0.1, 0.09];
  cylinder(N.paint, x, y + 1.6, z, 0.12, 0.12, 6);
  const c = Math.cos(ry), s = Math.sin(ry);
  const heads = kind === 'double' ? [[-0.55, 0], [0.55, 0]] : kind === 'triple' ? [[-0.6, 0], [0.6, 0], [0, 0]] : [[0, 0]];
  const yh = y + h;
  if (heads.length > 1) {
    P.beam(x - c * 0.62, yh - 0.05, z + s * 0.62, x + c * 0.62, yh - 0.05, z - s * 0.62, 0.07, 0.07);
  }
  for (const [lx, extra] of heads) {
    const hx = x + c * lx, hz = z - s * lx;
    const top = lx === 0 && heads.length === 3 ? yh + 0.5 : yh;
    void extra;
    K.glow.col = [1, 1, 1];
    box(K.glow, hx, top - 0.02, hz, 0.26, 0.42, 0.26, ry, { u: 1 });
    P.col = [0.08, 0.1, 0.09];
    cone(P, hx, top + 0.4, hz, 0.26, 0.32, 4);
    N.paint.col = [0.08, 0.1, 0.09];
    cylinder(N.paint, hx, top - 0.12, hz, 0.1, 0.12, 4, { r2: 0.17 });
  }
}

/** A bronze figure on a plinth (a torch-bearer). */
export function statue(K, x, y, z, ry, h = 2.6) {
  const P = K.paint;
  P.col = [0.2, 0.3, 0.26];
  cone(P, x, y, z, h * 0.2, h * 0.78, 7);
  cylinder(P, x, y, z, h * 0.17, h * 0.42, 7, { r2: h * 0.12 });
  sphere(P, x, y + h * 0.82, z, h * 0.085, 6);
  const c = Math.cos(ry), s = Math.sin(ry);
  P.beam(x + c * 0.1, y + h * 0.66, z - s * 0.1, x + c * 0.42, y + h * 1.02, z - s * 0.42, 0.1, 0.1);
  P.beam(x - c * 0.1, y + h * 0.62, z + s * 0.1, x - c * 0.3, y + h * 0.4, z + s * 0.3, 0.09, 0.09);
  K.glow.col = [1, 1, 1];
  box(K.glow, x + c * 0.44, y + h * 1.03, z - s * 0.44, 0.16, 0.26, 0.16, ry, { u: 1 });
}

// ------------------------------------------------------------------ bridges

/** A stone bridge over a road's deck. it: { road (id), grand }. */
export function* bridge(K, B, it) {
  const r = B.net.byId.get(it.road);
  const L = r && bridgeLayout(r);
  if (!L) return;
  const S = K.stone, N = K.near;
  const posAt = (s, lat) => {
    const p = r.posAt(Math.max(0, Math.min(r.length, s))), i = p.i;
    return { x: p.x + r.LX[i] * lat, z: p.z + r.LZ[i] * lat, i, tx: r.TX[i], tz: r.TZ[i], lx: r.LX[i], lz: r.LZ[i] };
  };
  const Y = (s) => {
    const f = Math.max(0, Math.min(r.N - 1.001, s / r.step)), i = Math.floor(f), t = f - i;
    return r.Y[i] * (1 - t) + r.Y[i + 1] * t;
  };
  const sF0 = r.S[L.i0] - 0.3, sF1 = r.S[Math.min(r.N - 1, L.i1 + 1)] + 0.3;
  const stone = it.grand ? [0.94, 0.9, 0.82] : [0.88, 0.84, 0.76];
  const below = (s) => {
    for (const A of L.arches) if (s > A.s0 + 0.001 && s < A.s1 - 0.001) return archY(A, s);
    if (s >= L.sA && s <= L.sB) return L.yw - 3.2;
    const p = posAt(s, 0);
    return natural(p.x, p.z) - 0.8;
  };
  // the stations along the bridge: every metre, and exactly at each arch's ends
  const st = new Set();
  for (let s = sF0; s < sF1; s += 1) st.add(+s.toFixed(3));
  st.add(+sF1.toFixed(3));
  for (const A of L.arches) { st.add(+A.s0.toFixed(3)); st.add(+A.s1.toFixed(3)); }
  const ss = [...st].sort((a, b) => a - b);
  for (const side of [1, -1]) {
    const lat = side * (L.w + 0.05);
    S.col = stone;
    for (let k = 0; k < ss.length - 1; k++) {
      const s0 = ss[k], s1 = ss[k + 1];
      const sm = (s0 + s1) / 2;
      // inside an arch, both bottoms on the arc; at an arch's end, the pier side
      let b0 = below(s0 + 0.0005), b1 = below(s1 - 0.0005);
      const inArch = L.arches.some((A) => sm > A.s0 && sm < A.s1);
      if (!inArch) { b0 = below(sm); b1 = b0; }
      const p0 = posAt(s0, lat), p1 = posAt(s1, lat);
      quadFacing(S, [p0.x, b0, p0.z], [p1.x, b1, p1.z], [p1.x, Y(s1) + 1.06, p1.z], [p0.x, Y(s0) + 1.06, p0.z], [p0.lx * side, 0, p0.lz * side], [s0 / 2.4, b0 / 2.4, s1 / 2.4, (Y(s1) + 1.06) / 2.4]);
    }
    // voussoirs: a ring of proud stones round each arch, and a keystone
    S.col = [stone[0] * 0.9, stone[1] * 0.9, stone[2] * 0.88];
    for (const A of L.arches) {
      const nv = Math.max(9, Math.round((A.s1 - A.s0) / 1.1));
      for (let q = 0; q < nv; q++) {
        const sa = A.s0 + (A.s1 - A.s0) * (q + 0.08) / nv, sb = A.s0 + (A.s1 - A.s0) * (q + 0.92) / nv;
        const ya = archY(A, sa), yb = archY(A, sb);
        const ring = q === Math.floor(nv / 2) ? 1.05 : 0.7;
        const pa = posAt(sa, lat + side * 0.08), pb = posAt(sb, lat + side * 0.08);
        quadFacing(S, [pa.x, ya, pa.z], [pb.x, yb, pb.z], [pb.x, Math.min(yb + ring, Y(sb) - 0.2), pb.z], [pa.x, Math.min(ya + ring, Y(sa) - 0.2), pa.z], [pa.lx * side, 0, pa.lz * side], [0, 0, 0.5, 0.3]);
      }
    }
    // a string course under the parapet
    S.col = [stone[0] * 0.95, stone[1] * 0.95, stone[2] * 0.93];
    for (let k = 0; k < ss.length - 1; k += 2) {
      const s0 = ss[k], s1 = ss[Math.min(ss.length - 1, k + 2)];
      const a = posAt(s0, lat + side * 0.12), b = posAt(s1, lat + side * 0.12);
      quadFacing(S, [a.x, Y(s0) - 0.28, a.z], [b.x, Y(s1) - 0.28, b.z], [b.x, Y(s1) - 0.02, b.z], [a.x, Y(s0) - 0.02, a.z], [a.lx * side, 0, a.lz * side], [0, 0, 1, 0.1]);
      const a2 = posAt(s0, lat - side * 0.05);
      const b2 = posAt(s1, lat - side * 0.05);
      quadFacing(S, [a2.x, Y(s0) - 0.28, a2.z], [b2.x, Y(s1) - 0.28, b2.z], [b.x, Y(s1) - 0.28, b.z], [a.x, Y(s0) - 0.28, a.z], [0, -1, 0], [0, 0, 1, 0.1]);
    }
  }
  yield;
  // the vaults under the arches
  S.col = [stone[0] * 0.7, stone[1] * 0.7, stone[2] * 0.68];
  for (const A of L.arches) {
    const nv = 10;
    for (let q = 0; q < nv; q++) {
      const sa = A.s0 + (A.s1 - A.s0) * q / nv, sb = A.s0 + (A.s1 - A.s0) * (q + 1) / nv;
      const ya = archY(A, sa), yb = archY(A, sb);
      const a0 = posAt(sa, -L.w - 0.05), a1 = posAt(sa, L.w + 0.05), b0 = posAt(sb, -L.w - 0.05), b1 = posAt(sb, L.w + 0.05);
      quadFacing(S, [a0.x, ya, a0.z], [a1.x, ya, a1.z], [b1.x, yb, b1.z], [b0.x, yb, b0.z], [0, -1, 0], [0, 0, 2 * L.w / 2.4, (sb - sa) / 2.4]);
    }
  }
  // abutments reaching out from the banks (round the road's own piers)
  S.col = stone;
  for (const [a0, a1] of L.abut) {
    const c = posAt((a0 + a1) / 2, 0);
    box(S, c.x, L.yw - 3.2, c.z, a1 - a0, L.yw + 0.4 - (L.yw - 3.2), 2 * (L.w + 0.06), Math.atan2(-c.tz, c.tx), { u: 2.4 });
  }
  // piers with cutwaters both sides
  for (const sp of L.piers) {
    const c = posAt(sp, 0);
    const ry = Math.atan2(-c.tz, c.tx);
    const sprg = L.yw + 0.3;
    box(S, c.x, L.yw - 3.2, c.z, L.PW, sprg + 0.25 - (L.yw - 3.2), 2 * (L.w + 0.06), ry, { u: 2.4 });
    for (const side of [1, -1]) {
      const a = posAt(sp - L.PW / 2, side * (L.w + 0.06)), b = posAt(sp + L.PW / 2, side * (L.w + 0.06)), t = posAt(sp, side * (L.w + 1.9));
      const poly = [[a.x, a.z], [b.x, b.z], [t.x, t.z]];
      prism(S, poly, 0, 0, L.yw - 3.2, sprg + 0.25, 0, { u: 2.4 });
      // a pointed hood on the cutwater (each face its own vertices, facing out)
      const m = posAt(sp, side * (L.w + 0.06));
      const ap = [m.x, sprg + 1.3, m.z];
      const cx = (a.x + b.x + t.x) / 3, cz = (a.z + b.z + t.z) / 3;
      for (const [u, v] of [[a, b], [b, t], [t, a]]) {
        triFacing(S, [u.x, sprg + 0.25, u.z], [v.x, sprg + 0.25, v.z], ap, [(u.x + v.x) / 2 - cx, 0.3, (u.z + v.z) / 2 - cz]);
      }
    }
  }
  yield;
  // the balustrade: coping in stone; dark backing, plinth and balusters close up
  for (const side of [1, -1]) {
    if (side < 0) yield;
    const inner = side * (L.reach - 0.13), outer = side * (L.w + 0.14);
    for (let s = r.S[L.i0] + 0.2; s < r.S[L.i1] - 0.2; s += 2) {
      const s1 = Math.min(r.S[L.i1] - 0.2, s + 2);
      const a = posAt(s, inner), b = posAt(s1, inner), c = posAt(s1, outer), d = posAt(s, outer);
      S.col = [stone[0] * 1.02, stone[1] * 1.02, stone[2]];
      quadFacing(S, [a.x, Y(s) + 1.06, a.z], [b.x, Y(s1) + 1.06, b.z], [c.x, Y(s1) + 1.06, c.z], [d.x, Y(s) + 1.06, d.z], [0, 1, 0], [0, 0, 1, 0.3]);
      quadFacing(S, [a.x, Y(s) + 0.92, a.z], [b.x, Y(s1) + 0.92, b.z], [b.x, Y(s1) + 1.06, b.z], [a.x, Y(s) + 1.06, a.z], [-a.lx * side, 0, -a.lz * side], [0, 0, 1, 0.1]);
      // the backing: in shadow between the balusters
      const ba = posAt(s, side * (L.reach - 0.012)), bb = posAt(s1, side * (L.reach - 0.012));
      N.paint.col = [0.09, 0.09, 0.1];
      quadFacing(N.paint, [ba.x, Y(s) + 0.12, ba.z], [bb.x, Y(s1) + 0.12, bb.z], [bb.x, Y(s1) + 0.93, bb.z], [ba.x, Y(s) + 0.93, ba.z], [-ba.lx * side, 0, -ba.lz * side]);
      const pa = posAt(s, side * (L.reach - 0.2)), pb = posAt(s1, side * (L.reach - 0.2));
      N.stone.col = stone;
      quadFacing(N.stone, [pa.x, Y(s) + 0.12, pa.z], [pb.x, Y(s1) + 0.12, pb.z], [pb.x, Y(s1) + 0.27, pb.z], [pa.x, Y(s) + 0.27, pa.z], [-pa.lx * side, 0, -pa.lz * side], [0, 0, 1, 0.1]);
      quadFacing(N.stone, [pa.x, Y(s) + 0.27, pa.z], [pb.x, Y(s1) + 0.27, pb.z], [bb.x, Y(s1) + 0.27, bb.z], [ba.x, Y(s) + 0.27, ba.z], [0, 1, 0], [0, 0, 1, 0.1]);
      for (let q = s + 0.17; q < s1; q += 0.34) {
        const bp = posAt(q, side * (L.reach - 0.1));
        cylinder(N.stone, bp.x, Y(q) + 0.27, bp.z, 0.075, 0.65, 4, { r2: 0.06 });
      }
    }
    // pedestals every few metres and at the ends
    const ped = [];
    const sa = r.S[L.i0] + 0.5, sb = r.S[L.i1] - 0.5;
    const np = Math.max(2, Math.round((sb - sa) / 9));
    for (let q = 0; q <= np; q++) ped.push(sa + (sb - sa) * q / np);
    for (const s of ped) {
      const p = posAt(s, side * (L.reach + 0.18));
      const ry = Math.atan2(-p.tz, p.tx);
      S.col = stone;
      box(S, p.x, Y(s), p.z, 0.8, 1.42, 0.8, ry, { u: 1.2 });
      box(S, p.x, Y(s) + 1.42, p.z, 0.95, 0.14, 0.95, ry, { u: 1.2 });
    }
  }
  yield;
  // lamps (the plan put their light here) and the Grand Bridge's statues
  for (const lp of L.lamps) {
    const p = posAt(lp.s, lp.side * (L.reach + 0.18));
    lampPost(K, p.x, Y(lp.s) + 1.56, p.z, it.grand ? 'triple' : 'double', Math.atan2(-p.tz, p.tx), 3.4);
  }
  if (it.grand) {
    for (const side of [1, -1]) {
      for (const s of [r.S[L.i0] - 1.5, r.S[L.i1] + 1.5]) {
        const p = posAt(s, side * (L.reach + 0.9));
        const ry = Math.atan2(-p.tz, p.tx);
        S.col = stone;
        box(S, p.x, Y(s) - 0.4, p.z, 1.6, 2.8, 1.6, ry, { u: 1.2 });
        box(S, p.x, Y(s) + 2.4, p.z, 1.9, 0.2, 1.9, ry, { u: 1.2 });
        statue(K, p.x, Y(s) + 2.6, p.z, ry + (side > 0 ? Math.PI / 2 : -Math.PI / 2), 2.8);
      }
    }
  }
}

// ------------------------------------------------------------------ boats

const HULL = [[0.1, 0.12, 0.16], [0.14, 0.2, 0.14], [0.36, 0.1, 0.08], [0.06, 0.06, 0.07], [0.12, 0.18, 0.3]];
const CABIN = [[0.92, 0.9, 0.84], [0.62, 0.42, 0.26], [0.86, 0.82, 0.62], [0.8, 0.84, 0.86]];

/** A boat moored on the river. it: { x, z, ry (bow), y (water), kind, len, seed, lit }. */
export function boat(K, it, rng) {
  const P = K.paint, N = K.near;
  const c = Math.cos(it.ry), s = Math.sin(it.ry);
  // local x across, z along (bow +z)
  const W = (lx, lz) => [it.x + lx * c + lz * s, it.z - lx * s + lz * c];
  const L = it.len, b = it.kind === 'launch' ? 2.6 : it.kind === 'row' ? 1.4 : it.kind === 'house' ? 6 : 5.2;
  const y = it.y;
  const hull = HULL[it.seed % HULL.length];
  const free = it.kind === 'row' ? 0.45 : it.kind === 'launch' ? 0.8 : 1.15;
  const poly = [W(-b / 2, -L / 2 + 0.6), W(-b / 2 * 0.8, -L / 2), W(b / 2 * 0.8, -L / 2), W(b / 2, -L / 2 + 0.6), W(b / 2, L / 2 - b * 0.8), W(0, L / 2), W(-b / 2, L / 2 - b * 0.8)];
  P.col = hull;
  prism(P, poly, 0, 0, y - 0.8, y + free - 0.18, 0, { top: false });
  P.col = it.kind === 'row' ? [0.6, 0.4, 0.24] : [0.75, 0.15, 0.12];
  prism(P, poly, 0, 0, y + free - 0.18, y + free, 0, { top: false });
  P.col = [0.42, 0.3, 0.2];
  prism(P, poly.map(([x, z]) => [x, z]), 0, 0, y + free - 0.06, y + free - 0.05, 0, { walls: false });
  if (it.kind === 'row') return;
  const cab = CABIN[(it.seed >> 3) % CABIN.length];
  const ry = it.ry;
  const glass = (lx, lz, w, h, yy, face) => {
    // a little window on the cabin side (face +1 starboard, −1 port)
    const p = W(lx, lz);
    const tx = s * face, tz = c * face;            // along the hull
    const ox = c * face, oz = -s * face;           // out of the side
    const lit = rng() < it.lit;
    K.win.col = [0.95, 0.94, 0.9];
    K.win.quadP([p[0] - tx * w / 2 + ox * 0.03, yy, p[1] - tz * w / 2 + oz * 0.03], [p[0] + tx * w / 2 + ox * 0.03, yy, p[1] + tz * w / 2 + oz * 0.03], [p[0] + tx * w / 2 + ox * 0.03, yy + h, p[1] + tz * w / 2 + oz * 0.03], [p[0] - tx * w / 2 + ox * 0.03, yy + h, p[1] - tz * w / 2 + oz * 0.03], otwUV(lit ? 'd_lit' : 'd_dark'));
  };
  if (it.kind === 'house') {
    // a long cabin, two decks of windows
    const cl = L * 0.72;
    P.col = cab;
    const cz = -L * 0.06;
    const ctr = W(0, cz);
    box(P, ctr[0], y + free, ctr[1], b - 0.6, 2.3, cl, ry, { u: 1 });
    P.col = [0.25, 0.25, 0.27];
    box(P, ctr[0], y + free + 2.3, ctr[1], b - 0.3, 0.14, cl + 0.4, ry, { u: 1 });
    for (const face of [1, -1]) for (let q = 0; q < Math.floor(cl / 2.2); q++) glass(face * (b / 2 - 0.3), cz - cl / 2 + 1.1 + q * 2.2, 0.95, 0.9, y + free + 0.85, face);
    // string lights along the roof edge
    for (const face of [1, -1]) {
      const a = W(face * (b / 2 - 0.1), cz - cl / 2), bb = W(face * (b / 2 - 0.1), cz + cl / 2);
      const pts = catenary([a[0], y + free + 2.35, a[1]], [bb[0], y + free + 2.35, bb[1]], 0.25, 12);
      for (const q of pts) cross(N.glow, q[0], q[1] - 0.08, q[2], 0.06, 0.12);
    }
    return;
  }
  // a péniche: the cabin aft, a wheelhouse on it, the hold covered forward
  const cl = it.kind === 'launch' ? L * 0.35 : L * 0.3;
  const cz = it.kind === 'launch' ? -L * 0.05 : -L / 2 + cl / 2 + 0.8;
  const ctr = W(0, cz);
  P.col = cab;
  box(P, ctr[0], y + free, ctr[1], b - 0.7, it.kind === 'launch' ? 1.2 : 1.8, cl, ry, { u: 1 });
  P.col = [0.22, 0.22, 0.24];
  box(P, ctr[0], y + free + (it.kind === 'launch' ? 1.2 : 1.8), ctr[1], b - 0.5, 0.12, cl + 0.3, ry, { u: 1 });
  for (const face of [1, -1]) for (let q = 0; q < Math.max(1, Math.floor(cl / 1.8)); q++) glass(face * (b / 2 - 0.35), cz - cl / 2 + 0.9 + q * 1.8, 0.7, 0.6, y + free + 0.6, face);
  if (it.kind === 'launch') return;
  const wh = W(0, -L / 2 + 1.6);
  P.col = cab;
  box(P, wh[0], y + free + 1.92, wh[1], 2.2, 1.3, 1.8, ry, { u: 1 });
  P.col = [0.22, 0.22, 0.24];
  box(P, wh[0], y + free + 3.22, wh[1], 2.5, 0.1, 2.1, ry, { u: 1 });
  // the hold's covers forward, plant pots and a bicycle-ish frame on deck
  const hz = cz + cl / 2 + (L / 2 - cl - 2) / 2;
  const hc = W(0, hz);
  P.col = [0.24, 0.3, 0.22];
  box(P, hc[0], y + free, hc[1], b - 1.2, 0.7, L - cl - 4.5, ry, { u: 1 });
  for (let q = 0; q < 4; q++) {
    const pp = W((rng() - 0.5) * (b - 1.4), hz + (rng() - 0.5) * (L - cl - 6));
    N.leaf.col = [[0.2, 0.42, 0.16], [0.85, 0.2, 0.2], [0.9, 0.7, 0.2]][q % 3];
    sphere(N.leaf, pp[0], y + free + 0.95, pp[1], 0.32, 5, { sy: 0.8 });
  }
}

/** The river at s, for placing boats: a point d out from the centre on a side. */
export function mooring(s, side, d) {
  const p = riverPt(s);
  return { x: p.x + p.nx * side * d, z: p.z + p.nz * side * d, y: p.yw, ry: Math.atan2(p.tx, p.tz) };
}

export { lantern };
