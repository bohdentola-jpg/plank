// The on-screen HUD, kept quiet: the current objective (top-left), the day,
// time and money (top-right), a minimap with Northstar's attention around its
// rim (bottom-left), the interaction prompt (bottom-centre), messages, and a
// marker in the world that shows where the objective is — or, when it's
// behind you or off-screen, an arrow at the edge pointing the way.
import * as THREE from 'three';
import { C, W, H, text, measure, actionGlyph, roundRect, tone } from '../core/ui.js';
import { TOWN } from '../world/townplan.js';
import { groundY } from '../world/terrain.js';
import { DAYS } from './state.js';

const DOW = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const _v = new THREE.Vector3();

function clock(hour) {
  const h = Math.floor(hour) % 24, m = Math.floor((hour % 1) * 60);
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
}

export class HUD {
  constructor() {
    this.prompt = null;      // {action, text}
    this.objective = null;   // {text, target: {x,z,y?}, sub}
    this.toasts = [];        // {title, body, t, color}
    this.markers = [];       // {x, z, color, icon}
    this.watched = 0;        // 0..1 eye openness
    this.visible = true;
    this.flash = null;
    this._objT = 0;          // time since the objective changed (for the reveal)
    this._lastObj = null;
  }

  toast(title, body, color = C.accent) {
    this.toasts.push({ title, body, t: 0, color });
    if (this.toasts.length > 3) this.toasts.shift();
  }

  update(dt) {
    for (const t of this.toasts) t.t += dt;
    this.toasts = this.toasts.filter((t) => t.t < 6);
    if (this.objective?.text !== this._lastObj) { this._lastObj = this.objective?.text; this._objT = 0; }
    this._objT += dt;
  }

  draw(ctx, g) {
    if (!this.visible) return;
    const s = g.state;
    // ---------------------------------------------------- world marker
    if (this.objective?.target && g.camera && g.player) this._worldMarker(ctx, g, this.objective.target, C.accent);
    if (this.waypoint && g.camera && g.player) this._worldMarker(ctx, g, this.waypoint, '#b9a6e0', true);
    // ---------------------------------------------------- objective
    if (this.objective) {
      const o = this.objective;
      const k = Math.min(1, this._objT * 3);
      ctx.save();
      ctx.globalAlpha = k;
      const x = 40 + (1 - k) * -12, y = 50;
      const fresh = this._objT < 4;
      text(ctx, fresh ? 'NEW OBJECTIVE' : 'OBJECTIVE', x, y, { size: 11, weight: 600, color: C.accent, spacing: 2.5 });
      text(ctx, o.text, x, y + 26, { size: 19, weight: 500, color: '#fff' });
      let yy = y + 26;
      if (o.sub) { yy += 22; text(ctx, o.sub, x, yy, { size: 14, weight: 400, color: '#c3cad1' }); }
      ctx.restore();
      // other open objectives, smaller
      let oy = yy + 30, shown = 0;
      for (const o2 of this.objectives?.values?.() || []) {
        if (o2 === this.objective || shown >= 2) continue;
        text(ctx, o2.text, 40, oy, { size: 13, weight: 400, color: 'rgba(214,220,226,0.62)' });
        oy += 20; shown++;
      }
    }
    // ---------------------------------------------------- clock
    {
      const x = W - 40;
      text(ctx, `${DOW[(s.day - 1) % 7]}  ·  Day ${s.day}`, x, 44, { size: 12, weight: 500, color: '#c3cad1', align: 'right', spacing: 1 });
      text(ctx, clock(s.hour), x, 74, { size: 24, weight: 300, color: '#fff', align: 'right' });
      text(ctx, `$${Math.floor(s.money)}`, x, 98, { size: 14, weight: 500, color: '#b9d9be', align: 'right' });
      const left = DAYS - s.day;
      const msg = left > 0 ? `Wormwood wakes in ${left} day${left === 1 ? '' : 's'}` : 'Wormwood wakes at dawn';
      text(ctx, msg, x, 120, { size: 12, weight: 500, color: left <= 1 ? C.red : C.dim, align: 'right' });
    }
    // ---------------------------------------------------- minimap + attention
    this._radar(ctx, g, s.attention, this.watched);
    // ---------------------------------------------------- prompt
    if (this.prompt) {
      const p = this.prompt;
      const tw = measure(ctx, p.text, { size: 16, weight: 500 });
      const gw = 22;
      const w = tw + gw + 34;
      const x = W / 2 - w / 2, y = H - 112;
      ctx.save();
      roundRect(ctx, x, y - 20, w, 40, 6);
      ctx.fillStyle = 'rgba(10,12,15,0.62)';
      ctx.fill();
      ctx.restore();
      const used = actionGlyph(ctx, p.action || 'interact', x + 12, y, 10.5);
      text(ctx, p.text, x + 22 + used, y + 6, { size: 16, weight: 500, color: '#fff' });
    }
    // ---------------------------------------------------- messages
    let ty = 150;
    for (const t of this.toasts) {
      const a = Math.min(1, t.t * 4) * Math.min(1, (6 - t.t) * 2);
      const tw = Math.max(measure(ctx, t.body, { size: 15, weight: 400 }), measure(ctx, t.title, { size: 11, weight: 600, spacing: 2 })) + 40;
      const w = Math.min(600, Math.max(240, tw));
      const x = W - 40 - w + (1 - Math.min(1, t.t * 4)) * 30;
      ctx.save();
      ctx.globalAlpha = a;
      roundRect(ctx, x, ty, w, 58, 6);
      ctx.fillStyle = 'rgba(10,12,15,0.74)';
      ctx.fill();
      ctx.fillStyle = t.color ? toneColor(t.color) : C.accent;
      ctx.fillRect(x, ty + 10, 2, 38);
      text(ctx, t.title, x + 18, ty + 23, { size: 11, weight: 600, color: toneColor(t.color), spacing: 2 });
      text(ctx, t.body, x + 18, ty + 44, { size: 15, weight: 400, color: '#fff' });
      ctx.restore();
      ty += 66;
    }
  }

