// The playbook. Positions are relative to the line of scrimmage:
//   x = yards downfield (+ toward the end zone you attack), z = lateral (− top of screen, + bottom).
// Routes are waypoints relative to where that player lines up.
//
// Offense spots: QB · LINE · WR1 (top) · WR2 (bottom) · BACK
// Defense spots: RUSH · LB · CB1 (top) · CB2 (bottom) · S

export const OFF_FORM = { LINE: [-0.7, 0], QB: [-3.4, 0], WR1: [-0.9, -7.0], WR2: [-0.9, 7.0], BACK: [-3.6, 2.6] };
export const DEF_FORM = { RUSH: [1.1, 0], LB: [3.6, 1.2], CB1: [3.2, -7.0], CB2: [3.2, 7.0], S: [10.5, 0] };

export const PLAYS = {
  // ------------------------------------------------------------ starter passes
  pumpkin_post: {
    name: 'Pumpkin Post', icon: '🎃', type: 'pass',
    desc: 'Top receiver cuts behind the defender on a post. Drag and flat underneath.',
    routes: { WR1: [[7, 0], [15, 5.6]], WR2: [[3.5, 0], [4.5, -9]], BACK: [[1.5, 3.4], [3.5, 6.6]] },
    keys: ['WR1', 'WR2', 'BACK'],
  },
  sprinkler_slant: {
    name: 'Sprinkler Slant', icon: '💦', type: 'pass',
    desc: 'Quick slants from both sides. The ball comes out fast.',
    routes: { WR1: [[2.2, 0], [7.5, 5.2]], WR2: [[2.2, 0], [7.5, -5.2]], BACK: [[2, -3], [5, -5.5]] },
    keys: ['WR1', 'WR2', 'BACK'],
  },
  fence_fade: {
    name: 'Back Fence Fade', icon: '🌅', type: 'pass',
    desc: 'Both receivers go deep along the sidelines. Big gain or nothing.',
    routes: { WR1: [[5, -1.6], [20, -2.2]], WR2: [[5, 1.6], [20, 2.2]], BACK: [[3, 0.5], [6, -2]] },
    keys: ['WR1', 'WR2', 'BACK'],
  },
  curl_flat: {
    name: 'Curl & Flat', icon: '↩️', type: 'pass',
    desc: 'Receivers curl back at eight yards. Safe, steady yards.',
    routes: { WR1: [[8.5, 0], [7, 1.6]], WR2: [[8.5, 0], [7, -1.6]], BACK: [[1, 4], [2.5, 8]] },
    keys: ['WR1', 'WR2', 'BACK'],
  },
  // ------------------------------------------------------------ runs + screens
  hollow_dive: {
    name: 'Hollow Dive', icon: '🏃', type: 'run', carrier: 'BACK',
    desc: 'Hand it to the back, straight up the middle behind your lineman.',
    routes: { WR1: [[6, -1]], WR2: [[6, 1]], BACK: [[2.5, -2.4], [8, -2.4]] },
    keys: [],
  },
  porch_screen: {
    name: 'Porch Screen', icon: '🚪', type: 'pass', release: 0.9,
    desc: 'Dump it to the back behind the line. Your lineman rumbles out front to block.',
    routes: { WR1: [[9, -1]], WR2: [[9, 1]], BACK: [[-0.5, 5], [0.5, 8.2]] },
    keys: ['BACK', 'WR1', 'WR2'],
  },
  possum_trot: {
    name: 'Possum Trot', icon: '🦝', type: 'run', carrier: 'QB',
    desc: 'Quarterback keeper around the bottom edge. Everyone else blocks.',
    routes: { WR1: [[7, 2]], WR2: [[4, -1]], BACK: [[3, 4.5], [7, 5]], QB: [[0, 5.5], [8, 7.5]] },
    keys: [],
  },
  // ------------------------------------------------------------ trick plays (Backyard Blitz prizes)
  flea_flicker: {
    name: 'Flea Flicker', icon: '🪰', type: 'pass', fake: 'handoff', trick: true,
    desc: 'Fake the handoff. Linebacker and safety bite, and the deep ball opens up.',
    routes: { WR1: [[6, 0], [19, 4]], WR2: [[6, 0], [17, -3]], BACK: [[2, -2], [4, -3]] },
    keys: ['WR1', 'WR2', 'BACK'],
  },
  hook_ladder: {
    name: 'Hook & Ladder', icon: '🪜', type: 'pass', ladder: { from: 'WR1', to: 'BACK' }, trick: true,
    desc: 'Top receiver hooks; the back trails behind for a lateral at full speed.',
    routes: { WR1: [[8, 0], [7, 2]], WR2: [[10, 0], [14, -3]], BACK: [[1, -3], [5.5, -6.5], [9, -6.2]] },
    keys: ['WR1', 'WR2', 'BACK'],
  },
  statue: {
    name: 'Statue of Mulberry', icon: '🗽', type: 'run', carrier: 'BACK', fake: 'pass', trick: true,
    desc: 'Pump fake, then slip it to the back going wide. The coverage is already backpedalling.',
    routes: { WR1: [[12, 0]], WR2: [[12, 0]], BACK: [[-1, -4], [3, -8.5], [10, -9]] },
    keys: [],
  },
  // ------------------------------------------------------------ combo plays (unlocked by friendships)
  no_look: {
    name: 'No-Look Pass', icon: '🙈', type: 'pass', combo: ['pip', 'zip'], nolook: 'WR1',
    desc: 'Pip stares down the wrong side of the field. Zip\'s defender follows his eyes.',
    routes: { WR1: [[5, 0], [11, 6]], WR2: [[6, 0], [9, 3]], BACK: [[2, 4], [4, 7]] },
    keys: ['WR1', 'WR2', 'BACK'],
  },
  pancake_stack: {
    name: 'Pancake Stack', icon: '🥞', type: 'run', carrier: 'BACK', combo: ['waffle', 'captain'], stack: true,
    desc: 'Follow Waffle. He flattens the first two people he meets.',
    routes: { WR1: [[7, -1]], WR2: [[7, 1]], BACK: [[2, 0], [9, 0]] },
    keys: [],
  },
  flutter: {
    name: 'Porch Light Flutter', icon: '🦋', type: 'pass', combo: ['june', 'zip'], flutter: true,
    desc: 'Both receivers zig-zag. Defenders who try to mirror them get Dizzy.',
    routes: { WR1: [[4, 2.5], [8, -1.5], [13, 3]], WR2: [[4, -2.5], [8, 1.5], [13, -3]], BACK: [[2, 4]] },
    keys: ['WR1', 'WR2', 'BACK'],
  },
  // ------------------------------------------------------------ plays opponents use
  cpu_dive: { name: 'Dive', type: 'run', carrier: 'BACK', routes: { WR1: [[6, 0]], WR2: [[6, 0]], BACK: [[3, -2.2], [9, -1.5]] }, keys: [] },
  cpu_sweep: { name: 'Sweep', type: 'run', carrier: 'BACK', routes: { WR1: [[5, 2]], WR2: [[5, 1]], BACK: [[0, 5], [6, 8.5]] }, keys: [] },
  cpu_slants: { name: 'Slants', type: 'pass', routes: { WR1: [[2.5, 0], [8, 5]], WR2: [[2.5, 0], [8, -5]], BACK: [[2, 3.5], [4, 6]] }, keys: ['WR1', 'WR2', 'BACK'] },
  cpu_outs: { name: 'Outs', type: 'pass', routes: { WR1: [[7, 0], [8, -2.6]], WR2: [[7, 0], [8, 2.6]], BACK: [[3, -1], [6, -3]] }, keys: ['WR1', 'WR2', 'BACK'] },
  cpu_deep: { name: 'Bombs Away', type: 'pass', routes: { WR1: [[6, 0], [18, 3]], WR2: [[6, 0], [18, -3]], BACK: [[2, 4], [3.5, 7]] }, keys: ['WR1', 'WR2', 'BACK'] },
  cpu_cross: { name: 'Crossers', type: 'pass', routes: { WR1: [[4, 0], [6, 12]], WR2: [[6.5, 0], [8.5, -12]], BACK: [[1, -3], [3, -6]] }, keys: ['WR1', 'WR2', 'BACK'] },
};

