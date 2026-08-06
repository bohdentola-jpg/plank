// pong.js — the ping pong table. Host-simulated; clients render from snapshots.
//
// Stand at either end of the table and press E to pick up a paddle. Click to
// swing. First to 5. If nobody takes the other side, a cardboard box with a
// paddle fills in (the box-bot).

import { rand } from './util.js';

const BALL_GRAV = 460;
const WIN_SCORE = 5;
const BOT_DELAY = 2.0;

export class Pong {
  constructor(tableEnt, map, groundY) {
    const w = 88 * (tableEnt.scale || 100) / 100;
    const h = 26 * (tableEnt.scale || 100) / 100;
    this.rect = { x0: tableEnt.x - w / 2, x1: tableEnt.x + w / 2 };
    this.surfaceY = tableEnt.y - h / 2 + 6;    // top of the table slab
    this.tableId = tableEnt.id;
    this.groundY = groundY != null ? groundY : tableEnt.y + h / 2 + 8;
    this.sides = { L: null, R: null };          // playerId | 'bot' | null
    this.score = { L: 0, R: 0 };
    this.ball = null;                            // {x,y,vx,vy}
    this.serveSide = 'L';
    this.serveT = 0;
    this.msg = null;
    this.msgT = 0;
    this.botT = 0;
    this.botSwingCooldown = 0;
    this.over = false;
  }

  stationX(side) { return side === 'L' ? this.rect.x0 - 14 : this.rect.x1 + 14; }
  paddleY() { return this.surfaceY - 10; }

  sideOf(playerId) {
    if (this.sides.L === playerId) return 'L';
    if (this.sides.R === playerId) return 'R';
    return null;
  }

  occupied() { return (this.sides.L && this.sides.L !== 'bot') || (this.sides.R && this.sides.R !== 'bot'); }

  // player wants in — picks the nearer free side. returns side or null.
  join(playerId, px) {
    if (this.sideOf(playerId)) return this.sideOf(playerId);
    const pref = px < (this.rect.x0 + this.rect.x1) / 2 ? 'L' : 'R';
    const other = pref === 'L' ? 'R' : 'L';
    for (const s of [pref, other]) {
      if (!this.sides[s] || this.sides[s] === 'bot') {
        this.sides[s] = playerId;
        this.startIfReady();
        return s;
      }
    }
    return null;
  }

  leave(playerId) {
    for (const s of ['L', 'R']) if (this.sides[s] === playerId) this.sides[s] = null;
    if (!this.occupied()) this.reset();
  }

  reset() {
    this.sides = { L: null, R: null };
    this.score = { L: 0, R: 0 };
    this.ball = null;
    this.msg = null;
    this.over = false;
    this.botT = 0;
  }

  startIfReady() {
    if (this.over) { this.score = { L: 0, R: 0 }; this.over = false; }
    if (this.sides.L && this.sides.R && !this.ball && !this.serveT) {
      this.serveT = 1.0;
      this.setMsg('serve!', 1.0);
    }
  }

  setMsg(m, t = 1.5) { this.msg = m; this.msgT = t; }

  // host: player swung (clicked). Returns true if the ball was struck.
  swing(playerId) {
    const side = this.sideOf(playerId);
    if (!side || !this.ball) return false;
    return this.strike(side, playerId === 'bot' ? 0.9 : 1);
  }

  strike(side, quality) {
    const b = this.ball;
    const px = this.stationX(side) + (side === 'L' ? 6 : -6);
    const py = this.paddleY();
    const dir = side === 'L' ? 1 : -1;
    if (Math.abs(b.x - px) > 20 || Math.abs(b.y - py) > 18) return false;
    if (dir > 0 && b.vx > 60) return false;   // ball already flying away
    if (dir < 0 && b.vx < -60) return false;
    b.vx = dir * rand(105, 150) * quality;
    b.vy = -rand(120, 165);
    return true;
  }

