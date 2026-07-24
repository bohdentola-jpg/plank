// Three tape slots in localStorage. A save is small on purpose: which level,
// what you're carrying, what you've read, and how long you've been down here.
// Levels rebuild from their seed, so nothing about the geometry is stored.

const KEY = 'noclip_tapes_v1';

function readAll() {
  try { return JSON.parse(localStorage.getItem(KEY) || '{}'); } catch { return {}; }
}

function writeAll(all) {
  try { localStorage.setItem(KEY, JSON.stringify(all)); } catch { /* private mode: play on */ }
}

export function blankSave(slot = 1) {
  return {
    slot,
    created: null,
    level: 'level0',
    seedSalt: 0,
    playtime: 0,
    tapeTime: 0,
    deaths: 0,
    hp: 100,
    sanity: 100,
    camBattery: 100,
    lampBattery: 100,
    inventory: {},
    tapesFound: [],
    notesRead: [],
    levelsSeen: [],
    objectives: {},
    settings: null,
  };
}

export function listSaves() {
  const all = readAll();
  return [1, 2, 3].map((slot) => all[slot] || null);
}

export function loadSave(slot) {
  const all = readAll();
  const s = all[slot];
  if (!s) return null;
  return { ...blankSave(slot), ...s };
}

export function writeSave(save) {
  const all = readAll();
  all[save.slot] = save;
  writeAll(all);
  return save;
}

export function deleteSave(slot) {
  const all = readAll();
  delete all[slot];
  writeAll(all);
}

// Settings live outside the slots so they survive a wipe.
const SKEY = 'noclip_settings_v1';

export function loadSettings() {
  const d = {
    sens: 1, invertY: false, sfx: 0.9, music: 0.55, tape: 1,
    quality: 1, subtitles: true, headBob: true, fov: 78,
  };
  try { return { ...d, ...JSON.parse(localStorage.getItem(SKEY) || '{}') }; } catch { return d; }
}

export function saveSettings(s) {
  try { localStorage.setItem(SKEY, JSON.stringify(s)); } catch { /* fine */ }
}
