// Unified input: keyboard + mouse (pointer lock for looking around) + gamepad
// (PS5 DualSense first, Xbox/anything with a standard mapping, raw DualSense
// mapping for Firefox). Midnight Frequency's input, grown legs.
//
// Continuous: move {x,y} (left stick / WASD, y = forward), look {x,y}
// (right stick, rad/s-ish), mouseLook {dx,dy} (px this frame, pointer lock),
// sprint, steer, throttle, brake, handbrake.
// Edges (true for one frame): see ACTIONS.
//
// DualSense (standard mapping): 0 ✕  1 ◯  2 □  3 △  4 L1  5 R1  6 L2  7 R2
//   8 CREATE  9 OPTIONS  10 L3  11 R3  12-15 d-pad  16 PS  17 touchpad
import { clamp } from './util.js';

export const ACTIONS = [
  'up', 'down', 'left', 'right', 'confirm', 'back', 'tabL', 'tabR', 'alt', 'extra',
  'pause', 'camera', 'map', 'phone', 'journal', 'interact', 'vehicle', 'jump', 'crouch',
  'skip', 'choice1', 'choice2', 'choice3', 'choice4', 'replay', 'wait', 'travel', 'any',
];

const KEYMAP = {
  ArrowUp: ['up'], KeyW: ['up'],
  ArrowDown: ['down'], KeyS: ['down'],
  ArrowLeft: ['left'], KeyA: ['left'],
  ArrowRight: ['right'], KeyD: ['right'],
  Enter: ['confirm', 'skip'], NumpadEnter: ['confirm'],
  Space: ['jump', 'confirm', 'skip'],
  Escape: ['back', 'pause'], Backspace: ['back'],
  KeyQ: ['tabL'], KeyE: ['tabR', 'interact'],
  KeyF: ['vehicle', 'alt'], KeyX: ['extra'],
  Tab: ['phone'], KeyM: ['map'], KeyJ: ['journal'],
  KeyC: ['crouch', 'camera'], ControlLeft: ['crouch'],
  KeyR: ['replay'], KeyP: ['pause'], KeyT: ['wait'], KeyG: ['travel'],
  Digit1: ['choice1'], Digit2: ['choice2'], Digit3: ['choice3'], Digit4: ['choice4'],
  Numpad1: ['choice1'], Numpad2: ['choice2'], Numpad3: ['choice3'], Numpad4: ['choice4'],
};

// standard-mapping button index → actions
const PADMAP = {
  0: ['confirm', 'interact', 'skip'], 1: ['back', 'crouch'], 2: ['extra', 'jump'], 3: ['alt', 'vehicle'],
  4: ['tabL'], 5: ['tabR'], 8: ['phone'], 9: ['pause'], 11: ['camera'],
  12: ['up', 'phone'], 13: ['down', 'replay', 'wait'], 14: ['left'], 15: ['right'],
  17: ['map'],
};

const RAW_DS = { 0: 2, 1: 0, 2: 1, 3: 3, 4: 4, 5: 5, 6: 6, 7: 7, 8: 8, 9: 9, 10: 10, 11: 11, 12: 16, 13: 17 };
const DEAD = 0.14;

