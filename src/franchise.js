// Franchise mode: an 8-game season + playoffs, weekly decisions, the AD,
// practice bonuses, and the trophy shelf.
import { genTownName, MASCOTS, COLOR_PRESETS, pick, genRoster } from './names.js';

export function newFranchise() {
  return {
    week: 1,               // 1..8 regular season, 9..11 playoffs
    record: [],            // [{opp, home, away, won}]
    schedule: genSchedule(),
    adTrust: 65,           // 0..100; hit the floor and you'd better win
    morale: 0,             // -8..+8 → team-wide attribute swing this week
    crowdBoost: 0,
    practice: null,        // {label, attrs:{spd?,str?,hands?,arm?,iq?}} for this week
    decisionDone: false,
    phoneEvent: null,      // pending AD call (decision card id)
    ultimatum: false,
    trophies: [],          // 'district', 'state', ...
    seasonOver: false,
    fired: false,
    campDone: false,
    seasons: 0,
  };
}

export function genSchedule() {
  const used = new Set();
  const games = [];
  for (let w = 1; w <= 8; w++) {
    let town = genTownName();
    for (let i = 0; i < 30 && used.has(town); i++) town = genTownName();
    used.add(town);
    const m = pick(MASCOTS);
    const preset = pick(COLOR_PRESETS);
    games.push({
      week: w,
      name: town,
      mascot: m.name,
      logoId: m.logo,
      colors: { primary: preset.primary, secondary: preset.secondary },
      quality: Math.round(-2 + w * 1.1),      // they get tougher
      homecoming: w === 5,
      rivalryGame: w === 8,
    });
  }
  return games;
}

export function playoffOpponent(round) {
  const names = [
    { name: 'Carverton', mascot: 'Hawks', logo: 'wing' },
    { name: 'Saint Bosco', mascot: 'Spartans', logo: 'helm' },
    { name: 'North Permian', mascot: 'Bulldogs', logo: 'bulldog' },
  ];
  const n = names[round] || names[2];
  const preset = pick(COLOR_PRESETS);
  return {
    name: n.name, mascot: n.mascot, logoId: n.logo,
    colors: { primary: preset.primary, secondary: preset.secondary },
    quality: 7 + round * 2,
    playoffRound: round, // 0 quarter, 1 semi, 2 state final
  };
}

/** Build the full rival object (with roster) for a schedule entry. */
export function rivalFor(entry) {
  return {
    name: entry.name,
    mascot: entry.mascot,
    logoId: entry.logoId,
    colors: entry.colors,
    roster: genRoster(entry.quality),
  };
}

export function wins(fr) { return fr.record.filter((r) => r.won).length; }
export function losses(fr) { return fr.record.filter((r) => !r.won).length; }
export function madePlayoffs(fr) { return wins(fr) >= 5; }

export function weekLabel(fr, school) {
  if (fr.week <= 8) {
    const g = fr.schedule[fr.week - 1];
    const tag = g.homecoming ? ' · HOMECOMING' : g.rivalryGame ? ' · THE RIVALRY GAME' : '';
    return `WEEK ${fr.week}${tag} — FRIDAY: VS ${g.name.toUpperCase()} ${g.mascot.toUpperCase()}`;
  }
  const round = ['DISTRICT QUARTERFINAL', 'DISTRICT FINAL', 'STATE CHAMPIONSHIP'][fr.week - 9];
  return `${round} — WIN OR GO HOME`;
}

export function currentOpponent(fr) {
  if (fr.week <= 8) return rivalFor(fr.schedule[fr.week - 1]);
  const entry = playoffOpponent(fr.week - 9);
  return rivalFor(entry);
}

