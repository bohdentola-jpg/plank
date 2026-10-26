// The choreography inside a play: handoffs at the mesh point, toss sweeps,
// play-action fakes, draws, jet sweeps, option reads, and the scripted trick
// plays (flea flicker, double pass, hook & ladder, reverses, the halfback pass,
// the Philly Special, the Statue of Liberty).
import { clamp, norm, dist, headingOf } from './math.js';
import { planToss, releaseToss } from './passing.js';
import { carrierBrain, supportBrain } from './ai/offense.js';
import { toWorld } from './setup.js';

const R99 = (v) => (v ?? 50) / 99;
const HOLE_X = { A: 0.8, B: 2.2, C: 3.6, edge: 7 };

/** Called at the snap for run / option / trick plays: where's the hole, when's the mesh. */
export function setupRun(m) {
  const run = m.play.run;
  if (!run) return;
  const fl = m.flip ? -1 : 1;
  const side = (run.side || 1) * fl;
  const px = (HOLE_X[run.hole] ?? 2) * side;
  m.runHole = toWorld(m, px, 0.6, 1);
  const fromGun = m.form.qb === 'gun' || m.form.qb === 'pistol';
  m.mesh = {
    t: run.jet ? 0.42 : run.give === 'toss' ? 0.32 : run.scheme === 'draw' ? (run.delay || 0.8) : run.give === 'direct' ? 0 : fromGun ? 0.55 : 0.78,
    done: run.give === 'direct' || run.give === 'keep',
    sideW: -side * m.offDir,
  };
}

/** The designated ball carrier before he has it: get to the mesh, take it, hit the hole. */
export function runnerBrain(m, e, dt) {
  const run = m.play.run;
  const qb = m.qb;
  const b = m.ball;
  if (!run || !qb) { e.setWant(0, 0, 0); return; }
  if (b.carrier === e) return carrierBrain(m, e, dt);
  const dir = m.offDir;
  const mesh = m.mesh || { t: 0.6 };
  // scripted legs first (reverse man, flea flicker back, statue…)
  if (e.mem.route && e.mem.routeIdx < e.mem.route.length && m.play.kind === 'trick') {
    const p = e.mem.route[e.mem.routeIdx];
    if (Math.hypot(p.x - e.x, p.z - e.z) < 0.7) e.mem.routeIdx++;
    else e.setWant(p.x - e.x, p.z - e.z, e.mem.routeSpeed || 0.9);
    if (b.state === 'air' && b.target === e) e.setWant(b.targetPt.x - e.x, b.targetPt.z - e.z, 1);
    return;
  }
  if (run.give === 'toss') {
    // swing wide for the pitch
    const tgt = { x: m.runHole.x, z: m.los - dir * 3.8 };
    if (b.state === 'air' && b.target === e) { e.goTo(b.targetPt.x, b.targetPt.z, 1, null, 0.2); e.look = { x: b.x, y: b.y, z: b.z }; return; }
    e.goTo(tgt.x, tgt.z, 1);
    return;
  }
  // arrive at the mesh point beside the QB as the clock hits mesh.t, then the hole
  const mx = qb.x + (m.runHole.x - qb.x) * 0.18, mz = qb.z + dir * 0.35;
  const tLeft = mesh.t - m.playT;
  if (tLeft > 0) {
    const d = Math.hypot(mx - e.x, mz - e.z);
    e.setWant(mx - e.x, mz - e.z, clamp(d / Math.max(0.15, tLeft) / e.vTop, 0.2, 1));
  } else {
    // through the mesh toward the hole (the QB puts it in his belly on the way)
    e.goTo(m.runHole.x, m.runHole.z + dir * 2, 1);
  }
}

