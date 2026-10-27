// A person on a controller driving one player. The match screen turns the
// DualSense (or keyboard) into a command each frame:
//   cmd = { move: {x, z} world dir |v| ≤ 1, sprint 0..1 (R2), pressed / held /
//           released: Sets of button names, flick: null | { dir: 'up'|'down'|'left'|'right', x, z } }
// and this decides what that means for whoever he controls right now.
import { clamp, norm, dist, headingOf } from './math.js';
import { qbBrain, carrierBrain, routeBrain } from './ai/offense.js';
import { tryTackle, userShed, checkFumble } from './contact.js';
import { pitchTo } from './scripts.js';
import { pickLateralTarget } from './rules.js';

const FACE = ['cross', 'circle', 'square', 'triangle'];

export function userControl(m, e, cmd, dt, presnap) {
  const mv = cmd.move || { x: 0, z: 0 };
  const mag = Math.min(1, Math.hypot(mv.x, mv.z));
  const P = cmd.pressed || new Set();
  const side = e.side;
  if (presnap) {
    // the defense can shift a man before the snap (careful: offside)
    if (side === m.defSide && mag > 0.15) e.setWant(mv.x, mv.z, mag * 0.45, headingOf(0, -m.offDir));
    else e.setWant(0, 0, 0);
    return;
  }
  const b = m.ball;
  const has = b.carrier === e;
  // run speed: the stick runs at ~80 %, R2 opens it up all the way
  const s = mag > 0.12 ? mag * (0.8 + 0.2 * (cmd.sprint || 0)) : 0;
  if (mag > 0.25) e.mem.userMoved = true;

  if (e.state === 'engaged') {
    if (P.has('cross') || P.has('square')) userShed(m, e);
    e.setWant(mv.x, mv.z, s);
    return;
  }
  if (e.state === 'wrapped') {
    e.setWant(mv.x || 0, mv.z || m.dirFor(e), 1);
    if (P.has('l1')) m.lateralFrom(e, pickLateralTarget(m, e, mv));
    return;
  }

  // ---------------------------------------------------------- with the ball
  if (has) {
    const qbPassing = e === m.qb && e.side === m.offSide && !m.handedOff && (m.los - e.z) * m.offDir > -0.3 && (m.playKind === 'pass' || m.playKind === 'screen' || m.playKind === 'trick' || e.mem.passer || m.playKind === 'option' && !m.optionDone || m.playKind === 'run' && !m.mesh?.done);
    if (qbPassing) return userQB(m, e, cmd, dt, s, mag);
    return userCarrier(m, e, cmd, dt, s, mag);
  }

  // ---------------------------------------------------------- ball in the air
  if (b.state === 'air' && (b.kind === 'pass' || b.kind === 'lateral' || b.kind === 'tip')) {
    const toUs = b.lastTeam === side;
    if (toUs) {
      // a receiver: drift with the stick, the AI tracks the ball when it's idle
      if (P.has('triangle')) e.mem.catchType = 'high';
      if (P.has('cross')) e.mem.catchType = 'dive';
      if (P.has('circle')) e.mem.catchType = 'possession';
      const tLeft = b.timeToHeight(e.height * 0.62) ?? 1;
      if (e.mem.catchType === 'high' && tLeft < 0.35 && !e.action) { e.act('catch_high'); e.vy = 3.2 + (e.r.jmp / 99) * 1.4; }
      if (e.mem.catchType === 'dive' && tLeft < 0.32 && !e.action) {
        const P2 = b.predict(tLeft, {});
        const n = norm(P2.x - e.x, P2.z - e.z);
        e.act('catch_dive');
        e.boost = { vx: n.x * 3.2, vz: n.z * 3.2, t: 0.25 };
      }
      if (mag > 0.2) { e.setWant(mv.x, mv.z, s); e.look = { x: b.x, y: b.y, z: b.z }; } else routeBrain(m, e, dt);
      e.reachAt = { x: b.x, y: b.y, z: b.z };      // the hands go to the ball as it gets near
      return;
    }
    // a defender: play the ball (a career man who leaves the stick alone plays it himself)
    if (m.lock && m.lock.side === side && mag < 0.15 && !P.size) return 'ai';
    if (P.has('triangle') && !e.action) { e.act('jump_swat'); e.vy = 2.8 + (e.r.jmp / 99) * 1.2; e.mem.wantInt = true; e.mem.playBall = true; }
    if (P.has('square') && !e.action) { e.act('swat', { side: 'R' }); e.mem.playBall = true; }
    if (P.has('cross') && !e.action) {
      const tLeft = b.timeToHeight(1.2) ?? 0.5;
      const P2 = b.predict(tLeft, {});
      const d = Math.hypot(P2.x - e.x, P2.z - e.z);
      if (d < 3) { const n = norm(P2.x - e.x, P2.z - e.z); e.act('catch_dive'); e.boost = { vx: n.x * 3, vz: n.z * 3, t: 0.25 }; e.mem.wantInt = true; e.mem.playBall = true; }
    }
    if (P.has('circle')) m.switchDefender(side);
    e.setWant(mv.x, mv.z, s);
    e.look = { x: b.x, y: b.y, z: b.z };
    if (e.mem.playBall) e.reachAt = { x: b.x, y: b.y, z: b.z };
    return;
  }

  // ---------------------------------------------------------- a returner waiting on a kick
  if ((e.asg?.type === 'returner' || e.asg?.type === 'puntReturner') && b.state === 'air' && b.kicked) {
    if (P.has('triangle')) { e.mem.fairCatch = true; m.emit('fairCatchSignal', { e }); }
    if (mag > 0.2) e.setWant(mv.x, mv.z, s);
    else {
      const t = b.timeToHeight(1.2) ?? 0;
      const L = b.predict(t, {});
      e.goTo(L.x, L.z, 1, headingOf(0, -m.dirFor(e)), 0.3);
    }
    return;
  }

  // ---------------------------------------------------------- defense (or blocking)
  // a career man left alone does his job (his route, his block, his coverage)
  if (m.lock && m.lock.side === side && mag < 0.15 && !P.size) return 'ai';
  const c = b.carrier;
  if (c && c.side !== side) {
    const d = dist(e, c);
    if (P.has('cross') && d < 2.6 && !e.action) m.diveTackle(e, c);
    if (cmd.flick?.dir === 'up') { e.mem.hitStick = m.time; if (d < 2.6) { const n = norm(c.x - e.x, c.z - e.z); e.boost = { vx: n.x * 3, vz: n.z * 3, t: 0.2 }; } }
    if (cmd.flick?.dir === 'down') { e.mem.cutStick = m.time; if (d < 2.2 && !e.action) { e.act('cut'); tryTackle(m, e, c, 'cut'); } }
    if (P.has('square') && !e.action) {
      e.act('strip');
      if (d < 1.3 && c.standing) { if (checkFumble(m, e, c, 0.6)) m.emit('strip', { e, c }); }
    }
    if (P.has('triangle') && !e.action && !e.isBusyAction()) { e.act('jump_swat'); e.vy = 2.6; }
    if (P.has('circle')) m.switchDefender(side);
  } else if (P.has('circle') && side === m.defSide) m.switchDefender(side);
  if (mag > 0.12) e.setWant(mv.x, mv.z, s);
  else e.setWant(0, 0, 0);
}

