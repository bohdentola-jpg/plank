// Roster + identity generation, tuned to the class of 2004.

const FIRST = [
  'Tyler','Brandon','Austin','Cody','Kyle','Justin','Travis','Chad','Dustin','Zack',
  'Jake','Josh','Brett','Kevin','Ryan','Shane','Derek','Trevor','Casey','Logan',
  'Hunter','Colt','Wyatt','Garrett','Tanner','Bryce','Chase','Lance','Marcus','Jamal',
  'DeShawn','Terrell','Andre','Darius','Malik','Isaiah','Xavier','Devin','Jordan','Corey',
  'Antonio','Miguel','Carlos','Luis','Victor','Tommy','Bobby','Randy','Scott','Jeremy',
  'Nathan','Aaron','Adam','Sean','Patrick','Blake','Dalton','Skyler','Reggie','Vince',
];

const LAST = [
  'Mitchell','Carter','Brooks','Sanders','Hayes','Coleman','Walker','Turner','Dawson','Reeves',
  'McCoy','Hutchins','Boone','Tatum','Larkin','Briggs','Holloway','Sutton','Mercer','Pruitt',
  'Whitaker','Galloway','Stokes','Lattimore','Beasley','Vance','Coker','Ridley','Pollard','Mathis',
  'Okafor','Ramirez','Gonzales','Delgado','Vasquez','Nguyen','Kowalski','Russo','Schmidt','OBrien',
  'Jackson','Williams','Johnson','Davis','Thompson','Robinson','Harris','Lewis','Young','Allen',
  'Strickland','Burnett','Caldwell','Easley','Fontenot','Granger','Hawkins','Jessup','Kirby','Lockett',
];

const TOWNS = [
  'Westfield','Riverdale','Oak Valley','Fairmont','Cedar Ridge','Millbrook','Eastlake','Harmon',
  'Copper Creek','Bluffton','Prairie View','Lincoln','Crestwood','Stony Point','Maple Heights',
  'Dillon','Permian Flats','Bayou Vista','Iron City','Summit',
];

export const MASCOTS = [
  { name: 'Falcons',   logo: 'wing'    },
  { name: 'Bulldogs',  logo: 'bulldog' },
  { name: 'Chargers',  logo: 'bolt'    },
  { name: 'Stars',     logo: 'star'    },
  { name: 'Wildcats',  logo: 'paw'     },
  { name: 'Spartans',  logo: 'helm'    },
  { name: 'Rams',      logo: 'horns'   },
  { name: 'Comets',    logo: 'comet'   },
  { name: 'Eagles',    logo: 'wing'    },
  { name: 'Panthers',  logo: 'paw'     },
  { name: 'Titans',    logo: 'helm'    },
  { name: 'Tornadoes', logo: 'comet'   },
];

// Classic high-school color pairings (primary, secondary).
export const COLOR_PRESETS = [
  { name: 'Navy & Gold',       primary: '#14306e', secondary: '#f2b705' },
  { name: 'Cardinal & White',  primary: '#8f1d2c', secondary: '#f4f4f2' },
  { name: 'Forest & Vegas',    primary: '#1d4d2b', secondary: '#d9b310' },
  { name: 'Royal & Silver',    primary: '#1f4fd8', secondary: '#c7ccd4' },
  { name: 'Black & Columbia',  primary: '#17181c', secondary: '#7db9e8' },
  { name: 'Purple & Gold',     primary: '#46245e', secondary: '#e8b923' },
  { name: 'Orange & Black',    primary: '#d35f12', secondary: '#1c1c1e' },
  { name: 'Maroon & Gray',     primary: '#5e1f2e', secondary: '#9aa0a6' },
  { name: 'Kelly & White',     primary: '#1e7a3c', secondary: '#f4f4f2' },
  { name: 'Red & Navy',        primary: '#c0273a', secondary: '#1b2a52' },
];

let seed = Date.now() % 2147483647;
export function srand(s) { seed = (s % 2147483647) || 1; }
export function rnd() { seed = (seed * 48271) % 2147483647; return (seed - 1) / 2147483646; }
export function pick(arr) { return arr[Math.floor(rnd() * arr.length)]; }
export function irange(a, b) { return a + Math.floor(rnd() * (b - a + 1)); }

export function genPlayerName(used) {
  for (let i = 0; i < 40; i++) {
    const n = `${pick(FIRST)} ${pick(LAST)}`;
    if (!used.has(n)) { used.add(n); return n; }
  }
  return `${pick(FIRST)} ${pick(LAST)} Jr.`;
}

