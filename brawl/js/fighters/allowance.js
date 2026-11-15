// CAPT. ALLOWANCE - slot 12 of the roster.
// Brief: a speedy rushdown brawler with fast, hard punches and a toy ray gun.
// Coins turn up during the match; three of them buy his super (the Gold Star
// works for him too). Super: nothing fancy, just a very big laser beam.
//
// He is a kid playing superhero at recess: bath-towel cape, colander helmet,
// swim goggles, rain boots and a cardboard chest plate.

import { biped, at } from '../game/rig.js';
import { K, hit, box, air, stdGrab, stdThrows, shoot, countMine, costumes, stdTaunt } from '../game/movekit.js';
import { Entity } from '../game/entities.js';
import { groundBelow, pointInSolid } from '../game/physics.js';
import { OUT, LW, circle, ellipse, blob, rrect, polygon, limb, line, fs, eye, mouth, star, gloss, darken, lighten } from '../core/gfx.js';
import { TAU, clamp, lerp } from '../core/util.js';

const BASE = {
  main: '#e8402a', skin: '#f6c9a0', hair: '#7a4a26', towel: '#e8402a', towel2: '#fff3d6', shirt: '#4a9fe0', pants: '#34446e', leg: '#f6c9a0',
  helm: '#c9d2dc', gog: '#2f7fe0', lens: '#d4f2ff', strap: '#2b3350', glove: '#ffd23a', boot: '#ffd23a',
  card: '#d2a567', ink: '#2b2118', gun: '#35a84a', gun2: '#ff8a1e', beam: '#ff5a3a',
  gunKind: 0, stache: 0,
};
const GOLD = '#ffd23a';

// the ray gun lives in its holster unless he is actually shooting
const gunOut = (f) => f.state === 'move' && (f.moveId === 'nspecial' || f.moveId === 'super');

function drawGun(ctx, pal) {      // origin at the grip, +x along the barrel
  if (pal.gunKind === 1) {        // Night Light carries a flashlight instead
    rrect(ctx, -5, -3.2, 14, 6.4, 2, pal.gun, OUT, 2);
    polygon(ctx, [8, -3.4, 13, -6.2, 17, -6.2, 17, 6.2, 13, 6.2, 8, 3.4], pal.gun, OUT, 2);
    rrect(ctx, 16, -6.2, 2.6, 12.4, 1, pal.gun2, OUT, 1.6);
    rrect(ctx, 0, -4.8, 4, 2.2, 1, '#e8402a', OUT, 1.2);
    return;
  }
  rrect(ctx, -3.4, 0, 5.4, 8, 1.6, darken(pal.gun, 0.28), OUT, 1.8);     // grip
  polygon(ctx, [-3, -5, 1.5, -10, 4.5, -5.2], pal.gun2, OUT, 1.6);         // fin
  rrect(ctx, 7, -3, 9, 4.2, 1.4, pal.gun2, OUT, 1.8);                     // barrel
  ellipse(ctx, 2.6, -0.9, 7.4, 5, pal.gun, OUT, 2);                       // bulb
  ellipse(ctx, 11, -0.9, 1.3, 3.6, pal.gun2, OUT, 1.4); ellipse(ctx, 13.8, -0.9, 1.1, 2.8, pal.gun2, OUT, 1.4);
  circle(ctx, 17, -0.9, 2.2, pal.beam, OUT, 1.6);
  circle(ctx, 1.4, -2.2, 1.5, 'rgba(255,255,255,0.6)', null, 0);
}

