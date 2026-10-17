// PORT HALCYON — road meshes for one world cell: every road sample the cell
// owns (and the strip on to the next one) becomes carriageway, shoulders,
// kerbs and sidewalks, a median, edge barriers (jersey / guardrail), and on
// bridges and viaducts the deck, its parapets and its piers. Junction nodes
// in the cell get their paving (curb corners rounded, crosswalks on city
// streets). Street lamps stand along the roads; where they are is fixed by
// the road alone (roadLamps), so a cell can bake its neighbours' light too.
import * as THREE from 'three';
import { F_BRIDGE, F_ELEV, F_TUNNEL } from '../net.js';
import { CELL } from '../terrain.js';
import { natural } from '../terrain.js';
import { districtAt } from '../ground.js';
import * as K from '../kit.js';
import { curbTexture } from '../../track/textures.js';

const IDX = 32;

// ------------------------------------------------------------------ lamps

const LAMP = {
  city: { h: 8.2, arm: 1.8, color: '#ffb35a', both: false, glow: 17 },
  led: { h: 9.0, arm: 2.2, color: '#e6eeff', both: true, glow: 18 },
  boulevard: { h: 7.0, arm: 1.2, color: '#ffd9a0', both: true, glow: 15, twin: true },
  gas: { h: 4.4, arm: 0, color: '#ffc27a', both: true, glow: 11 },
  lantern: { h: 5.0, arm: 0.6, color: '#ff6a4a', both: true, glow: 12 },
  highway: { h: 11.5, arm: 2.6, color: '#ffa04a', both: false, glow: 24 },
  coast: { h: 8.5, arm: 1.6, color: '#ffd29a', both: false, glow: 18 },
  mast: { h: 22, arm: 0, color: '#d8e4ff', both: false, glow: 40 },
  wall: { h: 4.2, arm: 0.5, color: '#ffcf8a', both: false, glow: 10 },
};
// districts that light their streets their own way
const DISTRICT_LAMP = { downtown: 'led', chinatown: 'lantern', oldtown: 'gas', uptown: 'boulevard' };

/** Where every street lamp along a road stands (cached on the road). */
export function roadLamps(r) {
  if (r._lamps) return r._lamps;
  const out = [];
  const rt = r.rt;
  if (rt.lamp && rt.lampEvery) {
    const L = r.length;
    const s0 = r.closed ? 0 : r.trim0 + 6, s1 = r.closed ? L : L - r.trim1 - 6;
    let side = 1, k = 0;
    for (let s = s0 + rt.lampEvery * 0.5; s < s1; s += rt.lampEvery, k++) {
      const p = r.posAt(s);
      const i = p.i;
      const d = districtAt(p.x, p.z);
      const style = rt.lamp === 'city' || rt.lamp === 'boulevard' ? (DISTRICT_LAMP[d?.style] || rt.lamp) : rt.lamp;
      const L0 = LAMP[style];
      const sides = L0.both || rt.walk > 4 ? [1, -1] : [side];
      side = -side;
      for (const sd of sides) {
        const off = rt.walk > 0 ? rt.hw + rt.shoulder + 0.7 : style === 'wall' ? rt.hw + rt.shoulder + 0.3 : rt.hw + rt.shoulder + 1.4;
        const lat = sd * off;
        const x = r.X[i] + r.LX[i] * lat, z = r.Z[i] + r.LZ[i] * lat;
        const y = r.roadY(i, 0, Math.max(-rt.hw, Math.min(rt.hw, lat))) + (rt.walk > 0 ? rt.curb : 0);
        // the head hangs out over the road
        const hx = x - r.LX[i] * sd * L0.arm, hz = z - r.LZ[i] * sd * L0.arm;
        out.push({ x, y, z, hx, hy: y + L0.h, hz, side: sd, style, color: new THREE.Color(L0.color), radius: L0.glow, ry: Math.atan2(r.LX[i] * sd, r.LZ[i] * sd), road: r });
      }
    }
  }
  r._lamps = out;
  return out;
}

