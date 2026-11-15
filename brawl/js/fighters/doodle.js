// DOODLE & CHOMPS - slot 10 of the roster.
// Brief: a duo in one body - the little one rides on top of the monster. The
// monster chomps; the rider's balloon gives them several air jumps and a slow
// float. Super: a super chomp - but first blanked-out letters of a word appear
// and the player fills them in; the more they get right, the stronger the bite.
//
// Doodle is a ballpoint stick figure out of a notebook margin. Chomps is a
// staple remover with googly eyes. Custom rig: the jaw angle is the main pose
// control (`jaw` 0 shut .. 1 wide open); every attack is a bite.

import { customPose } from '../game/rig.js';
import { K, hit, box, air, stdThrows, shoot, countMine, costumes } from '../game/movekit.js';
import { Entity, Projectile } from '../game/entities.js';
import { W, H } from '../core/config.js';
import { OUT, LW, circle, ellipse, blob, rrect, polygon, line, eye, gloss, darken, lighten, txt, rr, fs } from '../core/gfx.js';
import { TAU, clamp, approach, ease } from '../core/util.js';

const BASE = {
  main: '#2f6fe0', ink: '#2456c8', paper: '#ffffff',
  shell: '#8a5fd0', pad: '#3a3f55', steel: '#d7dde6', gum: '#4a1f3a',
  balloon: '#e8402a', string: '#6b6f7a',
};

// pose: squash (sx, sy), spin (rot), slide (ox, oy), face, jaw 0..1, balloon stretch (tug) and size (pump)
const STANCE = { sx: 1, sy: 1, rot: 0, ox: 0, oy: 0, face: 0, jaw: 0.1, tug: 0, pump: 0 };
const CY = -16;                          // the pivot the body spins about
const HX = -12, HY = -13, JAW_MAX = 0.85; // the hinge, and how far the top jaw swings up
const SEAT = [10, -20.5];                // where Doodle sits, measured from the hinge along the top jaw

function pose(f) {
  return customPose(f, STANCE, (ff, p) => {
    const t = ff.t || 0, v = ff.v || {}, c = ff.cycle || 0;
    switch (ff.state) {
      case 'walk': case 'run': case 'dash': {     // waddles along, chattering
        const k = ff.state === 'walk' ? 8 : 12;
        p.jaw = 0.1 + Math.abs(Math.sin(c / k)) * 0.42; p.rot = Math.sin(c / k) * 0.11; p.oy = -Math.abs(Math.sin(c / k)) * 3.5;
        break;
      }
      case 'hitstun': case 'tumble': case 'trapped': case 'helpless': p.jaw = 0.75; break;
      case 'grabhold': p.jaw = 0.42; break;
      case 'grabbed': case 'stun': p.jaw = 0.4; break;
      case 'ledge': p.jaw = 0.22; p.rot = -0.55; break;         // hangs on by the teeth
      case 'shield': case 'shieldstun': case 'crouch': case 'down': p.jaw = 0; break;
      case 'win': p.jaw = 0.2 + Math.abs(Math.sin(t * 0.3)) * 0.5; break;
      case 'lose': p.jaw = 0.04; break;
      default: p.jaw = 0.1 + Math.sin(t * 0.08) * 0.04;
    }
    p.tug = Math.max((v.tug || 0) / 12, v.floating ? 0.7 : 0);
  });
}

// local point -> where it ends up after the pose's spin, squash and slide
function xf(p, x, y) {
  if (p.rot) { const c = Math.cos(p.rot), s = Math.sin(p.rot), dy = y - CY, nx = x * c - dy * s; y = x * s + dy * c + CY; x = nx; }
  return [x * p.sx + p.ox, y * p.sy + p.oy];
}
// a point on the top jaw (measured from the hinge) -> local
function jawPt(p, hx, hy) { const a = -p.jaw * JAW_MAX, c = Math.cos(a), s = Math.sin(a); return [HX + hx * c - hy * s, HY + hx * s + hy * c]; }

function points(f, p) {
  return {
    body: xf(p, 0, CY), mouth: xf(p, 23, -11), far: xf(p, 33, -11), top: xf(p, -2, -44), bottom: xf(p, 2, -3), back: xf(p, -15, -12),
    grab: [36, 0],
  };
}

// The balloon floats upright whatever the body is doing. Returns hand + balloon in local space.
function balloonAt(f, p) {
  const hand = jawPt(p, SEAT[0] - 6.6, SEAT[1] - 20.4), h = xf(p, hand[0], hand[1]), t = f.t || 0;
  const lagX = clamp(-(f.vx || 0) * (f.facing || 1) * 1.6, -9, 9) + Math.sin(t * 0.06) * 1.5;
  const lagY = clamp(-(f.vy || 0), -6, 8);
  const k = 1 + p.pump * 0.55;
  return { hx: h[0], hy: h[1], bx: h[0] + lagX - 2, by: h[1] - 27 - p.tug * 9 + lagY - p.pump * 6, rx: 8.4 * k * (1 - p.tug * 0.12), ry: 10 * k * (1 + p.tug * 0.24) };
}

