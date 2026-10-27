// The officials: what the play's actions mean (ball released, runner down),
// whistles and spots, scoring, the clock, downs, possession, penalties, the
// try after a touchdown, quarters, halftime and overtime — plus the stats.
import { clamp, norm, dist, headingOf } from './math.js';
import { actionKey } from './anims.js';
import { planThrow, releasePass, planToss, releaseToss } from './passing.js';
import { tryTackle, resolveTackle, engage, fumble, userShed } from './contact.js';
import { cpuCalls } from './ai/playcall.js';

const R99 = (v) => (v ?? 50) / 99;
const other = (s) => (s === 'home' ? 'away' : 'home');

// ================================================================== CALLS
export function callNeeds(m) {
  if (m.phase === 'kickoff') return { kind: 'kickoff', off: m.offSide, def: m.defSide };
  if (m.phase === 'pat') return { kind: 'pat', off: m.offSide, def: m.defSide };
  if (m.phase === 'playcall') return { kind: m.tryMode === 'two' ? 'two' : 'scrimmage', off: m.offSide, def: m.defSide };
  return null;
}

/** Headless / CPU-vs-CPU: make whatever call is pending. */
export function autoCall(m) {
  const n = callNeeds(m);
  if (!n) return;
  const c = cpuCalls(m);
  if (n.kind === 'kickoff') m.callKickoff(c.off, c.def);
  else if (n.kind === 'pat') m.choosePat(c.pat);
  else m.callPlays(c.off, c.def, { flip: c.flip });
}

export function choosePat(m, choice) {
  const F = m.field;
  m.tryMode = choice === 'two' ? 'two' : 'pat';
  const dir = m.offDir;
  const spot = m.patSpot;
  m.patSpot = undefined;
  m.los = choice !== 'two' && spot !== undefined ? spot : F.halfL * dir - dir * (choice === 'two' ? F.twoPtYard : F.patKickYard);
  m.ballX = 0;
  m.down = 1; m.toGo = choice === 'two' ? F.twoPtYard : F.patKickYard; m.firstDownZ = F.halfL * dir;
  if (choice === 'two') { m.phase = 'playcall'; m.emit('try', { kind: 'two' }); return; }
  m.callPlays('fg_kick', 'fgd_block');
  m.emit('try', { kind: 'pat' });
}

// ================================================================== PRE-SNAP
export function hardCount(m) {
  if (m.phase !== 'presnap' || m.hardCounted > 2) return;
  m.hardCounted++;
  m.emit('hardCount', {});
  if (m.isUser(m.defSide) && m.userEnt[m.defSide]) return;   // people don't jump on their own
  if (!m.settings.penalties) return;
  // a jumpy lineman goes offside
  const dl = m.defense.filter((d) => d.role.startsWith('DL') || d.asg?.type === 'rush');
  for (const d of dl) {
    const p = 0.06 + 0.16 * (1 - R99(d.r.awr)) * (m.hardCounted === 1 ? 1 : 0.5);
    if (m.rng() < p) {
      d.state = 'active';
      d.act('stumble');
      d.z = m.los + m.offDir * 0.1;
      m.emit('offsides', { e: d });
      penaltyNow(m, { type: 'offside', name: 'OFFSIDE', on: m.defSide, yards: 5, replayDown: true, dead: true, e: d });
      return;
    }
  }
}

/** A person's defender lined up across the ball at the snap. */
export function checkOffsides(m) {
  const side = m.defSide;
  const e = m.userEnt[side];
  if (!e || !m.settings.penalties) return;
  if ((e.z - m.los) * m.offDir < -0.05) {
    m.flags.push({ type: 'offside', name: 'OFFSIDE', on: side, yards: 5, replayDown: true, e, free: true });
    m.emit('flag', { name: 'OFFSIDE', on: side });
  }
}

/** Dead-ball penalty before the snap (offside on the hard count, delay of game). */
export function penaltyNow(m, flag) {
  m.flags = [flag];
  m.result = { type: 'nullified', side: m.offSide, offense: m.offSide, z: m.los, x: m.ballX, clockStops: true };
  m.phase = 'post';
  m.postT = 0;
  m.postDur = 2.2;
  m.emit('flag', { name: flag.name, on: flag.on });
  m.emit('whistle', { result: m.result });
}

export function delayOfGame(m) {
  if (m.phase !== 'presnap' || !m.settings.penalties) return;
  penaltyNow(m, { type: 'delay', name: 'DELAY OF GAME', on: m.offSide, yards: 5, replayDown: true, dead: true });
}

// ================================================================== IN-PLAY ACTIONS
export function throwTo(m, qb, rec, opts = {}) {
  if (m.ball.carrier !== qb || (qb.action && /throw/.test(qb.action.name))) return;
  qb.act('throw', { power: opts.power ?? 0.6, side: 'R' });
  qb.mem.pending = { rec, opts };
  qb.look = { x: rec.x, y: 1.6, z: rec.z };
  rec.mem.lookedAt = true;
}

export function throwAway(m, qb) {
  if (m.ball.carrier !== qb) return;
  const F = m.field;
  const side = Math.sign(qb.x) || 1;
  qb.act('throw', { power: 0.9 });
  qb.mem.pending = { away: { x: side * (F.halfW + 4), z: qb.z + m.offDir * 6 } };
}

