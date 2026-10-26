// The animator: turns the sim's animation state A into bone rotations every
// frame, allocation-free.
//
//   base stance (+ idle: breathing, weight shifts, glances)
//   → blended with synthesised locomotion by speed
//   → carry tuck on the ball arm
//   → action clip (full body, or upper body over the running legs; mirrored by side)
//   → engage lean / hands on the opponent / churning legs
//   → Euler → quaternions → FK → foot IK (planted feet, heel peel, flat toes)
//   → head look-at → hand IK (clip targets, A.reach) → FK
//   → inertialized transitions (~0.15 s) so base/action/carry changes never pop
import * as THREE from 'three';
import { B, NB, fk, fkChain, twoBoneIK, qSpine } from './rig.js';
import { C, NCH, G, GI, GROUPS, LOWER, neutral, blend, mirror, poseToLocal, makeQuatArray, makeVecArray } from './pose.js';
import { sampleTracks } from './clipdsl.js';
import { CLIPS, BASES, clipTime } from './clips.js';
import { Locomotion, tuckArm } from './locomotion.js';

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const sstep = (a, b, v) => { const t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const damp = (cur, target, rate, dt) => target + (cur - target) * Math.exp(-rate * dt);
const D2R = Math.PI / 180, R2D = 180 / Math.PI;
const YARD_M = 0.9144;

const LOWER_MASK = new Uint8Array(GROUPS.length);
for (const g of LOWER) LOWER_MASK[GI[g]] = 1;
const ALL_MASK = new Uint8Array(GROUPS.length).fill(1);

// scratch
const _v1 = new THREE.Vector3(), _v2 = new THREE.Vector3(), _v3 = new THREE.Vector3(), _v4 = new THREE.Vector3();
const _q1 = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _q3 = new THREE.Quaternion();
const _qI = new THREE.Quaternion();
const _target = new THREE.Vector3(), _pole = new THREE.Vector3();
const _maskM = new Uint8Array(GROUPS.length);

function mirrorMask(out, m) {
  out.set(m);
  const swap = (a, b) => { const t = out[GI[a]]; out[GI[a]] = out[GI[b]]; out[GI[b]] = t; };
  swap('clavL', 'clavR'); swap('armL', 'armR'); swap('legL', 'legR'); swap('handL', 'handR');
  swap('poleL', 'poleR'); swap('footL', 'footR'); swap('kneeL', 'kneeR');
  return out;
}

export class Animator {
  constructor(dims, seed = 0) {
    this.dims = dims;
    this.seed = seed;
    this.loco = new Locomotion(dims, (seed * 0.618) % 1);
    this.P = neutral();
    this.act = neutral();
    this.act2 = neutral();
    this.legs = neutral();
    this.local = makeQuatArray();
    this.hips = new THREE.Vector3();
    this.rot = makeQuatArray();
    this.pos = makeVecArray();
    this.out = makeQuatArray();
    this.outHips = new THREE.Vector3();
    this.prev = makeQuatArray();
    this.prevHips = new THREE.Vector3();
    this.off = makeQuatArray();
    this.offHips = new THREE.Vector3();
    this.offT = 1; this.offDur = 0.15;
    this.sig = '';
    this.first = true;
    this.time = seed * 3.7;
    this.lookW = 0; this.lookYaw = 0; this.lookPitch = 0;
    this.reachW = [0, 0];
    this.engW = 0; this.engYaw = 0; this.engPush = 0;
    this.grip = 0;            // 0 tucked … 1 in the palm
    this.lastActT = 0;
    this.actName = '';
    this.clipNow = null;
    this.carry = null;
    this.side = 'R';
  }

  setDims(d) {
    this.dims = d;
    this.loco.setDims(d);
    this.first = true;
  }

  // ---------------------------------------------------------------- idle

  idle(P, info, dt) {
    const t = this.time;
    const sd = this.seed;
    const br = info.breath || 0;
    if (br) {
      const b = Math.sin(t * Math.PI * 2 * 0.24 + sd) * br;
      P[C.CHEST] -= b * 1.1;
      P[C.CLAV_L] += b * 1.2; P[C.CLAV_R] += b * 1.2;
      P[C.NECK] += b * 0.5;
    }
    const sw = info.sway || 0;
    if (sw) {
      const s = Math.sin(t * 0.55 + sd * 2.1) * 0.7 + Math.sin(t * 0.23 + sd) * 0.3;
      P[C.ROOT] += s * 0.014 * sw;
      P[C.ROOT + 5] += s * 1.4 * sw;
      P[C.SPINE + 2] -= s * 0.9 * sw;
      P[C.ROOT + 1] -= Math.abs(s) * 0.004 * sw;
    }
    const bo = info.bounce || 0;
    if (bo) {
      const k = Math.sin(t * Math.PI * 2 * 1.4 + sd);
      P[C.ROOT + 1] += k * 0.008 * bo;
      P[C.ROOT + 3] += k * 0.8 * bo;
    }
    const gl = info.glance || 0;
    if (gl) {
      const yaw = (Math.sin(t * 0.31 + sd * 5) * 0.6 + Math.sin(t * 0.13 + sd) * 0.4) * 14 * gl;
      const pit = Math.sin(t * 0.21 + sd * 3) * 4 * gl;
      P[C.NECK + 1] += yaw * 0.45; P[C.HEAD + 1] += yaw * 0.55;
      P[C.NECK] += pit * 0.4; P[C.HEAD] += pit * 0.6;
    }
  }

  // ---------------------------------------------------------------- main

  update(dt, A) {
    const d = this.dims, s = d.s;
    this.time += dt;
    const baseName = BASES[A.base] ? A.base : 'stand';
    const base = BASES[baseName];
    const info = base.info;
    const actIn = A.action && CLIPS[A.action.name] ? A.action : null;
    const clip = actIn ? CLIPS[actIn.name] : null;
    const carry = A.carry === 'L' || A.carry === 'R' || A.carry === 'two' ? A.carry : null;
    const P = this.P;

    // ---- base + idle
    P.set(base.pose);
    this.idle(P, info, dt);

    // ---- locomotion
    const upright = info.upright ?? 1;
    const engaged = !!A.engage;
    const churn = engaged ? 1 : (actIn?.name === 'wrapped' ? 1 : 0);
    const loco = this.loco.update(dt, A, {
      churn, highstep: actIn?.name === 'highstep', carry, posture: engaged ? 'block' : info.posture,
    });
    let wLoco = this.loco.w * upright;
    if (clip && !clip.upper && clip.legsLoco === 0 && !clip.held) wLoco *= 0;   // full-body clips own the legs
    if (this.loco.w < 0.03) this.loco.resetFeet(P);
    if (wLoco > 0.001) blend(P, P, loco, wLoco);

    // ---- carry: tuck / two hands (locomotion already did it when moving)
    if (carry) this.applyCarry(P, carry);

    // ---- action
    let side = 'R', mirrored = false;
    if (clip) {
      side = actIn.side === 'L' || actIn.side === 'R' ? actIn.side : (clip.sideFromCarry ? (carry === 'L' ? 'L' : 'R') : clip.side);
      mirrored = side !== clip.side;
      const t = clipTime(clip, actIn.t || 0);
      const act = this.act;
      neutral(act);
      sampleTracks(clip.tracks, t, act, clip.lag);
      if (clip.variant && CLIPS[clip.variant]) {
        const pw = clamp(actIn.power ?? 1, 0, 1);
        if (pw < 0.999) {
          const v = CLIPS[clip.variant];
          neutral(this.act2);
          sampleTracks(v.tracks, clipTime(v, actIn.t || 0), this.act2, v.lag);
          blend(act, this.act2, act, pw, null);
        }
      }
      const mask = mirrored ? mirrorMask(_maskM, clip.mask) : clip.mask;
      if (mirrored) mirror(act, act);
      blend(P, P, act, 1, mask);
      // upper-body clips: their own legs only while standing still
      if (clip.upper && clip.legTracks) {
        const w = 1 - this.loco.w;
        if (w > 0.001) {
          const L = this.legs;
          neutral(L);
          sampleTracks(clip.legTracks, t, L, null);
          const lm = mirrored ? mirrorMask(_maskM, clip.legTracks.mask) : clip.legTracks.mask;
          if (mirrored) mirror(L, L);
          blend(P, P, L, w, lm);
        }
      }
      // full-body clips that hand the legs to locomotion while moving
      if (!clip.upper && clip.legsLoco > 0 && this.loco.w > 0.001) blend(P, P, loco, clip.legsLoco * this.loco.w, LOWER_MASK);
      // the ball arm stays tucked unless the clip handles the ball
      if (carry && !clip.ball) this.applyCarry(P, carry);
    }
    this.clipNow = clip;
    this.side = side;
    this.carry = carry;

    // ---- engage: lean into the man, hands on his chest, legs churning
    this.engW = damp(this.engW, engaged ? 1 : 0, 8, dt);
    if (engaged) {
      const h = A.heading || 0;
      const ex = A.engage.dx * Math.cos(h) - A.engage.dz * Math.sin(h);
      const ez = A.engage.dx * Math.sin(h) + A.engage.dz * Math.cos(h);
      this.engYaw = damp(this.engYaw, clamp(Math.atan2(ex, ez) * R2D, -50, 50), 6, dt);
      this.engPush = damp(this.engPush, clamp(A.engage.push || 0, -1, 1), 5, dt);
    }
    if (this.engW > 0.01) this.applyEngage(P, clip, carry);

    // ---- to quaternions, FK
    poseToLocal(P, this.local, this.hips, d);
    fk(d, this.local, this.hips, this.rot, this.pos);

    // ---- feet
    this.legIK(P, 0);
    this.legIK(P, 1);
    fk(d, this.local, this.hips, this.rot, this.pos);

    // ---- look-at
    this.lookAt(A, clip, dt);

    // ---- hands (clip IK + reach)
    this.reach(A, clip, actIn, P, dt);
    this.armIK(P, 0);
    this.armIK(P, 1);

    // ---- transitions
    const sig = `${baseName}|${clip ? clip.name : ''}|${carry || ''}|${side}`;
    const restarted = clip && actIn.t + 1e-4 < this.lastActT - 0.05;
    if (!this.first && (sig !== this.sig || restarted)) this.startTransition(clip);
    this.sig = sig;
    this.lastActT = actIn ? actIn.t : 0;
    this.applyTransition(dt);

    // ---- final FK for queries
    fk(d, this.out, this.outHips, this.rot, this.pos);
    // grip: the ball sits in the throwing hand until release
    const palm = clip && clip.grip === 'palm' && (actIn.t || 0) <= clip.gripUntil + 0.02 ? 1 : 0;
    this.grip = palm ? 1 : damp(this.grip, 0, 14, dt);
    this.first = false;
  }

  applyCarry(P, carry) {
    if (carry === 'L' || carry === 'R') {
      const ch = carry === 'L' ? C.ARM_L : C.ARM_R;
      const ik = carry === 'L' ? C.IKH_L : C.IKH_R;
      tuckArm(P, ch);
      P[ik] = 0;
    } else {
      for (const ik of [C.IKH_L, C.IKH_R]) { P[ik] = 1; P[ik + 1] = 0.065; P[ik + 2] = 0.03; P[ik + 3] = 0.27; P[ik + 4] = 0; }
      P[C.ARM_L + 7] = 0.55; P[C.ARM_R + 7] = 0.55;
      for (const pl of [C.POLE_L, C.POLE_R]) { P[pl] = 0.7; P[pl + 1] = -0.5; P[pl + 2] = -0.5; }
    }
  }

  applyEngage(P, clip, carry) {
    const w = this.engW, push = this.engPush;
    P[C.ROOT + 3] += (8 + push * 7) * w;
    P[C.ROOT + 1] -= 0.04 * w;
    P[C.ROOT + 4] += this.engYaw * 0.5 * w;
    P[C.SPINE] += (4 + push * 3) * w;
    P[C.SPINE + 1] += this.engYaw * 0.3 * w;
    P[C.NECK] -= (8 + push * 4) * w;
    const armsFree = !clip || clip.upper === false ? true : !(clip.mask[GI.armL] || clip.mask[GI.handL]);
    if (armsFree) {
      for (let i = 0; i < 2; i++) {
        if ((i === 0 && carry === 'L') || (i === 1 && carry === 'R') || carry === 'two') continue;
        const ik = i === 0 ? C.IKH_L : C.IKH_R, pl = i === 0 ? C.POLE_L : C.POLE_R, ar = i === 0 ? C.ARM_L : C.ARM_R;
        const reachZ = 0.4 + push * 0.06;
        P[ik + 1] = P[ik] > 0 ? P[ik + 1] + (0.12 - P[ik + 1]) * w : 0.12;
        P[ik + 2] = P[ik] > 0 ? P[ik + 2] + (0.1 - P[ik + 2]) * w : 0.1;
        P[ik + 3] = P[ik] > 0 ? P[ik + 3] + (reachZ - P[ik + 3]) * w : reachZ;
        P[ik + 4] = 0;
        P[ik] = Math.max(P[ik], w);
        P[pl] = 0.3; P[pl + 1] = -1; P[pl + 2] = -0.3;
        P[ar + 4] = -45; P[ar + 7] = 0.35;
      }
    }
  }

  // ---------------------------------------------------------------- IK

  legIK(P, i) {
    const ch = i === 0 ? C.IKF_L : C.IKF_R;
    const w = P[ch];
    if (w <= 0.001) return;
    const d = this.dims, s = d.s;
    const sg = i === 0 ? 1 : -1;
    const th = i === 0 ? B.thighL : B.thighR, sh = i === 0 ? B.shinL : B.shinR, ft = i === 0 ? B.footL : B.footR, to = i === 0 ? B.toeL : B.toeR;
    const x = sg * P[ch + 1] * s, y = P[ch + 2] * s, z = P[ch + 3] * s;
    const pitch = P[ch + 4] * D2R, yaw = sg * P[ch + 5] * D2R;
    // desired foot rotation (model space)
    const qy = _q1.set(0, Math.sin(yaw / 2), 0, Math.cos(yaw / 2));
    const qf = _q2.set(Math.sin(pitch / 2), 0, 0, Math.cos(pitch / 2)).premultiply(qy);
    // ankle target: pivot about the ball (heel up) or the heel (toes up)
    const ah = d.ankleH;
    const A0 = _target.set(x, y + ah, z);
    if (pitch > 0) {
      _v1.set(0, -ah, d.ballZ).applyQuaternion(qy).add(A0);     // ball bottom, flat
      _v2.set(0, -ah, d.ballZ).applyQuaternion(qf);
      A0.copy(_v1).sub(_v2);
    } else if (pitch < 0) {
      _v1.set(0, -ah, -d.heelZ).applyQuaternion(qy).add(A0);
      _v2.set(0, -ah, -d.heelZ).applyQuaternion(qf);
      A0.copy(_v1).sub(_v2);
    }
    // knee pole: in the hips' yaw frame
    const ry = P[C.ROOT + 4] * D2R;
    const kn = i === 0 ? C.KNEE_L : C.KNEE_R;
    const px = sg * P[kn], pz = P[kn + 2];
    _pole.set(px * Math.cos(ry) + pz * Math.sin(ry), P[kn + 1], -px * Math.sin(ry) + pz * Math.cos(ry));
    // solve into scratch, then blend with FK by w
    twoBoneIK(this.pos[th], A0, _pole, d.thigh, d.shin, this.rot[B.hips], true, _q3, _qI);
    if (w >= 0.999) { this.local[th].copy(_q3); this.local[sh].copy(_qI); }
    else { this.local[th].slerp(_q3, w); this.local[sh].slerp(_qI, w); }
    fkChain(d, this.local, this.rot, this.pos, th, sh);
    // foot: desired model rotation relative to the shin
    _q3.copy(this.rot[sh]).invert().multiply(qf);
    if (w >= 0.999) this.local[ft].copy(_q3); else this.local[ft].slerp(_q3, w);
    // toes stay flat on the ground while the heel peels
    const onGround = 1 - sstep(0.025 * s, 0.09 * s, y);
    const toeBend = (-Math.max(0, P[ch + 4]) * onGround + P[(i === 0 ? C.LEG_L : C.LEG_R) + 5] * (1 - onGround)) * D2R;
    _q3.set(Math.sin(toeBend / 2), 0, 0, Math.cos(toeBend / 2));
    if (w >= 0.999) this.local[to].copy(_q3); else this.local[to].slerp(_q3, w);
    fkChain(d, this.local, this.rot, this.pos, th, to);
  }

  /** World (yards) → model space (metres) for this frame's A. */
  toModel(A, p, out) {
    const h = A.heading || 0;
    const dx = (p.x - (A.x || 0)) * YARD_M, dy = (p.y || 0) * YARD_M, dz = (p.z - (A.z || 0)) * YARD_M;
    out.set(dx * Math.cos(h) - dz * Math.sin(h), dy, dx * Math.sin(h) + dz * Math.cos(h));
    return out;
  }

  lookAt(A, clip, dt) {
    const want = A.look ? (clip ? clip.look : 1) : 0;
    this.lookW = damp(this.lookW, want, 6, dt);
    if (this.lookW < 0.005) return;
    if (A.look) {
      this.toModel(A, A.look, _v1);
      _v1.sub(this.pos[B.neck]);
      _q1.copy(this.rot[B.chest]).invert();
      _v1.applyQuaternion(_q1);
      const yaw = clamp(Math.atan2(_v1.x, _v1.z) * R2D, -80, 80);
      const pit = clamp(Math.atan2(-_v1.y, Math.hypot(_v1.x, _v1.z)) * R2D, -60, 55);
      this.lookYaw = damp(this.lookYaw, yaw, 12, dt);
      this.lookPitch = damp(this.lookPitch, pit, 12, dt);
    }
    const w = this.lookW;
    qSpine(_q1, this.lookPitch * 0.4, this.lookYaw * 0.45, 0);
    qSpine(_q2, this.lookPitch * 0.6, this.lookYaw * 0.55, 0);
    this.local[B.neck].slerp(_q1, w);
    this.local[B.head].slerp(_q2, w);
    fkChain(this.dims, this.local, this.rot, this.pos, B.neck, B.head);
  }

  reach(A, clip, act, P, dt) {
    // envelope: clip-defined around its key moment, otherwise on whenever the sim gives a point
    let env = 0;
    if (A.reach) {
      if (clip && clip.reach) {
        const t = act.t || 0, [a, b, c, e] = clip.reach;
        env = t < b ? sstep(a, b, t) : 1 - sstep(c, e, t);
      } else if (!clip) env = 1;
    }
    const both = !clip || clip.reachHands !== 'side';
    for (let i = 0; i < 2; i++) {
      const handSide = i === 0 ? 'L' : 'R';
      const on = both || handSide === this.side;
      const ballHand = (this.carry === 'L' && i === 0) || (this.carry === 'R' && i === 1);
      const target = on && !(ballHand && !clip) ? env : 0;
      this.reachW[i] = clip ? target : damp(this.reachW[i], target, 9, dt);
    }
    this.reachPt = A.reach ? this.toModel(A, A.reach, this._reachPt || (this._reachPt = new THREE.Vector3())) : null;
  }

  armIK(P, i) {
    const d = this.dims, s = d.s;
    const ch = i === 0 ? C.IKH_L : C.IKH_R;
    const sg = i === 0 ? 1 : -1;
    let w = P[ch];
    const rw = this.reachPt ? this.reachW[i] : 0;
    if (w <= 0.001 && rw <= 0.001) return;
    const ua = i === 0 ? B.armL : B.armR, fa = i === 0 ? B.foreL : B.foreR, cl = i === 0 ? B.clavL : B.clavR;
    // authored target → model space
    const T = _target;
    if (w > 0.001) {
      const x = sg * P[ch + 1] * s, y = P[ch + 2] * s, z = P[ch + 3] * s, space = P[ch + 4];
      if (space < 0.5) T.set(x, y, z).applyQuaternion(this.rot[B.chest]).add(this.pos[B.chest]);
      else if (space < 1.5) T.set(x, y, z);
      else if (space < 2.5) T.set(x, y, z).add(this.pos[i === 0 ? B.shinL : B.shinR]);
      else T.set(x, y, z).applyQuaternion(this.rot[B.head]).add(this.pos[B.head]);
    } else {
      T.copy(this.pos[i === 0 ? B.handL : B.handR]);
    }
    // reach: pull the wrist to where the ball will be (palms either side of it)
    if (rw > 0.001) {
      const R = this.reachPt;
      _v2.subVectors(this.pos[ua], R).normalize();
      _v3.set(sg, 0, 0).applyQuaternion(this.rot[B.chest]);
      _v4.copy(R).addScaledVector(_v2, 0.085 * s).addScaledVector(_v3, 0.075 * s);
      T.lerp(_v4, rw);
      w = Math.max(w, rw);
    }
    // elbow pole (chest frame, x outward)
    const pl = i === 0 ? C.POLE_L : C.POLE_R;
    _pole.set(sg * P[pl], P[pl + 1], P[pl + 2]).applyQuaternion(this.rot[B.chest]);
    twoBoneIK(this.pos[ua], T, _pole, d.upperArm, d.foreArm, this.rot[cl], false, _q3, _q1);
    if (w >= 0.999) { this.local[ua].copy(_q3); this.local[fa].copy(_q1); }
    else { this.local[ua].slerp(_q3, w); this.local[fa].slerp(_q1, w); }
    fkChain(d, this.local, this.rot, this.pos, ua, ua + 3);
  }

  // ---------------------------------------------------------------- transitions

  startTransition(clip) {
    // offset = previous output relative to this frame's new pose; decays to zero
    for (let i = 0; i < NB; i++) {
      this.off[i].copy(this.local[i]).invert().premultiply(this.prev[i]);
      // keep the short way round
      if (this.off[i].w < 0) { this.off[i].x *= -1; this.off[i].y *= -1; this.off[i].z *= -1; this.off[i].w *= -1; }
    }
    this.offHips.subVectors(this.prevHips, this.hips);
    this.offT = 0;
    this.offDur = clip && clip.dur < 0.45 ? 0.1 : 0.16;
  }

  applyTransition(dt) {
    if (this.offT < 1) {
      this.offT = Math.min(1, this.offT + dt / this.offDur);
      const x = this.offT;
      const k = (1 - x) * (1 - x) * (1 + 2 * x);     // smooth decay 1 → 0
      for (let i = 0; i < NB; i++) {
        _q1.identity().slerp(this.off[i], k);
        this.out[i].multiplyQuaternions(_q1, this.local[i]);
      }
      this.outHips.copy(this.hips).addScaledVector(this.offHips, k);
    } else {
      for (let i = 0; i < NB; i++) this.out[i].copy(this.local[i]);
      this.outHips.copy(this.hips);
    }
    for (let i = 0; i < NB; i++) this.prev[i].copy(this.out[i]);
    this.prevHips.copy(this.outHips);
  }

  /** Write the final pose into three.js bones. */
  writeBones(bones) {
    for (let i = 0; i < NB; i++) bones[i].quaternion.copy(this.out[i]);
    bones[0].position.copy(this.outHips);
  }
}
