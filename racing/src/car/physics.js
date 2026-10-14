// Vehicle dynamics. An arcade-sim "bicycle" model run at a fixed 120 Hz:
//   • two axles with Pacejka-shaped slip-angle curves + load sensitivity
//   • longitudinal + aero load transfer, downforce
//   • friction circle per axle (power-on oversteer, trail-braking rotation)
//   • driven-wheel slip state → burnouts, wheelspin, revs flaring
//   • engine torque curve scaled to the car's horsepower, turbo lag,
//     rev limiter bounce, engine braking, clutch-slip launches
//   • auto/manual gearbox with shift time, reverse
//   • nitrous, drafting, surfaces, slopes, airborne flight + landings
//   • spring-damper body pitch/roll for the model
//
// Frame: world x/z ground plane, y up. heading θ: forward f = (sinθ, cosθ).
// The car's LEFT is l = (cosθ, −sinθ) (matches the model's +x = left).
// ω > 0 turns left. δ (front wheel angle) > 0 points the wheels left.
import { clamp, lerp } from '../core/util.js';

const G = 9.81;
const RHO = 1.225;
export const PHYS_DT = 1 / 120;

export const SURFACES = {
  road: { mu: 1.0, drag: 0, rumble: 0, dust: 0 },
  curb: { mu: 0.96, drag: 0.1, rumble: 0.7, dust: 0 },
  grass: { mu: 0.62, drag: 1.4, rumble: 0.35, dust: 0.4 },
  dirt: { mu: 0.68, drag: 1.0, rumble: 0.4, dust: 1 },
  sand: { mu: 0.52, drag: 2.4, rumble: 0.45, dust: 1 },
  gravel: { mu: 0.5, drag: 3.0, rumble: 0.8, dust: 1 },
  sidewalk: { mu: 0.9, drag: 0.3, rumble: 0.5, dust: 0 },
};

/** Pacejka-like lateral curve. x = slip angle (rad). Peak ≈ 1 near 7°. */
function tireCurve(alpha, B = 9.5, Cc = 1.45, E = -0.6) {
  const ba = B * alpha;
  return Math.sin(Cc * Math.atan(ba - E * (ba - Math.atan(ba))));
}

/** Build derived performance numbers from a car spec + upgrade multipliers. */
export function derivePerf(spec, up = {}) {
  const p = spec.perf;
  const b = spec.body;
  const m = {
    power: 1 + (up.power || 0),
    torqueLow: 1 + (up.torqueLow || 0),
    grip: 1 + (up.grip || 0),
    brake: 1 + (up.brake || 0),
    mass: 1 - (up.weight || 0),
    shift: 1 - (up.shift || 0),
    redline: up.redline || 0,
    nitro: up.nitro ?? 0.6,
    handling: up.handling || 0,
  };
  const redline = p.redline + m.redline;
  const idle = p.idle;
  const peak = p.rpmPeak;
  // torque shape (normalized); then scale so peak power == hp * power mult
  const shape = (r) => {
    if (r <= peak) {
      const t = clamp((r - idle) / Math.max(1, peak - idle), 0, 1);
      return 0.6 + 0.4 * Math.sin(t * Math.PI / 2);
    }
    const t = clamp((r - peak) / Math.max(1, redline - peak), 0, 1.2);
    return 1 - 0.36 * Math.pow(t, 1.7);
  };
  let pmax = 0;
  for (let r = idle; r <= redline; r += 50) pmax = Math.max(pmax, shape(r) * r);
  const targetW = p.hp * 745.7 * m.power;
  const tScale = targetW / (pmax * (2 * Math.PI / 60)); // Nm at shape==1
  const mass = p.mass * m.mass + 75; // + driver
  const wb = b.wb;
  // weight distribution: front-engined ~57/43, mid/rear engines rear-biased
  const frontBias = spec.perf.frontBias ?? (spec.id === 'stuttgard' ? 0.4 : spec.id === 'pipistrello' ? 0.42 : spec.perf.drive === 'FWD' ? 0.61 : 0.54);
  return {
    mass,
    inertia: mass * (b.L * b.L + b.W * b.W) / 12 * 0.95,
    a: wb * (1 - frontBias),  // CG → front axle
    b: wb * frontBias,        // CG → rear axle
    wb,
    cgH: 0.48 - (up.lower || 0) * 0.04,
    trackW: b.W - 0.25,
    wheelR: b.wheelR,
    idle, redline, peakRpm: peak,
    torque: (r) => shape(r) * tScale * (r < peak ? m.torqueLow : 1),
    tScale,
    gears: p.gears.slice(),
    final: p.final,
    drive: p.drive,
    split: p.drive === 'AWD' ? (p.split ?? 0.4) : p.drive === 'FWD' ? 1 : 0,
    cdA: p.cd * p.area * (1 - (up.aero || 0) * 0.08),
    clA: 0.12 + (up.aero || 0) * 0.35 + (b.wing && b.wing !== 'none' ? 0.08 : 0),
    mu: 1.18 * (p.grip || 1) * m.grip,
    brakeG: 1.25 * (p.brake || 1) * m.brake,
    steerLock: 0.56,
    shiftTime: 0.26 * m.shift,
    turbo: Math.max(spec.sound?.turbo || 0, up.turbo || 0),
    nitroPower: m.nitro,
    handling: m.handling,
    hp: p.hp * m.power,
  };
}

