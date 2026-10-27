// Procedural locomotion. Inputs come straight from the anim state A (speed,
// moveAngle, accel, turnRate, effort, carry); output is a pose (pose.js
// channels) with the feet on IK.
//
// - The stride phase advances with distance travelled (cadence × dt, stride =
//   speed / cadence), so every gait from a walk to a sprint keeps its feet.
// - A foot in stance is planted in the WORLD: each frame it slides back by the
//   body's velocity and turns against the body's yaw (its own yaw included),
//   so feet never skate or swivel while turning or accelerating.
// - The swing foot flies a sprinter's path from where it lifted to where it
//   will land: toe-off, the heel recovering up under the hips, the knee
//   driving through, the foot reaching and pawing back down under the body.
//   Walk, jog, sprint and the low shuffle paths are keyed and blended by gait.
// - Arms swing fore and aft from the shoulder with the elbow hinge kept level
//   (the forearm never folds across the chest): bent tight at the front of the
//   swing, opening behind, hands converging toward the sternum, not past it.
// - Gait style follows the travel direction in the hips' frame: run / walk
//   forward, lateral shuffle (feet never cross), backpedal; running sideways
//   fast opens the hips into a crossover run while the chest keeps facing.
// - Springs give the upper body weight: lean into acceleration, rock back on
//   braking, bank into real turns (from the travel direction's turn, smoothed,
//   never from heading jitter), drop the hips on a hard cut, head stabilised.
import * as THREE from 'three';
import { C, NCH, neutral } from './pose.js';
import { qUpperArm } from './rig.js';

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

// ------------------------------------------------------------------ arms

const _qa = new THREE.Quaternion(), _hv = new THREE.Vector3(), _uv = new THREE.Vector3(), _wv = new THREE.Vector3(), _cv = new THREE.Vector3();

/**
 * Upper arm flexed `flex`° forward of hanging (− = behind), out `abd`° from the
 * side, with the elbow hinge kept level so the forearm swings fore and aft,
 * angled `inward`° toward the midline. Writes [elev, plane, twist] (the arm
 * channels, side-relative: the same numbers mirror onto the other arm).
 */
export function armFlex(out, flex, abd, inward = 0) {
  const f = flex * D2R, a = abd * D2R;
  // the bone's direction for the left arm (x = outward)
  const dx = Math.sin(a) * Math.cos(f), dy = -Math.cos(a) * Math.cos(f), dz = Math.sin(f);
  const elev = Math.acos(clamp(-dy, -1, 1)) * R2D;
  const plane = Math.atan2(dz, dx) * R2D;
  // where the hinge (the upper arm's local x) points with no twist
  qUpperArm(_qa, 1, elev, plane, 0);
  _hv.set(1, 0, 0).applyQuaternion(_qa);
  _uv.set(dx, dy, dz);
  // where it should point: outward, turned `inward` so the bent forearm angles in, square to the bone
  const i = inward * D2R;
  _wv.set(Math.cos(i), 0, Math.sin(i));
  _wv.addScaledVector(_uv, -_wv.dot(_uv)).normalize();
  // the twist about the bone that takes one to the other (the twist channel turns about the
  // bone's local +y, which points back up the bone: hence the sign)
  const tw = Math.atan2(_cv.crossVectors(_hv, _wv).dot(_uv), _hv.dot(_wv)) * R2D;
  out[0] = elev; out[1] = plane; out[2] = -tw;
  return out;
}

const _as = [0, 0, 0];

// ------------------------------------------------------------------ swing-foot paths
// [k (swing progress), x (0 = where the foot lifted … 1 = where it lands, a
// little past it while it reaches), y (height of the foot's lowest point, m)]

const PATH_WALK = [[0, 0, 0], [0.2, 0.1, 0.045], [0.45, 0.45, 0.06], [0.7, 0.8, 0.042], [0.88, 0.97, 0.018], [1, 1, 0]];
const PATH_JOG = [[0, 0, 0], [0.18, 0.1, 0.13], [0.38, 0.38, 0.21], [0.58, 0.7, 0.19], [0.78, 0.98, 0.11], [0.9, 1.02, 0.045], [1, 1, 0]];
const PATH_SPRINT = [[0, 0, 0], [0.14, 0.07, 0.2], [0.3, 0.3, 0.37], [0.46, 0.56, 0.4], [0.62, 0.84, 0.32], [0.78, 1.05, 0.19], [0.9, 1.05, 0.075], [1, 1, 0]];
const PATH_SHUFFLE = [[0, 0, 0], [0.3, 0.22, 0.055], [0.62, 0.72, 0.05], [0.86, 0.96, 0.02], [1, 1, 0]];

