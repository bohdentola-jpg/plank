// HONK - slot 13 of the roster.
// Brief: a vehicle with no fists. It charges through players, and has a
// charge-up attack where it sits and revs and then blasts through the enemy.
// Super: every opponent gets sucked inside as passengers and it drives off the
// side of the map with them.
//
// A stubby yellow school bus: eyes on the windscreen, a grille for a mouth, a
// fold-out STOP sign and a tiny exhaust pipe. Custom rig (no arms or legs).

import { customPose } from '../game/rig.js';
import { K, hit, box, air, stdThrows, countMine, costumes } from '../game/movekit.js';
import { Entity } from '../game/entities.js';
import { groundBelow } from '../game/physics.js';
import { drawPortrait } from '../game/render.js';
import { OUT, LW, circle, ellipse, blob, rrect, polygon, limb, line, fs, eyes, mouth, darken } from '../core/gfx.js';
import { TAU, clamp, approach, sign } from '../core/util.js';

const BASE = {
  main: '#ffd23a', body: '#ffd23a', trim: '#1d1611', bump: '#30303a', glass: '#bfe6ff', stopc: '#e8402a', light: '#fff7b0',
  roofl: '#e8402a', hub: '#c9d2dc', stripe: 0, glow: 0, daisy: 0,
};

// pose: squash (sx, sy), tilt (rot), slide (ox, oy), face, plus the bus's own
// parts: stop (sign arm 0..1), doors (0..1), hood (0..1), lights (roof flashers)
const STANCE = { sx: 1, sy: 1, rot: 0, ox: 0, oy: 0, face: 0, stop: 0, doors: 0, hood: 0, lights: 0, _auto: { lean: 0.03 } };
const AX = -8, CY = -22;        // axle line (the body squashes down onto it) and the pivot for tilts
const DOOR = [-5, -22];         // middle of the door, body space

function pose(f) {
  return customPose(f, STANCE, (ff, p) => {
    if (ff.state === 'grabhold') p.rot = -0.08;
    else if (ff.state === 'ledge') p.rot = -0.5;
    else if (ff.state === 'win') p.lights = 1;
    else if (ff.state === 'idle') p.oy += Math.sin(ff.t * 0.8) * 0.35;      // engine idling
  });
}

// body space -> fighter space
function xf(p, x, y) {
  x *= p.sx; y = AX + (y - AX) * p.sy;
  if (p.rot) { const c = Math.cos(p.rot), s = Math.sin(p.rot), dy = y - CY, nx = x * c - dy * s; y = x * s + dy * c + CY; x = nx; }
  return [x + p.ox, y + p.oy];
}
const signAt = (p) => { const a = Math.PI * (1 - p.stop), len = 8.5 + p.stop * 40; return [-10.5 + Math.cos(a) * len, -24.5 - Math.sin(a) * len * 0.6]; };
const hoodAng = (p) => -0.17 + p.hood * 1.3;

function points(f, p) {
  const s = signAt(p), a = hoodAng(p);
  return {
    body: xf(p, 0, -24), front: xf(p, 28, -18), scoop: xf(p, 31, -10), back: xf(p, -28, -18), roof: xf(p, -8, -40), under: xf(p, 0, -6),
    sign: xf(p, s[0], s[1]), hood: xf(p, 17.5 + Math.cos(a) * 13, -31 - Math.sin(a) * 13), exhaust: xf(p, -37, -12), door: xf(p, DOOR[0], DOOR[1]),
    grab: xf(p, 31, -27),
  };
}

function bodyPath(ctx) {
  ctx.beginPath(); ctx.moveTo(-29, -10); ctx.lineTo(-29, -38); ctx.quadraticCurveTo(-29, -43, -24, -43); ctx.lineTo(9, -43);
  ctx.quadraticCurveTo(12, -43, 13, -40.5); ctx.lineTo(17.5, -29); ctx.lineTo(25.5, -27.6); ctx.quadraticCurveTo(28.5, -27, 28.5, -23.5);
  ctx.lineTo(28.5, -10); ctx.closePath();
}
const WINDOWS = [[-18.4, -39.8, 7.6, 10.5], [-27.2, -39.8, 7.6, 10.5], [-8.3, -38.6, 6.4, 10.5]];   // the last one is the door's glass

