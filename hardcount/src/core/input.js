// Unified input: keyboard + up to two gamepads (PS5 DualSense first; Xbox and
// anything with a standard mapping too; the raw DualSense mapping on Firefox).
//
// Two layers:
//  - MENU actions (edges with auto-repeat): up down left right confirm back
//    tabL tabR alt extra pause any — input.pressed('confirm') etc. Every pad
//    and the keyboard drive the menus.
//  - PAD buttons for play, per player (P1 = keyboard + first pad, P2 = the
//    second pad): pl.down('cross'), pl.pressed('r1'), pl.released('square'),
//    pl.heldFor('cross') seconds, analog sticks pl.lx/ly/rx/ry, triggers
//    pl.l2/pl.r2 (0..1), right-stick flicks pl.flick ('up'|'down'|'left'|'right').
//
// DualSense (standard mapping): 0 ✕  1 ◯  2 □  3 △  4 L1  5 R1  6 L2  7 R2
//   8 CREATE  9 OPTIONS  10 L3  11 R3  12-15 d-pad  16 PS  17 touchpad
//
// Keyboard for play (P1): WASD move · arrows = right stick (flicks) ·
//   K or SPACE = ✕ · L = ◯ · J = □ · I = △ (the face buttons as a diamond)
//   Q = L1 · E = R1 · Z = L2 · SHIFT = R2 · R = CREATE · ESC/P = OPTIONS ·
//   T = touchpad · C = L3 · V = R3 · 1-4 also = ✕ □ ◯ △ (receivers)
import { clamp } from './util.js';

export const BUTTONS = [
  'cross', 'circle', 'square', 'triangle', 'l1', 'r1', 'l2', 'r2',
  'create', 'options', 'l3', 'r3', 'dup', 'ddown', 'dleft', 'dright', 'ps', 'touch',
];
const BI = Object.fromEntries(BUTTONS.map((b, i) => [b, i]));

export const ACTIONS = ['up', 'down', 'left', 'right', 'confirm', 'back', 'tabL', 'tabR', 'alt', 'extra', 'pause', 'any'];

// keyboard → menu actions
const KEY_MENU = {
  ArrowUp: ['up'], KeyW: ['up'],
  ArrowDown: ['down'], KeyS: ['down'],
  ArrowLeft: ['left'], KeyA: ['left'],
  ArrowRight: ['right'], KeyD: ['right'],
  Enter: ['confirm'], Space: ['confirm'], NumpadEnter: ['confirm'], KeyK: ['confirm'],
  Escape: ['back', 'pause'], Backspace: ['back'], KeyL: ['back'],
  KeyQ: ['tabL'], KeyE: ['tabR'],
  KeyI: ['alt'], KeyF: ['alt'], KeyJ: ['extra'], KeyX: ['extra'], Tab: ['extra'],
  KeyP: ['pause'],
};

// keyboard → pad buttons (player 1)
const KEY_BTN = {
  Space: 'cross', KeyK: 'cross', Digit1: 'cross', Enter: 'cross',
  KeyL: 'circle', Digit3: 'circle',
  KeyJ: 'square', Digit2: 'square',
  KeyI: 'triangle', Digit4: 'triangle',
  KeyQ: 'l1', KeyE: 'r1', KeyZ: 'l2', ShiftLeft: 'r2', ShiftRight: 'r2',
  KeyR: 'create', Escape: 'options', KeyP: 'options', KeyT: 'touch',
  KeyC: 'l3', KeyV: 'r3',
};

// pad button index → menu actions
const PAD_MENU = {
  0: ['confirm'], 1: ['back'], 2: ['extra'], 3: ['alt'],
  4: ['tabL'], 5: ['tabR'], 9: ['pause'],
  12: ['up'], 13: ['down'], 14: ['left'], 15: ['right'],
};

// Firefox / raw DualSense (vendor 054c) button index → standard index
const RAW_DS = { 0: 2, 1: 0, 2: 1, 3: 3, 4: 4, 5: 5, 6: 6, 7: 7, 8: 8, 9: 9, 10: 10, 11: 11, 12: 16, 13: 17 };

const DEAD = 0.14;

function shapeAxis(v) {
  const a = Math.abs(v);
  if (a < DEAD) return 0;
  return Math.sign(v) * Math.min(1, (a - DEAD) / (1 - DEAD));
}

