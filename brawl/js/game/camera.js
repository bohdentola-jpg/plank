// The camera frames everyone still in play, zooming and panning like a
// sports broadcast. It never shows past the stage's camera box.

import { W, H } from '../core/config.js';
import { clamp, lerp } from '../core/util.js';

export const VIEW_CY = H / 2 - 26;     // the HUD lives along the bottom, so aim a bit high

export class Camera {
  constructor(m) {
    this.m = m;
    this.x = 0; this.y = -80; this.zoom = 0.8; this.roll = 0;
    this.sx = 0; this.sy = 0; this.shakeAmt = 0; this.punch = 0;
    this.focus = null;         // {x,y,zoom,t} temporary override (super cut-ins, final KO)
    this.minZoom = 0.52; this.maxZoom = 1.18;
    this._seed = 1;
  }
  snap() { const t = this.target(); this.x = t.x; this.y = t.y; this.zoom = t.z; }

  target() {
    const m = this.m, st = m.stage, c = st.cam;
    let l = Infinity, r = -Infinity, t = Infinity, b = -Infinity, n = 0;
    for (const f of m.fighters) {
      if (f.out || f.state === 'dead') continue;
      const h = f.h * f.scale;
      l = Math.min(l, f.x - 95); r = Math.max(r, f.x + 95);
      t = Math.min(t, f.y - h - 80); b = Math.max(b, f.y + 70);
      n++;
    }
    for (const e of m.entities) {
      if (!e.camera) continue;
      l = Math.min(l, e.x - 60); r = Math.max(r, e.x + 60); t = Math.min(t, e.y - 60); b = Math.max(b, e.y + 60); n++;
    }
    if (!n) { l = -200; r = 200; t = -300; b = 60; }
    // keep a little of the stage in frame so a lone fighter isn't a close-up
    const fx = st.focusX || 0, fy = st.focusY === undefined ? -60 : st.focusY;
    l = Math.min(l, fx - 150); r = Math.max(r, fx + 150); t = Math.min(t, fy - 110); b = Math.max(b, fy + 80);
    l = Math.max(l, c.l); r = Math.min(r, c.r); t = Math.max(t, c.t); b = Math.min(b, c.b);
    if (r - l < 50) { l -= 25; r += 25; }
    if (b - t < 50) { t -= 25; b += 25; }
    const availH = H - 80;
    let z = Math.min(W / (r - l), availH / (b - t));
    const zmin = Math.max(st.minZoom || this.minZoom, W / (c.r - c.l), availH / (c.b - c.t));
    z = clamp(z, zmin, st.maxZoom || this.maxZoom);
    let x = (l + r) / 2, y = (t + b) / 2;
    const hw = W / 2 / z, hhT = VIEW_CY / z, hhB = (H - VIEW_CY) / z;
    x = c.r - c.l <= hw * 2 ? (c.l + c.r) / 2 : clamp(x, c.l + hw, c.r - hw);
    y = c.b - c.t <= hhT + hhB ? (c.t + c.b) / 2 : clamp(y, c.t + hhT, c.b - hhB + 46 / z);
    return { x, y, z };
  }

  update() {
    let t = this.target();
    if (this.focus) {
      const f = this.focus;
      t = { x: f.x, y: f.y, z: f.zoom || t.z };
      if (--f.t <= 0) this.focus = null;
    }
    const k = this.focus ? 0.2 : 0.085;
    this.x = lerp(this.x, t.x, k); this.y = lerp(this.y, t.y, k);
    this.zoom = lerp(this.zoom, t.z, this.focus ? 0.16 : 0.06);
    if (this.shakeAmt > 0.2) {
      this._seed = (this._seed * 9301 + 49297) % 233280;
      const a = (this._seed / 233280) * Math.PI * 2;
      this.sx = Math.cos(a) * this.shakeAmt; this.sy = Math.sin(a) * this.shakeAmt;
      this.shakeAmt *= 0.86;
    } else { this.sx = this.sy = 0; this.shakeAmt = 0; }
    if (this.punch > 0.001) this.punch *= 0.82; else this.punch = 0;
  }
  shake(a) { this.shakeAmt = Math.min(22, Math.max(this.shakeAmt, a * (this.m.shakeScale === undefined ? 1 : this.m.shakeScale))); }

  apply(ctx) {
    const z = this.zoom * (1 + this.punch);
    ctx.translate(W / 2 + this.sx, VIEW_CY + this.sy);
    if (this.roll) ctx.rotate(this.roll);
    ctx.scale(z, z);
    ctx.translate(-this.x, -this.y);
  }
  toScreen(wx, wy) {
    const z = this.zoom * (1 + this.punch);
    let dx = (wx - this.x) * z, dy = (wy - this.y) * z;
    if (this.roll) { const c = Math.cos(this.roll), s = Math.sin(this.roll); const t = dx * c - dy * s; dy = dx * s + dy * c; dx = t; }
    return [W / 2 + dx + this.sx, VIEW_CY + dy + this.sy];
  }
  view() {
    const z = this.zoom;
    return { l: this.x - W / 2 / z, r: this.x + W / 2 / z, t: this.y - VIEW_CY / z, b: this.y + (H - VIEW_CY) / z };
  }
}
