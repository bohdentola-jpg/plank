// FREE ROAM — where a region's ways out go. A circuit gets a side road off
// a straight (the site is searched for: straight, level, clear of the rest
// of the lap) running to a portal with two bores; a point-to-point road gets
// a single bore at each end, the road running on into it. Everything here is
// pure geometry: the stub roads (StubTracks, for physics and meshes), the
// portals (for the tunnel scenery and the trigger that loads the next
// region), the boxes of scenery to clear, and the terrain to shape.
import { StubTrack } from './roadnet.js';
import { links, placement } from './network.js';

export const G = {
  boreHW: 4.3,     // half-width of one bore's roadway
  divHW: 0.9,      // half the divider between two bores
  flare: 7,        // extra half-width where a side road meets the main road
  flareLen: 24,    // over which the mouth narrows to the bores' width
  approach: 50,    // main road edge → portal face
  depth: 74,       // portal block depth (the stretch of tunnel you can see into)
  tunnel: 320,     // length of a bore (the fade to the next region is long over by then)
  roof: 6.4,       // tunnel clear height
  wing: 11,        // portal face past the bores, each side
  nose: 16,        // divider nose ahead of the portal face
};

/** Plan the exits of a region (null if the road isn't on the map). */
export function planRegion(T) {
  const def = T.def;
  const L = links(def.id);
  if (!L) return null;
  const P = placement(def.id);
  const out = { id: def.id, links: L, portals: [], stubs: [], carve: [], raise: [], flatten: [], approach: null };
  if (T.closed) planJunction(T, out, P);
  else planEnds(T, out, P);
  return out;
}

function stubDef(id, env, points, hw, extra = {}) {
  return { id, env, type: 'sprint', width: hw * 2, points, radius: 0, wall: 0.4, shoulder: 0.6, offSurface: 'road', bank: 0, ...extra };
}

// ---------------------------------------------------------------- circuits

function planJunction(T, out, P) {
  const site = P.junction || findJunction(T);
  const { s, side } = site;
  const p = T.posAt(s);
  const i = p.i;
  const W = T.W[i];
  const ux = T.LX[i] * side, uz = T.LZ[i] * side;   // out of the main road
  const vx = uz, vz = -ux;                           // the side road's own left
  const x0 = p.x, z0 = p.z;
  const y0 = T.roadY(i, 0, 0);
  const at = (d, o = 0) => [x0 + ux * d + vx * o, z0 + uz * d + vz * o];
  const laneHW = G.divHW + 2 * G.boreHW;
  // a city side street has sidewalks (and a tighter corner); elsewhere barriers at the edge
  const city = T.def.env === 'city';
  const mouthHW = laneHW + (city ? 4 : G.flare);
  const dF = W + G.approach;
  const edge = city ? { wall: 3.4, shoulder: 3.4, shoulderLift: 0.15, shoulderSurface: 'sidewalk', walk: 3.4 } : {};
  // the mouth is wide where it meets the main road and narrows to the bores
  const widthFn = (d) => (d <= W ? mouthHW : d >= W + G.flareLen ? laneHW : laneHW + (mouthHW - laneHW) * (1 - smooth((d - W) / G.flareLen)));
  // (it ends at the divider's nose: from there on the two bores are separate roads)
  const S0 = new StubTrack(stubDef(`${T.def.id}~side`, T.def.env, [[...at(0), 0, y0], [...at(dF - G.nose + 1), 0, y0]], laneHW, { widthFn, ...edge }), T, { d0: W, d1: W + G.flareLen });
  S0.terrain = T.terrain;
  out.stubs.push(S0);
  // (the same road run on to the portal face, for drawing what lines it)
  const look = new StubTrack(stubDef(`${T.def.id}~look`, T.def.env, [[...at(0), 0, y0], [...at(dF + 0.5), 0, y0]], laneHW, { widthFn, ...edge }), T, { d0: W, d1: W + G.flareLen });
  out.approach = { road: S0, look, from: W, to: dF - G.nose, face: dF, x0, z0, y0, ux, uz, vx, vz, W, s, side, mouthHW, laneHW, walk: edge.walk || 0 };
  // 'next' takes the bore on the race direction's side
  const tdot = vx * T.TX[i] + vz * T.TZ[i];
  const off = G.divHW + G.boreHW;
  for (const exit of ['next', 'prev']) {
    const o = (exit === 'next' ? 1 : -1) * Math.sign(tdot || 1) * off;
    const bore = new StubTrack(stubDef(`${T.def.id}~${exit}`, T.def.env, [
      [...at(dF - G.nose, o), 0, y0, G.boreHW], [...at(dF + G.tunnel, o), 0, y0, G.boreHW],
    ], G.boreHW, { wall: 0.25, shoulder: 0.3 }));
    bore.terrain = T.terrain;
    out.stubs.push(bore);
    const [fx, fz] = at(dF, o);
    out.portals.push({ exit, to: out.links[exit], x: fx, z: fz, y: y0, ax: ux, az: uz, hw: G.boreHW, off: o, road: bore, s0: G.nose });
  }
  const [cx, cz] = at(dF);
  out.faces = [{ x: cx, z: cz, y: y0, ax: ux, az: uz, hw: laneHW + G.wing, bores: out.portals.map((q) => ({ off: q.off, hw: G.boreHW, to: q.to, exit: q.exit })) }];
  // clear the scenery: the side road (past the main road's edge) and the portal block
  out.carve.push({ kind: 'road', road: S0, s0: W - 0.3, s1: dF, pad: 1.4 + (edge.walk || 0) });
  out.carve.push({ kind: 'box', x: x0, z: z0, ux, uz, a0: dF - G.nose - 1, a1: dF, hw: laneHW + 1.4 });
  out.carve.push({ kind: 'box', x: x0, z: z0, ux, uz, a0: dF - 0.6, a1: dF + G.depth, hw: laneHW + G.wing + 0.5 });
  // terrain: level under the side road, a hill over the tunnel
  out.flatten.push(S0);
  out.raise.push({ x: x0, z: z0, ux, uz, a0: dF + 0.5, a1: dF + G.depth + 30, hw: laneHW + G.wing - 3, y: y0 + G.roof + 2.6, fall: 26 });
}