const rig = biped({
  hipY: 15, hipW: 7, shY: 28, shW: 18, headY: 46,
  arm: [10, 10], leg: [8, 8], armW: 6.6, legW: 7.4, handR: 5.9, footL: 13, footH: 7, propLen: 17,
  armKey: 'skin', sleeveKey: 'shirt', handKey: 'glove',
  stance: { hR: at(18, 20), hL: at(-13, 18), lean: 0.05, prop: 0 },
  airStance: { hR: at(15, 33), hL: at(-12, 30), fR: at(7, 6), fL: at(-7, 2), lean: 0.05, prop: 0 },

  // the bath towel, safety-pinned at the collar; it trails behind whatever he does
  back(ctx, { J, pal, f }) {
    const sh = J.sh, t = f.t || 0;
    const vx = ((f.vx || 0) + (f.kx || 0)) * (f.facing || 1), vy = (f.vy || 0) + (f.ky || 0);
    const flow = clamp(vx * 1.5, -5, 15), lift = clamp(vy * 1.6 + Math.abs(vx) * 1.1, -7, 22);
    const sway = Math.sin(t * 0.11) * 1.3;
    const ax = sh[0] - 3, ay = sh[1] - 2;
    const bx = ax - 17 - flow + sway, by = ay + 31 - lift;                     // middle of the bottom hem
    const nx = (by - ay), ny = -(bx - ax), nl = Math.hypot(nx, ny) || 1, hx = nx / nl * 11, hy = ny / nl * 11;
    const T1 = [ax - 6, ay], T2 = [ax + 6, ay - 1], B1 = [bx - hx, by - hy], B2 = [bx + hx, by + hy];
    polygon(ctx, [T1[0], T1[1], T2[0], T2[1], B2[0], B2[1], B1[0], B1[1]], pal.towel, OUT, LW);
    for (const k of [0.14, 0.27]) line(ctx, lerp(B1[0], T1[0], k), lerp(B1[1], T1[1], k), lerp(B2[0], T2[0], k), lerp(B2[1], T2[1], k), pal.towel2, 2);
    ctx.beginPath(); ctx.moveTo(T1[0], T1[1]); ctx.lineTo(B1[0], B1[1]); ctx.lineTo(B2[0], B2[1]); ctx.lineTo(T2[0], T2[1]);
    ctx.strokeStyle = OUT; ctx.lineWidth = LW; ctx.lineJoin = 'round'; ctx.stroke();
  },

  torso(ctx, { J, pal, f }) {
    const sh = J.sh, hip = J.hip, mx = (sh[0] + hip[0]) / 2, my = (sh[1] + hip[1]) / 2;
    blob(ctx, [hip[0] - 8.6, hip[1] - 3, hip[0] + 8.6, hip[1] - 3, hip[0] + 9.6, hip[1] + 4.4, hip[0], hip[1] + 5.4, hip[0] - 9.6, hip[1] + 4.4], pal.pants, OUT, LW, 0.3);
    blob(ctx, [sh[0] - 9, sh[1] - 1, sh[0] + 9, sh[1] - 1.5, mx + 10.5, my + 1, hip[0] + 8.8, hip[1] - 0.5, hip[0] - 8.8, hip[1] - 0.5, mx - 10.5, my + 1], pal.shirt, OUT, LW, 0.4);
    // holster on the hip (empty while the gun is in his hand)
    ctx.save(); ctx.translate(hip[0] - 8, hip[1] - 2.5); ctx.rotate(1.4);
    if (!gunOut(f)) { ctx.save(); ctx.scale(0.62, 0.62); drawGun(ctx, pal); ctx.restore(); }
    rrect(ctx, 0.5, -3.6, 8, 6.4, 1.6, darken(pal.card, 0.3), OUT, 1.6);
    ctx.restore();
    // cardboard chest plate with the marker-pen coin emblem
    ctx.save(); ctx.translate(mx + 2.6, my - 1.6); ctx.rotate(Math.atan2(sh[0] - hip[0], hip[1] - sh[1]) - 0.07);
    polygon(ctx, [-7.6, -7.2, 7.2, -8, 8.2, 6.2, -6.8, 7], pal.card, OUT, 2);
    circle(ctx, 0.5, -0.6, 4.7, GOLD, pal.ink, 1.4);
    ctx.beginPath(); ctx.moveTo(-1.6, 1.9); ctx.lineTo(0.5, -3.3); ctx.lineTo(2.6, 1.9); ctx.moveTo(-0.7, 0.2); ctx.lineTo(1.7, 0.2);
    ctx.strokeStyle = pal.ink; ctx.lineWidth = 1.3; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.stroke();
    ctx.restore();
    ellipse(ctx, sh[0] + 3, sh[1] - 0.4, 4.6, 2.6, pal.towel, OUT, 1.8);         // the towel's knot...
    line(ctx, sh[0] + 1.4, sh[1] - 0.2, sh[0] + 4.8, sh[1] - 0.8, '#eef3f8', 1.5); // ...and its safety pin
  },

  // bare legs into chunky rain boots
  drawLeg(ctx, { pal, S }, hp, k, ft) {
    const ay = ft[1] - S.footH * 0.5;
    limb(ctx, [hp[0], hp[1], k[0], k[1], ft[0], ay], S.legW, pal.leg, OUT, LW);
    limb(ctx, [lerp(k[0], ft[0], 0.3), lerp(k[1], ay, 0.3), ft[0], ay], S.legW + 2.6, pal.boot, OUT, LW);
    ctx.save(); ctx.translate(ft[0], ay); ctx.rotate(clamp(-ft[1] / 10, 0, 1) * 0.5);
    ellipse(ctx, S.footL * 0.24, 0.4, S.footL * 0.53, S.footH * 0.54, pal.boot, OUT, LW);
    ctx.restore();
  },

  head(ctx, { pal, p, f }) {
    const ex = p.face, gy = 1.8;
    ctx.scale(1.13, 1.13);
    blob(ctx, [-12.6, -3, -9, -6, -6, -1, -8.6, 4, -12.8, 2.6], pal.hair, OUT, 1.8, 0.4);    // hair out the back
    ellipse(ctx, 0.8, 1.8, 11.2, 11.4, pal.skin);
    ellipse(ctx, -8, 3.6, 2.3, 3.1, pal.skin, OUT, 1.5);                                     // ear
    circle(ctx, -0.6, 8, 2.1, 'rgba(240,120,110,0.4)', null, 0);                             // cheek
    limb(ctx, [-10.4, 0.8, 0, gy], 2.6, pal.strap, OUT, 1.5);                                // goggle strap
    // the colander: base ring on top, bowl, lip and two little handles
    rrect(ctx, -4.6, -19.2, 10.4, 4, 1.5, pal.helm, OUT, 2);
    ctx.beginPath(); ctx.moveTo(-12.6, -3.6); ctx.bezierCurveTo(-13.4, -20.6, 14.4, -20.6, 13.6, -3.6); ctx.closePath(); fs(ctx, pal.helm, OUT, LW);
    ctx.fillStyle = darken(pal.helm, 0.45);
    for (const h of [[-7.4, -8.6], [-2.4, -8.6], [2.6, -8.6], [7.6, -8.6], [-4.9, -12.6], [0.1, -12.6], [5.1, -12.6]]) { ctx.beginPath(); ctx.arc(h[0], h[1], 1.15, 0, TAU); ctx.fill(); }
    gloss(ctx, -7, -14, 3.4, 1.5, 0.55, -0.6);
    rrect(ctx, -17.6, -5.3, 5.4, 2.8, 1.2, pal.helm, OUT, 1.6); rrect(ctx, 13.4, -5.3, 5.4, 2.8, 1.2, pal.helm, OUT, 1.6);   // flat tab handles
    rrect(ctx, -13.6, -5.6, 28.2, 3.4, 1.7, lighten(pal.helm, 0.35), OUT, 2);
    // swim goggles; the eyes act through the lenses
    line(ctx, 5.6, gy, 7.2, gy, OUT, 3.4);
    for (const gx of [2.2, 10.5]) circle(ctx, gx, gy, 5, pal.gog, OUT, 1.7);
    for (const gx of [2.2, 10.5]) circle(ctx, gx, gy, 3.5, pal.lens, darken(pal.gog, 0.35), 1);
    if (ex === 2 || ex === 3 || ex === 5) { eye(ctx, 2.2, gy, 2.7, ex, 0, 0, 1, { lw: 1 }); eye(ctx, 10.5, gy, 2.7, ex, 0, 0, -1, { lw: 1 }); }
    else if (ex === 4) { eye(ctx, 2.2, gy, 3.3, 4, 0, 0, 1, { lw: 0.01, white: pal.lens, t: f.t }); eye(ctx, 10.5, gy, 3.3, 4, 0, 0, -1, { lw: 0.01, white: pal.lens, t: f.t }); }
    else {
      const pr = ex === 6 ? 0.95 : 1.9, lx = ex === 6 ? 0 : 0.8;
      circle(ctx, 2.2 + lx, gy + 0.2, pr, OUT, null, 0); circle(ctx, 10.5 + lx, gy + 0.2, pr, OUT, null, 0);
      if (ex === 1) { line(ctx, -1.6, gy - 4.4, 5.4, gy - 2, OUT, 1.9); line(ctx, 7.6, gy - 2, 14, gy - 4.4, OUT, 1.9); }
    }
    if (pal.stache) blob(ctx, [6.6, 7.2, 10.4, 6.4, 13.6, 5.2, 13, 8.8, 9.6, 9.4, 6.6, 8.8, 3.6, 9.4, 0.2, 8.8, -0.4, 5.2, 2.8, 6.4], pal.card, OUT, 1.4, 0.4);
    const my = pal.stache ? 11 : 9.8;
    if (ex === 2 || ex === 6) mouth(ctx, 6.8, my + 0.2, 5.6, 2, { lw: 1.3 });
    else if (ex === 3) mouth(ctx, 6.6, my - 0.9, 8.4, 3, { lw: 1.3 });
    else if (ex === 1) mouth(ctx, 6.8, my, 7, 1, { lw: 1.2 });
    else if (ex === 4) mouth(ctx, 6.8, my, 7, 4, { lw: 1.5 });
    else if (ex === 5) mouth(ctx, 6.8, my, 5, 5, { lw: 1.5 });
    else { ctx.beginPath(); ctx.moveTo(3.4, my - 0.6); ctx.quadraticCurveTo(7, my + 1.6, 10.6, my - 1.6); ctx.strokeStyle = OUT; ctx.lineWidth = 1.5; ctx.lineCap = 'round'; ctx.stroke(); }
  },

  prop(ctx, { pal, f }) { if (gunOut(f)) drawGun(ctx, pal); },

  front(ctx, { f, p, pal }) {
    if (f.moveId === 'nspecial' && f.state === 'move' && f.mf >= 5 && f.mf <= 7) {   // muzzle flash
      const J = rig.joints(p);
      star(ctx, J.hR[0] + Math.cos(p.prop) * 21, J.hR[1] + Math.sin(p.prop) * 21 - 1, 8, 3.4, 6, '#ffffff', pal.beam, 2, f.t);
    }
  },

  poseFix(f, p) {
    if (f.state === 'move') { if (f.moveId === 'super' && f.mf > 18 && f.mf < 100) p.ox += f.t % 2 ? 1 : -1; }   // the big beam kicks like a mule
    else if (f.state === 'win') { const j = Math.abs(Math.sin(f.t * 0.14)); p.hR = [20, -38 - j * 7]; p.hL = [-14, -17]; }
    else if (f.state === 'helpless') { const w = Math.sin(f.t * 0.5) * 4; p.hR = [20 + w, -40]; p.hL = [-20 - w, -40]; }
  },
});

