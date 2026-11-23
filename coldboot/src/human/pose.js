// Posing. A pose is a map bone → op, evaluated in one pass over the skeleton
// (parents first), in "character space" (the person's own frame: +Y up, +Z
// forward, +X the person's left):
//   { e: [x, y, z] }          local Euler degrees on top of the rest pose
//                             (spine/neck/head: x = bend forward, y = twist,
//                             z = lean to the person's right)
//   { aim: [x, y, z], tw }    point the bone (head → tail) along a direction,
//                             swinging from wherever its parent left it, then
//                             twist tw degrees about itself
//   { cq: Quaternion }        exact character-space rotation (IK, look-at)
// plus `root: { p: [x,y,z], e: [...] }` to move/rotate the hips.
// Poses blend with blendPoses(): every op is resolved to a local quaternion.
import * as THREE from 'three';

const D2R = Math.PI / 180;
const _e = new THREE.Euler();
const _q = new THREE.Quaternion();
const _q2 = new THREE.Quaternion();
const _v = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const Y = new THREE.Vector3(0, 1, 0);

export class PoseRig {
  constructor(ch) {
    this.ch = ch;
    this.list = ch.rig.bones;                 // topological order
    this.index = ch.hm.boneIndex;
    this.parent = ch.hm.bones.map((b) => (b.parent ? this.index[b.parent] : -1));
    this.restQ = this.list.map((b) => b.userData.restQ.clone());
    this.restP = this.list.map((b) => b.userData.restP.clone());
    this.charQ = this.list.map(() => new THREE.Quaternion());
    this.localQ = this.list.map((b) => b.userData.restQ.clone());
    this.rootP = this.restP[this.index.root].clone();
    this.n = this.list.length;
  }

  /** Resolve a pose spec into local quaternions (this.localQ) and root position. */
  resolve(pose = {}) {
    const lq = this.localQ, cq = this.charQ;
    for (let i = 0; i < this.n; i++) {
      const name = this.list[i].name;
      const op = pose[name];
      const p = this.parent[i];
      lq[i].copy(this.restQ[i]);
      if (op && op.e) {
        _e.set(op.e[0] * D2R, op.e[1] * D2R, op.e[2] * D2R, 'XYZ');
        lq[i].multiply(_q.setFromEuler(_e));
      }
      if (p >= 0) cq[i].multiplyQuaternions(cq[p], lq[i]);
      else cq[i].copy(lq[i]);
      if (op && (op.aim || op.cq)) {
        if (op.cq) {
          cq[i].copy(op.cq);
        } else {
          _v.copy(Y).applyQuaternion(cq[i]);
          _v2.set(op.aim[0], op.aim[1], op.aim[2]).normalize();
          _q.setFromUnitVectors(_v, _v2);
          cq[i].premultiply(_q);
        }
        if (op.tw) cq[i].multiply(_q2.setFromAxisAngle(Y, op.tw * D2R));
        // back to local
        if (p >= 0) lq[i].copy(cq[p]).invert().multiply(cq[i]);
        else lq[i].copy(cq[i]);
      }
    }
    const r = pose.root;
    this.rootP.copy(this.restP[this.index.root]);
    if (r && r.p) this.rootP.x += r.p[0], this.rootP.y += r.p[1], this.rootP.z += r.p[2];
    return this;
  }

  /** Write the resolved pose onto the bones. */
  apply() {
    for (let i = 0; i < this.n; i++) this.list[i].quaternion.copy(this.localQ[i]);
    this.list[this.index.root].position.copy(this.rootP);
  }

  snapshot() {
    return { q: this.localQ.map((q) => q.clone()), p: this.rootP.clone() };
  }
}

/** Blend resolved snapshots: layers = [{snap, w, mask?: Set of bone indices}] (in order, later on top). */
export function blendInto(rig, layers) {
  const lq = rig.localQ;
  let first = true;
  for (const L of layers) {
    if (L.w <= 0) continue;
    for (let i = 0; i < rig.n; i++) {
      if (L.mask && !L.mask.has(i)) continue;
      if (first && !L.mask) lq[i].copy(L.snap.q[i]);
      else lq[i].slerp(L.snap.q[i], L.w);
    }
    if (!L.mask) {
      if (first) rig.rootP.copy(L.snap.p); else rig.rootP.lerp(L.snap.p, L.w);
    }
    first = false;
  }
}

/** Bone index sets for masked layers. */
export function boneMask(rig, roots) {
  const set = new Set();
  const kids = rig.list.map(() => []);
  rig.parent.forEach((p, i) => { if (p >= 0) kids[p].push(i); });
  const add = (i) => { set.add(i); for (const k of kids[i]) add(k); };
  for (const r of roots) if (rig.index[r] !== undefined) add(rig.index[r]);
  return set;
}

// ------------------------------------------------------------------ helpers
const FINGERS = ['finger1', 'finger2', 'finger3', 'finger4', 'finger5'];

/** Curl the fingers of one hand: 0 open … 1 fist. thumb separately. */
export function handCurl(pose, side, curl = 0.3, thumb = 0.25, spread = 0) {
  for (let f = 0; f < 5; f++) {
    for (let s = 1; s <= 3; s++) {
      const name = `${FINGERS[f]}-${s}.${side}`;
      const c = f === 0 ? thumb : curl;
      const amt = f === 0 ? [20, 25, 20][s - 1] : [55, 80, 55][s - 1];
      pose[name] = { e: [c * amt, 0, s === 1 && f > 0 ? (f - 2.5) * spread * 6 * (side === 'L' ? -1 : 1) : 0] };
    }
  }
  return pose;
}

/** A relaxed standing pose (the base of idles). sideL/R mirrored by sign. */
export function standPose(o = {}) {
  const armOut = o.armOut ?? 0.13;
  const elbow = o.elbow ?? 0.16;
  const pose = {
    'upperarm01.L': { aim: [armOut, -1, 0.03] },
    'upperarm01.R': { aim: [-armOut, -1, 0.03] },
    'lowerarm01.L': { aim: [armOut * 0.6, -1, elbow], tw: o.palmL ?? -10 },
    'lowerarm01.R': { aim: [-armOut * 0.6, -1, elbow], tw: o.palmR ?? 10 },
    'wrist.L': { e: [8, 0, -6] },
    'wrist.R': { e: [8, 0, 6] },
    'upperleg01.L': { aim: [-0.035, -1, 0.02] },
    'upperleg01.R': { aim: [0.035, -1, 0.02] },
    'lowerleg01.L': { aim: [-0.01, -1, -0.04] },
    'lowerleg01.R': { aim: [0.01, -1, -0.04] },
    'foot.L': { aim: [0.12, -0.45, 1] },
    'foot.R': { aim: [-0.12, -0.45, 1] },
  };
  handCurl(pose, 'L', o.curl ?? 0.32, 0.3);
  handCurl(pose, 'R', o.curl ?? 0.32, 0.3);
  return pose;
}
