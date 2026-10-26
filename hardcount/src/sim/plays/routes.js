// The route tree. A route is a list of waypoints [in, depth]:
//   in    = yards toward the ball from where the receiver lined up (negative = outside)
//   depth = yards past the line of scrimmage (absolute, so an RB's 12-yard dig
//           ends 12 past the line no matter where he started)
// Flags: settle (sits down in the soft spot once he gets there — curls, hitches,
// hooks), speed (fraction of top speed on the stem), behind (stays behind the
// line — bubbles, swings: a throw to him is a backward pass, a lateral).
export const ROUTES = {
  go: { name: 'GO', pts: [[0, 6], [-0.6, 44]] },
  fade: { name: 'FADE', pts: [[-1.2, 6], [-3, 40]] },
  seam: { name: 'SEAM', pts: [[0, 6], [0.8, 44]] },
  post: { name: 'POST', pts: [[0, 11], [4.5, 20], [8, 44]] },
  skinny: { name: 'SKINNY POST', pts: [[0, 9], [2.5, 20], [4, 44]] },
  corner: { name: 'CORNER', pts: [[0, 10], [-4.5, 17], [-8, 26]] },
  slant: { name: 'SLANT', pts: [[0, 1.5], [5.5, 6.5], [13, 12]] },
  in: { name: 'IN', pts: [[0, 11.5], [1.2, 12], [16, 12.5]] },
  out: { name: 'OUT', pts: [[0, 9.5], [-1.2, 10], [-14, 9.5]] },
  qout: { name: 'QUICK OUT', pts: [[0, 4.5], [-1, 5], [-10, 5]] },
  comeback: { name: 'COMEBACK', pts: [[0, 15], [-2.6, 12]], settle: true },
  curl: { name: 'CURL', pts: [[0, 10], [1.2, 8.5]], settle: true },
  hitch: { name: 'HITCH', pts: [[0, 5.5], [0.4, 4.6]], settle: true },
  hook: { name: 'HOOK', pts: [[0, 6.5], [0.3, 5.5]], settle: true },
  drag: { name: 'DRAG', pts: [[1, 2.2], [6, 3], [22, 3.5]] },
  cross: { name: 'CROSSER', pts: [[0.5, 6], [6, 11], [24, 14]] },
  dig: { name: 'DIG', pts: [[0, 14], [1.4, 14.5], [16, 15]] },
  flag: { name: 'FLAG', pts: [[0, 7], [-6, 15], [-9, 24]] },
  whip: { name: 'WHIP', pts: [[0, 4], [4, 6], [-4, 6.5]] },
  stick: { name: 'STICK', pts: [[0, 5.5], [0.8, 5.5]], settle: true },
  spot: { name: 'SPOT', pts: [[1.5, 5], [2.2, 6]], settle: true },
  // backs and the flat
  flat: { name: 'FLAT', pts: [[-2.5, 0.5], [-7, 2], [-13, 3]] },
  arrow: { name: 'ARROW', pts: [[-1.5, 1.5], [-10, 4.5]] },
  swing: { name: 'SWING', pts: [[-2.5, -1.5], [-7, -0.6], [-11, 2]], behind: true },
  wheel: { name: 'WHEEL', pts: [[-3, 0.5], [-7, 3.5], [-8, 10], [-8.5, 40]] },
  angle: { name: 'ANGLE', pts: [[-2.5, 2.5], [4, 6]] },
  texas: { name: 'TEXAS', pts: [[-2.5, 2.5], [4, 7], [8, 9]] },
  checkdown: { name: 'CHECK', pts: [[0.5, 2.5], [0.8, 3.5]], settle: true },
  bubble: { name: 'BUBBLE', pts: [[-1.2, -1.2], [-4, -1.4], [-8, -0.5]], behind: true },
  tunnel: { name: 'TUNNEL', pts: [[1.5, -1.2], [5, -1.4]], behind: true, settle: true },
  screen: { name: 'SCREEN', pts: [[-1, -2.5], [-5, -2], [-6, -1.6]], behind: true, settle: true, delay: 0.9 },
  // trick-play legs
  ladder: { name: 'LADDER', pts: [[1, 3], [3, 7], [1.5, 9]] },             // trails the hook for the pitch
  leak: { name: 'LEAK', pts: [[-1, 1], [-4, 6], [-6, 30]], delay: 1.2 },      // QB / TE slipping out late
  delayseam: { name: 'DELAY SEAM', pts: [[0, 4], [0.5, 40]], delay: 1.0 },
  // run-play support legs (not real routes: paths the AI follows)
  stalk: { name: 'STALK', pts: [[0, 4]], block: true },
  lead: { name: 'LEAD', pts: [], block: true },
};

/** A route's waypoints placed on the field for one receiver. */
export function placeRoute(routeId, start, insideSign, losZ, dir) {
  const R = ROUTES[routeId];
  if (!R) return [];
  // start: world {x, z}; insideSign: +1 if "in" is toward world +x, −1 otherwise
  return R.pts.map(([inYd, depth]) => ({
    x: start.x + inYd * insideSign,
    z: losZ + depth * dir,
  }));
}