/** Lamps standing within a box (for baking a cell's light, its neighbours' too). */
export function lampsInBox(net, x0, z0, x1, z1, out = []) {
  out.length = 0;
  const seen = new Set();
  for (let cx = Math.floor((x0 - 30) / IDX); cx <= Math.floor((x1 + 30) / IDX); cx++) {
    for (let cz = Math.floor((z0 - 30) / IDX); cz <= Math.floor((z1 + 30) / IDX); cz++) {
      const list = net.grid.get((cx + 32768) * 65536 + cz + 32768);
      if (!list) continue;
      for (let k = 0; k < list.length; k += 2) {
        const r = net.roads[list[k]];
        if (seen.has(r)) continue;
        seen.add(r);
        for (const L of roadLamps(r)) if (L.hx >= x0 && L.hx <= x1 && L.hz >= z0 && L.hz <= z1) out.push(L);
      }
    }
  }
  return out;
}

// ------------------------------------------------------------------ strips

/**
 * Strip along road samples idxs; cols = [{ lat, dy, u }] ordered so the face
 * points where it should (see below). v = s / vLen.
 */
function strip(acc, r, idxs, cols, vLen = 8) {
  const nc = cols.length;
  const base = acc.count;
  for (const i of idxs) {
    const sv = r.S[i] / vLen;
    for (const c of cols) {
      const lat = c.lat;
      const cl = Math.max(-r.rt.hw, Math.min(r.rt.hw, lat));
      acc.v(r.X[i] + r.LX[i] * lat, r.roadY(i, 0, cl) + (c.dy || 0), r.Z[i] + r.LZ[i] * lat, c.u, sv);
    }
  }
  for (let k = 0; k < idxs.length - 1; k++) {
    for (let c = 0; c < nc - 1; c++) {
      const a = base + k * nc + c, b = a + 1, d = a + nc, e = d + 1;
      acc.tri(a, d, b);
      acc.tri(b, d, e);
    }
  }
}

/** A wall face along the road at lat from dy0 up to dy1, facing +side·left. */
function wall(acc, r, idxs, lat, dy0, dy1, facing, vLen = 4) {
  // facing +1: normal points to the road's left (+lat); −1: to its right
  const cols = facing > 0 ? [{ lat, dy: dy1, u: dy1 }, { lat, dy: dy0, u: dy0 }] : [{ lat, dy: dy0, u: dy0 }, { lat, dy: dy1, u: dy1 }];
  strip(acc, r, idxs, cols, vLen);
}

// ------------------------------------------------------------------ the cell

/** Which samples of which roads this cell owns: Map road → sorted indices. */
function owned(net, cx, cz) {
  const out = new Map();
  const x0 = cx * CELL, z0 = cz * CELL;
  for (let gx = Math.floor(x0 / IDX); gx < Math.floor((x0 + CELL) / IDX); gx++) {
    for (let gz = Math.floor(z0 / IDX); gz < Math.floor((z0 + CELL) / IDX); gz++) {
      const list = net.grid.get((gx + 32768) * 65536 + gz + 32768);
      if (!list) continue;
      for (let k = 0; k < list.length; k += 2) {
        const r = net.roads[list[k]], i = list[k + 1];
        if (Math.floor(r.X[i] / CELL) !== cx || Math.floor(r.Z[i] / CELL) !== cz) continue;
        let a = out.get(r);
        if (!a) { a = []; out.set(r, a); }
        a.push(i);
      }
    }
  }
  for (const a of out.values()) a.sort((p, q) => p - q);
  return out;
}

/** Split sorted sample indices into runs of consecutive samples (closed roads wrap). */
function runs(r, idx) {
  const out = [];
  let cur = [];
  for (const i of idx) {
    if (cur.length && i !== cur[cur.length - 1] + 1) { out.push(cur); cur = []; }
    cur.push(i);
  }
  if (cur.length) out.push(cur);
  // closed loop: a run ending at N-1 joins one starting at 0
  if (r.closed && out.length > 1 && out[0][0] === 0 && out[out.length - 1][out[out.length - 1].length - 1] === r.N - 1) {
    const last = out.pop();
    out[0] = [...last, ...out[0]];
  }
  return out;
}

/**
 * Build the cell's roads into the batch. Returns { lamps (owned), piers
 * (positions, for colliders), nodes (junctions built) }.
 */
