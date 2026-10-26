// Offensive brains: the quarterback, receivers on routes, blockers, the ball
// carrier and the men trailing him for a pitch. Each sets `e.want` (and
// starts actions); the match moves the bodies.
import { clamp, norm, dist, wrapAngle, headingOf, intercept, timeToReach } from '../math.js';
import { planThrow, releasePass, predictPos, maxRange } from '../passing.js';
import { tryTackle } from '../contact.js';

const R99 = (v) => (v ?? 50) / 99;
const tmp = {}, tmp2 = {};

// ================================================================== QB
/** Footwork targets for each drop type, in yards back from the line. */
const DROPS = {
  quick: { depth: 1.0, dur: 0.25 }, gun3: { depth: 1.6, dur: 0.55 }, gun5: { depth: 2.8, dur: 0.95 },
  drop3: { depth: 3.6, dur: 0.85 }, drop5: { depth: 5.8, dur: 1.3 }, drop7: { depth: 7.6, dur: 1.75 },
  pa: { depth: 5.5, dur: 1.6 }, boot: { depth: 5, dur: 1.7 }, sprint: { depth: 4, dur: 1.4 },
  flea: { depth: 3.2, dur: 1.5 }, toss: { depth: 1.5, dur: 0.4 },
};

export function qbSetup(m, e) {
  const d = DROPS[m.play.drop] || DROPS.gun3;
  const dir = m.offDir;
  const fromGun = m.form.qb === 'gun' || m.form.qb === 'pistol';
  const back = fromGun ? Math.max(0.6, d.depth - 3.4) : d.depth;
  let x = e.x, z = e.z - dir * back;
  if (m.play.drop === 'boot' || m.play.drop === 'sprint') {
    const side = (m.play.bootSide ?? m.play.run?.side ?? 1) * (m.flip ? -1 : 1);
    x = e.x - side * dir * 6.5;   // play space right → world −x·dir
    z = m.los - dir * 4.5;
  }
  e.mem.drop = { x, z, dur: d.dur };
  e.mem.phase = 'snap';
  e.mem.readIdx = 0;
  e.mem.readT = 0;
  e.mem.setT = 0;
}

/** CPU or auto-pilot QB before he throws / hands off. */
export function qbBrain(m, e, dt) {
  const dir = m.offDir;
  const mem = e.mem;
  if (m.ball.carrier !== e) {
    // the snap's on its way: wait for it
    if ((m.ball.state === 'air' && m.ball.kind === 'snap' && m.ball.target === e) || m.ball.state === 'snap') { e.setWant(0, 0, 0); return; }
    // ball gone: watch it, drift toward the play
    mem.phase = 'done';
    e.look = m.ball.state === 'air' ? { x: m.ball.x, y: m.ball.y, z: m.ball.z } : null;
    const c = m.ball.carrier;
    if (c && c.side === e.side && c !== e) return supportBrain(m, e, dt, true);
    e.setWant(0, 0, 0);
    return;
  }
  if (mem.phase === 'snap') { if (m.playT > 0.15) mem.phase = 'drop'; else { e.setWant(0, 0, 0); return; } }
  // run plays / handoffs are scripted by the match; options read in optionBrain
  if (m.playKind === 'run' || m.playKind === 'option' || m.playKind === 'qbrun' || m.scriptHold(e)) {
    return;
  }
  if (mem.phase === 'drop') {
    const d = mem.drop;
    const left = e.goTo(d.x, d.z, 1, m.play.drop === 'boot' || m.play.drop === 'sprint' ? null : headingOf(0, dir));
    mem.backpedalling = m.play.drop !== 'boot' && m.play.drop !== 'sprint';
    if (left < 0.45 || m.playT > d.dur + 0.6) { mem.phase = 'set'; mem.setT = 0; mem.backpedalling = false; }
  }
  if (mem.phase === 'set' || mem.phase === 'scramble' || (mem.phase === 'drop' && m.play.drop === 'quick')) {
    mem.setT += dt;
    if (e.ctrl !== null) return;   // a person is throwing
    cpuPass(m, e, dt);
  }
}

