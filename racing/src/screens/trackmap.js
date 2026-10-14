// Track preview drawing for menus: a GPS-style route map and an elevation
// strip, both computed from the real centerline (no world build needed).
import { Track } from '../track/track.js';
import { C, text } from '../core/ui.js';

const cache = new Map();

/** Cheap derived facts about a track: length, turn count, climb, 2D outline. */
export function trackInfo(def) {
  if (cache.has(def.id)) return cache.get(def.id);
  const T = new Track(def);
  const N = T.N;
  // turns: runs of real curvature that sweep more than ~25 degrees
  let turns = 0, run = 0;
  const thr = 1 / 160;
  for (let i = 0; i < N; i++) {
    const k = Math.abs(T.Ks[i]);
    if (k > thr) run += k * T.step;
    else { if (run > 0.44) turns++; run = 0; }
  }
  if (run > 0.44) turns++;
  let minY = Infinity, maxY = -Infinity, climb = 0;
  for (let i = 0; i < N; i++) {
    minY = Math.min(minY, T.Y[i]);
    maxY = Math.max(maxY, T.Y[i]);
    if (i) climb += Math.max(0, T.Y[i] - T.Y[i - 1]);
  }
  let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
  for (let i = 0; i < N; i++) {
    x0 = Math.min(x0, T.X[i]); x1 = Math.max(x1, T.X[i]);
    z0 = Math.min(z0, T.Z[i]); z1 = Math.max(z1, T.Z[i]);
  }
  const info = { T, length: T.length, closed: T.closed, turns, minY, maxY, climb, bounds: [x0, x1, z0, z1], startS: T.startS, finishS: T.finishS };
  cache.set(def.id, info);
  return info;
}

export function fmtDistance(m, units = 'mph') {
  return units === 'kmh' ? `${(m / 1000).toFixed(1)} KM` : `${(m / 1609.34).toFixed(1)} MI`;
}

/**
 * GPS route map. opts: { t (anim time), color, grid, north }.
 * The map is oriented so +z (the game's forward at heading 0) points up.
 */