// ---- coins -------------------------------------------------------------------
// Only he can pick them up. A coin hangs over the floor it was dropped on; if
// that floor moves it rides along, and if the floor goes away it falls until it
// finds another one (or leaves the screen).
const HOVER = 22;
class Coin extends Entity {
  constructor(m, f, x, g, hover) {
    super({ owner: f, tag: 'coin', layer: 'back' });
    this.g = g; this.hover = hover; this.x = x; this.y = g.y - hover; this.vy = 0; this.life = 540;
  }
  update(m) {
    this.t++;
    const f = this.owner, st = m.stage;
    if (f.out || this.t > this.life) { this.dead = true; if (!f.out) m.fx.puff(this.x, this.y, 3, '#fff3a0'); return; }
    if (this.g) {
      const g = this.g;
      this.x += g.vx || 0; this.y = g.y - this.hover;
      if (groundBelow(st, this.x, this.y, this.hover + 6) !== g) this.g = null;     // floor has gone (or something slid in between)
    }
    if (!this.g) {
      this.vy = Math.min(7, this.vy + 0.3);
      const feet = this.y + HOVER, g = groundBelow(st, this.x, feet, this.vy + 2);
      this.y += this.vy;
      if (g && this.y + HOVER >= g.y) { this.g = g; this.hover = HOVER; this.y = g.y - HOVER; this.vy = 0; }
      else if (this.y > st.blast.b) { this.dead = true; return; }
    }
    if (f.state === 'dead') return;
    if (Math.abs(f.x - this.x) < f.w * f.scale / 2 + 12 && this.y > f.y - f.h * f.scale - 12 && this.y < f.y + 10) {
      this.dead = true;
      f.v.coins = Math.min(3, (f.v.coins || 0) + 1);
      m.sfx('coin'); m.fx.spark(this.x, this.y, 5, '#fff3a0'); m.fx.ring(this.x, this.y, 16, GOLD);
      m.fx.word(this.x, this.y - 18, '+1', { color: GOLD, size: 22, life: 34 });
    }
  }
  draw(ctx) {
    const t = this.t;
    if (t > this.life - 100 && t % 10 < 4) return;
    const w = Math.cos(t * 0.14), y = this.y + Math.sin(t * 0.09) * 2.2, a = Math.abs(w);
    ctx.save(); ctx.translate(this.x, y);
    circle(ctx, 0, 0, 12.5, null, this.owner.color, 2);                       // whose coin it is
    ellipse(ctx, 0, 0, 1.8 + a * 7.4, 9.2, GOLD, OUT, 2.2);
    if (a > 0.45) {
      ellipse(ctx, 0, 0, a * 5.2, 6.4, null, '#d99a12', 1.4);
      ctx.save(); ctx.scale(a, 1);
      ctx.beginPath(); ctx.moveTo(-2.4, 3); ctx.lineTo(0, -3.4); ctx.lineTo(2.4, 3); ctx.moveTo(-1.3, 0.9); ctx.lineTo(1.3, 0.9);
      ctx.strokeStyle = '#a86a00'; ctx.lineWidth = 1.5; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.stroke();
      ctx.restore();
    }
    gloss(ctx, -a * 3, -4.4, a * 2.2 + 0.4, 1.3, 0.7);
    ctx.restore();
  }
}

// a random spot he can actually get to: just above a floor, or one jump over it
function spawnCoin(f, m) {
  const st = m.stage, c = st.cam, b = st.blast, r = m.rng;
  const floors = st.solids.concat(st.plats).filter((s) => s.on && s.w >= 30 && s.y <= c.b && s.y < b.b - 60 && s.x + s.w > c.l + 40 && s.x < c.r - 40);
  let total = 0;
  for (const s of floors) total += s.w;
  for (let i = 0; i < 12 && total > 0; i++) {
    let pick = r.next() * total, g = floors[0];
    for (const s of floors) { pick -= s.w; if (pick <= 0) { g = s; break; } }
    const x = clamp(r.range(g.x + 14, g.x + g.w - 14), c.l + 40, c.r - 40);
    if (x < g.x + 8 || x > g.x + g.w - 8) continue;
    const hover = r.chance(0.35) ? r.range(84, 104) : HOVER;
    if (g.y - hover < Math.max(c.t, b.t + 80)) continue;
    if (i < 8 && Math.abs(x - f.x) < 120) continue;                // not right on top of him
    let clear = true;
    for (let h = 6; h <= hover + 14 && clear; h += 10) if (pointInSolid(st, x, g.y - h)) clear = false;
    if (!clear || groundBelow(st, x, g.y - hover, hover + 6) !== g) continue;   // must be the first floor under the coin
    m.spawn(new Coin(m, f, x, g, hover));
    return true;
  }
  return false;
}