function draw(ctx, f, p) {
  const pal = f.drawPal || f.pal, ex = p.face, v = f.v || {}, t = f.t || 0;
  const roll = v.roll !== undefined ? v.roll : (f.state === 'walk' || f.state === 'run' || f.state === 'dash' ? t * 0.4 : 0);
  ctx.save();
  ctx.translate(p.ox, p.oy);
  if (p.rot) { ctx.translate(0, CY); ctx.rotate(p.rot); ctx.translate(0, -CY); }
  ctx.save();
  ctx.translate(0, AX); ctx.scale(p.sx, p.sy); ctx.translate(0, -AX);
  limb(ctx, [-27, -11, -33.5, -10], 2.6, '#8d96a6', OUT, 1.8);                              // exhaust pipe
  const blink = p.lights && t % 8 < 4;
  rrect(ctx, -23, -45.8, 5.4, 4, 1.4, p.lights ? (blink ? '#ff5a3a' : '#ffe45c') : pal.roofl, OUT, 1.8);
  rrect(ctx, 2, -45.8, 5.4, 4, 1.4, p.lights ? (blink ? '#ffe45c' : '#ff5a3a') : pal.roofl, OUT, 1.8);
  if (pal.daisy) {                                                                           // parade float: a big daisy on the roof
    line(ctx, -12, -43, -12, -49, '#35a84a', 2.2);
    for (let i = 0; i < 7; i++) { const a = (i / 7) * TAU + 0.2; ellipse(ctx, -12 + Math.cos(a) * 4.2, -52 + Math.sin(a) * 4.2, 2.6, 2.6, '#ffffff', OUT, 1.3); }
    circle(ctx, -12, -52, 2.5, '#ffd23a', OUT, 1.3);
  }
  bodyPath(ctx); fs(ctx, pal.body, OUT, LW);
  ctx.save(); bodyPath(ctx); ctx.clip();
  if (pal.stripe) { ctx.fillStyle = pal.stripe; ctx.fillRect(-30, -27.4, 60, 5.4); }
  ctx.fillStyle = 'rgba(0,0,0,0.1)'; ctx.fillRect(-30, -13.5, 60, 4);
  line(ctx, -30, -21, 15.5, -21, pal.trim, 1.5);
  ctx.restore();
  bodyPath(ctx); ctx.strokeStyle = OUT; ctx.lineWidth = LW; ctx.lineJoin = 'round'; ctx.stroke();
  // passenger windows, door, windscreen
  for (let i = 0; i < 2; i++) rrect(ctx, WINDOWS[i][0], WINDOWS[i][1], WINDOWS[i][2], WINDOWS[i][3], 1.6, pal.glass, OUT, 1.6);
  const d = p.doors;
  if (d > 0.03) {
    const lw = 4.4 * (1 - d * 0.72);
    rrect(ctx, -9.5, -39.8, 8.8, 28.3, 1.5, '#2b2233', OUT, 1.6);
    rrect(ctx, -9.5, -39.8, lw, 28.3, 1, darken(pal.body, 0.1), OUT, 1.3); rrect(ctx, -0.7 - lw, -39.8, lw, 28.3, 1, darken(pal.body, 0.1), OUT, 1.3);
  } else {
    rrect(ctx, -9.5, -39.8, 8.8, 28.3, 1.5, darken(pal.body, 0.08), OUT, 1.6);
    rrect(ctx, WINDOWS[2][0], WINDOWS[2][1], WINDOWS[2][2], WINDOWS[2][3], 1, pal.glass, OUT, 1.2);
    line(ctx, -5.1, -39.4, -5.1, -11.9, OUT, 1.1);
  }
  // anyone riding along looks out of the windows
  const pax = v.pax;
  if (pax) for (let i = 0; i < pax.length && i < 3; i++) {
    const w = WINDOWS[i];
    if (i === 2 && d > 0.03) break;
    drawPortrait(ctx, pax[i].def, pax[i].costume, w[0] + 0.6, w[1] + 0.6, w[2] - 1.2, w[3] - 1.2, { r: 1 });
  }
  polygon(ctx, [1, -40.5, 11, -40.5, 16, -29.6, 1, -29.6], pal.glass, OUT, 1.8);
  // hood lid (pops up for the up tilt)
  if (p.hood > 0.03) {
    const a = hoodAng(p), ex2 = 17.5 + Math.cos(a) * 9.5, ey2 = -29 - Math.sin(a) * 9.5;
    polygon(ctx, [17.5, -29, ex2, ey2, 26, -27.5], '#3a2d4a', OUT, 1.5);
    limb(ctx, [17.5, -29, ex2, ey2], 2.8, pal.body, OUT, 1.8);
  }
  // face: eyes on the windscreen, the grille is the mouth
  eyes(ctx, 7.4, -35, 3.9, 3.3, ex, ex === 6 ? 0 : 0.3, 0, { lw: 1.4, pr: 0.42, t });
  const mx = 21, my = -17.6;
  if (ex === 2 || ex === 6) mouth(ctx, mx, my, 7.5, 2, { lw: 1.5 });
  else if (ex === 3) mouth(ctx, mx, my - 1.2, 9.4, 3, { lw: 1.5 });
  else if (ex === 4) mouth(ctx, mx, my, 8, 4, { lw: 1.6 });
  else if (ex === 5) mouth(ctx, mx, my, 7, 5, { lw: 1.6 });
  else {
    rrect(ctx, mx - 4.4, my - 2.8, 8.8, ex === 1 ? 5 : 5.6, ex === 1 ? 1 : 2.6, '#eef3f8', OUT, 1.5);
    line(ctx, mx - 1.5, my - 2.6, mx - 1.5, my + 2.4, OUT, 1); line(ctx, mx + 1.5, my - 2.6, mx + 1.5, my + 2.4, OUT, 1);
  }
  circle(ctx, 25, -24.2, 2.2, pal.light, OUT, 1.4);                                         // headlight
  if (pal.glow) { line(ctx, 29.6, -26.4, 33, -28, pal.light, 1.5); line(ctx, 30.2, -24.2, 34, -24.2, pal.light, 1.5); line(ctx, 29.6, -22, 33, -20.4, pal.light, 1.5); }
  rrect(ctx, 25, -14.8, 7, 6.2, 2, pal.bump, OUT, 2); rrect(ctx, -32, -14.8, 6.6, 6.2, 2, pal.bump, OUT, 2);   // bumpers
  // the STOP sign on its arm
  const s = signAt(p);
  limb(ctx, [-10.5, -24.5, s[0], s[1]], 1.8, '#8d96a6', OUT, 1.5);
  const oct = [];
  for (let i = 0; i < 8; i++) { const a = (i + 0.5) * TAU / 8; oct.push(s[0] + Math.cos(a) * 5.6, s[1] + Math.sin(a) * 5.6); }
  polygon(ctx, oct, pal.stopc, OUT, 1.7);
  rrect(ctx, s[0] - 3, s[1] - 1, 6, 2, 0.8, '#ffffff', null, 0);
  ctx.restore();
  // wheels stay round whatever the body is doing
  for (const wx of [-16, 15]) {
    const x = wx * p.sx;
    circle(ctx, x, -8, 8, '#2b2b33', OUT, LW);
    circle(ctx, x, -8, 3.5, pal.hub, OUT, 1.5);
    line(ctx, x + Math.cos(roll) * 3, -8 + Math.sin(roll) * 3, x - Math.cos(roll) * 3, -8 - Math.sin(roll) * 3, OUT, 1.2);
  }
  ctx.restore();
}

