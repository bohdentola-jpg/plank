// Input: keyboard (split for two players) and gamepads, funnelled into one
// per-player Controls snapshot the fight sim reads once per 60 Hz frame.
//
// Fighting games live and die on edges, not held state, so every action tracks
// pressed/held/released, and the stick tracks *flicks* — the difference between
// a tilt and a smash attack.

export const ACTIONS = ['jump', 'attack', 'special', 'shield', 'grab', 'taunt', 'start', 'smashMod'];

// Standard gamepad mapping (PS/Xbox agree on indices)
export const BTN = {
  CROSS: 0, CIRCLE: 1, SQUARE: 2, TRIANGLE: 3,
  L1: 4, R1: 5, L2: 6, R2: 7, SHARE: 8, OPTIONS: 9,
  UP: 12, DOWN: 13, LEFT: 14, RIGHT: 15,
};

const KB1 = {
  left: ['KeyA'], right: ['KeyD'], up: ['KeyW'], down: ['KeyS'],
  jump: ['Space'], attack: ['KeyJ'], special: ['KeyK'], shield: ['KeyL'],
  grab: ['KeyH', 'Semicolon'], taunt: ['KeyT'], start: ['Escape'], smashMod: ['ShiftLeft'],
};

const KB2 = {
  left: ['ArrowLeft'], right: ['ArrowRight'], up: ['ArrowUp'], down: ['ArrowDown'],
  jump: ['Numpad0', 'ShiftRight'], attack: ['Numpad1', 'Period'], special: ['Numpad2', 'Slash'],
  shield: ['Numpad3', 'ControlRight'], grab: ['Numpad4', 'Quote'], taunt: ['Numpad5'],
  start: ['Enter', 'NumpadEnter'], smashMod: ['NumpadDecimal'],
};

const DEAD = 0.26;
const FLICK = 0.72;      // stick past this, from below FLICK_LOW, within FLICK_WINDOW = smash
const FLICK_LOW = 0.4;
const FLICK_WINDOW = 4;  // frames

function blankState() {
  const s = { ax: 0, ay: 0, smashX: 0, smashY: 0, held: {}, pressed: {}, released: {}, cstick: 0, cstickY: 0 };
  for (const a of ACTIONS) { s.held[a] = false; s.pressed[a] = false; s.released[a] = false; }
  return s;
}

/** One player's controller — device-agnostic. */
class Controls {
  constructor(label) {
    this.label = label;
    this.device = null;
    Object.assign(this, blankState());
    this._prevAx = 0;
    this._prevAy = 0;
    this._axLowT = 99;
    this._ayLowT = 99;
    this._prevHeld = {};
    this.connected = true;
  }

  /** Merge a raw sample and derive edges + flicks. Called once per frame. */
  apply(ax, ay, actions, connected) {
    this.connected = connected;
    for (const a of ACTIONS) {
      const now = !!actions[a];
      this.pressed[a] = now && !this._prevHeld[a];
      this.released[a] = !now && !!this._prevHeld[a];
      this.held[a] = now;
      this._prevHeld[a] = now;
    }
    // flick detection: remember how long ago the axis was near neutral
    this._axLowT = Math.abs(ax) < FLICK_LOW ? 0 : this._axLowT + 1;
    this._ayLowT = Math.abs(ay) < FLICK_LOW ? 0 : this._ayLowT + 1;
    this.smashX = 0;
    this.smashY = 0;
    if (Math.abs(ax) >= FLICK && Math.abs(this._prevAx) < FLICK && this._axLowT <= FLICK_WINDOW) {
      this.smashX = Math.sign(ax);
    }
    if (Math.abs(ay) >= FLICK && Math.abs(this._prevAy) < FLICK && this._ayLowT <= FLICK_WINDOW) {
      this.smashY = Math.sign(ay);
    }
    this._prevAx = ax;
    this._prevAy = ay;
    this.ax = ax;
    this.ay = ay;
  }

