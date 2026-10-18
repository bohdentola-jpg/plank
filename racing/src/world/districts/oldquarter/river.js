// PORT HALCYON — OLD TOWN's river: where its banks run (offset lines off
// the river's centreline, eased round its bends the way the water's own
// ribbon is), the stone quays along them (a paved quay top, a parapet at
// the water's edge, a wall down into the river, steps down to landings),
// and the arched stone bridges dressed over the road's own decks:
// spandrels and vaults down to the water, piers with cutwaters, a
// balustrade, pedestals and lamps.
import { RIVER } from '../../map/base.js';
import { F_BRIDGE } from '../../net.js';
import { roadPiers } from '../../build/roads.js';
import { riverAt, waterAt, natural } from '../../terrain.js';
import { ROAD, MARGIN } from '../occ.js';

// ------------------------------------------------------------------ the river's line

const P = RIVER.path, YS = RIVER.ys;
const S = [0];
for (let k = 1; k < P.length; k++) S.push(S[k - 1] + Math.hypot(P[k][0] - P[k - 1][0], P[k][1] - P[k - 1][1]));
const SEG = [];
for (let k = 0; k < P.length - 1; k++) {
  const dx = P[k + 1][0] - P[k][0], dz = P[k + 1][1] - P[k][1], l = Math.hypot(dx, dz);
  SEG.push({ tx: dx / l, tz: dz / l, len: l });
}
export const HALF = RIVER.width / 2;
export const RIVER_LEN = S[S.length - 1];

/**
 * The river at distance s along its centreline: { x, z, yw (water level),
 * tx, tz (downstream), nx, nz (to the left bank: (tz, −tx)) }. Normals
 * ease round the bends over 12 m either side of each joint.
 */
export function riverPt(s) {
  s = Math.max(0, Math.min(RIVER_LEN - 0.01, s));
  let k = 0;
  while (k < SEG.length - 1 && s > S[k + 1]) k++;
  const g = SEG[k], t = (s - S[k]) / g.len;
  const x = P[k][0] + g.tx * (s - S[k]), z = P[k][1] + g.tz * (s - S[k]);
  const yw = YS[k] + (YS[k + 1] - YS[k]) * t;
  let tx = g.tx, tz = g.tz;
  const ease = 12;
  if (k > 0 && s - S[k] < ease) {
    const h = SEG[k - 1], w = 0.5 * (1 - (s - S[k]) / ease);
    tx = tx * (1 - w) + h.tx * w; tz = tz * (1 - w) + h.tz * w;
  } else if (k < SEG.length - 1 && S[k + 1] - s < ease) {
    const h = SEG[k + 1], w = 0.5 * (1 - (S[k + 1] - s) / ease);
    tx = tx * (1 - w) + h.tx * w; tz = tz * (1 - w) + h.tz * w;
  }
  const l = Math.hypot(tx, tz);
  tx /= l; tz /= l;
  return { s, x, z, yw, tx, tz, nx: tz, nz: -tx };
}

/** Where along the centreline the point nearest (x, z) is (coarse, then fine). */
export function riverS(x, z) {
  let best = { d: Infinity, s: 0 };
  for (let k = 0; k < SEG.length; k++) {
    const g = SEG[k];
    const t = Math.max(0, Math.min(g.len, (x - P[k][0]) * g.tx + (z - P[k][1]) * g.tz));
    const px = P[k][0] + g.tx * t, pz = P[k][1] + g.tz * t;
    const d = Math.hypot(x - px, z - pz);
    if (d < best.d) best = { d, s: S[k] + t };
  }
  return best;
}

/** A point on a bank: side +1 the left (east) bank, −1 the right (west); d out from the centreline. */
export function bankPt(s, side, d) {
  const r = riverPt(s);
  return { ...r, bx: r.x + r.nx * side * d, bz: r.z + r.nz * side * d, ox: r.nx * side, oz: r.nz * side };
}

/** The face of the wall at the water's edge. */
export const WALL_D = HALF + 0.4;
/** How wide the paved quay top is (from the wall back to the bank's full height). */
export const TOP_W = 6.4;

// ------------------------------------------------------------------ bridges

