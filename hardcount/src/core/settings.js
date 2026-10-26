// Player settings + save slots in localStorage (all wrapped so private mode works).

const KEY = 'hc_settings_v1';

const DEFAULTS = {
  // picture (the TV's own menu)
  lines: 600,           // internal 3D resolution (480 / 600 / 720)
  crt: 1,               // CRT effect strength 0..1
  autoQuality: true,
  // sound
  volMaster: 0.85,
  volMusic: 0.65,
  volSfx: 0.9,
  volCrowd: 0.85,
  captions: true,       // closed captions: the broadcast's play-by-play as CC text
  announcer: false,     // the stadium PA reads the big moments aloud (speech synthesis)
  // game
  difficulty: 'pro',    // rookie | pro | allpro | allglory
  quarterLen: 4,        // minutes
  accelClock: true,     // run the clock between plays (25 s play clock → ~12 s)
  fieldSize: 'sevens',  // sevens (80 × 40) | full (100 × 53⅓)
  penalties: 'on',      // on | off
  injuries: false,
  fatigue: true,
  camera: 'broadcast',  // broadcast | high | low | sideline
  passLead: 'assist',   // assist | manual (stick leads the throw)
  autoSwitch: true,     // on defense, hand you the defender nearest the ball after the throw
  rumble: true,
  units: 'yd',
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
  defaults() { return { ...DEFAULTS }; }
}

export const settings = new Settings();

/** Generic persisted blobs (career save, records, last setup). */
export const store = {
  load(name) { return read('hc_' + name); },
  save(name, v) { write('hc_' + name, v); },
  remove(name) { try { localStorage.removeItem('hc_' + name); } catch { /* */ } },
};
