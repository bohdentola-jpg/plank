// AFTER HOURS - the school at night, cut open like a dollhouse. The upper
// floors are thin enough to jump and drop through, and nobody told security
// to go home: two ceiling cameras sweep the ground floor, and a laser tripwire
// blinks across the stairwell.

import { W, H } from '../core/config.js';
import { TAU, clamp, lerp } from '../core/util.js';
import { mkSolid, mkPlat } from '../game/physics.js';
import { Entity } from '../game/entities.js';
import { OUT, rr, txt, vgrad, cloud, circle, ellipse, rrect, polygon, line } from '../core/gfx.js';

const F2 = -104, F3 = -208, ROOF = -312;      // second floor, third floor, ceiling of the third
const GAP = 52;                               // half-width of the stairwell
const SEE = 45, LOCK = 30, COOL = 150;        // frames in the light to trip the alarm; alarm to dart; reload
const SWEEP = 0.62, CONE = 0.24, PERIOD = 210;
const WALL = '#2a3963', WALL_D = '#222f55', TRIM = '#1a2444', INK = '#131a36';

// ---- security ------------------------------------------------------------------
function mkCam(x, phase) {
  return { x, y: F2 + 24, floorY: 0, phase, ang: 0, mode: 'sweep', t: 0, target: null, seen: new Map(), heat: 0 };
}

function inCone(c, f) {
  const py = f.cy, d = py - c.y;
  if (d < 6 || f.y > c.floorY + 6) return false;
  return f.x >= c.x + d * Math.tan(c.ang - CONE) - 12 && f.x <= c.x + d * Math.tan(c.ang + CONE) + 12;
}

function drawCone(ctx, c, t) {
  if (c.mode === 'off') return;
  const fade = c.mode === 'cool' ? clamp((c.t - (COOL - 40)) / 40, 0, 1) : 1;
  if (fade <= 0) return;
  const d = c.floorY - c.y, xl = c.x + d * Math.tan(c.ang - CONE), xr = c.x + d * Math.tan(c.ang + CONE);
  const red = c.mode === 'alarm';
  const col = red ? (t % 8 < 4 ? '255,70,56' : '255,130,110') : c.heat > 0.45 ? '255,176,64' : '255,226,96';
  ctx.beginPath(); ctx.moveTo(c.x + Math.sin(c.ang) * 13, c.y + Math.cos(c.ang) * 13); ctx.lineTo(xr, c.floorY); ctx.lineTo(xl, c.floorY); ctx.closePath();
  ctx.fillStyle = `rgba(${col},${(red ? 0.42 : 0.28 + c.heat * 0.14) * fade})`; ctx.fill();
  ctx.strokeStyle = `rgba(${col},${0.6 * fade})`; ctx.lineWidth = 2; ctx.lineJoin = 'round'; ctx.stroke();
  ctx.beginPath(); ctx.ellipse((xl + xr) / 2, c.floorY + 1.5, (xr - xl) / 2, 4.2, 0, 0, TAU);
  ctx.fillStyle = `rgba(${col},${(red ? 0.8 : 0.7) * fade})`; ctx.fill();
}

function drawCamBody(ctx, c, t) {
  // bracket from the ceiling, then the head turning on it
  line(ctx, c.x, c.y - 8, c.x, c.y - 2, OUT, 5.4); line(ctx, c.x, c.y - 8, c.x, c.y - 2, '#8d9cc4', 2.6);
  rrect(ctx, c.x - 9, c.y - 12, 18, 5, 2, '#8d9cc4', OUT, 2);
  ctx.save(); ctx.translate(c.x, c.y); ctx.rotate(-c.ang);
  rrect(ctx, -8, -6, 16, 21, 4.5, '#dfe6f5', OUT, 2.2);
  rrect(ctx, -6, 10, 12, 7, 2.5, '#2b3350', OUT, 1.8);
  const led = c.mode === 'off' || c.mode === 'cool' ? '#56608a' : c.mode === 'alarm' ? (t % 8 < 4 ? '#ff4638' : '#ffffff') : c.heat > 0.45 ? '#ffb040' : '#6dff8a';
  circle(ctx, 3.4, -1.6, 2.3, led, OUT, 1.3);
  ctx.restore();
}