/** How open is this receiver if I let it go now? (seconds of cushion at the catch point) */
export function openness(m, qb, r) {
  const plan = planThrow(m, qb, r, { power: 0.65, assist: true, noNoise: true, delay: 0.25 });
  const T = plan.T + 0.25;
  let margin = 9, lane = 0;
  const ox = qb.x, oz = qb.z;
  // can the receiver himself get there in time? (a ball he can't reach is a ball for them)
  const tR = timeToReach(r, plan.tx, plan.tz, 0.45);
  const late = Math.max(0, tR - T);
  for (const d of m.defense) {
    if (!d.standing) continue;
    // a defender already running at the spot gets there quick; one who has to turn and
    // react (back to the QB in man trail) needs longer
    const react = d.asg?.type === 'man' ? 0.28 : 0.18;
    const tD = timeToReach(d, plan.tx, plan.tz, 0.55) + react;
    margin = Math.min(margin, tD - T - late);
    // in the throwing lane: near the line from QB to the spot, under the ball's arc
    const vx = plan.tx - ox, vz = plan.tz - oz;
    const L2 = vx * vx + vz * vz;
    const t = clamp(((d.x - ox) * vx + (d.z - oz) * vz) / L2, 0, 1);
    if (t > 0.12 && t < 0.92) {
      const px = ox + vx * t, pz = oz + vz * t;
      const off = Math.hypot(d.x - px, d.z - pz);
      // the arc clears heads in the middle of a long throw
      const h = 2.05 + (1.3 - 2.05) * t + 4 * Math.min(plan.T, 3) * t * (1 - t) * 1.2;
      if (off < 1.1 && h < 3.2) lane = Math.max(lane, 1 - off / 1.1);
    }
  }
  const depth = (plan.tz - m.los) * m.offDir;
  return { margin, lane, depth, plan, dist: plan.dist };
}

function cpuPass(m, e, dt) {
  const mem = e.mem;
  const reads = (m.passReads || []).map((role) => m.byRole(role)).filter((r) => r && r.standing && r.side === e.side && r !== e);
  const pressure = m.pressureOn(e);
  const awr = R99(e.r.awr);
  const dwell = 0.62 - awr * 0.25;
  mem.readT += dt;
  if (mem.readT > dwell && reads.length) { mem.readT = 0; mem.readIdx = Math.min(reads.length - 1, mem.readIdx + 1); }
  const need = m.toGo, late = m.lateAndTrailing();
  const t = mem.setT;
  // look at the current read (defenders read his eyes)
  const cur = reads[mem.readIdx];
  if (cur) e.look = { x: cur.x, y: 1.6, z: cur.z };
  // evaluate the reads he has gotten to (and the first ones again late)
  let best = null;
  // how tight a window he'll throw into: picky early, braver as the play goes on
  const thresh = 0.14 - Math.min(0.4, t * 0.13) - pressure * 0.22 - (m.difficulty.qbRisk || 0) + (1 - awr) * 0.06;
  for (let i = 0; i <= Math.min(mem.readIdx + (t > 2.2 ? 9 : 0), reads.length - 1); i++) {
    const r = reads[i];
    if (r.state === 'engaged' || r.mem.blocking) continue;
    const o = openness(m, e, r);
    if (o.lane > 0.55) continue;
    // value: yards, and getting the first down on money downs
    let v = o.depth + 2;
    if (m.down >= 3 && o.depth < need - 1) v -= 6;
    if (late && o.depth < 8) v -= 4;
    if (o.dist > maxRange(e) - 2) v -= 20;
    const score = o.margin * 6 + v * 0.18 - o.lane * 3;
    if (o.margin > thresh && (!best || score > best.score)) best = { r, o, score };
  }
  const canThrow = !e.action || !/throw|pump/.test(e.action.name);
  if (best && canThrow && t > 0.08) {
    m.throwTo(e, best.r, { power: best.o.depth > 18 ? 0.35 : best.o.depth < 7 ? 0.85 : 0.6 });
    return;
  }
  // pressure: step up, slide away, scramble, or get rid of it
  const threat = m.nearestThreat(e);
  const inPocket = Math.abs(e.x - m.ballX) < 4.5 && (m.los - e.z) * m.offDir > 0;
  if (threat && threat.d < 2.4) {
    const mob = R99(e.r.spd) * 0.6 + R99(e.r.agi) * 0.4;
    const lane = m.runLane(e);
    if (lane.open > 0.6 && (mob > 0.72 || lane.open > 0.85) && m.rng() < dt * 6) {
      mem.phase = 'scramble';
      mem.scrambleT = 0;
      m.emit('scramble', { qb: e });
    }
    if (mem.phase !== 'scramble') {
      // last-ditch: throw it away, or to anybody with half a chance
      if (threat.d < 1.4 && canThrow) {
        const any = reads.map((r) => ({ r, o: openness(m, e, r) })).sort((a, b) => b.o.margin - a.o.margin)[0];
        if (any && any.o.margin > -0.2 && any.o.lane < 0.5) { m.throwTo(e, any.r, { power: 0.8 }); return; }
        if (!inPocket || e.r.awr > 70) { m.throwAway(e); return; }
      }
      // slide away from the rush, staying behind the line
      const away = norm(e.x - threat.e.x, e.z - threat.e.z);
      const tx = clamp(e.x + away.x * 2, m.ballX - 6, m.ballX + 6);
      const tz = e.z + clamp(away.z * 2, -1.5, 1.5);
      const limit = m.los - m.offDir * 1.2;
      e.goTo(tx, (tz - limit) * m.offDir > 0 ? limit : tz, 0.7, headingOf(0, m.offDir));
      return;
    }
  } else if (mem.phase !== 'scramble') {
    // hang in there, small hitches in the pocket
    if (t > 3.5 && !inPocket) {
      if (m.rng() < dt * 0.8) m.throwAway(e);
    }
    const hitch = mem.drop;
    e.goTo(hitch.x + Math.sin(t * 1.7) * 0.2, hitch.z + m.offDir * Math.min(1.2, t * 0.25), 0.4, headingOf(0, m.offDir));
  }
  if (mem.phase === 'scramble') {
    mem.scrambleT = (mem.scrambleT || 0) + dt;
    // still behind the line: keep looking downfield
    const behind = (m.los - e.z) * m.offDir > 0.3;
    if (behind && best && canThrow) { m.throwTo(e, best.r, { power: 0.7 }); return; }
    carrierBrain(m, e, dt);
  }
}

