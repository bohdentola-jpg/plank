// PORT HALCYON — the west's raceway kit: what makes a loop of `circuit` road
// read as a real circuit. Planning: the lap's samples, its corners, gravel
// traps on the outside of the corners with tyre walls behind them, concrete
// pit and grandstand walls with catch fences, floodlight masts round the
// lap, braking boards before the slow corners. Building: grandstands (three
// structural styles: steel, timber, classic), walls, tyres, fences, masts,
// the start gantry with its lights, painted start lines. Each circuit
// passes its own style (colours, lamp colour, stand kind), so Ironwood,
// Redwood and Crestwood dress the same parts their own way.
import * as THREE from 'three';
import { litMat, plainMat, glowColorMat, box, cylinder } from '../builder.js';
import { groundTexture } from '../../../track/textures.js';
import { Fr, beam, lattice2, drapeUV, col, tube, quad2, segBox } from './geo.js';
import { lin, toWorld } from './util.js';
import { tyreTex, meshFenceTex, crowdTex, sponsorTex } from './tex.js';
import { ROAD, ITEM } from '../occ.js';

const WHITE = [1, 1, 1];

/** The raceway materials (made once per pack). */
export function raceMats(B, st) {
  return {
    tyre: B.mat('r:tyre', () => litMat({ map: tyreTex(), roughness: 0.9 })),
    fence: B.mat('r:fence', () => litMat({ map: meshFenceTex(), alphaTest: 0.45, side: THREE.DoubleSide, color: 0xc4c8cc, roughness: 0.6, metalness: 0.3 }, { shadow: false })),
    crowd: B.mat('r:crowd', () => litMat({ map: crowdTex(), alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.9 }, { shadow: false })),
    ads: B.mat('r:ads', () => { const t = sponsorTex(); return litMat({ map: t, emissive: 0xffffff, emissiveMap: t, roughness: 0.6 }, { night: 0.35 }); }),
    gravel: B.mat('r:gravel', () => litMat({ map: groundTexture('gravel'), color: new THREE.Color(st.gravel || '#d8ccb0'), roughness: 0.95, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 })),
    asphalt: B.mat('r:asphalt', () => litMat({ map: groundTexture('asphaltlot'), color: 0xb8b8b8, roughness: 0.9, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 })),
    flood: B.mat('r:flood', () => glowColorMat(st.lamp || '#fff2d8', 4)),
    red: B.mat('r:red', () => glowColorMat('#ff2418', 4)),
    paint: B.mat('paint', () => litMat({ vertexColors: true, roughness: 0.7 })),
  };
}

// ------------------------------------------------------------------ the lap

/** Samples round the lap (roads in order) every `step` m. */
export function lapSamples(net, ids, step = 4) {
  const out = [];
  let S = 0;
  for (const id of ids) {
    const r = net.byId.get(id);
    if (!r) continue;
    const n = Math.max(1, Math.round(r.length / step));
    for (let k = 0; k < n; k++) {
      const s = (k / n) * r.length;
      const p = r.posAt(s);
      const i = p.i;
      out.push({ x: p.x, z: p.z, y: p.y, tx: r.TX[i], tz: r.TZ[i], lx: r.LX[i], lz: r.LZ[i], k: r.Ks[i], s: S + s, road: id, rs: s, edge: r.rt.hw + r.rt.shoulder });
    }
    S += r.length;
  }
  return { samples: out, length: S, step };
}

/** Sample at lap distance s (wraps). */
export function lapAt(lap, s) {
  const L = lap.length, n = lap.samples.length;
  const ss = ((s % L) + L) % L;
  let lo = 0, hi = n - 1;
  while (lo < hi) { const m = (lo + hi + 1) >> 1; if (lap.samples[m].s <= ss) lo = m; else hi = m - 1; }
  return lap.samples[lo];
}

/** A point beside the lap at s, lat m to the left (+) or right (−). */
export function lapPoint(lap, s, lat) {
  const p = lapAt(lap, s);
  return [p.x + p.lx * lat, p.z + p.lz * lat];
}

/**
 * Corners: runs of curvature over kmin, merged across short straights of
 * the same hand; → [{ s0, s1, dir (+1 left, −1 right), angle (deg), kmax }].
 */
export function lapCorners(lap, kmin = 1 / 260, minAngle = 25) {
  const out = [];
  let cur = null;
  for (const p of lap.samples) {
    const turning = Math.abs(p.k) > kmin;
    const dir = p.k > 0 ? 1 : -1;
    if (turning) {
      if (cur && cur.dir === dir && p.s - cur.s1 < 24) { cur.s1 = p.s; cur.ang += p.k * lap.step; cur.kmax = Math.max(cur.kmax, Math.abs(p.k)); }
      else { if (cur) out.push(cur); cur = { s0: p.s, s1: p.s, dir, ang: p.k * lap.step, kmax: Math.abs(p.k) }; }
    }
  }
  if (cur) out.push(cur);
  return out.map((c) => ({ ...c, angle: Math.abs(c.ang) * 180 / Math.PI })).filter((c) => c.angle >= minAngle);
}

/**
 * How far out from the track's edge the ground is free (no other road's
 * corridor) at lap distance s on side sd, up to `max` m.
 */
export function freeOut(P, lap, s, sd, from, max) {
  const p = lapAt(lap, s);
  // (start a cell out: the lap's own corridor rounds out past its edge)
  for (let d = from + 2.5; d <= from + max; d += 2) {
    const x = p.x + p.lx * sd * d, z = p.z + p.lz * sd * d;
    if (P.occ.get(x, z) & (ROAD | ITEM)) return Math.max(0, d - from - 2);
  }
  return max;
}

