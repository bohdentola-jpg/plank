// PORT HALCYON — civilian traffic on the whole road network (pure logic,
// headless-safe). Cars live round the player: they turn up on roads a few
// hundred metres off, drive on the right in their lanes at the road's pace,
// keep their distance (from each other and from you), choose a way at every
// junction (mostly straight on) and take their turn crossing it, and drift
// out of existence once you're far away. Hit one and it's knocked loose
// (slides, spins down, then gives up and goes home). Near misses at speed
// pay out nitrous. The cars look like the race traffic (TrafficRender).
import { TrafficCar } from '../race/traffic.js';
import { makeRng, clamp } from '../core/util.js';
import { TUNE } from '../core/tune.js';

const RING = [140, 480];      // where cars turn up, from the player
const GONE = 720;             // and how far off they're let go
const JUNCTION_V = 7.5;       // through a turn
const STOP = 9;               // wait this far back from a busy junction

export class WorldTraffic {
  /** net: RoadNet; phys: WorldPhys (ground for knocked cars); opts: { count, seed } */
  constructor(net, phys, opts = {}) {
    this.net = net;
    this.phys = phys;
    this.rng = makeRng('worldtraffic' + (opts.seed || ''));
    this.cars = [];
    const n = opts.count ?? 34;
    for (let k = 0; k < n; k++) {
      const c = new TrafficCar(k, this.rng() < 0.12 ? 'truck' : 'car');
      c.active = false;
      c.x = 1e6; c.z = 1e6;
      this.cars.push(c);
    }
    this.busy = new Map();      // junction node → the car crossing it
    this.events = [];
    this.spawnT = 0;
    this._p = {};
  }

  /** Lane centre (lat) on road r for direction dir, lane k (0 = the inside lane). */
  laneLat(r, dir, k) {
    const rt = r.rt;
    const n = Math.max(1, rt.traffic);
    const inner = rt.median || 0;
    const w = (rt.hw - inner) / n;
    const lat = inner + w * (Math.min(k, n - 1) + 0.5);
    return dir > 0 ? -lat : lat;
  }

  // ---------------------------------------------------------------- spawning

  trySpawn(c, P) {
    const v = P.vehicle;
    // somewhere in the ring round the player, ahead of them by preference
    const a = Math.atan2(v.vx, v.vz) + (this.rng() - 0.5) * (v.speed > 8 ? 2.4 : 6.28);
    const d = RING[0] + this.rng() * (RING[1] - RING[0]);
    const x = v.x + Math.sin(a) * d, z = v.z + Math.cos(a) * d;
    const nr = this.net.nearest(x, z, 90);
    if (!nr) return false;
    const r = nr.road;
    if (!(r.rt.traffic > 0) || r.length < 30) return false;
    const s = clamp(r.S[nr.i], r.trim0 + 4, r.length - r.trim1 - 4);
    if (!(s > 0)) return false;
    const p = r.posAt(s);
    if (Math.hypot(p.x - v.x, p.z - v.z) < RING[0] * 0.8) return false;
    const dir = this.rng() < 0.5 ? 1 : -1;
    const lane = Math.floor(this.rng() * Math.max(1, r.rt.traffic));
    // room for it?
    for (const o of this.cars) {
      if (!o.active || o.road !== r || o.dir !== dir) continue;
      if (Math.abs(o.s - s) < 26) return false;
    }
    c.active = true;
    c.road = r;
    c.s = s;
    c.dir = dir;
    c.lane = lane;
    c.lat = c.latTarget = this.laneLat(r, dir, lane);
    c.vTarget = r.rt.speed * (0.82 + this.rng() * 0.3) * (c.kind === 'truck' ? 0.85 : 1);
    c.v = c.vTarget * 0.8;
    c.mode = 'cruise';
    c.turn = null;
    c.t = 0;
    c.wait = 0;
    c.hitBy = null;
    this.pose(c);
    return true;
  }

  despawn(c) {
    if (c.turn?.node && this.busy.get(c.turn.node) === c) this.busy.delete(c.turn.node);
    c.active = false;
    c.road = null;
    c.turn = null;
    c.x = 1e6; c.z = 1e6;
  }

