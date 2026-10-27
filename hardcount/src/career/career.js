// ROAD TO GLORY — the career, as data. A high-school senior with something to
// prove → signing day → three or four years of college → the draft → the
// Sevens League → the Glory Bowl → the Hall of Fame. One save, in
// localStorage. Your games are played on the field (screens/match.js with
// you locked to your man); everybody else's are simulated here.
import { makeRng, hashString, clamp } from '../core/util.js';
import { store } from '../core/settings.js';
import { TEAMS, COLLEGES, HS_RIVALS, getTeam, COLLEGE_CONFERENCES } from '../data/teams.js';
import { buildRoster, makePlayer, overall, teamRatings } from '../data/roster.js';
import { HOMETOWNS } from '../data/names.js';

export const SAVE = 'career';
export const POSITIONS = ['QB', 'RB', 'WR', 'TE', 'LB', 'CB', 'S'];
export const POS_NAMES = { QB: 'QUARTERBACK', RB: 'RUNNING BACK', WR: 'WIDE RECEIVER', TE: 'TIGHT END', LB: 'LINEBACKER', CB: 'CORNERBACK', S: 'SAFETY' };

export const ARCHETYPES = {
  QB: [{ id: 'pocket', name: 'POCKET PASSER', boost: { thp: 7, tha: 8, awr: 5 } }, { id: 'dual', name: 'DUAL THREAT', boost: { spd: 9, acc: 6, agi: 6, elu: 6, tha: 2 } }],
  RB: [{ id: 'power', name: 'POWER BACK', boost: { trk: 9, btk: 8, str: 6, car: 4 } }, { id: 'speed', name: 'SPEED BACK', boost: { spd: 7, acc: 7, elu: 8, agi: 4 } }],
  WR: [{ id: 'deep', name: 'DEEP THREAT', boost: { spd: 7, jmp: 6, cit: 5, acc: 3 } }, { id: 'route', name: 'ROUTE RUNNER', boost: { rte: 9, cth: 7, agi: 5 } }],
  TE: [{ id: 'vertical', name: 'VERTICAL THREAT', boost: { spd: 6, cth: 7, rte: 5 } }, { id: 'blocking', name: 'BLOCKING TIGHT END', boost: { rbk: 9, pbk: 7, str: 6 } }],
  LB: [{ id: 'thumper', name: 'RUN STOPPER', boost: { tak: 9, hit: 8, bsh: 6, str: 3 } }, { id: 'cover', name: 'COVERAGE LINEBACKER', boost: { zcv: 9, mcv: 7, spd: 4, prc: 4 } }],
  CB: [{ id: 'shutdown', name: 'SHUTDOWN CORNER', boost: { mcv: 9, prs: 8, agi: 4 } }, { id: 'ballhawk', name: 'BALLHAWK', boost: { zcv: 7, cth: 9, prc: 6 } }],
  S: [{ id: 'hitter', name: 'ENFORCER', boost: { hit: 9, tak: 8, pur: 5 } }, { id: 'center', name: 'CENTERFIELDER', boost: { zcv: 9, spd: 5, cth: 6, prc: 4 } }],
};

// the ratings that matter for each position (training, growth, grades)
export const KEY_RATINGS = {
  QB: ['tha', 'thp', 'awr', 'spd', 'agi', 'elu'],
  RB: ['spd', 'acc', 'agi', 'car', 'btk', 'elu', 'trk', 'cth'],
  WR: ['spd', 'acc', 'cth', 'rte', 'cit', 'jmp', 'agi', 'elu'],
  TE: ['cth', 'rte', 'cit', 'rbk', 'pbk', 'str', 'spd'],
  LB: ['tak', 'hit', 'pur', 'prc', 'zcv', 'mcv', 'bsh', 'spd'],
  CB: ['mcv', 'zcv', 'spd', 'agi', 'prs', 'prc', 'cth', 'tak'],
  S: ['zcv', 'mcv', 'spd', 'tak', 'hit', 'pur', 'prc', 'cth'],
};
export const RATING_NAMES = {
  spd: 'SPEED', acc: 'ACCELERATION', agi: 'AGILITY', str: 'STRENGTH', awr: 'AWARENESS', car: 'CARRYING', btk: 'BREAK TACKLE', elu: 'ELUSIVENESS',
  trk: 'TRUCKING', cth: 'CATCHING', cit: 'CATCH IN TRAFFIC', rte: 'ROUTE RUNNING', rbk: 'RUN BLOCK', pbk: 'PASS BLOCK', thp: 'THROW POWER',
  tha: 'THROW ACCURACY', tak: 'TACKLE', hit: 'HIT POWER', pur: 'PURSUIT', prc: 'PLAY RECOGNITION', mcv: 'MAN COVERAGE', zcv: 'ZONE COVERAGE',
  prs: 'PRESS', bsh: 'BLOCK SHEDDING', jmp: 'JUMPING', sta: 'STAMINA',
};

