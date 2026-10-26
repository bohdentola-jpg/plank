// Contact: bodies colliding, blocks, tackles, catches and loose balls.
//
// Everything here works from positions, velocities, ratings and the actions
// players are in. A juke only beats a tackle when it's timed into the contact,
// a spin shrugs off arm tackles, a stiff arm pushes a man away, a hurdle clears
// a diving tackle, a truck stick wins or loses on mass × speed. Tackles are
// wraps that drag, clean takedowns, big hits that pop the ball loose, whiffs.
// While a runner is wrapped up but not yet down he can still pitch it.
import { clamp, norm, dist } from './math.js';
import { actionKey } from './anims.js';

const R99 = (v) => (v ?? 50) / 99;

// ------------------------------------------------------------ collisions
export function resolveCollisions(m) {
  const P = m.active;
  for (let i = 0; i < P.length; i++) {
    const a = P[i];
    if (a.y > 0.6) continue;  // airborne (hurdle, leap) passes over bodies
    for (let j = i + 1; j < P.length; j++) {
      const b = P[j];
      if (b.y > 0.6) continue;
      if (a.engaged && a.engaged === b.engaged) continue;
      if (a.wrapping === b || b.wrapping === a) continue;
      // the holder and his kicker work in each other's space
      if (a.side === b.side && (a.asg?.type === 'holder' || b.asg?.type === 'holder')) continue;
      const dx = b.x - a.x, dz = b.z - a.z;
      const rr = (a.onGround ? a.radius * 0.6 : a.radius) + (b.onGround ? b.radius * 0.6 : b.radius);
      const d2 = dx * dx + dz * dz;
      if (d2 >= rr * rr || d2 < 1e-8) continue;
      const d = Math.sqrt(d2);
      const nx = dx / d, nz = dz / d;
      const pen = rr - d;
      // bodies on the ground are obstacles you step around, not walls
      const ma = a.onGround ? 3 : a.mass, mb = b.onGround ? 3 : b.mass;
      const ka = mb / (ma + mb), kb = ma / (ma + mb);
      a.x -= nx * pen * ka; a.z -= nz * pen * ka;
      b.x += nx * pen * kb; b.z += nz * pen * kb;
      // inelastic: cancel the closing velocity
      const rel = (b.vx - a.vx) * nx + (b.vz - a.vz) * nz;
      if (rel < 0) {
        const j = -rel;
        a.vx -= nx * j * ka * 0.85; a.vz -= nz * j * ka * 0.85;
        b.vx += nx * j * kb * 0.85; b.vz += nz * j * kb * 0.85;
      }
      // a would-be blocker running into a defender locks on
      if (a.side !== b.side) m.onContact(a, b, Math.max(0, -rel));
    }
  }
}

// ------------------------------------------------------------ blocking
export function engage(m, blocker, defender, kind = 'pass') {
  if (blocker.engaged || defender.engaged || !blocker.standing || !defender.standing) return null;
  if (defender === m.ball.carrier || blocker === m.ball.carrier) return null;
  const rec = { a: blocker, b: defender, t: 0, shed: 0, bal: 0, kind, side: m.rng() < 0.5 ? 'L' : 'R' };
  blocker.engaged = rec; defender.engaged = rec;
  blocker.state = 'engaged'; defender.state = 'engaged';
  m.engagements.push(rec);
  m.emit('block', { a: blocker, b: defender, kind });
  return rec;
}

export function release(m, rec, winner = null) {
  for (const e of [rec.a, rec.b]) {
    if (e.engaged === rec) {
      e.engaged = null;
      if (e.state === 'engaged') e.state = 'active';
    }
  }
  rec.done = true;
  rec.winner = winner;
}

