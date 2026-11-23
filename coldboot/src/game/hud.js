// The on-screen HUD: calendar + clock + money (top-left), the earpiece's
// current objective, a heading-up radar (top-right), interaction prompts,
// Northstar's attention eye, and incoming messages.
import { C, W, H, text, panel, actionGlyph, roundRect, vText } from '../core/ui.js';
import { vWidth } from '../core/ui.js';
import { TOWN } from '../world/townplan.js';

const DOW = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];

export class HUD {
  constructor() {
    this.prompt = null;      // {action, text}
    this.objective = null;   // {text, target: {x,z}}
    this.toasts = [];        // {title, body, t, color}
    this.markers = [];       // {x, z, color, icon}
    this.watched = 0;        // 0..1 eye openness
    this.visible = true;
    this.flash = null;
  }

  toast(title, body, color = C.accent) {
    this.toasts.push({ title, body, t: 0, color });
    if (this.toasts.length > 3) this.toasts.shift();
  }

  update(dt) {
    for (const t of this.toasts) t.t += dt;
    this.toasts = this.toasts.filter((t) => t.t < 6);
  }

  draw(ctx, g) {
    if (!this.visible) return;
    const s = g.state;
    // ---------------------------------------------------- calendar / clock
    const h = Math.floor(s.hour) % 24, m = Math.floor((s.hour % 1) * 60);
    panel(ctx, 24, 22, 286, 66, { accentLen: 90 });
    vText(ctx, `DAY ${s.day}`, 44, 52, 22, { color: '#fff', weight: 0.17 });
    text(ctx, DOW[(s.day - 1) % 7], 44 + vWidth(`DAY ${s.day}`, 22) + 10, 52, { size: 15, weight: 800, color: C.dim, spacing: 2 });
    vText(ctx, `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`, 290, 52, 22, { color: C.accent, weight: 0.17, align: 'right' });
    text(ctx, `$${Math.floor(s.money)}`, 44, 76, { size: 15, weight: 800, color: '#9fe8b0' });
    const left = 14 - s.day;
    text(ctx, left > 0 ? `WORMWOOD WAKES IN ${left} DAY${left === 1 ? '' : 'S'}` : 'WORMWOOD WAKES AT DAWN', 290, 76, { size: 11, weight: 800, color: left <= 3 ? C.red : C.dim, align: 'right', spacing: 1 });
    // ---------------------------------------------------- objective
    if (this.objective) {
      const o = this.objective;
      let dist = '';
      if (o.target && g.player) {
        const d = Math.hypot(o.target.x - g.player.pos.x, o.target.z - g.player.pos.z);
        dist = d > 15 ? `  ${Math.round(d)} m` : '';
      }
      text(ctx, '◆', 34, 116, { size: 14, color: '#ffd166' });
      text(ctx, o.text + dist, 54, 116, { size: 16, weight: 700, color: '#fff' });
      if (o.sub) text(ctx, o.sub, 54, 136, { size: 13, weight: 600, color: C.dim });
    }
    // ---------------------------------------------------- radar
    this._radar(ctx, g);
    // ---------------------------------------------------- attention eye
    this._eye(ctx, s.attention, this.watched);
    // ---------------------------------------------------- prompt
    if (this.prompt) {
      const p = this.prompt;
      const tw = ctx.measureText ? p.text.length * 9.5 : 200;
      const x = W / 2 - (tw + 60) / 2, y = H - 86;
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      roundRect(ctx, x, y - 22, tw + 60, 40, 6);
      ctx.fill();
      const gw = actionGlyph(ctx, p.action || 'interact', x + 12, y - 2, 11);
      text(ctx, p.text, x + 22 + gw, y + 4, { size: 17, weight: 700, color: '#fff' });
    }
    // ---------------------------------------------------- messages
    let ty = 250;
    for (const t of this.toasts) {
      const a = Math.min(1, t.t * 4) * Math.min(1, (6 - t.t) * 2);
      const x = W - 24 - 330 + (1 - Math.min(1, t.t * 4)) * 60;
      ctx.save();
      ctx.globalAlpha = a;
      panel(ctx, x, ty, 330, 64, { accent: t.color, accentLen: 120 });
      text(ctx, t.title, x + 22, ty + 24, { size: 13, weight: 800, color: t.color, spacing: 2 });
      text(ctx, t.body, x + 22, ty + 46, { size: 15, weight: 600, color: '#fff' });
      ctx.restore();
      ty += 74;
    }
  }

