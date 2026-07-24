// The shared clip library: every animation a fighter needs, hand-keyed once and
// reused by all twelve mascots. Character files override the handful of clips
// that give them their identity (usually the four specials and a smash).
//
// Clip durations are nominal — the fighter re-times attack clips to the move's
// exact frame count when it plays them, so frame data and animation never drift.
import { P, clip, mirrorPose, emptyPose } from './anim.js';

// ---------------------------------------------------------------- base poses
const STAND = P({
  shL: [2, 0, -12], shR: [2, 0, 12], elL: [-18, 0, 0], elR: [-18, 0, 0],
});

/** The neutral fighting stance: knees bent, hands up, slightly bladed. */
const FIGHT = P({
  y: -0.07,
  hipL: [-10, 0, -4], hipR: [-6, 0, 5], kneeL: [20, 0, 0], kneeR: [14, 0, 0],
  torso: [7, -8, 0], head: [-5, 6, 0],
  shL: [-14, 0, -26], elL: [-52, 0, 0],
  shR: [-20, 0, 22], elR: [-58, 0, 0],
});

const CROUCH = P({
  y: -0.42,
  hipL: [-52, 0, -8], hipR: [-48, 0, 9], kneeL: [86, 0, 0], kneeR: [82, 0, 0],
  torso: [22, -6, 0], head: [-16, 4, 0],
  shL: [-8, 0, -40], elL: [-74, 0, 0], shR: [-12, 0, 38], elR: [-78, 0, 0],
});

const AIR = P({
  hipL: [-24, 0, -8], hipR: [8, 0, 8], kneeL: [42, 0, 0], kneeR: [16, 0, 0],
  torso: [4, -6, 0], head: [-6, 0, 0],
  shL: [-40, 0, -34], elL: [-40, 0, 0], shR: [-52, 0, 30], elR: [-36, 0, 0],
});

function walkFrames(a) {
  const contact = P({
    y: -0.05 - a.bob,
    hipL: [-a.thigh, 0, -4], kneeL: [a.knee * 0.3, 0, 0],
    hipR: [a.thigh * 0.6, 0, 5], kneeR: [a.knee * 0.55, 0, 0],
    torso: [a.lean, -6, 0], head: [-a.lean * 0.6, 4, 0],
    shR: [-a.arm, 0, 16], elR: [-a.elbow, 0, 0],
    shL: [a.arm * 0.8, 0, -16], elL: [-a.elbow * 0.6, 0, 0],
  });
  const pass = P({
    y: -0.03 + a.bob,
    hipL: [4, 0, -4], kneeL: [10, 0, 0],
    hipR: [-a.thigh * 0.35, 0, 6], kneeR: [a.knee, 0, 0],
    torso: [a.lean, -6, 0], head: [-a.lean * 0.6, 4, 0],
    shR: [-a.arm * 0.25, 0, 18], elR: [-a.elbow * 0.8, 0, 0],
    shL: [a.arm * 0.2, 0, -18], elL: [-a.elbow * 0.8, 0, 0],
  });
  return [[0, contact], [0.25, pass], [0.5, mirrorPose(contact)], [0.75, mirrorPose(pass)]];
}