/** Advance after a game. Returns events: banners the office should show. */
export function recordResult(fr, { won, home, away, oppName }) {
  const events = [];
  fr.record.push({ opp: oppName, home, away, won });
  fr.adTrust = Math.max(0, Math.min(100, fr.adTrust + (won ? 7 : -9)));
  fr.morale = Math.max(-8, Math.min(8, fr.morale + (won ? 2 : -2)));
  if (fr.ultimatum) {
    if (won) { fr.ultimatum = false; events.push('The AD shakes your hand. "That\'s more like it, coach."'); }
    else { fr.fired = true; fr.seasonOver = true; events.push('Monday morning, the AD asks for your keys. Season over.'); return events; }
  }
  if (fr.week <= 8) {
    fr.week++;
    if (fr.week === 9) {
      if (madePlayoffs(fr)) {
        fr.trophies.push('district-berth');
        events.push(`${wins(fr)}-${losses(fr)} — the ${'playoff bracket is set. You\'re in.'}`);
      } else {
        fr.seasonOver = true;
        events.push(`Season over at ${wins(fr)}-${losses(fr)}. The film room beckons for next year.`);
      }
    }
  } else {
    if (!won) {
      fr.seasonOver = true;
      events.push('A heartbreaker. The run ends here — banner year anyway.');
    } else {
      if (fr.week === 9) { events.push('Quarterfinal won! One more for the district title.'); }
      if (fr.week === 10) { fr.trophies.push('district'); events.push('DISTRICT CHAMPIONS! Next stop: State.'); }
      if (fr.week === 11) { fr.trophies.push('state'); fr.seasonOver = true; events.push('STATE CHAMPIONS! Hang the banner. Paint the water tower.'); }
      fr.week++;
    }
  }
  fr.decisionDone = false;
  fr.practice = null;
  fr.crowdBoost = 0;
  // the AD calls every few weeks, or when trust runs low
  fr.phoneEvent = (fr.adTrust < 30 || fr.week === 3 || fr.week === 6) && !fr.seasonOver ? 'ad' : null;
  if (fr.adTrust <= 15 && !fr.seasonOver) { fr.ultimatum = true; }
  return events;
}

export function rollNewSeason(fr) {
  const trophies = fr.trophies.filter((t) => t !== 'district-berth');
  const fresh = newFranchise();
  fresh.trophies = trophies;
  fresh.seasons = (fr.seasons || 0) + 1;
  fresh.campDone = true; // camp only the first year
  fresh.adTrust = fr.fired ? 45 : Math.max(40, fr.adTrust);
  return fresh;
}

