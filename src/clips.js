// The animation library: every clip hand-keyed for the rig.
// Conventions: thigh/shoulder forward swing = -rx · knee flex = +rx · elbow flex = -rx
// chest forward lean = +rx · left arm raised out = -rz (right = +rz)
// body +rx = fall on face · body -rx = fall on back · y = hip height delta
import { P, clip, mirrorPose } from './animation.js';

export const THROW_RELEASE_S = 0.17; // ball leaves hand this far into throwRelease
export const KICK_CONTACT_S = 0.34;

const STAND = P({
  shL: [3, 0, -7], shR: [3, 0, 7], elL: [-12, 0, 0], elR: [-12, 0, 0],
});

const READY = P({
  y: -0.09,
  thighL: [-26, 0, -4], thighR: [-26, 0, 4], kneeL: [44, 0, 0], kneeR: [44, 0, 0],
  ankleL: [-16, 0, 0], ankleR: [-16, 0, 0],
  chest: [16, 0, 0], spine: [7, 0, 0], head: [-14, 0, 0],
  shL: [-18, 0, -10], shR: [-18, 0, 10], elL: [-36, 0, 0], elR: [-36, 0, 0],
}, STAND);

function runFrames(A) {
  // A = amplitude config for run/sprint variants
  const contactL = P({
    y: -0.030,
    thighL: [-A.thigh, 0, 0], kneeL: [16, 0, 0], ankleL: [-8, 0, 0],
    thighR: [A.thighBack, 0, 0], kneeR: [30, 0, 0], ankleR: [24, 0, 0],
    chest: [A.lean, -6, 0], spine: [A.lean * 0.5, 0, 0], hips: [0, 8, -3], head: [-A.lean * 0.7, 0, 0],
    shR: [-A.arm, 0, 6], elR: [-A.elbow - 8, 0, 0],
    shL: [A.arm * 0.82, 0, -6], elL: [-A.elbow * 0.72, 0, 0],
  });
  const passR = P({
    y: 0.022,
    thighL: [4, 0, 0], kneeL: [10, 0, 0], ankleL: [12, 0, 0],
    thighR: [-A.thigh * 0.42, 0, 0], kneeR: [A.kneeUp, 0, 0], ankleR: [6, 0, 0],
    chest: [A.lean, 0, 0], spine: [A.lean * 0.5, 0, 0], hips: [0, 0, 2], head: [-A.lean * 0.7, 0, 0],
    shR: [-A.arm * 0.2, 0, 9], elR: [-A.elbow * 0.8, 0, 0],
    shL: [A.arm * 0.18, 0, -9], elL: [-A.elbow * 0.8, 0, 0],
  });
  return [
    [0, contactL],
    [0.25, passR],
    [0.5, mirrorPose(contactL)],
    [0.75, mirrorPose(passR)],
  ];
}