export class Vehicle {
  constructor(spec, upgrades = {}) {
    this.spec = spec;
    this.setUpgrades(upgrades);
    this.reset(0, 0, 0, 0);
  }

  setUpgrades(up) {
    this.up = up || {};
    this.P = derivePerf(this.spec, this.up);
  }

  reset(x, z, heading, y = 0) {
    this.x = x; this.z = z; this.y = y;
    this.vx = 0; this.vz = 0; this.vy = 0;
    this.heading = heading;
    this.yawRate = 0;
    this.rpm = this.P?.idle || 900;
    this.gear = 1;
    this.shiftT = 0;
    this.pendingGear = null;
    this.steer = 0;         // front wheel angle (rad, + left)
    this.wheelSpin = 0;     // excess driven-wheel surface speed (m/s)
    this.wheelAngVel = 0;   // for visuals (rad/s)
    this.boost = 0;
    this.nitro = 1;         // tank 0..1
    this.nitroOn = false;
    this.airborne = false;
    this.airTime = 0;
    this.landing = 0;       // impact strength this frame
    this.pitch = 0; this.pitchV = 0;
    this.roll = 0; this.rollV = 0;
    this.heave = 0; this.heaveV = 0;
    this.axF = 0; this.ayL = 0;  // filtered accelerations (local)
    this.slipF = 0; this.slipR = 0; // lateral slip measures for audio/fx
    this.limiter = false;
    this.limiterT = 0;
    this.reverseHold = 0;
    this.surface = 'road';
    this.draft = 0;
    this.brakeLight = 0;
    this.throttle = 0;
    this.prevGroundH = y;
    this.groundN = [0, 1, 0];
    this.driftAngle = 0;
    this.escCut = 0;      // stability-control power trim (0..1)
    this.lastFyF = 0; this.lastFyR = 0;
    this.speed = 0;
    this.vF = 0; this.vL = 0;
  }

  get fwd() { return [Math.sin(this.heading), Math.cos(this.heading)]; }
  get left() { return [Math.cos(this.heading), -Math.sin(this.heading)]; }

  wheelRpm(gear = this.gear, withSpin = true) {
    const P = this.P;
    const ratio = gear > 0 ? P.gears[gear - 1] : gear < 0 ? 3.4 : 0;
    const ws = Math.abs(this.vF) + (withSpin ? Math.max(0, this.wheelSpin) : 0);
    return ws / P.wheelR * ratio * P.final * 60 / (2 * Math.PI);
  }