function releasePending(m, qb) {
  const pend = qb.mem.pending;
  qb.mem.pending = null;
  if (!pend || m.ball.carrier !== qb) return;
  const dir = m.offDir;
  const beyond = (qb.z - m.los) * dir > 0.2;
  if (pend.away) {
    const b = m.ball;
    const T = 1.1;
    b.launch(qb.x, 2.05, qb.z, pend.away.x, 1.0, pend.away.z, T, 'pass', qb);
    b.forward = true;
    b.target = null;
    m.passThrown = true; m.forwardPassed = true;
    // grounding: inside the pocket with nobody near where it lands
    const inPocket = Math.abs(qb.x - m.ballX) < 4.5 && !beyond;
    const nearby = m.offense.some((o) => o !== qb && Math.hypot(o.x - pend.away.x, o.z - pend.away.z) < 8 && !['C', 'LG', 'RG'].includes(o.role));
    if (inPocket && !nearby && m.settings.penalties && m.pressureOn(qb) > 0.3) {
      m.flags.push({ type: 'grounding', name: 'INTENTIONAL GROUNDING', on: m.offSide, spotZ: qb.z, lossOfDown: true, yards: 0 });
      m.emit('flag', { name: 'INTENTIONAL GROUNDING', on: m.offSide });
    }
    m.stat(qb, 'att');
    m.tstat(m.offSide, 'att');
    m.emit('throw', { qb, rec: null, away: true });
    return;
  }
  const rec = pend.rec;
  const power = pend.opts.powerFrom ? pend.opts.powerFrom() : pend.opts.power ?? 0.6;
  const lead = pend.opts.leadFrom ? pend.opts.leadFrom() : pend.opts.lead || null;
  const plan = planThrow(m, qb, rec, { ...pend.opts, power, lead, assist: pend.opts.assist !== false });
  pend.opts.power = power;
  const b = releasePass(m, qb, rec, plan);
  if (b.forward) {
    if (m.forwardPassed || beyond) {
      m.flags.push({ type: 'illegalPass', name: 'ILLEGAL FORWARD PASS', on: m.offSide, spotZ: qb.z, yards: 5, lossOfDown: true });
      m.emit('flag', { name: 'ILLEGAL FORWARD PASS', on: m.offSide });
    }
    m.forwardPassed = true;
    m.passThrown = true;
    m.stat(qb, 'att');
    m.tstat(qb.side, 'att');
  } else {
    m.tstat(qb.side, 'laterals');
  }
  m.passInfo = { qb, rec, plan, t: m.time };
  rec.mem.ballTarget = plan;
  m.emit('throw', { qb, rec, plan, power: pend.opts.power ?? 0.6, forward: b.forward });
}

/** Pitch it to a trailing teammate (or `to`). Returns true if it went. */
export function lateralFrom(m, e, to = null) {
  if (m.ball.carrier !== e) return false;
  if (e.state === 'down' || (e.state === 'falling' && (!e.action || e.action.t > 0.3))) return false;
  if (!to) to = pickLateralTarget(m, e);
  if (!to) return false;
  e.act('lateral', { side: (to.x - e.x) * m.dirFor(e) > 0 ? 'L' : 'R' });
  e.mem.pendingLat = to;
  return true;
}

export function pickLateralTarget(m, e, stick = null) {
  const dir = m.dirFor(e);
  let best = null, bs = -1e9;
  for (const t of m.matesOf(e)) {
    if (t === e || !t.standing || t.state === 'engaged' || ['C', 'LG', 'RG'].includes(t.role)) continue;
    const back = (e.z - t.z) * dir;            // + = behind the carrier
    const d = dist(t, e);
    if (d > 14 || d < 1.2) continue;
    let s = back > -0.3 ? 3 : -6;              // forward pitches are illegal past the line
    s -= Math.abs(d - 5) * 0.5;
    let open = 9;
    for (const o of m.foesOf(e)) if (o.standing) open = Math.min(open, dist(o, t));
    s += Math.min(open, 6) * 0.8;
    if (t.mem.support) s += 3;
    if (stick && (stick.x || stick.z)) {
      const n = norm(t.x - e.x, t.z - e.z);
      s += (n.x * stick.x + n.z * stick.z) * 5;
    }
    if (s > bs) { bs = s; best = t; }
  }
  return best;
}

export function doMove(m, e, move, side = null) {
  if (e.moveCD > 0 || !e.standing || (e.isBusyAction() && move !== 'protect')) return;
  if (m.ball.carrier !== e && !['dive'].includes(move)) return;
  const h = e.heading;
  const fx = Math.sin(h), fz = Math.cos(h);
  const lx = Math.cos(h), lz = -Math.sin(h);   // the player's left
  const sp = e.speed;
  switch (move) {
    case 'juke': {
      const s = side === 'L' ? 1 : -1;
      e.act('juke', { side });
      const k = 4 + 3 * R99(e.r.agi);
      e.boost = { vx: lx * s * k, vz: lz * s * k, t: 0.22 };
      e.vx *= 0.82; e.vz *= 0.82;
      e.moveCD = 0.7;
      break;
    }
    case 'spin':
      e.act('spin', { side: side || 'R' });
      e.immune = 0.45;
      e.vx *= 0.85; e.vz *= 0.85;
      e.moveCD = 0.9;
      break;
    case 'stiff':
      e.act('stiff', { side: side || 'L' });
      e.moveCD = 0.8;
      break;
    case 'truck':
      e.act('truck');
      e.moveCD = 0.8;
      break;
    case 'hurdle':
      e.act('hurdle');
      e.vy = 4.6;
      e.moveCD = 1.1;
      break;
    case 'dive':
      e.act('dive');
      e.boost = { vx: fx * 3.5, vz: fz * 3.5, t: 0.3 };
      e.vy = 1.4;
      e.moveCD = 2;
      break;
    case 'slide':
      e.act('slide');
      e.moveCD = 2;
      break;
    case 'protect':
      e.carry = e.carry === 'two' ? (e.mem.carrySide || 'R') : 'two';
      break;
    default: break;
  }
  void sp;
  m.emit('move', { e, move, side });
}

export function diveTackle(m, d, c) {
  if (d.action || !d.standing) return;
  const n = norm(c.x + c.vx * 0.25 - d.x, c.z + c.vz * 0.25 - d.z);
  d.act('dive_tackle');
  d.boost = { vx: n.x * 4, vz: n.z * 4, t: 0.28 };
  d.mem.diveAt = c;
}

export function callTimeout(m, side) {
  if (m.timeouts[side] <= 0 || m.phase === 'live' || m.ot) return false;
  if (m.phase === 'final' || m.phase === 'halftime') return false;
  m.timeouts[side]--;
  m.clockRunning = false;
  m.emit('timeout', { side, left: m.timeouts[side] });
  return true;
}