// ---- the super: FULLY UPGRADED ---------------------------------------------
// Ten ticks that hold people in the beam, then one big shove out the far end.
const BEAM_H = 22;
class Beam extends Entity {
  constructor(m, f) {
    super({ owner: f, team: f.team, tag: 'beam', layer: 'front' });
    this.dir = f.facing; this.life = 78; this.last = new Map();
    this.place(f);
  }
  place(f) {
    const mz = (f.pts && f.pts.prop) || [38, -23];
    this.x = f.x + this.dir * (mz[0] + 3) * f.scale; this.y = f.y + (mz[1] - 1) * f.scale;
  }
  update(m) {
    this.t++;
    const f = this.owner, t = this.t;
    if (f.out || f.state !== 'move' || f.moveId !== 'super' || t > this.life + 9) { this.dead = true; return; }
    this.place(f);
    if (t > this.life) return;                                   // just fading out now
    const b = m.stage.blast, far = this.dir > 0 ? b.r + 300 : b.l - 300;
    const R = [{ x: Math.min(this.x, far), y: this.y - BEAM_H, w: Math.abs(far - this.x), h: BEAM_H * 2 }];
    const tick = t >= 4 && t < 70 && (t - 4) % 7 === 0, fin = t === this.life - 2;
    for (const v of m.fighters) {
      if (v === f || v.out || v.team === f.team || v.state === 'dead' || v.state === 'respawn' || v.state === 'trapped' || v.intangible || v.superActive) continue;
      if (!m.overlap(R, v.hurtboxes())) continue;
      if (v.state === 'hitstun' && this.last.get(v) > m.frame - 10) { v.vy = 0; v.ky = clamp((this.y - v.cy) * 0.3, -3, 3); }
      if (tick && m.blast(f, v, { dmg: 2.5, ang: 6, set: 15, dir: this.dir, unblockable: true, hl: 0.4, stun: 3, sfx: 'zap', fx: 'elec' })) {
        this.last.set(v, m.frame); m.fx.spark(v.x, v.cy, 3, GOLD);
      }
      if (fin && m.blast(f, v, { dmg: 12, ang: 36, bk: 56, kg: 120, dir: this.dir, unblockable: true, sfx: 'explosion', fx: 'fire' })) m.fx.burst(v.x, v.cy, 56, '#ffffff');
    }
    if (fin) { m.shake(11); m.sfx('explosion', { vol: 0.7 }); }
    else if (t % 9 === 1) m.sfx('laser', { vol: 0.5, rate: 0.55 + (t % 4) * 0.04 });
    if (t % 2 === 0) m.shake(2.5);
  }
  draw(ctx, m) {
    const t = this.t, d = this.dir, v = m.cam.view(), pal = this.owner.pal, x0 = this.x, y = this.y;
    const x1 = d > 0 ? v.r + 90 : v.l - 90;
    if ((x1 - x0) * d <= 0) return;
    const grow = clamp(t / 4, 0.25, 1) * clamp((this.life + 9 - t) / 9, 0, 1);
    const th = (25 + Math.sin(t * 1.3) * 2.6) * grow;
    const band = (h, col) => { ctx.fillStyle = col; ctx.fillRect(Math.min(x0, x1), y - h, Math.abs(x1 - x0), h * 2); ctx.beginPath(); ctx.arc(x0, y, h, 0, TAU); ctx.fill(); };
    band(th + LW * Math.min(1, th / 8), OUT); band(th, pal.beam); band(th * 0.66, lighten(pal.beam, 0.5)); band(th * 0.34, '#ffffff');
    // streaks, and loose change riding along with it
    for (let i = 0; i < 7; i++) {
      const sx = x0 + d * ((i * 211 + t * 38) % 1100), sy = y + (((i * 37) % 17) / 8 - 1) * th * 0.8;
      line(ctx, sx, sy, sx + d * 44, sy, '#ffffff', 2);
    }
    for (let i = 0; i < 6; i++) {
      const cx = x0 + d * (20 + (i * 173 + t * 21) % 1000), cy = y + Math.sin(i * 2.4 + t * 0.21) * th * 0.6;
      ellipse(ctx, cx, cy, (1.2 + Math.abs(Math.cos(t * 0.3 + i)) * 4.4) * grow, 5.6 * grow, GOLD, OUT, 1.5);
    }
    star(ctx, x0, y, (th + 13) * (0.9 + (t % 3) * 0.08), th * 0.55, 8, '#ffffff', pal.beam, 2.4, t * 0.4);
  }
}

// ---- helpers for the specials -------------------------------------------------
function drawBolt(ctx, p) {
  const c = p.owner ? p.owner.pal.beam : '#ff5a3a', d = p.facing;
  limb(ctx, [p.x - d * 9, p.y, p.x + d * 5, p.y], 4.4, c, OUT, 1.8);
  line(ctx, p.x - d * 6, p.y, p.x + d * 4, p.y, '#ffffff', 1.8);
}
function fire(f, m) {
  f.v.shots = (f.v.shots || 0) + 1;
  shoot(f, m, { tag: 'bolt', x: 40, y: 31, vx: 12.5, r: 6, life: 28, drawFn: drawBolt,
    hit: { dmg: 3, ang: 361, bk: 5, kg: 8, hl: 0.5, sfx: 'tink' },
    onDie: (p, m2) => { m2.fx.spark(p.x, p.y, 2, '#ffffff'); } });
  m.sfx('laser', { vol: 0.55, rate: 1 + f.v.shots * 0.08 });
}
// Piggyback: whoever the first hit caught is carried up on his fist
function carry(f, m, fr) {
  const v = f.v.piggy;
  if (!v) return;
  if (v.out || v.state !== 'hitstun' || fr > 24) { f.v.piggy = null; return; }
  if (fr === 24) {
    f.v.piggy = null;
    m.blast(f, v, { dmg: 7, ang: 62, bk: 52, kg: 88, dir: f.facing, sfx: 'hitL' });
    return;
  }
  v.vx = v.vy = 0;
  v.kx = clamp(f.x + f.facing * 10 - v.x, -14, 14); v.ky = clamp(f.y - 50 - v.y, -18, 18);
}