/** Handoff / pitch / fakes at the right moment (called from runScripts). */
export function handoffMesh(m, dt) {
  const run = m.play.run;
  const mesh = m.mesh;
  const qb = m.qb;
  if (!run || !mesh || mesh.done || !qb) return;
  const carrier = m.byRole(run.carrier);
  // still waiting on the snap
  if (m.ball.state === 'snap' || (m.ball.state === 'air' && m.ball.kind === 'snap')) return;
  if (!carrier || m.ball.carrier !== qb) { mesh.done = true; return; }
  // a person at QB who has run off with it keeps it
  if (qb.ctrl !== null && qb.mem.userMoved && run.give !== 'toss') { mesh.done = true; m.handedOff = false; return; }
  if (m.playT >= mesh.t - 0.3 && !mesh.started) {
    mesh.started = true;
    if (run.give === 'toss') {
      qb.act('pitch', { side: mesh.sideW > 0 ? 'L' : 'R' });
    } else {
      qb.act('handoff_give');
      carrier.act('handoff_take');
    }
  }
  if (run.give === 'toss') {
    if (qb.crossed('pitch', 0.16, dt) || (mesh.started && m.playT >= mesh.t)) {
      mesh.done = true;
      const plan = planToss(m, qb, carrier, { speed: 9 });
      releaseToss(m, qb, carrier, plan);
      m.handedOff = true;
      m.emit('pitch', { from: qb, to: carrier });
    }
    return;
  }
  // option give/keep decided elsewhere
  if (m.playKind === 'option' && m.optionKeep) { mesh.done = true; return; }
  if (mesh.started && m.playT >= mesh.t) {
    mesh.done = true;
    if (dist(qb, carrier) < 1.8) {
      m.ball.give(carrier);
      m.ball.history.push('handoff');
      m.handedOff = true;
      carrier.carry = carrier.mem.carrySide || 'R';
      m.seg(carrier, 'rush');
      m.emit('handoff', { from: qb, to: carrier });
      // the QB carries out his fake
      qb.mem.fake = true;
    } else {
      // botched mesh: the QB is stuck with it
      m.emit('meshMiss', { qb, carrier });
    }
  }
}

/** QB footwork on run plays (and the fake after the handoff). */
export function qbRunFeet(m, e, dt) {
  const dir = m.offDir;
  const run = m.play.run;
  if (!run) return false;
  if (m.ball.carrier !== e && m.handedOff) {
    // fake a bootleg the other way, then watch
    const away = -(m.mesh?.sideW || 1);
    e.goTo(e.x + away * 3, m.los - dir * 4, m.playT < 2 ? 0.55 : 0.2);
    e.look = m.ball.carrier ? { x: m.ball.carrier.x, y: 1.4, z: m.ball.carrier.z } : null;
    return true;
  }
  if (m.ball.carrier !== e) return false;
  // a direct snap to the runner (wildcat): he's just a ball carrier
  if (run.give === 'direct' && m.byRole(run.carrier) === e) { m.handedOff = true; return false; }
  if (run.carrier === 'QB' || run.give === 'keep') {
    // QB runs: sneak straight ahead, draw after two steps back
    if (run.scheme === 'sneak') { e.setWant(0, dir, 1); m.handedOff = true; return false; }
    if (run.scheme === 'draw' && m.playT < (run.delay || 0.9)) { e.goTo(e.x, m.los - dir * 3.5, 0.5, headingOf(0, dir)); return true; }
    m.handedOff = true;
    return false;
  }
  // turn toward the mesh: a step back and to the play side (a fixed spot, set once)
  if (!e.mem.meshSpot) e.mem.meshSpot = { x: e.x + (m.mesh?.sideW || 0) * 0.6, z: m.form.qb === 'under' ? m.los - dir * 2.2 : e.z - dir * 0.2 };
  e.goTo(e.mem.meshSpot.x, e.mem.meshSpot.z, 0.6);
  return true;
}