/** Action key moments → game events (called every live tick after actions advance). */
export function actionEvents(m, dt) {
  const b = m.ball;
  for (const e of m.active) {
    const a = e.action;
    if (!a) continue;
    if (a.name === 'throw' && e.crossed('throw', actionKey('throw', 'release'), dt)) releasePending(m, e);
    if (a.name === 'lateral' && e.crossed('lateral', actionKey('lateral', 'release'), dt)) {
      const to = e.mem.pendingLat;
      e.mem.pendingLat = null;
      if (to && b.carrier === e) {
        const plan = planToss(m, e, to);
        releaseToss(m, e, to, plan);
        if (b.forward && (m.forwardPassed || (e.z - m.los) * m.offDir > 0.2) && e.side === m.offSide) {
          m.flags.push({ type: 'illegalPass', name: 'ILLEGAL FORWARD PASS', on: e.side, spotZ: e.z, yards: 5, lossOfDown: true });
          m.emit('flag', { name: 'ILLEGAL FORWARD PASS', on: e.side });
        }
        if (b.forward) m.forwardPassed = true;
        m.tstat(e.side, 'laterals');
        m.stat(e, 'lateralsThrown');
        m.emit('lateral', { from: e, to });
      }
    }
    if (a.name === 'spike' && e.crossed('spike', 0.22, dt) && b.carrier === e) {
      b.launch(e.x, 1.2, e.z, e.x, 0, e.z + m.offDir * 0.6, 0.15, 'pass', e);
      b.forward = true;
      m.forwardPassed = true;
    }
    if (a.name === 'kneel_down' && e.crossed('kneel_down', 0.5, dt) && b.carrier === e) m.whistle('kneel', { e });
    if (a.name === 'hurdle' && e.crossed('hurdle', 0.12, dt) && e.y < 0.1) e.vy = 4.6;
    if (a.name === 'dive_tackle' && a.t > 0.15 && a.t < 0.45 && e.mem.diveAt) {
      if (tryTackle(m, e, e.mem.diveAt, 'dive')) e.mem.diveAt = null;
    }
    if (a.name === 'dive_tackle' && e.crossed('dive_tackle', 0.5, dt)) { e.state = 'falling'; e.recover = Math.max(e.recover, 1.2); e.mem.diveAt = null; }
    // the runner hits the ground: he's down
    if (b.carrier === e) {
      const ground = (a.name.startsWith('fall_') && e.crossed(a.name, actionKey(a.name, 'ground'), dt))
        || (a.name === 'pancaked' && e.crossed('pancaked', 0.5, dt))
        || (a.name === 'dive' && e.crossed('dive', actionKey('dive', 'land'), dt))
        || (a.name === 'catch_dive' && e.crossed('catch_dive', actionKey('catch_dive', 'land'), dt))
        || (a.name === 'fumble_dive' && e.crossed('fumble_dive', 0.4, dt))
        || (a.name === 'slide' && e.crossed('slide', 0.35, dt))
        || (a.name === 'cut' && e.crossed('cut', 0.3, dt));
      if (ground) m.whistle('tackle', { e });
    }
  }
}

// ================================================================== CONTACT / CATCH / RECOVER
export function onContact(m, a, b, impact) {
  const off = a.side === m.offSide ? a : b, def = a.side === m.offSide ? b : a;
  const ball = m.ball;
  // blockers lock on to the man they meant to block
  for (const [bl, d] of [[a, b], [b, a]]) {
    if (bl.mem.wantBlock === d && !bl.engaged && !d.engaged && d !== ball.carrier && bl !== ball.carrier && m.phase === 'live') {
      const kind = m.isRunning() || bl.asg?.block === 'run' || bl.asg?.block === 'lead' ? 'run' : 'pass';
      engage(m, bl, d, kind);
      return;
    }
  }
  // a rusher running into a pass protector
  if (def.asg?.type === 'rush' && off.asg?.type === 'block' && !off.engaged && !def.engaged && def !== ball.carrier
    && !(def.mem.readMan && m.playKind === 'option' && !m.optionDone)) {
    engage(m, off, def, m.isRunning() ? 'run' : 'pass');
    return;
  }
  // the ball carrier ran into a defender: a tackle attempt
  if (ball.carrier === a || ball.carrier === b) {
    const c = ball.carrier, d = c === a ? b : a;
    if (d.side !== c.side && d.standing && d.state !== 'engaged') tryTackle(m, d, c, d.ctrl !== null && d.mem.hitStick ? 'hit' : 'wrap');
    return;
  }
  // pass interference: hitting the target before the ball gets there
  if (ball.state === 'air' && ball.kind === 'pass' && ball.forward && m.settings.penalties && impact > 1.6) {
    const tgt = ball.target;
    if (tgt && (a === tgt || b === tgt)) {
      const dd = a === tgt ? b : a;
      const tLeft = (ball.flightT || 0) - ball.t;
      if (dd.side !== tgt.side && tLeft > 0.3 && !dd.mem.playBall && !m.flags.some((f) => f.type === 'dpi')) {
        if (m.rng() < 0.55) {
          m.flags.push({ type: 'dpi', name: 'PASS INTERFERENCE, DEFENSE', on: dd.side, spotZ: tgt.z, autoFirst: true, yards: 0, spotFoul: true });
          m.emit('flag', { name: 'PASS INTERFERENCE', on: dd.side });
        }
      }
    }
  }
  // roughing the passer: drilling the QB well after the ball's gone
  const qb = m.passInfo?.qb;
  if (qb && (a === qb || b === qb) && ball.carrier !== qb && m.settings.penalties) {
    const hitter = a === qb ? b : a;
    if (hitter.side !== qb.side && impact > 4.5 && m.time - m.passInfo.t > 0.9 && !m.flags.some((f) => f.type === 'roughing') && m.rng() < 0.35) {
      m.flags.push({ type: 'roughing', name: 'ROUGHING THE PASSER', on: hitter.side, yards: 15, autoFirst: true, endOfPlay: true });
      m.emit('flag', { name: 'ROUGHING THE PASSER', on: hitter.side });
    }
  }
}

export function onCatch(m, e, info) {
  const b = m.ball;
  b.kicked = false;
  e.mem.gotBallAt = m.time;
  e.mem.caughtInEZ = m.field.inOwnEndZone(e.z, m.dirFor(e));
  e.mem.noLateral = false;
  // fair catch: dead right there
  if ((info.kind === 'punt' || info.kind === 'kick') && e.mem.fairCatch && e.side !== m.offSide) {
    m.whistle('fairCatch', { e });
    return;
  }
  if (info.kind === 'kick' || info.kind === 'punt') {
    if (e.side !== m.offSide) {
      // the clock starts when the return team touches it
      if (!m.clockRunning && m.playKind === 'kickoff') m.clockRunning = true;
      m.emit('fielded', { e, kind: info.kind });
      // deep in his own end zone: take a knee (CPU)
      if (e.ctrl === null && e.mem.caughtInEZ && (e.z * -m.dirFor(e)) - m.field.halfL > 3.5) { m.whistle('touchback', { side: e.side }); return; }
    } else {
      m.emit('recoveredKick', { e });
    }
    segment(m, e, 'return');
    return;
  }
  if (info.how === 'snap') { e.carry = 'two'; return; }
  if (info.how === 'int') {
    m.stat(e, 'ints');
    m.stat(info.thrower, 'intsThrown');
    m.tstat(info.thrower?.side || m.offSide, 'ints');
    e.act('catch_chest');
    m.emit('interception', { e, by: e, thrower: info.thrower });
    segment(m, e, 'return');
    m.switchUserTo?.(e);
    autoSwitchOnPossession(m, e);
    return;
  }
  if (info.kind === 'lateral' || info.kind === 'tip' && !info.forward) {
    m.stat(e, 'lateralsCaught');
    m.emit('lateralCaught', { e });
    segment(m, e, 'rush');
    autoSwitchOnPossession(m, e);
    return;
  }
  // a completed forward pass
  if (info.forward || info.kind === 'pass' || info.kind === 'tip') {
    // feet in bounds?
    if (Math.abs(e.x) > m.field.halfW) { m.whistle('incomplete', { reason: 'oob' }); return; }
    m.passCompleted = true;
    const qb = info.thrower;
    if (qb && qb.side === e.side) { m.stat(qb, 'comp'); m.tstat(e.side, 'comp'); m.stat(e, 'rec'); }
    m.emit('catch', { e, qb, kind: info.how });
    segment(m, e, 'rec');
    autoSwitchOnPossession(m, e);
    // a catch in the end zone is six
    if (m.field.inEndZone(e.z, m.dirFor(e))) m.whistle('td', { e });
  }
}

