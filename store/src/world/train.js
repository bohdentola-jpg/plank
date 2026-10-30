// The 3 train (and its ghostly cousin). Trains run on the near track, in front
// of the platform: they pull in from the left, stop with a door near you, and
// pull out to the right. Drawn live in world space.
import { rrect, rect, ellipse, stroke, text, dot, FONTS, INK, rgba, tint, shade } from '../ink.js';
import { drawRat } from '../art/critters.js';

const CAR_W = 520, CAR_GAP = 18, CARS = 4;
const TOP = 268, BOTTOM = 600;
export const TRAIN_LEN = CARS * (CAR_W + CAR_GAP);

export class Train {
  constructor() {
    this.active = false;
    this.x = 0;          // left edge of the first car
    this.v = 0;
    this.state = 'idle'; // in | stopped | out
    this.ghost = false;
    this.doors = 0;      // 0 closed .. 1 open
    this.doorsWant = 0;
    this.stopX = 0;
    this.riders = [];
    this.express = false;
    this.onStop = null;
    this.onGone = null;
    this.passengerLook = null;
    this.showPassenger = false;
  }

  // a train that stops so that a door lines up with targetX
  arrive(targetX, viewLeft, o = {}) {
    this.active = true;
    this.ghost = !!o.ghost;
    this.express = false;
    // door positions are at 0.5 of each car; pick the car whose door lands nearest the target
    const car = Math.max(0, Math.min(CARS - 1, Math.floor(CARS / 2)));
    this.stopX = targetX - (car * (CAR_W + CAR_GAP) + CAR_W / 2);
    this.x = Math.min(this.stopX - 1400, viewLeft - TRAIN_LEN - 80);
    this.v = 0;
    this.state = 'in';
    this.doors = 0;
    this.doorsWant = 0;
    this.onStop = o.onStop || null;
    this.riders = Array.from({ length: 6 }, (_, i) => ({ car: i % CARS, x: 60 + ((i * 137) % 380), look: RIDER_LOOKS[i % RIDER_LOOKS.length] }));
  }

  // an express blowing through without stopping
  passThrough(viewLeft) {
    this.active = true;
    this.ghost = false;
    this.express = true;
    this.state = 'out';
    this.x = viewLeft - TRAIN_LEN - 200;
    this.v = 1900;
    this.doors = 0;
    this.riders = Array.from({ length: 6 }, (_, i) => ({ car: i % CARS, x: 60 + ((i * 97) % 380), look: RIDER_LOOKS[(i + 2) % RIDER_LOOKS.length] }));
  }

  depart(onGone) {
    this.state = 'out';
    this.doorsWant = 0;
    this.onGone = onGone || null;
    this.v = 0;
  }

  update(dt, viewRight) {
    if (!this.active) return;
    this.doors += Math.sign(this.doorsWant - this.doors) * Math.min(Math.abs(this.doorsWant - this.doors), dt * 2.4);
    if (this.state === 'in') {
      const d = this.stopX - this.x;
      // decelerate smoothly onto the mark
      const want = Math.min(1500, Math.sqrt(Math.max(0, d) * 2 * 900));
      this.v = want;
      this.x += this.v * dt;
      if (d < 2) {
        this.x = this.stopX;
        this.v = 0;
        this.state = 'stopped';
        this.doorsWant = 1;
        if (this.onStop) {
          const cb = this.onStop;
          this.onStop = null;
          setTimeout(cb, 450);
        }
      }
    } else if (this.state === 'out') {
      if (this.doors > 0.02) return;
      this.v = Math.min(this.express ? 2200 : 1700, this.v + dt * (this.express ? 0 : 700));
      this.x += this.v * dt;
      if (this.x > viewRight + 60) {
        this.active = false;
        this.state = 'idle';
        if (this.onGone) {
          const cb = this.onGone;
          this.onGone = null;
          cb();
        }
      }
    }
  }

  doorX() {
    const car = Math.floor(CARS / 2);
    return this.x + car * (CAR_W + CAR_GAP) + CAR_W / 2;
  }

