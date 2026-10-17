// FREE ROAM HUD: the race HUD's tach and radar (with the side roads and the
// tunnel mouths on it), the region you're in, a title card when you arrive
// somewhere new, and the world map with the ring of regions for fast travel.
import { HUD } from '../race/hud.js';
import { C, vText, text, panel } from '../core/ui.js';
import { clamp, damp } from '../core/util.js';
import { TRACK_BY_ID } from '../track/tracks.js';
import { MAP_POS, DISTRICT_NAMES, ring, links } from './network.js';

const TIME_NAMES = { night: 'NIGHT', dusk: 'DUSK', sunset: 'SUNSET', day: 'DAY', overcast: 'OVERCAST' };
const WEATHER_NAMES = { dry: 'DRY', wet: 'WET ROADS', rain: 'RAIN' };
const ENV_COLOR = { city: '#ff3d6e', docks: '#ffb21e', highway: '#a45cf0', circuit: '#4dff8b', mountain: '#46e8ff', desert: '#ff7a2a' };

export class RoamHUD extends HUD {
  buildMap() {
    super.buildMap();
    this.finishPos = null;
    const s = this.s;
    const plan = s.world?.roam;
    this.mapFor = s.track;
    this.portalMarks = [];
    if (!plan) return;
    const path = new Path2D(this.mapPath);
    for (const st of plan.stubs) {
      const pts = [];
      const L = Math.min(st.length, 140);
      for (let d = 0; d <= L; d += 4) { const p = st.posAt(d); pts.push([p.x, p.z]); }
      pts.forEach(([x, z], k) => (k ? path.lineTo(x, z) : path.moveTo(x, z)));
    }
    this.mapPath = path;
    for (const q of plan.portals) {
      this.portalMarks.push({ x: q.x + q.ax * 6, z: q.z + q.az * 6, to: q.to, name: TRACK_BY_ID[q.to]?.name || q.to, color: ENV_COLOR[TRACK_BY_ID[q.to]?.env] || C.accent });
    }
  }

  draw(ctx, dt) {
    this.t += dt;
    this.dt = dt;
    const s = this.s;
    if (!s.sim || s.phase === 'loading') return;
    if (this.mapFor !== s.track) this.buildMap();
    this.drawMinimap(ctx, 108, 652, 82);
    this.drawPortals(ctx, 108, 652, 82);
    this.drawTach(ctx, 908, 650, 96);
    this.drawMessages(ctx);
    this.drawWarnings(ctx);
    this.drawRegion(ctx);
  }

  /** Tunnel mouths on the radar: a coloured diamond, or an arrow on the rim when out of range. */
  drawPortals(ctx, cx, cy, R) {
    const s = this.s;
    const pv = s.player.vehicle;
    const scale = R / (this.mapRange || 190);
    const ch = Math.cos(pv.heading), sh = Math.sin(pv.heading);
    for (const m of this.portalMarks || []) {
      const dx = m.x - pv.x, dz = m.z - pv.z;
      // world → radar (car's nose up): screen x = −right·d, y = −fwd·d
      let px = scale * (sh * dz - ch * dx), py = -scale * (sh * dx + ch * dz);
      const d = Math.hypot(px, py);
      const out = d > R - 8;
      if (out) { px *= (R - 8) / d; py *= (R - 8) / d; }
      ctx.save();
      ctx.translate(cx + px, cy + py);
      ctx.fillStyle = m.color;
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 2;
      ctx.beginPath();
      if (out) {
        const a = Math.atan2(py, px);
        ctx.rotate(a);
        ctx.moveTo(7, 0); ctx.lineTo(-5, -5); ctx.lineTo(-5, 5);
      } else {
        ctx.moveTo(0, -7); ctx.lineTo(6, 0); ctx.lineTo(0, 7); ctx.lineTo(-6, 0);
      }
      ctx.closePath();
      ctx.stroke();
      ctx.fill();
      ctx.restore();
      if (!out) text(ctx, m.name.split(' ')[0], cx + px, cy + py - 10, { size: 10, color: m.color, align: 'center', weight: 900 });
    }
  }