/** A strip polygon beside the lap from s0 to s1 between lats a and b (side sd), b per sample from fn. */
export function stripPoly(lap, s0, s1, sd, a, bFn, step = 6) {
  const inner = [], outer = [];
  for (let s = s0; s <= s1 + 1e-6; s += step) {
    const p = lapAt(lap, s);
    const b = typeof bFn === 'function' ? bFn(s) : bFn;
    inner.push([p.x + p.lx * sd * a, p.z + p.lz * sd * a]);
    outer.push([p.x + p.lx * sd * b, p.z + p.lz * sd * b]);
  }
  return [...inner, ...outer.reverse()];
}

/** A polyline beside the lap from s0 to s1 at lateral offset sd·lat (lat may be a fn of s). */
export function lapLine(lap, s0, s1, sd, lat, step = 6) {
  const out = [];
  for (let s = s0; s <= s1 + 1e-6; s += step) {
    const p = lapAt(lap, s);
    const l = typeof lat === 'function' ? lat(s) : lat;
    out.push([p.x + p.lx * sd * l, p.z + p.lz * sd * l]);
  }
  return out;
}

/** Colliders along a polyline (a wall t thick from y0 to y1). */
export function lineColliders(P, pts, t, y0, y1) {
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], b = pts[i + 1];
    const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (L < 0.2) continue;
    const ry = Math.atan2(b[0] - a[0], b[1] - a[1]);
    P.collider({ kind: 'box', x: (a[0] + b[0]) / 2, z: (a[1] + b[1]) / 2, hx: t / 2, hz: L / 2 + 0.2, ry, y0: (typeof y0 === 'function' ? y0(a[0], a[1]) : y0), y1: (typeof y1 === 'function' ? y1(a[0], a[1]) : y1) });
  }
}

/** Split a polyline into chunks of about `len` m (sharing end points). */
export function chunks(pts, len = 60) {
  const out = [];
  let cur = [pts[0]], acc = 0;
  for (let i = 1; i < pts.length; i++) {
    acc += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    cur.push(pts[i]);
    if (acc >= len && i < pts.length - 1) { out.push(cur); cur = [pts[i]]; acc = 0; }
  }
  if (cur.length > 1) out.push(cur);
  return out;
}

/**
 * Plan the run-off of every corner: a gravel trap on the outside, a tyre
 * wall at its back (solid), sponsor boards. o: { kmin, w: [min, max] trap
 * width, wall (true), skip(s) → true to leave a corner bare }.
 */
export function planRunoffs(P, lap, o = {}) {
  const res = [];
  const W = o.w || [14, 30];
  for (const c of lapCorners(lap, o.kmin, o.minAngle)) {
    const sd = -c.dir;                    // the outside
    const s0 = c.s0 - 12, s1 = c.s1 + Math.min(60, 20 + c.angle * 0.35);
    if (o.skip && o.skip(c, s0, s1)) continue;
    const want = Math.min(W[1], W[0] + c.angle * 0.12);
    const edge = lapAt(lap, c.s0).edge + 0.6;
    // how much room there is, sample by sample
    const room = (s) => Math.max(0, Math.min(want, freeOut(P, lap, s, sd, edge, want + 8) - 6));
    const widths = [];
    for (let s = s0; s <= s1; s += 6) widths.push(room(s));
    // ease in and out, and don't bother where it's too tight
    const avg = widths.reduce((a, b) => a + b, 0) / Math.max(1, widths.length);
    if (avg < 6) continue;
    const wAt = (s) => {
      const k = Math.min(widths.length - 1, Math.max(0, Math.round((s - s0) / 6)));
      const t = Math.min(1, (s - s0) / 18, (s1 - s) / 24);
      return edge + Math.max(2, widths[k] * Math.max(0.15, t));
    };
    const poly = stripPoly(lap, s0, s1, sd, edge, wAt, 6);
    P.add({ type: 'r-gravel', x: poly[0][0], z: poly[0][1], poly, strip: true, map: 'track' });
    P.occ.markPoly(poly, ITEM);
    if (o.wall !== false) {
      const line = lapLine(lap, s0 + 6, s1 - 6, sd, (s) => wAt(s) + 0.9, 6);
      for (const ch of chunks(line, 48)) {
        P.add({ type: 'r-tyres', x: ch[0][0], z: ch[0][1], pts: ch, fence: o.fence ?? 0, side: sd });
        lineColliders(P, ch, 1.1, (x, z) => P.groundY(x, z) - 1, (x, z) => P.groundY(x, z) + 1.3 + (o.fence ?? 0));
      }
    }
    res.push({ ...c, sd, s0, s1, wAt });
  }
  return res;
}

/** A concrete wall (with an optional catch fence on top) beside the lap: solid. */
export function planWall(P, lap, s0, s1, sd, lat, o = {}) {
  const line = lapLine(lap, s0, s1, sd, lat, 6);
  for (const ch of chunks(line, 48)) {
    P.add({ type: 'r-wall', x: ch[0][0], z: ch[0][1], pts: ch, h: o.h ?? 1.1, fence: o.fence ?? 3.2, ads: o.ads !== false, side: sd });
    lineColliders(P, ch, 0.6, (x, z) => P.groundY(x, z) - 1, (x, z) => P.groundY(x, z) + (o.h ?? 1.1) + 0.6);
  }
  return line;
}

// ------------------------------------------------------------------ building

