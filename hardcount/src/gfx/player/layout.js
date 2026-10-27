// The per-player uniform atlas layout (512 × 512). Every player's body mesh
// maps into the same rectangles, so the painter (atlas.js), the shared
// roughness / dirt masks and the geometry agree. Rects are [x, y, w, h] in
// canvas pixels (y down); a region's local (u, v) runs 0..1 with v = 1 at the
// rect's TOP edge.
export const ATLAS = 512;

export const R = {
  TORSO: [2, 2, 380, 236],     // u around the body (seam back-right), v crotch (0) → collar (1)
  LEG: [386, 2, 124, 236],     // shared by both legs: u around (outer side at 0.5), v ankle (0) → hip (1)
  HEAD: [2, 242, 220, 156],    // face + scalp: u around (front at 0.5), v chin/neck (0) → crown (1)
  ARM_L: [226, 242, 76, 216],  // u around (outer side at 0.5), v wrist (0) → shoulder (1)
  ARM_R: [306, 242, 76, 216],
  HAND: [386, 242, 124, 76],   // glove / hand, shared (mirrored)
  SHOE: [386, 322, 124, 76],   // shoe, shared (mirrored)
  HAIR: [2, 402, 124, 108],
  EYE: [130, 402, 30, 30],
  HNUM: [164, 402, 58, 40],    // number on the back of the helmet
  MISC: [130, 436, 92, 74],    // towel / neck roll / hand warmer / whistle colour swatches
  CAP: [226, 462, 156, 48],    // officials' cap, penalty flag
  EXTRA: [386, 402, 124, 108],
};

// The hand's strips inside R.HAND: the palm and back of the hand, the fingers (all four
// share one), the thumb. On each, u = 0 is the palm side and the strip's middle the back
// (the nails); v = 1 at the wrist / the base of the digit, 0 at the fingertips.
export const HAND_U = { palm: [0, 0.58], finger: [0.6, 0.82], thumb: [0.84, 1] };

/** Where the jersey sleeve's hem is along the arm (t: 0 shoulder … 1 elbow), geometry and paint. */
export const SLEEVE_HEM = 0.54;

// swatches inside MISC (local u, v centres) — solid colours for small props
export const SWATCH = {
  towel: [0.17, 0.75], neckRoll: [0.5, 0.75], warmer: [0.83, 0.75],
  whistle: [0.17, 0.25], lanyard: [0.5, 0.25], tape: [0.83, 0.25],
};

/** Region-local (u, v) → texture UV (flipY canvas texture). */
export function uvOf(rect, u, v, out = [0, 0]) {
  const [x, y, w, h] = rect;
  out[0] = (x + u * w) / ATLAS;
  out[1] = 1 - (y + (1 - v) * h) / ATLAS;
  return out;
}

/** Region-local (u, v) → canvas pixel. */
export function pxOf(rect, u, v) {
  const [x, y, w, h] = rect;
  return [x + u * w, y + (1 - v) * h];
}

// torso u: angle θ from the front toward the player's left, seam at −135°
export const TORSO_SEAM = -135;
export const torsoU = (thetaDeg) => ((((thetaDeg - TORSO_SEAM) % 360) + 360) % 360) / 360;
// limbs: θ from the front toward the outside, seam on the inside
export const limbU = (thetaDeg) => ((((thetaDeg + 90) % 360) + 360) % 360) / 360;

// head: longitude λ (0 = front, + toward the player's left) and latitude φ,
// warped so the face gets more texels than the back of the head. Seen from
// the front the player's left is on the viewer's right, so u grows with λ
// (paint reads correctly); the seam is at the back (λ = ±180°).
export function headU(lamDeg) {
  let x = lamDeg / 180;
  x = Math.max(-1, Math.min(1, x));
  const w = x * (1.55 - 0.55 * Math.abs(x));  // slope 1.55 across the face
  return 0.5 + 0.5 * w;
}
export function headV(phiDeg) {
  let x = phiDeg / 90;
  x = Math.max(-1, Math.min(1, x));
  const w = x * (1.35 - 0.35 * Math.abs(x));
  return 0.5 + 0.5 * w;
}
/** Inverse of headU (u → λ degrees), for painting. */
export function headLam(u) {
  const w = (u - 0.5) * 2;            // w = x (1.55 − 0.55 |x|)
  const aw = Math.abs(w);
  // 0.55 x² − 1.55 x + aw = 0  →  x = (1.55 − √(1.55² − 2.2 aw)) / 1.1
  const x = (1.55 - Math.sqrt(Math.max(0, 1.55 * 1.55 - 2.2 * aw))) / 1.1;
  return Math.sign(w) * x * 180;
}
export function headPhi(v) {
  const w = (v - 0.5) * 2;
  const aw = Math.abs(w);
  const x = (1.35 - Math.sqrt(Math.max(0, 1.35 * 1.35 - 1.4 * aw))) / 0.7;
  return Math.sign(w) * x * 90;
}
