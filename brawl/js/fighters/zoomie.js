// ZOOMIE - slot 3 of the roster.
// Brief: a small round fighter with puffy, quick moves; NO extra air jump,
// but the fastest runner in the game; alternate looks as costumes.
// Super: flips the whole stage upside down so everyone else falls into the sky.
//
// He is the class hamster. Like Globert he is one squashy body rather than a
// puppet, so this file supplies its own pose / points / draw.

import { customPose } from '../game/rig.js';
import { K, hit, air, stdThrows, costumes, shoot, countMine } from '../game/movekit.js';
import { Entity, Projectile } from '../game/entities.js';
import { groundBelow, ledgesOf } from '../game/physics.js';
import { W } from '../core/config.js';
import { OUT, LW, circle, ellipse, blobPath, limb, eyes, mouth, rrect, rr, gloss, darken, fs } from '../core/gfx.js';
import { TAU, clamp, approach, lerp, ease } from '../core/util.js';

const CY = 21;                       // body centre, above the feet
const BASE = {
  main: '#f2a93b', fur: '#f2a93b', belly: '#fff1d2', ear: '#dc8c2c', earIn: '#f79aa8', paw: '#f79aa8',
  band: 0, patch: 0, hat: 0, helmet: '#e8402a', stripe: '#ffffff',
};

// pose: squash (sx, sy), spin (rot), slide (ox, oy), face, cheek puff (0 = his
// normal huge, 1+ = ridiculous), hand / foot offsets from where they rest,
// curl (0..1 tucked into a ball of fur), and the two props he climbs into.
const STANCE = { sx: 1, sy: 1, rot: 0, ox: 0, oy: 0, face: 0, cheek: 0, hF: [0, 0], hB: [0, 0], fF: [0, 0], fB: [0, 0], curl: 0, ball: 0, wheel: 0, _auto: { lean: 0.12 } };

const steps = (ph, a, l) => ({ fF: [Math.sin(ph) * a, -Math.max(0, Math.cos(ph)) * l], fB: [-Math.sin(ph) * a, -Math.max(0, -Math.cos(ph)) * l] });

function pose(f) {
  return customPose(f, STANCE, (ff, p) => {
    const t = ff.t || 0, w = Math.sin(t * 0.7) * 3;
    switch (ff.state) {
      case 'walk': Object.assign(p, steps(ff.cycle / 6, 4, 2.5)); break;
      case 'run': case 'dash': {
        const ph = ff.cycle / 8;
        Object.assign(p, steps(ph, 8, 4.5));
        p.oy = -Math.abs(Math.sin(ph)) * 2; p.hF = [Math.sin(ph) * -3, -1]; p.hB = [Math.sin(ph) * 3, -1]; p.rot = 0.2;
        break;
      }
      case 'brake': case 'turn': p.fF = [5, 0]; p.hF = [4, -4]; p.hB = [3, -4]; break;
      case 'air':
        if (ff.vy < 0) { p.hF = [3, -9]; p.hB = [-2, -9]; p.fF = [1, -2]; p.fB = [-2, -3]; }
        else { p.hF = [5, -11]; p.hB = [-5, -11]; p.fF = [4, 2]; p.fB = [-4, 2]; }
        break;
      case 'helpless': p.hF = [5, -8 + w * 1.4]; p.hB = [-5, -8 - w * 1.4]; p.fF = [3, 2]; p.fB = [-3, 2]; break;
      case 'hitstun': case 'tumble': case 'trapped': case 'grabbed':
        p.hF = [5, -8 + w]; p.hB = [-6, -8 - w]; p.fF = [5, -3 - w * 0.5]; p.fB = [-5, -2 + w * 0.5]; p.cheek = 0.25; break;
      case 'shield': case 'shieldstun': p.hF = [5, -4]; p.hB = [7, -4]; p.cheek = 0.3; break;
      case 'grabhold': p.hF = [9, -4]; p.hB = [12, -4]; break;
      case 'ledge': case 'ledgeclimb': p.hF = [9, -30]; p.hB = [16, -30]; p.fF = [-2, 1]; p.fB = [-2, 2]; break;
      case 'win': p.hF = [4, -14]; p.hB = [-4, -14]; p.cheek = 0.5; break;
      case 'lose': p.hF = [-1, -19]; p.hB = [3, -19]; break;
      case 'stun': p.hF = [3, 2]; p.hB = [-3, 2]; break;
      case 'idle': p.cheek = 0.07 + Math.sin(t * 0.3) * 0.07; break;   // always chewing something
    }
  });
}

function points(f, p) {
  const c = Math.cos(p.rot), s = Math.sin(p.rot), ck = Math.max(0, p.cheek), un = 1 - clamp(p.curl, 0, 1);
  const P = (x, y) => [p.ox + (x * c - y * s) * p.sx, p.oy + (x * s + y * c - CY) * p.sy];
  return {
    body: P(0, 0), top: P(1, -18), bottom: P(0, 14), tail: P(-14, 8),
    cheekF: P(12 + ck * 4 + (8 + ck * 6) * 0.3, -2), cheekB: P(-9 - ck * 3 - (7 + ck * 5) * 0.3, -2),
    footF: P(8 + p.fF[0] * un, 19 + p.fF[1] * un), footB: P(-4 + p.fB[0] * un, 19 + p.fB[1] * un),
    feet: P(1 + (p.fF[0] + p.fB[0]) * 0.5 * un, 20 + Math.max(p.fF[1], p.fB[1]) * un),
    grab: [30, 0],
  };
}

