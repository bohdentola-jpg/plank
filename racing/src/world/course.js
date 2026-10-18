// The race tracks as places in PORT HALCYON: every track is a route over the
// world's own roads (its streets, its bridges, its viaducts, its mountain
// passes), so a race happens in a part of town you can also cruise through
// and no two tracks look alike. A route is a list of waypoint nodes; the
// roads between them are found on the network (the shortest way, keeping to
// roads fit to race on). From the route comes the race line: the roads'
// centrelines through every junction on a curve of a believable radius,
// with each road's width and height, and the side streets the race passes
// (closed off with barriers on race day).
import { worldNet } from './data.js';

/**
 * way: waypoint node ids, in race order (a circuit closes back to the first).
 * loop: a circuit. start: metres from the first waypoint to the start line
 * (a sprint starts 30 m in unless it says). reverseOf: the same route the
 * other way round. types: the road types the route may use besides the main
 * ones. own: the place has its own start and finish built (no race gantries).
 * laps: a circuit's race (2 unless it says: a lap of these streets takes a
 * minute or more, so two make a race of two to three minutes).
 */
export const COURSES = {
  downtown: { way: ['c_4_4', 'c_10_4', 'c_10_7', 'c_7_7', 'c_7_9', 'c_4_9'], loop: true, start: 140 },
  downtown_r: { reverseOf: 'downtown', start: 160 },
  uptown: { way: ['c_7_2', 'c_7_0', 'u_3_7', 'u_3_4', 'u_2_4', 'u_2_1', 'u_4_1', 'u_4_0', 'u_3_0', 'kd_0'] },
  oldtown: { way: ['ot_1_4', 'ot_7_4', 'ot_7_6', 'ot_8_6', 'ot_8_8', 'ot_6_8', 'ot_6_7', 'ot_1_7'], loop: true, start: 120 },
  oldtown_r: { reverseOf: 'oldtown', start: 130 },
  chinatown: { way: ['c_3_14', 'c_10_14', 'c_10_18', 'c_7_18', 'c_7_20', 'c_3_20'], loop: true, start: 130 },
  harbor: { way: ['hb_gn', 'hb_ne', 'hb_se', 'hb_sw', 'hb_nw'], loop: true, start: 90, types: ['quay'] },
  pier9: { way: ['wf_works', 'wf_pier', 'wf_beach', 'p9_c', 'p9_b', 'p9_a'], loop: true, start: 120, types: ['boardwalk'] },
  shipyard: { way: ['sy_w', 'sy_q1', 'sy_q2', 'sy_e', 'wf_hw', 'wf_gate', 'wf_he'], types: ['quay'] },
  interstate: { way: ['i9_wr', 'i9_cw', 'i9_j1', 'i9_j2', 'i9_ce', 'i9_e1', 'i9_e2'] },
  skyline: { way: ['sx_n1', 'sx_n2'], loop: true, start: 200, laps: 3, roads: ['sx_north', 'sx_loop'] },
  bayshore: { way: ['wf_beach', 'wf_cliff', 'bs_1', 'bs_2', 'bs_be', 'pt_e', 'pt_n'] },
  redwood: { way: ['rw_a', 'rw_b', 'rw_c', 'rw_d'], loop: true, start: 140 },
  crestwood: { way: ['cw_g', 'cw_b', 'cw_c', 'cw_d'], loop: true, start: 470 },
  ironwood: { way: ['iw_n', 'iw_s', 'iw_d', 'iw_c'], loop: true, start: 2160 },
  // (downhill, the way the Ghosts race it)
  kaido: { way: ['kd_top', 'kd_0'] },
  summit: { way: ['sm_j', 'sm_e', 'sm_s', 'sm_w'], loop: true, start: 150 },
  // (a hill climb: from the desert floor up the ridge to the Summit)
  ridgeline: { way: ['r99_n2', 'rg_e', 'rg_3', 'rg_2', 'rg_1', 'sm_e'] },
  route99: { way: ['bs_east', 'r99_s2', 'gt_j', 'r99_s1', 'i9_e2', 'r99_n1', 'r99_rr', 'r99_n2'] },
  redrock: { way: ['rr_w', 'rr_e', 'rr_r1', 'rr_r2', 'rr_r3'], loop: true, start: 120 },
  ghosttown: { way: ['gt_a', 'gt_b', 'gt_c', 'gt_d'], loop: true, start: 90, types: ['dirt'] },
  // (the strip's own line, tree and finish gantry: districts/drylake.js)
  drylake: { way: ['dl_a', 'dl_b'], types: ['strip'], start: 60, own: true },
};

const RACE_TYPES = new Set(['avenue', 'boulevard', 'street', 'cobble', 'freeway', 'expressway', 'ramp', 'highway', 'coastal', 'mountain', 'circuit', 'strip', 'quay']);

// ------------------------------------------------------------------ routing

