// Opponent teams. Five players each, playing both ways:
//   offense  QB · LINE · WR1 · WR2 · BACK      defense  S · RUSH · CB1 · CB2 · LB   (same order)
// `level` scales stats; `iq` (0–1) controls how sharp their AI is.
const ROLE_BASE = {
  QB: { spd: 4, str: 3, hnd: 4, arm: 6, agi: 5 },
  LINE: { spd: 3, str: 7, hnd: 2, arm: 2, agi: 2 },
  WR: { spd: 6.4, str: 3, hnd: 6, arm: 2, agi: 6 },
  BACK: { spd: 5.4, str: 5, hnd: 4, arm: 2, agi: 5 },
};
const ORDER = ['QB', 'LINE', 'WR', 'WR', 'BACK'];
export const CPU_OFF = ['QB', 'LINE', 'WR1', 'WR2', 'BACK'];
export const CPU_DEF = ['S', 'RUSH', 'CB1', 'CB2', 'LB'];

function squad(level, members) {
  return members.map((m, i) => {
    const base = ROLE_BASE[ORDER[i]];
    const stats = {};
    for (const k of Object.keys(base)) stats[k] = Math.min(10.2, base[k] + level * 0.31 + ((m.plus && m.plus[k]) || 0));
    stats.sta = 70 + level * 6;
    return { name: m.name, spec: m.spec, stats, n: m.n ?? (i + 1) * 11 };
  });
}
const uni = (jersey, helmet, stripe, pants = 0xf4f0e6) => ({ jersey, pants, helmet: { color: helmet, stripe } });
const gnome = (shirt, hat, build = 'small', n) => ({ kind: 'gnome', build, shirt, helmet: { color: hat, stripe: 0xfff4dc }, shoes: 0x3a2a2e, number: n });
const raccoon = () => ({ kind: 'animal', species: 'raccoon', shirt: 0xfffaf0, acc: ['apron'], hat: 'bucket', hatC: 0x9aa3ad });
const scare = (n, helmet = true) => ({ kind: 'scarecrow', shirt: 0x4a6fa5, number: n, ...(helmet ? { helmet: { color: 0x8a5a34, stripe: 0xe8c95a } } : {}) });
const crow = (n) => ({ kind: 'animal', species: 'crow', number: n, ...uni(0x5a3f8a, 0x2b2b36, 0xb07aff) });
const snow = (n) => ({ kind: 'snowman', jersey: 0x2a6f9a, number: n, helmet: { color: 0x2a6f9a, stripe: 0xffffff } });
const penguin = (n) => ({ kind: 'animal', species: 'penguin', build: 'small', number: n, ...uni(0x2a6f9a, 0x2a6f9a, 0xffffff) });
const robot = (n, neon = 0x58e6ff, build = 'normal') => ({ kind: 'robot', build, neon, jersey: 0xd63f8c, number: n });
const gull = (n) => ({ kind: 'animal', species: 'seagull', number: n, ...uni(0x2a6f77, 0xf2b632, 0xffffff) });
const ghost = (n, fur = 0xc9b6f2) => ({ kind: 'ghost', fur, jersey: 0x4a2f7a, number: n, hat: 'leather', hatC: 0x3a2a4a });

