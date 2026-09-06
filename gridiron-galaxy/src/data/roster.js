// The ten kids from Maple Street, and the machinery that turns a planet record into a full CPU team.
import { makeRng, hashStr } from '../util.js';

export const RATING_KEYS = ['spd', 'acc', 'agi', 'cat', 'thp', 'tha', 'tak', 'cov', 'blk', 'str', 'kik', 'sta', 'awr'];
export const RATING_LABEL = { spd: 'Speed', acc: 'Accel', agi: 'Agility', cat: 'Catching', thp: 'Arm Power', tha: 'Accuracy', tak: 'Tackling', cov: 'Coverage', blk: 'Blocking', str: 'Strength', kik: 'Kicking', sta: 'Stamina', awr: 'Awareness' };

// Position: QB C RB X Z (offense)  R LB CB1 CB2 S (defense). X/Z are the wide receivers.
export const OFFENSE_ROLES = ['QB', 'C', 'RB', 'X', 'Z'];
export const DEFENSE_ROLES = ['R', 'LB', 'CB1', 'CB2', 'S'];

export const KIDS = [
  { id: 'dex', name: 'Dex Malone', nick: 'Dex', role: 'QB', num: 7, skin: 1, hair: 'short', hairColor: '#3a2a1a', base: { spd: 58, acc: 60, agi: 60, cat: 55, thp: 64, tha: 70, tak: 40, cov: 40, blk: 42, str: 50, kik: 62, sta: 66, awr: 72 }, bio: 'Team captain. Draws plays in the margins of his homework.' },
  { id: 'tony', name: 'Tony "Big Tony" Russo', nick: 'Big Tony', role: 'C', num: 66, skin: 0, hair: 'buzz', hairColor: '#1a1a1a', base: { spd: 44, acc: 46, agi: 42, cat: 52, thp: 30, tha: 30, tak: 55, cov: 30, blk: 74, str: 76, kik: 40, sta: 60, awr: 58 }, bio: 'Eats four lunches. Snaps the ball, then eats a fifth.' },
  { id: 'zippy', name: 'Zoe "Zippy" Ramirez', nick: 'Zippy', role: 'RB', num: 22, skin: 2, hair: 'ponytail', hairColor: '#2a1a0a', base: { spd: 72, acc: 74, agi: 70, cat: 58, thp: 40, tha: 35, tak: 45, cov: 40, blk: 40, str: 50, kik: 45, sta: 70, awr: 60 }, bio: 'Fastest kid on Maple Street. Fumbles when she gets excited, which is always.' },
  { id: 'marcus', name: 'Marcus "Hands" Lee', nick: 'Hands', role: 'X', num: 81, skin: 3, hair: 'curly', hairColor: '#1a1a1a', base: { spd: 66, acc: 66, agi: 64, cat: 74, thp: 40, tha: 40, tak: 40, cov: 45, blk: 40, str: 46, kik: 40, sta: 66, awr: 64 }, bio: 'Has never dropped a ball. Has dropped many phones.' },
  { id: 'priya', name: 'Priya Patel', nick: 'Priya', role: 'Z', num: 11, skin: 4, hair: 'braid', hairColor: '#0a0a0a', base: { spd: 70, acc: 68, agi: 66, cat: 62, thp: 40, tha: 40, tak: 40, cov: 44, blk: 38, str: 44, kik: 40, sta: 68, awr: 62 }, bio: 'Runs routes like she\'s late for something. She usually is.' },
  { id: 'kevin', name: 'Kevin Okafor', nick: 'Kevin', role: 'R', num: 99, skin: 3, hair: 'short', hairColor: '#0a0a0a', base: { spd: 60, acc: 66, agi: 55, cat: 50, thp: 35, tha: 35, tak: 64, cov: 45, blk: 50, str: 68, kik: 40, sta: 70, awr: 60 }, bio: 'His dad works for GOOBER. He is not allowed to say what GOOBER does.' },
  { id: 'sam', name: 'Sam "The Wall" Wozniak', nick: 'The Wall', role: 'LB', num: 52, skin: 0, hair: 'spiky', hairColor: '#c9a13a', base: { spd: 56, acc: 58, agi: 52, cat: 52, thp: 35, tha: 35, tak: 72, cov: 55, blk: 58, str: 70, kik: 40, sta: 68, awr: 66 }, bio: 'Once tackled a mailbox. The mailbox lost.' },
  { id: 'jade', name: 'Jade Chen', nick: 'Jade', role: 'CB1', num: 24, skin: 1, hair: 'bob', hairColor: '#1a1a1a', base: { spd: 68, acc: 68, agi: 66, cat: 58, thp: 35, tha: 35, tak: 52, cov: 68, blk: 35, str: 44, kik: 40, sta: 66, awr: 64 }, bio: 'Shadow corner. Also literally in the shadows a lot. Hard to find at recess.' },
  { id: 'ray', name: 'Ray "Lil\' Ray" Jackson', nick: "Lil' Ray", role: 'CB2', num: 2, skin: 3, hair: 'curly', hairColor: '#1a1a1a', base: { spd: 74, acc: 72, agi: 70, cat: 56, thp: 35, tha: 35, tak: 46, cov: 62, blk: 32, str: 40, kik: 40, sta: 66, awr: 56 }, bio: 'Shortest kid on the team. Highest vertical. Nobody knows how.' },
  { id: 'maya', name: 'Maya Sunshine', nick: 'Maya', role: 'S', num: 33, skin: 5, hair: 'ponytail', hairColor: '#5a2a0a', base: { spd: 64, acc: 64, agi: 62, cat: 62, thp: 45, tha: 45, tak: 58, cov: 66, blk: 40, str: 48, kik: 55, sta: 68, awr: 70 }, bio: 'Sees the whole field. Sees through your excuses too.' },
];