/** Push contest between a blocker (a) and a defender (b). */
export function updateEngagements(m, dt) {
  for (const rec of m.engagements) {
    if (rec.done) continue;
    const { a, b } = rec;
    if (!a.standing || !b.standing || a.engaged !== rec || b.engaged !== rec || b === m.ball.carrier) { release(m, rec); continue; }
    rec.t += dt;
    const blockSkill = rec.kind === 'run' ? a.r.rbk : a.r.pbk;
    const blockPow = (a.r.str * 0.55 + blockSkill * 0.45) * (0.9 + 0.1 * a.stamina) + (a.mass - 250) * 0.06;
    const isDL = b.p.pos === 'DL';
    const moves = isDL ? Math.max(b.r.pmv, b.r.fmv * 0.97) : b.r.bsh;
    const rushPow = (b.r.str * 0.45 + moves * 0.55) * (0.9 + 0.1 * b.stamina) + (b.mass - 250) * 0.05;
    const edge = (rushPow - blockPow) / 30;
    rec.bal += (-edge * 0.9 + m.rng.gauss() * 0.9) * dt * 1.4;
    rec.bal = clamp(rec.bal, -1.3, 1.3);
    // blocks don't last forever: the longer it goes, the more likely he gets off
    const rate = Math.max(0.04, 0.2 + edge * 0.35 + Math.max(0, rec.t - 2.2) * 0.35 + Math.max(0, -rec.bal) * 0.25 + (b.mem.shedBoost || 0));
    rec.shed += rate * dt;
    // where each wants to go
    const goal = b.mem.goal || m.ballSpot();
    const gd = norm(goal.x - b.x, goal.z - b.z);
    // the pair moves: defender winning → toward his goal; blocker winning → drives him back
    let mvx, mvz;
    if (rec.bal < 0) {
      const s = -rec.bal * 1.7;
      mvx = gd.x * s; mvz = gd.z * s;
    } else {
      // run blocks drive him off the ball; pass pro just anchors
      const push = a.mem.pushDir || { x: -gd.x, z: -gd.z };
      const s = rec.bal * (rec.kind === 'run' ? 1.6 : 0.22);
      mvx = push.x * s; mvz = push.z * s;
    }
    // the defender also works laterally around the block toward his goal
    const lat = b.want.s > 0 ? 0.6 : 0;
    const side = { x: -(a.z - b.z), z: a.x - b.x };
    const sl = norm(side.x, side.z);
    const sgn = (sl.x * gd.x + sl.z * gd.z) >= 0 ? 1 : -1;
    mvx += sl.x * sgn * lat * 0.4; mvz += sl.z * sgn * lat * 0.4;
    a.vx = b.vx = mvx; a.vz = b.vz = mvz;
    a.x += mvx * dt; a.z += mvz * dt; b.x += mvx * dt; b.z += mvz * dt;
    // keep them chest to chest
    const n = norm(b.x - a.x, b.z - a.z);
    const want = (a.radius + b.radius) * 0.92;
    const mid = { x: (a.x + b.x) / 2, z: (a.z + b.z) / 2 };
    if (n.l > 0) {
      a.x = mid.x - n.x * want / 2; a.z = mid.z - n.z * want / 2;
      b.x = mid.x + n.x * want / 2; b.z = mid.z + n.z * want / 2;
      a.heading = Math.atan2(n.x, n.z);
      b.heading = Math.atan2(-n.x, -n.z);
    }
    a.base = 'block'; b.base = 'rush';
    // pancake: a dominant blocker puts him on his back
    if (rec.bal > 1.05 && m.rng() < dt * 0.35 * (a.r.str / 99)) {
      release(m, rec, a);
      b.act('pancaked'); b.state = 'falling'; b.recover = 2.2;
      m.emit('pancake', { a, b });
      m.stat(a, 'pancakes');
      continue;
    }
    if (rec.shed >= 1) {
      release(m, rec, b);
      shedFree(m, a, b, gd);
    }
  }
  if (m.engagements.length > 24) m.engagements = m.engagements.filter((r) => !r.done);
}

function shedFree(m, a, b, gd) {
  // he slips off around the blocker toward his goal
  const side = { x: -(a.z - b.z), z: a.x - b.x };
  const sl = norm(side.x, side.z);
  const sgn = (sl.x * gd.x + sl.z * gd.z) >= 0 ? 1 : -1;
  b.act('shed', { side: sgn > 0 ? 'R' : 'L' });
  b.boost = { vx: (sl.x * sgn * 0.6 + gd.x) * 2.2, vz: (sl.z * sgn * 0.6 + gd.z) * 2.2, t: 0.3 };
  a.recover = 0.35 + m.rng() * 0.3;
  a.mem.beat = m.time;
  m.emit('shed', { a, b });
}

