// PORT HALCYON — the free-roam simulation, headless: the cars in the world
// (yours; later other players' too — every car is an entry in `racers` and
// steps the same way), on the world's ground and against its solid things,
// at the race sim's fixed 120 Hz. Nitrous fills from driving well. Into
// deep water (or lost off the edge of things) and you're put back where you
// last were on a road.
import { Vehicle, PHYS_DT, collideCars } from '../car/physics.js';

export class WorldSim {
  /** phys: WorldPhys. opts: { auto, assists } */
  constructor(phys, opts = {}) {
    this.phys = phys;
    this.net = phys.net;
    this.opts = opts;
    this.type = 'roam';
    this.state = 'racing';
    this.time = 0;
    this.raceTime = 0;
    this.laps = 1;
    this.events = [];
    this.physAcc = 0;
    this.finishOrder = [];
    this.racers = [];
    this.player = null;
    this.frozen = false;
  }

  static makeRacer(p, id = 0) {
    const veh = new Vehicle(p.spec, p.upgrades || {});
    return {
      id, name: p.name || 'YOU', isPlayer: id === 0, spec: p.spec, look: p.look || {}, upgrades: p.upgrades || {},
      vehicle: veh, skill: 1, hint: -1, s: 0, lat: 0, lap: 0, total: 0, pos: 1, place: null,
      lapTimes: [], bestLap: null, finished: false, out: false, draft: 0, wrongWay: false, scraping: false,
      airborneT: 0, driftT: 0, wetT: 0, safe: null, safeT: 0,
      ctl: { throttle: 0, brake: 0, steer: 0, handbrake: false, nitro: false, shiftUp: false, shiftDown: false },
      dims: { L: p.spec.body.L, W: p.spec.body.W },
      g: {},
    };
  }

  add(r) {
    this.racers.push(r);
    if (r.isPlayer) this.player = r;
    return r;
  }

  emit(type, data = {}) { this.events.push({ type, t: this.time, ...data }); }

  placeAt(r, x, z, heading, speed = 0, y = null) {
    const v = r.vehicle;
    const n = v.nitro, gear = v.gear, rpm = v.rpm;
    const g = this.phys.ground(x, z, y ?? 1e9, r.g);
    v.reset(x, z, heading, g.h + 0.05);
    v.nitro = n ?? 1;
    if (speed > 1) {
      v.vx = Math.sin(heading) * speed;
      v.vz = Math.cos(heading) * speed;
      if (gear > 0) v.gear = gear;
      v.rpm = rpm;
    }
    r.wetT = 0;
    r.safe = { x, z, heading, y: g.h };
  }

  step(dt) {
    this.time += dt;
    this.raceTime += dt;
    this.physics(dt);
    for (const r of this.racers) this.progress(r, dt);
  }

  physics(dt) {
    this.physAcc += Math.min(dt, 0.15);
    let steps = 0;
    while (this.physAcc >= PHYS_DT && steps < 19) {
      this.physAcc -= PHYS_DT;
      steps++;
      // (with the car held still, the town still goes about its business)
      if (this.frozen) { if (this.traffic) this.traffic.step(PHYS_DT, this); continue; }
      for (const r of this.racers) {
        const v = r.vehicle;
        const env = r._env || (r._env = {
          ground: (x, z) => this.phys.ground(x, z, v.y, r.g),
          auto: true, assists: 1, human: true, draft: 0,
        });
        env.auto = r.isPlayer ? this.opts.auto !== false : true;
        env.assists = r.isPlayer ? (this.opts.assists ?? 1) : 1;
        env.human = !r.ai;
        env.aiDrift = !!(r.ai && r.ai.driftMode);
        v.step(PHYS_DT, r.ctl, env);
        r.ctl.shiftUp = false;
        r.ctl.shiftDown = false;
        if (v.lastShift) { if (r.isPlayer) this.emit('shift', { dir: v.lastShift, grade: null }); v.lastShift = 0; }
        if (v.landing > 0.15) this.emit('landing', { id: r.id, strength: v.landing });
        if (v.hopped) { v.hopped = false; this.emit('drifthop', { id: r.id }); }
        const hit = this.phys.collide(r);
        if (hit && hit.impact > 2) this.emit('wallhit', { id: r.id, impact: hit.impact, x: hit.x, z: hit.z, y: v.y });
      }
      const R = this.racers;
      for (let a = 0; a < R.length; a++) {
        for (let b = a + 1; b < R.length; b++) {
          const hit = collideCars(R[a].vehicle, R[b].vehicle, R[a].dims, R[b].dims);
          if (hit && hit.impact > 1) this.emit('carhit', { a: R[a].id, b: R[b].id, impact: hit.impact, x: (R[a].vehicle.x + R[b].vehicle.x) / 2, z: (R[a].vehicle.z + R[b].vehicle.z) / 2, y: R[a].vehicle.y });
        }
      }
      if (this.traffic) {
        this.traffic.step(PHYS_DT, this);
        this.traffic.collide?.(this, collideCars);
      }
    }
  }

