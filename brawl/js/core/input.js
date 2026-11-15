// Keyboard + gamepad input.
//
// Every player, human or CPU, hands the game the same little snapshot each
// frame (see blankSnap). Devices here turn keys / pads into that snapshot.

import { G } from './config.js';
import { clamp } from './util.js';

export const ACTIONS = ['attack', 'special', 'jump', 'shield', 'grab', 'strong', 'taunt', 'start'];
export const DIRS = ['up', 'down', 'left', 'right'];

export function blankSnap() {
  return {
    x: 0, y: 0, cx: 0, cy: 0,
    h: { attack: false, special: false, jump: false, shield: false, grab: false, strong: false, taunt: false, start: false },
    p: { attack: false, special: false, jump: false, shield: false, grab: false, strong: false, taunt: false, start: false },
    tapX: 0, tapY: 0, sdir: null, digital: true,
  };
}

// ----------------------------------------------------------- key tables ---
// solo   : one person on the keyboard. Both hand positions work at once:
//          WASD + J K L (I U) and Arrows + Z X C (V Shift).
// split1 : left-hand player when two share a keyboard.
// split2 : right-hand player when two share a keyboard.
export const DEFAULT_KEYS = {
  solo: {
    up: ['KeyW', 'ArrowUp'], down: ['KeyS', 'ArrowDown'], left: ['KeyA', 'ArrowLeft'], right: ['KeyD', 'ArrowRight'],
    attack: ['KeyJ', 'KeyZ'], special: ['KeyK', 'KeyX'], jump: ['Space'], shield: ['KeyL', 'KeyC'],
    strong: ['KeyI', 'KeyV'], grab: ['KeyU', 'ShiftLeft'], taunt: ['KeyT'], start: ['Enter'],
  },
  split1: {
    up: ['KeyW'], down: ['KeyS'], left: ['KeyA'], right: ['KeyD'],
    attack: ['KeyF'], special: ['KeyG'], jump: ['Space'], shield: ['KeyH'],
    strong: ['KeyT'], grab: ['KeyR'], taunt: ['KeyY'], start: ['Enter'],
  },
  split2: {
    up: ['ArrowUp'], down: ['ArrowDown'], left: ['ArrowLeft'], right: ['ArrowRight'],
    attack: ['Comma', 'Numpad1'], special: ['Period', 'Numpad2'], jump: ['ShiftRight', 'Numpad0'], shield: ['Slash', 'Numpad3'],
    strong: ['KeyL', 'Numpad5'], grab: ['KeyK', 'Numpad4'], taunt: ['KeyM', 'Numpad6'], start: ['NumpadEnter', 'Backslash'],
  },
};

// Gamepad button indices ("standard" mapping). Two presets.
export const PAD_PRESETS = {
  brawl: {   // A attack, B special, X/Y jump - the layout brawler players expect
    attack: [0], special: [1], jump: [2, 3], shield: [6, 7], grab: [4, 5], strong: [], taunt: [8], start: [9],
  },
  platformer: {   // bottom button jumps
    attack: [2], special: [1], jump: [0, 3], shield: [6, 7], grab: [4, 5], strong: [], taunt: [8], start: [9],
  },
};

export function keyLabel(code) {
  if (!code) return '?';
  const map = {
    Space: 'SPACE', Enter: 'ENTER', Escape: 'ESC', ShiftLeft: 'L-SHIFT', ShiftRight: 'R-SHIFT',
    ControlLeft: 'L-CTRL', ControlRight: 'R-CTRL', AltLeft: 'L-ALT', AltRight: 'R-ALT',
    ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→',
    Comma: ',', Period: '.', Slash: '/', Semicolon: ';', Quote: "'", BracketLeft: '[', BracketRight: ']',
    Backslash: '\\', Minus: '-', Equal: '=', Backquote: '`', Backspace: 'BKSP', Tab: 'TAB',
    NumpadEnter: 'NUM ENTER', CapsLock: 'CAPS',
  };
  if (map[code]) return map[code];
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  if (code.startsWith('Numpad')) return 'NUM ' + code.slice(6);
  return code.toUpperCase();
}

const PAD_NAMES = {
  xbox: ['A', 'B', 'X', 'Y', 'LB', 'RB', 'LT', 'RT', 'BACK', 'START', 'L3', 'R3'],
  ps: ['✕', '○', '□', '△', 'L1', 'R1', 'L2', 'R2', 'SHARE', 'OPTIONS', 'L3', 'R3'],
};
export function padLabel(i, style = 'xbox') { return (PAD_NAMES[style] || PAD_NAMES.xbox)[i] || 'B' + i; }

