// Quahog's street plan. Not a grid: a bent Main Street, a diagonal that cuts
// the south-east in half, a shore road that follows the water, a park loop and
// a proper dead-end cul-de-sac for Spooner Street.
//
// Every road is a polyline. The same data paints the ground, drives the
// traffic, walks the pedestrians and decides where buildings may stand.

export const HALF = 320;
export const SHORE_X = 272;

const R = (name, w, pts, opts = {}) => ({ name, w, pts, loop: !!opts.loop, kind: opts.kind || 'street' });

/** A ring of points, for cul-de-sac bulbs and the park loop. */
function ring(cx, cz, r, n = 10, squash = 1) {
  const pts = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    pts.push([cx + Math.cos(a) * r, cz + Math.sin(a) * r * squash]);
  }
  return pts;
}

export const ROADS = [
  // ---- the edges of town
  R('north', 15, [[-280, -256], [-150, -264], [-20, -258], [120, -264], [248, -252]], { kind: 'highway' }),
  R('west', 13, [[-280, -256], [-274, -140], [-282, -30], [-272, 110], [-276, 244]]),
  R('south', 13, [[-276, 244], [-140, 250], [0, 246], [120, 250], [214, 240]]),
  R('shore', 13, [[248, -252], [262, -186], [252, -110], [266, -24], [258, 60], [238, 150], [214, 240]]),

  // ---- the spine
  R('main', 17, [[-20, -258], [-16, -186], [-4, -120], [0, -60], [2, 10], [6, 110], [10, 246]], { kind: 'avenue' }),
  R('quahogave', 15, [[0, -48], [62, 2], [124, 52], [186, 96], [214, 150]], { kind: 'avenue' }),

  // ---- cross streets
  R('harbor', 13, [[-274, -140], [-150, -146], [-40, -150], [60, -146], [160, -150], [256, -144]]),
  R('center', 15, [[-282, -30], [-180, -38], [-96, -44], [0, -48], [90, -40], [180, -32], [265, -26]], { kind: 'avenue' }),
  R('southside', 13, [[-272, 110], [-160, 104], [-60, 100], [40, 104], [140, 98], [252, 94]]),
  R('mill', 12, [[-160, 104], [-152, 176], [-40, 182], [80, 176], [190, 172], [238, 150]]),

  // ---- north-south connectors
  R('elm', 13, [[-150, -264], [-152, -146], [-150, -38], [-160, 104], [-152, 176]]),
  R('pine', 13, [[120, -264], [118, -146], [110, -40], [104, 100]]),
  R('dock', 12, [[190, -146], [186, -88], [180, -32]]),
  R('birch', 12, [[-70, -146], [-66, -100], [-62, -44]]),

  // ---- Spooner Street: off Elm, dead end, bulb at the far end
  R('spooner', 11, [[-151, -192], [-184, -195], [-213, -197]], { kind: 'residential' }),
  R('spoonerbulb', 10, ring(-231, -198, 17, 10), { loop: true, kind: 'residential' }),

  // ---- the loop road around Quahog Park
  R('parkloop', 11, ring(56, -196, 46, 12, 0.82), { loop: true }),

  // ---- little residential loops so the west is not all straight lines
  R('maple', 11, [[-150, 60], [-198, 56], [-236, 62], [-246, 22], [-214, 6], [-172, 12], [-150, -38]], { kind: 'residential' }),
  R('cedar', 11, [[-152, 176], [-206, 182], [-244, 168], [-250, 128], [-224, 112]], { kind: 'residential' }),
  R('millside', 11, [[-40, 182], [-38, 232]], { kind: 'residential' }),
  R('airportrd', 12, [[80, 176], [84, 214], [150, 218], [190, 172]]),
];

export const ROAD_BY_NAME = Object.fromEntries(ROADS.map((r) => [r.name, r]));

// ------------------------------------------------------------------ geometry
function segLengths(road) {
  if (road._lens) return road._lens;
  const pts = road.loop ? [...road.pts, road.pts[0]] : road.pts;
  const lens = [];
  let total = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    const d = Math.hypot(pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1]);
    lens.push(d);
    total += d;
  }
  road._lens = { lens, total, pts };
  return road._lens;
}

/** Point and heading a fraction `t` along a road. */
export function roadPoint(name, t) {
  const road = typeof name === 'string' ? ROAD_BY_NAME[name] : name;
  const { lens, total, pts } = segLengths(road);
  let want = Math.max(0, Math.min(1, t)) * total;
  for (let i = 0; i < lens.length; i++) {
    if (want <= lens[i] || i === lens.length - 1) {
      const f = lens[i] ? want / lens[i] : 0;
      const [ax, az] = pts[i], [bx, bz] = pts[i + 1];
      const x = ax + (bx - ax) * f;
      const z = az + (bz - az) * f;
      const dir = Math.atan2(bx - ax, bz - az);
      return { x, z, dir, w: road.w };
    }
    want -= lens[i];
  }
  return { x: pts[0][0], z: pts[0][1], dir: 0, w: road.w };
}

/**
 * A building plot beside a road: `side` is +1 for the right-hand side looking
 * along the polyline, -1 for the left. Returns a position and the rotation
 * that makes the building's front (its +Z) face the street.
 */
