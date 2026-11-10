// The recruitable roster. Stats are 1–10; stamina is a pool.
//   spd speed · str blocking/tackling/breaking tackles · hnd hands (catch + INT windows)
//   arm throwing · agi dodges, cuts, coverage · kick kicking · sta max stamina
// pos = how well they play each spot (0–3). Offense: QB LINE WR BACK. Defense: RUSH LB CB S. Plus K.
import { G } from '../core/game.js';

export const CAST = {
  captain: {
    name: 'Captain', title: 'The Captain', role: 'BACK', color: '#f08a24', pitch: 1.0,
    spec: { kind: 'animal', species: 'fox', build: 'normal' }, number: 1,
    stats: { spd: 6, str: 5, hnd: 6, arm: 5, agi: 6, kick: 4, sta: 100 },
    grow: ['spd', 'agi', 'hnd', 'str'],
    pos: { QB: 2, LINE: 1, WR: 2, BACK: 3, RUSH: 1, LB: 3, CB: 2, S: 2, K: 1 },
    ability: 'rally',
    bio: 'New in town. Inherited a clubhouse, a whistle, and a suspicious amount of responsibility.',
  },
  pip: {
    name: 'Pip', title: 'Nervous Quarterback', role: 'QB', color: '#8f8a94', pitch: 1.35,
    spec: { kind: 'animal', species: 'possum', build: 'small' }, number: 7,
    stats: { spd: 5, str: 2, hnd: 4, arm: 8, agi: 6, kick: 3, sta: 85 },
    grow: ['arm', 'agi', 'spd', 'hnd'],
    pos: { QB: 3, LINE: 0, WR: 1, BACK: 1, RUSH: 0, LB: 0, CB: 1, S: 2, K: 1 },
    ability: 'playdead',
    bio: 'Has a cannon for an arm and a strong instinct to lie down when things get stressful.',
  },
  waffle: {
    name: 'Waffle', title: 'Short-Order Lineman', role: 'LINE', color: '#8b5a3a', pitch: 0.62,
    spec: { kind: 'animal', species: 'bear', build: 'huge' }, number: 77,
    stats: { spd: 3, str: 10, hnd: 3, arm: 3, agi: 2, kick: 4, sta: 130 },
    grow: ['str', 'str', 'sta', 'spd'],
    pos: { QB: 0, LINE: 3, WR: 0, BACK: 1, RUSH: 3, LB: 2, CB: 0, S: 0, K: 1 },
    ability: 'pancake',
    bio: 'Cooks at the diner. Roughly the size and temperature of a refrigerator.',
  },
  zip: {
    name: 'Zip', title: 'Receiver (Won’t Stop Talking)', role: 'WR', color: '#e58a9c', pitch: 1.6,
    spec: { kind: 'animal', species: 'rabbit', build: 'normal' }, number: 88,
    stats: { spd: 9, str: 3, hnd: 7, arm: 3, agi: 8, kick: 3, sta: 90 },
    grow: ['spd', 'hnd', 'agi', 'spd'],
    pos: { QB: 0, LINE: 0, WR: 3, BACK: 2, RUSH: 0, LB: 1, CB: 3, S: 2, K: 0 },
    ability: 'doubletake',
    bio: 'Fastest feet in Huddle Hollow. Faster mouth. Has opinions about your route tree.',
  },
  june: {
    name: 'June', title: 'Night-Shift Safety', role: 'S', color: '#b79a62', pitch: 1.15,
    spec: { kind: 'animal', species: 'moth', build: 'small' }, number: 21,
    stats: { spd: 7, str: 3, hnd: 8, arm: 2, agi: 8, kick: 2, sta: 85 },
    grow: ['hnd', 'agi', 'spd', 'hnd'],
    pos: { QB: 0, LINE: 0, WR: 2, BACK: 1, RUSH: 1, LB: 1, CB: 3, S: 3, K: 0 },
    ability: 'lightsout',
    bio: 'A moth of few words. Drawn to stadium lights and badly thrown footballs.',
  },
  hollow: {
    name: 'Coach Hollow', title: 'Ghost Kicker (Under Contract)', role: 'K', color: '#4f9c8a', pitch: 0.8,
    spec: { kind: 'ghost', fur: 0xbfeee0, hat: 'leather', hatC: 0x8a5a34, acc: ['mustache', 'whistle'] }, number: 0,
    stats: { spd: 5, str: 4, hnd: 5, arm: 4, agi: 5, kick: 9, sta: 95 },
    grow: ['kick', 'hnd', 'spd', 'str'],
    pos: { QB: 1, LINE: 1, WR: 2, BACK: 1, RUSH: 2, LB: 2, CB: 2, S: 2, K: 3 },
    ability: 'secondchance',
    bio: 'Has been dead for some time and considers this a clerical matter. His contract has no end date.',
  },
  cheese: {
    name: 'Big Cheese', title: 'Mascot at Large', role: 'BACK', color: '#e0a92e', pitch: 1.45,
    spec: { kind: 'animal', species: 'mouse', build: 'small', acc: ['cheese'] }, number: 14,
    stats: { spd: 6, str: 6, hnd: 5, arm: 3, agi: 7, kick: 3, sta: 100 },
    grow: ['agi', 'str', 'spd', 'sta'],
    pos: { QB: 0, LINE: 2, WR: 2, BACK: 3, RUSH: 2, LB: 2, CB: 1, S: 1, K: 0 },
    ability: 'stinky',
    bio: 'A very small mouse in a very large wedge. Nobody has seen him out of costume.',
  },
  slush: {
    name: 'Slush', title: 'Belly-First Corner', role: 'CB', color: '#58b8c9', pitch: 1.25,
    spec: { kind: 'animal', species: 'penguin', build: 'small' }, number: 3,
    stats: { spd: 7, str: 4, hnd: 7, arm: 2, agi: 7, kick: 4, sta: 95 },
    grow: ['spd', 'hnd', 'agi', 'str'],
    pos: { QB: 0, LINE: 1, WR: 3, BACK: 2, RUSH: 1, LB: 2, CB: 3, S: 2, K: 1 },
    ability: 'bellyslide',
    bio: 'Does not run so much as launch. Friction is a suggestion.',
  },
  sal: {
    name: 'Sal', title: 'Boardwalk Ball Thief', role: 'CB', color: '#9aa3ad', pitch: 0.95,
    spec: { kind: 'animal', species: 'seagull', build: 'normal' }, number: 44,
    stats: { spd: 8, str: 5, hnd: 8, arm: 3, agi: 6, kick: 2, sta: 95 },
    grow: ['hnd', 'spd', 'str', 'agi'],
    pos: { QB: 0, LINE: 1, WR: 2, BACK: 2, RUSH: 2, LB: 2, CB: 3, S: 3, K: 0 },
    ability: 'snatch',
    bio: 'Will take your fries, your football, and occasionally your hat. Says it is "a calling."',
  },
};

