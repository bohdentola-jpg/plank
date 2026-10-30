// The player's rat: walk / run / hop along the platform, tap-to-walk with an
// arrival callback (so tapping a shop walks you there, then opens it).
import { drawRat } from '../art/critters.js';
import { keys } from '../engine.js';

const WALK = 210, RUN = 340, ACCEL = 2000, GRAV = 1650, JUMP = 560;

export class Player {
  constructor() {
    this.x = 500;
    this.h = 0;        // height above floor (positive = up)
    this.vx = 0;
    this.vh = 0;
    this.facing = 1;
    this.phase = 0;
    this.target = null;
    this.onArrive = null;
    this.frozen = false;  // no movement at all
    this.noKeys = false;  // scripted walks only
    this.hidden = false;
    this.look = null;
    this.blinkT = 2;
    this.blink = 0;
    this.squash = 0;
    this.minX = 0;
    this.maxX = 99999;
    this.cheer = 0;
    this.stepAcc = 0;
    this.onStep = null;
    this.onLand = null;
  }

  walkTo(x, cb) {
    this.target = Math.max(this.minX, Math.min(this.maxX, x));
    this.onArrive = cb || null;
  }

  stop() {
    this.target = null;
    this.onArrive = null;
    this.vx = 0;
  }

  jump() {
    if (this.h <= 0.01 && !this.frozen) {
      this.vh = JUMP;
      this.squash = -0.15;
      return true;
    }
    return false;
  }

  update(dt) {
    let want = 0;
    const run = keys.has('run') && !this.noKeys;
    if (!this.frozen && !this.noKeys) {
      if (keys.has('left')) want -= 1;
      if (keys.has('right')) want += 1;
    }
    if (want !== 0) {
      this.target = null;
      this.onArrive = null;
    }
    let speed = run ? RUN : WALK;
    if (this.target != null && !this.frozen) {
      const d = this.target - this.x;
      if (Math.abs(d) < 5) {
        this.x = this.target;
        this.target = null;
        this.vx = 0;
        const cb = this.onArrive;
        this.onArrive = null;
        if (cb) cb();
      } else {
        want = Math.sign(d);
        speed = Math.abs(d) > 500 ? RUN : WALK;
        // ease into the stop
        speed = Math.min(speed, Math.abs(d) * 6 + 60);
      }
    }
    const tv = want * speed;
    const dv = tv - this.vx;
    const a = ACCEL * dt;
    this.vx += Math.abs(dv) < a ? dv : Math.sign(dv) * a;
    const prevX = this.x;
    this.x += this.vx * dt;
    if (this.x < this.minX) { this.x = this.minX; this.vx = 0; }
    if (this.x > this.maxX) { this.x = this.maxX; this.vx = 0; }
    if (Math.abs(this.vx) > 8) this.facing = Math.sign(this.vx);
    const moved = Math.abs(this.x - prevX);
    this.phase = (this.phase + moved / (run ? 76 : 62)) % 1;
    if (this.h <= 0) {
      this.stepAcc += moved;
      if (this.stepAcc > 52) {
        this.stepAcc = 0;
        if (this.onStep) this.onStep();
      }
    }
    // vertical
    if (this.h > 0 || this.vh > 0) {
      this.vh -= GRAV * dt;
      this.h += this.vh * dt;
      if (this.h <= 0) {
        this.h = 0;
        this.vh = 0;
        this.squash = 0.18;
        if (this.onLand) this.onLand();
      }
    }
    this.squash *= Math.exp(-dt * 10);
    // blink
    this.blinkT -= dt;
    if (this.blinkT < 0) {
      this.blink = 0.12;
      this.blinkT = 2 + Math.random() * 3;
    }
    if (this.blink > 0) this.blink -= dt;
    if (this.cheer > 0) this.cheer -= dt;
  }

  get moving() { return Math.abs(this.vx) > 12; }

  draw(g, t, floorY) {
    if (this.hidden) return;
    let pose = 'idle';
    if (this.h > 0) pose = this.vh > 0 ? 'jump' : 'fall';
    else if (this.cheer > 0) pose = 'cheer';
    else if (this.moving) pose = 'walk';
    g.save();
    g.translate(this.x, floorY - this.h);
    g.scale(1 + this.squash * 0.6, 1 - this.squash);
    if (this.h > 0) {
      // shadow stays on the floor
      g.save();
      g.translate(0, this.h);
      g.fillStyle = 'rgba(10,6,24,0.28)';
      g.beginPath();
      g.ellipse(2, 0, Math.max(8, 24 - this.h * 0.12), 4, 0, 0, Math.PI * 2);
      g.fill();
      g.restore();
    }
    drawRat(g, 0, 0, {
      look: this.look, t, facing: this.facing,
      walk: pose === 'walk' ? this.phase : null, pose,
      run: Math.abs(this.vx) > WALK + 20,
      blink: this.blink > 0 ? 1 : 0,
      noShadow: this.h > 0,
      boil: 11 + (Math.floor(t * 7) % 3) * 101,
    });
    g.restore();
  }
}