/** A gravel trap (or any lap strip) laid on the ground. */
export function buildGravel(B, M, it) {
  const acc = B.acc(it.mat === 'asphalt' ? M.asphalt : M.gravel);
  const uv = it.mat === 'asphalt' ? 6 : 3;
  if (!it.strip) { drapeUV(acc, B, it.poly, { lift: 0.07, step: 6, uv }); return; }
  // a strip (stripPoly's order: the inner edge, then the outer edge back): quads across it
  const n = it.poly.length / 2;
  const inner = it.poly.slice(0, n), outer = it.poly.slice(n).reverse();
  const lat = Math.max(1, Math.ceil(Math.max(...inner.map((p, k) => Math.hypot(outer[k][0] - p[0], outer[k][1] - p[1]))) / 6));
  const rows = [];
  for (let k = 0; k < n; k++) {
    const a = inner[k], b = outer[k], row = [];
    for (let j = 0; j <= lat; j++) {
      const x = a[0] + (b[0] - a[0]) * (j / lat), z = a[1] + (b[1] - a[1]) * (j / lat);
      row.push(acc.v(x, B.groundY(x, z) + 0.07, z, x / uv, z / uv));
    }
    rows.push(row);
  }
  // wind each quad to face up whichever way the strip runs
  const up = (() => { const a = inner[0], b = inner[Math.min(1, n - 1)], c = outer[0]; return (b[1] - a[1]) * (c[0] - a[0]) - (b[0] - a[0]) * (c[1] - a[1]) > 0; })();
  for (let k = 0; k < n - 1; k++) {
    for (let j = 0; j < lat; j++) {
      const a = rows[k][j], b = rows[k + 1][j], c = rows[k + 1][j + 1], d = rows[k][j + 1];
      if (up) { acc.tri(a, b, c); acc.tri(a, c, d); } else { acc.tri(a, c, b); acc.tri(a, d, c); }
    }
  }
}

/** A tyre wall along it.pts: three tyres high, its face toward the track. */
export function buildTyres(B, M, it) {
  const acc = B.acc(M.tyre);
  const gy = (x, z) => B.groundY(x, z);
  const H = 1.15, T = 1.1;
  let u = 0;
  for (let i = 0; i < it.pts.length - 1; i++) {
    const a = it.pts[i], b = it.pts[i + 1];
    const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (L < 0.05) continue;
    const ya = gy(a[0], a[1]) - 0.15, yb = gy(b[0], b[1]) - 0.15;
    const nx = (b[1] - a[1]) / L * T / 2, nz = -(b[0] - a[0]) / L * T / 2;
    const U = 2.4;
    // both faces (v 0..0.72 the stacks), the top (v 0.72..1)
    for (const sgn of [1, -1]) {
      const A = [a[0] + nx * sgn, ya, a[1] + nz * sgn], Bq = [b[0] + nx * sgn, yb, b[1] + nz * sgn];
      if (sgn > 0) acc.quadP(Bq, A, [A[0], ya + H, A[2]], [Bq[0], yb + H, Bq[2]], [(u + L) / U, 0, u / U, 0.72]);
      else acc.quadP(A, Bq, [Bq[0], yb + H, Bq[2]], [A[0], ya + H, A[2]], [u / U, 0, (u + L) / U, 0.72]);
    }
    acc.quadP([a[0] + nx, ya + H, a[1] + nz], [a[0] - nx, ya + H, a[1] - nz], [b[0] - nx, yb + H, b[1] - nz], [b[0] + nx, yb + H, b[1] + nz], [u / U, 0.72, (u + L) / U, 1]);
    // a catch fence on posts just behind the tyres (it.side: the track's side is −side)
    if (it.fence > 0) {
      const fence = B.acc(M.fence), paint = B.acc(M.paint);
      const ox = (nx / (T / 2)) * 1.0 * (it.side || 1), oz = (nz / (T / 2)) * 1.0 * (it.side || 1);
      const A = [a[0] + ox, ya + 0.15, a[1] + oz], Bq = [b[0] + ox, yb + 0.15, b[1] + oz];
      fence.quadP(A, Bq, [Bq[0], yb + 0.15 + it.fence, Bq[2]], [A[0], ya + 0.15 + it.fence, A[2]], [u / 1.6, 0, (u + L) / 1.6, it.fence / 1.6]);
      col(paint, lin('#4a4e52'));
      const n = Math.max(1, Math.round(L / 4));
      for (let k = 0; k < n; k++) {
        const t = k / n;
        box(paint, A[0] + (Bq[0] - A[0]) * t, A[1] + (Bq[1] - A[1]) * t - 0.4, A[2] + (Bq[2] - A[2]) * t, 0.12, it.fence + 0.6, 0.12, 0, { u: 1 });
      }
      col(paint, WHITE);
    }
    u += L;
  }
}

/** A concrete wall with a sponsor band and a catch fence on posts above it. */
export function buildWall(B, M, it, st) {
  const paint = B.acc(M.paint), ads = B.acc(M.ads), fence = B.acc(M.fence);
  const H = it.h, T = 0.5;
  let u = 0;
  for (let i = 0; i < it.pts.length - 1; i++) {
    const a = it.pts[i], b = it.pts[i + 1];
    const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (L < 0.05) continue;
    const ya = B.groundY(a[0], a[1]), yb = B.groundY(b[0], b[1]);
    const nx = (b[1] - a[1]) / L, nz = -(b[0] - a[0]) / L;
    col(paint, lin(st.wall || '#d8d6ce'));
    const ry = Math.atan2(b[0] - a[0], b[1] - a[1]);
    box(paint, (a[0] + b[0]) / 2, Math.min(ya, yb) - 0.5, (a[1] + b[1]) / 2, T, H + 0.5 + Math.abs(ya - yb) * 0.5, L + 0.02, ry, { u: 2 });
    // the sponsor band on the track face (both faces: which side is the track varies)
    if (it.ads) {
      const brand = Math.floor(((a[0] * 0.13 + a[1] * 0.07) % 5 + 5) % 5);
      const v0 = 1 - (brand + 1) / 5, v1 = 1 - brand / 5;
      for (const sgn of [1, -1]) {
        const ox = nx * (T / 2 + 0.02) * sgn, oz = nz * (T / 2 + 0.02) * sgn;
        const A = [a[0] + ox, ya + 0.1, a[1] + oz], Bq = [b[0] + ox, yb + 0.1, b[1] + oz];
        const Ct = [Bq[0], yb + H - 0.1, Bq[2]], Dt = [A[0], ya + H - 0.1, A[2]];
        if (sgn > 0) ads.quadP(Bq, A, Dt, Ct, [0, v0, Math.max(1, L / 4), v1]);
        else ads.quadP(A, Bq, Ct, Dt, [0, v0, Math.max(1, L / 4), v1]);
      }
    }
    // the fence: posts every 4 m, mesh between
    if (it.fence > 0) {
      const f0 = H, f1 = H + it.fence;
      fence.quadP([a[0], ya + f0, a[1]], [b[0], yb + f0, b[1]], [b[0], yb + f1, b[1]], [a[0], ya + f1, a[1]], [u / 1.6, f0 / 1.6, (u + L) / 1.6, f1 / 1.6]);
      col(paint, lin(st.post || '#5a5e62'));
      const n = Math.max(1, Math.round(L / 4));
      for (let k = 0; k < n; k++) {
        const t = k / n, x = a[0] + (b[0] - a[0]) * t, z = a[1] + (b[1] - a[1]) * t, y = ya + (yb - ya) * t;
        box(paint, x, y + H, z, 0.12, it.fence + 0.3, 0.12, ry, { u: 1 });
        // the overhang at the top, leaning toward the track
        beam(paint, [x, y + f1, z], [x + nx * 0.9 * (it.side || 1), y + f1 + 0.6, z + nz * 0.9 * (it.side || 1)], 0.08, 0.08);
      }
    }
    u += L;
  }
  col(paint, WHITE);
}

