// Persistence. Everything lives in one JSON blob in localStorage. Storage can
// be missing or throw (private windows, embedded previews), so every access is
// guarded and the game runs fine without it — progress just won't stick.

const KEY = 'dripline.save.v1';
const OLD_KEY = '3rdrail.save.v1'; // the first version of this store
let available = true;

export function defaultState() {
  return {
    v: 1,
    created: Date.now(),
    profile: null, // { name, body: { skin, head, face } }
    tokens: 0,
    lifetime: 0,
    streak: { count: 0, best: 0, last: null, freezes: 0 },
    checkins: [],
    day: null, // per-day state, see econ.freshDay()
    owned: {}, // itemId -> { n, prismatic, at }
    equipped: { head: null, face: null, neck: null, top: null, bottom: null, feet: null, hand: null, aura: null },
    fresh: [], // items not yet seen in the wardrobe
    tickets: { basic: 0, epic: 0, legendary: 0 },
    pity: { basic: 0, deluxe: 0 },
    pulls: 0,
    keys: { cab: false },
    ghostTicket: false,
    secrets: { ghost: false, vault: false, cab: false, change: false },
    achievements: {},
    milestones: {},
    week: { idx: -1, vault: false, heard: false },
    bests: { tag: 0, tagGrade: '', runner: 0, cupsStreak: 0 },
    tagImage: null,
    seen: { intro: false, tips: {} },
    settings: { music: true, sfx: true },
    car: 'front',
  };
}

const MERGE = ['streak', 'equipped', 'tickets', 'pity', 'keys', 'secrets', 'week', 'bests', 'seen', 'settings'];

function read(key) {
  try {
    return window.localStorage.getItem(key);
  } catch {
    available = false;
    return null;
  }
}

export function load() {
  const base = defaultState();
  const raw = read(KEY);
  if (raw) {
    try {
      const data = JSON.parse(raw);
      const out = { ...base, ...data };
      for (const k of MERGE) out[k] = { ...base[k], ...(data[k] || {}) };
      return out;
    } catch {
      return base;
    }
  }
  // carry tokens and the streak over from the first version of the store
  const old = read(OLD_KEY);
  if (old) {
    try {
      const o = JSON.parse(old);
      base.tokens = Math.max(0, o.tokens | 0);
      base.lifetime = Math.max(0, o.lifetime | 0);
      if (o.streak) base.streak = { ...base.streak, count: o.streak.count | 0, best: o.streak.best | 0, last: o.streak.last || null, freezes: Math.min(2, o.streak.freezes | 0) };
      if (Array.isArray(o.checkins)) base.checkins = o.checkins.slice(-60);
      base.migrated = true;
    } catch { /* ignore */ }
  }
  return base;
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
    window.localStorage.removeItem(OLD_KEY);
  } catch { /* ignore */ }
}

export function storageWorks() { return available; }