// ---- drawing ---------------------------------------------------------------
const BODY = [0, -23, 10, -20, 15.5, -9, 16, 6, 10.5, 17.5, 0, 19.5, -10.5, 17.5, -16, 6, -15, -9, -9.5, -20];
const CURL = BODY.map((v, i) => {       // the same outline pulled into a ball
  const x = BODY[i & ~1], y = BODY[i | 1] + 1, a = Math.atan2(y, x);
  return i % 2 ? Math.sin(a) * 18 - 1 : Math.cos(a) * 18;
});

// a foot or a hand: a pink paw that rides out on a stretchy limb when it strikes
function paw(ctx, pal, bx, by, o, un, hx, hy, hand) {
  const x = bx + o[0] * un, y = by + o[1] * un;
  if (Math.hypot(o[0], o[1]) * un > 6) limb(ctx, [hx, hy, x, y], hand ? 3.2 : 3.8, hand ? pal.fur : pal.paw, OUT, 1.8);
  if (hand) circle(ctx, x, y, 3, pal.paw, OUT, 1.8); else ellipse(ctx, x + 1, y, 5.4, 3, pal.paw, OUT, 2);
}

function wheelArt(ctx, r, a) {          // rim, rungs and hub of a hamster wheel
  ctx.lineCap = 'round';
  ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.strokeStyle = OUT; ctx.lineWidth = r * 0.16 + LW * 2; ctx.stroke();
  ctx.strokeStyle = '#ffd23a'; ctx.lineWidth = r * 0.16; ctx.stroke();
  ctx.strokeStyle = OUT; ctx.lineWidth = Math.max(1.4, r * 0.07);
  ctx.beginPath();
  for (let i = 0; i < 12; i++) { const b = a + (i * TAU) / 12; ctx.moveTo(Math.cos(b) * r * 0.9, Math.sin(b) * r * 0.9); ctx.lineTo(Math.cos(b) * r * 1.07, Math.sin(b) * r * 1.07); }
  for (let i = 0; i < 3; i++) { const b = a + (i * TAU) / 3; ctx.moveTo(0, 0); ctx.lineTo(Math.cos(b) * r * 0.9, Math.sin(b) * r * 0.9); }
  ctx.stroke();
  circle(ctx, 0, 0, Math.max(2, r * 0.13), '#cfd6e0', OUT, Math.max(1.4, r * 0.07));
}

function drawWheel(ctx, k, t) {         // origin = his body centre; the rim rests on the floor
  ctx.save(); ctx.translate(0, CY - 31); ctx.scale(k, k);
  limb(ctx, [0, 0, -19, 31], 4, '#8d96a6', OUT, 2); limb(ctx, [0, 0, 19, 31], 4, '#8d96a6', OUT, 2);
  wheelArt(ctx, 29, t * 0.5);
  ctx.restore();
}