const BOWLS = ['CITRUS PALMS BOWL', 'COPPER CANYON BOWL', 'LIBERTY HARBOR BOWL', 'SUGARCANE BOWL', 'NORTHERN LIGHTS BOWL', 'GREAT PLAINS BOWL'];

// ------------------------------------------------------------------ save / load

export function loadCareer() { return store.load(SAVE); }
export function saveCareer(c) { c.savedAt = Date.now(); store.save(SAVE, c); }
export function hasCareer() { return !!store.load(SAVE); }

// ------------------------------------------------------------------ creation

export function draftPlayer({ first, last, pos, arche, number, hometown, look = {}, seed }) {
  const rng = makeRng(seed ?? hashString(`${first}${last}${pos}${Date.now()}`));
  const p = makePlayer(pos, rng, { strength: 0.42, boost: 0, teamId: 'rtg' });
  const a = (ARCHETYPES[pos] || []).find((x) => x.id === arche) || ARCHETYPES[pos]?.[0];
  for (const [k, v] of Object.entries(a?.boost || {})) p.r[k] = clamp(Math.round(p.r[k] + v), 25, 99);
  p.id = 'rtg-you';
  p.first = first; p.last = last;
  p.number = number ?? p.number;
  p.pos = pos;
  p.arche = a?.id;
  p.archeName = a?.name;
  p.age = 17;
  p.look = { ...p.look, ...look };
  p.hometown = hometown;
  p.ovr = overall(pos, p.r);
  return p;
}

export function newCareer({ player, school }) {
  const c = {
    version: 1,
    player,
    stage: 'hs',
    year: 1,          // year within the stage
    age: 17,
    team: school,
    depth: 'starter',
    xp: 0,
    stars: 2,
    offers: [],
    messages: [],
    news: [],
    history: [],
    stats: {},        // career totals by stage: { hs: {...}, college: {...}, pro: {...} }
    awards: [],
    rings: 0,
    created: Date.now(),
    settings: { qlen: 3, difficulty: 'pro' },
  };
  c.season = makeSeason(c);
  text(c, 'COACH BRANDT', `Senior year, ${player.first}. Scouts will be in the stands every Friday. Give them something to write about.`);
  text(c, 'MOM', 'So proud of you!! Eat something before the game. ❤');
  saveCareer(c);
  return c;
}

// ------------------------------------------------------------------ seasons

function teamPool(stage) { return stage === 'hs' ? HS_RIVALS : stage === 'college' ? COLLEGES : TEAMS; }

export function makeSeason(c) {
  const rng = makeRng(hashString(`${c.player.id}:${c.stage}:${c.year}:${c.created}`));
  const pool = teamPool(c.stage);
  const me = getTeam(c.team);
  const others = pool.filter((t) => t.id !== me.id);
  let opps;
  if (c.stage === 'hs') opps = shuffle(rng, others).slice(0, 6);
  else if (c.stage === 'college') {
    const conf = pool.filter((t) => t.conference === me.conference && t.id !== me.id);
    const non = shuffle(rng, others.filter((t) => t.conference !== me.conference)).slice(0, 3);
    opps = shuffle(rng, [...conf, ...non]).slice(0, 8);
  } else {
    const div = pool.filter((t) => t.conference === me.conference && t.division === me.division && t.id !== me.id);
    const rest = shuffle(rng, others.filter((t) => !div.includes(t))).slice(0, 4);
    opps = shuffle(rng, [...div, ...div, ...rest]).slice(0, 10);
  }
  const games = opps.map((t, i) => ({ week: i + 1, opp: t.id, home: i % 2 === 0, result: null, kind: 'regular' }));
  // everybody else's records for the standings
  const table = {};
  for (const t of pool) table[t.id] = { w: 0, l: 0, pf: 0, pa: 0 };
  return { stage: c.stage, year: c.year, games, week: 0, table, done: false, post: null };
}

function shuffle(rng, a) {
  const b = a.slice();
  for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; }
  return b;
}