  /** True if a smash attack was requested this frame (flick, C-stick or modifier). */
  smashDir() {
    if (this.cstick) return { x: this.cstick, y: 0, c: true };
    if (this.cstickY) return { x: 0, y: this.cstickY, c: true };
    const mod = this.held.smashMod;
    if (this.pressed.attack) {
      if (this.smashX || (mod && Math.abs(this.ax) > 0.5)) return { x: Math.sign(this.smashX || this.ax), y: 0 };
      if (this.smashY || (mod && Math.abs(this.ay) > 0.5)) return { x: 0, y: Math.sign(this.smashY || this.ay) };
    }
    return null;
  }

  /**
   * Eat the edges. The sim can run more than one 60 Hz step per rendered frame,
   * and a press must only ever fire on one of them.
   */
  consumeEdges() {
    for (const a of ACTIONS) { this.pressed[a] = false; this.released[a] = false; }
    this.smashX = 0;
    this.smashY = 0;
    this.cstick = 0;
    this.cstickY = 0;
  }

  reset() {
    const b = blankState();
    Object.assign(this, b);
    this._prevHeld = {};
  }
}

/** A stand-in Controls the CPU writes into — same shape, no hardware. */
export class VirtualControls extends Controls {
  constructor() {
    super('CPU');
    this.device = 'cpu';
  }
  /** AI calls this with the intent for one frame. */
  set(ax, ay, actions, { smashX = 0, smashY = 0 } = {}) {
    this.apply(ax, ay, actions, true);
    this.smashX = smashX;
    this.smashY = smashY;
  }
}

export class InputHub {
  constructor(win = typeof window !== 'undefined' ? window : null) {
    this.keys = new Set();
    // keys that went down since the last poll, even if they came back up before
    // it — a 10 ms tap must still register as a press
    this.latch = new Set();
    this.players = [new Controls('P1'), new Controls('P2'), new Controls('P3'), new Controls('P4')];
    this.assign = ['kb1', 'pad0', 'cpu', 'cpu'];
    this.tapJump = false;
    this.lastDeviceKind = 'kb';
    this.padCount = 0;
    this._menu = { up: false, down: false, left: false, right: false, confirm: false, back: false, start: false, any: false };
    this._menuBy = [];
    this._navHeld = {};
    this._navAt = {};
    this._padSeen = false;
    if (win) {
      this._onDown = (e) => {
        // never swallow devtools / reload
        if (e.metaKey || e.ctrlKey && e.code !== 'ControlRight') return;
        this.keys.add(e.code);
        this.latch.add(e.code);
        this.lastDeviceKind = 'kb';
        if (SWALLOW.has(e.code)) e.preventDefault();
      };
      this._onUp = (e) => this.keys.delete(e.code);
      this._onBlur = () => { this.keys.clear(); this.latch.clear(); };
      win.addEventListener('keydown', this._onDown);
      win.addEventListener('keyup', this._onUp);
      win.addEventListener('blur', this._onBlur);
      this._win = win;
    }
  }

  dispose() {
    if (!this._win) return;
    this._win.removeEventListener('keydown', this._onDown);
    this._win.removeEventListener('keyup', this._onUp);
    this._win.removeEventListener('blur', this._onBlur);
  }

  pads() {
    try {
      const list = navigator.getGamepads ? navigator.getGamepads() : [];
      return [...list].filter((g) => g && g.connected);
    } catch { return []; }
  }

  /** Give P1 the first pad if there is one, P2 the second (or the keyboard). */
  autoAssign(humans = 2) {
    const pads = this.pads();
    const order = [];
    for (let i = 0; i < pads.length; i++) order.push(`pad${i}`);
    order.push('kb1', 'kb2');
    // remember the hardware each slot *would* use, so a slot that spends a match
    // as a CPU can be handed back to a human afterwards
    this.humanAssign = [order[0] || 'kb1', order[1] || 'kb2', order[2] || 'cpu', order[3] || 'cpu'];
    for (let i = 0; i < 4; i++) this.assign[i] = i < humans ? (order[i] || 'cpu') : 'cpu';
    return this.assign.slice();
  }