function draw(ctx, f, p) {
  const pal = f.drawPal || f.pal, ex = p.face, t = f.t || 0;
  const ck = Math.max(0, p.cheek), cu = clamp(p.curl, 0, 1), un = 1 - cu;
  const body = cu > 0.01 ? BODY.map((v, i) => lerp(v, CURL[i], cu)) : BODY;
  const cxF = 12 + ck * 4 - cu * 3, rF = (8 + ck * 6) * (1 - cu * 0.25), cxB = -9 - ck * 3 + cu * 3, rB = (7 + ck * 5) * (1 - cu * 0.25);
  const parts = [() => blobPath(ctx, body, 0.5), () => { ctx.beginPath(); ctx.arc(cxB, -2, rB, 0, TAU); }, () => { ctx.beginPath(); ctx.arc(cxF, -2, rF, 0, TAU); }];
  ctx.save();
  ctx.translate(p.ox, p.oy); ctx.scale(p.sx, p.sy); ctx.translate(0, -CY);
  if (p.wheel > 0.02) drawWheel(ctx, p.wheel, t);
  if (p.rot) ctx.rotate(p.rot);
  // behind the body: stub tail, far foot, ears
  circle(ctx, -16.5 + cu * 3, 11, 3.4, pal.belly, OUT, 2);
  if (cu < 0.7) paw(ctx, pal, -5, 19 - cu * 4, p.fB, un, -4, 15);
  if (!pal.hat) for (const x of [-8, 8]) { const y = -20.5 - (x > 0 ? 1 : 0) + cu * 7; circle(ctx, x, y, 5.6, pal.ear, OUT, LW); circle(ctx, x + 0.6, y + 0.8, 2.9, pal.earIn, null, 0); }
  // body and cheeks share one outline
  ctx.strokeStyle = OUT; ctx.lineWidth = LW * 2; ctx.lineJoin = 'round';
  for (const s of parts) { s(); ctx.stroke(); }
  ctx.fillStyle = pal.fur; for (const s of parts) { s(); ctx.fill(); }
  ctx.save(); parts[0](); ctx.clip();
  if (pal.band) ellipse(ctx, -10, 7, 12, 9.5, pal.band, null, 0, -0.4);
  ellipse(ctx, 4, 9, 11.5, 11, pal.belly, null, 0);
  ctx.restore();
  ctx.fillStyle = pal.belly;
  ctx.beginPath(); ctx.arc(cxB, -2, rB - 1.2, 0, TAU); ctx.fill();
  ctx.beginPath(); ctx.ellipse(2.5, -1.5, 9, 5.5, 0, 0, TAU); ctx.fill();
  ctx.beginPath(); ctx.arc(cxF, -2, rF - 1.2, 0, TAU); ctx.fill();
  gloss(ctx, -5.5, -16.5, 5, 2.4, 0.3);
  if (pal.hat) {                                   // the tiny skater helmet
    ctx.beginPath(); ctx.ellipse(1, -15, 14.5, 10.5, 0, Math.PI, TAU); ctx.closePath(); fs(ctx, pal.helmet, OUT, LW);
    ctx.beginPath(); ctx.ellipse(1, -15, 5, 10.5, 0, Math.PI, TAU); ctx.strokeStyle = pal.stripe; ctx.lineWidth = 2.4; ctx.stroke();
    rrect(ctx, 9, -17.5, 9.5, 4, 2, darken(pal.helmet, 0.25), OUT, 1.8);
    for (const x of [-7, -2, 3]) circle(ctx, x - 1, -19.5, 1, darken(pal.helmet, 0.4), null, 0);
  }
  // face
  const look = clamp((f.vx || 0) * 0.1, -0.3, 0.5), lines = ex === 2 || ex === 3 || ex === 5;
  if (pal.patch) { ellipse(ctx, -1.2, -11, 5, 5.9, pal.patch, null, 0, -0.3); ellipse(ctx, 9.8, -11, 5, 5.9, pal.patch, null, 0, 0.3); }
  eyes(ctx, 4.3, -11.5, 3.7, 5.3, ex, 0.3 + look, 0, { lw: 1.6, pr: 0.6, t, pupil: pal.patch && lines ? '#ffffff' : OUT });
  if (ex === 1) mouth(ctx, 4.9, -1.9, 6.4, 1, { lw: 1.3 });
  else if (ex === 2 || ex === 6) mouth(ctx, 4.9, -1.6, 6, 2, { lw: 1.5 });
  else if (ex === 4) mouth(ctx, 4.9, -2, 7, 4, { lw: 1.5 });
  else {
    if (ex === 3) mouth(ctx, 4.7, -3.4, 7.5, 3, { lw: 1.5 }); else mouth(ctx, 4.7, -2.6, 5, 0, { lw: 1.5 });
    rrect(ctx, 3.4, -3.9, 2.8, 2.9, 0.7, '#ffffff', OUT, 1.1);                 // buck teeth
  }
  ellipse(ctx, 4.7, -6.3, 2.1, 1.5, pal.paw, OUT, 1.3);
  if (cu < 0.6) { paw(ctx, pal, 1, 9, p.hB, un, 0, 8, true); paw(ctx, pal, 10, 9, p.hF, un, 9, 8, true); }
  if (cu < 0.7) paw(ctx, pal, 7, 19 - cu * 4, p.fF, un, 6, 15);
  if (p.ball > 0.02) {                             // the clear plastic ball, seam and vents turning as it rolls
    const r = 25 * p.ball, roll = ((f.v && f.v.roll) || 0) / 25;
    ctx.globalAlpha = 0.3; circle(ctx, 0, -1, r, '#bfeaff', null, 0); ctx.globalAlpha = 1;
    ctx.save(); ctx.translate(0, -1); ctx.rotate(roll - p.rot);
    ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.ellipse(0, 0, r * 0.3, r - 2, 0, 0, TAU); ctx.stroke();
    for (const a of [0.9, 2.2, 4.0, 5.4]) { ctx.beginPath(); ctx.arc(0, 0, r * 0.72, a, a + 0.45); ctx.stroke(); }
    ctx.restore();
    ctx.beginPath(); ctx.arc(0, -1, r, 0, TAU); ctx.strokeStyle = OUT; ctx.lineWidth = LW; ctx.stroke();
    gloss(ctx, -r * 0.42, -1 - r * 0.46, r * 0.3, r * 0.13, 0.75);
  }
  ctx.restore();
}

// ---- things he leaves behind -----------------------------------------------
function drawSeed(ctx, p) {
  ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(Math.atan2(p.vy, p.vx));
  ctx.beginPath(); ctx.moveTo(7, 0); ctx.quadraticCurveTo(0, -4.6, -6, 0); ctx.quadraticCurveTo(0, 4.6, 7, 0); ctx.closePath(); fs(ctx, '#3a3340', OUT, 1.6);
  ctx.strokeStyle = '#f4efe2'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(-3.5, -0.9); ctx.lineTo(4.5, -0.5); ctx.moveTo(-3.5, 1); ctx.lineTo(4.5, 0.6); ctx.stroke();
  ctx.restore();
}

// The plastic tube he fires himself out of. It stays where it popped up.
class Tube extends Entity {
  constructor(f) { super({ owner: f, tag: 'tube', layer: 'front', life: 44 }); this.x = f.x; this.y = f.y + 5; }
  update() { if (++this.t > this.life) this.dead = true; }
  draw(ctx) {
    const k = ease.back(clamp(this.t / 6, 0, 1)) * clamp((this.life - this.t) / 6, 0, 1), w = 46, h = 56;
    ctx.save(); ctx.translate(this.x, this.y); ctx.scale(0.6 + 0.4 * k, k);
    ctx.globalAlpha = 0.5; rrect(ctx, -w / 2 + 3, -h, w - 6, h, 3, '#ffbe3d', null, 0); ctx.globalAlpha = 1;
    ctx.fillStyle = 'rgba(255,255,255,0.55)'; ctx.fillRect(-w / 2 + 8, -h + 8, 4, h - 16);
    rr(ctx, -w / 2 + 3, -h, w - 6, h, 3); ctx.strokeStyle = OUT; ctx.lineWidth = LW; ctx.stroke();
    rrect(ctx, -w / 2, -h - 5, w, 10, 4, '#ff8a1e', OUT, LW); rrect(ctx, -w / 2, -6, w, 10, 4, '#ff8a1e', OUT, LW);
    ctx.restore();
  }
}