/**
 * How a road's bridge over the river is laid out (plan and build both ask):
 * { r, i0, i1 (its deck samples), sA, sB (where it crosses the two walls),
 * piers: [s], arches: [{ s0, s1, spring, crown }], w (deck half width to
 * the fascia), reach, yw, lamps: [{ s, side }] } or null.
 */
export function bridgeLayout(r) {
  if (r._otb !== undefined) return r._otb;
  let i0 = -1, i1 = -1;
  for (let i = 0; i < r.N; i++) if (r.flags[i] & F_BRIDGE) { if (i0 < 0) i0 = i; i1 = i; }
  if (i0 < 0) { r._otb = null; return null; }
  const rt = r.rt;
  const reach = rt.hw + rt.shoulder + rt.walk;
  // the two wall crossings: where the centreline's distance to the river passes WALL_D
  let sA = null, sB = null, yw = 0;
  let prevIn = false;
  for (let i = Math.max(0, i0 - 10); i <= Math.min(r.N - 1, i1 + 10); i++) {
    const rv = riverAt(r.X[i], r.Z[i]);
    const inside = !!rv && rv.d < WALL_D;
    if (rv && rv.d < WALL_D + 2) yw = Math.max(yw, rv.y);
    if (inside && !prevIn && sA === null) sA = r.S[i];
    if (!inside && prevIn) sB = r.S[i];
    prevIn = inside;
  }
  if (sA === null || sB === null || sB - sA < 10) { r._otb = null; return null; }
  sA -= 0.6; sB += 0.6;
  const sA0 = sA, sB0 = sB;
  const PW = 3.2;
  // the road's own concrete piers stand inside ours: one near a bank makes
  // that abutment reach out to it; the spans between are cut into ~10 m arches
  const own = roadPiers(r).map((p) => r.S[p.i]).filter((s) => s > sA + 1 && s < sB - 1).sort((a, b) => a - b);
  const abut = [];
  const mid = [];
  for (const sp of own) {
    if (sp - sA0 < 8) { sA = Math.max(sA, sp + PW / 2); continue; }
    if (sB0 - sp < 8) { sB = Math.min(sB, sp - PW / 2); continue; }
    mid.push(sp);
  }
  if (sA > sA0 + 0.1) abut.push([sA0, sA]);
  if (sB < sB0 - 0.1) abut.push([sB, sB0]);
  const piers = [];
  const sup = [sA, ...mid, sB];
  for (let k = 0; k < sup.length - 1; k++) {
    if (k > 0) piers.push(sup[k]);
    const a = sup[k] + (k > 0 ? PW / 2 : 0), b = sup[k + 1] - (k < sup.length - 2 ? PW / 2 : 0);
    const m = Math.max(1, Math.round((b - a + PW) / (10.5 + PW)));
    for (let q = 1; q < m; q++) piers.push(a - PW / 2 + ((b - a + PW) * q) / m);
  }
  piers.sort((a, b) => a - b);
  const all = [sA, ...piers, sB];
  const arches = [];
  const yAt = (s) => r.Y[Math.max(0, Math.min(r.N - 1, Math.round(s / r.step)))];
  for (let k = 0; k < all.length - 1; k++) {
    const s0 = all[k] + (k === 0 ? 0 : PW / 2), s1 = all[k + 1] - (k === all.length - 2 ? 0 : PW / 2);
    if (s1 - s0 < 2.5) continue;
    let deck = Infinity;
    for (let s = s0; s <= s1; s += 1) deck = Math.min(deck, yAt(s));
    const spring = yw - 0.35;
    const crown = Math.max(yw + 1.2, deck - 2.0);
    arches.push({ s0, s1, spring, crown });
  }
  // lamps on the pedestals at either end, and over the piers on the grand ones
  const lamps = [];
  const centre = piers.length ? piers.reduce((a, p) => (Math.abs(p - (sA0 + sB0) / 2) < Math.abs(a - (sA0 + sB0) / 2) ? p : a), piers[0]) : null;
  for (const side of [1, -1]) {
    lamps.push({ s: r.S[i0] + 2.5, side }, { s: r.S[i1] - 2.5, side });
    if (centre !== null) lamps.push({ s: centre, side });
  }
  const out = { r, i0, i1, sA: sA0, sB: sB0, piers, abut, PW, arches, reach, w: reach + 0.45, yw, lamps, yAt };
  r._otb = out;
  return out;
}

