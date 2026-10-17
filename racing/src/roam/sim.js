// FREE ROAM simulation — headless like the race sim: your car on a region's
// road network, civilian traffic where the region has it, nitrous for
// driving well, resets, and the portal trigger that hands you on to the
// next region. No laps, no rivals, no clock.
import { Vehicle, PHYS_DT } from '../car/physics.js';
import { collideCars } from '../car/physics.js';
import { TrafficSim } from '../race/traffic.js';
import { RoadNet } from './roadnet.js';
import { G } from './plan.js';
import { clamp } from '../core/util.js';

export class RoamSim {
  /**
   * region: { track, plan } — plan from planRegion. opts: { player: racer
   * (kept across regions) | {spec, upgrades, look, name}, traffic, auto, assists, seed }
   */
  constructor(region, opts = {}) {
    this.region = region;
    this.T = region.track;
    this.plan = region.plan;
    this.net = new RoadNet(this.T, this.plan ? this.plan.stubs : []);
    this.opts = opts;
    this.type = 'roam';
    this.state = 'racing';
    this.time = 0;
    this.raceTime = 0;
    this.laps = 1;
    this.events = [];
    this.physAcc = 0;
    this.finishOrder = [];
    const P = opts.player.vehicle ? opts.player : RoamSim.makePlayer(opts.player);
    P.hint = -1; P.net = null; P.offT = 0;
    this.player = P;
    this.racers = [P];
    if (opts.traffic) {
      this.traffic = new TrafficSim(this.T, this.T.def, { seed: (opts.seed || '') + 'roam' });
      // roaming goes both ways: keep the cars round you, not just up the road
      const L = this.T.closed ? this.T.length : Infinity;
      this.traffic.windowBack = Math.min(420, L * 0.3);
      this.traffic.windowAhead = Math.min(620, L * 0.36);
    }
  }

  static makePlayer(p) {
    const veh = new Vehicle(p.spec, p.upgrades || {});
    return {
      id: 0, name: p.name || 'YOU', isPlayer: true, spec: p.spec, look: p.look || {}, upgrades: p.upgrades || {},
      vehicle: veh, skill: 1, hint: -1, s: 0, lat: 0, lap: 0, total: 0, pos: 1, place: null,
      lapTimes: [], bestLap: null, finished: false, out: false, draft: 0, wrongWay: false, offT: 0, scraping: false,
      airborneT: 0, driftT: 0,
      ctl: { throttle: 0, brake: 0, steer: 0, handbrake: false, nitro: false, shiftUp: false, shiftDown: false },
      dims: { L: p.spec.body.L, W: p.spec.body.W },
    };
  }

  emit(type, data = {}) { this.events.push({ type, t: this.time, ...data }); }

  /** Put the player at s along the main road (lat, facing the race direction or not). */
  placeOnRoad(s, lat = 0, backwards = false, speed = 0) {
    const T = this.T;
    const p = T.posAt(s, lat);
    this.placeAt(p.x, p.z, p.y, p.heading + (backwards ? Math.PI : 0), speed);
  }

  /** Arrive through a portal: inside its bore, driving out of the tunnel. */
  arrive(exit, speed = 0) {
    const q = this.plan?.portals.find((x) => x.exit === exit);
    if (!q) { this.placeOnRoad(this.T.startS + 20); return; }
    const depth = 34;
    const x = q.x + q.ax * depth, z = q.z + q.az * depth;
    // heading out: the opposite of the axis into the tunnel
    const heading = Math.atan2(-q.ax, -q.az);
    this.placeAt(x, z, q.y, heading, Math.max(speed, 0));
  }

  placeAt(x, z, y, heading, speed) {
    const P = this.player;
    const v = P.vehicle;
    const n = v.nitro, gear = v.gear, rpm = v.rpm;
    v.reset(x, z, heading, y + 0.05);
    v.nitro = n ?? 1;
    if (speed > 1) {
      v.vx = Math.sin(heading) * speed;
      v.vz = Math.cos(heading) * speed;
      if (gear > 0) v.gear = gear;
      v.rpm = rpm;
    }
    P.hint = -1;
    P.net = null;
    P.offT = 0;
    const g = this.net.ground(P, x, z);
    v.y = g.h + 0.02;
    const p = this.T.project(x, z, -1, {});
    P.s = p.s; P.lat = p.lat; P.hint = p.i;
    if (this.traffic) this.spreadTraffic();
  }

  spreadTraffic() {
    const tr = this.traffic;
    const P = this.player;
    const T = this.T;
    tr.cars.forEach((c, k) => {
      const lane = tr.lanes[Math.floor(tr.rng() * tr.lanes.length)];
      const sideAhead = k % 3 !== 2;
      const span = sideAhead ? tr.windowAhead : tr.windowBack;
      const d = 70 + ((k * 0.61) % 1) * (span - 70);
      let s = P.s + (sideAhead ? d : -d);
      // (at the end of a road there's no room that way: the other way instead)
      if (!T.closed && (s < 25 || s > T.length - 25)) s = P.s - (sideAhead ? d : -d);
      if (!T.closed) s = clamp(s, 25, T.length - 25);
      tr.spawn(c, s, lane);
    });
  }

