// Controller navigation for the menus: d-pad / stick moves focus, ✕ picks,
// ◯ backs out ([data-back]). The live game reads the pad itself.
import { pads, BTN } from './gamepad.js';
import { sfx } from './audio.js';

const SELECTOR = 'button, .crew-card, .rung';

export class PadUI {
  constructor() {
    this.focusEl = null;
    this.lastNav = 0;
    this._navHeld = null;
    this._lastScope = null;
    this._tick = this._tick.bind(this);
    requestAnimationFrame(this._tick);
  }

  activeScope() {
    for (const id of ['scr-title', 'scr-select', 'scr-ladder']) {
      const el = document.getElementById(id);
      if (el?.classList.contains('active')) return el;
    }
    return null;
  }

  candidates(scope) {
    return [...scope.querySelectorAll(SELECTOR)].filter((el) => {
      if (el.disabled) return false;
      const r = el.getBoundingClientRect();
      return r.width > 4 && r.height > 4 && el.offsetParent !== null;
    });
  }

  _tick() {
    requestAnimationFrame(this._tick);
    if (document.getElementById('scr-game')?.classList.contains('active')) {
      this.setFocus(null);
      return;
    }
    pads.poll();
    const p = pads.p1.connected ? pads.p1 : pads.p2;
    if (!p.connected) return;
    const scope = this.activeScope();
    if (!scope) return;
    if (scope !== this._lastScope) {
      this._lastScope = scope;
      this.setFocus(null);
    }
    const items = this.candidates(scope);
    if (!items.length) return;
    if (!this.focusEl || !this.focusEl.isConnected || !items.includes(this.focusEl)) {
      this.setFocus(items[0]);
    }
    const dir = this.navDir(p);
    if (dir) {
      const next = this.spatialMove(items, dir);
      if (next) { this.setFocus(next); sfx.chime(); }
    }
    for (const b of p.edges) {
      if (b === BTN.CROSS) { sfx.ensure(); this.focusEl?.click(); }
      if (b === BTN.CIRCLE) {
        const back = scope.querySelector('[data-back]');
        if (back) { back.click(); sfx.back(); }
      }
    }
  }

  navDir(p) {
    const now = performance.now();
    let dir = null;
    if (p.down(BTN.UP) || p.ly < -0.55) dir = 'up';
    else if (p.down(BTN.DOWN) || p.ly > 0.55) dir = 'down';
    else if (p.down(BTN.LEFT) || p.lx < -0.55) dir = 'left';
    else if (p.down(BTN.RIGHT) || p.lx > 0.55) dir = 'right';
    if (!dir) { this._navHeld = null; return null; }
    const isEdge = p.edges.some((b) => [BTN.UP, BTN.DOWN, BTN.LEFT, BTN.RIGHT].includes(b));
    if (isEdge || this._navHeld !== dir || now - this.lastNav > 240) {
      this._navHeld = dir;
      this.lastNav = now;
      return dir;
    }
    return null;
  }

  spatialMove(items, dir) {
    const f = this.focusEl.getBoundingClientRect();
    const fx = f.left + f.width / 2, fy = f.top + f.height / 2;
    let best = null, bs = 1e9;
    for (const el of items) {
      if (el === this.focusEl) continue;
      const r = el.getBoundingClientRect();
      const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      const dx = cx - fx, dy = cy - fy;
      let primary, cross;
      if (dir === 'up') { primary = -dy; cross = Math.abs(dx); }
      else if (dir === 'down') { primary = dy; cross = Math.abs(dx); }
      else if (dir === 'left') { primary = -dx; cross = Math.abs(dy); }
      else { primary = dx; cross = Math.abs(dy); }
      if (primary < 6) continue;
      const score = primary + cross * 2.4;
      if (score < bs) { bs = score; best = el; }
    }
    return best;
  }

  setFocus(el) {
    if (this.focusEl === el) return;
    if (this.focusEl) this.focusEl.classList.remove('pad-focus');
    this.focusEl = el;
    if (el) {
      el.classList.add('pad-focus');
      el.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    }
  }
}