  drawRegion(ctx) {
    const s = this.s;
    const def = s.def;
    const col = ENV_COLOR[def.env] || C.accent;
    // always: where you are
    text(ctx, def.name, 40, 52, { size: 18, color: '#fff', weight: 900, spacing: 2 });
    text(ctx, `${DISTRICT_NAMES[def.env] || ''}  ·  ${TIME_NAMES[def.time] || ''}`, 40, 72, { size: 12, color: col, weight: 800, spacing: 2 });
    text(ctx, 'FREE ROAM', 984, 52, { size: 13, color: C.dim, weight: 900, spacing: 3, align: 'right' });
    // a title card for a few seconds after arriving
    const t = s.arrivedT ?? 99;
    if (t < 4.2) {
      const a = clamp(Math.min((t - 0.3) / 0.4, (4.2 - t) / 0.6), 0, 1);
      if (a <= 0) return;
      ctx.save();
      ctx.globalAlpha = a;
      const g = ctx.createLinearGradient(0, 210, 0, 330);
      g.addColorStop(0, 'rgba(0,0,0,0)');
      g.addColorStop(0.5, 'rgba(0,0,0,0.55)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 210, 1024, 120);
      text(ctx, 'NOW ENTERING', 512, 242, { size: 14, color: col, weight: 900, spacing: 6, align: 'center' });
      vText(ctx, def.name, 512, 290, 46, { align: 'center', color: '#fff', outline: 3, outlineColor: 'rgba(0,0,0,0.7)' });
      text(ctx, `${DISTRICT_NAMES[def.env] || ''}   ·   ${TIME_NAMES[def.time] || ''}   ·   ${WEATHER_NAMES[def.weather] || ''}`, 512, 316, { size: 13, color: '#d8dee8', weight: 800, spacing: 3, align: 'center' });
      ctx.restore();
    }
  }
}

/** Black card while a region builds: where you're headed and a progress bar. */
export function drawRoamLoading(ctx, loading, t) {
  ctx.fillStyle = '#030406';
  ctx.fillRect(0, 0, 1024, 768);
  const def = loading.def;
  if (def) {
    const col = ENV_COLOR[def.env] || C.accent;
    text(ctx, 'NOW ENTERING', 512, 318, { size: 15, color: col, weight: 900, spacing: 6, align: 'center' });
    vText(ctx, def.name, 512, 372, 52, { align: 'center', color: '#fff', outline: 3, outlineColor: '#000' });
    text(ctx, `${DISTRICT_NAMES[def.env] || ''}   ·   ${TIME_NAMES[def.time] || ''}   ·   ${WEATHER_NAMES[def.weather] || ''}`, 512, 404, { size: 14, color: C.dim, weight: 800, spacing: 3, align: 'center' });
  }
  ctx.fillStyle = 'rgba(255,255,255,0.12)';
  ctx.fillRect(362, 470, 300, 4);
  ctx.fillStyle = C.accent;
  ctx.fillRect(362, 470, 300 * clamp(loading.f || 0, 0, 1), 4);
  if (Math.floor(t * 2) % 2) text(ctx, loading.label || '', 512, 500, { size: 12, color: C.dim, weight: 800, spacing: 3, align: 'center' });
}

/**
 * The world map: every region on the ring, the tunnels between them, where
 * you are. sel: index into ring() of the highlighted region.
 */
export function drawWorldMap(ctx, current, sel, t) {
  const R = ring();
  ctx.fillStyle = 'rgba(2,6,14,0.86)';
  ctx.fillRect(0, 0, 1024, 768);
  panel(ctx, 40, 70, 944, 560, { accent: C.cyan, accentLen: 300 });
  vText(ctx, 'PORT HALCYON', 66, 118, 34, { color: '#fff' });
  text(ctx, 'FREE ROAM  ·  THE TUNNELS JOIN EVERY ROAD IN TOWN', 68, 142, { size: 12, color: C.dim, weight: 800, spacing: 2 });
  const X = (p) => 90 + p[0] * 844, Y = (p) => 175 + p[1] * 420;
  // the ring of tunnels
  ctx.save();
  ctx.lineWidth = 3;
  ctx.setLineDash([7, 6]);
  ctx.strokeStyle = 'rgba(150,175,220,0.45)';
  ctx.beginPath();
  R.forEach((id, k) => {
    const a = MAP_POS[id], b = MAP_POS[R[(k + 1) % R.length]];
    if (!a || !b) return;
    ctx.moveTo(X(a), Y(a));
    ctx.lineTo(X(b), Y(b));
  });
  ctx.stroke();
  ctx.restore();
  // regions
  const cx0 = R.reduce((a, id) => a + (MAP_POS[id]?.[0] ?? 0.5), 0) / R.length;
  const cy0 = R.reduce((a, id) => a + (MAP_POS[id]?.[1] ?? 0.5), 0) / R.length;
  R.forEach((id, k) => {
    const def = TRACK_BY_ID[id];
    const p = MAP_POS[id];
    if (!def || !p) return;
    const x = X(p), y = Y(p);
    const col = ENV_COLOR[def.env] || C.accent;
    const here = id === current;
    const on = k === sel;
    const r = on ? 11 + Math.sin(t * 6) * 1.5 : here ? 9 : 7;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = here ? '#fff' : col;
    ctx.fill();
    ctx.lineWidth = on ? 3 : 2;
    ctx.strokeStyle = on ? '#fff' : '#000';
    ctx.stroke();
    if (here) {
      ctx.beginPath();
      ctx.arc(x, y, 15 + (t * 20) % 10, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(255,255,255,${0.6 - ((t * 20) % 10) / 18})`;
      ctx.stroke();
    }
    // label on the outside of the ring, away from its middle
    let dx = p[0] - cx0, dy = (p[1] - cy0) * 0.6;
    const dl = Math.hypot(dx, dy) || 1;
    dx /= dl; dy /= dl;
    const lx = x + dx * 16, ly = y + dy * 16 + (dy > 0.3 ? 10 : dy < -0.3 ? -2 : 4);
    const align = dx > 0.45 ? 'left' : dx < -0.45 ? 'right' : 'center';
    text(ctx, def.name, lx, ly, { size: on ? 13 : 11, color: on || here ? '#fff' : '#c8d0dc', weight: on || here ? 900 : 700, align });
  });
  // the highlighted region's card
  const id = R[sel];
  const def = TRACK_BY_ID[id];
  if (def) {
    const col = ENV_COLOR[def.env] || C.accent;
    panel(ctx, 60, 640, 904, 76, { accent: col, accentLen: 200, alpha: 0.92 });
    vText(ctx, def.name, 84, 676, 26, { color: '#fff' });
    text(ctx, `${DISTRICT_NAMES[def.env] || ''}  ·  ${TIME_NAMES[def.time] || ''}  ·  ${WEATHER_NAMES[def.weather] || ''}  ·  ${def.type === 'circuit' ? 'LOOP' : 'ROAD'}`, 86, 700, { size: 12, color: col, weight: 800, spacing: 2 });
    const L = links(id);
    if (L) text(ctx, `TUNNELS TO  ${TRACK_BY_ID[L.prev]?.name || ''}  ·  ${TRACK_BY_ID[L.next]?.name || ''}`, 940, 676, { size: 12, color: C.dim, weight: 800, align: 'right' });
    text(ctx, id === current ? 'YOU ARE HERE' : 'FAST TRAVEL: ✕ / ENTER', 940, 700, { size: 13, color: id === current ? C.dim : C.accent, weight: 900, spacing: 2, align: 'right' });
  }
}

export { damp };
