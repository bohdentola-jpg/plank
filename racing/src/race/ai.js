// AI drivers. They drive the same physics as the player:
//   • follow the track's minimum-curvature racing line (track.line.off)
//     with pure-pursuit steering and a lookahead that grows with speed
//   • throttle/brake from the line's speed profile (curvature limit +
//     backward braking pass), scaled by skill and the car's own grip
//   • pick a side and overtake slower cars, give room alongside
//   • modest rubber-banding, nitrous on straights, small human mistakes
//   • recover from walls (reverse out) and respawn if truly stuck
import { clamp, lerp, makeRng } from '../core/util.js';

/** Distance needed to shed `closing` m/s of speed (with a reaction margin). */
const stopDist = (closing) => (closing > 0 ? 4 + closing * 0.35 + (closing * closing) / 16 : 4);

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
    // corner speeds scale with how much grip this car really has vs the line's
    // assumption. Steady-state cornering only gets part of the tires' peak mu
    // (the driven axle spends grip holding speed against drag, most of all
    // with the power at the rear), so plan on that, not the peak.
    const eff = P.drive === 'RWD' ? 0.9 : P.drive === 'AWD' ? 0.91 : 0.94;
    this.gripScale = Math.sqrt((P.mu * eff) / 1.12) * 0.99 * (1 + P.clA * 0.1);
    this.rubber = opts.rubber ?? 1;
  }

  /** Called every frame before physics. race: the RaceSession. */
  update(dt, race) {
    const r = this.r, T = this.T, v = r.vehicle, ctl = r.ctl;
    this._dt = dt;
    const line = T.line;
    const speed = v.speed;
    const i0 = r.hint >= 0 ? r.hint : T.nearestIndex(v.x, v.z);

    // ---------- stuck / recovery
    // heading error vs the road (+ = the road runs off to our left)
    const [hfx, hfz] = v.fwd, [hlx, hlz] = v.left;
    const rfx = -T.LZ[i0], rfz = T.LX[i0];
    const headErr = Math.atan2(rfx * hlx + rfz * hlz, rfx * hfx + rfz * hfz);
    if (race.state === 'racing' && !r.finished && !r.out) {
      // progress watchdog: no real headway for a while → back on the road
      if (this.progS === undefined || r.total - this.progS > 20) { this.progS = r.total; this.progT = 0; this.stuckCount = 0; }
      this.progT += dt;
      if (this.progT > 9) { this.respawn(race); return; }
      if (speed < 2 && this.reverseT <= 0) this.stuckT += dt; else this.stuckT = Math.max(0, this.stuckT - dt * 2);
      if (this.stuckT > 1.6 && this.reverseT <= 0) { this.reverseT = 2.6; this.revMin = 0.8; this.stuckT = 0; this.stuckCount = (this.stuckCount || 0) + 1; }
      if ((this.stuckCount || 0) >= 4) { this.respawn(race); return; }
    }
    if (this.reverseT > 0) {
      this.reverseT -= dt;
      this.revMin -= dt;
      // back out with opposite lock so the nose swings round to face the road
      ctl.throttle = 0; ctl.brake = 1; ctl.handbrake = false; ctl.nitro = false;
      ctl.steer = Math.abs(headErr) > 0.12 ? Math.sign(headErr) : 0;
      if (this.revMin <= 0 && Math.abs(headErr) < 0.3) this.reverseT = 0;
      return;
    }

    // ---------- lateral plan: racing line + overtaking/avoidance offset
    this.noisePhase += dt * (0.25 + (1 - this.skill) * 0.4);
    const wobble = Math.sin(this.noisePhase) * Math.sin(this.noisePhase * 0.37 + 1.3) * (1.3 - this.skill) * 1.2;
    const look = clamp(5 + speed * 0.42, 7, 42);
    const steps = Math.round(look / T.step);
    const it = T.idx(i0 + steps);
    this.planTraffic(race, i0, it);
    this.offset += clamp(this.offsetTarget - this.offset, -dt * 4.5, dt * 4.5);
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
    // (plus what the tires' slip costs at speed: the car understeers, so a
    // purely geometric aim runs wide on a fast bend)
    let delta = Math.atan(kappa * (v.P.wb + 0.0008 * speed * speed));
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
      this.mistake = this.rng() < (1 - this.skill) * 0.6 ? (this.rng() < 0.55 ? -0.12 : 0.045) : 0;
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
    // running wide: sliding outside its line in a bend means more speed than
    // the car can turn with — feather the throttle (never the brakes: braking
    // mid-corner just spins it) until it tucks back in
    {
      const i1 = T.idx(i0 + 4);
      const bend = Math.sign(-T.LZ[i1] * T.LX[i0] + T.LX[i1] * T.LZ[i0]); // + = road bends left
      const wide = (line.off[i0] + this.offset - (r.lat ?? 0)) * bend;
      // (front drivers only ease off a little: lifting hard swings their tail out)
      const floor = v.P.drive === 'RWD' ? 0.35 : v.P.drive === 'AWD' ? 0.5 : 0.7;
      if (bend && line.curv[i0] > 1 / 1200 && wide > 0.7) ctl.throttle *= clamp(1 - (wide - 0.7) * 0.22, floor, 1);
    }
    // friction circle: hard on the brakes (or the power) and hard into a
    // turn don't mix
    {
      const latUse = (speed * speed * line.curv[i0]) / (v.P.mu * 9.81);
      if (ctl.brake > 0) ctl.brake = Math.min(ctl.brake, clamp(1.2 - latUse, 0.15, 1));
      if (ctl.throttle > 0) ctl.throttle = Math.min(ctl.throttle, clamp(1.3 - latUse, 0.35, 1));
    }
    // the tail is stepping out: catch it (countersteer, off the brakes, and
    // the throttle that settles this drivetrain: a breath for a rear driver,
    // a firm pull for a front driver) instead of riding the slide into a wall
    // (a few degrees of body slip is just a car cornering hard; leave that be)
    const slide = v.driftAngle || 0;
    const over = Math.abs(slide) - 0.14;
    if (speed > 12 && over > 0) {
      ctl.steer = clamp(ctl.steer - Math.sign(slide) * over * 2.4, -1, 1);
      if (over > 0.04) {
        ctl.brake = 0;
        if (v.P.drive === 'RWD') ctl.throttle = Math.min(ctl.throttle, 0.3);
        else ctl.throttle = Math.max(ctl.throttle, v.P.drive === 'FWD' ? 0.65 : 0.45);
      }
    }
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

  respawn(race) {
    race.resetRacer(this.r);
    this.stuckCount = 0; this.stuckT = 0; this.reverseT = 0;
    this.progS = this.r.total; this.progT = 0;
  }

  /** Look for cars ahead/alongside and set offsetTarget / blocked speed.
   *  Every lateral position across the road is scored by how long we could
   *  hold it before running into someone (time to collision), minus the cost
   *  of getting there and of leaving the racing line; the best one wins, with
   *  a little stickiness so the car commits to a side.
   *  it: the steering look-ahead index (the offset is applied there). */
  planTraffic(race, i0, it) {
    const r = this.r, T = this.T, v = r.vehicle;
    this.blocked = false;
    const myLat = r.lat ?? 0;
    const W = Math.min(T.W[T.idx(i0 + 6)], T.W[it]);
    const edge = W - 1.3;
    const lineLat = clamp(T.line.off[it], -edge, edge);
    let lean = 0;
    const near = this._near || (this._near = []);
    near.length = 0;
    const others = race.traffic ? race.racers.concat(race.traffic.cars) : race.racers;
    for (const o of others) {
      if (o === r || o.out) continue;
      const ds = T.deltaS(r.s, o.s);
      if (ds < -8 || ds > 160) continue;
      const oLat = o.lat ?? 0;
      const dLat = oLat - myLat;
      if (ds > -6 && ds < 8 && Math.abs(dLat) < 2.6) {
        // alongside: lean away
        lean += (dLat > 0 ? -1 : 1) * (2.6 - Math.abs(dLat)) * 0.9;
      }
      const oSpeed = o.vehicle.speed; // traffic: signed along the road (− = oncoming)
      const closing = v.speed - oSpeed;
      const reach = Math.max(18 + v.speed * 0.6, stopDist(closing) + 12);
      if (ds > 1.5 && ds < reach) near.push({ ds, lat: oLat, closing, speed: oSpeed });
    }
    if (!near.length) {
      this.passSide = 0;
      this.laneGoal = null;
      this.offsetTarget = clamp(lean, -7, 7);
      return;
    }
    // time until we'd run into someone holding lateral position L
    const ttcAt = (L) => {
      let best = 9, hit = null;
      for (const n of near) {
        if (Math.abs(n.lat - L) > 2.2) continue;
        const gap = Math.max(0, n.ds - 4.6);
        const t = n.closing > 0.3 ? gap / n.closing : (gap < 2 ? 0.4 : 9);
        if (t < best) { best = t; hit = n; }
      }
      return [best, hit];
    };
    const latSpeed = 2.4; // m/s we can realistically move across
    let bestL = lineLat, bestScore = -Infinity, prevScore = -Infinity;
    const N = Math.max(3, Math.round(edge * 2 / 0.9));
    for (let k = 0; k <= N; k++) {
      const L = -edge + (2 * edge * k) / N;
      const [t] = ttcAt(L);
      const move = Math.abs(L - myLat) / latSpeed;
      // getting there means crossing everything in between: each car on the
      // way must still be ahead of us by the time we cut across its line
      let squeeze = 0;
      const steps = Math.ceil(Math.abs(L - myLat) / 0.6);
      for (let j = 1; j < steps; j++) {
        const x = myLat + (L - myLat) * (j / steps);
        const [tx] = ttcAt(x);
        if (tx < move * (j / steps) + 0.4) { squeeze = 3; break; }
      }
      const score = Math.min(t, 6) - 0.35 * move - 0.12 * Math.abs(L - lineLat) - squeeze;
      if (score > bestScore) { bestScore = score; bestL = L; }
      if (this.laneGoal != null && Math.abs(L - this.laneGoal) < 0.5) prevScore = Math.max(prevScore, score);
    }
    const [tLine] = ttcAt(lineLat);
    if (tLine >= 6 && Math.abs(myLat - lineLat) < 1.5) {
      // the racing line is clear: no need to dodge
      this.laneGoal = null;
      this.passSide = 0;
      this.offsetTarget = clamp(lean, -7, 7);
    } else {
      if (this.laneGoal != null && prevScore > bestScore - 0.35) bestL = this.laneGoal;
      this.laneGoal = bestL;
      this.passSide = Math.sign(bestL - myLat) || 1;
      this.offsetTarget = clamp(bestL - T.line.off[it] + lean, -7, 7);
    }
    // brake when what's in front will arrive before we're out of its way
    const [tNow, hitNow] = ttcAt(myLat);
    if (hitNow && hitNow.speed >= 0) {
      const goal = this.laneGoal ?? lineLat;
      const [tGoal] = ttcAt(goal);
      const escape = Math.abs(goal - myLat) / latSpeed;
      const stopT = hitNow.closing > 0 ? stopDist(hitNow.closing) / Math.max(1, hitNow.closing) : 0;
      if ((tNow < escape + 0.6 && tNow < stopT + 0.5) || tGoal < 1.2) {
        this.blocked = true;
        this.blockedSpeed = Math.max(0, hitNow.speed - 0.5);
      }
    }
  }
}

export { lerp };