/** One person's controller state (P1 merges the keyboard in). */
class Player {
  constructor(index) {
    this.index = index;
    this.pad = null;
    this.padId = '';
    this.connected = false;
    this.btn = new Array(BUTTONS.length).fill(false);
    this.prev = new Array(BUTTONS.length).fill(false);
    this.downAt = new Array(BUTTONS.length).fill(0);
    this.heldT = new Array(BUTTONS.length).fill(0);
    this.lastHeld = new Array(BUTTONS.length).fill(0); // how long it was held when released
    this.lx = 0; this.ly = 0; this.rx = 0; this.ry = 0;
    this.l2 = 0; this.r2 = 0;
    this.flick = null;
    this._rsCentered = true;
    this._rsT = 0;
    this.device = index === 0 ? 'keyboard' : 'pad';
  }
  down(b) { return this.btn[BI[b]]; }
  pressed(b) { const i = BI[b]; return this.btn[i] && !this.prev[i]; }
  released(b) { const i = BI[b]; return !this.btn[i] && this.prev[i]; }
  /** Seconds the button has been down (0 when up). */
  heldFor(b) { return this.btn[BI[b]] ? this.heldT[BI[b]] : 0; }
  /** On the release frame: how long it had been held. */
  releasedAfter(b) { return this.lastHeld[BI[b]]; }
  /** Left stick as a vector with magnitude 0..1. */
  get stick() { return { x: this.lx, y: this.ly, mag: Math.min(1, Math.hypot(this.lx, this.ly)) }; }
  consume(b) { const i = BI[b]; this.prev[i] = this.btn[i]; }
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
    this.padEvent = null;
    this.players = [new Player(0), new Player(1)];
    this._prevPadBtn = [[], []];
    this._repeat = {};
    this._click = false;
    this.mouse = { x: 0, y: 0, down: false, moved: false, wheel: 0, dx: 0, dy: 0 };
    this._dxAcc = 0;
    this._dyAcc = 0;
    this.enabled = true;
    this.settingsRumble = true;
    this._kbRs = { x: 0, y: 0 };

