// PORT HALCYON — physics against the world: the ground under a car (the
// right road surface — a deck over a road over the ground, picked by how
// high the car already is — else the graded terrain; the water's depth
// where there's water), and what stops a car: guardrails and jersey
// barriers along the roads that have them, the median barrier, a bridge's
// parapets, lamp posts, bridge piers, and whatever the districts make solid
// (buildings, trees, walls). Everything is worked out from the road network
// and the districts' plans, never from meshes, so it's there before a cell
// is drawn (and for cars nobody is looking at).
import { F_BRIDGE, F_ELEV } from './net.js';
import { waterAt } from './terrain.js';
import { districtAt } from './ground.js';
import { roadLamps, roadPiers } from './build/roads.js';

const STEP_UP = 1.6;     // a surface this far above the car still carries it (kerbs, ramps)

// what the bare ground is to drive on, by district style
const GROUND_SURFACE = {
  downtown: 'road', chinatown: 'road', works: 'road', harbor: 'road', shipyard: 'road',
  oldtown: 'grass', uptown: 'grass', eastside: 'grass', pier9: 'sand', point: 'grass', bayshore: 'grass',
  desert: 'sand', ghosttown: 'sand', redrock: 'dirt', drylake: 'road', farmland: 'dirt',
  crestwood: 'grass', redwood: 'dirt', kaido: 'dirt', wilds: 'dirt', lake: 'grass', ironworks: 'gravel',
  summit: 'gravel', ridgeline: 'gravel',
};

export class WorldPhys {
  constructor(net, terrain, districts = null) {
    this.net = net;
    this.terrain = terrain;
    this.districts = districts;
    this._s = [];
    this._n = [0, 1, 0];
    this._near = new Map();
  }

  /**
   * Ground under (x, z) for something at height yRef:
   * { h, n: [x,y,z], surface, road, zone, water (depth or 0) }.
   */
  ground(x, z, yRef = 1e9, out = {}) {
    const S = this.net.surfaces(x, z, this._s);
    let best = null;
    for (const c of S) {
      if (c.h > yRef + STEP_UP) continue;
      if (!best || c.h > best.h) best = c;
    }
    const th = this.terrain.heightAt(x, z);
    let h, surface, n;
    if (best && best.h >= th - 0.3) {
      h = best.h;
      surface = best.surface;
      n = best.road ? roadNormal(best, this._n) : up(this._n);
      out.road = best.road || null;
      out.node = best.node || null;
      out.zone = best.zone;
      out.flags = best.flags || 0;
    } else {
      h = th;
      const d = districtAt(x, z);
      surface = GROUND_SURFACE[d?.style] || 'grass';
      if (h > 560) surface = 'gravel';
      n = this.terrain.normalAt(x, z, this._n);
      out.road = null; out.node = null; out.zone = 'ground'; out.flags = 0;
    }
    out.h = h;
    out.n = n;
    out.surface = surface;
    // water over the ground (not on a deck over it)
    out.water = 0;
    if (!best || best.h < th + 0.5) {
      const w = waterAt(x, z);
      if (w && w.y > h + 0.05) out.water = w.y - h;
    }
    return out;
  }

