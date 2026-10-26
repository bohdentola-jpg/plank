// Rosters: every team's players are generated from the team id (same seed →
// same players every time), with ratings shaped by position and the team's
// strength, real-world builds (height/weight by position) and a look (skin,
// hair, eye black, visor, sleeves, gloves, facemask style).
//
// player = {
//   id, teamId, first, last, number, pos, pos2 (second position or null),
//   height (inches), weight (lbs), age, ovr,
//   r: { spd acc agi str awr car btk elu trk cth cit rte rbk pbk thp tha tak hit pur prc mcv zcv prs pmv fmv bsh kpw kac sta jmp },
//   look: { skin (0..1 light→dark), skinHex, hair, hairColor, beard, eyeBlack: 'none'|'stripe'|'sticker',
//           visor: null|'clear'|'smoke'|'gold'|'mirror', sleeves: 'none'|'long'|'elbow'|'arm',
//           gloves: true|false, wristbands: bool, towel: bool, neckRoll: bool, handWarmer: bool,
//           facemask: 'qb'|'skill'|'lineman'|'robot'|'cage'|'kicker', socks: 'high'|'low', shoes: 'low'|'mid'|'high',
//           armBand: bool, bodyType: 'lean'|'average'|'thick'|'big' },
// }
import { makeRng, hashString } from '../core/util.js';

export const POSITIONS = ['QB', 'RB', 'WR', 'TE', 'C', 'G', 'DL', 'LB', 'CB', 'S', 'K'];

// how many of each a team carries (7-on-7: small rosters, some two-way)
const DEPTH = { QB: 2, RB: 2, WR: 4, TE: 1, C: 1, G: 3, DL: 3, LB: 3, CB: 3, S: 2, K: 1 };

// [height in, weight lb] ranges
const BUILD = {
  QB: [[73, 77], [210, 235]], RB: [[68, 73], [195, 228]], WR: [[70, 76], [180, 215]],
  TE: [[75, 78], [240, 262]], C: [[74, 77], [295, 318]], G: [[75, 78], [300, 330]],
  DL: [[74, 78], [270, 312]], LB: [[72, 76], [225, 250]], CB: [[69, 74], [180, 200]],
  S: [[71, 75], [195, 215]], K: [[70, 74], [180, 205]],
};

// position rating templates: [mean, spread] at strength 0.75; unlisted = [45, 12]
const T = {
  QB: { spd: [70, 10], acc: [74, 8], agi: [72, 8], str: [55, 8], awr: [78, 10], car: [62, 8], btk: [55, 10], elu: [60, 12], trk: [45, 10], cth: [45, 10], thp: [86, 7], tha: [82, 8], sta: [82, 6], jmp: [60, 10] },
  RB: { spd: [88, 5], acc: [89, 5], agi: [87, 6], str: [70, 8], awr: [72, 10], car: [82, 8], btk: [78, 10], elu: [80, 10], trk: [72, 12], cth: [66, 10], cit: [55, 10], rte: [56, 10], pbk: [52, 10], rbk: [48, 8], sta: [84, 6], jmp: [78, 8] },
  WR: { spd: [90, 4], acc: [89, 5], agi: [88, 5], str: [55, 8], awr: [72, 10], car: [66, 8], btk: [55, 12], elu: [72, 12], trk: [42, 10], cth: [82, 7], cit: [76, 9], rte: [80, 8], rbk: [45, 10], sta: [84, 6], jmp: [86, 7] },
  TE: { spd: [78, 6], acc: [78, 6], agi: [72, 6], str: [74, 7], awr: [72, 10], car: [68, 8], btk: [68, 10], elu: [50, 10], trk: [70, 10], cth: [74, 8], cit: [74, 8], rte: [68, 8], rbk: [70, 8], pbk: [66, 8], sta: [82, 6], jmp: [74, 8] },
  C: { spd: [52, 6], acc: [70, 6], agi: [55, 7], str: [86, 6], awr: [78, 8], rbk: [80, 7], pbk: [82, 7], sta: [86, 5], car: [40, 8], jmp: [40, 8] },
  G: { spd: [54, 6], acc: [70, 6], agi: [54, 7], str: [88, 6], awr: [74, 8], rbk: [82, 7], pbk: [79, 7], sta: [86, 5], car: [40, 8], jmp: [40, 8] },
  DL: { spd: [70, 8], acc: [80, 6], agi: [68, 7], str: [86, 6], awr: [70, 10], tak: [76, 8], hit: [76, 10], pur: [74, 8], prc: [68, 10], pmv: [80, 8], fmv: [74, 10], bsh: [80, 8], sta: [84, 6], jmp: [60, 10] },
  LB: { spd: [82, 6], acc: [84, 5], agi: [78, 6], str: [76, 7], awr: [76, 10], tak: [84, 6], hit: [80, 8], pur: [84, 6], prc: [78, 8], mcv: [64, 10], zcv: [70, 10], prs: [55, 10], pmv: [66, 10], fmv: [62, 10], bsh: [74, 8], cth: [55, 10], sta: [86, 5], jmp: [74, 8] },
  CB: { spd: [91, 4], acc: [90, 4], agi: [90, 4], str: [52, 8], awr: [72, 10], tak: [66, 8], hit: [58, 10], pur: [80, 7], prc: [74, 9], mcv: [82, 7], zcv: [76, 8], prs: [72, 10], cth: [64, 10], bsh: [45, 10], sta: [86, 5], jmp: [86, 7] },
  S: { spd: [86, 5], acc: [86, 5], agi: [82, 5], str: [64, 8], awr: [76, 10], tak: [78, 7], hit: [76, 10], pur: [84, 6], prc: [80, 8], mcv: [70, 9], zcv: [82, 7], prs: [55, 10], cth: [68, 10], bsh: [55, 10], sta: [86, 5], jmp: [82, 8] },
  K: { spd: [62, 8], acc: [62, 8], agi: [60, 8], str: [42, 8], awr: [60, 10], kpw: [86, 7], kac: [82, 8], sta: [80, 8], tak: [35, 10], cth: [50, 10] },
};
const ALL_R = ['spd', 'acc', 'agi', 'str', 'awr', 'car', 'btk', 'elu', 'trk', 'cth', 'cit', 'rte', 'rbk', 'pbk', 'thp', 'tha', 'tak', 'hit', 'pur', 'prc', 'mcv', 'zcv', 'prs', 'pmv', 'fmv', 'bsh', 'kpw', 'kac', 'sta', 'jmp'];

