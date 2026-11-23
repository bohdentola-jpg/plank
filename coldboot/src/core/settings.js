// Player settings + save slots in localStorage (all wrapped so private mode works).

const KEY = 'cb_settings_v1';

const DEFAULTS = {
  lines: 720,          // internal 3D resolution (540 / 720 / 900)
  volMaster: 0.85,
  volMusic: 0.65,
  volSfx: 0.9,
  volVoice: 1.0,
  subtitles: true,

  rumble: true,
  autoQuality: true,
  invertY: false,
  lookSens: 1.0,       // mouse / right-stick multiplier
  units: 'imperial',   // 'imperial' | 'metric'
  textSpeed: 1.0,
};

function read(key) {
  try { return JSON.parse(localStorage.getItem(key) || 'null'); } catch { return null; }
}
function write(key, v) {
  try { localStorage.setItem(key, JSON.stringify(v)); } catch { /* full or blocked */ }
}

class Settings {
  constructor() {
    this.data = { ...DEFAULTS, ...(read(KEY) || {}) };
  }
  get(k) { return this.data[k]; }
  set(k, v) {
    this.data[k] = v;
    write(KEY, this.data);
  }
}

export const settings = new Settings();

/** Generic persisted blobs (save slots, profile). */
export const store = {
  load(name) { return read('cb_' + name); },
  save(name, v) { write('cb_' + name, v); },
  remove(name) { try { localStorage.removeItem('cb_' + name); } catch { /* */ } },
};
