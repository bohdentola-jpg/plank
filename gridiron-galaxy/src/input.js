// Unified input: keyboard + mouse + Gamepad API (PS5 DualSense standard mapping, also Xbox).
// Actions are device-agnostic; UI asks for glyphs to render the right button icons.

const PAD_BUTTONS = { cross: 0, circle: 1, square: 2, triangle: 3, l1: 4, r1: 5, l2: 6, r2: 7, create: 8, options: 9, l3: 10, r3: 11, up: 12, down: 13, left: 14, right: 15, ps: 16, touch: 17 };
const KEYS = {
  cross: ['Space', 'Enter', 'KeyJ'], circle: ['Escape', 'Backspace', 'KeyK'], square: ['KeyQ', 'KeyU', 'Digit1'], triangle: ['KeyE', 'KeyO', 'Digit4'],
  l1: ['KeyF', 'KeyZ'], r1: ['KeyR', 'KeyC'], l2: ['ControlLeft', 'ControlRight'], r2: ['ShiftLeft', 'ShiftRight'],
  options: ['KeyP', 'Tab'], create: ['KeyM'],
  up: ['KeyW', 'ArrowUp'], down: ['KeyS', 'ArrowDown'], left: ['KeyA', 'ArrowLeft'], right: ['KeyD', 'ArrowRight'],
  // throw keys 1-4 map to square/cross/circle/triangle order used by receivers
  t1: ['Digit1'], t2: ['Digit2'], t3: ['Digit3'], t4: ['Digit4'],
  l3: ['KeyX'], r3: ['KeyV'],
};
const KEY_LABEL = { Space: 'SPACE', Enter: 'ENTER', Escape: 'ESC', Backspace: 'BKSP', ShiftLeft: 'SHIFT', ControlLeft: 'CTRL', Tab: 'TAB' };

export const GLYPH = {
  cross: { sym: '✕', color: '#7fb3ff', name: 'Cross' }, circle: { sym: '◯', color: '#ff6b7a', name: 'Circle' },
  square: { sym: '□', color: '#ff9ad5', name: 'Square' }, triangle: { sym: '△', color: '#7fe3a6', name: 'Triangle' },
  l1: { sym: 'L1', color: '#e8e8ff' }, r1: { sym: 'R1', color: '#e8e8ff' }, l2: { sym: 'L2', color: '#e8e8ff' }, r2: { sym: 'R2', color: '#e8e8ff' },
  options: { sym: '≡', color: '#e8e8ff', name: 'Options' }, create: { sym: '⧉', color: '#e8e8ff' },
  up: { sym: '▲' }, down: { sym: '▼' }, left: { sym: '◀' }, right: { sym: '▶' }, l3: { sym: 'L3' }, r3: { sym: 'R3' },
};
export const FACE_ORDER = ['square', 'cross', 'circle', 'triangle'];

