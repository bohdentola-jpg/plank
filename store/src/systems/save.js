// Persistence. Everything lives in one JSON blob in localStorage. Storage can
// be missing or throw (private windows, embedded previews), so every access is
// guarded and the game runs fine without it — progress just won't stick.

const KEY = '3rdrail.save.v1';
let available = true;

export function defaultState() {
  return {
    v: 1,
    created: Date.now(),
    profile: null, // { name, fur, hoodie, hat, hatColor, shoe }
    tokens: 0,
    lifetime: 0,
    streak: { count: 0, best: 0, last: null, freezes: 0, cycles: 0 },
    checkins: [],
    day: null, // per-day state, see econ.freshDay()
    stickers: {},
    pagesClaimed: {},
    coupons: [],
    golden: false,
    keys: { maint: false },
    secrets: { ghost: false, sewer: false, backroom: false, crack: false },
    week: { idx: -1, backroom: false },
    bests: { tag: 0, tagGrade: '', runner: 0, cupsStreak: 0 },
    tagImage: null,
    bag: [],
    orders: [],
    sold: {},
    seen: { intro: false, map: false, tips: {} },
    settings: { music: true, sfx: true },
    scene: 'token',
    x: null,
  };
}

export function load() {
  let raw = null;
  try {
    raw = window.localStorage.getItem(KEY);
  } catch {
    available = false;
  }
  const base = defaultState();
  if (!raw) return base;
  try {
    const data = JSON.parse(raw);
    // shallow-merge so new fields get defaults
    const out = { ...base, ...data };
    for (const k of ['streak', 'keys', 'secrets', 'week', 'bests', 'seen', 'settings']) out[k] = { ...base[k], ...(data[k] || {}) };
    return out;
  } catch {
    return base;
  }
}

let pending = null;
export function save(state, now = false) {
  if (!available) return;
  const write = () => {
    pending = null;
    try {
      window.localStorage.setItem(KEY, JSON.stringify(state));
    } catch {
      available = false;
    }
  };
  if (now) {
    if (pending) clearTimeout(pending);
    write();
    return;
  }
  if (!pending) pending = setTimeout(write, 400);
}

export function wipe() {
  try {
    window.localStorage.removeItem(KEY);
  } catch { /* ignore */ }
}

export function storageWorks() { return available; }
