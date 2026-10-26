// Throwing, pitching and kicking: where the ball should go, how hard, and how
// far off it actually goes.
//
// Passes lead the receiver along the rest of his route (not just his current
// velocity), so a ball thrown on time to a slant arrives where the slant will
// be. Tap = touch (arc over the coverage), hold = bullet (flat, fast, harder
// to catch). Accuracy falls off with distance, a rush in the QB's face,
// throwing on the run and fatigue; arm strength sets how far he can get it.
import { GRAVITY } from './field.js';
import { clamp, norm, lerp, timeToReach } from './math.js';

const R99 = (v) => (v ?? 50) / 99;
const RELEASE_H = 2.05;   // yards: the ball leaves a passer's hand overhead

/** Where will this player be in t seconds? Follows his route if he's on one. */
export function predictPos(m, e, t, out = {}) {
  const pts = e.mem.route;
  let x = e.x, z = e.z;
  if (pts && e.mem.routeIdx < pts.length && e.asg?.type === 'route' && !e.mem.settled) {
    const sp = Math.max(e.speed, e.vTop * (e.mem.routeSpeed || 0.92) * 0.85);
    // he hasn't left yet (a delayed route), or he's still getting going
    const wait = Math.max(0, (e.mem.routeDelay || 0) + (e.mem.jamT || 0) - m.playT);
    let left = Math.max(0, t - wait) * sp - (e.speed < sp * 0.5 ? sp * 0.22 : 0);
    let i = e.mem.routeIdx;
    while (left > 0 && i < pts.length) {
      const p = pts[i];
      const d = Math.hypot(p.x - x, p.z - z);
      if (d >= left) { x += (p.x - x) / d * left; z += (p.z - z) / d * left; left = 0; break; }
      x = p.x; z = p.z; left -= d; i++;
    }
    if (left > 0 && !e.mem.settle) {
      // past the end of the route: keep going the way the last leg went
      const a = pts[pts.length - 2] || { x: e.x, z: e.z }, b = pts[pts.length - 1];
      const n = norm(b.x - a.x, b.z - a.z);
      x += n.x * left; z += n.z * left;
    }
  } else {
    // coast on current velocity, easing off
    const k = Math.min(t, 1.5);
    x += e.vx * k; z += e.vz * k;
  }
  out.x = x; out.z = z;
  return out;
}

/** Horizontal ball speed for a throw of `power` (0 touch … 1 bullet). */
function throwSpeed(qb, power) {
  const thp = R99(qb.r.thp);
  const vTouch = 13.5 + 3.5 * thp;
  const vBullet = 19 + 7 * thp;
  return lerp(vTouch, vBullet, clamp(power, 0, 1));
}

export function maxThrowSpeed(qb) { return 20.5 + 7.2 * R99(qb.r.thp); }
export function maxRange(qb) { const v = maxThrowSpeed(qb); return v * v / GRAVITY * 0.97; }

/**
 * Work out a pass to `rec`. opts: power 0..1, lead {x, z} (world, |lead| ≤ 1 —
 * the stick), assist (pick a spot away from the coverage), hail (throw it to
 * the end zone), wild (throw-away: ignore the receiver)
 * Returns { tx, ty, tz, T, err } — the planned catch point and flight time.
 */
