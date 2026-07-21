// Universal controller navigation for everything outside the live game:
// title menu, builders, office hotspots, modals, the play-designer canvas.
// D-pad / left stick moves focus, ✕ activates, ◯ backs out of text fields,
// left/right adjusts sliders, selects, and color swatches.
import { PadInput, BTN, padAnnounced, markPadAnnounced } from './gamepad.js';
import { sfx } from './audio.js';

const PALETTE = [
  '#14306e', '#1f4fd8', '#7db9e8', '#1d4d2b', '#1e7a3c', '#46245e',
  '#8f1d2c', '#c0273a', '#d35f12', '#f2b705', '#e8b923', '#5e1f2e',
  '#17181c', '#9aa0a6', '#c7ccd4', '#f4f4f2',
];

const SELECTOR = 'button, input, select, .playcard, .logo-cell, .preset-chip, .ed-role, canvas.pad-target';

export class PadUI {
  constructor(officeGetter) {
    this.pad = new PadInput();
    this.officeGetter = officeGetter || (() => null);
    this.focusEl = null;
    this.lastNav = 0;
    this.officeIdx = 0;
    this.cursor = null;       // {x, y, downHeld} canvas cursor mode
    this.cursorEl = document.createElement('div');
    this.cursorEl.id = 'pad-cursor';
    document.body.appendChild(this.cursorEl);
    this._lastScope = null;
    this._tick = this._tick.bind(this);
    requestAnimationFrame(this._tick);
  }

  // ---------------------------------------------------------- scopes
  activeScope() {
    const modal = document.querySelector('#office-modal.show .om-card');
    if (modal) return modal;
    for (const id of ['title', 'create', 'hub']) {
      const el = document.getElementById(`scr-${id}`);
      if (el?.classList.contains('active')) return el;
    }
    return null;
  }

  inOfficeHotspotMode(scope) {
    return scope?.id === 'scr-office' && !document.querySelector('#office-modal.show') && this.officeGetter();
  }

  candidates(scope) {
    return [...scope.querySelectorAll(SELECTOR)].filter((el) => {
      if (el.disabled) return false;
      const r = el.getBoundingClientRect();
      return r.width > 4 && r.height > 4 && el.offsetParent !== null;
    });
  }

  // ---------------------------------------------------------- main loop
  _tick() {
    requestAnimationFrame(this._tick);
    // the game owns the pad on the field
    if (document.getElementById('scr-game')?.classList.contains('active')) {
      this.setFocus(null);
      this.cursor = null;
      this.cursorEl.style.display = 'none';
      return;
    }
    this.pad.poll();
    const p = this.pad;
    if (!p.connected) return;
    if (p.justConnected && !padAnnounced()) markPadAnnounced();

    const scope = this.activeScope();
    if (!scope) return;
    if (scope !== this._lastScope) {
      this._lastScope = scope;
      this.setFocus(null);
      this.officeIdx = 0;
      this.cursor = null;
      this.cursorEl.style.display = 'none';
    }

    // -------- office: cycle the 3D hotspots
    if (this.inOfficeHotspotMode(scope)) {
      const office = this.officeGetter();
      const n = office.hotspots.length;
      if (!n) return;
      const dir = this.navDir();
      if (dir === 'left' || dir === 'up') { this.officeIdx = (this.officeIdx - 1 + n) % n; sfx.chime(); office.padFocusHotspot(this.officeIdx); }
      if (dir === 'right' || dir === 'down') { this.officeIdx = (this.officeIdx + 1) % n; sfx.chime(); office.padFocusHotspot(this.officeIdx); }
      for (const b of p.edges) {
        if (b === BTN.CROSS) { office.padFocusHotspot(this.officeIdx); office.padActivate(); }
      }
      return;
    }

    // -------- canvas cursor mode (play designer board)
    if (this.cursor && this.focusEl?.tagName === 'CANVAS' && this.focusEl.isConnected) {
      const r = this.focusEl.getBoundingClientRect();
      const speed = 7;
      this.cursor.x = Math.max(0, Math.min(r.width, this.cursor.x + p.lx * speed + (p.down(BTN.RIGHT) ? speed : 0) - (p.down(BTN.LEFT) ? speed : 0)));
      this.cursor.y = Math.max(0, Math.min(r.height, this.cursor.y + p.ly * speed + (p.down(BTN.DOWN) ? speed : 0) - (p.down(BTN.UP) ? speed : 0)));
      this.cursorEl.style.display = 'block';
      this.cursorEl.style.left = `${r.left + this.cursor.x}px`;
      this.cursorEl.style.top = `${r.top + this.cursor.y}px`;
      const fire = (type) => {
        this.focusEl.dispatchEvent(new PointerEvent(type, {
          clientX: r.left + this.cursor.x, clientY: r.top + this.cursor.y,
          bubbles: true, pointerId: 99, isPrimary: true,
        }));
      };
      if (this.cursor.downHeld) fire('pointermove');
      for (const b of p.edges) {
        if (b === BTN.CROSS) { this.cursor.downHeld = true; fire('pointerdown'); }
        if (b === BTN.CIRCLE) { this.cursor = null; this.cursorEl.style.display = 'none'; sfx.back(); return; }
      }
      if (this.cursor?.downHeld && !p.down(BTN.CROSS)) { this.cursor.downHeld = false; fire('pointerup'); }
      return;
    }

    // -------- DOM navigation
    const items = this.candidates(scope);
    if (!items.length) return;
    if (!this.focusEl || !this.focusEl.isConnected || !items.includes(this.focusEl)) {
      this.setFocus(this.nearestToOld(items));
    }
    const typing = document.activeElement && ['INPUT', 'SELECT', 'TEXTAREA'].includes(document.activeElement.tagName)
      && ['text', 'number'].includes(document.activeElement.type || 'text');

    const dir = this.navDir();
    if (dir) {
      const adjusted = !typing && this.adjustValue(dir);
      if (!adjusted) {
        if (typing) document.activeElement.blur();
        const next = this.spatialMove(items, dir);
        if (next) { this.setFocus(next); sfx.chime(); }
      }
    }
    for (const b of p.edges) {
      if (b === BTN.CROSS) this.activate();
      if (b === BTN.CIRCLE) {
        if (typing) { document.activeElement.blur(); sfx.back(); }
        else {
          const back = scope.querySelector('[data-back]');
          if (back) { back.click(); sfx.back(); }
        }
      }
    }
  }

