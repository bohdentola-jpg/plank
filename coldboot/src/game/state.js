// Everything that persists: the calendar, money, friendships, Northstar's
// attention, the town's repairs, missions, lessons, inventory, flags.
import { store } from '../core/settings.js';

export const DAYS = 14;

export function newState(profile) {
  return {
    version: 1,
    name: profile?.name || 'Sam',
    day: 1,
    hour: 10.5,
    money: 420,
    flags: { ...(profile?.flags || {}) },
    inv: { earpiece: 1, passport: 1, matryoshka: 1, phone: 1 },
    rel: {},          // npc id → points (0..100); levels every 20
    met: {},          // npc id → true
    attention: 0,     // Northstar's attention 0..100
    spirit: 0,        // Town Spirit (repairs, help)
    standing: 0,      // political standing
    repairs: {},      // building/project id → 0..1
    missions: { active: {}, done: {} },
    lessons: {},      // lesson id → true
    challenges: {},   // challenge id → true
    shares: {},       // council continuity-card shares obtained
    pos: null,        // {x, z, yaw}
    stats: { playSeconds: 0, repairs: 0, coffees: 0 },
  };
}

export const game$ = { s: null };

export function loadGame() {
  const s = store.load('save0');
  game$.s = s && s.version === 1 ? s : null;
  return game$.s;
}

export function saveGame() {
  if (game$.s) store.save('save0', game$.s);
}

export function relLevel(s, id) { return Math.min(5, Math.floor((s.rel[id] || 0) / 20)); }
export const REL_NAMES = ['Stranger', 'Acquaintance', 'Friendly', 'Friend', 'Close friend', 'Family'];

export function addRel(s, id, n) {
  const before = relLevel(s, id);
  s.rel[id] = Math.max(0, Math.min(100, (s.rel[id] || 0) + n));
  return relLevel(s, id) > before;
}
