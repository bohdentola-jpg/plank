// Progress lives in the browser (localStorage). Nothing is sent anywhere.
const KEY = 'marigold-path-save-v1';

export function freshState() {
  return {
    v: 1,
    started: false,
    scene: 'home',
    flags: {},        // story progress
    bag: [],          // item ids collected for the ofrenda
    cards: [],        // learning cards discovered (ids, in order found)
    seenCards: [],    // cards whose "new" dot has been cleared in the book
    petals: 0,        // marigolds earned by learning
    monarchs: {},     // hidden monarchs found, by scene
    ofrenda: null,    // story ofrenda layout
    free: [],         // free-mode ofrendas (up to 6)
    papel: null,      // papel picado design { template, color, cuts }
    skull: null,      // sugar skull decoration (data URL) + name
    pan: null,        // pan de muerto topping
    poems: [],        // calaveritas written
    loteriaWins: 0,
    playerName: '',
    settings: { lang: 'en', music: true, sfx: true, read: false, big: false, calm: false },
  };
}

export function loadState() {
  const base = freshState();
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return base;
    const s = JSON.parse(raw);
    return { ...base, ...s, settings: { ...base.settings, ...(s.settings || {}) }, flags: { ...(s.flags || {}) } };
  } catch {
    return base;
  }
}

export function saveState(state) {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
    return true;
  } catch {
    // private mode / storage full: the game still works, it just won't remember
    return false;
  }
}

export function wipeState() {
  try { localStorage.removeItem(KEY); } catch { /* nothing to wipe */ }
}
