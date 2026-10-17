// PORT HALCYON — the whole map, assembled from the area files. Roads flagged
// `cross: true` (diagonals through a grid, a boulevard across streets) are
// split wherever they cross straight two-node roads, with a junction node
// at each crossing, so authors don't have to place those by hand.
import { merge } from './helpers.js';
import { segCross } from '../geom.js';
import * as base from './base.js';
import city from './areas/city.js';
import oldtown from './areas/oldtown.js';
import uptown from './areas/uptown.js';
import highways from './areas/highways.js';
import coast from './areas/coast.js';
import west from './areas/west.js';
import north from './areas/north.js';
import east from './areas/east.js';
import xCentral from './areas/x_central.js';
import xOldtown from './areas/x_oldtown.js';
import xWorks from './areas/x_works.js';

function planarize(m) {
  const pos = (id) => m.nodes[id];
  const straight = m.roads.filter((r) => !r.pts?.length && !r.loop && !r.cross && !r.elevated);
  let made = 0;
  for (const c of m.roads.filter((r) => r.cross)) {
    const line = [pos(c.a), ...(c.pts || []).map((p) => [p[0], p[1]]), pos(c.b)];
    const hits = [];
    for (const s of straight) {
      if (s.a === c.a || s.a === c.b || s.b === c.a || s.b === c.b) continue;
      const A = pos(s.a), B = pos(s.b);
      let acc = 0;
      for (let k = 0; k < line.length - 1; k++) {
        const x = segCross(line[k], line[k + 1], A, B);
        if (x && x.u > 0.02 && x.u < 0.98) hits.push({ s, along: acc + x.t * Math.hypot(line[k + 1][0] - line[k][0], line[k + 1][1] - line[k][1]), seg: k, x: x.x, z: x.z, u: x.u });
        acc += Math.hypot(line[k + 1][0] - line[k][0], line[k + 1][1] - line[k][1]);
      }
    }
    if (!hits.length) continue;
    hits.sort((p, q) => p.along - q.along);
    // split the crossing road into pieces between hits
    const pieces = [];
    let prev = c.a, from = 0, seg0 = 0;
    const ptsOf = (k0, k1) => (c.pts || []).slice(k0, k1);
    hits.forEach((h, k) => {
      const nid = `${c.id}~x${k}`;
      m.nodes[nid] = [h.x, h.z];
      // split the straight road too
      const s = h.s;
      const idx = m.roads.indexOf(s);
      const s1 = { ...s, id: `${s.id}~a${k}`, b: nid };
      const s2 = { ...s, id: `${s.id}~b${k}`, a: nid };
      m.roads.splice(idx, 1, s1, s2);
      const si = straight.indexOf(s);
      straight.splice(si, 1, s1, s2);
      pieces.push({ ...c, id: `${c.id}~${k}`, a: prev, b: nid, pts: ptsOf(seg0, h.seg), cross: false });
      prev = nid; seg0 = h.seg; from = h.along;
      made++;
    });
    void from;
    pieces.push({ ...c, id: `${c.id}~${hits.length}`, a: prev, b: c.b, pts: ptsOf(seg0, (c.pts || []).length), cross: false });
    const ci = m.roads.indexOf(c);
    m.roads.splice(ci, 1, ...pieces);
  }
  return made;
}

function assemble() {
  const m = merge(city, oldtown, uptown, highways, coast, west, north, east, xCentral, xOldtown, xWorks);
  planarize(m);
  // every road's nodes must exist
  for (const r of m.roads) {
    if (!m.nodes[r.a] || !m.nodes[r.b]) throw new Error(`map: road ${r.id} needs nodes ${r.a} → ${r.b}`);
  }
  return { ...base, ...m };
}

export const MAP = assemble();