  /**
   * On a road with ends, traffic drives on into the tunnels (instead of
   * stopping dead at the end of the road) and comes back round once it is
   * out of sight in there.
   */
  trafficEnds() {
    const T = this.T;
    const tr = this.traffic;
    if (T.closed) return;
    const L = T.length;
    for (const c of tr.cars) {
      if (c.mode !== 'cruise' || (c.s >= 0 && c.s <= L)) continue;
      const end = c.s > L;
      const over = end ? c.s - L : -c.s;
      const i = end ? T.N - 1 : 0;
      const p = T.posAt(end ? L : 0, c.lat);
      const k = end ? over : -over;
      c.x = p.x + T.TX[i] * k;
      c.z = p.z + T.TZ[i] * k;
      if (over < 60) continue;
      for (let n = 0; n < 6; n++) {
        const lane = tr.lanes[Math.floor(tr.rng() * tr.lanes.length)];
        const ahead = tr.rng() < 0.5;
        const s = this.player.s + (ahead ? 1 : -1) * (120 + tr.rng() * ((ahead ? tr.windowAhead : tr.windowBack) - 120));
        if (s > 30 && s < L - 30 && tr.spotFree(s, lane.lat, this)) { tr.spawn(c, s, lane); break; }
      }
    }
  }

  step(dt) {
    this.time += dt;
    this.raceTime += dt;
    this.physics(dt);
    this.progress(dt);
  }

  physics(dt) {
    const net = this.net;
    this.physAcc += Math.min(dt, 0.15);
    let steps = 0;
    const P = this.player;
    const v = P.vehicle;
    while (this.physAcc >= PHYS_DT && steps < 19) {
      this.physAcc -= PHYS_DT;
      steps++;
      if (this.frozen) continue;
      const env = this._env || (this._env = {
        ground: (x, z) => net.ground(P, x, z, P._g || (P._g = {})),
        auto: true, assists: 1, human: true, draft: 0,
      });
      env.auto = this.opts.auto !== false;
      env.assists = this.opts.assists ?? 1;
      env.human = !P.ai;
      v.step(PHYS_DT, P.ctl, env);
      P.ctl.shiftUp = false;
      P.ctl.shiftDown = false;
      if (v.lastShift) { this.emit('shift', { dir: v.lastShift, grade: null }); v.lastShift = 0; }
      if (v.landing > 0.15) this.emit('landing', { id: P.id, strength: v.landing });
      if (v.hopped) { v.hopped = false; this.emit('drifthop', { id: P.id }); }
      net.walls(this, P);
      if (this.traffic) {
        this.traffic.step(PHYS_DT, this);
        this.trafficEnds();
        this.traffic.collide(this, collideCars);
      }
    }
  }

  progress(dt) {
    const T = this.T;
    const P = this.player;
    const v = P.vehicle;
    const p = T.project(v.x, v.z, P.hint, P._pp || (P._pp = {}));
    P.s = p.s;
    P.lat = p.lat;
    P.hint = p.i;
    P.road = P.net ? P.net.road : 0;
    // nitrous: drifting, airtime, a slow trickle (near misses pay in traffic.js)
    let gain = 0.008;
    const slide = Math.abs(v.driftAngle);
    if (slide > 0.18 && v.speed > 14 && !v.airborne) { gain += 0.05 + slide * 0.06; P.driftT += dt; } else P.driftT = 0;
    if (v.airborne) { gain += 0.09; P.airborneT += dt; } else if (P.airborneT > 0) { if (P.airborneT > 0.6) this.emit('airtime', { t: P.airborneT }); P.airborneT = 0; }
    if (!v.nitroOn) v.nitro = Math.min(1, v.nitro + gain * dt);
    // off every road for a while (over a wall, upside down in a ditch) → back on
    const res = this.net.wallAt(P, v.x, v.z, this._wr || (this._wr = {}));
    if (res.over > 4 || res.lost || v.y < -60) P.offT += dt; else P.offT = 0;
    if (P.offT > 2.5) { this.resetRacer(P); P.offT = 0; }
    this.checkPortals();
  }

  /** Deep enough into a bore, still heading in → time to load what's on the other side. */
  checkPortals() {
    const P = this.player;
    const v = P.vehicle;
    if (!this.plan || this.leaving) return;
    for (const q of this.plan.portals) {
      const dx = v.x - q.x, dz = v.z - q.z;
      const depth = dx * q.ax + dz * q.az;
      const side = dx * q.az - dz * q.ax;
      // (you arrive through a tunnel driving out of it: turn round in there and it takes you back)
      const vin = v.vx * q.ax + v.vz * q.az;
      if (vin > 1 && depth > G.portalDepth && depth < G.portalDepth + 80 && Math.abs(side) < q.hw + 1.5) {
        this.leaving = q;
        this.emit('portal', { exit: q.exit, to: q.to, speed: Math.max(0, v.vF ?? v.speed) });
        return;
      }
    }
  }

  resetRacer(r) {
    const v = r.vehicle;
    const near = this.net.nearest(v.x, v.z);
    const T = this.net.roads[near.road];
    const s = T.closed ? near.s : clamp(near.s, 6, T.length - 6);
    const p = T.posAt(s, clamp(near.lat, -T.W[T.posAt(s).i] * 0.5, T.W[T.posAt(s).i] * 0.5));
    // keep facing the way we were going along that road
    const fwd = Math.sin(v.heading) * T.TX[p.i] + Math.cos(v.heading) * T.TZ[p.i];
    const n = v.nitro;
    v.reset(p.x, p.z, p.heading + (fwd < 0 ? Math.PI : 0), p.y + 0.2);
    v.nitro = n;
    r.net = null;
    r.hint = -1;
    this.emit('reset', { id: r.id, player: true });
  }

  end() {}
}

G.portalDepth = 22;
