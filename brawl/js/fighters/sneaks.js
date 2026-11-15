// SNEAKS - slot 4 of the roster.
// Brief: a burglar. His main weapon is a stick he twirls (a chunky flashlight),
// he has a zapper for range, and his costumes are different heist outfits.
// Super: a trapping one - he fades into the shadows and beats the life out of
// everyone caught.
//
// He is the raccoon that raids the cafeteria dumpster.

import { biped, at } from '../game/rig.js';
import { K, hit, box, air, stdGrab, stdThrows, shoot, countMine, costumes } from '../game/movekit.js';
import { Entity } from '../game/entities.js';
import { groundBelow, pointInSolid, ledgesOf } from '../game/physics.js';
import { OUT, LW, circle, ellipse, blob, blobPath, rrect, limb, line, polygon, fs, eye, mouth, gloss, darken, lighten } from '../core/gfx.js';
import { TAU, clamp, lerp } from '../core/util.js';
import { G, W, H } from '../core/config.js';

const BASE = {
  main: '#8f98a8', fur: '#9aa3b2', fur2: '#f1f0ea', mask: '#33313d', ring: '#3d3b48', ear: '#f2a3ae',
  shirt: '#454b63', collar: '#59607c', pants: '#2f3345', glove: '#c6ccd8', belt: '#f7c21c',
  shoe: '#e8402a', toe: '#ffffff', torch: '#f7c21c', torch2: '#454b63', lens: '#fff6b0',
  hat: '#454b63', hat2: '#59607c', tie: '#e8402a', outfit: 0,
};
// outfit: 0 turtleneck, 1 suit + bow tie, 2 beanie, 3 safari shirt + hat

// ---- the tail: a fat striped sausage that trails off the hips -------------
// pose key `tail`: 0 = relaxed curl, 1 = whipped out straight behind, -1 = drooping
const TAIL = { curl: [[-10, 2], [-23, -2], [-18, -25]], whip: [[-12, -3], [-25, -5], [-38, -6]], droop: [[-9, 5], [-20, 11], [-27, 2]] };
function tailCurve(p, f, J) {
  const k = clamp(p.tail || 0, -1, 1), u = Math.abs(k), a = TAIL.curl, b = k >= 0 ? TAIL.whip : TAIL.droop;
  const sway = Math.sin((f.t || 0) * 0.09) * 1.8 * (1 - u);
  const rx = J.hip[0] - 5, ry = J.hip[1] - 3;
  const pt = (i) => [rx + lerp(a[i][0], b[i][0], u) + sway * i * 0.5, ry + lerp(a[i][1], b[i][1], u)];
  return [[rx, ry], pt(0), pt(1), pt(2)];
}
function drawTail(ctx, c, pal) {
  const path = () => { ctx.beginPath(); ctx.moveTo(c[0][0], c[0][1]); ctx.bezierCurveTo(c[1][0], c[1][1], c[2][0], c[2][1], c[3][0], c[3][1]); };
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  path(); ctx.strokeStyle = OUT; ctx.lineWidth = 11 + LW * 2; ctx.stroke();
  ctx.strokeStyle = pal.fur; ctx.lineWidth = 11; ctx.stroke();
  // rings: the same path again, dashed
  ctx.lineCap = 'butt'; ctx.setLineDash([4.6, 6.2]); ctx.lineDashOffset = -6;
  path(); ctx.strokeStyle = pal.ring; ctx.lineWidth = 11; ctx.stroke();
  ctx.setLineDash([]); ctx.lineCap = 'round';
  circle(ctx, c[3][0], c[3][1], 5.5, pal.ring, null, 0);       // dark tip
}

const EARS = [[-13.4, -6.5, -12.4, -16.6, -4.6, -11.2], [2.2, -11.6, 8.8, -18.4, 11.4, -7.6]];
function drawEars(ctx, pal) {
  for (const e of EARS) {
    const mx = (e[0] + e[4]) / 2, my = (e[1] + e[5]) / 2;
    blob(ctx, [e[0], e[1], lerp(e[0], e[2], 0.8), lerp(e[1], e[3], 0.86), e[2], e[3], lerp(e[4], e[2], 0.8), lerp(e[5], e[3], 0.86), e[4], e[5]], pal.fur, OUT, LW, 0.4);
    blob(ctx, [lerp(e[0], mx, 0.45), lerp(e[1], my, 0.45), lerp(mx, e[2], 0.62), lerp(my, e[3], 0.62), lerp(e[4], mx, 0.45), lerp(e[5], my, 0.45)], pal.ear, null, 0, 0.5);
  }
}
const HEAD = [-14.8, 3.6, -12.2, -5, -5, -11.8, 4, -12, 11.4, -6.6, 13, 0.4, 14.4, 4.6, 9, 9.8, 0, 11, -8.6, 9];
const MASK = [-15.5, 3.2, -10, -4.6, -2, -6.4, 6, -6.4, 12.8, -3.8, 13, 0.8, 7, 2.8, 1, 3.4, -7, 5];
const MUZZ = [-9, 7, -2, 4.4, 5, 2.2, 13.6, 1.6, 15, 5.4, 9.5, 10.4, 0, 11.8];

