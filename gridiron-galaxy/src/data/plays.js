// Playbook: routes, formations, 25 base plays, generated planet specials, and defensive calls.
// Play space: LOS at z=0, downfield is +z, x negative = offense's left. Yards.
import { makeRng, hashStr } from '../util.js';

// Routes are authored for a player on the LEFT side; +dx means toward the middle of the field.
// For a right-side player dx is mirrored. For players at x=0, +dx is to the right.
export const ROUTES = {
  go:        { pts: [[0, 32]] },
  post:      { pts: [[0, 10], [5, 18], [9, 30]] },
  corner:    { pts: [[0, 10], [-5, 17], [-8, 28]] },
  out:       { pts: [[0, 6], [-9, 6.5]] },
  deepout:   { pts: [[0, 12], [-9, 12.5]] },
  dig:       { pts: [[0, 10], [12, 10.5]] },
  slant:     { pts: [[0, 2], [8, 8.5]] },
  curl:      { pts: [[0, 9], [1.5, 7]] , settle: true },
  hitch:     { pts: [[0, 5], [0.5, 4]], settle: true },
  comeback:  { pts: [[0, 15], [-2.5, 12]], settle: true },
  flat:      { pts: [[-6, 2.5]] },
  wheel:     { pts: [[-6, 1], [-8, 6], [-8, 26]] },
  drag:      { pts: [[0, 3], [16, 3.5]] },
  seam:      { pts: [[1, 24]] },
  fade:      { pts: [[-2, 8], [-3.5, 28]] },
  screen:    { pts: [[-3, -2]], settle: true, delay: 0.5 },
  swing:     { pts: [[-6, -1], [-10, 3]] },
  check:     { pts: [[2, 3], [2, 5]], settle: true, delay: 0.6 },
  block:     { pts: [], block: true },
  stick:     { pts: [[0, 5], [3, 5.5]], settle: true },
  whip:      { pts: [[0, 3], [4, 4], [-4, 5]] },
  shallow:   { pts: [[0, 1.5], [18, 3]] },
  deepcross: { pts: [[0, 10], [18, 15]] },
  angle:     { pts: [[-3, 2], [4, 8]] },
  sluggo:    { pts: [[0, 2], [4, 5], [5, 30]] },
  hitchgo:   { pts: [[0, 5], [0.5, 4.5], [1, 30]], },
  outup:     { pts: [[0, 6], [-6, 6.5], [-7, 30]] },
  smoke:     { pts: [[1, 1]], settle: true },
  bubble:    { pts: [[3, -1.5], [5, -2.5]], settle: true },
  arrow:     { pts: [[-7, 4]] },
  spot:      { pts: [[3, 5]], settle: true },
  motion:    { pts: [] }, // handled by trick scripts
  shovel:    { pts: [[6, 1.5]] },
  qbrun:     { pts: [] },
};

// Formations: positions per role. QB always takes the snap unless snapTo says otherwise.
export const FORMATIONS = {
  spread:  { QB: [0, -4.5], C: [0, -0.7], RB: [4, -4.5], X: [-13, -0.6], Z: [13, -0.6] },
  spreadL: { QB: [0, -4.5], C: [0, -0.7], RB: [-4, -4.5], X: [-13, -0.6], Z: [13, -0.6] },
  trips:   { QB: [0, -4.5], C: [0, -0.7], RB: [6, -1.2], X: [-13, -0.6], Z: [10, -0.8] },
  tripsL:  { QB: [0, -4.5], C: [0, -0.7], RB: [-6, -1.2], X: [-10, -0.8], Z: [13, -0.6] },
  bunch:   { QB: [0, -4.5], C: [0, -0.7], RB: [8, -2.2], X: [10, -0.6], Z: [12.5, -1.4] },
  pistol:  { QB: [0, -3.5], C: [0, -0.7], RB: [0, -6.5], X: [-13, -0.6], Z: [13, -0.6] },
  twins:   { QB: [0, -4.5], C: [0, -0.7], RB: [-4, -4.5], X: [8, -1], Z: [13, -0.6] },
  empty:   { QB: [0, -5], C: [0, -0.7], RB: [-7, -1.2], X: [-13, -0.6], Z: [13, -0.6] },
  wildcat: { RB: [0, -4.5], C: [0, -0.7], QB: [-13, -0.6], X: [6, -1], Z: [13, -0.6], snapTo: 'RB' },
  punt:    { QB: [0, -9], C: [0, -0.7], RB: [-3, -6], X: [-12, -0.6], Z: [12, -0.6] },
  fg:      { QB: [0, -6.5], C: [0, -0.7], RB: [-1.5, -7.5], X: [-4, -0.7], Z: [4, -0.7] },
};