export function drawTrackMap(ctx, def, x, y, w, h, opts = {}) {
  const info = trackInfo(def);
  const { T } = info;
  const [x0, x1, z0, z1] = info.bounds;
  const pad = 26;
  const sc = Math.min((w - pad * 2) / Math.max(1, x1 - x0), (h - pad * 2) / Math.max(1, z1 - z0));
  const cx = x + w / 2, cy = y + h / 2;
  const mx = (x0 + x1) / 2, mz = (z0 + z1) / 2;
  // world +x is the car's left when facing +z; draw +x to the left so the map
  // reads like looking down from above with +z up
  const P = (wx, wz) => [cx - (wx - mx) * sc, cy - (wz - mz) * sc];
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  // backdrop
  const bg = ctx.createLinearGradient(x, y, x, y + h);
  bg.addColorStop(0, 'rgba(8,16,24,0.92)');
  bg.addColorStop(1, 'rgba(4,8,14,0.92)');
  ctx.fillStyle = bg;
  ctx.fillRect(x, y, w, h);
  // grid every 100 m
  if (opts.grid !== false) {
    if (100 * sc > 6) {
      ctx.strokeStyle = 'rgba(70,232,255,0.07)';
      ctx.lineWidth = 1;
      const hw = w / 2 / sc, hh = h / 2 / sc;
      for (let gx = Math.ceil((mx - hw) / 100) * 100; gx <= mx + hw; gx += 100) {
        const sx = cx - (gx - mx) * sc;
        ctx.beginPath(); ctx.moveTo(sx, y); ctx.lineTo(sx, y + h); ctx.stroke();
      }
      for (let gz = Math.ceil((mz - hh) / 100) * 100; gz <= mz + hh; gz += 100) {
        const sy = cy - (gz - mz) * sc;
        ctx.beginPath(); ctx.moveTo(x, sy); ctx.lineTo(x + w, sy); ctx.stroke();
      }
    }
  }
  // the route
  const N = T.N;
  const every = Math.max(1, Math.floor(N / 600));
  const path = () => {
    ctx.beginPath();
    for (let i = 0; i < N; i += every) {
      const [px, py] = P(T.X[i], T.Z[i]);
      if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py);
    }
    if (T.closed) ctx.closePath();
    else { const [px, py] = P(T.X[N - 1], T.Z[N - 1]); ctx.lineTo(px, py); }
  };
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  path();
  ctx.strokeStyle = 'rgba(0,0,0,0.85)';
  ctx.lineWidth = 11;
  ctx.stroke();
  path();
  ctx.strokeStyle = opts.color || C.accent;
  ctx.shadowColor = opts.color || C.accent;
  ctx.shadowBlur = 12;
  ctx.lineWidth = 5;
  ctx.stroke();
  ctx.shadowBlur = 0;
  path();
  ctx.strokeStyle = 'rgba(255,240,200,0.55)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  // direction chevrons
  const chevrons = Math.max(4, Math.round(info.length / 450));
  for (let k = 0; k < chevrons; k++) {
    const s = ((k + 0.5) / chevrons) * info.length;
    const i = Math.min(N - 2, Math.floor(s / T.step));
    const [ax, ay] = P(T.X[i], T.Z[i]);
    const [bx, by] = P(T.X[i + 1], T.Z[i + 1]);
    const a = Math.atan2(by - ay, bx - ax);
    ctx.save();
    ctx.translate(ax, ay);
    ctx.rotate(a);
    ctx.fillStyle = '#1a1206';
    ctx.beginPath();
    ctx.moveTo(4, 0); ctx.lineTo(-3, -3.5); ctx.lineTo(-1, 0); ctx.lineTo(-3, 3.5);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
  // start / finish
  const mark = (s, kind) => {
    const i = Math.max(0, Math.min(N - 1, Math.round(((s % info.length) + info.length) % info.length / T.step)));
    const [px, py] = P(T.X[i], T.Z[i]);
    if (kind === 'start' && !T.closed) {
      ctx.fillStyle = C.green;
      ctx.beginPath(); ctx.arc(px, py, 6, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#000'; ctx.lineWidth = 2; ctx.stroke();
      return;
    }
    // checkered flag tile
    ctx.save();
    ctx.translate(px, py);
    for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++) {
      ctx.fillStyle = (a + b) % 2 ? '#111' : '#f4f4f4';
      ctx.fillRect(-7 + a * 4.7, -7 + b * 4.7, 4.7, 4.7);
    }
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(-7, -7, 14, 14);
    ctx.restore();
  };
  mark(info.startS, 'start');
  mark(T.closed ? info.startS : info.finishS, 'finish');
  // a blip running the route
  if (opts.t !== undefined) {
    const lapT = Math.max(6, info.length / 120);
    const s = info.startS + ((opts.t % lapT) / lapT) * (T.closed ? info.length : info.finishS - info.startS);
    const i = Math.max(0, Math.min(N - 1, Math.floor((((s % info.length) + info.length) % info.length) / T.step)));
    const [px, py] = P(T.X[i], T.Z[i]);
    ctx.fillStyle = '#fff';
    ctx.shadowColor = C.cyan;
    ctx.shadowBlur = 14;
    ctx.beginPath(); ctx.arc(px, py, 4.5, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0;
  }
  // scale bar
  const bar = 500 * sc;
  if (bar > 20 && bar < w * 0.5) {
    ctx.fillStyle = 'rgba(200,230,255,0.6)';
    ctx.fillRect(x + 16, y + h - 18, bar, 2);
    ctx.fillRect(x + 16, y + h - 22, 2, 8);
    ctx.fillRect(x + 16 + bar - 2, y + h - 22, 2, 8);
    text(ctx, '500 M', x + 22 + bar, y + h - 13, { size: 10, color: 'rgba(200,230,255,0.7)', weight: 700 });
  }
  ctx.restore();
  return info;
}

/** Elevation profile along the route. */
export function drawElevation(ctx, def, x, y, w, h) {
  const info = trackInfo(def);
  const { T } = info;
  const range = Math.max(12, info.maxY - info.minY);
  ctx.save();
  ctx.fillStyle = 'rgba(6,10,16,0.8)';
  ctx.fillRect(x, y, w, h);
  ctx.beginPath();
  ctx.moveTo(x, y + h);
  for (let k = 0; k <= 200; k++) {
    const i = Math.min(T.N - 1, Math.floor((k / 200) * (T.N - 1)));
    const py = y + h - 3 - ((T.Y[i] - info.minY) / range) * (h - 8);
    ctx.lineTo(x + (k / 200) * w, py);
  }
  ctx.lineTo(x + w, y + h);
  ctx.closePath();
  const g = ctx.createLinearGradient(0, y, 0, y + h);
  g.addColorStop(0, 'rgba(70,232,255,0.55)');
  g.addColorStop(1, 'rgba(70,232,255,0.05)');
  ctx.fillStyle = g;
  ctx.fill();
  ctx.strokeStyle = C.cyan;
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.restore();
}