  _radar(ctx, g) {
    const R = 92, cx = W - 24 - R, cy = 24 + R;
    const p = g.player?.pos;
    if (!p) return;
    const scale = R / 130; // metres shown to the edge
    const rot = -(g.camYaw ?? 0) - Math.PI; // heading-up
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(8,14,20,0.78)';
    ctx.fill();
    ctx.clip();
    const tf = (x, z) => {
      const dx = (x - p.x) * scale, dz = (z - p.z) * scale;
      const c = Math.cos(rot), s = Math.sin(rot);
      return [cx + dx * c - dz * s, cy + dx * s + dz * c];
    };
    // sea tint below the shore
    ctx.fillStyle = 'rgba(30,60,90,0.35)';
    ctx.beginPath();
    for (let x = p.x - 200; x <= p.x + 200; x += 20) { const [a, b] = tf(x, g.shoreZ(x)); x === p.x - 200 ? ctx.moveTo(a, b) : ctx.lineTo(a, b); }
    for (let x = p.x + 200; x >= p.x - 200; x -= 40) { const [a, b] = tf(x, p.z + 400); ctx.lineTo(a, b); }
    ctx.fill();
    // streets
    ctx.lineCap = 'round';
    for (const st of TOWN.streets) {
      ctx.strokeStyle = st.dirt ? 'rgba(150,160,170,0.35)' : 'rgba(190,200,210,0.55)';
      ctx.lineWidth = Math.max(2, st.width * scale * 0.8);
      ctx.beginPath();
      st.pts.forEach(([x, z], i) => { const [a, b] = tf(x, z); i ? ctx.lineTo(a, b) : ctx.moveTo(a, b); });
      ctx.stroke();
    }
    // buildings
    for (const b of g.buildingRects || []) {
      if (Math.abs(b.x - p.x) > 180 || Math.abs(b.z - p.z) > 180) continue;
      const corners = [[-b.w / 2, -b.d / 2], [b.w / 2, -b.d / 2], [b.w / 2, b.d / 2], [-b.w / 2, b.d / 2]];
      ctx.beginPath();
      corners.forEach(([lx, lz], i) => {
        const c = Math.cos(b.rot), s = Math.sin(b.rot);
        const [a, bb] = tf(b.x + lx * c + lz * s, b.z - lx * s + lz * c);
        i ? ctx.lineTo(a, bb) : ctx.moveTo(a, bb);
      });
      ctx.closePath();
      ctx.fillStyle = b.color || 'rgba(120,130,145,0.6)';
      ctx.fill();
    }
    // markers
    for (const mk of this.markers) {
      let [a, b] = tf(mk.x, mk.z);
      const dx = a - cx, dy = b - cy, d = Math.hypot(dx, dy);
      if (d > R - 8) { a = cx + dx / d * (R - 8); b = cy + dy / d * (R - 8); }
      ctx.fillStyle = mk.color || '#ffd166';
      ctx.beginPath();
      if (mk.icon === 'diamond') { ctx.moveTo(a, b - 6); ctx.lineTo(a + 5, b); ctx.lineTo(a, b + 6); ctx.lineTo(a - 5, b); }
      else ctx.arc(a, b, mk.r || 3.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
    // ring, north tick, player arrow
    ctx.strokeStyle = 'rgba(127,230,255,0.45)';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.stroke();
    const na = rot - Math.PI / 2;
    const nx = cx + Math.cos(na) * (R - 1), ny = cy + Math.sin(na) * (R - 1);
    text(ctx, 'N', nx, ny + 5, { size: 13, weight: 900, color: '#fff', align: 'center' });
    const fa = (g.player.yaw ?? 0);
    const ang = -fa - rot + Math.PI;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(-ang + Math.PI);
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.moveTo(0, -8); ctx.lineTo(6, 6); ctx.lineTo(0, 3); ctx.lineTo(-6, 6); ctx.closePath(); ctx.fill();
    ctx.restore();
  }

  _eye(ctx, attention, open) {
    const x = 70, y = H - 70;
    ctx.save();
    // attention ring
    ctx.strokeStyle = 'rgba(255,255,255,0.12)';
    ctx.lineWidth = 5;
    ctx.beginPath(); ctx.arc(x, y, 30, 0, Math.PI * 2); ctx.stroke();
    const k = Math.min(1, attention / 100);
    ctx.strokeStyle = k > 0.75 ? C.red : k > 0.4 ? '#ffb21e' : C.accent;
    ctx.beginPath(); ctx.arc(x, y, 30, -Math.PI / 2, -Math.PI / 2 + k * Math.PI * 2); ctx.stroke();
    // the eye opens when something is watching
    const o = Math.max(0.08, open);
    ctx.fillStyle = open > 0.3 ? 'rgba(255,90,80,0.9)' : 'rgba(220,230,240,0.55)';
    ctx.beginPath();
    ctx.moveTo(x - 18, y);
    ctx.quadraticCurveTo(x, y - 16 * o, x + 18, y);
    ctx.quadraticCurveTo(x, y + 16 * o, x - 18, y);
    ctx.fill();
    if (o > 0.25) { ctx.fillStyle = '#0a0a0a'; ctx.beginPath(); ctx.arc(x, y, 5 * o, 0, Math.PI * 2); ctx.fill(); }
    ctx.restore();
    text(ctx, 'NORTHSTAR', x, y + 48, { size: 10, weight: 800, color: C.dim, align: 'center', spacing: 2 });
  }
}