export function plot(name, t, side, dist) {
  const p = roadPoint(name, t);
  const nx = Math.cos(p.dir) * side;
  const nz = -Math.sin(p.dir) * side;
  return {
    x: p.x + nx * (p.w / 2 + dist),
    z: p.z + nz * (p.w / 2 + dist),
    rot: Math.atan2(-nx, -nz),
    dir: p.dir,
  };
}

// -------------------------------------------------------------- distance
function distToSeg(x, z, ax, az, bx, bz) {
  const dx = bx - ax, dz = bz - az;
  const l2 = dx * dx + dz * dz;
  const t = l2 ? Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / l2)) : 0;
  const px = ax + dx * t, pz = az + dz * t;
  return { d: Math.hypot(x - px, z - pz), px, pz, t, dir: Math.atan2(dx, dz) };
}

/** Nearest point on the whole network. */
export function nearestRoad(x, z) {
  let best = null;
  for (const road of ROADS) {
    const { pts } = segLengths(road);
    for (let i = 0; i < pts.length - 1; i++) {
      const r = distToSeg(x, z, pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1]);
      if (!best || r.d < best.d) best = { ...r, road, seg: i };
    }
  }
  return best;
}

/** Is this point on tarmac (or within `margin` of it)? */
export function onRoad(x, z, margin = 0) {
  const n = nearestRoad(x, z);
  return n && n.d < n.road.w / 2 + margin;
}

/** How far clear of every road is this point? */
export function roadClearance(x, z) {
  const n = nearestRoad(x, z);
  return n ? n.d - n.road.w / 2 : 999;
}

// ------------------------------------------------------------------- graph
// Junction nodes are shared points; the traffic and the crowd walk this.
let GRAPH = null;

export function roadGraph() {
  if (GRAPH) return GRAPH;
  const nodes = [];
  const key = new Map();
  const nodeAt = (x, z) => {
    // snap nearby endpoints together so roads actually join up
    for (const n of nodes) {
      if (Math.hypot(n.x - x, n.z - z) < 9) return n;
    }
    const n = { id: nodes.length, x, z, links: [] };
    nodes.push(n);
    key.set(`${x},${z}`, n);
    return n;
  };
  const edges = [];
  for (const road of ROADS) {
    const { pts } = segLengths(road);
    for (let i = 0; i < pts.length - 1; i++) {
      const a = nodeAt(pts[i][0], pts[i][1]);
      const b = nodeAt(pts[i + 1][0], pts[i + 1][1]);
      if (a === b) continue;
      const e = { a, b, w: road.w, road: road.name, len: Math.hypot(b.x - a.x, b.z - a.z) };
      edges.push(e);
      a.links.push({ node: b, edge: e });
      b.links.push({ node: a, edge: e });
    }
  }
  // roads that merely cross each other still need a junction, or traffic on
  // Main Street would never turn onto the avenue it drives straight over
  for (let i = 0; i < edges.length; i++) {
    for (let j = i + 1; j < edges.length; j++) {
      const e1 = edges[i], e2 = edges[j];
      if (e1.road === e2.road) continue;
      const hit = crossing(e1, e2);
      if (!hit) continue;
      const n = nodeAt(hit.x, hit.z);
      if (n.links.some((l) => l.edge === e1) || n.links.some((l) => l.edge === e2)) continue;
      for (const e of [e1, e2]) {
        n.links.push({ node: e.a, edge: e });
        n.links.push({ node: e.b, edge: e });
        e.a.links.push({ node: n, edge: e });
        e.b.links.push({ node: n, edge: e });
      }
    }
  }
  // T-junctions: a road that simply ends on another one (Spooner Street meeting
  // Elm, say) has to be wired in too, or nothing can ever drive into it.
  for (const n of nodes) {
    for (const e of edges) {
      if (e.a === n || e.b === n) continue;
      if (n.links.some((l) => l.edge === e)) continue;
      const d = distToSeg(n.x, n.z, e.a.x, e.a.z, e.b.x, e.b.z);
      if (d.d > e.w / 2 + 3 || d.t < 0.02 || d.t > 0.98) continue;
      n.links.push({ node: e.a, edge: e });
      n.links.push({ node: e.b, edge: e });
      e.a.links.push({ node: n, edge: e });
      e.b.links.push({ node: n, edge: e });
    }
  }
  GRAPH = { nodes, edges };
  return GRAPH;
}

function crossing(e1, e2) {
  const x1 = e1.a.x, z1 = e1.a.z, x2 = e1.b.x, z2 = e1.b.z;
  const x3 = e2.a.x, z3 = e2.a.z, x4 = e2.b.x, z4 = e2.b.z;
  const den = (x1 - x2) * (z3 - z4) - (z1 - z2) * (x3 - x4);
  if (Math.abs(den) < 1e-6) return null;
  const t = ((x1 - x3) * (z3 - z4) - (z1 - z3) * (x3 - x4)) / den;
  const u = ((x1 - x3) * (z1 - z2) - (z1 - z3) * (x1 - x2)) / den;
  if (t < 0.02 || t > 0.98 || u < 0.02 || u > 0.98) return null;
  return { x: x1 + t * (x2 - x1), z: z1 + t * (z2 - z1) };
}

/** A random edge with room to spawn on, near a point. */
export function edgesNear(x, z, min, max) {
  const { edges } = roadGraph();
  return edges.filter((e) => {
    const mx = (e.a.x + e.b.x) / 2, mz = (e.a.z + e.b.z) / 2;
    const d = Math.hypot(mx - x, mz - z);
    return d > min && d < max;
  });
}
