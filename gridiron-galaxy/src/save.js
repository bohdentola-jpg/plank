// Persistent progress in localStorage.
const KEY = 'gridiron-galaxy-save-v1';

export function defaultSave() {
  return {
    version: 1,
    coins: 400,
    playsOwned: [],          // ids of purchased planet plays
    gear: {},                // gearId -> tier owned
    pantry: [],              // consumable food buff ids for next game
    story: { stage: 'intro', planet: 0, beaten: [], introDone: false, complete: false, rocketParts: [] },
    unlockedStadiums: ['earth'],
    exhibitionWins: 0,
    teamLevel: 0,            // +rating from story progress
    stats: { wins: 0, losses: 0, tds: 0, ints: 0, laterals: 0, longestPlay: 0 },
    settings: { quarterLen: 2, difficulty: 'normal', music: 0.6, sfx: 0.8, outlines: true, shadows: true, invertY: false, quality: 'high' },
  };
}

export function loadSave() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return defaultSave();
    const s = JSON.parse(raw);
    const d = defaultSave();
    // shallow-merge missing keys for forward compatibility
    for (const k of Object.keys(d)) if (s[k] === undefined) s[k] = d[k];
    for (const k of Object.keys(d.settings)) if (s.settings[k] === undefined) s.settings[k] = d.settings[k];
    for (const k of Object.keys(d.story)) if (s.story[k] === undefined) s.story[k] = d.story[k];
    return s;
  } catch (e) { console.warn('save load failed', e); return defaultSave(); }
}

export function writeSave(s) {
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) { console.warn('save failed', e); }
}
export function clearSave() { try { localStorage.removeItem(KEY); } catch (e) { /* ignore */ } }