// Run paths for the ball carrier (relative to carrier start), same mirror rules as routes.
export const RUN_PATHS = {
  dive:    [[0, 2], [0.5, 6], [0.5, 30]],
  sweepR:  [[6, 0], [11, 3], [12, 30]],
  sweepL:  [[-6, 0], [-11, 3], [-12, 30]],
  counter: [[3, -0.5], [-5, 2], [-7, 30]],
  draw:    [[0, 1], [1, 6], [1, 30]],
  sneak:   [[0, 2], [0, 30]],
  jet:     [[-14, 0], [-14, 30]],
  reverse: [[-10, 0], [-13, 3], [-13, 30]],
  option:  [[-4, -1], [-9, 4], [-10, 30]],
};

const DEF = (id, name, cat, formation, routes, extra = {}) => ({ id, name, cat, formation, routes, type: extra.type || 'pass', ...extra });

export const BASE_PLAYS = [
  // ---- DEEP ----
  DEF('verts', 'Verts', 'deep', 'spread', { X: 'go', Z: 'go', RB: 'seam', C: 'block' }, { desc: 'Everybody runs. Pick the one who wins.' }),
  DEF('postcorner', 'Post-Corner Shot', 'deep', 'spread', { X: 'post', Z: 'corner', RB: 'check', C: 'block' }, { desc: 'Two deep breaks, two safeties confused.' }),
  DEF('sluggo', 'Sluggo Bomb', 'deep', 'spreadL', { X: 'sluggo', Z: 'dig', RB: 'flat', C: 'block' }, { desc: 'Slant... and GO. Sell the slant.' }),
  DEF('wheelbomb', 'Wheel Bomb', 'deep', 'spread', { RB: 'wheel', X: 'post', Z: 'go', C: 'block' }, { desc: 'The back sneaks out the side door and up the sideline.' }),
  DEF('hailmary', 'Hail Mary', 'deep', 'empty', { X: 'go', Z: 'go', RB: 'seam', C: 'seam' }, { desc: 'Close your eyes. Throw it far.' }),
  // ---- MID ----
  DEF('levels', 'Levels', 'mid', 'spread', { X: 'dig', Z: 'deepout', RB: 'flat', C: 'block' }, { desc: 'High, middle, low. Read it top to bottom.' }),
  DEF('smash', 'Smash', 'mid', 'twins', { X: 'hitch', Z: 'corner', RB: 'check', C: 'block' }, { desc: 'Hitch underneath, corner over the top.' }),
  DEF('dagger', 'Dagger', 'mid', 'trips', { RB: 'seam', Z: 'dig', X: 'comeback', C: 'block' }, { desc: 'Clear the safety, then stab the middle.' }),
  DEF('mesh', 'Mesh', 'mid', 'spread', { X: 'shallow', Z: 'drag', RB: 'wheel', C: 'block' }, { desc: 'Crossers rub the defenders off. Legal, mostly.' }),
  DEF('curlflat', 'Curl-Flat', 'mid', 'spreadL', { X: 'curl', Z: 'curl', RB: 'flat', C: 'block' }, { desc: 'Classic. If the flat is open, take it.' }),
  // ---- SHORT ----
  DEF('stick', 'Stick', 'short', 'trips', { RB: 'stick', Z: 'flat', X: 'go', C: 'block' }, { desc: 'Five yards and a settle. Money on 3rd and 4.' }),
  DEF('slants', 'Double Slants', 'short', 'spread', { X: 'slant', Z: 'slant', RB: 'flat', C: 'block' }, { desc: 'Quick and inside. Throw it before they blink.' }),
  DEF('quickouts', 'Quick Outs', 'short', 'spread', { X: 'out', Z: 'out', RB: 'check', C: 'block' }, { desc: 'Sideline throws. Get out of bounds.' }),
  DEF('rbscreen', 'RB Screen', 'short', 'spreadL', { RB: 'screen', X: 'block', Z: 'go', C: 'block' }, { desc: 'Let the rush come. Then dump it over their heads.' }),
  DEF('snag', 'Snag', 'short', 'bunch', { X: 'spot', RB: 'arrow', Z: 'corner', C: 'block' }, { desc: 'A triangle. Geometry wins games.' }),
  // ---- RUN ----
  DEF('dive', 'Dive', 'run', 'pistol', { X: 'block', Z: 'block', C: 'block' }, { type: 'run', carrier: 'RB', path: 'dive', desc: 'Straight ahead. Lower the shoulder.' }),
  DEF('sweep', 'Sweep Right', 'run', 'spreadL', { X: 'block', Z: 'block', C: 'block' }, { type: 'run', carrier: 'RB', path: 'sweepR', desc: 'Get to the edge, then turn on the jets.' }),
  DEF('counter', 'Counter Left', 'run', 'spread', { X: 'block', Z: 'block', C: 'block' }, { type: 'run', carrier: 'RB', path: 'counter', desc: 'Step right, cut left, watch them fall over.' }),
  DEF('draw', 'Draw', 'run', 'spread', { X: 'go', Z: 'go', C: 'block' }, { type: 'run', carrier: 'RB', path: 'draw', delay: 0.7, desc: 'Fake pass, hand it off late. Linebackers hate it.' }),
  DEF('sneak', 'QB Sneak', 'run', 'pistol', { X: 'block', Z: 'block', C: 'block', RB: 'block' }, { type: 'run', carrier: 'QB', path: 'sneak', desc: 'One yard? Two? Just fall forward.' }),
  // ---- SPECIAL ----
  DEF('fleaflicker', 'Flea Flicker', 'special', 'pistol', { X: 'go', Z: 'post', C: 'block' }, { trick: 'fleaflicker', carrier: 'RB', desc: 'Handoff, pitch back, throw it a mile.' }),
  DEF('hbpass', 'Halfback Pass', 'special', 'spreadL', { X: 'go', Z: 'corner', C: 'block' }, { trick: 'hbpass', carrier: 'RB', path: 'sweepR', desc: 'Everyone thinks it\'s a sweep. Then the RB throws.' }),
  DEF('reverse', 'Reverse', 'special', 'spread', { X: 'block', C: 'block' }, { type: 'run', trick: 'reverse', carrier: 'RB', path: 'sweepR', desc: 'Sweep one way, hand it off the other way.' }),
  DEF('punt', 'Punt', 'special', 'punt', { X: 'go', Z: 'go', C: 'block', RB: 'block' }, { type: 'punt', desc: 'Give it up. Live to fight another down.' }),
  DEF('fieldgoal', 'Field Goal', 'special', 'fg', { X: 'block', Z: 'block', C: 'block', RB: 'block' }, { type: 'fg', desc: 'Three points. Nail the timing.' }),
];