export function genTownName() { return pick(TOWNS); }

const SKIN_TONES = ['#c68863', '#8d5a3b', '#5d3a26', '#e0a87f', '#a16a45', '#74462c'];

// Offense + defense + a couple of subs. Attributes 40-99.
const ROSTER_SLOTS = [
  { pos: 'QB', build: 'avg',  bias: { arm: 25, iq: 20, spd: 0 } },
  { pos: 'RB', build: 'avg',  bias: { spd: 20, str: 8 } },
  { pos: 'FB', build: 'big',  bias: { str: 18, spd: -4 } },
  { pos: 'WR', build: 'slim', bias: { spd: 22, hands: 18 } },
  { pos: 'WR', build: 'slim', bias: { spd: 18, hands: 14 } },
  { pos: 'TE', build: 'big',  bias: { hands: 10, str: 12 } },
  { pos: 'LT', build: 'huge', bias: { str: 22 } },
  { pos: 'LG', build: 'huge', bias: { str: 20 } },
  { pos: 'C',  build: 'huge', bias: { str: 18, iq: 10 } },
  { pos: 'RG', build: 'huge', bias: { str: 20 } },
  { pos: 'RT', build: 'huge', bias: { str: 22 } },
  { pos: 'DE', build: 'big',  bias: { str: 16, spd: 8 } },
  { pos: 'DT', build: 'huge', bias: { str: 22 } },
  { pos: 'DT', build: 'huge', bias: { str: 20 } },
  { pos: 'DE', build: 'big',  bias: { str: 14, spd: 10 } },
  { pos: 'LB', build: 'big',  bias: { str: 12, spd: 10, iq: 8 } },
  { pos: 'MLB',build: 'big',  bias: { str: 14, spd: 8, iq: 14 } },
  { pos: 'LB', build: 'big',  bias: { str: 12, spd: 10 } },
  { pos: 'CB', build: 'slim', bias: { spd: 22, hands: 8 } },
  { pos: 'CB', build: 'slim', bias: { spd: 20, hands: 6 } },
  { pos: 'FS', build: 'avg',  bias: { spd: 16, iq: 12, hands: 8 } },
  { pos: 'SS', build: 'avg',  bias: { spd: 12, str: 10 } },
  { pos: 'K',  build: 'slim', bias: { iq: 10 } },
  { pos: 'WR', build: 'avg',  bias: { spd: 12, hands: 10 } },
];

const NUM_RANGE = {
  QB: [1, 19], K: [1, 19], RB: [20, 39], FB: [30, 49], CB: [20, 29], FS: [20, 39], SS: [20, 39],
  WR: [80, 89], TE: [80, 89], LB: [50, 59], MLB: [50, 59],
  LT: [70, 79], LG: [60, 69], C: [50, 59], RG: [60, 69], RT: [70, 79], DE: [90, 99], DT: [90, 99],
};

function attr(base, bias) {
  return Math.max(40, Math.min(99, Math.round(base + (bias || 0) + (rnd() * 22 - 11))));
}

export function genRoster(quality = 0) {
  const used = new Set();
  const usedNums = new Set();
  return ROSTER_SLOTS.map((slot, i) => {
    const [lo, hi] = NUM_RANGE[slot.pos] || [1, 99];
    let num = irange(lo, hi);
    for (let t = 0; t < 30 && usedNums.has(num); t++) num = irange(lo, hi);
    usedNums.add(num);
    const base = 66 + quality;
    return {
      id: i,
      name: genPlayerName(used),
      num,
      pos: slot.pos,
      build: slot.build,
      skin: pick(SKIN_TONES),
      spd:   attr(base, slot.bias.spd),
      str:   attr(base, slot.bias.str),
      hands: attr(base, slot.bias.hands),
      iq:    attr(base, slot.bias.iq),
      arm:   attr(base, slot.bias.arm),
    };
  });
}

export function genRival(avoidName, avoidMascot) {
  let town = genTownName();
  for (let i = 0; i < 20 && town === avoidName; i++) town = genTownName();
  let m = pick(MASCOTS);
  for (let i = 0; i < 20 && m.name === avoidMascot; i++) m = pick(MASCOTS);
  const preset = pick(COLOR_PRESETS);
  return {
    name: town,
    mascot: m.name,
    logoId: m.logo,
    colors: { primary: preset.primary, secondary: preset.secondary },
    roster: genRoster(2),
  };
}
