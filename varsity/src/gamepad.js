// Gamepad input (PS5 DualSense, Xbox, anything with a standard mapping).
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
let announcedOnce = false;
export function padAnnounced() { return announcedOnce; }
export function markPadAnnounced() { announcedOnce = true; }

export class PadInput {
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

  poll() {
    this.edges.length = 0;
    this.justConnected = false;
    let gp = null;
    try {
      const gps = navigator.getGamepads ? navigator.getGamepads() : [];
      for (const g of gps) {
        if (g && g.connected) { gp = g; break; }
      }
    } catch { /* no gamepad API */ }
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

/** Receiver icon glyphs in target order 1-4 (matches the throw buttons). */
export const PAD_GLYPHS = ['□', '✕', '◯', '△'];
/** Button index that throws to target i (0-based). */
export const THROW_BUTTONS = [BTN.SQUARE, BTN.CROSS, BTN.CIRCLE, BTN.TRIANGLE];
