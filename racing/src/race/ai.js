// AI drivers. They drive the same physics as the player:
//   • follow the track's minimum-curvature racing line (track.line.off)
//     with pure-pursuit steering and a lookahead that grows with speed
//   • throttle/brake from the line's speed profile (curvature limit +
//     backward braking pass), scaled by skill and the car's own grip
//   • pick a side and overtake slower cars, give room alongside
//   • modest rubber-banding, nitrous on straights, small human mistakes
//   • recover from walls (reverse out) and respawn if truly stuck
import { clamp, lerp, makeRng } from '../core/util.js';

export class AIDriver {
  constructor(racer, track, opts = {}) {
    this.r = racer;
    this.T = track;
    this.skill = clamp(opts.skill ?? 0.8, 0, 1.2);
    this.aggr = opts.aggression ?? 0.5;
    this.rng = makeRng('ai' + racer.id + (opts.seed || ''));
    this.offset = 0;          // current lateral offset from the racing line
    this.offsetTarget = 0;
    this.noisePhase = this.rng() * 100;
    this.stuckT = 0;
    this.reverseT = 0;
    this.nitroCool = 2 + this.rng() * 4;
    this.mistakeT = 0;
    this.mistake = 0;
    this.passSide = 0;
    const P = racer.vehicle.P;
    // corner speeds scale with how much grip this car really has vs the line's assumption
    this.gripScale = Math.sqrt(P.mu / 1.12) * 0.97 * (1 + P.clA * 0.1);
    this.rubber = opts.rubber ?? 1;
  }

  /** Called every frame before physics. race: the RaceSession. */
  update(dt, race) {
    const r = this.r, T = this.T, v = r.vehicle, ctl = r.ctl;
    const line = T.line;
    const speed = v.speed;
    const i0 = r.hint >= 0 ? r.hint : T.nearestIndex(v.x, v.z);

    // ---------- stuck / recovery
    if (race.state === 'racing') {
      if (speed < 2 && this.reverseT <= 0) this.stuckT += dt; else this.stuckT = Math.max(0, this.stuckT - dt * 2);
      if (this.stuckT > 2.2 && this.reverseT <= 0) { this.reverseT = 1.1; this.stuckT = 0; this.stuckCount = (this.stuckCount || 0) + 1; }
      if ((this.stuckCount || 0) >= 3) { race.resetRacer(r); this.stuckCount = 0; }
    }
    if (this.reverseT > 0) {
      this.reverseT -= dt;
      // back away from the wall, steering to point the nose down the road
      const lat = r.lat || 0;
      ctl.throttle = 0; ctl.brake = 1; ctl.handbrake = false; ctl.nitro = false;
      ctl.steer = clamp(lat * 0.25, -1, 1);
      if (this.reverseT <= 0 && speed < 6) this.stuckCount = Math.max(0, (this.stuckCount || 0) - 1);
      return;
    }

    // ---------- lateral plan: racing line + overtaking/avoidance offset
    this.noisePhase += dt * (0.25 + (1 - this.skill) * 0.4);
    const wobble = Math.sin(this.noisePhase) * Math.sin(this.noisePhase * 0.37 + 1.3) * (1.3 - this.skill) * 1.2;
    this.planTraffic(race, i0);
    this.offset += clamp(this.offsetTarget - this.offset, -dt * 3.2, dt * 3.2);

    const look = clamp(5 + speed * 0.42, 7, 42);
    const steps = Math.round(look / T.step);
    const it = T.idx(i0 + steps);
    const wT = T.W[it];
    const latT = clamp(line.off[it] + this.offset + wobble, -wT + 1.3, wT - 1.3);
    const tx = T.X[it] + T.LX[it] * latT;
    const tz = T.Z[it] + T.LZ[it] * latT;

    // pure pursuit
    const [fx, fz] = v.fwd;
    const [lx, lz] = v.left;
    const dx = tx - v.x, dz = tz - v.z;
    const f = dx * fx + dz * fz, l = dx * lx + dz * lz;
    const d2 = f * f + l * l;
    const kappa = 2 * l / Math.max(1, d2);
    let delta = Math.atan(kappa * v.P.wb);
    if (f < 0) delta = Math.sign(l || 1) * 0.6; // target behind: turn around
    const lock = v.P.steerLock / (1 + Math.max(0, Math.abs(v.vF) - 6) / 24);
    let steer = -delta / Math.max(0.05, lock);
    // damp yaw oscillation
    steer += v.yawRate * 0.05;
    ctl.steer = clamp(steer, -1, 1);

    // ---------- speed plan
    const reactAhead = Math.round((6 + speed * 0.4) / T.step);
    let vLine = Infinity;
    for (let k = 0; k <= reactAhead; k += 2) vLine = Math.min(vLine, line.speed[T.idx(i0 + k)]);
    let skillMul = 0.83 + 0.14 * this.skill;
    // mistakes: a lapse in concentration now and then (lower skill = more)
    this.mistakeT -= dt;
    if (this.mistakeT <= 0) {
      this.mistakeT = 6 + this.rng() * 14 * (0.5 + this.skill);
      this.mistake = this.rng() < (1 - this.skill) * 0.6 ? (this.rng() < 0.5 ? -0.12 : 0.07) : 0;
      this.mistakeDur = 1.2 + this.rng() * 1.5;
    }
    if (this.mistakeDur > 0) { this.mistakeDur -= dt; skillMul += this.mistake; }
    // rubber band relative to the player
    let band = 1;
    if (race.player && race.state === 'racing' && this.rubber) {
      const gap = r.total - race.player.total; // + = AI ahead
      if (gap < -120) band = 1 + clamp((-gap - 120) / 900, 0, 0.07) * this.rubber;
      if (gap > 160) band = 1 - clamp((gap - 160) / 1200, 0, 0.06) * this.rubber;
    }
    // drafting a car ahead lets it hold more speed; side-by-side caution
    let vTarget = vLine * this.gripScale * skillMul * band;
    vTarget = Math.min(vTarget, 120);
    if (this.blocked) vTarget = Math.min(vTarget, this.blockedSpeed);
    if (r.finished || r.out) vTarget = Math.min(vTarget, 16);

    const err = vTarget - speed;
    if (err > 1.0) { ctl.throttle = clamp(0.6 + err * 0.12, 0, 1); ctl.brake = 0; }
    else if (err < -1.2) { ctl.throttle = 0; ctl.brake = clamp(-err * 0.3, 0.2, 1); }
    else { ctl.throttle = clamp(0.4 + err * 0.2, 0, 1); ctl.brake = 0; }
    // corner exit with a big slip angle: ease off
    if (Math.abs(v.driftAngle) > 0.35) ctl.throttle *= 0.5;
    ctl.handbrake = false;
    if (race.state !== 'racing') { ctl.throttle = race.state === 'countdown' ? 0.35 + 0.3 * Math.sin(race.time * 7 + r.id) : 0; ctl.brake = 0; }

    // ---------- nitrous on straights
    this.nitroCool -= dt;
    let straightAhead = true;
    for (let k = 4; k < 70; k += 6) if (line.curv[T.idx(i0 + k)] > 1 / 180) { straightAhead = false; break; }
    const wantNitro = race.state === 'racing' && straightAhead && speed > 22 && this.nitroCool <= 0 && v.nitro > 0.15;
    if (wantNitro && !this.nitroHeld) {
      const behind = race.player ? r.total < race.player.total + 30 : true;
      if (behind || this.rng() < 0.3 * this.aggr) { this.nitroHeld = 1.5 + this.rng() * 2.5; }
      this.nitroCool = 3 + this.rng() * 6;
    }
    if (this.nitroHeld) {
      this.nitroHeld -= dt;
      if (this.nitroHeld <= 0 || !straightAhead) this.nitroHeld = 0;
    }
    ctl.nitro = !!this.nitroHeld;
    // AI refills a bit of nitrous over time
    v.nitro = Math.min(1, v.nitro + dt * 0.012 * (0.5 + this.skill));
  }