// ---- oil slick ---------------------------------------------------------------
class Oil extends Entity {
  constructor(m, f) {
    super({ owner: f, team: f.team, layer: 'back', tag: 'oil' });
    this.x = f.x - f.facing * 34; this.y = f.y - 10; this.vx = -f.facing * 1.2; this.vy = 0;
    this.landed = false; this.ground = null; this.life = 420;
    this.hit = { dmg: 3, ang: 8, set: 80, rehit: 70, hl: 0.5, fx: 'goo', sfx: 'slide' };
  }
  update(m) {
    this.t++;
    if (!this.landed) {
      this.vy += 0.34; const py = this.y; this.x += this.vx; this.y += this.vy;
      const g = groundBelow(m.stage, this.x, py, Math.max(2, this.vy + 2));
      if (g && this.y >= g.y) { this.y = g.y; this.landed = true; this.ground = g; this.t = 0; m.sfx('splat', { vol: 0.5 }); }
      if (this.y > m.stage.blast.b) this.dead = true;
      return;
    }
    const g = this.ground;
    if (!g.on || this.x < g.x || this.x > g.x + g.w) { this.dead = true; return; }
    this.x += g.vx || 0; this.y = g.y;
    if (this.t > this.life) this.dead = true;
  }
  ignore(t) { return !t.grounded; }                    // you have to step in it
  hitShapes() { return this.landed ? [{ x: this.x - 26, y: this.y - 8, w: 52, h: 9 }] : null; }
  // they slip the way they were going, not away from the middle of the puddle
  onHit(t, res) { if (res === 'hit' && t.launch) { t.launch.dir = Math.abs(t.vx) > 0.5 ? sign(t.vx) : t.facing; t.launch.face = false; } }
  draw(ctx) {
    const c = '#3a3348';
    if (!this.landed) { circle(ctx, this.x, this.y, 4.5, c, OUT, 2); return; }
    if (this.t > this.life - 60 && this.t % 8 < 4) return;
    const w = Math.min(1, this.t / 8);
    blob(ctx, [this.x - 28 * w, this.y, this.x - 14 * w, this.y - 4.5, this.x + 3 * w, this.y - 3, this.x + 17 * w, this.y - 5, this.x + 28 * w, this.y, this.x, this.y + 2.5], c, OUT, 2.2, 0.5);
    ellipse(ctx, this.x - 7 * w, this.y - 1.8, 7 * w, 1.3, 'rgba(190,170,255,0.55)', null, 0);
    ellipse(ctx, this.x + 12 * w, this.y - 2.4, 4 * w, 1, 'rgba(255,255,255,0.35)', null, 0);
  }
}

// ---- REV: whoever the bumper catches gets pushed along in front of it ----
function tow(f) {
  const T = f.v.tow;
  for (let i = T.length - 1; i >= 0; i--) {
    const v = T[i];
    if (v.out || v.state !== 'hitstun') { T.splice(i, 1); continue; }
    v.vx = v.vy = 0;
    v.kx = clamp(f.x + f.facing * 38 + f.vx - v.x, -24, 24); v.ky = clamp(f.y - v.y, -6, 6);
  }
}

// ---- the super: ALL ABOARD ---------------------------------------------------
const OPEN = 12, SHUT = OPEN + 96;                 // doors finish opening / the vacuum stops
const HIDE = () => {};                             // passengers are not drawn; their faces show at the windows
const canBoard = (f, v) => v !== f && !v.out && v.team !== f.team && v.state !== 'dead' && v.state !== 'respawn' && v.state !== 'trapped' &&
  v.state !== 'grabbed' && !v.intangible && !v.superActive && !v.def.noGrab;