// ----------------------------------------------------------------- device --
class Device {
  constructor(id, type, name) {
    this.id = id; this.type = type; this.name = name;
    this.snap = blankSnap();
    this.prev = {};
    this.hist = [0, 0, 0, 0, 0, 0];   // recent stick x/y for flick detection
    this.histY = [0, 0, 0, 0, 0, 0];
    this.connected = true;
    this.tapJump = true;
    this.active = 0;                  // frames since any input, for "last used" hints
    // menu-style edges with auto-repeat
    this.menu = { up: false, down: false, left: false, right: false, ok: false, back: false, start: false, alt: false, alt2: false };
    this._rep = { up: 0, down: 0, left: 0, right: 0 };
  }
  _edges(raw) {
    const s = this.snap, prev = this.prev;
    for (const a of ACTIONS) {
      const now = !!raw[a];
      s.p[a] = now && !prev[a];
      s.h[a] = now;
      prev[a] = now;
    }
  }
  _menuRepeat(dir, held) {
    const r = this._rep;
    if (!held) { r[dir] = 0; return false; }
    r[dir]++;
    return r[dir] === 1 || (r[dir] > 22 && (r[dir] - 22) % 6 === 0);
  }
}

class KeyboardDevice extends Device {
  constructor(id, mgr, tableName) {
    super(id, 'kb', 'Keyboard');
    this.mgr = mgr; this.tableName = tableName;
    this.snap.digital = true;
    this.order = { left: 0, right: 0, up: 0, down: 0 };
  }
  table() { return this.mgr.keys[this.tableName]; }
  // held now, or pressed-and-released since the last frame (so the quickest tap still counts)
  any(list) { const k = this.mgr.down, f = this.mgr.fresh; for (const c of list) if (k.has(c) || f.has(c)) return true; return false; }
  poll() {
    const t = this.table(), s = this.snap, mgr = this.mgr;
    const L = this.any(t.left), R = this.any(t.right), U = this.any(t.up), D = this.any(t.down);
    // last key pressed wins when both of a pair are held
    const stamp = (dir, held) => { if (held && !this.order[dir]) this.order[dir] = ++mgr.clock; if (!held) this.order[dir] = 0; };
    stamp('left', L); stamp('right', R); stamp('up', U); stamp('down', D);
    const x = L && R ? (this.order.left > this.order.right ? -1 : 1) : L ? -1 : R ? 1 : 0;
    const y = U && D ? (this.order.up > this.order.down ? -1 : 1) : U ? -1 : D ? 1 : 0;
    s.tapX = x !== 0 && x !== this._px ? x : 0;
    s.tapY = y !== 0 && y !== this._py ? y : 0;
    this._px = x; this._py = y;
    s.x = x; s.y = y; s.cx = 0; s.cy = 0; s.sdir = null;
    const raw = {};
    for (const a of ACTIONS) raw[a] = this.any(t[a]);
    this._edges(raw);
    if (x || y || ACTIONS.some((a) => raw[a])) this.active = 0; else this.active++;
    // menu
    const m = this.menu;
    m.up = this._menuRepeat('up', U); m.down = this._menuRepeat('down', D);
    m.left = this._menuRepeat('left', L); m.right = this._menuRepeat('right', R);
    m.ok = s.p.attack || s.p.jump || s.p.start;
    m.back = s.p.special;
    m.start = s.p.start;
    m.alt = s.p.shield; m.alt2 = s.p.grab;
  }
}

