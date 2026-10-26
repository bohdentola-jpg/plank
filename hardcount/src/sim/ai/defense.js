// Defensive brains: pass rush, man coverage, zone coverage, spies, pursuit,
// and breaking on the ball. Defenders react to what they *saw* a moment ago
// (reaction times from awareness / play recognition / coverage ratings), so a
// crisp route break or a pump fake buys real separation.
import { clamp, norm, dist, headingOf, intercept } from '../math.js';
import { ZONES } from '../plays/defense.js';
import { tryTackle } from '../contact.js';

const R99 = (v) => (v ?? 50) / 99;
const tmp = {}, tmp2 = {};

/** Seconds this defender needs to recognise a run / a throw. */
export function reaction(e, kind) {
  const prc = R99(e.r.prc), awr = R99(e.r.awr);
  if (kind === 'run') return 0.18 + 0.55 * (1 - prc) * (0.6 + 0.4 * (1 - awr));
  if (kind === 'throw') return 0.08 + 0.38 * (1 - (prc * 0.5 + awr * 0.5));
  return 0.25;
}

// ================================================================== RUSH
export function rushBrain(m, e, dt) {
  const qb = m.ball.carrier;
  const dir = m.offDir;
  const asg = e.asg;
  // read run: a handoff / a runner past the line turns him into a pursuer
  if (m.runRead(e)) return pursue(m, e, dt);
  const tgt = qb || m.qb;
  if (!tgt) { e.setWant(0, 0, 0); return; }
  e.mem.goal = { x: tgt.x, z: tgt.z };
  if (e.state === 'engaged') {
    // fight toward the QB around the block
    const n = norm(tgt.x - e.x, tgt.z - e.z);
    e.setWant(n.x, n.z, 1);
    return;
  }
  // rush lane: get to the lane's spot at the line, then bend to the QB
  const side = asg.sideW ?? 1;  // world side
  const laneX = { A: 0.75, B: 2.1, C: 3.5, edge: 5.2, contain: 5.6 }[asg.rush] ?? 2;
  const lx = m.ballX + side * laneX;
  const pastLine = (m.los - e.z) * dir > -0.2;
  let tx, tz;
  if (!pastLine && m.playT < 1.2) { tx = lx; tz = m.los - dir * 0.6; } else { tx = tgt.x; tz = tgt.z; }
  // contain: stay outside the QB, don't let him escape the pocket
  if (asg.rush === 'contain' || asg.rush === 'edge') {
    const outX = tgt.x + side * 1.4;
    if ((e.x - outX) * side < 0) tx = outX;
  }
  e.goTo(tx, tz, 1, null, 0.05);
  // close enough to the QB: go get him
  if (tgt === m.ball.carrier) {
    const d = dist(e, tgt);
    if (d < 1.15) tryTackle(m, e, tgt, e.ctrl !== null ? 'wrap' : (m.rng() < 0.25 ? 'hit' : 'wrap'));
    else if (d < 2.0 && tgt.speed > 3 && e.speed > 4 && m.rng() < dt * 2) { e.act('dive_tackle'); tryTackle(m, e, tgt, 'dive'); }
  }
  // batted balls at the line: a big DL gets a hand up when the QB winds up
  const qa = tgt.action;
  if (qa && qa.name === 'throw' && qa.t < 0.2 && dist(e, tgt) < 3.2 && !e.action && m.rng() < 0.08 * R99(e.r.jmp)) {
    e.act('jump_swat');
    e.vy = 2.6;
  }
}

