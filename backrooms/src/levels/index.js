// THE POOL — every floor in the game, and the loader that fetches one.
//
// A descent draws ten of these: the lobby first, the terminus last, and the middle
// eight picked by depth. Nothing is fixed except the ends, so no two runs go down
// the same way.
//
// Level modules are imported on demand: you only pay for the floor you're on.

// tier: 1 shallow, 2 middling, 3 deep, 4 the bottom. A run is drawn from the
// tiers in order, so every descent gets harder and no two descents are the same.
export const CHAIN = [
  { tier: 1, id: 'level0', num: '0', name: 'THE LOBBY' },
  { tier: 1, id: 'level1', num: '1', name: 'HABITABLE ZONE' },
  { tier: 2, id: 'level2', num: '2', name: 'PIPE DREAMS' },
  { tier: 2, id: 'level3', num: '3', name: 'ELECTRICAL STATION' },
  { tier: 1, id: 'level4', num: '4', name: 'ABANDONED OFFICE' },
  { tier: 1, id: 'breakroom', num: '4B', name: 'THE BREAK ROOM' },
  { tier: 2, id: 'level5', num: '5', name: 'TERROR HOTEL' },
  { tier: 3, id: 'level6', num: '6', name: 'LIGHTS OUT' },
  { tier: 1, id: 'poolrooms', num: '37', name: 'THE POOLROOMS' },
  { tier: 3, id: 'level7', num: '7', name: 'THALASSOPHOBIA' },
  { tier: 2, id: 'level8', num: '8', name: 'THE CAVES' },
  { tier: 1, id: 'level9', num: '9', name: 'THE SUBURBS' },
  { tier: 1, id: 'level10', num: '10', name: 'THE FIELD' },
  { tier: 2, id: 'level11', num: '11', name: 'THE ENDLESS CITY' },
  { tier: 3, id: 'level27', num: '27', name: 'THE PARKING GARAGE' },
  { tier: 3, id: 'level52', num: '52', name: 'THE HOSPITAL' },
  { tier: 2, id: 'level94', num: '94', name: 'THE SCHOOL' },
  { tier: 1, id: 'level188', num: '188', name: 'THE WINDOWS' },
  { tier: 3, id: 'level_fun', num: 'FUN', name: 'LEVEL FUN =)' },
  { tier: 3, id: 'level_archives', num: '283', name: 'THE ARCHIVES' },
  { tier: 3, id: 'level99', num: '99', name: 'THE WHITEOUT' },
  { tier: 3, id: 'level_run', num: '!', name: 'RUN FOR YOUR LIFE' },
  { tier: 4, id: 'level_end', num: '3999', name: 'THE TERMINUS' },
];

export const chainIndex = (id) => CHAIN.findIndex((c) => c.id === id);

// Build a descent: ten floors, drawn shallow-to-deep, ending at the bottom.
// The lift shop is what carries between them, so the order matters more than the
// individual floors do.
export function makeRun(rand, length = 10) {
  // The ends are fixed, so draw the middle from the tiers in order and never draw
  // the same floor twice in one descent.
  const taken = new Set(['level0', 'level_end']);
  const pick = (tier, n) => {
    const pool = CHAIN.filter((c) => c.tier === tier && !taken.has(c.id));
    const out = [];
    while (out.length < n && pool.length) {
      const c = pool.splice(Math.floor(rand() * pool.length), 1)[0];
      taken.add(c.id);
      out.push(c.id);
    }
    return out;
  };
  const middle = length - 2;
  const floors = ['level0'];                   // always start in the rooms
  for (const [tier, share] of [[1, 0.25], [2, 0.375], [3, 0.375]]) {
    floors.push(...pick(tier, Math.round(middle * share)));
  }
  // if a tier ran dry, top up from the deep end rather than ship a short run
  for (const tier of [3, 2, 1]) {
    while (floors.length < length - 1) {
      const got = pick(tier, 1);
      if (!got.length) break;
      floors.push(...got);
    }
  }
  floors.push('level_end');                    // and always finish at the Terminus
  return floors;
}

const cache = new Map();

export async function loadLevelModule(id) {
  if (cache.has(id)) return cache.get(id);
  const mod = await import(`./${id}.js`);
  if (!mod?.build || !mod?.meta) throw new Error(`level "${id}" is not a level module`);
  cache.set(id, mod);
  return mod;
}

// Deterministic per-run seed: the level's own name, plus the save's salt so a
// new tape is a new building.
export function levelSeed(id, salt = 0) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return (h ^ Math.imul(salt + 1, 2654435761)) >>> 0;
}