/** A person on the controller tries a swim / rip move. */
export function userShed(m, e) {
  const rec = e.engaged;
  if (!rec || rec.b !== e || e.moveCD > 0) return;
  e.moveCD = 0.8;
  const a = rec.a;
  const blockSkill = rec.kind === 'run' ? a.r.rbk : a.r.pbk;
  const mine = Math.max(e.r.pmv, e.r.fmv, e.r.bsh);
  const p = clamp(0.28 + (mine - blockSkill) / 80 + rec.t * 0.06 - rec.bal * 0.15, 0.08, 0.75);
  if (m.rng() < p) {
    release(m, rec, e);
    const goal = e.mem.goal || m.ballSpot();
    shedFree(m, a, e, norm(goal.x - e.x, goal.z - e.z));
  } else {
    rec.bal = Math.min(1.3, rec.bal + 0.25);
    e.act('bull');
  }
}

// ------------------------------------------------------------ tackling
/**
 * Does `d` get a tackle attempt on carrier `c` this tick? Called for every
 * defender near the ball. kind: 'wrap' (default contact), 'dive', 'hit', 'cut', 'arm'
 */
export function tryTackle(m, d, c, kind = 'wrap') {
  if (d.tackleCD > 0 || !d.standing && kind !== 'dive') return false;
  if (c.state === 'falling' || c.state === 'down') return false;
  if (c.wrappedBy.includes(d)) return false;
  const reach = kind === 'dive' ? 2.2 : kind === 'cut' ? 1.6 : kind === 'hit' ? 1.35 : kind === 'arm' ? 0.95 : 1.05;
  const dd = dist(d, c);
  if (dd > c.radius + d.radius + reach * 0.5) return false;
  d.tackleCD = 0.55;
  resolveTackle(m, d, c, kind);
  return true;
}