// The tripwire across the stairwell: dark, a flickering warm-up, then live.
class Tripwire extends Entity {
  constructor() {
    super({ layer: 'front', x: 0, y: F2 });
    this.live = false; this.warm = 0;
    this.spec = { dmg: 6, ang: 50, set: 64, fx: 'elec', sfx: 'zap', rehit: 40 };
  }
  update(m) {
    const k = this.t++ % 420;                 // 190 dark, 50 warming up, 180 live
    this.warm = k >= 190 && k < 240 ? (k - 190) / 50 : 0;
    if (k === 190) m.sfx('beep', { vol: 0.5 });
    if (k === 240) m.sfx('laser', { vol: 0.55 });
    this.live = k >= 240; this.hit = this.live ? this.spec : null;
  }
  hitShapes() { return this.live ? [{ x: -GAP, y: F2 - 4, w: GAP * 2, h: 8 }] : null; }
  draw(ctx) {
    const y = F2 - 1;
    if (this.live) {
      const w = 4.4 + Math.sin(this.t * 0.9) * 0.8;
      line(ctx, -GAP + 2, y, GAP - 2, y, 'rgba(255,60,50,0.35)', w + 5);
      line(ctx, -GAP + 2, y, GAP - 2, y, '#ff3b30', w); line(ctx, -GAP + 2, y, GAP - 2, y, '#ffe1dc', 1.5);
    } else if (this.warm > 0 && this.t % 6 < 3) {
      ctx.setLineDash([7, 7]); line(ctx, -GAP + 2, y, GAP - 2, y, 'rgba(255,110,100,0.8)', 2.2); ctx.setLineDash([]);
    }
  }
}

// ---- the building (world space) ------------------------------------------------
const WINDOWS = [[-128, F3 - 88, 58, 70], [-29, F3 - 88, 58, 70], [70, F3 - 88, 58, 70], [-290, F2 - 86, 50, 62], [240, F2 - 86, 50, 62]];

function wallPath(ctx) {       // the back wall, with a stepped brick edge where the building was cut open
  const top = ROOF - 8, n = Math.ceil(-top / 26);
  ctx.beginPath(); ctx.moveTo(-332, top); ctx.lineTo(332, top);
  for (let i = 0; i < n; i++) { const x = i % 2 ? 341 : 331, y = top + i * 26; ctx.lineTo(x, y); ctx.lineTo(x, Math.min(2, y + 26)); }
  ctx.lineTo(-331, 2);
  for (let i = n - 1; i >= 0; i--) { const x = i % 2 ? -341 : -331, y = top + i * 26; ctx.lineTo(x, Math.min(2, y + 26)); ctx.lineTo(x, y); }
  ctx.closePath();
}

function lockers(ctx, x0, x1) {
  for (let x = x0, i = 0; x < x1; x += 27, i++) {
    rrect(ctx, x, -80, 25, 78, 2, i % 2 ? '#3a568a' : '#40609a', TRIM, 2);
    ctx.fillStyle = TRIM; for (let k = 0; k < 3; k++) ctx.fillRect(x + 6, -72 + k * 5, 13, 2);
    ctx.fillStyle = '#7f95c7'; ctx.fillRect(x + 18, -44, 3, 8);
  }
}