  /**
   * Keep a car out of everything solid. r: { vehicle, dims }. Applies the
   * deepest push-out with v.hitWall and returns { impact, x, z } or null.
   */
  collide(r) {
    const v = r.vehicle;
    const [fx, fz] = v.fwd;
    const [lx, lz] = v.left;
    const hl = r.dims.L / 2 - 0.05, hw = r.dims.W / 2 - 0.02;
    const pts = this._pts || (this._pts = [[0, 0], [0, 0], [0, 0], [0, 0], [0, 0], [0, 0]]);
    const loc = [[hl, hw], [hl, -hw], [-hl, hw], [-hl, -hw], [0, hw], [0, -hw]];
    for (let k = 0; k < 6; k++) {
      pts[k][0] = v.x + fx * loc[k][0] + lx * loc[k][1];
      pts[k][1] = v.z + fz * loc[k][0] + lz * loc[k][1];
    }
    let worst = 0, wn = null, wc = null, wp = null;
    const consider = (pen, nx, nz, k) => {
      if (pen > worst) { worst = pen; wn = [nx, nz]; wc = loc[k]; wp = pts[k]; }
    };
    // ---- road edges: barriers, parapets, medians
    const near = this.net.near(v.x, v.z, this.net.maxReach + 6, this._near);
    const p = this._pp || (this._pp = {}), q = this._pq || (this._pq = {});
    for (const [road, i0] of near) {
      const rt = road.rt;
      road.project(v.x, v.z, i0, p);
      if (road.pastEnd(p, v.x, v.z)) continue;
      const i = p.i;
      const offGround = road.flags[i] & (F_BRIDGE | F_ELEV);
      const barrier = offGround || rt.edge === 'rail' || rt.edge === 'jersey';
      const median = rt.median > 0 && rt.edge === 'jersey';
      if (!barrier && !median) continue;
      // not at a junction's mouth (that's where you turn off)
      if (!road.closed && (p.s < road.trim0 + 2 || p.s > road.length - road.trim1 - 2)) continue;
      const ry = road.roadY(i, p.t, Math.max(-rt.hw, Math.min(rt.hw, p.lat)));
      if (v.y < ry - 2.5 || v.y > ry + 3) continue;          // a different level
      const B = offGround ? rt.hw + rt.shoulder + rt.walk : rt.hw + rt.shoulder + (rt.edge === 'rail' ? 0.35 : 0);
      const thick = 0.4;
      const latC = p.lat;
      for (let k = 0; k < 6; k++) {
        road.project(pts[k][0], pts[k][1], i, q);
        const lp = q.lat;
        const LX = road.LX[q.i], LZ = road.LZ[q.i];
        if (barrier) {
          for (const sd of [1, -1]) {
            const c = sd * latC, pp = sd * lp;
            if (c < B && pp > B) consider(pp - B, -sd * LX, -sd * LZ, k);              // inside, pushing out through it
            else if (c > B + thick && pp < B + thick) consider(B + thick - pp, sd * LX, sd * LZ, k);  // outside, pushing in
          }
        }
        if (median) {
          const sc = latC >= 0 ? 1 : -1;
          const m = rt.median + 0.05;
          if (sc * lp < m) consider(m - sc * lp, sc * LX, sc * LZ, k);
        }
      }
    }
    // ---- posts and piers near the car
    for (const [road] of near) {
      for (const L of roadLamps(road)) {
        if (Math.abs(L.x - v.x) > 6 || Math.abs(L.z - v.z) > 6) continue;
        if (v.y > L.y + 6 || v.y < L.y - 3) continue;
        for (let k = 0; k < 6; k++) circle(pts[k], L.x, L.z, 0.24, k, consider);
      }
      if (road._hasPiers === undefined) road._hasPiers = roadPiers(road).length > 0 ? 1 : -1;
      if (road._hasPiers === 1) {
        for (const P of roadPiers(road)) {
          for (const c of P.cols) {
            if (Math.abs(c.x - v.x) > 8 || Math.abs(c.z - v.z) > 8) continue;
            if (v.y > P.top || v.y < P.ground - 3) continue;
            for (let k = 0; k < 6; k++) circle(pts[k], c.x, c.z, 1.25, k, consider);
          }
        }
      }
    }
    // ---- the districts' solid things
    if (this.districts) {
      for (const c of this.districts.collidersNear(v.x, v.z, 12)) {
        if (v.y > c.y1 || v.y + 1.5 < c.y0) continue;
        for (let k = 0; k < 6; k++) {
          if (c.kind === 'circle') circle(pts[k], c.x, c.z, c.r, k, consider);
          else box(pts[k], c, k, consider);
        }
      }
    }
    if (!wn) { r.scraping = false; return null; }
    const impact = v.hitWall(wn[0], wn[1], worst, wc);
    r.scraping = true;
    r.scrapePoint = wp;
    return { impact, x: wp[0], z: wp[1] };
  }
}

function circle(pt, cx, cz, R, k, consider) {
  const dx = pt[0] - cx, dz = pt[1] - cz;
  const d2 = dx * dx + dz * dz;
  if (d2 >= R * R) return;
  const d = Math.sqrt(d2) || 1e-4;
  consider(R - d, dx / d, dz / d, k);
}

/** Oriented box collider { x, z, hx, hz, ry }. */
function box(pt, c, k, consider) {
  const cs = Math.cos(c.ry || 0), sn = Math.sin(c.ry || 0);
  const dx = pt[0] - c.x, dz = pt[1] - c.z;
  // into the box's frame (its local x along (cos, -sin), z along (sin, cos))
  const lx = dx * cs - dz * sn, lz = dx * sn + dz * cs;
  const px = c.hx - Math.abs(lx), pz = c.hz - Math.abs(lz);
  if (px <= 0 || pz <= 0) return;
  if (px < pz) {
    const s = lx >= 0 ? 1 : -1;
    consider(px, s * cs, -s * sn, k);
  } else {
    const s = lz >= 0 ? 1 : -1;
    consider(pz, s * sn, s * cs, k);
  }
}

const up = (n) => { n[0] = 0; n[1] = 1; n[2] = 0; return n; };

function roadNormal(c, n) {
  const r = c.road, i = c.i, j = r.idx(i + 1);
  const dy = (r.Y[j] - r.Y[i]) / r.step;
  const bank = c.zone === 'road' || c.zone === 'shoulder' ? r.lerpArr(r.B, i, c.t) : 0;
  const tb = Math.tan(bank);
  const nx = -dy * r.TX[i] - tb * r.LX[i], nz = -dy * r.TZ[i] - tb * r.LZ[i];
  const l = Math.hypot(nx, 1, nz);
  n[0] = nx / l; n[1] = 1 / l; n[2] = nz / l;
  return n;
}
