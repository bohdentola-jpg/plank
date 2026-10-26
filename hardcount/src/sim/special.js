// Snaps and special teams: kickoffs and returns, punts and punt returns, field
// goals and extra points (and the blocks, muffs, fair catches and onside kicks
// that come with them).
import { clamp, norm, dist, headingOf } from './math.js';
import { planKick } from './passing.js';
import { setupRun } from './scripts.js';
import { carrierBrain } from './ai/offense.js';
import { pursue } from './ai/defense.js';
import { engage } from './contact.js';

const R99 = (v) => (v ?? 50) / 99;

// ================================================================== THE SNAP
export function snapBall(m) {
  const c = m.center;
  const rcv = m.qb;
  const b = m.ball;
  setupRun(m);
  if (!c || !rcv) return;
  c.act(m.form.qb === 'punt' || m.form.qb === 'hold' ? 'longsnap' : 'snap');
  b.x = c.x; b.z = c.z + m.offDir * 0.35; b.y = 0.2;
  const under = m.form.qb === 'under';
  if (under) {
    m.after(0.1, () => {
      if (m.phase !== 'live') return;
      b.give(rcv);
      b.history.push('snap');
      rcv.carry = 'two';
      rcv.act('take_snap');
      m.emit('snapCaught', { qb: rcv });
    });
    return;
  }
  // shotgun, pistol, wildcat, punt and field goal snaps fly back
  const d = Math.hypot(rcv.x - c.x, rcv.z - c.z);
  const T = d / (m.form.qb === 'punt' ? 17 : m.form.qb === 'hold' ? 16 : 14.5);
  b.launch(c.x, 0.35, c.z, rcv.x, m.form.qb === 'hold' ? 0.6 : 1.1, rcv.z, T, 'snap', c);
  b.target = rcv;
  rcv.act(m.form.qb === 'hold' ? 'hold' : 'catch_snap');
  // bad snaps happen (rarely)
  if (m.rng() < 0.006) { b.vx += (m.rng() - 0.5) * 6; b.vy += 2; m.emit('badSnap', {}); }
}

// ================================================================== KICKOFFS
export function assignKickoff(m) {
  for (const e of m.offense) e.asg = { type: e.role === 'K' ? 'kicker' : 'cover', lane: e.x };
  const play = m.dplay;
  for (const e of m.defense) {
    e.asg = { type: e.role === 'KR' ? 'returner' : 'retBlock' };
    if (play.hands) e.asg.hands = true;
  }
  if (play.reverse || play.throwback) {
    const u = m.defense.find((e) => e.role === 'U');
    if (u) u.mem.support = true;
  }
  m.kickoff = { kicked: false, type: m.play.kick || 'deep', touched: false };
}

export function kickoffSnap(m) {
  m.kickoff.runUp = true;
  m.clockRunning = false;   // the clock starts when the return team touches it
}

function doKick(m, e) {
  const F = m.field;
  const dir = m.offDir;
  const kp = m.kickParams?.[e.side];
  const type = m.kickoff.type;
  let power = kp?.power ?? clamp(0.82 + m.rng.gauss() * 0.08 + (R99(e.r.kpw) - 0.8) * 0.4, 0.4, 1);
  let acc = kp?.acc ?? m.rng.gauss() * 0.25 * (1.2 - R99(e.r.kac));
  let aim;
  if (type === 'onside') aim = { x: (m.rng() < 0.5 ? -1 : 1) * 9, z: m.los + dir * 12 };
  else if (type === 'squib') aim = { x: (m.rng() - 0.5) * 12, z: m.los + dir * 30 };
  else aim = { x: kp?.aimX ?? (m.rng() - 0.5) * 10, z: F.halfL * dir };
  const k = planKick(m, e, type === 'deep' ? 'kickoff' : type, power, acc, aim);
  const b = m.ball;
  b.state = 'air';
  b.kind = k.kind;
  b.x = e.x; b.z = e.z + dir * 0.3; b.y = 0.3;
  b.vx = k.vx; b.vy = k.vy; b.vz = k.vz;
  b.t = 0; b.thrower = e; b.lastTeam = e.side;
  b.kicked = true; b.touched = null;
  b.tumble = 9; b.spin = 0;
  b.history.push('kickoff');
  m.kickoff.kicked = true;
  m.kickoff.kickZ = b.z;
  m.emit('kick', { e, kind: 'kickoff', type, power });
}