  /**
   * One fixed step. ctl: { throttle, brake, steer (-1..1, + right), handbrake, nitro,
   *   shiftUp, shiftDown } (shift flags are one-shot edges).
   * env: { ground(x,z) → {h, n:[x,y,z], surface}, auto (bool), assists (0..1), draft (0..1) }
   */
  step(dt, ctl, env) {
    const P = this.P;
    const [fx, fz] = this.fwd;
    const [lx, lz] = this.left;
    let vF = this.vx * fx + this.vz * fz;
    let vL = this.vx * lx + this.vz * lz;
    const speed = Math.hypot(this.vx, this.vz);
    this.speed = speed;
    const assists = env.assists ?? 1;

    // -------------------------------------------------- ground + vertical
    const gq = env.ground(this.x, this.z);
    const surf = SURFACES[gq.surface] || SURFACES.road;
    this.surface = gq.surface;
    this.landing = 0;
    const groundVy = (gq.h - this.prevGroundH) / dt;
    this.prevGroundH = gq.h;
    if (this.airborne) {
      this.vy -= G * dt;
      this.y += this.vy * dt;
      this.airTime += dt;
      if (this.y <= gq.h) {
        const impact = Math.max(0, groundVy - this.vy);
        this.landing = clamp(impact / 9, 0, 1);
        this.heaveV -= impact * 0.35;
        this.y = gq.h;
        this.vy = groundVy;
        this.airborne = false;
        // hard landings scrub a little speed
        const scrub = 1 - clamp((impact - 4) * 0.012, 0, 0.12);
        this.vx *= scrub; this.vz *= scrub;
      }
    } else {
      // leave the ground when the surface drops away faster than gravity follows
      const predicted = this.y + this.vy * dt - 0.5 * G * dt * dt;
      if (gq.h < predicted - 0.02 && this.vy > groundVy + 1.2 && speed > 12) {
        this.airborne = true;
        this.airTime = 0;
        this.y = predicted;
        this.vy -= G * dt;
      } else {
        this.vy = groundVy;
        this.y = gq.h;
        this.airTime = 0;
      }
    }
    this.groundN = gq.n;

    // -------------------------------------------------- driver inputs
    let throttle = clamp(ctl.throttle || 0, 0, 1);
    let brake = clamp(ctl.brake || 0, 0, 1);
    const hand = !!ctl.handbrake;

    // reverse logic: hold brake at a stop → reverse; in reverse, pedals swap
    if (this.gear !== -1 && vF < 0.6 && brake > 0.5 && throttle < 0.1) {
      this.reverseHold += dt;
      if (this.reverseHold > 0.35 && Math.abs(vF) < 0.6) { this.gear = -1; this.reverseHold = 0; }
    } else if (this.gear === -1 && throttle > 0.3 && vF > -1.0) {
      this.gear = 1;
      this.reverseHold = 0;
    } else {
      this.reverseHold = 0;
    }
    let drivePedal = throttle, brakePedal = brake;
    if (this.gear === -1) { drivePedal = brake; brakePedal = throttle; }
    // stability control trims the power while the tail is coming round
    if (this.gear > 0 && this.escCut > 0) drivePedal *= 1 - this.escCut;
    this.throttle = drivePedal;

    // steering: speed-sensitive lock + rate limit + countersteer assist
    const lock = P.steerLock / (1 + Math.max(0, Math.abs(vF) - 6) / 24) * (1 + P.handling * 0.1);
    let target = -clamp(ctl.steer || 0, -1, 1) * lock;
    // countersteer help: steer into the slide when the tail steps out
    if (assists > 0 && vF > 6) {
      const beta = Math.atan2(vL, Math.abs(vF)); // body slip angle (+ = sliding left)
      target += clamp(beta * 0.55 * assists, -0.25, 0.25) * (1 - Math.min(1, Math.abs(ctl.steer || 0)) * 0.5);
    }
    const rate = 3.2 + (Math.abs(target) < Math.abs(this.steer) ? 2.5 : 0);
    this.steer += clamp(target - this.steer, -rate * dt, rate * dt);
    const delta = this.steer;

    // -------------------------------------------------- gearbox
    const nG = P.gears.length;
    if (this.shiftT > 0) {
      this.shiftT -= dt;
      if (this.shiftT <= 0 && this.pendingGear !== null) { this.gear = this.pendingGear; this.pendingGear = null; }
    }
    const wheelRpm = this.wheelRpm();
    const groundRpm = this.wheelRpm(this.gear, false);
    if (this.sinceShift !== undefined) this.sinceShift += dt;
    if (this.shiftT <= 0 && this.gear > 0) {
      if (env.auto) {
        const upAt = P.redline * 0.95;
        const onLimit = this.rpm > P.redline * 0.985 && groundRpm > P.redline * 0.82;
        if (this.gear < nG && (groundRpm > upAt || onLimit) && drivePedal > 0.2) this.shift(+1);
        else if (this.gear > 1 && (this.sinceShift ?? 9) > 1.1) {
          const lower = this.wheelRpm(this.gear - 1, false);
          const downAt = drivePedal > 0.6 ? P.redline * 0.58 : P.redline * 0.4;
          if (groundRpm < downAt && lower < P.redline * 0.86) this.shift(-1);
        }
      } else {
        if (ctl.shiftUp && this.gear < nG) this.shift(+1);
        if (ctl.shiftDown && this.gear > 1 && this.wheelRpm(this.gear - 1) < P.redline * 1.02) this.shift(-1);
      }
    }
    if (!env.auto && ctl.shiftDown && this.gear === 1 && Math.abs(vF) < 1.5) this.gear = -1;
    if (!env.auto && ctl.shiftUp && this.gear === -1) this.gear = 1;

    // -------------------------------------------------- engine
    const inGear = this.shiftT <= 0 && this.gear !== 0;
    const ratio = this.gear > 0 ? P.gears[this.gear - 1] : this.gear < 0 ? 3.4 : 0;
    // clutch slip at low speed: revs can rise above wheel speed
    const launchRpm = Math.min(P.redline * 0.72, P.peakRpm * 1.05 + 800);
    let engineRpm;
    if (!inGear && this.pendingGear) {
      // mid-shift: revs fall (or blip) toward the next gear's speed
      const tgt = Math.max(P.idle, this.wheelRpm(this.pendingGear));
      engineRpm = this.rpm + (tgt - this.rpm) * Math.min(1, dt * 14);
    } else if (this.airborne || !inGear) {
      const free = P.idle + (P.redline * 1.02 - P.idle) * drivePedal;
      engineRpm = this.rpm + (free - this.rpm) * Math.min(1, dt * (drivePedal > 0.1 ? 7 : 3));
    } else {
      const slipRpm = P.idle + (launchRpm - P.idle) * drivePedal;
      engineRpm = Math.max(wheelRpm, Math.min(slipRpm, wheelRpm < launchRpm ? slipRpm : 0), P.idle * 0.98);
    }
    // limiter
    this.limiter = false;
    if (this.limiterT > 0) this.limiterT -= dt;
    if (engineRpm >= P.redline) {
      engineRpm = P.redline;
      this.limiterT = 0.07;
    }
    const cut = this.limiterT > 0.035;
    if (this.limiterT > 0) this.limiter = true;
    this.rpm = this.rpm + (engineRpm - this.rpm) * Math.min(1, dt * 25);

    // turbo
    const boostTarget = P.turbo > 0 ? clamp((this.rpm - 2200) / 2200, 0, 1) * drivePedal : 0;
    this.boost += (boostTarget - this.boost) * Math.min(1, dt * (boostTarget > this.boost ? 1.6 : 6));
    const turboMul = P.turbo > 0 ? 0.78 + 0.22 * this.boost : 1;

    // nitrous
    this.nitroOn = !!ctl.nitro && this.nitro > 0.002 && drivePedal > 0.3 && this.gear > 0 && !this.airborne;
    let nitroMul = 1;
    if (this.nitroOn) {
      nitroMul = 1 + 0.35 + P.nitroPower * 0.3;
      this.nitro = Math.max(0, this.nitro - dt / (5.5 + P.nitroPower * 2));
    }

    let engineTorque = P.torque(this.rpm) * turboMul * nitroMul * drivePedal;
    if (cut) engineTorque = 0;
    if (drivePedal < 0.05 && inGear) engineTorque = -P.tScale * 0.11 * (this.rpm / P.redline);
    const driveForce = inGear ? engineTorque * ratio * P.final * 0.83 / P.wheelR * (this.gear < 0 ? -1 : 1) : 0;

    // -------------------------------------------------- loads
    const v2 = speed * speed;
    const down = 0.5 * RHO * P.clA * v2;
    const W = P.mass * G * (this.groundN[1] || 1);
    const wb = P.wb;
    const dW = P.mass * this.axF * P.cgH / wb;
    let Wf = W * P.b / wb - dW + down * 0.45;
    let Wr = W * P.a / wb + dW + down * 0.55;
    Wf = Math.max(W * 0.12, Wf);
    Wr = Math.max(W * 0.12, Wr);
    const muS = P.mu * surf.mu;
    const loadSens = (Wn, Ws) => muS * (1 - 0.08 * (Wn / Ws - 1));
    const muF = loadSens(Wf, W * P.b / wb);
    const muR = loadSens(Wr, W * P.a / wb);

    // -------------------------------------------------- tire forces
    let FxF = 0, FxR = 0, FyF = 0, FyR = 0;
    this.slipF = 0; this.slipR = 0;
    let spinning = false;
    if (!this.airborne) {
      const vAbs = Math.max(Math.abs(vF), 1.5);
      const vlF = vL + this.yawRate * P.a;
      const vlR = vL - this.yawRate * P.b;
      const dirS = vF >= 0 ? 1 : -1;
      const alphaF = Math.atan2(vlF, vAbs) - delta * dirS;
      const alphaR = Math.atan2(vlR, vAbs);
      // low-speed fade so the car can sit still without jitter
      const lowFade = clamp(speed / 2.5, 0, 1);

      // drive split
      const driveF = driveForce * P.split;
      const driveR = driveForce * (1 - P.split);
      // brakes (65/35), handbrake on the rear
      const brakeF = brakePedal * P.brakeG * P.mass * G * 0.65;
      const brakeR = brakePedal * P.brakeG * P.mass * G * 0.35;
      const sgn = Math.abs(vF) > 0.3 ? Math.sign(vF) : 0;
      let reqF = driveF - brakeF * sgn;
      let reqR = driveR - brakeR * sgn;
      if (hand) reqR = -sgn * muR * Wr * 0.75 + driveR * 0.15;

      const capF = muF * Wf, capR = muR * Wr * 1.06; // slight rear bias: stable at the limit
      // ABS + brake balance: brakes never use the whole friction circle,
      // so the car keeps steering (and the tail stays put) under hard braking
      if (!hand) {
        if (reqF < 0 && sgn > 0) reqF = Math.max(reqF, -capF * 0.9);
        if (reqR < 0 && sgn > 0) reqR = Math.max(reqR, -capR * 0.5);
      }
      // traction control (assist) trims wheelspin before it starts
      if (assists > 0 && this.gear > 0) {
        const tcl = 1.0 + (1 - assists) * 0.6;
        // keep what the tire is already using for cornering (last step's
        // side force) out of what the throttle may take
        const room = (fy, cap) => Math.sqrt(Math.max(0.1, 1 - Math.pow(Math.min(1, Math.abs(fy) / Math.max(1, cap)), 2) * assists));
        const tcF = capF * tcl * room(this.lastFyF || 0, capF), tcR = capR * tcl * room(this.lastFyR || 0, capR);
        if (reqF > tcF) reqF = tcF;
        if (reqR > tcR && !hand) reqR = tcR;
      }
      // driven-wheel spin state
      const drivenCap = (P.split > 0 ? capF * P.split : 0) + (P.split < 1 ? capR * (1 - P.split) : 0);
      // with traction control on, only what it lets through can spin the tires
      const tcCap = assists > 0 && this.gear > 0 ? drivenCap * (1.0 + (1 - assists) * 0.6) : Infinity;
      const excess = Math.min(Math.abs(driveForce), tcCap) - drivenCap * 1.02;
      if (excess > 0 && this.gear !== 0 && !hand && drivePedal > 0.2) {
        this.wheelSpin = Math.min(25, this.wheelSpin + excess / P.mass * dt * 6);
        spinning = true;
      } else {
        this.wheelSpin = Math.max(0, this.wheelSpin - dt * (8 + this.wheelSpin * 2));
      }
      if (this.wheelSpin > 0.5) spinning = true;

      const clampLong = (req, cap) => clamp(req, -cap, cap);
      FxF = clampLong(reqF, capF * (spinning && P.split > 0 ? 0.92 : 1));
      FxR = clampLong(reqR, capR * (spinning && P.split < 1 ? 0.9 : 1));

      // lateral, limited by what's left of the friction circle
      // cornering stiffness grows slower than load (a loaded tire needs more
      // slip to make its grip): without this a nose-heavy car under braking
      // has a front axle far stiffer than its rear and turns itself round
      const kF = Math.pow(Math.max(0.3, Wf / (W * P.b / wb)), -0.35);
      const kR = Math.pow(Math.max(0.3, Wr / (W * P.a / wb)), -0.35);
      const latF = -muF * Wf * tireCurve(alphaF * kF) * lowFade;
      let rearGrip = hand ? 0.42 : 1;
      if (spinning && P.split < 1) rearGrip *= clamp(1 - this.wheelSpin * 0.045, 0.55, 1);
      const latR = -muR * Wr * tireCurve(alphaR * kR, 9.0, 1.4, -0.4) * lowFade * rearGrip;
      // combined slip: a tire that is braking or driving hard has less left
      // for cornering — across its whole curve, not just at the peak (only
      // capping the peak leaves a hard-braking front axle stiff enough to
      // swap the car's ends from the smallest twitch)
      const share = (fxv, cap) => Math.sqrt(Math.max(0.12, 1 - Math.pow(fxv / Math.max(1, cap), 2) * 0.95));
      const sF = share(FxF, capF), sR = share(FxR, capR);
      FyF = clamp(latF * sF, -capF * sF, capF * sF);
      FyR = clamp(latR * sR, -capR * sR, capR * sR);
      this.lastFyF = FyF; this.lastFyR = FyR;

      this.slipF = Math.abs(alphaF) * lowFade;
      this.slipR = Math.abs(alphaR) * lowFade;
    } else {
      this.wheelSpin = Math.max(0, this.wheelSpin - dt * 4);
    }

    // -------------------------------------------------- resistances
    const dragK = 0.5 * RHO * P.cdA * (1 - 0.4 * clamp(env.draft || 0, 0, 1));
    this.draft = env.draft || 0;
    const rr = (0.013 * W + surf.drag * P.mass * 0.25) ;
    const rrF = Math.abs(vF) > 0.05 ? -Math.sign(vF) * Math.min(rr, Math.abs(vF) * P.mass / dt * 0.5) : 0;

    // -------------------------------------------------- sum forces (local)
    const cosD = Math.cos(delta), sinD = Math.sin(delta);
    let Fwd = FxF * cosD - FyF * sinD + FxR + rrF;
    let Lat = FxF * sinD + FyF * cosD + FyR;
    let torque = P.a * (FxF * sinD + FyF * cosD) - P.b * FyR;

    // slope: gravity along the surface
    const n = this.groundN;
    if (!this.airborne) {
      const gF = -(n[0] * fx + n[2] * fz) * -1; // n·f gives the downhill component
      Fwd += -P.mass * G * gF * 0;
      const gx = n[0] * G, gz = n[2] * G; // tangential gravity ≈ g * horizontal normal
      Fwd += P.mass * (gx * fx + gz * fz);
      Lat += P.mass * (gx * lx + gz * lz) * 0.5;
    }

    // stability assist: yaw damping (stronger with assists, gentler drifting)
    if (!this.airborne) {
      const yawDamp = (0.18 + 0.5 * assists) * P.mass * Math.min(1, speed / 20);
      torque -= this.yawRate * yawDamp * (hand ? 0.15 : 1);
      // stability control (assists): rein the yaw rate back toward what the
      // driver's steering asks for when the car rotates past it — hardest on
      // the brakes and on the power, never adding rotation (it can't make
      // grip), and off while the handbrake is up so drifts still start
      if (assists > 0 && speed > 8 && !hand) {
        const vAbs = Math.abs(vF);
        const cmd = -clamp(ctl.steer || 0, -1, 1) * lock;
        // the most the car can turn: the grip left over after braking/driving
        const gLat = Math.sqrt(Math.max(4, Math.pow(muS * G * 1.05, 2) - this.axF * this.axF));
        const rMax = gLat / Math.max(5, vAbs);
        const rDes = clamp(vF * cmd / (wb + 0.0022 * vAbs * vAbs), -rMax, rMax);
        const err = this.yawRate - rDes;
        let corr = 0, cut = 0;
        if (Math.sign(err) === Math.sign(this.yawRate)) corr += err;
        // body slip past ~7° with the tail swinging out: sliding, not turning
        const beta = Math.atan2(vL, Math.max(1, vAbs));
        const over = Math.abs(beta) - 0.12;
        if (over > 0 && Math.sign(beta) === -Math.sign(this.yawRate)) corr += Math.sign(this.yawRate) * over * 1.5;
        if (corr) {
          const gain = assists * (0.6 + 4 * brakePedal + (P.split < 1 ? 1.5 : 0.4) * drivePedal) * P.inertia;
          torque -= corr * gain * Math.min(1, (speed - 8) / 10);
          cut = clamp((Math.abs(corr) - 0.05) * 2.5 * assists, 0, 0.85);
        }
        this.escCut += (cut - this.escCut) * Math.min(1, dt * (cut > this.escCut ? 20 : 4));
      } else {
        this.escCut = 0;
      }
      // drift sustain: holding throttle in a slide keeps the angle
      if (Math.abs(this.slipR) > 0.12 && drivePedal > 0.5 && P.split < 0.7 && !hand) {
        torque += Math.sign(vL) * -0.0 * P.mass;
      }
    } else {
      torque = -this.yawRate * P.inertia * 1.5;
    }

    // to world
    let Fx = Fwd * fx + Lat * lx;
    let Fz = Fwd * fz + Lat * lz;
    Fx -= dragK * speed * this.vx;
    Fz -= dragK * speed * this.vz;
    if (this.airborne) { Fx *= 1; Fz *= 1; }

    this.vx += Fx / P.mass * dt;
    this.vz += Fz / P.mass * dt;
    this.yawRate += torque / P.inertia * dt;
    // low speed: kill residual creep / spin when nearly stopped with no input
    if (speed < 0.4 && drivePedal < 0.05 && !this.airborne) {
      this.vx *= 0.9; this.vz *= 0.9; this.yawRate *= 0.85;
    }
    this.heading += this.yawRate * dt;
    this.x += this.vx * dt;
    this.z += this.vz * dt;

    // recompute local velocity for outputs + filtered accels
    const [fx2, fz2] = this.fwd;
    const [lx2, lz2] = this.left;
    const nvF = this.vx * fx2 + this.vz * fz2;
    const nvL = this.vx * lx2 + this.vz * lz2;
    // body-frame accelerations: remove the frame's own rotation (u' = ax + r·v,
    // v' = ay − r·u). Without the r·v term a slide reads as hard braking, the
    // load transfer then empties the rear axle and every slide becomes a spin.
    const aF = (nvF - vF) / dt - this.yawRate * nvL;
    const aL = (nvL - vL) / dt + this.yawRate * nvF;
    this.axF += (clamp(aF, -15, 15) - this.axF) * Math.min(1, dt * 8);
    this.ayL += (clamp(aL, -15, 15) - this.ayL) * Math.min(1, dt * 8);
    vF = nvF; vL = nvL;
    this.vF = vF;
    this.vL = vL;
    this.driftAngle = Math.abs(vF) > 3 ? Math.atan2(vL, Math.abs(vF)) : 0;

    // wheel visual spin
    this.wheelAngVel = (vF + (this.gear < 0 ? -this.wheelSpin : this.wheelSpin)) / P.wheelR;
    if (hand && !this.airborne) this.wheelAngVel = 0;

    // body motion (spring-dampers)
    const kP = 90, cP = 11;
    const pitchT = clamp(-this.axF * 0.0085, -0.07, 0.07);
    this.pitchV += ((pitchT - this.pitch) * kP - this.pitchV * cP) * dt;
    this.pitch += this.pitchV * dt;
    const rollT = clamp(this.ayL * 0.0075, -0.07, 0.07);
    this.rollV += ((rollT - this.roll) * 70 - this.rollV * 9) * dt;
    this.roll += this.rollV * dt;
    this.heaveV += ((0 - this.heave) * 160 - this.heaveV * 13) * dt;
    this.heave += this.heaveV * dt;
    if (surf.rumble > 0 && speed > 3 && !this.airborne) {
      this.heaveV += (Math.random() - 0.5) * surf.rumble * Math.min(1, speed / 25) * 0.9;
    }

    this.brakeLight = this.gear === -1 ? (throttle > 0.1 ? 1 : 0) : (brake > 0.05 ? 1 : 0);
  }

