// The crews. Ten cities, two ballers each, all original — this is RIM CITY,
// where the franchises are made up and the elbows are real.
// Ratings 40–99: spd, three, dunk, def, steal, block, handle.

function P(name, nick, num, pos, h, build, ratings, look) {
  const [spd, three, dunk, def, steal, block, handle] = ratings;
  return {
    name, nick, num, pos, h, build,
    spd, three, dunk, def, steal, block, handle,
    look,
  };
}

export const CREWS = [
  {
    id: 'ny', city: 'NEW YORK', name: 'EMPIRE', abbr: 'NYC',
    colors: { primary: '#1b2a52', secondary: '#f08018' },
    blurb: 'Five boroughs of bad intentions.',
    players: [
      P('Tyrese Vaughn', 'SKYLINE', 8, 'big', 2.08, 'big', [72, 48, 95, 80, 55, 88, 60],
        { skin: '#6b4226', hair: 'buzz', hairCol: '#16100a', headband: true }),
      P('Manny Ortiz', 'THE MAYOR', 11, 'guard', 1.90, 'slim', [88, 92, 55, 62, 78, 40, 90],
        { skin: '#a06a42', hair: 'curls', hairCol: '#16100a', facial: 'goatee' }),
    ],
  },
  {
    id: 'la', city: 'LOS ANGELES', name: 'MARQUEE', abbr: 'LA',
    colors: { primary: '#46245e', secondary: '#e8b923' },
    blurb: 'All flash. Most of the substance.',
    players: [
      P('Dre Calloway', 'SHOWTIME', 3, 'guard', 1.96, 'avg', [90, 84, 78, 58, 70, 48, 88],
        { skin: '#8d5a3b', hair: 'hightop', hairCol: '#16100a', sleeve: 'R' }),
      P('Bo Kekoa', 'THE WAVE', 40, 'big', 2.11, 'big', [62, 40, 90, 78, 48, 92, 52],
        { skin: '#c68863', hair: 'bun', hairCol: '#241a10', facial: 'goatee' }),
    ],
  },
  {
    id: 'chi', city: 'CHICAGO', name: 'WIND', abbr: 'CHI',
    colors: { primary: '#c0273a', secondary: '#17181c' },
    blurb: 'Cold city. Colder crossovers.',
    players: [
      P('Marcus Bell', 'AIRRAID', 23, 'guard', 1.98, 'avg', [86, 80, 92, 72, 74, 60, 84],
        { skin: '#6b4226', hair: 'bald', headband: false, sleeve: 'L' }),
      P('Stan Kowalski', 'THE FORKLIFT', 54, 'big', 2.13, 'big', [55, 35, 80, 88, 42, 90, 45],
        { skin: '#d8a87f', hair: 'buzz', hairCol: '#3a2c18', facial: 'stache' }),
    ],
  },
  {
    id: 'mia', city: 'MIAMI', name: 'MAMBO', abbr: 'MIA',
    colors: { primary: '#0e7c7b', secondary: '#f25c9b' },
    blurb: 'Neon nights, no defense after midnight.',
    players: [
      P('Luis Reyes', 'EL FUEGO', 7, 'guard', 1.88, 'slim', [94, 88, 50, 50, 80, 35, 92],
        { skin: '#b07848', hair: 'curls', hairCol: '#100c08', facial: 'goatee' }),
      P('Jamal Pierce', 'SOUTH BEACH', 21, 'big', 2.05, 'avg', [76, 58, 88, 66, 58, 78, 62],
        { skin: '#5a3620', hair: 'afro', hairCol: '#16100a', headband: true }),
    ],
  },
  {
    id: 'det', city: 'DETROIT', name: 'MOTORS', abbr: 'DET',
    colors: { primary: '#2e4a5a', secondary: '#c7ccd4' },
    blurb: 'Built like trucks. Drive like them too.',
    players: [
      P('Otis Grant', 'DIESEL', 42, 'big', 2.16, 'big', [58, 30, 93, 90, 40, 95, 40],
        { skin: '#4a2c18', hair: 'bald', facial: 'goatee' }),
      P('Eddie Marsh', 'THE GEARBOX', 12, 'guard', 1.84, 'avg', [84, 78, 60, 74, 82, 45, 80],
        { skin: '#d8a87f', hair: 'buzz', hairCol: '#241a10' }),
    ],
  },
  {
    id: 'hou', city: 'HOUSTON', name: 'LIFTOFF', abbr: 'HOU',
    colors: { primary: '#8f1d2c', secondary: '#9aa0a6' },
    blurb: 'Clearance granted. Rim is go.',
    players: [
      P('Calvin Brooks', 'APOLLO', 34, 'big', 2.10, 'big', [70, 44, 96, 76, 50, 86, 55],
        { skin: '#8d5a3b', hair: 'hightop', hairCol: '#16100a' }),
      P('Tony Tran', 'MISSION CONTROL', 9, 'guard', 1.85, 'slim', [90, 86, 45, 60, 76, 38, 88],
        { skin: '#c69468', hair: 'buzz', hairCol: '#100c08', headband: true }),
    ],
  },
  {
    id: 'phi', city: 'PHILADELPHIA', name: 'LIBERTY', abbr: 'PHI',
    colors: { primary: '#1f4fd8', secondary: '#c0273a' },
    blurb: 'They will boo you. They will boo each other.',
    players: [
      P('Hakeem Sutton', 'THE BELL', 6, 'big', 2.07, 'big', [68, 52, 89, 82, 52, 84, 58],
        { skin: '#6b4226', hair: 'afro', hairCol: '#16100a', facial: 'goatee' }),
      P('Joey Russo', 'BROAD STREET', 14, 'guard', 1.91, 'avg', [85, 83, 58, 70, 79, 42, 86],
        { skin: '#dba87c', hair: 'curls', hairCol: '#2a1c10', facial: 'stache' }),
    ],
  },
  {
    id: 'sea', city: 'SEATTLE', name: 'RAIN', abbr: 'SEA',
    colors: { primary: '#1d4d2b', secondary: '#e8b923' },
    blurb: 'It pours threes out there.',
    players: [
      P('Dale Norgaard', 'DOWNPOUR', 30, 'guard', 1.93, 'slim', [82, 95, 48, 56, 72, 40, 87],
        { skin: '#e0b088', hair: 'bun', hairCol: '#7a5a2c' }),
      P('Andre Okafor', 'THE UMBRELLA', 50, 'big', 2.14, 'big', [60, 38, 84, 86, 46, 96, 48],
        { skin: '#4a2c18', hair: 'buzz', hairCol: '#100c08', sleeve: 'L' }),
    ],
  },
  {
    id: 'oak', city: 'OAKLAND', name: 'QUAKE', abbr: 'OAK',
    colors: { primary: '#e8a020', secondary: '#17181c' },
    blurb: 'Richter-scale rim runners.',
    players: [
      P('Damon Cole', 'AFTERSHOCK', 0, 'guard', 1.96, 'avg', [92, 90, 82, 64, 84, 50, 94],
        { skin: '#8d5a3b', hair: 'braids', hairCol: '#16100a', headband: true }),
      P('Tevita Fifita', 'THE FAULT LINE', 55, 'big', 2.12, 'big', [64, 36, 94, 84, 44, 90, 50],
        { skin: '#a06a42', hair: 'bun', hairCol: '#100c08', facial: 'goatee' }),
    ],
  },
  {
    id: 'dc', city: 'WASHINGTON', name: 'MONUMENT', abbr: 'DC',
    colors: { primary: '#b8b4ac', secondary: '#c0273a' },
    blurb: 'Set in stone at both ends.',
    players: [
      P('Reggie Holloway', 'FILIBUSTER', 13, 'guard', 1.92, 'avg', [83, 81, 62, 76, 86, 44, 82],
        { skin: '#5a3620', hair: 'hightop', hairCol: '#16100a' }),
      P('Boris Petrov', 'THE OBELISK', 77, 'big', 2.15, 'big', [54, 46, 86, 92, 38, 94, 42],
        { skin: '#e0b890', hair: 'bald', facial: 'stache' }),
    ],
  },
];

