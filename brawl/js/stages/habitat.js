// THE HABITAT - inside the hamster cage's tube run: a floor and a ceiling of
// chunky plastic tube with holes in different places. Every thirty seconds
// the whole tunnel turns over, and the holes are somewhere else.

import { W, H } from '../core/config.js';
import { TAU, ease } from '../core/util.js';
import { mkSolid } from '../game/physics.js';
import { OUT, rr, vgrad, circle, ellipse, rrect, polygon, line, rgba, lighten, darken } from '../core/gfx.js';

const T = 36, TOP = -270, CY = TOP / 2;        // tube wall thickness; underside of the ceiling; the point the tunnel turns about
const PERIOD = 1800, WARN = 120, TURN = 60;
const RUNS_A = [[-340, -132], [-52, 52], [132, 340]];       // tube wall between the holes: the floor you start on...
const RUNS_B = [[-340, -270], [-190, -40], [40, 340]];      // ...and the ceiling, which is the floor once the tunnel has turned over
const flip = (runs) => runs.map(([a, b]) => [-b, -a]).reverse();
const LAYOUT = [{ floor: RUNS_A, ceil: RUNS_B }, { floor: flip(RUNS_B), ceil: flip(RUNS_A) }];
const SINK = [0, 115];                         // middle of each layout's centre run: where the return desk hovers
const POP = { idle: 1, walk: 1, dash: 1, run: 1, brake: 1, turn: 1, crouch: 1, move: 1, jumpsquat: 1, shield: 1, shieldstun: 1, land: 1, getup: 1, down: 1, hitstun: 1, stun: 1 };
const COLS = ['#ffd23f', '#ff8f45', '#4fb0ff'];

// ---- the tubes (world space) ----------------------------------------------------
// One row of tube wall. A floor and a ceiling are drawn as mirror images, so a
// row that has been turned half way round looks exactly like the other kind.
function drawRow(ctx, runs, floor) {
  const y = floor ? 0 : TOP - T;
  for (const [a, b] of runs) {
    const n = Math.max(1, Math.round((b - a) / 100)), w = (b - a) / n;
    for (let i = 0; i < n; i++) {
      const x = a + i * w, key = (floor ? 1 : -1) * (x + w / 2);
      const c = COLS[((Math.round(key / 52) % 3) + 3) % 3];
      rr(ctx, x + 1, y, w - 2, T, 6); ctx.fillStyle = rgba(c, 0.88); ctx.fill();
      rr(ctx, x + 4, floor ? y + T - 12 : y + 4, w - 8, 8, 4); ctx.fillStyle = rgba(darken(c, 0.22), 0.7); ctx.fill();
      rr(ctx, x + 4, floor ? y + 1.6 : y + T - 5.8, w - 8, 4.2, 2.1); ctx.fillStyle = lighten(c, 0.6); ctx.fill();
      rr(ctx, floor ? x + 12 : x + w - 12 - w * 0.36, floor ? y + 9.5 : y + T - 14.5, w * 0.36, 5, 2.5); ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.fill();
      rr(ctx, x + 1, y, w - 2, T, 6); ctx.strokeStyle = OUT; ctx.lineWidth = 2.6; ctx.stroke();
    }
    // collars where the pieces push together; they bulge outward only, so the walking side stays flat
    for (let i = 0; i <= n; i++) {
      const x = i === 0 ? a : i === n ? b - 11 : a + i * w - 5.5;
      rrect(ctx, x, floor ? y : y - 5, 11, T + 5, 3.5, '#fff6dc', OUT, 2.2);
      ctx.fillStyle = '#e3d3a4'; ctx.fillRect(x + 2.4, floor ? y + T - 6 : y - 2.6, 6.2, 8.6);
    }
  }
}

// the far wall of the tube, seen through from inside: a pale tint, streaks and hoops (all point-symmetric, so it survives the turn)
function drawTubeBack(ctx) {
  ctx.fillStyle = 'rgba(255,255,255,0.14)'; ctx.fillRect(-340, TOP, 680, -TOP);
  ctx.fillStyle = 'rgba(255,255,255,0.2)';
  for (const [x, y, w] of [[-300, TOP + 24, 230], [-60, TOP + 52, 150]]) {
    rr(ctx, x, y, w, 9, 4.5); ctx.fill(); rr(ctx, -x - w, TOP - y - 9, w, 9, 4.5); ctx.fill();
  }
  ctx.strokeStyle = 'rgba(255,255,255,0.2)'; ctx.lineWidth = 6; ctx.lineCap = 'butt'; ctx.beginPath();
  for (const x of [-272, -136, 0, 136, 272]) { ctx.moveTo(x, TOP + 3); ctx.lineTo(x, -3); }
  ctx.stroke();
}