// ================================================================== ROUTES
export function routeBrain(m, e, dt) {
  const mem = e.mem;
  const b = m.ball;
  // ball in the air to me: go get it
  if (b.state === 'air' && b.target === e && (b.kind === 'pass' || b.kind === 'lateral' || b.kind === 'tip')) return trackBall(m, e, dt);
  if (b.state === 'air' && (b.kind === 'tip' || (b.kind === 'pass' && b.target !== e)) && Math.hypot(b.x - e.x, b.z - e.z) < 6) return trackBall(m, e, dt, true);
  // somebody on my side has it past the line: block or trail
  const c = b.carrier;
  if (c && c.side === e.side && c !== e && (m.isRunning() || m.passCompleted)) {
    return afterCatchBrain(m, e, dt);
  }
  if (mem.blocking) return blockBrain(m, e, dt);
  // QB scrambling: break off and find grass
  const qb = m.qb;
  if (qb && qb.mem.phase === 'scramble' && b.carrier === qb && (m.los - qb.z) * m.offDir > 0) return scrambleDrill(m, e, dt);
  if (m.playT < (mem.routeDelay || 0) + (mem.jamT || 0)) {
    e.setWant(0, 0, 0);
    if (mem.jamT && m.playT < mem.jamT) e.setWant(-m.offDir * 0, m.offDir, 0.15);
    return;
  }
  const pts = mem.route;
  if (!pts || !pts.length) { e.setWant(0, 0, 0); return; }
  if (mem.routeIdx >= pts.length) {
    if (mem.settle) return settleBrain(m, e, dt);
    // keep running the last leg
    const a = pts[pts.length - 2] || { x: e.x - e.vx, z: e.z - e.vz }, p = pts[pts.length - 1];
    const n = norm(p.x - a.x, p.z - a.z);
    const tx = clamp(e.x + n.x * 5, -m.field.halfW + 1.2, m.field.halfW - 1.2);
    e.goTo(tx, e.z + n.z * 5, mem.routeSpeed || 1);
    return;
  }
  const p = pts[mem.routeIdx];
  const d = Math.hypot(p.x - e.x, p.z - e.z);
  const last = mem.routeIdx === pts.length - 1;
  const s = mem.routeSpeed || 0.95;
  if (d < (last && mem.settle ? 0.45 : 0.75)) {
    mem.routeIdx++;
    // plant and break
    const nx = pts[mem.routeIdx];
    if (nx) {
      const a1 = headingOf(p.x - e.x + e.vx * 0.1, p.z - e.z + e.vz * 0.1);
      const a2 = headingOf(nx.x - p.x, nx.z - p.z);
      if (Math.abs(wrapAngle(a2 - a1)) > 0.5) e.cutBoost = 0.18 + 0.12 * R99(e.r.rte);
    }
    return;
  }
  e.setWant(p.x - e.x, p.z - e.z, s);
}

