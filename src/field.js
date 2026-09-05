// Field geometry — the single source of truth for world dimensions.
// 1 world unit = 1 yard. X runs the length of the field (home drives +X),
// Z runs the width (home stands/bench at +Z), Y is up, turf at y = 0.
export const GOAL = 50;            // goal lines at x = ±GOAL
export const EZ_BACK = 60;         // end lines (back of the end zones) at x = ±EZ_BACK
export const SIDE = 160 / 6;       // sidelines at z = ±SIDE (53.33 yd wide field)
export const HASH_Z = 8.89;        // high-school hash marks (53'4" apart) at z = ±HASH_Z
export const NUMBER_Z = 26.67 - 11; // yard-number centres, 11 yd in from each sideline
export const BENCH_Z = 28.0;       // where benched athletes park (rows step outward by 1.0)
export const APRON_Z = 28.6;       // bench-walk target just off the field
export const FURNITURE_Z = 29.2;   // sideline benches / coolers / tables
export const CHAIN_Z = 27.4;       // chain gang & down marker stand on the home sideline
export const STANDS_Z0 = 31.5;     // first grandstand row
export const GOALPOST_X = 60;      // goalposts stand on the end lines
export const CROSSBAR_Y = 3.33;    // 10 ft crossbar
export const UPRIGHT_HALF = 3.09;  // 18'6" between uprights → ±3.09
export const UPRIGHT_H = 6.7;      // uprights above the crossbar
export const SCOREBOARD_X = 74;    // behind the +X end zone, faces −X
export const PYLON_X = [-EZ_BACK, -GOAL, GOAL, EZ_BACK];
export const G = 10.7;             // gravity in yd/s² (≈ 9.8 m/s²)
export const PLAYER_HEIGHT = 2.0;  // rig crown height in world units

/** Clamp a field x to the playable spot range used for the line of scrimmage. */
export const clampLos = (x) => Math.max(-49.5, Math.min(49.5, x));
/** Yards to the goal line for a team driving in direction dir (±1) from x. */
export const yardsToGoal = (x, dir) => GOAL - x * dir;
/** Field position label as spoken on broadcast: "OWN 25" / "OPP 40" / "50". */
export function ballOnLabel(x, dir) {
  const own = Math.round(GOAL + x * dir);       // yards from the driving team's own goal line
  if (own === 50) return '50';
  return own < 50 ? `OWN ${own}` : `OPP ${100 - own}`;
}