/** The arch (if any) over s: its intrados height there, else null. */
export function archY(A, s) {
  const half = (A.s1 - A.s0) / 2, rise = A.crown - A.spring;
  const R = (half * half + rise * rise) / (2 * rise);
  const c = A.s0 + half, dx = s - c;
  return A.crown - R + Math.sqrt(Math.max(0, R * R - dx * dx));
}

export { waterAt };

// ------------------------------------------------------------------ planning

/** The quay top's level at s on a side (what plan and build agree on). */
export function quayTop(s, side) {
  const b = bankPt(s, side, WALL_D);
  const yg = natural(b.bx + b.ox * (TOP_W + 0.8), b.bz + b.oz * (TOP_W + 0.8));
  return { top: Math.max(yg, b.yw + 0.6), yw: b.yw, b };
}

/**
 * A road running along the wall at this bank point (a lane down to the
 * water, not a bridge over it): the level of its sidewalk, else null.
 */
function laneAt(P, b) {
  const nr = P.nearestRoad(b.bx + b.ox * 4, b.bz + b.oz * 4, 14);
  if (!nr) return null;
  const r = nr.road, i = nr.i;
  if (r.flags[i] & F_BRIDGE) return null;
  if (Math.abs(r.TX[i] * b.tx + r.TZ[i] * b.tz) < 0.85) return null;
  return r.Y[i] + (r.rt.walk > 0 ? r.rt.curb : 0);
}

/**
 * OLD TOWN's riverside, planned: the promenade either side claimed (no
 * house on the river side of the quais), quay pieces (40 m each) with
 * their steps, ladders, lamps and plane trees, the parapet's colliders.
 * o.keep: [[side, s0, s1]] stretches kept clear of trees and lamps (a mill).
 */