export function buildRoads(net, cx, cz, batch, opts = {}) {
  const wet = !!opts.wet;
  const res = { lamps: [], piers: [] };
  const own = owned(net, cx, cz);
  for (const [r, idx] of own) {
    for (const run of runs(r, idx)) {
      // the strip on to the next sample belongs to this cell too
      const last = run[run.length - 1];
      const next = r.closed ? (last + 1) % r.N : last + 1;
      if (next < r.N && next !== run[0]) run.push(next);
      // trimmed at junctions
      const keep = run.filter((i) => r.closed || (r.S[i] >= r.trim0 - 0.01 && r.S[i] <= r.length - r.trim1 + 0.01));
      if (keep.length < 2) continue;
      // split by ground / off the ground (bridges and viaducts are dressed differently)
      let seg = [keep[0]];
      let kind = (r.flags[keep[0]] & (F_BRIDGE | F_ELEV)) ? 1 : 0;
      for (let k = 1; k < keep.length; k++) {
        const i = keep[k];
        const kk = (r.flags[i] & (F_BRIDGE | F_ELEV)) ? 1 : 0;
        seg.push(i);
        if (kk !== kind || k === keep.length - 1) {
          emitRun(r, seg, kind, batch, wet, res);
          seg = [i];
          kind = kk;
        }
      }
    }
    // lamps whose post stands in this cell
    for (const L of roadLamps(r)) if (Math.floor(L.x / CELL) === cx && Math.floor(L.z / CELL) === cz) res.lamps.push(L);
  }
  // junctions whose node is in this cell
  for (const n of net.nodes.values()) {
    if (n.kind !== 'junction') continue;
    if (Math.floor(n.x / CELL) !== cx || Math.floor(n.z / CELL) !== cz) continue;
    emitJunction(n, batch, wet);
  }
  for (const L of res.lamps) emitLamp(L, batch);
  return res;
}

function emitRun(r, idxs, offGround, batch, wet, res) {
  if (idxs.length < 2) return;
  const rt = r.rt;
  const hw = rt.hw, sh = rt.shoulder, wk = rt.walk, cb = rt.curb;
  const rm = K.roadMat(rt, wet);
  const vLen = rm.userData.vLen || 12;
  const full = rm.userData.uFull;
  const uOf = (lat) => (full ? (lat + hw) / (2 * hw) : (lat + hw) / vLen);
  // carriageway
  strip(batch.get(rm), r, idxs, [-hw, -hw / 2, 0, hw / 2, hw].map((lat) => ({ lat, dy: 0, u: uOf(lat) })), vLen);
  // shoulders
  if (sh > 0) {
    const sm = rt.shoulderSurface === 'curb' ? kerbMat() : rt.shoulderSurface === 'road' ? K.junctionMat(wet) : K.shoulderMat(rt.shoulderSurface);
    const kerb = rt.shoulderSurface === 'curb';
    for (const sd of [1, -1]) {
      const a = sd * hw, b = sd * (hw + sh);
      const cols = sd > 0 ? [{ lat: a, u: 0 }, { lat: b, u: 1 }] : [{ lat: b, u: 1 }, { lat: a, u: 0 }];
      strip(batch.get(sm), r, idxs, cols.map((c) => ({ ...c, dy: kerb ? 0.03 : 0 })), kerb ? 3 : 6);
    }
  }
  const edgeLat = hw + sh;
  // kerbs and sidewalks
  if (wk > 0) {
    const cm = K.curbMat(), wm = K.sidewalkMat();
    for (const sd of [1, -1]) {
      wall(batch.get(cm), r, idxs, sd * edgeLat, 0, cb, -sd);
      const a = sd * edgeLat, b = sd * (edgeLat + wk);
      const cols = sd > 0 ? [{ lat: a, u: 0 }, { lat: b, u: wk / 4 }] : [{ lat: b, u: wk / 4 }, { lat: a, u: 0 }];
      strip(batch.get(wm), r, idxs, cols.map((c) => ({ ...c, dy: cb })), 4);
    }
  }
  const reach = edgeLat + wk;
  // median: grass between kerbs (boulevards), a jersey barrier (freeways)
  if (rt.median > 0) {
    if (rt.edge === 'jersey') jersey(batch.get(K.concreteMat()), r, idxs, 0, 0);
    else {
      const m = rt.median;
      wall(batch.get(K.curbMat()), r, idxs, m, 0, 0.15, 1);
      wall(batch.get(K.curbMat()), r, idxs, -m, 0, 0.15, -1);
      strip(batch.get(K.medianMat()), r, idxs, [{ lat: -m, dy: 0.15, u: 0 }, { lat: m, dy: 0.15, u: m / 3 }], 4);
    }
  }
  if (!offGround) {
    // the edge of the made ground: a skirt down into the earth
    for (const sd of [1, -1]) wall(batch.get(wk > 0 ? K.curbMat() : K.shoulderMat('gravel')), r, idxs, sd * reach, -1.4, wk > 0 ? cb : 0, sd);
    if (rt.edge === 'jersey') for (const sd of [1, -1]) jersey(batch.get(K.concreteMat()), r, idxs, sd * edgeLat, sd);
    else if (rt.edge === 'rail') for (const sd of [1, -1]) guardrail(batch, r, idxs, sd * (edgeLat + 0.35), sd);
  } else {
    bridgeDeck(batch, r, idxs, reach, res);
  }
}