function drawSpin(ctx, a, alpha) {
  ctx.save(); ctx.translate(0, CY); ctx.rotate(a); ctx.globalAlpha = alpha;
  for (let i = 0; i < 2; i++) {
    ctx.rotate(Math.PI);
    const e = Math.PI - 0.55;
    ctx.beginPath(); ctx.arc(0, 0, 62, 0.35, e); ctx.lineCap = 'butt';
    ctx.strokeStyle = OUT; ctx.lineWidth = 19; ctx.stroke();
    ctx.strokeStyle = '#ffe14d'; ctx.lineWidth = 13; ctx.stroke();
    ctx.save(); ctx.translate(Math.cos(e) * 62, Math.sin(e) * 62); ctx.rotate(e + Math.PI / 2);
    polygon(ctx, [-5, -21, 25, 0, -5, 21], '#ffe14d', OUT, 3);
    ctx.restore();
  }
  ctx.restore();
}

// ---- the cage and the classroom beyond it (screen space, all soft shapes) --------
function drawCage(ctx, t, cx, cy) {
  const fx = -cx * 0.04, fy = -(cy + 110) * 0.04;
  vgrad(ctx, 0, 0, W, H, ['#f8f0d0', '#f2e5b8']);
  ctx.save(); ctx.translate(fx, fy);
  rr(ctx, 96, 56, 300, 150, 10); ctx.fillStyle = '#a6cfae'; ctx.fill();                      // chalkboard
  ctx.fillStyle = '#cbe5cc'; rr(ctx, 122, 84, 130, 9, 4.5); ctx.fill(); rr(ctx, 122, 110, 190, 9, 4.5); ctx.fill(); rr(ctx, 122, 136, 90, 9, 4.5); ctx.fill();
  rr(ctx, 524, 36, 200, 190, 10); ctx.fillStyle = '#c4e8f6'; ctx.fill();                     // window
  circle(ctx, 590, 96, 26, '#ffffff', null, 0); circle(ctx, 624, 104, 20, '#ffffff', null, 0);
  ctx.fillStyle = '#ecdca6'; ctx.fillRect(520, 126, 208, 9); ctx.fillRect(620, 36, 9, 190);
  ctx.fillStyle = '#e2cc94';
  for (const x of [20, 300, 580]) { rr(ctx, x, 322, 200, 17, 6); ctx.fill(); ctx.fillRect(x + 22, 338, 11, 120); ctx.fillRect(x + 166, 338, 11, 120); }
  ctx.restore();
  // cage bars
  ctx.save(); ctx.translate(-cx * 0.08, -(cy + 110) * 0.08);
  ctx.strokeStyle = 'rgba(168,174,190,0.5)'; ctx.lineWidth = 4; ctx.lineCap = 'butt'; ctx.beginPath();
  for (let x = -70; x <= W + 70; x += 52) { ctx.moveTo(x, -70); ctx.lineTo(x, H + 70); }
  ctx.moveTo(-70, 292); ctx.lineTo(W + 70, 292); ctx.stroke();
  ctx.restore();
  // inside the cage: the wheel, the water bottle, a bowl, deep shavings
  ctx.save(); ctx.translate(-cx * 0.13, -(cy + 110) * 0.13);
  const wx = 168, wy = 262, wr = 150;
  ctx.fillStyle = '#c5d3e0'; ctx.beginPath(); ctx.moveTo(wx - 12, wy); ctx.lineTo(wx + 12, wy); ctx.lineTo(wx + 96, 500); ctx.lineTo(wx - 96, 500); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.arc(wx, wy, wr, 0, TAU); ctx.strokeStyle = '#f6bfa6'; ctx.lineWidth = 20; ctx.stroke();
  ctx.strokeStyle = '#fbdccb'; ctx.lineWidth = 6; ctx.beginPath(); ctx.arc(wx, wy, wr - 4, 0, TAU);
  for (let i = 0; i < 6; i++) { const a = t * 0.004 + (i * TAU) / 6; ctx.moveTo(wx, wy); ctx.lineTo(wx + Math.cos(a) * (wr - 6), wy + Math.sin(a) * (wr - 6)); }
  ctx.stroke();
  circle(ctx, wx, wy, 16, '#f6bfa6', null, 0);
  rr(ctx, 604, 28, 84, 196, 26); ctx.fillStyle = 'rgba(190,230,246,0.85)'; ctx.fill();          // bottle
  rr(ctx, 612, 96, 68, 120, 20); ctx.fillStyle = '#9fd3ee'; ctx.fill();
  ctx.fillStyle = '#ffffff'; ctx.fillRect(618, 44, 9, 150);
  rr(ctx, 596, 216, 100, 24, 8); ctx.fillStyle = '#f1a5a0'; ctx.fill();
  line(ctx, 644, 240, 598, 304, '#c5d3e0', 13); circle(ctx, 596, 307, 9, '#dbe5ee', null, 0);
  const d = (t % 110) / 110; if (d < 0.5) circle(ctx, 594, 320 + d * 190, 4.2, 'rgba(159,211,238,0.9)', null, 0);
  ctx.fillStyle = '#eddcae'; ctx.beginPath(); ctx.moveTo(-90, 660); ctx.lineTo(-90, 486);
  for (let x = -90; x <= W + 90; x += 60) ctx.quadraticCurveTo(x + 30, 452 + ((x / 60) & 1) * 16, x + 60, 484);
  ctx.lineTo(W + 90, 660); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = '#dcc68d'; ctx.lineWidth = 4; ctx.lineCap = 'round'; ctx.beginPath();
  for (let i = 0; i < 12; i++) { const x = 30 + i * 68, y = 498 + (i % 3) * 22; ctx.moveTo(x + 13, y); ctx.arc(x, y, 13, 0, Math.PI * 1.3); }
  ctx.stroke();
  ellipse(ctx, 432, 484, 54, 15, '#f1a5a0', null, 0); ellipse(ctx, 432, 479, 44, 9, '#f8d7a0', null, 0);
  ctx.restore();
}