/**
 * A grandstand facing local +z (the track) at (x, z) turned ry: w long, d
 * deep, n tiers rising to the back; kind 'steel' | 'timber' | 'classic'.
 */
export function* buildStand(B, M, it, st, wallAcc) {
  const F = new Fr(it.x, 0, it.z, it.ry);
  const g = B.footY(it.x, it.z, it.w, it.d, it.ry);
  const y0 = g.hi + 0.6;
  const paint = B.acc(M.paint), crowd = B.acc(M.crowd);
  const n = it.tiers || 10, w = it.w, d = it.d;
  const dt = (d - 3) / n, ht = (it.h - 3) / n;
  const kind = it.kind || st.stand || 'steel';
  // the base: a solid plinth / concourse under the stand
  col(paint, lin(kind === 'timber' ? '#5a4632' : kind === 'classic' ? '#e8e2d4' : '#4a4e52'));
  segBox(paint, F.wx(0, -1.5), g.lo - 1, F.wz(0, -1.5), w, y0 - g.lo + 1, d - 3, it.ry, { u: 2 });
  // the tiers: a step each, seats in rows (colour per block), the crowd
  const seats = st.seats || ['#2a5fa8', '#d8dce2'];
  for (let k = 0; k < n; k++) {
    const zf = d / 2 - 3 - k * dt, yk = y0 + k * ht;
    col(paint, lin(kind === 'timber' ? '#8a6a48' : '#9a9a96'));
    segBox(paint, F.wx(0, zf - dt / 2), y0, F.wz(0, zf - dt / 2), w, (k + 1) * ht, dt, it.ry, { u: 2, top: true });
    // seat rows: blocks of colour with aisles
    const nb = Math.max(1, Math.round(w / 14));
    for (let b = 0; b < nb; b++) {
      const bw = w / nb - 1.4, bx = -w / 2 + (b + 0.5) * (w / nb);
      col(paint, lin(seats[(b + (k > n * 0.6 ? 1 : 0)) % seats.length]));
      F.box(paint, bx, yk + ht, zf - dt * 0.55, bw, 0.42, 0.5, { u: 1 });
    }
    // the crowd stands in front of its seats (alpha strip)
    const cz = zf - dt * 0.3;
    const cwide = w - 1.2;
    const vRow = k % 2 ? [0.5, 1] : [0, 0.5];
    if (((it.seed || 0) * 7 + k) % 5 !== 0) {
      crowd.quadP(F.p(-cwide / 2, yk + ht, cz), F.p(cwide / 2, yk + ht, cz), F.p(cwide / 2, yk + ht + 1.25, cz), F.p(-cwide / 2, yk + ht + 1.25, cz), [0, vRow[0], cwide / 8, vRow[1]]);
    }
    if (k % 4 === 3) yield;
  }
  // the back and the sides
  const top = y0 + it.h;
  col(paint, lin(kind === 'timber' ? '#6a4e34' : kind === 'classic' ? '#ece6d8' : '#5a5e62'));
  segBox(paint, F.wx(0, -d / 2 + 0.3), y0, F.wz(0, -d / 2 + 0.3), w, it.h - 1.2, 0.6, it.ry, { u: 2 });
  for (const sx of [-1, 1]) {
    // the end walls, raked with the tiers (both faces)
    const x = sx * (w / 2 + 0.15);
    const A = F.p(x, y0, d / 2 - 3), Bq = F.p(x, y0, -d / 2), C = F.p(x, top - 1.2, -d / 2), D = F.p(x, y0 + ht, d / 2 - 3);
    paint.quadP(A, Bq, C, D);
    paint.quadP(Bq, A, D, C);
  }
  // the roof: a cantilever from the back over the seats
  const rc = lin(st.roof || (kind === 'timber' ? '#3e5a3a' : kind === 'classic' ? '#f4f1ea' : '#7a8086'));
  col(paint, rc);
  const nr = Math.max(1, Math.round((w + 1) / 8));
  for (let k = 0; k < nr; k++) {
    const a = -w / 2 - 0.5 + ((w + 1) * k) / nr, b = -w / 2 - 0.5 + ((w + 1) * (k + 1)) / nr;
    const r0 = F.p(a, top + 0.2, -d / 2 - 0.5), r1 = F.p(b, top + 0.2, -d / 2 - 0.5);
    const r2 = F.p(b, top - 0.6, d / 2 - 1.5), r3 = F.p(a, top - 0.6, d / 2 - 1.5);
    paint.quadP(r3, r2, r1, r0);       // top
    paint.quadP(r0, r1, r2, r3);       // underside
  }
  if (kind === 'classic') {
    // fabric sails: a scalloped white edge
    for (let k = 0; k < Math.round(w / 8); k++) {
      const a = -w / 2 + k * 8, b = Math.min(w / 2, a + 8);
      const A = F.p(a, top - 0.6, d / 2 - 1.5), Bq = F.p(b, top - 0.6, d / 2 - 1.5), M2 = F.p((a + b) / 2, top - 1.6, d / 2 - 1.2);
      const ia = paint.v(...A), ib = paint.v(...Bq), im = paint.v(...M2);
      paint.tri(ia, im, ib); paint.tri(ia, ib, im);
    }
  }
  yield;
  // the roof's supports
  col(paint, lin(kind === 'timber' ? '#5a4030' : st.steel || '#8a3a24'));
  const nc = Math.max(2, Math.round(w / 12));
  for (let k = 0; k <= nc; k++) {
    const lx = -w / 2 + (w * k) / nc;
    if (kind === 'steel') {
      lattice2(paint, F.p(lx, y0, -d / 2 - 0.3), F.p(lx, top + 0.2, -d / 2 - 0.3), 0.7, { bar: 0.09, bay: 2.6 });
      beam(paint, F.p(lx, top + 0.1, -d / 2 - 0.3), F.p(lx, top - 0.5, d / 2 - 1.6), 0.25, 0.4);
    } else {
      beam(paint, F.p(lx, y0, -d / 2 - 0.3), F.p(lx, top + 0.2, -d / 2 - 0.3), 0.45, 0.45);
      beam(paint, F.p(lx, top - 2.8, -d / 2 - 0.3), F.p(lx, top - 0.5, d / 2 - 2.5), 0.25, 0.3);
    }
  }
  // lights along the roof's front edge
  const fl = B.acc(M.flood);
  F.box(fl, 0, top - 0.95, d / 2 - 1.6, w - 2, 0.18, 0.2, { u: 2 });
  col(paint, WHITE);
  void wallAcc; void cylinder;
}

