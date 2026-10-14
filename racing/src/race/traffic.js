// Civilian traffic — pure logic (headless-safe). Cars follow lanes at their
// own pace, keep their distance, change lanes now and then, and get knocked
// around when a racer hits them (then pull themselves back together). City
// roads are two-way: the left-hand lanes come AT you. Traffic is recycled
// around the player so the road stays busy without simulating a whole city.
// Near misses at speed pay out nitrous.
import { makeRng, clamp } from '../core/util.js';

const MASS = { car: 1350, truck: 6500 };
const DIMS = { car: { L: 4.6, W: 1.8 }, truck: { L: 7.6, W: 2.45 } };

export class TrafficCar {
  constructor(id, kind) {
    this.id = id;
    this.kind = kind;
    this.P = { mass: MASS[kind] };
    this.dims = DIMS[kind];
    this.x = 0; this.y = 0; this.z = 0; this.heading = 0;
    this.vx = 0; this.vz = 0; this.yawRate = 0;
    this.s = 0; this.lat = 0; this.latTarget = 0;
    this.dir = 1; this.v = 0; this.vTarget = 20;
    this.mode = 'cruise';
    this.t = 0;
    this.hint = -1;
    this.brake = 0;
    this.blink = 0;     // -1 / 1 while changing lanes
  }
  get fwd() { return [Math.sin(this.heading), Math.cos(this.heading)]; }
  get left() { return [Math.cos(this.heading), -Math.sin(this.heading)]; }
  get speed() { return Math.hypot(this.vx, this.vz); }
  /** Signed speed along the race direction (oncoming cars are negative). */
  get alongSpeed() { return this.mode === 'cruise' ? this.v * this.dir : 0; }
  get vehicle() { return { speed: this.alongSpeed }; }
}

export class TrafficSim {
  /**
   * def: track def ({traffic, trafficLanes, twoWay, trafficSpeed, trafficCount, env, width, lanes})
   */
  constructor(track, def, opts = {}) {
    this.T = track;
    this.def = def;
    this.rng = makeRng('traffic' + (def.id || '') + (opts.seed || ''));
    const W = (def.width || 14) / 2;
    const nLanes = def.lanes || 2;
    const laneW = (W * 2) / nLanes;
    const lanes = def.trafficLanes || Array.from({ length: nLanes }, (_, k) => -W + laneW * (k + 0.5));
    const twoWay = def.twoWay ?? (def.env === 'city' || def.env === 'docks');
    // our direction drives on the right (negative lat); two-way roads send the rest at us
    this.lanes = lanes.map((lat) => ({ lat, dir: twoWay && lat > 0.01 ? -1 : 1 }));
    const city = def.env === 'city' || def.env === 'docks';
    this.speedRange = def.trafficSpeed || (city ? [11, 16] : [21, 31]);
    const count = opts.count ?? def.trafficCount ?? (city ? 14 : 16);
    this.cars = [];
    for (let k = 0; k < count; k++) this.cars.push(new TrafficCar(k, this.rng() < (city ? 0.1 : 0.2) ? 'truck' : 'car'));
    this.events = [];
    this.windowBack = 260;
    this.windowAhead = 1100;
  }

  /** Spread the cars along the road ahead of the grid (never on it). */
  place(refS) {
    const T = this.T;
    this.cars.forEach((c, k) => {
      const lane = this.lanes[Math.floor(this.rng() * this.lanes.length)];
      const s = refS + 140 + (k + this.rng() * 0.8) * ((this.windowAhead - 140) / this.cars.length);
      this.spawn(c, s, lane);
    });
    void T;
  }

  spawn(c, s, lane) {
    const T = this.T;
    if (!T.closed) s = clamp(s, 20, T.length - 20);
    c.s = s;
    c.dir = lane.dir;
    c.lat = c.latTarget = lane.lat;
    const [a, b] = this.speedRange;
    c.vTarget = (a + this.rng() * (b - a)) * (c.kind === 'truck' ? 0.82 : 1);
    c.v = c.vTarget;
    c.mode = 'cruise';
    c.t = 0;
    c.blink = 0;
    this.pose(c);
  }