// ================================================================== PUNT / FG
export function assignSpecialOffense(m, play) {
  if (play.kind === 'punt') {
    for (const e of m.offense) {
      if (e.role === 'P') e.asg = { type: 'punter' };
      else if (e.role === 'X' || e.role === 'Z') e.asg = { type: 'gunner' };
      else e.asg = { type: 'protector' };
    }
    m.punt = { kicked: false, aim: play.aim };
  } else if (play.kind === 'fg') {
    for (const e of m.offense) {
      if (e.role === 'H') e.asg = { type: 'holder' };
      else if (e.role === 'K') e.asg = { type: 'fgKicker' };
      else e.asg = { type: 'protector' };
    }
    m.fg = { kicked: false };
  } else if (play.kind === 'fake') {
    if (play.passer) {
      const h = m.byRole(play.passer);
      if (h) { h.asg = { type: 'qb' }; h.mem.passer = true; h.mem.phase = 'set'; h.mem.setT = -0.6; h.mem.readIdx = 0; h.mem.drop = { x: h.x, z: h.z, dur: 0.2 }; }
    }
    const k = m.byRole('K') || m.byRole('P');
    if (k && k !== m.qb) k.asg = { type: 'protector' };
  }
}

export function assignSpecialDefense(m, dplay) {
  const dir = m.offDir;
  if (dplay.kind === 'puntReturn') {
    // the best open-field athlete goes back deep
    const pool = m.defense.filter((e) => ['CB1', 'CB2', 'S'].includes(e.role));
    pool.sort((a, b) => (b.r.spd + b.r.elu + b.r.cth) - (a.r.spd + a.r.elu + a.r.cth));
    const pr = pool[0];
    const P = m.byRole('P');
    const kpw = P ? R99(P.r.kpw) : 0.8;
    // rushers first (linemen, then linebackers), corners jam the gunners, the rest set up the wall
    const order = ['DL1', 'DL2', 'LB1', 'LB2', 'S', 'CB1', 'CB2'];
    const rushSet = new Set(order.filter((r) => m.defense.some((d) => d.role === r && d !== pr)).slice(0, dplay.rush));
    for (const e of m.defense) {
      if (e === pr) {
        e.asg = { type: 'puntReturner' };
        const depth = clamp(30 + kpw * 16, 22, m.field.toGoal(m.los, dir) + 6);
        e.x = m.ballX * 0.5; e.z = m.los + dir * Math.min(depth, m.field.toGoal(m.los, dir) - 1);
        e.heading = headingOf(0, -dir);
        continue;
      }
      if (rushSet.has(e.role)) {
        e.asg = { type: 'puntRush' };
        e.base = 'stance3';
        e.z = m.los + dir * 0.9;
        continue;
      }
      if (dplay.safe) { e.asg = { type: 'zone', zone: e.role.startsWith('CB') ? (e.role === 'CB1' ? 'flatL' : 'flatR') : 'hookM' }; continue; }
      e.asg = { type: e.role.startsWith('CB') ? 'jam' : 'wall' };
    }
  } else if (dplay.kind === 'fgDefense') {
    let rushers = dplay.rush;
    for (const e of m.defense) {
      if (rushers > 0 && !e.role.startsWith('CB')) { rushers--; e.asg = { type: 'fgRush' }; e.base = 'stance3'; e.z = m.los + dir * 0.9; }
      else e.asg = { type: 'zone', zone: dplay.safe ? 'flatR' : 'hookM' };
    }
  }
}

function doPunt(m, e) {
  const dir = m.offDir;
  const F = m.field;
  const kp = m.kickParams?.[e.side];
  const power = kp?.power ?? clamp(0.85 + m.rng.gauss() * 0.1, 0.4, 1);
  const acc = kp?.acc ?? m.rng.gauss() * 0.2 * (1.2 - R99(e.r.kac));
  const corner = m.punt.aim === 'corner';
  const aim = { x: kp?.aimX ?? (corner ? (m.ballX >= 0 ? -1 : 1) * (F.halfW - 4) : (m.rng() - 0.5) * 8), z: e.z + dir * 40 };
  const k = planKick(m, e, 'punt', power * (corner ? 0.8 : 1), acc, aim);
  const b = m.ball;
  b.state = 'air'; b.kind = 'punt';
  b.x = e.x; b.z = e.z + dir * 0.4; b.y = 1.3;
  b.vx = k.vx; b.vy = k.vy; b.vz = k.vz;
  b.t = 0; b.thrower = e; b.lastTeam = e.side; b.carrier = null; e.carry = null;
  b.kicked = true; b.touched = null;
  b.spin = 40; b.tumble = 0;
  b.history.push('punt');
  m.punt.kicked = true;
  m.punt.kickZ = e.z;
  m.tstat(e.side, 'punts');
  m.emit('kick', { e, kind: 'punt', power });
  // blocked?
  for (const d of m.foesOf(e)) {
    if (!d.standing || d.asg?.type !== 'puntRush') continue;
    const dd = dist(d, e);
    const inFront = (d.z - e.z) * dir > 0;
    if (dd < 1.5 && inFront && m.rng() < 0.55 + 0.3 * R99(d.r.jmp)) return blockKick(m, d, 'punt');
  }
}

