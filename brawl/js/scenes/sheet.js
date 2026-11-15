// Developer view: every pose and move of one fighter laid out on a grid, with
// hitboxes drawn. Open with  ?sheet=<fighter id>[&page=N][&costume=N]
// or one move frame by frame with  ?sheet=<id>&move=<move id>

import { W, H, G } from '../core/config.js';
import { fighterById } from '../fighters/index.js';
import { dummyFighter } from '../game/render.js';
import { txt, OUT } from '../core/gfx.js';

const STATES = ['idle', 'walk', 'run', 'crouch', 'jumpsquat', 'air:up', 'air:down', 'land', 'shield', 'roll', 'spotdodge', 'airdodge', 'hitstun', 'tumble', 'down', 'getup', 'stun', 'grabbed', 'grabhold', 'ledge', 'helpless', 'win', 'lose', 'entrance'];

export class SheetScene {
  constructor(app, id, opts = {}) {
    this.app = app; this.def = fighterById(id); this.opts = opts; this.t = 0;
    this.page = opts.page || 0; this.costume = opts.costume || 0;
    const moves = Object.keys(this.def.moves);
    this.cells = STATES.map((s) => ({ kind: 'state', id: s })).concat(moves.map((m) => ({ kind: 'move', id: m })));
    this.cols = opts.cols || 6; this.rows = opts.rows || 4; this.cw = W / this.cols; this.ch = (H - 20) / this.rows;
  }
  update() {
    this.t++;
    const mn = this.app.input.menu();
    const pages = Math.ceil(this.cells.length / (this.cols * this.rows));
    if (mn.right) this.page = (this.page + 1) % pages;
    if (mn.left) this.page = (this.page + pages - 1) % pages;
    if (mn.up) this.costume = (this.costume + 1) % this.def.costumes.length;
  }
  dummy(grounded) {
    const d = dummyFighter(this.def, this.costume);
    d.grounded = grounded; d.t = this.t; return d;
  }
  drawHits(ctx, d, mv, fr) {
    if (!mv.hits) return;
    const P = this.def.points ? this.def.points(d, d.pose) : {};
    for (const hb of mv.hits) {
      if (fr < hb.f[0] || fr > hb.f[1]) continue;
      const base = hb.at ? (P[hb.at] || [0, -d.h / 2]) : [hb.x || 0, hb.y === undefined ? -d.h / 2 : hb.y];
      const x = base[0] + (hb.off ? hb.off[0] : 0), y = base[1] + (hb.off ? hb.off[1] : 0);
      ctx.fillStyle = hb.grab ? 'rgba(170,60,255,0.35)' : 'rgba(255,30,30,0.35)'; ctx.strokeStyle = hb.grab ? '#a03cff' : '#ff2020'; ctx.lineWidth = 1;
      ctx.beginPath();
      if (hb.w) ctx.rect(x - hb.w / 2, y - hb.h / 2, hb.w, hb.h); else ctx.arc(x, y, hb.r || 12, 0, 6.3);
      ctx.fill(); ctx.stroke();
      if (hb.to && P[hb.to]) { ctx.beginPath(); ctx.arc(P[hb.to][0], P[hb.to][1], hb.r || 12, 0, 6.3); ctx.fill(); ctx.stroke(); }
    }
  }
  cell(ctx, c, x, y, w, h, frame) {
    const def = this.def;
    let d, label = c.id, mv = null, fr = 0;
    if (c.kind === 'state') {
      const [s, sub] = c.id.split(':');
      d = this.dummy(!(s === 'air' || s === 'airdodge' || s === 'tumble' || s === 'helpless'));
      d.state = s; d.sf = s === 'roll' || s === 'airdodge' ? 9 : s === 'spotdodge' ? 10 : s === 'getup' ? 8 : 6; d.lag = 8;
      d.cycle = this.t * 4; d.vy = sub === 'up' ? -6 : sub === 'down' ? 6 : 0;
      d.tumble = s === 'tumble'; d.stunKind = 'dizzy';
      if (s === 'hitstun') { d.grounded = true; }
    } else {
      mv = def.moves[c.id];
      d = this.dummy(mv.kind !== 'air');
      d.state = 'move'; d.move = mv; d.moveId = c.id;
      fr = frame !== undefined ? frame : mv.hits && mv.hits.length ? Math.round((mv.hits[0].f[0] + Math.min(mv.hits[0].f[1], mv.hits[0].f[0] + 2)) / 2) : Math.round(mv.frames * 0.4);
      d.mf = fr; label = c.id + ' f' + fr + '/' + mv.frames;
    }
    let ok = true;
    try { d.pose = def.pose(d, null); } catch (e) { ok = false; label += ' ERR ' + e.message; }
    ctx.save();
    ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
    ctx.fillStyle = (Math.round(x / w) + Math.round(y / h)) % 2 ? '#dbe7f3' : '#cfdded'; ctx.fillRect(x, y, w, h);
    const gx = x + w / 2, gy = y + h - 22, sc = Math.min(5, (h - 40) / (d.h + 44));
    ctx.strokeStyle = '#9fb3c8'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x, gy); ctx.lineTo(x + w, gy); ctx.stroke();
    if (ok) {
      ctx.save(); ctx.translate(gx, gy - (d.grounded ? 0 : 18)); ctx.scale(sc, sc);
      d.drawPal = d.pal;
      try { def.draw(ctx, d, d.pose, null); if (mv && !this.opts.clean) this.drawHits(ctx, d, mv, fr); } catch (e) { label += ' DRAWERR ' + e.message; }
      // collision box
      if (!this.opts.clean) { ctx.strokeStyle = 'rgba(40,120,255,0.5)'; ctx.lineWidth = 1 / sc; ctx.strokeRect(-d.w / 2, -d.h, d.w, d.h); }
      ctx.restore();
    }
    txt(ctx, label, x + 4, y + 9, { font: 'pixel', size: 8, fill: '#1d1611', lw: 0, stroke: null, align: 'left' });
    ctx.restore();
  }
  draw(ctx) {
    ctx.fillStyle = '#b9cbe0'; ctx.fillRect(0, 0, W, H);
    const o = this.opts;
    if (o.move && this.def.moves[o.move]) {
      const mv = this.def.moves[o.move], n = this.cols * this.rows, step = Math.max(1, Math.ceil(mv.frames / n));
      for (let i = 0; i < n; i++) {
        const fr = i * step; if (fr > mv.frames) break;
        this.cell(ctx, { kind: 'move', id: o.move }, (i % this.cols) * this.cw, Math.floor(i / this.cols) * this.ch, this.cw, this.ch, fr);
      }
    } else {
      const per = this.cols * this.rows, start = this.page * per;
      for (let i = 0; i < per && start + i < this.cells.length; i++) {
        this.cell(ctx, this.cells[start + i], (i % this.cols) * this.cw, Math.floor(i / this.cols) * this.ch, this.cw, this.ch);
      }
    }
    txt(ctx, `${this.def.name}  -  costume ${this.costume} (${this.def.costumes[this.costume].name})  -  page ${this.page + 1}   [left/right page, up costume]`, 6, H - 10, { font: 'pixel', size: 8, fill: '#1d1611', lw: 0, stroke: null, align: 'left' });
  }
}
