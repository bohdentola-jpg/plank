// Persistent game state. One slot, stored in localStorage as JSON.
const KEY = 'fourth-and-fable-save-v1';

export function newSave() {
  return {
    v: 1,
    captain: { name: 'Captain', species: 'fox', number: 1 },
    team: { name: 'Lanterns', jersey: '#f08a24', helmet: '#3b2148', stripe: '#ffd45a', pants: '#fff4dc', trim: '#ffd45a' },
    flags: {},
    quests: {},          // id → { stage, done }
    questLog: [],        // ids in the order they were started
    coins: 0,
    parts: 0,
    items: {},           // id → count
    gear: [],            // owned gear ids
    roster: ['captain'],
    chars: {},           // id → { lv, xp, st, gear, bond, hang }
    squads: [['captain'], ['captain']],
    offSquad: 0, defSquad: 1,
    plays: [], defPlays: [],
    customPlays: [],
    town: { diner: 0, arcade: 0, field: 0, stadium: 0 },
    decor: { owned: [], placed: [] },
    costumes: [],
    fish: {},
    best: {},            // minigame id → { normal, hard }
    wins: {},            // rival id → count
    seen: {},            // misc one-shot markers (tutorial tips, notes)
    area: 'bus', pos: null,
    tod: 'day',          // day | dusk | night
    chapter: 0,
    meal: null,
    settings: { master: 0.8, music: 0.55, sfx: 0.9 },
    playTime: 0,
    savedAt: 0,
  };
}

export function hasSave() {
  try { return !!localStorage.getItem(KEY); } catch { return false; }
}

export function loadSave() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const s = JSON.parse(raw);
    if (!s || s.v !== 1) return null;
    // fill in anything a newer build added
    const base = newSave();
    for (const k of Object.keys(base)) if (s[k] === undefined) s[k] = base[k];
    for (const k of Object.keys(base.town)) if (s.town[k] === undefined) s.town[k] = 0;
    return s;
  } catch { return null; }
}

export function writeSave(S) {
  try {
    S.savedAt = Date.now();
    localStorage.setItem(KEY, JSON.stringify(S));
    return true;
  } catch { return false; }
}

export function clearSave() {
  try { localStorage.removeItem(KEY); } catch { /* private mode */ }
}