const rig = biped({
  hipY: 14, hipW: 6.5, shY: 27, shW: 11, headY: 42,
  arm: [10, 10], leg: [8, 7.5], armW: 6.4, legW: 7.2, handR: 5.2, footL: 13, footH: 7, propLen: 26,
  armKey: 'fur', sleeveKey: 'shirt', legKey: 'pants', handKey: 'glove', footKey: 'shoe',
  stance: { hR: at(13, 20), hL: at(-10, 20), prop: -0.95, lean: 0.06, tail: 0, beam: 0 },
  airStance: { hR: at(15, 31), hL: at(-12, 29), fR: at(6, 5), fL: at(-7, 1), prop: -0.8, tail: -0.3, beam: 0 },

  // the tail follows what the body is doing when no attack says otherwise
  poseFix(f, p) {
    if (f.state === 'move') return;
    const s = f.state;
    if (s === 'run' || s === 'dash') p.tail = 0.75;
    else if (s === 'air') p.tail = clamp((f.vy || 0) / 8, -1, 0) * 0.9;
    else if (s === 'hitstun' || s === 'tumble' || s === 'helpless') p.tail = Math.sin((f.t || 0) * 0.7) * 0.7;
    else if (s === 'crouch' || s === 'shield') { p.tail = 0.35; if (s === 'crouch') p.fL = [-4, 0]; }
    else if (s === 'down') p.tail = 0.9;
  },
  extraPoints(f, p, J, out, xf) {
    const c = tailCurve(p, f, J);
    out.tail = xf(p, c[3][0], c[3][1]);
    out.zap = xf(p, J.hL[0] + 13, J.hL[1] - 2);
  },

  back(ctx, { J, pal, p, f }) { drawTail(ctx, tailCurve(p, f, J), pal); },

  torso(ctx, { J, pal }) {
    const sh = J.sh, hip = J.hip, mx = (sh[0] + hip[0]) / 2, my = (sh[1] + hip[1]) / 2, o = pal.outfit;
    blob(ctx, [sh[0] - 9.5, sh[1] - 1, sh[0] + 9, sh[1] - 2, mx + 11, my, hip[0] + 9.5, hip[1] + 4, hip[0] - 9.5, hip[1] + 4, mx - 11, my], pal.shirt, OUT, LW, 0.42);
    // trousers and belt across the bottom of the same shape
    ctx.save();
    blobPath(ctx, [sh[0] - 9.5, sh[1] - 1, sh[0] + 9, sh[1] - 2, mx + 11, my, hip[0] + 9.5, hip[1] + 4, hip[0] - 9.5, hip[1] + 4, mx - 11, my], 0.42); ctx.clip();
    ctx.fillStyle = pal.pants; ctx.fillRect(hip[0] - 14, hip[1] - 1.5, 28, 9);
    ctx.fillStyle = pal.belt; ctx.fillRect(hip[0] - 14, hip[1] - 3.6, 28, 2.6);
    if (o === 1) {           // suit: white shirt front
      polygon(ctx, [sh[0] + 1, sh[1] - 2, sh[0] + 10, sh[1] - 2, sh[0] + 6.5, hip[1] - 4], '#ffffff', OUT, 1.4);
    } else if (o === 3) {    // safari shirt: a chest pocket
      rrect(ctx, mx + 1, my - 3, 6, 5, 1.2, darken(pal.shirt, 0.16), darken(pal.shirt, 0.4), 1.2);
    }
    ctx.restore();
    blobPath(ctx, [sh[0] - 9.5, sh[1] - 1, sh[0] + 9, sh[1] - 2, mx + 11, my, hip[0] + 9.5, hip[1] + 4, hip[0] - 9.5, hip[1] + 4, mx - 11, my], 0.42);
    ctx.strokeStyle = OUT; ctx.lineWidth = LW; ctx.stroke();
    if (o === 1) {           // bow tie
      polygon(ctx, [sh[0] + 5.5, sh[1] + 1.4, sh[0] + 1, sh[1] - 1.4, sh[0] + 1, sh[1] + 4.2], pal.tie, OUT, 1.4);
      polygon(ctx, [sh[0] + 5.5, sh[1] + 1.4, sh[0] + 10, sh[1] - 1.4, sh[0] + 10, sh[1] + 4.2], pal.tie, OUT, 1.4);
      circle(ctx, sh[0] + 5.5, sh[1] + 1.4, 1.5, pal.tie, OUT, 1.2);
    } else rrect(ctx, sh[0] - 6, sh[1] - 4.4, 14, 5.6, 2.6, pal.collar, OUT, 1.8);     // rolled collar
  },

  head(ctx, { pal, p, f }) {
    const ex = p.face, o = pal.outfit;
    ctx.scale(1.16, 1.16);
    if (o !== 2) drawEars(ctx, pal);
    blob(ctx, HEAD, pal.fur, OUT, LW, 0.5);
    ctx.save(); blobPath(ctx, HEAD, 0.5); ctx.clip();
    blob(ctx, MUZZ, pal.fur2, null, 0, 0.5);
    blob(ctx, MASK, pal.mask, null, 0, 0.5);
    ctx.restore();
    blobPath(ctx, HEAD, 0.5); ctx.strokeStyle = OUT; ctx.lineWidth = LW; ctx.stroke();
    // eyes: white on the mask, so the "shut" expressions are drawn in white too
    const eo = { tall: true, lw: 1.5, pupil: ex === 2 || ex === 3 || ex === 5 ? '#ffffff' : OUT, brow: pal.fur2, t: f.t, pr: 0.5 };
    const look = ex === 1 ? 0.45 : 0.3;
    eye(ctx, 0.4, -1.5, 3.3, ex, look, ex === 1 ? 0.2 : 0, 1, eo);
    eye(ctx, 8.6, -1.5, 3.0, ex, look, ex === 1 ? 0.2 : 0, -1, eo);
    ellipse(ctx, 13.4, 3.4, 2.5, 2, OUT, null, 0);                         // nose
    gloss(ctx, 12.8, 2.7, 0.9, 0.6, 0.6);
    if (ex === 2 || ex === 6) mouth(ctx, 8, 7.6, 5, 2, { lw: 1.3 });
    else if (ex === 3) mouth(ctx, 8, 6.8, 6.4, 3, { lw: 1.3 });
    else if (ex === 4) mouth(ctx, 8, 7.4, 6, 4, { lw: 1.4 });
    else if (ex === 1) { ctx.beginPath(); ctx.moveTo(5, 7.8); ctx.quadraticCurveTo(8.6, 6, 11.4, 7.2); ctx.strokeStyle = OUT; ctx.lineWidth = 1.5; ctx.lineCap = 'round'; ctx.stroke(); }
    else { ctx.beginPath(); ctx.moveTo(5, 6.6); ctx.quadraticCurveTo(8.4, 9.4, 11.6, 6.2); ctx.strokeStyle = OUT; ctx.lineWidth = 1.5; ctx.lineCap = 'round'; ctx.stroke(); }
    if (o === 2) {           // beanie, ears poking through
      blob(ctx, [-12.6, -4.2, -10, -12, -2, -15.6, 6.4, -14.4, 11.6, -7], pal.hat, OUT, LW, 0.5);
      limb(ctx, [-12.2, -4, -4, -8, 5, -8.4, 11.4, -6.6], 3.6, pal.hat2, OUT, 1.8);
      drawEars(ctx, pal);
    } else if (o === 3) {    // a squashed field hat
      blob(ctx, [-8, -11, -6.4, -18.4, 0, -20.4, 6.6, -18.6, 8.4, -11], pal.hat, OUT, LW, 0.45);
      ctx.fillStyle = pal.hat2; ctx.fillRect(-7.4, -13.6, 15.4, 2.8);
      ellipse(ctx, 0.6, -10.8, 14.4, 3.1, pal.hat, OUT, LW, -0.06);
    }
  },

  foot(ctx, { pal }, x, y) {   // sneakers, naturally
    const lift = clamp(-y / 10, 0, 1) * 0.5;
    ctx.save(); ctx.translate(x, y - 3.5); ctx.rotate(lift);
    ellipse(ctx, 2.9, 0, 6.6, 3.6, pal.shoe, null, 0);
    ctx.save(); ctx.beginPath(); ctx.ellipse(2.9, 0, 6.6, 3.6, 0, 0, TAU); ctx.clip();
    ctx.fillStyle = pal.toe; ctx.fillRect(5.6, -5, 6, 10); ctx.fillRect(-5, 1.6, 16, 3);
    ctx.restore();
    ellipse(ctx, 2.9, 0, 6.6, 3.6, null, OUT, LW);
    ctx.restore();
  },

  prop(ctx, { pal, p }) {   // the flashlight; origin is the hand, +x runs up the barrel
    if (p.beam > 0.03) {
      ctx.globalAlpha = 0.5 * clamp(p.beam, 0, 1);
      polygon(ctx, [27, -6, 96, -27, 96, 27, 27, 6], pal.lens, null, 0);
      ctx.globalAlpha = 1;
    }
    rrect(ctx, -6, -4.1, 21, 8.2, 3, pal.torch, OUT, 2);
    line(ctx, 0, -2.2, 0, 2.2, darken(pal.torch, 0.28), 1.5); line(ctx, 4, -2.2, 4, 2.2, darken(pal.torch, 0.28), 1.5);
    polygon(ctx, [13.4, -4.6, 21, -7.8, 25.4, -7.8, 25.4, 7.8, 21, 7.8, 13.4, 4.6], pal.torch2, OUT, 2);
    ellipse(ctx, 25.6, 0, 2.3, 6.9, pal.lens, OUT, 1.8);
    circle(ctx, 8.4, -4.4, 1.6, '#e8402a', OUT, 1.2);                       // switch
  },

  front(ctx, { f, pal, J }) {
    if (f.moveId === 'nspecial' || f.moveId === 'zapdud') {     // the zapper, in the off hand
      ctx.save(); ctx.translate(J.hL[0], J.hL[1]);
      rrect(ctx, -4, -1, 6, 9, 2, '#3b3f55', OUT, 1.8);                                        // grip
      rrect(ctx, -6, -6.4, 15, 7.4, 2.6, '#8f5bd6', OUT, 2);                                   // body
      line(ctx, 9, -5.2, 13.4, -5.6, '#cfd6e0', 2); line(ctx, 9, -0.4, 13.4, 0, '#cfd6e0', 2);  // prongs
      circle(ctx, -1.6, -2.8, 1.7, f.v && f.v.zapCD > 0 && f.moveId === 'zapdud' ? '#e8402a' : '#7dffb0', OUT, 1.1);
      ctx.restore();
    }
  },
});
const SP = rig.stance.prop, AP = rig.airStance.prop;
const draw = (ctx, f, p, m) => { if (!(f.v && f.v.hidden)) rig.draw(ctx, f, p, m); };