/** A floodlight mast: a lattice or a pole, a bank of lamps at the top, aimed at (ax, az). */
export function buildMast(B, M, it, st) {
  const paint = B.acc(M.paint), fl = B.acc(M.flood);
  const gy = B.groundY(it.x, it.z);
  const h = it.h || 28;
  const ry = Math.atan2(it.ax - it.x, it.az - it.z);
  const F = new Fr(it.x, gy, it.z, ry);
  col(paint, lin(st.mast || '#6a6e72'));
  if ((it.kind || st.mastKind) === 'pole') {
    cylinder(paint, it.x, gy - 0.5, it.z, 0.45, h + 0.5, 8, { r2: 0.25 });
  } else if ((it.kind || st.mastKind) === 'wood') {
    col(paint, lin('#5a4030'));
    cylinder(paint, it.x, gy - 0.5, it.z, 0.4, h + 0.5, 7, { r2: 0.3 });
    beam(paint, F.p(-2.2, h - 0.6, 0.3), F.p(2.2, h - 0.6, 0.3), 0.2, 0.2);
  } else {
    lattice2(paint, F.p(0, 0, 0), F.p(0, h, 0), 1.6, { bar: 0.1, w2: 0.7 });
  }
  // the head: a frame with a 2 × 4 bank of lamps facing the track
  col(paint, lin('#2a2c2e'));
  F.box(paint, 0, h - 0.2, 0.2, 4.6, 2.4, 0.5, { u: 2 });
  for (let r = 0; r < 2; r++) for (let c = 0; c < 4; c++) F.box(fl, -1.65 + c * 1.1, h + 0.1 + r * 1.05, 0.48, 0.8, 0.7, 0.08, { u: 1 });
  col(paint, WHITE);
}

/** The start gantry over the track at lap sample p (its frame across): lights and a timing board. */
export function buildGantry(B, M, it, st) {
  const paint = B.acc(M.paint), red = B.acc(M.red), ads = B.acc(M.ads);
  const F = new Fr(it.x, 0, it.z, it.ry);       // local x across the track
  const span = it.span, h = 7.2;
  const ya = B.groundY(F.wx(-span / 2, 0), F.wz(-span / 2, 0)), yb = B.groundY(F.wx(span / 2, 0), F.wz(span / 2, 0));
  const y = Math.max(ya, yb);
  col(paint, lin(st.gantry || '#d8dade'));
  for (const sx of [-1, 1]) {
    const gy = sx < 0 ? ya : yb;
    lattice2(paint, F.p(sx * span / 2, gy - 0.5 - 0, 0), F.p(sx * span / 2, y + h + 1.4, 0), 1.1, { bar: 0.09 });
  }
  lattice2(paint, F.p(-span / 2, y + h + 0.6, 0), F.p(span / 2, y + h + 0.6, 0), 1.4, { bar: 0.09 });
  // the timing board and the light panels facing both ways
  col(paint, lin('#141618'));
  F.box(paint, 0, y + h - 1.1, 0, 7, 1.4, 0.5, { u: 2 });
  for (const sz of [0.27, -0.27]) for (let k = 0; k < 5; k++) F.box(red, -2.4 + k * 1.2, y + h - 0.85, sz, 0.55, 0.55, 0.05, { u: 1 });
  // sponsor panels on the beam
  for (const sz of [0.75, -0.75]) {
    const zf = sz;
    const v0 = 1 - (Math.abs(Math.round(it.x)) % 5 + 1) / 5, v1 = v0 + 0.2;
    const A = F.p(-span / 2 + 1, y + h + 0.05, zf), Bq = F.p(span / 2 - 1, y + h + 0.05, zf), C = F.p(span / 2 - 1, y + h + 1.15, zf), D = F.p(-span / 2 + 1, y + h + 1.15, zf);
    if (sz > 0) ads.quadP(A, Bq, C, D, [0, v0, span / 8, v1]); else ads.quadP(Bq, A, D, C, [0, v0, span / 8, v1]);
  }
  col(paint, WHITE);
}

