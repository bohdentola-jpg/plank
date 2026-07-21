// Gamepad input (PS5 DualSense, Xbox, anything with a standard mapping),
// with support for TWO pads so VERSUS works couch-style.
// Poll once per frame; exposes left stick, triggers, and button press edges.
//
// Standard mapping: 0=✕ 1=◯ 2=□ 3=△ 4=L1 5=R1 6=L2 7=R2 9=options
// 12=up 13=down 14=left 15=right
export const BTN = {
  CROSS: 0, CIRCLE: 1, SQUARE: 2, TRIANGLE: 3,
  L1: 4, R1: 5, L2: 6, R2: 7, OPTIONS: 9,
  UP: 12, DOWN: 13, LEFT: 14, RIGHT: 15,
};

const DEADZONE = 0.18;

class PadState {
  constructor() {
    this.connected = false;
    this.justConnected = false;
    this.lx = 0;
    this.ly = 0;
    this.r2 = 0;
    this.l2 = 0;
    this.edges = [];
    this._prev = [];
    this._seen = false;
  }

  down(i) { return !!this._prev[i]; }

  read(gp) {
    this.edges.length = 0;
    this.justConnected = false;
    if (!gp) {
      this.connected = false;
      this.lx = this.ly = this.r2 = this.l2 = 0;
      this._prev.length = 0;
      return;
    }
    if (!this._seen) { this._seen = true; this.justConnected = true; }
    this.connected = true;
    const ax = gp.axes || [];
    this.lx = Math.abs(ax[0] || 0) > DEADZONE ? ax[0] : 0;
    this.ly = Math.abs(ax[1] || 0) > DEADZONE ? ax[1] : 0;
    this.r2 = gp.buttons[BTN.R2]?.value || (gp.buttons[BTN.R2]?.pressed ? 1 : 0);
    this.l2 = gp.buttons[BTN.L2]?.value || (gp.buttons[BTN.L2]?.pressed ? 1 : 0);
    for (let i = 0; i < gp.buttons.length; i++) {
      const pressed = !!gp.buttons[i]?.pressed;
      if (pressed && !this._prev[i]) this.edges.push(i);
      this._prev[i] = pressed;
    }
  }
}

/** All pads. poll() once per frame; pads[0] is P1's controller, pads[1] P2's. */
export class Pads {
  constructor() {
    this.pads = [new PadState(), new PadState()];
    this.count = 0;
  }

  poll() {
    let found = [];
    try {
      const gps = navigator.getGamepads ? navigator.getGamepads() : [];
      for (const g of gps) {
        if (g && g.connected) found.push(g);
      }
    } catch { /* no gamepad API */ }
    this.count = found.length;
    this.pads[0].read(found[0] || null);
    this.pads[1].read(found[1] || null);
  }

  get p1() { return this.pads[0]; }
  get p2() { return this.pads[1]; }

  /** Any button edge on any pad (boot screens). */
  anyEdge() { return this.pads.some((p) => p.edges.length > 0); }
}

export const pads = new Pads();

// ------------------------------------------------------------------ padui shim
// PadUI (menus) keeps its own one-pad view with independent edge state, so
// menu presses and in-game presses never eat each other's button edges.
let announcedOnce = false;
export function padAnnounced() { return announcedOnce; }
export function markPadAnnounced() { announcedOnce = true; }

export class PadInput extends PadState {
  poll() {
    let gp = null;
    try {
      const gps = navigator.getGamepads ? navigator.getGamepads() : [];
      for (const g of gps) {
        if (g && g.connected) { gp = g; break; }
      }
    } catch { /* no gamepad API */ }
    this.read(gp);
  }
}
