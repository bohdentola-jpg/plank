// Hands-on work as small skill games drawn over the world:
//   timing   — a needle sweeps a bar; hit the interact button in the green zone
//   sequence — press the shown directions in order before the clock runs out
//   mash     — hammer the button to fill a bar against decay
// Repairs, splicing, wiring, sawing, painting all map onto these.
import { input } from '../core/input.js';
import { C, W, H, text, panel, vText, actionGlyph, roundRect } from '../core/ui.js';

const KINDS = {
  rope: { type: 'timing', hits: 5, misses: 3, speed: 1.1, zone: 0.16, verb: 'TWIST' },
  hammer: { type: 'timing', hits: 6, misses: 3, speed: 1.4, zone: 0.14, verb: 'STRIKE' },
  saw: { type: 'mash', goal: 1, rate: 0.085, decay: 0.12, verb: 'SAW' },
  paint: { type: 'mash', goal: 1, rate: 0.06, decay: 0.05, verb: 'PAINT' },
  wire: { type: 'sequence', len: 6, time: 9, verb: 'CONNECT' },
  lock: { type: 'sequence', len: 5, time: 7, verb: 'PICK' },
  glass: { type: 'timing', hits: 3, misses: 2, speed: 0.8, zone: 0.2, verb: 'SET' },
  shovel: { type: 'mash', goal: 1, rate: 0.07, decay: 0.08, verb: 'DIG' },
};

const DIRS = ['up', 'right', 'down', 'left'];
const ARROW = { up: '↑', right: '→', down: '↓', left: '←' };

export class Minigames {
  constructor(G) { this.G = G; this.cur = null; }

  run(kind, opts = {}) {
    const spec = { ...(KINDS[kind] || KINDS.hammer), ...opts };
    return new Promise((resolve) => {
      this.cur = { kind, spec, t: 0, resolve, hits: 0, misses: 0, needle: 0, dir: 1, fill: 0, seq: [], idx: 0, flash: 0, zoneC: 0.5 + (Math.random() - 0.5) * 0.5 };
      if (spec.type === 'sequence') this.cur.seq = Array.from({ length: spec.len }, () => DIRS[Math.floor(Math.random() * 4)]);
      this.G.player.locked = true;
    });
  }

  _end(ok) {
    const c = this.cur;
    this.cur = null;
    this.G.player.locked = false;
    this.G.hud.toast(ok ? 'NICE WORK' : 'GOOD ENOUGH', c.spec.title || c.kind.toUpperCase(), ok ? '#a9d4b2' : '#e7a740');
    c.resolve(ok);
  }

  update(dt) {
    const c = this.cur;
    if (!c) return;
    c.t += dt;
    c.flash = Math.max(0, c.flash - dt * 3);
    const s = c.spec;
    if (c.t < 0.6) return;
    if (s.type === 'timing') {
      c.needle += c.dir * dt * s.speed * (1 + c.hits * 0.12);
      if (c.needle > 1) { c.needle = 1; c.dir = -1; }
      if (c.needle < 0) { c.needle = 0; c.dir = 1; }
      if (input.pressed('interact') || input.pressed('confirm')) {
        if (Math.abs(c.needle - c.zoneC) < s.zone / 2) { c.hits++; c.flash = 1; c.good = true; c.zoneC = 0.2 + Math.random() * 0.6; this.G.sfx?.ui?.('select'); }
        else { c.misses++; c.flash = 1; c.good = false; }
        if (c.hits >= s.hits) this._end(true);
        else if (c.misses >= s.misses) this._end(false);
      }
    } else if (s.type === 'mash') {
      c.fill = Math.max(0, c.fill - s.decay * dt);
      if (input.pressed('interact') || input.pressed('confirm')) { c.fill += s.rate; c.flash = 0.5; }
      if (c.fill >= s.goal) this._end(true);
      if (c.t > 25) this._end(false);
    } else if (s.type === 'sequence') {
      const want = c.seq[c.idx];
      for (const d of DIRS) {
        if (input.pressed(d)) {
          if (d === want) { c.idx++; c.flash = 1; c.good = true; } else { c.misses++; c.flash = 1; c.good = false; c.idx = Math.max(0, c.idx - 1); }
        }
      }
      if (c.idx >= c.seq.length) this._end(true);
      else if (c.t > s.time + 0.6) this._end(c.idx >= c.seq.length * 0.6);
    }
  }

  draw(ctx) {
    const c = this.cur;
    if (!c) return;
    const s = c.spec;
    const bw = 520, bh = 150, x = W / 2 - bw / 2, y = H - 260;
    panel(ctx, x, y, bw, bh, { accentLen: 160 });
    vText(ctx, s.title || c.kind.toUpperCase(), x + 30, y + 36, 20, { color: '#fff', weight: 0.16 });
    if (s.type === 'timing') {
      const bx = x + 30, by = y + 62, len = bw - 60;
      ctx.fillStyle = 'rgba(255,255,255,0.1)'; roundRect(ctx, bx, by, len, 22, 6); ctx.fill();
      ctx.fillStyle = 'rgba(124,196,143,0.55)'; ctx.fillRect(bx + (c.zoneC - s.zone / 2) * len, by, s.zone * len, 22);
      ctx.fillStyle = c.flash > 0 ? (c.good ? C.green : C.red) : '#fff';
      ctx.fillRect(bx + c.needle * len - 2, by - 6, 4, 34);
      const gw = actionGlyph(ctx, 'interact', bx, by + 54, 11);
      text(ctx, `${s.verb} in the green  ·  ${c.hits}/${s.hits}`, bx + gw + 12, by + 60, { size: 15, weight: 700, color: '#fff' });
      text(ctx, '✕'.repeat(c.misses) + '·'.repeat(Math.max(0, s.misses - c.misses)), bx + len, by + 60, { size: 15, weight: 800, color: C.red, align: 'right' });
    } else if (s.type === 'mash') {
      const bx = x + 30, by = y + 62, len = bw - 60;
      ctx.fillStyle = 'rgba(255,255,255,0.1)'; roundRect(ctx, bx, by, len, 22, 6); ctx.fill();
      ctx.fillStyle = C.accent; ctx.fillRect(bx, by, len * Math.min(1, c.fill), 22);
      const gw = actionGlyph(ctx, 'interact', bx, by + 54, 11);
      text(ctx, `${s.verb} — tap fast`, bx + gw + 12, by + 60, { size: 15, weight: 700, color: '#fff' });
    } else if (s.type === 'sequence') {
      const n = c.seq.length;
      c.seq.forEach((d, i) => {
        const cx = x + bw / 2 + (i - (n - 1) / 2) * 62, cy = y + 82;
        ctx.fillStyle = i < c.idx ? 'rgba(124,196,143,0.35)' : i === c.idx ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.08)';
        roundRect(ctx, cx - 24, cy - 24, 48, 48, 8); ctx.fill();
        text(ctx, ARROW[d], cx, cy + 10, { size: 28, weight: 900, color: i < c.idx ? C.green : '#fff', align: 'center' });
      });
      const left = Math.max(0, s.time - (c.t - 0.6));
      ctx.fillStyle = 'rgba(255,255,255,0.1)'; ctx.fillRect(x + 30, y + 124, bw - 60, 6);
      ctx.fillStyle = left < 2 ? C.red : C.accent; ctx.fillRect(x + 30, y + 124, (bw - 60) * left / s.time, 6);
    }
  }
}