function autoSwitchOnPossession(m, e) {
  // the person on that side now controls the man with the ball
  if (m.isUser(e.side) && !(m.lock && m.lock.side === e.side)) m.setUserEnt(e.side, e);
}

export function onRecover(m, e, dove) {
  const b = m.ball;
  const was = b.lastTeam;
  b.kicked = false;
  m.stat(e, 'fumbleRec');
  if (was && was !== e.side) m.tstat(was, 'fumblesLost');
  m.emit('recover', { e, dove, turnover: e.side !== m.offSide });
  e.mem.caughtInEZ = m.field.inOwnEndZone(e.z, m.dirFor(e));
  segment(m, e, 'return');
  autoSwitchOnPossession(m, e);
  if (dove) m.whistle('tackle', { e, recovered: true });
}

/** Yards are credited per carry segment (laterals split the play). */
export function segment(m, e, kind) {
  const segs = m.segments || (m.segments = []);
  const last = segs[segs.length - 1];
  if (last && !last.end) last.end = m.dirFor(last.e) * m.ball.z;
  segs.push({ e, kind, start: m.dirFor(e) * (kind === 'rec' ? m.los : m.ball.z), end: null });
}

// ================================================================== LOOSE BALL / FIELD
export function ballGrounded(m) {
  const b = m.ball;
  // a forward pass that hits the turf is incomplete
  if ((b.kind === 'pass' || b.kind === 'tip') && b.forward) { m.whistle('incomplete', {}); return; }
  if (b.kind === 'snap') { b.kind = 'fumble'; m.emit('fumble', { c: null, snap: true }); return; }
  if (b.isFg) { m.whistle(m.tryMode === 'pat' ? 'patMiss' : 'fgMiss', { short: true }); return; }
  if (b.kind === 'lateral') { m.emit('looseLateral', {}); }
}

export function looseBallChecks(m, dt) {
  const b = m.ball;
  const F = m.field;
  if (b.state === 'air' && b.isFg) {
    // through the uprights? (posts on the end line)
    const dir = m.offDir;
    if (b.z * dir >= F.end - 0.05 && !b.fgChecked) {
      b.fgChecked = true;
      const good = Math.abs(b.x) <= F.goalpost.width / 2 && b.y >= F.goalpost.crossbar;
      m.whistle(good ? (m.tryMode === 'pat' ? 'patGood' : 'fgGood') : (m.tryMode === 'pat' ? 'patMiss' : 'fgMiss'), { x: b.x, y: b.y, doink: Math.abs(Math.abs(b.x) - F.goalpost.width / 2) < 0.25 });
    }
    return;
  }
  if (b.state !== 'loose' && !(b.state === 'air' && b.kind === 'fumble')) {
    // a kick in the air over the sideline or the end line
    if (b.state === 'air' && (b.kind === 'kick' || b.kind === 'punt') && b.y < 3 && (Math.abs(b.x) > F.halfW || Math.abs(b.z) > F.end)) kickOut(m);
    return;
  }
  // out of bounds
  if (Math.abs(b.x) > F.halfW || Math.abs(b.z) > F.end) {
    if (b.kicked) return kickOut(m);
    // a fumble out of bounds: the last team to have it keeps it — unless it went out of an end zone
    const side = b.lastTeam || m.offSide;
    const dir = m.dirOf(side);
    if (b.z * dir > F.halfL) { m.whistle('touchback', { side: other(side) }); return; }
    if (b.z * dir < -F.halfL) { m.whistle('safety', { side }); return; }
    m.whistle('oob', { side, z: clamp(b.z, -F.halfL + 0.5, F.halfL - 0.5), x: clamp(b.x, -F.halfW, F.halfW), loose: true });
    return;
  }
  // kicks that come to rest
  if (b.kicked && b.state === 'loose') {
    const recv = other(m.offSide);
    const rdir = m.dirOf(recv);
    // into the receiving team's end zone untouched: touchback
    if (b.z * rdir < -F.halfL && !b.touched) {
      if (Math.hypot(b.vx, b.vz) < 1 || m.playKind === 'punt') { m.whistle('touchback', { side: recv }); return; }
    }
    if (Math.hypot(b.vx, b.vz) < 0.12 && b.rollT > 0.6 && m.playKind === 'punt') { m.whistle('puntDowned', { z: b.z, x: b.x }); return; }
  }
  // nobody falls on a forward pass: handled; a snap / lateral on the ground lying dead for ages
  if (b.state === 'loose' && b.rollT > 6) m.whistle('oob', { side: b.lastTeam || m.offSide, z: b.z, x: b.x, loose: true });
}

function kickOut(m) {
  const b = m.ball;
  const F = m.field;
  const recv = other(m.offSide);
  const rdir = m.dirOf(recv);
  if (b.z * rdir < -F.halfL) { m.whistle('touchback', { side: recv }); return; }
  if (m.playKind === 'kickoff') { m.whistle('kickOob', { side: recv }); return; }
  m.whistle('puntDowned', { z: clamp(b.z, -F.halfL + 0.5, F.halfL - 0.5), x: clamp(b.x, -F.halfW, F.halfW), oob: true });
}

