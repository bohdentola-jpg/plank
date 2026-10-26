// The record book: single-game bests from every finished game (Free Play and
// Road to Glory), the trophy case (titles won in a career) and the Hall of
// Fame (retired careers). Kept in localStorage through settings.store.
import { store } from '../core/settings.js';

const KEY = 'records';

export function loadRecords() {
  const r = store.load(KEY) || {};
  return {
    games: r.games || 0, wins: r.wins || 0, losses: r.losses || 0, ties: r.ties || 0,
    bests: r.bests || {},          // key → { value, who, team, vs, date }
    trophies: r.trophies || [],    // { name, season, team, date }
    hall: r.hall || [],            // retired careers { name, pos, years, teams, line, rings, awards }
    log: r.log || [],              // the last few finals { home, away, hs, as, date }
  };
}

function saveRecords(r) { store.save(KEY, r); }

const BEST_KEYS = {
  passYds: 'PASSING YARDS', passTd: 'TOUCHDOWN PASSES', rushYds: 'RUSHING YARDS', recYds: 'RECEIVING YARDS',
  td: 'TOUCHDOWNS', tackles: 'TACKLES', sacks: 'SACKS', ints: 'INTERCEPTIONS', lateralsThrown: 'LATERALS THROWN', retYds: 'RETURN YARDS',
};
export const RECORD_NAMES = { ...BEST_KEYS, points: 'POINTS BY A TEAM', margin: 'BIGGEST WIN', longPlay: 'LONGEST PLAY' };

/**
 * Fold a finished game into the book. `m` is the Match; userSides the sides
 * a person played (records only count your players).
 */
export function recordGame(m, userSides = [], meta = {}) {
  const r = loadRecords();
  const date = new Date().toISOString().slice(0, 10);
  const mine = userSides.length ? userSides : ['home', 'away'];
  r.games++;
  if (userSides.length === 1) {
    const u = userSides[0], o = u === 'home' ? 'away' : 'home';
    if (m.score[u] > m.score[o]) r.wins++; else if (m.score[u] < m.score[o]) r.losses++; else r.ties++;
  }
  const set = (key, value, who, team, vs) => {
    if (!(value > 0)) return;
    const cur = r.bests[key];
    if (!cur || value > cur.value) r.bests[key] = { value, who, team, vs, date };
  };
  for (const p of m.stats.players.values()) {
    if (!mine.includes(p.side)) continue;
    const team = m.teams[p.side].abbr, vs = m.teams[p.side === 'home' ? 'away' : 'home'].abbr;
    for (const k of Object.keys(BEST_KEYS)) set(k, p[k] || 0, p.name, team, vs);
    set('longPlay', p.longRec || 0, p.name, team, vs);
  }
  for (const side of mine) {
    const o = side === 'home' ? 'away' : 'home';
    set('points', m.score[side], m.teams[side].name, m.teams[side].abbr, m.teams[o].abbr);
    set('margin', m.score[side] - m.score[o], m.teams[side].name, m.teams[side].abbr, m.teams[o].abbr);
  }
  r.log.unshift({ home: m.teams.home.abbr, away: m.teams.away.abbr, hs: m.score.home, as: m.score.away, date, mode: meta.mode || 'free' });
  r.log = r.log.slice(0, 12);
  saveRecords(r);
  return r;
}

export function addTrophy(t) {
  const r = loadRecords();
  r.trophies.unshift({ ...t, date: new Date().toISOString().slice(0, 10) });
  saveRecords(r);
}

export function enshrine(career) {
  const r = loadRecords();
  r.hall.unshift(career);
  r.hall = r.hall.slice(0, 24);
  saveRecords(r);
}