function board(f, v, m) {
  v.interrupt(); v.setState('trapped'); v.v.trapMax = 600;
  v.intangible = true; v.overrideDraw = HIDE;
  f.v.pax.push(v);
  v.pct = Math.min(999, v.pct + 5); v.stats.taken += 5; f.stats.dealt += 5; v.lastHitBy = f.slot; v.lastHitFrame = m.frame;
  const d = f.pts ? f.pts.door : DOOR;
  m.fx.puff(f.x + f.facing * d[0], f.y + d[1], 5, '#ffffff'); m.sfx('pop'); m.sfx('slurp', { vol: 0.5 });
}
// keep everyone aboard in their seats; forget anyone who is no longer ours
function seat(f) {
  const P = f.v.pax;
  for (let i = P.length - 1; i >= 0; i--) {
    const v = P[i];
    if (v.out || v.state !== 'trapped') { v.overrideDraw = null; P.splice(i, 1); continue; }
    v.sf = 1; v.intangible = true; v.x = f.x; v.y = f.y; v.vx = v.vy = v.kx = v.ky = 0; v.grounded = false; v.ground = null; v.facing = f.facing;
  }
}
function letOut(f, v) {
  v.overrideDraw = null; v.intangible = false;
  if (v.out || v.state !== 'trapped') return false;
  v.x = f.x; v.y = f.y - 4; v.vx = v.vy = v.kx = v.ky = 0; v.grounded = false; v.ground = null;
  v.setState('air');
  return true;
}
function releaseAll(f) {
  const P = f.v.pax || [];
  f.v.pax = [];
  for (const v of P) letOut(f, v);
}
// where the passengers get thrown out: a bus-length past the last bit of floor
// on that side, but never so near the blast line that a fresh fighter can't live
function releaseX(f, m, dir) {
  const st = m.stage, b = st.blast, c = st.cam;
  let edge = dir > 0 ? c.l : c.r;
  for (const s of st.solids.concat(st.plats)) {
    if (!s.on) continue;
    edge = dir > 0 ? Math.max(edge, Math.min(s.x + s.w, c.r)) : Math.min(edge, Math.max(s.x, c.l));
  }
  let x = edge + dir * 46;
  const far = dir > 0 ? b.r - 420 : b.l + 420;
  if ((x - far) * dir > 0) x = far;
  if ((x - f.x) * dir < 90) x = f.x + dir * 90;
  const hard = dir > 0 ? b.r - 150 : b.l + 150;
  if ((x - hard) * dir > 0) x = hard;
  return x;
}
// back on the respawn desk, exactly as after a KO but without paying a stock
function toDesk(f, m) {
  const st = m.stage, rp = st.respawnAt ? st.respawnAt(m, f) : st.respawn;
  releaseAll(f);
  f.v.ride = null; f.superActive = false;
  f.x = rp[0] + (f.slot - 1.5) * 26; f.y = rp[1] - 260; f.v.respY = rp[1];
  f.vx = f.vy = f.kx = f.ky = 0; f.grounded = false; f.ground = null;
  f.jumps = f.st.airJumps; f.facing = f.x > (st.focusX || 0) ? -1 : 1;
  f.launched = false; f.tumble = false; f.launch = null; f.freeze = 0; f.respawnT = 0;
  f.setState('respawn');
}
// The drive. Runs from preUpdate, so the bus ignores floors, walls and pits.
function ride(f, m) {
  const r = f.v.ride, b = m.stage.blast;
  r.t++;
  f.vx = f.vy = f.kx = f.ky = 0; f.grounded = false; f.ground = null;
  seat(f);
  const P = f.v.pax;
  if (m.state === 'over' || (!P.length && r.phase === 0)) {       // class dismissed, or nobody left aboard: call it off
    releaseAll(f); f.v.ride = null; f.mf = SHUT + 12;
    return;
  }
  if (r.phase === 0) {                                             // doors shut, engine revs
    if (r.t === 10) m.sfx('rev', { rate: 1.2 });
    if (r.t >= 30) { r.phase = 1; r.t = 0; f.facing = r.dir; m.sfx('engine'); m.sfx('honk'); }
  } else {
    r.spd = Math.min(17, r.spd + 1);
    f.x += r.dir * r.spd;
    if (r.t % 3 === 0) m.fx.smoke(f.x - r.dir * 34, f.y - 8, '#b9bcc6', 9);
    if (r.phase === 1) {
      if (!P.length) { toDesk(f, m); return; }
      if ((f.x - r.x) * r.dir >= 0) {                              // end of the line: everybody out
        f.v.pax = [];
        P.forEach((v, i) => {
          if (!letOut(f, v)) return;
          v.x = f.x + r.dir * 6; v.y = f.y - 8 - i * 8;
          m.blast(f, v, { dmg: 15, ang: 20 + i * 5, bk: 44, kg: 80, dir: r.dir, force: true, sfx: 'hitL' });
        });
        m.shake(10); m.sfx('throw'); m.fx.burst(f.x, f.y - 24, 50, '#ffffff');
        r.phase = 2; r.t = 0;
      }
    } else if (r.t > 22 || (r.dir > 0 ? f.x > b.r - 70 : f.x < b.l + 70)) { toDesk(f, m); return; }
  }
  if (r.phase < 2 && r.t % 6 === 3 && r.hits < 8) {                // no seat belts
    r.hits++;
    for (const v of f.v.pax) { v.pct = Math.min(999, v.pct + 1.5); v.stats.taken += 1.5; f.stats.dealt += 1.5; v.lastHitBy = f.slot; v.lastHitFrame = m.frame; }
    m.sfx('bonk', { vol: 0.35, rate: 1.3 }); m.fx.spark(f.x - f.facing * 8, f.y - 34, 2, '#ffffff');
  }
}
const SUPER_KEYS = K([0, {}], [OPEN, { doors: 1, sx: 1.04, sy: 0.97, face: 6, lights: 1 }, 'out'], [SHUT, { doors: 1, sx: 1.04, sy: 0.97, face: 6, lights: 1 }],
  [SHUT + 10, { doors: 0 }], [SHUT + 16, { sy: 0.9, sx: 1.06, face: 5 }], [SHUT + 30, { sy: 0.9, sx: 1.06, face: 5 }], [SHUT + 38, {}]);

// ---- the moveset ---------------------------------------------------------------
const spin = (turns, to) => K([0, { rot: 0 }], [to, { rot: TAU * turns }, 'lin'], [999, { rot: TAU * turns }]);
// a flat spin on the spot, faked by flipping the drawing left-right
const yaw = (fr, from, len, turns) => { const c = Math.cos(clamp((fr - from) / len, 0, 1) * turns * TAU); return (c < 0 ? -1 : 1) * Math.max(0.22, Math.abs(c)); };
const tail = (f) => { const e = (f.pts && f.pts.exhaust) || [-37, -12]; return [f.x + f.facing * e[0], f.y + e[1]]; };

