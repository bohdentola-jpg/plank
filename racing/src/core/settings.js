// Player settings + save slots in localStorage (all wrapped so private mode works).

const KEY = 'mf_settings_v1';

const DEFAULTS = {
  lines: 600,          // internal 3D resolution (480 / 600 / 720)
  volMaster: 0.85,
  volMusic: 0.7,
  volSfx: 0.9,
  units: 'mph',        // 'mph' | 'kmh'
  transmission: 'auto',// 'auto' | 'manual'
  assists: 'on',       // stability / traction help
  crt: 1,              // CRT effect strength 0..1
  rumble: true,
  camera: 1,           // default chase cam index
  autoQuality: true,
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

/** Generic persisted blobs (story save, records). */
export const store = {
  load(name) { return read('mf_' + name); },
  save(name, v) { write('mf_' + name, v); },
  remove(name) { try { localStorage.removeItem('mf_' + name); } catch { /* */ } },
};