function stick(x, y) {
  const m = Math.hypot(x, y);
  if (m < DEAD) return [0, 0];
  const k = Math.min(1, (m - DEAD) / (1 - DEAD)) / m;
  return [x * k, y * k];
}

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
    this.move = { x: 0, y: 0 };
    this.look = { x: 0, y: 0 };
    this.mouseLook = { dx: 0, dy: 0 };
    this.sprint = false;
    this.steer = 0;
    this.throttle = 0;
    this.brake = 0;
    this.handbrake = false;
    this._repeat = {};
    this._click = false;
    this.mouse = { x: 0, y: 0, down: false, rdown: false, moved: false, wheel: 0, dx: 0, dy: 0 };
    this._dxAcc = 0;
    this._dyAcc = 0;
    this._lookDx = 0;
    this._lookDy = 0;
    this.enabled = true;
    this._kbSteer = 0;
    this.pointerLocked = false;
    this.wantPointerLock = false; // screens that look around set this
    this.textCapture = null;      // a focused text field swallows keys
    this.typed = [];              // characters typed this frame (name entry etc.)

    window.addEventListener('keydown', (e) => {
      if (this.textCapture) return; // the hidden textarea owns the keyboard
      if (e.key && e.key.length === 1 && !e.ctrlKey && !e.metaKey) this.typed.push(e.key);
      if (e.code === 'Backspace') this.typed.push('\b');
      if (e.repeat) { if (KEYMAP[e.code] || e.code === 'Tab') e.preventDefault(); return; }
      this.keys.add(e.code);
      this._pendingKeys.push(e.code);
      this.device = 'keyboard';
      if (KEYMAP[e.code] || e.code.startsWith('Arrow') || e.code === 'Space' || e.code === 'Tab') e.preventDefault();
    });
    window.addEventListener('keyup', (e) => { this.keys.delete(e.code); });
    window.addEventListener('blur', () => { this.keys.clear(); });
    document.addEventListener('pointerlockchange', () => {
      this.pointerLocked = !!document.pointerLockElement;
    });
  }

  bindMouse(canvas, mapFn) {
    this.canvas = canvas;
    canvas.addEventListener('pointermove', (e) => {
      if (this.pointerLocked) {
        this._lookDx += e.movementX || 0;
        this._lookDy += e.movementY || 0;
        this.device = 'mouse';
        return;
      }
      const p = mapFn(e.clientX, e.clientY);
      if (this.mouse.down) { this._dxAcc += p.x - this.mouse.x; this._dyAcc += p.y - this.mouse.y; }
      this.mouse.x = p.x; this.mouse.y = p.y; this.mouse.moved = true;
      this.device = 'mouse';
    });
    canvas.addEventListener('pointerdown', (e) => {
      if (e.button === 2) { this.mouse.rdown = true; return; }
      if (this.wantPointerLock && !this.pointerLocked) {
        try { canvas.requestPointerLock?.(); } catch { /* not allowed */ }
      }
      const p = mapFn(e.clientX, e.clientY);
      if (!this.pointerLocked) { this.mouse.x = p.x; this.mouse.y = p.y; }
      this.mouse.down = true;
      this._click = true;
      this.device = 'mouse';
    });
    window.addEventListener('pointerup', (e) => {
      if (e.button === 2) this.mouse.rdown = false; else this.mouse.down = false;
    });
    canvas.addEventListener('wheel', (e) => { this.mouse.wheel += Math.sign(e.deltaY); e.preventDefault(); }, { passive: false });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  releasePointer() {
    if (document.pointerLockElement) { try { document.exitPointerLock(); } catch { /* */ } }
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

  update(dt) {
    this.edges.clear();
    this.mouse.dx = this._dxAcc; this.mouse.dy = this._dyAcc;
    this._dxAcc = 0; this._dyAcc = 0;
    this.mouseLook.dx = this._lookDx; this.mouseLook.dy = this._lookDy;
    this._lookDx = 0; this._lookDy = 0;
    const padEvent = this._readPad();
    this.padEvent = padEvent;

    for (const code of this._pendingKeys) {
      const acts = KEYMAP[code];
      if (acts) for (const a of acts) this.edges.add(a);
      this.edges.add('any');
    }
    this._pendingKeys.length = 0;

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
    const [lx, ly] = stick(this.axes[0], this.axes[1]);
    const [rx, ry] = stick(this.axes[2], this.axes[3]);
    if (lx || ly || rx || ry || this.r2 > 0.1 || this.l2 > 0.1) padActive = true;
    if (padActive) this.device = 'pad';

    // menu edges with auto-repeat (stick, d-pad, arrows, WASD)
    const k = this.keys;
    const dirs = {
      up: ly < -0.55 || this.btn[12] || k.has('ArrowUp') || k.has('KeyW'),
      down: ly > 0.55 || this.btn[13] || k.has('ArrowDown') || k.has('KeyS'),
      left: lx < -0.55 || this.btn[14] || k.has('ArrowLeft') || k.has('KeyA'),
      right: lx > 0.55 || this.btn[15] || k.has('ArrowRight') || k.has('KeyD'),
    };
    for (const [d, held] of Object.entries(dirs)) {
      const r = this._repeat[d] || (this._repeat[d] = { t: 0, held: false });
      if (held) {
        if (!r.held) {
          r.held = true;
          r.t = 0.38;
          if (lx || ly) this.edges.add(d);
        } else {
          r.t -= dt;
          if (r.t <= 0) { this.edges.add(d); this.edges.add(d + 'Repeat'); r.t = 0.075; }
        }
      } else {
        r.held = false;
      }
    }

    // ---- on foot
    const kx = (k.has('KeyD') || k.has('ArrowRight') ? 1 : 0) - (k.has('KeyA') || k.has('ArrowLeft') ? 1 : 0);
    const ky = (k.has('KeyW') || k.has('ArrowUp') ? 1 : 0) - (k.has('KeyS') || k.has('ArrowDown') ? 1 : 0);
    let mx = kx, my = ky;
    if (kx && ky) { mx *= Math.SQRT1_2; my *= Math.SQRT1_2; }
    if (Math.abs(lx) + Math.abs(ly) > Math.abs(mx) + Math.abs(my)) { mx = lx; my = -ly; }
    this.move.x = mx;
    this.move.y = my;
    this.look.x = rx;
    this.look.y = ry;
    this.sprint = k.has('ShiftLeft') || k.has('ShiftRight') || this.r2 > 0.35 || !!this.btn[10];
    this.keyboardMove = !!(kx || ky);

    // ---- driving
    const kbTarget = kx;
    const rate = kbTarget === 0 ? 6.5 : (Math.sign(kbTarget) !== Math.sign(this._kbSteer) ? 9 : 3.6);
    this._kbSteer += clamp(kbTarget - this._kbSteer, -rate * dt, rate * dt);
    let padSteer = 0;
    if (Math.abs(this.axes[0]) > DEAD) {
      const v = (Math.abs(this.axes[0]) - DEAD) / (1 - DEAD);
      padSteer = Math.sign(this.axes[0]) * Math.pow(v, 1.45);
    }
    this.steer = Math.abs(padSteer) > Math.abs(this._kbSteer) ? padSteer : this._kbSteer;
    const kbGas = k.has('ArrowUp') || k.has('KeyW') ? 1 : 0;
    const kbBrake = k.has('ArrowDown') || k.has('KeyS') ? 1 : 0;
    this.throttle = Math.max(kbGas, this.r2 > 0.04 ? this.r2 : 0);
    this.brake = Math.max(kbBrake, this.l2 > 0.04 ? this.l2 : 0);
    this.handbrake = k.has('Space') || !!this.btn[2];
  }

  /** Call at the end of the frame (after screens read typed chars). */
  endFrame() { this.typed.length = 0; }

  pressed(action) { return this.enabled && this.edges.has(action); }
  held(code) { return this.keys.has(code); }
  padHeld(i) { return !!this.btn[i]; }
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