// ---- drawing -----------------------------------------------------------------
function drawRider(ctx, pal, ex, t, held) {
  const ink = pal.ink;
  ctx.strokeStyle = ink; ctx.lineWidth = 2.1; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(0, -2); ctx.lineTo(4.6, 3); ctx.lineTo(3.4, 8.4); ctx.lineTo(6.6, 8.8);        // near leg, astride
  ctx.moveTo(0, -2); ctx.lineTo(-0.8, -11.5);                                               // body
  ctx.moveTo(-0.6, -9.5); ctx.lineTo(5.4, -6.4); ctx.lineTo(8.6, -3.2);                       // hanging on
  ctx.moveTo(-0.6, -9.5); ctx.lineTo(-4.6, -12.5);                                          // the balloon arm
  if (held) ctx.lineTo(-5.5, -17); else ctx.lineTo(-8.6, -9);
  ctx.stroke();
  circle(ctx, -0.8, -17.6, 6.2, pal.paper, ink, 2.1);
  ctx.lineWidth = 1.5; ctx.fillStyle = ink;
  const ey = -18.6;
  if (ex === 2) { ctx.beginPath(); for (const x of [0.4, 3.6]) { ctx.moveTo(x - 1.2, ey - 1.2); ctx.lineTo(x + 1.2, ey + 1.2); ctx.moveTo(x - 1.2, ey + 1.2); ctx.lineTo(x + 1.2, ey - 1.2); } ctx.stroke(); }
  else if (ex === 3) { ctx.beginPath(); for (const x of [0.4, 3.6]) ctx.arc(x, ey + 0.8, 1.3, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke(); }
  else if (ex === 5) { ctx.beginPath(); for (const x of [0.4, 3.6]) { ctx.moveTo(x - 1.2, ey); ctx.lineTo(x + 1.2, ey); } ctx.stroke(); }
  else if (ex === 4) { ctx.beginPath(); for (const x of [0.4, 3.6]) { ctx.moveTo(x + 1.3, ey); ctx.arc(x, ey, 1.3, 0, TAU); } ctx.stroke(); }
  else { const r = ex === 6 ? 1.5 : 1.05; ctx.beginPath(); ctx.arc(0.4, ey, r, 0, TAU); ctx.arc(3.6, ey, r, 0, TAU); ctx.fill(); }
  ctx.beginPath();
  if (ex === 1) { ctx.moveTo(-1.2, ey - 3.2); ctx.lineTo(1.6, ey - 2.2); ctx.moveTo(5.2, ey - 3); ctx.lineTo(2.8, ey - 2.2); ctx.moveTo(0.4, -14.6); ctx.lineTo(3.8, -14.6); }
  else if (ex === 2 || ex === 6) ctx.arc(2, -14.4, 1.3, 0, TAU);
  else if (ex === 3) ctx.arc(2, -16, 2.6, 0.15, Math.PI - 0.15);
  else if (ex === 4) { ctx.moveTo(0, -14.4); ctx.quadraticCurveTo(1, -15.6, 2, -14.4); ctx.quadraticCurveTo(3, -13.2, 4, -14.4); }
  else ctx.arc(2, -15.8, 1.9, 0.3, Math.PI - 0.3);
  ctx.stroke();
}

function draw(ctx, f, p) {
  const pal = f.drawPal || f.pal, ex = p.face, t = f.t || 0, v = f.v || {};
  const a = -p.jaw * JAW_MAX, hasBalloon = !v.noBalloon;
  if (hasBalloon) {       // string + balloon first: they sit behind everything and never spin with the body
    const b = balloonAt(f, p);
    ctx.beginPath(); ctx.moveTo(b.hx, b.hy); ctx.quadraticCurveTo(b.hx + (b.hx - b.bx) * 0.35, (b.hy + b.by) / 2 + 3 - p.tug * 3, b.bx, b.by + b.ry + 2);
    ctx.strokeStyle = pal.string; ctx.lineWidth = 1.5; ctx.lineCap = 'round'; ctx.stroke();
    polygon(ctx, [b.bx - 2.4, b.by + b.ry + 3, b.bx + 2.4, b.by + b.ry + 3, b.bx, b.by + b.ry - 1.5], pal.balloon, OUT, 1.5);
    ellipse(ctx, b.bx, b.by, b.rx, b.ry, pal.balloon, OUT, LW);
    gloss(ctx, b.bx - b.rx * 0.36, b.by - b.ry * 0.42, b.rx * 0.3, b.ry * 0.2, 0.55, -0.6);
  }
  ctx.save();
  ctx.translate(p.ox, p.oy); ctx.scale(p.sx, p.sy); ctx.translate(0, CY);
  if (p.rot) ctx.rotate(p.rot);
  ctx.translate(0, -CY);
  if (p.jaw > 0.05) {     // the dark of the mouth, between the jaws
    const u1 = jawPt(p, 29, -4), u2 = jawPt(p, 12, -5);
    polygon(ctx, [-9, -11, u2[0], u2[1], u1[0], u1[1], 17, -8, 4, -7], pal.gum, null, 0);
  }
  // bottom jaw: rests on the floor
  blob(ctx, [-16, -13.5, -15.6, -5, -9, -0.6, 6, 0, 18, -0.6, 22, -5, 16, -7.6, 4, -6.6, -6, -8.6], pal.shell, OUT, LW, 0.4);
  rrect(ctx, -5, -3.6, 15, 3, 1.4, pal.pad, null, 0);
  polygon(ctx, [14.6, -7, 22, -5.4, 21.6, -16.6], pal.steel, OUT, 2);                        // bottom fang
  // top jaw: swings about the hinge, and carries the rider
  ctx.save(); ctx.translate(HX, HY); ctx.rotate(a);
  polygon(ctx, [26.4, -5, 34, -6.6, 33.6, 6.6], pal.steel, OUT, 2);                          // top fang
  blob(ctx, [-3.6, 0.6, -3, -10, 7, -18, 21, -19, 31.6, -14.6, 34.6, -6.6, 27, -4, 15, -5.6, 4, -4.6], pal.shell, OUT, LW, 0.4);
  gloss(ctx, 8, -14, 5.6, 2, 0.32, -0.3);
  rrect(ctx, 3.6, -21.2, 13, 3.6, 1.6, pal.pad, OUT, 1.6);                                   // the thumb grip is the saddle
  ctx.save(); ctx.translate(SEAT[0], SEAT[1]);
  ctx.translate(0, f.state === 'idle' ? Math.sin(t * 0.085 + 1) * 0.7 : 0); ctx.scale(1.2, 1.2);
  drawRider(ctx, pal, ex, t, hasBalloon);
  ctx.restore();
  // googly eyes stuck on the front
  const lx = clamp(Math.cos(t * 0.21) * 0.5 + (f.vx || 0) * (f.facing || 1) * 0.12, -1, 1), ly = clamp(Math.sin(t * 0.17) * 0.5 + (f.vy || 0) * 0.12, -1, 1);
  eye(ctx, 22.6, -19.4, 5.2, ex === 3 || ex === 6 ? 0 : ex, lx, ly, 1, { lw: 1.8, t, pr: ex === 6 ? 0.25 : 0.5 });
  eye(ctx, 30.4, -15, 4.5, ex === 3 || ex === 6 ? 0 : ex, lx, ly, -1, { lw: 1.8, t, pr: ex === 6 ? 0.25 : 0.5 });
  ctx.restore();
  circle(ctx, HX, HY, 3.3, pal.steel, OUT, 1.8);                                             // hinge rivet
  ctx.restore();
}

function stapleArt(ctx, p) {
  ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 2; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(p.x - p.vx * 0.8, p.y); ctx.lineTo(p.x - p.vx * 2.4, p.y); ctx.stroke();
  ctx.save(); ctx.translate(p.x, p.y); ctx.scale(p.vx < 0 ? -1 : 1, 1);
  ctx.lineJoin = 'round';
  ctx.beginPath(); ctx.moveTo(-6, -4.5); ctx.lineTo(5, -4.5); ctx.lineTo(5, 4.5); ctx.lineTo(-6, 4.5);
  ctx.strokeStyle = OUT; ctx.lineWidth = 5.4; ctx.stroke(); ctx.strokeStyle = '#d7dde6'; ctx.lineWidth = 2.4; ctx.stroke();
  ctx.restore();
}

// ---- balloon: pop ------------------------------------------------------------
function popBalloon(f, m, burst) {
  const b = balloonAt(f, f.pose || pose(f)), x = f.x + f.facing * b.bx, y = f.y + b.by, c = f.pal.balloon;
  f.v.noBalloon = true;
  m.sfx('pop'); m.fx.burst(x, y, 30, c); m.fx.spark(x, y, 8, c);
  if (burst) m.spawn(new Projectile(m, { owner: f, x, y, vx: 0, vy: 0, r: 34, life: 4, stage: 'pass', pierce: true, reflectable: false,
    hit: { dmg: 6, ang: 72, bk: 42, kg: 56, radial: true, sfx: 'pop' } }));
}

// ---- the super: FILL IN THE BLANK ---------------------------------------------
// Everyone else is frozen while a word with three letters missing hangs on a
// sheet of notebook paper. Each blank offers four letters on up / right / down /
// left; the bite that follows is bigger for every one answered correctly.
const WORDS = ['RECESS', 'PENCIL', 'ERASER', 'TEACHER', 'LOCKER', 'BACKPACK', 'HOMEWORK', 'CRAYONS', 'LIBRARY', 'SCIENCE', 'STAPLER', 'NOTEBOOK', 'SCISSORS', 'HALLWAY', 'SPELLING', 'FRACTION', 'TARDY', 'BINDER'];
const VOWELS = 'AEIOU', CONS = 'BCDFGHKLMNPRSTWY';
const GRADES = ['SEE ME', 'C-', 'B+', 'A+'];
const QIN = 22, QASK = 72, QMARK = 18, QOUT = 30;         // frames: paper drops in, time per blank, mark shown, grade shown
const QHOLD = 12, QBITE = 14, QSNAP = 36;                 // frames of the move: wait here, bite wind-up starts, jaws shut
const biteReach = (sc) => 112 + sc * 22, biteTop = (sc) => 84 + sc * 12;

class Quiz extends Entity {
  constructor(m, f) {
    super({ owner: f, tag: 'quiz' });
    const r = m.rng;
    this.f = f; this.word = r.pick(WORDS);
    const idx = [...this.word].map((_, i) => i);
    for (let i = idx.length - 1; i > 0; i--) { const j = r.int(0, i); const s = idx[i]; idx[i] = idx[j]; idx[j] = s; }
    this.blanks = idx.slice(0, 3).sort((x, y) => x - y);
    this.opts = this.blanks.map((i) => {           // letters[0..3] = up, right, down, left
      const right = this.word[i], pool = [...(VOWELS.includes(right) ? VOWELS + 'Y' : CONS)].filter((c) => c !== right), letters = [right];
      while (letters.length < 4) letters.push(pool.splice(r.int(0, pool.length - 1), 1)[0]);
      for (let k = 3; k > 0; k--) { const j = r.int(0, k); const s = letters[k]; letters[k] = letters[j]; letters[j] = s; }
      return { letters, right: letters.indexOf(right) };
    });
    this.cur = 0; this.res = []; this.picked = []; this.score = 0; this.phase = 'in'; this.pt = 0; this.prevDir = -2; this.shake = 0;
    // freeze the other side where they stand
    this.victims = m.foes(f).filter((v) => !v.superActive && v.state !== 'trapped');
    for (const v of this.victims) { v.interrupt(); v.setState('trapped'); v.v.trapMax = 520; }
    this.ov = { dead: false, draw: (ctx, mm) => this.drawScreen(ctx, mm) };
    m.overlays.push(this.ov);
    m.sfx('paper'); m.sfx('bell', { vol: 0.5 });
  }
  // which way the stick points right now: 0 up, 1 right, 2 down, 3 left, -1 neutral
  dir() {
    const i = this.f.inp, ax = Math.abs(i.x), ay = Math.abs(i.y);
    if (ax < 0.6 && ay < 0.6) return -1;
    return ay >= ax ? (i.y < 0 ? 0 : 2) : (i.x > 0 ? 1 : 3);
  }
  answer(m, pick) {
    const o = this.opts[this.cur], ok = pick === o.right;
    this.res.push(ok); this.picked.push(pick);
    if (ok) { this.score++; m.sfx('coin'); m.sfx('pencil', { vol: 0.6 }); } else { m.sfx('buzzer'); this.shake = 10; }
    this.phase = 'mark'; this.pt = 0;
  }
  release(v) { if (!v.out && v.state === 'trapped') { v.intangible = false; v.setState(v.grounded ? 'idle' : 'air'); } }
  // every way out comes through here: let go of everybody and take the paper down
  end(m) {
    if (this.dead) return;
    this.dead = true; this.ov.dead = true;
    for (const v of this.victims) this.release(v);
    this.victims.length = 0;
    if (this.f.v.quiz === this) this.f.v.quiz = null;
  }
  update(m) {
    this.t++; this.pt++;
    const f = this.f;
    if (this.shake > 0) this.shake--;
    if (f.out || f.state !== 'move' || f.moveId !== 'super' || m.state === 'over' || this.t > 500) { this.end(m); return; }
    for (let i = this.victims.length - 1; i >= 0; i--) {
      const v = this.victims[i];
      if (v.out || v.state !== 'trapped') { this.victims.splice(i, 1); continue; }
      v.intangible = true; v.vx = v.vy = v.kx = v.ky = 0;
    }
    if (this.phase === 'in') { if (this.pt >= QIN) this.ask(m); }
    else if (this.phase === 'ask') {
      if (f.isCPU) { if (this.pt >= this.cpuAt) this.answer(m, this.cpuPick); }
      else {
        const d = this.dir();
        if (d >= 0 && d !== this.prevDir && this.pt > 4) this.answer(m, d);
        this.prevDir = d;
      }
      if (this.phase === 'ask' && this.pt >= QASK) this.answer(m, -1);          // out of time counts as wrong
      else if (this.phase === 'ask' && this.pt > QASK - 30 && this.pt % 10 === 0) m.sfx('tick', { vol: 0.5 });
    } else if (this.phase === 'mark') {
      if (this.pt >= QMARK) { if (++this.cur >= 3) { this.phase = 'out'; this.pt = 0; m.sfx(this.score === 3 ? 'powerup' : this.score ? 'stamp' : 'fail'); } else this.ask(m); }
    } else if (this.phase === 'out') {
      if (this.pt >= QOUT) { this.phase = 'bite'; this.pt = 0; f.v.quizScore = this.score; f.mf = QBITE; m.sfx('growl'); }
    } else if (f.mf >= QSNAP) this.bite(m);
  }
  ask(m) {
    this.phase = 'ask'; this.pt = 0; this.prevDir = this.dir();
    const f = this.f, r = m.rng, o = this.opts[this.cur];
    if (f.isCPU) {         // CPUs "answer" after a think, right more often the higher their level
      this.cpuAt = 20 + r.int(0, 26);
      this.cpuPick = r.chance(0.25 + 0.07 * (f.cpuLevel || 0)) ? o.right : (o.right + r.int(1, 3)) % 4;
    }
  }
  bite(m) {
    const f = this.f, sc = this.score, d = f.facing;
    const x1 = f.x + d * 8, x2 = f.x + d * (8 + biteReach(sc)), l = Math.min(x1, x2), r = Math.max(x1, x2), top = f.y - biteTop(sc), bot = f.y + 14;
    let got = 0;
    for (const v of m.foes(f)) {
      const hw = v.w * v.scale / 2;
      if (v.x + hw < l || v.x - hw > r || v.y < top || v.y - v.h * v.scale > bot) continue;
      v.intangible = false;
      if (m.blast(f, v, { dmg: 14 + sc * 7, ang: 40, bk: 38 + sc * 4, kg: 50 + sc * 10, dir: d, x: f.x, force: true, sfx: 'crunch', fx: 'slash' })) got++;
    }
    m.sfx('crunch'); m.sfx('roar', { vol: 0.6 }); m.shake(6 + sc * 3);
    m.fx.burst(f.x + d * (30 + sc * 8), f.y - 30, 40 + sc * 10, '#ffffff');
    m.fx.word(f.x + d * 40, f.y - 96 - sc * 8, got ? 'CHOMP!' : 'MISSED!', { color: got ? '#ffe23a' : '#ffffff', size: 26 + sc * 4, life: 46 });
    this.end(m);
  }

  // the sheet of paper, in screen space
  drawScreen(ctx, m) {
    const f = this.f, ph = this.phase, n = this.word.length;
    const drop = ph === 'in' ? ease.back(clamp(this.pt / QIN, 0, 1)) : ph === 'bite' ? 1 - ease.in(clamp(this.pt / 12, 0, 1)) : 1;
    const pw = 540, phh = 268, px = (W - pw) / 2 + (this.shake ? (this.shake % 2 ? 5 : -5) : 0), py = -phh + (phh + 34) * drop;
    ctx.save();
    ctx.fillStyle = `rgba(24,28,70,${0.3 * clamp(drop, 0, 1)})`; ctx.fillRect(0, 0, W, H);
    // notebook paper: blue rules, red margin, punched holes
    rr(ctx, px + 5, py + 7, pw, phh, 10); ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fill();
    rr(ctx, px, py, pw, phh, 10); fs(ctx, '#fffdf2', OUT, 3.5);
    ctx.save(); rr(ctx, px + 2, py + 2, pw - 4, phh - 4, 8); ctx.clip();
    ctx.strokeStyle = '#a9cdf2'; ctx.lineWidth = 1.6; ctx.beginPath();
    for (let y = py + 54; y < py + phh; y += 26) { ctx.moveTo(px, y); ctx.lineTo(px + pw, y); }
    ctx.stroke();
    ctx.strokeStyle = '#f08a8a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(px + 58, py); ctx.lineTo(px + 58, py + phh); ctx.stroke();
    ctx.restore();
    for (const hy of [44, 134, 224]) circle(ctx, px + 28, py + hy, 8, '#3a4a6a', OUT, 2.5);
    txt(ctx, 'FILL IN THE BLANK', px + 76, py + 28, { font: 'chewy', size: 24, fill: f.color || '#2f7fe0', lw: 5, align: 'left' });
    for (let i = 0; i < 3; i++) {      // three boxes for the marks, like the corner of a test
      const bx = px + pw - 110 + i * 32, by = py + 14;
      rrect(ctx, bx, by, 26, 26, 5, '#ffffff', OUT, 2.2);
      if (i < this.res.length) txt(ctx, this.res[i] ? 'O' : 'X', bx + 13, by + 14, { font: 'titan', size: 20, fill: this.res[i] ? '#35a84a' : '#e8402a', lw: 0, stroke: null });
    }
    // the word
    const cw = Math.min(52, 400 / n), x0 = px + 58 + (pw - 58 - cw * n) / 2, wy = py + 96;
    for (let i = 0; i < n; i++) {
      const cx = x0 + cw * i + cw / 2, b = this.blanks.indexOf(i);
      if (b < 0) { txt(ctx, this.word[i], cx, wy, { font: 'hand', size: 52, fill: '#22305a', lw: 0, stroke: null }); continue; }
      const done = b < this.res.length, now = b === this.cur && ph === 'ask';
      if (now) { rr(ctx, cx - cw / 2 + 3, wy - 34, cw - 6, 62, 6); ctx.fillStyle = m.real % 20 < 10 ? '#fff27a' : '#ffe23a'; ctx.fill(); }
      line(ctx, cx - cw / 2 + 6, wy + 25, cx + cw / 2 - 6, wy + 25, '#22305a', 4);
      if (done) txt(ctx, this.word[i], cx, wy, { font: 'hand', size: 52, fill: this.res[b] ? '#35a84a' : '#e8402a', lw: 0, stroke: null });
      else txt(ctx, '?', cx, wy, { font: 'hand', size: 40, fill: now ? '#22305a' : '#b9c2d6', lw: 0, stroke: null });
    }
    if (ph === 'out' || ph === 'bite') {       // the grade, stamped in red
      const s = ease.back(clamp(this.pt / 9, 0, 1)) * (ph === 'out' ? 1 : 1);
      txt(ctx, GRADES[this.score], px + 58 + (pw - 58) / 2, py + 190, { font: 'bangers', size: 64 * s, fill: '#e8402a', lw: 0, stroke: null, rot: -0.12 });
      txt(ctx, this.score + ' / 3', px + pw - 70, py + 236, { font: 'hand', size: 30, fill: '#e8402a', lw: 0, stroke: null, rot: -0.08 });
    } else if (this.cur < 3 && ph !== 'in') {  // the four letters on offer, laid out like the stick
      const o = this.opts[this.cur], kx = px + 58 + (pw - 58) / 2, ky = py + 192, D = [[0, -38], [62, 0], [0, 38], [-62, 0]];
      const picked = ph === 'mark' ? this.picked[this.cur] : -9;
      for (let k = 0; k < 4; k++) {
        const x = kx + D[k][0], y = ky + D[k][1], hot = picked === k, good = ph === 'mark' && k === o.right;
        const col = good ? '#8be85c' : hot ? '#ff9a8a' : '#fff7e0';
        rrect(ctx, x - 24, y - 18 + 4, 48, 36, 9, OUT, null, 0);
        rrect(ctx, x - 24, y - 18 + (hot ? 3 : 0), 48, 36, 9, col, OUT, 3);
        txt(ctx, o.letters[k], x, y + 1 + (hot ? 3 : 0), { font: 'titan', size: 26, fill: '#22305a', lw: 0, stroke: null });
        const ax = x + D[k][0] * 0.58, ay = y + D[k][1] * 0.74, ux = Math.sign(D[k][0]), uy = Math.sign(D[k][1]);   // little arrow outside each key
        polygon(ctx, [ax + ux * 7, ay + uy * 7, ax - uy * 6 - ux * 2, ay - ux * 6 - uy * 2, ax + uy * 6 - ux * 2, ay + ux * 6 - uy * 2], f.color || '#2f7fe0', OUT, 2);
      }
      if (ph === 'ask') {                      // time left: a pencil getting shorter
        const u = clamp(1 - this.pt / QASK, 0, 1), bw = 150 * u, bx = px + pw - 190, by = py + phh - 26;
        rrect(ctx, bx, by, 150, 12, 6, '#e6e0cf', OUT, 2);
        if (bw > 6) rrect(ctx, bx, by, bw, 12, 6, u < 0.35 ? '#e8402a' : '#ffd23a', OUT, 2);
      }
    }
    ctx.restore();
  }
}

// ---- the moveset --------------------------------------------------------------
const spin = (turns, to) => K([0, { rot: 0, jaw: 0.5 }], [to, { rot: TAU * turns, jaw: 0.5 }, 'lin'], [999, { rot: TAU * turns }]);
const UP = -Math.PI / 2;

function dropPrey(f) {
  const t = f.v.prey; f.v.prey = null;
  if (t && !t.out && t.state === 'trapped') { t.intangible = false; t.setState('air'); t.vy = -3; }
}

const moves = {
  jab: {        // two quick nips
    frames: 16, sfx: { 3: 'snip' },
    pose: K([0, {}], [2, { jaw: 0.7, ox: -2 }], [4, { jaw: 0, ox: 7, sx: 1.08 }, 'in'], [8, { jaw: 0, ox: 4 }], [16, {}]),
    hits: [hit([3, 5], 'mouth', 11, 3, 75, 10, 25, { sfx: 'snip' })],
    cancel: [{ to: 'jab2', f: [6, 14], on: 'attack' }],
  },
  jab2: {
    frames: 22, sfx: { 3: 'snip' },
    pose: K([0, { jaw: 0, ox: 4 }], [3, { jaw: 0.9, ox: 1 }], [5, { jaw: 0, ox: 10, sx: 1.12 }, 'in'], [10, { jaw: 0, ox: 7 }], [22, {}]),
    hits: [hit([4, 6], 'mouth', 12, 4, 50, 28, 70, { sfx: 'crunch' })],
  },
  ftilt: {      // lunging snap
    frames: 30, sfx: { 6: 'swishM' }, vel: [[6, 4.2, null]],
    pose: K([0, {}], [5, { jaw: 1, ox: -6, sx: 0.9, rot: -0.16 }], [9, { jaw: 0, ox: 12, sx: 1.16, sy: 0.94, rot: 0.1 }, 'in'], [15, { jaw: 0, ox: 8 }], [30, {}]),
    hits: [hit([8, 11], 'mouth', 14, 9, 361, 22, 92, { sfx: 'crunch' })],
  },
  utilt: {
    frames: 28, sfx: { 5: 'swishM' },
    pose: K([0, {}], [4, { jaw: 0.9, sy: 0.82, sx: 1.14 }], [8, { jaw: 0, rot: -1.15, oy: -8, sy: 1.1 }, 'in'], [13, { jaw: 0, rot: -1.0, oy: -4 }], [28, {}]),
    hits: [hit([6, 10], 'mouth', 14, 7, 88, 30, 100, { sfx: 'crunch' })],
  },
  dtilt: {
    frames: 24, sfx: { 4: 'swishS' },
    pose: K([0, { sy: 0.9 }], [3, { jaw: 0.6, rot: 0.2, ox: -2 }], [6, { jaw: 0, rot: 0.3, ox: 9, sx: 1.1 }, 'in'], [11, { jaw: 0, rot: 0.25, ox: 7 }], [24, {}]),
    hits: [hit([5, 8], 'mouth', 12, 6, 70, 24, 70, { sfx: 'snip' })],
  },
  dash: {
    frames: 38, fric: 0.3, vel: [[0, 6.4, null]], sfx: { 3: 'swishM' },
    pose: K([0, { jaw: 0.9, rot: -0.1 }], [5, { jaw: 0, ox: 8, sx: 1.14, rot: 0.12 }, 'in'], [9, { jaw: 0.7, ox: 6 }], [13, { jaw: 0, ox: 8, rot: 0.1 }, 'in'], [18, { jaw: 0.3, ox: 4 }], [38, {}]),
    hits: [hit([5, 10], 'mouth', 15, 10, 55, 56, 62, { sfx: 'crunch' }), hit([11, 17], 'mouth', 13, 7, 60, 40, 50, { sfx: 'snip' })],
  },
  fsmash: {     // the big clamp: rears right back first
    frames: 54, charge: { at: 10, max: 60 }, vel: [[16, 5.4, null]], fric: 0.5, sfx: { 15: 'swishL' },
    pose: K([0, {}], [9, { jaw: 1.3, ox: -10, rot: -0.42, sx: 0.86, sy: 1.1 }], [10, { jaw: 1.3, ox: -10, rot: -0.42, sx: 0.86, sy: 1.1 }],
      [18, { jaw: 0, ox: 14, rot: 0.16, sx: 1.24, sy: 0.9 }, 'in3'], [27, { jaw: 0, ox: 10, rot: 0.1 }], [54, {}]),
    hits: [hit([17, 21], 'mouth', 17, 18, 40, 34, 102, { to: 'far', sfx: 'crunch' })],
    events: { 18: (f, m) => { m.fx.dust(f.x + f.facing * 30, f.y, 3); } },
  },
  usmash: {     // snaps straight up
    frames: 48, charge: { at: 7, max: 60 }, sfx: { 10: 'swishL' },
    pose: K([0, {}], [6, { jaw: 0.4, sy: 0.6, sx: 1.34 }], [7, { jaw: 0.4, sy: 0.6, sx: 1.34 }], [10, { jaw: 1.2, rot: UP, oy: -8, sy: 1.1 }],
      [13, { jaw: 0, rot: UP, oy: -22, sy: 1.2, sx: 0.9 }, 'in3'], [20, { jaw: 0, rot: UP, oy: -10 }], [48, {}]),
    hits: [hit([12, 16], 'mouth', 16, 14, 90, 34, 104, { sfx: 'crunch' })],
  },
  dsmash: {     // a low chomp in front, a turn on the spot, a low chomp behind
    frames: 50, charge: { at: 6, max: 60 }, sfx: { 8: 'swishM', 15: 'swishM' },
    pose: K([0, {}], [5, { jaw: 0.9, sy: 0.84, rot: 0.14 }], [6, { jaw: 0.9, sy: 0.84, rot: 0.14 }], [9, { jaw: 0, ox: 8, sy: 0.84, rot: 0.24 }, 'in'],
      [13, { jaw: 0.9, sx: 0.15, sy: 0.9 }], [16, { jaw: 0, sx: -1, ox: -8, sy: 0.84, rot: 0.24 }, 'in'], [22, { jaw: 0, sx: -1, ox: -6, sy: 0.9 }], [30, { sx: 0.15 }], [38, {}], [50, {}]),
    hits: [hit([9, 12], 'mouth', 14, 13, 30, 36, 86, { sfx: 'crunch' }), hit([16, 19], 'mouth', 14, 12, 30, 36, 86, { rev: true, group: 1, sfx: 'crunch' })],
  },
  nair: air({
    frames: 40, sfx: { 3: 'swishM' }, pose: spin(2, 26),
    hits: [hit([4, 12], 'body', 21, 9, 361, 20, 85, { sfx: 'crunch' }), hit([13, 24], 'body', 19, 5, 361, 14, 70, { group: 1 })],
  }, 9, [3, 28]),
  fair: air({
    frames: 38, sfx: { 7: 'swishM' },
    pose: K([0, {}], [6, { jaw: 1.1, ox: -5, rot: -0.3 }], [10, { jaw: 0, ox: 11, sx: 1.18, rot: 0.2 }, 'in'], [16, { jaw: 0, ox: 6 }], [38, {}]),
    hits: [hit([9, 13], 'mouth', 15, 11, 361, 24, 92, { sfx: 'crunch' })],
  }, 12, [6, 26]),
  bair: air({
    frames: 36, sfx: { 6: 'swishM' },
    pose: K([0, {}], [4, { jaw: 0.6, sx: 0.15 }], [7, { jaw: 1, sx: -1, ox: 3 }], [9, { jaw: 0, sx: -1.14, ox: -9 }, 'in'], [15, { jaw: 0, sx: -1, ox: -5 }], [24, { sx: 0.15 }], [30, {}], [36, {}]),
    hits: [hit([8, 12], 'mouth', 15, 10, 361, 26, 95, { rev: true, sfx: 'crunch' })],
  }, 11, [5, 26]),
  uair: air({
    frames: 32, sfx: { 4: 'swishS' },
    pose: K([0, {}], [4, { jaw: 1, rot: -0.9 }], [7, { jaw: 0, rot: UP, oy: -8, sy: 1.14 }, 'in'], [12, { jaw: 0, rot: UP, oy: -4 }], [32, {}]),
    hits: [hit([6, 10], 'mouth', 14, 9, 85, 26, 96, { sfx: 'crunch' })],
  }, 9, [4, 22]),
  dair: air({   // jaws-first plunge
    frames: 50, drift: 0.3, fallCap: 12.5, vel: [[4, 0, -2.5], [14, 0, 12.5]], sfx: { 13: 'swishL' },
    pose: K([0, {}], [12, { jaw: 1.1, rot: -UP * 0.8 }, 'out'], [15, { jaw: 0.9, rot: -UP, sy: 1.16, sx: 0.9 }], [50, { jaw: 0.9, rot: -UP, sy: 1.16, sx: 0.9 }]),
    hits: [hit([14, 20], 'mouth', 15, 12, 270, 20, 84, { sfx: 'crunch' }), hit([21, 48], 'mouth', 15, 9, 60, 30, 70, { group: 1, sfx: 'crunch' })],
    onLand: (f, m) => { m.fx.dust(f.x, f.y, 6); m.shake(4); m.sfx('thud'); },
  }, 20, [10, 50]),

  // --- specials ---
  nspecial: {   // spits a staple
    kind: 'special', frames: 36, drift: 0.6, sfx: { 9: 'spit' },
    can: (f, m) => countMine(f, m, 'staple') < 2,
    pose: K([0, {}], [7, { jaw: 0.1, sx: 0.88, ox: -4, rot: -0.1 }], [10, { jaw: 0.9, sx: 1.14, ox: 5 }, 'in'], [17, { jaw: 0.5, ox: 2 }], [36, {}]),
    events: { 10: (f, m) => {
      shoot(f, m, { tag: 'staple', x: 26, y: 13, vx: 11.5, vy: 0, r: 7, life: 32, drawFn: stapleArt,
        hit: { dmg: 5, ang: 361, bk: 14, kg: 34, sfx: 'tink' }, onDie: (p, m2) => { m2.fx.spark(p.x, p.y, 4, '#ffffff'); } });
    } },
  },
  sspecial: {   // pounce: leaps in an arc; whoever the jaws close on gets chewed
    kind: 'special', frames: 52, airOK: true, slideOff: true, drift: 0.2, vel: [[8, 6.8, -6.2]], sfx: { 7: 'growl' },
    start: (f) => { f.v.caught = null; },
    tick: (f, m) => {
      const t = f.v.caught;
      if (!t) return;
      f.v.caught = null;
      if (!t.out && t.state !== 'dead' && t.state !== 'respawn' && t.state !== 'trapped') { f.v.prey = t; f.startMove('chew', true); }
    },
    pose: K([0, {}], [7, { sy: 0.72, sx: 1.22, jaw: 0.3 }], [11, { jaw: 1.15, rot: -0.4, sy: 1.1 }, 'out'], [24, { jaw: 1.15, rot: 0.25 }], [30, { jaw: 0, rot: 0.3 }, 'in'], [40, { jaw: 0, sy: 0.9 }], [52, {}]),
    hits: [hit([12, 30], 'mouth', 15, 3, 80, 0, 0, { set: 1, unblockable: true, sfx: 'crunch',
      onHit: (o, t) => { if (o && !o.v.caught && !t.def.noGrab) o.v.caught = t; } })],
  },
  chew: {       // only reached from a pounce that caught someone: three chews, then spits them out
    kind: 'special', frames: 58, airOK: true, noPush: true, drift: 0,
    start: (f) => { const t = f.v.prey; if (t) { t.interrupt(); t.setState('trapped'); t.v.trapMax = 90; } f.vx *= 0.3; },
    exit: (f) => { dropPrey(f); },
    tick: (f, m, fr) => {
      const t = f.v.prey;
      if (!t || t.out || t.state !== 'trapped') { f.v.prey = null; if (fr < 46) f.mf = 46; return; }
      t.x = f.x + f.facing * 27; t.y = f.y - 11 + t.h * t.scale * 0.5; t.vx = t.vy = t.kx = t.ky = 0; t.intangible = true; t.facing = -f.facing;
      if (fr === 10 || fr === 22 || fr === 34) {
        t.pct = Math.min(999, t.pct + 2); t.stats.taken += 2; f.stats.dealt += 2; t.flash = 5; t.flashColor = '#ffffff';
        t.lastHitBy = f.slot; t.lastHitFrame = m.frame;
        m.sfx('crunch', { vol: 0.8 }); m.fx.hit(t.x, t.y - t.h * 0.5, 'slash', 0.4); m.shake(2);
      }
      if (fr === 44) { f.v.prey = null; t.intangible = false; m.blast(f, t, { dmg: 5, ang: 38, bk: 62, kg: 62, dir: f.facing, x: f.x, force: true, sfx: 'spit' }); }
    },
    pose: K([0, { jaw: 0.55 }], [10, { jaw: 0.2, sx: 1.06 }, 'in'], [16, { jaw: 0.6 }], [22, { jaw: 0.2, sx: 1.06 }, 'in'], [28, { jaw: 0.6 }], [34, { jaw: 0.2, sx: 1.06 }, 'in'],
      [41, { jaw: 0.25, ox: -7, sx: 0.88 }], [44, { jaw: 1.1, ox: 8, sx: 1.16 }, 'in'], [50, { jaw: 0.4, ox: 3 }], [58, {}]),
  },
  uspecial: {   // Doodle pumps the balloon up and they drift a long way; Special again pops it
    kind: 'special', frames: 98, helpless: true, drift: 0.9, airOK: true, slideOff: true, ledgeOK: 20,
    start: (f) => { f.v.noBalloon = false; },
    tick: (f, m, fr) => {
      if (fr === 6) { f.grounded = false; f.ground = null; f.vy = -2; m.sfx('squeak'); }
      if (fr > 6 && fr < 78) {
        f.vy = approach(f.vy, -3.5, 0.4);
        if (fr % 13 === 0) m.sfx('squeak', { vol: 0.4, rate: 1 + fr / 110 });
        if (fr > 16 && f.inp.p.special) { popBalloon(f, m, true); f.mf = 79; }
      } else if (fr === 78) popBalloon(f, m, false);       // it goes on its own if they hang on too long
    },
    pose: K([0, {}], [5, { sy: 0.84, sx: 1.12, pump: 0.3 }], [10, { sy: 1.06, sx: 0.95, pump: 0.6, tug: 1, jaw: 0.3 }], [78, { pump: 1.25, tug: 1, jaw: 0.3, sy: 1.04 }], [80, { jaw: 0.8, face: 6 }], [98, { jaw: 0.7, face: 6 }]),
  },
  dspecial: {   // paper shredder: chews up the floor and sprays the bits forward
    kind: 'special', frames: 52, sfx: { 8: 'paper', 18: 'rip', 28: 'paper', 36: 'rip' },
    tick: (f, m, fr) => { if (fr >= 9 && fr < 36 && fr % 3 === 0) { m.fx.confetti(f.x + f.facing * 24, f.y - 6, 2); if (f.grounded) m.fx.dust(f.x + f.facing * 18, f.y, 1); } },
    pose: (f, fr) => fr >= 8 && fr < 36 ? { jaw: 0.15 + Math.abs(Math.sin(fr * 0.9)) * 0.6, rot: 0.3, ox: 4 + Math.sin(fr * 1.8) * 1.5, sy: 0.92 }
      : K([0, {}], [8, { jaw: 0.6, rot: 0.3, ox: 4, sy: 0.92 }], [36, { jaw: 0.6, rot: 0.3, ox: 4, sy: 0.92 }], [39, { jaw: 0, rot: 0.1, ox: 10, sx: 1.14 }, 'in'], [44, { jaw: 0, ox: 6 }], [52, {}]),
    hits: [box([10, 34], [34, 13], 50, 28, 1.5, 20, 0, 0, { set: 12, rehit: 6, hl: 0.4, sfx: 'paper', fx: 'slash' }),
      hit([38, 41], 'mouth', 17, 4, 55, 52, 60, { group: 1, sfx: 'rip', off: [6, 0] })],
  },

  // --- grab: Chomps IS the grab ---
  grab: {
    kind: 'grab', frames: 32, sfx: { 5: 'swishS' },
    pose: K([0, {}], [5, { jaw: 1, ox: -2 }], [8, { jaw: 0.35, ox: 10, sx: 1.12 }, 'in'], [13, { jaw: 0.35, ox: 8 }], [32, {}]),
    hits: [{ f: [7, 10], at: 'mouth', off: [5, 0], r: 13, dmg: 0, grab: true }],
  },
  ...stdThrows({
    f: { dmg: 8, bk: 60, kg: 66, f: 12, frames: 30, sfx: 'spit', pose: K([0, { jaw: 0.42 }], [8, { jaw: 0.3, ox: -6, sx: 0.88 }], [12, { jaw: 1, ox: 8, sx: 1.15 }, 'in'], [30, {}]) },
    b: { dmg: 9, bk: 62, kg: 82, f: 16, frames: 36, pose: K([0, { jaw: 0.42 }], [16, { jaw: 0.42, rot: -TAU }, 'in'], [20, { jaw: 1, rot: -TAU }], [36, { rot: -TAU }]) },
    u: { dmg: 8, bk: 66, kg: 70, f: 12, frames: 32, pose: K([0, { jaw: 0.42 }], [7, { jaw: 0.42, sy: 0.74, sx: 1.2 }], [12, { jaw: 1, rot: -1.2, oy: -12, sy: 1.14 }, 'in'], [32, {}]) },
    d: { dmg: 7, bk: 50, kg: 42, f: 15, frames: 34, sfx: 'thud', pose: K([0, { jaw: 0.42 }], [9, { jaw: 0.42, oy: -16, rot: 0.3 }], [15, { jaw: 0.1, rot: 0.45, sy: 0.8, sx: 1.2 }, 'in'], [34, {}]) },
  }),
  getup: {
    frames: 34, invuln: [[0, 12]], sfx: { 8: 'swishM', 14: 'swishM' },
    pose: K([0, { sy: 0.7, sx: 1.2 }], [7, { jaw: 0.9 }], [9, { jaw: 0, ox: 7 }, 'in'], [12, { jaw: 0.9, sx: 0.15 }], [15, { jaw: 0, sx: -1, ox: -7 }, 'in'], [20, { jaw: 0, sx: -1 }], [26, { sx: 0.15 }], [30, {}], [34, {}]),
    hits: [hit([9, 12], 'mouth', 13, 6, 50, 40, 50, { sfx: 'snip' }), hit([15, 18], 'mouth', 13, 6, 50, 40, 50, { rev: true, group: 1, sfx: 'snip' })],
  },
  taunt: {      // chatters his teeth while Doodle waves
    kind: 'taunt', frames: 60, iasa: 52, sfx: { 4: 'click', 13: 'click', 22: 'click', 31: 'click' },
    pose: (f, fr) => ({ jaw: Math.abs(Math.sin(fr * 0.35)) * 0.6, oy: -Math.abs(Math.sin(fr * 0.35)) * 3, face: 3 }),
  },

  // --- the super: FILL IN THE BLANK ---
  super: {
    kind: 'super', frames: 78, airOK: true, noPush: true,
    start: (f) => { f.v.quiz = null; f.v.quizScore = 0; },
    exit: (f, m) => { f.superActive = false; const q = f.v.quiz; f.v.quiz = null; if (q) q.end(m); },
    events: { 8: (f, m) => { f.v.quiz = m.spawn(new Quiz(m, f)); } },
    tick: (f, m, fr) => {
      f.vx = 0;
      if (!f.grounded && fr <= QSNAP) f.vy = -f.st.gravity * f.gravMul;        // hangs where it is while the paper is up
      const q = f.v.quiz;
      if (fr === QHOLD && q && !q.dead && q.phase !== 'bite') f.mf = QHOLD - 1;  // wait here until the last blank is answered
    },
    pose: (f) => {
      const big = 1.75 + (f.v.quizScore || 0) * 0.25;
      return K([0, {}], [8, { jaw: 0.3, sy: 0.9, face: 3 }], [QHOLD, { jaw: 0.25, face: 3 }], [QBITE, { jaw: 0.3 }],
        [QSNAP - 5, { jaw: 1.3, sx: big, sy: big, rot: -0.3, ox: -8 }, 'out'], [QSNAP - 1, { jaw: 1.3, sx: big, sy: big, rot: -0.34, ox: -10 }],
        [QSNAP, { jaw: 0, sx: big * 1.06, sy: big * 0.94, rot: 0.08, ox: 12 }], [QSNAP + 12, { jaw: 0, sx: big, sy: big, ox: 8 }], [78, {}]);
    },
  },
};

export default {
  id: 'doodle', name: 'DOODLE & CHOMPS', from: 'Margin of Error', superName: 'Fill In The Blank',
  blurb: 'A margin doodle and the staple remover he rides. Chomps does the biting. Doodle holds the balloon and takes the credit.',
  stats: { weight: 104, walk: 2.0, dash: 5.2, run: 4.6, jump: 9.8, hop: 6.2, djump: 8.4, djumpDecay: 0.9, airJumps: 3, gravity: 0.3, fall: 6.4, airSpeed: 3.3, w: 36, h: 52 },
  portrait: { x: 4, y: -40, s: 0.98 },
  costumes: costumes(BASE, [
    ['Blue Pen', {}],
    ['Red Pen', { main: '#d4334a', ink: '#d4334a', shell: '#2fa89a', balloon: '#3d8fe0' }],
    ['Pencil', { main: '#ffd23a', ink: '#6b6f7a', shell: '#ffd23a', pad: '#ff9ab0', balloon: '#ff8a3a', paper: '#f4f1e6' }],
    ['Highlighter', { main: '#ff4fa8', ink: '#ff4fa8', shell: '#e6f03a', pad: '#ff4fa8', balloon: '#7ef05a', gum: '#7a2a5a' }],
  ]),
  pose, points, draw, moves,
  hooks: {
    init(f) { const v = f.v; v.tug = 0; v.floatT = 0; v.floating = false; v.noBalloon = false; v.prey = null; v.caught = null; v.quiz = null; v.quizScore = 0; },
    onAirJump(f) { f.v.tug = 12; f.v.noBalloon = false; },
    postUpdate(f, m) {
      const v = f.v;
      if (v.tug > 0) v.tug--;
      if (f.grounded || f.state === 'ledge') { v.floatT = 0; if (v.noBalloon) { v.noBalloon = false; v.tug = 8; m.sfx('squeak', { vol: 0.4 }); } }
      // float: hold Jump while falling and the balloon takes the weight for a while
      v.floating = !f.grounded && f.state === 'air' && f.inp.h.jump && f.vy > 1.6 && v.floatT < 90 && !f.fastFalling && !v.noBalloon;
      if (v.floating) { f.vy = 1.6; v.floatT++; }
    },
    // while the quiz is up, show where the bite will land
    drawFront(ctx, f) {
      const q = f.v.quiz;
      if (!q || q.dead || f.moveId !== 'super') return;
      const sc = q.phase === 'bite' ? q.score : 0, d = f.facing, x1 = f.x + d * 8, x2 = f.x + d * (8 + biteReach(sc)), top = f.y - biteTop(sc);
      ctx.save(); ctx.globalAlpha = 0.5 + Math.sin(q.t * 0.25) * 0.2;
      ctx.setLineDash([9, 7]); ctx.strokeStyle = f.color || '#ffffff'; ctx.lineWidth = 3.4;
      ctx.strokeRect(Math.min(x1, x2), top, Math.abs(x2 - x1), f.y + 6 - top);
      ctx.setLineDash([]); ctx.restore();
    },
    ai(f, m, cpu) {      // out of jumps over the pit: hang on the balloon
      if (!f.grounded && f.state === 'air' && f.jumps <= 0 && f.vy > 1 && cpu.needsRecovery(f, m)) cpu.snap.h.jump = true;
    },
  },
  ai: {
    nspecial: { range: [120, 330], dy: 26, w: 0.7 },
    sspecial: { range: [70, 150], dy: 44, w: 0.8 },
    super: { range: 118, dy: 60 },
    recovery: { up: 235 },
  },
};