let _kerb = null;
function kerbMat() {
  if (!_kerb) _kerb = K.glowMat({ map: curbTexture(), roughness: 0.6, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2 }, 2.4);
  return _kerb;
}

/**
 * Jersey barrier: side +1 on the road's left edge (its body out to +lat), −1
 * on the right edge, 0 down the median (both faces). Sloped faces list their
 * columns by ascending lat, which turns them toward the carriageway.
 */
function jersey(acc, r, idxs, lat, side) {
  const prof = [[0, 0], [0.06, 0.08], [0.2, 0.32], [0.26, 0.82]];
  const asc = (a) => a.sort((p, q) => p.lat - q.lat);
  if (side === 0) {
    strip(acc, r, idxs, asc(prof.map(([dl, dy]) => ({ lat: 0.3 - dl, dy, u: dy }))), 3);
    strip(acc, r, idxs, asc(prof.map(([dl, dy]) => ({ lat: -0.3 + dl, dy, u: dy }))), 3);
    strip(acc, r, idxs, [{ lat: -0.04, dy: 0.82, u: 0 }, { lat: 0.04, dy: 0.82, u: 0.1 }], 3);
    return;
  }
  strip(acc, r, idxs, asc(prof.map(([dl, dy]) => ({ lat: lat + side * dl, dy, u: dy }))), 3);
  const t0 = lat + side * 0.26, t1 = lat + side * 0.38;
  strip(acc, r, idxs, [{ lat: Math.min(t0, t1), dy: 0.82, u: 0 }, { lat: Math.max(t0, t1), dy: 0.82, u: 0.1 }], 3);
  wall(acc, r, idxs, t1, -0.3, 0.82, side, 3);
}

/** W-beam guardrail on posts. */
function guardrail(batch, r, idxs, lat, side) {
  const st = batch.get(K.steelMat());
  wall(st, r, idxs, lat, 0.45, 0.78, -side, 2);
  wall(st, r, idxs, lat + side * 0.05, 0.45, 0.78, side, 2);
  const pm = batch.get(K.poleMat());
  for (const i of idxs) {
    if (Math.round(r.S[i] / 2) % 2) continue;   // a post every 4 m
    const x = r.X[i] + r.LX[i] * (lat + side * 0.12), z = r.Z[i] + r.LZ[i] * (lat + side * 0.12);
    const y = r.roadY(i, 0, Math.max(-r.rt.hw, Math.min(r.rt.hw, lat)));
    pm.box(x, y - 0.3, z, 0.12, 1.05, 0.12, Math.atan2(r.TX[i], r.TZ[i]));
  }
}

/** Off the ground: the deck slab, its parapets, piers down to the ground or the water. */
function bridgeDeck(batch, r, idxs, reach, res) {
  const cm = batch.get(K.concreteMat());
  const w = reach + 0.45;
  // underside and fascias
  strip(cm, r, idxs, [{ lat: w, dy: -1.5, u: 0 }, { lat: -w, dy: -1.5, u: w / 2 }], 6);
  for (const sd of [1, -1]) wall(cm, r, idxs, sd * w, -1.5, 1.05, sd, 4);
  // parapets
  for (const sd of [1, -1]) {
    wall(cm, r, idxs, sd * reach, 0, 1.05, -sd, 4);
    strip(cm, r, idxs, sd > 0 ? [{ lat: reach, dy: 1.05, u: 0 }, { lat: w, dy: 1.05, u: 0.2 }] : [{ lat: -w, dy: 1.05, u: 0.2 }, { lat: -reach, dy: 1.05, u: 0 }], 4);
  }
  // piers (where they stand is the road's business: see roadPiers)
  const pm = batch.get(K.darkConcreteMat());
  const inRun = new Set(idxs.slice(0, -1));
  for (const P of roadPiers(r)) {
    if (!inRun.has(P.i)) continue;
    for (const c of P.cols) {
      pm.box(c.x, P.ground - 2, c.z, 2.2, P.top - P.ground + 2, 2.2, P.ry, 2);
      res.piers.push({ x: c.x, z: c.z, r: 1.5, y0: P.ground - 2, y1: P.top });
    }
    // a cap beam across under the deck
    pm.box(r.X[P.i], P.top - 1.1, r.Z[P.i], reach * 2 * 0.9, 1.1, 2.6, P.ry + Math.PI / 2, 2);
  }
}

