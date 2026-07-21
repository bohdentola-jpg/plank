// BIG INNING '27 animation library. Starts from the shared VARSITY clip set
// (runs, idles, celebrations) and adds every baseball motion hand-keyed:
// the batting stance and swing, the windup, the catcher's crouch, scoops and
// quick throws. Same conventions as clips.js.
import { P, clip, mirrorPose } from './animation.js';
import { makeClips } from './clips.js';

export const PITCH_RELEASE_S = 0.42;  // ball leaves hand this far into pitchThrow (seconds)
export const SWING_CONTACT_S = 0.16;  // bat crosses the plate this far into swing (seconds)
export const THROW_RELEASE_S = 0.14;  // quick infield throw release point (seconds)

const STAND = P({
  shL: [3, 0, -7], shR: [3, 0, 7], elL: [-12, 0, 0], elR: [-12, 0, 0],
});

export function makeBBClips() {
  const C = makeClips(); // idle / run / sprint / jog / ready / celebrate / dejected / cheer / getUp / stumble

  // ---- fielder ready: knees bent, glove low and forward
  const FIELD = P({
    y: -0.10,
    thighL: [-28, 0, -6], thighR: [-28, 0, 6], kneeL: [46, 0, 0], kneeR: [46, 0, 0],
    ankleL: [-16, 0, 0], ankleR: [-16, 0, 0],
    chest: [18, 0, 0], spine: [8, 0, 0], head: [-16, 0, 0],
    shL: [-42, 0, -14], shR: [-42, 0, 14], elL: [-40, 0, 0], elR: [-40, 0, 0],
  }, STAND);
  C.fieldReady = clip(1.3, true, [
    [0, FIELD],
    [0.5, P({ y: -0.115, chest: [20, 0, 0] }, FIELD)],
  ]);

  // ---- catcher crouch: deep sit, mitt up as the target
  {
    const crouch = P({
      y: -0.52,
      thighL: [-104, 0, -26], thighR: [-104, 0, 26], kneeL: [128, 0, 0], kneeR: [128, 0, 0],
      ankleL: [-26, 0, 0], ankleR: [-26, 0, 0],
      chest: [14, 0, 0], spine: [6, 0, 0], head: [-10, 0, 0],
      shL: [-64, -18, -10], elL: [-46, 0, 0],   // mitt arm up
      shR: [-20, 10, 20], elR: [-88, 0, 0],     // bare hand tucked
    });
    C.crouch = clip(1.6, true, [
      [0, crouch],
      [0.5, P({ y: -0.53, shL: [-66, -18, -10] }, crouch)],
    ]);
  }

  // ---- batting stance (right-handed in rig space; batter group is rotated to face 1B)
  // Hands together up by the back shoulder, weight back, front shoulder closed.
  const BAT_STANCE = P({
    y: -0.07,
    thighL: [-18, 0, -8], thighR: [-22, 0, 10], kneeL: [30, 0, 0], kneeR: [36, 0, 0],
    ankleL: [-12, 0, 0], ankleR: [-14, 0, 0],
    chest: [10, 18, -4], spine: [4, 8, 0], head: [-6, -42, 0],
    shR: [-38, 38, 58], elR: [-64, 0, 46],
    shL: [-44, 52, -6], elL: [-96, 0, 0],
  });
  C.batStance = clip(1.5, true, [
    [0, BAT_STANCE],
    [0.5, P({ y: -0.078, shR: [-40, 40, 60], head: [-7, -43, 0] }, BAT_STANCE)],
  ]);

  // ---- the swing: load → stride → whip through → follow high
  C.swing = clip(0.52, false, [
    [0, BAT_STANCE],
    [0.14, P({ // load deeper
      y: -0.09,
      chest: [10, 30, -4], spine: [4, 12, 0], head: [-6, -48, 0],
      shR: [-42, 48, 66], elR: [-70, 0, 50],
      shL: [-50, 58, -4], elL: [-102, 0, 0],
      thighL: [-30, 0, -10], kneeL: [40, 0, 0],
    }, BAT_STANCE)],
    [0.31, P({ // contact: hips open, arms extended through the zone
      y: -0.10,
      thighL: [-34, 0, -14], kneeL: [30, 0, 0], ankleL: [-16, 0, 0],
      thighR: [10, 0, 14], kneeR: [42, 0, 0], ankleR: [22, 0, 0],
      chest: [6, -38, -4], spine: [2, -16, 0], head: [-4, 4, 0],
      shR: [-72, -12, 30], elR: [-16, 0, 8],
      shL: [-66, 10, -26], elL: [-24, 0, 0],
    })],
    [0.62, P({ // follow-through wraps around the back shoulder
      y: -0.075,
      thighL: [-26, 0, -14], kneeL: [22, 0, 0],
      thighR: [22, 0, 14], kneeR: [48, 0, 0], ankleR: [30, 0, 0],
      chest: [0, -64, -6], spine: [0, -26, 0], head: [-2, 22, 0],
      shR: [-96, -40, -8], elR: [-52, 0, 0],
      shL: [-70, -20, -44], elL: [-64, 0, 0],
    })],
    [1, P({ // relax toward first step
      y: -0.05,
      thighL: [-16, 0, -8], kneeL: [20, 0, 0],
      thighR: [10, 0, 10], kneeR: [26, 0, 0],
      chest: [6, -40, 0], spine: [2, -16, 0], head: [-4, 12, 0],
      shR: [-40, -20, 10], elR: [-40, 0, 0],
      shL: [-30, -6, -20], elL: [-44, 0, 0],
    })],
  ]);

  // ---- bunt: square around, bat flat
  C.bunt = clip(0.4, false, [
    [0, BAT_STANCE],
    [0.5, P({
      y: -0.10,
      thighL: [-26, 0, -10], thighR: [-26, 0, 10], kneeL: [42, 0, 0], kneeR: [42, 0, 0],
      chest: [12, -4, 0], head: [-10, -6, 0],
      shR: [-58, -6, 26], elR: [-52, 0, 10],
      shL: [-62, 14, -18], elL: [-58, 0, 0],
    })],
    [1, P({
      y: -0.10,
      thighL: [-26, 0, -10], thighR: [-26, 0, 10], kneeL: [42, 0, 0], kneeR: [42, 0, 0],
      chest: [12, -4, 0], head: [-10, -6, 0],
      shR: [-58, -6, 26], elR: [-52, 0, 10],
      shL: [-62, 14, -18], elL: [-58, 0, 0],
    })],
  ]);

  // ---- pitcher windup → leg lift → drive → release → recover
  const SET = P({
    y: -0.04,
    thighL: [-8, 0, -5], thighR: [-8, 0, 5], kneeL: [14, 0, 0], kneeR: [14, 0, 0],
    chest: [8, 0, 0], head: [-8, 0, 0],
    shL: [-48, -16, -8], elL: [-78, 0, 0],   // glove up at the chest
    shR: [-40, 12, 10], elR: [-84, 0, 0],    // ball hidden in the mitt
  });
  C.pitchSet = clip(1.6, true, [
    [0, SET],
    [0.5, P({ y: -0.048, chest: [9, 0, 0] }, SET)],
  ]);

  C.pitchThrow = clip(0.95, false, [
    [0, SET],
    [0.22, P({ // leg lift, hands break
      y: -0.02,
      thighL: [-92, 0, -6], kneeL: [102, 0, 0], ankleL: [-18, 0, 0],
      thighR: [4, 0, 6], kneeR: [10, 0, 0],
      chest: [4, 14, 4], spine: [2, 6, 0], head: [-4, -10, 0],
      shL: [-58, -10, -12], elL: [-70, 0, 0],
      shR: [-20, 24, 30], elR: [-60, 0, 20],
    })],
    [0.36, P({ // stride out, arm cocked high
      y: -0.11,
      thighL: [-44, 0, -8], kneeL: [30, 0, 0], ankleL: [-22, 0, 0],
      thighR: [26, 0, 8], kneeR: [30, 0, 0], ankleR: [26, 0, 0],
      chest: [8, 30, 2], spine: [3, 12, 0], head: [-6, -26, 0],
      shL: [-70, -20, -14], elL: [-40, 0, 0],
      shR: [-10, 52, 84], elR: [0, 0, 96],
    })],
    [0.46, P({ // release out front
      y: -0.14,
      thighL: [-52, 0, -8], kneeL: [24, 0, 0], ankleL: [-24, 0, 0],
      thighR: [36, 0, 8], kneeR: [44, 0, 0], ankleR: [32, 0, 0],
      chest: [22, -18, 0], spine: [9, -8, 0], head: [-14, 2, 0],
      shR: [-146, 0, 12], elR: [-16, 0, 10],
      shL: [16, 0, -12], elL: [-58, 0, 0],
    })],
    [0.72, P({ // finish flat, fall off toward first
      y: -0.15,
      thighL: [-48, 0, -8], kneeL: [22, 0, 0], ankleL: [-22, 0, 0],
      thighR: [40, 0, 10], kneeR: [52, 0, 0], ankleR: [34, 0, 0],
      chest: [34, -32, 0], spine: [13, -12, 0], head: [-22, 8, 0],
      shR: [-60, -26, -14], elR: [-24, 0, 0],
      shL: [24, 0, -10], elL: [-60, 0, 0],
    })],
    [1, P({
      y: -0.10,
      thighL: [-30, 0, -7], kneeL: [30, 0, 0], ankleL: [-16, 0, 0],
      thighR: [20, 0, 8], kneeR: [32, 0, 0], ankleR: [18, 0, 0],
      chest: [18, -14, 0], spine: [7, -6, 0], head: [-12, 2, 0],
      shR: [-40, -14, 0], elR: [-40, 0, 0],
      shL: [-20, 0, -12], elL: [-52, 0, 0],
    })],
  ]);

  // ---- quick infield throw (sidearm-ish snap)
  const QSET = P({
    y: -0.08,
    thighL: [-22, 0, -6], thighR: [-16, 0, 8], kneeL: [32, 0, 0], kneeR: [26, 0, 0],
    chest: [8, 24, 0], spine: [3, 10, 0], head: [-4, -20, 0],
    shR: [-16, 44, 74], elR: [-4, 0, 82],
    shL: [-44, -12, -12], elL: [-30, 0, 0],
  });
  C.throwQuick = clip(0.38, false, [
    [0, QSET],
    [0.38, P({
      y: -0.09,
      thighL: [-28, 0, -6], kneeL: [18, 0, 0],
      thighR: [22, 0, 8], kneeR: [30, 0, 0], ankleR: [24, 0, 0],
      chest: [12, -20, 0], spine: [5, -8, 0], head: [-8, 2, 0],
      shR: [-138, 0, 12], elR: [-14, 0, 8],
      shL: [18, 0, -10], elL: [-52, 0, 0],
    })],
    [1, P({
      y: -0.10,
      thighL: [-30, 0, -6], kneeL: [16, 0, 0],
      thighR: [28, 0, 8], kneeR: [36, 0, 0], ankleR: [28, 0, 0],
      chest: [24, -30, 0], spine: [10, -11, 0], head: [-14, 6, 0],
      shR: [-58, -24, -12], elR: [-22, 0, 0],
      shL: [22, 0, -8], elL: [-56, 0, 0],
    })],
  ]);

  // ---- scoop a grounder
  C.pickup = clip(0.42, false, [
    [0, FIELD],
    [0.45, P({
      y: -0.30,
      thighL: [-70, 0, -8], thighR: [-64, 0, 8], kneeL: [96, 0, 0], kneeR: [88, 0, 0],
      ankleL: [-26, 0, 0], ankleR: [-24, 0, 0],
      chest: [40, 0, 0], spine: [16, 0, 0], head: [-30, 0, 0],
      shL: [-64, 6, -8], elL: [-14, 0, 0],
      shR: [-50, -6, 10], elR: [-20, 0, 0],
    })],
    [1, P({
      y: -0.10,
      chest: [14, 12, 0], head: [-8, -10, 0],
      shL: [-40, -8, -10], elL: [-46, 0, 0],
      shR: [-24, 24, 40], elR: [-40, 0, 30],
      thighL: [-24, 0, -6], thighR: [-18, 0, 8], kneeL: [36, 0, 0], kneeR: [28, 0, 0],
    })],
  ]);

  // ---- reach up for a fly ball / catch at the chest
  C.catchBall = clip(0.5, false, [
    [0, FIELD],
    [0.45, P({
      y: 0.01,
      shL: [-146, 0, 12], elL: [-10, 0, 0],   // mitt-side arm reaches
      shR: [-60, 0, 14], elR: [-50, 0, 0],
      chest: [2, 0, 0], head: [-24, 0, 0],
      thighL: [-10, 0, -4], thighR: [-10, 0, 4], kneeL: [12, 0, 0], kneeR: [12, 0, 0],
    })],
    [1, P({
      y: -0.06,
      shL: [-66, 18, -8], elL: [-88, 0, 0],
      shR: [-50, -12, 10], elR: [-70, 0, 0],
      chest: [12, 0, 0], head: [-8, 0, 0],
      thighL: [-20, 0, -4], thighR: [-20, 0, 4], kneeL: [32, 0, 0], kneeR: [32, 0, 0],
      ankleL: [-13, 0, 0], ankleR: [-13, 0, 0],
    })],
  ]);

  // ---- lead-off shuffle on the bases
  {
    const lead = P({
      y: -0.09,
      thighL: [-20, 0, -18], thighR: [-20, 0, 12], kneeL: [34, 0, 0], kneeR: [34, 0, 0],
      ankleL: [-14, 0, 0], ankleR: [-14, 0, 0],
      chest: [14, 0, 0], head: [-10, 0, 0],
      shL: [-30, 0, -18], shR: [-30, 0, 18], elL: [-40, 0, 0], elR: [-40, 0, 0],
    });
    C.leadoff = clip(1.1, true, [
      [0, lead],
      [0.5, P({ y: -0.10, chest: [16, 0, 0] }, lead)],
    ]);
  }

  // ---- home run trot arm pump
  C.trot = clip(0.72, true, C.jog.keys.map((k) => [k.t, k.p]));

  // left-handed batting variants
  C.batStanceL = clip(1.5, true, C.batStance.keys.map((k) => [k.t, mirrorPose(k.p)]));
  C.swingL = clip(0.52, false, C.swing.keys.map((k) => [k.t, mirrorPose(k.p)]));

  return C;
}