/** A painted start/finish line across the road at lap sample p: white band, chequers. */
export function buildStartLine(B, M, it) {
  const paint = B.acc(M.paint);
  const r = B.net.byId.get(it.road);
  if (!r) return;
  const hw = r.rt.hw;
  for (let row = 0; row < 2; row++) {
    for (let k = 0; k < Math.round(hw * 2 / 0.8); k++) {
      const lat = -hw + k * 0.8 + 0.4;
      const s = it.s + row * 0.8 + 0.4;
      const p = r.posAt(s, lat);
      col(paint, lin((k + row) % 2 ? '#141414' : '#f2f2ee'));
      box(paint, p.x, p.y - 0.02, p.z, 0.8, 0.07, 0.8, Math.atan2(r.TX[p.i], r.TZ[p.i]), { u: 1 });
    }
  }
  for (let k = 0; k < Math.round(hw * 2 / 2); k++) {
    const lat = -hw + k * 2 + 1;
    const p = r.posAt(it.s - 0.8, lat);
    col(paint, lin('#f2f2ee'));
    box(paint, p.x, p.y - 0.02, p.z, 2, 0.07, 0.6, Math.atan2(r.TX[p.i], r.TZ[p.i]), { u: 1 });
  }
  // the grid: a painted bracket per car, staggered, 8 m apart
  col(paint, lin('#f2f2ee'));
  for (let k = 0; k < (it.grid || 0); k++) {
    const s = it.s - 10 - k * 8, lat = (k % 2 ? -1 : 1) * hw * 0.45;
    const p = r.posAt(s, lat), ry = Math.atan2(r.TX[p.i], r.TZ[p.i]);
    box(paint, p.x, p.y - 0.02, p.z, 3.0, 0.07, 0.22, ry, { u: 1 });
    for (const sx of [-1.4, 1.4]) {
      const q = r.posAt(s - 0.8, lat + sx);
      box(paint, q.x, q.y - 0.02, q.z, 0.22, 0.07, 1.6, ry, { u: 1 });
    }
  }
  col(paint, WHITE);
}

/** A braking board (300/200/100: it.k 0..2) or a chevron (3), on two legs. */
export function buildBoard(B, M, it) {
  const paint = B.near(M.paint);
  const gy = B.groundY(it.x, it.z);
  const F = new Fr(it.x, gy, it.z, it.ry);
  col(paint, lin('#3a3c3e'));
  for (const sx of [-0.5, 0.5]) F.box(paint, sx, -0.3, 0, 0.08, 1.4, 0.08, { u: 1 });
  col(paint, lin(it.k === 3 ? '#d0231f' : '#f2f2ee'));
  F.box(paint, 0, 0.9, 0, 1.5, 1.0, 0.08, { u: 1 });
  // the number as dark bars (3, 2, 1 of them) or a white arrow
  col(paint, lin(it.k === 3 ? '#ffffff' : '#141414'));
  const n = it.k === 3 ? 3 : 3 - it.k;
  for (let b = 0; b < n; b++) F.box(paint, -0.4 + b * 0.4, 1.15, 0.05, 0.22, 0.5, 0.02, { u: 1 });
  col(paint, WHITE);
}

/** A marshal post: a small hut, a flag. */
export function buildMarshal(B, M, it, st) {
  const paint = B.near(M.paint);
  const gy = B.groundY(it.x, it.z);
  const F = new Fr(it.x, gy, it.z, it.ry);
  col(paint, lin(st.marshal || '#e8e4d8'));
  F.box(paint, 0, -0.2, 0, 2.2, 2.6, 1.8, { u: 2 });
  col(paint, lin('#c8261e'));
  F.box(paint, 0, 2.4, 0, 2.6, 0.2, 2.2, { u: 2 });
  col(paint, lin('#4a4a4a'));
  cylinder(paint, F.wx(1.3, 0.8), gy, F.wz(1.3, 0.8), 0.04, 3.6, 4);
  col(paint, lin(it.flag || '#f0d020'));
  F.box(paint, 1.6, 3.0, 0.8, 0.7, 0.5, 0.02, { u: 1 });
  col(paint, WHITE);
}

// ------------------------------------------------------------------ planning the circuit's buildings

/** Place a footprint if it's free: claim it, a box collider h tall, a far box. → the item or null. */
export function placeFoot(P, it, h, o = {}) {
  if (!P.isFree(it.x, it.z, it.w, it.d, it.ry, { pad: o.pad ?? 1, roadPad: o.roadPad ?? true })) return null;
  P.claim(it.x, it.z, it.w, it.d, it.ry);
  const g = P.groundRange(it.x, it.z, it.w, it.d, it.ry);
  P.add(it);
  P.collider({ kind: 'box', x: it.x, z: it.z, hx: it.w / 2, hz: it.d / 2, ry: it.ry, y0: g.lo - 2, y1: g.hi + h });
  if (o.far !== false) P.far({ x: it.x, z: it.z, y: g.lo - 1, w: it.w, d: it.d, h: g.hi - g.lo + h + 1, ry: it.ry, color: o.color || '#5a4a40', lit: o.lit ?? 0.08 });
  return it;
}

/** A lamp on a pole (built by buildPole, the light baked). */
export function poleLamp(P, x, z, h, color, radius, intensity = 0.8, kind = 'steel') {
  if (!P.isFree(x, z, 1.2, 1.2, 0, { pad: 0.2 })) return false;
  P.claim(x, z, 1.2, 1.2, 0);
  const gy = P.groundY(x, z);
  P.add({ type: 'r-pole', x, z, h, kind });
  P.collider({ kind: 'circle', x, z, r: 0.35, y0: gy - 1, y1: gy + h });
  P.lamp({ x, z, hx: x, hz: z, hy: gy + h + 0.3, color, radius, intensity, halo: 1.6 });
  return true;
}

/** The side-facing turn: local +z toward side sd of the lap at s. */
export const lapFace = (lap, s, sd) => { const p = lapAt(lap, s); return Math.atan2(p.lx * sd, p.lz * sd); };