// Exotic templates used to build 5 special plays per planet.
const SPECIAL_TEMPLATES = [
  { key: 'hookladder', name: 'Hook & Ladder', formation: 'spreadL', routes: { X: 'curl', Z: 'go', RB: 'wheel', C: 'block' }, trick: 'hookladder', desc: 'Curl, catch, then pitch it to the trailing back. Press lateral!' },
  { key: 'doublepass', name: 'Double Pass', formation: 'spread', routes: { X: 'bubble', Z: 'go', RB: 'seam', C: 'block' }, trick: 'doublepass', desc: 'Throw it backward to the receiver. HE throws it deep.' },
  { key: 'wildcat', name: 'Wildcat Power', formation: 'wildcat', routes: { QB: 'go', X: 'block', Z: 'block', C: 'block' }, type: 'run', carrier: 'RB', path: 'option', trick: 'wildcat', desc: 'The back takes the snap. The QB runs a route. Chaos.' },
  { key: 'statue', name: 'Statue of Liberty', formation: 'spread', routes: { X: 'go', Z: 'go', C: 'block' }, type: 'run', carrier: 'RB', path: 'sweepL', trick: 'statue', desc: 'Fake the throw, hand it off behind your back.' },
  { key: 'fakepunt', name: 'Fake Punt', formation: 'punt', routes: { X: 'go', Z: 'out', RB: 'flat', C: 'block' }, trick: 'fakepunt', desc: 'Everyone relaxes. Then you throw it.' },
  { key: 'fakefg', name: 'Fake Field Goal', formation: 'fg', routes: { X: 'corner', Z: 'flat', RB: 'block', C: 'block' }, trick: 'fakefg', desc: 'The holder stands up and finds a receiver.' },
  { key: 'jet', name: 'Jet Sweep', formation: 'twins', routes: { RB: 'block', X: 'block', C: 'block' }, type: 'run', carrier: 'Z', path: 'jet', trick: 'jet', desc: 'The receiver takes it full speed across the formation.' },
  { key: 'option', name: 'Speed Option', formation: 'spreadL', routes: { X: 'block', Z: 'block', C: 'block' }, type: 'run', carrier: 'QB', path: 'option', trick: 'option', desc: 'QB runs wide with the back trailing. Pitch it late.' },
  { key: 'bubble', name: 'Bubble Screen', formation: 'trips', routes: { Z: 'bubble', RB: 'block', X: 'go', C: 'block' }, desc: 'Quick toss to the slot with blockers in front.' },
  { key: 'tunnel', name: 'Tunnel Screen', formation: 'spread', routes: { X: 'smoke', Z: 'go', RB: 'block', C: 'block' }, desc: 'Receiver comes back inside behind a wall.' },
  { key: 'papost', name: 'Play-Action Post', formation: 'pistol', routes: { X: 'post', Z: 'dig', C: 'block' }, trick: 'playaction', carrier: 'RB', desc: 'Fake the dive, then hit the post behind the linebacker.' },
  { key: 'shovel', name: 'Shovel Pass', formation: 'spreadL', routes: { RB: 'shovel', X: 'go', Z: 'go', C: 'block' }, desc: 'Underhand it to the back crossing behind the line.' },
  { key: 'flood', name: 'Trips Flood', formation: 'trips', routes: { Z: 'corner', RB: 'out', X: 'drag', C: 'block' }, desc: 'Three receivers to one side. Somebody is open.' },
  { key: 'texas', name: 'Texas', formation: 'spread', routes: { RB: 'angle', X: 'dig', Z: 'go', C: 'block' }, desc: 'The back angles into the space the linebacker just left.' },
  { key: 'yankee', name: 'Yankee', formation: 'spread', routes: { X: 'deepcross', Z: 'post', RB: 'check', C: 'block' }, desc: 'Two deep crossers. The safety can only pick one.' },
  { key: 'mills', name: 'Mills', formation: 'spreadL', routes: { X: 'post', Z: 'dig', RB: 'flat', C: 'block' }, desc: 'Dig pulls the safety, post goes over the top.' },
  { key: 'pumpgo', name: 'Pump & Go', formation: 'spread', routes: { X: 'hitchgo', Z: 'hitch', RB: 'check', C: 'block' }, desc: 'Hitch, pump fake, then the receiver takes off.' },
  { key: 'outup', name: 'Out & Up', formation: 'twins', routes: { Z: 'outup', X: 'slant', RB: 'flat', C: 'block' }, desc: 'Sell the out. Then it\'s a footrace.' },
  { key: 'hbpassL', name: 'Halfback Pass Left', formation: 'spread', routes: { X: 'corner', Z: 'go', C: 'block' }, trick: 'hbpass', carrier: 'RB', path: 'sweepL', desc: 'Sweep left, then the back pulls up and throws.' },
  { key: 'fleawheel', name: 'Flea Flicker Wheel', formation: 'pistol', routes: { X: 'corner', Z: 'corner', C: 'seam' }, trick: 'fleaflicker', carrier: 'RB', desc: 'Handoff, pitch back, and even the center goes deep.' },
  { key: 'qbdraw', name: 'QB Draw', formation: 'empty', routes: { X: 'go', Z: 'go', RB: 'go', C: 'block' }, type: 'run', carrier: 'QB', path: 'draw', delay: 0.6, desc: 'Empty backfield. Everyone clears out. Run.' },
  { key: 'lateralsweep', name: 'Pitch Sweep', formation: 'spreadL', routes: { X: 'block', Z: 'block', C: 'block' }, type: 'run', carrier: 'RB', path: 'sweepL', trick: 'pitch', desc: 'A toss to the back already at full speed.' },
  { key: 'spot', name: 'Spot Concept', formation: 'bunch', routes: { X: 'spot', RB: 'flat', Z: 'corner', C: 'block' }, desc: 'Snag from a bunch. Every read is a triangle.' },
  { key: 'whip', name: 'Whip Route', formation: 'trips', routes: { RB: 'whip', Z: 'go', X: 'comeback', C: 'block' }, desc: 'In, then back out. Corners fall down.' },
  { key: 'seams', name: 'Double Seams', formation: 'empty', routes: { RB: 'seam', X: 'go', Z: 'go', C: 'block' }, desc: 'Split the safeties down the seams.' },
];