function drawBuilding(ctx, t) {
  // roof slab and a couple of rooftop boxes
  rrect(ctx, 150, ROOF - 46, 54, 26, 3, '#2f3d6b', INK, 2.5); rrect(ctx, -236, ROOF - 40, 30, 20, 3, '#2f3d6b', INK, 2.5);
  line(ctx, -150, ROOF - 22, -150, ROOF - 74, INK, 3);
  rrect(ctx, -352, ROOF - 24, 704, 17, 4, '#3b4c7e', INK, 3);
  // wall, with real holes for the windows so the night shows through
  wallPath(ctx); for (const [x, y, w, h] of WINDOWS) ctx.rect(x, y, w, h);
  ctx.fillStyle = WALL; ctx.fill('evenodd');
  ctx.save(); wallPath(ctx); for (const [x, y, w, h] of WINDOWS) ctx.rect(x, y, w, h); ctx.clip('evenodd');
  for (const fy of [0, F2, F3]) {
    ctx.fillStyle = WALL_D; ctx.fillRect(-345, fy - 36, 690, 36);          // wainscot
    ctx.fillStyle = '#3a4c82'; ctx.fillRect(-345, fy - 39, 690, 3);
    ctx.fillStyle = TRIM; ctx.fillRect(-345, fy - 104, 690, 8);            // the storey above, edge-on
  }
  // warm pools of light left on
  ctx.fillStyle = 'rgba(255,205,110,0.13)';
  for (const [x, y, r] of [[-207, F2 - 44, 86], [0, -64, 70], [228, F3 - 52, 74]]) { ctx.beginPath(); ctx.ellipse(x, y, r, r * 0.62, 0, 0, TAU); ctx.fill(); }
  ctx.fillStyle = 'rgba(255,80,60,0.16)'; ctx.beginPath(); ctx.ellipse(275, -76, 58, 36, 0, 0, TAU); ctx.fill();   // EXIT glow
  // moonlight falling in through the top windows
  ctx.fillStyle = 'rgba(190,214,255,0.1)';
  for (const [x, y, w, h] of WINDOWS.slice(0, 3)) { ctx.beginPath(); ctx.moveTo(x, y + h); ctx.lineTo(x + w, y + h); ctx.lineTo(x + w - 46, F3); ctx.lineTo(x - 46, F3); ctx.closePath(); ctx.fill(); }
  ctx.restore();
  // window frames
  for (const [x, y, w, h] of WINDOWS) {
    ctx.fillStyle = 'rgba(130,170,240,0.16)'; ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = '#8fa4d6'; ctx.lineWidth = 3; ctx.strokeRect(x, y, w, h);
    line(ctx, x + w / 2, y, x + w / 2, y + h, '#8fa4d6', 2.4); line(ctx, x, y + h * 0.45, x + w, y + h * 0.45, '#8fa4d6', 2.4);
    rrect(ctx, x - 5, y + h, w + 10, 5, 2, '#8fa4d6', null, 0);
  }
  // ground floor: lockers, the stairs up, the way out
  lockers(ctx, -306, -80); lockers(ctx, 86, 230);
  ctx.fillStyle = '#243258'; ctx.beginPath(); ctx.moveTo(-GAP, 0);
  for (let i = 0; i < 8; i++) { ctx.lineTo(-GAP + i * 13, -i * 13 - 13); ctx.lineTo(-GAP + i * 13 + 13, -i * 13 - 13); }
  ctx.lineTo(GAP, 0); ctx.closePath(); ctx.fill();
  line(ctx, -GAP - 4, -40, GAP - 6, -132, '#3a4c82', 3.4);
  rrect(ctx, 246, -70, 58, 70, 2, '#4a416c', TRIM, 2.4); line(ctx, 275, -70, 275, 0, TRIM, 2.2);
  rrect(ctx, 252, -62, 17, 22, 2, '#6f84b8', TRIM, 1.8); rrect(ctx, 281, -62, 17, 22, 2, '#6f84b8', TRIM, 1.8);
  rrect(ctx, 256, -88, 38, 13, 3, '#ff5a4a', '#8f1d10', 2);
  txt(ctx, 'EXIT', 275, -81, { font: 'boog', size: 11, fill: '#fff1e6', stroke: null, lw: 0 });
  // second floor: trophy case, a classroom door, a noticeboard
  rrect(ctx, -266, F2 - 80, 118, 76, 3, '#4d4470', TRIM, 2.4);
  rrect(ctx, -260, F2 - 74, 106, 64, 2, '#c9ad68', null, 0);
  ctx.fillStyle = '#4d4470'; ctx.fillRect(-260, F2 - 44, 106, 3);
  for (let i = 0; i < 6; i++) {
    const x = -246 + (i % 3) * 39, y = F2 - (i < 3 ? 44 : 10);
    ctx.fillStyle = '#fff0a8'; ctx.fillRect(x - 5, y - 4, 10, 4); ctx.fillRect(x - 1.5, y - 10, 3, 6);
    ctx.beginPath(); ctx.arc(x, y - 15, 7, 0, Math.PI); ctx.closePath(); ctx.fill();
  }
  rrect(ctx, 92, F2 - 82, 44, 82, 2, '#3f5087', TRIM, 2.4); rrect(ctx, 101, F2 - 72, 26, 24, 2, '#27345c', TRIM, 1.8);
  circle(ctx, 129, F2 - 38, 2.6, '#8fa4d6', null, 0);
  rrect(ctx, 158, F2 - 78, 62, 44, 2, '#6f6377', TRIM, 2.4);
  [[164, -72, '#b9c6ea'], [184, -70, '#e6d79a'], [203, -73, '#b9c6ea'], [170, -52, '#e3a7a0'], [194, -54, '#b9c6ea']].forEach(([x, y, c]) => { ctx.fillStyle = c; ctx.fillRect(x, F2 + y, 13, 14); });
  // third floor: a chalkboard somebody forgot to wipe, a shelf of books
  rrect(ctx, 172, F3 - 82, 118, 56, 2, '#2f5a5c', '#6f6377', 3);
  ctx.strokeStyle = '#a9c9c4'; ctx.lineWidth = 2; ctx.lineCap = 'round'; ctx.beginPath();
  ctx.moveTo(184, F3 - 66); ctx.lineTo(236, F3 - 66); ctx.moveTo(184, F3 - 54); ctx.lineTo(262, F3 - 54); ctx.moveTo(184, F3 - 42); ctx.lineTo(220, F3 - 42); ctx.stroke();
  rrect(ctx, -300, F3 - 60, 106, 5, 1.5, '#6f6377', null, 0);
  ['#5e79b8', '#7a6aa8', '#4f8f9a', '#5e79b8', '#a0728a', '#7a6aa8', '#4f8f9a', '#5e79b8'].forEach((c, i) => { ctx.fillStyle = c; ctx.fillRect(-296 + i * 12, F3 - 84 + (i % 3) * 3, 10, 24 - (i % 3) * 3); });
  // the cut edge
  wallPath(ctx); ctx.strokeStyle = INK; ctx.lineWidth = 3; ctx.lineJoin = 'round'; ctx.stroke();
}