function settleBrain(m, e, dt) {
  // sit in the soft spot: drift away from the nearest defender, face the QB
  const qb = m.qb || m.ball.carrier;
  const face = qb ? headingOf(qb.x - e.x, qb.z - e.z) : headingOf(0, -m.offDir);
  let near = null, nd = 9;
  for (const d of m.defense) {
    if (!d.standing) continue;
    const dd = Math.hypot(d.x - e.x, d.z - e.z);
    if (dd < nd) { nd = dd; near = d; }
  }
  const home = e.mem.route[e.mem.route.length - 1];
  if (near && nd < 3.5) {
    const n = norm(e.x - near.x, 0);
    const tx = clamp(e.x + n.x * 1.5, home.x - 2.5, home.x + 2.5);
    e.goTo(tx, home.z, 0.45, face);
  } else e.goTo(home.x, home.z, 0.3, face);
  e.look = qb ? { x: qb.x, y: 2, z: qb.z } : null;
}

function scrambleDrill(m, e, dt) {
  const qb = m.qb;
  // run toward the side he's scrambling, deep enough to be past the coverage
  const side = Math.sign(qb.vx || 0.01);
  const tx = clamp(qb.x + side * 6 + (e.x - qb.x) * 0.5, -m.field.halfW + 2, m.field.halfW - 2);
  const tz = m.los + m.offDir * clamp((e.z - m.los) * m.offDir, 6, 18);
  e.goTo(tx, tz, 0.9);
  e.look = { x: qb.x, y: 2, z: qb.z };
}

/** Work back to the ball: arrive where it comes down, at the right height. */
function trackBall(m, e, dt, loose = false) {
  const b = m.ball;
  const mem = e.mem;
  e.look = { x: b.x, y: b.y, z: b.z };
  // where it'll be at chest height (descending)
  const chest = e.height * 0.62;
  let tHit = b.timeToHeight(chest);
  if (tHit === null) tHit = b.timeToHeight(0.4) ?? 0.5;
  const P = b.predict(tHit, tmp);
  const d = Math.hypot(P.x - e.x, P.z - e.z);
  const canReach = d / Math.max(1, e.vTop) < tHit + 0.05;
  // user control: the stick nudges; with no input he tracks it
  e.goTo(P.x, P.z, 1, null, 0.4);
  if (loose) return;
  // start the catch animation so the hands meet the ball on time
  if (!e.action || !/catch|dive/.test(e.action.name)) {
    const highBall = b.predict(Math.max(0, tHit - 0.05), tmp2).y > e.height * 0.62 + 0.75;
    const lead = mem.catchType;
    if (tHit < 0.3) {
      if (lead === 'dive' || (!canReach && d < 2.4 && d > 0.9)) { e.act('catch_dive'); e.boost = { vx: (P.x - e.x) / Math.max(0.3, d) * 3, vz: (P.z - e.z) / Math.max(0.3, d) * 3, t: 0.25 }; mem.catchType = 'dive'; }
      else if (lead === 'high' || highBall) { e.act('catch_high'); e.vy = 3.2 + R99(e.r.jmp) * 1.4; mem.catchType = 'high'; }
      else if (tHit < 0.26) {
        const vb = norm(b.vx, b.vz);
        const hd = { x: Math.sin(e.heading), z: Math.cos(e.heading) };
        const behind = vb.x * hd.x + vb.z * hd.z > 0.4;
        e.act(behind ? 'catch_shoulder' : 'catch_chest');
      }
    }
  }
  e.reachAt = { x: b.x, y: b.y, z: b.z };
}

function afterCatchBrain(m, e, dt) {
  const c = m.ball.carrier;
  // the closest skill man trails for a pitch; the rest block
  if (e.mem.support || (m.supportFor(c) === e)) return supportBrain(m, e, dt);
  return downfieldBlock(m, e, dt, c);
}