/** The next game to play (regular or post-season), or null. */
export function nextGame(c) {
  const s = c.season;
  const g = s.games.find((x) => !x.result);
  return g || null;
}

/** A quick score for a game nobody watched: ratings + home field + luck. */
export function simScore(rng, home, away) {
  const a = teamRatings(home).ovr, b = teamRatings(away).ovr;
  const edge = (a - b) / 10 + 0.25;
  const base = 17 + rng.gauss() * 6;
  let hs = Math.max(0, Math.round((base + edge * 4 + rng.gauss() * 7) / 7 * 1.0) * 7 + (rng() < 0.3 ? 3 : 0) - (rng() < 0.15 ? 1 : 0));
  let as = Math.max(0, Math.round((base - edge * 4 + rng.gauss() * 7) / 7) * 7 + (rng() < 0.3 ? 3 : 0) - (rng() < 0.15 ? 1 : 0));
  if (hs === as) { if (rng() < 0.5 + edge * 0.1) hs += 3; else as += 3; }
  return [hs, as];
}

/** Everybody else plays their week. */
function simWeek(c, week) {
  const s = c.season;
  const rng = makeRng(hashString(`${c.created}:${c.stage}:${c.year}:w${week}`));
  const pool = teamPool(c.stage).filter((t) => t.id !== c.team && t.id !== s.games[week - 1]?.opp);
  const order = shuffle(rng, pool);
  for (let i = 0; i + 1 < order.length; i += 2) {
    const [hs, as] = simScore(rng, order[i], order[i + 1]);
    rec(s.table, order[i].id, hs, as);
    rec(s.table, order[i + 1].id, as, hs);
  }
}

function rec(table, id, pf, pa) {
  const r = table[id] || (table[id] = { w: 0, l: 0, pf: 0, pa: 0 });
  r.pf += pf; r.pa += pa;
  if (pf > pa) r.w++; else r.l++;
}

export function standings(c, filter = null) {
  const s = c.season;
  const pool = teamPool(c.stage).filter((t) => !filter || filter(t));
  return pool.map((t) => ({ team: t, ...(s.table[t.id] || { w: 0, l: 0, pf: 0, pa: 0 }) }))
    .sort((a, b) => (b.w - a.w) || ((b.pf - b.pa) - (a.pf - a.pa)));
}

// ------------------------------------------------------------------ your game

/** The rosters for your team's game: you on the depth chart (starter or backup). */
export function careerRoster(c) {
  const team = getTeam(c.team);
  const base = buildRoster(team);
  const you = { ...c.player, teamId: team.id };
  const depth = {};
  for (const [pos, list] of Object.entries(base.depth)) depth[pos] = list.slice();
  const list = depth[you.pos] || (depth[you.pos] = []);
  if (c.depth === 'starter') list.unshift(you); else list.splice(Math.min(1, list.length), 0, you);
  const players = [...base.players, you];
  return { team, players, depth, byId: { ...base.byId, [you.id]: you } };
}

/** Starter or backup: you have to be at least as good as the man ahead of you. */
export function depthFor(c) {
  const base = buildRoster(getTeam(c.team));
  const ahead = base.depth[c.player.pos]?.[0];
  if (!ahead) return 'starter';
  const bonus = c.stage === 'hs' ? 6 : c.stage === 'college' ? (c.year >= 2 ? 3 : -2) : (c.year >= 2 ? 2 : -3);
  return c.player.ovr + bonus >= ahead.ovr ? 'starter' : 'backup';
}

export function matchParams(c) {
  const g = nextGame(c);
  if (!g) return null;
  const me = getTeam(c.team), opp = getTeam(g.opp);
  const home = g.home ? me : opp, away = g.home ? opp : me;
  const side = g.home ? 'home' : 'away';
  const roster = careerRoster(c);
  const venue = c.stage === 'hs' ? 'friday' : c.stage === 'college' ? 'college' : (home.venue || 'bayside');
  return {
    home: home.id, away: away.id, user: side, mode: 'career',
    lock: { side, player: roster.byId[c.player.id] },
    rosters: { [side]: roster },
    lockReturns: ['RB', 'WR', 'CB'].includes(c.player.pos),
    qlen: c.settings?.qlen || 3, difficulty: c.settings?.difficulty || 'pro',
    venue, time: c.stage === 'hs' ? 'night' : g.kind === 'final' ? 'night' : undefined,
    gameLabel: gameLabel(c, g),
  };
}

