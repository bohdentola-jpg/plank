// AI drivers. They drive the same physics as the player:
//   • follow the track's minimum-curvature racing line (track.line.off)
//     with pure-pursuit steering and a lookahead that grows with speed
//   • throttle/brake from the line's speed profile (curvature limit +
//     backward braking pass), scaled by skill and the car's own grip
//   • pick a side and overtake slower cars, give room alongside
//   • modest rubber-banding, nitrous on straights, small human mistakes
//   • a personality: aggression sets how late they brake, how close they'll
//     run alongside, how readily they pull out to pass, whether they defend
//     the inside against a faster car behind, and how often they slip up
//   • drift the hairpins now and then (a rear driver with some nerve most
//     of all): brake + turn in, steer the drift's tightness to hold the
//     racing line, gas to hold the speed, let go on the way out
//   • recover from walls (reverse out) and respawn if truly stuck
import { clamp, lerp, makeRng } from '../core/util.js';

/** Distance needed to shed `closing` m/s of speed (with a reaction margin). */
const stopDist = (closing) => (closing > 0 ? 4 + closing * 0.35 + (closing * closing) / 16 : 4);

/**
 * How much of the grip estimate a corner really gives at speed v. Measured
 * with the AI's own driving on circles: all of it in slow and medium
 * corners, ~95% at 42 m/s, ~87% at 52, ~77% at 65 (fast sweepers ran the
 * AI wide, and side by side in a pack that meant the wall).
 */
const fastGrip = (v, k = 0.0072) => (v <= 32 ? 1 : Math.max(0.7, 1 - (v - 32) * k));

/**
 * The hairpins on a track's racing line (cached on the track): tight bends
 * (radius under ~50 m) turning through more than ~70°, with where to turn in,
 * the apex, where it opens out, which way it goes.
 */
function hairpins(T) {
  if (T._hairpins) return T._hairpins;
  const out = [];
  const N = T.N, curv = T.line.curv;
  const tight = 1 / 50, soft = 1 / 220;
  let i = 0;
  const seen = new Uint8Array(N);
  for (let n = 0; n < N; n++) {
    i = n;
    if (seen[i] || curv[i] < tight) continue;
    // grow the tight run
    let a = i, b = i;
    while (curv[T.idx(a - 1)] >= tight && !seen[T.idx(a - 1)] && (T.closed || a > 0) && i - a < N) a--;
    while (curv[T.idx(b + 1)] >= tight && (T.closed || b < N - 1) && b - i < N) b++;
    for (let k = a; k <= b; k++) seen[T.idx(k)] = 1;
    let ang = 0, sgn = 0, apex = a, cMax = 0;
    for (let k = a; k <= b; k++) { const j = T.idx(k); ang += curv[j] * T.step; sgn += T.Ks[j]; if (curv[j] > cMax) { cMax = curv[j]; apex = j; } }
    if (ang < 1.2) continue;
    // the turn-in: back to where the bend starts to build (and a straight-ish run before it)
    let e = a, back = 0;
    while (back < 30 / T.step && curv[T.idx(e - 1)] >= soft && (T.closed || e > 0)) { e--; back++; }
    let x = b, fwd = 0;
    while (fwd < 30 / T.step && curv[T.idx(x + 1)] >= soft && (T.closed || x < N - 1)) { x++; fwd++; }
    if (!T.closed && (e < 10 || x > N - 10)) continue;
    out.push({ entry: T.idx(e), apex, exit: T.idx(x), dir: Math.sign(sgn) || 1, angle: ang, release: 6 + ang * 4 });
  }
  T._hairpins = out;
  return out;
}

/** This car's own speed plan along the racing line: corner limits from its
 *  grip (less of it at high speed: k is how fast it fades), then the braking
 *  passes. */