  progress(r, dt) {
    const v = r.vehicle;
    const g = r.g;
    // nitrous: drifting, airtime, a slow trickle
    let gain = 0.008;
    const slide = Math.abs(v.driftAngle);
    if (slide > 0.18 && v.speed > 14 && !v.airborne) { gain += 0.05 + slide * 0.06; r.driftT += dt; } else r.driftT = 0;
    if (v.airborne) { gain += 0.09; r.airborneT += dt; } else if (r.airborneT > 0) { if (r.airborneT > 0.6) this.emit('airtime', { id: r.id, t: r.airborneT }); r.airborneT = 0; }
    if (!v.nitroOn) v.nitro = Math.min(1, v.nitro + gain * dt);
    // remember the last good spot on a road (for putting the car back)
    r.safeT += dt;
    if (r.safeT > 0.5 && g.road && !v.airborne && !g.water && v.speed > 1) {
      r.safeT = 0;
      const i = g.road.project(v.x, v.z, -1, r._sp || (r._sp = {})).i;
      const fwd = Math.sin(v.heading) * g.road.TX[i] + Math.cos(v.heading) * g.road.TZ[i];
      r.safe = { x: v.x, z: v.z, y: v.y, heading: Math.atan2(g.road.TX[i], g.road.TZ[i]) + (fwd < 0 ? Math.PI : 0) };
    }
    // in the water: a splash, slowing down, and back to the road if it's deep
    if (g.water > 0.25 && !v.airborne) {
      const k = Math.min(1, g.water / 1.2);
      v.vx *= 1 - dt * (0.6 + 2.6 * k);
      v.vz *= 1 - dt * (0.6 + 2.6 * k);
      if (g.water > 0.7) r.wetT += dt; else r.wetT = 0;
      if (r.splashT === undefined || this.time - r.splashT > 0.25) { r.splashT = this.time; this.emit('splash', { id: r.id, x: v.x, z: v.z, y: v.y + g.water, depth: g.water }); }
      if (r.wetT > 1.1) this.respawn(r, 'water');
    } else r.wetT = 0;
    if (v.y < -60) this.respawn(r, 'fall');
  }

  /** Back on the road where the car last was (after the water, or R). */
  respawn(r, why = 'reset') {
    const v = r.vehicle;
    let s = r.safe;
    if (!s || why === 'reset') {
      const near = this.net.nearest(v.x, v.z, 2000);
      if (near) {
        const road = near.road, i = near.i;
        const fwd = Math.sin(v.heading) * road.TX[i] + Math.cos(v.heading) * road.TZ[i];
        // keep right of the centreline, facing the way the car was going
        const dir = fwd < 0 ? -1 : 1;
        const lat = -dir * Math.min(road.rt.hw * 0.45, 3);
        s = { x: road.X[i] + road.LX[i] * lat, z: road.Z[i] + road.LZ[i] * lat, y: road.Y[i], heading: Math.atan2(road.TX[i], road.TZ[i]) + (dir < 0 ? Math.PI : 0) };
      }
    }
    if (!s) return;
    const n = v.nitro;
    this.placeAt(r, s.x, s.z, s.heading, 0, s.y + 2);
    v.nitro = n;
    this.emit('reset', { id: r.id, why, player: r.isPlayer });
  }

  /** (the race session calls this for R / CREATE) */
  resetRacer(r) { this.respawn(r, 'reset'); }

  end() {}
}