  pose(c) {
    const r = c.road;
    const p = r.posAt(c.s, c.lat);
    c.x = p.x; c.z = p.z; c.y = p.y;
    c.heading = p.heading + (c.dir < 0 ? Math.PI : 0);
    c.hint = p.i;
    const fx = Math.sin(c.heading), fz = Math.cos(c.heading);
    c.vx = fx * c.v; c.vz = fz * c.v;
    c.yawRate = 0;
  }

  // ---------------------------------------------------------------- junctions

  /** The way on at the end of the road: { road, dir, lane, node } (or a U-turn). */
  chooseNext(c) {
    const r = c.road;
    const node = c.dir > 0 ? r.b : r.a;
    const inX = c.dir > 0 ? r.TX[r.N - 1] : -r.TX[0], inZ = c.dir > 0 ? r.TZ[r.N - 1] : -r.TZ[0];
    const opts = [];
    for (const e of node.ends) {
      if (e.road === r && (e.end === 1) === (c.dir > 0)) continue;   // where we came from
      if (!(e.road.rt.traffic > 0)) continue;
      const dot = inX * e.dx + inZ * e.dz;
      opts.push({ e, w: dot > 0.7 ? 3 : dot > -0.5 ? 1 : 0.15 });
    }
    let pick = null;
    if (opts.length) {
      let tot = 0;
      for (const o of opts) tot += o.w;
      let u = this.rng() * tot;
      for (const o of opts) { u -= o.w; if (u <= 0) { pick = o.e; break; } }
      pick = pick || opts[opts.length - 1].e;
    }
    if (!pick) return { road: r, dir: -c.dir, lane: 0, node };      // dead end: turn round
    const dir = pick.end === 0 ? 1 : -1;
    return { road: pick.road, dir, lane: Math.min(c.lane, Math.max(1, pick.road.rt.traffic) - 1), node };
  }

  /** Start across the junction: a curve from here to the next road's lane. */
  startTurn(c) {
    const next = this.chooseNext(c);
    const r2 = next.road;
    const s2 = next.dir > 0 ? (r2.closed ? 0 : r2.trim0) + 0.5 : r2.length - (r2.closed ? 0 : r2.trim1) - 0.5;
    const lat2 = this.laneLat(r2, next.dir, next.lane);
    const p2 = r2.posAt(clamp(s2, 0, r2.length), lat2);
    const h2 = p2.heading + (next.dir < 0 ? Math.PI : 0);
    const P0 = [c.x, c.z], P2 = [p2.x, p2.z];
    const d0 = [Math.sin(c.heading), Math.cos(c.heading)], d2 = [Math.sin(h2), Math.cos(h2)];
    // the control point where the two lanes' lines meet (or halfway, straight on)
    let P1 = [(P0[0] + P2[0]) / 2, (P0[1] + P2[1]) / 2];
    const den = d0[0] * d2[1] - d0[1] * d2[0];
    if (Math.abs(den) > 0.15) {
      const t = ((P2[0] - P0[0]) * d2[1] - (P2[1] - P0[1]) * d2[0]) / den;
      if (t > 0 && t < 80) P1 = [P0[0] + d0[0] * t, P0[1] + d0[1] * t];
    }
    const len = Math.hypot(P1[0] - P0[0], P1[1] - P0[1]) + Math.hypot(P2[0] - P1[0], P2[1] - P1[1]);
    c.turn = { P0, P1, P2, y0: c.y, y2: p2.y, len: Math.max(1, len), u: 0, next, s2, lat2, node: next.node, sharp: Math.abs(den) > 0.5 || next.road === c.road };
  }

  // ---------------------------------------------------------------- stepping

  /** One physics tick. sim: the WorldSim (racers, player, emit). */
  step(dt, sim) {
    const P = sim.player;
    if (!P) return;
    const pv = P.vehicle;
    this.spawnT -= dt;
    let spawns = this.spawnT <= 0 ? 2 : 0;
    if (this.spawnT <= 0) this.spawnT = 0.25;
    for (const c of this.cars) {
      if (!c.active) {
        if (spawns > 0 && this.trySpawn(c, P)) spawns--;
        continue;
      }
      const far = Math.hypot(c.x - pv.x, c.z - pv.z);
      if (far > GONE) { this.despawn(c); continue; }
      if (c.mode === 'loose') { this.loose(c, dt); continue; }
      if (c.turn) { this.stepTurn(c, dt, sim); continue; }
      this.stepCruise(c, dt, sim);
    }
    this.nearMiss(sim);
  }