  /** Hand slot i back to a human, on whatever device it was assigned. */
  useHuman(i) {
    if (this.players[i] instanceof VirtualControls) this.players[i] = new Controls(`P${i + 1}`);
    const dev = this.humanAssign?.[i];
    this.assign[i] = dev && dev !== 'cpu' ? dev : (i === 1 ? 'kb2' : 'kb1');
    return this.players[i];
  }

  deviceLabel(id) {
    if (id === 'kb1') return 'KEYS · WASD';
    if (id === 'kb2') return 'KEYS · ARROWS';
    if (id === 'cpu') return 'CPU';
    const i = +id.slice(3);
    const p = this.pads()[i];
    return p ? `PAD ${i + 1}` : `PAD ${i + 1} (OFF)`;
  }

  keyDown(codes) { return codes.some((c) => this.keys.has(c) || this.latch.has(c)); }

  /** Rising edge of "up" on a keyboard, for the optional tap-jump setting. */
  _tapEdge(dev, ay) {
    this._tapUp = this._tapUp || {};
    const was = this._tapUp[dev];
    this._tapUp[dev] = ay > 0.5;
    return !was && ay > 0.5;
  }

  /** Read every device, update all four Controls. Call once per sim frame. */
  poll() {
    const pads = this.pads();
    this.padCount = pads.length;
    if (pads.length && !this._padSeen) this._padSeen = true;
    for (let i = 0; i < 4; i++) {
      const dev = this.assign[i];
      const c = this.players[i];
      c.device = dev;
      c.cstick = 0;
      c.cstickY = 0;
      if (dev === 'kb1' || dev === 'kb2') {
        const map = dev === 'kb1' ? KB1 : KB2;
        const rawX = (this.keyDown(map.right) ? 1 : 0) - (this.keyDown(map.left) ? 1 : 0);
        const ay = (this.keyDown(map.up) ? 1 : 0) - (this.keyDown(map.down) ? 1 : 0);
        // A keyboard has no analog stick, so ramp the axis: a quick tap is a walk,
        // a held key builds into a run. Without this, keyboard players can only
        // ever sprint and lose all the spacing game that walking gives you.
        c._rampT = rawX !== 0 && rawX === c._rampDir ? (c._rampT || 0) + 1 : 0;
        c._rampDir = rawX;
        const acts = {};
        for (const a of ACTIONS) acts[a] = map[a] ? this.keyDown(map[a]) : false;
        // holding the smash modifier means "all the way over, right now"
        const tilt = acts.smashMod ? 1 : Math.min(1, 0.44 + c._rampT * 0.07);
        const ax = rawX === 0 ? 0 : rawX * tilt;
        if (this.tapJump && ay > 0.5) acts.jump = acts.jump || this._tapEdge(dev, ay);
        c.apply(ax, ay, acts, true);
        // A keyboard is digital, so *every* direction press looks like a flick and
        // you'd get a smash attack every time you tapped down. On keys, smash
        // attacks come from the modifier instead — tilts stay tilts.
        if (!acts.smashMod) { c.smashX = 0; c.smashY = 0; }
      } else if (dev && dev.startsWith('pad')) {
        const gp = pads[+dev.slice(3)];
        if (!gp) { c.apply(0, 0, {}, false); continue; }
        const axes = gp.axes || [];
        const btn = (i2) => !!gp.buttons[i2]?.pressed;
        const val = (i2) => gp.buttons[i2]?.value ?? (btn(i2) ? 1 : 0);
        let ax = Math.abs(axes[0] || 0) > DEAD ? axes[0] : 0;
        let ay = Math.abs(axes[1] || 0) > DEAD ? -axes[1] : 0;
        if (btn(BTN.LEFT)) ax = -1;
        if (btn(BTN.RIGHT)) ax = 1;
        if (btn(BTN.UP)) ay = 1;
        if (btn(BTN.DOWN)) ay = -1;
        const acts = {
          attack: btn(BTN.CROSS),
          special: btn(BTN.CIRCLE),
          jump: btn(BTN.SQUARE) || btn(BTN.TRIANGLE),
          shield: val(BTN.L2) > 0.35 || val(BTN.R2) > 0.35 || btn(BTN.L1),
          grab: btn(BTN.R1),
          taunt: btn(BTN.SHARE),
          start: btn(BTN.OPTIONS),
          smashMod: false,
        };
        c.apply(ax, ay, acts, true);
        // right stick = C-stick smash attacks
        const rx = Math.abs(axes[2] || 0) > 0.62 ? Math.sign(axes[2]) : 0;
        const ry = Math.abs(axes[3] || 0) > 0.62 ? -Math.sign(axes[3]) : 0;
        c.cstick = rx;
        c.cstickY = rx ? 0 : ry;
        if (rx || ry) this.lastDeviceKind = 'pad';
        if (Object.values(acts).some(Boolean)) this.lastDeviceKind = 'pad';
      } else {
        // CPU or unassigned: leave whatever the AI wrote, but keep edges honest
        if (!(c instanceof VirtualControls)) c.apply(0, 0, {}, false);
      }
    }
    this._pollMenu(pads);
    this.latch.clear();
  }

