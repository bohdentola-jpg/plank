// Season + career state for BIG INNING '27: an 8-club summer league, a
// 14-game slate, coins, the free-agent bench outside the fence, playoffs,
// and the Road to Glory career.
import { irange, pick, rnd } from './names.js';
import { genTeam, genClub, genFreeAgents, simGame, overall, teamBatting, teamPitching, genBallplayer } from './players.js';
import { PARKS } from './parks.js';

export const SEASON_GAMES = 14;

// ------------------------------------------------------------ season
export function newSeason(userTeamInfo) {
  const avoid = new Set([userTeamInfo?.name || 'Copper Creek']);
  const you = {
    name: userTeamInfo?.name || 'Copper Creek',
    mascot: userTeamInfo?.mascot || 'Comets',
    logoId: userTeamInfo?.logoId || 'comet',
    colors: userTeamInfo?.colors || { primary: '#d35f12', secondary: '#1c1c1e' },
    quality: 2,
    roster: genClub(2),
    parkId: userTeamInfo?.parkId || 'cathedral',
  };
  const teams = [you];
  for (let i = 0; i < 7; i++) teams.push(genTeam(irange(0, 8), avoid));
  // every club calls a different yard home
  teams.forEach((t, i) => { if (!t.parkId) t.parkId = PARKS[i % PARKS.length].id; });
  const schedule = [];
  for (let w = 1; w <= SEASON_GAMES; w++) {
    schedule.push({ week: w, oppIdx: 1 + ((w - 1) % 7), home: w % 2 === 1 });
  }
  return {
    teams,
    schedule,
    week: 1,
    results: [],                    // your games: {opp, hr, ar, won, home}
    wins: Array(8).fill(0),
    losses: Array(8).fill(0),
    coins: 250,
    freeAgents: genFreeAgents(6, 2),
    faWeek: 1,
    playoffs: null,                 // { round: 0|1, alive: bool, seed, bracket }
    champion: false,
    over: false,
  };
}

export function currentOpponent(season) {
  const g = season.schedule[season.week - 1];
  return g ? season.teams[g.oppIdx] : null;
}

export function isHomeGame(season) {
  const g = season.schedule[season.week - 1];
  return g ? g.home : true;
}

/** Record your played game + sim the rest of the league that week. */
export function recordWeek(season, { userRuns, oppRuns }) {
  const g = season.schedule[season.week - 1];
  const won = userRuns > oppRuns;
  season.results.push({ opp: season.teams[g.oppIdx], hr: userRuns, ar: oppRuns, won, home: g.home });
  season.wins[0] += won ? 1 : 0;
  season.losses[0] += won ? 0 : 1;
  season.wins[g.oppIdx] += won ? 0 : 1;
  season.losses[g.oppIdx] += won ? 1 : 0;
  // sim the other six clubs against each other
  const idle = [];
  for (let i = 1; i < 8; i++) if (i !== g.oppIdx) idle.push(i);
  for (let k = 0; k + 1 < idle.length; k += 2) {
    const a = idle[k], b = idle[k + 1];
    const r = simGame(season.teams[a], season.teams[b]);
    season.wins[r.hr > r.ar ? a : b]++;
    season.losses[r.hr > r.ar ? b : a]++;
  }
  // purse
  const purse = (won ? 120 : 60) + userRuns * 8;
  season.coins += purse;
  season.week++;
  // refresh the market every other week
  if (season.week - season.faWeek >= 2) {
    season.freeAgents = genFreeAgents(6, Math.min(10, season.week));
    season.faWeek = season.week;
  }
  if (season.week > SEASON_GAMES) setupPlayoffs(season);
  return { won, purse };
}

export function standings(season) {
  return season.teams
    .map((t, i) => ({ team: t, idx: i, w: season.wins[i], l: season.losses[i] }))
    .sort((a, b) => b.w - a.w || a.l - b.l);
}

function setupPlayoffs(season) {
  const table = standings(season);
  const seed = table.findIndex((row) => row.idx === 0);
  if (seed > 3) {
    season.over = true;
    season.playoffs = { made: false };
    return;
  }
  // semifinal: 1v4, 2v3
  const oppRow = table[3 - seed];
  season.playoffs = { made: true, round: 0, seed: seed + 1, oppIdx: oppRow.idx, alive: true };
}

/** After a playoff game you played. Returns a note. */
export function recordPlayoff(season, { userRuns, oppRuns }) {
  const p = season.playoffs;
  const won = userRuns > oppRuns;
  season.coins += won ? 220 : 90;
  if (!won) {
    p.alive = false;
    season.over = true;
    return 'The run ends in the bracket. Good summer, better one next year.';
  }
  if (p.round === 0) {
    p.round = 1;
    // other semi: best two remaining seeds
    const table = standings(season).filter((r) => r.idx !== 0 && r.idx !== p.oppIdx);
    const r = simGame(table[0].team, table[1].team);
    p.oppIdx = r.hr > r.ar ? table[0].idx : table[1].idx;
    return 'Semifinal won! The championship is one game away.';
  }
  p.alive = false;
  season.over = true;
  season.champion = true;
  season.coins += 500;
  return '🏆 LEAGUE CHAMPIONS! They will paint the water tower.';
}