function shock(f, m) {                  // the thump when the plunge lands
  for (const d of [-1, 1]) {
    m.spawn(new Projectile(m, { owner: f, x: f.x + d * 14, y: f.y - 7, vx: d * 5.4, vy: 0, r: 11, life: 11, stage: 'pass', pierce: true, reflectable: false,
      hit: { dmg: 5, ang: 70, bk: 30, kg: 52, fx: 'punch' },
      drawFn: (ctx, p) => { ctx.globalAlpha = 1 - p.t / 12; ellipse(ctx, p.x, p.y + 3, 12, 6, '#efe6d2', 'rgba(60,45,34,0.6)', 1.6); ctx.globalAlpha = 1; } }));
  }
}

// ---- super: WHEEL OF MISFORTUNE ---------------------------------------------
// The room turns over like his wheel. While it is upside down everyone else
// falls at the sky; the more hurt they are, the faster they go.
const FLIP_IN = 44, FLIP_HOLD = 270, FLIP_OUT = 44;

class Misfortune extends Entity {
  constructor(m, f) {
    super({ owner: f, tag: 'misfortune' });
    this.roll = 0; this.marked = new Set();
    const ent = this;
    m.overlays.push({
      get dead() { return ent.dead; },
      draw(ctx) {                         // how long the room stays upside down
        const k = clamp(ent.t / 10, 0, 1) * clamp((FLIP_IN + FLIP_HOLD + FLIP_OUT - ent.t) / 10, 0, 1);
        ctx.save(); ctx.translate(W / 2, 48); ctx.scale(k, k);
        circle(ctx, 0, 0, 26, '#fff7e0', OUT, 3);
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, 23, -Math.PI / 2, -Math.PI / 2 + TAU * clamp(1 - (ent.t - FLIP_IN) / FLIP_HOLD, 0, 1)); ctx.closePath(); ctx.fillStyle = '#ff8a1e'; ctx.fill();
        wheelArt(ctx, 14, ent.t * 0.3);
        ctx.restore();
      },
    });
  }
  update(m) {
    const f = this.owner, T = FLIP_IN + FLIP_HOLD;
    this.t++;
    if ((f.out || f.state === 'dead' || m.state === 'over') && this.t < T) this.t = T;      // no hamster, no wheel
    const t = this.t;
    // over the top, and at the end it carries on round rather than rewinding
    this.roll = t < FLIP_IN ? ease.io(t / FLIP_IN) * Math.PI : t < T ? Math.PI : Math.PI * (1 + ease.io(clamp((t - T) / FLIP_OUT, 0, 1)));
    if (t === 12) { m.sfx('rumble'); m.shake(7); }
    if (t === T) m.sfx('slide_down');
    if (t >= T + FLIP_OUT) this.dead = true;
    const live = t >= 14 && t < T;
    for (const v of m.fighters) if (v !== f && v.team !== f.team) { if (live) this.lift(m, v); else this.drop(v); }
    // one camera, however many wheels are turning
    let hold = -1, out = 0;
    for (const e of m.entities) if (e.tag === 'misfortune' && !e.dead) { if (e.t < T) hold = Math.max(hold, e.roll); else out = Math.max(out, e.roll); }
    m.cam.roll = hold >= 0 ? hold : out % TAU;
  }
  lift(m, v) {
    const s = v.state;
    if (v.out || s === 'dead' || s === 'respawn' || v.invuln > 30 || v.def.floats) return this.drop(v);
    if (s === 'grabbed' || s === 'grabhold' || s === 'trapped' || s === 'ledge' || s === 'ledgeclimb') return;
    if (v.grounded) {
      if (s === 'roll' || s === 'spotdodge' || s === 'tech') return;       // let the dodge finish first
      v.onLeaveGround(); v.grounded = false; v.ground = null; v.coyote = 0; v.vy = Math.min(v.vy, -1);
    }
    const pull = clamp(0.3 + v.pct / 150, 0.3, 1.3), top = clamp(1 + v.pct * 0.024, 1, 5.6);
    this.marked.add(v);
    v.gravMul = -pull; v.launched = true; v.lastHitBy = this.owner.slot; v.lastHitFrame = m.frame;
    if (v.vy < -top) v.vy = Math.min(-top, v.vy + 0.5);
    // in an upside-down room the underside of a platform is somewhere to stand
    const up = v.vy + v.ky, head = v.y - v.h * v.scale;
    if (up < 0) for (const p of m.stage.plats) {
      if (!p.on || v.x < p.x || v.x > p.x + p.w) continue;
      const under = p.y + 10;
      if (head < under && head - up >= under - 1) { v.y = under + v.h * v.scale; v.vy = 0; if (v.ky < 0) v.ky = 0; break; }
    }
    if (m.frame % 7 === 0) m.fx.spark(v.x, v.y, 1, '#ffffff');
  }
  drop(v) {
    if (!this.marked.delete(v)) return;
    v.gravMul = 1;
    if (v.state !== 'hitstun' && v.state !== 'tumble') v.launched = false;
  }
}

