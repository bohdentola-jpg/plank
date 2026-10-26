// Procedural locomotion. Inputs come straight from the anim state A (speed,
// moveAngle, accel, turnRate, effort, carry); output is a pose (pose.js
// channels) with the feet on IK.
//
// - The stride phase advances with distance travelled (cadence × dt, stride =
//   speed / cadence), so every gait from a walk to a sprint keeps its feet.
// - A foot in stance is planted in the WORLD: each frame it slides back by the
//   body's velocity and turns against the body's yaw, so feet never skate
//   while turning or accelerating. The swing foot flies a curve from where it
//   lifted to where it will land (ahead of the hip along the travel direction).
// - Gait style follows the travel direction in the hips' frame: run / walk
//   forward, lateral shuffle (feet never cross), backpedal; running sideways
//   fast opens the hips into a crossover run while the chest keeps facing.
// - Springs give the upper body weight: lean into acceleration, rock back on
//   braking, bank into turns, head stabilised against the bob.
import { C, NCH, neutral } from './pose.js';

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const sstep = (a, b, v) => { const t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const lerp = (a, b, t) => a + (b - a) * t;
const damp = (cur, target, rate, dt) => target + (cur - target) * Math.exp(-rate * dt);
const R2D = 180 / Math.PI, D2R = Math.PI / 180;
const TAU = Math.PI * 2;
const wrap = (a) => { a = (a + Math.PI) % TAU; if (a < 0) a += TAU; return a - Math.PI; };

/** Critically-damped spring for secondary motion. */
class Spring {
  constructor(freq = 6, zeta = 0.8) { this.x = 0; this.v = 0; this.k = (TAU * freq) ** 2; this.c = 2 * zeta * TAU * freq; }
  step(target, dt) {
    const n = Math.max(1, Math.ceil(dt / 0.008));
    const h = dt / n;
    for (let i = 0; i < n; i++) {
      const a = this.k * (target - this.x) - this.c * this.v;
      this.v += a * h;
      this.x += this.v * h;
    }
    return this.x;
  }
}

/** Upper-arm direction from a sagittal swing angle and an abduction (degrees) → [elev, plane]. */
function armSwing(out, swing, abd, inward = 0) {
  const s = swing * D2R, a = abd * D2R;
  // direction: down rotated forward by swing and outward by abd
  const fx = Math.sin(a) * Math.cos(s) - Math.sin(inward * D2R) * Math.max(0, Math.sin(s));
  const fz = Math.sin(s);
  const fy = -Math.cos(a) * Math.cos(s);
  const elev = Math.acos(clamp(-fy / Math.hypot(fx, fy, fz), -1, 1)) * R2D;
  const plane = Math.atan2(fz, fx) * R2D;
  out[0] = elev; out[1] = plane;
  return out;
}

const _as = [0, 0];

export class Locomotion {
  constructor(dims, seed = 0) {
    this.dims = dims;
    this.phase = seed % 1;
    this.v = 0;
    this.ma = 0;
    this.hipYaw = 0;
    this.w = 0;
    this.lean = new Spring(3.2, 0.75);
    this.bank = new Spring(2.6, 0.85);
    this.bob = new Spring(7, 0.9);
    this.out = neutral(new Float32Array(NCH));
    // feet: model-space ball-of-foot positions (x, z), stance flags, lift positions
    this.feet = [
      { x: 0.12, z: 0, lx: 0.12, lz: 0, stance: true, prevPh: 0 },
      { x: -0.12, z: 0, lx: -0.12, lz: 0, stance: true, prevPh: 0.5 },
    ];
    this.styleW = { fwd: 1, side: 0, back: 0 };
    this.dist = 0;
  }

  setDims(d) { this.dims = d; }

  /** Snap the planted feet to a stance (when locomotion is idle). */
  resetFeet(base) {
    const s = this.dims.s;
    this.feet[0].x = base[C.IKF_L + 1] * s; this.feet[0].z = base[C.IKF_L + 3] * s;
    this.feet[1].x = -base[C.IKF_R + 1] * s; this.feet[1].z = base[C.IKF_R + 3] * s;
    for (const f of this.feet) { f.lx = f.x; f.lz = f.z; }
  }

  /**
   * A: anim state. opts: { churn (0..1 legs driving in place), highstep, carry, engage, posture ('run'|'block'|'ref') }
   * Returns the pose; this.w is the locomotion weight vs the standing base.
   */
  update(dt, A, opts = {}) {
    const d = this.dims, s = d.s;
    const out = this.out;
    neutral(out);
    const speed = Math.max(0, (A.speed || 0) * 0.9144);           // m/s
    const turn = A.turnRate || 0;
    const churn = opts.churn || 0;
    const vEff = Math.max(speed, Math.min(1.2, Math.abs(turn) * 0.32), churn * 0.9);
    this.v = damp(this.v, vEff, 9, dt);
    const v = this.v;
    // travel direction (relative to heading), smoothed through the wrap
    if (speed > 0.15) this.ma = wrap(this.ma + wrap((A.moveAngle || 0) - this.ma) * (1 - Math.exp(-10 * dt)));
    const ma = this.ma;
    const absMa = Math.abs(ma);
    const effort = clamp(A.effort ?? sstep(5.5, 9, v), 0, 1);
    const posture = opts.posture || 'run';

    // ---- hips orientation: run toward the travel direction when moving fast forward/sideways
    const kRun = sstep(2.2, 5.2, v) * (posture === 'block' ? 0.15 : 0.92) * (1 - churn);
    let hipT = absMa <= 1.75 ? ma * kRun : 0;
    hipT = clamp(hipT, -1.45, 1.45);
    this.hipYaw = damp(this.hipYaw, hipT, 8, dt);
    const hipYaw = this.hipYaw;
    const gma = wrap(ma - hipYaw);                                   // travel dir in the hips frame
    const ag = Math.abs(gma);
    const wBack = sstep(1.95, 2.45, ag);
    const wSide = sstep(0.75, 1.25, ag) * (1 - wBack);
    const wFwd = 1 - wSide - wBack;
    this.styleW.fwd = wFwd; this.styleW.side = wSide; this.styleW.back = wBack;

    // ---- cadence & stride
    // stride frequency (cycles/s): a little busier than real life, the way games run
    let cad = v < 1.6 ? lerp(0.62, 0.98, v / 1.6)
      : v < 3.2 ? lerp(0.98, 1.42, (v - 1.6) / 1.6)
        : v < 5.5 ? lerp(1.42, 1.62, (v - 3.2) / 2.3)
          : lerp(1.62, 2.2, clamp((v - 5.5) / 4.2, 0, 1));
    cad = lerp(cad, Math.max(cad, 1.55 + v * 0.12), wBack);          // backpedal: short quick steps
    cad = lerp(cad, Math.max(cad, 1.75 + v * 0.2), wSide);           // shuffle: quick, short steps
    cad = Math.max(cad, churn * 2.1);
    cad /= Math.sqrt(s);
    const stride = Math.max(0.02, Math.min(4.8 * s, v / cad));       // metres per cycle (two steps)
    this.phase = (this.phase + cad * dt) % 1;
    const run = sstep(1.9, 3.1, v);                                  // walk → run
    const sprint = sstep(6.0, 9.2, v);
    // duty factor (share of the cycle a foot is down): walk 0.62 → jog 0.36 → run 0.28 → sprint 0.21
    let beta = lerp(0.62, 0.36, run);
    beta = lerp(beta, 0.28, sstep(3.2, 5.5, v));
    beta = lerp(beta, 0.21, sstep(5.5, 9.2, v));
    // a shuffle keeps each foot down only briefly so the feet never cross
    beta = lerp(beta, 0.3, wSide);
    beta = lerp(beta, 0.42, churn);

    // ---- feet
    const dirX = Math.sin(ma), dirZ = Math.cos(ma);
    const velX = speed * dirX, velZ = speed * dirZ;
    const width = lerp(lerp(0.1, 0.07, sprint), 0.31, wSide) * s + wBack * 0.035 * s + (posture === 'block' ? 0.06 * s : 0);
    const landAhead = lerp(0.42, 0.36, run) * beta * stride;
    const swingHBack = lerp(lerp(0.09, 0.32, run), 0.5, sprint) * s * (1 - 0.6 * wBack) * (1 - 0.65 * wSide) * (opts.highstep ? 0.6 : 1);
    const swingHFront = (lerp(lerp(0.05, 0.14, run), 0.3, sprint) + effort * 0.05) * s * (1 - 0.65 * wBack) * (1 - 0.6 * wSide) + (opts.highstep ? 0.42 * s : 0) + churn * 0.08 * s;
    const cy = Math.cos(hipYaw), sy = Math.sin(hipYaw);
    const dTurn = -turn * dt;
    const cT = Math.cos(dTurn), sT = Math.sin(dTurn);
    let comp = 0, stanceL = 0, stanceR = 0, flightLift = 1;
    for (let i = 0; i < 2; i++) {
      const f = this.feet[i];
      const side = i === 0 ? 1 : -1;
      const ph = (this.phase + (i === 0 ? 0 : 0.5)) % 1;
      const inStance = ph < beta;
      // home position (hips frame → model frame)
      const hx = side * width, hz = 0.0;
      const homeX = hx * cy + hz * sy, homeZ = -hx * sy + hz * cy;
      if (inStance) {
        if (!f.stance) { f.stance = true; }
        // planted: slide back with the ground, counter-rotate with the body's turn
        f.x -= velX * dt; f.z -= velZ * dt;
        const nx = f.x * cT + f.z * sT, nz = -f.x * sT + f.z * cT;
        f.x = nx; f.z = nz;
        // keep within reach (teleports, collisions)
        const ox = f.x - homeX, oz = f.z - homeZ;
        const r = Math.hypot(ox, oz), rmax = 0.9 * s;
        if (r > rmax) { f.x = homeX + (ox / r) * rmax; f.z = homeZ + (oz / r) * rmax; }
        const k = ph / beta;
        comp = Math.max(comp, Math.sin(Math.PI * k));
        if (i === 0) stanceL = 1; else stanceR = 1;
        flightLift = 0;
        f.lx = f.x; f.lz = f.z;
        f.y = 0;
        // heel peel → toe-off
        const p0 = lerp(lerp(-10, 4, run), 10, sprint) * (1 - wSide) + wBack * 14;
        const p1 = lerp(lerp(28, 46, run), 58, sprint) * (1 - 0.4 * wSide) * (1 - 0.3 * wBack);
        f.pitch = lerp(p0, p1, sstep(0.42, 1.0, k));
        f.sw = 0;
      } else {
        if (f.stance) { f.stance = false; f.lx = f.x; f.lz = f.z; }
        const k = (ph - beta) / (1 - beta);                       // swing progress
        const landX = homeX + dirX * landAhead + (velX * (1 - k) * (1 - beta) / cad) * 0.0;
        const landZ = homeZ + dirZ * landAhead;
        // horizontal: ease that hurries through mid-swing
        const e = k * k * (3 - 2 * k);
        let hx2 = lerp(f.lx, landX, e), hz2 = lerp(f.lz, landZ, e);
        // the heel kicks back behind first, then reaches forward
        const back = Math.sin(Math.PI * Math.min(1, k * 1.6)) * (1 - k) * 0.12 * stride * run;
        hx2 -= dirX * back; hz2 -= dirZ * back;
        f.x = hx2; f.z = hz2;
        // height: bezier-ish with a high back (heel recovery) and a lower front (knee drive)
        const hb = swingHBack * Math.sin(Math.PI * Math.min(1, k * 1.45)) * (1 - sstep(0.55, 1, k));
        const hf = swingHFront * Math.sin(Math.PI * sstep(0.2, 1.0, k));
        f.y = Math.max(hb, hf) + 0.012 * s * Math.sin(Math.PI * k);
        // pitch: toe-off → toes up mid-swing → landing attitude
        const pOff = lerp(lerp(28, 46, run), 58, sprint);
        const pLand = lerp(lerp(-10, 4, run), 10, sprint) + wBack * 14;
        f.pitch = k < 0.5 ? lerp(pOff, -12, sstep(0, 0.5, k)) : lerp(-12, pLand, sstep(0.5, 1, k));
        f.sw = Math.sin(Math.PI * k);
      }
      // foot yaw: along travel when running forward, along heading when shuffling / backpedalling
      const travelYaw = hipYaw + gma * wFwd * 0.85;
      f.yaw = travelYaw * (1 - wSide - wBack * 0.7) + side * 6 * D2R;
    }

    // ---- write feet
    for (let i = 0; i < 2; i++) {
      const f = this.feet[i];
      const side = i === 0 ? 1 : -1;
      const ch = i === 0 ? C.IKF_L : C.IKF_R;
      out[ch] = 1;
      out[ch + 1] = (side * f.x) / s;
      out[ch + 2] = f.y / s;
      out[ch + 3] = f.z / s;
      out[ch + 4] = f.pitch;
      out[ch + 5] = side * f.yaw * R2D;
      const kn = i === 0 ? C.KNEE_L : C.KNEE_R;
      out[kn] = 0.1 + 0.15 * wSide; out[kn + 1] = 0; out[kn + 2] = 1;
    }

    // ---- pelvis
    const crouch = lerp(lerp(0.02, 0.045, run), 0.07, sprint) + wSide * 0.13 + wBack * 0.08 + churn * 0.12 + (posture === 'block' ? 0.1 : 0);
    const bobAmp = lerp(0.022, 0.05, run) * (1 - 0.6 * wSide) * (1 - 0.4 * wBack) * (opts.highstep ? 1.4 : 1);
    const walkBob = (1 - run) * (comp - 0.55) * 0.04;
    const runBob = run * (flightLift * 0.35 - comp) * bobAmp;
    const bobT = walkBob + runBob;
    const bob = this.bob.step(bobT, dt);
    // longitudinal lean: speed posture + acceleration spring + effort
    const accel = clamp(A.accel || 0, -12, 12);
    const leanT = clamp(accel * 1.6, -12, 16) * (1 - wBack) - clamp(accel, -10, 10) * wBack * 0.8;
    const lean = this.lean.step(leanT, dt);
    const basePitch = lerp(lerp(3, 9, run), 15, sprint) + effort * 5 * run * wFwd + wSide * 10 + wBack * 12 + churn * 18 + (posture === 'block' ? 10 : 0) - (opts.highstep ? 16 : 0);
    // banking into turns: lean toward the turn centre
    const bankT = clamp(Math.atan2(speed * turn, 9.81) * R2D, -26, 26) * (1 - wBack * 0.5);
    const bank = this.bank.step(bankT, dt);
    // pelvis twist follows the legs (forward leg's hip leads)
    const fl = this.feet[0], fr = this.feet[1];
    const gzL = fl.x * Math.sin(hipYaw + 0) * 0 + (fl.x * sy + fl.z * cy), gzR = fr.x * sy + fr.z * cy;
    const pelvYaw = clamp(Math.atan2((gzR - gzL) * 0.5, 0.42 * s) * R2D * lerp(0.6, 0.85, run) * wFwd, -14, 14);
    const pelvRoll = (stanceR - stanceL) * 3 * (1 - run) * wFwd + (stanceR - stanceL) * 1.2 * run;
    const sway = (stanceL - stanceR) * 0.012 * (1 - run) * wFwd;
    const hipsH = d.hipsY;
    out[C.ROOT] = (sway + Math.sin(bank * D2R) * hipsH * 0.9 * Math.cos(hipYaw)) / s;
    out[C.ROOT + 1] = (-crouch + bob) / 1 - (1 - Math.cos(bank * D2R)) * 0.5;
    out[C.ROOT + 2] = (-Math.sin(bank * D2R) * hipsH * 0.9 * Math.sin(hipYaw)) / s * 0 - lean * 0.002;
    out[C.ROOT + 3] = basePitch * 0.55 + lean * 0.5;
    out[C.ROOT + 4] = hipYaw * R2D + pelvYaw;
    out[C.ROOT + 5] = bank + pelvRoll;

    // ---- trunk: counter-rotate the shoulders, keep the chest facing the heading when the hips open
    const openTwist = -hipYaw * R2D;                                 // un-twist so the chest faces the heading
    const chestFace = clamp(openTwist, -75, 75);
    out[C.SPINE] = basePitch * 0.3 + lean * 0.35;
    out[C.SPINE + 1] = chestFace * 0.4 - pelvYaw * 0.6;
    out[C.SPINE + 2] = -bank * 0.15;
    out[C.CHEST] = basePitch * 0.15 + lean * 0.15 + (opts.highstep ? -6 : 0);
    out[C.CHEST + 1] = chestFace * 0.45 - pelvYaw * 0.9;
    out[C.CHEST + 2] = -bank * 0.1;
    // head stabilised: cancel the trunk's pitch, twist and bank
    const trunkPitch = out[C.ROOT + 3] + out[C.SPINE] + out[C.CHEST];
    const trunkTwist = out[C.ROOT + 4] + out[C.SPINE + 1] + out[C.CHEST + 1];
    out[C.NECK] = -trunkPitch * 0.5 + 4;
    out[C.NECK + 1] = -trunkTwist * 0.45;
    out[C.NECK + 2] = -bank * 0.35;
    out[C.HEAD] = -trunkPitch * 0.4 - 2;
    out[C.HEAD + 1] = -trunkTwist * 0.45;
    out[C.HEAD + 2] = -bank * 0.3;

    // ---- arms: swing opposite the legs; bent and pumping when running
    const armAmp = lerp(lerp(20, 40, run), 56, sprint) * (1 + effort * 0.2) * wFwd + wBack * 28 + wSide * 6;
    const elbowBase = lerp(lerp(22, 88, run), 92, sprint) * (1 - wSide) + wSide * 85;
    // the arm swing runs off the stride phase: +1 when the left leg reaches forward
    const legL = Math.cos(Math.PI * 2 * (this.phase + 0.04));
    for (let i = 0; i < 2; i++) {
      const side = i === 0 ? 1 : -1;
      const ch = i === 0 ? C.ARM_L : C.ARM_R;
      const swing = -side * legL * armAmp * (1 - 0.7 * wSide);  // left arm forward when the right leg is forward
      const abd = 14 + wSide * 14 + (posture === 'block' ? 10 : 0);
      armSwing(_as, swing + lerp(4, 10, run), abd, 18 * run);
      out[ch] = _as[0];
      out[ch + 1] = _as[1];
      out[ch + 2] = 8 + 10 * run;
      out[ch + 3] = elbowBase + (swing > 0 ? swing * 0.35 : swing * 0.15) * run;
      out[ch + 4] = 5;
      out[ch + 7] = lerp(0.3, 0.75, run);
      const cl = i === 0 ? C.CLAV_L : C.CLAV_R;
      out[cl] = 2 + run * 2;
      out[cl + 1] = swing * 0.08;
    }
    // shuffle: arms up and in front (ready hands)
    if (wSide > 0.01 || wBack > 0.01) {
      const k = Math.max(wSide, wBack * 0.5);
      for (const ch of [C.ARM_L, C.ARM_R]) {
        out[ch] = lerp(out[ch], 42, k);
        out[ch + 1] = lerp(out[ch + 1], 48, k);
        out[ch + 2] = lerp(out[ch + 2], 12, k);
        out[ch + 3] = lerp(out[ch + 3], 96, k);
        out[ch + 4] = lerp(out[ch + 4], -25, k);
        out[ch + 7] = lerp(out[ch + 7], 0.35, k);
      }
    }

    // ---- carrying the ball: the carry arm stays tucked, moving a little with the stride
    if (opts.carry === 'L' || opts.carry === 'R') {
      const ch = opts.carry === 'L' ? C.ARM_L : C.ARM_R;
      tuckArm(out, ch, legL * (opts.carry === 'L' ? 1 : -1) * 4 * run);
    } else if (opts.carry === 'two') {
      for (const ch of [C.IKH_L, C.IKH_R]) { out[ch] = 1; out[ch + 1] = 0.065; out[ch + 2] = 0.03; out[ch + 3] = 0.27; out[ch + 4] = 0; }
      for (const ch of [C.ARM_L, C.ARM_R]) { out[ch + 7] = 0.55; out[ch + 4] = -10; }
    }

    this.w = damp(this.w, sstep(0.1, 0.85, v), 7, dt);
    this.dist += speed * dt;
    return out;
  }
}

/** The ball tucked high and tight: forearm across the belly, hand cupping the front tip. */
export function tuckArm(out, ch, wobble = 0) {
  // upper arm down the side (held off the ribs by the ball), forearm forward and a
  // little inward, the ball pinned along the inside of the forearm, nose in the palm
  out[ch] = 25 + wobble;
  out[ch + 1] = 2;
  out[ch + 2] = -18;
  out[ch + 3] = 106;
  out[ch + 4] = -12;
  out[ch + 5] = 4;
  out[ch + 6] = 18;
  out[ch + 7] = 0.75;
}