/** Sidelines, end zones, touchdowns, safeties. */
export function fieldChecks(m, dt) {
  actionEvents(m, dt);
  if (m.phase !== 'live') return;
  const b = m.ball;
  const c = b.carrier;
  const F = m.field;
  if (m.timers?.length) runTimers(m);
  if (!c) return;
  const dir = m.dirFor(c);
  // track forward progress
  c.mem.fp = c.state === 'wrapped' || c.state === 'falling' ? Math.max(c.mem.fp ?? -1e9, b.z * dir) : b.z * dir;
  // touchdown: the ball breaks the plane
  if (b.z * dir > F.halfL && c.standing !== undefined) {
    if (c.mem.caughtInEZ && m.field.inEndZone(c.z, dir) && c.mem.gotBallAt > m.time - 0.05 && !m.passCompleted && b.history.includes('kickoff')) { /* fielded in the opponent's end zone: impossible */ }
    m.whistle('td', { e: c });
    return;
  }
  if (b.z * dir > -F.halfL) { if (c.mem.caughtInEZ) c.mem.leftEZ = true; }
  // out of bounds
  if (Math.abs(c.x) > F.halfW - 0.05) {
    if (b.z * dir < -F.halfL) {
      // out of his own end zone
      m.whistle(c.mem.caughtInEZ && !c.mem.leftEZ ? 'touchback' : 'safety', { side: c.side, e: c });
      return;
    }
    m.whistle('oob', { e: c, z: b.z, x: clamp(c.x, -F.halfW, F.halfW) });
    return;
  }
  if (Math.abs(c.z) > F.end) {
    if (b.z * dir < -F.halfL) { m.whistle(c.mem.caughtInEZ && !c.mem.leftEZ ? 'touchback' : 'safety', { side: c.side, e: c }); return; }
  }
  // the QB goes down untouched behind the line (sack by contact is in tackles)
}

export function contactTackles(m, dt) {
  const c = m.ball.carrier;
  if (!c || c.state === 'falling' || c.state === 'down') return;
  for (const d of m.foesOf(c)) {
    if (!d.standing || d.state === 'engaged' || d.state === 'wrapping' || d.recover > 0) continue;
    const dd = dist(d, c);
    if (dd > c.radius + d.radius + 0.35) continue;
    // a person's defender tackles on contact (the hit stick if he flicked it)
    if (d.ctrl !== null) {
      const kind = d.mem.hitStick && m.time - d.mem.hitStick < 0.35 ? 'hit' : d.mem.cutStick && m.time - d.mem.cutStick < 0.35 ? 'cut' : 'wrap';
      tryTackle(m, d, c, kind);
    } else tryTackle(m, d, c, 'wrap');
    if (m.ball.carrier !== c || c.state === 'falling') return;
  }
}

// ================================================================== TIMERS
export function runTimers(m) {
  const now = m.playT;
  m.timers = m.timers.filter((t) => {
    if (now >= t.at) { try { t.fn(); } catch (e) { console.error(e); } return false; }
    return true;
  });
}

// ================================================================== CLOCK
export function tickClock(m, dt) {
  if (m.ot) return;
  const before = m.clock;
  m.clock = Math.max(0, m.clock - dt);
  m.tstat(m.offSide, 'top', dt);
  twoMinuteCheck(m, before);
}

function twoMinuteCheck(m, before) {
  const q = m.quarter;
  if ((q === 2 || q === 4) && !m.twoMin[q] && m.settings.quarterLen >= 4 && before > 120 && m.clock <= 120) {
    m.twoMin[q] = true;
    m.twoMinPending = true;
  }
}

/** The clock runs between plays (huddle, line up) when it's running. */
export function runoff(m) {
  if (!m.clockRunning || m.ot || m.phase === 'final') return 0;
  const hurry = m.hurry[m.offSide];
  const secs = m.settings.accelClock ? (hurry ? 7 : 15) : (hurry ? 12 : 27);
  const before = m.clock;
  const used = Math.min(m.clock, secs);
  m.clock -= used;
  m.tstat(m.offSide, 'top', used);
  twoMinuteCheck(m, before);
  if (m.twoMinPending) { m.twoMinPending = false; m.clockRunning = false; m.clock = Math.max(m.clock, 120); m.emit('twoMinute', { quarter: m.quarter }); }
  return used;
}

// ================================================================== WHISTLE
export function whistle(m, type, data = {}) {
  if (m.phase !== 'live') return;
  const b = m.ball;
  const F = m.field;
  const e = data.e || b.carrier;
  const side = data.side || e?.side || b.lastTeam || m.offSide;
  const dir = m.dirOf(side);
  // the spot: forward progress for a runner who went down
  let z = data.z ?? b.z, x = data.x ?? b.x;
  if (e && (type === 'tackle' || type === 'kneel') && e.mem.fp !== undefined && e.mem.fp !== null) {
    const fpZ = e.mem.fp * dir;
    if ((fpZ - z) * dir > 0) z = fpZ;
  }
  if (type === 'tackle' && e?.mem.caughtInEZ !== undefined && z * dir < -F.halfL) type = e.mem.caughtInEZ && !e.mem.leftEZ ? 'touchback' : 'safety';
  const r = {
    type, side, offense: m.offSide, x, z, e: e || null,
    forward: m.forwardPassed, kind: m.playKind, data,
    clockStops: false,
    yards: 0,
  };
  // the try (PAT / two-point)
  if (m.tryMode) {
    if (m.tryMode === 'pat') {
      if (type === 'patGood') r.type = 'patGood';
      else if (type === 'td' && side === m.offSide) r.type = 'twoGood';   // a fake that scores
      else if (type === 'td') r.type = 'defTwo';
      else r.type = 'patMiss';
    } else {
      if (type === 'td' && side === m.offSide) r.type = 'twoGood';
      else if (type === 'td') r.type = 'defTwo';
      else r.type = 'twoFail';
    }
  }
  r.yards = Math.round((z - m.los) * m.dirOf(m.offSide));
  // what stops the clock
  const lateHalf = (m.quarter === 2 || m.quarter >= 4) && m.clock < 120;
  if (['incomplete', 'td', 'safety', 'touchback', 'fgGood', 'fgMiss', 'patGood', 'patMiss', 'twoGood', 'twoFail', 'defTwo', 'fairCatch', 'kickOob', 'puntDowned'].includes(r.type)) r.clockStops = true;
  if (r.type === 'oob' && lateHalf) r.clockStops = true;
  if (side !== m.offSide) r.clockStops = true;                          // change of possession
  if (m.flags.length) r.clockStops = true;
  if (r.type === 'kneel') r.clockStops = false;
  // sacks
  if ((type === 'tackle' || type === 'oob') && e && e === m.qb && !m.handedOff && !m.passThrown && (m.playKind === 'pass' || m.playKind === 'screen') && (z - m.los) * m.offDir < 0 && side === m.offSide) {
    r.sack = true;
    const by = e.mem.fallBy;
    if (by) { m.stat(by, 'sacks'); }
    m.tstat(m.defSide, 'sacks');
    m.tstat(m.offSide, 'sackYds', Math.round((m.los - z) * m.offDir));
    m.stat(e, 'sacked');
  }
  // random fouls on the play (holding, face mask)
  if (m.settings.penalties && r.type !== 'nullified') randomFlags(m, r);
  m.result = r;
  m.phase = 'post';
  m.postT = 0;
  m.postDur = r.type === 'td' || r.type === 'twoGood' ? 4.2 : r.type === 'safety' ? 3.2 : r.type.startsWith('fg') || r.type.startsWith('pat') ? 2.8 : r.type === 'incomplete' ? 2 : 2.4;
  if (b.carrier) { b.carrier.state = b.carrier.state === 'falling' ? 'falling' : 'dead'; }
  for (const a of m.active) if (a.state === 'active' || a.state === 'engaged') a.state = 'dead';
  closeSegments(m, z);
  m.emit('whistle', { result: r });
}