function drawUpperFloor(ctx, x, y, w) {
  rrect(ctx, x - 4, y, w + 8, 13, 3, '#566a9e', OUT, 2.6);
  rr(ctx, x - 1.5, y + 1.5, w + 3, 3.2, 1.6); ctx.fillStyle = '#b4c5ee'; ctx.fill();
  ctx.fillStyle = '#3c4c7c';
  for (let jx = x + 12; jx < x + w - 14; jx += 44) ctx.fillRect(jx, y + 7.5, 16, 3);
}

function drawGround(ctx) {
  rr(ctx, -312, 10, 624, 54, 12); ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fill();
  rrect(ctx, -320, 0, 640, 60, 8, '#4c5f93', OUT, 3);
  ctx.save(); rr(ctx, -320, 0, 640, 60, 8); ctx.clip();
  ctx.fillStyle = '#6a7fb6'; ctx.fillRect(-320, 0, 640, 13);
  ctx.fillStyle = '#5c70a6'; for (let x = -320; x < 320; x += 40) ctx.fillRect(x, 4, 20, 9);
  ctx.fillStyle = '#b4c5ee'; ctx.fillRect(-320, 0, 640, 3.6);
  ctx.fillStyle = '#34426f'; ctx.fillRect(-320, 46, 640, 14);
  ctx.strokeStyle = '#3c4c7c'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-320, 30); ctx.lineTo(320, 30);
  for (let x = -300; x < 320; x += 52) { ctx.moveTo(x, 14); ctx.lineTo(x, 30); ctx.moveTo(x + 26, 30); ctx.lineTo(x + 26, 46); }
  ctx.stroke();
  ctx.restore();
  line(ctx, -318, 13.5, 318, 13.5, OUT, 2);
  rr(ctx, -320, 0, 640, 60, 8); ctx.strokeStyle = OUT; ctx.lineWidth = 3; ctx.stroke();
}

function drawEmitters(ctx, lit) {
  for (const s of [-1, 1]) {
    rrect(ctx, s * (GAP + 5) - 6, F2 - 9, 12, 9, 2.5, '#dfe6f5', OUT, 2);
    circle(ctx, s * (GAP + 2), F2 - 4.5, 2.4, lit ? '#ff3b30' : '#56608a', OUT, 1.2);
  }
}

