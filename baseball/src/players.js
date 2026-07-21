// Roster + league generation for BIG INNING '27, plus the quick-sim engine
// that plays out games nobody watches. Summer-league flavor, class of '27.
import { pick, irange, rnd, genPlayerName, MASCOTS, COLOR_PRESETS } from './names.js';

const SKIN_TONES = ['#c68863', '#8d5a3b', '#5d3a26', '#e0a87f', '#a16a45', '#74462c'];

const BB_TOWNS = [
  'Copper Creek', 'Bayside', 'Dusty Flats', 'Harbor City', 'Red Mesa', 'Willow Bend',
  'Iron City', 'Palmetto', 'Summit', 'Twin Forks', 'Cannery Row', 'Prairie View',
  'Eastlake', 'Bluffton', 'Cedar Ridge', 'Millbrook',
];

export const POSITIONS = ['P', 'C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF'];

const POS_BIAS = {
  P:  { arm: 20, pow: -8 },
  C:  { arm: 12, glv: 10, spd: -8 },
  '1B': { pow: 14, con: 6, spd: -6 },
  '2B': { con: 10, glv: 8 },
  '3B': { pow: 10, arm: 8 },
  SS: { glv: 14, spd: 8, arm: 6 },
  LF: { pow: 10, con: 4 },
  CF: { spd: 16, glv: 8 },
  RF: { pow: 8, arm: 12 },
};

const POS_BUILD = { P: 'avg', C: 'big', '1B': 'big', '2B': 'slim', '3B': 'avg', SS: 'slim', LF: 'avg', CF: 'slim', RF: 'avg' };

function attr(base, bias = 0) {
  return Math.max(38, Math.min(99, Math.round(base + bias + (rnd() * 24 - 12))));
}

/** One ballplayer. quality shifts the whole card. */
export function genBallplayer(pos, quality = 0, used = new Set(), usedNums = new Set()) {
  const bias = POS_BIAS[pos] || {};
  const base = 62 + quality;
  let num = irange(1, 56);
  for (let t = 0; t < 30 && usedNums.has(num); t++) num = irange(1, 56);
  usedNums.add(num);
  const p = {
    name: genPlayerName(used),
    pos,
    num,
    build: POS_BUILD[pos] || 'avg',
    skin: pick(SKIN_TONES),
    bats: rnd() < 0.25 ? 'L' : 'R',
    con: attr(base, bias.con),    // contact
    pow: attr(base, bias.pow),    // power
    spd: attr(base, bias.spd),    // speed
    arm: attr(base, bias.arm),    // arm strength
    glv: attr(base, bias.glv),    // glove
  };
  if (pos === 'P') {
    p.velo = attr(base + 4, 6);   // pitch speed
    p.ctrl = attr(base + 2, 0);   // command
    p.brk = attr(base, 2);        // movement
  }
  return p;
}

export function overall(p) {
  if (p.pos === 'P') return Math.round((p.velo + p.ctrl + p.brk) / 3);
  return Math.round(p.con * 0.3 + p.pow * 0.25 + p.spd * 0.15 + p.arm * 0.12 + p.glv * 0.18);
}

/** A 12-man club: 9 starters + a relief arm + 2 bench bats. */
export function genClub(quality = 0) {
  const used = new Set();
  const usedNums = new Set();
  const roster = POSITIONS.map((pos) => genBallplayer(pos, quality, used, usedNums));
  const rp = genBallplayer('P', quality - 2, used, usedNums);
  rp.role = 'RP';
  roster.push(rp);
  for (const pos of ['1B', 'CF']) {
    const b = genBallplayer(pos, quality - 4, used, usedNums);
    b.role = 'BN';
    roster.push(b);
  }
  return roster;
}

export function genTeam(quality = 0, avoid = new Set()) {
  let town = pick(BB_TOWNS);
  for (let i = 0; i < 30 && avoid.has(town); i++) town = pick(BB_TOWNS);
  avoid.add(town);
  const m = pick(MASCOTS);
  const preset = pick(COLOR_PRESETS);
  return {
    name: town,
    mascot: m.name,
    logoId: m.logo,
    colors: { primary: preset.primary, secondary: preset.secondary },
    quality,
    roster: genClub(quality),
  };
}

export function teamBatting(team) {
  const bats = team.roster.filter((p) => p.pos !== 'P' || p.role === 'BN');
  return bats.reduce((a, p) => a + p.con * 0.55 + p.pow * 0.45, 0) / Math.max(1, bats.length);
}

export function teamPitching(team) {
  const arms = team.roster.filter((p) => p.pos === 'P');
  return arms.reduce((a, p) => a + (p.velo + p.ctrl + p.brk) / 3, 0) / Math.max(1, arms.length);
}

/** The batting order: everyone but the pitchers' bench role, pitcher hits ninth. */
export function battingOrder(team) {
  const starters = team.roster.filter((p) => !p.role);
  const pos = starters.filter((p) => p.pos !== 'P')
    .sort((a, b) => (b.con * 0.6 + b.pow * 0.4) - (a.con * 0.6 + a.pow * 0.4));
  const pitcher = starters.find((p) => p.pos === 'P');
  return [...pos, pitcher].filter(Boolean);
}

// ------------------------------------------------------------ quick sim
/** Sim a game between two clubs. Returns { hr, ar } (home runs scored, away). */
export function simGame(home, away) {
  const hOff = teamBatting(home), hDef = teamPitching(home);
  const aOff = teamBatting(away), aDef = teamPitching(away);
  const runsFor = (off, def, homeEdge) => {
    const mu = 2.2 + (off - def) * 0.06 + homeEdge;
    let runs = 0;
    for (let i = 0; i < 6; i++) if (rnd() < Math.max(0.06, Math.min(0.6, mu / 6))) runs += 1 + (rnd() < 0.3 ? 1 : 0);
    return runs;
  };
  let hr = runsFor(hOff, aDef, 0.25);
  let ar = runsFor(aOff, hDef, 0);
  if (hr === ar) (rnd() < 0.5 + (hOff - aOff) * 0.004) ? hr++ : ar++;
  return { hr, ar };
}

// ------------------------------------------------------------ free agents
const FA_QUIRKS = [
  'Swings a pink bat. Nobody laughs twice.',
  'Drove here straight from a night shift at the cannery.',
  'Says he once struck out twelve in church league.',
  'Chews sunflower seeds by the pound.',
  'His glove is older than your coach.',
  'Runs everywhere. Including to the parking lot.',
  'Claims the wind owes him three home runs.',
  'Wears two batting gloves to shake hands.',
  'Left his last team over a nickname dispute.',
  'Practices swings at bus stops.',
];

export function genFreeAgents(count = 6, quality = 0) {
  const used = new Set();
  const usedNums = new Set();
  return Array.from({ length: count }, () => {
    const pos = pick(POSITIONS);
    const p = genBallplayer(pos, quality + irange(-2, 10), used, usedNums);
    p.quirk = pick(FA_QUIRKS);
    p.cost = Math.max(60, Math.round((overall(p) - 48) * 14 + irange(-20, 30)));
    return p;
  });
}