export function gameLabel(c, g) {
  if (g.kind === 'regular') return `${c.stage === 'pro' ? 'WEEK' : 'GAME'} ${g.week}`;
  return g.name || g.kind.toUpperCase();
}

/** What a game was worth: a grade from your line for your position. */
export function gradeGame(pos, s = {}, won = false) {
  let pts = 0;
  switch (pos) {
    case 'QB': pts = (s.passYds || 0) * 0.04 + (s.passTd || 0) * 4 - (s.intsThrown || 0) * 4 + (s.rushYds || 0) * 0.08 + (s.td || 0) * 3 + ((s.comp || 0) / Math.max(1, s.att || 0) - 0.55) * 12; break;
    case 'RB': pts = (s.rushYds || 0) * 0.09 + (s.recYds || 0) * 0.07 + (s.td || 0) * 5 - (s.fumbles || 0) * 4 + (s.brokenTackles || 0) * 0.7; break;
    case 'WR': case 'TE': pts = (s.recYds || 0) * 0.09 + (s.rec || 0) * 0.6 + (s.td || 0) * 5 - (s.drops || 0) * 2; break;
    default: pts = (s.tackles || 0) * 1.1 + (s.sacks || 0) * 4 + (s.ints || 0) * 6 + (s.passDefended || 0) * 2 + (s.forcedFumbles || 0) * 4 + (s.td || 0) * 6;
  }
  pts += won ? 2 : 0;
  const G = [[16, 'A+'], [12, 'A'], [9, 'B+'], [6.5, 'B'], [4.5, 'C+'], [3, 'C'], [1.5, 'D'], [-99, 'F']];
  const g = G.find(([th]) => pts >= th)[1];
  return { grade: g, pts };
}

const GRADE_XP = { 'A+': 420, A: 340, 'B+': 270, B: 210, 'C+': 160, C: 120, D: 80, F: 50 };

/**
 * Fold your game in: the score, your stats, the grade, XP, the standings,
 * texts and headlines, and whatever happens next (playoffs, signing day…).
 * result = { score: {home, away}, stats (Match.stats), home, away }
 */
export function applyGame(c, result) {
  const s = c.season;
  const g = nextGame(c);
  if (!g) return null;
  const side = g.home ? 'home' : 'away';
  const us = result.score[side], them = result.score[side === 'home' ? 'away' : 'home'];
  const won = us > them;
  const mine = result.stats?.players?.get?.(c.player.id) || result.stats?.players?.[c.player.id] || {};
  const line = pickLine(c.player.pos, mine);
  const { grade } = gradeGame(c.player.pos, mine, won);
  g.result = { us, them, won, line, grade, stats: { ...mine } };
  rec(s.table, c.team, us, them);
  rec(s.table, g.opp, them, us);
  if (g.kind === 'regular') simWeek(c, g.week);
  // totals
  const tot = c.stats[c.stage] || (c.stats[c.stage] = {});
  for (const [k, v] of Object.entries(mine)) if (typeof v === 'number' && !['num'].includes(k)) tot[k] = (tot[k] || 0) + v;
  tot.games = (tot.games || 0) + 1;
  tot.wins = (tot.wins || 0) + (won ? 1 : 0);
  const xp = GRADE_XP[grade] + (won ? 60 : 0) + (g.kind !== 'regular' ? 120 : 0);
  c.xp += xp;
  const opp = getTeam(g.opp);
  headline(c, gameHeadline(c, opp, us, them, won, line, grade));
  reactTexts(c, g, won, grade, opp);
  s.week = g.week;
  advanceSeason(c);
  saveCareer(c);
  return { grade, xp, won, us, them, line };
}

function pickLine(pos, s) {
  if (pos === 'QB') return `${s.comp || 0}/${s.att || 0}, ${s.passYds || 0} YDS, ${s.passTd || 0} TD${s.intsThrown ? `, ${s.intsThrown} INT` : ''}${s.rushYds ? ` · ${s.rushYds} RUSH` : ''}`;
  if (pos === 'RB') return `${s.car || 0} CAR, ${s.rushYds || 0} YDS${s.td ? `, ${s.td} TD` : ''}${s.rec ? ` · ${s.rec} REC ${s.recYds || 0}` : ''}`;
  if (pos === 'WR' || pos === 'TE') return `${s.rec || 0} REC, ${s.recYds || 0} YDS${s.td ? `, ${s.td} TD` : ''}`;
  return `${s.tackles || 0} TKL${s.sacks ? `, ${s.sacks} SACK` : ''}${s.ints ? `, ${s.ints} INT` : ''}${s.passDefended ? `, ${s.passDefended} PD` : ''}`;
}

