// Poses as flat Float32Arrays of authoring channels (degrees, metres), so
// clips, bases and locomotion can be sampled, blended and mirrored without
// allocating. Limb channels are side-relative (positive = the same anatomical
// motion on either side), so mirroring a pose is a swap plus a few sign flips
// on the trunk.
//
//   ROOT  [x, y, z, pitch, yaw, roll]      y = offset from standing hips height
//   SPINE / CHEST / NECK / HEAD [flex, twist, side]
//   CLAV_L/R [elev, protract]
//   ARM_L/R  [elev, plane, twist, elbow, wflex, wdev, pronate, fingers]
//   LEG_L/R  [flex, abd, twist, knee, ankle, toe]
//   IKH_L/R  [w, x, y, z, space]   wrist target. space 0 = chest frame, 1 = model, 2 = knee, 3 = head
//                                   (x is side-relative: + = outward)
//   POLE_L/R [x, y, z]              elbow direction in the chest frame (x outward)
//   IKF_L/R  [w, x, y, z, pitch, yaw] foot target in model space: x outward, y = lowest point of the
//                                   foot above the ground, pitch + = heel up, yaw + = toe out
//   KNEE_L/R [x, y, z]              knee direction in model space (x outward)
import * as THREE from 'three';
import { NB, B, qRoot, qSpine, qClav, qUpperArm, qForearm, qHand, qFingers, qThigh, qShin, qFoot, qToe } from './rig.js';

export const C = {
  ROOT: 0, SPINE: 6, CHEST: 9, NECK: 12, HEAD: 15, CLAV_L: 18, CLAV_R: 20,
  ARM_L: 22, ARM_R: 30, LEG_L: 38, LEG_R: 44,
  IKH_L: 50, IKH_R: 55, POLE_L: 60, POLE_R: 63, IKF_L: 66, IKF_R: 72, KNEE_L: 78, KNEE_R: 81,
};
export const NCH = 84;

// channel groups: [start, length]
export const G = {
  root: [C.ROOT, 6], spine: [C.SPINE, 3], chest: [C.CHEST, 3], neck: [C.NECK, 3], head: [C.HEAD, 3],
  clavL: [C.CLAV_L, 2], clavR: [C.CLAV_R, 2], armL: [C.ARM_L, 8], armR: [C.ARM_R, 8],
  legL: [C.LEG_L, 6], legR: [C.LEG_R, 6], handL: [C.IKH_L, 5], handR: [C.IKH_R, 5],
  poleL: [C.POLE_L, 3], poleR: [C.POLE_R, 3], footL: [C.IKF_L, 6], footR: [C.IKF_R, 6],
  kneeL: [C.KNEE_L, 3], kneeR: [C.KNEE_R, 3],
};
export const GROUPS = Object.keys(G);
export const GI = Object.fromEntries(GROUPS.map((g, i) => [g, i]));
export const UPPER = ['spine', 'chest', 'neck', 'head', 'clavL', 'clavR', 'armL', 'armR', 'handL', 'handR', 'poleL', 'poleR'];
export const LOWER = ['root', 'legL', 'legR', 'footL', 'footR', 'kneeL', 'kneeR'];
export const MIRROR_GROUP = {
  clavL: 'clavR', clavR: 'clavL', armL: 'armR', armR: 'armL', legL: 'legR', legR: 'legL', handL: 'handR', handR: 'handL',
  poleL: 'poleR', poleR: 'poleL', footL: 'footR', footR: 'footL', kneeL: 'kneeR', kneeR: 'kneeL',
};
// per-channel group index (for masks), flat group tables for the hot paths
export const CH_GROUP = new Int8Array(NCH);
for (const [name, [s, n]] of Object.entries(G)) for (let i = 0; i < n; i++) CH_GROUP[s + i] = GI[name];
export const GSTART = Int16Array.from(GROUPS.map((g) => G[g][0]));
export const GLEN = Int16Array.from(GROUPS.map((g) => G[g][1]));
const MIRROR_PAIRS = Int16Array.from(Object.entries(MIRROR_GROUP).flatMap(([a, b]) => [G[a][0], G[b][0], G[a][1]]));
const TRUNK = Int16Array.from(['spine', 'chest', 'neck', 'head'].map((g) => G[g][0]));

/** The neutral pose: standing straight, arms hanging, no IK. */
export function neutral(out = new Float32Array(NCH)) {
  out.fill(0);
  for (const p of [C.POLE_L, C.POLE_R]) { out[p] = 0.45; out[p + 1] = -0.45; out[p + 2] = -0.77; }
  for (const k of [C.KNEE_L, C.KNEE_R]) { out[k] = 0.12; out[k + 1] = 0; out[k + 2] = 1; }
  return out;
}