export function planThrow(m, qb, rec, opts = {}) {
  const power = opts.power ?? 0.6;
  const ox = qb.x, oz = qb.z;
  let vh = throwSpeed(qb, power);
  const dir = m.offDir;
  // iterate: where he'll be when the ball gets there
  let T = 0.6, px = rec.x, pz = rec.z;
  const tmp = {};
  // (when asked before the throw starts, add the wind-up: the ball leaves `delay` s later)
  const delay = opts.delay ?? 0;
  for (let k = 0; k < 5; k++) {
    predictPos(m, rec, T + delay, tmp);
    px = tmp.x; pz = tmp.z;
    // lead: a step in front of him, more on deep balls
    const d = Math.hypot(px - ox, pz - oz);
    T = d / vh;
  }
  let tx = px, tz = pz;
  // throw him open: shade the spot away from the nearest defender
  if (opts.assist !== false && !opts.hail) {
    let best = null, bd = 9;
    for (const o of m.active) {
      if (o.side === rec.side || !o.standing) continue;
      const d = Math.hypot(o.x - tx, o.z - tz);
      if (d < bd) { bd = d; best = o; }
    }
    if (best && bd < 4) {
      const n = norm(tx - best.x, tz - best.z);
      const k = clamp((4 - bd) / 4, 0, 1) * 1.1;
      tx += n.x * k; tz += n.z * k;
    }
    // deep balls go in front of him
    const along = (tz - rec.z) * dir;
    if (along > 12) tz += dir * 0.8;
  }
  // the stick: lead him where you want it (up to ~2.6 yd)
  if (opts.lead) {
    tx += opts.lead.x * 2.6;
    tz += opts.lead.z * 2.6;
  }
  if (opts.hail) {
    // heave it to the goal line, into the crowd
    tz = m.field.halfL * dir - dir * 2;
    tx = clamp(tx, -m.field.halfW + 4, m.field.halfW - 4);
  }
  // stay in the field
  tx = clamp(tx, -m.field.halfW + 0.6, m.field.halfW - 0.6);
  tz = clamp(tz, -m.field.end + 0.6, m.field.end - 0.6);
  let dist = Math.hypot(tx - ox, tz - oz);
  // arm strength: a long throw needs a bigger arc
  const range = maxRange(qb);
  let short = 0;
  if (dist > range) { short = dist - range; const n = norm(tx - ox, tz - oz); tx = ox + n.x * range; tz = oz + n.z * range; dist = range; }
  T = dist / vh;
  // a touch throw over 20 yards floats (more hang time), bullets stay flat
  if (power < 0.5 && dist > 14) T *= 1 + (0.5 - power) * 0.5;
  // the ball can't go faster than his arm: slow it (longer, loopier) if it would
  const ty = opts.hail ? 1.6 : 1.3;
  const vyNeed = (ty - RELEASE_H) / T + 0.5 * GRAVITY * T;
  const vMax = maxThrowSpeed(qb);
  if (Math.hypot(dist / T, vyNeed) > vMax) {
    // find the flight time the arm can manage
    for (let k = 0; k < 20; k++) {
      T *= 1.04;
      const vy2 = (ty - RELEASE_H) / T + 0.5 * GRAVITY * T;
      if (Math.hypot(dist / T, vy2) <= vMax) break;
    }
  }
  // --- accuracy
  const tha = R99(qb.r.tha);
  let sigma = (0.22 + dist * 0.026) * (1.45 - tha);
  const pressure = m.pressureOn(qb);
  sigma *= 1 + pressure * 0.75;
  const sp = qb.speed;
  if (sp > 2) {
    // throwing on the run, worse across his body
    sigma *= 1 + Math.min(0.6, (sp - 2) * 0.08);
  }
  if (qb.mem.backpedalling) sigma *= 1.25;
  if (power > 0.8 && dist < 16) sigma *= 0.85;
  if (power < 0.4 && dist > 25) sigma *= 0.9;
  sigma *= 1 + (1 - qb.stamina) * 0.5;
  if (m.weather === 'rain' || m.weather === 'snow') sigma *= 1.15;
  if (m.wind) sigma *= 1 + m.wind * dist * 0.004;
  const n = norm(tx - ox, tz - oz);
  if (opts.noNoise) sigma = 0;
  const eAlong = sigma ? m.rng.gauss() * sigma * 1.25 : 0, eSide = sigma ? m.rng.gauss() * sigma : 0;
  tx += n.x * eAlong - n.z * eSide;
  tz += n.z * eAlong + n.x * eSide;
  // wind drift
  if (m.windVec) { tx += m.windVec.x * T * T * 0.35; tz += m.windVec.z * T * T * 0.35; }
  return { tx, ty, tz, T: T + short / vh * 0.0, err: Math.hypot(eAlong, eSide), dist };
}

/** Let it go: the ball leaves the QB's hand toward the planned point. */
export function releasePass(m, qb, rec, plan, kind = 'pass') {
  const dir = m.offDir;
  const b = m.ball;
  const hx = qb.x + Math.sin(qb.heading) * 0.25, hz = qb.z + Math.cos(qb.heading) * 0.25;
  b.launch(hx, RELEASE_H, hz, plan.tx, plan.ty, plan.tz, plan.T, kind, qb);
  b.target = rec;
  b.forward = (plan.tz - hz) * dir > 0.25;
  b.history.push(b.forward ? 'pass' : 'lateral');
  return b;
}