// the verb agrees with the team: THE GRIZZLIES ROUT, THE TIDE ROUTS
const verb = (team, plural, singular) => (/(S|MEN)$/.test(team) ? plural : singular);

function gameHeadline(c, opp, us, them, won, line, grade) {
  const me = getTeam(c.team).name.toUpperCase(), op = opp.name.toUpperCase();
  const nm = c.player.last.toUpperCase();
  // the paper only writes about you when you did something
  const good = /^[AB]/.test(grade || '');
  if (won) {
    if (us - them >= 21) return `${me} ${verb(me, 'ROUT', 'ROUTS')} ${op} ${us}-${them}${good ? `; ${nm}: ${line}` : ''}`;
    if (good) return `${nm} LEADS ${me} PAST ${op}, ${us}-${them}`;
    return `${me} ${us - them <= 3 ? verb(me, 'EDGE', 'EDGES') : verb(me, 'BEAT', 'BEATS')} ${op} ${us}-${them}`;
  }
  const by = them - us;
  const how = by <= 7 ? verb(op, 'HOLD OFF', 'HOLDS OFF') : by >= 21 ? verb(op, 'ROUT', 'ROUTS') : verb(op, 'BEAT', 'BEATS');
  return `${op} ${how} ${me} ${them}-${us}${good ? ` DESPITE ${nm} (${line})` : ''}`;
}

function reactTexts(c, g, won, grade, opp) {
  const good = grade.startsWith('A');
  if (c.stage === 'hs') {
    if (good) text(c, pickRecruiter(c), `Great tape tonight vs ${opp.name}. We're watching, ${c.player.first}.`);
    if (!won && Math.random() < 0.5) text(c, 'COACH BRANDT', 'Shake it off. Film at 7am.');
  } else if (c.stage === 'college') {
    if (good && Math.random() < 0.5) text(c, 'TEAMMATE', `${c.player.last.toUpperCase()}!!! You were cooking out there`);
    if (good && c.year >= 2 && Math.random() < 0.4) text(c, 'AGENT (UNREGISTERED)', 'Big things coming for you. Call me. Strictly off the record.');
  } else {
    if (good) text(c, 'AGENT', 'Front office loved that one. Keep stacking games.');
  }
  if (Math.random() < 0.25) text(c, 'MOM', won ? 'We were screaming at the TV!!' : 'Proud of you no matter what. Call me.');
}

function pickRecruiter(c) {
  const offers = COLLEGES.filter((t) => t.strength <= starsCap(c.stars) + 0.05);
  const t = offers[Math.floor(Math.random() * offers.length)] || COLLEGES[0];
  return `${t.city.toUpperCase()} RECRUITING`;
}

export function text(c, from, body) {
  c.messages.unshift({ from, body, t: Date.now(), read: false });
  c.messages = c.messages.slice(0, 40);
}
export function headline(c, h) {
  c.news.unshift({ h, stage: c.stage, year: c.year, t: Date.now() });
  c.news = c.news.slice(0, 30);
}

// ------------------------------------------------------------------ the post-season and the stages

function starsCap(stars) { return [0.5, 0.58, 0.66, 0.75, 0.84, 0.95][clamp(stars, 0, 5)]; }

export function recruitStars(c) {
  const tot = c.stats.hs || {};
  const g = Math.max(1, tot.games || 1);
  const prod = gradeGame(c.player.pos, Object.fromEntries(Object.entries(tot).map(([k, v]) => [k, typeof v === 'number' ? v / g : v])), false).pts;
  const score = (c.player.ovr - 55) * 0.18 + prod * 0.22 + (tot.wins || 0) * 0.12;
  return clamp(Math.round(score), 1, 5);
}