function randomFlags(m, r) {
  const big = r.yards >= 8 && r.side === m.offSide;
  if (big && m.engagements.some((g) => g.bal < -0.5) && m.rng() < 0.05) {
    m.flags.push({ type: 'holding', name: 'HOLDING, OFFENSE', on: m.offSide, yards: 10, replayDown: true });
    m.emit('flag', { name: 'HOLDING', on: m.offSide });
  }
  if ((r.type === 'tackle') && m.rng() < 0.005) {
    m.flags.push({ type: 'facemask', name: 'FACE MASK', on: other(r.side), yards: 15, endOfPlay: true, autoFirst: true });
    m.emit('flag', { name: 'FACE MASK', on: other(r.side) });
  }
}

function closeSegments(m, z) {
  const segs = m.segments || (m.segments = []);
  // a QB who kept it (scramble, sneak, draw, option keep) ran from the line
  const c = m.ball.carrier;
  if (!segs.length && c && c === m.qb && c.side === m.offSide && !m.passThrown && (z - m.los) * m.offDir > 0) {
    segs.push({ e: c, kind: 'rush', start: m.dirFor(c) * m.los, end: null });
  }
  for (const s of segs) if (s.end === null) s.end = m.dirFor(s.e) * z;
}

// ================================================================== ADVANCE (apply the result)
export function advance(m) {
  const r = m.result;
  if (!r) return;
  const F = m.field;
  // penalties first
  if (m.flags.length && !r.penaltyDone) {
    const f = m.flags[0];
    const beneficiary = other(f.on);
    const penRes = previewPenalty(m, r, f);
    let accept = true;
    if (f.dead || r.type === 'nullified') accept = true;
    else if (m.isUser(beneficiary) && !m.autoCalls) {
      // a person decides (the screen shows the choice); default: whatever is better
      if (m.penaltyChoice === undefined) {
        m.phase = 'penalty';
        m.pendingPenalty = { flag: f, beneficiary, play: r, preview: penRes, better: penaltyBetter(m, r, penRes, beneficiary) };
        m.emit('penaltyChoice', m.pendingPenalty);
        return;
      }
      accept = m.penaltyChoice;
    } else accept = penaltyBetter(m, r, penRes, beneficiary);
    m.penaltyChoice = undefined;
    r.penaltyDone = true;
    if (accept) {
      // a foul that takes the play back takes its numbers back too (an after-the-play
      // foul like a face mask on the tackle leaves the play standing)
      if (!f.endOfPlay) m.undoPlayStats(); else creditStats(m, r);
      m.tstat(f.on, 'penalties');
      m.tstat(f.on, 'penYds', f.yards || 0);
      m.emit('penaltyAccepted', { flag: f });
      return applyPenalty(m, r, f);
    }
    m.emit('penaltyDeclined', { flag: f });
  }
  creditStats(m, r);
  m.log.push({ q: m.quarter, clock: m.clock, off: r.offense, type: r.type, yards: r.yards, down: m.down, toGo: m.toGo, los: m.los });
  if (r.clockStops) m.clockRunning = false;
  const offense = r.offense;
  const dOff = m.dirOf(offense);
  // ---- scores and tries
  switch (r.type) {
    case 'td': {
      m.score[r.side] += 6;
      m.emit('score', { side: r.side, kind: 'td', pts: 6, e: r.e });
      if (r.side === offense) m.tstat(r.side, m.passCompleted ? 'passTd' : 'rushTd');
      if (r.e) m.stat(r.e, 'td');
      if (m.passCompleted && m.passInfo?.qb && r.side === offense) m.stat(m.passInfo.qb, 'passTd');
      if (otDecided(m)) return;
      return startPat(m, r.side);
    }
    case 'safety': {
      const scorer = other(r.side);
      m.score[scorer] += 2;
      m.emit('score', { side: scorer, kind: 'safety', pts: 2 });
      if (otDecided(m)) return;
      return afterScore(m, r.side, { safety: true });
    }
    case 'fgGood':
      m.score[offense] += 3;
      m.tstat(offense, 'fgm');
      m.emit('score', { side: offense, kind: 'fg', pts: 3, dist: m.fg?.dist });
      if (otDecided(m)) return;
      return afterScore(m, offense);
    case 'patGood':
      m.score[offense] += 1;
      m.tstat(offense, 'xpm');
      m.emit('score', { side: offense, kind: 'pat', pts: 1 });
      m.tryMode = null;
      if (otDecided(m)) return;
      return afterScore(m, offense);
    case 'twoGood':
      m.score[offense] += 2;
      m.emit('score', { side: offense, kind: 'two', pts: 2 });
      m.tryMode = null;
      if (otDecided(m)) return;
      return afterScore(m, offense);
    case 'defTwo':
      m.score[other(offense)] += 2;
      m.emit('score', { side: other(offense), kind: 'defTwo', pts: 2 });
      m.tryMode = null;
      if (otDecided(m)) return;
      return afterScore(m, offense);
    case 'patMiss': case 'twoFail':
      m.emit('tryFailed', { side: offense, kind: r.type });
      m.tryMode = null;
      if (otDecided(m)) return;
      return afterScore(m, offense);
    case 'fgMiss': {
      m.emit('fgMissed', { side: offense, data: r.data });
      // the defense takes over at the spot of the kick (or their 20)
      const d = other(offense);
      const kickSpot = m.los - dOff * 7;
      const own20 = F.ownYardZ(m.dirOf(d), F.touchbackYard);
      const z = (kickSpot - own20) * m.dirOf(d) > 0 ? kickSpot : own20;
      if (otPossessionOver(m)) return;
      m.newSeries(d, z, 0);
      return nextDown(m);
    }
    case 'touchback': {
      const z = F.ownYardZ(m.dirOf(r.side), F.touchbackYard);
      m.emit('touchback', { side: r.side });
      if (r.side !== offense && otPossessionOver(m)) return;
      m.newSeries(r.side, z, 0);
      return nextDown(m);
    }
    case 'kickOob': {
      m.newSeries(r.side, F.ownYardZ(m.dirOf(r.side), 30), 0);
      return nextDown(m);
    }
    case 'fairCatch': case 'puntDowned': {
      const recv = m.playKind === 'kickoff' || m.playKind === 'punt' ? other(offense) : r.side;
      if (r.data?.e && r.data.e.side === offense && m.playKind === 'punt' && r.type === 'puntDowned') {
        // downed by the punting team
      }
      m.newSeries(recv, r.z, r.x);
      return nextDown(m);
    }
    case 'nullified':
      return nextDown(m, true);
    default: break;
  }
  // ---- possession plays
  if (r.side !== offense) {
    // turnover or a return: new series for whoever has it
    if (otPossessionOver(m)) return;
    m.newSeries(r.side, r.z, r.x);
    if (m.playKind !== 'kickoff' && m.playKind !== 'punt') m.emit('turnover', { side: r.side });
    return nextDown(m);
  }
  if (m.playKind === 'kickoff' || (m.playKind === 'punt' && r.side === offense)) {
    // onside recovered / a muffed punt recovered by the kickers
    m.newSeries(offense, r.z, r.x);
    return nextDown(m);
  }
  // incomplete: back to the line
  const spotZ = r.type === 'incomplete' ? m.los : r.z;
  const gained = (spotZ - m.los) * dOff;
  const firstDown = (spotZ - m.firstDownZ) * dOff >= -0.001;
  if (m.down === 3) m.tstat(offense, 'third');
  if (firstDown) {
    if (m.down === 3) m.tstat(offense, 'thirdConv');
    m.tstat(offense, 'firstDowns');
    m.newSeries(offense, spotZ, r.type === 'incomplete' ? m.ballX : r.x);
    m.emit('firstDown', { side: offense });
    return nextDown(m);
  }
  m.down++;
  m.los = spotZ;
  if (r.type !== 'incomplete') m.ballX = clamp(r.x, -F.hash, F.hash);
  m.toGo = (m.firstDownZ - m.los) * dOff;
  if (m.down > 4) {
    m.emit('turnoverOnDowns', { side: offense });
    if (otPossessionOver(m)) return;
    m.newSeries(other(offense), m.los, m.ballX);
    return nextDown(m);
  }
  void gained;
  return nextDown(m);
}