export function resolveTackle(m, d, c, kind) {
  const rng = m.rng;
  const n = norm(c.x - d.x, c.z - d.z);                 // defender → carrier
  const cSp = c.speed, dSp = d.speed;
  const cDir = cSp > 0.5 ? { x: c.vx / cSp, z: c.vz / cSp } : { x: Math.sin(c.heading), z: Math.cos(c.heading) };
  const facing = -(cDir.x * n.x + cDir.z * n.z);       // 1 = tackler straight ahead of him, −1 = from behind
  const closing = Math.max(0, (d.vx - c.vx) * n.x + (d.vz - c.vz) * n.z);
  const tak = R99(d.r.tak), hitR = R99(d.r.hit), str = R99(d.r.str);
  const btk = R99(c.r.btk), trk = R99(c.r.trk), elu = R99(c.r.elu), cstr = R99(c.r.str);
  const mom = (c.mass * cSp) / (d.mass * Math.max(1, dSp) + c.mass * cSp + 1);   // 0..1 carrier's share of momentum
  const act = c.action;
  const inMove = (name, lo, hi) => act && act.name === name && act.t >= lo && act.t <= hi;

  // ---- the carrier's moves
  // a square-up tackle by a decent tackler is a tackle ~85 % of the time (missed-tackle
  // rates in the real game run 10-15 %): the moves and the angles move it from there
  let pMiss = 0.03 + 0.11 * (1 - tak) + 0.05 * elu * Math.min(1, cSp / 9);
  let pBreak = 0.015 + 0.11 * btk * (0.3 + mom) - 0.08 * str;
  if (kind === 'arm') { pMiss += 0.22; pBreak += 0.18; }
  if (kind === 'dive') { pMiss += 0.12; }
  if (kind === 'hit') { pMiss += 0.1 * (1 - hitR); pBreak -= 0.08; }
  if (kind === 'cut') { pMiss += 0.04; pBreak -= 0.05; }
  if (facing < -0.3) { pMiss *= 0.6; pBreak *= 0.7; }   // from behind: he's caught
  if (inMove('juke', 0.04, 0.36)) pMiss += 0.22 + 0.32 * elu - 0.12 * R99(d.r.agi);
  if (c.immune > 0 && (kind === 'wrap' || kind === 'arm')) pMiss += 0.22 + 0.25 * elu;          // spinning
  if (inMove('stiff', 0.1, 0.65) && facing > -0.2) pBreak += 0.18 + 0.3 * (trk + cstr) / 2;      // stiff arm
  if (c.y > 0.45) {                                                                                  // hurdling
    if (kind === 'cut' || kind === 'dive') pMiss = 0.92;
    else { pMiss = 0.1; pBreak = 0; }
  }
  let truckWin = false, truckLose = false;
  if (inMove('truck', 0.0, 0.4) && facing > 0) {
    const cP = trk * 0.6 + cstr * 0.4 + (c.mass * cSp) / 2600;
    const dP = tak * 0.4 + str * 0.6 + (d.mass * Math.max(1, dSp)) / 2600;
    if (cP + rng.gauss() * 0.12 > dP) truckWin = true; else truckLose = true;
  }
  pMiss = clamp(pMiss, 0.01, 0.95);
  pBreak = clamp(pBreak, 0, 0.6);

  const roll = rng();
  if (truckWin) return brokeTackle(m, d, c, 'truck');
  if (!truckLose && roll < pMiss) return missedTackle(m, d, c, kind);
  if (!truckLose && roll < pMiss + pBreak) return brokeTackle(m, d, c, 'break');

  // ---- he's got him: a big hit, a clean takedown or a wrap
  const power = (kind === 'hit' ? 0.6 : 0.3) * hitR + 0.25 * str + closing / 18;
  const bigHit = kind === 'hit' || truckLose || (power > 0.62 && facing > 0.2 && rng() < 0.35);
  if (bigHit) {
    m.emit('hit', { d, c, power: clamp(power + 0.2, 0.3, 1), kind: 'big' });
    if (checkFumble(m, d, c, 0.9 + power)) return 'fumble';
    knockDown(m, c, n, facing > 0 ? 'fall_back' : 'fall_fwd', d);
    d.act(kind === 'hit' ? 'hit' : 'tackle');
    d.tackleCD = 1;
    m.stat(d, 'tackles');
    return 'hit';
  }
  // clean takedown when he's slow, or the tackler is much stronger
  const clean = cSp < 3.5 && rng() < 0.55 + 0.3 * tak - 0.3 * btk;
  m.emit('hit', { d, c, power: clamp(0.25 + closing / 14, 0.15, 0.8), kind: clean ? 'tackle' : 'wrap' });
  if (checkFumble(m, d, c, 0.35)) return 'fumble';
  if (clean || kind === 'cut') {
    knockDown(m, c, n, kind === 'cut' ? 'fall_fwd' : facing > 0.4 && mom < 0.5 ? 'fall_back' : 'fall_fwd', d);
    d.act(kind === 'cut' ? 'cut' : kind === 'dive' ? 'dive_tackle' : 'tackle');
    m.stat(d, 'tackles');
    return 'down';
  }
  // the wrap: he hangs on and the runner drags him for a step or two
  wrapUp(m, d, c, n);
  return 'wrap';
}

function missedTackle(m, d, c, kind) {
  if (kind === 'dive') { d.act('dive_tackle'); d.state = 'falling'; d.recover = 1.6; } else {
    d.act('stumble');
    d.recover = 0.55 + m.rng() * 0.35;
    // whiffing costs him his momentum
    d.vx *= 0.3; d.vz *= 0.3;
  }
  d.tackleCD = 1.2;
  m.emit('missedTackle', { d, c });
  m.stat(c, 'brokenTackles');
  return 'miss';
}

function brokeTackle(m, d, c, how) {
  m.emit('hit', { d, c, power: how === 'truck' ? 0.85 : 0.45, kind: how });
  if (how === 'truck') {
    d.act('pancaked'); d.state = 'falling'; d.recover = 2;
    c.vx *= 0.72; c.vz *= 0.72;
  } else {
    d.act(m.rng() < 0.5 ? 'fall_side' : 'stumble', { side: m.rng() < 0.5 ? 'L' : 'R' });
    d.state = d.action.name === 'stumble' ? d.state : 'falling';
    d.recover = 1.1;
    c.vx *= 0.62; c.vz *= 0.62;
  }
  d.tackleCD = 1.5;
  m.emit('brokenTackle', { d, c, how });
  m.stat(c, 'brokenTackles');
  return 'break';
}

