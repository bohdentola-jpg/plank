// Unified input: keyboard + gamepad (+ a virtual layer used by touch controls
// and the QA harness). Game code asks about *actions*, never raw keys.
//
//   a  primary   SPACE / ENTER / J      pad ✕     talk, snap, catch, juke, tackle, confirm
//   b  secondary SHIFT / K              pad ◯     spin, run (held), cancel
//   x  tertiary  Q / U                  pad □     throw the football (overworld)
//   y  fourth    E / I                  pad △     lateral, switch defender
//   l / r        Z / C                  pad L1/R1 swap squads, cycle
//   t1..t6       1..6                   (□ △ ◯ in the pocket) throw targets / quick picks
//   start        ESC / P                pad OPTIONS
//   menu         TAB                    pad SHARE/TOUCHPAD
import { clamp } from './util.js';

const KEYMAP = {
  a: ['Space', 'Enter', 'KeyJ', 'NumpadEnter'],
  b: ['ShiftLeft', 'ShiftRight', 'KeyK'],
  x: ['KeyQ', 'KeyU'],
  y: ['KeyE', 'KeyI'],
  l: ['KeyZ'],
  r: ['KeyC'],
  start: ['Escape', 'KeyP'],
  menu: ['Tab'],
  back: ['Escape', 'Backspace'],
  mute: ['KeyM'],
  t1: ['Digit1', 'Numpad1'], t2: ['Digit2', 'Numpad2'], t3: ['Digit3', 'Numpad3'],
  t4: ['Digit4', 'Numpad4'], t5: ['Digit5', 'Numpad5'], t6: ['Digit6', 'Numpad6'],
  up: ['ArrowUp', 'KeyW'], down: ['ArrowDown', 'KeyS'],
  left: ['ArrowLeft', 'KeyA'], right: ['ArrowRight', 'KeyD'],
};
const PADMAP = {
  a: [0], b: [1], x: [2], y: [3], l: [4], r: [5], run: [7, 6],
  start: [9], menu: [8, 17], back: [1],
  up: [12], down: [13], left: [14], right: [15],
};
const KEY_GLYPH = {
  a: 'SPACE', b: 'SHIFT', x: 'Q', y: 'E', l: 'Z', r: 'C', start: 'ESC', menu: 'TAB', back: 'ESC',
  t1: '1', t2: '2', t3: '3', t4: '4', t5: '5', t6: '6', move: 'WASD', mute: 'M',
};
const PAD_GLYPH = {
  a: '✕', b: '◯', x: '□', y: '△', l: 'L1', r: 'R1', start: 'OPTIONS', menu: 'SHARE', back: '◯',
  t1: '□', t2: '△', t3: '◯', move: 'L-STICK', mute: 'M',
};
const PREVENT = new Set(['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab']);
const DEADZONE = 0.22;

