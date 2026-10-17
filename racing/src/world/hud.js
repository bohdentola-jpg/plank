// PORT HALCYON — the free-roam HUD: the race HUD's tachometer and messages,
// a radar of the real road network round you (every road in town, drawn by
// class: freeways wide and amber, streets grey, dirt brown; cut into world
// cells so only what's near gets drawn), and where you are.
import { HUD } from '../race/hud.js';
import { C, text } from '../core/ui.js';
import { clamp, damp } from '../core/util.js';
import { CELL } from './terrain.js';
import { districtAt } from './ground.js';

const CLASS = {
  freeway: 0, expressway: 0, ramp: 0,
  highway: 1, coastal: 1, mountain: 1, circuit: 1, strip: 1,
  avenue: 2, boulevard: 2, street: 2, cobble: 2, quay: 2, boardwalk: 2,
  alley: 3, service: 3, dirt: 3, gravel: 3,
};
const STYLE = [
  { w: 12, c: 'rgba(255,190,70,0.95)' },
  { w: 8, c: 'rgba(225,230,240,0.9)' },
  { w: 7, c: 'rgba(170,182,200,0.85)' },
  { w: 4.5, c: 'rgba(170,140,110,0.8)' },
];

export class WorldHUD extends HUD {
  buildMap() {
    // one Path2D per world cell per road class
    const s = this.s;
    this.cells = new Map();
    for (const r of s.net.roads) {
      const k = CLASS[r.rt.id] ?? 2;
      const step = Math.max(1, Math.round(8 / r.step));
      let prevKey = null, path = null;
      for (let i = 0; i <= r.N; i += step) {
        const j = Math.min(i, r.N - 1);
        const key = `${Math.floor(r.X[j] / CELL)},${Math.floor(r.Z[j] / CELL)}`;
        if (key !== prevKey) {
          let e = this.cells.get(key);
          if (!e) { e = [new Path2D(), new Path2D(), new Path2D(), new Path2D()]; this.cells.set(key, e); }
          // carry the line over the cell edge from the last point
          if (path && prevKey !== null) path.lineTo(r.X[j], r.Z[j]);
          path = e[k];
          const p = Math.max(0, j - step);
          path.moveTo(r.X[p], r.Z[p]);
          prevKey = key;
        }
        path.lineTo(r.X[j], r.Z[j]);
        if (j === r.N - 1) break;
      }
    }
  }

  draw(ctx, dt) {
    this.t += dt;
    this.dt = dt;
    const s = this.s;
    if (!s.sim || s.state === 'loading') return;
    this.drawMinimap(ctx, 108, 652, 82);
    this.drawTach(ctx, 908, 650, 96);
    this.drawMessages(ctx);
    this.drawWhere(ctx);
  }

  drawMinimap(ctx, cx, cy, R) {
    const s = this.s;
    const pv = s.player.vehicle;
    this.mapRange = damp(this.mapRange ?? 230, 230 + clamp((pv.speed - 15) / 45, 0, 1) * 200, 1.5, this.dt || 0.016);
    const scale = R / this.mapRange;
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, R + 6, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(4,8,14,0.7)';
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = 'rgba(150,175,220,0.35)';
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, Math.PI * 2);
    ctx.clip();
    const ch = Math.cos(pv.heading), sh = Math.sin(pv.heading);
    ctx.translate(cx, cy);
    ctx.transform(-scale * ch, -scale * sh, scale * sh, -scale * ch, 0, 0);
    ctx.translate(-pv.x, -pv.z);
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    const reach = this.mapRange * 1.45;
    const c0 = Math.floor((pv.x - reach) / CELL), c1 = Math.floor((pv.x + reach) / CELL);
    const d0 = Math.floor((pv.z - reach) / CELL), d1 = Math.floor((pv.z + reach) / CELL);
    // dark outline pass, then each class from the small roads up
    for (let pass = 0; pass < 2; pass++) {
      for (let k = 3; k >= 0; k--) {
        ctx.strokeStyle = pass ? STYLE[k].c : 'rgba(0,0,0,0.8)';
        ctx.lineWidth = (pass ? STYLE[k].w : STYLE[k].w + 5) / scale * 0.5;
        for (let x = c0; x <= c1; x++) for (let z = d0; z <= d1; z++) {
          const e = this.cells.get(`${x},${z}`);
          if (e) ctx.stroke(e[k]);
        }
      }
    }
    ctx.restore();
    ctx.save();
    ctx.translate(cx, cy);
    ctx.beginPath();
    ctx.moveTo(0, -9); ctx.lineTo(6.5, 7); ctx.lineTo(0, 3.5); ctx.lineTo(-6.5, 7); ctx.closePath();
    ctx.fillStyle = C.cyan;
    ctx.shadowColor = C.cyan;
    ctx.shadowBlur = 8;
    ctx.fill();
    ctx.restore();
    // north (−z) on the rim
    text(ctx, 'N', cx - sh * (R - 10), cy + ch * (R - 10) + 4, { size: 11, color: C.dim, align: 'center', weight: 700 });
  }

  drawWhere(ctx) {
    const s = this.s;
    const pv = s.player.vehicle;
    const d = districtAt(pv.x, pv.z);
    text(ctx, d ? d.name : 'THE BAY', 40, 52, { size: 18, color: '#fff', weight: 900, spacing: 2 });
    const road = s.player.g?.road;
    if (road?.name) text(ctx, road.name, 40, 72, { size: 12, color: C.cyan, weight: 800, spacing: 2 });
    text(ctx, 'PORT HALCYON', 984, 52, { size: 13, color: C.dim, weight: 900, spacing: 3, align: 'right' });
  }
}
