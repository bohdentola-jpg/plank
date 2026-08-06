// pong.js — the ping pong table, in 3D.
//
// Walk to either end and press E to pick up a paddle. Aim with the mouse and
// click to swing: where you're looking is where it goes. First to 5. If nobody
// takes the other end, a cardboard box wanders over and plays you.
//
// The host simulates the ball; everyone else renders the snapshots.

import { clamp, rand } from './util.js';

const BALL_GRAV = 15;
const WIN_SCORE = 5;
const BOT_DELAY = 2.4;
const REACH = 3.2;

export class Pong {
  constructor(tableEnt) {
    this.tableId = tableEnt.id;
    const s = tableEnt.size;
    this.cx = tableEnt.x;
    this.cz = tableEnt.z;
    this.baseY = tableEnt.y;
    this.halfLen = s.x / 2;                 // table runs along x
    this.halfWid = s.z / 2;
    this.surfaceY = tableEnt.y + s.y * 0.72;   // top of the slab
    this.sides = { L: null, R: null };
    this.score = { L: 0, R: 0 };
    this.ball = null;
    this.serveSide = 'L';
    this.serveT = 0;
    this.msg = null;
    this.msgT = 0;
    this.botT = 0;
    this.botCool = 0;
    this.lastHit = null;
  }

  // where a player stands to play a side
  station(side) {
    const dx = side === 'L' ? -(this.halfLen + 2.2) : (this.halfLen + 2.2);
    return { x: this.cx + dx, z: this.cz };
  }

  paddleY() { return this.surfaceY + 0.9; }
  sideOf(id) { return this.sides.L === id ? 'L' : this.sides.R === id ? 'R' : null; }
  humanCount() { return ['L', 'R'].filter(s => this.sides[s] && this.sides[s] !== 'bot').length; }

  nearStation(x, z) {
    for (const side of ['L', 'R']) {
      const st = this.station(side);
      if (Math.hypot(x - st.x, z - st.z) < 3.4) return side;
    }
    return null;
  }

  join(id, x, z) {
    const existing = this.sideOf(id);
    if (existing) return existing;
    const want = this.nearStation(x, z) || (x < this.cx ? 'L' : 'R');
    const other = want === 'L' ? 'R' : 'L';
    for (const side of [want, other]) {
      if (!this.sides[side] || this.sides[side] === 'bot') {
        this.sides[side] = id;
        this.startIfReady();
        return side;
      }
    }
    return null;
  }

  leave(id) {
    let left = false;
    for (const side of ['L', 'R']) if (this.sides[side] === id) { this.sides[side] = null; left = true; }
    if (left && this.humanCount() === 0) this.reset();
    return left;
  }

  reset() {
    this.sides = { L: null, R: null };
    this.score = { L: 0, R: 0 };
    this.ball = null;
    this.msg = null;
    this.msgT = 0;
    this.serveT = 0;
    this.botT = 0;
    this.lastHit = null;
  }

  startIfReady() {
    if (this.sides.L && this.sides.R && !this.ball && this.serveT <= 0) {
      this.serveT = 1.2;
      this.setMsg('serve', 1.2);
    }
  }

  setMsg(m, t = 1.6) { this.msg = m; this.msgT = t; }

  // A player swung. dir = the unit vector they're aiming (from the camera).
  swing(id, dir) {
    const side = this.sideOf(id);
    if (!side || !this.ball) return false;
    return this.hit(side, dir, 1);
  }

  hit(side, dir, quality) {
    const b = this.ball;
    if (!b) return false;
    const st = this.station(side);
    const py = this.paddleY();
    if (Math.hypot(b.x - st.x, b.z - st.z) > REACH) return false;
    if (Math.abs(b.y - py) > 2.2) return false;
    const away = side === 'L' ? 1 : -1;
    if (Math.sign(b.vx) === away && Math.abs(b.vx) > 2) return false;   // already leaving
    if (this.lastHit === side) return false;                            // no double hits

    // aim: mostly down the table, steered by where they're looking
    const power = rand(11, 14) * quality;
    let ax = away, az = 0;
    if (dir) {
      const len = Math.hypot(dir.x, dir.z) || 1;
      ax = away * Math.max(0.55, Math.abs(dir.x / len));
      az = clamp(dir.z / len, -0.75, 0.75);
    }
    const n = Math.hypot(ax, az) || 1;
    b.vx = (ax / n) * power;
    b.vz = (az / n) * power * 0.7;
    b.vy = rand(5.2, 7);
    this.lastHit = side;
    return true;
  }