  pose(c) {
    const p = this.T.posAt(c.s, c.lat);
    c.x = p.x; c.z = p.z; c.y = p.y;
    c.heading = p.heading + (c.dir < 0 ? Math.PI : 0);
    c.hint = p.i;
    const [fx, fz] = c.fwd;
    c.vx = fx * c.v; c.vz = fz * c.v;
    c.yawRate = 0;
  }

  /** One physics tick. sim: the RaceSim (racers, player, emit). */
  step(dt, sim) {
    const T = this.T;
    const P = sim.player;
    const refS = P ? P.s : (sim.order?.[0]?.s ?? T.startS);
    for (const c of this.cars) {
      if (c.mode === 'cruise') {
        // keep a gap to whatever is ahead in our lane (traffic or racers)
        let gapV = Infinity;
        for (const o of this.cars) {
          if (o === c || o.mode !== 'cruise' || o.dir !== c.dir || Math.abs(o.lat - c.lat) > 1.8) continue;
          const ds = T.deltaS(c.s, o.s) * c.dir;
          if (ds > 0 && ds < 40) gapV = Math.min(gapV, o.v + (ds - 14) * 0.4);
        }
        for (const r of sim.racers) {
          if (Math.abs((r.lat ?? 0) - c.lat) > 2 || c.dir < 0) continue;
          const ds = T.deltaS(c.s, r.s);
          if (ds > 0 && ds < 25 && r.vehicle.speed < c.v) gapV = Math.min(gapV, r.vehicle.speed + (ds - 10) * 0.4);
        }
        const want = Math.max(0, Math.min(c.vTarget, gapV));
        c.brake = want < c.v - 0.5 ? 1 : 0;
        c.v += clamp(want - c.v, -7 * dt, 2.2 * dt);
        // the odd lane change into a free same-direction lane
        c.t += dt;
        if (c.t > 6 && this.rng() < dt * 0.06) {
          const options = this.lanes.filter((l) => l.dir === c.dir && Math.abs(l.lat - c.lat) > 1 && Math.abs(l.lat - c.lat) < 5.5);
          const l = options[Math.floor(this.rng() * options.length)];
          if (l && this.laneFree(c, l.lat, sim)) { c.latTarget = l.lat; c.blink = Math.sign(l.lat - c.lat); c.t = 0; }
        }
        const dl = c.latTarget - c.lat;
        c.lat += clamp(dl, -1.1 * dt, 1.1 * dt);
        if (Math.abs(dl) < 0.05) c.blink = 0;
        c.s += c.v * c.dir * dt;
        if (T.closed) c.s = ((c.s % T.length) + T.length) % T.length;
        this.pose(c);
      } else {
        // knocked loose: slide, spin down, then pull back into a lane
        c.t += dt;
        c.x += c.vx * dt; c.z += c.vz * dt;
        c.heading += c.yawRate * dt;
        const k = Math.exp(-2.2 * dt);
        c.vx *= k; c.vz *= k;
        c.yawRate *= Math.exp(-2.8 * dt);
        const pr = T.project(c.x, c.z, c.hint, c._pp || (c._pp = {}));
        c.hint = pr.i;
        c.y = T.roadY ? T.roadY(pr.i, 0, pr.lat) : c.y;
        // keep road coordinates current so racers can see where the wreck is
        c.s = pr.s;
        c.lat = pr.lat;
        if (c.speed < 1.2 && c.t > 2.5) {
          // back on its way from where it stopped
          let best = this.lanes[0];
          for (const l of this.lanes) if (Math.abs(l.lat - pr.lat) < Math.abs(best.lat - pr.lat)) best = l;
          c.s = pr.s;
          c.dir = best.dir;
          c.lat = clamp(pr.lat, -T.W[pr.i], T.W[pr.i]);
          c.latTarget = best.lat;
          c.v = 0;
          c.mode = 'cruise';
          c.t = 0;
        }
      }
      // recycle around the player: too far behind → reappear up the road
      if (P) {
        const ds = T.deltaS(refS, c.s);
        if (ds < -this.windowBack || ds > this.windowAhead + 300) {
          const lane = this.lanes[Math.floor(this.rng() * this.lanes.length)];
          let s = refS + this.windowAhead * (0.55 + this.rng() * 0.45);
          if (!T.closed && s > T.length - 30) s = refS - this.windowBack + 40; // past the finish: leave it
          if (this.spotFree(s, lane.lat)) this.spawn(c, s, lane);
        }
      }
    }
    this.nearMiss(sim, dt);
  }