export default {
  id: 'habitat', name: 'THE HABITAT', home: 'zoomie',
  blurb: 'Mind the holes. Every thirty seconds they move.',
  music: 'hardest',
  build(m) {
    const hazards = m.rules.hazards !== false;
    // Floors: only the centre run can be grabbed at the holes (the outer runs keep
    // their outside corners), so every hole has one edge to hang from and a CPU
    // that falls or hops into one is always drawn back toward the middle.
    const mk = (runs, floor, set) => runs.map(([a, b], i) => mkSolid(a, floor ? 0 : TOP - T, b - a, T, {
      id: (floor ? 'floor' : 'ceil') + set + '_' + i, on: set === 0,
      ledge: floor ? (i === 0 ? 'l' : i === runs.length - 1 ? 'r' : 'lr') : '',
    }));
    const sets = LAYOUT.map((L, i) => ({ floor: mk(L.floor, true, i), ceil: mk(L.ceil, false, i) }));
    return {
      solids: [].concat(sets[0].floor, sets[0].ceil, sets[1].floor, sets[1].ceil), plats: [], sets,
      blast: { l: -790, r: 790, t: -640, b: 340 },
      cam: { l: -650, r: 650, t: -520, b: 270 },
      spawns: [[-220, 0], [220, 0], [-28, 0], [28, 0]],
      respawn: [0, -170],
      focusX: 0, focusY: -100,
      t: 0, set: 0, from: 0, turn: 0, warn: 0, nextAt: hazards ? PERIOD : Infinity,
      respawnAt() { return [SINK[this.turn && this.turn <= TURN / 2 ? 1 - this.set : this.set], -170]; },

      update(m) {
        this.t++;
        if (!this.turn) {
          const left = this.nextAt - m.frame;
          this.warn = left < WARN ? Math.min(1, 1 - left / WARN) : 0;
          if (left === WARN) { m.sfx('rumble'); m.announce('HOLD ON!', { life: 70, size: 40, y: 104, color: '#ffd23f', font: 'chewy' }); }
          else if (left > 0 && left < WARN && left % 40 === 0) m.sfx('rumble', { vol: 0.7 });
          if (left > 0 && left < WARN && left % 10 === 0) m.shake(1.5 + this.warn * 2);
          if (left <= 0 && m.state === 'fight') this.begin(m);
          return;
        }
        // mid-turn: everybody floats
        for (const f of m.fighters) {
          if (f.out || f.state === 'dead' || f.state === 'respawn') continue;
          f.gravMul = 0.25; if (f.vy > 2) f.vy = 2;
        }
        if (this.turn === TURN / 2) this.swap(m);
        if (++this.turn > TURN) {
          this.turn = 0; this.nextAt = m.frame + PERIOD - TURN;
          for (const f of m.fighters) f.gravMul = 1;
          m.sfx('thud'); m.shake(5);
        }
      },

      begin(m) {
        this.turn = 1; this.from = this.set; this.warn = 0;
        m.sfx('lever'); m.sfx('rumble'); m.shake(6);
        for (const f of m.fighters) {
          if (f.out || f.state === 'dead' || f.state === 'respawn') continue;
          if (f.grounded) {
            if (!POP[f.state] || f.grabbing || f.grabbedBy) continue;
            f.grounded = false; f.ground = null; f.vy = -4.2; f.onLeaveGround();
          } else if (f.state === 'air' || f.state === 'tumble' || f.state === 'helpless') f.vy = Math.min(f.vy, -3);
        }
      },

      // half way round: the other hole pattern becomes the floor
      swap(m) {
        const old = this.sets[this.set], nw = this.sets[1 - this.set];
        for (const s of old.floor.concat(old.ceil)) s.on = false;
        for (const s of nw.floor.concat(nw.ceil)) s.on = true;
        const was = SINK[this.set], dx = SINK[1 - this.set] - was;
        this.set = 1 - this.set;
        for (const f of m.fighters) {
          if (f.out || f.state === 'dead') continue;
          if (f.state === 'respawn') { if (Math.abs(f.x - was) < 70) f.x += dx; continue; }      // keep the return desk over solid tube
          // nobody gets sealed inside a tube wall: a closing floor scoops you up,
          // a closing ceiling sets you down under it (or up on the roof)
          const h = f.h * f.scale, hw = (f.w * f.scale) / 2;
          const inside = (s) => f.x + hw > s.x && f.x - hw < s.x + s.w && f.y > s.y + 2 && f.y - h < s.y + s.h;
          for (const s of nw.floor) if (inside(s)) { f.y = s.y - 1; f.vy = Math.min(f.vy, -2); }
          for (const s of nw.ceil) {
            if (!inside(s)) continue;
            if (f.y - h / 2 < s.y + s.h / 2) f.y = s.y - 1; else { f.y = s.y + s.h + h + 1; f.vy = Math.max(f.vy, 0); }
          }
        }
      },

      // the tunnel art: shaking during the warning, turning about its centre during the turn
      pose(ctx) {
        if (this.warn > 0) ctx.translate(Math.sin(this.t * 2.1) * 2.4 * this.warn, Math.cos(this.t * 2.7) * 1.8 * this.warn);
        if (this.turn) { ctx.translate(0, CY); ctx.rotate(ease.io(Math.min(1, this.turn / TURN)) * Math.PI); ctx.translate(0, -CY); }
      },
      drawBg(ctx, m) { drawCage(ctx, this.t, m.cam.x, m.cam.y); },
      drawBack(ctx) {
        ctx.save(); this.pose(ctx); drawTubeBack(ctx); ctx.restore();
        if (this.warn > 0) { if (this.t % 12 < 8) drawSpin(ctx, this.t * (0.05 + this.warn * 0.12), 0.9); }
        else if (this.turn) drawSpin(ctx, this.t * 0.2, 0.55);
      },
      drawMid(ctx) {
        const L = LAYOUT[this.turn ? this.from : this.set];
        ctx.save(); this.pose(ctx);
        drawRow(ctx, L.ceil, false); drawRow(ctx, L.floor, true);
        ctx.restore();
      },
    };
  },
  thumb(ctx, w, h, t = 0) {
    ctx.save(); ctx.beginPath(); ctx.rect(0, 0, w, h); ctx.clip();
    ctx.save(); ctx.scale(w / W, h / H); drawCage(ctx, t, 0, -110); ctx.restore();
    ctx.translate(w / 2, h * 0.84); ctx.scale(w / 800, w / 800);
    drawTubeBack(ctx);
    drawRow(ctx, RUNS_B, false); drawRow(ctx, RUNS_A, true);
    ctx.restore();
  },
};