function doFieldGoal(m, e, holder) {
  const dir = m.offDir;
  const F = m.field;
  const kp = m.kickParams?.[e.side];
  const kpw = R99(e.r.kpw), kac = R99(e.r.kac);
  const dist2 = F.end - holder.z * dir;  // yards to the uprights (on the end line)
  // the CPU kicks with whatever the distance needs, plus a margin
  const need = clamp(0.35 + (dist2 - 15) / 55 / (0.6 + 0.5 * kpw), 0.3, 1);
  const power = kp?.power ?? clamp(need + 0.08 + m.rng.gauss() * 0.06, 0.25, 1);
  const acc = kp?.acc ?? m.rng.gauss() * (0.06 + (1 - kac) * 0.3 + dist2 / 300);
  const aim = { x: 0, z: F.end * dir };
  const k = planKick(m, e, 'fg', power, acc, aim);
  const b = m.ball;
  b.state = 'air'; b.kind = 'kick';
  b.x = holder.x; b.z = holder.z + dir * 0.2; b.y = 0.15;
  b.vx = k.vx; b.vy = k.vy; b.vz = k.vz;
  b.t = 0; b.thrower = e; b.lastTeam = e.side; b.carrier = null; holder.carry = null;
  b.kicked = true; b.isFg = true;
  b.tumble = 9; b.spin = 0;
  b.history.push('fg');
  m.fg.kicked = true;
  m.fg.dist = Math.round(dist2);
  m.tstat(e.side, m.tryMode === 'pat' ? 'xpa' : 'fga');
  m.emit('kick', { e, kind: m.tryMode === 'pat' ? 'pat' : 'fg', power, dist: m.fg.dist });
  for (const d of m.foesOf(e)) {
    if (!d.standing || d.asg?.type !== 'fgRush') continue;
    const dd = Math.hypot(d.x - holder.x, d.z - holder.z);
    const inFront = (d.z - holder.z) * dir > 0;
    if (dd < 1.6 && inFront && m.rng() < 0.4 + 0.4 * R99(d.r.jmp)) return blockKick(m, d, 'fg');
  }
}

function blockKick(m, d, what) {
  const b = m.ball;
  b.vx = (m.rng() - 0.5) * 5; b.vz = -b.vz * 0.15; b.vy = 3 + m.rng() * 3;
  b.kind = 'fumble';      // a blocked kick is a loose ball
  b.isFg = false;
  b.kicked = false;
  d.act('jump_swat');
  m.emit('blockedKick', { d, what });
  m.stat(d, 'blockedKicks');
}

