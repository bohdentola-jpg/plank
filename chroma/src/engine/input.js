// Keyboard + mouse (pointer lock) + gamepad, merged into game "actions".
const PAD = { A: 0, B: 1, X: 2, Y: 3, LB: 4, RB: 5, LT: 6, RT: 7, BACK: 8, START: 9, LS: 10, RS: 11, UP: 12, DOWN: 13, LEFT: 14, RIGHT: 15 };

export class Input {
  constructor(el) {
    this.el = el;
    this.keys = new Set();
    this.pressedKeys = new Set();
    this.mouse = [false, false, false];
    this.mousePressed = [false, false, false];
    this.mdx = 0; this.mdy = 0; this.wheel = 0;
    this.locked = false;
    this.lockedAt = 0;
    this.sensitivity = 1;
    this.invertY = false;
    this.pad = null;
    this.padButtons = [];
    this.padPrev = [];
    this.usingPad = false;
    this.onLockChange = null;
    this.enabled = true;

    addEventListener('keydown', (e) => {
      if (e.repeat) { if (this.capture(e)) e.preventDefault(); return; }
      this.keys.add(e.code);
      this.pressedKeys.add(e.code);
      this.usingPad = false;
      if (this.capture(e)) e.preventDefault();
    });
    addEventListener('keyup', (e) => { this.keys.delete(e.code); });
    addEventListener('blur', () => { this.keys.clear(); this.mouse = [false, false, false]; });
    el.addEventListener('mousedown', (e) => {
      if (e.button < 3) { this.mouse[e.button] = true; this.mousePressed[e.button] = true; }
      this.usingPad = false;
    });
    addEventListener('mouseup', (e) => { if (e.button < 3) this.mouse[e.button] = false; });
    el.addEventListener('contextmenu', (e) => e.preventDefault());
    addEventListener('mousemove', (e) => {
      if (!this.locked) return;
      // drop the spurious giant deltas some browsers emit right after locking
      if (performance.now() - this.lockedAt < 120 || Math.abs(e.movementX) > 400 || Math.abs(e.movementY) > 400) return;
      this.mdx += e.movementX; this.mdy += e.movementY;
    });
    el.addEventListener('wheel', (e) => { this.wheel += Math.sign(e.deltaY); }, { passive: true });
    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === this.el;
      if (this.locked) this.lockedAt = performance.now();
      if (!this.locked) this.mouse = [false, false, false];
      const self = this.selfUnlock;
      this.selfUnlock = false;
      this.onLockChange?.(this.locked, self);
    });
  }

  capture(e) {
    return ['Space', 'Tab', 'ShiftLeft', 'ShiftRight', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)
      && !(e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA'));
  }

  lock() {
    if (this.locked) return;
    try { const p = this.el.requestPointerLock?.(); if (p && p.catch) p.catch(() => {}); } catch { /* ignore */ }
  }
  unlock() { if (document.pointerLockElement) { this.selfUnlock = true; document.exitPointerLock(); } }

  poll() {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    this.pad = null;
    for (const p of pads) if (p && p.connected) { this.pad = p; break; }
    this.padPrev = this.padButtons;
    this.padButtons = this.pad ? this.pad.buttons.map((b) => b.pressed || b.value > 0.4) : [];
    if (this.pad) {
      const ax = this.pad.axes;
      if (this.padButtons.some((b) => b) || ax.some((a) => Math.abs(a) > 0.35)) this.usingPad = true;
    }
  }

  endFrame() {
    this.pressedKeys.clear();
    this.mousePressed = [false, false, false];
    this.mdx = 0; this.mdy = 0; this.wheel = 0;
  }

  down(code) { return this.enabled && this.keys.has(code); }
  pressed(code) { return this.enabled && this.pressedKeys.has(code); }
  padDown(i) { return this.enabled && !!this.padButtons[i]; }
  padPressed(i) { return this.enabled && !!this.padButtons[i] && !this.padPrev[i]; }
  axis(i) {
    if (!this.pad || !this.enabled) return 0;
    const v = this.pad.axes[i] || 0;
    const dz = 0.16;
    return Math.abs(v) < dz ? 0 : Math.sign(v) * (Math.abs(v) - dz) / (1 - dz);
  }

  // Movement vector in local space: x = strafe right, y = forward
  move() {
    let x = 0, y = 0;
    if (this.down('KeyW') || this.down('ArrowUp')) y += 1;
    if (this.down('KeyS') || this.down('ArrowDown')) y -= 1;
    if (this.down('KeyD') || this.down('ArrowRight')) x += 1;
    if (this.down('KeyA') || this.down('ArrowLeft')) x -= 1;
    const px = this.axis(0), py = -this.axis(1);
    if (Math.abs(px) + Math.abs(py) > Math.abs(x) + Math.abs(y)) { x = px; y = py; }
    const l = Math.hypot(x, y);
    if (l > 1) { x /= l; y /= l; }
    return { x, y };
  }

  // Look delta in radians for this frame
  look(dt) {
    let dx = this.mdx * 0.0024 * this.sensitivity;
    let dy = this.mdy * 0.0024 * this.sensitivity;
    const rx = this.axis(2), ry = this.axis(3);
    if (rx || ry) {
      const curve = (v) => Math.sign(v) * Math.pow(Math.abs(v), 1.6);
      dx += curve(rx) * 3.4 * dt * this.sensitivity;
      dy += curve(ry) * 2.4 * dt * this.sensitivity;
    }
    if (this.invertY) dy = -dy;
    return { dx, dy };
  }

  action(name) {
    switch (name) {
      case 'fire': return this.mouse[0] && this.locked || this.padDown(PAD.RT);
      case 'sub': return (this.mousePressed[2] && this.locked) || this.padPressed(PAD.RB);
      case 'goo': return this.down('ShiftLeft') || this.down('ShiftRight') || this.padDown(PAD.LT);
      case 'jump': return this.pressed('Space') || this.padPressed(PAD.A);
      case 'jumpHeld': return this.down('Space') || this.padDown(PAD.A);
      case 'special': return this.pressed('KeyQ') || this.pressed('KeyE') || this.padPressed(PAD.Y) || this.padPressed(PAD.RS);
      case 'interact': return this.pressed('KeyE') || this.pressed('Enter') || this.padPressed(PAD.X);
      case 'map': return this.down('Tab') || this.padDown(PAD.BACK);
      case 'pause': return this.pressed('Escape') || this.padPressed(PAD.START);
      case 'confirm': return this.pressed('Enter') || this.pressed('Space') || this.padPressed(PAD.A);
      case 'back': return this.pressed('Escape') || this.pressed('Backspace') || this.padPressed(PAD.B);
      case 'up': return this.pressed('ArrowUp') || this.pressed('KeyW') || this.padPressed(PAD.UP);
      case 'down': return this.pressed('ArrowDown') || this.pressed('KeyS') || this.padPressed(PAD.DOWN);
      case 'left': return this.pressed('ArrowLeft') || this.pressed('KeyA') || this.padPressed(PAD.LEFT);
      case 'right': return this.pressed('ArrowRight') || this.pressed('KeyD') || this.padPressed(PAD.RIGHT);
      default: return false;
    }
  }
}
export { PAD };