// ---------------------------------------------------------------- QB
function userQB(m, e, cmd, dt, s, mag) {
  const P = cmd.pressed || new Set();
  const side = e.side;
  // option: ✕ give, △ keep at the mesh; L1 pitches when he's keeping. Until he
  // grabs the stick the option runs itself (the ride, the read, the path)
  if (m.playKind === 'option' && !m.optionDone) {
    if (!m.optDecided && P.has('cross')) e.mem.forceKeep = false;
    if (!m.optDecided && P.has('triangle')) e.mem.forceKeep = true;
    if (P.has('l1') && m.optionKeep !== false) {
      const pm = m.play.option?.pitch ? m.byRole(m.play.option.pitch) : null;
      if (pm) { pitchTo(m, e, pm); return; }
    }
    if (mag > 0.4 && m.playT > 0.15) e.mem.userMoved = true;
    if (!e.mem.userMoved) return 'ai';
  }
  // run plays (and tricks that start with a handoff): the footwork and the handoff
  // are automatic unless he takes off
  if ((m.playKind === 'run' || (m.playKind === 'trick' && m.play.run)) && !m.mesh?.done) {
    if (mag > 0.4 && m.playT > 0.15) { e.mem.userMoved = true; e.setWant(cmd.move.x, cmd.move.z, s); return; }
    return 'ai';
  }
  // auto drop-back until he grabs the stick
  if (!e.mem.userMoved && (e.mem.phase === 'drop' || e.mem.phase === 'snap')) qbBrain(m, e, dt);
  else if (mag > 0.12) { e.setWant(cmd.move.x, cmd.move.z, s, (m.los - e.z) * m.offDir > 1 ? headingOf(0, m.offDir) : null); e.mem.backpedalling = false; }
  else e.setWant(0, 0, 0, headingOf(0, m.offDir));
  e.mem.phase = e.mem.phase === 'snap' ? 'drop' : e.mem.phase;
  // throws: the face button over a receiver (tap = touch, hold = bullet)
  if (e.action?.name === 'throw') return;
  for (const btn of FACE) {
    if (!P.has(btn)) continue;
    const rec = m.icons[side]?.[btn];
    if (!rec) continue;
    m.throwTo(e, rec, {
      power: 0.45,
      powerFrom: () => (m.cmd[side]?.held?.has(btn) ? 1 : 0.42),
      leadFrom: () => (m.settings.passLead === 'manual' || m.cmd[side]?.leadHeld ? m.cmd[side]?.move : null),
    });
    return;
  }
  if (P.has('l1') && !e.action) {
    e.act('pump');
    for (const d of m.foesOf(e)) { d.mem.hawkT = undefined; if (d.asg?.type === 'zone' && Math.random() < 0.6) d.mem.bit = m.time; }
    for (const r of m.matesOf(e)) r.mem.fakeT = m.time;
    m.emit('pump', { qb: e });
  }
  if (P.has('r3')) m.throwAway(e);
}