class PadDevice extends Device {
  constructor(index, mgr) {
    super('pad' + index, 'pad', 'Controller ' + (index + 1));
    this.index = index; this.mgr = mgr;
    this.snap.digital = false;
    this.style = 'xbox';
    this.connected = false;
    this._cHeld = false;
  }
  poll(gp) {
    const s = this.snap;
    if (!gp || !gp.connected) {
      this.connected = false;
      const blank = blankSnap(); blank.digital = false; this.snap = blank; this.prev = {};
      for (const k in this.menu) this.menu[k] = false;
      return;
    }
    if (!this.connected) {
      this.connected = true;
      const id = (gp.id || '').toLowerCase();
      this.style = /dualsense|dualshock|playstation|sony|054c/.test(id) ? 'ps' : 'xbox';
      this.name = this.style === 'ps' ? 'PlayStation pad ' + (this.index + 1) : 'Controller ' + (this.index + 1);
    }
    const map = this.mgr.padMap(this);
    const b = gp.buttons, ax = gp.axes;
    const btn = (i) => !!(b[i] && (b[i].pressed || b[i].value > 0.45));
    let x = ax[0] || 0, y = ax[1] || 0;
    const mag = Math.hypot(x, y), dz = 0.24;
    if (mag < dz) { x = 0; y = 0; } else {
      const k = Math.min(1, (mag - dz) / (0.92 - dz)) / mag; x *= k; y *= k;
    }
    let digital = false;
    if (btn(14)) { x = -1; digital = true; } else if (btn(15)) { x = 1; digital = true; }
    if (btn(12)) { y = -1; digital = true; } else if (btn(13)) { y = 1; digital = true; }
    // flick detection: was near centre a few frames ago, now slammed over
    const hx = this.hist, hy = this.histY;
    s.tapX = Math.abs(x) > 0.78 && Math.abs(hx[G.tapWindow - 1]) < 0.35 && !this._tapXLock ? Math.sign(x) : 0;
    s.tapY = Math.abs(y) > 0.72 && Math.abs(hy[G.tapWindow - 1]) < 0.35 && !this._tapYLock ? Math.sign(y) : 0;
    if (s.tapX) this._tapXLock = true; else if (Math.abs(x) < 0.5) this._tapXLock = false;
    if (s.tapY) this._tapYLock = true; else if (Math.abs(y) < 0.5) this._tapYLock = false;
    hx.unshift(x); hx.length = 6; hy.unshift(y); hy.length = 6;
    s.x = clamp(x, -1, 1); s.y = clamp(y, -1, 1); s.digital = digital;
    // right stick = strong attack in that direction
    const cx = ax[2] || 0, cy = ax[3] || 0, cm = Math.hypot(cx, cy);
    s.cx = cm > 0.3 ? cx : 0; s.cy = cm > 0.3 ? cy : 0;
    s.sdir = null;
    let cPress = false;
    if (cm > 0.62) { if (!this._cHeld) { cPress = true; s.sdir = [cx / cm, cy / cm]; } this._cHeld = true; }
    else if (cm < 0.4) this._cHeld = false;
    const raw = {};
    for (const a of ACTIONS) { raw[a] = false; for (const i of map[a]) if (btn(i)) raw[a] = true; }
    this._edges(raw);
    if (cPress) s.p.strong = true;
    if (this._cHeld) s.h.strong = true;
    if (mag > 0.4 || digital || cm > 0.4 || ACTIONS.some((a) => raw[a])) this.active = 0; else this.active++;
    const m = this.menu;
    m.up = this._menuRepeat('up', y < -0.6); m.down = this._menuRepeat('down', y > 0.6);
    m.left = this._menuRepeat('left', x < -0.6); m.right = this._menuRepeat('right', x > 0.6);
    const e = (i) => { const now = btn(i), was = this['_m' + i]; this['_m' + i] = now; return now && !was; };
    const ok = e(0), back = e(1), alt = e(2), alt2 = e(3), st = e(9);
    m.ok = ok; m.back = back; m.start = st; m.alt = alt; m.alt2 = alt2;
  }
}

// ---------------------------------------------------------------- manager --
export class InputManager {
  constructor(settings) {
    this.settings = settings;
    this.down = new Set();
    this.fresh = new Set();        // keys that went down since the last poll
    this.clock = 0;
    this.keys = JSON.parse(JSON.stringify(DEFAULT_KEYS));
    this.padPreset = 'brawl';
    this.kbA = new KeyboardDevice('kbA', this, 'solo');
    this.kbB = new KeyboardDevice('kbB', this, 'split2');
    this.pads = [0, 1, 2, 3].map((i) => new PadDevice(i, this));
    this.devices = [this.kbA, this.kbB, ...this.pads];
    this.split = false;            // two people sharing the keyboard?
    this.rawPressed = [];          // key codes pressed this frame (rebinding, typing)
    this._queue = [];
    this.lastType = 'kb';
    this.anyPressed = false;
    this.escPressed = false;
    this.onFirstGesture = null;
    this.mouse = { x: 0, y: 0, down: false, pressed: false, moved: 0 };
    this._mp = false;
  }