// overall formulas: weighted averages of the ratings that matter
const OVR_W = {
  QB: { tha: 4, thp: 2.5, awr: 3, spd: 0.6, agi: 0.6, elu: 0.4, car: 0.3 },
  RB: { spd: 2.5, acc: 2, agi: 1.5, car: 1.8, btk: 1.6, elu: 1.6, trk: 1, cth: 0.8, awr: 0.8 },
  WR: { spd: 2.5, cth: 2.5, rte: 2, cit: 1.2, acc: 1, agi: 1, jmp: 0.8, awr: 0.8, elu: 0.5 },
  TE: { cth: 2, rbk: 1.8, pbk: 1, rte: 1.2, cit: 1.2, str: 1, spd: 1, awr: 0.8 },
  C: { pbk: 2.5, rbk: 2.5, str: 2, awr: 1.5, acc: 0.5 },
  G: { pbk: 2.3, rbk: 2.7, str: 2.2, awr: 1.2, acc: 0.5 },
  DL: { pmv: 1.6, fmv: 1.4, bsh: 2, str: 2, tak: 1.4, pur: 1, acc: 1, prc: 0.8 },
  LB: { tak: 2.2, pur: 1.8, prc: 1.6, spd: 1.4, hit: 1, zcv: 1, bsh: 1, awr: 1 },
  CB: { mcv: 2.4, zcv: 1.6, spd: 2.4, agi: 1.2, prc: 1, prs: 0.8, cth: 0.6, tak: 0.6, jmp: 0.6 },
  S: { zcv: 2, spd: 1.6, prc: 1.6, tak: 1.4, pur: 1.2, mcv: 1, hit: 0.8, cth: 0.6, awr: 1 },
  K: { kpw: 3, kac: 3 },
};

export function overall(pos, r) {
  const w = OVR_W[pos] || OVR_W.WR;
  let s = 0, n = 0;
  for (const [k, v] of Object.entries(w)) { s += (r[k] ?? 50) * v; n += v; }
  // ratings near the ceiling count for more, the way the old games' OVRs felt
  const raw = s / n;
  return Math.max(30, Math.min(99, Math.round(raw * 1.08 - 6)));
}

// ------------------------------------------------------------------ names