  laneFree(c, lat, sim) {
    for (const o of this.cars) {
      if (o === c || Math.abs(o.lat - lat) > 2) continue;
      if (Math.abs(this.T.deltaS(c.s, o.s)) < 22) return false;
    }
    // don't pull out in front of a racer closing in (mirrors, at least)
    if (sim) {
      for (const r of sim.racers) {
        if (Math.abs((r.lat ?? 0) - lat) > 2.4) continue;
        const ds = this.T.deltaS(c.s, r.s) * c.dir; // − = racer behind us
        const closing = r.vehicle.speed - c.v;
        if (ds > -Math.max(20, closing * 3.5) && ds < 12) return false;
      }
    }
    return true;
  }

  spotFree(s, lat) {
    for (const o of this.cars) if (Math.abs(o.lat - lat) < 2 && Math.abs(this.T.deltaS(s, o.s)) < 30) return false;
    return true;
  }

  /** Racer ↔ traffic contacts (call once per physics tick after racer contacts). */
  collide(sim, collideCars) {
    for (const r of sim.racers) {
      if (r.out && r.parked) continue;
      for (const c of this.cars) {
        const hit = collideCars(r.vehicle, c, r.dims, c.dims);
        if (hit && hit.impact > 0.6) {
          if (c.mode === 'cruise') { c.mode = 'loose'; c.t = 0; }
          c.hitBy = r.id;
          c.missArmed = false;
          if (hit.impact > 1.2) sim.emit('carhit', { a: r.id, b: -1, traffic: true, impact: hit.impact, x: (r.vehicle.x + c.x) / 2, z: (r.vehicle.z + c.z) / 2, y: r.vehicle.y });
        }
      }
    }
  }

  /** Threading past traffic without touching it pays nitrous. */
  nearMiss(sim, dt) {
    const P = sim.player;
    if (!P || sim.state !== 'racing' || P.finished) return;
    const v = P.vehicle;
    for (const c of this.cars) {
      if (c.mode !== 'cruise') continue;
      const ds = this.T.deltaS(c.s, P.s);
      const gap = Math.abs((P.lat ?? 0) - c.lat) - (c.dims.W + P.dims.W) / 2;
      const rel = Math.abs(v.speed - c.alongSpeed);
      if (Math.abs(ds) < (c.dims.L + P.dims.L) / 2 + 1 && gap < 1.4 && gap > -0.2 && rel > 8) {
        c.missArmed = true;
        c.missRel = Math.max(c.missRel || 0, rel);
      } else if (c.missArmed && Math.abs(ds) > 8) {
        c.missArmed = false;
        if (c.hitBy === P.id) { c.hitBy = null; continue; }
        const bonus = clamp(0.05 + c.missRel * 0.002, 0.05, 0.14);
        v.nitro = Math.min(1, v.nitro + bonus);
        sim.emit('nearmiss', { oncoming: c.dir < 0, rel: c.missRel });
        c.missRel = 0;
      }
    }
    void dt;
  }
}
