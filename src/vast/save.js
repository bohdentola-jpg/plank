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
    // a corrupt save must never crash the boot — validate the parts the
    // boot path dereferences and default the rest
    if (!Array.isArray(d.pos) || d.pos.length !== 3 || !d.pos.every(Number.isFinite)) return null;
    for (const k of ['discovered', 'litShrines', 'relics', 'rumors', 'explored']) {
      if (!Array.isArray(d[k])) d[k] = [];
    }
    if (!Number.isFinite(d.dayT) || d.dayT < 0 || d.dayT >= 1) d.dayT = 0.32;
    if (!Number.isFinite(d.day) || d.day < 1) d.day = 1;
    if (!Number.isFinite(d.camYaw)) d.camYaw = 0;
    if (!Number.isFinite(d.stamina)) d.stamina = 1;
    if (!d.stats || typeof d.stats !== 'object') d.stats = { dist: 0, playTime: 0 };
    if (!d.horse || typeof d.horse !== 'object' || !Number.isFinite(d.horse.x)) {
      d.horse = { state: 'away', x: 0, z: 0 };
    }
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
