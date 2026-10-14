// Time attack: before the green light, a pro drives YOUR car (same spec, same
// parts) around the track in a headless simulation. Their run sets the target
// time and is replayed as a translucent ghost you can chase.
import { RaceSim } from './sim.js';

const REC = 0.1; // seconds between samples

/**
 * Returns { target, lap1, fly } where lap1/fly are sample arrays
 * [t, x, y, z, heading, dist] (t and dist relative to that lap's start).
 * Closed tracks: lap1 = the standing-start lap, fly = a flying lap (target).
 * Open tracks: lap1 = fly = the whole run.
 */
export function proRun(track, spec, upgrades, { skill = 0.93, maxT = 900 } = {}) {
  const closed = track.closed;
  const sim = new RaceSim(track, {
    type: closed ? 'circuit' : 'sprint', laps: closed ? 2 : 1,
    racers: [{ spec, upgrades, name: 'PRO', skill }], rubber: 0, afterFinish: 0,
  });
  sim.startCountdown(0.01);
  const r = sim.racers[0];
  const all = [];
  let next = 0;
  const dt = 1 / 60;
  let t = 0;
  while (sim.state !== 'done' && !r.finished && t < maxT) {
    sim.events.length = 0;
    sim.step(dt);
    t += dt;
    if (sim.state !== 'racing' && sim.state !== 'finished') continue;
    if (sim.raceTime >= next) {
      const v = r.vehicle;
      all.push([sim.raceTime, v.x, v.y, v.z, v.heading, r.total]);
      next += REC;
    }
  }
  if (!r.finished) return null;
  if (!closed) return { target: r.finishTime, lap1: all, fly: all };
  const l1 = r.lapTimes[0];
  const l2 = r.lapTimes[1] ?? l1;
  const len = track.length;
  const lap1 = all.filter((p) => p[0] <= l1 + REC).map((p) => [p[0], p[1], p[2], p[3], p[4], p[5]]);
  const fly = all.filter((p) => p[0] >= l1 - REC && p[0] <= l1 + l2 + REC).map((p) => [p[0] - l1, p[1], p[2], p[3], p[4], p[5] - len]);
  return { target: l2, lap1, fly };
}

/** Interpolated ghost pose at time t into a lap trace. */
export function ghostAt(trace, t, out = {}) {
  if (!trace?.length) return null;
  if (t <= trace[0][0]) return Object.assign(out, pose(trace[0]));
  const last = trace[trace.length - 1];
  if (t >= last[0]) return Object.assign(out, pose(last));
  // traces are evenly spaced
  const dt = trace[1][0] - trace[0][0] || REC;
  let i = Math.min(trace.length - 2, Math.max(0, Math.floor((t - trace[0][0]) / dt)));
  while (i < trace.length - 2 && trace[i + 1][0] < t) i++;
  while (i > 0 && trace[i][0] > t) i--;
  const a = trace[i], b = trace[i + 1];
  const k = (t - a[0]) / Math.max(1e-6, b[0] - a[0]);
  let dh = b[4] - a[4];
  while (dh > Math.PI) dh -= Math.PI * 2;
  while (dh < -Math.PI) dh += Math.PI * 2;
  out.x = a[1] + (b[1] - a[1]) * k;
  out.y = a[2] + (b[2] - a[2]) * k;
  out.z = a[3] + (b[3] - a[3]) * k;
  out.heading = a[4] + dh * k;
  out.dist = a[5] + (b[5] - a[5]) * k;
  return out;
}

/** Time at which the ghost had covered `dist` meters of the lap (for the split delta). */
export function ghostTimeAtDist(trace, dist) {
  if (!trace?.length) return null;
  let lo = 0, hi = trace.length - 1;
  if (dist <= trace[0][5]) return trace[0][0];
  if (dist >= trace[hi][5]) return null;
  while (hi - lo > 1) {
    const m = (lo + hi) >> 1;
    if (trace[m][5] < dist) lo = m; else hi = m;
  }
  const a = trace[lo], b = trace[hi];
  const k = (dist - a[5]) / Math.max(1e-6, b[5] - a[5]);
  return a[0] + (b[0] - a[0]) * k;
}

function pose(p) { return { x: p[1], y: p[2], z: p[3], heading: p[4], dist: p[5] }; }