  draw(g, t, viewLeft, viewRight) {
    if (!this.active) return;
    const ghost = this.ghost;
    const body = ghost ? 'rgba(170,255,232,0.55)' : '#c8ccd8';
    const line = ghost ? '#1d4a4a' : INK;
    const blur = Math.min(1, this.v / 1600);
    g.save();
    if (ghost) {
      g.globalCompositeOperation = 'source-over';
      const glow = g.createLinearGradient(0, TOP - 40, 0, BOTTOM);
      glow.addColorStop(0, 'rgba(120,255,220,0)');
      glow.addColorStop(0.5, 'rgba(120,255,220,0.12)');
      glow.addColorStop(1, 'rgba(120,255,220,0)');
      g.fillStyle = glow;
      g.fillRect(this.x - 60, TOP - 60, TRAIN_LEN + 120, BOTTOM - TOP + 80);
    }
    for (let c = 0; c < CARS; c++) {
      const cx = this.x + c * (CAR_W + CAR_GAP);
      if (cx > viewRight + 20 || cx + CAR_W < viewLeft - 20) continue;
      // coupler
      if (c > 0) rect(g, cx - CAR_GAP - 2, 470, CAR_GAP + 4, 14, { fill: '#2a2638', lw: 2.4, amp: 0 });
      // car body
      rrect(g, cx, TOP, CAR_W, BOTTOM - TOP - 26, 18, { fill: body, shade: ghost ? 'rgba(90,200,180,0.5)' : '#9aa0b4', sdx: 0, sdy: 8, lw: 3.5, line, amp: 0.3, seed: c + 3 });
      // roof line + stripe
      stroke(g, [[cx + 10, TOP + 22], [cx + CAR_W - 10, TOP + 22]], { lw: 2.4, color: rgba('#140f26', 0.5), amp: 0 });
      g.fillStyle = ghost ? 'rgba(255,217,138,0.7)' : '#d4473f';
      g.fillRect(cx + 4, TOP + 196, CAR_W - 8, 12);
      // windows + doors
      for (let k = 0; k < 2; k++) {
        const wx = cx + 36 + k * 312;
        rrect(g, wx, TOP + 56, 128, 92, 10, { fill: ghost ? 'rgba(255,240,200,0.35)' : '#2a3a5a', lw: 3, line, amp: 0.2, seed: c * 10 + k });
      }
      // door (center): two leaves slide apart
      const dx = cx + CAR_W / 2 - 50;
      const open = this.doors * 44;
      rect(g, dx - 2, TOP + 40, 104, 212, { fill: ghost ? 'rgba(255,240,200,0.25)' : '#1d2438', lw: 3, line, amp: 0.2, seed: c + 40 });
      rect(g, dx - open, TOP + 42, 50, 208, { fill: body, lw: 3, line, amp: 0.2, seed: c + 50 });
      rect(g, dx + 50 + open, TOP + 42, 50, 208, { fill: body, lw: 3, line, amp: 0.2, seed: c + 60 });
      rrect(g, dx + 8 - open, TOP + 60, 34, 70, 6, { fill: ghost ? 'rgba(255,240,200,0.35)' : '#2a3a5a', lw: 2.4, line, amp: 0.1, seed: c + 70 });
      rrect(g, dx + 58 + open, TOP + 60, 34, 70, 6, { fill: ghost ? 'rgba(255,240,200,0.35)' : '#2a3a5a', lw: 2.4, line, amp: 0.1, seed: c + 80 });
      // riders in the windows
      for (const r of this.riders) {
        if (r.car !== c) continue;
        const rx = cx + 36 + (r.x % 2 ? 312 : 0) + 64;
        g.save();
        g.beginPath();
        g.rect(cx + 36 + (r.x % 2 ? 312 : 0), TOP + 56, 128, 92);
        g.clip();
        g.globalAlpha = ghost ? 0.5 : 0.9;
        drawRat(g, rx + ((r.x * 7) % 50) - 25, TOP + 170, { t, look: r.look, pocket: true, noShadow: true, facing: r.x % 3 ? 1 : -1 });
        g.restore();
      }
      // the player, riding
      if (this.showPassenger && c === Math.floor(CARS / 2) && this.passengerLook) {
        g.save();
        g.beginPath();
        g.rect(dx, TOP + 42, 100, 206);
        g.clip();
        drawRat(g, dx + 50, TOP + 248, { t, look: this.passengerLook, noShadow: true, facing: 1 });
        g.restore();
      }
      // route bullet + destination sign
      ellipse(g, cx + CAR_W - 40, TOP + 36, 15, 15, { fill: ghost ? '#9ad8c8' : '#d4473f', lw: 2.4, line, seed: c });
      text(g, ghost ? '?' : '3', cx + CAR_W - 40, TOP + 43, { size: 18, font: FONTS.sign, fill: '#fff', lw: 0 });
      // skirt + wheels
      rect(g, cx + 10, BOTTOM - 28, CAR_W - 20, 18, { fill: '#2a2638', lw: 3, line, amp: 0.2, seed: c + 90 });
      for (const wx of [cx + 70, cx + 130, cx + CAR_W - 130, cx + CAR_W - 70]) {
        ellipse(g, wx, BOTTOM - 8, 19, 19, { fill: '#3a3650', lw: 3, line, seed: Math.round(wx) });
        const a = (this.x / 19) % (Math.PI * 2);
        stroke(g, [[wx, BOTTOM - 8], [wx + Math.cos(a) * 14, BOTTOM - 8 + Math.sin(a) * 14]], { lw: 3, color: '#8a86a8', amp: 0 });
      }
    }
    // speed lines
    if (blur > 0.2) {
      g.strokeStyle = rgba(ghost ? '#c8fff0' : '#ffffff', 0.25 * blur);
      g.lineWidth = 3;
      for (let i = 0; i < 14; i++) {
        const y = TOP + 20 + ((i * 53) % (BOTTOM - TOP - 40));
        const len = 80 + ((i * 97) % 160);
        const x = this.x - 40 - ((i * 211) % 300);
        g.beginPath();
        g.moveTo(x, y);
        g.lineTo(x - len * blur, y);
        g.stroke();
      }
    }
    // headlights glow when approaching
    if (this.state === 'in' || this.express) {
      const fx = this.x + TRAIN_LEN;
      g.save();
      g.globalCompositeOperation = 'lighter';
      const gl = g.createRadialGradient(fx, 420, 10, fx, 420, 420);
      gl.addColorStop(0, ghost ? 'rgba(160,255,230,0.35)' : 'rgba(255,240,200,0.35)');
      gl.addColorStop(1, 'rgba(255,240,200,0)');
      g.fillStyle = gl;
      g.fillRect(fx - 40, 0, 460, 800);
      g.restore();
    }
    g.restore();
  }
}

