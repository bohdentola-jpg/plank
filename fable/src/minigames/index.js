// Minigame registry: lazy loaders, rewards, and the hooks the overworld calls.
import { G } from '../core/game.js';
import { addCoins, addParts, addGear, unlockPlay, recruit, setFlag, flag } from '../game/state.js';
import { GEAR, CAST } from '../data/cast.js';
import { MEALS } from '../data/items.js';
import { CLUES } from '../data/clues.js';
import { PLAYS } from '../data/plays.js';

export const MINIGAMES = {
  dash: { title: 'Lawn Dash', icon: '🐇', load: () => import('./dash.js') },
  blitz: { title: 'Backyard Blitz', icon: '🏡', load: () => import('./blitz.js') },
  snack: { title: 'Snack Shack Rush', icon: '🌭', load: () => import('./snack.js') },
  golf: { title: 'Field Goal Golf', icon: '⛳', load: () => import('./golf.js') },
  mascot: { title: 'Mascot Mayhem', icon: '🎭', load: () => import('./mascot.js') },
  lights: { title: 'Midnight Maintenance', icon: '🔦', load: () => import('./lights.js') },
  fishing: { title: 'Fishing', icon: '🎣', load: () => import('./fishing.js') },
};

// coins per medal, plus one-time unlocks per medal tier (normal) and for hard mode
const REWARDS = {
  dash: { coins: [10, 20, 35] },
  blitz: { coins: [15, 30, 50], first: { 2: { play: 'flea_flicker' }, 3: { play: 'hook_ladder' } }, hard: { 2: { play: 'statue' } } },
  snack: { coins: [20, 40, 70], first: { 1: { recipe: 'moonpie' }, 2: { recipe: 'chili' } }, hard: { 2: { recipe: 'cocoa_float' } } },
  golf: { coins: [15, 30, 50], first: { 1: { gear: 'lucky_tee' }, 2: { gear: 'wind_sock' } }, hard: { 2: { gear: 'golden_arm' } } },
  mascot: { coins: [15, 30, 50], first: { 1: { costume: 'acorn' }, 2: { recruit: 'cheese' }, 3: { costume: 'pumpkin' } }, hard: { 1: { costume: 'corn' } } },
  lights: { coins: [10, 20, 30], first: { 1: { clue: 0, parts: 2 }, 2: { clue: 1, parts: 4 }, 3: { clue: 2, parts: 6 } }, hard: { 1: { clue: 3, gear: 'moth_goggles' } } },
  fishing: { coins: [0, 0, 0] },
};

function grant(r) {
  const out = [];
  if (r.play && unlockPlay(r.play, true)) out.push(`📋 New trick play: <b>${(PLAYS[r.play] || {}).name || r.play}</b>`);
  if (r.gear && !G.S.gear.includes(r.gear)) { addGear(r.gear, true); out.push(`${GEAR[r.gear].icon} New gear: <b>${GEAR[r.gear].name}</b>`); }
  if (r.recipe) { G.S.seen.recipes = G.S.seen.recipes || []; if (!G.S.seen.recipes.includes(r.recipe)) { G.S.seen.recipes.push(r.recipe); out.push(`${MEALS[r.recipe].icon} New diner recipe: <b>${MEALS[r.recipe].name}</b>`); } }
  if (r.costume && !G.S.costumes.includes(r.costume)) { G.S.costumes.push(r.costume); out.push(`🎭 New mascot costume: <b>${r.costume}</b>`); }
  if (r.recruit && !G.S.roster.includes(r.recruit)) { recruit(r.recruit, true); out.push(`⭐ <b>${CAST[r.recruit].name}</b> wants to join the team!`); }
  if (r.parts) { addParts(r.parts, true); out.push(`🔩 +${r.parts} rare parts`); }
  if (r.clue !== undefined) { G.S.seen.clues = G.S.seen.clues || []; if (!G.S.seen.clues.includes(r.clue)) { G.S.seen.clues.push(r.clue); out.push(`🗒️ Clue found: <b>${CLUES[r.clue].title}</b>`); } }
  return out;
}

/** Called by the shell when a minigame ends; returns lines to show on the results card. */
export function minigameRewards(res) {
  const def = REWARDS[res.id];
  if (!def || !res.medal) return [];
  const out = [];
  const coins = Math.round(def.coins[res.medal - 1] * (res.hard ? 1.5 : 1));
  if (coins) { addCoins(coins, true); out.push(`🪙 +${coins} coins`); }
  const table = res.hard ? def.hard : def.first;
  if (table) {
    for (let tier = 1; tier <= res.medal; tier++) {
      const key = `mg_${res.id}_${res.hard ? 'h' : 'n'}${tier}`;
      if (table[tier] && !flag(key)) { setFlag(key); out.push(...grant(table[tier])); }
    }
  }
  return out;
}

/** Launch a minigame (fades in/out); resolves with { score, medal, won, hard, quit? }. */
export async function playMinigame(id, opts = {}) {
  const def = MINIGAMES[id];
  if (!def) throw new Error(`No minigame "${id}"`);
  let res;
  do {
    const mod = await def.load();
    res = await G.run(new mod.default(), opts);
  } while (res && res.again);
  return res;
}

export function install() {
  G.hooks.minigame = playMinigame;
  G.hooks.minigameRewards = minigameRewards;
}
