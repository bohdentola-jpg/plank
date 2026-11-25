// Keyboard + mouse (pointer lock, with a drag-to-look fallback) and touch
// controls (virtual stick, drag-look, buttons). Produces one input state.
export class Input {
  constructor(canvas, { touch }) {
    this.canvas = canvas;
    this.touch = touch;
    this.keys = new Set();
    this.move = { x: 0, y: 0 };
    this.look = { dx: 0, dy: 0 };
    this.edges = new Set();
    this.locked = false;
    this.dragLook = false;
    this.mouseDown = false;
    this.rmb = false;
    this.sens = 0.0022;
    this.touchState = { stick: null, look: null, breath: false, run: false };
    this.enabled = false;
    this.onPauseRequest = null;

    window.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      this.keys.add(e.code);
      this.edges.add(e.code);
      if (['Space', 'Tab', 'ControlLeft'].includes(e.code)) e.preventDefault();
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => this.keys.clear());
    document.addEventListener('pointerlockchange', () => {
      const was = this.locked;
      this.locked = document.pointerLockElement === canvas;
      if (was && !this.locked && this.enabled && !this.dragLook && this.onPauseRequest) this.onPauseRequest();
    });
    window.addEventListener('mousemove', (e) => {
      if (!this.enabled) return;
      if (this.locked || (this.dragLook && this.mouseDown)) {
        this.look.dx += e.movementX || 0;
        this.look.dy += e.movementY || 0;
      }
    });
    canvas.addEventListener('mousedown', (e) => {
      if (e.button === 2) this.rmb = true;
      else this.mouseDown = true;
    });
    window.addEventListener('mouseup', (e) => {
      if (e.button === 2) this.rmb = false;
      else this.mouseDown = false;
    });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    if (touch) this.setupTouch();
  }

  requestLock() {
    if (this.touch) return;
    try {
      const p = this.canvas.requestPointerLock && this.canvas.requestPointerLock();
      if (p && p.catch) p.catch(() => (this.dragLook = true));
    } catch {
      this.dragLook = true;
    }
    // if the frame refuses pointer lock, fall back to click-drag look
    setTimeout(() => {
      if (!this.locked) this.dragLook = true;
    }, 600);
  }

  pressed(code) {
    if (this.edges.has(code)) {
      this.edges.delete(code);
      return true;
    }
    return false;
  }

  // Called once per frame by the game.
  read() {
    const k = this.keys;
    let x = 0, y = 0;
    if (k.has('KeyW') || k.has('ArrowUp')) y += 1;
    if (k.has('KeyS') || k.has('ArrowDown')) y -= 1;
    if (k.has('KeyA') || k.has('ArrowLeft')) x -= 1;
    if (k.has('KeyD') || k.has('ArrowRight')) x += 1;
    const ts = this.touchState;
    if (ts.stick) {
      x = ts.stick.x;
      y = ts.stick.y;
    }
    const len = Math.hypot(x, y);
    if (len > 1) { x /= len; y /= len; }
    const out = {
      x, y,
      dx: this.look.dx * this.sens,
      dy: this.look.dy * this.sens,
      sprint: k.has('ShiftLeft') || k.has('ShiftRight') || ts.run,
      breath: k.has('Space') || this.rmb || ts.breath,
      interact: this.pressed('KeyE') || this.pressed('touchUse'),
      crouch: this.pressed('KeyC') || this.pressed('ControlLeft') || this.pressed('touchCrouch'),
      flashlight: this.pressed('KeyF') || this.pressed('touchLight'),
      mute: this.pressed('KeyM'),
      pause: this.pressed('Escape') || this.pressed('KeyP') || this.pressed('touchPause'),
    };
    this.look.dx = 0;
    this.look.dy = 0;
    return out;
  }
  clearEdges() {
    this.edges.clear();
  }

  // ------------------------------------------------------------------ touch
  setupTouch() {
    const ts = this.touchState;
    const root = document.getElementById('touch');
    if (!root) return;
    const stickEl = document.getElementById('stick');
    const knob = document.getElementById('knob');
    const R = 56;
    const ids = { stick: null, look: null };
    const lookSens = 0.0048;
    const onStart = (e) => {
      for (const t of e.changedTouches) {
        const tgt = t.target.closest ? t.target.closest('[data-btn]') : null;
        if (tgt) continue;
        if (t.clientX < window.innerWidth * 0.45 && ids.stick === null) {
          ids.stick = t.identifier;
          ts.stick = { x: 0, y: 0, ox: t.clientX, oy: t.clientY };
          stickEl.style.left = t.clientX - 64 + 'px';
          stickEl.style.top = t.clientY - 64 + 'px';
          stickEl.classList.add('on');
          knob.style.transform = 'translate(0px,0px)';
        } else if (ids.look === null) {
          ids.look = t.identifier;
          ts.look = { x: t.clientX, y: t.clientY };
        }
      }
    };
    const onMove = (e) => {
      for (const t of e.changedTouches) {
        if (t.identifier === ids.stick && ts.stick) {
          let dx = t.clientX - ts.stick.ox, dy = t.clientY - ts.stick.oy;
          const l = Math.hypot(dx, dy);
          if (l > R) { dx = (dx / l) * R; dy = (dy / l) * R; }
          ts.stick.x = dx / R;
          ts.stick.y = -dy / R;
          knob.style.transform = `translate(${dx}px,${dy}px)`;
        } else if (t.identifier === ids.look && ts.look) {
          this.look.dx += ((t.clientX - ts.look.x) * lookSens) / this.sens;
          this.look.dy += ((t.clientY - ts.look.y) * lookSens) / this.sens;
          ts.look.x = t.clientX;
          ts.look.y = t.clientY;
        }
      }
      e.preventDefault();
    };
    const onEnd = (e) => {
      for (const t of e.changedTouches) {
        if (t.identifier === ids.stick) {
          ids.stick = null;
          ts.stick = null;
          stickEl.classList.remove('on');
        } else if (t.identifier === ids.look) {
          ids.look = null;
          ts.look = null;
        }
      }
    };
    const surface = document.getElementById('touch-surface');
    surface.addEventListener('touchstart', onStart, { passive: false });
    surface.addEventListener('touchmove', onMove, { passive: false });
    surface.addEventListener('touchend', onEnd);
    surface.addEventListener('touchcancel', onEnd);
    root.querySelectorAll('[data-btn]').forEach((b) => {
      const name = b.dataset.btn;
      const down = (e) => {
        e.preventDefault();
        e.stopPropagation();
        b.classList.add('down');
        if (name === 'breath') ts.breath = true;
        else if (name === 'run') ts.run = true;
        else this.edges.add('touch' + name[0].toUpperCase() + name.slice(1));
      };
      const up = (e) => {
        e.preventDefault();
        b.classList.remove('down');
        if (name === 'breath') ts.breath = false;
        else if (name === 'run') ts.run = false;
      };
      b.addEventListener('touchstart', down, { passive: false });
      b.addEventListener('touchend', up, { passive: false });
      b.addEventListener('touchcancel', up, { passive: false });
      b.addEventListener('mousedown', down);
      b.addEventListener('mouseup', up);
    });
  }
}