export const USER_TEAM = { name: 'Cul-de-Sac Comets', short: 'COMETS', species: 'kid', colors: ['#ff7a1a', '#1c2b5a'], id: 'comets' };

// position templates for generated CPU players: multiplier on the planet rating per key
const POS_TEMPLATE = {
  QB: { spd: 0.9, acc: 0.9, agi: 0.9, cat: 0.85, thp: 1.05, tha: 1.1, tak: 0.6, cov: 0.6, blk: 0.6, str: 0.8, kik: 1.0, sta: 1.0, awr: 1.1 },
  C: { spd: 0.72, acc: 0.75, agi: 0.7, cat: 0.85, thp: 0.5, tha: 0.5, tak: 0.85, cov: 0.5, blk: 1.15, str: 1.15, kik: 0.6, sta: 0.95, awr: 0.95 },
  RB: { spd: 1.08, acc: 1.1, agi: 1.08, cat: 0.9, thp: 0.6, tha: 0.5, tak: 0.7, cov: 0.6, blk: 0.7, str: 0.85, kik: 0.6, sta: 1.05, awr: 0.95 },
  X: { spd: 1.05, acc: 1.02, agi: 1.02, cat: 1.1, thp: 0.6, tha: 0.6, tak: 0.6, cov: 0.7, blk: 0.6, str: 0.75, kik: 0.6, sta: 1.0, awr: 0.98 },
  Z: { spd: 1.08, acc: 1.05, agi: 1.02, cat: 1.02, thp: 0.6, tha: 0.6, tak: 0.6, cov: 0.7, blk: 0.6, str: 0.72, kik: 0.6, sta: 1.0, awr: 0.95 },
  R: { spd: 0.95, acc: 1.02, agi: 0.9, cat: 0.75, thp: 0.5, tha: 0.5, tak: 1.05, cov: 0.7, blk: 0.8, str: 1.1, kik: 0.6, sta: 1.05, awr: 0.95 },
  LB: { spd: 0.92, acc: 0.95, agi: 0.9, cat: 0.8, thp: 0.5, tha: 0.5, tak: 1.12, cov: 0.9, blk: 0.9, str: 1.08, kik: 0.6, sta: 1.0, awr: 1.05 },
  CB1: { spd: 1.08, acc: 1.05, agi: 1.05, cat: 0.9, thp: 0.5, tha: 0.5, tak: 0.85, cov: 1.1, blk: 0.55, str: 0.75, kik: 0.6, sta: 1.0, awr: 1.0 },
  CB2: { spd: 1.1, acc: 1.08, agi: 1.05, cat: 0.88, thp: 0.5, tha: 0.5, tak: 0.8, cov: 1.05, blk: 0.55, str: 0.72, kik: 0.6, sta: 1.0, awr: 0.95 },
  S: { spd: 1.0, acc: 1.0, agi: 1.0, cat: 0.95, thp: 0.7, tha: 0.7, tak: 0.95, cov: 1.08, blk: 0.6, str: 0.85, kik: 0.9, sta: 1.0, awr: 1.1 },
};