  // host step. players = Map(id → player) so the bot can watch a real target.
  step(dt) {
    if (this.msgT > 0) { this.msgT -= dt; if (this.msgT <= 0) this.msg = null; }
    this.botCool -= dt;

    const humanL = this.sides.L && this.sides.L !== 'bot';
    const humanR = this.sides.R && this.sides.R !== 'bot';
    if (!humanL && !humanR) { if (this.sides.L || this.sides.R) this.reset(); return; }

    // the box-bot fills an empty end
    if ((humanL && !this.sides.R) || (humanR && !this.sides.L)) {
      this.botT += dt;
      if (this.botT > BOT_DELAY) {
        this.sides[humanL ? 'R' : 'L'] = 'bot';
        this.setMsg('a box wants to play', 1.8);
        this.botT = 0;
        this.startIfReady();
      }
    } else this.botT = 0;

    if (this.serveT > 0) {
      this.serveT -= dt;
      if (this.serveT <= 0) {
        this.serveT = 0;                       // never leave a negative countdown behind
        if (this.sides.L && this.sides.R) {
          const st = this.station(this.serveSide);
          this.ball = {
            x: st.x + (this.serveSide === 'L' ? 1.2 : -1.2),
            y: this.paddleY() + 0.4,
            z: st.z,
            vx: (this.serveSide === 'L' ? 1 : -1) * rand(10, 12),
            vy: rand(5, 6.4),
            vz: rand(-1.2, 1.2),
          };
          this.lastHit = this.serveSide;
        }
      }
    }

    const b = this.ball;
    if (!b) return;

    b.vy -= BALL_GRAV * dt;
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.z += b.vz * dt;

    // table bounce
    const onTable = Math.abs(b.x - this.cx) <= this.halfLen && Math.abs(b.z - this.cz) <= this.halfWid;
    if (b.vy < 0 && onTable && b.y <= this.surfaceY + 0.1 && b.y > this.surfaceY - 0.9) {
      b.y = this.surfaceY + 0.1;
      b.vy = Math.abs(b.vy) * 0.86;
      if (b.vy < 3) b.vy = 4.4;               // keep rallies alive
    }
    // the net
    if (Math.abs(b.x - this.cx) < 0.2 && b.y < this.surfaceY + 0.95 && b.y > this.surfaceY) {
      b.vx = -b.vx * 0.3;
      b.x += b.vx * dt * 2;
      this.lastHit = null;
    }

    // the bot plays its end
    for (const side of ['L', 'R']) {
      if (this.sides[side] !== 'bot' || this.botCool > 0) continue;
      const coming = side === 'L' ? b.vx < 0 : b.vx > 0;
      if (!coming) continue;
      const st = this.station(side);
      if (Math.hypot(b.x - st.x, b.z - st.z) < REACH * 0.85) {
        const aim = { x: side === 'L' ? 1 : -1, z: clamp(rand(-0.5, 0.5), -0.6, 0.6) };
        if (this.hit(side, aim, rand(0.86, 1.02))) this.botCool = 0.45;
      }
    }

    // point over: hit the floor or flew away
    const floor = this.baseY - 0.2;
    if (b.y < floor || Math.abs(b.x - this.cx) > this.halfLen + 26 || Math.abs(b.z - this.cz) > this.halfWid + 22) {
      const winner = b.x < this.cx ? 'R' : 'L';
      this.score[winner]++;
      this.ball = null;
      this.lastHit = null;
      if (this.score[winner] >= WIN_SCORE) {
        this.setMsg((winner === 'L' ? 'left' : 'right') + ' wins ' + this.score.L + '-' + this.score.R, 3.4);
        this.score = { L: 0, R: 0 };
        this.serveSide = winner;
        this.serveT = 3.6;
      } else {
        this.setMsg('point', 1.1);
        this.serveSide = winner;
        this.serveT = 1.8;
      }
    }
  }

  snapshot() {
    return {
      s: this.sides, sc: this.score,
      b: this.ball ? [
        Math.round(this.ball.x * 100) / 100,
        Math.round(this.ball.y * 100) / 100,
        Math.round(this.ball.z * 100) / 100,
      ] : null,
      m: this.msg, ss: this.serveSide,
    };
  }

  applySnapshot(s) {
    if (!s || typeof s !== 'object') return;
    const sides = s.s && typeof s.s === 'object' ? s.s : {};
    this.sides = {
      L: typeof sides.L === 'string' ? sides.L : null,
      R: typeof sides.R === 'string' ? sides.R : null,
    };
    const sc = s.sc && typeof s.sc === 'object' ? s.sc : {};
    this.score = { L: +sc.L || 0, R: +sc.R || 0 };
    if (Array.isArray(s.b) && s.b.length >= 3) {
      this.ball = { x: +s.b[0] || 0, y: +s.b[1] || 0, z: +s.b[2] || 0, vx: 0, vy: 0, vz: 0 };
    } else this.ball = null;
    this.msg = typeof s.m === 'string' ? s.m.slice(0, 40) : null;
    this.serveSide = s.ss === 'R' ? 'R' : 'L';
  }
}