// ---- zapper spark ---------------------------------------------------------
function drawSpark(ctx, p) {
  const d = p.vx >= 0 ? 1 : -1, len = Math.min(46, 8 + p.t * 13);
  let s = p.t * 17 + 3;
  const rnd = () => ((s = (s * 9301 + 49297) % 233280) / 233280) - 0.5;
  ctx.save(); ctx.translate(p.x, p.y); ctx.scale(d, 1);
  ctx.beginPath(); ctx.moveTo(4, 0);
  for (let i = 1; i <= 4; i++) ctx.lineTo(4 - (len * i) / 4, rnd() * 13);
  ctx.lineJoin = 'miter'; ctx.lineCap = 'round';
  ctx.strokeStyle = OUT; ctx.lineWidth = 6.5; ctx.stroke();
  ctx.strokeStyle = '#fff04a'; ctx.lineWidth = 3.4; ctx.stroke();
  ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.3; ctx.stroke();
  ctx.rotate(p.t * 0.9);
  polygon(ctx, [0, -8, 2.2, -2.2, 8, 0, 2.2, 2.2, 0, 8, -2.2, 2.2, -8, 0, -2.2, -2.2], '#ffffff', OUT, 1.6);
  ctx.restore();
}
const ZAP_NEAR = { dmg: 5, ang: 361, bk: 16, kg: 26, fx: 'elec', sfx: 'zap', status: { kind: 'zap', t: 36 } };
const ZAP_FAR = { dmg: 5, ang: 361, bk: 14, kg: 22, fx: 'elec', sfx: 'zap' };

// ---- marbles --------------------------------------------------------------
const MARBLE_COLS = ['#3d8fe0', '#58b84a', '#e8402a'];
class Marble extends Entity {
  constructor(m, f, i) {
    super({ owner: f, team: f.team, tag: 'marble' });
    this.x = f.x + f.facing * 15; this.y = f.y - 14;
    this.vx = f.facing * (1 + i * 0.8) + f.vx * 0.3; this.vy = -2 - i * 0.7;
    this.ground = null; this.life = 330; this.col = MARBLE_COLS[i % 3]; this.rot = i;
    this.hit = { dmg: 3, ang: 84, bk: 0, kg: 0, set: 54, sfx: 'slide' };
  }
  update(m) {
    this.t++;
    const g = this.ground;
    if (!g) {
      this.vy = Math.min(8, this.vy + 0.34); const py = this.y; this.x += this.vx; this.y += this.vy;
      const s = groundBelow(m.stage, this.x, py, Math.max(2, this.vy + 2));
      if (s && this.y >= s.y) {
        this.y = s.y; m.sfx('tink', { vol: 0.3, rate: 1.3 });
        if (this.vy > 2.6) { this.vy = -this.vy * 0.34; this.y -= 1; } else { this.ground = s; this.vy = 0; }
      }
    } else if (!g.on || this.x < g.x || this.x > g.x + g.w) this.ground = null;       // rolled off the edge
    else { this.vx *= 0.94; this.x += this.vx + (g.vx || 0) + (g.conv || 0); this.y = g.y; }
    this.rot += this.vx * 0.2;
    if (this.t > this.life || this.y > m.stage.blast.b) this.dead = true;
  }
  hitShapes() { return this.ground ? [{ x: this.x, y: this.y - 5, r: 6 }] : null; }
  onHit(t, res, m) { this.dead = true; m.fx.spark(this.x, this.y - 5, 4, lighten(this.col, 0.4)); }
  draw(ctx) {
    if (this.t > this.life - 60 && this.t % 8 < 4) return;
    ctx.save(); ctx.translate(this.x, this.y - 5); ctx.rotate(this.rot);
    circle(ctx, 0, 0, 5, this.col, OUT, 2);
    ctx.beginPath(); ctx.moveTo(-3, 1.6); ctx.quadraticCurveTo(0, -2.6, 3, 1); ctx.strokeStyle = lighten(this.col, 0.55); ctx.lineWidth = 1.5; ctx.lineCap = 'round'; ctx.stroke();
    ctx.restore();
    gloss(ctx, this.x - 1.6, this.y - 6.8, 1.6, 1, 0.75);
  }
}

// ---- grappling hook ---------------------------------------------------------
const HOOK_SPD = 17, HOOK_LEN = 270;
const hookHand = (f) => { const p = (f.pts && f.pts.hL) || [10, -44]; return [f.x + f.facing * p[0] * f.scale, f.y + p[1] * f.scale]; };

// the ledge a Sneaks who is off the stage would aim his hook at, if one is in reach
function tetherLedge(f, m) {
  if (f.grounded || groundBelow(m.stage, f.x, f.y - 4, 900)) return null;
  let best = null, bd = HOOK_LEN - 16;
  for (const L of ledgesOf(m.stage)) {
    if ((f.x - L.x) * L.dir < -60) continue;         // from outside the edge, or tucked just under its lip
    const d = Math.hypot(L.x - f.x, L.y - (f.y - 40));
    if (d < bd) { bd = d; best = L; }
  }
  return best;
}