// ================================================================== BLOCKING
export function blockBrain(m, e, dt) {
  const asg = e.asg;
  const kind = asg?.block || 'pass';
  if (e.state === 'engaged') {
    // the engagement physics moves him; keep his push direction current
    const rec = e.engaged;
    if (rec && rec.a === e) {
      const d = rec.b;
      const goal = d.mem.goal || m.ballSpot();
      if (m.isRunning() || kind !== 'pass') {
        // drive him away from the ball carrier's path
        const c = m.ball.carrier || m.runCarrier();
        const away = c ? norm(d.x - c.x, d.z - c.z) : { x: 0, z: m.offDir };
        e.mem.pushDir = norm(away.x + 0.6 * m.offDir * 0, away.z + 0.5 * m.offDir);
      } else e.mem.pushDir = norm(d.x - goal.x, d.z - goal.z);
    }
    return;
  }
  const c = m.ball.carrier;
  if (c && c !== m.qb && m.isRunning() && c.side === e.side) {
    // the play's going: find somebody to block in front of the runner
    if (kind === 'lead' && !e.mem.led && dist(e, c) < 4) return leadBlock(m, e, dt, c);
    return downfieldBlock(m, e, dt, c);
  }
  if (kind === 'pass') return passPro(m, e, dt);
  if (kind === 'screen') return screenBlock(m, e, dt);
  return runBlock(m, e, dt);
}

function passPro(m, e, dt) {
  const qb = m.qb || m.ball.carrier;
  if (!qb) { e.setWant(0, 0, 0); return; }
  const dir = m.offDir;
  // set point: kick-slide back into the pocket
  const set = e.mem.setPt || (e.mem.setPt = { x: e.x + (e.x - m.ballX) * 0.25, z: e.z - dir * (e.role === 'C' ? 0.9 : 1.4) });
  // pick the most dangerous unblocked rusher in my area
  let tgt = e.mem.blockTgt;
  if (!tgt || !tgt.standing || (tgt.engaged && tgt.engaged.a !== e) || tgt === m.ball.carrier || !isRusher(m, tgt)) {
    tgt = null;
    let best = 1e9;
    for (const d of m.defense) {
      if (!d.standing || !isRusher(m, d)) continue;
      if (d.engaged && d.engaged.a !== e) continue;
      const claimed = m.offense.some((o) => o !== e && o.mem.blockTgt === d && o.standing && dist(o, d) < dist(e, d) + 0.5);
      const myLane = Math.abs(d.x - set.x);
      const toQb = Math.hypot(d.x - qb.x, d.z - qb.z);
      const score = myLane * 1.6 + toQb * 0.6 + (claimed ? 6 : 0);
      if (score < best) { best = score; tgt = d; }
    }
    e.mem.blockTgt = tgt;
  }
  const face = headingOf(0, dir);
  if (!tgt) {
    // nobody coming: hold the pocket, help on the nearest fight
    e.goTo(set.x, set.z, 0.5, face);
    return;
  }
  // stay between him and the QB, a yard in front of him
  const n = norm(qb.x - tgt.x, qb.z - tgt.z);
  const px = tgt.x + n.x * (tgt.radius + e.radius) * 0.95, pz = tgt.z + n.z * (tgt.radius + e.radius) * 0.95;
  e.goTo(px, pz, 0.85, face, 0.25);
  e.mem.wantBlock = tgt;
}

function isRusher(m, d) {
  if (d.asg?.type === 'rush') return true;
  // a linebacker/safety coming downhill past the line counts too
  return (d.z - m.los) * m.offDir < 3 && d.asg?.type !== 'man' && d.asg?.type !== 'zone';
}