  /** Look for cars ahead/alongside and set offsetTarget / blocked speed. */
  planTraffic(race, i0) {
    const r = this.r, T = this.T, v = r.vehicle;
    this.blocked = false;
    let target = 0;
    let threat = null, threatDs = Infinity;
    for (const o of race.racers) {
      if (o === r || o.out) continue;
      const ds = T.deltaS(r.s, o.s);
      const dLat = (o.lat ?? 0) - (r.lat ?? 0);
      if (ds > -6 && ds < 8 && Math.abs(dLat) < 2.6) {
        // alongside: lean away
        target += (dLat > 0 ? -1 : 1) * (2.6 - Math.abs(dLat)) * 0.9;
      }
      if (ds > 2 && ds < 18 + v.speed * 0.6 && Math.abs(dLat) < 2.8) {
        const closing = v.speed - o.vehicle.speed;
        if ((closing > -1 || ds < 10) && ds < threatDs) { threat = o; threatDs = ds; }
      }
    }
    if (threat) {
      const i = r.hint >= 0 ? r.hint : i0;
      const W = T.W[i];
      const lineOff = T.line.off[T.idx(i + 6)];
      const tl = threat.lat ?? 0;
      // choose the side with more room (sticky once chosen)
      if (!this.passSide) {
        const roomL = (W - 1.3) - tl, roomR = tl - (-W + 1.3);
        this.passSide = roomL > roomR ? 1 : -1;
      }
      const want = clamp(tl + this.passSide * 3.3, -W + 1.3, W - 1.3);
      target += want - lineOff;
      // not enough room: tuck in and match speed
      const room = this.passSide > 0 ? (W - 1.3) - tl : tl + W - 1.3;
      if (room < 2.6 && threatDs < 12) { this.blocked = true; this.blockedSpeed = threat.vehicle.speed * 0.98; }
    } else {
      this.passSide = 0;
    }
    this.offsetTarget = clamp(target, -7, 7);
  }

}

export { lerp };