/**
 * The pit straight, from S0 to S1 (lap distances; may run past the lap's
 * end) with the pits on side `side`: the pit wall (a catch fence on it),
 * the pit lane (asphalt, claimed), the pit building (type o.type, o.w × o.d,
 * its front to the lane), the paddock behind it (o.paddock: transporters,
 * light poles), the start line (o.start: lap distance), the gantry, the
 * grid. → { pits, mid } (mid: the lap sample at the building's middle).
 */
export function planPitStraight(P, lap, o) {
  const { S0, S1 } = o;
  const R = o.side ?? -1;
  const at = (s) => lapAt(lap, s);
  const pm = o.mid ?? (S0 + S1) / 2, pc = at(pm);
  const pitW = o.w, pitD = o.d, pOff = 23 + pitD / 2;
  const px = pc.x + pc.lx * R * pOff, pz = pc.z + pc.lz * R * pOff;
  const pry = lapFace(lap, pm, R) + Math.PI;
  const pits = placeFoot(P, { type: o.type, x: px, z: pz, ry: pry, w: pitW, d: pitD, map: 'building', seed: P.rng() }, o.h ?? 14, { roadPad: false, pad: 0.3, color: o.color || '#5a4a40', lit: 0.4 });
  if (pits) {
    for (let k = -3; k <= 3; k++) {
      const [lx, lz] = toWorld(px, pz, pry, k * pitW / 7, pitD / 2 + 3);
      P.lamp({ x: lx, z: lz, hx: lx, hz: lz, hy: P.groundY(lx, lz) + 3.3, color: '#fff0d0', radius: 14, intensity: 0.9, halo: 0.5 });
    }
    if (o.paddock !== false) {
      const qOff = pOff + pitD / 2 + 16;
      const qx = pc.x + pc.lx * R * qOff, qz = pc.z + pc.lz * R * qOff;
      if (P.isFree(qx, qz, pitW, 26, pry, { pad: 0.5 })) {
        P.claim(qx, qz, pitW, 26, pry);
        const n = Math.max(2, Math.floor((pitW - 10) / 23));
        P.add({ type: 'r-paddock', x: qx, z: qz, ry: pry, w: pitW, d: 26, trucks: n, map: 'plaza' });
        for (let k = 0; k < n; k++) {
          const [tx, tz] = toWorld(qx, qz, pry, -pitW / 2 + 14 + k * 23, -4);
          const gy = P.groundY(tx, tz);
          P.collider({ kind: 'box', x: tx, z: tz, hx: 1.4, hz: 7, ry: pry, y0: gy - 1, y1: gy + 4.4 });
        }
        for (let k = -2; k <= 2; k++) {
          const [lx, lz] = toWorld(qx, qz, pry, k * pitW / 5 + 10, 9);
          poleLamp(P, lx, lz, 9, o.lamp || '#ffd8a0', 22, 0.8, o.poleKind);
        }
      }
    }
  }
  // the pit wall and the lane
  planWall(P, lap, S0 + 22, S1 - 18, R, 10.3, { h: 1.0, fence: 2.6 });
  const lane = [];
  for (let s = S0 + 4; s <= S1; s += 6) {
    const p = at(s);
    const t = Math.min(1, (s - S0 - 4) / 26, (S1 - s) / 30);
    const a = 9.4, b = 9.4 + 13.4 * Math.max(0.05, t);
    lane.push([[p.x + p.lx * R * a, p.z + p.lz * R * a], [p.x + p.lx * R * b, p.z + p.lz * R * b]]);
  }
  const lanePoly = [...lane.map((q) => q[0]), ...lane.slice().reverse().map((q) => q[1])];
  P.add({ type: 'r-gravel', mat: 'asphalt', x: lanePoly[0][0], z: lanePoly[0][1], poly: lanePoly, strip: true, map: 'track' });
  P.occ.markPoly(lanePoly, ITEM);
  // the start
  const sp = at(o.start ?? S0 + 120);
  P.add({ type: 'r-start', x: sp.x, z: sp.z, road: sp.road, s: sp.rs, grid: o.grid ?? 12 });
  P.add({ type: 'r-gantry', x: sp.x, z: sp.z, ry: Math.atan2(-sp.lz, sp.lx), span: 2 * 10.6 });
  for (const sd of [1, -1]) {
    const gx = sp.x + sp.lx * sd * 10.6, gz = sp.z + sp.lz * sd * 10.6;
    P.collider({ kind: 'circle', x: gx, z: gz, r: 0.8, y0: sp.y - 1, y1: sp.y + 10 });
  }
  return { pits, mid: pc };
}

/**
 * A grandstand beside the lap at s on side sd (centred, w long, d deep, its
 * front `gap` m past the track's edge), facing the track, with lights under
 * its roof and a wall with a catch fence in front (o.wall: its lat, or false).
 */
export function planStand(P, lap, s, sd, o) {
  const p = lapAt(lap, s);
  const off = p.edge + (o.gap ?? 3.4) + o.d / 2;
  const it = placeFoot(P, { type: 'stand', x: p.x + p.lx * sd * off, z: p.z + p.lz * sd * off, ry: lapFace(lap, s, sd) + Math.PI, w: o.w, d: o.d, h: o.h, tiers: o.tiers, kind: o.kind, seed: P.rng(), map: 'building' }, o.h + 2, { roadPad: o.roadPad ?? false, pad: 0.3, color: o.color || '#4a4440', lit: 0.25 });
  if (!it) return null;
  for (let k = -1; k <= 1; k++) {
    const [lx, lz] = toWorld(it.x, it.z, it.ry, k * it.w * 0.33, it.d / 2 - 2);
    P.lamp({ x: lx, z: lz, hx: lx, hz: lz, hy: P.groundY(lx, lz) + it.h - 0.5, color: '#fff2d8', radius: 18, intensity: 0.8, halo: 0 });
  }
  if (o.wall !== false) {
    const half = o.w / 2 + 4;
    planWall(P, lap, s - half, s + half, sd, o.wall ?? p.edge + 2, { h: 1.1, fence: 3.6 });
  }
  return it;
}