  // host simulation step
  step(dt, hasHumanNear) {
    if (this.msgT > 0) { this.msgT -= dt; if (this.msgT <= 0) this.msg = null; }
    this.botSwingCooldown -= dt;

    // box-bot fills an empty side when a human waits on the other
    const humanL = this.sides.L && this.sides.L !== 'bot';
    const humanR = this.sides.R && this.sides.R !== 'bot';
    if ((humanL && !this.sides.R) || (humanR && !this.sides.L)) {
      this.botT += dt;
      if (this.botT > BOT_DELAY) {
        this.sides[humanL ? 'R' : 'L'] = 'bot';
        this.setMsg('box-bot joins', 1.2);
        this.startIfReady();
      }
    } else this.botT = 0;
    if (!humanL && !humanR) { if (this.sides.L === 'bot' || this.sides.R === 'bot') this.reset(); return; }

    // serving
    if (this.serveT > 0) {
      this.serveT -= dt;
      if (this.serveT <= 0 && this.sides.L && this.sides.R) {
        const sx = this.stationX(this.serveSide) + (this.serveSide === 'L' ? 8 : -8);
        this.ball = { x: sx, y: this.paddleY() - 4, vx: (this.serveSide === 'L' ? 1 : -1) * rand(110, 130), vy: -rand(130, 150) };
      }
    }

    const b = this.ball;
    if (!b) return;

    b.vy += BALL_GRAV * dt;
    b.x += b.vx * dt;
    b.y += b.vy * dt;

    // table bounce
    if (b.vy > 0 && b.y >= this.surfaceY - 1 && b.y <= this.surfaceY + 6 &&
        b.x >= this.rect.x0 && b.x <= this.rect.x1) {
      b.y = this.surfaceY - 1;
      b.vy = -Math.abs(b.vy) * 0.92;
      if (Math.abs(b.vy) < 60) b.vy = -160; // keep the rally alive
    }
    // net
    const netX = (this.rect.x0 + this.rect.x1) / 2;
    if (Math.abs(b.x - netX) < 2 && b.y > this.surfaceY - 7 && b.y < this.surfaceY) {
      b.vx = -b.vx * 0.25;
      b.x += b.vx * dt * 2;
    }
    // bot play
    for (const s of ['L', 'R']) {
      if (this.sides[s] === 'bot' && this.botSwingCooldown <= 0) {
        const toward = s === 'L' ? b.vx < 0 : b.vx > 0;
        if (toward && this.strike(s, rand(0.88, 1.02))) this.botSwingCooldown = 0.5;
      }
    }
    // floor → point
    if (b.y > this.groundY - 3) {
      const winner = b.x < netX ? 'R' : 'L';
      this.score[winner]++;
      this.ball = null;
      if (this.score[winner] >= WIN_SCORE) {
        this.setMsg((winner === 'L' ? 'left' : 'right') + ' wins!', 3);
        this.over = true;
        this.score = { L: 0, R: 0 };
        this.serveSide = winner;
        this.serveT = 3.2;
        this.over = false;
      } else {
        this.setMsg(this.score.L + ' - ' + this.score.R, 1.2);
        this.serveSide = winner;
        this.serveT = 1.6;
      }
    }
    // ball escapes sideways far → reset the point
    if (b && (b.x < this.rect.x0 - 220 || b.x > this.rect.x1 + 220)) {
      this.ball = null;
      this.serveT = 1.2;
    }
  }

  snapshot() {
    return {
      sides: this.sides, score: this.score, ball: this.ball,
      msg: this.msg, serveSide: this.serveSide,
    };
  }

  applySnapshot(s) {
    if (!s) return;
    this.sides = s.sides || { L: null, R: null };
    this.score = s.score || { L: 0, R: 0 };
    this.ball = s.ball || null;
    this.msg = s.msg || null;
    this.serveSide = s.serveSide || 'L';
  }
}
