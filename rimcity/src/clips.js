// The animation library: every clip hand-keyed for the rig.
// Conventions: thigh/shoulder forward swing = -rx · knee flex = +rx · elbow flex = -rx
// chest forward lean = +rx · left arm raised out = -rz (right = +rz)
// body +rx = fall on face · body -rx = fall on back · y = hip height delta
import { P, clip, mirrorPose } from './animation.js';

// Moments the game engine syncs to (fraction of clip time):
export const CLIP_META = {
  shootRelease: { release: 0.30 },
  layup:        { release: 0.46 },
  passChest:    { release: 0.38 },
  dunkTomahawk: { slam: 0.60 },
  dunkFlush:    { slam: 0.58 },
  dunkWindmill: { slam: 0.64 },
  tipJump:      { reach: 0.45 },
  steal:        { swipe: 0.38 },
  shove:        { hit: 0.45 },
  dribbleIdle:  { bounces: 1 },
  dribbleRun:   { bounces: 2 },
  dribbleSprint:{ bounces: 2 },
};

const STAND = P({
  shL: [3, 0, -8], shR: [3, 0, 8], elL: [-14, 0, 0], elR: [-14, 0, 0],
});

// defensive base: sat-down stance, arms ready
const READY = P({
  y: -0.10,
  thighL: [-28, 0, -8], thighR: [-28, 0, 8], kneeL: [46, 0, 0], kneeR: [46, 0, 0],
  ankleL: [-17, 0, 0], ankleR: [-17, 0, 0],
  chest: [14, 0, 0], spine: [6, 0, 0], head: [-12, 0, 0],
  shL: [-24, 0, -18], shR: [-24, 0, 18], elL: [-42, 0, 0], elR: [-42, 0, 0],
}, STAND);

function runFrames(A, arm = null) {
  // A = amplitude config; arm = optional right-arm dribble override
  const mk = (pose) => {
    if (!arm) return pose;
    return pose;
  };
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
    [0, mk(contactL)],
    [0.25, mk(passR)],
    [0.5, mk(mirrorPose(contactL))],
    [0.75, mk(mirrorPose(passR))],
  ];
}

/** Replace the right arm in run frames with a dribble pump (two per cycle). */
function dribbleArm(frames) {
  const pump = [
    { shR: [-14, 6, 12], elR: [-64, 0, 0] },   // hand up, ball in palm
    { shR: [-30, 6, 10], elR: [-10, 0, 0] },   // push down
    { shR: [-14, 6, 12], elR: [-64, 0, 0] },
    { shR: [-30, 6, 10], elR: [-10, 0, 0] },
  ];
  return frames.map(([t, pose], i) => {
    const p2 = P({}, pose);
    p2.shR = pump[i].shR.slice();
    p2.elR = pump[i].elR.slice();
    return [t, p2];
  });
}