/** After any play: the quarter / half / game clock, then the next phase. */
function nextDown(m, replay = false) {
  if (m.phase !== 'final') {
    if (m.tryMode === 'two') m.phase = 'playcall';
    else if (m.phase !== 'kickoff' && m.phase !== 'pat') m.phase = 'playcall';
  }
  if (replay) {
    // a flag on an extra point: the try goes round again (the kick from where the flag left
    // it), not on to a play call, which would line up a play from scrimmage for one point
    if (m.tryMode === 'pat') { m.patSpot = m.los; m.tryMode = 'choose'; m.phase = 'pat'; }
    else m.phase = m.special === 'kickoff' ? 'kickoff' : 'playcall';
  }
  if (!m.ot && m.clock <= 0 && !m.tryMode && m.phase !== 'pat') return endQuarter(m);
  m.emit('ready', { phase: m.phase });
}

function startPat(m, side) {
  m.possession = side;
  // no try needed if it can't matter: the last play of a game in overtime is handled by otDecided
  m.phase = 'pat';
  m.tryMode = 'choose';
  m.emit('patChoice', { side });
}

function afterScore(m, scorer, { safety = false } = {}) {
  m.tryMode = null;
  if (m.ot) return otNext(m);
  if (m.clock <= 0) {
    // the half / game ended on the score
    m.setupKickoff(safety ? scorer : scorer, { safety });   // placeholder, endQuarter overrides
    return endQuarter(m);
  }
  m.setupKickoff(scorer, { safety });
  m.emit('ready', { phase: 'kickoff' });
}

/** Time ran out between plays (the runoff took the rest of the quarter). */
export function endOfTime(m) { endQuarter(m); }

function endQuarter(m) {
  const q = m.quarter;
  m.emit('quarterEnd', { quarter: q });
  if (q === 1 || q === 3) {
    // switch ends: the ball goes to the same spot at the other end
    m.quarter++;
    m.clock = m.settings.quarterLen * 60;
    m.dirHome *= -1;
    m.los = -m.los; m.ballX = -m.ballX; m.firstDownZ = -m.firstDownZ;
    if (m.phase === 'kickoff') { /* a kickoff at the change keeps its spot */ m.setupKickoff(m.offSide); }
    m.emit('quarterStart', { quarter: m.quarter });
    m.emit('ready', { phase: m.phase });
    return;
  }
  if (q === 2) {
    m.quarter = 3;
    m.clock = m.settings.quarterLen * 60;
    m.timeouts = { home: 3, away: 3 };
    m.dirHome = m.firstKick === 'home' ? -1 : 1;
    m.phase = 'halftime';
    m.halftimeKick = other(m.firstKick);
    m.emit('halftime', {});
    if (m.autoCalls) resumeAfterBreak(m);
    return;
  }
  // end of regulation
  if (m.score.home !== m.score.away) return final(m);
  startOT(m);
}

export function resumeAfterBreak(m) {
  if (m.phase === 'halftime') {
    m.setupKickoff(m.halftimeKick);
    // after setupKickoff the kicking side attacks dirOf(kicker)
    m.emit('quarterStart', { quarter: 3 });
    m.emit('ready', { phase: 'kickoff' });
  }
}

function final(m) {
  m.phase = 'final';
  m.clockRunning = false;
  m.emit('final', { score: { ...m.score } });
}

// ---------------------------------------------------------------- overtime
function startOT(m) {
  m.ot = { round: 1, first: m.rng() < 0.5 ? 'home' : 'away', pos: 0, scores: [] };
  m.quarter = 5;
  m.clock = 0;
  m.timeouts = { home: 1, away: 1 };
  m.emit('overtime', { round: 1, first: m.ot.first });
  otSeries(m);
}