/** Floodlight masts every `every` m round the lap, alternating sides, aimed at the track. */
export function planMasts(P, lap, every, h, color, o = {}) {
  let side = 1;
  for (let s = every / 2; s < lap.length; s += every) {
    let done = false;
    for (const sd of [side, -side]) {
      for (const extra of [6, 12, 20, 30]) {
        const p = lapAt(lap, s);
        const off = p.edge + extra;
        const x = p.x + p.lx * sd * off, z = p.z + p.lz * sd * off;
        if (!P.isFree(x, z, 3, 3, 0, { pad: 0.5 })) continue;
        P.claim(x, z, 3, 3, 0);
        P.add({ type: 'r-mast', x, z, ax: p.x, az: p.z, h, kind: o.kind });
        const gy = P.groundY(x, z);
        P.collider({ kind: 'circle', x, z, r: 1.0, y0: gy - 1, y1: gy + h });
        const hx = x + (p.x - x) * 0.25, hz = z + (p.z - z) * 0.25;
        P.lamp({ x, z, hx, hz, hy: gy + h + 0.6, color, radius: o.radius ?? 46, intensity: o.intensity ?? 1.15, halo: 3.2 });
        done = true;
        break;
      }
      if (done) break;
    }
    side = -side;
  }
}

/** Braking boards (300, 200, 100) on the outside before every slow corner at the end of a straight. */
export function planBoards(P, lap, o = {}) {
  const cs = lapCorners(lap, o.kmin ?? 1 / 220, o.minAngle ?? 60);
  let prevEnd = cs.length ? cs[cs.length - 1].s1 - lap.length : 0;
  for (const c of cs) {
    const straight = c.s0 - prevEnd;
    prevEnd = c.s1;
    if (straight < (o.straight ?? 110)) continue;
    const sd = -c.dir;
    for (let k = 0; k < 3; k++) {
      const p = lapAt(lap, c.s0 - 100 + k * 33);
      const x = p.x + p.lx * sd * (p.edge + 2.6), z = p.z + p.lz * sd * (p.edge + 2.6);
      if (!P.isFree(x, z, 2, 1, 0, { pad: 0 })) continue;
      P.add({ type: 'r-board', x, z, ry: Math.atan2(-p.tx, -p.tz), k });
    }
  }
}

/** Marshal posts every `every` m round the lap, on whichever side has room. */
export function planMarshals(P, lap, every = 250, flags = ['#f0d020', '#2a7ad8', '#f0d020', '#e8e8e8']) {
  for (let s = 60; s < lap.length; s += every) {
    const p = lapAt(lap, s);
    for (const sd of [1, -1]) {
      const x = p.x + p.lx * sd * (p.edge + 7), z = p.z + p.lz * sd * (p.edge + 7);
      if (!P.isFree(x, z, 3, 3, 0, { pad: 0.5 })) continue;
      P.claim(x, z, 3, 3, 0);
      P.add({ type: 'r-marshal', x, z, ry: Math.atan2(-p.lx * sd, -p.lz * sd), flag: P.pick(flags) });
      P.collider({ kind: 'box', x, z, hx: 1.2, hz: 1.0, ry: 0, y0: p.y - 1, y1: p.y + 3 });
      break;
    }
  }
}

// ------------------------------------------------------------------ building the paddock

/** The paddock: asphalt, the teams' transporters (box trucks in their colours). */
export function buildPaddock(B, M, it) {
  const F = new Fr(it.x, 0, it.z, it.ry);
  const poly = [F.p(-it.w / 2, 0, -it.d / 2), F.p(it.w / 2, 0, -it.d / 2), F.p(it.w / 2, 0, it.d / 2), F.p(-it.w / 2, 0, it.d / 2)].map((p) => [p[0], p[2]]);
  drapeUV(B.acc(M.asphalt), B, poly, { lift: 0.07, step: 6, uv: 6 });
  const paint = B.acc(M.paint);
  const teams = ['#c8161e', '#1d4fa8', '#f0a818', '#1b1b1d', '#2f9a4a', '#e6e6e6', '#ff6a00', '#5a2a8a'];
  const k0 = Math.abs(Math.round(it.x * 0.37 + it.z * 0.11));
  for (let k = 0; k < (it.trucks || 6); k++) {
    const lx = -it.w / 2 + 14 + k * 23;
    const x = F.wx(lx, -4), z = F.wz(lx, -4);
    const y = B.groundY(x, z);
    col(paint, lin('#1a1a1c'));
    box(paint, x, y, z, 2.5, 1.1, 14, it.ry, { u: 2 });
    col(paint, lin(teams[(k + k0) % teams.length]));
    box(paint, x, y + 1.1, z, 2.6, 3.2, 11.5, it.ry, { u: 2 });
    box(paint, F.wx(lx, 2.4), y + 1.1, F.wz(lx, 2.4), 2.5, 2.4, 2.4, it.ry, { u: 2 });
  }
  col(paint, WHITE);
}

/** A lamp pole: a plain steel mast (or a timber pole) with a head. */
export function buildPole(B, M, it) {
  const paint = B.near(M.paint);
  const gy = B.groundY(it.x, it.z);
  col(paint, lin(it.kind === 'wood' ? '#5a4030' : '#3a3a3c'));
  cylinder(paint, it.x, gy - 0.4, it.z, it.kind === 'wood' ? 0.18 : 0.14, it.h + 0.4, 6, { r2: 0.1 });
  col(paint, lin('#2a2a2c'));
  box(paint, it.x, gy + it.h - 0.05, it.z, 1.2, 0.3, 0.6, 0, { u: 1 });
  box(B.near(M.flood), it.x, gy + it.h - 0.12, it.z, 0.9, 0.08, 0.4, 0, { u: 1, faces: '', top: false, bottom: true });
  col(paint, WHITE);
}

void plainMat; void tube;