// ---- the moveset -------------------------------------------------------------
const moves = {
  jab: {
    frames: 16, sfx: { 2: 'swishS' },
    pose: K([0, {}], [2, { fF: [3, -4], rot: -0.1 }], [4, { fF: [17, -7], rot: -0.2, ox: 2 }, 'out'], [8, { fF: [14, -6], rot: -0.16, ox: 1 }], [16, {}]),
    hits: [hit([3, 5], 'footF', 8, 2, 75, 10, 22)],
    cancel: [{ to: 'jab2', f: [6, 14], on: 'attack' }],
  },
  jab2: {
    frames: 17, sfx: { 2: 'swishS' },
    pose: K([0, { fF: [14, -6], rot: -0.16, ox: 1 }], [2, { fB: [8, -3], rot: -0.1 }], [4, { fB: [28, -9], rot: -0.24, ox: 3 }, 'out'], [8, { fB: [25, -8], rot: -0.2, ox: 2 }], [17, {}]),
    hits: [hit([3, 5], 'footB', 8, 2, 75, 10, 22)],
    cancel: [{ to: 'jab3', f: [6, 15], on: 'attack' }],
  },
  jab3: {
    frames: 24, sfx: { 4: 'swishM' },
    pose: K([0, {}], [3, { ox: -3, rot: -0.12, cheek: 0.1 }], [6, { ox: 8, rot: 0.22, cheek: 1, sx: 1.06 }, 'in'], [11, { ox: 6, rot: 0.16, cheek: 0.8 }], [24, {}]),
    hits: [hit([5, 8], 'cheekF', 12, 4, 45, 34, 72, { sfx: 'rubber' })],
  },
  ftilt: {
    frames: 27, sfx: { 5: 'swishM' }, vel: [[5, 3.4, null]],
    pose: K([0, {}], [4, { ox: -4, rot: -0.18, sx: 0.94, sy: 1.05 }], [7, { ox: 10, rot: 0.26, cheek: 1.1, sx: 1.08 }, 'in'], [12, { ox: 7, rot: 0.2, cheek: 0.8 }], [27, {}]),
    hits: [hit([6, 9], 'cheekF', 13, 8, 361, 22, 92, { sfx: 'rubber' })],
  },
  utilt: {
    frames: 25, sfx: { 4: 'boing' },
    pose: K([0, {}], [3, { sy: 0.78, sx: 1.18 }], [6, { sy: 1.22, sx: 0.88, oy: -12, hF: [3, -12], hB: [-3, -12] }, 'out'], [10, { sy: 1.06, oy: -5 }], [25, {}]),
    hits: [hit([5, 9], 'top', 13, 6, 88, 30, 102, { sfx: 'rubber' })],
  },
  dtilt: {
    frames: 22, sfx: { 3: 'swishS' },
    pose: K([0, { sy: 0.8, sx: 1.14 }], [3, { sy: 0.74, sx: 1.2, fF: [6, 0] }], [5, { sy: 0.74, sx: 1.2, fF: [23, 0], rot: -0.08 }, 'out'], [10, { sy: 0.76, sx: 1.18, fF: [20, 0] }], [22, {}]),
    hits: [hit([4, 7], 'footF', 9, 5, 70, 24, 70)],
  },
  dash: {
    frames: 38, vel: [[0, 8, null]], fric: 0.3, sfx: { 2: 'swishM' },
    pose: K([0, { rot: 0, curl: 0.5 }], [4, { rot: 1.1, curl: 1 }, 'lin'], [22, { rot: TAU * 2, curl: 1, sx: 1.06, sy: 0.94 }, 'lin'], [30, { rot: TAU * 2 }], [38, { rot: TAU * 2 }]),
    hits: [hit([4, 11], 'body', 18, 9, 55, 55, 60, { sfx: 'rubber' }), hit([12, 20], 'body', 17, 6, 60, 40, 50, { group: 1 })],
  },
  fsmash: {
    frames: 48, charge: { at: 9, max: 60 }, vel: [[12, 5.5, null]], fric: 0.6, sfx: { 11: 'swishL' },
    pose: K([0, {}], [8, { ox: -7, rot: -0.3, sx: 0.86, sy: 1.12, cheek: 0.2 }], [9, { ox: -7, rot: -0.3, sx: 0.86, sy: 1.12, cheek: 0.2 }],
      [14, { ox: 13, rot: 0.3, cheek: 1.6, sx: 1.12, sy: 0.94 }, 'in3'], [22, { ox: 10, rot: 0.22, cheek: 1.3 }], [48, {}]),
    hits: [hit([13, 17], 'cheekF', 17, 16, 42, 32, 100, { sfx: 'whop' })],
  },
  usmash: {
    frames: 44, charge: { at: 6, max: 60 }, sfx: { 9: 'boing' },
    pose: K([0, {}], [5, { sy: 0.6, sx: 1.34 }], [6, { sy: 0.6, sx: 1.34 }], [11, { sy: 1.36, sx: 0.84, oy: -20, cheek: 0.9, hF: [3, -12], hB: [-3, -12] }, 'in3'], [17, { sy: 1.12, oy: -8, cheek: 0.5 }], [44, {}]),
    hits: [hit([10, 14], 'top', 16, 13, 90, 32, 102, { sfx: 'whop' })],
  },
  dsmash: {
    frames: 46, charge: { at: 6, max: 60 }, sfx: { 7: 'swishM' },
    pose: K([0, {}], [5, { sy: 1.1, sx: 0.92, oy: -5 }], [6, { sy: 1.1, sx: 0.92, oy: -5 }], [9, { sy: 0.74, sx: 1.22, fF: [22, -1], fB: [-22, -1], hF: [4, -10], hB: [-4, -10] }, 'in'],
      [16, { sy: 0.76, sx: 1.2, fF: [20, -1], fB: [-20, -1], hF: [4, -10], hB: [-4, -10] }], [46, {}]),
    hits: [hit([8, 12], 'footF', 11, 12, 30, 34, 84), hit([8, 12], 'footB', 11, 12, 30, 34, 84, { rev: true, group: 1 })],
  },
  nair: air({
    frames: 38, sfx: { 3: 'swishM' },
    pose: K([0, {}], [3, { curl: 1, rot: 0 }], [24, { curl: 1, rot: TAU * 2 }, 'lin'], [30, { rot: TAU * 2 }], [38, { rot: TAU * 2 }]),
    hits: [hit([4, 11], 'body', 20, 8, 361, 18, 84, { sfx: 'rubber' }), hit([12, 23], 'body', 18, 5, 361, 14, 70, { group: 1 })],
  }, 9, [3, 28]),
  fair: air({
    frames: 34, sfx: { 6: 'swishM' },
    pose: K([0, {}], [5, { rot: -0.3, fF: [0, -5], fB: [3, -4] }], [8, { rot: -0.62, fF: [19, -7], fB: [25, -3], ox: 2 }, 'in'], [13, { rot: -0.55, fF: [16, -7], fB: [22, -3] }], [34, {}]),
    hits: [hit([7, 11], 'footF', 12, 10, 361, 24, 90)],
  }, 11, [5, 24]),
  bair: air({
    frames: 32, sfx: { 5: 'swishM' },
    pose: K([0, {}], [4, { ox: 4, rot: 0.2 }], [7, { ox: -10, rot: -0.32, sx: 1.12, sy: 0.92 }, 'in'], [12, { ox: -6, rot: -0.2 }], [32, {}]),
    hits: [hit([6, 10], 'tail', 13, 10, 361, 26, 94, { rev: true, sfx: 'rubber' })],
  }, 10, [4, 22]),
  uair: air({
    frames: 30, sfx: { 4: 'swishS' },
    pose: K([0, {}], [3, { sy: 0.84, sx: 1.12 }], [6, { sy: 1.26, sx: 0.86, oy: -9, hF: [3, -12], hB: [-3, -12] }, 'out'], [30, {}]),
    hits: [hit([5, 9], 'top', 14, 8, 85, 26, 94, { sfx: 'rubber' })],
  }, 9, [3, 20]),
  dair: air({     // a flurry of little stamps, then one that counts
    frames: 40, sfx: { 5: 'swishS', 13: 'swishS', 22: 'swishM' },
    pose: (f, fr) => {
      const a = fr < 5 ? fr / 5 : fr > 28 ? clamp((40 - fr) / 12, 0, 1) : 1, s = Math.sin(fr * 1.6) * 4;
      return { fF: [-4 * a, (5 + s) * a], fB: [6 * a, (5 - s) * a], sy: 1 + 0.08 * a, sx: 1 - 0.05 * a, hF: [3, -9 * a], hB: [-3, -9 * a] };
    },
    hits: [hit([6, 21], 'feet', 12, 2, 270, 0, 0, { rehit: 4, set: 24 }), hit([23, 26], 'feet', 13, 4, 60, 30, 84, { group: 1 })],
  }, 16, [5, 30]),

  // --- specials ---
  nspecial: {   // sunflower seeds: tap for more, three in the air at most
    kind: 'special', frames: 20, drift: 0.8,
    can: (f, m) => countMine(f, m, 'seed') < 3 && !(f.isCPU && f.superReady),     // a CPU saves its star (see hooks.ai)
    pose: K([0, {}], [3, { cheek: 0.9, rot: -0.14, ox: -2 }], [5, { cheek: 0, rot: 0.14, ox: 3, sx: 1.06 }, 'in'], [9, { rot: 0.08 }], [20, {}]),
    events: {
      5: (f, m) => {
        if (countMine(f, m, 'seed') >= 3) return;
        shoot(f, m, { tag: 'seed', x: 20, y: 24, vx: 9.5, vy: -0.7, g: 0.06, r: 5, life: 38, drawFn: drawSeed, hit: { dmg: 3, ang: 361, bk: 6, kg: 18, sfx: 'tink' } });
        m.sfx('spit');
      },
    },
    cancel: [{ to: 'nspecial', f: [11, 19], on: 'special' }],
  },
  sspecial: {   // the hamster ball: rolls fast, through people and off ledges
    kind: 'special', frames: 62, keepV: true, slideOff: true, airOK: true, drift: 0, grav: 0.45, noPush: true,
    can: (f) => !f.v.balled, start: (f) => { if (!f.grounded) f.v.balled = true; },     // once per airtime
    tick: (f, m, fr) => {
      if (fr < 8) { f.vx = approach(f.vx, 0, 0.6); return; }
      if (fr === 8) { f.vx = f.facing * 8.4; m.sfx('rev', { vol: 0.5, rate: 1.4 }); }
      if (fr >= 46) { f.vx = approach(f.vx, 0, 0.5); return; }
      f.vx = approach(f.vx, f.facing * clamp(8.4 + f.inp.x * f.facing * 1.6, 6.4, 10), 0.35);       // lean on it or ease off
      if (f.grounded) {
        const g = f.ground, ahead = f.x + f.facing * 90;
        if (f.isCPU && g && (ahead < g.x || ahead > g.x + g.w)) { f.mf = 46; return; }               // CPUs don't trust ledges
        if (f.pressed('jump') && fr > 12) { f.eat('jump'); f.vy = -f.st.jump * 0.95; f.grounded = false; f.ground = null; f.setState('air'); m.sfx('jump'); return; }
        if (fr % 5 === 0) m.fx.dust(f.x - f.facing * 16, f.y, 1);
      }
    },
    pose: (f, fr) => {
      const k = fr < 8 ? fr / 8 : clamp((62 - fr) / 8, 0, 1);
      return Object.assign({ ball: k, oy: -4 * k - (fr < 8 ? Math.sin((fr / 8) * Math.PI) * 9 : 0), rot: 0.2 * k, hF: [2, -2], hB: [2, -2] }, steps((f.t || 0) * 0.9, 6, 4));
    },
    hits: [hit([9, 45], 'body', 23, 3, 35, 30, 30, { rehit: 9, sfx: 'rubber' }), hit([46, 50], 'body', 24, 5, 55, 46, 76, { group: 1, sfx: 'pop' })],
  },
  uspecial: {   // fired out of a plastic tube: his one way up, so it goes a long way
    kind: 'special', frames: 52, helpless: true, drift: 0.35, ledgeOK: 16, airOK: true, slideOff: true,
    vel: [[7, 0, -14.6]], sfx: { 1: 'slide_up', 7: 'pop' },
    start: (f, m) => { m.spawn(new Tube(f)); },
    tick: (f, m, fr) => {
      if (fr < 7) { f.vx = approach(f.vx, 0, 0.8); if (!f.grounded) f.vy = 0; }
      else if (fr === 7) m.fx.puff(f.x, f.y - 50, 5, '#ffffff');
    },
    pose: K([0, {}], [6, { sy: 0.72, sx: 0.8, curl: 0.5, oy: 3 }], [9, { sy: 1.4, sx: 0.74, hF: [2, -13], hB: [-2, -13] }, 'out'], [24, { sy: 1.15, sx: 0.9, hF: [2, -13], hB: [-2, -13] }], [52, {}]),
    hits: [hit([7, 18], 'top', 15, 7, 86, 46, 60, { sfx: 'pop' })],
  },
  dspecial: {   // on the ground: a quick spin
    kind: 'special', frames: 30, sfx: { 3: 'swishM' },
    pose: K([0, {}], [3, { curl: 1, sy: 0.92 }], [17, { curl: 1, rot: TAU * 2, sy: 0.92 }, 'lin'], [22, { rot: TAU * 2 }], [30, { rot: TAU * 2 }]),
    hits: [hit([4, 9], 'body', 20, 5, 70, 30, 60, { sfx: 'rubber' }), hit([10, 16], 'body', 20, 4, 76, 36, 74, { group: 1, sfx: 'rubber' })],
  },
  dspecial_air: {   // in the air: curls up and drops like a stone
    kind: 'special', frames: 70, airOK: true, drift: 0, fallCap: 15.5, armor: [[14, 68, 80]], sfx: { 13: 'swishL' },
    vel: [[0, 0, null], [6, 0, -4], [14, 0, 15.5]],
    pose: K([0, {}], [6, { curl: 0.6, sy: 0.84, sx: 1.16 }], [13, { curl: 1, rot: TAU }, 'out'], [16, { curl: 1, rot: TAU, sy: 1.2, sx: 0.86 }], [70, { curl: 1, rot: TAU, sy: 1.2, sx: 0.86 }]),
    hits: [hit([14, 68], 'bottom', 17, 11, 70, 24, 80, { sfx: 'whop' })],
    onLand: (f, m) => { if (f.mf < 14) return; shock(f, m); m.fx.dust(f.x, f.y, 7); m.shake(5); m.sfx('thud'); f.setState('land', 18); return false; },
  },

  // --- grab + throws: tiny paws, short reach ---
  grab: {
    kind: 'grab', frames: 30, sfx: { 5: 'swishS' },
    pose: K([0, {}], [4, { ox: -2, rot: -0.08 }], [7, { ox: 7, rot: 0.2, hF: [10, -4], hB: [13, -4] }, 'out'], [12, { ox: 6, rot: 0.16, hF: [9, -4], hB: [12, -4] }], [30, {}]),
    hits: [{ f: [6, 8], x: 25, y: -17, r: 12, dmg: 0, grab: true }],
  },
  ...stdThrows({
    f: { dmg: 7, bk: 58, kg: 62, f: 11, frames: 28, sfx: 'rubber', pose: K([0, { hF: [9, -4], hB: [12, -4] }], [7, { ox: -5, rot: -0.2, cheek: 0.3 }], [11, { ox: 8, rot: 0.25, cheek: 1.1 }, 'in'], [28, {}]) },
    b: { dmg: 8, bk: 60, kg: 80, f: 14, frames: 32, pose: K([0, { hF: [9, -4], hB: [12, -4] }], [14, { hF: [9, -4], hB: [12, -4], rot: -TAU }, 'in'], [32, { rot: -TAU }]) },
    u: { dmg: 7, bk: 62, kg: 66, f: 11, frames: 30, pose: K([0, { hF: [9, -4], hB: [12, -4] }], [6, { sy: 0.7, sx: 1.25, hF: [9, -2], hB: [12, -2] }], [11, { sy: 1.3, sx: 0.85, oy: -8, hF: [6, -14], hB: [9, -14] }, 'in'], [30, {}]) },
    d: { dmg: 6, bk: 50, kg: 40, f: 13, frames: 30, sfx: 'thud', pose: K([0, { hF: [9, -4], hB: [12, -4] }], [8, { oy: -16, ox: 12, curl: 0.6 }], [13, { oy: 0, ox: 18, sy: 0.7, sx: 1.3 }, 'in'], [30, {}]) },
  }),
  getup: {
    frames: 34, invuln: [[0, 12]], sfx: { 8: 'swishM' },
    pose: K([0, { sy: 0.7, sx: 1.2 }], [4, { curl: 1 }], [20, { curl: 1, rot: TAU * 2 }, 'out'], [26, { rot: TAU * 2 }], [34, { rot: TAU * 2 }]),
    hits: [hit([8, 11], [22, 10], 13, 6, 50, 40, 50), hit([12, 16], [-22, 10], 13, 6, 50, 40, 50, { rev: true, group: 1 })],
  },
  taunt: {
    kind: 'taunt', frames: 64, iasa: 56, sfx: { 8: 'squeak' },
    pose: K([0, {}], [10, { cheek: 1.3, face: 3, hF: [2, -6], hB: [2, -6] }, 'back'], [50, { cheek: 1.3, face: 3, hF: [2, -6], hB: [2, -6] }], [64, {}]),
  },

  // --- the super: WHEEL OF MISFORTUNE ---
  super: {
    kind: 'super', frames: 78, grav: 0, sfx: { 3: 'squeak', 10: 'rev' },
    pose: (f, fr) => {
      const k = clamp(fr / 10, 0, 1) * clamp((78 - fr) / 8, 0, 1);
      return Object.assign({ wheel: k, rot: 0.2, oy: -2 * k, hF: [3, -3], hB: [-2, -2], face: 1 }, steps((f.t || 0) * 1.3, 8, 4.5));
    },
    events: { 16: (f, m) => { m.spawn(new Misfortune(m, f)); } },
    tick: (f) => { f.invuln = Math.max(f.invuln, 2); f.vx = approach(f.vx, 0, 0.8); if (!f.grounded) f.vy = 0; },
  },
};

