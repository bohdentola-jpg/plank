// The football. A real projectile in the air (gravity, a touch of drag), held
// in a carrier's arm otherwise, and a prolate spheroid on the ground: it skips
// and kicks off at odd angles and rolls end over end.
//
// state: 'dead'   placed at a spot (between plays)
//        'snap'   on the ground under the center's hand, waiting for the snap
//        'held'   in a player's arms (carrier)
//        'air'    in flight: pass / lateral / snap / kick / punt / fumble pop
//        'loose'  on the ground, live (fumble, muffed kick, a backward pass that fell)
import { GRAVITY } from './field.js';
import { clamp } from './math.js';

export class Ball {
  constructor() {
    this.x = 0; this.y = 0.15; this.z = 0;
    this.vx = 0; this.vy = 0; this.vz = 0;
    this.state = 'dead';
    this.carrier = null;
    this.kind = null;          // 'snap' | 'pass' | 'lateral' | 'handoff' | 'kick' | 'punt' | 'fumble' | 'tip'
    this.thrower = null;       // who let it go
    this.target = null;        // intended receiver (passes, laterals)
    this.targetPt = null;      // where the throw was aimed {x, y, z, t}
    this.t = 0;                // time in the air
    this.flightT = 0;          // planned flight time
    this.forward = false;      // a forward pass (vs backward pass / lateral)
    this.spin = 0;             // visual spin rate (rad/s) about the long axis
    this.tumble = 0;           // end-over-end rate (kicks, fumbles)
    this.rollT = 0;            // time loose on the ground
    this.bounces = 0;
    this.lastTeam = null;      // team that last had it (possession on recoveries)
    this.kicked = false;       // a kick that hasn't been touched yet
    this.touched = null;       // first receiving-team player to touch a kick
    this.history = [];         // ['handoff', 'lateral', …] this play
  }

  place(x, z, state = 'dead') {
    this.x = x; this.z = z; this.y = 0.15;
    this.vx = this.vy = this.vz = 0;
    this.state = state;
    this.carrier = null;
    this.kind = null;
    this.thrower = this.target = this.targetPt = null;
    this.t = 0; this.spin = 0; this.tumble = 0; this.rollT = 0; this.bounces = 0;
    this.forward = false;
    this.kicked = false;
    this.touched = null;
    this.isFg = false;
    this.fgChecked = false;
    this.tipped = false;
    this.knocked = false;
    this.history = [];
  }

  give(ent) {
    if (this.carrier && this.carrier !== ent) this.carrier.carry = null;
    this.state = 'held';
    this.carrier = ent;
    this.lastTeam = ent.side;
    this.kind = null;
    this.vx = this.vy = this.vz = 0;
    this.spin = this.tumble = 0;
    this.kicked = false;
    if (!ent.carry) ent.carry = ent.mem.carrySide || 'R';
  }

  /**
   * Launch from (x, y, z) to land at (tx, ty, tz) after flight time T.
   * kind: 'pass' | 'lateral' | 'snap' | 'kick' | 'punt'
   */
  launch(x, y, z, tx, ty, tz, T, kind, thrower = null) {
    if (this.carrier) this.carrier.carry = null;
    this.carrier = null;
    this.state = 'air';
    this.kind = kind;
    this.thrower = thrower;
    this.x = x; this.y = y; this.z = z;
    T = Math.max(0.08, T);
    this.vx = (tx - x) / T;
    this.vz = (tz - z) / T;
    this.vy = (ty - y) / T + 0.5 * GRAVITY * T;
    this.t = 0;
    this.knocked = false;
    this.flightT = T;
    this.targetPt = { x: tx, y: ty, z: tz, t: T };
    this.bounces = 0;
    this.spin = kind === 'pass' ? 70 : kind === 'punt' ? 45 : kind === 'lateral' ? 8 : 0;
    this.tumble = kind === 'kick' ? 9 : kind === 'lateral' ? 2 : 0;
    if (thrower) this.lastTeam = thrower.side;
    return this;
  }

