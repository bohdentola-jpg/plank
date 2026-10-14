// Unified input: keyboard + gamepad (PS5 DualSense first, Xbox/anything with a
// standard mapping too; raw DualSense mapping for Firefox).
//
// Driving (continuous): steer -1..1, throttle 0..1, brake 0..1, handbrake,
// nitro, lookBack.  Edges (true for one frame): see ACTIONS.
//
// DualSense (standard mapping): 0 ✕  1 ◯  2 □  3 △  4 L1  5 R1  6 L2  7 R2
//   8 CREATE  9 OPTIONS  10 L3  11 R3  12-15 d-pad  16 PS  17 touchpad
import { clamp } from './util.js';

export const ACTIONS = [
  'up', 'down', 'left', 'right', 'confirm', 'back', 'tabL', 'tabR', 'alt', 'extra',
  'pause', 'camera', 'reset', 'shiftUp', 'shiftDown', 'radioPrev', 'radioNext', 'any',
];

const KEYMAP = {
  ArrowUp: ['up'], KeyW: ['up'],
  ArrowDown: ['down'], KeyS: ['down'],
  ArrowLeft: ['left'], KeyA: ['left'],
  ArrowRight: ['right'], KeyD: ['right'],
  Enter: ['confirm'], Space: ['confirm'], NumpadEnter: ['confirm'],
  Escape: ['back', 'pause'], Backspace: ['back'],
  KeyQ: ['tabL', 'shiftDown'], KeyE: ['tabR', 'shiftUp'],
  KeyF: ['alt'], KeyX: ['extra'], Tab: ['extra'],
  KeyP: ['pause'],
  KeyC: ['camera'],
  KeyR: ['reset'],
  BracketLeft: ['radioPrev'], BracketRight: ['radioNext'],
  Comma: ['radioPrev'], Period: ['radioNext'],
};

// standard-mapping button index → actions
const PADMAP = {
  0: ['confirm'], 1: ['back'], 2: ['extra'], 3: ['alt', 'camera'],
  4: ['tabL', 'shiftDown'], 5: ['tabR', 'shiftUp'],
  8: ['reset'], 9: ['pause'],
  12: ['up'], 13: ['down'], 14: ['left', 'radioPrev'], 15: ['right', 'radioNext'],
};

// Firefox / raw DualSense (vendor 054c) → standard indices
const RAW_DS = { 0: 2, 1: 0, 2: 1, 3: 3, 4: 4, 5: 5, 6: 6, 7: 7, 8: 8, 9: 9, 10: 10, 11: 11, 12: 16, 13: 17 };

const DEAD = 0.14;

class Input {
  constructor() {
    this.keys = new Set();
    this.edges = new Set();
    this._pendingKeys = [];
    this.device = 'keyboard';
    this.padConnected = false;
    this.padId = '';
    this.pad = null;
    this._prevBtn = [];
    this.btn = [];
    this.axes = [0, 0, 0, 0];
    this.l2 = 0;
    this.r2 = 0;
    // smoothed driving outputs
    this.steer = 0;
    this.throttle = 0;
    this.brake = 0;
    this.handbrake = false;
    this.nitro = false;
    this.lookBack = false;
    this._repeat = {};
    this._click = false;
    this.mouse = { x: 0, y: 0, down: false, moved: false, wheel: 0, dx: 0, dy: 0 };
    this._dxAcc = 0;
    this._dyAcc = 0;
    this.enabled = true;
    this._kbSteer = 0;

    window.addEventListener('keydown', (e) => {
      if (e.repeat) { if (KEYMAP[e.code]) e.preventDefault(); return; }
      this.keys.add(e.code);
      this._pendingKeys.push(e.code);
      this.device = 'keyboard';
      if (KEYMAP[e.code] || e.code.startsWith('Arrow') || e.code === 'Space') e.preventDefault();
    });
    window.addEventListener('keyup', (e) => { this.keys.delete(e.code); });
    window.addEventListener('blur', () => { this.keys.clear(); });
  }