export class Input {
  constructor() {
    this.keys = new Set();
    this.keyHits = new Set();
    this.padDown = [];
    this.padHits = new Set();
    this.padAxes = [0, 0];
    this.padConnected = false;
    this.device = 'kb';
    this.vDown = new Set();   // virtual actions held
    this.vHits = new Set();   // virtual actions pressed this frame
    this.vAxis = { x: 0, y: 0 };
    this.consumed = new Set();
    this.enabled = true;
    this._nav = { dir: null, t: 0, fired: null };
    this.anyKeyHit = false;
    this.onFirstGesture = null;
    this._gestured = false;

    window.addEventListener('keydown', (e) => {
      const tag = document.activeElement && document.activeElement.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') {
        if (e.code === 'Enter' || e.code === 'Escape') document.activeElement.blur();
        return;
      }
      if (PREVENT.has(e.code)) e.preventDefault();
      if (e.repeat) return;
      this.keys.add(e.code);
      this.keyHits.add(e.code);
      this.anyKeyHit = true;
      this.device = 'kb';
      this._gesture();
    });
    window.addEventListener('keyup', (e) => { this.keys.delete(e.code); });
    window.addEventListener('blur', () => { this.keys.clear(); this.vDown.clear(); });
    window.addEventListener('pointerdown', () => this._gesture());
  }

  _gesture() {
    if (this._gestured) return;
    this._gestured = true;
    if (this.onFirstGesture) this.onFirstGesture();
  }

  /** Read the gamepad and update nav repeat. Call once at the start of a frame. */
  poll(dt = 1 / 60) {
    let gp = null;
    try {
      const gps = navigator.getGamepads ? navigator.getGamepads() : [];
      for (const g of gps) if (g && g.connected) { gp = g; break; }
    } catch { /* no gamepad API */ }
    if (gp) {
      this.padConnected = true;
      const ax = gp.axes || [];
      const lx = Math.abs(ax[0] || 0) > DEADZONE ? ax[0] : 0;
      const ly = Math.abs(ax[1] || 0) > DEADZONE ? ax[1] : 0;
      this.padAxes[0] = lx; this.padAxes[1] = ly;
      if (lx || ly) this.device = 'pad';
      for (let i = 0; i < gp.buttons.length; i++) {
        const pressed = !!(gp.buttons[i] && (gp.buttons[i].pressed || gp.buttons[i].value > 0.5));
        if (pressed && !this.padDown[i]) { this.padHits.add(i); this.device = 'pad'; this.anyKeyHit = true; this._gesture(); }
        this.padDown[i] = pressed;
      }
    } else if (this.padConnected) {
      this.padConnected = false;
      this.padAxes[0] = this.padAxes[1] = 0;
      this.padDown.length = 0;
    }

    // menu navigation with key repeat
    const a = this.axisRaw();
    let dir = null;
    if (this.down('up') || a.y < -0.6) dir = 'up';
    else if (this.down('down') || a.y > 0.6) dir = 'down';
    else if (this.down('left') || a.x < -0.6) dir = 'left';
    else if (this.down('right') || a.x > 0.6) dir = 'right';
    const n = this._nav;
    n.fired = null;
    if (dir !== n.dir) {
      n.dir = dir; n.t = 0.34;
      if (dir) n.fired = dir;
    } else if (dir) {
      n.t -= dt;
      if (n.t <= 0) { n.t = 0.11; n.fired = dir; }
    }
  }

  endFrame() {
    this.keyHits.clear();
    this.padHits.clear();
    this.vHits.clear();
    this.consumed.clear();
    this.anyKeyHit = false;
  }

  axisRaw() {
    let x = this.padAxes[0] + this.vAxis.x;
    let y = this.padAxes[1] + this.vAxis.y;
    return { x, y };
  }

  /** Movement vector: x = screen right, y = screen down (world +z). Length ≤ 1. */
  axis() {
    if (!this.enabled) return { x: 0, y: 0 };
    let { x, y } = this.axisRaw();
    if (this.down('left')) x -= 1;
    if (this.down('right')) x += 1;
    if (this.down('up')) y -= 1;
    if (this.down('down')) y += 1;
    const len = Math.hypot(x, y);
    if (len > 1) { x /= len; y /= len; }
    return { x: clamp(x, -1, 1), y: clamp(y, -1, 1) };
  }

  down(action) {
    const keys = KEYMAP[action];
    if (keys) for (const k of keys) if (this.keys.has(k)) return true;
    const btns = PADMAP[action];
    if (btns) for (const b of btns) if (this.padDown[b]) return true;
    return this.vDown.has(action);
  }

  hit(action) {
    if (!this.enabled || this.consumed.has(action)) return false;
    const keys = KEYMAP[action];
    if (keys) for (const k of keys) if (this.keyHits.has(k)) return true;
    const btns = PADMAP[action];
    if (btns) for (const b of btns) if (this.padHits.has(b)) return true;
    return this.vHits.has(action);
  }

  /** hit() that also swallows the press so nothing else reacts this frame. */
  take(action) {
    if (this.hit(action)) { this.consumed.add(action); return true; }
    return false;
  }
  consume(...actions) { for (const a of actions) this.consumed.add(a); }

  /** Held "run" — SHIFT on keys, R2/◯ on pad. */
  running() { return this.down('b') || this.down('run'); }

  /** One menu-navigation step this frame, or null. */
  nav() { return this.enabled ? this._nav.fired : null; }

  /** Throw-target buttons: 1/2/3 on keys, □/△/◯ on pad. */
  targetHit(i) {
    if (this.hit('t' + (i + 1))) return true;
    if (this.device === 'pad') return this.hit(['x', 'y', 'b'][i]);
    return false;
  }

  glyph(action) {
    return (this.device === 'pad' ? PAD_GLYPH[action] : KEY_GLYPH[action]) || action.toUpperCase();
  }

  // ---- virtual layer (touch UI + tests)
  press(action) { this.vHits.add(action); this.anyKeyHit = true; this._gesture(); }
  hold(action, on = true) { if (on) this.vDown.add(action); else this.vDown.delete(action); }
  setAxis(x, y) { this.vAxis.x = x; this.vAxis.y = y; }
}