function speedProfile(T, gripScale, k = 0.0072) {
  const N = T.N, curv = T.line.curv;
  const v = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    const v0 = Math.min(95, Math.sqrt(1.12 * 9.81 / Math.max(1e-4, curv[i])) * gripScale);
    let vv = v0;
    for (let n = 0; n < 3; n++) vv = v0 * fastGrip(vv, k);
    v[i] = vv;
  }
  const decel = 9.81 * 1.12 * 0.82 * gripScale * gripScale;
  for (let pass = 0; pass < (T.closed ? 2 : 1); pass++) {
    for (let i = N - 1; i >= 0; i--) {
      if (!T.closed && i === N - 1) continue;
      const j = T.idx(i + 1);
      const grade = (T.Y[j] - T.Y[i]) / T.step;
      const dec = Math.max(2.5, decel + 9.81 * grade);
      v[i] = Math.min(v[i], Math.sqrt(v[j] * v[j] + 2 * dec * T.step));
    }
  }
  return v;
}

export class AIDriver {
  constructor(racer, track, opts = {}) {
    this.r = racer;
    this.T = track;
    this.skill = clamp(opts.skill ?? 0.8, 0, 1.2);
    this.aggr = clamp(opts.aggression ?? 0.5, 0, 1);
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
    // two plans: the steady-state limit (when someone's alongside and the
    // road's width isn't ours to run wide on), and a bolder one when alone on
    // the line, where a fast sweeper's short arc can be taken over the limit
    // and the room on the outside soaks up the slide
    this.vPlan = track.line ? speedProfile(track, this.gripScale) : null;
    this.vPlanFree = track.line ? speedProfile(track, this.gripScale, 0.0012) : null;
    // how often this driver drifts a hairpin rather than gripping round it
    const drv = P.drive === 'RWD' ? 0.3 : P.drive === 'AWD' ? 0.1 : -0.15;
    this.driftLove = opts.style === 'drift' ? 1 : opts.style === 'grip' ? 0 : clamp(0.2 + (this.aggr - 0.5) * 0.7 + drv, 0, 0.9);
    this.driftMode = false;
    this.driftPick = new Map();
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
    let latT = clamp(line.off[it] + this.offset + wobble, -wT + 1.3, wT - 1.3);
    // side by side: never aim into the car alongside (both are heading for
    // the same apex). If there isn't room for two, whoever is behind backs out.
    const room = this.sideRoom(race, latT, -wT + 1.3, wT - 1.3);
    latT = room.lat;
    const tx = T.X[it] + T.LX[it] * latT;
    const tz = T.Z[it] + T.LZ[it] * latT;

    // a hairpin worth drifting: the drift drives the car instead (see driftDrive)
    if (this.driftDrive(race, i0, tx, tz, latT)) return;

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
    // and a nudge away from a door that's closing on ours
    steer += room.push;
    ctl.steer = clamp(steer, -1, 1);

    // ---------- speed plan
    const reactAhead = Math.round((6 + speed * 0.4) / T.step);
    if (!this.vPlan) { this.vPlan = speedProfile(T, this.gripScale); this.vPlanFree = speedProfile(T, this.gripScale, 0.0012); }
    // free to use the whole road: nobody near and close to the racing line
    this.crowd = Math.max(0, (this.crowd || 0) - dt);
    const plan = this.crowd > 0 || Math.abs(this.offset) > 1.2 ? this.vPlan : this.vPlanFree;
    let vLine = Infinity, kMin = i0;
    for (let k = 0; k <= reactAhead; k += 2) {
      const j = T.idx(i0 + k);
      // off the racing line on the inside of a bend is a tighter radius
      const inward = this.offset * Math.sign(T.Ks[j]);
      const tight = inward > 0 ? Math.sqrt(Math.max(0.6, 1 - Math.abs(T.Ks[j]) * inward * 1.6)) : 1;
      const vk = plan[j] * tight;
      if (vk < vLine) { vLine = vk; kMin = j; }
    }
    void kMin;
    let skillMul = 0.83 + 0.14 * this.skill;
    // the brave brake later (and the timid earlier) — into corners only
    if (vLine < speed - 2) skillMul += (this.aggr - 0.5) * 0.035;
    // mistakes: a lapse in concentration now and then (lower skill = more)
    this.mistakeT -= dt;
    if (this.mistakeT <= 0) {
      this.mistakeT = 6 + this.rng() * 14 * (0.5 + this.skill);
      this.mistake = this.rng() < (1 - this.skill) * 0.6 * (0.7 + 0.6 * this.aggr) ? (this.rng() < 0.55 ? -0.12 : 0.045) : 0;
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
    let vTarget = vLine * skillMul * band;
    vTarget = Math.min(vTarget, 120);
    if (this.blocked) vTarget = Math.min(vTarget, this.blockedSpeed);
    if (room.yield !== null) vTarget = Math.min(vTarget, room.yield);
    if (r.finished || r.out) {
      vTarget = Math.min(vTarget, 16);
      // a sprint's road runs out past the line: pull up before the end of it
      if (!T.closed) vTarget = Math.min(vTarget, Math.sqrt(Math.max(0, 2 * 5 * (T.length - 20 - (r.s ?? 0)))));
    }

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
      // (front drivers only ease off a little: lifting hard swings their tail
      // out — but flat out in a fast sweeper with the edge coming up, a full
      // lift and a touch of brake are the only way back)
      const room = T.W[i0] + bend * (r.lat ?? 0);   // to the outside edge
      const edgeNear = clamp((3.5 - room) / 2.5, 0, 1);
      const floor = (v.P.drive === 'RWD' ? 0.35 : v.P.drive === 'AWD' ? 0.5 : 0.7) * (1 - edgeNear * clamp((speed - 30) / 12, 0, 1));
      if (bend && line.curv[i0] > 1 / 1200 && wide > 0.7) ctl.throttle *= clamp(1 - (wide - 0.7) * 0.22, floor, 1);
      if (bend && speed > 30 && wide > 1.5 && room < 2.2) { ctl.throttle = 0; ctl.brake = Math.max(ctl.brake, v.P.drive === 'RWD' ? 0.12 : 0.22); }
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
    if (this.capBrake !== undefined) { ctl.brake = Math.min(ctl.brake, this.capBrake); this.capBrake = undefined; }
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

  /**
   * Drifting a hairpin. Arm (brake + turn in at the turn-in point), then
   * while the drift holds steer its tightness so the car's path (its
   * velocity, not its nose) runs at the racing line, gas or brake to the
   * corner's speed, and let go once the corner opens out. Returns true when
   * it has set the controls this frame.
   */
  driftDrive(race, i0, tx, tz, latT) {
    const r = this.r, T = this.T, v = r.vehicle, ctl = r.ctl;
    const zones = hairpins(T);
    if (!this.driftMode) {
      if (!zones.length || race.state !== 'racing' || r.finished || r.out || this.crowd > 0 || this.reverseT > 0) return false;
      if (v.speed < 13 || v.airborne) return false;
      const z = zones.find((q) => { const d = T.deltaS(i0 * T.step, q.entry * T.step); return d >= -2 && d < 6; });
      if (!z) return false;
      const key = `${z.entry}:${r.lap}`;
      if (!this.driftPick.has(key)) this.driftPick.set(key, this.rng() < this.driftLove);
      if (!this.driftPick.get(key)) return false;
      this.driftMode = true;
      this.driftPhase = 'arm';
      this.driftT = 0;
      this.zone = z;
    }
    const z = this.zone;
    const dt = this._dt || 1 / 60;
    this.driftT += dt;
    if (this.driftPhase === 'arm') {
      if (v.driftState === 1) { this.driftPhase = 'hold'; }
      else if (this.driftT > 0.4) { this.driftMode = false; return false; }
      else {
        ctl.throttle = 0; ctl.brake = 0.7; ctl.handbrake = false; ctl.nitro = false;
        ctl.steer = -z.dir * 0.85;
        return true;
      }
    }
    if (this.driftPhase === 'hold') {
      // where the corner goes from here: let go once it opens out
      const past = T.deltaS(z.apex * T.step, i0 * T.step);
      const left = T.deltaS(i0 * T.step, z.exit * T.step);
      const wide = Math.abs((r.lat ?? 0) - latT);
      const nearEdge = Math.abs(r.lat ?? 0) > T.W[i0] - 0.6;
      if (v.driftState !== 1 || (past > 0 && left < z.release) || wide > 3.2 || nearEdge || this.driftT > 6) {
        this.driftPhase = 'out';
      } else {
        // pursuit in the frame of the car's path (in a drift the nose points in)
        const sp = Math.max(5, v.speed);
        const ph = Math.atan2(v.vx, v.vz);
        const pfx = Math.sin(ph), pfz = Math.cos(ph), plx = Math.cos(ph), plz = -Math.sin(ph);
        const dx = tx - v.x, dz = tz - v.z;
        const f = dx * pfx + dz * pfz, l = dx * plx + dz * plz;
        const kappa = 2 * l / Math.max(1, f * f + l * l);
        const mu = v.P.mu * 1.08 * (v.P.split > 0 && v.P.split < 1 ? 1.05 : 1);
        const k = (kappa * sp * sp * z.dir) / (mu * 9.81);
        const into = clamp(k >= 0.525 ? (k - 0.525) / 1.025 : (k - 0.525) / 0.325, -1, 1);
        ctl.steer = -into * z.dir;
        // the corner's speed (a touch under the grip plan: it's for show, not to win)
        let vT = Infinity;
        for (let q = 0; q <= 16; q += 2) vT = Math.min(vT, this.vPlan[T.idx(i0 + q)]);
        vT *= 0.97;
        if (sp > vT + 1) { ctl.throttle = 0; ctl.brake = 0.8; }
        else { ctl.throttle = clamp(0.55 + (vT - sp) * 0.2, 0.35, 1); ctl.brake = 0.3; }
        ctl.handbrake = false; ctl.nitro = false;
        return true;
      }
    }
    // on the way out: off the brake (a press would put it straight back in)
    // and the normal driving takes over; done when the tires have it again
    if (v.driftState !== 1) { this.driftMode = false; return false; }
    this.capBrake = 0.15;
    return false;
  }

  /**
   * Cars alongside (overlapping or nearly, within a few metres sideways):
   * keep the steering target a car's width plus a margin clear of each one,
   * steer gently away from one that's too close, and when the road between
   * them and the edge is too narrow for us, back out if we're the one
   * behind. Returns { lat, push, yield }.
   */
  sideRoom(race, latT, lo, hi) {
    const r = this.r, T = this.T, v = r.vehicle;
    const out = this._room || (this._room = {});
    out.push = 0;
    out.yield = null;
    const myLat = r.lat ?? 0;
    const myW = r.dims.W;
    let minLat = lo, maxLat = hi;
    let squeeze = null;
    for (const o of race.racers) {
      if (o === r || o.out || o.parked) continue;
      const ds = T.deltaS(r.s, o.s);                      // + = they're ahead
      const reach = (r.dims.L + o.dims.L) / 2 + 1.5;
      if (Math.abs(ds) > reach) continue;
      const oLat = o.lat ?? 0;
      const dLat = oLat - myLat;
      if (Math.abs(dLat) > 4.5) continue;
      // where they'll be in a moment (their sideways drift across the road)
      const ov = o.vehicle;
      const i = o.hint >= 0 ? o.hint : T.posAt(o.s).i;
      const oSide = ov.vx * T.LX[i] + ov.vz * T.LZ[i];
      const oSoon = oLat + clamp(oSide, -3, 3) * 0.35;
      const sep = (myW + o.dims.W) / 2 + 0.7 - this.aggr * 0.3;
      if (dLat > 0) maxLat = Math.min(maxLat, Math.min(oLat, oSoon) - sep);
      else minLat = Math.max(minLat, Math.max(oLat, oSoon) + sep);
      const gap = Math.abs(dLat) - sep + 0.25;
      if (gap < 0) out.push += (dLat > 0 ? 1 : -1) * Math.min(0.18, -gap * 0.22);
      if (ds > 0.8 && (!squeeze || ds > squeeze.ds)) squeeze = { ds, speed: ov.speed };
    }
    if (minLat <= maxLat) {
      out.lat = clamp(latT, minLat, maxLat);
    } else {
      // no room for us beside them: tuck in behind whoever's ahead
      out.lat = latT;
      if (squeeze) out.yield = Math.max(0, squeeze.speed - 1.2);
    }
    void v;
    return out;
  }

  respawn(race) {
    race.resetRacer(this.r);
    this.stuckCount = 0; this.stuckT = 0; this.reverseT = 0;
    this.progS = this.r.total; this.progT = 0;
  }

  /**
   * Covering the inside: a faster car right behind and a braking zone coming
   * up → one move toward the inside of that corner, held until the corner,
   * never weaving. How often depends on aggression. Returns the lateral to
   * hold at the steering target, or null.
   */
  defence(race, i0, it, edge) {
    const r = this.r, T = this.T, v = r.vehicle;
    if (this.defT > 0) {
      this.defT -= this._dt || 0.016;
      if (this.defT > 0) return this.defLat;
    }
    this.defLat = null;
    if (race.state !== 'racing' || this.aggr < 0.35 || r.finished) return null;
    let threat = null;
    for (const o of race.racers) {
      if (o === r || o.out || o.finished) continue;
      const ds = T.deltaS(r.s, o.s);
      if (ds < -24 || ds > -4) continue;
      if (o.vehicle.speed < v.speed - 0.5) continue;
      if (Math.abs((o.lat ?? 0) - (r.lat ?? 0)) > 3.2) continue;   // already beside us: too late
      threat = o;
      break;
    }
    if (!threat) return null;
    // a real braking zone 40-140 m ahead, and which way that corner goes
    const plan = this.vPlan;
    let corner = -1;
    for (let d = 40; d <= 140; d += 6) {
      const j = T.idx(i0 + Math.round(d / T.step));
      if (plan[j] < v.speed * 0.78) { corner = j; break; }
    }
    if (corner < 0) return null;
    // decide once per approach (the rng keeps it a personality, not a rule)
    if (this.defCorner === corner) return null;
    this.defCorner = corner;
    if (this.rng() > (this.aggr - 0.25) * 1.4) return null;
    let k = 0;
    for (let d = 0; d < 60; d += 4) k += T.Ks[T.idx(corner + Math.round(d / T.step))];
    const inside = Math.sign(k);
    if (!inside) return null;
    this.defLat = inside * Math.min(edge, 2.6);
    this.defT = 2.2 + this.aggr;
    void it;
    return this.defLat;
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
      if (ds > -4 && ds < 30 && Math.abs(dLat) < 7) this.crowd = 1.2;
      const oSpeed = o.vehicle.speed; // traffic: signed along the road (− = oncoming)
      const closing = v.speed - oSpeed;
      const reach = Math.max(18 + v.speed * 0.6, stopDist(closing) + 12);
      if (ds > 1.5 && ds < reach) near.push({ ds, lat: oLat, closing, speed: oSpeed });
    }
    const defend = this.defence(race, i0, it, edge);
    if (!near.length) {
      this.passSide = 0;
      this.laneGoal = null;
      this.offsetTarget = clamp(lean + (defend === null ? 0 : defend - T.line.off[it]), -7, 7);
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
      const eager = 1.3 - 0.6 * this.aggr;
      const score = Math.min(t, 6) - 0.35 * move * eager - 0.12 * Math.abs(L - lineLat) * eager - squeeze;
      if (score > bestScore) { bestScore = score; bestL = L; }
      if (this.laneGoal != null && Math.abs(L - this.laneGoal) < 0.5) prevScore = Math.max(prevScore, score);
    }
    const [tLine] = ttcAt(lineLat);
    if (tLine >= 6 && Math.abs(myLat - lineLat) < 1.5) {
      // the racing line is clear: no need to dodge
      this.laneGoal = null;
      this.passSide = 0;
      this.offsetTarget = clamp(lean + (defend === null ? 0 : defend - T.line.off[it]), -7, 7);
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