// IK groups: start, length, index of the space channel (−1: none)
const IKG = Int16Array.from([C.IKH_L, 5, 4, C.IKH_R, 5, 4, C.IKF_L, 6, -1, C.IKF_R, 6, -1]);

/**
 * out = a·(1−t) + b·t. IK targets average weighted by their IK weights; the
 * space of the dominant side wins. `mask` (Uint8Array per group) limits which
 * groups take b (others copy a).
 */
export function blend(out, a, b, t, mask = null) {
  if (t <= 0) { if (out !== a) out.set(a); return out; }
  for (let i = 0; i < NCH; i++) {
    if (mask && !mask[CH_GROUP[i]]) { out[i] = a[i]; continue; }
    out[i] = a[i] + (b[i] - a[i]) * t;
  }
  for (let g = 0; g < 12; g += 3) {
    const s = IKG[g], n = IKG[g + 1], sp = IKG[g + 2];
    if (mask && !mask[CH_GROUP[s]]) continue;
    const wa = a[s] * (1 - t), wb = b[s] * t;
    const ws = wa + wb;
    if (ws > 1e-5) {
      for (let k = 1; k < n; k++) {
        if (k === sp) continue;
        out[s + k] = (a[s + k] * wa + b[s + k] * wb) / ws;
      }
      if (sp > 0) out[s + sp] = wa >= wb ? a[s + sp] : b[s + sp];
    }
  }
  return out;
}

const _tmp = new Float32Array(NCH);
/** Mirror a pose left ↔ right (in place safe). */
export function mirror(out, a) {
  const t = _tmp;
  t.set(a);
  for (let k = 0; k < MIRROR_PAIRS.length; k += 3) {
    const s = MIRROR_PAIRS[k], s2 = MIRROR_PAIRS[k + 1], n = MIRROR_PAIRS[k + 2];
    for (let i = 0; i < n; i++) out[s + i] = t[s2 + i];
  }
  const r = C.ROOT;
  out[r] = -t[r]; out[r + 1] = t[r + 1]; out[r + 2] = t[r + 2]; out[r + 3] = t[r + 3]; out[r + 4] = -t[r + 4]; out[r + 5] = -t[r + 5];
  for (let k = 0; k < TRUNK.length; k++) {
    const s = TRUNK[k];
    out[s] = t[s]; out[s + 1] = -t[s + 1]; out[s + 2] = -t[s + 2];
  }
  return out;
}

/** Euler channels → local bone quaternions + hips position offset (metres, scaled by sH). */
export function poseToLocal(p, local, hipsPos, dims) {
  const s = dims.s;
  hipsPos.set(p[C.ROOT] * s, dims.hipsY + p[C.ROOT + 1] * s, p[C.ROOT + 2] * s);
  qRoot(local[B.hips], p[C.ROOT + 3], p[C.ROOT + 4], p[C.ROOT + 5]);
  qSpine(local[B.spine], p[C.SPINE], p[C.SPINE + 1], p[C.SPINE + 2]);
  qSpine(local[B.chest], p[C.CHEST], p[C.CHEST + 1], p[C.CHEST + 2]);
  qSpine(local[B.neck], p[C.NECK], p[C.NECK + 1], p[C.NECK + 2]);
  qSpine(local[B.head], p[C.HEAD], p[C.HEAD + 1], p[C.HEAD + 2]);
  for (let side = 0; side < 2; side++) {
    const sg = side === 0 ? 1 : -1;
    const cl = side === 0 ? C.CLAV_L : C.CLAV_R, ar = side === 0 ? C.ARM_L : C.ARM_R, lg = side === 0 ? C.LEG_L : C.LEG_R;
    qClav(local[side === 0 ? B.clavL : B.clavR], sg, p[cl], p[cl + 1]);
    qUpperArm(local[side === 0 ? B.armL : B.armR], sg, p[ar], p[ar + 1], p[ar + 2]);
    qForearm(local[side === 0 ? B.foreL : B.foreR], p[ar + 3]);
    qHand(local[side === 0 ? B.handL : B.handR], sg, p[ar + 4], p[ar + 5], p[ar + 6]);
    qFingers(local[side === 0 ? B.fingL : B.fingR], sg, p[ar + 7]);
    qThigh(local[side === 0 ? B.thighL : B.thighR], sg, p[lg], p[lg + 1], p[lg + 2]);
    qShin(local[side === 0 ? B.shinL : B.shinR], p[lg + 3]);
    qFoot(local[side === 0 ? B.footL : B.footR], sg, p[lg + 4]);
    qToe(local[side === 0 ? B.toeL : B.toeR], p[lg + 5]);
  }
}

export function makeQuatArray() {
  const a = new Array(NB);
  for (let i = 0; i < NB; i++) a[i] = new THREE.Quaternion();
  return a;
}
export function makeVecArray() {
  const a = new Array(NB);
  for (let i = 0; i < NB; i++) a[i] = new THREE.Vector3();
  return a;
}