/** Pitch / lateral to a teammate: soft and quick, more wayward under duress. */
export function planToss(m, from, to, opts = {}) {
  const vh = opts.speed ?? (11 + 2 * R99(from.r.awr));
  let T = 0.4;
  const tmp = {};
  // a pitch leads the man where he's running now (not where his drawn route went)
  for (let k = 0; k < 4; k++) {
    const lead = Math.min(T + 0.12, 1.2);
    tmp.x = to.x + to.vx * lead; tmp.z = to.z + to.vz * lead;
    T = Math.hypot(tmp.x - from.x, tmp.z - from.z) / vh;
  }
  T = Math.max(0.18, T);
  let tx = tmp.x, tz = tmp.z;
  const d = Math.hypot(tx - from.x, tz - from.z);
  let sigma = 0.18 + d * 0.035 * (1.3 - R99(from.r.awr) * 0.5);
  if (from.state === 'wrapped' || from.state === 'falling') sigma *= 2.2;
  if (from.speed > 6) sigma *= 1.2;
  tx += m.rng.gauss() * sigma;
  tz += m.rng.gauss() * sigma;
  // a pitch can't go forward: if he'd be level or ahead by the time it got there,
  // pitch it flat-back across his path and let him run onto it
  const dir = m.dirFor(from);
  if (!opts.forward && (tz - from.z) * dir > -0.45) {
    tz = from.z - dir * 0.45;
    const closing = to.vz * dir;
    if (closing > 0.5) {
      // he's coming up onto that line: hit him as he crosses it
      const tMeet = clamp(((tz - to.z) * dir) / closing, 0, 1.2);
      tx = to.x + to.vx * tMeet + m.rng.gauss() * sigma;
      T = clamp(tMeet, 0.22, 1.0);
    } else {
      // he's out in front: lead him back to it (slower ball, he comes to it)
      tx = to.x + to.vx * 0.3 + m.rng.gauss() * sigma;
      T = clamp(timeToReach(to, tx, tz, 0.3) + 0.1, 0.3, 1.4);
    }
  }
  return { tx, ty: 1.15, tz, T, dist: d };
}

export function releaseToss(m, from, to, plan) {
  const b = m.ball;
  b.launch(from.x, from.state === 'falling' ? 0.9 : 1.2, from.z, plan.tx, plan.ty, plan.tz, plan.T, 'lateral', from);
  b.target = to;
  b.forward = (plan.tz - from.z) * m.offDir > 0.3;
  b.kind = b.forward ? 'pass' : 'lateral';
  b.history.push(b.forward ? 'pass' : 'lateral');
  return b;
}

// ------------------------------------------------------------------ kicking
/**
 * Kick physics. kind: 'kickoff' | 'squib' | 'pooch' | 'onside' | 'punt' | 'fg'
 * power 0..1 (the meter), acc −1..1 (0 = dead centre), aim {x, z} target.
 * Returns the launch { vx, vy, vz, y } for the ball.
 */
export function planKick(m, kicker, kind, power, acc, aim) {
  const kpw = R99(kicker.r.kpw), kac = R99(kicker.r.kac);
  const dir = Math.sign(aim.z - kicker.z) || 1;
  const n = norm(aim.x - kicker.x, aim.z - kicker.z);
  // accuracy: the meter's miss plus the kicker's own scatter
  const spread = (1.3 - kac) * 0.06;
  const angErr = acc * 0.16 + m.rng.gauss() * spread + (m.windVec ? m.windVec.x * 0.004 : 0);
  const c = Math.cos(angErr), s = Math.sin(angErr);
  const dx = n.x * c - n.z * s, dz = n.x * s + n.z * c;
  let range, angle, y0 = 0.15;
  switch (kind) {
    case 'kickoff': range = (44 + 26 * kpw) * (0.55 + 0.45 * power); angle = 0.85 + m.rng() * 0.12; break;
    case 'squib': range = 26 + 12 * power; angle = 0.22; break;
    case 'pooch': range = 34 + 10 * power; angle = 1.05; break;
    case 'onside': range = 11 + 4 * power; angle = 0.35; break;
    case 'punt': range = (30 + 22 * kpw) * (0.6 + 0.4 * power); angle = 0.98 + m.rng() * 0.12; y0 = 1.3; break;
    case 'fg': default: {
      // speed from the meter; elevation fixed — the meter decides if it gets there
      const vMax = 25 + 10 * kpw;
      const v = vMax * (0.55 + 0.45 * power);
      const a = 0.62;
      return { vx: dx * v * Math.cos(a), vz: dz * v * Math.cos(a), vy: v * Math.sin(a), y: 0.15, kind: 'kick' };
    }
  }
  // speed for that range at that angle (flat ground)
  const v = Math.sqrt(range * GRAVITY / Math.max(0.2, Math.sin(2 * angle)));
  void dir;
  return { vx: dx * v * Math.cos(angle), vz: dz * v * Math.cos(angle), vy: v * Math.sin(angle), y: y0, kind: kind === 'punt' ? 'punt' : 'kick' };
}