/** Where a road's bridge/viaduct piers stand (cached): every ~34 m off the ground. */
export function roadPiers(r) {
  if (r._piers) return r._piers;
  const out = [];
  const spacing = 34;
  for (let i = 0; i < r.N - 1; i++) {
    if (!(r.flags[i] & (F_BRIDGE | F_ELEV))) continue;
    const s = r.S[i];
    if (Math.floor(s / spacing) === Math.floor((s + r.step) / spacing)) continue;
    const top = r.Y[i] - 1.5;
    const ground = natural(r.X[i], r.Z[i]);
    if (top - ground < 1.5) continue;
    const offs = r.rt.hw > 7 ? [-r.rt.hw * 0.55, r.rt.hw * 0.55] : [0];
    const cols = offs.map((o) => ({ x: r.X[i] + r.LX[i] * o, z: r.Z[i] + r.LZ[i] * o }));
    out.push({ i, top, ground, ry: Math.atan2(r.TX[i], r.TZ[i]), cols });
  }
  r._piers = out;
  return out;
}

// ------------------------------------------------------------------ junctions

function emitJunction(n, batch, wet) {
  const E = n.ends;
  const city = E.some((e) => e.road.rt.walk > 0);
  const cobble = E.every((e) => e.road.rt.paint.base === 'cobble');
  const pm = cobble ? K.cobbleJunctionMat() : K.junctionMat(wet);
  const acc = batch.get(pm);
  const y = n.y;
  // the paving: corners of each end, curved between ends where the kerbs meet
  const outline = [];
  for (let k = 0; k < E.length; k++) {
    const e = E[k], f = E[(k + 1) % E.length];
    const re = e.road.rt, rf = f.road.rt;
    const we = re.hw + re.shoulder, wf = rf.hw + rf.shoulder;
    const lex = -e.dz, lez = e.dx, lfx = -f.dz, lfz = f.dx;
    const eR = [n.x + e.dx * e.trim - lex * we, n.z + e.dz * e.trim - lez * we];
    const eL = [n.x + e.dx * e.trim + lex * we, n.z + e.dz * e.trim + lez * we];
    const fR = [n.x + f.dx * f.trim - lfx * wf, n.z + f.dz * f.trim - lfz * wf];
    outline.push(eR, eL);
    const X = lineX(eL, [e.dx, e.dz], fR, [f.dx, f.dz]);
    if (X && E.length > 1) {
      for (let t = 0.2; t < 0.9; t += 0.2) outline.push(bez(eL, X, fR, t));
      if (city) cornerWalk(batch, n, e, f, eL, X, fR, wet);
    }
  }
  const c = acc.v(n.x, y, n.z, n.x / 12, n.z / 12);
  const ids = outline.map((p) => acc.v(p[0], y, p[1], p[0] / 12, p[1] / 12));
  for (let k = 0; k < ids.length; k++) acc.tri(c, ids[(k + 1) % ids.length], ids[k]);
  // crosswalks on city streets
  if (city) {
    const pa = batch.get(paintMat());
    for (const e of E) {
      if (e.road.rt.walk <= 0) continue;
      const w = e.road.rt.hw;
      const lx = -e.dz, lz = e.dx;
      const s0 = e.trim - 3.6, s1 = e.trim - 0.6;
      for (let o = -w + 0.6; o < w - 0.3; o += 1.2) {
        const P = (s, oo) => [n.x + e.dx * s + lx * oo, y + 0.015, n.z + e.dz * s + lz * oo];
        pa.quadP(P(s0, o), P(s0, o + 0.55), P(s1, o + 0.55), P(s1, o));
      }
    }
  }
}

let _paint = null;
function paintMat() {
  if (!_paint) _paint = K.glowMat({ color: 0xd8d8d0, roughness: 0.6, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 }, 2.4);
  return _paint;
}