function wrapUp(m, d, c, n) {
  d.state = 'wrapping';
  d.wrapping = c;
  d.act('wrap_hold');
  d.mem.wrapOff = { x: -n.x * (c.radius + d.radius) * 0.75, z: -n.z * (c.radius + d.radius) * 0.75 };
  c.wrappedBy.push(d);
  if (c.state !== 'wrapped') {
    c.state = 'wrapped';
    c.mem.wrapT = 0;
    c.mem.fp = m.progressOf(c);  // forward progress so far
    const cP = R99(c.r.btk) * 0.45 + R99(c.r.str) * 0.35 + R99(c.r.trk) * 0.2 + c.mass / 900;
    const dP = R99(d.r.tak) * 0.55 + R99(d.r.str) * 0.45 + d.mass / 900;
    c.mem.downIn = clamp(0.38 + (cP - dP) * 0.9 + m.rng() * 0.4, 0.22, 1.4);
    c.mem.breakP = clamp((cP - dP) * 1.6, 0, 0.7);
    if (!c.action || !c.action.name.startsWith('lateral')) c.act('wrapped');
  } else {
    c.mem.downIn = Math.min(c.mem.downIn, 0.25 + m.rng() * 0.2);   // the gang arrives
  }
  m.stat(d, c.wrappedBy.length > 1 ? 'assists' : 'tackles');
}

/** Wrapped runners: drag, maybe break free, then go down. */
export function updateWraps(m, dt) {
  const c = m.ball.carrier;
  for (const e of m.active) {
    if (e.state !== 'wrapping') continue;
    const t = e.wrapping;
    if (!t || !t.standing || (m.ball.carrier !== t && t.state !== 'wrapped')) {
      e.state = 'active'; e.wrapping = null;
      if (e.action?.name === 'wrap_hold') e.action = null;
      continue;
    }
    // ride along with the runner
    const off = e.mem.wrapOff || { x: 0, z: -0.6 };
    e.x = t.x + off.x; e.z = t.z + off.z;
    e.vx = t.vx; e.vz = t.vz;
    e.heading = Math.atan2(t.x - e.x, t.z - e.z);
  }
  if (!c || c.state !== 'wrapped') return;
  const n = c.wrappedBy.filter((d) => d.state === 'wrapping' && d.wrapping === c).length;
  c.wrappedBy = c.wrappedBy.filter((d) => d.wrapping === c);
  if (!n) { c.state = 'active'; c.speedCap = 1; if (c.action?.name === 'wrapped') c.action = null; return; }
  c.mem.wrapT += dt;
  c.speedCap = 0.34 / (1 + 0.7 * (n - 1));
  c.mem.fp = m.betterProgress(c.mem.fp, m.progressOf(c));
  c.mem.downIn -= dt * (1 + 0.8 * (n - 1));
  // break free (one tackler, a strong back)
  if (n === 1 && c.mem.breakP > 0 && m.rng() < c.mem.breakP * dt * 1.4 && c.mem.wrapT > 0.25) {
    const d = c.wrappedBy[0];
    d.state = 'falling'; d.wrapping = null; d.act('fall_fwd'); d.recover = 1.4;
    c.wrappedBy = [];
    c.state = 'active'; c.speedCap = 1;
    c.action = null;
    m.emit('brokenTackle', { d, c, how: 'wrap' });
    m.stat(c, 'brokenTackles');
    return;
  }
  if (c.mem.downIn <= 0) {
    // down he goes: backwards if the tacklers were driving him back
    const d = c.wrappedBy[0];
    const n2 = norm(c.x - d.x, c.z - d.z);
    const fwd = m.offDir;
    const driveBack = n2.z * fwd < -0.2;
    knockDown(m, c, n2, driveBack ? 'fall_back' : 'fall_fwd', d);
    for (const w of c.wrappedBy) {
      w.state = 'falling'; w.wrapping = null; w.act(m.rng() < 0.6 ? 'fall_fwd' : 'fall_side', { side: m.rng() < 0.5 ? 'L' : 'R' });
      w.recover = 1.4;
    }
    c.wrappedBy = [];
  }
}