  bindMouse(canvas, mapFn) {
    canvas.addEventListener('pointermove', (e) => {
      const p = mapFn(e.clientX, e.clientY);
      if (this.mouse.down) { this._dxAcc += p.x - this.mouse.x; this._dyAcc += p.y - this.mouse.y; }
      this.mouse.x = p.x; this.mouse.y = p.y; this.mouse.moved = true;
      this.device = 'mouse';
    });
    canvas.addEventListener('pointerdown', (e) => {
      const p = mapFn(e.clientX, e.clientY);
      this.mouse.x = p.x; this.mouse.y = p.y;
      this.mouse.down = true;
      this._click = true;
      this.device = 'mouse';
    });
    window.addEventListener('pointerup', () => { this.mouse.down = false; });
    canvas.addEventListener('wheel', (e) => { this.mouse.wheel += Math.sign(e.deltaY); e.preventDefault(); }, { passive: false });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  _readPad() {
    let gp = null;
    try {
      const list = navigator.getGamepads ? navigator.getGamepads() : [];
      for (const g of list) { if (g && g.connected) { gp = g; break; } }
    } catch { /* no gamepad API */ }
    const wasConnected = this.padConnected;
    this.pad = gp;
    this.padConnected = !!gp;
    if (!gp) { this.btn = []; this.l2 = this.r2 = 0; this.axes = [0, 0, 0, 0]; return wasConnected ? 'lost' : null; }
    this.padId = gp.id;
    const raw = gp.mapping !== 'standard' && /054c/i.test(gp.id);
    const b = [];
    if (raw) {
      for (let i = 0; i < gp.buttons.length; i++) {
        const std = RAW_DS[i];
        if (std !== undefined) b[std] = gp.buttons[i].pressed;
      }
      // d-pad as hat axis 9 (Firefox)
      const hat = gp.axes[9];
      if (hat !== undefined && hat < 1.1) {
        const dir = Math.round((hat + 1) * 3.5);
        b[12] = dir === 7 || dir === 0 || dir === 1;
        b[15] = dir >= 1 && dir <= 3;
        b[13] = dir >= 3 && dir <= 5;
        b[14] = dir >= 5 && dir <= 7;
      }
      this.l2 = gp.axes[3] !== undefined ? (gp.axes[3] + 1) / 2 : (b[6] ? 1 : 0);
      this.r2 = gp.axes[4] !== undefined ? (gp.axes[4] + 1) / 2 : (b[7] ? 1 : 0);
      this.axes = [gp.axes[0] || 0, gp.axes[1] || 0, gp.axes[2] || 0, gp.axes[5] || 0];
    } else {
      for (let i = 0; i < gp.buttons.length; i++) b[i] = !!gp.buttons[i]?.pressed;
      this.l2 = gp.buttons[6]?.value ?? (b[6] ? 1 : 0);
      this.r2 = gp.buttons[7]?.value ?? (b[7] ? 1 : 0);
      this.axes = [gp.axes[0] || 0, gp.axes[1] || 0, gp.axes[2] || 0, gp.axes[3] || 0];
    }
    this.btn = b;
    return wasConnected ? null : 'new';
  }

  /** Call once per frame before game logic. */
  update(dt) {
    this.edges.clear();
    this.mouse.dx = this._dxAcc; this.mouse.dy = this._dyAcc;
    this._dxAcc = 0; this._dyAcc = 0;
    const padEvent = this._readPad();
    this.padEvent = padEvent;

    // keyboard edges
    for (const code of this._pendingKeys) {
      const acts = KEYMAP[code];
      if (acts) for (const a of acts) this.edges.add(a);
      this.edges.add('any');
    }
    this._pendingKeys.length = 0;

    // pad edges
    let padActive = false;
    for (let i = 0; i < Math.max(this.btn.length, this._prevBtn.length); i++) {
      const now = !!this.btn[i], before = !!this._prevBtn[i];
      if (now && !before) {
        const acts = PADMAP[i];
        if (acts) for (const a of acts) this.edges.add(a);
        this.edges.add('any');
        padActive = true;
      }
    }
    this._prevBtn = this.btn.slice();
    const lx = Math.abs(this.axes[0]) > DEAD ? this.axes[0] : 0;
    const ly = Math.abs(this.axes[1]) > DEAD ? this.axes[1] : 0;
    if (lx || ly || this.r2 > 0.1 || this.l2 > 0.1) padActive = true;
    if (padActive) this.device = 'pad';

    // left-stick + held d-pad → menu edges with auto-repeat
    const dirs = {
      up: ly < -0.55 || this.btn[12] || this.keys.has('ArrowUp') || this.keys.has('KeyW'),
      down: ly > 0.55 || this.btn[13] || this.keys.has('ArrowDown') || this.keys.has('KeyS'),
      left: lx < -0.55 || this.btn[14] || this.keys.has('ArrowLeft') || this.keys.has('KeyA'),
      right: lx > 0.55 || this.btn[15] || this.keys.has('ArrowRight') || this.keys.has('KeyD'),
    };
    for (const [d, held] of Object.entries(dirs)) {
      const r = this._repeat[d] || (this._repeat[d] = { t: 0, held: false });
      if (held) {
        if (!r.held) {
          r.held = true;
          r.t = 0.38;
          if (lx || ly) this.edges.add(d); // stick first push (keys/dpad already edged)
        } else {
          r.t -= dt;
          if (r.t <= 0) { this.edges.add(d); this.edges.add(d + 'Repeat'); r.t = 0.075; }
        }
      } else {
        r.held = false;
      }
    }

    // ---- driving
    const k = this.keys;
    const kbLeft = k.has('ArrowLeft') || k.has('KeyA');
    const kbRight = k.has('ArrowRight') || k.has('KeyD');
    const kbTarget = (kbRight ? 1 : 0) - (kbLeft ? 1 : 0);
    // keyboard steering ramps like a real wheel being turned
    const rate = kbTarget === 0 ? 6.5 : (Math.sign(kbTarget) !== Math.sign(this._kbSteer) ? 9 : 3.6);
    this._kbSteer += clamp(kbTarget - this._kbSteer, -rate * dt, rate * dt);

    let padSteer = 0;
    if (Math.abs(this.axes[0]) > DEAD) {
      const v = (Math.abs(this.axes[0]) - DEAD) / (1 - DEAD);
      padSteer = Math.sign(this.axes[0]) * Math.pow(v, 1.45); // finer near center
    }
    if (this.btn[14]) padSteer = -1;
    if (this.btn[15]) padSteer = 1;
    this.steer = Math.abs(padSteer) > Math.abs(this._kbSteer) ? padSteer : this._kbSteer;

    const kbGas = k.has('ArrowUp') || k.has('KeyW') ? 1 : 0;
    const kbBrake = k.has('ArrowDown') || k.has('KeyS') ? 1 : 0;
    const r2 = this.r2 > 0.04 ? this.r2 : 0;
    const l2 = this.l2 > 0.04 ? this.l2 : 0;
    this.throttle = Math.max(kbGas, r2);
    this.brake = Math.max(kbBrake, l2);
    this.handbrake = k.has('Space') || !!this.btn[2];
    this.nitro = k.has('ShiftLeft') || k.has('ShiftRight') || k.has('KeyN') || !!this.btn[0];
    this.lookBack = k.has('KeyB') || !!this.btn[1];
  }

  /** True on the frame an action started. */
  pressed(action) { return this.enabled && this.edges.has(action); }

  /** Consume an edge so a later reader in the same frame doesn't also see it. */
  consume(action) { this.edges.delete(action); }

  clearEdges() { this.edges.clear(); }

  takeClick() {
    const c = this._click;
    this._click = false;
    return c;
  }

  rumble(strong = 0.5, weak = 0.5, ms = 120) {
    const a = this.pad?.vibrationActuator;
    if (!a || !this.settingsRumble) return;
    try {
      a.playEffect?.('dual-rumble', { duration: ms, strongMagnitude: clamp(strong, 0, 1), weakMagnitude: clamp(weak, 0, 1) });
    } catch { /* unsupported */ }
  }
}

export const input = new Input();
input.settingsRumble = true;