  /** How fast it may go for what's ahead in its lane (other cars, you). */
  gapSpeed(c, sim) {
    const fx = Math.sin(c.heading), fz = Math.cos(c.heading);
    let gapV = Infinity;
    const look = (ox, oz, ov, halfL, latW) => {
      const dx = ox - c.x, dz = oz - c.z;
      const ahead = dx * fx + dz * fz;
      if (ahead <= 0 || ahead > 45) return;
      const side = Math.abs(dx * fz - dz * fx);
      if (side > latW) return;
      const gap = ahead - halfL - c.dims.L / 2;
      gapV = Math.min(gapV, Math.max(0, ov) + (gap - 6) * 0.45);
    };
    for (const o of this.cars) {
      if (o === c || !o.active) continue;
      if (Math.abs(o.x - c.x) > 46 || Math.abs(o.z - c.z) > 46) continue;
      // (only cars going our way, roughly)
      const along = Math.sin(o.heading) * fx + Math.cos(o.heading) * fz;
      if (along < 0.2 && o.mode !== 'loose') continue;
      look(o.x, o.z, o.mode === 'loose' ? 0 : o.v * along, o.dims.L / 2, 1.9);
    }
    for (const r of sim.racers) {
      const v = r.vehicle;
      look(v.x, v.z, (v.vx * fx + v.vz * fz), r.dims.L / 2, 2.3);
    }
    return gapV;
  }

  stepCruise(c, dt, sim) {
    const r = c.road;
    const endS = c.dir > 0 ? (r.closed ? Infinity : r.length - r.trim1) : (r.closed ? -Infinity : r.trim0);
    const toEnd = (endS - c.s) * c.dir;
    let want = Math.min(c.vTarget, this.gapSpeed(c, sim));
    // slow for the junction ahead (and wait if someone's crossing it)
    const node = c.dir > 0 ? r.b : r.a;
    if (Number.isFinite(toEnd) && node.kind === 'junction') {
      want = Math.min(want, JUNCTION_V + Math.max(0, toEnd - 6) * 0.6);
      const holder = this.busy.get(node);
      if (holder && holder !== c && holder.active && toEnd < STOP + 14) {
        c.wait += dt;
        if (c.wait < 6) want = Math.min(want, Math.max(0, (toEnd - STOP) * 0.8));
      }
    }
    c.brake = want < c.v - 0.5 ? 1 : 0;
    c.v += clamp(want - c.v, -8 * dt, 2.4 * dt);
    c.v = Math.max(0, c.v);
    c.s += c.v * c.dir * dt;
    if (r.closed) c.s = ((c.s % r.length) + r.length) % r.length;
    // ease into the lane (after a turn, after spawning)
    c.lat += clamp(c.latTarget - c.lat, -1.2 * dt, 1.2 * dt);
    if ((endS - c.s) * c.dir <= 0) {
      c.s = Number.isFinite(endS) ? endS : c.s;
      this.pose(c);
      const holder = this.busy.get(node);
      if (node.kind === 'junction' && holder && holder !== c && holder.active && c.wait < 6) { c.v = 0; return; }
      c.wait = 0;
      this.startTurn(c);
      if (node.kind === 'junction') this.busy.set(node, c);
      return;
    }
    this.pose(c);
  }