export function playoffOpponent(season) {
  return season.teams[season.playoffs.oppIdx];
}

// ------------------------------------------------------------ free agency
/** Sign a free agent: costs coins, swaps out the weakest same-position man. */
export function signFreeAgent(season, fa) {
  if (season.coins < fa.cost) return { ok: false, note: 'Not enough coins in the shoebox.' };
  const you = season.teams[0];
  // replace the worst player at that position (or the worst bench bat)
  const samePos = you.roster.filter((p) => p.pos === fa.pos);
  const victim = (samePos.length ? samePos : you.roster.filter((p) => p.role === 'BN'))
    .sort((a, b) => overall(a) - overall(b))[0] || you.roster[you.roster.length - 1];
  const idx = you.roster.indexOf(victim);
  const keptRole = victim.role;
  const signed = { ...fa };
  delete signed.cost;
  delete signed.quirk;
  if (keptRole) signed.role = keptRole;
  you.roster[idx] = signed;
  season.coins -= fa.cost;
  season.freeAgents = season.freeAgents.filter((p) => p !== fa);
  return { ok: true, note: `${fa.name} signs. ${victim.name} clears out his locker.`, cut: victim.name };
}

// ------------------------------------------------------------ road to glory
export const RTG_GAMES = 12;

export const RTG_UPGRADES = [
  { id: 'con', label: 'CONTACT', cost: 10 },
  { id: 'pow', label: 'POWER', cost: 12 },
  { id: 'spd', label: 'SPEED', cost: 8 },
  { id: 'arm', label: 'ARM', cost: 8 },
  { id: 'glv', label: 'GLOVE', cost: 8 },
];

const RTG_CLUB_LADDER = [
  [14, 'Twin Forks Miners', '★★'],
  [30, 'Harbor City Admirals', '★★★'],
  [48, 'Capital Crowns', '★★★★'],
  [66, 'Coast League Pilots', '★★★★'],
  [84, 'The Continental Club', '★★★★★'],
];

export function newRtg(athlete, teamInfo) {
  const team = {
    name: teamInfo?.name || 'Copper Creek',
    mascot: teamInfo?.mascot || 'Comets',
    logoId: teamInfo?.logoId || 'comet',
    colors: teamInfo?.colors || { primary: '#d35f12', secondary: '#1c1c1e' },
    quality: 2,
    roster: genClub(2),
  };
  // you take over the CF spot (or your chosen position)
  const pos = athlete?.pos || 'CF';
  const me = {
    name: athlete?.name || 'Sam Cross',
    num: athlete?.num || 9,
    pos,
    build: athlete?.build || 'avg',
    skin: athlete?.look?.skin || '#c68863',
    look: athlete?.look || {},
    bats: 'R',
    con: 62, pow: 58, spd: 66, arm: 60, glv: 60,
    isHero: true,
  };
  const slot = team.roster.findIndex((p) => p.pos === pos && !p.role);
  if (slot >= 0) team.roster[slot] = me;
  team.parkId = teamInfo?.parkId || 'cathedral';
  const schedule = [];
  for (let g = 1; g <= RTG_GAMES; g++) {
    const opp = genTeam(irange(0, 3 + g), new Set([team.name]));
    opp.parkId = PARKS[g % PARKS.length].id;
    schedule.push({ game: g, opp, home: g % 2 === 1 });
  }
  return {
    name: me.name,
    num: me.num,
    pos,
    me,
    team,
    schedule,
    game: 1,
    xp: 0,
    fame: 5,
    record: [],
    stats: { ab: 0, hits: 0, doubles: 0, triples: 0, hr: 0, rbi: 0, runs: 0, bb: 0, k: 0 },
    offers: [],
    seasonOver: false,
    signed: null,
    fromAthlete: !!athlete?.fromAthlete,
  };
}

export function rtgAvg(rtg) {
  return rtg.stats.ab ? rtg.stats.hits / rtg.stats.ab : 0;
}

export function rtgStars(rtg) { return Math.max(0, Math.min(5, Math.floor(rtg.fame / 20))); }

export function refreshRtgOffers(rtg) {
  for (const [need, club, stars] of RTG_CLUB_LADDER) {
    if (rtg.fame >= need && !rtg.offers.find((o) => o.club === club)) {
      rtg.offers.push({ club, stars, game: rtg.game });
    }
  }
}