export const STARTER_PLAYS = ['pumpkin_post', 'sprinkler_slant', 'fence_fade', 'curl_flat', 'porch_screen'];

export const DEF_PLAYS = {
  man_lock: {
    name: 'Man Lock', icon: '🔒', desc: 'Everyone sticks to a receiver. One rusher, safety deep.',
    rush: ['RUSH'], man: { CB1: 'WR1', CB2: 'WR2', LB: 'BACK' }, S: 'deep',
  },
  zone_blanket: {
    name: 'Zone Blanket', icon: '🛏️', desc: 'Drop into zones. Keeps everything in front of you; soft underneath.',
    rush: ['RUSH'], zones: { CB1: [7, -7], CB2: [7, 7], LB: [4.5, 0] }, S: 'deep',
  },
  blitz_party: {
    name: 'Blitz Party', icon: '🎉', desc: 'Send the backer too. Fast pressure — but nobody is deep.',
    rush: ['RUSH', 'LB'], man: { CB1: 'WR1', CB2: 'WR2', S: 'BACK' },
  },
  double_trouble: {
    name: 'Double Trouble', icon: '✌️', desc: 'Corner and safety both shadow their top receiver.',
    rush: ['RUSH'], man: { CB1: 'WR1', CB2: 'WR2', LB: 'BACK' }, S: 'double',
  },
  fence_line: {
    name: 'Fence Line', icon: '🧱', desc: 'Crowd the line to smother runs and screens. Weak against the deep ball.',
    rush: ['RUSH', 'LB'], zones: { CB1: [2.5, -5.5], CB2: [2.5, 5.5] }, S: 'robber',
  },
};
export const STARTER_DEF = ['man_lock', 'zone_blanket', 'blitz_party'];