const PRICE_BY_INDEX = (i) => 200 + i * 20;

export function planetSpecialPlays(planet) {
  const rnd = makeRng(hashStr(planet.id + ':plays'));
  const picked = rnd.shuffle(SPECIAL_TEMPLATES).slice(0, 5);
  const words = rnd.shuffle(planet.words);
  return picked.map((t, i) => ({
    id: `${planet.id}_${t.key}`,
    name: `${words[i % words.length]} ${t.name}`,
    cat: 'planet', planet: planet.id, formation: t.formation, routes: t.routes,
    type: t.type || 'pass', carrier: t.carrier, path: t.path, trick: t.trick, delay: t.delay, desc: t.desc,
    price: PRICE_BY_INDEX(planet.index) + i * 60,
  }));
}

export const ALL_PLANET_PLAYS = {}; // filled lazily via getPlanetPlays
export function getPlanetPlays(planet) {
  if (!ALL_PLANET_PLAYS[planet.id]) ALL_PLANET_PLAYS[planet.id] = planetSpecialPlays(planet);
  return ALL_PLANET_PLAYS[planet.id];
}
export function findPlay(id, planets) {
  const b = BASE_PLAYS.find(p => p.id === id); if (b) return b;
  for (const pl of planets) { const f = getPlanetPlays(pl).find(p => p.id === id); if (f) return f; }
  return null;
}