function knockDown(m, c, n, fall, by) {
  c.state = 'falling';
  c.speedCap = 1;
  // keep a lateral going if he's pitching it on the way down
  if (!(c.action && c.action.name === 'lateral' && c.action.t < 0.2)) c.act(fall);
  c.mem.fallBy = by;
  c.mem.fp = m.betterProgress(c.mem.fp, m.progressOf(c));
  // momentum carries him a little
  const k = fall === 'fall_back' ? -0.3 : 0.35;
  c.vx = c.vx * k + n.x * (fall === 'fall_back' ? 1.2 : 0.2);
  c.vz = c.vz * k + n.z * (fall === 'fall_back' ? 1.2 : 0.2);
  if (by) {
    by.state = 'falling';
    if (!by.action || !/tackle|hit|cut/.test(by.action.name)) by.act('fall_fwd');
    by.recover = Math.max(by.recover, 1.3);
  }
}

/** Did the ball come out? hitPower ~0.3 (a wrap) … 1.8 (a crushing hit). */
export function checkFumble(m, d, c, hitPower) {
  const protect = c.action?.name === 'protect' || c.carry === 'two';
  const sec = R99(c.r.car);
  // about one fumble per hundred touches; the big hits and the strips do most of it
  let p = 0.0015 + hitPower * hitPower * 0.011 * (1.3 - sec) + (d.action?.name === 'strip' ? 0.08 : 0);
  if (protect) p *= 0.3;
  if (m.weather === 'rain' || m.weather === 'snow') p *= 1.35;
  if (c.p.pos === 'QB' && m.ball.carrier === c && m.playKind === 'pass' && !m.passThrown) p *= 1.4;  // strip-sack
  if (m.rng() >= p) return false;
  fumble(m, c, d);
  return true;
}

export function fumble(m, c, by = null) {
  const b = m.ball;
  b.state = 'air';
  b.kind = 'fumble';
  b.carrier = null;
  c.carry = null;
  b.thrower = c;
  b.lastTeam = c.side;
  const a = m.rng() * Math.PI * 2;
  const s = 2 + m.rng() * 4;
  b.x = c.x; b.z = c.z; b.y = 0.9;
  b.vx = Math.sin(a) * s + c.vx * 0.5; b.vz = Math.cos(a) * s + c.vz * 0.5;
  b.vy = 1.5 + m.rng() * 3;
  b.t = 0; b.tumble = 10; b.spin = 0;
  b.history.push('fumble');
  c.act('fall_fwd'); c.state = 'falling';
  m.emit('fumble', { c, by });
  m.stat(c, 'fumbles');
  if (by) m.stat(by, 'forcedFumbles');
}

// ------------------------------------------------------------ catching
/**
 * Ball in the air: who can get a hand on it this tick? Returns after the
 * first player who does something with it.
 */
export function checkCatches(m, dt) {
  const b = m.ball;
  if (b.state !== 'air' || b.kind === 'fumble' && b.t < 0.15) return;
  if (b.knocked) return;   // dropped / batted down: it's going to the turf
  if (b.kind === 'pass' && b.t < 0.12) return;
  const cands = [];
  for (const e of m.active) {
    if (e === b.thrower && b.t < 0.6) continue;
    // snaps and handoff tosses are for the man they're meant for
    if (b.kind === 'snap' && b.target && e !== b.target) continue;
    // nobody on the kicking team catches a kick in the air (an onside kick is recovered off the ground)
    if ((b.kind === 'kick' || b.kind === 'punt') && b.kicked && e.side === b.lastTeam) continue;
    if (e.catchCD > 0) continue;
    if (!e.standing && !(e.action && /catch_dive|dive|fumble_dive/.test(e.action.name))) continue;
    if (e.state === 'engaged' || e.state === 'wrapping') continue;
    // offensive linemen are ineligible on a forward pass
    if (b.kind === 'pass' && b.forward && e.side === b.lastTeam && (e.role === 'C' || e.role === 'LG' || e.role === 'RG')) continue;
    const h = Math.hypot(b.x - e.x, b.z - e.z);
    const diving = e.action && /catch_dive|dive/.test(e.action.name) && e.action.t < 0.5;
    const jumping = e.y > 0.15;
    const reachH = e.radius + (diving ? 1.15 : 0.62);
    if (h > reachH) continue;
    const top = e.height * 0.62 + 0.8 + e.y + (jumping ? 0.25 : 0);   // hands overhead (≈ 2.6 yd standing)
    const lo = diving ? 0.0 : 0.22;
    if (b.y < lo || b.y > top) continue;
    cands.push({ e, h });
  }
  if (!cands.length) return;
  cands.sort((p, q) => p.h - q.h);
  for (const { e } of cands) {
    const out = attemptCatch(m, e);
    if (out) return out;
  }
}