// ================================================================== BRAINS
/** Special-teams roles before the ball is caught. Returns true if it handled e. */
export function specialBrain(m, e, dt) {
  const a = e.asg?.type;
  const b = m.ball;
  const dir = m.offDir;
  switch (a) {
    case 'kicker': {
      if (!m.kickoff.runUp) { e.setWant(0, 0, 0); return true; }
      if (!m.kickoff.kicked) {
        const tx = b.x - Math.sin(e.heading) * 0.55, tz = b.z - dir * 0.55;
        const d = Math.hypot(tx - e.x, tz - e.z);
        e.setWant(tx - e.x, tz - e.z, Math.min(0.85, d * 0.5 + 0.35));
        if (d < 0.75 && !e.action) e.act('kick');
        if (e.crossed('kick', 0.28, dt) || (e.action?.name === 'kick' && e.action.t >= 0.28 && !m.kickoff.kicked)) doKick(m, e);
        return true;
      }
      return false;   // after the kick he's a safety valve: pursue
    }
    case 'cover': {
      if (!m.kickoff.kicked) {
        // hold the line until the kicker is about there
        const k = m.byRole('K');
        const go = k && Math.hypot(k.x - b.x, k.z - b.z) < 2.5;
        e.setWant(0, dir, go ? 0.7 : 0);
        if (go && (e.z - m.los) * dir > -0.3) e.setWant(0, 0, 0);
        return true;
      }
      if (m.ball.carrier) return false;
      // run your lane, then converge on the ball
      const land = landing(m);
      const toLand = (land.z - e.z) * dir;
      const lx = toLand > 15 ? clamp(e.asg.lane * 0.85 + land.x * 0.15, -m.field.halfW + 2, m.field.halfW - 2) : land.x;
      e.goTo(lx, land.z, 1, null, 0.05);
      return true;
    }
    case 'returner':
    case 'puntReturner': {
      if (b.carrier) return false;
      if (b.state === 'air' && (b.kind === 'kick' || b.kind === 'punt') && b.kicked) {
        const land = landing(m);
        e.look = { x: b.x, y: b.y, z: b.z };
        // deep in the end zone: let it go
        const deep = (land.z * -dir) - m.field.halfL;
        if (a === 'returner' && deep > 5 && e.ctrl === null) { e.goTo(land.x, -dir * m.field.halfL - dir * 0.5 * 0, 0.5); e.mem.fielding = false; return true; }
        // punt landing inside the 6: let it bounce toward the end zone
        if (a === 'puntReturner' && e.ctrl === null) {
          const toOwnGoal = (land.z * -dir) + m.field.halfL;   // yards in front of his own goal line
          if (toOwnGoal < 6) { e.goTo(land.x, land.z - dir * 4, 0.6); e.mem.fielding = false; return true; }
          // fair catch when the coverage will be on him
          const tLeft = b.timeToHeight(1.2) ?? 0;
          const close = m.foesOf(e).some((o) => o.standing && Math.hypot(o.x - land.x, o.z - land.z) - o.vTop * tLeft < 4);
          if (close) e.mem.fairCatch = true;
        }
        e.mem.fielding = true;
        e.goTo(land.x, land.z, 1, headingOf(0, -dir), 0.3);
        return true;
      }
      if (b.state === 'loose') { e.goTo(b.x, b.z, 1, null, 0.05); return true; }
      return false;
    }
    case 'retBlock': {
      if (b.carrier) return false;
      if (e.asg.hands && b.state !== 'held') { const land = landing(m); e.goTo(land.x, land.z, 1); return true; }
      // retreat, then pick up a coverage man
      // retreat with the kick, then turn and pick somebody up
      if (!m.kickoff?.kicked || b.t < 1.2) { e.setWant(0, dir, m.kickoff?.kicked ? 0.6 : 0, headingOf(0, -dir)); return true; }
      return retBlock(m, e, dt);
    }
    case 'punter': {
      if (m.punt.kicked) return false;
      if (b.carrier === e && !e.action) e.act('punt');
      if (e.crossed('punt', 0.55, dt)) doPunt(m, e);
      e.setWant(0, 0, 0);
      return true;
    }
    case 'holder': {
      if (m.fg.kicked) { e.setWant(0, 0, 0); return true; }
      if (b.carrier === e) { e.base = 'kneel'; b.y = 0.3; if (!m.fg.placedAt) m.fg.placedAt = m.time; }
      e.setWant(0, 0, 0);
      return true;
    }
    case 'fgKicker': {
      if (m.fg.kicked) { e.setWant(0, 0, 0); return true; }
      const h = m.byRole('H');
      if (!h || !m.fg.placedAt) { e.setWant(0, 0, 0); return true; }
      // two steps and a swing: plant beside and behind the ball
      const tx = h.x - 0.55, tz = h.z - dir * 0.7;
      const d = Math.hypot(tx - e.x, tz - e.z);
      e.setWant(tx - e.x, tz - e.z, Math.min(0.7, d * 0.6 + 0.2));
      if (m.time - m.fg.placedAt > 0.25 && (d < 0.6 || m.time - m.fg.placedAt > 1.2) && !e.action) e.act('kick');
      if (e.crossed('kick', 0.28, dt)) doFieldGoal(m, e, h);
      return true;
    }
    case 'protector': {
      if (m.playKind === 'punt' && m.punt?.kicked && m.playT > 1.6) return coverPunt(m, e);
      if (e.state === 'engaged') return true;
      // pass-set on whoever comes
      let tgt = null, bd = 9;
      for (const d of m.defense) {
        if (!d.standing || d.engaged) continue;
        const dd = dist(d, e);
        if (dd < bd && (d.z - e.z) * dir > -1.5) { bd = dd; tgt = d; }
      }
      const kick = m.byRole('P') || m.byRole('H');
      if (tgt && kick) {
        const n = norm(kick.x - tgt.x, kick.z - tgt.z);
        e.goTo(tgt.x + n.x * 0.75, tgt.z + n.z * 0.75, 0.8, headingOf(0, dir), 0.2);
        e.mem.wantBlock = tgt;
      } else e.setWant(0, 0, 0);
      return true;
    }
    case 'gunner': {
      if (m.punt?.kicked && b.carrier) return false;
      return coverPunt(m, e);
    }
    case 'puntRush':
    case 'fgRush': {
      if (b.carrier && b.carrier.side === e.side) return false;
      if ((m.punt?.kicked || m.fg?.kicked) && b.state === 'air') return false;
      const k = m.byRole('P') || m.byRole('H') || m.byRole('K');
      if (k) { e.mem.goal = { x: k.x, z: k.z }; e.goTo(k.x, k.z + dir * 0.6, 1, null, 0.05); }
      return true;
    }
    case 'jam': {
      // jam the gunner on your side, then run with him
      if (b.carrier && b.carrier.side === e.side) return false;
      if (!e.mem.jamTgt) {
        const gs = m.offense.filter((o) => o.asg?.type === 'gunner' && !m.defense.some((d) => d !== e && d.mem.jamTgt === o));
        gs.sort((a2, b2) => Math.abs(a2.x - e.x) - Math.abs(b2.x - e.x));
        e.mem.jamTgt = gs[0] || null;
      }
      const t = e.mem.jamTgt;
      if (t) { e.goTo(t.x, t.z + dir * 0.9, 1, null, 0.05); e.mem.wantBlock = t; } else e.asg = { type: 'wall' };
      return true;
    }
    case 'wall': {
      // drop back toward the returner and pick off the first cover man downfield
      if (b.carrier && b.carrier.side === e.side) return false;
      const pr = m.defense.find((d) => d.asg?.type === 'puntReturner');
      if (!m.punt?.kicked || b.state !== 'held') {
        if (pr) e.goTo(pr.x + (e.role === 'LB1' ? -4 : 4), pr.z - dir * 9, 0.85);
        return true;
      }
      return retBlock(m, e, dt);
    }
    default:
      return false;
  }
}

