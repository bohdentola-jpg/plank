// The skeleton: 23 bones, built in metres, bind pose = standing straight with
// the arms hanging and every bone's rotation identity (so a bone's local axes
// are the model's axes at bind: x = the player's LEFT, y up, z forward).
// Proportions come from the player's height / weight / body type.
//
// Joint conventions (degrees, side-relative so the same numbers on L and R
// give a symmetric pose; s = +1 left, −1 right):
//   root   [x, y, z, pitch(+fwd), yaw(+left), roll(+left)]   y is relative to standing hips height
//   spine/chest/neck/head [flex(+fwd), twist(+left), side(+left)]
//   clav   [elev(+up), protract(+fwd)]
//   arm    [elev(0 hanging … 180 straight up), plane(0 = out to the side, 90 = forward, −90 = back),
//           twist(+external), elbow(+bend), wflex(+palm), wdev(+thumb side), pronate, fingers(0 open … 1 fist … 2 pointing)]
//   leg    [flex(+knee forward), abd(+out), twist(+toe out), knee(+bend), ankle(+toes down), toe(+curl down)]
import * as THREE from 'three';

export const B = {
  hips: 0, spine: 1, chest: 2, neck: 3, head: 4,
  clavL: 5, armL: 6, foreL: 7, handL: 8, fingL: 9,
  clavR: 10, armR: 11, foreR: 12, handR: 13, fingR: 14,
  thighL: 15, shinL: 16, footL: 17, toeL: 18,
  thighR: 19, shinR: 20, footR: 21, toeR: 22,
};
export const NB = 23;              // the core bones: what the animator poses
export const PARENT = [-1, 0, 1, 2, 3, 2, 5, 6, 7, 8, 2, 10, 11, 12, 13, 0, 15, 16, 17, 0, 19, 20, 21];
export const BONE_NAMES = Object.keys(B);

// The hands: after the core, three bones per finger (knuckle, middle and end joints)
// and three for the thumb (its base in the palm, knuckle, end joint), per hand. They
// follow the fingers channel (handPose below), so a clip's grip, fist or open catching
// hand all come from that one number; the low-detail body keeps the single fingers bone.
export const HAND_BONES = 15;
export const HB = [NB, NB + HAND_BONES];          // first hand bone: left, right
export const NBX = NB + 2 * HAND_BONES;           // the whole skeleton
const DIGITS = ['idx', 'mid', 'rng', 'pky', 'thb'];
for (let si = 0; si < 2; si++) {
  const hand = si === 0 ? B.handL : B.handR;
  for (let k = 0; k < 5; k++) {
    for (let j = 0; j < 3; j++) {
      const i = HB[si] + k * 3 + j;
      PARENT[i] = j === 0 ? hand : i - 1;
      BONE_NAMES[i] = DIGITS[k] + (j + 1) + (si === 0 ? 'L' : 'R');
    }
  }
}

/**
 * Hand geometry at a hand scale of 1, in the bind frame of the hand hanging at the side:
 * d = down from the wrist joint, f = toward the thumb (forward), p = toward the palm (in).
 * Fingers (index, middle, ring, little): knuckle position, phalanx lengths (knuckle → middle
 * joint → end joint → tip), half-width at the base and at the tip. The thumb: its base
 * joint deep in the heel of the palm, the metacarpal's and the phalanges' directions.
 * The body mesh (body.js) is built on the same numbers.
 */
export const HAND = {
  fingers: [
    { d: 0.089, f: 0.0292, len: [0.041, 0.025, 0.021], r0: 0.0099, r1: 0.008 },
    { d: 0.093, f: 0.0098, len: [0.045, 0.028, 0.022], r0: 0.0101, r1: 0.0082 },
    { d: 0.09, f: -0.0098, len: [0.043, 0.027, 0.021], r0: 0.0096, r1: 0.0078 },
    { d: 0.083, f: -0.0284, len: [0.034, 0.02, 0.019], r0: 0.0086, r1: 0.007 },
  ],
  knuckleP: -0.004,          // the knuckles sit toward the back of the hand
  thumb: { d: 0.022, f: 0.019, p: 0.008, dir1: [0.25, 0.82, 0.5], dir2: [0.14, 0.95, -0.02], len: [0.044, 0.031, 0.027] },
};