// ---- the night outside (screen space) --------------------------------------------
function drawNight(ctx, t, cx, cy) {
  const px = -cx * 0.04, py = -(cy + 90) * 0.04;
  vgrad(ctx, 0, 0, W, H, ['#0b1030', '#18245a', '#2f3f7c']);
  ctx.fillStyle = '#e8eeff';
  for (let i = 0; i < 44; i++) {
    ctx.globalAlpha = 0.35 + (Math.sin(t * 0.04 + i * 1.7) + 1) * 0.28;
    const s = 1.6 + (i % 3) * 0.7; ctx.fillRect(((i * 173.3) % W) + px * 0.5, ((i * 97.7) % 390) + py * 0.5, s, s);
  }
  ctx.globalAlpha = 1;
  const mx = 664 + px, my = 100 + py;
  circle(ctx, mx, my, 64, 'rgba(255,244,190,0.1)', null, 0);
  circle(ctx, mx, my, 44, '#fff2b8', '#d8c888', 3);
  circle(ctx, mx - 14, my - 10, 9, '#ecdc9c', null, 0); circle(ctx, mx + 13, my + 13, 12, '#ecdc9c', null, 0); circle(ctx, mx + 17, my - 19, 5, '#ecdc9c', null, 0);
  for (let i = 0; i < 3; i++) cloud(ctx, ((i * 330 + t * 0.06) % (W + 300)) - 150 + px, 170 + i * 74 + py, 1.2 - i * 0.2, '#33437c');
  ctx.save(); ctx.translate(px * 2.5, py * 2.5);
  ctx.fillStyle = '#141c42'; ctx.beginPath(); ctx.moveTo(-60, 640); ctx.lineTo(-60, 474);
  ctx.quadraticCurveTo(150, 410, 340, 468); ctx.quadraticCurveTo(560, 530, 860, 440); ctx.lineTo(860, 640); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#0f1636';
  for (const [x, y, r] of [[60, 452, 34], [118, 462, 26], [690, 452, 36], [756, 440, 28]]) { ctx.fillRect(x - 4, y, 8, 60); ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill(); }
  ctx.restore();
}