  stepTurn(c, dt, sim) {
    const T = c.turn;
    const want = Math.min(T.sharp ? JUNCTION_V : c.vTarget, this.gapSpeed(c, sim));
    c.v += clamp(want - c.v, -8 * dt, 2.4 * dt);
    c.v = Math.max(0, c.v);
    T.u = Math.min(1, T.u + (c.v * dt) / T.len);
    const u = T.u, a = (1 - u) * (1 - u), b = 2 * (1 - u) * u, d = u * u;
    const x = a * T.P0[0] + b * T.P1[0] + d * T.P2[0];
    const z = a * T.P0[1] + b * T.P1[1] + d * T.P2[1];
    const tx = 2 * (1 - u) * (T.P1[0] - T.P0[0]) + 2 * u * (T.P2[0] - T.P1[0]);
    const tz = 2 * (1 - u) * (T.P1[1] - T.P0[1]) + 2 * u * (T.P2[1] - T.P1[1]);
    c.x = x; c.z = z;
    c.y = T.y0 + (T.y2 - T.y0) * u;
    if (Math.hypot(tx, tz) > 1e-3) c.heading = Math.atan2(tx, tz);
    c.vx = Math.sin(c.heading) * c.v; c.vz = Math.cos(c.heading) * c.v;
    if (u >= 1) {
      if (this.busy.get(T.node) === c) this.busy.delete(T.node);
      const n = T.next;
      c.road = n.road;
      c.dir = n.dir;
      c.lane = n.lane;
      c.s = T.s2;
      c.lat = c.latTarget = T.lat2;
      c.turn = null;
      this.pose(c);
    }
  }

  /** Knocked loose: slide, spin down, sit there a while, then go. */
  loose(c, dt) {
    if (c.turn?.node && this.busy.get(c.turn.node) === c) this.busy.delete(c.turn.node);
    c.turn = null;
    c.t += dt;
    c.x += c.vx * dt; c.z += c.vz * dt;
    c.heading += c.yawRate * dt;
    const k = Math.exp(-2.2 * dt);
    c.vx *= k; c.vz *= k;
    c.yawRate *= Math.exp(-2.8 * dt);
    const g = this.phys.ground(c.x, c.z, c.y + 1, this._p);
    c.y = g.h;
    if (c.t > 9 && Math.hypot(c.vx, c.vz) < 0.5) this.despawn(c);
  }

  /** Racer ↔ traffic contacts (once per physics tick, after racer contacts). */
  collide(sim, collideCars) {
    if (!TUNE.trafficCollisions) return;
    for (const r of sim.racers) {
      for (const c of this.cars) {
        if (!c.active) continue;
        if (Math.abs(c.x - r.vehicle.x) > 8 || Math.abs(c.z - r.vehicle.z) > 8) continue;
        const hit = collideCars(r.vehicle, c, r.dims, c.dims);
        if (hit && hit.impact > 0.6) {
          if (c.mode !== 'loose') { c.mode = 'loose'; c.t = 0; }
          c.hitBy = r.id;
          c.missArmed = false;
          if (hit.impact > 1.2) sim.emit('carhit', { a: r.id, b: -1, traffic: true, impact: hit.impact, x: (r.vehicle.x + c.x) / 2, z: (r.vehicle.z + c.z) / 2, y: r.vehicle.y });
        }
      }
    }
  }

  /** Threading past traffic at speed without touching it pays nitrous. */
  nearMiss(sim) {
    const P = sim.player;
    const v = P.vehicle;
    const fx = Math.sin(v.heading), fz = Math.cos(v.heading);
    for (const c of this.cars) {
      if (!c.active || c.mode !== 'cruise') continue;
      const dx = c.x - v.x, dz = c.z - v.z;
      if (Math.abs(dx) > 30 || Math.abs(dz) > 30) { c.missArmed = false; continue; }
      const along = dx * fx + dz * fz, side = Math.abs(dx * fz - dz * fx);
      const gap = side - (c.dims.W + P.dims.W) / 2;
      const rel = Math.hypot(v.vx - c.vx, v.vz - c.vz);
      if (Math.abs(along) < (c.dims.L + P.dims.L) / 2 + 1 && gap < 1.4 && gap > -0.2 && rel > 9) {
        c.missArmed = true;
        c.missRel = Math.max(c.missRel || 0, rel);
      } else if (c.missArmed && Math.abs(along) > 8) {
        c.missArmed = false;
        if (c.hitBy === P.id) { c.hitBy = null; continue; }
        v.nitro = Math.min(1, v.nitro + clamp(0.05 + c.missRel * 0.002, 0.05, 0.14));
        const oncoming = Math.sin(c.heading) * fx + Math.cos(c.heading) * fz < 0;
        sim.emit('nearmiss', { oncoming, rel: c.missRel });
        c.missRel = 0;
      }
    }
  }
}