function attemptCatch(m, e) {
  const b = m.ball;
  e.catchCD = 0.35;
  const intended = b.target === e;
  const friend = e.side === b.lastTeam;
  const sp = Math.hypot(b.vx, b.vy, b.vz);
  let ct = e.mem.catchType || 'auto';
  // contest: nearest opponent at the catch point
  let dc = 9, near = null;
  for (const o of m.active) {
    if (o.side === e.side || !o.standing) continue;
    const d = Math.hypot(o.x - e.x, o.z - e.z);
    if (d < dc) { dc = d; near = o; }
  }
  const contest = clamp((1.35 - dc) / 1.35, 0, 1);
  const cth = R99(e.r.cth), cit = R99(e.r.cit ?? e.r.cth);
  const hitNow = !!(near && near.action && /tackle|hit|dive_tackle|swat|jump_swat/.test(near.action.name) && dc < 1.2);

  if (b.kind === 'snap') {
    if (m.rng() < 0.004) return muff(m, e, 'snap');
    return secure(m, e, 'snap');
  }
  if (b.kind === 'kick' || b.kind === 'punt') {
    if (!e.mem.fielding && !friend) {
      // a coverage man reaching a kick first (onside, a downed punt)
    }
    // a fair catch is protected: nobody can touch him
    const pMuff = e.mem.fairCatch ? 0.01 + (1 - cth) * 0.03 : 0.015 + (1 - cth) * 0.06 + (m.weather === 'rain' ? 0.04 : 0) + contest * 0.12;
    if (m.rng() < pMuff) return muff(m, e, b.kind);
    return secure(m, e, b.kind);
  }

  if (friend) {
    // the intended man (or a teammate in the way)
    let p = 0.72 + 0.27 * cth;
    if (b.kind === 'lateral') p = 0.86 + 0.12 * cth;
    if (sp > 21) p -= (sp - 21) * 0.012;
    p -= contest * (0.42 - 0.3 * cit);
    if (e.action?.name === 'catch_dive' || e.action?.name === 'dive') p -= 0.18;
    if (e.y > 0.25) p -= 0.08 * (1 - R99(e.r.jmp));
    if (e.mem.catchType === 'possession') p += 0.04;
    if (hitNow) p -= 0.25 + 0.25 * R99(near.r.hit);
    if (!intended) p -= 0.18;
    // where the ball is relative to his chest: low and high are harder
    const chest = e.height * 0.6;
    p -= Math.min(0.15, Math.abs(b.y - chest) * 0.08);
    if (m.weather === 'rain') p -= 0.05;
    if (m.weather === 'snow') p -= 0.03;
    p = clamp(p, 0.03, 0.985);
    const r = m.rng();
    if (r < p) return secure(m, e, ct);
    // drop: sometimes it pops up off the hands
    if (r < p + (1 - p) * 0.22) return tip(m, e);
    return drop(m, e);
  }
  // a defender at the ball
  // a defender at the catch point mostly breaks it up; the pick is the exception
  const inPos = e.mem.playBall || e.ctrl !== null;
  let pInt = (0.04 + 0.2 * cth) * (inPos ? 1 : 0.5);
  let pDef = 0.3 + 0.25 * R99(e.r.prc);
  if (e.action?.name === 'swat' || e.action?.name === 'jump_swat') { pInt *= 0.35; pDef = 0.85; }
  if (e.mem.wantInt) { pInt *= 1.35; pDef *= 0.8; }
  if (b.kind === 'lateral') pInt *= 1.2;
  if (sp > 22) pInt *= 0.8;
  const r = m.rng();
  if (r < pInt) return secure(m, e, 'int');
  if (r < pInt + pDef * (1 - pInt)) return tip(m, e, true);
  return null;   // it goes by him
}