const moves = {
  jab: {   // bumper nudge
    frames: 18, sfx: { 3: 'swishS' },
    pose: K([0, {}], [3, { ox: -4, sx: 0.95, rot: -0.03 }], [6, { ox: 9, sx: 1.07, sy: 0.96, rot: 0.04 }, 'out'], [10, { ox: 5 }], [18, {}]),
    hits: [hit([4, 6], 'front', 12, 4, 72, 18, 30, { sfx: 'bonk' })],
    cancel: [{ to: 'jab', f: [11, 17], on: 'attack' }],
  },
  ftilt: {   // the STOP sign swings over the top and slaps down in front
    frames: 30, sfx: { 6: 'swishM' },
    pose: K([0, {}], [5, { stop: 0.4, rot: -0.06 }], [9, { stop: 1, rot: 0.05, ox: 2 }, 'in'], [15, { stop: 1, rot: 0.03 }], [30, {}]),
    hits: [hit([8, 11], 'sign', 11, 9, 361, 22, 92, { sfx: 'slap' })],
  },
  utilt: {   // pops the hood
    frames: 28, sfx: { 5: 'boing' },
    pose: K([0, {}], [4, { sy: 0.9, sx: 1.05 }], [7, { hood: 1, sy: 1.08, sx: 0.97, rot: -0.08 }, 'out'], [13, { hood: 0.85, rot: -0.04 }], [28, {}]),
    hits: [hit([6, 10], 'hood', 13, 7, 88, 30, 100, { sfx: 'clang' })],
  },
  dtilt: {   // low bumper scoop
    frames: 26, sfx: { 4: 'swishS' },
    pose: K([0, {}], [4, { rot: 0.12, ox: 2 }], [8, { rot: -0.16, ox: 9, oy: -2 }, 'out'], [13, { rot: -0.1, ox: 6 }], [26, {}]),
    hits: [hit([6, 9], 'scoop', 12, 6, 80, 30, 72, { sfx: 'bonk' })],
  },
  dash: {   // full ram
    frames: 40, vel: [[0, 6.8, null]], fric: 0.3, sfx: { 2: 'swishM' },
    pose: K([0, { rot: 0.04 }], [4, { sx: 1.12, sy: 0.92, ox: 4, rot: 0.06, lights: 1 }], [20, { sx: 1.08, sy: 0.95, ox: 3, rot: 0.05, lights: 1 }], [40, {}]),
    hits: [hit([5, 12], 'front', 16, 10, 55, 58, 62, { sfx: 'whop' }), hit([13, 20], 'front', 14, 7, 60, 40, 50, { group: 1 })],
  },
  fsmash: {   // backs up a step, then rams
    frames: 54, charge: { at: 11, max: 60 }, vel: [[2, -3.4, null], [15, 8.2, null]], fric: 1.3, sfx: { 2: 'beep', 14: 'swishL' },
    pose: K([0, {}], [10, { ox: -3, sx: 0.92, sy: 1.06, rot: -0.08 }], [11, { ox: -3, sx: 0.92, sy: 1.06, rot: -0.08 }], [16, { ox: 8, sx: 1.16, sy: 0.9, rot: 0.07 }, 'in3'], [24, { ox: 5, sx: 1.06, rot: 0.04 }], [54, {}]),
    hits: [hit([16, 22], 'front', 17, 17, 40, 34, 100, { sfx: 'whop' })],
  },
  usmash: {   // bounces on its springs and hits with the roof
    frames: 48, charge: { at: 7, max: 60 }, sfx: { 10: 'boing' },
    pose: K([0, {}], [6, { sy: 0.62, sx: 1.12 }], [7, { sy: 0.62, sx: 1.12 }], [12, { sy: 1.42, sx: 0.92, oy: -12, lights: 1 }, 'in3'], [18, { sy: 1.1, oy: -4, lights: 1 }], [30, { lights: 1 }], [48, {}]),
    hits: [box([11, 16], 'roof', 46, 22, 14, 90, 34, 104, { sfx: 'whop' })],
  },
  dsmash: {   // a donut
    frames: 50, charge: { at: 5, max: 60 }, sfx: { 6: 'skid', 16: 'skid' },
    pose: (f, fr) => ({ sx: yaw(fr, 6, 22, 2), sy: 0.95, face: 1 }),
    tick: (f, m, fr) => { if (fr >= 6 && fr < 28 && fr % 3 === 0) m.fx.smoke(f.x + (fr % 2 ? 18 : -18), f.y - 4, '#e6e6ea', 7); },
    hits: [hit([9, 13], [30, 12], 15, 13, 30, 36, 86, { sfx: 'whop' }), hit([14, 18], [-30, 12], 15, 12, 30, 36, 86, { rev: true, group: 1, sfx: 'whop' })],
  },
  nair: air({
    frames: 42, sfx: { 3: 'swishM' }, pose: spin(1, 26),
    hits: [hit([5, 13], 'body', 25, 9, 361, 20, 85, { sfx: 'whop' }), hit([14, 25], 'body', 23, 5, 361, 14, 70, { group: 1 })],
  }, 11, [4, 30]),
  fair: air({   // bumper first
    frames: 38, sfx: { 7: 'swishM' },
    pose: K([0, {}], [6, { ox: -5, rot: -0.12, sx: 0.94 }], [10, { ox: 10, rot: 0.14, sx: 1.12, sy: 0.93 }, 'in'], [16, { ox: 6, rot: 0.1 }], [38, {}]),
    hits: [hit([9, 13], 'front', 16, 11, 361, 24, 92, { sfx: 'whop' })],
  }, 12, [6, 26]),
  bair: air({   // exhaust backfire
    frames: 36, sfx: { 5: 'swishM' },
    pose: K([0, {}], [5, { ox: 5, rot: 0.1 }], [8, { ox: -9, rot: -0.06, sx: 1.08 }, 'in'], [13, { ox: -6 }], [36, {}]),
    hits: [hit([7, 11], 'exhaust', 15, 11, 361, 26, 95, { rev: true, fx: 'fire', sfx: 'fire' })],
    events: { 7: (f, m) => { const e = tail(f); m.fx.flame(e[0], e[1], 5); m.fx.smoke(e[0], e[1], '#8d8f98', 9); m.sfx('explosion', { vol: 0.4, rate: 1.7 }); } },
  }, 11, [5, 24]),
  uair: air({   // roof
    frames: 32, sfx: { 4: 'swishS' },
    pose: K([0, {}], [4, { sy: 0.8, sx: 1.1 }], [8, { sy: 1.26, sx: 0.92, oy: -8 }, 'out'], [32, {}]),
    hits: [box([6, 11], 'roof', 44, 20, 9, 84, 26, 96, { sfx: 'whop' })],
  }, 10, [4, 22]),
  dair: air({   // drops wheels-first
    frames: 52, drift: 0.25, fallCap: 13.5, vel: [[4, 0, -3], [14, 0, 13.5]], sfx: { 13: 'swishL' },
    pose: K([0, {}], [12, { sy: 0.84, sx: 1.08, rot: -0.1 }], [15, { sy: 1.14, sx: 0.95 }], [52, { sy: 1.14, sx: 0.95 }]),
    hits: [box([14, 20], 'under', 44, 16, 13, 270, 20, 84, { sfx: 'whop' }), box([21, 50], 'under', 44, 16, 10, 65, 30, 70, { group: 1 })],
    onLand: (f, m) => { m.fx.dust(f.x - 16, f.y, 4); m.fx.dust(f.x + 16, f.y, 4); m.shake(6); m.sfx('thud'); },
  }, 22, [10, 52]),

  // --- specials ---
  nspecial: {   // REV: hold to rev on the spot, let go to blast through whoever is in the way
    kind: 'special', frames: 152, keepV: true, airOK: true, drift: 0.1, grav: 0.7, armor: [[20, 126, 85]],
    start: (f, m) => { f.v.rev = 0; f.v.go = 0; f.v.tow = []; f.v.aiRev = f.isCPU ? 10 + m.rng.int(0, 44) : 0; },
    exit: (f) => { f.dmgMul = 1; f.v.tow = []; },
    tick: (f, m, fr) => {
      if (fr < 20) {
        f.vx = approach(f.vx, 0, 0.5);
        if (fr < 8) return;
        if ((f.inp.h.special || f.v.rev < f.v.aiRev) && f.v.rev < 80) {
          f.v.rev++; f.mf = 7;
          if (f.v.rev % 8 === 1) m.sfx('rev', { vol: 0.45, rate: 0.7 + f.v.rev / 80 });
          if (f.v.rev % 4 === 0) { const e = tail(f); m.fx.smoke(e[0], e[1], '#8d8f98', 6 + f.v.rev * 0.06); }
          if (f.v.rev === 80) { f.flash = 6; f.flashColor = '#fff2a8'; }
        } else {
          f.v.go = 14 + Math.round(f.v.rev * 0.13); f.v.spd = 8.5 + f.v.rev * 0.07; f.dmgMul = 1 + f.v.rev / 100;
          f.mf = 20; m.sfx('dash'); m.sfx('engine', { vol: 0.6 });
        }
      } else if (fr < 120) {
        f.vx = f.facing * f.v.spd;
        if (--f.v.go <= 0) f.mf = 119;
        if (fr % 3 === 0 && f.grounded) m.fx.dust(f.x - f.facing * 22, f.y, 1);
        tow(f);
      } else {
        f.vx = approach(f.vx, 0, 0.9);
        if (fr <= 125) tow(f);
      }
    },
    pose: (f) => {
      if (f.mf >= 120) return { sx: 1.04, rot: -0.04, face: 1 };
      if (f.mf >= 20) return { sx: 1.14, sy: 0.9, rot: 0.05, ox: 3, face: 1, lights: 1 };
      const k = Math.min(1, 0.3 + ((f.v && f.v.rev) || 0) / 50);
      return { ox: (f.t % 2 ? 1.4 : -1.4) * k, sy: 0.95, sx: 1.03, rot: -0.05 * k, face: 1 };
    },
    hits: [box([21, 119], [20, 22], 40, 40, 1, 20, 0, 0, { set: 30, rehit: 5, hl: 0, stun: 6, sfx: 'hitS', onHit: (o, t) => { if (o && o.v.tow && !o.v.tow.includes(t)) o.v.tow.push(t); } }),
      box([120, 125], [24, 22], 48, 44, 7, 42, 50, 72, { group: 1, sfx: 'whop' })],
  },
  sspecial: {   // Honk Honk: a horn blast that shoves
    kind: 'special', frames: 38, drift: 0.5, sfx: { 7: 'honk' },
    pose: K([0, {}], [6, { sx: 0.92, sy: 1.08, ox: -3 }], [9, { sx: 1.12, sy: 0.92, ox: 4, face: 3 }, 'out'], [18, { sx: 1.04, face: 3 }], [38, {}]),
    hits: [box([8, 14], [60, 22], 74, 46, 4, 14, 52, 24, { stun: 4, hl: 0.5, sfx: 'hitS' })],
  },
  uspecial: {   // Wheelie
    kind: 'special', frames: 50, helpless: true, drift: 0.7, ledgeOK: 18, airOK: true, slideOff: true,
    vel: [[9, 1.4, -13]], sfx: { 3: 'rev', 9: 'rocket' },
    tick: (f, m, fr) => { if (fr >= 9 && fr < 30 && fr % 2 === 0) { const e = tail(f); m.fx.flame(e[0], e[1], 2); } },
    pose: K([0, {}], [8, { rot: -0.9, oy: -3 }, 'out'], [12, { rot: -1.3, sy: 1.08 }], [30, { rot: -1.3 }], [50, { rot: -0.3 }]),
    hits: [hit([9, 22], 'exhaust', 15, 6, 82, 44, 40, { fx: 'fire', sfx: 'fire' })],
  },
  dspecial: {   // oil slick
    kind: 'special', frames: 34, drift: 0.6, sfx: { 10: 'squirt' },
    can: (f, m) => countMine(f, m, 'oil') < 1,
    pose: K([0, {}], [6, { rot: 0.08, ox: 2 }], [12, { rot: -0.12, sy: 0.94, ox: -2 }, 'out'], [20, { rot: -0.06 }], [34, {}]),
    events: { 11: (f, m) => { m.spawn(new Oil(m, f)); } },
  },

  // --- the bumper scoop: its grab ---
  grab: {
    kind: 'grab', frames: 34, sfx: { 5: 'swishM' },
    pose: K([0, {}], [5, { rot: 0.1, ox: -2 }], [8, { rot: 0.14, ox: 9, sx: 1.06 }, 'out'], [13, { rot: -0.06, ox: 6 }], [34, {}]),
    hits: [{ f: [7, 10], x: 37, y: -16, r: 13, dmg: 0, grab: true }],
  },
  ...stdThrows({
    f: { dmg: 8, bk: 60, kg: 66, f: 12, frames: 30, sfx: 'whop', pose: K([0, { rot: -0.08 }], [8, { rot: -0.2, ox: -5 }], [12, { rot: 0.12, ox: 8, sx: 1.1 }, 'in'], [30, {}]) },
    b: { dmg: 9, bk: 62, kg: 82, f: 15, frames: 36, pose: K([0, { rot: -0.08 }], [15, { rot: -1.0, ox: -4 }, 'in'], [22, { rot: -0.3 }], [36, {}]) },
    u: { dmg: 8, bk: 66, kg: 70, f: 12, frames: 32, sfx: 'boing', pose: K([0, { rot: -0.08 }], [7, { sy: 0.8, sx: 1.08 }], [12, { hood: 1, sy: 1.1, sx: 0.96, rot: -0.1 }, 'in'], [32, {}]) },
    d: { dmg: 7, bk: 52, kg: 42, f: 15, frames: 34, sfx: 'thud', pose: K([0, { rot: -0.08 }], [9, { rot: 0.3, oy: -12, ox: 6 }], [15, { rot: 0.05, ox: 10, sy: 0.8, sx: 1.1 }, 'in'], [34, {}]) },
  }),
  getup: {
    frames: 34, invuln: [[0, 12]], sfx: { 8: 'skid' },
    pose: (f, fr) => ({ sx: yaw(fr, 6, 16, 1), sy: 0.95, face: 1 }),
    hits: [hit([9, 12], [30, 12], 14, 6, 50, 40, 50), hit([14, 18], [-30, 12], 14, 6, 50, 40, 50, { rev: true, group: 1 })],
  },
  taunt: {
    kind: 'taunt', frames: 70, iasa: 60, sfx: { 8: 'honk', 26: 'honk' },
    pose: K([0, {}], [8, { sy: 0.9, sx: 1.06, face: 3, lights: 1 }], [14, { sy: 1.1, sx: 0.96, oy: -6, face: 3, lights: 1 }], [20, { face: 3, lights: 1 }], [26, { sy: 0.9, sx: 1.06, face: 3, lights: 1 }],
      [32, { sy: 1.1, sx: 0.96, oy: -6, face: 3, lights: 1 }], [40, { face: 3, lights: 1 }], [60, { face: 3 }], [70, {}]),
  },

  // --- the super: ALL ABOARD ---
  super: {
    kind: 'super', frames: SHUT + 38, grav: 0, drift: 0, noPush: true, sfx: { 2: 'honk' },
    start: (f) => { f.v.pax = []; f.v.ride = null; },
    exit: (f) => { releaseAll(f); f.v.ride = null; },
    pose: (f) => {
      const r = f.v && f.v.ride;
      if (!r) return SUPER_KEYS;
      if (r.phase === 0) return { doors: Math.max(0, 1 - r.t / 10), face: 1, lights: 1, ox: r.t > 10 ? (f.t % 2 ? 1.2 : -1.2) : 0, sy: 0.96 };
      return { face: 3, lights: 1, sx: 1.1, sy: 0.93, rot: 0.05 };
    },
    tick: (f, m, fr) => {
      f.vx = 0; if (!f.grounded) f.vy = 0;
      seat(f);
      if (fr >= OPEN && fr < SHUT) {            // the vacuum: 260px in front, 120px behind
        const d = f.pts ? f.pts.door : DOOR, dx0 = f.x + f.facing * d[0], dy0 = f.y + d[1];
        for (const v of m.fighters) {
          if (!canBoard(f, v) || f.v.pax.includes(v)) continue;
          const rel = (v.x - f.x) * f.facing, dx = dx0 - v.x, dy = dy0 - v.cy;
          if (rel > 260 || rel < -120 || Math.abs(dy) > 110) continue;
          if (Math.abs(dx) < 30 && Math.abs(dy) < 40 && v.invuln <= 0) { board(f, v, m); continue; }
          const pull = 2.4 + 2.4 * (1 - Math.min(1, Math.abs(dx) / 260));
          v.kx = sign(dx) * Math.min(Math.abs(dx), pull + 0.3);
          if (!v.grounded) v.ky = clamp(dy * 0.1, -2.6, 2.6);
        }
        if (fr % 14 === 0) m.sfx('spray', { vol: 0.4, rate: 0.7 });
      }
      if (fr === SHUT) {
        if (f.v.pax.length) {
          const b = m.stage.blast, dir = f.x - b.l < b.r - f.x ? -1 : 1;
          f.v.ride = { t: 0, phase: 0, dir, spd: 0, hits: 0, x: releaseX(f, m, dir) };
          m.sfx('bell', { vol: 0.6 });
        } else { m.sfx('fail'); m.fx.word(f.x, f.y - 70, 'NO RIDERS', { color: '#ffffff', size: 22 }); }
      }
    },
  },
};