function runBlock(m, e, dt) {
  const asg = e.asg;
  const run = m.play.run || {};
  const dir = m.offDir;
  const side = (run.side || 1) * (m.flip ? -1 : 1);
  const worldSide = -side * dir;        // play-space right → world −x·dir
  const scheme = run.scheme || 'zone';
  // pulling guard (power / counter / sweep backside)
  if (asg.pull) {
    const hole = m.holePoint();
    if (!e.mem.pulled) {
      const tx = hole.x - worldSide * 0.5, tz = m.los - dir * 1.4;
      if (Math.hypot(tx - e.x, tz - e.z) < 1 || m.playT > 1.1) e.mem.pulled = true;
      e.goTo(tx, tz, 1);
      return;
    }
    return leadBlock(m, e, dt, m.ball.carrier || m.runCarrier(), hole);
  }
  if (scheme === 'draw' && m.playT < 0.8) return passPro(m, e, dt);
  if (scheme === 'sneak') {
    e.setWant(0, dir, 0.7);
    e.mem.pushDir = { x: 0, z: dir };
    return;
  }
  // zone / man: the defender in my play-side gap, else climb to a linebacker
  let tgt = e.mem.blockTgt;
  if (!tgt || !tgt.standing || (tgt.engaged && tgt.engaged.a !== e)) {
    let best = 1e9; tgt = null;
    const aimX = e.x + worldSide * (scheme === 'zone' || scheme === 'sweep' ? 1.2 : 0.2);
    for (const d of m.defense) {
      if (!d.standing || (d.engaged && d.engaged.a !== e)) continue;
      const depth = (d.z - m.los) * dir;
      if (depth > 8) continue;
      const claimed = m.offense.some((o) => o !== e && o.mem.blockTgt === d);
      const score = Math.abs(d.x - aimX) + Math.max(0, depth) * 0.55 + (claimed ? 5 : 0);
      if (score < best) { best = score; tgt = d; }
    }
    e.mem.blockTgt = tgt;
  }
  if (!tgt) { e.setWant(-worldSide * 0, dir, 0.6); return; }
  // reach his play side shoulder and drive
  const px = tgt.x - worldSide * 0.35 * (scheme === 'sweep' ? -1 : 1), pz = tgt.z - dir * 0.6;
  e.goTo(px, pz, 1, null, 0.2);
  e.mem.wantBlock = tgt;
  e.mem.pushDir = norm(-worldSide * 0.7, dir);
}

function leadBlock(m, e, dt, carrier, hole = null) {
  // run to the hole, then take the first defender who can make the play
  const dir = m.offDir;
  const h = hole || m.holePoint();
  let tgt = e.mem.leadTgt;
  if (!tgt || !tgt.standing || tgt.engaged) {
    tgt = null;
    let best = 1e9;
    for (const d of m.defense) {
      if (!d.standing || d.engaged) continue;
      const toHole = Math.hypot(d.x - h.x, d.z - (h.z + dir * 2));
      if (toHole > 7) continue;
      const claimed = m.offense.some((o) => o !== e && (o.mem.leadTgt === d || o.mem.blockTgt === d));
      const s = toHole + (claimed ? 4 : 0);
      if (s < best) { best = s; tgt = d; }
    }
    e.mem.leadTgt = tgt;
  }
  if (!tgt) {
    // nobody: go through the hole and look for work downfield
    e.goTo(h.x, h.z + dir * 3, 1);
    if ((e.z - h.z) * dir > 1) e.mem.led = true;
    return;
  }
  e.goTo(tgt.x - dir * 0, tgt.z - dir * 0.5, 1, null, 0.1);
  e.mem.wantBlock = tgt;
  e.mem.pushDir = carrier ? norm(tgt.x - carrier.x, tgt.z - carrier.z) : { x: 0, z: dir };
}

function screenBlock(m, e, dt) {
  // sell the pass rush for a second, then leak out in front of the screen
  if (m.playT < 0.95) return passPro(m, e, dt);
  for (const rec of m.engagements) if (!rec.done && rec.a === e && m.playT > 1.05) { rec.done = true; rec.a.engaged = null; rec.b.engaged = null; rec.a.state = 'active'; rec.b.state = 'active'; }
  const tgtRole = m.play.screen;
  const r = tgtRole ? m.byRole(tgtRole) : null;
  const c = m.ball.carrier;
  if (c && c === r) return downfieldBlock(m, e, dt, c);
  if (!r) { e.setWant(0, 0, 0); return; }
  const dir = m.offDir;
  const k = m.offense.indexOf(e);
  e.goTo(r.x + (m.ballX - r.x) * 0.25 + (k - 1) * 1.2, m.los + dir * (2 + (k % 2) * 2.5), 0.9);
}