class Hook extends Entity {
  constructor(m, f, ledge, ang) {
    super({ owner: f, team: f.team, tag: 'hook' });
    const h = hookHand(f);
    this.x = h[0]; this.y = h[1]; this.mode = 'fly'; this.far = 0; this.ledge = ledge; this.surf = null;
    if (ledge) { const d = Math.hypot(ledge.x - h[0], ledge.y - h[1]) || 1; this.vx = ((ledge.x - h[0]) / d) * HOOK_SPD; this.vy = ((ledge.y - h[1]) / d) * HOOK_SPD; }
    else { this.vx = Math.cos(ang) * HOOK_SPD * f.facing; this.vy = -Math.sin(ang) * HOOK_SPD; }
    this.rot = Math.atan2(this.vy, this.vx);
    this.hit = { dmg: 6, ang: 361, bk: 34, kg: 20, fx: 'slash', sfx: 'tink' };
  }
  latch(m, surf) { this.mode = 'latched'; this.surf = surf; m.sfx('clang', { vol: 0.5 }); m.fx.spark(this.x, this.y, 4, '#fff3a0'); }
  update(m) {
    this.t++;
    const f = this.owner;
    if (f.v.hook !== this) { this.dead = true; return; }        // he was knocked out of it, or it's over
    if (this.mode === 'fly') {
      const n = 3;
      for (let i = 0; i < n && this.mode === 'fly'; i++) {
        const px = this.x, py = this.y, L = this.ledge;
        this.x += this.vx / n; this.y += this.vy / n; this.far += HOOK_SPD / n;
        if (L && Math.hypot(L.x - this.x, L.y - this.y) < HOOK_SPD / n + 1) { this.x = L.x; this.y = L.y; this.latch(m, L.s); break; }
        const s = !L && pointInSolid(m.stage, this.x, this.y);      // a hook thrown at a ledge only bites the ledge
        if (s) { this.x = px; this.y = py; this.latch(m, s); break; }
        if (!L) for (const p of m.stage.plats) {
          if (p.on && this.x >= p.x && this.x <= p.x + p.w && py !== this.y && (py - p.y) * (this.y - p.y) <= 0) { this.y = p.y; this.latch(m, p); break; }
        }
      }
      if (this.mode === 'fly' && this.far >= HOOK_LEN) this.mode = 'back';
    } else if (this.mode === 'latched') {
      const s = this.surf;
      if (!s.on) { this.mode = 'back'; return; }
      this.x += s.vx || 0; this.y += s.vy || 0;
    } else {
      const h = hookHand(f), dx = h[0] - this.x, dy = h[1] - this.y, d = Math.hypot(dx, dy);
      if (d < 28) { this.dead = true; return; }
      this.x += (dx / d) * 26; this.y += (dy / d) * 26; this.rot = Math.atan2(-dy, -dx);
    }
  }
  hitShapes() { return this.mode === 'fly' ? [{ x: this.x, y: this.y, r: 9 }] : null; }
  onHit(t, res, m) {
    const f = this.owner;
    if (res === 'hit' && t.launch) {      // yank them over to him
      const dx = f.x + f.facing * 34 - t.x, dy = f.y - 8 - t.y, d = Math.hypot(dx, dy) || 1;
      t.launch.dir = dx >= 0 ? 1 : -1;
      t.launch.ang = Math.atan2(-dy / d, Math.abs(dx) / d);
      t.launch.kb = clamp(Math.sqrt(2 * G.kbDecay * d) / G.kbVel, 30, 76);
      t.launch.hitstun = Math.max(t.launch.hitstun, 24);
      f.v.yank = true;
    }
    if (!this.ledge) this.mode = 'back';  // a hook thrown at a ledge keeps going for it
  }
  draw(ctx) {
    const h = hookHand(this.owner), mx = (h[0] + this.x) / 2, my = (h[1] + this.y) / 2 + (this.mode === 'back' ? 10 : this.mode === 'fly' ? 4 : 0);
    ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(h[0], h[1]); ctx.quadraticCurveTo(mx, my, this.x, this.y);
    ctx.strokeStyle = OUT; ctx.lineWidth = 4.4; ctx.stroke();
    ctx.strokeStyle = '#e0cfa6'; ctx.lineWidth = 2; ctx.stroke();
    ctx.save(); ctx.translate(this.x, this.y); ctx.rotate(this.rot);
    for (const s of [-1, 1]) {
      ctx.beginPath(); ctx.moveTo(-1, 0); ctx.quadraticCurveTo(7, s * 2, 3, s * 8.5);
      ctx.strokeStyle = OUT; ctx.lineWidth = 5.6; ctx.stroke(); ctx.strokeStyle = '#cfd6e0'; ctx.lineWidth = 2.6; ctx.stroke();
    }
    limb(ctx, [-9, 0, 5, 0], 3, '#cfd6e0', OUT, 1.6);
    ctx.restore();
  }
}

// ---- the super: LIGHTS OUT ---------------------------------------------------
// With victims: the room goes dark, twelve quick hits land from every side,
// then the lights come back on and everyone goes flying. With none: the
// lights just flicker.
const LO_HITS = 12, LO_GAP = 8, LO_T = 18 + LO_HITS * LO_GAP + 6;
function eyesInTheDark(ctx, x, y, s, dir, mean) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s * dir, s);
  for (const side of [-1, 1]) {
    const ox = side * 6.2;
    ctx.beginPath();
    if (mean) {      // narrowed, lids slanting down to the nose
      ctx.moveTo(ox - 5, -1.4 - side * 1.8); ctx.lineTo(ox + 5, -1.4 + side * 1.8);
      ctx.quadraticCurveTo(ox + 5.4, 5, ox, 5); ctx.quadraticCurveTo(ox - 5.4, 5, ox - 5, -1.4 - side * 1.8);
    } else ctx.ellipse(ox, 0, 4.6, 5.6, 0, 0, TAU);
    ctx.closePath(); ctx.fillStyle = '#ffffff'; ctx.fill();
    ctx.beginPath(); ctx.arc(ox + (mean ? 1.6 : 0), mean ? 2 : 0.4, mean ? 1.6 : 1.3, 0, TAU); ctx.fillStyle = '#0d0a14'; ctx.fill();
  }
  ctx.restore();
}
class LightsOut extends Entity {
  constructor(m, f, victims) {
    super({ owner: f });
    this.victims = victims; this.dir = f.facing; this.T = victims.length ? LO_T : 20;
    this.at = victims.map((v) => [v.x, v.y]);
    this.slashes = []; this.eyes = { x: f.x, y: f.y - 42, dir: f.facing };
    this.x = f.x; this.y = f.y - 30; this.camera = victims.length > 0;
    for (const v of victims) { v.interrupt(); v.setState('trapped'); v.v.trapMax = LO_T + 60; }
    this.overlay = { dead: false, draw: (ctx, m2) => this.drawDark(ctx, m2) };
    m.overlays.push(this.overlay);
    m.sfx('click');
  }
  finish(m) {
    for (const v of this.victims) if (v.state === 'trapped') { v.intangible = false; v.setState('air'); }
    this.owner.v.hidden = false; this.overlay.dead = true; this.dead = true;
  }
  update(m) {
    this.t++;
    const f = this.owner, T = this.T, t = this.t;
    if (f.out || f.state === 'dead') { this.finish(m); return; }
    const live = this.victims.filter((v) => !v.out && v.state !== 'dead');
    f.v.hidden = live.length > 0 && t >= 5 && t < T;
    if (t < T) {
      live.forEach((v) => {
        const p = this.at[this.victims.indexOf(v)];
        if (v.state !== 'trapped') v.setState('trapped');
        v.sf = 1; v.intangible = true; v.x = p[0] + (t % 4 < 2 ? 1.2 : -1.2); v.y = p[1]; v.vx = v.vy = v.kx = v.ky = 0;
      });
      const n = (t - 18) / LO_GAP;
      if (live.length && n >= 0 && n < LO_HITS && n === Math.floor(n)) {
        live.forEach((v, i) => {
          v.pct = Math.min(999, v.pct + 2); v.stats.taken += 2; f.stats.dealt += 2; v.flash = 4; v.flashColor = '#ffffff';
          v.lastHitBy = f.slot; v.lastHitFrame = m.frame;
          const hh = v.h * v.scale;
          const sx = v.x + m.rng.range(-14, 14), sy = v.y - hh * 0.5 + m.rng.range(-hh * 0.3, hh * 0.3), sa = m.rng.range(0, TAU);
          this.slashes.push({ x: sx, y: sy, a: sa, t }, { x: sx + m.rng.range(-8, 8), y: sy + m.rng.range(-8, 8), a: sa + 1.3 + m.rng.range(0, 0.6), t: t + 2 });
          if (i === n % live.length) { const side = n % 2 ? 1 : -1; this.eyes = { x: v.x + side * (v.w * v.scale * 0.5 + 24), y: v.y - hh * 0.62 + m.rng.range(-12, 8), dir: -side }; }
        });
        m.sfx(n % 3 === 2 ? 'whop' : n % 2 ? 'slap' : 'hitM', { vol: 0.6, rate: 1 + n * 0.025 }); m.sfx('swishS', { vol: 0.4 });
        m.shake(3);
      }
    } else if (t === T) {      // lights on
      m.sfx('click');
      for (const v of live) {
        v.intangible = false; v.grounded = false; v.ground = null;
        m.blast(f, v, { dmg: 14, ang: 45, bk: 64, kg: 125, dir: this.dir, x: v.x - this.dir * 10, force: true, sfx: 'hitL' });
      }
      if (live.length) { m.shake(12); m.sfx('bell', { vol: 0.6 }); }
    }
    while (this.slashes.length && t - this.slashes[0].t > 12) this.slashes.shift();
    if (t > T + 8) this.finish(m);
  }
  drawDark(ctx, m) {
    const t = this.t, T = this.T, z = m.cam.zoom;
    const a = Math.min(1, t / 5) * (t < T ? 1 : Math.max(0, 1 - (t - T) / 4));
    ctx.save();
    ctx.fillStyle = `rgba(13,10,20,${(0.95 * a).toFixed(3)})`; ctx.fillRect(0, 0, W, H);
    if (t >= T && this.victims.length) { ctx.fillStyle = `rgba(255,255,255,${(0.55 * Math.max(0, 1 - (t - T) / 6)).toFixed(3)})`; ctx.fillRect(0, 0, W, H); }
    if (t >= 4 && t < T) {
      for (const v of this.victims) {
        if (v.out || v.state === 'dead') continue;
        const s = m.cam.toScreen(v.x + v.facing * 3, v.y - v.h * v.scale * 0.68);
        eyesInTheDark(ctx, s[0] + Math.sin(t * 1.9) * 1.2, s[1], z * 1.1, v.facing, false);
      }
      const e = this.eyes, blink = this.victims.length ? (t - 18) % LO_GAP < LO_GAP - 2 || t < 18 : t % 10 < 7;
      if (blink) { const s = m.cam.toScreen(e.x, e.y); eyesInTheDark(ctx, s[0], s[1], z * 1.15, e.dir, true); }
      for (const sl of this.slashes) {
        const age = (t - sl.t) / 10;
        if (age < 0) continue;
        const s = m.cam.toScreen(sl.x, sl.y), L = (22 + age * 26) * z;
        ctx.save(); ctx.translate(s[0], s[1]); ctx.rotate(sl.a); ctx.globalAlpha = clamp(1.3 - age * 1.3, 0, 1);
        ctx.beginPath(); ctx.moveTo(-L, 0); ctx.quadraticCurveTo(0, -L * 0.62, L, 0); ctx.quadraticCurveTo(0, -L * 0.2, -L, 0); ctx.closePath();
        ctx.fillStyle = '#ffffff'; ctx.fill();
        if (age < 0.4) { const r = 9 * z; polygon(ctx, [0, -r, r * 0.25, -r * 0.25, r, 0, r * 0.25, r * 0.25, 0, r, -r * 0.25, r * 0.25, -r, 0, -r * 0.25, -r * 0.25], '#ffffff', null, 0); }
        ctx.restore();
      }
    }
    ctx.restore();
  }
}