/** Hands scale a little with the build (bigger men, bigger hands). */
export const handScale = (bd) => bd.s * (0.96 + 0.06 * bd.girth);

/** A hand-frame direction [p, d, f] → model space for a side (s = +1 left). */
function handDir(s, a, out = new THREE.Vector3()) {
  return out.set(-s * a[0], -a[1], a[2]).normalize();
}

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const sstep = (a, b, v) => { const t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

// body-type flavour on top of what height/weight already say
const TYPES = {
  lean:    { musc: 0.94, waist: 0.92, belly: 0.0, neck: 0.95, pads: 0.95, hip: 0.96, limb: 0.95 },
  average: { musc: 1.0, waist: 1.0, belly: 0.05, neck: 1.0, pads: 1.0, hip: 1.0, limb: 1.0 },
  thick:   { musc: 1.09, waist: 1.04, belly: 0.15, neck: 1.12, pads: 1.04, hip: 1.04, limb: 1.07 },
  big:     { musc: 1.04, waist: 1.16, belly: 0.75, neck: 1.18, pads: 1.08, hip: 1.12, limb: 1.1 },
  ref:     { musc: 0.96, waist: 1.04, belly: 0.3, neck: 1.0, pads: 0.0, hip: 1.02, limb: 0.97 },
};

// default muscle / pad size by position when a player has none (0..1)
const POS_MUSCLE = { QB: 0.35, RB: 0.75, WR: 0.5, TE: 0.7, C: 0.5, G: 0.5, DL: 0.6, LB: 0.75, CB: 0.5, S: 0.65, K: 0.2 };
const POS_PADS = { QB: 0.2, RB: 0.45, WR: 0.15, TE: 0.65, C: 0.85, G: 0.85, DL: 0.85, LB: 0.7, CB: 0.15, S: 0.4, K: 0.05 };

/**
 * Build parameters from a player (height in inches, weight in lbs, look.bodyType,
 * look.muscle 0..1, look.pads 0..1 (slim skill pads … big lineman pads),
 * look.face { jaw, chin, nose, brow, cheek, len } each −1..1).
 * Everything downstream (bones, body mesh, helmet scale) reads this.
 */
export function makeBuild(player, opts = {}) {
  const hIn = player?.height ?? 73;
  const wLb = player?.weight ?? 215;
  const look = player?.look || {};
  const type = opts.type || look.bodyType || 'average';
  const T = TYPES[type] || TYPES.average;
  const H = hIn * 0.0254;
  const s = H / 1.854;
  const kg = wLb * 0.4536;
  const bmi = kg / (H * H);
  // girth: how much wider/thicker than the reference 6'1" 210 lb athlete
  const girth = clamp(Math.sqrt(bmi / 27.6), 0.86, 1.3);
  const fat = clamp((bmi - 30) / 9, 0, 1);            // linemen carry some
  const pos = player?.pos;
  // muscle: how built the arms, legs, neck and chest are (definition goes with it)
  const muscle = clamp(look.muscle ?? POS_MUSCLE[pos] ?? 0.5, 0, 1);
  const padSize = clamp(look.pads ?? POS_PADS[pos] ?? 0.5, 0, 1);
  const face = look.face || null;
  const mk = 0.9 + 0.22 * muscle;                      // 0.9 slight … 1.12 built
  return {
    hIn, wLb, type, H, s, bmi, girth, muscle, padSize, face,
    musc: T.musc * mk,
    // muscle definition (bumps: deltoids, biceps, calves), less under fat
    def: clamp(0.25 + muscle * 0.9 - fat * 0.5, 0, 1),
    waist: T.waist * (0.94 + 0.06 * girth) + fat * 0.08,
    belly: clamp(T.belly * (0.4 + fat) + fat * 0.3, 0, 1.1),
    neck: T.neck * (0.9 + 0.1 * girth) * (0.95 + 0.1 * muscle),
    pads: opts.pads === false ? 0 : T.pads * (0.96 + 0.04 * girth) * (0.92 + 0.17 * padSize),
    // big pads stand taller over the shoulders, slim ones hug them
    padRise: opts.pads === false ? 0 : lerp(-0.01, 0.014, padSize),
    hip: T.hip * (0.95 + 0.07 * girth),
    limb: T.limb * (0.92 + 0.1 * girth),
    // lateral width scale for the skeleton (shoulders, hips)
    wide: clamp(0.94 + 0.09 * girth, 0.95, 1.1) * (type === 'big' ? 1.03 : 1) * (0.98 + 0.04 * muscle),
    padded: opts.pads !== false,
  };
}

/** Bind positions (model space, metres) for a build. */
export function bindPositions(bd) {
  const s = bd.s, w = bd.wide;
  const P = new Array(NBX);
  const v = (x, y, z) => new THREE.Vector3(x, y, z);
  P[B.hips] = v(0, 1.0 * s, 0);
  P[B.spine] = v(0, 1.1 * s, -0.012 * s);
  P[B.chest] = v(0, 1.285 * s, -0.008 * s);
  P[B.neck] = v(0, 1.515 * s, -0.03 * s);
  P[B.head] = v(0, 1.618 * s, -0.012 * s);
  for (const side of [1, -1]) {
    const L = side > 0;
    const clav = L ? B.clavL : B.clavR;
    P[clav] = v(side * 0.03 * w * s, 1.465 * s, 0.03 * s);
    const sh = v(side * 0.19 * w * s, 1.468 * s, -0.016 * s);
    P[L ? B.armL : B.armR] = sh;
    const el = v(sh.x, sh.y - 0.305 * s, sh.z);
    P[L ? B.foreL : B.foreR] = el;
    const wr = v(sh.x, el.y - 0.262 * s, sh.z + 0.004 * s);
    P[L ? B.handL : B.handR] = wr;
    P[L ? B.fingL : B.fingR] = v(wr.x, wr.y - 0.092 * s, wr.z + 0.004 * s);
    // finger and thumb joints
    const hs = handScale(bd), h0 = HB[L ? 0 : 1];
    HAND.fingers.forEach((F, k) => {
      let d = F.d;
      for (let j = 0; j < 3; j++) {
        P[h0 + k * 3 + j] = v(wr.x - side * HAND.knuckleP * hs, wr.y - d * hs, wr.z + F.f * hs);
        d += F.len[j];
      }
    });
    const T = HAND.thumb;
    const t1 = v(wr.x - side * T.p * hs, wr.y - T.d * hs, wr.z + T.f * hs);
    const t2 = t1.clone().addScaledVector(handDir(side, T.dir1), T.len[0] * hs);
    P[h0 + 12] = t1;
    P[h0 + 13] = t2;
    P[h0 + 14] = t2.clone().addScaledVector(handDir(side, T.dir2), T.len[1] * hs);
    const hip = v(side * 0.092 * bd.hip * s, 0.952 * s, 0.004 * s);
    P[L ? B.thighL : B.thighR] = hip;
    const knee = v(hip.x, hip.y - 0.44 * s, hip.z + 0.006 * s);
    P[L ? B.shinL : B.shinR] = knee;
    const ank = v(hip.x, 0.083 * s, hip.z - 0.016 * s);
    P[L ? B.footL : B.footR] = ank;
    P[L ? B.toeL : B.toeR] = v(hip.x, 0.022 * s, ank.z + 0.128 * s);
  }
  return P;
}

/** Everything the animator needs about a body: bind positions, local offsets, lengths. */
export function makeRigDims(bd) {
  const bind = bindPositions(bd);
  const off = bind.map((p, i) => (PARENT[i] < 0 ? p.clone() : p.clone().sub(bind[PARENT[i]])));
  const len = (a, b) => bind[a].distanceTo(bind[b]);
  return {
    bd, bind, off,
    hipsY: bind[B.hips].y,
    upperArm: len(B.armL, B.foreL), foreArm: len(B.foreL, B.handL),
    thigh: len(B.thighL, B.shinL), shin: len(B.shinL, B.footL),
    ankleH: bind[B.footL].y,
    ballZ: bind[B.toeL].z - bind[B.footL].z, ballY: bind[B.toeL].y - bind[B.footL].y,
    heelZ: 0.06 * bd.s,
    s: bd.s,
  };
}

// ------------------------------------------------------------------ joint math
// All allocation-free: write into a THREE.Quaternion.

const D2R = Math.PI / 180;
const _qa = new THREE.Quaternion(), _qb = new THREE.Quaternion();

function qAxis(q, ax, a) {
  const h = a * 0.5, sn = Math.sin(h);
  if (ax === 0) q.set(sn, 0, 0, Math.cos(h));
  else if (ax === 1) q.set(0, sn, 0, Math.cos(h));
  else q.set(0, 0, sn, Math.cos(h));
  return q;
}

/** out = R(ax0, a0) * R(ax1, a1) * R(ax2, a2), angles in radians (rightmost applies first). */
export function quat3(out, ax0, a0, ax1, a1, ax2, a2) {
  qAxis(out, ax0, a0);
  if (a1 !== 0) out.multiply(qAxis(_qa, ax1, a1));
  if (a2 !== 0) out.multiply(qAxis(_qb, ax2, a2));
  return out;
}

const X = 0, Y = 1, Z = 2;

/** spine/chest/neck/head [flex, twist, side] in degrees. */
export function qSpine(out, flex, twist, side) {
  return quat3(out, X, flex * D2R, Z, -side * D2R, Y, twist * D2R);
}
/** root rotation [pitch, yaw, roll]. */
export function qRoot(out, pitch, yaw, roll) {
  return quat3(out, Y, yaw * D2R, X, pitch * D2R, Z, -roll * D2R);
}
export function qClav(out, s, elev, prot) {
  return quat3(out, Y, -s * prot * D2R, Z, s * elev * D2R, X, 0);
}
export function qUpperArm(out, s, elev, plane, twist) {
  return quat3(out, Y, -s * plane * D2R, Z, s * elev * D2R, Y, s * twist * D2R);
}
export function qForearm(out, elbow) {
  return qAxis(out, X, -elbow * D2R);
}
export function qHand(out, s, wflex, wdev, pron) {
  return quat3(out, Y, -s * pron * D2R, Z, -s * wflex * D2R, X, -wdev * D2R);
}
export function qFingers(out, s, curl) {
  return qAxis(out, Z, -s * curl * 95 * D2R);
}
export function qThigh(out, s, flex, abd, twist) {
  return quat3(out, X, -flex * D2R, Z, s * abd * D2R, Y, s * twist * D2R);
}
export function qShin(out, knee) {
  return qAxis(out, X, knee * D2R);
}
export function qFoot(out, s, ankle, roll = 0) {
  return quat3(out, X, ankle * D2R, Z, s * roll * D2R, X, 0);
}
export function qToe(out, toe) {
  return qAxis(out, X, toe * D2R);
}

// ------------------------------------------------------------------ hands

const LEAD = [-0.1, 0, 0.06, 0.14];      // into a curl the little finger leads and the index trails
const SPREAD = [-7, -1.5, 3, 9];         // an open hand fans out (deg, − = toward the thumb)
// The thumb's bind pose is the relaxed hand (its pad by the index finger). Open, it splays away
// from the fingers; in a fist it folds across the index and middle fingers' middle joints.
// Directions of its metacarpal, first and second phalanx, [p, d, f] as in HAND.
const THUMB_OPEN = [[0.35, 0.7, 0.62], [0.18, 0.78, 0.6], [0.12, 0.8, 0.58]];
const THUMB_FIST = [[0.544, 0.726, 0.423], [0.62, 0.43, -0.65], [0.13, 0.26, -0.95]];
const THUMB_Q = [1, -1].map((s) => {
  const b1 = handDir(s, HAND.thumb.dir1), b2 = handDir(s, HAND.thumb.dir2);
  const key = (dirs) => {
    const [m, p1, p2] = dirs.map((a) => handDir(s, a));
    const q1 = new THREE.Quaternion().setFromUnitVectors(b1, m);
    const q2 = new THREE.Quaternion().setFromUnitVectors(b2, p1.clone().applyQuaternion(q1.clone().invert()));
    const q12 = q1.clone().multiply(q2);
    const q3 = new THREE.Quaternion().setFromUnitVectors(b2, p2.clone().applyQuaternion(q12.invert()));
    return [q1, q2, q3];
  };
  return { open: key(THUMB_OPEN), fist: key(THUMB_FIST) };
});
const _qi = new THREE.Quaternion();

/** The fingers channel (0 open … 1 fist … 2 pointing) back out of the fingers bone's rotation. */
export function fingersCurl(q, s) {
  let a = -s * 2 * Math.atan2(q.z, q.w);
  if (a < -0.5) a += Math.PI * 2;          // past a fist the bone turns beyond 180°: q and −q agree
  return a / (95 * D2R);
}

/**
 * Local rotations of one hand's finger and thumb bones for a curl (the fingers channel:
 * 0 open and spread, ~0.2 an open blade, ~0.4 relaxed, 1 a fist, 2 pointing). q = the skeleton's quaternions, si 0 left / 1 right.
 */
export function handPose(q, si, curl) {
  const s = si === 0 ? 1 : -1, h0 = HB[si];
  const c = clamp(curl, 0, 1);
  const open = 1 - sstep(0, 0.22, c);
  // past a fist (1 … 2) the index finger straightens back out of it: pointing
  const point = sstep(1.05, 1.8, curl);
  for (let k = 0; k < 4; k++) {
    let ck = clamp(c + LEAD[k] * 4 * c * (1 - c), 0, 1);
    if (k === 0) ck = lerp(ck, 0.03, point);
    const i = h0 + k * 3;
    // the knuckle bends, then fans in the plane of the palm; the end joint follows the middle one
    qAxis(_qa, X, SPREAD[k] * open * D2R);
    qAxis(_qb, Z, -s * (4 + 84 * ck) * D2R);
    q[i].multiplyQuaternions(_qa, _qb);
    qAxis(q[i + 1], Z, -s * (6 + 98 * ck) * D2R);
    qAxis(q[i + 2], Z, -s * (3 + 60 * ck) * D2R);
  }
  // thumb: open → relaxed (the bind pose) by 0.25 → folded over the fingers
  const tq = THUMB_Q[si];
  for (let j = 0; j < 3; j++) {
    if (c < 0.25) q[h0 + 12 + j].copy(tq.open[j]).slerp(_qi, sstep(0, 0.25, c));
    else q[h0 + 12 + j].identity().slerp(tq.fist[j], (c - 0.25) / 0.75);
  }
}

// ------------------------------------------------------------------ FK / IK

const _v = new THREE.Vector3();

/**
 * Forward kinematics into model space. local[i]: Quaternion, hipsPos: Vector3
 * (model space). Writes rot[i] (Quaternion) and pos[i] (Vector3).
 */
export function fk(dims, local, hipsPos, rot, pos, from = 0) {
  const off = dims.off;
  if (from === 0) {
    rot[0].copy(local[0]);
    pos[0].copy(hipsPos);
    from = 1;
  }
  for (let i = from; i < NB; i++) {
    const p = PARENT[i];
    rot[i].multiplyQuaternions(rot[p], local[i]);
    pos[i].copy(off[i]).applyQuaternion(rot[p]).add(pos[p]);
  }
}

/** Recompute FK for one bone and its descendants (bones are in topological order). */
export function fkChain(dims, local, rot, pos, first, last) {
  const off = dims.off;
  for (let i = first; i <= last; i++) {
    const p = PARENT[i];
    rot[i].multiplyQuaternions(rot[p], local[i]);
    pos[i].copy(off[i]).applyQuaternion(rot[p]).add(pos[p]);
  }
}

const _d = new THREE.Vector3(), _n = new THREE.Vector3(), _u = new THREE.Vector3(), _f = new THREE.Vector3();
const _xa = new THREE.Vector3(), _ya = new THREE.Vector3(), _za = new THREE.Vector3();
const _m = new THREE.Matrix4(), _qp = new THREE.Quaternion(), _qm = new THREE.Quaternion();

/**
 * Two-bone IK in model space.
 *   root      model-space position of the upper joint (shoulder / hip)
 *   target    desired end position (wrist / ankle)
 *   pole      direction the middle joint (elbow / knee) should point toward
 *   a, b      bone lengths
 *   parentRot model-space rotation of the upper bone's parent
 *   knee      true for legs (shin bends toward −z), false for arms (forearm bends toward +z)
 * Writes the upper bone's LOCAL rotation into outUpper and the hinge rotation into outLower.
 * Returns how far the target was out of reach (0 when reached).
 */
export function twoBoneIK(root, target, pole, a, b, parentRot, knee, outUpper, outLower) {
  _d.subVectors(target, root);
  let dist = _d.length();
  if (dist < 1e-5) { _d.set(0, -1, 0); dist = 1e-5; } else _d.multiplyScalar(1 / dist);
  const maxR = a + b;
  // soft clamp near full extension: no snap to straight
  const soft = maxR * 0.965;
  let dd = dist;
  if (dd > soft) {
    const over = dd - soft, span = maxR - soft;
    dd = soft + span * (1 - Math.exp(-over / span));
  }
  dd = Math.max(Math.abs(a - b) + 1e-4, Math.min(dd, maxR - 1e-5));
  const cosA = clamp((a * a + dd * dd - b * b) / (2 * a * dd), -1, 1);
  const sinA = Math.sqrt(1 - cosA * cosA);
  // pole direction perpendicular to the reach direction
  _n.copy(pole).addScaledVector(_d, -pole.dot(_d));
  if (_n.lengthSq() < 1e-8) {
    _n.set(0, 0, 1).addScaledVector(_d, -_d.z);
    if (_n.lengthSq() < 1e-8) _n.set(1, 0, 0).addScaledVector(_d, -_d.x);
  }
  _n.normalize();
  _u.copy(_d).multiplyScalar(cosA).addScaledVector(_n, sinA);   // upper bone direction
  // lower bone direction
  _f.copy(_d).multiplyScalar(dd).addScaledVector(_u, -a).normalize();
  const bend = Math.acos(clamp(_u.dot(_f), -1, 1));
  // upper bone frame: y = −u, z = toward the knee (legs) / away from the elbow tip (arms)
  _ya.copy(_u).negate();
  if (knee) _za.copy(_n); else _za.copy(_n).negate();
  _xa.crossVectors(_ya, _za).normalize();
  _za.crossVectors(_xa, _ya).normalize();
  _m.makeBasis(_xa, _ya, _za);
  _qm.setFromRotationMatrix(_m);
  _qp.copy(parentRot).invert();
  outUpper.multiplyQuaternions(_qp, _qm);
  qAxis(outLower, 0, knee ? bend : -bend);
  return Math.max(0, dist - maxR);
}

export const DEG = D2R;
