// STORY — reputation. REP comes from wins and places, first wins, beating
// named rivals (more the first time), and how you won: a photo finish, a
// wire-to-wire beating, clean laps, drift style, a time attack with room to
// spare. It earns a street rank, calls out the bosses (with the wins) and
// opens the invitation-only cups.

export const RANKS = [
  { rep: 0, name: 'NOBODY' },
  { rep: 300, name: 'NEW BLOOD' },
  { rep: 800, name: 'STREET RAT' },
  { rep: 1700, name: 'CONTENDER' },
  { rep: 3300, name: 'WHEELMAN' },
  { rep: 5600, name: 'HEADLINER' },
  { rep: 8800, name: 'HEAVYWEIGHT' },
  { rep: 12800, name: 'KINGPIN' },
  { rep: 17500, name: 'LEGEND' },
  { rep: 23000, name: 'THE FREQUENCY' },
];

export function rankOf(rep) {
  let k = 0;
  while (k < RANKS.length - 1 && rep >= RANKS[k + 1].rep) k++;
  return k;
}

/** Progress 0..1 from this rank to the next (1 at the top rank). */
export function rankProgress(rep) {
  const k = rankOf(rep);
  if (k >= RANKS.length - 1) return 1;
  return (rep - RANKS[k].rep) / (RANKS[k + 1].rep - RANKS[k].rep);
}

/** A regular win in chapter ch is worth this much REP. */
export const repBase = (ch) => 50 + 22 * ch;

const KIND_MUL = { race: 1, duel: 1.5, cup: 2.5, boss: 4 };
const PLACE_SHARE = [0, 1, 0.5, 0.3, 0.15, 0.1, 0.1, 0.1, 0.1];

/**
 * REP for one finished event. o: { kind, ch, place, won, firstWin, repeat,
 * beaten (named rivals behind you), fresh (named rivals beaten for the first
 * time), photo, wire, clean, style, clock }. Returns { total, lines: [[label, n]] }.
 */
export function repFor(o) {
  const base = repBase(o.ch);
  const lines = [];
  const mul = o.repeat ? 0.3 : 1;
  const add = (label, n) => { n = Math.round(n * mul / 5) * 5; if (n > 0) lines.push([label, n]); };
  const kind = KIND_MUL[o.kind] ? o.kind : 'race';
  if (o.won) {
    add(kind === 'boss' ? 'BOSS DOWN' : kind === 'duel' ? 'DUEL WON' : kind === 'cup' ? 'CUP WON' : 'WIN', base * KIND_MUL[kind]);
    if (o.firstWin) add('FIRST WIN', base * KIND_MUL[kind]);
  } else if (o.place && o.place > 1) {
    add(`${o.place}${['', 'ST', 'ND', 'RD'][o.place] || 'TH'} PLACE`, base * (PLACE_SHARE[o.place] ?? 0.1) * (kind === 'cup' ? 2 : 1));
  }
  const bonus = 1 + o.ch * 0.25;
  if (o.beaten) add(`BEAT ${o.beaten} RIVAL${o.beaten > 1 ? 'S' : ''}`, o.beaten * 6 * bonus);
  if (o.fresh) add(o.fresh > 1 ? `${o.fresh} NEW NAMES BEATEN` : 'NEW NAME BEATEN', o.fresh * 20 * bonus);
  if (o.photo) add('PHOTO FINISH', 25 * bonus);
  if (o.wire) add('WIRE TO WIRE', 20 * bonus);
  if (o.clean) add('CLEAN LAPS', 15 * bonus);
  if (o.style) add('STYLE POINTS', 25 * bonus);
  if (o.clock) add('UNDER THE CLOCK', 20 * bonus);
  return { total: lines.reduce((s, l) => s + l[1], 0), lines };
}
