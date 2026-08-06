// One journey, one save. Everything needed to put you back on the exact
// hillside: seed, position, time of day, what you've found, where you've been.

const KEY = 'vast_save_v1';

export function saveGame(s) {
  try {
    localStorage.setItem(KEY, JSON.stringify({
      v: 1,
      seed: s.seed,
      pos: [s.pos.x, s.pos.y, s.pos.z],
      camYaw: s.camYaw,
      dayT: s.dayT,
      day: s.day,
      stamina: s.stamina,
      discovered: [...s.discovered],
      litShrines: [...s.litShrines],
      relics: [...s.relics],
      rumors: [...s.rumors],
      explored: [...s.explored],
      stats: s.stats,
      horse: s.horse,
      muted: s.muted,
    }));
    return true;
  } catch {
    return false;
  }
}

export function loadGame() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const d = JSON.parse(raw);
    if (!d || d.v !== 1 || typeof d.seed !== 'number') return null;
    return d;
  } catch {
    return null;
  }
}

export function clearGame() {
  try { localStorage.removeItem(KEY); } catch { /* private mode */ }
}

export function hasSave() {
  return loadGame() !== null;
}