// ================================================================== OPTION
export function optionBrain(m, e, dt) {
  const opt = m.play.option;
  const dir = m.offDir;
  if (!opt) return carrierBrain(m, e, dt);
  // the read man
  if (!m.optRead) m.optRead = pickReadDefender(m, opt);
  const rd = m.optRead;
  if ((opt.read === 'end' || opt.read === 'dive') && !m.optionKeep && m.ball.carrier === e && m.mesh && !m.mesh.done) {
    // ride the mesh, read him
    const t = m.mesh.t;
    e.goTo(e.x + (m.mesh.sideW) * 0.25, e.z, 0.3);
    if (m.playT >= t - 0.12 && !m.optDecided) {
      m.optDecided = true;
      let keep;
      if (e.mem.forceKeep !== undefined) keep = e.mem.forceKeep;
      else {
        // he crashes the dive → keep; he sits on the QB → give
        const toMesh = rd ? norm(m.runHole.x - rd.x, m.runHole.z - rd.z) : { x: 0, z: 0 };
        const crash = rd ? ((rd.vx * toMesh.x + rd.vz * toMesh.z) > 1.6 || dist(rd, m.byRole(opt.give || opt.dive || 'RB') || e) < 1.8) : false;
        keep = crash;
        if (m.rng() > 0.62 + 0.36 * R99(e.r.awr)) keep = !keep;  // misreads happen
      }
      m.optionKeep = keep;
      if (keep) { m.mesh.done = true; m.emit('optionKeep', { qb: e }); }
    }
    return;
  }
  // keeping: attack the edge with the pitch man in relationship
  const pitchRole = opt.pitch;
  const pm = pitchRole ? m.byRole(pitchRole) : null;
  if (!pm || m.optionDone) { m.optionDone = true; return carrierBrain(m, e, dt); }
  const keepSideW = -((opt.keepSide ?? opt.side ?? 1) * (m.flip ? -1 : 1)) * dir;
  const edgeX = clamp(m.ballX + keepSideW * 8, -m.field.halfW + 3, m.field.halfW - 3);
  const tgtZ = (m.los - e.z) * dir > 0.5 ? m.los - dir * 0.5 : e.z + dir * 2;
  e.setWant(edgeX - e.x, tgtZ - e.z + dir * 1.5, 1);
  // pitch when the read man takes the QB
  const pr = m.optPitchRead || (m.optPitchRead = nearestOn(m, e, keepSideW));
  if (e.ctrl === null && pr) {
    const d = dist(pr, e);
    const committed = d < 2.6 && ((pr.vx * (e.x - pr.x) + pr.vz * (e.z - pr.z)) / Math.max(0.1, d)) > 2;
    if (committed && dist(pm, e) < 9 && (pm.z - e.z) * dir < 0.5) { pitchTo(m, e, pm); return; }
  }
  // past the line: he's a runner now
  if ((e.z - m.los) * dir > 1.2) { m.optionDone = true; }
}

export function pitchTo(m, from, to) {
  if (m.ball.carrier !== from) return;
  from.act('pitch', { side: (to.x - from.x) * m.offDir < 0 ? 'R' : 'L' });
  const plan = planToss(m, from, to, { speed: 10 });
  releaseToss(m, from, to, plan);
  m.optionDone = true;
  m.handedOff = true;
  m.emit('pitch', { from, to });
  m.tstat(from.side, 'laterals');
}

function pickReadDefender(m, opt) {
  const dir = m.offDir;
  const side = (opt.keepSide ?? opt.side ?? 1) * (m.flip ? -1 : 1);
  const wx = m.ballX - side * dir * 3.5;
  let best = null, bd = 1e9;
  for (const d of m.defense) {
    const dd = Math.hypot(d.x - wx, (d.z - m.los) * 0.7);
    if (dd < bd) { bd = dd; best = d; }
  }
  // nobody blocks the read man
  for (const o of m.offense) if (o.mem.blockTgt === best) o.mem.blockTgt = null;
  if (best) best.mem.readMan = true;
  return best;
}

function nearestOn(m, e, sideW) {
  let best = null, bd = 1e9;
  for (const d of m.defense) {
    if (!d.standing || d.state === 'engaged') continue;
    if ((d.x - e.x) * sideW < -1) continue;
    const dd = dist(d, e);
    if (dd < bd) { bd = dd; best = d; }
  }
  return best;
}