// ================================================================== MAN
export function manBrain(m, e, dt) {
  const asg = e.asg;
  const r = asg.target;
  if (!r || !r.standing && r !== m.ball.carrier) { e.asg = { type: 'zone', zone: asg.fallback || 'hookM' }; return; }
  if (m.ballThrown()) return ballhawk(m, e, dt);
  if (m.runRead(e) && (asg.tech !== 'press' || m.playT > 1.2)) return pursue(m, e, dt);
  const c = m.ball.carrier;
  if (c && c === r) return pursue(m, e, dt);
  const dir = m.offDir;
  // press: jam at the snap
  if (asg.tech === 'press' && m.playT < 0.6 && !e.mem.jammed && dist(e, r) < 1.6) {
    e.mem.jammed = true;
    e.act('jam');
    const win = (R99(e.r.prs) * 0.6 + R99(e.r.str) * 0.4) - (R99(r.r.str) * 0.3 + R99(r.r.rte) * 0.3 + R99(r.r.agi) * 0.4) + m.rng.gauss() * 0.25;
    if (win > 0) r.mem.jamT = 0.25 + win * 0.6;      // he's held up at the line
    else { e.recover = 0.35 + (-win) * 0.5; m.emit('jamBeat', { e, r }); }  // whiffed: beaten off the line
  }
  // react to where he was a moment ago (a sharp break buys separation)
  const lag = 0.12 + 0.3 * (1 - R99(e.r.mcv)) * (0.6 + 0.4 * R99(r.r.rte)) + (r.mem.fakeT ? 0.15 : 0);
  r.delayed(lag, tmp);
  const leadT = 0.25;
  let tx = tmp.x + tmp.vx * leadT, tz = tmp.z + tmp.vz * leadT;
  // leverage: a yard inside (toward the ball) or outside, and a step off him
  const inSign = Math.sign(m.ballX - r.x) || 1;
  const lev = asg.help === 'in' ? -0.6 : asg.help === 'out' ? 0.6 : 0.5;
  tx += inSign * lev;
  const depthOff = asg.tech === 'off' ? clamp(6 - m.playT * 3, 1, 6) : 0.9;
  // stay on top early (between him and the goal line), trail later
  const vDeep = tmp.vz * dir;
  tz += dir * (vDeep > 3 ? 1.0 : depthOff * 0.35);
  const face = vDeep > 4 && (r.z - e.z) * dir > -1.5 ? null : headingOf(0, -dir);
  e.goTo(tx, tz, 1, face, 0.12);
  e.look = r.mem.lookedAt ? { x: m.qb?.x ?? r.x, y: 1.8, z: m.qb?.z ?? r.z } : { x: r.x, y: 1.6, z: r.z };
}

// ================================================================== ZONE
export function zoneSpot(m, zoneId) {
  const Z = ZONES[zoneId] || ZONES.hookM;
  const F = m.field;
  const dir = m.offDir;
  // play-space x fraction → world, shaded toward the ball's hash
  const px = Z.x * F.W;
  const x = clamp(m.ballX * 0.45 - px * dir, -F.halfW + 2, F.halfW - 2);
  let z = m.los + Z.z * dir;
  // never deeper than the back of the end zone
  if (Math.abs(z) > F.end - 1) z = (F.end - 1) * Math.sign(z);
  return { x, z, deep: !!Z.deep };
}