  /** Menu navigation, merged across every device (any pad, both keyboards). */
  _pollMenu(pads) {
    const m = this._menu;
    for (const k in m) m[k] = false;
    this._menuBy = [];
    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
    const push = (idx, dir, keyId) => {
      const held = this._navHeld[keyId];
      const at = this._navAt[keyId] || 0;
      const fresh = !held || now - at > (this._navRepeat?.[keyId] ? 130 : 300);
      if (fresh) {
        this._navAt[keyId] = now;
        this._navRepeat = this._navRepeat || {};
        this._navRepeat[keyId] = !!held;
        m[dir] = true;
        this._menuBy.push({ player: idx, dir });
      }
      this._navHeld[keyId] = true;
    };
    const clear = (keyId) => { this._navHeld[keyId] = false; this._navAt[keyId] = 0; if (this._navRepeat) this._navRepeat[keyId] = false; };

    const feed = (idx, ax, ay, acts, tag) => {
      const dirs = [['left', ax < -0.55], ['right', ax > 0.55], ['up', ay > 0.55], ['down', ay < -0.55]];
      for (const [dir, on] of dirs) {
        const id = `${tag}:${dir}`;
        if (on) push(idx, dir, id); else clear(id);
      }
      for (const [act, key] of [['attack', 'confirm'], ['jump', 'confirm'], ['special', 'back'], ['shield', 'back'], ['start', 'start']]) {
        const id = `${tag}:${key}:${act}`;
        if (acts[act]) {
          if (!this._navHeld[id]) { m[key] = true; this._menuBy.push({ player: idx, dir: key }); }
          this._navHeld[id] = true;
        } else this._navHeld[id] = false;
      }
    };

    for (const [tag, map, idx] of [['kb1', KB1, 0], ['kb2', KB2, 1]]) {
      const ax = (this.keyDown(map.right) ? 1 : 0) - (this.keyDown(map.left) ? 1 : 0);
      const ay = (this.keyDown(map.up) ? 1 : 0) - (this.keyDown(map.down) ? 1 : 0);
      const acts = {
        attack: this.keyDown(map.attack) || this.keyDown(map.jump) || (tag === 'kb1' && this.keys.has('Enter')),
        jump: false, special: this.keyDown(map.special), shield: false, start: this.keyDown(map.start),
      };
      feed(idx, ax, ay, acts, tag);
    }
    for (let i = 0; i < pads.length; i++) {
      const gp = pads[i];
      const axes = gp.axes || [];
      const btn = (b) => !!gp.buttons[b]?.pressed;
      let ax = Math.abs(axes[0] || 0) > 0.5 ? axes[0] : 0;
      let ay = Math.abs(axes[1] || 0) > 0.5 ? -axes[1] : 0;
      if (btn(BTN.LEFT)) ax = -1;
      if (btn(BTN.RIGHT)) ax = 1;
      if (btn(BTN.UP)) ay = 1;
      if (btn(BTN.DOWN)) ay = -1;
      const owner = this.assign.indexOf(`pad${i}`);
      feed(owner < 0 ? i : owner, ax, ay, {
        attack: btn(BTN.CROSS), jump: btn(BTN.SQUARE) || btn(BTN.TRIANGLE),
        special: btn(BTN.CIRCLE), shield: btn(BTN.L1), start: btn(BTN.OPTIONS),
      }, `pad${i}`);
      if (btn(BTN.CROSS) || btn(BTN.CIRCLE) || ax || ay) this.lastDeviceKind = 'pad';
    }
    m.any = m.up || m.down || m.left || m.right || m.confirm || m.back || m.start;
  }