function samplePath(P, k, out) {
  let i = 0;
  while (i < P.length - 2 && k > P[i + 1][0]) i++;
  const p0 = P[Math.max(0, i - 1)], p1 = P[i], p2 = P[i + 1], p3 = P[Math.min(P.length - 1, i + 2)];
  const span = p2[0] - p1[0] || 1;
  const u = clamp((k - p1[0]) / span, 0, 1);
  const u2 = u * u, u3 = u2 * u;
  for (let c = 1; c <= 2; c++) {
    const m1 = p2[0] - p0[0] > 1e-6 ? ((p2[c] - p0[c]) / (p2[0] - p0[0])) * span : 0;
    const m2 = p3[0] - p1[0] > 1e-6 ? ((p3[c] - p1[c]) / (p3[0] - p1[0])) * span : 0;
    out[c - 1] = (2 * u3 - 3 * u2 + 1) * p1[c] + (u3 - 2 * u2 + u) * m1 + (-2 * u3 + 3 * u2) * p2[c] + (u3 - u2) * m2;
  }
  return out;
}

const _p1 = [0, 0], _p2 = [0, 0];
/** Swing path at progress k for a gait mix → [x 0…1, y metres (unscaled)]. */
function swingPath(k, run, sprint, low, out) {
  samplePath(PATH_WALK, k, _p1);
  samplePath(PATH_JOG, k, _p2);
  let x = lerp(_p1[0], _p2[0], run), y = lerp(_p1[1], _p2[1], run);
  if (sprint > 0) {
    samplePath(PATH_SPRINT, k, _p1);
    x = lerp(x, _p1[0], sprint); y = lerp(y, _p1[1], sprint);
  }
  if (low > 0) {
    samplePath(PATH_SHUFFLE, k, _p1);
    x = lerp(x, _p1[0], low); y = lerp(y, _p1[1], low);
  }
  out[0] = x; out[1] = Math.max(0, y);
  return out;
}
const _sp = [0, 0];

export class Locomotion {
  constructor(dims, seed = 0) {
    this.dims = dims;
    this.phase = seed % 1;
    this.v = 0;
    this.ma = 0;
    this.hipYaw = 0;
    this.w = 0;
    this.lean = new Spring(3.0, 0.8);
    this.bank = new Spring(2.2, 0.9);
    this.bob = new Spring(7, 0.9);
    this.cut = new Spring(4, 0.9);
    this.out = neutral(new Float32Array(NCH));
    // feet: model-space ball-of-foot positions (x, z), stance flags, lift positions, yaw (rad, model frame)
    this.feet = [
      { x: 0.12, z: 0, lx: 0.12, lz: 0, stance: true, prevPh: 0, yaw: 0, y: 0, pitch: 0 },
      { x: -0.12, z: 0, lx: -0.12, lz: 0, stance: true, prevPh: 0.5, yaw: 0, y: 0, pitch: 0 },
    ];
    this.styleW = { fwd: 1, side: 0, back: 0 };
    this.dist = 0;
    // the travel direction in the world and how fast it is turning (smoothed): what banks the body
    this.velDir = null;
    this.omega = 0;
  }

  setDims(d) { this.dims = d; }