export const FIRST = [
  'Marcus', 'Tyrell', 'Jake', 'DeShawn', 'Cody', 'Andre', 'Brandon', 'Malik', 'Tyler', 'Jamal', 'Ryan', 'Darius', 'Kyle', 'Terrence',
  'Austin', 'Devin', 'Jordan', 'Trey', 'Cameron', 'Isaiah', 'Logan', 'Xavier', 'Chase', 'Dante', 'Garrett', 'Quentin', 'Brett', 'Jalen',
  'Colby', 'Reggie', 'Hunter', 'Lamar', 'Dalton', 'Cedric', 'Wyatt', 'Desmond', 'Nate', 'Corey', 'Luis', 'Mateo', 'Tavon', 'Shane',
  'Elijah', 'Rashad', 'Kevin', 'Bo', 'Javon', 'Clay', 'Antonio', 'Derek', 'Tomás', 'Ike', 'Keenan', 'Rocco', 'Sione', 'Kai', 'Emeka',
  'Dmitri', 'Jace', 'Vince', 'Omar', 'Calvin', 'Rodney', 'Earl', 'Myles', 'Grady', 'Thad', 'Zeke', 'Daquan', 'Mason', 'Trent', 'Kendrick',
];
export const LAST = [
  'Washington', 'Kowalski', 'Hayes', 'Brooks', 'McAllister', 'Okafor', 'Reyes', 'Holloway', 'Sanders', 'Fitzgerald', 'Pruitt', 'Gaines',
  'Lindqvist', 'Mercer', 'Tuiasosopo', 'Whitfield', 'Crenshaw', 'Delgado', 'Bishop', 'Thornton', 'Mayfield', 'Odom', 'Banks', 'Kincaid',
  'Barrow', 'Vasquez', 'Petrakis', 'Coleman', 'Ruiz', 'Huckabee', 'Jefferson', 'Nakamura', 'Strickland', 'Bledsoe', 'Moreau', 'Pittman',
  'Grayson', 'Ferrell', 'Abernathy', 'Dunlap', 'Castillo', 'Sorensen', 'Booker', 'Faleolo', 'Hargrove', 'Ivory', 'Lattimore', 'Quarles',
  'Sutton', 'Vance', 'Wilcox', 'Yates', 'Zamora', 'Ballard', 'Cobb', 'Dempsey', 'Easley', 'Gentry', 'Horn', 'Jenkins', 'Kirby', 'Lyle',
  'Mabry', 'Nunez', 'Orr', 'Pace', 'Rhodes', 'Sharpe', 'Tate', 'Upshaw', 'Ware', 'Youngblood', 'Archer', 'Beasley', 'Calloway', 'Dukes',
];

// skin tones light → dark (sRGB)
export const SKIN = ['#f1d3bd', '#e5b896', '#d4a07a', '#c08a63', '#a8714b', '#8d5a3a', '#73452b', '#5c3521', '#4a2a1a', '#3a2015'];
const HAIR_COLORS = ['#1b1612', '#2b1d14', '#3d2a1c', '#5a3d24', '#8a6a3d', '#b48c55', '#c9b28a', '#6d2f16'];
const HAIR = ['buzz', 'fade', 'short', 'twists', 'dreads', 'braids', 'afro', 'mohawk', 'bald', 'curly', 'long', 'flat'];

function clamp99(v) { return Math.max(25, Math.min(99, Math.round(v))); }

function pickNumber(pos, rng, used) {
  const ranges = {
    QB: [[1, 19]], RB: [[20, 39], [1, 9]], WR: [[80, 89], [10, 19], [1, 9]], TE: [[80, 89], [40, 49]],
    C: [[50, 79]], G: [[60, 79]], DL: [[90, 99], [50, 79]], LB: [[40, 59], [90, 99]], CB: [[20, 39], [1, 9]],
    S: [[20, 49]], K: [[1, 19]],
  }[pos];
  for (let tries = 0; tries < 60; tries++) {
    const [lo, hi] = rng.pick(ranges);
    const n = rng.int(lo, hi);
    if (!used.has(n)) { used.add(n); return n; }
  }
  for (let n = 1; n < 100; n++) if (!used.has(n)) { used.add(n); return n; }
  return 0;
}