const SYL_A = ['Zor', 'Bli', 'Gra', 'Nee', 'Vok', 'Plo', 'Sqi', 'Mun', 'Tra', 'Kee', 'Wob', 'Flo', 'Dree', 'Glim', 'Sna', 'Yub', 'Quo', 'Bex', 'Lum', 'Pid'];
const SYL_B = ['bo', 'zik', 'let', 'nak', 'pip', 'gus', 'dle', 'mo', 'rix', 'zo', 'bert', 'nia', 'tok', 'wee', 'sy', 'ble', 'nk', 'ra', 'zz', 'lo'];
const SUR = ['Splorch', 'McZap', 'Von Glorp', 'Bloopington', 'Zzzt', 'Wobbleton', 'Krunch', 'Fizzwhistle', 'Grabowski', 'Nebulon', 'Snorfle', 'Quasarson', 'Blipp', 'Tentaclesworth', 'Orbitz', 'Flapjack', 'Vroom', 'Gigglesnort', 'Photon', 'Bumblebee'];

export function alienName(rnd) {
  return `${rnd.pick(SYL_A)}${rnd.pick(SYL_B)} ${rnd.pick(SUR)}`;
}

export function makePlayer({ id, name, nick, role, num, ratings, team, skin = 0, hair = 'none', hairColor = '#222', bio = '' }) {
  return { id, name, nick: nick || name.split(' ')[0], role, num, r: ratings, team, skin, hair, hairColor, bio };
}

// difficulty scale for CPU ratings
export const DIFFICULTY = { rookie: { cpu: 0.9, aiReact: 1.35 }, normal: { cpu: 1.0, aiReact: 1.0 }, allstar: { cpu: 1.07, aiReact: 0.8 } };

export function buildPlanetTeam(planet, difficulty = 'normal') {
  const rnd = makeRng(hashStr(planet.id + ':team'));
  const t = planet.team;
  const scale = (DIFFICULTY[difficulty] || DIFFICULTY.normal).cpu;
  const roles = [...OFFENSE_ROLES, ...DEFENSE_ROLES];
  const usedNums = new Set();
  const players = roles.map((role, i) => {
    const tmpl = POS_TEMPLATE[role];
    const r = {};
    for (const k of RATING_KEYS) {
      let v = planet.rating * tmpl[k] * scale + rnd.range(-4, 4) + (t.perk.boosts[k] || 0);
      r[k] = Math.round(Math.max(20, Math.min(99, v)));
    }
    let num; do { num = rnd.int(1, 99); } while (usedNums.has(num)); usedNums.add(num);
    const name = i === 0 && t.captain ? t.captain : alienName(rnd);
    return makePlayer({ id: `${planet.id}_${role}`, name, nick: name.split(' ')[0], role, num, ratings: r, team: 'away', skin: rnd.int(0, 5) });
  });
  return { id: planet.id, name: t.name, short: t.short, species: t.species, colors: t.colors, perk: t.perk, players, planet, rating: planet.rating, side: 'away' };
}