// ---- CPU: hold the star until it will pay off; come home ball first, tube second ----
function aiRecover(f, m, cpu) {
  if (f.grounded || (f.state !== 'air' && f.state !== 'tumble') || groundBelow(m.stage, f.x, f.y - 4, 900)) return false;
  let L = null, bd = 1e9;
  for (const l of ledgesOf(m.stage)) { const d = Math.abs(l.x - f.x) + Math.max(0, f.y - l.y) * 0.6; if (d < bd) { bd = d; L = l; } }
  if (!L) return false;
  const dx = L.x - f.x, dir = dx > 0 ? 1 : -1, below = f.y - L.y;
  cpu.stick(dir, 0);
  if (f.vy + f.ky < -1) return true;
  if (Math.abs(dx) > 100 && !f.v.balled && below > -120) cpu.press('special');
  else if (below > 40 || (Math.abs(dx) < 100 && below > -10)) { cpu.stick(dir * 0.5, -1); cpu.press('special'); }
  return true;
}

export default {
  id: 'zoomie', name: 'ZOOMIE', from: 'Hamster Dash', superName: 'Wheel of Misfortune',
  blurb: 'The class hamster. Fastest feet in the lab and no second jump, so he packs a ball, a tube and a wheel that turns the room over.',
  stats: { weight: 82, walk: 2.8, dash: 7.0, run: 6.6, traction: 0.5, airSpeed: 3.9, airAccel: 0.3, gravity: 0.42, fall: 8.2, fastFall: 12, jump: 11.2, hop: 7, airJumps: 0, jumpSquat: 3, dashFrames: 9, w: 34, h: 46 },
  portrait: { x: 4, y: -29, s: 1.25 },
  costumes: costumes(BASE, [
    ['Golden', {}],
    ['Dust Bunny', { main: '#9aa3b2', fur: '#9aa3b2', belly: '#f2f4f8', ear: '#7c8494' }],
    ['Panda', { main: '#f4f4ee', fur: '#fbfbf5', belly: '#ffffff', ear: '#2b2b33', earIn: '#55525e', band: '#2b2b33', patch: '#2b2b33' }],
    ['Skater', { main: '#e8402a', fur: '#8a5632', belly: '#ecd2ab', ear: '#6f4124', hat: 1 }],
  ]),
  pose, points, draw, moves,
  hooks: {
    init(f) { f.v.roll = 0; f.v.balled = false; },
    postUpdate(f) {
      f.v.roll += (f.vx + f.kx) * f.facing;
      if (f.grounded || f.state === 'ledge') f.v.balled = false;
    },
    onWall(f) { if (f.state === 'move' && f.moveId === 'sspecial' && f.mf > 8 && f.mf < 46) f.mf = 46; },     // the ball pops on walls
    ai(f, m, cpu) {
      if (aiRecover(f, m, cpu)) return true;
      if (!f.superReady) { f.v.starT = 0; return false; }
      f.v.starT = (f.v.starT || 0) + 1;
      const s = f.state;
      if (!f.grounded || (s !== 'idle' && s !== 'walk' && s !== 'run' && s !== 'dash' && s !== 'brake') || (cpu.q && cpu.q.length)) return false;
      if (f.v.starT < 540 && !m.foes(f).some((o) => o.pct >= 55 && o.invuln <= 10 && o.state !== 'ledge')) return false;
      cpu.stick(0, 0); cpu.press('special');
      return true;
    },
  },
  ai: {
    nspecial: { range: [100, 340], dy: 34, w: 0.8 },
    sspecial: { range: [120, 300], dy: 40, w: 0.5 },
    super: { range: 0 },          // fired from hooks.ai instead
    recovery: { up: 250, side: 140 },
  },
};