// ================================================================== TRICK PLAY SCRIPTS
export function runScripts(m, dt) {
  if (m.play.run && m.playKind !== 'pass') handoffMesh(m, dt);
  if (m.play.paFake && !m.scriptState.pa) paFake(m, dt);
  const steps = m.play.script;
  if (!steps) return;
  const S = m.scriptState;
  S.done = S.done || new Set();
  steps.forEach((st, i) => {
    if (S.done.has(i)) return;
    const from = st.from ? m.byRole(st.from) : null;
    // when?
    let go = false;
    if (st.at !== undefined) go = m.playT >= st.at;
    if (st.after === 'catch') {
      if (from && m.ball.carrier === from) {
        S.got = S.got || {};
        if (S.got[i] === undefined) S.got[i] = m.time;
        go = m.time - S.got[i] >= (st.delay || 0);
      }
    }
    if (!go) return;
    if (st.do === 'support') {
      if (from) { from.mem.support = true; from.asg = { type: 'support' }; }
      S.done.add(i);
      return;
    }
    if (st.do === 'pump') {
      if (from && m.ball.carrier === from) {
        from.act('pump');
        // the pump freezes the coverage for a beat
        for (const d of m.defense) d.mem.hawkT = undefined;
        for (const r of m.offense) r.mem.fakeT = m.time;
        m.emit('pump', { qb: from });
      }
      S.done.add(i);
      return;
    }
    if (!from || m.ball.carrier !== from) {
      // the ball isn't where the script expected (sacked, intercepted…): forget it
      if (st.at !== undefined && m.playT > st.at + 0.6) S.done.add(i);
      return;
    }
    const to = st.to ? m.byRole(st.to) : null;
    // a person holding the ball decides for himself (except designed handoffs)
    const userCarrier = from.ctrl !== null;
    if (st.do === 'handoff') {
      if (!to) { S.done.add(i); return; }
      if (dist(from, to) < 2.2) {
        from.act('handoff_give'); to.act('handoff_take');
        m.ball.give(to); m.ball.history.push('handoff');
        to.carry = to.mem.carrySide || 'R';
        m.handedOff = st.to !== 'QB';
        m.seg(to, 'rush');
        m.emit('handoff', { from, to });
        S.done.add(i);
      } else if (m.playT > (st.at || 0) + 0.8) S.done.add(i);
      return;
    }
    if (st.do === 'pitch' || st.do === 'lateral' || st.do === 'pass') {
      if (!to) { S.done.add(i); return; }
      from.act(st.do === 'pass' ? 'throw' : 'lateral', { side: 'R', power: 0.4 });
      const plan = planToss(m, from, to, { speed: st.do === 'pass' ? 13 : 10 });
      releaseToss(m, from, to, plan);
      m.emit(st.do === 'pass' ? 'backwardPass' : 'pitch', { from, to });
      m.tstat(from.side, 'laterals');
      if (st.to === 'QB') { to.mem.passer = true; to.asg = { type: 'qb' }; to.mem.phase = 'set'; to.mem.setT = 0; m.handedOff = false; }
      S.done.add(i);
      return;
    }
    if (st.do === 'throwFrom') {
      // he's the passer now
      from.mem.passer = true;
      from.asg = { type: 'qb' };
      from.mem.phase = 'set';
      from.mem.setT = 0;
      from.mem.readIdx = 0;
      m.qb = from;
      m.passReads = st.reads || [];
      m.handedOff = false;
      m.setIcons(from.side, (st.reads || []).map((r) => m.byRole(r)).filter(Boolean));
      m.emit('trickPasser', { e: from });
      S.done.add(i);
      return;
    }
    if (st.do === 'lateralAfterCatch') {
      S.lateralOk = true;
      if (to) { to.mem.support = true; to.asg = { type: 'support' }; }
      if (userCarrier) { m.emit('prompt', { text: 'L1  PITCH IT!', to }); S.done.add(i); return; }
      if (to && to.standing && (to.z - from.z) * m.offDir < 0.8 && dist(from, to) < 8) {
        m.lateralFrom(from, to);
        S.done.add(i);
      } else if (m.time - (S.got?.[i] ?? m.time) > 1.6) S.done.add(i);
    }
  });
}

/** Play-action: show the handoff, then the QB keeps dropping. */
function paFake(m, dt) {
  const S = m.scriptState;
  const qb = m.qb;
  const back = m.byRole(m.play.paFake);
  if (!qb || !back) { S.pa = true; return; }
  const t = m.form.qb === 'under' ? 0.7 : 0.5;
  if (m.playT >= t - 0.3 && !S.paStarted) { S.paStarted = true; qb.act('handoff_give'); back.act('handoff_take'); }
  if (m.playT >= t) {
    S.pa = true;
    // linebackers who bite step up toward the line
    for (const d of m.defense) {
      if (!d.role.startsWith('LB') && d.role !== 'S') continue;
      const bite = m.rng() > 0.25 + 0.6 * R99(d.r.prc);
      if (bite) { d.mem.bit = m.time; d.mem.runReadAt = m.time + 0.05; }
    }
    m.emit('playAction', { qb, back });
  }
}

export { supportBrain };