export function makeClips() {
  const C = {};

  C.idle = clip(2.6, true, [
    [0, P({ chest: [2, 0, 0] }, STAND)],
    [0.5, P({ chest: [4.5, 0, 0], shL: [4, 0, -10], shR: [4, 0, 10], y: -0.012 }, STAND)],
  ]);

  // triple-threat dribble in place: knees soft, right hand pumping, left arm guarding
  {
    const lo = P({
      y: -0.085,
      thighL: [-22, 0, -7], thighR: [-22, 0, 7], kneeL: [38, 0, 0], kneeR: [38, 0, 0],
      ankleL: [-14, 0, 0], ankleR: [-14, 0, 0],
      chest: [16, -8, 0], spine: [7, 0, 0], head: [-10, 6, 0],
      shL: [-38, 14, -24], elL: [-52, 0, 0],
      shR: [-16, 6, 12], elR: [-62, 0, 0],
    });
    const push = P({ shR: [-34, 6, 10], elR: [-8, 0, 0], y: -0.10, chest: [19, -8, 0] }, lo);
    C.dribbleIdle = clip(0.58, true, [
      [0, lo], [0.45, push], [0.62, push], [1 - 0.001, lo],
    ]);
  }

  C.run = clip(0.58, true, runFrames({ thigh: 46, thighBack: 26, kneeUp: 92, lean: 10, arm: 40, elbow: 94 }));
  C.sprint = clip(0.46, true, runFrames({ thigh: 58, thighBack: 33, kneeUp: 110, lean: 19, arm: 54, elbow: 104 }));
  C.dribbleRun = clip(0.56, true, dribbleArm(runFrames({ thigh: 42, thighBack: 24, kneeUp: 86, lean: 12, arm: 38, elbow: 90 })));
  C.dribbleSprint = clip(0.45, true, dribbleArm(runFrames({ thigh: 54, thighBack: 30, kneeUp: 104, lean: 20, arm: 50, elbow: 100 })));

  // defensive stance: wide base, active hands
  {
    const d0 = P({
      shL: [-26, 0, -52], shR: [-26, 0, 52], elL: [-30, 0, 0], elR: [-30, 0, 0],
    }, READY);
    C.defense = clip(0.95, true, [
      [0, d0],
      [0.5, P({ y: -0.115, chest: [16, 0, 0], shL: [-30, 0, -46], shR: [-30, 0, 46] }, d0)],
    ]);
  }

  // lateral shuffle
  {
    const s0 = P({
      y: -0.105,
      thighL: [-22, 0, -22], thighR: [-22, 0, 10], kneeL: [40, 0, 0], kneeR: [40, 0, 0],
      ankleL: [-14, 0, 0], ankleR: [-14, 0, 0],
      chest: [14, 0, 0], shL: [-34, 0, -44], shR: [-34, 0, 44], elL: [-36, 0, 0], elR: [-36, 0, 0],
    });
    C.shuffle = clip(0.5, true, [
      [0, s0],
      [0.5, P({ thighL: [-22, 0, -8], thighR: [-22, 0, -10], y: -0.09 }, s0)],
    ]);
  }

  // jumpshot: gather + ball to the pocket overhead (engine holds the last frame)
  C.shootUp = clip(0.22, false, [
    [0, P({
      y: -0.13,
      thighL: [-30, 0, -6], thighR: [-30, 0, 6], kneeL: [50, 0, 0], kneeR: [50, 0, 0],
      ankleL: [-18, 0, 0], ankleR: [-18, 0, 0],
      chest: [14, 0, 0], head: [-10, 0, 0],
      shR: [-60, 0, 14], elR: [-96, 0, 0],
      shL: [-52, 0, -18], elL: [-86, 0, 0],
    })],
    [1, P({
      y: 0.02,
      thighL: [-8, 0, -5], thighR: [-8, 0, 5], kneeL: [14, 0, 0], kneeR: [14, 0, 0],
      ankleL: [6, 0, 0], ankleR: [6, 0, 0],
      chest: [2, 0, 0], head: [-4, 0, 0],
      shR: [-122, -10, 12], elR: [-84, 0, 0],
      shL: [-100, 6, -24], elL: [-62, 0, 0],
    })],
  ]);

  // release: full extension, wrist over the cookie jar, legs scissor slightly
  C.shootRelease = clip(0.34, false, [
    [0, P({
      y: 0.02,
      thighL: [-8, 0, -5], thighR: [-8, 0, 5], kneeL: [14, 0, 0], kneeR: [14, 0, 0],
      chest: [2, 0, 0], head: [-4, 0, 0],
      shR: [-122, -10, 12], elR: [-84, 0, 0],
      shL: [-100, 6, -24], elL: [-62, 0, 0],
    })],
    [0.45, P({
      y: 0.04,
      thighL: [-4, 0, -5], thighR: [2, 0, 6], kneeL: [8, 0, 0], kneeR: [12, 0, 0],
      ankleL: [14, 0, 0], ankleR: [12, 0, 0],
      chest: [-2, 0, 0], head: [-8, 0, 0],
      shR: [-158, -6, 8], elR: [-10, 0, 0],
      shL: [-78, 4, -22], elL: [-34, 0, 0],
    })],
    [1, P({
      y: -0.02,
      thighL: [-12, 0, -5], thighR: [-12, 0, 5], kneeL: [22, 0, 0], kneeR: [22, 0, 0],
      ankleL: [-8, 0, 0], ankleR: [-8, 0, 0],
      chest: [4, 0, 0], head: [-6, 0, 0],
      shR: [-138, -4, 6], elR: [-26, 0, 0],
      shL: [-52, 0, -18], elL: [-38, 0, 0],
    })],
  ]);

  // running one-hand finish at the rack
  C.layup = clip(0.85, false, [
    [0, P({
      y: -0.06,
      thighL: [-34, 0, -5], kneeL: [40, 0, 0], thighR: [22, 0, 6], kneeR: [30, 0, 0],
      chest: [14, 0, 0],
      shR: [-30, 0, 12], elR: [-70, 0, 0], shL: [-20, 0, -14], elL: [-50, 0, 0],
    })],
    [0.46, P({
      y: 0.06,
      thighL: [-12, 0, -5], kneeL: [16, 0, 0], ankleL: [16, 0, 0],
      thighR: [-78, 0, 6], kneeR: [92, 0, 0],
      chest: [-4, 0, 0], head: [-14, 0, 0],
      shR: [-166, -4, 8], elR: [-8, 0, 0],
      shL: [-36, 0, -20], elL: [-48, 0, 0],
    })],
    [1, P({
      y: -0.05,
      thighL: [-18, 0, -5], thighR: [-18, 0, 5], kneeL: [30, 0, 0], kneeR: [30, 0, 0],
      ankleL: [-12, 0, 0], ankleR: [-12, 0, 0],
      chest: [10, 0, 0],
      shR: [-60, 0, 10], elR: [-30, 0, 0], shL: [-30, 0, -12], elL: [-30, 0, 0],
    })],
  ]);

  // tomahawk: ball cocked behind the head, hammered through
  C.dunkTomahawk = clip(1.0, false, [
    [0, P({
      y: -0.10,
      thighL: [-36, 0, -6], thighR: [-36, 0, 6], kneeL: [54, 0, 0], kneeR: [54, 0, 0],
      chest: [18, 0, 0],
      shR: [-40, 0, 14], elR: [-80, 0, 0], shL: [-30, 0, -16], elL: [-60, 0, 0],
    })],
    [0.35, P({
      y: 0.08,
      thighL: [-58, 0, -7], kneeL: [86, 0, 0], thighR: [-50, 0, 7], kneeR: [78, 0, 0],
      chest: [-10, 0, 0], head: [-12, 0, 0],
      shR: [-150, -18, 26], elR: [-118, 0, 0],
      shL: [-60, 0, -42], elL: [-30, 0, 0],
    })],
    [0.60, P({
      y: 0.04,
      thighL: [-40, 0, -7], kneeL: [60, 0, 0], thighR: [-30, 0, 7], kneeR: [48, 0, 0],
      chest: [24, 0, 0], head: [-18, 0, 0],
      shR: [-104, -6, 10], elR: [-12, 0, 0],
      shL: [-40, 0, -36], elL: [-26, 0, 0],
    })],
    [1, P({
      y: -0.08,
      thighL: [-26, 0, -6], thighR: [-26, 0, 6], kneeL: [42, 0, 0], kneeR: [42, 0, 0],
      ankleL: [-15, 0, 0], ankleR: [-15, 0, 0],
      chest: [14, 0, 0],
      shR: [-40, 0, 12], elR: [-30, 0, 0], shL: [-26, 0, -12], elL: [-30, 0, 0],
    })],
  ]);

  // two-hand power flush
  C.dunkFlush = clip(0.95, false, [
    [0, P({
      y: -0.12,
      thighL: [-38, 0, -7], thighR: [-38, 0, 7], kneeL: [58, 0, 0], kneeR: [58, 0, 0],
      chest: [20, 0, 0],
      shL: [-44, 8, -16], shR: [-44, -8, 16], elL: [-70, 0, 0], elR: [-70, 0, 0],
    })],
    [0.34, P({
      y: 0.08,
      thighL: [-62, 0, -8], kneeL: [92, 0, 0], thighR: [-56, 0, 8], kneeR: [84, 0, 0],
      chest: [-12, 0, 0], head: [-10, 0, 0],
      shL: [-148, 10, -18], shR: [-148, -10, 18], elL: [-92, 0, 0], elR: [-92, 0, 0],
    })],
    [0.58, P({
      y: 0.02,
      thighL: [-42, 0, -8], kneeL: [64, 0, 0], thighR: [-36, 0, 8], kneeR: [54, 0, 0],
      chest: [30, 0, 0], head: [-20, 0, 0],
      shL: [-96, 10, -14], shR: [-96, -10, 14], elL: [-10, 0, 0], elR: [-10, 0, 0],
    })],
    [1, P({
      y: -0.09,
      thighL: [-28, 0, -7], thighR: [-28, 0, 7], kneeL: [46, 0, 0], kneeR: [46, 0, 0],
      ankleL: [-16, 0, 0], ankleR: [-16, 0, 0],
      chest: [14, 0, 0],
      shL: [-30, 0, -14], shR: [-30, 0, 14], elL: [-32, 0, 0], elR: [-32, 0, 0],
    })],
  ]);

  // windmill: the arm draws the big circle on the way up
  C.dunkWindmill = clip(1.05, false, [
    [0, P({
      y: -0.11,
      thighL: [-36, 0, -7], thighR: [-36, 0, 7], kneeL: [56, 0, 0], kneeR: [56, 0, 0],
      chest: [18, 0, 0],
      shR: [20, 0, 30], elR: [-30, 0, 0], shL: [-30, 0, -18], elL: [-50, 0, 0],
    })],
    [0.28, P({
      y: 0.07,
      thighL: [-56, 0, -8], kneeL: [84, 0, 0], thighR: [-48, 0, 8], kneeR: [74, 0, 0],
      chest: [-8, 0, 0],
      shR: [44, 0, 96], elR: [-12, 0, 0],
      shL: [-66, 0, -40], elL: [-26, 0, 0],
    })],
    [0.48, P({
      y: 0.07,
      thighL: [-52, 0, -8], kneeL: [80, 0, 0], thighR: [-44, 0, 8], kneeR: [70, 0, 0],
      chest: [-14, 0, 0], head: [-10, 0, 0],
      shR: [-150, 0, 60], elR: [-16, 0, 0],
      shL: [-70, 0, -42], elL: [-22, 0, 0],
    })],
    [0.64, P({
      y: 0.02,
      thighL: [-40, 0, -8], kneeL: [60, 0, 0], thighR: [-32, 0, 8], kneeR: [50, 0, 0],
      chest: [26, 0, 0], head: [-18, 0, 0],
      shR: [-100, -8, 12], elR: [-10, 0, 0],
      shL: [-44, 0, -34], elL: [-24, 0, 0],
    })],
    [1, P({
      y: -0.08,
      thighL: [-26, 0, -7], thighR: [-26, 0, 7], kneeL: [44, 0, 0], kneeR: [44, 0, 0],
      ankleL: [-15, 0, 0], ankleR: [-15, 0, 0],
      chest: [14, 0, 0],
      shR: [-36, 0, 12], elR: [-28, 0, 0], shL: [-26, 0, -12], elL: [-28, 0, 0],
    })],
  ]);

  // shot contest / swat: both arms straight up
  C.block = clip(0.72, false, [
    [0, READY],
    [0.30, P({
      y: 0.04,
      thighL: [-20, 0, -6], thighR: [-20, 0, 6], kneeL: [30, 0, 0], kneeR: [30, 0, 0],
      ankleL: [14, 0, 0], ankleR: [14, 0, 0],
      chest: [-6, 0, 0], head: [-16, 0, 0],
      shL: [-168, 0, -10], shR: [-172, 0, 8], elL: [-6, 0, 0], elR: [-4, 0, 0],
    })],
    [0.62, P({
      y: 0.02,
      thighL: [-26, 0, -6], thighR: [-26, 0, 6], kneeL: [38, 0, 0], kneeR: [38, 0, 0],
      chest: [-2, 0, 0], head: [-12, 0, 0],
      shL: [-160, 0, -14], shR: [-166, 0, 10], elL: [-10, 0, 0], elR: [-8, 0, 0],
    })],
    [1, READY],
  ]);

  // pickpocket swipe
  C.steal = clip(0.42, false, [
    [0, READY],
    [0.38, P({
      y: -0.14,
      thighL: [-40, 0, -8], kneeL: [58, 0, 0], thighR: [-18, 0, 10], kneeR: [30, 0, 0],
      chest: [26, -18, 0], spine: [10, -6, 0], head: [-16, 10, 0],
      shR: [-64, -42, -14], elR: [-10, 0, 0],
      shL: [-20, 0, -26], elL: [-50, 0, 0],
    })],
    [1, READY],
  ]);

  // hard two-hand shove
  C.shove = clip(0.5, false, [
    [0, P({ shL: [-40, 8, -10], shR: [-40, -8, 10], elL: [-80, 0, 0], elR: [-80, 0, 0] }, READY)],
    [0.45, P({
      y: -0.07,
      thighL: [-34, 0, -7], kneeL: [48, 0, 0], thighR: [10, 0, 8], kneeR: [22, 0, 0],
      chest: [22, 0, 0], head: [-12, 0, 0],
      shL: [-86, 6, -8], shR: [-86, -6, 8], elL: [-6, 0, 0], elR: [-6, 0, 0],
    })],
    [1, READY],
  ]);

  // ankle-breaker spin, ball hugged tight
  C.spin = clip(0.5, false, [
    [0, P({ body: [0, 0, 0] }, READY)],
    [0.5, P({
      y: -0.13, body: [0, 180, 0],
      thighL: [-30, 0, -10], thighR: [-30, 0, 10], kneeL: [46, 0, 0], kneeR: [46, 0, 0],
      chest: [18, 0, 0],
      shL: [-30, 24, -10], elL: [-92, 0, 0], shR: [-30, -24, 10], elR: [-92, 0, 0],
    })],
    [1, P({ body: [0, 360, 0] }, READY)],
  ]);

  C.passChest = clip(0.34, false, [
    [0, P({
      y: -0.08,
      thighL: [-24, 0, -6], thighR: [-24, 0, 6], kneeL: [38, 0, 0], kneeR: [38, 0, 0],
      chest: [12, 0, 0],
      shL: [-52, 10, -10], shR: [-52, -10, 10], elL: [-94, 0, 0], elR: [-94, 0, 0],
    })],
    [0.55, P({
      y: -0.05,
      thighL: [-30, 0, -6], thighR: [4, 0, 7], kneeL: [42, 0, 0], kneeR: [16, 0, 0],
      chest: [16, 0, 0],
      shL: [-78, 4, -6], shR: [-78, -4, 6], elL: [-8, 0, 0], elR: [-8, 0, 0],
    })],
    [1, P({}, READY)],
  ]);

  C.catch = clip(0.3, false, [
    [0, P({ shL: [-66, 8, -10], shR: [-66, -8, 10], elL: [-30, 0, 0], elR: [-30, 0, 0], chest: [8, 0, 0] }, STAND)],
    [1, P({
      y: -0.06,
      shL: [-46, 12, -10], shR: [-46, -12, 10], elL: [-78, 0, 0], elR: [-78, 0, 0],
      chest: [12, 0, 0],
      thighL: [-20, 0, -5], thighR: [-20, 0, 5], kneeL: [32, 0, 0], kneeR: [32, 0, 0],
      ankleL: [-13, 0, 0], ankleR: [-13, 0, 0],
    })],
  ]);

  // opening tip: crouch, then one hand to the sky
  C.tipJump = clip(0.8, false, [
    [0, P({
      y: -0.18,
      thighL: [-46, 0, -7], thighR: [-46, 0, 7], kneeL: [68, 0, 0], kneeR: [68, 0, 0],
      ankleL: [-22, 0, 0], ankleR: [-22, 0, 0],
      chest: [22, 0, 0],
      shL: [-20, 0, -14], shR: [-20, 0, 14], elL: [-40, 0, 0], elR: [-40, 0, 0],
    })],
    [0.45, P({
      y: 0.06,
      thighL: [-10, 0, -5], thighR: [-32, 0, 6], kneeL: [12, 0, 0], kneeR: [48, 0, 0],
      ankleL: [16, 0, 0],
      chest: [-8, 0, 0], head: [-20, 0, 0],
      shR: [-176, 0, 6], elR: [-4, 0, 0],
      shL: [30, 0, -16], elL: [-20, 0, 0],
    })],
    [1, P({}, READY)],
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

  C.getUp = clip(0.65, false, [
    [0, P({
      y: -0.115, body: [-88, 0, 0],
      thighL: [-10, 0, -7], thighR: [-6, 0, 7], kneeL: [16, 0, 0], kneeR: [12, 0, 0],
      chest: [6, 0, 0], head: [24, 0, 0],
      shL: [-24, 0, -70], shR: [-24, 0, 70], elL: [-14, 0, 0], elR: [-14, 0, 0],
    })],
    [0.5, P({
      y: -0.24, body: [-12, 0, 0],
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

  // post-dunk double-bicep for the cheap seats
  C.flex = clip(1.3, true, [
    [0, P({
      y: -0.04,
      chest: [-8, 0, 0], head: [-6, 0, 0],
      shL: [-10, 0, -96], shR: [-10, 0, 96], elL: [-118, 0, 0], elR: [-118, 0, 0],
      thighL: [-10, 0, -8], thighR: [-10, 0, 8], kneeL: [16, 0, 0], kneeR: [16, 0, 0],
    })],
    [0.5, P({
      y: -0.06, chest: [-11, 0, 0],
      shL: [-14, 0, -102], shR: [-14, 0, 102], elL: [-126, 0, 0], elR: [-126, 0, 0],
    })],
  ]);

  // holding the ball overhead out of bounds, waiting on the cut
  C.inboundHold = clip(1.6, true, [
    [0, P({
      shL: [-146, 8, -14], shR: [-146, -8, 14], elL: [-28, 0, 0], elR: [-28, 0, 0],
      chest: [-4, 0, 0], head: [-8, 0, 0],
      thighL: [-6, 0, -6], thighR: [-6, 0, 6], kneeL: [10, 0, 0], kneeR: [10, 0, 0],
    }, STAND)],
    [0.5, P({
      y: -0.03,
      shL: [-152, 8, -14], shR: [-152, -8, 14], elL: [-24, 0, 0], elR: [-24, 0, 0],
      chest: [-6, 0, 0], head: [-10, 0, 0],
      thighL: [-8, 0, -6], thighR: [-8, 0, 6], kneeL: [14, 0, 0], kneeR: [14, 0, 0],
    }, STAND)],
  ]);

  C.dejected = clip(3.0, true, [
    [0, P({ chest: [16, 0, 0], head: [34, 0, 0], shL: [6, 0, -3], shR: [6, 0, 3], elL: [-6, 0, 0], elR: [-6, 0, 0] }, STAND)],
    [0.5, P({ chest: [18, 0, 0], head: [36, 0, 0], y: -0.025, shL: [6, 0, -3], shR: [6, 0, 3], elL: [-6, 0, 0], elR: [-6, 0, 0] }, STAND)],
  ]);

  return C;
}