const RIDER_LOOKS = [
  { fur: 'slate', hoodie: '#3a3f5c', hat: 'fedora', hatColor: '#4a4560', shoe: '#2a2238' },
  { fur: 'cocoa', hoodie: '#e8456b', hat: 'none', shoe: '#f4efe6' },
  { fur: 'snow', hoodie: '#3ec7b0', hat: 'beanie', hatColor: '#ffd23f', shoe: '#f4efe6' },
  { fur: 'midnight', hoodie: '#ff8a3d', hat: 'cap', hatColor: '#2a2238', shoe: '#f4efe6' },
  { fur: 'sand', hoodie: '#7b5cff', hat: 'bucket', hatColor: '#f4efe6', shoe: '#ffd23f' },
];

// Tunnel interstitial between stations: streaking lights + the next stop.
export function drawTunnel(g, W, H, t, nextName, ghost) {
  g.fillStyle = ghost ? '#06110f' : '#06040e';
  g.fillRect(0, 0, W, H);
  const speed = 2600;
  for (let i = 0; i < 12; i++) {
    const x = ((i * 380 - t * speed) % (W + 400) + W + 400) % (W + 400) - 200;
    const y = H * (0.3 + ((i * 37) % 40) / 100);
    const grad = g.createLinearGradient(x, 0, x + 220, 0);
    grad.addColorStop(0, ghost ? 'rgba(150,255,220,0)' : 'rgba(255,220,150,0)');
    grad.addColorStop(1, ghost ? 'rgba(150,255,220,0.7)' : 'rgba(255,220,150,0.7)');
    g.fillStyle = grad;
    g.fillRect(x, y, 220, 4);
  }
  g.fillStyle = 'rgba(255,255,255,0.05)';
  for (let i = 0; i < 40; i++) {
    const x = ((i * 97 - t * speed * 1.6) % (W + 100) + W + 100) % (W + 100) - 50;
    g.fillRect(x, H * 0.82 + (i % 3) * 6, 60, 2);
  }
  const s = Math.min(W / 900, H / 500);
  g.save();
  g.translate(W / 2, H / 2);
  g.scale(s, s);
  text(g, 'NEXT STOP', 0, -40, { size: 26, font: FONTS.sign, fill: ghost ? '#9ad8c8' : '#ffd23f', lw: 4, spacing: 3 });
  text(g, nextName, 0, 30, { size: 64, font: FONTS.sign, fill: '#f6ecd2', lw: 8, spacing: 2 });
  g.restore();
}
