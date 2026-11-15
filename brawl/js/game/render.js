// Drawing fighters (in a match and as stand-alone portraits) and the world.

import { W, H, G, PLAYER_COLORS } from '../core/config.js';
import { clamp, TAU } from '../core/util.js';
import { blankSnap } from '../core/input.js';
import { tintPalette, shadow, OUT, txt, circle, rr, fs, rrect, rgba, lighten, darken, polygon } from '../core/gfx.js';
import { groundBelow } from './physics.js';
import { VIEW_CY } from './camera.js';

const FADE = { roll: 1, spotdodge: 1, airdodge: 1, tech: 1 };

export function drawFighter(ctx, f, m) {
  if (f.out || f.state === 'dead' || !f.pose) return;
  let pal = f.pal;
  if (f.flash > 0) pal = tintPalette(pal, f.flashColor, Math.min(1, f.flash / 4) * 0.85);
  else if (f.invuln > 0 && !FADE[f.state] && f.state !== 'ledgeclimb' && f.state !== 'getup' && m.frame % 6 < 3) pal = tintPalette(pal, '#ffffff', 0.5);
  else if (f.superReady && m.frame % 16 < 8) pal = tintPalette(pal, '#fff3a0', 0.3);
  f.drawPal = pal;
  const h = f.def.hooks;
  if (h && h.drawBack) h.drawBack(ctx, f, m);
  ctx.save();
  if (FADE[f.state] && f.invuln > 0) ctx.globalAlpha = 0.5;
  ctx.translate(f.x + f.shakeX, f.y);
  ctx.scale(f.facing * f.scale, f.scale);
  if (f.overrideDraw) f.overrideDraw(ctx, f, m); else f.def.draw(ctx, f, f.pose, m);
  ctx.restore();
  if (f.shielding) drawShield(ctx, f, m);
  if (h && h.drawFront) h.drawFront(ctx, f, m);
}

function drawShield(ctx, f, m) {
  const k = clamp(f.shieldHP / G.shieldMax, 0.12, 1);
  const r = (f.h * f.scale * 0.6 + 6) * (0.45 + 0.55 * k);
  const x = f.x, y = f.cy;
  ctx.save();
  ctx.globalAlpha = 0.5;
  circle(ctx, x, y, r, f.color, null, 0);
  ctx.globalAlpha = 0.9;
  ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.strokeStyle = lighten(f.color, 0.5); ctx.lineWidth = 3; ctx.stroke();
  ctx.beginPath(); ctx.ellipse(x - r * 0.35, y - r * 0.4, r * 0.3, r * 0.16, -0.6, 0, TAU);
  ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.fill();
  ctx.restore();
}

export function drawShadows(ctx, m) {
  for (const f of m.fighters) {
    if (f.out || f.state === 'dead' || f.def.noShadow) continue;
    const g = f.grounded ? f.ground : groundBelow(m.stage, f.x, f.y - 4, 420);
    if (!g) continue;
    const d = clamp((g.y - f.y) / 420, 0, 1);
    shadow(ctx, f.x, g.y + 2, f.w * f.scale * (0.62 - d * 0.3), 0.26 * (1 - d * 0.7));
  }
}

// the little floating desk a fighter rides back in on
export function drawRespawn(ctx, f, m) {
  if (f.state !== 'respawn') return;
  const y = f.y + 3, x = f.x, w = Math.max(54, f.w * 1.5);
  ctx.save();
  // hover glow
  ctx.globalAlpha = 0.5 + Math.sin(m.real * 0.2) * 0.15;
  ctx.beginPath(); ctx.ellipse(x, y + 16, w * 0.42, 5, 0, 0, TAU); ctx.fillStyle = '#bff3ff'; ctx.fill();
  ctx.globalAlpha = 1;
  rrect(ctx, x - w / 2, y, w, 9, 3, '#c98b4b');
  rrect(ctx, x - w / 2 + 3, y + 9, w - 6, 5, 2, '#9c6a36');
  ctx.strokeStyle = OUT; ctx.lineWidth = 2.6;
  ctx.beginPath(); ctx.moveTo(x - w / 2 + 8, y + 14); ctx.lineTo(x - w / 2 + 5, y + 22); ctx.moveTo(x + w / 2 - 8, y + 14); ctx.lineTo(x + w / 2 - 5, y + 22); ctx.stroke();
  ctx.restore();
}