function makeLook(pos, rng) {
  const skinI = Math.min(SKIN.length - 1, Math.floor(Math.pow(rng(), 0.85) * SKIN.length));
  const skill = ['QB', 'RB', 'WR', 'CB', 'S'].includes(pos);
  const big = ['C', 'G', 'DL'].includes(pos);
  return {
    skin: skinI / (SKIN.length - 1),
    skinHex: SKIN[skinI],
    hair: rng.pick(HAIR),
    hairColor: skinI > 4 ? HAIR_COLORS[rng.int(0, 2)] : rng.pick(HAIR_COLORS),
    beard: rng.chance(0.35) ? rng.pick(['stubble', 'goatee', 'full', 'chinstrap']) : 'none',
    eyeBlack: rng.chance(skill ? 0.55 : 0.3) ? (rng.chance(0.75) ? 'stripe' : 'sticker') : 'none',
    visor: rng.chance(skill ? 0.3 : 0.08) ? rng.pick(['clear', 'clear', 'smoke', 'gold', 'mirror']) : null,
    sleeves: big ? (rng.chance(0.3) ? 'arm' : 'none') : rng.pick(['none', 'none', 'elbow', 'long', 'arm']),
    gloves: pos === 'QB' ? rng.chance(0.25) : pos === 'K' ? false : rng.chance(big ? 0.75 : 0.92),
    wristbands: rng.chance(0.5),
    towel: rng.chance(skill ? 0.45 : 0.25),
    neckRoll: big && rng.chance(0.2),
    handWarmer: pos === 'QB' && rng.chance(0.6),
    facemask: pos === 'QB' ? 'qb' : pos === 'K' ? 'kicker' : big ? rng.pick(['lineman', 'lineman', 'cage', 'robot']) : pos === 'LB' || pos === 'TE' ? rng.pick(['robot', 'skill', 'cage']) : rng.pick(['skill', 'skill', 'qb', 'robot']),
    socks: rng.chance(0.75) ? 'high' : 'low',
    shoes: big ? rng.pick(['mid', 'high']) : rng.pick(['low', 'low', 'mid']),
    armBand: rng.chance(0.35),
    bodyType: big ? 'big' : pos === 'TE' || pos === 'LB' ? 'thick' : pos === 'RB' ? rng.pick(['thick', 'average']) : rng.pick(['lean', 'average']),
  };
}

/**
 * Generate one player.  strength 0..1 shifts every rating; `boost` adds to the
 * whole line (starters a little better than backups).
 */
export function makePlayer(pos, rng, { strength = 0.75, boost = 0, teamId = '', used = new Set(), name = null } = {}) {
  const tpl = T[pos];
  const shift = (strength - 0.75) * 30 + boost;
  const r = {};
  for (const k of ALL_R) {
    const [m, sd] = tpl[k] || [42, 10];
    r[k] = clamp99(m + shift + rng.gauss() * sd * 0.55);
  }
  const [hr, wr] = BUILD[pos];
  const height = rng.int(hr[0], hr[1]);
  // weight tracks height a little, plus spread
  const hk = (height - hr[0]) / Math.max(1, hr[1] - hr[0]);
  const weight = Math.round(wr[0] + (wr[1] - wr[0]) * (0.25 + hk * 0.5 + (rng() - 0.5) * 0.5));
  const first = name?.first || rng.pick(FIRST);
  const last = name?.last || rng.pick(LAST);
  const p = {
    id: `${teamId}-${pos}-${first}-${last}`.toLowerCase().replace(/[^a-z0-9-]/g, ''),
    teamId, first, last, pos, pos2: null,
    number: pickNumber(pos, rng, used),
    height, weight, age: rng.int(21, 33),
    r,
    look: makeLook(pos, rng),
  };
  p.ovr = overall(pos, r);
  return p;
}

const rosterCache = new Map();

/** The team's roster + depth chart (cached per team id). */
export function buildRoster(team) {
  if (rosterCache.has(team.id)) return rosterCache.get(team.id);
  const rng = makeRng(hashString('roster:' + team.id));
  const used = new Set();
  const players = [];
  const depth = {};
  const strength = team.strength ?? 0.7;
  for (const pos of POSITIONS) {
    depth[pos] = [];
    for (let k = 0; k < DEPTH[pos]; k++) {
      const boost = k === 0 ? 3 : k === 1 ? -2 : -6;
      const p = makePlayer(pos, rng, { strength, boost, teamId: team.id, used });
      players.push(p);
      depth[pos].push(p);
    }
    depth[pos].sort((a, b) => b.ovr - a.ovr);
  }
  const roster = { team, players, depth, byId: Object.fromEntries(players.map((p) => [p.id, p])) };
  rosterCache.set(team.id, roster);
  return roster;
}

/** Team ratings for the menus: OVR, OFF, DEF, plus a few headline numbers. */
export function teamRatings(team) {
  const { depth } = buildRoster(team);
  const avg = (list) => Math.round(list.reduce((s, p) => s + p.ovr, 0) / Math.max(1, list.length));
  const off = avg([depth.QB[0], depth.QB[0], depth.RB[0], depth.WR[0], depth.WR[1], depth.TE[0], depth.C[0], depth.G[0], depth.G[1]]);
  const def = avg([depth.DL[0], depth.DL[1], depth.LB[0], depth.LB[1], depth.CB[0], depth.CB[1], depth.S[0]]);
  const sp = (k) => avg([depth.RB[0], depth.WR[0], depth.WR[1], depth.CB[0], depth.CB[1], depth.S[0]].map((p) => ({ ovr: p.r[k] })));
  return { ovr: Math.round((off * 1.05 + def) / 2.05), off, def, speed: sp('spd'), qb: depth.QB[0].ovr, k: depth.K[0].ovr };
}

export function clearRosterCache() { rosterCache.clear(); }