// ---------------------------------------------------------------- ball carrier
function userCarrier(m, e, cmd, dt, s, mag) {
  const P = cmd.pressed || new Set();
  const mv = cmd.move || { x: 0, z: 0 };
  if (mag > 0.12) e.setWant(mv.x, mv.z, s);
  else e.setWant(0, 0, 0);
  // a returner in his own end zone can take a knee
  if (P.has('triangle') && e.mem.caughtInEZ && !e.mem.leftEZ && m.field.inOwnEndZone(e.z, m.dirFor(e))) { m.whistle('touchback', { side: e.side }); return; }
  if (P.has('l1')) { m.lateralFrom(e, pickLateralTarget(m, e, mag > 0.3 ? mv : null)); return; }
  if (P.has('square')) m.doMove(e, 'stiff', nearestSide(m, e));
  if (P.has('circle')) m.doMove(e, 'spin', 'R');
  if (P.has('triangle')) m.doMove(e, 'hurdle');
  if (P.has('cross')) m.doMove(e, 'dive');
  if (P.has('l2') && e.p.pos === 'QB') m.doMove(e, 'slide');
  const held = cmd.held || new Set();
  if (held.has('r1') && e.carry !== 'two') e.carry = 'two';
  else if (!held.has('r1') && e.carry === 'two' && !e.mem.autoProtect) e.carry = e.mem.carrySide || 'R';
  const f = cmd.flick;
  if (f) {
    if (f.dir === 'up') m.doMove(e, 'truck');
    else if (f.dir === 'down') m.doMove(e, 'spin', 'L');
    else {
      // juke toward the flick, relative to his body
      const h = e.heading;
      const lx = Math.cos(h), lz = -Math.sin(h);
      const toLeft = (f.x * lx + f.z * lz) > 0;
      m.doMove(e, 'juke', toLeft ? 'L' : 'R');
    }
  }
}

function nearestSide(m, e) {
  const th = m.nearestThreat(e);
  if (!th) return 'L';
  const h = e.heading;
  const lx = Math.cos(h), lz = -Math.sin(h);
  return ((th.e.x - e.x) * lx + (th.e.z - e.z) * lz) > 0 ? 'L' : 'R';
}

export { carrierBrain, clamp };