/** The sidewalk round a junction's corner, between end e's left kerb and end f's right kerb. */
function cornerWalk(batch, n, e, f, eL, X, fR, wet) {
  const re = e.road.rt, rf = f.road.rt;
  const wk = Math.min(re.walk || rf.walk, rf.walk || re.walk) || Math.max(re.walk, rf.walk);
  if (wk <= 0) return;
  const cb = Math.max(re.curb, rf.curb, 0.12);
  const y = n.y;
  const lex = -e.dz, lez = e.dx, lfx = -f.dz, lfz = f.dx;
  const we = re.hw + re.shoulder + wk, wf = rf.hw + rf.shoulder + wk;
  const oE = [n.x + e.dx * e.trim + lex * we, n.z + e.dz * e.trim + lez * we];
  const oF = [n.x + f.dx * f.trim - lfx * wf, n.z + f.dz * f.trim - lfz * wf];
  const OX = lineX(oE, [e.dx, e.dz], oF, [f.dx, f.dz]) || X;
  const wm = batch.get(K.sidewalkMat()), cm = batch.get(K.curbMat());
  const N = 6;
  let prevI = null, prevO = null;
  for (let k = 0; k <= N; k++) {
    const t = k / N;
    const I = bez(eL, X, fR, t);
    // the outside follows the two property lines to their corner
    const O = t < 0.5 ? lerp2(oE, OX, t * 2) : lerp2(OX, oF, t * 2 - 1);
    if (prevI) {
      wm.quadP([prevO[0], y + cb, prevO[1]], [prevI[0], y + cb, prevI[1]], [I[0], y + cb, I[1]], [O[0], y + cb, O[1]], [0, 0, 1, 1]);
      cm.quadP([prevI[0], y + cb, prevI[1]], [prevI[0], y, prevI[1]], [I[0], y, I[1]], [I[0], y + cb, I[1]], [0, 0, 1, cb]);
    }
    prevI = I; prevO = O;
  }
  void wet;
}

function lineX(p, d, q, e) {
  const den = d[0] * e[1] - d[1] * e[0];
  if (Math.abs(den) < 0.05) return null;
  const t = ((q[0] - p[0]) * e[1] - (q[1] - p[1]) * e[0]) / den;
  return [p[0] + d[0] * t, p[1] + d[1] * t];
}
const bez = (a, b, c, t) => [(1 - t) * (1 - t) * a[0] + 2 * (1 - t) * t * b[0] + t * t * c[0], (1 - t) * (1 - t) * a[1] + 2 * (1 - t) * t * b[1] + t * t * c[1]];
const lerp2 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];

// ------------------------------------------------------------------ lamp posts

function emitLamp(L, batch) {
  const pm = batch.get(K.poleMat());
  const hm = batch.get(K.lampMat(`#${L.color.getHexString()}`));
  const st = L.style;
  if (st === 'gas') {
    pm.cyl(L.x, L.y, L.z, 0.09, L.h - 0.6, 6, 0.06);
    hm.box(L.x, L.hy - 0.75, L.z, 0.42, 0.55, 0.42);
    return;
  }
  if (st === 'lantern') {
    pm.cyl(L.x, L.y, L.z, 0.08, L.hy - L.y - 0.4, 6);
    hm.box(L.hx, L.hy - 0.9, L.hz, 0.5, 0.75, 0.5);
    return;
  }
  if (st === 'mast') {
    pm.cyl(L.x, L.y, L.z, 0.35, L.hy - L.y, 8, 0.22);
    hm.box(L.x, L.hy, L.z, 2.6, 0.5, 1.2);
    return;
  }
  // a post, an arm out over the road, a head
  pm.cyl(L.x, L.y, L.z, 0.13, L.hy - L.y, 6, 0.09);
  pm.beam(L.x, L.hy - 0.05, L.z, L.hx, L.hy - 0.05, L.hz, 0.12, 0.12);
  hm.box(L.hx, L.hy - 0.28, L.hz, 0.7, 0.18, 0.35, L.ry);
  if (LAMP[st]?.twin) {
    const ox = 2 * L.x - L.hx, oz = 2 * L.z - L.hz;
    pm.beam(L.x, L.hy - 0.05, L.z, ox, L.hy - 0.05, oz, 0.12, 0.12);
    hm.box(ox, L.hy - 0.28, oz, 0.7, 0.18, 0.35, L.ry);
  }
}

export { LAMP };
void F_TUNNEL;