// ------------------------------------------------------------- decisions
export const DECISIONS = [
  {
    id: 'algebra', title: 'ELIGIBILITY PROBLEM',
    text: 'Your starting receiver is failing algebra. The test is Thursday; the tutor costs gym budget.',
    options: [
      { label: 'Pay for the tutor', effect: { adTrust: -6, morale: 2 }, note: 'The AD grumbles about the budget, but the locker room notices you went to bat.' },
      { label: 'Bench him Friday', effect: { adTrust: 6, morale: -3 }, note: 'Rules are rules. The team plays tight, but the AD approves.' },
    ],
  },
  {
    id: 'pepRally', title: 'PEP RALLY REQUEST',
    text: 'The cheer squad wants Friday classes shortened for an all-school pep rally.',
    options: [
      { label: 'Crank up the rally', effect: { crowdBoost: 1, morale: 2, adTrust: -4 }, note: 'The gym shakes. The principal counts lost class minutes.' },
      { label: 'Keep it low-key', effect: { adTrust: 4 }, note: 'Quiet week. The AD appreciates a calm building.' },
    ],
  },
  {
    id: 'boosters', title: 'THE BOOSTER CLUB',
    text: "Big Mike (of Bar-B-Que fame) offers new game pants — if his nephew gets more carries.",
    options: [
      { label: 'Take the deal', effect: { morale: -2, crowdBoost: 1, adTrust: 2 }, note: 'Sharp pants. Your RB room is quietly furious.' },
      { label: 'Politely decline', effect: { morale: 2 }, note: 'The team knows snaps are earned. Big Mike sends ribs anyway.' },
    ],
  },
  {
    id: 'curfew', title: 'CURFEW BUST',
    text: 'Three linemen were spotted at the diner at midnight. Team rules say they sit a half.',
    options: [
      { label: 'Sit them a half', effect: { morale: 3, adTrust: 4 }, note: 'Discipline now, trust later. The team respects it.' },
      { label: 'Extra gassers instead', effect: { morale: -1 }, note: 'They run until they wobble. Message received, mostly.' },
    ],
  },
  {
    id: 'press', title: 'NEWSPAPER INTERVIEW',
    text: 'The Gazette wants a quote about Friday\'s opponent.',
    options: [
      { label: '"We\'ll handle business."', effect: { morale: 2, crowdBoost: 1 }, note: 'Bulletin-board material — for both locker rooms.' },
      { label: '"They\'re well coached."', effect: { adTrust: 3 }, note: 'Classy. The AD clips it for the lobby.' },
    ],
  },
  {
    id: 'field', title: 'FIELD PAINT BUDGET',
    text: 'The grounds crew can do a fresh midfield logo or save the money.',
    options: [
      { label: 'Paint it big', effect: { crowdBoost: 1, adTrust: -3 }, note: 'It looks like Friday night TV out there.' },
      { label: 'Save it', effect: { adTrust: 4 }, note: 'The logo fades; the budget breathes.' },
    ],
  },
  {
    id: 'jv', title: 'CALL-UP DECISION',
    text: 'A JV sophomore is turning heads at practice. Varsity wants him.',
    options: [
      { label: 'Call him up', effect: { morale: 2 }, note: 'Fresh legs, fresh energy.' },
      { label: 'Let him cook on JV', effect: { adTrust: 2, morale: 1 }, note: 'Patience. His coach thanks you.' },
    ],
  },
  {
    id: 'film', title: 'FILM SESSION',
    text: 'Players want Saturday film optional this week.',
    options: [
      { label: 'Mandatory, donuts on you', effect: { morale: 2, adTrust: -2 }, note: 'Full room. Sticky playbooks.' },
      { label: 'Optional', effect: { morale: -1 }, note: 'Half show. The half that needed it least.' },
    ],
  },
  {
    id: 'ad', ad: true, title: 'THE AD WANTS A WORD',
    text: 'Phone call from the Athletic Director: "Coach, the school board watches these games. I need wins, and I need a clean program. Where\'s your head at?"',
    options: [
      { label: '"We\'re building something."', effect: { adTrust: 5 }, note: '"Build faster," he says, but he\'s smiling.' },
      { label: '"Watch Friday night."', effect: { adTrust: -3, morale: 3 }, note: 'Bold. The team hears about it and loves it.' },
    ],
  },
];

export function weeklyDecision(fr) {
  const pool = DECISIONS.filter((d) => !d.ad);
  return pool[(fr.week * 7 + fr.record.length * 3) % pool.length];
}

export function adDecision() {
  return DECISIONS.find((d) => d.ad);
}

export function applyDecision(fr, effect) {
  if (effect.morale) fr.morale = Math.max(-8, Math.min(8, fr.morale + effect.morale));
  if (effect.adTrust) fr.adTrust = Math.max(0, Math.min(100, fr.adTrust + effect.adTrust));
  if (effect.crowdBoost) fr.crowdBoost += effect.crowdBoost;
}

// drills → practice bonus
export const DRILLS = [
  { id: 'routes', name: 'ROUTE TREE', desc: 'Quarterback and receivers: 5 reps vs. press man.', attrs: { hands: 4, arm: 3 }, icon: '🏈' },
  { id: 'gauntlet', name: 'THE GAUNTLET', desc: 'One back, six tacklers, eighty yards of trouble.', attrs: { spd: 4 }, icon: '💨' },
  { id: 'hits', name: 'HIT STICK', desc: 'Read the back, fill the hole, finish the tackle. 3 reps.', attrs: { str: 4, iq: 2 }, icon: '💥' },
];

export function practiceBonusFor(drillId, score) {
  const d = DRILLS.find((x) => x.id === drillId);
  if (!d) return null;
  const mult = score >= 0.8 ? 1 : score >= 0.5 ? 0.6 : 0.3;
  const attrs = {};
  for (const k in d.attrs) attrs[k] = Math.round(d.attrs[k] * mult);
  return { label: `${d.name} (${Math.round(score * 100)}%)`, attrs };
}