  /** Predicted position after `t` more seconds of flight (no bounce). */
  predict(t, out = {}) {
    out.x = this.x + this.vx * t;
    out.z = this.z + this.vz * t;
    out.y = this.y + this.vy * t - 0.5 * GRAVITY * t * t;
    return out;
  }

  /** Seconds until the ball comes down to height h (or null). */
  timeToHeight(h) {
    const a = -0.5 * GRAVITY, b = this.vy, c = this.y - h;
    const disc = b * b - 4 * a * c;
    if (disc < 0) return null;
    const r = Math.sqrt(disc);
    const t1 = (-b - r) / (2 * a), t2 = (-b + r) / (2 * a);
    const t = Math.max(t1, t2);
    return t >= 0 ? t : null;
  }

  /**
   * Step the physics. Returns an event string when something happened:
   * 'ground' (first touch of the ground), 'bounce', 'rest', or null.
   */
  step(dt, rng) {
    if (this.state === 'held' && this.carrier) {
      // the match places a carried ball at the carrier's arm each tick
      return null;
    }
    if (this.state === 'air') {
      this.t += dt;
      // (no drag: throws and kicks are aimed with the same ballistic model everybody predicts with)
      this.vy -= GRAVITY * dt;
      this.x += this.vx * dt; this.y += this.vy * dt; this.z += this.vz * dt;
      if (this.y <= 0.12) {
        this.y = 0.12;
        this.state = 'loose';
        this.rollT = 0;
        this._bounce(rng, true);
        return 'ground';
      }
      return null;
    }
    if (this.state === 'loose') {
      this.rollT += dt;
      this.vy -= GRAVITY * dt;
      this.x += this.vx * dt; this.y += this.vy * dt; this.z += this.vz * dt;
      if (this.y <= 0.12) {
        this.y = 0.12;
        if (Math.abs(this.vy) > 1.2 || Math.hypot(this.vx, this.vz) > 3.5) {
          this._bounce(rng, false);
          return 'bounce';
        }
        this.vy = 0;
        // rolling: friction, the odd wobble sideways
        const f = Math.exp(-dt * 2.4);
        this.vx *= f; this.vz *= f;
        if (rng && rng() < dt * 2) {
          const s = Math.hypot(this.vx, this.vz);
          const a = (rng() - 0.5) * 0.9;
          const c = Math.cos(a), sn = Math.sin(a);
          const vx = this.vx * c - this.vz * sn, vz = this.vx * sn + this.vz * c;
          this.vx = vx; this.vz = vz;
          void s;
        }
        if (Math.hypot(this.vx, this.vz) < 0.15) { this.vx = this.vz = 0; return this.rollT > 0.2 ? 'rest' : null; }
      }
      this.tumble *= Math.exp(-dt * 1.5);
    }
    return null;
  }

  // The prolate bounce: the nose hits first, so the ball kicks off in a random
  // direction, sometimes high, sometimes skidding flat, sometimes straight back.
  _bounce(rng, first) {
    const r = rng || Math.random;
    this.bounces++;
    const sp = Math.hypot(this.vx, this.vz);
    const ang = (r() - 0.5) * (first ? 1.6 : 2.4) + (r() < 0.12 ? Math.PI : 0);
    const c = Math.cos(ang), s = Math.sin(ang);
    const keep = 0.35 + r() * 0.35;
    const vx = (this.vx * c - this.vz * s) * keep, vz = (this.vx * s + this.vz * c) * keep;
    this.vx = vx; this.vz = vz;
    this.vy = clamp(Math.abs(this.vy) * (0.25 + r() * 0.45) + (r() < 0.25 ? r() * 3 : 0), 0, 6.5);
    if (sp < 2) this.vy *= 0.5;
    this.tumble = 6 + r() * 12;
    this.spin = 0;
  }
}