  // direction with key-repeat from d-pad or stick
  navDir() {
    const p = this.pad;
    const now = performance.now();
    let dir = null;
    if (p.down(BTN.UP) || p.ly < -0.55) dir = 'up';
    else if (p.down(BTN.DOWN) || p.ly > 0.55) dir = 'down';
    else if (p.down(BTN.LEFT) || p.lx < -0.55) dir = 'left';
    else if (p.down(BTN.RIGHT) || p.lx > 0.55) dir = 'right';
    if (!dir) { this._navHeld = null; return null; }
    const isEdge = p.edges.some((b) => [BTN.UP, BTN.DOWN, BTN.LEFT, BTN.RIGHT].includes(b));
    if (isEdge || this._navHeld !== dir || now - this.lastNav > 260) {
      this._navHeld = dir;
      this.lastNav = now;
      return dir;
    }
    return null;
  }

  nearestToOld(items) {
    if (!this._oldRect) return items[0];
    const { x, y } = this._oldRect;
    let best = items[0], bd = 1e9;
    for (const el of items) {
      const r = el.getBoundingClientRect();
      const d = Math.hypot(r.left + r.width / 2 - x, r.top + r.height / 2 - y);
      if (d < bd) { bd = d; best = el; }
    }
    return best;
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
      this._oldRect = (() => { const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })();
      el.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    }
  }

  adjustValue(dir) {
    const el = this.focusEl;
    if (!el || (dir !== 'left' && dir !== 'right')) return false;
    const step = dir === 'right' ? 1 : -1;
    if (el.tagName === 'SELECT') {
      el.selectedIndex = (el.selectedIndex + step + el.options.length) % el.options.length;
      el.dispatchEvent(new Event('change', { bubbles: true }));
      sfx.chime();
      return true;
    }
    if (el.tagName === 'INPUT' && el.type === 'range') {
      el.value = String(Math.max(+el.min, Math.min(+el.max, +el.value + step)));
      el.dispatchEvent(new Event('input', { bubbles: true }));
      sfx.chime();
      return true;
    }
    if (el.tagName === 'INPUT' && el.type === 'color') {
      const idx = PALETTE.indexOf(el.value);
      const next = PALETTE[(idx + step + PALETTE.length) % PALETTE.length] || PALETTE[0];
      el.value = next;
      el.dispatchEvent(new Event('input', { bubbles: true }));
      sfx.chime();
      return true;
    }
    return false;
  }

  activate() {
    const el = this.focusEl;
    if (!el) return;
    sfx.ensure();
    if (el.tagName === 'CANVAS') {
      const r = el.getBoundingClientRect();
      this.cursor = { x: r.width / 2, y: r.height / 2, downHeld: false };
      sfx.chime();
      return;
    }
    if (el.tagName === 'INPUT') {
      if (el.type === 'checkbox') { el.click(); return; }
      if (el.type === 'color') { this.adjustValue('right'); return; }
      if (el.type === 'range') return;
      el.focus();
      try { el.select(); } catch { /* fine */ }
      return;
    }
    if (el.tagName === 'SELECT') { this.adjustValue('right'); return; }
    el.click();
  }
}