export function rtgBuyUpgrade(rtg, id) {
  const u = RTG_UPGRADES.find((x) => x.id === id);
  if (!u || rtg.xp < u.cost || rtg.me[id] >= 99) return false;
  rtg.xp -= u.cost;
  rtg.me[id] = Math.min(99, rtg.me[id] + 2);
  return true;
}

/** Generate the situation for one of your plate appearances. */
export function rtgPaContext(rtg, paIndex) {
  const inning = Math.min(9, 1 + paIndex * 2 + irange(0, 1));
  const outs = irange(0, 2);
  const bases = [rnd() < 0.32, rnd() < 0.22, rnd() < 0.14];
  const opp = rtg.schedule[rtg.game - 1].opp;
  const pitcher = opp.roster.find((p) => p.pos === 'P' && !p.role) || genBallplayer('P', opp.quality);
  return { inning, outs, bases, pitcher };
}

/** Fold your PA results into a simmed team game. */
export function rtgGameResult(rtg, paResults) {
  const entry = rtg.schedule[rtg.game - 1];
  const opp = entry.opp;
  const base = simGame(entry.home ? rtg.team : opp, entry.home ? opp : rtg.team);
  let us = entry.home ? base.hr : base.ar;
  let them = entry.home ? base.ar : base.hr;
  let fame = 0, xp = 4;
  const s = rtg.stats;
  for (const pa of paResults) {
    if (pa.outcome === 'bb') { s.bb++; fame += 1; }
    else {
      s.ab++;
      if (pa.outcome === 'k') { s.k++; fame -= 1; }
      else if (pa.outcome === 'out') { /* nothing */ }
      else {
        s.hits++;
        fame += 3;
        xp += 2;
        if (pa.outcome === 'double') s.doubles++;
        if (pa.outcome === 'triple') { s.triples++; fame += 2; }
        if (pa.outcome === 'hr') { s.hr++; s.runs++; fame += 7; xp += 3; }
      }
    }
    s.rbi += pa.rbi || 0;
    us += (pa.runs || 0);
    fame += (pa.rbi || 0) * 2;
  }
  // your bat can steal a win
  const won = us > them || (us === them && rnd() < 0.5 + fame * 0.01 ? (us++, true) : (them++, false));
  rtg.record.push({ opp: `${opp.name} ${opp.mascot}`, us, them, won });
  rtg.fame = Math.max(0, rtg.fame + Math.max(-2, fame) + (won ? 3 : 0));
  rtg.xp += xp + Math.max(0, fame);
  refreshRtgOffers(rtg);
  rtg.game++;
  if (rtg.game > RTG_GAMES) rtg.seasonOver = true;
  return { won, us, them, fame: Math.max(-2, fame) + (won ? 3 : 0), xp: xp };
}

// weekly flavor between RTG games
export const RTG_EVENTS = [
  {
    title: 'CAGES AFTER DARK',
    text: 'The batting cage light stays on till ten if you know which fence board swings loose.',
    options: [
      { label: 'Extra rounds off the tee', fx: '+6 XP', effect: (r) => { r.xp += 6; } },
      { label: 'Rest the hands', fx: 'Fame +2 — fresh for the crowd', effect: (r) => { r.fame += 2; } },
    ],
  },
  {
    title: 'A RADIO MAN AT THE FENCE',
    text: 'The county station wants a word with the kid everyone keeps talking about.',
    options: [
      { label: 'Give the interview', fx: 'Fame +5', effect: (r) => { r.fame += 5; } },
      { label: '"Talk to my bat."', fx: '+4 XP, mystique intact', effect: (r) => { r.xp += 4; } },
    ],
  },
  {
    title: 'GLOVE LEATHER, CRACKED',
    text: 'Your gamer finally split a lace. The shop wants coins you do not have — but the cobbler likes baseball.',
    options: [
      { label: 'Fix it yourself', fx: 'GLOVE +1', effect: (r) => { r.me.glv = Math.min(99, r.me.glv + 1); } },
      { label: 'Play it loose', fx: '+3 XP, live dangerously', effect: (r) => { r.xp += 3; } },
    ],
  },
  {
    title: 'THE VETERAN ON THE BENCH',
    text: 'Old Delgado has seen ten thousand curveballs. He offers to show you the shape of one.',
    options: [
      { label: 'Sit with him', fx: 'CONTACT +1', effect: (r) => { r.me.con = Math.min(99, r.me.con + 1); } },
      { label: 'Run stairs instead', fx: 'SPEED +1', effect: (r) => { r.me.spd = Math.min(99, r.me.spd + 1); } },
    ],
  },
];

export function rtgEvent(rtg) {
  return RTG_EVENTS[(rtg.game * 3 + rtg.record.length) % RTG_EVENTS.length];
}
