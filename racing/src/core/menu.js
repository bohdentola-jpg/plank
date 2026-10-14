// Vertical menu list for canvas screens. Pad/keyboard: up/down to move,
// left/right to change choices/sliders, confirm to activate. Mouse: hover +
// click (via the ui hit registry). Items:
//   { label, type: 'action'|'choice'|'slider'|'toggle', options:[{label,value}],
//     get(): value, set(v), step, min, max, hint, disabled, id }
import { input } from './input.js';
import { C, vText, text, hit } from './ui.js';
import { clamp } from './util.js';

let sfxMod = null;
import('../audio/sfx.js').then((m) => { sfxMod = m.sfx; }).catch(() => {});
export const uiSound = (name) => { try { sfxMod?.ui(name); } catch { /* */ } };

export class Menu {
  constructor(items, opts = {}) {
    this.items = items;
    this.sel = opts.sel ?? 0;
    this.id = opts.id || 'menu' + Math.floor(Math.random() * 1e6);
    this.anim = 0;
    this.selT = 0;
    this.skipDisabled(1);
  }

  get current() { return this.items[this.sel]; }

  skipDisabled(dir) {
    const n = this.items.length;
    for (let k = 0; k < n && this.items[this.sel]?.disabled; k++) this.sel = (this.sel + dir + n) % n;
  }

  /** Returns the activated item (or null). Call once per frame. */
  update(dt) {
    this.anim += dt;
    this.selT += dt;
    const n = this.items.length;
    if (!n) return null;
    let moved = false;
    if (input.pressed('up')) { this.sel = (this.sel - 1 + n) % n; this.skipDisabled(-1); moved = true; }
    if (input.pressed('down')) { this.sel = (this.sel + 1) % n; this.skipDisabled(1); moved = true; }
    // mouse hover
    if (input.device === 'mouse' && hit.hover && hit.hover.startsWith(this.id + ':')) {
      const k = parseInt(hit.hover.split(':')[1], 10);
      if (k !== this.sel && !this.items[k]?.disabled) { this.sel = k; moved = true; }
    }
    if (moved) { this.selT = 0; uiSound('move'); }
    const it = this.items[this.sel];
    if (!it || it.disabled) return null;
    const dir = input.pressed('right') ? 1 : input.pressed('left') ? -1 : 0;
    if (dir && (it.type === 'choice' || it.type === 'toggle')) {
      const opts = it.options || [{ value: false, label: 'OFF' }, { value: true, label: 'ON' }];
      const cur = opts.findIndex((o) => o.value === it.get());
      const next = opts[(cur + dir + opts.length) % opts.length];
      it.set(next.value);
      uiSound('tab');
    } else if (dir && it.type === 'slider') {
      const step = it.step ?? 0.1;
      it.set(clamp(Math.round((it.get() + dir * step) / step) * step, it.min ?? 0, it.max ?? 1));
      uiSound('tab');
    }
    let clicked = false;
    if (input.takeClick() && hit.hover && hit.hover.startsWith(this.id + ':')) clicked = true;
    if (input.pressed('confirm') || clicked) {
      if (it.type === 'choice' || it.type === 'toggle') {
        if (clicked || it.type === 'toggle') {
          const opts = it.options || [{ value: false }, { value: true }];
          const cur = opts.findIndex((o) => o.value === it.get());
          it.set(opts[(cur + 1) % opts.length].value);
          uiSound('tab');
        }
        return null;
      }
      uiSound('select');
      return it;
    }
    return null;
  }

  /** Draw at (x, y) with width w. Returns total height. */
  draw(ctx, x, y, w, opts = {}) {
    const rowH = opts.rowH || 44;
    const size = opts.size || 22;
    this.items.forEach((it, k) => {
      const yy = y + k * rowH;
      const sel = k === this.sel;
      hit.add(`${this.id}:${k}`, x - 10, yy - rowH * 0.7, w + 20, rowH);
      if (sel) {
        const g = ctx.createLinearGradient(x - 20, 0, x + w, 0);
        g.addColorStop(0, 'rgba(255,178,30,0.55)');
        g.addColorStop(0.7, 'rgba(255,178,30,0.12)');
        g.addColorStop(1, 'rgba(255,178,30,0)');
        ctx.fillStyle = g;
        const sk = 10;
        ctx.beginPath();
        ctx.moveTo(x - 18 + sk, yy - rowH * 0.62);
        ctx.lineTo(x + w, yy - rowH * 0.62);
        ctx.lineTo(x + w - sk, yy + rowH * 0.3);
        ctx.lineTo(x - 18, yy + rowH * 0.3);
        ctx.closePath();
        ctx.fill();
        // chevron
        const bob = Math.sin(this.anim * 6) * 3;
        ctx.fillStyle = C.accent;
        ctx.beginPath();
        ctx.moveTo(x - 30 + bob, yy - size * 0.55);
        ctx.lineTo(x - 20 + bob, yy - size * 0.3);
        ctx.lineTo(x - 30 + bob, yy - size * 0.05);
        ctx.fill();
      }
      const col = it.disabled ? C.faint : sel ? '#ffffff' : '#c9d1de';
      vText(ctx, it.label, x, yy, size, { color: col, weight: 0.15, shadow: [2, 2, 'rgba(0,0,0,0.6)'] });
      if (it.type === 'choice' || it.type === 'toggle') {
        const opts = it.options || [{ value: false, label: 'OFF' }, { value: true, label: 'ON' }];
        const cur = opts.find((o) => o.value === it.get()) || opts[0];
        const vx = x + w - 20;
        vText(ctx, cur.label, vx, yy, size * 0.82, { align: 'right', color: sel ? C.accent : C.dim });
        if (sel) {
          const tw = Math.min(260, ctx.measureText ? 0 : 0);
          void tw;
          text(ctx, '◄', vx - 12 - Math.max(80, cur.label.length * size * 0.62), yy - 3, { size: 14, color: C.accent, align: 'right' });
          text(ctx, '►', vx + 16, yy - 3, { size: 14, color: C.accent });
        }
      } else if (it.type === 'slider') {
        const bw = 180, bx = x + w - 20 - bw, v = clamp(((it.get() - (it.min ?? 0)) / ((it.max ?? 1) - (it.min ?? 0))), 0, 1);
        ctx.fillStyle = 'rgba(255,255,255,0.12)';
        ctx.fillRect(bx, yy - size * 0.55, bw, size * 0.42);
        ctx.fillStyle = sel ? C.accent : C.accentDim;
        ctx.fillRect(bx, yy - size * 0.55, bw * v, size * 0.42);
      } else if (it.value !== undefined && it.valueLabel) {
        vText(ctx, it.valueLabel, x + w - 20, yy, size * 0.8, { align: 'right', color: C.dim });
      }
      if (sel && it.hint && opts.hints !== false) {
        text(ctx, it.hint, opts.hintX ?? x, opts.hintY ?? (y + this.items.length * rowH + 10), { size: 15, color: C.dim, weight: 600 });
      }
    });
    return this.items.length * rowH;
  }
}