/** The roads from node a to node b: [{ road, dir }] (dir +1 runs a→b along the road). */
function shortest(net, a, b, allowed, only, back = null) {
  const start = net.nodes.get(a), goal = net.nodes.get(b);
  if (!start || !goal) throw new Error(`course: no node ${!start ? a : b}`);
  const dist = new Map([[start, 0]]);
  const prev = new Map();
  const open = [start];
  while (open.length) {
    let bi = 0;
    for (let k = 1; k < open.length; k++) if (dist.get(open[k]) < dist.get(open[bi])) bi = k;
    const n = open.splice(bi, 1)[0];
    if (n === goal) break;
    for (const e of n.ends) {
      const r = e.road;
      // (never straight back down the road just driven)
      if (n === start && r === back) continue;
      if (only && !only.has(r.spec.id)) continue;
      if (!only && !allowed.has(r.rt.id)) continue;
      const m = e.end === 0 ? r.b : r.a;
      const d = dist.get(n) + r.length;
      if (d < (dist.get(m) ?? Infinity)) {
        dist.set(m, d);
        prev.set(m, { n, road: r, dir: e.end === 0 ? 1 : -1 });
        if (!open.includes(m)) open.push(m);
      }
    }
  }
  if (!prev.has(goal) && start !== goal) throw new Error(`course: no way from ${a} to ${b}`);
  const legs = [];
  for (let n = goal; n !== start;) {
    const p = prev.get(n);
    legs.unshift({ road: p.road, dir: p.dir });
    n = p.n;
  }
  return legs;
}

/** The route's legs for a course: [{ road, dir }], and whether it loops. */
export function courseRoute(net, id) {
  const C = COURSES[id];
  if (!C) return null;
  if (C.reverseOf) {
    const base = courseRoute(net, C.reverseOf);
    return { legs: base.legs.slice().reverse().map((l) => ({ road: l.road, dir: -l.dir })), loop: base.loop };
  }
  const allowed = new Set([...RACE_TYPES, ...(C.types || [])]);
  const only = C.roads ? new Set(C.roads) : null;
  const way = C.loop ? [...C.way, C.way[0]] : C.way;
  const legs = [];
  for (let k = 0; k < way.length - 1; k++) legs.push(...shortest(net, way[k], way[k + 1], allowed, only, legs.length ? legs[legs.length - 1].road : null));
  return { legs, loop: !!C.loop };
}

// ------------------------------------------------------------------ the race line

const nodeAt = (leg, end) => (end === 'in' ? (leg.dir > 0 ? leg.road.a : leg.road.b) : (leg.dir > 0 ? leg.road.b : leg.road.a));
/** Travel direction of a leg at its start ('in') or end ('out'). */
function legDir(leg, end) {
  const r = leg.road;
  const i = (end === 'in') === (leg.dir > 0) ? 0 : r.N - 1;
  return [r.TX[i] * leg.dir, r.TZ[i] * leg.dir];
}

/**
 * The course as a track definition's points ([x, z, radius, y, halfWidth])
 * and what the race needs besides: { points, walls ([left, right] distance
 * from the line to the road's edges, per point), loop, legs, junctions (each
 * junction passed, with the side roads to close off), roads, own (the place
 * has its own start and finish) }. On a road
 * with a median (a boulevard, a freeway) the race keeps to the right-hand
 * carriageway.
 */