export function zoneBrain(m, e, dt) {
  if (m.ballThrown()) return ballhawk(m, e, dt);
  if (m.runRead(e)) return pursue(m, e, dt);
  const c = m.ball.carrier;
  if (c && c.side !== e.side && c !== m.qb) return pursue(m, e, dt);
  if (c === m.qb && m.qb.mem.phase === 'scramble' && (c.z - m.los) * m.offDir > -0.5) return pursue(m, e, dt);
  const dir = m.offDir;
  const spot = zoneSpot(m, e.asg.zone);
  const R = spot.deep ? 9 : 6.5;
  // the most dangerous receiver in (or heading into) my area
  let threat = null, best = 1e9;
  for (const r of m.offense) {
    if (!r.mem.route || r.mem.blocking || !r.standing) continue;
    r.delayed(0.15, tmp);
    const px = tmp.x + tmp.vx * 0.4, pz = tmp.z + tmp.vz * 0.4;
    const d = Math.hypot(px - spot.x, (pz - spot.z) * (spot.deep ? 0.6 : 1));
    if (d > R) continue;
    // deep zones: whoever is deepest; underneath: the nearest
    const s = spot.deep ? -((pz - m.los) * dir) + d * 0.3 : d;
    // the QB's eyes pull a smart zone defender toward the read
    const eyes = m.qb?.look && Math.hypot(m.qb.look.x - r.x, m.qb.look.z - r.z) < 2 ? 2.5 * R99(e.r.prc) : 0;
    if (s - eyes < best) { best = s - eyes; threat = r; }
  }
  let tx = spot.x, tz = spot.z;
  if (threat) {
    threat.delayed(0.18, tmp);
    if (spot.deep) {
      // stay deeper than him and inside
      tx = tmp.x * 0.7 + spot.x * 0.3;
      tz = Math.max((tmp.z - m.los) * dir + 3, (spot.z - m.los) * dir * 0.8) * dir + m.los;
    } else {
      // undercut: sit between him and the QB
      const qb = m.qb || m.ball.carrier;
      tx = tmp.x * 0.65 + spot.x * 0.35;
      tz = tmp.z - dir * 1.2;
      if (qb) { tx += (qb.x - tx) * 0.12; }
    }
    // leash: don't get dragged out of the zone
    const lx = clamp(tx, spot.x - R, spot.x + R);
    tx = lx;
  }
  const deepDrop = spot.deep && m.playT < 1.4;
  const face = deepDrop ? null : headingOf(0, -dir);
  e.goTo(tx, tz, deepDrop ? 1 : 0.92, face, 0.25);
  const qb = m.qb || m.ball.carrier;
  e.look = qb ? { x: qb.x, y: 1.8, z: qb.z } : null;
}

// ================================================================== SPY
export function spyBrain(m, e, dt) {
  if (m.ballThrown()) return ballhawk(m, e, dt);
  const qb = m.ball.carrier;
  if (!qb) return pursue(m, e, dt);
  const dir = m.offDir;
  if (qb !== m.qb || (qb.z - m.los) * dir > -0.5) return pursue(m, e, dt);
  e.goTo(qb.x, m.los + dir * 4.5, 0.9, headingOf(0, -dir));
  e.look = { x: qb.x, y: 1.8, z: qb.z };
}

// ================================================================== BALL IN THE AIR
export function ballhawk(m, e, dt) {
  const b = m.ball;
  const mem = e.mem;
  if (b.state !== 'air') return pursue(m, e, dt);
  if (mem.hawkT === undefined) mem.hawkT = m.time + reaction(e, 'throw') * (e.asg?.type === 'man' && !mem.facingQb ? 1.35 : 1);
  if (m.time < mem.hawkT) {
    // still running with his man / in his zone a beat
    if (e.asg?.target) { const r = e.asg.target; e.goTo(r.x, r.z, 1, null, 0.1); } else e.setWant(e.vx, e.vz, 0.8);
    return;
  }
  e.look = { x: b.x, y: b.y, z: b.z };
  const T = b.timeToHeight(1.25) ?? 0.3;
  const P = b.predict(T, tmp2);
  const d = Math.hypot(P.x - e.x, P.z - e.z);
  const tReach = d / Math.max(4, e.vTop);
  const r = b.target;
  if (tReach < T + 0.08 && d < 14) {
    // he can get there: play the ball
    mem.playBall = true;
    e.goTo(P.x, P.z, 1, null, 0.3);
    const high = P.y > e.height * 0.62 + 0.6;
    if (T < 0.3 && !e.action) {
      if (high && m.rng() < 0.7) { e.act('jump_swat'); e.vy = 2.8 + R99(e.r.jmp) * 1.2; } else if (d > 1.3 && d < 2.5) { e.act('catch_dive'); e.boost = { vx: (P.x - e.x) / d * 2.5, vz: (P.z - e.z) / d * 2.5, t: 0.25 }; } else if (m.rng() < 0.5) e.act('swat', { side: 'R' });
    }
    e.reachAt = { x: b.x, y: b.y, z: b.z };
  } else if (r) {
    // play the man: arrive at the catch to hit him
    mem.playBall = false;
    const it = intercept(e, e.vTop, r, { x: r.vx, z: r.vz });
    if (it && it.t < 3) e.goTo(it.x, it.z, 1, null, 0.05); else e.goTo(P.x, P.z, 1, null, 0.05);
  } else e.goTo(P.x, P.z, 1);
}