export function planRiver(P, o = {}) {
  const occ = P.occ;
  const kept = (side, t) => (o.keep || []).some(([sd, a, b]) => sd === side && t >= a && t <= b);
  // the stretch of river inside the district
  let s0 = null, s1 = null;
  for (let s = 0; s < RIVER_LEN; s += 4) {
    const p = riverPt(s);
    if (P.inside(p.x, p.z, -30)) { if (s0 === null) s0 = s; s1 = s; }
  }
  if (s0 === null) return { quays: [], s0: 0, s1: 0 };
  const quays = [];
  const roadNear = (x, z, r) => (occ.get(x, z) & ROAD) || (r > 0 && ((occ.get(x + r, z) | occ.get(x - r, z) | occ.get(x, z + r) | occ.get(x, z - r)) & (ROAD | MARGIN)));
  for (const side of [1, -1]) {
    // the promenade: from the wall back to the quai's sidewalk (or 46 m)
    for (let s = s0; s <= s1; s += 4) {
      const b = bankPt(s, side, WALL_D);
      let dEnd = 46;
      for (let d = 1; d <= 46; d += 2) {
        if (occ.get(b.bx + b.ox * d, b.bz + b.oz * d) & (ROAD | MARGIN)) { dEnd = d; break; }
      }
      const p = bankPt(s, side, WALL_D + dEnd / 2);
      P.claim(p.bx, p.bz, 4.6, dEnd + 1, Math.atan2(-p.tz, p.tx));
    }
    // quay pieces
    const pieceLen = 40;
    let stepNext = s0 + (side > 0 ? 90 : 190);
    for (let s = s0; s < s1 - 2; s += pieceLen) {
      const e = Math.min(s1, s + pieceLen);
      const mid = bankPt((s + e) / 2, side, WALL_D);
      if (!P.inside(mid.bx, mid.bz, -10)) continue;
      const q = { type: 'quay', x: mid.bx, z: mid.bz, side, s0: s, s1: e, steps: [], ladders: [], lamps: [], trees: [], lane: [], gaps: [] };
      // steps every couple of hundred metres (not by a bridge)
      if (stepNext >= s && stepNext < e) {
        let clear = true;
        for (let d = -30; d <= 30; d += 3) { const p = bankPt(stepNext + d, side, WALL_D); if (occ.get(p.bx, p.bz) & ROAD) clear = false; }
        if (clear && stepNext - 2 > s && stepNext + 8 < e) { q.steps.push(stepNext); stepNext += 200 + P.rng() * 60; } else stepNext += 23;
      }
      for (let t = s + 13; t < e; t += 26) {
        const b = bankPt(t, side, WALL_D);
        if (!(occ.get(b.bx, b.bz) & ROAD) && !q.steps.some((x) => Math.abs(x - t) < 8) && Math.floor(t / 26) % 3 === 0) q.ladders.push(t);
      }
      // lamps along the quay top, plane trees behind it
      for (let t = s + 8; t < e; t += 32) {
        const b = bankPt(t, side, WALL_D + 2.3);
        if (roadNear(b.bx, b.bz, 3) || q.steps.some((x) => Math.abs(x - t) < 6) || kept(side, t)) continue;
        const { top } = quayTop(t, side);
        q.lamps.push(t);
        P.lamp({ x: b.bx, z: b.bz, y: top, hx: b.bx, hz: b.bz, hy: top + 4.5, color: '#ffcf8a', radius: 13, intensity: 0.9, halo: 2.4 });
      }
      for (let t = s + 4.5; t < e; t += 9) {
        const b = bankPt(t, side, WALL_D + TOP_W + 2.8);
        if (roadNear(b.bx, b.bz, 3) || !P.inside(b.bx, b.bz, 2) || kept(side, t)) continue;
        const y = natural(b.bx, b.bz);
        q.trees.push([b.bx, b.bz, y, 0.9 + P.rng() * 0.3, P.rng()]);
        P.collider({ kind: 'circle', x: b.bx, z: b.bz, r: 0.45, y0: y - 1, y1: y + 9 });
      }
      // the parapet and its bench (a car on the quay doesn't go in the river);
      // where the quay stands up out of the land (a levee), all of its top
      let run = null;
      const flush = (t1) => {
        if (!run) return;
        // (beside a lane only the parapet itself, on the wall's own line)
        const c = run.lane ? WALL_D + 0.22 : run.levee ? WALL_D + TOP_W / 2 : WALL_D + 0.75;
        const hz = run.lane ? 0.34 : run.levee ? TOP_W / 2 + 0.25 : 0.85;
        const a = bankPt(run.t0, side, c), b = bankPt(t1, side, c);
        const len = Math.hypot(b.bx - a.bx, b.bz - a.bz);
        if (len > 1) P.collider({ kind: 'box', x: (a.bx + b.bx) / 2, z: (a.bz + b.bz) / 2, hx: len / 2, hz, ry: Math.atan2(-(b.bz - a.bz), b.bx - a.bx), y0: run.yw - 2, y1: run.top + 1.1 });
        run = null;
      };
      for (let t = s; t <= e + 0.01; t += 2) {
        const b = bankPt(t, side, WALL_D);
        const blocked = (occ.get(b.bx, b.bz) & ROAD) || (occ.get(b.bx + b.ox * 1.5, b.bz + b.oz * 1.5) & ROAD);
        if (blocked) {
          // a lane along the wall keeps a parapet (a bridge's abutment doesn't)
          const ly = laneAt(P, b);
          if (ly === null) { flush(t - 2); continue; }
          q.lane.push([t, ly]);
          if (run && (!run.lane || t - run.t0 >= 18)) flush(t);
          if (!run) run = { t0: t, yw: b.yw, top: ly, lane: true };
          else run.top = Math.max(run.top, ly);
          continue;
        }
        if (run && run.lane) flush(t);
        const qt = quayTop(t, side);
        const land = natural(b.bx + b.ox * (TOP_W + 1.5), b.bz + b.oz * (TOP_W + 1.5));
        const levee = qt.top - land > 0.35;
        if (run && (run.levee !== levee || t - run.t0 >= 18)) flush(t);
        if (!run) run = { t0: t, yw: qt.yw, top: qt.top, levee };
        else run.top = Math.max(run.top, qt.top);
      }
      flush(e);
      P.add(q);
      quays.push(q);
    }
  }
  return { quays, s0, s1 };
}