/** Route building blocks for the Route Lab on the practice field. */
export const ROUTE_TREE = {
  slant: { name: 'Slant', pts: (s) => [[2.2, 0], [7.5, 5.2 * s]] },
  post: { name: 'Post', pts: (s) => [[7, 0], [15, 5.6 * s]] },
  corner: { name: 'Corner', pts: (s) => [[7, 0], [14, -2.8 * s]] },
  go: { name: 'Go', pts: (s) => [[5, -1.2 * s], [20, -1.8 * s]] },
  curl: { name: 'Curl', pts: (s) => [[8.5, 0], [7, 1.6 * s]] },
  out: { name: 'Out', pts: (s) => [[6.5, 0], [7.5, -2.8 * s]] },
  drag: { name: 'Drag', pts: (s) => [[3.5, 0], [4.5, 9 * s]] },
  flat: { name: 'Flat', pts: (s) => [[1, 3 * s], [3, 7 * s]] },
  wheel: { name: 'Wheel', pts: (s) => [[1, 4 * s], [5, 7 * s], [14, 7.5 * s]] },
};

/** Look up a play by id, including custom plays stored in the save. */
export function getPlay(id, S) {
  if (PLAYS[id]) return PLAYS[id];
  const c = S && S.customPlays.find((p) => p.id === id);
  if (!c) return null;
  const sgn = { WR1: 1, WR2: -1, BACK: -1 };
  const routes = {};
  for (const k of ['WR1', 'WR2', 'BACK']) routes[k] = ROUTE_TREE[c.routes[k]] ? ROUTE_TREE[c.routes[k]].pts(sgn[k]) : [[5, 0]];
  return { name: c.name, icon: '✏️', type: 'pass', desc: 'Drawn up in the Route Lab.', routes, keys: ['WR1', 'WR2', 'BACK'], custom: true };
}