// Defensive calls: assignments per role. Zones are [x, z] centers relative to the ball.
export const DEF_PLAYS = [
  { id: 'man', name: 'Man Press', desc: 'Everyone locks on a receiver. The rusher goes.', cover: { R: 'rush', LB: 'man:RB', CB1: 'man:X', CB2: 'man:Z', S: 'zone:deepmid' } },
  { id: 'zone', name: 'Zone Cover', desc: 'Flats and hook covered, safety over the top.', cover: { R: 'rush', LB: 'zone:hook', CB1: 'zone:flatL', CB2: 'zone:flatR', S: 'zone:deepmid' } },
  { id: 'thirds', name: 'Deep Thirds', desc: 'Three deep. Nothing over your head.', cover: { R: 'rush', LB: 'zone:hook', CB1: 'zone:deepL', CB2: 'zone:deepR', S: 'zone:deepmid' } },
  { id: 'blitz', name: 'Blitz', desc: 'Two rushers, man behind it. Risky.', cover: { R: 'rush', LB: 'rush', CB1: 'man:X', CB2: 'man:Z', S: 'man:RB' } },
  { id: 'prevent', name: 'Prevent', desc: 'Everybody deep. Give up the short stuff.', cover: { R: 'spy', LB: 'zone:hook', CB1: 'zone:deepL', CB2: 'zone:deepR', S: 'zone:deepmid' }, deep: true },
];
export const ZONES = {
  hook: [0, 7], flatL: [-10, 4], flatR: [10, 4], deepL: [-8, 17], deepR: [8, 17], deepmid: [0, 19], curlL: [-7, 9], curlR: [7, 9],
};

export const CATEGORIES = [
  { id: 'deep', name: 'Deep', color: '#ff6b7a' }, { id: 'mid', name: 'Mid', color: '#ffb347' }, { id: 'short', name: 'Short', color: '#7fe3a6' },
  { id: 'run', name: 'Run', color: '#7fb3ff' }, { id: 'special', name: 'Special', color: '#ff9ad5' }, { id: 'planet', name: 'Planet', color: '#c77dff' },
];

// Resolve a play into absolute pre-snap positions & waypoint lists for each role.
export function resolvePlay(play) {
  const f = FORMATIONS[play.formation];
  const out = {};
  const roles = ['QB', 'C', 'RB', 'X', 'Z'];
  for (const role of roles) {
    const start = f[role];
    const routeId = play.routes[role];
    let route = routeId ? ROUTES[routeId] : null;
    if (!route && play.carrier === role) route = { pts: [] };
    if (!route && role !== 'QB' && !(f.snapTo === role)) route = ROUTES.block; // default: block
    const mirror = start[0] > 0.5 ? -1 : 1;
    const pts = (route ? route.pts : []).map(([dx, dz]) => [start[0] + dx * mirror, start[1] + dz]);
    let path = null;
    if (play.carrier === role && play.path) {
      const raw = RUN_PATHS[play.path];
      path = raw.map(([dx, dz]) => [start[0] + dx, start[1] + dz]);
    }
    out[role] = { start: start.slice(), pts, settle: !!(route && route.settle), block: !!(route && route.block), delay: (route && route.delay) || 0, path, isCarrier: play.carrier === role, snap: f.snapTo === role || (!f.snapTo && role === 'QB') };
  }
  return out;
}