function downfieldBlock(m, e, dt, c) {
  // the defender with the best shot at the runner that nobody's on yet
  const dir = m.dirFor(e);
  let tgt = e.mem.dfTgt;
  if (!tgt || !tgt.standing || tgt.engaged || m.rng() < dt * 0.6) {
    tgt = null;
    let best = 1e9;
    for (const d of m.foesOf(e)) {
      if (!d.standing || d.engaged || d.state === 'wrapping') continue;
      const toC = Math.hypot(d.x - c.x, d.z - c.z);
      const toMe = Math.hypot(d.x - e.x, d.z - e.z);
      // only men in front of the runner, roughly
      const ahead = (d.z - c.z) * dir > -1.5;
      if (!ahead || toMe > 12) continue;
      const claimed = m.matesOf(e).some((o) => o !== e && o.mem.dfTgt === d && o.standing);
      const s = toC * 0.8 + toMe * 0.7 + (claimed ? 7 : 0);
      if (s < best) { best = s; tgt = d; }
    }
    e.mem.dfTgt = tgt;
  }
  if (!tgt) {
    // run alongside, a few yards in front and wide
    const side = Math.sign(e.x - c.x) || 1;
    e.goTo(c.x + side * 3.5, c.z + dir * 3, 0.85);
    return;
  }
  // get between him and the runner
  const n = norm(c.x - tgt.x, c.z - tgt.z);
  e.goTo(tgt.x + n.x * 0.8, tgt.z + n.z * 0.8, 1, null, 0.15);
  e.mem.wantBlock = tgt;
  e.mem.pushDir = norm(tgt.x - c.x, tgt.z - c.z);
}

// ================================================================== BALL CARRIER
const ANGLES = [-1.65, -1.3, -1.0, -0.75, -0.5, -0.28, -0.1, 0, 0.1, 0.28, 0.5, 0.75, 1.0, 1.3, 1.65];

/** Pick the best lane: sample headings, look ahead, avoid defenders, follow blocks. */
export function chooseRunDir(m, e, opts = {}) {
  const dir = m.dirFor(e);
  const foes = m.foesOf(e), mates = m.matesOf(e);
  const F = m.field;
  const base = dir > 0 ? 0 : Math.PI;   // downfield heading
  const sp = Math.max(e.vTop * 0.95, 5);
  let best = -1e9, bestA = base;
  const prev = e.mem.runA ?? base;
  const goalZ = F.halfL * dir;
  const wantOut = opts.toSideline;
  const holeX = opts.hole?.x;
  for (const off of ANGLES) {
    const a = base + off;
    const dx = Math.sin(a), dz = Math.cos(a);
    let score = 0;
    let blocked = false;
    for (const t of [0.35, 0.75, 1.2, 1.7]) {
      const px = e.x + dx * sp * t, pz = e.z + dz * sp * t;
      // sidelines
      const edge = F.halfW - Math.abs(px);
      if (edge < 0.4) { score -= wantOut ? -2 : 6 * (0.4 - edge + 0.5); blocked = true; break; }
      // defenders who can get there by then
      for (const d of foes) {
        if (!d.standing || d.state === 'engaged' || d.recover > 0.3) continue;
        const reach = Math.hypot(d.x - px, d.z - pz) - d.radius - 0.9;
        const tD = Math.max(0, reach) / Math.max(4, d.vTop) + (d.state === 'wrapping' ? 1 : 0.12);
        if (tD < t) score -= (t - tD + 0.15) * (t < 0.5 ? 9 : 5) / (1 + t * 0.6);
      }
    }
    // progress toward the goal line (what you get before contact matters most)
    const prog = (dz * dir) * sp * 1.2;
    score += prog * 1.4;
    // stay near the designed hole early
    if (holeX !== undefined && opts.early) score -= Math.abs((e.x + dx * 3) - holeX) * 0.9;
    // behind a blocker who's on somebody: good
    for (const o of mates) {
      if (o === e || o.state !== 'engaged') continue;
      const rx = o.x - e.x, rz = o.z - e.z;
      const along = rx * dx + rz * dz;
      if (along > 0.5 && along < 5) {
        const off2 = Math.abs(rx * dz - rz * dx);
        if (off2 < 1.2) score -= 1.5;            // straight into his back
        else if (off2 < 2.6) score += 0.8;       // off his hip
      }
    }
    if (wantOut) score += Math.abs(Math.sin(a)) * 3;
    // no zig-zag: stick with the current line unless it's clearly worse
    score -= Math.abs(wrapAngle(a - prev)) * 1.6;
    if (blocked) score -= 2;
    if (score > best) { best = score; bestA = a; }
  }
  e.mem.runA = bestA;
  // near the goal: straight at it
  if (Math.abs(goalZ - e.z) < 3 && Math.abs(e.x) < F.halfW - 1) return { x: 0, z: dir, score: best };
  return { x: Math.sin(bestA), z: Math.cos(bestA), score: best };
}