// gear catalog: id -> { name, stat, per-tier bonus }
export const GEAR = {
  cleats: { name: 'Rocket Cleats', stat: 'spd', icon: 'cleat', desc: 'Faster feet for the whole squad.' },
  gloves: { name: 'Grip Gloves', stat: 'cat', icon: 'glove', desc: 'Sticky palms. Fewer drops.' },
  sleeve: { name: 'Cannon Sleeve', stat: 'tha', icon: 'sleeve', desc: 'Tighter spirals, truer throws.' },
  visor: { name: 'Hawk Visor', stat: 'cov', icon: 'visor', desc: 'Read routes before they happen.' },
  pads: { name: 'Thunder Pads', stat: 'tak', icon: 'pads', desc: 'Wrap up and finish the tackle.' },
  shoe: { name: 'Boomer Boot', stat: 'kik', icon: 'boot', desc: 'Longer kicks, straighter punts.' },
  band: { name: 'Juke Bands', stat: 'agi', icon: 'band', desc: 'Sharper cuts and spins.' },
  brace: { name: 'Anchor Brace', stat: 'blk', icon: 'brace', desc: 'Blocks hold a beat longer.' },
  tank: { name: 'Turbo Tank', stat: 'sta', icon: 'tank', desc: 'Sprint longer before gassing out.' },
  arm: { name: 'Rocket Arm Band', stat: 'thp', icon: 'arm', desc: 'More zip on every throw.' },
};
export const GEAR_TIER_BONUS = [0, 3, 6, 10];
export const GEAR_TIER_PRICE = [0, 350, 800, 1600];

// food: one-game buffs
export const FOOD = {
  smoothie: { name: 'Rocket Fuel Smoothie', stat: 'spd', amt: 6, price: 120, icon: 'cup' },
  buns: { name: 'Sticky Buns', stat: 'cat', amt: 8, price: 120, icon: 'bun' },
  chili: { name: 'Cannon Arm Chili', stat: 'thp', amt: 8, price: 140, icon: 'bowl' },
  waffles: { name: 'Iron Wall Waffles', stat: 'tak', amt: 8, price: 140, icon: 'waffle' },
  juice: { name: 'Juke Juice', stat: 'agi', amt: 7, price: 130, icon: 'juice' },
  pizza: { name: 'Power Pizza', stat: 'str', amt: 8, price: 150, icon: 'pizza' },
  cookies: { name: 'Focus Cookies', stat: 'awr', amt: 8, price: 110, icon: 'cookie' },
  taco: { name: 'Turbo Taco', stat: 'sta', amt: 12, price: 100, icon: 'taco' },
};

export function buildUserTeam(save, planetIndexForBuffs = null) {
  const lvl = save.teamLevel || 0;
  const players = KIDS.map(k => {
    const r = {};
    for (const key of RATING_KEYS) {
      let v = k.base[key] + lvl;
      for (const [gid, tier] of Object.entries(save.gear || {})) { const g = GEAR[gid]; if (g && g.stat === key) v += GEAR_TIER_BONUS[tier] || 0; }
      for (const fid of save.pantryActive || []) { const f = FOOD[fid]; if (f && f.stat === key) v += f.amt; }
      r[key] = Math.round(Math.min(99, v));
    }
    return makePlayer({ id: k.id, name: k.name, nick: k.nick, role: k.role, num: k.num, ratings: r, team: 'home', skin: k.skin, hair: k.hair, hairColor: k.hairColor, bio: k.bio });
  });
  const rating = Math.round(players.reduce((s, p) => s + (p.r.spd + p.r.cat + p.r.tak + p.r.cov + p.r.tha + p.r.agi) / 6, 0) / players.length);
  return { ...USER_TEAM, players, rating, side: 'home', perk: { name: 'Backyard Grit', boosts: {}, trait: null } };
}

export function playerByRole(team, role) { return team.players.find(p => p.role === role); }
export function overall(p) { const r = p.r; return Math.round((r.spd + r.agi + r.cat + r.awr + r.sta + ({ QB: r.tha * 2 + r.thp, C: r.blk * 2 + r.str, RB: r.acc * 2 + r.str, X: r.cat + r.acc * 2, Z: r.cat + r.acc * 2, R: r.tak + r.str * 2, LB: r.tak * 2 + r.str, CB1: r.cov * 2 + r.acc, CB2: r.cov * 2 + r.acc, S: r.cov * 2 + r.tak }[p.role] || 0)) / 8); }