// ---------------------------------------------------------------- library
export function makeClips() {
  const C = {};

  // ------------------------------------------------------- idle / locomotion
  C.idle = clip(1.9, true, [
    [0, FIGHT],
    [0.5, P({ y: -0.045, torso: [9, -8, 0], shL: [-11, 0, -28], shR: [-17, 0, 24], head: [-7, 6, 0] }, FIGHT)],
  ]);

  C.stand = clip(3.0, true, [
    [0, STAND],
    [0.5, P({ y: -0.015, torso: [2, 0, 0], shL: [4, 0, -14], shR: [4, 0, 14] }, STAND)],
  ]);

  C.walk = clip(0.62, true, walkFrames({ thigh: 26, knee: 40, lean: 6, arm: 20, elbow: 44, bob: 0.02 }));
  C.run = clip(0.44, true, walkFrames({ thigh: 46, knee: 84, lean: 15, arm: 44, elbow: 78, bob: 0.045 }));
  C.dash = clip(0.34, true, walkFrames({ thigh: 54, knee: 96, lean: 24, arm: 56, elbow: 88, bob: 0.05 }));

  C.skid = clip(0.3, false, [
    [0, P({ y: -0.16, hipL: [22, 0, -6], kneeL: [30, 0, 0], hipR: [-34, 0, 8], kneeR: [56, 0, 0], torso: [-8, -10, 0], shL: [-30, 0, -46], shR: [-24, 0, 44], elL: [-30, 0, 0], elR: [-30, 0, 0] })],
    [1, P({ y: -0.1 }, FIGHT)],
  ]);

  C.turn = clip(0.16, false, [
    [0, P({ torso: [4, 24, 0], head: [-4, -18, 0] }, FIGHT)],
    [1, FIGHT],
  ]);

  C.crouch = clip(1.4, true, [
    [0, CROUCH],
    [0.5, P({ y: -0.39 }, CROUCH)],
  ]);

  // ------------------------------------------------------------------- air
  C.jumpsquat = clip(0.07, false, [
    [0, P({ y: -0.1 }, FIGHT)],
    [1, P({ y: -0.46, hipL: [-56, 0, -8], hipR: [-54, 0, 9], kneeL: [92, 0, 0], kneeR: [90, 0, 0], torso: [26, -4, 0], shL: [30, 0, -30], shR: [26, 0, 28], elL: [-20, 0, 0], elR: [-20, 0, 0] })],
  ]);

  C.jump = clip(0.42, false, [
    [0, P({ y: 0.1, hipL: [-30, 0, -6], hipR: [-10, 0, 7], kneeL: [30, 0, 0], kneeR: [12, 0, 0], torso: [-6, -6, 0], shL: [-96, 0, -26], shR: [-88, 0, 24], elL: [-16, 0, 0], elR: [-16, 0, 0] })],
    [1, AIR],
  ]);

  C.djump = clip(0.5, false, [
    [0, P({ root: [12, 0, 0], hipL: [-70, 0, -6], hipR: [-64, 0, 7], kneeL: [96, 0, 0], kneeR: [92, 0, 0], torso: [16, 0, 0], shL: [-120, 0, -20], shR: [-116, 0, 18], elL: [-30, 0, 0], elR: [-30, 0, 0] })],
    [0.55, P({ root: [-8, 0, 0], hipL: [-20, 0, -6], hipR: [-4, 0, 7], kneeL: [26, 0, 0], kneeR: [10, 0, 0] }, AIR)],
    [1, AIR],
  ]);

  C.fall = clip(1.2, true, [
    [0, AIR],
    [0.5, P({ hipL: [-18, 0, -8], hipR: [12, 0, 8], shL: [-46, 0, -38], shR: [-58, 0, 34], torso: [7, -6, 0] }, AIR)],
  ]);

  C.fastfall = clip(0.5, true, [
    [0, P({ hipL: [-8, 0, -4], hipR: [-4, 0, 5], kneeL: [16, 0, 0], kneeR: [12, 0, 0], torso: [14, 0, 0], head: [-10, 0, 0], shL: [78, 0, -18], shR: [74, 0, 16], elL: [-14, 0, 0], elR: [-14, 0, 0] })],
    [0.5, P({ hipL: [-12, 0, -4], hipR: [-8, 0, 5], torso: [17, 0, 0], shL: [86, 0, -14], shR: [82, 0, 12] })],
  ]);

  C.land = clip(0.14, false, [
    [0, P({ y: -0.34, hipL: [-46, 0, -8], hipR: [-44, 0, 9], kneeL: [80, 0, 0], kneeR: [78, 0, 0], torso: [20, -4, 0], shL: [10, 0, -44], shR: [6, 0, 42], elL: [-40, 0, 0], elR: [-40, 0, 0] })],
    [1, FIGHT],
  ]);

  C.landHeavy = clip(0.3, false, [
    [0, P({ y: -0.52, hipL: [-66, 0, -12], hipR: [-62, 0, 13], kneeL: [104, 0, 0], kneeR: [100, 0, 0], torso: [34, -4, 0], head: [-24, 0, 0], shL: [24, 0, -56], shR: [20, 0, 54], elL: [-58, 0, 0], elR: [-58, 0, 0] })],
    [1, FIGHT],
  ]);

  C.helpless = clip(0.5, true, [
    [0, P({ root: [0, 0, 8], hipL: [-30, 0, -14], hipR: [10, 0, 16], kneeL: [40, 0, 0], kneeR: [20, 0, 0], torso: [-10, 0, 6], head: [8, 0, -6], shL: [-120, 0, -40], shR: [-110, 0, 44], elL: [-40, 0, 0], elR: [-30, 0, 0] })],
    [0.5, P({ root: [0, 0, -8], hipL: [8, 0, -16], hipR: [-28, 0, 14], kneeL: [18, 0, 0], kneeR: [38, 0, 0], torso: [-8, 0, -6], head: [6, 0, 6], shL: [-108, 0, -44], shR: [-124, 0, 40], elL: [-28, 0, 0], elR: [-44, 0, 0] })],
  ]);

  // --------------------------------------------------------------- defense
  C.shield = clip(0.4, true, [
    [0, P({ y: -0.2, hipL: [-30, 0, -6], hipR: [-26, 0, 7], kneeL: [50, 0, 0], kneeR: [46, 0, 0], torso: [14, -14, 0], head: [-8, 8, 0], shL: [-74, 0, -18], elL: [-96, 0, 0], shR: [-70, 0, 16], elR: [-100, 0, 0] })],
    [0.5, P({ y: -0.17, torso: [16, -14, 0] })],
  ]);

  C.shieldBreak = clip(0.9, false, [
    [0, P({ y: -0.05, root: [-14, 0, 0], torso: [-24, 0, 0], head: [26, 0, 0], shL: [-150, 0, -30], shR: [-146, 0, 28], hipL: [-16, 0, -10], hipR: [-12, 0, 11], kneeL: [26, 0, 0], kneeR: [22, 0, 0] })],
    [0.35, P({ y: -0.3, root: [-6, 0, 0], torso: [-10, 0, 0], head: [18, 0, 0], shL: [-100, 0, -46], shR: [-96, 0, 44], hipL: [-40, 0, -12], hipR: [-36, 0, 13], kneeL: [64, 0, 0], kneeR: [60, 0, 0] })],
    [1, P({ y: -0.2, root: [-2, 0, 4], torso: [6, 0, -3], head: [10, 0, 0], shL: [-40, 0, -50], shR: [-36, 0, 48] })],
  ]);

  C.roll = clip(0.53, false, [
    [0, P({ y: -0.3 }, CROUCH)],
    [0.5, P({ y: -0.5, root: [180, 0, 0], hipL: [-90, 0, -8], hipR: [-86, 0, 9], kneeL: [120, 0, 0], kneeR: [116, 0, 0], torso: [40, 0, 0], head: [-30, 0, 0], shL: [-30, 0, -30], shR: [-26, 0, 28], elL: [-90, 0, 0], elR: [-90, 0, 0] })],
    [0.72, P({ y: -0.36, root: [352, 0, 0] }, CROUCH)],
    [1, FIGHT],
  ]);

  C.spotdodge = clip(0.43, false, [
    [0, P({ y: -0.1 }, FIGHT)],
    [0.4, P({ y: -0.48, torso: [16, -40, 0], head: [-10, 30, 0], hipL: [-58, 0, -10], hipR: [-54, 0, 11], kneeL: [96, 0, 0], kneeR: [92, 0, 0], shL: [-20, 0, -52], shR: [-16, 0, 50], elL: [-70, 0, 0], elR: [-70, 0, 0] })],
    [1, FIGHT],
  ]);

  C.airdodge = clip(0.56, false, [
    [0, AIR],
    [0.3, P({ root: [0, 0, 0], hipL: [-80, 0, -6], hipR: [-76, 0, 7], kneeL: [110, 0, 0], kneeR: [106, 0, 0], torso: [30, 0, 0], head: [-24, 0, 0], shL: [-30, 0, -20], shR: [-26, 0, 18], elL: [-110, 0, 0], elR: [-110, 0, 0] })],
    [1, AIR],
  ]);

  // ---------------------------------------------------------- ground attacks
  C.jab1 = clip(0.26, false, [
    [0, P({ torso: [6, -18, 0], shR: [-40, 0, 14], elR: [-96, 0, 0] }, FIGHT)],
    [0.3, P({ y: -0.05, torso: [10, 14, 0], head: [-4, -8, 0], shR: [-84, 0, 8], elR: [-6, 0, 0], shL: [-6, 0, -34], elL: [-70, 0, 0] }, FIGHT)],
    [1, FIGHT],
  ]);

  C.jab2 = clip(0.28, false, [
    [0, P({ torso: [6, 14, 0], shL: [-30, 0, -18], elL: [-96, 0, 0] }, FIGHT)],
    [0.3, P({ y: -0.05, torso: [10, -18, 0], head: [-4, 10, 0], shL: [-86, 0, -8], elL: [-6, 0, 0], shR: [-10, 0, 30], elR: [-72, 0, 0] }, FIGHT)],
    [1, FIGHT],
  ]);

  C.jab3 = clip(0.42, false, [
    [0, P({ y: -0.12, torso: [4, -26, 0], shR: [-30, 0, 26], elR: [-110, 0, 0] }, FIGHT)],
    [0.32, P({ y: -0.16, torso: [16, 22, 0], head: [-8, -14, 0], hipR: [-30, 0, 8], kneeR: [30, 0, 0], shR: [-100, 0, 4], elR: [-8, 0, 0], shL: [26, 0, -40], elL: [-40, 0, 0] })],
    [1, FIGHT],
  ]);

  C.ftilt = clip(0.42, false, [
    [0, P({ y: -0.1, torso: [4, -22, 0], hipR: [-34, 0, 10], kneeR: [70, 0, 0], shR: [-24, 0, 22], elR: [-80, 0, 0] }, FIGHT)],
    [0.3, P({ y: -0.14, torso: [12, 10, 0], head: [-6, -6, 0], hipR: [-52, 0, 6], kneeR: [12, 0, 0], hipL: [8, 0, -4], kneeL: [14, 0, 0], shR: [-30, 0, 30], elR: [-40, 0, 0], shL: [30, 0, -36], elL: [-46, 0, 0] })],
    [1, FIGHT],
  ]);

  C.utilt = clip(0.4, false, [
    [0, P({ y: -0.16, torso: [16, 0, 0], shR: [30, 0, 16], elR: [-30, 0, 0] }, FIGHT)],
    [0.3, P({ y: 0.02, torso: [-14, 0, 0], head: [16, 0, 0], shR: [-170, 0, 8], elR: [-10, 0, 0], shL: [-40, 0, -30], elL: [-60, 0, 0], hipL: [-14, 0, -4], kneeL: [22, 0, 0] })],
    [1, FIGHT],
  ]);

  C.dtilt = clip(0.36, false, [
    [0, P({ y: -0.42, torso: [24, -14, 0], hipR: [-40, 0, 10], kneeR: [80, 0, 0] }, CROUCH)],
    [0.3, P({ y: -0.46, torso: [26, 8, 0], hipR: [-76, 0, 6], kneeR: [16, 0, 0], hipL: [-30, 0, -8], kneeL: [70, 0, 0], shL: [-20, 0, -60], elL: [-40, 0, 0], shR: [40, 0, 30], elR: [-30, 0, 0] })],
    [1, CROUCH],
  ]);

  C.dashAttack = clip(0.5, false, [
    [0, P({ y: -0.2, torso: [26, -10, 0], hipL: [-40, 0, -6], kneeL: [70, 0, 0], shR: [-50, 0, 20], elR: [-90, 0, 0] }, FIGHT)],
    [0.28, P({ y: -0.3, torso: [40, 10, 0], head: [-26, -8, 0], hipL: [-70, 0, -4], kneeL: [20, 0, 0], hipR: [30, 0, 6], kneeR: [40, 0, 0], shR: [-120, 0, 10], elR: [-14, 0, 0], shL: [50, 0, -40], elL: [-30, 0, 0] })],
    [0.7, P({ y: -0.36, torso: [30, 4, 0], hipL: [-30, 0, -6], kneeL: [60, 0, 0] })],
    [1, FIGHT],
  ]);

  // -------------------------------------------------------------- smashes
  // Frame 0 → the charge hold pose (fighters freeze here while charging).
  C.fsmash = clip(0.62, false, [
    [0, P({ y: -0.18, torso: [8, -46, 0], head: [-4, 24, 0], hipR: [-20, 0, 12], kneeR: [40, 0, 0], shR: [-14, 0, 40], elR: [-124, 0, 0], shL: [-40, 0, -20], elL: [-60, 0, 0] }, FIGHT)],
    [0.26, P({ y: -0.24, torso: [18, 30, 0], head: [-10, -18, 0], hipR: [-46, 0, 4], kneeR: [10, 0, 0], hipL: [14, 0, -6], kneeL: [20, 0, 0], shR: [-104, 0, 6], elR: [-6, 0, 0], shL: [40, 0, -44], elL: [-34, 0, 0] })],
    [0.62, P({ y: -0.2, torso: [14, 20, 0], shR: [-84, 0, 10], elR: [-20, 0, 0] })],
    [1, FIGHT],
  ]);

  C.usmash = clip(0.6, false, [
    [0, P({ y: -0.34, torso: [30, 0, 0], head: [-20, 0, 0], hipL: [-50, 0, -8], hipR: [-46, 0, 9], kneeL: [86, 0, 0], kneeR: [82, 0, 0], shL: [40, 0, -24], shR: [36, 0, 22], elL: [-30, 0, 0], elR: [-30, 0, 0] })],
    [0.26, P({ y: 0.08, torso: [-16, 0, 0], head: [18, 0, 0], hipL: [-10, 0, -4], hipR: [-6, 0, 5], kneeL: [14, 0, 0], kneeR: [10, 0, 0], shL: [-176, 0, -10], shR: [-174, 0, 8], elL: [-6, 0, 0], elR: [-6, 0, 0] })],
    [1, FIGHT],
  ]);

  C.dsmash = clip(0.66, false, [
    [0, P({ y: -0.2, torso: [-6, -30, 0], shR: [-70, 0, 40], elR: [-40, 0, 0], shL: [-60, 0, -34], elL: [-40, 0, 0] }, FIGHT)],
    [0.22, P({ y: -0.5, torso: [34, -6, 0], head: [-22, 0, 0], hipL: [-58, 0, -14], hipR: [-54, 0, 15], kneeL: [96, 0, 0], kneeR: [92, 0, 0], shL: [46, 0, -60], shR: [42, 0, 58], elL: [-16, 0, 0], elR: [-16, 0, 0] })],
    [0.5, P({ y: -0.44, torso: [28, 20, 0], shL: [30, 0, -70], shR: [26, 0, 68] })],
    [1, FIGHT],
  ]);

  // -------------------------------------------------------------- aerials
  C.nair = clip(0.5, false, [
    [0, P({ root: [0, 0, 0], hipL: [-50, 0, -14], hipR: [-46, 0, 15], kneeL: [80, 0, 0], kneeR: [76, 0, 0], torso: [16, 0, 0], shL: [-60, 0, -50], shR: [-56, 0, 48], elL: [-50, 0, 0], elR: [-50, 0, 0] })],
    [0.22, P({ hipL: [-14, 0, -40], hipR: [-10, 0, 42], kneeL: [20, 0, 0], kneeR: [16, 0, 0], torso: [-4, 0, 0], shL: [-30, 0, -96], shR: [-26, 0, 94], elL: [-10, 0, 0], elR: [-10, 0, 0] })],
    [1, AIR],
  ]);

  C.fair = clip(0.52, false, [
    [0, P({ root: [-8, 0, 0], torso: [-6, -30, 0], shR: [40, 0, 30], elR: [-100, 0, 0] }, AIR)],
    [0.26, P({ root: [10, 0, 0], torso: [16, 20, 0], head: [-10, -12, 0], shR: [-130, 0, 10], elR: [-10, 0, 0], shL: [50, 0, -40], elL: [-40, 0, 0], hipL: [-40, 0, -8], kneeL: [60, 0, 0] })],
    [1, AIR],
  ]);

  C.bair = clip(0.48, false, [
    [0, P({ torso: [10, 30, 0], head: [-4, -20, 0], shL: [-60, 0, -30], elL: [-90, 0, 0] }, AIR)],
    [0.24, P({ root: [0, 0, 0], torso: [-10, -34, 0], head: [6, 24, 0], hipL: [-14, 0, -6], hipR: [-70, 0, 8], kneeR: [30, 0, 0], shL: [76, 0, -18], elL: [-16, 0, 0], shR: [-40, 0, 40], elR: [-70, 0, 0] })],
    [1, AIR],
  ]);

  C.uair = clip(0.44, false, [
    [0, P({ root: [16, 0, 0], torso: [18, 0, 0], hipL: [-70, 0, -10], hipR: [-66, 0, 11], kneeL: [100, 0, 0], kneeR: [96, 0, 0], shL: [-20, 0, -30], shR: [-16, 0, 28] })],
    [0.26, P({ root: [-18, 0, 0], torso: [-16, 0, 0], head: [16, 0, 0], hipL: [-120, 0, -8], hipR: [-116, 0, 9], kneeL: [20, 0, 0], kneeR: [24, 0, 0], shL: [-150, 0, -16], shR: [-146, 0, 14], elL: [-14, 0, 0], elR: [-14, 0, 0] })],
    [1, AIR],
  ]);

  C.dair = clip(0.58, false, [
    [0, P({ root: [-14, 0, 0], torso: [-10, 0, 0], hipL: [-60, 0, -10], hipR: [-56, 0, 11], kneeL: [90, 0, 0], kneeR: [86, 0, 0], shL: [-140, 0, -20], shR: [-136, 0, 18] })],
    [0.28, P({ root: [26, 0, 0], torso: [24, 0, 0], head: [-18, 0, 0], hipL: [30, 0, -6], hipR: [26, 0, 7], kneeL: [10, 0, 0], kneeR: [8, 0, 0], shL: [60, 0, -26], shR: [56, 0, 24], elL: [-20, 0, 0], elR: [-20, 0, 0] })],
    [1, AIR],
  ]);

  // -------------------------------------------------------- generic specials
  C.nspecial = clip(0.6, false, [
    [0, P({ y: -0.12, torso: [10, -30, 0], shR: [-50, 0, 26], elR: [-110, 0, 0], shL: [-40, 0, -22], elL: [-80, 0, 0] }, FIGHT)],
    [0.34, P({ y: -0.16, torso: [8, 18, 0], head: [-6, -10, 0], shR: [-96, 0, 12], elR: [-24, 0, 0], shL: [-70, 0, -18], elL: [-70, 0, 0] })],
    [1, FIGHT],
  ]);

  C.sspecial = clip(0.66, false, [
    [0, P({ y: -0.2, torso: [-4, -40, 0], hipR: [-30, 0, 12], kneeR: [50, 0, 0], shR: [30, 0, 40], elR: [-100, 0, 0] }, FIGHT)],
    [0.3, P({ y: -0.26, torso: [26, 26, 0], head: [-14, -14, 0], hipL: [-60, 0, -6], kneeL: [30, 0, 0], hipR: [20, 0, 8], kneeR: [30, 0, 0], shR: [-116, 0, 14], elR: [-10, 0, 0], shL: [46, 0, -46], elL: [-30, 0, 0] })],
    [1, FIGHT],
  ]);

  C.uspecial = clip(0.7, false, [
    [0, P({ y: -0.4, torso: [26, 0, 0], hipL: [-56, 0, -8], hipR: [-52, 0, 9], kneeL: [92, 0, 0], kneeR: [88, 0, 0], shL: [30, 0, -20], shR: [26, 0, 18] })],
    [0.22, P({ y: 0.12, root: [-6, 0, 0], torso: [-14, 0, 0], head: [14, 0, 0], hipL: [-6, 0, -4], hipR: [-2, 0, 5], kneeL: [12, 0, 0], kneeR: [8, 0, 0], shL: [-178, 0, -6], shR: [-176, 0, 4], elL: [-4, 0, 0], elR: [-4, 0, 0] })],
    [1, P({ shL: [-150, 0, -18], shR: [-148, 0, 16] }, AIR)],
  ]);

  C.dspecial = clip(0.64, false, [
    [0, P({ y: -0.16, torso: [14, 0, 0], shL: [-70, 0, -30], elL: [-90, 0, 0], shR: [-66, 0, 28], elR: [-90, 0, 0] }, FIGHT)],
    [0.3, P({ y: -0.44, torso: [30, 0, 0], head: [-18, 0, 0], hipL: [-56, 0, -12], hipR: [-52, 0, 13], kneeL: [92, 0, 0], kneeR: [88, 0, 0], shL: [-100, 0, -46], elL: [-56, 0, 0], shR: [-96, 0, 44], elR: [-56, 0, 0] })],
    [1, FIGHT],
  ]);

  C.finisher = clip(1.5, false, [
    [0, P({ y: -0.3, torso: [-20, 0, 0], head: [22, 0, 0], shL: [-160, 0, -40], shR: [-156, 0, 38], hipL: [-30, 0, -12], hipR: [-26, 0, 13], kneeL: [50, 0, 0], kneeR: [46, 0, 0] })],
    [0.3, P({ y: -0.5, torso: [40, 0, 0], head: [-26, 0, 0], shL: [30, 0, -70], shR: [26, 0, 68], elL: [-40, 0, 0], elR: [-40, 0, 0], hipL: [-60, 0, -14], hipR: [-56, 0, 15], kneeL: [100, 0, 0], kneeR: [96, 0, 0] })],
    [0.62, P({ y: -0.1, torso: [-10, 0, 0], shL: [-120, 0, -50], shR: [-116, 0, 48], hipL: [-20, 0, -8], hipR: [-16, 0, 9], kneeL: [30, 0, 0], kneeR: [26, 0, 0] })],
    [1, FIGHT],
  ]);

  // ------------------------------------------------------------ grab / throws
  C.grab = clip(0.5, false, [
    [0, P({ y: -0.1, torso: [8, -20, 0], shL: [-40, 0, -30], shR: [-36, 0, 28], elL: [-90, 0, 0], elR: [-90, 0, 0] }, FIGHT)],
    [0.24, P({ y: -0.14, torso: [14, 10, 0], head: [-6, -6, 0], shL: [-92, 0, -22], shR: [-88, 0, 20], elL: [-14, 0, 0], elR: [-14, 0, 0] })],
    [1, FIGHT],
  ]);

  C.grabHold = clip(0.9, true, [
    [0, P({ y: -0.14, torso: [8, 8, 0], shL: [-86, 0, -24], shR: [-82, 0, 22], elL: [-24, 0, 0], elR: [-24, 0, 0], hipL: [-16, 0, -6], hipR: [-12, 0, 7], kneeL: [26, 0, 0], kneeR: [22, 0, 0] })],
    [0.5, P({ y: -0.1, torso: [11, 8, 0], shL: [-90, 0, -20], shR: [-86, 0, 18] })],
  ]);

  C.pummel = clip(0.26, false, [
    [0, P({ y: -0.14, torso: [8, 14, 0], shL: [-86, 0, -24], shR: [-40, 0, 30], elL: [-24, 0, 0], elR: [-110, 0, 0] })],
    [0.35, P({ y: -0.16, torso: [12, -6, 0], shL: [-88, 0, -22], shR: [-70, 0, 14], elR: [-30, 0, 0] })],
    [1, P({ y: -0.14, torso: [8, 14, 0], shL: [-86, 0, -24], shR: [-40, 0, 30], elL: [-24, 0, 0], elR: [-110, 0, 0] })],
  ]);

  C.throwF = clip(0.46, false, [
    [0, P({ y: -0.16, torso: [-12, -20, 0], shL: [-120, 0, -26], shR: [-116, 0, 24], elL: [-30, 0, 0], elR: [-30, 0, 0] })],
    [0.3, P({ y: -0.2, torso: [24, 24, 0], head: [-14, -12, 0], shL: [-40, 0, -34], shR: [-36, 0, 32], elL: [-12, 0, 0], elR: [-12, 0, 0], hipL: [-40, 0, -6], kneeL: [40, 0, 0] })],
    [1, FIGHT],
  ]);

  C.throwB = clip(0.52, false, [
    [0, P({ y: -0.16, torso: [8, 20, 0], shL: [-96, 0, -24], shR: [-92, 0, 22] })],
    [0.42, P({ y: -0.24, torso: [-6, -70, 0], head: [4, 30, 0], shL: [-60, 0, -40], shR: [-56, 0, 38], elL: [-20, 0, 0], elR: [-20, 0, 0], hipL: [-30, 0, -10], hipR: [20, 0, 11], kneeL: [50, 0, 0] })],
    [1, FIGHT],
  ]);

  C.throwU = clip(0.44, false, [
    [0, P({ y: -0.26, torso: [20, 0, 0], shL: [-70, 0, -20], shR: [-66, 0, 18], hipL: [-40, 0, -8], hipR: [-36, 0, 9], kneeL: [66, 0, 0], kneeR: [62, 0, 0] })],
    [0.28, P({ y: 0.06, torso: [-16, 0, 0], head: [16, 0, 0], shL: [-176, 0, -8], shR: [-174, 0, 6], elL: [-4, 0, 0], elR: [-4, 0, 0], hipL: [-6, 0, -4], hipR: [-2, 0, 5], kneeL: [10, 0, 0], kneeR: [8, 0, 0] })],
    [1, FIGHT],
  ]);

  C.throwD = clip(0.5, false, [
    [0, P({ y: -0.14, torso: [-6, 10, 0], shL: [-110, 0, -24], shR: [-106, 0, 22] })],
    [0.34, P({ y: -0.5, torso: [40, 0, 0], head: [-24, 0, 0], shL: [40, 0, -30], shR: [36, 0, 28], elL: [-20, 0, 0], elR: [-20, 0, 0], hipL: [-60, 0, -12], hipR: [-56, 0, 13], kneeL: [100, 0, 0], kneeR: [96, 0, 0] })],
    [1, FIGHT],
  ]);

  /** The victim's pose while grabbed — arms pinned, feet scrambling. */
  C.held = clip(0.5, true, [
    [0, P({ y: -0.04, torso: [-8, 0, 0], head: [10, 0, 0], shL: [-30, 0, -50], shR: [-26, 0, 48], elL: [-60, 0, 0], elR: [-60, 0, 0], hipL: [-24, 0, -10], hipR: [10, 0, 11], kneeL: [40, 0, 0], kneeR: [16, 0, 0] })],
    [0.5, P({ y: -0.02, torso: [-6, 0, 0], head: [8, 0, 0], shL: [-40, 0, -44], shR: [-36, 0, 42], hipL: [8, 0, -10], hipR: [-22, 0, 11], kneeL: [14, 0, 0], kneeR: [38, 0, 0] })],
  ]);

  // ------------------------------------------------------------- reactions
  C.hitstun = clip(0.4, true, [
    [0, P({ root: [-10, 0, 0], torso: [-22, 0, 6], head: [26, 0, -8], shL: [-130, 0, -40], shR: [-126, 0, 38], elL: [-30, 0, 0], elR: [-30, 0, 0], hipL: [-30, 0, -12], hipR: [-16, 0, 13], kneeL: [40, 0, 0], kneeR: [24, 0, 0] })],
    [0.5, P({ root: [-6, 0, 0], torso: [-18, 0, -6], head: [22, 0, 8], shL: [-120, 0, -46], shR: [-136, 0, 42], hipL: [-18, 0, -12], hipR: [-28, 0, 13], kneeL: [26, 0, 0], kneeR: [38, 0, 0] })],
  ]);

  C.tumble = clip(0.55, true, [
    [0, P({ root: [0, 0, 0], torso: [-16, 0, 0], head: [18, 0, 0], shL: [-140, 0, -50], shR: [-136, 0, 48], hipL: [-40, 0, -14], hipR: [-30, 0, 15], kneeL: [70, 0, 0], kneeR: [56, 0, 0] })],
    [0.25, P({ root: [90, 0, 0], torso: [-10, 0, 0], shL: [-120, 0, -46], shR: [-116, 0, 44], hipL: [-60, 0, -14], hipR: [-50, 0, 15], kneeL: [90, 0, 0], kneeR: [80, 0, 0] })],
    [0.5, P({ root: [180, 0, 0], torso: [-16, 0, 0], hipL: [-40, 0, -14], hipR: [-30, 0, 15], kneeL: [70, 0, 0], kneeR: [56, 0, 0] })],
    [0.75, P({ root: [270, 0, 0], torso: [-10, 0, 0], hipL: [-60, 0, -14], hipR: [-50, 0, 15], kneeL: [90, 0, 0], kneeR: [80, 0, 0] })],
  ]);

  C.downed = clip(0.8, true, [
    [0, P({ y: -0.84, root: [-84, 0, 0], torso: [10, 0, 0], head: [16, 0, 0], shL: [-30, 0, -70], shR: [-26, 0, 68], elL: [-30, 0, 0], elR: [-30, 0, 0], hipL: [-16, 0, -14], hipR: [-12, 0, 15], kneeL: [30, 0, 0], kneeR: [26, 0, 0] })],
    [0.5, P({ y: -0.82, root: [-86, 0, 0], head: [12, 0, 0], shL: [-24, 0, -66], shR: [-20, 0, 64] })],
  ]);

  C.getup = clip(0.55, false, [
    [0, P({ y: -0.84, root: [-84, 0, 0], torso: [10, 0, 0], shL: [-30, 0, -70], shR: [-26, 0, 68], hipL: [-16, 0, -14], hipR: [-12, 0, 15], kneeL: [30, 0, 0], kneeR: [26, 0, 0] })],
    [0.5, P({ y: -0.5, root: [-30, 0, 0], torso: [30, 0, 0], shL: [-10, 0, -40], shR: [-6, 0, 38], elL: [-70, 0, 0], elR: [-70, 0, 0], hipL: [-70, 0, -10], hipR: [-66, 0, 11], kneeL: [104, 0, 0], kneeR: [100, 0, 0] })],
    [1, FIGHT],
  ]);

  C.ledgeHang = clip(1.6, true, [
    [0, P({ y: -0.16, torso: [-6, -10, 0], head: [8, 6, 0], shL: [-172, 0, -12], shR: [-168, 0, 10], elL: [-16, 0, 0], elR: [-16, 0, 0], hipL: [-14, 0, -8], hipR: [4, 0, 9], kneeL: [30, 0, 0], kneeR: [14, 0, 0] })],
    [0.5, P({ y: -0.1, torso: [-4, -10, 0], shL: [-176, 0, -8], shR: [-172, 0, 6], hipL: [-6, 0, -8], hipR: [10, 0, 9], kneeL: [20, 0, 0], kneeR: [10, 0, 0] })],
  ]);

  C.ledgeGetup = clip(0.44, false, [
    [0, P({ y: -0.2, torso: [-6, -10, 0], shL: [-172, 0, -12], shR: [-168, 0, 10], hipL: [-14, 0, -8], hipR: [4, 0, 9], kneeL: [30, 0, 0], kneeR: [14, 0, 0] })],
    [0.5, P({ y: -0.5, torso: [40, 0, 0], head: [-24, 0, 0], shL: [-120, 0, -30], shR: [-116, 0, 28], elL: [-60, 0, 0], elR: [-60, 0, 0], hipL: [-90, 0, -10], hipR: [-80, 0, 11], kneeL: [110, 0, 0], kneeR: [100, 0, 0] })],
    [1, FIGHT],
  ]);

  C.ko = clip(0.7, true, [
    [0, P({ root: [0, 0, 20], torso: [-30, 0, 0], head: [30, 0, 0], shL: [-160, 0, -60], shR: [-156, 0, 58], hipL: [-50, 0, -20], hipR: [-40, 0, 21], kneeL: [80, 0, 0], kneeR: [70, 0, 0] })],
    [0.5, P({ root: [0, 0, -20], torso: [-26, 0, 0], head: [26, 0, 0], shL: [-150, 0, -66], shR: [-166, 0, 54], hipL: [-40, 0, -22], hipR: [-52, 0, 19], kneeL: [66, 0, 0], kneeR: [84, 0, 0] })],
  ]);

  C.entry = clip(0.9, false, [
    [0, P({ y: 0.1, torso: [10, 0, 0], hipL: [-40, 0, -10], hipR: [-36, 0, 11], kneeL: [70, 0, 0], kneeR: [66, 0, 0], shL: [-60, 0, -40], shR: [-56, 0, 38], elL: [-60, 0, 0], elR: [-60, 0, 0] })],
    [0.45, P({ y: -0.44, torso: [30, 0, 0], head: [-20, 0, 0], hipL: [-60, 0, -12], hipR: [-56, 0, 13], kneeL: [100, 0, 0], kneeR: [96, 0, 0], shL: [20, 0, -50], shR: [16, 0, 48], elL: [-30, 0, 0], elR: [-30, 0, 0] })],
    [1, FIGHT],
  ]);

  C.taunt = clip(1.1, false, [
    [0, FIGHT],
    [0.3, P({ y: 0.04, torso: [-14, 0, 0], head: [18, 0, 0], shL: [-170, 0, -30], shR: [-166, 0, 28], elL: [-20, 0, 0], elR: [-20, 0, 0], hipL: [-8, 0, -6], hipR: [-4, 0, 7] })],
    [0.62, P({ y: -0.2, torso: [16, 0, 0], head: [-10, 0, 0], shL: [-40, 0, -60], shR: [-36, 0, 58], elL: [-90, 0, 0], elR: [-90, 0, 0], hipL: [-30, 0, -10], hipR: [-26, 0, 11], kneeL: [50, 0, 0], kneeR: [46, 0, 0] })],
    [1, FIGHT],
  ]);

  C.win = clip(1.6, true, [
    [0, P({ y: -0.06, torso: [-6, -10, 0], head: [8, 8, 0], shL: [-166, 0, -26], shR: [-162, 0, 24], elL: [-24, 0, 0], elR: [-24, 0, 0], hipL: [-10, 0, -6], hipR: [-6, 0, 7], kneeL: [16, 0, 0], kneeR: [12, 0, 0] })],
    [0.5, P({ y: -0.26, torso: [12, 10, 0], head: [-8, -8, 0], shL: [-120, 0, -46], shR: [-116, 0, 44], elL: [-60, 0, 0], elR: [-60, 0, 0], hipL: [-36, 0, -8], hipR: [-32, 0, 9], kneeL: [60, 0, 0], kneeR: [56, 0, 0] })],
  ]);

  C.lose = clip(1.8, true, [
    [0, P({ y: -0.4, torso: [30, 0, 0], head: [-26, 0, 0], shL: [-8, 0, -20], shR: [-4, 0, 18], elL: [-40, 0, 0], elR: [-40, 0, 0], hipL: [-50, 0, -8], hipR: [-46, 0, 9], kneeL: [86, 0, 0], kneeR: [82, 0, 0] })],
    [0.5, P({ y: -0.36, torso: [26, 0, 0], head: [-22, 0, 0], shL: [-4, 0, -16], shR: [0, 0, 14] })],
  ]);

  return C;
}

/** A tiny wobble overlay used while a smash attack is charging. */
export function chargeShake(getAmount) {
  return (pose, anim) => {
    const a = getAmount();
    if (a <= 0) return;
    const t = anim.t * 60;
    const s = Math.sin(t * 2.7) * a;
    pose.torso[2] += s * 2.2;
    pose.head[2] -= s * 1.6;
    pose.y += Math.abs(s) * 0.012;
  };
}

export { STAND, FIGHT, CROUCH, AIR, emptyPose };
