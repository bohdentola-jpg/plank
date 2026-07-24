// THE TAPE ORDER — the chain of levels, and the loader that fetches one.
//
// The chain is mostly linear because the game is about being lost, not about
// choosing. Hidden exits inside the levels skip you forward (and sideways), so
// no two playthroughs take the same route down.
//
// Level modules are imported on demand: you only pay for the level you're in.

export const CHAIN = [
  { id: 'level0', num: '0', name: 'THE LOBBY' },
  { id: 'level1', num: '1', name: 'HABITABLE ZONE' },
  { id: 'level2', num: '2', name: 'PIPE DREAMS' },
  { id: 'level3', num: '3', name: 'ELECTRICAL STATION' },
  { id: 'level4', num: '4', name: 'ABANDONED OFFICE' },
  { id: 'breakroom', num: '4B', name: 'THE BREAK ROOM' },
  { id: 'level5', num: '5', name: 'TERROR HOTEL' },
  { id: 'level6', num: '6', name: 'LIGHTS OUT' },
  { id: 'poolrooms', num: '37', name: 'THE POOLROOMS' },
  { id: 'level7', num: '7', name: 'THALASSOPHOBIA' },
  { id: 'level8', num: '8', name: 'THE CAVES' },
  { id: 'level9', num: '9', name: 'THE SUBURBS' },
  { id: 'level10', num: '10', name: 'THE FIELD' },
  { id: 'level11', num: '11', name: 'THE ENDLESS CITY' },
  { id: 'level27', num: '27', name: 'THE PARKING GARAGE' },
  { id: 'level52', num: '52', name: 'THE HOSPITAL' },
  { id: 'level94', num: '94', name: 'THE SCHOOL' },
  { id: 'level188', num: '188', name: 'THE WINDOWS' },
  { id: 'level_fun', num: 'FUN', name: 'LEVEL FUN =)' },
  { id: 'level_archives', num: '283', name: 'THE ARCHIVES' },
  { id: 'level99', num: '99', name: 'THE WHITEOUT' },
  { id: 'level_run', num: '!', name: 'RUN FOR YOUR LIFE' },
  { id: 'level_end', num: '3999', name: 'THE TERMINUS' },
];

export const chainIndex = (id) => CHAIN.findIndex((c) => c.id === id);

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
