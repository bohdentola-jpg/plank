// HOMETOWN HERO — you're the quarterback. Weekly time management, academics,
// the team around you, college offers, a road that ends at State.
import { genSchedule, rivalFor, playoffOpponent } from './franchise.js';

export const TRACKS = [
  { id: 'train', name: 'TRAINING', desc: 'Arm, wheels, strength', icon: '🏋️' },
  { id: 'film', name: 'FILM ROOM', desc: 'Read the defense faster', icon: '🎞️' },
  { id: 'study', name: 'ACADEMICS', desc: 'Stay eligible, keep options open', icon: '📚' },
  { id: 'rest', name: 'REST & LIFE', desc: 'Morale, friends, recovery', icon: '🛋️' },
];

export function newHero(name, look, build) {
  return {
    name: name || 'Jake Moss',
    num: 7,
    pos: 'QB',
    look: look || {},
    build: build || 'avg',
    attrs: { arm: 70, spd: 68, iq: 66, hands: 62, str: 60 },
    xp: 0,
    gpa: 2.9,
    energy: { train: 3, film: 2, study: 3, rest: 2 },
    fame: 4,             // 0..100 → offer stars
    morale: 2,
    week: 1,
    schedule: genSchedule(),
    record: [],
    stats: { passYds: 0, passTD: 0, ints: 0, runYds: 0 },
    game: null,          // last game line
    offers: [],
    ineligible: false,
    eventDone: false,
    seasonOver: false,
    signed: null,
  };
}

export function heroOpponent(h) {
  if (h.week <= 8) return rivalFor(h.schedule[h.week - 1]);
  return rivalFor(playoffOpponent(h.week - 9));
}

export function heroIsHome(h) { return h.week <= 8 ? h.schedule[h.week - 1].homeGame !== false : true; }

export function heroWeekLabel(h, school) {
  if (h.week <= 8) {
    const g = h.schedule[h.week - 1];
    return `WEEK ${h.week}${g.homecoming ? ' · HOMECOMING' : ''} — ${g.homeGame ? 'VS' : 'AT'} ${g.name.toUpperCase()} ${g.mascot.toUpperCase()}`;
  }
  return ['DISTRICT QUARTERFINAL', 'DISTRICT FINAL', 'THE STATE CHAMPIONSHIP'][h.week - 9] || 'POSTSEASON';
}

export function offerStars(h) { return Math.max(0, Math.min(5, Math.floor(h.fame / 18))); }

const SCHOOL_LADDER = [
  [12, 'Pratt County CC', '★★'],
  [26, 'Eastern State', '★★★'],
  [44, 'Capital University', '★★★★'],
  [62, 'Coastal A&M', '★★★★'],
  [80, 'State Tech (flagship)', '★★★★★'],
];

export function refreshOffers(h) {
  for (const [need, school, stars] of SCHOOL_LADDER) {
    if (h.fame >= need && h.gpa >= 2.0 && !h.offers.find((o) => o.school === school)) {
      h.offers.push({ school, stars, week: h.week });
    }
  }
}

/** Apply the weekly allocation. Returns notes for the hub. */
export function applyWeekPlan(h) {
  const e = h.energy;
  const notes = [];
  // training → XP to spend
  const gained = e.train * 2;
  h.xp += gained;
  if (gained) notes.push(`+${gained} XP from training`);
  if (e.film) { h.attrs.iq = Math.min(99, h.attrs.iq + (e.film >= 3 ? 1 : 0)); if (e.film >= 3) notes.push('+1 AWR from film'); }
  const gpaShift = e.study * 0.06 - 0.12;
  h.gpa = Math.max(0, Math.min(4.0, +(h.gpa + gpaShift).toFixed(2)));
  notes.push(`GPA ${gpaShift >= 0 ? 'up to' : 'slipped to'} ${h.gpa.toFixed(2)}`);
  h.morale = Math.max(-5, Math.min(6, h.morale + (e.rest >= 3 ? 1 : e.rest === 0 ? -2 : 0)));
  h.ineligible = h.gpa < 2.0;
  if (h.ineligible) notes.push('⚠ BELOW 2.0 — INELIGIBLE THIS FRIDAY');
  return notes;
}