function advanceSeason(c) {
  const s = c.season;
  if (nextGame(c)) return;
  // the regular season is done: who goes on?
  const myRec = s.table[c.team];
  if (!s.post) {
    s.post = 'checked';
    if (c.stage === 'hs' && myRec.w >= 4) {
      const strong = standings(c).filter((r) => r.team.id !== c.team).slice(0, 2);
      s.games.push({ week: s.games.length + 1, opp: strong[0].team.id, home: true, result: null, kind: 'semi', name: 'STATE SEMIFINAL' });
      text(c, 'COACH BRANDT', 'We\'re in. State semis. Lock in.');
      return;
    }
    if (c.stage === 'college') {
      const conf = standings(c, (t) => t.conference === getTeam(c.team).conference);
      const top2 = conf.slice(0, 2).map((r) => r.team.id);
      if (top2.includes(c.team)) {
        const opp = top2.find((id) => id !== c.team);
        s.games.push({ week: s.games.length + 1, opp, home: conf[0].team.id === c.team, result: null, kind: 'final', name: `${(getTeam(c.team).conference || 'CONFERENCE').toUpperCase()} CHAMPIONSHIP` });
        text(c, 'COACH', 'Conference title game. This is what we came here for.');
        return;
      }
      if (myRec.w >= 4) { addBowl(c); return; }
    }
    if (c.stage === 'pro') {
      const me = getTeam(c.team);
      const conf = standings(c, (t) => t.conference === me.conference);
      const top2 = conf.slice(0, 2).map((r) => r.team.id);
      if (top2.includes(c.team)) {
        const opp = top2.find((id) => id !== c.team);
        s.games.push({ week: s.games.length + 1, opp, home: conf[0].team.id === c.team, result: null, kind: 'semi', name: `${me.conference === 'AC' ? 'AMERICAN' : 'NATIONAL'} CONFERENCE FINAL` });
        text(c, 'AGENT', 'Playoffs. Legacies are made in January.');
        return;
      }
    }
  } else {
    // a post-season game was just played
    const last = s.games[s.games.length - 1];
    if (last.result?.won) {
      if (c.stage === 'hs' && last.kind === 'semi') {
        const opp = standings(c).find((r) => r.team.id !== c.team && r.team.id !== last.opp).team.id;
        s.games.push({ week: s.games.length + 1, opp, home: false, result: null, kind: 'final', name: 'STATE CHAMPIONSHIP' });
        return;
      }
      if (c.stage === 'college' && last.kind === 'final') { award(c, `${(getTeam(c.team).conference || '').toUpperCase()} CHAMPIONS`, true); addBowl(c, true); return; }
      if (c.stage === 'pro' && last.kind === 'semi') {
        const me = getTeam(c.team);
        const other = standings(c, (t) => t.conference !== me.conference)[0].team.id;
        s.games.push({ week: s.games.length + 1, opp: other, home: Math.random() < 0.5, result: null, kind: 'final', name: 'THE GLORY BOWL' });
        text(c, 'AGENT', 'THE GLORY BOWL. Everything you\'ve worked for.');
        return;
      }
      if (last.kind === 'final' || last.kind === 'bowl') {
        if (c.stage === 'hs') award(c, 'STATE CHAMPIONS', true);
        if (c.stage === 'pro' && last.kind === 'final') { c.rings++; award(c, 'GLORY BOWL CHAMPIONS', true); }
        if (c.stage === 'college' && last.kind === 'bowl') award(c, `${last.name} CHAMPIONS`, true);
      }
    } else if (c.stage === 'college' && last.kind === 'final') { addBowl(c); return; }
  }
  s.done = true;
}

function addBowl(c, big = false) {
  const s = c.season;
  const rng = makeRng(hashString(`${c.created}:bowl:${c.year}`));
  const opp = shuffle(rng, COLLEGES.filter((t) => t.conference !== getTeam(c.team).conference))[0];
  s.games.push({ week: s.games.length + 1, opp: opp.id, home: false, result: null, kind: 'bowl', name: big ? 'THE GRANDSTAND BOWL' : BOWLS[Math.floor(rng() * BOWLS.length)] });
  text(c, 'COACH', 'Bowl bid is in. Pack for somewhere warm.');
}

function award(c, name, team = false) {
  c.awards.push({ name, stage: c.stage, year: c.year, team: team ? getTeam(c.team).name : null });
  headline(c, `${name}!`);
}

/**
 * The season is over: awards, growth, and what comes next. Returns the event
 * the hub should present: { kind: 'signing' | 'draft' | 'nextSeason' | 'declare' | 'retireOption' | 'retired', … }
 */