// ---- the moveset ---------------------------------------------------------------
const KNEEL = { by: 9, lean: 0.06, hR: at(21, 22), prop: 0, hL: at(15, 19), fR: at(10, 0), fL: at(-13, 0), hx: 1 };
const RUSH = { by: 5, lean: 0.5, hR: at(8, 12), hL: at(-12, 27), fR: at(13, 0), fL: at(-13, 2) };
const moves = {
  jab: {
    frames: 16, sfx: { 2: 'swishS' },
    pose: K([0, {}], [2, { hR: at(5, 27), lean: 0.02 }], [4, { hR: at(26, 28), lean: 0.16, hL: at(-10, 22) }, 'out'], [8, { hR: at(22, 28), lean: 0.12 }], [16, {}]),
    hits: [hit([3, 5], 'hR', 10, 2, 78, 8, 20, { sfx: 'hitS' })],
    cancel: [{ to: 'jab2', f: [6, 14], on: 'attack' }],
  },
  jab2: {
    frames: 18, sfx: { 2: 'swishS' },
    pose: K([0, { hR: at(22, 28), lean: 0.12 }], [2, { hR: at(8, 26), hL: at(2, 26), lean: 0.14 }], [4, { hR: at(6, 24), hL: at(25, 28), lean: 0.32, ox: 2 }, 'out'], [8, { hR: at(8, 24), hL: at(20, 28), lean: 0.26, ox: 2 }], [18, {}]),
    hits: [hit([3, 5], 'hL', 10, 2, 78, 10, 20, { sfx: 'hitS' })],
    cancel: [{ to: 'jab3', f: [6, 15], on: 'attack' }],
  },
  jab3: {
    frames: 24, sfx: { 3: 'swishM' },
    pose: K([0, { hR: at(8, 24), hL: at(20, 28), lean: 0.26 }], [3, { hR: at(-6, 30), hL: at(6, 24), lean: -0.12, by: 2 }], [6, { hR: at(27, 30), lean: 0.34, by: 3, ox: 4, fR: at(12, 0) }, 'in'], [11, { hR: at(22, 24), lean: 0.3, by: 3, ox: 4, fR: at(12, 0) }], [24, {}]),
    hits: [hit([5, 8], 'hR', 12, 5, 48, 30, 72, { sfx: 'hitM' })],
  },
  ftilt: {
    frames: 27, sfx: { 5: 'swishM' },
    pose: K([0, {}], [4, { hR: at(-3, 28), hL: at(10, 24), lean: -0.12 }], [7, { hR: at(28, 27), hL: at(-12, 24), lean: 0.28, ox: 3, fR: at(12, 0) }, 'in'], [12, { hR: at(25, 27), hL: at(-12, 24), lean: 0.24, ox: 3, fR: at(12, 0) }], [27, {}]),
    hits: [hit([6, 9], 'hR', 11, 8, 361, 22, 92, { to: 'eR', sfx: 'hitM' })],
  },
  utilt: {   // a little hop and a helmet-first headbutt
    frames: 27, sfx: { 4: 'swishS' },
    pose: K([0, {}], [3, { by: 7, lean: 0.16, hR: at(10, 14), hL: at(-10, 14), hy: -1 }], [7, { oy: -9, lean: -0.04, hR: at(12, 16), hL: at(-12, 16), hy: 3, sy: 1.07 }, 'out'], [12, { oy: -3, hR: at(12, 18), hL: at(-12, 18), hy: 1 }], [27, {}]),
    hits: [hit([5, 9], 'head', 14, 7, 88, 30, 100, { off: [1, -9], sfx: 'clang' })],
  },
  dtilt: {
    frames: 24, sfx: { 4: 'swishS' },
    pose: K([0, { by: 8, lean: 0.1 }], [3, { by: 9, lean: -0.1, fR: at(6, 4), hR: at(8, 16), hL: at(-13, 8) }], [6, { by: 9, lean: -0.3, fR: at(21, 3), hR: at(4, 18), hL: at(-15, 6) }, 'out'], [11, { by: 9, lean: -0.26, fR: at(19, 3), hR: at(4, 18), hL: at(-15, 6) }], [24, { by: 5 }]),
    hits: [hit([5, 8], 'fR', 10, 6, 72, 24, 70, { to: 'kR' })],
  },
  dash: {   // drop-kick
    frames: 38, fric: 0.3, sfx: { 4: 'swishM' }, vel: [[0, 7.4, null]],
    pose: K([0, { lean: 0.3 }], [5, { rot: -1.2, oy: 7, fR: at(6, -3), fL: at(0, -3), hR: at(14, 34), hL: at(-14, 34) }, 'out'], [15, { rot: -1.25, oy: 8, fR: at(6, -3), fL: at(0, -3), hR: at(14, 36), hL: at(-14, 36) }], [24, { rot: -1.5, oy: 18, fR: at(8, 2), fL: at(-2, 2), hR: at(12, 30), hL: at(-12, 30), face: 5 }, 'in'], [38, { by: 6 }]),
    hits: [hit([5, 10], 'fR', 12, 10, 56, 56, 62, { sfx: 'hitM' }), hit([11, 17], 'fR', 11, 7, 60, 40, 50)],
    events: { 24: (f, m) => { m.fx.dust(f.x, f.y, 3); m.sfx('thud', { vol: 0.5 }); } },
  },
  fsmash: {   // the haymaker
    frames: 52, charge: { at: 9, max: 60 }, sfx: { 14: 'swishL' },
    pose: K([0, {}], [8, { hR: at(-15, 33), hL: at(12, 26), lean: -0.32, by: 2, fR: at(9, 3), hx: -1 }], [9, { hR: at(-15, 33), hL: at(12, 26), lean: -0.32, by: 2, fR: at(9, 3), hx: -1 }],
      [17, { hR: at(30, 26), hL: at(-14, 22), lean: 0.44, by: 4, ox: 5, fR: at(14, 0), fL: at(-12, 0), sy: 0.97 }, 'in3'], [25, { hR: at(22, 15), hL: at(-14, 22), lean: 0.4, by: 4, ox: 5, fR: at(14, 0), fL: at(-12, 0) }], [52, {}]),
    hits: [hit([16, 20], 'hR', 13, 18, 42, 32, 102, { to: 'eR', sfx: 'hitL' })],
    events: { 17: (f, m) => { m.fx.dust(f.x + f.facing * 16, f.y, 3); } },
  },
  usmash: {   // leaping uppercut
    frames: 46, charge: { at: 6, max: 60 }, sfx: { 9: 'swishL' },
    pose: K([0, {}], [5, { by: 9, lean: 0.2, hR: at(14, 8), hL: at(-12, 14) }], [6, { by: 9, lean: 0.2, hR: at(14, 8), hL: at(-12, 14) }],
      [12, { oy: -15, hR: at(10, 51), hL: at(-10, 16), lean: -0.06, sy: 1.08, fR: at(6, 3), fL: at(-6, 0) }, 'in'], [18, { oy: -11, hR: at(4, 50), hL: at(-10, 18), lean: -0.1, fR: at(6, 5), fL: at(-6, 1) }], [30, { oy: 0, by: 5 }, 'in'], [46, {}]),
    hits: [hit([10, 15], 'hR', 13, 14, 88, 34, 104, { to: 'eR', sfx: 'hitL' })],
    events: { 30: (f, m) => { m.fx.dust(f.x, f.y, 2); } },
  },
  dsmash: {   // split kick, front then back
    frames: 46, charge: { at: 5, max: 60 }, sfx: { 7: 'swishM', 13: 'swishM' },
    pose: K([0, {}], [4, { by: 8, lean: 0.1, hR: at(8, 14), hL: at(-8, 14) }], [5, { by: 8, lean: 0.1, hR: at(8, 14), hL: at(-8, 14) }],
      [9, { by: 10, lean: -0.34, fR: at(22, 4), hR: at(-6, 6), hL: at(-16, 8) }, 'in'], [15, { by: 10, lean: 0.4, fL: at(-22, 4), fR: at(8, 0), hR: at(16, 6), hL: at(6, 8) }, 'io'], [21, { by: 10, lean: 0.36, fL: at(-20, 4), fR: at(8, 0), hR: at(16, 6), hL: at(6, 8) }], [46, {}]),
    hits: [hit([8, 10], 'fR', 12, 13, 30, 36, 86, { to: 'kR', sfx: 'hitM' }), hit([14, 17], 'fL', 12, 12, 30, 36, 86, { rev: true, group: 1, sfx: 'hitM' })],
  },
  nair: air({   // cape twirl
    frames: 40, sfx: { 3: 'swishM', 14: 'swishS' },
    pose: K([0, { rot: 0 }], [4, { rot: 0, hR: at(21, 30), hL: at(-19, 30), fR: at(13, 5), fL: at(-13, 7) }], [24, { rot: TAU, hR: at(21, 30), hL: at(-19, 30), fR: at(13, 5), fL: at(-13, 7) }, 'lin'], [40, { rot: TAU }]),
    hits: [hit([4, 12], 'body', 21, 9, 361, 18, 85), hit([13, 23], 'body', 19, 5, 361, 14, 70, { group: 1 })],
  }, 10, [4, 30]),
  fair: air({   // the knee: all the power is right at the start
    frames: 38, sfx: { 6: 'swishM' }, vel: [[6, 5.2, null]],
    pose: K([0, {}], [5, { rot: 0.2, fR: at(2, 4), hR: at(8, 40), hL: at(-14, 26), lean: 0.1 }], [8, { rot: -0.42, ox: 4, fR: at(11, 4), fL: at(-9, -2), hR: at(-4, 34), hL: at(-15, 24), lean: -0.1 }, 'in'], [18, { rot: -0.36, ox: 3, fR: at(11, 4), fL: at(-9, -2), hR: at(-4, 34), hL: at(-15, 24), lean: -0.1 }], [38, {}]),
    hits: [hit([7, 9], 'kR', 12, 13, 361, 28, 98, { hl: 1.3, sfx: 'hitL' }), hit([10, 18], 'kR', 10, 6, 361, 14, 60)],
  }, 12, [5, 28]),
  bair: air({
    frames: 34, sfx: { 6: 'swishM' },
    pose: K([0, {}], [5, { lean: 0.1, fL: at(0, 8), hR: at(12, 30) }], [8, { lean: 0.42, fL: at(-20, 15), fR: at(8, 8), hR: at(18, 26), hL: at(4, 22) }, 'in'], [13, { lean: 0.38, fL: at(-19, 15), fR: at(8, 8), hR: at(18, 26), hL: at(4, 22) }], [34, {}]),
    hits: [hit([7, 11], 'fL', 12, 11, 361, 26, 95, { rev: true, sfx: 'hitM' })],
  }, 11, [5, 24]),
  uair: air({   // flip kick
    frames: 34, sfx: { 4: 'swishM' },
    pose: K([0, { rot: 0 }], [3, { rot: -0.4, fR: at(6, 0), fL: at(-2, 2) }], [14, { rot: -TAU + 0.6, fR: at(5, -3), fL: at(-3, 4), hR: at(12, 28), hL: at(-12, 28) }, 'out'], [22, { rot: -TAU }], [34, { rot: -TAU }]),
    hits: [hit([5, 11], 'fR', 13, 9, 84, 26, 96)],
  }, 10, [4, 24]),
  dair: air({   // two-boot stomp
    frames: 46, sfx: { 11: 'swishM' },
    pose: K([0, {}], [8, { fR: at(6, 12), fL: at(-5, 11), hR: at(12, 40), hL: at(-12, 40), sy: 0.94 }], [13, { fR: at(4, -5), fL: at(-4, -5), hR: at(14, 42), hL: at(-14, 42), sy: 1.07 }, 'in'], [26, { fR: at(4, -4), fL: at(-4, -4), hR: at(14, 42), hL: at(-14, 42) }], [46, {}]),
    hits: [hit([13, 16], [0, -2], 13, 12, 270, 20, 84, { sfx: 'hitL' }), hit([17, 26], [0, -2], 12, 8, 60, 20, 60, { group: 1 })],
  }, 20, [8, 34]),

  // --- specials ---
  nspecial: {   // toy ray gun: tap for up to three bolts
    kind: 'special', frames: 30, drift: 0.8,
    can: (f, m) => countMine(f, m, 'bolt') < 3,
    start: (f, m) => { f.v.shots = 0; f.v.aiShots = f.isCPU ? m.rng.int(1, 3) : 0; },
    pose: K([0, {}], [4, { hR: at(22, 30), hL: at(-8, 22), prop: 0.05, lean: 0.02 }], [6, { hR: at(19, 32), hL: at(-8, 22), prop: -0.3, lean: -0.04 }, 'out'], [11, { hR: at(22, 30), hL: at(-8, 22), prop: 0, lean: 0.02 }], [21, { hR: at(22, 30), hL: at(-8, 22), prop: 0, lean: 0.02 }], [30, {}]),
    tick: (f, m, fr) => {
      if (fr === 5) fire(f, m);
      if (fr >= 12 && fr <= 20 && f.v.shots < 3 && (f.pressed('special', 8) || f.v.shots < f.v.aiShots) && countMine(f, m, 'bolt') < 3) { f.eat('special'); f.mf = 3; }
    },
  },
  sspecial: {   // Savings Rush: a low dash; if it connects he goes straight into the uppercut
    kind: 'special', frames: 56, airOK: true, drift: 0, grav: 0.2, sfx: { 8: 'dash' },
    can: (f) => f.grounded || !f.v.rushUsed,
    start: (f) => { f.v.rushHit = false; if (!f.grounded) f.v.rushUsed = true; },
    tick: (f, m, fr) => {
      if (f.v.rushHit) { f.v.rushHit = false; f.startMove('sspecial_up', true); return; }
      if (fr >= 9 && fr <= 20) { f.vx = f.facing * 9.2; if (fr % 3 === 0 && f.grounded) m.fx.dust(f.x - f.facing * 14, f.y, 1); }
      else if (fr > 20) f.vx *= 0.8;
    },
    pose: K([0, {}], [6, { by: 7, lean: 0.3, hR: at(-4, 16), hL: at(8, 22) }], [9, RUSH, 'in'], [21, RUSH], [30, { by: 4, lean: 0.24, hR: at(14, 14), hL: at(-10, 22) }], [56, {}]),
    hits: [box([9, 21], [20, 22], 32, 36, 4, 86, 0, 0, { set: 56, sfx: 'hitM', onHit: (o) => { if (o) o.v.rushHit = true; } })],
  },
  sspecial_up: {
    kind: 'special', frames: 40, airOK: true, slideOff: true, drift: 0.5, base: 'air', iasa: 24, vel: [[5, 2.4, -10.6]], sfx: { 2: 'swishL' },
    pose: K([0, { by: 6, lean: 0.4, hR: at(8, 10), hL: at(-12, 24), fR: at(9, 0), fL: at(-9, 0) }], [4, { hR: at(14, 50), hL: at(-10, 18), lean: -0.06, sy: 1.08, fR: at(5, 3), fL: at(-6, 0) }, 'in'], [18, { hR: at(9, 50), hL: at(-10, 20), lean: -0.1, fR: at(6, 6), fL: at(-6, 2) }], [40, {}]),
    hits: [hit([2, 7], 'hR', 14, 6, 84, 0, 0, { set: 98, to: 'eR', sfx: 'hitL' })],
  },
  uspecial: {   // Piggyback: scoops up whoever is in front and carries them to the top
    kind: 'special', frames: 46, helpless: true, drift: 0.7, ledgeOK: 20, airOK: true, slideOff: true, base: 'air',
    vel: [[6, 1.8, -13.6]], sfx: { 5: 'swishL' },
    start: (f) => { f.v.piggy = null; },
    exit: (f) => { f.v.piggy = null; },
    tick: carry,
    pose: K([0, { by: 0, fR: at(8, 0), fL: at(-8, 0) }], [5, { by: 8, lean: 0.24, hR: at(14, 8), hL: at(-12, 12), fR: at(8, 0), fL: at(-8, 0) }], [8, { hR: at(12, 50), hL: at(-9, 16), lean: -0.04, sy: 1.08, fR: at(5, 2), fL: at(-6, 0) }, 'out'], [26, { hR: at(11, 50), hL: at(-9, 18), lean: -0.06, fR: at(6, 6), fL: at(-6, 2) }], [46, { hR: at(14, 38), hL: at(-13, 36) }]),
    hits: [hit([6, 11], [15, 30], 15, 3, 88, 0, 0, { set: 62, stun: 8, sfx: 'hitM', onHit: (o, t) => { if (o && !o.v.piggy) o.v.piggy = t; } }),
      hit([12, 23], 'hR', 12, 6, 78, 44, 70, { to: 'eR' })],
  },
  dspecial: {   // Stomp Rocket, ground version: a slide kick that pops people up
    kind: 'special', frames: 36, fric: 0.5, vel: [[5, 8.4, null]], sfx: { 5: 'slide' },
    tick: (f, m, fr) => { if (fr > 5 && fr < 20 && fr % 4 === 0) m.fx.dust(f.x - f.facing * 6, f.y, 1); },
    pose: K([0, {}], [4, { by: 9, lean: -0.16, hR: at(10, 18), hL: at(-12, 10) }], [7, { by: 12, lean: -0.6, oy: 1, fR: at(21, 3), fL: at(9, 0), hR: at(-2, 14), hL: at(-17, 4) }, 'out'], [20, { by: 12, lean: -0.6, oy: 1, fR: at(21, 3), fL: at(9, 0), hR: at(-2, 14), hL: at(-17, 4) }], [36, { by: 4 }]),
    hits: [hit([6, 17], 'fR', 11, 7, 70, 46, 44, { to: 'kR', sfx: 'hitM' })],
  },
  dspecial_air: {   // Stomp Rocket: a diving kick that springs off whoever it hits
    kind: 'special', frames: 50, drift: 0, grav: 0, fallCap: 14, base: 'air', sfx: { 9: 'rocket' },
    start: (f) => { f.v.bounce = false; },
    vel: [[0, 0.5, -2.4], [10, 6.4, 12.5]],
    tick: (f, m, fr) => {
      if (fr < 10) f.vy += 0.25;
      if (f.v.bounce) { f.v.bounce = false; f.vy = -9.4; f.vx = -f.facing * 1.6; f.setState('air'); m.sfx('boing', { vol: 0.5 }); return; }
      if (fr >= 10 && fr % 3 === 0) m.fx.smoke(f.x - f.facing * 14, f.y - 34, '#efe6d2', 6);
    },
    pose: K([0, {}], [8, { rot: 0.2, fR: at(4, 12), fL: at(-4, 10), hR: at(12, 42), hL: at(-12, 40) }], [11, { rot: -0.5, fR: at(8, -4), fL: at(-6, 8), hR: at(6, 40), hL: at(-16, 34), sy: 1.05 }, 'in'], [50, { rot: -0.5, fR: at(8, -4), fL: at(-6, 8), hR: at(6, 40), hL: at(-16, 34) }]),
    hits: [hit([10, 48], 'fR', 12, 9, 56, 34, 66, { sfx: 'hitM', onHit: (o) => { if (o) o.v.bounce = true; } })],
    onLand: (f, m) => { m.fx.dust(f.x, f.y, 5); m.sfx('thud', { vol: 0.6 }); f.setState('land', f.mf >= 10 ? 15 : 6); return false; },
  },

  // --- grab + throws ---
  grab: stdGrab(K([0, {}], [6, { hL: at(24, 26), hR: at(18, 24), lean: 0.3 }, 'out'], [12, { hL: at(22, 25), hR: at(17, 24), lean: 0.26 }], [30, {}]), 27, { h: 28 }),
  ...stdThrows({
    f: { dmg: 8, bk: 58, kg: 64, f: 12, frames: 30, pose: K([0, { hL: at(22, 25) }], [8, { hL: at(20, 25), hR: at(-9, 30), lean: -0.16 }], [12, { hL: at(14, 24), hR: at(28, 27), lean: 0.32, ox: 3 }, 'in'], [30, {}]) },
    b: { dmg: 9, bk: 60, kg: 80, f: 14, frames: 34, pose: K([0, { hL: at(22, 25) }], [8, { hL: at(8, 45), hR: at(4, 47), lean: -0.1 }], [14, { hL: at(-18, 30), hR: at(-14, 34), lean: -0.36 }, 'in'], [34, {}]) },
    u: { dmg: 8, bk: 64, kg: 70, f: 12, frames: 32, sfx: 'clang', pose: K([0, { hL: at(22, 25) }], [7, { by: 8, hL: at(16, 20), hR: at(13, 18), lean: 0.2 }], [12, { oy: -7, hL: at(8, 30), hR: at(12, 30), hy: 3, sy: 1.06 }, 'in'], [32, {}]) },
    d: { dmg: 7, bk: 54, kg: 44, f: 14, frames: 34, sfx: 'thud', pose: K([0, { hL: at(22, 25) }], [8, { hL: at(16, 40), hR: at(12, 42), lean: -0.1 }], [14, { hL: at(18, 8), hR: at(21, 10), by: 9, lean: 0.36 }, 'in'], [34, {}]) },
  }),
  getup: {
    frames: 34, invuln: [[0, 12]], sfx: { 9: 'swishM' },
    pose: K([0, { by: 12, lean: 0.2 }], [10, { by: 10, lean: -0.3, fR: at(21, 4), hR: at(-4, 8), hL: at(-15, 8) }], [16, { by: 10, lean: 0.4, fL: at(-21, 4), fR: at(8, 0), hR: at(16, 6), hL: at(6, 8) }, 'io'], [34, {}]),
    hits: [hit([9, 12], 'fR', 12, 6, 50, 40, 50), hit([15, 18], 'fL', 12, 6, 50, 40, 50, { rev: true, group: 1 })],
  },
  taunt: stdTaunt({ hR: at(10, 17), hL: at(-10, 17), lean: -0.12, hy: 1, ht: -0.1, face: 3 }, 70, 'powerup'),

  // --- the super: FULLY UPGRADED ---
  super: {
    kind: 'super', frames: 128, base: 'ground', grav: 0, drift: 0, sfx: { 4: 'charge' },
    pose: K([0, {}], [9, { by: 3, hR: at(2, 38), prop: -1.4, hL: at(-10, 22), lean: -0.12 }], [17, KNEEL, 'in'], [106, KNEEL], [114, { by: 6, hR: at(16, 32), prop: -1.1, hL: at(-8, 20) }], [128, {}]),
    tick: (f) => { f.vx = 0; if (!f.grounded) f.vy = 0; },
    events: { 19: (f, m) => { m.spawn(new Beam(m, f)); m.sfx('laser', { rate: 0.5 }); m.shake(8); } },
  },
};