  /** A diamond over the target with its distance; an edge arrow when it's off-screen. */
  _worldMarker(ctx, g, tg, color, small = false) {
    const cam = g.camera, P = g.player.pos;
    const dist = Math.hypot(tg.x - P.x, tg.z - P.z);
    if (dist < 2.5) return;
    const y = (tg.y ?? groundY(tg.x, tg.z)) + (small ? 2.2 : 2.0);
    _v.set(tg.x, y, tg.z).project(cam);
    const behind = _v.z > 1;
    let sx = (_v.x * 0.5 + 0.5) * W, sy = (1 - (_v.y * 0.5 + 0.5)) * H;
    if (behind) { sx = W - sx; sy = H - sy; }
    const m = 56;
    const onScreen = !behind && sx > m && sx < W - m && sy > m && sy < H - m;
    const near = Math.min(1, Math.max(0, (dist - 2.5) / 6));
    ctx.save();
    ctx.globalAlpha = near * (small ? 0.8 : 1);
    if (onScreen) {
      const r = small ? 6 : 8;
      ctx.translate(sx, sy);
      ctx.shadowColor = 'rgba(0,0,0,0.5)';
      ctx.shadowBlur = 4;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(0, -r); ctx.lineTo(r * 0.8, 0); ctx.lineTo(0, r); ctx.lineTo(-r * 0.8, 0);
      ctx.closePath();
      ctx.fill();
      ctx.shadowColor = 'transparent';
      if (!small) text(ctx, `${Math.round(dist)} m`, 0, r + 18, { size: 13, weight: 500, color: '#fff', align: 'center' });
    } else {
      // clamp to the screen edge along the direction from the centre
      const cx = W / 2, cy = H / 2;
      let dx = sx - cx, dy = sy - cy;
      if (behind && Math.abs(dy) < 1) dy = 1;
      const kx = (W / 2 - m) / Math.max(1e-3, Math.abs(dx)), ky = (H / 2 - m) / Math.max(1e-3, Math.abs(dy));
      const k = Math.min(kx, ky);
      const ex = cx + dx * k;
      let ey = cy + dy * k;
      if (ex < 300 && ey > H - 300) ey = H - 300; // keep clear of the minimap
      const ang = Math.atan2(dy, dx);
      ctx.translate(ex, ey);
      ctx.rotate(ang);
      ctx.fillStyle = color;
      ctx.shadowColor = 'rgba(0,0,0,0.5)';
      ctx.shadowBlur = 4;
      ctx.beginPath();
      ctx.moveTo(14, 0); ctx.lineTo(-4, -9); ctx.lineTo(0, 0); ctx.lineTo(-4, 9);
      ctx.closePath();
      ctx.fill();
      ctx.rotate(-ang);
      ctx.shadowColor = 'transparent';
      if (!small) text(ctx, `${Math.round(dist)} m`, -Math.cos(ang) * 26, -Math.sin(ang) * 26 + 5, { size: 12, weight: 500, color: '#fff', align: 'center' });
    }
    ctx.restore();
  }