export function endSeason(c) {
  const s = c.season;
  const tot = c.stats[c.stage] || {};
  const myRec = s.table[c.team] || { w: 0, l: 0 };
  c.history.push({ stage: c.stage, year: c.year, team: c.team, w: myRec.w, l: myRec.l, line: seasonLine(c), awards: c.awards.filter((a) => a.stage === c.stage && a.year === c.year).map((a) => a.name) });
  // individual awards from your season
  const games = s.games.filter((g) => g.result);
  const avg = games.reduce((a, g) => a + gradeGame(c.player.pos, g.result.stats, g.result.won).pts, 0) / Math.max(1, games.length);
  if (c.stage === 'college' && avg >= 10 && myRec.w >= 6) award(c, 'THE GLORY TROPHY (BEST PLAYER IN THE NATION)');
  else if (c.stage === 'college' && avg >= 7) award(c, 'ALL-CONFERENCE');
  if (c.stage === 'pro' && avg >= 10) award(c, 'SEVENS LEAGUE MVP');
  else if (c.stage === 'pro' && avg >= 7) award(c, 'ALL-SEVENS TEAM');
  if (c.stage === 'hs' && avg >= 8) award(c, 'ALL-STATE');
  // growth: young players grow, old ones fade
  grow(c);
  c.age++;
  void tot;
  if (c.stage === 'hs') {
    c.stars = recruitStars(c);
    c.offers = collegeOffers(c);
    for (const id of c.offers.slice(0, 3)) text(c, `${getTeam(id).city.toUpperCase()} COACH`, `We want you in ${getTeam(id).colors ? getTeam(id).name : ''} colors, ${c.player.first}. Full ride.`);
    return { kind: 'signing', stars: c.stars, offers: c.offers };
  }
  if (c.stage === 'college') {
    if (c.year >= 3) return { kind: 'declare', canStay: c.year < 4 };
    c.year++;
    c.depth = depthFor(c);
    c.season = makeSeason(c);
    return { kind: 'nextSeason' };
  }
  if (c.stage === 'pro') {
    if (c.age >= 34 || c.year >= 8) return { kind: 'retired', forced: true };
    return { kind: 'retireOption' };
  }
  return { kind: 'nextSeason' };
}

function seasonLine(c) {
  const games = c.season.games.filter((g) => g.result);
  const sum = {};
  for (const g of games) for (const [k, v] of Object.entries(g.result.stats || {})) if (typeof v === 'number') sum[k] = (sum[k] || 0) + v;
  return pickLine(c.player.pos, sum);
}

function grow(c) {
  const p = c.player;
  const rng = makeRng(hashString(`${c.created}:grow:${c.stage}:${c.year}`));
  const ageK = p.age < 23 ? 1 : p.age < 28 ? 0.45 : p.age < 31 ? 0 : -0.8;
  for (const k of KEY_RATINGS[p.pos]) p.r[k] = clamp(Math.round(p.r[k] + ageK * (1 + rng() * 2.5)), 25, 99);
  if (p.age >= 30) for (const k of ['spd', 'acc', 'agi']) p.r[k] = clamp(p.r[k] - Math.round(1 + rng() * 2), 25, 99);
  p.ovr = overall(p.pos, p.r);
}

export function collegeOffers(c) {
  const cap = starsCap(c.stars);
  const fits = COLLEGES.filter((t) => t.strength <= cap + 0.02).sort((a, b) => b.strength - a.strength);
  const rng = makeRng(hashString(`${c.created}:offers`));
  const picks = shuffle(rng, fits.slice(0, 10)).slice(0, clamp(2 + c.stars, 3, 6));
  return picks.sort((a, b) => b.strength - a.strength).map((t) => t.id);
}

export function signWith(c, collegeId) {
  c.stage = 'college';
  c.year = 1;
  c.team = collegeId;
  c.depth = depthFor(c);
  c.season = makeSeason(c);
  c.offers = [];
  const t = getTeam(collegeId);
  headline(c, `${c.stars}-STAR ${c.player.pos} ${c.player.first.toUpperCase()} ${c.player.last.toUpperCase()} SIGNS WITH ${t.city.toUpperCase()}`);
  text(c, `${t.city.toUpperCase()} COACH`, `Welcome to the family. Summer workouts start Monday. You'll ${c.depth === 'starter' ? 'start' : 'have to earn it'}.`);
  saveCareer(c);
}

export function stayInSchool(c) {
  c.year++;
  c.depth = depthFor(c);
  c.season = makeSeason(c);
  saveCareer(c);
}

/** Draft day: where you go. */
/** The draft order: worst teams first, a little shuffled — the same every time for this career. */
export function draftOrder(c) {
  const rng = makeRng(hashString(`${c.created}:draft`));
  return { rng, order: TEAMS.slice().sort((a, b) => a.strength - b.strength + (rng() - 0.5) * 0.08) };
}