export function makeClips() {
  const C = {};

  C.idle = clip(2.6, true, [
    [0, P({ chest: [2, 0, 0] }, STAND)],
    [0.5, P({ chest: [4.5, 0, 0], shL: [4, 0, -9], shR: [4, 0, 9], y: -0.012 }, STAND)],
  ]);

  C.ready = clip(1.15, true, [
    [0, READY],
    [0.5, P({ y: -0.105, chest: [18, 0, 0] }, READY)],
  ]);

  C.run = clip(0.58, true, runFrames({ thigh: 48, thighBack: 28, kneeUp: 96, lean: 12, arm: 42, elbow: 96 }));
  C.sprint = clip(0.46, true, runFrames({ thigh: 60, thighBack: 34, kneeUp: 112, lean: 21, arm: 56, elbow: 106 }));
  C.jog = clip(0.72, true, runFrames({ thigh: 32, thighBack: 18, kneeUp: 62, lean: 7, arm: 26, elbow: 78 }));

  // backpedal: upright, legs reaching behind, quick arms low
  {
    const bp0 = P({
      y: -0.055,
      thighL: [22, 0, 0], kneeL: [26, 0, 0], ankleL: [10, 0, 0],
      thighR: [-14, 0, 0], kneeR: [34, 0, 0], ankleR: [-12, 0, 0],
      chest: [-4, 0, 0], spine: [-2, 0, 0], head: [-2, 0, 0],
      shL: [-22, 0, -8], elL: [-70, 0, 0], shR: [10, 0, 8], elR: [-70, 0, 0],
    });
    C.backpedal = clip(0.62, true, [
      [0, bp0], [0.25, P({ y: -0.04 }, READY)], [0.5, mirrorPose(bp0)], [0.75, P({ y: -0.04 }, READY)],
    ]);
  }

  // lateral shuffle (block mirror / DB slide)
  {
    const s0 = P({
      y: -0.10,
      thighL: [-20, 0, -20], thighR: [-20, 0, 8], kneeL: [38, 0, 0], kneeR: [38, 0, 0],
      ankleL: [-14, 0, 0], ankleR: [-14, 0, 0],
      chest: [14, 0, 0], shL: [-60, 0, -16], shR: [-60, 0, 16], elL: [-44, 0, 0], elR: [-44, 0, 0],
    });
    C.shuffle = clip(0.55, true, [
      [0, s0],
      [0.5, P({ thighL: [-20, 0, -6], thighR: [-20, 0, -8], y: -0.085 }, s0)],
    ]);
  }

  // three-point stance
  {
    const tp = P({
      y: -0.30,
      thighL: [-66, 0, -6], thighR: [-74, 0, 8], kneeL: [92, 0, 0], kneeR: [98, 0, 0],
      ankleL: [-24, 0, 0], ankleR: [-26, 0, 0],
      chest: [38, 0, 0], spine: [15, 0, 0], head: [-42, 0, 0],
      shR: [-46, 0, 12], elR: [-6, 0, 0],
      shL: [-38, 0, -14], elL: [-86, 0, 0],
    });
    C.stance3 = clip(1.8, true, [[0, tp], [0.5, P({ chest: [39.5, 0, 0] }, tp)]]);
  }

  // two-point crouch (LB / TE)
  {
    const t2 = P({
      y: -0.16,
      thighL: [-36, 0, -6], thighR: [-36, 0, 6], kneeL: [56, 0, 0], kneeR: [56, 0, 0],
      ankleL: [-19, 0, 0], ankleR: [-19, 0, 0],
      chest: [24, 0, 0], spine: [10, 0, 0], head: [-22, 0, 0],
      shL: [-34, 0, -12], shR: [-34, 0, 12], elL: [-66, 0, 0], elR: [-66, 0, 0],
    });
    C.stance2 = clip(1.5, true, [[0, t2], [0.5, P({ y: -0.175 }, t2)]]);
  }

  // QB under center
  C.qbUnder = clip(1.4, true, [
    [0, P({
      y: -0.13,
      thighL: [-30, 0, -5], thighR: [-30, 0, 5], kneeL: [48, 0, 0], kneeR: [48, 0, 0],
      ankleL: [-17, 0, 0], ankleR: [-17, 0, 0],
      chest: [27, 0, 0], spine: [12, 0, 0], head: [-30, 0, 0],
      shL: [-50, 14, 0], shR: [-50, -14, 0], elL: [-30, 0, 0], elR: [-30, 0, 0],
    })],
    [0.5, P({
      y: -0.135,
      thighL: [-30, 0, -5], thighR: [-30, 0, 5], kneeL: [48, 0, 0], kneeR: [48, 0, 0],
      ankleL: [-17, 0, 0], ankleR: [-17, 0, 0],
      chest: [28, 0, 0], spine: [12, 0, 0], head: [-26, 0, 0],
      shL: [-50, 14, 0], shR: [-50, -14, 0], elL: [-30, 0, 0], elR: [-30, 0, 0],
    })],
  ]);

  // shotgun snap catch
  C.snapCatch = clip(0.3, false, [
    [0, READY],
    [1, P({
      y: -0.08,
      shL: [-72, 16, -6], shR: [-72, -16, 6], elL: [-22, 0, 0], elR: [-22, 0, 0],
      chest: [10, 0, 0], thighL: [-22, 0, -4], thighR: [-22, 0, 4], kneeL: [38, 0, 0], kneeR: [38, 0, 0],
      ankleL: [-14, 0, 0], ankleR: [-14, 0, 0], head: [-8, 0, 0],
    })],
  ]);

  // QB cocked, scanning. Upper arm out-back horizontal (ry+rz), forearm
  // vertical via elbow rz so the ball sits up by the ear.
  const COCKED = P({
    y: -0.06,
    thighL: [-20, 0, -6], kneeL: [26, 0, 0], ankleL: [-10, 0, 0],
    thighR: [12, 0, 8], kneeR: [20, 0, 0], ankleR: [4, 0, 0],
    chest: [6, 26, 0], spine: [2, 10, 0], head: [0, -24, 0],
    shR: [-6, 50, 86], elR: [0, 0, 98],
    shL: [-48, -10, -14], elL: [-18, 0, 0],
  });
  C.throwHold = clip(1.1, true, [
    [0, COCKED],
    [0.5, P({ y: -0.072, shR: [-6, 52, 88], elR: [0, 0, 100] }, COCKED)],
  ]);

  C.throwRelease = clip(0.44, false, [
    [0, COCKED],
    [0.38, P({
      y: -0.05,
      thighL: [-26, 0, -6], kneeL: [12, 0, 0], ankleL: [-10, 0, 0],
      thighR: [26, 0, 8], kneeR: [34, 0, 0], ankleR: [28, 0, 0],
      chest: [10, -22, 0], spine: [4, -8, 0], head: [-6, 4, 0],
      shR: [-148, 0, 14], elR: [-18, 0, 12],
      shL: [22, 0, -10], elL: [-58, 0, 0],
    })],
    [0.8, P({
      y: -0.10,
      thighL: [-30, 0, -6], kneeL: [12, 0, 0], ankleL: [-12, 0, 0],
      thighR: [34, 0, 8], kneeR: [42, 0, 0], ankleR: [32, 0, 0],
      chest: [30, -36, 0], spine: [12, -12, 0], head: [-18, 8, 0],
      shR: [-66, -28, -16], elR: [-22, 0, 0],
      shL: [26, 0, -8], elL: [-62, 0, 0],
    })],
    [1, P({
      y: -0.10,
      thighL: [-30, 0, -6], kneeL: [14, 0, 0], ankleL: [-12, 0, 0],
      thighR: [32, 0, 8], kneeR: [40, 0, 0], ankleR: [30, 0, 0],
      chest: [28, -34, 0], spine: [11, -11, 0], head: [-16, 6, 0],
      shR: [-58, -26, -14], elR: [-24, 0, 0],
      shL: [24, 0, -8], elL: [-60, 0, 0],
    })],
  ]);

  // pitch/handoff: ball offered to the side
  C.handoff = clip(1.0, true, [
    [0, P({
      y: -0.09,
      thighL: [-24, 0, -5], thighR: [-24, 0, 5], kneeL: [40, 0, 0], kneeR: [40, 0, 0],
      ankleL: [-15, 0, 0], ankleR: [-15, 0, 0],
      chest: [12, -30, 0], head: [0, 24, 0],
      shR: [-58, -24, 6], elR: [-12, 0, 0],
      shL: [-50, 28, -6], elL: [-20, 0, 0],
    })],
  ]);

  C.catchHigh = clip(0.5, false, [
    [0, P({ shL: [-30, 0, -10], shR: [-30, 0, 10], elL: [-40, 0, 0], elR: [-40, 0, 0] }, READY)],
    [0.45, P({
      y: 0.02,
      shL: [-150, 0, 16], shR: [-150, 0, -16], elL: [-12, 0, 0], elR: [-12, 0, 0],
      chest: [6, 0, 0], head: [-26, 0, 0],
      thighL: [-12, 0, -4], thighR: [-12, 0, 4], kneeL: [14, 0, 0], kneeR: [14, 0, 0],
    })],
    [1, P({
      y: -0.04,
      shL: [-64, 22, -6], shR: [-64, -22, 6], elL: [-92, 0, 0], elR: [-92, 0, 0],
      chest: [14, 0, 0], head: [-10, 0, 0],
      thighL: [-22, 0, -4], thighR: [-22, 0, 4], kneeL: [34, 0, 0], kneeR: [34, 0, 0],
      ankleL: [-14, 0, 0], ankleR: [-14, 0, 0],
    })],
  ]);

  C.catchLow = clip(0.45, false, [
    [0, READY],
    [0.5, P({
      y: -0.14,
      shL: [-52, 18, -8], shR: [-52, -18, 8], elL: [-28, 0, 0], elR: [-28, 0, 0],
      chest: [30, 0, 0], spine: [12, 0, 0], head: [-22, 0, 0],
      thighL: [-34, 0, -5], thighR: [-34, 0, 5], kneeL: [52, 0, 0], kneeR: [52, 0, 0],
      ankleL: [-18, 0, 0], ankleR: [-18, 0, 0],
    })],
    [1, P({
      y: -0.06,
      shL: [-62, 24, -6], shR: [-62, -24, 6], elL: [-90, 0, 0], elR: [-90, 0, 0],
      chest: [16, 0, 0], thighL: [-24, 0, -4], thighR: [-24, 0, 4], kneeL: [36, 0, 0], kneeR: [36, 0, 0],
      ankleL: [-15, 0, 0], ankleR: [-15, 0, 0],
    })],
  ]);

  // pass-block / drive-block engage
  {
    const blk = P({
      y: -0.115,
      thighL: [-24, 0, -16], thighR: [-24, 0, 16], kneeL: [42, 0, 0], kneeR: [42, 0, 0],
      ankleL: [-16, 0, 0], ankleR: [-16, 0, 0],
      chest: [14, 0, 0], spine: [6, 0, 0], head: [-12, 0, 0],
      shL: [-74, 8, -8], shR: [-74, -8, 8], elL: [-36, 0, 0], elR: [-36, 0, 0],
    });
    C.block = clip(0.7, true, [
      [0, blk],
      [0.5, P({ shL: [-82, 8, -8], shR: [-82, -8, 8], elL: [-28, 0, 0], elR: [-28, 0, 0], y: -0.125, chest: [17, 0, 0] }, blk)],
    ]);
  }

  C.tackleLunge = clip(0.5, false, [
    [0, READY],
    [0.4, P({
      y: -0.16,
      thighL: [-48, 0, -6], thighR: [-48, 0, 6], kneeL: [70, 0, 0], kneeR: [70, 0, 0],
      ankleL: [-22, 0, 0], ankleR: [-22, 0, 0],
      chest: [30, 0, 0], spine: [12, 0, 0], head: [-26, 0, 0],
      shL: [18, 0, -34], shR: [18, 0, 34], elL: [-20, 0, 0], elR: [-20, 0, 0],
    })],
    [1, P({
      y: -0.02, body: [30, 0, 0],
      thighL: [16, 0, -5], thighR: [16, 0, 5], kneeL: [18, 0, 0], kneeR: [18, 0, 0],
      chest: [18, 0, 0], head: [-30, 0, 0],
      shL: [-92, 26, -10], shR: [-92, -26, 10], elL: [-58, 0, 0], elR: [-58, 0, 0],
    })],
  ]);

  C.fallBack = clip(0.62, false, [
    [0, P({}, STAND)],
    [0.38, P({
      y: -0.06, body: [-44, 0, 0],
      thighL: [-26, 0, -6], thighR: [-20, 0, 6], kneeL: [40, 0, 0], kneeR: [34, 0, 0],
      chest: [14, 0, 0], head: [22, 0, 0],
      shL: [-110, 0, -42], shR: [-110, 0, 42], elL: [-28, 0, 0], elR: [-28, 0, 0],
    })],
    [0.78, P({
      y: -0.10, body: [-86, 0, 0],
      thighL: [-14, 0, -7], thighR: [-9, 0, 7], kneeL: [22, 0, 0], kneeR: [16, 0, 0],
      chest: [8, 0, 0], head: [26, 0, 0],
      shL: [-30, 0, -64], shR: [-30, 0, 64], elL: [-18, 0, 0], elR: [-18, 0, 0],
    })],
    [1, P({
      y: -0.115, body: [-88, 0, 0],
      thighL: [-10, 0, -7], thighR: [-6, 0, 7], kneeL: [16, 0, 0], kneeR: [12, 0, 0],
      chest: [6, 0, 0], head: [24, 0, 0],
      shL: [-24, 0, -70], shR: [-24, 0, 70], elL: [-14, 0, 0], elR: [-14, 0, 0],
    })],
  ]);

  C.fallFwd = clip(0.55, false, [
    [0, P({}, STAND)],
    [0.4, P({
      y: -0.04, body: [42, 0, 0],
      thighL: [10, 0, -5], thighR: [14, 0, 5], kneeL: [26, 0, 0], kneeR: [30, 0, 0],
      chest: [16, 0, 0], head: [-30, 0, 0],
      shL: [-120, 0, -26], shR: [-120, 0, 26], elL: [-16, 0, 0], elR: [-16, 0, 0],
    })],
    [1, P({
      y: -0.115, body: [86, 0, 0],
      thighL: [4, 0, -6], thighR: [8, 0, 6], kneeL: [14, 0, 0], kneeR: [18, 0, 0],
      chest: [6, 0, 0], head: [-26, 0, 0],
      shL: [-86, 0, -34], shR: [-86, 0, 34], elL: [-78, 0, 0], elR: [-78, 0, 0],
    })],
  ]);

  C.getUp = clip(0.7, false, [
    [0, P({
      y: -0.10, body: [60, 0, 0],
      thighL: [-30, 0, -6], thighR: [-30, 0, 6], kneeL: [50, 0, 0], kneeR: [50, 0, 0],
      chest: [20, 0, 0], shL: [-90, 0, -20], shR: [-90, 0, 20], elL: [-30, 0, 0], elR: [-30, 0, 0],
    })],
    [0.5, P({
      y: -0.24, body: [12, 0, 0],
      thighL: [-62, 0, -7], thighR: [-62, 0, 7], kneeL: [92, 0, 0], kneeR: [92, 0, 0],
      ankleL: [-24, 0, 0], ankleR: [-24, 0, 0],
      chest: [26, 0, 0], head: [-20, 0, 0],
      shL: [-30, 0, -14], shR: [-30, 0, 14], elL: [-40, 0, 0], elR: [-40, 0, 0],
    })],
    [1, READY],
  ]);

  C.celebrate = clip(0.95, true, [
    [0, P({
      y: -0.10,
      thighL: [-28, 0, -6], thighR: [-28, 0, 6], kneeL: [46, 0, 0], kneeR: [46, 0, 0],
      ankleL: [-16, 0, 0], ankleR: [-16, 0, 0],
      shL: [-20, 0, -20], shR: [-20, 0, 20], elL: [-60, 0, 0], elR: [-60, 0, 0],
      chest: [8, 0, 0],
    })],
    [0.32, P({
      y: 0.16,
      thighL: [6, 0, -7], thighR: [6, 0, 7], kneeL: [10, 0, 0], kneeR: [10, 0, 0],
      ankleL: [22, 0, 0], ankleR: [22, 0, 0],
      shL: [-12, 0, -152], shR: [-12, 0, 152], elL: [-24, 0, 0], elR: [-24, 0, 0],
      chest: [-8, 0, 0], head: [-18, 0, 0],
    })],
    [0.62, P({
      y: -0.06,
      thighL: [-22, 0, -6], thighR: [-22, 0, 6], kneeL: [38, 0, 0], kneeR: [38, 0, 0],
      ankleL: [-15, 0, 0], ankleR: [-15, 0, 0],
      shL: [-10, 0, -140], shR: [-10, 0, 140], elL: [-40, 0, 0], elR: [-40, 0, 0],
      chest: [4, 0, 0],
    })],
  ]);

  C.refTD = clip(2.0, true, [
    [0, P({ shL: [-4, 0, -172], shR: [-4, 0, 172], elL: [-4, 0, 0], elR: [-4, 0, 0], chest: [-3, 0, 0] }, STAND)],
    [0.5, P({ shL: [-6, 0, -174], shR: [-6, 0, 174], elL: [-4, 0, 0], elR: [-4, 0, 0], chest: [-4, 0, 0], y: -0.01 }, STAND)],
  ]);

  C.dejected = clip(3.0, true, [
    [0, P({ chest: [16, 0, 0], head: [34, 0, 0], shL: [6, 0, -3], shR: [6, 0, 3], elL: [-6, 0, 0], elR: [-6, 0, 0] }, STAND)],
    [0.5, P({ chest: [18, 0, 0], head: [36, 0, 0], y: -0.025, shL: [6, 0, -3], shR: [6, 0, 3], elL: [-6, 0, 0], elR: [-6, 0, 0] }, STAND)],
  ]);

  C.cheer = clip(1.25, true, [
    [0, P({ shL: [-20, 0, -150], shR: [-10, 0, 24], elL: [-20, 0, 0], elR: [-70, 0, 0], y: -0.03 }, STAND)],
    [0.5, P({ shR: [-20, 0, 150], shL: [-10, 0, -24], elR: [-20, 0, 0], elL: [-70, 0, 0], y: -0.03 }, STAND)],
  ]);

  C.kick = clip(0.78, false, [
    [0, P({ chest: [10, 0, 0] }, STAND)],
    [0.3, P({
      y: -0.10,
      thighL: [-30, 0, -5], kneeL: [40, 0, 0], ankleL: [-16, 0, 0],
      thighR: [38, 0, 6], kneeR: [88, 0, 0], ankleR: [30, 0, 0],
      chest: [22, 6, 0], shL: [-70, 0, -20], shR: [30, 0, 18], elL: [-30, 0, 0], elR: [-40, 0, 0],
    })],
    [0.52, P({
      y: -0.06,
      thighL: [-18, 0, -5], kneeL: [16, 0, 0], ankleL: [-10, 0, 0],
      thighR: [-66, 0, 4], kneeR: [14, 0, 0], ankleR: [38, 0, 0],
      chest: [12, -4, 0], shL: [26, 0, -22], shR: [-58, 0, 16], elL: [-26, 0, 0], elR: [-20, 0, 0],
    })],
    [0.8, P({
      y: -0.02,
      thighL: [-10, 0, -5], kneeL: [10, 0, 0],
      thighR: [-96, 0, 4], kneeR: [8, 0, 0], ankleR: [30, 0, 0],
      chest: [-6, -8, 0], shL: [36, 0, -24], shR: [-72, 0, 18], elL: [-22, 0, 0], elR: [-14, 0, 0],
    })],
    [1, P({
      y: -0.05,
      thighL: [-12, 0, -5], kneeL: [14, 0, 0],
      thighR: [-58, 0, 4], kneeR: [30, 0, 0], ankleR: [18, 0, 0],
      chest: [2, -4, 0], shL: [20, 0, -16], shR: [-40, 0, 12], elL: [-24, 0, 0], elR: [-20, 0, 0],
    })],
  ]);

  C.stumble = clip(0.45, false, [
    [0, P({ chest: [22, 0, 0], body: [14, 0, 0] }, READY)],
    [0.45, P({
      body: [20, 0, -8], chest: [26, 10, 0], y: -0.08,
      shL: [-120, 0, -40], shR: [60, 0, 30], elL: [-20, 0, 0], elR: [-30, 0, 0],
      thighL: [-40, 0, -6], kneeL: [60, 0, 0], thighR: [20, 0, 6], kneeR: [24, 0, 0],
    })],
    [1, P({ body: [4, 0, 0] }, READY)],
  ]);

  {
    const jukeL = clip(0.38, false, [
      [0, READY],
      [0.45, P({
        y: -0.13, body: [0, 0, 16],
        thighL: [-30, 0, -34], kneeL: [50, 0, 0], ankleL: [-18, 0, 0],
        thighR: [-16, 0, 18], kneeR: [30, 0, 0],
        chest: [16, 14, -8], head: [-10, -10, 0],
        shL: [-40, 0, -44], shR: [10, 0, 30], elL: [-50, 0, 0], elR: [-60, 0, 0],
      })],
      [1, READY],
    ]);
    C.jukeL = jukeL;
    C.jukeR = clip(0.38, false, jukeL.keys.map((k) => [k.t, mirrorPose(k.p)]));
  }

  return C;
}