export default {
  id: 'honk', name: 'HONK', from: 'Field Trip!', superName: 'All Aboard',
  blurb: 'Eleven tons of school spirit with nowhere to be. No arms, so everything is a ram. Do not stand in front while it revs.',
  stats: { weight: 116, walk: 2.0, dash: 4.2, run: 5.2, traction: 0.3, jump: 9.2, hop: 5.8, djump: 8.4, gravity: 0.42, fall: 8.6, fastFall: 12, airSpeed: 3.2, airAccel: 0.2, jumpSquat: 5, landLag: 4, rollSpeed: 4.6, w: 52, h: 42 },
  portrait: { x: 13, y: -27, s: 1.45 },
  costumes: costumes(BASE, [
    ['Route 9', {}],
    ['Activity Bus', { main: '#2f7fe0', body: '#f4f6f8', trim: '#2f7fe0', stripe: '#2f7fe0', bump: '#8d96a6', roofl: '#ffb81c', hub: '#ffffff' }],
    ['Night Class', { main: '#27407a', body: '#27407a', trim: '#8fa8e0', bump: '#141a2e', glass: '#ffe9a0', light: '#fff36a', roofl: '#ff8a1e', hub: '#8fa8e0', glow: 1 }],
    ['Float', { main: '#ff8fc0', body: '#ff8fc0', trim: '#ffffff', bump: '#b45cff', glass: '#fff6c9', stopc: '#35a84a', roofl: '#7bd1ff', hub: '#ffe45c', daisy: 1 }],
  ]),
  pose, points, draw, moves,
  hooks: {
    init(f) { f.v.roll = 0; f.v.pax = []; f.v.ride = null; f.v.tow = []; },
    preUpdate(f, m) {
      if (!f.v.ride) return undefined;
      if (f.state !== 'move' || f.moveId !== 'super') { releaseAll(f); f.v.ride = null; return undefined; }
      ride(f, m);
      return f.v.ride ? true : undefined;
    },
    postUpdate(f) {
      f.v.roll += ((f.v.ride ? f.v.ride.spd * f.v.ride.dir : f.vx + f.kx) * f.facing) / 8;
      if (f.superActive && !(f.state === 'move' && f.moveId === 'super')) f.superActive = false;     // knocked out of it: no lingering immunity
    },
    onInterrupt(f) { releaseAll(f); f.v.ride = null; },
    drawFront(ctx, f, m) {
      if (f.state !== 'move') return;
      if (f.moveId === 'sspecial' && f.mf >= 7 && f.mf < 22) {            // horn blast
        const x = f.x + f.facing * 32, y = f.y - 20;
        for (let k = 0; k < 3; k++) {
          const r = 12 + (f.mf - 7) * 4.6 - k * 13;
          if (r < 8) continue;
          ctx.globalAlpha = clamp(1.4 - r / 70, 0, 1);
          ctx.beginPath(); ctx.arc(x, y, r, f.facing > 0 ? -0.55 : Math.PI - 0.55, f.facing > 0 ? 0.55 : Math.PI + 0.55);
          ctx.strokeStyle = OUT; ctx.lineWidth = 5.4; ctx.lineCap = 'round'; ctx.stroke();
          ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2.6; ctx.stroke();
        }
        ctx.globalAlpha = 1;
      } else if (f.moveId === 'super' && !f.v.ride && f.mf >= OPEN && f.mf < SHUT) {   // the vacuum
        const d = f.pts ? f.pts.door : DOOR, x = f.x + f.facing * d[0], y = f.y + d[1];
        for (let i = 0; i < 12; i++) {
          const u = ((i * 0.083 + f.t * 0.03) % 1), back = i % 4 === 3, reach = (back ? -120 : 260) * f.facing * (1 - u);
          const sy = y + Math.sin(i * 2.1) * 80 * (1 - u), sx = x + reach, len = 26 * (1 - u * 0.6) * (back ? -1 : 1) * f.facing;
          ctx.globalAlpha = clamp(u * 3, 0, 1) * 0.85;
          line(ctx, sx, sy, sx + len, sy + (y - sy) * 0.18, '#ffffff', 3);
        }
        ctx.globalAlpha = 1;
      }
    },
  },
  ai: {
    nspecial: { range: [120, 330], dy: 46, w: 0.6 },
    sspecial: { power: 5 },
    dspecial: { range: [50, 170], dy: 50, w: 0.2 },
    super: { range: 225, dy: 70 },
    recovery: { up: 195 },
  },
};
