// Vertical/horizontal menu with d-pad/stick navigation, mouse hover and click.
import { el } from '../util.js';
import { audio } from '../audio.js';

export class Menu {
  constructor(app, items, opts = {}) {
    this.app = app; this.items = items; this.opts = opts; this.index = opts.index || 0;
    while (this.items[this.index] && this.items[this.index].disabled) this.index = (this.index + 1) % this.items.length;
    this.el = el('div', { class: 'menu ' + (opts.horizontal ? 'horizontal ' : '') + (opts.className || '') });
    (opts.parent || app.ui).appendChild(this.el);
    this.render();
  }
  render() {
    this.el.innerHTML = '';
    this.items.forEach((it, i) => {
      const d = el('div', {
        class: 'mitem' + (i === this.index ? ' sel' : '') + (it.disabled ? ' disabled' : ''),
        onmouseenter: () => { if (this.index !== i && !it.disabled) { this.index = i; this.render(); audio.sfx('blip'); if (this.opts.onChange) this.opts.onChange(i); } },
        onclick: () => this.activate(i),
      }, it.label, it.hint ? el('small', { text: it.hint }) : null);
      this.el.appendChild(d);
    });
  }
  setItems(items) { this.items = items; this.index = Math.min(this.index, items.length - 1); this.render(); }
  update(input) {
    const nav = this.opts.dpadOnly ? input.navDpad() : input.nav();
    if (nav) { const dirs = this.opts.horizontal ? ['left', 'right'] : ['up', 'down']; if (nav === dirs[0]) this.move(-1); else if (nav === dirs[1]) this.move(1); else if (this.opts.onSide) this.opts.onSide(nav); }
    if (input.pressed('cross')) this.activate(this.index);
    if (input.pressed('circle') && this.opts.onBack) { audio.sfx('back'); this.opts.onBack(); }
  }
  move(d) {
    let i = this.index;
    for (let k = 0; k < this.items.length; k++) { i = (i + d + this.items.length) % this.items.length; if (!this.items[i].disabled) break; }
    if (i !== this.index) { this.index = i; this.render(); audio.sfx('blip'); if (this.opts.onChange) this.opts.onChange(i); }
  }
  activate(i) {
    const it = this.items[i]; if (!it || it.disabled) { audio.sfx('error'); return; }
    audio.sfx('confirm'); if (it.action) it.action(it, i);
  }
  destroy() { this.el.remove(); }
}

// Grid selection helper for card rows (play cards, shop items): keeps an index, handles left/right/up/down.
export class GridNav {
  constructor(count, cols) { this.count = count; this.cols = cols; this.index = 0; }
  handle(nav) {
    if (!nav || this.count === 0) return false;
    let i = this.index; const cols = this.cols;
    if (nav === 'left') i = i % cols === 0 ? Math.min(i + cols - 1, this.count - 1) : i - 1;
    if (nav === 'right') i = (i % cols === cols - 1 || i === this.count - 1) ? i - (i % cols) : i + 1;
    if (nav === 'up') i = i - cols < 0 ? i : i - cols;
    if (nav === 'down') i = i + cols >= this.count ? i : i + cols;
    if (i !== this.index) { this.index = i; audio.sfx('blip'); return true; }
    return false;
  }
}