/** Best place for the side road: a long, level straight with open ground on one side. */
export function findJunction(T) {
  let best = null;
  const flat = 1 / 380;
  const straightAt = (s) => Math.abs(T.Ks[T.posAt(s).i]) < flat;
  for (let s = 0; s < T.length; s += 4) {
    if (Math.abs(T.deltaS(T.startS, s)) < 80) continue;
    let ok = true;
    for (let d = -32; d <= 32 && ok; d += 2) if (!straightAt(s + d)) ok = false;
    if (!ok) continue;
    const grade = Math.abs(T.posAt(s + 24).y - T.posAt(s - 24).y) / 48;
    if (grade > 0.04) continue;
    let a = 0, b = 0;
    while (a < 400 && straightAt(s - a - 2)) a += 2;
    while (b < 400 && straightAt(s + b + 2)) b += 2;
    const i = T.posAt(s).i;
    const W = T.W[i];
    for (const side of [1, -1]) {
      const ux = T.LX[i] * side, uz = T.LZ[i] * side, vx = uz, vz = -ux;
      let clear = Infinity;
      for (let d = W + 4; d <= W + G.approach + G.depth + 30 && clear >= 18; d += 6) {
        for (const o of [-27, -14, 0, 14, 27]) {
          const x = T.X[i] + ux * d + vx * o, z = T.Z[i] + uz * d + vz * o;
          if (!onLand(T, x, z)) { clear = -1; break; }
          const k = T.nearestIndex(x, z, 2);
          if (k < 0 || Math.abs(T.deltaS(k * T.step, s)) < 45) continue;
          clear = Math.min(clear, T.distToRoad(x, z) - T.W[k]);
        }
      }
      if (clear < 18) continue;
      const score = Math.min(a + b, 320) + Math.min(a, b) * 0.8 - grade * 900 + Math.min(clear, 90) * 0.5;
      if (!best || score > best.score) best = { s, side, score, clear };
    }
  }
  return best || { s: (T.startS + T.length / 2) % T.length, side: 1, score: 0 };
}

// ---------------------------------------------------------------- point to point

function planEnds(T, out, P) {
  for (const at of ['start', 'end']) {
    const exit = (at === 'start') !== !!P.flip ? 'prev' : 'next';
    const i = at === 'start' ? 0 : T.N - 1;
    const sgn = at === 'start' ? -1 : 1;
    const ux = T.TX[i] * sgn, uz = T.TZ[i] * sgn;
    const vx = uz, vz = -ux;
    const x0 = T.X[i], z0 = T.Z[i];
    const W = T.W[i];
    const y0 = T.roadY(i, 0, 0);
    const pt = (d) => [x0 + ux * d, z0 + uz * d, 0, y0, W];
    // the road runs on into the bore (overlapping its last few metres)
    const bore = new StubTrack(stubDef(`${T.def.id}~${exit}`, T.def.env, [pt(-8), pt(G.tunnel)], W, { wall: 0.3, shoulder: 0.4 }), T, { d0: 8, d1: 22 });
    bore.terrain = T.terrain;
    out.stubs.push(bore);
    out.portals.push({ exit, to: out.links[exit], x: x0, z: z0, y: y0, ax: ux, az: uz, hw: W, off: 0, road: bore, end: at, s0: 8 });
    (out.faces || (out.faces = [])).push({ x: x0, z: z0, y: y0, ax: ux, az: uz, hw: W + G.wing, bores: [{ off: 0, hw: W, to: out.links[exit], exit }] });
    out.carve.push({ kind: 'box', x: x0, z: z0, ux, uz, a0: -4, a1: G.depth, hw: W + 1.2 });
    out.carve.push({ kind: 'box', x: x0, z: z0, ux, uz, a0: -0.8, a1: G.depth, hw: W + G.wing + 0.5 });
    out.raise.push({ x: x0, z: z0, ux, uz, a0: 0.8, a1: G.depth + 30, hw: W + G.wing - 3, y: y0 + G.roof + 2.6, fall: 26 });
    void vx; void vz;
  }
}

/** Docks: everything off the quays is harbor water. */
function onLand(T, x, z) {
  const land = T.def.docks?.land;
  if (!land) return true;
  return land.some(([x0, z0, x1, z1]) => x > Math.min(x0, x1) + 6 && x < Math.max(x0, x1) - 6 && z > Math.min(z0, z1) + 6 && z < Math.max(z0, z1) - 6);
}

const smooth = (t) => { const k = Math.max(0, Math.min(1, t)); return k * k * (3 - 2 * k); };