export default {
  id: 'allowance', name: 'CAPT. ALLOWANCE', from: 'Upgrade Day', superName: 'Fully Upgraded',
  blurb: 'Self-appointed hero of second recess. Fast fists, a toy ray gun, and three coins away from a much bigger one.',
  stats: { weight: 98, walk: 2.7, dash: 6.6, run: 6.2, traction: 0.5, jump: 12.4, hop: 7.2, djump: 10.6, gravity: 0.43, fall: 8.2, fastFall: 12, airSpeed: 3.9, airAccel: 0.3, w: 30, h: 60 },
  portrait: { x: 3, y: -46, s: 1.1 },
  costumes: costumes(BASE, [
    ['Recess Hero', {}],
    ['Night Light', { main: '#3d6fd0', towel: '#2c3f8f', towel2: '#ffe45c', shirt: '#8fc4ff', pants: '#8fc4ff', leg: '#8fc4ff', helm: '#e3dcf2', gog: '#ffb81c', lens: '#fff6c9', strap: '#8a5a12', glove: '#f6c9a0', boot: '#f58aa8', gun: '#f2b81c', gun2: '#fffbd0', beam: '#ffd92e', gunKind: 1 }],
    ['Gold Edition', { main: '#f2b81c', towel: '#f2b81c', towel2: '#ffffff', shirt: '#ffe45c', pants: '#e0a012', helm: '#ffd86a', gog: '#ffffff', lens: '#bfe6ff', strap: '#a86a00', glove: '#ffffff', boot: '#e8402a', card: '#fff1c2', gun: '#ffffff', gun2: '#f2b81c', beam: '#ffb81c' }],
    ['Evil Twin', { main: '#8a3fc7', towel: '#6a2fa6', towel2: '#1d1611', shirt: '#2f2838', pants: '#201b29', hair: '#1d1611', helm: '#7d788c', gog: '#e8402a', lens: '#ffc2b8', strap: '#1d1611', glove: '#454a63', boot: '#454a63', card: '#b98a4e', gun: '#8a3fc7', gun2: '#56d06a', beam: '#b45cff', stache: 1 }],
  ]),
  pose: rig.pose, points: rig.points, draw: rig.draw,
  moves,
  hooks: {
    init(f, m) { f.v.coins = 0; f.v.coinT = m ? m.rng.int(300, 460) : 400; f.v.rushUsed = false; },
    postUpdate(f, m) {
      if (f.grounded || f.state === 'ledge') f.v.rushUsed = false;
      if (m.state !== 'fight' || f.state === 'dead') return;
      if (f.v.coins >= 3 && !f.superReady && !f.superActive) {      // three coins buy the upgrade
        f.v.coins = 0; f.superReady = true; f.flash = 14; f.flashColor = '#fff3a0';
        m.sfx('cash'); m.fx.word(f.x, f.y - f.h - 30, 'UPGRADE!', { color: GOLD, size: 26, life: 60 });
      }
      if (f.v.coins < 3 && !f.superReady && !f.superActive && --f.v.coinT <= 0) {
        f.v.coinT = countMine(f, m, 'coin') < 2 && spawnCoin(f, m) ? m.rng.int(420, 600) : 60;
      }
    },
    onKO(f) { f.v.coins = 0; },
    // CPU: when nobody is in his face, wander over and pick up a nearby coin
    ai(f, m, cpu) {
      if (f.superReady || cpu.q.length || !['idle', 'walk', 'dash', 'run', 'brake', 'air'].includes(f.state)) return false;
      if (!f.grounded && !groundBelow(m.stage, f.x, f.y - 4, 900)) return false;
      if (m.foes(f).some((o) => Math.abs(o.x - f.x) < 150 && Math.abs(o.y - f.y) < 120)) return false;
      let best = null;
      for (const e of m.entities) if (e.tag === 'coin' && e.owner === f && !e.dead && Math.abs(e.x - f.x) < 300 && (!best || Math.abs(e.x - f.x) < Math.abs(best.x - f.x))) best = e;
      if (!best) return false;
      cpu.chase(f, m, best.x, best.y, false);
      return true;
    },
    drawHud(ctx, f, x, y) {
      for (let i = 0; i < 3; i++) {
        const cx = x + 30 + i * 16, cy = y - 9;
        if (i < (f.v.coins || 0)) { circle(ctx, cx, cy, 6.4, GOLD, OUT, 2); circle(ctx, cx, cy, 3.4, null, '#d99a12', 1.3); }
        else circle(ctx, cx, cy, 6.4, 'rgba(29,22,17,0.4)', OUT, 2);
      }
    },
  },
  ai: {
    nspecial: { range: [130, 330], dy: 30, w: 0.5 },
    sspecial: { range: [46, 140], dy: 40, w: 0.9 },
    super: { range: 440, dy: 34 },
    recovery: { up: 205, side: 150 },
  },
};