// Name tags over heads, and bubbles for anyone the camera has lost.
export function drawTags(ctx, m) {
  const cam = m.cam;
  for (const f of m.fighters) {
    if (f.out || f.state === 'dead') continue;
    const top = f.y - f.h * f.scale - 16;
    let [sx, sy] = cam.toScreen(f.x, top);
    const off = sx < 14 || sx > W - 14 || sy < 8 || sy > H - 78;
    if (!off) {
      if (m.state !== 'over' && (m.frame < 400 || f.state === 'respawn' || f.invuln > 0 || m.fighters.length > 2)) {
        const col = f.color;
        polygon(ctx, [sx - 6, sy - 4, sx + 6, sy - 4, sx, sy + 5], col, OUT, 2);
        txt(ctx, f.tag, sx, sy - 13, { font: 'boog', size: 15, fill: '#ffffff', stroke: OUT, lw: 3.5 });
      }
      continue;
    }
    // off-screen: pin a bubble to the nearest edge
    const [cx0, cy0] = cam.toScreen(f.x, f.cy);
    const bx = clamp(cx0, 30, W - 30), by = clamp(cy0, 30, H - 104);
    const ang = Math.atan2(cy0 - by, cx0 - bx);
    ctx.save();
    ctx.translate(bx, by);
    polygon(ctx, [Math.cos(ang) * 30, Math.sin(ang) * 30, Math.cos(ang + 0.5) * 20, Math.sin(ang + 0.5) * 20, Math.cos(ang - 0.5) * 20, Math.sin(ang - 0.5) * 20], f.color, OUT, 2);
    circle(ctx, 0, 0, 22, '#ffffff', OUT, 3);
    ctx.beginPath(); ctx.arc(0, 0, 20, 0, TAU); ctx.clip();
    ctx.fillStyle = lighten(f.color, 0.7); ctx.fillRect(-22, -22, 44, 44);
    const s = 36 / Math.max(f.h, f.w);
    ctx.translate(0, f.h * s * 0.5); ctx.scale(f.facing * s, s);
    f.drawPal = f.pal;
    f.def.draw(ctx, f, f.pose, m);
    ctx.restore();
    ctx.beginPath(); ctx.arc(bx, by, 22, 0, TAU); ctx.strokeStyle = f.color; ctx.lineWidth = 3; ctx.stroke();
  }
}

// ------------------------------------------------------------------------
// A stand-in fighter for menus: lets us pose and draw a character without a
// match running.
export function dummyFighter(def, costume = 0, state = 'idle') {
  const st = Object.assign({}, G.stats, def.stats);
  const f = {
    def, slot: 0, costume, pal: def.costumes[costume % def.costumes.length].pal, st,
    w: st.w, h: st.h, scale: 1, x: 0, y: 0, vx: 0, vy: 0, kx: 0, ky: 0, facing: 1,
    grounded: true, ground: null, state, sf: 0, t: 0, cycle: 0, lag: 4, rollDir: 1,
    move: null, moveId: '', mf: 0, charge: 0, freeze: 0, invuln: 0, flash: 0, shakeX: 0,
    pct: 0, stocks: 3, jumps: 1, tumble: false, stunKind: 'dizzy', pummelT: 0, shieldHP: G.shieldMax,
    inp: blankSnap(), v: {}, color: PLAYER_COLORS[0], superReady: false, isDummy: true,
    hook() {}, m: null,
  };
  if (def.hooks && def.hooks.init) { try { def.hooks.init(f, null); } catch (e) { /* menu dummy: no match */ } }
  f.pose = def.pose(f, null); f.pts = def.points ? def.points(f, f.pose) : null;
  return f;
}
export function tickDummy(f, state) {
  if (state && state !== f.state) { f.state = state; f.sf = 0; f.move = null; }
  f.t++; f.sf++;
  if (f.state === 'run' || f.state === 'walk') f.cycle += f.state === 'run' ? f.st.run : f.st.walk;
  if (f.state === 'move' && f.move) { f.mf++; if (f.mf >= f.move.frames) { f.state = 'idle'; f.move = null; f.sf = 0; } }
  f.pose = f.def.pose(f, null);
}
export function dummyMove(f, id) {
  const mv = f.def.moves[id];
  if (!mv) return false;
  f.state = 'move'; f.move = mv; f.moveId = id; f.mf = 0; f.sf = 0;
  return true;
}
export function drawDummy(ctx, f, x, y, scale = 1, facing = 1, pal) {
  f.drawPal = pal || f.pal;
  ctx.save();
  ctx.translate(x, y); ctx.scale(facing * scale, scale);
  f.def.draw(ctx, f, f.pose, null);
  ctx.restore();
}

// Head-and-shoulders portrait clipped to a rounded box. Each fighter file can
// say where its face is with def.portrait = {x, y, s}.
const _pd = new Map();
export function drawPortrait(ctx, def, costume, x, y, w, h, o = {}) {
  const key = def.id + '|' + costume;
  let d = _pd.get(key);
  if (!d) { d = dummyFighter(def, costume); _pd.set(key, d); }
  const pr = def.portrait || { x: 0, y: -def.stats.h * 0.72, s: 1.5 };
  ctx.save();
  rr(ctx, x, y, w, h, o.r === undefined ? 6 : o.r); ctx.clip();
  if (o.bg) { ctx.fillStyle = o.bg; ctx.fillRect(x, y, w, h); }
  const s = pr.s * (Math.min(w, h) / 44);
  ctx.translate(x + w / 2 - pr.x * s * (o.flip ? -1 : 1), y + h / 2 - pr.y * s);
  ctx.scale(s * (o.flip ? -1 : 1), s);
  d.drawPal = o.pal || d.pal;
  if (o.silhouette) d.drawPal = tintPalette(d.pal, '#101014', 1);
  def.draw(ctx, d, d.pose, null);
  ctx.restore();
}

export { VIEW_CY };
