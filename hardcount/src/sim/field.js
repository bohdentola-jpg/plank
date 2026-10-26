// The field. World units are YARDS everywhere (sim and 3D). Axes:
//   x  across the field, sideline to sideline: −W/2 … +W/2
//   z  along the field, end line to end line:  −(L/2 + EZ) … +(L/2 + EZ)
//   y  up
// Goal lines sit at z = ±L/2, midfield at z = 0. A team "attacks +z" when its
// dir is +1. Nothing here touches three.js, so the sim runs headless in node.

export const GRAVITY = 10.73;          // yd/s² (9.81 m/s²)
export const YARD_M = 0.9144;          // metres per yard (models are built in metres)
export const M_TO_YD = 1 / YARD_M;

/**
 * SEVENS: the 7-on-7 field — 80 yards goal line to goal line, 40 wide, 10-yard
 * end zones (yard numbers 10 20 30 40 30 20 10). FULL: a regulation 100 × 53⅓.
 */
const SIZES = {
  sevens: {
    L: 80, EZ: 10, W: 40,
    hash: 5,              // hash marks at x = ±5 (10 yards apart)
    numberInset: 6,       // bottom of the yard numbers, yards in from the sideline
    numberHeight: 2,      // yard numbers are 2 yd (6 ft) tall
    kickoffYard: 20,      // kick off from your own 20
    touchbackYard: 20,    // touchbacks come out to the 20
    safetyKickYard: 15,
    patKickYard: 5,       // PAT snapped from the 5: held at the 12, a 22-yard kick
    twoPtYard: 3,         // two-point try from the 3
    otYard: 20,           // overtime possessions start at the opponent's 20
  },
  full: {
    L: 100, EZ: 10, W: 160 / 3,
    hash: 3.0833,         // NFL hashes, 18' 6" apart
    numberInset: 7,
    numberHeight: 2,
    kickoffYard: 35,
    touchbackYard: 25,
    safetyKickYard: 20,
    patKickYard: 15,      // the NFL's 33-yard extra point
    twoPtYard: 2,
    otYard: 25,
  },
};

export function makeField(size = 'sevens') {
  const s = SIZES[size] || SIZES.sevens;
  const f = {
    size: SIZES[size] ? size : 'sevens',
    ...s,
    halfL: s.L / 2,
    halfW: s.W / 2,
    end: s.L / 2 + s.EZ,          // |z| of the end lines
    firstDown: 10,
    lineWidth: 4 / 36,            // painted lines are 4 inches wide
    goalLineWidth: 8 / 36,        // goal lines 8 inches
    // goalposts stand on the end lines (college/pro style, offset none)
    goalpost: {
      width: 6.1667,              // 18' 6" between the uprights
      crossbar: 3.3333,           // crossbar 10 ft up
      top: 13.333,                // uprights reach 40 ft
      offset: 0,                  // posts stand on the end line
    },
    pylonSize: [4 / 36, 18 / 36], // 4" square, 18" tall
  };

  /** Yard-line number painted at z (distance to the nearest goal line). */
  f.yardNumberAt = (z) => Math.round(f.halfL - Math.abs(z));
  /** z of a team's own yard line `yd` (dir = the way that team attacks). */
  f.ownYardZ = (dir, yd) => -dir * f.halfL + dir * yd;
  /** Yards from z to the goal line a team attacking `dir` is driving at. */
  f.toGoal = (z, dir) => f.halfL - z * dir;
  /** "OWN 23" / "OPP 31" / "MIDFIELD" for a spot, from the offense's side. */
  f.spotText = (z, dir) => {
    const toGo = Math.round(f.toGoal(z, dir));
    const own = f.L - toGo;
    if (toGo === f.L / 2) return 'MIDFIELD';
    if (toGo <= 0) return 'GOAL LINE';
    return own < f.L / 2 ? `OWN ${own}` : `OPP ${toGo}`;
  };
  f.inBounds = (x, z) => Math.abs(x) <= f.halfW && Math.abs(z) <= f.end;
  f.inEndZone = (z, dir) => z * dir > f.halfL;      // the end zone a dir-team attacks
  f.inOwnEndZone = (z, dir) => z * dir < -f.halfL;
  return f;
}

export const FIELD_SIZES = Object.keys(SIZES);