// ---- the moveset -----------------------------------------------------------
const FT = at(22, 27);          // where the hand sits for the forward twirl
const U_UP = { hL: at(11, 47), hR: at(14, 22), prop: 0.3, lean: 0.08 };
const U_KEYS = K([0, {}], [5, { by: 6, hL: at(-12, 14), lean: -0.12 }], [9, U_UP, 'out'], [58, U_UP], [68, { hL: at(6, 30) }], [82, {}]);
const U_ZIP = { hL: at(12, 48), hR: at(15, 30), prop: 0.9, lean: 0.3, fR: at(-3, 5), fL: at(-10, 9), tail: 0.9, sy: 1.05, face: 3 };
const TIP = { by: 9, lean: 0.62, fR: at(14, 2), fL: at(-14, 4), hR: at(18, 14), hL: at(-16, 20), prop: -0.2, tail: 1, sx: 1.08, sy: 0.9 };
const ZAP_OUT = { hL: at(22, 27), lean: 0.14 };

const moves = {
  jab: {
    frames: 16, sfx: { 2: 'swishS' },
    pose: K([0, {}], [2, { hR: at(6, 23), prop: -0.2, lean: -0.04 }], [4, { hR: at(22, 24), prop: 0, lean: 0.16 }, 'out'], [8, { hR: at(20, 24), prop: 0.04, lean: 0.14 }], [16, {}]),
    hits: [hit([3, 5], 'prop', 9, 3, 75, 10, 25, { to: 'hR', sfx: 'tink' })],
    cancel: [{ to: 'jab2', f: [6, 14], on: 'attack' }],
  },
  jab2: {
    frames: 22, sfx: { 3: 'swishM' },
    pose: K([0, { hR: at(20, 24), prop: 0.04, lean: 0.14 }], [3, { hR: at(10, 40), prop: -1.9, lean: -0.06 }], [6, { hR: at(21, 16), prop: 0.45, lean: 0.22 }, 'in'], [11, { hR: at(20, 14), prop: 0.55, lean: 0.2 }], [22, {}]),
    hits: [hit([5, 8], 'prop', 10, 5, 50, 28, 70, { to: 'hR', sfx: 'bonk' })],
  },
  ftilt: {   // the baton twirl
    frames: 30, sfx: { 5: 'swishS', 9: 'swishS', 13: 'swishM' },
    pose: K([0, {}], [3, { hR: at(12, 29), prop: -1.7, lean: -0.05 }], [6, { hR: FT, prop: -0.5, lean: 0.16 }, 'out'], [18, { hR: FT, prop: -0.5 + TAU * 2, lean: 0.2 }, 'lin'], [23, { hR: at(20, 24), prop: -0.6 + TAU * 2, lean: 0.12 }], [30, { prop: SP + TAU * 2 }]),
    hits: [hit([6, 11], 'prop', 10, 3, 361, 0, 0, { to: 'hR', set: 22, sfx: 'tink' }), hit([12, 17], 'prop', 10, 6, 361, 24, 92, { to: 'hR', group: 1, sfx: 'bonk' })],
  },
  utilt: {
    frames: 28, sfx: { 4: 'swishM' },
    pose: K([0, {}], [3, { hR: at(18, 18), prop: 0.3, lean: 0.1, by: 3 }], [7, { hR: at(8, 46), prop: -1.5, lean: -0.02, sy: 1.04 }, 'out'], [11, { hR: at(-8, 42), prop: -2.6, lean: -0.14 }], [28, {}]),
    hits: [hit([5, 10], 'prop', 11, 7, 88, 28, 100, { to: 'hR', sfx: 'tink' })],
  },
  dtilt: {
    frames: 24, sfx: { 4: 'swishS' },
    pose: K([0, { by: 8, lean: 0.2 }], [4, { by: 9, lean: 0.24, hR: at(8, 8), prop: 0.2, tail: 0.5 }], [6, { by: 9, lean: 0.32, hR: at(23, 6), prop: 0.1, tail: 0.6 }, 'out'], [11, { by: 9, lean: 0.3, hR: at(21, 6), prop: 0.1, tail: 0.5 }], [24, { by: 5 }]),
    hits: [hit([5, 8], 'prop', 9, 6, 72, 22, 70, { to: 'hR', sfx: 'tink' })],
  },
  dash: {    // feet-first slide
    frames: 38, fric: 0.3, sfx: { 3: 'slide' }, vel: [[0, 7.4, null]],
    pose: K([0, { lean: 0.2 }], [5, { by: 9, lean: -0.55, ox: 5, fR: at(24, 3), fL: at(12, 0), hR: at(-8, 17), hL: at(-15, 12), prop: -2.5, tail: 0.6 }, 'out'], [18, { by: 9, lean: -0.5, ox: 5, fR: at(24, 3), fL: at(12, 0), hR: at(-8, 17), hL: at(-15, 12), prop: -2.5, tail: 0.6 }], [38, {}]),
    hits: [hit([5, 10], 'fR', 11, 9, 58, 54, 60), hit([11, 17], 'fR', 10, 6, 62, 38, 50)],
    tick: (f, m, fr) => { if (fr > 5 && fr < 18 && fr % 4 === 0) m.fx.dust(f.x - f.facing * 10, f.y, 1); },
  },
  fsmash: {
    frames: 50, charge: { at: 8, max: 60 }, sfx: { 12: 'swishL' }, vel: [[11, 3.4, null]],
    pose: K([0, {}], [7, { hR: at(-6, 44), prop: -2.35, lean: -0.24, by: 2, fR: at(10, 0), tail: -0.5 }], [8, { hR: at(-6, 44), prop: -2.35, lean: -0.24, by: 2, fR: at(10, 0), tail: -0.5 }],
      [14, { hR: at(22, 13), prop: 0.56, lean: 0.4, by: 5, fR: at(13, 0), sy: 0.96, tail: 0.8 }, 'in3'], [22, { hR: at(21, 12), prop: 0.6, lean: 0.36, by: 5, fR: at(13, 0), tail: 0.6 }], [50, {}]),
    hits: [hit([13, 17], 'prop', 13, 16, 42, 31, 100, { to: 'hR', sfx: 'whop' })],
    events: { 14: (f, m) => { m.fx.dust(f.x + f.facing * 40, f.y, 3); } },
  },
  usmash: {
    frames: 46, charge: { at: 6, max: 60 }, sfx: { 9: 'swishL' },
    pose: K([0, {}], [5, { hR: at(16, 10), prop: 0.9, by: 7, lean: 0.14 }], [6, { hR: at(16, 10), prop: 0.9, by: 7, lean: 0.14 }],
      [11, { hR: at(10, 47), prop: -1.5, lean: -0.04, sy: 1.06 }, 'in'], [16, { hR: at(-6, 44), prop: -2.3, lean: -0.12 }], [46, {}]),
    hits: [hit([9, 14], 'prop', 12, 14, 88, 32, 104, { to: 'hR', sfx: 'whop' })],
  },
  dsmash: {  // low twirl, front then back
    frames: 48, charge: { at: 6, max: 60 }, sfx: { 7: 'swishM', 13: 'swishM' },
    pose: K([0, {}], [5, { by: 8, hR: at(4, 14), prop: -2.7, lean: -0.08 }], [6, { by: 8, hR: at(4, 14), prop: -2.7, lean: -0.08 }],
      [9, { by: 9, hR: at(22, 9), prop: 0.3 + TAU, lean: 0.24 }, 'in'], [15, { by: 9, hR: at(-20, 9), prop: 2.85 + TAU * 2, lean: -0.2 }], [20, { by: 8, hR: at(-19, 9), prop: 2.9 + TAU * 2, lean: -0.18 }], [48, { prop: SP + TAU * 3 }]),
    hits: [hit([8, 10], 'prop', 11, 12, 30, 34, 84, { to: 'hR', sfx: 'bonk' }), hit([14, 17], 'prop', 11, 11, 30, 34, 84, { to: 'hR', rev: true, group: 1, sfx: 'bonk' })],
  },
  nair: air({  // spins the flashlight around his wrist
    frames: 40, sfx: { 4: 'swishS', 11: 'swishS', 18: 'swishS' },
    pose: K([0, {}], [3, { hR: at(10, 28), prop: -1.2, fR: at(7, 8), fL: at(-6, 6), hL: at(-13, 24) }], [26, { hR: at(10, 28), prop: -1.2 + TAU * 3, fR: at(7, 8), fL: at(-6, 6), hL: at(-13, 24) }, 'lin'], [40, { prop: AP + TAU * 3 }]),
    hits: [hit([4, 13], 'prop', 12, 8, 361, 18, 84, { to: 'hR', sfx: 'tink' }), hit([14, 25], 'prop', 11, 5, 361, 14, 70, { to: 'hR', group: 1 })],
  }, 10, [4, 30]),
  fair: air({
    frames: 38, sfx: { 7: 'swishM' },
    pose: K([0, {}], [6, { hR: at(0, 46), prop: -2.0, lean: -0.12 }], [9, { hR: at(23, 22), prop: 0.4, lean: 0.24 }, 'in'], [14, { hR: at(19, 14), prop: 0.8, lean: 0.2 }], [38, {}]),
    hits: [hit([8, 12], 'prop', 12, 10, 361, 24, 92, { to: 'hR', sfx: 'bonk' })],
  }, 12, [6, 28]),
  bair: air({  // tail whip
    frames: 34, sfx: { 6: 'swishM' },
    pose: K([0, {}], [4, { tail: -0.7, lean: 0.2, hR: at(16, 32), hL: at(8, 28) }], [7, { tail: 1, lean: 0.5, hR: at(18, 30), hL: at(10, 26), fR: at(2, 4), fL: at(-10, 8) }, 'in'], [12, { tail: 0.9, lean: 0.46, hR: at(18, 30), hL: at(10, 26), fR: at(2, 4), fL: at(-10, 8) }], [34, {}]),
    hits: [hit([7, 11], 'tail', 11, 10, 361, 26, 94, { to: 'hip', rev: true, sfx: 'whop' })],
  }, 11, [5, 26]),
  uair: air({
    frames: 32, sfx: { 4: 'swishS' },
    pose: K([0, {}], [3, { hR: at(18, 30), prop: -0.7 }], [7, { hR: at(5, 48), prop: -1.57 }, 'out'], [12, { hR: at(-8, 43), prop: -2.4 }], [32, {}]),
    hits: [hit([5, 10], 'prop', 11, 8, 84, 26, 94, { to: 'hR', sfx: 'tink' })],
  }, 10, [4, 24]),
  dair: air({
    frames: 46, sfx: { 10: 'swishM' },
    pose: K([0, {}], [8, { hR: at(8, 36), prop: -1.2, fR: at(6, 12), fL: at(-6, 10) }], [13, { hR: at(6, 10), prop: 1.57, fR: at(8, 14), fL: at(-8, 12), sy: 1.04 }, 'in'], [26, { hR: at(6, 10), prop: 1.57, fR: at(8, 14), fL: at(-8, 12) }], [46, {}]),
    hits: [hit([12, 16], 'prop', 11, 11, 270, 18, 82, { sfx: 'bonk' }), hit([17, 26], 'prop', 10, 8, 60, 20, 60, { group: 1 })],
  }, 20, [8, 34]),

  // --- specials ---
  nspecial: {   // zapper: a short spark; stuns grounded foes at point-blank
    kind: 'special', frames: 38, drift: 0.6,
    can: (f) => !(f.v.zapCD > 0),
    start: (f) => { f.v.zapCD = 96; },
    pose: K([0, {}], [6, { hL: at(6, 31), lean: -0.08 }], [10, ZAP_OUT, 'out'], [12, { hL: at(17, 29), lean: 0.02 }], [20, ZAP_OUT], [38, {}]),
    events: {
      11: (f, m) => {
        const z = (f.pts && f.pts.zap) || [28, -27];
        shoot(f, m, { tag: 'zap', x: z[0] + 4, y: -z[1], vx: 13, r: 8, life: 10, hit: ZAP_NEAR, drawFn: drawSpark,
          tick: (p) => { if (p.t === 4) p.hit = ZAP_FAR; },
          onDie: (p, m2) => { m2.fx.spark(p.x, p.y, 3, '#fff04a'); } });
        m.sfx('zap', { vol: 0.7 });
      },
    },
  },
  zapdud: {     // what nspecial turns into while the zapper recharges
    kind: 'special', frames: 26, drift: 0.6,
    pose: K([0, {}], [6, { hL: at(6, 31), lean: -0.08 }], [10, ZAP_OUT, 'out'], [18, ZAP_OUT], [26, {}]),
    events: { 10: (f, m) => { const z = (f.pts && f.pts.zap) || [28, -27]; m.sfx('click'); m.fx.smoke(f.x + f.facing * z[0], f.y + z[1], '#8d8f98', 5); } },
  },
  sspecial: {   // tiptoe dash: slips straight past people and ends up behind them
    kind: 'special', frames: 36, noPush: true, airOK: true, drift: 0, grav: 0.25, iasa: 23, invuln: [[6, 13]], sfx: { 5: 'dash' },
    can: (f) => f.grounded || !f.v.tiptoed,
    start: (f) => { if (!f.grounded) f.v.tiptoed = true; },
    tick: (f, m, fr) => {
      if (fr === 5 && !f.grounded) f.vy = Math.min(f.vy, 0) * 0.3;
      if (fr >= 5 && fr <= 15) f.vx = f.facing * 10.6;
      else if (fr > 15) f.vx *= 0.8;
      if (fr >= 5 && fr <= 15 && fr % 3 === 0 && f.grounded) m.fx.dust(f.x - f.facing * 16, f.y, 1);
    },
    events: {
      16: (f, m) => {       // passed somebody? turn to face their back
        for (const o of m.foes(f)) if ((o.x - f.x) * f.facing < -6 && Math.abs(o.x - f.x) < 150 && Math.abs(o.y - f.y) < 80) { f.facing = -f.facing; f.vx = 0; break; }
      },
    },
    pose: K([0, {}], [4, { by: 5, lean: 0.2, hR: at(8, 31), hL: at(-4, 33), prop: -1.9, tail: -0.5 }], [6, TIP, 'out'], [15, TIP], [23, { by: 4, lean: -0.1, tail: 0.3 }], [36, {}]),
  },
  uspecial: {   // grappling hook: zips him to wherever it bites; yanks fighters it hits
    kind: 'special', frames: 82, helpless: true, drift: 0.7, grav: 0.55, airOK: true, slideOff: true, ledgeOK: 9,
    can: (f, m) => !f.v.hooked && (!f.isCPU || f.grounded || !!groundBelow(m.stage, f.x, f.y - 4, 900) || !!tetherLedge(f, m)),
    start: (f) => { f.v.hooked = true; f.v.hook = null; f.v.pull = 0; f.v.yank = false; },
    exit: (f) => { f.v.hook = null; f.v.pull = 0; },
    events: {
      8: (f, m) => {
        const L = tetherLedge(f, m);
        if (L) f.facing = L.x >= f.x ? 1 : -1;
        const x = f.inp.x * f.facing;
        f.v.hook = m.spawn(new Hook(m, f, L, x > 0.4 ? 0.66 : x < -0.4 ? 1.3 : 0.96));
        if (!f.grounded) f.vy = Math.min(f.vy, -3.4);
        m.sfx('throw');
      },
    },
    tick: (f, m, fr) => {
      const h = f.v.hook;
      if (fr < 9) return;
      if (!h || h.dead || h.mode === 'back') {         // nothing to hold on to: reel in
        const rec = f.v.yank ? 70 : 58;
        if (fr < rec) f.mf = rec;
        if (f.v.yank && fr >= 80 && !f.grounded) f.setState('air');
        return;
      }
      if (h.mode === 'fly') { if (fr > 40) f.mf = 40; return; }
      // latched: zip along the rope
      f.mf = 44; f.v.pull++;
      const L = h.ledge;
      const tx = L ? h.x + L.dir * (f.w / 2 + 3) : h.x, ty = L ? h.y + f.h * 0.94 : h.y - 4;
      const dx = tx - f.x, dy = ty - f.y, d = Math.hypot(dx, dy) || 1, sp = Math.min(16, 6 + f.v.pull * 1.7);
      const stuck = f.v.pull > 3 && Math.hypot(f.x - f.v.px, f.y - f.v.py) < 2;
      f.v.px = f.x; f.v.py = f.y;
      if (d <= sp + 2 || f.v.pull > 44 || stuck) {     // there: grab on, or hop up and over whatever it bit into
        if (L && f.tryLedge()) return;
        f.vx = L ? -L.dir * 2.4 : clamp(dx, -2.5, 2.5); f.vy = h.surf && h.surf.soft && !stuck ? -4.5 : -9.5;
        h.dead = true; f.setState('air');
        return;
      }
      f.grounded = false; f.ground = null; f.vx = (dx / d) * sp; f.vy = (dy / d) * sp;
      if (f.v.pull % 3 === 0) m.fx.puff(f.x, f.y - 20, 1, '#ffffff');
    },
    pose: (f) => (f.v.pull > 0 ? U_ZIP : U_KEYS),
  },
  dspecial: {   // marbles
    kind: 'special', frames: 36, drift: 0.6,
    can: (f, m) => countMine(f, m, 'marble') < 1,
    pose: K([0, {}], [6, { by: 4, hL: at(-12, 24), lean: -0.06 }], [10, { by: 7, hL: at(16, 10), lean: 0.22 }, 'in'], [17, { by: 6, hL: at(14, 10), lean: 0.18 }], [36, {}]),
    events: { 10: (f, m) => { for (let i = 0; i < 3; i++) m.spawn(new Marble(m, f, i)); m.sfx('throw', { rate: 1.2 }); } },
  },

  // --- grab + throws ---
  grab: stdGrab(K([0, {}], [6, { hL: at(24, 25), hR: at(14, 30), lean: 0.3, prop: -1.6 }, 'out'], [12, { hL: at(23, 24), hR: at(13, 30), lean: 0.26, prop: -1.6 }], [30, {}]), 30, { h: 30 }),
  ...stdThrows({
    f: { dmg: 7, bk: 58, kg: 64, f: 13, frames: 32, sfx: 'bonk', pose: K([0, { hL: at(22, 25) }], [8, { hL: at(20, 25), hR: at(-6, 42), prop: -2.4, lean: -0.1 }], [13, { hL: at(18, 22), hR: at(23, 22), prop: 0.2, lean: 0.26 }, 'in'], [32, {}]) },
    b: { dmg: 8, bk: 60, kg: 80, f: 15, frames: 36, pose: K([0, { hL: at(22, 25) }], [8, { hL: at(8, 44), hR: at(4, 46), lean: -0.1, prop: -1.6 }], [15, { hL: at(-18, 30), hR: at(-14, 34), lean: -0.34, prop: -2.6, tail: -0.6 }, 'in'], [36, {}]) },
    u: { dmg: 7, bk: 64, kg: 68, f: 12, frames: 32, sfx: 'bonk', pose: K([0, { hL: at(22, 25) }], [7, { by: 8, hR: at(18, 11), prop: 0.3, hL: at(18, 16) }], [12, { hR: at(11, 47), prop: -1.5, hL: at(6, 40), sy: 1.05 }, 'in'], [32, {}]) },
    d: { dmg: 6, bk: 50, kg: 40, f: 15, frames: 34, sfx: 'whop', pose: K([0, { hL: at(22, 25) }], [8, { hL: at(18, 9), hR: at(0, 44), prop: -2.1, by: 6 }], [15, { hL: at(18, 8), hR: at(22, 9), prop: 0.6, by: 10, lean: 0.3 }, 'in'], [34, {}]) },
  }),
  getup: {
    frames: 34, invuln: [[0, 12]], sfx: { 9: 'swishM' },
    pose: K([0, { by: 11, lean: 0.2 }], [10, { by: 9, hR: at(22, 8), prop: 0.3 }], [16, { by: 9, hR: at(-20, 9), prop: 2.8, lean: -0.15 }], [34, {}]),
    hits: [hit([9, 12], 'prop', 11, 6, 50, 40, 50, { to: 'hR' }), hit([15, 18], 'prop', 11, 6, 50, 40, 50, { to: 'hR', rev: true, group: 1 })],
  },
  taunt: {      // twirls it, catches it, clicks it on
    kind: 'taunt', frames: 72, iasa: 62, sfx: { 9: 'swishS', 19: 'swishS', 29: 'swishS', 44: 'click' },
    pose: K([0, {}], [8, { hR: at(16, 30), prop: SP }], [38, { hR: at(16, 30), prop: SP + TAU * 3, face: 3 }, 'lin'], [44, { hR: at(13, 36), prop: -1.2 + TAU * 3, hL: at(-13, 28), face: 3 }, 'back'],
      [45, { hR: at(13, 36), prop: -1.2 + TAU * 3, hL: at(-13, 28), face: 3, beam: 0.9 }, 'snap'], [60, { hR: at(13, 36), prop: -1.2 + TAU * 3, hL: at(-13, 28), face: 3, beam: 0.9 }], [61, { hR: at(13, 36), prop: -1.2 + TAU * 3, face: 3 }, 'snap'], [72, { prop: SP + TAU * 3 }]),
  },

  // --- the super: LIGHTS OUT ---
  super: {
    kind: 'super', frames: 20 + LO_T + 22, sfx: { 6: 'swishM' },
    pose: K([0, {}], [8, { hR: at(2, 45), prop: -1.57, lean: -0.14, hL: at(-13, 30), beam: 1 }], [13, { hR: at(22, 26), prop: 0.02, lean: 0.3, hL: at(-14, 18), beam: 1 }, 'in3'], [19, { hR: at(22, 26), prop: 0.02, lean: 0.3, hL: at(-14, 18), beam: 1 }],
      [20, { hR: at(22, 26), prop: 0.02, lean: 0.3, hL: at(-14, 18) }, 'snap'], [20 + LO_T, { hR: at(22, 26), prop: 0.02, lean: 0.3, hL: at(-14, 18) }],
      [20 + LO_T + 6, { hR: at(12, 40), prop: -1.3, hL: at(-13, 26), lean: -0.08, face: 3 }, 'back'], [20 + LO_T + 16, { hR: at(12, 40), prop: -1.3, hL: at(-13, 26), lean: -0.08, face: 3 }], [20 + LO_T + 22, {}]),
    start: (f) => { f.v.caught = []; },
    hits: [box([12, 18], [66, 32], 164, 94, 4, 90, 0, 0, { set: 1, unblockable: true, sfx: 'tink',
      onHit: (o, t) => { if (o && !o.v.caught.includes(t) && !t.def.noGrab) o.v.caught.push(t); } })],
    events: {
      20: (f, m) => {
        const got = f.v.caught.filter((v) => !v.out && v.state !== 'dead');
        m.spawn(new LightsOut(m, f, got));
        if (!got.length) { f.mf = LO_T + 8; m.sfx('fail'); m.fx.word(f.x, f.y - 90, 'NOBODY HOME', { color: '#ffffff', size: 20 }); }
      },
    },
    tick: (f) => { f.invuln = Math.max(f.invuln, 2); },
  },
};