  shift(dir) {
    const ng = this.gear + dir;
    if (ng < 1 || ng > this.P.gears.length) return false;
    this.pendingGear = ng;
    this.shiftRpm = this.rpm;
    this.shiftT = this.P.shiftTime;
    this.sinceShift = 0;
    this.shiftedAt = performance.now?.() || 0;
    this.lastShift = dir;
    return true;
  }

  /** Push the car out of a wall: normal (nx,nz) points away from the wall. */
  hitWall(nx, nz, pen, contactLocal = null) {
    this.x += nx * pen;
    this.z += nz * pen;
    const vn = this.vx * nx + this.vz * nz;
    let impact = 0;
    if (vn < 0) {
      impact = -vn;
      const e = 0.18;
      this.vx -= (1 + e) * vn * nx;
      this.vz -= (1 + e) * vn * nz;
      // scrape friction along the wall
      const tx = -nz, tz = nx;
      const vt = this.vx * tx + this.vz * tz;
      const fr = Math.min(Math.abs(vt), impact * 0.35 + 0.15);
      this.vx -= Math.sign(vt) * fr * tx;
      this.vz -= Math.sign(vt) * fr * tz;
      // turn the car toward parallel (glancing blows rotate it)
      if (contactLocal) {
        const [fx, fz] = this.fwd;
        const along = fx * tx + fz * tz;
        const into = fx * nx + fz * nz;
        this.yawRate += clamp(-into * Math.sign(along) * impact * 0.08, -1.5, 1.5);
      }
      this.yawRate *= 0.85;
    }
    return impact;
  }

