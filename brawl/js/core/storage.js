// Options that survive a page reload.

const KEY = 'computer-lab-brawl-v1';

export const DEFAULTS = {
  volSfx: 0.8, volMusic: 0.6, muted: false,
  quality: 2,               // 0 low, 1 medium, 2 high
  shake: true,
  input: null,
  rules: { stocks: 3, time: 0, items: true, hazards: true },
  cpuLevel: 5,
  lastPicks: null,
  seenHowTo: false,
};

export function loadSettings() {
  let s = {};
  try { s = JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch (e) { s = {}; }
  const out = Object.assign({}, DEFAULTS, s);
  out.rules = Object.assign({}, DEFAULTS.rules, s.rules);
  return out;
}
export function saveSettings(s) {
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) { /* private mode: just don't persist */ }
}