// ================================================================== PURSUIT
export function pursue(m, e, dt) {
  const c = m.ball.carrier;
  const b = m.ball;
  if (!c) {
    // loose ball: get on it
    if (b.state === 'loose' || (b.state === 'air' && b.kind === 'fumble')) {
      e.goTo(b.x, b.z, 1, null, 0.05);
      e.mem.diveForBall = Math.hypot(b.x - e.x, b.z - e.z) < 1.6;
      return;
    }
    if (b.state === 'air') return ballhawk(m, e, dt);
    e.setWant(0, 0, 0);
    return;
  }
  if (c.side === e.side) { e.setWant(0, 0, 0); return; }
  if (e.state === 'engaged') {
    e.mem.goal = { x: c.x, z: c.z };
    const n = norm(c.x - e.x, c.z - e.z);
    e.setWant(n.x, n.z, 1);
    // an arm tackle off the block if he runs right past
    if (dist(e, c) < 1.3) tryTackle(m, e, c, 'arm');
    return;
  }
  e.look = { x: c.x, y: 1.3, z: c.z };
  const d = dist(e, c);
  const sp = Math.hypot(c.vx, c.vz);
  const ux = sp > 0.5 ? c.vx / sp : 0, uz = sp > 0.5 ? c.vz / sp : 0;
  // where am I relative to his run? (ahead > 0: he's running at me)
  const ahead = ((e.x - c.x) * ux + (e.z - c.z) * uz) / Math.max(0.1, d);
  let tx, tz, s = 1;
  if (d < 1.35 && e.ctrl === null) {
    tryTackle(m, e, c, m.rng() < 0.12 * R99(e.r.hit) ? 'hit' : 'wrap');
    if (m.ball.carrier !== c || !e.standing) return;
  }
  if (ahead > 0.35 && d < 4) {
    // he's coming at me: square up, mirror his cuts, don't overrun
    tx = c.x + c.vx * 0.22; tz = c.z + c.vz * 0.22;
    s = 0.82 + 0.18 * R99(e.r.tak);
  } else {
    // take the angle: the real intercept on his line, but don't lead him past where he can cut back
    const it = intercept(e, e.vTop * 0.97, c, { x: c.vx, z: c.vz });
    if (it && it.t < 2.5) {
      const k = Math.min(1, 1.1 / Math.max(0.2, it.t));
      tx = it.x * k + (c.x + c.vx * 0.45) * (1 - k);
      tz = it.z * k + (c.z + c.vz * 0.45) * (1 - k);
    } else {
      // can't head him off: chase his hip
      tx = c.x + c.vx * 0.4; tz = c.z + c.vz * 0.4;
    }
    // near a sideline: the sideline is the extra defender — take away the inside
    const edge = m.field.halfW - Math.abs(c.x);
    if (edge < 6 && d > 2) tx -= Math.sign(c.x) * (6 - edge) * 0.12;
  }
  e.goTo(tx, tz, s, null, 0.02);
  // he's slipping by: lay out for him
  if (e.ctrl === null && !e.action && d > 1.3 && d < 2.3) {
    const closing = ((e.vx - c.vx) * (c.x - e.x) + (e.vz - c.vz) * (c.z - e.z)) / Math.max(0.1, d);
    if (closing < 1.2 && m.rng() < dt * 4) m.diveTackle(e, c);
  }
}