  _radar(ctx, g, attention, open) {
    const R = 82, cx = 40 + R, cy = H - 40 - R;
    const p = g.player?.pos;
    if (!p) return;
    const scale = R / 120; // metres shown to the edge
    const rot = -(g.camYaw ?? 0) - Math.PI; // heading-up
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(14,18,22,0.72)';
    ctx.fill();
    ctx.clip();
    const tf = (x, z) => {
      const dx = (x - p.x) * scale, dz = (z - p.z) * scale;
      const c = Math.cos(rot), s = Math.sin(rot);
      return [cx + dx * c - dz * s, cy + dx * s + dz * c];
    };
    // sea below the shore
    if (g.shoreZ) {
      ctx.fillStyle = 'rgba(40,62,84,0.55)';
      ctx.beginPath();
      for (let x = p.x - 200; x <= p.x + 200; x += 20) { const [a, b] = tf(x, g.shoreZ(x)); x === p.x - 200 ? ctx.moveTo(a, b) : ctx.lineTo(a, b); }
      for (let x = p.x + 200; x >= p.x - 200; x -= 40) { const [a, b] = tf(x, p.z + 400); ctx.lineTo(a, b); }
      ctx.fill();
    }
    // streets
    ctx.lineCap = 'round';
    for (const st of TOWN.streets) {
      ctx.strokeStyle = st.dirt ? 'rgba(170,176,182,0.32)' : 'rgba(205,210,215,0.5)';
      ctx.lineWidth = Math.max(2, st.width * scale * 0.8);
      ctx.beginPath();
      st.pts.forEach(([x, z], i) => { const [a, b] = tf(x, z); i ? ctx.lineTo(a, b) : ctx.moveTo(a, b); });
      ctx.stroke();
    }
    // buildings
    for (const b of g.buildingRects || []) {
      if (Math.abs(b.x - p.x) > 170 || Math.abs(b.z - p.z) > 170) continue;
      const corners = [[-b.w / 2, -b.d / 2], [b.w / 2, -b.d / 2], [b.w / 2, b.d / 2], [-b.w / 2, b.d / 2]];
      ctx.beginPath();
      corners.forEach(([lx, lz], i) => {
        const c = Math.cos(b.rot), s = Math.sin(b.rot);
        const [a, bb] = tf(b.x + lx * c + lz * s, b.z - lx * s + lz * c);
        i ? ctx.lineTo(a, bb) : ctx.moveTo(a, bb);
      });
      ctx.closePath();
      ctx.fillStyle = 'rgba(120,128,138,0.55)';
      ctx.fill();
    }
    ctx.restore();
    // markers (clamped to the rim)
    for (const mk of this.markers) {
      let [a, b] = tf(mk.x, mk.z);
      const dx = a - cx, dy = b - cy, d = Math.hypot(dx, dy);
      if (d > R - 7) { a = cx + dx / d * (R - 7); b = cy + dy / d * (R - 7); }
      ctx.fillStyle = toneColor(mk.color) || C.accent;
      ctx.strokeStyle = 'rgba(0,0,0,0.6)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      if (mk.icon === 'diamond') { ctx.moveTo(a, b - 6); ctx.lineTo(a + 5, b); ctx.lineTo(a, b + 6); ctx.lineTo(a - 5, b); ctx.closePath(); }
      else ctx.arc(a, b, mk.r || 3.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
    // rim: Northstar's attention fills it, amber → red
    const k = Math.min(1, (attention || 0) / 100);
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(255,255,255,0.14)';
    ctx.beginPath(); ctx.arc(cx, cy, R + 4, 0, Math.PI * 2); ctx.stroke();
    if (k > 0) {
      ctx.strokeStyle = k > 0.75 ? C.red : k > 0.4 ? '#e58a3c' : '#d8b26a';
      ctx.beginPath(); ctx.arc(cx, cy, R + 4, -Math.PI / 2, -Math.PI / 2 + k * Math.PI * 2); ctx.stroke();
    }
    // north tick
    const na = rot - Math.PI / 2;
    text(ctx, 'N', cx + Math.cos(na) * (R - 10), cy + Math.sin(na) * (R - 10) + 4, { size: 11, weight: 600, color: '#fff', align: 'center' });
    // player arrow
    const fa = (g.player.yaw ?? 0);
    const ang = -fa - rot + Math.PI;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(-ang + Math.PI);
    ctx.fillStyle = '#fff';
    ctx.shadowColor = 'rgba(0,0,0,0.6)';
    ctx.shadowBlur = 3;
    ctx.beginPath(); ctx.moveTo(0, -7); ctx.lineTo(5.5, 6); ctx.lineTo(0, 3); ctx.lineTo(-5.5, 6); ctx.closePath(); ctx.fill();
    ctx.restore();
    // the eye: opens when something is watching you
    const ex = cx + R * 0.71 + 6, ey = cy - R * 0.71 - 6;
    const o = Math.max(0.12, open || 0);
    const watching = (open || 0) > 0.3 && !!this.danger;
    const seen = (open || 0) > 0.3;
    ctx.save();
    ctx.beginPath();
    ctx.arc(ex, ey, 15, 0, Math.PI * 2);
    ctx.fillStyle = watching ? 'rgba(120,24,20,0.9)' : 'rgba(14,18,22,0.85)';
    ctx.fill();
    ctx.strokeStyle = watching ? C.red : seen ? 'rgba(255,255,255,0.6)' : 'rgba(255,255,255,0.25)';
    ctx.lineWidth = 1.2;
    ctx.stroke();
    ctx.fillStyle = watching || seen ? '#fff' : 'rgba(225,230,235,0.75)';
    ctx.beginPath();
    ctx.moveTo(ex - 9, ey);
    ctx.quadraticCurveTo(ex, ey - 9 * o, ex + 9, ey);
    ctx.quadraticCurveTo(ex, ey + 9 * o, ex - 9, ey);
    ctx.fill();
    if (o > 0.3) { ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(ex, ey, 2.6 * o, 0, Math.PI * 2); ctx.fill(); }
    ctx.restore();
    if (watching) text(ctx, 'WATCHED', ex + 22, ey + 4, { size: 11, weight: 600, color: C.red, spacing: 2 });
    else if (k > 0.02) text(ctx, `Attention ${Math.round(k * 100)}%`, cx, cy + R + 24, { size: 11, weight: 500, color: k > 0.75 ? C.red : C.dim, align: 'center' });
  }
}

function toneColor(c) { return c === '#c792ea' ? '#b9a6e0' : tone(c) || C.accent; }
