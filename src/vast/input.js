// Unified input: keyboard + pointer-lock mouse + standard gamepad, merged
// into one state object the player controller reads. Edge-triggered actions
// (jump, interact, map…) are collected as `pressed` flags cleared each frame.

export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.keys = new Set();
    this.pressed = new Set();   // cleared by consume() each frame
    this.lookDX = 0; this.lookDY = 0;
    this.wheel = 0;
    this.padIndex = -1;
    this.padWas = [];
    this.onAnyKey = null;
    this.locked = false;

    addEventListener('keydown', (e) => {
      if (e.repeat) return;
      this.keys.add(e.code);
      this.pressed.add(e.code);
      if (this.onAnyKey) this.onAnyKey(e);
      if (['Space', 'Tab', 'KeyM', 'KeyJ'].includes(e.code)) e.preventDefault();
    });
    addEventListener('keyup', (e) => this.keys.delete(e.code));
    addEventListener('blur', () => this.keys.clear());

    document.addEventListener('mousemove', (e) => {
      if (this.locked) {
        this.lookDX += e.movementX;
        this.lookDY += e.movementY;
      }
    });
    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === this.canvas;
    });
    addEventListener('wheel', (e) => { this.wheel += Math.sign(e.deltaY); }, { passive: true });

    addEventListener('gamepadconnected', (e) => {
      this.padIndex = e.gamepad.index;
      if (this.onPad) this.onPad(e.gamepad.id);
    });
    addEventListener('gamepaddisconnected', (e) => {
      if (e.gamepad.index === this.padIndex) this.padIndex = -1;
    });
  }

  requestLock() {
    if (!this.locked && this.canvas.requestPointerLock) {
      try { this.canvas.requestPointerLock(); } catch { /* user gesture rules */ }
    }
  }
  releaseLock() {
    if (this.locked && document.exitPointerLock) document.exitPointerLock();
  }

  // gamepad edge helper
  _padPressed(pad, i) {
    const down = pad.buttons[i] && pad.buttons[i].pressed;
    const was = this.padWas[i];
    this.padWas[i] = down;
    return down && !was;
  }

  // Returns the merged frame state; call once per frame.
  poll() {
    const k = this.keys;
    const dz = (v) => (Math.abs(v) < 0.16 ? 0 : v);
    let mx = (k.has('KeyD') ? 1 : 0) - (k.has('KeyA') ? 1 : 0);
    let mz = (k.has('KeyS') ? 1 : 0) - (k.has('KeyW') ? 1 : 0);
    let lx = 0, ly = 0;
    let sprint = k.has('ShiftLeft') || k.has('ShiftRight');
    const state = {
      jump: this.pressed.has('Space'),
      interact: this.pressed.has('KeyE'),
      whistle: this.pressed.has('KeyH'),
      map: this.pressed.has('KeyM'),
      journal: this.pressed.has('Tab') || this.pressed.has('KeyJ'),
      pause: this.pressed.has('Escape'),
      mute: this.pressed.has('KeyX'),
      help: this.pressed.has('F1') || this.pressed.has('Slash'),
    };

    if (this.padIndex >= 0) {
      const pad = navigator.getGamepads && navigator.getGamepads()[this.padIndex];
      if (pad) {
        mx += dz(pad.axes[0] || 0);
        mz += dz(pad.axes[1] || 0);
        lx = dz(pad.axes[2] || 0) * 22;
        ly = dz(pad.axes[3] || 0) * 18;
        if (this._padPressed(pad, 0)) state.jump = true;        // ✕ / A
        if (this._padPressed(pad, 2)) state.interact = true;    // □ / X
        if (this._padPressed(pad, 3)) state.map = true;         // △ / Y
        if (this._padPressed(pad, 1)) state.whistle = true;     // ◯ / B
        if (this._padPressed(pad, 9)) state.pause = true;       // options
        if (this._padPressed(pad, 8)) state.journal = true;     // share/back
        if (pad.buttons[7] && pad.buttons[7].value > 0.4) sprint = true; // R2
        if (pad.buttons[5] && pad.buttons[5].pressed) sprint = true;     // R1
      }
    }

    const len = Math.hypot(mx, mz);
    if (len > 1) { mx /= len; mz /= len; }
    state.moveX = mx;
    state.moveZ = mz;
    state.sprint = sprint;
    state.lookDX = this.lookDX + lx;
    state.lookDY = this.lookDY + ly;
    state.wheel = this.wheel;
    this.lookDX = 0; this.lookDY = 0; this.wheel = 0;
    this.pressed.clear();
    return state;
  }
}