export const TEAMS = {
  // ---------------------------------------------------------------- Huddle Hollow / Backyard Borough
  dishpit: {
    name: 'The Dish Pit', short: 'DISH', color: '#8b8e99', level: 1, iq: 0.1, xp: 16, coins: 0,
    off: { pass: ['cpu_slants', 'cpu_outs'], run: ['cpu_dive'], runRate: 0.45 }, def: ['man_lock', 'zone_blanket'],
    squad: squad(0.5, [{ name: 'Suds', spec: raccoon() }, { name: 'Scrubs', spec: { ...raccoon(), build: 'big' } }, { name: 'Rinse', spec: raccoon() }, { name: 'Soak', spec: raccoon() }, { name: 'Spatula', spec: raccoon() }]),
  },
  gnome_scouts: {
    name: 'Gnome Scouts', short: 'GNOM', color: '#c8452d', level: 1, iq: 0.25, xp: 22, coins: 12, parts: 0.25, item: ['orange', 0.4],
    hazard: 'sprinklers',
    off: { pass: ['cpu_slants', 'cpu_outs'], run: ['cpu_dive', 'cpu_sweep'], runRate: 0.4 }, def: ['man_lock', 'zone_blanket'],
    squad: squad(1, [{ name: 'Pebble', spec: gnome(0x3f6fb5, 0xc8452d, 'small', 1) }, { name: 'Trowel', spec: gnome(0x3f6fb5, 0xc8452d, 'normal', 50) }, { name: 'Moss', spec: gnome(0x3f6fb5, 0xc8452d, 'small', 80) }, { name: 'Fern', spec: gnome(0x3f6fb5, 0xc8452d, 'small', 81) }, { name: 'Mulch', spec: gnome(0x3f6fb5, 0xc8452d, 'small', 20) }]),
  },
  gnome_diggers: {
    name: 'Gnome Diggers', short: 'DIGS', color: '#2a6f77', level: 2, iq: 0.35, xp: 30, coins: 18, parts: 0.35, item: ['drink', 0.3],
    hazard: 'sprinklers',
    off: { pass: ['cpu_slants', 'cpu_cross', 'cpu_outs'], run: ['cpu_dive', 'cpu_sweep'], runRate: 0.5 }, def: ['man_lock', 'zone_blanket', 'blitz_party'],
    squad: squad(2, [{ name: 'Spade', spec: gnome(0x8a5aa8, 0x2a6f77, 'small', 3) }, { name: 'Boulder', spec: gnome(0x8a5aa8, 0x2a6f77, 'big', 66) }, { name: 'Twig', spec: gnome(0x8a5aa8, 0x2a6f77, 'small', 84) }, { name: 'Burr', spec: gnome(0x8a5aa8, 0x2a6f77, 'small', 85) }, { name: 'Clod', spec: gnome(0x8a5aa8, 0x2a6f77, 'normal', 30) }]),
  },
  gnomes: {
    name: 'Cul-de-Sac Gnomes', short: 'GNOMES', color: '#c8452d', level: 3, iq: 0.45, xp: 60, coins: 0, rival: true,
    hazard: 'sprinklers',
    off: { pass: ['cpu_slants', 'cpu_outs', 'cpu_cross', 'cpu_deep'], run: ['cpu_dive', 'cpu_sweep'], runRate: 0.42 }, def: ['man_lock', 'zone_blanket', 'blitz_party'],
    squad: squad(2.6, [{ name: 'Big Terracotta', spec: gnome(0x3f6fb5, 0xc8452d, 'big', 1), plus: { arm: 1, str: 2 } }, { name: 'Flagstone', spec: gnome(0x3f6fb5, 0xc8452d, 'big', 77), plus: { str: 1 } }, { name: 'Clover', spec: gnome(0x3f6fb5, 0xc8452d, 'small', 80), plus: { spd: 0.6 } }, { name: 'Thistle', spec: gnome(0x3f6fb5, 0xc8452d, 'small', 88) }, { name: 'Gerald Jr.', spec: gnome(0x3f6fb5, 0xc8452d, 'normal', 22) }]),
  },
  // ---------------------------------------------------------------- Harvest Fairgrounds
  crows: {
    name: 'The Murder', short: 'CROW', color: '#5a3f8a', level: 3, iq: 0.4, xp: 36, coins: 22, parts: 0.35, item: ['salts', 0.35],
    hazard: 'bales', tackleStatus: ['butter', 0.2],
    off: { pass: ['cpu_deep', 'cpu_cross', 'cpu_slants'], run: ['cpu_sweep'], runRate: 0.25 }, def: ['man_lock', 'blitz_party', 'double_trouble'],
    squad: squad(3.4, [{ name: 'Caw', spec: crow(4) }, { name: 'Rook', spec: { ...crow(60), build: 'big' } }, { name: 'Jack', spec: crow(81), plus: { spd: 0.8 } }, { name: 'Daw', spec: crow(82) }, { name: 'Pica', spec: crow(27) }]),
  },
  scarecrows: {
    name: 'Scarecrow Shift', short: 'STRAW', color: '#b98a3a', level: 4, iq: 0.45, xp: 42, coins: 26, parts: 0.4, item: ['orange', 0.4],
    hazard: 'bales', tackleStatus: ['butter', 0.3],
    off: { pass: ['cpu_outs', 'cpu_cross'], run: ['cpu_dive', 'cpu_sweep'], runRate: 0.55 }, def: ['zone_blanket', 'fence_line', 'man_lock'],
    squad: squad(4.2, [{ name: 'Burlap', spec: scare(9) }, { name: 'Haystack', spec: { ...scare(70), build: 'big' } }, { name: 'Twine', spec: scare(83) }, { name: 'Chaff', spec: scare(86) }, { name: 'Husk', spec: scare(33) }]),
  },
  haymakers: {
    name: 'Harvest Haymakers', short: 'HAY', color: '#f08a24', level: 5, iq: 0.55, xp: 90, coins: 0, rival: true,
    hazard: 'bales', tackleStatus: ['butter', 0.35],
    off: { pass: ['cpu_outs', 'cpu_cross', 'cpu_deep', 'cpu_slants'], run: ['cpu_dive', 'cpu_sweep'], runRate: 0.5 }, def: ['zone_blanket', 'fence_line', 'man_lock', 'blitz_party'],
    squad: squad(5, [{ name: 'Old Stitch', spec: { kind: 'pumpkin', shirt: 0x4a3a5a, helmet: { color: 0x5a7a3c }, build: 'big' }, plus: { arm: 1.2 } }, { name: 'Combine', spec: { ...scare(79), build: 'huge' }, plus: { str: 1.5 } }, { name: 'Corvina', spec: crow(1), plus: { spd: 1 } }, { name: 'Twine', spec: scare(83) }, { name: 'Thresher', spec: scare(34), plus: { str: 1 } }]),
  },
  // ---------------------------------------------------------------- Frostbite Falls
  penguins: {
    name: 'Penguin Huddle', short: 'PENG', color: '#2e3440', level: 5, iq: 0.5, xp: 50, coins: 30, parts: 0.4, item: ['cocoa', 0.25],
    hazard: 'ice', tackleStatus: ['freeze', 0.2],
    off: { pass: ['cpu_slants', 'cpu_cross'], run: ['cpu_dive', 'cpu_sweep'], runRate: 0.5 }, def: ['zone_blanket', 'man_lock', 'fence_line'],
    squad: squad(5.4, [{ name: 'Waddle', spec: penguin(5) }, { name: 'Tux', spec: { ...penguin(55), build: 'normal' } }, { name: 'Floe', spec: penguin(80), plus: { spd: 0.8 } }, { name: 'Brrr', spec: penguin(89) }, { name: 'Krill', spec: penguin(25) }]),
  },
  snowpatrol: {
    name: 'Snow Patrol', short: 'SNOW', color: '#8fb7d9', level: 6, iq: 0.55, xp: 56, coins: 34, parts: 0.45, item: ['drink', 0.35],
    hazard: 'ice', tackleStatus: ['freeze', 0.3],
    off: { pass: ['cpu_outs', 'cpu_deep', 'cpu_cross'], run: ['cpu_dive'], runRate: 0.4 }, def: ['man_lock', 'double_trouble', 'blitz_party'],
    squad: squad(6.2, [{ name: 'Frosty-ish', spec: snow(12) }, { name: 'Drift', spec: { ...snow(72), build: 'big' } }, { name: 'Sleet', spec: snow(84) }, { name: 'Hail', spec: snow(87) }, { name: 'Slush Sr.', spec: snow(36) }]),
  },
  flurries: {
    name: 'Falls Flurries', short: 'FLURRY', color: '#2a6f9a', level: 7, iq: 0.65, xp: 120, coins: 0, rival: true,
    hazard: 'ice', tackleStatus: ['freeze', 0.35],
    off: { pass: ['cpu_outs', 'cpu_deep', 'cpu_cross', 'cpu_slants'], run: ['cpu_dive', 'cpu_sweep'], runRate: 0.45 }, def: ['man_lock', 'zone_blanket', 'double_trouble', 'blitz_party'],
    squad: squad(7, [{ name: 'Flurry', spec: snow(10), plus: { arm: 1.2 } }, { name: 'Avalanche', spec: { kind: 'animal', species: 'yeti', build: 'huge', number: 99, ...uni(0x2a6f9a, 0x2a6f9a, 0xffffff) }, plus: { str: 2 } }, { name: 'Floe', spec: penguin(80), plus: { spd: 1.2 } }, { name: 'Sleet', spec: snow(84) }, { name: 'Tux', spec: { ...penguin(28), build: 'normal' }, plus: { str: 1 } }]),
  },
  // ---------------------------------------------------------------- Neon Boardwalk
  gulls: {
    name: 'Gull Gang', short: 'GULL', color: '#2a6f77', level: 7, iq: 0.6, xp: 64, coins: 38, parts: 0.45, item: ['gum', 0.3],
    hazard: 'flicker', tackleStatus: ['glitch', 0.15],
    off: { pass: ['cpu_deep', 'cpu_cross', 'cpu_slants', 'cpu_outs'], run: ['cpu_sweep'], runRate: 0.3 }, def: ['man_lock', 'blitz_party', 'double_trouble'],
    squad: squad(7.4, [{ name: 'Squawk', spec: gull(7) }, { name: 'Pier', spec: { ...gull(61), build: 'big' } }, { name: 'Fry', spec: gull(81), plus: { spd: 0.8 } }, { name: 'Chip', spec: gull(85) }, { name: 'Brine Jr.', spec: gull(29) }]),
  },
  tokens: {
    name: 'Token Takers', short: 'TOKN', color: '#d63f8c', level: 8, iq: 0.7, xp: 70, coins: 42, parts: 0.55, item: ['cider', 0.3],
    hazard: 'flicker', tackleStatus: ['glitch', 0.25],
    off: { pass: ['cpu_outs', 'cpu_slants', 'cpu_cross'], run: ['cpu_dive', 'cpu_sweep'], runRate: 0.5 }, def: ['zone_blanket', 'fence_line', 'man_lock', 'blitz_party'],
    squad: squad(8.2, [{ name: 'COIN-OP', spec: robot(8) }, { name: 'TILT', spec: robot(74, 0xffd45a, 'big') }, { name: 'PIXEL', spec: robot(82, 0xb6f08a) }, { name: 'SPRITE', spec: robot(86, 0xb6f08a) }, { name: 'JOYSTICK', spec: robot(31) }]),
  },
  buzzers: {
    name: 'Boardwalk Buzzers', short: 'BUZZ', color: '#4a3ad6', level: 9, iq: 0.74, xp: 150, coins: 0, rival: true,
    hazard: 'flicker', tackleStatus: ['glitch', 0.3],
    off: { pass: ['cpu_outs', 'cpu_deep', 'cpu_cross', 'cpu_slants'], run: ['cpu_dive', 'cpu_sweep'], runRate: 0.42 }, def: ['man_lock', 'zone_blanket', 'double_trouble', 'blitz_party', 'fence_line'],
    squad: squad(9, [{ name: 'HI-SCORE', spec: { kind: 'robot', build: 'big', neon: 0xff5ad0, jersey: 0x4a3ad6, number: 1 }, plus: { arm: 1.4 } }, { name: 'TILT', spec: { kind: 'robot', build: 'huge', neon: 0xffd45a, jersey: 0x4a3ad6, number: 74 }, plus: { str: 1.5 } }, { name: 'TURBO', spec: { kind: 'robot', neon: 0x58e6ff, jersey: 0x4a3ad6, number: 80 }, plus: { spd: 1.2 } }, { name: 'COMBO', spec: { kind: 'robot', neon: 0x58e6ff, jersey: 0x4a3ad6, number: 88 } }, { name: 'BOSS', spec: { kind: 'robot', neon: 0xb6f08a, jersey: 0x4a3ad6, number: 32 }, plus: { str: 1 } }]),
  },
  // ---------------------------------------------------------------- the Midnight Bowl
  graveyard: {
    name: 'The Graveyard Shift', short: 'SHIFT', color: '#6a5a9a', level: 11, iq: 0.84, xp: 250, coins: 0, rival: true,
    hazard: 'fog', tackleStatus: ['spook', 0.3],
    off: { pass: ['cpu_outs', 'cpu_deep', 'cpu_cross', 'cpu_slants'], run: ['cpu_dive', 'cpu_sweep'], runRate: 0.42 }, def: ['man_lock', 'zone_blanket', 'double_trouble', 'blitz_party', 'fence_line'],
    squad: squad(10.6, [{ name: 'The Captain Before', spec: ghost(1, 0xc9b6f2), plus: { arm: 1 } }, { name: 'Tombstone', spec: { ...ghost(78, 0xb6c9f2), scale: 1.25 }, plus: { str: 2 } }, { name: 'Wisp', spec: ghost(80, 0xd9c6ff), plus: { spd: 1 } }, { name: 'Shiver', spec: ghost(87, 0xd9c6ff) }, { name: 'Moan', spec: ghost(35, 0xc9b6f2) }]),
  },
  // ---------------------------------------------------------------- Backyard Blitz (2 on 2)
  acorns: {
    name: 'The Acorn Twins', short: 'ACORN', color: '#b5683a', level: 2, iq: 0.4, xp: 0, coins: 0,
    off: { pass: ['cpu_slants', 'cpu_outs', 'cpu_deep'], run: [], runRate: 0 }, def: ['man_lock'],
    squad: squad(2.5, [{ name: 'Nutmeg', spec: { kind: 'animal', species: 'squirrel', build: 'small', ...uni(0x6aa84f, 0x6aa84f, 0xfff4dc), number: 2 }, plus: { arm: 1, spd: 1 } }, { name: '-', spec: gnome(0, 0) }, { name: 'Clove', spec: { kind: 'animal', species: 'squirrel', build: 'small', fur: 0x9a5a34, ...uni(0x6aa84f, 0x6aa84f, 0xfff4dc), number: 3 }, plus: { spd: 1 } }, { name: '-', spec: gnome(0, 0) }, { name: '-', spec: gnome(0, 0) }]),
  },
};

/** A tougher copy of a team for rematches / visiting exhibition games. */
export function scaledTeam(id, bonus) {
  const t = TEAMS[id];
  if (!bonus) return t;
  const c = { ...t, level: t.level + bonus, iq: Math.min(0.95, t.iq + bonus * 0.05), xp: Math.round(t.xp * (1 + bonus * 0.2)) };
  c.squad = t.squad.map((m) => ({ ...m, stats: Object.fromEntries(Object.entries(m.stats).map(([k, v]) => [k, k === 'sta' ? v + bonus * 6 : Math.min(11, v + bonus * 0.36)])) }));
  return c;
}