export const HERO_EVENTS = [
  {
    id: 'bigtest', title: 'CHEM TEST FRIDAY MORNING',
    text: 'Your chemistry final lands the morning of the game. The study group meets tonight — same time as extra film with Coach.',
    options: [
      { label: 'Hit the study group', fx: 'GPA +0.2 · Coach a little salty', effect: (h) => { h.gpa = Math.min(4, h.gpa + 0.2); h.morale -= 1; } },
      { label: 'Film with Coach', fx: 'AWR +1 · GPA −0.15', effect: (h) => { h.attrs.iq = Math.min(99, h.attrs.iq + 1); h.gpa = Math.max(0, h.gpa - 0.15); } },
    ],
  },
  {
    id: 'party', title: 'LAKEHOUSE PARTY',
    text: "Half the senior class is going. Your line is going. It's Thursday.",
    options: [
      { label: 'Go, but leave by 10', fx: 'Morale +2', effect: (h) => { h.morale = Math.min(6, h.morale + 2); } },
      { label: 'Stay home, sleep', fx: 'Energy next week +1 train', effect: (h) => { h.energy.train = Math.min(6, h.energy.train + 1); } },
    ],
  },
  {
    id: 'scout', title: 'A SCOUT IN THE BLEACHERS',
    text: 'Word is a college scout will be at practice Wednesday.',
    options: [
      { label: 'Show off the deep ball', fx: 'Fame +6 · risk a sore arm', effect: (h) => { h.fame += 6; if (Math.random() < 0.3) { h.attrs.arm = Math.max(40, h.attrs.arm - 1); } } },
      { label: 'Run the offense clean', fx: 'Fame +3 · Coach trust', effect: (h) => { h.fame += 3; h.morale += 1; } },
    ],
  },
  {
    id: 'tutor', title: 'MRS. ALVAREZ OFFERS TUTORING',
    text: 'Your English teacher offers Tuesday tutoring — same slot as weights.',
    options: [
      { label: 'Take the tutoring', fx: 'GPA +0.25', effect: (h) => { h.gpa = Math.min(4, h.gpa + 0.25); } },
      { label: 'Weights with the boys', fx: 'STR +1 · Morale +1', effect: (h) => { h.attrs.str = Math.min(99, h.attrs.str + 1); h.morale += 1; } },
    ],
  },
  {
    id: 'jersey', title: 'YOUNGER KIDS AT THE FENCE',
    text: 'A pack of middle schoolers waits after practice for autographs. Your ride is honking.',
    options: [
      { label: 'Sign every one', fx: 'Fame +4 · the town loves you', effect: (h) => { h.fame += 4; h.morale += 1; } },
      { label: 'Wave and roll out', fx: 'No effect', effect: () => {} },
    ],
  },
  {
    id: 'rivalry', title: 'RIVAL PLAYERS AT THE DINER',
    text: "Friday's opponents are loud at the next table. One of them says your name.",
    options: [
      { label: '"See you Friday."', fx: 'Morale +2 · they\'ll be ready', effect: (h) => { h.morale += 2; } },
      { label: 'Pay and leave quietly', fx: 'AWR +1, channel it', effect: (h) => { h.attrs.iq = Math.min(99, h.attrs.iq + 1); } },
    ],
  },
];

export function weekEvent(h) {
  return HERO_EVENTS[(h.week * 5 + h.record.length * 3) % HERO_EVENTS.length];
}

/** XP shop. */
export const UPGRADES = [
  { id: 'arm', label: 'ARM STRENGTH', cost: 10 },
  { id: 'spd', label: 'SPEED', cost: 12 },
  { id: 'iq', label: 'AWARENESS', cost: 8 },
  { id: 'hands', label: 'BALL SECURITY', cost: 8 },
  { id: 'str', label: 'TOUGHNESS', cost: 8 },
];

export function buyUpgrade(h, id) {
  const u = UPGRADES.find((x) => x.id === id);
  if (!u || h.xp < u.cost || h.attrs[id] >= 99) return false;
  h.xp -= u.cost;
  h.attrs[id] = Math.min(99, h.attrs[id] + 2);
  return true;
}

/** After a Friday game. */
export function heroGameResult(h, { won, home, away, stats }) {
  h.record.push({ opp: heroWeekLabel(h), won, home, away });
  h.stats.passYds += stats.passYds;
  h.stats.passTD += stats.passTD;
  h.stats.ints += stats.ints;
  h.stats.runYds += stats.runYds;
  h.game = stats;
  const famePop = Math.round(stats.passYds / 22 + stats.passTD * 6 + stats.runYds / 14 - stats.ints * 4 + (won ? 8 : 2));
  h.fame = Math.max(0, h.fame + Math.max(0, famePop));
  h.xp += Math.max(2, Math.round(famePop / 2));
  refreshOffers(h);
  const events = [];
  if (h.week <= 8) {
    h.week++;
    if (h.week === 9) {
      const wins = h.record.filter((r) => r.won).length;
      if (wins >= 5) events.push("You're in the playoffs. Three more Fridays to State.");
      else { h.seasonOver = true; events.push(`Season over at ${wins}–${h.record.length - wins}. Signing day still comes.`); }
    }
  } else if (!won) {
    h.seasonOver = true;
    events.push('The run ends. Heads high — scouts saw everything.');
  } else if (h.week === 11) {
    h.seasonOver = true;
    h.fame += 25;
    refreshOffers(h);
    events.push('STATE CHAMPIONS. They will tell stories about this one.');
  } else {
    h.week++;
    events.push('Survive and advance.');
  }
  h.eventDone = false;
  return events;
}