export default {
  tune: { dmg: 0.96 },      // balance dial: scales all damage this fighter deals
  id: 'sneaks', name: 'SNEAKS', from: 'Midnight Snack Heist', superName: 'Lights Out',
  blurb: 'The raccoon behind the cafeteria dumpster. Twirls a flashlight, carries a zapper, and was never here.',
  stats: { weight: 92, walk: 2.5, dash: 6.0, run: 5.6, jump: 10.9, hop: 6.8, djump: 10, gravity: 0.37, fall: 7.6, airSpeed: 3.8, w: 30, h: 58 },
  portrait: { x: 3, y: -43, s: 1.16 },
  costumes: costumes(BASE, [
    ['Dumpster Diver', {}],
    ['Spy', { main: '#d9b58a', fur: '#d9b58a', fur2: '#fff6e6', mask: '#5e4130', ring: '#6b4a36', shirt: '#b4bccb', collar: '#b4bccb', pants: '#8e97a8', belt: '#2f3345', glove: '#ffffff', shoe: '#2f3345', toe: '#8e97a8', torch: '#cfd6e0', torch2: '#2f3345', outfit: 1 }],
    ['Night Shift', { main: '#5d6796', fur: '#5d6796', fur2: '#c9d0ea', mask: '#1f2233', ring: '#272a40', ear: '#8f7fd0', shirt: '#2b2e40', collar: '#3a3e56', pants: '#232536', belt: '#4fd0e0', glove: '#9aa2cf', shoe: '#2b2e40', toe: '#4fd0e0', torch: '#4fd0e0', torch2: '#2b2e40', lens: '#d8fbff', hat: '#2b2e40', hat2: '#4fd0e0', outfit: 2 }],
    ['Jungle', { main: '#b9683c', fur: '#b9683c', fur2: '#f8e6c8', mask: '#4f2c1d', ring: '#5b3422', ear: '#f0b08a', shirt: '#cdb86e', collar: '#dccb8a', pants: '#77683a', belt: '#5b3422', glove: '#f8e6c8', shoe: '#6f4a2a', toe: '#a9865a', torch: '#58b84a', torch2: '#4f2c1d', hat: '#a9865a', hat2: '#4f2c1d', outfit: 3 }],
  ]),
  pose: rig.pose, points: rig.points, draw,
  moves,
  remap: (f, id) => (id === 'nspecial' && f.v.zapCD > 0 ? 'zapdud' : id),
  hooks: {
    init(f) { f.v.zapCD = 0; f.v.hooked = false; f.v.tiptoed = false; f.v.hook = null; f.v.pull = 0; f.v.hidden = false; },
    postUpdate(f) {
      if (f.v.zapCD > 0) f.v.zapCD--;
      if (f.grounded || f.state === 'ledge') { f.v.tiptoed = false; if (f.moveId !== 'uspecial') f.v.hooked = false; }
    },
    onKO(f) { f.v.hidden = false; f.v.zapCD = 0; },
    ai(f, m, cpu) {
      // the stock recovery code presses Jump every frame, which never re-triggers a button
      // that is already down (say from the hop that took him off the edge): let go first
      if (f.state === 'air' && f.jumps > 0 && f.vy > 0 && cpu.snap.h.jump && !groundBelow(m.stage, f.x, f.y - 4, 900)) { cpu.holds.jump = 0; cpu.snap.h.jump = false; }
      const t = cpu.target;
      if (!t) return;
      // the stock CPU winds up a full charge on anyone stunned; a zap doesn't last that long
      if (f.v.aiCharge > 0 && t.state === 'stun' && t.stunKind === 'zap') f.v.aiCharge = 0;
      // out of the tiptoe dash: hit whoever he just slipped past
      if (f.state === 'move' && f.moveId === 'sspecial' && f.mf >= 23 && f.grounded) {
        const dx = t.x - f.x;
        if (Math.abs(dx) < 64 && Math.abs(t.y - f.y) < 40 && t.invuln <= 0) { cpu.stick(dx > 0 ? 1 : -1, 0); cpu.press(t.pct > 95 ? 'strong' : 'attack'); return true; }
      }
    },
  },
  ai: {
    nspecial: { range: [46, 150], dy: 36, w: 0.7 },
    sspecial: { range: [60, 130], dy: 46, w: 0.4 },
    dspecial: { range: [80, 230], dy: 50, w: 0.25 },
    super: { range: 130, dy: 50 },
    recovery: { up: 200, side: 150 },
  },
};