export function overall(crew) {
  let s = 0;
  for (const p of crew.players) s += p.spd + p.three + p.dunk + p.def + p.steal + p.block + p.handle;
  return Math.round(s / (crew.players.length * 7));
}

/** Ladder for THE RUN: every other crew, weakest first, your crew excluded. */
export function runLadder(crewId) {
  return CREWS.filter((c) => c.id !== crewId).sort((a, b) => overall(a) - overall(b));
}

export function crewById(id) { return CREWS.find((c) => c.id === id) || CREWS[0]; }

/** CPU tuning for ladder rung r (0..8) — exhibitions sit around rung 3. */
export function difficultyFor(r) {
  const t = Math.min(1, r / 8);
  return {
    label: ['TIP-IN', 'WARM-UP', 'STREETBALL', 'PRO-AM', 'CONTENDER', 'ALL-CITY', 'PLAYOFFS', 'FINALS', 'KINGS'][r] || 'STREETBALL',
    reaction: 0.34 - t * 0.22,      // seconds of AI lag
    shootIQ: 0.45 + t * 0.45,       // how good a look they wait for
    stealRate: 0.25 + t * 0.95,     // swipes per second of pressure
    shoveRate: 0.05 + t * 0.30,
    dunkBias: 0.4 + t * 0.5,
    makeBonus: -0.06 + t * 0.14,    // flat make-probability adjustment
    speed: 0.92 + t * 0.12,
    lobRate: 0.04 + t * 0.10,
  };
}