function secure(m, e, how) {
  const b = m.ball;
  const kind = b.kind;
  const forward = b.forward;
  const thrower = b.thrower;
  b.give(e);
  e.catchCD = 0;
  m.onCatch(e, { how, kind, forward, thrower });
  return 'catch';
}

function drop(m, e) {
  const b = m.ball;
  // it falls out of his hands to the turf
  b.vx *= 0.25; b.vz *= 0.25; b.vy = -1.5 - m.rng() * 1.5;
  b.knocked = true;
  e.catchCD = 0.8;
  e.act('drop');
  m.emit('drop', { e });
  m.stat(e, 'drops');
  return 'drop';
}

function tip(m, e, defended = false) {
  const b = m.ball;
  const a = m.rng() * Math.PI * 2;
  // most breakups are knocked down; some pop up in the air and stay live
  const pop = m.rng() < (defended ? 0.18 : 0.4);
  const s = pop ? 0.8 + m.rng() * 2 : 2 + m.rng() * 3;
  b.vx = b.vx * 0.15 + Math.sin(a) * s;
  b.vz = b.vz * 0.15 + Math.cos(a) * s;
  b.vy = pop ? 1.6 + m.rng() * 2.6 : -1 - m.rng() * 2;
  b.knocked = !pop;
  b.kind = b.kind === 'lateral' ? 'lateral' : 'tip';
  b.tipped = true;
  if (!e.action || !/swat|catch/.test(e.action.name)) e.act(defended ? 'swat' : 'bobble', { side: m.rng() < 0.5 ? 'L' : 'R' });
  e.catchCD = 0.5;
  m.emit(defended ? 'deflect' : 'tip', { e });
  if (defended) m.stat(e, 'passDefended');
  return 'tip';
}

function muff(m, e, what) {
  const b = m.ball;
  b.state = 'air';
  b.kind = 'fumble';
  b.x = e.x; b.z = e.z; b.y = 1.1;
  const a = m.rng() * Math.PI * 2;
  b.vx = Math.sin(a) * 2.5; b.vz = Math.cos(a) * 2.5; b.vy = 1.6;
  b.thrower = e;
  b.touched = e;
  b.lastTeam = e.side;
  e.catchCD = 0.6;
  e.act('bobble');
  m.emit('muff', { e, what });
  return 'muff';
}

// ------------------------------------------------------------ loose ball
/** Players at a loose ball try to scoop it up or fall on it. */
export function checkLoose(m) {
  const b = m.ball;
  if (b.state !== 'loose' && !(b.state === 'air' && b.kind === 'fumble' && b.y < 0.9)) return;
  for (const e of m.active) {
    if (!e.standing || e.state === 'engaged' || e.state === 'wrapping' || e.recover > 0) continue;
    const d = Math.hypot(b.x - e.x, b.z - e.z);
    if (d > e.radius + 0.55) continue;
    const slow = Math.hypot(b.vx, b.vz) < 3 && b.y < 0.5;
    const aw = R99(e.r.awr);
    if (e.mem.diveForBall || (!slow && m.rng() < 0.5)) {
      e.act('fumble_dive');
      e.state = 'falling';
      if (m.rng() < 0.45 + 0.35 * aw) { b.give(e); m.onRecover(e, true); return; }
      e.recover = 1.5;
      b.vx += (m.rng() - 0.5) * 3; b.vz += (m.rng() - 0.5) * 3; b.vy = 1;
      continue;
    }
    e.act('scoop');
    if (m.rng() < 0.35 + 0.35 * aw) { b.give(e); m.onRecover(e, false); return; }
    e.recover = 0.4;
    b.vx += (m.rng() - 0.5) * 2; b.vz += (m.rng() - 0.5) * 2;
  }
}

/** Contact time for anim-synced events (used by the match for whistles). */
export function fallGroundTime(name) { return actionKey(name, 'ground') || 0.45; }
