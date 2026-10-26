// A player on the field: identity, physical capabilities derived from his
// ratings and build, and the movement physics every brain (AI or a person on a
// controller) drives through `want`.
//
// Movement model: each tick the brain sets want = { x, z, s, face }:
//   (x, z) a unit direction, s 0..1 of top speed (0 = stop), face an optional
//   heading to hold while moving (backpedal / shuffle / kick-slide).
// The body then accelerates toward that velocity under its limits: a forward
// push that fades as he nears top speed, braking, and a lateral (cutting)
// acceleration that is bigger at low speed — so a hard cut at full speed
// rounds off and costs speed, while a back plants and cuts sharply at 6 yd/s.
import { ACTIONS } from './anims.js';
import { clamp, wrapAngle, turnToward, headingOf } from './math.js';

const IN_TO_YD = 1 / 36;

export class Ent {
  constructor(player, side) {
    this.p = player;
    this.r = player.r;
    this.side = side;              // 'home' | 'away'
    this.id = player.id;
    this.num = player.number;
    this.name = player.last;
    // build
    this.height = player.height * IN_TO_YD;          // ~2 yd
    this.mass = player.weight;                         // lbs (used relatively)
    this.radius = clamp(0.33 + (player.weight - 180) / 150 * 0.13, 0.31, 0.5);
    this.reach = 0.62 + (player.height - 70) * 0.012;  // arm reach beyond the body, yd
    this.computeLimits();
    // state
    this.x = 0; this.z = 0; this.vx = 0; this.vz = 0;
    this.y = 0; this.vy = 0;                           // airborne (dives, hurdles, jumps)
    this.heading = 0;
    this.turnRate = 0;
    this.accel = 0;
    this.want = { x: 0, z: 0, s: 0, face: null };
    this.stamina = 1;
    this.reset();
  }

  /** Top speed, acceleration, cutting and braking from ratings (+ fatigue). */
  computeLimits(fatigue = 0) {
    const r = this.r;
    const f = 1 - fatigue * 0.08;
    // 99 speed ≈ 11.1 yd/s (22.7 mph), 84 ≈ 10 (a linebacker), 54 ≈ 8.1 (a guard)
    this.vTop = (6.3 + 4.8 * Math.pow(r.spd / 99, 1.6)) * f;
    // launch acceleration, yd/s² (fades with speed)
    this.a0 = (7.4 + 6.2 * Math.pow(r.acc / 99, 1.4)) * f;
    // cutting (lateral) acceleration and braking, yd/s²
    this.aLat = (8.5 + 9 * (r.agi / 99)) * f;
    this.brake = 9 + 5 * (r.agi / 99) - (this.mass - 200) / 100;
    // body turn rate (rad/s) when re-facing (backpedal → turn and run, etc.)
    this.spin = 7 + 6 * (r.agi / 99);
    // a backpedal / shuffle tops out well below a sprint
    this.vBack = this.vTop * (0.46 + 0.2 * (r.agi / 99));
    this.vSide = this.vTop * (0.4 + 0.16 * (r.agi / 99));
  }

  /** Clear per-play state (positions are set by the play setup). */
  reset() {
    this.vx = this.vz = 0;
    this.y = this.vy = 0;
    this.state = 'set';            // set | active | engaged | wrapped | wrapping | falling | down | air | dead
    this.base = 'stand';
    this.action = null;            // { name, t, dur, side, power, data }
    this.carry = null;             // 'L' | 'R' | 'two' | null
    this.look = null;
    this.reachAt = null;
    this.engaged = null;           // the engagement record while blocking / being blocked
    this.wrappedBy = [];           // tacklers hanging on (carrier)
    this.wrapping = null;          // the carrier this tackler hangs on to
    this.recover = 0;              // seconds until he can act again (after a fall, a whiff)
    this.downT = 0;
    this.role = null;              // this play's role key ('QB', 'X', 'CB1', …)
    this.asg = null;               // assignment for this play (route / block / coverage / rush / kick)
    this.mem = {};                 // brain scratchpad
    this.ctrl = null;              // null = AI, 0/1 = that controller's person
    this.speedCap = 1;             // multiplier from state (wrapped, engaged…)
    this.want.x = this.want.z = this.want.s = 0;
    this.want.face = null;
    this.onField = true;
    this.tackleCD = 0;             // cooldown between tackle attempts
    this.catchCD = 0;
    this.boost = null;             // { vx, vz, t } impulse (jukes, dives)
    this.immune = 0;               // seconds of immunity to arm tackles (spin, hurdle)
    this.moveCD = 0;               // cooldown between special moves
    this.cutBoost = 0;             // seconds of extra cutting grip (a planted route break)
    this.hist = [];                // recent [x, z, vx, vz] samples (defenders react to the past)
    this.histT = 0;
  }