export const ABILITIES = {
  rally: { name: 'Rally Cry', side: 'both', cost: 22, icon: '📣', desc: 'Whole squad gets Hyped (faster) this play and shakes off bad statuses.' },
  playdead: { name: 'Play Dead', side: 'off', cost: 18, icon: '💀', desc: 'When the rush gets close, Pip flops. Rushers lose interest for a moment.' },
  pancake: { name: 'Pancake Breakfast', side: 'both', cost: 24, icon: '🥞', desc: 'Flattens the first defender he hits and leaves a slippery syrup patch.' },
  doubletake: { name: 'Double Take', side: 'off', cost: 20, icon: '👯', desc: 'A decoy Zip runs a different route and drags coverage with it.' },
  lightsout: { name: 'Lights Out', side: 'def', cost: 20, icon: '🌙', desc: 'Hides your assignments. Their passer reads late and throws wild.' },
  secondchance: { name: 'Second Chance', side: 'kick', cost: 25, icon: '👻', desc: 'Miss a kick? Try it again. (Stamina is only spent if you use it.)' },
  stinky: { name: 'Stinky Cheese', side: 'off', cost: 18, icon: '🧀', desc: 'Defenders near Big Cheese back away, clearing a lane.' },
  bellyslide: { name: 'Belly Slide', side: 'both', cost: 16, icon: '🐧', desc: 'A long, fast, untacklable slide straight ahead after the catch — or into a tackle.' },
  snatch: { name: 'Snatch', side: 'def', cost: 22, icon: '🍟', desc: 'First hit on the ball carrier tries to strip the ball outright.' },
};

/** Speed in units/sec for a 1–10 stat. */
export const speedOf = (spd) => 5.3 + spd * 0.42;

export function charState(id) {
  const S = G.S;
  if (!S.chars[id]) S.chars[id] = { lv: 1, xp: 0, st: CAST[id].stats.sta, gear: null, bond: 0, hang: 0 };
  return S.chars[id];
}

/** Effective stats: base + level growth + gear. */
export function statsOf(id) {
  const base = CAST[id].stats;
  const cs = charState(id);
  const out = { ...base };
  const grow = CAST[id].grow;
  for (let lv = 2; lv <= cs.lv; lv++) {
    const key = grow[(lv - 2) % grow.length];
    if (key === 'sta') out.sta += 6; else out[key] = Math.min(12, out[key] + 1);
    out.sta += 4;
  }
  const gear = cs.gear && GEAR[cs.gear];
  if (gear && gear.stats) for (const [k, v] of Object.entries(gear.stats)) out[k] = (out[k] || 0) + v;
  if (G.S.meal && G.S.meal.stat) out[G.S.meal.stat] = (out[G.S.meal.stat] || 0) + G.S.meal.amt;
  return out;
}
export const maxStamina = (id) => statsOf(id).sta;
export const xpToNext = (lv) => 40 + lv * 30;