/** CPU ball carrier (also the QB on a scramble, a returner). */
export function carrierBrain(m, e, dt) {
  const dir = m.dirFor(e);
  const isOff = e.side === m.offSide;
  if (e.state === 'wrapped') {
    // keep driving forward; maybe pitch it
    e.setWant(0, dir, 1);
    if (m.wantsLateral(e)) m.lateralFrom(e);
    return;
  }
  if (!e.standing) return;
  const behindLos = isOff && (m.los - e.z) * dir > 0;
  const holeEarly = isOff && m.runHole && behindLos && m.playT < 2.2;
  const toSide = m.wantOutOfBounds(e);
  const d = chooseRunDir(m, e, { hole: m.runHole, early: holeEarly, toSideline: toSide });
  e.setWant(d.x, d.z, 1);
  // moves
  const th = m.nearestThreat(e);
  if (th && e.moveCD <= 0 && !e.isBusyAction()) {
    const closing = th.closing;
    if (th.d < 2.3 && th.d > 1.0 && closing > 2) {
      const r = m.rng();
      const elu = R99(e.r.elu), trk = R99(e.r.trk), str = R99(e.r.str);
      const n = norm(th.e.x - e.x, th.e.z - e.z);
      const ahead = n.x * Math.sin(e.heading) + n.z * Math.cos(e.heading);
      const sideSign = (n.x * Math.cos(e.heading) - n.z * Math.sin(e.heading)) > 0 ? 'L' : 'R';
      const skill = m.difficulty.cpuMoves ?? 1;
      if (ahead > 0.5 && r < 0.09 * skill * (0.5 + elu)) m.doMove(e, 'juke', sideSign === 'L' ? 'R' : 'L');
      else if (ahead > 0.3 && r < 0.16 * skill * (0.3 + trk)) m.doMove(e, trk > 0.7 && e.mass > 210 ? 'truck' : 'stiff', sideSign);
      else if (r < 0.2 * skill * elu) m.doMove(e, 'spin', sideSign);
      else if (th.e.action?.name === 'dive_tackle' && r < 0.3) m.doMove(e, 'hurdle');
      e.moveCD = 0.6;
    }
  }
  // dive for the line / the pylon when he's about to be hit
  if (th && th.d < 1.8) {
    const toFirst = isOff ? (m.firstDownZ - e.z) * dir : 99;
    const toGoal = (m.field.halfL * dir - e.z) * dir;
    if ((toFirst > 0 && toFirst < 2.2) || (toGoal > 0 && toGoal < 2.6)) if (m.rng() < dt * 8) m.doMove(e, 'dive');
    if (e.p.pos === 'QB' && m.isRunning() && (e.z - m.los) * dir > 3 && th.d < 1.6 && m.rng() < dt * 3) m.doMove(e, 'slide');
  }
  // protect the ball in traffic
  const crowd = m.foesOf(e).filter((o) => o.standing && Math.hypot(o.x - e.x, o.z - e.z) < 2.5).length;
  if (crowd >= 2 && e.carry !== 'two' && !e.isBusyAction()) { e.carry = 'two'; } else if (crowd < 2 && e.carry === 'two') e.carry = e.mem.carrySide || 'R';
  // CPU lateral when it's on
  if (m.wantsLateral(e)) m.lateralFrom(e);
}

// ================================================================== SUPPORT (pitch relationship)
export function supportBrain(m, e, dt, loose = false) {
  const c = m.ball.carrier;
  if (!c || c === e || c.side !== e.side) { e.setWant(0, 0, 0); return; }
  const dir = m.dirFor(e);
  // behind and outside him, toward the open side: 4 back, 4.5 wide
  let side = e.mem.supSide;
  if (!side) {
    side = Math.sign(e.x - c.x) || (c.x > 0 ? -1 : 1);
    if (Math.abs(c.x + side * 5) > m.field.halfW - 1.5) side = -side;
    e.mem.supSide = side;
  }
  if (Math.abs(c.x + side * 4.5) > m.field.halfW - 1) side = e.mem.supSide = -side;
  const tx = c.x + side * 4.5;
  const tz = c.z - dir * (loose ? 5.5 : 3.8);
  const d = Math.hypot(tx - e.x, tz - e.z);
  // match his speed once in position
  const cs = c.speed / Math.max(1, e.vTop);
  e.setWant(tx - e.x + c.vx * 0.35, tz - e.z + c.vz * 0.35, clamp(cs + d * 0.18, 0.35, 1));
  e.look = { x: c.x, y: 1.4, z: c.z };
}