export function buildCourse(id, net = worldNet()) {
  const route = courseRoute(net, id);
  if (!route) return null;
  const { legs, loop } = route;
  const n = legs.length;
  // each leg's line: how far right of the road's middle, how wide, where its walls are
  const info = legs.map((L) => {
    const rt = L.road.rt;
    const split = rt.median > 0;
    const off = split ? rt.median + (rt.hw - rt.median) / 2 : 0;
    const w = split ? (rt.hw - rt.median) / 2 : rt.hw;
    const reach = rt.hw + rt.shoulder + rt.walk;
    // (walls: to the median on the left of a split road, to the edge of the made road on the right)
    const wl = split ? off - rt.median : reach - 0.2, wr = reach - off - 0.2;
    return { off, w, wl, wr };
  });
  // at each junction between legs: how far back each leg stops (cut) and the corner's radius
  const joints = [];      // joints[k]: between leg k and leg k+1 (the last one closes a loop)
  for (let k = 0; k < n; k++) {
    const a = legs[k], b = legs[(k + 1) % n];
    if (k === n - 1 && !loop) { joints.push(null); break; }
    const node = nodeAt(a, 'out');
    const da = legDir(a, 'out'), db = legDir(b, 'in');
    const phi = Math.acos(Math.max(-1, Math.min(1, da[0] * db[0] + da[1] * db[1])));
    const big = Math.max(info[k].w, info[(k + 1) % n].w);
    const R = phi < 0.12 ? 60 : phi > 2.2 ? Math.max(9, big * 1.2) : Math.max(13, big * 1.9);
    const t = phi < 0.12 ? 0 : R * Math.tan(phi / 2);
    const trimA = a.dir > 0 ? a.road.trim1 : a.road.trim0, trimB = b.dir > 0 ? b.road.trim0 : b.road.trim1;
    const cut = (len, trim) => Math.min(len * 0.45, Math.max(trim + 1, phi < 0.12 ? 2 : t / 0.49 + 2));
    joints.push({ node, R, phi, da, db, cutA: cut(a.road.length, trimA), cutB: cut(b.road.length, trimB) });
  }
  // each leg's kept samples, on its line
  const SP = 8;
  const runs = legs.map((L, k) => {
    const r = L.road, I = info[k];
    const jin = loop || k > 0 ? joints[(k - 1 + n) % n] : null;
    const jout = joints[k] || null;
    const s0 = jin ? jin.cutB : 0, s1 = r.length - (jout ? jout.cutA : 0);
    const out = [];
    let last = -1e9;
    for (let q = 0; q < r.N; q++) {
      const i = L.dir > 0 ? q : r.N - 1 - q;
      const along = L.dir > 0 ? r.S[i] : r.length - r.S[i];
      if (along < s0 - 0.01 || along > s1 + 0.01) continue;
      const end = (!jin && q === 0) || (!jout && q === r.N - 1);
      if (along - last < SP && !end) continue;
      last = along;
      const ox = -r.LX[i] * L.dir * I.off, oz = -r.LZ[i] * L.dir * I.off;
      out.push({ x: r.X[i] + ox, z: r.Z[i] + oz, y: r.Y[i], w: I.w, wl: I.wl, wr: I.wr });
    }
    // (a short leg can lose every sample to its corners: keep its middle)
    if (!out.length) {
      const i = Math.floor(r.N / 2);
      out.push({ x: r.X[i] - r.LX[i] * L.dir * I.off, z: r.Z[i] - r.LZ[i] * L.dir * I.off, y: r.Y[i], w: I.w, wl: I.wl, wr: I.wr });
    }
    return out;
  });
  // join them: a corner vertex where each pair of lines meets
  const pts = [], walls = [];
  const corner = (k) => {
    const J = joints[k];
    const A = runs[k][runs[k].length - 1], B = runs[(k + 1) % n][0];
    const den = J.da[0] * J.db[1] - J.da[1] * J.db[0];
    let x = (A.x + B.x) / 2, z = (A.z + B.z) / 2;
    if (Math.abs(den) > 0.15) {
      const tA = ((B.x - A.x) * J.db[1] - (B.z - A.z) * J.db[0]) / den;
      if (tA > 0 && tA < 120) { x = A.x + J.da[0] * tA; z = A.z + J.da[1] * tA; }
    }
    pts.push([x, z, J.R, J.node.y, Math.max(A.w, B.w)]);
    walls.push([Math.max(A.wl, B.wl), Math.max(A.wr, B.wr)]);
  };
  for (let k = 0; k < n; k++) {
    if (loop || k > 0) corner((k - 1 + n) % n);
    for (const p of runs[k]) { pts.push([p.x, p.z, 30, p.y, p.w]); walls.push([p.wl, p.wr]); }
  }
  // the junctions passed and the roads that leave them (closed off for the race)
  const used = new Set(legs.map((l) => l.road));
  const junctions = [];
  const seen = new Set();
  const visit = (node) => {
    if (!node || seen.has(node) || node.kind !== 'junction') return;
    seen.add(node);
    const side = node.ends.filter((e) => !used.has(e.road));
    if (side.length) junctions.push({ node, side });
  };
  for (const L of legs) { visit(nodeAt(L, 'in')); visit(nodeAt(L, 'out')); }
  const own = !!(COURSES[id].own || COURSES[COURSES[id].reverseOf]?.own);
  return { points: pts, walls, loop, legs, junctions, roads: [...used], own };
}

const CACHE = new Map();
/** A course, worked out once a page. */
export function courseFor(id) {
  if (!CACHE.has(id)) CACHE.set(id, buildCourse(id));
  return CACHE.get(id);
}

/**
 * Walls for the race's Track (built from the course's points): for each of
 * its samples the course point it lies on (walking both in step) and that
 * point's walls.
 */
export function courseWalls(T, course) {
  const P = course.points, W = course.walls;
  let c = 0;
  for (let i = 0; i < T.N; i++) {
    const x = T.X[i], z = T.Z[i];
    let d = (P[c][0] - x) ** 2 + (P[c][1] - z) ** 2;
    for (let k = 1; k < 6; k++) {
      const j = course.loop ? (c + k) % P.length : Math.min(P.length - 1, c + k);
      const dd = (P[j][0] - x) ** 2 + (P[j][1] - z) ** 2;
      if (dd < d) { d = dd; c = j; }
    }
    T.WL[i] = Math.max(T.W[i] + 0.4, W[c][0]);
    T.WR[i] = Math.max(T.W[i] + 0.4, W[c][1]);
  }
}