  /** Snap the planted feet to a stance (when locomotion is idle). */
  resetFeet(base) {
    const s = this.dims.s;
    this.feet[0].x = base[C.IKF_L + 1] * s; this.feet[0].z = base[C.IKF_L + 3] * s;
    this.feet[1].x = -base[C.IKF_R + 1] * s; this.feet[1].z = base[C.IKF_R + 3] * s;
    this.feet[0].yaw = (base[C.IKF_L + 5] || 0) * D2R;
    this.feet[1].yaw = -(base[C.IKF_R + 5] || 0) * D2R;
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

    // ---- how hard the path is bending: the travel direction's turn in the world, smoothed
    const vd = (A.heading || 0) + (A.moveAngle || 0);
    if (this.velDir === null || speed < 0.8 || dt <= 0) { this.velDir = vd; this.omega = damp(this.omega, 0, 6, dt); }
    else {
      const om = clamp(wrap(vd - this.velDir) / dt, -8, 8);
      this.velDir = vd;
      this.omega = damp(this.omega, om, 5, dt);
    }
    // lateral acceleration (m/s²) of a real turn; a deadzone keeps steering wobble out of the trunk
    const om = Math.sign(this.omega) * Math.max(0, Math.abs(this.omega) - 0.35);
    const latA = speed * om;

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
    const width = lerp(lerp(0.1, 0.075, sprint), 0.31, wSide) * s + wBack * 0.035 * s + (posture === 'block' ? 0.06 * s : 0);
    const landAhead = lerp(0.42, 0.36, run) * beta * stride;
    // the low paths: shuffling, backpedalling and driving a block keep the feet near the turf
    const low = clamp(wSide + wBack * 0.75 + churn * 0.6, 0, 1);
    const hScale = s * (1 - 0.25 * wBack) * (opts.highstep ? 0.85 : 1);
    const cy = Math.cos(hipYaw), sy = Math.sin(hipYaw);
    const dTurn = -turn * dt;
    const cT = Math.cos(dTurn), sT = Math.sin(dTurn);
    // foot yaw along the travel direction running forward, along the heading shuffling / backpedalling
    const travelYaw = hipYaw + gma * wFwd * 0.85;
    let comp = 0, stanceL = 0, stanceR = 0, flightLift = 1;
    for (let i = 0; i < 2; i++) {
      const f = this.feet[i];
      const side = i === 0 ? 1 : -1;
      const ph = (this.phase + (i === 0 ? 0 : 0.5)) % 1;
      const inStance = ph < beta;
      // home position (hips frame → model frame)
      const hx = side * width, hz = 0.0;
      const homeX = hx * cy + hz * sy, homeZ = -hx * sy + hz * cy;
      const yawT = travelYaw * (1 - wSide - wBack * 0.7) + side * 7 * D2R;
      if (inStance) {
        if (!f.stance) { f.stance = true; }
        // planted: slide back with the ground, counter-rotate with the body's turn (yaw too)
        f.x -= velX * dt; f.z -= velZ * dt;
        const nx = f.x * cT + f.z * sT, nz = -f.x * sT + f.z * cT;
        f.x = nx; f.z = nz;
        f.yaw = clamp(wrap(f.yaw + dTurn), yawT - 0.95, yawT + 0.95);
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
      } else {
        if (f.stance) { f.stance = false; f.lx = f.x; f.lz = f.z; }
        const k = (ph - beta) / (1 - beta);                       // swing progress
        const landX = homeX + dirX * landAhead;
        const landZ = homeZ + dirZ * landAhead;
        swingPath(k, run, sprint, low, _sp);
        f.x = lerp(f.lx, landX, _sp[0]);
        f.z = lerp(f.lz, landZ, _sp[0]);
        f.y = _sp[1] * hScale * (1 + effort * 0.12 * run) + (opts.highstep ? 0.42 * s * Math.sin(Math.PI * sstep(0.15, 0.95, k)) : 0) + churn * 0.05 * s * Math.sin(Math.PI * k);
        // pitch: toe-off → toes up as the leg comes through → landing attitude
        const pOff = lerp(lerp(28, 46, run), 58, sprint);
        const pLand = lerp(lerp(-10, 4, run), 10, sprint) + wBack * 14;
        f.pitch = k < 0.5 ? lerp(pOff, -12, sstep(0, 0.5, k)) : lerp(-12, pLand, sstep(0.5, 1, k));
        // the foot turns to where it will land
        f.yaw = damp(f.yaw, yawT, 9, dt);
      }
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
      // knees track over the toes: a touch outward, more when shuffling
      out[kn] = 0.12 + 0.15 * wSide; out[kn + 1] = 0; out[kn + 2] = 1;
    }

    // ---- pelvis
    const cutK = this.cut.step(sstep(4, 11, Math.abs(latA)), dt);   // planting on a hard cut
    const crouch = lerp(lerp(0.02, 0.045, run), 0.07, sprint) + wSide * 0.13 + wBack * 0.08 + churn * 0.05 + (posture === 'block' ? 0.06 : 0) + cutK * 0.06;
    const bobAmp = lerp(0.022, 0.045, run) * (1 - 0.6 * wSide) * (1 - 0.4 * wBack) * (opts.highstep ? 1.4 : 1);
    const walkBob = (1 - run) * (comp - 0.55) * 0.04;
    const runBob = run * (flightLift * 0.35 - comp) * bobAmp;
    const bob = this.bob.step(walkBob + runBob, dt);
    // longitudinal lean: speed posture + acceleration spring + effort (drive phase leans the most)
    const accel = clamp(A.accel || 0, -12, 12);
    const leanT = clamp(accel * 1.8, -12, 18) * (1 - wBack) - clamp(accel, -10, 10) * wBack * 0.8;
    const lean = this.lean.step(leanT, dt);
    const basePitch = lerp(lerp(4, 10, run), 14, sprint) + effort * 5 * run * wFwd + wSide * 10 + wBack * 12 + churn * 12 + (posture === 'block' ? 8 : 0) - (opts.highstep ? 16 : 0) + cutK * 6;
    // banking into a real turn: lean toward its centre, as much as the lateral grip asks for
    const bankT = clamp(Math.atan2(latA, 9.81) * R2D * 0.85, -18, 18) * (1 - wBack * 0.5) * (1 - wSide * 0.6);
    const bank = this.bank.step(bankT, dt);
    // pelvis twist follows the legs (forward leg's hip leads)
    const fl = this.feet[0], fr = this.feet[1];
    const gzL = fl.x * sy + fl.z * cy, gzR = fr.x * sy + fr.z * cy;
    const pelvYaw = clamp(Math.atan2((gzR - gzL) * 0.5, 0.42 * s) * R2D * lerp(0.6, 0.85, run) * wFwd, -14, 14);
    const pelvRoll = (stanceR - stanceL) * 3 * (1 - run) * wFwd + (stanceR - stanceL) * 1.2 * run;
    const sway = (stanceL - stanceR) * 0.01 * (1 - run) * wFwd;
    const hipsH = d.hipsY;
    out[C.ROOT] = (sway + Math.sin(bank * D2R) * hipsH * 0.9 * Math.cos(hipYaw)) / s;
    out[C.ROOT + 1] = -crouch + bob - (1 - Math.cos(bank * D2R)) * 0.5;
    out[C.ROOT + 2] = -lean * 0.002;
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

    // ---- arms: driven fore and aft from the shoulder, opposite the legs
    // (+1 when the left leg reaches forward; the arms lead the legs a touch)
    const legL = Math.cos(TAU * (this.phase + 0.04));
    const pump = 1 + effort * 0.18 * run;
    const ampF = lerp(lerp(16, 36, run), 58, sprint) * pump;        // forward flexion at the front of the swing
    const ampB = lerp(lerp(14, 26, run), 42, sprint) * pump;        // extension behind
    const eFront = lerp(lerp(28, 86, run), 94, sprint);             // elbow bend, front of the swing
    const eBack = lerp(lerp(16, 66, run), 58, sprint);              // … and behind: the arm opens
    for (let i = 0; i < 2; i++) {
      const side = i === 0 ? 1 : -1;
      const ch = i === 0 ? C.ARM_L : C.ARM_R;
      const k = -side * legL;                                         // +1: this arm forward
      const flex = (lerp(3, 7, run) + (k > 0 ? k * ampF : k * ampB)) * (1 - 0.75 * wSide);
      const abd = lerp(9, 14, run) + (posture === 'block' ? 9 : 0) + wSide * 8;
      // the hand comes in toward the sternum on the front swing; behind, the forearm runs straight back
      const inward = lerp(6, 16, run) * Math.max(0, k);
      armFlex(_as, flex, abd, inward);
      out[ch] = _as[0];
      out[ch + 1] = _as[1];
      out[ch + 2] = _as[2];
      out[ch + 3] = lerp(eBack, eFront, (k + 1) / 2);
      out[ch + 4] = lerp(4, 10, run);
      out[ch + 5] = 0;
      out[ch + 6] = lerp(5, 15, run);
      out[ch + 7] = lerp(0.35, 0.6, run);
      const cl = i === 0 ? C.CLAV_L : C.CLAV_R;
      out[cl] = 2 + run * 2 + Math.max(0, k) * 2 * run;
      out[cl + 1] = k * lerp(2, 7, run);                             // the shoulder reaches with the arm
    }
    // shuffle / backpedal: arms up and in front (ready hands)
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