  get speed() { return Math.hypot(this.vx, this.vz); }
  get standing() { return this.state !== 'down' && this.state !== 'falling' && this.state !== 'dead' && !this.onGround; }
  get onGround() { return this.base === 'lie_front' || this.base === 'lie_back' || this.base === 'sit'; }
  get free() {
    return this.standing && this.state !== 'engaged' && this.state !== 'wrapping' && this.recover <= 0 && !this.isBusyAction();
  }

  isBusyAction() {
    const a = this.action;
    if (!a) return false;
    // these block other moves while they play
    return /^(dive|dive_tackle|cut|tackle|hit|fall_|pancaked|getup|stumble|catch_dive|catch_high|fumble_dive|scoop|slide|kneel|kick|punt|hurdle|spin|juke|throw|pitch|lateral|handoff|snap|take_snap|catch_snap|longsnap|jump_swat)/.test(a.name) && a.t < a.dur;
  }

  /** Start an action (the model plays the matching clip from t=0). */
  act(name, opts = {}) {
    const def = ACTIONS[name];
    this.action = { name, t: 0, prevT: -1, dur: opts.dur ?? def?.dur ?? 0.5, side: opts.side ?? null, power: opts.power ?? 0.5, data: opts.data ?? null, held: !!def?.held };
    return this.action;
  }

  /** Has the current action just crossed time `k` this tick? */
  crossed(name, k) {
    const a = this.action;
    return !!a && a.name === name && a.prevT < k && a.t >= k;
  }

  setWant(dx, dz, s, face = null) {
    const l = Math.hypot(dx, dz);
    if (l < 1e-6 || s <= 0) { this.want.x = this.want.z = 0; this.want.s = 0; } else {
      this.want.x = dx / l; this.want.z = dz / l; this.want.s = clamp(s, 0, 1);
    }
    this.want.face = face;
  }

  /** Go to a point, arriving gently. `s` = speed fraction en route. */
  goTo(x, z, s = 1, face = null, arrive = 1.2) {
    const dx = x - this.x, dz = z - this.z;
    const d = Math.hypot(dx, dz);
    if (d < 0.05) { this.setWant(0, 0, 0, face); return d; }
    // slow on arrival so he doesn't orbit the spot
    const sp = Math.min(s, d / Math.max(0.3, arrive * this.vTop) * 1.6 + 0.05);
    this.setWant(dx, dz, sp, face);
    return d;
  }