  /** Menu edges this frame, merged across devices. */
  menu() { return this._menu; }
  /** Which player caused each menu edge — character select needs this. */
  menuEvents() { return this._menuBy; }
  player(i) { return this.players[i]; }

  /** Swap a player's Controls for a CPU stand-in (or back to hardware). */
  setVirtual(i, virtual) {
    if (virtual) {
      if (!(this.players[i] instanceof VirtualControls)) this.players[i] = new VirtualControls();
      this.assign[i] = 'cpu';
    } else if (this.players[i] instanceof VirtualControls) {
      this.players[i] = new Controls(`P${i + 1}`);
    }
    return this.players[i];
  }
}

// keys we own while the game is focused (stop the page from scrolling)
const SWALLOW = new Set([
  'Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
  'Numpad0', 'Numpad1', 'Numpad2', 'Numpad3', 'Numpad4', 'Numpad5', 'NumpadDecimal', 'Slash', 'Quote',
]);

/** Human-readable control sheet, used by the pause menu and the CONTROLS screen. */
export const CONTROL_SHEET = {
  pad: [
    ['LEFT STICK / D-PAD', 'move · flick for smash attacks · down to crouch'],
    ['✕ / A', 'attack — tilt, smash, aerial, dash attack'],
    ['◯ / B', 'special — neutral, side, up (recovery), down'],
    ['□ △ / X Y', 'jump (twice for a double jump)'],
    ['L2 R2 / LT RT', 'shield — tap with a direction to roll, down to spot-dodge'],
    ['R1 / RB', 'grab — then ✕ to pummel, a direction to throw'],
    ['RIGHT STICK', 'smash attacks straight from the stick'],
    ['SHARE / BACK', 'taunt'],
    ['OPTIONS / START', 'pause'],
  ],
  kb1: [
    ['W A S D', 'move — tap to walk, hold to run, hold DOWN in the air to fast-fall'],
    ['SPACE', 'jump (twice for a double jump)'],
    ['J', 'attack — with a direction for tilts, in the air for aerials'],
    ['K', 'special — with a direction for side/up/down'],
    ['L', 'shield — plus a direction to roll, plus DOWN to spot-dodge'],
    ['SHIFT + DIR + J', 'SMASH ATTACK — hold J to charge it'],
    ['H', 'grab'], ['T', 'taunt'], ['ESC', 'pause'],
  ],
  kb2: [
    ['ARROW KEYS', 'move — tap to walk, hold to run'],
    ['NUM 0 / R-SHIFT', 'jump'],
    ['NUM 1 / .', 'attack'], ['NUM 2 / /', 'special'], ['NUM 3 / R-CTRL', 'shield'],
    ['NUM . + DIR + 1', 'smash attack'],
    ['NUM 4 / \'', 'grab'], ['NUM 5', 'taunt'], ['ENTER', 'pause'],
  ],
};