/** The draft board around a pick: who went just before (and the pick itself). */
export function draftBoard(c, d, rows = 8) {
  const { order } = draftOrder(c);
  const last = d.undrafted ? 48 : d.pick;
  const out = [];
  const POS = ['QB', 'RB', 'WR', 'TE', 'LB', 'CB', 'S'];
  // a few picks before yours (and, for an early pick, the ones that follow it)
  const start = Math.max(1, last - rows + 3);
  for (let n = start; n < start + rows; n++) {
    const team = order[(n - 1) % 16].id;
    if (!d.undrafted && n === d.pick) { out.push({ n, team: d.team, me: true }); continue; }
    if (n > 48) break;
    // somebody else's prospect (the screen names him from the seed)
    const r = makeRng(hashString(`${c.created}:prospect:${n}`));
    out.push({ n, team, after: n > last, pos: POS[Math.floor(r() * POS.length)], school: COLLEGES[Math.floor(r() * COLLEGES.length)].id, seed: Math.floor(r() * 1e9) });
  }
  return out;
}

export function runDraft(c) {
  const tot = c.stats.college || {};
  const g = Math.max(1, tot.games || 1);
  const prod = gradeGame(c.player.pos, Object.fromEntries(Object.entries(tot).map(([k, v]) => [k, typeof v === 'number' ? v / g : v])), false).pts;
  const glory = c.awards.some((a) => a.name.startsWith('THE GLORY TROPHY'));
  const stock = (c.player.ovr - 60) * 0.25 + prod * 0.35 + (glory ? 4 : 0) + c.awards.length * 0.4;
  const { rng, order } = draftOrder(c);
  const pick = clamp(Math.round(16 - stock * 1.4 + rng.gauss() * 2), 1, 48);
  const round = Math.ceil(pick / 16);
  const team = round > 3 ? order[Math.floor(rng() * order.length)] : order[(pick - 1) % 16];
  return { pick: round > 3 ? null : pick, round: round > 3 ? null : round, team: team.id, undrafted: round > 3 };
}

export function goPro(c, draft) {
  c.stage = 'pro';
  c.year = 1;
  c.team = draft.team;
  c.draft = draft;
  c.depth = depthFor(c);
  c.season = makeSeason(c);
  const t = getTeam(draft.team);
  headline(c, draft.undrafted ? `${c.player.last.toUpperCase()} SIGNS WITH ${t.name.toUpperCase()} AS AN UNDRAFTED FREE AGENT` : `${t.name.toUpperCase()} SELECT ${c.player.first.toUpperCase()} ${c.player.last.toUpperCase()} WITH PICK #${draft.pick}`);
  text(c, 'AGENT', draft.undrafted ? 'Nobody called. Doesn\'t matter. We prove them wrong.' : `Round ${draft.round}. You're a pro. Let's go to work.`);
  saveCareer(c);
}

export function nextProSeason(c) {
  c.year++;
  c.depth = depthFor(c);
  c.season = makeSeason(c);
  saveCareer(c);
}

export function retire(c) {
  c.stage = 'retired';
  saveCareer(c);
  const teams = [...new Set(c.history.map((h) => getTeam(h.team).name))].join(' · ');
  const pro = c.stats.pro || {};
  return {
    name: `${c.player.first} ${c.player.last}`, pos: c.player.pos,
    years: `${c.history.length} SEASONS`, teams,
    line: pickLine(c.player.pos, pro), rings: c.rings,
    awards: groupAwards(c.awards.map((a) => a.name)),
  };
}

/** "THE GLORY TROPHY ×3": one line per award, counted. */
export function groupAwards(names) {
  const n = new Map();
  for (const a of names) n.set(a, (n.get(a) || 0) + 1);
  return [...n].map(([a, k]) => (k > 1 ? `${a} ×${k}` : a));
}

// ------------------------------------------------------------------ training

export function trainCost(v) { return Math.round(60 + Math.max(0, v - 50) * 9 + Math.max(0, v - 80) * 14); }

export function train(c, key) {
  const v = c.player.r[key];
  const cost = trainCost(v);
  if (v >= 99 || c.xp < cost) return false;
  c.xp -= cost;
  c.player.r[key] = v + 1;
  c.player.ovr = overall(c.player.pos, c.player.r);
  saveCareer(c);
  return true;
}

export { HOMETOWNS, COLLEGE_CONFERENCES };