    window.addEventListener('keydown', (e) => {
      if (e.repeat) { if (KEY_MENU[e.code] || KEY_BTN[e.code]) e.preventDefault(); return; }
      this.keys.add(e.code);
      this._pendingKeys.push(e.code);
      this.device = 'keyboard';
      this.players[0].device = 'keyboard';
      if (KEY_MENU[e.code] || KEY_BTN[e.code] || e.code.startsWith('Arrow') || e.code === 'Space' || e.code === 'Tab') e.preventDefault();
    });
    window.addEventListener('keyup', (e) => { this.keys.delete(e.code); });
    window.addEventListener('blur', () => { this.keys.clear(); });
  }

  get p1() { return this.players[0]; }
  get p2() { return this.players[1]; }

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

  _pads() {
    const out = [];
    try {
      const list = navigator.getGamepads ? navigator.getGamepads() : [];
      for (const g of list) if (g && g.connected) out.push(g);
    } catch { /* no gamepad API */ }
    return out;
  }

  /** Read a gamepad into standard button booleans + axes. */
  _readPad(gp) {
    const raw = gp.mapping !== 'standard' && /054c/i.test(gp.id);
    const b = new Array(BUTTONS.length).fill(false);
    let l2 = 0, r2 = 0, axes;
    if (raw) {
      for (let i = 0; i < gp.buttons.length; i++) {
        const std = RAW_DS[i];
        if (std !== undefined) b[std] = !!gp.buttons[i].pressed;
      }
      const hat = gp.axes[9];
      if (hat !== undefined && hat < 1.1) {
        const dir = Math.round((hat + 1) * 3.5);
        b[12] = dir === 7 || dir === 0 || dir === 1;
        b[15] = dir >= 1 && dir <= 3;
        b[13] = dir >= 3 && dir <= 5;
        b[14] = dir >= 5 && dir <= 7;
      }
      l2 = gp.axes[3] !== undefined ? (gp.axes[3] + 1) / 2 : (b[6] ? 1 : 0);
      r2 = gp.axes[4] !== undefined ? (gp.axes[4] + 1) / 2 : (b[7] ? 1 : 0);
      axes = [gp.axes[0] || 0, gp.axes[1] || 0, gp.axes[2] || 0, gp.axes[5] || 0];
    } else {
      for (let i = 0; i < Math.min(gp.buttons.length, BUTTONS.length); i++) b[i] = !!gp.buttons[i]?.pressed;
      l2 = gp.buttons[6]?.value ?? (b[6] ? 1 : 0);
      r2 = gp.buttons[7]?.value ?? (b[7] ? 1 : 0);
      axes = [gp.axes[0] || 0, gp.axes[1] || 0, gp.axes[2] || 0, gp.axes[3] || 0];
    }
    // triggers count as pressed past a third of their travel
    b[6] = b[6] || l2 > 0.35;
    b[7] = b[7] || r2 > 0.35;
    return { b, l2, r2, axes };
  }

  /** Call once per frame before game logic. */
  update(dt) {
    this.edges.clear();
    this.mouse.dx = this._dxAcc; this.mouse.dy = this._dyAcc;
    this._dxAcc = 0; this._dyAcc = 0;

    // ---- pads → players
    const pads = this._pads();
    const wasConnected = this.padConnected;
    this.padConnected = pads.length > 0;
    this.padEvent = null;
    if (this.padConnected && !wasConnected) this.padEvent = 'new';
    if (!this.padConnected && wasConnected) this.padEvent = 'lost';
    this.pad = pads[0] || null;
    this.padId = pads[0]?.id || '';
    const reads = pads.slice(0, 2).map((gp) => this._readPad(gp));
    if (pads.length >= 2 && !this.players[1].connected) this.padEvent = this.padEvent || 'p2';

    // menu edges from every pad
    let padActive = false;
    reads.forEach((r, k) => {
      const prev = this._prevPadBtn[k] || [];
      for (let i = 0; i < r.b.length; i++) {
        if (r.b[i] && !prev[i]) {
          const acts = PAD_MENU[i];
          if (acts) for (const a of acts) this.edges.add(a);
          this.edges.add('any');
          padActive = true;
        }
      }
      this._prevPadBtn[k] = r.b.slice();
      if (Math.abs(r.axes[0]) > 0.3 || Math.abs(r.axes[1]) > 0.3 || r.r2 > 0.2 || r.l2 > 0.2) padActive = true;
    });
    for (let k = reads.length; k < 2; k++) this._prevPadBtn[k] = [];
    if (padActive) this.device = 'pad';

    // keyboard menu edges
    for (const code of this._pendingKeys) {
      const acts = KEY_MENU[code];
      if (acts) for (const a of acts) this.edges.add(a);
      this.edges.add('any');
    }

    // ---- per-player play state
    const k = this.keys;
    this.players.forEach((pl, idx) => {
      const r = reads[idx] || null;
      pl.pad = pads[idx] || null;
      pl.padId = pl.pad?.id || '';
      pl.connected = !!r;
      for (let i = 0; i < BUTTONS.length; i++) pl.prev[i] = pl.btn[i];
      const b = r ? r.b.slice() : new Array(BUTTONS.length).fill(false);
      let lx = r ? shapeAxis(r.axes[0]) : 0, ly = r ? shapeAxis(r.axes[1]) : 0;
      let rx = r ? shapeAxis(r.axes[2]) : 0, ry = r ? shapeAxis(r.axes[3]) : 0;
      let l2 = r ? r.l2 : 0, r2 = r ? r.r2 : 0;
      if (r && (Math.abs(lx) + Math.abs(ly) > 0.2 || r.b.some(Boolean))) pl.device = 'pad';
      if (idx === 0) {
        // keyboard merges into player 1
        for (const [code, name] of Object.entries(KEY_BTN)) if (k.has(code)) b[BI[name]] = true;
        const kx = (k.has('KeyD') ? 1 : 0) - (k.has('KeyA') ? 1 : 0);
        const ky = (k.has('KeyS') ? 1 : 0) - (k.has('KeyW') ? 1 : 0);
        if (kx || ky) {
          const m = Math.hypot(kx, ky);
          lx = kx / m; ly = ky / m;
          pl.device = 'keyboard';
        }
        const ax = (k.has('ArrowRight') ? 1 : 0) - (k.has('ArrowLeft') ? 1 : 0);
        const ay = (k.has('ArrowDown') ? 1 : 0) - (k.has('ArrowUp') ? 1 : 0);
        if (ax || ay) { rx = ax; ry = ay; }
        if (k.has('ShiftLeft') || k.has('ShiftRight')) r2 = 1;
        if (k.has('KeyZ')) l2 = 1;
      }
      // the d-pad also moves when the stick is idle (menus, pre-snap)
      if (!lx && !ly) {
        const dx = (b[15] ? 1 : 0) - (b[14] ? 1 : 0), dy = (b[13] ? 1 : 0) - (b[12] ? 1 : 0);
        if (dx || dy) { const m = Math.hypot(dx, dy); lx = dx / m; ly = dy / m; pl.dpadMove = true; } else pl.dpadMove = false;
      } else pl.dpadMove = false;
      pl.lx = lx; pl.ly = ly; pl.rx = rx; pl.ry = ry; pl.l2 = l2; pl.r2 = r2;
      for (let i = 0; i < BUTTONS.length; i++) {
        pl.btn[i] = b[i];
        if (b[i]) {
          if (!pl.prev[i]) { pl.downAt[i] = performance.now(); pl.heldT[i] = 0; } else pl.heldT[i] += dt;
        } else if (pl.prev[i]) {
          pl.lastHeld[i] = pl.heldT[i];
          pl.heldT[i] = 0;
        }
      }
      // right-stick flick: from the middle to the rim within a short window
      pl.flick = null;
      const rm = Math.hypot(rx, ry);
      if (rm < 0.3) { pl._rsCentered = true; pl._rsT = 0; } else if (pl._rsCentered) {
        pl._rsT += dt;
        if (rm > 0.72) {
          pl._rsCentered = false;
          if (pl._rsT < 0.25) {
            pl.flick = Math.abs(rx) > Math.abs(ry) ? (rx > 0 ? 'right' : 'left') : (ry > 0 ? 'down' : 'up');
          }
        } else if (pl._rsT > 0.25) pl._rsCentered = false;
      }
    });
    this._pendingKeys.length = 0;

    // ---- menu directions: left stick + d-pad + keys with auto-repeat
    const p1 = this.players[0], p2 = this.players[1];
    const sx = Math.abs(p1.lx) > Math.abs(p2.lx) ? p1.lx : p2.lx;
    const sy = Math.abs(p1.ly) > Math.abs(p2.ly) ? p1.ly : p2.ly;
    const anyBtn = (i) => p1.btn[i] || p2.btn[i];
    const dirs = {
      up: sy < -0.55 || anyBtn(12) || k.has('ArrowUp') || k.has('KeyW'),
      down: sy > 0.55 || anyBtn(13) || k.has('ArrowDown') || k.has('KeyS'),
      left: sx < -0.55 || anyBtn(14) || k.has('ArrowLeft') || k.has('KeyA'),
      right: sx > 0.55 || anyBtn(15) || k.has('ArrowRight') || k.has('KeyD'),
    };
    for (const [d, held] of Object.entries(dirs)) {
      const r = this._repeat[d] || (this._repeat[d] = { t: 0, held: false });
      if (held) {
        if (!r.held) {
          r.held = true;
          r.t = 0.38;
          // keys and the d-pad already made an edge; the stick makes its own
          const viaStick = (d === 'up' && sy < -0.55) || (d === 'down' && sy > 0.55) || (d === 'left' && sx < -0.55) || (d === 'right' && sx > 0.55);
          if (viaStick && !p1.dpadMove && !p2.dpadMove) this.edges.add(d);
        } else {
          r.t -= dt;
          if (r.t <= 0) { this.edges.add(d); this.edges.add(d + 'Repeat'); r.t = 0.075; }
        }
      } else {
        r.held = false;
      }
    }
  }

  /** True on the frame a menu action started. */
  pressed(action) { return this.enabled && this.edges.has(action); }

  /** Consume an edge so a later reader in the same frame doesn't also see it. */
  consume(action) { this.edges.delete(action); }

  clearEdges() {
    this.edges.clear();
    for (const pl of this.players) for (let i = 0; i < BUTTONS.length; i++) pl.prev[i] = pl.btn[i];
  }

  takeClick() {
    const c = this._click;
    this._click = false;
    return c;
  }

  /** DualSense rumble: strong = low-frequency motor, weak = high. */
  rumble(strong = 0.5, weak = 0.5, ms = 120, player = 0) {
    const pad = this.players[player]?.pad || (player === 0 ? this.pad : null);
    const a = pad?.vibrationActuator;
    if (!a || !this.settingsRumble) return;
    try {
      a.playEffect?.('dual-rumble', { duration: ms, strongMagnitude: clamp(strong, 0, 1), weakMagnitude: clamp(weak, 0, 1) });
    } catch { /* unsupported */ }
  }
}

export const input = new Input();