  /** Visual state for the model. */
  visual() {
    return {
      speed: this.vF,
      steer: this.steer,
      pitch: this.pitch,
      roll: this.roll,
      heave: this.heave,
      wheel: this.wheelAngVel,
    };
  }
}

/** Oriented-box car-vs-car collision (2D SAT) with impulse response. */
export function collideCars(A, B, dimA, dimB) {
  const axes = [];
  const corners = (c, d) => {
    const [fx, fz] = c.fwd;
    const [lx, lz] = c.left;
    const hl = d.L / 2, hw = d.W / 2;
    return [
      [c.x + fx * hl + lx * hw, c.z + fz * hl + lz * hw],
      [c.x + fx * hl - lx * hw, c.z + fz * hl - lz * hw],
      [c.x - fx * hl - lx * hw, c.z - fz * hl - lz * hw],
      [c.x - fx * hl + lx * hw, c.z - fz * hl + lz * hw],
    ];
  };
  const dx = B.x - A.x, dz = B.z - A.z;
  const maxR = (Math.hypot(dimA.L, dimA.W) + Math.hypot(dimB.L, dimB.W)) / 2;
  if (dx * dx + dz * dz > maxR * maxR) return null;
  if (Math.abs((A.y || 0) - (B.y || 0)) > 1.2) return null;
  const ca = corners(A, dimA), cb = corners(B, dimB);
  axes.push(A.fwd, A.left, B.fwd, B.left);
  let minPen = Infinity, nBest = null;
  for (const [ax, az] of axes) {
    let a0 = Infinity, a1 = -Infinity, b0 = Infinity, b1 = -Infinity;
    for (const [x, z] of ca) { const p = x * ax + z * az; a0 = Math.min(a0, p); a1 = Math.max(a1, p); }
    for (const [x, z] of cb) { const p = x * ax + z * az; b0 = Math.min(b0, p); b1 = Math.max(b1, p); }
    const pen = Math.min(a1, b1) - Math.max(a0, b0);
    if (pen <= 0) return null;
    if (pen < minPen) {
      minPen = pen;
      const s = (dx * ax + dz * az) >= 0 ? 1 : -1;
      nBest = [ax * s, az * s]; // from A toward B
    }
  }
  const [nx, nz] = nBest;
  const mA = A.P.mass, mB = B.P.mass;
  const tot = mA + mB;
  A.x -= nx * minPen * (mB / tot); A.z -= nz * minPen * (mB / tot);
  B.x += nx * minPen * (mA / tot); B.z += nz * minPen * (mA / tot);
  const rv = (B.vx - A.vx) * nx + (B.vz - A.vz) * nz;
  let impact = 0;
  if (rv < 0) {
    const e = 0.25;
    const j = -(1 + e) * rv / (1 / mA + 1 / mB);
    A.vx -= j * nx / mA; A.vz -= j * nz / mA;
    B.vx += j * nx / mB; B.vz += j * nz / mB;
    impact = -rv;
    // a little spin from off-center hits
    const cross = (dx * nz - dz * nx);
    A.yawRate += clamp(cross * impact * 0.02, -0.6, 0.6) * (mB / tot);
    B.yawRate -= clamp(cross * impact * 0.02, -0.6, 0.6) * (mA / tot);
  }
  return { impact, nx, nz };
}