function otSeries(m) {
  const o = m.ot;
  const side = o.pos === 0 ? o.first : other(o.first);
  o.startScore = { ...m.score };
  m.possession = side;
  if (o.round >= 3) {
    // shootout: two-point tries
    m.tryMode = 'two';
    const F = m.field;
    const dir = m.offDir;
    m.los = F.halfL * dir - dir * F.twoPtYard;
    m.ballX = 0; m.down = 1; m.toGo = F.twoPtYard; m.firstDownZ = F.halfL * dir;
    m.phase = 'playcall';
    m.emit('ready', { phase: 'playcall' });
    return;
  }
  m.newSeries(side, m.field.ownYardZ(m.dirOf(side), m.field.L - m.field.otYard), 0);
  m.emit('ready', { phase: 'playcall' });
}

/** In OT a possession ends on any score / turnover / downs. Returns true if handled. */
function otPossessionOver(m) {
  if (!m.ot) return false;
  otNext(m);
  return true;
}

function otNext(m) {
  const o = m.ot;
  m.tryMode = null;
  if (o.pos === 0) { o.pos = 1; otSeries(m); return; }
  // both teams have had it
  if (m.score.home !== m.score.away) return final(m);
  o.round++;
  o.pos = 0;
  o.first = other(o.first);
  m.emit('overtime', { round: o.round, first: o.first });
  otSeries(m);
}

/** After a TD in OT: is it over already? (second team scored and leads, or its try decides it) */
function otDecided(m) {
  if (!m.ot) return false;
  return false;
}

// ================================================================== PENALTIES
function previewPenalty(m, r, f) {
  const dOff = m.dirOf(r.offense);
  const F = m.field;
  const onOff = f.on === r.offense;
  // base spot: previous spot unless it's a spot foul / end-of-play foul
  let base = m.los;
  if (f.spotFoul && f.spotZ !== undefined) base = f.spotZ;
  if (f.endOfPlay) base = r.type === 'incomplete' ? m.los : r.z;
  if (f.type === 'grounding' || f.type === 'illegalPass') base = f.spotZ ?? m.los;
  let yards = f.yards || 0;
  const toward = onOff ? -dOff : dOff;
  // half the distance to the goal
  const toGoal = onOff ? F.halfL + base * dOff : F.halfL - base * dOff;
  if (yards > toGoal / 2) yards = toGoal / 2;
  let z = base + toward * yards;
  if (f.type === 'dpi' && (z * dOff) > F.halfL - 1) z = (F.halfL - 1) * dOff;
  return { z, yards, base };
}

function penaltyBetter(m, r, pen, beneficiary) {
  const dOff = m.dirOf(r.offense);
  // score the play result vs the penalty for the beneficiary
  if (beneficiary === r.offense) {
    if (r.type === 'td' || r.type === 'fgGood' || r.type === 'patGood' || r.type === 'twoGood') return false;
    if (r.side !== r.offense) return true;            // they'd lose it otherwise
    const playZ = r.type === 'incomplete' ? m.los : r.z;
    const playGain = (playZ - m.los) * dOff;
    const penGain = (pen.z - m.los) * dOff;
    return penGain > playGain || (m.flags[0].autoFirst && (playZ - m.firstDownZ) * dOff < 0);
  }
  // the defense benefits from a foul on the offense
  if (r.type === 'td' || r.type === 'fgGood') return true;
  if (r.side !== r.offense) return false;            // they already have the ball
  const playZ = r.type === 'incomplete' ? m.los : r.z;
  const playGain = (playZ - m.los) * dOff;
  const penGain = (pen.z - m.los) * dOff;
  if (m.flags[0].lossOfDown) return playGain > -1;
  return penGain < playGain;
}

export function applyPenalty(m, r, f) {
  const pen = previewPenalty(m, r, f);
  const dOff = m.dirOf(r.offense);
  const F = m.field;
  m.clockRunning = false;
  m.emit('penalty', { flag: f, yards: Math.round(pen.yards) });
  if (r.side !== r.offense && f.on !== r.offense) {
    // a defensive foul on a play the defense took the ball: offense keeps it
  }
  m.possession = r.offense;
  m.los = clamp(pen.z, -F.halfL + 0.5, F.halfL - 0.5);
  if (f.on !== r.offense && (f.autoFirst || (m.los - m.firstDownZ) * dOff >= 0)) {
    m.newSeries(r.offense, m.los, m.ballX);
    return nextDown(m);
  }
  if (f.lossOfDown) m.down++;
  m.toGo = (m.firstDownZ - m.los) * dOff;
  if (m.toGo <= 0) { m.newSeries(r.offense, m.los, m.ballX); return nextDown(m); }
  if (m.down > 4) { m.newSeries(other(r.offense), m.los, m.ballX); return nextDown(m); }
  return nextDown(m, true);
}

/** The person chose on the penalty screen. */
export function choosePenalty(m, accept) {
  if (m.phase !== 'penalty') return;
  m.penaltyChoice = !!accept;
  m.phase = 'post';
  advance(m);
}

// ================================================================== STATS
function creditStats(m, r) {
  const segs = m.segments || [];
  m.segments = [];
  const off = r.offense;
  m.tstat(off, 'plays');
  if (m.drive && m.drive.side === off) m.drive.yards += r.type === 'incomplete' ? 0 : r.yards;
  for (const s of segs) {
    const y = Math.round((s.end ?? s.start) - s.start);
    if (s.e.side !== off) { m.stat(s.e, 'retYds', y); m.tstat(s.e.side, 'returnYds', y); continue; }
    if (s.kind === 'rec') {
      m.stat(s.e, 'recYds', y);
      if (m.passInfo?.qb) m.stat(m.passInfo.qb, 'passYds', y);
      m.tstat(off, 'passYds', y);
      m.tstat(off, 'yards', y);
      if (y >= 20) m.tstat(off, 'bigPlays');
      const long = m.stats.players.get(s.e.id);
      if (long) long.longRec = Math.max(long.longRec || 0, y);
    } else if (s.kind === 'rush') {
      m.stat(s.e, 'rushYds', y);
      m.stat(s.e, 'car');
      m.tstat(off, 'rushYds', y);
      m.tstat(off, 'yards', y);
      if (y >= 15) m.tstat(off, 'bigPlays');
    } else if (s.kind === 'return') {
      m.stat(s.e, 'retYds', y);
    }
  }
}