function coverPunt(m, e) {
  const b = m.ball;
  const land = b.state === 'air' ? landing(m) : { x: b.x, z: b.z };
  e.goTo(land.x, land.z, 1, null, 0.05);
  // down a rolling punt
  if (b.state === 'loose' && b.kicked && Math.hypot(b.x - e.x, b.z - e.z) < 0.9 && !b.touched) {
    m.whistle('puntDowned', { z: b.z, x: b.x, e });
  }
  return true;
}

function retBlock(m, e, dt) {
  // the nearest coverage man nobody has
  let tgt = e.mem.rbTgt;
  if (!tgt || !tgt.standing || tgt.engaged) {
    tgt = null; let bd = 1e9;
    const ret = m.defense.find((d) => d.asg?.type === 'returner' || d.asg?.type === 'puntReturner') || m.ball;
    for (const o of m.offense) {
      if (!o.standing || o.engaged) continue;
      const claimed = m.defense.some((d) => d !== e && d.mem.rbTgt === o);
      const s = dist(o, e) + dist(o, ret) * 0.5 + (claimed ? 8 : 0);
      if (s < bd) { bd = s; tgt = o; }
    }
    e.mem.rbTgt = tgt;
  }
  if (!tgt) { e.setWant(0, 0, 0); return true; }
  const ret = m.ball.carrier || m.ball;
  const n = norm(ret.x - tgt.x, ret.z - tgt.z);
  e.goTo(tgt.x + n.x * 0.8, tgt.z + n.z * 0.8, 1, null, 0.1);
  e.mem.wantBlock = tgt;
  e.mem.pushDir = norm(tgt.x - ret.x, tgt.z - ret.z);
  return true;
}

/** Where the ball in the air comes down (returner height). */
export function landing(m) {
  const b = m.ball;
  const t = b.timeToHeight(1.2) ?? 0;
  return b.predict(t, {});
}

export { carrierBrain, pursue, engage };