export default {
  id: 'afterhours', name: 'AFTER HOURS', home: 'sneaks',
  blurb: 'Three floors, two cameras, one laser, zero hall passes.',
  music: 'sneaky',
  build(m) {
    const hazards = m.rules.hazards !== false;
    const plats = [
      mkPlat(-300, F2, 300 - GAP, { id: 'floor2L' }), mkPlat(GAP, F2, 300 - GAP, { id: 'floor2R' }),
      mkPlat(-150, F3, 300, { id: 'floor3' }),
    ];
    const cams = [mkCam(-176, 0), mkCam(176, 1.9)];
    if (!hazards) for (const c of cams) c.mode = 'off';         // parked, lens down
    return {
      solids: [mkSolid(-320, 0, 640, 60, { id: 'ground' })], plats, cams,
      blast: { l: -790, r: 790, t: -640, b: 340 },
      cam: { l: -650, r: 650, t: -520, b: 270 },
      spawns: [[-200, 0], [200, 0], [-70, 0], [70, 0]],
      respawn: [0, -300],
      focusX: 0, focusY: -90, t: 0, flash: 0, wire: null,
      init(m) { if (hazards) this.wire = m.spawn(new Tripwire()); },
      update(m) {
        const t = ++this.t;
        if (this.flash > 0) this.flash--;
        if (!hazards) return;
        for (const c of this.cams) {
          const sweep = Math.sin((t * TAU) / PERIOD + c.phase) * SWEEP;
          if (c.mode === 'sweep') {
            c.ang = sweep; c.heat = 0;
            for (const f of m.fighters) {
              if (f.out || f.state === 'dead' || f.state === 'respawn' || f.state === 'entrance') { c.seen.delete(f); continue; }
              const n = inCone(c, f) ? (c.seen.get(f) || 0) + 1 : Math.max(0, (c.seen.get(f) || 0) - 2);
              c.seen.set(f, n);
              c.heat = Math.max(c.heat, n / SEE);
              if (n === 20) m.sfx('beep', { vol: 0.6 });
              if (n >= SEE && c.mode === 'sweep') {
                // caught: lock on, sound the alarm, and the dart is on its way
                c.mode = 'alarm'; c.t = 0; c.target = f; c.seen.clear(); this.flash = LOCK;
                m.sfx('alarm'); m.fx.word(c.x, c.y + 26, 'ALARM!', { color: '#ff5a4a', size: 20, life: 34 });
                break;
              }
            }
          } else if (c.mode === 'alarm') {
            const f = c.target;
            c.ang = lerp(c.ang, clamp(Math.atan2(f.x - c.x, Math.max(24, f.cy - c.y)), -1.15, 1.15), 0.25);
            if (++c.t >= LOCK) {
              if (m.canBeHit(f)) m.blast(null, f, { dmg: 8, ang: 90, set: 62, status: { kind: 'zap', t: 50 }, fx: 'elec', sfx: 'zap' });
              c.mode = 'cool'; c.t = 0; c.target = null; c.heat = 0;
            }
          } else {
            c.ang = lerp(c.ang, sweep, 0.07);
            if (++c.t >= COOL) { c.mode = 'sweep'; c.seen.clear(); }
          }
        }
      },
      drawBg(ctx, m) { drawNight(ctx, this.t, m.cam.x, m.cam.y); },
      drawBack(ctx) { drawBuilding(ctx, this.t); },
      drawMid(ctx) {
        for (const c of this.cams) drawCone(ctx, c, this.t);
        drawGround(ctx);
        for (const p of this.plats) drawUpperFloor(ctx, p.x, p.y, p.w);
        const w = this.wire;
        drawEmitters(ctx, !!w && (w.live || (w.warm > 0 && this.t % 6 < 3)));
        for (const c of this.cams) drawCamBody(ctx, c, this.t);
      },
      // the dart on its way: a marker on whoever tripped the alarm, then the shot itself
      drawFront(ctx) {
        for (const c of this.cams) {
          const f = c.target;
          if (c.mode !== 'alarm' || !f) continue;
          const r = 30 - c.t * 0.4, a = c.t * 0.2;
          ctx.strokeStyle = '#ff4638'; ctx.lineWidth = 3;
          ctx.beginPath(); ctx.arc(f.x, f.cy, r, 0, TAU); ctx.stroke();
          for (let i = 0; i < 4; i++) { const q = a + (i * TAU) / 4; line(ctx, f.x + Math.cos(q) * (r - 7), f.cy + Math.sin(q) * (r - 7), f.x + Math.cos(q) * (r + 7), f.cy + Math.sin(q) * (r + 7), '#ff4638', 3); }
          if (c.t >= LOCK - 8) {
            const u = (c.t - (LOCK - 8)) / 8, dx = lerp(c.x, f.x, u), dy = lerp(c.y + 12, f.cy, u), q = Math.atan2(f.cy - c.y - 12, f.x - c.x);
            ctx.save(); ctx.translate(dx, dy); ctx.rotate(q);
            polygon(ctx, [-16, -4.5, -9, 0, -16, 4.5], '#ff5a4a', OUT, 1.6);
            rrect(ctx, -10, -2.6, 16, 5.2, 2, '#dfe6f5', OUT, 1.8); line(ctx, 6, 0, 13, 0, OUT, 2);
            ctx.restore();
          }
        }
      },
      drawScreen(ctx) {
        if (this.flash <= 0 || this.flash % 10 < 5) return;
        ctx.fillStyle = 'rgba(255,50,40,0.3)';
        ctx.fillRect(0, 0, W, 14); ctx.fillRect(0, H - 14, W, 14); ctx.fillRect(0, 14, 14, H - 28); ctx.fillRect(W - 14, 14, 14, H - 28);
      },
    };
  },
  thumb(ctx, w, h, t = 0) {
    ctx.save(); ctx.beginPath(); ctx.rect(0, 0, w, h); ctx.clip();
    ctx.save(); ctx.scale(w / W, h / H); drawNight(ctx, t, 0, -90); ctx.restore();
    ctx.translate(w / 2, h * 0.84); ctx.scale(w / 800, w / 800);
    drawBuilding(ctx, t);
    const cams = [mkCam(-176, 0), mkCam(176, 1.9)];
    for (const c of cams) { c.ang = Math.sin((t * TAU) / PERIOD + c.phase) * SWEEP; drawCone(ctx, c, t); }
    drawGround(ctx);
    drawUpperFloor(ctx, -300, F2, 300 - GAP); drawUpperFloor(ctx, GAP, F2, 300 - GAP); drawUpperFloor(ctx, -150, F3, 300);
    drawEmitters(ctx, true);
    line(ctx, -GAP + 2, F2 - 1, GAP - 2, F2 - 1, '#ff3b30', 4);
    for (const c of cams) drawCamBody(ctx, c, t);
    ctx.restore();
  },
};