  attach(target, canvas) {
    const game = new Set(['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab', 'Slash', 'Quote', 'Backspace']);
    target.addEventListener('keydown', (e) => {
      if (e.repeat) { if (game.has(e.code)) e.preventDefault(); return; }
      if (e.ctrlKey || e.metaKey) return;
      this.down.add(e.code); this.fresh.add(e.code); this._queue.push(e.code);
      if (game.has(e.code)) e.preventDefault();
      this._gesture();
    });
    target.addEventListener('keyup', (e) => { this.down.delete(e.code); });
    target.addEventListener('blur', () => { this.down.clear(); });
    if (canvas) {
      const pos = (e) => {
        const r = canvas.getBoundingClientRect();
        this.mouse.x = ((e.clientX - r.left) / r.width) * 800;
        this.mouse.y = ((e.clientY - r.top) / r.height) * 600;
        this.mouse.moved = 0;
      };
      canvas.addEventListener('mousemove', pos);
      canvas.addEventListener('mousedown', (e) => { pos(e); this.mouse.down = true; this._mp = true; this._gesture(); });
      target.addEventListener('mouseup', () => { this.mouse.down = false; });
      canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    }
  }
  _gesture() { if (this.onFirstGesture) { const f = this.onFirstGesture; this.onFirstGesture = null; f(); } }

  setSplit(on) {
    this.split = on;
    this.kbA.tableName = on ? 'split1' : 'solo';
  }
  padMap() { return PAD_PRESETS[this.padPreset] || PAD_PRESETS.brawl; }

  poll() {
    this.rawPressed = this._queue; this._queue = [];
    this.escPressed = this.rawPressed.includes('Escape');
    this.mouse.pressed = this._mp; this._mp = false; this.mouse.moved++;
    this.kbA.poll();
    this.kbB.poll();
    this.fresh.clear();
    let gps = [];
    if (typeof navigator !== 'undefined' && navigator.getGamepads) { try { gps = navigator.getGamepads() || []; } catch (e) { gps = []; } }
    for (const p of this.pads) p.poll(gps[p.index]);
    this.anyPressed = this.rawPressed.length > 0;
    for (const p of this.pads) {
      if (!p.connected) continue;
      if (ACTIONS.some((a) => p.snap.p[a])) { this.anyPressed = true; this.lastType = 'pad'; this._gesture(); }
    }
    if (this.rawPressed.length) this.lastType = 'kb';
  }

  // Merged menu input from every device. Returns which device did it too.
  menu() {
    const out = { up: false, down: false, left: false, right: false, ok: false, back: false, start: false, alt: false, alt2: false, dev: null };
    for (const d of this.devices) {
      if (!d.connected) continue;
      for (const k of ['up', 'down', 'left', 'right', 'ok', 'back', 'start', 'alt', 'alt2']) {
        if (d.menu[k]) { out[k] = true; out.dev = d; }
      }
    }
    // keys that always work in menus no matter how things are bound
    const rp = this.rawPressed;
    if (rp.includes('Enter') || rp.includes('NumpadEnter')) { out.ok = true; out.dev = out.dev || this.kbA; }
    if (rp.includes('Escape') || rp.includes('Backspace')) { out.back = true; out.dev = out.dev || this.kbA; }
    if (rp.includes('ArrowUp')) out.up = true;
    if (rp.includes('ArrowDown')) out.down = true;
    if (rp.includes('ArrowLeft')) out.left = true;
    if (rp.includes('ArrowRight')) out.right = true;
    return out;
  }

  connectedPads() { return this.pads.filter((p) => p.connected); }

  // ---- persistence ----
  exportConfig() {
    return { keys: this.keys, padPreset: this.padPreset, tapJump: { kbA: this.kbA.tapJump, kbB: this.kbB.tapJump, pad: this.pads[0].tapJump } };
  }
  importConfig(c) {
    if (!c) return;
    if (c.keys) for (const t in DEFAULT_KEYS) if (c.keys[t]) for (const a in DEFAULT_KEYS[t]) if (Array.isArray(c.keys[t][a])) this.keys[t][a] = c.keys[t][a].slice();
    if (c.padPreset && PAD_PRESETS[c.padPreset]) this.padPreset = c.padPreset;
    if (c.tapJump) {
      this.kbA.tapJump = c.tapJump.kbA !== false; this.kbB.tapJump = c.tapJump.kbB !== false;
      for (const p of this.pads) p.tapJump = c.tapJump.pad !== false;
    }
  }
  resetKeys() { this.keys = JSON.parse(JSON.stringify(DEFAULT_KEYS)); }
}

// A human player's controller: just exposes its device snapshot.
export class HumanCtl {
  constructor(device) { this.device = device; this.isCPU = false; }
  read() { return this.device.snap; }
  get tapJump() { return this.device.tapJump; }
}

// Used for empty hands (results screen, attract mode, tests).
export class NullCtl {
  constructor() { this.snap = blankSnap(); this.isCPU = true; this.tapJump = false; }
  read() { return this.snap; }
}