/** Grant XP; returns true if they levelled up. */
export function addXp(id, amount) {
  const cs = charState(id);
  if (cs.lv >= 15) return false;
  cs.xp += amount;
  let up = false;
  while (cs.lv < 15 && cs.xp >= xpToNext(cs.lv)) { cs.xp -= xpToNext(cs.lv); cs.lv++; up = true; }
  if (up) cs.st = maxStamina(id);
  return up;
}

export function displayName(id) {
  if (id === 'captain') return G.S ? G.S.captain.name : 'Captain';
  return CAST[id] ? CAST[id].name : id;
}

/** Model spec for a roster member in the current team uniform. */
export function teamSpec(id, extra = {}) {
  const S = G.S;
  const c = CAST[id];
  const t = S.team;
  const spec = { ...c.spec, jersey: t.jersey, pants: t.pants, trim: t.trim, number: c.number, helmet: { color: t.helmet, stripe: t.stripe }, ...extra };
  if (id === 'captain') { spec.species = S.captain.species; spec.number = S.captain.number ?? 1; if (S.captain.fur) spec.fur = S.captain.fur; }
  if (c.spec.kind === 'ghost') { spec.helmet = null; }
  return spec;
}

// ---------------------------------------------------------------- gear
export const GEAR = {
  sticky_gloves: { name: 'Sticky Gloves', icon: '🧤', desc: '+2 Hands. Slightly gross.', stats: { hnd: 2 } },
  rocket_cleats: { name: 'Rocket Cleats', icon: '👟', desc: '+1 Speed, +1 Agility.', stats: { spd: 1, agi: 1 } },
  lucky_tee: { name: 'Lucky Tee', icon: '📍', desc: '+2 Kick. Found in a sand trap.', stats: { kick: 2 } },
  iron_laces: { name: 'Iron Laces', icon: '🪢', desc: '+2 Strength.', stats: { str: 2 } },
  wind_sock: { name: 'Pocket Wind Sock', icon: '🎏', desc: '+1 Kick, +1 Arm. Reads the breeze.', stats: { kick: 1, arm: 1 } },
  thermos: { name: 'Bottomless Thermos', icon: '🫖', desc: '+25 max Stamina.', stats: { sta: 25 } },
  moth_goggles: { name: 'Night Goggles', icon: '🥽', desc: '+1 Hands, +1 Agility.', stats: { hnd: 1, agi: 1 } },
  golden_arm: { name: 'Golden Sleeve', icon: '💪', desc: '+2 Arm.', stats: { arm: 2 } },
};

// ---------------------------------------------------------------- squads
export const OFF_SLOTS = ['QB', 'LINE', 'WR', 'WR', 'BACK'];
export const DEF_SLOTS = ['RUSH', 'LB', 'CB', 'CB', 'S'];

/** Greedy best-fit of a squad's members into position slots. Returns ids in slot order. */
export function fitSquad(ids, slots) {
  const left = ids.slice();
  const out = new Array(slots.length).fill(null);
  // fill the pickiest slots first
  const order = slots.map((s, i) => i).sort((a, b) => {
    const best = (slot) => Math.max(...left.map((id) => CAST[id].pos[slot] || 0));
    const count = (slot) => left.filter((id) => (CAST[id].pos[slot] || 0) >= 2).length;
    return count(slots[a]) - count(slots[b]) || best(slots[b]) - best(slots[a]);
  });
  for (const i of order) {
    if (!left.length) break;
    let bi = 0, bs = -1;
    left.forEach((id, k) => {
      const s = (CAST[id].pos[slots[i]] || 0) * 10 + (CAST[id].role === slots[i] ? 5 : 0);
      if (s > bs) { bs = s; bi = k; }
    });
    out[i] = left.splice(bi, 1)[0];
  }
  return out;
}

/** Make sure both squads are legal (5 recruited members, or as many as exist). */
export function normalizeSquads() {
  const S = G.S;
  for (let q = 0; q < 2; q++) {
    let sq = (S.squads[q] || []).filter((id) => S.roster.includes(id));
    sq = [...new Set(sq)];
    for (const id of S.roster) { if (sq.length >= 5) break; if (!sq.includes(id)) sq.push(id); }
    S.squads[q] = sq.slice(0, 5);
  }
}