class InputSystem {
  constructor() {
    this.keys = new Set(); this.keyEdge = new Set();
    this.padDown = new Set(); this.padEdge = new Set(); this.padUp = new Set();
    this.axes = { lx: 0, ly: 0, rx: 0, ry: 0 };
    this.device = 'kb'; // last used device
    this.padConnected = false; this.padName = '';
    this.mouse = { x: 0, y: 0, dx: 0, dy: 0, down: false, clicked: false, wheel: 0, rightDown: false, moved: false };
    this._prevPad = [];
    this.repeat = { dir: null, t: 0 };
    this.holdTime = {}; // action -> seconds held
    this.blockUntil = 0;
    this.onAny = null;
    this.listeners = new Set();
    this.uiScale = 1;
    window.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(e.code)) e.preventDefault();
      this.keys.add(e.code); this.keyEdge.add(e.code); this.device = 'kb';
      this._fire('keydown', e.code);
    });
    window.addEventListener('keyup', (e) => { this.keys.delete(e.code); });
    window.addEventListener('blur', () => { this.keys.clear(); });
    window.addEventListener('mousemove', (e) => { this.mouse.dx += e.movementX; this.mouse.dy += e.movementY; this.mouse.x = e.clientX; this.mouse.y = e.clientY; this.mouse.moved = true; });
    window.addEventListener('mousedown', (e) => { if (e.button === 0) { this.mouse.down = true; this.mouse.clicked = true; } if (e.button === 2) this.mouse.rightDown = true; this.device = 'kb'; });
    window.addEventListener('mouseup', (e) => { if (e.button === 0) this.mouse.down = false; if (e.button === 2) this.mouse.rightDown = false; });
    window.addEventListener('wheel', (e) => { this.mouse.wheel += Math.sign(e.deltaY); }, { passive: true });
    window.addEventListener('contextmenu', (e) => e.preventDefault());
    window.addEventListener('gamepadconnected', (e) => { const id = e.gamepad ? e.gamepad.id : 'gamepad'; this.padConnected = true; this.padName = id; this._fire('padconnected', id); });
    window.addEventListener('gamepaddisconnected', () => { this.padConnected = false; this._fire('paddisconnected'); });
  }
  on(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); }
  _fire(type, data) { for (const l of this.listeners) l(type, data); }

  // Called once per frame BEFORE game logic.
  poll(dt) {
    this.padEdge.clear(); this.padUp.clear();
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    let pad = null;
    for (const p of pads) if (p && p.connected) { pad = p; break; }
    this.padConnected = !!pad;
    const dz = (v) => (Math.abs(v) < 0.15 ? 0 : (v - Math.sign(v) * 0.15) / 0.85);
    if (pad) {
      this.padName = pad.id;
      const prev = this._prevPad;
      let used = false;
      for (let i = 0; i < pad.buttons.length; i++) {
        const b = pad.buttons[i].pressed || pad.buttons[i].value > 0.5;
        if (b && !prev[i]) { this.padEdge.add(i); used = true; }
        if (!b && prev[i]) this.padUp.add(i);
        if (b) this.padDown.add(i); else this.padDown.delete(i);
        prev[i] = b;
      }
      const ax = pad.axes;
      this.axes.lx = dz(ax[0] || 0); this.axes.ly = dz(ax[1] || 0); this.axes.rx = dz(ax[2] || 0); this.axes.ry = dz(ax[3] || 0);
      if (Math.abs(this.axes.lx) + Math.abs(this.axes.ly) + Math.abs(this.axes.rx) + Math.abs(this.axes.ry) > 0.3) used = true;
      if (used) this.device = 'pad';
    } else {
      this.axes.lx = this.axes.ly = this.axes.rx = this.axes.ry = 0; this.padDown.clear(); this._prevPad = [];
    }
    // keyboard emulates left stick
    if (this.device === 'kb' || !pad) {
      let kx = (this.keys.has('KeyD') || this.keys.has('ArrowRight') ? 1 : 0) - (this.keys.has('KeyA') || this.keys.has('ArrowLeft') ? 1 : 0);
      let ky = (this.keys.has('KeyS') || this.keys.has('ArrowDown') ? 1 : 0) - (this.keys.has('KeyW') || this.keys.has('ArrowUp') ? 1 : 0);
      if (kx || ky) { const l = Math.hypot(kx, ky); this.axes.lx = kx / l; this.axes.ly = ky / l; }
    }
    // menu navigation with repeat (dpad or stick)
    const sx = this.axes.lx, sy = this.axes.ly;
    let dir = null;
    if (this.padDown.has(PAD_BUTTONS.up) || sy < -0.6) dir = 'up'; else if (this.padDown.has(PAD_BUTTONS.down) || sy > 0.6) dir = 'down';
    else if (this.padDown.has(PAD_BUTTONS.left) || sx < -0.6) dir = 'left'; else if (this.padDown.has(PAD_BUTTONS.right) || sx > 0.6) dir = 'right';
    if (!dir && !pad) { for (const d of ['up', 'down', 'left', 'right']) if (KEYS[d].some(k => this.keys.has(k))) { dir = d; break; } }
    // a tap that went down and up between two frames still counts as one navigation step
    let tap = null; if (!dir) for (const d of ['up', 'down', 'left', 'right']) if (KEYS[d].some(k => this.keyEdge.has(k)) || this.padEdge.has(PAD_BUTTONS[d])) { tap = d; break; }
    this.navEdge = null;
    if (dir) {
      if (this.repeat.dir !== dir) { this.repeat.dir = dir; this.repeat.t = 0; this.navEdge = dir; }
      else { this.repeat.t += dt; if (this.repeat.t > 0.38) { this.repeat.t -= 0.12; this.navEdge = dir; } }
    } else { this.repeat.dir = null; if (tap) this.navEdge = tap; }
    // d-pad / arrow-key only navigation (lets the left stick do something else, e.g. fly)
    let ddir = null;
    if (this.padDown.has(PAD_BUTTONS.up) || this.keys.has('ArrowUp')) ddir = 'up'; else if (this.padDown.has(PAD_BUTTONS.down) || this.keys.has('ArrowDown')) ddir = 'down';
    else if (this.padDown.has(PAD_BUTTONS.left) || this.keys.has('ArrowLeft')) ddir = 'left'; else if (this.padDown.has(PAD_BUTTONS.right) || this.keys.has('ArrowRight')) ddir = 'right';
    this.navEdgeDpad = null; this.repeatD = this.repeatD || { dir: null, t: 0 };
    if (ddir) {
      if (this.repeatD.dir !== ddir) { this.repeatD.dir = ddir; this.repeatD.t = 0; this.navEdgeDpad = ddir; }
      else { this.repeatD.t += dt; if (this.repeatD.t > 0.38) { this.repeatD.t -= 0.12; this.navEdgeDpad = ddir; } }
    } else { this.repeatD.dir = null; const dt2 = ['up', 'down', 'left', 'right'].find(d => this.keyEdge.has('Arrow' + d[0].toUpperCase() + d.slice(1)) || this.padEdge.has(PAD_BUTTONS[d])); if (dt2) this.navEdgeDpad = dt2; }
    for (const a of Object.keys(PAD_BUTTONS)) { if (this.down(a)) this.holdTime[a] = (this.holdTime[a] || 0) + dt; else this.holdTime[a] = 0; }
  }
  // Called at END of frame
  endFrame() { this.keyEdge.clear(); this.mouse.clicked = false; this.mouse.dx = 0; this.mouse.dy = 0; this.mouse.wheel = 0; this.mouse.moved = false; }

  down(action) {
    if (performance.now() < this.blockUntil) return false;
    const pb = PAD_BUTTONS[action]; if (pb !== undefined && this.padDown.has(pb)) return true;
    const ks = KEYS[action]; if (ks) for (const k of ks) if (this.keys.has(k)) return true;
    return false;
  }
  pressed(action) {
    if (performance.now() < this.blockUntil) return false;
    const pb = PAD_BUTTONS[action]; if (pb !== undefined && this.padEdge.has(pb)) return true;
    const ks = KEYS[action]; if (ks) for (const k of ks) if (this.keyEdge.has(k)) return true;
    return false;
  }
  released(action) { const pb = PAD_BUTTONS[action]; return pb !== undefined && this.padUp.has(pb); }
  held(action) { return this.holdTime[action] || 0; }
  nav() { return performance.now() < this.blockUntil ? null : this.navEdge; }
  navDpad() { return performance.now() < this.blockUntil ? null : this.navEdgeDpad; }
  anyPressed() { return this.padEdge.size > 0 || this.keyEdge.size > 0 || this.mouse.clicked; }
  block(ms = 250) { this.blockUntil = performance.now() + ms; this.keyEdge.clear(); this.padEdge.clear(); }
  // stick vector for gameplay (left stick or WASD), y is "up on the stick"
  moveVec() { return { x: this.axes.lx, y: -this.axes.ly }; }
  lookVec() { return { x: this.axes.rx, y: this.axes.ry }; }

  // ---- glyphs ----
  glyphHTML(action, label) {
    const g = GLYPH[action] || { sym: action.toUpperCase() };
    if (this.device === 'pad' || this.padConnected) {
      const cls = ['cross', 'circle', 'square', 'triangle'].includes(action) ? 'gly face' : 'gly';
      return `<span class="${cls}" style="--gc:${g.color || '#fff'}">${g.sym}</span>${label ? `<span class="gl">${label}</span>` : ''}`;
    }
    const key = (KEYS[action] || [])[0] || '?';
    const txt = KEY_LABEL[key] || key.replace('Key', '').replace('Digit', '').replace('Arrow', '');
    return `<span class="gly key">${txt}</span>${label ? `<span class="gl">${label}</span>` : ''}`;
  }
  faceLabel(i) { // label for receiver icons 0..3
    const a = FACE_ORDER[i];
    if (this.device === 'pad' || this.padConnected) return { text: GLYPH[a].sym, color: GLYPH[a].color };
    return { text: String(i + 1), color: GLYPH[a].color };
  }
  throwPressed(i) { // receiver index 0..3
    const a = FACE_ORDER[i];
    return this.pressed(a) || this.pressed('t' + (i + 1));
  }
  throwDown(i) { const a = FACE_ORDER[i]; return this.down(a) || this.down('t' + (i + 1)); }
  usingPad() { return this.device === 'pad' || this.padConnected; }
}

export const input = new InputSystem();