  /** Integrate movement for one tick. */
  move(dt) {
    if (this.boost) {
      this.boost.t -= dt;
      if (this.boost.t <= 0) this.boost = null;
    }
    const ground = this.state === 'down' || this.state === 'falling' || this.onGround;
    if (ground || this.state === 'set' || this.state === 'dead') {
      // friction: bodies on the ground slide to a stop
      const k = Math.exp(-dt * (ground ? 5 : 12));
      this.vx *= k; this.vz *= k;
      this.x += this.vx * dt; this.z += this.vz * dt;
      this.accel = 0;
      this.turnRate = 0;
      return;
    }
    const sp = Math.hypot(this.vx, this.vz);
    const w = this.want;
    // what kind of movement: forward run, backpedal or shuffle, from the angle
    // between the way he wants to go and the way he wants to face
    let cap = this.vTop;
    if (w.face !== null && w.s > 0) {
      const rel = Math.abs(wrapAngle(headingOf(w.x, w.z) - w.face));
      if (rel > 2.1) cap = this.vBack;
      else if (rel > 0.9) cap = this.vSide;
    }
    cap *= this.speedCap * (1 - (1 - this.stamina) * 0.06);
    let tvx = w.x * w.s * cap, tvz = w.z * w.s * cap;

    let ux, uz;
    if (sp > 0.25) { ux = this.vx / sp; uz = this.vz / sp; } else if (w.s > 0) { ux = w.x; uz = w.z; } else { ux = 0; uz = 1; }
    let dvx = tvx - this.vx, dvz = tvz - this.vz;
    let along = dvx * ux + dvz * uz;
    let px = dvx - along * ux, pz = dvz - along * uz;
    const vt = Math.max(1, this.vTop);
    const aFwd = this.a0 * Math.max(0.06, 1 - Math.pow(Math.min(1, sp / vt), 1.7));
    // a planted route break: more grip and harder braking for a moment
    const cut = this.cutBoost > 0;
    if (cut) this.cutBoost -= dt;
    along = clamp(along, -this.brake * (cut ? 1.6 : 1) * dt, aFwd * dt);
    let aLat = this.aLat * (1 + 0.85 * (1 - Math.min(1, sp / vt)));
    if (cut) aLat *= 1.5 + (this.r.rte ?? 60) / 99;
    const pl = Math.hypot(px, pz);
    if (pl > aLat * dt) { px *= aLat * dt / pl; pz *= aLat * dt / pl; }
    const prevV = sp;
    this.vx += along * ux + px;
    this.vz += along * uz + pz;
    if (this.boost) { this.vx += this.boost.vx * dt * 8; this.vz += this.boost.vz * dt * 8; }
    // never faster than his cap (plus a touch for a boost)
    const nsp = Math.hypot(this.vx, this.vz);
    const hardCap = cap * (this.boost ? 1.25 : 1.0) + 0.05;
    if (nsp > hardCap && nsp > 0) { this.vx *= hardCap / nsp; this.vz *= hardCap / nsp; }
    this.x += this.vx * dt;
    this.z += this.vz * dt;
    this.accel = (Math.hypot(this.vx, this.vz) - prevV) / dt;

    // facing: hold the requested facing, else face the way he runs
    let target = this.heading;
    if (w.face !== null) target = w.face;
    else if (Math.hypot(this.vx, this.vz) > 0.6) target = headingOf(this.vx, this.vz);
    const before = this.heading;
    this.heading = turnToward(this.heading, target, this.spin * dt);
    this.turnRate = wrapAngle(this.heading - before) / dt;
  }

  /** Keep ~0.6 s of position history (sampled every 0.05 s). */
  record(dt) {
    this.histT += dt;
    if (this.histT < 0.05) return;
    this.histT = 0;
    this.hist.push(this.x, this.z, this.vx, this.vz);
    if (this.hist.length > 48) this.hist.splice(0, 4);
  }

  /** Where he was `ago` seconds ago, extrapolated forward by `ago` with the velocity he had then. */
  delayed(ago, out) {
    const n = this.hist.length / 4;
    const k = Math.max(0, Math.min(n - 1, Math.round(n - 1 - ago / 0.05)));
    if (!n) { out.x = this.x; out.z = this.z; out.vx = this.vx; out.vz = this.vz; return out; }
    const i = k * 4;
    out.vx = this.hist[i + 2]; out.vz = this.hist[i + 3];
    out.x = this.hist[i] + out.vx * ago; out.z = this.hist[i + 1] + out.vz * ago;
    return out;
  }

  /** Stamina: sprinting drains, standing recovers. */
  tire(dt, fatigueOn) {
    if (!fatigueOn) { this.stamina = 1; return; }
    const sp = this.speed / Math.max(1, this.vTop);
    const drain = sp > 0.85 ? 0.012 : sp > 0.5 ? 0.004 : -0.01;
    const k = 1.25 - this.r.sta / 99 * 0.6;
    this.stamina = clamp(this.stamina - drain * dt * k, 0.55, 1);
  }

  /** Advance action timers. Returns the action that just finished, if any. */
  tickAction(dt) {
    if (this.recover > 0) this.recover -= dt;
    if (this.tackleCD > 0) this.tackleCD -= dt;
    if (this.catchCD > 0) this.catchCD -= dt;
    if (this.immune > 0) this.immune -= dt;
    if (this.moveCD > 0) this.moveCD -= dt;
    const a = this.action;
    if (!a) return null;
    a.prevT = a.t;
    a.t += dt;
    if (!a.held && a.t >= a.dur) {
      this.action = null;
      const end = ACTIONS[a.name]?.end;
      if (end) this.base = end;
      return a;
    }
    return null;
  }
}
